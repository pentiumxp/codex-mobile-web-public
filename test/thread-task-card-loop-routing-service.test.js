"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  assertLoopRoleTarget,
  classifyThreadPurpose,
  createThreadTaskCardLoopRoutingService,
  publicRoutingMetadata,
} = require("../services/at-loop/thread-task-card-loop-routing-service");

test("loop routing classifies special-purpose threads", () => {
  assert.equal(classifyThreadPurpose({ title: "Codex Mobile Public PR" }).purpose, "public_pr");
  assert.equal(classifyThreadPurpose({ title: "Home AI Deploy" }).purpose, "deploy_lane");
  assert.equal(classifyThreadPurpose({ title: "Plugin Workspace Audit" }).purpose, "audit_lane");
  assert.equal(classifyThreadPurpose({ title: "Home AI Task Intake" }).purpose, "task_intake");
  assert.equal(classifyThreadPurpose({ title: "Worker Lane 2" }).purpose, "worker_lane");
  assert.equal(classifyThreadPurpose({
    title: "codex mobile 06-30",
    cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web",
  }).purpose, "codex_mobile_implementation");
});

test("loop routing rejects implementation cards to Public PR special-purpose thread", () => {
  const result = assertLoopRoleTarget({
    role: "implementation",
    thread: { id: "public-pr", title: "Codex Mobile Public PR", cwd: "/repo/plugins/codex-mobile-web" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "at_loop_target_purpose_mismatch");
  const metadata = publicRoutingMetadata(result);
  assert.deepEqual(metadata, {
    ok: false,
    error: "at_loop_target_purpose_mismatch",
    role: "implementation",
    targetPurpose: "public_pr",
    targetReason: "title-public-pr",
    targetThreadId: "public-pr",
    allowedPurposes: ["codex_mobile_implementation", "unknown", "worker_lane", "workspace_implementation"],
    specialPurpose: true,
  });
});

test("loop routing allows only matching role lanes for audit and deploy", () => {
  const service = createThreadTaskCardLoopRoutingService();
  assert.equal(service.assertLoopRoleTarget({
    role: "product_audit",
    thread: { id: "audit", title: "Plugin Workspace Audit" },
  }).ok, true);
  assert.equal(service.assertLoopRoleTarget({
    role: "deploy_readback",
    thread: { id: "deploy", title: "Home AI Deploy" },
  }).ok, true);
  assert.equal(service.assertLoopRoleTarget({
    role: "requirements",
    thread: { id: "deploy", title: "Home AI Deploy" },
  }).ok, false);
});
