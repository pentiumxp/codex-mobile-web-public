"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadDetailActiveWindowPrewarmService,
  overlayActiveTurnId,
} = require("../adapters/thread-detail-active-window-prewarm-service");

function createHarness(overrides = {}) {
  const calls = [];
  let nowMs = 1_000;
  const summary = overrides.summary || {
    id: "thread-1",
    status: { type: "active" },
    activeTurnId: "turn-active",
  };
  const service = createThreadDetailActiveWindowPrewarmService(Object.assign({
    now: () => {
      nowMs += 5;
      return nowMs;
    },
    setTimeout: (fn) => {
      calls.push("timer");
      fn();
      return { unref() {} };
    },
    delayMs: 0,
    minIntervalMs: 0,
    resolveSummary: async () => {
      calls.push("summary");
      return { summary, source: "state-db" };
    },
    threadRuntimeSettings: () => {
      calls.push("runtime");
      return { model: "gpt-5" };
    },
    projectionInput: () => {
      calls.push("projection-input");
      return { threadId: "thread-1", rolloutPath: "/tmp/rollout.jsonl" };
    },
    activeOverlayProjectionWindowLookup: (input, currentSummary, runtimeSettings, options = {}) => {
      calls.push(`lookup:${options.omitActiveTurnId || ""}`);
      return { result: overrides.lookupHit ? { thread: { id: "thread-1", turns: [{ id: "turn-window" }] } } : null };
    },
    resolveActiveWindowOverlay: () => {
      calls.push("overlay");
      return {
        activeTurnId: "turn-active",
        overlayTurn: { id: "turn-active", items: [{ id: "agent-1", type: "agentMessage", text: "partial" }] },
        overlaySource: "projection-live",
        overlayRevision: 3,
        overlayTimestampMs: 10_000,
      };
    },
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      return {
        thread: {
          id: "thread-1",
          turns: [{ id: "turn-window" }, { id: "turn-active" }],
          mobileReadMode: mode,
        },
      };
    },
    seedProjection: (input, result, options = {}) => {
      calls.push(`seed:${options.partialKind || ""}`);
      return { partial: options.partial === true, partialKind: options.partialKind };
    },
    log: (event) => calls.push(`log:${event}`),
  }, overrides.service || {}));
  return { calls, service, summary };
}

test("overlayActiveTurnId prefers explicit overlay id then turn id then summary", () => {
  assert.equal(overlayActiveTurnId({ activeTurnId: "a", overlayTurn: { id: "b" } }, { activeTurnId: "c" }), "a");
  assert.equal(overlayActiveTurnId({ overlayTurn: { id: "b" } }, { activeTurnId: "c" }), "b");
  assert.equal(overlayActiveTurnId({}, { activeTurnId: "c" }), "c");
});

test("prewarmNow seeds a missing active overlay window", async () => {
  const { calls, service } = createHarness();

  const result = await service.prewarmNow({ threadId: "thread-1" });

  assert.equal(result.status, "seeded");
  assert.equal(result.reason, "turns-list-active-overlay-window");
  assert.deepEqual(calls.filter((call) => /^turns-list:/.test(call)), [
    "turns-list:turns-list-active-overlay-window",
  ]);
  assert.deepEqual(calls.filter((call) => /^seed:/.test(call)), [
    "seed:turns-list-active-overlay-window",
  ]);
});

test("prewarmNow skips app-server read when active overlay window is already cached", async () => {
  const { calls, service } = createHarness({ lookupHit: true });

  const result = await service.prewarmNow({ threadId: "thread-1" });

  assert.equal(result.status, "hit");
  assert.equal(result.reason, "active-window-already-cached");
  assert.equal(calls.some((call) => /^turns-list:/.test(call)), false);
  assert.equal(calls.some((call) => /^seed:/.test(call)), false);
});

test("prewarmNow can seed the projection window before overlay turn evidence exists", async () => {
  const { calls, service } = createHarness({
    service: {
      resolveActiveWindowOverlay: () => {
        calls.push("overlay-miss");
        return { reason: "entry-missing" };
      },
    },
  });

  const result = await service.prewarmNow({ threadId: "thread-1" });

  assert.equal(result.status, "seeded");
  assert.equal(result.reason, "turns-list-active-overlay-window-preseed");
  assert.deepEqual(calls.filter((call) => /^turns-list:/.test(call)), [
    "turns-list:turns-list-active-overlay-window",
  ]);
  assert.deepEqual(calls.filter((call) => /^seed:/.test(call)), [
    "seed:turns-list-active-overlay-window",
  ]);
});

test("prewarmNow skips non-active summaries", async () => {
  const { calls, service } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "idle" },
    },
  });

  const result = await service.prewarmNow({ threadId: "thread-1" });

  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "not-active");
  assert.equal(calls.includes("projection-input"), false);
});

test("schedule deduplicates pending work", () => {
  const calls = [];
  const service = createThreadDetailActiveWindowPrewarmService({
    now: () => 1000,
    delayMs: 5000,
    minIntervalMs: 0,
    setTimeout: () => {
      calls.push("timer");
      return { unref() {} };
    },
  });

  assert.deepEqual(service.schedule({ threadId: "thread-1", reason: "turn-started" }), {
    scheduled: true,
    reason: "scheduled",
  });
  assert.deepEqual(service.schedule({ threadId: "thread-1", reason: "thread-list-active" }), {
    scheduled: false,
    reason: "already-pending",
  });
  assert.equal(calls.length, 1);
});

test("schedule lets notification prewarm preempt older pending work", () => {
  const timers = [];
  const service = createThreadDetailActiveWindowPrewarmService({
    now: () => 1000,
    delayMs: 5000,
    minIntervalMs: 0,
    setTimeout: (fn, delayMs) => {
      timers.push({ fn, delayMs });
      return { unref() {} };
    },
  });

  assert.deepEqual(service.schedule({ threadId: "thread-1", reason: "thread-list-active" }), {
    scheduled: true,
    reason: "scheduled",
  });
  assert.deepEqual(service.schedule({
    threadId: "thread-1",
    reason: "turn/completed",
    delayMs: 0,
    bypassMinInterval: true,
    preemptPending: true,
  }), {
    scheduled: true,
    reason: "scheduled",
  });
  assert.deepEqual(timers.map((timer) => timer.delayMs), [5000, 0]);
});

test("older preempted prewarm completion does not clear newer pending state", async () => {
  const timers = [];
  const service = createThreadDetailActiveWindowPrewarmService({
    now: () => 1000,
    delayMs: 5000,
    minIntervalMs: 0,
    setTimeout: (fn, delayMs) => {
      timers.push({ fn, delayMs });
      return { unref() {} };
    },
    resolveSummary: async () => ({ summary: { id: "thread-1", status: { type: "idle" } } }),
  });

  service.schedule({ threadId: "thread-1", reason: "thread-list-active" });
  service.schedule({
    threadId: "thread-1",
    reason: "turn/completed",
    delayMs: 0,
    bypassMinInterval: true,
    preemptPending: true,
  });

  timers[0].fn();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(service.status("thread-1").pending, true);

  timers[1].fn();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(service.status("thread-1").pending, false);
});

test("schedule keeps default delay and recently-attempted throttle for ordinary work", async () => {
  const timers = [];
  let nowMs = 1_000;
  const service = createThreadDetailActiveWindowPrewarmService({
    now: () => nowMs,
    delayMs: 25,
    minIntervalMs: 1_000,
    setTimeout: (fn, delayMs) => {
      timers.push(delayMs);
      fn();
      return { unref() {} };
    },
    resolveSummary: async () => ({ summary: { id: "thread-1", status: { type: "idle" } } }),
  });

  assert.deepEqual(service.schedule({ threadId: "thread-1", reason: "thread-list-active" }), {
    scheduled: true,
    reason: "scheduled",
  });
  assert.deepEqual(timers, [25]);
  await Promise.resolve();
  await Promise.resolve();
  nowMs += 50;
  assert.deepEqual(service.schedule({ threadId: "thread-1", reason: "thread-list-active" }), {
    scheduled: false,
    reason: "recently-attempted",
  });
});

test("schedule can fast-start notification prewarm despite recent ordinary attempt", async () => {
  const timers = [];
  let nowMs = 1_000;
  const service = createThreadDetailActiveWindowPrewarmService({
    now: () => nowMs,
    delayMs: 25,
    minIntervalMs: 1_000,
    setTimeout: (fn, delayMs) => {
      timers.push(delayMs);
      fn();
      return { unref() {} };
    },
    resolveSummary: async () => ({ summary: { id: "thread-1", status: { type: "idle" } } }),
  });

  assert.deepEqual(service.schedule({ threadId: "thread-1", reason: "thread-list-active" }), {
    scheduled: true,
    reason: "scheduled",
  });
  await Promise.resolve();
  await Promise.resolve();
  nowMs += 50;
  assert.deepEqual(service.schedule({
    threadId: "thread-1",
    reason: "turn/started",
    delayMs: 0,
    bypassMinInterval: true,
  }), {
    scheduled: true,
    reason: "scheduled",
  });
  assert.deepEqual(timers, [25, 0]);
});
