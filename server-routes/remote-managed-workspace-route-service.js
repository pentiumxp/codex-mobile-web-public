"use strict";

function compactOneLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function tokenFromRequest(req = {}) {
  const headers = req.headers || {};
  const authorization = compactOneLine(headers.authorization || headers.Authorization || "");
  const bearer = authorization.match(/^Bearer\s+(.+)$/i);
  if (bearer) return bearer[1].trim();
  return compactOneLine(
    headers["x-remote-managed-workspace-token"]
    || headers["x-codex-mobile-remote-token"]
    || "",
  );
}

function routeErrorPayload(err) {
  return {
    ok: false,
    error: compactOneLine(err && (err.code || err.message)) || "remote_managed_workspace_route_error",
  };
}

function createRemoteManagedWorkspaceRouteService(dependencies = {}) {
  const remoteManagedWorkspaceService = dependencies.remoteManagedWorkspaceService;
  const centralSimulator = dependencies.centralSimulator === true;
  if (!remoteManagedWorkspaceService) {
    throw new Error("remoteManagedWorkspaceService_required");
  }

  async function handleRoute({ url, method, req, readBody, sendJson } = {}) {
    if (!url || !url.pathname || !url.pathname.startsWith("/api/remote-managed-workspaces")) {
      return { handled: false };
    }
    if (!centralSimulator) {
      return { handled: false, reason: "home_ai_control_plane_owned" };
    }
    const token = tokenFromRequest(req);
    const parts = url.pathname.split("/").filter(Boolean);
    const workspaceId = parts[2] ? decodeURIComponent(parts[2]) : "";
    const taskCardId = parts[4] ? decodeURIComponent(parts[4]) : "";
    const options = { token };
    try {
      if (method === "POST" && url.pathname === "/api/remote-managed-workspaces/pairing-requests") {
        const body = await readBody();
        sendJson(200, remoteManagedWorkspaceService.requestPairing(body, options));
        return { handled: true };
      }
      if (method === "GET" && parts.length === 4 && parts[2] === "pairing-requests") {
        const requestId = decodeURIComponent(parts[3]);
        sendJson(200, remoteManagedWorkspaceService.pairingStatus(requestId, options));
        return { handled: true };
      }
      if (method === "POST" && url.pathname === "/api/remote-managed-workspaces/register") {
        const body = await readBody();
        sendJson(200, remoteManagedWorkspaceService.register(body, options));
        return { handled: true };
      }
      if (method === "POST" && parts.length === 4 && parts[3] === "node-heartbeat") {
        const body = await readBody();
        sendJson(200, remoteManagedWorkspaceService.nodeHeartbeat(workspaceId, body, options));
        return { handled: true };
      }
      if (method === "GET" && parts.length === 5 && parts[3] === "task-cards" && parts[4] === "poll") {
        sendJson(200, remoteManagedWorkspaceService.pollTaskCards(workspaceId, {
          limit: url.searchParams.get("limit") || "",
        }, options));
        return { handled: true };
      }
      if (method === "POST" && parts.length === 6 && parts[3] === "task-cards" && parts[5] === "ack") {
        const body = await readBody();
        sendJson(200, remoteManagedWorkspaceService.ackTaskCard(workspaceId, taskCardId, body, options));
        return { handled: true };
      }
      if (method === "POST" && parts.length === 6 && parts[3] === "task-cards" && parts[5] === "heartbeat") {
        const body = await readBody();
        sendJson(200, remoteManagedWorkspaceService.heartbeatTaskCard(workspaceId, taskCardId, body, options));
        return { handled: true };
      }
      if (method === "POST" && parts.length === 6 && parts[3] === "task-cards" && parts[5] === "return") {
        const body = await readBody();
        sendJson(200, remoteManagedWorkspaceService.returnTaskCard(workspaceId, taskCardId, body, options));
        return { handled: true };
      }
      if (method === "POST" && parts.length === 4 && parts[3] === "daily-summary") {
        const body = await readBody();
        sendJson(200, remoteManagedWorkspaceService.dailySummary(workspaceId, body, options));
        return { handled: true };
      }
      if (method === "POST" && parts.length === 4 && parts[3] === "escalations") {
        const body = await readBody();
        sendJson(200, remoteManagedWorkspaceService.escalation(workspaceId, body, options));
        return { handled: true };
      }
      sendJson(404, { ok: false, error: "remote_managed_workspace_route_not_found" });
      return { handled: true };
    } catch (err) {
      sendJson(Number(err && err.statusCode) || 500, routeErrorPayload(err));
      return { handled: true };
    }
  }

  return {
    centralControlPlaneOwner: "home_ai",
    handleRoute,
    routeMode: "codex_mobile_local_home_ai_central_simulator",
    tokenFromRequest,
  };
}

module.exports = {
  createRemoteManagedWorkspaceRouteService,
  tokenFromRequest,
};
