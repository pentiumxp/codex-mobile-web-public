"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  classifyPhaseBReadback,
} = require("../adapters/phase-b-readback-decision-service");

test("phase B readback decision blocks on missing readback contract fields", () => {
  const decision = classifyPhaseBReadback({
    failure: "threadListColdPath",
    threadList: { timingsPresent: true },
  });

  assert.equal(decision.status, "blocked");
  assert.equal(decision.priority, "H2");
  assert.equal(decision.owner, "readback-contract");
  assert.equal(decision.nextAction, "repair-phase-b-readback-contract");
});

test("phase B readback decision prioritizes active overlay gaps", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    threadList: {
      coldPathOwner: "warm-fallback-cache",
      coldPathReason: "cache-hit",
    },
    detail: {
      readMode: "thread-read",
      readDecision: "full-thread-read",
      coldPathOwner: "active-read-policy",
      coldPathReason: "active-turn-id",
      activeFullReadRequired: true,
      activeOverlayGateReason: "missing-active-turn-id",
      activeOverlayNextAction: "retain-active-turn-id",
    },
  });

  assert.equal(decision.status, "needs_repair");
  assert.equal(decision.priority, "H1");
  assert.equal(decision.owner, "active-overlay");
  assert.equal(decision.reason, "missing-active-turn-id");
  assert.equal(decision.nextAction, "retain-active-turn-id");
  assert.equal(decision.evidence.detailActiveOverlayGateReason, "missing-active-turn-id");
});

test("phase B readback decision classifies projection cache lifecycle work", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    detail: {
      readMode: "turns-list-large",
      readDecision: "bounded-large-turns-list",
      coldPathOwner: "projection-cache",
      coldPathReason: "projection-miss:static-signature-mismatch",
      projectionState: "miss",
    },
  });

  assert.equal(decision.status, "needs_repair");
  assert.equal(decision.owner, "projection-cache");
  assert.equal(decision.nextAction, "repair-projection-cache-lifecycle");
  assert.equal(decision.evidence.detailProjectionState, "miss");
});

test("phase B readback decision classifies thread-list fallback baseline work", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    threadList: {
      coldPathOwner: "fallback-baseline",
      coldPathReason: "miss-rebuild:rollout",
      fallbackCacheDecision: "miss-rebuild",
      resultCount: 10,
    },
    detail: {
      readMode: "projection-v4-cache",
      readDecision: "projection-hit",
      coldPathOwner: "warm-path",
      coldPathReason: "warm-projection-cache",
    },
  });

  assert.equal(decision.status, "needs_repair");
  assert.equal(decision.owner, "thread-list-fallback-baseline");
  assert.equal(decision.nextAction, "optimize-thread-list-fallback-baseline");
  assert.equal(decision.evidence.threadListReason, "miss-rebuild:rollout");
});

test("phase B readback decision returns ready for warm or bounded paths", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    threadList: {
      coldPathOwner: "warm-fallback-cache",
      coldPathReason: "cache-hit-incremental",
    },
    detail: {
      readMode: "projection-active-overlay",
      readDecision: "projection-active-overlay",
      coldPathOwner: "warm-path",
      coldPathReason: "warm-projection-active-overlay",
    },
  });

  assert.equal(decision.status, "ready");
  assert.equal(decision.owner, "phase-b-readback");
  assert.equal(decision.nextAction, "proceed-to-next-phase-b-root-cause-target");
});

test("phase B readback decision treats source snapshot hits as ready evidence", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    threadList: {
      coldPathOwner: "fallback-source-snapshot",
      coldPathReason: "source-snapshot-hit",
      fallbackSourceSnapshotHit: true,
      fallbackSourceSnapshotRawCount: 12,
    },
    detail: {
      readMode: "projection-v4-cache",
      readDecision: "projection-hit",
      coldPathOwner: "warm-path",
      coldPathReason: "warm-projection-cache",
    },
  });

  assert.equal(decision.status, "ready");
  assert.equal(decision.owner, "phase-b-readback");
  assert.equal(decision.evidence.threadListSourceSnapshotHit, true);
  assert.equal(decision.evidence.threadListSourceSnapshotRawCount, 12);
});

test("phase B readback decision keeps evidence bounded and private-content free", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    privatePrompt: "do not copy this prompt",
    threadList: {
      coldPathOwner: "fallback-baseline",
      coldPathReason: `miss-rebuild:${"x".repeat(200)}`,
      fallbackCacheDecision: "miss-rebuild",
      privateTitle: "do not copy",
    },
    detail: {
      coldPathOwner: "projection-cache",
      coldPathReason: `projection-miss:${"y".repeat(200)}`,
      privateMessage: "do not copy",
    },
  });

  assert.ok(decision.evidence.threadListReason.length <= 80);
  assert.ok(decision.evidence.detailReason.length <= 80);
  assert.doesNotMatch(JSON.stringify(decision), /private|prompt|message|do not copy/i);
});
