"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadDetailActiveWindowPrewarmService,
  overlayActiveTurnId,
  threadDetailActiveWindowPrewarmJobPolicy,
} = require("../services/thread-detail/thread-detail-active-window-prewarm-service");

const EXPECTED_PREWARM_JOB = {
  name: "thread-detail-active-window-prewarm",
  periodicAllowed: false,
  maxConcurrency: 1,
  timeoutMs: 30000,
  timeBudgetMs: 30000,
  cpuBudgetClass: "medium",
  realBrowserAllowed: false,
  usesBrowser: false,
  userRequestPreemptible: true,
  preemptibleByForeground: true,
};

function withExpectedJob(value) {
  return Object.assign({}, value, {
    job: EXPECTED_PREWARM_JOB,
  });
}

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

test("active window prewarm declares scheduler budget policy", () => {
  assert.deepEqual(threadDetailActiveWindowPrewarmJobPolicy(), EXPECTED_PREWARM_JOB);
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

test("prewarmNow refreshes an incomplete active summary before projection lookup fails", async () => {
  const { calls, service } = createHarness({
    summary: {
      id: "thread-1",
      path: "/tmp/rollout.jsonl",
      status: { type: "active" },
      activeTurnId: "turn-active",
    },
    service: {
      projectionInput: (threadId, currentSummary) => {
        calls.push(`projection-input:${currentSummary && currentSummary.path ? "ready" : "missing-path"}`);
        if (!currentSummary || !currentSummary.path) return null;
        return { threadId, rolloutPath: currentSummary.path };
      },
    },
  });

  const result = await service.prewarmNow({
    threadId: "thread-1",
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "turn-active",
    },
  });

  assert.equal(result.status, "seeded");
  assert.deepEqual(calls.filter((call) => /^projection-input:/.test(call)), [
    "projection-input:missing-path",
    "projection-input:ready",
  ]);
  assert.equal(calls.includes("summary"), true);
  assert.deepEqual(calls.filter((call) => /^turns-list:/.test(call)), [
    "turns-list:turns-list-active-overlay-window",
  ]);
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

test("prewarmNow skips huge active rollout summaries before background app-server reads", async () => {
  const { calls, service } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "turn-active",
      rolloutSizeBytes: 586 * 1024 * 1024,
    },
  });

  const result = await service.prewarmNow({ threadId: "thread-1" });

  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "rollout-too-large");
  assert.equal(result.rolloutSizeBytes, 586 * 1024 * 1024);
  assert.equal(calls.includes("projection-input"), false);
  assert.equal(calls.some((call) => /^turns-list:/.test(call)), false);
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

  assert.deepEqual(service.schedule({ threadId: "thread-1", reason: "turn-started" }), withExpectedJob({
    scheduled: true,
    reason: "scheduled",
  }));
  assert.deepEqual(service.schedule({ threadId: "thread-1", reason: "thread-list-active" }), withExpectedJob({
    scheduled: false,
    reason: "already-pending",
  }));
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

  assert.deepEqual(service.schedule({ threadId: "thread-1", reason: "thread-list-active" }), withExpectedJob({
    scheduled: true,
    reason: "scheduled",
  }));
  assert.deepEqual(service.schedule({
    threadId: "thread-1",
    reason: "turn/completed",
    delayMs: 0,
    bypassMinInterval: true,
    preemptPending: true,
  }), withExpectedJob({
    scheduled: true,
    reason: "scheduled",
  }));
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

  assert.deepEqual(service.status("thread-1").job, EXPECTED_PREWARM_JOB);
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

  assert.deepEqual(service.schedule({ threadId: "thread-1", reason: "thread-list-active" }), withExpectedJob({
    scheduled: true,
    reason: "scheduled",
  }));
  assert.deepEqual(timers, [25]);
  await Promise.resolve();
  await Promise.resolve();
  nowMs += 50;
  assert.deepEqual(service.schedule({ threadId: "thread-1", reason: "thread-list-active" }), withExpectedJob({
    scheduled: false,
    reason: "recently-attempted",
  }));
});

test("schedule reuses fresh ready results for ordinary thread-list prewarm", async () => {
  const timers = [];
  let nowMs = 1_000;
  const service = createThreadDetailActiveWindowPrewarmService({
    now: () => nowMs,
    delayMs: 25,
    minIntervalMs: 0,
    readyResultTtlMs: 10_000,
    setTimeout: (fn, delayMs) => {
      timers.push(delayMs);
      fn();
      return { unref() {} };
    },
    resolveSummary: async () => ({
      summary: { id: "thread-1", status: { type: "active" }, activeTurnId: "turn-active" },
    }),
    threadRuntimeSettings: () => ({}),
    projectionInput: () => ({ threadId: "thread-1", rolloutPath: "/tmp/rollout.jsonl" }),
    activeOverlayProjectionWindowLookup: () => ({ result: { thread: { id: "thread-1", turns: [{ id: "turn-window" }] } } }),
    turnsListThreadReadResult: async () => {
      throw new Error("cached active window should skip app-server read");
    },
  });

  assert.deepEqual(service.schedule({ threadId: "thread-1", reason: "thread-list-active" }), withExpectedJob({
    scheduled: true,
    reason: "scheduled",
  }));
  await Promise.resolve();
  await Promise.resolve();
  nowMs += 1_000;
  assert.deepEqual(service.schedule({ threadId: "thread-1", reason: "thread-list-active" }), withExpectedJob({
    scheduled: false,
    reason: "recently-ready",
  }));
  assert.deepEqual(timers, [25]);
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

  assert.deepEqual(service.schedule({ threadId: "thread-1", reason: "thread-list-active" }), withExpectedJob({
    scheduled: true,
    reason: "scheduled",
  }));
  await Promise.resolve();
  await Promise.resolve();
  nowMs += 50;
  assert.deepEqual(service.schedule({
    threadId: "thread-1",
    reason: "turn/started",
    delayMs: 0,
    bypassMinInterval: true,
  }), withExpectedJob({
    scheduled: true,
    reason: "scheduled",
  }));
  assert.deepEqual(timers, [25, 0]);
});
