"use strict";

function methodValue(input) {
  return String(input.method || (input.req && input.req.method) || "").toUpperCase();
}

function jsonResponse(sendJson, status, body) {
  if (typeof sendJson === "function") sendJson(status, body);
  return { handled: true, status, body };
}

async function readJsonBody(readBody) {
  if (typeof readBody !== "function") return {};
  const body = await readBody();
  if (!body) return {};
  if (typeof body === "object") return body;
  try {
    return JSON.parse(String(body));
  } catch (_) {
    return {};
  }
}

function createAtLoopRouteService(dependencies = {}) {
  const atLoopRuntimeService = dependencies.atLoopRuntimeService || null;

  async function handleRoute(input = {}) {
    const url = input.url || null;
    const pathname = String(url && url.pathname || "");
    const method = methodValue(input);
    const sendJson = typeof input.sendJson === "function" ? input.sendJson : null;
    if (!pathname.startsWith("/api/at-loop")) return { handled: false };
    if (!atLoopRuntimeService) {
      return jsonResponse(sendJson, 503, { ok: false, error: "at_loop_runtime_unavailable" });
    }

    try {
      if (pathname === "/api/at-loop/triggers" && method === "POST") {
        const body = await readJsonBody(input.readBody);
        const result = await atLoopRuntimeService.startLoop(body);
        return jsonResponse(sendJson, result.ok === false ? 400 : 200, result);
      }
      if (pathname === "/api/at-loop/status" && method === "GET") {
        return jsonResponse(sendJson, 200, atLoopRuntimeService.status({}));
      }
      const statusMatch = pathname.match(/^\/api\/at-loop\/status\/([^/]+)$/);
      if (statusMatch && method === "GET") {
        const result = atLoopRuntimeService.status({ loopId: decodeURIComponent(statusMatch[1]) });
        return jsonResponse(sendJson, result.loopCount ? 200 : 404, result.loopCount ? result : Object.assign({}, result, { ok: false, error: "at_loop_not_found" }));
      }
      if (pathname === "/api/at-loop/returns" && method === "POST") {
        const body = await readJsonBody(input.readBody);
        const result = await atLoopRuntimeService.recordTerminalReturn(body);
        return jsonResponse(sendJson, result.ok === false ? 400 : 200, result);
      }
      if (pathname === "/api/at-loop/source-requirements/start" && method === "POST") {
        const body = await readJsonBody(input.readBody);
        if (!atLoopRuntimeService || typeof atLoopRuntimeService.startSourceRequirementsForLoop !== "function") {
          return jsonResponse(sendJson, 503, { ok: false, error: "at_loop_source_requirements_unavailable" });
        }
        const result = await atLoopRuntimeService.startSourceRequirementsForLoop(body);
        return jsonResponse(sendJson, result.ok === false ? 400 : 200, result);
      }
      if (pathname === "/api/at-loop/watchdog" && method === "POST") {
        const body = await readJsonBody(input.readBody);
        return jsonResponse(sendJson, 200, atLoopRuntimeService.runWatchdog(body));
      }
      return jsonResponse(sendJson, 404, { ok: false, error: "at_loop_route_not_found" });
    } catch (err) {
      return jsonResponse(sendJson, err && err.statusCode || 500, {
        ok: false,
        error: err && err.message || String(err),
      });
    }
  }

  return { handleRoute };
}

module.exports = {
  createAtLoopRouteService,
};
