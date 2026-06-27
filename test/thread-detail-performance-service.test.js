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
    projectionMissReason: "",
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
    projectionMissReason: "",
    projectionSeedStatus: "",
    projectionSeedSource: "",
    activeFullReadRequired: false,
    activeFullReadReason: "",
    activeOverlayAction: "",
    activeOverlayReason: "",
    activeOverlaySource: "",
    activeOverlayItems: 0,
    activeOverlayOperationItems: 0,
    activeOverlayUploadItems: 0,
    activeOverlayAssistantItems: 0,
    activeOverlayReceiptItems: 0,
    returnedTurns: 2,
    omittedTurns: 128,
    rolloutSizeBytes: 2800000,
    largeReadProtected: false,
    largeReadRolloutSizeBytes: 0,
    largeReadThresholdBytes: 0,
    largeReadSource: "",
    largeReadReason: "",
    coldPathOwner: "warm-path",
    coldPathReason: "warm-projection-cache",
    summaryMs: 3,
    projectionMs: 1,
    turnsListInitialMs: 0,
    turnsListBeforeFullMs: 0,
    threadReadMs: 0,
    rawThreadReadMs: 0,
    turnsListFallbackMs: 0,
    prepareResponseMs: 6,
    activeOverlayMs: 0,
    activeOverlayResolveMs: 0,
    activeOverlayProjectionLookupMs: 0,
    activeOverlayPlanMs: 0,
    activeOverlayWindowMs: 0,
    activeOverlayMergeMs: 0,
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
    projectionMissReason: "static-signature-mismatch-extra-detail-that-should-not-grow-with-private-context",
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
  assert.equal(diagnostics.projectionMissReason, "static-signature-mismatch-extra-detail-that-should-not-grow-with-private-context");
  assert.equal(diagnostics.projectionSeedStatus, "seeded");
  assert.equal(diagnostics.projectionSeedSource, "turns-list-large");
  assert.equal(diagnostics.coldPathOwner, "projection-cache");
  assert.equal(diagnostics.coldPathReason, "projection-miss:static-signature-mismatch-extra-detail-that-should-not-grow-with");
  assert.equal(JSON.stringify(diagnostics).includes("turn-1"), false);
});

test("thread detail phase classification uses bounded read decisions without read mode", () => {
  assert.equal(
    classifyThreadDetailPhase("", { readDecision: "projection-hit", projectionSource: "cache" }),
    "warm-projection-cache",
  );
  assert.equal(
    classifyThreadDetailPhase("", { readDecision: "projection-hit", projectionSource: "dynamic" }),
    "warm-projection-dynamic",
  );
  assert.equal(
    classifyThreadDetailPhase("", { projectionState: "hit", projectionSource: "cache" }),
    "warm-projection-cache",
  );
  assert.equal(
    classifyThreadDetailPhase("", { readDecision: "projection-partial-hit" }),
    "warm-projection-partial",
  );
  assert.equal(
    classifyThreadDetailPhase("", { readDecision: "projection-active-overlay" }),
    "warm-projection-active-overlay",
  );
  assert.equal(
    classifyThreadDetailPhase("", {
      readDecision: "initial-turns-list",
      projectionSeedStatus: "seeded-partial",
    }),
    "cold-turns-list-initial-seeded-partial",
  );
  assert.equal(
    classifyThreadDetailPhase("", { readDecision: "raw-thread-read" }),
    "cold-thread-read-raw",
  );
  assert.equal(
    classifyThreadDetailPhase("", { readDecision: "full-thread-read" }),
    "cold-thread-read",
  );
  assert.equal(
    classifyThreadDetailPhase("", { readDecision: "fallback-turns-list" }),
    "fallback-turns-list",
  );
  assert.equal(
    classifyThreadDetailPhase("", { readDecision: "summary-fallback" }),
    "fallback-summary",
  );
});

test("thread detail diagnostics classify seeded initial windows without leaking private items", () => {
  const diagnostics = buildThreadDetailDiagnostics({
    requestMode: "recent",
    readMode: "",
    readDecision: "initial-turns-list",
    projectionSeedStatus: "seeded-partial",
    projectionSeedSource: "turns-list-initial",
    thread: {
      turns: [{
        id: "private-turn-id",
        items: [{ type: "agentMessage", text: "private response body" }],
      }],
    },
  });

  assert.equal(diagnostics.phase, "cold-turns-list-initial-seeded-partial");
  assert.equal(diagnostics.readDecision, "initial-turns-list");
  assert.equal(diagnostics.projectionSeedStatus, "seeded-partial");
  assert.equal(diagnostics.projectionSeedSource, "turns-list-initial");
  assert.equal(diagnostics.coldPathOwner, "projection-cache");
  assert.equal(diagnostics.coldPathReason, "seeded-partial-current-window");
  assert.equal(diagnostics.returnedTurns, 1);
  assert.doesNotMatch(JSON.stringify(diagnostics), /private-turn-id|private response body/);
});

test("thread detail diagnostics expose bounded active full-read reasons", () => {
  const diagnostics = buildThreadDetailDiagnostics({
    requestMode: "recent",
    readMode: "thread-read",
    readDecision: "full-thread-read",
    activeFullReadRequired: true,
    activeFullReadReason: "active-turn-id-extra-detail-that-should-be-bounded",
    thread: {
      turns: [{
        id: "private-active-turn-id",
        items: [{ type: "operation", text: "private command output" }],
      }],
    },
  });

  assert.equal(diagnostics.phase, "cold-thread-read");
  assert.equal(diagnostics.activeFullReadRequired, true);
  assert.equal(diagnostics.activeFullReadReason, "active-turn-id-extra-detail-that-should-be-bounded");
  assert.equal(diagnostics.coldPathOwner, "active-read-policy");
  assert.equal(diagnostics.coldPathReason, "active-turn-id-extra-detail-that-should-be-bounded");
  assert.doesNotMatch(JSON.stringify(diagnostics), /private-active-turn-id|private command output/);
});

test("thread detail diagnostics expose bounded active overlay evidence", () => {
  const diagnostics = buildThreadDetailDiagnostics({
    requestMode: "recent",
    readMode: "projection-active-overlay",
    readDecision: "projection-active-overlay",
    projectionState: "hit",
    projectionInputAvailable: true,
    projectionSource: "partial",
    projectionVersion: "v4",
    activeFullReadRequired: true,
    activeFullReadReason: "active-turn-id",
    activeOverlayAction: "use-projection-overlay",
    activeOverlayReason: "overlay-evidence-complete-private-detail-that-should-be-bounded",
    activeOverlaySource: "app-server-notification",
    activeOverlayItems: 4,
    activeOverlayOperationItems: 1,
    activeOverlayUploadItems: 1,
    activeOverlayAssistantItems: 1,
    activeOverlayReceiptItems: 1,
    timings: {
      activeOverlayMs: 9.6,
      activeOverlayResolveMs: 3.2,
      activeOverlayProjectionLookupMs: 1.4,
      activeOverlayPlanMs: 0.6,
      activeOverlayWindowMs: 0,
      activeOverlayMergeMs: 4.1,
    },
    thread: {
      turns: [{
        id: "private-active-turn-id",
        items: [{ type: "agentMessage", text: "private response body" }],
      }],
    },
  });

  assert.equal(diagnostics.phase, "warm-projection-active-overlay");
  assert.equal(diagnostics.activeOverlayAction, "use-projection-overlay");
  assert.equal(diagnostics.activeOverlayReason, "overlay-evidence-complete-private-detail-that-should-be-bounded");
  assert.equal(diagnostics.activeOverlaySource, "app-server-notification");
  assert.equal(diagnostics.activeOverlayItems, 4);
  assert.equal(diagnostics.activeOverlayOperationItems, 1);
  assert.equal(diagnostics.activeOverlayUploadItems, 1);
  assert.equal(diagnostics.activeOverlayAssistantItems, 1);
  assert.equal(diagnostics.activeOverlayReceiptItems, 1);
  assert.equal(diagnostics.activeOverlayMs, 10);
  assert.equal(diagnostics.activeOverlayResolveMs, 3);
  assert.equal(diagnostics.activeOverlayProjectionLookupMs, 1);
  assert.equal(diagnostics.activeOverlayPlanMs, 1);
  assert.equal(diagnostics.activeOverlayWindowMs, 0);
  assert.equal(diagnostics.activeOverlayMergeMs, 4);
  assert.equal(diagnostics.coldPathOwner, "warm-path");
  assert.doesNotMatch(JSON.stringify(diagnostics), /private-active-turn-id|private response body/);
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
  assert.equal(returned.thread.mobileDiagnostics.threadDetailTimings.coldPathOwner, "projection-input");
  assert.equal(returned.thread.mobileDiagnostics.threadDetailTimings.coldPathReason, "projection-input-unavailable");
  assert.equal(returned.thread.mobileDiagnostics.threadDetailTimings.threadReadMs, 25);
  assert.doesNotMatch(
    JSON.stringify(returned.thread.mobileDiagnostics.threadDetailTimings),
    /private response body/,
  );
});

test("thread detail phase classification distinguishes cold and fallback paths", () => {
  assert.equal(classifyThreadDetailPhase("turns-list-initial"), "cold-turns-list-initial");
  assert.equal(classifyThreadDetailPhase("turns-list-large"), "bounded-large-thread-window");
  assert.equal(classifyThreadDetailPhase("projection-v4-partial"), "warm-projection-partial");
  assert.equal(classifyThreadDetailPhase("projection-active-overlay"), "warm-projection-active-overlay");
  assert.equal(classifyThreadDetailPhase("turns-list"), "fallback-turns-list");
  assert.equal(classifyThreadDetailPhase("thread-read-raw"), "cold-thread-read-raw");
  assert.equal(classifyThreadDetailPhase("summary-timeout-fallback"), "fallback-summary");
  assert.equal(classifyThreadDetailPhase("", { cached: true }), "warm-client-current");
});
