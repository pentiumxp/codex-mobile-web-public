"use strict";

function methodValue(input) {
  return String(input.method || (input.req && input.req.method) || "").toUpperCase();
}

function jsonResponse(sendJson, status, body) {
  if (typeof sendJson === "function") sendJson(status, body);
  return { handled: true, status, body };
}

function createThreadContinuationRouteService(dependencies = {}) {
  const {
    createContinuationJob,
    getContinuationJob,
    publicContinuationJob,
  } = dependencies;

  async function handleRoute(input = {}) {
    const url = input.url || null;
    const pathname = String(url && url.pathname || "");
    const method = methodValue(input);
    const readBody = typeof input.readBody === "function" ? input.readBody : async () => ({});
    const sendJson = typeof input.sendJson === "function" ? input.sendJson : null;

    if (pathname === "/api/thread-continuations" && method === "POST") {
      const body = await readBody();
      const job = createContinuationJob(body);
      return jsonResponse(sendJson, 202, publicContinuationJob(job));
    }

    const continuationJobMatch = pathname.match(/^\/api\/thread-continuations\/([^/]+)$/);
    if (continuationJobMatch && method === "GET") {
      const jobId = decodeURIComponent(continuationJobMatch[1]);
      const job = getContinuationJob(jobId);
      if (!job) {
        return jsonResponse(sendJson, 404, { error: "Continuation job not found" });
      }
      return jsonResponse(sendJson, 200, publicContinuationJob(job));
    }

    return { handled: false };
  }

  return { handleRoute };
}

module.exports = {
  createThreadContinuationRouteService,
};
