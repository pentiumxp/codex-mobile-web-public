"use strict";

const { createThreadListFallbackCacheService } = require("./thread-list-fallback-cache-service");
const { createThreadListFallbackPersistentCacheStore } = require("./thread-list-fallback-persistent-cache-store");
const {
  createThreadListFallbackPrewarmService,
  summarizePrewarmStatus,
} = require("./thread-list-fallback-prewarm-service");
const { mergeThreadListRouteResult } = require("./thread-list-route-merge-service");
const { createThreadListSummaryMergeService } = require("./thread-list-summary-merge-service");
const { createThreadListResponseCoalescer } = require("./thread-list-response-coalescer-service");

function numberField(source, key) {
  return Number(source && source[key] || 0);
}

function createThreadListRuntimeService(options = {}) {
  const fallbackCacheOptions = options.fallbackCache || {};
  const prewarmOptions = options.prewarm || {};
  const stripThreadListDetailFields = typeof options.stripThreadListDetailFields === "function"
    ? options.stripThreadListDetailFields
    : (thread) => Object.assign({}, thread || {});
  const stripThreadListResultDetailFields = typeof options.stripThreadListResultDetailFields === "function"
    ? options.stripThreadListResultDetailFields
    : (result) => result;
  const normalizeThreadSummaryLiveStatus = typeof options.normalizeThreadSummaryLiveStatus === "function"
    ? options.normalizeThreadSummaryLiveStatus
    : (thread) => thread;
  const timestampToMs = typeof options.timestampToMs === "function" ? options.timestampToMs : () => 0;
  const readGlobalState = typeof options.readGlobalState === "function" ? options.readGlobalState : () => ({});
  const now = typeof options.now === "function" ? options.now : Date.now;
  const getActiveThreadDetailRequestCount = typeof options.getActiveThreadDetailRequestCount === "function"
    ? options.getActiveThreadDetailRequestCount
    : () => activeThreadDetailRequestCount;
  const scheduleActiveWindowPrewarmFromThreadListResult = typeof options.scheduleActiveWindowPrewarmFromThreadListResult === "function"
    ? options.scheduleActiveWindowPrewarmFromThreadListResult
    : () => null;

  let activeThreadDetailRequestCount = 0;
  let summaryMergeService = null;

  function threadListSummaryTimestampMs(thread) {
    if (!thread || typeof thread !== "object") return 0;
    return Math.max(
      timestampToMs(thread.updatedAtMs || thread.updated_at_ms),
      timestampToMs(thread.updatedAt || thread.updated_at),
      Number(thread.rolloutSizeUpdatedAtMs || 0),
    );
  }

  function sortThreadListSummaries(threads) {
    return (Array.isArray(threads) ? threads : [])
      .map((thread, index) => ({ thread, index, timestampMs: threadListSummaryTimestampMs(thread) }))
      .sort((a, b) => (b.timestampMs - a.timestampMs) || (a.index - b.index))
      .map((entry) => entry.thread);
  }

  function getThreadListSummaryMergeService() {
    if (!summaryMergeService) {
      summaryMergeService = createThreadListSummaryMergeService({
        archivedSessionThreadIds: options.archivedSessionThreadIds,
        mergeThreadWithCachedDisplaySummary: options.mergeThreadWithCachedDisplaySummary,
        stripThreadListDetailFields,
        normalizeThreadSummaryLiveStatus,
        mergeThreadDisplaySummary: options.mergeThreadDisplaySummary,
        threadHasArchiveSignal: options.threadHasArchiveSignal,
        isSubagentThreadSummary: options.isSubagentThreadSummary,
        hydrateThreadListTitlesFromSessionIndex: options.hydrateThreadListTitlesFromSessionIndex,
        shouldHideThreadListSummary: options.shouldHideThreadListSummary,
        sortThreadListSummaries,
      });
    }
    return summaryMergeService;
  }

  function mergeThreadSummaryListWithDiagnostics(threads, mergeOptions = {}) {
    return getThreadListSummaryMergeService().mergeThreadSummaryListWithDiagnostics(threads, mergeOptions);
  }

  function mergeThreadSummaryList(threads, mergeOptions = {}) {
    return getThreadListSummaryMergeService().mergeThreadSummaryList(threads, mergeOptions);
  }

  function mergeThreadListFallback(result, fallbackThreads = [], limit = 80) {
    return mergeThreadListRouteResult({
      result,
      fallbackThreads,
      limit,
      mergeThreadSummaryList,
    }).result;
  }

  function normalizeThreadListResultStatuses(result) {
    if (!result || typeof result !== "object") return result;
    const out = Object.assign({}, result);
    if (Array.isArray(out.data)) out.data = out.data.map((thread) => stripThreadListDetailFields(normalizeThreadSummaryLiveStatus(thread)));
    if (Array.isArray(out.threads)) out.threads = out.threads.map((thread) => stripThreadListDetailFields(normalizeThreadSummaryLiveStatus(thread)));
    return stripThreadListResultDetailFields(out);
  }

  const threadListFallbackCacheService = createThreadListFallbackCacheService({
    ttlMs: fallbackCacheOptions.ttlMs,
    maxEntries: fallbackCacheOptions.maxEntries || 12,
    now,
    persistentStore: createThreadListFallbackPersistentCacheStore({
      filePath: fallbackCacheOptions.filePath,
      maxEntries: fallbackCacheOptions.persistentMaxEntries || fallbackCacheOptions.maxEntries || 12,
      maxThreadsPerEntry: fallbackCacheOptions.maxThreadsPerEntry || 200,
      maxAgeMs: fallbackCacheOptions.persistMaxAgeMs,
    }),
    readGlobalState,
    normalizeFsPath: options.normalizeFsPath,
    normalizeThreadId: options.normalizeThreadId,
    visibleWorkspaceRoots: options.visibleWorkspaceRoots,
    visibleProjectlessThreadIds: options.visibleProjectlessThreadIds,
    mergeThreadDisplaySummary: options.mergeThreadDisplaySummary,
    normalizeThreadSummaryLiveStatus,
    filterFallbackThreads: options.filterFallbackThreads,
    mergeThreadSummaryList,
    readStateDbFallback: options.readStateDbFallback,
    readRolloutSessionFallback: options.readRolloutSessionFallback,
    readSessionIndexFallback: options.readSessionIndexFallback,
  });
  const threadListResponseCoalescer = createThreadListResponseCoalescer();

  function clearThreadListFallbackCache() {
    threadListFallbackCacheService.clear();
  }

  function removeThreadFromThreadListFallbackCache(threadId) {
    return threadListFallbackCacheService.removeThread(threadId);
  }

  function upsertThreadListFallbackCacheThread(thread, upsertOptions = {}) {
    return threadListFallbackCacheService.upsertThread(thread, upsertOptions);
  }

  function updateThreadListFallbackCacheStatus(threadId, status, meta = {}) {
    return threadListFallbackCacheService.updateStatus(threadId, status, meta);
  }

  function applyThreadStatusPayloadToThreadListFallbackCache(payload) {
    return threadListFallbackCacheService.applyStatusPayload(payload);
  }

  function trackThreadDetailRequestLifecycle(res) {
    activeThreadDetailRequestCount += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      activeThreadDetailRequestCount = Math.max(0, activeThreadDetailRequestCount - 1);
    };
    if (res && typeof res.once === "function") {
      res.once("finish", release);
      res.once("close", release);
    }
    return release;
  }

  function shouldDeferThreadListFallbackForActiveDetail({ deferFallback, cursor, archived, searchTerm, cwd } = {}) {
    if (deferFallback) return true;
    if (cursor || archived || searchTerm || cwd) return false;
    return Number(getActiveThreadDetailRequestCount()) > 0;
  }

  function threadListFallbackCacheKey(limit, filters = {}) {
    return threadListFallbackCacheService.cacheKey(limit, filters);
  }

  function rememberThreadListFallbackCache(key, threads, timings = {}, rememberOptions = {}) {
    threadListFallbackCacheService.remember(key, threads, timings, rememberOptions);
  }

  function readThreadListFallbackCache(key) {
    return threadListFallbackCacheService.read(key);
  }

  function readThreadListCachedFallback(limit = 80, filters = {}) {
    return threadListFallbackCacheService.readCachedFallback(limit, filters);
  }

  function readThreadListFallback(limit = 80, filters = {}) {
    return threadListFallbackCacheService.readFallback(limit, filters);
  }

  const threadListFallbackPrewarmService = createThreadListFallbackPrewarmService({
    now,
    setTimer: typeof options.setTimer === "function" ? options.setTimer : undefined,
    readFallback: readThreadListFallback,
    readGlobalState,
    shouldRun: () => (Number(getActiveThreadDetailRequestCount()) > 0
      ? { run: false, reason: "active-detail-in-flight" }
      : { run: true }),
    onResult: ({ threads }) => scheduleActiveWindowPrewarmFromThreadListResult({
      data: threads,
    }, "thread-list-prewarm:completed"),
    logger: options.logger,
  });

  function threadListFallbackPrewarmConfig() {
    return {
      enabled: prewarmOptions.enabled,
      delayMs: prewarmOptions.delayMs,
      retryDelayMs: prewarmOptions.retryDelayMs,
      maxDeferrals: prewarmOptions.maxDeferrals,
      limit: prewarmOptions.limit,
      sourceSnapshotLimit: prewarmOptions.sourceSnapshotLimit,
    };
  }

  function threadListFallbackPrewarmPublicStatus() {
    return summarizePrewarmStatus(
      threadListFallbackPrewarmService.status(),
      threadListFallbackPrewarmConfig(),
    );
  }

  function scheduleThreadListFallbackPrewarm() {
    return threadListFallbackPrewarmService.schedule(threadListFallbackPrewarmConfig());
  }

  function threadListFallbackSourceDiagnosticTimingFields(diagnostics = {}) {
    return {
      fallbackRolloutDirectoryReadCount: numberField(diagnostics, "rolloutDirectoryReadCount"),
      fallbackRolloutFileStatCount: numberField(diagnostics, "rolloutFileStatCount"),
      fallbackRolloutFileCollectedCount: numberField(diagnostics, "rolloutFileCollectedCount"),
      fallbackRolloutFileSortedCount: numberField(diagnostics, "rolloutFileSortedCount"),
      fallbackRolloutCandidateFileCount: numberField(diagnostics, "rolloutCandidateFileCount"),
      fallbackRolloutCandidateScannedCount: numberField(diagnostics, "rolloutCandidateScannedCount"),
      fallbackRolloutHeadReadCount: numberField(diagnostics, "rolloutHeadReadCount"),
      fallbackRolloutHeadBytes: numberField(diagnostics, "rolloutHeadBytes"),
      fallbackRolloutSummaryReadCount: numberField(diagnostics, "rolloutSummaryReadCount"),
      fallbackRolloutStatusAttachCount: numberField(diagnostics, "rolloutStatusAttachCount"),
      fallbackRolloutStatusStatReadCount: numberField(diagnostics, "rolloutStatusStatReadCount"),
      fallbackRolloutStatusStatReuseCount: numberField(diagnostics, "rolloutStatusStatReuseCount"),
      fallbackRolloutStatusTailReadCount: numberField(diagnostics, "rolloutStatusTailReadCount"),
      fallbackRolloutStatusTailBytes: numberField(diagnostics, "rolloutStatusTailBytes"),
      fallbackSessionIndexReadCount: numberField(diagnostics, "sessionIndexReadCount"),
      fallbackSessionIndexReuseCount: numberField(diagnostics, "sessionIndexReuseCount"),
      fallbackSessionIndexLineCount: numberField(diagnostics, "sessionIndexLineCount"),
      fallbackSessionIndexEntryCount: numberField(diagnostics, "sessionIndexEntryCount"),
    };
  }

  function threadListFallbackBaselineWorkTimingFields(diagnostics = {}) {
    return {
      fallbackBaselineFinalFilterPassCount: numberField(diagnostics, "baselineFinalFilterPassCount"),
      fallbackBaselineFinalFilterInputCount: numberField(diagnostics, "baselineFinalFilterInputCount"),
      fallbackBaselineFinalFilterOutputCount: numberField(diagnostics, "baselineFinalFilterOutputCount"),
      fallbackBaselineMergeInputCount: numberField(diagnostics, "baselineMergeInputCount"),
      fallbackBaselineMergeOutputCount: numberField(diagnostics, "baselineMergeOutputCount"),
      fallbackBaselineMergeDuplicateCount: numberField(diagnostics, "baselineMergeDuplicateCount"),
      fallbackBaselineLimitDropCount: numberField(diagnostics, "baselineLimitDropCount"),
    };
  }

  function threadListTokenUsageTimingFields(diagnostics = {}) {
    const source = diagnostics && typeof diagnostics === "object" ? diagnostics : {};
    return {
      tokenUsageAllowExpiredCache: source.allowExpiredCache === true,
      tokenUsageCacheHitCount: numberField(source, "cacheHitCount"),
      tokenUsageFreshCacheHitCount: numberField(source, "freshCacheHitCount"),
      tokenUsageStaleCacheHitCount: numberField(source, "staleCacheHitCount"),
      tokenUsageCacheMissCount: numberField(source, "cacheMissCount"),
      tokenUsageExpiredMissCount: numberField(source, "expiredMissCount"),
      tokenUsageQueryCount: numberField(source, "queryCount"),
      tokenUsageMaxCacheAgeMs: numberField(source, "maxCacheAgeMs"),
      tokenUsageCacheCloneMs: numberField(source, "cacheCloneMs"),
      tokenUsageWorkspaceCwdCount: numberField(source, "workspaceCwdCount"),
      tokenUsageWorkspaceSnapshotBuildMs: numberField(source, "workspaceSnapshotBuildMs"),
      tokenUsageWorkspaceSnapshotCacheHitCount: numberField(source, "workspaceSnapshotCacheHitCount"),
      tokenUsageWorkspaceSnapshotCacheMissCount: numberField(source, "workspaceSnapshotCacheMissCount"),
      tokenUsageDecorateSummaryMs: numberField(source, "decorateSummaryMs"),
      tokenUsageDecorateAttachMs: numberField(source, "decorateAttachMs"),
    };
  }

  return {
    applyThreadStatusPayloadToThreadListFallbackCache,
    clearThreadListFallbackCache,
    mergeThreadListFallback,
    mergeThreadSummaryList,
    mergeThreadSummaryListWithDiagnostics,
    normalizeThreadListResultStatuses,
    readThreadListCachedFallback,
    readThreadListFallback,
    readThreadListFallbackCache,
    rememberThreadListFallbackCache,
    removeThreadFromThreadListFallbackCache,
    scheduleThreadListFallbackPrewarm,
    shouldDeferThreadListFallbackForActiveDetail,
    sortThreadListSummaries,
    threadListFallbackBaselineWorkTimingFields,
    threadListFallbackCacheKey,
    threadListFallbackPrewarmConfig,
    threadListFallbackPrewarmPublicStatus,
    threadListFallbackSourceDiagnosticTimingFields,
    threadListResponseCoalescer,
    threadListSummaryTimestampMs,
    threadListTokenUsageTimingFields,
    trackThreadDetailRequestLifecycle,
    upsertThreadListFallbackCacheThread,
    updateThreadListFallbackCacheStatus,
  };
}

module.exports = {
  createThreadListRuntimeService,
};
