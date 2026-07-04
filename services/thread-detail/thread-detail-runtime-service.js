"use strict";

const {
  attachTurnUsageSummaries,
  collectTurnUsageSummariesFromEntries,
  collectTurnUsageSummariesFromRolloutText,
} = require("../../adapters/turn-usage-summary-service");
const { createRolloutEnrichmentIndexService } = require("../../adapters/rollout-enrichment-index-service");
const { createThreadDetailProjectionInputService } = require("../../adapters/thread-detail-projection-input-service");
const { createThreadDetailProjectionResultService } = require("../../adapters/thread-detail-projection-result-service");
const { createThreadDetailProjectionService } = require("../../adapters/thread-detail-projection-service");
const { createThreadDetailProjectionV4Service } = require("../../adapters/thread-detail-projection-v4-service");
const {
  appendLatestCompletedUserInputAnchors,
  collectRolloutUserInputAnchors,
} = require("../../adapters/thread-detail-user-input-anchor-service");
const { createThreadDetailSummaryService } = require("../../adapters/thread-detail-summary-service");
const { createThreadDetailCompactionService } = require("../../adapters/thread-detail-compaction-service");
const { createRolloutDetailEnrichmentService } = require("../../adapters/rollout-detail-enrichment-service");
const { createThreadDetailRolloutBackfillService } = require("../../adapters/thread-detail-rollout-backfill-service");
const { createThreadCompletionDiagnosticService } = require("../../adapters/thread-completion-diagnostic-service");
const { attachThreadDetailDiagnostics } = require("../../adapters/thread-detail-performance-service");
const { compactThreadDetailResponseResult } = require("./thread-detail-response-budget-service");
const { createThreadDetailResponsePreparationService } = require("./thread-detail-response-preparation-service");
const { createThreadDetailActiveTurnEvidenceService } = require("./thread-detail-active-turn-evidence-service");
const { createThreadDetailBoundedReadPolicyService } = require("./thread-detail-bounded-read-policy-service");
const { createThreadDetailActiveOverlayProviderService } = require("./thread-detail-active-overlay-provider-service");
const { createThreadDetailActiveWindowPrewarmService } = require("./thread-detail-active-window-prewarm-service");
const { createThreadDetailFirstPaintPrewarmService } = require("./thread-detail-first-paint-prewarm-service");
const { createThreadDetailTurnsListReadCoalescer } = require("./thread-detail-turns-list-read-coalescer-service");
const { createThreadDetailReadOrchestrationService } = require("./thread-detail-read-orchestration-service");

function createThreadDetailRuntimeService(dependencies = {}) {
  const fs = dependencies.fs;
  const path = dependencies.path;
  const crypto = dependencies.crypto;
  const config = Object.assign({}, dependencies.config || {});
  const threadDisplaySummaryCache = dependencies.threadDisplaySummaryCache;

  let threadDetailResponsePreparationService = null;
  let appendRolloutToolOutputImagesToThread;
  let insertProjectedItemByTimestamp;
  let itemTimestampCandidateId;
  let itemTimestampMatchText;
  let readRolloutEnrichmentEntries;
  let readRolloutEnrichmentText;
  let readRolloutItemTimestampCandidates;
  let readRolloutRuntimeScanText;
  let readRolloutTail;
  let readRolloutToolOutputImageItems;
  let readRolloutTurnUsageSummaries;
  let rolloutEntryTurnId;
  let rolloutTimestampFields;
  let timestampTextsMatch;
  let visibleItemId;
  let appendMissingRolloutCompletionTurnsToThread;
  let appendRolloutActiveAssistantItemsToDetailResult;
  let appendRolloutEmptyCompletionDiagnosticsToThread;
  let appendRolloutFinalReceiptsToThread;
  let appendRolloutUserInputAnchorsToDetailResult;
  let backfillMissingRolloutCompletionTurnsForDetailResult;
  let dedupeSyntheticActiveAssistantMessagesInThread;
  let enrichThreadItemTimestampsFromRollout;
  let finalizeActiveAssistantProjectionDetailResult;
  let inferTurnItemDisplayTimestamps;
  let itemDisplayTimestampMs;
  let orderTurnItemsByDisplayTimestamp;
  let turnCompletionUsageSummary;

  function requireResponsePreparationService() {
    if (!threadDetailResponsePreparationService) {
      throw new Error("thread_detail_response_preparation_service_uninitialized");
    }
    return threadDetailResponsePreparationService;
  }

  const threadDetailProjectionService = config.threadDetailProjectionV4Enabled
    ? createThreadDetailProjectionV4Service({
      cacheDir: config.threadDetailProjectionCacheDir,
      policyVersion: "state-relevant-receipt-v4",
      maxTurns: config.maxFullThreadTurns,
    })
    : createThreadDetailProjectionService({
      cacheDir: config.threadDetailProjectionCacheDir,
      policyVersion: config.threadDetailProjectionPolicyVersion,
      maxTurns: config.maxFullThreadTurns,
    });

  const rolloutEnrichmentIndexService = createRolloutEnrichmentIndexService({
    maxIndexes: config.runtimeContextCacheMax,
  });

  const threadDetailActiveTurnEvidenceService = createThreadDetailActiveTurnEvidenceService({
    fs,
    statusText: dependencies.statusText,
    timestampToMs: dependencies.timestampToMs,
    rolloutActiveStatusWindowMs: config.rolloutActiveStatusWindowMs,
    rolloutPathForThread: dependencies.rolloutPathForThread,
    readStateDbThread: dependencies.readStateDbThread,
    rolloutLatestTurnEvidence: dependencies.rolloutLatestTurnEvidence,
    isThreadListLiveStatus: dependencies.isThreadListLiveStatus,
    isThreadListRestStatus: dependencies.isThreadListRestStatus,
    isEndedTurn: (...args) => isEndedTurn(...args),
    isUserQuestionItem: (...args) => isUserQuestionItem(...args),
    userMessageHasVisualAttachment: (...args) => userMessageHasVisualAttachment(...args),
    isTurnUsageSummaryItem: (...args) => isTurnUsageSummaryItem(...args),
    isOperationalItem: (...args) => isOperationalItem(...args),
    isAssistantReceiptItem: (...args) => isAssistantReceiptItem(...args),
    isVisualReceiptItem: (...args) => isVisualReceiptItem(...args),
    isTurnDiagnosticItem: (...args) => isTurnDiagnosticItem(...args),
    isContextCompactionType: (...args) => isContextCompactionType(...args),
  });
  const {
    isCompletedStatus,
    isLiveTurn,
    normalizeSupersededLiveTurns,
    pruneSupersededLiveShellTurns,
    reconcileThreadActiveTurnWithRolloutEvidence,
    rolloutEvidenceHasRuntimeActivity,
    rolloutEvidenceIsRecent,
    turnIdentifier,
    turnStartedAtMs,
  } = threadDetailActiveTurnEvidenceService;

  const threadDetailCompactionService = createThreadDetailCompactionService({
    fs,
    path,
    operationalItemTypes: config.operationalItemTypes,
    maxTextChars: config.maxTextChars,
    maxCommandOutputChars: config.maxCommandOutputChars,
    maxCommandOutputCharsPerTurn: config.maxCommandOutputCharsPerTurn,
    maxLiveOperationItems: config.maxLiveOperationItems,
    maxThreadTurns: config.maxThreadTurns,
    pendingSteerEchoStore: dependencies.pendingSteerEchoStore,
    statusText: dependencies.statusText,
    isCompletedStatus,
    isLiveTurn,
    truncateMiddle: dependencies.truncateMiddle,
    truncateTail: dependencies.truncateTail,
    compactStringArray: dependencies.compactStringArray,
    compactStructured: dependencies.compactStructured,
    attachGeneratedImageContent: dependencies.attachGeneratedImageContent,
    isCodexMobileUploadFilePath: dependencies.isCodexMobileUploadFilePath,
    normalizeFsPath: dependencies.normalizeFsPath,
    imageViewSourcePath: dependencies.imageViewSourcePath,
    parseJsonLine: dependencies.parseJsonLine,
    rolloutPathForThread: dependencies.rolloutPathForThread,
    rolloutStatsForPath: dependencies.rolloutStatsForPath,
    reconcileThreadActiveTurnWithRolloutEvidence,
    normalizeSupersededLiveTurns,
    pruneSupersededLiveShellTurns,
    workspaceContextStatsForCwd: dependencies.workspaceContextStatsForCwd,
    dedupeUserMessageEchoesInThread: dependencies.dedupeUserMessageEchoesInThread,
    normalizeStaleContextOnlyActiveThread: dependencies.normalizeStaleContextOnlyActiveThread,
    annotateThreadRolloutStats: dependencies.annotateThreadRolloutStats,
    readRolloutTail: (...args) => readRolloutTail(...args),
    readRolloutToolOutputImageItems: (...args) => readRolloutToolOutputImageItems(...args),
    readRolloutTurnUsageSummaries: (...args) => readRolloutTurnUsageSummaries(...args),
    rolloutEntryTurnId: (...args) => rolloutEntryTurnId(...args),
    rolloutTimestampFields: (...args) => rolloutTimestampFields(...args),
    appendRolloutToolOutputImagesToThread: (...args) => appendRolloutToolOutputImagesToThread(...args),
    appendMissingRolloutCompletionTurnsToThread: (...args) => appendMissingRolloutCompletionTurnsToThread(...args),
    appendRolloutFinalReceiptsToThread: (...args) => appendRolloutFinalReceiptsToThread(...args),
    appendRolloutEmptyCompletionDiagnosticsToThread: (...args) => appendRolloutEmptyCompletionDiagnosticsToThread(...args),
    enrichThreadItemTimestampsFromRollout: (...args) => enrichThreadItemTimestampsFromRollout(...args),
    inferTurnItemDisplayTimestamps: (...args) => inferTurnItemDisplayTimestamps(...args),
    orderTurnItemsByDisplayTimestamp: (...args) => orderTurnItemsByDisplayTimestamp(...args),
    attachTurnUsageSummaries,
  });
  const {
    compactItem,
    compactThread,
    compactThreadReadResult,
    compactTurn,
    compactTurnsListResult,
    isAssistantReceiptItem,
    isContextCompactionType,
    isEndedTurn,
    isOperationalItem,
    isTurnDiagnosticItem,
    isTurnUsageSummaryItem,
    isUserQuestionItem,
    isVisualReceiptItem,
    isWebSearchLikeItem,
    olderTurnsCursorBeforeTurn,
    userMessageHasVisualAttachment,
  } = threadDetailCompactionService;

  const rolloutDetailEnrichmentService = createRolloutDetailEnrichmentService({
    fs,
    path,
    crypto,
    rolloutEnrichmentIndexService,
    normalizeFsPath: dependencies.normalizeFsPath,
    timestampToMs: dependencies.timestampToMs,
    isContextCompactionType,
    isWebSearchLikeItem,
    isOperationalItem,
    collectTurnUsageSummariesFromEntries,
    collectTurnUsageSummariesFromRolloutText,
    attachGeneratedImageContent: dependencies.attachGeneratedImageContent,
    isPathInside: dependencies.isPathInside,
    uploadRoot: dependencies.uploadRoot,
    maxRolloutContextBytes: config.maxRolloutContextBytes,
    maxRuntimeContextScanBytes: config.maxRuntimeContextScanBytes,
    maxRolloutEnrichmentContextBytes: config.maxRolloutEnrichmentContextBytes,
    runtimeContextCacheTtlMs: config.runtimeContextCacheTtlMs,
    runtimeContextCacheMax: config.runtimeContextCacheMax,
  });
  ({
    appendRolloutToolOutputImagesToThread,
    insertProjectedItemByTimestamp,
    itemTimestampCandidateId,
    itemTimestampMatchText,
    readRolloutEnrichmentEntries,
    readRolloutEnrichmentText,
    readRolloutItemTimestampCandidates,
    readRolloutRuntimeScanText,
    readRolloutTail,
    readRolloutToolOutputImageItems,
    readRolloutTurnUsageSummaries,
    rolloutEntryTurnId,
    rolloutTimestampFields,
    timestampTextsMatch,
    visibleItemId,
  } = rolloutDetailEnrichmentService);

  const threadDetailRolloutBackfillService = createThreadDetailRolloutBackfillService({
    fs,
    runtimeContextCacheTtlMs: config.runtimeContextCacheTtlMs,
    runtimeContextCacheMax: config.runtimeContextCacheMax,
    threadDetailCompletedProgressMessages: config.threadDetailCompletedProgressMessages,
    threadDetailProgressiveActiveUserTextChars: config.threadDetailProgressiveActiveUserTextChars,
    maxThreadTurns: config.maxThreadTurns,
    normalizeFsPath: dependencies.normalizeFsPath,
    statusText: dependencies.statusText,
    timestampToMs: dependencies.timestampToMs,
    stableTextHash: dependencies.stableTextHash,
    finalReceiptTextFromParams: dependencies.finalReceiptTextFromParams,
    readRolloutEnrichmentEntries,
    rolloutEntryTurnId,
    rolloutTimestampFields,
    rolloutPathForThread: dependencies.rolloutPathForThread,
    readRolloutTurnUsageSummaries,
    readRolloutItemTimestampCandidates,
    rolloutStatsForPath: dependencies.rolloutStatsForPath,
    readStateDbThread: dependencies.readStateDbThread,
    readStartedThread: dependencies.readStartedThread,
    clonePlainJson: dependencies.clonePlainJson,
    cloneThreadForUsageDecoration,
    collectRolloutUserInputAnchors,
    appendLatestCompletedUserInputAnchors,
    compactThread,
    sortTurnsChronologically,
    insertProjectedItemByTimestamp,
    visibleItemId,
    itemTimestampCandidateId,
    itemTimestampMatchText,
    timestampTextsMatch,
    isAssistantReceiptItem,
    isTurnDiagnosticItem,
    isCompletedStatus,
    isLiveTurn,
    isThreadListRestStatus: dependencies.isThreadListRestStatus,
    isThreadListLiveStatus: dependencies.isThreadListLiveStatus,
    turnIdentifier,
    turnSortTimestampMs,
    turnStartedAtMs,
    redactInlineImageDataUrls: dependencies.redactInlineImageDataUrls,
    isContextCompactionType,
    isWebSearchLikeItem,
    isOperationalItem,
    createThreadCompletionDiagnosticService,
  });
  ({
    appendMissingRolloutCompletionTurnsToThread,
    appendRolloutActiveAssistantItemsToDetailResult,
    appendRolloutEmptyCompletionDiagnosticsToThread,
    appendRolloutFinalReceiptsToThread,
    appendRolloutUserInputAnchorsToDetailResult,
    backfillMissingRolloutCompletionTurnsForDetailResult,
    dedupeSyntheticActiveAssistantMessagesInThread,
    enrichThreadItemTimestampsFromRollout,
    finalizeActiveAssistantProjectionDetailResult,
    inferTurnItemDisplayTimestamps,
    itemDisplayTimestampMs,
    orderTurnItemsByDisplayTimestamp,
    turnCompletionUsageSummary,
  } = threadDetailRolloutBackfillService);

  function sortTurnsChronologically(turns) {
    return (turns || []).slice().sort((a, b) => {
      const left = turnSortTimestampMs(a);
      const right = turnSortTimestampMs(b);
      if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right;
      if (Number.isFinite(left) && !Number.isFinite(right) && isRolloutFallbackTurnId(b)) return 1;
      if (!Number.isFinite(left) && Number.isFinite(right) && isRolloutFallbackTurnId(a)) return -1;
      return String(a && a.id || "").localeCompare(String(b && b.id || ""));
    });
  }

  function isRolloutFallbackTurnId(turn) {
    return /^rollout-\d+$/i.test(String(turn && (turn.id || turn.turnId) || ""));
  }

  function turnSortTimestampMs(turn) {
    for (const key of [
      "startedAtMs",
      "startedAt",
      "started_at_ms",
      "started_at",
      "createdAtMs",
      "createdAt",
      "created_at_ms",
      "created_at",
      "completedAtMs",
      "completedAt",
      "completed_at_ms",
      "completed_at",
      "updatedAtMs",
      "updatedAt",
      "updated_at_ms",
      "updated_at",
    ]) {
      const timestamp = dependencies.timestampToMs(turn && turn[key]);
      if (timestamp) return timestamp;
    }
    const itemTimestamps = (turn && turn.items || [])
      .map(itemDisplayTimestampMs)
      .filter(Boolean);
    if (itemTimestamps.length) return Math.min(...itemTimestamps);
    return isLiveTurn(turn) ? Number.MAX_SAFE_INTEGER : NaN;
  }

  const threadDetailProjectionInputService = createThreadDetailProjectionInputService({
    maxTurns: config.maxFullThreadTurns,
    rolloutStatsForPath: dependencies.rolloutStatsForPath,
    statusText: dependencies.statusText,
    timestampToMs: dependencies.timestampToMs,
  });
  const threadDetailProjectionResultService = createThreadDetailProjectionResultService({
    maxTurns: config.maxFullThreadTurns,
    compactThreadReadResult,
    decorateThreadReadResult: attachRolloutUsageSummariesToDetailResult,
    mergeThreadDisplaySummary: dependencies.mergeThreadDisplaySummary,
    applySessionIndexTitleToThread: dependencies.applySessionIndexTitleToThread,
    readSessionIndexEntries: dependencies.readSessionIndexEntries,
    mergeThreadRuntimeFromStateDb: dependencies.mergeThreadRuntimeFromStateDb,
    normalizeThreadSummaryLiveStatus: dependencies.normalizeThreadSummaryLiveStatus,
    publicRuntimeSettings: dependencies.publicRuntimeSettings,
  });
  const threadDetailSummaryService = createThreadDetailSummaryService({
    readStateDbThread: dependencies.readStateDbThread,
    readStartedThread: dependencies.readStartedThread,
    readRolloutSessionFallbackThread: dependencies.readRolloutSessionFallbackThread,
    readDisplaySummaryThread: (threadId) => threadDisplaySummaryCache.read(threadId),
    readThreadSummaryFromAppServer: dependencies.readThreadSummaryFromAppServer,
    mergeThreadDisplaySummary: dependencies.mergeThreadDisplaySummary,
    applyLocalActiveThreadStatusToSummary: dependencies.applyLocalActiveThreadStatusToSummary,
    threadRolloutSizeBytes,
    appServerRefreshTtlMs: config.threadDetailSummaryAppServerRefreshTtlMs,
    skipAppServerRefreshWhenDisplayCachePresent: true,
  });
  const threadDetailBoundedReadPolicyService = createThreadDetailBoundedReadPolicyService({
    thresholdBytes: config.threadDetailTurnsListFirstBytes,
    threadRolloutSizeBytes,
  });
  const threadDetailActiveOverlayProviderService = createThreadDetailActiveOverlayProviderService({
    projectionService: threadDetailProjectionService,
  });
  const threadDetailTurnsListReadCoalescer = createThreadDetailTurnsListReadCoalescer({
    maxInFlightMs: config.threadDetailRpcTimeoutMs,
  });
  const threadDetailActiveWindowPrewarmService = createThreadDetailActiveWindowPrewarmService({
    resolveSummary: (requestCodex, threadId, options) => threadDetailSummaryService.resolveSummary(requestCodex, threadId, options),
    threadRuntimeSettings: dependencies.threadRuntimeSettings,
    projectionInput: threadDetailProjectionInput,
    activeOverlayProjectionWindowLookup,
    resolveActiveWindowOverlay: (input) => threadDetailActiveOverlayProviderService.resolveActiveWindowOverlay(input),
    turnsListThreadReadResult: (input) => threadDetailTurnsListReadCoalescer.read(input, ({
      threadId,
      summary,
      runtimeSettings,
      warning,
      mode,
      threadLog,
      responseBudgetEvidence,
    }) => turnsListThreadReadResult(
      threadId,
      summary,
      runtimeSettings,
      warning,
      mode,
      threadLog,
      responseBudgetEvidence,
    )),
    seedProjection: (input, result, optionsForSeed = {}) => threadDetailProjectionService.seed(input, result, optionsForSeed),
    log: (event, details) => dependencies.logThreadDetail(event, details),
  });
  const threadDetailReadOrchestrationService = createThreadDetailReadOrchestrationService({
    attachDiagnostics: attachThreadDetailDiagnostics,
    resolveSummary: (requestCodex, threadId, options) => threadDetailSummaryService.resolveSummary(requestCodex, threadId, options),
    resolveVisibility: () => dependencies.visibilityFromGlobalState(dependencies.readGlobalState()),
    threadRuntimeSettings: dependencies.threadRuntimeSettings,
    isHiddenThread: dependencies.isHiddenThread,
    rawAllEnabled: () => config.threadDetailRawAllEnabled,
    readRawThread: readRawThreadDetailForOrchestrator,
    projectionInput: threadDetailProjectionInput,
    projectedThreadLookup,
    activeOverlayProjectionWindowLookup,
    projectedThreadResult: (input, summary, runtimeSettings, optionsForProjection = {}) => prepareProjectedThreadReadResult(
      threadDetailProjectionService.get(input, optionsForProjection),
      summary,
      runtimeSettings,
      optionsForProjection,
    ),
    resolveActiveWindowOverlay: (input) => threadDetailActiveOverlayProviderService.resolveActiveWindowOverlay(input),
    rememberThreadSummary: (thread) => threadDisplaySummaryCache.remember(thread),
    turnsListThreadReadResult: (input) => threadDetailTurnsListReadCoalescer.read(input, ({
      threadId,
      summary,
      runtimeSettings,
      warning,
      mode,
      threadLog,
    }) => turnsListThreadReadResult(
      threadId,
      summary,
      runtimeSettings,
      warning,
      mode,
      threadLog,
    )),
    readFullThread: readFullThreadDetailForOrchestrator,
    seedProjection: (input, result, optionsForSeed = {}) => threadDetailProjectionService.seed(input, result, optionsForSeed),
    scheduleProjectionRefresh: scheduleRecentWindowProjectionRefresh,
    preferBoundedReadBeforeFullRead: (input) => threadDetailBoundedReadPolicyService.preferBoundedReadBeforeFullRead(input),
    prepareResponse: prepareThreadDetailResponseResult,
    compactActiveOverlayTurn: (turn, details = {}) => compactTurn(turn, {
      allowOperations: true,
      maxOperationItems: config.maxLiveOperationItems,
      threadId: details.threadId || "",
    }),
    fallbackThreadReadResult: fallbackThreadReadResultForOrchestrator,
    isReadTimeoutError,
    isUnmaterializedThreadError: dependencies.isUnmaterializedThreadError,
    threadRolloutSizeBytes,
    readTimeoutMs: config.readRpcTimeoutMs,
    threadDetailRpcTimeoutMs: config.threadDetailRpcTimeoutMs,
    maxThreadTurns: config.maxThreadTurns,
    maxFullThreadTurns: config.maxFullThreadTurns,
  });
  const threadDetailFirstPaintPrewarmService = createThreadDetailFirstPaintPrewarmService({
    enabled: config.threadDetailFirstPaintPrewarmEnabled !== false,
    delayMs: config.threadDetailFirstPaintPrewarmDelayMs,
    minIntervalMs: config.threadDetailFirstPaintPrewarmMinIntervalMs,
    minRolloutBytes: config.threadDetailFirstPaintPrewarmMinBytes,
    maxPending: config.threadDetailFirstPaintPrewarmMaxPending,
    resolveSummary: (requestCodex, threadId, options) => threadDetailSummaryService.resolveSummary(requestCodex, threadId, options),
    readThreadDetail: (input) => threadDetailReadOrchestrationService.readThreadDetail(input),
    log: (event, details) => dependencies.logThreadDetail(event, details),
  });

  function threadDetailProjectionInput(threadId, summary) {
    return threadDetailProjectionInputService.projectionInput(threadId, summary);
  }

  function prepareProjectedThreadReadResult(cached, summary, runtimeSettings, options = {}) {
    return threadDetailProjectionResultService.prepareProjectedThreadReadResult(cached, summary, runtimeSettings, options);
  }

  function scheduleRecentWindowProjectionRefresh(input = {}) {
    return threadDetailActiveWindowPrewarmService.schedule(input);
  }

  function projectedThreadLookup(input, summary, runtimeSettings, optionsForProjection = {}) {
    const lookedUp = typeof threadDetailProjectionService.lookup === "function"
      ? threadDetailProjectionService.lookup(input, optionsForProjection)
      : { cached: threadDetailProjectionService.get(input, optionsForProjection), missReason: "" };
    return {
      result: prepareProjectedThreadReadResult(
        lookedUp && lookedUp.cached,
        summary,
        runtimeSettings,
        optionsForProjection,
      ),
      missReason: lookedUp && lookedUp.missReason || "",
    };
  }

  function activeOverlayProjectionWindowLookup(input, summary, runtimeSettings, optionsForProjection = {}) {
    const lookedUp = typeof threadDetailProjectionService.lookup === "function"
      ? threadDetailProjectionService.lookup(input, Object.assign({}, optionsForProjection, { skipNormalizeResult: true }))
      : { cached: threadDetailProjectionService.get(input, optionsForProjection), missReason: "" };
    const cached = lookedUp && lookedUp.cached || null;
    let result = cached && cached.result || null;
    if (result && result.thread) {
      const projectionVersion = String(cached.version || result.thread.mobileProjectionVersion || "");
      const thread = Object.assign({}, result.thread);
      thread.mobileReadMode = cached.partial
        ? (projectionVersion === "v4" ? "projection-v4-partial" : "projection-partial")
        : cached.dynamic
          ? (projectionVersion === "v4" ? "projection-v4-dynamic" : "projection-dynamic")
          : (projectionVersion === "v4" ? "projection-v4-cache" : "projection-cache");
      thread.mobileProjection = Object.assign({}, thread.mobileProjection || {}, {
        source: cached.partial ? "partial" : cached.dynamic ? "dynamic" : "cache",
        version: projectionVersion || result.thread.mobileProjectionVersion || "",
        partial: cached.partial === true,
        partialKind: cached.partialKind || "",
        cachedAtMs: cached.cachedAtMs || null,
        updatedAtMs: cached.updatedAtMs || cached.cachedAtMs || null,
        ageMs: cached.updatedAtMs ? Math.max(0, Date.now() - cached.updatedAtMs) : null,
      });
      if (cached.stalePartial === true) {
        thread.mobileProjection.stalePartial = true;
        thread.mobileProjection.staleReason = cached.staleReason || "";
      }
      result = Object.assign({}, result, { thread });
    }
    return {
      result,
      missReason: lookedUp && lookedUp.missReason || "",
      stalePartial: cached && cached.stalePartial === true,
      staleReason: cached && cached.staleReason || "",
    };
  }

  function finalizeThreadDetailProjectionResult(result, details = {}) {
    if (config.threadDetailRawAllEnabled) return result;
    if (!result || !result.thread || !threadDetailProjectionService
      || typeof threadDetailProjectionService.normalizeResult !== "function") return result;
    return threadDetailProjectionService.normalizeResult(result, {
      threadId: result.thread.id || details.threadId || "",
      source: details.source || result.thread.mobileReadMode || "thread-detail",
    });
  }

  function createResponsePreparationService(options = {}) {
    threadDetailResponsePreparationService = createThreadDetailResponsePreparationService({
      codex: options.codex,
      maxThreadTurns: config.maxThreadTurns,
      maxFullThreadTurns: config.maxFullThreadTurns,
      readRpcTimeoutMs: config.readRpcTimeoutMs,
      threadDetailRpcTimeoutMs: config.threadDetailRpcTimeoutMs,
      responseBudgetOptions: options.responseBudgetOptions,
      compactThreadReadResult,
      compactTurnsListResult,
      compactThreadDetailResponseResult,
      compactTurn,
      enrichThreadItemTimestampsFromRollout,
      sortTurnsChronologically,
      isLiveTurn,
      normalizeThreadSummaryLiveStatus: dependencies.normalizeThreadSummaryLiveStatus,
      annotateThreadRolloutStats: dependencies.annotateThreadRolloutStats,
      publicRuntimeSettings: dependencies.publicRuntimeSettings,
      rolloutPathForThread: dependencies.rolloutPathForThread,
      rolloutStatsForPath: dependencies.rolloutStatsForPath,
      readRolloutTurnUsageSummaries,
      attachTurnUsageSummaries,
      workspaceContextStatsForCwd: dependencies.workspaceContextStatsForCwd,
      backfillMissingRolloutCompletionTurnsForDetailResult,
      appendRolloutUserInputAnchorsToDetailResult,
      appendRolloutActiveAssistantItemsToDetailResult,
      finalizeActiveAssistantProjectionDetailResult,
      applyLocalActiveThreadStatusToResult: options.applyLocalActiveThreadStatusToResult,
      prepareThreadTaskCardsToResult: options.prepareThreadTaskCardsToResult,
      finalizeThreadDetailProjectionResult,
      applySessionIndexTitleToThread: dependencies.applySessionIndexTitleToThread,
      readSessionIndexEntries: dependencies.readSessionIndexEntries,
      threadDisplaySummaryCache,
      mergeThreadRuntimeFromStateDb: dependencies.mergeThreadRuntimeFromStateDb,
      appendRolloutFinalReceiptsToThread,
      attachPendingServerRequestsToResult: options.attachPendingServerRequestsToResult,
      attachThreadTaskCardsToResult: options.attachThreadTaskCardsToResult,
    });
    return threadDetailResponsePreparationService;
  }

  function threadFromTurnsList(threadId, summary, turnsResult) {
    return requireResponsePreparationService().threadFromTurnsList(threadId, summary, turnsResult);
  }

  function parseThreadTurnsCursor(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "object") return JSON.stringify(value);
    const text = String(value || "").trim();
    if (!text) return null;
    if (/^"/.test(text)) {
      try {
        const parsed = JSON.parse(text);
        return typeof parsed === "string" ? parsed : JSON.stringify(parsed);
      } catch (_) {
        return text;
      }
    }
    return text;
  }

  function isReadTimeoutError(err) {
    return Boolean(err && (err.code === "RPC_TIMEOUT" || /timed out|connection is not open|connection closed/i.test(err.message || "")));
  }

  function threadRolloutSizeBytes(thread) {
    return requireResponsePreparationService().threadRolloutSizeBytes(thread);
  }

  function fallbackThreadReadResult(threadId, summary, runtimeSettings, warning, mode = "summary-fallback") {
    return requireResponsePreparationService().fallbackThreadReadResult(threadId, summary, runtimeSettings, warning, mode);
  }

  function hasTurnUsageSummaryPayload(summaries) {
    return requireResponsePreparationService().hasTurnUsageSummaryPayload(summaries);
  }

  function cloneThreadForUsageDecoration(thread) {
    const service = threadDetailResponsePreparationService;
    if (service && typeof service.cloneThreadForUsageDecoration === "function") {
      return service.cloneThreadForUsageDecoration(thread);
    }
    return Object.assign({}, thread, {
      turns: (Array.isArray(thread && thread.turns) ? thread.turns : []).map((turn) => {
        if (!turn || typeof turn !== "object") return turn;
        return Object.assign({}, turn, {
          items: Array.isArray(turn.items) ? turn.items.slice() : turn.items,
        });
      }),
    });
  }

  function attachRolloutUsageSummariesToDetailResult(result) {
    return requireResponsePreparationService().attachRolloutUsageSummariesToDetailResult(result);
  }

  async function prepareThreadDetailResponseResult(result, details = {}) {
    return requireResponsePreparationService().prepareThreadDetailResponseResult(result, details);
  }

  async function turnsListThreadReadResult(threadId, summary, runtimeSettings, warning, mode = "turns-list", threadLog = null, responseBudgetEvidence = "") {
    return requireResponsePreparationService().turnsListThreadReadResult(threadId, summary, runtimeSettings, warning, mode, threadLog, responseBudgetEvidence);
  }

  async function readRawThreadDetailForOrchestrator(input) {
    return requireResponsePreparationService().readRawThreadDetailForOrchestrator(input);
  }

  async function readFullThreadDetailForOrchestrator(input) {
    return requireResponsePreparationService().readFullThreadDetailForOrchestrator(input);
  }

  function fallbackThreadReadResultForOrchestrator(input) {
    return requireResponsePreparationService().fallbackThreadReadResultForOrchestrator(input);
  }

  return {
    appendMissingRolloutCompletionTurnsToThread,
    appendRolloutActiveAssistantItemsToDetailResult,
    appendRolloutEmptyCompletionDiagnosticsToThread,
    appendRolloutFinalReceiptsToThread,
    appendRolloutToolOutputImagesToThread,
    attachRolloutUsageSummariesToDetailResult,
    appendRolloutUserInputAnchorsToDetailResult,
    backfillMissingRolloutCompletionTurnsForDetailResult,
    cloneThreadForUsageDecoration,
    compactItem,
    compactThread,
    compactThreadReadResult,
    compactTurn,
    compactTurnsListResult,
    createResponsePreparationService,
    dedupeSyntheticActiveAssistantMessagesInThread,
    enrichThreadItemTimestampsFromRollout,
    fallbackThreadReadResult,
    fallbackThreadReadResultForOrchestrator,
    finalizeActiveAssistantProjectionDetailResult,
    finalizeThreadDetailProjectionResult,
    hasTurnUsageSummaryPayload,
    inferTurnItemDisplayTimestamps,
    isAssistantReceiptItem,
    isCompletedStatus,
    isContextCompactionType,
    isEndedTurn,
    isLiveTurn,
    isOperationalItem,
    isReadTimeoutError,
    isTurnDiagnosticItem,
    isTurnUsageSummaryItem,
    isUserQuestionItem,
    isVisualReceiptItem,
    isWebSearchLikeItem,
    itemDisplayTimestampMs,
    itemTimestampCandidateId,
    itemTimestampMatchText,
    normalizeSupersededLiveTurns,
    orderTurnItemsByDisplayTimestamp,
    olderTurnsCursorBeforeTurn,
    parseThreadTurnsCursor,
    prepareProjectedThreadReadResult,
    prepareThreadDetailResponseResult,
    pruneSupersededLiveShellTurns,
    readFullThreadDetailForOrchestrator,
    readRawThreadDetailForOrchestrator,
    readRolloutEnrichmentEntries,
    readRolloutEnrichmentText,
    readRolloutItemTimestampCandidates,
    readRolloutRuntimeScanText,
    readRolloutTail,
    readRolloutToolOutputImageItems,
    readRolloutTurnUsageSummaries,
    reconcileThreadActiveTurnWithRolloutEvidence,
    rolloutEntryTurnId,
    rolloutEvidenceHasRuntimeActivity,
    rolloutEvidenceIsRecent,
    rolloutTimestampFields,
    scheduleRecentWindowProjectionRefresh,
    sortTurnsChronologically,
    threadDetailActiveTurnEvidenceService,
    threadDetailActiveWindowPrewarmService,
    threadDetailCompactionService,
    threadDetailFirstPaintPrewarmService,
    threadDetailProjectionInput,
    threadDetailProjectionService,
    threadDetailReadOrchestrationService,
    threadDetailResponsePreparationService: () => threadDetailResponsePreparationService,
    threadDetailRolloutBackfillService,
    threadDetailSummaryService,
    threadFromTurnsList,
    threadRolloutSizeBytes,
    timestampTextsMatch,
    turnCompletionUsageSummary,
    turnIdentifier,
    turnSortTimestampMs,
    turnStartedAtMs,
    turnsListThreadReadResult,
    userMessageHasVisualAttachment,
    visibleItemId,
  };
}

module.exports = {
  createThreadDetailRuntimeService,
};
