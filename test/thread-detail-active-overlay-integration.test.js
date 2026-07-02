"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadDetailActiveOverlayProviderService,
} = require("../services/thread-detail/thread-detail-active-overlay-provider-service");
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
} = require("../services/thread-detail/thread-detail-read-orchestration-service");
const {
  handleThreadDetailReadRoute,
} = require("../server-routes/thread-detail-route-service");

function routeUrl(pathname) {
  return new URL(pathname, "http://127.0.0.1:8787");
}

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
      activeOverlayWindowFirst: input.activeOverlayWindowFirst === true,
    },
  };
  return result;
}

function createActiveOverlayHarness(options = {}) {
  const calls = [];
  let nowMs = 10_000;
  const now = () => {
    nowMs += 100;
    return nowMs;
  };
  const summary = Object.assign({
    id: "thread-1",
    status: { type: "active" },
    activeTurnId: "turn-live",
    rolloutPath: "/tmp/codex-mobile-live-overlay-rollout.jsonl",
    updatedAtMs: 10,
  }, options.summary || {});
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
  if (options.seedProjection !== false) {
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
  }
  projectionService.applyNotification("turn/started", {
    threadId: "thread-1",
    turn: { id: "turn-live", status: { type: "active" }, items: [] },
  });
  projectionService.applyNotification("item/started", {
    threadId: "thread-1",
    turnId: "turn-live",
    item: { id: "cmd-1", type: "commandExecution", status: "running" },
  });
  projectionService.applyNotification("item/started", {
    threadId: "thread-1",
    turnId: "turn-live",
    item: {
      id: "mcp-raw-1",
      type: "mcpToolCall",
      status: "completed",
      arguments: { privatePayload: "raw arguments should not survive active overlay compaction" },
      result: { body: "raw result should not survive active overlay compaction" },
    },
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
    activeOverlayProjectionWindowLookup: (input, resolvedSummary, runtimeSettings, options = {}) => {
      const lookedUp = projectionService.lookup(input, Object.assign({}, options, { skipNormalizeResult: true }));
      calls.push(`active-overlay-window-lookup:${lookedUp.missReason || "hit"}`);
      return {
        result: lookedUp.cached && lookedUp.cached.result || null,
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
      return {
        thread: {
          id: "thread-1",
          turns: [
            {
              id: "turn-window",
              items: [{ id: "agent-window", type: "agentMessage", text: "older visible receipt" }],
            },
            {
              id: "turn-live",
              status: { type: "active" },
              items: [{ id: "user-window", type: "userMessage" }],
            },
          ],
          mobileReadMode: "turns-list",
        },
      };
    },
    readFullThread: async () => {
      calls.push("thread-read");
      return { thread: { id: "thread-1", turns: [], mobileReadMode: "thread-read" } };
    },
    seedProjection: () => {},
    compactActiveOverlayTurn: (turn) => Object.assign({}, turn, {
      items: (turn.items || []).map((item) => item.type === "mcpToolCall"
        ? { id: item.id, type: item.type, mobileLiveOperation: true }
        : item),
    }),
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

  return { calls, service };
}

test("read orchestration uses live projection provider for active overlay without full thread/read", async () => {
  const { calls, service } = createActiveOverlayHarness();
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
  assert.equal(calls.includes("turns-list"), true);
  assert.deepEqual(calls.filter((call) => call.startsWith("projection-lookup:")), []);
  assert.deepEqual(calls.filter((call) => call.startsWith("active-overlay-window-lookup:")), [
    "active-overlay-window-lookup:hit",
  ]);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "projection-active-overlay");
  assert.equal(timings.activeFullReadRequired, true);
  assert.equal(timings.activeFullReadReason, "active-turn-id");
  assert.equal(timings.activeOverlayAction, "use-projection-overlay");
  assert.equal(timings.activeOverlayReason, "overlay-evidence-complete");
  assert.equal(timings.activeOverlaySource, "projection-live");
  assert.equal(timings.activeOverlayOperationItems, 2);
  assert.equal(timings.activeOverlayUploadItems, 0);
  assert.equal(timings.activeOverlayAssistantItems, 1);
  assert.equal(timings.activeOverlayReceiptItems, 1);
  assert.equal(timings.activeOverlayWindowFirst, true);
});

test("read orchestration compacts active overlay tool payload before returning detail", async () => {
  const { service } = createActiveOverlayHarness();
  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  const liveTurn = response.body.thread.turns.find((turn) => turn.id === "turn-live");
  assert.ok(liveTurn);
  const toolCall = liveTurn.items.find((item) => item.id === "mcp-raw-1");
  assert.ok(toolCall);
  assert.equal(toolCall.mobileLiveOperation, true);
  assert.deepEqual(Object.keys(toolCall).sort(), ["id", "mobileLiveOperation", "type"]);
  const serialized = JSON.stringify(liveTurn);
  assert.equal(serialized.includes("arguments"), false);
  assert.equal(serialized.includes("result"), false);
  assert.equal(serialized.includes("raw arguments"), false);
  assert.equal(serialized.includes("raw result"), false);
});

test("read orchestration reuses warm projection for status-active summary without activeTurnId", async () => {
  const { calls, service } = createActiveOverlayHarness({ summary: { activeTurnId: "" } });
  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-v4-partial");
  assert.equal(calls.includes("thread-read"), false);
  assert.equal(calls.includes("turns-list"), false);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "projection-partial-hit");
  assert.equal(timings.activeFullReadRequired, true);
  assert.equal(timings.activeFullReadReason, "status-active");
  assert.equal(timings.projectionState, "hit");
});

test("read orchestration uses bounded read for status-active summary without warm projection", async () => {
  const { calls, service } = createActiveOverlayHarness({
    summary: { activeTurnId: "" },
    seedProjection: false,
  });
  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "turns-list-large");
  assert.equal(calls.includes("thread-read"), false);
  assert.equal(calls.includes("turns-list"), true);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "bounded-large-turns-list");
  assert.equal(timings.activeFullReadRequired, true);
  assert.equal(timings.activeFullReadReason, "status-active");
  assert.equal(timings.activeOverlayAction, "require-full-read");
  assert.equal(timings.activeOverlayReason, "active-full-read-not-overlay-closable");
});

test("read orchestration ignores stale active overlay shortcut for status-only active summary", async () => {
  const { calls, service } = createActiveOverlayHarness({
    summary: {
      activeTurnId: "",
      updatedAtMs: 60_000,
    },
  });
  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "turns-list-large");
  assert.equal(calls.includes("thread-read"), false);
  assert.equal(calls.includes("turns-list"), true);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "bounded-large-turns-list");
  assert.equal(timings.activeFullReadReason, "status-active");
  assert.equal(timings.activeOverlayAction, "require-full-read");
  assert.equal(timings.activeOverlayReason, "active-full-read-not-overlay-closable");
  assert.equal(timings.activeOverlayWindowFirst, false);
});

test("thread detail route smoke returns active overlay from mode=recent without full thread/read", async () => {
  const { calls, service } = createActiveOverlayHarness();
  const sent = [];
  const routeLogs = [];

  const result = await handleThreadDetailReadRoute({
    threadId: "thread-1",
    codex: { transportKind: "mux", ready: true },
    url: routeUrl("/api/threads/thread-1?mode=recent"),
    requestStartedAtMs: 10_000,
    now: () => 10_123,
    readThreadDetail: (request) => {
      calls.push(`route-read-prefer-recent:${request.preferRecentTurns === true}`);
      return service.readThreadDetail(request);
    },
    sendJson: (status, body) => sent.push({ status, body }),
    logThreadDetail: (event, details) => routeLogs.push({ event, details }),
  });

  assert.deepEqual(result, {
    handled: true,
    status: 200,
    mode: "projection-active-overlay",
    complete: true,
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].status, 200);
  assert.equal(sent[0].body.thread.mobileReadMode, "projection-active-overlay");
  assert.deepEqual(sent[0].body.thread.turns.map((turn) => turn.id), ["turn-window", "turn-live"]);
  assert.equal(calls.includes("thread-read"), false);
  assert.equal(calls.includes("turns-list"), true);
  assert.ok(calls.includes("route-read-prefer-recent:true"));
  assert.deepEqual(calls.filter((call) => call.startsWith("projection-lookup:")), []);
  assert.deepEqual(calls.filter((call) => call.startsWith("active-overlay-window-lookup:")), [
    "active-overlay-window-lookup:hit",
  ]);
  assert.ok(routeLogs.some((log) => log.event === "start" && log.details.transport === "mux"));
  assert.ok(routeLogs.some((log) => (
    log.event === "active_overlay_plan"
    && log.details.action === "use-projection-overlay"
    && log.details.reason === "overlay-evidence-complete"
  )));
  assert.ok(routeLogs.some((log) => (
    log.event === "complete"
    && log.details.status === 200
    && log.details.mode === "projection-active-overlay"
  )));
});
