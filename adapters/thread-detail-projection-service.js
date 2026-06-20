"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

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

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

function normalizeStatus(value) {
  if (!value) return "";
  if (typeof value === "string") return value.toLowerCase();
  if (value && typeof value === "object" && value.type) return String(value.type).toLowerCase();
  return String(value).toLowerCase();
}

function projectionSignature(input = {}) {
  const stats = input.rolloutStats || {};
  const signature = {
    policyVersion: String(input.policyVersion || "1"),
    threadId: String(input.threadId || "").trim(),
    rolloutPathHash: hashText(path.resolve(String(input.rolloutPath || ""))),
    rolloutSizeBytes: safeNumber(stats.sizeBytes ?? stats.size),
    rolloutMtimeMs: safeNumber(stats.mtimeMs ?? stats.mtime),
    maxTurns: Math.max(1, safeNumber(input.maxTurns) || 1),
    summaryUpdatedAtMs: safeNumber(input.summaryUpdatedAtMs),
    summaryStatus: normalizeStatus(input.summaryStatus),
  };
  if (!signature.threadId || !signature.rolloutPathHash || !signature.rolloutSizeBytes) return null;
  return signature;
}

function signatureHash(signature) {
  return signature ? hashText(stableJson(signature)) : "";
}

function readJsonFile(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    return null;
  }
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, filePath);
}

function cacheFileForThread(cacheDir, threadId) {
  const hash = hashText(String(threadId || "")).slice(0, 32);
  return path.join(cacheDir, `${hash}.json`);
}

function notificationThreadId(method, params = {}) {
  if (!params || typeof params !== "object") return "";
  return String(params.threadId
    || params.conversationId
    || params.thread && params.thread.id
    || params.turn && (params.turn.threadId || params.turn.thread_id)
    || "").trim();
}

function turnIdFromParams(params = {}) {
  return String(params.turnId
    || params.turn_id
    || params.turn && params.turn.id
    || params.item && (params.item.turnId || params.item.turn_id)
    || "").trim();
}

function itemId(item) {
  return String(item && (item.id || item.itemId || item.item_id) || "").trim();
}

function ensureThread(result, threadId) {
  if (!result.thread || typeof result.thread !== "object") result.thread = { id: threadId, turns: [] };
  if (!result.thread.id) result.thread.id = threadId;
  if (!Array.isArray(result.thread.turns)) result.thread.turns = [];
  return result.thread;
}

function findTurn(thread, turnId) {
  if (!thread || !Array.isArray(thread.turns) || !turnId) return null;
  return thread.turns.find((turn) => String(turn && turn.id || "") === turnId) || null;
}

function isTextReceiptItem(item) {
  return Boolean(item && (item.type === "agentMessage" || item.type === "plan"));
}

function comparableText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function textReceiptsLikelySame(left, right) {
  if (!isTextReceiptItem(left) || !isTextReceiptItem(right)) return false;
  if (left.type !== right.type) return false;
  const leftText = comparableText(left.text);
  const rightText = comparableText(right.text);
  if (!leftText || !rightText) return false;
  return leftText === rightText || leftText.startsWith(rightText) || rightText.startsWith(leftText);
}

function normalizeFsPath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/\s+/g, " ").trim().toLowerCase();
}

function projectionImageUrlValue(part) {
  if (!part || typeof part !== "object") return "";
  const raw = part.url || part.image_url || part.imageUrl || "";
  if (raw && typeof raw === "object") return String(raw.url || raw.uri || "");
  return String(raw || "");
}

function projectionInputTextValue(part) {
  if (!part || typeof part !== "object") return "";
  if (typeof part.text === "string") return part.text;
  if (typeof part.input_text === "string") return part.input_text;
  if (part.type === "input_text" && typeof part.content === "string") return part.content;
  return "";
}

function isProjectionInputTextPart(part) {
  if (!part || typeof part !== "object") return false;
  const type = String(part.type || "");
  return type === "text" || type === "input_text";
}

function isProjectionUserMessage(item) {
  return Boolean(item && item.type === "userMessage");
}

function isSyntheticProjectionUserMessage(item) {
  const id = String(item && item.id || "");
  return Boolean(isProjectionUserMessage(item)
    && (item.mobilePendingSubmission || /^mux-user-/.test(id) || /^local-user-/.test(id)));
}

function projectionUserMessageComparableParts(item) {
  const result = { text: "", paths: [] };
  if (!isProjectionUserMessage(item)) return result;
  const textParts = [];
  const paths = [];
  if (typeof item.text === "string") textParts.push(item.text);
  if (typeof item.message === "string") textParts.push(item.message);
  const content = Array.isArray(item.content) ? item.content : [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    if (isProjectionInputTextPart(part)) {
      const text = projectionInputTextValue(part);
      if (text) textParts.push(text);
      continue;
    }
    if (part.path) {
      paths.push(normalizeFsPath(part.path));
      continue;
    }
    const url = projectionImageUrlValue(part);
    if (url && !/^data:image\//i.test(url)) paths.push(normalizeFsPath(url));
  }
  result.text = comparableText(textParts.join("\n"));
  result.paths = [...new Set(paths.filter(Boolean))].sort();
  return result;
}

function projectionUserMessagePathOverlap(left, right) {
  return left.paths.length > 0 && right.paths.length > 0
    && left.paths.some((pathValue) => right.paths.includes(pathValue));
}

function projectionComparablePathName(pathValue) {
  const text = String(pathValue || "").split(/[?#]/)[0];
  const parts = normalizeFsPath(text).split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function projectionUserMessagePathNameOverlap(left, right) {
  if (!left.paths.length || !right.paths.length) return false;
  const leftNames = new Set(left.paths.map(projectionComparablePathName).filter(Boolean));
  if (!leftNames.size) return false;
  return right.paths.some((pathValue) => leftNames.has(projectionComparablePathName(pathValue)));
}

function projectionUserMessagesLikelySame(left, right) {
  if (!isProjectionUserMessage(left) || !isProjectionUserMessage(right)) return false;
  const a = projectionUserMessageComparableParts(left);
  const b = projectionUserMessageComparableParts(right);
  const hasSynthetic = isSyntheticProjectionUserMessage(left) || isSyntheticProjectionUserMessage(right);
  if (a.text && b.text && a.text === b.text) {
    if (hasSynthetic) return true;
    if (!a.paths.length && !b.paths.length) return true;
    return projectionUserMessagePathOverlap(a, b);
  }
  if (hasSynthetic
    && projectionUserMessagePathNameOverlap(a, b)
    && (!a.text || !b.text || a.text === b.text)) return true;
  return projectionUserMessagePathOverlap(a, b) && (!a.text || !b.text || a.text === b.text);
}

function projectionUserMessagesCanShadow(left, right) {
  return Boolean(isProjectionUserMessage(left)
    && isProjectionUserMessage(right)
    && (isSyntheticProjectionUserMessage(left) || isSyntheticProjectionUserMessage(right))
    && projectionUserMessagesLikelySame(left, right));
}

function projectionUserMessagePriority(item) {
  if (!isProjectionUserMessage(item)) return 0;
  const id = String(item.id || "");
  if (/^local-user-/.test(id)) return 1;
  if (/^mux-user-/.test(id) || item.mobilePendingSubmission) return 2;
  return 3;
}

function mergeProjectionUserMessage(existing, incoming) {
  const existingPriority = projectionUserMessagePriority(existing);
  const incomingPriority = projectionUserMessagePriority(incoming);
  const preferred = incomingPriority >= existingPriority ? incoming : existing;
  const merged = mergeProjectionItem(existing, incoming);
  if (preferred && preferred.id) merged.id = preferred.id;
  if (preferred && preferred.clientSubmissionId) merged.clientSubmissionId = preferred.clientSubmissionId;
  if (preferred && preferred.startedAtMs && !merged.startedAtMs) merged.startedAtMs = preferred.startedAtMs;
  if (preferred && !isSyntheticProjectionUserMessage(preferred)) {
    delete merged.mobilePendingSubmission;
    delete merged.clientSubmissionId;
  }
  if (incomingPriority > existingPriority && incomingPriority >= 3) {
    if (Array.isArray(incoming.content)) merged.content = cloneJson(incoming.content);
    if (typeof incoming.text === "string") merged.text = incoming.text;
    if (typeof incoming.message === "string") merged.message = incoming.message;
  }
  return merged;
}

function dedupeProjectionUserMessages(items) {
  const out = [];
  for (const item of items || []) {
    if (isProjectionUserMessage(item)) {
      const existingIndex = out.findIndex((candidate) => projectionUserMessagesCanShadow(candidate, item));
      if (existingIndex >= 0) {
        out[existingIndex] = mergeProjectionUserMessage(out[existingIndex], item);
        continue;
      }
    }
    out.push(item);
  }
  return out;
}

function mergeTextField(existing, incoming, field) {
  const left = typeof existing[field] === "string" ? existing[field] : "";
  const right = typeof incoming[field] === "string" ? incoming[field] : "";
  if (!left) return right || existing[field];
  if (!right) return left;
  return right.length >= left.length ? right : left;
}

function mergeProjectionItem(existing, incoming) {
  if (!existing || !incoming) return cloneJson(incoming || existing);
  const merged = Object.assign({}, cloneJson(existing), cloneJson(incoming));
  if (typeof existing.text === "string" || typeof incoming.text === "string") {
    merged.text = mergeTextField(existing, incoming, "text");
  }
  if (typeof existing.aggregatedOutput === "string" || typeof incoming.aggregatedOutput === "string") {
    merged.aggregatedOutput = mergeTextField(existing, incoming, "aggregatedOutput");
  }
  return merged;
}

function dedupeProjectionUsageItems(items) {
  let lastSummaryIndex = -1;
  items.forEach((item, index) => {
    if (item && item.type === "turnUsageSummary") lastSummaryIndex = index;
  });
  if (lastSummaryIndex < 0) return items;
  return items.filter((item, index) => !(item && item.type === "turnUsageSummary") || index === lastSummaryIndex);
}

function dedupeProjectionItems(items) {
  return dedupeProjectionUsageItems(dedupeProjectionUserMessages(items));
}

function isProjectionSupersededLiveTurn(turn) {
  return Boolean(turn && (turn.mobileSupersededLive || (turn.status && turn.status.mobileSupersededLive)));
}

function isProjectionReasoningItem(item) {
  return Boolean(item && item.type === "reasoning");
}

function isProjectionTurnUsageSummaryItem(item) {
  return Boolean(item && item.type === "turnUsageSummary");
}

function isProjectionOperationalItem(item) {
  return Boolean(item && [
    "commandExecution",
    "fileChange",
    "dynamicToolCall",
    "mcpToolCall",
  ].includes(String(item.type || "")));
}

function isProjectionAssistantReceiptItem(item) {
  if (!item || typeof item !== "object") return false;
  const type = String(item.type || "").toLowerCase();
  if (type === "agentmessage" || type === "plan") return true;
  if (type === "message") {
    const role = String(item.role || item.author || "").toLowerCase();
    return role === "assistant";
  }
  return false;
}

function isProjectionVisualReceiptItem(item) {
  return Boolean(item && (item.type === "imageView" || item.type === "imageGeneration"));
}

function isProjectionContextNoticeItem(item) {
  const type = String(item && item.type || "").toLowerCase();
  return Boolean(type && /context.*compaction|context.*compression|context_compaction|context_compression/.test(type));
}

function isProjectionImageUserMessagePart(part) {
  if (!part || typeof part !== "object") return false;
  const type = String(part.type || "");
  const url = projectionImageUrlValue(part);
  return type === "image"
    || type === "localImage"
    || type === "input_image"
    || type === "image_url"
    || /^data:image\//i.test(url)
    || /\.(?:png|jpe?g|webp|gif)(?:[?#].*)?$/i.test(String(part.path || url || ""));
}

function projectionUserMessageHasVisualAttachment(item) {
  if (!isProjectionUserMessage(item)) return false;
  return (Array.isArray(item.content) ? item.content : []).some(isProjectionImageUserMessagePart);
}

function isMeaningfulProjectionSupersededItem(item) {
  if (!item || typeof item !== "object") return false;
  if (projectionUserMessageHasVisualAttachment(item)) return true;
  if (isProjectionUserMessage(item)) return false;
  if (isProjectionReasoningItem(item)) return false;
  if (isProjectionTurnUsageSummaryItem(item)) return false;
  if (isProjectionOperationalItem(item)) return false;
  return isProjectionAssistantReceiptItem(item)
    || isProjectionVisualReceiptItem(item)
    || isProjectionContextNoticeItem(item);
}

function lastRespondedProjectionUserMessageIndexInSupersededLiveTurn(items) {
  if (!Array.isArray(items)) return -1;
  let lastUserIndex = -1;
  let lastRespondedUserIndex = -1;
  let hasPriorAssistantReceipt = false;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (isProjectionUserMessage(item) && !projectionUserMessageHasVisualAttachment(item)) {
      lastUserIndex = hasPriorAssistantReceipt ? index : -1;
      continue;
    }
    if (lastUserIndex >= 0 && isProjectionAssistantReceiptItem(item)) {
      lastRespondedUserIndex = lastUserIndex;
    }
    if (isProjectionAssistantReceiptItem(item)) hasPriorAssistantReceipt = true;
  }
  return lastRespondedUserIndex;
}

function normalizeProjectionSupersededLiveTurns(thread) {
  if (!thread || !Array.isArray(thread.turns)) return thread;
  thread.turns = thread.turns.filter((turn) => {
    if (!isProjectionSupersededLiveTurn(turn)) return true;
    const items = Array.isArray(turn.items) ? turn.items : [];
    const meaningful = items.filter(isMeaningfulProjectionSupersededItem);
    if (!meaningful.length) return false;
    const respondedUserIndex = lastRespondedProjectionUserMessageIndexInSupersededLiveTurn(items);
    turn.items = items.filter((item, index) => (!isProjectionUserMessage(item)
      || projectionUserMessageHasVisualAttachment(item)
      || index === respondedUserIndex)
      && !isProjectionReasoningItem(item));
    return true;
  });
  return thread;
}

function normalizeProjectionThreadUserMessages(thread) {
  if (!thread || !Array.isArray(thread.turns)) return thread;
  for (const turn of thread.turns) {
    if (!turn || !Array.isArray(turn.items)) continue;
    turn.items = dedupeProjectionItems(turn.items);
  }
  const durableUserMessages = [];
  for (let turnIndex = 0; turnIndex < thread.turns.length; turnIndex += 1) {
    const turn = thread.turns[turnIndex];
    const items = Array.isArray(turn && turn.items) ? turn.items : [];
    for (const item of items) {
      if (isProjectionUserMessage(item) && !isSyntheticProjectionUserMessage(item)) {
        durableUserMessages.push({ item, turnIndex });
      }
    }
  }
  if (!durableUserMessages.length) return thread;
  for (let turnIndex = 0; turnIndex < thread.turns.length; turnIndex += 1) {
    const turn = thread.turns[turnIndex];
    if (!turn || !Array.isArray(turn.items)) continue;
    turn.items = turn.items.filter((item) => !(isSyntheticProjectionUserMessage(item)
      && durableUserMessages.some((real) => real.turnIndex >= turnIndex
        && real.item.id !== item.id
        && projectionUserMessagesCanShadow(real.item, item))));
  }
  return thread;
}

function mergeProjectionItems(existingItems, incomingItems) {
  const existing = Array.isArray(existingItems) ? existingItems : [];
  const incoming = Array.isArray(incomingItems) ? incomingItems : [];
  if (!existing.length) return dedupeProjectionItems(incoming.map(cloneJson));
  if (!incoming.length) return dedupeProjectionItems(existing.map(cloneJson));

  const incomingById = new Map(incoming
    .filter((item) => itemId(item))
    .map((item) => [itemId(item), item]));
  const usedIncoming = new Set();
  const merged = [];
  for (const existingItem of existing) {
    const id = itemId(existingItem);
    const idMatch = id ? incomingById.get(id) : null;
    if (idMatch) {
      merged.push(mergeProjectionItem(existingItem, idMatch));
      usedIncoming.add(idMatch);
      continue;
    }
    const textMatch = incoming.find((incomingItem) => !usedIncoming.has(incomingItem)
      && textReceiptsLikelySame(existingItem, incomingItem));
    if (textMatch) {
      merged.push(mergeProjectionItem(existingItem, textMatch));
      usedIncoming.add(textMatch);
      continue;
    }
    merged.push(cloneJson(existingItem));
  }
  for (const incomingItem of incoming) {
    if (!usedIncoming.has(incomingItem)) merged.push(cloneJson(incomingItem));
  }
  return dedupeProjectionItems(merged);
}

function ensureTurn(thread, turnId, turnPatch = {}) {
  let turn = findTurn(thread, turnId);
  if (!turn) {
    turn = Object.assign({ id: turnId, items: [] }, turnPatch || {});
    if (!Array.isArray(turn.items)) turn.items = [];
    thread.turns.push(turn);
    return turn;
  }
  const existingItems = Array.isArray(turn.items) ? turn.items : [];
  const incomingHasItems = Array.isArray(turnPatch && turnPatch.items);
  Object.assign(turn, turnPatch || {});
  turn.items = incomingHasItems ? mergeProjectionItems(existingItems, turnPatch.items) : existingItems;
  return turn;
}

function upsertItem(turn, item) {
  if (!turn || !item || typeof item !== "object") return;
  if (!Array.isArray(turn.items)) turn.items = [];
  const id = itemId(item);
  if (isProjectionUserMessage(item)) {
    const userIndex = turn.items.findIndex((existing) => itemId(existing) !== id
      && projectionUserMessagesCanShadow(existing, item));
    if (userIndex >= 0) {
      turn.items[userIndex] = mergeProjectionUserMessage(turn.items[userIndex], item);
      turn.items = dedupeProjectionItems(turn.items);
      return;
    }
  }
  const index = id ? turn.items.findIndex((existing) => itemId(existing) === id) : -1;
  if (index >= 0) turn.items[index] = Object.assign({}, turn.items[index], item);
  else turn.items.push(cloneJson(item));
  turn.items = dedupeProjectionItems(turn.items);
}

function appendItemText(turn, itemIdValue, itemType, field, delta) {
  if (!turn || !itemIdValue || !delta) return;
  if (!Array.isArray(turn.items)) turn.items = [];
  let item = turn.items.find((candidate) => itemId(candidate) === itemIdValue);
  if (!item) {
    item = { id: itemIdValue, type: itemType };
    turn.items.push(item);
  }
  item.type = item.type || itemType;
  item[field] = `${String(item[field] || "")}${String(delta || "")}`;
}

function trimTurns(thread, maxTurns) {
  if (!thread || !Array.isArray(thread.turns)) return;
  const limit = Math.max(1, safeNumber(maxTurns) || 1);
  if (thread.turns.length > limit) thread.turns = thread.turns.slice(-limit);
}

function createThreadDetailProjectionService(options = {}) {
  const cacheDir = String(options.cacheDir || "").trim();
  const policyVersion = String(options.policyVersion || "1");
  const maxTurns = Math.max(1, safeNumber(options.maxTurns) || 10);
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const memory = new Map();

  function entryForThread(threadId) {
    const id = String(threadId || "").trim();
    return id ? memory.get(id) || null : null;
  }

  function persistEntry(entry) {
    if (!cacheDir || !entry || entry.partial || !entry.signatureHash) return false;
    writeJsonFile(cacheFileForThread(cacheDir, entry.threadId), {
      version: 1,
      policyVersion,
      threadId: entry.threadId,
      signature: entry.signature,
      signatureHash: entry.signatureHash,
      cachedAtMs: entry.cachedAtMs,
      result: entry.result,
    });
    return true;
  }

  function seed(input = {}, result) {
    const threadId = String(input.threadId || result && result.thread && result.thread.id || "").trim();
    if (!threadId || !result || typeof result !== "object" || !result.thread) return null;
    const signature = projectionSignature(Object.assign({}, input, { policyVersion, maxTurns }));
    const entry = {
      threadId,
      signature,
      signatureHash: signatureHash(signature),
      cachedAtMs: now(),
      updatedAtMs: now(),
      dynamic: false,
      partial: false,
      result: cloneJson(result),
    };
    normalizeProjectionThreadUserMessages(entry.result.thread);
    normalizeProjectionSupersededLiveTurns(entry.result.thread);
    trimTurns(entry.result.thread, maxTurns);
    memory.set(threadId, entry);
    persistEntry(entry);
    return {
      cachedAtMs: entry.cachedAtMs,
      dynamic: entry.dynamic,
      partial: entry.partial,
      signatureHash: entry.signatureHash,
    };
  }

  function readDisk(threadId) {
    if (!cacheDir || !threadId) return null;
    const raw = readJsonFile(cacheFileForThread(cacheDir, threadId));
    if (!raw || raw.version !== 1 || raw.policyVersion !== policyVersion || !raw.result) return null;
    const entry = {
      threadId,
      signature: raw.signature || null,
      signatureHash: String(raw.signatureHash || ""),
      cachedAtMs: safeNumber(raw.cachedAtMs),
      updatedAtMs: safeNumber(raw.cachedAtMs),
      dynamic: false,
      partial: false,
      result: raw.result,
    };
    memory.set(threadId, entry);
    return entry;
  }

  function get(input = {}) {
    const threadId = String(input.threadId || "").trim();
    if (!threadId) return null;
    const signature = projectionSignature(Object.assign({}, input, { policyVersion, maxTurns }));
    const expectedHash = signatureHash(signature);
    let entry = entryForThread(threadId);
    if (!entry) entry = readDisk(threadId);
    if (!entry || !entry.result || entry.partial) return null;

    const summaryUpdatedAtMs = safeNumber(input.summaryUpdatedAtMs);
    if (entry.dynamic) {
      if (summaryUpdatedAtMs && entry.updatedAtMs && summaryUpdatedAtMs > entry.updatedAtMs + 2000) return null;
    } else if (!expectedHash || entry.signatureHash !== expectedHash) {
      return null;
    }

    const result = cloneJson(entry.result);
    normalizeProjectionThreadUserMessages(result.thread);
    normalizeProjectionSupersededLiveTurns(result.thread);
    trimTurns(result.thread, maxTurns);
    return {
      cachedAtMs: entry.cachedAtMs,
      updatedAtMs: entry.updatedAtMs,
      dynamic: entry.dynamic,
      result,
    };
  }

  function forget(threadId) {
    const id = String(threadId || "").trim();
    if (!id) return false;
    memory.delete(id);
    if (cacheDir) {
      try {
        fs.rmSync(cacheFileForThread(cacheDir, id), { force: true });
      } catch (_) {}
    }
    return true;
  }

  function applyNotification(method, params = {}) {
    const threadId = notificationThreadId(method, params);
    if (!threadId) return false;
    let entry = entryForThread(threadId);
    if (!entry) {
      if (method !== "turn/started" && method !== "turn/completed") return false;
      entry = {
        threadId,
        signature: null,
        signatureHash: "",
        cachedAtMs: now(),
        updatedAtMs: now(),
        dynamic: true,
        partial: true,
        result: { thread: { id: threadId, turns: [] } },
      };
      memory.set(threadId, entry);
    }

    const thread = ensureThread(entry.result, threadId);
    if (method === "thread/name/updated") {
      if (params.name) thread.name = params.name;
      if (params.preview) thread.preview = params.preview;
    } else if (method === "thread/status/changed") {
      if (params.status) thread.status = params.status;
    } else if (method === "turn/started" || method === "turn/completed") {
      const turn = params.turn && typeof params.turn === "object" ? cloneJson(params.turn) : { id: turnIdFromParams(params) };
      if (turn && turn.id) ensureTurn(thread, String(turn.id), turn);
      if (method === "turn/started") thread.status = { type: "active" };
      if (method === "turn/completed") thread.status = turn.status || params.status || { type: "completed" };
    } else if (method === "item/started" || method === "item/completed") {
      const turnId = turnIdFromParams(params);
      if (turnId && params.item) upsertItem(ensureTurn(thread, turnId), params.item);
    } else if (method === "item/agentMessage/delta") {
      const turnId = turnIdFromParams(params);
      if (turnId) appendItemText(ensureTurn(thread, turnId), String(params.itemId || ""), "agentMessage", "text", params.delta || "");
    } else if (method === "item/reasoning/textDelta" || method === "item/reasoning/summaryTextDelta") {
      const turnId = turnIdFromParams(params);
      if (turnId) appendItemText(ensureTurn(thread, turnId), String(params.itemId || ""), "reasoning", "text", params.delta || "");
    } else if (method === "item/commandExecution/outputDelta") {
      const turnId = turnIdFromParams(params);
      if (turnId) appendItemText(ensureTurn(thread, turnId), String(params.itemId || ""), "commandExecution", "aggregatedOutput", params.delta || "");
    } else if (method === "item/fileChange/outputDelta") {
      const turnId = turnIdFromParams(params);
      if (turnId) appendItemText(ensureTurn(thread, turnId), String(params.itemId || ""), "fileChange", "aggregatedOutput", params.delta || "");
    }
    normalizeProjectionThreadUserMessages(thread);
    normalizeProjectionSupersededLiveTurns(thread);
    trimTurns(thread, maxTurns);
    entry.updatedAtMs = now();
    entry.dynamic = true;
    return true;
  }

  return {
    applyNotification,
    forget,
    get,
    projectionSignature,
    seed,
  };
}

module.exports = {
  createThreadDetailProjectionService,
  projectionSignature,
  signatureHash,
};
