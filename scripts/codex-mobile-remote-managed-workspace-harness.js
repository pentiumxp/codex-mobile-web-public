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
const {
  authorityDecisionForServerRequest,
  summarizeExecutionAuthority,
} = require("../services/task-cards/task-card-execution-authority-service");

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

async function runConsumedPairingRecoverySlice(baseRoot) {
  const root = path.join(baseRoot, "consumed-pairing-recovery");
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  const credentialFile = path.join(root, "secret", "scoped-credential");
  const settingsService = createRemoteManagedWorkspaceSettingsService({
    fs,
    path,
    settingsFile: path.join(root, "settings.json"),
    stateFile: path.join(root, "state.json"),
    enrollmentTokenFile: credentialFile,
  });
  settingsService.enableWorkspace({
    centralUrl: "http://127.0.0.1:1",
    workspace: { cwd: projectRoot, label: "Consumed Pairing Recovery" },
  });
  settingsService.applyPairingResult({
    pairingRequest: {
      requestId: "rmw_pair_consumed_harness",
      status: "approved",
      scopedCredential: "consumed-harness-credential",
    },
  });
  settingsService.updateConnectionState({
    connectionStatus: "auth_failed",
    pairingStatus: "approved",
    issueCode: "remote_managed_workspace_pairing_approval_required",
  });
  const calls = [];
  const nodeClientService = {
    register: async (config) => {
      calls.push(["register", config.workspaceId]);
      const err = new Error("remote_managed_workspace_pairing_approval_required");
      err.code = "remote_managed_workspace_pairing_approval_required";
      err.statusCode = 403;
      throw err;
    },
    requestPairing: async () => {
      calls.push(["requestPairing"]);
      return { result: { pairingRequest: { requestId: "rmw_pair_consumed_harness_fresh", status: "pending_approval" } } };
    },
    pollPairingStatus: async (_config, requestId) => {
      calls.push(["pollPairingStatus", requestId]);
      return { result: { pairingRequest: { requestId, status: "pending_approval" } } };
    },
  };
  const runner = createRemoteManagedWorkspaceNodeRunnerService({
    settingsService,
    nodeClientService,
  });
  const recovered = await runner.runOnce({ force: true, suppressErrors: true });
  const pending = await runner.runOnce({ force: true });
  const stillPending = await runner.runOnce({ force: true });
  const status = settingsService.publicSettings();
  assertNoRawTokenMaterial(status, "consumed-harness-credential");
  return {
    ok: recovered.ok === false
      && recovered.status.pairingRequestId === ""
      && pending.status.pairingRequestId === "rmw_pair_consumed_harness_fresh"
      && stillPending.status.pairingRequestId === "rmw_pair_consumed_harness_fresh",
    recoveredIssuePresent: recovered.status.issueCodes.includes("remote_managed_workspace_consumed_pairing_request_recovered"),
    scopedCredentialCleared: recovered.status.scopedCredentialConfigured === false && !fs.existsSync(credentialFile),
    oldRequestCleared: recovered.status.pairingRequestId === "",
    freshRequestCreated: pending.status.pairingRequestId === "rmw_pair_consumed_harness_fresh",
    duplicatePostSuppressed: calls.filter((entry) => entry[0] === "requestPairing").length === 1,
    pendingPollUsed: calls.some((entry) => entry[0] === "pollPairingStatus" && entry[1] === "rmw_pair_consumed_harness_fresh"),
  };
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
  const registeredAuthorities = [];
  let commandExecutionCount = 0;
  let manualRequestApprovalCount = 0;
  let pendingApprovalCount = 0;
  const localExecutionService = createRemoteManagedWorkspaceLocalExecutionService({
    fs,
    path,
    codex: {
      request: async (method, params) => {
        localCodexRequests.push({
          method,
          threadId: params && params.threadId || "",
          cwd: params && params.cwd || "",
          hasRmwExecutionContract: Boolean(params && params.remoteManagedWorkspaceExecution),
          contractVersion: params && params.remoteManagedWorkspaceExecution && params.remoteManagedWorkspaceExecution.contractVersion || "",
          toolSurfaceAvailable: params && params.remoteManagedWorkspaceExecution
            && params.remoteManagedWorkspaceExecution.toolSurfaceAvailability
            && params.remoteManagedWorkspaceExecution.toolSurfaceAvailability.available === true,
        });
        if (method === "thread/start") {
          await fetchJson(`${remoteProject.url}/status`);
          return { threadId: "rmw-local-thread", thread: { id: "rmw-local-thread", cwd: params.cwd } };
        }
        if (method === "turn/start") {
          return { turnId: "rmw-local-turn" };
        }
        if (method === "thread/turns/list") {
          if (registeredAuthorities.length && commandExecutionCount === 0) {
            const decision = authorityDecisionForServerRequest(registeredAuthorities[0], {
              id: "rmw-command-approval",
              method: "item/commandExecution/requestApproval",
              params: {
                threadId: "rmw-local-thread",
                turnId: "rmw-local-turn",
                cwd: projectRoot,
                command: `curl -fsS ${remoteProject.url}/status`,
              },
            });
            if (decision && decision.action === "allow") commandExecutionCount += 1;
            else {
              manualRequestApprovalCount += 1;
              pendingApprovalCount += 1;
            }
          }
          return {
            turns: [{
              id: "rmw-local-turn",
              status: { type: "completed" },
              completedAt: "2026-07-08T00:00:00.000Z",
              items: commandExecutionCount > 0 ? [{
                id: "rmw-command-1",
                type: "commandExecution",
                status: "completed",
                command: `curl -fsS ${remoteProject.url}/status`,
              }] : [],
            }],
          };
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
    registerExecutionAuthority: async (authority) => {
      registeredAuthorities.push(authority);
      return summarizeExecutionAuthority(authority);
    },
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
      retryOfTaskCardId: "rmwtc_parent_fixture",
      title: "Remote fixture task",
      summary: "bounded fixture task",
      bodyMarkdown: "Run bounded fixture validation.",
      reasoningEffort: "medium",
      executionRequirements: {
        requiresCommandExecution: true,
        minimumCompletedCommandCount: 1,
        requiredCommandClasses: ["localhost_health_probe"],
        toolSurfaceRequired: true,
      },
    }, { skipAuth: true });
    const duplicate = homeAiCentralService.enqueueTaskCard(config.workspaceId, {
      taskCardId: "ttc_remote_fixture_duplicate",
      idempotencyKey: "remote-fixture-card",
      retryOfTaskCardId: "rmwtc_parent_fixture",
      title: "Remote fixture task duplicate",
      summary: "bounded duplicate fixture task",
      executionRequirements: {
        requiresCommandExecution: true,
        minimumCompletedCommandCount: 1,
        requiredCommandClasses: ["localhost_health_probe"],
        toolSurfaceRequired: true,
      },
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

    const consumedRecovery = await runConsumedPairingRecoverySlice(root);
    if (!consumedRecovery.ok) throw new Error("remote_managed_workspace_consumed_pairing_recovery_harness_failed");
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
      createdRetryOfTaskCardId: created.card.retryOfTaskCardId,
      runnerConnectionStatus: processed.status.connectionStatus,
      processedExecuted: processed.processed && processed.processed.processed === true,
      pollCountAfterReturn: polledAfterReturn.count,
      dailySummaryCount: snapshot.dailySummaries.length,
      escalationCount: snapshot.escalations.length,
      terminalStatus: snapshot.taskCards[config.workspaceId][0].terminalStatus,
      terminalBridge: snapshot.taskCards[config.workspaceId][0].terminalReturn
        && snapshot.taskCards[config.workspaceId][0].terminalReturn.metadata
        && snapshot.taskCards[config.workspaceId][0].terminalReturn.metadata.localExecutionBridge || "",
      retryLineagePreserved: settingsService.publicSettings().lastExecutionResult
        && settingsService.publicSettings().lastExecutionResult.retryOfTaskCardId === "rmwtc_parent_fixture",
      authorityConfigured: settingsService.publicSettings().lastExecutionAuthority
        && settingsService.publicSettings().lastExecutionAuthority.configured === true,
      authoritySource: settingsService.publicSettings().lastExecutionAuthority
        && settingsService.publicSettings().lastExecutionAuthority.source || "",
      authorityVersion: settingsService.publicSettings().lastExecutionAuthority
        && settingsService.publicSettings().lastExecutionAuthority.version || "",
      authorityScopeClasses: settingsService.publicSettings().lastExecutionAuthority
        && settingsService.publicSettings().lastExecutionAuthority.scopeClasses || [],
      authorityNetworkScope: settingsService.publicSettings().lastExecutionAuthority
        && settingsService.publicSettings().lastExecutionAuthority.networkScope || [],
      authorityExpiresAtPresent: settingsService.publicSettings().lastExecutionAuthority
        && settingsService.publicSettings().lastExecutionAuthority.expiresAtPresent === true,
      authorityResolutionStatus: settingsService.publicSettings().lastExecutionAuthority
        && settingsService.publicSettings().lastExecutionAuthority.approvalResolution
        && settingsService.publicSettings().lastExecutionAuthority.approvalResolution.status || "",
      commandExecutionCount,
      consumedPairingRecoveryOk: consumedRecovery.ok === true,
      consumedPairingRecoveryFreshRequestCreated: consumedRecovery.freshRequestCreated === true,
      consumedPairingRecoveryDuplicatePostSuppressed: consumedRecovery.duplicatePostSuppressed === true,
      requiredCommandExecutionOk: settingsService.publicSettings().lastExecutionResult
        && settingsService.publicSettings().lastExecutionResult.ok === true,
      requiredCommandExecutionCount: settingsService.publicSettings().lastExecutionResult
        && settingsService.publicSettings().lastExecutionResult.commandExecutionCount || 0,
      manualRequestApprovalCount,
      pendingApprovalCount,
      localCodexThreadStarted: localCodexRequests.some((entry) => entry.method === "thread/start" && entry.cwd === projectRoot),
      localCodexTurnStarted: localCodexRequests.some((entry) => entry.method === "turn/start" && entry.threadId === "rmw-local-thread"),
      localCodexTurnHasRmwExecutionContract: localCodexRequests.some((entry) => entry.method === "turn/start" && entry.hasRmwExecutionContract),
      localCodexTurnToolSurfaceAvailable: localCodexRequests.some((entry) => entry.method === "turn/start" && entry.toolSurfaceAvailable),
      toolSurfaceAvailabilityStatus: settingsService.publicSettings().lastExecutionResult
        && settingsService.publicSettings().lastExecutionResult.toolSurfaceAvailability
        && settingsService.publicSettings().lastExecutionResult.toolSurfaceAvailability.status || "",
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
  runConsumedPairingRecoverySlice,
  runRemoteManagedWorkspaceHarness,
};
