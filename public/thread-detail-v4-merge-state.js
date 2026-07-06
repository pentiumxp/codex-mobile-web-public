"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexThreadDetailV4MergeState = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  function defaultNormalizeThread(thread) {
    return thread;
  }

  function defaultTurnVisibleWeight(turn) {
    return Array.isArray(turn && turn.items) ? turn.items.length : 0;
  }

  function defaultSortTurns(turns) {
    return Array.isArray(turns) ? turns.slice() : [];
  }

  function statusText(status) {
    if (!status) return "";
    if (typeof status === "object" && status.type) return String(status.type || "");
    return String(status || "");
  }

  function createThreadDetailV4MergePolicy(options = {}) {
    const normalizeThreadVisibleUserMessages = typeof options.normalizeThreadVisibleUserMessages === "function"
      ? options.normalizeThreadVisibleUserMessages
      : defaultNormalizeThread;
    const turnVisibleWeight = typeof options.turnVisibleWeight === "function"
      ? options.turnVisibleWeight
      : defaultTurnVisibleWeight;
    const isOptimisticUserMessage = typeof options.isOptimisticUserMessage === "function"
      ? options.isOptimisticUserMessage
      : () => false;
    const isRecentlySubmittedUserMessage = typeof options.isRecentlySubmittedUserMessage === "function"
      ? options.isRecentlySubmittedUserMessage
      : () => false;
    const isReasoningItem = typeof options.isReasoningItem === "function"
      ? options.isReasoningItem
      : () => false;
    const userMessageHasSubmissionId = typeof options.userMessageHasSubmissionId === "function"
      ? options.userMessageHasSubmissionId
      : (item, submissionId) => Boolean(item && submissionId && String(item.clientSubmissionId || "") === String(submissionId || ""));
    const userMessagesCanShadow = typeof options.userMessagesCanShadow === "function"
      ? options.userMessagesCanShadow
      : () => false;
    const isTurnComplete = typeof options.isTurnComplete === "function"
      ? options.isTurnComplete
      : (turn) => /completed|failed|cancel|error|interrupted/i.test(statusText(turn && turn.status));
    const isRunningStatus = typeof options.isRunningStatus === "function"
      ? options.isRunningStatus
      : (status) => /active|running|queued|processing|inprogress|in_progress|in-progress|pending|started/i.test(statusText(status));
    const isIncompleteInterruptedTurn = typeof options.isIncompleteInterruptedTurn === "function"
      ? options.isIncompleteInterruptedTurn
      : () => false;
    const turnHasActiveLiveItems = typeof options.turnHasActiveLiveItems === "function"
      ? options.turnHasActiveLiveItems
      : () => false;
    const turnOrderMs = typeof options.turnOrderMs === "function"
      ? options.turnOrderMs
      : () => 0;
    const mergeTurnPreservingVisibleItems = typeof options.mergeTurnPreservingVisibleItems === "function"
      ? options.mergeTurnPreservingVisibleItems
      : (existingTurn, incomingTurn) => incomingTurn || existingTurn;
    const sortTurnsForDisplay = typeof options.sortTurnsForDisplay === "function"
      ? options.sortTurnsForDisplay
      : defaultSortTurns;
    const maxVisibleTurnsForThread = typeof options.maxVisibleTurnsForThread === "function"
      ? options.maxVisibleTurnsForThread
      : () => 10;

    function isV4ProjectionThread(thread) {
      return Boolean(thread && (thread.mobileProjectionVersion === "v4"
        || (thread.mobileProjection && thread.mobileProjection.version === "v4")));
    }

    function shouldPreserveV4PendingOverlayItem(item) {
      return Boolean(item
        && item.type === "userMessage"
        && isOptimisticUserMessage(item)
        && (isRecentlySubmittedUserMessage(item) || item.mobileSendError));
    }

    function v4ThreadHasPendingMatch(thread, pendingItem) {
      if (!pendingItem || pendingItem.type !== "userMessage") return false;
      const submissionId = String(pendingItem.clientSubmissionId || "").trim();
      for (const turn of Array.isArray(thread && thread.turns) ? thread.turns : []) {
        for (const item of Array.isArray(turn && turn.items) ? turn.items : []) {
          if (!item || item.type !== "userMessage") continue;
          if (submissionId && userMessageHasSubmissionId(item, submissionId)) return true;
          if (!isOptimisticUserMessage(item) && userMessagesCanShadow(item, pendingItem)) return true;
        }
      }
      return false;
    }

    function v4ThreadHasDurableSubmissionMatch(thread, pendingItem) {
      if (!pendingItem || pendingItem.type !== "userMessage") return false;
      const submissionId = String(pendingItem.clientSubmissionId || "").trim();
      if (!submissionId) return false;
      for (const turn of Array.isArray(thread && thread.turns) ? thread.turns : []) {
        for (const item of Array.isArray(turn && turn.items) ? turn.items : []) {
          if (!item || item.type !== "userMessage") continue;
          if (isOptimisticUserMessage(item)) continue;
          if (userMessageHasSubmissionId(item, submissionId)) return true;
        }
      }
      return false;
    }

    function dropSyntheticSubmissionEchoes(thread, pendingItem) {
      if (!thread || !pendingItem || !Array.isArray(thread.turns)) return false;
      const submissionId = String(pendingItem.clientSubmissionId || "").trim();
      if (!submissionId) return false;
      let changed = false;
      for (const turn of thread.turns) {
        if (!turn || !Array.isArray(turn.items)) continue;
        const nextItems = turn.items.filter((item) => !(item
          && item.type === "userMessage"
          && isOptimisticUserMessage(item)
          && userMessageHasSubmissionId(item, submissionId)));
        if (nextItems.length !== turn.items.length) {
          turn.items = nextItems;
          changed = true;
        }
      }
      return changed;
    }

    function timestampMsFromValue(value) {
      if (value === undefined || value === null || value === "") return 0;
      const number = Number(value);
      if (Number.isFinite(number) && number > 0) {
        return number > 1_000_000_000 && number < 1_000_000_000_000
          ? Math.trunc(number * 1000)
          : Math.trunc(number);
      }
      const parsed = Date.parse(String(value || ""));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    }

    function itemOrderMs(item) {
      if (!item || typeof item !== "object") return 0;
      for (const field of [
        "mobileDisplayTimestampMs",
        "startedAtMs",
        "createdAtMs",
        "updatedAtMs",
        "timestampMs",
        "mobileDisplayTimestamp",
        "startedAt",
        "createdAt",
        "updatedAt",
        "timestamp",
      ]) {
        const value = timestampMsFromValue(item[field]);
        if (value > 0) return value;
      }
      return 0;
    }

    function appendV4PendingOverlayItem(turn, item) {
      if (!turn || !item) return;
      turn.items = Array.isArray(turn.items) ? turn.items : [];
      const submissionId = String(item.clientSubmissionId || "").trim();
      const alreadyPresent = turn.items.some((existing) => existing && (
        (submissionId && userMessageHasSubmissionId(existing, submissionId))
        || existing.id === item.id
        || userMessagesCanShadow(existing, item)
      ));
      if (alreadyPresent) return;
      const pendingOrder = itemOrderMs(item);
      const insertAt = pendingOrder > 0
        ? turn.items.findIndex((existing) => {
          const existingOrder = itemOrderMs(existing);
          return existingOrder > 0 && existingOrder > pendingOrder;
        })
        : -1;
      if (insertAt < 0) {
        turn.items.push(item);
      } else {
        turn.items.splice(insertAt, 0, item);
      }
    }

    function copyTurnWithOnlyItems(turn, items) {
      return Object.assign({}, turn || {}, {
        items: (items || []).slice(),
      });
    }

    function visibleNonReasoningItems(turn) {
      return (Array.isArray(turn && turn.items) ? turn.items : [])
        .filter((item) => item && turnVisibleWeight({ items: [item] }) > 0 && !isReasoningItem(item));
    }

    function existingV4TurnHasOnlyPendingOverlayItems(existingTurn) {
      const visibleItems = visibleNonReasoningItems(existingTurn);
      return Boolean(visibleItems.length && visibleItems.every(shouldPreserveV4PendingOverlayItem));
    }

    function turnHasNonUserAuthority(turn) {
      return visibleNonReasoningItems(turn).some((item) => item && item.type !== "userMessage");
    }

    function incomingTurnsHaveNewerNonUserAuthority(existingTurn, incomingTurns = []) {
      const existingOrder = turnOrderMs(existingTurn);
      if (!existingOrder) return false;
      return (incomingTurns || []).some((incomingTurn) => {
        if (!incomingTurn || String(incomingTurn.id || "") === String(existingTurn && existingTurn.id || "")) return false;
        if (!turnHasNonUserAuthority(incomingTurn)) return false;
        const incomingOrder = turnOrderMs(incomingTurn);
        return Boolean(incomingOrder && incomingOrder > existingOrder);
      });
    }

    function applyV4PendingOverlay(existingThread, mergedThread) {
      if (!existingThread || !mergedThread || !Array.isArray(existingThread.turns)) return mergedThread;
      mergedThread.turns = Array.isArray(mergedThread.turns) ? mergedThread.turns : [];
      const turnsById = new Map(mergedThread.turns.map((turn) => [String(turn && turn.id || ""), turn]));
      for (const existingTurn of existingThread.turns) {
        const pendingItems = (Array.isArray(existingTurn && existingTurn.items) ? existingTurn.items : [])
          .filter((item) => shouldPreserveV4PendingOverlayItem(item)
            && !v4ThreadHasPendingMatch(mergedThread, item));
        if (!pendingItems.length) continue;
        const unresolvedPendingItems = pendingItems.filter((item) => {
          if (!v4ThreadHasDurableSubmissionMatch(mergedThread, item)) return true;
          dropSyntheticSubmissionEchoes(mergedThread, item);
          return false;
        });
        if (!unresolvedPendingItems.length) continue;
        const targetTurn = turnsById.get(String(existingTurn.id || ""));
        if (targetTurn) {
          unresolvedPendingItems.forEach((item) => appendV4PendingOverlayItem(targetTurn, item));
          continue;
        }
        if (existingV4TurnHasOnlyPendingOverlayItems(existingTurn)
          && incomingTurnsHaveNewerNonUserAuthority(existingTurn, mergedThread.turns)) {
          continue;
        }
        const overlayTurn = copyTurnWithOnlyItems(existingTurn, unresolvedPendingItems);
        overlayTurn.mobilePendingOverlay = true;
        mergedThread.turns.push(overlayTurn);
        if (overlayTurn.id) turnsById.set(String(overlayTurn.id), overlayTurn);
      }
      return mergedThread;
    }

    function v4ProjectionRevisionValue(thread) {
      const direct = Number(thread && thread.mobileProjectionRevision);
      if (Number.isFinite(direct) && direct > 0) return Math.trunc(direct);
      const nested = Number(thread && thread.mobileProjection && thread.mobileProjection.revision);
      return Number.isFinite(nested) && nested > 0 ? Math.trunc(nested) : 0;
    }

    function isV4ProjectionRefreshRegressive(existingThread, incomingThread) {
      const existingRevision = v4ProjectionRevisionValue(existingThread);
      const incomingRevision = v4ProjectionRevisionValue(incomingThread);
      return Boolean(existingRevision && incomingRevision && incomingRevision < existingRevision);
    }

    function threadVisibleWeight(turns = []) {
      return (Array.isArray(turns) ? turns : []).reduce((total, turn) => total + turnVisibleWeight(turn), 0);
    }

    function incomingTurnsHaveNewerVisibleEvidence(existingTurns = [], incomingTurns = []) {
      const existingIds = new Set((existingTurns || []).map((turn) => String(turn && turn.id || "")).filter(Boolean));
      const existingMaxOrder = (existingTurns || []).reduce((max, turn) => Math.max(max, turnOrderMs(turn) || 0), 0);
      return (incomingTurns || []).some((turn) => {
        const id = String(turn && turn.id || "");
        if (id && existingIds.has(id)) return false;
        if (turnVisibleWeight(turn) <= 0) return false;
        const order = turnOrderMs(turn);
        return Boolean(order && existingMaxOrder && order > existingMaxOrder);
      });
    }

    function isV4ProjectionVisibleWindowRegressive(existingThread, incomingThread) {
      const existingTurns = Array.isArray(existingThread && existingThread.turns) ? existingThread.turns : [];
      const incomingTurns = Array.isArray(incomingThread && incomingThread.turns) ? incomingThread.turns : [];
      if (!existingTurns.length || !incomingTurns.length) return false;
      if (Math.min(existingTurns.length, incomingTurns.length) < 3) return false;
      if (existingTurns.some(isActiveLikeProjectionTurn) || incomingTurns.some(isActiveLikeProjectionTurn)) return false;
      if (incomingTurnsHaveNewerVisibleEvidence(existingTurns, incomingTurns)) return false;
      const existingWeight = threadVisibleWeight(existingTurns);
      const incomingWeight = threadVisibleWeight(incomingTurns);
      if (existingWeight <= 0 || incomingWeight <= 0 || incomingWeight >= existingWeight) return false;
      return incomingWeight < Math.max(1, Math.floor(existingWeight * 0.55));
    }

    function isActiveLikeProjectionTurn(turn) {
      return Boolean(turn
        && !isTurnComplete(turn)
        && (isRunningStatus(turn.status) || isIncompleteInterruptedTurn(turn) || turnHasActiveLiveItems(turn)));
    }

    function incomingTurnsClearlySupersedeExistingTurn(existingTurn, incomingTurns) {
      const existingOrder = turnOrderMs(existingTurn);
      if (!existingOrder) return false;
      return (incomingTurns || []).some((incomingTurn) => {
        if (!incomingTurn || String(incomingTurn.id || "") === String(existingTurn && existingTurn.id || "")) return false;
        const incomingOrder = turnOrderMs(incomingTurn);
        return Boolean(incomingOrder && incomingOrder > existingOrder);
      });
    }

    function incomingThreadIsPartialActiveRefresh(incomingThread, incomingTurns = []) {
      if (!incomingThread) return false;
      const readMode = String(incomingThread.mobileReadMode || "");
      const projection = incomingThread.mobileProjection && typeof incomingThread.mobileProjection === "object"
        ? incomingThread.mobileProjection
        : {};
      const partialLike = /projection-v4-partial/i.test(readMode)
        || projection.partial === true
        || /partial/i.test(String(projection.source || ""));
      return Boolean(partialLike && (incomingTurns || []).some(isActiveLikeProjectionTurn));
    }

    function incomingTurnsHaveNewerCompletedVisibleTurn(existingTurn, incomingTurns = []) {
      const existingOrder = turnOrderMs(existingTurn);
      if (!existingOrder) return false;
      return (incomingTurns || []).some((incomingTurn) => {
        if (!incomingTurn || String(incomingTurn.id || "") === String(existingTurn && existingTurn.id || "")) return false;
        if (!isTurnComplete(incomingTurn) || turnVisibleWeight(incomingTurn) <= 0) return false;
        const incomingOrder = turnOrderMs(incomingTurn);
        return Boolean(incomingOrder && incomingOrder > existingOrder);
      });
    }

    function existingV4TurnHasOnlyMatchedPendingItems(existingTurn, incomingTurns) {
      const visibleItems = (Array.isArray(existingTurn && existingTurn.items) ? existingTurn.items : [])
        .filter((item) => item && turnVisibleWeight({ items: [item] }) > 0 && !isReasoningItem(item));
      return Boolean(visibleItems.length && visibleItems.every((item) => shouldPreserveV4PendingOverlayItem(item)
        && v4ThreadHasPendingMatch({ turns: incomingTurns || [] }, item)));
    }

    function shouldPreserveExistingV4ProjectionTurn(existingThread, incomingThread, existingTurn, incomingTurns) {
      if (!existingTurn || turnVisibleWeight(existingTurn) <= 0) return false;
      const id = String(existingTurn.id || "");
      if (id && (incomingTurns || []).some((turn) => String(turn && turn.id || "") === id)) return false;
      if (existingV4TurnHasOnlyMatchedPendingItems(existingTurn, incomingTurns)) return false;
      const activeLike = isActiveLikeProjectionTurn(existingTurn);
      const regressiveRefresh = isV4ProjectionRefreshRegressive(existingThread, incomingThread);
      if (!activeLike
        && !regressiveRefresh
        && isTurnComplete(existingTurn)
        && incomingThreadIsPartialActiveRefresh(incomingThread, incomingTurns)
        && !incomingTurnsHaveNewerCompletedVisibleTurn(existingTurn, incomingTurns)) {
        return true;
      }
      if (!activeLike && !regressiveRefresh) return false;
      return !incomingTurnsClearlySupersedeExistingTurn(existingTurn, incomingTurns);
    }

    function mergeV4ProjectionThread(existingThread, incomingThread) {
      if (!existingThread || !incomingThread || existingThread.id !== incomingThread.id) {
        return normalizeThreadVisibleUserMessages(incomingThread);
      }
      const merged = Object.assign({}, existingThread, incomingThread);
      if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoading")) delete merged.mobileLoading;
      if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoadError")) delete merged.mobileLoadError;
      if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileReadWarning")) delete merged.mobileReadWarning;
      if (Array.isArray(incomingThread.turns)) {
        const existingTurns = Array.isArray(existingThread.turns) ? existingThread.turns : [];
        const incomingTurns = incomingThread.turns.slice();
        const existingVisibleWeight = existingTurns.reduce((total, turn) => total + turnVisibleWeight(turn), 0);
        const incomingVisibleWeight = incomingTurns.reduce((total, turn) => total + turnVisibleWeight(turn), 0);
        if (!incomingTurns.length && existingTurns.length && existingVisibleWeight > 0 && incomingVisibleWeight === 0) {
          merged.turns = existingTurns;
          return normalizeThreadVisibleUserMessages(merged);
        }
        if (isV4ProjectionVisibleWindowRegressive(existingThread, incomingThread)) {
          merged.turns = existingTurns;
          return normalizeThreadVisibleUserMessages(merged);
        }
        const existingById = new Map(existingTurns.map((turn) => [String(turn && turn.id || ""), turn]));
        merged.turns = incomingTurns.map((incomingTurn) => {
          const existingTurn = existingById.get(String(incomingTurn && incomingTurn.id || ""));
          return existingTurn ? mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) : incomingTurn;
        });
        for (const existingTurn of existingTurns) {
          if (shouldPreserveExistingV4ProjectionTurn(existingThread, incomingThread, existingTurn, merged.turns)) {
            merged.turns.push(existingTurn);
          }
        }
        applyV4PendingOverlay(existingThread, merged);
        merged.turns = sortTurnsForDisplay(merged.turns).slice(-maxVisibleTurnsForThread(merged));
      }
      if (isV4ProjectionRefreshRegressive(existingThread, incomingThread)) {
        const existingRevision = v4ProjectionRevisionValue(existingThread);
        if (existingRevision) {
          merged.mobileProjectionRevision = existingRevision;
          if (merged.mobileProjection && typeof merged.mobileProjection === "object") {
            merged.mobileProjection = Object.assign({}, merged.mobileProjection, { revision: existingRevision });
          }
        }
      }
      return normalizeThreadVisibleUserMessages(merged);
    }

    return {
      applyV4PendingOverlay,
      isV4ProjectionRefreshRegressive,
      isV4ProjectionVisibleWindowRegressive,
      isV4ProjectionThread,
      mergeV4ProjectionThread,
      shouldPreserveExistingV4ProjectionTurn,
      threadVisibleWeight,
      v4ProjectionRevisionValue,
    };
  }

  return {
    createThreadDetailV4MergePolicy,
  };
}));
