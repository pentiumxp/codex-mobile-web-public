"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createRuntimeWorkspaceBootstrapService,
} = require("../services/runtime/runtime-workspace-bootstrap-service");
const adapter = require("../adapters/runtime-workspace-bootstrap-service");

function createHarness(overrides = {}) {
  const calls = {
    trust: [],
    mcp: [],
    registerExisting: [],
    logs: [],
    errors: [],
  };
  const service = createRuntimeWorkspaceBootstrapService(Object.assign({
    appRoot: "/repo",
    activeCodexHome: "/home/active/.codex",
    authKeyFile: "/runtime/access_key",
    port: 8787,
    runtimeRoot: "/runtime",
    env: {},
    processExecPath: "/node/bin/node",
    workspaceRegistryService: {
      registeredPaths: () => ["/workspace/a", "/workspace/b"],
      registerExisting: ({ cwd }) => {
        calls.registerExisting.push(cwd);
        return { ok: true, cwd };
      },
    },
    codexProfileService: {
      profiles: () => ({
        profiles: [
          { id: "active", codexHome: "/home/active/.codex", active: true, exists: true },
          { id: "secondary", codexHome: "/home/secondary/.codex", exists: true },
          { id: "missing", codexHome: "/home/missing/.codex", exists: false },
        ],
      }),
    },
    ensureCodexProjectsTrusted: (input) => {
      calls.trust.push(input);
      return { changed: false, added: [], configPath: `${input.codexHome}/config.toml` };
    },
    ensureCodexMobileMcpServer: (input) => {
      calls.mcp.push(input);
      return { changed: false, added: false, serverName: "codex_mobile", configPath: `${input.codexHome}/config.toml` };
    },
    logger: {
      log: (message) => calls.logs.push(message),
      error: (message) => calls.errors.push(message),
    },
  }, overrides));
  return { service, calls };
}

test("runtime workspace bootstrap adapter re-exports canonical service", () => {
  assert.equal(adapter.createRuntimeWorkspaceBootstrapService, createRuntimeWorkspaceBootstrapService);
});

test("workspace trust sync uses registered workspace paths and reports bounded errors", () => {
  const { service, calls } = createHarness();
  const result = service.syncRegisteredWorkspaceTrust();

  assert.equal(result.changed, false);
  assert.deepEqual(calls.trust, [{
    codexHome: "/home/active/.codex",
    projectPaths: ["/workspace/a", "/workspace/b"],
  }]);

  const failing = createHarness({
    ensureCodexProjectsTrusted: () => {
      throw new Error("trust failed");
    },
  });
  const failure = failing.service.syncRegisteredWorkspaceTrust("/custom/.codex");
  assert.equal(failure.changed, false);
  assert.equal(failure.error, "trust failed");
  assert.match(failing.calls.errors[0], /workspace-trust/);
});

test("mcp toolset sync registers every known existing profile home", () => {
  const { service, calls } = createHarness({
    env: { CODEX_MOBILE_MCP_SERVER_URL: "http://mobile.example.test" },
  });
  const result = service.syncKnownCodexMobileMcpToolsets();

  assert.equal(result.count, 2);
  assert.deepEqual(calls.mcp.map((item) => item.codexHome), [
    "/home/active/.codex",
    "/home/secondary/.codex",
  ]);
  assert.equal(calls.mcp[0].command, "/node/bin/node");
  assert.equal(calls.mcp[0].scriptPath, "/repo/scripts/codex-mobile-mcp-server.js");
  assert.equal(calls.mcp[0].baseUrl, "http://mobile.example.test");
  assert.equal(calls.mcp[0].keyFile, "/runtime/access_key");
  assert.equal(calls.mcp[0].rmwControlUrl, "http://127.0.0.1:8797");
  assert.equal(calls.mcp[0].rmwControlCredentialFile, "/runtime/rmw-control-credential");
  assert.equal(calls.mcp[0].rmwControlStateFile, "/runtime/rmw-control-client-state.json");
});

test("continuation workspace bootstrap registers workspace before trust and mcp sync", () => {
  const { service, calls } = createHarness();
  const result = service.ensureWorkspaceVisibleForContinuation("/workspace/new");

  assert.deepEqual(result, { ok: true, cwd: "/workspace/new" });
  assert.deepEqual(calls.registerExisting, ["/workspace/new"]);
  assert.equal(calls.trust.length, 1);
  assert.equal(calls.trust[0].codexHome, "/home/active/.codex");
  assert.equal(calls.mcp.length, 2);
});

test("active profile restart options are derived from selected or active profile", () => {
  const { service } = createHarness();

  assert.deepEqual(service.activeProfileRestartOptions(), {
    profileId: "active",
    codexHome: "/home/active/.codex",
  });
  assert.deepEqual(service.activeProfileRestartOptions({
    id: "selected",
    codexHome: "/home/selected/.codex",
  }), {
    profileId: "selected",
    codexHome: "/home/selected/.codex",
  });
  assert.deepEqual(service.activeProfileRestartOptions({ id: "broken" }), {});
});
