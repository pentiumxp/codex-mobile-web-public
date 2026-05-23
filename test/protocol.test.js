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
  approvalResponsePayload,
  publicServerRequest,
  serverRequestResponsePayload,
} = require("../server");

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
  });

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
