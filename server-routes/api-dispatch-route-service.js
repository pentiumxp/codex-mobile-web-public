"use strict";

const {
  createChatGptProRouteService,
} = require("./chatgpt-pro-route-service");
const {
  createEventStreamRouteService,
} = require("./event-stream-route-service");
const {
  createThreadContinuationRouteService,
} = require("./thread-continuation-route-service");
const {
  createThreadManagementRouteService,
} = require("./thread-management-route-service");
const {
  createWorkspaceRouteService,
} = require("./workspace-route-service");

function createApiDispatchRouteService(dependencies = {}) {
  const READ_RPC_TIMEOUT_MS = dependencies.READ_RPC_TIMEOUT_MS;
  const MAX_THREAD_TURNS = dependencies.MAX_THREAD_TURNS;
  const CODEX_HOME = dependencies.CODEX_HOME;
  const archiveThreadId = dependencies.archiveThreadId;
  const archivedSessionThreadIds = dependencies.archivedSessionThreadIds;
  const attachThreadListStateToResult = dependencies.attachThreadListStateToResult;
  const chatGptProBridgeService = dependencies.chatGptProBridgeService;
  const chatGptProMcpService = dependencies.chatGptProMcpService;
  const chatGptProPlannerService = dependencies.chatGptProPlannerService;
  const chatGptProSourceSummary = dependencies.chatGptProSourceSummary;
  const clients = dependencies.clients;
  const clientHeartbeats = dependencies.clientHeartbeats;
  const codex = dependencies.codex;
  const compactTurnsListResult = dependencies.compactTurnsListResult;
  const coreApiRouteService = dependencies.coreApiRouteService;
  const createContinuationJob = dependencies.createContinuationJob;
  const filterThreadListByCwd = dependencies.filterThreadListByCwd;
  const filterVisibleThreads = dependencies.filterVisibleThreads;
  const getContinuationJob = dependencies.getContinuationJob;
  const getUrl = dependencies.getUrl;
  const handleThreadDetailReadRoute = dependencies.handleThreadDetailReadRoute;
  const handleThreadListRoute = dependencies.handleThreadListRoute;
  const handleThreadSideChatRoute = dependencies.handleThreadSideChatRoute;
  const hydrateThreadListResultTitlesFromSessionIndex = dependencies.hydrateThreadListResultTitlesFromSessionIndex;
  const isAuthorized = dependencies.isAuthorized;
  const isRecoverableThreadTitleUpdateError = dependencies.isRecoverableThreadTitleUpdateError;
  const listWorkspaces = dependencies.listWorkspaces;
  const logThreadDetail = dependencies.logThreadDetail;
  const logThreadList = dependencies.logThreadList;
  const mediaFileService = dependencies.mediaFileService;
  const mergeThreadDisplaySummary = dependencies.mergeThreadDisplaySummary;
  const mergeThreadSummaryListWithDiagnostics = dependencies.mergeThreadSummaryListWithDiagnostics;
  const normalizeFsPath = dependencies.normalizeFsPath;
  const normalizeStaleContextOnlyActiveThread = dependencies.normalizeStaleContextOnlyActiveThread;
  const normalizeThreadListResultStatuses = dependencies.normalizeThreadListResultStatuses;
  const normalizeThreadSummaryLiveStatus = dependencies.normalizeThreadSummaryLiveStatus;
  const parseThreadTurnsCursor = dependencies.parseThreadTurnsCursor;
  const persistThreadTitleToSessionIndex = dependencies.persistThreadTitleToSessionIndex;
  const pruneContinuationJobs = dependencies.pruneContinuationJobs;
  const publicContinuationJob = dependencies.publicContinuationJob;
  const readBody = dependencies.readBody;
  const readGlobalState = dependencies.readGlobalState;
  const readMessageBody = dependencies.readMessageBody;
  const readRolloutSessionFallbackThread = dependencies.readRolloutSessionFallbackThread;
  const readSessionIndexEntries = dependencies.readSessionIndexEntries;
  const readStartedThread = dependencies.readStartedThread;
  const readStateDbThread = dependencies.readStateDbThread;
  const readThreadListCachedFallback = dependencies.readThreadListCachedFallback;
  const readThreadListFallback = dependencies.readThreadListFallback;
  const rememberStartedThread = dependencies.rememberStartedThread;
  const removeEventClient = dependencies.removeEventClient;
  const rolloutStatsForPath = dependencies.rolloutStatsForPath;
  const runThreadGoalAction = dependencies.runThreadGoalAction;
  const scheduleActiveWindowPrewarmFromThreadListResult = dependencies.scheduleActiveWindowPrewarmFromThreadListResult;
  const sendJson = dependencies.sendJson;
  const setThreadGoal = dependencies.setThreadGoal;
  const shouldDeferThreadListFallbackForActiveDetail = dependencies.shouldDeferThreadListFallbackForActiveDetail;
  const syncKnownCodexMobileMcpToolsets = dependencies.syncKnownCodexMobileMcpToolsets;
  const syncRegisteredWorkspaceTrust = dependencies.syncRegisteredWorkspaceTrust;
  const syncThreadDetailReadResultToThreadListFallbackCache = dependencies.syncThreadDetailReadResultToThreadListFallbackCache;
  const threadDetailReadOrchestrationService = dependencies.threadDetailReadOrchestrationService;
  const threadDisplaySummaryCache = dependencies.threadDisplaySummaryCache;
  const threadListDefaultWarmFallbackEnabled = dependencies.threadListDefaultWarmFallbackEnabled;
  const threadListFallbackBaselineWorkTimingFields = dependencies.threadListFallbackBaselineWorkTimingFields;
  const threadListFallbackSourceDiagnosticTimingFields = dependencies.threadListFallbackSourceDiagnosticTimingFields;
  const threadListResponseCoalescer = dependencies.threadListResponseCoalescer;
  const threadListTokenUsageTimingFields = dependencies.threadListTokenUsageTimingFields;
  const threadMessageRouteService = dependencies.threadMessageRouteService;
  const threadSideChatOrchestrationService = dependencies.threadSideChatOrchestrationService;
  const threadSideChatService = dependencies.threadSideChatService;
  const threadTaskCardRouteService = dependencies.threadTaskCardRouteService;
  const tokenUsageStatsService = dependencies.tokenUsageStatsService;
  const tokenUsageWorkspaceCwds = dependencies.tokenUsageWorkspaceCwds;
  const trackThreadDetailRequestLifecycle = dependencies.trackThreadDetailRequestLifecycle;
  const tryUpdateThreadTitle = dependencies.tryUpdateThreadTitle;
  const upsertThreadListFallbackCacheThreads = dependencies.upsertThreadListFallbackCacheThreads;
  const visibilityFromGlobalState = dependencies.visibilityFromGlobalState;
  const webPushRuntimeService = dependencies.webPushRuntimeService;
  const workspaceRegistryService = dependencies.workspaceRegistryService;
  const workspaceRouteService = createWorkspaceRouteService({
    CODEX_HOME,
    listWorkspaces,
    workspaceRegistryService,
    syncRegisteredWorkspaceTrust,
    syncKnownCodexMobileMcpToolsets,
  });
  const threadContinuationRouteService = createThreadContinuationRouteService({
    createContinuationJob,
    getContinuationJob,
    pruneContinuationJobs,
    publicContinuationJob,
  });
  const chatGptProRouteService = createChatGptProRouteService({
    chatGptProBridgeService,
    chatGptProMcpService,
    chatGptProPlannerService,
    chatGptProSourceSummary,
  });
  const threadManagementRouteService = createThreadManagementRouteService({
    MAX_THREAD_TURNS,
    READ_RPC_TIMEOUT_MS,
    archiveThreadId,
    codex,
    compactTurnsListResult,
    isRecoverableThreadTitleUpdateError,
    parseThreadTurnsCursor,
    persistThreadTitleToSessionIndex,
    readRolloutSessionFallbackThread,
    readStartedThread,
    readStateDbThread,
    rememberStartedThread,
    runThreadGoalAction,
    setThreadGoal,
    tryUpdateThreadTitle,
    visibilityFromGlobalState,
  });
  const eventStreamRouteService = createEventStreamRouteService({
    clientHeartbeats,
    clients,
    codex,
    getUrl,
    isAuthorized,
    removeEventClient,
    sendJson,
  });

  async function handleApi(req, res) {
    const url = getUrl(req);
    const publicCoreRouteResult = await coreApiRouteService.handlePublicRoute({
      url,
      req,
      res,
      readBody: () => readBody(req),
      sendJson: (status, body, headers) => sendJson(res, status, body, headers),
    });
    if (publicCoreRouteResult.handled) return;
    if (!isAuthorized(req)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }
    const authorizedCoreRouteResult = await coreApiRouteService.handleAuthorizedRoute({
      url,
      req,
      res,
      readBody: () => readBody(req),
      sendJson: (status, body, headers) => sendJson(res, status, body, headers),
    });
    if (authorizedCoreRouteResult.handled) return;
    const webPushRouteResult = await webPushRuntimeService.handleRoute({
      url,
      method: req.method,
      req,
      readBody: () => readBody(req),
      sendJson: (status, body) => sendJson(res, status, body),
    });
    if (webPushRouteResult.handled) {
      return;
    }
    const mediaFileRouteResult = await mediaFileService.handleMediaFileRoute({
      url,
      method: req.method,
      req,
      res,
      sendJson: (status, body) => sendJson(res, status, body),
    });
    if (mediaFileRouteResult.handled) {
      return;
    }
    const threadSideChatRouteResult = await handleThreadSideChatRoute({
      url,
      method: req.method,
      readBody: () => readBody(req),
      threadSideChatService,
      orchestrationService: threadSideChatOrchestrationService,
      sendJson: (status, body) => sendJson(res, status, body),
    });
    if (threadSideChatRouteResult.handled) {
      return;
    }
    const threadTaskCardRouteResult = await threadTaskCardRouteService.handleRoute({
      url,
      method: req.method,
      readBody: () => readBody(req),
      sendJson: (status, body) => sendJson(res, status, body),
    });
    if (threadTaskCardRouteResult.handled) {
      return;
    }
    const workspaceRouteResult = await workspaceRouteService.handleRoute({
      url,
      method: req.method,
      readBody: () => readBody(req),
      sendJson: (status, body) => sendJson(res, status, body),
    });
    if (workspaceRouteResult.handled) {
      return;
    }
    const threadContinuationRouteResult = await threadContinuationRouteService.handleRoute({
      url,
      method: req.method,
      readBody: () => readBody(req),
      sendJson: (status, body) => sendJson(res, status, body),
    });
    if (threadContinuationRouteResult.handled) {
      return;
    }
    const chatGptProRouteResult = await chatGptProRouteService.handleRoute({
      url,
      method: req.method,
      readBody: () => readBody(req),
      sendJson: (status, body) => sendJson(res, status, body),
    });
    if (chatGptProRouteResult.handled) {
      return;
    }
    const threadMessageRouteResult = await threadMessageRouteService.handleRoute({
      url,
      method: req.method,
      readBody: () => readBody(req),
      readMessageBody: (threadId) => readMessageBody(req, threadId),
      sendJson: (status, body) => sendJson(res, status, body),
    });
    if (threadMessageRouteResult.handled) {
      return;
    }
    const threadManagementRouteResult = await threadManagementRouteService.handleRoute({
      url,
      method: req.method,
      readBody: () => readBody(req),
      sendJson: (status, body) => sendJson(res, status, body),
    });
    if (threadManagementRouteResult.handled) {
      return;
    }
    const threadListRouteResult = await handleThreadListRoute({
      url,
      method: req.method,
      sendJson: (status, body, headers) => sendJson(res, status, body, headers),
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
      readRpcTimeoutMs: READ_RPC_TIMEOUT_MS,
    });
    if (threadListRouteResult.handled) return;
    const threadRead = url.pathname.match(/^\/api\/threads\/([^/]+)$/);
    if (threadRead && req.method === "GET") {
      trackThreadDetailRequestLifecycle(res);
      const threadId = decodeURIComponent(threadRead[1]);
      await handleThreadDetailReadRoute({
        codex,
        threadId,
        url,
        readThreadDetail: (request) => threadDetailReadOrchestrationService.readThreadDetail(request),
        sendJson: (status, body) => sendJson(res, status, body),
        onThreadDetailReadResult: (payload) => syncThreadDetailReadResultToThreadListFallbackCache(payload),
        logThreadDetail,
      });
      return;
    }
    sendJson(res, 404, { error: "Not found" });
  }

  function handleEvents(req, res) {
    eventStreamRouteService.handleEvents(req, res);
  }

  return {
    handleApi,
    handleEvents,
  };
}

module.exports = {
  createApiDispatchRouteService,
};
