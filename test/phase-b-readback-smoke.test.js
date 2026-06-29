"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const { test } = require("node:test");

const {
  classifyActiveOverlayGate,
  parseArgs,
  run,
  summarizeThreadDetail,
  summarizeThreadList,
  summarizePublicConfig,
} = require("../scripts/codex-mobile-phase-b-readback-smoke");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function createMockServer(handler) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body));
    };
    Promise.resolve(handler({ req, url, send })).catch((err) => send(500, {
      error: err && err.message || String(err),
    }));
  });
}

function muxStatusFixture(overrides = {}) {
  return {
    transport: "external-jsonl-tcp",
    sharedRequired: true,
    persistentOwnedMux: true,
    mobileOwnedMux: { pid: 12345, running: false },
    endpoint: {
      protocol: "jsonl-tcp",
      kind: "profile-mux-file",
      source: "/private/runtime/endpoint.json",
      host: "10.0.0.5",
      port: 12345,
      capabilities: {
        mobileUserMessageEcho: true,
        notificationReplay: true,
        serverRequestProxy: true,
        threadGoalRpc: true,
        muxMetricsRpc: true,
      },
    },
    muxMetrics: Object.assign({
      supported: true,
      ok: true,
      uptimeMs: 1000,
      pendingCount: 0,
      serverRequestCount: 0,
      trackedMethodCount: 1,
      methods: {
        "thread/list": {
          method: "thread/list",
          count: 1,
          errorCount: 0,
          totalMs: 11,
          avgMs: 11,
          lastMs: 11,
          maxMs: 11,
          lastRequestBytes: 188,
          lastResponseBytes: 45678,
          lastAgeMs: 3,
        },
      },
    }, overrides),
  };
}

test("phase B readback smoke parses prewarm settle options", () => {
  const parsed = parseArgs([
    "--prewarm-settle-ms",
    "9000",
    "--prewarm-poll-ms",
    "100",
  ], {});

  assert.equal(parsed.prewarmSettleMs, 9000);
  assert.equal(parsed.prewarmPollMs, 100);
  assert.equal(parseArgs(["--no-wait-prewarm"], {}).prewarmSettleMs, 0);
});

test("phase B readback smoke collects bounded diagnostics without private fields", async (t) => {
  const seen = [];
  const server = createMockServer(({ req, url, send }) => {
    seen.push({ path: url.pathname, authorization: req.headers.authorization || "" });
    if (url.pathname === "/api/public-config") {
      send(200, {
        version: "0.1.11",
        clientBuildId: "0.1.11|codex-mobile-shell-test",
        shellCacheName: "codex-mobile-shell-test",
        authRequired: true,
        threadListFallbackPrewarm: {
          enabled: true,
          scheduled: false,
          running: false,
          completed: true,
          deferralCount: 0,
          delayMs: 0,
          retryDelayMs: 2500,
          maxDeferrals: 5,
          limit: 40,
          lastStatus: "completed",
          lastCacheDecision: "miss-rebuild",
          lastSourceSnapshotHit: true,
          lastResultCount: 1,
          lastElapsedMs: 25,
          privateThreadId: "SHOULD NOT LEAK",
        },
      });
      return;
    }
    if (url.pathname === "/api/threads") {
      send(200, {
        data: [{
          id: "thread-private-1",
          name: "PRIVATE THREAD TITLE SHOULD NOT LEAK",
          privatePrompt: "do not leak",
        }],
        mobileDiagnostics: {
          threadListTimings: {
            totalMs: 40,
            appServerMs: 12,
            appServerRequestedLimit: 40,
            appServerRequestLimit: 500,
            appServerRequestReason: "default-preserve-visible-entry-window",
            appServerOverfetchFactor: 12.5,
            appServerRpcMs: 10,
            appServerVisibleFilterMs: 1,
            appServerWorkspaceFilterMs: 1,
            appServerPostProcessMs: 2,
            appServerMeasuredMs: 12,
            appServerUnattributedMs: 0,
            appServerRawCount: 3,
            appServerVisibleCount: 2,
            appServerFilteredCount: 1,
            appServerTransportKind: "external-jsonl-tcp",
            appServerEndpointKind: "profile-mux-file",
            appServerEndpointProtocol: "jsonl-tcp",
            appServerRpcAttemptCount: 1,
            appServerRpcTimeoutMs: 12000,
            appServerRpcRetryEnabled: true,
            appServerRpcTimedOut: false,
            appServerRpcErrorCode: "",
            appServerRequestPayloadBytes: 188,
            appServerRequestParamBytes: 96,
            appServerResponsePayloadBytes: 45678,
            fallbackMs: 8,
            mergeMs: 2,
            fallbackCachePersistentRestored: true,
            fallbackCacheDecision: "miss-rebuild",
            fallbackBaselineSourceCount: 9,
            fallbackBaselineResultCount: 1,
            fallbackSourceSnapshotHit: true,
            fallbackSourceSnapshotRawCount: 12,
            coldPathOwner: "fallback-baseline",
            coldPathReason: "miss-rebuild:rollout",
          },
        },
      });
      return;
    }
    if (url.pathname === "/api/status") {
      assert.equal(url.searchParams.get("muxMetrics"), "1");
      send(200, muxStatusFixture());
      return;
    }
    if (url.pathname === "/api/threads/thread-private-1") {
      assert.equal(url.searchParams.get("mode"), "recent");
      send(200, {
        thread: {
          id: "thread-private-1",
          name: "PRIVATE DETAIL TITLE SHOULD NOT LEAK",
          mobileReadMode: "projection-active-overlay",
          mobileDetailResponseBudget: {
            version: "thread-detail-response-budget-v2",
            applied: true,
            progressiveActiveBudgetApplied: true,
            progressiveActiveBudgetReason: "active-byte-pressure",
            originalItemCount: 96,
            retainedItemCount: 31,
            omittedOperationItems: 14,
            omittedReasoningItems: 3,
            omittedAssistantItems: 7,
            progressiveReplayAssistantItems: 24,
            limitedReplayAssistantItems: 7,
            progressiveCompletedReplayAssistantItems: 12,
            progressiveCompletedReplayAssistantBudgetApplied: true,
            progressiveCompletedReplayAssistantBudgetReason: "active-byte-pressure",
            progressiveCompletedReplayAssistantBudgetScope: "active-first-paint",
            limitedCompletedReplayAssistantItems: 5,
            completedReplayAssistantItemsBefore: 18,
            completedReplayAssistantItemsAfter: 13,
            completedReplayOmittedAssistantItems: 5,
            omittedVisibleItems: 2,
            activeTurnCount: 1,
            staleActiveTurnCount: 1,
            activeOperationItems: 6,
            activeReasoningItems: 1,
            activeAssistantItems: 4,
            configuredActiveOperationItems: 12,
            configuredActiveReasoningItems: 2,
            configuredActiveAssistantItems: 8,
            progressiveActiveOriginalBytes: 240000,
            progressiveActiveTurnOriginalBytes: 86000,
            progressiveActiveOriginalItemCount: 96,
            progressiveActiveTurnOriginalItemCount: 63,
            activeProgressiveItemThreshold: 50,
            activeProgressiveByteThreshold: 49152,
            activeProgressiveThreadByteThreshold: 163840,
            progressiveActiveUserTextChars: 10000,
            truncatedActiveUserMessageItems: 1,
            activeUserInputOriginalChars: 25000,
            activeUserInputRetainedChars: 9000,
            omittedActiveUserInputChars: 16000,
            progressiveCompletedUserTextChars: 1024,
            progressiveCompletedUserInputBudgetApplied: true,
            progressiveCompletedUserInputBudgetReason: "first-paint-byte-pressure",
            progressiveCompletedUserInputBudgetScope: "active-first-paint",
            progressiveCompletedUserInputBytesBeforeBudget: 185000,
            progressiveCompletedUserInputBytesAfterBudget: 158000,
            truncatedCompletedUserInputItems: 8,
            completedUserInputOriginalChars: 31000,
            completedUserInputRetainedChars: 8192,
            omittedCompletedUserInputChars: 22808,
            progressiveCompletedUsageBudgetApplied: true,
            progressiveCompletedUsageBudgetReason: "first-paint-byte-pressure",
            progressiveCompletedUsageBudgetScope: "active-first-paint",
            progressiveCompletedUsageBytesBeforeBudget: 158000,
            progressiveCompletedUsageBytesAfterBudget: 149000,
            truncatedCompletedUsageItems: 6,
            completedUsageOriginalBytes: 9300,
            completedUsageRetainedBytes: 3900,
            omittedCompletedUsageBytes: 5400,
            progressiveActiveTextChars: 12000,
            truncatedActiveTextItems: 2,
            activeTextOriginalChars: 58000,
            activeTextRetainedChars: 19000,
            omittedActiveTextChars: 39000,
            progressiveActiveOperationPayloadChars: 6000,
            truncatedActiveOperationPayloadItems: 3,
            activeOperationPayloadOriginalChars: 44000,
            activeOperationPayloadRetainedChars: 14000,
            omittedActiveOperationPayloadChars: 30000,
            progressiveVisibleItemBudgetApplied: true,
            progressiveVisibleItemBudgetReason: "progressive-visible-item-ceiling",
            progressiveVisibleItemCeiling: 48,
            progressiveVisibleItemOriginalCount: 96,
            progressiveVisibleItemRetainedCount: 48,
            progressiveActiveFirstPaintThreadByteCeiling: 98304,
            progressiveActiveFirstPaintItemBudgetApplied: true,
            progressiveActiveFirstPaintItemBudgetReason: "progressive-active-first-paint-byte-ceiling",
            progressiveActiveFirstPaintBytesBeforeItemBudget: 150000,
            progressiveActiveFirstPaintBytesAfterItemBudget: 92000,
            progressiveActiveFirstPaintOmittedVisibleItems: 6,
            progressiveActiveFirstPaintOverCeilingBytes: 0,
            retainedVisibleItemCountByKind: { operation: 12, assistant: 4, userMessage: 1 },
            retainedVisibleItemBytesByKind: { operation: 52000, assistant: 18000, userMessage: 9000 },
            retainedAssistantItemCountByTurnState: { active: 2, completed: 2 },
            retainedAssistantItemBytesByTurnState: { active: 7000, completed: 11000 },
            retainedAssistantItemBytesByShape: {
              directText: 6000,
              contentText: 9000,
              contentAuxiliary: 1000,
              itemAuxiliary: 2000,
            },
            retainedActiveAssistantItemBytesByShape: {
              directText: 2500,
              contentText: 3500,
              itemAuxiliary: 1000,
            },
            retainedCompletedAssistantItemBytesByShape: {
              directText: 3500,
              contentText: 5500,
              contentAuxiliary: 1000,
              itemAuxiliary: 1000,
            },
            retainedUserInputItemCountByTurnState: { completed: 2, active: 1 },
            retainedUserInputItemBytesByTurnState: { completed: 12000, active: 3000 },
            retainedUserInputItemBytesByShape: {
              directText: 9000,
              contentText: 2500,
              inlineImageData: 1500,
              contentAuxiliary: 1000,
              itemAuxiliary: 1000,
            },
            retainedActiveUserInputItemBytesByShape: {
              directText: 2000,
              contentText: 500,
              inlineImageData: 400,
              itemAuxiliary: 100,
            },
            retainedCompletedUserInputItemBytesByShape: {
              directText: 7000,
              contentText: 2000,
              inlineImageData: 1100,
              contentAuxiliary: 1000,
              itemAuxiliary: 900,
            },
            retainedVisibleItemCountForByteStats: 31,
            retainedVisibleItemBytesForByteStats: 88000,
            retainedVisibleItemLargestKind: "operation",
            retainedVisibleItemLargestBytes: 13000,
            progressiveCompletedTextBudgetApplied: true,
            progressiveCompletedTextBudgetReason: "first-paint-byte-ceiling",
            progressiveCompletedTextBudgetScope: "active-first-paint",
            progressiveCompletedTextBudgetProtectedLatestTurn: false,
            progressiveCompletedTextBudgetSkippedLatestTurnCount: 0,
            progressiveCompletedTextChars: 8192,
            completedTextOriginalChars: 45000,
            completedTextRetainedChars: 12000,
            omittedCompletedTextChars: 33000,
            progressiveFirstPaintThreadByteCeiling: 163840,
            progressiveFirstPaintBytesBeforeTextBudget: 210000,
            progressiveFirstPaintBytesAfterTextBudget: 150000,
            privatePrompt: "SHOULD NOT LEAK",
          },
          turns: [{
            id: "turn-private",
            items: [{ text: "PRIVATE MESSAGE BODY SHOULD NOT LEAK" }],
          }],
          mobileDiagnostics: {
            threadDetailTimings: {
              readDecision: "projection-active-overlay",
              coldPathOwner: "warm-path",
              coldPathReason: "warm-projection-active-overlay",
              projectionState: "hit",
              activeOverlayAction: "use-projection-overlay",
              activeOverlayReason: "overlay-evidence-complete",
              activeOverlaySource: "projection-live",
              activeOverlayItems: 3,
              activeOverlayOperationItems: 1,
              activeOverlayUploadItems: 0,
              activeOverlayAssistantItems: 1,
              activeOverlayReceiptItems: 1,
              activeOverlayWindowFirst: true,
              totalMs: 42,
              summaryMs: 3,
              projectionMs: 4,
              activeOverlayMs: 5,
              activeOverlayProjectionLookupMs: 2,
              activeOverlayBackfillWindowMs: 7,
              activeOverlayFullProjectionMs: 0,
              activeOverlayHistoryBaselineMs: 3,
              activeOverlayMergeMs: 1,
              prepareResponseMs: 6,
              threadReadMs: 0,
            },
          },
        },
      });
      return;
    }
    send(404, { error: "not_found" });
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = await listen(server);

  const report = await run(parseArgs(["--server", baseUrl, "--json", "--no-auth", "--require-active-overlay"]));

  assert.equal(report.ok, true);
  assert.equal(report.threadList.coldPathOwner, "fallback-baseline");
  assert.equal(report.threadList.coldPathReason, "miss-rebuild:rollout");
  assert.equal(report.threadList.appServerRequestedLimit, 40);
  assert.equal(report.threadList.appServerRequestLimit, 500);
  assert.equal(report.threadList.appServerRequestReason, "default-preserve-visible-entry-window");
  assert.equal(report.threadList.appServerOverfetchFactor, 13);
  assert.equal(report.threadList.appServerRpcMs, 10);
  assert.equal(report.threadList.appServerVisibleFilterMs, 1);
  assert.equal(report.threadList.appServerWorkspaceFilterMs, 1);
  assert.equal(report.threadList.appServerPostProcessMs, 2);
  assert.equal(report.threadList.appServerMeasuredMs, 12);
  assert.equal(report.threadList.appServerUnattributedMs, 0);
  assert.equal(report.threadList.appServerRawCount, 3);
  assert.equal(report.threadList.appServerVisibleCount, 2);
  assert.equal(report.threadList.appServerFilteredCount, 1);
  assert.equal(report.threadList.appServerTransportKind, "external-jsonl-tcp");
  assert.equal(report.threadList.appServerEndpointKind, "profile-mux-file");
  assert.equal(report.threadList.appServerEndpointProtocol, "jsonl-tcp");
  assert.equal(report.threadList.appServerRpcAttemptCount, 1);
  assert.equal(report.threadList.appServerRpcTimeoutMs, 12000);
  assert.equal(report.threadList.appServerRpcRetryEnabled, true);
  assert.equal(report.threadList.appServerRpcTimedOut, false);
  assert.equal(report.threadList.appServerRpcErrorCode, "");
  assert.equal(report.threadList.appServerRequestPayloadBytes, 188);
  assert.equal(report.threadList.appServerRequestParamBytes, 96);
  assert.equal(report.threadList.appServerResponsePayloadBytes, 45678);
  assert.equal(report.threadList.fallbackCachePersistentRestored, true);
  assert.equal(report.muxRuntime.transport, "external-jsonl-tcp");
  assert.equal(report.muxRuntime.endpointKind, "profile-mux-file");
  assert.equal(report.muxRuntime.endpointProtocol, "jsonl-tcp");
  assert.equal(report.muxRuntime.isProfileMuxEndpoint, true);
  assert.equal(report.muxRuntime.sharedRequired, true);
  assert.equal(report.muxRuntime.persistentOwnedMux, true);
  assert.equal(report.muxRuntime.mobileOwnedMuxRunning, false);
  assert.equal(report.muxRuntime.mobileEcho, true);
  assert.equal(report.muxRuntime.notificationReplay, true);
  assert.equal(report.muxRuntime.serverRequestProxy, true);
  assert.equal(report.muxRuntime.threadGoalRpc, true);
  assert.equal(report.muxRuntime.muxMetricsRpc, true);
  assert.equal(report.muxMetrics.supported, true);
  assert.equal(report.muxMetrics.ok, true);
  assert.equal(report.muxMetrics.threadList.method, "thread/list");
  assert.equal(report.muxMetrics.threadList.count, 1);
  assert.equal(report.muxMetrics.threadList.lastMs, 11);
  assert.equal(report.muxMetrics.threadList.lastRequestBytes, 188);
  assert.equal(report.muxMetrics.threadList.lastResponseBytes, 45678);
  assert.equal(report.threadList.fallbackSourceSnapshotHit, true);
  assert.equal(report.threadList.fallbackSourceSnapshotRawCount, 12);
  assert.equal(report.publicConfig.threadListFallbackPrewarm.completed, true);
  assert.equal(report.publicConfig.threadListFallbackPrewarm.lastSourceSnapshotHit, true);
  assert.equal(report.publicConfig.threadListFallbackPrewarm.lastResultCount, 1);
  assert.equal(report.detail.readMode, "projection-active-overlay");
  assert.equal(report.detail.activeOverlayReason, "overlay-evidence-complete");
  assert.equal(report.detail.activeOverlayGate, "ready");
  assert.equal(report.detail.activeOverlayNextAction, "observe-active-overlay-readback");
  assert.equal(report.detail.activeOverlayAssistantItems, 1);
  assert.equal(report.detail.activeOverlayWindowFirst, true);
  assert.equal(report.detail.projectionMs, 4);
  assert.equal(report.detail.activeOverlayProjectionLookupMs, 2);
  assert.equal(report.detail.activeOverlayBackfillWindowMs, 7);
  assert.equal(report.detail.activeOverlayFullProjectionMs, 0);
  assert.equal(report.detail.activeOverlayHistoryBaselineMs, 3);
  assert.equal(report.detail.prepareResponseMs, 6);
  assert.equal(report.detail.threadReadMs, 0);
  assert.equal(report.detail.responseBudgetVersion, "thread-detail-response-budget-v2");
  assert.equal(report.detail.responseBudgetApplied, true);
  assert.equal(report.detail.responseBudgetProgressiveActiveApplied, true);
  assert.equal(report.detail.responseBudgetProgressiveActiveReason, "active-byte-pressure");
  assert.equal(report.detail.responseBudgetOriginalItemCount, 96);
  assert.equal(report.detail.responseBudgetRetainedItemCount, 31);
  assert.equal(report.detail.responseBudgetOmittedOperationItems, 14);
  assert.equal(report.detail.responseBudgetOmittedReasoningItems, 3);
  assert.equal(report.detail.responseBudgetOmittedAssistantItems, 7);
  assert.equal(report.detail.responseBudgetProgressiveReplayAssistantItems, 24);
  assert.equal(report.detail.responseBudgetLimitedReplayAssistantItems, 7);
  assert.equal(report.detail.responseBudgetProgressiveCompletedReplayAssistantItems, 12);
  assert.equal(report.detail.responseBudgetProgressiveCompletedReplayAssistantBudgetApplied, true);
  assert.equal(report.detail.responseBudgetProgressiveCompletedReplayAssistantBudgetReason, "active-byte-pressure");
  assert.equal(report.detail.responseBudgetProgressiveCompletedReplayAssistantBudgetScope, "active-first-paint");
  assert.equal(report.detail.responseBudgetLimitedCompletedReplayAssistantItems, 5);
  assert.equal(report.detail.responseBudgetCompletedReplayAssistantItemsBefore, 18);
  assert.equal(report.detail.responseBudgetCompletedReplayAssistantItemsAfter, 13);
  assert.equal(report.detail.responseBudgetCompletedReplayOmittedAssistantItems, 5);
  assert.equal(report.detail.responseBudgetOmittedVisibleItems, 2);
  assert.equal(report.detail.responseBudgetActiveTurnCount, 1);
  assert.equal(report.detail.responseBudgetStaleActiveTurnCount, 1);
  assert.equal(report.detail.responseBudgetActiveOperationItems, 6);
  assert.equal(report.detail.responseBudgetConfiguredActiveOperationItems, 12);
  assert.equal(report.detail.responseBudgetProgressiveActiveOriginalBytes, 240000);
  assert.equal(report.detail.responseBudgetProgressiveActiveTurnOriginalBytes, 86000);
  assert.equal(report.detail.responseBudgetTruncatedActiveUserInputItems, 1);
  assert.equal(report.detail.responseBudgetOmittedActiveUserInputChars, 16000);
  assert.equal(report.detail.responseBudgetProgressiveCompletedUserTextChars, 1024);
  assert.equal(report.detail.responseBudgetProgressiveCompletedUserInputBudgetApplied, true);
  assert.equal(report.detail.responseBudgetProgressiveCompletedUserInputBudgetReason, "first-paint-byte-pressure");
  assert.equal(report.detail.responseBudgetProgressiveCompletedUserInputBudgetScope, "active-first-paint");
  assert.equal(report.detail.responseBudgetProgressiveCompletedUserInputBytesBeforeBudget, 185000);
  assert.equal(report.detail.responseBudgetProgressiveCompletedUserInputBytesAfterBudget, 158000);
  assert.equal(report.detail.responseBudgetTruncatedCompletedUserInputItems, 8);
  assert.equal(report.detail.responseBudgetCompletedUserInputOriginalChars, 31000);
  assert.equal(report.detail.responseBudgetCompletedUserInputRetainedChars, 8192);
  assert.equal(report.detail.responseBudgetOmittedCompletedUserInputChars, 22808);
  assert.equal(report.detail.responseBudgetProgressiveCompletedUsageBudgetApplied, true);
  assert.equal(report.detail.responseBudgetProgressiveCompletedUsageBudgetReason, "first-paint-byte-pressure");
  assert.equal(report.detail.responseBudgetProgressiveCompletedUsageBudgetScope, "active-first-paint");
  assert.equal(report.detail.responseBudgetProgressiveCompletedUsageBytesBeforeBudget, 158000);
  assert.equal(report.detail.responseBudgetProgressiveCompletedUsageBytesAfterBudget, 149000);
  assert.equal(report.detail.responseBudgetTruncatedCompletedUsageItems, 6);
  assert.equal(report.detail.responseBudgetCompletedUsageOriginalBytes, 9300);
  assert.equal(report.detail.responseBudgetCompletedUsageRetainedBytes, 3900);
  assert.equal(report.detail.responseBudgetOmittedCompletedUsageBytes, 5400);
  assert.equal(report.detail.responseBudgetTruncatedActiveTextItems, 2);
  assert.equal(report.detail.responseBudgetOmittedActiveTextChars, 39000);
  assert.equal(report.detail.responseBudgetTruncatedActiveOperationPayloadItems, 3);
  assert.equal(report.detail.responseBudgetOmittedActiveOperationPayloadChars, 30000);
  assert.equal(report.detail.responseBudgetProgressiveVisibleItemBudgetApplied, true);
  assert.equal(report.detail.responseBudgetProgressiveVisibleItemBudgetReason, "progressive-visible-item-ceiling");
  assert.equal(report.detail.responseBudgetProgressiveActiveFirstPaintThreadByteCeiling, 98304);
  assert.equal(report.detail.responseBudgetProgressiveActiveFirstPaintItemBudgetApplied, true);
  assert.equal(report.detail.responseBudgetProgressiveActiveFirstPaintItemBudgetReason, "progressive-active-first-paint-byte-ceiling");
  assert.equal(report.detail.responseBudgetProgressiveActiveFirstPaintBytesBeforeItemBudget, 150000);
  assert.equal(report.detail.responseBudgetProgressiveActiveFirstPaintBytesAfterItemBudget, 92000);
  assert.equal(report.detail.responseBudgetProgressiveActiveFirstPaintOmittedVisibleItems, 6);
  assert.equal(report.detail.responseBudgetProgressiveActiveFirstPaintOverCeilingBytes, 0);
  assert.deepEqual(report.detail.responseBudgetRetainedVisibleItemCountByKind, { operation: 12, assistant: 4, userMessage: 1 });
  assert.deepEqual(report.detail.responseBudgetRetainedVisibleItemBytesByKind, { operation: 52000, assistant: 18000, userMessage: 9000 });
  assert.deepEqual(report.detail.responseBudgetRetainedAssistantItemCountByTurnState, { active: 2, completed: 2 });
  assert.deepEqual(report.detail.responseBudgetRetainedAssistantItemBytesByTurnState, { active: 7000, completed: 11000 });
  assert.deepEqual(report.detail.responseBudgetRetainedAssistantItemBytesByShape, {
    directText: 6000,
    contentText: 9000,
    contentAuxiliary: 1000,
    itemAuxiliary: 2000,
  });
  assert.deepEqual(report.detail.responseBudgetRetainedActiveAssistantItemBytesByShape, {
    directText: 2500,
    contentText: 3500,
    itemAuxiliary: 1000,
  });
  assert.deepEqual(report.detail.responseBudgetRetainedCompletedAssistantItemBytesByShape, {
    directText: 3500,
    contentText: 5500,
    contentAuxiliary: 1000,
    itemAuxiliary: 1000,
  });
  assert.deepEqual(report.detail.responseBudgetRetainedUserInputItemCountByTurnState, { completed: 2, active: 1 });
  assert.deepEqual(report.detail.responseBudgetRetainedUserInputItemBytesByTurnState, { completed: 12000, active: 3000 });
  assert.deepEqual(report.detail.responseBudgetRetainedUserInputItemBytesByShape, {
    directText: 9000,
    contentText: 2500,
    inlineImageData: 1500,
    contentAuxiliary: 1000,
    itemAuxiliary: 1000,
  });
  assert.deepEqual(report.detail.responseBudgetRetainedActiveUserInputItemBytesByShape, {
    directText: 2000,
    contentText: 500,
    inlineImageData: 400,
    itemAuxiliary: 100,
  });
  assert.deepEqual(report.detail.responseBudgetRetainedCompletedUserInputItemBytesByShape, {
    directText: 7000,
    contentText: 2000,
    inlineImageData: 1100,
    contentAuxiliary: 1000,
    itemAuxiliary: 900,
  });
  assert.equal(report.detail.responseBudgetRetainedVisibleItemCountForByteStats, 31);
  assert.equal(report.detail.responseBudgetRetainedVisibleItemBytesForByteStats, 88000);
  assert.equal(report.detail.responseBudgetRetainedVisibleItemLargestKind, "operation");
  assert.equal(report.detail.responseBudgetRetainedVisibleItemLargestBytes, 13000);
  assert.equal(report.detail.responseBudgetProgressiveCompletedTextBudgetApplied, true);
  assert.equal(report.detail.responseBudgetProgressiveCompletedTextBudgetScope, "active-first-paint");
  assert.equal(report.detail.responseBudgetProgressiveFirstPaintBytesBeforeTextBudget, 210000);
  assert.equal(report.detail.responseBudgetProgressiveFirstPaintBytesAfterTextBudget, 150000);
  assert.equal(report.decision.evidence.detailResponseBudgetProgressiveActiveApplied, true);
  assert.equal(report.decision.evidence.detailResponseBudgetProgressiveCompletedReplayAssistantBudgetApplied, true);
  assert.equal(report.decision.evidence.detailResponseBudgetLimitedCompletedReplayAssistantItems, 5);
  assert.equal(report.decision.evidence.detailResponseBudgetOmittedActiveTextChars, 39000);
  assert.equal(report.decision.evidence.detailResponseBudgetProgressiveCompletedUserInputBudgetApplied, true);
  assert.equal(report.decision.evidence.detailResponseBudgetOmittedCompletedUserInputChars, 22808);
  assert.equal(report.decision.evidence.detailResponseBudgetProgressiveCompletedUsageBudgetApplied, true);
  assert.equal(report.decision.evidence.detailResponseBudgetOmittedCompletedUsageBytes, 5400);
  assert.equal(report.decision.evidence.detailResponseBudgetProgressiveActiveFirstPaintItemBudgetApplied, true);
  assert.equal(report.decision.evidence.detailResponseBudgetProgressiveActiveFirstPaintBytesAfterItemBudget, 92000);
  assert.deepEqual(report.decision.evidence.detailResponseBudgetRetainedVisibleItemBytesByKind, {
    operation: 52000,
    assistant: 18000,
    userMessage: 9000,
  });
  assert.deepEqual(report.decision.evidence.detailResponseBudgetRetainedAssistantItemBytesByTurnState, {
    active: 7000,
    completed: 11000,
  });
  assert.deepEqual(report.decision.evidence.detailResponseBudgetRetainedAssistantItemBytesByShape, {
    directText: 6000,
    contentText: 9000,
    contentAuxiliary: 1000,
    itemAuxiliary: 2000,
  });
  assert.deepEqual(report.decision.evidence.detailResponseBudgetRetainedActiveAssistantItemBytesByShape, {
    directText: 2500,
    contentText: 3500,
    itemAuxiliary: 1000,
  });
  assert.deepEqual(report.decision.evidence.detailResponseBudgetRetainedCompletedAssistantItemBytesByShape, {
    directText: 3500,
    contentText: 5500,
    contentAuxiliary: 1000,
    itemAuxiliary: 1000,
  });
  assert.deepEqual(report.decision.evidence.detailResponseBudgetRetainedUserInputItemBytesByShape, {
    directText: 9000,
    contentText: 2500,
    inlineImageData: 1500,
    contentAuxiliary: 1000,
    itemAuxiliary: 1000,
  });
  assert.deepEqual(report.decision.evidence.detailResponseBudgetRetainedActiveUserInputItemBytesByShape, {
    directText: 2000,
    contentText: 500,
    inlineImageData: 400,
    itemAuxiliary: 100,
  });
  assert.equal(report.decision.evidence.detailResponseBudgetRetainedVisibleItemLargestKind, "operation");
  assert.match(report.threadList.firstThreadHash, /^[a-f0-9]{16}$/);
  assert.match(report.detail.requestedThreadHash, /^[a-f0-9]{16}$/);
  assert.deepEqual(seen.map((item) => item.path), [
    "/api/public-config",
    "/api/threads",
    "/api/status",
    "/api/threads/thread-private-1",
  ]);
  assert.equal(seen.every((item) => item.authorization === ""), true);
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /PRIVATE|MESSAGE BODY|do not leak|SHOULD NOT LEAK|endpoint\.json|10\.0\.0\.5|12345/);
});

test("phase B readback smoke waits for prewarm settle before reading thread list", async (t) => {
  const publicConfigs = [
    {
      clientBuildId: "0.1.11|codex-mobile-shell-test",
      threadListFallbackPrewarm: {
        enabled: true,
        scheduled: true,
        running: false,
        completed: false,
        lastStatus: "",
      },
    },
    {
      clientBuildId: "0.1.11|codex-mobile-shell-test",
      threadListFallbackPrewarm: {
        enabled: true,
        scheduled: false,
        running: true,
        completed: false,
        lastStatus: "",
      },
    },
    {
      clientBuildId: "0.1.11|codex-mobile-shell-test",
      threadListFallbackPrewarm: {
        enabled: true,
        scheduled: false,
        running: false,
        completed: true,
        lastStatus: "completed",
        lastCacheDecision: "miss-rebuild",
        lastSourceSnapshotHit: true,
        lastResultCount: 2,
      },
    },
  ];
  const seen = [];
  const server = createMockServer(({ url, send }) => {
    seen.push(url.pathname);
    if (url.pathname === "/api/public-config") {
      send(200, publicConfigs.shift() || publicConfigs[publicConfigs.length - 1]);
      return;
    }
    if (url.pathname === "/api/threads") {
      send(200, {
        data: [{ id: "thread-1", name: "private title" }],
        mobileDiagnostics: {
          threadListTimings: {
            fallbackCacheHit: true,
            fallbackCacheDecision: "hit",
            coldPathOwner: "warm-fallback-cache",
            coldPathReason: "cache-hit",
          },
        },
      });
      return;
    }
    if (url.pathname === "/api/status") {
      send(200, muxStatusFixture());
      return;
    }
    send(404, { error: "not_found" });
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = await listen(server);
  const options = parseArgs([
    "--server",
    baseUrl,
    "--no-auth",
    "--skip-detail",
    "--prewarm-settle-ms",
    "1000",
    "--prewarm-poll-ms",
    "50",
  ]);
  options.sleep = async () => {};

  const report = await run(options);

  assert.equal(report.ok, true);
  assert.equal(report.publicConfigInitial.threadListFallbackPrewarm.scheduled, true);
  assert.equal(report.publicConfig.threadListFallbackPrewarm.completed, true);
  assert.equal(report.publicConfig.threadListFallbackPrewarm.lastSourceSnapshotHit, true);
  assert.equal(report.threadListPrewarmSettle.attempted, true);
  assert.equal(report.threadListPrewarmSettle.settled, true);
  assert.equal(report.threadListPrewarmSettle.reason, "prewarm-completed");
  assert.equal(report.threadListPrewarmSettle.sampleCount, 3);
  assert.ok(report.threadListPrewarmSettle.elapsedMs <= 50);
  assert.equal(report.threadList.coldPathOwner, "warm-fallback-cache");
  assert.deepEqual(seen, [
    "/api/public-config",
    "/api/public-config",
    "/api/public-config",
    "/api/threads",
    "/api/status",
  ]);
  assert.doesNotMatch(JSON.stringify(report), /private title/);
});

test("phase B readback smoke fails when required thread-list cold path fields are missing", async (t) => {
  const server = createMockServer(({ url, send }) => {
    if (url.pathname === "/api/public-config") {
      send(200, { clientBuildId: "test-build" });
      return;
    }
    if (url.pathname === "/api/threads") {
      send(200, {
        data: [{ id: "thread-1", name: "private title" }],
        mobileDiagnostics: {
          threadListTimings: {
            fallbackCacheDecision: "hit",
          },
        },
      });
      return;
    }
    if (url.pathname === "/api/status") {
      send(200, muxStatusFixture());
      return;
    }
    if (url.pathname === "/api/threads/thread-1") {
      send(200, {
        thread: {
          id: "thread-1",
          mobileReadMode: "projection-v4-cache",
          turns: [],
          mobileDiagnostics: {
            threadDetailTimings: {
              readDecision: "projection-hit",
            },
          },
        },
      });
      return;
    }
    send(404, { error: "not_found" });
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = await listen(server);

  const report = await run(parseArgs(["--server", baseUrl, "--no-auth"]));
  assert.equal(report.ok, false);
  assert.equal(report.failure, "threadListColdPath");

  const allowed = await run(parseArgs(["--server", baseUrl, "--no-auth", "--allow-missing-cold-path"]));
  assert.equal(allowed.ok, true);
});

test("phase B readback smoke verifies deferred fallback follow-up and warm check", async (t) => {
  const threadListResponses = [
    {
      data: [{ id: "thread-1", name: "private title" }],
      mobileDeferredFallback: true,
      mobileDiagnostics: {
        threadListTimings: {
          totalMs: 25,
          appServerMs: 20,
          fallbackMs: 0,
          fallbackDeferred: true,
          fallbackDeferredReason: "active-thread-detail",
          coldPathOwner: "deferred-fallback",
          coldPathReason: "active-thread-detail",
        },
      },
    },
    {
      data: [{ id: "thread-1", name: "private title" }],
      mobileDiagnostics: {
        threadListTimings: {
          totalMs: 1200,
          appServerMs: 120,
          fallbackMs: 900,
          fallbackCacheDecision: "miss-rebuild",
          fallbackBaselineSourceCount: 30,
          fallbackBaselineResultCount: 20,
          coldPathOwner: "fallback-baseline",
          coldPathReason: "miss-rebuild:rollout",
        },
      },
    },
    {
      data: [{ id: "thread-1", name: "private title" }],
      mobileDiagnostics: {
        threadListTimings: {
          totalMs: 90,
          appServerMs: 80,
          fallbackMs: 1,
          fallbackCacheHit: true,
          fallbackCacheDecision: "hit",
          fallbackCacheIncrementalUpdates: 0,
          coldPathOwner: "warm-fallback-cache",
          coldPathReason: "cache-hit",
        },
      },
    },
  ];
  const seen = [];
  const server = createMockServer(({ url, send }) => {
    seen.push(url.pathname);
    if (url.pathname === "/api/public-config") {
      send(200, { clientBuildId: "0.1.11|codex-mobile-shell-test" });
      return;
    }
    if (url.pathname === "/api/threads") {
      send(200, threadListResponses.shift() || threadListResponses[threadListResponses.length - 1]);
      return;
    }
    if (url.pathname === "/api/status") {
      send(200, muxStatusFixture());
      return;
    }
    if (url.pathname === "/api/threads/thread-1") {
      send(200, {
        thread: {
          id: "thread-1",
          mobileReadMode: "projection-active-overlay",
          turns: [{ id: "turn-1", items: [] }],
          mobileDiagnostics: {
            threadDetailTimings: {
              readDecision: "projection-active-overlay",
              coldPathOwner: "warm-path",
              coldPathReason: "warm-projection-active-overlay",
              projectionState: "hit",
              activeOverlayAction: "use-projection-overlay",
              activeOverlayReason: "overlay-evidence-complete",
            },
          },
        },
      });
      return;
    }
    send(404, { error: "not_found" });
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = await listen(server);

  const report = await run(parseArgs(["--server", baseUrl, "--no-auth", "--require-active-overlay"]));

  assert.equal(report.ok, true);
  assert.equal(report.threadList.coldPathOwner, "deferred-fallback");
  assert.equal(report.threadListAfterDeferred.coldPathOwner, "fallback-baseline");
  assert.equal(report.threadListAfterDeferred.fallbackCacheDecision, "miss-rebuild");
  assert.equal(report.threadListWarmCheck.coldPathOwner, "warm-fallback-cache");
  assert.equal(report.threadListWarmCheck.fallbackCacheHit, true);
  assert.equal(report.decision.status, "observe");
  assert.equal(report.decision.reason, "deferred-followup-warmed");
  assert.equal(report.decision.nextAction, "observe-cold-start-first-rebuild-cost");
  assert.deepEqual(seen, [
    "/api/public-config",
    "/api/threads",
    "/api/status",
    "/api/threads/thread-1",
    "/api/threads",
    "/api/threads",
  ]);
  assert.doesNotMatch(JSON.stringify(report), /private title/);
});

test("phase B readback smoke verifies ordinary cold fallback warm check", async (t) => {
  const threadListResponses = [
    {
      data: [{ id: "thread-1", name: "private title" }],
      mobileDiagnostics: {
        threadListTimings: {
          totalMs: 1300,
          appServerMs: 200,
          fallbackMs: 900,
          fallbackCacheDecision: "miss-rebuild",
          fallbackBaselineSourceCount: 30,
          fallbackBaselineResultCount: 20,
          coldPathOwner: "fallback-baseline",
          coldPathReason: "miss-rebuild:rollout",
        },
      },
    },
    {
      data: [{ id: "thread-1", name: "private title" }],
      mobileDiagnostics: {
        threadListTimings: {
          totalMs: 95,
          appServerMs: 85,
          fallbackMs: 1,
          fallbackCacheHit: true,
          fallbackCacheDecision: "hit",
          coldPathOwner: "warm-fallback-cache",
          coldPathReason: "cache-hit",
        },
      },
    },
  ];
  const seen = [];
  const server = createMockServer(({ url, send }) => {
    seen.push(url.pathname);
    if (url.pathname === "/api/public-config") {
      send(200, { clientBuildId: "0.1.11|codex-mobile-shell-test" });
      return;
    }
    if (url.pathname === "/api/threads") {
      send(200, threadListResponses.shift());
      return;
    }
    if (url.pathname === "/api/status") {
      send(200, muxStatusFixture());
      return;
    }
    if (url.pathname === "/api/threads/thread-1") {
      send(200, {
        thread: {
          id: "thread-1",
          mobileReadMode: "projection-active-overlay",
          turns: [{ id: "turn-1", items: [] }],
          mobileDiagnostics: {
            threadDetailTimings: {
              readDecision: "projection-active-overlay",
              coldPathOwner: "warm-path",
              coldPathReason: "warm-projection-active-overlay",
              projectionState: "hit",
              activeOverlayAction: "use-projection-overlay",
              activeOverlayReason: "overlay-evidence-complete",
            },
          },
        },
      });
      return;
    }
    send(404, { error: "not_found" });
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = await listen(server);

  const report = await run(parseArgs(["--server", baseUrl, "--no-auth", "--require-active-overlay"]));

  assert.equal(report.ok, true);
  assert.equal(report.threadList.coldPathOwner, "fallback-baseline");
  assert.equal(report.threadListWarmCheck.coldPathOwner, "warm-fallback-cache");
  assert.equal(report.threadListWarmCheck.fallbackCacheDecision, "hit");
  assert.equal(report.decision.status, "observe");
  assert.equal(report.decision.reason, "cold-start-rebuild-warmed");
  assert.deepEqual(seen, [
    "/api/public-config",
    "/api/threads",
    "/api/status",
    "/api/threads/thread-1",
    "/api/threads",
  ]);
  assert.doesNotMatch(JSON.stringify(report), /private title/);
});

test("phase B readback summary helpers keep only bounded metadata", () => {
  const publicConfig = summarizePublicConfig({
    clientBuildId: "0.1.11|codex-mobile-shell-test",
    threadListFallbackPrewarm: {
      enabled: true,
      completed: false,
      running: true,
      lastStatus: "running",
      lastErrorCode: `private-path-${"x".repeat(200)}`,
      privateThreadId: "thread-secret",
      privateTitle: "private title",
    },
  });
  assert.equal(publicConfig.threadListFallbackPrewarm.enabled, true);
  assert.equal(publicConfig.threadListFallbackPrewarm.running, true);
  assert.ok(publicConfig.threadListFallbackPrewarm.lastErrorCode.length <= 80);
  assert.doesNotMatch(JSON.stringify(publicConfig), /thread-secret|private title/);

  const list = summarizeThreadList({
    data: [{ id: "thread-secret", name: "private title" }],
    mobileDiagnostics: {
      threadListTimings: {
        coldPathOwner: "fallback-baseline",
        coldPathReason: "miss-rebuild:session-index",
        fallbackBaselineSourceCount: 1000000,
        fallbackBaselineFinalFilterInputCount: 1000000,
        fallbackBaselineFinalFilterOutputCount: 900000,
        fallbackBaselineMergeInputCount: 900000,
        fallbackBaselineMergeOutputCount: 800000,
        fallbackBaselineMergeDuplicateCount: 123,
        fallbackBaselineLimitDropCount: 456,
        fallbackRolloutFileStatCount: 12,
        fallbackRolloutStatusStatReadCount: 0,
        fallbackRolloutStatusStatReuseCount: 8,
        fallbackRolloutStatusTailBytes: 8192,
        fallbackSessionIndexReuseCount: 1,
        fallbackSessionIndexLineCount: 2500,
        appServerRequestedLimit: 40,
        appServerRequestLimit: 500,
        appServerRequestReason: "default-preserve-visible-entry-window",
        appServerOverfetchFactor: 12.5,
        appServerRpcMs: 120,
        appServerVisibleFilterMs: 5,
        appServerWorkspaceFilterMs: 7,
        appServerPostProcessMs: 12,
        appServerMeasuredMs: 132,
        appServerUnattributedMs: 8,
        appServerRawCount: 20,
        appServerVisibleCount: 18,
        appServerFilteredCount: 16,
        appServerTransportKind: "external-jsonl-tcp",
        appServerEndpointKind: "profile-mux-file",
        appServerEndpointProtocol: "jsonl-tcp",
        appServerRpcAttemptCount: 1,
        appServerRpcTimeoutMs: 12000,
        appServerRpcRetryEnabled: true,
        appServerRpcTimedOut: false,
        appServerRpcErrorCode: "",
        appServerRequestPayloadBytes: 188,
        appServerRequestParamBytes: 96,
        appServerResponsePayloadBytes: 45678,
        requestContextArchivedIdsReadCount: 1,
        requestContextSessionIndexReadCount: 1,
        requestContextCachedDisplayReadCount: 42,
        requestContextRolloutStatReadCount: 16,
        totalMs: 999999999,
      },
    },
  });
  assert.equal(list.coldPathOwner, "fallback-baseline");
  assert.equal(list.fallbackBaselineSourceCount, 100000);
  assert.equal(list.appServerRequestedLimit, 40);
  assert.equal(list.appServerRequestLimit, 500);
  assert.equal(list.appServerRequestReason, "default-preserve-visible-entry-window");
  assert.equal(list.appServerOverfetchFactor, 13);
  assert.equal(list.appServerRpcMs, 120);
  assert.equal(list.appServerVisibleFilterMs, 5);
  assert.equal(list.appServerWorkspaceFilterMs, 7);
  assert.equal(list.appServerPostProcessMs, 12);
  assert.equal(list.appServerMeasuredMs, 132);
  assert.equal(list.appServerUnattributedMs, 8);
  assert.equal(list.appServerRawCount, 20);
  assert.equal(list.appServerVisibleCount, 18);
  assert.equal(list.appServerFilteredCount, 16);
  assert.equal(list.appServerTransportKind, "external-jsonl-tcp");
  assert.equal(list.appServerEndpointKind, "profile-mux-file");
  assert.equal(list.appServerEndpointProtocol, "jsonl-tcp");
  assert.equal(list.appServerRpcAttemptCount, 1);
  assert.equal(list.appServerRpcTimeoutMs, 12000);
  assert.equal(list.appServerRpcRetryEnabled, true);
  assert.equal(list.appServerRpcTimedOut, false);
  assert.equal(list.appServerRpcErrorCode, "");
  assert.equal(list.appServerRequestPayloadBytes, 188);
  assert.equal(list.appServerRequestParamBytes, 96);
  assert.equal(list.appServerResponsePayloadBytes, 45678);
  assert.equal(list.requestContextArchivedIdsReadCount, 1);
  assert.equal(list.requestContextSessionIndexReadCount, 1);
  assert.equal(list.requestContextCachedDisplayReadCount, 42);
  assert.equal(list.requestContextRolloutStatReadCount, 16);
  assert.equal(list.fallbackBaselineFinalFilterInputCount, 100000);
  assert.equal(list.fallbackBaselineFinalFilterOutputCount, 100000);
  assert.equal(list.fallbackBaselineMergeInputCount, 100000);
  assert.equal(list.fallbackBaselineMergeOutputCount, 100000);
  assert.equal(list.fallbackBaselineMergeDuplicateCount, 123);
  assert.equal(list.fallbackBaselineLimitDropCount, 456);
  assert.equal(list.fallbackRolloutFileStatCount, 12);
  assert.equal(list.fallbackRolloutStatusStatReadCount, 0);
  assert.equal(list.fallbackRolloutStatusStatReuseCount, 8);
  assert.equal(list.fallbackRolloutStatusTailBytes, 8192);
  assert.equal(list.fallbackSessionIndexReuseCount, 1);
  assert.equal(list.fallbackSessionIndexLineCount, 2500);
  assert.equal(list.totalMs, 600000);
  assert.doesNotMatch(JSON.stringify(list), /private title|thread-secret/);

  const detail = summarizeThreadDetail({
    thread: {
      id: "thread-secret",
      name: "private title",
      mobileReadMode: "projection-active-overlay",
      turns: [{ id: "turn-1", text: "private message" }],
      mobileDiagnostics: {
        threadDetailTimings: {
          activeOverlayReason: "overlay-evidence-complete",
          activeOverlayItems: 5,
          activeOverlayAssistantItems: 1,
        },
      },
    },
  }, "thread-secret");
  assert.equal(detail.readMode, "projection-active-overlay");
  assert.equal(detail.turnCount, 1);
  assert.equal(detail.activeOverlayGate, "ready");
  assert.equal(detail.activeOverlayAssistantItems, 1);
  assert.doesNotMatch(JSON.stringify(detail), /private title|private message|thread-secret/);
});

test("phase B readback classifies active overlay gate reasons", () => {
  assert.deepEqual(classifyActiveOverlayGate({
    readMode: "projection-active-overlay",
    activeOverlayReason: "overlay-evidence-complete",
  }), {
    status: "ready",
    reason: "overlay-evidence-complete",
    nextAction: "observe-active-overlay-readback",
  });

  assert.deepEqual(classifyActiveOverlayGate({
    activeFullReadRequired: true,
    activeOverlayAction: "require-full-read",
    activeOverlayReason: "missing-active-turn-id",
  }), {
    status: "needs_repair",
    reason: "missing-active-turn-id",
    nextAction: "retain-active-turn-id",
  });

  assert.deepEqual(classifyActiveOverlayGate({
    activeFullReadRequired: true,
    activeOverlayAction: "require-full-read",
    projectionMissReason: "dynamic-summary-stale",
  }), {
    status: "needs_repair",
    reason: "projection-dynamic-summary-stale",
    nextAction: "allow-active-overlay-stale-window",
  });

  assert.deepEqual(classifyActiveOverlayGate({
    activeFullReadRequired: false,
  }), {
    status: "not-active",
    reason: "active-full-read-not-required",
    nextAction: "observe-active-overlay-readback",
  });
});
