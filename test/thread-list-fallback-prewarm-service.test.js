"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadListFallbackPrewarmService,
  normalizePrewarmConfig,
  summarizePrewarmResult,
} = require("../adapters/thread-list-fallback-prewarm-service");

test("thread-list fallback prewarm normalizes bounded default config", () => {
  assert.deepEqual(normalizePrewarmConfig({}), {
    enabled: true,
    delayMs: 1500,
    retryDelayMs: 2500,
    maxDeferrals: 5,
    limit: 40,
  });
  assert.deepEqual(normalizePrewarmConfig({
    enabled: "off",
    delayMs: -1,
    limit: 999,
  }), {
    enabled: false,
    delayMs: 0,
    retryDelayMs: 2500,
    maxDeferrals: 5,
    limit: 200,
  });
});

test("thread-list fallback prewarm schedules once and warms the default cache", () => {
  let scheduledCallback = null;
  let scheduledDelay = null;
  let nowMs = 1000;
  const calls = [];
  const loggerMessages = [];
  const service = createThreadListFallbackPrewarmService({
    now: () => {
      nowMs += 10;
      return nowMs;
    },
    setTimer(callback, delayMs) {
      scheduledCallback = callback;
      scheduledDelay = delayMs;
      return { unref() {} };
    },
    readGlobalState() {
      return { roots: ["/workspace/default"] };
    },
    readFallback(limit, filters) {
      calls.push({
        limit,
        globalState: filters.globalState,
      });
      filters.diagnostics.cacheDecision = "miss-rebuild";
      filters.diagnostics.cacheHit = false;
      filters.diagnostics.sourceSnapshotHit = false;
      filters.diagnostics.sourceSnapshotBuildCount = 1;
      filters.diagnostics.sourceSnapshotRawCount = 3;
      filters.diagnostics.baselineSourceCount = 3;
      filters.diagnostics.baselineResultCount = 2;
      return [{ id: "private-id-1" }, { id: "private-id-2" }];
    },
    logger: {
      log(message, payload) {
        loggerMessages.push({ message, payload });
      },
    },
  });

  const firstPlan = service.schedule({ delayMs: 25, limit: 40 });
  assert.deepEqual(firstPlan, {
    scheduled: true,
    reason: "scheduled",
    delayMs: 25,
    limit: 40,
  });
  assert.equal(scheduledDelay, 25);
  assert.equal(service.schedule({ delayMs: 25, limit: 40 }).reason, "already-scheduled");

  scheduledCallback();
  assert.deepEqual(calls, [{
    limit: 40,
    globalState: { roots: ["/workspace/default"] },
  }]);
  assert.equal(service.status().completed, true);
  assert.equal(service.schedule({ delayMs: 25, limit: 40 }).reason, "already-completed");
  assert.deepEqual(service.status().lastResult, {
    status: "completed",
    limit: 40,
    elapsedMs: 10,
    resultCount: 2,
    cacheDecision: "miss-rebuild",
    cacheHit: false,
    sourceSnapshotHit: false,
    sourceSnapshotBuildCount: 1,
    sourceSnapshotRawCount: 3,
    baselineSourceCount: 3,
    baselineResultCount: 2,
    errorCode: "",
  });
  assert.equal(loggerMessages.length, 1);
  assert.doesNotMatch(JSON.stringify(loggerMessages), /private-id/);
});

test("thread-list fallback prewarm defers while active detail is in flight", () => {
  const callbacks = [];
  const calls = [];
  let activeDetail = true;
  const service = createThreadListFallbackPrewarmService({
    now: () => 100,
    setTimer(callback) {
      callbacks.push(callback);
      return { unref() {} };
    },
    shouldRun() {
      return activeDetail ? { run: false, reason: "active-detail-in-flight" } : { run: true };
    },
    readFallback(limit) {
      calls.push(limit);
      return [];
    },
    logger: false,
  });

  assert.equal(service.schedule({ delayMs: 10, retryDelayMs: 20, maxDeferrals: 2, limit: 40 }).scheduled, true);
  callbacks.shift()();
  assert.equal(service.status().deferralCount, 1);
  assert.equal(service.status().lastResult.status, "deferred");
  assert.equal(service.status().lastResult.errorCode, "active-detail-in-flight");
  assert.deepEqual(calls, []);

  activeDetail = false;
  callbacks.shift()();
  assert.deepEqual(calls, [40]);
  assert.equal(service.status().completed, true);
});

test("thread-list fallback prewarm disabled config does not schedule or read", () => {
  let called = false;
  const service = createThreadListFallbackPrewarmService({
    readFallback() {
      called = true;
      return [];
    },
  });

  assert.deepEqual(service.schedule({ enabled: false }), {
    scheduled: false,
    reason: "disabled",
    delayMs: 1500,
    limit: 40,
  });
  assert.equal(service.run({ enabled: false }).status, "disabled");
  assert.equal(called, false);
});

test("thread-list fallback prewarm failure stays bounded and does not throw", () => {
  const service = createThreadListFallbackPrewarmService({
    now: () => 100,
    readFallback() {
      const error = new Error("private path /Users/example/.codex/session.jsonl");
      error.code = "EPRIVATE";
      throw error;
    },
    logger: false,
  });

  const result = service.run({ limit: 20 });

  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "EPRIVATE");
  assert.doesNotMatch(JSON.stringify(result), /private path|session\.jsonl/);
});

test("thread-list fallback prewarm result summary is metadata-only", () => {
  const summary = summarizePrewarmResult({
    status: "completed",
    limit: 40,
    startedAtMs: 100,
    finishedAtMs: 150,
    threads: [{ id: "private-thread-id", title: "private title" }],
    diagnostics: {
      cacheDecision: "hit",
      cacheHit: true,
      sourceSnapshotHit: true,
      sourceSnapshotBuildCount: 2,
      sourceSnapshotRawCount: 10,
      baselineSourceCount: 10,
      baselineResultCount: 4,
    },
  });

  assert.deepEqual(summary, {
    status: "completed",
    limit: 40,
    elapsedMs: 50,
    resultCount: 1,
    cacheDecision: "hit",
    cacheHit: true,
    sourceSnapshotHit: true,
    sourceSnapshotBuildCount: 2,
    sourceSnapshotRawCount: 10,
    baselineSourceCount: 10,
    baselineResultCount: 4,
    errorCode: "",
  });
  assert.doesNotMatch(JSON.stringify(summary), /private-thread-id|private title/);
});
