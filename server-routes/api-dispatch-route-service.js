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
  createThreadCopyTextRouteService,
} = require("./thread-copy-text-route-service");
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
  const atLoopRouteService = dependencies.atLoopRouteService;
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
  const threadDetailCopyTextService = dependencies.threadDetailCopyTextService;
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
    normalizeFsPath,
    tokenUsageWorkspaceCwds,
    workspaceRegistryService,
    syncRegisteredWorkspaceTrust,
    syncKnownCodexMobileMcpToolsets,
  });
  const threadContinuationRouteService = createThreadContinuationRouteService({
    createContinuationJob,
    getContinuationJob,
    publicContinuationJob,
  });
  const threadCopyTextRouteService = createThreadCopyTextRouteService({
    threadDetailCopyTextService,
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
    const startedAt = Date.now();
    let responseRecorded = false;
    function trackedSendJson(status, body, headers) {
      if (!responseRecorded && dependencies.runtimePressureDiagnostics && typeof dependencies.runtimePressureDiagnostics.recordRoute === "function") {
        responseRecorded = true;
        let responseBytes = 0;
        try {
          responseBytes = Buffer.byteLength(JSON.stringify(body));
        } catch (_) {}
        dependencies.runtimePressureDiagnostics.recordRoute({
          method: req.method,
          path: url.pathname,
          status,
          elapsedMs: Date.now() - startedAt,
          responseBytes,
          responseObjectCount: typeof dependencies.runtimePressureDiagnostics.responseObjectCount === "function"
            ? dependencies.runtimePressureDiagnostics.responseObjectCount(body)
            : 0,
        });
      }
      return sendJson(res, status, body, headers);
    }
    const publicCoreRouteResult = await coreApiRouteService.handlePublicRoute({
      url,
      req,
      res,
      readBody: () => readBody(req),
      sendJson: trackedSendJson,
    });
    if (publicCoreRouteResult.handled) return;
    if (!isAuthorized(req)) {
      trackedSendJson(401, { error: "Unauthorized" });
      return;
    }
    const authorizedCoreRouteResult = await coreApiRouteService.handleAuthorizedRoute({
      url,
      req,
      res,
      readBody: () => readBody(req),
      sendJson: trackedSendJson,
    });
    if (authorizedCoreRouteResult.handled) return;
    const webPushRouteResult = await webPushRuntimeService.handleRoute({
      url,
      method: req.method,
      req,
      readBody: () => readBody(req),
      sendJson: trackedSendJson,
    });
    if (webPushRouteResult.handled) {
      return;
    }
    const mediaFileRouteResult = await mediaFileService.handleMediaFileRoute({
      url,
      method: req.method,
      req,
      res,
      sendJson: trackedSendJson,
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
      sendJson: trackedSendJson,
    });
    if (threadSideChatRouteResult.handled) {
      return;
    }
    if (atLoopRouteService && typeof atLoopRouteService.handleRoute === "function") {
      const atLoopRouteResult = await atLoopRouteService.handleRoute({
        url,
        method: req.method,
        readBody: () => readBody(req),
        sendJson: trackedSendJson,
      });
      if (atLoopRouteResult.handled) {
        return;
      }
    }
    const threadTaskCardRouteResult = await threadTaskCardRouteService.handleRoute({
      url,
      method: req.method,
      readBody: () => readBody(req),
      sendJson: trackedSendJson,
    });
    if (threadTaskCardRouteResult.handled) {
      return;
    }
    const workspaceRouteResult = await workspaceRouteService.handleRoute({
      url,
      method: req.method,
      readBody: () => readBody(req),
      sendJson: trackedSendJson,
    });
    if (workspaceRouteResult.handled) {
      return;
    }
    const threadContinuationRouteResult = await threadContinuationRouteService.handleRoute({
      url,
      method: req.method,
      readBody: () => readBody(req),
      sendJson: trackedSendJson,
    });
    if (threadContinuationRouteResult.handled) {
      return;
    }
    const chatGptProRouteResult = await chatGptProRouteService.handleRoute({
      url,
      method: req.method,
      readBody: () => readBody(req),
      sendJson: trackedSendJson,
    });
    if (chatGptProRouteResult.handled) {
      return;
    }
    const threadMessageRouteResult = await threadMessageRouteService.handleRoute({
      url,
      method: req.method,
      readBody: () => readBody(req),
      readMessageBody: (threadId) => readMessageBody(req, threadId),
      sendJson: trackedSendJson,
    });
    if (threadMessageRouteResult.handled) {
      return;
    }
    const threadCopyTextRouteResult = await threadCopyTextRouteService.handleRoute({
      url,
      method: req.method,
      sendJson: trackedSendJson,
    });
    if (threadCopyTextRouteResult.handled) {
      return;
    }
    const threadManagementRouteResult = await threadManagementRouteService.handleRoute({
      url,
      method: req.method,
      readBody: () => readBody(req),
      sendJson: trackedSendJson,
    });
    if (threadManagementRouteResult.handled) {
      return;
    }
    const threadListRouteResult = await handleThreadListRoute({
      url,
      method: req.method,
      sendJson: trackedSendJson,
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
        sendJson: trackedSendJson,
        onThreadDetailReadResult: (payload) => syncThreadDetailReadResultToThreadListFallbackCache(payload),
        logThreadDetail,
      });
      return;
    }
    trackedSendJson(404, { error: "Not found" });
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
