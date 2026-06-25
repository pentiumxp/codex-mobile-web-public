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
  };
}));
