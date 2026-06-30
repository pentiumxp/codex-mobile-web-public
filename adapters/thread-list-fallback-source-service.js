"use strict";

const fs = require("node:fs");
const path = require("node:path");

function createThreadListFallbackSourceService(dependencies = {}) {
  const CODEX_HOME = String(dependencies.codexHome || "");
  const SESSIONS_DIR = String(dependencies.sessionsDir || "");
  const ROLLOUT_ACTIVE_STATUS_WINDOW_MS = Math.max(60_000, Number(dependencies.rolloutActiveStatusWindowMs || String(30 * 60 * 1000)));
  const STALE_CONTEXT_ONLY_ACTIVE_TURN_MS = Math.max(30_000, Number(dependencies.staleContextOnlyActiveTurnMs || "90000"));
  const incrementBoundedDiagnosticCounter = typeof dependencies.incrementBoundedDiagnosticCounter === "function" ? dependencies.incrementBoundedDiagnosticCounter : () => {};
  const parseJsonLine = typeof dependencies.parseJsonLine === "function" ? dependencies.parseJsonLine : () => null;
  const readRolloutTail = typeof dependencies.readRolloutTail === "function" ? dependencies.readRolloutTail : () => "";
  const rolloutEntryTurnId = typeof dependencies.rolloutEntryTurnId === "function" ? dependencies.rolloutEntryTurnId : () => "";
  const timestampToMs = typeof dependencies.timestampToMs === "function" ? dependencies.timestampToMs : () => 0;
  const statusText = typeof dependencies.statusText === "function" ? dependencies.statusText : (status) => String(status && status.type || status || "");
  const statusTurnId = typeof dependencies.statusTurnId === "function" ? dependencies.statusTurnId : () => "";
  const isThreadListLiveStatus = typeof dependencies.isThreadListLiveStatus === "function" ? dependencies.isThreadListLiveStatus : () => false;
  const isLiveTurn = typeof dependencies.isLiveTurn === "function" ? dependencies.isLiveTurn : () => false;
  const rolloutPathForThread = typeof dependencies.rolloutPathForThread === "function" ? dependencies.rolloutPathForThread : () => "";
  const readStateDbThread = typeof dependencies.readStateDbThread === "function" ? dependencies.readStateDbThread : () => null;
  const rowToFallbackThread = typeof dependencies.rowToFallbackThread === "function" ? dependencies.rowToFallbackThread : (row) => row;
  const filterFallbackThreads = typeof dependencies.filterFallbackThreads === "function" ? dependencies.filterFallbackThreads : (threads) => threads || [];
  const archivedSessionThreadIds = typeof dependencies.archivedSessionThreadIds === "function" ? dependencies.archivedSessionThreadIds : () => new Set();
  const collectRecentRolloutFiles = typeof dependencies.collectRecentRolloutFiles === "function" ? dependencies.collectRecentRolloutFiles : () => [];
  const threadIdFromRolloutPath = typeof dependencies.threadIdFromRolloutPath === "function" ? dependencies.threadIdFromRolloutPath : () => "";
  const isBackupRolloutPath = typeof dependencies.isBackupRolloutPath === "function" ? dependencies.isBackupRolloutPath : () => false;
  const readGlobalState = typeof dependencies.readGlobalState === "function" ? dependencies.readGlobalState : () => ({});
  const visibleProjectlessThreadIds = typeof dependencies.visibleProjectlessThreadIds === "function" ? dependencies.visibleProjectlessThreadIds : () => new Set();
  const upsertThreadListFallbackCacheThread = typeof dependencies.upsertThreadListFallbackCacheThread === "function" ? dependencies.upsertThreadListFallbackCacheThread : () => false;
  const applySessionIndexTitleToThread = typeof dependencies.applySessionIndexTitleToThread === "function"
    ? dependencies.applySessionIndexTitleToThread
    : (thread) => thread;

  function fallbackDisplayText(value, maxLength = 500) {
    const text = String(value || "").trim();
    if (!text) return "";
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  }
  
  function readSessionIndexEntries(maxLines = 2000, options = {}) {
    const p = path.join(CODEX_HOME, "session_index.jsonl");
    const byId = new Map();
    const diagnostics = options.diagnostics && typeof options.diagnostics === "object" ? options.diagnostics : null;
    try {
      incrementBoundedDiagnosticCounter(diagnostics, "sessionIndexReadCount");
      const lines = fs.readFileSync(p, "utf8").split(/\r?\n/).filter(Boolean).slice(-Math.max(1, maxLines));
      incrementBoundedDiagnosticCounter(diagnostics, "sessionIndexLineCount", lines.length);
      for (const line of lines) {
        let entry;
        try {
          entry = JSON.parse(line);
        } catch (_) {
          continue;
        }
        const id = String(entry && entry.id || "").trim();
        if (!id) continue;
        byId.set(id, Object.assign({}, entry, {
          id,
          thread_name: fallbackDisplayText(entry.thread_name || entry.name || entry.title),
        }));
      }
      incrementBoundedDiagnosticCounter(diagnostics, "sessionIndexEntryCount", byId.size);
    } catch (_) {
      return byId;
    }
    return byId;
  }
  
  function readSessionIndexEntriesForFallback(maxLines = 2000, options = {}) {
    const requestedLines = Math.max(1, Math.trunc(Number(maxLines) || 2000));
    const diagnostics = options.diagnostics && typeof options.diagnostics === "object" ? options.diagnostics : null;
    const sourceContext = options.sourceContext && typeof options.sourceContext === "object"
      ? options.sourceContext
      : null;
    if (!sourceContext) return readSessionIndexEntries(requestedLines, { diagnostics });
    const cachedEntries = sourceContext.sessionIndexEntries;
    const cachedMaxLines = Number(sourceContext.sessionIndexMaxLines || 0);
    if (cachedEntries && typeof cachedEntries.get === "function" && cachedMaxLines >= requestedLines) {
      incrementBoundedDiagnosticCounter(diagnostics, "sessionIndexReuseCount");
      incrementBoundedDiagnosticCounter(diagnostics, "sessionIndexEntryCount", cachedEntries.size || 0);
      return cachedEntries;
    }
    const entries = readSessionIndexEntries(requestedLines, { diagnostics });
    sourceContext.sessionIndexEntries = entries;
    sourceContext.sessionIndexMaxLines = requestedLines;
    return entries;
  }
  
  function hydrateThreadTitleFromSessionIndex(thread, indexEntries = readSessionIndexEntries()) {
    if (!thread || typeof thread !== "object") return thread || null;
    const id = String(thread.id || thread.threadId || "").trim();
    if (!id || !indexEntries || typeof indexEntries.get !== "function") return thread;
    return applySessionIndexTitleToThread(thread, indexEntries.get(id));
  }
  
  function persistThreadTitleToSessionIndex(threadId, threadName, updatedAt = new Date()) {
    const id = String(threadId || "").trim();
    const name = fallbackDisplayText(threadName, 120);
    if (!id || !name) return false;
    const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt || Date.now());
    const timestamp = Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
    const p = path.join(CODEX_HOME, "session_index.jsonl");
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.appendFileSync(p, `${JSON.stringify({ id, thread_name: name, updated_at: timestamp })}\n`, "utf8");
      upsertThreadListFallbackCacheThread({
        id,
        name,
        preview: name,
        updatedAt: Math.floor(date.getTime() / 1000),
      }, { addIfMissing: false });
      return true;
    } catch (_) {
      return false;
    }
  }
  
  function readRolloutHead(rolloutPath, maxBytes = 128 * 1024, options = {}) {
    if (maxBytes && typeof maxBytes === "object") {
      options = maxBytes;
      maxBytes = 128 * 1024;
    }
    if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) return "";
    let fd = null;
    const diagnostics = options.diagnostics && typeof options.diagnostics === "object" ? options.diagnostics : null;
    try {
      const stat = fs.statSync(rolloutPath);
      if (!stat.isFile() || stat.size <= 0) return "";
      const limit = Number.isFinite(Number(maxBytes)) ? Number(maxBytes) : 128 * 1024;
      const bytesToRead = Math.min(Math.max(4096, limit), stat.size);
      const buffer = Buffer.alloc(bytesToRead);
      fd = fs.openSync(rolloutPath, "r");
      const bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, 0);
      incrementBoundedDiagnosticCounter(diagnostics, "rolloutHeadReadCount");
      incrementBoundedDiagnosticCounter(diagnostics, "rolloutHeadBytes", bytesRead);
      return buffer.subarray(0, bytesRead).toString("utf8");
    } catch (_) {
      return "";
    } finally {
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch (_) {}
      }
    }
  }
  
  const ROLLOUT_TERMINAL_EVENT_TYPES = new Set([
    "task_complete",
    "task_completed",
    "task_failed",
    "task_interrupted",
    "task_cancelled",
    "task_canceled",
    "turn_completed",
    "turn_failed",
    "turn_interrupted",
    "turn_cancelled",
    "turn_canceled",
  ]);
  
  const ROLLOUT_ACTIVITY_EVENT_TYPES = new Set([
    "task_started",
    "user_message",
    "agent_message",
    "agent_reasoning",
    "exec_command_begin",
    "exec_command_end",
    "patch_apply_begin",
    "patch_apply_end",
    "web_search_begin",
    "web_search_end",
  ]);
  
  function rolloutEntryPayloadType(entry) {
    const payload = entry && entry.payload && typeof entry.payload === "object" ? entry.payload : {};
    return String(payload.type || "");
  }
  
  function isRolloutTerminalEntry(entry) {
    return entry && entry.type === "event_msg" && ROLLOUT_TERMINAL_EVENT_TYPES.has(rolloutEntryPayloadType(entry));
  }
  
  function isRolloutActivityEntry(entry) {
    if (!entry || !entry.type) return false;
    if (entry.type === "response_item") return true;
    if (entry.type === "turn_context") return true;
    return entry.type === "event_msg" && ROLLOUT_ACTIVITY_EVENT_TYPES.has(rolloutEntryPayloadType(entry));
  }
  
  function rolloutContentText(value) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(rolloutContentText).filter(Boolean).join("\n");
    if (typeof value !== "object") return "";
    const parts = [];
    for (const key of ["text", "input_text", "message", "summary"]) {
      if (typeof value[key] === "string") parts.push(value[key]);
    }
    if (typeof value.content === "string") {
      parts.push(value.content);
    } else if (value.content && typeof value.content === "object") {
      parts.push(rolloutContentText(value.content));
    }
    return parts.filter(Boolean).join("\n");
  }
  
  function rolloutMessageText(payload) {
    if (!payload || typeof payload !== "object") return "";
    return rolloutContentText(payload.content || payload.message || payload.text || payload.input || payload.input_text);
  }
  
  function rolloutContentHasNonTextInput(value) {
    if (value == null) return false;
    if (Array.isArray(value)) return value.some(rolloutContentHasNonTextInput);
    if (typeof value !== "object") return false;
    const type = String(value.type || "").toLowerCase();
    if (/^(input_)?(image|file|audio|video)|localimage|localfile|image_url|input_image$/.test(type)) return true;
    if (value.image_url || value.imageUrl || value.file_id || value.fileId || value.path || value.url) return true;
    return rolloutContentHasNonTextInput(value.content || value.message || value.input || null);
  }
  
  function rolloutMessageHasNonTextInput(payload) {
    if (!payload || typeof payload !== "object") return false;
    return rolloutContentHasNonTextInput(payload.content || payload.message || payload.input || payload.attachments || payload.files || payload.images);
  }
  
  function isEnvironmentContextOnlyText(value) {
    const text = String(value || "").trim();
    if (!text) return false;
    if (!/^<environment_context\b[\s\S]*<\/environment_context>$/.test(text)) return false;
    return text.replace(/<environment_context\b[\s\S]*<\/environment_context>/g, "").trim() === "";
  }
  
  function createRolloutTurnEvidence(turnId, timestampMs = 0) {
    return {
      turnId: String(turnId || ""),
      startedAtMs: timestampMs || 0,
      lastActivityMs: timestampMs || 0,
      hasContext: false,
      hasVisibleUser: false,
      hasAssistant: false,
      hasOperation: false,
      hasTerminal: false,
    };
  }
  
  function rolloutLatestTurnEvidence(rolloutPath, stat = null, options = {}) {
    const tail = typeof options.tail === "string" ? options.tail : readRolloutTail(rolloutPath);
    if (!tail) return null;
    const byTurn = new Map();
    let currentTurnId = "";
    let latest = null;
    const ensureTurn = (turnId, timestampMs = 0) => {
      const id = String(turnId || "").trim();
      if (!id) return null;
      if (!byTurn.has(id)) byTurn.set(id, createRolloutTurnEvidence(id, timestampMs));
      const evidence = byTurn.get(id);
      if (timestampMs) {
        evidence.lastActivityMs = Math.max(evidence.lastActivityMs || 0, timestampMs);
        if (!evidence.startedAtMs) evidence.startedAtMs = timestampMs;
      }
      if (!latest
        || (evidence.startedAtMs || 0) > (latest.startedAtMs || 0)
        || (evidence.lastActivityMs || 0) > (latest.lastActivityMs || 0)) {
        latest = evidence;
      }
      return evidence;
    };
  
    for (const line of tail.split(/\r?\n/)) {
      if (!line || !line.trim()) continue;
      const entry = parseJsonLine(line);
      if (!entry || !entry.type) continue;
      const payload = entry.payload && typeof entry.payload === "object" ? entry.payload : {};
      const timestampMs = rolloutEntryTimestampMs(entry);
      const eventType = entry.type === "event_msg" ? String(payload.type || "") : "";
      const explicitTurnId = rolloutEntryTurnId(entry);
      if (entry.type === "event_msg" && eventType === "task_started" && explicitTurnId) {
        currentTurnId = explicitTurnId;
        ensureTurn(explicitTurnId, timestampMs);
        continue;
      }
      const turnId = explicitTurnId || currentTurnId;
      const evidence = ensureTurn(turnId, timestampMs);
      if (!evidence) continue;
      if (isRolloutTerminalEntry(entry)) {
        evidence.hasTerminal = true;
        continue;
      }
      if (entry.type === "turn_context") {
        evidence.hasContext = true;
        continue;
      }
      if (entry.type === "response_item") {
        const type = String(payload.type || "");
        if (type === "message") {
          const role = String(payload.role || payload.author || "").toLowerCase();
          if (role === "user") {
            const text = rolloutMessageText(payload);
            if (isEnvironmentContextOnlyText(text)) evidence.hasContext = true;
            else if (String(text || "").trim()) evidence.hasVisibleUser = true;
            else if (rolloutMessageHasNonTextInput(payload)) evidence.hasVisibleUser = true;
          } else if (role === "assistant") {
            evidence.hasAssistant = true;
          } else {
            evidence.hasOperation = true;
          }
        } else if (type === "reasoning") {
          evidence.hasAssistant = true;
        } else if (/^(function_call|custom_tool_call|web_search_call|function_call_output|custom_tool_call_output)$/.test(type)) {
          evidence.hasOperation = true;
        }
        continue;
      }
      if (entry.type === "event_msg") {
        if (eventType === "user_message") {
          const text = rolloutMessageText(payload);
          if (isEnvironmentContextOnlyText(text)) evidence.hasContext = true;
          else if (String(text || "").trim()) evidence.hasVisibleUser = true;
          else if (rolloutMessageHasNonTextInput(payload)) evidence.hasVisibleUser = true;
        } else if (eventType === "agent_message" || eventType === "agent_reasoning") {
          evidence.hasAssistant = true;
        } else if (/^(exec_command|patch_apply|web_search)_/.test(eventType)) {
          evidence.hasOperation = true;
        }
      }
    }
  
    if (!latest) return null;
    const mtimeMs = Number(stat && stat.mtimeMs || 0);
    latest.lastActivityMs = Math.max(latest.lastActivityMs || 0, mtimeMs || 0);
    return latest;
  }
  
  function staleContextOnlyActiveEvidenceForRollout(rolloutPath, options = {}) {
    if (!rolloutPath) return null;
    let stat = options.stat || null;
    if (!stat) {
      try {
        stat = fs.statSync(rolloutPath);
      } catch (_) {
        return null;
      }
    }
    const evidence = rolloutLatestTurnEvidence(rolloutPath, stat, {
      tail: typeof options.tail === "string" ? options.tail : undefined,
    });
    if (!evidence || evidence.hasTerminal || evidence.hasVisibleUser || evidence.hasAssistant || evidence.hasOperation) {
      return null;
    }
    const nowMs = Number(options.nowMs || Date.now());
    const quietMs = nowMs - Number(evidence.lastActivityMs || 0);
    if (!Number.isFinite(quietMs) || quietMs < STALE_CONTEXT_ONLY_ACTIVE_TURN_MS) return null;
    return Object.assign({}, evidence, {
      quietMs,
      thresholdMs: STALE_CONTEXT_ONLY_ACTIVE_TURN_MS,
    });
  }
  
  function staleContextOnlyActiveStatus(previousStatus, evidence) {
    const previousType = statusText(previousStatus);
    return {
      type: "idle",
      mobileStaleActiveTurn: true,
      previousType: previousType || "active",
      reason: "context-only-active-turn",
      turnId: evidence && evidence.turnId || "",
      quietMs: Math.max(0, Math.trunc(Number(evidence && evidence.quietMs) || 0)),
      thresholdMs: STALE_CONTEXT_ONLY_ACTIVE_TURN_MS,
    };
  }
  
  function normalizeStaleContextOnlyActiveThread(thread, options = {}) {
    if (!thread || typeof thread !== "object") return thread;
    const turns = Array.isArray(thread.turns) ? thread.turns : [];
    const latest = turns.length ? turns[turns.length - 1] : null;
    if (!isThreadListLiveStatus(thread.status) && !isLiveTurn(latest)) return thread;
    let rolloutPath = rolloutPathForThread(thread);
    if (!rolloutPath && thread.id) {
      const stateThread = readStateDbThread(thread.id);
      rolloutPath = rolloutPathForThread(stateThread);
    }
    const evidence = staleContextOnlyActiveEvidenceForRollout(rolloutPath, options);
    if (!evidence) return thread;
    const latestTurnId = String(latest && (latest.id || latest.turnId) || "").trim();
    if (latestTurnId && evidence.turnId && latestTurnId !== evidence.turnId) return thread;
    const out = Object.assign({}, thread, {
      status: staleContextOnlyActiveStatus(thread.status, evidence),
      mobileStaleActiveTurn: {
        turnId: evidence.turnId || "",
        reason: "context-only-active-turn",
        quietMs: Math.max(0, Math.trunc(Number(evidence.quietMs) || 0)),
        thresholdMs: STALE_CONTEXT_ONLY_ACTIVE_TURN_MS,
      },
    });
    if (turns.length && latest && isLiveTurn(latest)) {
      const itemCount = Array.isArray(latest.items) ? latest.items.length : 0;
      if (itemCount === 0) {
        out.turns = turns.slice(0, -1);
        out.mobileDroppedStaleActiveTurn = evidence.turnId || latestTurnId || true;
      }
    }
    return out;
  }
  
  function inferRolloutFallbackStatus(rolloutPath, stat = null, nowMs = Date.now(), options = {}) {
    if (!rolloutPath) return null;
    const mtimeMs = Number(stat && stat.mtimeMs || 0);
    const tail = readRolloutTail(rolloutPath, undefined, {
      diagnostics: options.diagnostics,
      counterPrefix: "rolloutStatusTail",
    });
    if (!tail) return null;
    const staleContextOnlyActive = staleContextOnlyActiveEvidenceForRollout(rolloutPath, { stat, nowMs, tail });
    if (staleContextOnlyActive) return staleContextOnlyActiveStatus({ type: "active" }, staleContextOnlyActive);
    let lastActivityMs = 0;
    let lastTerminalMs = 0;
    let currentTurnId = "";
    let lastActivityTurnId = "";
    for (const line of tail.split(/\r?\n/)) {
      if (!line || !line.trim()) continue;
      const entry = parseJsonLine(line);
      if (!entry || !entry.type) continue;
      const payload = entry.payload && typeof entry.payload === "object" ? entry.payload : {};
      const timestampMs = timestampToMs(entry.timestamp || payload.timestamp);
      if (!timestampMs) continue;
      const eventType = entry.type === "event_msg" ? String(payload.type || "") : "";
      const explicitTurnId = rolloutEntryTurnId(entry);
      if (entry.type === "event_msg" && eventType === "task_started" && explicitTurnId) {
        currentTurnId = explicitTurnId;
      }
      if (isRolloutTerminalEntry(entry)) {
        lastTerminalMs = Math.max(lastTerminalMs, timestampMs);
        continue;
      }
      if (isRolloutActivityEntry(entry)) {
        if (timestampMs >= lastActivityMs) {
          lastActivityTurnId = explicitTurnId || currentTurnId || lastActivityTurnId;
        }
        lastActivityMs = Math.max(lastActivityMs, timestampMs);
      }
    }
    if (lastTerminalMs && lastTerminalMs >= lastActivityMs) return { type: "completed" };
    const recentActivityMs = lastActivityMs > lastTerminalMs ? Math.max(lastActivityMs, mtimeMs) : 0;
    if (recentActivityMs && nowMs - recentActivityMs <= ROLLOUT_ACTIVE_STATUS_WINDOW_MS) {
      return { type: "active", turnId: lastActivityTurnId || "" };
    }
    return null;
  }
  
  function rolloutEntryCwd(entry) {
    if (!entry || typeof entry !== "object") return "";
    const payload = entry.payload && typeof entry.payload === "object" ? entry.payload : {};
    return String(entry.cwd || payload.cwd || payload.workspace || payload.workspaceRoot || "").trim();
  }
  
  function rolloutEntryTimestampMs(entry) {
    if (!entry || typeof entry !== "object") return 0;
    const payload = entry.payload && typeof entry.payload === "object" ? entry.payload : {};
    return timestampToMs(entry.timestamp || payload.timestamp || payload.created_at || payload.updated_at);
  }
  
  const ROLLOUT_STAT_METADATA = Symbol("codexMobileRolloutStat");
  
  function isUsableRolloutStat(stat) {
    return Boolean(stat && typeof stat === "object"
      && Number.isFinite(Number(stat.size))
      && Number.isFinite(Number(stat.mtimeMs)));
  }
  
  function attachRolloutStatMetadata(thread, stat) {
    if (!thread || typeof thread !== "object" || !isUsableRolloutStat(stat)) return thread;
    try {
      Object.defineProperty(thread, ROLLOUT_STAT_METADATA, {
        value: stat,
        enumerable: false,
        configurable: true,
      });
    } catch (_) {
      // Keep the public thread row unchanged if metadata cannot be attached.
    }
    return thread;
  }
  
  function rolloutStatMetadataForThread(thread) {
    if (!thread || typeof thread !== "object") return null;
    const stat = thread[ROLLOUT_STAT_METADATA];
    return isUsableRolloutStat(stat) ? stat : null;
  }
  
  function readRolloutSessionFallbackThreadFromFile(file, indexEntry = {}, options = {}) {
    const rolloutPath = typeof file === "string" ? file : file && file.path;
    const id = threadIdFromRolloutPath(rolloutPath) || String(indexEntry.id || "").trim();
    if (!id || !rolloutPath || isBackupRolloutPath(rolloutPath)) return null;
    let stat = null;
    try {
      stat = fs.statSync(rolloutPath);
    } catch (_) {
      return null;
    }
    if (!stat.isFile()) return null;
  
    let cwd = "";
    let timestampMs = 0;
    let model = "";
    let agentNickname = "";
    let agentRole = "";
    const diagnostics = options.diagnostics && typeof options.diagnostics === "object" ? options.diagnostics : null;
    const lines = readRolloutHead(rolloutPath, undefined, { diagnostics }).split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch (_) {
        continue;
      }
      const payload = entry.payload && typeof entry.payload === "object" ? entry.payload : {};
      if (!cwd) cwd = rolloutEntryCwd(entry);
      timestampMs = Math.max(timestampMs, rolloutEntryTimestampMs(entry));
      if (!model && payload.model) model = String(payload.model || "");
      if (!model && payload.model_provider) model = String(payload.model_provider || "");
      if (!agentNickname && (payload.agent_nickname || payload.agentNickname)) {
        agentNickname = String(payload.agent_nickname || payload.agentNickname || "");
      }
      if (!agentRole && (payload.agent_role || payload.agentRole)) {
        agentRole = String(payload.agent_role || payload.agentRole || "");
      }
      if (cwd && timestampMs && (agentNickname || agentRole || entry.type !== "session_meta")) break;
    }
  
    const updatedMs = Math.max(
      timestampToMs(indexEntry.updated_at || indexEntry.updatedAt),
      timestampMs,
      Number(stat.mtimeMs || 0),
    );
    if (diagnostics) incrementBoundedDiagnosticCounter(diagnostics, "rolloutSummaryReadCount");
    return attachRolloutStatMetadata(rowToFallbackThread({
      id,
      thread_name: fallbackDisplayText(indexEntry.thread_name || indexEntry.name || indexEntry.title),
      cwd,
      rollout_path: rolloutPath,
      archived: false,
      archived_at: null,
      updatedAt: Math.floor(updatedMs / 1000),
      model,
      agent_nickname: agentNickname,
      agent_role: agentRole,
      status: options.includeStatus === false ? undefined : inferRolloutFallbackStatus(rolloutPath, stat, Date.now(), { diagnostics }) || undefined,
    }), stat);
  }
  
  function attachRolloutFallbackStatus(thread, options = {}) {
    if (!thread || typeof thread !== "object") return thread;
    const rolloutPath = rolloutPathForThread(thread);
    if (!rolloutPath) return thread;
    const diagnostics = options.diagnostics && typeof options.diagnostics === "object" ? options.diagnostics : null;
    let stat = isUsableRolloutStat(options.stat) ? options.stat : rolloutStatMetadataForThread(thread);
    if (stat) incrementBoundedDiagnosticCounter(diagnostics, "rolloutStatusStatReuseCount");
    if (!stat) {
      incrementBoundedDiagnosticCounter(diagnostics, "rolloutStatusStatReadCount");
      try {
        stat = fs.statSync(rolloutPath);
      } catch (_) {
        return thread;
      }
    }
    incrementBoundedDiagnosticCounter(diagnostics, "rolloutStatusAttachCount");
    const status = inferRolloutFallbackStatus(rolloutPath, stat, options.nowMs || Date.now(), { diagnostics });
    if (!status) return thread;
    const activeTurnId = statusTurnId(status);
    const out = Object.assign({}, thread, { status });
    if (isThreadListLiveStatus(status) && stat && Number(stat.mtimeMs || 0) > timestampToMs(out.updatedAt || out.updated_at || out.updatedAtMs || out.updated_at_ms)) {
      out.updatedAt = Math.floor(Number(stat.mtimeMs || 0) / 1000);
    }
    if (activeTurnId && isThreadListLiveStatus(status)) out.activeTurnId = activeTurnId;
    return out;
  }
  
  function readRolloutSessionFallback(limit = 80, filters = {}) {
    const diagnostics = filters.diagnostics && typeof filters.diagnostics === "object" ? filters.diagnostics : null;
    const rowLimit = Math.min(1000, Math.max(limit * 8, 200));
    const indexEntries = readSessionIndexEntriesForFallback(Math.max(rowLimit * 2, 2000), {
      diagnostics,
      sourceContext: filters.sourceContext,
    });
    const archivedIds = filters.archivedIds && typeof filters.archivedIds.has === "function"
      ? filters.archivedIds
      : archivedSessionThreadIds();
    const threads = [];
    const seen = new Set();
    for (const file of collectRecentRolloutFiles(SESSIONS_DIR, { maxFiles: rowLimit, maxDepth: 6, diagnostics })) {
      incrementBoundedDiagnosticCounter(diagnostics, "rolloutCandidateFileCount");
      const id = threadIdFromRolloutPath(file && file.path);
      if (!id || seen.has(id) || archivedIds.has(id)) continue;
      seen.add(id);
      incrementBoundedDiagnosticCounter(diagnostics, "rolloutCandidateScannedCount");
      const thread = readRolloutSessionFallbackThreadFromFile(file, indexEntries.get(id) || { id }, {
        includeStatus: false,
        diagnostics,
      });
      if (thread) threads.push(thread);
    }
    return filterFallbackThreads(threads, Object.assign({}, filters, { archivedIds }))
      .slice(0, limit)
      .map((thread) => attachRolloutFallbackStatus(thread, { diagnostics }));
  }
  
  function readRolloutSessionFallbackThread(threadId) {
    const id = String(threadId || "").trim();
    if (!id) return null;
    const indexEntries = readSessionIndexEntries();
    const archivedIds = archivedSessionThreadIds();
    if (archivedIds.has(id)) return null;
    for (const file of collectRecentRolloutFiles(SESSIONS_DIR, { maxFiles: 1000, maxDepth: 6 })) {
      if (threadIdFromRolloutPath(file && file.path) !== id) continue;
      return readRolloutSessionFallbackThreadFromFile(file, indexEntries.get(id) || { id });
    }
    return null;
  }
  
  function readSessionIndexFallback(limit = 80, filters = {}) {
    try {
      const diagnostics = filters.diagnostics && typeof filters.diagnostics === "object" ? filters.diagnostics : null;
      const globalState = filters.globalState || readGlobalState();
      const projectlessThreadIds = visibleProjectlessThreadIds(globalState);
      if (filters.cwd || projectlessThreadIds.size === 0) return [];
      const archivedIds = filters.archivedIds && typeof filters.archivedIds.has === "function"
        ? filters.archivedIds
        : archivedSessionThreadIds();
      const byId = new Map();
      for (const entry of readSessionIndexEntriesForFallback(1000, {
        diagnostics,
        sourceContext: filters.sourceContext,
      }).values()) {
        if (!entry.id || !projectlessThreadIds.has(entry.id)) continue;
        if (archivedIds.has(entry.id)) continue;
        const updatedAt = entry.updated_at ? Math.floor(Date.parse(entry.updated_at) / 1000) : 0;
        byId.set(entry.id, rowToFallbackThread({
          id: entry.id,
          thread_name: entry.thread_name || null,
          updatedAt,
        }));
      }
      return [...byId.values()]
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .filter((thread) => {
          const search = String(filters.searchTerm || "").trim().toLowerCase();
          if (!search) return true;
          return [thread.name, thread.preview, thread.id]
            .some((value) => String(value || "").toLowerCase().includes(search));
        })
        .slice(0, limit);
    } catch (_) {
      return [];
    }
  }

  return {
    attachRolloutFallbackStatus,
    fallbackDisplayText,
    hydrateThreadTitleFromSessionIndex,
    inferRolloutFallbackStatus,
    isRolloutTerminalEntry,
    normalizeStaleContextOnlyActiveThread,
    persistThreadTitleToSessionIndex,
    readRolloutHead,
    readRolloutSessionFallback,
    readRolloutSessionFallbackThread,
    readRolloutSessionFallbackThreadFromFile,
    readSessionIndexEntries,
    readSessionIndexEntriesForFallback,
    readSessionIndexFallback,
    rolloutLatestTurnEvidence,
    staleContextOnlyActiveEvidenceForRollout,
    staleContextOnlyActiveStatus,
  };
}

module.exports = {
  createThreadListFallbackSourceService,
};
