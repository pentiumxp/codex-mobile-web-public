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
    const previousPatchShellSignature = normalizeSignature(input.previousPatchShellSignature);
    const renderedPatchShellSignature = normalizeSignature(input.renderedPatchShellSignature);
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

    const fullSignatureMatches = Boolean(previousConversationSignature
      && renderedConversationSignature
      && previousConversationSignature === renderedConversationSignature);
    const patchShellMatches = Boolean(previousPatchShellSignature
      && renderedPatchShellSignature
      && previousPatchShellSignature === renderedPatchShellSignature);
    const canPatch = Boolean(allowPatch && (fullSignatureMatches || patchShellMatches));
    return {
      shouldRenderDetail: true,
      canPatch,
      detailRenderMode: canPatch ? "patch" : "full-render",
      reason: canPatch
        ? (fullSignatureMatches ? "signature-changed" : "patch-shell-stable")
        : "rendered-signature-stale",
    };
  }

  function finalizeThreadDetailRenderPlan(plan = {}, result = {}) {
    const tilePanePatchedDetail = Boolean(result.tilePanePatchedDetail);
    const locallyPatchedDetail = Boolean(result.locallyPatchedDetail);
    if (!plan.shouldRenderDetail) {
      if (tilePanePatchedDetail) {
        return {
          detailRenderMode: "tile-pane-metadata",
          locallyPatchedDetail: false,
          tilePanePatchedDetail: true,
          renderAction: "tile-pane-patch",
          projectionConsistencyPhase: "refresh-metadata",
        };
      }
      return {
        detailRenderMode: "metadata-only",
        locallyPatchedDetail: false,
        tilePanePatchedDetail: false,
        renderAction: "metadata-update",
        projectionConsistencyPhase: "refresh-metadata",
      };
    }
    if (tilePanePatchedDetail) {
      return {
        detailRenderMode: "tile-pane",
        locallyPatchedDetail: false,
        tilePanePatchedDetail: true,
        renderAction: "tile-pane-patch",
        projectionConsistencyPhase: "refresh-local-patch",
      };
    }
    if (locallyPatchedDetail) {
      return {
        detailRenderMode: "patch",
        locallyPatchedDetail: true,
        tilePanePatchedDetail: false,
        renderAction: "local-patch-metadata-update",
        projectionConsistencyPhase: "refresh-local-patch",
      };
    }
    return {
      detailRenderMode: "full-render",
      locallyPatchedDetail: false,
      tilePanePatchedDetail: false,
      renderAction: "full-render",
      projectionConsistencyPhase: "",
    };
  }

  return {
    finalizeThreadDetailRenderPlan,
    normalizeSignature,
    planThreadDetailRefreshRender,
  };
}));
