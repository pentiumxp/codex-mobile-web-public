"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const canonicalCodexAppServerClientService = require("../services/runtime/codex-app-server-client-service");
const adapterCodexAppServerClientService = require("../adapters/codex-app-server-client-service");

const {
  JsonLineConnection,
  createAppServerEndpointResolver,
  createCodexAppServerClient,
  parseTcpEndpoint,
  safeJsonByteLength,
} = canonicalCodexAppServerClientService;

test("app-server client adapter re-exports the canonical runtime service boundary", () => {
  assert.equal(
    adapterCodexAppServerClientService.createCodexAppServerClient,
    canonicalCodexAppServerClientService.createCodexAppServerClient,
  );
});

test("app-server client refreshes rate limits from the latest live getter", async () => {
  let liveRateLimits = { current: true };
  const getterValues = [];
  const checkedValues = [];
  const client = createCodexAppServerClient({
    LIVE_RATE_LIMIT_REFRESH_MIN_INTERVAL_MS: 0,
    latestLiveRateLimits: () => {
      getterValues.push(liveRateLimits);
      return liveRateLimits;
    },
    hasCurrentRateLimitWindow: (value) => {
      checkedValues.push(value);
      return Boolean(value && value.current);
    },
  });

  client.ready = true;
  client.ws = { readyState: 1 };

  let refreshCount = 0;
  client.refreshRateLimits = async () => {
    refreshCount += 1;
  };

  await client.refreshRateLimitsIfMissing();
  assert.equal(refreshCount, 0);

  liveRateLimits = null;
  await client.refreshRateLimitsIfMissing();
  assert.equal(refreshCount, 1);
  assert.deepEqual(getterValues, [{ current: true }, null]);
  assert.deepEqual(checkedValues, [{ current: true }]);
});

test("app-server transport parses tcp endpoints and rejects invalid ports", () => {
  assert.deepEqual(parseTcpEndpoint("4567", "TEST_TCP"), {
    protocol: "jsonl-tcp",
    host: "127.0.0.1",
    port: 4567,
    source: "TEST_TCP",
    required: true,
  });
  assert.deepEqual(parseTcpEndpoint("127.0.0.2:7654", "TEST_TCP"), {
    protocol: "jsonl-tcp",
    host: "127.0.0.2",
    port: 7654,
    source: "TEST_TCP",
    required: true,
  });
  assert.throws(() => parseTcpEndpoint("127.0.0.1:not-a-port", "TEST_TCP"), /Invalid TEST_TCP tcp endpoint/);
});

test("app-server endpoint resolver prefers explicit endpoints before mux file", () => {
  const resolverWithWs = createAppServerEndpointResolver({
    externalAppServerWs: "ws://127.0.0.1:9999",
    externalAppServerTcp: "127.0.0.1:8888",
    muxEndpointFile: "/tmp/ignored.json",
    fs: {
      readFileSync() {
        throw new Error("should not read mux endpoint file");
      },
    },
  });
  assert.deepEqual(resolverWithWs(), {
    protocol: "ws",
    url: "ws://127.0.0.1:9999",
    source: "CODEX_MOBILE_APP_SERVER_WS",
    required: true,
  });

  const resolverWithTcp = createAppServerEndpointResolver({
    externalAppServerTcp: "127.0.0.1:8888",
  });
  assert.deepEqual(resolverWithTcp(), {
    protocol: "jsonl-tcp",
    host: "127.0.0.1",
    port: 8888,
    source: "CODEX_MOBILE_APP_SERVER_TCP",
    required: true,
  });
});

test("app-server endpoint resolver reads bounded mux endpoint shapes", () => {
  const resolver = createAppServerEndpointResolver({
    muxEndpointFile: "/tmp/mux-endpoint.json",
    fs: {
      readFileSync(filePath, encoding) {
        assert.equal(filePath, "/tmp/mux-endpoint.json");
        assert.equal(encoding, "utf8");
        return JSON.stringify({
          protocol: "jsonl-tcp",
          host: "127.0.0.1",
          port: 4567,
          pid: 1234,
          childPid: 5678,
          codexExe: "/Applications/ChatGPT.app/Contents/Resources/codex",
          startedAt: "2026-07-05T00:00:00.000Z",
          capabilities: { mobileUserMessageEcho: true },
        });
      },
    },
  });
  assert.deepEqual(resolver(), {
    protocol: "jsonl-tcp",
    host: "127.0.0.1",
    port: 4567,
    source: "/tmp/mux-endpoint.json",
    capabilities: { mobileUserMessageEcho: true },
    required: true,
    pid: 1234,
    childPid: 5678,
    codexExe: "/Applications/ChatGPT.app/Contents/Resources/codex",
    startedAt: "2026-07-05T00:00:00.000Z",
  });

  const missingResolver = createAppServerEndpointResolver({
    muxEndpointFile: "/tmp/missing.json",
    fs: {
      readFileSync() {
        throw new Error("missing");
      },
    },
  });
  assert.equal(missingResolver(), null);
});

test("app-server endpoint resolver follows dynamic profile mux endpoint files", () => {
  let muxEndpointFile = "/tmp/first-mux-endpoint.json";
  const reads = [];
  const resolver = createAppServerEndpointResolver({
    muxEndpointFile: () => muxEndpointFile,
    fs: {
      readFileSync(filePath, encoding) {
        reads.push(filePath);
        assert.equal(encoding, "utf8");
        return JSON.stringify({
          protocol: "jsonl-tcp",
          host: "127.0.0.1",
          port: filePath.includes("second") ? 2345 : 1234,
        });
      },
    },
  });

  assert.equal(resolver().port, 1234);
  muxEndpointFile = "/tmp/second-mux-endpoint.json";
  assert.equal(resolver().port, 2345);
  assert.deepEqual(reads, ["/tmp/first-mux-endpoint.json", "/tmp/second-mux-endpoint.json"]);
});

test("turn requests rebind before sending after active profile changes", async () => {
  let active = {
    codexHome: "/home/user/.codex",
    muxEndpointFile: "/home/user/.codex/app-server-mux/endpoint.json",
    codexHomeResolution: { source: "profile-store", activeProfileId: "default" },
  };
  const client = createCodexAppServerClient({
    runtimeProfileBindingProvider: () => active,
    normalizeFsPath: (value) => String(value || ""),
    SAFE_RETRY_METHODS: new Set(),
    READ_RPC_TIMEOUT_MS: 1000,
    DEFAULT_RPC_TIMEOUT_MS: 1000,
  });
  let closeCount = 0;
  let startCount = 0;
  const sent = [];
  client.ready = true;
  client.ws = { readyState: 1, close() { closeCount += 1; } };
  client.rememberRuntimeBinding(active);

  active = {
    codexHome: "/home/user/.codex-homes/previous",
    muxEndpointFile: "/home/user/.codex-homes/previous/app-server-mux/endpoint.json",
    codexHomeResolution: { source: "profile-store", activeProfileId: "previous" },
  };
  client.startAndConnect = async () => {
    startCount += 1;
    client.ready = true;
    client.ws = { readyState: 1, close() {} };
    client.rememberRuntimeBinding(active);
  };
  client.sendRpc = async (method, params) => {
    sent.push({
      method,
      params,
      codexHome: client.status().codexHome,
      activeProfileId: client.status().codexProfileActiveId,
      profileBindingState: client.status().profileBindingState,
    });
    return { ok: true };
  };

  await client.request("turn/start", { threadId: "thread-1", input: [] }, { retry: false });

  assert.equal(closeCount, 1);
  assert.equal(startCount, 1);
  assert.deepEqual(sent, [{
    method: "turn/start",
    params: { threadId: "thread-1", input: [] },
    codexHome: "/home/user/.codex-homes/previous",
    activeProfileId: "previous",
    profileBindingState: "aligned",
  }]);
});

test("app-server client preserves a live profile mux when initialize fails", async () => {
  let startOwnedMuxCount = 0;
  const endpoint = {
    protocol: "jsonl-tcp",
    host: "127.0.0.1",
    port: 4567,
    source: "/tmp/profile-mux-endpoint.json",
    pid: 1234,
    required: true,
  };
  const client = createCodexAppServerClient({
    REQUIRE_SHARED_APP_SERVER: true,
    MUX_ENDPOINT_FILE: "/tmp/profile-mux-endpoint.json",
    PERSIST_MOBILE_OWNED_MUX: true,
    resolveExternalEndpoint: () => endpoint,
    normalizeFsPath: (value) => String(value || ""),
    processImpl: {
      kill(pid, signal) {
        assert.equal(pid, 1234);
        assert.equal(signal, 0);
      },
    },
  });
  client.connectEndpoint = async (target) => {
    client.endpoint = target;
    client.transportKind = "external-jsonl-tcp";
    client.ws = { readyState: 1, close() {} };
  };
  client.initialize = async () => {
    throw new Error("Codex request timed out: initialize");
  };
  client.startOwnedMuxAndConnect = async () => {
    startOwnedMuxCount += 1;
  };

  await assert.rejects(
    () => client.startAndConnect(),
    /shared app-server endpoint preserved after initialize failure/,
  );
  assert.equal(startOwnedMuxCount, 0);
  assert.match(client.lastError, /preserved/);
});

test("app-server client replaces a profile mux only after the endpoint process is dead", async () => {
  let startOwnedMuxCount = 0;
  const endpoint = {
    protocol: "jsonl-tcp",
    host: "127.0.0.1",
    port: 4567,
    source: "/tmp/profile-mux-endpoint.json",
    pid: 1234,
    required: true,
  };
  const client = createCodexAppServerClient({
    REQUIRE_SHARED_APP_SERVER: true,
    MUX_ENDPOINT_FILE: "/tmp/profile-mux-endpoint.json",
    PERSIST_MOBILE_OWNED_MUX: true,
    resolveExternalEndpoint: () => endpoint,
    normalizeFsPath: (value) => String(value || ""),
    processImpl: {
      kill() {
        const err = new Error("not found");
        err.code = "ESRCH";
        throw err;
      },
    },
  });
  client.connectEndpoint = async () => {
    throw new Error("connect ECONNREFUSED");
  };
  client.initialize = async () => {};
  client.startOwnedMuxAndConnect = async () => {
    startOwnedMuxCount += 1;
    client.endpoint = endpoint;
    client.transportKind = "external-jsonl-tcp";
    client.ws = { readyState: 1, close() {} };
  };

  await client.startAndConnect();
  assert.equal(startOwnedMuxCount, 1);
});

test("app-server client replaces a live profile mux when codex executable changed", async () => {
  let startOwnedMuxCount = 0;
  let connectExternalCount = 0;
  let initializeCount = 0;
  const endpoint = {
    protocol: "jsonl-tcp",
    host: "127.0.0.1",
    port: 4567,
    source: "/tmp/profile-mux-endpoint.json",
    pid: 1234,
    codexExe: "/Applications/ChatGPT.app/Contents/Resources/codex",
    required: true,
  };
  const client = createCodexAppServerClient({
    REQUIRE_SHARED_APP_SERVER: true,
    MUX_ENDPOINT_FILE: "/tmp/profile-mux-endpoint.json",
    CODEX_EXE: "/Users/xuxin/.local/bin/codex",
    PERSIST_MOBILE_OWNED_MUX: true,
    resolveExternalEndpoint: () => endpoint,
    normalizeFsPath: (value) => String(value || ""),
  });
  client.connectEndpoint = async () => {
    connectExternalCount += 1;
    throw new Error("external endpoint should not be used");
  };
  client.initialize = async () => {
    initializeCount += 1;
  };
  client.startOwnedMuxAndConnect = async () => {
    startOwnedMuxCount += 1;
    client.endpoint = {
      protocol: "jsonl-tcp",
      host: "127.0.0.1",
      port: 7654,
      source: "/tmp/profile-mux-endpoint.json",
      codexExe: "/Users/xuxin/.local/bin/codex",
    };
    client.transportKind = "external-jsonl-tcp";
    client.ws = { readyState: 1, close() {} };
  };

  await client.startAndConnect();
  assert.equal(connectExternalCount, 0);
  assert.equal(startOwnedMuxCount, 1);
  assert.equal(initializeCount, 1);
});

test("app-server client replaces stale profile mux from resolver-declared codex executable", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-app-server-resolver-exe-"));
  const endpointFile = path.join(tempDir, "profile-mux-endpoint.json");
  fs.writeFileSync(endpointFile, JSON.stringify({
    protocol: "jsonl-tcp",
    host: "127.0.0.1",
    port: 4567,
    pid: 1234,
    codexExe: "/Applications/ChatGPT.app/Contents/Resources/codex",
  }), "utf8");
  let startOwnedMuxCount = 0;
  let connectExternalCount = 0;
  try {
    const resolver = createAppServerEndpointResolver({
      muxEndpointFile: endpointFile,
      fs,
    });
    const resolved = resolver();
    assert.equal(resolved.codexExe, "/Applications/ChatGPT.app/Contents/Resources/codex");
    const client = createCodexAppServerClient({
      REQUIRE_SHARED_APP_SERVER: true,
      MUX_ENDPOINT_FILE: endpointFile,
      CODEX_EXE: "/Users/xuxin/.local/bin/codex",
      PERSIST_MOBILE_OWNED_MUX: true,
      resolveExternalEndpoint: resolver,
      normalizeFsPath: (value) => path.resolve(String(value || "")),
    });
    client.connectEndpoint = async () => {
      connectExternalCount += 1;
      throw new Error("stale profile endpoint should not be connected");
    };
    client.initialize = async () => {};
    client.startOwnedMuxAndConnect = async () => {
      startOwnedMuxCount += 1;
      client.endpoint = {
        protocol: "jsonl-tcp",
        host: "127.0.0.1",
        port: 7654,
        source: endpointFile,
        codexExe: "/Users/xuxin/.local/bin/codex",
      };
      client.transportKind = "external-jsonl-tcp";
      client.ws = { readyState: 1, close() {} };
    };

    await client.startAndConnect();
    assert.equal(connectExternalCount, 0);
    assert.equal(startOwnedMuxCount, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("app-server client keeps profile mux when codex executable resolves to same real path", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-app-server-client-"));
  const realCodex = path.join(tempDir, "codex-real");
  const symlinkCodex = path.join(tempDir, "codex-link");
  fs.writeFileSync(realCodex, "#!/bin/sh\n", { mode: 0o755 });
  fs.symlinkSync(realCodex, symlinkCodex);
  let startOwnedMuxCount = 0;
  let connectExternalCount = 0;
  try {
    const endpoint = {
      protocol: "jsonl-tcp",
      host: "127.0.0.1",
      port: 4567,
      source: path.join(tempDir, "profile-mux-endpoint.json"),
      pid: 1234,
      codexExe: realCodex,
      required: true,
    };
    const client = createCodexAppServerClient({
      REQUIRE_SHARED_APP_SERVER: true,
      MUX_ENDPOINT_FILE: endpoint.source,
      CODEX_EXE: symlinkCodex,
      PERSIST_MOBILE_OWNED_MUX: true,
      resolveExternalEndpoint: () => endpoint,
      normalizeFsPath: (value) => path.resolve(String(value || "")),
    });
    client.connectEndpoint = async (target) => {
      connectExternalCount += 1;
      client.endpoint = target;
      client.transportKind = "external-jsonl-tcp";
      client.ws = { readyState: 1, close() {} };
    };
    client.initialize = async () => {};
    client.startOwnedMuxAndConnect = async () => {
      startOwnedMuxCount += 1;
    };

    await client.startAndConnect();
    assert.equal(connectExternalCount, 1);
    assert.equal(startOwnedMuxCount, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("app-server client keeps legacy profile mux endpoints without codex executable identity", async () => {
  let startOwnedMuxCount = 0;
  let connectExternalCount = 0;
  const endpoint = {
    protocol: "jsonl-tcp",
    host: "127.0.0.1",
    port: 4567,
    source: "/tmp/profile-mux-endpoint.json",
    pid: 1234,
    required: true,
  };
  const client = createCodexAppServerClient({
    REQUIRE_SHARED_APP_SERVER: true,
    MUX_ENDPOINT_FILE: "/tmp/profile-mux-endpoint.json",
    CODEX_EXE: "/Users/xuxin/.local/bin/codex",
    PERSIST_MOBILE_OWNED_MUX: true,
    resolveExternalEndpoint: () => endpoint,
    normalizeFsPath: (value) => String(value || ""),
  });
  client.connectEndpoint = async (target) => {
    connectExternalCount += 1;
    client.endpoint = target;
    client.transportKind = "external-jsonl-tcp";
    client.ws = { readyState: 1, close() {} };
  };
  client.initialize = async () => {};
  client.startOwnedMuxAndConnect = async () => {
    startOwnedMuxCount += 1;
  };

  await client.startAndConnect();
  assert.equal(connectExternalCount, 1);
  assert.equal(startOwnedMuxCount, 0);
});

test("app-server client does not replace explicit external endpoints for executable mismatch", async () => {
  let startOwnedMuxCount = 0;
  let connectExternalCount = 0;
  const endpoint = {
    protocol: "jsonl-tcp",
    host: "127.0.0.1",
    port: 4567,
    source: "CODEX_MOBILE_APP_SERVER_TCP",
    pid: 1234,
    codexExe: "/Applications/ChatGPT.app/Contents/Resources/codex",
    required: true,
  };
  const client = createCodexAppServerClient({
    REQUIRE_SHARED_APP_SERVER: true,
    MUX_ENDPOINT_FILE: "/tmp/profile-mux-endpoint.json",
    CODEX_EXE: "/Users/xuxin/.local/bin/codex",
    PERSIST_MOBILE_OWNED_MUX: true,
    resolveExternalEndpoint: () => endpoint,
    normalizeFsPath: (value) => String(value || ""),
  });
  client.connectEndpoint = async (target) => {
    connectExternalCount += 1;
    client.endpoint = target;
    client.transportKind = "external-jsonl-tcp";
    client.ws = { readyState: 1, close() {} };
  };
  client.initialize = async () => {};
  client.startOwnedMuxAndConnect = async () => {
    startOwnedMuxCount += 1;
  };

  await client.startAndConnect();
  assert.equal(connectExternalCount, 1);
  assert.equal(startOwnedMuxCount, 0);
});

test("JsonLineConnection emits complete json lines and writes newline-delimited messages", () => {
  class FakeSocket extends EventEmitter {
    constructor() {
      super();
      this.writes = [];
      this.ended = false;
      this.encoding = "";
    }

    setEncoding(value) {
      this.encoding = value;
    }

    write(value) {
      this.writes.push(value);
    }

    end() {
      this.ended = true;
      this.emit("close");
    }

    destroy() {
      this.ended = true;
      this.emit("close");
    }
  }

  const socket = new FakeSocket();
  const connection = new JsonLineConnection(socket);
  const messages = [];
  let closed = false;
  connection.onmessage = (event) => messages.push(event.data);
  connection.onclose = () => {
    closed = true;
  };

  socket.emit("data", "{\"id\":1");
  socket.emit("data", "}\n\n {\"id\":2}\n");
  connection.send("{\"id\":3}");
  connection.close();

  assert.equal(socket.encoding, "utf8");
  assert.deepEqual(messages, ["{\"id\":1}", "{\"id\":2}"]);
  assert.deepEqual(socket.writes, ["{\"id\":3}\n"]);
  assert.equal(socket.ended, true);
  assert.equal(closed, true);
  assert.equal(connection.readyState, 3);
  assert.throws(() => connection.send("{}"), /jsonl tcp connection is not open/);
});

test("JsonLineConnection closes before buffering oversized app-server lines", () => {
  class FakeSocket extends EventEmitter {
    constructor() {
      super();
      this.destroyed = false;
      this.encoding = "";
    }

    setEncoding(value) {
      this.encoding = value;
    }

    write() {}

    destroy() {
      this.destroyed = true;
      this.emit("close");
    }
  }

  const socket = new FakeSocket();
  const connection = new JsonLineConnection(socket, { maxInboundMessageBytes: 1024 * 1024 });
  const messages = [];
  let error = null;
  let closed = false;
  connection.onmessage = (event) => messages.push(event.data);
  connection.onerror = (err) => {
    error = err;
  };
  connection.onclose = () => {
    closed = true;
  };

  socket.emit("data", "x".repeat(1024 * 1024));
  socket.emit("data", "y");

  assert.equal(socket.encoding, "utf8");
  assert.equal(socket.destroyed, true);
  assert.equal(closed, true);
  assert.equal(connection.readyState, 3);
  assert.equal(messages.length, 0);
  assert.equal(error && error.code, "APP_SERVER_MESSAGE_TOO_LARGE");
});

test("app-server client fails pending RPC instead of parsing oversized inbound responses", async () => {
  const sent = [];
  let closed = false;
  const client = createCodexAppServerClient({
    MAX_APP_SERVER_INBOUND_MESSAGE_BYTES: 1024 * 1024,
    DEFAULT_RPC_TIMEOUT_MS: 1000,
    READ_RPC_TIMEOUT_MS: 1000,
    SAFE_RETRY_METHODS: new Set(),
    SERVER_REQUEST_METHODS: new Set(),
    MUX_ENDPOINT_FILE: "/tmp/profile-mux-endpoint.json",
    broadcast() {},
    logWorkspaceDelegationRpc() {},
  });
  client.ready = true;
  client.ws = {
    readyState: 1,
    send(value) {
      sent.push(value);
    },
    close() {
      closed = true;
    },
  };

  const diagnostics = {};
  const pending = client.sendRpc("thread/read", { threadId: "thread-large" }, 1000, { diagnostics });
  client.handleMessage(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    result: { text: "x".repeat(1024 * 1024) },
  }));

  await assert.rejects(pending, /codex app-server inbound message exceeded/);
  assert.equal(sent.length, 1);
  assert.equal(closed, true);
  assert.equal(client.ready, false);
  assert.equal(client.pending.size, 0);
  assert.equal(diagnostics.errorCode, "APP_SERVER_MESSAGE_TOO_LARGE");
  assert.ok(diagnostics.responsePayloadBytes > 1024 * 1024);
});

test("safeJsonByteLength returns bounded zero for unserializable values", () => {
  assert.equal(safeJsonByteLength({ ok: true }), Buffer.byteLength("{\"ok\":true}", "utf8"));
  const circular = {};
  circular.self = circular;
  assert.equal(safeJsonByteLength(circular), 0);
});
