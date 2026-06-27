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

function isRestingStatus(value) {
  const status = normalizeStatus(value).replace(/[_\s]+/g, "-");
  return /^(idle|completed|complete|success|succeeded|failed|failure|cancelled|canceled|interrupted|error)$/.test(status);
}

function isActiveLikeStatus(value) {
  const status = normalizeStatus(value).replace(/[_\s]+/g, "-");
  return /^(active|running|started|pending|queued|processing|inprogress|in-progress)$/i.test(status);
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

function dynamicBackingSignatureChanged(left, right) {
  if (!left || !right) return false;
  return String(left.policyVersion || "") !== String(right.policyVersion || "")
    || String(left.threadId || "") !== String(right.threadId || "")
    || String(left.rolloutPathHash || "") !== String(right.rolloutPathHash || "")
    || safeNumber(left.rolloutSizeBytes) !== safeNumber(right.rolloutSizeBytes)
    || safeNumber(left.rolloutMtimeMs) !== safeNumber(right.rolloutMtimeMs)
    || safeNumber(left.maxTurns) !== safeNumber(right.maxTurns);
}

function activeOverlayHistorySignatureMatches(left, right) {
  if (!left || !right) return false;
  return String(left.policyVersion || "") === String(right.policyVersion || "")
    && String(left.threadId || "") === String(right.threadId || "")
    && String(left.rolloutPathHash || "") === String(right.rolloutPathHash || "")
    && safeNumber(left.maxTurns) === safeNumber(right.maxTurns);
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

const STALE_FULL_MISS_REASONS = new Set([
  "dynamic-summary-stale",
  "static-signature-mismatch",
  "dynamic-resting-signature-mismatch",
  "dynamic-age-signature-mismatch",
]);

function rolloutPathForEntry(entry) {
  return String(entry && (entry.rolloutPath
    || entry.result && entry.result.thread && (
      entry.result.thread.path
      || entry.result.thread.rolloutPath
      || entry.result.thread.rollout_path
    )
  ) || "").trim();
}

function rolloutStatsForPath(rolloutPath) {
  const filePath = String(rolloutPath || "").trim();
  if (!filePath) return null;
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    return {
      sizeBytes: stat.size,
      mtimeMs: Math.trunc(Number(stat.mtimeMs || 0)),
    };
  } catch (_) {
    return null;
  }
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

function turnId(turn) {
  return String(turn && (turn.id || turn.turnId || turn.turn_id) || "").trim();
}

function cloneProjectionResultForLookup(result, options = {}) {
  const omittedTurnId = String(options.omitActiveTurnId || "").trim();
  if (!omittedTurnId || !result || !result.thread || !Array.isArray(result.thread.turns)) {
    return cloneJson(result);
  }
  const thread = result.thread;
  const cloned = cloneJson(Object.assign({}, result, {
    thread: Object.assign({}, thread, { turns: [] }),
  }));
  cloned.thread.turns = thread.turns
    .filter((turn) => turnId(turn) !== omittedTurnId)
    .map((turn) => cloneJson(turn));
  return cloned;
}

function shouldUseStaleFullAsActiveOverlayWindow(entry, signature, input = {}, optionsForGet = {}) {
  const omittedTurnId = String(optionsForGet.omitActiveTurnId || "").trim();
  return Boolean(
    optionsForGet.activeOverlay === true
      && optionsForGet.allowPartial === true
      && omittedTurnId
      && entry
      && entry.partial !== true
      && entry.result
      && entry.result.thread
      && isActiveLikeStatus(input.summaryStatus)
      && activeOverlayHistorySignatureMatches(entry.signature, signature),
  );
}

function staleFullActiveOverlayWindow(entry, optionsForGet = {}) {
  const omittedTurnId = String(optionsForGet.omitActiveTurnId || "").trim();
  if (omittedTurnId && !findTurn(entry && entry.result && entry.result.thread, omittedTurnId)) return null;
  const result = cloneProjectionResultForLookup(entry && entry.result, optionsForGet);
  const thread = result && result.thread;
  if (!thread || !Array.isArray(thread.turns) || !thread.turns.length) return null;
  normalizeProjectionThreadUserMessages(thread);
  normalizeProjectionSupersededLiveTurns(thread);
  thread.mobileReadMode = "projection-active-window";
  thread.mobileProjection = Object.assign({}, thread.mobileProjection || {}, {
    source: entry.dynamic ? "dynamic" : "cache",
    version: "active-window",
    partial: true,
    partialKind: "turns-list-active-overlay-window",
    activeOverlayWindow: true,
    staleFullWindow: true,
    staleFullHistoryBaseline: entry.historyBaseline === true,
  });
  return {
    cached: {
      cachedAtMs: entry.cachedAtMs,
      updatedAtMs: entry.updatedAtMs,
      dynamic: entry.dynamic,
      partial: true,
      partialKind: "turns-list-active-overlay-window",
      result,
    },
    missReason: "",
  };
}

function inferredActiveTurnId(thread) {
  if (!thread || typeof thread !== "object") return "";
  const explicit = String(thread.activeTurnId || thread.active_turn_id || "").trim();
  if (explicit) return explicit;
  const turns = Array.isArray(thread.turns) ? thread.turns : [];
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    const id = turnId(turn);
    if (id && isActiveLikeStatus(turn && turn.status)) return id;
  }
  if (!isActiveLikeStatus(thread.status)) return "";
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    const id = turnId(turn);
    if (!id || isRestingStatus(turn && turn.status)) continue;
    if (Array.isArray(turn.items) && turn.items.length > 0) return id;
  }
  return "";
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

function isMeaningfulProjectionSupersededItem(item) {
  if (!item || typeof item !== "object") return false;
  if (isProjectionUserMessage(item)) return false;
  if (isProjectionReasoningItem(item)) return false;
  if (isProjectionTurnUsageSummaryItem(item)) return false;
  if (isProjectionOperationalItem(item)) return false;
  return isProjectionAssistantReceiptItem(item)
    || isProjectionVisualReceiptItem(item)
    || isProjectionContextNoticeItem(item);
}

function normalizeProjectionSupersededLiveTurns(thread) {
  if (!thread || !Array.isArray(thread.turns)) return thread;
  thread.turns = thread.turns.filter((turn) => {
    if (!isProjectionSupersededLiveTurn(turn)) return true;
    const items = Array.isArray(turn.items) ? turn.items : [];
    const meaningful = items.filter(isMeaningfulProjectionSupersededItem);
    if (!meaningful.length) return false;
    turn.items = items.filter((item) => !isProjectionUserMessage(item) && !isProjectionReasoningItem(item));
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

function hasCursor(value) {
  return Boolean(String(value || "").trim());
}

function threadReadMode(thread) {
  return String(thread && thread.mobileReadMode || "").trim();
}

function isTurnsListWindowThread(thread) {
  if (!thread || typeof thread !== "object") return false;
  const mode = threadReadMode(thread);
  if (!/^turns-list(?:-|$)/.test(mode)) return false;
  return hasCursor(thread.mobileOlderTurnsCursor) || hasCursor(thread.mobileNewerTurnsCursor);
}

function isNonFullWindowThread(thread) {
  if (!thread || typeof thread !== "object") return false;
  if (hasCursor(thread.mobileNewerTurnsCursor)) return true;
  return isTurnsListWindowThread(thread);
}

function partialKindForWindowThread(thread, fallback = "recent-window") {
  const mode = threadReadMode(thread);
  if (mode === "turns-list-large") return "turns-list-window";
  if (mode === "turns-list") return "turns-list-window";
  return String(fallback || "recent-window").slice(0, 80);
}

function markWindowEntryPartial(entry, kind = "") {
  if (!entry || !entry.result || !entry.result.thread) return false;
  if (!isNonFullWindowThread(entry.result.thread)) return false;
  entry.partial = true;
  entry.partialKind = partialKindForWindowThread(entry.result.thread, kind || entry.partialKind || "recent-window");
  return true;
}

function createThreadDetailProjectionService(options = {}) {
  const cacheDir = String(options.cacheDir || "").trim();
  const policyVersion = String(options.policyVersion || "1");
  const maxTurns = Math.max(1, safeNumber(options.maxTurns) || 10);
  const dynamicSignatureMismatchMaxAgeMs = Math.max(1000, safeNumber(options.dynamicSignatureMismatchMaxAgeMs) || 15000);
  const dynamicPersistMinIntervalMs = options.dynamicPersistMinIntervalMs === undefined
    ? 1000
    : Math.max(0, safeNumber(options.dynamicPersistMinIntervalMs));
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const memory = new Map();
  const fullHistory = new Map();

  function entryForThread(threadId) {
    const id = String(threadId || "").trim();
    return id ? memory.get(id) || null : null;
  }

  function isReusableFullEntry(entry) {
    return Boolean(
      entry
        && entry.partial !== true
        && entry.signatureHash
        && entry.result
        && entry.result.thread
        && !isNonFullWindowThread(entry.result.thread),
    );
  }

  function cloneEntry(entry, overrides = {}) {
    return Object.assign({
      threadId: entry.threadId,
      rolloutPath: entry.rolloutPath || "",
      signature: entry.signature ? cloneJson(entry.signature) : null,
      signatureHash: entry.signatureHash || "",
      cachedAtMs: safeNumber(entry.cachedAtMs),
      updatedAtMs: safeNumber(entry.updatedAtMs || entry.cachedAtMs),
      lastPersistedAtMs: safeNumber(entry.lastPersistedAtMs || entry.updatedAtMs || entry.cachedAtMs),
      dynamic: Boolean(entry.dynamic),
      partial: Boolean(entry.partial),
      partialKind: String(entry.partialKind || ""),
      result: cloneJson(entry.result),
    }, overrides);
  }

  function rememberFullHistoryEntry(entry) {
    if (!isReusableFullEntry(entry)) return false;
    fullHistory.set(entry.threadId, cloneEntry(entry, { historyBaseline: true }));
    return true;
  }

  function persistEntry(entry) {
    if (!cacheDir || !entry || !entry.signatureHash) return false;
    writeJsonFile(cacheFileForThread(cacheDir, entry.threadId), {
      version: 1,
      policyVersion,
      threadId: entry.threadId,
      rolloutPath: entry.rolloutPath || rolloutPathForEntry(entry),
      signature: entry.signature,
      signatureHash: entry.signatureHash,
      cachedAtMs: entry.cachedAtMs,
      updatedAtMs: entry.updatedAtMs,
      dynamic: Boolean(entry.dynamic),
      partial: Boolean(entry.partial),
      partialKind: String(entry.partialKind || ""),
      result: entry.result,
    });
    return true;
  }

  function removePersistedEntry(threadId) {
    const id = String(threadId || "").trim();
    if (!id || !cacheDir) return false;
    try {
      fs.rmSync(cacheFileForThread(cacheDir, id), { force: true });
      return true;
    } catch (_) {
      return false;
    }
  }

  function refreshEntrySignatureFromRollout(entry) {
    if (!entry || !entry.signature) return false;
    const rolloutPath = rolloutPathForEntry(entry);
    const stats = rolloutStatsForPath(rolloutPath);
    if (!stats) return false;
    const rolloutPathHash = hashText(path.resolve(rolloutPath));
    if (entry.signature.rolloutPathHash && entry.signature.rolloutPathHash !== rolloutPathHash) return false;
    entry.rolloutPath = rolloutPath;
    entry.signature = Object.assign({}, entry.signature, {
      rolloutPathHash,
      rolloutSizeBytes: safeNumber(stats.sizeBytes),
      rolloutMtimeMs: safeNumber(stats.mtimeMs),
    });
    entry.signatureHash = signatureHash(entry.signature);
    return true;
  }

  function shouldForceDynamicPersist(method) {
    return method === "thread/name/updated"
      || method === "thread/status/changed"
      || method === "turn/completed"
      || method === "item/completed";
  }

  function persistDynamicEntry(entry, method) {
    if (!entry || entry.partial || !entry.signatureHash || !cacheDir) return false;
    const current = safeNumber(entry.updatedAtMs) || now();
    const force = shouldForceDynamicPersist(method);
    const lastPersistedAtMs = safeNumber(entry.lastPersistedAtMs || entry.cachedAtMs);
    if (!force && dynamicPersistMinIntervalMs > 0
      && lastPersistedAtMs && current - lastPersistedAtMs < dynamicPersistMinIntervalMs) {
      return false;
    }
    refreshEntrySignatureFromRollout(entry);
    if (persistEntry(entry)) {
      entry.lastPersistedAtMs = current;
      return true;
    }
    return false;
  }

  function persistedEntryForThread(threadId) {
    if (!cacheDir || !threadId) return null;
    const raw = readJsonFile(cacheFileForThread(cacheDir, threadId));
    if (!raw || raw.version !== 1 || raw.policyVersion !== policyVersion || !raw.result) return null;
    const entry = {
      threadId,
      rolloutPath: String(raw.rolloutPath || "").trim(),
      signature: raw.signature || null,
      signatureHash: String(raw.signatureHash || ""),
      cachedAtMs: safeNumber(raw.cachedAtMs),
      updatedAtMs: safeNumber(raw.updatedAtMs || raw.cachedAtMs),
      lastPersistedAtMs: safeNumber(raw.updatedAtMs || raw.cachedAtMs),
      dynamic: Boolean(raw.dynamic),
      partial: Boolean(raw.partial),
      partialKind: String(raw.partialKind || ""),
      result: raw.result,
    };
    if (entry.partial && !entry.signatureHash) {
      removePersistedEntry(threadId);
      return null;
    }
    markWindowEntryPartial(entry);
    return entry;
  }

  function fullHistoryEntryForThread(threadId) {
    const id = String(threadId || "").trim();
    if (!id) return null;
    const entry = fullHistory.get(id);
    if (entry) return entry;
    const persisted = persistedEntryForThread(id);
    if (!persisted) return null;
    rememberFullHistoryEntry(persisted);
    return fullHistory.get(id) || null;
  }

  function staleFullHistoryWindowForLookup(threadId, signature, input = {}, optionsForGet = {}) {
    const entry = fullHistoryEntryForThread(threadId);
    if (!shouldUseStaleFullAsActiveOverlayWindow(entry, signature, input, optionsForGet)) return null;
    return staleFullActiveOverlayWindow(entry, optionsForGet);
  }

  function seed(input = {}, result, optionsForSeed = {}) {
    const threadId = String(input.threadId || result && result.thread && result.thread.id || "").trim();
    if (!threadId || !result || typeof result !== "object" || !result.thread) return null;
    const signature = projectionSignature(Object.assign({}, input, { policyVersion, maxTurns }));
    const existing = entryForThread(threadId);
    const explicitPartial = optionsForSeed.partial === true;
    const windowPartial = isNonFullWindowThread(result.thread);
    const partial = explicitPartial || windowPartial;
    const partialKind = partial
      ? partialKindForWindowThread(result.thread, optionsForSeed.partialKind || "recent-window")
      : "";
    let replacedStaleFull = false;
    let staleFullReason = "";
    if (partial && existing && !existing.partial) {
      const reusableFullLookup = lookup(input);
      if (reusableFullLookup.cached && reusableFullLookup.cached.partial !== true) {
        return {
          cachedAtMs: existing.cachedAtMs,
          dynamic: existing.dynamic,
          partial: false,
          signatureHash: existing.signatureHash,
          skipped: true,
          reason: "full-cache-exists",
        };
      }
      staleFullReason = reusableFullLookup.missReason || "";
      if (STALE_FULL_MISS_REASONS.has(staleFullReason)) {
        replacedStaleFull = true;
        fullHistory.delete(threadId);
        removePersistedEntry(threadId);
      }
    }
    const entry = {
      threadId,
      rolloutPath: String(input.rolloutPath || "").trim(),
      signature,
      signatureHash: signatureHash(signature),
      cachedAtMs: now(),
      updatedAtMs: now(),
      lastPersistedAtMs: 0,
      dynamic: false,
      partial,
      partialKind,
      result: cloneJson(result),
    };
    normalizeProjectionThreadUserMessages(entry.result.thread);
    normalizeProjectionSupersededLiveTurns(entry.result.thread);
    trimTurns(entry.result.thread, maxTurns);
    memory.set(threadId, entry);
    rememberFullHistoryEntry(entry);
    persistEntry(entry);
    return {
      cachedAtMs: entry.cachedAtMs,
      dynamic: entry.dynamic,
      partial: entry.partial,
      partialKind: entry.partialKind || "",
      replacedStaleFull,
      signatureHash: entry.signatureHash,
      staleFullReason,
    };
  }

  function readDisk(threadId) {
    const entry = persistedEntryForThread(threadId);
    if (!entry) return null;
    memory.set(threadId, entry);
    rememberFullHistoryEntry(entry);
    return entry;
  }

  function stalePartialWindowForLookup(entry, optionsForGet = {}) {
    if (!entry || entry.partial !== true || optionsForGet.allowStalePartial !== true) return null;
    const result = cloneProjectionResultForLookup(entry.result, optionsForGet);
    normalizeProjectionThreadUserMessages(result.thread);
    normalizeProjectionSupersededLiveTurns(result.thread);
    trimTurns(result.thread, maxTurns);
    return {
      cached: {
        cachedAtMs: entry.cachedAtMs,
        updatedAtMs: entry.updatedAtMs,
        dynamic: entry.dynamic,
        partial: true,
        partialKind: entry.partialKind || "",
        stalePartial: true,
        staleReason: "backing-signature-mismatch",
        result,
      },
      missReason: "",
    };
  }

  function lookup(input = {}, optionsForGet = {}) {
    const threadId = String(input.threadId || "").trim();
    if (!threadId) return { cached: null, missReason: "missing-thread-id" };
    const signature = projectionSignature(Object.assign({}, input, { policyVersion, maxTurns }));
    const expectedHash = signatureHash(signature);
    let entry = entryForThread(threadId);
    if (!entry) entry = readDisk(threadId);
    if (!entry) return { cached: null, missReason: "entry-missing" };
    if (!entry.result) return { cached: null, missReason: "entry-empty" };
    if (!entry.partial && markWindowEntryPartial(entry)) removePersistedEntry(threadId);

    const summaryUpdatedAtMs = safeNumber(input.summaryUpdatedAtMs);
    const activeOverlayStaleWindowAllowed = shouldUseStaleFullAsActiveOverlayWindow(entry, signature, input, optionsForGet);
    const activeOverlayFullHistoryWindow = () => staleFullHistoryWindowForLookup(threadId, signature, input, optionsForGet);
    if (entry.partial && !entry.signatureHash) {
      const staleWindow = activeOverlayFullHistoryWindow();
      if (staleWindow) return staleWindow;
      return { cached: null, missReason: "partial-not-seeded" };
    }
    if (entry.partial && optionsForGet.allowPartial !== true) return { cached: null, missReason: "partial-not-allowed" };
    if (entry.partial && !entry.dynamic) {
      if (!signature || !entry.signature) return { cached: null, missReason: "signature-unavailable" };
      if (dynamicBackingSignatureChanged(entry.signature, signature)) {
        const staleWindow = activeOverlayStaleWindowAllowed ? staleFullActiveOverlayWindow(entry, optionsForGet) : null;
        if (staleWindow) return staleWindow;
        const historyWindow = activeOverlayFullHistoryWindow();
        if (historyWindow) return historyWindow;
        const stalePartial = stalePartialWindowForLookup(entry, optionsForGet);
        if (stalePartial) return stalePartial;
        return { cached: null, missReason: "static-signature-mismatch" };
      }
    } else if (entry.dynamic) {
      const allowActiveOverlaySummaryStaleWindow = optionsForGet.activeOverlay === true
        && optionsForGet.allowPartial === true
        && isActiveLikeStatus(input.summaryStatus);
      const backingSignatureChanged = dynamicBackingSignatureChanged(entry.signature, signature);
      if (!allowActiveOverlaySummaryStaleWindow
        && summaryUpdatedAtMs
        && entry.updatedAtMs
        && summaryUpdatedAtMs > entry.updatedAtMs + 2000
        && backingSignatureChanged) {
        const staleWindow = activeOverlayStaleWindowAllowed ? staleFullActiveOverlayWindow(entry, optionsForGet) : null;
        if (staleWindow) return staleWindow;
        const historyWindow = activeOverlayFullHistoryWindow();
        if (historyWindow) return historyWindow;
        const stalePartial = stalePartialWindowForLookup(entry, optionsForGet);
        if (stalePartial) return stalePartial;
        return { cached: null, missReason: "dynamic-summary-stale" };
      }
      if (backingSignatureChanged) {
        const dynamicAgeMs = Math.max(0, now() - safeNumber(entry.updatedAtMs || entry.cachedAtMs));
        if (isRestingStatus(input.summaryStatus)) {
          const staleWindow = activeOverlayStaleWindowAllowed ? staleFullActiveOverlayWindow(entry, optionsForGet) : null;
          if (staleWindow) return staleWindow;
          const historyWindow = activeOverlayFullHistoryWindow();
          if (historyWindow) return historyWindow;
          const stalePartial = stalePartialWindowForLookup(entry, optionsForGet);
          if (stalePartial) return stalePartial;
          return { cached: null, missReason: "dynamic-resting-signature-mismatch" };
        }
        if (dynamicAgeMs > dynamicSignatureMismatchMaxAgeMs) {
          const staleWindow = activeOverlayStaleWindowAllowed ? staleFullActiveOverlayWindow(entry, optionsForGet) : null;
          if (staleWindow) return staleWindow;
          const historyWindow = activeOverlayFullHistoryWindow();
          if (historyWindow) return historyWindow;
          const stalePartial = stalePartialWindowForLookup(entry, optionsForGet);
          if (stalePartial) return stalePartial;
          return { cached: null, missReason: "dynamic-age-signature-mismatch" };
        }
      }
    } else if (!expectedHash) {
      return { cached: null, missReason: "signature-unavailable" };
    } else if (entry.signatureHash !== expectedHash) {
      const staleWindow = activeOverlayStaleWindowAllowed ? staleFullActiveOverlayWindow(entry, optionsForGet) : null;
      if (staleWindow) return staleWindow;
      const historyWindow = activeOverlayFullHistoryWindow();
      if (historyWindow) return historyWindow;
      return { cached: null, missReason: "static-signature-mismatch" };
    }

    const result = cloneProjectionResultForLookup(entry.result, optionsForGet);
    normalizeProjectionThreadUserMessages(result.thread);
    normalizeProjectionSupersededLiveTurns(result.thread);
    trimTurns(result.thread, maxTurns);
    return {
      cached: {
        cachedAtMs: entry.cachedAtMs,
        updatedAtMs: entry.updatedAtMs,
        dynamic: entry.dynamic,
        partial: entry.partial === true,
        partialKind: entry.partialKind || "",
        result,
      },
      missReason: "",
    };
  }

  function get(input = {}, optionsForGet = {}) {
    const result = lookup(input, optionsForGet);
    return result.cached;
  }

  function activeOverlaySnapshot(input = {}) {
    const threadId = String(input.threadId || "").trim();
    if (!threadId) return { found: false, reason: "missing-thread-id" };
    const entry = entryForThread(threadId);
    if (!entry) return { found: false, reason: "entry-missing" };
    if (!entry.dynamic) return { found: false, reason: "entry-not-dynamic" };
    const thread = entry.result && entry.result.thread;
    if (!thread || typeof thread !== "object") return { found: false, reason: "thread-missing" };
    const activeTurnId = String(input.activeTurnId || input.turnId || inferredActiveTurnId(thread)).trim();
    if (!activeTurnId) return { found: false, reason: "missing-active-turn-id" };
    const overlayTurn = findTurn(thread, activeTurnId);
    if (!overlayTurn) return { found: false, reason: "active-turn-missing" };
    const cloneOverlayTurn = input.cloneOverlayTurn !== false;
    return {
      found: true,
      threadId,
      activeTurnId,
      overlaySource: "projection-live",
      overlayTurn: cloneOverlayTurn ? cloneJson(overlayTurn) : overlayTurn,
      cachedAtMs: safeNumber(entry.cachedAtMs),
      updatedAtMs: safeNumber(entry.updatedAtMs),
      dynamic: Boolean(entry.dynamic),
      partial: Boolean(entry.partial),
      partialKind: String(entry.partialKind || ""),
      signatureHashPresent: Boolean(entry.signatureHash),
    };
  }

  function forget(threadId) {
    const id = String(threadId || "").trim();
    if (!id) return false;
    memory.delete(id);
    fullHistory.delete(id);
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
    if (!entry || (entry.partial && !entry.signatureHash)) {
      const persisted = persistedEntryForThread(threadId);
      if (persisted) {
        entry = persisted;
        memory.set(threadId, entry);
        rememberFullHistoryEntry(entry);
      }
    }
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
        partialKind: "notification-shell",
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
      if (method === "turn/started") {
        thread.status = { type: "active" };
        if (turn && turn.id) thread.activeTurnId = String(turn.id);
      }
      if (method === "turn/completed") {
        thread.status = turn.status || params.status || { type: "completed" };
        if (turn && turn.id && String(thread.activeTurnId || "") === String(turn.id)) delete thread.activeTurnId;
      }
    } else if (method === "item/started" || method === "item/completed") {
      const turnId = turnIdFromParams(params);
      if (turnId && params.item) {
        if (isActiveLikeStatus(thread.status)) thread.activeTurnId = turnId;
        upsertItem(ensureTurn(thread, turnId), params.item);
      }
    } else if (method === "item/agentMessage/delta") {
      const turnId = turnIdFromParams(params);
      if (turnId) {
        if (isActiveLikeStatus(thread.status)) thread.activeTurnId = turnId;
        appendItemText(ensureTurn(thread, turnId), String(params.itemId || ""), "agentMessage", "text", params.delta || "");
      }
    } else if (method === "item/reasoning/textDelta" || method === "item/reasoning/summaryTextDelta") {
      const turnId = turnIdFromParams(params);
      if (turnId) {
        if (isActiveLikeStatus(thread.status)) thread.activeTurnId = turnId;
        appendItemText(ensureTurn(thread, turnId), String(params.itemId || ""), "reasoning", "text", params.delta || "");
      }
    } else if (method === "item/commandExecution/outputDelta") {
      const turnId = turnIdFromParams(params);
      if (turnId) {
        if (isActiveLikeStatus(thread.status)) thread.activeTurnId = turnId;
        appendItemText(ensureTurn(thread, turnId), String(params.itemId || ""), "commandExecution", "aggregatedOutput", params.delta || "");
      }
    } else if (method === "item/fileChange/outputDelta") {
      const turnId = turnIdFromParams(params);
      if (turnId) {
        if (isActiveLikeStatus(thread.status)) thread.activeTurnId = turnId;
        appendItemText(ensureTurn(thread, turnId), String(params.itemId || ""), "fileChange", "aggregatedOutput", params.delta || "");
      }
    }
    normalizeProjectionThreadUserMessages(thread);
    normalizeProjectionSupersededLiveTurns(thread);
    trimTurns(thread, maxTurns);
    entry.updatedAtMs = now();
    entry.dynamic = true;
    rememberFullHistoryEntry(entry);
    markWindowEntryPartial(entry);
    refreshEntrySignatureFromRollout(entry);
    persistDynamicEntry(entry, method);
    return true;
  }

  return {
    activeOverlaySnapshot,
    applyNotification,
    forget,
    get,
    lookup,
    projectionSignature,
    seed,
  };
}

module.exports = {
  createThreadDetailProjectionService,
  projectionSignature,
  signatureHash,
};
