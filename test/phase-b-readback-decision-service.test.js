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

test("phase B readback decision routes final-filter baseline reason to final-filter owner", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    threadList: {
      coldPathOwner: "fallback-baseline",
      coldPathReason: "miss-rebuild:final-filter-empty",
      fallbackCacheDecision: "miss-rebuild",
      fallbackBaselineFinalFilterInputCount: 20,
      fallbackBaselineFinalFilterOutputCount: 0,
      resultCount: 0,
    },
    detail: {
      readMode: "projection-v4-cache",
      readDecision: "projection-hit",
      coldPathOwner: "warm-path",
      coldPathReason: "warm-projection-cache",
    },
  });

  assert.equal(decision.status, "needs_repair");
  assert.equal(decision.owner, "thread-list-final-filter");
  assert.equal(decision.reason, "miss-rebuild:final-filter-empty");
  assert.equal(decision.nextAction, "optimize-thread-list-final-filter");
  assert.equal(decision.evidence.threadListFinalFilterInputCount, 20);
  assert.equal(decision.evidence.threadListFinalFilterOutputCount, 0);
});

test("phase B readback decision routes merge-dedupe baseline reason to merge owner", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    threadList: {
      coldPathOwner: "fallback-baseline",
      coldPathReason: "miss-rebuild:merge-dedupe",
      fallbackCacheDecision: "miss-rebuild",
      fallbackBaselineMergeInputCount: 30,
      fallbackBaselineMergeOutputCount: 12,
      fallbackBaselineMergeDuplicateCount: 18,
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
  assert.equal(decision.owner, "thread-list-fallback-merge");
  assert.equal(decision.reason, "miss-rebuild:merge-dedupe");
  assert.equal(decision.nextAction, "optimize-thread-list-fallback-merge");
  assert.equal(decision.evidence.threadListMergeInputCount, 30);
  assert.equal(decision.evidence.threadListMergeOutputCount, 12);
  assert.equal(decision.evidence.threadListMergeDuplicateCount, 18);
});

test("phase B readback decision routes limit-drop baseline reason to limit-window owner", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    threadList: {
      coldPathOwner: "fallback-baseline",
      coldPathReason: "miss-rebuild:limit-drop",
      fallbackCacheDecision: "miss-rebuild",
      fallbackBaselineLimitDropCount: 6,
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
  assert.equal(decision.owner, "thread-list-limit-window");
  assert.equal(decision.reason, "miss-rebuild:limit-drop");
  assert.equal(decision.nextAction, "review-thread-list-limit-window");
  assert.equal(decision.evidence.threadListLimitDropCount, 6);
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

test("phase B readback decision routes high warm list latency to app-server RPC owner", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    threadList: {
      coldPathOwner: "warm-fallback-cache",
      coldPathReason: "cache-hit",
      appServerMs: 2050,
      appServerRpcMs: 1980,
      appServerVisibleFilterMs: 20,
      appServerWorkspaceFilterMs: 15,
      appServerPostProcessMs: 35,
      appServerMeasuredMs: 2015,
      appServerUnattributedMs: 35,
      appServerRequestLimit: 80,
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
    },
    muxRuntime: {
      transport: "external-jsonl-tcp",
      endpointKind: "profile-mux-file",
      endpointProtocol: "jsonl-tcp",
      isProfileMuxEndpoint: true,
      sharedRequired: true,
      persistentOwnedMux: true,
      mobileOwnedMuxRunning: false,
      mobileEcho: true,
      notificationReplay: true,
      serverRequestProxy: true,
      threadGoalRpc: true,
      muxMetricsRpc: true,
    },
    muxMetrics: {
      supported: true,
      ok: true,
      pendingCount: 0,
      serverRequestCount: 1,
      trackedMethodCount: 2,
      threadList: {
        count: 3,
        errorCount: 0,
        totalMs: 2500,
        avgMs: 833,
        lastMs: 1980,
        maxMs: 1980,
        lastRequestBytes: 188,
        lastResponseBytes: 45678,
        lastAgeMs: 20,
      },
    },
    detail: {
      readMode: "projection-active-overlay",
      readDecision: "projection-active-overlay",
      coldPathOwner: "warm-path",
      coldPathReason: "warm-projection-active-overlay",
    },
  });

  assert.equal(decision.status, "needs_repair");
  assert.equal(decision.priority, "H2");
  assert.equal(decision.owner, "app-server-thread-list-rpc");
  assert.equal(decision.reason, "app-server-rpc-latency");
  assert.equal(decision.nextAction, "investigate-app-server-thread-list-rpc");
  assert.equal(decision.evidence.threadListAppServerMs, 2050);
  assert.equal(decision.evidence.threadListAppServerRpcMs, 1980);
  assert.equal(decision.evidence.threadListAppServerTransportKind, "external-jsonl-tcp");
  assert.equal(decision.evidence.threadListAppServerEndpointKind, "profile-mux-file");
  assert.equal(decision.evidence.threadListAppServerEndpointProtocol, "jsonl-tcp");
  assert.equal(decision.evidence.threadListAppServerRpcAttemptCount, 1);
  assert.equal(decision.evidence.threadListAppServerRpcTimeoutMs, 12000);
  assert.equal(decision.evidence.threadListAppServerRpcRetryEnabled, true);
  assert.equal(decision.evidence.threadListAppServerRpcTimedOut, false);
  assert.equal(decision.evidence.threadListAppServerRpcErrorCode, "");
  assert.equal(decision.evidence.threadListAppServerRequestPayloadBytes, 188);
  assert.equal(decision.evidence.threadListAppServerRequestParamBytes, 96);
  assert.equal(decision.evidence.threadListAppServerResponsePayloadBytes, 45678);
  assert.equal(decision.evidence.threadListMuxRuntimeEndpointKind, "profile-mux-file");
  assert.equal(decision.evidence.threadListMuxRuntimeMobileEcho, true);
  assert.equal(decision.evidence.threadListMuxRuntimeMuxMetricsRpc, true);
  assert.equal(decision.evidence.threadListMuxMetricsSupported, true);
  assert.equal(decision.evidence.threadListMuxMetricsOk, true);
  assert.equal(decision.evidence.threadListMuxServerRequestCount, 1);
  assert.equal(decision.evidence.threadListMuxTrackedMethodCount, 2);
  assert.equal(decision.evidence.threadListMuxRpcCount, 3);
  assert.equal(decision.evidence.threadListMuxRpcLastMs, 1980);
  assert.equal(decision.evidence.threadListMuxRequestBytes, 188);
  assert.equal(decision.evidence.threadListMuxResponseBytes, 45678);
});

test("phase B readback decision routes high RPC latency with unsupported mux metrics to shared mux runtime", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    threadList: {
      coldPathOwner: "fallback-source-snapshot",
      coldPathReason: "source-snapshot-hit",
      fallbackSourceSnapshotHit: true,
      appServerMs: 1996,
      appServerRpcMs: 1705,
      appServerVisibleFilterMs: 87,
      appServerWorkspaceFilterMs: 0,
      appServerPostProcessMs: 87,
      appServerMeasuredMs: 1792,
      appServerUnattributedMs: 0,
      appServerRequestLimit: 80,
      appServerTransportKind: "external-jsonl-tcp",
      appServerEndpointKind: "profile-mux-file",
      appServerEndpointProtocol: "jsonl-tcp",
      appServerRpcAttemptCount: 1,
      appServerRpcTimeoutMs: 12000,
      appServerRpcRetryEnabled: true,
      appServerRpcTimedOut: false,
      appServerRpcErrorCode: "",
      appServerRequestPayloadBytes: 185,
      appServerRequestParamBytes: 128,
      appServerResponsePayloadBytes: 235487,
    },
    muxRuntime: {
      transport: "external-jsonl-tcp",
      endpointKind: "profile-mux-file",
      endpointProtocol: "jsonl-tcp",
      isProfileMuxEndpoint: true,
      sharedRequired: true,
      persistentOwnedMux: true,
      mobileEcho: true,
      notificationReplay: true,
      serverRequestProxy: true,
      threadGoalRpc: true,
      muxMetricsRpc: false,
    },
    muxMetrics: {
      supported: false,
      ok: false,
      reason: "mux-metrics-unsupported",
    },
    detail: {
      readMode: "projection-active-overlay",
      readDecision: "projection-active-overlay",
      coldPathOwner: "warm-path",
      coldPathReason: "warm-projection-active-overlay",
    },
  });

  assert.equal(decision.status, "needs_repair");
  assert.equal(decision.priority, "H2");
  assert.equal(decision.owner, "shared-mux-runtime");
  assert.equal(decision.reason, "mux-metrics-unsupported");
  assert.equal(decision.nextAction, "restart-selected-shared-mux-before-rpc-repair");
  assert.equal(decision.evidence.threadListAppServerRpcMs, 1705);
  assert.equal(decision.evidence.threadListAppServerResponsePayloadBytes, 235487);
  assert.equal(decision.evidence.threadListMuxRuntimeTransport, "external-jsonl-tcp");
  assert.equal(decision.evidence.threadListMuxRuntimeEndpointKind, "profile-mux-file");
  assert.equal(decision.evidence.threadListMuxRuntimeMuxMetricsRpc, false);
  assert.equal(decision.evidence.threadListMuxMetricsSupported, false);
  assert.equal(decision.evidence.threadListMuxMetricsReason, "mux-metrics-unsupported");
});

test("phase B readback decision routes high warm list latency to local filter owner", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    threadList: {
      coldPathOwner: "fallback-source-snapshot",
      coldPathReason: "source-snapshot-hit",
      fallbackSourceSnapshotHit: true,
      appServerMs: 1300,
      appServerRpcMs: 200,
      appServerVisibleFilterMs: 840,
      appServerWorkspaceFilterMs: 20,
      appServerPostProcessMs: 860,
      appServerMeasuredMs: 1060,
      appServerUnattributedMs: 240,
    },
    detail: {
      readMode: "projection-v4-cache",
      readDecision: "projection-hit",
      coldPathOwner: "warm-path",
      coldPathReason: "warm-projection-cache",
    },
  });

  assert.equal(decision.status, "needs_repair");
  assert.equal(decision.priority, "H2");
  assert.equal(decision.owner, "thread-list-visible-filter");
  assert.equal(decision.reason, "visible-filter-latency");
  assert.equal(decision.nextAction, "optimize-thread-list-visible-filter");
  assert.equal(decision.evidence.threadListAppServerVisibleFilterMs, 840);
});

test("phase B readback decision routes dominant route-merge latency to merge owner", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    threadList: {
      coldPathOwner: "warm-fallback-cache",
      coldPathReason: "cache-hit-incremental",
      totalMs: 827,
      appServerMs: 116,
      appServerRpcMs: 9,
      appServerVisibleFilterMs: 107,
      appServerWorkspaceFilterMs: 0,
      appServerPostProcessMs: 107,
      mergeMs: 567,
      routeMergeAppServerInputCount: 24,
      routeMergeFallbackInputCount: 20,
      routeMergeInputCount: 44,
      routeMergeUniqueInputCount: 27,
      routeMergeDuplicateCount: 17,
      routeMergeMergedCount: 23,
      routeMergeOutputCount: 20,
      routeMergeLimitDropCount: 3,
      requestContextArchivedIdsReadCount: 1,
      requestContextSessionIndexReadCount: 1,
      requestContextCachedDisplayReadCount: 27,
      requestContextRolloutStatReadCount: 19,
      summaryMergeInputCount: 44,
      summaryMergeDuplicateIdCount: 17,
      summaryMergeCachedDisplayMs: 420,
      summaryMergeNormalizeMs: 80,
      summaryMergeDisplayMergeMs: 40,
      summaryMergeTotalMs: 550,
      summaryMergeDominantStage: "cached_display",
    },
    muxRuntime: {
      muxMetricsRpc: true,
    },
    muxMetrics: {
      supported: true,
      ok: true,
      threadList: {
        count: 2384,
        lastMs: 7,
      },
    },
    detail: {
      readMode: "projection-active-overlay",
      readDecision: "projection-active-overlay",
      coldPathOwner: "warm-path",
      coldPathReason: "warm-projection-active-overlay",
    },
  });

  assert.equal(decision.status, "needs_repair");
  assert.equal(decision.priority, "H2");
  assert.equal(decision.owner, "thread-list-route-merge");
  assert.equal(decision.reason, "route-merge-latency:cached_display");
  assert.equal(decision.nextAction, "optimize-thread-list-route-merge");
  assert.equal(decision.evidence.threadListMergeMs, 567);
  assert.equal(decision.evidence.threadListRouteMergeInputCount, 44);
  assert.equal(decision.evidence.threadListRouteMergeDuplicateCount, 17);
  assert.equal(decision.evidence.threadListRouteMergeLimitDropCount, 3);
  assert.equal(decision.evidence.threadListRequestContextArchivedIdsReadCount, 1);
  assert.equal(decision.evidence.threadListRequestContextSessionIndexReadCount, 1);
  assert.equal(decision.evidence.threadListRequestContextCachedDisplayReadCount, 27);
  assert.equal(decision.evidence.threadListRequestContextRolloutStatReadCount, 19);
  assert.equal(decision.evidence.threadListSummaryMergeInputCount, 44);
  assert.equal(decision.evidence.threadListSummaryMergeDuplicateIdCount, 17);
  assert.equal(decision.evidence.threadListSummaryMergeCachedDisplayMs, 420);
  assert.equal(decision.evidence.threadListSummaryMergeDominantStage, "cached_display");
  assert.equal(decision.evidence.threadListMuxRuntimeMuxMetricsRpc, true);
  assert.equal(decision.evidence.threadListMuxMetricsSupported, true);
});

test("phase B readback decision observes inconclusive warm list latency split", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    threadList: {
      coldPathOwner: "warm-fallback-cache",
      coldPathReason: "cache-hit",
      appServerMs: 1400,
      appServerRpcMs: 500,
      appServerVisibleFilterMs: 300,
      appServerWorkspaceFilterMs: 250,
      appServerPostProcessMs: 550,
      appServerMeasuredMs: 1050,
      appServerUnattributedMs: 350,
    },
    detail: {
      readMode: "projection-active-overlay",
      readDecision: "projection-active-overlay",
      coldPathOwner: "warm-path",
      coldPathReason: "warm-projection-active-overlay",
    },
  });

  assert.equal(decision.status, "observe");
  assert.equal(decision.priority, "H3");
  assert.equal(decision.owner, "app-server-thread-list");
  assert.equal(decision.reason, "app-server-latency-split-inconclusive");
  assert.equal(decision.nextAction, "capture-next-app-server-list-latency-sample");
});

test("phase B readback decision routes dominant unattributed app-server latency to attribution owner", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    threadList: {
      coldPathOwner: "warm-fallback-cache",
      coldPathReason: "cache-hit",
      appServerMs: 1600,
      appServerRpcMs: 120,
      appServerVisibleFilterMs: 90,
      appServerWorkspaceFilterMs: 40,
      appServerPostProcessMs: 130,
      appServerMeasuredMs: 250,
      appServerUnattributedMs: 1350,
    },
    detail: {
      readMode: "projection-active-overlay",
      readDecision: "projection-active-overlay",
      coldPathOwner: "warm-path",
      coldPathReason: "warm-projection-active-overlay",
    },
  });

  assert.equal(decision.status, "needs_repair");
  assert.equal(decision.priority, "H2");
  assert.equal(decision.owner, "thread-list-app-server-attribution");
  assert.equal(decision.reason, "app-server-unattributed-latency");
  assert.equal(decision.nextAction, "split-thread-list-app-server-residual-timing");
  assert.equal(decision.evidence.threadListAppServerMeasuredMs, 250);
  assert.equal(decision.evidence.threadListAppServerUnattributedMs, 1350);
});

test("phase B readback decision treats warmed deferred fallback as observed not broken", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    threadList: {
      coldPathOwner: "deferred-fallback",
      coldPathReason: "active-thread-detail",
      fallbackDeferred: true,
    },
    threadListAfterDeferred: {
      coldPathOwner: "fallback-baseline",
      coldPathReason: "miss-rebuild:rollout",
      fallbackCacheDecision: "miss-rebuild",
    },
    threadListWarmCheck: {
      coldPathOwner: "warm-fallback-cache",
      coldPathReason: "cache-hit",
      fallbackCacheDecision: "hit",
      fallbackCacheHit: true,
    },
    detail: {
      readMode: "projection-active-overlay",
      readDecision: "projection-active-overlay",
      coldPathOwner: "warm-path",
      coldPathReason: "warm-projection-active-overlay",
    },
  });

  assert.equal(decision.status, "observe");
  assert.equal(decision.priority, "H3");
  assert.equal(decision.owner, "thread-list-deferred-fallback");
  assert.equal(decision.reason, "deferred-followup-warmed");
  assert.equal(decision.nextAction, "observe-cold-start-first-rebuild-cost");
  assert.equal(decision.evidence.threadListAfterDeferredOwner, "fallback-baseline");
  assert.equal(decision.evidence.threadListWarmCheckOwner, "warm-fallback-cache");
});

test("phase B readback decision treats one-time cold rebuild plus warm check as observed", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    threadList: {
      coldPathOwner: "fallback-baseline",
      coldPathReason: "miss-rebuild:rollout",
      fallbackCacheDecision: "miss-rebuild",
      appServerRequestedLimit: 40,
      appServerRequestLimit: 80,
      appServerRequestReason: "default-bounded-overfetch",
      appServerOverfetchFactor: 2,
      appServerMs: 130,
      appServerRpcMs: 120,
      appServerVisibleFilterMs: 4,
      appServerWorkspaceFilterMs: 6,
      appServerPostProcessMs: 10,
      appServerMeasuredMs: 130,
      appServerUnattributedMs: 0,
      appServerRawCount: 20,
      appServerVisibleCount: 18,
      appServerFilteredCount: 16,
    },
    threadListWarmCheck: {
      coldPathOwner: "warm-fallback-cache",
      coldPathReason: "cache-hit",
      fallbackCacheDecision: "hit",
      fallbackCacheHit: true,
    },
    detail: {
      readMode: "projection-active-overlay",
      readDecision: "projection-active-overlay",
      coldPathOwner: "warm-path",
      coldPathReason: "warm-projection-active-overlay",
    },
  });

  assert.equal(decision.status, "observe");
  assert.equal(decision.priority, "H3");
  assert.equal(decision.owner, "thread-list-fallback-baseline");
  assert.equal(decision.reason, "cold-start-rebuild-warmed");
  assert.equal(decision.nextAction, "observe-cold-start-first-rebuild-cost");
  assert.equal(decision.evidence.threadListAppServerRequestedLimit, 40);
  assert.equal(decision.evidence.threadListAppServerRequestLimit, 80);
  assert.equal(decision.evidence.threadListAppServerRequestReason, "default-bounded-overfetch");
  assert.equal(decision.evidence.threadListAppServerOverfetchFactor, 2);
  assert.equal(decision.evidence.threadListAppServerMs, 130);
  assert.equal(decision.evidence.threadListAppServerRpcMs, 120);
  assert.equal(decision.evidence.threadListAppServerVisibleFilterMs, 4);
  assert.equal(decision.evidence.threadListAppServerWorkspaceFilterMs, 6);
  assert.equal(decision.evidence.threadListAppServerPostProcessMs, 10);
  assert.equal(decision.evidence.threadListAppServerMeasuredMs, 130);
  assert.equal(decision.evidence.threadListAppServerUnattributedMs, 0);
  assert.equal(decision.evidence.threadListAppServerRawCount, 20);
  assert.equal(decision.evidence.threadListAppServerVisibleCount, 18);
  assert.equal(decision.evidence.threadListAppServerFilteredCount, 16);
  assert.equal(decision.evidence.threadListWarmCheckOwner, "warm-fallback-cache");
});

test("phase B readback decision routes failed prewarm before generic fallback baseline", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    publicConfig: {
      threadListFallbackPrewarm: {
        enabled: true,
        completed: false,
        lastStatus: "failed",
        lastErrorCode: "EPRIVATE_SHOULD_NOT_EXPAND",
      },
    },
    threadList: {
      coldPathOwner: "fallback-baseline",
      coldPathReason: "miss-rebuild:rollout",
      fallbackCacheDecision: "miss-rebuild",
    },
    detail: {
      readMode: "projection-active-overlay",
      readDecision: "projection-active-overlay",
      coldPathOwner: "warm-path",
      coldPathReason: "warm-projection-active-overlay",
    },
  });

  assert.equal(decision.status, "needs_repair");
  assert.equal(decision.owner, "thread-list-fallback-prewarm");
  assert.equal(decision.reason, "prewarm-failed:EPRIVATE_SHOULD_NOT_EXPAND");
  assert.equal(decision.nextAction, "repair-thread-list-fallback-prewarm");
  assert.equal(decision.evidence.threadListPrewarmLastStatus, "failed");
  assert.equal(decision.evidence.threadListPrewarmLastErrorCode, "EPRIVATE_SHOULD_NOT_EXPAND");
});

test("phase B readback decision routes completed prewarm with cold list to cache-key alignment", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    publicConfig: {
      threadListFallbackPrewarm: {
        enabled: true,
        completed: true,
        lastStatus: "completed",
        lastCacheDecision: "miss-rebuild",
        lastCacheHit: false,
        lastSourceSnapshotHit: false,
        lastResultCount: 20,
        lastSourceSnapshotRawCount: 30,
      },
    },
    threadList: {
      coldPathOwner: "fallback-baseline",
      coldPathReason: "miss-rebuild:rollout",
      fallbackCacheDecision: "miss-rebuild",
      fallbackCacheHit: false,
      fallbackSourceSnapshotHit: false,
    },
    detail: {
      readMode: "projection-active-overlay",
      readDecision: "projection-active-overlay",
      coldPathOwner: "warm-path",
      coldPathReason: "warm-projection-active-overlay",
    },
  });

  assert.equal(decision.status, "needs_repair");
  assert.equal(decision.owner, "thread-list-fallback-prewarm");
  assert.equal(decision.reason, "prewarm-completed-but-list-cold");
  assert.equal(decision.nextAction, "align-thread-list-prewarm-cache-key");
  assert.equal(decision.evidence.threadListPrewarmCompleted, true);
  assert.equal(decision.evidence.threadListPrewarmLastResultCount, 20);
});

test("phase B readback decision records prewarm settle timeout as timing observation", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    publicConfig: {
      threadListFallbackPrewarm: {
        enabled: true,
        scheduled: false,
        running: true,
        completed: false,
        lastStatus: "",
      },
    },
    threadListPrewarmSettle: {
      attempted: true,
      settled: false,
      reason: "prewarm-settle-timeout",
      sampleCount: 4,
      elapsedMs: 1000,
    },
    threadList: {
      coldPathOwner: "fallback-baseline",
      coldPathReason: "miss-rebuild:rollout",
      fallbackCacheDecision: "miss-rebuild",
    },
    detail: {
      readMode: "projection-active-overlay",
      readDecision: "projection-active-overlay",
      coldPathOwner: "warm-path",
      coldPathReason: "warm-projection-active-overlay",
    },
  });

  assert.equal(decision.status, "observe");
  assert.equal(decision.priority, "H3");
  assert.equal(decision.owner, "thread-list-fallback-prewarm");
  assert.equal(decision.reason, "prewarm-settle-timeout");
  assert.equal(decision.nextAction, "verify-startup-prewarm-timing");
  assert.equal(decision.evidence.threadListPrewarmSettleAttempted, true);
  assert.equal(decision.evidence.threadListPrewarmSettleSettled, false);
  assert.equal(decision.evidence.threadListPrewarmSettleSampleCount, 4);
});

test("phase B readback decision routes deferred follow-up baseline reason to specific owner", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    threadList: {
      coldPathOwner: "deferred-fallback",
      coldPathReason: "active-thread-detail",
      fallbackDeferred: true,
    },
    threadListAfterDeferred: {
      coldPathOwner: "fallback-baseline",
      coldPathReason: "miss-rebuild:merge-dedupe",
      fallbackCacheDecision: "miss-rebuild",
      fallbackBaselineMergeInputCount: 42,
      fallbackBaselineMergeOutputCount: 12,
      fallbackBaselineMergeDuplicateCount: 30,
    },
    detail: {
      readMode: "projection-active-overlay",
      readDecision: "projection-active-overlay",
      coldPathOwner: "warm-path",
      coldPathReason: "warm-projection-active-overlay",
    },
  });

  assert.equal(decision.status, "needs_repair");
  assert.equal(decision.owner, "thread-list-fallback-merge");
  assert.equal(decision.reason, "miss-rebuild:merge-dedupe");
  assert.equal(decision.nextAction, "optimize-thread-list-fallback-merge");
  assert.equal(decision.evidence.threadListAfterDeferredOwner, "fallback-baseline");
  assert.equal(decision.evidence.threadListAfterDeferredMergeInputCount, 42);
  assert.equal(decision.evidence.threadListAfterDeferredMergeOutputCount, 12);
  assert.equal(decision.evidence.threadListAfterDeferredMergeDuplicateCount, 30);
});

test("phase B readback decision keeps evidence bounded and private-content free", () => {
  const decision = classifyPhaseBReadback({
    ok: true,
    privatePrompt: "do not copy this prompt",
    threadList: {
      coldPathOwner: "fallback-baseline",
      coldPathReason: `miss-rebuild:${"x".repeat(200)}`,
      fallbackCacheDecision: "miss-rebuild",
      fallbackBaselineFinalFilterInputCount: 999999999,
      fallbackBaselineMergeDuplicateCount: 999999999,
      fallbackBaselineLimitDropCount: 999999999,
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
  assert.equal(decision.evidence.threadListFinalFilterInputCount, 100000);
  assert.equal(decision.evidence.threadListMergeDuplicateCount, 100000);
  assert.equal(decision.evidence.threadListLimitDropCount, 100000);
  assert.doesNotMatch(JSON.stringify(decision), /private|prompt|message|do not copy/i);
});
