"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadListRequestContext,
} = require("../adapters/thread-list-request-context-service");

test("thread-list request context lazily shares archived ids and session index", () => {
  let archivedReads = 0;
  let sessionReads = 0;
  const archivedIds = new Set(["archived"]);
  const indexEntries = new Map([["thread", { id: "thread", thread_name: "Thread" }]]);
  const context = createThreadListRequestContext({
    readArchivedIds() {
      archivedReads += 1;
      return archivedIds;
    },
    readSessionIndexEntries(maxLines, options) {
      sessionReads += 1;
      return new Map([...indexEntries, ["max", { id: String(maxLines), fallback: Boolean(options && options.fallback) }]]);
    },
  });

  assert.deepEqual(context.diagnostics(), {
    requestContextArchivedIdsReadCount: 0,
    requestContextSessionIndexReadCount: 0,
    requestContextRolloutStatReadCount: 0,
  });
  assert.equal(context.archivedIds(), archivedIds);
  assert.equal(context.archivedIds(), archivedIds);
  assert.equal(archivedReads, 1);
  assert.equal(context.sessionIndexEntries(), context.sessionIndexEntries(2000));
  assert.equal(context.sessionIndexEntries(1000), context.sessionIndexEntries(1000));
  assert.equal(sessionReads, 2);
  assert.equal(context.sessionIndexEntries(1000).get("max").id, "1000");
  assert.deepEqual(context.diagnostics(), {
    requestContextArchivedIdsReadCount: 1,
    requestContextSessionIndexReadCount: 2,
    requestContextRolloutStatReadCount: 0,
  });
});

test("thread-list request context caches rollout stats by path", () => {
  let rolloutStatReads = 0;
  const context = createThreadListRequestContext({
    rolloutStatsForPath(rolloutPath) {
      rolloutStatReads += 1;
      if (String(rolloutPath).includes("missing")) return null;
      return { sizeBytes: String(rolloutPath).length, mtimeMs: 1234 };
    },
  });

  assert.equal(context.rolloutStatsForPath(""), null);
  assert.deepEqual(context.rolloutStatsForPath("/tmp/thread-a.jsonl"), { sizeBytes: 19, mtimeMs: 1234 });
  assert.equal(context.rolloutStatsForPath("/tmp/thread-a.jsonl"), context.rolloutStatsForPath("/tmp/thread-a.jsonl"));
  assert.equal(context.rolloutStatsForPath("/tmp/missing.jsonl"), null);
  assert.equal(context.rolloutStatsForPath("/tmp/missing.jsonl"), null);
  assert.equal(rolloutStatReads, 2);
  assert.deepEqual(context.diagnostics(), {
    requestContextArchivedIdsReadCount: 0,
    requestContextSessionIndexReadCount: 0,
    requestContextRolloutStatReadCount: 2,
  });
});

test("thread-list request context caches failed rollout stat reads", () => {
  let rolloutStatReads = 0;
  const context = createThreadListRequestContext({
    rolloutStatsForPath() {
      rolloutStatReads += 1;
      throw new Error("stat failed");
    },
  });

  assert.equal(context.rolloutStatsForPath("/tmp/thread-b.jsonl"), null);
  assert.equal(context.rolloutStatsForPath("/tmp/thread-b.jsonl"), null);
  assert.equal(rolloutStatReads, 1);
  assert.equal(context.diagnostics().requestContextRolloutStatReadCount, 1);
});

test("thread-list request context bounds diagnostics and normalizes bad readers", () => {
  const context = createThreadListRequestContext({
    readArchivedIds: () => null,
    readSessionIndexEntries: () => null,
  });

  assert.ok(context.archivedIds() instanceof Set);
  assert.equal(context.archivedIds().size, 0);
  assert.equal(context.sessionIndexEntries(0), null);
  assert.deepEqual(context.diagnostics(), {
    requestContextArchivedIdsReadCount: 1,
    requestContextSessionIndexReadCount: 1,
    requestContextRolloutStatReadCount: 0,
  });
});
