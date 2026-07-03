"use strict";

const assert = require("node:assert/strict");
const EventEmitter = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createThreadListRuntimeService,
} = require("../services/thread-list/thread-list-runtime-service");

function createRuntimeService(overrides = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "thread-list-runtime-"));
  const fallbackFile = path.join(tmpDir, "fallback-cache.json");
  const stateThreads = overrides.stateThreads || [];
  const rolloutThreads = overrides.rolloutThreads || [];
  const sessionThreads = overrides.sessionThreads || [];
  return createThreadListRuntimeService(Object.assign({
    fallbackCache: {
      ttlMs: 0,
      maxEntries: 4,
      filePath: fallbackFile,
      persistMaxAgeMs: 60_000,
    },
    prewarm: {
      enabled: true,
      delayMs: 0,
      retryDelayMs: 10,
      maxDeferrals: 1,
      limit: 20,
      sourceSnapshotLimit: 200,
    },
    archivedSessionThreadIds: () => new Set(),
    filterFallbackThreads: (threads) => threads || [],
    hydrateThreadListTitlesFromSessionIndex: (threads) => threads,
    isSubagentThreadSummary: () => false,
    mergeThreadDisplaySummary: (base, display) => Object.assign({}, base || {}, display || {}),
    mergeThreadWithCachedDisplaySummary: (thread) => thread,
    normalizeFsPath: (value) => String(value || "").toLowerCase(),
    normalizeThreadId: (value) => String(value || "").trim(),
    normalizeThreadSummaryLiveStatus: (thread) => thread,
    readGlobalState: () => ({ roots: ["/workspace"] }),
    readRolloutSessionFallback: () => rolloutThreads,
    readSessionIndexFallback: () => sessionThreads,
    readStateDbFallback: () => stateThreads,
    scheduleActiveWindowPrewarmFromThreadListResult: overrides.scheduleActiveWindowPrewarmFromThreadListResult || (() => null),
    shouldHideThreadListSummary: () => false,
    stripThreadListDetailFields: (thread) => {
      if (!thread || typeof thread !== "object") return thread;
      const summary = Object.assign({}, thread);
      delete summary.turns;
      return summary;
    },
    stripThreadListResultDetailFields: (result) => result,
    threadHasArchiveSignal: () => false,
    timestampToMs: (value) => Number(value || 0),
    visibleProjectlessThreadIds: () => new Set(),
    visibleWorkspaceRoots: () => new Set(["/workspace"]),
    logger: false,
  }, overrides));
}

test("thread-list runtime service owns fallback cache reads, writes, and status updates", () => {
  const service = createRuntimeService({
    stateThreads: [
      { id: "a", updatedAt: 10, status: { type: "notLoaded" }, turns: [] },
      { id: "b", updatedAt: 9, status: { type: "notLoaded" } },
    ],
  });
  const diagnostics = {};

  const fallback = service.readThreadListFallback(10, { diagnostics });
  assert.deepEqual(fallback.map((thread) => thread.id), ["a", "b"]);
  assert.equal("turns" in fallback[0], false);
  assert.equal(diagnostics.cacheDecision, "miss-rebuild");

  const key = service.threadListFallbackCacheKey(10, {});
  service.rememberThreadListFallbackCache(key, fallback, { source: "test" }, { limit: 10, filters: {} });
  assert.deepEqual(service.readThreadListFallbackCache(key).threads.map((thread) => thread.id), ["a", "b"]);
  assert.equal(service.updateThreadListFallbackCacheStatus("a", { type: "active" }, { source: "test" }), true);
  assert.equal(service.readThreadListFallbackCache(key).threads[0].status.type, "active");
  assert.equal(service.removeThreadFromThreadListFallbackCache("a"), true);
  assert.deepEqual(service.readThreadListFallbackCache(key).threads.map((thread) => thread.id), ["b"]);
  service.clearThreadListFallbackCache();
  assert.equal(service.readThreadListFallbackCache(key), null);
});

test("thread-list runtime service forces thread-list summary callbacks to skip stale active normalization", () => {
  const seen = {
    cached: 0,
    display: 0,
    normalize: 0,
    overrideCached: 0,
    overrideDisplay: 0,
  };
  const assertThreadListBoundaryOptions = (options) => {
    assert.equal(
      options && options.skipFallbackCacheStatusUpdate,
      true,
      "thread-list runtime summary callbacks must not write fallback cache while normalizing fallback cache",
    );
    assert.equal(
      options && options.skipStaleContextOnlyActiveNormalize,
      true,
      "thread-list runtime summary callbacks must skip stale active normalization",
    );
  };
  const service = createRuntimeService({
    stateThreads: [
      { id: "a", updatedAt: 10, status: { type: "notLoaded" }, turns: [] },
      { id: "a", updatedAt: 11, status: { type: "active" } },
      { id: "b", updatedAt: 9, status: { type: "completed" } },
    ],
    mergeThreadWithCachedDisplaySummary(thread, options) {
      seen.cached += 1;
      assertThreadListBoundaryOptions(options);
      return thread;
    },
    mergeThreadDisplaySummary(base, display, options) {
      seen.display += 1;
      assertThreadListBoundaryOptions(options);
      return Object.assign({}, base || {}, display || {});
    },
    normalizeThreadSummaryLiveStatus(thread, options) {
      seen.normalize += 1;
      assertThreadListBoundaryOptions(options);
      return thread;
    },
  });

  const fallback = service.readThreadListFallback(10, {});
  assert.deepEqual(fallback.map((thread) => thread.id), ["a", "b"]);

  service.mergeThreadSummaryList([
    { id: "override", updatedAt: 1 },
    { id: "override", updatedAt: 2 },
  ], {
    mergeThreadWithCachedDisplaySummary(thread, options) {
      seen.overrideCached += 1;
      assertThreadListBoundaryOptions(options);
      return thread;
    },
    mergeThreadDisplaySummary(base, display, options) {
      seen.overrideDisplay += 1;
      assertThreadListBoundaryOptions(options);
      return Object.assign({}, base || {}, display || {});
    },
  });

  const key = service.threadListFallbackCacheKey(10, {});
  service.rememberThreadListFallbackCache(key, fallback, { source: "test" }, { limit: 10, filters: {} });
  assert.equal(service.upsertThreadListFallbackCacheThread(
    { id: "c", updatedAt: 12, status: { type: "active" } },
    { addIfMissing: true },
  ), true);
  assert.equal(service.updateThreadListFallbackCacheStatus("c", { type: "completed" }, { source: "test" }), true);
  assert.ok(seen.cached > 0);
  assert.ok(seen.display > 0);
  assert.ok(seen.normalize > 0);
  assert.ok(seen.overrideCached > 0);
  assert.ok(seen.overrideDisplay > 0);
});

test("thread-list runtime service owns active-detail deferral and prewarm scheduling", () => {
  const emitter = new EventEmitter();
  const prewarmCalls = [];
  const timers = [];
  const service = createRuntimeService({
    stateThreads: [{ id: "active", updatedAt: 11 }],
    setTimer(callback) {
      timers.push(callback);
      return { unref() {} };
    },
    scheduleActiveWindowPrewarmFromThreadListResult(result, reason) {
      prewarmCalls.push({ result, reason });
    },
  });

  assert.equal(service.shouldDeferThreadListFallbackForActiveDetail({}), false);
  const release = service.trackThreadDetailRequestLifecycle(emitter);
  assert.equal(service.shouldDeferThreadListFallbackForActiveDetail({}), true);
  assert.equal(service.shouldDeferThreadListFallbackForActiveDetail({ cwd: "/workspace" }), false);

  const scheduled = service.scheduleThreadListFallbackPrewarm();
  assert.equal(scheduled.scheduled, true);
  assert.equal(service.threadListFallbackPrewarmPublicStatus().scheduled, true);
  emitter.emit("finish");
  release();
  timers.shift()();

  assert.equal(prewarmCalls.length, 1);
  assert.equal(prewarmCalls[0].reason, "thread-list-prewarm:completed");
  assert.deepEqual(prewarmCalls[0].result.data.map((thread) => thread.id), ["active"]);
});

test("thread-list runtime service owns timing field shaping", () => {
  const service = createRuntimeService();

  assert.deepEqual(service.threadListFallbackSourceDiagnosticTimingFields({
    rolloutDirectoryReadCount: 1,
    sessionIndexEntryCount: 2,
  }), {
    fallbackRolloutDirectoryReadCount: 1,
    fallbackRolloutFileStatCount: 0,
    fallbackRolloutFileCollectedCount: 0,
    fallbackRolloutFileSortedCount: 0,
    fallbackRolloutCandidateFileCount: 0,
    fallbackRolloutCandidateScannedCount: 0,
    fallbackRolloutHeadReadCount: 0,
    fallbackRolloutHeadBytes: 0,
    fallbackRolloutSummaryReadCount: 0,
    fallbackRolloutStatusAttachCount: 0,
    fallbackRolloutStatusStatReadCount: 0,
    fallbackRolloutStatusStatReuseCount: 0,
    fallbackRolloutStatusTailReadCount: 0,
    fallbackRolloutStatusTailBytes: 0,
    fallbackSessionIndexReadCount: 0,
    fallbackSessionIndexReuseCount: 0,
    fallbackSessionIndexLineCount: 0,
    fallbackSessionIndexEntryCount: 2,
  });
  assert.equal(service.threadListFallbackBaselineWorkTimingFields({ baselineMergeDuplicateCount: 3 }).fallbackBaselineMergeDuplicateCount, 3);
  assert.equal(service.threadListTokenUsageTimingFields({ cacheHitCount: 4 }).tokenUsageCacheHitCount, 4);
});
