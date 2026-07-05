"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
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

test("safeJsonByteLength returns bounded zero for unserializable values", () => {
  assert.equal(safeJsonByteLength({ ok: true }), Buffer.byteLength("{\"ok\":true}", "utf8"));
  const circular = {};
  circular.self = circular;
  assert.equal(safeJsonByteLength(circular), 0);
});
