"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadListFallbackBaselineService,
} = require("../adapters/thread-list-fallback-baseline-service");

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

test("thread-list fallback baseline reads sources, merges, limits, and records timings", () => {
  let nowMs = 1000;
  const service = createThreadListFallbackBaselineService({
    now: () => {
      nowMs += 5;
      return nowMs;
    },
    readStateDbFallback(limit, filters) {
      assert.equal(limit, 2);
      assert.equal(filters.searchTerm, "music");
      return [
        { id: "state", updatedAt: 100 },
        { id: "shared", updatedAt: 110 },
      ];
    },
    readRolloutSessionFallback() {
      return [
        { id: "rollout", updatedAt: 300 },
        { id: "shared", updatedAt: 400 },
      ];
    },
    readSessionIndexFallback() {
      return [{ id: "session", updatedAt: 200 }];
    },
    mergeThreadSummaryList: mergeByUpdatedAt,
  });

  const baseline = service.readBaseline(2, { searchTerm: "music" });

  assert.deepEqual(baseline.threads.map((thread) => thread.id), ["shared", "rollout"]);
  assert.deepEqual(baseline.sources, {
    stateDb: 2,
    rollout: 2,
    sessionIndex: 1,
  });
  assert.deepEqual(baseline.timings, {
    stateDbMs: 5,
    rolloutMs: 5,
    sessionIndexMs: 5,
    stateDbCount: 2,
    rolloutCount: 2,
    sessionIndexCount: 1,
    baselineSourceCount: 5,
    baselineResultCount: 2,
  });
});

test("thread-list fallback baseline normalizes invalid source results without copying private fields", () => {
  const service = createThreadListFallbackBaselineService({
    now: () => 100,
    readStateDbFallback() {
      return null;
    },
    readRolloutSessionFallback() {
      return [{ id: "rollout", updatedAt: 1, privatePrompt: "do not export" }];
    },
    readSessionIndexFallback() {
      return "bad shape";
    },
    mergeThreadSummaryList(threads) {
      return (threads || []).map((thread) => ({
        id: thread.id,
        updatedAt: thread.updatedAt,
      }));
    },
  });

  const baseline = service.readBaseline(10, {});

  assert.deepEqual(baseline.threads, [{ id: "rollout", updatedAt: 1 }]);
  assert.equal(baseline.timings.baselineSourceCount, 1);
  assert.equal(baseline.timings.baselineResultCount, 1);
  assert.doesNotMatch(JSON.stringify(baseline), /privatePrompt|do not export/);
});
