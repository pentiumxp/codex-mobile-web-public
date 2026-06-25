"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const diagnostics = require(path.resolve(__dirname, "..", "public", "thread-diagnostic-events.js"));

test("thread diagnostic events build bounded detail patch rejection payloads", () => {
  const event = diagnostics.detailPatchRejectedDiagnosticEvent({
    readMode: "projection-cache",
    renderMode: "patch",
    renderPlanReason: "signature-changed",
    patchRejectReason: "rendered-dom-stale",
    previousVisibleItemCount: 4.8,
    visibleItemCount: 6.2,
    body: "private body ignored",
    prompt: "private prompt ignored",
    token: "secret ignored",
  });

  assert.deepEqual(event, {
    category: "conversation_projection_mismatch",
    diagnostic_type: "detail_patch_rejected",
    severity_hint: "H3",
    evidence_confidence: 0.7,
    error_code: "detail_patch_rejected",
    context: {
      surface: "conversation-render",
      action: "thread-detail-refresh",
      read_mode: "projection-cache",
      render_mode: "patch",
      render_plan_reason: "signature-changed",
      patch_reject_reason: "rendered-dom-stale",
    },
    counts: {
      previous_count: 4,
      visible_count: 6,
    },
    breadcrumbs: [{
      kind: "conversation-render",
      code: "detail-patch",
      status: "rejected",
      fields: {
        read_mode: "projection-cache",
        render_mode: "patch",
        render_plan_reason: "signature-changed",
        patch_reject_reason: "rendered-dom-stale",
        visible_count: 6,
      },
    }],
  });
  assert.equal(JSON.stringify(event).includes("private"), false);
  assert.equal(JSON.stringify(event).includes("secret"), false);
});

test("thread diagnostic events bound invalid counts and labels", () => {
  const event = diagnostics.detailPatchRejectedDiagnosticEvent({
    readMode: "raw mode with spaces",
    renderMode: "bad/mode",
    renderPlanReason: "x".repeat(120),
    patchRejectReason: "",
    previousVisibleItemCount: -1,
    visibleItemCount: 1000000,
  });

  assert.equal(event.context.read_mode, "raw_mode_with_spaces");
  assert.equal(event.context.render_mode, "bad_mode");
  assert.equal(event.context.render_plan_reason.length, 80);
  assert.equal(event.context.patch_reject_reason, "unknown");
  assert.equal(event.counts.previous_count, 0);
  assert.equal(event.counts.visible_count, 100000);
});
