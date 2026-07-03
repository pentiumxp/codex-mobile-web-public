"use strict";

const fs = require("node:fs");

function createThreadSummaryStateService(dependencies = {}) {
  const STATE_DB = String(dependencies.stateDb || "");
  const USER_HOME = String(dependencies.userHome || "");
  const LOCAL_ACTIVE_THREAD_STATUS_TTL_MS = Math.max(60_000, Number(dependencies.localActiveThreadStatusTtlMs || String(30 * 60 * 1000)));
  const localActiveThreadStatuses = dependencies.localActiveThreadStatuses instanceof Map
    ? dependencies.localActiveThreadStatuses
    : new Map();
  const runSqliteJson = typeof dependencies.runSqliteJson === "function" ? dependencies.runSqliteJson : () => ({ ok: false, rows: [] });
  const statusText = typeof dependencies.statusText === "function" ? dependencies.statusText : (status) => String(status && status.type || status || "");
  const readRolloutTail = typeof dependencies.readRolloutTail === "function" ? dependencies.readRolloutTail : () => "";
  const parseJsonLine = typeof dependencies.parseJsonLine === "function" ? dependencies.parseJsonLine : () => null;
  const isRolloutTerminalEntry = typeof dependencies.isRolloutTerminalEntry === "function" ? dependencies.isRolloutTerminalEntry : () => false;
  const timestampToMs = typeof dependencies.timestampToMs === "function" ? dependencies.timestampToMs : () => 0;
  const rolloutLatestTurnEvidence = typeof dependencies.rolloutLatestTurnEvidence === "function" ? dependencies.rolloutLatestTurnEvidence : () => null;
  const rolloutEvidenceHasRuntimeActivity = typeof dependencies.rolloutEvidenceHasRuntimeActivity === "function" ? dependencies.rolloutEvidenceHasRuntimeActivity : () => false;
  const rolloutEvidenceIsRecent = typeof dependencies.rolloutEvidenceIsRecent === "function" ? dependencies.rolloutEvidenceIsRecent : () => false;
  const rolloutPathForThread = typeof dependencies.rolloutPathForThread === "function" ? dependencies.rolloutPathForThread : () => "";
  const readStartedThread = typeof dependencies.readStartedThread === "function" ? dependencies.readStartedThread : () => null;
  const updateThreadListFallbackCacheStatus = typeof dependencies.updateThreadListFallbackCacheStatus === "function" ? dependencies.updateThreadListFallbackCacheStatus : () => false;
  const normalizeStaleContextOnlyActiveThread = typeof dependencies.normalizeStaleContextOnlyActiveThread === "function" ? dependencies.normalizeStaleContextOnlyActiveThread : (thread) => thread;
  const normalizeHomeAiDeployLaneSummary = typeof dependencies.normalizeHomeAiDeployLaneSummary === "function" ? dependencies.normalizeHomeAiDeployLaneSummary : (thread) => thread;
  const annotateThreadRolloutStats = typeof dependencies.annotateThreadRolloutStats === "function" ? dependencies.annotateThreadRolloutStats : (thread) => thread;
  const attachThreadTaskCardCountsToSummary = typeof dependencies.attachThreadTaskCardCountsToSummary === "function"
    ? dependencies.attachThreadTaskCardCountsToSummary
    : (thread) => thread;
  const threadDisplaySummaryCache = dependencies.threadDisplaySummaryCache && typeof dependencies.threadDisplaySummaryCache.read === "function"
    ? dependencies.threadDisplaySummaryCache
    : {
      read: () => null,
      remember: (thread) => thread,
    };
  const threadListSummaryTimestampMs = typeof dependencies.threadListSummaryTimestampMs === "function" ? dependencies.threadListSummaryTimestampMs : () => 0;
  const stripThreadListDetailFields = typeof dependencies.stripThreadListDetailFields === "function" ? dependencies.stripThreadListDetailFields : (thread) => Object.assign({}, thread || {});
  const upsertThreadListFallbackCacheThread = typeof dependencies.upsertThreadListFallbackCacheThread === "function" ? dependencies.upsertThreadListFallbackCacheThread : () => false;

  function statusTurnId(status) {
    if (!status || typeof status !== "object") return "";
    return String(status.turnId || status.turn_id || status.activeTurnId || status.active_turn_id || "").trim();
  }

  function activeMarkerTurnId(value) {
    if (!value) return "";
    if (typeof value === "object") {
      return String(value.turnId || value.turn_id || value.id || value.activeTurnId || value.active_turn_id || "").trim();
    }
    return String(value || "").trim();
  }

  function activeMarkerTimestampMs(value) {
    if (!value || typeof value !== "object") return 0;
    for (const key of [
      "startedAtMs",
      "started_at_ms",
      "startedAt",
      "started_at",
      "lastActivityMs",
      "last_activity_ms",
      "timestampMs",
      "timestamp",
    ]) {
      const timestamp = timestampToMs(value[key]);
      if (timestamp) return timestamp;
    }
    return 0;
  }

  function threadActiveMarkerTurnIds(thread) {
    const ids = new Set();
    if (!thread || typeof thread !== "object") return ids;
    for (const value of [
      thread.activeTurnId,
      thread.active_turn_id,
      thread.mobileActiveTurnId,
      thread.mobile_active_turn_id,
      thread.mobileRolloutActiveTurn,
      thread.mobileLocalActiveStatus,
      thread.mobileStatusTurnId,
      thread.status,
    ]) {
      const id = value === thread.status ? statusTurnId(value) : activeMarkerTurnId(value);
      if (id) ids.add(id);
    }
    return ids;
  }

  function threadActiveMarkerStartedAtMs(thread) {
    if (!thread || typeof thread !== "object") return 0;
    for (const value of [
      thread.mobileLocalActiveStatus,
      thread.mobileRolloutActiveTurn,
      thread.status,
    ]) {
      const timestamp = activeMarkerTimestampMs(value);
      if (timestamp) return timestamp;
    }
    return 0;
  }

  function rowToFallbackThread(row) {
    const updatedAt = Number(row.updated_at || row.updatedAt || 0);
    const name = row.title || row.thread_name || null;
    const preview = row.first_user_message || row.preview || name || row.id;
    const status = row.status && typeof row.status === "object"
      ? row.status
      : { type: String(row.status || "notLoaded") };
    const activeTurnId = statusTurnId(status);
    const summary = {
      id: row.id,
      name,
      preview,
      cwd: typeof row.cwd === "string" ? row.cwd.replace(/^\\\\\?\\/, "") : null,
      path: row.path || row.rollout_path || row.rolloutPath || null,
      updatedAt,
      archived: Boolean(Number(row.archived || 0)),
      archivedAt: row.archived_at || null,
      status,
      model: row.model || null,
      effort: row.reasoning_effort || null,
      agentNickname: row.agent_nickname || null,
      agentRole: row.agent_role || null,
      isSpawnedChildThread: Boolean(Number(row.is_spawned_child || 0)),
      sandboxPolicy: row.sandbox_policy || null,
      approvalPolicy: row.approval_mode || null,
      mobileFallback: true,
    };
    if (activeTurnId && isThreadListLiveStatus(status)) summary.activeTurnId = activeTurnId;
    return attachThreadTaskCardCountsToSummary(annotateThreadRolloutStats(normalizeHomeAiDeployLaneSummary(summary)));
  }

  function sqlString(value) {
    return `'${String(value || "").replace(/'/g, "''")}'`;
  }

  function pruneLocalActiveThreadStatuses(now = Date.now()) {
    for (const [threadId, entry] of localActiveThreadStatuses) {
      if (!entry || Number(entry.expiresAtMs || 0) <= now) localActiveThreadStatuses.delete(threadId);
    }
  }

  function rolloutHasTerminalEntryAtOrAfter(rolloutPath, timestampMs = 0) {
    if (!rolloutPath) return false;
    const tail = readRolloutTail(rolloutPath);
    if (!tail) return false;
    const thresholdMs = Math.max(0, Number(timestampMs || 0) - 1000);
    for (const line of tail.split(/\r?\n/)) {
      if (!line || !line.trim()) continue;
      const entry = parseJsonLine(line);
      if (!isRolloutTerminalEntry(entry)) continue;
      const entryTimestampMs = timestampToMs(entry.timestamp || (entry.payload && entry.payload.timestamp));
      if (entryTimestampMs && entryTimestampMs >= thresholdMs) return true;
    }
    return false;
  }

  function localActiveSupersedingRolloutEvidence(rolloutPath, entry, nowMs = Date.now()) {
    const localTurnId = String(entry && entry.turnId || "").trim();
    if (!rolloutPath || !localTurnId) return null;
    let stat = null;
    try {
      stat = fs.statSync(rolloutPath);
    } catch (_) {
      stat = null;
    }
    const evidence = rolloutLatestTurnEvidence(rolloutPath, stat);
    if (!rolloutEvidenceHasRuntimeActivity(evidence)) return null;
    const evidenceTurnId = String(evidence.turnId || "").trim();
    if (!evidenceTurnId || evidenceTurnId === localTurnId) return null;
    const lastActivityMs = Number(evidence.lastActivityMs || 0);
    const localStartedAtMs = Number(entry && entry.startedAtMs || 0);
    if (localStartedAtMs && lastActivityMs && lastActivityMs < localStartedAtMs - 1000) return null;
    if (!rolloutEvidenceIsRecent(evidence, nowMs)) return null;
    return evidence;
  }

  function localActiveSummaryRolloutPath(threadId, summary = null) {
    const direct = rolloutPathForThread(summary);
    if (direct) return direct;
    const stateThread = threadId ? readStateDbThread(threadId) : null;
    const statePath = rolloutPathForThread(stateThread);
    if (statePath) return statePath;
    const startedThread = threadId ? readStartedThread(threadId) : null;
    return rolloutPathForThread(startedThread);
  }

  function readLocalActiveThreadStatus(threadId, summary = null, nowMs = Date.now()) {
    const id = String(threadId || "").trim();
    if (!id) return null;
    pruneLocalActiveThreadStatuses(nowMs);
    const entry = localActiveThreadStatuses.get(id);
    if (!entry) return null;
    if (Number(entry.expiresAtMs || 0) <= nowMs) {
      localActiveThreadStatuses.delete(id);
      updateThreadListFallbackCacheStatus(id, { type: "idle" }, { source: "local-active-expired" });
      return null;
    }
    const rolloutPath = localActiveSummaryRolloutPath(id, summary);
    if (rolloutHasTerminalEntryAtOrAfter(rolloutPath, entry.startedAtMs)) {
      localActiveThreadStatuses.delete(id);
      updateThreadListFallbackCacheStatus(id, { type: "completed" }, { source: "local-active-terminal" });
      return null;
    }
    const supersedingEvidence = localActiveSupersedingRolloutEvidence(rolloutPath, entry, nowMs);
    if (supersedingEvidence) {
      localActiveThreadStatuses.delete(id);
      updateThreadListFallbackCacheStatus(id, { type: "active" }, {
        source: "rollout-active-evidence",
        turnId: supersedingEvidence.turnId,
      });
      return null;
    }
    return entry;
  }

  function rememberLocalActiveThreadStatus(threadId, turnId = "", meta = {}) {
    const id = String(threadId || "").trim();
    if (!id) return null;
    const nowMs = Date.now();
    const entry = {
      threadId: id,
      turnId: String(turnId || "").trim(),
      source: String(meta.source || "local-turn-start"),
      startedAtMs: nowMs,
      expiresAtMs: nowMs + LOCAL_ACTIVE_THREAD_STATUS_TTL_MS,
    };
    localActiveThreadStatuses.set(id, entry);
    updateThreadListFallbackCacheStatus(id, { type: "active" }, {
      source: entry.source,
      turnId: entry.turnId,
    });
    return entry;
  }

  function clearLocalActiveThreadStatus(threadId) {
    const id = String(threadId || "").trim();
    if (!id) return false;
    const deleted = localActiveThreadStatuses.delete(id);
    if (deleted) updateThreadListFallbackCacheStatus(id, { type: "idle" }, { source: "local-active-cleared" });
    return deleted;
  }

  function applyLocalActiveThreadStatusToSummary(thread, options = {}) {
    if (!thread || typeof thread !== "object") return thread;
    const threadId = String(thread.id || options.threadId || "").trim();
    if (!threadId) return thread;
    const entry = readLocalActiveThreadStatus(threadId, thread, options.nowMs || Date.now());
    if (!entry) return thread;
    const startedAtSeconds = Math.floor(Number(entry.startedAtMs || Date.now()) / 1000);
    const updatedAt = Math.max(Number(thread.updatedAt || thread.updated_at || 0), startedAtSeconds);
    const out = Object.assign({}, thread, {
      id: threadId,
      updatedAt,
      status: { type: "active" },
      activeTurnId: entry.turnId || thread.activeTurnId || "",
      mobileLocalActiveStatus: {
        turnId: entry.turnId || "",
        source: entry.source || "",
        startedAtMs: entry.startedAtMs || 0,
        expiresAtMs: entry.expiresAtMs || 0,
      },
    });
    if (thread.updated_at && !thread.updatedAt) out.updated_at = updatedAt;
    return out;
  }

  function applyLocalActiveThreadStatusToResult(result, options = {}) {
    if (!result || typeof result !== "object" || !result.thread) return result;
    const thread = applyLocalActiveThreadStatusToSummary(result.thread, options);
    if (thread === result.thread) return result;
    return Object.assign({}, result, { thread });
  }

  function normalizeThreadSummaryLiveStatus(thread, options = {}) {
    const normalized = normalizeStaleContextOnlyActiveThread(thread);
    const activeReconciled = clearSupersededSummaryActiveFromRollout(normalized, options);
    return normalizeHomeAiDeployLaneSummary(applyLocalActiveThreadStatusToSummary(activeReconciled, options));
  }

  function readStateDbThread(threadId) {
    if (!fs.existsSync(STATE_DB) || !threadId) return null;
    const query = [
      "select id,title,first_user_message,cwd,rollout_path,archived,archived_at,updated_at,model,reasoning_effort,sandbox_policy,approval_mode,agent_nickname,agent_role,",
      "exists(select 1 from thread_spawn_edges where child_thread_id=threads.id) as is_spawned_child",
      "from threads",
      `where id=${sqlString(threadId)}`,
      "limit 1;",
    ].join(" ");
    try {
      const result = runSqliteJson(STATE_DB, query, { timeoutMs: 5000, maxBuffer: 1024 * 1024, userHome: USER_HOME });
      if (!result.ok) return null;
      const rows = result.rows;
      return rows[0] ? rowToFallbackThread(rows[0]) : null;
    } catch (_) {
      return null;
    }
  }

  function isThreadListLiveStatus(status) {
    const text = statusText(status).toLowerCase();
    return /^(active|running|queued|processing|inprogress|in_progress|in-progress)$/.test(text);
  }

  function isThreadListRestStatus(status) {
    const text = statusText(status).toLowerCase();
    return /^(idle|completed|failed|cancelled|canceled|interrupted|error)$/.test(text);
  }

  function isThreadListUnknownStatus(status) {
    const text = statusText(status).toLowerCase();
    return !text || /^(unknown|notloaded|not_loaded|not-loaded)$/.test(text);
  }

  function shouldReplaceThreadDisplayStatus(baseStatus, displayStatus, baseUpdatedAtMs, displayUpdatedAtMs) {
    if (!displayStatus) return false;
    if (!baseStatus) return true;
    const baseUnknown = isThreadListUnknownStatus(baseStatus);
    const displayUnknown = isThreadListUnknownStatus(displayStatus);
    if (displayUnknown && !baseUnknown) return false;
    if (!displayUnknown && baseUnknown) return true;
    const baseLive = isThreadListLiveStatus(baseStatus);
    const displayLive = isThreadListLiveStatus(displayStatus);
    if (baseLive && !displayLive) return isThreadListRestStatus(displayStatus);
    if (!baseLive && displayLive) {
      return Boolean(displayUpdatedAtMs && baseUpdatedAtMs && displayUpdatedAtMs > baseUpdatedAtMs + 1000);
    }
    if (displayUpdatedAtMs && baseUpdatedAtMs && displayUpdatedAtMs < baseUpdatedAtMs) return false;
    return true;
  }

  function statusHasRuntimeActiveEvidence(status) {
    if (!status || typeof status !== "object") return false;
    if (status.mobileRuntimeDerived === true || status.mobileLocalActiveStatus === true) return true;
    return Boolean(statusTurnId(status));
  }

  function threadHasRuntimeActiveEvidence(thread) {
    if (!thread || typeof thread !== "object") return false;
    return Boolean(
      thread.activeTurnId
      || thread.active_turn_id
      || thread.mobileActiveTurnId
      || thread.mobileRolloutActiveTurn
      || thread.mobileLocalActiveStatus
      || thread.mobileStatusTurnId
      || statusHasRuntimeActiveEvidence(thread.status),
    );
  }

  function isDeployLaneIdleSummary(thread) {
    if (!thread || typeof thread !== "object") return false;
    const status = thread.status && typeof thread.status === "object" ? thread.status : {};
    return (thread.mobileDeployLane === true || status.mobileDeployLane === true)
      && !isThreadListLiveStatus(thread.status);
  }

  function shouldReplaceDeployLaneRuntimeActiveStatus(base, display) {
    if (!isDeployLaneIdleSummary(base)) return false;
    if (!display || !isThreadListLiveStatus(display.status)) return false;
    return threadHasRuntimeActiveEvidence(display);
  }

  function copyThreadSummaryActiveMarkers(target, display) {
    if (!target || !display || typeof target !== "object" || typeof display !== "object") return target;
    for (const key of [
      "activeTurnId",
      "active_turn_id",
      "mobileActiveTurnId",
      "mobileRolloutActiveTurn",
      "mobileLocalActiveStatus",
      "mobileStatusTurnId",
      "mobileStatusSource",
    ]) {
      if (display[key] !== undefined && display[key] !== null && display[key] !== "") target[key] = display[key];
    }
    const displayStatusTurnId = statusTurnId(display.status);
    if (displayStatusTurnId) target.activeTurnId = displayStatusTurnId;
    return target;
  }

  function clearThreadSummaryActiveMarkers(thread) {
    if (!thread || typeof thread !== "object") return thread;
    delete thread.activeTurnId;
    delete thread.active_turn_id;
    delete thread.mobileLocalActiveStatus;
    delete thread.mobileRolloutActiveTurn;
    delete thread.mobileActiveTurnId;
    delete thread.mobileStatusTurnId;
    delete thread.mobileStatusSource;
    return thread;
  }

  function rolloutLatestEvidenceForSummary(thread, rolloutPath) {
    if (!rolloutPath) return null;
    let stat = null;
    try {
      stat = fs.statSync(rolloutPath);
    } catch (_) {
      stat = null;
    }
    return rolloutLatestTurnEvidence(rolloutPath, stat);
  }

  function clearSupersededSummaryActiveFromRollout(thread, options = {}) {
    if (!thread || typeof thread !== "object" || !isThreadListLiveStatus(thread.status)) return thread;
    const markerIds = threadActiveMarkerTurnIds(thread);
    if (!markerIds.size) return thread;
    const rolloutPath = localActiveSummaryRolloutPath(thread.id || thread.threadId || "", thread);
    if (!rolloutPath) return thread;
    const startedAtMs = threadActiveMarkerStartedAtMs(thread);
    let terminal = Boolean(startedAtMs && rolloutHasTerminalEntryAtOrAfter(rolloutPath, startedAtMs));
    if (!terminal) {
      const evidence = rolloutLatestEvidenceForSummary(thread, rolloutPath);
      const evidenceTurnId = String(evidence && evidence.turnId || "").trim();
      terminal = Boolean(evidence && evidence.hasTerminal && evidenceTurnId && markerIds.has(evidenceTurnId));
    }
    if (!terminal) return thread;
    const out = Object.assign({}, thread, {
      status: {
        type: "completed",
        mobileClearedStaleActiveSummary: true,
        previousType: statusText(thread.status),
      },
    });
    clearThreadSummaryActiveMarkers(out);
    const id = String(out.id || out.threadId || "").trim();
    if (id) {
      localActiveThreadStatuses.delete(id);
      updateThreadListFallbackCacheStatus(id, { type: "completed" }, { source: "stale-active-terminal-rollout" });
    }
    return out;
  }

  function mergeThreadWithCachedDisplaySummary(thread, options = {}) {
    if (!thread || typeof thread !== "object" || !thread.id) return thread;
    const cached = threadDisplaySummaryCache.read(thread.id);
    return normalizeStaleContextOnlyActiveThread(cached ? (mergeThreadDisplaySummary(thread, cached, options) || thread) : thread);
  }

  function copyThreadDisplayRolloutMetadata(target, display) {
    if (!target || !display || typeof display !== "object") return target;
    for (const key of ["path", "rolloutPath", "rollout_path"]) {
      const value = display[key];
      if (typeof value === "string" && value.trim()) target[key] = value;
    }
    for (const key of ["rolloutSizeBytes", "rolloutSizeUpdatedAtMs", "rolloutWarningThresholdBytes"]) {
      const value = Number(display[key]);
      if (Number.isFinite(value) && value > 0) target[key] = Math.trunc(value);
    }
    if (typeof display.rolloutOverWarningThreshold === "boolean") {
      target.rolloutOverWarningThreshold = display.rolloutOverWarningThreshold;
    }
    return target;
  }

  function mergeThreadDisplaySummary(base, display, options = {}) {
    if (!base) return display ? normalizeStaleContextOnlyActiveThread(annotateThreadRolloutStats(display, options)) : null;
    if (!display) return normalizeStaleContextOnlyActiveThread(base);
    const next = Object.assign({}, base);
    for (const key of ["name", "preview", "cwd"]) {
      const value = display[key];
      if (value !== null && value !== undefined && String(value).trim() !== "") next[key] = value;
    }
    const displayUpdatedAtMs = threadListSummaryTimestampMs(display);
    const baseUpdatedAtMs = threadListSummaryTimestampMs(base);
    if (displayUpdatedAtMs && displayUpdatedAtMs >= baseUpdatedAtMs) {
      const displayFieldUpdatedAtMs = timestampToMs(display.updatedAt || display.updated_at || display.updatedAtMs || display.updated_at_ms);
      next.updatedAt = Math.floor(Math.max(displayUpdatedAtMs, displayFieldUpdatedAtMs) / 1000);
    }
    const replaceStatus = shouldReplaceDeployLaneRuntimeActiveStatus(base, display)
      || shouldReplaceThreadDisplayStatus(base.status, display.status, baseUpdatedAtMs, displayUpdatedAtMs);
    if (replaceStatus) {
      next.status = display.status;
      if (isThreadListRestStatus(display.status)) clearThreadSummaryActiveMarkers(next);
    }
    if (isThreadListLiveStatus(next.status) && isThreadListLiveStatus(display.status)) {
      copyThreadSummaryActiveMarkers(next, display);
    }
    for (const key of ["archived", "archivedAt", "archived_at", "deleted", "deletedAt", "deleted_at", "agentNickname", "agent_nickname", "agentRole", "agent_role"]) {
      const value = display[key];
      if (value !== null && value !== undefined && value !== "") next[key] = value;
    }
    if (display.isSpawnedChildThread || display.is_spawned_child) next.isSpawnedChildThread = true;
    if (display.mobileFallback && !next.mobileFallback) next.mobileFallback = true;
    copyThreadDisplayRolloutMetadata(next, display);
    return normalizeStaleContextOnlyActiveThread(annotateThreadRolloutStats(next, options));
  }

  function mergeThreadRuntimeFromStateDb(thread, summary = null) {
    if (!thread || typeof thread !== "object") return thread;
    const stateThread = summary || readStateDbThread(thread.id);
    if (!stateThread) return thread;
    const next = Object.assign({}, thread);
    if (stateThread.model) next.model = stateThread.model;
    if (stateThread.effort) next.effort = stateThread.effort;
    return next;
  }

  function detailReadThreadSummaryForFallbackCache(body = {}) {
    const thread = body && body.thread && typeof body.thread === "object" ? body.thread : null;
    const id = String(thread && (thread.id || thread.threadId || thread.thread_id) || "").trim();
    if (!id) return null;
    const summary = stripThreadListDetailFields(Object.assign({}, thread, { id }));
    if (isThreadListRestStatus(summary.status)) clearThreadSummaryActiveMarkers(summary);
    return summary;
  }

  function syncThreadDetailReadResultToThreadListFallbackCache(payload = {}) {
    const status = Number(payload.status || 0);
    if (status >= 400 || payload.complete === false) return { synced: false, reason: "detail-read-incomplete" };
    const summary = detailReadThreadSummaryForFallbackCache(payload.body);
    if (!summary || !summary.id) return { synced: false, reason: "missing-thread-summary" };
    const restStatus = isThreadListRestStatus(summary.status);
    if (restStatus) clearLocalActiveThreadStatus(summary.id);
    const normalized = normalizeThreadSummaryLiveStatus(restStatus
      ? clearThreadSummaryActiveMarkers(summary)
      : summary);
    const upserted = upsertThreadListFallbackCacheThread(normalized, { addIfMissing: true });
    threadDisplaySummaryCache.remember(normalized);
    return {
      synced: Boolean(upserted),
      restStatus,
    };
  }

  return {
    statusTurnId,
    rowToFallbackThread,
    sqlString,
    pruneLocalActiveThreadStatuses,
    rolloutHasTerminalEntryAtOrAfter,
    localActiveSupersedingRolloutEvidence,
    localActiveSummaryRolloutPath,
    readLocalActiveThreadStatus,
    rememberLocalActiveThreadStatus,
    clearLocalActiveThreadStatus,
    applyLocalActiveThreadStatusToSummary,
    applyLocalActiveThreadStatusToResult,
    normalizeThreadSummaryLiveStatus,
    readStateDbThread,
    isThreadListLiveStatus,
    isThreadListRestStatus,
    isThreadListUnknownStatus,
    shouldReplaceThreadDisplayStatus,
    clearThreadSummaryActiveMarkers,
    mergeThreadWithCachedDisplaySummary,
    mergeThreadDisplaySummary,
    mergeThreadRuntimeFromStateDb,
    detailReadThreadSummaryForFallbackCache,
    syncThreadDetailReadResultToThreadListFallbackCache,
  };
}

module.exports = {
  createThreadSummaryStateService,
};
