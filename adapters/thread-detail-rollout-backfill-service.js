"use strict";

const defaultFs = require("node:fs");

function noop() {}

function createThreadDetailRolloutBackfillService(dependencies = {}) {
  const fs = dependencies.fs || defaultFs;
  const runtimeContextCacheTtlMs = Math.max(1000, Number(dependencies.runtimeContextCacheTtlMs || 30000));
  const runtimeContextCacheMax = Math.max(20, Number(dependencies.runtimeContextCacheMax || 200));
  const threadDetailCompletedProgressMessages = Math.max(0, Number(dependencies.threadDetailCompletedProgressMessages || 0));
  const threadDetailProgressiveActiveUserTextChars = Math.max(0, Number(dependencies.threadDetailProgressiveActiveUserTextChars || 0));
  const maxThreadTurns = Math.max(1, Number(dependencies.maxThreadTurns || 10));
  const normalizeFsPath = typeof dependencies.normalizeFsPath === "function" ? dependencies.normalizeFsPath : (value) => String(value || "");
  const runtimeContextCacheKey = typeof dependencies.runtimeContextCacheKey === "function"
    ? dependencies.runtimeContextCacheKey
    : (rolloutPath, stat) => `${normalizeFsPath(rolloutPath)}:${stat && stat.size}:${Math.trunc(Number(stat && stat.mtimeMs || 0))}`;
  const statusText = typeof dependencies.statusText === "function" ? dependencies.statusText : (value) => String(value || "");
  const timestampToMs = typeof dependencies.timestampToMs === "function" ? dependencies.timestampToMs : () => 0;
  const stableTextHash = typeof dependencies.stableTextHash === "function" ? dependencies.stableTextHash : (value) => String(value || "").slice(0, 16);
  const finalReceiptTextFromParams = typeof dependencies.finalReceiptTextFromParams === "function" ? dependencies.finalReceiptTextFromParams : () => "";
  const readRolloutEnrichmentEntries = typeof dependencies.readRolloutEnrichmentEntries === "function" ? dependencies.readRolloutEnrichmentEntries : () => [];
  const rolloutEntryTurnId = typeof dependencies.rolloutEntryTurnId === "function" ? dependencies.rolloutEntryTurnId : () => "";
  const rolloutTimestampFields = typeof dependencies.rolloutTimestampFields === "function" ? dependencies.rolloutTimestampFields : () => ({});
  const rolloutPathForThread = typeof dependencies.rolloutPathForThread === "function" ? dependencies.rolloutPathForThread : () => "";
  const readRolloutTurnUsageSummaries = typeof dependencies.readRolloutTurnUsageSummaries === "function" ? dependencies.readRolloutTurnUsageSummaries : () => ({ byTurnId: new Map(), unscoped: [] });
  const readRolloutItemTimestampCandidates = typeof dependencies.readRolloutItemTimestampCandidates === "function" ? dependencies.readRolloutItemTimestampCandidates : () => null;
  const rolloutStatsForPath = typeof dependencies.rolloutStatsForPath === "function" ? dependencies.rolloutStatsForPath : () => null;
  const readStateDbThread = typeof dependencies.readStateDbThread === "function" ? dependencies.readStateDbThread : () => null;
  const readStartedThread = typeof dependencies.readStartedThread === "function" ? dependencies.readStartedThread : () => null;
  const clonePlainJson = typeof dependencies.clonePlainJson === "function" ? dependencies.clonePlainJson : (value) => JSON.parse(JSON.stringify(value));
  const cloneThreadForUsageDecoration = typeof dependencies.cloneThreadForUsageDecoration === "function" ? dependencies.cloneThreadForUsageDecoration : clonePlainJson;
  const collectRolloutUserInputAnchors = typeof dependencies.collectRolloutUserInputAnchors === "function" ? dependencies.collectRolloutUserInputAnchors : () => ({ byTurn: new Map(), scopedCount: 0 });
  const appendLatestCompletedUserInputAnchors = typeof dependencies.appendLatestCompletedUserInputAnchors === "function" ? dependencies.appendLatestCompletedUserInputAnchors : () => null;
  const compactThread = typeof dependencies.compactThread === "function" ? dependencies.compactThread : (thread) => thread;
  const sortTurnsChronologically = typeof dependencies.sortTurnsChronologically === "function" ? dependencies.sortTurnsChronologically : (turns) => turns;
  const insertProjectedItemByTimestamp = typeof dependencies.insertProjectedItemByTimestamp === "function" ? dependencies.insertProjectedItemByTimestamp : (items, item) => { if (Array.isArray(items)) items.push(item); };
  const visibleItemId = typeof dependencies.visibleItemId === "function" ? dependencies.visibleItemId : (item) => String(item && (item.id || item.itemId || item.item_id) || "").trim();
  const itemTimestampCandidateId = typeof dependencies.itemTimestampCandidateId === "function" ? dependencies.itemTimestampCandidateId : visibleItemId;
  const itemTimestampMatchText = typeof dependencies.itemTimestampMatchText === "function" ? dependencies.itemTimestampMatchText : () => "";
  const timestampTextsMatch = typeof dependencies.timestampTextsMatch === "function" ? dependencies.timestampTextsMatch : () => false;
  const isAssistantReceiptItem = typeof dependencies.isAssistantReceiptItem === "function" ? dependencies.isAssistantReceiptItem : () => false;
  const isTurnDiagnosticItem = typeof dependencies.isTurnDiagnosticItem === "function" ? dependencies.isTurnDiagnosticItem : () => false;
  const isCompletedStatus = typeof dependencies.isCompletedStatus === "function" ? dependencies.isCompletedStatus : () => false;
  const isLiveTurn = typeof dependencies.isLiveTurn === "function" ? dependencies.isLiveTurn : () => false;
  const isThreadListRestStatus = typeof dependencies.isThreadListRestStatus === "function" ? dependencies.isThreadListRestStatus : () => false;
  const isThreadListLiveStatus = typeof dependencies.isThreadListLiveStatus === "function" ? dependencies.isThreadListLiveStatus : () => false;
  const turnIdentifier = typeof dependencies.turnIdentifier === "function" ? dependencies.turnIdentifier : (turn) => String(turn && (turn.id || turn.turnId || turn.turn_id) || "");
  const turnSortTimestampMs = typeof dependencies.turnSortTimestampMs === "function" ? dependencies.turnSortTimestampMs : () => 0;
  const turnStartedAtMs = typeof dependencies.turnStartedAtMs === "function" ? dependencies.turnStartedAtMs : () => 0;
  const redactInlineImageDataUrls = typeof dependencies.redactInlineImageDataUrls === "function" ? dependencies.redactInlineImageDataUrls : (value) => String(value || "");
  const isContextCompactionType = typeof dependencies.isContextCompactionType === "function" ? dependencies.isContextCompactionType : () => false;
  const isWebSearchLikeItem = typeof dependencies.isWebSearchLikeItem === "function" ? dependencies.isWebSearchLikeItem : () => false;
  const isOperationalItem = typeof dependencies.isOperationalItem === "function" ? dependencies.isOperationalItem : () => false;
  const createThreadCompletionDiagnosticService = typeof dependencies.createThreadCompletionDiagnosticService === "function"
    ? dependencies.createThreadCompletionDiagnosticService
    : () => ({ appendEmptyCompletionDiagnosticsToThread: (thread) => thread });
  const latestFinalReceiptsByPath = new Map();
  const latestUserInputAnchorsByPath = new Map();

  function rememberRolloutFinalReceipts(key, payload) {
    latestFinalReceiptsByPath.set(key, {
      cachedAt: Date.now(),
      payload: payload || null,
    });
    while (latestFinalReceiptsByPath.size > runtimeContextCacheMax) {
      const firstKey = latestFinalReceiptsByPath.keys().next().value;
      latestFinalReceiptsByPath.delete(firstKey);
    }
  }

  function cloneRolloutUserInputAnchorPayload(payload) {
    const byTurn = new Map();
    const sourceByTurn = payload && payload.byTurn instanceof Map ? payload.byTurn : new Map();
    for (const [turnId, items] of sourceByTurn.entries()) {
      byTurn.set(turnId, Array.isArray(items) ? items.map(clonePlainJson) : []);
    }
    return {
      byTurn,
      scopedCount: Number(payload && payload.scopedCount) || 0,
    };
  }

  function rememberRolloutUserInputAnchors(key, payload) {
    latestUserInputAnchorsByPath.set(key, {
      cachedAt: Date.now(),
      payload: cloneRolloutUserInputAnchorPayload(payload),
    });
    while (latestUserInputAnchorsByPath.size > runtimeContextCacheMax) {
      const firstKey = latestUserInputAnchorsByPath.keys().next().value;
      latestUserInputAnchorsByPath.delete(firstKey);
    }
  }

  function isRolloutFinalReceiptRestingStatus(status) {
    const text = statusText(status).toLowerCase();
    if (!text) return false;
    if (/failed|fail|cancel|error|interrupt|running|active|progress|pending/.test(text)) return false;
    return /^(idle|completed|success|succeeded|done|finished|closed)$/.test(text);
  }

  function canAttachRolloutFinalReceipt(status, options = {}) {
    const text = statusText(status).toLowerCase();
    if (!text) return Boolean(options.allowRestingThreadStatus);
    if (/failed|fail|cancel|error|interrupt|running|active|progress|pending/.test(text)) return false;
    if (/completed|success|succeeded|done|finished|closed/.test(text)) return true;
    return Boolean(options.allowRestingThreadStatus && /^(idle|unknown|notloaded|not_loaded|not-loaded)$/.test(text));
  }

  function normalizeFinalReceiptText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function assistantReceiptText(item) {
    if (!isAssistantReceiptItem(item)) return "";
    if (typeof item.text === "string") return item.text;
    if (typeof item.message === "string") return item.message;
    if (typeof item.content === "string") return item.content;
    if (Array.isArray(item.content)) {
      return item.content
        .map((part) => {
          if (!part || typeof part !== "object") return "";
          if (typeof part.text === "string") return part.text;
          if (typeof part.content === "string") return part.content;
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }
    return "";
  }

  function turnHasMatchingAssistantReceipt(turn, receiptItem) {
    const receiptId = visibleItemId(receiptItem);
    const receiptText = normalizeFinalReceiptText(assistantReceiptText(receiptItem));
    return Array.isArray(turn && turn.items) && turn.items.some((item) => {
      if (!isAssistantReceiptItem(item)) return false;
      if (receiptId && visibleItemId(item) === receiptId) return true;
      const text = normalizeFinalReceiptText(assistantReceiptText(item));
      return Boolean(receiptText && text === receiptText);
    });
  }

  function cloneRolloutFinalReceiptPayload(payload) {
    const byTurn = new Map();
    const sourceByTurn = payload && payload.byTurn instanceof Map ? payload.byTurn : new Map();
    for (const [turnId, item] of sourceByTurn.entries()) {
      byTurn.set(turnId, item && typeof item === "object" ? Object.assign({}, item) : item);
    }
    return {
      byTurn,
      scopedCount: Number(payload && payload.scopedCount) || 0,
    };
  }

  function rolloutFinalReceiptItem(entry, turnId, text) {
    const completedAtMs = rolloutCompletionTimestampMs(entry);
    const timestampFields = completedAtMs
      ? { completedAtMs, completedAt: new Date(completedAtMs).toISOString() }
      : rolloutTimestampFields(entry);
    return {
      id: `mobile-final-receipt-${turnId || stableTextHash(text)}`,
      type: "agentMessage",
      text,
      source: "rollout_task_complete",
      mobileSyntheticFinalReceipt: true,
      ...timestampFields,
    };
  }

  function rolloutProgressTextFromValue(value) {
    if (value == null) return "";
    if (typeof value === "string") return redactInlineImageDataUrls(value).trim();
    if (Array.isArray(value)) {
      return value.map((entry) => rolloutProgressTextFromValue(entry)).filter(Boolean).join("\n").trim();
    }
    if (typeof value === "object") {
      if (typeof value.text === "string") return redactInlineImageDataUrls(value.text).trim();
      if (typeof value.message === "string") return redactInlineImageDataUrls(value.message).trim();
      if (typeof value.content === "string") return redactInlineImageDataUrls(value.content).trim();
      if (typeof value.output === "string") return redactInlineImageDataUrls(value.output).trim();
      if (Array.isArray(value.content)) return rolloutProgressTextFromValue(value.content);
      if (Array.isArray(value.summary)) return rolloutProgressTextFromValue(value.summary);
    }
    return "";
  }

  function rolloutProgressTextFromEntry(entry) {
    const payload = entry && entry.payload && typeof entry.payload === "object" ? entry.payload : {};
    if (entry && entry.type === "event_msg" && payload.type === "agent_message") {
      return rolloutProgressTextFromValue(payload.message || payload.text || payload.content || payload.summary);
    }
    if (entry && entry.type === "response_item" && payload.type === "message") {
      const role = String(payload.role || payload.author || "").toLowerCase();
      if (role === "assistant") {
        return rolloutProgressTextFromValue(payload.content || payload.message || payload.text || payload.summary);
      }
    }
    return "";
  }

  function rolloutProgressItem(entry, turnId, text, index) {
    const timestampFields = rolloutTimestampFields(entry);
    return {
      id: `mobile-progress-message-${turnId || "unscoped"}-${index}-${stableTextHash(text)}`,
      type: "agentMessage",
      text,
      source: "rollout_agent_message",
      mobileSyntheticProgressMessage: true,
      ...timestampFields,
    };
  }

  function rolloutActiveAssistantItem(entry, turnId, text, index) {
    return Object.assign({}, rolloutProgressItem(entry, turnId, text, index), {
      source: "rollout_active_assistant",
      mobileSyntheticActiveAssistant: true,
    });
  }

  function rolloutLatestCompletedAssistantItem(entry, turnId, text, index) {
    return Object.assign({}, rolloutProgressItem(entry, turnId, text, index), {
      id: `mobile-completed-replay-message-${turnId || "unscoped"}-${index}-${stableTextHash(text)}`,
      source: "rollout_completed_replay_assistant",
      mobileSyntheticCompletedReplayAssistant: true,
    });
  }

  function appendRolloutProgressMessage(progressByTurn, entry, turnId) {
    if (!turnId || threadDetailCompletedProgressMessages <= 0) return;
    const text = rolloutProgressTextFromEntry(entry);
    if (!text) return;
    const normalized = normalizeFinalReceiptText(text);
    if (!normalized) return;
    let list = progressByTurn.get(turnId);
    if (!list) {
      list = [];
      progressByTurn.set(turnId, list);
    }
    if (list.some((item) => normalizeFinalReceiptText(assistantReceiptText(item)) === normalized)) return;
    list.push(rolloutProgressItem(entry, turnId, text, list.length));
    if (list.length > threadDetailCompletedProgressMessages) {
      list.splice(0, list.length - threadDetailCompletedProgressMessages);
    }
  }

  function rolloutCompletionTimestampMs(entry) {
    const payload = entry && entry.payload && typeof entry.payload === "object" ? entry.payload : {};
    return timestampToMs(payload.completed_at || payload.completedAt || entry.timestamp || payload.timestamp);
  }

  function rolloutCompletionTurnFromEntry(entry, turnId, text, progressItems = []) {
    const payload = entry && entry.payload && typeof entry.payload === "object" ? entry.payload : {};
    const completedAtMs = rolloutCompletionTimestampMs(entry);
    const normalizedFinalText = normalizeFinalReceiptText(text);
    const seenProgress = new Set();
    const retainedProgressItems = (Array.isArray(progressItems) ? progressItems : [])
      .filter((item) => {
        const normalized = normalizeFinalReceiptText(assistantReceiptText(item));
        if (!normalized || normalized === normalizedFinalText || seenProgress.has(normalized)) return false;
        seenProgress.add(normalized);
        return true;
      })
      .slice(-threadDetailCompletedProgressMessages)
      .map(clonePlainJson);
    const durationMs = Number(payload.duration_ms || payload.durationMs || 0);
    const turn = {
      id: turnId,
      status: "completed",
      items: [...retainedProgressItems, rolloutFinalReceiptItem(entry, turnId, text)],
      source: "rollout_task_complete",
      mobileSyntheticCompletionTurn: true,
    };
    if (retainedProgressItems.length) turn.mobileSyntheticProgressMessageCount = retainedProgressItems.length;
    if (completedAtMs) {
      turn.completedAt = Math.floor(completedAtMs / 1000);
      turn.completedAtMs = completedAtMs;
    }
    if (Number.isFinite(durationMs) && durationMs > 0) {
      turn.durationMs = durationMs;
      if (completedAtMs && durationMs <= completedAtMs) {
        turn.startedAt = Math.floor((completedAtMs - durationMs) / 1000);
        turn.startedAtMs = completedAtMs - durationMs;
      }
    }
    return turn;
  }

  function cloneRolloutCompletionTurnPayload(payload) {
    const byTurn = new Map();
    const sourceByTurn = payload && payload.byTurn instanceof Map ? payload.byTurn : new Map();
    for (const [turnId, turn] of sourceByTurn.entries()) {
      byTurn.set(turnId, clonePlainJson(turn));
    }
    return {
      byTurn,
      scopedCount: Number(payload && payload.scopedCount) || 0,
    };
  }

  function cloneRolloutAssistantItemsPayload(payload) {
    const byTurn = new Map();
    const sourceByTurn = payload && payload.byTurn instanceof Map ? payload.byTurn : new Map();
    for (const [turnId, items] of sourceByTurn.entries()) {
      byTurn.set(turnId, Array.isArray(items) ? items.map(clonePlainJson) : []);
    }
    return {
      byTurn,
      scopedCount: Number(payload && payload.scopedCount) || 0,
    };
  }

  function readRolloutCompletionTurns(rolloutPath) {
    if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) {
      return { byTurn: new Map(), scopedCount: 0 };
    }
    let cacheKey = "";
    try {
      const stat = fs.statSync(rolloutPath);
      cacheKey = `${runtimeContextCacheKey(rolloutPath, stat)}:completion-turns`;
      const cached = latestFinalReceiptsByPath.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt <= runtimeContextCacheTtlMs) {
        return cloneRolloutCompletionTurnPayload(cached.payload);
      }
    } catch (_) {
      return { byTurn: new Map(), scopedCount: 0 };
    }
    const byTurn = new Map();
    const progressByTurn = new Map();
    let scopedCount = 0;
    let currentTurnId = "";
    for (const entry of readRolloutEnrichmentEntries(rolloutPath)) {
      if (!entry || !entry.type) continue;
      const payload = entry.payload || {};
      const explicitTurnId = rolloutEntryTurnId(entry);
      if (entry.type === "turn_context" && explicitTurnId) currentTurnId = explicitTurnId;
      if (entry.type === "event_msg" && payload.type === "task_started" && explicitTurnId) currentTurnId = explicitTurnId;
      const turnId = explicitTurnId || currentTurnId;
      appendRolloutProgressMessage(progressByTurn, entry, turnId);
      if (entry.type !== "event_msg" || !/^(task_complete|task_completed)$/.test(String(payload.type || ""))) continue;
      if (!turnId) continue;
      const text = finalReceiptTextFromParams(payload);
      if (!text) continue;
      byTurn.set(turnId, rolloutCompletionTurnFromEntry(entry, turnId, text, progressByTurn.get(turnId) || []));
      scopedCount += 1;
    }
    const payload = { byTurn, scopedCount };
    if (cacheKey) rememberRolloutFinalReceipts(cacheKey, payload);
    return cloneRolloutCompletionTurnPayload(payload);
  }

  function readRolloutActiveAssistantItems(rolloutPath, options = {}) {
    const targetTurnIds = Array.isArray(options.targetTurnIds)
      ? options.targetTurnIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
    const targetSet = new Set(targetTurnIds);
    const mode = String(options.mode || "active").trim() || "active";
    if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath) || !targetSet.size) {
      return { byTurn: new Map(), scopedCount: 0 };
    }
    let cacheKey = "";
    try {
      const stat = fs.statSync(rolloutPath);
      cacheKey = `${runtimeContextCacheKey(rolloutPath, stat)}:${mode}-assistant:${targetTurnIds.sort().join(",")}`;
      const cached = latestFinalReceiptsByPath.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt <= runtimeContextCacheTtlMs) {
        return cloneRolloutAssistantItemsPayload(cached.payload);
      }
    } catch (_) {
      return { byTurn: new Map(), scopedCount: 0 };
    }

    const byTurn = new Map();
    let scopedCount = 0;
    let currentTurnId = "";
    for (const entry of readRolloutEnrichmentEntries(rolloutPath)) {
      if (!entry || !entry.type) continue;
      const payload = entry.payload || {};
      const explicitTurnId = rolloutEntryTurnId(entry);
      if (entry.type === "turn_context" && explicitTurnId) currentTurnId = explicitTurnId;
      if (entry.type === "event_msg" && payload.type === "task_started" && explicitTurnId) currentTurnId = explicitTurnId;
      const turnId = explicitTurnId || currentTurnId;
      if (!turnId || !targetSet.has(turnId)) continue;
      const payloadType = String(payload.type || "").toLowerCase();
      const payloadRole = String(payload.role || payload.author || "").toLowerCase();
      if (entry.type !== "response_item" || payloadType !== "message" || payloadRole !== "assistant") continue;
      const text = rolloutProgressTextFromEntry(entry);
      if (!text) continue;
      let items = byTurn.get(turnId);
      if (!items) {
        items = [];
        byTurn.set(turnId, items);
      }
      items.push(mode === "latest-completed"
        ? rolloutLatestCompletedAssistantItem(entry, turnId, text, items.length)
        : rolloutActiveAssistantItem(entry, turnId, text, items.length));
      scopedCount += 1;
    }
    const payload = { byTurn, scopedCount };
    if (cacheKey) rememberRolloutFinalReceipts(cacheKey, payload);
    return cloneRolloutAssistantItemsPayload(payload);
  }

  function threadUpdatedAtOnlyMs(thread) {
    return timestampToMs(thread && (thread.updatedAt || thread.updated_at || thread.updatedAtMs || thread.updated_at_ms));
  }

  function turnCompletionTimestampMs(turn) {
    return timestampToMs(turn && (
      turn.completedAtMs
      || turn.completedAt
      || turn.completed_at_ms
      || turn.completed_at
      || turn.finishedAt
      || turn.finished_at
    )) || turnSortTimestampMs(turn);
  }

  function latestExistingCompletedTurnTimestampMs(thread) {
    if (!thread || !Array.isArray(thread.turns)) return 0;
    let latest = 0;
    for (const turn of thread.turns) {
      if (!turn || isLiveTurn(turn) || !isCompletedStatus(turn.status)) continue;
      latest = Math.max(latest, turnCompletionTimestampMs(turn));
    }
    return latest;
  }

  function appendMissingRolloutCompletionTurnsToThread(thread) {
    if (!thread || typeof thread !== "object" || !Array.isArray(thread.turns)) return thread;
    const threadIsResting = isThreadListRestStatus(thread.status);
    const threadIsLive = isThreadListLiveStatus(thread.status);
    if (!threadIsResting && !threadIsLive) return thread;
    const rolloutPath = rolloutPathForThread(thread);
    if (!rolloutPath) return thread;
    const payload = readRolloutCompletionTurns(rolloutPath);
    if (!payload || !(payload.byTurn instanceof Map) || !payload.byTurn.size) return thread;
    const existingIds = new Set(thread.turns.map(turnIdentifier).filter(Boolean));
    const updatedAtMs = threadUpdatedAtOnlyMs(thread);
    const latestExistingCompletedMs = latestExistingCompletedTurnTimestampMs(thread);
    const candidates = Array.from(payload.byTurn.values())
      .filter((turn) => turn && turn.id && !existingIds.has(String(turn.id)))
      .filter((turn) => {
        const completedAtMs = timestampToMs(turn.completedAtMs || turn.completedAt);
        if (!completedAtMs) return false;
        if (threadIsLive) {
          return !latestExistingCompletedMs || completedAtMs >= latestExistingCompletedMs - 1000;
        }
        if (!updatedAtMs) return true;
        return completedAtMs >= updatedAtMs - 5000;
      })
      .sort((a, b) => turnSortTimestampMs(a) - turnSortTimestampMs(b));
    if (!candidates.length) return thread;
    thread.turns.push(...candidates.map(clonePlainJson));
    thread.turns = sortTurnsChronologically(thread.turns);
    thread.mobileAppendedRolloutCompletionTurn = candidates[candidates.length - 1].id || true;
    return thread;
  }

  function backfillMissingRolloutCompletionTurnsForDetailResult(result, details = {}) {
    if (!result || typeof result !== "object" || !result.thread || typeof result.thread !== "object") return result;
    const thread = result.thread;
    if (!Array.isArray(thread.turns)) return result;
    const readMode = String(result.readMode || thread.mobileReadMode || details.readMode || details.source || "");
    const threadIsLive = isThreadListLiveStatus(thread.status);
    if (!threadIsLive && readMode !== "projection-active-overlay") return result;
    const candidate = Object.assign({}, thread, {
      turns: thread.turns.map((turn) => clonePlainJson(turn)),
    });
    const beforeTurnCount = candidate.turns.length;
    const beforeMarker = candidate.mobileAppendedRolloutCompletionTurn || "";
    appendMissingRolloutCompletionTurnsToThread(candidate);
    if (candidate.turns.length === beforeTurnCount
      && String(candidate.mobileAppendedRolloutCompletionTurn || "") === String(beforeMarker || "")) {
      return result;
    }
    const compacted = compactThread(candidate, { maxTurns: maxThreadTurns });
    compacted.mobileDetailCompletionBackfilled = true;
    return Object.assign({}, result, { thread: compacted });
  }

  function readRolloutFinalReceiptItems(rolloutPath) {
    if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) {
      return { byTurn: new Map(), scopedCount: 0 };
    }
    let cacheKey = "";
    try {
      const stat = fs.statSync(rolloutPath);
      cacheKey = runtimeContextCacheKey(rolloutPath, stat);
      const cached = latestFinalReceiptsByPath.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt <= runtimeContextCacheTtlMs) {
        return cloneRolloutFinalReceiptPayload(cached.payload);
      }
    } catch (_) {
      return { byTurn: new Map(), scopedCount: 0 };
    }
    const byTurn = new Map();
    let scopedCount = 0;
    let currentTurnId = "";
    for (const entry of readRolloutEnrichmentEntries(rolloutPath)) {
      if (!entry || !entry.type) continue;
      const payload = entry.payload || {};
      const explicitTurnId = rolloutEntryTurnId(entry);
      if (entry.type === "turn_context" && explicitTurnId) currentTurnId = explicitTurnId;
      if (entry.type === "event_msg" && payload.type === "task_started" && explicitTurnId) currentTurnId = explicitTurnId;
      if (entry.type !== "event_msg" || !/^(task_complete|task_completed)$/.test(String(payload.type || ""))) continue;
      const turnId = explicitTurnId || currentTurnId;
      if (!turnId) continue;
      const text = finalReceiptTextFromParams(payload);
      if (!text) continue;
      byTurn.set(turnId, rolloutFinalReceiptItem(entry, turnId, text));
      scopedCount += 1;
    }
    const payload = { byTurn, scopedCount };
    if (cacheKey) rememberRolloutFinalReceipts(cacheKey, payload);
    return cloneRolloutFinalReceiptPayload(payload);
  }

  let threadCompletionDiagnosticService = null;

  function getThreadCompletionDiagnosticService() {
    if (!threadCompletionDiagnosticService) {
      threadCompletionDiagnosticService = createThreadCompletionDiagnosticService({
        fs,
        cacheTtlMs: runtimeContextCacheTtlMs,
        cacheMaxEntries: runtimeContextCacheMax,
        cacheKeyForStat: runtimeContextCacheKey,
        finalReceiptTextFromParams,
        insertProjectedItemByTimestamp,
        isAssistantReceiptItem,
        isDiagnosticReceiptItem: isTurnDiagnosticItem,
        readRolloutEnrichmentEntries,
        rolloutCompletionTimestampMs,
        rolloutEntryTurnId,
        rolloutPathForThread,
        stableTextHash,
        visibleItemId,
      });
    }
    return threadCompletionDiagnosticService;
  }

  function appendRolloutEmptyCompletionDiagnosticsToThread(thread) {
    return getThreadCompletionDiagnosticService().appendEmptyCompletionDiagnosticsToThread(thread);
  }

  function appendRolloutFinalReceiptsToThread(thread) {
    if (!thread || typeof thread !== "object" || !Array.isArray(thread.turns) || !thread.turns.length) return thread;
    const rolloutPath = rolloutPathForThread(thread);
    if (!rolloutPath) return thread;
    const payload = readRolloutFinalReceiptItems(rolloutPath);
    if (!payload || !(payload.byTurn instanceof Map) || !payload.byTurn.size) return thread;
    const allowRestingThreadStatus = isRolloutFinalReceiptRestingStatus(thread.status);
    for (const turn of thread.turns) {
      if (!turn || !canAttachRolloutFinalReceipt(turn.status, { allowRestingThreadStatus })) continue;
      const turnId = String(turn.id || turn.turnId || "").trim();
      const item = turnId ? payload.byTurn.get(turnId) : null;
      if (!item) continue;
      if (turnHasMatchingAssistantReceipt(turn, item)) continue;
      turn.items = Array.isArray(turn.items) ? turn.items : [];
      const existingIds = new Set(turn.items.map(visibleItemId).filter(Boolean));
      const id = visibleItemId(item);
      if (!id || existingIds.has(id)) continue;
      insertProjectedItemByTimestamp(turn.items, Object.assign({}, item));
    }
    return thread;
  }

  function readRolloutUserInputAnchorItems(rolloutPath) {
    if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) {
      return { byTurn: new Map(), scopedCount: 0 };
    }
    let cacheKey = "";
    try {
      const stat = fs.statSync(rolloutPath);
      cacheKey = `${runtimeContextCacheKey(rolloutPath, stat)}:user-input-anchors`;
      const cached = latestUserInputAnchorsByPath.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt <= runtimeContextCacheTtlMs) {
        return cloneRolloutUserInputAnchorPayload(cached.payload);
      }
    } catch (_) {
      return { byTurn: new Map(), scopedCount: 0 };
    }
    const payload = collectRolloutUserInputAnchors(readRolloutEnrichmentEntries(rolloutPath), {
      textLimit: threadDetailProgressiveActiveUserTextChars,
      maxPerTurn: 4,
    });
    if (cacheKey) rememberRolloutUserInputAnchors(cacheKey, payload);
    return cloneRolloutUserInputAnchorPayload(payload);
  }

  function appendRolloutUserInputAnchorsToDetailResult(result) {
    const thread = result && result.thread;
    if (!thread || !Array.isArray(thread.turns) || !thread.turns.length) return result;
    const rolloutPath = rolloutPathForThread(thread);
    if (!rolloutPath) return result;
    const payload = readRolloutUserInputAnchorItems(rolloutPath);
    if (!payload || !(payload.byTurn instanceof Map) || !payload.byTurn.size) return result;
    const out = Object.assign({}, result, {
      thread: cloneThreadForUsageDecoration(thread),
    });
    const backfilled = appendLatestCompletedUserInputAnchors(out.thread, payload);
    if (!backfilled || backfilled.changed !== true) return result;
    out.thread = backfilled.thread;
    return out;
  }

  function appendRolloutActiveAssistantItemsToDetailResult(result) {
    const thread = result && result.thread;
    if (!thread || !Array.isArray(thread.turns) || !thread.turns.length) return result;
    const rolloutPath = rolloutPathForThread(thread);
    if (!rolloutPath) return result;
    const activeTurnIds = thread.turns
      .filter((turn) => turn && isLiveTurn(turn))
      .map(turnIdentifier)
      .filter(Boolean);
    if (!activeTurnIds.length) return result;
    const payload = readRolloutActiveAssistantItems(rolloutPath, { targetTurnIds: activeTurnIds });
    if (!payload || !(payload.byTurn instanceof Map) || !payload.byTurn.size) return result;
    const out = Object.assign({}, result, {
      thread: cloneThreadForUsageDecoration(thread),
    });
    let changed = false;
    for (const turn of out.thread.turns) {
      if (!turn || !isLiveTurn(turn)) continue;
      const turnId = turnIdentifier(turn);
      const rolloutItems = turnId ? payload.byTurn.get(turnId) : null;
      if (!Array.isArray(rolloutItems) || !rolloutItems.length) continue;
      turn.items = Array.isArray(turn.items) ? turn.items : [];
      const existingIds = new Set(turn.items.map(visibleItemId).filter(Boolean));
      const existingTexts = new Set(turn.items
        .filter(isAssistantReceiptItem)
        .map((item) => normalizeFinalReceiptText(assistantReceiptText(item)))
        .filter(Boolean));
      for (const item of rolloutItems) {
        const id = visibleItemId(item);
        const normalized = normalizeFinalReceiptText(assistantReceiptText(item));
        if ((id && existingIds.has(id)) || (normalized && existingTexts.has(normalized))) continue;
        insertProjectedItemByTimestamp(turn.items, clonePlainJson(item));
        if (id) existingIds.add(id);
        if (normalized) existingTexts.add(normalized);
        changed = true;
      }
      if (changed) orderTurnItemsByDisplayTimestamp(turn);
    }
    if (!changed) return result;
    out.thread.mobileActiveRolloutAssistantBackfilled = true;
    return out;
  }

  function latestCompletedAssistantReplayTurn(thread) {
    if (!thread || !Array.isArray(thread.turns)) return null;
    for (let index = thread.turns.length - 1; index >= 0; index -= 1) {
      const turn = thread.turns[index];
      if (!turn || isLiveTurn(turn) || !isCompletedStatus(turn.status)) continue;
      if (!Array.isArray(turn.items) || !turn.items.length) continue;
      return turn;
    }
    return null;
  }

  function appendRolloutLatestCompletedAssistantItemsToDetailResult(result) {
    const thread = result && result.thread;
    if (!thread || !Array.isArray(thread.turns) || !thread.turns.length) return result;
    const rolloutPath = rolloutPathForThread(thread);
    if (!rolloutPath) return result;
    const latest = latestCompletedAssistantReplayTurn(thread);
    const turnId = latest ? turnIdentifier(latest) : "";
    if (!turnId) return result;
    const payload = readRolloutActiveAssistantItems(rolloutPath, {
      targetTurnIds: [turnId],
      mode: "latest-completed",
    });
    const rolloutItems = payload && payload.byTurn instanceof Map ? payload.byTurn.get(turnId) : null;
    if (!Array.isArray(rolloutItems) || !rolloutItems.length) return result;
    const existingAssistantCount = (Array.isArray(latest.items) ? latest.items : [])
      .filter(isAssistantReceiptItem)
      .length;
    if (existingAssistantCount >= rolloutItems.length) return result;
    const out = Object.assign({}, result, {
      thread: cloneThreadForUsageDecoration(thread),
    });
    const outLatest = latestCompletedAssistantReplayTurn(out.thread);
    if (!outLatest) return result;
    outLatest.items = Array.isArray(outLatest.items) ? outLatest.items : [];
    const existingIds = new Set(outLatest.items.map(visibleItemId).filter(Boolean));
    const existingTexts = new Set(outLatest.items
      .filter(isAssistantReceiptItem)
      .map((item) => normalizeFinalReceiptText(assistantReceiptText(item)))
      .filter(Boolean));
    let inserted = 0;
    for (const item of rolloutItems) {
      const id = visibleItemId(item);
      const normalized = normalizeFinalReceiptText(assistantReceiptText(item));
      if ((id && existingIds.has(id)) || (normalized && existingTexts.has(normalized))) continue;
      insertProjectedItemByTimestamp(outLatest.items, clonePlainJson(item));
      if (id) existingIds.add(id);
      if (normalized) existingTexts.add(normalized);
      inserted += 1;
    }
    if (!inserted) return result;
    orderTurnItemsByDisplayTimestamp(outLatest);
    outLatest.mobileCompletedReplayAssistantBackfilled = true;
    outLatest.mobileCompletedReplayAssistantBackfillCount = inserted;
    out.thread.mobileCompletedReplayAssistantBackfilled = {
      turnId,
      count: inserted,
    };
    return out;
  }

  function syntheticActiveAssistantMessage(item) {
    return Boolean(item && isAssistantReceiptItem(item) && (
      item.mobileSyntheticProgressMessage === true
      || item.mobileSyntheticActiveAssistant === true
      || /^rollout_/i.test(String(item.source || ""))
      || /^mobile-progress-message-/.test(String(item.id || ""))
    ));
  }

  function nativeActiveAssistantMessage(item) {
    if (!item || !isAssistantReceiptItem(item)) return false;
    const id = String(item.id || item.itemId || item.messageId || "").trim();
    return /^msg_/i.test(id);
  }

  function legacySyntheticActiveAssistantMessage(item) {
    if (!item || !isAssistantReceiptItem(item)) return false;
    const id = String(item.id || item.itemId || "").trim();
    return /^item-\d+$/i.test(id);
  }

  function dedupeSyntheticActiveAssistantMessagesInThread(thread) {
    if (!thread || typeof thread !== "object" || !Array.isArray(thread.turns)) return { thread, removed: 0 };
    let removed = 0;
    for (const turn of thread.turns) {
      if (!turn || !isLiveTurn(turn) || !Array.isArray(turn.items) || turn.items.length < 2) continue;
      const nativeAssistantTexts = new Set();
      const nativeMessageAssistantTexts = new Set();
      const syntheticAssistantTexts = new Set();
      for (const item of turn.items) {
        if (!isAssistantReceiptItem(item)) continue;
        const normalized = normalizeFinalReceiptText(assistantReceiptText(item));
        if (!normalized) continue;
        if (syntheticActiveAssistantMessage(item)) continue;
        nativeAssistantTexts.add(normalized);
        if (nativeActiveAssistantMessage(item)) nativeMessageAssistantTexts.add(normalized);
      }
      const nextItems = [];
      for (const item of turn.items) {
        if (syntheticActiveAssistantMessage(item)) {
          const normalized = normalizeFinalReceiptText(assistantReceiptText(item));
          if (normalized && nativeAssistantTexts.has(normalized)) {
            removed += 1;
            continue;
          }
          if (normalized && syntheticAssistantTexts.has(normalized)) {
            removed += 1;
            continue;
          }
          if (normalized) syntheticAssistantTexts.add(normalized);
        } else if (legacySyntheticActiveAssistantMessage(item)) {
          const normalized = normalizeFinalReceiptText(assistantReceiptText(item));
          if (normalized && nativeMessageAssistantTexts.has(normalized)) {
            removed += 1;
            continue;
          }
        }
        nextItems.push(item);
      }
      if (nextItems.length !== turn.items.length) {
        const turnRemoved = turn.items.length - nextItems.length;
        turn.items = nextItems;
        turn.mobileSyntheticActiveAssistantDeduped = (turn.mobileSyntheticActiveAssistantDeduped || 0) + turnRemoved;
      }
    }
    if (removed) thread.mobileSyntheticActiveAssistantDeduped = (thread.mobileSyntheticActiveAssistantDeduped || 0) + removed;
    return { thread, removed };
  }

  function finalizeActiveAssistantProjectionDetailResult(result) {
    if (!result || typeof result !== "object" || !result.thread) return result;
    const sourceThread = result.thread;
    if (!Array.isArray(sourceThread.turns) || !sourceThread.turns.some((turn) => turn && isLiveTurn(turn))) return result;
    const thread = clonePlainJson(result.thread);
    enrichThreadItemTimestampsFromRollout(thread);
    const deduped = dedupeSyntheticActiveAssistantMessagesInThread(thread);
    return Object.assign({}, result, { thread: deduped.thread || thread });
  }

  function orderTurnItemsByDisplayTimestamp(turn) {
    if (!turn || !Array.isArray(turn.items) || turn.items.length < 2) return turn;
    turn.items = turn.items
      .map((item, index) => ({ item, index, timestamp: itemDisplayTimestampMs(item) }))
      .sort((left, right) => {
        if (left.timestamp && right.timestamp && left.timestamp !== right.timestamp) {
          return left.timestamp - right.timestamp;
        }
        return left.index - right.index;
      })
      .map((entry) => entry.item);
    return turn;
  }

  function turnCompletionUsageSummary(threadId, turnId) {
    const summary = readStateDbThread(threadId) || readStartedThread(threadId);
    const rolloutPath = rolloutPathForThread(summary);
    if (!rolloutPath) return null;
    const summaries = readRolloutTurnUsageSummaries(rolloutPath);
    const turnSummary = turnId && summaries.byTurnId instanceof Map
      ? summaries.byTurnId.get(String(turnId))
      : null;
    const unscoped = Array.isArray(summaries.unscoped) && summaries.unscoped.length
      ? summaries.unscoped[summaries.unscoped.length - 1]
      : null;
    const usageSummary = turnSummary || unscoped;
    if (!usageSummary) return null;
    const stats = rolloutStatsForPath(rolloutPath);
    return Object.assign({}, usageSummary, {
      rolloutSizeBytes: Number(stats.sizeBytes) || undefined,
      rolloutWarningThresholdBytes: Number(stats.warningThresholdBytes) || undefined,
      rolloutOverWarningThreshold: Boolean(stats.overWarningThreshold),
    });
  }

  function itemDirectTimestampMs(item) {
    for (const key of [
      "createdAtMs",
      "createdAt",
      "created_at_ms",
      "created_at",
      "startedAtMs",
      "startedAt",
      "started_at_ms",
      "started_at",
      "timestampMs",
      "timestamp",
    ]) {
      const timestamp = timestampToMs(item && item[key]);
      if (timestamp) return timestamp;
    }
    return 0;
  }

  function itemDisplayTimestampMs(item) {
    return itemDirectTimestampMs(item)
      || timestampToMs(item && (item.mobileDisplayTimestampMs || item.mobileDisplayTimestamp));
  }

  const DISPLAY_TIMESTAMP_INFERABLE_TYPES = new Set([
    "agentMessage",
    "filePreview",
    "imageGeneration",
    "imageView",
    "plan",
    "turnDiagnostic",
    "userMessage",
  ]);

  function itemCanUseInferredDisplayTimestamp(item) {
    return Boolean(item && DISPLAY_TIMESTAMP_INFERABLE_TYPES.has(String(item.type || "")));
  }

  function turnCompletedDisplayTimestampMs(turn) {
    return timestampToMs(turn && (
      turn.completedAtMs
      || turn.completedAt
      || turn.completed_at_ms
      || turn.completed_at
      || turn.finishedAt
      || turn.finished_at
      || turn.updatedAtMs
      || turn.updatedAt
    ));
  }

  function nearestPreviousItemDisplayTimestampMs(items, index) {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const timestamp = itemDisplayTimestampMs(items[cursor]);
      if (timestamp) return timestamp;
    }
    return 0;
  }

  function nearestNextItemDisplayTimestampMs(items, index) {
    for (let cursor = index + 1; cursor < items.length; cursor += 1) {
      const timestamp = itemDisplayTimestampMs(items[cursor]);
      if (timestamp) return timestamp;
    }
    return 0;
  }

  function inferredDisplayTimestampForItem(items, index, turn) {
    const previous = nearestPreviousItemDisplayTimestampMs(items, index);
    const next = nearestNextItemDisplayTimestampMs(items, index);
    if (previous && next && next >= previous) return Math.min(next, previous + 1);
    if (previous) return previous + 1;
    if (next) return Math.max(1, next - 1);
    if (isCompletedStatus(turn && turn.status)) return turnCompletedDisplayTimestampMs(turn) || turnStartedAtMs(turn);
    return turnStartedAtMs(turn) || 0;
  }

  function inferTurnItemDisplayTimestamps(turn) {
    if (!turn || !Array.isArray(turn.items) || turn.items.length < 1) return turn;
    for (let index = 0; index < turn.items.length; index += 1) {
      const item = turn.items[index];
      if (!item || itemDisplayTimestampMs(item) || !itemCanUseInferredDisplayTimestamp(item)) continue;
      const timestamp = inferredDisplayTimestampForItem(turn.items, index, turn);
      if (!timestamp) continue;
      item.mobileDisplayTimestampMs = timestamp;
      item.mobileDisplayTimestamp = new Date(timestamp).toISOString();
      item.mobileDisplayTimestampInferred = true;
    }
    return turn;
  }

  function timestampCandidateTypesForItem(item) {
    if (!item || typeof item !== "object") return [];
    const type = String(item.type || "");
    if (!type) return [];
    const aliases = [type];
    if (isContextCompactionType(type)) aliases.push("contextCompaction");
    if (isWebSearchLikeItem(item)) aliases.push("dynamicToolCall");
    if (isOperationalItem(item)) {
      if (type === "commandExecution") aliases.push("commandExecution");
      else if (type === "fileChange") aliases.push("fileChange");
      else aliases.push("dynamicToolCall");
    }
    return [...new Set(aliases.filter(Boolean))];
  }

  function takeNextTimestampCandidate(candidates, aliases) {
    if (!Array.isArray(candidates) || !candidates.length || !Array.isArray(aliases) || !aliases.length) return null;
    for (const candidate of candidates) {
      if (!candidate || candidate.used) continue;
      if (!aliases.includes(candidate.itemType)) continue;
      candidate.used = true;
      return candidate;
    }
    return null;
  }

  function takeTimestampCandidateForItem(candidates, item, aliases) {
    if (!Array.isArray(candidates) || !candidates.length || !item || !Array.isArray(aliases) || !aliases.length) return null;
    const itemId = itemTimestampCandidateId(item);
    if (itemId) {
      for (const candidate of candidates) {
        if (!candidate || candidate.used) continue;
        if (!aliases.includes(candidate.itemType)) continue;
        if (candidate.entryId !== itemId) continue;
        candidate.used = true;
        return candidate;
      }
    }
    const itemType = String(item.type || "");
    const itemText = itemTimestampMatchText(item);
    if ((itemType === "agentMessage" || itemType === "userMessage" || itemType === "plan") && itemText) {
      for (const candidate of candidates) {
        if (!candidate || candidate.used) continue;
        if (!aliases.includes(candidate.itemType)) continue;
        if (!timestampTextsMatch(candidate.text, itemText)) continue;
        candidate.used = true;
        return candidate;
      }
      return null;
    }
    return takeNextTimestampCandidate(candidates, aliases);
  }

  function applyRolloutItemTimestamp(item, candidate) {
    if (!item || !candidate || !candidate.timestampMs || itemDirectTimestampMs(item)) return;
    item.startedAtMs = candidate.timestampMs;
    item.startedAt = candidate.timestamp || new Date(candidate.timestampMs).toISOString();
  }

  function enrichTurnItemTimestampsFromCandidates(turn, candidates) {
    if (!turn || !Array.isArray(turn.items) || !Array.isArray(candidates) || !candidates.length) return turn;
    const orderedCandidates = candidates.map((candidate) => Object.assign({}, candidate, { used: false }));
    for (const item of turn.items) {
      if (!item || itemDisplayTimestampMs(item)) continue;
      const candidate = takeTimestampCandidateForItem(orderedCandidates, item, timestampCandidateTypesForItem(item));
      if (candidate) applyRolloutItemTimestamp(item, candidate);
    }
    return turn;
  }

  function enrichThreadItemTimestampsFromRollout(thread) {
    if (!thread || typeof thread !== "object" || !Array.isArray(thread.turns) || !thread.turns.length) return thread;
    const rolloutPath = rolloutPathForThread(thread);
    if (!rolloutPath) return thread;
    const candidates = readRolloutItemTimestampCandidates(rolloutPath);
    if (!candidates) return thread;
    const latestIndex = thread.turns.length - 1;
    thread.turns.forEach((turn, index) => {
      const turnId = String((turn && turn.id) || "");
      let turnCandidates = turnId && candidates.byTurn ? candidates.byTurn.get(turnId) : null;
      if ((!turnCandidates || !turnCandidates.length)
        && index === latestIndex
        && candidates.scopedCount === 0
        && Array.isArray(candidates.unscoped)
        && candidates.unscoped.length) {
        turnCandidates = candidates.unscoped;
      }
      enrichTurnItemTimestampsFromCandidates(turn, turnCandidates || []);
    });
    return thread;
  }

  return {
    appendMissingRolloutCompletionTurnsToThread,
    appendRolloutActiveAssistantItemsToDetailResult,
    appendRolloutLatestCompletedAssistantItemsToDetailResult,
    appendRolloutEmptyCompletionDiagnosticsToThread,
    appendRolloutFinalReceiptsToThread,
    appendRolloutUserInputAnchorsToDetailResult,
    backfillMissingRolloutCompletionTurnsForDetailResult,
    dedupeSyntheticActiveAssistantMessagesInThread,
    enrichThreadItemTimestampsFromRollout,
    finalizeActiveAssistantProjectionDetailResult,
    inferTurnItemDisplayTimestamps,
    itemDisplayTimestampMs,
    orderTurnItemsByDisplayTimestamp,
    turnCompletionUsageSummary,
  };
}

module.exports = {
  createThreadDetailRolloutBackfillService,
};
