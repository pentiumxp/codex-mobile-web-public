#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const {
  DEFAULT_CONTRACT,
} = require("../services/remote-managed-workspaces/remote-managed-workspace-control-client-service");
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
  handleMessage,
} = require("./codex-mobile-mcp-server");

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

function bearerToken(req) {
  const value = String(req.headers.authorization || "");
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function publicControlWorkspace(workspace, cards = []) {
  const queuedCount = cards.filter((card) => card.status === "queued" && !card.terminalStatus).length;
  const activeCount = cards.filter((card) => ["acked", "active"].includes(card.status) && !card.terminalStatus).length;
  const terminalCount = cards.filter((card) => card.terminalStatus).length;
  return Object.assign({}, DEFAULT_CONTRACT, {
    workspaceId: workspace.workspaceId,
    label: workspace.projectRootLabel || workspace.nodeName || workspace.workspaceId,
    trusted: true,
    paired: true,
    connected: ["active", "registered"].includes(workspace.status),
    status: workspace.status,
    pairingStatus: "approved",
    sessionFresh: Boolean(workspace.lastHeartbeatAt || workspace.registeredAt),
    lastSeenAt: workspace.lastHeartbeatAt || workspace.registeredAt || "",
    counts: { queuedCount, activeCount, terminalCount },
    issueCodes: [],
  });
}

function publicControlCard(card = {}) {
  const terminal = card.terminalReturn && typeof card.terminalReturn === "object" ? card.terminalReturn : {};
  return {
    taskCardId: card.taskCardId || "",
    status: card.status || "",
    terminalStatus: card.terminalStatus || "",
    summary: card.summary || "",
    terminalReturn: {
      status: terminal.status || card.terminalStatus || "",
      summary: terminal.summary || "",
    },
    idempotencyKey: card.idempotencyKey ? "present" : "",
    executionLease: {
      status: card.executionLease && card.executionLease.status || "",
      lastHeartbeatAt: card.executionLease && card.executionLease.lastHeartbeatAt || "",
    },
    createdAt: card.createdAt || "",
    updatedAt: card.updatedAt || "",
  };
}

async function startCentralControlSimulator(service) {
  const routeService = createRemoteManagedWorkspaceRouteService({
    remoteManagedWorkspaceService: service,
    centralSimulator: true,
  });
  let seq = 0;
  const controlPairingRequests = new Map();
  const validControlTokens = new Set();
  function publicControlPairingRequest(entry, includeCredential = false) {
    return Object.assign({}, DEFAULT_CONTRACT, {
      requestId: entry.requestId,
      status: entry.status,
      clientId: entry.clientId,
      clientKind: entry.clientKind,
      localWorkspaceId: entry.localWorkspaceId,
      approvedScopes: entry.approvedScopes || [],
      controlCredential: includeCredential && entry.controlToken ? { token: entry.controlToken } : undefined,
    });
  }
  function identityMatches(entry, params) {
    return entry.clientId === params.get("clientId")
      && entry.installId === params.get("installId")
      && entry.deviceId === params.get("deviceId")
      && entry.localWorkspaceId === params.get("localWorkspaceId");
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
      if (req.method === "POST" && url.pathname === "/api/remote-managed-workspace-control/client-pairing-requests") {
        const body = await readBody(req);
        seq += 1;
        const requestId = `cpr_fixture_${seq}`;
        const entry = {
          requestId,
          status: "pending_approval",
          clientId: String(body.clientId || ""),
          clientName: String(body.clientName || ""),
          clientKind: String(body.clientKind || ""),
          installId: String(body.installId || ""),
          deviceId: String(body.deviceId || ""),
          localWorkspaceId: String(body.localWorkspaceId || ""),
          scopes: Array.isArray(body.scopes) ? body.scopes : [],
          approvedScopes: [],
          controlToken: "",
          credentialIssued: false,
        };
        controlPairingRequests.set(requestId, entry);
        sendJson(res, 202, { ok: true, pairingRequest: publicControlPairingRequest(entry) });
        return;
      }
      if (url.pathname.startsWith("/api/remote-managed-workspace-control/client-pairing-requests/")) {
        const parts = url.pathname.split("/").filter(Boolean);
        const requestId = decodeURIComponent(parts[3] || "");
        const entry = controlPairingRequests.get(requestId);
        if (!entry) {
          sendJson(res, 404, Object.assign({ ok: false, error: "remote_managed_workspace_control_client_pairing_request_not_found" }, DEFAULT_CONTRACT));
          return;
        }
        if (!identityMatches(entry, url.searchParams)) {
          sendJson(res, 403, Object.assign({ ok: false, code: "remote_managed_workspace_control_client_identity_mismatch" }, DEFAULT_CONTRACT));
          return;
        }
        if (entry.status === "approved" && !entry.credentialIssued) {
          entry.status = "paired";
          entry.credentialIssued = true;
          validControlTokens.add(entry.controlToken);
          sendJson(res, 200, { ok: true, pairingRequest: publicControlPairingRequest(entry, true) });
          return;
        }
        sendJson(res, entry.status === "pending_approval" ? 202 : 200, { ok: true, pairingRequest: publicControlPairingRequest(entry, false) });
        return;
      }
      if (url.pathname.startsWith("/api/remote-managed-workspace-control")) {
        if (!validControlTokens.has(bearerToken(req))) {
          sendJson(res, 403, Object.assign({ ok: false, error: "rmw_control_forbidden" }, DEFAULT_CONTRACT));
          return;
        }
        const snapshot = service.snapshot();
        const parts = url.pathname.split("/").filter(Boolean);
        if (req.method === "GET" && url.pathname === "/api/remote-managed-workspace-control/workspaces") {
          const workspaces = Object.values(snapshot.workspaces || {}).map((workspace) => (
            publicControlWorkspace(workspace, snapshot.taskCards[workspace.workspaceId] || [])
          ));
          sendJson(res, 200, Object.assign({ ok: true, workspaces }, DEFAULT_CONTRACT));
          return;
        }
        if (parts.length === 4 && parts[0] === "api" && parts[1] === "remote-managed-workspace-control" && parts[2] === "workspaces") {
          sendJson(res, 404, Object.assign({ ok: false, error: "rmw_control_not_found" }, DEFAULT_CONTRACT));
          return;
        }
        if (parts.length === 5 && parts[0] === "api" && parts[1] === "remote-managed-workspace-control" && parts[2] === "workspaces" && parts[4] === "task-cards" && req.method === "POST") {
          const workspaceId = decodeURIComponent(parts[3]);
          const body = await readBody(req);
          const result = service.enqueueTaskCard(workspaceId, body, { skipAuth: true });
          sendJson(res, 200, Object.assign({ ok: true, duplicate: result.duplicate, card: publicControlCard(result.card) }, DEFAULT_CONTRACT));
          return;
        }
        if (parts.length === 6 && parts[0] === "api" && parts[1] === "remote-managed-workspace-control" && parts[2] === "workspaces" && parts[4] === "task-cards" && req.method === "GET") {
          const workspaceId = decodeURIComponent(parts[3]);
          const taskCardId = decodeURIComponent(parts[5]);
          const cards = (snapshot.taskCards && snapshot.taskCards[workspaceId]) || [];
          const card = cards.find((entry) => entry.taskCardId === taskCardId);
          if (!card) {
            sendJson(res, 404, Object.assign({ ok: false, error: "rmw_control_task_card_not_found" }, DEFAULT_CONTRACT));
            return;
          }
          sendJson(res, 200, Object.assign({ ok: true, card: publicControlCard(card) }, DEFAULT_CONTRACT));
          return;
        }
      }
      const result = await routeService.handleRoute({
        url,
        method: req.method,
        req,
        readBody: () => readBody(req),
        sendJson: (status, body) => sendJson(res, status, body),
      });
      if (!result.handled) sendJson(res, 404, { ok: false, error: "not_found" });
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.code || err.message || "central_simulator_error" });
    }
  });
  const port = await listen(server);
  return {
    server,
    port,
    url: `http://127.0.0.1:${port}`,
    approveControlClientPairing(requestId) {
      const entry = controlPairingRequests.get(requestId);
      if (!entry) throw new Error("control_pairing_request_not_found");
      seq += 1;
      entry.status = "approved";
      entry.approvedScopes = ["list", "dispatch", "read"];
      entry.controlToken = `rmw_control_paired_${crypto.randomBytes(16).toString("hex")}_${seq}`;
      return publicControlPairingRequest(entry);
    },
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `http_${response.status}`);
  return body;
}

function assertNoRawMaterial(value, forbidden = []) {
  const text = JSON.stringify(value || {});
  for (const item of forbidden) {
    if (item && text.includes(item)) throw new Error("rmw_control_raw_secret_material_leaked");
  }
  if (/Bearer\s+[A-Za-z0-9._-]{8,}/i.test(text)) throw new Error("rmw_control_bearer_material_leaked");
  if (/raw task body|raw return body|secret-token|owner-access-key/i.test(text)) {
    throw new Error("rmw_control_forbidden_payload_class_leaked");
  }
}

async function runRmwControlE2eHarness() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-rmw-control-"));
  const projectRoot = path.join(root, "remote-project");
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "package.json"), "{\"private\":true}\n");
  const controlStateFile = path.join(root, "rmw-control-client-state.json");
  const controlCredentialFile = path.join(root, "rmw-control-credential");

  const homeAiCentralService = createRemoteManagedWorkspaceService({
    fs,
    path,
    crypto,
    stateFile: "",
    enrollmentTokens: [],
  });
  const central = await startCentralControlSimulator(homeAiCentralService);
  const projectServer = http.createServer((req, res) => {
    if (req.url === "/status") {
      sendJson(res, 200, { ok: true, projectServer: "remote_project_simulator" });
      return;
    }
    sendJson(res, 404, { ok: false, error: "not_found" });
  });
  const projectPort = await listen(projectServer);
  const projectUrl = `http://127.0.0.1:${projectPort}`;
  const nodeClient = createRemoteManagedWorkspaceNodeClientService({ fs, path, fetch });
  const settingsService = createRemoteManagedWorkspaceSettingsService({
    fs,
    path,
    settingsFile: path.join(root, "remote-node-settings.json"),
    stateFile: path.join(root, "remote-node-state.json"),
    enrollmentTokenFile: path.join(root, "remote-node-scoped-credential"),
  });
  const localCodexRequests = [];
  const localExecutionService = createRemoteManagedWorkspaceLocalExecutionService({
    fs,
    path,
    codex: {
      request: async (method, params) => {
        localCodexRequests.push({ method, threadId: params && params.threadId || "", cwd: params && params.cwd || "" });
        if (method === "thread/start") {
          await fetchJson(`${projectUrl}/status`);
          return { threadId: "rmw-control-thread", thread: { id: "rmw-control-thread", cwd: params.cwd } };
        }
        if (method === "turn/start") return { turnId: "rmw-control-turn" };
        if (method === "thread/turns/list") {
          return { turns: [{ id: "rmw-control-turn", status: { type: "completed" }, completedAt: "2026-07-09T00:00:00.000Z" }] };
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
    notifyLocalTurnStarted: () => "rmw-control-turn",
    rememberStartedThread: () => true,
    persistThreadTitleToSessionIndex: () => true,
    tryUpdateThreadTitle: async () => true,
    completionPollIntervalMs: 10,
    completionTimeoutMs: 500,
  });
  settingsService.saveSettings({
    enabled: true,
    workspaceId: "rmw_control_fixture",
    workspaceKind: "remote_managed_workspace",
    projectType: "local_fixture",
    projectRoot,
    allowedRoot: root,
    centralUrl: central.url,
    nodeName: "fixture-control-node",
    connectionMode: "persistent",
    roles: ["external_project_main", "external_project_worker"],
    capabilities: ["task-card-relay", "daily-summary", "bounded-escalation"],
  });
  const runner = createRemoteManagedWorkspaceNodeRunnerService({
    settingsService,
    nodeClientService: nodeClient,
    taskCardExecutor: (card, context) => localExecutionService.execute(card, context),
    taskCardHeartbeatIntervalMs: 10,
  });

  try {
    const requestedPairing = await runner.registerNow();
    const pairingRequestId = settingsService.publicSettings().pairingRequestId;
    const approvedPairing = homeAiCentralService.approvePairing(pairingRequestId);
    const registeredNow = await runner.registerNow();
    const context = {
      server: "http://127.0.0.1:1",
      key: "unused",
      rmwControlUrl: central.url,
      rmwControlToken: "",
      rmwControlBootstrap: require("../services/remote-managed-workspaces/remote-managed-workspace-control-client-service").createRemoteManagedWorkspaceControlBootstrapService({
        centralUrl: central.url,
        credentialFile: controlCredentialFile,
        stateFile: controlStateFile,
      }),
      rmwControlClient: require("../services/remote-managed-workspaces/remote-managed-workspace-control-client-service").createRemoteManagedWorkspaceControlClientService(),
    };
    const pendingControlPairing = await handleMessage(context, {
      id: 0,
      method: "tools/call",
      params: { name: "rmw_list_workspaces", arguments: {} },
    });
    const controlPairingRequestId = pendingControlPairing.structuredContent.pairingRequest.requestId;
    central.approveControlClientPairing(controlPairingRequestId);
    const listed = await handleMessage(context, {
      id: 1,
      method: "tools/call",
      params: { name: "rmw_list_workspaces", arguments: {} },
    });
    const dispatched = await handleMessage(context, {
      id: 2,
      method: "tools/call",
      params: {
        name: "rmw_dispatch_task_card",
        arguments: {
          workspaceId: "rmw_control_fixture",
          title: "RMW control fixture",
          summary: "bounded fixture dispatch",
          bodyMarkdown: "Execute bounded fixture task without raw task body exposure.",
          idempotencyKey: "rmw-control-fixture-card",
          reasoningEffort: "medium",
        },
      },
    });
    const processed = await runner.runOnce({ force: true });
    const read = await handleMessage(context, {
      id: 3,
      method: "tools/call",
      params: {
        name: "rmw_read_task_card",
        arguments: {
          workspaceId: "rmw_control_fixture",
          taskCardId: dispatched.structuredContent.taskCardId,
        },
      },
    });
    const restartedContext = Object.assign({}, context, {
      rmwControlBootstrap: require("../services/remote-managed-workspaces/remote-managed-workspace-control-client-service").createRemoteManagedWorkspaceControlBootstrapService({
        centralUrl: central.url,
        credentialFile: controlCredentialFile,
        stateFile: controlStateFile,
      }),
    });
    const restartListed = await handleMessage(restartedContext, {
      id: 4,
      method: "tools/call",
      params: { name: "rmw_list_workspaces", arguments: {} },
    });
    const combined = { listed: listed.structuredContent, dispatched: dispatched.structuredContent, read: read.structuredContent };
    assertNoForbiddenPayloadClasses(combined, "rmw_control_e2e_result");
    assertNoRawMaterial(combined, [fs.readFileSync(controlCredentialFile, "utf8").trim()]);
    return {
      ok: true,
      centralPort: central.port,
      remoteProjectPort: projectPort,
      pairingRequested: requestedPairing.skipped === "pending_approval",
      pairingApproved: approvedPairing.pairing.status === "approved",
      registered: registeredNow.ok === true,
      controlPairingStarted: pendingControlPairing.structuredContent.skipped === "control_pairing_pending_approval",
      controlPairingRequestIdPresent: Boolean(controlPairingRequestId),
      controlCredentialStored: fs.existsSync(controlCredentialFile),
      restartPreservedCredential: restartListed.structuredContent.count === 1,
      listedWorkspaceCount: listed.structuredContent.count,
      dispatchedTaskCardId: dispatched.structuredContent.taskCardId,
      duplicate: dispatched.structuredContent.duplicate,
      processedExecuted: processed.processed && processed.processed.processed === true,
      readTerminalStatus: read.structuredContent.card.terminalStatus,
      readTerminalSummaryPresent: Boolean(read.structuredContent.card.terminalSummary),
      rawTaskBodyExposed: JSON.stringify(combined).includes("Execute bounded fixture task without raw task body exposure."),
      rawReturnBodyExposed: /terminalReturn|raw return body/i.test(JSON.stringify(combined)),
      localCodexThreadStarted: localCodexRequests.some((entry) => entry.method === "thread/start" && entry.cwd === projectRoot),
      localCodexTurnStarted: localCodexRequests.some((entry) => entry.method === "turn/start" && entry.threadId === "rmw-control-thread"),
      contractVersion: listed.structuredContent.contract.contractVersion,
      controlSurface: listed.structuredContent.contract.controlSurface,
      privacyCheck: "passed",
    };
  } finally {
    await closeServer(central.server);
    await closeServer(projectServer);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runRmwControlE2eHarness()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    })
    .catch((err) => {
      process.stderr.write(`${JSON.stringify({ ok: false, error: err.code || err.message || String(err) })}\n`);
      process.exitCode = 1;
    });
}

module.exports = {
  runRmwControlE2eHarness,
};
