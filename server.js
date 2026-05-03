"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const net = require("node:net");

const APP_ROOT = __dirname;
const PUBLIC_ROOT = path.join(APP_ROOT, "public");
const USER_HOME = process.env.USERPROFILE || process.env.HOME || process.cwd();
const RUNTIME_ROOT = process.env.CODEX_MOBILE_RUNTIME_DIR || path.join(USER_HOME, ".codex-mobile-web");
const CODEX_HOME = process.env.CODEX_HOME || path.join(USER_HOME, ".codex");
const STATE_DB = path.join(CODEX_HOME, "state_5.sqlite");
const CODEX_EXE = process.env.CODEX_MOBILE_CODEX_EXE || "codex";
const MUX_ENDPOINT_FILE = process.env.CODEX_MOBILE_MUX_ENDPOINT_FILE || path.join(CODEX_HOME, "app-server-mux", "endpoint.json");
const EXTERNAL_APP_SERVER_WS = process.env.CODEX_MOBILE_APP_SERVER_WS || "";
const EXTERNAL_APP_SERVER_TCP = process.env.CODEX_MOBILE_APP_SERVER_TCP || "";
const HOST = process.env.CODEX_MOBILE_HOST || "0.0.0.0";
const PORT = Number(process.env.CODEX_MOBILE_PORT || "8787");
const DISABLE_AUTH = /^(1|true|yes|on)$/i.test(process.env.CODEX_MOBILE_DISABLE_AUTH || "");
const AUTH_KEY_FILE = process.env.CODEX_MOBILE_KEY_FILE || path.join(RUNTIME_ROOT, "access_key");
const AUTH_KEY = DISABLE_AUTH ? "" : loadAuthKey();
const MAX_TEXT_CHARS = 60000;
const MAX_COMMAND_OUTPUT_CHARS = 8000;
const MAX_COMMAND_OUTPUT_CHARS_PER_TURN = 48000;
const MAX_STRUCTURED_CHARS = 24000;
const MAX_DELTA_CHARS = 12000;
const MAX_THREAD_TURNS = Math.max(1, Math.min(100, Number(process.env.CODEX_MOBILE_THREAD_TURNS || "12")));
const OPERATIONAL_ITEM_TYPES = new Set(["commandExecution", "fileChange", "dynamicToolCall", "mcpToolCall"]);
const DEFAULT_RPC_TIMEOUT_MS = 30000;
const READ_RPC_TIMEOUT_MS = 12000;
const MUTATION_RPC_TIMEOUT_MS = 120000;
const SAFE_RETRY_METHODS = new Set(["initialize", "thread/list", "thread/read", "thread/turns/list"]);

let clients = new Set();

function loadAuthKey() {
  if (process.env.CODEX_MOBILE_KEY && process.env.CODEX_MOBILE_KEY.trim()) {
    return process.env.CODEX_MOBILE_KEY.trim();
  }
  try {
    const value = fs.readFileSync(AUTH_KEY_FILE, "utf8").trim();
    if (value) return value;
  } catch (_) {
    // Create a durable local key so reloads and server restarts do not invalidate phone sessions.
  }
  const key = crypto.randomBytes(18).toString("base64url");
  fs.mkdirSync(path.dirname(AUTH_KEY_FILE), { recursive: true });
  fs.writeFileSync(AUTH_KEY_FILE, `${key}\n`, { encoding: "utf8", mode: 0o600 });
  return key;
}

function timingSafeEquals(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function getUrl(req) {
  return new URL(req.url, `http://${req.headers.host || "localhost"}`);
}

function isAuthorized(req) {
  if (DISABLE_AUTH) return true;
  const url = getUrl(req);
  const key = req.headers["x-codex-mobile-key"]
    || url.searchParams.get("key")
    || parseCookies(req.headers.cookie).codex_mobile_key;
  return timingSafeEquals(key, AUTH_KEY);
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function truncateMiddle(value, maxChars, label) {
  const text = String(value ?? "");
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.42);
  const tail = maxChars - head;
  return `${text.slice(0, head)}\n\n[${label} truncated: ${text.length} chars total, showing first ${head} and last ${tail}]\n\n${text.slice(-tail)}`;
}

function truncateTail(value, maxChars, label) {
  const text = String(value ?? "");
  if (text.length <= maxChars) return text;
  return `[${label} truncated: ${text.length} chars total, showing last ${maxChars}]\n\n${text.slice(-maxChars)}`;
}

function compactStructured(value) {
  if (value == null) return value;
  let raw;
  try {
    raw = JSON.stringify(value);
  } catch (_) {
    raw = String(value);
  }
  if (raw.length <= MAX_STRUCTURED_CHARS) return value;
  return {
    truncated: true,
    totalChars: raw.length,
    preview: truncateMiddle(raw, MAX_STRUCTURED_CHARS, "structured payload"),
  };
}

function compactStringArray(values, maxChars, label) {
  if (!Array.isArray(values)) return values;
  return values.map((value) => typeof value === "string" ? truncateMiddle(value, maxChars, label) : compactStructured(value));
}

function statusText(status) {
  if (!status) return "";
  if (typeof status === "string") return status;
  return status.type || JSON.stringify(status);
}

function normalizeFsPath(value) {
  return String(value || "")
    .replace(/^\\\\\?\\/, "")
    .replace(/[\\/]+/g, "\\")
    .replace(/\\+$/, "")
    .toLowerCase();
}

function visibleWorkspaceRoots(globalState = readGlobalState()) {
  const roots = new Set();
  for (const key of ["active-workspace-roots", "electron-saved-workspace-roots", "project-order"]) {
    const values = globalState[key];
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      if (typeof value === "string" && value.trim()) roots.add(value);
    }
  }
  return roots;
}

function visibleWorkspaceKeys(globalState = readGlobalState()) {
  return new Set([...visibleWorkspaceRoots(globalState)].map(normalizeFsPath).filter(Boolean));
}

function visibleProjectlessThreadIds(globalState = readGlobalState()) {
  const ids = globalState["projectless-thread-ids"];
  return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string" && id) : []);
}

function visibilityFromGlobalState(globalState = readGlobalState()) {
  return {
    workspaceKeys: visibleWorkspaceKeys(globalState),
    projectlessThreadIds: visibleProjectlessThreadIds(globalState),
  };
}

function isHiddenThread(thread, visibility = null) {
  if (!thread || typeof thread !== "object") return true;
  const view = visibility || visibilityFromGlobalState();
  const status = statusText(thread.status).toLowerCase();
  const location = String(thread.path || thread.rolloutPath || thread.rollout_path || "").toLowerCase();
  if (thread.archived || thread.archivedAt || thread.archived_at || thread.isArchived) return true;
  if (thread.deleted || thread.deletedAt || thread.deleted_at || thread.isDeleted || thread.removed || thread.removedAt) return true;
  if (/archived|deleted|removed/.test(status)) return true;
  if (/[/\\](archived|deleted|trash|removed)[_-]?sessions[/\\]/.test(location)) return true;
  if (view.workspaceKeys && view.workspaceKeys.size > 0) {
    const cwd = normalizeFsPath(thread.cwd);
    if (cwd) return !view.workspaceKeys.has(cwd);
    return !view.projectlessThreadIds.has(thread.id);
  }
  return false;
}

function filterVisibleThreads(result, globalState = readGlobalState()) {
  const visibility = visibilityFromGlobalState(globalState);
  if (!result || typeof result !== "object") return result;
  const out = Object.assign({}, result);
  if (Array.isArray(out.data)) out.data = out.data.filter((thread) => !isHiddenThread(thread, visibility));
  if (Array.isArray(out.threads)) out.threads = out.threads.filter((thread) => !isHiddenThread(thread, visibility));
  return out;
}

function isCompletedStatus(status) {
  return /completed|failed|cancel|error|interrupted/i.test(statusText(status));
}

function isLiveTurn(turn) {
  const text = statusText(turn && turn.status).toLowerCase();
  return /(running|active|queued|processing|in_progress|in-progress)/.test(text)
    || (text === "interrupted" && turn && !turn.completedAt && !turn.durationMs);
}

function isContextCompactionType(type) {
  return /context.*compaction|context.*compression|context_compaction|context_compression/i.test(String(type || ""));
}

function isPathLikeValue(value) {
  const text = String(value || "");
  if (!text || text.includes("\n") || text.includes("\r")) return false;
  return /^[A-Za-z]:[\\/]/.test(text)
    || /^\\\\\?\\/.test(text)
    || /^[/\\][^/\\]+/.test(text)
    || /[\\/][^/\\]+\.[A-Za-z0-9]{1,12}$/.test(text);
}

function isFileNameLikeValue(value) {
  const text = String(value || "");
  return Boolean(text && !text.includes("\n") && !text.includes("\r") && /^[^\\/]+\.[A-Za-z0-9]{1,12}$/.test(text));
}

function collectFileNames(value, out = [], keyHint = "") {
  if (out.length >= 5 || value == null) return out;
  if (typeof value === "string") {
    const keyLooksPath = /^(path|file|filepath|filename|name|target|source|uri)$/i.test(keyHint);
    if (isPathLikeValue(value) || (keyLooksPath && isFileNameLikeValue(value))) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectFileNames(entry, out, keyHint);
    return out;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (/^(path|file|filePath|filename|name|target|source|uri)$/i.test(key) && typeof entry === "string"
        && (isPathLikeValue(entry) || isFileNameLikeValue(entry))) {
        out.push(entry);
        if (out.length >= 5) return out;
        continue;
      }
      collectFileNames(entry, out, key);
      if (out.length >= 5) return out;
    }
  }
  return out;
}

function compactOperationalItem(out) {
  const compact = {
    id: out.id,
    type: out.type,
    status: out.status,
    server: out.server,
    namespace: out.namespace,
    tool: out.tool,
    command: typeof out.command === "string" ? truncateMiddle(out.command, 180, "command") : undefined,
    fileNames: [...new Set(collectFileNames(out.changes || out.arguments || out.result || out.contentItems))].slice(0, 5),
    mobileLiveOperation: true,
  };
  return Object.fromEntries(Object.entries(compact).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined;
  }));
}

function compactItem(item) {
  if (!item || typeof item !== "object") return item;
  const out = Object.assign({}, item);
  if (isContextCompactionType(out.type)) {
    return {
      id: out.id,
      type: out.type,
      mobileNotice: "历史上下文已压缩",
    };
  }
  if (OPERATIONAL_ITEM_TYPES.has(out.type)) {
    return compactOperationalItem(out);
  }
  if (typeof out.text === "string") out.text = truncateMiddle(out.text, MAX_TEXT_CHARS, "text");
  if (Array.isArray(out.content)) out.content = compactStringArray(out.content, MAX_TEXT_CHARS, "content");
  if (Array.isArray(out.summary)) out.summary = compactStringArray(out.summary, MAX_TEXT_CHARS, "summary");
  if (out.type === "commandExecution" && typeof out.aggregatedOutput === "string") {
    out.outputTotalChars = out.outputTotalChars || out.aggregatedOutput.length;
    out.outputTruncated = out.aggregatedOutput.length > MAX_COMMAND_OUTPUT_CHARS || Boolean(out.outputTruncated);
    out.aggregatedOutput = truncateTail(out.aggregatedOutput, MAX_COMMAND_OUTPUT_CHARS, "command output");
  }
  if (out.result) out.result = compactStructured(out.result);
  if (out.contentItems) out.contentItems = compactStructured(out.contentItems);
  if (out.changes) out.changes = compactStructured(out.changes);
  return out;
}

function trailingOperationIndex(items, allowLiveOperation) {
  if (!allowLiveOperation || !Array.isArray(items)) return -1;
  const lastOperationIndex = items.findLastIndex((item) => item && OPERATIONAL_ITEM_TYPES.has(item.type));
  if (lastOperationIndex < 0) return -1;
  const hasLaterVisibleItem = items.slice(lastOperationIndex + 1).some((item) => item && !OPERATIONAL_ITEM_TYPES.has(item.type));
  return hasLaterVisibleItem ? -1 : lastOperationIndex;
}

function compactTurn(turn, options = {}) {
  if (!turn || typeof turn !== "object") return turn;
  const out = Object.assign({}, turn);
  if (Array.isArray(out.items)) {
    const lastLiveOperationIndex = trailingOperationIndex(out.items, Boolean(options.allowLiveOperation) && isLiveTurn(out));
    out.items = out.items.map(compactItem).filter((item, index) => {
      if (!item || !OPERATIONAL_ITEM_TYPES.has(item.type)) return true;
      return index === lastLiveOperationIndex;
    });
    let remainingOutputBudget = MAX_COMMAND_OUTPUT_CHARS_PER_TURN;
    for (let i = out.items.length - 1; i >= 0; i--) {
      const item = out.items[i];
      if (!item || item.type !== "commandExecution" || typeof item.aggregatedOutput !== "string") continue;
      const output = item.aggregatedOutput;
      if (remainingOutputBudget <= 0) {
        item.outputOmitted = true;
        item.outputTruncated = true;
        item.outputTotalChars = item.outputTotalChars || output.length;
        item.aggregatedOutput = "";
        continue;
      }
      if (output.length > remainingOutputBudget) {
        item.outputTruncated = true;
        item.outputTotalChars = item.outputTotalChars || output.length;
        item.aggregatedOutput = truncateTail(output, remainingOutputBudget, "turn command output");
        remainingOutputBudget = 0;
        continue;
      }
      remainingOutputBudget -= output.length;
    }
  }
  return out;
}

function compactThread(thread) {
  if (!thread || typeof thread !== "object") return thread;
  const out = Object.assign({}, thread);
  if (Array.isArray(out.turns)) {
    const omitted = Math.max(0, out.turns.length - MAX_THREAD_TURNS);
    if (omitted > 0) {
      out.mobileOmittedTurnCount = omitted;
      out.turns = out.turns.slice(-MAX_THREAD_TURNS);
    }
    const latestIndex = out.turns.length - 1;
    out.turns = out.turns.map((turn, index) => compactTurn(turn, { allowLiveOperation: index === latestIndex }));
  }
  return out;
}

function compactThreadReadResult(result) {
  if (!result || typeof result !== "object") return result;
  const out = Object.assign({}, result);
  if (out.thread) out.thread = compactThread(out.thread);
  return out;
}

function compactTurnsListResult(result) {
  if (!result || typeof result !== "object") return result;
  const out = Object.assign({}, result);
  if (Array.isArray(out.data)) out.data = out.data.map((turn) => compactTurn(turn));
  if (Array.isArray(out.turns)) out.turns = out.turns.map((turn) => compactTurn(turn));
  return out;
}

function compactNotification(payload) {
  if (!payload || payload.type !== "notification" || !payload.params) return payload;
  if (payload.method === "item/commandExecution/outputDelta" || payload.method === "item/fileChange/outputDelta") {
    return null;
  }
  if (payload.method === "item/reasoning/textDelta" || payload.method === "item/reasoning/summaryTextDelta") {
    return null;
  }
  const out = {
    type: payload.type,
    method: payload.method,
    params: Object.assign({}, payload.params),
  };
  if (out.params.item) out.params.item = compactItem(out.params.item);
  if (out.params.turn) out.params.turn = compactTurn(out.params.turn, { allowLiveOperation: true });
  if (payload.method === "item/commandExecution/outputDelta" && typeof out.params.delta === "string") {
    out.params.originalDeltaChars = out.params.delta.length;
    out.params.deltaTruncated = out.params.delta.length > MAX_DELTA_CHARS;
    out.params.delta = truncateTail(out.params.delta, MAX_DELTA_CHARS, "command output delta");
  }
  if ((payload.method === "item/agentMessage/delta" || payload.method === "item/reasoning/textDelta" || payload.method === "item/reasoning/summaryTextDelta") && typeof out.params.delta === "string") {
    out.params.originalDeltaChars = out.params.delta.length;
    out.params.deltaTruncated = out.params.delta.length > MAX_DELTA_CHARS;
    out.params.delta = truncateMiddle(out.params.delta, MAX_DELTA_CHARS, "text delta");
  }
  return out;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 2_000_000) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
  }[ext] || "application/octet-stream";
}

function serveStatic(req, res) {
  const url = getUrl(req);
  const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const target = path.normalize(path.join(PUBLIC_ROOT, rel));
  if (!target.startsWith(PUBLIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": mimeFor(target),
      "Cache-Control": "no-cache",
    });
    res.end(data);
  });
}

function broadcast(payload) {
  const compacted = compactNotification(payload);
  if (!compacted) return;
  const body = `data: ${JSON.stringify(compacted)}\n\n`;
  for (const res of [...clients]) {
    try {
      res.write(body);
    } catch (_) {
      clients.delete(res);
    }
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

class JsonLineConnection {
  constructor(socket) {
    this.socket = socket;
    this.readyState = 1;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.buffer = "";

    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      this.buffer += chunk;
      let index;
      while ((index = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, index).trim();
        this.buffer = this.buffer.slice(index + 1);
        if (line && this.onmessage) this.onmessage({ data: line });
      }
    });
    socket.on("error", (err) => {
      this.readyState = 3;
      if (this.onerror) this.onerror(err);
    });
    socket.on("close", () => {
      this.readyState = 3;
      if (this.onclose) this.onclose();
    });
  }

  send(data) {
    if (this.readyState !== 1) throw new Error("jsonl tcp connection is not open");
    this.socket.write(`${data}\n`);
  }

  close() {
    this.readyState = 3;
    this.socket.end();
  }
}

function parseTcpEndpoint(value, source) {
  if (!value) return null;
  let host = "127.0.0.1";
  let portText = value;
  if (value.includes(":")) {
    const parts = value.split(":");
    portText = parts.pop();
    host = parts.join(":") || host;
  }
  const port = Number(portText);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid ${source} tcp endpoint: ${value}`);
  }
  return { protocol: "jsonl-tcp", host, port, source, required: true };
}

function resolveExternalEndpoint() {
  if (EXTERNAL_APP_SERVER_WS) {
    return { protocol: "ws", url: EXTERNAL_APP_SERVER_WS, source: "CODEX_MOBILE_APP_SERVER_WS", required: true };
  }
  if (EXTERNAL_APP_SERVER_TCP) {
    return parseTcpEndpoint(EXTERNAL_APP_SERVER_TCP, "CODEX_MOBILE_APP_SERVER_TCP");
  }
  try {
    const raw = fs.readFileSync(MUX_ENDPOINT_FILE, "utf8");
    const endpoint = JSON.parse(raw);
    if (endpoint && endpoint.protocol === "jsonl-tcp" && endpoint.host && endpoint.port) {
      return {
        protocol: "jsonl-tcp",
        host: endpoint.host,
        port: Number(endpoint.port),
        source: MUX_ENDPOINT_FILE,
        required: false,
      };
    }
    if (endpoint && endpoint.protocol === "ws" && endpoint.url) {
      return { protocol: "ws", url: endpoint.url, source: MUX_ENDPOINT_FILE, required: false };
    }
  } catch (_) {
    return null;
  }
  return null;
}

class CodexAppServerClient {
  constructor() {
    this.child = null;
    this.ws = null;
    this.port = 0;
    this.endpoint = null;
    this.transportKind = "none";
    this.nextId = 1;
    this.pending = new Map();
    this.connecting = null;
    this.info = null;
    this.ready = false;
    this.lastError = null;
    this.resetting = false;
  }

  async ensure() {
    if (this.ready && this.isTransportOpen()) return;
    if (this.connecting) return this.connecting;
    this.connecting = this.startAndConnect().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  isTransportOpen() {
    return this.ws && this.ws.readyState === 1;
  }

  async startAndConnect() {
    this.closeTransportOnly();
    const externalEndpoint = resolveExternalEndpoint();
    if (externalEndpoint) {
      try {
        await this.connectEndpoint(externalEndpoint);
        await this.initialize();
        return;
      } catch (err) {
        this.closeTransportOnly();
        if (externalEndpoint.required) throw err;
        this.lastError = `shared app-server endpoint unavailable (${err.message}); falling back to managed app-server`;
        console.error(`[codex app-server] ${this.lastError}`);
      }
    }

    await this.startManagedChild();
    await this.connectEndpoint({ protocol: "ws", url: `ws://127.0.0.1:${this.port}`, source: "managed child", required: true });
    await this.initialize();
  }

  async startManagedChild() {
    if (!fs.existsSync(CODEX_EXE)) {
      throw new Error(`Codex executable not found: ${CODEX_EXE}`);
    }
    if (!this.child || this.child.exitCode !== null || this.child.signalCode !== null) {
      this.port = await getFreePort();
      const child = spawn(CODEX_EXE, ["app-server", "--listen", `ws://127.0.0.1:${this.port}`], {
        cwd: APP_ROOT,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.child = child;
      child.stderr.on("data", (chunk) => this.handleAppServerLog(chunk));
      child.stdout.on("data", (chunk) => this.handleAppServerLog(chunk));
      child.on("exit", (code, signal) => {
        if (this.child !== child) return;
        this.ready = false;
        this.lastError = `codex app-server exited (${code ?? signal ?? "unknown"})`;
        broadcast({ type: "status", status: this.status() });
      });
    }
  }

  async initialize() {
    this.info = await this.sendRpc("initialize", {
      clientInfo: { name: "codex-mobile-web", title: "Codex Mobile Web", version: "0.1.0" },
      capabilities: { experimentalApi: true },
    }, READ_RPC_TIMEOUT_MS);
    this.ready = true;
    this.lastError = null;
    broadcast({ type: "status", status: this.status() });
  }

  closeTransportOnly() {
    if (!this.ws) return;
    try {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
    } catch (_) {}
    this.ws = null;
  }

  handleAppServerLog(chunk) {
    const text = String(chunk || "").trim();
    if (!text) return;
    if (/listening on:|readyz:|healthz:/.test(text)) return;
    console.error(`[codex app-server] ${text.slice(0, 1200)}`);
  }

  async connectEndpoint(endpoint) {
    const deadline = Date.now() + 15000;
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        if (endpoint.protocol === "jsonl-tcp") return await this.connectJsonLineTcpOnce(endpoint);
        if (endpoint.protocol === "ws") return await this.connectWebSocketOnce(endpoint.url);
        throw new Error(`unsupported app-server endpoint protocol: ${endpoint.protocol}`);
      } catch (err) {
        lastError = err;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    throw lastError || new Error("failed to connect to codex app-server endpoint");
  }

  connectWebSocketOnce(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => reject(new Error("codex app-server websocket timeout")), 2500);
      ws.onopen = () => {
        clearTimeout(timer);
        this.ws = ws;
        this.endpoint = { protocol: "ws", url };
        this.transportKind = url.includes(`127.0.0.1:${this.port}`) ? "managed-ws-child" : "external-ws";
        ws.onmessage = (event) => this.handleMessage(event.data);
        ws.onclose = () => {
          this.ready = false;
          this.failPending(new Error("codex app-server connection closed"));
          broadcast({ type: "status", status: this.status() });
        };
        ws.onerror = () => {
          this.ready = false;
        };
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error("failed to connect to codex app-server websocket"));
      };
    });
  }

  connectJsonLineTcpOnce(endpoint) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: endpoint.host, port: endpoint.port });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error("codex app-server jsonl tcp timeout"));
      }, 2500);
      socket.once("connect", () => {
        clearTimeout(timer);
        const connection = new JsonLineConnection(socket);
        this.ws = connection;
        this.endpoint = endpoint;
        this.transportKind = "external-jsonl-tcp";
        connection.onmessage = (event) => this.handleMessage(event.data);
        connection.onclose = () => {
          this.ready = false;
          this.failPending(new Error("codex app-server connection closed"));
          broadcast({ type: "status", status: this.status() });
        };
        connection.onerror = () => {
          this.ready = false;
        };
        resolve();
      });
      socket.once("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  handleMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch (_) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(msg, "id") && this.pending.has(msg.id)) {
      const { resolve, reject, timer } = this.pending.get(msg.id);
      clearTimeout(timer);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    if (msg.method) {
      broadcast({ type: "notification", method: msg.method, params: msg.params || null });
    }
  }

  failPending(err) {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(err);
    }
    this.pending.clear();
  }

  resetConnection(reason) {
    if (this.resetting) return;
    this.resetting = true;
    this.ready = false;
    this.lastError = reason;
    console.error(`[codex app-server] resetting connection: ${reason}`);
    this.closeTransportOnly();
    if (this.transportKind === "managed-ws-child" || this.child) {
      const child = this.child;
      this.child = null;
      this.port = 0;
      try {
        if (child && child.exitCode === null && child.signalCode === null) child.kill();
      } catch (_) {}
    }
    this.info = null;
    this.failPending(new Error(reason));
    broadcast({ type: "status", status: this.status() });
    setTimeout(() => {
      this.resetting = false;
    }, 250).unref();
  }

  sendRpc(method, params, timeoutMs = DEFAULT_RPC_TIMEOUT_MS) {
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    if (!this.isTransportOpen()) {
      return Promise.reject(new Error("codex app-server connection is not open"));
    }
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        const err = new Error(`Codex request timed out: ${method}`);
        err.code = "RPC_TIMEOUT";
        reject(err);
        this.resetConnection(err.message);
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
  }

  async request(method, params, options = {}) {
    const timeoutMs = options.timeoutMs || (SAFE_RETRY_METHODS.has(method) ? READ_RPC_TIMEOUT_MS : DEFAULT_RPC_TIMEOUT_MS);
    const retry = options.retry !== false && SAFE_RETRY_METHODS.has(method);
    await this.ensure();
    try {
      return await this.sendRpc(method, params, timeoutMs);
    } catch (err) {
      const recoverable = /timed out|connection is not open|connection closed/i.test(err.message || "");
      if (!retry || !recoverable) throw err;
      await this.ensure();
      return this.sendRpc(method, params, timeoutMs);
    }
  }

  status() {
    return {
      ready: this.ready,
      port: this.port || null,
      transport: this.transportKind,
      endpoint: this.endpoint ? {
        protocol: this.endpoint.protocol,
        source: this.endpoint.source || null,
        host: this.endpoint.host || null,
        port: this.endpoint.port || null,
        url: this.endpoint.url || null,
      } : null,
      muxEndpointFile: MUX_ENDPOINT_FILE,
      codexExe: CODEX_EXE,
      codexHome: CODEX_HOME,
      runtimeRoot: RUNTIME_ROOT,
      userAgent: this.info ? this.info.userAgent : null,
      lastError: this.lastError,
    };
  }
}

const codex = new CodexAppServerClient();

function readGlobalState() {
  const p = path.join(CODEX_HOME, ".codex-global-state.json");
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (_) {
    return {};
  }
}

function rowToFallbackThread(row) {
  const updatedAt = Number(row.updated_at || row.updatedAt || 0);
  return {
    id: row.id,
    name: row.title || row.thread_name || null,
    preview: row.title || row.thread_name || row.id,
    cwd: row.cwd || null,
    updatedAt,
    archived: Boolean(Number(row.archived || 0)),
    archivedAt: row.archived_at || null,
    status: { type: "notLoaded" },
    model: row.model || null,
    effort: row.reasoning_effort || null,
    mobileFallback: true,
  };
}

function filterFallbackThreads(threads, filters = {}) {
  const globalState = filters.globalState || readGlobalState();
  const visibility = visibilityFromGlobalState(globalState);
  const cwdKey = normalizeFsPath(filters.cwd);
  const search = String(filters.searchTerm || "").trim().toLowerCase();
  return threads
    .filter((thread) => !isHiddenThread(thread, visibility))
    .filter((thread) => !cwdKey || normalizeFsPath(thread.cwd) === cwdKey)
    .filter((thread) => {
      if (!search) return true;
      return [thread.name, thread.preview, thread.cwd, thread.id]
        .some((value) => String(value || "").toLowerCase().includes(search));
    });
}

function readStateDbFallback(limit = 80, filters = {}) {
  if (!fs.existsSync(STATE_DB)) return [];
  const rowLimit = Math.max(limit * 5, 200);
  const query = [
    "select id,title,cwd,archived,archived_at,updated_at,model,reasoning_effort",
    "from threads",
    "order by updated_at desc",
    `limit ${Math.min(1000, rowLimit)};`,
  ].join(" ");
  try {
    const result = spawnSync("sqlite3", ["-json", STATE_DB, query], {
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true,
      maxBuffer: 5 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) return [];
    const rows = JSON.parse(result.stdout || "[]");
    return filterFallbackThreads(rows.map(rowToFallbackThread), filters).slice(0, limit);
  } catch (_) {
    return [];
  }
}

function readSessionIndexFallback(limit = 80, filters = {}) {
  const p = path.join(CODEX_HOME, "session_index.jsonl");
  try {
    const globalState = filters.globalState || readGlobalState();
    const projectlessThreadIds = visibleProjectlessThreadIds(globalState);
    if (filters.cwd || projectlessThreadIds.size === 0) return [];
    const lines = fs.readFileSync(p, "utf8").split(/\r?\n/).filter(Boolean).slice(-1000);
    const byId = new Map();
    for (const line of lines) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch (_) {
        continue;
      }
      if (!entry.id) continue;
      if (!projectlessThreadIds.has(entry.id)) continue;
      const updatedAt = entry.updated_at ? Math.floor(Date.parse(entry.updated_at) / 1000) : 0;
      byId.set(entry.id, rowToFallbackThread({
        id: entry.id,
        thread_name: entry.thread_name || null,
        updatedAt,
      }));
    }
    return [...byId.values()]
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .filter((thread) => {
        const search = String(filters.searchTerm || "").trim().toLowerCase();
        if (!search) return true;
        return [thread.name, thread.preview, thread.id]
          .some((value) => String(value || "").toLowerCase().includes(search));
      })
      .slice(0, limit);
  } catch (_) {
    return [];
  }
}

async function listWorkspaces() {
  const globalState = readGlobalState();
  const roots = visibleWorkspaceRoots(globalState);
  const visibility = visibilityFromGlobalState(globalState);
  let recentThreads = [];
  try {
    const result = await codex.request("thread/list", {
      limit: 500,
      sortKey: "updated_at",
      sortDirection: "desc",
      archived: false,
      useStateDbOnly: true,
      sourceKinds: [],
    }, { timeoutMs: READ_RPC_TIMEOUT_MS });
    recentThreads = (result.data || []).filter((thread) => !isHiddenThread(thread, visibility));
  } catch (_) {
    // Workspace list can still be useful from global state while app-server is recovering.
  }
  const active = Array.isArray(globalState["active-workspace-roots"])
    ? globalState["active-workspace-roots"]
    : [];
  const counts = new Map();
  for (const thread of recentThreads) {
    if (!thread.cwd) continue;
    const key = normalizeFsPath(thread.cwd);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...roots].map((cwd) => ({
    cwd,
    label: path.basename(cwd.replace(/^\\\\\?\\/, "")) || cwd,
    active: active.includes(cwd),
    recentThreadCount: counts.get(normalizeFsPath(cwd)) || 0,
  })).sort((a, b) => Number(b.active) - Number(a.active) || a.label.localeCompare(b.label));
}

async function handleApi(req, res) {
  const url = getUrl(req);
  if (url.pathname === "/api/public-config") {
    sendJson(res, 200, { authRequired: !DISABLE_AUTH, title: "Codex Mobile Web" });
    return;
  }
  if (url.pathname === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    if (!DISABLE_AUTH && !timingSafeEquals(body.key, AUTH_KEY)) {
      sendJson(res, 401, { error: "Invalid key" });
      return;
    }
    res.writeHead(204, {
      "Set-Cookie": `codex_mobile_key=${encodeURIComponent(body.key || "")}; Path=/; Max-Age=31536000; SameSite=Lax`,
      "Cache-Control": "no-store",
    });
    res.end();
    return;
  }
  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }
  if (url.pathname === "/api/status") {
    await codex.ensure().catch((err) => {
      codex.lastError = err.message;
    });
    sendJson(res, 200, codex.status());
    return;
  }
  if (url.pathname === "/api/workspaces" && req.method === "GET") {
    sendJson(res, 200, { data: await listWorkspaces() });
    return;
  }
  if (url.pathname === "/api/threads" && req.method === "GET") {
    const globalState = readGlobalState();
    const visibility = visibilityFromGlobalState(globalState);
    const cwd = url.searchParams.get("cwd") || null;
    const archivedParam = url.searchParams.get("archived");
    const archived = archivedParam === "true";
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || "80")));
    const cursor = url.searchParams.get("cursor") || null;
    const searchTerm = url.searchParams.get("search") || null;
    if (cwd && !visibility.workspaceKeys.has(normalizeFsPath(cwd))) {
      sendJson(res, 200, { data: [] });
      return;
    }
    const params = {
      cursor,
      limit: cursor ? limit : Math.max(limit, 500),
      sortKey: "updated_at",
      sortDirection: "desc",
      archived,
      useStateDbOnly: true,
      sourceKinds: [],
    };
    if (cwd) params.cwd = cwd;
    if (searchTerm) params.searchTerm = searchTerm;
    try {
      const result = filterVisibleThreads(await codex.request("thread/list", params, { timeoutMs: READ_RPC_TIMEOUT_MS }), globalState);
      if (Array.isArray(result.data)) result.data = result.data.slice(0, limit);
      if (Array.isArray(result.threads)) result.threads = result.threads.slice(0, limit);
      sendJson(res, 200, result);
    } catch (err) {
      const fallback = [
        ...readStateDbFallback(limit, { cwd, searchTerm, globalState }),
        ...readSessionIndexFallback(limit, { cwd, searchTerm, globalState }),
      ].slice(0, limit);
      if (fallback.length) {
        sendJson(res, 200, {
          data: fallback,
          mobileFallback: true,
          warning: err.message || String(err),
        });
        return;
      }
      throw err;
    }
    return;
  }
  const threadRead = url.pathname.match(/^\/api\/threads\/([^/]+)$/);
  if (threadRead && req.method === "GET") {
    const threadId = decodeURIComponent(threadRead[1]);
    const globalState = readGlobalState();
    const result = compactThreadReadResult(await codex.request("thread/read", { threadId, includeTurns: true }, { timeoutMs: 25000 }));
    if (isHiddenThread(result.thread, visibilityFromGlobalState(globalState))) {
      sendJson(res, 404, { error: "Thread is archived, deleted, or outside visible workspaces" });
      return;
    }
    sendJson(res, 200, result);
    return;
  }
  const threadTurns = url.pathname.match(/^\/api\/threads\/([^/]+)\/turns$/);
  if (threadTurns && req.method === "GET") {
    const threadId = decodeURIComponent(threadTurns[1]);
    const cursor = url.searchParams.get("cursor") || null;
    sendJson(res, 200, compactTurnsListResult(await codex.request("thread/turns/list", {
      threadId,
      cursor,
      limit: Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || String(MAX_THREAD_TURNS)))),
      sortDirection: url.searchParams.get("sortDirection") || "asc",
    }, { timeoutMs: READ_RPC_TIMEOUT_MS })));
    return;
  }
  const resume = url.pathname.match(/^\/api\/threads\/([^/]+)\/resume$/);
  if (resume && req.method === "POST") {
    const threadId = decodeURIComponent(resume[1]);
    const body = await readBody(req);
    sendJson(res, 200, await codex.request("thread/resume", {
      threadId,
      cwd: body.cwd || null,
      model: body.model || null,
      persistExtendedHistory: true,
    }, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false }));
    return;
  }
  const messages = url.pathname.match(/^\/api\/threads\/([^/]+)\/messages$/);
  if (messages && req.method === "POST") {
    const threadId = decodeURIComponent(messages[1]);
    const body = await readBody(req);
    const text = String(body.text || "").trim();
    if (!text) {
      sendJson(res, 400, { error: "Message text is required" });
      return;
    }
    try {
      await codex.request("thread/resume", {
        threadId,
        cwd: body.cwd || null,
        model: body.model || null,
        persistExtendedHistory: true,
      }, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
    } catch (err) {
      if (!/already|loaded|active/i.test(err.message || "")) throw err;
    }
    const params = {
      threadId,
      input: [{ type: "text", text, text_elements: [] }],
    };
    if (body.cwd) params.cwd = body.cwd;
    if (body.model) params.model = body.model;
    if (body.effort) params.effort = body.effort;
    sendJson(res, 200, await codex.request("turn/start", params, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false }));
    return;
  }
  const interrupt = url.pathname.match(/^\/api\/threads\/([^/]+)\/turns\/([^/]+)\/interrupt$/);
  if (interrupt && req.method === "POST") {
    sendJson(res, 200, await codex.request("turn/interrupt", {
      threadId: decodeURIComponent(interrupt[1]),
      turnId: decodeURIComponent(interrupt[2]),
    }, { timeoutMs: 20000, retry: false }));
    return;
  }
  sendJson(res, 404, { error: "Not found" });
}

function handleEvents(req, res) {
  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`data: ${JSON.stringify({ type: "status", status: codex.status() })}\n\n`);
  clients.add(res);
  const heartbeat = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch (_) {
      clearInterval(heartbeat);
      clients.delete(res);
    }
  }, 25000);
  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = getUrl(req);
    if (url.pathname === "/api/events") {
      handleEvents(req, res);
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }
    serveStatic(req, res);
  } catch (err) {
    sendJson(res, 500, { error: err.message || String(err) });
  }
});

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

function shutdown() {
  try {
    if (codex.ws) codex.ws.close();
  } catch (_) {}
  try {
    if (codex.child && codex.child.exitCode === null) codex.child.kill();
  } catch (_) {}
  process.exit(0);
}

server.listen(PORT, HOST, () => {
  console.log(`Codex Mobile Web listening on http://${HOST}:${PORT}`);
  console.log(`Codex app-server will be managed on 127.0.0.1 when first used.`);
  console.log(DISABLE_AUTH ? "Authentication disabled by CODEX_MOBILE_DISABLE_AUTH." : `Authentication enabled; key source is env CODEX_MOBILE_KEY or ${AUTH_KEY_FILE}.`);
});
