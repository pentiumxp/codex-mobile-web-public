"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { test } = require("node:test");

process.env.CODEX_MOBILE_DISABLE_AUTH = "1";

const {
  attachPendingServerRequestsToResult,
  approvalResponsePayload,
  buildThreadTaskCardCreatePayload,
  codeGraphMcpElicitationToolName,
  codeGraphReadOnlyMcpElicitationDecision,
  createThreadTaskCardsFromSourceThread,
  dynamicToolTextResponse,
  publicServerRequest,
  resolveThreadTaskCardTargetReference,
  resolvedThreadTaskCardTargetIds,
  serverRequestResponsePayload,
} = require("../server");
const { createThreadTaskCardService } = require("../services/task-cards/thread-task-card-service");

const repoRoot = path.resolve(__dirname, "..");
const muxPath = path.join(repoRoot, "codex-app-server-mux.js");
const mockCodexPath = path.join(repoRoot, "test-fixtures", "mock-codex-app-server.js");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs = 3000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await delay(25);
  }
  throw new Error("timed out waiting for condition");
}

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return null;
  }
}

function connectJsonl(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setEncoding("utf8");
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

function collectJsonLines(socket) {
  const messages = [];
  let buffer = "";
  socket.on("data", (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line) messages.push(JSON.parse(line));
    }
  });
  return messages;
}

function writeJsonLine(socket, message) {
  socket.write(`${JSON.stringify(message)}\n`);
}

test("dynamic tool responses use app-server success and contentItems schema", () => {
  const payload = dynamicToolTextResponse("ok");
  assert.deepEqual(payload, {
    result: {
      success: true,
      contentItems: [
        {
          type: "inputText",
          text: "ok",
        },
      ],
    },
  });
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /content_items|input_text/);
  assert.doesNotMatch(serialized, /"content"\s*:/);
  assert.doesNotMatch(serialized, /"type":"text"/);
});

test("dynamic tool error responses report unsuccessful contentItems output", () => {
  const payload = dynamicToolTextResponse("nope", { success: false });
  assert.deepEqual(payload, {
    result: {
      success: false,
      contentItems: [
        {
          type: "inputText",
          text: "nope",
        },
      ],
    },
  });
});

test("source-thread task cards allow exact same-workspace thread targets", () => {
  const sourceThreadId = "10000000-0000-4000-8000-000000000001";
  const pluginAuditThreadId = "10000000-0000-4000-8000-000000000002";
  const platformAuditThreadId = "10000000-0000-4000-8000-000000000003";
  const crossWorkspaceThreadId = "10000000-0000-4000-8000-000000000004";
  const archivedThreadId = "10000000-0000-4000-8000-000000000005";
  const directSummaryThreadId = "10000000-0000-4000-8000-000000000006";
  const subagentThreadId = "10000000-0000-4000-8000-000000000007";
  const hiddenWorkspaceThreadId = "10000000-0000-4000-8000-000000000008";
  const currentCwd = "/tmp/codex-mobile-fixtures/current-project";
  const hiddenCwd = "/tmp/codex-mobile-fixtures/hidden-project";
  const visibleThreads = [
    {
      id: platformAuditThreadId,
      name: "Home AI Platform Audit",
      cwd: currentCwd,
      updatedAt: 300,
      status: { type: "idle" },
    },
    {
      id: pluginAuditThreadId,
      name: "Plugin Workspace Audit",
      cwd: currentCwd,
      updatedAt: 200,
      status: { type: "idle" },
    },
    {
      id: crossWorkspaceThreadId,
      name: "Other Project",
      cwd: "/tmp/codex-mobile-fixtures/other-project",
      updatedAt: 190,
      status: { type: "idle" },
    },
    {
      id: subagentThreadId,
      name: "Implementation subagent",
      cwd: currentCwd,
      updatedAt: 180,
      agentNickname: "audit-worker",
      status: { type: "idle" },
    },
  ];
  const options = {
    globalState: {
      "active-workspace-roots": [
        currentCwd,
        "/tmp/codex-mobile-fixtures/other-project",
      ],
    },
    visibleThreads,
    readThreadSummary(threadId) {
      if (threadId === directSummaryThreadId) {
        return {
          id: directSummaryThreadId,
          name: "Readable Project",
          cwd: currentCwd,
          updatedAt: 120,
          status: { type: "idle" },
        };
      }
      if (threadId === hiddenWorkspaceThreadId) {
        return {
          id: hiddenWorkspaceThreadId,
          name: "Hidden Workspace Project",
          cwd: hiddenCwd,
          updatedAt: 110,
          status: { type: "idle" },
        };
      }
      if (threadId === subagentThreadId) {
        return {
          id: subagentThreadId,
          name: "Implementation subagent",
          cwd: currentCwd,
          updatedAt: 180,
          agentNickname: "audit-worker",
          status: { type: "idle" },
        };
      }
      if (threadId !== archivedThreadId) return null;
      return {
        id: archivedThreadId,
        name: "Archived Project",
        cwd: currentCwd,
        updatedAt: 100,
        archived: true,
        status: { type: "idle" },
      };
    },
  };

  assert.equal(
    resolveThreadTaskCardTargetReference(pluginAuditThreadId, sourceThreadId, options),
    pluginAuditThreadId,
  );
  assert.equal(
    resolveThreadTaskCardTargetReference("Plugin Workspace Audit", sourceThreadId, options),
    pluginAuditThreadId,
  );
  assert.equal(
    resolveThreadTaskCardTargetReference(crossWorkspaceThreadId, sourceThreadId, options),
    crossWorkspaceThreadId,
  );
  assert.throws(
    () => resolveThreadTaskCardTargetReference(currentCwd, sourceThreadId, options),
    (err) => err && err.code === "target_workspace_ambiguous" && err.statusCode === 409,
  );
  assert.deepEqual(
    resolvedThreadTaskCardTargetIds({ targetThreadId: pluginAuditThreadId, targetCwd: currentCwd }, sourceThreadId, options),
    [pluginAuditThreadId],
  );
  assert.deepEqual(
    resolvedThreadTaskCardTargetIds({ targetThreadIds: [pluginAuditThreadId, "Plugin Workspace Audit", pluginAuditThreadId] }, sourceThreadId, options),
    [pluginAuditThreadId],
  );
  assert.equal(
    resolveThreadTaskCardTargetReference(directSummaryThreadId, sourceThreadId, options),
    directSummaryThreadId,
  );
  assert.throws(
    () => resolveThreadTaskCardTargetReference(sourceThreadId, sourceThreadId, options),
    (err) => err && err.code === "target_thread_self" && err.statusCode === 400,
  );
  assert.throws(
    () => resolveThreadTaskCardTargetReference(archivedThreadId, sourceThreadId, options),
    (err) => err
      && err.code === "target_thread_archived"
      && err.statusCode === 409
      && err.details
      && err.details.requestedTarget
      && err.details.requestedTarget.threadId === archivedThreadId,
  );
  assert.throws(
    () => resolveThreadTaskCardTargetReference(hiddenWorkspaceThreadId, sourceThreadId, options),
    (err) => err
      && err.code === "target_thread_not_visible"
      && err.statusCode === 404
      && err.details
      && err.details.requestedTarget
      && err.details.requestedTarget.threadId === hiddenWorkspaceThreadId,
  );
  assert.throws(
    () => resolveThreadTaskCardTargetReference(subagentThreadId, sourceThreadId, options),
    (err) => err
      && err.code === "target_thread_not_visible"
      && err.statusCode === 404
      && err.details
      && err.details.requestedTarget
      && err.details.requestedTarget.threadId === subagentThreadId,
  );
  assert.throws(
    () => resolveThreadTaskCardTargetReference("10000000-0000-4000-8000-000000009999", sourceThreadId, options),
    (err) => err && err.code === "target_thread_not_visible" && err.statusCode === 404,
  );
});

test("source-thread task-card creation uses exact target resolver and source-direct service path", async () => {
  const sourceThreadId = "10000000-0000-4000-8000-000000000101";
  const exactTargetId = "10000000-0000-4000-8000-000000000102";
  const newerSameCwdThreadId = "10000000-0000-4000-8000-000000000103";
  const cwd = "/tmp/codex-mobile-fixtures/shared-workspace";
  const visibleThreads = [
    {
      id: newerSameCwdThreadId,
      name: "Newer implementation thread",
      cwd,
      updatedAt: 300,
      status: { type: "idle" },
    },
    {
      id: exactTargetId,
      name: "Plugin Workspace Audit",
      cwd,
      updatedAt: 200,
      status: { type: "idle" },
    },
  ];
  const byId = new Map([
    [sourceThreadId, {
      id: sourceThreadId,
      name: "Home AI 06-22",
      cwd,
      updatedAt: 250,
      status: { type: "idle" },
    }],
    ...visibleThreads.map((thread) => [thread.id, thread]),
  ]);
  const resolverOptions = {
    globalState: {
      "active-workspace-roots": [cwd],
    },
    visibleThreads,
    readThreadSummary(threadId) {
      return byId.get(threadId) || null;
    },
  };

  const payload = buildThreadTaskCardCreatePayload({
    targetThreadId: exactTargetId,
    targetCwd: cwd,
    title: "Audit request",
    body: "Read-only audit body.",
  }, sourceThreadId, resolverOptions);
  assert.deepEqual(payload.targetThreadIds, [exactTargetId]);
  assert.equal(payload.targetWorkspaceIds[exactTargetId], cwd);
  assert.equal(payload.sourceThreadTitle, "Home AI 06-22");

  const storageFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-task-card-route-")), "cards.json");
  const service = createThreadTaskCardService({
    storageFile,
    idGenerator: () => "ttc_exact_target",
    executeApprovedCard: async (card) => ({
      threadId: card.target.threadId,
      turnId: "turn_exact_target",
    }),
  });
  const result = await createThreadTaskCardsFromSourceThread(sourceThreadId, {
    targetThreadId: exactTargetId,
    targetCwd: cwd,
    title: "Audit request",
    body: "Read-only audit body.",
    direct: true,
    autoApprove: true,
  }, Object.assign({}, resolverOptions, {
    threadTaskCardService: service,
    workspaceDelegation: { enabled: true },
  }));

  assert.equal(result.ok, true);
  assert.equal(result.direct, true);
  assert.equal(result.cards.length, 1);
  assert.equal(result.cards[0].id, "ttc_exact_target");
  assert.equal(result.cards[0].status, "approved");
  assert.equal(result.cards[0].target.threadId, exactTargetId);
  assert.equal(result.cards[0].delivery.targetApprovalBypassed, true);
  assert.equal(result.cards[0].injectedTurnId, "turn_exact_target");
  assert.equal(service.get("ttc_exact_target", sourceThreadId).target.threadId, exactTargetId);
});

test("stdio app-server mux does not overwrite an available shared endpoint", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-protocol-"));
  const codexHome = path.join(tempRoot, "codex-home");
  const endpointFile = path.join(codexHome, "app-server-mux", "endpoint.json");
  const logFile = path.join(codexHome, "app-server-mux", "mux.log");
  fs.mkdirSync(path.dirname(endpointFile), { recursive: true });

  const existingServer = net.createServer((socket) => socket.end());
  await new Promise((resolve, reject) => {
    existingServer.once("error", reject);
    existingServer.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => existingServer.close());

  const existingEndpoint = {
    protocol: "jsonl-tcp",
    host: "127.0.0.1",
    port: existingServer.address().port,
    pid: 12345,
    childPid: 12346,
    startedAt: "2026-05-19T00:00:00.000Z",
    capabilities: { mobileUserMessageEcho: true },
  };
  fs.writeFileSync(endpointFile, JSON.stringify(existingEndpoint, null, 2), "utf8");

  const child = spawn(process.execPath, [muxPath, "app-server", "--listen", "stdio://"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      CODEX_MUX_HOST: "127.0.0.1",
      CODEX_MUX_PORT: "0",
      CODEX_MUX_STANDALONE: "1",
      CODEX_MUX_CODEX_EXE: process.execPath,
      CODEX_MUX_CODEX_ARGS: mockCodexPath,
      CODEX_MUX_LOG_FILE: logFile,
      CODEX_MUX_ENDPOINT_FILE: endpointFile,
    },
    stdio: ["pipe", "ignore", "pipe"],
  });
  t.after(() => {
    child.kill("SIGTERM");
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  await waitFor(() => {
    try {
      return fs.readFileSync(logFile, "utf8").includes("endpoint not published");
    } catch (_) {
      return false;
    }
  }, 10000);

  assert.deepEqual(readJsonFile(endpointFile), existingEndpoint);
  assert.equal(stderr, "");
});

test("mux forwards server requests and returns client responses with the original id", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-protocol-"));
  const codexHome = path.join(tempRoot, "codex-home");
  const endpointFile = path.join(codexHome, "app-server-mux", "endpoint.json");
  const logFile = path.join(codexHome, "app-server-mux", "mux.log");
  const child = spawn(process.execPath, [muxPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      CODEX_MUX_STANDALONE: "1",
      CODEX_MUX_HOST: "127.0.0.1",
      CODEX_MUX_PORT: "0",
      CODEX_MUX_CODEX_EXE: process.execPath,
      CODEX_MUX_CODEX_ARGS: mockCodexPath,
      CODEX_MUX_LOG_FILE: logFile,
      CODEX_MUX_ENDPOINT_FILE: endpointFile,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => {
    child.kill("SIGTERM");
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  const endpoint = await waitFor(() => readJsonFile(endpointFile));
  assert.equal(endpoint.protocol, "jsonl-tcp");
  assert.equal(endpoint.host, "127.0.0.1");
  assert.equal(endpoint.codexExe, process.execPath);
  assert.equal(endpoint.capabilities.threadGoalRpc, true);

  const socket = await connectJsonl(endpoint.port);
  t.after(() => socket.destroy());
  const messages = collectJsonLines(socket);

  writeJsonLine(socket, {
    jsonrpc: "2.0",
    id: "init-1",
    method: "initialize",
    params: { clientInfo: { name: "codex-mobile-web", title: "Codex Mobile Web" } },
  });

  await waitFor(() => messages.find((message) => message.id === "init-1"));
  const approval = await waitFor(() => messages.find((message) => message.method === "item/commandExecution/requestApproval"));
  assert.equal(approval.id, 0);
  assert.equal(approval.params.command, "echo hello");

  writeJsonLine(socket, {
    jsonrpc: "2.0",
    id: approval.id,
    result: { decision: "accept" },
  });

  const resolved = await waitFor(() => messages.find((message) => message.method === "serverRequest/resolved"));
  assert.equal(resolved.params.requestId, 0);
  assert.equal(stderr, "");
});

test("mux exposes bounded per-method RPC metrics without payload content", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-protocol-"));
  const codexHome = path.join(tempRoot, "codex-home");
  const endpointFile = path.join(codexHome, "app-server-mux", "endpoint.json");
  const logFile = path.join(codexHome, "app-server-mux", "mux.log");
  const child = spawn(process.execPath, [muxPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      CODEX_MUX_STANDALONE: "1",
      CODEX_MUX_HOST: "127.0.0.1",
      CODEX_MUX_PORT: "0",
      CODEX_MUX_CODEX_EXE: process.execPath,
      CODEX_MUX_CODEX_ARGS: mockCodexPath,
      CODEX_MUX_LOG_FILE: logFile,
      CODEX_MUX_ENDPOINT_FILE: endpointFile,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => {
    child.kill("SIGTERM");
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const endpoint = await waitFor(() => readJsonFile(endpointFile));
  assert.equal(endpoint.capabilities.muxMetricsRpc, true);

  const socket = await connectJsonl(endpoint.port);
  t.after(() => socket.destroy());
  const messages = collectJsonLines(socket);

  writeJsonLine(socket, {
    jsonrpc: "2.0",
    id: "list-1",
    method: "thread/list",
    params: {
      limit: 80,
      privatePrompt: "do not leak",
      searchTerm: "private thread title",
    },
  });

  const listResponse = await waitFor(() => messages.find((message) => message.id === "list-1"));
  assert.equal(listResponse.result.data[0].id, "thread-1");

  writeJsonLine(socket, {
    jsonrpc: "2.0",
    id: "metrics-1",
    method: "mux/metrics/read",
    params: { methods: ["thread/list"] },
  });

  const metricsResponse = await waitFor(() => messages.find((message) => message.id === "metrics-1"));
  const metric = metricsResponse.result.methods["thread/list"];
  assert.equal(metricsResponse.result.ok, true);
  assert.equal(metric.method, "thread/list");
  assert.equal(metric.count, 1);
  assert.equal(metric.errorCount, 0);
  assert.ok(metric.lastRequestBytes > 0);
  assert.ok(metric.lastResponseBytes > 0);
  assert.equal(typeof metric.lastMs, "number");
  const serialized = JSON.stringify(metricsResponse);
  assert.doesNotMatch(serialized, /privatePrompt|private thread title|searchTerm|thread-1/);
});

test("thread detail result carries public pending server requests for the thread", () => {
  const result = {
    thread: {
      id: "thread-approval",
      turns: [],
    },
  };
  const fakeCodex = {
    pendingServerRequests() {
      return [
        publicServerRequest({
          id: "approval-1",
          method: "item/permissions/requestApproval",
          status: "waiting",
          params: {
            threadId: "thread-approval",
            turnId: "turn-1",
            permissions: { network: { host: "api.example.test" } },
            reason: "Need network",
          },
        }),
        publicServerRequest({
          id: "approval-other",
          method: "item/permissions/requestApproval",
          status: "waiting",
          params: {
            threadId: "thread-other",
            permissions: { fileSystem: { read: ["/tmp"] } },
          },
        }),
      ];
    },
  };

  const attached = attachPendingServerRequestsToResult(result, fakeCodex);
  assert.equal(attached.thread.pendingServerRequests.length, 1);
  assert.equal(attached.thread.pendingServerRequests[0].id, "approval-1");
  assert.equal(attached.thread.pendingServerRequests[0].method, "item/permissions/requestApproval");
  assert.equal(attached.thread.pendingServerRequests[0].params.threadId, "thread-approval");
  assert.equal(attached.thread.pendingServerRequests[0].params.permissions.network.host, "api.example.test");
});

test("mux honors mobile replay notification limit", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-protocol-"));
  const codexHome = path.join(tempRoot, "codex-home");
  const endpointFile = path.join(codexHome, "app-server-mux", "endpoint.json");
  const logFile = path.join(codexHome, "app-server-mux", "mux.log");
  const child = spawn(process.execPath, [muxPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      CODEX_MUX_STANDALONE: "1",
      CODEX_MUX_HOST: "127.0.0.1",
      CODEX_MUX_PORT: "0",
      CODEX_MUX_CODEX_EXE: process.execPath,
      CODEX_MUX_CODEX_ARGS: mockCodexPath,
      CODEX_MUX_LOG_FILE: logFile,
      CODEX_MUX_ENDPOINT_FILE: endpointFile,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => {
    child.kill("SIGTERM");
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const endpoint = await waitFor(() => readJsonFile(endpointFile));
  const first = await connectJsonl(endpoint.port);
  t.after(() => first.destroy());
  const firstMessages = collectJsonLines(first);

  writeJsonLine(first, {
    jsonrpc: "2.0",
    id: "init-1",
    method: "initialize",
    params: { clientInfo: { name: "codex-mobile-web", title: "Codex Mobile Web" } },
  });
  await waitFor(() => firstMessages.find((message) => message.id === "init-1"));

  writeJsonLine(first, {
    jsonrpc: "2.0",
    id: "emit-1",
    method: "test/emitNotifications",
    params: { count: 3 },
  });
  await waitFor(() => firstMessages.filter((message) => message.method === "thread/status/changed").length >= 3);
  first.destroy();

  const second = await connectJsonl(endpoint.port);
  t.after(() => second.destroy());
  const secondMessages = collectJsonLines(second);
  writeJsonLine(second, {
    jsonrpc: "2.0",
    id: "init-2",
    method: "initialize",
    params: {
      clientInfo: {
        name: "codex-mobile-web",
        title: "Codex Mobile Web",
        replayNotificationLimit: 1,
      },
    },
  });

  await waitFor(() => secondMessages.find((message) => message.id === "init-2"));
  await waitFor(() => secondMessages.some((message) => message.method === "thread/status/changed"));
  await delay(100);
  const replayed = secondMessages.filter((message) => message.method === "thread/status/changed");
  assert.equal(replayed.length, 1);
  assert.equal(replayed[0].params.status.index, 2);
  assert.equal(replayed[0].params.mobileReplay, true);
  assert.equal(typeof replayed[0].params.mobileReplayReceivedAtMs, "number");
  assert.equal(typeof replayed[0].params.mobileReplaySeq, "number");
});

test("mux keeps mobile new-turn synthetic user messages off desktop clients", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-protocol-"));
  const codexHome = path.join(tempRoot, "codex-home");
  const endpointFile = path.join(codexHome, "app-server-mux", "endpoint.json");
  const logFile = path.join(codexHome, "app-server-mux", "mux.log");
  const child = spawn(process.execPath, [muxPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      CODEX_MUX_STANDALONE: "1",
      CODEX_MUX_HOST: "127.0.0.1",
      CODEX_MUX_PORT: "0",
      CODEX_MUX_CODEX_EXE: process.execPath,
      CODEX_MUX_CODEX_ARGS: mockCodexPath,
      CODEX_MUX_LOG_FILE: logFile,
      CODEX_MUX_ENDPOINT_FILE: endpointFile,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => {
    child.kill("SIGTERM");
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const endpoint = await waitFor(() => readJsonFile(endpointFile));
  const desktop = await connectJsonl(endpoint.port);
  const mobile = await connectJsonl(endpoint.port);
  t.after(() => desktop.destroy());
  t.after(() => mobile.destroy());
  const desktopMessages = collectJsonLines(desktop);
  const mobileMessages = collectJsonLines(mobile);

  writeJsonLine(desktop, {
    jsonrpc: "2.0",
    id: "desktop-init",
    method: "initialize",
    params: { clientInfo: { name: "Codex Desktop", title: "Codex Desktop" } },
  });
  writeJsonLine(mobile, {
    jsonrpc: "2.0",
    id: "mobile-init",
    method: "initialize",
    params: { clientInfo: { name: "codex-mobile-web", title: "Codex Mobile Web" } },
  });

  await waitFor(() => desktopMessages.find((message) => message.id === "desktop-init"));
  await waitFor(() => mobileMessages.find((message) => message.id === "mobile-init"));

  writeJsonLine(mobile, {
    jsonrpc: "2.0",
    id: "mobile-turn-1",
    method: "turn/start",
    params: {
      threadId: "thread-mobile",
      input: [{ type: "text", text: "hello from phone", text_elements: [] }],
    },
  });

  const started = await waitFor(() => desktopMessages.find((message) => message.method === "turn/started" && message.params.threadId === "thread-mobile"));
  const mobileEchoed = await waitFor(() => mobileMessages.find((message) => message.method === "item/completed"
    && message.params.threadId === "thread-mobile"
    && message.params.turnId === started.params.turn.id
    && message.params.item.type === "userMessage"));

  assert.match(mobileEchoed.params.item.id, /^mux-user-thread-mobile-/);
  assert.equal(mobileEchoed.params.item.content[0].text, "hello from phone");
  await delay(100);
  assert.equal(
    desktopMessages.some((message) => message.method === "item/completed"
      && message.params.threadId === "thread-mobile"
      && message.params.item.type === "userMessage"
      && /^mux-user-/.test(String(message.params.item.id || ""))),
    false,
  );
});

test("mux keeps mobile active-turn synthetic user messages off desktop clients", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-protocol-"));
  const codexHome = path.join(tempRoot, "codex-home");
  const endpointFile = path.join(codexHome, "app-server-mux", "endpoint.json");
  const logFile = path.join(codexHome, "app-server-mux", "mux.log");
  const child = spawn(process.execPath, [muxPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      CODEX_MUX_STANDALONE: "1",
      CODEX_MUX_HOST: "127.0.0.1",
      CODEX_MUX_PORT: "0",
      CODEX_MUX_CODEX_EXE: process.execPath,
      CODEX_MUX_CODEX_ARGS: mockCodexPath,
      CODEX_MUX_LOG_FILE: logFile,
      CODEX_MUX_ENDPOINT_FILE: endpointFile,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => {
    child.kill("SIGTERM");
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const endpoint = await waitFor(() => readJsonFile(endpointFile));
  const desktop = await connectJsonl(endpoint.port);
  const mobile = await connectJsonl(endpoint.port);
  t.after(() => desktop.destroy());
  t.after(() => mobile.destroy());
  const desktopMessages = collectJsonLines(desktop);
  const mobileMessages = collectJsonLines(mobile);

  writeJsonLine(desktop, {
    jsonrpc: "2.0",
    id: "desktop-init",
    method: "initialize",
    params: { clientInfo: { name: "Codex Desktop", title: "Codex Desktop" } },
  });
  writeJsonLine(mobile, {
    jsonrpc: "2.0",
    id: "mobile-init",
    method: "initialize",
    params: { clientInfo: { name: "codex-mobile-web", title: "Codex Mobile Web" } },
  });
  await waitFor(() => desktopMessages.find((message) => message.id === "desktop-init"));
  await waitFor(() => mobileMessages.find((message) => message.id === "mobile-init"));

  writeJsonLine(mobile, {
    jsonrpc: "2.0",
    id: "mobile-user-message-1",
    method: "mux/userMessage",
    params: {
      threadId: "thread-active",
      turnId: "turn-active",
      clientSubmissionId: "submission-1",
      input: [{ type: "text", text: "steer from phone", text_elements: [] }],
    },
  });

  const response = await waitFor(() => mobileMessages.find((message) => message.id === "mobile-user-message-1"));
  assert.deepEqual(response.result, { ok: true });
  const mobileEchoed = await waitFor(() => mobileMessages.find((message) => message.method === "item/completed"
    && message.params.threadId === "thread-active"
    && message.params.turnId === "turn-active"
    && message.params.item.type === "userMessage"));
  assert.match(mobileEchoed.params.item.id, /^mux-user-thread-active-turn-active-submission-1$/);
  assert.equal(mobileEchoed.params.item.content[0].text, "steer from phone");
  assert.equal(mobileEchoed.params.item.clientSubmissionId, "submission-1");
  await delay(100);
  assert.equal(
    desktopMessages.some((message) => message.method === "item/completed"
      && message.params.threadId === "thread-active"
      && message.params.item.type === "userMessage"
      && /^mux-user-/.test(String(message.params.item.id || ""))),
    false,
  );
});

test("mux replays missed turn notifications to desktop clients after reconnect", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-protocol-"));
  const codexHome = path.join(tempRoot, "codex-home");
  const endpointFile = path.join(codexHome, "app-server-mux", "endpoint.json");
  const logFile = path.join(codexHome, "app-server-mux", "mux.log");
  const child = spawn(process.execPath, [muxPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      CODEX_MUX_STANDALONE: "1",
      CODEX_MUX_HOST: "127.0.0.1",
      CODEX_MUX_PORT: "0",
      CODEX_MUX_CODEX_EXE: process.execPath,
      CODEX_MUX_CODEX_ARGS: mockCodexPath,
      CODEX_MUX_LOG_FILE: logFile,
      CODEX_MUX_ENDPOINT_FILE: endpointFile,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => {
    child.kill("SIGTERM");
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const endpoint = await waitFor(() => readJsonFile(endpointFile));
  const mobile = await connectJsonl(endpoint.port);
  t.after(() => mobile.destroy());
  const mobileMessages = collectJsonLines(mobile);
  writeJsonLine(mobile, {
    jsonrpc: "2.0",
    id: "mobile-init",
    method: "initialize",
    params: { clientInfo: { name: "codex-mobile-web", title: "Codex Mobile Web" } },
  });
  await waitFor(() => mobileMessages.find((message) => message.id === "mobile-init"));

  writeJsonLine(mobile, {
    jsonrpc: "2.0",
    id: "mobile-turn-1",
    method: "turn/start",
    params: {
      threadId: "thread-replay",
      input: [{ type: "text", text: "hello while desktop offline", text_elements: [] }],
    },
  });
  await waitFor(() => mobileMessages.find((message) => message.id === "mobile-turn-1"));

  const desktop = await connectJsonl(endpoint.port);
  t.after(() => desktop.destroy());
  const desktopMessages = collectJsonLines(desktop);
  writeJsonLine(desktop, {
    jsonrpc: "2.0",
    id: "desktop-init",
    method: "initialize",
    params: { clientInfo: { name: "Codex Desktop", title: "Codex Desktop" } },
  });
  await waitFor(() => desktopMessages.find((message) => message.id === "desktop-init"));

  const replayed = await waitFor(() => desktopMessages.find((message) => message.method === "turn/started"
    && message.params.threadId === "thread-replay"));
  assert.equal(replayed.params.threadId, "thread-replay");
  await delay(100);
  assert.equal(
    desktopMessages.some((message) => message.method === "item/completed"
      && message.params.threadId === "thread-replay"
      && message.params.item.type === "userMessage"
      && /^mux-user-/.test(String(message.params.item.id || ""))),
    false,
  );
});

test("approval response payloads match current and legacy app-server methods", () => {
  assert.deepEqual(
    approvalResponsePayload({ method: "item/commandExecution/requestApproval" }, "allow_once"),
    { result: { decision: "accept" } },
  );
  assert.deepEqual(
    approvalResponsePayload({ method: "item/fileChange/requestApproval" }, "allow_session"),
    { result: { decision: "acceptForSession" } },
  );
  assert.deepEqual(
    approvalResponsePayload({ method: "execCommandApproval" }, "deny"),
    { result: { decision: "denied" } },
  );
  assert.deepEqual(
    approvalResponsePayload({
      method: "item/permissions/requestApproval",
      params: { permissions: { network: { domains: ["example.com"] } } },
    }, "allow_once"),
    {
      result: {
        permissions: { network: { domains: ["example.com"] } },
        scope: "turn",
        strictAutoReview: false,
      },
    },
  );
  assert.throws(
    () => approvalResponsePayload({ method: "item/commandExecution/requestApproval" }, "always"),
    /Invalid approval decision/,
  );
});

test("public server request compaction keeps actionable approval context", () => {
  const request = publicServerRequest({
    id: 0,
    method: "item/commandExecution/requestApproval",
    status: "waiting",
    receivedAt: 123,
    params: {
      threadId: "thread-1",
      turnId: "turn-1",
      command: "echo hello",
      reason: "needs approval",
      cwd: repoRoot,
    },
  });

  assert.equal(request.id, "0");
  assert.equal(request.actionable, true);
  assert.equal(request.params.threadId, "thread-1");
  assert.equal(request.params.turnId, "turn-1");
  assert.equal(request.params.command, "echo hello");
  assert.equal(request.params.reason, "needs approval");
});

test("user input server requests are actionable and return answers", () => {
  const request = {
    id: 1,
    method: "item/tool/requestUserInput",
    status: "waiting",
    params: {
      questions: [{
        id: "choice",
        header: "Pick one",
        question: "Continue?",
        options: [{ label: "Yes", description: "Continue the task" }],
      }],
    },
  };
  const publicRequest = publicServerRequest(request);

  assert.equal(publicRequest.actionable, true);
  assert.equal(publicRequest.params.questions[0].id, "choice");
  assert.equal(publicRequest.params.questions[0].options[0].label, "Yes");
  assert.deepEqual(
    serverRequestResponsePayload(request, { responseText: "Yes", questionId: "choice" }),
    { result: { answers: { choice: { answers: ["Yes"] } } } },
  );
});

test("MCP elicitation server requests accept and decline", () => {
  const request = {
    id: 2,
    method: "mcpServer/elicitation/request",
    status: "waiting",
    params: {
      title: "Choose scope",
      message: "Where should this run?",
    },
  };
  const publicRequest = publicServerRequest(request);

  assert.equal(publicRequest.actionable, true);
  assert.equal(publicRequest.params.title, "Choose scope");
  assert.deepEqual(
    serverRequestResponsePayload(request, { responseText: "fork only" }),
    { result: { action: "accept", content: { response: "fork only" } } },
  );
  assert.deepEqual(
    serverRequestResponsePayload(request, { action: "decline" }),
    { result: { action: "decline", content: null } },
  );
});

test("CodeGraph read-only MCP elicitation is auto-allowable", () => {
  const request = {
    id: 3,
    method: "mcpServer/elicitation/request",
    status: "waiting",
    params: {
      message: 'Allow the codegraph MCP server to run tool "codegraph_search"?',
    },
  };

  assert.equal(codeGraphMcpElicitationToolName(request), "codegraph_search");
  assert.deepEqual(codeGraphReadOnlyMcpElicitationDecision(request), {
    action: "allow",
    toolName: "codegraph_search",
  });
  assert.deepEqual(serverRequestResponsePayload(request, { action: "accept" }), {
    result: { action: "accept", content: {} },
  });
});

test("CodeGraph MCP elicitation auto-allow rejects unknown tools and other servers", () => {
  assert.equal(codeGraphReadOnlyMcpElicitationDecision({
    id: 4,
    method: "mcpServer/elicitation/request",
    params: {
      message: 'Allow the codegraph MCP server to run tool "codegraph_mutate"?',
    },
  }), null);
  assert.equal(codeGraphReadOnlyMcpElicitationDecision({
    id: 5,
    method: "mcpServer/elicitation/request",
    params: {
      message: 'Allow the browser MCP server to run tool "codegraph_search"?',
    },
  }), null);
});
