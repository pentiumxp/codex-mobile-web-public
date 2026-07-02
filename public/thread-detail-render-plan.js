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

  function normalizedOptionalDurationMs(value) {
    if (value == null) return null;
    return normalizedDurationMs(value);
  }

  function normalizedCount(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? Math.trunc(numberValue) : 0;
  }

  function normalizedStringList(value) {
    return Array.isArray(value) ? value.map((entry) => String(entry || "")).filter(Boolean) : [];
  }

  function turnOrderMismatch(expectedValue, renderedValue) {
    const expected = normalizedStringList(expectedValue);
    const rendered = normalizedStringList(renderedValue);
    if (!expected.length) return false;
    if (expected.length !== rendered.length) return true;
    for (let index = 0; index < expected.length; index += 1) {
      if (expected[index] !== rendered[index]) return true;
    }
    return false;
  }

  function compactReason(value, fallback = "", maxLength = 80) {
    const reason = String(value || "").trim();
    return (reason || fallback).slice(0, maxLength);
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
      || /^\s*\[Codex Mobile task-card continuation\]/im.test(body)
      || /^\s*#\s*Continuation Bootstrap Index\b/im.test(body)
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

  function planThreadDetailHistoryAutoBackfillEffects(input = {}) {
    const plan = objectOrEmpty(input.plan);
    if (!plan.shouldLoad) {
      return {
        effects: [],
        reason: compactReason(plan.reason, "not-needed"),
      };
    }
    const source = compactReason(input.source, "unknown").slice(0, 40);
    const threadId = compactReason(input.threadId, "");
    const seq = Number(input.seq);
    return {
      effects: [
        {
          type: "remember-history-auto-backfill-key",
          key: compactReason(input.key, ""),
        },
        {
          type: "post-client-event",
          eventName: "thread_history_auto_backfill",
          payload: {
            source,
            reason: compactReason(plan.reason, ""),
            counts: objectOrEmpty(plan.counts),
            thread_hash: compactReason(input.threadHash, ""),
            readMode: compactReason(input.readMode, ""),
            buildId: compactReason(input.buildId, ""),
          },
        },
        {
          type: "schedule-load-older-thread-turns",
          threadId,
          seq: Number.isFinite(seq) ? seq : 0,
          delayMs: normalizedDurationMs(input.delayMs),
          preserveScroll: true,
          source: "auto-context",
        },
      ],
      reason: "history-auto-backfill-effects",
    };
  }

  function planThreadDetailRefreshRequest(input = {}) {
    const options = objectOrEmpty(input.options);
    const threadId = input.threadId || input.currentThreadId || "";
    const source = String(options.source || "refresh").slice(0, 40);
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
    if (input.documentHidden === true && options.force !== true) {
      return {
        shouldRefresh: false,
        threadId,
        seq: input.threadLoadSeq,
        source,
        requestedMode: "",
        query: {},
        timeoutMs: 20000,
        abortActiveRefresh: false,
        reason: "document-hidden",
      };
    }
    if (input.hasActiveThreadLoadController === true && options.force !== true) {
      return {
        shouldRefresh: false,
        threadId,
        seq: input.threadLoadSeq,
        source,
        requestedMode: "",
        query: {},
        timeoutMs: 20000,
        abortActiveRefresh: false,
        reason: "thread-load-in-flight",
      };
    }
    const requestedMode = options.full === true || String(options.mode || "").toLowerCase() === "full"
      ? "full"
      : "recent";
    return {
      shouldRefresh: true,
      threadId,
      seq: input.threadLoadSeq,
      source,
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

  function planThreadDetailFirstPaintResponseEffects(input = {}) {
    const source = compactReason(input.source, "unknown").slice(0, 40);
    return {
      shouldApply: true,
      effects: [
        { type: "mark-thread-detail-loaded" },
        {
          type: "remember-render-evidence",
          source: `${source}-detail-api`,
        },
        { type: "sync-pending-server-requests" },
        { type: "merge-current-thread" },
      ],
      reason: "first-paint-response",
    };
  }

  function planThreadDetailFullBackfillResponseEffects(input = {}) {
    const source = compactReason(input.source, "unknown").slice(0, 40);
    return {
      shouldApply: true,
      effects: [
        { type: "mark-thread-detail-loaded" },
        {
          type: "remember-render-evidence",
          source: `${source}-detail-api`,
        },
        { type: "sync-pending-server-requests" },
        { type: "merge-current-thread" },
      ],
      reason: "full-backfill-response",
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

  function planThreadDetailRefreshRenderInput(input = {}) {
    const nextVisibleShape = objectOrEmpty(input.nextVisibleShape);
    const nextVisibleTurnCount = Object.prototype.hasOwnProperty.call(input, "nextVisibleTurnCount")
      ? input.nextVisibleTurnCount
      : nextVisibleShape.visibleTurnCount;
    const nextVisibleItemCount = Object.prototype.hasOwnProperty.call(input, "nextVisibleItemCount")
      ? input.nextVisibleItemCount
      : nextVisibleShape.visibleItemCount;
    return {
      previousConversationSignature: normalizeSignature(input.previousConversationSignature),
      nextConversationSignature: normalizeSignature(input.nextConversationSignature),
      renderedConversationSignature: normalizeSignature(input.renderedConversationSignature),
      previousPatchShellSignature: normalizeSignature(input.previousPatchShellSignature),
      renderedPatchShellSignature: normalizeSignature(input.renderedPatchShellSignature),
      allowPatch: input.allowPatch !== false,
      singleThreadSurfaceAvailable: input.singleThreadSurfaceAvailable === true,
      renderedDomTurnCount: normalizedCount(input.renderedDomTurnCount),
      renderedDomItemCount: normalizedCount(input.renderedDomItemCount),
      duplicateRenderKeyCount: normalizedCount(input.duplicateRenderKeyCount),
      nextVisibleTurnCount: normalizedCount(nextVisibleTurnCount),
      nextVisibleItemCount: normalizedCount(nextVisibleItemCount),
      expectedTurnIds: normalizedStringList(input.expectedTurnIds),
      renderedDomTurnIds: normalizedStringList(input.renderedDomTurnIds),
    };
  }

  function planThreadDetailRefreshRender(input = {}) {
    const renderInput = planThreadDetailRefreshRenderInput(input);
    const previousConversationSignature = renderInput.previousConversationSignature;
    const nextConversationSignature = renderInput.nextConversationSignature;
    const renderedConversationSignature = renderInput.renderedConversationSignature;
    const previousPatchShellSignature = renderInput.previousPatchShellSignature;
    const renderedPatchShellSignature = renderInput.renderedPatchShellSignature;
    const allowPatch = renderInput.allowPatch !== false;
    const singleThreadSurfaceAvailable = renderInput.singleThreadSurfaceAvailable === true;
    const renderedDomTurnCount = renderInput.renderedDomTurnCount;
    const nextVisibleTurnCount = renderInput.nextVisibleTurnCount;
    const renderedDomMissingVisibleTurns = Boolean(
      singleThreadSurfaceAvailable
      && nextVisibleTurnCount > 0
      && renderedDomTurnCount < nextVisibleTurnCount
    );
    const renderedDomMissingVisibleItems = Boolean(
      singleThreadSurfaceAvailable
      && renderInput.nextVisibleItemCount > 0
      && renderInput.renderedDomItemCount < renderInput.nextVisibleItemCount
    );
    const renderedDomDuplicateKeys = Boolean(
      singleThreadSurfaceAvailable
      && renderInput.duplicateRenderKeyCount > 0
    );
    const renderedDomTurnOrderMismatch = Boolean(
      singleThreadSurfaceAvailable
      && turnOrderMismatch(renderInput.expectedTurnIds, renderInput.renderedDomTurnIds)
    );
    const renderedDomInvalidForNonemptyDetail = renderedDomMissingVisibleTurns
      || renderedDomMissingVisibleItems
      || renderedDomDuplicateKeys
      || renderedDomTurnOrderMismatch;
    const shouldRenderDetail = renderedDomInvalidForNonemptyDetail
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
    if (renderedDomInvalidForNonemptyDetail) {
      let reason = "rendered-dom-empty";
      if (renderedDomDuplicateKeys) reason = "rendered-dom-duplicate-render-keys";
      else if (renderedDomTurnOrderMismatch) reason = "rendered-dom-turn-order-mismatch";
      else if (renderedDomMissingVisibleItems) reason = "rendered-dom-item-mismatch";
      else if (renderedDomMissingVisibleTurns && renderedDomTurnCount > 0) reason = "rendered-dom-turn-mismatch";
      return {
        shouldRenderDetail: true,
        canPatch: false,
        detailRenderMode: "full-render",
        reason,
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

  function planThreadDetailRefreshRenderStage(input = {}) {
    const refreshRenderInput = planThreadDetailRefreshRenderInput(input);
    const renderPlan = planThreadDetailRefreshRender(refreshRenderInput);
    return {
      refreshRenderInput,
      renderPlan,
      shouldRenderDetail: Boolean(renderPlan.shouldRenderDetail),
      detailRenderMode: compactReason(renderPlan.detailRenderMode, ""),
      reason: compactReason(renderPlan.reason, "refresh-render-stage"),
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
        tryLocalPatch: true,
        updateMetadataOnTileMiss: false,
        fallbackAction: "full-render",
        localPatchBlockedReason: "",
        reason: "tile-surface-patch-chain",
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

  function planThreadDetailRefreshPatchSurfaceProbeStage(input = {}) {
    const patchSurfaceProbePlan = planThreadDetailRefreshPatchSurface({
      shouldRenderDetail: input.shouldRenderDetail,
      threadTileMode: input.threadTileMode,
      threadTileConversationSurface: input.threadTileConversationSurface,
    });
    const patchSurfaceProbeEffectsPlan = planThreadDetailRefreshPatchSurfaceProbeEffects({
      patchSurfacePlan: patchSurfaceProbePlan,
      threadId: input.threadId,
    });
    return {
      patchSurfaceProbePlan,
      patchSurfaceProbeEffectsPlan,
      reason: patchSurfaceProbeEffectsPlan.reason,
    };
  }

  function planThreadDetailRefreshPatchSurfaceResultStage(input = {}) {
    const tilePatchPlan = objectOrEmpty(input.tilePatchPlan);
    const patchSurfacePlan = planThreadDetailRefreshPatchSurface({
      shouldRenderDetail: input.shouldRenderDetail,
      threadTileMode: input.threadTileMode,
      threadTileConversationSurface: input.threadTileConversationSurface,
      tilePatchSurface: input.tilePatchSurface || tilePatchPlan.surface,
    });
    return {
      patchSurfacePlan,
      reason: patchSurfacePlan.reason,
    };
  }

  function planThreadDetailRefreshPatchSurfaceExecutionStage(input = {}) {
    const renderPlan = objectOrEmpty(input.renderPlan);
    const shouldRenderDetail = Object.prototype.hasOwnProperty.call(input, "shouldRenderDetail")
      ? Boolean(input.shouldRenderDetail)
      : Boolean(renderPlan.shouldRenderDetail);
    const patchSurfaceResultStage = planThreadDetailRefreshPatchSurfaceResultStage({
      shouldRenderDetail,
      threadTileMode: input.threadTileMode,
      threadTileConversationSurface: input.threadTileConversationSurface,
      tilePatchPlan: input.tilePatchPlan,
      tilePatchSurface: input.tilePatchSurface,
    });
    const patchExecutionStage = planThreadDetailRefreshPatchExecutionStage({
      renderPlan,
      shouldRenderDetail,
      patchSurfacePlan: patchSurfaceResultStage.patchSurfacePlan,
    });
    return {
      patchSurfaceResultStage,
      patchSurfacePlan: patchSurfaceResultStage.patchSurfacePlan,
      patchExecutionStage,
      patchExecutionPlan: patchExecutionStage.patchExecutionPlan,
      patchAttemptEffectsPlan: patchExecutionStage.patchAttemptEffectsPlan,
      reason: patchExecutionStage.reason,
    };
  }

  function planThreadDetailRefreshPostMergeEffects() {
    return {
      groups: [
        {
          timing: "merge",
          timingField: "mergeMs",
          effects: ["merge-thread-list"],
        },
        {
          timing: "composer-render",
          timingField: "composerRenderMs",
          effects: ["render-composer-settings", "sync-active-turn"],
        },
        {
          timing: "thread-list-render",
          timingField: "threadListRenderMs",
          effects: ["render-threads"],
        },
      ],
      reason: "default-post-merge-effects",
    };
  }

  function planThreadDetailRefreshPostMergeTimingFields(plan = {}) {
    const groups = Array.isArray(plan && plan.groups) ? plan.groups : [];
    if (!groups.length) {
      return {
        ok: false,
        entries: [],
        timings: {},
        reason: "missing-post-merge-groups",
      };
    }
    const seenFields = new Set();
    const entries = [];
    const timings = {};
    for (const group of groups) {
      const timing = compactReason(group && group.timing, "");
      const field = compactReason(group && group.timingField, "");
      if (!timing || !field) {
        return {
          ok: false,
          entries: [],
          timings: {},
          reason: "missing-post-merge-timing-metadata",
        };
      }
      if (seenFields.has(field)) {
        return {
          ok: false,
          entries: [],
          timings: {},
          reason: "duplicate-post-merge-timing-field",
        };
      }
      seenFields.add(field);
      entries.push({ timing, field });
      timings[field] = 0;
    }
    return {
      ok: true,
      entries,
      timings,
      reason: "post-merge-timing-fields",
    };
  }

  function planThreadDetailFirstPaintPostMergeTimingEffects(plan = {}) {
    const timingFieldsPlan = planThreadDetailRefreshPostMergeTimingFields(plan);
    if (!timingFieldsPlan.ok) {
      return {
        ok: false,
        beforeDraftRestore: [],
        afterDraftRestore: [],
        timings: {},
        reason: timingFieldsPlan.reason,
      };
    }
    const beforeDraftRestore = [];
    const afterDraftRestore = [];
    for (const entry of timingFieldsPlan.entries) {
      if (entry.timing === "merge") beforeDraftRestore.push(entry);
      else afterDraftRestore.push(entry);
    }
    if (!beforeDraftRestore.length) {
      return {
        ok: false,
        beforeDraftRestore: [],
        afterDraftRestore: [],
        timings: {},
        reason: "missing-first-paint-merge-timing",
      };
    }
    return {
      ok: true,
      beforeDraftRestore,
      afterDraftRestore,
      timings: Object.assign({}, timingFieldsPlan.timings),
      reason: "first-paint-post-merge-timing-effects",
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

  function planThreadDetailRefreshPatchExecutionStage(input = {}) {
    const renderPlan = objectOrEmpty(input.renderPlan);
    const patchSurfacePlan = objectOrEmpty(input.patchSurfacePlan);
    const shouldRenderDetail = Object.prototype.hasOwnProperty.call(input, "shouldRenderDetail")
      ? Boolean(input.shouldRenderDetail)
      : Boolean(renderPlan.shouldRenderDetail);
    const canPatch = Object.prototype.hasOwnProperty.call(input, "canPatch")
      ? Boolean(input.canPatch)
      : Boolean(renderPlan.canPatch);
    const tileSurfaceRefresh = Object.prototype.hasOwnProperty.call(input, "tileSurfaceRefresh")
      ? Boolean(input.tileSurfaceRefresh)
      : Boolean(patchSurfacePlan.tileSurfaceRefresh);
    const patchExecutionPlan = planThreadDetailRefreshPatchExecution({
      shouldRenderDetail,
      canPatch,
      tileSurfaceRefresh,
    });
    const patchAttemptEffectsPlan = planThreadDetailRefreshPatchAttemptEffects({
      shouldRenderDetail,
      tryTilePanePatch: patchExecutionPlan.tryTilePanePatch,
      tryLocalPatch: patchExecutionPlan.tryLocalPatch,
    });
    return {
      patchExecutionPlan,
      patchAttemptEffectsPlan,
      reason: patchExecutionPlan.reason,
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
      localPatchAttempted,
      tilePanePatchAttempted,
      patchResult,
      patchTimingSource,
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

  function hasOwnPropertyValue(object, key) {
    return Object.prototype.hasOwnProperty.call(objectOrEmpty(object), key);
  }

  function planThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffects(input = {}) {
    const stage = objectOrEmpty(input.patchAttemptResultStage || input.stage);
    if (!stage.needsPatchRejectedVisibleShapes) {
      return {
        effects: [],
        reason: compactReason(stage.reason, "visible-shapes-not-required"),
      };
    }
    return {
      effects: [
        {
          type: "collect-patch-rejected-visible-shapes",
        },
      ],
      reason: "visible-shapes-required",
    };
  }

  function planThreadDetailRefreshPatchAttemptResultStage(input = {}) {
    const patchAttempt = objectOrEmpty(input.patchAttempt);
    const patchAttemptResult = planThreadDetailRefreshPatchAttemptResult({
      shouldRenderDetail: input.shouldRenderDetail,
      tilePanePatchAttempted: patchAttempt.tilePanePatchAttempted,
      tilePanePatchedDetail: patchAttempt.tilePanePatchedDetail,
      localPatchAttempted: patchAttempt.localPatchAttempted,
      locallyPatchedDetail: patchAttempt.locallyPatchedDetail,
      tilePanePatchMs: patchAttempt.tilePanePatchMs,
      localPatchMs: patchAttempt.localPatchMs,
      patchRejectReason: patchAttempt.patchRejectReason,
    });
    const needsPatchRejectedVisibleShapes = Boolean(patchAttemptResult.reportLocalPatchRejected
      && (!hasOwnPropertyValue(input, "previousVisibleShape")
        || !hasOwnPropertyValue(input, "nextVisibleShape")));
    if (needsPatchRejectedVisibleShapes) {
      return {
        patchAttemptResult,
        needsPatchRejectedVisibleShapes: true,
        patchRejectedDiagnosticPlan: null,
        patchRejectedDiagnosticEffectsPlan: {
          effects: [],
          reason: "visible-shapes-required",
        },
        reason: "visible-shapes-required",
      };
    }
    const patchRejectedDiagnosticPlan = planThreadDetailRefreshPatchRejectedDiagnostic({
      readMode: input.readMode,
      renderPlan: input.renderPlan,
      patchAttemptResult,
      previousVisibleShape: input.previousVisibleShape,
      nextVisibleShape: input.nextVisibleShape,
    });
    const patchRejectedDiagnosticEffectsPlan = planThreadDetailRefreshPatchRejectedDiagnosticEffects({
      diagnosticPlan: patchRejectedDiagnosticPlan,
    });
    return {
      patchAttemptResult,
      needsPatchRejectedVisibleShapes: false,
      patchRejectedDiagnosticPlan,
      patchRejectedDiagnosticEffectsPlan,
      reason: patchRejectedDiagnosticPlan.reason,
    };
  }

  function planThreadDetailRefreshPatchAttemptResultEvidenceStage(input = {}) {
    const patchAttemptResultStage = planThreadDetailRefreshPatchAttemptResultStage(input);
    const visibleShapeEvidenceEffectsPlan = planThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffects({
      patchAttemptResultStage,
    });
    return {
      patchAttemptResultStage,
      visibleShapeEvidenceEffectsPlan,
      needsPatchRejectedVisibleShapes: patchAttemptResultStage.needsPatchRejectedVisibleShapes,
      reason: patchAttemptResultStage.reason,
    };
  }

  function planThreadDetailRefreshPatchAttemptResultEvidenceCompletionStage(input = {}) {
    const visibleShapeEvidence = objectOrEmpty(input.visibleShapeEvidence);
    return planThreadDetailRefreshPatchAttemptResultStage({
      shouldRenderDetail: input.shouldRenderDetail,
      patchAttempt: input.patchAttempt,
      renderPlan: input.renderPlan,
      readMode: input.readMode,
      previousVisibleShape: visibleShapeEvidence.previousVisibleShape,
      nextVisibleShape: visibleShapeEvidence.nextVisibleShape,
    });
  }

  function planThreadDetailRefreshPatchAttemptResultEvidenceResolutionStage(input = {}) {
    const patchAttemptResultStage = objectOrEmpty(input.patchAttemptResultStage);
    const visibleShapeEvidence = objectOrEmpty(input.visibleShapeEvidence);
    if (!visibleShapeEvidence.collected) {
      return {
        patchAttemptResultStage,
        resolvedFromEvidence: false,
        reason: compactReason(patchAttemptResultStage.reason, "visible-shapes-not-collected"),
      };
    }
    const completedStage = planThreadDetailRefreshPatchAttemptResultEvidenceCompletionStage({
      shouldRenderDetail: input.shouldRenderDetail,
      patchAttempt: input.patchAttempt,
      renderPlan: input.renderPlan,
      readMode: input.readMode,
      visibleShapeEvidence,
    });
    return {
      patchAttemptResultStage: completedStage,
      resolvedFromEvidence: true,
      reason: completedStage.reason,
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

  function planThreadDetailRefreshOutcomeExecutionStage(input = {}) {
    const renderPlan = objectOrEmpty(input.renderPlan);
    const patchAttemptResult = objectOrEmpty(input.patchAttemptResult);
    const renderOutcome = finalizeThreadDetailRenderPlan(renderPlan, patchAttemptResult.finalizeResult);
    const executionPlan = planThreadDetailRefreshOutcomeExecution(renderOutcome);
    const executionEffectsPlan = planThreadDetailRefreshExecutionEffects(executionPlan);
    const consistencyCheckEffectsPlan = planThreadDetailRefreshConsistencyCheckEffects(
      executionPlan.consistencyCheck || {},
    );
    return {
      renderOutcome,
      executionPlan,
      executionEffectsPlan,
      consistencyCheckEffectsPlan,
      reason: executionPlan.reason,
    };
  }

  function planThreadDetailRefreshPerformanceInput(input = {}) {
    const renderPlan = objectOrEmpty(input.renderPlan);
    const renderOutcome = objectOrEmpty(input.renderOutcome);
    const patchAttemptResult = objectOrEmpty(input.patchAttemptResult);
    const patchSurfacePlan = objectOrEmpty(input.patchSurfacePlan);
    const patchExecutionPlan = objectOrEmpty(input.patchExecutionPlan);
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
      patchResult: compactReason(patchAttemptResult.patchResult, ""),
      patchTimingSource: compactReason(patchAttemptResult.patchTimingSource, ""),
      patchSurfaceReason: compactReason(patchSurfacePlan.reason, ""),
      patchSurface: compactReason(patchSurfacePlan.tilePatchSurface || patchSurfacePlan.surface, ""),
      patchExecutionReason: compactReason(patchExecutionPlan.reason, ""),
      skippedDetailRender: input.shouldRenderDetail === false,
      locallyPatchedDetail: Boolean(renderOutcome.locallyPatchedDetail),
      tilePanePatchedDetail: Boolean(renderOutcome.tilePanePatchedDetail),
      localPatchAttempted: Boolean(patchAttemptResult.localPatchAttempted),
      tilePanePatchAttempted: Boolean(patchAttemptResult.tilePanePatchAttempted),
    };
  }

  function planThreadDetailRefreshReportingStage(input = {}) {
    const eventName = compactReason(input.eventName, "thread_refresh_ms");
    const threadId = compactReason(input.threadId, "");
    const performanceInput = planThreadDetailRefreshPerformanceInput(input);
    const telemetryConfig = {
      eventName,
      throttleKey: compactReason(input.throttleKey, eventName),
      minIntervalMs: normalizedDurationMs(input.minIntervalMs),
      action: compactReason(input.action, "thread-detail-refresh"),
      threadId,
    };
    const completionConfig = {
      threadHash: compactReason(input.threadHash, ""),
    };
    return {
      performanceInput,
      telemetryConfig,
      completionConfig,
      reason: "refresh-reporting",
    };
  }

  function addOptionalTimingField(out, key, value) {
    const timing = normalizedOptionalDurationMs(value);
    if (timing !== null) out[key] = timing;
  }

  function planThreadDetailFirstPaintPerformanceInput(input = {}) {
    const timings = objectOrEmpty(input.timings);
    const cached = input.cached === true;
    const out = {
      source: compactReason(input.source, "").slice(0, 40),
      threadId: compactReason(input.threadId, ""),
      elapsedMs: normalizedDurationMs(timings.elapsedMs),
      apiElapsedMs: normalizedDurationMs(timings.apiElapsedMs),
      renderElapsedMs: normalizedDurationMs(timings.renderElapsedMs),
      detailRenderMode: compactReason(input.detailRenderMode, cached ? "cached-current" : "first-paint"),
      cached,
    };
    addOptionalTimingField(out, "mergeMs", timings.mergeMs);
    addOptionalTimingField(out, "draftRestoreMs", timings.draftRestoreMs);
    addOptionalTimingField(out, "composerRenderMs", timings.composerRenderMs);
    addOptionalTimingField(out, "threadListRenderMs", timings.threadListRenderMs);
    addOptionalTimingField(out, "conversationRenderMs", timings.conversationRenderMs);
    addOptionalTimingField(out, "postRenderMs", timings.postRenderMs);
    return out;
  }

  function planThreadDetailFirstPaintReportingStage(input = {}) {
    const cached = input.cached === true;
    const performanceInput = planThreadDetailFirstPaintPerformanceInput({
      source: input.source,
      threadId: input.threadId,
      detailRenderMode: input.detailRenderMode || (cached ? "cached-current" : "first-paint"),
      cached,
      timings: objectOrEmpty(input.timings),
    });
    return {
      performanceInput,
      telemetryInput: {
        source: performanceInput.source,
        threadId: performanceInput.threadId,
        elapsedMs: performanceInput.elapsedMs,
        apiElapsedMs: performanceInput.apiElapsedMs,
        renderElapsedMs: performanceInput.renderElapsedMs,
        readMode: compactReason(input.readMode, ""),
        status: compactReason(input.status, ""),
        turns: normalizedCount(input.turns),
        omittedTurns: normalizedCount(input.omittedTurns),
        rolloutSizeBytes: normalizedCount(input.rolloutSizeBytes),
        threadHash: compactReason(input.threadHash, ""),
      },
      reason: cached ? "cached-current-reporting" : "first-paint-reporting",
    };
  }

  function planThreadDetailFullBackfillPerformanceInput(input = {}) {
    const timings = objectOrEmpty(input.timings);
    return {
      source: compactReason(input.source, "").slice(0, 40),
      threadId: compactReason(input.threadId, ""),
      elapsedMs: normalizedDurationMs(timings.elapsedMs),
      apiElapsedMs: normalizedDurationMs(timings.apiElapsedMs),
      renderElapsedMs: normalizedDurationMs(timings.renderElapsedMs),
      mergeMs: normalizedDurationMs(timings.mergeMs),
      composerRenderMs: normalizedDurationMs(timings.composerRenderMs),
      threadListRenderMs: normalizedDurationMs(timings.threadListRenderMs),
      conversationRenderMs: normalizedDurationMs(timings.conversationRenderMs),
      postRenderMs: normalizedDurationMs(timings.postRenderMs),
      detailRenderMode: "full-backfill",
    };
  }

  function planThreadDetailFullBackfillReportingStage(input = {}) {
    const performanceInput = planThreadDetailFullBackfillPerformanceInput({
      source: input.source,
      threadId: input.threadId,
      timings: objectOrEmpty(input.timings),
    });
    return {
      performanceInput,
      telemetryInput: {
        threadId: performanceInput.threadId,
      },
      reason: "full-backfill-reporting",
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

  function planThreadDetailRefreshReportingEffectsStage(input = {}) {
    const telemetryConfig = objectOrEmpty(input.telemetryConfig);
    const completionConfig = objectOrEmpty(input.completionConfig);
    const telemetryEffectsPlan = planThreadDetailRefreshTelemetryEffects({
      performanceEvent: input.performanceEvent,
      eventName: telemetryConfig.eventName,
      throttleKey: telemetryConfig.throttleKey,
      minIntervalMs: telemetryConfig.minIntervalMs,
      action: telemetryConfig.action,
      threadId: telemetryConfig.threadId,
    });
    const completionEffectsPlan = planThreadDetailRefreshCompletionEffects(completionConfig);
    return {
      telemetryEffectsPlan,
      completionEffectsPlan,
      reason: "refresh-reporting-effects",
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

  function planThreadDetailFirstPaintPostRenderEffects(input = {}) {
    const seq = Number(input.seq);
    return {
      effects: [
        { type: "publish-plugin-navigation-state", force: true },
        { type: "restore-connection-state" },
        { type: "schedule-live-poll", delayMs: 1200 },
        { type: "update-composer-controls" },
        { type: "close-sidebar-menu-if-overlay" },
        {
          type: "backfill-full-thread-detail-if-needed",
          threadId: compactReason(input.threadId, ""),
          seq: Number.isFinite(seq) ? seq : 0,
          source: compactReason(input.source, "").slice(0, 40),
        },
        { type: "schedule-usage-backfill-refresh" },
      ],
      reason: "first-paint-post-render",
    };
  }

  function planThreadDetailFirstPaintAfterRenderEffects(input = {}) {
    const seq = Number(input.seq);
    return {
      effects: [
        {
          type: "history-auto-backfill",
          seq: Number.isFinite(seq) ? seq : 0,
          source: compactReason(input.source, "first-paint").slice(0, 40),
        },
      ],
      reason: "first-paint-after-render",
    };
  }

  function planThreadDetailFirstPaintPostTimingEffects() {
    return {
      effects: [
        {
          type: "check-conversation-projection-consistency",
          phase: "first-paint",
          renderMode: "first-paint",
        },
      ],
      reason: "first-paint-post-timing",
    };
  }

  function planThreadDetailFirstPaintPreRenderEffects(input = {}) {
    const threadId = compactReason(input.threadId, "");
    const effects = [
      { type: "persist-current-thread-id", threadId },
      { type: "clear-draft-target-key" },
      { type: "follow-thread-open-to-bottom", threadId },
    ];
    if (input.hasEvents) effects.push({ type: "connect-events" });
    return {
      effects,
      reason: "first-paint-pre-render",
    };
  }

  function planThreadDetailFirstPaintDraftRestoreEffects() {
    return {
      effects: [
        { type: "restore-draft-for-current-target" },
      ],
      reason: "first-paint-draft-restore",
    };
  }

  function planThreadDetailLoadErrorEffects(input = {}) {
    return {
      effects: [
        {
          type: "set-current-thread-load-error",
          threadId: compactReason(input.threadId, ""),
          errorMessage: String(input.errorMessage || input.error || ""),
        },
        { type: "sync-active-turn-from-thread" },
        { type: "render-thread-list" },
        { type: "render-current-thread" },
        { type: "update-composer-controls" },
      ],
      reason: "thread-detail-load-error",
    };
  }

  function planThreadDetailLoadingShellPostStateEffects(input = {}) {
    const threadId = compactReason(input.threadId, "");
    const source = compactReason(input.source, "").slice(0, 40);
    return {
      effects: [
        { type: "follow-thread-open-to-bottom", threadId },
        { type: "restore-draft-for-current-target" },
        { type: "render-composer-settings" },
        { type: "sync-active-turn-from-thread" },
        { type: "render-thread-list" },
        { type: "render-current-thread", options: { stickToBottom: true } },
        { type: "publish-plugin-navigation-state", force: true },
        { type: "update-composer-controls" },
        { type: "load-side-chat", threadId, silent: true },
        { type: "set-connection-state", removeClass: "error", text: "Loading thread" },
        { type: "mark-activity", label: "加载线程" },
        { type: "start-thread-load-watchdog", threadId, source },
      ],
      reason: "loading-shell-post-state",
    };
  }

  function planThreadDetailCachedCurrentPostRenderEffects(input = {}) {
    const seq = Number(input.seq);
    const threadId = compactReason(input.threadId, "");
    const source = compactReason(input.source, "cached-current").slice(0, 40);
    const effects = [
      {
        type: "history-auto-backfill",
        seq: Number.isFinite(seq) ? seq : 0,
        source,
      },
    ];
    if (input.replacedTilePane) effects.push({ type: "restore-composer-for-replaced-tile-pane" });
    effects.push(
      { type: "close-sidebar-menu-if-overlay" },
      {
        type: "check-conversation-projection-consistency",
        phase: "cached-current",
        renderMode: "cached-current",
      },
      {
        type: "record-empty-cached-detail-reuse-healthy",
        reason: "cached-current",
      },
    );
    if (!input.hasSideChat) {
      effects.push({
        type: "load-side-chat",
        threadId,
        silent: true,
      });
    }
    return {
      effects,
      reason: "cached-current-post-render",
    };
  }

  function planThreadDetailFullBackfillPostRenderEffects() {
    return {
      effects: [
        { type: "schedule-usage-backfill-refresh" },
        { type: "schedule-live-poll" },
        { type: "update-composer-controls" },
      ],
      reason: "full-backfill-post-render",
    };
  }

  function planThreadDetailFirstPaintTelemetryEffects(input = {}) {
    const source = compactReason(input.source, "").slice(0, 40);
    const threadId = compactReason(input.threadId, "");
    const threadHash = compactReason(input.threadHash, "");
    const performanceEvent = objectOrEmpty(input.performanceEvent);
    return {
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
            threadId,
          },
        },
        {
          type: "post-client-event",
          eventName: "thread_switch_complete",
          payload: {
            source,
            threadId,
            elapsedMs: normalizedDurationMs(input.elapsedMs),
            apiElapsedMs: normalizedDurationMs(input.apiElapsedMs),
            renderElapsedMs: normalizedDurationMs(input.renderElapsedMs),
            readMode: compactReason(input.readMode, ""),
            status: compactReason(input.status, ""),
            turns: normalizedCount(input.turns),
            omittedTurns: normalizedCount(input.omittedTurns),
            rolloutSizeBytes: normalizedCount(input.rolloutSizeBytes),
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
              thread_hash: threadHash,
            },
          },
        },
      ],
      reason: "first-paint-telemetry",
    };
  }

  function planThreadDetailFullBackfillTelemetryEffects(input = {}) {
    const threadId = compactReason(input.threadId, "");
    const performanceEvent = objectOrEmpty(input.performanceEvent);
    return {
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
            threadId,
          },
        },
      ],
      reason: "full-backfill-telemetry",
    };
  }

  function planThreadDetailCachedCurrentTelemetryEffects(input = {}) {
    const source = compactReason(input.source, "").slice(0, 40);
    const threadId = compactReason(input.threadId, "");
    const threadHash = compactReason(input.threadHash, "");
    const performanceEvent = objectOrEmpty(input.performanceEvent);
    return {
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
            source,
            threadId,
            elapsedMs: normalizedDurationMs(input.elapsedMs),
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
              thread_hash: threadHash,
            },
          },
        },
      ],
      reason: "cached-current-telemetry",
    };
  }

  function planThreadDetailSwitchCancelledClientEvent(input = {}) {
    return {
      effects: [{
        type: "post-client-event",
        eventName: "thread_switch_cancelled",
        payload: {
          source: compactReason(input.source, "").slice(0, 40),
          threadId: compactReason(input.threadId, ""),
          elapsedMs: normalizedDurationMs(input.elapsedMs),
          apiElapsedMs: normalizedDurationMs(input.apiElapsedMs),
        },
      }],
      reason: "thread-switch-cancelled",
    };
  }

  function planThreadDetailSwitchStartClientEvent(input = {}) {
    return {
      effects: [{
        type: "post-client-event",
        eventName: "thread_switch_start",
        payload: {
          source: compactReason(input.source, "").slice(0, 40),
          fromThreadId: compactReason(input.fromThreadId, ""),
          toThreadId: compactReason(input.toThreadId, ""),
          listAgeMs: normalizedOptionalDurationMs(input.listAgeMs),
          currentHadThread: Boolean(input.currentHadThread),
          eventOpen: Boolean(input.eventOpen),
        },
      }],
      reason: "thread-switch-start",
    };
  }

  function planThreadDetailSwitchErrorClientEvent(input = {}) {
    return {
      effects: [{
        type: "post-client-event",
        eventName: "thread_switch_error",
        payload: {
          source: compactReason(input.source, "").slice(0, 40),
          threadId: compactReason(input.threadId, ""),
          elapsedMs: normalizedDurationMs(input.elapsedMs),
          apiElapsedMs: normalizedDurationMs(input.apiElapsedMs),
          error: compactReason(input.error, "", 200),
        },
      }],
      reason: "thread-switch-error",
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
      const loadingKey = `loading-visible|${escape(threadId)}`;
      return {
        mode: "loading",
        html: `<div class="history-note entry-animate thread-loading-note" data-render-key="${loadingKey}">正在加载最新线程状态...</div>`,
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
        expectedVisibleItemCount: normalizedCount(input.expectedVisibleItemCount),
        renderedDomTurnCount: normalizedCount(input.renderedDomTurnCount),
        renderedDomItemCount: normalizedCount(input.renderedDomItemCount),
        duplicateRenderKeyCount: normalizedCount(input.duplicateRenderKeyCount),
        expectedTurnIds: normalizedStringList(input.expectedTurnIds),
        renderedDomTurnIds: normalizedStringList(input.renderedDomTurnIds),
        checkProjectionConsistency: input.checkProjectionConsistency === true,
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
    planThreadDetailCachedCurrentTelemetryEffects,
    planThreadDetailCachedCurrentPostRenderEffects,
    planThreadDetailFirstPaintAfterRenderEffects,
    planThreadDetailFirstPaintDraftRestoreEffects,
    planThreadDetailFirstPaintPerformanceInput,
    planThreadDetailFirstPaintReportingStage,
    planThreadDetailFirstPaintPostTimingEffects,
    planThreadDetailFirstPaintPreRenderEffects,
    planThreadDetailFirstPaintResponseEffects,
    planThreadDetailFullBackfillResponseEffects,
    planThreadDetailFullBackfillPerformanceInput,
    planThreadDetailFullBackfillReportingStage,
    planThreadDetailLoadErrorEffects,
    planThreadDetailLoadingShellPostStateEffects,
    planThreadDetailFullBackfillPostRenderEffects,
    planThreadDetailFullBackfillTelemetryEffects,
    planThreadDetailFirstPaintPostRenderEffects,
    planThreadDetailFirstPaintTelemetryEffects,
    planThreadDetailSwitchCancelledClientEvent,
    planThreadDetailSwitchStartClientEvent,
    planThreadDetailSwitchErrorClientEvent,
    planThreadDetailRefreshCompletionEffects,
    planThreadDetailRefreshConsistencyCheck,
    planThreadDetailRefreshConsistencyCheckEffects,
    planThreadDetailRefreshResponseEffects,
    planThreadDetailRefreshPatchAttemptEffects,
    planThreadDetailRefreshPatchAttemptResult,
    planThreadDetailRefreshPatchAttemptResultStage,
    planThreadDetailRefreshPatchAttemptResultEvidenceStage,
    planThreadDetailRefreshPatchAttemptResultEvidenceCompletionStage,
    planThreadDetailRefreshPatchAttemptResultEvidenceResolutionStage,
    planThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffects,
    planThreadDetailRefreshPatchRejectedDiagnostic,
    planThreadDetailRefreshPatchRejectedDiagnosticEffects,
    planThreadDetailRefreshOutcomeExecution,
    planThreadDetailRefreshOutcomeExecutionStage,
    planThreadDetailRefreshExecutionEffects,
    planThreadDetailRefreshPerformanceInput,
    planThreadDetailRefreshReportingStage,
    planThreadDetailRefreshReportingEffectsStage,
    planThreadDetailRefreshTelemetryEffects,
    planThreadDetailRefreshFailureDiagnosticEffects,
    planThreadDetailRefreshRequest,
    planThreadDetailRefreshPatchSurface,
    planThreadDetailRefreshPatchSurfaceProbeEffects,
    planThreadDetailRefreshPatchSurfaceProbeStage,
    planThreadDetailRefreshPatchSurfaceExecutionStage,
    planThreadDetailRefreshPatchSurfaceResultStage,
    planThreadDetailRefreshPostMergeEffects,
    planThreadDetailRefreshPostMergeTimingFields,
    planThreadDetailFirstPaintPostMergeTimingEffects,
    planThreadDetailRefreshPatchExecutionStage,
    planSingleThreadEarlyShellExecution,
    planSingleThreadFullRenderShell,
    planSingleThreadShellConversationUpdate,
    planSingleThreadShellPostUpdateEffects,
    planThreadDetailHistoryAutoBackfill,
    planThreadDetailHistoryAutoBackfillEffects,
    planThreadDetailRefreshPatchExecution,
    planThreadDetailRefreshRenderInput,
    planThreadDetailRefreshRender,
    planThreadDetailRefreshRenderStage,
    reduceThreadDetailRefreshPatchAttempt,
    threadDetailRefreshPatchAttemptEffectContext,
  };
}));
