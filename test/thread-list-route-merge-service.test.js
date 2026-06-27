"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  countDuplicateIds,
  countUniqueIds,
  fallbackThreadsForRouteMerge,
  mergeThreadListRouteResult,
  threadRowsFromResult,
} = require("../adapters/thread-list-route-merge-service");

function mergeByUpdatedAt(threads) {
  const byId = new Map();
  for (const thread of threads || []) {
    if (!thread || !thread.id) continue;
    const previous = byId.get(thread.id);
    if (!previous || Number(thread.updatedAt || 0) >= Number(previous.updatedAt || 0)) {
      byId.set(thread.id, thread);
    }
  }
  return [...byId.values()].sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
}

test("thread-list route merge preserves result shape and exposes bounded diagnostics", () => {
  const merged = mergeThreadListRouteResult({
    result: {
      data: [
        { id: "a", updatedAt: 10 },
        { id: "b", updatedAt: 5 },
      ],
      nextCursor: "cursor-private-value",
    },
    fallbackThreads: [
      { id: "b", updatedAt: 12 },
      { id: "c", updatedAt: 8 },
      { id: "d", updatedAt: 1 },
    ],
    limit: 2,
    mergeThreadSummaryList: mergeByUpdatedAt,
  });

  assert.deepEqual(merged.result.data.map((thread) => thread.id), ["b", "a"]);
  assert.equal(merged.result.nextCursor, "cursor-private-value");
  assert.deepEqual(merged.diagnostics, {
    routeMergeAppServerInputCount: 2,
    routeMergeFallbackInputCount: 3,
    routeMergeInputCount: 5,
    routeMergeUniqueInputCount: 4,
    routeMergeDuplicateCount: 1,
    routeMergeFallbackDuplicateDropCount: 0,
    routeMergeMergedCount: 4,
    routeMergeOutputCount: 2,
    routeMergeLimitDropCount: 2,
  });
  assert.doesNotMatch(JSON.stringify(merged.diagnostics), /cursor-private-value|updatedAt/);
});

test("thread-list route merge supports threads-array results", () => {
  const merged = mergeThreadListRouteResult({
    result: {
      threads: [
        { id: "x", updatedAt: 1 },
      ],
    },
    fallbackThreads: [
      { id: "y", updatedAt: 2 },
    ],
    limit: 10,
    mergeThreadSummaryList: mergeByUpdatedAt,
  });

  assert.deepEqual(merged.result.threads.map((thread) => thread.id), ["y", "x"]);
  assert.deepEqual(threadRowsFromResult(merged.result).map((thread) => thread.id), ["y", "x"]);
  assert.equal(merged.diagnostics.routeMergeOutputCount, 2);
});

test("thread-list route merge can drop fallback duplicates already covered by app-server rows", () => {
  const fallbackMerge = fallbackThreadsForRouteMerge([
    { id: "a" },
    { id: "b" },
  ], [
    { id: "b", updatedAt: 2 },
    { id: "c", updatedAt: 3 },
  ], { dropDuplicateFallbackThreads: true });

  assert.deepEqual(fallbackMerge.fallbackThreads.map((thread) => thread.id), ["c"]);
  assert.equal(fallbackMerge.duplicateDropCount, 1);

  const merged = mergeThreadListRouteResult({
    result: { data: [{ id: "a", updatedAt: 10 }, { id: "b", updatedAt: 9 }] },
    fallbackThreads: [{ id: "b", updatedAt: 20 }, { id: "c", updatedAt: 8 }],
    dropDuplicateFallbackThreads: true,
    limit: 10,
    mergeThreadSummaryList: mergeByUpdatedAt,
  });

  assert.deepEqual(merged.result.data.map((thread) => thread.id), ["a", "b", "c"]);
  assert.equal(merged.diagnostics.routeMergeFallbackInputCount, 2);
  assert.equal(merged.diagnostics.routeMergeFallbackDuplicateDropCount, 1);
  assert.equal(merged.diagnostics.routeMergeInputCount, 3);
  assert.equal(merged.diagnostics.routeMergeDuplicateCount, 0);
});

test("thread-list route merge includes summary-merge diagnostics without private fields", () => {
  let receivedOptions = null;
  const merged = mergeThreadListRouteResult({
    result: { data: [{ id: "a" }] },
    fallbackThreads: [{ id: "b" }],
    limit: 10,
    mergeThreadSummaryListOptions: {
      archivedIds: new Set(["x"]),
      privatePrompt: "must not be copied",
    },
    mergeThreadSummaryList: (threads, options) => {
      receivedOptions = options;
      return {
      threads,
      diagnostics: {
        summaryMergeInputCount: threads.length,
        summaryMergeDominantStage: "cached_display",
        privatePrompt: "must not be copied if caller adds unsafe fields",
      },
      };
    },
  });

  assert.equal(merged.diagnostics.routeMergeInputCount, 2);
  assert.ok(receivedOptions.archivedIds.has("x"));
  assert.equal(merged.diagnostics.summaryMergeInputCount, 2);
  assert.equal(merged.diagnostics.summaryMergeDominantStage, "cached_display");
  assert.equal(Object.prototype.hasOwnProperty.call(merged.diagnostics, "privatePrompt"), false);
  assert.doesNotMatch(JSON.stringify(merged.diagnostics), /must not be copied|privatePrompt/);
});

test("thread-list route merge bounds invalid limits and duplicate counters", () => {
  assert.equal(countUniqueIds([{ id: "a" }, { id: "a" }, { id: "" }, null]), 1);
  assert.equal(countDuplicateIds([{ id: "a" }, { id: "a" }, { id: "b" }, { id: "a" }]), 2);

  const merged = mergeThreadListRouteResult({
    result: { data: [{ id: "a" }, { id: "b" }] },
    fallbackThreads: [{ id: "c" }],
    limit: "bad",
    mergeThreadSummaryList: (threads) => threads,
  });

  assert.equal(merged.result.data.length, 3);
  assert.equal(merged.diagnostics.routeMergeLimitDropCount, 0);
});
