"use strict";

const { normalizeThreadVisibleProjection } = require("./thread-visible-item-normalizer");

const DEFAULT_COMPLETED_OPERATION_ITEMS = 4;
const DEFAULT_ACTIVE_OPERATION_ITEMS = 12;
const DEFAULT_ACTIVE_REASONING_ITEMS = 2;
const DEFAULT_COMPLETED_REASONING_ITEMS = 0;
const DEFAULT_ACTIVE_ASSISTANT_ITEMS = 8;
const DEFAULT_COMPLETED_ASSISTANT_ITEMS = 1;
const DEFAULT_ACTIVE_PROGRESSIVE_ITEM_THRESHOLD = 120;
const DEFAULT_PROGRESSIVE_ACTIVE_OPERATION_ITEMS = 6;
const DEFAULT_PROGRESSIVE_ACTIVE_REASONING_ITEMS = 1;
const DEFAULT_PROGRESSIVE_ACTIVE_ASSISTANT_ITEMS = 4;

const OPERATION_ITEM_TYPES = new Set([
  "commandExecution",
  "fileChange",
  "dynamicToolCall",
  "mcpToolCall",
]);

const ASSISTANT_ITEM_TYPES = new Set([
  "agentMessage",
  "plan",
]);

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function boundedCount(value, fallback, max = 1000) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.min(max, Math.trunc(number));
}

function statusText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && value.type) return String(value.type || "");
  return String(value || "");
}

function isActiveStatus(value) {
  return /active|running|started|pending|queued|processing|inprogress|in_progress|in-progress/i.test(statusText(value));
}

function turnId(turn) {
  return String(turn && (turn.id || turn.turnId || turn.turn_id) || "").trim();
}

function activeTurnId(thread) {
  return String(thread && (thread.activeTurnId || thread.mobileRolloutActiveTurn || thread.mobileActiveTurnId) || "").trim();
}

function isActiveTurn(turn, thread) {
  const id = turnId(turn);
  const activeId = activeTurnId(thread);
  if (activeId) return Boolean(id && id === activeId);
  return isActiveStatus(turn && turn.status);
}

function isStaleActiveLikeTurn(turn, thread) {
  const id = turnId(turn);
  const activeId = activeTurnId(thread);
  return Boolean(activeId && id && id !== activeId && isActiveStatus(turn && turn.status));
}

function isOperationItem(item) {
  return OPERATION_ITEM_TYPES.has(String(item && item.type || ""));
}

function isReasoningItem(item) {
  return String(item && item.type || "") === "reasoning";
}

function isAssistantItem(item) {
  return ASSISTANT_ITEM_TYPES.has(String(item && item.type || ""));
}

function textValue(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textValue).join("");
  return "";
}

function reasoningHasVisibleText(item) {
  return Boolean(
    textValue(item && item.text).trim()
    || textValue(item && item.content).trim()
    || textValue(item && item.summary).trim()
  );
}

function countBy(items, predicate) {
  return (Array.isArray(items) ? items : []).filter(predicate).length;
}

function itemCountForTurns(turns, predicate = null) {
  let total = 0;
  for (const turn of Array.isArray(turns) ? turns : []) {
    if (predicate && !predicate(turn)) continue;
    total += Array.isArray(turn && turn.items) ? turn.items.length : 0;
  }
  return total;
}

function trailingIndexes(items, limit, predicate) {
  const max = Math.max(0, Math.trunc(Number(limit) || 0));
  const out = new Set();
  if (max <= 0) return out;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (!predicate(items[index], index)) continue;
    out.add(index);
    if (out.size >= max) break;
  }
  return out;
}

function compactTurnWithBudget(turn, thread, options, stats) {
  if (!turn || typeof turn !== "object" || !Array.isArray(turn.items)) return turn;
  const active = isActiveTurn(turn, thread);
  const maxOperationItems = active ? options.activeOperationItems : options.completedOperationItems;
  const compactTurn = typeof options.compactTurn === "function" ? options.compactTurn : null;
  const beforeItems = turn.items;
  const beforeOperationCount = countBy(beforeItems, isOperationItem);
  const beforeReasoningCount = countBy(beforeItems, isReasoningItem);
  const beforeAssistantCount = countBy(beforeItems, isAssistantItem);
  const compacted = compactTurn
    ? compactTurn(turn, {
      allowOperations: true,
      maxOperationItems,
      threadId: thread && thread.id || "",
    })
    : cloneJson(turn);
  if (!compacted || !Array.isArray(compacted.items)) return compacted;
  const reasoningLimit = active ? options.activeReasoningItems : options.completedReasoningItems;
  const keepReasoningIndexes = trailingIndexes(
    compacted.items,
    reasoningLimit,
    (item) => isReasoningItem(item) && (active || reasoningHasVisibleText(item)),
  );
  compacted.items = compacted.items.filter((item, index) => {
    if (!isReasoningItem(item)) return true;
    return keepReasoningIndexes.has(index);
  });
  const assistantLimit = active ? options.activeAssistantItems : options.completedAssistantItems;
  const keepAssistantIndexes = trailingIndexes(
    compacted.items,
    assistantLimit,
    isAssistantItem,
  );
  compacted.items = compacted.items.filter((item, index) => {
    if (!isAssistantItem(item)) return true;
    return keepAssistantIndexes.has(index);
  });
  const afterOperationCount = countBy(compacted.items, isOperationItem);
  const afterReasoningCount = countBy(compacted.items, isReasoningItem);
  const afterAssistantCount = countBy(compacted.items, isAssistantItem);
  const omittedAssistantItems = Math.max(0, beforeAssistantCount - afterAssistantCount);
  if (omittedAssistantItems > 0) {
    compacted.mobileOmittedAssistantItemCount = omittedAssistantItems;
    compacted.mobileAssistantItemBudget = {
      version: "thread-detail-assistant-item-budget-v1",
      omitted: omittedAssistantItems,
      retained: afterAssistantCount,
      original: beforeAssistantCount,
    };
  } else {
    delete compacted.mobileOmittedAssistantItemCount;
    delete compacted.mobileAssistantItemBudget;
  }
  stats.originalItemCount += beforeItems.length;
  stats.retainedItemCount += compacted.items.length;
  stats.omittedOperationItems += Math.max(0, beforeOperationCount - afterOperationCount);
  stats.omittedReasoningItems += Math.max(0, beforeReasoningCount - afterReasoningCount);
  stats.omittedAssistantItems += omittedAssistantItems;
  stats.activeTurnCount += active ? 1 : 0;
  stats.staleActiveTurnCount += !active && isStaleActiveLikeTurn(turn, thread) ? 1 : 0;
  return compacted;
}

function compactThreadDetailResponseResult(result, options = {}) {
  if (!result || typeof result !== "object" || !result.thread || !Array.isArray(result.thread.turns)) return result;
  const out = cloneJson(result);
  const thread = out.thread;
  const configuredActiveOperationItems = boundedCount(options.activeOperationItems, DEFAULT_ACTIVE_OPERATION_ITEMS, 100);
  const configuredActiveReasoningItems = boundedCount(options.activeReasoningItems, DEFAULT_ACTIVE_REASONING_ITEMS, 100);
  const configuredActiveAssistantItems = Math.max(1, boundedCount(options.activeAssistantItems, DEFAULT_ACTIVE_ASSISTANT_ITEMS, 100));
  const activeProgressiveItemThreshold = boundedCount(
    options.activeProgressiveItemThreshold,
    DEFAULT_ACTIVE_PROGRESSIVE_ITEM_THRESHOLD,
    10000,
  );
  const pressureOriginalItemCount = itemCountForTurns(thread.turns);
  const pressureActiveItemCount = itemCountForTurns(thread.turns, (turn) => isActiveTurn(turn, thread));
  const progressiveActiveBudgetApplied = activeProgressiveItemThreshold > 0
    && (pressureOriginalItemCount >= activeProgressiveItemThreshold
      || pressureActiveItemCount >= activeProgressiveItemThreshold);
  const progressiveActiveOperationItems = boundedCount(
    options.progressiveActiveOperationItems,
    DEFAULT_PROGRESSIVE_ACTIVE_OPERATION_ITEMS,
    100,
  );
  const progressiveActiveReasoningItems = boundedCount(
    options.progressiveActiveReasoningItems,
    DEFAULT_PROGRESSIVE_ACTIVE_REASONING_ITEMS,
    100,
  );
  const progressiveActiveAssistantItems = Math.max(1, boundedCount(
    options.progressiveActiveAssistantItems,
    DEFAULT_PROGRESSIVE_ACTIVE_ASSISTANT_ITEMS,
    100,
  ));
  const effectiveActiveOperationItems = progressiveActiveBudgetApplied
    ? Math.min(configuredActiveOperationItems, progressiveActiveOperationItems)
    : configuredActiveOperationItems;
  const effectiveActiveReasoningItems = progressiveActiveBudgetApplied
    ? Math.min(configuredActiveReasoningItems, progressiveActiveReasoningItems)
    : configuredActiveReasoningItems;
  const effectiveActiveAssistantItems = progressiveActiveBudgetApplied
    ? Math.min(configuredActiveAssistantItems, progressiveActiveAssistantItems)
    : configuredActiveAssistantItems;
  const stats = {
    version: "thread-detail-response-budget-v2",
    applied: false,
    originalItemCount: 0,
    retainedItemCount: 0,
    omittedOperationItems: 0,
    omittedReasoningItems: 0,
    omittedAssistantItems: 0,
    activeTurnCount: 0,
    staleActiveTurnCount: 0,
    completedOperationItems: boundedCount(options.completedOperationItems, DEFAULT_COMPLETED_OPERATION_ITEMS, 100),
    activeOperationItems: effectiveActiveOperationItems,
    completedReasoningItems: boundedCount(options.completedReasoningItems, DEFAULT_COMPLETED_REASONING_ITEMS, 100),
    activeReasoningItems: effectiveActiveReasoningItems,
    completedAssistantItems: Math.max(1, boundedCount(options.completedAssistantItems, DEFAULT_COMPLETED_ASSISTANT_ITEMS, 100)),
    activeAssistantItems: effectiveActiveAssistantItems,
    activeProgressiveItemThreshold,
    progressiveActiveBudgetApplied,
    progressiveActiveBudgetReason: progressiveActiveBudgetApplied
      ? (pressureActiveItemCount >= activeProgressiveItemThreshold ? "active-item-pressure" : "thread-item-pressure")
      : "",
    progressiveActiveOriginalItemCount: pressureOriginalItemCount,
    progressiveActiveTurnOriginalItemCount: pressureActiveItemCount,
  };
  if (progressiveActiveBudgetApplied) {
    stats.configuredActiveOperationItems = configuredActiveOperationItems;
    stats.configuredActiveReasoningItems = configuredActiveReasoningItems;
    stats.configuredActiveAssistantItems = configuredActiveAssistantItems;
  }
  const budgetOptions = Object.assign({}, options, stats);
  thread.turns = thread.turns.map((turn) => compactTurnWithBudget(turn, thread, budgetOptions, stats));
  stats.applied = stats.omittedOperationItems > 0
    || stats.omittedReasoningItems > 0
    || stats.omittedAssistantItems > 0;
  if (!stats.applied) return out;
  const revision = thread.mobileProjectionRevision;
  const normalized = normalizeThreadVisibleProjection(out, {
    source: thread.mobileReadMode || "thread-detail-response-budget",
    revision,
  });
  if (normalized && normalized.thread) normalized.thread.mobileDetailResponseBudget = stats;
  return normalized;
}

module.exports = {
  compactThreadDetailResponseResult,
  isAssistantItem,
  isOperationItem,
  isReasoningItem,
};
