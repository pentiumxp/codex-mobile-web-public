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

function normalizeComparableText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function attachmentSummaryMarkerMatch(source) {
  return /(^|\r?\n)[ \t]*(?:>[ \t]*)?Uploaded attachments:[ \t]*(?:\r?\n|$)/.exec(source);
}

function stripAttachmentSummaryLinePrefix(line) {
  return String(line || "").replace(/^[ \t]*(?:>[ \t]*)?/, "").trim();
}

function parseAttachmentLine(line) {
  const match = /^-\s*(.*?)\s*\((.*?)\):\s*(.+)$/.exec(String(line || ""));
  if (!match) return null;
  return {
    name: match[1] || "attachment",
    path: (match[3] || "").trim(),
  };
}

function splitAttachmentSummaryText(text) {
  const source = String(text || "");
  const markerMatch = attachmentSummaryMarkerMatch(source);
  if (!markerMatch) return { text: source, attachments: [] };
  const markerStart = markerMatch.index + (markerMatch[1] || "").length;
  const before = source.slice(0, markerStart).trimEnd();
  const attachments = [];
  const remainder = [];
  let parsingAttachments = true;
  for (const line of source.slice(markerMatch.index + markerMatch[0].length).split(/\r?\n/)) {
    const trimmed = stripAttachmentSummaryLinePrefix(line);
    if (parsingAttachments && !trimmed) continue;
    const attachment = parsingAttachments ? parseAttachmentLine(trimmed) : null;
    if (attachment) {
      attachments.push(attachment);
      continue;
    }
    parsingAttachments = false;
    remainder.push(line);
  }
  const after = remainder.join("\n").trimStart();
  const visibleText = [before, after].filter(Boolean).join(before && after ? "\n\n" : "");
  return { text: visibleText, attachments };
}

function imageUrlValue(part) {
  if (!part || typeof part !== "object") return "";
  const imageUrl = part.image_url || part.imageUrl || part.url || "";
  if (typeof imageUrl === "string") return imageUrl;
  if (imageUrl && typeof imageUrl.url === "string") return imageUrl.url;
  return "";
}

function userMessageParts(message) {
  const parts = Array.isArray(message && message.content) ? message.content.slice() : [];
  if (typeof (message && message.text) === "string") parts.push({ type: "text", text: message.text });
  if (typeof (message && message.message) === "string") parts.push({ type: "text", text: message.message });
  return parts;
}

function comparablePathName(value) {
  const normalized = normalizeFsPath(value);
  const name = normalized.split("/").filter(Boolean).pop() || normalized;
  return name.replace(/[?#].*$/, "");
}

function comparablePathNamesLikelySame(leftName, rightName) {
  const left = String(leftName || "");
  const right = String(rightName || "");
  if (!left || !right) return false;
  if (left === right) return true;
  return left.endsWith(`-${right}`) || right.endsWith(`-${left}`);
}

function pathOverlap(left, right) {
  if (!left.paths.length || !right.paths.length) return false;
  const leftPaths = new Set(left.paths);
  return right.paths.some((value) => leftPaths.has(value));
}

function pathNameOverlap(left, right) {
  if (!left.paths.length || !right.paths.length) return false;
  const leftNames = new Set(left.paths.map(comparablePathName).filter(Boolean));
  if (!leftNames.size) return false;
  return right.paths.some((value) => {
    const rightName = comparablePathName(value);
    return rightName && Array.from(leftNames).some((leftName) => comparablePathNamesLikelySame(leftName, rightName));
  });
}

function comparableUserMessageParts(message) {
  const result = { text: "", paths: [] };
  if (!message || message.type !== "userMessage") return result;
  const textParts = [];
  const paths = [];
  for (const part of userMessageParts(message)) {
    if (!part || typeof part !== "object") continue;
    if (part.type === "text" || part.type === "input_text" || typeof part.text === "string" || typeof part.input_text === "string") {
      const split = splitAttachmentSummaryText(normalizedTextValue(part));
      if (split.text) textParts.push(split.text);
      for (const attachment of split.attachments) {
        if (attachment.path) paths.push(normalizeFsPath(attachment.path));
      }
      continue;
    }
    if (part.path) paths.push(normalizeFsPath(part.path));
    const url = imageUrlValue(part);
    if (url && !/^data:image\//i.test(url)) paths.push(normalizeFsPath(url));
  }
  result.text = normalizeComparableText(textParts.join("\n"));
  result.paths = [...new Set(paths.filter(Boolean))].sort();
  return result;
}

function sameUserMessageContent(left, right) {
  if (!left || !right || left.type !== "userMessage" || right.type !== "userMessage") return false;
  const a = comparableUserMessageParts(left);
  const b = comparableUserMessageParts(right);
  if (a.text && b.text && a.text !== b.text) return false;
  if (a.text && b.text && !a.paths.length && !b.paths.length) return true;
  if (pathOverlap(a, b) || pathNameOverlap(a, b)) return true;
  return Boolean(a.text && b.text && a.text === b.text && !a.paths.length && !b.paths.length);
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

function sameClientSubmission(left, right) {
  const a = String(left && left.clientSubmissionId || "").trim();
  const b = String(right && right.clientSubmissionId || "").trim();
  return Boolean(a && b && a === b);
}

function statusText(status) {
  if (!status) return "";
  if (typeof status === "string") return status;
  if (typeof status.type === "string") return status.type;
  return "";
}

function isCompletedTurn(turn) {
  return Boolean(turn && (
    turn.completedAt
    || turn.durationMs
    || /completed|failed|cancel|error|interrupted/i.test(statusText(turn.status))
  ));
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
        clientSubmissionId: String(params.clientSubmissionId || "").trim(),
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

  function insertPendingEchoIntoTurn(turn, pendingItem) {
    if (!turn || !pendingItem) return false;
    turn.items = Array.isArray(turn.items) ? turn.items : [];
    const matchingIndex = turn.items.findIndex((item) => item
      && item.type === "userMessage"
      && (item.id === pendingItem.id || sameUserMessageContent(item, pendingItem)));
    if (matchingIndex >= 0) {
      const firstNonUserIndex = turn.items.findIndex((item) => item && item.type !== "userMessage");
      if (firstNonUserIndex >= 0 && matchingIndex > firstNonUserIndex) {
        const [item] = turn.items.splice(matchingIndex, 1);
        turn.items.splice(firstNonUserIndex, 0, item);
        return true;
      }
      return false;
    }
    const insertAt = turn.items.findIndex((item) => item && item.type !== "userMessage");
    const item = Object.assign({}, pendingItem);
    if (insertAt < 0) {
      turn.items.push(item);
    } else {
      turn.items.splice(insertAt, 0, item);
    }
    return true;
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

  function hasDurableSubmissionMatch(thread, pendingItem) {
    if (!pendingItem || !String(pendingItem.clientSubmissionId || "").trim()) return false;
    for (const turn of thread.turns || []) {
      const items = Array.isArray(turn && turn.items) ? turn.items : [];
      if (items.some((item) => isDurableUserMessage(item) && sameClientSubmission(item, pendingItem))) return true;
    }
    return false;
  }

  function removePendingEchoFromEntireThread(thread, pendingItem) {
    if (!thread || !Array.isArray(thread.turns) || !pendingItem) return;
    for (const turn of thread.turns) {
      if (!turn || !Array.isArray(turn.items)) continue;
      turn.items = turn.items.filter((item) => !(isSyntheticUserMessage(item)
        && (item.id === pendingItem.id || sameClientSubmission(item, pendingItem))));
    }
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
      if (hasDurableSubmissionMatch(thread, entry.item)) {
        removePendingEchoFromEntireThread(thread, entry.item);
        entries.delete(entry.key);
        continue;
      }
      const durableTurnIndex = matchingDurableUserMessageTurnIndex(thread, entry.item, entry.turnId);
      if (durableTurnIndex >= 0) {
        removePendingEchoFromThread(thread, entry.item, entry.turnId, durableTurnIndex);
        entries.delete(entry.key);
        continue;
      }
      const turn = thread.turns.find((candidate) => String(candidate && candidate.id || "") === entry.turnId);
      if (!turn) continue;
      insertPendingEchoIntoTurn(turn, entry.item);
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
