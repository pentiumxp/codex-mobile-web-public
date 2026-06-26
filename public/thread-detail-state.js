"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexThreadDetailState = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  const DETAIL_ONLY_SUMMARY_FIELDS = Object.freeze([
    "turns",
    "runtimeSettings",
    "threadTaskCards",
    "mobileDetailLoaded",
    "mobileLoading",
    "mobileLoadError",
    "mobileReadWarning",
    "mobileReadMode",
    "mobileDiagnostics",
    "mobileProjectionVersion",
    "mobileProjection",
    "mobileProjectionRevision",
    "mobileVisibleItemKeys",
    "mobileOlderTurnsCursor",
    "mobileNewerTurnsCursor",
  ]);

  function defaultVisibleWeight(item) {
    return item ? JSON.stringify(item).length : 0;
  }

  function threadListSummaryFromDetailThread(thread) {
    if (!thread || typeof thread !== "object" || !thread.id) return null;
    const summary = Object.assign({}, thread);
    for (const field of DETAIL_ONLY_SUMMARY_FIELDS) {
      delete summary[field];
    }
    return summary;
  }

  function threadHasLoadedDetailState(thread) {
    if (!thread || typeof thread !== "object") return false;
    if (thread.mobileLoading || thread.mobileLoadError) return false;
    if (!Array.isArray(thread.turns)) return false;
    if (thread.turns.length > 0) return true;
    return thread.mobileDetailLoaded === true;
  }

  function threadHasReusableLoadedDetailState(thread) {
    if (!threadHasLoadedDetailState(thread)) return false;
    return Array.isArray(thread.turns) && thread.turns.length > 0;
  }

  function rolloutSizeBytesFromThread(thread) {
    const size = Number(thread && thread.rolloutSizeBytes);
    return Number.isFinite(size) && size > 0 ? size : 0;
  }

  function emptyDetailHistoryEvidenceForThread(thread) {
    const rolloutSizeBytes = rolloutSizeBytesFromThread(thread);
    const omittedTurns = Math.max(0, Math.trunc(Number(thread && thread.mobileOmittedTurnCount) || 0));
    const visibleItemKeyCount = Array.isArray(thread && thread.mobileVisibleItemKeys)
      ? thread.mobileVisibleItemKeys.length
      : 0;
    const taskCardCount = Array.isArray(thread && thread.threadTaskCards)
      ? thread.threadTaskCards.length
      : 0;
    const pendingTaskCardCount = Math.max(0, Math.trunc(Number(thread && thread.pendingTaskCardCount) || 0));
    const hasActiveTurnEvidence = Boolean(thread && (thread.activeTurnId || thread.mobileRolloutActiveTurn));
    return {
      hasEvidence: rolloutSizeBytes > 0
        || omittedTurns > 0
        || visibleItemKeyCount > 0
        || hasActiveTurnEvidence
        || taskCardCount > 0
        || pendingTaskCardCount > 0,
      rolloutSizeBytes,
      omittedTurns,
      visibleItemKeyCount,
      hasActiveTurnEvidence,
      taskCardCount,
      pendingTaskCardCount,
    };
  }

  function planEmptyDetailHistoryRecovery(input = {}) {
    const thread = input.thread;
    if (!thread || typeof thread !== "object") {
      return { shouldRecover: false, reason: "missing-thread" };
    }
    if (thread.mobileLoading) {
      return { shouldRecover: false, reason: "thread-loading" };
    }
    if (thread.mobileLoadError) {
      return { shouldRecover: false, reason: "thread-load-error" };
    }
    const threadId = String(input.threadId || input.currentThreadId || thread.id || "").trim();
    if (!threadId) {
      return { shouldRecover: false, reason: "missing-thread-id" };
    }
    const evidence = emptyDetailHistoryEvidenceForThread(thread);
    if (!evidence.hasEvidence) {
      return { shouldRecover: false, reason: "no-history-evidence", evidence };
    }
    const readMode = String(thread.mobileReadMode || "");
    const recoveryKey = [threadId, readMode, evidence.rolloutSizeBytes, evidence.omittedTurns, evidence.visibleItemKeyCount].join("|");
    const nowMs = Number.isFinite(Number(input.nowMs)) ? Number(input.nowMs) : Date.now();
    const lastRecoveredAtMs = Number(input.lastRecoveredAtMs || 0);
    const cooldownMs = Math.max(0, Number(input.cooldownMs || 0));
    if (lastRecoveredAtMs && cooldownMs && nowMs - lastRecoveredAtMs < cooldownMs) {
      return {
        shouldRecover: false,
        reason: "cooldown",
        evidence,
        recoveryKey,
        nowMs,
      };
    }
    const details = input.details && typeof input.details === "object" ? input.details : {};
    return {
      shouldRecover: true,
      reason: "empty-detail-history-evidence",
      evidence,
      recoveryKey,
      nowMs,
      diagnosticReason: "empty_render_with_history_evidence",
      event: {
        threadId,
        readMode,
        rolloutSizeBytes: evidence.rolloutSizeBytes,
        omittedTurns: evidence.omittedTurns,
        visibleItemKeyCount: evidence.visibleItemKeyCount,
        source: String(details.source || "").slice(0, 80),
        renderMode: String(details.renderMode || "").slice(0, 80),
      },
    };
  }

  function planThreadOpenCacheReuse(input = {}) {
    const requestedThreadId = String(input.requestedThreadId || input.threadId || "").trim();
    const currentThreadId = String(input.currentThreadId || "").trim();
    const thread = input.currentThread || input.thread || null;
    const threadId = String(thread && thread.id || "").trim();
    if (!requestedThreadId) {
      return {
        shouldUseCachedCurrent: false,
        shouldReportEmptyCachedDetail: false,
        reason: "missing-requested-thread-id",
      };
    }
    if (requestedThreadId !== currentThreadId) {
      return {
        shouldUseCachedCurrent: false,
        shouldReportEmptyCachedDetail: false,
        reason: "different-current-thread",
      };
    }
    if (!thread || typeof thread !== "object") {
      return {
        shouldUseCachedCurrent: false,
        shouldReportEmptyCachedDetail: false,
        reason: "missing-current-thread",
      };
    }
    if (threadId && threadId !== requestedThreadId) {
      return {
        shouldUseCachedCurrent: false,
        shouldReportEmptyCachedDetail: false,
        reason: "current-thread-id-mismatch",
      };
    }
    if (thread.mobileLoading) {
      return {
        shouldUseCachedCurrent: false,
        shouldReportEmptyCachedDetail: false,
        reason: "current-thread-loading",
      };
    }
    if (thread.mobileLoadError) {
      return {
        shouldUseCachedCurrent: false,
        shouldReportEmptyCachedDetail: false,
        reason: "current-thread-load-error",
      };
    }
    if (threadHasReusableLoadedDetailState(thread)) {
      return {
        shouldUseCachedCurrent: true,
        shouldReportEmptyCachedDetail: false,
        reason: "reusable-loaded-detail",
      };
    }
    if (threadHasLoadedDetailState(thread) && Array.isArray(thread.turns) && thread.turns.length === 0) {
      return {
        shouldUseCachedCurrent: false,
        shouldReportEmptyCachedDetail: true,
        reason: "empty-loaded-detail-not-reusable",
      };
    }
    return {
      shouldUseCachedCurrent: false,
      shouldReportEmptyCachedDetail: false,
      reason: "not-loaded-detail",
    };
  }

  function threadIsSummaryOnlyCurrentThread(thread, currentThreadId) {
    return Boolean(thread
      && currentThreadId
      && String(thread.id || "") === String(currentThreadId || "")
      && !threadHasLoadedDetailState(thread)
      && !thread.mobileLoading
      && !thread.mobileLoadError);
  }

  function planSummaryOnlyCurrentThreadRecovery(input = {}) {
    const thread = input.thread;
    const currentThreadId = input.currentThreadId;
    if (!threadIsSummaryOnlyCurrentThread(thread, currentThreadId)) {
      return {
        shouldRecover: false,
        shouldScheduleRefresh: false,
        nextThread: thread || null,
        event: null,
        reason: "not-summary-only-current-thread",
      };
    }
    const summary = threadListSummaryFromDetailThread(thread) || Object.assign({}, thread || {});
    const nextThread = Object.assign({}, summary, {
      turns: [],
      mobileLoading: true,
      mobileLoadError: "",
    });
    return {
      shouldRecover: true,
      shouldScheduleRefresh: !input.hasThreadLoadController && !input.hasRefreshThreadController,
      nextThread,
      event: {
        threadId: String(currentThreadId || nextThread.id || ""),
        reason: "summary-only-current-thread",
        hasListTurnsField: Object.prototype.hasOwnProperty.call(thread, "turns"),
        buildId: String(input.clientBuildId || ""),
      },
      reason: "summary-only-current-thread",
    };
  }

  function mergeThreadSummaryIntoList(threads, thread, options = {}) {
    const summary = threadListSummaryFromDetailThread(thread);
    const currentThreads = Array.isArray(threads) ? threads : [];
    if (!summary) {
      return {
        changed: false,
        threads: currentThreads,
      };
    }
    const id = String(summary.id);
    const index = currentThreads.findIndex((entry) => String(entry && entry.id || "") === id);
    let nextThreads;
    if (index >= 0) {
      const existingSummary = threadListSummaryFromDetailThread(currentThreads[index]) || {};
      nextThreads = currentThreads.map((entry, entryIndex) => (
        entryIndex === index ? Object.assign({}, existingSummary, summary) : entry
      ));
    } else {
      nextThreads = [summary, ...currentThreads];
    }
    const visibleThreads = typeof options.visibleThreads === "function"
      ? options.visibleThreads
      : (value) => value;
    return {
      changed: true,
      threads: visibleThreads(nextThreads),
    };
  }

  function createThreadDetailStatePolicy(options = {}) {
    const itemVisibleWeight = typeof options.itemVisibleWeight === "function"
      ? options.itemVisibleWeight
      : defaultVisibleWeight;
    const isContextCompactionItem = typeof options.isContextCompactionItem === "function"
      ? options.isContextCompactionItem
      : () => false;
    const isOperationalItem = typeof options.isOperationalItem === "function"
      ? options.isOperationalItem
      : () => false;
    const isAssistantReceiptLikeItem = typeof options.isAssistantReceiptLikeItem === "function"
      ? options.isAssistantReceiptLikeItem
      : () => false;
    const isTurnComplete = typeof options.isTurnComplete === "function"
      ? options.isTurnComplete
      : () => false;
    const isReasoningItem = typeof options.isReasoningItem === "function"
      ? options.isReasoningItem
      : () => false;
    const visualReceiptMatchesSuppressionKeys = typeof options.visualReceiptMatchesSuppressionKeys === "function"
      ? options.visualReceiptMatchesSuppressionKeys
      : () => false;
    const comparableVisibleText = typeof options.comparableVisibleText === "function"
      ? options.comparableVisibleText
      : () => "";
    const visibleTextItemsLikelySame = typeof options.visibleTextItemsLikelySame === "function"
      ? options.visibleTextItemsLikelySame
      : () => false;
    const completedReceiptItemsLikelySame = typeof options.completedReceiptItemsLikelySame === "function"
      ? options.completedReceiptItemsLikelySame
      : () => false;
    const turnVisibleWeight = typeof options.turnVisibleWeight === "function"
      ? options.turnVisibleWeight
      : (turn) => (Array.isArray(turn && turn.items) ? turn.items : []).reduce((total, item) => total + itemVisibleWeight(item), 0);

    function completedIncomingTurnHasAuthoritativeReceipt(incomingTurn) {
      if (!incomingTurn || !isTurnComplete(incomingTurn) || !Array.isArray(incomingTurn.items)) return false;
      return incomingTurn.items.some((item) => isAssistantReceiptLikeItem(item));
    }

    function shouldDropLocalOnlyReceiptForIncomingTurn(item, incomingTurn = null) {
      return isAssistantReceiptLikeItem(item)
        && completedIncomingTurnHasAuthoritativeReceipt(incomingTurn);
    }

    function shouldPreserveLocalOnlyItem(item, preserveLocalVisible = false, suppressedVisualReceiptKeys = null, incomingTurn = null) {
      if (!item || itemVisibleWeight(item) <= 0) return false;
      if (visualReceiptMatchesSuppressionKeys(item, suppressedVisualReceiptKeys)) return false;
      if (shouldDropLocalOnlyReceiptForIncomingTurn(item, incomingTurn)) return false;
      if (item.type === "userMessage" && /^mux-user-/.test(String(item.id || ""))) return true;
      return preserveLocalVisible && !isReasoningItem(item);
    }

    function shouldPreserveExistingTurnVisibleItems(existingTurn, incomingTurn, existingWeight = null) {
      if (!existingTurn || !incomingTurn) return false;
      if (String(existingTurn.id || "") !== String(incomingTurn.id || "")) return false;
      if (isTurnComplete(existingTurn)) return false;
      const weight = existingWeight == null ? turnVisibleWeight(existingTurn) : Number(existingWeight || 0);
      return weight > 0;
    }

    function mergeItemPreservingVisibleFields(existingItem, incomingItem) {
      if (!existingItem || !incomingItem) return incomingItem || existingItem;
      const existingWeight = itemVisibleWeight(existingItem);
      const incomingWeight = itemVisibleWeight(incomingItem);
      if (existingWeight <= incomingWeight) return incomingItem;
      const merged = Object.assign({}, existingItem, incomingItem);
      if (typeof existingItem.text === "string") merged.text = existingItem.text;
      if (Array.isArray(existingItem.content)) merged.content = existingItem.content;
      if (Array.isArray(existingItem.summary)) merged.summary = existingItem.summary;
      if (isContextCompactionItem(existingItem) || isContextCompactionItem(incomingItem)) {
        if (!Object.prototype.hasOwnProperty.call(incomingItem, "mobileNotice")) delete merged.mobileNotice;
        if (!Object.prototype.hasOwnProperty.call(incomingItem, "mobileCompactionStatus")) delete merged.mobileCompactionStatus;
      } else if (existingItem.mobileNotice) {
        merged.mobileNotice = existingItem.mobileNotice;
      }
      if (isOperationalItem(existingItem)) {
        if (existingItem.command) merged.command = existingItem.command;
        if (Array.isArray(existingItem.fileNames)) merged.fileNames = existingItem.fileNames;
        if (existingItem.tool) merged.tool = existingItem.tool;
        if (existingItem.server) merged.server = existingItem.server;
        if (existingItem.namespace) merged.namespace = existingItem.namespace;
      }
      return merged;
    }

    function visibleTextItemsCanShareRenderIdentity(existingItem, incomingItem, incomingTurn = null) {
      return visibleTextItemsLikelySame(existingItem, incomingItem)
        || completedReceiptItemsLikelySame(existingItem, incomingItem, incomingTurn);
    }

    function mergeVisibleTextItemPreservingRenderIdentity(existingItem, incomingItem, incomingTurn = null) {
      const merged = mergeItemPreservingVisibleFields(existingItem, incomingItem);
      if (!existingItem || !incomingItem || !merged || !visibleTextItemsCanShareRenderIdentity(existingItem, incomingItem, incomingTurn)) return merged;
      const existingText = comparableVisibleText(existingItem);
      const incomingText = comparableVisibleText(incomingItem);
      if (completedReceiptItemsLikelySame(existingItem, incomingItem, incomingTurn)
        && typeof existingItem.text === "string"
        && existingText.length > incomingText.length
        && existingText.startsWith(incomingText)) {
        merged.text = existingItem.text;
      }
      if (existingItem.id) merged.id = existingItem.id;
      if (existingItem.startedAtMs && !incomingItem.startedAtMs) merged.startedAtMs = existingItem.startedAtMs;
      return merged;
    }

    return {
      completedIncomingTurnHasAuthoritativeReceipt,
      mergeItemPreservingVisibleFields,
      mergeVisibleTextItemPreservingRenderIdentity,
      shouldDropLocalOnlyReceiptForIncomingTurn,
      shouldPreserveExistingTurnVisibleItems,
      shouldPreserveLocalOnlyItem,
      visibleTextItemsCanShareRenderIdentity,
    };
  }

  return {
    createThreadDetailStatePolicy,
    emptyDetailHistoryEvidenceForThread,
    mergeThreadSummaryIntoList,
    planEmptyDetailHistoryRecovery,
    planThreadOpenCacheReuse,
    planSummaryOnlyCurrentThreadRecovery,
    rolloutSizeBytesFromThread,
    threadHasLoadedDetailState,
    threadHasReusableLoadedDetailState,
    threadIsSummaryOnlyCurrentThread,
    threadListSummaryFromDetailThread,
  };
}));
