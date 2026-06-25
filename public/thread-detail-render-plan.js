"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexThreadDetailRenderPlan = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  function normalizeSignature(value) {
    return String(value || "");
  }

  function planThreadDetailRefreshRender(input = {}) {
    const previousConversationSignature = normalizeSignature(input.previousConversationSignature);
    const nextConversationSignature = normalizeSignature(input.nextConversationSignature);
    const renderedConversationSignature = normalizeSignature(input.renderedConversationSignature);
    const allowPatch = input.allowPatch !== false;
    const shouldRenderDetail = previousConversationSignature !== nextConversationSignature
      || renderedConversationSignature !== nextConversationSignature;

    if (!shouldRenderDetail) {
      return {
        shouldRenderDetail: false,
        canPatch: false,
        detailRenderMode: "metadata-only",
        reason: "signature-stable",
      };
    }

    const canPatch = Boolean(allowPatch
      && previousConversationSignature
      && renderedConversationSignature
      && previousConversationSignature === renderedConversationSignature);
    return {
      shouldRenderDetail: true,
      canPatch,
      detailRenderMode: canPatch ? "patch" : "full-render",
      reason: canPatch ? "signature-changed" : "rendered-signature-stale",
    };
  }

  function finalizeThreadDetailRenderPlan(plan = {}, result = {}) {
    if (!plan.shouldRenderDetail) {
      return {
        detailRenderMode: "metadata-only",
        locallyPatchedDetail: false,
      };
    }
    const locallyPatchedDetail = Boolean(result.locallyPatchedDetail);
    return {
      detailRenderMode: locallyPatchedDetail ? "patch" : "full-render",
      locallyPatchedDetail,
    };
  }

  return {
    finalizeThreadDetailRenderPlan,
    normalizeSignature,
    planThreadDetailRefreshRender,
  };
}));
