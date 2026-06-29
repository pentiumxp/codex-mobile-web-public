"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  classifyRuntimeSelfCheckGate,
  isSlowPathIssue,
  normalizeIssue,
} = require("../adapters/runtime-self-check-gate-service");

test("runtime self-check gate treats slow success diagnostics as observe-only", () => {
  const gate = classifyRuntimeSelfCheckGate({
    mode: "deploy",
    checks: [{
      name: "browser-runtime",
      ok: false,
      issues: [{
        severity: "H2",
        code: "thread_detail_slow_path",
        category: "thread_session_slow_path",
        diagnostic_type: "thread_detail_slow_path",
      }],
    }],
  });

  assert.equal(gate.ok, true);
  assert.equal(gate.deployPass, true);
  assert.equal(gate.reportableIssueCount, 0);
  assert.equal(gate.observeOnlyIssueCount, 1);
  assert.deepEqual(gate.observeOnlyIssueCodes, ["thread_detail_slow_path"]);
});

test("runtime self-check gate blocks deploys for user-visible projection regressions", () => {
  const gate = classifyRuntimeSelfCheckGate({
    mode: "deploy",
    checks: [{
      name: "browser-runtime",
      ok: false,
      issues: [{
        severity: "H2",
        code: "browser_latest_turn_user_message_below_api_expectation",
        threadHash: "bounded-thread-hash",
      }],
    }],
  });

  assert.equal(gate.ok, false);
  assert.equal(gate.deployPass, false);
  assert.equal(gate.reportableIssueCount, 1);
  assert.deepEqual(gate.actionableIssueCodes, ["browser_latest_turn_user_message_below_api_expectation"]);
});

test("runtime self-check gate blocks child execution failures", () => {
  const gate = classifyRuntimeSelfCheckGate({
    checks: [{
      name: "api-thread",
      ok: false,
      errorCode: "spawn_timeout_with_private_path_removed",
      issues: [],
    }],
  });

  assert.equal(gate.ok, false);
  assert.equal(gate.executionFailureCount, 1);
  assert.equal(gate.reportableIssueCount, 1);
  assert.deepEqual(gate.actionableIssueCodes, ["spawn_timeout_with_private_path_removed"]);
});

test("runtime self-check gate normalizes diagnostic candidates without private content", () => {
  const gate = classifyRuntimeSelfCheckGate({
    checks: [{
      name: "api-thread",
      ok: false,
      diagnosticCandidates: [{
        category: "conversation_projection_mismatch",
        diagnostic_type: "thread_detail_response_contract_mismatch",
        error_code: "active-thread-window-downgrade",
        severity_hint: "H2",
        context: { thread_title: "private title should not appear" },
      }],
    }],
  });

  const serialized = JSON.stringify(gate);
  assert.equal(gate.ok, false);
  assert.deepEqual(gate.reportableIssueCodes, ["active-thread-window-downgrade"]);
  assert.doesNotMatch(serialized, /private title/i);
});

test("runtime self-check slow-path classification is explicit", () => {
  assert.equal(isSlowPathIssue({ category: "thread_session_slow_path", diagnostic_type: "thread_list_slow_path" }), true);
  assert.equal(isSlowPathIssue({ code: "browser_image_render_failed" }), false);
  assert.equal(normalizeIssue({ code: "browser image render failed", severity: "H2" }).code, "browser_image_render_failed");
});
