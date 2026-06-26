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

test("thread diagnostic events build bounded thread refresh failure payloads", () => {
  const event = diagnostics.threadDetailRefreshFailedDiagnosticEvent({
    errorCode: "network timeout private text",
    durationBucket: "1-3s",
    statusCode: 503.9,
    threadHash: "thread/hash with spaces",
    prompt: "private prompt ignored",
    token: "secret ignored",
    body: "private message ignored",
  });

  assert.deepEqual(event, {
    category: "thread_session_load_failed",
    diagnostic_type: "thread_detail_refresh_failed",
    severity_hint: "H2",
    evidence_confidence: 0.74,
    error_code: "network_timeout_private_text",
    duration_bucket: "1-3s",
    context: {
      surface: "thread-session",
      action: "thread-detail-refresh",
      thread_hash: "thread_hash_with_spaces",
    },
    counts: {
      status_code: 503,
    },
    breadcrumbs: [{
      kind: "thread-session",
      code: "thread-detail-refresh",
      status: "failed",
      duration_bucket: "1-3s",
      fields: {
        status_code: 503,
        thread_hash: "thread_hash_with_spaces",
      },
    }],
  });
  assert.equal(JSON.stringify(event).includes("secret"), false);
});

test("thread diagnostic events build render signature mismatch payloads", () => {
  const snapshot = {
    renderedSignature: "old",
    currentSignature: "new",
    context: {
      surface: "conversation-render",
      action: "refresh-metadata",
      route_kind: "thread-tile",
      read_mode: "mixed",
      render_mode: "metadata-only",
      unsafe_message: "private text ignored",
    },
    counts: {
      dom_count: 7.8,
      duplicate_count: 0,
      visible_count: 12.4,
      turn_count: 3,
      pane_count: 2,
    },
  };
  const event = diagnostics.renderSignatureMismatchDiagnosticEvent(snapshot);

  assert.equal(diagnostics.hasRenderSignatureMismatch(snapshot), true);
  assert.equal(event.category, "conversation_projection_mismatch");
  assert.equal(event.diagnostic_type, "render_signature_mismatch");
  assert.equal(event.severity_hint, "H2");
  assert.equal(event.evidence_confidence, 0.74);
  assert.deepEqual(event.context, {
    surface: "conversation-render",
    action: "refresh-metadata",
    route_kind: "thread-tile",
    read_mode: "mixed",
    render_mode: "metadata-only",
  });
  assert.deepEqual(event.counts, {
    dom_count: 7,
    duplicate_count: 0,
    visible_count: 12,
    turn_count: 3,
    pane_count: 2,
  });
  assert.deepEqual(event.breadcrumbs[0].fields, {
    read_mode: "mixed",
    render_mode: "metadata-only",
    dom_count: 7,
    visible_count: 12,
  });
  assert.equal(JSON.stringify(event).includes("private"), false);
});

test("thread diagnostic events build duplicate render-key payloads and success inputs", () => {
  const snapshot = {
    renderedSignature: "same",
    currentSignature: "same",
    context: {
      surface: "conversation-render",
      action: "first-paint",
      read_mode: "projection-cache",
      render_mode: "first-paint",
    },
    counts: {
      dom_count: 5,
      duplicate_count: 2,
      visible_count: 4,
      turn_count: 1,
    },
  };
  const duplicate = diagnostics.duplicateRenderKeysDiagnosticEvent(snapshot);

  assert.equal(diagnostics.hasRenderSignatureMismatch(snapshot), false);
  assert.equal(diagnostics.hasDuplicateRenderKeys(snapshot), true);
  assert.equal(duplicate.diagnostic_type, "duplicate_render_keys");
  assert.equal(duplicate.evidence_confidence, 0.78);
  assert.deepEqual(duplicate.breadcrumbs[0].fields, {
    duplicate_count: 2,
    dom_count: 5,
    visible_count: 4,
  });
  assert.deepEqual(diagnostics.renderSignatureMismatchDiagnosticSuccess(snapshot), {
    category: "conversation_projection_mismatch",
    diagnostic_type: "render_signature_mismatch",
    error_code: "render_signature_mismatch",
    context: duplicate.context,
  });
  assert.deepEqual(diagnostics.duplicateRenderKeysDiagnosticSuccess(snapshot), {
    category: "conversation_projection_mismatch",
    diagnostic_type: "duplicate_render_keys",
    error_code: "duplicate_render_keys",
    context: duplicate.context,
  });
});

test("thread diagnostic events build turn-order mismatch payloads and success inputs", () => {
  const snapshot = {
    context: {
      surface: "conversation-render",
      action: "first-paint",
      read_mode: "turns-list-initial",
      render_mode: "first-paint",
      thread_hash: "thread hash with spaces",
      turn_hash: "turn/hash with spaces",
      unsafe_prompt: "private prompt ignored",
    },
    counts: {
      dom_count: 10,
      visible_count: 10,
      turn_count: 10,
      order_mismatch_count: 2,
      latest_mismatch_count: 1,
    },
  };
  const event = diagnostics.turnOrderMismatchDiagnosticEvent(snapshot);

  assert.equal(diagnostics.hasTurnOrderMismatch(snapshot), true);
  assert.equal(event.category, "conversation_projection_mismatch");
  assert.equal(event.diagnostic_type, "turn_order_mismatch");
  assert.equal(event.severity_hint, "H2");
  assert.equal(event.evidence_confidence, 0.82);
  assert.deepEqual(event.context, {
    surface: "conversation-render",
    action: "first-paint",
    read_mode: "turns-list-initial",
    render_mode: "first-paint",
    thread_hash: "thread_hash_with_spaces",
    turn_hash: "turn_hash_with_spaces",
  });
  assert.deepEqual(event.counts, {
    dom_count: 10,
    duplicate_count: 0,
    visible_count: 10,
    turn_count: 10,
    order_mismatch_count: 2,
    latest_mismatch_count: 1,
  });
  assert.deepEqual(event.breadcrumbs[0].fields, {
    read_mode: "turns-list-initial",
    render_mode: "first-paint",
    dom_count: 10,
    visible_count: 10,
    turn_hash: "turn_hash_with_spaces",
    order_mismatch_count: 2,
    latest_mismatch_count: 1,
  });
  assert.deepEqual(diagnostics.turnOrderMismatchDiagnosticSuccess(snapshot), {
    category: "conversation_projection_mismatch",
    diagnostic_type: "turn_order_mismatch",
    error_code: "turn_order_mismatch",
    context: event.context,
  });
  assert.equal(JSON.stringify(event).includes("private"), false);
});

test("thread diagnostic events plan tile conversation projection snapshots", () => {
  const calls = [];
  const snapshot = diagnostics.conversationProjectionDiagnosticSnapshot({
    source: "refresh-metadata",
    renderMode: "metadata-only",
    renderedSignature: "tile-rendered",
    threadTileMode: true,
    tileDomActive: true,
    domShape: { renderKeyCount: 7, duplicateRenderKeyCount: 1 },
  }, {
    tileLayout() {
      calls.push(["layout"]);
      return { enabled: true, columns: 2 };
    },
    tileCandidateIds(layout) {
      calls.push(["ids", layout.columns]);
      return ["tile-a", "tile-b"];
    },
    tileDisplayLayout(layout, ids) {
      calls.push(["display", ids.join(",")]);
      return { enabled: true, columns: layout.columns, rows: 1 };
    },
    tileRenderSignature(layout, ids) {
      calls.push(["tile-signature", ids.length, layout.columns]);
      return "tile-current";
    },
    tileThreadForId(id) {
      return { id, visibleItemCount: id === "tile-a" ? 2 : 4 };
    },
    visibleShape(thread) {
      return { visibleTurnCount: 1, visibleItemCount: thread.visibleItemCount };
    },
    singleSignature() {
      calls.push(["single"]);
      return "single-current";
    },
  });

  assert.deepEqual(snapshot, {
    renderedSignature: "tile-rendered",
    currentSignature: "tile-current",
    context: {
      surface: "conversation-render",
      action: "refresh-metadata",
      route_kind: "thread-tile",
      read_mode: "mixed",
      render_mode: "metadata-only",
    },
    counts: {
      dom_count: 7,
      duplicate_count: 1,
      visible_count: 6,
      turn_count: 2,
      pane_count: 2,
    },
  });
  assert.deepEqual(calls.filter((entry) => entry[0] === "single"), []);
  assert.deepEqual(calls.map((entry) => entry[0]), ["layout", "ids", "display", "tile-signature"]);
});

test("thread diagnostic events plan single conversation projection snapshots", () => {
  const calls = [];
  const thread = { id: "thread-1", mobileReadMode: "projection-cache" };
  const snapshot = diagnostics.conversationProjectionDiagnosticSnapshot({
    source: "first-paint",
    renderMode: "first-paint",
    renderedSignature: "single-rendered",
    threadTileMode: false,
    tileDomActive: false,
    domShape: { renderKeyCount: 3, duplicateRenderKeyCount: 0 },
    thread,
  }, {
    singleSignature(inputThread) {
      calls.push(["single", inputThread && inputThread.id]);
      return "single-current";
    },
    visibleShape(inputThread) {
      return inputThread === thread
        ? { visibleTurnCount: 1, visibleItemCount: 3 }
        : { visibleTurnCount: 0, visibleItemCount: 0 };
    },
    tileLayout() {
      calls.push(["tile"]);
      return { enabled: true };
    },
  });

  assert.equal(snapshot.renderedSignature, "single-rendered");
  assert.equal(snapshot.currentSignature, "single-current");
  assert.equal(snapshot.context.read_mode, "projection-cache");
  assert.equal(snapshot.context.render_mode, "first-paint");
  assert.equal(snapshot.counts.visible_count, 3);
  assert.deepEqual(calls, [["single", "thread-1"]]);
});

test("thread diagnostic events skip mismatched projection surfaces", () => {
  assert.equal(diagnostics.conversationProjectionDiagnosticSnapshot({
    threadTileMode: true,
    tileDomActive: false,
  }), null);
  assert.equal(diagnostics.conversationProjectionDiagnosticSnapshot({
    threadTileMode: false,
    tileDomActive: true,
  }), null);
  assert.equal(diagnostics.conversationProjectionDiagnosticSnapshot({
    threadTileMode: true,
    tileDomActive: true,
    tileLayout: { enabled: false },
  }), null);
  assert.equal(diagnostics.conversationProjectionDiagnosticSnapshot({
    threadTileMode: true,
    tileDomActive: true,
    tileLayout: { enabled: true },
    tileIds: [],
  }), null);
});

test("thread diagnostic events build bounded slow path payloads", () => {
  const event = diagnostics.threadDetailSlowPathDiagnosticEvent({
    action: "thread-detail-load",
    reason: "api-slow",
    readMode: "thread-read",
    renderMode: "first-paint",
    performancePhase: "cold-thread-read",
    threadHash: "thread/hash",
    durationBucket: "10_30s",
    elapsedMs: 17000,
    apiElapsedMs: 12000,
    renderElapsedMs: 300,
    thresholdMs: 8000,
    turns: 10,
    visibleItems: 30,
    omittedTurns: 2,
    rolloutSizeBytes: 2 * 1024 * 1024,
    prompt: "private prompt ignored",
  });

  assert.equal(event.category, "thread_session_slow_path");
  assert.equal(event.diagnostic_type, "thread_detail_slow_path");
  assert.equal(event.error_code, "api-slow");
  assert.equal(event.context.thread_hash, "thread_hash");
  assert.equal(event.context.performance_phase, "cold-thread-read");
  assert.equal(event.counts.elapsed_ms, 17000);
  assert.equal(event.counts.api_elapsed_ms, 12000);
  assert.equal(event.counts.threshold_ms, 8000);
  assert.equal(event.counts.rollout_mb, 2);
  assert.equal(JSON.stringify(event).includes("private"), false);
  assert.deepEqual(diagnostics.threadDetailSlowPathDiagnosticSuccess({
    action: "thread-detail-load",
    threadHash: "thread/hash",
    readMode: "thread-read",
  }), {
    category: "thread_session_slow_path",
    diagnostic_type: "thread_detail_slow_path",
    error_code: "thread_detail_slow_path",
    context: {
      surface: "thread-session",
      action: "thread-detail-load",
      thread_hash: "thread_hash",
      read_mode: "thread-read",
    },
  });
});

test("thread diagnostic events build bounded detail response contract payloads", () => {
  const event = diagnostics.threadDetailResponseContractDiagnosticEvent({
    reason: "empty-projection-shell",
    severityHint: "H2",
    action: "thread-detail-load",
    threadHash: "thread/hash",
    readMode: "projection-v4-partial",
    renderMode: "first-paint",
    performancePhase: "warm-projection-partial",
    projectionSource: "partial",
    projectionPartialKind: "notification-shell",
    turns: 1,
    items: 0,
    visibleItems: 0,
    activeTurns: 0,
    completedTurns: 1,
    omittedTurns: 0,
    olderCursor: false,
    newerCursor: false,
    projectionPartial: true,
    body: "private body ignored",
    url: "https://example.invalid/private",
  });

  assert.equal(event.category, "conversation_projection_mismatch");
  assert.equal(event.diagnostic_type, "thread_detail_response_contract_mismatch");
  assert.equal(event.error_code, "empty-projection-shell");
  assert.equal(event.evidence_confidence, 0.82);
  assert.deepEqual(event.context, {
    surface: "thread-session",
    action: "thread-detail-load",
    thread_hash: "thread_hash",
    read_mode: "projection-v4-partial",
    render_mode: "first-paint",
    performance_phase: "warm-projection-partial",
    projection_source: "partial",
    projection_partial_kind: "notification-shell",
  });
  assert.deepEqual(event.counts, {
    turn_count: 1,
    item_count: 0,
    visible_count: 0,
    active_turn_count: 0,
    completed_turn_count: 1,
    omitted_turns: 0,
    older_cursor: 0,
    newer_cursor: 0,
    projection_partial: 1,
  });
  assert.equal(event.breadcrumbs[0].fields.projection_partial, 1);
  assert.equal(event.breadcrumbs[0].fields.thread_hash, "thread_hash");
  assert.equal(JSON.stringify(event).includes("private"), false);
  assert.deepEqual(diagnostics.threadDetailResponseContractDiagnosticSuccess({
    action: "thread-detail-load",
    threadHash: "thread/hash",
    readMode: "thread-read",
  }), {
    category: "conversation_projection_mismatch",
    diagnostic_type: "thread_detail_response_contract_mismatch",
    error_code: "thread_detail_response_contract_mismatch",
    context: {
      surface: "thread-session",
      action: "thread-detail-load",
      thread_hash: "thread_hash",
      read_mode: "thread-read",
    },
  });
});
