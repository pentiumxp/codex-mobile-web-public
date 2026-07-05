const DEFAULT_WINDOW_MS = 5000;
  const DEFAULT_SUBMISSION_PROBE_MIN_MS = 250;
  const MAX_COUNT = 100000;

  function compactToken(value, fallback = "", maxLength = 80) {
    const raw = String(value || "").trim();
    const safe = raw
      .replace(/[^a-zA-Z0-9_.:-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, maxLength);
    return safe || fallback;
  }

  function boundedCount(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.min(MAX_COUNT, Math.trunc(number));
  }

  function boolCount(value) {
    return value ? 1 : 0;
  }

  function boundedConfidence(value, fallback = 0.74) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(1, number));
  }

  function baseContext(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const context = {
      surface: compactToken(source.surface, "frontend-runtime", 80),
      action: compactToken(source.action, "render", 80),
    };
    const routeKind = compactToken(source.routeKind || source.route_kind, "", 80);
    const readMode = compactToken(source.readMode || source.read_mode, "", 80);
    const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
    const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
    const itemHash = compactToken(source.itemHash || source.item_hash, "", 80);
    const renderPlanReason = compactToken(source.renderPlanReason || source.render_plan_reason, "", 80);
    const patchRejectReason = compactToken(source.patchRejectReason || source.patch_reject_reason, "", 80);
    if (routeKind) context.route_kind = routeKind;
    if (readMode) context.read_mode = readMode;
    if (renderMode) context.render_mode = renderMode;
    if (threadHash) context.thread_hash = threadHash;
    if (itemHash) context.item_hash = itemHash;
    if (renderPlanReason) context.render_plan_reason = renderPlanReason;
    if (patchRejectReason) context.patch_reject_reason = patchRejectReason;
    return context;
  }

  function runtimeEvent(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    return {
      category: "frontend_runtime_mismatch",
      diagnostic_type: compactToken(source.diagnosticType || source.diagnostic_type, "frontend_runtime_mismatch", 80),
      severity_hint: compactToken(source.severityHint || source.severity_hint, "H2", 8),
      evidence_confidence: boundedConfidence(source.evidenceConfidence || source.evidence_confidence, 0.74),
      error_code: compactToken(source.errorCode || source.error_code, "frontend_runtime_mismatch", 100),
      context: baseContext(source.context || source),
      counts: source.counts && typeof source.counts === "object" ? source.counts : {},
      breadcrumbs: Array.isArray(source.breadcrumbs) ? source.breadcrumbs.slice(0, 6) : [],
    };
  }

  function runtimeSuccess(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    return {
      category: "frontend_runtime_mismatch",
      diagnostic_type: compactToken(source.diagnosticType || source.diagnostic_type, "frontend_runtime_mismatch", 80),
      error_code: compactToken(source.errorCode || source.error_code || source.diagnosticType || source.diagnostic_type, "frontend_runtime_mismatch", 100),
      context: baseContext(source.context || source),
    };
  }

  function submittedMessageDomMissingEvent(input = {}) {
    const elapsedMs = boundedCount(input.elapsedMs || input.elapsed_ms);
    const domCount = boundedCount(input.domCount || input.dom_count);
    const visibleCount = boundedCount(input.visibleCount || input.visible_count);
    const context = baseContext(Object.assign({}, input, {
      surface: "user-operation",
      action: input.action || "message-submit",
    }));
    return runtimeEvent({
      diagnosticType: "submitted_message_dom_missing",
      severityHint: "H2",
      evidenceConfidence: 0.82,
      errorCode: "submitted_message_dom_missing",
      context,
      counts: {
        elapsed_ms: elapsedMs,
        dom_count: domCount,
        visible_count: visibleCount,
        current_thread_match: boolCount(input.currentThreadMatch),
        has_thread_submission: boolCount(input.hasThreadSubmission),
        dom_has_submission: boolCount(input.domHasSubmission),
        composer_busy: boolCount(input.composerBusy),
      },
      breadcrumbs: [{
        kind: "user-operation",
        code: "submitted-message-dom-probe",
        status: "failed",
        fields: {
          elapsed_ms: elapsedMs,
          dom_count: domCount,
          visible_count: visibleCount,
          thread_hash: context.thread_hash || "",
          item_hash: context.item_hash || "",
        },
      }],
    });
  }

  function submittedMessageDomSuccess(input = {}) {
    return runtimeSuccess(Object.assign({}, input, {
      diagnosticType: "submitted_message_dom_missing",
      errorCode: "submitted_message_dom_missing",
      surface: "user-operation",
      action: input.action || "message-submit",
    }));
  }

  function submittedMessageDomProbeEffects(input = {}) {
    const elapsedMs = boundedCount(input.elapsedMs || input.elapsed_ms);
    const minElapsedMs = boundedCount(input.minElapsedMs || input.min_elapsed_ms || DEFAULT_SUBMISSION_PROBE_MIN_MS);
    if (elapsedMs < minElapsedMs) return { effects: [], reason: "too-early" };
    if (!input.currentThreadMatch) return { effects: [], reason: "different-thread" };
    if (!input.hasThreadSubmission) return { effects: [], reason: "no-thread-submission" };
    const missing = !input.domHasSubmission;
    return {
      effects: [{
        type: missing ? "diagnostic-failure" : "diagnostic-success",
        diagnostic: missing ? submittedMessageDomMissingEvent(input) : submittedMessageDomSuccess(input),
        diagnosticType: "submitted_message_dom_missing",
        reason: missing ? "submitted-message-dom-missing" : "submitted-message-dom-present",
      }],
      reason: missing ? "submitted-message-dom-missing" : "submitted-message-dom-present",
    };
  }

  function renderChurnEvent(input = {}) {
    const context = baseContext(Object.assign({}, input, {
      surface: "conversation-render",
      action: input.action || "render",
    }));
    const fullRenderCount = boundedCount(input.fullRenderCount || input.full_render_count);
    const fallbackCount = boundedCount(input.fallbackCount || input.fallback_count);
    const renderCount = boundedCount(input.renderCount || input.render_count);
    const domCount = boundedCount(input.domCount || input.dom_count);
    const visibleCount = boundedCount(input.visibleCount || input.visible_count);
    const previousCount = boundedCount(input.previousCount || input.previous_count);
    return runtimeEvent({
      diagnosticType: "render_churn",
      severityHint: "H3",
      evidenceConfidence: 0.72,
      errorCode: fallbackCount ? "render_patch_fallback_churn" : "render_full_render_churn",
      context,
      counts: {
        render_count: renderCount,
        full_render_count: fullRenderCount,
        fallback_count: fallbackCount,
        previous_count: previousCount,
        dom_count: domCount,
        visible_count: visibleCount,
        render_elapsed_ms: boundedCount(input.renderElapsedMs || input.render_elapsed_ms),
        duplicate_count: boundedCount(input.duplicateCount || input.duplicate_count),
      },
      breadcrumbs: [{
        kind: "conversation-render",
        code: fallbackCount ? "patch-fallback-churn" : "full-render-churn",
        status: "unstable",
        fields: {
          render_mode: context.render_mode || "",
          render_plan_reason: context.render_plan_reason || "",
          patch_reject_reason: context.patch_reject_reason || "",
          previous_count: previousCount,
          dom_count: domCount,
          visible_count: visibleCount,
        },
      }],
    });
  }

  function domDropEvent(input = {}) {
    const context = baseContext(Object.assign({}, input, {
      surface: "conversation-render",
      action: input.action || "render",
    }));
    return runtimeEvent({
      diagnosticType: "render_dom_drop",
      severityHint: "H2",
      evidenceConfidence: 0.8,
      errorCode: "render_dom_drop",
      context,
      counts: {
        previous_count: boundedCount(input.previousCount || input.previous_count),
        dom_count: boundedCount(input.domCount || input.dom_count),
        visible_count: boundedCount(input.visibleCount || input.visible_count),
        duplicate_count: boundedCount(input.duplicateCount || input.duplicate_count),
        render_elapsed_ms: boundedCount(input.renderElapsedMs || input.render_elapsed_ms),
      },
      breadcrumbs: [{
        kind: "conversation-render",
        code: "dom-drop",
        status: "failed",
        fields: {
          previous_count: boundedCount(input.previousCount || input.previous_count),
          dom_count: boundedCount(input.domCount || input.dom_count),
          visible_count: boundedCount(input.visibleCount || input.visible_count),
          render_mode: context.render_mode || "",
        },
      }],
    });
  }

  function renderSuccess(input = {}, diagnosticType = "render_churn") {
    return runtimeSuccess(Object.assign({}, input, {
      diagnosticType,
      errorCode: diagnosticType,
      surface: "conversation-render",
      action: input.action || "render",
    }));
  }

  function threadListInteractionStallEvent(input = {}) {
    const maxRafDelayMs = boundedCount(input.maxRafDelayMs || input.max_raf_delay_ms);
    const maxScrollApplyMs = boundedCount(input.maxScrollApplyMs || input.max_scroll_apply_ms);
    const maxLongTaskMs = boundedCount(input.maxLongTaskMs || input.max_long_task_ms);
    const elapsedMs = boundedCount(input.elapsedMs || input.elapsed_ms);
    const maxDelayMs = Math.max(maxRafDelayMs, maxScrollApplyMs, maxLongTaskMs, elapsedMs);
    const context = baseContext(Object.assign({}, input, {
      surface: "thread-list-runtime",
      action: input.action || "thread-list-interaction",
    }));
    const errorCode = maxLongTaskMs >= Math.max(maxRafDelayMs, maxScrollApplyMs)
      ? "browser_main_thread_long_task"
      : "browser_thread_list_interaction_blocked";
    return runtimeEvent({
      diagnosticType: "thread_list_interaction_stall",
      severityHint: maxDelayMs >= boundedCount(input.h2ThresholdMs || input.h2_threshold_ms || 3000) ? "H2" : "H3",
      evidenceConfidence: maxDelayMs >= 3000 ? 0.86 : 0.74,
      errorCode,
      context,
      counts: {
        elapsed_ms: elapsedMs,
        raf_delay_ms: maxRafDelayMs,
        scroll_apply_ms: maxScrollApplyMs,
        long_task_ms: maxLongTaskMs,
        long_task_count: boundedCount(input.longTaskCount || input.long_task_count),
        thread_list_count: boundedCount(input.threadListCount || input.thread_list_count),
        thread_list_visible: boolCount(input.threadListVisible || input.thread_list_visible),
        thread_list_monitorable: boolCount(input.threadListMonitorable || input.thread_list_monitorable),
        scroll_top: boundedCount(input.scrollTop || input.scroll_top),
        scroll_height: boundedCount(input.scrollHeight || input.scroll_height),
      },
      breadcrumbs: [{
        kind: "thread-list-runtime",
        code: errorCode,
        status: "blocked",
        fields: {
          elapsed_ms: elapsedMs,
          raf_delay_ms: maxRafDelayMs,
          scroll_apply_ms: maxScrollApplyMs,
          long_task_ms: maxLongTaskMs,
          long_task_count: boundedCount(input.longTaskCount || input.long_task_count),
          thread_list_count: boundedCount(input.threadListCount || input.thread_list_count),
        },
      }],
    });
  }

  function threadListInteractionStallEffects(input = {}) {
    const minDelayMs = boundedCount(input.minDelayMs || input.min_delay_ms || 1000) || 1000;
    const maxDelayMs = Math.max(
      boundedCount(input.maxRafDelayMs || input.max_raf_delay_ms),
      boundedCount(input.maxScrollApplyMs || input.max_scroll_apply_ms),
      boundedCount(input.maxLongTaskMs || input.max_long_task_ms),
      boundedCount(input.elapsedMs || input.elapsed_ms),
    );
    if (!input.threadListVisible && !input.threadListMonitorable) return { effects: [], reason: "thread-list-not-visible" };
    if (maxDelayMs < minDelayMs) return { effects: [], reason: "below-threshold" };
    return {
      effects: [{
        type: "diagnostic-failure",
        diagnostic: threadListInteractionStallEvent(input),
        diagnosticType: "thread_list_interaction_stall",
        reason: "thread-list-interaction-stall",
      }],
      reason: "thread-list-interaction-stall",
    };
  }

  function createMonitor(options = {}) {
    const now = typeof options.now === "function" ? options.now : () => Date.now();
    const windowMs = boundedCount(options.windowMs || DEFAULT_WINDOW_MS) || DEFAULT_WINDOW_MS;
    const fullRenderThreshold = boundedCount(options.fullRenderThreshold || 3) || 3;
    const fallbackThreshold = boundedCount(options.fallbackThreshold || 2) || 2;
    let samples = [];

    function trim(currentTime) {
      samples = samples.filter((entry) => currentTime - entry.at <= windowMs);
      return samples;
    }

    function recordRender(input = {}) {
      const currentTime = now();
      const source = input && typeof input === "object" ? input : {};
      const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
      const finalAction = compactToken(source.finalAction || source.final_action || renderMode, "", 80);
      const sample = {
        at: currentTime,
        fullRender: Boolean(source.fullRender || finalAction === "set-inner-html" || finalAction === "full-render"),
        fallbackApplied: Boolean(source.fallbackApplied || source.fallback_applied),
      };
      samples.push(sample);
      trim(currentTime);
      const renderCount = samples.length;
      const fullRenderCount = samples.filter((entry) => entry.fullRender).length;
      const fallbackCount = samples.filter((entry) => entry.fallbackApplied).length;
      const previousCount = boundedCount(source.previousCount || source.previous_count);
      const domCount = boundedCount(source.domCount || source.dom_count);
      const visibleCount = boundedCount(source.visibleCount || source.visible_count);
      const duplicateCount = boundedCount(source.duplicateCount || source.duplicate_count);
      const effects = [];
      const sameThreadRender = source.sameThreadRender === true || source.same_thread_render === true;

      const priorNonEmptyDomDropped = previousCount >= 2 && domCount <= 1 && domCount < previousCount;
      const expectedNonEmptyDomDropped = visibleCount >= 2 && priorNonEmptyDomDropped;
      const shellOrUnknownVisibleDrop = sameThreadRender && visibleCount <= 1 && priorNonEmptyDomDropped && /(?:early-shell|loading|shell)/i.test([
        source.action,
        source.renderMode || source.render_mode,
        source.renderPlanReason || source.render_plan_reason,
      ].filter(Boolean).join("|"));
      if (expectedNonEmptyDomDropped || shellOrUnknownVisibleDrop) {
        effects.push({
          type: "diagnostic-failure",
          diagnostic: domDropEvent(Object.assign({}, source, { renderCount, fullRenderCount, fallbackCount })),
          diagnosticType: "render_dom_drop",
          reason: "render-dom-drop",
        });
      } else if (domCount >= Math.min(visibleCount || domCount, 2)) {
        effects.push({
          type: "diagnostic-success",
          diagnostic: renderSuccess(source, "render_dom_drop"),
          diagnosticType: "render_dom_drop",
          reason: "render-dom-stable",
        });
      }

      const churn = fullRenderCount >= fullRenderThreshold || fallbackCount >= fallbackThreshold;
      if (churn) {
        effects.push({
          type: "diagnostic-failure",
          diagnostic: renderChurnEvent(Object.assign({}, source, {
            renderCount,
            fullRenderCount,
            fallbackCount,
            previousCount,
            domCount,
            visibleCount,
            duplicateCount,
          })),
          diagnosticType: "render_churn",
          reason: "render-churn",
        });
      } else if (!sample.fullRender && !sample.fallbackApplied && duplicateCount === 0) {
        effects.push({
          type: "diagnostic-success",
          diagnostic: renderSuccess(source, "render_churn"),
          diagnosticType: "render_churn",
          reason: "render-churn-stable",
        });
      }

      return {
        effects,
        reason: effects.length ? "frontend-render-health-effects" : "render-observed",
        renderCount,
        fullRenderCount,
        fallbackCount,
      };
    }

    function reset() {
      samples = [];
    }

    return {
      recordRender,
      reset,
      windowMs,
    };
  }


const api = {
    compactToken,
    createMonitor,
    submittedMessageDomMissingEvent,
    submittedMessageDomProbeEffects,
    submittedMessageDomSuccess,
    threadListInteractionStallEvent,
    threadListInteractionStallEffects,
    renderChurnEvent,
    domDropEvent,
    runtimeSuccess,
  };

export {
  compactToken,
  createMonitor,
  submittedMessageDomMissingEvent,
  submittedMessageDomProbeEffects,
  submittedMessageDomSuccess,
  threadListInteractionStallEvent,
  threadListInteractionStallEffects,
  renderChurnEvent,
  domDropEvent,
  runtimeSuccess,
};

export default api;
