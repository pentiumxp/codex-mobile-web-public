"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const renderPlan = require(path.resolve(__dirname, "..", "public", "thread-detail-render-plan.js"));

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
    projectionConsistencyPhase: "refresh-local-patch",
  }), {
    renderAction: "local-patch-metadata-update",
    metadataUpdateMode: "local-patch",
    metadataEffects: [
      "update-current-thread-header",
      "update-tick-timer",
      "publish-plugin-navigation-state",
    ],
    runFullRender: false,
    projectionConsistencyPhase: "refresh-local-patch",
    reason: "local-patch-complete",
  });
});

test("thread detail refresh outcome execution maps metadata-only refreshes", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshOutcomeExecution({
    renderAction: "metadata-update",
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
    runFullRender: false,
    projectionConsistencyPhase: "refresh-metadata",
    reason: "metadata-only",
  });
});

test("thread detail refresh outcome execution gives full render an explicit consistency phase", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshOutcomeExecution({
    renderAction: "full-render",
  }), {
    renderAction: "full-render",
    metadataUpdateMode: "",
    metadataEffects: [],
    runFullRender: true,
    projectionConsistencyPhase: "refresh-full-render",
    reason: "full-render",
  });
});

test("thread detail refresh outcome execution preserves terminal tile-pane patch phases", () => {
  assert.deepEqual(renderPlan.planThreadDetailRefreshOutcomeExecution({
    renderAction: "tile-pane-patch",
    projectionConsistencyPhase: "refresh-local-patch",
  }), {
    renderAction: "tile-pane-patch",
    metadataUpdateMode: "",
    metadataEffects: [],
    runFullRender: false,
    projectionConsistencyPhase: "refresh-local-patch",
    reason: "tile-pane-patch",
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
