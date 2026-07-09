"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  runRemoteManagedWorkspaceHarness,
} = require("../scripts/codex-mobile-remote-managed-workspace-harness");

test("remote managed workspace two-port harness completes relay lifecycle once", async () => {
  const result = await runRemoteManagedWorkspaceHarness();

  assert.equal(result.ok, true);
  assert.equal(result.centralSimulatorOwner, "home_ai");
  assert.equal(result.centralSimulatorMode, "codex_mobile_local_home_ai_central_simulator");
  assert.notEqual(result.centralPort, 8787);
  assert.notEqual(result.remoteProjectPort, 8787);
  assert.equal(result.settingsPersisted, true);
  assert.equal(result.settingsCredentialMasked, true);
  assert.equal(result.connectionCheckOk, true);
  assert.equal(result.pairingRequested, true);
  assert.equal(result.pairingApproved, true);
  assert.equal(result.registered, true);
  assert.equal(result.createdDuplicateSuppressed, true);
  assert.equal(result.createdTaskCardId, "ttc_remote_fixture");
  assert.equal(result.runnerConnectionStatus, "connected");
  assert.equal(result.processedExecuted, true);
  assert.equal(result.pollCountAfterReturn, 0);
  assert.equal(result.dailySummaryCount, 1);
  assert.equal(result.escalationCount, 1);
  assert.equal(result.terminalStatus, "completed");
  assert.equal(result.terminalBridge, "codex_mobile_local_runtime");
  assert.equal(result.localCodexThreadStarted, true);
  assert.equal(result.localCodexTurnStarted, true);
  assert.equal(result.localExecutionThreadId, "rmw-local-thread");
  assert.equal(result.localExecutionTurnId, "rmw-local-turn");
  assert.equal(result.privacyCheck, "passed");
});
