"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadDetailFirstPaintPrewarmService,
  summaryLooksActive,
  summaryRolloutSizeBytes,
  threadDetailFirstPaintPrewarmJobPolicy,
} = require("../services/thread-detail/thread-detail-first-paint-prewarm-service");

const EXPECTED_PREWARM_JOB = {
  name: "thread-detail-first-paint-prewarm",
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
    activeTurnId: "active-turn",
    rolloutSizeBytes: 64 * 1024 * 1024,
  };
  const service = createThreadDetailFirstPaintPrewarmService(Object.assign({
    now: () => {
      nowMs += 10;
      return nowMs;
    },
    setTimeout: (fn, delayMs) => {
      calls.push(`timer:${delayMs}`);
      fn();
      return { unref() {} };
    },
    delayMs: 0,
    minIntervalMs: 0,
    minRolloutBytes: 8 * 1024 * 1024,
    readThreadDetail: async ({ threadId, responseBudgetEvidence }) => {
      calls.push(`detail:${threadId}:${responseBudgetEvidence}`);
      return {
        status: 200,
        mode: "projection-active-overlay",
        body: {
          thread: {
            id: threadId,
            mobileReadMode: "projection-active-overlay",
            mobileDiagnostics: {
              threadDetailTimings: {
                totalMs: 42,
                prepareResponseMs: 17,
                prepareResponseBudgetMs: 3,
              },
            },
          },
        },
      };
    },
    log: (event) => calls.push(`log:${event}`),
  }, overrides.service || {}));
  return { calls, service, summary };
}

test("first-paint prewarm declares scheduler budget policy", () => {
  assert.deepEqual(threadDetailFirstPaintPrewarmJobPolicy(), EXPECTED_PREWARM_JOB);
});

test("summary helpers detect active state and bounded rollout size", () => {
  assert.equal(summaryLooksActive({ status: { type: "active" } }), true);
  assert.equal(summaryLooksActive({ mobileLocalActiveStatus: { turnId: "turn-1" } }), true);
  assert.equal(summaryLooksActive({ status: { type: "idle" } }), false);
  assert.equal(summaryLooksActive(null, true), true);
  assert.equal(summaryRolloutSizeBytes({ rolloutSizeBytes: "1234" }), 1234);
});

test("prewarmNow warms active large-thread first paint through detail orchestration", async () => {
  const { calls, service, summary } = createHarness();

  const result = await service.prewarmNow({ threadId: "thread-1", summary });

  assert.equal(result.status, "warmed");
  assert.equal(result.reason, "first-paint-detail");
  assert.equal(result.mode, "projection-active-overlay");
  assert.equal(result.totalMs, 42);
  assert.equal(result.prepareResponseMs, 17);
  assert.deepEqual(calls.filter((call) => call.startsWith("detail:")), [
    "detail:thread-1:compact",
  ]);
});

test("prewarmNow skips idle and small summaries before detail reads", async () => {
  const idle = createHarness({
    summary: { id: "thread-1", status: { type: "idle" }, rolloutSizeBytes: 64 * 1024 * 1024 },
  });
  assert.equal((await idle.service.prewarmNow({ threadId: "thread-1", summary: idle.summary })).reason, "not-active");
  assert.equal(idle.calls.some((call) => call.startsWith("detail:")), false);

  const small = createHarness({
    summary: { id: "thread-1", status: { type: "active" }, activeTurnId: "turn-1", rolloutSizeBytes: 1024 },
  });
  assert.equal((await small.service.prewarmNow({ threadId: "thread-1", summary: small.summary })).reason, "below-rollout-threshold");
  assert.equal(small.calls.some((call) => call.startsWith("detail:")), false);
});

test("schedule deduplicates and reuses fresh first-paint warm results", async () => {
  const { calls, service, summary } = createHarness({
    service: {
      minIntervalMs: 0,
      readyResultTtlMs: 10_000,
    },
  });

  assert.deepEqual(service.schedule({ threadId: "thread-1", summary }), withExpectedJob({
    scheduled: true,
    reason: "scheduled",
  }));
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(service.schedule({ threadId: "thread-1", summary }), withExpectedJob({
    scheduled: false,
    reason: "recently-ready",
  }));
  assert.deepEqual(calls.filter((call) => call.startsWith("timer:")), ["timer:0"]);
  assert.deepEqual(calls.filter((call) => call.startsWith("detail:")), ["detail:thread-1:compact"]);
});
