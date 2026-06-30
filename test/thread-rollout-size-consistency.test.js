"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadDetailResponsePreparationService,
} = require("../adapters/thread-detail-response-preparation-service");
const {
  createThreadSummaryStateService,
} = require("../adapters/thread-summary-state-service");

test("display summary merge preserves fresh rollout metadata over stale projection metadata", () => {
  const service = createThreadSummaryStateService({
    annotateThreadRolloutStats: (thread) => thread,
    normalizeStaleContextOnlyActiveThread: (thread) => thread,
    threadListSummaryTimestampMs(thread) {
      return Number(thread && thread.rolloutSizeUpdatedAtMs || 0);
    },
  });

  const merged = service.mergeThreadDisplaySummary({
    id: "thread-1",
    name: "Cached projection",
    path: "/tmp/stale-rollout.jsonl",
    rolloutSizeBytes: 9_102_421,
    rolloutSizeUpdatedAtMs: 100,
  }, {
    id: "thread-1",
    name: "Current summary",
    path: "/tmp/current-rollout.jsonl",
    rolloutSizeBytes: 36_525_689,
    rolloutSizeUpdatedAtMs: 200,
    rolloutWarningThresholdBytes: 8_000_000,
    rolloutOverWarningThreshold: true,
  });

  assert.equal(merged.name, "Current summary");
  assert.equal(merged.path, "/tmp/current-rollout.jsonl");
  assert.equal(merged.rolloutSizeBytes, 36_525_689);
  assert.equal(merged.rolloutSizeUpdatedAtMs, 200);
  assert.equal(merged.rolloutWarningThresholdBytes, 8_000_000);
  assert.equal(merged.rolloutOverWarningThreshold, true);
});

test("thread detail rollout size prefers current file stat over stale thread field", () => {
  const service = createThreadDetailResponsePreparationService({
    rolloutPathForThread: (thread) => thread && thread.path,
    rolloutStatsForPath: (rolloutPath) => rolloutPath
      ? { sizeBytes: 36_525_689, mtimeMs: 200 }
      : null,
  });

  assert.equal(service.threadRolloutSizeBytes({
    id: "thread-1",
    path: "/tmp/current-rollout.jsonl",
    rolloutSizeBytes: 9_102_421,
  }), 36_525_689);
  assert.equal(service.threadRolloutSizeBytes({
    id: "thread-2",
    rolloutSizeBytes: 9_102_421,
  }), 9_102_421);
});
