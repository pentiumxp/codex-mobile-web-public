"use strict";

const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

const APP_ROOT = __dirname;
const USER_HOME = process.env.USERPROFILE || process.env.HOME || process.cwd();
const RUNTIME_ROOT = process.env.CODEX_MOBILE_RUNTIME_DIR || path.join(USER_HOME, ".codex-mobile-web");
const CODEX_HOME = process.env.CODEX_HOME || path.join(USER_HOME, ".codex");
const RUNTIME_CODEX_EXE = path.join(RUNTIME_ROOT, "codex.exe");
const CODEX_EXE = process.env.CODEX_MUX_CODEX_EXE || (fs.existsSync(RUNTIME_CODEX_EXE) ? RUNTIME_CODEX_EXE : "codex");
const PASSTHROUGH_ARGS = process.argv.slice(2);
const CODEX_ARGS = process.env.CODEX_MUX_CODEX_ARGS
  ? process.env.CODEX_MUX_CODEX_ARGS.split(/\s+/).filter(Boolean)
  : PASSTHROUGH_ARGS.length
    ? PASSTHROUGH_ARGS
  : ["app-server", "--analytics-default-enabled"];
const HOST = process.env.CODEX_MUX_HOST || "127.0.0.1";
const PORT = Number(process.env.CODEX_MUX_PORT || "0");
const STANDALONE = /^(1|true|yes|on)$/i.test(process.env.CODEX_MUX_STANDALONE || "");
const RUNTIME_DIR = process.env.CODEX_MUX_RUNTIME_DIR || path.join(CODEX_HOME, "app-server-mux");
const ENDPOINT_FILE = process.env.CODEX_MUX_ENDPOINT_FILE || path.join(RUNTIME_DIR, "endpoint.json");
const LOG_FILE = process.env.CODEX_MUX_LOG_FILE || path.join(RUNTIME_DIR, "mux.log");

let nextClientId = 1;
let child = null;
let tcpServer = null;
let childBuffer = "";
let shuttingDown = false;
const clients = new Map();
const pending = new Map();
const activeTurnsByThread = new Map();
let nextSyntheticItemId = 1;

function log(message) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${message}\n`, "utf8");
  } catch (_) {
    // Keep stdio clean for the desktop app-server protocol.
  }
}

function hasId(message) {
  return Object.prototype.hasOwnProperty.call(message, "id");
}

function writeJsonLine(write, message) {
  write(`${JSON.stringify(message)}\n`);
}

function commandNeedsFilesystemCheck(command) {
  const value = String(command || "");
  return path.isAbsolute(value) || value.includes("/") || value.includes("\\");
}

function assertCommandAvailable(command, label) {
  const value = String(command || "").trim();
  if (!value) throw new Error(`${label} is not configured`);
  if (commandNeedsFilesystemCheck(value) && !fs.existsSync(value)) {
    throw new Error(`${label} not found: ${value}`);
  }
}

function createLineParser(onLine) {
  let buffer = "";
  return (chunk) => {
    buffer += String(chunk);
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line) onLine(line);
    }
  };
}

function addClient(name, write, close) {
  const id = `c${nextClientId++}`;
  const client = { id, name, write, close };
  clients.set(id, client);
  log(`client connected ${id} ${name}`);
  return client;
}

function removeClient(client) {
  if (!client || !clients.has(client.id)) return;
  clients.delete(client.id);
  for (const [internalId, request] of pending) {
    if (request.client.id === client.id) pending.delete(internalId);
  }
  log(`client disconnected ${client.id} ${client.name}`);
}

function sendToClient(client, message) {
  try {
    writeJsonLine(client.write, message);
  } catch (err) {
    log(`failed to send to ${client.id}: ${err.message}`);
    removeClient(client);
  }
}

function broadcastToClients(message) {
  for (const client of clients.values()) sendToClient(client, message);
}

function isTcpClient(client) {
  return Boolean(client && typeof client.name === "string" && client.name.startsWith("tcp:"));
}

function normalizeUserInputPart(part) {
  if (!part || typeof part !== "object") return null;
  if (part.type === "text") {
    const text = String(part.text || "");
    if (!text) return null;
    return {
      type: "text",
      text,
      text_elements: Array.isArray(part.text_elements) ? part.text_elements : [],
    };
  }
  if (part.type === "localImage" && part.path) {
    return {
      type: "localImage",
      path: String(part.path),
    };
  }
  return part;
}

function buildUserMessageNotification(params) {
  const threadId = params.threadId;
  const turnId = params.turnId || (threadId ? activeTurnsByThread.get(threadId) : "");
  if (!threadId || !turnId || !Array.isArray(params.input)) return null;

  const content = params.input.map(normalizeUserInputPart).filter(Boolean);
  if (!content.length) return null;

  return {
    jsonrpc: "2.0",
    method: "item/completed",
    params: {
      threadId,
      turnId,
      item: {
        id: `mux-user-${Date.now()}-${nextSyntheticItemId++}`,
        type: "userMessage",
        content,
      },
    },
  };
}

function handleMuxMethod(client, message) {
  if (!message || message.method !== "mux/userMessage") return false;
  const notification = isTcpClient(client) ? buildUserMessageNotification(message.params || {}) : null;
  if (notification) {
    broadcastToClients(notification);
    log(`synthetic active-turn user message thread=${notification.params.threadId} turn=${notification.params.turnId} source=${client.id}`);
  }
  if (hasId(message)) {
    sendToClient(client, {
      jsonrpc: "2.0",
      id: message.id,
      result: { ok: Boolean(notification) },
    });
  }
  return true;
}

function trackTurnNotification(message) {
  if (!message || !message.method) return;
  const params = message.params || {};
  const threadId = params.threadId;
  const turnId = params.turn && params.turn.id;
  if (!threadId) return;

  if (message.method === "turn/started" && turnId) {
    activeTurnsByThread.set(threadId, turnId);
    return;
  }

  if (message.method === "turn/completed") {
    if (!turnId || activeTurnsByThread.get(threadId) === turnId) {
      activeTurnsByThread.delete(threadId);
    }
  }
}

function sendToChild(message) {
  if (!child || !child.stdin.writable) {
    throw new Error("real codex app-server is not running");
  }
  writeJsonLine((line) => child.stdin.write(line), message);
}

function handleClientLine(client, line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch (err) {
    log(`invalid client json from ${client.id}: ${err.message}`);
    return;
  }

  if (handleMuxMethod(client, message)) return;

  if (hasId(message)) {
    const originalId = message.id;
    const internalId = `${client.id}:${String(originalId)}`;
    pending.set(internalId, { client, originalId });
    message.id = internalId;
  }

  try {
    sendToChild(message);
  } catch (err) {
    if (hasId(message)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      sendToClient(client, {
        jsonrpc: "2.0",
        id: request ? request.originalId : message.id,
        error: { code: -32000, message: err.message },
      });
    }
  }
}

function handleChildLine(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch (err) {
    log(`non-json app-server stdout: ${line.slice(0, 500)}`);
    return;
  }

  if (hasId(message)) {
    const request = pending.get(message.id);
    if (!request) {
      log(`response for unknown request id ${String(message.id)}`);
      return;
    }
    pending.delete(message.id);
    message.id = request.originalId;
    sendToClient(request.client, message);
    return;
  }

  if (message.method) {
    trackTurnNotification(message);
    broadcastToClients(message);
  }
}

function startChild() {
  assertCommandAvailable(CODEX_EXE, "Codex executable");
  child = spawn(CODEX_EXE, CODEX_ARGS, {
    cwd: APP_ROOT,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.on("error", (err) => {
    log(`failed to start real app-server exe=${CODEX_EXE}: ${err.message}`);
    for (const client of clients.values()) {
      try {
        client.close();
      } catch (_) {}
    }
    if (!shuttingDown) shutdown(1);
  });
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    childBuffer += String(chunk);
    let index;
    while ((index = childBuffer.indexOf("\n")) >= 0) {
      const line = childBuffer.slice(0, index).trim();
      childBuffer = childBuffer.slice(index + 1);
      if (line) handleChildLine(line);
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    const text = String(chunk || "").trim();
    if (text) log(`[real app-server] ${text.slice(0, 2000)}`);
  });
  child.on("exit", (code, signal) => {
    log(`real app-server exited code=${code ?? ""} signal=${signal ?? ""}`);
    for (const client of clients.values()) {
      try {
        client.close();
      } catch (_) {}
    }
    if (!shuttingDown) shutdown(1);
  });
  log(`started real app-server pid=${child.pid} exe=${CODEX_EXE} args=${CODEX_ARGS.join(" ")}`);
}

function startTcpServer() {
  tcpServer = net.createServer((socket) => {
    socket.setEncoding("utf8");
    const client = addClient(
      `tcp:${socket.remoteAddress || ""}:${socket.remotePort || ""}`,
      (line) => socket.write(line),
      () => socket.end(),
    );
    const onData = createLineParser((line) => handleClientLine(client, line));
    socket.on("data", onData);
    socket.on("close", () => removeClient(client));
    socket.on("error", (err) => {
      log(`tcp client error ${client.id}: ${err.message}`);
      removeClient(client);
    });
  });

  tcpServer.listen(PORT, HOST, () => {
    const address = tcpServer.address();
    const endpoint = {
      protocol: "jsonl-tcp",
      host: address.address,
      port: address.port,
      pid: process.pid,
      childPid: child ? child.pid : null,
      startedAt: new Date().toISOString(),
      capabilities: {
        mobileUserMessageEcho: true,
      },
    };
    fs.mkdirSync(path.dirname(ENDPOINT_FILE), { recursive: true });
    fs.writeFileSync(ENDPOINT_FILE, JSON.stringify(endpoint, null, 2), "utf8");
    log(`listening ${endpoint.host}:${endpoint.port}; endpoint=${ENDPOINT_FILE}`);
  });
  tcpServer.on("error", (err) => {
    log(`tcp server error: ${err.message}`);
    shutdown(1);
  });
}

function attachStdioClient() {
  const client = addClient(
    "desktop-stdio",
    (line) => process.stdout.write(line),
    () => process.stdin.destroy(),
  );
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", createLineParser((line) => handleClientLine(client, line)));
  process.stdin.on("end", () => {
    removeClient(client);
    if (!STANDALONE) shutdown(0);
  });
  process.stdin.on("error", (err) => {
    log(`stdin error: ${err.message}`);
    removeClient(client);
    if (!STANDALONE) shutdown(1);
  });
}

function cleanupEndpointFile() {
  try {
    if (!fs.existsSync(ENDPOINT_FILE)) return;
    const endpoint = JSON.parse(fs.readFileSync(ENDPOINT_FILE, "utf8"));
    if (endpoint && endpoint.pid === process.pid) fs.unlinkSync(ENDPOINT_FILE);
  } catch (_) {}
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  cleanupEndpointFile();
  try {
    if (tcpServer) tcpServer.close();
  } catch (_) {}
  try {
    if (child && child.exitCode === null && child.signalCode === null) child.kill();
  } catch (_) {}
  setTimeout(() => process.exit(code), 50).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("exit", cleanupEndpointFile);

try {
  startChild();
  startTcpServer();
  if (!STANDALONE) attachStdioClient();
} catch (err) {
  log(`fatal: ${err.stack || err.message || String(err)}`);
  shutdown(1);
}
