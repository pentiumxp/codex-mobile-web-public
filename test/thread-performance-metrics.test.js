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
  assert.equal(metrics.classifyThreadListPhase({ fallbackCacheHit: true }), "warm-fallback-cache");
  assert.equal(metrics.classifyThreadListPhase({ fallbackMs: 25 }), "cold-fallback-build");
  assert.equal(metrics.classifyThreadListPhase({ appServerMs: 3, fallbackMs: 0 }), "app-server-only");
  assert.equal(metrics.classifyThreadListPhase(null), "unknown");
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
    skippedDetailRender: false,
    locallyPatchedDetail: false,
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
    skippedDetailRender: false,
    locallyPatchedDetail: false,
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
