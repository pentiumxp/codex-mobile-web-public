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

function createWorkspaceRouteService(dependencies = {}) {
  const {
    CODEX_HOME,
    listWorkspaces,
    workspaceRegistryService,
    syncRegisteredWorkspaceTrust,
    syncKnownCodexMobileMcpToolsets,
  } = dependencies;

  async function handleRoute(input = {}) {
    const url = input.url || null;
    const pathname = String(url && url.pathname || "");
    const method = methodValue(input);
    const readBody = typeof input.readBody === "function" ? input.readBody : async () => ({});
    const sendJson = typeof input.sendJson === "function" ? input.sendJson : null;

    if (pathname === "/api/workspaces" && method === "GET") {
      return jsonResponse(sendJson, 200, { data: await listWorkspaces() });
    }

    if (pathname === "/api/workspaces" && method === "POST") {
      try {
        const body = await readBody();
        const requestedCwd = String(body && (body.cwd || body.path || body.workspace) || "").trim();
        const created = requestedCwd
          ? workspaceRegistryService.registerExisting(body)
          : workspaceRegistryService.create(body);
        syncRegisteredWorkspaceTrust(CODEX_HOME);
        syncKnownCodexMobileMcpToolsets();
        return jsonResponse(sendJson, 200, created);
      } catch (err) {
        return errorResponse(sendJson, err);
      }
    }

    return { handled: false };
  }

  return { handleRoute };
}

module.exports = {
  createWorkspaceRouteService,
};
