"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadDetailProjectionInputService,
  rolloutPathForThread,
  summaryUpdatedAtMs,
  timestampToMs,
} = require("../adapters/thread-detail-projection-input-service");

test("projection input returns null without a thread id, rollout path, or stats", () => {
  const service = createThreadDetailProjectionInputService({
    maxTurns: 10,
    rolloutStatsForPath(file) {
      return file ? { sizeBytes: 12, mtimeMs: 34 } : null;
    },
  });

  assert.equal(service.projectionInput("", { rolloutPath: "/tmp/rollout.jsonl" }), null);
  assert.equal(service.projectionInput("thread-1", {}), null);
  assert.equal(createThreadDetailProjectionInputService({
    maxTurns: 10,
    rolloutStatsForPath() {
      return null;
    },
  }).projectionInput("thread-1", { rolloutPath: "/tmp/rollout.jsonl" }), null);
});

test("projection input preserves the cache signature fields used by projection get and seed", () => {
  const service = createThreadDetailProjectionInputService({
    maxTurns: 25,
    rolloutStatsForPath(file) {
      assert.equal(file, "/tmp/rollout.jsonl");
      return {
        sizeBytes: 1200,
        mtimeMs: 456000,
        overWarningThreshold: false,
      };
    },
  });

  assert.deepEqual(service.projectionInput("thread-1", {
    rollout_path: "/tmp/rollout.jsonl",
    updated_at: "2026-06-24T01:02:03.000Z",
    status: { type: "active" },
  }), {
    threadId: "thread-1",
    rolloutPath: "/tmp/rollout.jsonl",
    rolloutStats: {
      sizeBytes: 1200,
      mtimeMs: 456000,
      overWarningThreshold: false,
    },
    maxTurns: 25,
    summaryUpdatedAtMs: Date.parse("2026-06-24T01:02:03.000Z"),
    summaryStatus: "active",
  });
});

test("rolloutPathForThread accepts all server summary rollout path aliases", () => {
  assert.equal(rolloutPathForThread({ path: "/tmp/a.jsonl" }), "/tmp/a.jsonl");
  assert.equal(rolloutPathForThread({ rolloutPath: "/tmp/b.jsonl" }), "/tmp/b.jsonl");
  assert.equal(rolloutPathForThread({ rollout_path: "/tmp/c.jsonl" }), "/tmp/c.jsonl");
  assert.equal(rolloutPathForThread(null), "");
});

test("summaryUpdatedAtMs accepts seconds, milliseconds, and date strings", () => {
  assert.equal(timestampToMs(100), 100000);
  assert.equal(timestampToMs("100"), 100000);
  assert.equal(timestampToMs(1782240000000), 1782240000000);
  assert.equal(summaryUpdatedAtMs({ updatedAt: 100 }), 100000);
  assert.equal(summaryUpdatedAtMs({ updated_at_ms: 1782240000000 }), 1782240000000);
  assert.equal(summaryUpdatedAtMs({ updated_at: "2026-06-24T01:02:03.000Z" }), Date.parse("2026-06-24T01:02:03.000Z"));
  assert.equal(summaryUpdatedAtMs({}), 0);
});
