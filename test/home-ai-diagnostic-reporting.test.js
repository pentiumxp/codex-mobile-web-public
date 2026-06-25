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
      build_id: "0.1.11|codex-mobile-shell-v440",
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
      build_id: "0.1.11|codex-mobile-shell-v440",
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
