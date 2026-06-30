"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  diagnoseThreadDetailColdPath,
} = require("../services/thread-detail/thread-detail-cold-path-diagnosis-service");
const adapter = require("../adapters/thread-detail-cold-path-diagnosis-service");

test("cold path diagnosis adapter re-exports canonical service", () => {
  assert.equal(adapter.diagnoseThreadDetailColdPath, diagnoseThreadDetailColdPath);
});

test("cold path diagnosis classifies warm projection paths", () => {
  assert.deepEqual(diagnoseThreadDetailColdPath({
    phase: "warm-projection-cache",
    readDecision: "projection-hit",
    projectionState: "hit",
    projectionSource: "cache",
  }), {
    owner: "warm-path",
    reason: "warm-projection-cache",
  });

  assert.deepEqual(diagnoseThreadDetailColdPath({
    readDecision: "projection-partial-hit",
    projectionSource: "partial",
  }), {
    owner: "warm-path",
    reason: "projection-partial-hit",
  });
});

test("cold path diagnosis attributes active full reads to active policy", () => {
  assert.deepEqual(diagnoseThreadDetailColdPath({
    readDecision: "full-thread-read",
    activeFullReadRequired: true,
    activeFullReadReason: "active-turn-id",
    largeReadReason: "active-thread-requires-full-read",
  }), {
    owner: "active-read-policy",
    reason: "active-turn-id",
  });
});

test("cold path diagnosis attributes current-window seeding to projection cache", () => {
  assert.deepEqual(diagnoseThreadDetailColdPath({
    readDecision: "initial-turns-list",
    projectionInputAvailable: true,
    projectionSeedStatus: "seeded-partial",
    projectionSeedSource: "turns-list-initial",
  }), {
    owner: "projection-cache",
    reason: "seeded-partial-current-window",
  });
});

test("cold path diagnosis attributes large summary windows to summary evidence", () => {
  assert.deepEqual(diagnoseThreadDetailColdPath({
    readDecision: "bounded-large-turns-list",
    projectionInputAvailable: false,
    projectionState: "unavailable",
    largeReadSource: "summary",
    largeReadReason: "large-rollout",
  }), {
    owner: "summary",
    reason: "summary:large-rollout",
  });
});

test("cold path diagnosis attributes stale projection cache misses", () => {
  assert.deepEqual(diagnoseThreadDetailColdPath({
    readDecision: "full-thread-read",
    projectionInputAvailable: true,
    projectionState: "miss",
    projectionMissReason: "static-signature-mismatch",
  }), {
    owner: "projection-cache",
    reason: "projection-miss:static-signature-mismatch",
  });

  assert.deepEqual(diagnoseThreadDetailColdPath({
    readDecision: "bounded-large-turns-list",
    projectionInputAvailable: true,
    projectionState: "miss",
    projectionMissReason: "entry-missing",
  }), {
    owner: "projection-cache",
    reason: "projection-miss:entry-missing",
  });
});

test("cold path diagnosis attributes missing projection input and app-server fallbacks", () => {
  assert.deepEqual(diagnoseThreadDetailColdPath({
    readDecision: "full-thread-read",
    projectionInputAvailable: false,
    projectionState: "unavailable",
    largeReadReason: "below-threshold",
  }), {
    owner: "projection-input",
    reason: "projection-input-unavailable:below-threshold",
  });

  assert.deepEqual(diagnoseThreadDetailColdPath({
    readDecision: "fallback-turns-list",
    readMode: "turns-list",
  }), {
    owner: "app-server-turns-list",
    reason: "thread-read-fallback",
  });

  assert.deepEqual(diagnoseThreadDetailColdPath({
    readDecision: "summary-fallback",
    readMode: "summary-timeout-fallback",
  }), {
    owner: "app-server-fallback",
    reason: "summary-timeout-fallback",
  });
});

test("cold path diagnosis stays bounded and does not copy private content", () => {
  const diagnosis = diagnoseThreadDetailColdPath({
    readDecision: "full-thread-read",
    projectionInputAvailable: true,
    projectionState: "miss",
    projectionMissReason: `static-signature-mismatch-${"x".repeat(200)}`,
    privatePrompt: "do not copy this private prompt",
  });

  assert.equal(diagnosis.owner, "projection-cache");
  assert.ok(diagnosis.reason.length <= 80);
  assert.doesNotMatch(JSON.stringify(diagnosis), /private prompt/);
});
