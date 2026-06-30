"use strict";

const { normalizeThreadVisibleProjection } = require("./thread-visible-item-normalizer");
const {
  orderItemsByDisplayTimestamp,
} = require("./thread-detail-active-window-overlay-policy-service");

const DEFAULT_COMPLETED_OPERATION_ITEMS = 4;
const DEFAULT_ACTIVE_OPERATION_ITEMS = 12;
const DEFAULT_ACTIVE_REASONING_ITEMS = 2;
const DEFAULT_COMPLETED_REASONING_ITEMS = 0;
const DEFAULT_ACTIVE_ASSISTANT_ITEMS = 8;
const DEFAULT_COMPLETED_ASSISTANT_ITEMS = 1;
const DEFAULT_ACTIVE_PROGRESSIVE_ITEM_THRESHOLD = 50;
const DEFAULT_ACTIVE_PROGRESSIVE_ACTIVE_BYTES = 48 * 1024;
const DEFAULT_ACTIVE_PROGRESSIVE_THREAD_BYTES = 160 * 1024;
const DEFAULT_PROGRESSIVE_ACTIVE_OPERATION_ITEMS = 6;
const DEFAULT_PROGRESSIVE_ACTIVE_REASONING_ITEMS = 1;
const DEFAULT_PROGRESSIVE_ACTIVE_ASSISTANT_ITEMS = 4;
const DEFAULT_PROGRESSIVE_REPLAY_ASSISTANT_ITEMS = 8;
const DEFAULT_PROGRESSIVE_COMPLETED_REPLAY_ASSISTANT_ITEMS = 12;
const DEFAULT_PROGRESSIVE_ACTIVE_TEXT_CHARS = 12 * 1024;
const DEFAULT_PROGRESSIVE_ACTIVE_OPERATION_PAYLOAD_CHARS = 6 * 1024;
const DEFAULT_PROGRESSIVE_ACTIVE_USER_TEXT_CHARS = 10 * 1024;
const DEFAULT_PROGRESSIVE_VISIBLE_ITEM_CEILING = 48;
const DEFAULT_PROGRESSIVE_FIRST_PAINT_THREAD_BYTES = 160 * 1024;
const DEFAULT_PROGRESSIVE_ACTIVE_FIRST_PAINT_THREAD_BYTES = 96 * 1024;
const DEFAULT_PROGRESSIVE_COMPLETED_TEXT_CHARS = 8 * 1024;
const DEFAULT_PROGRESSIVE_COMPLETED_USER_TEXT_CHARS = 1024;
const ACTIVE_TEXT_BUDGET_MARKER = "\n\n[active item preview truncated]\n\n";
const OPERATION_PAYLOAD_BUDGET_MARKER = "\n\n[operation payload preview truncated]\n\n";
const USER_INPUT_BUDGET_MARKER = "\n\n[active user input preview truncated]\n\n";
const FIRST_PAINT_TEXT_BUDGET_MARKER = "\n\n[first-paint preview truncated]\n\n";
const FIRST_PAINT_USER_INPUT_BUDGET_MARKER = "\n\n[first-paint user input preview truncated]\n\n";

const OPERATION_ITEM_TYPES = new Set([
  "commandExecution",
  "collabAgentToolCall",
  "fileChange",
  "dynamicToolCall",
  "mcpToolCall",
]);

const OPERATION_STRING_PAYLOAD_FIELDS = [
  "command",
  "message",
  "text",
  "summary",
  "detail",
  "task",
  "prompt",
  "description",
  "instructions",
];

const OPERATION_STRUCTURED_PAYLOAD_FIELDS = [
  "arguments",
  "result",
  "contentItems",
  "changes",
  "action",
  "request",
  "response",
];

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

function compactNumberMap(value = {}, limit = 12) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const entries = Object.entries(source)
    .map(([key, raw]) => {
      const number = Number(raw);
      if (!Number.isFinite(number) || number <= 0) return null;
      return [String(key || "unknown").slice(0, 60), Math.trunc(number)];
    })
    .filter(Boolean)
    .sort((left, right) => right[1] - left[1])
    .slice(0, Math.max(1, Math.trunc(Number(limit) || 12)));
  return Object.fromEntries(entries);
}

function attachNonZeroBudgetNumber(target, source, key) {
  const number = Number(source && source[key]);
  if (Number.isFinite(number) && number > 0) target[key] = Math.trunc(number);
}

function attachTruthyBudgetValue(target, source, key) {
  const value = source && source[key];
  if (value === true) target[key] = true;
  else if (typeof value === "string" && value.trim()) target[key] = value;
}

function compactResponseBudgetEvidence(stats = {}) {
  const out = {
    version: stats.version || "thread-detail-response-budget-v2",
    evidenceLevel: "compact",
    applied: stats.applied === true,
    progressiveActiveBudgetApplied: stats.progressiveActiveBudgetApplied === true,
  };
  attachTruthyBudgetValue(out, stats, "progressiveActiveBudgetReason");
  for (const key of [
    "originalItemCount",
    "retainedItemCount",
    "omittedOperationItems",
    "omittedReasoningItems",
    "omittedAssistantItems",
    "omittedVisibleItems",
    "activeTurnCount",
    "staleActiveTurnCount",
    "activeOperationItems",
    "activeReasoningItems",
    "activeAssistantItems",
    "progressiveReplayAssistantItems",
    "limitedReplayAssistantItems",
    "progressiveCompletedReplayAssistantItems",
    "limitedCompletedReplayAssistantItems",
    "progressiveVisibleItemCeiling",
    "progressiveVisibleItemOriginalCount",
    "progressiveVisibleItemRetainedCount",
    "progressiveActiveFirstPaintThreadByteCeiling",
    "progressiveActiveFirstPaintBytesAfterTaskCardBudget",
    "progressiveActiveFirstPaintBytesAfterUsageSummaryOnlyBudget",
    "progressiveActiveFirstPaintOverCeilingBytes",
    "retainedVisibleItemCountForByteStats",
    "retainedVisibleItemBytesForByteStats",
    "retainedVisibleItemLargestBytes",
  ]) {
    attachNonZeroBudgetNumber(out, stats, key);
  }
  for (const key of [
    "prunedEmptyActivePlaceholderTurns",
    "remappedMissingActiveTurnId",
    "clearedMissingActiveTurnId",
    "repairedVisibleActiveTurnStatus",
    "downgradedStaleActiveTurns",
    "truncatedActiveUserMessageItems",
    "truncatedActiveTextItems",
    "truncatedActiveOperationPayloadItems",
    "truncatedCompletedTextItems",
    "truncatedCompletedUserInputItems",
    "truncatedCompletedUsageItems",
    "truncatedCompletedUsageSummaryOnlyItems",
    "omittedActiveUserInputChars",
    "omittedActiveTextChars",
    "omittedActiveOperationPayloadChars",
    "omittedCompletedTextChars",
    "omittedCompletedUserInputChars",
    "omittedCompletedUsageBytes",
    "omittedCompletedUsageSummaryOnlyBytes",
    "progressiveThreadTaskCardCompactedCount",
    "progressiveThreadTaskCardSettledCompactedCount",
    "progressiveThreadTaskCardOmittedBytes",
  ]) {
    attachNonZeroBudgetNumber(out, stats, key);
  }
  for (const key of [
    "progressiveCompletedReplayAssistantBudgetApplied",
    "progressiveCompletedTextBudgetApplied",
    "progressiveCompletedUserInputBudgetApplied",
    "progressiveCompletedUsageBudgetApplied",
    "progressiveCompletedUsageSummaryOnlyBudgetApplied",
    "progressiveThreadTaskCardBudgetApplied",
    "progressiveVisibleItemBudgetApplied",
    "progressiveActiveFirstPaintItemBudgetApplied",
  ]) {
    attachTruthyBudgetValue(out, stats, key);
  }
  for (const key of [
    "progressiveCompletedReplayAssistantBudgetReason",
    "progressiveCompletedTextBudgetReason",
    "progressiveCompletedUserInputBudgetReason",
    "progressiveCompletedUserInputBudgetMode",
    "progressiveCompletedUsageBudgetReason",
    "progressiveCompletedUsageSummaryOnlyBudgetReason",
    "progressiveThreadTaskCardBudgetReason",
    "progressiveVisibleItemBudgetReason",
    "progressiveActiveFirstPaintItemBudgetReason",
    "retainedVisibleItemLargestKind",
  ]) {
    attachTruthyBudgetValue(out, stats, key);
  }
  for (const key of [
    "retainedVisibleItemCountByKind",
    "retainedVisibleItemBytesByKind",
    "retainedAssistantItemCountByTurnState",
    "retainedAssistantItemBytesByTurnState",
    "retainedUserInputItemCountByTurnState",
    "retainedUserInputItemBytesByTurnState",
  ]) {
    const compacted = compactNumberMap(stats[key]);
    if (Object.keys(compacted).length) out[key] = compacted;
  }
  return out;
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

function isCompletedStatus(value) {
  return /completed|failed|cancel|error|interrupted/i.test(statusText(value));
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

function isStaleActiveCompletionStatus(value) {
  return Boolean(value && typeof value === "object" && value.mobileStaleActiveTurn === true);
}

function isLatestCompletedReplayTurn(turn, thread) {
  if (!turn || !thread || !Array.isArray(thread.turns)) return false;
  for (let index = thread.turns.length - 1; index >= 0; index -= 1) {
    const candidate = thread.turns[index];
    if (isActiveTurn(candidate, thread)) continue;
    if (isStaleActiveCompletionStatus(candidate && candidate.status)) continue;
    if (!turnHasItems(candidate)) continue;
    if (!isCompletedStatus(candidate && candidate.status)) continue;
    return candidate === turn;
  }
  return false;
}

function shouldLimitPreservedReplayAssistants(turn, thread, options) {
  if (!options || options.progressiveActiveBudgetApplied !== true) return false;
  if (isActiveTurn(turn, thread)) return true;
  const id = turnId(turn);
  return Boolean(id
    && options.protectedCompletedReplayTurnIds
    && options.protectedCompletedReplayTurnIds.has(id));
}

function completedReplayProtection(thread) {
  const protection = {
    latestCompletedTurnId: "",
    richCompletedTurnId: "",
    latestCompletedAssistantItems: 0,
    protectedIds: new Set(),
  };
  if (!thread || !Array.isArray(thread.turns)) return protection;
  for (let index = thread.turns.length - 1; index >= 0; index -= 1) {
    const candidate = thread.turns[index];
    if (isActiveTurn(candidate, thread)) continue;
    if (isStaleActiveCompletionStatus(candidate && candidate.status)) continue;
    if (!turnHasItems(candidate)) continue;
    if (!isCompletedStatus(candidate && candidate.status)) continue;
    const id = turnId(candidate);
    if (!id) continue;
    protection.latestCompletedTurnId = id;
    protection.latestCompletedAssistantItems = countBy(candidate.items, isAssistantItem);
    protection.protectedIds.add(id);
    break;
  }
  if (protection.latestCompletedAssistantItems > 1) return protection;
  for (let index = thread.turns.length - 1; index >= 0; index -= 1) {
    const candidate = thread.turns[index];
    const id = turnId(candidate);
    if (!id || id === protection.latestCompletedTurnId) continue;
    if (isActiveTurn(candidate, thread)) continue;
    if (isStaleActiveCompletionStatus(candidate && candidate.status)) continue;
    if (!turnHasItems(candidate)) continue;
    if (!isCompletedStatus(candidate && candidate.status)) continue;
    if (countBy(candidate.items, isAssistantItem) <= 1) continue;
    protection.richCompletedTurnId = id;
    protection.protectedIds.add(id);
    break;
  }
  return protection;
}

function isNonCurrentEmptyActivePlaceholderTurn(turn, thread) {
  const id = turnId(turn);
  const activeId = activeTurnId(thread);
  if (!id || !activeId || id === activeId) return false;
  if (!isActiveStatus(turn && turn.status)) return false;
  return !Array.isArray(turn && turn.items) || turn.items.length === 0;
}

function isStaleActiveLikeTurn(turn, thread) {
  const id = turnId(turn);
  const activeId = activeTurnId(thread);
  return Boolean(activeId && id && id !== activeId && isActiveStatus(turn && turn.status));
}

function turnHasItems(turn) {
  return Boolean(turn && Array.isArray(turn.items) && turn.items.length > 0);
}

function activeStatusFromVisibleRuntime(value) {
  if (isActiveStatus(value)) return value;
  return {
    type: "active",
    mobileRuntimeDerived: true,
    previousType: statusText(value),
  };
}

function staleCompletedStatusFromActive(value) {
  if (isCompletedStatus(value)) return value;
  return {
    type: "completed",
    mobileStaleActiveTurn: true,
    previousType: statusText(value),
  };
}

function reconcileVisibleActiveTurnState(thread, stats) {
  if (!thread || !Array.isArray(thread.turns)) return;
  let activeId = activeTurnId(thread);
  let activeIndex = activeId
    ? thread.turns.findIndex((turn) => turnId(turn) === activeId)
    : -1;
  if (activeId && activeIndex < 0) {
    for (let index = thread.turns.length - 1; index >= 0; index -= 1) {
      const turn = thread.turns[index];
      if (!turnHasItems(turn) || !isActiveStatus(turn && turn.status)) continue;
      activeId = turnId(turn);
      activeIndex = index;
      thread.activeTurnId = activeId;
      stats.remappedMissingActiveTurnId += 1;
      break;
    }
    if (activeIndex < 0) {
      delete thread.activeTurnId;
      stats.clearedMissingActiveTurnId += 1;
      activeId = "";
    }
  }
  if (activeIndex >= 0) {
    const activeTurn = thread.turns[activeIndex];
    if (activeTurn && !isCompletedStatus(activeTurn.status) && !isActiveStatus(activeTurn.status)) {
      activeTurn.status = activeStatusFromVisibleRuntime(activeTurn.status);
      stats.repairedVisibleActiveTurnStatus += 1;
    }
  }
  const currentActiveId = activeTurnId(thread);
  if (!currentActiveId) return;
  for (const turn of thread.turns) {
    const id = turnId(turn);
    if (!id || id === currentActiveId) continue;
    if (!isActiveStatus(turn && turn.status)) continue;
    turn.status = staleCompletedStatusFromActive(turn.status);
    stats.downgradedStaleActiveTurns += 1;
    stats.staleActiveTurnCount += 1;
  }
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

function isUserMessageItem(item) {
  return String(item && item.type || "") === "userMessage";
}

function isUsageItem(item) {
  return String(item && item.type || "") === "turnUsageSummary";
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

function budgetableVisibleItemKind(item) {
  if (isOperationItem(item)) return "operation";
  if (isReasoningItem(item)) return "reasoning";
  if (isAssistantItem(item)) return "assistant";
  return "";
}

function itemCountForTurns(turns, predicate = null) {
  let total = 0;
  for (const turn of Array.isArray(turns) ? turns : []) {
    if (predicate && !predicate(turn)) continue;
    total += Array.isArray(turn && turn.items) ? turn.items.length : 0;
  }
  return total;
}

function jsonByteLength(value) {
  if (value === undefined) return 0;
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch (_) {
    return 0;
  }
}

function stringByteLength(value) {
  return typeof value === "string" ? Buffer.byteLength(value, "utf8") : 0;
}

function dataImageStringBytes(value) {
  if (typeof value !== "string") return 0;
  return /^data:image\//i.test(value) ? Buffer.byteLength(value, "utf8") : 0;
}

function retainedUserInputShapeBytes(item) {
  const out = {};
  if (!item || typeof item !== "object") return out;
  const itemBytes = jsonByteLength(item);
  let directTextBytes = 0;
  for (const field of ["text", "message"]) {
    directTextBytes += stringByteLength(item[field]);
  }
  let contentBytes = 0;
  let contentTextBytes = 0;
  let inlineImageBytes = 0;
  if (Array.isArray(item.content)) {
    contentBytes = jsonByteLength(item.content);
    for (const entry of item.content) {
      if (!entry || typeof entry !== "object") continue;
      for (const field of ["text", "input_text", "content"]) {
        contentTextBytes += stringByteLength(entry[field]);
      }
      for (const field of ["url", "image_url", "imageUrl"]) {
        inlineImageBytes += dataImageStringBytes(entry[field]);
      }
    }
  }
  const contentAuxiliaryBytes = Math.max(0, contentBytes - contentTextBytes - inlineImageBytes);
  const itemAuxiliaryBytes = Math.max(0, itemBytes - directTextBytes - contentBytes);
  addNumericBucket(out, "directText", directTextBytes);
  addNumericBucket(out, "contentText", contentTextBytes);
  addNumericBucket(out, "inlineImageData", inlineImageBytes);
  addNumericBucket(out, "contentAuxiliary", contentAuxiliaryBytes);
  addNumericBucket(out, "itemAuxiliary", itemAuxiliaryBytes);
  return out;
}

function retainedAssistantShapeBytes(item) {
  const out = {};
  if (!item || typeof item !== "object") return out;
  const itemBytes = jsonByteLength(item);
  let directTextBytes = 0;
  for (const field of ["text", "message", "summary"]) {
    directTextBytes += stringByteLength(item[field]);
  }
  let contentBytes = 0;
  let contentTextBytes = 0;
  let inlineImageBytes = 0;
  if (Array.isArray(item.content)) {
    contentBytes = jsonByteLength(item.content);
    for (const entry of item.content) {
      if (!entry || typeof entry !== "object") continue;
      for (const field of ["text", "input_text", "content", "message", "summary"]) {
        contentTextBytes += stringByteLength(entry[field]);
      }
      for (const field of ["url", "image_url", "imageUrl"]) {
        inlineImageBytes += dataImageStringBytes(entry[field]);
      }
    }
  } else if (typeof item.content === "string") {
    contentBytes = jsonByteLength(item.content);
    contentTextBytes += stringByteLength(item.content);
  }
  const contentAuxiliaryBytes = Math.max(0, contentBytes - contentTextBytes - inlineImageBytes);
  const itemAuxiliaryBytes = Math.max(0, itemBytes - directTextBytes - contentBytes);
  addNumericBucket(out, "directText", directTextBytes);
  addNumericBucket(out, "contentText", contentTextBytes);
  addNumericBucket(out, "inlineImageData", inlineImageBytes);
  addNumericBucket(out, "contentAuxiliary", contentAuxiliaryBytes);
  addNumericBucket(out, "itemAuxiliary", itemAuxiliaryBytes);
  return out;
}

function addNumberMapBuckets(target, source) {
  if (!target || !source || typeof source !== "object") return;
  for (const [key, value] of Object.entries(source)) {
    addNumericBucket(target, key, value);
  }
}

function visibleItemByteKind(item) {
  const type = String(item && item.type || "");
  if (isUserMessageItem(item)) return "userMessage";
  if (isAssistantItem(item)) return "assistant";
  if (isReasoningItem(item)) return "reasoning";
  if (isOperationItem(item)) return "operation";
  if (/usage/i.test(type)) return "usage";
  if (/image|media/i.test(type)) return "media";
  if (/diagnostic/i.test(type)) return "diagnostic";
  if (/task.?card/i.test(type)) return "taskCard";
  return type ? "other" : "unknown";
}

function addNumericBucket(target, key, amount) {
  const safeKey = String(key || "unknown").slice(0, 40);
  const value = Math.max(0, Math.trunc(Number(amount) || 0));
  if (!value) return;
  target[safeKey] = Math.max(0, Math.trunc(Number(target[safeKey]) || 0)) + value;
}

function compactTaskCardEndpoint(value) {
  if (!value || typeof value !== "object") return undefined;
  const out = {};
  for (const field of ["threadId", "workspaceId"]) {
    const text = String(value[field] || "").trim();
    if (text) out[field] = text;
  }
  return Object.keys(out).length ? out : undefined;
}

function taskCardHasAction(card) {
  return Boolean(card && (
    card.canApprove === true
    || card.canDelete === true
    || card.canReply === true
    || card.canRevoke === true
  ));
}

function taskCardNeedsFirstPaintActionShape(card) {
  if (taskCardHasAction(card)) return true;
  const status = String(card && card.status || "").trim();
  const threadRole = String(card && card.threadRole || "").trim();
  return status === "pending" && threadRole === "target";
}

function compactSettledThreadTaskCardForFirstPaint(card) {
  return {
    id: String(card && card.id || ""),
    status: String(card && card.status || "completed"),
    threadRole: String(card && card.threadRole || ""),
    mobileTaskCardCompacted: true,
    mobileTaskCardSettledCompacted: true,
  };
}

function compactTaskCardMessageForFirstPaint(message) {
  const source = message && typeof message === "object" ? message : {};
  const out = {};
  for (const field of ["title", "summary"]) {
    const text = String(source[field] || "").trim();
    if (text) out[field] = text;
  }
  if (source.bodyOmitted === true) out.bodyOmitted = true;
  const bodyChars = Math.max(0, Math.trunc(Number(source.bodyChars) || 0));
  if (bodyChars > 0) out.bodyChars = bodyChars;
  return Object.keys(out).length ? out : undefined;
}

function compactTaskCardWorkflowForFirstPaint(workflow) {
  if (!workflow || typeof workflow !== "object") return undefined;
  const out = {};
  for (const field of ["id", "mode"]) {
    const text = String(workflow[field] || "").trim();
    if (text) out[field] = text;
  }
  if (typeof workflow.authorized === "boolean") out.authorized = workflow.authorized;
  return Object.keys(out).length ? out : undefined;
}

function compactThreadTaskCardForFirstPaint(card) {
  if (!taskCardNeedsFirstPaintActionShape(card)) {
    return compactSettledThreadTaskCardForFirstPaint(card);
  }
  const out = {
    id: String(card && card.id || ""),
    status: String(card && card.status || "completed"),
    mobileTaskCardCompacted: true,
  };
  for (const field of ["threadRole", "createdAt", "updatedAt", "ackPolicy", "replyCardId", "sourceCardId"]) {
    const value = card && card[field];
    if (value !== undefined && value !== null && value !== "") out[field] = value;
  }
  for (const field of ["terminal", "requiresReturn"]) {
    if (typeof (card && card[field]) === "boolean") out[field] = card[field];
  }
  for (const field of ["canApprove", "canDelete", "canReply", "canRevoke"]) {
    if (typeof (card && card[field]) === "boolean") out[field] = card[field];
  }
  const workflow = compactTaskCardWorkflowForFirstPaint(card && card.workflow);
  if (workflow) out.workflow = workflow;
  const message = compactTaskCardMessageForFirstPaint(card && card.message);
  if (message) out.message = message;
  const source = compactTaskCardEndpoint(card && card.source);
  if (source) out.source = source;
  const target = compactTaskCardEndpoint(card && card.target);
  if (target) out.target = target;
  return out;
}

function retainedVisibleTurnState(turn, thread) {
  if (isActiveTurn(turn, thread)) return "active";
  if (isStaleActiveLikeTurn(turn, thread) || isStaleActiveCompletionStatus(turn && turn.status)) return "staleActive";
  if (isCompletedStatus(turn && turn.status)) return "completed";
  return "other";
}

function annotateRetainedVisibleItemByteStats(thread, stats) {
  const countsByKind = {};
  const bytesByKind = {};
  const assistantCountByTurnState = {};
  const assistantBytesByTurnState = {};
  const assistantBytesByShape = {};
  const activeAssistantBytesByShape = {};
  const completedAssistantBytesByShape = {};
  const staleActiveAssistantBytesByShape = {};
  const otherAssistantBytesByShape = {};
  const userMessageCountByTurnState = {};
  const userMessageBytesByTurnState = {};
  const userInputBytesByShape = {};
  const activeUserInputBytesByShape = {};
  const completedUserInputBytesByShape = {};
  const staleActiveUserInputBytesByShape = {};
  const otherUserInputBytesByShape = {};
  let totalItems = 0;
  let totalBytes = 0;
  let largestKind = "";
  let largestBytes = 0;
  for (const turn of Array.isArray(thread && thread.turns) ? thread.turns : []) {
    for (const item of Array.isArray(turn && turn.items) ? turn.items : []) {
      const kind = visibleItemByteKind(item);
      const bytes = jsonByteLength(item);
      totalItems += 1;
      totalBytes += bytes;
      addNumericBucket(countsByKind, kind, 1);
      addNumericBucket(bytesByKind, kind, bytes);
      if (isAssistantItem(item)) {
        const turnState = retainedVisibleTurnState(turn, thread);
        addNumericBucket(assistantCountByTurnState, turnState, 1);
        addNumericBucket(assistantBytesByTurnState, turnState, bytes);
        const shapeBytes = retainedAssistantShapeBytes(item);
        addNumberMapBuckets(assistantBytesByShape, shapeBytes);
        if (turnState === "active") addNumberMapBuckets(activeAssistantBytesByShape, shapeBytes);
        else if (turnState === "completed") addNumberMapBuckets(completedAssistantBytesByShape, shapeBytes);
        else if (turnState === "staleActive") addNumberMapBuckets(staleActiveAssistantBytesByShape, shapeBytes);
        else addNumberMapBuckets(otherAssistantBytesByShape, shapeBytes);
      }
      if (isUserMessageItem(item)) {
        const turnState = retainedVisibleTurnState(turn, thread);
        addNumericBucket(userMessageCountByTurnState, turnState, 1);
        addNumericBucket(userMessageBytesByTurnState, turnState, bytes);
        const shapeBytes = retainedUserInputShapeBytes(item);
        addNumberMapBuckets(userInputBytesByShape, shapeBytes);
        if (turnState === "active") addNumberMapBuckets(activeUserInputBytesByShape, shapeBytes);
        else if (turnState === "completed") addNumberMapBuckets(completedUserInputBytesByShape, shapeBytes);
        else if (turnState === "staleActive") addNumberMapBuckets(staleActiveUserInputBytesByShape, shapeBytes);
        else addNumberMapBuckets(otherUserInputBytesByShape, shapeBytes);
      }
      if (bytes > largestBytes) {
        largestBytes = bytes;
        largestKind = kind;
      }
    }
  }
  stats.retainedVisibleItemCountByKind = countsByKind;
  stats.retainedVisibleItemBytesByKind = bytesByKind;
  stats.retainedAssistantItemCountByTurnState = assistantCountByTurnState;
  stats.retainedAssistantItemBytesByTurnState = assistantBytesByTurnState;
  stats.retainedAssistantItemBytesByShape = assistantBytesByShape;
  stats.retainedActiveAssistantItemBytesByShape = activeAssistantBytesByShape;
  stats.retainedCompletedAssistantItemBytesByShape = completedAssistantBytesByShape;
  stats.retainedStaleActiveAssistantItemBytesByShape = staleActiveAssistantBytesByShape;
  stats.retainedOtherAssistantItemBytesByShape = otherAssistantBytesByShape;
  stats.retainedUserInputItemCountByTurnState = userMessageCountByTurnState;
  stats.retainedUserInputItemBytesByTurnState = userMessageBytesByTurnState;
  stats.retainedUserInputItemBytesByShape = userInputBytesByShape;
  stats.retainedActiveUserInputItemBytesByShape = activeUserInputBytesByShape;
  stats.retainedCompletedUserInputItemBytesByShape = completedUserInputBytesByShape;
  stats.retainedStaleActiveUserInputItemBytesByShape = staleActiveUserInputBytesByShape;
  stats.retainedOtherUserInputItemBytesByShape = otherUserInputBytesByShape;
  stats.retainedVisibleItemCountForByteStats = totalItems;
  stats.retainedVisibleItemBytesForByteStats = totalBytes;
  stats.retainedVisibleItemLargestKind = largestKind;
  stats.retainedVisibleItemLargestBytes = largestBytes;
  const ceiling = Math.max(0, Math.trunc(Number(stats.progressiveActiveFirstPaintThreadByteCeiling || 0)));
  const taskCardAfterBytes = Math.max(0, Math.trunc(Number(stats.progressiveActiveFirstPaintBytesAfterTaskCardBudget || 0)));
  const usageSummaryOnlyAfterBytes = Math.max(0, Math.trunc(Number(stats.progressiveActiveFirstPaintBytesAfterUsageSummaryOnlyBudget || 0)));
  const itemAfterBytes = Math.max(0, Math.trunc(Number(stats.progressiveActiveFirstPaintBytesAfterItemBudget || 0)));
  const afterBytes = usageSummaryOnlyAfterBytes || taskCardAfterBytes || itemAfterBytes;
  stats.progressiveActiveFirstPaintOverCeilingBytes = ceiling > 0 && afterBytes > ceiling
    ? afterBytes - ceiling
    : 0;
}

function byteLengthForTurns(turns, predicate = null) {
  let total = 0;
  for (const turn of Array.isArray(turns) ? turns : []) {
    if (predicate && !predicate(turn)) continue;
    total += jsonByteLength(turn);
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

function textCharLength(value) {
  return typeof value === "string" ? value.length : 0;
}

function truncateMiddleText(value, maxChars, marker = ACTIVE_TEXT_BUDGET_MARKER) {
  const text = String(value || "");
  const max = Math.max(0, Math.trunc(Number(maxChars) || 0));
  if (!max || text.length <= max) return text;
  const budgetMarker = String(marker || ACTIVE_TEXT_BUDGET_MARKER);
  if (max <= budgetMarker.length + 2) return text.slice(0, max);
  const available = max - budgetMarker.length;
  const head = Math.ceil(available * 0.55);
  const tail = Math.max(0, available - head);
  return `${text.slice(0, head)}${budgetMarker}${tail ? text.slice(-tail) : ""}`;
}

function compactStringForTextBudget(value, budget, marker = ACTIVE_TEXT_BUDGET_MARKER) {
  if (typeof value !== "string") return value;
  const originalChars = textCharLength(value);
  budget.originalChars += originalChars;
  if (!originalChars) return value;
  const remaining = Math.max(0, budget.maxChars - budget.retainedChars);
  if (originalChars <= remaining) {
    budget.retainedChars += originalChars;
    return value;
  }
  const compacted = remaining > 0 ? truncateMiddleText(value, remaining, marker) : "";
  const retainedChars = textCharLength(compacted);
  budget.retainedChars += retainedChars;
  budget.omittedChars += Math.max(0, originalChars - retainedChars);
  budget.truncated = true;
  return compacted;
}

function compactValueForTextBudget(value, budget, marker = ACTIVE_TEXT_BUDGET_MARKER) {
  if (typeof value === "string") return compactStringForTextBudget(value, budget, marker);
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (typeof entry === "string") return compactStringForTextBudget(entry, budget, marker);
      return entry;
    });
  }
  return value;
}

function compactActiveTextItem(item, options, stats) {
  if (!item || typeof item !== "object") return item;
  if (!isAssistantItem(item) && !isReasoningItem(item)) return item;
  const maxChars = Math.max(0, Math.trunc(Number(options.progressiveActiveTextChars || 0)));
  if (!maxChars) return item;
  const out = cloneJson(item);
  const budget = {
    maxChars,
    originalChars: 0,
    retainedChars: 0,
    omittedChars: 0,
    truncated: false,
    fields: [],
  };
  for (const field of ["text", "message", "content", "summary"]) {
    if (!(field in out)) continue;
    const beforeOriginal = budget.originalChars;
    out[field] = compactValueForTextBudget(out[field], budget, ACTIVE_TEXT_BUDGET_MARKER);
    if (budget.originalChars > beforeOriginal) budget.fields.push(field);
  }
  if (!budget.truncated) return item;
  const itemBudget = {
    version: "thread-detail-active-text-budget-v1",
    maxChars,
    originalChars: budget.originalChars,
    retainedChars: budget.retainedChars,
    omittedChars: budget.omittedChars,
    fields: budget.fields,
  };
  out.mobileActiveTextBudget = itemBudget;
  out.mobileTextTruncated = true;
  stats.truncatedActiveTextItems += 1;
  stats.activeTextOriginalChars += budget.originalChars;
  stats.activeTextRetainedChars += budget.retainedChars;
  stats.omittedActiveTextChars += budget.omittedChars;
  return out;
}

function compactImageDataUrlPartForUserInput(part, maxChars) {
  if (!part || typeof part !== "object") return { part, originalChars: 0, retainedChars: 0, omittedChars: 0, truncated: false, field: "" };
  const candidates = [
    ["url", part.url],
    ["image_url", part.image_url],
    ["imageUrl", part.imageUrl],
  ];
  for (const [field, raw] of candidates) {
    const url = raw && typeof raw === "object"
      ? String(raw.url || raw.uri || raw.href || "")
      : String(raw || "");
    if (!/^data:image\//i.test(url) || url.length <= maxChars) continue;
    const contentTypeMatch = /^data:([^;,]+)/i.exec(url);
    const next = Object.assign({}, part);
    const replacement = {
      truncated: true,
      contentType: contentTypeMatch ? contentTypeMatch[1].toLowerCase() : "image/*",
      totalChars: url.length,
      retainedChars: 0,
      omittedChars: url.length,
    };
    next[field] = replacement;
    next.mobileImagePayloadTruncated = true;
    return {
      part: next,
      originalChars: url.length,
      retainedChars: 0,
      omittedChars: url.length,
      truncated: true,
      field,
    };
  }
  return { part, originalChars: 0, retainedChars: 0, omittedChars: 0, truncated: false, field: "" };
}

function compactTextFieldForUserInput(out, field, budget) {
  if (!(field in out) || typeof out[field] !== "string") return false;
  const beforeOriginal = budget.originalChars;
  out[field] = compactValueForTextBudget(out[field], budget, USER_INPUT_BUDGET_MARKER);
  return budget.originalChars > beforeOriginal;
}

function createTextBudget(maxChars) {
  return {
    maxChars,
    originalChars: 0,
    retainedChars: 0,
    omittedChars: 0,
    truncated: false,
    fields: [],
  };
}

function stableBudgetPlaceholderToken(item = {}, field = "") {
  const seed = [
    item && (item.id || item.itemId || item.item_id),
    item && item.mobileVisibleKey,
    item && item.clientSubmissionId,
    item && (item.startedAtMs || item.startedAt || item.createdAtMs || item.createdAt || item.timestampMs || item.timestamp),
    field,
  ].map((value) => String(value || "").trim()).filter(Boolean).join("|");
  if (!seed) return "";
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function completedUserInputPlaceholderText(item = {}, field = "") {
  const token = stableBudgetPlaceholderToken(item, field);
  const suffix = token ? ` #${token}` : "";
  return `${FIRST_PAINT_USER_INPUT_BUDGET_MARKER.trim()}${suffix}`;
}

function ensureCompletedUserInputVisiblePlaceholder(value, budget, beforeRetained, beforeOmitted, item = {}, field = "") {
  if (typeof value !== "string" || value !== "") return value;
  if (budget.omittedChars <= beforeOmitted || budget.retainedChars > beforeRetained) return value;
  const placeholder = completedUserInputPlaceholderText(item, field);
  const placeholderChars = textCharLength(placeholder);
  if (!placeholderChars) return value;
  budget.retainedChars += placeholderChars;
  budget.omittedChars = Math.max(0, budget.omittedChars - placeholderChars);
  return placeholder;
}

function compactActiveUserMessageItem(item, options, stats, sharedBudget = null) {
  if (!item || typeof item !== "object" || !isUserMessageItem(item)) return item;
  const maxChars = Math.max(0, Math.trunc(Number(options.progressiveActiveUserTextChars || 0)));
  if (!maxChars) return item;
  const out = cloneJson(item);
  const budget = sharedBudget || createTextBudget(maxChars);
  const beforeOriginal = budget.originalChars;
  const beforeRetained = budget.retainedChars;
  const beforeOmitted = budget.omittedChars;
  const fields = [];
  for (const field of ["text", "message"]) {
    if (compactTextFieldForUserInput(out, field, budget)) fields.push(field);
  }
  if (Array.isArray(out.content)) {
    out.content = out.content.map((entry, index) => {
      if (!entry || typeof entry !== "object") return entry;
      const next = Object.assign({}, entry);
      for (const field of ["text", "input_text", "content"]) {
        if (compactTextFieldForUserInput(next, field, budget)) fields.push(`content.${field}`);
      }
      const imageResult = compactImageDataUrlPartForUserInput(next, maxChars);
      if (imageResult.truncated) {
        budget.originalChars += imageResult.originalChars;
        budget.retainedChars += imageResult.retainedChars;
        budget.omittedChars += imageResult.omittedChars;
        budget.truncated = true;
        fields.push(`content.${imageResult.field}`);
        return imageResult.part;
      }
      return next;
    });
  }
  const originalDelta = Math.max(0, budget.originalChars - beforeOriginal);
  const retainedDelta = Math.max(0, budget.retainedChars - beforeRetained);
  const omittedDelta = Math.max(0, budget.omittedChars - beforeOmitted);
  if (!omittedDelta) return item;
  out.mobileUserInputBudget = {
    version: "thread-detail-active-user-input-budget-v1",
    maxChars,
    originalChars: originalDelta,
    retainedChars: retainedDelta,
    omittedChars: omittedDelta,
    fields: [...new Set(fields)],
  };
  out.mobileUserInputTruncated = true;
  stats.truncatedActiveUserMessageItems += 1;
  stats.activeUserInputOriginalChars += originalDelta;
  stats.activeUserInputRetainedChars += retainedDelta;
  stats.omittedActiveUserInputChars += omittedDelta;
  return out;
}

function compactCompletedUserMessageItemForFirstPaint(item, options, stats, sharedBudget = null) {
  if (!item || typeof item !== "object" || !isUserMessageItem(item)) return item;
  const maxChars = Math.max(0, Math.trunc(Number(options.progressiveCompletedUserTextChars || 0)));
  if (!maxChars) return item;
  const out = cloneJson(item);
  const budget = sharedBudget || createTextBudget(maxChars);
  const beforeOriginal = budget.originalChars;
  const beforeRetained = budget.retainedChars;
  const beforeOmitted = budget.omittedChars;
  const fields = [];
  for (const field of ["text", "message"]) {
    if (!(field in out) || typeof out[field] !== "string") continue;
    const beforeOriginal = budget.originalChars;
    const beforeRetained = budget.retainedChars;
    const beforeOmitted = budget.omittedChars;
    out[field] = compactValueForTextBudget(out[field], budget, FIRST_PAINT_USER_INPUT_BUDGET_MARKER);
    out[field] = ensureCompletedUserInputVisiblePlaceholder(out[field], budget, beforeRetained, beforeOmitted, out, field);
    if (budget.originalChars > beforeOriginal) fields.push(field);
  }
  if (Array.isArray(out.content)) {
    out.content = out.content.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const next = Object.assign({}, entry);
      for (const field of ["text", "input_text", "content"]) {
        if (!(field in next) || typeof next[field] !== "string") continue;
        const beforeOriginal = budget.originalChars;
        const beforeRetained = budget.retainedChars;
        const beforeOmitted = budget.omittedChars;
        next[field] = compactValueForTextBudget(next[field], budget, FIRST_PAINT_USER_INPUT_BUDGET_MARKER);
        next[field] = ensureCompletedUserInputVisiblePlaceholder(next[field], budget, beforeRetained, beforeOmitted, out, `content.${field}`);
        if (budget.originalChars > beforeOriginal) fields.push(`content.${field}`);
      }
      return next;
    });
  }
  const originalDelta = Math.max(0, budget.originalChars - beforeOriginal);
  const retainedDelta = Math.max(0, budget.retainedChars - beforeRetained);
  const omittedDelta = Math.max(0, budget.omittedChars - beforeOmitted);
  if (!omittedDelta) return item;
  out.mobileFirstPaintUserInputBudget = {
    version: "thread-detail-first-paint-user-input-budget-v1",
    scope: "completed",
    maxChars,
    originalChars: originalDelta,
    retainedChars: retainedDelta,
    omittedChars: omittedDelta,
    fields: [...new Set(fields)],
  };
  out.mobileUserInputTruncated = true;
  stats.truncatedCompletedUserInputItems += 1;
  if (!sharedBudget) {
    stats.completedUserInputOriginalChars += originalDelta;
    stats.completedUserInputRetainedChars += retainedDelta;
    stats.omittedCompletedUserInputChars += omittedDelta;
  }
  return out;
}

const FIRST_PAINT_USAGE_SUMMARY_FIELDS = [
  "contextWindowUsedTokens",
  "modelContextWindow",
  "contextWindowUsedPercent",
  "contextRiskLevel",
  "lastTokenUsage",
  "totalTokenUsage",
  "rolloutSizeBytes",
  "rolloutWarningThresholdBytes",
  "rolloutOverWarningThreshold",
  "projectContextSizeBytes",
  "handoffSizeBytes",
  "workspaceContextPairSizeBytes",
  "workspaceContextFileThresholdBytes",
  "workspaceHandoffPromptThresholdBytes",
  "workspaceContextPairThresholdBytes",
];

const FIRST_PAINT_USAGE_SUMMARY_ONLY_FIELDS = [
  "contextWindowUsedPercent",
  "contextRiskLevel",
  "rolloutSizeBytes",
  "rolloutOverWarningThreshold",
];

function compactUsageSummaryForFirstPaint(summary, summaryOnly = false) {
  const source = summary && typeof summary === "object" && !Array.isArray(summary) ? summary : {};
  const out = {};
  const fields = summaryOnly ? FIRST_PAINT_USAGE_SUMMARY_ONLY_FIELDS : FIRST_PAINT_USAGE_SUMMARY_FIELDS;
  for (const field of fields) {
    if (source[field] !== undefined) out[field] = cloneJson(source[field]);
  }
  const totalTokenUsage = source.totalTokenUsage && typeof source.totalTokenUsage === "object"
    ? source.totalTokenUsage
    : null;
  if (summaryOnly) {
    if (totalTokenUsage && totalTokenUsage.totalTokens !== undefined) {
      out.totalTokenUsage = { totalTokens: cloneJson(totalTokenUsage.totalTokens) };
    }
    return out;
  }
  if (out.lastTokenUsage === undefined && source.finalTokenUsage !== undefined) {
    out.lastTokenUsage = cloneJson(source.finalTokenUsage);
  }
  return out;
}

function compactCompletedUsageItemForFirstPaint(item, stats) {
  if (!item || typeof item !== "object" || !isUsageItem(item)) return item;
  const summary = item.mobileUsageSummary;
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return item;
  const originalBytes = jsonByteLength(item);
  const nextSummary = compactUsageSummaryForFirstPaint(summary, false);
  const out = Object.assign({}, cloneJson(item), {
    mobileUsageSummary: nextSummary,
  });
  const compactedBytes = jsonByteLength(out);
  if (!originalBytes || compactedBytes >= originalBytes) return item;
  out.mobileFirstPaintUsageBudget = {
    scope: "completed",
    omittedBytes: Math.max(0, originalBytes - compactedBytes),
  };
  let retainedBytes = jsonByteLength(out);
  if (retainedBytes >= originalBytes) return item;
  out.mobileFirstPaintUsageBudget.omittedBytes = Math.max(0, originalBytes - retainedBytes);
  retainedBytes = jsonByteLength(out);
  if (retainedBytes >= originalBytes) return item;
  stats.truncatedCompletedUsageItems += 1;
  stats.completedUsageOriginalBytes += originalBytes;
  stats.completedUsageRetainedBytes += retainedBytes;
  stats.omittedCompletedUsageBytes += Math.max(0, originalBytes - retainedBytes);
  return out;
}

function compactCompletedUsageItemToSummaryOnlyForFirstPaint(item, stats) {
  if (!item || typeof item !== "object" || !isUsageItem(item)) return item;
  const summary = item.mobileUsageSummary;
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return item;
  const originalBytes = jsonByteLength(item);
  const nextSummary = compactUsageSummaryForFirstPaint(summary, true);
  const out = Object.assign({}, cloneJson(item), {
    mobileUsageSummary: nextSummary,
    mobileFirstPaintUsageBudget: {
      scope: "completed-summary-only",
      detailOmitted: true,
      omittedBytes: 0,
    },
  });
  let retainedBytes = jsonByteLength(out);
  if (!originalBytes || retainedBytes >= originalBytes) return item;
  out.mobileFirstPaintUsageBudget.omittedBytes = Math.max(0, originalBytes - retainedBytes);
  retainedBytes = jsonByteLength(out);
  if (retainedBytes >= originalBytes) return item;
  stats.truncatedCompletedUsageSummaryOnlyItems += 1;
  stats.completedUsageSummaryOnlyOriginalBytes += originalBytes;
  stats.completedUsageSummaryOnlyRetainedBytes += retainedBytes;
  stats.omittedCompletedUsageSummaryOnlyBytes += Math.max(0, originalBytes - retainedBytes);
  return out;
}

function compactStructuredValueForOperationPayload(value, maxChars) {
  const raw = JSON.stringify(value, null, 2);
  const original = textCharLength(raw);
  if (!original || original <= maxChars) {
    return {
      value,
      originalChars: original,
      retainedChars: original,
      omittedChars: 0,
      truncated: false,
    };
  }
  const preview = truncateMiddleText(raw, maxChars, OPERATION_PAYLOAD_BUDGET_MARKER);
  const retainedChars = textCharLength(preview);
  return {
    value: {
      truncated: true,
      preview,
      totalChars: original,
      retainedChars,
      omittedChars: Math.max(0, original - retainedChars),
    },
    originalChars: original,
    retainedChars,
    omittedChars: Math.max(0, original - retainedChars),
    truncated: true,
  };
}

function compactStringFieldForOperationPayload(value, maxChars, keepTail = false) {
  const text = String(value || "");
  const originalChars = textCharLength(text);
  if (!originalChars || originalChars <= maxChars) {
    return {
      value,
      originalChars,
      retainedChars: originalChars,
      omittedChars: 0,
      truncated: false,
    };
  }
  const compacted = keepTail
    ? text.slice(-maxChars)
    : truncateMiddleText(text, maxChars, OPERATION_PAYLOAD_BUDGET_MARKER);
  const retainedChars = textCharLength(compacted);
  return {
    value: compacted,
    originalChars,
    retainedChars,
    omittedChars: Math.max(0, originalChars - retainedChars),
    truncated: true,
  };
}

function compactActiveOperationPayloadItem(item, options, stats) {
  if (!item || typeof item !== "object" || !isOperationItem(item)) return item;
  const maxChars = Math.max(0, Math.trunc(Number(options.progressiveActiveOperationPayloadChars || 0)));
  if (!maxChars) return item;
  const out = cloneJson(item);
  const budget = {
    maxChars,
    originalChars: 0,
    retainedChars: 0,
    omittedChars: 0,
    truncated: false,
    fields: [],
  };
  const record = (field, result) => {
    if (!result || !result.originalChars) return;
    budget.originalChars += result.originalChars;
    budget.retainedChars += result.retainedChars;
    budget.omittedChars += result.omittedChars;
    if (result.truncated) {
      budget.truncated = true;
      budget.fields.push(field);
    }
    out[field] = result.value;
    if (field === "aggregatedOutput") {
      out.outputTotalChars = Math.max(Number(out.outputTotalChars || 0), result.originalChars);
    }
  };
  for (const field of ["aggregatedOutput", "output", "stdout", "stderr"]) {
    if (!(field in out) || typeof out[field] !== "string") continue;
    record(field, compactStringFieldForOperationPayload(out[field], maxChars, field === "aggregatedOutput"));
  }
  for (const field of OPERATION_STRING_PAYLOAD_FIELDS) {
    if (!(field in out) || typeof out[field] !== "string") continue;
    if (textCharLength(out[field]) <= maxChars) continue;
    record(field, compactStringFieldForOperationPayload(out[field], maxChars));
  }
  for (const field of OPERATION_STRUCTURED_PAYLOAD_FIELDS) {
    if (!(field in out) || out[field] === undefined || out[field] === null) continue;
    if (jsonByteLength(out[field]) <= maxChars) continue;
    record(field, compactStructuredValueForOperationPayload(out[field], maxChars));
  }
  if (!budget.truncated) return item;
  if (budget.fields.includes("aggregatedOutput")) out.outputTruncated = true;
  out.mobileOperationPayloadBudget = {
    version: "thread-detail-active-operation-payload-budget-v1",
    maxChars,
    originalChars: budget.originalChars,
    retainedChars: budget.retainedChars,
    omittedChars: budget.omittedChars,
    fields: budget.fields,
  };
  out.mobilePayloadTruncated = true;
  stats.truncatedActiveOperationPayloadItems += 1;
  stats.activeOperationPayloadOriginalChars += budget.originalChars;
  stats.activeOperationPayloadRetainedChars += budget.retainedChars;
  stats.omittedActiveOperationPayloadChars += budget.omittedChars;
  return out;
}

function compactCompletedTextItemForFirstPaint(item, options, stats) {
  if (!item || typeof item !== "object") return item;
  if (!isAssistantItem(item) && !isReasoningItem(item)) return item;
  const maxChars = Math.max(0, Math.trunc(Number(options.progressiveCompletedTextChars || 0)));
  if (!maxChars) return item;
  const out = cloneJson(item);
  const budget = {
    maxChars,
    originalChars: 0,
    retainedChars: 0,
    omittedChars: 0,
    truncated: false,
    fields: [],
  };
  for (const field of ["text", "message", "content", "summary"]) {
    if (!(field in out)) continue;
    const beforeOriginal = budget.originalChars;
    out[field] = compactValueForTextBudget(out[field], budget, FIRST_PAINT_TEXT_BUDGET_MARKER);
    if (budget.originalChars > beforeOriginal) budget.fields.push(field);
  }
  if (!budget.truncated) return item;
  out.mobileFirstPaintTextBudget = {
    version: "thread-detail-first-paint-text-budget-v1",
    scope: "completed",
    maxChars,
    originalChars: budget.originalChars,
    retainedChars: budget.retainedChars,
    omittedChars: budget.omittedChars,
    fields: budget.fields,
  };
  out.mobileTextTruncated = true;
  stats.truncatedCompletedTextItems += 1;
  stats.completedTextOriginalChars += budget.originalChars;
  stats.completedTextRetainedChars += budget.retainedChars;
  stats.omittedCompletedTextChars += budget.omittedChars;
  return out;
}

function removableVisibleItemCandidates(turns, thread, options = {}) {
  const entries = [];
  const includeActive = options.includeActive === true;
  for (let turnIndex = 0; turnIndex < turns.length; turnIndex += 1) {
    const turn = turns[turnIndex];
    if (!turn || !Array.isArray(turn.items)) continue;
    const active = isActiveTurn(turn, thread);
    if (active && !includeActive) continue;
    for (let itemIndex = 0; itemIndex < turn.items.length; itemIndex += 1) {
      const item = turn.items[itemIndex];
      const kind = budgetableVisibleItemKind(item);
      if (!kind || kind === "assistant") continue;
      entries.push({ turnIndex, itemIndex, kind, active });
    }
  }
  return entries.sort((left, right) => {
    if (left.active !== right.active) return left.active ? 1 : -1;
    const leftKindRank = left.kind === "operation" ? 0 : 1;
    const rightKindRank = right.kind === "operation" ? 0 : 1;
    if (leftKindRank !== rightKindRank) return leftKindRank - rightKindRank;
    if (left.turnIndex !== right.turnIndex) return left.turnIndex - right.turnIndex;
    return left.itemIndex - right.itemIndex;
  });
}

function removeVisibleItemIndexes(thread, removedIndexesByTurn, stats, input = {}) {
  const reason = String(input.reason || "progressive-visible-item-budget");
  const ceiling = Math.max(0, Math.trunc(Number(input.ceiling || 0)));
  let omitted = 0;
  for (const [turnIndex, indexes] of removedIndexesByTurn.entries()) {
    const turn = thread.turns[turnIndex];
    if (!turn || !Array.isArray(turn.items)) continue;
    const beforeCount = turn.items.length;
    const beforeOperationCount = countBy(turn.items, isOperationItem);
    const beforeReasoningCount = countBy(turn.items, isReasoningItem);
    const beforeAssistantCount = countBy(turn.items, isAssistantItem);
    turn.items = turn.items.filter((_, index) => !indexes.has(index));
    const afterOperationCount = countBy(turn.items, isOperationItem);
    const afterReasoningCount = countBy(turn.items, isReasoningItem);
    const afterAssistantCount = countBy(turn.items, isAssistantItem);
    const turnOmitted = Math.max(0, beforeCount - turn.items.length);
    if (!turnOmitted) continue;
    omitted += turnOmitted;
    const budget = Object.assign({}, turn.mobileVisibleItemBudget || {}, {
      version: "thread-detail-visible-item-budget-v1",
      reason,
      omitted: Math.max(0, Number(turn.mobileVisibleItemBudget && turn.mobileVisibleItemBudget.omitted || 0)) + turnOmitted,
      retained: turn.items.length,
      original: beforeCount,
    });
    if (ceiling) budget.ceiling = ceiling;
    turn.mobileVisibleItemBudget = budget;
    turn.mobileOmittedVisibleItemCount = budget.omitted;
    stats.omittedOperationItems += Math.max(0, beforeOperationCount - afterOperationCount);
    stats.omittedReasoningItems += Math.max(0, beforeReasoningCount - afterReasoningCount);
    stats.omittedAssistantItems += Math.max(0, beforeAssistantCount - afterAssistantCount);
  }
  if (!omitted) return 0;
  stats.omittedVisibleItems += omitted;
  stats.retainedItemCount = Math.max(0, stats.retainedItemCount - omitted);
  return omitted;
}

function applyProgressiveVisibleItemCeiling(thread, options, stats) {
  const maxItems = Math.max(0, Math.trunc(Number(options.progressiveVisibleItemCeiling || 0)));
  if (!maxItems || !thread || !Array.isArray(thread.turns)) return;
  const originalCount = itemCountForTurns(thread.turns);
  stats.progressiveVisibleItemCeiling = maxItems;
  stats.progressiveVisibleItemOriginalCount = originalCount;
  stats.progressiveVisibleItemRetainedCount = originalCount;
  if (!stats.progressiveActiveBudgetApplied || originalCount <= maxItems) return;
  let removeCount = originalCount - maxItems;
  const removedIndexesByTurn = new Map();
  for (const entry of removableVisibleItemCandidates(thread.turns, thread)) {
    if (removeCount <= 0) break;
    if (!removedIndexesByTurn.has(entry.turnIndex)) removedIndexesByTurn.set(entry.turnIndex, new Set());
    removedIndexesByTurn.get(entry.turnIndex).add(entry.itemIndex);
    removeCount -= 1;
  }
  const omitted = removeVisibleItemIndexes(thread, removedIndexesByTurn, stats, {
    reason: "progressive-visible-item-ceiling",
    ceiling: maxItems,
  });
  if (!omitted) return;
  stats.progressiveVisibleItemBudgetApplied = true;
  stats.progressiveVisibleItemRetainedCount = Math.max(0, originalCount - omitted);
  stats.progressiveVisibleItemBudgetReason = removeCount > 0
    ? "protected-visible-items"
    : "progressive-visible-item-ceiling";
}

function applyProgressiveActiveFirstPaintItemBudget(thread, options, stats) {
  const ceiling = Math.max(0, Math.trunc(Number(options.progressiveActiveFirstPaintThreadByteCeiling || 0)));
  const beforeBytes = jsonByteLength(thread);
  stats.progressiveActiveFirstPaintThreadByteCeiling = ceiling;
  stats.progressiveActiveFirstPaintBytesBeforeItemBudget = beforeBytes;
  stats.progressiveActiveFirstPaintBytesAfterItemBudget = beforeBytes;
  if (!stats.progressiveActiveBudgetApplied || !ceiling || beforeBytes <= ceiling) return;
  let totalOmitted = 0;
  let afterBytes = beforeBytes;
  for (let pass = 0; pass < 20 && afterBytes > ceiling; pass += 1) {
    const removedIndexesByTurn = new Map();
    let estimatedBytes = afterBytes;
    for (const entry of removableVisibleItemCandidates(thread.turns, thread)) {
      if (estimatedBytes <= ceiling && removedIndexesByTurn.size) break;
      const turn = thread.turns[entry.turnIndex];
      const item = turn && Array.isArray(turn.items) ? turn.items[entry.itemIndex] : null;
      if (!item) continue;
      if (!removedIndexesByTurn.has(entry.turnIndex)) removedIndexesByTurn.set(entry.turnIndex, new Set());
      const indexes = removedIndexesByTurn.get(entry.turnIndex);
      if (indexes.has(entry.itemIndex)) continue;
      indexes.add(entry.itemIndex);
      estimatedBytes -= Math.max(1, jsonByteLength(item));
    }
    const omitted = removeVisibleItemIndexes(thread, removedIndexesByTurn, stats, {
      reason: "progressive-active-first-paint-byte-ceiling",
      ceiling,
    });
    if (!omitted) break;
    totalOmitted += omitted;
    afterBytes = jsonByteLength(thread);
  }
  stats.progressiveActiveFirstPaintBytesAfterItemBudget = afterBytes;
  if (!totalOmitted) {
    stats.progressiveActiveFirstPaintItemBudgetReason = "no-removable-visible-items";
    return;
  }
  stats.progressiveActiveFirstPaintItemBudgetApplied = true;
  stats.progressiveActiveFirstPaintItemBudgetReason = afterBytes > ceiling
    ? "protected-visible-items"
    : "progressive-active-first-paint-byte-ceiling";
  stats.progressiveActiveFirstPaintOmittedVisibleItems = totalOmitted;
}

function applyProgressiveThreadTaskCardFirstPaintBudget(thread, options, stats) {
  const ceiling = Math.max(0, Math.trunc(Number(options.progressiveActiveFirstPaintThreadByteCeiling || 0)));
  const beforeBytes = jsonByteLength(thread);
  stats.progressiveThreadTaskCardBytesBeforeBudget = beforeBytes;
  stats.progressiveThreadTaskCardBytesAfterBudget = beforeBytes;
  stats.progressiveActiveFirstPaintBytesAfterTaskCardBudget = beforeBytes;
  if (!stats.progressiveActiveBudgetApplied || !ceiling || beforeBytes <= ceiling) return;
  if (!thread || !Array.isArray(thread.threadTaskCards) || thread.threadTaskCards.length <= 0) return;
  stats.progressiveThreadTaskCardBudgetScope = "active-first-paint";
  const nextCards = [];
  let changed = false;
  let compactedCount = 0;
  let originalBytes = 0;
  let retainedBytes = 0;
  let actionableCount = 0;
  let ineligibleCount = 0;
  let settledCompactedCount = 0;
  for (const card of thread.threadTaskCards) {
    const cardBytes = jsonByteLength(card);
    originalBytes += cardBytes;
    stats.progressiveThreadTaskCardOriginalCount += 1;
    if (!card || typeof card !== "object" || !String(card.id || "").trim()) {
      ineligibleCount += 1;
      retainedBytes += cardBytes;
      nextCards.push(card);
      continue;
    }
    if (taskCardHasAction(card)) actionableCount += 1;
    const compacted = compactThreadTaskCardForFirstPaint(card);
    const compactedBytes = jsonByteLength(compacted);
    if (compactedBytes > 0 && compactedBytes < cardBytes) {
      changed = true;
      compactedCount += 1;
      if (compacted && compacted.mobileTaskCardSettledCompacted === true) settledCompactedCount += 1;
      retainedBytes += compactedBytes;
      nextCards.push(compacted);
    } else {
      retainedBytes += cardBytes;
      nextCards.push(card);
    }
  }
  stats.progressiveThreadTaskCardActionableCount = actionableCount;
  stats.progressiveThreadTaskCardIneligibleCount = ineligibleCount;
  stats.progressiveThreadTaskCardSettledCompactedCount = settledCompactedCount;
  stats.progressiveThreadTaskCardOriginalBytes = originalBytes;
  stats.progressiveThreadTaskCardRetainedBytes = retainedBytes;
  stats.progressiveThreadTaskCardOmittedBytes = Math.max(0, originalBytes - retainedBytes);
  stats.progressiveThreadTaskCardCompactedCount = compactedCount;
  if (!changed) {
    stats.progressiveThreadTaskCardBudgetReason = "no-net-reducing-task-cards";
    return;
  }
  thread.threadTaskCards = nextCards;
  const afterBytes = jsonByteLength(thread);
  stats.progressiveThreadTaskCardBudgetApplied = true;
  stats.progressiveThreadTaskCardBudgetReason = afterBytes > ceiling
    ? "first-paint-byte-pressure"
    : "first-paint-byte-ceiling";
  stats.progressiveThreadTaskCardBytesAfterBudget = afterBytes;
  stats.progressiveActiveFirstPaintBytesAfterTaskCardBudget = afterBytes;
}

function applyProgressiveCompletedTextBudget(thread, options, stats) {
  const ceiling = Math.max(0, Math.trunc(Number(options.progressiveFirstPaintThreadByteCeiling || 0)));
  const beforeBytes = jsonByteLength(thread);
  stats.progressiveFirstPaintThreadByteCeiling = ceiling;
  stats.progressiveFirstPaintBytesBeforeTextBudget = beforeBytes;
  stats.progressiveFirstPaintBytesAfterTextBudget = beforeBytes;
  if (!ceiling || beforeBytes <= ceiling) return;
  const activeFirstPaintBudget = Boolean(stats.progressiveActiveBudgetApplied);
  const restingHistoryFirstPaintBudget = !activeFirstPaintBudget && stats.activeTurnCount <= 0;
  if (!activeFirstPaintBudget && !restingHistoryFirstPaintBudget) return;
  const maxChars = Math.max(0, Math.trunc(Number(options.progressiveCompletedTextChars || 0)));
  stats.progressiveCompletedTextChars = maxChars;
  stats.progressiveCompletedTextBudgetScope = activeFirstPaintBudget
    ? "active-first-paint"
    : "resting-history-first-paint";
  if (!maxChars) {
    stats.progressiveCompletedTextBudgetReason = "disabled";
    return;
  }
  const protectedLatestTurnIndex = restingHistoryFirstPaintBudget && Array.isArray(thread.turns) && thread.turns.length > 0
    ? thread.turns.length - 1
    : -1;
  if (protectedLatestTurnIndex >= 0) {
    stats.progressiveCompletedTextBudgetProtectedLatestTurn = true;
  }
  let changed = false;
  for (let turnIndex = 0; turnIndex < thread.turns.length; turnIndex += 1) {
    const turn = thread.turns[turnIndex];
    if (!turn || !Array.isArray(turn.items) || isActiveTurn(turn, thread)) continue;
    const protectedCompletedReplay = Boolean(options.protectedCompletedReplayTurnIds
      && options.protectedCompletedReplayTurnIds.has(turnId(turn)));
    if (turnIndex === protectedLatestTurnIndex
      || protectedCompletedReplay && !activeFirstPaintBudget) {
      stats.progressiveCompletedTextBudgetSkippedLatestTurnCount += 1;
      continue;
    }
    turn.items = turn.items.map((item) => {
      const compacted = compactCompletedTextItemForFirstPaint(item, options, stats);
      if (compacted !== item) changed = true;
      return compacted;
    });
  }
  if (!changed) return;
  const afterBytes = jsonByteLength(thread);
  stats.progressiveCompletedTextBudgetApplied = true;
  stats.progressiveCompletedTextBudgetReason = afterBytes > ceiling
    ? "first-paint-byte-pressure"
    : "first-paint-byte-ceiling";
  stats.progressiveFirstPaintBytesAfterTextBudget = afterBytes;
}

function applyProgressiveCompletedUserInputBudget(thread, options, stats) {
  const ceiling = Math.max(0, Math.trunc(Number(options.progressiveActiveFirstPaintThreadByteCeiling || 0)));
  const beforeBytes = jsonByteLength(thread);
  stats.progressiveCompletedUserInputBytesBeforeBudget = beforeBytes;
  stats.progressiveCompletedUserInputBytesAfterBudget = beforeBytes;
  if (!stats.progressiveActiveBudgetApplied || !ceiling || beforeBytes <= ceiling) return;
  stats.progressiveCompletedUserInputBudgetScope = "active-first-paint";
  const maxChars = Math.max(0, Math.trunc(Number(options.progressiveCompletedUserTextChars || 0)));
  stats.progressiveCompletedUserTextChars = maxChars;
  if (!maxChars) {
    stats.progressiveCompletedUserInputBudgetReason = "disabled";
    return;
  }
  stats.progressiveCompletedUserInputBudgetMode = "shared-newest-first";
  const completedUserInputBudget = createTextBudget(maxChars);
  let changed = false;
  for (let turnIndex = thread.turns.length - 1; turnIndex >= 0; turnIndex -= 1) {
    const turn = thread.turns[turnIndex];
    if (!turn || !Array.isArray(turn.items) || isActiveTurn(turn, thread)) continue;
    for (let itemIndex = turn.items.length - 1; itemIndex >= 0; itemIndex -= 1) {
      const item = turn.items[itemIndex];
      const compacted = compactCompletedUserMessageItemForFirstPaint(item, options, stats, completedUserInputBudget);
      if (compacted !== item) changed = true;
      turn.items[itemIndex] = compacted;
    }
  }
  stats.completedUserInputOriginalChars = completedUserInputBudget.originalChars;
  stats.completedUserInputRetainedChars = completedUserInputBudget.retainedChars;
  stats.omittedCompletedUserInputChars = completedUserInputBudget.omittedChars;
  if (!changed) return;
  const afterBytes = jsonByteLength(thread);
  stats.progressiveCompletedUserInputBudgetApplied = true;
  stats.progressiveCompletedUserInputBudgetReason = afterBytes > ceiling
    ? "first-paint-byte-pressure"
    : "first-paint-byte-ceiling";
  stats.progressiveCompletedUserInputBytesAfterBudget = afterBytes;
}

function applyProgressiveCompletedUsageBudget(thread, options, stats) {
  const ceiling = Math.max(0, Math.trunc(Number(options.progressiveActiveFirstPaintThreadByteCeiling || 0)));
  const beforeBytes = jsonByteLength(thread);
  stats.progressiveCompletedUsageBytesBeforeBudget = beforeBytes;
  stats.progressiveCompletedUsageBytesAfterBudget = beforeBytes;
  if (!stats.progressiveActiveBudgetApplied || !ceiling || beforeBytes <= ceiling) return;
  stats.progressiveCompletedUsageBudgetScope = "active-first-paint";
  let changed = false;
  for (const turn of thread.turns) {
    if (!turn || !Array.isArray(turn.items) || isActiveTurn(turn, thread)) continue;
    turn.items = turn.items.map((item) => {
      const compacted = compactCompletedUsageItemForFirstPaint(item, stats);
      if (compacted !== item) changed = true;
      return compacted;
    });
  }
  if (!changed) return;
  const afterBytes = jsonByteLength(thread);
  stats.progressiveCompletedUsageBudgetApplied = true;
  stats.progressiveCompletedUsageBudgetReason = afterBytes > ceiling
    ? "first-paint-byte-pressure"
    : "first-paint-byte-ceiling";
  stats.progressiveCompletedUsageBytesAfterBudget = afterBytes;
}

function applyProgressiveCompletedUsageSummaryOnlyBudget(thread, options, stats) {
  const ceiling = Math.max(0, Math.trunc(Number(options.progressiveActiveFirstPaintThreadByteCeiling || 0)));
  const beforeBytes = jsonByteLength(thread);
  stats.progressiveCompletedUsageSummaryOnlyBytesBeforeBudget = beforeBytes;
  stats.progressiveCompletedUsageSummaryOnlyBytesAfterBudget = beforeBytes;
  stats.progressiveActiveFirstPaintBytesAfterUsageSummaryOnlyBudget = beforeBytes;
  if (!stats.progressiveActiveBudgetApplied || !ceiling || beforeBytes <= ceiling) return;
  stats.progressiveCompletedUsageSummaryOnlyBudgetScope = "active-first-paint";
  let changed = false;
  for (const turn of thread.turns) {
    if (!turn || !Array.isArray(turn.items) || isActiveTurn(turn, thread)) continue;
    turn.items = turn.items.map((item) => {
      const compacted = compactCompletedUsageItemToSummaryOnlyForFirstPaint(item, stats);
      if (compacted !== item) changed = true;
      return compacted;
    });
  }
  if (!changed) return;
  const afterBytes = jsonByteLength(thread);
  stats.progressiveCompletedUsageSummaryOnlyBudgetApplied = true;
  stats.progressiveCompletedUsageSummaryOnlyBudgetReason = afterBytes > ceiling
    ? "first-paint-byte-pressure"
    : "first-paint-byte-ceiling";
  stats.progressiveCompletedUsageSummaryOnlyBytesAfterBudget = afterBytes;
  stats.progressiveActiveFirstPaintBytesAfterUsageSummaryOnlyBudget = afterBytes;
}

function pruneNonCurrentEmptyActivePlaceholders(thread, stats) {
  if (!thread || !Array.isArray(thread.turns)) return;
  const beforeCount = thread.turns.length;
  thread.turns = thread.turns.filter((turn) => !isNonCurrentEmptyActivePlaceholderTurn(turn, thread));
  const pruned = Math.max(0, beforeCount - thread.turns.length);
  if (pruned > 0) stats.prunedEmptyActivePlaceholderTurns += pruned;
}

function compactTurnWithBudget(turn, thread, options, stats) {
  if (!turn || typeof turn !== "object" || !Array.isArray(turn.items)) return turn;
  const active = isActiveTurn(turn, thread);
  const id = turnId(turn);
  const protectedCompletedReplay = Boolean(options.protectedCompletedReplayTurnIds
    && options.protectedCompletedReplayTurnIds.has(id));
  const latestCompletedReplay = Boolean(options.latestCompletedReplayTurnId
    ? id && id === options.latestCompletedReplayTurnId
    : isLatestCompletedReplayTurn(turn, thread));
  const richCompletedReplay = Boolean(options.richCompletedReplayTurnId
    && id && id === options.richCompletedReplayTurnId);
  const replay = active || protectedCompletedReplay;
  const maxOperationItems = replay ? options.activeOperationItems : options.completedOperationItems;
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
  if (protectedCompletedReplay) {
    compacted.items = compacted.items.filter((item) => !isOperationItem(item));
  }
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
  const preserveReplayAssistantItems = replay && options.preserveReplayAssistantItems === true;
  const limitPreservedReplayAssistantItems = preserveReplayAssistantItems
    && shouldLimitPreservedReplayAssistants(turn, thread, options);
  const replayAssistantLimit = Math.max(
    Number(options.activeAssistantItems || 0),
    Number(options.progressiveReplayAssistantItems || 0),
  );
  const completedReplayAssistantLimit = Math.max(
    Number(options.completedAssistantItems || 0),
    Number(options.progressiveCompletedReplayAssistantItems || 0),
  );
  const assistantLimit = preserveReplayAssistantItems && !limitPreservedReplayAssistantItems
    ? beforeAssistantCount
    : active ? replayAssistantLimit
      : protectedCompletedReplay && limitPreservedReplayAssistantItems ? completedReplayAssistantLimit
        : replay ? replayAssistantLimit : options.completedAssistantItems;
  const keepAssistantIndexes = trailingIndexes(
    compacted.items,
    assistantLimit,
    isAssistantItem,
  );
  compacted.items = compacted.items.filter((item, index) => {
    if (!isAssistantItem(item)) return true;
    return keepAssistantIndexes.has(index);
  });
  if (active && options.progressiveActiveBudgetApplied) {
    const activeUserInputBudget = createTextBudget(Math.max(0, Math.trunc(Number(options.progressiveActiveUserTextChars || 0))));
    for (let index = compacted.items.length - 1; index >= 0; index -= 1) {
      compacted.items[index] = compactActiveUserMessageItem(compacted.items[index], options, stats, activeUserInputBudget);
    }
    compacted.items = compacted.items.map((item) => compactActiveOperationPayloadItem(compactActiveTextItem(item, options, stats), options, stats));
  }
  compacted.items = orderItemsByDisplayTimestamp(compacted.items, compacted, thread);
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
  stats.activeOmittedAssistantItems += active ? omittedAssistantItems : 0;
  stats.activeAssistantItemsBefore += active ? beforeAssistantCount : 0;
  stats.activeAssistantItemsAfter += active ? afterAssistantCount : 0;
  stats.activeTurnCount += active ? 1 : 0;
  stats.latestCompletedReplayTurnCount += latestCompletedReplay ? 1 : 0;
  stats.latestCompletedReplayOperationItems += latestCompletedReplay ? afterOperationCount : 0;
  stats.latestCompletedReplayReasoningItems += latestCompletedReplay ? afterReasoningCount : 0;
  stats.latestCompletedReplayAssistantItems += latestCompletedReplay ? afterAssistantCount : 0;
  stats.latestCompletedReplayOmittedAssistantItems += latestCompletedReplay ? omittedAssistantItems : 0;
  stats.protectedCompletedReplayTurnCount += protectedCompletedReplay ? 1 : 0;
  stats.completedReplayAssistantItemsBefore += protectedCompletedReplay ? beforeAssistantCount : 0;
  stats.completedReplayAssistantItemsAfter += protectedCompletedReplay ? afterAssistantCount : 0;
  stats.completedReplayOmittedAssistantItems += protectedCompletedReplay ? omittedAssistantItems : 0;
  stats.protectedCompletedReplayAssistantItems += protectedCompletedReplay ? afterAssistantCount : 0;
  stats.protectedCompletedReplayOmittedAssistantItems += protectedCompletedReplay ? omittedAssistantItems : 0;
  stats.richCompletedReplayTurnCount += richCompletedReplay ? 1 : 0;
  stats.richCompletedReplayAssistantItems += richCompletedReplay ? afterAssistantCount : 0;
  stats.richCompletedReplayOmittedAssistantItems += richCompletedReplay ? omittedAssistantItems : 0;
  if (preserveReplayAssistantItems && afterAssistantCount > Number(options.activeAssistantItems || 0)) {
    stats.preservedReplayAssistantItems += afterAssistantCount - Number(options.activeAssistantItems || 0);
  }
  if (limitPreservedReplayAssistantItems && omittedAssistantItems > 0) {
    stats.limitedReplayAssistantItems += omittedAssistantItems;
  }
  if (!active && protectedCompletedReplay && limitPreservedReplayAssistantItems && omittedAssistantItems > 0) {
    stats.progressiveCompletedReplayAssistantBudgetApplied = true;
    stats.progressiveCompletedReplayAssistantBudgetReason = stats.progressiveActiveBudgetReason || "active-first-paint-pressure";
    stats.limitedCompletedReplayAssistantItems += omittedAssistantItems;
  }
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
  const activeProgressiveByteThreshold = boundedCount(
    options.activeProgressiveByteThreshold,
    DEFAULT_ACTIVE_PROGRESSIVE_ACTIVE_BYTES,
    10 * 1024 * 1024,
  );
  const activeProgressiveThreadByteThreshold = boundedCount(
    options.activeProgressiveThreadByteThreshold,
    DEFAULT_ACTIVE_PROGRESSIVE_THREAD_BYTES,
    50 * 1024 * 1024,
  );
  const pressureOriginalBytes = byteLengthForTurns(thread.turns);
  const pressureActiveBytes = byteLengthForTurns(thread.turns, (turn) => isActiveTurn(turn, thread));
  const activeItemPressure = activeProgressiveItemThreshold > 0
    && pressureActiveItemCount >= activeProgressiveItemThreshold;
  const threadItemPressure = activeProgressiveItemThreshold > 0
    && pressureOriginalItemCount >= activeProgressiveItemThreshold;
  const activeBytePressure = activeProgressiveByteThreshold > 0
    && pressureActiveBytes >= activeProgressiveByteThreshold;
  const threadBytePressure = activeProgressiveThreadByteThreshold > 0
    && pressureOriginalBytes >= activeProgressiveThreadByteThreshold;
  const progressiveActiveBudgetApplied = pressureActiveItemCount > 0
    && (activeItemPressure || threadItemPressure || activeBytePressure || threadBytePressure);
  const progressiveActiveBudgetReason = progressiveActiveBudgetApplied
    ? (
      activeItemPressure ? "active-item-pressure"
        : threadItemPressure ? "thread-item-pressure"
          : activeBytePressure ? "active-byte-pressure"
            : "thread-byte-pressure"
    )
    : "";
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
  const progressiveReplayAssistantItems = Math.max(1, boundedCount(
    options.progressiveReplayAssistantItems,
    DEFAULT_PROGRESSIVE_REPLAY_ASSISTANT_ITEMS,
    500,
  ));
  const progressiveCompletedReplayAssistantItems = Math.max(1, boundedCount(
    options.progressiveCompletedReplayAssistantItems,
    DEFAULT_PROGRESSIVE_COMPLETED_REPLAY_ASSISTANT_ITEMS,
    500,
  ));
  const progressiveActiveTextChars = boundedCount(
    options.progressiveActiveTextChars,
    DEFAULT_PROGRESSIVE_ACTIVE_TEXT_CHARS,
    200 * 1024,
  );
  const progressiveActiveOperationPayloadChars = boundedCount(
    options.progressiveActiveOperationPayloadChars,
    DEFAULT_PROGRESSIVE_ACTIVE_OPERATION_PAYLOAD_CHARS,
    200 * 1024,
  );
  const progressiveActiveUserTextChars = boundedCount(
    options.progressiveActiveUserTextChars,
    DEFAULT_PROGRESSIVE_ACTIVE_USER_TEXT_CHARS,
    200 * 1024,
  );
  const progressiveFirstPaintThreadByteCeiling = boundedCount(
    options.progressiveFirstPaintThreadByteCeiling,
    DEFAULT_PROGRESSIVE_FIRST_PAINT_THREAD_BYTES,
    50 * 1024 * 1024,
  );
  const progressiveActiveFirstPaintThreadByteCeiling = boundedCount(
    options.progressiveActiveFirstPaintThreadByteCeiling,
    DEFAULT_PROGRESSIVE_ACTIVE_FIRST_PAINT_THREAD_BYTES,
    50 * 1024 * 1024,
  );
  const progressiveCompletedTextChars = boundedCount(
    options.progressiveCompletedTextChars,
    DEFAULT_PROGRESSIVE_COMPLETED_TEXT_CHARS,
    200 * 1024,
  );
  const progressiveCompletedUserTextChars = boundedCount(
    options.progressiveCompletedUserTextChars,
    DEFAULT_PROGRESSIVE_COMPLETED_USER_TEXT_CHARS,
    200 * 1024,
  );
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
    omittedVisibleItems: 0,
    omittedActiveUserInputChars: 0,
    omittedActiveTextChars: 0,
    omittedActiveOperationPayloadChars: 0,
    omittedCompletedTextChars: 0,
    omittedCompletedUserInputChars: 0,
    omittedCompletedUsageBytes: 0,
    prunedEmptyActivePlaceholderTurns: 0,
    remappedMissingActiveTurnId: 0,
    clearedMissingActiveTurnId: 0,
    repairedVisibleActiveTurnStatus: 0,
    downgradedStaleActiveTurns: 0,
    truncatedActiveUserMessageItems: 0,
    truncatedActiveTextItems: 0,
    truncatedActiveOperationPayloadItems: 0,
    truncatedCompletedTextItems: 0,
    truncatedCompletedUserInputItems: 0,
    truncatedCompletedUsageItems: 0,
    activeUserInputOriginalChars: 0,
    activeUserInputRetainedChars: 0,
    activeTextOriginalChars: 0,
    activeTextRetainedChars: 0,
    activeOperationPayloadOriginalChars: 0,
    activeOperationPayloadRetainedChars: 0,
    completedTextOriginalChars: 0,
    completedTextRetainedChars: 0,
    completedUserInputOriginalChars: 0,
    completedUserInputRetainedChars: 0,
    completedUsageOriginalBytes: 0,
    completedUsageRetainedBytes: 0,
    activeTurnCount: 0,
    activeOmittedAssistantItems: 0,
    activeAssistantItemsBefore: 0,
    activeAssistantItemsAfter: 0,
    latestCompletedReplayTurnCount: 0,
    latestCompletedReplayOperationItems: 0,
    latestCompletedReplayReasoningItems: 0,
    latestCompletedReplayAssistantItems: 0,
    latestCompletedReplayOmittedAssistantItems: 0,
    protectedCompletedReplayTurnCount: 0,
    protectedCompletedReplayAssistantItems: 0,
    protectedCompletedReplayOmittedAssistantItems: 0,
    richCompletedReplayTurnCount: 0,
    richCompletedReplayAssistantItems: 0,
    richCompletedReplayOmittedAssistantItems: 0,
    richCompletedReplayTurnProtected: false,
    preserveReplayAssistantItems: true,
    preservedReplayAssistantItems: 0,
    progressiveReplayAssistantItems,
    limitedReplayAssistantItems: 0,
    progressiveCompletedReplayAssistantItems,
    progressiveCompletedReplayAssistantBudgetApplied: false,
    progressiveCompletedReplayAssistantBudgetReason: "",
    progressiveCompletedReplayAssistantBudgetScope: "active-first-paint",
    limitedCompletedReplayAssistantItems: 0,
    completedReplayAssistantItemsBefore: 0,
    completedReplayAssistantItemsAfter: 0,
    completedReplayOmittedAssistantItems: 0,
    staleActiveTurnCount: 0,
    completedOperationItems: boundedCount(options.completedOperationItems, DEFAULT_COMPLETED_OPERATION_ITEMS, 100),
    activeOperationItems: effectiveActiveOperationItems,
    completedReasoningItems: boundedCount(options.completedReasoningItems, DEFAULT_COMPLETED_REASONING_ITEMS, 100),
    activeReasoningItems: effectiveActiveReasoningItems,
    completedAssistantItems: Math.max(1, boundedCount(options.completedAssistantItems, DEFAULT_COMPLETED_ASSISTANT_ITEMS, 100)),
    activeAssistantItems: effectiveActiveAssistantItems,
    activeProgressiveItemThreshold,
    activeProgressiveByteThreshold,
    activeProgressiveThreadByteThreshold,
    progressiveActiveUserTextChars,
    progressiveActiveTextChars,
    progressiveActiveOperationPayloadChars,
    progressiveFirstPaintThreadByteCeiling,
    progressiveActiveFirstPaintThreadByteCeiling,
    progressiveCompletedTextChars,
    progressiveCompletedTextBudgetApplied: false,
    progressiveCompletedTextBudgetReason: "",
    progressiveCompletedTextBudgetScope: "",
    progressiveCompletedTextBudgetProtectedLatestTurn: false,
    progressiveCompletedTextBudgetSkippedLatestTurnCount: 0,
    progressiveFirstPaintBytesBeforeTextBudget: 0,
    progressiveFirstPaintBytesAfterTextBudget: 0,
    progressiveCompletedUserTextChars,
    progressiveCompletedUserInputBudgetApplied: false,
    progressiveCompletedUserInputBudgetReason: "",
    progressiveCompletedUserInputBudgetScope: "",
    progressiveCompletedUserInputBudgetMode: "",
    progressiveCompletedUserInputBytesBeforeBudget: 0,
    progressiveCompletedUserInputBytesAfterBudget: 0,
    progressiveCompletedUsageBudgetApplied: false,
    progressiveCompletedUsageBudgetReason: "",
    progressiveCompletedUsageBudgetScope: "",
    progressiveCompletedUsageBytesBeforeBudget: 0,
    progressiveCompletedUsageBytesAfterBudget: 0,
    progressiveCompletedUsageSummaryOnlyBudgetApplied: false,
    progressiveCompletedUsageSummaryOnlyBudgetReason: "",
    progressiveCompletedUsageSummaryOnlyBudgetScope: "",
    progressiveCompletedUsageSummaryOnlyBytesBeforeBudget: 0,
    progressiveCompletedUsageSummaryOnlyBytesAfterBudget: 0,
    progressiveActiveFirstPaintBytesAfterUsageSummaryOnlyBudget: 0,
    truncatedCompletedUsageSummaryOnlyItems: 0,
    completedUsageSummaryOnlyOriginalBytes: 0,
    completedUsageSummaryOnlyRetainedBytes: 0,
    omittedCompletedUsageSummaryOnlyBytes: 0,
    progressiveThreadTaskCardBudgetApplied: false,
    progressiveThreadTaskCardBudgetReason: "",
    progressiveThreadTaskCardBudgetScope: "",
    progressiveThreadTaskCardOriginalCount: 0,
    progressiveThreadTaskCardCompactedCount: 0,
    progressiveThreadTaskCardActionableCount: 0,
    progressiveThreadTaskCardIneligibleCount: 0,
    progressiveThreadTaskCardSettledCompactedCount: 0,
    progressiveThreadTaskCardOriginalBytes: 0,
    progressiveThreadTaskCardRetainedBytes: 0,
    progressiveThreadTaskCardOmittedBytes: 0,
    progressiveThreadTaskCardBytesBeforeBudget: 0,
    progressiveThreadTaskCardBytesAfterBudget: 0,
    progressiveVisibleItemCeiling: boundedCount(
      options.progressiveVisibleItemCeiling,
      DEFAULT_PROGRESSIVE_VISIBLE_ITEM_CEILING,
      10000,
    ),
    progressiveVisibleItemBudgetApplied: false,
    progressiveVisibleItemBudgetReason: "",
    progressiveVisibleItemOriginalCount: 0,
    progressiveVisibleItemRetainedCount: 0,
    progressiveActiveFirstPaintThreadByteCeiling,
    progressiveActiveFirstPaintItemBudgetApplied: false,
    progressiveActiveFirstPaintItemBudgetReason: "",
    progressiveActiveFirstPaintBytesBeforeItemBudget: 0,
    progressiveActiveFirstPaintBytesAfterItemBudget: 0,
    progressiveActiveFirstPaintBytesAfterTaskCardBudget: 0,
    progressiveActiveFirstPaintOmittedVisibleItems: 0,
    progressiveActiveFirstPaintOverCeilingBytes: 0,
    retainedVisibleItemCountByKind: {},
    retainedVisibleItemBytesByKind: {},
    retainedAssistantItemCountByTurnState: {},
    retainedAssistantItemBytesByTurnState: {},
    retainedAssistantItemBytesByShape: {},
    retainedActiveAssistantItemBytesByShape: {},
    retainedCompletedAssistantItemBytesByShape: {},
    retainedStaleActiveAssistantItemBytesByShape: {},
    retainedOtherAssistantItemBytesByShape: {},
    retainedUserInputItemCountByTurnState: {},
    retainedUserInputItemBytesByTurnState: {},
    retainedUserInputItemBytesByShape: {},
    retainedActiveUserInputItemBytesByShape: {},
    retainedCompletedUserInputItemBytesByShape: {},
    retainedStaleActiveUserInputItemBytesByShape: {},
    retainedOtherUserInputItemBytesByShape: {},
    retainedVisibleItemCountForByteStats: 0,
    retainedVisibleItemBytesForByteStats: 0,
    retainedVisibleItemLargestKind: "",
    retainedVisibleItemLargestBytes: 0,
    progressiveActiveBudgetApplied,
    progressiveActiveBudgetReason,
    progressiveActiveOriginalItemCount: pressureOriginalItemCount,
    progressiveActiveTurnOriginalItemCount: pressureActiveItemCount,
    progressiveActiveOriginalBytes: pressureOriginalBytes,
    progressiveActiveTurnOriginalBytes: pressureActiveBytes,
  };
  if (progressiveActiveBudgetApplied) {
    stats.configuredActiveOperationItems = configuredActiveOperationItems;
    stats.configuredActiveReasoningItems = configuredActiveReasoningItems;
    stats.configuredActiveAssistantItems = configuredActiveAssistantItems;
  }
  pruneNonCurrentEmptyActivePlaceholders(thread, stats);
  reconcileVisibleActiveTurnState(thread, stats);
  const replayProtection = completedReplayProtection(thread);
  stats.richCompletedReplayTurnProtected = Boolean(replayProtection.richCompletedTurnId);
  const budgetOptions = Object.assign({}, options, stats, {
    latestCompletedReplayTurnId: replayProtection.latestCompletedTurnId,
    richCompletedReplayTurnId: replayProtection.richCompletedTurnId,
    protectedCompletedReplayTurnIds: replayProtection.protectedIds,
  });
  budgetOptions.preserveReplayAssistantItems = true;
  thread.turns = thread.turns.map((turn) => compactTurnWithBudget(turn, thread, budgetOptions, stats));
  applyProgressiveVisibleItemCeiling(thread, budgetOptions, stats);
  applyProgressiveCompletedTextBudget(thread, budgetOptions, stats);
  applyProgressiveCompletedUserInputBudget(thread, budgetOptions, stats);
  applyProgressiveCompletedUsageBudget(thread, budgetOptions, stats);
  applyProgressiveActiveFirstPaintItemBudget(thread, budgetOptions, stats);
  applyProgressiveThreadTaskCardFirstPaintBudget(thread, budgetOptions, stats);
  applyProgressiveCompletedUsageSummaryOnlyBudget(thread, budgetOptions, stats);
  annotateRetainedVisibleItemByteStats(thread, stats);
  for (const turn of thread.turns) {
    if (!turn || !Array.isArray(turn.items) || turn.items.length < 2) continue;
    turn.items = orderItemsByDisplayTimestamp(turn.items, turn, thread);
  }
  stats.applied = stats.omittedOperationItems > 0
    || stats.omittedReasoningItems > 0
    || stats.omittedAssistantItems > 0
    || stats.omittedVisibleItems > 0
    || stats.prunedEmptyActivePlaceholderTurns > 0
    || stats.remappedMissingActiveTurnId > 0
    || stats.clearedMissingActiveTurnId > 0
    || stats.repairedVisibleActiveTurnStatus > 0
    || stats.downgradedStaleActiveTurns > 0
    || stats.truncatedActiveUserMessageItems > 0
    || stats.truncatedActiveTextItems > 0
    || stats.truncatedActiveOperationPayloadItems > 0;
  stats.applied = stats.applied || stats.truncatedCompletedTextItems > 0;
  stats.applied = stats.applied || stats.truncatedCompletedUserInputItems > 0;
  stats.applied = stats.applied || stats.truncatedCompletedUsageItems > 0;
  stats.applied = stats.applied || stats.truncatedCompletedUsageSummaryOnlyItems > 0;
  stats.applied = stats.applied || stats.progressiveThreadTaskCardCompactedCount > 0;
  if (!stats.applied && !stats.progressiveActiveBudgetApplied) return out;
  const revision = thread.mobileProjectionRevision;
  const normalized = normalizeThreadVisibleProjection(out, {
    source: thread.mobileReadMode || "thread-detail-response-budget",
    revision,
  });
  if (normalized && normalized.thread) {
    normalized.thread.mobileDetailResponseBudget = String(options.responseBudgetEvidence || "").toLowerCase() === "compact"
      ? compactResponseBudgetEvidence(stats)
      : stats;
  }
  return normalized;
}

module.exports = {
  compactThreadDetailResponseResult,
  isAssistantItem,
  isOperationItem,
  isReasoningItem,
};
