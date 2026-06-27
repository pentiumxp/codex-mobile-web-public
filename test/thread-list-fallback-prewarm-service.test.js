"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadListFallbackPrewarmService,
  normalizePrewarmConfig,
  summarizePrewarmResult,
  summarizePrewarmStatus,
} = require("../adapters/thread-list-fallback-prewarm-service");

test("thread-list fallback prewarm normalizes bounded default config", () => {
  assert.deepEqual(normalizePrewarmConfig({}), {
    enabled: true,
    delayMs: 1500,
    retryDelayMs: 2500,
    maxDeferrals: 5,
    limit: 40,
    sourceSnapshotLimit: 1000,
  });
  assert.deepEqual(normalizePrewarmConfig({
    enabled: "off",
    delayMs: -1,
    limit: 999,
    sourceSnapshotLimit: 50,
  }), {
    enabled: false,
    delayMs: 0,
    retryDelayMs: 2500,
    maxDeferrals: 5,
    limit: 200,
    sourceSnapshotLimit: 200,
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
        sourceSnapshotLimit: filters.sourceSnapshotLimit,
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
    sourceSnapshotLimit: 1000,
  });
  assert.equal(scheduledDelay, 25);
  assert.equal(service.schedule({ delayMs: 25, limit: 40 }).reason, "already-scheduled");

  scheduledCallback();
  assert.deepEqual(calls, [{
    limit: 40,
    globalState: { roots: ["/workspace/default"] },
    sourceSnapshotLimit: 1000,
  }]);
  assert.equal(service.status().completed, true);
  assert.equal(service.schedule({ delayMs: 25, limit: 40 }).reason, "already-completed");
  assert.deepEqual(service.status().lastResult, {
    status: "completed",
    limit: 40,
    sourceSnapshotLimit: 1000,
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

test("thread-list fallback prewarm reports successful rows to an internal hook", () => {
  const hookCalls = [];
  const service = createThreadListFallbackPrewarmService({
    now: () => 100,
    readGlobalState() {
      return { roots: ["/workspace/default"] };
    },
    readFallback(limit, filters) {
      filters.diagnostics.cacheDecision = "miss-rebuild";
      return [{ id: "thread-active", status: { type: "active" } }];
    },
    onResult(payload) {
      hookCalls.push(payload);
    },
    logger: false,
  });

  const result = service.run({ limit: 40, sourceSnapshotLimit: 1000 });

  assert.equal(result.status, "completed");
  assert.equal(hookCalls.length, 1);
  assert.deepEqual(hookCalls[0].threads, [{ id: "thread-active", status: { type: "active" } }]);
  assert.deepEqual(hookCalls[0].globalState, { roots: ["/workspace/default"] });
  assert.equal(hookCalls[0].config.limit, 40);
  assert.equal(service.status().completed, true);
  assert.equal(service.status().lastResult.resultCount, 1);
  assert.equal(service.status().lastResult.cacheDecision, "miss-rebuild");
});

test("thread-list fallback prewarm hook failures are bounded and do not fail prewarm", () => {
  const loggerMessages = [];
  const service = createThreadListFallbackPrewarmService({
    now: () => 100,
    readFallback() {
      return [{ id: "private-thread-id", title: "private title" }];
    },
    onResult() {
      const err = new Error("private path /Users/example/session.jsonl");
      err.code = "EHOOK";
      throw err;
    },
    logger: {
      warn(message, payload) {
        loggerMessages.push({ message, payload });
      },
    },
  });

  const result = service.run({ limit: 40 });

  assert.equal(result.status, "completed");
  assert.equal(result.resultCount, 1);
  assert.equal(loggerMessages.length, 1);
  assert.equal(loggerMessages[0].payload.errorCode, "EHOOK");
  assert.doesNotMatch(JSON.stringify(loggerMessages), /private path|private-thread-id|private title/);
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
    sourceSnapshotLimit: 1000,
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
    sourceSnapshotLimit: 1000,
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
    sourceSnapshotLimit: 1000,
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

test("thread-list fallback prewarm public status is metadata-only", () => {
  const status = summarizePrewarmStatus({
    scheduled: false,
    running: false,
    completed: true,
    deferralCount: 2,
    lastResult: {
      status: "completed",
      limit: 40,
      elapsedMs: 123,
      resultCount: 4,
      cacheDecision: "miss-rebuild",
      cacheHit: false,
      sourceSnapshotHit: true,
      sourceSnapshotLimit: 1000,
      sourceSnapshotRawCount: 12,
      baselineSourceCount: 12,
      baselineResultCount: 4,
      privateThreadId: "should-not-leak",
    },
  }, {
    enabled: true,
    delayMs: 1500,
    retryDelayMs: 2500,
    maxDeferrals: 5,
    limit: 40,
    sourceSnapshotLimit: 1000,
  });

  assert.deepEqual(status, {
    enabled: true,
    scheduled: false,
    running: false,
    completed: true,
    deferralCount: 2,
    delayMs: 1500,
    retryDelayMs: 2500,
    maxDeferrals: 5,
    limit: 40,
    sourceSnapshotLimit: 1000,
    lastStatus: "completed",
    lastErrorCode: "",
    lastCacheDecision: "miss-rebuild",
    lastCacheHit: false,
    lastSourceSnapshotHit: true,
    lastSourceSnapshotLimit: 1000,
    lastResultCount: 4,
    lastElapsedMs: 123,
    lastSourceSnapshotBuildCount: 0,
    lastSourceSnapshotRawCount: 12,
    lastBaselineSourceCount: 12,
    lastBaselineResultCount: 4,
  });
  assert.doesNotMatch(JSON.stringify(status), /should-not-leak/);
});
