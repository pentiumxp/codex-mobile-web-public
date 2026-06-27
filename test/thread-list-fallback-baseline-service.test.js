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
    baselineFinalFilterPassCount: 0,
    baselineFinalFilterInputCount: 0,
    baselineFinalFilterOutputCount: 0,
    baselineMergeInputCount: 5,
    baselineMergeOutputCount: 4,
    baselineMergeDuplicateCount: 1,
    baselineLimitDropCount: 2,
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

test("thread-list fallback baseline exposes only bounded source diagnostics", () => {
  const service = createThreadListFallbackBaselineService({
    now: () => 100,
    readStateDbFallback(limit, filters) {
      filters.diagnostics.sessionIndexReadCount = 1;
      filters.diagnostics.privatePath = "/Users/private/session_index.jsonl";
      return [{ id: "state", updatedAt: 100 }];
    },
    readRolloutSessionFallback(limit, filters) {
      filters.diagnostics.rolloutFileStatCount = 12.9;
      filters.diagnostics.rolloutStatusTailBytes = 4096;
      filters.diagnostics.rawPrompt = "do not export";
      return [{ id: "rollout", updatedAt: 200 }];
    },
    readSessionIndexFallback(limit, filters) {
      filters.diagnostics.sessionIndexReadCount = 2;
      filters.diagnostics.sessionIndexLineCount = 300;
      filters.diagnostics.sessionIndexEntryCount = 40;
      filters.diagnostics.threadTitle = "private title";
      return [];
    },
    mergeThreadSummaryList: mergeByUpdatedAt,
  });

  const baseline = service.readBaseline(10, {});

  assert.equal(baseline.timings.rolloutFileStatCount, 12);
  assert.equal(baseline.timings.rolloutStatusTailBytes, 4096);
  assert.equal(baseline.timings.sessionIndexReadCount, 3);
  assert.equal(baseline.timings.sessionIndexLineCount, 300);
  assert.equal(baseline.timings.sessionIndexEntryCount, 40);
  assert.doesNotMatch(
    JSON.stringify(baseline.timings),
    /privatePath|session_index|rawPrompt|do not export|threadTitle|private title/,
  );
});

test("thread-list fallback baseline shares a source context only within one baseline read", () => {
  const seenContexts = [];
  const service = createThreadListFallbackBaselineService({
    now: () => 100,
    readStateDbFallback(limit, filters) {
      assert.ok(filters.sourceContext);
      filters.sourceContext.stateSeen = true;
      seenContexts.push(filters.sourceContext);
      return [{ id: "state", updatedAt: 100 }];
    },
    readRolloutSessionFallback(limit, filters) {
      assert.equal(filters.sourceContext.stateSeen, true);
      filters.sourceContext.sessionIndexEntries = new Map([["rollout", { id: "rollout" }]]);
      filters.diagnostics.sessionIndexReadCount = 1;
      seenContexts.push(filters.sourceContext);
      return [{ id: "rollout", updatedAt: 200 }];
    },
    readSessionIndexFallback(limit, filters) {
      assert.equal(filters.sourceContext.sessionIndexEntries.get("rollout").id, "rollout");
      filters.diagnostics.sessionIndexReuseCount = 1;
      seenContexts.push(filters.sourceContext);
      return [{ id: "session", updatedAt: 50 }];
    },
    mergeThreadSummaryList: mergeByUpdatedAt,
  });

  const baseline = service.readBaseline(10, {});

  assert.equal(seenContexts.length, 3);
  assert.equal(seenContexts[0], seenContexts[1]);
  assert.equal(seenContexts[1], seenContexts[2]);
  assert.equal(baseline.timings.sessionIndexReadCount, 1);
  assert.equal(baseline.timings.sessionIndexReuseCount, 1);
  assert.equal(baseline.timings.sourceContext, undefined);
  assert.doesNotMatch(JSON.stringify(baseline.timings), /sessionIndexEntries/);
});

test("thread-list fallback baseline passes request archive and merge options through source snapshot", () => {
  const archivedIds = new Set(["archived"]);
  const mergeOptions = { archivedIds, request: true };
  let mergeOptionsSeen = null;
  const service = createThreadListFallbackBaselineService({
    now: () => 100,
    readStateDbFallback(limit, filters) {
      assert.equal(filters.archivedIds, archivedIds);
      return [
        { id: "state", updatedAt: 100 },
        { id: "archived", updatedAt: 200 },
      ];
    },
    readRolloutSessionFallback(limit, filters) {
      assert.equal(filters.archivedIds, archivedIds);
      return [];
    },
    readSessionIndexFallback(limit, filters) {
      assert.equal(filters.archivedIds, archivedIds);
      return [];
    },
    filterFallbackThreads(threads, filters) {
      assert.equal(filters.archivedIds, archivedIds);
      return (threads || []).filter((thread) => !filters.archivedIds.has(thread.id));
    },
    mergeThreadSummaryList(threads, options) {
      mergeOptionsSeen = options;
      return threads;
    },
  });

  const baseline = service.readBaseline(10, {
    archivedIds,
    mergeThreadSummaryListOptions: mergeOptions,
    sourceSnapshotKey: "visible",
    sourceSnapshotLimit: 20,
  });

  assert.deepEqual(baseline.threads.map((thread) => thread.id), ["state"]);
  assert.equal(mergeOptionsSeen, mergeOptions);
});

test("thread-list fallback baseline reuses source snapshot across filter keys", () => {
  let nowMs = 1000;
  const calls = { stateDb: 0, rollout: 0, sessionIndex: 0 };
  const service = createThreadListFallbackBaselineService({
    now: () => {
      nowMs += 5;
      return nowMs;
    },
    readStateDbFallback(limit, filters) {
      calls.stateDb += 1;
      assert.equal(limit, 10);
      assert.equal(filters.searchTerm, undefined);
      assert.equal(filters.cwd, undefined);
      return [
        { id: "alpha", name: "Alpha", cwd: "/a", updatedAt: 100 },
        { id: "beta", name: "Beta", cwd: "/b", updatedAt: 200 },
      ];
    },
    readRolloutSessionFallback() {
      calls.rollout += 1;
      return [{ id: "rollout-alpha", name: "Alpha rollout", cwd: "/a", updatedAt: 300 }];
    },
    readSessionIndexFallback() {
      calls.sessionIndex += 1;
      return [];
    },
    filterFallbackThreads(threads, filters = {}) {
      const search = String(filters.searchTerm || "").toLowerCase();
      const cwd = String(filters.cwd || "");
      return (threads || []).filter((thread) => {
        if (search && !String(thread.name || "").toLowerCase().includes(search)) return false;
        if (cwd && thread.cwd !== cwd) return false;
        return true;
      });
    },
    mergeThreadSummaryList: mergeByUpdatedAt,
  });

  const first = service.readBaseline(2, {
    searchTerm: "alpha",
    sourceSnapshotKey: "visible-root-set",
    sourceSnapshotLimit: 10,
  });
  assert.deepEqual(first.threads.map((thread) => thread.id), ["rollout-alpha", "alpha"]);
  assert.equal(first.timings.sourceSnapshotHit, false);
  assert.equal(first.timings.baselineFinalFilterPassCount, 3);
  assert.equal(first.timings.baselineFinalFilterInputCount, 3);
  assert.equal(first.timings.baselineFinalFilterOutputCount, 2);
  assert.equal(first.timings.baselineMergeInputCount, 2);
  assert.equal(first.timings.baselineMergeOutputCount, 2);
  assert.equal(first.timings.baselineMergeDuplicateCount, 0);
  assert.equal(first.timings.baselineLimitDropCount, 0);
  assert.deepEqual(calls, { stateDb: 1, rollout: 1, sessionIndex: 1 });

  const second = service.readBaseline(2, {
    cwd: "/b",
    sourceSnapshotKey: "visible-root-set",
    sourceSnapshotLimit: 10,
  });
  assert.deepEqual(second.threads.map((thread) => thread.id), ["beta"]);
  assert.equal(second.timings.sourceSnapshotHit, true);
  assert.equal(second.timings.stateDbMs, 0);
  assert.equal(second.timings.sourceSnapshotBuildCount, 1);
  assert.equal(second.timings.baselineFinalFilterPassCount, 3);
  assert.equal(second.timings.baselineFinalFilterInputCount, 3);
  assert.equal(second.timings.baselineFinalFilterOutputCount, 1);
  assert.equal(second.timings.baselineMergeInputCount, 1);
  assert.equal(second.timings.baselineMergeOutputCount, 1);
  assert.deepEqual(calls, { stateDb: 1, rollout: 1, sessionIndex: 1 });
});

test("thread-list fallback baseline keeps source snapshots incrementally current", () => {
  const service = createThreadListFallbackBaselineService({
    now: () => 100,
    readStateDbFallback() {
      return [{ id: "alpha", name: "Alpha", cwd: "/a", updatedAt: 100 }];
    },
    readRolloutSessionFallback() {
      return [];
    },
    readSessionIndexFallback() {
      return [];
    },
    filterFallbackThreads(threads, filters = {}) {
      const search = String(filters.searchTerm || "").toLowerCase();
      return (threads || []).filter((thread) => !search || String(thread.name || "").toLowerCase().includes(search));
    },
    mergeThreadSummaryList: mergeByUpdatedAt,
  });

  service.readBaseline(10, {
    sourceSnapshotKey: "visible-root-set",
    sourceSnapshotLimit: 10,
  });
  assert.equal(service.upsertThread({ id: "beta", name: "Beta", cwd: "/b", updatedAt: 300 }), true);
  const afterUpsert = service.readBaseline(10, {
    searchTerm: "beta",
    sourceSnapshotKey: "visible-root-set",
    sourceSnapshotLimit: 10,
  });
  assert.equal(afterUpsert.timings.sourceSnapshotHit, true);
  assert.deepEqual(afterUpsert.threads.map((thread) => thread.id), ["beta"]);

  assert.equal(service.removeThread("beta"), true);
  const afterRemove = service.readBaseline(10, {
    searchTerm: "beta",
    sourceSnapshotKey: "visible-root-set",
    sourceSnapshotLimit: 10,
  });
  assert.deepEqual(afterRemove.threads, []);
});
