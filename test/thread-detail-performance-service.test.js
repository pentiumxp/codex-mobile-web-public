"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  attachThreadDetailDiagnostics,
  buildThreadDetailDiagnostics,
  classifyThreadDetailPhase,
} = require("../adapters/thread-detail-performance-service");

test("thread detail diagnostics classify warm projection and bounded timings", () => {
  const diagnostics = buildThreadDetailDiagnostics({
    requestMode: "recent",
    readMode: "projection-v4-cache",
    summarySource: "state-db+app-server",
    totalMs: 42.4,
    readDecision: "projection-hit",
    projectionState: "hit",
    projectionInputAvailable: true,
    projectionSource: "cache",
    projectionVersion: "v4",
    projectionAgeMs: 123.4,
    rolloutSizeBytes: 2_800_000,
    timings: {
      summaryMs: 3.2,
      projectionMs: 1.1,
      prepareResponseMs: 5.8,
    },
    thread: {
      turns: [{ id: "turn-1" }, { id: "turn-2" }],
      mobileOmittedTurnCount: 128,
    },
  });

  assert.deepEqual(diagnostics, {
    totalMs: 42,
    requestMode: "recent",
    readMode: "projection-v4-cache",
    phase: "warm-projection-cache",
    readDecision: "projection-hit",
    summarySource: "state-db+app-server",
    projectionState: "hit",
    projectionInputAvailable: true,
    projectionSource: "cache",
    projectionVersion: "v4",
    projectionAgeMs: 123,
    projectionSeedStatus: "",
    projectionSeedSource: "",
    returnedTurns: 2,
    omittedTurns: 128,
    rolloutSizeBytes: 2800000,
    largeReadProtected: false,
    largeReadRolloutSizeBytes: 0,
    largeReadThresholdBytes: 0,
    largeReadSource: "",
    largeReadReason: "",
    summaryMs: 3,
    projectionMs: 1,
    turnsListInitialMs: 0,
    turnsListBeforeFullMs: 0,
    threadReadMs: 0,
    rawThreadReadMs: 0,
    turnsListFallbackMs: 0,
    prepareResponseMs: 6,
  });
});

test("thread detail diagnostics expose bounded projection and seed decisions", () => {
  const diagnostics = buildThreadDetailDiagnostics({
    requestMode: "full",
    readMode: "turns-list-large",
    readDecision: "bounded-large-turns-list-extra-detail-that-should-not-grow-with-private-context",
    projectionState: "miss",
    projectionInputAvailable: true,
    projectionSource: "projection",
    projectionVersion: "v4",
    projectionAgeMs: 18.7,
    projectionSeedStatus: "seeded",
    projectionSeedSource: "turns-list-large",
    summarySource: "session-index",
    largeReadProtected: true,
    largeReadRolloutSizeBytes: 12_000_000,
    largeReadThresholdBytes: 8_000_000,
    largeReadSource: "projection",
    largeReadReason: "large-rollout",
    thread: {
      turns: [{ id: "turn-1" }],
      mobileOmittedTurnCount: 99,
    },
  });

  assert.equal(diagnostics.phase, "bounded-large-thread-window");
  assert.equal(diagnostics.readDecision, "bounded-large-turns-list-extra-detail-that-should-not-grow-with-private-context");
  assert.equal(diagnostics.projectionState, "miss");
  assert.equal(diagnostics.projectionInputAvailable, true);
  assert.equal(diagnostics.projectionSource, "projection");
  assert.equal(diagnostics.projectionVersion, "v4");
  assert.equal(diagnostics.projectionAgeMs, 19);
  assert.equal(diagnostics.projectionSeedStatus, "seeded");
  assert.equal(diagnostics.projectionSeedSource, "turns-list-large");
  assert.equal(JSON.stringify(diagnostics).includes("turn-1"), false);
});

test("thread detail diagnostics attach to thread without copying private body content", () => {
  const result = {
    thread: {
      id: "thread-1",
      mobileReadMode: "thread-read",
      turns: [{
        id: "turn-1",
        items: [{ type: "agentMessage", text: "private response body should stay outside diagnostics" }],
      }],
    },
  };

  const returned = attachThreadDetailDiagnostics(result, {
    requestMode: "full",
    timings: { threadReadMs: 25, prepareResponseMs: 2 },
    totalMs: 31,
  });

  assert.equal(returned, result);
  assert.equal(returned.thread.mobileDiagnostics.threadDetailTimings.phase, "cold-thread-read");
  assert.equal(returned.thread.mobileDiagnostics.threadDetailTimings.threadReadMs, 25);
  assert.doesNotMatch(
    JSON.stringify(returned.thread.mobileDiagnostics.threadDetailTimings),
    /private response body/,
  );
});

test("thread detail phase classification distinguishes cold and fallback paths", () => {
  assert.equal(classifyThreadDetailPhase("turns-list-initial"), "cold-turns-list-initial");
  assert.equal(classifyThreadDetailPhase("turns-list-large"), "bounded-large-thread-window");
  assert.equal(classifyThreadDetailPhase("turns-list"), "fallback-turns-list");
  assert.equal(classifyThreadDetailPhase("thread-read-raw"), "cold-thread-read-raw");
  assert.equal(classifyThreadDetailPhase("summary-timeout-fallback"), "fallback-summary");
  assert.equal(classifyThreadDetailPhase("", { cached: true }), "warm-client-current");
});
