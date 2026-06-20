"use strict";

const crypto = require("node:crypto");

const PROJECTION_VERSION = "v4";
const CONTEXT_COMPACTION_PENDING_NOTICE = "历史上下文正在压缩";
const CONTEXT_COMPACTION_COMPLETE_NOTICE = "历史上下文已压缩";

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function stableJson(value) {
  if (!value || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function hashText(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function statusText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.type) return String(value.type || "");
  return String(value || "");
}

function isCompletedStatus(value) {
  return /completed|success|succeeded|done|finished|closed|failed|cancel|error|interrupted/i.test(statusText(value));
}

function isPendingStatus(value) {
  return /running|active|queued|processing|inprogress|in_progress|in-progress|pending|started/i.test(statusText(value));
}

function itemId(item) {
  return String(item && (item.id || item.itemId || item.item_id) || "").trim();
}

function turnIdValue(turn) {
  return String(turn && (turn.id || turn.turnId || turn.turn_id) || "").trim();
}

function isContextCompactionType(type) {
  return /context.*compaction|context.*compression|context_compaction|context_compression/i.test(String(type || ""));
}

function contextCompactionMobileState(item, options = {}) {
  if (options.contextCompactionPending === true) return "pending";
  if (options.contextCompactionPending === false) return "complete";
  if (!item || typeof item !== "object") return "";
  if (item.mobileNotice === CONTEXT_COMPACTION_PENDING_NOTICE) return "pending";
  if (item.mobileNotice === CONTEXT_COMPACTION_COMPLETE_NOTICE) return "complete";
  if (isCompletedStatus(item.mobileCompactionStatus || item.status)) return "complete";
  if (isPendingStatus(item.mobileCompactionStatus || item.status)) return "pending";
  return "";
}

function normalizeContextCompactionItem(item, options = {}) {
  const out = cloneJson(item || {});
  const state = contextCompactionMobileState(out, options);
  if (!state) {
    delete out.mobileCompactionStatus;
    delete out.mobileNotice;
    return out;
  }
  const pending = state === "pending";
  out.mobileCompactionStatus = pending ? "running" : "completed";
  out.mobileNotice = pending ? CONTEXT_COMPACTION_PENDING_NOTICE : CONTEXT_COMPACTION_COMPLETE_NOTICE;
  return out;
}

function visibleKindForItem(item) {
  const type = String(item && item.type || "").trim();
  if (!type) return "item";
  if (type === "userMessage") return "user";
  if (type === "agentMessage" || type === "plan") return "receipt";
  if (type === "turnUsageSummary") return "usage";
  if (type === "imageView" || type === "imageGeneration") return "image";
  if (isContextCompactionType(type)) return "contextCompaction";
  if (type === "commandExecution" || type === "fileChange" || type === "dynamicToolCall" || type === "mcpToolCall") return "operation";
  return type;
}

function fallbackItemIdentity(item, itemIndex) {
  const id = itemId(item);
  if (id) return id;
  const submissionId = String(item && item.clientSubmissionId || "").trim();
  if (submissionId) return `client-${submissionId}`;
  return `index-${Math.max(0, Number(itemIndex) || 0)}`;
}

function visibleKeyForItem(item, turn, itemIndex) {
  const turnId = turnIdValue(turn) || "turn";
  const kind = visibleKindForItem(item);
  if (kind === "contextCompaction") return `${turnId}:contextCompaction`;
  if (kind === "usage") return `${turnId}:turnUsageSummary`;
  return `${turnId}:${kind}:${fallbackItemIdentity(item, itemIndex)}`;
}

function normalizeVisibleItem(item, turn, itemIndex, options = {}) {
  if (!item || typeof item !== "object") return item;
  const contextOptions = Object.assign({}, options);
  let out = isContextCompactionType(item.type)
    ? normalizeContextCompactionItem(item, contextOptions)
    : cloneJson(item);
  const kind = visibleKindForItem(out);
  const key = visibleKeyForItem(out, turn, itemIndex);
  out = Object.assign({}, out, {
    mobileProjectionVersion: PROJECTION_VERSION,
    mobileVisibleKind: kind,
    mobileVisibleKey: key,
  });
  if (options.source) out.mobileProjectionSource = String(options.source);
  return out;
}

function normalizeVisibleTurn(turn, options = {}) {
  if (!turn || typeof turn !== "object") return turn;
  const out = cloneJson(turn);
  out.mobileProjectionVersion = PROJECTION_VERSION;
  out.mobileVisibleKey = `turn:${turnIdValue(out) || "unknown"}`;
  if (Array.isArray(out.items)) {
    out.items = out.items.map((item, index) => normalizeVisibleItem(item, out, index, options));
    out.mobileVisibleItemKeys = out.items
      .map((item) => String(item && item.mobileVisibleKey || ""))
      .filter(Boolean);
  } else {
    out.mobileVisibleItemKeys = [];
  }
  return out;
}

function visibleKeysFromThread(thread) {
  const keys = [];
  for (const turn of Array.isArray(thread && thread.turns) ? thread.turns : []) {
    for (const item of Array.isArray(turn && turn.items) ? turn.items : []) {
      const key = String(item && item.mobileVisibleKey || "");
      if (key) keys.push(key);
    }
  }
  return keys;
}

function projectionRevisionFromResult(result) {
  const thread = result && result.thread;
  const payload = {
    threadId: thread && (thread.id || thread.threadId) || "",
    status: thread && thread.status || "",
    turns: (Array.isArray(thread && thread.turns) ? thread.turns : []).map((turn) => ({
      id: turn && (turn.id || turn.turnId) || "",
      status: turn && turn.status || "",
      items: (Array.isArray(turn && turn.items) ? turn.items : []).map((item) => ({
        key: item && item.mobileVisibleKey || "",
        id: item && (item.id || item.itemId) || "",
        type: item && item.type || "",
        status: item && item.status || "",
        notice: item && item.mobileNotice || "",
      })),
    })),
  };
  return hashText(stableJson(payload)).slice(0, 16);
}

function normalizeThreadVisibleProjection(result, options = {}) {
  if (!result || typeof result !== "object") return result;
  const out = cloneJson(result);
  if (!out.thread || typeof out.thread !== "object") return out;
  out.thread.mobileProjectionVersion = PROJECTION_VERSION;
  if (Array.isArray(out.thread.turns)) {
    out.thread.turns = out.thread.turns.map((turn) => normalizeVisibleTurn(turn, options));
  }
  out.thread.mobileVisibleItemKeys = visibleKeysFromThread(out.thread);
  out.thread.mobileProjectionRevision = options.revision !== undefined
    ? options.revision
    : projectionRevisionFromResult(out);
  out.thread.mobileProjection = Object.assign({}, out.thread.mobileProjection || {}, {
    version: PROJECTION_VERSION,
    revision: out.thread.mobileProjectionRevision,
  });
  return out;
}

function normalizeNotificationParamsForProjectionV4(method, params = {}) {
  const out = cloneJson(params || {});
  const contextCompactionPending = method === "item/started"
    ? true
    : method === "item/completed"
      ? false
      : undefined;
  if (out.item && typeof out.item === "object") {
    const turn = {
      id: out.turnId || out.turn_id || out.item.turnId || out.item.turn_id || "",
    };
    out.item = normalizeVisibleItem(out.item, turn, 0, {
      source: method || "notification",
      contextCompactionPending,
    });
  }
  if (out.turn && typeof out.turn === "object") {
    out.turn = normalizeVisibleTurn(out.turn, {
      source: method || "notification",
      contextCompactionPending,
    });
  }
  return out;
}

function visibleItemKindCounts(thread) {
  const counts = {};
  for (const turn of Array.isArray(thread && thread.turns) ? thread.turns : []) {
    for (const item of Array.isArray(turn && turn.items) ? turn.items : []) {
      const kind = String(item && (item.mobileVisibleKind || visibleKindForItem(item)) || "item");
      counts[kind] = (counts[kind] || 0) + 1;
    }
  }
  return counts;
}

function projectionDiffSummary(leftResult, rightResult) {
  const leftThread = leftResult && leftResult.thread || {};
  const rightThread = rightResult && rightResult.thread || {};
  const leftKeys = visibleKeysFromThread(leftThread);
  const rightKeys = visibleKeysFromThread(rightThread);
  let firstDiffIndex = -1;
  const max = Math.max(leftKeys.length, rightKeys.length);
  for (let index = 0; index < max; index += 1) {
    if (leftKeys[index] !== rightKeys[index]) {
      firstDiffIndex = index;
      break;
    }
  }
  return {
    equal: firstDiffIndex < 0,
    firstDiffIndex,
    left: {
      version: leftThread.mobileProjectionVersion || "",
      itemCount: leftKeys.length,
      kindCounts: visibleItemKindCounts(leftThread),
      firstDifferentKey: firstDiffIndex >= 0 ? leftKeys[firstDiffIndex] || "" : "",
    },
    right: {
      version: rightThread.mobileProjectionVersion || "",
      itemCount: rightKeys.length,
      kindCounts: visibleItemKindCounts(rightThread),
      firstDifferentKey: firstDiffIndex >= 0 ? rightKeys[firstDiffIndex] || "" : "",
    },
  };
}

module.exports = {
  CONTEXT_COMPACTION_COMPLETE_NOTICE,
  CONTEXT_COMPACTION_PENDING_NOTICE,
  PROJECTION_VERSION,
  contextCompactionMobileState,
  isContextCompactionType,
  normalizeNotificationParamsForProjectionV4,
  normalizeThreadVisibleProjection,
  normalizeVisibleItem,
  normalizeVisibleTurn,
  projectionDiffSummary,
  visibleKeyForItem,
  visibleKeysFromThread,
};
