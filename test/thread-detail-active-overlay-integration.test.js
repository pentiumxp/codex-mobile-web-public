"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadDetailActiveOverlayProviderService,
} = require("../adapters/thread-detail-active-overlay-provider-service");
const {
  createThreadDetailProjectionInputService,
} = require("../adapters/thread-detail-projection-input-service");
const {
  createThreadDetailProjectionResultService,
} = require("../adapters/thread-detail-projection-result-service");
const {
  createThreadDetailProjectionV4Service,
} = require("../adapters/thread-detail-projection-v4-service");
const {
  createThreadDetailReadOrchestrationService,
} = require("../adapters/thread-detail-read-orchestration-service");

function diagnosticsAttacher(result, input) {
  if (!result || !result.thread) return result;
  result.thread.mobileDiagnostics = {
    threadDetailTimings: {
      readMode: input.readMode,
      readDecision: input.readDecision,
      projectionState: String(input.projectionState || ""),
      projectionInputAvailable: input.projectionInputAvailable === true,
      projectionSource: String(input.projectionSource || ""),
      projectionVersion: String(input.projectionVersion || ""),
      projectionMissReason: String(input.projectionMissReason || ""),
      activeFullReadRequired: input.activeFullReadRequired === true,
      activeFullReadReason: String(input.activeFullReadReason || ""),
      activeOverlayAction: String(input.activeOverlayAction || ""),
      activeOverlayReason: String(input.activeOverlayReason || ""),
      activeOverlaySource: String(input.activeOverlaySource || ""),
      activeOverlayItems: Number(input.activeOverlayItems || 0),
      activeOverlayOperationItems: Number(input.activeOverlayOperationItems || 0),
      activeOverlayUploadItems: Number(input.activeOverlayUploadItems || 0),
      activeOverlayAssistantItems: Number(input.activeOverlayAssistantItems || 0),
      activeOverlayReceiptItems: Number(input.activeOverlayReceiptItems || 0),
    },
  };
  return result;
}

test("read orchestration uses live projection provider for active overlay without full thread/read", async () => {
  const calls = [];
  let nowMs = 10_000;
  const now = () => {
    nowMs += 100;
    return nowMs;
  };
  const summary = {
    id: "thread-1",
    status: { type: "active" },
    activeTurnId: "turn-live",
    rolloutPath: "/tmp/codex-mobile-live-overlay-rollout.jsonl",
    updatedAtMs: 10,
  };
  const projectionInputService = createThreadDetailProjectionInputService({
    maxTurns: 3,
    rolloutStatsForPath: () => ({ sizeBytes: 24_000_000, mtimeMs: 1000 }),
  });
  const projectionService = createThreadDetailProjectionV4Service({
    cacheDir: "",
    policyVersion: "test-v4",
    maxTurns: 3,
    now,
  });
  const resultService = createThreadDetailProjectionResultService({
    maxTurns: 3,
    now,
  });
  const activeOverlayProvider = createThreadDetailActiveOverlayProviderService({
    projectionService,
  });

  const projectionInput = projectionInputService.projectionInput("thread-1", summary);
  projectionService.seed(projectionInput, {
    thread: {
      id: "thread-1",
      turns: [{
        id: "turn-window",
        items: [{ id: "agent-window", type: "agentMessage", text: "older visible receipt" }],
      }],
    },
  }, {
    partial: true,
    partialKind: "recent-window",
  });
  projectionService.applyNotification("turn/started", {
    threadId: "thread-1",
    turn: { id: "turn-live", status: { type: "active" }, items: [] },
  });
  projectionService.applyNotification("item/started", {
    threadId: "thread-1",
    turnId: "turn-live",
    item: { id: "cmd-1", type: "commandExecution", status: "running" },
  });
  projectionService.applyNotification("item/agentMessage/delta", {
    threadId: "thread-1",
    turnId: "turn-live",
    itemId: "agent-1",
    delta: "partial live reply",
  });
  projectionService.applyNotification("item/completed", {
    threadId: "thread-1",
    turnId: "turn-live",
    item: { id: "usage-1", type: "turnUsageSummary" },
  });

  const service = createThreadDetailReadOrchestrationService({
    now,
    attachDiagnostics: diagnosticsAttacher,
    resolveSummary: async () => {
      calls.push("summary");
      return { summary, source: "state-db" };
    },
    resolveVisibility: () => ({ visible: true }),
    threadRuntimeSettings: () => ({}),
    isHiddenThread: () => false,
    rawAllEnabled: () => false,
    projectionInput: (threadId, resolvedSummary) => {
      calls.push("projection-input");
      return projectionInputService.projectionInput(threadId, resolvedSummary);
    },
    projectedThreadLookup: (input, resolvedSummary, runtimeSettings, options = {}) => {
      const lookedUp = projectionService.lookup(input, options);
      calls.push(`projection-lookup:${options.allowPartial === true ? "partial" : "full"}:${lookedUp.missReason || "hit"}`);
      return {
        result: resultService.prepareProjectedThreadReadResult(
          lookedUp.cached,
          resolvedSummary,
          runtimeSettings,
          options,
        ),
        missReason: lookedUp.missReason || "",
      };
    },
    projectedThreadResult: () => null,
    resolveActiveWindowOverlay: (input) => {
      calls.push("active-overlay-provider");
      return activeOverlayProvider.resolveActiveWindowOverlay(input);
    },
    rememberThreadSummary: () => calls.push("remember"),
    turnsListThreadReadResult: async () => {
      calls.push("turns-list");
      return { thread: { id: "thread-1", turns: [], mobileReadMode: "turns-list" } };
    },
    readFullThread: async () => {
      calls.push("thread-read");
      return { thread: { id: "thread-1", turns: [], mobileReadMode: "thread-read" } };
    },
    seedProjection: () => {},
    preferBoundedReadBeforeFullRead: () => ({
      prefer: true,
      rolloutSizeBytes: 24_000_000,
      thresholdBytes: 8_000_000,
      source: "summary",
      reason: "large-rollout",
    }),
    prepareResponse: async (result) => result,
    fallbackThreadReadResult: () => ({ thread: { id: "thread-1", turns: [] } }),
    isReadTimeoutError: () => false,
    isUnmaterializedThreadError: () => false,
    threadRolloutSizeBytes: () => 24_000_000,
    readTimeoutMs: 12_000,
    threadDetailRpcTimeoutMs: 6_000,
    maxThreadTurns: 3,
    maxFullThreadTurns: 3,
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-active-overlay");
  assert.deepEqual(response.body.thread.turns.map((turn) => turn.id), ["turn-window", "turn-live"]);
  assert.equal(calls.includes("thread-read"), false);
  assert.equal(calls.includes("turns-list"), false);
  assert.deepEqual(calls.filter((call) => call.startsWith("projection-lookup:")), [
    "projection-lookup:full:partial-not-allowed",
    "projection-lookup:partial:hit",
  ]);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "projection-active-overlay");
  assert.equal(timings.activeFullReadRequired, true);
  assert.equal(timings.activeFullReadReason, "active-turn-id");
  assert.equal(timings.activeOverlayAction, "use-projection-overlay");
  assert.equal(timings.activeOverlayReason, "overlay-evidence-complete");
  assert.equal(timings.activeOverlaySource, "projection-live");
  assert.equal(timings.activeOverlayOperationItems, 1);
  assert.equal(timings.activeOverlayUploadItems, 0);
  assert.equal(timings.activeOverlayAssistantItems, 1);
  assert.equal(timings.activeOverlayReceiptItems, 1);
});
