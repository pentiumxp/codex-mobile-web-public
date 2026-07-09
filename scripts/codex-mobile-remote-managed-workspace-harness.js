"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const {
  assertNoForbiddenPayloadClasses,
  createRemoteManagedWorkspaceService,
} = require("../services/remote-managed-workspaces/remote-managed-workspace-service");
const {
  createRemoteManagedWorkspaceNodeClientService,
} = require("../services/remote-managed-workspaces/remote-managed-workspace-node-client-service");
const {
  createRemoteManagedWorkspaceNodeRunnerService,
} = require("../services/remote-managed-workspaces/remote-managed-workspace-node-runner-service");
const {
  createRemoteManagedWorkspaceLocalExecutionService,
} = require("../services/remote-managed-workspaces/remote-managed-workspace-local-execution-service");
const {
  createRemoteManagedWorkspaceSettingsService,
} = require("../services/remote-managed-workspaces/remote-managed-workspace-settings-service");
const {
  createRemoteManagedWorkspaceRouteService,
} = require("../server-routes/remote-managed-workspace-route-service");

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("request_body_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (_) {
        reject(new Error("request_body_not_json"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(text),
  });
  res.end(text);
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

async function startHomeAiCentralSimulator(service) {
  const routeService = createRemoteManagedWorkspaceRouteService({
    remoteManagedWorkspaceService: service,
    centralSimulator: true,
  });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    const result = await routeService.handleRoute({
      url,
      method: req.method,
      req,
      readBody: () => readBody(req),
      sendJson: (status, body) => sendJson(res, status, body),
    });
    if (!result.handled) sendJson(res, 404, { ok: false, error: "not_found" });
  });
  const port = await listen(server);
  return {
    server,
    port,
    url: `http://127.0.0.1:${port}`,
    owner: "home_ai",
    mode: routeService.routeMode,
  };
}

async function startRemoteProjectSimulator() {
  const server = http.createServer((req, res) => {
    if (req.url === "/status") {
      sendJson(res, 200, { ok: true, projectServer: "remote_project_simulator" });
      return;
    }
    sendJson(res, 404, { ok: false, error: "not_found" });
  });
  const port = await listen(server);
  return { server, port, url: `http://127.0.0.1:${port}` };
}

async function fetchJson(url) {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `http_${response.status}`);
  return body;
}

function assertNoRawTokenMaterial(value, token) {
  const text = JSON.stringify(value || {});
  if (text.includes(token) || /Bearer\s+[A-Za-z0-9._-]{8,}/i.test(text)) {
    throw new Error("remote_managed_workspace_raw_token_material_leaked");
  }
}

async function runRemoteManagedWorkspaceHarness() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-rmw-"));
  const projectRoot = path.join(root, "remote-project");
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "package.json"), "{\"private\":true}\n");

  const homeAiCentralService = createRemoteManagedWorkspaceService({
    fs,
    path,
    crypto,
    stateFile: "",
    enrollmentTokens: [],
  });
  const central = await startHomeAiCentralSimulator(homeAiCentralService);
  const remoteProject = await startRemoteProjectSimulator();
  const nodeClient = createRemoteManagedWorkspaceNodeClientService({ fs, path, fetch });
  const settingsService = createRemoteManagedWorkspaceSettingsService({
    fs,
    path,
    settingsFile: path.join(root, "remote-node-settings.json"),
    stateFile: path.join(root, "remote-node-state.json"),
    enrollmentTokenFile: path.join(root, "remote-node-enrollment-token"),
  });
  const localCodexRequests = [];
  const localExecutionService = createRemoteManagedWorkspaceLocalExecutionService({
    fs,
    path,
    codex: {
      request: async (method, params) => {
        localCodexRequests.push({ method, threadId: params && params.threadId || "", cwd: params && params.cwd || "" });
        if (method === "thread/start") {
          await fetchJson(`${remoteProject.url}/status`);
          return { threadId: "rmw-local-thread", thread: { id: "rmw-local-thread", cwd: params.cwd } };
        }
        if (method === "turn/start") {
          return { turnId: "rmw-local-turn" };
        }
        if (method === "thread/turns/list") {
          return { turns: [{ id: "rmw-local-turn", status: { type: "completed" }, completedAt: "2026-07-08T00:00:00.000Z" }] };
        }
        return { ok: true };
      },
    },
    applyPermissionModeOverride: (settings, approvalPolicy, cwd) => Object.assign({}, settings || {}, {
      approvalPolicy,
      cwd,
      sandboxPolicy: { type: "dangerFullAccess" },
    }),
    applyStartThreadRuntimeSettings: (params) => params,
    applyTurnRuntimeSettings: (params, settings) => Object.assign({}, params, { effort: settings.reasoningEffort || "" }),
    resolveThreadRuntimeSettings: async () => ({ reasoningEffort: "medium" }),
    readStartThreadDeveloperInstructions: () => "",
    notifyLocalTurnStarted: () => "rmw-local-turn",
    rememberStartedThread: () => true,
    persistThreadTitleToSessionIndex: () => true,
    tryUpdateThreadTitle: async () => true,
    completionPollIntervalMs: 10,
    completionTimeoutMs: 500,
  });
  const savedSettings = settingsService.saveSettings({
    enabled: true,
    workspaceId: "rmw_fixture_workspace",
    workspaceKind: "remote_managed_workspace",
    projectType: "vite_game",
    projectRoot,
    allowedRoot: root,
    centralUrl: central.url,
    nodeName: "fixture-node",
    connectionMode: "persistent",
    roles: ["external_project_main", "external_project_worker", "external_project_audit", "external_project_deploy"],
    capabilities: ["task-card-relay", "daily-summary", "bounded-escalation"],
  });
  const runner = createRemoteManagedWorkspaceNodeRunnerService({
    settingsService,
    nodeClientService: nodeClient,
    taskCardExecutor: (card, context) => localExecutionService.execute(card, context),
    taskCardHeartbeatIntervalMs: 10,
  });

  try {
    const connectionCheck = await runner.testConnection();
    const requestedPairing = await runner.registerNow();
    const pendingStatus = settingsService.publicSettings();
    const pairingRequestId = pendingStatus.pairingRequestId;
    const approvedPairing = homeAiCentralService.approvePairing(pairingRequestId);
    const registeredNow = await runner.registerNow();
    const config = settingsService.configForClient();
    const created = homeAiCentralService.enqueueTaskCard(config.workspaceId, {
      taskCardId: "ttc_remote_fixture",
      idempotencyKey: "remote-fixture-card",
      title: "Remote fixture task",
      summary: "bounded fixture task",
      bodyMarkdown: "Run bounded fixture validation.",
      reasoningEffort: "medium",
    }, { skipAuth: true });
    const duplicate = homeAiCentralService.enqueueTaskCard(config.workspaceId, {
      taskCardId: "ttc_remote_fixture_duplicate",
      idempotencyKey: "remote-fixture-card",
      title: "Remote fixture task duplicate",
      summary: "bounded duplicate fixture task",
    }, { skipAuth: true });

    const processed = await runner.runOnce({ force: true });
    const polledAfterReturn = await nodeClient.pollTaskCards(config, { limit: 4 });
    await nodeClient.sendDailySummary(config, {
      date: "2026-07-08",
      changedFiles: ["src/index.js", "test/remote-managed-workspace.test.js"],
      buildStatus: "ok",
      testStatus: "ok",
      previewStatus: "unknown",
      openIdeas: ["local automation next"],
      blockers: [],
      risks: ["deploy_needed"],
      nextFocus: "central deploy readback",
    });
    await nodeClient.sendEscalation(config, {
      reason: "blocked",
      severity: "h2",
      title: "Bounded escalation fixture",
      summary: "fixture_escalation_sent",
      blockers: ["awaiting_deploy_lane"],
      nextStep: "route deploy separately",
    });

    const snapshot = homeAiCentralService.snapshot();
    assertNoForbiddenPayloadClasses(snapshot, "harness_snapshot");
    assertNoRawTokenMaterial(savedSettings, "rmw_scoped_");
    assertNoRawTokenMaterial(settingsService.publicSettings(), config.scopedCredential);
    return {
      ok: true,
      centralSimulatorOwner: central.owner,
      centralSimulatorMode: central.mode,
      centralPort: central.port,
      remoteProjectPort: remoteProject.port,
      settingsPersisted: savedSettings.enabled === true,
      settingsCredentialMasked: settingsService.publicSettings().scopedCredentialConfigured === true && !JSON.stringify(settingsService.publicSettings()).includes(config.scopedCredential),
      connectionCheckOk: connectionCheck.ok === true,
      pairingRequested: requestedPairing.skipped === "pending_approval",
      pairingApproved: approvedPairing.pairing.status === "approved",
      registered: registeredNow.ok === true && processed.registered === true,
      createdDuplicateSuppressed: duplicate.duplicate === true,
      createdTaskCardId: created.card.taskCardId,
      runnerConnectionStatus: processed.status.connectionStatus,
      processedExecuted: processed.processed && processed.processed.processed === true,
      pollCountAfterReturn: polledAfterReturn.count,
      dailySummaryCount: snapshot.dailySummaries.length,
      escalationCount: snapshot.escalations.length,
      terminalStatus: snapshot.taskCards[config.workspaceId][0].terminalStatus,
      terminalBridge: snapshot.taskCards[config.workspaceId][0].terminalReturn
        && snapshot.taskCards[config.workspaceId][0].terminalReturn.metadata
        && snapshot.taskCards[config.workspaceId][0].terminalReturn.metadata.localExecutionBridge || "",
      localCodexThreadStarted: localCodexRequests.some((entry) => entry.method === "thread/start" && entry.cwd === projectRoot),
      localCodexTurnStarted: localCodexRequests.some((entry) => entry.method === "turn/start" && entry.threadId === "rmw-local-thread"),
      localExecutionThreadId: settingsService.publicSettings().lastLocalThreadId,
      localExecutionTurnId: settingsService.publicSettings().lastLocalTurnId,
      privacyCheck: "passed",
    };
  } finally {
    await closeServer(central.server);
    await closeServer(remoteProject.server);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runRemoteManagedWorkspaceHarness()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    })
    .catch((err) => {
      process.stderr.write(`${JSON.stringify({ ok: false, error: err.code || err.message || String(err) })}\n`);
      process.exitCode = 1;
    });
}

module.exports = {
  runRemoteManagedWorkspaceHarness,
};
