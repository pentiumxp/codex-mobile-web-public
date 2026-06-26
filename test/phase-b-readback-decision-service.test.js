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
