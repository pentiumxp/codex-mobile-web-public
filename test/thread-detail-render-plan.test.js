"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const renderPlan = require(path.resolve(__dirname, "..", "public", "thread-detail-render-plan.js"));

test("thread detail refresh request plan defaults to recent mode", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshRequest({
    threadId: "thread-1",
    threadLoadSeq: 7,
    options: { source: "resume" },
    hasActiveRefreshController: true,
  }), {
    shouldRefresh: true,
    threadId: "thread-1",
    seq: 7,
    source: "resume",
    requestedMode: "recent",
    query: { mode: "recent" },
    timeoutMs: 20000,
    abortActiveRefresh: true,
    reason: "recent-default",
  });
});

test("thread detail refresh request plan handles full mode and missing thread", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshRequest({
    currentThreadId: "thread-2",
    threadLoadSeq: 3,
    options: { mode: "FULL", source: "abcdefghijklmnopqrstuvwxyz1234567890EXTRA" },
    hasActiveRefreshController: false,
  }), {
    shouldRefresh: true,
    threadId: "thread-2",
    seq: 3,
    source: "abcdefghijklmnopqrstuvwxyz1234567890EXTR",
    requestedMode: "full",
    query: {},
    timeoutMs: 20000,
    abortActiveRefresh: false,
    reason: "full-requested",
  });

  assert.deepEqual(renderPlan.planThreadDetailRefreshRequest({
    threadLoadSeq: 4,
    options: { source: "ignored" },
    hasActiveRefreshController: true,
  }), {
    shouldRefresh: false,
    threadId: "",
    seq: 4,
    source: "",
    requestedMode: "",
    query: {},
    timeoutMs: 20000,
    abortActiveRefresh: false,
    reason: "missing-thread-id",
  });
});

test("thread detail refresh render plan skips stable conversation signatures", () => {
  const plan = renderPlan.planThreadDetailRefreshRender({
    previousConversationSignature: "sig-a",
    nextConversationSignature: "sig-a",
    renderedConversationSignature: "sig-a",
  });

  assert.deepEqual(plan, {
    shouldRenderDetail: false,
    canPatch: false,
    detailRenderMode: "metadata-only",
    reason: "signature-stable",
  });
});

test("thread detail refresh render plan allows patch only when current DOM matches previous detail", () => {
  const plan = renderPlan.planThreadDetailRefreshRender({
    previousConversationSignature: "sig-a",
    nextConversationSignature: "sig-b",
    renderedConversationSignature: "sig-a",
  });

  assert.deepEqual(plan, {
    shouldRenderDetail: true,
    canPatch: true,
    detailRenderMode: "patch",
    reason: "signature-changed",
  });
  assert.deepEqual(renderPlan.finalizeThreadDetailRenderPlan(plan, { locallyPatchedDetail: true }), {
    detailRenderMode: "patch",
    locallyPatchedDetail: true,
    tilePanePatchedDetail: false,
    renderAction: "local-patch-metadata-update",
    projectionConsistencyPhase: "refresh-local-patch",
  });
});

test("thread detail refresh render plan requires full render when DOM signature is stale", () => {
  const plan = renderPlan.planThreadDetailRefreshRender({
    previousConversationSignature: "sig-a",
    nextConversationSignature: "sig-b",
    renderedConversationSignature: "sig-old",
  });

  assert.deepEqual(plan, {
    shouldRenderDetail: true,
    canPatch: false,
    detailRenderMode: "full-render",
    reason: "rendered-signature-stale",
  });
  assert.deepEqual(renderPlan.finalizeThreadDetailRenderPlan(plan, { locallyPatchedDetail: false }), {
    detailRenderMode: "full-render",
    locallyPatchedDetail: false,
    tilePanePatchedDetail: false,
    renderAction: "full-render",
    projectionConsistencyPhase: "",
  });
});

test("thread detail refresh render plan can patch when only projection metadata makes the full signature stale", () => {
  const plan = renderPlan.planThreadDetailRefreshRender({
    previousConversationSignature: "sig-a",
    nextConversationSignature: "sig-b",
    renderedConversationSignature: "sig-old",
    previousPatchShellSignature: "shell-a",
    renderedPatchShellSignature: "shell-a",
  });

  assert.deepEqual(plan, {
    shouldRenderDetail: true,
    canPatch: true,
    detailRenderMode: "patch",
    reason: "patch-shell-stable",
  });
});

test("thread detail refresh render plan can disable patch explicitly", () => {
  const plan = renderPlan.planThreadDetailRefreshRender({
    previousConversationSignature: "sig-a",
    nextConversationSignature: "sig-b",
    renderedConversationSignature: "sig-a",
    previousPatchShellSignature: "shell-a",
    renderedPatchShellSignature: "shell-a",
    allowPatch: false,
  });

  assert.equal(plan.shouldRenderDetail, true);
  assert.equal(plan.canPatch, false);
  assert.equal(plan.detailRenderMode, "full-render");
});

test("thread detail refresh patch execution allows local patch only for non-tile patchable detail refreshes", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchExecution({
    shouldRenderDetail: true,
    canPatch: true,
    tileSurfaceRefresh: false,
  }), {
    tryTilePanePatch: true,
    tryLocalPatch: true,
    updateMetadataOnTileMiss: false,
    fallbackAction: "full-render",
    localPatchBlockedReason: "",
    reason: "local-patch-eligible",
  });
});

test("thread detail refresh patch execution blocks single-thread patching on tile surfaces", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchExecution({
    shouldRenderDetail: true,
    canPatch: true,
    tileSurfaceRefresh: true,
  }), {
    tryTilePanePatch: true,
    tryLocalPatch: false,
    updateMetadataOnTileMiss: false,
    fallbackAction: "full-render",
    localPatchBlockedReason: "tile-surface-refresh",
    reason: "tile-surface-refresh",
  });
});

test("thread detail refresh patch execution falls back to full render when patch is not allowed", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchExecution({
    shouldRenderDetail: true,
    canPatch: false,
    tileSurfaceRefresh: false,
  }), {
    tryTilePanePatch: true,
    tryLocalPatch: false,
    updateMetadataOnTileMiss: false,
    fallbackAction: "full-render",
    localPatchBlockedReason: "patch-not-allowed",
    reason: "full-render-required",
  });
});

test("thread detail refresh patch execution keeps metadata-only refreshes out of full render", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchExecution({
    shouldRenderDetail: false,
    canPatch: false,
    tileSurfaceRefresh: false,
  }), {
    tryTilePanePatch: true,
    tryLocalPatch: false,
    updateMetadataOnTileMiss: true,
    fallbackAction: "metadata-update",
    localPatchBlockedReason: "signature-stable",
    reason: "metadata-only",
  });
});

test("thread detail refresh patch surface plan classifies tile and single-thread surfaces", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchSurface({
    shouldRenderDetail: true,
    threadTileMode: true,
    threadTileConversationSurface: false,
  }), {
    shouldProbeTilePatchSurface: true,
    tileSurfaceRefresh: true,
    tilePatchSurface: "",
    reason: "tile-mode",
  });

  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchSurface({
    shouldRenderDetail: true,
    threadTileMode: false,
    threadTileConversationSurface: true,
  }), {
    shouldProbeTilePatchSurface: true,
    tileSurfaceRefresh: true,
    tilePatchSurface: "",
    reason: "tile-conversation-surface",
  });

  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchSurface({
    shouldRenderDetail: true,
    threadTileMode: false,
    threadTileConversationSurface: false,
    tilePatchSurface: "thread-tile-pane",
  }), {
    shouldProbeTilePatchSurface: true,
    tileSurfaceRefresh: true,
    tilePatchSurface: "thread-tile-pane",
    reason: "tile-patch-surface",
  });

  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchSurface({
    shouldRenderDetail: true,
    threadTileMode: false,
    threadTileConversationSurface: false,
    tilePatchSurface: "single-thread",
  }), {
    shouldProbeTilePatchSurface: true,
    tileSurfaceRefresh: false,
    tilePatchSurface: "single-thread",
    reason: "single-thread-surface",
  });
});

test("thread detail refresh patch surface plan keeps metadata-only probes quiet", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchSurface({
    shouldRenderDetail: false,
    threadTileMode: false,
    threadTileConversationSurface: false,
  }), {
    shouldProbeTilePatchSurface: false,
    tileSurfaceRefresh: false,
    tilePatchSurface: "",
    reason: "metadata-only-single-thread-surface",
  });
});

test("thread detail refresh post-merge effects plan preserves timing groups and order", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshPostMergeEffects(), {
    groups: [
      {
        timing: "merge",
        effects: ["merge-thread-list"],
      },
      {
        timing: "composer-render",
        effects: ["render-composer-settings", "sync-active-turn"],
      },
      {
        timing: "thread-list-render",
        effects: ["render-threads"],
      },
    ],
    reason: "default-post-merge-effects",
  });
});

test("thread detail refresh patch attempt effects plan preserves tile before local patch order", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchAttemptEffects({
    shouldRenderDetail: true,
    tryTilePanePatch: true,
    tryLocalPatch: true,
  }), {
    effects: [
      {
        type: "tile-pane-patch",
        timingTarget: "tile-pane-patch",
        preserveScroll: true,
      },
      {
        type: "local-patch",
        timingTarget: "local-patch",
        skipWhenTilePanePatched: true,
      },
    ],
    reason: "patch-attempt-effects",
  });
});

test("thread detail refresh patch attempt effects plan omits local patch for metadata-only or blocked attempts", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchAttemptEffects({
    shouldRenderDetail: false,
    tryTilePanePatch: true,
    tryLocalPatch: true,
  }), {
    effects: [
      {
        type: "tile-pane-patch",
        timingTarget: "tile-pane-patch",
        preserveScroll: true,
      },
    ],
    reason: "patch-attempt-effects",
  });

  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchAttemptEffects({
    shouldRenderDetail: true,
    tryTilePanePatch: false,
    tryLocalPatch: false,
  }), {
    effects: [],
    reason: "no-patch-attempt-effects",
  });
});

test("thread detail refresh patch attempt result makes tile pane patch terminal", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchAttemptResult({
    shouldRenderDetail: true,
    tilePanePatchAttempted: true,
    tilePanePatchedDetail: true,
    localPatchAttempted: true,
    locallyPatchedDetail: true,
    tilePanePatchMs: 4.5,
    localPatchMs: 9.25,
    patchRejectReason: "should-not-surface",
  }), {
    patchResult: "tile-pane-patched",
    locallyPatchedDetail: false,
    tilePanePatchedDetail: true,
    detailPatchMs: 4.5,
    patchTimingSource: "tile-pane",
    patchRejectReason: "",
    reportLocalPatchRejected: false,
    finalizeResult: {
      locallyPatchedDetail: false,
      tilePanePatchedDetail: true,
    },
  });
});

test("thread detail refresh patch attempt result reports local patch rejection", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchAttemptResult({
    shouldRenderDetail: true,
    tilePanePatchAttempted: true,
    tilePanePatchedDetail: false,
    localPatchAttempted: true,
    locallyPatchedDetail: false,
    localPatchMs: 7.25,
    patchRejectReason: "rendered-dom-stale",
  }), {
    patchResult: "local-patch-rejected",
    locallyPatchedDetail: false,
    tilePanePatchedDetail: false,
    detailPatchMs: 7.25,
    patchTimingSource: "local-patch-rejected",
    patchRejectReason: "rendered-dom-stale",
    reportLocalPatchRejected: true,
    finalizeResult: {
      locallyPatchedDetail: false,
      tilePanePatchedDetail: false,
    },
  });
});

test("thread detail refresh patch attempt result records local patch timing", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchAttemptResult({
    shouldRenderDetail: true,
    tilePanePatchAttempted: true,
    tilePanePatchedDetail: false,
    localPatchAttempted: true,
    locallyPatchedDetail: true,
    tilePanePatchMs: 3,
    localPatchMs: 6.5,
    patchRejectReason: "ignored",
  }), {
    patchResult: "local-patched",
    locallyPatchedDetail: true,
    tilePanePatchedDetail: false,
    detailPatchMs: 6.5,
    patchTimingSource: "local-patch",
    patchRejectReason: "",
    reportLocalPatchRejected: false,
    finalizeResult: {
      locallyPatchedDetail: true,
      tilePanePatchedDetail: false,
    },
  });
});

test("thread detail refresh patch attempt result keeps metadata tile misses quiet", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchAttemptResult({
    shouldRenderDetail: false,
    tilePanePatchAttempted: true,
    tilePanePatchedDetail: false,
    localPatchAttempted: false,
    locallyPatchedDetail: false,
    tilePanePatchMs: 5,
    patchRejectReason: "ignored",
  }), {
    patchResult: "tile-pane-miss",
    locallyPatchedDetail: false,
    tilePanePatchedDetail: false,
    detailPatchMs: 0,
    patchTimingSource: "",
    patchRejectReason: "",
    reportLocalPatchRejected: false,
    finalizeResult: {
      locallyPatchedDetail: false,
      tilePanePatchedDetail: false,
    },
  });
});

test("thread detail refresh render outcome treats tile pane patch as terminal", () => {
  const plan = renderPlan.planThreadDetailRefreshRender({
    previousConversationSignature: "sig-a",
    nextConversationSignature: "sig-b",
    renderedConversationSignature: "sig-a",
  });

  assert.deepEqual(renderPlan.finalizeThreadDetailRenderPlan(plan, { tilePanePatchedDetail: true }), {
    detailRenderMode: "tile-pane",
    locallyPatchedDetail: false,
    tilePanePatchedDetail: true,
    renderAction: "tile-pane-patch",
    projectionConsistencyPhase: "refresh-local-patch",
  });
});

test("thread detail refresh render outcome keeps metadata-only tile patches out of full render", () => {
  const plan = renderPlan.planThreadDetailRefreshRender({
    previousConversationSignature: "sig-a",
    nextConversationSignature: "sig-a",
    renderedConversationSignature: "sig-a",
  });

  assert.deepEqual(renderPlan.finalizeThreadDetailRenderPlan(plan, { tilePanePatchedDetail: true }), {
    detailRenderMode: "tile-pane-metadata",
    locallyPatchedDetail: false,
    tilePanePatchedDetail: true,
    renderAction: "tile-pane-patch",
    projectionConsistencyPhase: "refresh-metadata",
  });
});

test("thread detail refresh outcome execution maps local patch completion to metadata update", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshOutcomeExecution({
    renderAction: "local-patch-metadata-update",
    detailRenderMode: "patch",
    projectionConsistencyPhase: "refresh-local-patch",
  }), {
    renderAction: "local-patch-metadata-update",
    metadataUpdateMode: "local-patch",
    metadataEffects: [
      "update-current-thread-header",
      "update-tick-timer",
      "publish-plugin-navigation-state",
    ],
    executionAction: "metadata-effects",
    timingTarget: "metadata-update",
    runFullRender: false,
    projectionConsistencyPhase: "refresh-local-patch",
    consistencyCheck: {
      shouldCheck: true,
      phase: "refresh-local-patch",
      renderMode: "patch",
      reason: "phase-present",
    },
    reason: "local-patch-complete",
  });
});

test("thread detail refresh outcome execution maps metadata-only refreshes", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshOutcomeExecution({
    renderAction: "metadata-update",
    detailRenderMode: "metadata-only",
    projectionConsistencyPhase: "refresh-metadata",
  }), {
    renderAction: "metadata-update",
    metadataUpdateMode: "metadata-only",
    metadataEffects: [
      "update-current-thread-header",
      "update-live-operation-dock",
      "update-tick-timer",
      "schedule-scroll-button-update",
    ],
    executionAction: "metadata-effects",
    timingTarget: "metadata-update",
    runFullRender: false,
    projectionConsistencyPhase: "refresh-metadata",
    consistencyCheck: {
      shouldCheck: true,
      phase: "refresh-metadata",
      renderMode: "metadata-only",
      reason: "phase-present",
    },
    reason: "metadata-only",
  });
});

test("thread detail refresh outcome execution gives full render an explicit consistency phase", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshOutcomeExecution({
    renderAction: "full-render",
    detailRenderMode: "full-render",
  }), {
    renderAction: "full-render",
    metadataUpdateMode: "",
    metadataEffects: [],
    executionAction: "full-render",
    timingTarget: "conversation-render",
    runFullRender: true,
    projectionConsistencyPhase: "refresh-full-render",
    consistencyCheck: {
      shouldCheck: true,
      phase: "refresh-full-render",
      renderMode: "full-render",
      reason: "phase-present",
    },
    reason: "full-render",
  });
});

test("thread detail refresh outcome execution preserves terminal tile-pane patch phases", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshOutcomeExecution({
    renderAction: "tile-pane-patch",
    detailRenderMode: "tile-pane",
    projectionConsistencyPhase: "refresh-local-patch",
  }), {
    renderAction: "tile-pane-patch",
    metadataUpdateMode: "",
    metadataEffects: [],
    executionAction: "none",
    timingTarget: "",
    runFullRender: false,
    projectionConsistencyPhase: "refresh-local-patch",
    consistencyCheck: {
      shouldCheck: true,
      phase: "refresh-local-patch",
      renderMode: "tile-pane",
      reason: "phase-present",
    },
    reason: "tile-pane-patch",
  });
});

test("thread detail refresh consistency check planning skips missing phases", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshConsistencyCheck({
    detailRenderMode: "full-render",
  }), {
    shouldCheck: false,
    phase: "",
    renderMode: "full-render",
    reason: "no-phase",
  });
});

test("thread detail refresh performance input combines render and patch plans", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshPerformanceInput({
    source: "refresh",
    threadId: "thread-1",
    requestedMode: "recent",
    shouldRenderDetail: true,
    renderPlan: {
      detailRenderMode: "patch",
      reason: "signature-changed",
    },
    renderOutcome: {
      detailRenderMode: "patch",
      renderAction: "local-patch-metadata-update",
      locallyPatchedDetail: true,
      tilePanePatchedDetail: false,
    },
    patchAttemptResult: {
      detailPatchMs: 7.6,
      patchRejectReason: "shape-changed",
    },
    timings: {
      elapsedMs: 25.4,
      apiElapsedMs: 10.2,
      renderElapsedMs: 8.9,
      mergeMs: 1.1,
      composerRenderMs: 2.2,
      threadListRenderMs: 3.3,
      conversationRenderMs: 4.4,
      metadataUpdateMs: 5.5,
    },
  }), {
    source: "refresh",
    threadId: "thread-1",
    requestedMode: "recent",
    elapsedMs: 25.4,
    apiElapsedMs: 10.2,
    renderElapsedMs: 8.9,
    mergeMs: 1.1,
    composerRenderMs: 2.2,
    threadListRenderMs: 3.3,
    conversationRenderMs: 4.4,
    detailPatchMs: 7.6,
    metadataUpdateMs: 5.5,
    detailRenderMode: "patch",
    refreshRenderAction: "local-patch-metadata-update",
    renderPlanReason: "signature-changed",
    patchRejectReason: "shape-changed",
    skippedDetailRender: false,
    locallyPatchedDetail: true,
    tilePanePatchedDetail: false,
  });
});

test("thread detail refresh execution effects plan maps metadata, full render, none, and unknown actions", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshExecutionEffects({
    executionAction: "metadata-effects",
    metadataEffects: ["update-current-thread-header"],
  }), {
    effects: [
      {
        type: "metadata-effects",
        timingTarget: "metadata-update",
        metadataEffects: ["update-current-thread-header"],
        requireEffects: true,
      },
    ],
    reason: "metadata-effects",
  });

  assert.deepEqual(renderPlan.planThreadDetailRefreshExecutionEffects({
    executionAction: "full-render",
    metadataEffects: ["ignored"],
  }), {
    effects: [
      {
        type: "full-render",
        timingTarget: "conversation-render",
        metadataEffects: [],
        requireEffects: false,
      },
    ],
    reason: "full-render",
  });

  assert.deepEqual(renderPlan.planThreadDetailRefreshExecutionEffects({
    executionAction: "none",
  }), {
    effects: [],
    reason: "none",
  });

  assert.deepEqual(renderPlan.planThreadDetailRefreshExecutionEffects({
    executionAction: "surprise",
  }), {
    effects: [
      {
        type: "surprise",
        timingTarget: "",
        metadataEffects: [],
        requireEffects: false,
      },
    ],
    reason: "unknown-execution-action",
  });
});

test("thread detail refresh completion effects plan bounded success side effects", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshCompletionEffects({
    threadHash: "abc123",
  }), {
    effects: [
      {
        type: "diagnostic-success",
        payload: {
          category: "thread_session_load_failed",
          diagnostic_type: "thread_detail_refresh_failed",
          error_code: "thread_detail_refresh_failed",
          context: {
            surface: "thread-session",
            action: "thread-detail-refresh",
            thread_hash: "abc123",
          },
        },
      },
      { type: "schedule-usage-backfill-refresh" },
      { type: "schedule-live-poll" },
    ],
    reason: "refresh-complete",
  });
});

test("single-thread full render shell plans loading state", () => {
  assert.deepEqual(renderPlan.planSingleThreadFullRenderShell({
    threadId: "thread-1",
    loadingWithoutVisibleTurns: true,
  }), {
    mode: "loading",
    html: `<div class="empty-state entry-animate">Loading thread...</div>`,
    clearLiveOperationDock: true,
    bindRetry: false,
    retryThreadId: "",
    hasPrimaryContent: false,
    emptyMessage: "",
  });
});

test("single-thread full render shell plans escaped load error retry", () => {
  const plan = renderPlan.planSingleThreadFullRenderShell({
    threadId: "thread-1",
    loadError: "bad <state>",
  });

  assert.equal(plan.mode, "load-error");
  assert.equal(plan.clearLiveOperationDock, true);
  assert.equal(plan.bindRetry, true);
  assert.equal(plan.retryThreadId, "thread-1");
  assert.match(plan.html, /Thread failed: bad &lt;state&gt;/);
  assert.match(plan.html, /id="retryCurrentThread"/);
});

test("single-thread full render shell preserves fragment order with primary content", () => {
  const plan = renderPlan.planSingleThreadFullRenderShell({
    goalCard: "<goal/>",
    rolloutWarning: "<rollout/>",
    loadingNote: "<loading/>",
    taskToolbar: "<toolbar/>",
    omittedBanner: "<omitted/>",
    readWarning: "<warning/>",
    turnsHtml: "<turn/>",
    approvalsHtml: "<approval/>",
    taskCardsHtml: "<task/>",
    pluginRefreshNotice: "<plugin/>",
  });

  assert.equal(plan.mode, "detail");
  assert.equal(plan.hasPrimaryContent, true);
  assert.equal(plan.emptyMessage, "No visible turns.");
  assert.equal(plan.html, "<goal/><rollout/><loading/><toolbar/><omitted/><warning/><turn/><approval/><task/><plugin/>");
});

test("single-thread full render shell renders plugin notice before empty state", () => {
  const plan = renderPlan.planSingleThreadFullRenderShell({
    pluginRefreshNotice: "<plugin/>",
  });

  assert.equal(plan.hasPrimaryContent, false);
  assert.equal(plan.emptyMessage, "No visible turns.");
  assert.equal(plan.html, `<plugin/><div class="empty-state entry-animate">No visible turns.</div>`);
});

test("single-thread full render shell explains empty read-warning state", () => {
  const plan = renderPlan.planSingleThreadFullRenderShell({
    readWarningMessage: "summary fallback",
  });

  assert.equal(plan.hasPrimaryContent, false);
  assert.equal(plan.emptyMessage, "暂时没有可显示的完整消息。共享模式恢复后刷新这个页面即可继续读取。");
  assert.match(plan.html, /暂时没有可显示的完整消息/);
});
