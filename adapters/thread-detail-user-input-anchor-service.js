"use strict";

const DEFAULT_TEXT_LIMIT = 8192;
const DEFAULT_MAX_ANCHORS_PER_TURN = 4;
const SAME_INPUT_DEDUPE_WINDOW_MS = 5000;

function text(value) {
  return String(value || "").trim();
}

function stableHash(value) {
  const crypto = require("node:crypto");
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}

function timestampToMs(value) {
  if (!value) return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? Math.trunc(value) : Math.trunc(value * 1000);
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function rolloutEntryTurnId(entry = {}) {
  const payload = entry && entry.payload && typeof entry.payload === "object" ? entry.payload : {};
  return text(
    payload.turn_id
      || payload.turnId
      || entry.turn_id
      || entry.turnId
      || payload.turn && (payload.turn.id || payload.turn.turn_id),
  );
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

function rolloutMessageText(payload = {}) {
  return rolloutContentText(payload.content || payload.message || payload.text || payload.input || payload.input_text);
}

function isInternalEnvironmentContextText(value) {
  return /^<environment_context>[\s\S]*<\/environment_context>$/.test(text(value));
}

function rolloutContentHasNonTextInput(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.some(rolloutContentHasNonTextInput);
  if (typeof value !== "object") return false;
  const type = text(value.type).toLowerCase();
  if (/^(input_)?(image|file|audio|video)|localimage|localfile|image_url|input_image$/.test(type)) return true;
  if (value.image_url || value.imageUrl || value.file_id || value.fileId || value.path || value.url) return true;
  return rolloutContentHasNonTextInput(value.content || value.message || value.input || null);
}

function rolloutMessageHasNonTextInput(payload = {}) {
  return rolloutContentHasNonTextInput(payload.content || payload.message || payload.input || payload.attachments || payload.files || payload.images);
}

function isUserInputEntry(entry = {}) {
  const payload = entry && entry.payload && typeof entry.payload === "object" ? entry.payload : {};
  if (entry.type === "event_msg" && text(payload.type).toLowerCase() === "user_message") return true;
  if (entry.type === "response_item"
    && text(payload.type).toLowerCase() === "message"
    && text(payload.role).toLowerCase() === "user") {
    return !isInternalEnvironmentContextText(rolloutMessageText(payload));
  }
  return false;
}

function timestampFields(entry = {}) {
  const timestampMs = timestampToMs(entry.timestamp || entry.payload && entry.payload.timestamp);
  if (!timestampMs) return {};
  return {
    startedAtMs: timestampMs,
    startedAt: new Date(timestampMs).toISOString(),
  };
}

function comparableAnchorText(item = {}) {
  const parts = [];
  if (typeof item.text === "string") parts.push(item.text);
  if (typeof item.message === "string") parts.push(item.message);
  const contentText = rolloutContentText(item.content || item.input || item.input_text);
  if (contentText) parts.push(contentText);
  return text(parts.join("\n")).replace(/\s+/g, " ");
}

function userInputAnchorsLikelySame(left = {}, right = {}) {
  const leftText = comparableAnchorText(left);
  const rightText = comparableAnchorText(right);
  if (!leftText || !rightText || leftText !== rightText) return false;
  const leftTimestamp = displayTimestampMs(left);
  const rightTimestamp = displayTimestampMs(right);
  if (leftTimestamp && rightTimestamp) {
    return Math.abs(leftTimestamp - rightTimestamp) <= SAME_INPUT_DEDUPE_WINDOW_MS;
  }
  const leftId = text(left.id || left.itemId || left.item_id);
  const rightId = text(right.id || right.itemId || right.item_id);
  return Boolean(leftId && rightId && leftId === rightId);
}

function userInputAnchorItem(entry = {}, turnId = "", index = 0, options = {}) {
  const payload = entry && entry.payload && typeof entry.payload === "object" ? entry.payload : {};
  const limit = Math.max(256, Number(options.textLimit || DEFAULT_TEXT_LIMIT) || DEFAULT_TEXT_LIMIT);
  const rawText = rolloutMessageText(payload).replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/ig, "[inline image omitted]");
  const clippedText = rawText.length > limit ? rawText.slice(0, limit) : rawText;
  const hasNonTextInput = rolloutMessageHasNonTextInput(payload);
  const textValue = clippedText || (hasNonTextInput ? "[non-text input omitted]" : "[user input]");
  const payloadId = text(payload.id || payload.item_id || payload.itemId);
  return {
    id: payloadId || `mobile-user-input-anchor-${turnId || "unscoped"}-${index}-${stableHash(textValue)}`,
    type: "userMessage",
    text: textValue,
    source: "rollout_user_input_anchor",
    mobileSyntheticUserInputAnchor: true,
    mobileInputAnchorTruncated: rawText.length > clippedText.length,
    mobileInputAnchorHasNonTextInput: hasNonTextInput,
    ...timestampFields(entry),
  };
}

function collectRolloutUserInputAnchors(entries = [], options = {}) {
  const byTurn = new Map();
  const maxPerTurn = Math.max(1, Number(options.maxPerTurn || DEFAULT_MAX_ANCHORS_PER_TURN) || DEFAULT_MAX_ANCHORS_PER_TURN);
  let currentTurnId = "";
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry || !entry.type) continue;
    const payload = entry.payload && typeof entry.payload === "object" ? entry.payload : {};
    const explicitTurnId = rolloutEntryTurnId(entry);
    if (entry.type === "turn_context" && explicitTurnId) currentTurnId = explicitTurnId;
    if (entry.type === "event_msg" && payload.type === "task_started" && explicitTurnId) currentTurnId = explicitTurnId;
    if (!isUserInputEntry(entry)) continue;
    const turnId = explicitTurnId || currentTurnId;
    if (!turnId) continue;
    if (!byTurn.has(turnId)) byTurn.set(turnId, []);
    const list = byTurn.get(turnId);
    const anchor = userInputAnchorItem(entry, turnId, list.length, options);
    if (list.some((existing) => userInputAnchorsLikelySame(existing, anchor))) continue;
    list.push(anchor);
    if (list.length > maxPerTurn) list.splice(0, list.length - maxPerTurn);
  }
  return { byTurn, scopedCount: Array.from(byTurn.values()).reduce((sum, list) => sum + list.length, 0) };
}

function itemType(item = {}) {
  return text(item.type || item.kind || item.itemType).toLowerCase();
}

function isUserInputItem(item = {}) {
  const type = itemType(item);
  if (type === "usermessage") return true;
  if (type === "message" && text(item.role).toLowerCase() === "user") return true;
  return /context.*compaction|context.*compression|context_compaction|context_compression/.test(type);
}

function isAssistantOrUsageItem(item = {}) {
  const type = itemType(item);
  if (type === "agentmessage" || type === "plan" || type === "turnusagesummary") return true;
  return type === "message" && text(item.role).toLowerCase() === "assistant";
}

function statusText(status) {
  if (!status) return "";
  if (typeof status === "string") return status;
  if (status && typeof status === "object" && status.type) return text(status.type);
  return text(status);
}

function isActiveTurn(turn = {}) {
  return /running|active|queued|processing|inprogress|in_progress|in-progress/i.test(statusText(turn.status));
}

function isCompletedTurn(turn = {}) {
  return /completed|failed|cancel|error|interrupted/i.test(statusText(turn.status));
}

function turnId(turn = {}) {
  return text(turn.id || turn.turnId || turn.turn_id);
}

function displayTimestampMs(item = {}) {
  for (const key of ["startedAtMs", "startedAt", "timestampMs", "timestamp", "createdAtMs", "createdAt"]) {
    const ms = timestampToMs(item[key]);
    if (ms) return ms;
  }
  return 0;
}

function insertByTimestamp(items, item) {
  const timestamp = displayTimestampMs(item);
  if (!timestamp) {
    items.unshift(item);
    return;
  }
  const index = items.findIndex((existing) => {
    const existingTimestamp = displayTimestampMs(existing);
    return existingTimestamp && existingTimestamp > timestamp;
  });
  if (index < 0) items.push(item);
  else items.splice(index, 0, item);
}

function userInputAnchorMatchesExistingItem(existing = {}, anchor = {}) {
  if (!isUserInputItem(existing) || !isUserInputItem(anchor)) return false;
  const existingText = comparableAnchorText(existing);
  const anchorText = comparableAnchorText(anchor);
  if (!existingText || !anchorText || existingText !== anchorText) return false;
  const existingTimestamp = displayTimestampMs(existing);
  const anchorTimestamp = displayTimestampMs(anchor);
  if (existingTimestamp && anchorTimestamp) {
    return Math.abs(existingTimestamp - anchorTimestamp) <= SAME_INPUT_DEDUPE_WINDOW_MS;
  }
  const existingId = text(existing.id || existing.itemId || existing.item_id);
  const anchorId = text(anchor.id || anchor.itemId || anchor.item_id);
  if (existingId && anchorId && existingId === anchorId) return true;
  return true;
}

function shouldBackfillUserInputAnchorsIntoTurn(turn = {}) {
  if (!turn || turn.mobileSyntheticCompletionTurn === true) return false;
  if (isActiveTurn(turn) || !isCompletedTurn(turn)) return false;
  const items = Array.isArray(turn.items) ? turn.items : [];
  if (!items.length) return false;
  return items.some(isAssistantOrUsageItem);
}

function enrichUserInputWithAnchorTimestamp(existing = {}, anchor = {}) {
  const anchorTimestamp = displayTimestampMs(anchor);
  if (!anchorTimestamp || displayTimestampMs(existing)) return null;
  const timestamp = anchor.startedAt || new Date(anchorTimestamp).toISOString();
  const enriched = Object.assign({}, existing, {
    startedAtMs: anchorTimestamp,
    startedAt: timestamp,
    mobileUserInputTimestampEnriched: true,
  });
  if (existing.mobileDisplayTimestampInferred === true
    || existing.mobileDisplayTimestampMs
    || existing.mobileDisplayTimestamp) {
    enriched.mobileDisplayTimestampMs = anchorTimestamp;
    enriched.mobileDisplayTimestamp = timestamp;
    enriched.mobileDisplayTimestampInferred = false;
    enriched.mobileDisplayTimestampSource = "rollout-user-input-anchor";
  }
  return enriched;
}

function appendMissingUserInputAnchorsToTurn(turn = {}, anchors = []) {
  if (!shouldBackfillUserInputAnchorsIntoTurn(turn) || !Array.isArray(anchors) || !anchors.length) {
    return { inserted: 0, enriched: 0 };
  }
  const items = Array.isArray(turn.items) ? turn.items : [];
  const existingIds = new Set(items.map((item) => text(item.id || item.itemId || item.item_id)).filter(Boolean));
  const existingUserInputs = items.filter(isUserInputItem);
  let inserted = 0;
  let enriched = 0;
  let nextItems = null;
  for (const anchor of anchors) {
    const anchorId = text(anchor && (anchor.id || anchor.itemId || anchor.item_id));
    if (!anchor || !anchorId || existingIds.has(anchorId)) continue;
    const matchingIndex = existingUserInputs.findIndex((existing) => userInputAnchorMatchesExistingItem(existing, anchor));
    const matchingExisting = matchingIndex >= 0 ? existingUserInputs[matchingIndex] : null;
    if (matchingExisting) {
      const enrichedItem = enrichUserInputWithAnchorTimestamp(matchingExisting, anchor);
      if (enrichedItem) {
        if (!nextItems) nextItems = items.slice();
        const nextItemIndex = nextItems.indexOf(matchingExisting);
        if (nextItemIndex >= 0) nextItems.splice(nextItemIndex, 1);
        insertByTimestamp(nextItems, enrichedItem);
        existingUserInputs[matchingIndex] = enrichedItem;
        enriched += 1;
      }
      continue;
    }
    const cloned = Object.assign({}, anchor);
    if (!nextItems) nextItems = items.slice();
    insertByTimestamp(nextItems, cloned);
    existingIds.add(anchorId);
    existingUserInputs.push(cloned);
    inserted += 1;
  }
  if (nextItems) turn.items = nextItems;
  return { inserted, enriched };
}

function appendLatestCompletedUserInputAnchors(thread = {}, anchorPayload = {}) {
  if (!thread || typeof thread !== "object" || !Array.isArray(thread.turns)) return { changed: false, thread };
  const byTurn = anchorPayload && anchorPayload.byTurn instanceof Map ? anchorPayload.byTurn : null;
  if (!byTurn || !byTurn.size) return { changed: false, thread };
  for (let index = thread.turns.length - 1; index >= 0; index -= 1) {
    const turn = thread.turns[index];
    const id = turnId(turn);
    if (!id || !byTurn.has(id)) continue;
    const changes = appendMissingUserInputAnchorsToTurn(turn, byTurn.get(id));
    if (!changes.inserted && !changes.enriched) continue;
    if (changes.inserted) {
      turn.mobileUserInputAnchorBackfilled = true;
      turn.mobileUserInputAnchorBackfillCount = Number(turn.mobileUserInputAnchorBackfillCount || 0) + changes.inserted;
      thread.mobileUserInputAnchorBackfilled = id || true;
    }
    if (changes.enriched) {
      turn.mobileUserInputTimestampEnriched = true;
      turn.mobileUserInputTimestampEnrichedCount = Number(turn.mobileUserInputTimestampEnrichedCount || 0) + changes.enriched;
      thread.mobileUserInputTimestampEnriched = id || true;
    }
    return { changed: true, thread, inserted: changes.inserted, enriched: changes.enriched };
  }
  return { changed: false, thread };
}

module.exports = {
  appendLatestCompletedUserInputAnchors,
  collectRolloutUserInputAnchors,
  userInputAnchorItem,
};
