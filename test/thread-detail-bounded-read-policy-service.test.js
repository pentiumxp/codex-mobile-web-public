"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadDetailBoundedReadPolicyService,
  decideThreadDetailBoundedReadBeforeFullRead,
} = require("../services/thread-detail/thread-detail-bounded-read-policy-service");
const adapter = require("../adapters/thread-detail-bounded-read-policy-service");

test("bounded read policy adapter re-exports canonical service", () => {
  assert.equal(adapter.createThreadDetailBoundedReadPolicyService, createThreadDetailBoundedReadPolicyService);
  assert.equal(adapter.decideThreadDetailBoundedReadBeforeFullRead, decideThreadDetailBoundedReadBeforeFullRead);
});

test("bounded read policy is disabled when threshold is zero", () => {
  let summaryCalls = 0;
  const decision = decideThreadDetailBoundedReadBeforeFullRead({
    thresholdBytes: 0,
    summary: { rolloutSizeBytes: 20_000_000 },
    projection: { rolloutStats: { sizeBytes: 30_000_000 } },
    threadRolloutSizeBytes: () => {
      summaryCalls += 1;
      return 20_000_000;
    },
  });

  assert.deepEqual(decision, {
    prefer: false,
    thresholdBytes: 0,
    reason: "disabled",
  });
  assert.equal(summaryCalls, 0);
});

test("bounded read policy prefers projection rollout stats over summary", () => {
  let summaryCalls = 0;
  const decision = decideThreadDetailBoundedReadBeforeFullRead({
    thresholdBytes: 8_000_000,
    summary: { rolloutSizeBytes: 1_000_000 },
    projection: { rolloutStats: { sizeBytes: 12_000_000 } },
    threadRolloutSizeBytes: () => {
      summaryCalls += 1;
      return 1_000_000;
    },
  });

  assert.deepEqual(decision, {
    prefer: true,
    rolloutSizeBytes: 12_000_000,
    thresholdBytes: 8_000_000,
    source: "projection",
    reason: "large-rollout",
  });
  assert.equal(summaryCalls, 0);
});

test("bounded read policy accepts projection stats.size fallback", () => {
  const decision = decideThreadDetailBoundedReadBeforeFullRead({
    thresholdBytes: 8_000_000,
    projection: { rolloutStats: { size: 4_000_000 } },
    threadRolloutSizeBytes: () => 20_000_000,
  });

  assert.deepEqual(decision, {
    prefer: false,
    rolloutSizeBytes: 4_000_000,
    thresholdBytes: 8_000_000,
    source: "projection",
    reason: "below-threshold",
  });
});

test("bounded read policy does not fall back to summary when projection has a positive size below threshold", () => {
  let summaryCalls = 0;
  const decision = decideThreadDetailBoundedReadBeforeFullRead({
    thresholdBytes: 8_000_000,
    summary: { rolloutSizeBytes: 20_000_000 },
    projection: { rolloutStats: { sizeBytes: 4_000_000 } },
    threadRolloutSizeBytes: () => {
      summaryCalls += 1;
      return 20_000_000;
    },
  });

  assert.deepEqual(decision, {
    prefer: false,
    rolloutSizeBytes: 4_000_000,
    thresholdBytes: 8_000_000,
    source: "projection",
    reason: "below-threshold",
  });
  assert.equal(summaryCalls, 0);
});

test("bounded read policy treats size equal to threshold as large", () => {
  const decision = decideThreadDetailBoundedReadBeforeFullRead({
    thresholdBytes: 8_000_000,
    projection: { rolloutStats: { sizeBytes: 8_000_000 } },
    threadRolloutSizeBytes: () => 0,
  });

  assert.deepEqual(decision, {
    prefer: true,
    rolloutSizeBytes: 8_000_000,
    thresholdBytes: 8_000_000,
    source: "projection",
    reason: "large-rollout",
  });
});

test("bounded read policy preserves invalid threshold semantics from the route gate", () => {
  const decision = decideThreadDetailBoundedReadBeforeFullRead({
    thresholdBytes: Number.NaN,
    projection: { rolloutStats: { sizeBytes: 8_000_000 } },
    threadRolloutSizeBytes: () => 0,
  });

  assert.equal(decision.prefer, false);
  assert.equal(decision.rolloutSizeBytes, 8_000_000);
  assert.equal(decision.source, "projection");
  assert.equal(decision.reason, "below-threshold");
  assert.equal(Number.isNaN(decision.thresholdBytes), true);
});

test("bounded read policy falls back to summary rollout size when projection size is unavailable", () => {
  const decision = decideThreadDetailBoundedReadBeforeFullRead({
    thresholdBytes: 8_000_000,
    summary: { id: "thread-1" },
    projection: { rolloutStats: { sizeBytes: 0 } },
    threadRolloutSizeBytes: (summary) => summary && summary.id === "thread-1" ? 10_000_000 : 0,
  });

  assert.deepEqual(decision, {
    prefer: true,
    rolloutSizeBytes: 10_000_000,
    thresholdBytes: 8_000_000,
    source: "summary",
    reason: "large-rollout",
  });
});

test("bounded read policy reports missing rollout size without forcing bounded read", () => {
  const decision = decideThreadDetailBoundedReadBeforeFullRead({
    thresholdBytes: 8_000_000,
    summary: { id: "thread-1" },
    projection: { rolloutStats: { sizeBytes: "not-a-number" } },
    threadRolloutSizeBytes: () => 0,
  });

  assert.deepEqual(decision, {
    prefer: false,
    thresholdBytes: 8_000_000,
    reason: "no-rollout-size",
  });
});

test("bounded read policy service reuses configured threshold and summary size resolver", () => {
  const service = createThreadDetailBoundedReadPolicyService({
    thresholdBytes: 8_000_000,
    threadRolloutSizeBytes: (summary) => Number(summary && summary.rolloutSizeBytes || 0),
  });

  assert.deepEqual(service.preferBoundedReadBeforeFullRead({
    summary: { rolloutSizeBytes: 2_000_000 },
    projection: null,
  }), {
    prefer: false,
    rolloutSizeBytes: 2_000_000,
    thresholdBytes: 8_000_000,
    source: "summary",
    reason: "below-threshold",
  });
});
