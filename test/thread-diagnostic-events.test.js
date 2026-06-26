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

test("thread diagnostic events build bounded thread load failure payloads", () => {
  const event = diagnostics.threadDetailLoadFailedDiagnosticEvent({
    errorCode: "load timeout private text",
    durationBucket: "3-10s",
    statusCode: 504.7,
    threadHash: "thread/hash with spaces",
    prompt: "private prompt ignored",
    token: "secret ignored",
    body: "private message ignored",
  });

  assert.deepEqual(event, {
    category: "thread_session_load_failed",
    diagnostic_type: "thread_detail_load_failed",
    severity_hint: "H2",
    evidence_confidence: 0.76,
    error_code: "load_timeout_private_text",
    duration_bucket: "3-10s",
    context: {
      surface: "thread-session",
      action: "thread-detail-load",
      thread_hash: "thread_hash_with_spaces",
    },
    counts: {
      status_code: 504,
    },
    breadcrumbs: [{
      kind: "thread-session",
      code: "thread-detail-load",
      status: "failed",
      duration_bucket: "3-10s",
      fields: {
        status_code: 504,
        thread_hash: "thread_hash_with_spaces",
      },
    }],
  });
  assert.equal(JSON.stringify(event).includes("secret"), false);
  assert.equal(JSON.stringify(event).includes("private prompt"), false);
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
    missing_dom_turn_count: 0,
  });
  assert.deepEqual(diagnostics.turnOrderMismatchDiagnosticSuccess(snapshot), {
    category: "conversation_projection_mismatch",
    diagnostic_type: "turn_order_mismatch",
    error_code: "turn_order_mismatch",
    context: event.context,
  });
  assert.equal(JSON.stringify(event).includes("private"), false);
});

test("thread diagnostic events treat missing DOM turns as turn-order mismatch evidence", () => {
  const snapshot = diagnostics.turnOrderDiagnosticSnapshot({
    source: "first-paint",
    readMode: "projection-v4-dynamic",
    renderMode: "first-paint",
    threadHash: "thread/hash with spaces",
    expectedTurnIds: ["turn-a", "turn-b", "turn-private"],
    domTurnIds: [],
    body: "private body ignored",
  }, {
    turnHash: () => "h_latest",
  });
  assert.ok(snapshot);
  assert.equal(diagnostics.hasTurnOrderMismatch(snapshot), true);
  assert.deepEqual(snapshot.context, {
    surface: "conversation-render",
    action: "first-paint",
    read_mode: "projection-v4-dynamic",
    render_mode: "first-paint",
    thread_hash: "thread_hash_with_spaces",
    turn_hash: "h_latest",
  });
  assert.deepEqual(snapshot.counts, {
    dom_count: 0,
    duplicate_count: 0,
    visible_count: 3,
    turn_count: 3,
    order_mismatch_count: 3,
    latest_mismatch_count: 1,
    missing_dom_turn_count: 3,
  });

  const event = diagnostics.turnOrderMismatchDiagnosticEvent(snapshot);
  assert.equal(event.diagnostic_type, "turn_order_mismatch");
  assert.equal(event.breadcrumbs[0].fields.missing_dom_turn_count, 3);
  assert.equal(JSON.stringify(event).includes("turn-private"), false);
  assert.equal(JSON.stringify(event).includes("private body"), false);
});

test("thread diagnostic events plan projection consistency effects without app state", () => {
  const snapshot = {
    renderedSignature: "rendered-a",
    currentSignature: "current-b",
    context: {
      action: "refresh",
      read_mode: "projection-v4-dynamic",
      render_mode: "full-render",
      unsafe_prompt: "private prompt ignored",
    },
    counts: {
      dom_count: 4,
      duplicate_count: 2,
      visible_count: 6,
      turn_count: 3,
    },
  };
  const orderSnapshot = diagnostics.turnOrderDiagnosticSnapshot({
    source: "refresh",
    readMode: "projection-v4-dynamic",
    renderMode: "full-render",
    expectedTurnIds: ["turn-a", "turn-b"],
    domTurnIds: ["turn-b", "turn-a"],
  }, {
    turnHash: () => "turn_hash",
  });

  const plan = diagnostics.conversationProjectionConsistencyEffects({ snapshot, orderSnapshot });
  assert.equal(plan.reason, "projection-consistency-effects");
  assert.deepEqual(plan.effects.map((effect) => [effect.type, effect.diagnosticType, effect.reason]), [
    ["diagnostic-failure", "render_signature_mismatch", "render-signature-mismatch"],
    ["diagnostic-failure", "duplicate_render_keys", "duplicate-render-keys"],
    ["diagnostic-failure", "turn_order_mismatch", "turn-order-mismatch"],
  ]);
  assert.equal(plan.effects[0].diagnostic.diagnostic_type, "render_signature_mismatch");
  assert.equal(plan.effects[1].diagnostic.diagnostic_type, "duplicate_render_keys");
  assert.equal(plan.effects[2].diagnostic.diagnostic_type, "turn_order_mismatch");
  assert.equal(JSON.stringify(plan).includes("private prompt"), false);

  const healthy = diagnostics.conversationProjectionConsistencyEffects({
    snapshot: Object.assign({}, snapshot, {
      renderedSignature: "same",
      currentSignature: "same",
      counts: Object.assign({}, snapshot.counts, { duplicate_count: 0 }),
    }),
    orderSnapshot: diagnostics.turnOrderDiagnosticSnapshot({
      source: "refresh",
      expectedTurnIds: ["turn-a", "turn-b"],
      domTurnIds: ["turn-a", "turn-b"],
    }),
  });
  assert.deepEqual(healthy.effects.map((effect) => [effect.type, effect.diagnosticType, effect.reason]), [
    ["diagnostic-success", "render_signature_mismatch", "render-signature-match"],
    ["diagnostic-success", "duplicate_render_keys", "no-duplicate-render-keys"],
    ["diagnostic-success", "turn_order_mismatch", "turn-order-match"],
  ]);

  assert.deepEqual(diagnostics.conversationProjectionConsistencyEffects(), {
    effects: [],
    reason: "no-snapshot",
  });
});

test("thread diagnostic events build primary shell selection conflict payloads", () => {
  const event = diagnostics.primaryShellSelectionConflictDiagnosticEvent({
    reason: "primary shell after detail",
    sourceKind: "restore empty",
    threadHash: "thread/hash with spaces",
    readMode: "projection-v4-dynamic",
    renderMode: "primary-shell",
    turns: 10,
    visibleItems: 34,
    items: 39,
    domCount: 1,
    previousCount: 13,
    recentDetailAgeMs: 1200,
    hasCurrentThread: false,
    hasCurrentThreadId: false,
    hasThreadLoadController: true,
    startupThreadOpenPending: true,
    mobileLoading: true,
    prompt: "private prompt ignored",
    message: "private message ignored",
  });

  assert.equal(event.category, "conversation_projection_mismatch");
  assert.equal(event.diagnostic_type, "primary_shell_selection_conflict");
  assert.equal(event.severity_hint, "H2");
  assert.equal(event.error_code, "primary_shell_after_detail");
  assert.deepEqual(event.context, {
    surface: "conversation-render",
    action: "primary-shell-selection",
    route_kind: "embedded-primary",
    read_mode: "projection-v4-dynamic",
    render_mode: "primary-shell",
    source_kind: "restore_empty",
    thread_hash: "thread_hash_with_spaces",
  });
  assert.deepEqual(event.counts, {
    visible_count: 34,
    turn_count: 10,
    item_count: 39,
    dom_count: 1,
    previous_count: 13,
    has_current_thread: 0,
    has_current_thread_id: 0,
    has_thread_load_controller: 1,
    startup_thread_open_pending: 1,
    mobile_loading: 1,
    recent_detail_age_ms: 1200,
  });
  assert.deepEqual(event.breadcrumbs[0].fields, {
    read_mode: "projection-v4-dynamic",
    render_mode: "primary-shell",
    source_kind: "restore_empty",
    thread_hash: "thread_hash_with_spaces",
    dom_count: 1,
    visible_count: 34,
    turn_count: 10,
    item_count: 39,
    previous_count: 13,
  });
  assert.deepEqual(diagnostics.primaryShellSelectionConflictDiagnosticSuccess({
    sourceKind: "first-paint",
    threadHash: "thread/hash with spaces",
    readMode: "projection-v4-dynamic",
  }), {
    category: "conversation_projection_mismatch",
    diagnostic_type: "primary_shell_selection_conflict",
    error_code: "primary_shell_selection_conflict",
    context: {
      surface: "conversation-render",
      action: "primary-shell-selection",
      route_kind: "embedded-primary",
      read_mode: "projection-v4-dynamic",
      source_kind: "first-paint",
      thread_hash: "thread_hash_with_spaces",
    },
  });
  assert.equal(JSON.stringify(event).includes("private"), false);
});

test("thread diagnostic events build empty visible detail mismatch payloads", () => {
  const event = diagnostics.emptyVisibleDetailMismatchDiagnosticEvent({
    reason: "empty render after nonempty detail",
    sourceKind: "first paint detail api",
    threadHash: "thread/hash with spaces",
    readMode: "projection-v4-dynamic",
    renderMode: "full-render",
    turns: 10,
    visibleItems: 34,
    items: 39,
    currentTurns: 0,
    currentVisibleItems: 0,
    domCount: 2,
    previousCount: 11,
    detailLoaded: true,
    mobileLoading: false,
    recentDetailAgeMs: 900,
    prompt: "private prompt ignored",
    body: "private body ignored",
  });

  assert.equal(event.category, "conversation_projection_mismatch");
  assert.equal(event.diagnostic_type, "empty_visible_detail_mismatch");
  assert.equal(event.severity_hint, "H2");
  assert.equal(event.evidence_confidence, 0.84);
  assert.equal(event.error_code, "empty_render_after_nonempty_detail");
  assert.deepEqual(event.context, {
    surface: "conversation-render",
    action: "single-thread-empty-state",
    route_kind: "single-thread",
    read_mode: "projection-v4-dynamic",
    render_mode: "full-render",
    source_kind: "first_paint_detail_api",
    thread_hash: "thread_hash_with_spaces",
  });
  assert.deepEqual(event.counts, {
    visible_count: 34,
    turn_count: 10,
    item_count: 39,
    current_visible_count: 0,
    current_turn_count: 0,
    dom_count: 2,
    previous_count: 11,
    detail_loaded: 1,
    mobile_loading: 0,
    recent_detail_age_ms: 900,
  });
  assert.deepEqual(event.breadcrumbs[0].fields, {
    read_mode: "projection-v4-dynamic",
    render_mode: "full-render",
    source_kind: "first_paint_detail_api",
    thread_hash: "thread_hash_with_spaces",
    visible_count: 34,
    turn_count: 10,
    item_count: 39,
    dom_count: 2,
    previous_count: 11,
  });
  assert.deepEqual(diagnostics.emptyVisibleDetailMismatchDiagnosticSuccess({
    sourceKind: "first-paint",
    threadHash: "thread/hash with spaces",
    readMode: "projection-v4-dynamic",
  }), {
    category: "conversation_projection_mismatch",
    diagnostic_type: "empty_visible_detail_mismatch",
    error_code: "empty_visible_detail_mismatch",
    context: {
      surface: "conversation-render",
      action: "single-thread-empty-state",
      route_kind: "single-thread",
      read_mode: "projection-v4-dynamic",
      source_kind: "first-paint",
      thread_hash: "thread_hash_with_spaces",
    },
  });
  assert.equal(JSON.stringify(event).includes("private"), false);
});

test("thread diagnostic events build empty cached detail reuse payloads", () => {
  const event = diagnostics.emptyCachedDetailReuseBlockedDiagnosticEvent({
    reason: "empty loaded detail not reusable",
    sourceKind: "thread list",
    threadHash: "thread/hash with spaces",
    readMode: "projection-v4-dynamic",
    currentTurns: 0,
    currentVisibleItems: 0,
    items: 0,
    detailLoaded: true,
    reusableDetail: false,
    mobileLoading: false,
    threadTaskCardCount: 3,
    prompt: "private prompt ignored",
    body: "private body ignored",
    token: "secret ignored",
  });

  assert.equal(event.category, "conversation_projection_mismatch");
  assert.equal(event.diagnostic_type, "empty_cached_detail_reuse_blocked");
  assert.equal(event.severity_hint, "H2");
  assert.equal(event.evidence_confidence, 0.8);
  assert.equal(event.error_code, "empty_loaded_detail_not_reusable");
  assert.deepEqual(event.context, {
    surface: "thread-session",
    action: "thread-open-cache-reuse",
    route_kind: "single-thread",
    read_mode: "projection-v4-dynamic",
    source_kind: "thread_list",
    thread_hash: "thread_hash_with_spaces",
  });
  assert.deepEqual(event.counts, {
    current_turn_count: 0,
    current_visible_count: 0,
    item_count: 0,
    detail_loaded: 1,
    reusable_detail: 0,
    mobile_loading: 0,
    thread_task_card_count: 3,
  });
  assert.deepEqual(event.breadcrumbs[0].fields, {
    read_mode: "projection-v4-dynamic",
    source_kind: "thread_list",
    thread_hash: "thread_hash_with_spaces",
    current_turn_count: 0,
    current_visible_count: 0,
    item_count: 0,
    detail_loaded: 1,
    reusable_detail: 0,
  });
  assert.deepEqual(diagnostics.emptyCachedDetailReuseDiagnosticSuccess({
    sourceKind: "cached-current",
    threadHash: "thread/hash with spaces",
    readMode: "projection-v4-dynamic",
  }), {
    category: "conversation_projection_mismatch",
    diagnostic_type: "empty_cached_detail_reuse_blocked",
    error_code: "empty_cached_detail_reuse_blocked",
    context: {
      surface: "thread-session",
      action: "thread-open-cache-reuse",
      route_kind: "single-thread",
      read_mode: "projection-v4-dynamic",
      source_kind: "cached-current",
      thread_hash: "thread_hash_with_spaces",
    },
  });
  assert.equal(JSON.stringify(event).includes("private"), false);
  assert.equal(JSON.stringify(event).includes("secret"), false);
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
    coldPathOwner: "projection-cache",
    coldPathReason: "projection-miss:static-signature-mismatch",
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
  assert.equal(event.context.cold_path_owner, "projection-cache");
  assert.equal(event.context.cold_path_reason, "projection-miss:static-signature-mismatch");
  assert.equal(event.breadcrumbs[0].fields.cold_path_owner, "projection-cache");
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

test("thread diagnostic events plan thread detail response effects without app state", () => {
  const plan = diagnostics.threadDetailResponseDiagnosticEffects({
    slowPlan: {
      shouldReport: true,
      reason: "api-slow",
      severityHint: "H2",
      thresholdMs: 8000,
      elapsedMs: 17000,
      apiElapsedMs: 12000,
      renderElapsedMs: 300,
      action: "thread-detail-refresh",
      threadHash: "thread/hash",
      durationBucket: "10_30s",
      readMode: "thread-read",
      renderMode: "first-paint",
      performancePhase: "cold-thread-read",
      coldPathOwner: "projection-cache",
      coldPathReason: "projection-miss",
      prompt: "private prompt ignored",
    },
    contractPlan: {
      shouldReport: false,
      reason: "ok",
      action: "thread-detail-refresh",
      threadHash: "thread/hash",
      readMode: "thread-read",
      renderMode: "first-paint",
      performancePhase: "cold-thread-read",
      body: "private body ignored",
    },
  });

  assert.equal(plan.reason, "thread-detail-response-diagnostic-effects");
  assert.deepEqual(plan.effects.map((effect) => [effect.type, effect.diagnosticType, effect.reason]), [
    ["diagnostic-failure", "thread_detail_slow_path", "api-slow"],
    ["diagnostic-success", "thread_detail_response_contract_mismatch", "thread-detail-response-contract-ok"],
  ]);
  assert.equal(plan.effects[0].diagnostic.diagnostic_type, "thread_detail_slow_path");
  assert.equal(plan.effects[0].diagnostic.context.thread_hash, "thread_hash");
  assert.equal(plan.effects[1].diagnostic.diagnostic_type, "thread_detail_response_contract_mismatch");
  assert.equal(plan.effects[1].diagnostic.context.thread_hash, "thread_hash");
  assert.equal(JSON.stringify(plan).includes("private"), false);

  const healthy = diagnostics.threadDetailResponseDiagnosticEffects({
    slowPlan: {
      shouldReport: false,
      reason: "below-threshold",
    },
    slowSuccessInput: {
      action: "thread-detail-load",
      threadHash: "thread/hash",
      readMode: "projection-v4-dynamic",
      renderMode: "first-paint",
    },
    contractPlan: {
      shouldReport: false,
      reason: "ok",
      action: "thread-detail-load",
      threadHash: "thread/hash",
      readMode: "projection-v4-dynamic",
      renderMode: "first-paint",
    },
  });
  assert.deepEqual(healthy.effects.map((effect) => [effect.type, effect.diagnosticType, effect.reason]), [
    ["diagnostic-success", "thread_detail_slow_path", "thread-detail-slow-path-ok"],
    ["diagnostic-success", "thread_detail_response_contract_mismatch", "thread-detail-response-contract-ok"],
  ]);
  assert.equal(healthy.effects[0].diagnostic.context.read_mode, "projection-v4-dynamic");
  assert.equal(healthy.effects[1].diagnostic.context.read_mode, "projection-v4-dynamic");

  assert.deepEqual(diagnostics.threadDetailResponseDiagnosticEffects(), {
    effects: [],
    reason: "no-diagnostic-plans",
  });
});
