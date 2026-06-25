"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexThreadDiagnosticEvents = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
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

  function projectionDiagnosticContext(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const out = {
      surface: compactToken(source.surface, "conversation-render", 80),
      action: compactToken(source.action, "render", 80),
    };
    const routeKind = compactToken(source.route_kind || source.routeKind, "", 80);
    const readMode = compactToken(source.read_mode || source.readMode, "", 80);
    const renderMode = compactToken(source.render_mode || source.renderMode, "", 80);
    if (routeKind) out.route_kind = routeKind;
    if (readMode) out.read_mode = readMode;
    if (renderMode) out.render_mode = renderMode;
    return out;
  }

  function projectionDiagnosticCounts(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const out = {
      dom_count: boundedCount(source.dom_count || source.domCount),
      duplicate_count: boundedCount(source.duplicate_count || source.duplicateCount),
      visible_count: boundedCount(source.visible_count || source.visibleCount),
      turn_count: boundedCount(source.turn_count || source.turnCount),
    };
    const paneCount = boundedCount(source.pane_count || source.paneCount);
    if (paneCount) out.pane_count = paneCount;
    return out;
  }

  function projectionDiagnosticSnapshot(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    return {
      renderedSignature: String(source.renderedSignature || ""),
      currentSignature: String(source.currentSignature || ""),
      context: projectionDiagnosticContext(source.context || {}),
      counts: projectionDiagnosticCounts(source.counts || {}),
    };
  }

  function hasRenderSignatureMismatch(snapshot) {
    const normalized = projectionDiagnosticSnapshot(snapshot);
    return Boolean(normalized.renderedSignature && normalized.renderedSignature !== normalized.currentSignature);
  }

  function hasDuplicateRenderKeys(snapshot) {
    return projectionDiagnosticSnapshot(snapshot).counts.duplicate_count > 0;
  }

  function renderSignatureMismatchDiagnosticEvent(snapshot = {}) {
    const normalized = projectionDiagnosticSnapshot(snapshot);
    const context = normalized.context;
    const counts = normalized.counts;
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "render_signature_mismatch",
      severity_hint: "H2",
      evidence_confidence: 0.74,
      error_code: "render_signature_mismatch",
      context,
      counts,
      breadcrumbs: [{
        kind: "conversation-render",
        code: "signature-check",
        status: "failed",
        fields: {
          read_mode: context.read_mode || "",
          render_mode: context.render_mode || "",
          dom_count: counts.dom_count,
          visible_count: counts.visible_count,
        },
      }],
    };
  }

  function renderSignatureMismatchDiagnosticSuccess(snapshot = {}) {
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "render_signature_mismatch",
      error_code: "render_signature_mismatch",
      context: projectionDiagnosticSnapshot(snapshot).context,
    };
  }

  function duplicateRenderKeysDiagnosticEvent(snapshot = {}) {
    const normalized = projectionDiagnosticSnapshot(snapshot);
    const counts = normalized.counts;
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "duplicate_render_keys",
      severity_hint: "H2",
      evidence_confidence: 0.78,
      error_code: "duplicate_render_keys",
      context: normalized.context,
      counts,
      breadcrumbs: [{
        kind: "conversation-render",
        code: "render-key-check",
        status: "failed",
        fields: {
          duplicate_count: counts.duplicate_count,
          dom_count: counts.dom_count,
          visible_count: counts.visible_count,
        },
      }],
    };
  }

  function duplicateRenderKeysDiagnosticSuccess(snapshot = {}) {
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "duplicate_render_keys",
      error_code: "duplicate_render_keys",
      context: projectionDiagnosticSnapshot(snapshot).context,
    };
  }

  function detailPatchRejectedDiagnosticEvent(input = {}) {
    const readMode = compactToken(input.readMode, "", 80);
    const renderMode = compactToken(input.renderMode, "", 80);
    const renderPlanReason = compactToken(input.renderPlanReason, "", 80);
    const patchRejectReason = compactToken(input.patchRejectReason, "unknown", 80);
    const previousCount = boundedCount(input.previousVisibleItemCount);
    const visibleCount = boundedCount(input.visibleItemCount);
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "detail_patch_rejected",
      severity_hint: "H3",
      evidence_confidence: 0.7,
      error_code: "detail_patch_rejected",
      context: {
        surface: "conversation-render",
        action: "thread-detail-refresh",
        read_mode: readMode,
        render_mode: renderMode,
        render_plan_reason: renderPlanReason,
        patch_reject_reason: patchRejectReason,
      },
      counts: {
        previous_count: previousCount,
        visible_count: visibleCount,
      },
      breadcrumbs: [{
        kind: "conversation-render",
        code: "detail-patch",
        status: "rejected",
        fields: {
          read_mode: readMode,
          render_mode: renderMode,
          render_plan_reason: renderPlanReason,
          patch_reject_reason: patchRejectReason,
          visible_count: visibleCount,
        },
      }],
    };
  }

  return {
    boundedCount,
    compactToken,
    detailPatchRejectedDiagnosticEvent,
    duplicateRenderKeysDiagnosticEvent,
    duplicateRenderKeysDiagnosticSuccess,
    hasDuplicateRenderKeys,
    hasRenderSignatureMismatch,
    projectionDiagnosticContext,
    projectionDiagnosticCounts,
    projectionDiagnosticSnapshot,
    renderSignatureMismatchDiagnosticEvent,
    renderSignatureMismatchDiagnosticSuccess,
  };
}));
