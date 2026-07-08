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

async function runRemoteManagedWorkspaceHarness() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-rmw-"));
  const projectRoot = path.join(root, "remote-project");
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "package.json"), "{\"private\":true}\n");

  const enrollmentToken = "rmw-harness-token";
  const homeAiCentralService = createRemoteManagedWorkspaceService({
    fs,
    path,
    crypto,
    stateFile: "",
    enrollmentTokens: [enrollmentToken],
  });
  const central = await startHomeAiCentralSimulator(homeAiCentralService);
  const remoteProject = await startRemoteProjectSimulator();
  const nodeClient = createRemoteManagedWorkspaceNodeClientService({ fs, path, fetch });
  const remoteConfig = {
    workspaceId: "rmw_fixture_workspace",
    workspaceKind: "remote_managed_workspace",
    projectType: "node",
    projectRoot,
    allowedRoots: [root],
    centralUrl: central.url,
    nodeName: "fixture-node",
    contractVersion: "remote-managed-workspace.v1",
    roles: ["external_project_main", "external_project_worker", "external_project_audit", "external_project_deploy"],
    capabilities: ["task-card-relay", "daily-summary", "bounded-escalation"],
    enrollmentToken,
  };

  try {
    const registered = await nodeClient.register(remoteConfig);
    const config = registered.config;
    await nodeClient.nodeHeartbeat(config, {
      status: "idle",
      activeTaskCardCount: 0,
      capabilities: config.capabilities,
    });
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

    let executeCount = 0;
    const processed = await nodeClient.processNextTaskCard(config, {
      execute: async () => {
        executeCount += 1;
        await fetchJson(`${remoteProject.url}/status`);
        return {
          status: "completed",
          title: "远程任务完成",
          summary: "fixture_completed",
          metadata: { validation: "two_port_harness" },
        };
      },
    });
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
    return {
      ok: true,
      centralSimulatorOwner: central.owner,
      centralSimulatorMode: central.mode,
      centralPort: central.port,
      remoteProjectPort: remoteProject.port,
      registered: registered.result.ok === true,
      createdDuplicateSuppressed: duplicate.duplicate === true,
      createdTaskCardId: created.card.taskCardId,
      executeCount,
      processedExecuted: processed.executed === true,
      pollCountAfterReturn: polledAfterReturn.count,
      dailySummaryCount: snapshot.dailySummaries.length,
      escalationCount: snapshot.escalations.length,
      terminalStatus: snapshot.taskCards[config.workspaceId][0].terminalStatus,
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
