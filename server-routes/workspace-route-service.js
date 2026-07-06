"use strict";

const path = require("node:path");

const {
  sortWorkspaceRows,
} = require("../services/thread-list/thread-list-workspace-merge-service");

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
    normalizeFsPath,
    readGlobalState,
    tokenUsageWorkspaceCwds,
    visibleWorkspaceRoots,
    workspaceRegistryService,
    syncRegisteredWorkspaceTrust,
    syncKnownCodexMobileMcpToolsets,
  } = dependencies;
  const normalizePath = typeof normalizeFsPath === "function"
    ? normalizeFsPath
    : (value) => String(value || "").replace(/[\\/]+$/, "").toLowerCase();

  function labelForCwd(cwd) {
    return path.basename(String(cwd || "").replace(/^\\\\\?\\/, "")) || cwd;
  }

  function workspaceSnapshotCwds() {
    const out = [];
    if (typeof visibleWorkspaceRoots === "function") {
      try {
        const globalState = typeof readGlobalState === "function" ? readGlobalState() : undefined;
        const roots = globalState === undefined ? visibleWorkspaceRoots() : visibleWorkspaceRoots(globalState);
        if (roots && typeof roots[Symbol.iterator] === "function") out.push(...roots);
      } catch (_) {}
    }
    if (typeof tokenUsageWorkspaceCwds !== "function") return out;
    try {
      const values = tokenUsageWorkspaceCwds();
      if (Array.isArray(values)) out.push(...values);
    } catch (_) {
      // The Workspace selector should still expose Desktop-visible roots even
      // if token-usage decoration is unavailable during startup.
    }
    return out;
  }

  async function workspaceRows() {
    const rows = typeof listWorkspaces === "function" ? await listWorkspaces() : [];
    const out = Array.isArray(rows) ? rows.slice() : [];
    const byKey = new Set(out.map((row) => normalizePath(row && row.cwd)).filter(Boolean));
    for (const cwd of workspaceSnapshotCwds()) {
      const key = normalizePath(cwd);
      if (!key || byKey.has(key)) continue;
      byKey.add(key);
      out.push({
        cwd,
        label: labelForCwd(cwd),
        active: false,
        recentThreadCount: 0,
        source: "codex",
      });
    }
    return sortWorkspaceRows(out);
  }

  async function handleRoute(input = {}) {
    const url = input.url || null;
    const pathname = String(url && url.pathname || "");
    const method = methodValue(input);
    const readBody = typeof input.readBody === "function" ? input.readBody : async () => ({});
    const sendJson = typeof input.sendJson === "function" ? input.sendJson : null;

    if (pathname === "/api/workspaces" && method === "GET") {
      return jsonResponse(sendJson, 200, { data: await workspaceRows() });
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
