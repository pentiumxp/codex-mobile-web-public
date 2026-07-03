"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createLoopTaskRuntimeService,
} = require("../services/at-loop/loop-task-runtime-service");

function tempStateFile(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "codex-at-loop-")), `${name}.json`);
}

function makeRuntime(options = {}) {
  const cards = [];
  let now = options.now || Date.parse("2026-07-03T00:00:00.000Z");
  const visibleThreads = options.visibleThreads || [
    {
      id: "source-thread",
      title: "codex mobile 06-30",
      cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web",
    },
    {
      id: "audit-thread",
      title: "Plugin Workspace Audit",
      cwd: "/Users/hermes-dev/HermesMobileDev/app",
    },
    {
      id: "deploy-thread",
      title: "Home AI Deploy",
      cwd: "/Users/hermes-dev/HermesMobileDev/app",
    },
  ];
  const runtime = createLoopTaskRuntimeService({
    storageFile: tempStateFile(options.name || "state"),
    visibleThreads,
    clock: () => now,
    watchdogStaleMs: 1000,
    createThreadTaskCardsFromSourceThread: async (sourceThreadId, payload) => {
      cards.push({ sourceThreadId, payload });
      return { ok: true, cards: [{ id: `ttc_${cards.length}` }] };
    },
  });
  return {
    cards,
    runtime,
    setNow: (value) => {
      now = value;
    },
  };
}

test("loop runtime starts with stable loop id and suppresses duplicate dispatch", async () => {
  const { cards, runtime } = makeRuntime();
  const first = await runtime.startLoop({
    sourceThreadId: "source-thread",
    text: "@loop fix password=SECRET_VALUE token=abc123456789",
  });
  assert.equal(first.ok, true);
  assert.equal(first.duplicateSuppressed, false);
  assert.equal(first.loop.status, "running");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].payload.cardKind, "at_loop_role_slice");
  assert.match(cards[0].payload.idempotencyKey, /^at-loop:loop_[0-9a-f]{16}:requirements:1:v1$/);
  assert.doesNotMatch(JSON.stringify(first), /SECRET_VALUE|abc123456789/);
  assert.doesNotMatch(cards[0].payload.bodyMarkdown, /SECRET_VALUE|abc123456789/);

  const second = await runtime.startLoop({
    sourceThreadId: "source-thread",
    text: "@loop fix password=SECRET_VALUE token=abc123456789",
  });
  assert.equal(second.ok, true);
  assert.equal(second.duplicateSuppressed, true);
  assert.equal(second.loop.loopId, first.loop.loopId);
  assert.equal(second.loop.duplicateSuppressedCount, 1);
  assert.equal(cards.length, 1);
});

test("loop runtime fails closed when source thread is a Public PR lane", async () => {
  const { cards, runtime } = makeRuntime({
    visibleThreads: [
      {
        id: "public-pr-thread",
        title: "Codex Mobile Public PR",
        cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web",
      },
    ],
  });
  const result = await runtime.startLoop({
    sourceThreadId: "public-pr-thread",
    text: "@loop implement runtime",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "at_loop_target_purpose_mismatch");
  assert.equal(result.loop.status, "blocked");
  assert.equal(result.loop.blockedReason, "at_loop_target_purpose_mismatch");
  assert.equal(cards.length, 0);
});

test("loop runtime correlates terminal returns and routes audit failure to repair", async () => {
  const { cards, runtime } = makeRuntime({ name: "terminal-routing" });
  const started = await runtime.startLoop({
    sourceThreadId: "source-thread",
    text: "@loop add status surface",
  });
  assert.equal(started.loop.currentRole, "requirements");
  assert.equal(cards.length, 1);

  const requirements = await runtime.recordTerminalReturn({
    roleSliceId: started.loop.roleSlices[0].roleSliceId,
    status: "completed",
    summary: "requirements done",
  });
  assert.equal(requirements.ok, true);
  assert.equal(requirements.loop.currentRole, "implementation");
  assert.equal(cards.length, 2);

  const implementation = await runtime.recordTerminalReturn({
    taskCardId: "ttc_2",
    status: "completed",
    summary: "implementation done",
  });
  assert.equal(implementation.ok, true);
  assert.equal(implementation.loop.currentRole, "product_audit");
  assert.equal(cards.length, 3);
  assert.equal(cards[2].payload.targetThreadId, "audit-thread");

  const audit = await runtime.recordTerminalReturn({
    taskCardId: "ttc_3",
    status: "completed",
    auditVerdict: "failed_implementation_bug",
    summary: "bug remains",
  });
  assert.equal(audit.ok, true);
  assert.equal(audit.loop.currentRole, "repair");
  assert.equal(audit.loop.lastAuditVerdict, "failed_implementation_bug");
  assert.equal(audit.loop.nextRoute, "repair");
  assert.equal(cards.length, 4);
});

test("loop runtime fails closed when required product-audit lane is missing", async () => {
  const { cards, runtime } = makeRuntime({
    name: "missing-audit",
    visibleThreads: [{
      id: "source-thread",
      title: "codex mobile 06-30",
      cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web",
    }],
  });
  await runtime.startLoop({ sourceThreadId: "source-thread", text: "@loop implement work" });
  await runtime.recordTerminalReturn({ taskCardId: "ttc_1", status: "completed" });
  const result = await runtime.recordTerminalReturn({ taskCardId: "ttc_2", status: "completed" });
  assert.equal(result.ok, false);
  assert.equal(result.error, "at_loop_missing_role_lane");
  assert.equal(result.loop.status, "blocked");
  assert.equal(result.loop.blockedReason, "at_loop_missing_role_lane");
  assert.equal(cards.length, 2);
});

test("loop watchdog marks stale returns without retrying or completing work", async () => {
  const initial = Date.parse("2026-07-03T01:00:00.000Z");
  const { cards, runtime, setNow } = makeRuntime({ name: "watchdog", now: initial });
  const started = await runtime.startLoop({ sourceThreadId: "source-thread", text: "@loop wait for card" });
  assert.equal(started.loop.currentRole, "requirements");
  setNow(initial + 2000);
  const watchdog = runtime.runWatchdog({ loopId: started.loop.loopId });
  assert.equal(watchdog.ok, true);
  assert.equal(watchdog.staleCount, 1);
  assert.equal(watchdog.retried, false);
  assert.equal(watchdog.completed, false);
  assert.equal(watchdog.rejected, false);
  assert.equal(cards.length, 1);
  const status = runtime.status({ loopId: started.loop.loopId });
  assert.equal(status.loops[0].roleSlices[0].stale, true);
  assert.equal(status.loops[0].roleSlices[0].dispatchStatus, "return_stale");
});
