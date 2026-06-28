"use strict";

const { normalizeThreadVisibleProjection } = require("./thread-visible-item-normalizer");

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
const DEFAULT_PROGRESSIVE_ACTIVE_TEXT_CHARS = 12 * 1024;
const DEFAULT_PROGRESSIVE_ACTIVE_OPERATION_PAYLOAD_CHARS = 6 * 1024;
const DEFAULT_PROGRESSIVE_ACTIVE_USER_TEXT_CHARS = 10 * 1024;
const DEFAULT_PROGRESSIVE_VISIBLE_ITEM_CEILING = 48;
const DEFAULT_PROGRESSIVE_FIRST_PAINT_THREAD_BYTES = 160 * 1024;
const DEFAULT_PROGRESSIVE_ACTIVE_FIRST_PAINT_THREAD_BYTES = 96 * 1024;
const DEFAULT_PROGRESSIVE_COMPLETED_TEXT_CHARS = 8 * 1024;
const ACTIVE_TEXT_BUDGET_MARKER = "\n\n[active item preview truncated]\n\n";
const OPERATION_PAYLOAD_BUDGET_MARKER = "\n\n[operation payload preview truncated]\n\n";
const USER_INPUT_BUDGET_MARKER = "\n\n[active user input preview truncated]\n\n";
const FIRST_PAINT_TEXT_BUDGET_MARKER = "\n\n[first-paint preview truncated]\n\n";

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

function hasVisibleActiveTurn(thread) {
  if (!thread || !Array.isArray(thread.turns)) return false;
  return thread.turns.some((turn) => isActiveTurn(turn, thread));
}

function isLatestCompletedReplayTurn(turn, thread) {
  if (!turn || !thread || !Array.isArray(thread.turns)) return false;
  if (hasVisibleActiveTurn(thread)) return false;
  for (let index = thread.turns.length - 1; index >= 0; index -= 1) {
    const candidate = thread.turns[index];
    if (!turnHasItems(candidate)) continue;
    if (!isCompletedStatus(candidate && candidate.status)) continue;
    return candidate === turn;
  }
  return false;
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
  const compacted = truncateMiddleText(value, remaining, marker);
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

function compactActiveUserMessageItem(item, options, stats) {
  if (!item || typeof item !== "object" || !isUserMessageItem(item)) return item;
  const maxChars = Math.max(0, Math.trunc(Number(options.progressiveActiveUserTextChars || 0)));
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
  for (const field of ["text", "message"]) {
    if (compactTextFieldForUserInput(out, field, budget)) budget.fields.push(field);
  }
  if (Array.isArray(out.content)) {
    out.content = out.content.map((entry, index) => {
      if (!entry || typeof entry !== "object") return entry;
      const next = Object.assign({}, entry);
      for (const field of ["text", "input_text", "content"]) {
        if (compactTextFieldForUserInput(next, field, budget)) budget.fields.push(`content.${field}`);
      }
      const imageResult = compactImageDataUrlPartForUserInput(next, maxChars);
      if (imageResult.truncated) {
        budget.originalChars += imageResult.originalChars;
        budget.retainedChars += imageResult.retainedChars;
        budget.omittedChars += imageResult.omittedChars;
        budget.truncated = true;
        budget.fields.push(`content.${imageResult.field}`);
        return imageResult.part;
      }
      return next;
    });
  }
  if (!budget.truncated) return item;
  out.mobileUserInputBudget = {
    version: "thread-detail-active-user-input-budget-v1",
    maxChars,
    originalChars: budget.originalChars,
    retainedChars: budget.retainedChars,
    omittedChars: budget.omittedChars,
    fields: [...new Set(budget.fields)],
  };
  out.mobileUserInputTruncated = true;
  stats.truncatedActiveUserMessageItems += 1;
  stats.activeUserInputOriginalChars += budget.originalChars;
  stats.activeUserInputRetainedChars += budget.retainedChars;
  stats.omittedActiveUserInputChars += budget.omittedChars;
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

function removableVisibleItemCandidates(turns, thread) {
  const entries = [];
  for (let turnIndex = 0; turnIndex < turns.length; turnIndex += 1) {
    const turn = turns[turnIndex];
    if (!turn || !Array.isArray(turn.items)) continue;
    const active = isActiveTurn(turn, thread);
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
    if (turnIndex === protectedLatestTurnIndex) {
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
  const latestCompletedReplay = isLatestCompletedReplayTurn(turn, thread);
  const replay = active || latestCompletedReplay;
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
  const reasoningLimit = replay ? options.activeReasoningItems : options.completedReasoningItems;
  const keepReasoningIndexes = trailingIndexes(
    compacted.items,
    reasoningLimit,
    (item) => isReasoningItem(item) && (replay || reasoningHasVisibleText(item)),
  );
  compacted.items = compacted.items.filter((item, index) => {
    if (!isReasoningItem(item)) return true;
    return keepReasoningIndexes.has(index);
  });
  const assistantLimit = replay ? options.activeAssistantItems : options.completedAssistantItems;
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
    compacted.items = compacted.items.map((item) => compactActiveOperationPayloadItem(compactActiveTextItem(compactActiveUserMessageItem(item, options, stats), options, stats), options, stats));
  }
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
  stats.latestCompletedReplayTurnCount += latestCompletedReplay ? 1 : 0;
  stats.latestCompletedReplayOperationItems += latestCompletedReplay ? afterOperationCount : 0;
  stats.latestCompletedReplayReasoningItems += latestCompletedReplay ? afterReasoningCount : 0;
  stats.latestCompletedReplayAssistantItems += latestCompletedReplay ? afterAssistantCount : 0;
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
    prunedEmptyActivePlaceholderTurns: 0,
    remappedMissingActiveTurnId: 0,
    clearedMissingActiveTurnId: 0,
    repairedVisibleActiveTurnStatus: 0,
    downgradedStaleActiveTurns: 0,
    truncatedActiveUserMessageItems: 0,
    truncatedActiveTextItems: 0,
    truncatedActiveOperationPayloadItems: 0,
    truncatedCompletedTextItems: 0,
    activeUserInputOriginalChars: 0,
    activeUserInputRetainedChars: 0,
    activeTextOriginalChars: 0,
    activeTextRetainedChars: 0,
    activeOperationPayloadOriginalChars: 0,
    activeOperationPayloadRetainedChars: 0,
    completedTextOriginalChars: 0,
    completedTextRetainedChars: 0,
    activeTurnCount: 0,
    latestCompletedReplayTurnCount: 0,
    latestCompletedReplayOperationItems: 0,
    latestCompletedReplayReasoningItems: 0,
    latestCompletedReplayAssistantItems: 0,
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
    progressiveActiveFirstPaintOmittedVisibleItems: 0,
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
  const budgetOptions = Object.assign({}, options, stats);
  thread.turns = thread.turns.map((turn) => compactTurnWithBudget(turn, thread, budgetOptions, stats));
  applyProgressiveVisibleItemCeiling(thread, budgetOptions, stats);
  applyProgressiveCompletedTextBudget(thread, budgetOptions, stats);
  applyProgressiveActiveFirstPaintItemBudget(thread, budgetOptions, stats);
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
  if (!stats.applied && !stats.progressiveActiveBudgetApplied) return out;
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
