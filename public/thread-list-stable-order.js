"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexThreadListStableOrder = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  const DEFAULT_HOLD_MS = 45_000;

  function text(value) {
    return String(value || "").trim();
  }

  function boundedHoldMs(value) {
    const number = Math.trunc(Number(value) || 0);
    if (number <= 0) return DEFAULT_HOLD_MS;
    return Math.min(300_000, Math.max(5_000, number));
  }

  function threadId(thread) {
    return text(thread && thread.id);
  }

  function threadListOrderScopeKey(input = {}) {
    const cwd = text(input.selectedCwd);
    const search = text(input.search).toLowerCase();
    return JSON.stringify({ cwd, search });
  }

  function orderedThreadsById(threads, ids) {
    const byId = new Map();
    for (const thread of threads || []) {
      const id = threadId(thread);
      if (id && !byId.has(id)) byId.set(id, thread);
    }
    return (ids || []).map((id) => byId.get(id)).filter(Boolean);
  }

  function mergeHeldOrder(previousOrder, incomingIds) {
    const incomingSet = new Set(incomingIds);
    const rank = new Map(incomingIds.map((id, index) => [id, index]));
    const ordered = (previousOrder || []).filter((id) => incomingSet.has(id));
    const orderedSet = new Set(ordered);
    const additions = incomingIds.filter((id) => !orderedSet.has(id));
    for (const id of additions) {
      const idRank = rank.get(id);
      let insertAt = ordered.length;
      for (let index = 0; index < ordered.length; index += 1) {
        if ((rank.get(ordered[index]) ?? Number.MAX_SAFE_INTEGER) > idRank) {
          insertAt = index;
          break;
        }
      }
      ordered.splice(insertAt, 0, id);
      orderedSet.add(id);
    }
    return ordered;
  }

  function planThreadListStableOrder(input = {}) {
    const threads = Array.isArray(input.threads) ? input.threads : [];
    const incomingIds = threads.map(threadId).filter(Boolean);
    const previous = input.previousState && typeof input.previousState === "object"
      ? input.previousState
      : {};
    const previousOrder = Array.isArray(previous.order) ? previous.order.map(text).filter(Boolean) : [];
    const scopeKey = text(input.scopeKey) || threadListOrderScopeKey(input);
    const nowMs = Math.max(0, Math.trunc(Number(input.nowMs) || Date.now()));
    const holdMs = boundedHoldMs(input.holdMs);
    const previousHoldUntilMs = Math.max(0, Math.trunc(Number(previous.holdUntilMs) || 0));
    const sameScope = text(previous.scopeKey) === scopeKey;
    const canHold = !input.forceServerOrder
      && sameScope
      && previousOrder.length > 0
      && previousHoldUntilMs > nowMs;
    const order = canHold ? mergeHeldOrder(previousOrder, incomingIds) : incomingIds;
    const holdUntilMs = canHold ? previousHoldUntilMs : nowMs + holdMs;
    return {
      action: "thread-list-stable-order",
      held: canHold,
      scopeKey,
      holdUntilMs,
      order,
      threads: orderedThreadsById(threads, order),
      state: {
        scopeKey,
        holdUntilMs,
        order,
      },
    };
  }

  return {
    DEFAULT_HOLD_MS,
    threadListOrderScopeKey,
    planThreadListStableOrder,
  };
}));
