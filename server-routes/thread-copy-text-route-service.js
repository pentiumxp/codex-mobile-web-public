"use strict";

function methodValue(input) {
  return String(input.method || (input.req && input.req.method) || "").toUpperCase();
}

function jsonResponse(sendJson, status, body) {
  if (typeof sendJson === "function") sendJson(status, body);
  return { handled: true, status, body };
}

function createThreadCopyTextRouteService(dependencies = {}) {
  const threadDetailCopyTextService = dependencies.threadDetailCopyTextService || null;

  async function handleRoute(input = {}) {
    const url = input.url || null;
    const pathname = String(url && url.pathname || "");
    const method = methodValue(input);
    const sendJson = typeof input.sendJson === "function" ? input.sendJson : null;

    const threadCopyText = pathname.match(/^\/api\/threads\/([^/]+)\/copy-text$/);
    if (threadCopyText && method === "GET") {
      const threadId = decodeURIComponent(threadCopyText[1]);
      const itemId = String(url.searchParams.get("itemId") || "").trim();
      const turnId = String(url.searchParams.get("turnId") || "").trim();
      if (!itemId) {
        return jsonResponse(sendJson, 400, { ok: false, error: "itemId is required" });
      }
      if (!threadDetailCopyTextService || typeof threadDetailCopyTextService.readThreadItemCopyText !== "function") {
        return jsonResponse(sendJson, 500, { ok: false, error: "thread_detail_copy_text_service_unavailable" });
      }
      try {
        const result = await threadDetailCopyTextService.readThreadItemCopyText(threadId, { itemId, turnId });
        if (!result || !result.text) {
          return jsonResponse(sendJson, 404, { ok: false, error: "Copy text item not found" });
        }
        return jsonResponse(sendJson, 200, Object.assign({ ok: true, threadId }, result));
      } catch (err) {
        return jsonResponse(sendJson, err && err.statusCode || 500, { ok: false, error: err && err.message || String(err) });
      }
    }

    return { handled: false };
  }

  return { handleRoute };
}

module.exports = {
  createThreadCopyTextRouteService,
};
