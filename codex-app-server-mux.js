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
const KEEP_ALIVE = STANDALONE || /^(1|true|yes|on)$/i.test(process.env.CODEX_MUX_KEEP_ALIVE || "");
const RUNTIME_DIR = process.env.CODEX_MUX_RUNTIME_DIR || path.join(CODEX_HOME, "app-server-mux");
const ENDPOINT_FILE = process.env.CODEX_MUX_ENDPOINT_FILE || path.join(RUNTIME_DIR, "endpoint.json");
const LOG_FILE = process.env.CODEX_MUX_LOG_FILE || path.join(RUNTIME_DIR, "mux.log");
const LOG_MAX_BYTES = Math.max(1024 * 1024, Number(process.env.CODEX_MUX_LOG_MAX_BYTES || String(30 * 1024 * 1024)));
const LOG_KEEP_BYTES = Math.max(
  256 * 1024,
  Math.min(LOG_MAX_BYTES, Number(process.env.CODEX_MUX_LOG_KEEP_BYTES || String(8 * 1024 * 1024))),
);
const REPLAY_BUFFER_LIMIT = Math.max(0, Number(process.env.CODEX_MUX_REPLAY_BUFFER_LIMIT || "1200"));
const REPLAY_BUFFER_MAX_AGE_MS = Math.max(0, Number(process.env.CODEX_MUX_REPLAY_BUFFER_MAX_AGE_MS || String(30 * 60 * 1000)));
const REPLAY_DESKTOP_NOTIFICATIONS = /^(1|true|yes|on)$/i.test(process.env.CODEX_MUX_REPLAY_DESKTOP_NOTIFICATIONS || "");
const MOBILE_MAX_DELTA_CHARS = Math.max(1024, Number(process.env.CODEX_MUX_MOBILE_MAX_DELTA_CHARS || "12000"));
const MOBILE_MAX_OUTPUT_CHARS = Math.max(MOBILE_MAX_DELTA_CHARS, Number(process.env.CODEX_MUX_MOBILE_MAX_OUTPUT_CHARS || "20000"));
const MOBILE_DROP_NOTIFICATION_METHODS = new Set([
  "item/commandExecution/outputDelta",
  "item/fileChange/outputDelta",
  "item/reasoning/textDelta",
  "item/reasoning/summaryTextDelta",
]);
const MOBILE_OUTPUT_FIELD_PATTERN = /^(aggregatedOutput|output|stdout|stderr|diff|patch|logs?|rawOutput)$/i;

let nextClientId = 1;
let child = null;
let tcpServer = null;
let childBuffer = "";
let shuttingDown = false;
const clients = new Map();
const pending = new Map();
const serverRequests = new Map();
const activeTurnsByThread = new Map();
const pendingMobileTurnStarts = new Map();
const replayBuffer = [];
let nextSyntheticItemId = 1;
let nextReplaySeq = 1;
let initializeResult = null;
let lastLogTrimAt = 0;

function trimLogFile(filePath, maxBytes, keepBytes) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size <= maxBytes) return;
    const bytesToKeep = Math.max(0, Math.min(keepBytes, stat.size));
    const fd = fs.openSync(filePath, "r");
    try {
      const buffer = Buffer.alloc(bytesToKeep);
      const offset = stat.size - bytesToKeep;
      const bytesRead = fs.readSync(fd, buffer, 0, bytesToKeep, offset);
      fs.writeFileSync(filePath, buffer.subarray(0, bytesRead));
    } finally {
      fs.closeSync(fd);
    }
  } catch (_) {
    // Keep stdio clean for the desktop app-server protocol.
  }
}

function log(message) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    const now = Date.now();
    if (now - lastLogTrimAt > 60_000) {
      lastLogTrimAt = now;
      trimLogFile(LOG_FILE, LOG_MAX_BYTES, LOG_KEEP_BYTES);
    }
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${message}\n`, "utf8");
  } catch (_) {
    // Keep stdio clean for the desktop app-server protocol.
  }
}

function hasId(message) {
  return Object.prototype.hasOwnProperty.call(message, "id");
}

function writeJsonLine(write, message) {
  return write(`${JSON.stringify(message)}\n`);
}

function truncateMiddle(value, maxChars, label) {
  const text = String(value || "");
  if (text.length <= maxChars) return text;
  const head = Math.max(1, Math.floor(maxChars * 0.45));
  const tail = Math.max(1, maxChars - head);
  return `${text.slice(0, head)}\n\n[${label} truncated: ${text.length} chars total]\n\n${text.slice(-tail)}`;
}

function truncateTail(value, maxChars, label) {
  const text = String(value || "");
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[${label} truncated: ${text.length} chars total]`;
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
  const client = { id, name, write, close, clientInfo: null, backpressureSince: 0 };
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

function compactMobileObject(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 6) return value;
  if (Array.isArray(value)) {
    return value.map((item) => compactMobileObject(item, depth + 1));
  }
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string") {
      if (key === "delta") {
        out[key] = truncateMiddle(child, MOBILE_MAX_DELTA_CHARS, "text delta");
      } else if (MOBILE_OUTPUT_FIELD_PATTERN.test(key)) {
        out[key] = truncateTail(child, MOBILE_MAX_OUTPUT_CHARS, key);
      } else if (child.length > MOBILE_MAX_OUTPUT_CHARS * 4) {
        out[key] = truncateMiddle(child, MOBILE_MAX_OUTPUT_CHARS, "large payload");
      } else {
        out[key] = child;
      }
    } else {
      out[key] = compactMobileObject(child, depth + 1);
    }
  }
  return out;
}

function compactMobileNotification(message) {
  if (!message || hasId(message) || !message.method) return message;
  const method = String(message.method);
  if (MOBILE_DROP_NOTIFICATION_METHODS.has(method)) return null;
  return compactMobileObject(cloneJson(message));
}

function messageForClient(client, message) {
  if (!isMobileWebClient(client)) return message;
  return compactMobileNotification(message);
}

function sendToClient(client, message) {
  try {
    const outgoing = messageForClient(client, message);
    if (!outgoing) return;
    if (writeJsonLine(client.write, outgoing) === false && isTcpClient(client) && !client.backpressureSince) {
      client.backpressureSince = Date.now();
      log(`tcp client backpressure ${client.id}; waiting for drain`);
    }
  } catch (err) {
    log(`failed to send to ${client.id}: ${err.message}`);
    removeClient(client);
  }
}

function broadcastToClients(message) {
  for (const client of clients.values()) sendToClient(client, message);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function isReplayableNotification(message) {
  if (!message || hasId(message) || !message.method) return false;
  const method = String(message.method);
  return method.startsWith("turn/")
    || method.startsWith("item/")
    || method.startsWith("thread/")
    || method === "account/rateLimits/updated";
}

function pruneReplayBuffer(now = Date.now()) {
  if (REPLAY_BUFFER_MAX_AGE_MS > 0) {
    const oldestAllowed = now - REPLAY_BUFFER_MAX_AGE_MS;
    while (replayBuffer.length && replayBuffer[0].receivedAt < oldestAllowed) {
      replayBuffer.shift();
    }
  }
  if (REPLAY_BUFFER_LIMIT > 0) {
    while (replayBuffer.length > REPLAY_BUFFER_LIMIT) replayBuffer.shift();
  } else {
    replayBuffer.length = 0;
  }
}

function cacheReplayNotification(message) {
  if (REPLAY_BUFFER_LIMIT <= 0 || !isReplayableNotification(message)) return;
  try {
    const replayMessage = compactMobileNotification(message);
    if (!replayMessage) return;
    replayBuffer.push({
      seq: nextReplaySeq++,
      receivedAt: Date.now(),
      message: replayMessage,
    });
    pruneReplayBuffer();
  } catch (err) {
    log(`failed to cache replay notification method=${message && message.method ? message.method : ""}: ${err.message}`);
  }
}

function rememberClientInfo(client, message) {
  if (!client || !message || message.method !== "initialize") return;
  const clientInfo = message.params && message.params.clientInfo;
  if (!clientInfo || typeof clientInfo !== "object") return;
  client.clientInfo = cloneJson(clientInfo);
  const name = client.clientInfo.name || "";
  const title = client.clientInfo.title || "";
  log(`client ${client.id} initialized name=${String(name).slice(0, 80)} title=${String(title).slice(0, 120)}`);
}

function isMobileWebClient(client) {
  const info = (client && client.clientInfo) || {};
  const name = String(info.name || "").toLowerCase();
  const title = String(info.title || "").toLowerCase();
  return name === "codex-mobile-web" || title.includes("codex mobile web");
}

function replayMissedNotifications(client, reason) {
  if (!client) return;
  pruneReplayBuffer();
  let requestCount = 0;
  let notificationCount = 0;
  for (const request of serverRequests.values()) {
    if (!request.message) continue;
    sendToClient(client, request.message);
    requestCount += 1;
  }
  const shouldReplayNotifications = isMobileWebClient(client) || REPLAY_DESKTOP_NOTIFICATIONS;
  if (shouldReplayNotifications) {
    const replayLimit = Number(client.clientInfo && client.clientInfo.replayNotificationLimit);
    const replayEntries = Number.isFinite(replayLimit) && replayLimit >= 0
      ? (replayLimit === 0 ? [] : replayBuffer.slice(-replayLimit))
      : replayBuffer;
    for (const entry of replayEntries) {
      sendToClient(client, entry.message);
      notificationCount += 1;
    }
  }
  if (requestCount > 0 || notificationCount > 0) {
    log(`replayed ${requestCount} pending request(s), ${notificationCount} buffered notification(s) to ${client.id} after ${reason}`);
  }
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
        id: params.clientSubmissionId
          ? `mux-user-${threadId}-${turnId}-${String(params.clientSubmissionId)}`
          : params.muxRequestId
            ? `mux-user-${threadId}-${turnId}-${String(params.muxRequestId).replace(/[^a-zA-Z0-9_.:-]/g, "_")}`
          : `mux-user-${Date.now()}-${nextSyntheticItemId++}`,
        type: "userMessage",
        content,
      },
    },
  };
}

function turnSummaryFromThread(thread) {
  if (!thread || typeof thread !== "object") return null;
  const turns = Array.isArray(thread.turns) ? thread.turns : [];
  const latest = turns.length ? turns[turns.length - 1] : null;
  return {
    threadId: String(thread.id || ""),
    turnCount: turns.length,
    latestTurnId: latest && latest.id ? String(latest.id) : "",
    latestTurnStatus: latest && latest.status ? String(latest.status) : "",
    updatedAt: thread.updatedAt == null ? "" : String(thread.updatedAt),
    status: thread.status && thread.status.type ? String(thread.status.type) : "",
  };
}

function logThreadRpcResponse(request, message) {
  if (!request || (request.method !== "thread/read" && request.method !== "thread/resume")) return;
  const requestThreadId = request.params && request.params.threadId ? String(request.params.threadId) : "";
  if (message && message.error) {
    const err = message.error || {};
    log(`[sync-health] method=${request.method} client=${request.client.id} thread=${requestThreadId} error=${err.code || ""}:${String(err.message || "").slice(0, 180)}`);
    return;
  }
  const summary = turnSummaryFromThread(message && message.result && message.result.thread);
  log(`[sync-health] method=${request.method} client=${request.client.id} thread=${requestThreadId || (summary && summary.threadId) || ""} status=${summary ? summary.status : ""} turns=${summary ? summary.turnCount : ""} latest=${summary ? summary.latestTurnId : ""} latestStatus=${summary ? summary.latestTurnStatus : ""} updatedAt=${summary ? summary.updatedAt : ""}`);
}

function handleMuxMethod(client, message) {
  if (!message || message.method !== "mux/userMessage") return false;
  const notification = isTcpClient(client) ? buildUserMessageNotification(message.params || {}) : null;
  if (notification) {
    cacheReplayNotification(notification);
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

function rememberPendingMobileTurnStart(internalId, client, message) {
  if (!internalId || !isMobileWebClient(client) || !message || message.method !== "turn/start") return;
  const params = message.params || {};
  const threadId = params.threadId ? String(params.threadId) : "";
  if (!threadId || !Array.isArray(params.input) || !params.input.length) return;
  const entry = {
    internalId,
    threadId,
    input: cloneJson(params.input),
    muxRequestId: internalId,
    receivedAt: Date.now(),
  };
  pendingMobileTurnStarts.set(internalId, entry);
  setTimeout(() => pendingMobileTurnStarts.delete(internalId), 120000).unref();
}

function emitPendingMobileTurnStartUserMessage(message) {
  if (!message || message.method !== "turn/started") return;
  const params = message.params || {};
  const threadId = params.threadId ? String(params.threadId) : "";
  const turnId = params.turn && params.turn.id ? String(params.turn.id) : "";
  if (!threadId || !turnId) return;

  let selected = null;
  for (const entry of pendingMobileTurnStarts.values()) {
    if (entry.threadId !== threadId) continue;
    if (!selected || entry.receivedAt < selected.receivedAt) selected = entry;
  }
  if (!selected) return;

  pendingMobileTurnStarts.delete(selected.internalId);
  const notification = buildUserMessageNotification({
    threadId,
    turnId,
    input: selected.input,
    muxRequestId: selected.muxRequestId,
  });
  if (!notification) return;
  cacheReplayNotification(notification);
  broadcastToClients(notification);
  log(`synthetic new-turn user message thread=${threadId} turn=${turnId} source=${selected.internalId}`);
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

  rememberClientInfo(client, message);

  if (handleMuxMethod(client, message)) return;

  if (message.method === "initialize" && hasId(message) && initializeResult) {
    sendToClient(client, {
      jsonrpc: "2.0",
      id: message.id,
      result: initializeResult,
    });
    replayMissedNotifications(client, "cached initialize");
    log(`replayed cached initialize result for ${client.id}`);
    return;
  }

  if (hasId(message) && !message.method) {
    const requestId = String(message.id);
    if (!serverRequests.has(requestId)) {
      log(`client response for unknown server request id ${requestId} from ${client.id}`);
      return;
    }
    try {
      sendToChild(message);
      serverRequests.delete(requestId);
      log(`forwarded server request response id=${requestId} from ${client.id}`);
    } catch (err) {
      log(`failed to forward server request response id=${requestId}: ${err.message}`);
    }
    return;
  }

  if (hasId(message)) {
    const originalId = message.id;
    const internalId = `${client.id}:${String(originalId)}`;
    pending.set(internalId, {
      client,
      originalId,
      method: message.method || "",
      params: message.params && typeof message.params === "object" ? cloneJson(message.params) : {},
    });
    message.id = internalId;
    rememberPendingMobileTurnStart(internalId, client, message);
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

  if (hasId(message) && message.method) {
    const requestId = String(message.id);
    serverRequests.set(requestId, {
      method: message.method,
      receivedAt: Date.now(),
      message: cloneJson(message),
    });
    broadcastToClients(message);
    log(`broadcast server request id=${requestId} method=${message.method}`);
    return;
  }

  if (hasId(message)) {
    const request = pending.get(message.id);
    if (!request) {
      log(`response for unknown request id ${String(message.id)}`);
      return;
    }
    pending.delete(message.id);
    if (message.error) pendingMobileTurnStarts.delete(String(message.id));
    if (request.method === "initialize") {
      if (message.error && /already initialized/i.test(message.error.message || "")) {
        message.result = initializeResult || { userAgent: "shared app-server (already initialized)" };
        delete message.error;
      }
      if (!message.error) initializeResult = message.result || {};
    }
    logThreadRpcResponse(request, message);
    message.id = request.originalId;
    sendToClient(request.client, message);
    if (request.method === "initialize" && !message.error) {
      replayMissedNotifications(request.client, "initialize");
    }
    return;
  }

  if (message.method) {
    if (message.method === "serverRequest/resolved" && message.params && message.params.requestId != null) {
      serverRequests.delete(String(message.params.requestId));
    }
    trackTurnNotification(message);
    cacheReplayNotification(message);
    broadcastToClients(message);
    emitPendingMobileTurnStartUserMessage(message);
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
    socket.on("drain", () => {
      if (client.backpressureSince) {
        log(`tcp client drain ${client.id} after ${Date.now() - client.backpressureSince}ms`);
        client.backpressureSince = 0;
      }
    });
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
        serverRequestProxy: true,
        notificationReplay: true,
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
  const disconnectDesktop = (code) => {
    removeClient(client);
    if (!KEEP_ALIVE) shutdown(code);
  };
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", createLineParser((line) => handleClientLine(client, line)));
  process.stdin.on("end", () => {
    disconnectDesktop(0);
  });
  process.stdin.on("error", (err) => {
    log(`stdin error: ${err.message}`);
    disconnectDesktop(1);
  });
  process.stdout.on("error", (err) => {
    log(`stdout error: ${err.message}`);
    disconnectDesktop(0);
  });
}

function readExistingEndpoint() {
  try {
    const endpoint = JSON.parse(fs.readFileSync(ENDPOINT_FILE, "utf8"));
    if (!endpoint || endpoint.pid === process.pid) return null;
    if (endpoint.protocol !== "jsonl-tcp" || !endpoint.host || !endpoint.port) return null;
    return endpoint;
  } catch (_) {
    return null;
  }
}

function connectExistingEndpoint(endpoint) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: endpoint.host, port: Number(endpoint.port) });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("existing mux tcp connection timed out"));
    }, 1200);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.setEncoding("utf8");
      resolve(socket);
    });
    socket.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function attachDesktopToExistingMux(socket, endpoint) {
  let exiting = false;
  const finish = (code) => {
    if (exiting) return;
    exiting = true;
    try {
      socket.end();
    } catch (_) {}
    setTimeout(() => process.exit(code), 20).unref();
  };

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", createLineParser((line) => socket.write(`${line}\n`)));
  process.stdin.on("end", () => finish(0));
  process.stdin.on("error", (err) => {
    log(`adapter stdin error: ${err.message}`);
    finish(1);
  });

  socket.on("data", (chunk) => process.stdout.write(chunk));
  socket.on("close", () => finish(1));
  socket.on("error", (err) => {
    log(`adapter socket error: ${err.message}`);
    finish(1);
  });
  process.stdout.on("error", (err) => {
    log(`adapter stdout error: ${err.message}`);
    finish(0);
  });
  log(`attached desktop stdio to existing mux ${endpoint.host}:${endpoint.port} pid=${endpoint.pid || ""}`);
}

async function tryAttachToExistingMux() {
  if (STANDALONE || !KEEP_ALIVE) return false;
  const endpoint = readExistingEndpoint();
  if (!endpoint) return false;
  try {
    const socket = await connectExistingEndpoint(endpoint);
    attachDesktopToExistingMux(socket, endpoint);
    return true;
  } catch (err) {
    log(`existing mux endpoint unavailable; starting a new mux: ${err.message}`);
    return false;
  }
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

async function main() {
  if (await tryAttachToExistingMux()) return;
  startChild();
  startTcpServer();
  if (!STANDALONE) attachStdioClient();
}

main().catch((err) => {
  log(`fatal: ${err.stack || err.message || String(err)}`);
  shutdown(1);
});
