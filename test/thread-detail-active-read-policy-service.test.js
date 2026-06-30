"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  activeFullThreadReadReason,
  applyActiveThreadPolicyToBoundedReadDecision,
  isActiveLikeStatus,
  planActiveThreadDetailReadPolicy,
  statusText,
  summaryActiveTurnId,
} = require("../services/thread-detail/thread-detail-active-read-policy-service");
const adapter = require("../adapters/thread-detail-active-read-policy-service");

test("active detail read policy adapter re-exports canonical service", () => {
  assert.equal(adapter.planActiveThreadDetailReadPolicy, planActiveThreadDetailReadPolicy);
  assert.equal(adapter.activeFullThreadReadReason, activeFullThreadReadReason);
});

test("active detail read policy allows recent partial reads for idle summaries", () => {
  const policy = planActiveThreadDetailReadPolicy({
    preferRecentTurns: true,
    summary: {
      id: "thread-1",
      status: { type: "idle" },
    },
  });

  assert.deepEqual(policy, {
    activeFullReadRequired: false,
    activeFullReadReason: "",
    allowPartialProjection: true,
    shouldUseInitialTurnsList: true,
    initialTurnsListSkipReason: "",
  });
});

test("active detail read policy requires full read for active turn ids", () => {
  const summary = {
    id: "thread-1",
    status: { type: "idle" },
    activeTurnId: "private-turn-id",
  };
  const policy = planActiveThreadDetailReadPolicy({ preferRecentTurns: true, summary });

  assert.equal(summaryActiveTurnId(summary), "private-turn-id");
  assert.equal(activeFullThreadReadReason(summary), "active-turn-id");
  assert.equal(policy.activeFullReadRequired, true);
  assert.equal(policy.activeFullReadReason, "active-turn-id");
  assert.equal(policy.allowPartialProjection, false);
  assert.equal(policy.shouldUseInitialTurnsList, false);
  assert.equal(policy.initialTurnsListSkipReason, "active-thread-requires-full-read");
  assert.doesNotMatch(JSON.stringify(policy), /private-turn-id/);
});

test("active detail read policy recognizes bounded active status sources", () => {
  assert.equal(statusText({ type: "running" }), "running");
  assert.equal(isActiveLikeStatus({ type: "running" }), true);
  assert.equal(isActiveLikeStatus("in_progress"), true);
  assert.equal(isActiveLikeStatus({ type: "systemError" }), false);

  assert.equal(activeFullThreadReadReason({ status: { type: "running" } }), "status-active");
  assert.equal(activeFullThreadReadReason({ mobileStatus: { type: "processing" } }), "mobile-status-active");
  assert.equal(
    activeFullThreadReadReason({ mobileLocalActiveStatus: { status: { type: "queued" } } }),
    "local-active-status",
  );
});

test("active detail read policy only allows partial projection in recent mode", () => {
  const policy = planActiveThreadDetailReadPolicy({
    preferRecentTurns: false,
    summary: {
      id: "thread-1",
      status: { type: "idle" },
    },
  });

  assert.equal(policy.activeFullReadRequired, false);
  assert.equal(policy.allowPartialProjection, false);
  assert.equal(policy.shouldUseInitialTurnsList, false);
});

test("active detail read policy suppresses bounded large reads for active summaries", () => {
  const activePolicy = planActiveThreadDetailReadPolicy({
    preferRecentTurns: true,
    summary: { status: { type: "active" } },
  });
  const suppressed = applyActiveThreadPolicyToBoundedReadDecision({
    prefer: true,
    rolloutSizeBytes: 12_000_000,
    thresholdBytes: 8_000_000,
    source: "summary",
    reason: "large-rollout",
  }, activePolicy);

  assert.deepEqual(suppressed, {
    prefer: false,
    rolloutSizeBytes: 12_000_000,
    thresholdBytes: 8_000_000,
    source: "summary",
    reason: "active-thread-requires-full-read",
  });

  const idlePolicy = planActiveThreadDetailReadPolicy({
    preferRecentTurns: true,
    summary: { status: { type: "idle" } },
  });
  const original = {
    prefer: true,
    rolloutSizeBytes: 12_000_000,
    thresholdBytes: 8_000_000,
    source: "summary",
    reason: "large-rollout",
  };
  assert.equal(applyActiveThreadPolicyToBoundedReadDecision(original, idlePolicy), original);
});
