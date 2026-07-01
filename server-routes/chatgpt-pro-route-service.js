"use strict";

function methodValue(input) {
  return String(input.method || (input.req && input.req.method) || "").toUpperCase();
}

function jsonResponse(sendJson, status, body) {
  if (typeof sendJson === "function") sendJson(status, body);
  return { handled: true, status, body };
}

function errorResponse(sendJson, err) {
  return jsonResponse(sendJson, err && err.statusCode || 500, {
    ok: false,
    error: err && err.message || String(err),
  });
}

function createChatGptProRouteService(dependencies = {}) {
  const {
    chatGptProBridgeService,
    chatGptProMcpService,
    chatGptProPlannerService,
    chatGptProSourceSummary,
  } = dependencies;

  async function handleRoute(input = {}) {
    const url = input.url || null;
    const pathname = String(url && url.pathname || "");
    const method = methodValue(input);
    const readBody = typeof input.readBody === "function" ? input.readBody : async () => ({});
    const sendJson = typeof input.sendJson === "function" ? input.sendJson : null;

    if (pathname === "/api/chatgpt-pro/status" && method === "GET") {
      return jsonResponse(sendJson, 200, chatGptProBridgeService.status());
    }

    if (pathname === "/api/chatgpt-pro/planner/status" && method === "GET") {
      return jsonResponse(sendJson, 200, {
        ok: true,
        planner: chatGptProPlannerService.status(),
        mcp: chatGptProMcpService.status(),
      });
    }

    if (pathname === "/api/chatgpt-pro/planner/artifacts" && method === "GET") {
      try {
        return jsonResponse(sendJson, 200, chatGptProPlannerService.listPlannerArtifacts({
          limit: url.searchParams.get("limit") || 20,
          type: url.searchParams.get("type") || "",
          threadId: url.searchParams.get("threadId") || url.searchParams.get("thread_id") || "",
          cwd: url.searchParams.get("cwd") || "",
        }));
      } catch (err) {
        return errorResponse(sendJson, err);
      }
    }

    if (pathname === "/api/chatgpt-pro/planner/artifacts" && method === "POST") {
      try {
        const body = await readBody();
        return jsonResponse(sendJson, 201, { ok: true, artifact: chatGptProPlannerService.createPlannerArtifact(body) });
      } catch (err) {
        return errorResponse(sendJson, err);
      }
    }

    const chatGptPlannerArtifactMatch = pathname.match(/^\/api\/chatgpt-pro\/planner\/artifacts\/([^/]+)$/);
    if (chatGptPlannerArtifactMatch && method === "GET") {
      try {
        return jsonResponse(sendJson, 200, chatGptProPlannerService.readPlannerArtifact({
          id: decodeURIComponent(chatGptPlannerArtifactMatch[1]),
        }));
      } catch (err) {
        return errorResponse(sendJson, err);
      }
    }

    if (pathname === "/api/chatgpt-pro/generate" && method === "POST") {
      try {
        const body = await readBody();
        const prompt = String(body.prompt || body.text || "").trim();
        if (!chatGptProBridgeService.isRequestText(prompt)) {
          return jsonResponse(sendJson, 400, { ok: false, error: "Use @ChatGPT Pro to start a ChatGPT Pro bridge request." });
        }
        const sourceSummary = await chatGptProSourceSummary(body);
        return jsonResponse(sendJson, 202, await chatGptProBridgeService.start(Object.assign({}, body, {
          prompt,
          sourceSummary,
        })));
      } catch (err) {
        return errorResponse(sendJson, err);
      }
    }

    return { handled: false };
  }

  return { handleRoute };
}

module.exports = {
  createChatGptProRouteService,
};
