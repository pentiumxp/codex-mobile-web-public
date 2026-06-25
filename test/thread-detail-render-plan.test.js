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
  });
});

test("thread detail refresh render plan can disable patch explicitly", () => {
  const plan = renderPlan.planThreadDetailRefreshRender({
    previousConversationSignature: "sig-a",
    nextConversationSignature: "sig-b",
    renderedConversationSignature: "sig-a",
    allowPatch: false,
  });

  assert.equal(plan.shouldRenderDetail, true);
  assert.equal(plan.canPatch, false);
  assert.equal(plan.detailRenderMode, "full-render");
});
