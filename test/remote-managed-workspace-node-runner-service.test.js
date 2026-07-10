"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createRemoteManagedWorkspaceSettingsService,
} = require("../services/remote-managed-workspaces/remote-managed-workspace-settings-service");
const {
  createRemoteManagedWorkspaceNodeRunnerService,
} = require("../services/remote-managed-workspaces/remote-managed-workspace-node-runner-service");

function makeSettings() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-runner-"));
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  const service = createRemoteManagedWorkspaceSettingsService({
    fs,
    path,
    settingsFile: path.join(root, "settings.json"),
    stateFile: path.join(root, "state.json"),
    enrollmentTokenFile: path.join(root, "secret", "enrollment-token"),
    now: () => new Date("2026-07-08T00:00:00.000Z"),
  });
  service.saveSettings({
    enabled: true,
    workspaceId: "rmw_runner",
    nodeName: "runner-node",
    centralUrl: "http://127.0.0.1:9999",
    projectRoot,
    allowedRoot: root,
    enrollmentToken: "runner-token",
  });
  return { root, service };
}

function fakeNodeClient(cards, calls, options = {}) {
  return {
    register: async (config) => {
      calls.push(["register", config.workspaceId, config.enrollmentToken]);
      return { result: { ok: true } };
    },
    nodeHeartbeat: async () => {
      calls.push(["nodeHeartbeat"]);
      return { ok: true };
    },
    pollTaskCards: async () => {
      calls.push(["pollTaskCards"]);
      return { ok: true, cards: cards.length ? [cards[0]] : [], count: cards.length ? 1 : 0 };
    },
    ackTaskCard: async (_config, taskCardId) => {
      calls.push(["ackTaskCard", taskCardId]);
      return { ok: true };
    },
    heartbeatTaskCard: async (_config, taskCardId) => {
      calls.push(["heartbeatTaskCard", taskCardId]);
      return { ok: true };
    },
    returnTaskCard: async (_config, taskCardId, payload) => {
      calls.push(["returnTaskCard", taskCardId, payload.status, payload.summary || "", payload.metadata && payload.metadata.blocker || ""]);
      if (options.failReturnOnce) {
        options.failReturnOnce = false;
        const err = new Error("fetch failed");
        err.code = "ECONNRESET";
        throw err;
      }
      cards.shift();
      return { ok: true };
    },
  };
}

test("remote node runner registers, heartbeats, polls, acks, heartbeats card, and returns execution-bridge blocker", async () => {
  const { root, service } = makeSettings();
  const calls = [];
  const cards = [{ taskCardId: "ttc_runner_a", idempotencyKey: "idem-a", title: "Runner task" }];
  try {
    const runner = createRemoteManagedWorkspaceNodeRunnerService({
      settingsService: service,
      nodeClientService: fakeNodeClient(cards, calls),
      now: () => new Date("2026-07-08T00:00:00.000Z"),
    });
    const result = await runner.runOnce({ force: true });

    assert.equal(result.ok, true);
    assert.equal(result.polledCount, 1);
    assert.equal(result.processed.terminalStatus, "partially_completed");
    assert.deepEqual(calls.map((entry) => entry[0]), [
      "register",
      "nodeHeartbeat",
      "pollTaskCards",
      "ackTaskCard",
      "heartbeatTaskCard",
      "returnTaskCard",
    ]);
    assert.equal(calls[0][2], "runner-token");
    assert.equal(calls[5][4], "local_task_card_execution_bridge_unavailable");
    assert.equal(result.status.connectionStatus, "connected");
    assert.equal(result.status.lastTaskCardId, "ttc_runner_a");
    assert.doesNotMatch(JSON.stringify(result.status), /runner-token/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote node runner executes local bridge, heartbeats while active, and records local execution ids", async () => {
  const { root, service } = makeSettings();
  const calls = [];
  const cards = [{ taskCardId: "ttc_runner_local", idempotencyKey: "idem-local", title: "Runner local task" }];
  try {
    const runner = createRemoteManagedWorkspaceNodeRunnerService({
      settingsService: service,
      nodeClientService: fakeNodeClient(cards, calls),
      taskCardHeartbeatIntervalMs: 1000,
      taskCardExecutor: async (card, context) => {
        assert.equal(card.taskCardId, "ttc_runner_local");
        assert.equal(context.config.workspaceId, "rmw_runner");
        context.onExecutionStarted({ threadId: "local-thread-runner", turnId: "local-turn-runner" });
        await context.heartbeat({
          status: "working",
          localThreadId: "local-thread-runner",
          localTurnId: "local-turn-runner",
        });
        return {
          status: "completed",
          title: "远程任务完成",
          summary: "local_task_card_execution_completed",
          metadata: {
            localExecutionBridge: "codex_mobile_local_runtime",
            localThreadId: "local-thread-runner",
            localTurnId: "local-turn-runner",
          },
        };
      },
      now: () => new Date("2026-07-08T00:00:00.000Z"),
    });
    const result = await runner.runOnce({ force: true });
    const heartbeatCalls = calls.filter((entry) => entry[0] === "heartbeatTaskCard");

    assert.equal(result.ok, true);
    assert.equal(result.processed.terminalStatus, "completed");
    assert.equal(heartbeatCalls.length >= 2, true);
    assert.equal(result.status.lastLocalThreadId, "local-thread-runner");
    assert.equal(result.status.lastLocalTurnId, "local-turn-runner");
    assert.equal(result.status.lastExecutionBridgeStatus, "codex_mobile_local_runtime");
    assert.equal(result.status.activeTaskCardId, "");
    assert.doesNotMatch(JSON.stringify(result.status), /runner-token/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote node runner consumes auto-generated workspace settings", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-runner-generated-"));
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  const service = createRemoteManagedWorkspaceSettingsService({
    fs,
    path,
    settingsFile: path.join(root, "settings.json"),
    stateFile: path.join(root, "state.json"),
    enrollmentTokenFile: path.join(root, "secret", "enrollment-token"),
    now: () => new Date("2026-07-08T00:00:00.000Z"),
  });
  const generated = service.enableWorkspace({
    centralUrl: "http://127.0.0.1:9999",
    workspace: {
      cwd: projectRoot,
      label: "Generated Project",
    },
    enrollmentToken: "generated-runner-token",
  });
  const calls = [];
  const cards = [{ taskCardId: "ttc_runner_generated", idempotencyKey: "idem-generated", title: "Generated task" }];
  try {
    const runner = createRemoteManagedWorkspaceNodeRunnerService({
      settingsService: service,
      nodeClientService: fakeNodeClient(cards, calls),
      taskCardExecutor: async () => ({ status: "completed", title: "done", summary: "done" }),
      now: () => new Date("2026-07-08T00:00:00.000Z"),
    });
    const result = await runner.runOnce({ force: true });

    assert.equal(result.ok, true);
    assert.equal(calls[0][1], generated.workspaceId);
    assert.equal(calls[0][2], "generated-runner-token");
    assert.equal(result.processed.terminalStatus, "completed");
    assert.equal(result.status.lastTaskCardId, "ttc_runner_generated");
    assert.doesNotMatch(JSON.stringify(result.status), /generated-runner-token/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote node runner requests pairing before trusted register, heartbeat, and poll", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-runner-pairing-"));
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  const service = createRemoteManagedWorkspaceSettingsService({
    fs,
    path,
    settingsFile: path.join(root, "settings.json"),
    stateFile: path.join(root, "state.json"),
    enrollmentTokenFile: path.join(root, "secret", "scoped-credential"),
    now: () => new Date("2026-07-08T00:00:00.000Z"),
  });
  service.enableWorkspace({
    centralUrl: "http://127.0.0.1:9999",
    workspace: {
      cwd: projectRoot,
      label: "Pairing Project",
    },
  });
  const calls = [];
  let approved = false;
  const nodeClient = Object.assign(fakeNodeClient([], calls), {
    requestPairing: async (config) => {
      calls.push(["requestPairing", config.workspaceId, config.projectRootLabel]);
      return { result: { pairing: { requestId: "rmw_pair_runner", status: "pending_approval" } } };
    },
    pollPairingStatus: async (_config, requestId) => {
      calls.push(["pollPairingStatus", requestId]);
      return {
        result: {
          pairing: approved
            ? { requestId, status: "approved", scopedCredential: "approved-runner-credential" }
            : { requestId, status: "pending_approval" },
        },
      };
    },
  });
  try {
    const runner = createRemoteManagedWorkspaceNodeRunnerService({
      settingsService: service,
      nodeClientService: nodeClient,
      taskCardExecutor: async () => ({ status: "completed", title: "done", summary: "done" }),
      now: () => new Date("2026-07-08T00:00:00.000Z"),
    });

    const pending = await runner.runOnce({ force: true });
    assert.equal(pending.ok, true);
    assert.equal(pending.skipped, "pending_approval");
    assert.equal(pending.status.pairingStatus, "pending_approval");
    assert.deepEqual(calls.map((entry) => entry[0]), ["requestPairing"]);

    const stillPending = await runner.runOnce({ force: true });
    assert.equal(stillPending.skipped, "pending_approval");
    assert.equal(calls.filter((entry) => entry[0] === "register").length, 0);
    assert.equal(calls.filter((entry) => entry[0] === "pollTaskCards").length, 0);
    assert.deepEqual(calls.map((entry) => entry[0]), ["requestPairing", "pollPairingStatus"]);

    approved = true;
    const connected = await runner.runOnce({ force: true });
    assert.equal(connected.ok, true);
    assert.equal(connected.registered, true);
    assert.equal(connected.status.pairingStatus, "connected");
    assert.equal(calls.some((entry) => entry[0] === "register" && entry[2] === "approved-runner-credential"), true);
    assert.equal(calls.some((entry) => entry[0] === "nodeHeartbeat"), true);
    assert.equal(calls.some((entry) => entry[0] === "pollTaskCards"), true);
    assert.equal(fs.readFileSync(path.join(root, "secret", "scoped-credential"), "utf8").trim(), "approved-runner-credential");
    assert.doesNotMatch(JSON.stringify(connected.status), /approved-runner-credential/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote node runner polls persisted pairing request after offline retry instead of posting replacement request", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-runner-pairing-offline-"));
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  const service = createRemoteManagedWorkspaceSettingsService({
    fs,
    path,
    settingsFile: path.join(root, "settings.json"),
    stateFile: path.join(root, "state.json"),
    enrollmentTokenFile: path.join(root, "secret", "scoped-credential"),
    now: () => new Date("2026-07-08T00:00:00.000Z"),
  });
  service.enableWorkspace({
    centralUrl: "http://127.0.0.1:9999",
    workspace: {
      cwd: projectRoot,
      label: "Offline Pairing Project",
    },
  });
  service.applyPairingResult({
    pairing: { requestId: "rmw_pair_offline_retry", status: "pending_approval" },
  });
  service.updateConnectionState({
    connectionStatus: "offline",
    pairingStatus: "offline_retrying",
    issueCode: "fetch_failed",
  });
  const calls = [];
  const nodeClient = Object.assign(fakeNodeClient([], calls), {
    requestPairing: async () => {
      calls.push(["requestPairing"]);
      return { result: { pairing: { requestId: "rmw_pair_replacement", status: "pending_approval" } } };
    },
    pollPairingStatus: async (_config, requestId) => {
      calls.push(["pollPairingStatus", requestId]);
      return {
        result: {
          pairing: {
            requestId,
            status: "approved",
            scopedCredential: "offline-approved-runner-credential",
          },
        },
      };
    },
  });
  try {
    const runner = createRemoteManagedWorkspaceNodeRunnerService({
      settingsService: service,
      nodeClientService: nodeClient,
      now: () => new Date("2026-07-08T00:00:00.000Z"),
    });
    const connected = await runner.runOnce({ force: true });

    assert.equal(connected.ok, true);
    assert.equal(connected.status.pairingStatus, "connected");
    assert.equal(connected.status.scopedCredentialConfigured, true);
    assert.equal(calls[0][0], "pollPairingStatus");
    assert.equal(calls[0][1], "rmw_pair_offline_retry");
    assert.equal(calls.some((entry) => entry[0] === "requestPairing"), false);
    assert.equal(calls.some((entry) => entry[0] === "register" && entry[2] === "offline-approved-runner-credential"), true);
    assert.equal(fs.readFileSync(path.join(root, "secret", "scoped-credential"), "utf8").trim(), "offline-approved-runner-credential");
    assert.doesNotMatch(JSON.stringify(connected.status), /offline-approved-runner-credential/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote node runner clears invalid scoped credential and resumes persisted pairing request", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-runner-invalid-scoped-credential-"));
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  const credentialFile = path.join(root, "secret", "scoped-credential");
  const service = createRemoteManagedWorkspaceSettingsService({
    fs,
    path,
    settingsFile: path.join(root, "settings.json"),
    stateFile: path.join(root, "state.json"),
    enrollmentTokenFile: credentialFile,
    now: () => new Date("2026-07-08T00:00:00.000Z"),
  });
  service.enableWorkspace({
    centralUrl: "http://127.0.0.1:9999",
    workspace: {
      cwd: projectRoot,
      label: "Invalid Scoped Credential Project",
    },
  });
  service.applyPairingResult({
    pairing: {
      requestId: "rmw_pair_invalid_scoped_credential",
      status: "approved",
      scopedCredential: "stale-scoped-credential",
    },
  });
  const calls = [];
  let failRegister = true;
  const nodeClient = Object.assign(fakeNodeClient([], calls), {
    register: async (config) => {
      calls.push(["register", config.workspaceId, config.enrollmentToken]);
      if (failRegister) {
        const err = new Error("remote_managed_workspace_scoped_node_credential_invalid");
        err.code = "remote_managed_workspace_scoped_node_credential_invalid";
        err.statusCode = 401;
        throw err;
      }
      return { result: { ok: true } };
    },
    requestPairing: async () => {
      calls.push(["requestPairing"]);
      return { result: { pairing: { requestId: "rmw_pair_replacement", status: "pending_approval" } } };
    },
    pollPairingStatus: async (_config, requestId) => {
      calls.push(["pollPairingStatus", requestId]);
      return {
        result: {
          pairing: {
            requestId,
            status: "approved",
            scopedCredential: "fresh-scoped-credential",
          },
        },
      };
    },
  });
  try {
    const runner = createRemoteManagedWorkspaceNodeRunnerService({
      settingsService: service,
      nodeClientService: nodeClient,
      now: () => new Date("2026-07-08T00:00:00.000Z"),
    });

    const failed = await runner.runOnce({ force: true, suppressErrors: true });
    assert.equal(failed.ok, false);
    assert.equal(failed.error, "remote_managed_workspace_scoped_node_credential_invalid");
    assert.equal(failed.status.connectionStatus, "auth_failed");
    assert.equal(failed.status.pairingStatus, "pending_approval");
    assert.equal(failed.status.pairingRequestId, "rmw_pair_invalid_scoped_credential");
    assert.equal(failed.status.scopedCredentialConfigured, false);
    assert.equal(failed.status.issueCodes.includes("remote_managed_workspace_scoped_node_credential_invalid"), true);
    assert.equal(fs.existsSync(credentialFile), false);
    assert.deepEqual(calls.map((entry) => entry[0]), ["register"]);
    assert.doesNotMatch(JSON.stringify(failed.status), /stale-scoped-credential|fresh-scoped-credential/);

    failRegister = false;
    const recovered = await runner.runOnce({ force: true });
    assert.equal(recovered.ok, true);
    assert.equal(recovered.status.connectionStatus, "connected");
    assert.equal(recovered.status.pairingStatus, "connected");
    assert.equal(recovered.status.scopedCredentialConfigured, true);
    assert.equal(fs.readFileSync(credentialFile, "utf8").trim(), "fresh-scoped-credential");
    assert.equal(calls.some((entry) => entry[0] === "requestPairing"), false);
    assert.equal(calls.some((entry) => entry[0] === "pollPairingStatus" && entry[1] === "rmw_pair_invalid_scoped_credential"), true);
    assert.equal(calls.some((entry) => entry[0] === "register" && entry[2] === "fresh-scoped-credential"), true);
    assert.doesNotMatch(JSON.stringify(recovered.status), /stale-scoped-credential|fresh-scoped-credential/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote node runner retires stale paired request without credential after invalid credential recovery", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-runner-stale-paired-request-"));
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  const credentialFile = path.join(root, "secret", "scoped-credential");
  const service = createRemoteManagedWorkspaceSettingsService({
    fs,
    path,
    settingsFile: path.join(root, "settings.json"),
    stateFile: path.join(root, "state.json"),
    enrollmentTokenFile: credentialFile,
    now: () => new Date("2026-07-08T00:00:00.000Z"),
  });
  service.enableWorkspace({
    centralUrl: "http://127.0.0.1:9999",
    workspace: {
      cwd: projectRoot,
      label: "Stale Paired Request Project",
    },
  });
  service.applyPairingResult({
    pairing: {
      requestId: "rmw_pair_consumed_credential",
      status: "approved",
      scopedCredential: "consumed-scoped-credential",
    },
  });
  const calls = [];
  let failRegister = true;
  let freshRequestApproved = false;
  const nodeClient = Object.assign(fakeNodeClient([], calls), {
    register: async (config) => {
      calls.push(["register", config.workspaceId, config.enrollmentToken]);
      if (failRegister) {
        const err = new Error("remote_managed_workspace_scoped_node_credential_invalid");
        err.code = "remote_managed_workspace_scoped_node_credential_invalid";
        err.statusCode = 401;
        throw err;
      }
      return { result: { ok: true } };
    },
    pollPairingStatus: async (_config, requestId) => {
      calls.push(["pollPairingStatus", requestId]);
      if (requestId === "rmw_pair_rekey" && freshRequestApproved) {
        return {
          result: {
            pairing: {
              requestId,
              status: "approved",
              scopedCredential: "fresh-rekey-credential",
            },
          },
        };
      }
      return { result: { pairing: { requestId, status: "approved" } } };
    },
    requestPairing: async () => {
      calls.push(["requestPairing"]);
      return {
        result: {
          pairing: freshRequestApproved
            ? { requestId: "rmw_pair_rekey", status: "approved", scopedCredential: "fresh-rekey-credential" }
            : { requestId: "rmw_pair_rekey", status: "pending_approval" },
        },
      };
    },
  });
  try {
    const runner = createRemoteManagedWorkspaceNodeRunnerService({
      settingsService: service,
      nodeClientService: nodeClient,
      now: () => new Date("2026-07-08T00:00:00.000Z"),
    });

    const failed = await runner.runOnce({ force: true, suppressErrors: true });
    assert.equal(failed.ok, false);
    assert.equal(failed.status.pairingRequestId, "rmw_pair_consumed_credential");
    assert.equal(failed.status.scopedCredentialConfigured, false);
    assert.equal(fs.existsSync(credentialFile), false);

    const retired = await runner.runOnce({ force: true });
    assert.equal(retired.skipped, "stale_pairing_request_retired");
    assert.equal(retired.status.pairingStatus, "unconfigured");
    assert.equal(retired.status.pairingRequestId, "");
    assert.equal(retired.status.scopedCredentialConfigured, false);
    assert.equal(retired.status.issueCodes.includes("stale_pairing_request_missing_scoped_credential"), true);
    assert.equal(calls.some((entry) => entry[0] === "pollPairingStatus" && entry[1] === "rmw_pair_consumed_credential"), true);

    const pending = await runner.runOnce({ force: true });
    assert.equal(pending.skipped, "pending_approval");
    assert.equal(pending.status.pairingRequestId, "rmw_pair_rekey");
    assert.equal(calls.filter((entry) => entry[0] === "requestPairing").length, 1);

    freshRequestApproved = true;
    failRegister = false;
    const recovered = await runner.runOnce({ force: true });
    assert.equal(recovered.ok, true);
    assert.equal(recovered.status.connectionStatus, "connected");
    assert.equal(recovered.status.pairingStatus, "connected");
    assert.equal(recovered.status.scopedCredentialConfigured, true);
    assert.equal(fs.readFileSync(credentialFile, "utf8").trim(), "fresh-rekey-credential");
    assert.equal(calls.some((entry) => entry[0] === "register" && entry[2] === "fresh-rekey-credential"), true);
    assert.doesNotMatch(JSON.stringify(recovered.status), /consumed-scoped-credential|fresh-rekey-credential/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote node runner rotates from stale external credential to fresh write-only credential", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-runner-credential-rotation-"));
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  const credentialFile = path.join(root, "secret", "scoped-credential");
  const service = createRemoteManagedWorkspaceSettingsService({
    fs,
    path,
    settingsFile: path.join(root, "settings.json"),
    stateFile: path.join(root, "state.json"),
    enrollmentTokenFile: credentialFile,
    env: { STALE_RMW_TOKEN: "stale-env-credential" },
    now: () => new Date("2026-07-08T00:00:00.000Z"),
  });
  service.saveSettings({
    enabled: true,
    workspaceKind: "remote_managed_workspace",
    workspaceId: "rmw_rotation",
    nodeName: "runner-node",
    centralUrl: "http://127.0.0.1:9999",
    projectRoot,
    allowedRoot: root,
    enrollmentTokenRef: "env:STALE_RMW_TOKEN",
  });
  const calls = [];
  let freshRequestApproved = false;
  const nodeClient = Object.assign(fakeNodeClient([], calls), {
    register: async (config) => {
      calls.push(["register", config.workspaceId, config.enrollmentToken]);
      if (config.enrollmentToken === "stale-env-credential") {
        const err = new Error("remote_managed_workspace_scoped_node_credential_invalid");
        err.code = "remote_managed_workspace_scoped_node_credential_invalid";
        err.statusCode = 401;
        throw err;
      }
      assert.equal(config.enrollmentToken, "fresh-write-only-credential");
      return { result: { ok: true } };
    },
    requestPairing: async () => {
      calls.push(["requestPairing"]);
      return { result: { pairing: { requestId: "rmw_pair_rotation", status: "pending_approval" } } };
    },
    pollPairingStatus: async (_config, requestId) => {
      calls.push(["pollPairingStatus", requestId]);
      return {
        result: {
          pairing: freshRequestApproved
            ? { requestId, status: "approved", scopedCredential: "fresh-write-only-credential" }
            : { requestId, status: "pending_approval" },
        },
      };
    },
    nodeHeartbeat: async (config) => {
      calls.push(["nodeHeartbeat", config.enrollmentToken]);
      assert.equal(config.enrollmentToken, "fresh-write-only-credential");
      return { ok: true };
    },
    pollTaskCards: async (config) => {
      calls.push(["pollTaskCards", config.enrollmentToken]);
      assert.equal(config.enrollmentToken, "fresh-write-only-credential");
      return { ok: true, cards: [], count: 0 };
    },
  });
  try {
    const runner = createRemoteManagedWorkspaceNodeRunnerService({
      settingsService: service,
      nodeClientService: nodeClient,
      now: () => new Date("2026-07-08T00:00:00.000Z"),
    });

    const failed = await runner.runOnce({ force: true, suppressErrors: true });
    assert.equal(failed.ok, false);
    assert.equal(failed.status.scopedCredentialConfigured, false);
    assert.equal(failed.status.issueCodes.includes("remote_managed_workspace_scoped_node_credential_invalid"), true);
    assert.equal(fs.existsSync(credentialFile), false);
    assert.deepEqual(calls.map((entry) => entry[0]), ["register"]);

    const pending = await runner.runOnce({ force: true });
    assert.equal(pending.skipped, "pending_approval");
    assert.equal(pending.status.scopedCredentialConfigured, false);
    assert.equal(calls.filter((entry) => entry[0] === "requestPairing").length, 1);
    assert.equal(calls.filter((entry) => entry[0] === "register" && entry[2] === "stale-env-credential").length, 1);

    freshRequestApproved = true;
    const connected = await runner.runOnce({ force: true });
    assert.equal(connected.ok, true);
    assert.equal(connected.status.connectionStatus, "connected");
    assert.equal(connected.status.pairingStatus, "connected");
    assert.equal(connected.status.scopedCredentialConfigured, true);
    assert.equal(connected.status.issueCodes.length, 0);
    assert.equal(fs.readFileSync(credentialFile, "utf8").trim(), "fresh-write-only-credential");
    assert.equal(calls.some((entry) => entry[0] === "register" && entry[2] === "fresh-write-only-credential"), true);
    assert.equal(calls.some((entry) => entry[0] === "nodeHeartbeat" && entry[1] === "fresh-write-only-credential"), true);
    assert.equal(calls.some((entry) => entry[0] === "pollTaskCards" && entry[1] === "fresh-write-only-credential"), true);

    const restartedRunner = createRemoteManagedWorkspaceNodeRunnerService({
      settingsService: createRemoteManagedWorkspaceSettingsService({
        fs,
        path,
        settingsFile: path.join(root, "settings.json"),
        stateFile: path.join(root, "state.json"),
        enrollmentTokenFile: credentialFile,
        env: { STALE_RMW_TOKEN: "stale-env-credential" },
        now: () => new Date("2026-07-08T00:00:00.000Z"),
      }),
      nodeClientService: nodeClient,
      now: () => new Date("2026-07-08T00:00:00.000Z"),
    });
    const restarted = await restartedRunner.runOnce({ force: true });
    assert.equal(restarted.ok, true);
    assert.equal(calls.filter((entry) => entry[0] === "register" && entry[2] === "stale-env-credential").length, 1);
    assert.equal(calls.filter((entry) => entry[0] === "register" && entry[2] === "fresh-write-only-credential").length >= 2, true);
    assert.doesNotMatch(JSON.stringify(restarted.status), /stale-env-credential|fresh-write-only-credential/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote node runner ignores stale in-flight invalid credential after a newer credential is stored", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-runner-stale-inflight-"));
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  const credentialFile = path.join(root, "secret", "scoped-credential");
  const service = createRemoteManagedWorkspaceSettingsService({
    fs,
    path,
    settingsFile: path.join(root, "settings.json"),
    stateFile: path.join(root, "state.json"),
    enrollmentTokenFile: credentialFile,
    now: () => new Date("2026-07-08T00:00:00.000Z"),
  });
  service.enableWorkspace({
    centralUrl: "http://127.0.0.1:9999",
    workspace: { cwd: projectRoot, label: "Stale Inflight Project" },
  });
  service.applyPairingResult({
    pairing: {
      requestId: "rmw_pair_stale_inflight",
      status: "approved",
      scopedCredential: "stale-inflight-credential",
    },
  });
  const calls = [];
  const nodeClient = Object.assign(fakeNodeClient([], calls), {
    register: async (config) => {
      calls.push(["register", config.workspaceId, config.enrollmentToken]);
      assert.equal(config.enrollmentToken, "stale-inflight-credential");
      service.applyPairingResult({
        pairing: {
          requestId: "rmw_pair_stale_inflight_rekey",
          status: "approved",
          scopedCredential: "fresh-inflight-credential",
        },
      });
      const err = new Error("remote_managed_workspace_scoped_node_credential_invalid");
      err.code = "remote_managed_workspace_scoped_node_credential_invalid";
      err.statusCode = 401;
      throw err;
    },
  });
  try {
    const runner = createRemoteManagedWorkspaceNodeRunnerService({
      settingsService: service,
      nodeClientService: nodeClient,
      now: () => new Date("2026-07-08T00:00:00.000Z"),
    });

    const result = await runner.runOnce({ force: true, suppressErrors: true });
    assert.equal(result.ok, false);
    assert.equal(result.error, "stale_scoped_credential_failure_ignored");
    assert.equal(result.status.scopedCredentialConfigured, true);
    assert.equal(result.status.connectionStatus !== "auth_failed", true);
    assert.equal(result.status.issueCodes.includes("remote_managed_workspace_scoped_node_credential_invalid"), false);
    assert.equal(fs.readFileSync(credentialFile, "utf8").trim(), "fresh-inflight-credential");
    assert.doesNotMatch(JSON.stringify(result.status), /stale-inflight-credential|fresh-inflight-credential/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote node runner keeps scoped credential for ordinary offline trusted route errors", async () => {
  const { root, service } = makeSettings();
  const calls = [];
  const nodeClient = Object.assign(fakeNodeClient([], calls), {
    register: async (config) => {
      calls.push(["register", config.workspaceId, config.enrollmentToken]);
      const err = new Error("fetch failed");
      err.code = "ECONNRESET";
      throw err;
    },
  });
  try {
    const runner = createRemoteManagedWorkspaceNodeRunnerService({
      settingsService: service,
      nodeClientService: nodeClient,
      now: () => new Date("2026-07-08T00:00:00.000Z"),
    });
    const failed = await runner.runOnce({ force: true, suppressErrors: true });

    assert.equal(failed.ok, false);
    assert.equal(failed.status.connectionStatus, "offline");
    assert.equal(failed.status.scopedCredentialConfigured, true);
    assert.equal(service.readEnrollmentToken(), "runner-token");
    assert.equal(calls.some((entry) => entry[0] === "register" && entry[2] === "runner-token"), true);
    assert.doesNotMatch(JSON.stringify(failed.status), /runner-token/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote node runner stops trusted polling while pairing is rejected", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-runner-rejected-"));
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  const service = createRemoteManagedWorkspaceSettingsService({
    fs,
    path,
    settingsFile: path.join(root, "settings.json"),
    stateFile: path.join(root, "state.json"),
    enrollmentTokenFile: path.join(root, "secret", "scoped-credential"),
    now: () => new Date("2026-07-08T00:00:00.000Z"),
  });
  service.enableWorkspace({
    centralUrl: "http://127.0.0.1:9999",
    workspace: { cwd: projectRoot, label: "Rejected Project" },
  });
  service.applyPairingResult({
    pairing: {
      requestId: "rmw_pair_rejected",
      status: "rejected",
      reason: "owner_rejected",
    },
  });
  const calls = [];
  try {
    const runner = createRemoteManagedWorkspaceNodeRunnerService({
      settingsService: service,
      nodeClientService: Object.assign(fakeNodeClient([], calls), {
        requestPairing: async () => {
          calls.push(["requestPairing"]);
          return { result: { pairing: { requestId: "rmw_pair_retry", status: "pending_approval" } } };
        },
        pollPairingStatus: async () => {
          calls.push(["pollPairingStatus"]);
          return { result: { pairing: { requestId: "rmw_pair_rejected", status: "rejected", reason: "owner_rejected" } } };
        },
      }),
      now: () => new Date("2026-07-08T00:00:00.000Z"),
    });

    const result = await runner.runOnce({ force: true });
    assert.equal(result.skipped, "pairing_rejected");
    assert.equal(result.status.pairingStatus, "rejected");
    assert.equal(calls.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote node runner does not trust approved pairing without scoped credential", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-runner-approved-missing-credential-"));
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  const service = createRemoteManagedWorkspaceSettingsService({
    fs,
    path,
    settingsFile: path.join(root, "settings.json"),
    stateFile: path.join(root, "state.json"),
    enrollmentTokenFile: path.join(root, "secret", "scoped-credential"),
    now: () => new Date("2026-07-08T00:00:00.000Z"),
  });
  service.enableWorkspace({
    centralUrl: "http://127.0.0.1:9999",
    workspace: { cwd: projectRoot, label: "Approved Missing Credential" },
  });
  const calls = [];
  try {
    const runner = createRemoteManagedWorkspaceNodeRunnerService({
      settingsService: service,
      nodeClientService: Object.assign(fakeNodeClient([], calls), {
        requestPairing: async () => {
          calls.push(["requestPairing"]);
          return { result: { pairing: { requestId: "rmw_pair_missing_credential", status: "approved" } } };
        },
        pollPairingStatus: async () => {
          calls.push(["pollPairingStatus"]);
          return { result: { pairing: { requestId: "rmw_pair_missing_credential", status: "approved" } } };
        },
      }),
      now: () => new Date("2026-07-08T00:00:00.000Z"),
    });

    const result = await runner.runOnce({ force: true });
    assert.equal(result.skipped, "approval_missing_scoped_credential");
    assert.equal(result.status.pairingStatus, "auth_failed");
    assert.equal(result.status.scopedCredentialConfigured, false);
    assert.equal(calls.some((entry) => entry[0] === "register"), false);
    assert.equal(calls.some((entry) => entry[0] === "pollTaskCards"), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote node runner suppresses duplicate idempotency and queues offline returns for retry", async () => {
  const { root, service } = makeSettings();
  const duplicateCalls = [];
  const duplicateCards = [{ taskCardId: "ttc_runner_dup", idempotencyKey: "idem-dup", title: "Duplicate task" }];
  try {
    const runner = createRemoteManagedWorkspaceNodeRunnerService({
      settingsService: service,
      nodeClientService: fakeNodeClient(duplicateCards, duplicateCalls),
      taskCardExecutor: async () => ({ status: "completed", title: "done", summary: "done" }),
      now: () => new Date("2026-07-08T00:00:00.000Z"),
    });
    await runner.runOnce({ force: true });
    duplicateCards.push({ taskCardId: "ttc_runner_dup_2", idempotencyKey: "idem-dup", title: "Duplicate task 2" });
    const duplicate = await runner.runOnce({ force: true });
    assert.equal(duplicate.processed.duplicateSuppressed, true);

    const offlineCalls = [];
    const offlineCards = [{ taskCardId: "ttc_runner_offline", idempotencyKey: "idem-offline", title: "Offline task" }];
    const offlineRunner = createRemoteManagedWorkspaceNodeRunnerService({
      settingsService: service,
      nodeClientService: fakeNodeClient(offlineCards, offlineCalls, { failReturnOnce: true }),
      taskCardExecutor: async () => ({ status: "completed", title: "done", summary: "done" }),
      now: () => new Date("2026-07-08T00:00:00.000Z"),
    });
    const failed = await offlineRunner.runOnce({ force: true, suppressErrors: true });
    assert.equal(failed.ok, false);
    assert.equal(failed.status.connectionStatus, "offline");
    assert.equal(failed.status.queuedTerminalReturnCount, 1);
    const retried = await offlineRunner.runOnce({ force: true, suppressErrors: true });
    assert.equal(retried.ok, true);
    assert.equal(retried.status.queuedTerminalReturnCount, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
