"use strict";

const crypto = require("node:crypto");

const {
  isAssistantItem,
  isOperationItem,
  isReasoningItem,
} = require("../services/thread-detail/thread-detail-response-budget-service");
const {
  sameUserMessageContent,
} = require("./message-pending-echo-service");
const {
  itemDisplayTimestampMs,
} = require("../services/thread-detail/thread-detail-active-window-overlay-policy-service");

const USER_VISIBLE_TIMESTAMP_TYPES = new Set([
  "agentMessage",
  "plan",
  "turnDiagnostic",
]);

const USER_INPUT_TYPES = new Set([
  "userMessage",
  "contextCompaction",
  "imageView",
  "imageGeneration",
  "filePreview",
]);

const DEFAULT_WARNING_ACTION_THRESHOLD = 2;

function text(value) {
  return String(value || "").trim();
}

function boundedCount(value, max = 100000) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(max, Math.trunc(number));
}

function shortHash(value) {
  const input = text(value);
  if (!input) return "";
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function objectOrNull(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function numericTimestampMs(value) {
  if (!value) return 0;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    if (typeof value !== "string") return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  return number > 100000000000 ? number : number * 1000;
}

function uuidV7TimestampMs(value) {
  const input = text(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input)) return 0;
  const timestampMs = Number.parseInt(input.replace(/-/g, "").slice(0, 12), 16);
  if (!Number.isFinite(timestampMs)) return 0;
  if (timestampMs < 946684800000 || timestampMs > 4102444800000) return 0;
  return timestampMs;
}

function turnIdentityTimestampMs(turn) {
  return uuidV7TimestampMs(turn && (turn.id || turn.turnId || turn.turn_id));
}

function turnStartedAtMs(turn) {
  return numericTimestampMs(turn && (
    turn.startedAtMs
    || turn.startedAt
    || turn.createdAtMs
    || turn.createdAt
  )) || turnIdentityTimestampMs(turn);
}

function statusText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && value.type) return text(value.type);
  return text(value);
}

function isActiveStatus(value) {
  return /active|running|started|pending|queued|processing|inprogress|in_progress|in-progress/i.test(statusText(value));
}

function isCompletedStatus(value) {
  return /completed|failed|cancel|error|interrupted/i.test(statusText(value));
}

function isRestStatus(value) {
  return /^(idle|completed|failed|cancelled|canceled|interrupted|error)$/i.test(statusText(value));
}

function isThreadListUnknownStatus(value) {
  const input = statusText(value).toLowerCase();
  return !input || /^(unknown|notloaded|not_loaded|not-loaded)$/.test(input);
}

function isTurnComplete(turn) {
  return isCompletedStatus(turn && turn.status);
}

function isStaleActiveCompletionStatus(value) {
  return Boolean(value && typeof value === "object" && value.mobileStaleActiveTurn === true);
}

function turnCompletedAtMs(turn, thread = null) {
  if (!isTurnComplete(turn)) return 0;
  const direct = numericTimestampMs(turn && (
    turn.completedAtMs
    || turn.completedAt
    || turn.endedAtMs
    || turn.endedAt
  ));
  if (direct) return direct;
  const fallback = numericTimestampMs(thread && (thread.updatedAtMs || thread.updatedAt || thread.lastActivityAtMs || thread.lastActivityAt));
  const startedAt = turnStartedAtMs(turn);
  if (!fallback || (startedAt && fallback < startedAt)) return 0;
  return fallback;
}

function itemTimestampMs(item, turn = null, thread = null) {
  return itemDisplayTimestampMs(item, turn, thread);
}

function turnId(turn) {
  return text(turn && (turn.id || turn.turnId || turn.turn_id));
}

function itemId(item) {
  return text(item && (item.id || item.itemId || item.item_id || item.mobileVisibleKey));
}

function itemType(item) {
  return text(item && (item.type || item.kind || "unknown")) || "unknown";
}

function threadRows(result = {}) {
  if (Array.isArray(result && result.data)) return result.data;
  if (Array.isArray(result && result.threads)) return result.threads;
  return [];
}

function threadId(thread) {
  return text(thread && (thread.id || thread.threadId || thread.thread_id));
}

function threadUpdatedAtMs(thread) {
  return numericTimestampMs(thread && (
    thread.updatedAtMs
    || thread.updatedAt
    || thread.lastActivityAtMs
    || thread.lastActivityAt
  ));
}

function pushIssue(issues, code, severity, surface, details = {}) {
  issues.push(Object.assign({
    code,
    severity,
    surface,
  }, details));
}

function countItems(items = []) {
  const counts = {};
  for (const item of safeArray(items)) {
    const type = itemType(item);
    counts[type] = boundedCount((counts[type] || 0) + 1);
  }
  return counts;
}

function latestCompletedTurn(thread = {}) {
  const turns = safeArray(thread.turns);
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (!safeArray(turn && turn.items).length) continue;
    if (isActiveStatus(turn && turn.status)) continue;
    if (isStaleActiveCompletionStatus(turn && turn.status)) continue;
    if (!isCompletedStatus(turn && turn.status)) continue;
    return { turn, index };
  }
  return { turn: null, index: -1 };
}

function activeTurn(thread = {}) {
  const turns = safeArray(thread.turns);
  const activeId = text(thread.activeTurnId || thread.mobileActiveTurnId || thread.mobileRolloutActiveTurn);
  if (activeId) {
    const index = turns.findIndex((turn) => text(turnId(turn)) === activeId);
    if (index >= 0 && isActiveStatus(turns[index] && turns[index].status)) return { turn: turns[index], index };
  }
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (isActiveStatus(turn && turn.status)) return { turn, index };
  }
  return { turn: null, index: -1 };
}

function visibleKeyForItem(item) {
  return text(item && (item.mobileVisibleKey || item.renderKey || item.visibleKey || item.id));
}

function presentText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function clientTurnIdentity(turn = {}) {
  return presentText(turnId(turn) || turn.startedAt || turn.createdAt || "turn");
}

function clientItemIdentity(item = {}, index = 0) {
  return presentText(
    item.mobileVisibleKey
    || item.renderKey
    || item.visibleKey
    || item.id
    || item.callId
    || item.requestId
    || item.startedAtMs
    || item.startedAt,
  ) || `index:${boundedCount(index)}`;
}

function clientOperationGroupKey(item = {}) {
  return presentText(
    item.mobileOperationGroupKey
    || item.operationGroupKey
    || item.groupKey
    || item.tool
    || item.name
    || item.command,
  ) || `${itemType(item)}:operation`;
}

function clientRenderKeyForItem(thread = {}, turn = {}, item = {}, index = 0) {
  const ownerThreadId = threadId(thread) || "thread";
  const ownerTurnId = clientTurnIdentity(turn);
  if (isOperationItem(item)) {
    return [
      "live-operation",
      ownerThreadId,
      ownerTurnId,
      clientOperationGroupKey(item),
      clientItemIdentity(item, index),
      String(boundedCount(index)),
    ].join("|");
  }
  const type = itemType(item);
  const prefix = /context/i.test(type) ? "context" : "item";
  const identity = clientItemIdentity(item, index) || `${type}-${boundedCount(index)}`;
  return [prefix, ownerThreadId, ownerTurnId, identity].join("|");
}

function duplicateInfo(values = []) {
  const seen = new Set();
  const duplicates = [];
  for (const value of values) {
    const key = text(value);
    if (!key) continue;
    if (seen.has(key)) duplicates.push(key);
    else seen.add(key);
  }
  return {
    count: boundedCount(duplicates.length),
    firstHash: shortHash(duplicates[0] || ""),
  };
}

function duplicateSameTimestampUserMessages(turn = {}, thread = null) {
  const userMessages = safeArray(turn.items).filter((item) => itemType(item) === "userMessage");
  const duplicates = [];
  for (let leftIndex = 0; leftIndex < userMessages.length; leftIndex += 1) {
    const left = userMessages[leftIndex];
    const leftTimestamp = itemTimestampMs(left, turn, thread);
    if (!leftTimestamp) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < userMessages.length; rightIndex += 1) {
      const right = userMessages[rightIndex];
      const rightTimestamp = itemTimestampMs(right, turn, thread);
      if (!rightTimestamp || rightTimestamp !== leftTimestamp) continue;
      if (!sameUserMessageContent(left, right)) continue;
      duplicates.push(`${itemId(left) || leftIndex}:${itemId(right) || rightIndex}:${leftTimestamp}`);
    }
  }
  return {
    count: boundedCount(duplicates.length),
    firstHash: shortHash(duplicates[0] || ""),
  };
}

function visibleItemTimestampOrderIssue(turn = {}, thread = null) {
  let previousTimestamp = 0;
  let previousIdentity = "";
  let count = 0;
  let firstPair = "";
  for (const item of safeArray(turn.items)) {
    if (!item || isOperationItem(item) || isReasoningItem(item)) continue;
    const timestamp = itemTimestampMs(item, turn, thread);
    if (!timestamp) continue;
    const identity = itemId(item) || visibleKeyForItem(item) || itemType(item);
    if (previousTimestamp && timestamp < previousTimestamp - 1000) {
      count += 1;
      if (!firstPair) firstPair = `${previousIdentity}:${previousTimestamp}>${identity}:${timestamp}`;
    }
    previousTimestamp = timestamp;
    previousIdentity = identity;
  }
  return {
    count: boundedCount(count),
    firstHash: shortHash(firstPair),
  };
}

function hasDuplicate(values) {
  const seen = new Set();
  for (const value of values) {
    const key = text(value);
    if (!key) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function isThreadIdLikeTitle(value, threadId = "") {
  const input = text(value);
  const id = text(threadId);
  if (!input) return true;
  if (id && input === id) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
}

function threadSummaryHasDisplayText(thread) {
  if (!thread || typeof thread !== "object") return false;
  const id = threadId(thread);
  for (const value of [thread.name, thread.title, thread.preview, thread.first_user_message]) {
    const input = text(value);
    if (input && !isThreadIdLikeTitle(input, id)) return true;
  }
  return false;
}

function isUnmaterializedThreadListPlaceholder(thread) {
  if (!thread || typeof thread !== "object") return false;
  const id = threadId(thread);
  if (!id) return false;
  if (!isThreadListUnknownStatus(thread.status)) return false;
  if (threadSummaryHasDisplayText(thread)) return false;
  if (text(thread.cwd)) return false;
  if (Array.isArray(thread.turns) && thread.turns.length) return false;
  const display = text(thread.name || thread.title || thread.preview);
  return !display || isThreadIdLikeTitle(display, id);
}

function compactToken(value, fallback = "", maxLength = 80) {
  const safe = text(value)
    .replace(/[^a-zA-Z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, maxLength);
  return safe || fallback;
}

function summarizeTurn(turn = {}, thread = null) {
  const items = safeArray(turn.items);
  const operationItems = items.filter(isOperationItem).length;
  const reasoningItems = items.filter(isReasoningItem).length;
  const assistantItems = items.filter(isAssistantItem).length;
  const usageItems = items.filter((item) => itemType(item) === "turnUsageSummary").length;
  const userInputItems = items.filter((item) => USER_INPUT_TYPES.has(itemType(item))).length;
  const timestampMissingVisibleItems = items.filter((item) => {
    const type = itemType(item);
    return USER_VISIBLE_TIMESTAMP_TYPES.has(type) && !itemTimestampMs(item, turn, thread);
  }).length;
  return {
    turnHash: shortHash(turnId(turn)),
    status: text(statusText(turn.status)).slice(0, 40),
    itemCount: boundedCount(items.length),
    counts: countItems(items),
    operationItems: boundedCount(operationItems),
    reasoningItems: boundedCount(reasoningItems),
    assistantItems: boundedCount(assistantItems),
    usageItems: boundedCount(usageItems),
    userInputItems: boundedCount(userInputItems),
    timestampMissingVisibleItems: boundedCount(timestampMissingVisibleItems),
    syntheticCompletionTurn: turn && turn.mobileSyntheticCompletionTurn === true,
    startedAtMs: boundedCount(turnStartedAtMs(turn), Number.MAX_SAFE_INTEGER),
    completedAtMs: boundedCount(turnCompletedAtMs(turn, thread), Number.MAX_SAFE_INTEGER),
  };
}

function turnActivityTimestampMs(turn = {}, thread = null) {
  let value = Math.max(
    turnStartedAtMs(turn),
    numericTimestampMs(turn && (
      turn.updatedAtMs
      || turn.updatedAt
      || turn.completedAtMs
      || turn.completedAt
      || turn.endedAtMs
      || turn.endedAt
    )),
  );
  for (const item of safeArray(turn.items)) value = Math.max(value, itemTimestampMs(item, turn, thread));
  return value;
}

function detailSignature(detail = {}) {
  const thread = objectOrNull(detail.thread) || objectOrNull(detail) || {};
  return safeArray(thread.turns).map((turn) => ({
    turnHash: shortHash(turnId(turn)),
    status: statusText(turn.status).slice(0, 40),
    itemTypes: safeArray(turn.items).map(itemType),
  }));
}

function analyzeThreadDetail(detail = {}, options = {}) {
  const issues = [];
  const thread = objectOrNull(detail.thread) || objectOrNull(detail) || {};
  const turns = safeArray(thread.turns);
  const budget = objectOrNull(thread.mobileDetailResponseBudget) || {};
  const latest = latestCompletedTurn(thread);
  const active = activeTurn(thread);
  const latestSummary = latest.turn ? summarizeTurn(latest.turn, thread) : null;
  const activeSummary = active.turn ? summarizeTurn(active.turn, thread) : null;
  const threadHash = shortHash(threadId(thread) || options.threadId);

  if (!turns.length) {
    pushIssue(issues, "thread_detail_empty", "H2", "thread-detail", { threadHash });
  }
  if (hasDuplicate(turns.map(turnId))) {
    pushIssue(issues, "duplicate_turn_ids", "H2", "thread-detail", { threadHash });
  }
  for (const turn of turns) {
    if (hasDuplicate(safeArray(turn.items).map(itemId))) {
      pushIssue(issues, "duplicate_item_ids", "H2", "thread-detail", {
        threadHash,
        turnHash: shortHash(turnId(turn)),
      });
    }
  }
  const visibleKeys = safeArray(thread.mobileVisibleItemKeys);
  if (visibleKeys.length && hasDuplicate(visibleKeys)) {
    pushIssue(issues, "duplicate_visible_item_keys", "H2", "thread-detail", { threadHash });
  }
  const itemVisibleKeys = turns.flatMap((turn) => safeArray(turn.items).map(visibleKeyForItem).filter(Boolean));
  if (itemVisibleKeys.length && hasDuplicate(itemVisibleKeys)) {
    pushIssue(issues, "duplicate_item_visible_keys", "H2", "thread-detail", { threadHash });
  }
  for (const turn of turns) {
    const renderKeys = safeArray(turn.items).map((item, index) => clientRenderKeyForItem(thread, turn, item, index));
    const duplicate = duplicateInfo(renderKeys);
    if (duplicate.count > 0) {
      pushIssue(issues, "duplicate_client_render_keys", "H2", "thread-detail", {
        threadHash,
        turnHash: shortHash(turnId(turn)),
        count: duplicate.count,
        itemHash: duplicate.firstHash,
      });
    }
    const duplicateUserMessages = duplicateSameTimestampUserMessages(turn, thread);
    if (duplicateUserMessages.count > 0) {
      pushIssue(issues, "duplicate_user_message_events", "H2", "thread-detail", {
        threadHash,
        turnHash: shortHash(turnId(turn)),
        count: duplicateUserMessages.count,
        itemHash: duplicateUserMessages.firstHash,
      });
    }
    const timestampOrder = visibleItemTimestampOrderIssue(turn, thread);
    if (timestampOrder.count > 0) {
      pushIssue(issues, "visible_item_timestamp_order_mismatch", "H2", "thread-detail", {
        threadHash,
        turnHash: shortHash(turnId(turn)),
        count: timestampOrder.count,
        itemHash: timestampOrder.firstHash,
      });
    }
  }

  if (latest.turn) {
    const items = safeArray(latest.turn.items);
    const turnHash = shortHash(turnId(latest.turn));
    const operationItems = items.filter(isOperationItem);
    const reasoningItems = items.filter(isReasoningItem);
    const assistantItems = items.filter(isAssistantItem);
    const usageItems = items.filter((item) => itemType(item) === "turnUsageSummary");
    if (operationItems.length) {
      pushIssue(issues, "latest_completed_replay_has_operation_items", "H2", "thread-detail", {
        threadHash,
        turnHash,
        count: boundedCount(operationItems.length),
      });
    }
    if (reasoningItems.length) {
      pushIssue(issues, "latest_completed_replay_has_reasoning_items", "H2", "thread-detail", {
        threadHash,
        turnHash,
        count: boundedCount(reasoningItems.length),
      });
    }
    if (assistantItems.length && !usageItems.length) {
      pushIssue(issues, "latest_completed_usage_missing", "H2", "thread-detail", {
        threadHash,
        turnHash,
        assistantItems: boundedCount(assistantItems.length),
      });
    }
    const replayOmittedAssistantItems = Number(budget.latestCompletedReplayOmittedAssistantItems || 0);
    if (assistantItems.length <= 1 && Number(budget.latestCompletedReplayTurnCount || 0) > 0 && replayOmittedAssistantItems > 0) {
      pushIssue(issues, "latest_completed_replay_receipt_only", "H3", "thread-detail", {
        threadHash,
        turnHash,
        assistantItems: boundedCount(assistantItems.length),
        omittedAssistantItems: boundedCount(replayOmittedAssistantItems),
      });
    }
    const userInputItems = items.filter((item) => USER_INPUT_TYPES.has(itemType(item)));
    const syntheticCompletionTurn = latest.turn && latest.turn.mobileSyntheticCompletionTurn === true;
    if ((assistantItems.length || usageItems.length) && !userInputItems.length && !syntheticCompletionTurn) {
      pushIssue(issues, "latest_completed_user_input_missing", "H3", "thread-detail", {
        threadHash,
        turnHash,
        assistantItems: boundedCount(assistantItems.length),
        usageItems: boundedCount(usageItems.length),
      });
    }
    if (usageItems.length && !assistantItems.length) {
      pushIssue(issues, "latest_completed_assistant_missing", "H2", "thread-detail", {
        threadHash,
        turnHash,
        usageItems: boundedCount(usageItems.length),
      });
    }
    for (const item of items) {
      const type = itemType(item);
      if (!USER_VISIBLE_TIMESTAMP_TYPES.has(type)) continue;
      if (!itemTimestampMs(item, latest.turn, thread)) {
        pushIssue(issues, "visible_item_timestamp_missing", "H2", "thread-detail", {
          threadHash,
          turnHash,
          itemHash: shortHash(itemId(item)),
          itemType: type,
        });
      }
    }
  }

  if (active.turn) {
    const activeItems = safeArray(active.turn.items);
    const activeBudget = objectOrNull(active.turn.mobileVisibleItemBudget) || {};
    const reason = text(activeBudget.reason).slice(0, 80);
    const activeAssistantItems = activeItems.filter(isAssistantItem).length;
    const activeOmittedAssistantItems = boundedCount(budget.activeOmittedAssistantItems);
    const progressiveReplayAssistantItems = boundedCount(budget.progressiveReplayAssistantItems);
    const limitedReplayAssistantItems = boundedCount(budget.limitedReplayAssistantItems);
    const progressiveActiveBudgetApplied = budget.progressiveActiveBudgetApplied === true;
    const activeAssistantItemsAfter = boundedCount(budget.activeAssistantItemsAfter);
    const activeActivityMs = turnActivityTimestampMs(active.turn, thread);
    const latestCompletedAtMs = latest.turn ? turnCompletedAtMs(latest.turn, thread) : 0;
    const overlayCounts = objectOrNull(objectOrNull(thread.mobileActiveOverlay) && thread.mobileActiveOverlay.counts) || {};
    const overlayAssistantItems = boundedCount(overlayCounts.assistantItems);
    const syntheticAssistantDeduped = boundedCount(Math.max(
      boundedCount(thread.mobileSyntheticActiveAssistantDeduped),
      boundedCount(active.turn && active.turn.mobileSyntheticActiveAssistantDeduped),
    ));
    const effectiveOverlayAssistantItems = boundedCount(Math.max(0, overlayAssistantItems - syntheticAssistantDeduped));
    const overlayAssistantGap = boundedCount(Math.max(0, effectiveOverlayAssistantItems - activeAssistantItems));
    const progressiveReplayBudgetExplainsActiveTail = Boolean(
      progressiveActiveBudgetApplied
        && progressiveReplayAssistantItems > 0
        && activeOmittedAssistantItems > 0
        && (limitedReplayAssistantItems > 0 || activeAssistantItemsAfter > 0)
        && activeAssistantItems <= Math.max(progressiveReplayAssistantItems, activeAssistantItemsAfter),
    );
    if (activeOmittedAssistantItems > 0 && !progressiveReplayBudgetExplainsActiveTail) {
      pushIssue(issues, "active_turn_assistant_budget", "H2", "thread-detail", {
        threadHash,
        turnHash: shortHash(turnId(active.turn)),
        omittedAssistantItems: activeOmittedAssistantItems,
        retainedAssistantItems: boundedCount(activeAssistantItems),
      });
    }
    if (latestCompletedAtMs && activeActivityMs && activeActivityMs < latestCompletedAtMs - 1000) {
      pushIssue(issues, "thread_detail_active_turn_superseded_by_completed", "H2", "thread-detail", {
        threadHash,
        turnHash: shortHash(turnId(active.turn)),
        latestCompletedTurnHash: shortHash(turnId(latest.turn)),
        activeActivityMs: boundedCount(activeActivityMs, Number.MAX_SAFE_INTEGER),
        latestCompletedAtMs: boundedCount(latestCompletedAtMs, Number.MAX_SAFE_INTEGER),
      });
    }
    if (overlayAssistantGap > 0 && !(progressiveReplayBudgetExplainsActiveTail && overlayAssistantGap <= activeOmittedAssistantItems)) {
      pushIssue(issues, "active_overlay_assistant_projection_gap", "H2", "thread-detail", {
        threadHash,
        turnHash: shortHash(turnId(active.turn)),
        overlayAssistantItems,
        effectiveOverlayAssistantItems,
        syntheticAssistantDeduped,
        detailAssistantItems: boundedCount(activeAssistantItems),
      });
    }
    if (reason === "progressive-active-first-paint-byte-ceiling") {
      pushIssue(issues, "active_turn_visible_item_budget", "H2", "thread-detail", {
        threadHash,
        turnHash: shortHash(turnId(active.turn)),
        reason,
        omittedVisibleItems: boundedCount(activeBudget.omitted),
        retainedVisibleItems: boundedCount(activeBudget.retained || activeItems.length),
      });
    }
  }

  for (let index = 0; index < turns.length; index += 1) {
    if (index === latest.index) continue;
    const turn = turns[index];
    if (!isCompletedStatus(turn && turn.status)) continue;
    const reasoningItems = safeArray(turn.items).filter(isReasoningItem).length;
    if (reasoningItems) {
      pushIssue(issues, "historical_completed_reasoning_visible", "H3", "thread-detail", {
        threadHash,
        turnHash: shortHash(turnId(turn)),
        count: boundedCount(reasoningItems),
      });
    }
  }

  const h2Count = issues.filter((issue) => issue.severity === "H1" || issue.severity === "H2").length;
  return {
    ok: h2Count === 0,
    threadHash,
    readMode: text(thread.mobileReadMode || detail.mobileReadMode).slice(0, 80),
    turnCount: boundedCount(turns.length),
    visibleKeyCount: boundedCount(visibleKeys.length || itemVisibleKeys.length),
    latestCompleted: latestSummary,
    activeTurn: activeSummary,
    budget: {
      latestCompletedReplayTurnCount: boundedCount(budget.latestCompletedReplayTurnCount),
      latestCompletedReplayOperationItems: boundedCount(budget.latestCompletedReplayOperationItems),
      latestCompletedReplayReasoningItems: boundedCount(budget.latestCompletedReplayReasoningItems),
      latestCompletedReplayAssistantItems: boundedCount(budget.latestCompletedReplayAssistantItems),
      latestCompletedReplayOmittedAssistantItems: boundedCount(budget.latestCompletedReplayOmittedAssistantItems),
      protectedCompletedReplayTurnCount: boundedCount(budget.protectedCompletedReplayTurnCount),
      protectedCompletedReplayAssistantItems: boundedCount(budget.protectedCompletedReplayAssistantItems),
      protectedCompletedReplayOmittedAssistantItems: boundedCount(budget.protectedCompletedReplayOmittedAssistantItems),
      richCompletedReplayTurnCount: boundedCount(budget.richCompletedReplayTurnCount),
      richCompletedReplayAssistantItems: boundedCount(budget.richCompletedReplayAssistantItems),
      richCompletedReplayOmittedAssistantItems: boundedCount(budget.richCompletedReplayOmittedAssistantItems),
      omittedOperationItems: boundedCount(budget.omittedOperationItems),
      omittedReasoningItems: boundedCount(budget.omittedReasoningItems),
      omittedAssistantItems: boundedCount(budget.omittedAssistantItems),
      activeTurnCount: boundedCount(budget.activeTurnCount),
      activeOmittedAssistantItems: boundedCount(budget.activeOmittedAssistantItems),
      activeAssistantItemsBefore: boundedCount(budget.activeAssistantItemsBefore),
      activeAssistantItemsAfter: boundedCount(budget.activeAssistantItemsAfter),
      syntheticActiveAssistantDeduped: boundedCount(thread.mobileSyntheticActiveAssistantDeduped),
      progressiveActiveBudgetApplied: budget.progressiveActiveBudgetApplied === true,
      progressiveReplayAssistantItems: boundedCount(budget.progressiveReplayAssistantItems),
      limitedReplayAssistantItems: boundedCount(budget.limitedReplayAssistantItems),
      omittedVisibleItems: boundedCount(budget.omittedVisibleItems),
      progressiveActiveFirstPaintOmittedVisibleItems: boundedCount(budget.progressiveActiveFirstPaintOmittedVisibleItems),
    },
    issues,
  };
}

function analyzeThreadList(result = {}) {
  const issues = [];
  const rows = threadRows(result);
  const ids = rows.map(threadId).filter(Boolean);
  if (hasDuplicate(ids)) {
    pushIssue(issues, "thread_list_duplicate_ids", "H2", "thread-list", {
      duplicateCount: boundedCount(ids.length - new Set(ids).size),
    });
  }
  let previousUpdatedAt = Number.POSITIVE_INFINITY;
  let outOfOrderCount = 0;
  for (const row of rows) {
    if (isUnmaterializedThreadListPlaceholder(row)) {
      pushIssue(issues, "thread_list_unmaterialized_placeholder", "H2", "thread-list", {
        threadHash: shortHash(threadId(row)),
        status: statusText(row.status).slice(0, 40),
      });
    }
    const updatedAt = threadUpdatedAtMs(row);
    if (updatedAt && previousUpdatedAt !== Number.POSITIVE_INFINITY && updatedAt > previousUpdatedAt + 1000) {
      outOfOrderCount += 1;
    }
    if (updatedAt) previousUpdatedAt = Math.min(previousUpdatedAt, updatedAt);
  }
  if (outOfOrderCount) {
    pushIssue(issues, "thread_list_updated_order_mismatch", "H3", "thread-list", {
      count: boundedCount(outOfOrderCount),
    });
  }
  return {
    ok: issues.filter((issue) => issue.severity === "H1" || issue.severity === "H2").length === 0,
    resultCount: boundedCount(rows.length),
    firstThreadHash: shortHash(ids[0]),
    orderHash: shortHash(ids.join("|")),
    issues,
  };
}

function threadActiveMarker(thread = {}) {
  if (!thread || typeof thread !== "object") return "";
  return text(
    thread.activeTurnId
    || thread.active_turn_id
    || thread.mobileActiveTurnId
    || thread.mobileRolloutActiveTurn
    || thread.mobile_rollout_active_turn
    || thread.mobileLocalActiveStatus && (
      thread.mobileLocalActiveStatus.turnId
      || thread.mobileLocalActiveStatus.turn_id
      || thread.mobileLocalActiveStatus.activeTurnId
    ),
  );
}

function detailThreadIsSettled(detail = {}) {
  const thread = objectOrNull(detail && detail.thread);
  if (!thread) return false;
  if (isRestStatus(thread.status)) return true;
  const active = activeTurn(thread);
  if (active.turn) return false;
  return Boolean(latestCompletedTurn(thread).turn);
}

function detailThreadIsActive(detail = {}) {
  const thread = objectOrNull(detail && detail.thread);
  if (!thread) return false;
  if (detailThreadIsSettled(detail)) return false;
  if (isActiveStatus(thread.status)) return true;
  if (activeTurn(thread).turn) return true;
  return Boolean(threadActiveMarker(thread));
}

function compareThreadListRowToDetail(row = {}, detail = {}) {
  const id = threadId(row) || threadId(detail && detail.thread);
  const threadHash = shortHash(id);
  const issues = [];
  const marker = threadActiveMarker(row);
  const listStatus = row && row.status;
  const listHasActiveMarker = Boolean(marker);
  const listIsActive = isActiveStatus(listStatus) || listHasActiveMarker;
  const listIsRest = isRestStatus(listStatus);
  const detailSettled = detailThreadIsSettled(detail);
  const detailIsActive = detailThreadIsActive(detail);
  const detailThread = objectOrNull(detail && detail.thread);
  const detailStatus = statusText(detailThread && detailThread.status);
  const detailMarker = threadActiveMarker(detailThread);
  if (listIsRest && listHasActiveMarker) {
    pushIssue(issues, "thread_list_rest_status_has_active_turn", "H2", "thread-list-detail-consistency", {
      threadHash,
      listStatus: statusText(listStatus),
      activeTurnHash: shortHash(marker),
    });
  }
  if (listIsActive && detailSettled) {
    pushIssue(issues, "thread_list_active_detail_settled_mismatch", "H2", "thread-list-detail-consistency", {
      threadHash,
      listStatus: statusText(listStatus),
      detailStatus,
      activeTurnHash: marker ? shortHash(marker) : "",
    });
  }
  if (!listIsActive && detailIsActive) {
    pushIssue(issues, "thread_list_missing_active_detail_active_mismatch", "H2", "thread-list-detail-consistency", {
      threadHash,
      listStatus: statusText(listStatus),
      detailStatus,
      detailActiveTurnHash: detailMarker ? shortHash(detailMarker) : "",
    });
  }
  return {
    ok: issues.filter(issueSeverityBlocks).length === 0,
    threadHash,
    listStatus: statusText(listStatus),
    detailStatus,
    listHasActiveMarker,
    detailSettled,
    detailIsActive,
    issues,
  };
}

function compareDetailReadbacks(firstDetail = {}, secondDetail = {}, options = {}) {
  const issues = [];
  const firstThread = objectOrNull(firstDetail.thread) || {};
  const secondThread = objectOrNull(secondDetail.thread) || {};
  const firstLatest = latestCompletedTurn(firstThread).turn;
  const secondLatest = latestCompletedTurn(secondThread).turn;
  const firstSummary = firstLatest ? summarizeTurn(firstLatest, firstThread) : null;
  const secondSummary = secondLatest ? summarizeTurn(secondLatest, secondThread) : null;
  const threadHash = shortHash(threadId(secondThread) || threadId(firstThread) || options.threadId);
  if (firstSummary && secondSummary && firstSummary.turnHash === secondSummary.turnHash) {
    if (secondSummary.itemCount < firstSummary.itemCount) {
      pushIssue(issues, "thread_detail_refresh_item_downgrade", "H2", "thread-detail-refresh", {
        threadHash,
        turnHash: secondSummary.turnHash,
        beforeItems: firstSummary.itemCount,
        afterItems: secondSummary.itemCount,
      });
    }
    if (secondSummary.userInputItems < firstSummary.userInputItems) {
      pushIssue(issues, "thread_detail_refresh_lost_user_input", "H2", "thread-detail-refresh", {
        threadHash,
        turnHash: secondSummary.turnHash,
        beforeItems: firstSummary.userInputItems,
        afterItems: secondSummary.userInputItems,
      });
    }
    if (secondSummary.assistantItems < firstSummary.assistantItems) {
      pushIssue(issues, "thread_detail_refresh_lost_assistant_items", "H2", "thread-detail-refresh", {
        threadHash,
        turnHash: secondSummary.turnHash,
        beforeItems: firstSummary.assistantItems,
        afterItems: secondSummary.assistantItems,
      });
    }
    if (firstSummary.usageItems > 0 && secondSummary.usageItems === 0) {
      pushIssue(issues, "thread_detail_refresh_lost_usage", "H2", "thread-detail-refresh", {
        threadHash,
        turnHash: secondSummary.turnHash,
      });
    }
    if (firstSummary.reasoningItems === 0 && secondSummary.reasoningItems > 0) {
      pushIssue(issues, "thread_detail_refresh_added_reasoning", "H2", "thread-detail-refresh", {
        threadHash,
        turnHash: secondSummary.turnHash,
        count: secondSummary.reasoningItems,
      });
    }
    if (firstSummary.operationItems === 0 && secondSummary.operationItems > 0) {
      pushIssue(issues, "thread_detail_refresh_added_operations", "H2", "thread-detail-refresh", {
        threadHash,
        turnHash: secondSummary.turnHash,
        count: secondSummary.operationItems,
      });
    }
    if (firstSummary.timestampMissingVisibleItems === 0 && secondSummary.timestampMissingVisibleItems > 0) {
      pushIssue(issues, "thread_detail_refresh_lost_visible_timestamps", "H2", "thread-detail-refresh", {
        threadHash,
        turnHash: secondSummary.turnHash,
        count: secondSummary.timestampMissingVisibleItems,
      });
    }
    if (firstSummary.startedAtMs > 0 && secondSummary.startedAtMs === 0) {
      pushIssue(issues, "thread_detail_refresh_lost_turn_start_timestamp", "H2", "thread-detail-refresh", {
        threadHash,
        turnHash: secondSummary.turnHash,
      });
    }
    if (firstSummary.completedAtMs > 0 && secondSummary.completedAtMs === 0) {
      pushIssue(issues, "thread_detail_refresh_lost_turn_completion_timestamp", "H2", "thread-detail-refresh", {
        threadHash,
        turnHash: secondSummary.turnHash,
      });
    }
  }
  return {
    ok: issues.length === 0,
    threadHash,
    before: firstSummary,
    after: secondSummary,
    signatureHashBefore: shortHash(JSON.stringify(detailSignature(firstDetail))),
    signatureHashAfter: shortHash(JSON.stringify(detailSignature(secondDetail))),
    issues,
  };
}

function compareThreadListReadbacks(first = {}, second = {}) {
  const firstSummary = analyzeThreadList(first);
  const secondSummary = analyzeThreadList(second);
  const issues = [...firstSummary.issues, ...secondSummary.issues];
  const firstIds = threadRows(first).map(threadId).filter(Boolean);
  const secondIds = threadRows(second).map(threadId).filter(Boolean);
  const secondIdSet = new Set(secondIds);
  const lostIds = firstIds.filter((id) => !secondIdSet.has(id));
  if (lostIds.length) {
    pushIssue(issues, "thread_list_repeat_lost_thread_ids", "H2", "thread-list-refresh", {
      count: boundedCount(lostIds.length),
    });
  }
  if (secondSummary.resultCount < firstSummary.resultCount) {
    pushIssue(issues, "thread_list_repeat_row_count_downgrade", "H2", "thread-list-refresh", {
      beforeCount: firstSummary.resultCount,
      afterCount: secondSummary.resultCount,
    });
  }
  const firstById = new Map(threadRows(first).map((row) => [threadId(row), threadUpdatedAtMs(row)]).filter(([id]) => id));
  for (const row of threadRows(second)) {
    const id = threadId(row);
    if (!id || !firstById.has(id)) continue;
    const beforeUpdatedAt = firstById.get(id);
    const afterUpdatedAt = threadUpdatedAtMs(row);
    if (beforeUpdatedAt && afterUpdatedAt && afterUpdatedAt < beforeUpdatedAt - 1000) {
      pushIssue(issues, "thread_list_repeat_updated_at_downgrade", "H2", "thread-list-refresh", {
        threadHash: shortHash(id),
        beforeUpdatedAtMs: boundedCount(beforeUpdatedAt, Number.MAX_SAFE_INTEGER),
        afterUpdatedAtMs: boundedCount(afterUpdatedAt, Number.MAX_SAFE_INTEGER),
      });
    }
  }
  return {
    ok: issues.filter((issue) => issue.severity === "H1" || issue.severity === "H2").length === 0,
    before: firstSummary,
    after: secondSummary,
    rawOrderChanged: firstSummary.resultCount === secondSummary.resultCount && firstSummary.orderHash !== secondSummary.orderHash,
    issues,
  };
}

function issueDedupKey(issue = {}) {
  return [
    text(issue.code),
    text(issue.severity),
    text(issue.surface),
    text(issue.threadHash),
    text(issue.turnHash),
    text(issue.itemHash),
  ].join("|");
}

function issueSeverityBlocks(issue = {}) {
  const severity = text(issue.severity).toUpperCase();
  return severity === "H1" || severity === "H2";
}

function selfCheckDiagnosticType(issue = {}) {
  const surface = text(issue.surface);
  if (surface === "thread-list" || surface === "thread-list-refresh") return "thread_list_response_contract_mismatch";
  return "thread_detail_response_contract_mismatch";
}

function selfCheckDiagnosticCandidate(issue = {}, options = {}) {
  const occurrenceCount = boundedCount(issue.occurrenceCount || 1);
  const warningThreshold = Math.max(1, boundedCount(
    options.warningActionThreshold,
    10,
  ) || DEFAULT_WARNING_ACTION_THRESHOLD);
  if (!issueSeverityBlocks(issue) && occurrenceCount < warningThreshold) return null;
  const code = compactToken(issue.code, "thread_display_self_check_failed", 100);
  const surface = compactToken(issue.surface, "thread-detail", 80);
  const severity = compactToken(issue.severity, "H2", 8).toUpperCase();
  const threadHash = compactToken(issue.threadHash, "", 80);
  const turnHash = compactToken(issue.turnHash, "", 80);
  const itemHash = compactToken(issue.itemHash, "", 80);
  const context = {
    surface,
    action: "self-check",
    diagnostic_source: "codex-mobile-thread-self-check",
  };
  if (threadHash) context.thread_hash = threadHash;
  if (turnHash) context.turn_hash = turnHash;
  if (itemHash) context.item_hash = itemHash;
  const fields = {
    repeated_failures: occurrenceCount,
  };
  if (threadHash) fields.thread_hash = threadHash;
  if (turnHash) fields.turn_hash = turnHash;
  if (itemHash) fields.item_hash = itemHash;
  return {
    category: "conversation_projection_mismatch",
    diagnostic_type: selfCheckDiagnosticType(issue),
    severity_hint: severity === "H1" ? "H1" : issueSeverityBlocks(issue) ? "H2" : "H3",
    evidence_confidence: issueSeverityBlocks(issue) ? 0.82 : 0.72,
    error_code: code,
    counts: {
      repeated_failures: occurrenceCount,
      occurrences: occurrenceCount,
    },
    context,
    breadcrumbs: [{
      kind: "thread-display-self-check",
      code,
      status: "failed",
      fields,
    }],
  };
}

function combineSelfCheck(parts = {}, options = {}) {
  const issues = [];
  const byKey = new Map();
  const pushUnique = (issue) => {
    if (!issue || typeof issue !== "object") return;
    const key = issueDedupKey(issue);
    const existing = byKey.get(key);
    if (existing) {
      existing.occurrenceCount = boundedCount((existing.occurrenceCount || 1) + 1);
      return;
    }
    const normalized = Object.assign({}, issue, { occurrenceCount: 1 });
    byKey.set(key, normalized);
    issues.push(normalized);
  };
  for (const value of Object.values(parts)) {
    if (!value) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && Array.isArray(item.issues)) item.issues.forEach(pushUnique);
      }
      continue;
    }
    if (Array.isArray(value.issues)) value.issues.forEach(pushUnique);
  }
  const diagnosticCandidates = issues
    .map((issue) => selfCheckDiagnosticCandidate(issue, options))
    .filter(Boolean);
  const h2Count = issues.filter(issueSeverityBlocks).length;
  return {
    ok: h2Count === 0,
    issueCount: boundedCount(issues.length),
    blockingIssueCount: boundedCount(h2Count),
    diagnosticCandidateCount: boundedCount(diagnosticCandidates.length),
    diagnosticCandidates,
    issues,
  };
}

module.exports = {
  analyzeThreadDetail,
  analyzeThreadList,
  combineSelfCheck,
  compareDetailReadbacks,
  compareThreadListRowToDetail,
  compareThreadListReadbacks,
  detailSignature,
  itemTimestampMs,
  latestCompletedTurn,
  numericTimestampMs,
  selfCheckDiagnosticCandidate,
  shortHash,
  summarizeTurn,
  threadRows,
  uuidV7TimestampMs,
};
