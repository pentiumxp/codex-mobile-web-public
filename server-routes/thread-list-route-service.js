"use strict";

const {
  planThreadListAppServerFetch,
  planThreadListInitialFallbackAttempt,
  threadListInitialFallbackMetadata,
  threadListAppServerLatencyTimingFields,
  threadListAppServerFetchTimingFields,
} = require("../adapters/thread-list-app-server-fetch-policy-service");
const {
  mergeThreadListRouteResult,
} = require("../adapters/thread-list-route-merge-service");
const {
  createThreadListRequestContext,
} = require("../adapters/thread-list-request-context-service");
const { diagnoseThreadListColdPath } = require("../adapters/thread-list-cold-path-diagnosis-service");

async function handleThreadListRoute(options = {}) {
  const {
    url,
    method,
    sendJson,
    archivedSessionThreadIds,
    readSessionIndexEntries,
    rolloutStatsForPath,
    threadDisplaySummaryCache,
    mergeThreadDisplaySummary,
    normalizeStaleContextOnlyActiveThread,
    readGlobalState,
    visibilityFromGlobalState,
    normalizeFsPath,
    threadListResponseCoalescer,
    readThreadListCachedFallback,
    readThreadListFallback,
    threadListFallbackBaselineWorkTimingFields,
    threadListFallbackSourceDiagnosticTimingFields,
    normalizeThreadListResultStatuses,
    attachThreadListStateToResult,
    tokenUsageStatsService,
    tokenUsageWorkspaceCwds,
    threadListTokenUsageTimingFields,
    logThreadList,
    scheduleActiveWindowPrewarmFromThreadListResult,
    codex,
    filterVisibleThreads,
    filterThreadListByCwd,
    shouldDeferThreadListFallbackForActiveDetail,
    hydrateThreadListResultTitlesFromSessionIndex,
    upsertThreadListFallbackCacheThreads,
    mergeThreadSummaryListWithDiagnostics,
    normalizeThreadSummaryLiveStatus,
    threadListDefaultWarmFallbackEnabled,
    readRpcTimeoutMs,
  } = options;

  if (!url || url.pathname !== "/api/threads" || method !== "GET") {
    return { handled: false };
  }
  const routeStartedAtMs = Date.now();
  const timings = {};
  let threadListRequestContext = null;
  let requestArchivedIds = null;
  let mergeThreadSummaryListOptions = null;
  const requestCachedDisplaySummaries = new Map();
  let requestCachedDisplayReadCount = 0;
  const markTiming = (name, startedAtMs) => {
    timings[name] = Math.max(0, Date.now() - Number(startedAtMs || Date.now()));
    return timings[name];
  };
  const boundedRequestCount = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    return Math.min(100000, Math.trunc(number));
  };
  const getThreadListRequestContext = () => {
    if (!threadListRequestContext) {
      threadListRequestContext = createThreadListRequestContext({
        readArchivedIds: archivedSessionThreadIds,
        readSessionIndexEntries,
        rolloutStatsForPath,
      });
    }
    return threadListRequestContext;
  };
  const getRequestArchivedIds = () => {
    if (!requestArchivedIds) requestArchivedIds = getThreadListRequestContext().archivedIds();
    return requestArchivedIds;
  };
  const mergeThreadWithCachedDisplaySummaryForRequest = (thread) => {
    if (!thread || typeof thread !== "object" || !thread.id) return thread;
    const id = String(thread.id);
    if (!requestCachedDisplaySummaries.has(id)) {
      requestCachedDisplaySummaries.set(id, threadDisplaySummaryCache.read(id) || null);
      requestCachedDisplayReadCount += 1;
    }
    const cached = requestCachedDisplaySummaries.get(id);
    return normalizeStaleContextOnlyActiveThread(cached ? (mergeThreadDisplaySummary(thread, cached, {
      rolloutStatsForPath: getThreadListRequestContext().rolloutStatsForPath,
      preferExistingRolloutStats: true,
    }) || thread) : thread);
  };
  const getMergeThreadSummaryListOptions = () => {
    if (!mergeThreadSummaryListOptions) {
      mergeThreadSummaryListOptions = {
        archivedIds: getRequestArchivedIds(),
        mergeThreadDisplaySummary: (base, display) => mergeThreadDisplaySummary(base, display, {
          rolloutStatsForPath: getThreadListRequestContext().rolloutStatsForPath,
          preferExistingRolloutStats: true,
        }),
        mergeThreadWithCachedDisplaySummary: mergeThreadWithCachedDisplaySummaryForRequest,
        sessionIndexEntries: getThreadListRequestContext().sessionIndexEntries(),
      };
    }
    return mergeThreadSummaryListOptions;
  };
  const attachDiagnostics = (result, details = {}) => {
    if (!result || typeof result !== "object") return result;
    const totalMs = Math.max(0, Date.now() - routeStartedAtMs);
    const threadListTimings = Object.assign({
      totalMs,
      limit,
      cursor: Boolean(cursor),
      archived,
      hasWorkspace: Boolean(cwd),
      hasSearch: Boolean(searchTerm),
      resultCount: Array.isArray(result.data) ? result.data.length : Array.isArray(result.threads) ? result.threads.length : 0,
    }, timings, threadListRequestContext ? Object.assign(
      {},
      threadListRequestContext.diagnostics(),
      { requestContextCachedDisplayReadCount: boundedRequestCount(requestCachedDisplayReadCount) },
    ) : {}, details || {});
    const coldPathDiagnosis = diagnoseThreadListColdPath(threadListTimings);
    threadListTimings.coldPathOwner = coldPathDiagnosis.owner;
    threadListTimings.coldPathReason = coldPathDiagnosis.reason;
    result.mobileDiagnostics = Object.assign({}, result.mobileDiagnostics || {}, {
      threadListTimings,
    });
    return result;
  };
  const globalState = readGlobalState();
  const visibility = visibilityFromGlobalState(globalState);
  const cwd = url.searchParams.get("cwd") || null;
  const archivedParam = url.searchParams.get("archived");
  const archived = archivedParam === "true";
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || "80")));
  const cursor = url.searchParams.get("cursor") || null;
  const searchTerm = url.searchParams.get("search") || null;
  const fallbackMode = String(url.searchParams.get("fallback") || "").trim().toLowerCase();
  const deferFallback = fallbackMode === "defer" && !cursor && !archived && !searchTerm;
  const initialMode = String(url.searchParams.get("initial") || "").trim().toLowerCase();
  const initialFallbackPlan = planThreadListInitialFallbackAttempt({
    initialMode,
    fallbackMode,
    cursor,
    archived,
    cwd,
    searchTerm,
    defaultWarmFallback: threadListDefaultWarmFallbackEnabled,
  });
  if (cwd && !visibility.workspaceKeys.has(normalizeFsPath(cwd))) {
    sendJson(200, { data: [] });
    return { handled: true };
  }
  const threadListCoalescing = threadListResponseCoalescer.begin({
    limit,
    cursor,
    archived,
    cwd,
    searchTerm,
    fallbackMode,
    initialMode,
  });
  if (threadListCoalescing.enabled && !threadListCoalescing.leader) {
    sendJson(200, await threadListCoalescing.result());
    return { handled: true };
  }
  const sendThreadListResult = (event, result) => {
    if (threadListCoalescing.enabled && threadListCoalescing.leader) {
      threadListCoalescing.complete(result);
    }
    logThreadList(event, result && result.mobileDiagnostics && result.mobileDiagnostics.threadListTimings);
    scheduleActiveWindowPrewarmFromThreadListResult(result, `thread-list:${event}`);
    sendJson(200, result);
  };
  const failThreadListCoalescing = (err) => {
    if (threadListCoalescing.enabled && threadListCoalescing.leader) {
      threadListCoalescing.fail(err);
    }
  };
  const appServerFetchPlan = planThreadListAppServerFetch({
    limit,
    cursor,
    archived,
    cwd,
    searchTerm,
  });
  Object.assign(timings, threadListAppServerFetchTimingFields(appServerFetchPlan));
  const params = {
    cursor,
    limit: appServerFetchPlan.appServerLimit,
    sortKey: "updated_at",
    sortDirection: "desc",
    archived,
    useStateDbOnly: true,
    sourceKinds: [],
  };
  if (searchTerm) params.searchTerm = searchTerm;
  try {
    if (initialFallbackPlan.attempt) {
      const fallbackStartedAtMs = Date.now();
      const fallbackDiagnostics = {};
      let initialFallback = readThreadListCachedFallback(limit, { cwd, searchTerm, globalState, diagnostics: fallbackDiagnostics });
      const initialFallbackCacheHit = fallbackDiagnostics.cacheHit === true;
      if (!initialFallback.length && initialFallbackPlan.allowBaseline) {
        const initialMergeOptions = getMergeThreadSummaryListOptions();
        initialFallback = readThreadListFallback(limit, {
          cwd,
          searchTerm,
          globalState,
          diagnostics: fallbackDiagnostics,
          archivedIds: initialMergeOptions.archivedIds,
          mergeThreadSummaryListOptions: initialMergeOptions,
        });
      }
      markTiming("fallbackMs", fallbackStartedAtMs);
      if (initialFallback.length && (!initialFallbackPlan.requireCacheHit || initialFallbackCacheHit)) {
        const initialFallbackMeta = threadListInitialFallbackMetadata({
          cacheHit: initialFallbackCacheHit,
          reason: initialFallbackPlan.reason,
        });
        const cachedSourceTimings = fallbackDiagnostics.cachedSourceTimings && typeof fallbackDiagnostics.cachedSourceTimings === "object"
          ? fallbackDiagnostics.cachedSourceTimings
          : {};
        const fallbackSourceTimings = initialFallbackCacheHit
          ? fallbackDiagnostics
          : (Object.keys(cachedSourceTimings).length ? cachedSourceTimings : fallbackDiagnostics);
        Object.assign(timings, {
          appServerMs: 0,
          appServerDeferred: true,
          appServerDeferredReason: initialFallbackMeta.appServerDeferredReason,
          appServerDeferredInitialReason: initialFallbackPlan.reason,
          fallbackCacheHit: fallbackDiagnostics.cacheHit === true,
          fallbackCacheDecision: String(fallbackDiagnostics.cacheDecision || "hit"),
          fallbackCacheBuildReason: String(fallbackDiagnostics.cacheBuildReason || ""),
          fallbackCacheKeyHash: String(fallbackDiagnostics.cacheKeyHash || ""),
          fallbackCacheAgeMs: Number(fallbackDiagnostics.cacheAgeMs || 0),
          fallbackCacheBaselineAgeMs: Number(fallbackDiagnostics.cacheBaselineAgeMs || 0),
          fallbackCacheUpdatedAgeMs: Number(fallbackDiagnostics.cacheUpdatedAgeMs || 0),
          fallbackCacheTtlMs: Number(fallbackDiagnostics.cacheTtlMs || 0),
          fallbackCacheEntryCount: Number(fallbackDiagnostics.cacheEntryCount || 0),
          fallbackCacheBuildCount: Number(fallbackDiagnostics.cacheBuildCount || 0),
          fallbackCacheBuildNumber: Number(fallbackDiagnostics.cacheBuildNumber || 0),
          fallbackCacheIncrementalUpdates: Number(fallbackDiagnostics.cacheIncrementalUpdates || 0),
          fallbackCachePersistentRestored: fallbackDiagnostics.cachePersistentRestored === true,
          fallbackCompatibleCacheHit: fallbackDiagnostics.compatibleCacheHit === true,
          fallbackCompatibleCacheLimit: Number(fallbackDiagnostics.compatibleCacheLimit || 0),
          fallbackWorkspaceDerivedCacheHit: fallbackDiagnostics.workspaceDerivedCacheHit === true,
          fallbackWorkspaceDerivedCacheLimit: Number(fallbackDiagnostics.workspaceDerivedCacheLimit || 0),
          fallbackStateDbMs: Number(fallbackDiagnostics.stateDbMs || 0),
          fallbackRolloutMs: Number(fallbackDiagnostics.rolloutMs || 0),
          fallbackSessionIndexMs: Number(fallbackDiagnostics.sessionIndexMs || 0),
          fallbackStateDbCount: Number(fallbackSourceTimings.stateDbCount || 0),
          fallbackRolloutCount: Number(fallbackSourceTimings.rolloutCount || 0),
          fallbackSessionIndexCount: Number(fallbackSourceTimings.sessionIndexCount || 0),
          fallbackBaselineSourceCount: Number(fallbackSourceTimings.baselineSourceCount || 0),
          fallbackBaselineResultCount: Number(fallbackSourceTimings.baselineResultCount || initialFallback.length),
          fallbackSourceSnapshotHit: fallbackSourceTimings.sourceSnapshotHit === true,
          fallbackSourceSnapshotAgeMs: Number(fallbackSourceTimings.sourceSnapshotAgeMs || 0),
          fallbackSourceSnapshotLimit: Number(fallbackSourceTimings.sourceSnapshotLimit || 0),
          fallbackSourceSnapshotBuildCount: Number(fallbackSourceTimings.sourceSnapshotBuildCount || 0),
          fallbackSourceSnapshotBuildNumber: Number(fallbackSourceTimings.sourceSnapshotBuildNumber || 0),
          fallbackSourceSnapshotRawCount: Number(fallbackSourceTimings.sourceSnapshotRawCount || 0),
          ...threadListFallbackBaselineWorkTimingFields(fallbackSourceTimings),
          ...threadListFallbackSourceDiagnosticTimingFields(fallbackSourceTimings),
        });
        const mergeStartedAtMs = Date.now();
        const result = normalizeThreadListResultStatuses({
          data: initialFallback.slice(0, limit),
        });
        threadDisplaySummaryCache.rememberList(result);
        markTiming("mergeMs", mergeStartedAtMs);
        const stateAttachStartedAtMs = Date.now();
        const stateAttachedResult = attachThreadListStateToResult(result);
        markTiming("stateAttachMs", stateAttachStartedAtMs);
        const decorateStartedAtMs = Date.now();
        const decorated = tokenUsageStatsService.decorateThreadListResult(
          stateAttachedResult,
          { cwd, days: 31, workspaceCwds: tokenUsageWorkspaceCwds(globalState), allowExpiredTokenUsageCache: true },
        );
        Object.assign(timings, threadListTokenUsageTimingFields(decorated.mobileTokenUsageDiagnostics));
        markTiming("decorateMs", decorateStartedAtMs);
        decorated.mobileDeferredAppServer = true;
        decorated.mobileInitialSource = initialFallbackMeta.initialSource;
        attachDiagnostics(decorated);
        sendThreadListResult(initialFallbackMeta.eventName, decorated);
        return { handled: true };
      }
    }
    const appServerStartedAtMs = Date.now();
    const appServerRpcStartedAtMs = Date.now();
    const appServerRpcDiagnostics = {};
    const appServerRawResult = await codex.request("thread/list", params, {
      timeoutMs: readRpcTimeoutMs,
      diagnostics: appServerRpcDiagnostics,
    });
    markTiming("appServerRpcMs", appServerRpcStartedAtMs);
    const appServerVisibleFilterStartedAtMs = Date.now();
    const appServerVisibleResult = filterVisibleThreads(appServerRawResult, globalState, {
      archivedIds: getRequestArchivedIds(),
      rolloutStatsForPath: getThreadListRequestContext().rolloutStatsForPath,
    });
    markTiming("appServerVisibleFilterMs", appServerVisibleFilterStartedAtMs);
    const appServerWorkspaceFilterStartedAtMs = Date.now();
    const appServerResult = filterThreadListByCwd(appServerVisibleResult, cwd);
    markTiming("appServerWorkspaceFilterMs", appServerWorkspaceFilterStartedAtMs);
    const appServerElapsedMs = Math.max(0, Date.now() - appServerStartedAtMs);
    timings.appServerMs = appServerElapsedMs;
    Object.assign(timings, threadListAppServerLatencyTimingFields({
      rawResult: appServerRawResult,
      visibleResult: appServerVisibleResult,
      filteredResult: appServerResult,
      totalMs: appServerElapsedMs,
      rpcMs: timings.appServerRpcMs,
      rpcDiagnostics: appServerRpcDiagnostics,
      visibleFilterMs: timings.appServerVisibleFilterMs,
      workspaceFilterMs: timings.appServerWorkspaceFilterMs,
    }));
    const shouldDeferFallback = shouldDeferThreadListFallbackForActiveDetail({
      deferFallback,
      cursor,
      archived,
      searchTerm,
      cwd,
    });
    if (shouldDeferFallback) {
      Object.assign(timings, {
        fallbackMs: 0,
        fallbackCacheHit: false,
        fallbackDeferred: true,
        fallbackDeferredReason: deferFallback ? "client" : "active-thread-detail",
        fallbackStateDbMs: 0,
        fallbackRolloutMs: 0,
        fallbackSessionIndexMs: 0,
        mergeMs: 0,
      });
      const sessionIndexStartedAtMs = Date.now();
      const deferredMergeOptions = getMergeThreadSummaryListOptions();
      const indexedResult = normalizeThreadListResultStatuses(hydrateThreadListResultTitlesFromSessionIndex(
        appServerResult,
        deferredMergeOptions.sessionIndexEntries,
      ));
      timings.fallbackCacheFreshRowUpsertCount = upsertThreadListFallbackCacheThreads(indexedResult, { addIfMissing: true });
      timings.fallbackSessionIndexMs = Math.max(0, Date.now() - sessionIndexStartedAtMs);
      threadDisplaySummaryCache.rememberList(indexedResult);
      if (Array.isArray(indexedResult.data)) indexedResult.data = indexedResult.data.slice(0, limit);
      if (Array.isArray(indexedResult.threads)) indexedResult.threads = indexedResult.threads.slice(0, limit);
      const stateAttachStartedAtMs = Date.now();
      const stateAttachedResult = attachThreadListStateToResult(indexedResult);
      markTiming("stateAttachMs", stateAttachStartedAtMs);
      const decorateStartedAtMs = Date.now();
      const decorated = tokenUsageStatsService.decorateThreadListResult(
        stateAttachedResult,
        { cwd, days: 31, workspaceCwds: tokenUsageWorkspaceCwds(globalState), allowExpiredTokenUsageCache: true },
      );
      Object.assign(timings, threadListTokenUsageTimingFields(decorated.mobileTokenUsageDiagnostics));
      markTiming("decorateMs", decorateStartedAtMs);
      decorated.mobileDeferredFallback = true;
      attachDiagnostics(decorated);
      sendThreadListResult("deferred_complete", decorated);
      return { handled: true };
    }
    const fallbackStartedAtMs = Date.now();
    const fallbackDiagnostics = {};
    const fullMergeOptions = getMergeThreadSummaryListOptions();
    const fallback = readThreadListFallback(limit, {
      cwd,
      searchTerm,
      globalState,
      diagnostics: fallbackDiagnostics,
      archivedIds: fullMergeOptions.archivedIds,
      mergeThreadSummaryListOptions: fullMergeOptions,
    });
    markTiming("fallbackMs", fallbackStartedAtMs);
    Object.assign(timings, {
      fallbackCacheHit: Boolean(fallbackDiagnostics.cacheHit),
      fallbackCacheDecision: String(fallbackDiagnostics.cacheDecision || ""),
      fallbackCacheBuildReason: String(fallbackDiagnostics.cacheBuildReason || ""),
      fallbackCacheKeyHash: String(fallbackDiagnostics.cacheKeyHash || ""),
      fallbackCacheAgeMs: Number(fallbackDiagnostics.cacheAgeMs || 0),
      fallbackCacheBaselineAgeMs: Number(fallbackDiagnostics.cacheBaselineAgeMs || 0),
      fallbackCacheUpdatedAgeMs: Number(fallbackDiagnostics.cacheUpdatedAgeMs || 0),
      fallbackCacheTtlMs: Number(fallbackDiagnostics.cacheTtlMs || 0),
      fallbackCacheEntryCount: Number(fallbackDiagnostics.cacheEntryCount || 0),
      fallbackCacheBuildCount: Number(fallbackDiagnostics.cacheBuildCount || 0),
      fallbackCacheBuildNumber: Number(fallbackDiagnostics.cacheBuildNumber || 0),
      fallbackCacheIncrementalUpdates: Number(fallbackDiagnostics.cacheIncrementalUpdates || 0),
      fallbackCachePersistentRestored: fallbackDiagnostics.cachePersistentRestored === true,
      fallbackCompatibleCacheHit: fallbackDiagnostics.compatibleCacheHit === true,
      fallbackCompatibleCacheLimit: Number(fallbackDiagnostics.compatibleCacheLimit || 0),
      fallbackWorkspaceDerivedCacheHit: fallbackDiagnostics.workspaceDerivedCacheHit === true,
      fallbackWorkspaceDerivedCacheLimit: Number(fallbackDiagnostics.workspaceDerivedCacheLimit || 0),
      fallbackStateDbMs: Number(fallbackDiagnostics.stateDbMs || 0),
      fallbackRolloutMs: Number(fallbackDiagnostics.rolloutMs || 0),
      fallbackSessionIndexMs: Number(fallbackDiagnostics.sessionIndexMs || 0),
      fallbackStateDbCount: Number(fallbackDiagnostics.stateDbCount || 0),
      fallbackRolloutCount: Number(fallbackDiagnostics.rolloutCount || 0),
      fallbackSessionIndexCount: Number(fallbackDiagnostics.sessionIndexCount || 0),
      fallbackBaselineSourceCount: Number(fallbackDiagnostics.baselineSourceCount || 0),
      fallbackBaselineResultCount: Number(fallbackDiagnostics.baselineResultCount || 0),
      fallbackSourceSnapshotHit: fallbackDiagnostics.sourceSnapshotHit === true,
      fallbackSourceSnapshotAgeMs: Number(fallbackDiagnostics.sourceSnapshotAgeMs || 0),
      fallbackSourceSnapshotLimit: Number(fallbackDiagnostics.sourceSnapshotLimit || 0),
      fallbackSourceSnapshotBuildCount: Number(fallbackDiagnostics.sourceSnapshotBuildCount || 0),
      fallbackSourceSnapshotBuildNumber: Number(fallbackDiagnostics.sourceSnapshotBuildNumber || 0),
      fallbackSourceSnapshotRawCount: Number(fallbackDiagnostics.sourceSnapshotRawCount || 0),
      ...threadListFallbackBaselineWorkTimingFields(fallbackDiagnostics),
      ...threadListFallbackSourceDiagnosticTimingFields(fallbackDiagnostics),
    });
    const mergeStartedAtMs = Date.now();
    const routeMerge = mergeThreadListRouteResult({
      result: appServerResult,
      fallbackThreads: fallback,
      limit,
      dropDuplicateFallbackThreads: true,
      mergeThreadSummaryList: mergeThreadSummaryListWithDiagnostics,
      mergeThreadSummaryListOptions: fullMergeOptions,
    });
    Object.assign(timings, routeMerge.diagnostics);
    const result = normalizeThreadListResultStatuses(routeMerge.result);
    timings.fallbackCacheFreshRowUpsertCount = upsertThreadListFallbackCacheThreads(result, { addIfMissing: true });
    threadDisplaySummaryCache.rememberList(result);
    if (Array.isArray(result.data)) result.data = result.data.slice(0, limit);
    if (Array.isArray(result.threads)) result.threads = result.threads.slice(0, limit);
    markTiming("mergeMs", mergeStartedAtMs);
    const stateAttachStartedAtMs = Date.now();
    const stateAttachedResult = attachThreadListStateToResult(result);
    markTiming("stateAttachMs", stateAttachStartedAtMs);
    const decorateStartedAtMs = Date.now();
    const decorated = tokenUsageStatsService.decorateThreadListResult(
      stateAttachedResult,
      { cwd, days: 31, workspaceCwds: tokenUsageWorkspaceCwds(globalState), allowExpiredTokenUsageCache: true },
    );
    Object.assign(timings, threadListTokenUsageTimingFields(decorated.mobileTokenUsageDiagnostics));
    markTiming("decorateMs", decorateStartedAtMs);
    attachDiagnostics(decorated);
    sendThreadListResult("complete", decorated);
  } catch (err) {
    const fallbackStartedAtMs = Date.now();
    const fallbackDiagnostics = {};
    const fallbackMergeOptions = getMergeThreadSummaryListOptions();
    const fallback = readThreadListFallback(limit, {
      cwd,
      searchTerm,
      globalState,
      diagnostics: fallbackDiagnostics,
      archivedIds: fallbackMergeOptions.archivedIds,
      mergeThreadSummaryListOptions: fallbackMergeOptions,
    });
    markTiming("fallbackMs", fallbackStartedAtMs);
    Object.assign(timings, {
      fallbackCacheHit: Boolean(fallbackDiagnostics.cacheHit),
      fallbackCacheDecision: String(fallbackDiagnostics.cacheDecision || ""),
      fallbackCacheBuildReason: String(fallbackDiagnostics.cacheBuildReason || ""),
      fallbackCacheKeyHash: String(fallbackDiagnostics.cacheKeyHash || ""),
      fallbackCacheAgeMs: Number(fallbackDiagnostics.cacheAgeMs || 0),
      fallbackCacheBaselineAgeMs: Number(fallbackDiagnostics.cacheBaselineAgeMs || 0),
      fallbackCacheUpdatedAgeMs: Number(fallbackDiagnostics.cacheUpdatedAgeMs || 0),
      fallbackCacheTtlMs: Number(fallbackDiagnostics.cacheTtlMs || 0),
      fallbackCacheEntryCount: Number(fallbackDiagnostics.cacheEntryCount || 0),
      fallbackCacheBuildCount: Number(fallbackDiagnostics.cacheBuildCount || 0),
      fallbackCacheBuildNumber: Number(fallbackDiagnostics.cacheBuildNumber || 0),
      fallbackCacheIncrementalUpdates: Number(fallbackDiagnostics.cacheIncrementalUpdates || 0),
      fallbackCachePersistentRestored: fallbackDiagnostics.cachePersistentRestored === true,
      fallbackCompatibleCacheHit: fallbackDiagnostics.compatibleCacheHit === true,
      fallbackCompatibleCacheLimit: Number(fallbackDiagnostics.compatibleCacheLimit || 0),
      fallbackWorkspaceDerivedCacheHit: fallbackDiagnostics.workspaceDerivedCacheHit === true,
      fallbackWorkspaceDerivedCacheLimit: Number(fallbackDiagnostics.workspaceDerivedCacheLimit || 0),
      fallbackStateDbMs: Number(fallbackDiagnostics.stateDbMs || 0),
      fallbackRolloutMs: Number(fallbackDiagnostics.rolloutMs || 0),
      fallbackSessionIndexMs: Number(fallbackDiagnostics.sessionIndexMs || 0),
      fallbackStateDbCount: Number(fallbackDiagnostics.stateDbCount || 0),
      fallbackRolloutCount: Number(fallbackDiagnostics.rolloutCount || 0),
      fallbackSessionIndexCount: Number(fallbackDiagnostics.sessionIndexCount || 0),
      fallbackBaselineSourceCount: Number(fallbackDiagnostics.baselineSourceCount || 0),
      fallbackBaselineResultCount: Number(fallbackDiagnostics.baselineResultCount || 0),
      fallbackSourceSnapshotHit: fallbackDiagnostics.sourceSnapshotHit === true,
      fallbackSourceSnapshotAgeMs: Number(fallbackDiagnostics.sourceSnapshotAgeMs || 0),
      fallbackSourceSnapshotLimit: Number(fallbackDiagnostics.sourceSnapshotLimit || 0),
      fallbackSourceSnapshotBuildCount: Number(fallbackDiagnostics.sourceSnapshotBuildCount || 0),
      fallbackSourceSnapshotBuildNumber: Number(fallbackDiagnostics.sourceSnapshotBuildNumber || 0),
      fallbackSourceSnapshotRawCount: Number(fallbackDiagnostics.sourceSnapshotRawCount || 0),
      ...threadListFallbackBaselineWorkTimingFields(fallbackDiagnostics),
      ...threadListFallbackSourceDiagnosticTimingFields(fallbackDiagnostics),
    });
    if (fallback.length) {
      const stateAttachStartedAtMs = Date.now();
      const normalizedFallback = fallback.map((thread) => normalizeThreadSummaryLiveStatus(thread));
      timings.fallbackCacheFreshRowUpsertCount = upsertThreadListFallbackCacheThreads(normalizedFallback, { addIfMissing: true });
      const stateAttachedFallback = attachThreadListStateToResult({
        data: normalizedFallback,
      });
      markTiming("stateAttachMs", stateAttachStartedAtMs);
      const decorateStartedAtMs = Date.now();
      const decorated = tokenUsageStatsService.decorateThreadListResult({
        data: stateAttachedFallback.data,
        mobileFallback: true,
        warning: err.message || String(err),
      }, { cwd, days: 31, workspaceCwds: tokenUsageWorkspaceCwds(globalState), allowExpiredTokenUsageCache: true });
      Object.assign(timings, threadListTokenUsageTimingFields(decorated.mobileTokenUsageDiagnostics));
      markTiming("decorateMs", decorateStartedAtMs);
      attachDiagnostics(decorated, { appServerError: err.message || String(err) });
      sendThreadListResult("fallback_complete", decorated);
      return { handled: true };
    }
    failThreadListCoalescing(err);
    logThreadList("error", Object.assign({
      totalMs: Math.max(0, Date.now() - routeStartedAtMs),
      error: err.message || String(err),
    }, timings));
    throw err;
  }
  return { handled: true };
}

module.exports = {
  handleThreadListRoute,
};
