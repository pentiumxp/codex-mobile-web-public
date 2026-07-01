"use strict";

function createEventStreamRouteService(dependencies = {}) {
  const {
    clientHeartbeats,
    clients,
    codex,
    getUrl,
    isAuthorized,
    removeEventClient,
    sendJson,
  } = dependencies;

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
    handleEvents,
  };
}

module.exports = {
  createEventStreamRouteService,
};
