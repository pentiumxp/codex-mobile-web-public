"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createServerRestartDrainService,
} = require("../services/runtime/server-restart-drain-service");

test("server restart drain service reports ready when no listener drain is active", () => {
  const service = createServerRestartDrainService({ nowMs: () => 1_000 });

  assert.deepEqual(service.status({ activeTurnCount: 2 }), {
    ok: true,
    ready: true,
    draining: false,
    issueCodes: [],
    activeTurnCount: 2,
  });
});

test("server restart drain service exposes bounded 503 readiness metadata while draining", () => {
  let now = 10_000;
  const service = createServerRestartDrainService({
    nowMs: () => now,
    defaultDrainMs: 30_000,
  });

  const started = service.beginDrain({
    reason: "macos_plugin_deploy",
    source: "deploy_script",
    activeTurnCount: 3,
  });

  assert.equal(started.ready, false);
  assert.equal(started.draining, true);
  assert.equal(started.reason, "macos_plugin_deploy");
  assert.equal(started.source, "deploy_script");
  assert.equal(started.activeTurnCount, 3);
  assert.deepEqual(started.issueCodes, ["listener_restart_draining"]);
  assert.equal(started.retryAfterSeconds, 30);

  now = 42_001;
  assert.equal(service.status().ready, true);
  assert.equal(service.status().draining, false);
});

test("server restart drain service can clear drain state after handoff", () => {
  const service = createServerRestartDrainService({ nowMs: () => 5_000 });
  service.beginDrain({ reason: "restart", source: "test", activeTurnCount: 1 });

  const cleared = service.clearDrain();

  assert.equal(cleared.ready, true);
  assert.equal(cleared.draining, false);
  assert.deepEqual(cleared.issueCodes, []);
});
