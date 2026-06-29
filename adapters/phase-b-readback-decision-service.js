"use strict";

function compactLabel(value, maxLength = 100) {
  return String(value || "").trim().slice(0, maxLength);
}

function objectOrNull(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function lowerLabel(value, maxLength = 100) {
  return compactLabel(value, maxLength).toLowerCase();
}

function boundedCount(value) {
  return Number.isFinite(Number(value)) ? Math.max(0, Math.min(100000, Math.trunc(Number(value)))) : 0;
}

function boundedBytes(value) {
  return Number.isFinite(Number(value)) ? Math.max(0, Math.min(100 * 1024 * 1024, Math.trunc(Number(value)))) : 0;
}

function boundedNumberMap(value = {}, limit = 12, maxValue = 100 * 1024 * 1024) {
  const source = objectOrNull(value) || {};
  const entries = Object.entries(source)
    .map(([key, raw]) => {
      const number = Number(raw);
      if (!Number.isFinite(number) || number <= 0) return null;
      return [
        compactLabel(key || "unknown", 40),
        Math.max(0, Math.min(maxValue, Math.trunc(number))),
      ];
    })
    .filter(Boolean)
    .sort((left, right) => right[1] - left[1])
    .slice(0, Math.max(1, Math.trunc(Number(limit) || 12)));
  return Object.fromEntries(entries);
}

function buildEvidence(report = {}) {
  const publicConfig = objectOrNull(report.publicConfig) || {};
  const prewarm = objectOrNull(publicConfig.threadListFallbackPrewarm) || {};
  const prewarmSettle = objectOrNull(report.threadListPrewarmSettle) || {};
  const list = objectOrNull(report.threadList) || {};
  const afterDeferred = objectOrNull(report.threadListAfterDeferred) || {};
  const warmCheck = objectOrNull(report.threadListWarmCheck) || {};
  const muxRuntime = objectOrNull(report.muxRuntime) || {};
  const muxMetrics = objectOrNull(report.muxMetrics) || {};
  const muxThreadList = objectOrNull(muxMetrics.threadList) || {};
  const detail = objectOrNull(report.detail) || {};
  return {
    threadListPrewarmEnabled: prewarm.enabled === true,
    threadListPrewarmScheduled: prewarm.scheduled === true,
    threadListPrewarmRunning: prewarm.running === true,
    threadListPrewarmCompleted: prewarm.completed === true,
    threadListPrewarmDeferralCount: boundedCount(prewarm.deferralCount),
    threadListPrewarmLastStatus: compactLabel(prewarm.lastStatus, 40),
    threadListPrewarmLastErrorCode: compactLabel(prewarm.lastErrorCode, 80),
    threadListPrewarmLastCacheDecision: compactLabel(prewarm.lastCacheDecision, 80),
    threadListPrewarmLastCacheHit: prewarm.lastCacheHit === true,
    threadListPrewarmLastSourceSnapshotHit: prewarm.lastSourceSnapshotHit === true,
    threadListPrewarmSourceSnapshotLimit: boundedCount(prewarm.sourceSnapshotLimit),
    threadListPrewarmLastSourceSnapshotLimit: boundedCount(prewarm.lastSourceSnapshotLimit),
    threadListPrewarmLastResultCount: boundedCount(prewarm.lastResultCount),
    threadListPrewarmLastElapsedMs: boundedCount(prewarm.lastElapsedMs),
    threadListPrewarmLastSourceSnapshotRawCount: boundedCount(prewarm.lastSourceSnapshotRawCount),
    threadListPrewarmSettleAttempted: prewarmSettle.attempted === true,
    threadListPrewarmSettleSettled: prewarmSettle.settled === true,
    threadListPrewarmSettleReason: compactLabel(prewarmSettle.reason, 80),
    threadListPrewarmSettleSampleCount: boundedCount(prewarmSettle.sampleCount),
    threadListPrewarmSettleElapsedMs: boundedCount(prewarmSettle.elapsedMs),
    threadListOwner: compactLabel(list.coldPathOwner, 80),
    threadListReason: compactLabel(list.coldPathReason, 80),
    threadListCacheDecision: compactLabel(list.fallbackCacheDecision, 80),
    threadListCompatibleCacheHit: list.fallbackCompatibleCacheHit === true,
    threadListCompatibleCacheLimit: boundedCount(list.fallbackCompatibleCacheLimit),
    threadListSourceSnapshotHit: list.fallbackSourceSnapshotHit === true,
    threadListSourceSnapshotRawCount: boundedCount(list.fallbackSourceSnapshotRawCount),
    threadListResultCount: boundedCount(list.resultCount),
    threadListFallbackMs: boundedCount(list.fallbackMs),
    threadListMergeMs: boundedCount(list.mergeMs),
    threadListDecorateMs: boundedCount(list.decorateMs),
    threadListFinalFilterInputCount: boundedCount(list.fallbackBaselineFinalFilterInputCount),
    threadListFinalFilterOutputCount: boundedCount(list.fallbackBaselineFinalFilterOutputCount),
    threadListMergeInputCount: boundedCount(list.fallbackBaselineMergeInputCount),
    threadListMergeOutputCount: boundedCount(list.fallbackBaselineMergeOutputCount),
    threadListMergeDuplicateCount: boundedCount(list.fallbackBaselineMergeDuplicateCount),
    threadListLimitDropCount: boundedCount(list.fallbackBaselineLimitDropCount),
    threadListFallbackRolloutStatusStatReadCount: boundedCount(list.fallbackRolloutStatusStatReadCount),
    threadListFallbackRolloutStatusStatReuseCount: boundedCount(list.fallbackRolloutStatusStatReuseCount),
    threadListRouteMergeAppServerInputCount: boundedCount(list.routeMergeAppServerInputCount),
    threadListRouteMergeFallbackInputCount: boundedCount(list.routeMergeFallbackInputCount),
    threadListRouteMergeInputCount: boundedCount(list.routeMergeInputCount),
    threadListRouteMergeUniqueInputCount: boundedCount(list.routeMergeUniqueInputCount),
    threadListRouteMergeDuplicateCount: boundedCount(list.routeMergeDuplicateCount),
    threadListRouteMergeMergedCount: boundedCount(list.routeMergeMergedCount),
    threadListRouteMergeOutputCount: boundedCount(list.routeMergeOutputCount),
    threadListRouteMergeLimitDropCount: boundedCount(list.routeMergeLimitDropCount),
    threadListRequestContextArchivedIdsReadCount: boundedCount(list.requestContextArchivedIdsReadCount),
    threadListRequestContextSessionIndexReadCount: boundedCount(list.requestContextSessionIndexReadCount),
    threadListRequestContextCachedDisplayReadCount: boundedCount(list.requestContextCachedDisplayReadCount),
    threadListRequestContextRolloutStatReadCount: boundedCount(list.requestContextRolloutStatReadCount),
    threadListSummaryMergeInputCount: boundedCount(list.summaryMergeInputCount),
    threadListSummaryMergeInvalidCount: boundedCount(list.summaryMergeInvalidCount),
    threadListSummaryMergeArchivedIdSkipCount: boundedCount(list.summaryMergeArchivedIdSkipCount),
    threadListSummaryMergeDuplicateIdCount: boundedCount(list.summaryMergeDuplicateIdCount),
    threadListSummaryMergeArchivedSignalDropCount: boundedCount(list.summaryMergeArchivedSignalDropCount),
    threadListSummaryMergeSubagentDropCount: boundedCount(list.summaryMergeSubagentDropCount),
    threadListSummaryMergeByIdCount: boundedCount(list.summaryMergeByIdCount),
    threadListSummaryMergeHydratedCount: boundedCount(list.summaryMergeHydratedCount),
    threadListSummaryMergeVisibleCount: boundedCount(list.summaryMergeVisibleCount),
    threadListSummaryMergeOutputCount: boundedCount(list.summaryMergeOutputCount),
    threadListSummaryMergeCachedDisplayMs: boundedCount(list.summaryMergeCachedDisplayMs),
    threadListSummaryMergeNormalizeMs: boundedCount(list.summaryMergeNormalizeMs),
    threadListSummaryMergeDisplayMergeMs: boundedCount(list.summaryMergeDisplayMergeMs),
    threadListSummaryMergeHydrateTitleMs: boundedCount(list.summaryMergeHydrateTitleMs),
    threadListSummaryMergeFinalFilterMs: boundedCount(list.summaryMergeFinalFilterMs),
    threadListSummaryMergeSortMs: boundedCount(list.summaryMergeSortMs),
    threadListSummaryMergeTotalMs: boundedCount(list.summaryMergeTotalMs),
    threadListSummaryMergeDominantStage: compactLabel(list.summaryMergeDominantStage, 80),
    threadListAppServerRequestedLimit: boundedCount(list.appServerRequestedLimit),
    threadListAppServerRequestLimit: boundedCount(list.appServerRequestLimit),
    threadListAppServerRequestReason: compactLabel(list.appServerRequestReason, 80),
    threadListAppServerOverfetchFactor: boundedCount(list.appServerOverfetchFactor),
    threadListAppServerMs: boundedCount(list.appServerMs),
    threadListAppServerRpcMs: boundedCount(list.appServerRpcMs),
    threadListAppServerVisibleFilterMs: boundedCount(list.appServerVisibleFilterMs),
    threadListAppServerWorkspaceFilterMs: boundedCount(list.appServerWorkspaceFilterMs),
    threadListAppServerPostProcessMs: boundedCount(list.appServerPostProcessMs),
    threadListAppServerMeasuredMs: boundedCount(list.appServerMeasuredMs),
    threadListAppServerUnattributedMs: boundedCount(list.appServerUnattributedMs),
    threadListAppServerRawCount: boundedCount(list.appServerRawCount),
    threadListAppServerVisibleCount: boundedCount(list.appServerVisibleCount),
    threadListAppServerFilteredCount: boundedCount(list.appServerFilteredCount),
    threadListAppServerTransportKind: compactLabel(list.appServerTransportKind, 80),
    threadListAppServerEndpointKind: compactLabel(list.appServerEndpointKind, 80),
    threadListAppServerEndpointProtocol: compactLabel(list.appServerEndpointProtocol, 40),
    threadListAppServerRpcAttemptCount: boundedCount(list.appServerRpcAttemptCount),
    threadListAppServerRpcTimeoutMs: boundedCount(list.appServerRpcTimeoutMs),
    threadListAppServerRpcRetryEnabled: list.appServerRpcRetryEnabled === true,
    threadListAppServerRpcTimedOut: list.appServerRpcTimedOut === true,
    threadListAppServerRpcErrorCode: compactLabel(list.appServerRpcErrorCode, 80),
    threadListAppServerRequestPayloadBytes: boundedBytes(list.appServerRequestPayloadBytes),
    threadListAppServerRequestParamBytes: boundedBytes(list.appServerRequestParamBytes),
    threadListAppServerResponsePayloadBytes: boundedBytes(list.appServerResponsePayloadBytes),
    threadListMuxRuntimeTransport: compactLabel(muxRuntime.transport, 80),
    threadListMuxRuntimeEndpointKind: compactLabel(muxRuntime.endpointKind, 80),
    threadListMuxRuntimeEndpointProtocol: compactLabel(muxRuntime.endpointProtocol, 40),
    threadListMuxRuntimeIsProfileMuxEndpoint: muxRuntime.isProfileMuxEndpoint === true,
    threadListMuxRuntimeSharedRequired: muxRuntime.sharedRequired === true,
    threadListMuxRuntimePersistentOwnedMux: muxRuntime.persistentOwnedMux === true,
    threadListMuxRuntimeMobileOwnedMuxRunning: muxRuntime.mobileOwnedMuxRunning === true,
    threadListMuxRuntimeMobileEcho: muxRuntime.mobileEcho === true,
    threadListMuxRuntimeNotificationReplay: muxRuntime.notificationReplay === true,
    threadListMuxRuntimeServerRequestProxy: muxRuntime.serverRequestProxy === true,
    threadListMuxRuntimeThreadGoalRpc: muxRuntime.threadGoalRpc === true,
    threadListMuxRuntimeMuxMetricsRpc: muxRuntime.muxMetricsRpc === true,
    threadListMuxMetricsSupported: muxMetrics.supported === true,
    threadListMuxMetricsOk: muxMetrics.ok === true,
    threadListMuxMetricsReason: compactLabel(muxMetrics.reason, 80),
    threadListMuxPendingCount: boundedCount(muxMetrics.pendingCount),
    threadListMuxServerRequestCount: boundedCount(muxMetrics.serverRequestCount),
    threadListMuxTrackedMethodCount: boundedCount(muxMetrics.trackedMethodCount),
    threadListMuxRpcCount: boundedCount(muxThreadList.count),
    threadListMuxRpcErrorCount: boundedCount(muxThreadList.errorCount),
    threadListMuxRpcTotalMs: boundedCount(muxThreadList.totalMs),
    threadListMuxRpcAvgMs: boundedCount(muxThreadList.avgMs),
    threadListMuxRpcLastMs: boundedCount(muxThreadList.lastMs),
    threadListMuxRpcMaxMs: boundedCount(muxThreadList.maxMs),
    threadListMuxRequestBytes: boundedBytes(muxThreadList.lastRequestBytes),
    threadListMuxResponseBytes: boundedBytes(muxThreadList.lastResponseBytes),
    threadListMuxLastAgeMs: boundedCount(muxThreadList.lastAgeMs),
    threadListAfterDeferredOwner: compactLabel(afterDeferred.coldPathOwner, 80),
    threadListAfterDeferredReason: compactLabel(afterDeferred.coldPathReason, 80),
    threadListAfterDeferredCacheDecision: compactLabel(afterDeferred.fallbackCacheDecision, 80),
    threadListAfterDeferredFinalFilterInputCount: boundedCount(afterDeferred.fallbackBaselineFinalFilterInputCount),
    threadListAfterDeferredFinalFilterOutputCount: boundedCount(afterDeferred.fallbackBaselineFinalFilterOutputCount),
    threadListAfterDeferredMergeInputCount: boundedCount(afterDeferred.fallbackBaselineMergeInputCount),
    threadListAfterDeferredMergeOutputCount: boundedCount(afterDeferred.fallbackBaselineMergeOutputCount),
    threadListAfterDeferredMergeDuplicateCount: boundedCount(afterDeferred.fallbackBaselineMergeDuplicateCount),
    threadListAfterDeferredLimitDropCount: boundedCount(afterDeferred.fallbackBaselineLimitDropCount),
    threadListWarmCheckOwner: compactLabel(warmCheck.coldPathOwner, 80),
    threadListWarmCheckReason: compactLabel(warmCheck.coldPathReason, 80),
    threadListWarmCheckCacheDecision: compactLabel(warmCheck.fallbackCacheDecision, 80),
    detailOwner: compactLabel(detail.coldPathOwner, 80),
    detailReason: compactLabel(detail.coldPathReason, 80),
    detailReadMode: compactLabel(detail.readMode, 100),
    detailReadDecision: compactLabel(detail.readDecision, 100),
    detailProjectionState: compactLabel(detail.projectionState, 80),
    detailActiveOverlayAction: compactLabel(detail.activeOverlayAction, 80),
    detailActiveOverlayReason: compactLabel(detail.activeOverlayReason, 80),
    detailActiveOverlayGate: compactLabel(detail.activeOverlayGate, 80),
    detailActiveOverlayGateReason: compactLabel(detail.activeOverlayGateReason, 80),
    detailActiveOverlayNextAction: compactLabel(detail.activeOverlayNextAction, 100),
    detailActiveOverlayWindowFirst: detail.activeOverlayWindowFirst === true,
    detailTotalMs: boundedCount(detail.totalMs),
    detailSummaryMs: boundedCount(detail.summaryMs),
    detailProjectionMs: boundedCount(detail.projectionMs),
    detailActiveOverlayMs: boundedCount(detail.activeOverlayMs),
    detailActiveOverlayProjectionLookupMs: boundedCount(detail.activeOverlayProjectionLookupMs),
    detailActiveOverlayBackfillWindowMs: boundedCount(detail.activeOverlayBackfillWindowMs),
    detailActiveOverlayFullProjectionMs: boundedCount(detail.activeOverlayFullProjectionMs),
    detailActiveOverlayHistoryBaselineMs: boundedCount(detail.activeOverlayHistoryBaselineMs),
    detailActiveOverlayMergeMs: boundedCount(detail.activeOverlayMergeMs),
    detailPrepareResponseMs: boundedCount(detail.prepareResponseMs),
    detailThreadReadMs: boundedCount(detail.threadReadMs),
    detailActiveOverlayWindowMs: boundedCount(detail.activeOverlayWindowMs),
    detailTurnCount: boundedCount(detail.turnCount),
    detailResponseBudgetVersion: compactLabel(detail.responseBudgetVersion, 80),
    detailResponseBudgetApplied: detail.responseBudgetApplied === true,
    detailResponseBudgetProgressiveActiveApplied: detail.responseBudgetProgressiveActiveApplied === true,
    detailResponseBudgetProgressiveActiveReason: compactLabel(detail.responseBudgetProgressiveActiveReason, 100),
    detailResponseBudgetOriginalItemCount: boundedCount(detail.responseBudgetOriginalItemCount),
    detailResponseBudgetRetainedItemCount: boundedCount(detail.responseBudgetRetainedItemCount),
    detailResponseBudgetOmittedOperationItems: boundedCount(detail.responseBudgetOmittedOperationItems),
    detailResponseBudgetOmittedReasoningItems: boundedCount(detail.responseBudgetOmittedReasoningItems),
    detailResponseBudgetOmittedAssistantItems: boundedCount(detail.responseBudgetOmittedAssistantItems),
    detailResponseBudgetOmittedVisibleItems: boundedCount(detail.responseBudgetOmittedVisibleItems),
    detailResponseBudgetActiveTurnCount: boundedCount(detail.responseBudgetActiveTurnCount),
    detailResponseBudgetStaleActiveTurnCount: boundedCount(detail.responseBudgetStaleActiveTurnCount),
    detailResponseBudgetActiveOperationItems: boundedCount(detail.responseBudgetActiveOperationItems),
    detailResponseBudgetActiveReasoningItems: boundedCount(detail.responseBudgetActiveReasoningItems),
    detailResponseBudgetActiveAssistantItems: boundedCount(detail.responseBudgetActiveAssistantItems),
    detailResponseBudgetConfiguredActiveOperationItems: boundedCount(detail.responseBudgetConfiguredActiveOperationItems),
    detailResponseBudgetConfiguredActiveReasoningItems: boundedCount(detail.responseBudgetConfiguredActiveReasoningItems),
    detailResponseBudgetConfiguredActiveAssistantItems: boundedCount(detail.responseBudgetConfiguredActiveAssistantItems),
    detailResponseBudgetProgressiveActiveOriginalBytes: boundedBytes(detail.responseBudgetProgressiveActiveOriginalBytes),
    detailResponseBudgetProgressiveActiveTurnOriginalBytes: boundedBytes(detail.responseBudgetProgressiveActiveTurnOriginalBytes),
    detailResponseBudgetProgressiveActiveOriginalItemCount: boundedCount(detail.responseBudgetProgressiveActiveOriginalItemCount),
    detailResponseBudgetProgressiveActiveTurnOriginalItemCount: boundedCount(detail.responseBudgetProgressiveActiveTurnOriginalItemCount),
    detailResponseBudgetActiveProgressiveItemThreshold: boundedCount(detail.responseBudgetActiveProgressiveItemThreshold),
    detailResponseBudgetActiveProgressiveByteThreshold: boundedBytes(detail.responseBudgetActiveProgressiveByteThreshold),
    detailResponseBudgetActiveProgressiveThreadByteThreshold: boundedBytes(detail.responseBudgetActiveProgressiveThreadByteThreshold),
    detailResponseBudgetProgressiveActiveUserTextChars: boundedCount(detail.responseBudgetProgressiveActiveUserTextChars),
    detailResponseBudgetTruncatedActiveUserInputItems: boundedCount(detail.responseBudgetTruncatedActiveUserInputItems),
    detailResponseBudgetActiveUserInputOriginalChars: boundedCount(detail.responseBudgetActiveUserInputOriginalChars),
    detailResponseBudgetActiveUserInputRetainedChars: boundedCount(detail.responseBudgetActiveUserInputRetainedChars),
    detailResponseBudgetOmittedActiveUserInputChars: boundedCount(detail.responseBudgetOmittedActiveUserInputChars),
    detailResponseBudgetProgressiveCompletedUserTextChars: boundedCount(detail.responseBudgetProgressiveCompletedUserTextChars),
    detailResponseBudgetProgressiveCompletedUserInputBudgetApplied: detail.responseBudgetProgressiveCompletedUserInputBudgetApplied === true,
    detailResponseBudgetProgressiveCompletedUserInputBudgetReason: compactLabel(detail.responseBudgetProgressiveCompletedUserInputBudgetReason, 100),
    detailResponseBudgetProgressiveCompletedUserInputBudgetScope: compactLabel(detail.responseBudgetProgressiveCompletedUserInputBudgetScope, 80),
    detailResponseBudgetProgressiveCompletedUserInputBytesBeforeBudget: boundedBytes(detail.responseBudgetProgressiveCompletedUserInputBytesBeforeBudget),
    detailResponseBudgetProgressiveCompletedUserInputBytesAfterBudget: boundedBytes(detail.responseBudgetProgressiveCompletedUserInputBytesAfterBudget),
    detailResponseBudgetTruncatedCompletedUserInputItems: boundedCount(detail.responseBudgetTruncatedCompletedUserInputItems),
    detailResponseBudgetCompletedUserInputOriginalChars: boundedCount(detail.responseBudgetCompletedUserInputOriginalChars),
    detailResponseBudgetCompletedUserInputRetainedChars: boundedCount(detail.responseBudgetCompletedUserInputRetainedChars),
    detailResponseBudgetOmittedCompletedUserInputChars: boundedCount(detail.responseBudgetOmittedCompletedUserInputChars),
    detailResponseBudgetProgressiveCompletedUsageBudgetApplied: detail.responseBudgetProgressiveCompletedUsageBudgetApplied === true,
    detailResponseBudgetProgressiveCompletedUsageBudgetReason: compactLabel(detail.responseBudgetProgressiveCompletedUsageBudgetReason, 100),
    detailResponseBudgetProgressiveCompletedUsageBudgetScope: compactLabel(detail.responseBudgetProgressiveCompletedUsageBudgetScope, 80),
    detailResponseBudgetProgressiveCompletedUsageBytesBeforeBudget: boundedBytes(detail.responseBudgetProgressiveCompletedUsageBytesBeforeBudget),
    detailResponseBudgetProgressiveCompletedUsageBytesAfterBudget: boundedBytes(detail.responseBudgetProgressiveCompletedUsageBytesAfterBudget),
    detailResponseBudgetTruncatedCompletedUsageItems: boundedCount(detail.responseBudgetTruncatedCompletedUsageItems),
    detailResponseBudgetCompletedUsageOriginalBytes: boundedBytes(detail.responseBudgetCompletedUsageOriginalBytes),
    detailResponseBudgetCompletedUsageRetainedBytes: boundedBytes(detail.responseBudgetCompletedUsageRetainedBytes),
    detailResponseBudgetOmittedCompletedUsageBytes: boundedBytes(detail.responseBudgetOmittedCompletedUsageBytes),
    detailResponseBudgetProgressiveActiveTextChars: boundedCount(detail.responseBudgetProgressiveActiveTextChars),
    detailResponseBudgetTruncatedActiveTextItems: boundedCount(detail.responseBudgetTruncatedActiveTextItems),
    detailResponseBudgetActiveTextOriginalChars: boundedCount(detail.responseBudgetActiveTextOriginalChars),
    detailResponseBudgetActiveTextRetainedChars: boundedCount(detail.responseBudgetActiveTextRetainedChars),
    detailResponseBudgetOmittedActiveTextChars: boundedCount(detail.responseBudgetOmittedActiveTextChars),
    detailResponseBudgetProgressiveActiveOperationPayloadChars: boundedCount(detail.responseBudgetProgressiveActiveOperationPayloadChars),
    detailResponseBudgetTruncatedActiveOperationPayloadItems: boundedCount(detail.responseBudgetTruncatedActiveOperationPayloadItems),
    detailResponseBudgetActiveOperationPayloadOriginalChars: boundedCount(detail.responseBudgetActiveOperationPayloadOriginalChars),
    detailResponseBudgetActiveOperationPayloadRetainedChars: boundedCount(detail.responseBudgetActiveOperationPayloadRetainedChars),
    detailResponseBudgetOmittedActiveOperationPayloadChars: boundedCount(detail.responseBudgetOmittedActiveOperationPayloadChars),
    detailResponseBudgetProgressiveVisibleItemBudgetApplied: detail.responseBudgetProgressiveVisibleItemBudgetApplied === true,
    detailResponseBudgetProgressiveVisibleItemBudgetReason: compactLabel(detail.responseBudgetProgressiveVisibleItemBudgetReason, 100),
    detailResponseBudgetProgressiveVisibleItemCeiling: boundedCount(detail.responseBudgetProgressiveVisibleItemCeiling),
    detailResponseBudgetProgressiveVisibleItemOriginalCount: boundedCount(detail.responseBudgetProgressiveVisibleItemOriginalCount),
    detailResponseBudgetProgressiveVisibleItemRetainedCount: boundedCount(detail.responseBudgetProgressiveVisibleItemRetainedCount),
    detailResponseBudgetProgressiveActiveFirstPaintThreadByteCeiling: boundedBytes(detail.responseBudgetProgressiveActiveFirstPaintThreadByteCeiling),
    detailResponseBudgetProgressiveActiveFirstPaintItemBudgetApplied: detail.responseBudgetProgressiveActiveFirstPaintItemBudgetApplied === true,
    detailResponseBudgetProgressiveActiveFirstPaintItemBudgetReason: compactLabel(detail.responseBudgetProgressiveActiveFirstPaintItemBudgetReason, 100),
    detailResponseBudgetProgressiveActiveFirstPaintBytesBeforeItemBudget: boundedBytes(detail.responseBudgetProgressiveActiveFirstPaintBytesBeforeItemBudget),
    detailResponseBudgetProgressiveActiveFirstPaintBytesAfterItemBudget: boundedBytes(detail.responseBudgetProgressiveActiveFirstPaintBytesAfterItemBudget),
    detailResponseBudgetProgressiveActiveFirstPaintOmittedVisibleItems: boundedCount(detail.responseBudgetProgressiveActiveFirstPaintOmittedVisibleItems),
    detailResponseBudgetProgressiveActiveFirstPaintOverCeilingBytes: boundedBytes(detail.responseBudgetProgressiveActiveFirstPaintOverCeilingBytes),
    detailResponseBudgetRetainedVisibleItemCountByKind: boundedNumberMap(detail.responseBudgetRetainedVisibleItemCountByKind, 12, 100000),
    detailResponseBudgetRetainedVisibleItemBytesByKind: boundedNumberMap(detail.responseBudgetRetainedVisibleItemBytesByKind, 12),
    detailResponseBudgetRetainedVisibleItemCountForByteStats: boundedCount(detail.responseBudgetRetainedVisibleItemCountForByteStats),
    detailResponseBudgetRetainedVisibleItemBytesForByteStats: boundedBytes(detail.responseBudgetRetainedVisibleItemBytesForByteStats),
    detailResponseBudgetRetainedVisibleItemLargestKind: compactLabel(detail.responseBudgetRetainedVisibleItemLargestKind, 40),
    detailResponseBudgetRetainedVisibleItemLargestBytes: boundedBytes(detail.responseBudgetRetainedVisibleItemLargestBytes),
    detailResponseBudgetProgressiveCompletedTextBudgetApplied: detail.responseBudgetProgressiveCompletedTextBudgetApplied === true,
    detailResponseBudgetProgressiveCompletedTextBudgetReason: compactLabel(detail.responseBudgetProgressiveCompletedTextBudgetReason, 100),
    detailResponseBudgetProgressiveCompletedTextBudgetScope: compactLabel(detail.responseBudgetProgressiveCompletedTextBudgetScope, 80),
    detailResponseBudgetProgressiveCompletedTextBudgetProtectedLatestTurn: detail.responseBudgetProgressiveCompletedTextBudgetProtectedLatestTurn === true,
    detailResponseBudgetProgressiveCompletedTextBudgetSkippedLatestTurnCount: boundedCount(detail.responseBudgetProgressiveCompletedTextBudgetSkippedLatestTurnCount),
    detailResponseBudgetProgressiveCompletedTextChars: boundedCount(detail.responseBudgetProgressiveCompletedTextChars),
    detailResponseBudgetCompletedTextOriginalChars: boundedCount(detail.responseBudgetCompletedTextOriginalChars),
    detailResponseBudgetCompletedTextRetainedChars: boundedCount(detail.responseBudgetCompletedTextRetainedChars),
    detailResponseBudgetOmittedCompletedTextChars: boundedCount(detail.responseBudgetOmittedCompletedTextChars),
    detailResponseBudgetProgressiveFirstPaintThreadByteCeiling: boundedBytes(detail.responseBudgetProgressiveFirstPaintThreadByteCeiling),
    detailResponseBudgetProgressiveFirstPaintBytesBeforeTextBudget: boundedBytes(detail.responseBudgetProgressiveFirstPaintBytesBeforeTextBudget),
    detailResponseBudgetProgressiveFirstPaintBytesAfterTextBudget: boundedBytes(detail.responseBudgetProgressiveFirstPaintBytesAfterTextBudget),
  };
}

function checkFailureDecision(report = {}, options = {}) {
  const failure = compactLabel(report.failure, 80);
  if (!failure) return null;
  if (failure === "activeOverlay") {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "active-overlay",
      reason: "required-active-overlay-missing",
      nextAction: "repair-active-overlay-proof-gate",
    };
  }
  if (failure === "threadListColdPath" && options.allowMissingColdPath === true) return null;
  return {
    status: "blocked",
    priority: "H2",
    owner: "readback-contract",
    reason: `missing-${failure || "required-field"}`.slice(0, 100),
    nextAction: "repair-phase-b-readback-contract",
  };
}

function detailDecision(detail = {}) {
  const owner = lowerLabel(detail.coldPathOwner, 80);
  const reason = compactLabel(detail.coldPathReason, 80);
  const activeFullReadRequired = detail.activeFullReadRequired === true;
  const readMode = lowerLabel(detail.readMode, 100);
  const readDecision = lowerLabel(detail.readDecision, 100);
  const totalMs = boundedCount(detail.totalMs);
  const activeOverlayMs = boundedCount(detail.activeOverlayMs);

  if (!owner && !readMode && !readDecision) return null;
  if (totalMs >= 1000 || activeOverlayMs >= 800) {
    const activeOverlayDominates = activeOverlayMs >= 800 && activeOverlayMs >= Math.max(500, Math.trunc(totalMs * 0.5));
    const highLatency = totalMs >= 1500 || activeOverlayMs >= 1000;
    return {
      status: "needs_repair",
      priority: highLatency ? "H2" : "H3",
      owner: activeOverlayDominates ? "active-overlay-latency" : "thread-detail-latency",
      reason: activeOverlayDominates ? "active-overlay-latency" : "thread-detail-latency",
      nextAction: activeOverlayDominates ? "optimize-active-overlay-first-paint" : "split-thread-detail-latency",
    };
  }
  if (owner === "warm-path" || readMode === "projection-active-overlay" || readDecision === "projection-active-overlay") {
    return null;
  }
  if (activeFullReadRequired || owner === "active-read-policy") {
    const overlayReason = compactLabel(detail.activeOverlayGateReason || detail.activeOverlayReason || detail.projectionMissReason, 80);
    const overlayNextAction = compactLabel(detail.activeOverlayNextAction, 100);
    return {
      status: "needs_repair",
      priority: "H1",
      owner: "active-overlay",
      reason: overlayReason || reason || "active-full-read-required",
      nextAction: overlayNextAction || "complete-active-window-overlay-coverage",
    };
  }
  if (owner === "projection-cache") {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "projection-cache",
      reason: reason || "projection-cache-cold-path",
      nextAction: "repair-projection-cache-lifecycle",
    };
  }
  if (owner === "projection-input") {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "projection-input",
      reason: reason || "projection-input-unavailable",
      nextAction: "repair-projection-input-availability",
    };
  }
  if (owner === "summary") {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "summary-rollout-evidence",
      reason: reason || "summary-large-window",
      nextAction: "repair-summary-rollout-size-evidence",
    };
  }
  if (owner === "app-server-thread-read" || owner === "app-server-turns-list" || owner === "app-server-fallback") {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "app-server-detail-read",
      reason: reason || owner,
      nextAction: "reduce-app-server-detail-fallback",
    };
  }
  if (owner === "bounded-turns-list") {
    return {
      status: "observe",
      priority: "H3",
      owner: "bounded-turns-list",
      reason: reason || "bounded-current-window",
      nextAction: "observe-bounded-window-before-optimizing",
    };
  }
  return null;
}

function isWarmThreadList(list = {}) {
  const owner = lowerLabel(list.coldPathOwner, 80);
  const decision = lowerLabel(list.fallbackCacheDecision, 80);
  return owner === "warm-fallback-cache"
    || owner === "fallback-source-snapshot"
    || decision === "hit"
    || list.fallbackCacheHit === true
    || list.fallbackSourceSnapshotHit === true;
}

function fallbackBaselineReasonDecision(reason) {
  const normalizedReason = lowerLabel(reason, 80);
  const boundedReason = compactLabel(reason, 80) || "fallback-baseline-build";
  if (normalizedReason.includes("final-filter-empty") || normalizedReason.includes("final-filter")) {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "thread-list-final-filter",
      reason: boundedReason,
      nextAction: "optimize-thread-list-final-filter",
    };
  }
  if (normalizedReason.includes("merge-dedupe")) {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "thread-list-fallback-merge",
      reason: boundedReason,
      nextAction: "optimize-thread-list-fallback-merge",
    };
  }
  if (normalizedReason.includes("limit-drop")) {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "thread-list-limit-window",
      reason: boundedReason,
      nextAction: "review-thread-list-limit-window",
    };
  }
  return {
    status: "needs_repair",
    priority: "H2",
    owner: "thread-list-fallback-baseline",
    reason: boundedReason,
    nextAction: "optimize-thread-list-fallback-baseline",
  };
}

function appServerThreadListLatencyDecision(list = {}, report = {}) {
  const totalMs = boundedCount(list.appServerMs);
  if (totalMs < 1000) return null;

  const rpcMs = boundedCount(list.appServerRpcMs);
  const visibleFilterMs = boundedCount(list.appServerVisibleFilterMs);
  const workspaceFilterMs = boundedCount(list.appServerWorkspaceFilterMs);
  const postProcessMs = boundedCount(list.appServerPostProcessMs);
  const unattributedMs = boundedCount(list.appServerUnattributedMs);
  const splitKnown = rpcMs > 0 || visibleFilterMs > 0 || workspaceFilterMs > 0 || postProcessMs > 0 || unattributedMs > 0;
  const dominantFloorMs = Math.max(500, Math.trunc(totalMs * 0.6));

  if (rpcMs >= dominantFloorMs) {
    const muxMetrics = objectOrNull(report.muxMetrics);
    if (muxMetrics && muxMetrics.supported !== true) {
      return {
        status: "needs_repair",
        priority: "H2",
        owner: "shared-mux-runtime",
        reason: compactLabel(muxMetrics.reason, 80) || "mux-metrics-unsupported",
        nextAction: "restart-selected-shared-mux-before-rpc-repair",
      };
    }
    if (muxMetrics && muxMetrics.ok !== true) {
      return {
        status: "needs_repair",
        priority: "H2",
        owner: "shared-mux-metrics",
        reason: compactLabel(muxMetrics.reason, 80) || "mux-metrics-read-failed",
        nextAction: "repair-mux-metrics-readback",
      };
    }
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "app-server-thread-list-rpc",
      reason: "app-server-rpc-latency",
      nextAction: "investigate-app-server-thread-list-rpc",
    };
  }

  if (visibleFilterMs >= dominantFloorMs) {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "thread-list-visible-filter",
      reason: "visible-filter-latency",
      nextAction: "optimize-thread-list-visible-filter",
    };
  }

  if (workspaceFilterMs >= dominantFloorMs) {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "thread-list-workspace-filter",
      reason: "workspace-filter-latency",
      nextAction: "optimize-thread-list-workspace-filter",
    };
  }

  if (postProcessMs >= dominantFloorMs) {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "mobile-thread-list-postprocess",
      reason: "mobile-postprocess-latency",
      nextAction: "optimize-mobile-thread-list-postprocess",
    };
  }

  if (unattributedMs >= dominantFloorMs) {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "thread-list-app-server-attribution",
      reason: "app-server-unattributed-latency",
      nextAction: "split-thread-list-app-server-residual-timing",
    };
  }

  return {
    status: splitKnown ? "observe" : "needs_repair",
    priority: splitKnown ? "H3" : "H2",
    owner: "app-server-thread-list",
    reason: splitKnown ? "app-server-latency-split-inconclusive" : "app-server-latency-unsplit",
    nextAction: splitKnown ? "capture-next-app-server-list-latency-sample" : "instrument-app-server-thread-list-latency",
  };
}

function routeMergeLatencyDecision(list = {}) {
  const totalMs = boundedCount(list.totalMs);
  const mergeMs = boundedCount(list.mergeMs);
  if (!mergeMs) return null;
  const appServerMs = boundedCount(list.appServerMs);
  const dominantFloorMs = Math.max(500, Math.trunc(totalMs * 0.5));
  if (mergeMs < dominantFloorMs || mergeMs < appServerMs) return null;
  return {
    status: "needs_repair",
    priority: "H2",
    owner: "thread-list-route-merge",
    reason: compactLabel(list.summaryMergeDominantStage, 80)
      ? `route-merge-latency:${compactLabel(list.summaryMergeDominantStage, 80)}`.slice(0, 100)
      : "route-merge-latency",
    nextAction: "optimize-thread-list-route-merge",
  };
}

function threadListPrewarmDecision(list = {}, report = {}) {
  const publicConfig = objectOrNull(report.publicConfig) || {};
  const prewarm = objectOrNull(publicConfig.threadListFallbackPrewarm);
  if (!prewarm || prewarm.enabled !== true) return null;
  const settle = objectOrNull(report.threadListPrewarmSettle) || {};
  if (settle.attempted === true && settle.settled !== true) {
    return {
      status: "observe",
      priority: "H3",
      owner: "thread-list-fallback-prewarm",
      reason: compactLabel(settle.reason, 80) || "prewarm-settle-timeout",
      nextAction: "verify-startup-prewarm-timing",
    };
  }
  const lastStatus = lowerLabel(prewarm.lastStatus, 40);
  const lastErrorCode = compactLabel(prewarm.lastErrorCode, 80);
  if (lastStatus === "failed") {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "thread-list-fallback-prewarm",
      reason: lastErrorCode ? `prewarm-failed:${lastErrorCode}`.slice(0, 100) : "prewarm-failed",
      nextAction: "repair-thread-list-fallback-prewarm",
    };
  }
  if (prewarm.completed !== true) {
    let reason = "prewarm-not-completed";
    if (prewarm.scheduled === true) reason = "prewarm-scheduled";
    else if (prewarm.running === true) reason = "prewarm-running";
    else if (lastStatus === "deferred") reason = "prewarm-deferred";
    return {
      status: "observe",
      priority: "H3",
      owner: "thread-list-fallback-prewarm",
      reason,
      nextAction: "verify-startup-prewarm-timing",
    };
  }
  const listIsWarm = isWarmThreadList(list);
  if (!listIsWarm && prewarm.lastCacheHit !== true && prewarm.lastSourceSnapshotHit !== true) {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "thread-list-fallback-prewarm",
      reason: "prewarm-completed-but-list-cold",
      nextAction: "align-thread-list-prewarm-cache-key",
    };
  }
  return null;
}

function threadListDecision(list = {}, report = {}) {
  const owner = lowerLabel(list.coldPathOwner, 80);
  const reason = compactLabel(list.coldPathReason, 80);
  if (!owner || owner === "warm-fallback-cache" || owner === "fallback-source-snapshot") {
    return routeMergeLatencyDecision(list) || appServerThreadListLatencyDecision(list, report);
  }
  const prewarmDecision = threadListPrewarmDecision(list, report);
  if (prewarmDecision && prewarmDecision.status === "needs_repair") return prewarmDecision;
  if (owner === "fallback-baseline") {
    const warmCheck = objectOrNull(report.threadListWarmCheck);
    if (prewarmDecision) return prewarmDecision;
    if (warmCheck && isWarmThreadList(warmCheck)) {
      return {
        status: "observe",
        priority: "H3",
        owner: "thread-list-fallback-baseline",
        reason: "cold-start-rebuild-warmed",
        nextAction: "observe-cold-start-first-rebuild-cost",
      };
    }
    return fallbackBaselineReasonDecision(reason);
  }
  if (owner === "fallback-cache-policy") {
    const warmCheck = objectOrNull(report.threadListWarmCheck);
    if (prewarmDecision) return prewarmDecision;
    if (warmCheck && isWarmThreadList(warmCheck)) {
      return {
        status: "observe",
        priority: "H3",
        owner: "thread-list-cache-freshness",
        reason: "cold-start-rebuild-warmed",
        nextAction: "observe-cold-start-first-rebuild-cost",
      };
    }
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "thread-list-cache-freshness",
      reason: reason || "fallback-cache-policy",
      nextAction: "repair-thread-list-cache-freshness",
    };
  }
  if (owner === "app-server-thread-list") {
    return appServerThreadListLatencyDecision(list, report) || {
      status: "needs_repair",
      priority: "H2",
      owner: "app-server-thread-list",
      reason: reason || "app-server-thread-list",
      nextAction: "investigate-app-server-thread-list",
    };
  }
  if (owner === "deferred-fallback") {
    const afterDeferred = objectOrNull(report.threadListAfterDeferred);
    const warmCheck = objectOrNull(report.threadListWarmCheck);
    if (afterDeferred && isWarmThreadList(afterDeferred)) return null;
    if (warmCheck && isWarmThreadList(warmCheck)) {
      return {
        status: "observe",
        priority: "H3",
        owner: "thread-list-deferred-fallback",
        reason: "deferred-followup-warmed",
        nextAction: "observe-cold-start-first-rebuild-cost",
      };
    }
    if (afterDeferred) {
      const followupOwner = lowerLabel(afterDeferred.coldPathOwner, 80);
      const followupReason = compactLabel(afterDeferred.coldPathReason, 80);
      if (followupOwner === "deferred-fallback") {
        return {
          status: "observe",
          priority: "H3",
          owner: "thread-list-deferred-fallback",
          reason: followupReason || "deferred-followup-still-deferred",
          nextAction: "observe-active-detail-contention",
        };
      }
      if (followupOwner === "fallback-baseline" || followupOwner === "fallback-cache-policy") {
        if (followupOwner === "fallback-baseline") {
          return fallbackBaselineReasonDecision(followupReason || "deferred-followup-not-warm");
        }
        return {
          status: "needs_repair",
          priority: "H2",
          owner: "thread-list-deferred-fallback",
          reason: followupReason || "deferred-followup-not-warm",
          nextAction: "verify-deferred-fallback-warm-cache",
        };
      }
    }
    return {
      status: "observe",
      priority: "H3",
      owner: "thread-list-deferred-fallback",
      reason: reason || "deferred-fallback",
      nextAction: "observe-deferred-fallback-before-optimizing",
    };
  }
  return null;
}

function classifyPhaseBReadback(report = {}, options = {}) {
  const failure = checkFailureDecision(report, options);
  const detail = objectOrNull(report.detail) || {};
  const list = objectOrNull(report.threadList) || {};
  const decision = failure || detailDecision(detail) || threadListDecision(list, report) || {
    status: "ready",
    priority: "H3",
    owner: "phase-b-readback",
    reason: "warm-or-bounded-paths",
    nextAction: "proceed-to-next-phase-b-root-cause-target",
  };
  return Object.assign({}, decision, {
    evidence: buildEvidence(report),
  });
}

module.exports = {
  classifyPhaseBReadback,
};
