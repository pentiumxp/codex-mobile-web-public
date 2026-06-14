"use strict";

const DEFAULT_PENDING_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 200;

function nowMs(options) {
  return typeof options.now === "function" ? Number(options.now()) || Date.now() : Date.now();
}

function normalizeUserInputPart(part) {
  if (!part || typeof part !== "object") return null;
  if (part.type === "text") {
    const text = String(part.text || "");
    if (!text) return null;
    return {
      type: "text",
      text,
      text_elements: Array.isArray(part.text_elements) ? part.text_elements : [],
    };
  }
  if (part.type === "localImage" && part.path) {
    return {
      type: "localImage",
      path: String(part.path),
    };
  }
  return part;
}

function normalizedTextValue(part) {
  if (!part || typeof part !== "object") return "";
  if (typeof part.text === "string") return part.text;
  if (typeof part.input_text === "string") return part.input_text;
  if (part.type === "input_text" && typeof part.content === "string") return part.content;
  return "";
}

function normalizeFsPath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/\s+/g, " ").trim().toLowerCase();
}

function comparablePart(part) {
  if (!part || typeof part !== "object") return "";
  if (part.type === "text" || part.type === "input_text") {
    return `text:${normalizedTextValue(part).replace(/\s+/g, " ").trim()}`;
  }
  if (part.path) return `path:${normalizeFsPath(part.path)}`;
  return JSON.stringify(part);
}

function userMessageParts(message) {
  const parts = Array.isArray(message && message.content) ? message.content.slice() : [];
  if (typeof (message && message.text) === "string") parts.push({ type: "text", text: message.text });
  if (typeof (message && message.message) === "string") parts.push({ type: "text", text: message.message });
  return parts;
}

function comparableContent(message) {
  return userMessageParts(message)
    .map(comparablePart)
    .filter(Boolean)
    .join("|");
}

function sameUserMessageContent(left, right) {
  if (!left || !right || left.type !== "userMessage" || right.type !== "userMessage") return false;
  const leftContent = comparableContent(left);
  const rightContent = comparableContent(right);
  return Boolean(leftContent && rightContent && leftContent === rightContent);
}

function isSyntheticUserMessage(item) {
  const id = String(item && item.id || "");
  return Boolean(item
    && item.type === "userMessage"
    && (item.mobilePendingSubmission || /^mux-user-/.test(id) || /^local-user-/.test(id)));
}

function isDurableUserMessage(item) {
  return Boolean(item && item.type === "userMessage" && !isSyntheticUserMessage(item));
}

function pendingItemId(threadId, turnId, clientSubmissionId, startedAtMs) {
  const suffix = clientSubmissionId
    ? String(clientSubmissionId)
    : String(startedAtMs || Date.now());
  return `mux-user-${threadId}-${turnId}-${suffix}`;
}

function createPendingSteerEchoStore(options = {}) {
  const ttlMs = Math.max(5_000, Number(options.ttlMs || DEFAULT_PENDING_TTL_MS));
  const maxEntries = Math.max(1, Number(options.maxEntries || DEFAULT_MAX_ENTRIES));
  const entries = new Map();

  function prune(referenceNowMs = nowMs(options)) {
    for (const [key, entry] of entries) {
      if (referenceNowMs - entry.startedAtMs > ttlMs) entries.delete(key);
    }
    while (entries.size > maxEntries) {
      const firstKey = entries.keys().next().value;
      if (!firstKey) break;
      entries.delete(firstKey);
    }
  }

  function keyFor(threadId, clientSubmissionId) {
    const thread = String(threadId || "").trim();
    const submission = String(clientSubmissionId || "").trim();
    return thread && submission ? `${thread}:${submission}` : "";
  }

  function remember(params = {}) {
    const threadId = String(params.threadId || "").trim();
    const turnId = String(params.turnId || "").trim();
    const content = (params.input || []).map(normalizeUserInputPart).filter(Boolean);
    if (!threadId || !turnId || !content.length) return "";
    const startedAtMs = nowMs(options);
    const key = keyFor(threadId, params.clientSubmissionId) || `${threadId}:${turnId}:${startedAtMs}`;
    entries.set(key, {
      key,
      threadId,
      turnId,
      clientSubmissionId: String(params.clientSubmissionId || "").trim(),
      startedAtMs,
      item: {
        id: pendingItemId(threadId, turnId, params.clientSubmissionId, startedAtMs),
        type: "userMessage",
        content,
        startedAtMs,
        startedAt: new Date(startedAtMs).toISOString(),
        mobilePendingSubmission: true,
      },
    });
    prune(startedAtMs);
    return key;
  }

  function forget(keyOrParams) {
    if (!keyOrParams) return false;
    if (typeof keyOrParams === "string") return entries.delete(keyOrParams);
    const key = keyFor(keyOrParams.threadId, keyOrParams.clientSubmissionId);
    return key ? entries.delete(key) : false;
  }

  function hasMatchingUserMessage(turn, pendingItem) {
    return (turn.items || []).some((item) => item
      && item.type === "userMessage"
      && (item.id === pendingItem.id || sameUserMessageContent(item, pendingItem)));
  }

  function turnIndexForId(thread, turnId) {
    const id = String(turnId || "");
    if (!id) return -1;
    return (thread.turns || []).findIndex((turn) => String(turn && turn.id || "") === id);
  }

  function matchingDurableUserMessageTurnIndex(thread, pendingItem, pendingTurnId) {
    const pendingTurnIndex = turnIndexForId(thread, pendingTurnId);
    if (pendingTurnIndex < 0) return -1;
    for (let index = pendingTurnIndex; index < (thread.turns || []).length; index += 1) {
      const turn = thread.turns[index];
      const items = Array.isArray(turn && turn.items) ? turn.items : [];
      if (items.some((item) => isDurableUserMessage(item) && sameUserMessageContent(item, pendingItem))) return index;
    }
    return -1;
  }

  function removePendingEchoFromThread(thread, pendingItem, pendingTurnId, durableTurnIndex) {
    const pendingTurnIndex = turnIndexForId(thread, pendingTurnId);
    if (pendingTurnIndex < 0 || durableTurnIndex < pendingTurnIndex) return;
    for (let index = pendingTurnIndex; index <= durableTurnIndex; index += 1) {
      const turn = thread.turns[index];
      if (!turn || !Array.isArray(turn.items)) continue;
      turn.items = turn.items.filter((item) => !(isSyntheticUserMessage(item)
        && (item.id === pendingItem.id || sameUserMessageContent(item, pendingItem))));
    }
  }

  function injectIntoThread(thread) {
    prune();
    if (!thread || typeof thread !== "object" || !Array.isArray(thread.turns)) return thread;
    const threadId = String(thread.id || "").trim();
    if (!threadId) return thread;
    for (const entry of entries.values()) {
      if (entry.threadId !== threadId) continue;
      const durableTurnIndex = matchingDurableUserMessageTurnIndex(thread, entry.item, entry.turnId);
      if (durableTurnIndex >= 0) {
        removePendingEchoFromThread(thread, entry.item, entry.turnId, durableTurnIndex);
        entries.delete(entry.key);
        continue;
      }
      const turn = thread.turns.find((candidate) => String(candidate && candidate.id || "") === entry.turnId);
      if (!turn) continue;
      turn.items = Array.isArray(turn.items) ? turn.items : [];
      if (hasMatchingUserMessage(turn, entry.item)) continue;
      turn.items.push(Object.assign({}, entry.item));
    }
    return thread;
  }

  function size() {
    prune();
    return entries.size;
  }

  return {
    forget,
    injectIntoThread,
    remember,
    size,
  };
}

module.exports = {
  createPendingSteerEchoStore,
  normalizeUserInputPart,
  sameUserMessageContent,
};
