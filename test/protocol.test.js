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
      CODEX_MUX_CODEX_EXE: mockCodexPath,
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
