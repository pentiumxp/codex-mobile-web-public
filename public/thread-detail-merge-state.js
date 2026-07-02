"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexThreadDetailMergeState = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  function defaultNormalizeThread(thread) {
    return thread;
  }

  function defaultSortTurns(turns) {
    return Array.isArray(turns) ? turns.slice() : [];
  }

  function createThreadDetailMergePolicy(options = {}) {
    const isV4ProjectionThread = typeof options.isV4ProjectionThread === "function"
      ? options.isV4ProjectionThread
      : () => false;
    const mergeV4ProjectionThread = typeof options.mergeV4ProjectionThread === "function"
      ? options.mergeV4ProjectionThread
      : (existingThread, incomingThread) => incomingThread || existingThread || null;
    const normalizeThreadVisibleUserMessages = typeof options.normalizeThreadVisibleUserMessages === "function"
      ? options.normalizeThreadVisibleUserMessages
      : defaultNormalizeThread;
    const turnVisibleWeight = typeof options.turnVisibleWeight === "function"
      ? options.turnVisibleWeight
      : () => 0;
    const shouldPreserveExistingTurnVisibleItems = typeof options.shouldPreserveExistingTurnVisibleItems === "function"
      ? options.shouldPreserveExistingTurnVisibleItems
      : () => false;
    const mergeItemsPreservingLocalVisible = typeof options.mergeItemsPreservingLocalVisible === "function"
      ? options.mergeItemsPreservingLocalVisible
      : (existingItems, incomingItems) => (Array.isArray(incomingItems) ? incomingItems : existingItems);
    const shouldDropInitialSubmissionEchoTurn = typeof options.shouldDropInitialSubmissionEchoTurn === "function"
      ? options.shouldDropInitialSubmissionEchoTurn
      : () => false;
    const turnIsSupersededBy = typeof options.turnIsSupersededBy === "function"
      ? options.turnIsSupersededBy
      : () => false;
    const isTurnComplete = typeof options.isTurnComplete === "function"
      ? options.isTurnComplete
      : () => false;
    const shouldPreserveMissingExistingTurn = typeof options.shouldPreserveMissingExistingTurn === "function"
      ? options.shouldPreserveMissingExistingTurn
      : () => false;
    const sortTurnsForDisplay = typeof options.sortTurnsForDisplay === "function"
      ? options.sortTurnsForDisplay
      : defaultSortTurns;
    const threadHasInitialSubmissionEcho = typeof options.threadHasInitialSubmissionEcho === "function"
      ? options.threadHasInitialSubmissionEcho
      : () => false;
    const maxExpandedVisibleTurns = Math.max(1, Number(options.maxExpandedVisibleTurns || 200) || 200);

    function normalizeMergedThread(thread, limit = 0) {
      const normalized = normalizeThreadVisibleUserMessages(thread);
      if (normalized && Array.isArray(normalized.turns)) {
        const sorted = sortTurnsForDisplay(normalized.turns);
        normalized.turns = limit > 0 ? sorted.slice(-limit) : sorted;
      }
      return normalized;
    }

    function shouldPreserveLiveTurnLocalVisibleItems(existingTurn, incomingTurn, existingWeight = null) {
      return shouldPreserveExistingTurnVisibleItems(existingTurn, incomingTurn, existingWeight);
    }

    function mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) {
      if (!existingTurn) return incomingTurn;
      if (!incomingTurn) return existingTurn;
      const existingItems = Array.isArray(existingTurn.items) ? existingTurn.items : [];
      const incomingHasItems = Array.isArray(incomingTurn.items);
      const merged = Object.assign({}, existingTurn, incomingTurn);
      if (!incomingHasItems) {
        merged.items = existingItems;
        return merged;
      }
      const incomingWeight = turnVisibleWeight(Object.assign({}, incomingTurn, { items: incomingTurn.items || [] }));
      const existingWeight = turnVisibleWeight(existingTurn);
      const preserveLocalVisible = incomingWeight < existingWeight
        || shouldPreserveLiveTurnLocalVisibleItems(existingTurn, incomingTurn, existingWeight);
      merged.items = mergeItemsPreservingLocalVisible(existingItems, incomingTurn.items || [], preserveLocalVisible, incomingTurn);
      return merged;
    }

    function mergeThreadPreservingVisibleItems(existingThread, incomingThread, runtime = {}) {
      if (isV4ProjectionThread(incomingThread)) return mergeV4ProjectionThread(existingThread, incomingThread);
      if (!existingThread || !incomingThread || existingThread.id !== incomingThread.id) {
        return normalizeMergedThread(incomingThread);
      }
      const existingTurns = Array.isArray(existingThread.turns) ? existingThread.turns : [];
      const incomingTurns = Array.isArray(incomingThread.turns) ? incomingThread.turns : null;
      const existingById = new Map(existingTurns.map((turn) => [turn && turn.id, turn]).filter(([id]) => id));
      const initialSubmissionId = String(existingThread.mobileInitialSubmissionId || "");
      const merged = Object.assign({}, existingThread, incomingThread);
      if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoading")) delete merged.mobileLoading;
      if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoadError")) delete merged.mobileLoadError;
      if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileReadWarning")) delete merged.mobileReadWarning;
      if (!incomingTurns) return normalizeMergedThread(merged);
      const existingVisibleWeight = existingTurns.reduce((total, turn) => total + turnVisibleWeight(turn), 0);
      const incomingVisibleWeight = incomingTurns.reduce((total, turn) => total + turnVisibleWeight(turn), 0);
      const incomingHasAuthoritativeVisibleWindow = incomingTurns.length > 0 && incomingVisibleWeight > 0;
      if (!incomingTurns.length && existingTurns.length && existingVisibleWeight > 0 && incomingVisibleWeight === 0) {
        merged.turns = existingTurns;
        return normalizeMergedThread(merged);
      }

      merged.turns = incomingTurns.map((incomingTurn) => {
        const existingTurn = existingById.get(incomingTurn && incomingTurn.id);
        return existingTurn ? mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) : incomingTurn;
      });
      merged.turns = sortTurnsForDisplay(merged.turns);

      const incomingIds = new Set(merged.turns.map((turn) => turn && turn.id).filter(Boolean));
      const latestIncoming = merged.turns.length ? merged.turns[merged.turns.length - 1] : null;
      const preserveExpandedHistory = Boolean(existingThread.mobileHistoryExpanded)
        && (/turns-list/i.test(String(incomingThread.mobileReadMode || ""))
          || Boolean(incomingThread.mobileOlderTurnsCursor)
          || Number(incomingThread.mobileOmittedTurnCount || 0) > 0);
      let preservedExpandedTurnCount = 0;
      const activeTurnId = String(runtime.activeTurnId || "");
      for (const existingTurn of existingTurns) {
        if (!existingTurn || incomingIds.has(existingTurn.id)) continue;
        if (shouldDropInitialSubmissionEchoTurn(existingTurn, merged.turns, initialSubmissionId)) continue;
        if (preserveExpandedHistory) {
          merged.turns.push(existingTurn);
          preservedExpandedTurnCount += 1;
          continue;
        }
        if (incomingHasAuthoritativeVisibleWindow && !shouldPreserveMissingExistingTurn(existingTurn, merged, runtime)) continue;
        if (turnIsSupersededBy(existingTurn, latestIncoming)) continue;
        if (String(existingTurn.id || "") === activeTurnId || (!isTurnComplete(existingTurn) && turnVisibleWeight(existingTurn) > 0)) {
          merged.turns.push(existingTurn);
        }
      }

      if (preserveExpandedHistory) {
        merged.mobileHistoryExpanded = true;
        if (preservedExpandedTurnCount > 0) {
          merged.mobileOmittedTurnCount = Math.max(0, Number(merged.mobileOmittedTurnCount || 0) - preservedExpandedTurnCount);
        }
      }
      const normalized = normalizeMergedThread(merged, preserveExpandedHistory ? maxExpandedVisibleTurns : 0);
      if (!threadHasInitialSubmissionEcho(normalized, initialSubmissionId)) delete normalized.mobileInitialSubmissionId;
      return normalized;
    }

    return {
      mergeThreadPreservingVisibleItems,
      mergeTurnPreservingVisibleItems,
      shouldPreserveLiveTurnLocalVisibleItems,
    };
  }

  return {
    createThreadDetailMergePolicy,
  };
}));
