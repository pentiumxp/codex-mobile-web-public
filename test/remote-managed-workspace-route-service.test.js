"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { test } = require("node:test");

const {
  createRemoteManagedWorkspaceService,
} = require("../services/remote-managed-workspaces/remote-managed-workspace-service");
const {
  createRemoteManagedWorkspaceRouteService,
} = require("../server-routes/remote-managed-workspace-route-service");
const {
  createApiDispatchRouteService,
} = require("../server-routes/api-dispatch-route-service");

function makeRoute() {
  const service = createRemoteManagedWorkspaceService({
    crypto,
    stateFile: "",
    enrollmentTokens: ["token"],
  });
  return {
    service,
    route: createRemoteManagedWorkspaceRouteService({
      remoteManagedWorkspaceService: service,
      centralSimulator: true,
    }),
  };
}

async function callRoute(route, method, pathname, body, token = "token") {
  const sent = [];
  await route.handleRoute({
    url: new URL(pathname, "http://127.0.0.1"),
    method,
    req: { headers: token ? { authorization: `Bearer ${token}` } : {} },
    readBody: async () => body || {},
    sendJson: (status, payload) => sent.push({ status, payload }),
  });
  return sent[0];
}

const registration = {
  workspaceId: "rmw_route",
  workspaceKind: "remote_managed_workspace",
  projectType: "node",
  projectRoot: "/tmp/project",
  centralUrl: "http://127.0.0.1:9000",
  nodeName: "node-route",
  contractVersion: "remote-managed-workspace.v1",
  roles: ["external_project_main", "external_project_worker"],
  capabilities: ["task-card-relay"],
  projectRootEvidence: { exists: true, withinAllowedRoot: true },
};

test("remote managed workspace simulator route uses route-local enrollment auth", async () => {
  const { route } = makeRoute();
  assert.equal(route.centralControlPlaneOwner, "home_ai");
  assert.equal(route.routeMode, "codex_mobile_local_home_ai_central_simulator");

  const unauthorized = await callRoute(route, "POST", "/api/remote-managed-workspaces/register", registration, "");
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.payload.error, "remote_managed_workspace_enrollment_token_required");

  const registered = await callRoute(route, "POST", "/api/remote-managed-workspaces/register", registration);
  assert.equal(registered.status, 200);
  assert.equal(registered.payload.workspace.workspaceId, "rmw_route");

  const heartbeat = await callRoute(route, "POST", "/api/remote-managed-workspaces/rmw_route/node-heartbeat", {
    status: "idle",
  });
  assert.equal(heartbeat.status, 200);
  assert.equal(heartbeat.payload.nodeStatus.status, "idle");
});

test("remote managed workspace simulator route accepts unauthenticated pairing then scoped credential", async () => {
  const service = createRemoteManagedWorkspaceService({
    crypto,
    stateFile: "",
    enrollmentTokens: [],
  });
  const route = createRemoteManagedWorkspaceRouteService({
    remoteManagedWorkspaceService: service,
    centralSimulator: true,
  });
  const requested = await callRoute(route, "POST", "/api/remote-managed-workspaces/pairing-requests", {
    workspaceId: "rmw_route_pairing",
    workspaceKind: "remote_managed_workspace",
    projectType: "node",
    projectRootLabel: "GMK-test",
    centralUrl: "http://127.0.0.1:8797",
    nodeId: "rmn_route_pairing",
    nodeName: "node-route-pairing",
    contractVersion: "remote-managed-workspace.v1",
    roles: ["external_project_main", "external_project_worker"],
    capabilities: ["task-card-poll", "task-card-return"],
  }, "");
  assert.equal(requested.status, 200);
  assert.equal(requested.payload.pairing.status, "pending_approval");

  service.approvePairing(requested.payload.pairing.requestId, {
    scopedCredential: "route-scoped-credential",
  });
  const status = await callRoute(route, "GET", `/api/remote-managed-workspaces/pairing-requests/${requested.payload.pairing.requestId}`, null, "");
  assert.equal(status.status, 200);
  assert.equal(status.payload.pairing.status, "approved");
  assert.equal(status.payload.pairing.scopedCredential, "route-scoped-credential");

  const registered = await callRoute(route, "POST", "/api/remote-managed-workspaces/register", {
    workspaceId: "rmw_route_pairing",
    workspaceKind: "remote_managed_workspace",
    projectType: "node",
    projectRoot: "/tmp/project",
    centralUrl: "http://127.0.0.1:8797",
    nodeName: "node-route-pairing",
    contractVersion: "remote-managed-workspace.v1",
    roles: ["external_project_main", "external_project_worker"],
    capabilities: ["task-card-poll", "task-card-return"],
    projectRootEvidence: { exists: true, withinAllowedRoot: true },
  }, "route-scoped-credential");
  assert.equal(registered.status, 200);
  assert.equal(registered.payload.workspace.workspaceId, "rmw_route_pairing");
  assert.doesNotMatch(JSON.stringify(service.snapshot()), /route-scoped-credential/);
});

test("remote managed workspace route is not handled unless explicitly configured as simulator", async () => {
  const service = createRemoteManagedWorkspaceService({
    crypto,
    stateFile: "",
    enrollmentTokens: ["token"],
  });
  const route = createRemoteManagedWorkspaceRouteService({ remoteManagedWorkspaceService: service });
  const sent = [];

  const result = await route.handleRoute({
    url: new URL("/api/remote-managed-workspaces/register", "http://127.0.0.1"),
    method: "POST",
    req: { headers: { authorization: "Bearer token" } },
    readBody: async () => registration,
    sendJson: (status, payload) => sent.push({ status, payload }),
  });

  assert.deepEqual(result, { handled: false, reason: "home_ai_control_plane_owned" });
  assert.equal(sent.length, 0);
});

test("api dispatch does not expose Codex Mobile remote workspace central routes by default", async () => {
  const { service } = makeRoute();
  const sent = [];
  const dispatch = createApiDispatchRouteService({
    READ_RPC_TIMEOUT_MS: 1,
    MAX_THREAD_TURNS: 1,
    CODEX_HOME: "/tmp/codex",
    coreApiRouteService: {
      handlePublicRoute: async () => ({ handled: false }),
      handleAuthorizedRoute: async () => ({ handled: false }),
    },
    getUrl: (req) => new URL(req.url, "http://127.0.0.1"),
    isAuthorized: () => false,
    readBody: async () => registration,
    sendJson: (res, status, payload) => sent.push({ status, payload }),
    remoteManagedWorkspaceService: service,
    webPushRuntimeService: { handleRoute: async () => ({ handled: false }) },
    mediaFileService: { handleMediaFileRoute: async () => ({ handled: false }) },
    handleThreadSideChatRoute: async () => ({ handled: false }),
    threadTaskCardRouteService: { handleRoute: async () => ({ handled: false }) },
    handleThreadListRoute: async () => ({ handled: false }),
    handleThreadDetailReadRoute: async () => ({ handled: false }),
    threadMessageRouteService: { handleRoute: async () => ({ handled: false }) },
    workspaceRegistryService: {},
    listWorkspaces: () => [],
    normalizeFsPath: (value) => value,
    tokenUsageWorkspaceCwds: () => [],
    syncRegisteredWorkspaceTrust: () => {},
    syncKnownCodexMobileMcpToolsets: () => {},
    createContinuationJob: () => {},
    getContinuationJob: () => null,
    publicContinuationJob: () => null,
    chatGptProBridgeService: {},
    chatGptProMcpService: {},
    chatGptProPlannerService: {},
    chatGptProSourceSummary: () => null,
    archiveThreadId: () => {},
    codex: {},
    compactTurnsListResult: () => {},
    isRecoverableThreadTitleUpdateError: () => false,
    parseThreadTurnsCursor: () => null,
    persistThreadTitleToSessionIndex: () => false,
    readRolloutSessionFallbackThread: () => null,
    readStartedThread: () => null,
    readStateDbThread: () => null,
    rememberStartedThread: () => null,
    runThreadGoalAction: () => null,
    setThreadGoal: () => null,
    tryUpdateThreadTitle: () => null,
    visibilityFromGlobalState: () => null,
    clientHeartbeats: new Map(),
    clients: new Set(),
    removeEventClient: () => {},
    getUrlForEvent: () => null,
  });

  await dispatch.handleApi({
    method: "POST",
    url: "/api/remote-managed-workspaces/register",
    headers: { authorization: "Bearer token" },
  }, {});
  assert.equal(sent[0].status, 401);
  assert.equal(sent[0].payload.error, "Unauthorized");
});

test("api dispatch can host the local Home AI central simulator when explicitly injected", async () => {
  const { service } = makeRoute();
  const sent = [];
  const dispatch = createApiDispatchRouteService({
    READ_RPC_TIMEOUT_MS: 1,
    MAX_THREAD_TURNS: 1,
    CODEX_HOME: "/tmp/codex",
    coreApiRouteService: {
      handlePublicRoute: async () => ({ handled: false }),
      handleAuthorizedRoute: async () => ({ handled: false }),
    },
    getUrl: (req) => new URL(req.url, "http://127.0.0.1"),
    isAuthorized: () => false,
    readBody: async () => registration,
    sendJson: (res, status, payload) => sent.push({ status, payload }),
    remoteManagedWorkspaceService: service,
    remoteManagedWorkspaceCentralSimulator: true,
    webPushRuntimeService: { handleRoute: async () => ({ handled: false }) },
    mediaFileService: { handleMediaFileRoute: async () => ({ handled: false }) },
    handleThreadSideChatRoute: async () => ({ handled: false }),
    threadTaskCardRouteService: { handleRoute: async () => ({ handled: false }) },
    handleThreadListRoute: async () => ({ handled: false }),
    handleThreadDetailReadRoute: async () => ({ handled: false }),
    threadMessageRouteService: { handleRoute: async () => ({ handled: false }) },
    workspaceRegistryService: {},
    listWorkspaces: () => [],
    normalizeFsPath: (value) => value,
    tokenUsageWorkspaceCwds: () => [],
    syncRegisteredWorkspaceTrust: () => {},
    syncKnownCodexMobileMcpToolsets: () => {},
    createContinuationJob: () => {},
    getContinuationJob: () => null,
    publicContinuationJob: () => null,
    chatGptProBridgeService: {},
    chatGptProMcpService: {},
    chatGptProPlannerService: {},
    chatGptProSourceSummary: () => null,
    archiveThreadId: () => {},
    codex: {},
    compactTurnsListResult: () => {},
    isRecoverableThreadTitleUpdateError: () => false,
    parseThreadTurnsCursor: () => null,
    persistThreadTitleToSessionIndex: () => false,
    readRolloutSessionFallbackThread: () => null,
    readStartedThread: () => null,
    readStateDbThread: () => null,
    rememberStartedThread: () => null,
    runThreadGoalAction: () => null,
    setThreadGoal: () => null,
    tryUpdateThreadTitle: () => null,
    visibilityFromGlobalState: () => null,
    clientHeartbeats: new Map(),
    clients: new Set(),
    removeEventClient: () => {},
    getUrlForEvent: () => null,
  });

  await dispatch.handleApi({
    method: "POST",
    url: "/api/remote-managed-workspaces/register",
    headers: { authorization: "Bearer token" },
  }, {});
  assert.equal(sent[0].status, 200);
  assert.equal(sent[0].payload.ok, true);
});
