"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const metrics = require(path.resolve(__dirname, "..", "public", "thread-performance-metrics.js"));

test("thread performance metrics extract detail server timings for client events", () => {
  const fields = metrics.threadDetailEventFields({
    mobileDiagnostics: {
      threadDetailTimings: {
        phase: "warm-projection-cache",
        totalMs: 8,
        projectionMs: 1,
      },
    },
  });

  assert.deepEqual(fields, {
    serverTimings: {
      phase: "warm-projection-cache",
      totalMs: 8,
      projectionMs: 1,
    },
    performancePhase: "warm-projection-cache",
    detailShape: {
      turns: 0,
      omittedTurns: 0,
      items: 0,
      visibleItems: 0,
      userItems: 0,
      receiptItems: 0,
      imageItems: 0,
      operationItems: 0,
      usageItems: 0,
      diagnosticItems: 0,
      completedTurns: 0,
      activeTurns: 0,
    },
  });
});

test("thread performance metrics classify thread list cold, warm, and deferred phases", () => {
  assert.equal(metrics.classifyThreadListPhase({ fallbackDeferred: true }), "deferred-fallback");
  assert.equal(metrics.classifyThreadListPhase({ appServerDeferred: true, fallbackCacheHit: true }), "warm-fallback-initial");
  assert.equal(metrics.classifyThreadListPhase({ fallbackCacheHit: true }), "warm-fallback-cache");
  assert.equal(metrics.classifyThreadListPhase({ fallbackCacheDecision: "hit" }), "warm-fallback-cache");
  assert.equal(metrics.classifyThreadListPhase({ fallbackCacheDecision: "expired-rebuild", fallbackMs: 25 }), "cold-fallback-expired-rebuild");
  assert.equal(metrics.classifyThreadListPhase({ fallbackCacheDecision: "miss-rebuild", fallbackMs: 25 }), "cold-fallback-miss-build");
  assert.equal(metrics.classifyThreadListPhase({ fallbackMs: 25 }), "cold-fallback-build");
  assert.equal(metrics.classifyThreadListPhase({ appServerMs: 3, fallbackMs: 0 }), "app-server-only");
  assert.equal(metrics.classifyThreadListPhase(null), "unknown");
});

test("thread performance metrics classify thread detail cold and warm phases from bounded fields", () => {
  assert.equal(metrics.classifyThreadDetailPhase({ phase: "warm-projection-cache" }), "warm-projection-cache");
  assert.equal(metrics.classifyThreadDetailPhase({ phase: "unknown", readDecision: "projection-hit", projectionSource: "cache" }), "warm-projection-cache");
  assert.equal(metrics.classifyThreadDetailPhase({ readDecision: "projection-hit", projectionSource: "dynamic" }), "warm-projection-dynamic");
  assert.equal(metrics.classifyThreadDetailPhase({ readDecision: "projection-partial-hit" }), "warm-projection-partial");
  assert.equal(metrics.classifyThreadDetailPhase({ readDecision: "projection-stale-partial-hit" }), "warm-projection-partial");
  assert.equal(metrics.classifyThreadDetailPhase({ readMode: "projection-v4-partial" }), "warm-projection-partial");
  assert.equal(metrics.classifyThreadDetailPhase({ readDecision: "initial-turns-list", projectionSeedStatus: "seeded-partial" }), "cold-turns-list-initial-seeded-partial");
  assert.equal(metrics.classifyThreadDetailPhase({ readDecision: "initial-turns-list" }), "cold-turns-list-initial");
  assert.equal(metrics.classifyThreadDetailPhase({ readDecision: "bounded-large-turns-list" }), "bounded-large-thread-window");
  assert.equal(metrics.classifyThreadDetailPhase({ readDecision: "full-thread-read" }), "cold-thread-read");
  assert.equal(metrics.classifyThreadDetailPhase({ readMode: "thread-read-raw" }), "cold-thread-read-raw");
  assert.equal(metrics.classifyThreadDetailPhase({ readDecision: "fallback-turns-list" }), "fallback-turns-list");
  assert.equal(metrics.classifyThreadDetailPhase({ readDecision: "summary-fallback" }), "fallback-summary");
  assert.equal(metrics.classifyThreadDetailPhase(null, { cached: true }), "warm-client-current");
  assert.equal(metrics.classifyThreadDetailPhase(null), "unknown");
});

test("thread performance metrics return null server timings when response has none", () => {
  assert.deepEqual(metrics.threadDetailEventFields({}), {
    serverTimings: null,
    performancePhase: "unknown",
    detailShape: {
      turns: 0,
      omittedTurns: 0,
      items: 0,
      visibleItems: 0,
      userItems: 0,
      receiptItems: 0,
      imageItems: 0,
      operationItems: 0,
      usageItems: 0,
      diagnosticItems: 0,
      completedTurns: 0,
      activeTurns: 0,
    },
  });
  assert.deepEqual(metrics.threadListEventFields({}), {
    serverTimings: null,
    performancePhase: "unknown",
  });
});

test("thread performance metrics bound and classify client detail timings", () => {
  assert.deepEqual(metrics.threadDetailClientTimings({
    source: "thread-list",
    elapsedMs: 26.4,
    apiElapsedMs: 18.6,
    renderElapsedMs: 7.2,
    mergeMs: 2.1,
    threadListRenderMs: 1,
    conversationRenderMs: 4,
    postRenderMs: 0.2,
    detailRenderMode: "first-paint",
    refreshRenderAction: "tile-pane-patch",
    renderPlanReason: "patch-shell-stable",
    patchRejectReason: "rendered-dom-stale",
    skippedDetailRender: false,
    locallyPatchedDetail: false,
    tilePanePatchedDetail: true,
    ignoredMs: 12,
    negativeMs: -1,
  }), {
    elapsedMs: 26,
    apiElapsedMs: 19,
    renderElapsedMs: 7,
    mergeMs: 2,
    threadListRenderMs: 1,
    conversationRenderMs: 4,
    postRenderMs: 0,
    detailRenderMode: "first-paint",
    source: "thread-list",
    refreshRenderAction: "tile-pane-patch",
    renderPlanReason: "patch-shell-stable",
    patchRejectReason: "rendered-dom-stale",
    skippedDetailRender: false,
    locallyPatchedDetail: false,
    tilePanePatchedDetail: true,
  });

  assert.equal(metrics.boundedTiming(1000000), 600000);
  assert.equal(metrics.boundedTiming(-1), null);
});

test("thread performance metrics combine server and client detail fields", () => {
  const fields = metrics.threadDetailEventFieldsWithClient({
    mobileDiagnostics: {
      threadDetailTimings: {
        phase: "fallback-turns-list",
        turnsListFallbackMs: 32,
      },
    },
  }, {
    renderElapsedMs: 11,
    detailRenderMode: "patch",
  });

  assert.deepEqual(fields, {
    serverTimings: {
      phase: "fallback-turns-list",
      turnsListFallbackMs: 32,
    },
    performancePhase: "fallback-turns-list",
    detailShape: {
      turns: 0,
      omittedTurns: 0,
      items: 0,
      visibleItems: 0,
      userItems: 0,
      receiptItems: 0,
      imageItems: 0,
      operationItems: 0,
      usageItems: 0,
      diagnosticItems: 0,
      completedTurns: 0,
      activeTurns: 0,
    },
    clientTimings: {
      renderElapsedMs: 11,
      detailRenderMode: "patch",
    },
  });
});

test("thread performance metrics build refresh event payloads from bounded fields", () => {
  const event = metrics.threadDetailRefreshEventFields({
    mobileReadMode: "projection-cache",
    rolloutSizeBytes: 123456,
    mobileOmittedTurnCount: 3,
    status: { type: "running", privateText: "not exported because type wins" },
    mobileDiagnostics: {
      threadDetailTimings: {
        phase: "warm-projection-cache",
        projectionMs: 4,
      },
    },
    turns: [{
      status: "completed",
      items: [
        { type: "userMessage", text: "private prompt" },
        { type: "agentMessage", text: "private response" },
      ],
    }],
  }, {
    source: "event-recovery",
    threadId: "thread-123",
    requestedMode: "recent",
    elapsedMs: 34.4,
    apiElapsedMs: 12.2,
    renderElapsedMs: 8.7,
    mergeMs: 1.1,
    composerRenderMs: 2.2,
    threadListRenderMs: 3.3,
    conversationRenderMs: 4.4,
    detailPatchMs: 5.5,
    metadataUpdateMs: 6.6,
    detailRenderMode: "patch",
    refreshRenderAction: "local-patch-metadata-update",
    renderPlanReason: "signature-changed",
    patchRejectReason: "",
    skippedDetailRender: false,
    locallyPatchedDetail: true,
    tilePanePatchedDetail: false,
  });

  assert.deepEqual(event, {
    source: "event-recovery",
    threadId: "thread-123",
    requestedMode: "recent",
    readMode: "projection-cache",
    serverTimings: {
      phase: "warm-projection-cache",
      projectionMs: 4,
    },
    performancePhase: "warm-projection-cache",
    clientTimings: {
      elapsedMs: 34,
      apiElapsedMs: 12,
      renderElapsedMs: 9,
      mergeMs: 1,
      composerRenderMs: 2,
      threadListRenderMs: 3,
      conversationRenderMs: 4,
      detailPatchMs: 6,
      metadataUpdateMs: 7,
      detailRenderMode: "patch",
      source: "event-recovery",
      refreshRenderAction: "local-patch-metadata-update",
      renderPlanReason: "signature-changed",
      skippedDetailRender: false,
      locallyPatchedDetail: true,
      tilePanePatchedDetail: false,
    },
    detailShape: {
      turns: 1,
      omittedTurns: 3,
      items: 2,
      visibleItems: 2,
      userItems: 1,
      receiptItems: 1,
      imageItems: 0,
      operationItems: 0,
      usageItems: 0,
      diagnosticItems: 0,
      completedTurns: 1,
      activeTurns: 0,
    },
    status: "running",
    turns: 1,
    omittedTurns: 3,
    rolloutSizeBytes: 123456,
    renderPlanReason: "signature-changed",
    refreshRenderAction: "local-patch-metadata-update",
    patchRejectReason: "",
    skippedDetailRender: false,
    locallyPatchedDetail: true,
    tilePanePatchedDetail: false,
    elapsedMs: 34,
    apiElapsedMs: 12,
    renderElapsedMs: 9,
  });
  assert.equal(JSON.stringify(event).includes("private"), false);
});

test("thread performance metrics build cached first-paint payloads with warm client phase", () => {
  const event = metrics.threadDetailFirstPaintEventFields({
    mobileReadMode: "projection-cache",
    rolloutSizeBytes: 4321,
    status: { privateText: "not exported" },
    turns: [{ status: "running", items: [{ type: "agentMessage", text: "private response" }] }],
  }, {
    source: "thread-list",
    threadId: "thread-cached",
    elapsedMs: 12.4,
    apiElapsedMs: 0,
    renderElapsedMs: 7.6,
    threadListRenderMs: 1.2,
    conversationRenderMs: 5.1,
    detailRenderMode: "cached-current",
    cached: true,
  });

  assert.deepEqual(event, {
    source: "thread-list",
    threadId: "thread-cached",
    serverTimings: null,
    performancePhase: "warm-client-current",
    clientTimings: {
      elapsedMs: 12,
      apiElapsedMs: 0,
      renderElapsedMs: 8,
      threadListRenderMs: 1,
      conversationRenderMs: 5,
      detailRenderMode: "cached-current",
      source: "thread-list",
    },
    detailShape: {
      turns: 1,
      omittedTurns: 0,
      items: 1,
      visibleItems: 1,
      userItems: 0,
      receiptItems: 1,
      imageItems: 0,
      operationItems: 0,
      usageItems: 0,
      diagnosticItems: 0,
      completedTurns: 0,
      activeTurns: 1,
    },
    cached: true,
    readMode: "projection-cache",
    turns: 1,
    rolloutSizeBytes: 4321,
    elapsedMs: 12,
    apiElapsedMs: 0,
    renderElapsedMs: 8,
  });
  assert.equal(Object.hasOwn(event, "status"), false);
  assert.equal(Object.hasOwn(event, "omittedTurns"), false);
  assert.equal(JSON.stringify(event).includes("private"), false);
});

test("thread performance metrics build uncached first-paint payloads", () => {
  const event = metrics.threadDetailFirstPaintEventFields({
    mobileReadMode: "turns-list-initial",
    mobileOmittedTurnCount: 9,
    status: { type: "completed", privateText: "not exported" },
    mobileDiagnostics: {
      threadDetailTimings: {
        phase: "unknown",
        readDecision: "initial-turns-list",
        projectionSeedStatus: "seeded-partial",
        turnsListMs: 18,
      },
    },
    turns: [{ status: "completed", items: [{ type: "turnUsageSummary" }] }],
  }, {
    source: "startup",
    threadId: "thread-open",
    elapsedMs: 101.2,
    apiElapsedMs: 80.8,
    renderElapsedMs: 20.1,
    mergeMs: 4.4,
    draftRestoreMs: 2.1,
    composerRenderMs: 1.2,
    threadListRenderMs: 2.2,
    conversationRenderMs: 8.7,
    postRenderMs: 1.8,
    detailRenderMode: "first-paint",
    cached: false,
  });

  assert.equal(event.performancePhase, "cold-turns-list-initial-seeded-partial");
  assert.equal(event.cached, false);
  assert.equal(event.status, "completed");
  assert.equal(event.omittedTurns, 9);
  assert.equal(event.clientTimings.detailRenderMode, "first-paint");
  assert.equal(JSON.stringify(event).includes("private"), false);
});

test("thread performance metrics build full-ready payloads", () => {
  const event = metrics.threadDetailFullReadyEventFields({
    mobileReadMode: "thread-read",
    mobileOmittedTurnCount: 0,
    rolloutSizeBytes: 9876,
    mobileDiagnostics: { threadDetailTimings: { phase: "unknown", readDecision: "full-thread-read", threadReadMs: 90 } },
    turns: [{ status: "completed", items: [{ type: "agentMessage", text: "private response" }] }],
  }, {
    source: "thread-list",
    threadId: "thread-full",
    elapsedMs: 150.9,
    apiElapsedMs: 111.1,
    renderElapsedMs: 39.4,
    mergeMs: 7.2,
    composerRenderMs: 3.1,
    threadListRenderMs: 2.8,
    conversationRenderMs: 20.6,
    postRenderMs: 1.1,
    detailRenderMode: "full-backfill",
  });

  assert.equal(event.source, "thread-list");
  assert.equal(event.threadId, "thread-full");
  assert.equal(event.performancePhase, "cold-thread-read");
  assert.equal(event.readMode, "thread-read");
  assert.equal(event.rolloutSizeBytes, 9876);
  assert.equal(event.clientTimings.detailRenderMode, "full-backfill");
  assert.equal(event.omittedTurns, 0);
  assert.equal(JSON.stringify(event).includes("private"), false);
});

test("thread performance metrics summarize detail shape without message bodies", () => {
  const shape = metrics.threadDetailShape({
    mobileOmittedTurnCount: 7,
    turns: [{
      status: "completed",
      items: [
        { type: "userMessage", text: "private prompt body" },
        { type: "agentMessage", text: "private response body" },
        { type: "imageView", path: "/private/image.jpg" },
        { type: "turnUsageSummary" },
      ],
    }, {
      status: "running",
      items: [
        { type: "commandExecution", command: "long private command" },
        { type: "reasoning", text: "private reasoning" },
        { type: "turnDiagnostic", text: "bounded diagnostic" },
      ],
    }],
  });

  assert.deepEqual(shape, {
    turns: 2,
    omittedTurns: 7,
    items: 7,
    visibleItems: 6,
    userItems: 1,
    receiptItems: 1,
    imageItems: 1,
    operationItems: 1,
    usageItems: 1,
    diagnosticItems: 1,
    completedTurns: 1,
    activeTurns: 1,
  });
  assert.equal(JSON.stringify(shape).includes("private"), false);
});

test("thread performance metrics plan slow detail path diagnostics only at threshold", () => {
  const below = metrics.planThreadDetailSlowPathDiagnostic({
    elapsedMs: 7999,
    apiElapsedMs: 100,
    renderElapsedMs: 100,
    readMode: "thread-read",
    detailShape: { turns: 10, visibleItems: 30 },
  }, {
    action: "thread-detail-load",
    threadHash: "h_thread",
    durationBucket: "3_10s",
    thresholdMs: 8000,
  });

  assert.equal(below.shouldReport, false);
  assert.equal(below.reason, "below-threshold");

  const planned = metrics.planThreadDetailSlowPathDiagnostic({
    elapsedMs: 17000,
    apiElapsedMs: 12000,
    renderElapsedMs: 300,
    readMode: "thread-read",
    performancePhase: "cold-thread-read",
    serverTimings: {
      coldPathOwner: "projection-cache",
      coldPathReason: "projection-miss:static-signature-mismatch",
    },
    detailShape: { turns: 10, visibleItems: 30, omittedTurns: 2 },
    rolloutSizeBytes: 2 * 1024 * 1024,
  }, {
    action: "thread-detail-refresh",
    threadHash: "h_thread",
    durationBucket: "10_30s",
    thresholdMs: 8000,
  });

  assert.equal(planned.shouldReport, true);
  assert.equal(planned.reason, "api-slow");
  assert.equal(planned.severityHint, "H2");
  assert.equal(planned.threadHash, "h_thread");
  assert.equal(planned.durationBucket, "10_30s");
  assert.equal(planned.coldPathOwner, "projection-cache");
  assert.equal(planned.coldPathReason, "projection-miss:static-signature-mismatch");
  assert.equal(planned.rolloutSizeBytes, 2 * 1024 * 1024);
});

test("thread performance metrics detect empty projection response shells", () => {
  const planned = metrics.planThreadDetailResponseContractDiagnostic({
    source: "thread-list",
    readMode: "projection-v4-partial",
    performancePhase: "warm-projection-partial",
    detailShape: {
      turns: 1,
      items: 0,
      visibleItems: 0,
      activeTurns: 0,
      completedTurns: 1,
    },
    turns: 1,
    omittedTurns: 0,
  }, {
    action: "thread-detail-load",
    threadHash: "h_music",
    durationBucket: "lt_1s",
    contract: {
      projectionPartial: true,
      projectionPartialKind: "notification-shell",
      olderCursor: false,
      newerCursor: false,
    },
  });

  assert.equal(planned.shouldReport, true);
  assert.equal(planned.reason, "empty-projection-shell");
  assert.equal(planned.severityHint, "H2");
  assert.equal(planned.turns, 1);
  assert.equal(planned.items, 0);
  assert.equal(planned.visibleItems, 0);
  assert.equal(planned.projectionPartial, true);
});

test("thread performance metrics detect active thread window downgrades", () => {
  const planned = metrics.planThreadDetailResponseContractDiagnostic({
    source: "event-recovery",
    readMode: "turns-list-large",
    performancePhase: "bounded-large-thread-window",
    detailShape: {
      turns: 10,
      items: 40,
      visibleItems: 40,
      activeTurns: 1,
      completedTurns: 9,
    },
    turns: 10,
  }, {
    action: "thread-detail-refresh",
    threadHash: "h_home_ai",
  });

  assert.equal(planned.shouldReport, true);
  assert.equal(planned.reason, "active-thread-window-downgrade");
  assert.equal(planned.severityHint, "H2");
  assert.equal(planned.activeTurns, 1);
});

test("thread performance metrics detect projection windows marked as full cache", () => {
  const planned = metrics.planThreadDetailResponseContractDiagnostic({
    source: "thread-list",
    readMode: "projection-v4-cache",
    performancePhase: "warm-projection-cache",
    detailShape: {
      turns: 10,
      items: 40,
      visibleItems: 40,
      activeTurns: 0,
      completedTurns: 10,
    },
    turns: 10,
  }, {
    action: "thread-detail-load",
    threadHash: "h_window",
    contract: {
      projectionPartial: false,
      olderCursor: true,
      newerCursor: true,
      projectionSource: "cache",
    },
  });

  assert.equal(planned.shouldReport, true);
  assert.equal(planned.reason, "projection-window-marked-full");
  assert.equal(planned.olderCursor, true);
  assert.equal(planned.newerCursor, true);
});

test("thread performance metrics accept latest projection windows with only older history", () => {
  const planned = metrics.planThreadDetailResponseContractDiagnostic({
    source: "thread-list",
    readMode: "projection-v4-dynamic",
    performancePhase: "warm-projection-dynamic",
    status: "completed",
    detailShape: {
      turns: 10,
      items: 40,
      visibleItems: 40,
      activeTurns: 0,
      completedTurns: 10,
    },
    turns: 10,
    omittedTurns: 218,
  }, {
    action: "thread-detail-load",
    threadHash: "h_latest",
    contract: {
      projectionPartial: false,
      olderCursor: true,
      newerCursor: false,
      projectionSource: "dynamic",
    },
  });

  assert.equal(planned.shouldReport, false);
  assert.equal(planned.reason, "ok");
  assert.equal(planned.olderCursor, true);
  assert.equal(planned.newerCursor, false);
});

test("thread performance metrics accept complete idle recent windows", () => {
  const planned = metrics.planThreadDetailResponseContractDiagnostic({
    source: "thread-list",
    readMode: "turns-list-initial",
    performancePhase: "cold-turns-list-initial-seeded-partial",
    status: "completed",
    detailShape: {
      turns: 10,
      items: 30,
      visibleItems: 30,
      activeTurns: 0,
      completedTurns: 10,
    },
    turns: 10,
  }, {
    action: "thread-detail-load",
    threadHash: "h_music",
  });

  assert.equal(planned.shouldReport, false);
  assert.equal(planned.reason, "ok");
});
