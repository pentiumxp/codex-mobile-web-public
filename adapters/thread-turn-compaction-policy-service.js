"use strict";

function statusText(status) {
  if (!status) return "";
  if (typeof status === "string") return status;
  return String(status.type || status.status || status.state || JSON.stringify(status));
}

function defaultIsCompletedStatus(status) {
  return /completed|failed|cancel|error|interrupted/i.test(statusText(status));
}

function defaultIsLiveTurn(turn) {
  const text = statusText(turn && turn.status).toLowerCase();
  return /(running|active|queued|processing|inprogress|in_progress|in-progress)/.test(text)
    || (text === "interrupted" && turn && !turn.completedAt && !turn.durationMs);
}

function defaultItemType(item) {
  return String(item && item.type || "").toLowerCase();
}

function createThreadTurnCompactionPolicyService(options = {}) {
  const isLiveTurn = typeof options.isLiveTurn === "function" ? options.isLiveTurn : defaultIsLiveTurn;
  const isCompletedStatus = typeof options.isCompletedStatus === "function" ? options.isCompletedStatus : defaultIsCompletedStatus;
  const isOperationalItem = typeof options.isOperationalItem === "function"
    ? options.isOperationalItem
    : (item) => /command|tool|file|search|exec|patch/.test(defaultItemType(item));
  const isUserQuestionItem = typeof options.isUserQuestionItem === "function"
    ? options.isUserQuestionItem
    : (item) => defaultItemType(item) === "usermessage";
  const isAssistantReceiptItem = typeof options.isAssistantReceiptItem === "function"
    ? options.isAssistantReceiptItem
    : (item) => defaultItemType(item) === "agentmessage" || defaultItemType(item) === "plan";
  const isVisualReceiptItem = typeof options.isVisualReceiptItem === "function"
    ? options.isVisualReceiptItem
    : (item) => defaultItemType(item) === "imageview" || defaultItemType(item) === "imagegeneration";
  const isTurnUsageSummaryItem = typeof options.isTurnUsageSummaryItem === "function"
    ? options.isTurnUsageSummaryItem
    : (item) => defaultItemType(item) === "turnusagesummary";
  const isDiagnosticReceiptItem = typeof options.isDiagnosticReceiptItem === "function"
    ? options.isDiagnosticReceiptItem
    : (item) => defaultItemType(item) === "turndiagnostic";

  function trailingOperationIndexes(items, allowLiveOperation, maxOperations = 1) {
    const indexes = new Set();
    if (!allowLiveOperation || !Array.isArray(items)) return indexes;
    const requestedLimit = Number(maxOperations || 1);
    const limit = maxOperations === "all"
      ? items.length
      : Math.max(1, Math.min(50, Number.isFinite(requestedLimit) ? requestedLimit : 1));
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (!isOperationalItem(items[index])) continue;
      indexes.add(index);
      if (indexes.size >= limit) break;
    }
    return indexes;
  }

  function receiptOnlyItemIndexes(items) {
    const indexes = new Set();
    if (!Array.isArray(items)) return indexes;
    let receiptIndex = -1;
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (isUserQuestionItem(item)) indexes.add(index);
      if (isTurnUsageSummaryItem(item)) indexes.add(index);
      if (isVisualReceiptItem(item)) indexes.add(index);
      if (isDiagnosticReceiptItem(item)) indexes.add(index);
      if (isAssistantReceiptItem(item)) receiptIndex = index;
    }
    if (receiptIndex >= 0) indexes.add(receiptIndex);
    return indexes;
  }

  function isEndedTurn(turn) {
    if (!turn || typeof turn !== "object" || isLiveTurn(turn)) return false;
    if (isCompletedStatus(turn.status)) return true;
    return Boolean(turn.completedAt || turn.completed_at || turn.completedAtMs
      || turn.endedAt || turn.ended_at || turn.finishedAt || turn.finished_at
      || turn.durationMs || turn.duration_ms);
  }

  function findPreviousEndedTurnIndex(turns, startIndex) {
    for (let index = Math.min(startIndex, turns.length - 1); index >= 0; index -= 1) {
      if (isEndedTurn(turns[index])) return index;
    }
    for (let index = Math.min(startIndex, turns.length - 1); index >= 0; index -= 1) {
      if (turns[index] && !isLiveTurn(turns[index])) return index;
    }
    return -1;
  }

  function turnHasVisibleDetailItems(turn) {
    if (!turn || !Array.isArray(turn.items)) return false;
    return turn.items.some((item) => isUserQuestionItem(item)
      || isAssistantReceiptItem(item)
      || isVisualReceiptItem(item)
      || isDiagnosticReceiptItem(item)
      || isOperationalItem(item)
      || isTurnUsageSummaryItem(item));
  }

  function findPreviousVisibleNonLiveTurnIndex(turns, startIndex) {
    for (let index = Math.min(startIndex, turns.length - 1); index >= 0; index -= 1) {
      const turn = turns[index];
      if (!turn || isLiveTurn(turn)) continue;
      if (turnHasVisibleDetailItems(turn)) return index;
    }
    return -1;
  }

  function operationDetailTurnIndexes(turns) {
    const indexes = new Set();
    if (!Array.isArray(turns) || turns.length === 0) return indexes;
    let latestLiveIndex = -1;
    for (let index = turns.length - 1; index >= 0; index -= 1) {
      if (isLiveTurn(turns[index])) {
        latestLiveIndex = index;
        break;
      }
    }
    if (latestLiveIndex >= 0) {
      indexes.add(latestLiveIndex);
      const previousVisibleIndex = findPreviousVisibleNonLiveTurnIndex(turns, latestLiveIndex - 1);
      if (previousVisibleIndex >= 0) indexes.add(previousVisibleIndex);
      const previousEndedIndex = findPreviousEndedTurnIndex(turns, latestLiveIndex - 1);
      if (previousEndedIndex >= 0) indexes.add(previousEndedIndex);
      return indexes;
    }
    const latestVisibleIndex = findPreviousVisibleNonLiveTurnIndex(turns, turns.length - 1);
    if (latestVisibleIndex >= 0) {
      indexes.add(latestVisibleIndex);
      const latestEndedIndex = findPreviousEndedTurnIndex(turns, turns.length - 1);
      if (latestEndedIndex >= 0) indexes.add(latestEndedIndex);
      return indexes;
    }
    const latestEndedIndex = findPreviousEndedTurnIndex(turns, turns.length - 1);
    indexes.add(latestEndedIndex >= 0 ? latestEndedIndex : turns.length - 1);
    return indexes;
  }

  return {
    findPreviousEndedTurnIndex,
    findPreviousVisibleNonLiveTurnIndex,
    isEndedTurn,
    operationDetailTurnIndexes,
    receiptOnlyItemIndexes,
    trailingOperationIndexes,
    turnHasVisibleDetailItems,
  };
}

module.exports = {
  createThreadTurnCompactionPolicyService,
  defaultIsCompletedStatus,
  defaultIsLiveTurn,
};
