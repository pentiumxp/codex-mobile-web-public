"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadListSummaryMergeService,
  dominantTimingStage,
} = require("../adapters/thread-list-summary-merge-service");

function stepClock(step = 5) {
  let value = 0;
  return () => {
    value += step;
    return value;
  };
}

test("thread-list summary merge preserves merge semantics and records bounded stages", () => {
  const service = createThreadListSummaryMergeService({
    nowMs: stepClock(),
    archivedSessionThreadIds: () => new Set(["archived-id"]),
    mergeThreadWithCachedDisplaySummary: (thread) => Object.assign({}, thread, {
      cached: true,
      name: thread.cachedName || thread.name,
    }),
    stripThreadListDetailFields: (thread) => {
      const next = Object.assign({}, thread);
      delete next.turns;
      delete next.privatePrompt;
      return next;
    },
    normalizeThreadSummaryLiveStatus: (thread) => Object.assign({}, thread, {
      normalized: true,
    }),
    mergeThreadDisplaySummary: (base, display) => Object.assign({}, base, display, {
      mergedDuplicate: true,
    }),
    threadHasArchiveSignal: (thread, archivedIds) => thread.archived === true || archivedIds.has(thread.id),
    isSubagentThreadSummary: (thread) => thread.agentRole === "subagent",
    hydrateThreadListTitlesFromSessionIndex: (threads) => threads.map((thread) => (
      thread.id === "needs-title" ? Object.assign({}, thread, { name: "Hydrated" }) : thread
    )),
    shouldHideThreadListSummary: (thread) => thread.hidden === true,
    sortThreadListSummaries: (threads) => threads.slice().sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0)),
  });

  const result = service.mergeThreadSummaryListWithDiagnostics([
    null,
    { id: "archived-id", updatedAt: 100 },
    { id: "keep", updatedAt: 10, turns: [{ privatePrompt: "drop" }], privatePrompt: "drop" },
    { id: "keep", updatedAt: 20, cachedName: "Newer" },
    { id: "archive-signal", updatedAt: 30, archived: true },
    { id: "subagent", updatedAt: 40, agentRole: "subagent" },
    { id: "hidden", updatedAt: 50, hidden: true },
    { id: "needs-title", updatedAt: 60 },
  ]);

  assert.deepEqual(result.threads.map((thread) => thread.id), ["needs-title", "keep"]);
  assert.equal(result.threads[0].name, "Hydrated");
  assert.equal(result.threads[1].name, "Newer");
  assert.equal(result.threads[1].mergedDuplicate, true);
  assert.equal(result.threads.some((thread) => Object.prototype.hasOwnProperty.call(thread, "turns")), false);
  assert.equal(result.threads.some((thread) => Object.prototype.hasOwnProperty.call(thread, "privatePrompt")), false);

  assert.equal(result.diagnostics.summaryMergeInputCount, 8);
  assert.equal(result.diagnostics.summaryMergeInvalidCount, 1);
  assert.equal(result.diagnostics.summaryMergeArchivedIdSkipCount, 1);
  assert.equal(result.diagnostics.summaryMergeDuplicateIdCount, 1);
  assert.equal(result.diagnostics.summaryMergeArchivedSignalDropCount, 1);
  assert.equal(result.diagnostics.summaryMergeSubagentDropCount, 1);
  assert.equal(result.diagnostics.summaryMergeByIdCount, 3);
  assert.equal(result.diagnostics.summaryMergeHydratedCount, 3);
  assert.equal(result.diagnostics.summaryMergeVisibleCount, 2);
  assert.equal(result.diagnostics.summaryMergeOutputCount, 2);
  assert.ok(result.diagnostics.summaryMergeCachedDisplayMs > 0);
  assert.ok(result.diagnostics.summaryMergeNormalizeMs > 0);
  assert.ok(result.diagnostics.summaryMergeDisplayMergeMs > 0);
  assert.ok(result.diagnostics.summaryMergeHydrateTitleMs > 0);
  assert.ok(result.diagnostics.summaryMergeFinalFilterMs > 0);
  assert.ok(result.diagnostics.summaryMergeSortMs > 0);
  assert.ok(result.diagnostics.summaryMergeTotalMs > 0);
  assert.match(result.diagnostics.summaryMergeDominantStage, /cached_display|normalize|display_merge|hydrate_title|final_filter|sort/);
  const diagnosticText = JSON.stringify(result.diagnostics);
  assert.doesNotMatch(diagnosticText, /privatePrompt|"Hydrated"|"Newer"/);
  assert.doesNotMatch(diagnosticText, /"drop"/);
});

test("thread-list summary merge array wrapper returns only threads", () => {
  const service = createThreadListSummaryMergeService({
    sortThreadListSummaries: (threads) => threads,
  });

  assert.deepEqual(service.mergeThreadSummaryList([{ id: "a" }]), [{ id: "a" }]);
});

test("thread-list summary merge supports request-scoped cached display and title readers", () => {
  let archivedReaderCalls = 0;
  let cachedDisplayReads = 0;
  const cachedDisplayById = new Map([["dup", { id: "dup", name: "Cached", updatedAt: 30 }]]);
  const requestCachedDisplay = new Map();
  const service = createThreadListSummaryMergeService({
    archivedSessionThreadIds() {
      archivedReaderCalls += 1;
      return new Set(["should-not-be-used"]);
    },
    mergeThreadWithCachedDisplaySummary() {
      throw new Error("default cached display reader should not run");
    },
    stripThreadListDetailFields: (thread) => Object.assign({}, thread),
    normalizeThreadSummaryLiveStatus: (thread) => Object.assign({}, thread),
    mergeThreadDisplaySummary: (base, display) => Object.assign({}, base || {}, display || {}),
    hydrateThreadListTitlesFromSessionIndex: (threads, indexEntries) => threads.map((thread) => {
      const entry = indexEntries && indexEntries.get(thread.id);
      return entry && entry.thread_name ? Object.assign({}, thread, { name: entry.thread_name }) : thread;
    }),
    sortThreadListSummaries: (threads) => threads.slice().sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0)),
  });
  const result = service.mergeThreadSummaryListWithDiagnostics([
    { id: "dup", name: "Raw old", updatedAt: 10 },
    { id: "dup", name: "Raw new", updatedAt: 20 },
    { id: "archived", updatedAt: 40 },
    { id: "titled", updatedAt: 15 },
  ], {
    archivedIds: new Set(["archived"]),
    sessionIndexEntries: new Map([["titled", { id: "titled", thread_name: "Hydrated" }]]),
    mergeThreadWithCachedDisplaySummary(thread) {
      const id = String(thread && thread.id || "");
      if (!requestCachedDisplay.has(id)) {
        requestCachedDisplay.set(id, cachedDisplayById.get(id) || null);
        cachedDisplayReads += 1;
      }
      const cached = requestCachedDisplay.get(id);
      return cached ? Object.assign({}, thread, cached) : thread;
    },
  });

  assert.equal(archivedReaderCalls, 0);
  assert.equal(cachedDisplayReads, 2);
  assert.deepEqual(result.threads.map((thread) => thread.id), ["dup", "titled"]);
  assert.equal(result.threads[0].name, "Cached");
  assert.equal(result.threads[0].updatedAt, 30);
  assert.equal(result.threads[1].name, "Hydrated");
  assert.equal(result.diagnostics.summaryMergeArchivedIdSkipCount, 1);
  assert.equal(result.diagnostics.summaryMergeDuplicateIdCount, 1);
});

test("thread-list summary merge dominant stage is bounded", () => {
  assert.equal(dominantTimingStage({
    cached_display: 4,
    display_merge: 12,
    sort: 8,
  }), "display_merge");
  assert.equal(dominantTimingStage({}), "");
});
