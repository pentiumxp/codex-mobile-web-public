"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadListFallbackCacheService,
} = require("../adapters/thread-list-fallback-cache-service");

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
    filterFallbackThreads: (threads, filters = {}) => {
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
  assert.equal(expiredDiagnostics.cacheTtlMs, 10);
  assert.equal(expiredDiagnostics.cacheBuildCount, 2);
  assert.equal(expiredDiagnostics.cacheBuildNumber, 2);
  assert.deepEqual(calls, { stateDb: 2, rollout: 2, sessionIndex: 2 });
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
