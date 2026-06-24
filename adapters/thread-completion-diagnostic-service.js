"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");

const FINAL_MESSAGE_KEYS = [
  "lastAgentMessage",
  "last_agent_message",
  "finalAgentMessage",
  "final_agent_message",
];

function stringValue(value) {
  return String(value || "").trim();
}

function defaultStableTextHash(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex")
    .slice(0, 16);
}

function timestampMs(value) {
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) return number;
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function statusText(status) {
  if (!status) return "";
  if (typeof status === "string") return status;
  if (typeof status !== "object") return String(status || "");
  return String(status.type || status.status || status.state || "");
}

function completionPayloadHasFinalMessageField(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (FINAL_MESSAGE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(payload, key))) return true;
  const turn = payload.turn && typeof payload.turn === "object" ? payload.turn : null;
  return Boolean(turn && FINAL_MESSAGE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(turn, key)));
}

function canAttachCompletedTurnDiagnostic(status, options = {}) {
  const text = statusText(status).toLowerCase();
  if (!text) return Boolean(options.allowRestingThreadStatus);
  if (/failed|fail|cancel|error|interrupt|running|active|progress|pending/.test(text)) return false;
  if (/completed|success|succeeded|done|finished|closed/.test(text)) return true;
  return Boolean(options.allowRestingThreadStatus && /^(idle|unknown|notloaded|not_loaded|not-loaded)$/.test(text));
}

function isRestingThreadStatus(status) {
  const text = statusText(status).toLowerCase();
  if (!text) return false;
  if (/failed|fail|cancel|error|interrupt|running|active|progress|pending/.test(text)) return false;
  return /^(idle|completed|success|succeeded|done|finished|closed)$/.test(text);
}

function defaultVisibleItemId(item) {
  return stringValue(item && (item.id || item.itemId || item.item_id));
}

function defaultInsertItem(items, item) {
  if (Array.isArray(items)) items.push(item);
}

function defaultRolloutEntryTurnId(entry) {
  const payload = entry && entry.payload;
  return stringValue((payload && (
    payload.turn_id
    || payload.turnId
    || (payload.turn && payload.turn.id)
    || (payload.turn && payload.turn.turn_id)
  )) || entry && (entry.turn_id || entry.turnId));
}

function defaultRolloutCompletionTimestampMs(entry) {
  const payload = entry && entry.payload && typeof entry.payload === "object" ? entry.payload : {};
  return timestampMs(payload.completed_at || payload.completedAt || entry && entry.timestamp || payload.timestamp);
}

function cloneDiagnosticPayload(payload) {
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

function buildEmptyCompletionDiagnosticItem(entry, turnId, options = {}) {
  const payload = entry && entry.payload && typeof entry.payload === "object" ? entry.payload : {};
  const stableTextHash = typeof options.stableTextHash === "function"
    ? options.stableTextHash
    : defaultStableTextHash;
  const rolloutCompletionTimestampMs = typeof options.rolloutCompletionTimestampMs === "function"
    ? options.rolloutCompletionTimestampMs
    : defaultRolloutCompletionTimestampMs;
  const completedAtMs = rolloutCompletionTimestampMs(entry);
  const durationMs = Number(payload.duration_ms || payload.durationMs || 0);
  const item = {
    id: `mobile-empty-completion-${turnId || stableTextHash(JSON.stringify(payload))}`,
    type: "turnDiagnostic",
    code: "runtime_completed_without_response",
    severity: "warning",
    title: "Codex turn ended without a response",
    message: "Codex runtime completed this turn without an assistant response.",
    source: "rollout_task_complete",
    mobileRuntimeDiagnostic: true,
  };
  if (completedAtMs) item.completedAtMs = completedAtMs;
  if (Number.isFinite(durationMs) && durationMs > 0) item.durationMs = durationMs;
  return item;
}

function createThreadCompletionDiagnosticService(options = {}) {
  const fsImpl = options.fs || fs;
  const now = typeof options.now === "function" ? options.now : Date.now;
  const cacheTtlMs = Math.max(0, Number(options.cacheTtlMs || 0));
  const cacheMaxEntries = Math.max(1, Number(options.cacheMaxEntries || 64));
  const readRolloutEnrichmentEntries = typeof options.readRolloutEnrichmentEntries === "function"
    ? options.readRolloutEnrichmentEntries
    : () => [];
  const rolloutEntryTurnId = typeof options.rolloutEntryTurnId === "function"
    ? options.rolloutEntryTurnId
    : defaultRolloutEntryTurnId;
  const rolloutCompletionTimestampMs = typeof options.rolloutCompletionTimestampMs === "function"
    ? options.rolloutCompletionTimestampMs
    : defaultRolloutCompletionTimestampMs;
  const finalReceiptTextFromParams = typeof options.finalReceiptTextFromParams === "function"
    ? options.finalReceiptTextFromParams
    : () => "";
  const stableTextHash = typeof options.stableTextHash === "function"
    ? options.stableTextHash
    : defaultStableTextHash;
  const rolloutPathForThread = typeof options.rolloutPathForThread === "function"
    ? options.rolloutPathForThread
    : (thread) => stringValue(thread && thread.path);
  const visibleItemId = typeof options.visibleItemId === "function"
    ? options.visibleItemId
    : defaultVisibleItemId;
  const insertProjectedItemByTimestamp = typeof options.insertProjectedItemByTimestamp === "function"
    ? options.insertProjectedItemByTimestamp
    : defaultInsertItem;
  const isAssistantReceiptItem = typeof options.isAssistantReceiptItem === "function"
    ? options.isAssistantReceiptItem
    : (item) => Boolean(item && (item.type === "agentMessage" || item.type === "plan"));
  const isDiagnosticReceiptItem = typeof options.isDiagnosticReceiptItem === "function"
    ? options.isDiagnosticReceiptItem
    : (item) => Boolean(item && item.type === "turnDiagnostic");
  const cacheKeyForStat = typeof options.cacheKeyForStat === "function"
    ? options.cacheKeyForStat
    : (rolloutPath, stat) => `${rolloutPath}:${Number(stat && stat.size) || 0}:${Number(stat && stat.mtimeMs) || 0}`;
  const cache = new Map();

  function remember(cacheKey, payload) {
    if (!cacheKey) return;
    cache.set(cacheKey, {
      cachedAt: now(),
      payload: cloneDiagnosticPayload(payload),
    });
    while (cache.size > cacheMaxEntries) {
      const firstKey = cache.keys().next().value;
      if (!firstKey) break;
      cache.delete(firstKey);
    }
  }

  function readCache(cacheKey) {
    if (!cacheKey) return null;
    const cached = cache.get(cacheKey);
    if (!cached) return null;
    if (cacheTtlMs > 0 && now() - Number(cached.cachedAt || 0) > cacheTtlMs) {
      cache.delete(cacheKey);
      return null;
    }
    return cloneDiagnosticPayload(cached.payload);
  }

  function rolloutCacheKey(rolloutPath, stat) {
    return `${cacheKeyForStat(rolloutPath, stat)}:empty-completion-diagnostics`;
  }

  function collectEmptyCompletionDiagnosticsFromEntries(entries) {
    const byTurn = new Map();
    let scopedCount = 0;
    let currentTurnId = "";
    for (const entry of entries || []) {
      if (!entry || !entry.type) continue;
      const payload = entry.payload || {};
      const explicitTurnId = rolloutEntryTurnId(entry);
      if (entry.type === "turn_context" && explicitTurnId) currentTurnId = explicitTurnId;
      if (entry.type === "event_msg" && payload.type === "task_started" && explicitTurnId) currentTurnId = explicitTurnId;
      if (entry.type !== "event_msg" || !/^(task_complete|task_completed)$/.test(String(payload.type || ""))) continue;
      if (!completionPayloadHasFinalMessageField(payload)) continue;
      if (finalReceiptTextFromParams(payload)) continue;
      const turnId = explicitTurnId || currentTurnId;
      if (!turnId) continue;
      byTurn.set(turnId, buildEmptyCompletionDiagnosticItem(entry, turnId, {
        rolloutCompletionTimestampMs,
        stableTextHash,
      }));
      scopedCount += 1;
    }
    return { byTurn, scopedCount };
  }

  function readRolloutEmptyCompletionDiagnosticItems(rolloutPath) {
    const filePath = stringValue(rolloutPath);
    if (!filePath || !fsImpl.existsSync(filePath)) return { byTurn: new Map(), scopedCount: 0 };
    let cacheKey = "";
    try {
      const stat = fsImpl.statSync(filePath);
      cacheKey = rolloutCacheKey(filePath, stat);
      const cached = readCache(cacheKey);
      if (cached) return cached;
    } catch (_) {
      return { byTurn: new Map(), scopedCount: 0 };
    }
    const payload = collectEmptyCompletionDiagnosticsFromEntries(readRolloutEnrichmentEntries(filePath));
    remember(cacheKey, payload);
    return cloneDiagnosticPayload(payload);
  }

  function appendEmptyCompletionDiagnosticsToThread(thread) {
    if (!thread || typeof thread !== "object" || !Array.isArray(thread.turns) || !thread.turns.length) return thread;
    const rolloutPath = rolloutPathForThread(thread);
    if (!rolloutPath) return thread;
    const payload = readRolloutEmptyCompletionDiagnosticItems(rolloutPath);
    if (!payload || !(payload.byTurn instanceof Map) || !payload.byTurn.size) return thread;
    const allowRestingThreadStatus = isRestingThreadStatus(thread.status);
    for (const turn of thread.turns) {
      if (!turn || !canAttachCompletedTurnDiagnostic(turn.status, { allowRestingThreadStatus })) continue;
      const turnId = stringValue(turn.id || turn.turnId);
      const item = turnId ? payload.byTurn.get(turnId) : null;
      if (!item) continue;
      turn.items = Array.isArray(turn.items) ? turn.items : [];
      if (turn.items.some(isAssistantReceiptItem) || turn.items.some(isDiagnosticReceiptItem)) continue;
      const existingIds = new Set(turn.items.map(visibleItemId).filter(Boolean));
      const id = visibleItemId(item);
      if (!id || existingIds.has(id)) continue;
      insertProjectedItemByTimestamp(turn.items, Object.assign({}, item));
    }
    return thread;
  }

  return {
    appendEmptyCompletionDiagnosticsToThread,
    collectEmptyCompletionDiagnosticsFromEntries,
    readRolloutEmptyCompletionDiagnosticItems,
  };
}

module.exports = {
  buildEmptyCompletionDiagnosticItem,
  canAttachCompletedTurnDiagnostic,
  completionPayloadHasFinalMessageField,
  createThreadCompletionDiagnosticService,
};
