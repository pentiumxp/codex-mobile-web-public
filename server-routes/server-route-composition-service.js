"use strict";

const {
  createApiDispatchRouteService,
} = require("./api-dispatch-route-service");
const {
  createCoreApiRouteService,
} = require("./core-api-route-service");

function defaultLogger() {
  return console;
}

function createServerRouteCompositionService(dependencies = {}) {
  const logger = dependencies.logger || defaultLogger();
  const coreApiRouteServiceFactory = dependencies.coreApiRouteServiceFactory || createCoreApiRouteService;
  const apiDispatchRouteServiceFactory = dependencies.apiDispatchRouteServiceFactory || createApiDispatchRouteService;
  const getUrl = dependencies.getUrl;
  const serveStatic = dependencies.serveStatic;
  const sendJson = dependencies.sendJson;

  const coreApiRouteService = coreApiRouteServiceFactory({
    activeProfileRestartOptions: dependencies.activeProfileRestartOptions,
    activeRateLimits: dependencies.activeRateLimits,
    appRoot: dependencies.appRoot,
    appUpdateBranch: dependencies.appUpdateBranch,
    appUpdateDisabled: dependencies.appUpdateDisabled,
    appUpdateRemote: dependencies.appUpdateRemote,
    appVersion: dependencies.appVersion,
    applyAppUpdate: dependencies.applyAppUpdate,
    authKey: dependencies.authKey,
    chatGptProMcpService: dependencies.chatGptProMcpService,
    codex: dependencies.codex,
    codexConfigDefaults: dependencies.codexConfigDefaults,
    codexProfileService: dependencies.codexProfileService,
    currentPublicBuildConfig: dependencies.currentPublicBuildConfig,
    defaultModel: dependencies.defaultModel,
    defaultPermissionModeFromConfigDefaults: dependencies.defaultPermissionModeFromConfigDefaults,
    disableAuth: dependencies.disableAuth,
    frontendDiagnosticLogPublicSettings: dependencies.frontendDiagnosticLogPublicSettings,
    getProfileSwitchProgress: dependencies.getProfileSwitchProgress,
    hermesNotificationDelegateService: dependencies.hermesNotificationDelegateService,
    hermesOriginFromRequest: dependencies.hermesOriginFromRequest,
    hermesPluginBaseUrl: dependencies.hermesPluginBaseUrl,
    hermesPluginService: dependencies.hermesPluginService,
    httpStatusError: dependencies.httpStatusError,
    isAccessKeyAuthorized: dependencies.isAccessKeyAuthorized,
    liveQuotaSnapshotForProfiles: dependencies.liveQuotaSnapshotForProfiles,
    loadRecentRateLimitsFromRollouts: dependencies.loadRecentRateLimitsFromRollouts,
    logClientEvent: dependencies.logClientEvent,
    mediaFileService: dependencies.mediaFileService,
    modelOptions: dependencies.modelOptions,
    permissionModeOptions: dependencies.permissionModeOptions,
    platform: dependencies.platform,
    pluginSessionCookieHeader: dependencies.pluginSessionCookieHeader,
    preflightCodexProfileSwitch: dependencies.preflightCodexProfileSwitch,
    profileSwitchLogDetail: dependencies.profileSwitchLogDetail,
    profileSwitchProgressRequestId: dependencies.profileSwitchProgressRequestId,
    publicConfigRuntimeCache: dependencies.publicConfigRuntimeCache,
    publicPrCheckDisabled: dependencies.publicPrCheckDisabled,
    publicPrRepository: dependencies.publicPrRepository,
    publicReleaseBranch: dependencies.publicReleaseBranch,
    publicReleaseCheckDisabled: dependencies.publicReleaseCheckDisabled,
    publicReleaseRepository: dependencies.publicReleaseRepository,
    pushSubscriptionPublicStatus: dependencies.pushSubscriptionPublicStatus,
    rateLimitsByModelObject: dependencies.rateLimitsByModelObject,
    reasoningEffortOptions: dependencies.reasoningEffortOptions,
    remoteManagedWorkspaceRunnerService: dependencies.remoteManagedWorkspaceRunnerService,
    remoteManagedWorkspaceSettingsService: dependencies.remoteManagedWorkspaceSettingsService,
    restartDrainService: dependencies.restartDrainService,
    refreshAppUpdateStatus: dependencies.refreshAppUpdateStatus,
    refreshGitHubLinkPreview: dependencies.refreshGitHubLinkPreview,
    refreshPublicPullRequestStatus: dependencies.refreshPublicPullRequestStatus,
    refreshPublicReleaseStatus: dependencies.refreshPublicReleaseStatus,
    requestAuthToken: dependencies.requestAuthToken,
    requestAuthTokens: dependencies.requestAuthTokens,
    requestBaseUrl: dependencies.requestBaseUrl,
    resolveModelOptions: dependencies.resolveModelOptions,
    rolloutWarningBytes: dependencies.rolloutWarningBytes,
    runtimePressureDiagnostics: dependencies.runtimePressureDiagnostics,
    safeAppUpdateError: dependencies.safeAppUpdateError,
    scheduleBackgroundTask: dependencies.scheduleBackgroundTask,
    scheduleAppRestart: dependencies.scheduleAppRestart,
    setFrontendDiagnosticLogSettings: dependencies.setFrontendDiagnosticLogSettings,
    setProfileSwitchProgress: dependencies.setProfileSwitchProgress,
    setThreadDisplaySettings: dependencies.setThreadDisplaySettings,
    setWorkspaceDelegationEnabled: dependencies.setWorkspaceDelegationEnabled,
    sharedChainRestartDelayMs: dependencies.sharedChainRestartDelayMs,
    sharedChainRestartService: dependencies.sharedChainRestartService,
    syncCodexMobileMcpToolset: dependencies.syncCodexMobileMcpToolset,
    syncKnownCodexMobileMcpToolsets: dependencies.syncKnownCodexMobileMcpToolsets,
    syncRegisteredWorkspaceTrust: dependencies.syncRegisteredWorkspaceTrust,
    threadDisplayPublicSettings: dependencies.threadDisplayPublicSettings,
    threadDetailFirstPaintPrewarmStatus: dependencies.threadDetailFirstPaintPrewarmStatus,
    threadListFallbackPrewarmPublicStatus: dependencies.threadListFallbackPrewarmPublicStatus,
    timingSafeEquals: dependencies.timingSafeEquals,
    userBehaviorRepairCardService: dependencies.userBehaviorRepairCardService,
    viteShellArtifactService: dependencies.viteShellArtifactService,
    workspaceDelegationPublicSettings: dependencies.workspaceDelegationPublicSettings,
    workspaceRegistryService: dependencies.workspaceRegistryService,
  });

  const apiDispatchRouteService = apiDispatchRouteServiceFactory({
    READ_RPC_TIMEOUT_MS: dependencies.READ_RPC_TIMEOUT_MS,
    MAX_THREAD_TURNS: dependencies.MAX_THREAD_TURNS,
    CODEX_HOME: dependencies.CODEX_HOME,
    archiveThreadId: dependencies.archiveThreadId,
    archivedSessionThreadIds: dependencies.archivedSessionThreadIds,
    atLoopRouteService: dependencies.atLoopRouteService,
    attachThreadListStateToResult: dependencies.attachThreadListStateToResult,
    chatGptProBridgeService: dependencies.chatGptProBridgeService,
    chatGptProMcpService: dependencies.chatGptProMcpService,
    chatGptProPlannerService: dependencies.chatGptProPlannerService,
    chatGptProSourceSummary: dependencies.chatGptProSourceSummary,
    clients: dependencies.clients,
    clientHeartbeats: dependencies.clientHeartbeats,
    codex: dependencies.codex,
    compactTurnsListResult: dependencies.compactTurnsListResult,
    coreApiRouteService,
    createContinuationJob: dependencies.createContinuationJob,
    filterThreadListByCwd: dependencies.filterThreadListByCwd,
    filterVisibleThreads: dependencies.filterVisibleThreads,
    getContinuationJob: dependencies.getContinuationJob,
    getUrl,
    handleThreadDetailReadRoute: dependencies.handleThreadDetailReadRoute,
    handleThreadListRoute: dependencies.handleThreadListRoute,
    handleThreadSideChatRoute: dependencies.handleThreadSideChatRoute,
    hydrateThreadListResultTitlesFromSessionIndex: dependencies.hydrateThreadListResultTitlesFromSessionIndex,
    isAuthorized: dependencies.isAuthorized,
    isRecoverableThreadTitleUpdateError: dependencies.isRecoverableThreadTitleUpdateError,
    listWorkspaces: dependencies.listWorkspaces,
    logThreadDetail: dependencies.logThreadDetail,
    logThreadList: dependencies.logThreadList,
    mediaFileService: dependencies.mediaFileService,
    mergeThreadDisplaySummary: dependencies.mergeThreadDisplaySummary,
    mergeThreadSummaryListWithDiagnostics: dependencies.mergeThreadSummaryListWithDiagnostics,
    normalizeFsPath: dependencies.normalizeFsPath,
    normalizeStaleContextOnlyActiveThread: dependencies.normalizeStaleContextOnlyActiveThread,
    normalizeThreadListResultStatuses: dependencies.normalizeThreadListResultStatuses,
    normalizeThreadSummaryLiveStatus: dependencies.normalizeThreadSummaryLiveStatus,
    parseThreadTurnsCursor: dependencies.parseThreadTurnsCursor,
    persistThreadTitleToSessionIndex: dependencies.persistThreadTitleToSessionIndex,
    pruneContinuationJobs: dependencies.pruneContinuationJobs,
    publicContinuationJob: dependencies.publicContinuationJob,
    readBody: dependencies.readBody,
    readGlobalState: dependencies.readGlobalState,
    readMessageBody: dependencies.readMessageBody,
    readRolloutSessionFallbackThread: dependencies.readRolloutSessionFallbackThread,
    readSessionIndexEntries: dependencies.readSessionIndexEntries,
    readStartedThread: dependencies.readStartedThread,
    readStateDbThread: dependencies.readStateDbThread,
    readThreadListCachedFallback: dependencies.readThreadListCachedFallback,
    readThreadListFallback: dependencies.readThreadListFallback,
    remoteManagedWorkspaceCentralSimulator: dependencies.remoteManagedWorkspaceCentralSimulator,
    remoteManagedWorkspaceService: dependencies.remoteManagedWorkspaceService,
    remoteManagedWorkspaceRouteService: dependencies.remoteManagedWorkspaceRouteService,
    rememberStartedThread: dependencies.rememberStartedThread,
    removeEventClient: dependencies.removeEventClient,
    rolloutStatsForPath: dependencies.rolloutStatsForPath,
    runtimePressureDiagnostics: dependencies.runtimePressureDiagnostics,
    runThreadGoalAction: dependencies.runThreadGoalAction,
    scheduleActiveWindowPrewarmFromThreadListResult: dependencies.scheduleActiveWindowPrewarmFromThreadListResult,
    sendJson,
    setThreadGoal: dependencies.setThreadGoal,
    shouldDeferThreadListFallbackForActiveDetail: dependencies.shouldDeferThreadListFallbackForActiveDetail,
    syncKnownCodexMobileMcpToolsets: dependencies.syncKnownCodexMobileMcpToolsets,
    syncRegisteredWorkspaceTrust: dependencies.syncRegisteredWorkspaceTrust,
    syncThreadDetailReadResultToThreadListFallbackCache: dependencies.syncThreadDetailReadResultToThreadListFallbackCache,
    threadDetailReadOrchestrationService: dependencies.threadDetailReadOrchestrationService,
    threadDetailCopyTextService: dependencies.threadDetailCopyTextService,
    threadDisplaySummaryCache: dependencies.threadDisplaySummaryCache,
    threadListDefaultWarmFallbackEnabled: dependencies.threadListDefaultWarmFallbackEnabled,
    threadListFallbackBaselineWorkTimingFields: dependencies.threadListFallbackBaselineWorkTimingFields,
    threadListFallbackSourceDiagnosticTimingFields: dependencies.threadListFallbackSourceDiagnosticTimingFields,
    threadListResponseCoalescer: dependencies.threadListResponseCoalescer,
    threadListTokenUsageTimingFields: dependencies.threadListTokenUsageTimingFields,
    threadMessageRouteService: dependencies.threadMessageRouteService,
    threadSideChatOrchestrationService: dependencies.threadSideChatOrchestrationService,
    threadSideChatService: dependencies.threadSideChatService,
    threadTaskCardRouteService: dependencies.threadTaskCardRouteService,
    tokenUsageStatsService: dependencies.tokenUsageStatsService,
    tokenUsageWorkspaceCwds: dependencies.tokenUsageWorkspaceCwds,
    trackThreadDetailRequestLifecycle: dependencies.trackThreadDetailRequestLifecycle,
    tryUpdateThreadTitle: dependencies.tryUpdateThreadTitle,
    upsertThreadListFallbackCacheThreads: dependencies.upsertThreadListFallbackCacheThreads,
    visibilityFromGlobalState: dependencies.visibilityFromGlobalState,
    webPushRuntimeService: dependencies.webPushRuntimeService,
    workspaceRegistryService: dependencies.workspaceRegistryService,
  });

  const { handleApi, handleEvents } = apiDispatchRouteService;

  async function handleRequest(req, res) {
    try {
      const url = getUrl(req);
      if (url.pathname === "/api/events") {
        handleEvents(req, res);
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res);
        return;
      }
      serveStatic(req, res);
    } catch (err) {
      try {
        sendJson(res, 500, { error: err.message || String(err) });
      } catch (sendErr) {
        logger.error(`[server] failed to send error response: ${sendErr.message || sendErr}`);
      }
    }
  }

  function handleClientError(err, socket) {
    try {
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    } catch (_) {}
    if (err && err.code === "ECONNRESET") return;
    logger.error(`[server] client error: ${err.message || err}`);
  }

  return {
    apiDispatchRouteService,
    coreApiRouteService,
    handleApi,
    handleClientError,
    handleEvents,
    handleRequest,
  };
}

module.exports = {
  createServerRouteCompositionService,
};
