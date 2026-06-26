"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const renderPlan = require(path.resolve(__dirname, "..", "public", "thread-detail-render-plan.js"));

function turn(id, items) {
  return { id, items };
}

function item(type, text) {
  return { type, text };
}

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

test("thread detail refresh response effects apply only to current thread sequence", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshResponseEffects({
    threadId: "thread-1",
    seq: 7,
    currentThreadId: "thread-1",
    currentThreadSeq: 7,
    source: "resume",
  }), {
    shouldApply: true,
    effects: [
      { type: "mark-thread-detail-loaded" },
      {
        type: "remember-render-evidence",
        source: "resume-detail-api",
      },
      { type: "merge-current-thread" },
    ],
    reason: "current-thread",
  });

  assert.deepEqual(renderPlan.planThreadDetailRefreshResponseEffects({
    threadId: "thread-1",
    seq: 7,
    currentThreadId: "thread-2",
    currentThreadSeq: 7,
    source: "resume",
  }), {
    shouldApply: false,
    effects: [],
    reason: "stale-thread",
  });

  assert.deepEqual(renderPlan.planThreadDetailRefreshResponseEffects({
    threadId: "thread-1",
    seq: 7,
    currentThreadId: "thread-1",
    currentThreadSeq: 8,
    source: "resume",
  }), {
    shouldApply: false,
    effects: [],
    reason: "stale-seq",
  });
});

test("thread detail history auto-backfill triggers for leading workflow receipts", () => {
  const plan = renderPlan.planThreadDetailHistoryAutoBackfill({
    thread: {
      id: "thread-workflow",
      mobileOlderTurnsCursor: { before: "cursor-1" },
      turns: [
        turn("t1", [item("agentMessage", "Task card id: ttc_1\nReturn policy: terminal receipt")]),
        turn("t2", [item("agentMessage", "Source workspace: /workspace\nApproval: target approval bypassed")]),
        turn("t3", [item("agentMessage", "Workflow mode: autonomous\nAuto-return: when complete")]),
        turn("t4", [item("userMessage", "normal user message")]),
      ],
    },
  });

  assert.equal(plan.shouldLoad, true);
  assert.equal(plan.reason, "leading-workflow-receipts");
  assert.equal(plan.counts.leadingAssistantOnlyWorkflowTurns, 3);
});

test("thread detail history auto-backfill triggers for workflow dominated windows", () => {
  const plan = renderPlan.planThreadDetailHistoryAutoBackfill({
    thread: {
      id: "thread-dominated",
      mobileOlderTurnsCursor: "cursor-2",
      turns: [
        turn("t1", [item("userMessage", "[Cross-thread task card sent by source thread]\nTitle: A")]),
        turn("t2", [item("agentMessage", "ordinary assistant response")]),
        turn("t3", [item("userMessage", "Task card id: ttc_2\nReturn required: yes")]),
        turn("t4", [item("agentMessage", "normal receipt")]),
        turn("t5", [item("userMessage", "Source thread: Home AI\nWorkflow mode: autonomous")]),
        turn("t6", [item("userMessage", "short normal user request")]),
      ],
    },
  });

  assert.equal(plan.shouldLoad, true);
  assert.equal(plan.reason, "workflow-dominated-window");
  assert.equal(plan.counts.workflowItemCount, 3);
});

test("thread detail history auto-backfill leaves ordinary recent windows alone", () => {
  const plan = renderPlan.planThreadDetailHistoryAutoBackfill({
    thread: {
      id: "thread-normal",
      mobileOlderTurnsCursor: "cursor-3",
      turns: [
        turn("t1", [item("userMessage", "first ordinary request"), item("agentMessage", "first answer")]),
        turn("t2", [item("userMessage", "second ordinary request"), item("agentMessage", "second answer")]),
        turn("t3", [item("userMessage", "third ordinary request"), item("agentMessage", "third answer")]),
      ],
    },
  });

  assert.equal(plan.shouldLoad, false);
  assert.equal(plan.reason, "recent-window-has-context");
});

test("thread detail history auto-backfill respects cursor and busy guards", () => {
  const thread = {
    id: "thread-guard",
    mobileOlderTurnsCursor: "cursor-4",
    turns: [
      turn("t1", [item("agentMessage", "Task card id: ttc_3\nReturn policy: terminal")]),
      turn("t2", [item("agentMessage", "Task card id: ttc_4\nReturn policy: terminal")]),
      turn("t3", [item("agentMessage", "Task card id: ttc_5\nReturn policy: terminal")]),
    ],
  };

  assert.equal(renderPlan.planThreadDetailHistoryAutoBackfill({ thread: Object.assign({}, thread, { mobileOlderTurnsCursor: "" }) }).reason, "no-older-cursor");
  assert.equal(renderPlan.planThreadDetailHistoryAutoBackfill({ thread, alreadyRequested: true }).reason, "already-requested");
  assert.equal(renderPlan.planThreadDetailHistoryAutoBackfill({ thread, historyBusy: true }).reason, "history-busy");
  assert.equal(renderPlan.planThreadDetailHistoryAutoBackfill({ thread: Object.assign({}, thread, { mobileHistoryExpanded: true }) }).reason, "history-expanded");
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

test("thread detail refresh render plan invalidates stale empty single-thread DOM", () => {
  const plan = renderPlan.planThreadDetailRefreshRender({
    previousConversationSignature: "sig-a",
    nextConversationSignature: "sig-a",
    renderedConversationSignature: "sig-a",
    singleThreadSurfaceAvailable: true,
    renderedDomTurnCount: 0,
    nextVisibleTurnCount: 3,
  });

  assert.deepEqual(plan, {
    shouldRenderDetail: true,
    canPatch: false,
    detailRenderMode: "full-render",
    reason: "rendered-dom-empty",
  });

  const tileTransitionPlan = renderPlan.planThreadDetailRefreshRender({
    previousConversationSignature: "sig-a",
    nextConversationSignature: "sig-a",
    renderedConversationSignature: "sig-a",
    singleThreadSurfaceAvailable: false,
    renderedDomTurnCount: 0,
    nextVisibleTurnCount: 3,
  });
  assert.equal(tileTransitionPlan.shouldRenderDetail, false);
  assert.equal(tileTransitionPlan.reason, "signature-stable");
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

test("thread detail refresh patch surface probe effects plan owns DOM probe intent", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchSurfaceProbeEffects({
    patchSurfacePlan: {
      shouldProbeTilePatchSurface: true,
      reason: "tile-mode",
    },
    threadId: "thread-1",
  }), {
    effects: [
      {
        type: "probe-thread-detail-dom-patch-surface",
        threadId: "thread-1",
      },
    ],
    reason: "patch-surface-probe",
  });

  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchSurfaceProbeEffects({
    patchSurfacePlan: {
      shouldProbeTilePatchSurface: false,
      reason: "metadata-only-single-thread-surface",
    },
    threadId: "thread-1",
  }), {
    effects: [],
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

test("thread detail refresh patch attempt aggregation starts from a bounded empty result", () => {
  assert.deepEqual(renderPlan.emptyThreadDetailRefreshPatchAttempt(), {
    tilePanePatchAttempted: false,
    tilePanePatchedDetail: false,
    localPatchAttempted: false,
    locallyPatchedDetail: false,
    tilePanePatchMs: 0,
    localPatchMs: 0,
    patchRejectReason: "",
  });
});

test("thread detail refresh patch attempt context exposes prior tile success only", () => {
  assert.deepEqual(renderPlan.threadDetailRefreshPatchAttemptEffectContext({
    threadId: "thread-1",
    previousConversationSignature: "sig-a",
  }, {
    tilePanePatchedDetail: true,
    patchRejectReason: "ignored",
  }), {
    threadId: "thread-1",
    previousConversationSignature: "sig-a",
    tilePanePatchedDetail: true,
  });
});

test("thread detail refresh patch attempt aggregation accumulates attempt timing and status", () => {
  const afterTile = renderPlan.reduceThreadDetailRefreshPatchAttempt(
    renderPlan.emptyThreadDetailRefreshPatchAttempt(),
    {
      tilePanePatchAttempted: true,
      tilePanePatchedDetail: false,
      tilePanePatchMs: 3.5,
    },
  );
  assert.deepEqual(afterTile, {
    tilePanePatchAttempted: true,
    tilePanePatchedDetail: false,
    localPatchAttempted: false,
    locallyPatchedDetail: false,
    tilePanePatchMs: 3.5,
    localPatchMs: 0,
    patchRejectReason: "",
  });

  assert.deepEqual(renderPlan.reduceThreadDetailRefreshPatchAttempt(afterTile, {
    localPatchAttempted: true,
    locallyPatchedDetail: false,
    localPatchMs: 4.25,
    patchRejectReason: "rendered-dom-stale",
  }), {
    tilePanePatchAttempted: true,
    tilePanePatchedDetail: false,
    localPatchAttempted: true,
    locallyPatchedDetail: false,
    tilePanePatchMs: 3.5,
    localPatchMs: 4.25,
    patchRejectReason: "rendered-dom-stale",
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

test("thread detail refresh patch rejected diagnostic plan owns bounded field selection", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchRejectedDiagnostic({
    readMode: "projection-v4-dynamic",
    renderPlan: {
      detailRenderMode: "patch",
      reason: "patch-shell-stable",
    },
    patchAttemptResult: {
      reportLocalPatchRejected: true,
      patchRejectReason: "rendered-dom-stale",
    },
    previousVisibleShape: {
      visibleItemCount: 3,
    },
    nextVisibleShape: {
      visibleItemCount: 5,
    },
  }), {
    shouldReport: true,
    diagnosticInput: {
      readMode: "projection-v4-dynamic",
      renderMode: "patch",
      renderPlanReason: "patch-shell-stable",
      patchRejectReason: "rendered-dom-stale",
      previousVisibleItemCount: 3,
      visibleItemCount: 5,
    },
    reason: "local-patch-rejected",
  });
});

test("thread detail refresh patch rejected diagnostic plan stays quiet without rejection", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchRejectedDiagnostic({
    readMode: "projection-v4-dynamic",
    renderPlan: {
      detailRenderMode: "patch",
      reason: "signature-changed",
    },
    patchAttemptResult: {
      reportLocalPatchRejected: false,
      patchRejectReason: "ignored",
    },
    previousVisibleShape: {
      visibleItemCount: 3,
    },
    nextVisibleShape: {
      visibleItemCount: 5,
    },
  }), {
    shouldReport: false,
    diagnosticInput: null,
    reason: "not-rejected",
  });
});

test("thread detail refresh patch rejected diagnostic effects plan owns reporting intent", () => {
  const diagnosticInput = {
    readMode: "projection-v4-dynamic",
    renderMode: "patch",
    patchRejectReason: "rendered-dom-stale",
  };
  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchRejectedDiagnosticEffects({
    diagnosticPlan: {
      shouldReport: true,
      diagnosticInput,
      reason: "local-patch-rejected",
    },
  }), {
    effects: [
      {
        type: "detail-patch-rejected-diagnostic-failure",
        diagnosticInput,
      },
    ],
    reason: "local-patch-rejected-diagnostic",
  });

  assert.deepEqual(renderPlan.planThreadDetailRefreshPatchRejectedDiagnosticEffects({
    diagnosticPlan: {
      shouldReport: false,
      diagnosticInput,
      reason: "not-rejected",
    },
  }), {
    effects: [],
    reason: "not-rejected",
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

test("thread detail refresh consistency check effects plan owns check execution intent", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshConsistencyCheckEffects({
    consistencyCheck: {
      shouldCheck: true,
      phase: "refresh-local-patch",
      renderMode: "patch",
      reason: "phase-present",
    },
  }), {
    effects: [
      {
        type: "conversation-projection-consistency-check",
        phase: "refresh-local-patch",
        renderMode: "patch",
      },
    ],
    reason: "consistency-check",
  });

  assert.deepEqual(renderPlan.planThreadDetailRefreshConsistencyCheckEffects({
    consistencyCheck: {
      shouldCheck: false,
      phase: "",
      renderMode: "full-render",
      reason: "no-phase",
    },
  }), {
    effects: [],
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

test("thread detail refresh telemetry effects plan preserves event and diagnostics order", () => {
  const performanceEvent = {
    elapsedMs: 42,
    readMode: "projection-v4-dynamic",
    detailShape: { turns: 3 },
  };
  assert.deepEqual(renderPlan.planThreadDetailRefreshTelemetryEffects({
    performanceEvent,
    threadId: "thread-1",
    action: "thread-detail-refresh",
    eventName: "thread_refresh_ms",
    throttleKey: "thread_refresh_ms",
    minIntervalMs: 1000.4,
  }), {
    effects: [
      {
        type: "post-performance-event",
        eventName: "thread_refresh_ms",
        payload: performanceEvent,
        options: {
          key: "thread_refresh_ms",
          minIntervalMs: 1000.4,
        },
      },
      {
        type: "record-thread-detail-response-diagnostics",
        performanceEvent,
        context: {
          action: "thread-detail-refresh",
          threadId: "thread-1",
        },
      },
    ],
    reason: "refresh-telemetry",
  });
});

test("thread detail refresh failure diagnostic effects plan bounds failure input", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshFailureDiagnosticEffects({
    errorCode: "network_error",
    durationBucket: "1s-3s",
    statusCode: "503",
    threadHash: "abc123",
  }), {
    effects: [
      {
        type: "thread-detail-refresh-failed-diagnostic-failure",
        diagnosticInput: {
          errorCode: "network_error",
          durationBucket: "1s-3s",
          statusCode: "503",
          threadHash: "abc123",
        },
      },
    ],
    reason: "refresh-failed-diagnostic",
  });

  assert.deepEqual(renderPlan.planThreadDetailRefreshFailureDiagnosticEffects({}), {
    effects: [
      {
        type: "thread-detail-refresh-failed-diagnostic-failure",
        diagnosticInput: {
          errorCode: "thread_detail_refresh_failed",
          durationBucket: "",
          statusCode: "",
          threadHash: "",
        },
      },
    ],
    reason: "refresh-failed-diagnostic",
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

test("thread detail first-paint post-render effects plan preserves order and bounds inputs", () => {
  assert.deepEqual(renderPlan.planThreadDetailFirstPaintPostRenderEffects({
    threadId: "thread-1",
    seq: 7,
    source: "abcdefghijklmnopqrstuvwxyz1234567890EXTRA",
  }), {
    effects: [
      { type: "publish-plugin-navigation-state", force: true },
      { type: "restore-connection-state" },
      { type: "schedule-live-poll", delayMs: 1200 },
      { type: "update-composer-controls" },
      { type: "close-sidebar-menu-if-overlay" },
      {
        type: "backfill-full-thread-detail-if-needed",
        threadId: "thread-1",
        seq: 7,
        source: "abcdefghijklmnopqrstuvwxyz1234567890EXTR",
      },
      { type: "schedule-usage-backfill-refresh" },
    ],
    reason: "first-paint-post-render",
  });

  assert.deepEqual(renderPlan.planThreadDetailFirstPaintPostRenderEffects({
    threadId: "thread-2",
    seq: "not-a-number",
  }).effects[5], {
    type: "backfill-full-thread-detail-if-needed",
    threadId: "thread-2",
    seq: 0,
    source: "",
  });
});

test("thread detail first-paint telemetry effects plan preserves bounded event order", () => {
  const performanceEvent = { detailRenderMode: "first-paint", cached: false, renderElapsedMs: 12 };
  assert.deepEqual(renderPlan.planThreadDetailFirstPaintTelemetryEffects({
    performanceEvent,
    source: "abcdefghijklmnopqrstuvwxyz1234567890EXTRA",
    threadId: "thread-1",
    elapsedMs: 101.8,
    apiElapsedMs: 55.2,
    renderElapsedMs: 33.9,
    readMode: "projection-active-overlay",
    status: "completed",
    turns: 10.8,
    omittedTurns: 2,
    rolloutSizeBytes: 12345.9,
    threadHash: "hash-1",
  }), {
    effects: [
      {
        type: "post-performance-event",
        eventName: "thread_detail_first_paint",
        payload: performanceEvent,
      },
      {
        type: "record-thread-detail-response-diagnostics",
        performanceEvent,
        context: {
          action: "thread-detail-load",
          threadId: "thread-1",
        },
      },
      {
        type: "post-client-event",
        eventName: "thread_switch_complete",
        payload: {
          source: "abcdefghijklmnopqrstuvwxyz1234567890EXTR",
          threadId: "thread-1",
          elapsedMs: 101.8,
          apiElapsedMs: 55.2,
          renderElapsedMs: 33.9,
          readMode: "projection-active-overlay",
          status: "completed",
          turns: 10,
          omittedTurns: 2,
          rolloutSizeBytes: 12345,
        },
      },
      {
        type: "diagnostic-success",
        payload: {
          category: "thread_session_load_failed",
          diagnostic_type: "thread_detail_load_failed",
          error_code: "thread_detail_load_failed",
          context: {
            surface: "thread-session",
            action: "thread-detail-load",
            thread_hash: "hash-1",
          },
        },
      },
    ],
    reason: "first-paint-telemetry",
  });
});

test("thread detail full-backfill effects plans preserve post-render and telemetry order", () => {
  assert.deepEqual(renderPlan.planThreadDetailFullBackfillPostRenderEffects(), {
    effects: [
      { type: "schedule-usage-backfill-refresh" },
      { type: "schedule-live-poll" },
      { type: "update-composer-controls" },
    ],
    reason: "full-backfill-post-render",
  });

  const performanceEvent = { detailRenderMode: "full-backfill", renderElapsedMs: 22 };
  assert.deepEqual(renderPlan.planThreadDetailFullBackfillTelemetryEffects({
    performanceEvent,
    threadId: "thread-1",
  }), {
    effects: [
      {
        type: "post-performance-event",
        eventName: "thread_detail_full_ready",
        payload: performanceEvent,
        options: { force: true },
      },
      {
        type: "record-thread-detail-response-diagnostics",
        performanceEvent,
        context: {
          action: "thread-detail-full-backfill",
          threadId: "thread-1",
        },
      },
    ],
    reason: "full-backfill-telemetry",
  });
});

test("thread detail cached-current telemetry effects plan preserves legacy event shape", () => {
  const performanceEvent = { detailRenderMode: "cached-current", cached: true, renderElapsedMs: 8 };
  assert.deepEqual(renderPlan.planThreadDetailCachedCurrentTelemetryEffects({
    performanceEvent,
    source: "abcdefghijklmnopqrstuvwxyz1234567890EXTRA",
    threadId: "thread-1",
    elapsedMs: 44.4,
    threadHash: "hash-1",
  }), {
    effects: [
      {
        type: "post-performance-event",
        eventName: "thread_detail_first_paint",
        payload: performanceEvent,
      },
      {
        type: "post-client-event",
        eventName: "thread_switch_cached",
        payload: {
          source: "abcdefghijklmnopqrstuvwxyz1234567890EXTR",
          threadId: "thread-1",
          elapsedMs: 44.4,
        },
      },
      {
        type: "diagnostic-success",
        payload: {
          category: "thread_session_load_failed",
          diagnostic_type: "thread_detail_load_failed",
          error_code: "thread_detail_load_failed",
          context: {
            surface: "thread-session",
            action: "thread-detail-load",
            thread_hash: "hash-1",
          },
        },
      },
    ],
    reason: "cached-current-telemetry",
  });
});

test("thread detail switch client event plans bound start, cancel, and error payloads", () => {
  assert.deepEqual(renderPlan.planThreadDetailSwitchStartClientEvent({
    source: "abcdefghijklmnopqrstuvwxyz1234567890EXTRA",
    fromThreadId: "from-1",
    toThreadId: "to-1",
    listAgeMs: 33.7,
    currentHadThread: 1,
    eventOpen: true,
  }), {
    effects: [{
      type: "post-client-event",
      eventName: "thread_switch_start",
      payload: {
        source: "abcdefghijklmnopqrstuvwxyz1234567890EXTR",
        fromThreadId: "from-1",
        toThreadId: "to-1",
        listAgeMs: 33.7,
        currentHadThread: true,
        eventOpen: true,
      },
    }],
    reason: "thread-switch-start",
  });
  assert.equal(renderPlan.planThreadDetailSwitchStartClientEvent({
    listAgeMs: null,
  }).effects[0].payload.listAgeMs, null);

  assert.deepEqual(renderPlan.planThreadDetailSwitchCancelledClientEvent({
    source: "abcdefghijklmnopqrstuvwxyz1234567890EXTRA",
    threadId: "thread-1",
    elapsedMs: 12.5,
    apiElapsedMs: 9.2,
  }), {
    effects: [{
      type: "post-client-event",
      eventName: "thread_switch_cancelled",
      payload: {
        source: "abcdefghijklmnopqrstuvwxyz1234567890EXTR",
        threadId: "thread-1",
        elapsedMs: 12.5,
        apiElapsedMs: 9.2,
      },
    }],
    reason: "thread-switch-cancelled",
  });

  const longError = "x".repeat(240);
  const errorPlan = renderPlan.planThreadDetailSwitchErrorClientEvent({
    source: "thread-list",
    threadId: "thread-2",
    elapsedMs: -1,
    apiElapsedMs: "bad",
    error: longError,
  });
  assert.equal(errorPlan.effects[0].eventName, "thread_switch_error");
  assert.deepEqual(errorPlan.effects[0].payload, {
    source: "thread-list",
    threadId: "thread-2",
    elapsedMs: 0,
    apiElapsedMs: 0,
    error: "x".repeat(200),
  });
  assert.equal(errorPlan.reason, "thread-switch-error");
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

test("single-thread early shell execution plans loading terminal render", () => {
  assert.deepEqual(renderPlan.planSingleThreadEarlyShellExecution({
    threadId: "thread-1",
    loadingWithoutVisibleTurns: true,
    conversationSignature: "loading|thread-1",
    patchShellSignature: "patch|thread-1",
    stickToBottom: true,
  }), {
    shouldRender: true,
    mode: "loading",
    reason: "loading",
    html: `<div class="empty-state entry-animate">Loading thread...</div>`,
    clearLiveOperationDock: true,
    bindRetry: false,
    retryThreadId: "",
    conversationSignature: "loading|thread-1",
    patchShellSignature: "patch|thread-1",
    stickToBottom: true,
  });
});

test("single-thread early shell execution plans load-error retry", () => {
  const plan = renderPlan.planSingleThreadEarlyShellExecution({
    currentThreadId: "thread-2",
    loadError: "bad <state>",
    conversationSignature: "error|thread-2",
    patchShellSignature: "patch|thread-2",
    stickToBottom: false,
  });

  assert.equal(plan.shouldRender, true);
  assert.equal(plan.mode, "load-error");
  assert.equal(plan.reason, "load-error");
  assert.equal(plan.clearLiveOperationDock, true);
  assert.equal(plan.bindRetry, true);
  assert.equal(plan.retryThreadId, "thread-2");
  assert.equal(plan.conversationSignature, "error|thread-2");
  assert.equal(plan.patchShellSignature, "patch|thread-2");
  assert.equal(plan.stickToBottom, false);
  assert.match(plan.html, /Thread failed: bad &lt;state&gt;/);
});

test("single-thread early shell execution leaves detail content to full render path", () => {
  assert.deepEqual(renderPlan.planSingleThreadEarlyShellExecution({
    threadId: "thread-3",
    conversationSignature: "detail|thread-3",
    patchShellSignature: "patch|thread-3",
    stickToBottom: true,
  }), {
    shouldRender: false,
    mode: "detail",
    reason: "detail-content",
    html: "",
    clearLiveOperationDock: false,
    bindRetry: false,
    retryThreadId: "",
    conversationSignature: "detail|thread-3",
    patchShellSignature: "patch|thread-3",
    stickToBottom: true,
  });
});

test("single-thread shell conversation update plans stable update inputs", () => {
  assert.deepEqual(renderPlan.planSingleThreadShellConversationUpdate({
    shellPlan: {
      html: "<turn/>",
    },
    conversationSignature: "detail|thread-1",
    patchShellSignature: "patch|thread-1",
    stickToBottom: true,
    expectedVisibleTurnCount: 2,
    source: "single-thread-render",
  }), {
    html: "<turn/>",
    conversationSignature: "detail|thread-1",
    options: {
      stickToBottom: true,
      patchShellSignature: "patch|thread-1",
      expectedVisibleTurnCount: 2,
      source: "single-thread-render",
    },
    reason: "single-thread-render",
  });

  assert.deepEqual(renderPlan.planSingleThreadShellConversationUpdate({
    shellPlan: {
      html: "<loading/>",
    },
    conversationSignature: "loading|thread-2",
    patchShellSignature: "patch|thread-2",
    stickToBottom: false,
    source: "single-thread-early-shell",
  }), {
    html: "<loading/>",
    conversationSignature: "loading|thread-2",
    options: {
      stickToBottom: false,
      patchShellSignature: "patch|thread-2",
      expectedVisibleTurnCount: 0,
      source: "single-thread-early-shell",
    },
    reason: "single-thread-early-shell",
  });
});

test("single-thread shell post-update effects preserve early retry ordering", () => {
  assert.deepEqual(renderPlan.planSingleThreadShellPostUpdateEffects({
    shellPlan: {
      bindRetry: true,
      retryThreadId: "thread-2",
    },
    updateTickTimer: true,
    publishPluginNavigationState: true,
    reason: "single-thread-early-shell",
  }), {
    effects: [
      {
        type: "bind-retry-current-thread",
        threadId: "thread-2",
      },
      {
        type: "update-tick-timer",
      },
      {
        type: "publish-plugin-navigation-state",
      },
    ],
    reason: "single-thread-early-shell",
  });
});

test("single-thread shell post-update effects preserve full-render ordering", () => {
  assert.deepEqual(renderPlan.planSingleThreadShellPostUpdateEffects({
    checkEmptyVisibleDetailMismatch: true,
    source: "single-thread-render",
    renderMode: "full-render",
    domCount: 4,
    previousCount: 3,
    bindCurrentThreadActions: true,
    scrollToTurnReceiptStart: "turn-9",
    applyPendingPluginRouteHintFocus: true,
    updateTickTimer: true,
    publishPluginNavigationState: true,
  }), {
    effects: [
      {
        type: "check-empty-visible-detail-mismatch",
        source: "single-thread-render",
        renderMode: "full-render",
        domCount: 4,
        previousCount: 3,
      },
      {
        type: "bind-current-thread-actions",
      },
      {
        type: "scroll-turn-receipt-start",
        turnId: "turn-9",
      },
      {
        type: "apply-pending-plugin-route-hint-focus",
      },
      {
        type: "update-tick-timer",
      },
      {
        type: "publish-plugin-navigation-state",
      },
    ],
    reason: "single-thread-shell-post-update",
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
