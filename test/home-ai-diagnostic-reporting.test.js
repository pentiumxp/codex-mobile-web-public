"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const diagnostics = require(path.resolve(__dirname, "..", "public", "home-ai-diagnostic-reporting.js"));

function taskCardFailure(extra = {}) {
  return Object.assign({
    category: "task_card_workflow_failed",
    diagnostic_type: "task_card_creation_failed",
    error_code: "http_500",
    severity_hint: "H2",
    evidence_confidence: 0.77,
    context: {
      surface: "task-card",
      action: "create",
      thread_hash: diagnostics.hashIdentifier("thread-123"),
      task_hash: diagnostics.hashIdentifier("ttc-123"),
      build_id: "0.1.11|codex-mobile-shell-v446",
      route: "/?thread=raw-thread-123&token=secret",
      title: "private task title",
    },
    counts: {
      retry_count: 1,
      raw_message_chars: 9000,
    },
    breadcrumbs: [{
      kind: "task-card",
      code: "create",
      status: "failed",
      fields: {
        status_code: 500,
        prompt: "private prompt",
        task_hash: diagnostics.hashIdentifier("ttc-123"),
      },
    }],
  }, extra);
}

test("repeated task-card failure reports exactly once at threshold", () => {
  let now = 1000;
  const reporter = diagnostics.createDiagnosticReporter({ threshold: 3, throttleMs: 60000, now: () => now });

  assert.equal(reporter.recordFailure(taskCardFailure()).eligible, false);
  assert.equal(reporter.recordFailure(taskCardFailure()).eligible, false);
  const third = reporter.recordFailure(taskCardFailure());
  assert.equal(third.eligible, true);
  assert.equal(third.repeatedFailures, 3);
  assert.equal(third.report.type, "homeai.diagnostic.report");
  assert.equal(third.report.pluginId, "codex-mobile");
  assert.equal(third.report.counts.repeated_failures, 3);

  now += 1000;
  const fourth = reporter.recordFailure(taskCardFailure());
  assert.equal(fourth.eligible, false);
  assert.equal(fourth.report, null);
});

test("single transient route failure does not report and success clears count", () => {
  const reporter = diagnostics.createDiagnosticReporter({ threshold: 3, throttleMs: 60000, now: () => 1 });
  const routeFailure = {
    category: "thread_session_load_failed",
    diagnostic_type: "route_hint_target_missing",
    error_code: "route_hint_missing_target",
    context: {
      surface: "thread-session",
      action: "route-hint-open",
      route_kind: "plugin-route",
      item_hash: diagnostics.hashIdentifier("private-item"),
    },
  };

  assert.equal(reporter.recordFailure(routeFailure).eligible, false);
  assert.equal(reporter.failureCount(routeFailure), 1);
  assert.equal(reporter.recordSuccess(routeFailure).cleared, 1);
  assert.equal(reporter.failureCount(routeFailure), 0);
  assert.equal(reporter.recordFailure(routeFailure).eligible, false);
});

test("repeated thread route failure creates bounded diagnostic report", () => {
  const reporter = diagnostics.createDiagnosticReporter({ threshold: 2, throttleMs: 60000, now: () => 1 });
  const input = {
    category: "thread_session_load_failed",
    diagnostic_type: "route_hint_thread_unavailable",
    error_code: "http_404",
    context: {
      surface: "thread-session",
      action: "route-hint-open",
      route_kind: "plugin-route",
      thread_hash: diagnostics.hashIdentifier("thread-secret"),
      build_id: "0.1.11|codex-mobile-shell-v446",
    },
    counts: { retry_count: 2 },
  };

  reporter.recordFailure(input);
  const result = reporter.recordFailure(input);
  assert.equal(result.eligible, true);
  assert.equal(result.report.category, "thread_session_load_failed");
  assert.equal(result.report.diagnostic_type, "route_hint_thread_unavailable");
  assert.equal(result.report.context.thread_hash.startsWith("h_"), true);
  assert.equal(result.report.context.route_kind, "plugin-route");
});

test("slow-path failures aggregate across build and render mode changes", () => {
  const reporter = diagnostics.createDiagnosticReporter({ threshold: 3, throttleMs: 60000, now: () => 1 });
  const base = {
    category: "thread_session_slow_path",
    diagnostic_type: "thread_detail_slow_path",
    error_code: "api-slow",
    severity_hint: "H3",
    evidence_confidence: 0.7,
    context: {
      surface: "thread-session",
      action: "thread-detail-load",
      thread_hash: diagnostics.hashIdentifier("thread-secret"),
      read_mode: "turns-list-initial",
      render_mode: "first-paint",
      build_id: "0.1.11|codex-mobile-shell-v556",
      cold_path_owner: "app-server",
      cold_path_reason: "cold-turns-list-initial",
    },
    counts: {
      elapsed_ms: 2100,
      api_elapsed_ms: 1900,
      threshold_ms: 1500,
    },
    breadcrumbs: [{
      kind: "thread-session",
      code: "thread-detail-slow-path",
      status: "slow",
      fields: {
        read_mode: "turns-list-initial",
        render_mode: "first-paint",
        cold_path_owner: "app-server",
        cold_path_reason: "cold-turns-list-initial",
        elapsed_ms: 2100,
        api_elapsed_ms: 1900,
        threshold_ms: 1500,
      },
    }],
  };

  assert.equal(reporter.recordFailure(base).eligible, false);
  assert.equal(reporter.recordFailure(Object.assign({}, base, {
    context: Object.assign({}, base.context, {
      read_mode: "projection-active-overlay",
      render_mode: "full-render",
      build_id: "0.1.11|codex-mobile-shell-v557",
    }),
  })).eligible, false);
  const third = reporter.recordFailure(Object.assign({}, base, {
    context: Object.assign({}, base.context, {
      read_mode: "projection-v4-dynamic",
      render_mode: "metadata-only",
      build_id: "0.1.11|codex-mobile-shell-v558",
    }),
  }));

  assert.equal(third.eligible, true);
  assert.equal(third.repeatedFailures, 3);
  assert.match(third.signature, /thread_session_slow_path\\|thread_detail_slow_path/);
  assert.doesNotMatch(third.signature, /shell-v55|projection|first-paint|full-render|metadata-only/);
  assert.equal(third.report.context.build_id, "0.1.11_codex-mobile-shell-v558");
  assert.equal(third.report.context.read_mode, "projection-v4-dynamic");
  assert.equal(third.report.context.render_mode, "metadata-only");
  assert.equal(third.report.context.cold_path_owner, "app-server");
  assert.equal(third.report.context.cold_path_reason, "cold-turns-list-initial");
  assert.equal(third.report.breadcrumbs[0].fields.cold_path_owner, "app-server");
});

test("repeated projection mismatch reports at threshold and success clears", () => {
  let now = 1000;
  const reporter = diagnostics.createDiagnosticReporter({ threshold: 3, throttleMs: 60000, now: () => now });
  const input = {
    category: "conversation_projection_mismatch",
    diagnostic_type: "render_signature_mismatch",
    error_code: "render_signature_mismatch",
    context: {
      surface: "conversation-render",
      action: "single-thread-render",
      route_kind: "single-thread",
      read_mode: "projection-active-overlay",
      render_mode: "set-inner-html",
      thread_hash: diagnostics.hashIdentifier("thread-secret"),
      build_id: "0.1.11|codex-mobile-shell-v551",
      title: "private title stripped",
    },
    counts: {
      dom_count: 8,
      visible_count: 10,
      turn_count: 5,
      raw_message_chars: 9000,
    },
    breadcrumbs: [{
      kind: "conversation-render",
      code: "signature-check",
      status: "failed",
      fields: {
        read_mode: "projection-active-overlay",
        render_mode: "set-inner-html",
        dom_count: 8,
        visible_count: 10,
        message: "private message stripped",
      },
    }],
  };

  assert.equal(reporter.recordFailure(input).eligible, false);
  assert.equal(reporter.recordFailure(input).eligible, false);
  const third = reporter.recordFailure(input);
  assert.equal(third.eligible, true);
  assert.equal(third.report.category, "conversation_projection_mismatch");
  assert.equal(third.report.diagnostic_type, "render_signature_mismatch");
  assert.equal(third.report.counts.repeated_failures, 3);
  assert.equal(third.report.context.render_mode, "set-inner-html");
  assert.equal(third.report.context.thread_hash.startsWith("h_"), true);
  assert.doesNotMatch(JSON.stringify(third.report), /thread-secret|private title|private message|raw_message_chars/);

  assert.equal(reporter.recordSuccess({
    category: "conversation_projection_mismatch",
    diagnostic_type: "render_signature_mismatch",
    error_code: "render_signature_mismatch",
    context: input.context,
  }).cleared, 1);
  assert.equal(reporter.failureCount(input), 0);
  now += 1;
  assert.equal(reporter.recordFailure(input).eligible, false);
});

test("report payload strips unsafe private fields", () => {
  const event = diagnostics.sanitizeInput(taskCardFailure({
    body: "raw body",
    rawPrompt: "raw prompt",
    context: {
      surface: "task-card",
      action: "reply",
      thread_hash: diagnostics.hashIdentifier("thread-secret"),
      raw_thread_id: "thread-secret",
      url: "https://example.invalid/private?token=secret",
      cookie: "cookie=value",
      access_key: "key",
      route_kind: "thread-detail",
    },
    breadcrumbs: [{
      kind: "task-card",
      code: "reply",
      status: "failed",
      fields: {
        thread_hash: diagnostics.hashIdentifier("thread-secret"),
        text: "private text",
        path: "/Users/private/upload.jpg",
        status_code: 403,
      },
    }],
  }));
  const json = JSON.stringify(event);

  assert.doesNotMatch(json, /raw body|raw prompt|thread-secret|private text|upload\.jpg|cookie=value|access_key|token=secret/);
  assert.equal(event.context.surface, "task-card");
  assert.equal(event.context.route_kind, "thread-detail");
  assert.equal(event.breadcrumbs[0].fields.status_code, 403);
  assert.match(event.context.thread_hash, /^h_/);
});

test("report payload preserves bounded render reason codes", () => {
  const event = diagnostics.sanitizeInput({
    category: "conversation_projection_mismatch",
    diagnostic_type: "detail_patch_rejected",
    error_code: "detail_patch_rejected",
    context: {
      surface: "conversation-render",
      action: "thread-detail-refresh",
      read_mode: "projection-cache",
      render_mode: "patch",
      render_plan_reason: "signature-changed",
      patch_reject_reason: "rendered-dom-stale",
      message: "private message stripped",
      raw_path: "/Users/private/upload.jpg",
    },
    counts: {
      previous_count: 5,
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
        previous_count: 5,
        visible_count: 6,
        prompt: "private prompt stripped",
      },
    }],
  });
  const json = JSON.stringify(event);

  assert.equal(event.context.render_plan_reason, "signature-changed");
  assert.equal(event.context.patch_reject_reason, "rendered-dom-stale");
  assert.equal(event.breadcrumbs[0].fields.render_plan_reason, "signature-changed");
  assert.equal(event.breadcrumbs[0].fields.patch_reject_reason, "rendered-dom-stale");
  assert.equal(event.breadcrumbs[0].fields.previous_count, 5);
  assert.equal(event.breadcrumbs[0].fields.visible_count, 6);
  assert.doesNotMatch(json, /private message|private prompt|upload\.jpg/);
});

test("report payload preserves bounded thread detail contract fields", () => {
  const event = diagnostics.sanitizeInput({
    category: "conversation_projection_mismatch",
    diagnostic_type: "thread_detail_response_contract_mismatch",
    error_code: "empty-projection-shell",
    context: {
      surface: "thread-session",
      action: "thread-detail-load",
      thread_hash: diagnostics.hashIdentifier("thread-secret"),
      read_mode: "projection-v4-partial",
      render_mode: "first-paint",
      performance_phase: "warm-projection-partial",
      projection_source: "partial",
      projection_partial_kind: "notification-shell",
      title: "private title stripped",
      path: "/Users/private/upload.jpg",
    },
    counts: {
      turn_count: 1,
      item_count: 0,
      visible_count: 0,
      active_turn_count: 0,
      completed_turn_count: 1,
      omitted_turns: 0,
      older_cursor: 0,
      newer_cursor: 0,
      projection_partial: 1,
    },
    breadcrumbs: [{
      kind: "thread-session",
      code: "thread-detail-response-contract",
      status: "failed",
      fields: {
        thread_hash: diagnostics.hashIdentifier("thread-secret"),
        read_mode: "projection-v4-partial",
        performance_phase: "warm-projection-partial",
        projection_source: "partial",
        projection_partial_kind: "notification-shell",
        turn_count: 1,
        item_count: 0,
        visible_count: 0,
        active_turn_count: 0,
        older_cursor: 0,
        newer_cursor: 0,
        projection_partial: 1,
        body: "private body stripped",
      },
    }],
  });
  const json = JSON.stringify(event);

  assert.equal(event.context.projection_source, "partial");
  assert.equal(event.context.projection_partial_kind, "notification-shell");
  assert.equal(event.context.performance_phase, "warm-projection-partial");
  assert.equal(event.counts.item_count, 0);
  assert.equal(event.counts.projection_partial, 1);
  assert.equal(event.breadcrumbs[0].fields.projection_source, "partial");
  assert.equal(event.breadcrumbs[0].fields.item_count, 0);
  assert.equal(event.breadcrumbs[0].fields.projection_partial, 1);
  assert.doesNotMatch(json, /private title|private body|upload\.jpg|thread-secret/);
});

test("report payload preserves primary shell conflict metadata without private content", () => {
  const event = diagnostics.sanitizeInput({
    category: "conversation_projection_mismatch",
    diagnostic_type: "primary_shell_selection_conflict",
    error_code: "primary_shell_render_after_detail",
    context: {
      surface: "conversation-render",
      action: "primary-shell-selection",
      route_kind: "embedded-primary",
      read_mode: "projection-v4-dynamic",
      render_mode: "primary-shell",
      source_kind: "restore-empty",
      thread_hash: diagnostics.hashIdentifier("thread-secret"),
      title: "private title stripped",
      path: "/Users/private/session.jsonl",
      url: "https://example.invalid/private?token=secret",
    },
    counts: {
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
      raw_message_chars: 9000,
    },
    breadcrumbs: [{
      kind: "conversation-render",
      code: "primary-shell-selection",
      status: "failed",
      fields: {
        read_mode: "projection-v4-dynamic",
        render_mode: "primary-shell",
        source_kind: "restore-empty",
        thread_hash: diagnostics.hashIdentifier("thread-secret"),
        dom_count: 1,
        visible_count: 34,
        turn_count: 10,
        item_count: 39,
        previous_count: 13,
        message: "private message stripped",
      },
    }],
  });
  const json = JSON.stringify(event);

  assert.equal(event.context.route_kind, "embedded-primary");
  assert.equal(event.context.source_kind, "restore-empty");
  assert.equal(event.counts.has_thread_load_controller, 1);
  assert.equal(event.counts.startup_thread_open_pending, 1);
  assert.equal(event.counts.recent_detail_age_ms, 1200);
  assert.equal(event.breadcrumbs[0].fields.source_kind, "restore-empty");
  assert.equal(event.breadcrumbs[0].fields.previous_count, 13);
  assert.doesNotMatch(json, /private title|private message|session\.jsonl|thread-secret|token=secret|raw_message_chars/);
});

test("report payload preserves empty visible detail mismatch metadata without private content", () => {
  const event = diagnostics.sanitizeInput({
    category: "conversation_projection_mismatch",
    diagnostic_type: "empty_visible_detail_mismatch",
    error_code: "empty_render_after_nonempty_detail",
    context: {
      surface: "conversation-render",
      action: "single-thread-empty-state",
      route_kind: "single-thread",
      read_mode: "projection-v4-dynamic",
      render_mode: "full-render",
      source_kind: "first-paint-detail-api",
      thread_hash: diagnostics.hashIdentifier("thread-secret"),
      title: "private title stripped",
      url: "https://example.invalid/private?token=secret",
    },
    counts: {
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
      raw_message_chars: 9000,
    },
    breadcrumbs: [{
      kind: "conversation-render",
      code: "empty-state-contract",
      status: "failed",
      fields: {
        read_mode: "projection-v4-dynamic",
        render_mode: "full-render",
        source_kind: "first-paint-detail-api",
        thread_hash: diagnostics.hashIdentifier("thread-secret"),
        visible_count: 34,
        turn_count: 10,
        item_count: 39,
        dom_count: 2,
        previous_count: 11,
        message: "private message stripped",
      },
    }],
  });
  const json = JSON.stringify(event);

  assert.equal(event.context.route_kind, "single-thread");
  assert.equal(event.context.source_kind, "first-paint-detail-api");
  assert.equal(event.counts.current_visible_count, 0);
  assert.equal(event.counts.current_turn_count, 0);
  assert.equal(event.counts.detail_loaded, 1);
  assert.equal(event.counts.recent_detail_age_ms, 900);
  assert.equal(event.breadcrumbs[0].fields.source_kind, "first-paint-detail-api");
  assert.equal(event.breadcrumbs[0].fields.previous_count, 11);
  assert.doesNotMatch(json, /private title|private message|thread-secret|token=secret|raw_message_chars/);
});

test("postMessage delivery fails safely outside trusted embedded contexts", () => {
  const report = {
    type: "homeai.diagnostic.report",
    pluginId: "codex-mobile",
  };
  assert.deepEqual(
    diagnostics.postReportToHomeAi({ report, embedded: false, parentWindow: { postMessage() {} } }),
    { ok: false, reason: "not_embedded" },
  );
  const sameWindow = {};
  assert.deepEqual(
    diagnostics.postReportToHomeAi({ report, embedded: true, parentWindow: sameWindow, selfWindow: sameWindow }),
    { ok: false, reason: "missing_parent" },
  );
  assert.deepEqual(
    diagnostics.postReportToHomeAi({
      report,
      embedded: true,
      parentWindow: { postMessage() { throw new Error("blocked"); } },
    }),
    { ok: false, reason: "post_failed" },
  );
});
