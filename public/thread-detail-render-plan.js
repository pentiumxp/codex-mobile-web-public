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

  function normalizedDurationMs(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0;
  }

  function normalizedCount(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? Math.trunc(numberValue) : 0;
  }

  function compactReason(value, fallback = "") {
    const reason = String(value || "").trim();
    return (reason || fallback).slice(0, 80);
  }

  function objectOrEmpty(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function textContentFromValue(value) {
    if (value == null) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (Array.isArray(value)) return value.map(textContentFromValue).join("");
    if (typeof value !== "object") return "";
    if (typeof value.text === "string") return value.text;
    if (typeof value.markdown === "string") return value.markdown;
    if (typeof value.content === "string" || Array.isArray(value.content)) return textContentFromValue(value.content);
    if (typeof value.summary === "string" || Array.isArray(value.summary)) return textContentFromValue(value.summary);
    return "";
  }

  function itemVisibleText(item) {
    if (typeof item === "string") return item;
    const value = objectOrEmpty(item);
    return [
      textContentFromValue(value.text),
      textContentFromValue(value.markdown),
      textContentFromValue(value.content),
      textContentFromValue(value.summary),
    ].join("");
  }

  function textLooksLikeWorkflowCard(value) {
    const body = String(value || "");
    return /^\s*\[Cross-thread task card/im.test(body)
      || /^\s*Task card id:/im.test(body)
      || /^\s*Source workspace:/im.test(body)
      || /^\s*Source thread:/im.test(body)
      || /^\s*Approval:/im.test(body)
      || /^\s*Workflow mode:/im.test(body)
      || /^\s*Auto-return:/im.test(body)
      || /^\s*Return required:/im.test(body)
      || /^\s*Return policy:/im.test(body);
  }

  function analyzeThreadDetailHistoryWindow(thread) {
    const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
    const counts = {
      turnCount: turns.length,
      textItemCount: 0,
      workflowItemCount: 0,
      ordinaryUserMessageCount: 0,
      leadingAssistantOnlyWorkflowTurns: 0,
    };
    let stillLeading = true;
    for (const turn of turns) {
      const items = Array.isArray(turn && turn.items) ? turn.items : [];
      let turnHasText = false;
      let turnHasWorkflow = false;
      let turnHasOrdinaryUser = false;
      for (const item of items) {
        const itemType = String(item && item.type || "");
        const textValue = itemVisibleText(item).trim();
        if (!textValue) continue;
        turnHasText = true;
        counts.textItemCount += 1;
        const workflow = textLooksLikeWorkflowCard(textValue);
        if (workflow) {
          counts.workflowItemCount += 1;
          turnHasWorkflow = true;
        }
        if (itemType === "userMessage" && !workflow) {
          counts.ordinaryUserMessageCount += 1;
          turnHasOrdinaryUser = true;
        }
      }
      if (stillLeading && turnHasText && turnHasWorkflow && !turnHasOrdinaryUser) {
        counts.leadingAssistantOnlyWorkflowTurns += 1;
      } else if (turnHasText) {
        stillLeading = false;
      }
    }
    return counts;
  }

  function planThreadDetailHistoryAutoBackfill(input = {}) {
    const thread = objectOrEmpty(input.thread);
    const counts = analyzeThreadDetailHistoryWindow(thread);
    const hasOlder = Boolean(input.hasOlder || thread.mobileOlderTurnsCursor);
    const base = {
      shouldLoad: false,
      reason: "",
      counts,
    };
    if (!hasOlder) return Object.assign({}, base, { reason: "no-older-cursor" });
    if (input.alreadyRequested) return Object.assign({}, base, { reason: "already-requested" });
    if (input.historyBusy || input.busy) return Object.assign({}, base, { reason: "history-busy" });
    if (input.mobileHistoryExpanded || thread.mobileHistoryExpanded) return Object.assign({}, base, { reason: "history-expanded" });
    if (thread.mobileLoading) return Object.assign({}, base, { reason: "thread-loading" });
    if (counts.turnCount <= 0) return Object.assign({}, base, { shouldLoad: true, reason: "empty-recent-window" });
    if (counts.leadingAssistantOnlyWorkflowTurns >= 3 && counts.workflowItemCount > 0) {
      return Object.assign({}, base, { shouldLoad: true, reason: "leading-workflow-receipts" });
    }
    const workflowRatio = counts.textItemCount > 0 ? counts.workflowItemCount / counts.textItemCount : 0;
    if (counts.workflowItemCount >= 3 && workflowRatio >= 0.45) {
      return Object.assign({}, base, { shouldLoad: true, reason: "workflow-dominated-window" });
    }
    if (counts.ordinaryUserMessageCount < 2 && counts.workflowItemCount > 0) {
      return Object.assign({}, base, { shouldLoad: true, reason: "sparse-conversation-context" });
    }
    return Object.assign({}, base, { reason: "recent-window-has-context" });
  }

  function planThreadDetailRefreshRequest(input = {}) {
    const options = objectOrEmpty(input.options);
    const threadId = input.threadId || input.currentThreadId || "";
    if (!threadId) {
      return {
        shouldRefresh: false,
        threadId: "",
        seq: input.threadLoadSeq,
        source: "",
        requestedMode: "",
        query: {},
        timeoutMs: 20000,
        abortActiveRefresh: false,
        reason: "missing-thread-id",
      };
    }
    const requestedMode = options.full === true || String(options.mode || "").toLowerCase() === "full"
      ? "full"
      : "recent";
    return {
      shouldRefresh: true,
      threadId,
      seq: input.threadLoadSeq,
      source: String(options.source || "refresh").slice(0, 40),
      requestedMode,
      query: requestedMode === "recent" ? { mode: "recent" } : {},
      timeoutMs: 20000,
      abortActiveRefresh: Boolean(input.hasActiveRefreshController),
      reason: requestedMode === "full" ? "full-requested" : "recent-default",
    };
  }

  function planThreadDetailRefreshResponseEffects(input = {}) {
    const threadId = text(input.threadId || input.requestThreadId).trim();
    const currentThreadId = text(input.currentThreadId).trim();
    const seq = Number(input.seq ?? input.requestSeq);
    const currentSeq = Number(input.currentThreadSeq ?? input.threadLoadSeq);
    const source = compactReason(input.source, "refresh");
    const staleThread = Boolean(threadId && currentThreadId && threadId !== currentThreadId);
    const staleSeq = Boolean(Number.isFinite(seq) && Number.isFinite(currentSeq) && seq !== currentSeq);
    if (staleThread || staleSeq) {
      return {
        shouldApply: false,
        effects: [],
        reason: staleThread ? "stale-thread" : "stale-seq",
      };
    }
    return {
      shouldApply: true,
      effects: [
        { type: "mark-thread-detail-loaded" },
        {
          type: "remember-render-evidence",
          source: `${source}-detail-api`,
        },
        { type: "merge-current-thread" },
      ],
      reason: "current-thread",
    };
  }

  function planThreadDetailRefreshConsistencyCheck(input = {}) {
    const phase = compactReason(input.projectionConsistencyPhase || input.phase, "");
    const renderMode = compactReason(input.renderMode || input.detailRenderMode, "");
    if (!phase) {
      return {
        shouldCheck: false,
        phase: "",
        renderMode,
        reason: "no-phase",
      };
    }
    return {
      shouldCheck: true,
      phase,
      renderMode,
      reason: "phase-present",
    };
  }

  function planThreadDetailRefreshConsistencyCheckEffects(input = {}) {
    const consistencyCheck = objectOrEmpty(input.consistencyCheck || input);
    const phase = compactReason(consistencyCheck.phase, "");
    const renderMode = compactReason(consistencyCheck.renderMode, "");
    if (!consistencyCheck.shouldCheck || !phase) {
      return {
        effects: [],
        reason: compactReason(consistencyCheck.reason, "no-consistency-check"),
      };
    }
    return {
      effects: [
        {
          type: "conversation-projection-consistency-check",
          phase,
          renderMode,
        },
      ],
      reason: "consistency-check",
    };
  }

  function planThreadDetailRefreshRender(input = {}) {
    const previousConversationSignature = normalizeSignature(input.previousConversationSignature);
    const nextConversationSignature = normalizeSignature(input.nextConversationSignature);
    const renderedConversationSignature = normalizeSignature(input.renderedConversationSignature);
    const previousPatchShellSignature = normalizeSignature(input.previousPatchShellSignature);
    const renderedPatchShellSignature = normalizeSignature(input.renderedPatchShellSignature);
    const allowPatch = input.allowPatch !== false;
    const singleThreadSurfaceAvailable = input.singleThreadSurfaceAvailable === true;
    const renderedDomTurnCount = normalizedCount(input.renderedDomTurnCount);
    const nextVisibleTurnCount = normalizedCount(input.nextVisibleTurnCount);
    const renderedDomEmptyForNonemptyDetail = Boolean(
      singleThreadSurfaceAvailable
      && nextVisibleTurnCount > 0
      && renderedDomTurnCount <= 0
    );
    const shouldRenderDetail = renderedDomEmptyForNonemptyDetail
      || previousConversationSignature !== nextConversationSignature
      || renderedConversationSignature !== nextConversationSignature;

    if (!shouldRenderDetail) {
      return {
        shouldRenderDetail: false,
        canPatch: false,
        detailRenderMode: "metadata-only",
        reason: "signature-stable",
      };
    }
    if (renderedDomEmptyForNonemptyDetail) {
      return {
        shouldRenderDetail: true,
        canPatch: false,
        detailRenderMode: "full-render",
        reason: "rendered-dom-empty",
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

  function planThreadDetailRefreshPatchSurface(input = {}) {
    const shouldRenderDetail = Boolean(input.shouldRenderDetail);
    const threadTileMode = Boolean(input.threadTileMode);
    const threadTileConversationSurface = Boolean(input.threadTileConversationSurface);
    const tilePatchSurface = compactReason(input.tilePatchSurface || input.surface, "");
    const tilePatchSurfaceMatch = tilePatchSurface === "thread-tile-pane";
    const tileSurfaceRefresh = Boolean(threadTileMode || threadTileConversationSurface || tilePatchSurfaceMatch);
    let reason = "single-thread-surface";
    if (threadTileMode) reason = "tile-mode";
    else if (threadTileConversationSurface) reason = "tile-conversation-surface";
    else if (tilePatchSurfaceMatch) reason = "tile-patch-surface";
    else if (!shouldRenderDetail) reason = "metadata-only-single-thread-surface";
    return {
      shouldProbeTilePatchSurface: shouldRenderDetail,
      tileSurfaceRefresh,
      tilePatchSurface,
      reason,
    };
  }

  function planThreadDetailRefreshPatchSurfaceProbeEffects(input = {}) {
    const patchSurfacePlan = objectOrEmpty(input.patchSurfacePlan || input.plan);
    if (!patchSurfacePlan.shouldProbeTilePatchSurface) {
      return {
        effects: [],
        reason: compactReason(patchSurfacePlan.reason, "no-patch-surface-probe"),
      };
    }
    return {
      effects: [
        {
          type: "probe-thread-detail-dom-patch-surface",
          threadId: compactReason(input.threadId, ""),
        },
      ],
      reason: "patch-surface-probe",
    };
  }

  function planThreadDetailRefreshPostMergeEffects() {
    return {
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
    };
  }

  function planThreadDetailRefreshPatchAttemptEffects(input = {}) {
    const shouldRenderDetail = Boolean(input.shouldRenderDetail);
    const tryTilePanePatch = Boolean(input.tryTilePanePatch);
    const tryLocalPatch = Boolean(input.tryLocalPatch);
    const effects = [];
    if (tryTilePanePatch) {
      effects.push({
        type: "tile-pane-patch",
        timingTarget: "tile-pane-patch",
        preserveScroll: true,
      });
    }
    if (shouldRenderDetail && tryLocalPatch) {
      effects.push({
        type: "local-patch",
        timingTarget: "local-patch",
        skipWhenTilePanePatched: true,
      });
    }
    return {
      effects,
      reason: effects.length ? "patch-attempt-effects" : "no-patch-attempt-effects",
    };
  }

  function emptyThreadDetailRefreshPatchAttempt() {
    return {
      tilePanePatchAttempted: false,
      tilePanePatchedDetail: false,
      localPatchAttempted: false,
      locallyPatchedDetail: false,
      tilePanePatchMs: 0,
      localPatchMs: 0,
      patchRejectReason: "",
    };
  }

  function threadDetailRefreshPatchAttemptEffectContext(context = {}, aggregate = {}) {
    return Object.assign({}, objectOrEmpty(context), {
      tilePanePatchedDetail: Boolean(aggregate && aggregate.tilePanePatchedDetail),
    });
  }

  function reduceThreadDetailRefreshPatchAttempt(aggregate = {}, attempt = {}) {
    const result = Object.assign(
      emptyThreadDetailRefreshPatchAttempt(),
      objectOrEmpty(aggregate),
    );
    const patchAttempt = objectOrEmpty(attempt);
    if (patchAttempt.tilePanePatchAttempted) {
      result.tilePanePatchAttempted = true;
      result.tilePanePatchedDetail = Boolean(patchAttempt.tilePanePatchedDetail);
      result.tilePanePatchMs = normalizedDurationMs(result.tilePanePatchMs)
        + normalizedDurationMs(patchAttempt.tilePanePatchMs);
    }
    if (patchAttempt.localPatchAttempted) {
      result.localPatchAttempted = true;
      result.locallyPatchedDetail = Boolean(patchAttempt.locallyPatchedDetail);
      result.localPatchMs = normalizedDurationMs(result.localPatchMs)
        + normalizedDurationMs(patchAttempt.localPatchMs);
      result.patchRejectReason = compactReason(patchAttempt.patchRejectReason, "");
    }
    return result;
  }

  function planThreadDetailRefreshPatchAttemptResult(input = {}) {
    const shouldRenderDetail = Boolean(input.shouldRenderDetail);
    const tilePanePatchAttempted = Boolean(input.tilePanePatchAttempted);
    const localPatchAttempted = Boolean(input.localPatchAttempted);
    const tilePanePatchedDetail = Boolean(input.tilePanePatchedDetail);
    const locallyPatchedDetail = !tilePanePatchedDetail && Boolean(input.locallyPatchedDetail);
    const tilePanePatchMs = normalizedDurationMs(input.tilePanePatchMs);
    const localPatchMs = normalizedDurationMs(input.localPatchMs);
    let patchResult = "not-attempted";
    let detailPatchMs = 0;
    let patchTimingSource = "";
    if (tilePanePatchedDetail) {
      patchResult = shouldRenderDetail ? "tile-pane-patched" : "tile-pane-metadata-patched";
      detailPatchMs = tilePanePatchMs;
      patchTimingSource = "tile-pane";
    } else if (locallyPatchedDetail) {
      patchResult = "local-patched";
      detailPatchMs = localPatchMs;
      patchTimingSource = "local-patch";
    } else if (localPatchAttempted) {
      patchResult = "local-patch-rejected";
      detailPatchMs = localPatchMs;
      patchTimingSource = "local-patch-rejected";
    } else if (tilePanePatchAttempted) {
      patchResult = "tile-pane-miss";
    }
    const reportLocalPatchRejected = Boolean(shouldRenderDetail
      && localPatchAttempted
      && !locallyPatchedDetail
      && !tilePanePatchedDetail);
    return {
      patchResult,
      locallyPatchedDetail,
      tilePanePatchedDetail,
      detailPatchMs,
      patchTimingSource,
      patchRejectReason: reportLocalPatchRejected
        ? compactReason(input.patchRejectReason, "unknown")
        : "",
      reportLocalPatchRejected,
      finalizeResult: {
        locallyPatchedDetail,
        tilePanePatchedDetail,
      },
    };
  }

  function visibleItemCountFromShape(shape, fallback = 0) {
    const value = objectOrEmpty(shape);
    return normalizedCount(value.visibleItemCount ?? value.visible_count ?? fallback);
  }

  function planThreadDetailRefreshPatchRejectedDiagnostic(input = {}) {
    const patchAttemptResult = objectOrEmpty(input.patchAttemptResult);
    if (!patchAttemptResult.reportLocalPatchRejected) {
      return {
        shouldReport: false,
        diagnosticInput: null,
        reason: "not-rejected",
      };
    }
    const renderPlan = objectOrEmpty(input.renderPlan);
    return {
      shouldReport: true,
      diagnosticInput: {
        readMode: compactReason(input.readMode || input.read_mode, ""),
        renderMode: compactReason(renderPlan.detailRenderMode || input.renderMode, ""),
        renderPlanReason: compactReason(renderPlan.reason || input.renderPlanReason, ""),
        patchRejectReason: compactReason(patchAttemptResult.patchRejectReason || input.patchRejectReason, "unknown"),
        previousVisibleItemCount: visibleItemCountFromShape(input.previousVisibleShape, input.previousVisibleItemCount),
        visibleItemCount: visibleItemCountFromShape(input.nextVisibleShape, input.visibleItemCount),
      },
      reason: "local-patch-rejected",
    };
  }

  function planThreadDetailRefreshPatchRejectedDiagnosticEffects(input = {}) {
    const diagnosticPlan = objectOrEmpty(input.diagnosticPlan || input.plan);
    if (!diagnosticPlan.shouldReport) {
      return {
        effects: [],
        reason: compactReason(diagnosticPlan.reason, "not-rejected"),
      };
    }
    return {
      effects: [
        {
          type: "detail-patch-rejected-diagnostic-failure",
          diagnosticInput: objectOrEmpty(diagnosticPlan.diagnosticInput),
        },
      ],
      reason: "local-patch-rejected-diagnostic",
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
    const consistencyCheck = planThreadDetailRefreshConsistencyCheck({
      projectionConsistencyPhase,
      detailRenderMode: outcome.detailRenderMode,
    });
    if (renderAction === "local-patch-metadata-update") {
      return {
        renderAction,
        metadataUpdateMode: "local-patch",
        metadataEffects: [
          "update-current-thread-header",
          "update-tick-timer",
          "publish-plugin-navigation-state",
        ],
        executionAction: "metadata-effects",
        timingTarget: "metadata-update",
        runFullRender: false,
        projectionConsistencyPhase,
        consistencyCheck,
        reason: "local-patch-complete",
      };
    }
    if (renderAction === "metadata-update") {
      return {
        renderAction,
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
        projectionConsistencyPhase,
        consistencyCheck,
        reason: "metadata-only",
      };
    }
    if (renderAction === "full-render") {
      return {
        renderAction,
        metadataUpdateMode: "",
        metadataEffects: [],
        executionAction: "full-render",
        timingTarget: "conversation-render",
        runFullRender: true,
        projectionConsistencyPhase: "refresh-full-render",
        consistencyCheck: planThreadDetailRefreshConsistencyCheck({
          projectionConsistencyPhase: "refresh-full-render",
          detailRenderMode: outcome.detailRenderMode,
        }),
        reason: "full-render",
      };
    }
    return {
      renderAction,
      metadataUpdateMode: "",
      metadataEffects: [],
      executionAction: "none",
      timingTarget: "",
      runFullRender: false,
      projectionConsistencyPhase,
      consistencyCheck,
      reason: renderAction || "none",
    };
  }

  function planThreadDetailRefreshPerformanceInput(input = {}) {
    const renderPlan = objectOrEmpty(input.renderPlan);
    const renderOutcome = objectOrEmpty(input.renderOutcome);
    const patchAttemptResult = objectOrEmpty(input.patchAttemptResult);
    const timings = objectOrEmpty(input.timings);
    return {
      source: compactReason(input.source, ""),
      threadId: compactReason(input.threadId, ""),
      requestedMode: compactReason(input.requestedMode, ""),
      elapsedMs: normalizedDurationMs(timings.elapsedMs),
      apiElapsedMs: normalizedDurationMs(timings.apiElapsedMs),
      renderElapsedMs: normalizedDurationMs(timings.renderElapsedMs),
      mergeMs: normalizedDurationMs(timings.mergeMs),
      composerRenderMs: normalizedDurationMs(timings.composerRenderMs),
      threadListRenderMs: normalizedDurationMs(timings.threadListRenderMs),
      conversationRenderMs: normalizedDurationMs(timings.conversationRenderMs),
      detailPatchMs: normalizedDurationMs(patchAttemptResult.detailPatchMs),
      metadataUpdateMs: normalizedDurationMs(timings.metadataUpdateMs),
      detailRenderMode: compactReason(renderOutcome.detailRenderMode || renderPlan.detailRenderMode, ""),
      refreshRenderAction: compactReason(renderOutcome.renderAction, ""),
      renderPlanReason: compactReason(renderPlan.reason, ""),
      patchRejectReason: compactReason(patchAttemptResult.patchRejectReason, ""),
      skippedDetailRender: input.shouldRenderDetail === false,
      locallyPatchedDetail: Boolean(renderOutcome.locallyPatchedDetail),
      tilePanePatchedDetail: Boolean(renderOutcome.tilePanePatchedDetail),
    };
  }

  function planThreadDetailRefreshTelemetryEffects(input = {}) {
    const performanceEvent = objectOrEmpty(input.performanceEvent);
    const eventName = compactReason(input.eventName, "thread_refresh_ms");
    const throttleKey = compactReason(input.throttleKey, eventName);
    const minIntervalMs = normalizedDurationMs(input.minIntervalMs);
    const action = compactReason(input.action, "thread-detail-refresh");
    const threadId = compactReason(input.threadId, "");
    return {
      effects: [
        {
          type: "post-performance-event",
          eventName,
          payload: performanceEvent,
          options: {
            key: throttleKey,
            minIntervalMs,
          },
        },
        {
          type: "record-thread-detail-response-diagnostics",
          performanceEvent,
          context: {
            action,
            threadId,
          },
        },
      ],
      reason: "refresh-telemetry",
    };
  }

  function planThreadDetailRefreshFailureDiagnosticEffects(input = {}) {
    return {
      effects: [
        {
          type: "thread-detail-refresh-failed-diagnostic-failure",
          diagnosticInput: {
            errorCode: compactReason(input.errorCode || input.error_code, "thread_detail_refresh_failed"),
            durationBucket: compactReason(input.durationBucket || input.duration_bucket, ""),
            statusCode: compactReason(input.statusCode || input.status_code, ""),
            threadHash: compactReason(input.threadHash || input.thread_hash, ""),
          },
        },
      ],
      reason: "refresh-failed-diagnostic",
    };
  }

  function planThreadDetailRefreshExecutionEffects(input = {}) {
    const executionAction = compactReason(input.executionAction, "");
    const metadataEffects = Array.isArray(input.metadataEffects) ? input.metadataEffects.slice() : [];
    if (executionAction === "metadata-effects") {
      return {
        effects: [
          {
            type: "metadata-effects",
            timingTarget: "metadata-update",
            metadataEffects,
            requireEffects: true,
          },
        ],
        reason: "metadata-effects",
      };
    }
    if (executionAction === "full-render") {
      return {
        effects: [
          {
            type: "full-render",
            timingTarget: "conversation-render",
            metadataEffects: [],
            requireEffects: false,
          },
        ],
        reason: "full-render",
      };
    }
    if (!executionAction || executionAction === "none") {
      return {
        effects: [],
        reason: executionAction || "none",
      };
    }
    return {
      effects: [
        {
          type: executionAction,
          timingTarget: "",
          metadataEffects: [],
          requireEffects: false,
        },
      ],
      reason: "unknown-execution-action",
    };
  }

  function planThreadDetailRefreshCompletionEffects(input = {}) {
    const threadHash = compactReason(input.threadHash, "");
    return {
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
              thread_hash: threadHash,
            },
          },
        },
        { type: "schedule-usage-backfill-refresh" },
        { type: "schedule-live-poll" },
      ],
      reason: "refresh-complete",
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

  function planSingleThreadEarlyShellExecution(input = {}) {
    const loadingWithoutVisibleTurns = Boolean(input.loadingWithoutVisibleTurns);
    const loadError = text(input.loadError);
    if (!loadingWithoutVisibleTurns && !loadError) {
      return {
        shouldRender: false,
        mode: "detail",
        reason: "detail-content",
        html: "",
        clearLiveOperationDock: false,
        bindRetry: false,
        retryThreadId: "",
        conversationSignature: text(input.conversationSignature),
        patchShellSignature: text(input.patchShellSignature),
        stickToBottom: Boolean(input.stickToBottom),
      };
    }
    const shellPlan = planSingleThreadFullRenderShell({
      threadId: input.threadId || input.currentThreadId,
      currentThreadId: input.currentThreadId,
      loadingWithoutVisibleTurns,
      loadError,
      escapeHtml: input.escapeHtml,
    });
    return {
      shouldRender: true,
      mode: shellPlan.mode,
      reason: shellPlan.mode,
      html: shellPlan.html,
      clearLiveOperationDock: Boolean(shellPlan.clearLiveOperationDock),
      bindRetry: Boolean(shellPlan.bindRetry),
      retryThreadId: shellPlan.retryThreadId || "",
      conversationSignature: text(input.conversationSignature),
      patchShellSignature: text(input.patchShellSignature),
      stickToBottom: Boolean(input.stickToBottom),
    };
  }

  function planSingleThreadShellConversationUpdate(input = {}) {
    const shellPlan = objectOrEmpty(input.shellPlan);
    const source = compactReason(input.source, "single-thread-render");
    return {
      html: text(shellPlan.html),
      conversationSignature: text(input.conversationSignature),
      options: {
        stickToBottom: Boolean(input.stickToBottom),
        patchShellSignature: text(input.patchShellSignature),
        expectedVisibleTurnCount: normalizedCount(input.expectedVisibleTurnCount),
        source,
      },
      reason: source,
    };
  }

  function planSingleThreadShellPostUpdateEffects(input = {}) {
    const shellPlan = objectOrEmpty(input.shellPlan);
    const effects = [];
    if (input.bindRetry || shellPlan.bindRetry) {
      effects.push({
        type: "bind-retry-current-thread",
        threadId: text(input.retryThreadId || shellPlan.retryThreadId).trim(),
      });
    }
    if (input.checkEmptyVisibleDetailMismatch) {
      effects.push({
        type: "check-empty-visible-detail-mismatch",
        source: compactReason(input.source, "single-thread-render"),
        renderMode: compactReason(input.renderMode, "full-render"),
        domCount: normalizedCount(input.domCount),
        previousCount: normalizedCount(input.previousCount),
      });
    }
    if (input.bindCurrentThreadActions) effects.push({ type: "bind-current-thread-actions" });
    const turnId = text(input.scrollToTurnReceiptStart).trim();
    if (turnId) effects.push({ type: "scroll-turn-receipt-start", turnId });
    if (input.applyPendingPluginRouteHintFocus) effects.push({ type: "apply-pending-plugin-route-hint-focus" });
    if (input.updateTickTimer) effects.push({ type: "update-tick-timer" });
    if (input.publishPluginNavigationState) effects.push({ type: "publish-plugin-navigation-state" });
    return {
      effects,
      reason: compactReason(input.reason, effects.length ? "single-thread-shell-post-update" : "no-post-update-effects"),
    };
  }

  return {
    emptyThreadDetailRefreshPatchAttempt,
    finalizeThreadDetailRenderPlan,
    normalizeSignature,
    planThreadDetailRefreshCompletionEffects,
    planThreadDetailRefreshConsistencyCheck,
    planThreadDetailRefreshConsistencyCheckEffects,
    planThreadDetailRefreshResponseEffects,
    planThreadDetailRefreshPatchAttemptEffects,
    planThreadDetailRefreshPatchAttemptResult,
    planThreadDetailRefreshPatchRejectedDiagnostic,
    planThreadDetailRefreshPatchRejectedDiagnosticEffects,
    planThreadDetailRefreshOutcomeExecution,
    planThreadDetailRefreshExecutionEffects,
    planThreadDetailRefreshPerformanceInput,
    planThreadDetailRefreshTelemetryEffects,
    planThreadDetailRefreshFailureDiagnosticEffects,
    planThreadDetailRefreshRequest,
    planThreadDetailRefreshPatchSurface,
    planThreadDetailRefreshPatchSurfaceProbeEffects,
    planThreadDetailRefreshPostMergeEffects,
    planSingleThreadEarlyShellExecution,
    planSingleThreadFullRenderShell,
    planSingleThreadShellConversationUpdate,
    planSingleThreadShellPostUpdateEffects,
    planThreadDetailHistoryAutoBackfill,
    planThreadDetailRefreshPatchExecution,
    planThreadDetailRefreshRender,
    reduceThreadDetailRefreshPatchAttempt,
    threadDetailRefreshPatchAttemptEffectContext,
  };
}));
