"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createThreadListFallbackCacheService,
} = require("../adapters/thread-list-fallback-cache-service");
const {
  createThreadListFallbackPersistentCacheStore,
} = require("../adapters/thread-list-fallback-persistent-cache-store");

function mergeByUpdatedAt(threads) {
  const byId = new Map();
  for (const thread of threads || []) {
    if (!thread || !thread.id) continue;
    const existing = byId.get(thread.id);
    byId.set(thread.id, Object.assign({}, existing || {}, thread, {
      updatedAt: Math.max(Number(existing && existing.updatedAt || 0), Number(thread.updatedAt || 0)),
    }));
  }
  return [...byId.values()].sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
}

function createService(overrides = {}) {
  let nowMs = Number(overrides.nowMs || 1000);
  const calls = {
    stateDb: 0,
    rollout: 0,
    sessionIndex: 0,
  };
  const service = createThreadListFallbackCacheService({
    ttlMs: overrides.ttlMs || 0,
    maxEntries: overrides.maxEntries || 12,
    now: () => nowMs,
    readGlobalState: () => ({
      roots: ["/workspace/default"],
      projectless: ["thread-projectless"],
    }),
    normalizeFsPath: (value) => String(value || "").replace(/[\\/]+/g, "/").toLowerCase(),
    normalizeThreadId: (value) => String(value || "").trim().toLowerCase(),
    visibleWorkspaceRoots: (globalState) => new Set(globalState.roots || []),
    visibleProjectlessThreadIds: (globalState) => new Set(globalState.projectless || []),
    mergeThreadDisplaySummary: (base, display) => Object.assign({}, base || {}, display || {}),
    normalizeThreadSummaryLiveStatus: (thread) => Object.assign({}, thread, { normalized: true }),
    filterFallbackThreads: typeof overrides.filterFallbackThreads === "function"
      ? overrides.filterFallbackThreads
      : (threads, filters = {}) => {
        const search = String(filters.searchTerm || "").trim().toLowerCase();
        return (threads || []).filter((thread) => !search || String(thread.name || "").toLowerCase().includes(search));
      },
    mergeThreadSummaryList: mergeByUpdatedAt,
    readStateDbFallback(limit, filters) {
      calls.stateDb += 1;
      return typeof overrides.readStateDbFallback === "function"
        ? overrides.readStateDbFallback(limit, filters)
        : [{ id: "thread-state", name: "State DB", updatedAt: 100 }];
    },
    readRolloutSessionFallback(limit, filters) {
      calls.rollout += 1;
      return typeof overrides.readRolloutSessionFallback === "function"
        ? overrides.readRolloutSessionFallback(limit, filters)
        : [{ id: "thread-rollout", name: "Rollout", updatedAt: 200 }];
    },
    readSessionIndexFallback(limit, filters) {
      calls.sessionIndex += 1;
      return typeof overrides.readSessionIndexFallback === "function"
        ? overrides.readSessionIndexFallback(limit, filters)
        : [{ id: "thread-session", name: "Session", updatedAt: 300 }];
    },
  });
  return {
    calls,
    service,
    setNow(value) {
      nowMs = value;
    },
  };
}

test("fallback cache key includes normalized filters, visible roots, and projectless ids", () => {
  const { service } = createService();
  const key = JSON.parse(service.cacheKey(500, {
    cwd: "/Workspace/Default/",
    searchTerm: "  MUSIC ",
    globalState: {
      roots: ["/B", "/a"],
      projectless: [" Thread-Z ", "thread-a"],
    },
  }));

  assert.deepEqual(key, {
    limit: 200,
    cwd: "/workspace/default/",
    search: "music",
    roots: ["/a", "/b"],
    projectlessIds: ["thread-a", "thread-z"],
  });
});

test("readFallback uses cached fallback list after the first complete pass", () => {
  const { calls, service, setNow } = createService();
  const firstDiagnostics = {};
  const first = service.readFallback(10, { diagnostics: firstDiagnostics });
  assert.deepEqual(first.map((thread) => thread.id), ["thread-session", "thread-rollout", "thread-state"]);
  assert.equal(firstDiagnostics.cacheHit, false);
  assert.equal(firstDiagnostics.cacheDecision, "miss-rebuild");
  assert.equal(firstDiagnostics.cacheBuildReason, "miss");
  assert.match(firstDiagnostics.cacheKeyHash, /^[a-z0-9]{6,10}$/);
  assert.equal(firstDiagnostics.cacheBuildCount, 1);
  assert.equal(firstDiagnostics.cacheBuildNumber, 1);
  assert.equal(firstDiagnostics.cacheEntryCount, 1);
  assert.deepEqual(calls, { stateDb: 1, rollout: 1, sessionIndex: 1 });

  first[0].name = "mutated caller copy";
  setNow(1250);
  const secondDiagnostics = {};
  const second = service.readFallback(10, { diagnostics: secondDiagnostics });
  assert.deepEqual(calls, { stateDb: 1, rollout: 1, sessionIndex: 1 });
  assert.equal(secondDiagnostics.cacheHit, true);
  assert.equal(secondDiagnostics.cacheDecision, "hit");
  assert.equal(secondDiagnostics.cacheBuildCount, 1);
  assert.equal(secondDiagnostics.cacheBuildNumber, 1);
  assert.equal(secondDiagnostics.cacheEntryCount, 1);
  assert.equal(secondDiagnostics.cacheAgeMs, 250);
  assert.equal(secondDiagnostics.cacheBaselineAgeMs, 250);
  assert.equal(secondDiagnostics.cacheTtlMs, 0);
  assert.equal(second[0].name, "Session");
  assert.deepEqual(secondDiagnostics.cachedSourceTimings, {
    stateDbMs: 0,
    rolloutMs: 0,
    sessionIndexMs: 0,
    stateDbCount: 1,
    rolloutCount: 1,
    sessionIndexCount: 1,
    baselineSourceCount: 3,
    baselineResultCount: 3,
    baselineFinalFilterPassCount: 3,
    baselineFinalFilterInputCount: 3,
    baselineFinalFilterOutputCount: 3,
    baselineMergeInputCount: 3,
    baselineMergeOutputCount: 3,
    sourceSnapshotHit: false,
    sourceSnapshotAgeMs: 0,
    sourceSnapshotLimit: 200,
    sourceSnapshotBuildCount: 1,
    sourceSnapshotBuildNumber: 1,
    sourceSnapshotRawCount: 3,
  });
});

test("readCachedFallback returns only warm cache and never builds cold baseline", () => {
  const { calls, service, setNow } = createService();
  const coldDiagnostics = {};
  const cold = service.readCachedFallback(10, { diagnostics: coldDiagnostics });
  assert.deepEqual(cold, []);
  assert.equal(coldDiagnostics.cacheHit, false);
  assert.equal(coldDiagnostics.cacheDecision, "miss");
  assert.deepEqual(calls, { stateDb: 0, rollout: 0, sessionIndex: 0 });

  const buildDiagnostics = {};
  service.readFallback(10, { diagnostics: buildDiagnostics });
  assert.equal(buildDiagnostics.cacheDecision, "miss-rebuild");
  assert.deepEqual(calls, { stateDb: 1, rollout: 1, sessionIndex: 1 });

  setNow(1500);
  const warmDiagnostics = {};
  const warm = service.readCachedFallback(10, { diagnostics: warmDiagnostics });
  assert.deepEqual(warm.map((thread) => thread.id), ["thread-session", "thread-rollout", "thread-state"]);
  assert.equal(warmDiagnostics.cacheHit, true);
  assert.equal(warmDiagnostics.cacheDecision, "hit");
  assert.equal(warmDiagnostics.cacheAgeMs, 500);
  assert.equal(warmDiagnostics.cacheBaselineAgeMs, 500);
  assert.equal(warmDiagnostics.cacheBuildNumber, 1);
  assert.deepEqual(calls, { stateDb: 1, rollout: 1, sessionIndex: 1 });
});

test("readCachedFallback filters hidden rows from warm cache", () => {
  const { service } = createService({
    filterFallbackThreads(threads) {
      return (threads || []).filter((thread) => thread.hidden !== true);
    },
    readStateDbFallback: () => [],
    readRolloutSessionFallback: () => [],
    readSessionIndexFallback: () => [],
  });
  const key = service.cacheKey(10);
  service.remember(key, [
    { id: "bad-placeholder", name: "bad-placeholder", hidden: true, updatedAt: 300 },
    { id: "good-thread", name: "Good", updatedAt: 200 },
  ], {}, { limit: 10, filters: {} });

  const diagnostics = {};
  const warm = service.readCachedFallback(10, { diagnostics });

  assert.deepEqual(warm.map((thread) => thread.id), ["good-thread"]);
  assert.equal(diagnostics.cacheHit, true);
  assert.equal(diagnostics.cacheFilteredDropCount, 1);
});

test("fallback cache reuses wider warm entries for narrower same-scope requests", () => {
  const { calls, service, setNow } = createService({
    readStateDbFallback() {
      return [
        { id: "state-1", name: "State 1", updatedAt: 100 },
        { id: "state-2", name: "State 2", updatedAt: 90 },
      ];
    },
    readRolloutSessionFallback() {
      return [
        { id: "rollout-1", name: "Rollout 1", updatedAt: 300 },
        { id: "rollout-2", name: "Rollout 2", updatedAt: 80 },
      ];
    },
    readSessionIndexFallback() {
      return [
        { id: "session-1", name: "Session 1", updatedAt: 500 },
      ];
    },
  });

  const wideDiagnostics = {};
  const wide = service.readFallback(40, { diagnostics: wideDiagnostics });
  assert.equal(wideDiagnostics.cacheDecision, "miss-rebuild");
  assert.deepEqual(wide.map((thread) => thread.id), [
    "session-1",
    "rollout-1",
    "state-1",
    "state-2",
    "rollout-2",
  ]);
  assert.deepEqual(calls, { stateDb: 1, rollout: 1, sessionIndex: 1 });

  setNow(1750);
  const narrowDiagnostics = {};
  const narrow = service.readFallback(2, { diagnostics: narrowDiagnostics });
  assert.deepEqual(narrow.map((thread) => thread.id), ["session-1", "rollout-1"]);
  assert.deepEqual(calls, { stateDb: 1, rollout: 1, sessionIndex: 1 });
  assert.equal(narrowDiagnostics.cacheHit, true);
  assert.equal(narrowDiagnostics.cacheDecision, "compatible-hit");
  assert.equal(narrowDiagnostics.compatibleCacheHit, true);
  assert.equal(narrowDiagnostics.compatibleCacheLimit, 40);
  assert.equal(narrowDiagnostics.cacheBuildCount, 1);

  const warmDiagnostics = {};
  const warm = service.readCachedFallback(2, { diagnostics: warmDiagnostics });
  assert.deepEqual(warm.map((thread) => thread.id), ["session-1", "rollout-1"]);
  assert.equal(warmDiagnostics.cacheHit, true);
  assert.equal(warmDiagnostics.cacheDecision, "compatible-hit");
  assert.equal(warmDiagnostics.compatibleCacheLimit, 40);
});

test("fallback cache does not reuse narrower warm entries for wider requests", () => {
  const { calls, service } = createService();

  const narrowDiagnostics = {};
  service.readFallback(2, { diagnostics: narrowDiagnostics });
  assert.equal(narrowDiagnostics.cacheDecision, "miss-rebuild");
  assert.deepEqual(calls, { stateDb: 1, rollout: 1, sessionIndex: 1 });

  const widerDiagnostics = {};
  service.readFallback(40, { diagnostics: widerDiagnostics });
  assert.equal(widerDiagnostics.cacheHit, false);
  assert.equal(widerDiagnostics.cacheDecision, "miss-rebuild");
  assert.deepEqual(calls, { stateDb: 2, rollout: 2, sessionIndex: 2 });
});

test("fallback cache reuses prewarmed source snapshot for wider final-list requests", () => {
  const { calls, service } = createService({
    readStateDbFallback(limit, filters) {
      assert.equal(limit, 1000);
      assert.equal(filters.searchTerm, undefined);
      return [
        { id: "state-1", name: "State 1", updatedAt: 100 },
        { id: "state-2", name: "State 2", updatedAt: 90 },
      ];
    },
    readRolloutSessionFallback(limit) {
      assert.equal(limit, 1000);
      return [
        { id: "rollout-1", name: "Rollout 1", updatedAt: 400 },
        { id: "rollout-2", name: "Rollout 2", updatedAt: 80 },
      ];
    },
    readSessionIndexFallback(limit) {
      assert.equal(limit, 1000);
      return [
        { id: "session-1", name: "Session 1", updatedAt: 500 },
      ];
    },
  });

  const prewarmDiagnostics = {};
  const prewarm = service.readFallback(2, {
    diagnostics: prewarmDiagnostics,
    sourceSnapshotLimit: 1000,
  });
  assert.deepEqual(prewarm.map((thread) => thread.id), ["session-1", "rollout-1"]);
  assert.equal(prewarmDiagnostics.cacheDecision, "miss-rebuild");
  assert.equal(prewarmDiagnostics.sourceSnapshotHit, false);
  assert.equal(prewarmDiagnostics.sourceSnapshotLimit, 1000);
  assert.deepEqual(calls, { stateDb: 1, rollout: 1, sessionIndex: 1 });

  const widerDiagnostics = {};
  const wider = service.readFallback(4, { diagnostics: widerDiagnostics });
  assert.deepEqual(wider.map((thread) => thread.id), [
    "session-1",
    "rollout-1",
    "state-1",
    "state-2",
  ]);
  assert.equal(widerDiagnostics.cacheHit, false);
  assert.equal(widerDiagnostics.cacheDecision, "miss-rebuild");
  assert.equal(widerDiagnostics.sourceSnapshotHit, true);
  assert.equal(widerDiagnostics.sourceSnapshotLimit, 1000);
  assert.equal(widerDiagnostics.baselineResultCount, 4);
  assert.deepEqual(calls, { stateDb: 1, rollout: 1, sessionIndex: 1 });
});

test("readFallback reuses source snapshot across final-list filter cache misses", () => {
  const { calls, service } = createService({
    readStateDbFallback(limit, filters) {
      assert.equal(limit, 200);
      assert.equal(filters.searchTerm, undefined);
      assert.equal(filters.cwd, undefined);
      return [
        { id: "alpha", name: "Alpha", updatedAt: 100 },
        { id: "beta", name: "Beta", updatedAt: 200 },
      ];
    },
    readRolloutSessionFallback() {
      return [{ id: "rollout-alpha", name: "Alpha rollout", updatedAt: 300 }];
    },
    readSessionIndexFallback() {
      return [];
    },
  });

  const firstDiagnostics = {};
  const first = service.readFallback(10, { searchTerm: "alpha", diagnostics: firstDiagnostics });
  assert.deepEqual(first.map((thread) => thread.id), ["rollout-alpha", "alpha"]);
  assert.equal(firstDiagnostics.cacheDecision, "miss-rebuild");
  assert.equal(firstDiagnostics.sourceSnapshotHit, false);
  assert.equal(firstDiagnostics.sourceSnapshotBuildCount, 1);
  assert.deepEqual(calls, { stateDb: 1, rollout: 1, sessionIndex: 1 });

  const secondDiagnostics = {};
  const second = service.readFallback(10, { searchTerm: "beta", diagnostics: secondDiagnostics });
  assert.deepEqual(second.map((thread) => thread.id), ["beta"]);
  assert.equal(secondDiagnostics.cacheDecision, "miss-rebuild");
  assert.equal(secondDiagnostics.sourceSnapshotHit, true);
  assert.equal(secondDiagnostics.stateDbMs, 0);
  assert.equal(secondDiagnostics.sourceSnapshotBuildCount, 1);
  assert.deepEqual(calls, { stateDb: 1, rollout: 1, sessionIndex: 1 });
});

test("readFallback can build cold baseline through injected baseline service", () => {
  const calls = [];
  const directService = createThreadListFallbackCacheService({
    now: () => 1000,
    readGlobalState: () => ({
      roots: ["/workspace/default"],
      projectless: [],
    }),
    normalizeFsPath: (value) => String(value || "").replace(/[\\/]+/g, "/").toLowerCase(),
    normalizeThreadId: (value) => String(value || "").trim().toLowerCase(),
    visibleWorkspaceRoots: (globalState) => new Set(globalState.roots || []),
    visibleProjectlessThreadIds: () => new Set(),
    filterFallbackThreads: (threads) => threads || [],
    mergeThreadSummaryList: mergeByUpdatedAt,
    baselineService: {
      readBaseline(limit, filters) {
        calls.push({
          limit,
          cwd: filters.cwd,
          searchTerm: filters.searchTerm,
          roots: filters.globalState && filters.globalState.roots,
        });
        return {
          threads: [
            { id: "baseline-1", name: "Baseline", updatedAt: 10 },
            { id: "baseline-2", name: "Second", updatedAt: 9 },
          ],
          timings: {
            stateDbMs: 3,
            rolloutMs: 5,
            sessionIndexMs: 7,
            stateDbCount: 4,
            rolloutCount: 5,
            sessionIndexCount: 6,
            baselineSourceCount: 15,
            baselineResultCount: 2,
            baselineFinalFilterPassCount: 3,
            baselineFinalFilterInputCount: 18,
            baselineFinalFilterOutputCount: 15,
            baselineMergeInputCount: 15,
            baselineMergeOutputCount: 12,
            baselineMergeDuplicateCount: 3,
            baselineLimitDropCount: 10,
            rolloutFileStatCount: 12,
            rolloutStatusTailReadCount: 2,
            rolloutStatusTailBytes: 8192,
            sessionIndexReadCount: 3,
            sessionIndexReuseCount: 1,
            sessionIndexLineCount: 500,
            privatePath: "/Users/private/session_index.jsonl",
          },
        };
      },
    },
  });

  const diagnostics = {};
  const threads = directService.readFallback(2, {
    cwd: "/workspace/default",
    searchTerm: "base",
    globalState: { roots: ["/workspace/default"] },
    diagnostics,
  });

  assert.deepEqual(threads.map((thread) => thread.id), ["baseline-1", "baseline-2"]);
  assert.deepEqual(calls, [{
    limit: 2,
    cwd: "/workspace/default",
    searchTerm: "base",
    roots: ["/workspace/default"],
  }]);
  assert.equal(diagnostics.cacheDecision, "miss-rebuild");
  assert.equal(diagnostics.stateDbMs, 3);
  assert.equal(diagnostics.rolloutMs, 5);
  assert.equal(diagnostics.sessionIndexMs, 7);
  assert.equal(diagnostics.stateDbCount, 4);
  assert.equal(diagnostics.rolloutCount, 5);
  assert.equal(diagnostics.sessionIndexCount, 6);
  assert.equal(diagnostics.baselineSourceCount, 15);
  assert.equal(diagnostics.baselineResultCount, 2);
  assert.equal(diagnostics.baselineFinalFilterPassCount, 3);
  assert.equal(diagnostics.baselineFinalFilterInputCount, 18);
  assert.equal(diagnostics.baselineFinalFilterOutputCount, 15);
  assert.equal(diagnostics.baselineMergeInputCount, 15);
  assert.equal(diagnostics.baselineMergeOutputCount, 12);
  assert.equal(diagnostics.baselineMergeDuplicateCount, 3);
  assert.equal(diagnostics.baselineLimitDropCount, 10);
  assert.equal(diagnostics.rolloutFileStatCount, 12);
  assert.equal(diagnostics.rolloutStatusTailReadCount, 2);
  assert.equal(diagnostics.rolloutStatusTailBytes, 8192);
  assert.equal(diagnostics.sessionIndexReadCount, 3);
  assert.equal(diagnostics.sessionIndexReuseCount, 1);
  assert.equal(diagnostics.sessionIndexLineCount, 500);
  assert.equal(diagnostics.privatePath, undefined);

  const hitDiagnostics = {};
  directService.readFallback(2, {
    cwd: "/workspace/default",
    searchTerm: "base",
    globalState: { roots: ["/workspace/default"] },
    diagnostics: hitDiagnostics,
  });
  assert.equal(hitDiagnostics.cacheDecision, "hit");
  assert.deepEqual(hitDiagnostics.cachedSourceTimings, {
    stateDbMs: 3,
    rolloutMs: 5,
    sessionIndexMs: 7,
    stateDbCount: 4,
    rolloutCount: 5,
    sessionIndexCount: 6,
    baselineSourceCount: 15,
    baselineResultCount: 2,
    baselineFinalFilterPassCount: 3,
    baselineFinalFilterInputCount: 18,
    baselineFinalFilterOutputCount: 15,
    baselineMergeInputCount: 15,
    baselineMergeOutputCount: 12,
    baselineMergeDuplicateCount: 3,
    baselineLimitDropCount: 10,
    rolloutFileStatCount: 12,
    rolloutStatusTailReadCount: 2,
    rolloutStatusTailBytes: 8192,
    sessionIndexReadCount: 3,
    sessionIndexReuseCount: 1,
    sessionIndexLineCount: 500,
  });
});

test("fallback cache ttl is opt-in and expires cached entries when configured", () => {
  const { calls, service, setNow } = createService({ ttlMs: 10 });
  const firstDiagnostics = {};
  service.readFallback(10, { diagnostics: firstDiagnostics });
  assert.equal(firstDiagnostics.cacheDecision, "miss-rebuild");
  setNow(1005);
  const hitDiagnostics = {};
  service.readFallback(10, { diagnostics: hitDiagnostics });
  assert.equal(hitDiagnostics.cacheDecision, "hit");
  assert.equal(hitDiagnostics.cacheTtlMs, 10);
  assert.deepEqual(calls, { stateDb: 1, rollout: 1, sessionIndex: 1 });

  setNow(1015);
  const expiredDiagnostics = {};
  service.readFallback(10, { diagnostics: expiredDiagnostics });
  assert.equal(expiredDiagnostics.cacheDecision, "expired-rebuild");
  assert.equal(expiredDiagnostics.cacheBuildReason, "expired");
  assert.equal(expiredDiagnostics.sourceSnapshotHit, true);
  assert.equal(expiredDiagnostics.cacheTtlMs, 10);
  assert.equal(expiredDiagnostics.cacheBuildCount, 2);
  assert.equal(expiredDiagnostics.cacheBuildNumber, 2);
  assert.deepEqual(calls, { stateDb: 1, rollout: 1, sessionIndex: 1 });
});

test("status updates patch cached rows without adding missing threads", () => {
  const { service, setNow } = createService({
    readStateDbFallback: () => [{ id: "thread-1", name: "One", updatedAt: 1, status: { type: "idle" } }],
    readRolloutSessionFallback: () => [],
    readSessionIndexFallback: () => [],
  });
  service.readFallback(10, {});
  setNow(3000);

  assert.equal(service.updateStatus("thread-missing", { type: "active" }), false);
  assert.equal(service.updateStatus("thread-1", { type: "active" }, { source: "local", turnId: "turn-1" }), true);

  const diagnostics = {};
  const threads = service.readFallback(10, { diagnostics });
  assert.equal(diagnostics.cacheHit, true);
  assert.equal(diagnostics.cacheDecision, "hit");
  assert.equal(diagnostics.cacheIncrementalUpdates, 1);
  assert.equal(diagnostics.cacheBuildNumber, 1);
  assert.deepEqual(threads, [{
    id: "thread-1",
    name: "One",
    updatedAt: 3,
    status: { type: "active" },
    mobileStatusSource: "local",
    mobileStatusTurnId: "turn-1",
    normalized: true,
  }]);
});

test("upsert and remove keep filtered cached lists incrementally current", () => {
  const { service } = createService({
    readStateDbFallback: () => [{ id: "thread-1", name: "Alpha", updatedAt: 100 }],
    readRolloutSessionFallback: () => [],
    readSessionIndexFallback: () => [],
  });
  service.readFallback(10, { searchTerm: "alpha" });

  assert.equal(service.upsertThread({ id: "thread-2", name: "Alpha new", updatedAt: 300 }, { addIfMissing: true }), true);
  assert.deepEqual(service.readFallback(10, { searchTerm: "alpha" }).map((thread) => thread.id), ["thread-2", "thread-1"]);

  assert.equal(service.upsertThread({ id: "thread-2", name: "Beta", updatedAt: 400 }, { addIfMissing: true }), true);
  assert.deepEqual(service.readFallback(10, { searchTerm: "alpha" }).map((thread) => thread.id), ["thread-1"]);

  assert.equal(service.removeThread("thread-1"), true);
  assert.deepEqual(service.readFallback(10, { searchTerm: "alpha" }), []);
});

test("fresh scoped thread rows backfill the default warm fallback cache", () => {
  const { service } = createService({
    readStateDbFallback: () => [{ id: "thread-1", name: "Home", updatedAt: 100 }],
    readRolloutSessionFallback: () => [],
    readSessionIndexFallback: () => [],
  });
  const defaultBuildDiagnostics = {};
  assert.deepEqual(service.readFallback(10, { diagnostics: defaultBuildDiagnostics }).map((thread) => thread.id), ["thread-1"]);
  assert.equal(defaultBuildDiagnostics.cacheDecision, "miss-rebuild");

  const movieThread = {
    id: "thread-movie",
    name: "Movie",
    cwd: "/workspace/default",
    updatedAt: 400,
  };
  assert.equal(service.upsertThread(movieThread, { addIfMissing: true }), true);

  const defaultHitDiagnostics = {};
  assert.deepEqual(service.readCachedFallback(10, { diagnostics: defaultHitDiagnostics }).map((thread) => thread.id), [
    "thread-movie",
    "thread-1",
  ]);
  assert.equal(defaultHitDiagnostics.cacheHit, true);
  assert.equal(defaultHitDiagnostics.cacheDecision, "hit");
  assert.equal(defaultHitDiagnostics.cacheIncrementalUpdates, 1);
});

test("workspace reads can derive first paint rows from default warm fallback cache", () => {
  const { service } = createService({
    readStateDbFallback: () => [
      { id: "thread-home", name: "Home", cwd: "/workspace/default", updatedAt: 100 },
      { id: "thread-movie", name: "Movie", cwd: "/workspace/movie", updatedAt: 300 },
    ],
    readRolloutSessionFallback: () => [],
    readSessionIndexFallback: () => [],
    filterFallbackThreads: (threads, filters = {}) => {
      const cwd = String(filters.cwd || "").trim().toLowerCase();
      const search = String(filters.searchTerm || "").trim().toLowerCase();
      return (threads || []).filter((thread) => {
        if (cwd && String(thread.cwd || "").trim().toLowerCase() !== cwd) return false;
        if (search && !String(thread.name || "").toLowerCase().includes(search)) return false;
        return true;
      });
    },
  });
  service.readFallback(10);

  const diagnostics = {};
  const movieRows = service.readCachedFallback(10, {
    cwd: "/workspace/movie",
    diagnostics,
  });

  assert.deepEqual(movieRows.map((thread) => thread.id), ["thread-movie"]);
  assert.equal(diagnostics.cacheHit, true);
  assert.equal(diagnostics.cacheDecision, "workspace-derived-hit");
  assert.equal(diagnostics.workspaceDerivedCacheHit, true);
  assert.equal(diagnostics.compatibleCacheHit, true);

  const exactDiagnostics = {};
  assert.deepEqual(service.readCachedFallback(10, {
    cwd: "/workspace/movie",
    diagnostics: exactDiagnostics,
  }).map((thread) => thread.id), ["thread-movie"]);
  assert.equal(exactDiagnostics.cacheHit, true);
  assert.equal(exactDiagnostics.cacheDecision, "hit");
});

test("fallback cache restores persisted warm entries after a service restart", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-thread-list-cache-"));
  const filePath = path.join(dir, "thread-list-fallback-cache.json");
  let nowMs = 10_000;
  const firstStore = createThreadListFallbackPersistentCacheStore({
    filePath,
    now: () => nowMs,
  });
  const firstService = createThreadListFallbackCacheService({
    now: () => nowMs,
    persistentStore: firstStore,
    readGlobalState: () => ({
      roots: ["/workspace/default"],
      projectless: ["thread-projectless"],
    }),
    normalizeFsPath: (value) => String(value || "").replace(/[\\/]+/g, "/").toLowerCase(),
    normalizeThreadId: (value) => String(value || "").trim().toLowerCase(),
    visibleWorkspaceRoots: (globalState) => new Set(globalState.roots || []),
    visibleProjectlessThreadIds: (globalState) => new Set(globalState.projectless || []),
    mergeThreadDisplaySummary: (base, display) => Object.assign({}, base || {}, display || {}),
    normalizeThreadSummaryLiveStatus: (thread) => thread,
    filterFallbackThreads: (threads) => threads || [],
    mergeThreadSummaryList: mergeByUpdatedAt,
    readStateDbFallback: () => [{ id: "thread-state", name: "State", updatedAt: 100, path: "/private/rollout.jsonl" }],
    readRolloutSessionFallback: () => [{ id: "thread-rollout", name: "Rollout", updatedAt: 200 }],
    readSessionIndexFallback: () => [],
  });
  const buildDiagnostics = {};
  assert.deepEqual(firstService.readFallback(10, { diagnostics: buildDiagnostics }).map((thread) => thread.id), [
    "thread-rollout",
    "thread-state",
  ]);
  assert.equal(buildDiagnostics.cacheDecision, "miss-rebuild");
  assert.equal(firstStore.status().lastWriteStatus, "ok");

  let stateDbCalls = 0;
  let rolloutCalls = 0;
  let sessionCalls = 0;
  nowMs = 12_500;
  const restoredStore = createThreadListFallbackPersistentCacheStore({
    filePath,
    now: () => nowMs,
  });
  const restoredService = createThreadListFallbackCacheService({
    now: () => nowMs,
    persistentStore: restoredStore,
    readGlobalState: () => ({
      roots: ["/workspace/default"],
      projectless: ["thread-projectless"],
    }),
    normalizeFsPath: (value) => String(value || "").replace(/[\\/]+/g, "/").toLowerCase(),
    normalizeThreadId: (value) => String(value || "").trim().toLowerCase(),
    visibleWorkspaceRoots: (globalState) => new Set(globalState.roots || []),
    visibleProjectlessThreadIds: (globalState) => new Set(globalState.projectless || []),
    mergeThreadDisplaySummary: (base, display) => Object.assign({}, base || {}, display || {}),
    normalizeThreadSummaryLiveStatus: (thread) => thread,
    filterFallbackThreads: (threads) => threads || [],
    mergeThreadSummaryList: mergeByUpdatedAt,
    readStateDbFallback: () => {
      stateDbCalls += 1;
      return [];
    },
    readRolloutSessionFallback: () => {
      rolloutCalls += 1;
      return [];
    },
    readSessionIndexFallback: () => {
      sessionCalls += 1;
      return [];
    },
  });

  const restoredDiagnostics = {};
  const restored = restoredService.readCachedFallback(10, { diagnostics: restoredDiagnostics });
  assert.deepEqual(restored.map((thread) => thread.id), ["thread-rollout", "thread-state"]);
  assert.equal(restoredDiagnostics.cacheHit, true);
  assert.equal(restoredDiagnostics.cacheDecision, "hit");
  assert.equal(restoredDiagnostics.cachePersistentRestored, true);
  assert.equal(restoredDiagnostics.cacheAgeMs, 2500);
  assert.deepEqual({ stateDbCalls, rolloutCalls, sessionCalls }, { stateDbCalls: 0, rolloutCalls: 0, sessionCalls: 0 });
  assert.doesNotMatch(fs.readFileSync(filePath, "utf8"), /private\/rollout|path/);
});

test("persistent fallback cache store ignores corrupt files as a cold cache miss", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-thread-list-cache-corrupt-"));
  const filePath = path.join(dir, "thread-list-fallback-cache.json");
  fs.writeFileSync(filePath, "{not json", "utf8");

  const store = createThreadListFallbackPersistentCacheStore({ filePath, now: () => 1000 });
  const entries = store.loadEntries();

  assert.deepEqual(entries, []);
  assert.equal(store.status().lastReadStatus, "invalid-json");
});

test("persistent fallback cache store is disabled without a file path", () => {
  const store = createThreadListFallbackPersistentCacheStore({ filePath: "", now: () => 1000 });

  assert.deepEqual(store.loadEntries(), []);
  assert.equal(store.saveEntries([]), false);
  assert.equal(store.status().fileConfigured, false);
  assert.equal(store.status().lastReadStatus, "disabled");
  assert.equal(store.status().lastWriteStatus, "disabled");
});
