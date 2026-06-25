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

  function planThreadDetailRefreshPatchExecution(input = {}) {
    const shouldRenderDetail = Boolean(input.shouldRenderDetail);
    const canPatch = Boolean(input.canPatch);
    const tileSurfaceRefresh = Boolean(input.tileSurfaceRefresh);
    if (!shouldRenderDetail) {
      return {
        tryTilePanePatch: true,
        tryLocalPatch: false,
        updateMetadataOnTileMiss: true,
        fallbackAction: "metadata-update",
        localPatchBlockedReason: "signature-stable",
        reason: "metadata-only",
      };
    }
    if (!canPatch) {
      return {
        tryTilePanePatch: true,
        tryLocalPatch: false,
        updateMetadataOnTileMiss: false,
        fallbackAction: "full-render",
        localPatchBlockedReason: "patch-not-allowed",
        reason: "full-render-required",
      };
    }
    if (tileSurfaceRefresh) {
      return {
        tryTilePanePatch: true,
        tryLocalPatch: false,
        updateMetadataOnTileMiss: false,
        fallbackAction: "full-render",
        localPatchBlockedReason: "tile-surface-refresh",
        reason: "tile-surface-refresh",
      };
    }
    return {
      tryTilePanePatch: true,
      tryLocalPatch: true,
      updateMetadataOnTileMiss: false,
      fallbackAction: "full-render",
      localPatchBlockedReason: "",
      reason: "local-patch-eligible",
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

  function planThreadDetailRefreshOutcomeExecution(outcome = {}) {
    const renderAction = String(outcome.renderAction || "");
    const projectionConsistencyPhase = String(outcome.projectionConsistencyPhase || "");
    if (renderAction === "local-patch-metadata-update") {
      return {
        renderAction,
        metadataUpdateMode: "local-patch",
        runFullRender: false,
        projectionConsistencyPhase,
        reason: "local-patch-complete",
      };
    }
    if (renderAction === "metadata-update") {
      return {
        renderAction,
        metadataUpdateMode: "metadata-only",
        runFullRender: false,
        projectionConsistencyPhase,
        reason: "metadata-only",
      };
    }
    if (renderAction === "full-render") {
      return {
        renderAction,
        metadataUpdateMode: "",
        runFullRender: true,
        projectionConsistencyPhase: "refresh-full-render",
        reason: "full-render",
      };
    }
    return {
      renderAction,
      metadataUpdateMode: "",
      runFullRender: false,
      projectionConsistencyPhase,
      reason: renderAction || "none",
    };
  }

  function text(value) {
    return String(value ?? "");
  }

  function htmlEscaper(input = {}) {
    return typeof input.escapeHtml === "function"
      ? input.escapeHtml
      : (value) => text(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
  }

  function hasHtml(value) {
    return text(value).trim().length > 0;
  }

  function planSingleThreadFullRenderShell(input = {}) {
    const escape = htmlEscaper(input);
    const threadId = text(input.threadId || input.currentThreadId).trim();
    if (input.loadingWithoutVisibleTurns) {
      return {
        mode: "loading",
        html: `<div class="empty-state entry-animate">Loading thread...</div>`,
        clearLiveOperationDock: true,
        bindRetry: false,
        retryThreadId: "",
        hasPrimaryContent: false,
        emptyMessage: "",
      };
    }
    if (input.loadError) {
      return {
        mode: "load-error",
        html: `<div class="empty-state entry-animate">
        <div>Thread failed: ${escape(input.loadError)}</div>
        <button id="retryCurrentThread" class="retry-button" type="button">Retry</button>
      </div>`,
        clearLiveOperationDock: true,
        bindRetry: true,
        retryThreadId: threadId,
        hasPrimaryContent: false,
        emptyMessage: "",
      };
    }
    const hasPrimaryContent = hasHtml(input.turnsHtml) || hasHtml(input.approvalsHtml) || hasHtml(input.taskCardsHtml);
    const emptyMessage = input.readWarningMessage
      ? "暂时没有可显示的完整消息。共享模式恢复后刷新这个页面即可继续读取。"
      : "No visible turns.";
    const body = hasPrimaryContent
      ? `${text(input.turnsHtml)}${text(input.approvalsHtml)}${text(input.taskCardsHtml)}${text(input.pluginRefreshNotice)}`
      : `${text(input.pluginRefreshNotice)}<div class="empty-state entry-animate">${escape(emptyMessage)}</div>`;
    return {
      mode: "detail",
      html: `${text(input.goalCard)}${text(input.rolloutWarning)}${text(input.loadingNote)}${text(input.taskToolbar)}${text(input.omittedBanner)}${text(input.readWarning)}${body}`,
      clearLiveOperationDock: false,
      bindRetry: false,
      retryThreadId: "",
      hasPrimaryContent,
      emptyMessage,
    };
  }

  return {
    finalizeThreadDetailRenderPlan,
    normalizeSignature,
    planThreadDetailRefreshOutcomeExecution,
    planSingleThreadFullRenderShell,
    planThreadDetailRefreshPatchExecution,
    planThreadDetailRefreshRender,
  };
}));
