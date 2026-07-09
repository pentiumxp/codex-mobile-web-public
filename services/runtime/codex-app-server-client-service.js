"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const net = require("node:net");

const DEFAULT_MAX_INBOUND_MESSAGE_BYTES = 64 * 1024 * 1024;

function boundedByteLimit(value, fallback = DEFAULT_MAX_INBOUND_MESSAGE_BYTES) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.max(1024 * 1024, Math.min(Math.trunc(number), 512 * 1024 * 1024));
}

function inboundMessageByteLength(value) {
  if (typeof value === "string") return Buffer.byteLength(value, "utf8");
  if (Buffer.isBuffer(value)) return value.length;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  return Buffer.byteLength(String(value || ""), "utf8");
}

class JsonLineConnection {
  constructor(socket, options = {}) {
    this.socket = socket;
    this.readyState = 1;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.buffer = "";
    this.bufferBytes = 0;
    this.maxInboundMessageBytes = boundedByteLimit(options.maxInboundMessageBytes);

    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      if (this.readyState !== 1) return;
      const text = String(chunk || "");
      const chunkBytes = Buffer.byteLength(text, "utf8");
      if (this.bufferBytes + chunkBytes > this.maxInboundMessageBytes) {
        this.failOversizedMessage(this.bufferBytes + chunkBytes);
        return;
      }
      this.buffer += text;
      this.bufferBytes += chunkBytes;
      let index;
      while ((index = this.buffer.indexOf("\n")) >= 0) {
        const consumed = this.buffer.slice(0, index + 1);
        const line = this.buffer.slice(0, index).trim();
        this.buffer = this.buffer.slice(index + 1);
        this.bufferBytes = Math.max(0, this.bufferBytes - Buffer.byteLength(consumed, "utf8"));
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

  failOversizedMessage(observedBytes) {
    this.readyState = 3;
    this.buffer = "";
    this.bufferBytes = 0;
    const err = new Error(`codex app-server inbound message exceeded ${this.maxInboundMessageBytes} bytes`);
    err.code = "APP_SERVER_MESSAGE_TOO_LARGE";
    err.observedBytes = observedBytes;
    if (this.onerror) this.onerror(err);
    try {
      if (typeof this.socket.destroy === "function") this.socket.destroy(err);
      else this.socket.end();
    } catch (_) {}
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

function boundedProcessId(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return 0;
  return number;
}

function createAppServerEndpointResolver(options = {}) {
  const {
    fs: fsImpl = fs,
    muxEndpointFile,
    externalAppServerWs,
    externalAppServerTcp,
  } = options;

  function currentMuxEndpointFile() {
    return typeof muxEndpointFile === "function" ? muxEndpointFile() : muxEndpointFile;
  }

  return function resolveExternalEndpoint() {
    if (externalAppServerWs) {
      return { protocol: "ws", url: externalAppServerWs, source: "CODEX_MOBILE_APP_SERVER_WS", required: true };
    }
    if (externalAppServerTcp) {
      return parseTcpEndpoint(externalAppServerTcp, "CODEX_MOBILE_APP_SERVER_TCP");
    }
    const endpointFile = currentMuxEndpointFile();
    if (!endpointFile) return null;
    try {
      const raw = fsImpl.readFileSync(endpointFile, "utf8");
      const endpoint = JSON.parse(raw);
      if (endpoint && endpoint.protocol === "jsonl-tcp" && endpoint.host && endpoint.port) {
        const resolved = {
          protocol: "jsonl-tcp",
          host: endpoint.host,
          port: Number(endpoint.port),
          source: endpointFile,
          capabilities: endpoint.capabilities || null,
          required: true,
        };
        const pid = boundedProcessId(endpoint.pid || endpoint.muxPid || endpoint.processId);
        const childPid = boundedProcessId(endpoint.childPid || endpoint.appServerPid);
        if (pid) resolved.pid = pid;
        if (childPid) resolved.childPid = childPid;
        if (endpoint.startedAt) resolved.startedAt = String(endpoint.startedAt).slice(0, 80);
        return resolved;
      }
      if (endpoint && endpoint.protocol === "ws" && endpoint.url) {
        return { protocol: "ws", url: endpoint.url, source: endpointFile, required: true };
      }
    } catch (_) {
      return null;
    }
    return null;
  };
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

function safeJsonByteLength(value) {
  try {
    const json = JSON.stringify(value);
    return Buffer.byteLength(json || "", "utf8");
  } catch (_) {
    return 0;
  }
}

function createCodexAppServerClient(dependencies = {}) {
  const {
    REQUIRE_SHARED_APP_SERVER,
    resolveExternalEndpoint = () => null,
    DISABLE_MOBILE_OWNED_MUX,
    EXTERNAL_APP_SERVER_WS,
    EXTERNAL_APP_SERVER_TCP,
    MUX_ENDPOINT_FILE,
    CODEX_EXE,
    APP_ROOT,
    CODEX_HOME,
    CODEX_HOME_RESOLUTION = {},
    RUNTIME_ROOT,
    PERSIST_MOBILE_OWNED_MUX,
    MUX_REPLAY_NOTIFICATION_LIMIT,
    READ_RPC_TIMEOUT_MS,
    DEFAULT_RPC_TIMEOUT_MS,
    MAX_APP_SERVER_INBOUND_MESSAGE_BYTES,
    LIVE_RATE_LIMIT_REFRESH_MIN_INTERVAL_MS,
    SAFE_RETRY_METHODS,
    SERVER_REQUEST_METHODS,
    JsonLineConnection: JsonLineConnectionImpl = JsonLineConnection,
    WebSocket: WebSocketImpl = globalThis.WebSocket,
    codexAppServerChildEnv,
    getFreePort: getFreePortImpl = getFreePort,
    assertCommandAvailable,
    broadcast = () => {},
    normalizeFsPath,
    recordRateLimitReadResult,
    recordRateLimits,
    hasCurrentRateLimitWindow,
    rememberThreadIdForTurnParams,
    maybeRecordTurnTokenUsage,
    maybeMaterializeThreadTaskCardDrafts,
    maybeAutoReplyThreadTaskCard,
    maybeApplyQueuedThreadSideChat,
    maybeSendTurnCompletedPush,
    publicServerRequest,
    workspaceSourceWriteGuardDecisionForRequest,
    serverRequestResponsePayload,
    workspaceSourceWriteGuardLogPayload,
    codeGraphReadOnlyMcpElicitationDecision,
    shortIdentifier,
    dynamicToolServerRequestResponsePayload,
    dynamicToolErrorPayload,
    safeJsonByteLength: safeJsonByteLengthImpl = safeJsonByteLength,
    logWorkspaceDelegationRpc,
    activeRateLimits = () => null,
    rateLimitsByModelObject = () => ({}),
    codexProfileService = { profiles: () => null },
    liveQuotaSnapshotForProfiles = () => null,
    processImpl = process,
    runtimeProfileBindingProvider,
  } = dependencies;
  const latestLiveRateLimitsValue = typeof dependencies.latestLiveRateLimits === "function"
    ? dependencies.latestLiveRateLimits
    : () => null;
  const maxInboundMessageBytes = boundedByteLimit(MAX_APP_SERVER_INBOUND_MESSAGE_BYTES);

  function runtimeProfileBinding() {
    const dynamic = typeof runtimeProfileBindingProvider === "function"
      ? (runtimeProfileBindingProvider() || {})
      : {};
    const resolution = dynamic.codexHomeResolution || dynamic.CODEX_HOME_RESOLUTION || CODEX_HOME_RESOLUTION || {};
    const codexHome = dynamic.codexHome || dynamic.CODEX_HOME || CODEX_HOME || "";
    const muxEndpointFile = dynamic.muxEndpointFile || dynamic.MUX_ENDPOINT_FILE || MUX_ENDPOINT_FILE || "";
    return {
      codexHome,
      muxEndpointFile,
      codexHomeResolution: resolution,
    };
  }

  function runtimeBindingKey(binding = runtimeProfileBinding()) {
    return JSON.stringify({
      codexHome: normalizeRuntimePath(binding.codexHome),
      muxEndpointFile: normalizeRuntimePath(binding.muxEndpointFile),
      activeProfileId: binding.codexHomeResolution && binding.codexHomeResolution.activeProfileId || "",
      source: binding.codexHomeResolution && binding.codexHomeResolution.source || "",
    });
  }

  function normalizeRuntimePath(value) {
    const text = String(value || "");
    if (!text) return "";
    if (typeof normalizeFsPath === "function") return normalizeFsPath(text);
    return path.resolve(text).toLowerCase();
  }

  function sameRuntimePath(left, right) {
    return Boolean(left && right && normalizeRuntimePath(left) === normalizeRuntimePath(right));
  }

class CodexAppServerClient {
  constructor() {
    this.child = null;
    this.muxChild = null;
    this.ws = null;
    this.port = 0;
    this.endpoint = null;
    this.transportKind = "none";
    this.nextId = 1;
    this.pending = new Map();
    this.serverRequests = new Map();
    this.connecting = null;
    this.info = null;
    this.ready = false;
    this.lastError = null;
    this.resetting = false;
    this.requireSharedAppServer = REQUIRE_SHARED_APP_SERVER;
    this.lastRateLimitRefreshAttemptAt = 0;
    this.connectedRuntimeBinding = null;
    this.connectedRuntimeBindingKey = "";
  }

  async ensure() {
    if (this.ready && this.isTransportOpen()) {
      const mismatch = this.runtimeBindingMismatch();
      if (!mismatch) return;
      this.resetConnection(`codex profile runtime binding changed (${mismatch})`);
    }
    if (this.connecting) return this.connecting;
    this.connecting = this.startAndConnect().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  rememberRuntimeBinding(binding = runtimeProfileBinding()) {
    this.connectedRuntimeBinding = binding;
    this.connectedRuntimeBindingKey = runtimeBindingKey(binding);
  }

  runtimeBindingMismatch() {
    if (!this.connectedRuntimeBindingKey) return "";
    const currentKey = runtimeBindingKey();
    return currentKey === this.connectedRuntimeBindingKey ? "" : "active_profile_changed";
  }

  isTransportOpen() {
    return this.ws && this.ws.readyState === 1;
  }

  async startAndConnect() {
    const binding = runtimeProfileBinding();
    this.closeTransportOnly();
    const externalEndpoint = resolveExternalEndpoint(binding);
    if (externalEndpoint) {
      this.requireSharedAppServer = true;
      let connected = false;
      try {
        await this.connectEndpoint(externalEndpoint);
        connected = true;
        await this.initialize({ allowAlreadyInitialized: true });
        this.rememberRuntimeBinding(binding);
        return;
      } catch (err) {
        this.closeTransportOnly();
        if (this.shouldPreserveProfileMuxAfterFailure(externalEndpoint, binding)) {
          const phase = connected ? "initialize" : "connect";
          this.lastError = `shared app-server endpoint preserved after ${phase} failure (${err.message})`;
          console.error(`[codex app-server] ${this.lastError}`);
          throw new Error(this.lastError);
        }
        if (this.canStartOwnedMuxForEndpoint(externalEndpoint, binding)) {
          console.error(`[codex app-server] profile mux endpoint unavailable; starting Mobile-owned mux (${err.message})`);
          await this.startOwnedMuxAndConnect(binding);
          await this.initialize({ allowAlreadyInitialized: true });
          this.rememberRuntimeBinding(binding);
          return;
        }
        this.lastError = `shared app-server endpoint unavailable (${err.message})`;
        console.error(`[codex app-server] ${this.lastError}`);
        throw new Error(this.lastError);
      }
    }

    if (this.requireSharedAppServer) {
      if (!DISABLE_MOBILE_OWNED_MUX && !EXTERNAL_APP_SERVER_WS && !EXTERNAL_APP_SERVER_TCP) {
        console.error(`[codex app-server] shared endpoint missing; starting Mobile-owned mux (${binding.muxEndpointFile})`);
        await this.startOwnedMuxAndConnect(binding);
        await this.initialize({ allowAlreadyInitialized: true });
        this.rememberRuntimeBinding(binding);
        return;
      }
      this.lastError = `shared app-server endpoint unavailable (${binding.muxEndpointFile} not found)`;
      console.error(`[codex app-server] ${this.lastError}`);
      throw new Error(this.lastError);
    }

    await this.startManagedChild(binding);
    await this.connectEndpoint({ protocol: "ws", url: `ws://127.0.0.1:${this.port}`, source: "managed child", required: true });
    await this.initialize();
    this.rememberRuntimeBinding(binding);
  }

  async startManagedChild(binding = runtimeProfileBinding()) {
    assertCommandAvailable(CODEX_EXE, "Codex executable");
    if (!this.child || this.child.exitCode !== null || this.child.signalCode !== null) {
      this.port = await getFreePortImpl();
      const child = spawn(CODEX_EXE, ["app-server", "--listen", `ws://127.0.0.1:${this.port}`], {
        cwd: APP_ROOT,
        env: codexAppServerChildEnv({ CODEX_HOME: binding.codexHome }),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.child = child;
      const started = new Promise((resolve, reject) => {
        const onError = (err) => {
          child.off("spawn", onSpawn);
          if (this.child === child) this.child = null;
          this.ready = false;
          this.lastError = `failed to start codex app-server (${err.message})`;
          broadcast({ type: "status", status: this.status() });
          reject(new Error(this.lastError));
        };
        const onSpawn = () => {
          child.off("error", onError);
          resolve();
        };
        child.once("error", onError);
        child.once("spawn", onSpawn);
      });
      child.stderr.on("data", (chunk) => this.handleAppServerLog(chunk));
      child.stdout.on("data", (chunk) => this.handleAppServerLog(chunk));
      child.on("exit", (code, signal) => {
        if (this.child !== child) return;
        this.ready = false;
        this.lastError = `codex app-server exited (${code ?? signal ?? "unknown"})`;
        broadcast({ type: "status", status: this.status() });
      });
      await started;
    }
  }

  canStartOwnedMuxForEndpoint(endpoint, binding = runtimeProfileBinding()) {
    if (DISABLE_MOBILE_OWNED_MUX || EXTERNAL_APP_SERVER_WS || EXTERNAL_APP_SERVER_TCP) return false;
    return Boolean(endpoint && endpoint.source && sameRuntimePath(endpoint.source, binding.muxEndpointFile));
  }

  endpointProcessIsAlive(endpoint) {
    const pid = boundedProcessId(endpoint && endpoint.pid);
    if (!pid || !processImpl || typeof processImpl.kill !== "function") return false;
    try {
      processImpl.kill(pid, 0);
      return true;
    } catch (_) {
      return false;
    }
  }

  shouldPreserveProfileMuxAfterFailure(endpoint, binding = runtimeProfileBinding()) {
    return this.canStartOwnedMuxForEndpoint(endpoint, binding) && this.endpointProcessIsAlive(endpoint);
  }

  async startOwnedMuxAndConnect(binding = runtimeProfileBinding()) {
    assertCommandAvailable(CODEX_EXE, "Codex executable");
    if (this.muxChild && this.muxChild.exitCode === null && this.muxChild.signalCode === null) {
      return this.waitForMuxEndpointAndConnect(binding);
    }

    fs.mkdirSync(path.dirname(binding.muxEndpointFile), { recursive: true });
    const muxPath = path.join(APP_ROOT, "codex-app-server-mux.js");
    const child = spawn(process.execPath, [muxPath, "app-server", "--analytics-default-enabled"], {
      cwd: APP_ROOT,
      env: codexAppServerChildEnv({
        CODEX_HOME: binding.codexHome,
        CODEX_MOBILE_RUNTIME_DIR: RUNTIME_ROOT,
        CODEX_MUX_STANDALONE: "1",
        CODEX_MUX_KEEP_ALIVE: "1",
        CODEX_MUX_PUBLISH_ENDPOINT: "auto",
        CODEX_MUX_ENDPOINT_FILE: binding.muxEndpointFile,
        CODEX_MUX_CODEX_EXE: CODEX_EXE,
      }),
      detached: PERSIST_MOBILE_OWNED_MUX,
      windowsHide: true,
      stdio: PERSIST_MOBILE_OWNED_MUX ? ["ignore", "ignore", "ignore"] : ["ignore", "ignore", "pipe"],
    });
    if (PERSIST_MOBILE_OWNED_MUX) {
      child.unref();
    } else {
      this.muxChild = child;
      child.stderr.on("data", (chunk) => this.handleAppServerLog(chunk));
      child.on("exit", (code, signal) => {
        if (this.muxChild !== child) return;
        this.muxChild = null;
        this.ready = false;
        this.lastError = `Mobile-owned mux exited (${code ?? signal ?? "unknown"})`;
        broadcast({ type: "status", status: this.status() });
      });
    }
    await new Promise((resolve, reject) => {
      const onError = (err) => {
        child.off("spawn", onSpawn);
        if (!PERSIST_MOBILE_OWNED_MUX && this.muxChild === child) this.muxChild = null;
        reject(err);
      };
      const onSpawn = () => {
        child.off("error", onError);
        resolve();
      };
      child.once("error", onError);
      child.once("spawn", onSpawn);
    });
    await this.waitForMuxEndpointAndConnect(binding);
  }

  async waitForMuxEndpointAndConnect(binding = runtimeProfileBinding()) {
    const deadline = Date.now() + 20000;
    let lastError = null;
    while (Date.now() < deadline) {
      const endpoint = resolveExternalEndpoint(binding);
      if (endpoint && this.canStartOwnedMuxForEndpoint(endpoint, binding)) {
        try {
          await this.connectEndpoint(endpoint);
          return;
        } catch (err) {
          lastError = err;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error(`Mobile-owned mux endpoint unavailable (${lastError ? lastError.message : `${binding.muxEndpointFile} not ready`})`);
  }

  async initialize(options = {}) {
    try {
      this.info = await this.sendRpc("initialize", {
        clientInfo: {
          name: "codex-mobile-web",
          title: "Codex Mobile Web",
          version: "0.1.0",
          replayNotificationLimit: MUX_REPLAY_NOTIFICATION_LIMIT,
        },
        capabilities: { experimentalApi: true },
      }, READ_RPC_TIMEOUT_MS);
    } catch (err) {
      if (!options.allowAlreadyInitialized || !/already initialized/i.test(err.message || "")) {
        throw err;
      }
      this.info = { userAgent: "shared app-server (already initialized)" };
    }
    await this.refreshRateLimits();
    this.ready = true;
    this.lastError = null;
    broadcast({ type: "status", status: this.status() });
  }

  rateLimitSource() {
    if (this.transportKind === "managed-ws-child") return "managed-child-live";
    if (this.isMuxEndpoint()) return "profile-mux-live";
    return "live";
  }

  async refreshRateLimits() {
    try {
      const result = await this.sendRpc("account/rateLimits/read", {}, READ_RPC_TIMEOUT_MS, { resetOnTimeout: false });
      recordRateLimitReadResult(result, { source: this.rateLimitSource() });
    } catch (err) {
      if (!/method not found|not found|unsupported/i.test(err.message || "")) {
        console.error(`[codex app-server] account/rateLimits/read failed: ${String(err.message || err).slice(0, 300)}`);
      }
    }
  }

  async refreshRateLimitsIfMissing() {
    if (!this.ready || !this.isTransportOpen()) return;
    const liveRateLimits = latestLiveRateLimitsValue();
    if (liveRateLimits && hasCurrentRateLimitWindow(liveRateLimits)) return;
    const now = Date.now();
    if (now - this.lastRateLimitRefreshAttemptAt < LIVE_RATE_LIMIT_REFRESH_MIN_INTERVAL_MS) return;
    this.lastRateLimitRefreshAttemptAt = now;
    await this.refreshRateLimits();
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
      const ws = new WebSocketImpl(url);
      const timer = setTimeout(() => reject(new Error("codex app-server websocket timeout")), 2500);
      ws.onopen = () => {
        clearTimeout(timer);
        this.ws = ws;
        this.endpoint = { protocol: "ws", url };
        this.transportKind = url.includes(`127.0.0.1:${this.port}`) ? "managed-ws-child" : "external-ws";
        ws.onmessage = (event) => this.handleMessage(event.data);
        ws.onclose = () => {
          const wasShared = this.transportKind === "external-ws";
          this.ready = false;
          this.lastError = wasShared ? "shared app-server connection closed" : "codex app-server connection closed";
          this.failPending(new Error(this.lastError));
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
        const connection = new JsonLineConnectionImpl(socket, { maxInboundMessageBytes });
        this.ws = connection;
        this.endpoint = endpoint;
        this.transportKind = "external-jsonl-tcp";
        this.requireSharedAppServer = true;
        connection.onmessage = (event) => this.handleMessage(event.data);
        connection.onclose = () => {
          this.ready = false;
          this.lastError = "shared app-server connection closed";
          this.failPending(new Error(this.lastError));
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
    const rawBytes = inboundMessageByteLength(raw);
    if (rawBytes > maxInboundMessageBytes) {
      this.recordOversizedInboundMessage(rawBytes);
      this.resetConnection(`codex app-server inbound message exceeded ${maxInboundMessageBytes} bytes`);
      return;
    }
    let msg;
    const rawText = typeof raw === "string" ? raw : String(raw);
    try {
      msg = JSON.parse(rawText);
    } catch (_) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(msg, "id") && msg.method) {
      this.handleServerRequest(msg);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(msg, "id") && this.pending.has(msg.id)) {
      const { resolve, reject, timer, diagnostics } = this.pending.get(msg.id);
      clearTimeout(timer);
      this.pending.delete(msg.id);
      this.recordRpcDiagnostics(diagnostics, {
        responsePayloadBytes: rawBytes,
      });
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    if (msg.method) {
      if (msg.method === "account/rateLimits/updated" && msg.params && msg.params.rateLimits) {
        recordRateLimits(msg.params.rateLimits, {
          source: this.rateLimitSource(),
        });
      }
      if (msg.method === "serverRequest/resolved" && msg.params && msg.params.requestId != null) {
        this.markServerRequestResolved(msg.params.requestId, "resolved");
      }
      rememberThreadIdForTurnParams(msg.method, msg.params || null);
      maybeRecordTurnTokenUsage(msg.method, msg.params || null);
      maybeMaterializeThreadTaskCardDrafts(msg.method, msg.params || null);
      maybeAutoReplyThreadTaskCard(msg.method, msg.params || null);
      maybeApplyQueuedThreadSideChat(msg.method, msg.params || null);
      maybeSendTurnCompletedPush(msg.method, msg.params || null);
      broadcast({ type: "notification", method: msg.method, params: msg.params || null });
    }
  }

  recordOversizedInboundMessage(rawBytes) {
    for (const pending of this.pending.values()) {
      this.recordRpcDiagnostics(pending.diagnostics, {
        responsePayloadBytes: rawBytes,
        errorCode: "APP_SERVER_MESSAGE_TOO_LARGE",
      });
    }
  }

  handleServerRequest(msg) {
    if (!SERVER_REQUEST_METHODS.has(msg.method)) {
      broadcast({ type: "notification", method: msg.method, params: msg.params || null });
      return;
    }
    const key = String(msg.id);
    const request = {
      id: msg.id,
      method: msg.method,
      params: msg.params || {},
      status: "waiting",
      receivedAt: Date.now(),
      decision: null,
      respondedAt: null,
    };
    if (this.answerWorkspaceSourceWriteGuardRequest(request)) return;
    if (this.answerCodeGraphReadOnlyMcpElicitationRequest(request)) return;
    this.serverRequests.set(key, request);
    broadcast({ type: "serverRequest", request: publicServerRequest(request) });
    if (msg.method === "item/tool/call") {
      this.answerDynamicToolServerRequest(request).catch((err) => {
        request.status = "failed";
        request.decision = "failed";
        request.respondedAt = Date.now();
        console.error(`[dynamic tool] failed request=${shortIdentifier(key)}: ${err.message || String(err)}`);
        broadcast({ type: "serverRequestResolved", requestId: key, request: publicServerRequest(request) });
        setTimeout(() => this.serverRequests.delete(key), 15000).unref();
      });
    }
  }

  answerWorkspaceSourceWriteGuardRequest(request) {
    const decision = workspaceSourceWriteGuardDecisionForRequest(request);
    if (!decision) return false;
    const responseDecision = decision.action === "deny" ? "deny" : "allow_once";
    try {
      const payload = serverRequestResponsePayload(request, { decision: responseDecision });
      this.sendServerRequestResponse(request, payload);
      request.status = "responded";
      request.decision = decision.action === "deny" ? "source_write_guard_deny" : "source_write_guard_allow";
      request.respondedAt = Date.now();
      console.log(`[workspace-source-write-guard] ${JSON.stringify(workspaceSourceWriteGuardLogPayload(request, decision, responseDecision))}`);
      return true;
    } catch (err) {
      console.error(`[workspace-source-write-guard] failed request=${shortIdentifier(request && request.id)}: ${err.message || String(err)}`);
      return false;
    }
  }

  answerCodeGraphReadOnlyMcpElicitationRequest(request) {
    const decision = codeGraphReadOnlyMcpElicitationDecision(request);
    if (!decision) return false;
    try {
      const payload = serverRequestResponsePayload(request, { action: "accept" });
      this.sendServerRequestResponse(request, payload);
      request.status = "responded";
      request.decision = "codegraph_readonly_allow";
      request.respondedAt = Date.now();
      console.log(`[mcp-elicitation] ${JSON.stringify({
        action: request.decision,
        requestId: shortIdentifier(request && request.id),
        toolName: decision.toolName,
      })}`);
      return true;
    } catch (err) {
      console.error(`[mcp-elicitation] failed request=${shortIdentifier(request && request.id)}: ${err.message || String(err)}`);
      return false;
    }
  }

  markServerRequestResolved(requestId, status = "resolved") {
    const key = String(requestId);
    const request = this.serverRequests.get(key);
    if (request) {
      request.status = status;
      request.respondedAt = request.respondedAt || Date.now();
      broadcast({ type: "serverRequestResolved", requestId: key, request: publicServerRequest(request) });
      setTimeout(() => this.serverRequests.delete(key), 15000).unref();
      return;
    }
    broadcast({ type: "serverRequestResolved", requestId: key, status });
  }

  rpcEndpointKind() {
    const endpoint = this.endpoint || {};
    const source = String(endpoint.source || "");
    if (this.transportKind === "managed-ws-child") return "managed-child";
    if (source === "CODEX_MOBILE_APP_SERVER_WS") return "env-ws";
    if (source === "CODEX_MOBILE_APP_SERVER_TCP") return "env-tcp";
    if (source && normalizeFsPath(source) === normalizeFsPath(MUX_ENDPOINT_FILE)) return "profile-mux-file";
    if (this.transportKind === "external-jsonl-tcp") return "external-jsonl-tcp";
    if (this.transportKind === "external-ws") return "external-ws";
    return this.transportKind || "unknown";
  }

  recordRpcDiagnostics(diagnostics, fields = {}) {
    if (!diagnostics || typeof diagnostics !== "object") return;
    diagnostics.transportKind = this.transportKind || "unknown";
    diagnostics.endpointKind = this.rpcEndpointKind();
    diagnostics.endpointProtocol = this.endpoint && this.endpoint.protocol
      ? String(this.endpoint.protocol)
      : "unknown";
    if (fields.attempt) diagnostics.attemptCount = Math.max(1, Number(diagnostics.attemptCount || 0) + 1);
    if (fields.method) diagnostics.method = String(fields.method);
    if (fields.timeoutMs !== undefined) diagnostics.timeoutMs = Number(fields.timeoutMs || 0);
    if (fields.retryEnabled !== undefined) diagnostics.retryEnabled = fields.retryEnabled === true;
    if (fields.requestPayloadBytes !== undefined) diagnostics.requestPayloadBytes = Number(fields.requestPayloadBytes || 0);
    if (fields.requestParamBytes !== undefined) diagnostics.requestParamBytes = Number(fields.requestParamBytes || 0);
    if (fields.responsePayloadBytes !== undefined) diagnostics.responsePayloadBytes = Number(fields.responsePayloadBytes || 0);
    if (fields.timedOut !== undefined) diagnostics.timedOut = fields.timedOut === true;
    if (fields.errorCode) diagnostics.errorCode = String(fields.errorCode).slice(0, 80);
  }

  pendingServerRequests() {
    return [...this.serverRequests.values()]
      .filter((request) => SERVER_REQUEST_METHODS.has(request.method))
      .map(publicServerRequest);
  }

  sendServerRequestResponse(request, payload) {
    if (!this.isTransportOpen()) {
      throw new Error("codex app-server connection is not open");
    }
    const message = Object.assign({ jsonrpc: "2.0", id: request.id }, payload);
    this.ws.send(JSON.stringify(message));
  }

  answerServerRequest(requestId, responseBody = {}) {
    const key = String(requestId);
    const request = this.serverRequests.get(key);
    if (!request) throw new Error("Approval request is no longer pending");
    if (request.status !== "waiting") throw new Error("Approval request has already been answered");
    const body = responseBody && typeof responseBody === "object" ? responseBody : { decision: String(responseBody || "") };
    const payload = serverRequestResponsePayload(request, body);
    this.sendServerRequestResponse(request, payload);
    request.status = "responded";
    request.decision = body.decision || body.action || "submitted";
    request.respondedAt = Date.now();
    broadcast({ type: "serverRequestResolved", requestId: key, request: publicServerRequest(request) });
    setTimeout(() => this.serverRequests.delete(key), 15000).unref();
    return publicServerRequest(request);
  }

  async answerDynamicToolServerRequest(request) {
    const key = String(request && request.id);
    if (!request) throw new Error("Dynamic tool request is missing");
    if (request.status !== "waiting") return publicServerRequest(request);
    let payload;
    let decision = "submitted";
    try {
      payload = await dynamicToolServerRequestResponsePayload(request);
    } catch (err) {
      decision = "failed";
      payload = dynamicToolErrorPayload(
        err.code || "dynamic_tool_failed",
        err.message || String(err),
        err.details ? { details: err.details } : {},
      );
    }
    this.sendServerRequestResponse(request, payload);
    request.status = "responded";
    request.decision = decision;
    request.respondedAt = Date.now();
    broadcast({ type: "serverRequestResolved", requestId: key, request: publicServerRequest(request) });
    setTimeout(() => this.serverRequests.delete(key), 15000).unref();
    return publicServerRequest(request);
  }

  failPending(err) {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(err);
    }
    this.pending.clear();
    for (const request of this.serverRequests.values()) {
      request.status = "connectionClosed";
      request.respondedAt = Date.now();
      broadcast({ type: "serverRequestResolved", requestId: String(request.id), request: publicServerRequest(request) });
    }
    this.serverRequests.clear();
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
    if (this.muxChild) {
      const muxChild = this.muxChild;
      this.muxChild = null;
      try {
        if (muxChild.exitCode === null && muxChild.signalCode === null) muxChild.kill();
      } catch (_) {}
    }
    this.connectedRuntimeBinding = null;
    this.connectedRuntimeBindingKey = "";
    this.info = null;
    this.failPending(new Error(reason));
    broadcast({ type: "status", status: this.status() });
    setTimeout(() => {
      this.resetting = false;
    }, 250).unref();
  }

  sendRpc(method, params, timeoutMs = DEFAULT_RPC_TIMEOUT_MS, options = {}) {
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    if (!this.isTransportOpen()) {
      return Promise.reject(new Error("codex app-server connection is not open"));
    }
    const serializedPayload = JSON.stringify(payload);
    this.recordRpcDiagnostics(options.diagnostics, {
      attempt: true,
      method,
      timeoutMs,
      requestPayloadBytes: Buffer.byteLength(serializedPayload, "utf8"),
      requestParamBytes: safeJsonByteLengthImpl(params),
      retryEnabled: options.retryEnabled === true,
    });
    logWorkspaceDelegationRpc(method, params);
    this.ws.send(serializedPayload);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        const err = new Error(`Codex request timed out: ${method}`);
        err.code = "RPC_TIMEOUT";
        this.recordRpcDiagnostics(options.diagnostics, {
          timedOut: true,
          errorCode: err.code,
        });
        reject(err);
        if (options.resetOnTimeout !== false) this.resetConnection(err.message);
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, diagnostics: options.diagnostics || null });
    });
  }

  sendNotification(method, params) {
    if (!this.isTransportOpen()) return false;
    this.ws.send(JSON.stringify({ jsonrpc: "2.0", method, params }));
    return true;
  }

  isMuxEndpoint() {
    const binding = this.connectedRuntimeBinding || runtimeProfileBinding();
    return this.transportKind === "external-jsonl-tcp"
      && this.endpoint
      && sameRuntimePath(this.endpoint.source, binding.muxEndpointFile);
  }

  supportsMuxUserMessageEcho() {
    return this.isMuxEndpoint()
      && this.endpoint.capabilities
      && this.endpoint.capabilities.mobileUserMessageEcho === true;
  }

  notifyMuxUserMessage(params) {
    if (!this.supportsMuxUserMessageEcho()) return false;
    return this.sendNotification("mux/userMessage", params);
  }

  supportsMuxMetricsRead() {
    return this.isMuxEndpoint()
      && this.endpoint.capabilities
      && this.endpoint.capabilities.muxMetricsRpc === true;
  }

  async readMuxMetrics(methods = []) {
    if (!this.supportsMuxMetricsRead()) {
      return { ok: false, supported: false, reason: "mux-metrics-unsupported" };
    }
    const requestedMethods = Array.isArray(methods)
      ? methods.map((method) => String(method || "").trim()).filter(Boolean).slice(0, 20)
      : [];
    try {
      const result = await this.request("mux/metrics/read", { methods: requestedMethods }, {
        timeoutMs: 1000,
        retry: false,
        resetOnTimeout: false,
      });
      return Object.assign({ supported: true }, result && typeof result === "object" ? result : {});
    } catch (err) {
      return {
        ok: false,
        supported: true,
        reason: "mux-metrics-read-failed",
        error: String(err && err.code || err && err.message || err || "unknown").slice(0, 120),
      };
    }
  }

  async request(method, params, options = {}) {
    const timeoutMs = options.timeoutMs || (SAFE_RETRY_METHODS.has(method) ? READ_RPC_TIMEOUT_MS : DEFAULT_RPC_TIMEOUT_MS);
    const retry = options.retry !== false && SAFE_RETRY_METHODS.has(method);
    if (options.diagnostics && typeof options.diagnostics === "object") {
      options.diagnostics.retryEnabled = retry;
    }
    await this.ensure();
    try {
      return await this.sendRpc(method, params, timeoutMs, Object.assign({}, options, { retryEnabled: retry }));
    } catch (err) {
      const recoverable = /timed out|connection is not open|connection closed/i.test(err.message || "");
      if (!retry || !recoverable) throw err;
      await this.ensure();
      return this.sendRpc(method, params, timeoutMs, Object.assign({}, options, { retryEnabled: retry }));
    }
  }

  status() {
    const binding = runtimeProfileBinding();
    const connectedBinding = this.connectedRuntimeBinding || null;
    const profileBindingState = this.ready && this.isTransportOpen() && this.runtimeBindingMismatch()
      ? "profile_binding_stale"
      : "aligned";
    return {
      ready: this.ready,
      port: this.port || null,
      transport: this.transportKind,
      endpoint: this.endpoint ? {
        protocol: this.endpoint.protocol,
        kind: this.rpcEndpointKind(),
        source: this.endpoint.source || null,
        host: this.endpoint.host || null,
        port: this.endpoint.port || null,
        url: this.endpoint.url || null,
        capabilities: this.endpoint.capabilities || null,
      } : null,
      muxEndpointFile: binding.muxEndpointFile,
      connectedMuxEndpointFile: connectedBinding ? connectedBinding.muxEndpointFile : null,
      maxInboundMessageBytes,
      persistentOwnedMux: PERSIST_MOBILE_OWNED_MUX,
      mobileOwnedMux: this.muxChild ? {
        pid: this.muxChild.pid || null,
        running: this.muxChild.exitCode === null && this.muxChild.signalCode === null,
      } : null,
      codexExe: CODEX_EXE,
      codexHome: binding.codexHome,
      connectedCodexHome: connectedBinding ? connectedBinding.codexHome : null,
      codexHomeSource: binding.codexHomeResolution && binding.codexHomeResolution.source,
      codexHomeEnvIgnored: Boolean(binding.codexHomeResolution && binding.codexHomeResolution.envCodexHomeIgnored),
      codexProfileActiveId: binding.codexHomeResolution && binding.codexHomeResolution.activeProfileId,
      profileBindingState,
      runtimeRoot: RUNTIME_ROOT,
      userAgent: this.info ? this.info.userAgent : null,
      lastError: this.lastError,
      sharedRequired: this.requireSharedAppServer,
      rateLimits: activeRateLimits(),
      rateLimitsByModel: rateLimitsByModelObject(),
      codexProfiles: codexProfileService.profiles({
        activeQuota: liveQuotaSnapshotForProfiles(),
      }),
    };
  }
}



  return new CodexAppServerClient();
}

module.exports = {
  JsonLineConnection,
  createAppServerEndpointResolver,
  createCodexAppServerClient,
  getFreePort,
  parseTcpEndpoint,
  safeJsonByteLength,
};
