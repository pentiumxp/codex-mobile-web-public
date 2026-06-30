"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const net = require("node:net");

function createCodexAppServerClient(dependencies = {}) {
  const {
    REQUIRE_SHARED_APP_SERVER,
    resolveExternalEndpoint,
    DISABLE_MOBILE_OWNED_MUX,
    EXTERNAL_APP_SERVER_WS,
    EXTERNAL_APP_SERVER_TCP,
    MUX_ENDPOINT_FILE,
    CODEX_EXE,
    APP_ROOT,
    CODEX_HOME,
    CODEX_HOME_RESOLUTION,
    RUNTIME_ROOT,
    PERSIST_MOBILE_OWNED_MUX,
    MUX_REPLAY_NOTIFICATION_LIMIT,
    READ_RPC_TIMEOUT_MS,
    DEFAULT_RPC_TIMEOUT_MS,
    LIVE_RATE_LIMIT_REFRESH_MIN_INTERVAL_MS,
    SAFE_RETRY_METHODS,
    SERVER_REQUEST_METHODS,
    JsonLineConnection,
    WebSocket: WebSocketImpl = globalThis.WebSocket,
    codexAppServerChildEnv,
    getFreePort,
    assertCommandAvailable,
    broadcast,
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
    safeJsonByteLength,
    logWorkspaceDelegationRpc,
    activeRateLimits,
    rateLimitsByModelObject,
    codexProfileService,
    liveQuotaSnapshotForProfiles,
  } = dependencies;
  const latestLiveRateLimitsValue = typeof dependencies.latestLiveRateLimits === "function"
    ? dependencies.latestLiveRateLimits
    : () => null;

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
      this.requireSharedAppServer = true;
      try {
        await this.connectEndpoint(externalEndpoint);
        await this.initialize({ allowAlreadyInitialized: true });
        return;
      } catch (err) {
        this.closeTransportOnly();
        if (this.canStartOwnedMuxForEndpoint(externalEndpoint)) {
          console.error(`[codex app-server] profile mux endpoint unavailable; starting Mobile-owned mux (${err.message})`);
          await this.startOwnedMuxAndConnect();
          await this.initialize({ allowAlreadyInitialized: true });
          return;
        }
        this.lastError = `shared app-server endpoint unavailable (${err.message})`;
        console.error(`[codex app-server] ${this.lastError}`);
        throw new Error(this.lastError);
      }
    }

    if (this.requireSharedAppServer) {
      if (!DISABLE_MOBILE_OWNED_MUX && !EXTERNAL_APP_SERVER_WS && !EXTERNAL_APP_SERVER_TCP) {
        console.error(`[codex app-server] shared endpoint missing; starting Mobile-owned mux (${MUX_ENDPOINT_FILE})`);
        await this.startOwnedMuxAndConnect();
        await this.initialize({ allowAlreadyInitialized: true });
        return;
      }
      this.lastError = `shared app-server endpoint unavailable (${MUX_ENDPOINT_FILE} not found)`;
      console.error(`[codex app-server] ${this.lastError}`);
      throw new Error(this.lastError);
    }

    await this.startManagedChild();
    await this.connectEndpoint({ protocol: "ws", url: `ws://127.0.0.1:${this.port}`, source: "managed child", required: true });
    await this.initialize();
  }

  async startManagedChild() {
    assertCommandAvailable(CODEX_EXE, "Codex executable");
    if (!this.child || this.child.exitCode !== null || this.child.signalCode !== null) {
      this.port = await getFreePort();
      const child = spawn(CODEX_EXE, ["app-server", "--listen", `ws://127.0.0.1:${this.port}`], {
        cwd: APP_ROOT,
        env: codexAppServerChildEnv({ CODEX_HOME }),
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

  canStartOwnedMuxForEndpoint(endpoint) {
    if (DISABLE_MOBILE_OWNED_MUX || EXTERNAL_APP_SERVER_WS || EXTERNAL_APP_SERVER_TCP) return false;
    return Boolean(endpoint && endpoint.source && normalizeFsPath(endpoint.source) === normalizeFsPath(MUX_ENDPOINT_FILE));
  }

  async startOwnedMuxAndConnect() {
    assertCommandAvailable(CODEX_EXE, "Codex executable");
    if (this.muxChild && this.muxChild.exitCode === null && this.muxChild.signalCode === null) {
      return this.waitForMuxEndpointAndConnect();
    }

    fs.mkdirSync(path.dirname(MUX_ENDPOINT_FILE), { recursive: true });
    const muxPath = path.join(APP_ROOT, "codex-app-server-mux.js");
    const child = spawn(process.execPath, [muxPath, "app-server", "--analytics-default-enabled"], {
      cwd: APP_ROOT,
      env: codexAppServerChildEnv({
        CODEX_HOME,
        CODEX_MOBILE_RUNTIME_DIR: RUNTIME_ROOT,
        CODEX_MUX_STANDALONE: "1",
        CODEX_MUX_KEEP_ALIVE: "1",
        CODEX_MUX_PUBLISH_ENDPOINT: "1",
        CODEX_MUX_ENDPOINT_FILE: MUX_ENDPOINT_FILE,
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
    await this.waitForMuxEndpointAndConnect();
  }

  async waitForMuxEndpointAndConnect() {
    const deadline = Date.now() + 20000;
    let lastError = null;
    while (Date.now() < deadline) {
      const endpoint = resolveExternalEndpoint();
      if (endpoint && this.canStartOwnedMuxForEndpoint(endpoint)) {
        try {
          await this.connectEndpoint(endpoint);
          return;
        } catch (err) {
          lastError = err;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error(`Mobile-owned mux endpoint unavailable (${lastError ? lastError.message : `${MUX_ENDPOINT_FILE} not ready`})`);
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
        const connection = new JsonLineConnection(socket);
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
    let msg;
    try {
      msg = JSON.parse(String(raw));
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
        responsePayloadBytes: Buffer.byteLength(String(raw || ""), "utf8"),
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
      requestParamBytes: safeJsonByteLength(params),
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
    return this.transportKind === "external-jsonl-tcp"
      && this.endpoint
      && normalizeFsPath(this.endpoint.source) === normalizeFsPath(MUX_ENDPOINT_FILE);
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
      muxEndpointFile: MUX_ENDPOINT_FILE,
      persistentOwnedMux: PERSIST_MOBILE_OWNED_MUX,
      mobileOwnedMux: this.muxChild ? {
        pid: this.muxChild.pid || null,
        running: this.muxChild.exitCode === null && this.muxChild.signalCode === null,
      } : null,
      codexExe: CODEX_EXE,
      codexHome: CODEX_HOME,
      codexHomeSource: CODEX_HOME_RESOLUTION.source,
      codexHomeEnvIgnored: Boolean(CODEX_HOME_RESOLUTION.envCodexHomeIgnored),
      codexProfileActiveId: CODEX_HOME_RESOLUTION.activeProfileId,
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
  createCodexAppServerClient,
};
