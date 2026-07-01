"use strict";

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
    if (url.pathname === "/api/workspaces" && req.method === "GET") {
      sendJson(res, 200, { data: await listWorkspaces() });
      return;
    }
    if (url.pathname === "/api/workspaces" && req.method === "POST") {
      try {
        const body = await readBody(req);
        const requestedCwd = String(body && (body.cwd || body.path || body.workspace) || "").trim();
        const created = requestedCwd
          ? workspaceRegistryService.registerExisting(body)
          : workspaceRegistryService.create(body);
        syncRegisteredWorkspaceTrust(CODEX_HOME);
        syncKnownCodexMobileMcpToolsets();
        sendJson(res, 200, created);
      } catch (err) {
        sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return;
    }
    if (url.pathname === "/api/thread-continuations" && req.method === "POST") {
      const body = await readBody(req);
      const job = createContinuationJob(body);
      sendJson(res, 202, publicContinuationJob(job));
      return;
    }
    if (url.pathname === "/api/chatgpt-pro/status" && req.method === "GET") {
      sendJson(res, 200, chatGptProBridgeService.status());
      return;
    }
    if (url.pathname === "/api/chatgpt-pro/planner/status" && req.method === "GET") {
      sendJson(res, 200, {
        ok: true,
        planner: chatGptProPlannerService.status(),
        mcp: chatGptProMcpService.status(),
      });
      return;
    }
    if (url.pathname === "/api/chatgpt-pro/planner/artifacts" && req.method === "GET") {
      try {
        sendJson(res, 200, chatGptProPlannerService.listPlannerArtifacts({
          limit: url.searchParams.get("limit") || 20,
          type: url.searchParams.get("type") || "",
          threadId: url.searchParams.get("threadId") || url.searchParams.get("thread_id") || "",
          cwd: url.searchParams.get("cwd") || "",
        }));
      } catch (err) {
        sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return;
    }
    if (url.pathname === "/api/chatgpt-pro/planner/artifacts" && req.method === "POST") {
      try {
        const body = await readBody(req);
        sendJson(res, 201, { ok: true, artifact: chatGptProPlannerService.createPlannerArtifact(body) });
      } catch (err) {
        sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return;
    }
    const chatGptPlannerArtifactMatch = url.pathname.match(/^\/api\/chatgpt-pro\/planner\/artifacts\/([^/]+)$/);
    if (chatGptPlannerArtifactMatch && req.method === "GET") {
      try {
        sendJson(res, 200, chatGptProPlannerService.readPlannerArtifact({
          id: decodeURIComponent(chatGptPlannerArtifactMatch[1]),
        }));
      } catch (err) {
        sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return;
    }
    if (url.pathname === "/api/chatgpt-pro/generate" && req.method === "POST") {
      try {
        const body = await readBody(req);
        const prompt = String(body.prompt || body.text || "").trim();
        if (!chatGptProBridgeService.isRequestText(prompt)) {
          sendJson(res, 400, { ok: false, error: "Use @ChatGPT Pro to start a ChatGPT Pro bridge request." });
          return;
        }
        const sourceSummary = await chatGptProSourceSummary(body);
        sendJson(res, 202, await chatGptProBridgeService.start(Object.assign({}, body, {
          prompt,
          sourceSummary,
        })));
      } catch (err) {
        sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return;
    }
    const continuationJobMatch = url.pathname.match(/^\/api\/thread-continuations\/([^/]+)$/);
    if (continuationJobMatch && req.method === "GET") {
      pruneContinuationJobs();
      const jobId = decodeURIComponent(continuationJobMatch[1]);
      const job = getContinuationJob(jobId);
      if (!job) {
        sendJson(res, 404, { error: "Continuation job not found" });
        return;
      }
      sendJson(res, 200, publicContinuationJob(job));
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
    const threadArchive = url.pathname.match(/^\/api\/threads\/([^/]+)\/archive$/);
    if (threadArchive && req.method === "POST") {
      const threadId = decodeURIComponent(threadArchive[1]);
      const visibility = visibilityFromGlobalState();
      const result = await archiveThreadId(threadId, visibility);
      sendJson(res, 200, result || { archived: true });
      return;
    }
    const threadGoal = url.pathname.match(/^\/api\/threads\/([^/]+)\/goal$/);
    if (threadGoal && req.method === "POST") {
      try {
        const threadId = decodeURIComponent(threadGoal[1]);
        const body = await readBody(req);
        sendJson(res, 200, await setThreadGoal(threadId, body));
      } catch (err) {
        sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return;
    }
    const threadGoalAction = url.pathname.match(/^\/api\/threads\/([^/]+)\/goal\/actions$/);
    if (threadGoalAction && req.method === "POST") {
      try {
        const threadId = decodeURIComponent(threadGoalAction[1]);
        const body = await readBody(req);
        sendJson(res, 200, await runThreadGoalAction(threadId, body));
      } catch (err) {
        sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
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
    const threadRename = url.pathname.match(/^\/api\/threads\/([^/]+)\/name$/);
    if (threadRename && (req.method === "PATCH" || req.method === "POST")) {
      const threadId = decodeURIComponent(threadRename[1]);
      const body = await readBody(req);
      const name = String(body.name || body.title || "").trim();
      if (!threadId) {
        sendJson(res, 400, { error: "Thread id is required" });
        return;
      }
      if (!name) {
        sendJson(res, 400, { error: "Thread name is required" });
        return;
      }
      if (name.length > 120) {
        sendJson(res, 400, { error: "Thread name is too long" });
        return;
      }
      try {
        const updated = await tryUpdateThreadTitle(threadId, name);
        const titleIndexed = persistThreadTitleToSessionIndex(threadId, name);
        if (!updated && !titleIndexed) {
          sendJson(res, 501, { error: "Thread rename is not supported by this app-server" });
          return;
        }
        rememberStartedThread(Object.assign({}, readStartedThread(threadId) || readRolloutSessionFallbackThread(threadId) || {}, {
          id: threadId,
          name,
          preview: name,
          status: { type: "notLoaded" },
        }));
        sendJson(res, 200, {
          ok: true,
          threadId,
          name,
          titleUpdated: updated,
          titleIndexed,
          warning: updated ? "" : "Thread rename was stored in the Mobile fallback index; app-server rename is unavailable.",
        });
      } catch (err) {
        if (isRecoverableThreadTitleUpdateError(err)) {
          const titleIndexed = persistThreadTitleToSessionIndex(threadId, name);
          if (titleIndexed) {
            rememberStartedThread(Object.assign({}, readStartedThread(threadId) || readRolloutSessionFallbackThread(threadId) || {}, {
              id: threadId,
              name,
              preview: name,
              status: { type: "notLoaded" },
            }));
            sendJson(res, 200, {
              ok: true,
              threadId,
              name,
              titleUpdated: false,
              titleIndexed,
              warning: "Thread rename was stored in the Mobile fallback index; app-server title update is temporarily unavailable.",
            });
            return;
          }
        }
        sendJson(res, err.statusCode || 500, { error: err.message || String(err) });
      }
      return;
    }
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
    const threadTurns = url.pathname.match(/^\/api\/threads\/([^/]+)\/turns$/);
    if (threadTurns && req.method === "GET") {
      const threadId = decodeURIComponent(threadTurns[1]);
      const summary = readStateDbThread(threadId) || readStartedThread(threadId) || readRolloutSessionFallbackThread(threadId) || null;
      const cursor = parseThreadTurnsCursor(url.searchParams.get("cursor"));
      const params = {
        threadId,
        limit: Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || String(MAX_THREAD_TURNS)))),
        sortDirection: url.searchParams.get("sortDirection") || "asc",
      };
      if (cursor) params.cursor = cursor;
      sendJson(res, 200, compactTurnsListResult(
        await codex.request("thread/turns/list", params, { timeoutMs: READ_RPC_TIMEOUT_MS, retry: false, resetOnTimeout: false }),
        { threadId, summary },
      ));
      return;
    }
    sendJson(res, 404, { error: "Not found" });
  }

  function handleEvents(req, res) {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }
    const url = getUrl(req);
    const client = {
      threadId: String(url.searchParams.get("threadId") || ""),
    };
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(`data: ${JSON.stringify({ type: "status", status: codex.status() })}\n\n`);
    for (const request of codex.pendingServerRequests()) {
      res.write(`data: ${JSON.stringify({ type: "serverRequest", request })}\n\n`);
    }
    clients.set(res, client);
    const heartbeat = setInterval(() => {
      try {
        if (res.destroyed || res.writableEnded || !res.write(": keepalive\n\n")) {
          removeEventClient(res);
        }
      } catch (_) {
        removeEventClient(res);
      }
    }, 25000);
    clientHeartbeats.set(res, heartbeat);
    req.on("close", () => {
      removeEventClient(res);
    });
  }

  return {
    handleApi,
    handleEvents,
  };
}

module.exports = {
  createApiDispatchRouteService,
};
