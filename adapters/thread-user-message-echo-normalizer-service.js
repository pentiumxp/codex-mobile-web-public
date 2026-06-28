"use strict";

const {
  sameUserMessageContent,
} = require("./message-pending-echo-service");

function text(value) {
  return String(value || "").trim();
}

function itemType(item) {
  return text(item && (
    item.type
    || item.itemType
    || item.mobileVisibleKind
    || item.kind
  )).toLowerCase();
}

function isUserMessage(item) {
  return Boolean(item && typeof item === "object" && itemType(item) === "usermessage");
}

function itemId(item) {
  return text(item && (
    item.id
    || item.itemId
    || item.item_id
    || item.mobileVisibleKey
    || item.visibleKey
    || item.renderKey
  ));
}

function isSyntheticUserMessage(item) {
  const id = itemId(item);
  return Boolean(isUserMessage(item)
    && (item.mobilePendingSubmission === true
      || /^mux-user-/.test(id)
      || /^local-user-/.test(id)));
}

function userMessagePreferenceScore(item) {
  if (!isUserMessage(item)) return 0;
  let score = isSyntheticUserMessage(item) ? 0 : 100;
  if (item.clientSubmissionId) score += 10;
  if (itemId(item)) score += 2;
  if (item.mobileVisibleKey || item.visibleKey) score += 1;
  return score;
}

function sameClientSubmission(left, right) {
  const a = text(left && left.clientSubmissionId);
  const b = text(right && right.clientSubmissionId);
  return Boolean(a && b && a === b);
}

function userMessagesAreSameEvent(left, right) {
  if (!isUserMessage(left) || !isUserMessage(right)) return false;
  if (!sameUserMessageContent(left, right)) return false;
  return sameClientSubmission(left, right)
    || isSyntheticUserMessage(left)
    || isSyntheticUserMessage(right);
}

function findMatchingUserMessageIndex(items, candidate) {
  if (!isUserMessage(candidate)) return -1;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!isUserMessage(item)) continue;
    if (userMessagesAreSameEvent(item, candidate)) return index;
  }
  return -1;
}

function dedupeUserMessageEchoesInItems(items) {
  const source = Array.isArray(items) ? items : [];
  const result = [];
  let removed = 0;
  for (const item of source) {
    if (!isUserMessage(item)) {
      result.push(item);
      continue;
    }
    const existingIndex = findMatchingUserMessageIndex(result, item);
    if (existingIndex < 0) {
      result.push(item);
      continue;
    }
    const existing = result[existingIndex];
    if (userMessagePreferenceScore(item) > userMessagePreferenceScore(existing)) {
      result[existingIndex] = item;
    }
    removed += 1;
  }
  return {
    items: removed > 0 ? result : source,
    removed,
  };
}

function dedupeUserMessageEchoesInTurn(turn) {
  if (!turn || typeof turn !== "object" || !Array.isArray(turn.items)) {
    return { turn, removed: 0 };
  }
  const result = dedupeUserMessageEchoesInItems(turn.items);
  if (!result.removed) return { turn, removed: 0 };
  turn.items = result.items;
  turn.mobileUserMessageEchoDedupe = {
    version: "user-message-echo-dedupe-v1",
    removed: result.removed,
  };
  return { turn, removed: result.removed };
}

function dedupeUserMessageEchoesInThread(thread) {
  if (!thread || typeof thread !== "object" || !Array.isArray(thread.turns)) {
    return { thread, removed: 0 };
  }
  let removed = 0;
  for (const turn of thread.turns) {
    const result = dedupeUserMessageEchoesInTurn(turn);
    removed += result.removed || 0;
  }
  if (removed > 0) {
    thread.mobileUserMessageEchoDedupe = {
      version: "user-message-echo-dedupe-v1",
      removed,
    };
  }
  return { thread, removed };
}

module.exports = {
  dedupeUserMessageEchoesInItems,
  dedupeUserMessageEchoesInThread,
  dedupeUserMessageEchoesInTurn,
  isSyntheticUserMessage,
  userMessagesAreSameEvent,
};
