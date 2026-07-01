"use strict";

function methodValue(input) {
  return String(input.method || (input.req && input.req.method) || "").toUpperCase();
}

function jsonResponse(sendJson, status, body) {
  if (typeof sendJson === "function") sendJson(status, body);
  return { handled: true, status, body };
}

function errorResponse(sendJson, err, okShape = true) {
  const body = okShape
    ? { ok: false, error: err && err.message || String(err) }
    : { error: err && err.message || String(err) };
  return jsonResponse(sendJson, err && err.statusCode || 500, body);
}

function createThreadManagementRouteService(dependencies = {}) {
  const {
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
  } = dependencies;

  async function handleRoute(input = {}) {
    const url = input.url || null;
    const pathname = String(url && url.pathname || "");
    const method = methodValue(input);
    const readBody = typeof input.readBody === "function" ? input.readBody : async () => ({});
    const sendJson = typeof input.sendJson === "function" ? input.sendJson : null;

    const threadArchive = pathname.match(/^\/api\/threads\/([^/]+)\/archive$/);
    if (threadArchive && method === "POST") {
      const threadId = decodeURIComponent(threadArchive[1]);
      const visibility = visibilityFromGlobalState();
      const result = await archiveThreadId(threadId, visibility);
      return jsonResponse(sendJson, 200, result || { archived: true });
    }

    const threadGoal = pathname.match(/^\/api\/threads\/([^/]+)\/goal$/);
    if (threadGoal && method === "POST") {
      try {
        const threadId = decodeURIComponent(threadGoal[1]);
        const body = await readBody();
        return jsonResponse(sendJson, 200, await setThreadGoal(threadId, body));
      } catch (err) {
        return errorResponse(sendJson, err);
      }
    }

    const threadGoalAction = pathname.match(/^\/api\/threads\/([^/]+)\/goal\/actions$/);
    if (threadGoalAction && method === "POST") {
      try {
        const threadId = decodeURIComponent(threadGoalAction[1]);
        const body = await readBody();
        return jsonResponse(sendJson, 200, await runThreadGoalAction(threadId, body));
      } catch (err) {
        return errorResponse(sendJson, err);
      }
    }

    const threadRename = pathname.match(/^\/api\/threads\/([^/]+)\/name$/);
    if (threadRename && (method === "PATCH" || method === "POST")) {
      const threadId = decodeURIComponent(threadRename[1]);
      const body = await readBody();
      const name = String(body.name || body.title || "").trim();
      if (!threadId) {
        return jsonResponse(sendJson, 400, { error: "Thread id is required" });
      }
      if (!name) {
        return jsonResponse(sendJson, 400, { error: "Thread name is required" });
      }
      if (name.length > 120) {
        return jsonResponse(sendJson, 400, { error: "Thread name is too long" });
      }
      try {
        const updated = await tryUpdateThreadTitle(threadId, name);
        const titleIndexed = persistThreadTitleToSessionIndex(threadId, name);
        if (!updated && !titleIndexed) {
          return jsonResponse(sendJson, 501, { error: "Thread rename is not supported by this app-server" });
        }
        rememberStartedThread(Object.assign({}, readStartedThread(threadId) || readRolloutSessionFallbackThread(threadId) || {}, {
          id: threadId,
          name,
          preview: name,
          status: { type: "notLoaded" },
        }));
        return jsonResponse(sendJson, 200, {
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
            return jsonResponse(sendJson, 200, {
              ok: true,
              threadId,
              name,
              titleUpdated: false,
              titleIndexed,
              warning: "Thread rename was stored in the Mobile fallback index; app-server title update is temporarily unavailable.",
            });
          }
        }
        return errorResponse(sendJson, err, false);
      }
    }

    const threadTurns = pathname.match(/^\/api\/threads\/([^/]+)\/turns$/);
    if (threadTurns && method === "GET") {
      const threadId = decodeURIComponent(threadTurns[1]);
      const summary = readStateDbThread(threadId) || readStartedThread(threadId) || readRolloutSessionFallbackThread(threadId) || null;
      const cursor = parseThreadTurnsCursor(url.searchParams.get("cursor"));
      const params = {
        threadId,
        limit: Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || String(MAX_THREAD_TURNS)))),
        sortDirection: url.searchParams.get("sortDirection") || "asc",
      };
      if (cursor) params.cursor = cursor;
      return jsonResponse(sendJson, 200, compactTurnsListResult(
        await codex.request("thread/turns/list", params, { timeoutMs: READ_RPC_TIMEOUT_MS, retry: false, resetOnTimeout: false }),
        { threadId, summary },
      ));
    }

    return { handled: false };
  }

  return { handleRoute };
}

module.exports = {
  createThreadManagementRouteService,
};
