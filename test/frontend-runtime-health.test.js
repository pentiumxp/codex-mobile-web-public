"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const health = require(path.resolve(__dirname, "..", "public", "frontend-runtime-health.js"));

test("submitted message probe ignores early and unrelated samples", () => {
  assert.deepEqual(health.submittedMessageDomProbeEffects({
    elapsedMs: 100,
    currentThreadMatch: true,
    hasThreadSubmission: true,
    domHasSubmission: false,
  }), { effects: [], reason: "too-early" });

  assert.deepEqual(health.submittedMessageDomProbeEffects({
    elapsedMs: 400,
    currentThreadMatch: false,
    hasThreadSubmission: true,
    domHasSubmission: false,
  }), { effects: [], reason: "different-thread" });
});

test("submitted message probe reports bounded DOM-missing diagnostics", () => {
  const plan = health.submittedMessageDomProbeEffects({
    elapsedMs: 600,
    action: "message-submit",
    routeKind: "thread-detail",
    threadHash: "h_thread",
    itemHash: "h_submission",
    currentThreadMatch: true,
    hasThreadSubmission: true,
    domHasSubmission: false,
    visibleCount: 5,
    domCount: 2,
    composerBusy: true,
    text: "private message body",
    prompt: "private prompt",
    token: "secret-token",
  });

  assert.equal(plan.reason, "submitted-message-dom-missing");
  assert.equal(plan.effects.length, 1);
  assert.equal(plan.effects[0].type, "diagnostic-failure");
  const event = plan.effects[0].diagnostic;
  assert.equal(event.category, "frontend_runtime_mismatch");
  assert.equal(event.diagnostic_type, "submitted_message_dom_missing");
  assert.equal(event.error_code, "submitted_message_dom_missing");
  assert.equal(event.context.surface, "user-operation");
  assert.equal(event.context.action, "message-submit");
  assert.equal(event.context.thread_hash, "h_thread");
  assert.equal(event.context.item_hash, "h_submission");
  assert.equal(event.counts.current_thread_match, 1);
  assert.equal(event.counts.has_thread_submission, 1);
  assert.equal(event.counts.dom_has_submission, 0);
  assert.equal(JSON.stringify(event).includes("private"), false);
  assert.equal(JSON.stringify(event).includes("secret"), false);
});

test("submitted message probe clears the signature when the DOM is healthy", () => {
  const plan = health.submittedMessageDomProbeEffects({
    elapsedMs: 600,
    currentThreadMatch: true,
    hasThreadSubmission: true,
    domHasSubmission: true,
    threadHash: "h_thread",
    itemHash: "h_submission",
  });

  assert.equal(plan.reason, "submitted-message-dom-present");
  assert.equal(plan.effects.length, 1);
  assert.equal(plan.effects[0].type, "diagnostic-success");
  assert.equal(plan.effects[0].diagnostic.category, "frontend_runtime_mismatch");
  assert.equal(plan.effects[0].diagnostic.diagnostic_type, "submitted_message_dom_missing");
});

test("submitted message probe requests render when submitted user DOM is duplicated", () => {
  const plan = health.submittedMessageDomProbeEffects({
    elapsedMs: 2800,
    action: "message-submit",
    routeKind: "thread-detail",
    threadHash: "h_thread",
    itemHash: "h_submission",
    currentThreadMatch: true,
    hasThreadSubmission: true,
    domHasSubmission: true,
    visibleCount: 10,
    domCount: 10,
    duplicateUserMessageCount: 1,
    expectedDuplicateUserMessageCount: 0,
    text: "private message body",
    token: "secret-token",
  });

  assert.equal(plan.reason, "submitted-message-dom-duplicate");
  assert.equal(plan.effects.length, 2);
  assert.equal(plan.effects[0].type, "diagnostic-failure");
  assert.equal(plan.effects[0].diagnosticType, "submitted_message_dom_duplicate");
  assert.equal(plan.effects[0].diagnostic.error_code, "submitted_message_dom_duplicate");
  assert.equal(plan.effects[0].diagnostic.counts.duplicate_user_message_count, 1);
  assert.equal(plan.effects[0].diagnostic.counts.expected_duplicate_user_message_count, 0);
  assert.equal(JSON.stringify(plan.effects[0].diagnostic).includes("private"), false);
  assert.equal(JSON.stringify(plan.effects[0].diagnostic).includes("secret"), false);
  assert.deepEqual(plan.effects[1], {
    type: "render-current-thread",
    reason: "submitted-message-dom-duplicate",
    stickToBottom: true,
  });
});

test("render monitor reports DOM drops from non-empty detail to sparse DOM", () => {
  let now = 1000;
  const monitor = health.createMonitor({ now: () => now, windowMs: 5000 });
  const plan = monitor.recordRender({
    action: "single-thread-render",
    routeKind: "thread-detail",
    threadHash: "h_thread",
    readMode: "projection-cache",
    renderMode: "set-inner-html",
    previousCount: 4,
    visibleCount: 5,
    domCount: 1,
    renderElapsedMs: 42,
  });

  assert.equal(plan.effects.some((effect) => effect.diagnosticType === "render_dom_drop"), true);
  const event = plan.effects.find((effect) => effect.diagnosticType === "render_dom_drop").diagnostic;
  assert.equal(event.category, "frontend_runtime_mismatch");
  assert.equal(event.error_code, "render_dom_drop");
  assert.equal(event.counts.previous_count, 4);
  assert.equal(event.counts.dom_count, 1);

  now += 100;
  const stable = monitor.recordRender({
    routeKind: "thread-detail",
    threadHash: "h_thread",
    renderMode: "patch-html",
    previousCount: 4,
    visibleCount: 5,
    domCount: 5,
  });
  assert.equal(stable.effects.some((effect) => effect.type === "diagnostic-success" && effect.diagnosticType === "render_dom_drop"), true);
});

test("render monitor reports early shell drops even before visible count is known", () => {
  const monitor = health.createMonitor({ now: () => 1000, windowMs: 5000 });
  const plan = monitor.recordRender({
    action: "single-thread-early-shell",
    routeKind: "thread-detail",
    threadHash: "h_thread",
    renderMode: "set-inner-html",
    renderPlanReason: "signature-changed",
    sameThreadRender: true,
    previousCount: 12,
    visibleCount: 0,
    domCount: 1,
    renderElapsedMs: 7,
  });

  const drop = plan.effects.find((effect) => effect.diagnosticType === "render_dom_drop");
  assert.ok(drop);
  assert.equal(drop.type, "diagnostic-failure");
  assert.equal(drop.diagnostic.error_code, "render_dom_drop");
  assert.equal(drop.diagnostic.counts.previous_count, 12);
  assert.equal(drop.diagnostic.counts.visible_count, 0);
});

test("render monitor ignores cross-thread early shell drops", () => {
  const monitor = health.createMonitor({ now: () => 1000, windowMs: 5000 });
  const plan = monitor.recordRender({
    action: "single-thread-early-shell",
    routeKind: "thread-detail",
    threadHash: "h_next_thread",
    previousRenderedThreadHash: "h_previous_thread",
    sameThreadRender: false,
    renderMode: "set-inner-html",
    renderPlanReason: "signature-changed",
    previousCount: 12,
    visibleCount: 0,
    domCount: 1,
    renderElapsedMs: 7,
  });

  assert.equal(plan.effects.some((effect) => effect.diagnosticType === "render_dom_drop" && effect.type === "diagnostic-failure"), false);
});

test("render monitor reports repeated fallback/full-render churn", () => {
  let now = 1000;
  const monitor = health.createMonitor({ now: () => now, windowMs: 5000, fallbackThreshold: 2, fullRenderThreshold: 3 });

  let plan = monitor.recordRender({
    renderMode: "patch-html",
    fallbackApplied: true,
    previousCount: 3,
    visibleCount: 3,
    domCount: 3,
    patchRejectReason: "post-apply-duplicate-render-keys",
  });
  assert.equal(plan.effects.some((effect) => effect.diagnosticType === "render_churn" && effect.type === "diagnostic-failure"), false);

  now += 100;
  plan = monitor.recordRender({
    renderMode: "patch-html",
    fallbackApplied: true,
    previousCount: 3,
    visibleCount: 3,
    domCount: 3,
    patchRejectReason: "post-apply-duplicate-render-keys",
  });
  const churn = plan.effects.find((effect) => effect.diagnosticType === "render_churn" && effect.type === "diagnostic-failure");
  assert.ok(churn);
  assert.equal(churn.diagnostic.error_code, "render_patch_fallback_churn");
  assert.equal(churn.diagnostic.counts.fallback_count, 2);
});

test("render monitor emits stable success for patch renders without duplicates", () => {
  const monitor = health.createMonitor({ now: () => 1000, windowMs: 5000 });
  const plan = monitor.recordRender({
    renderMode: "patch-html",
    previousCount: 3,
    visibleCount: 3,
    domCount: 3,
    duplicateCount: 0,
  });

  assert.equal(plan.effects.some((effect) => effect.type === "diagnostic-success" && effect.diagnosticType === "render_churn"), true);
});

test("thread list runtime stall ignores invisible and below-threshold samples", () => {
  assert.deepEqual(health.threadListInteractionStallEffects({
    threadListVisible: false,
    maxRafDelayMs: 6000,
  }), { effects: [], reason: "thread-list-not-visible" });

  assert.deepEqual(health.threadListInteractionStallEffects({
    threadListVisible: true,
    maxRafDelayMs: 240,
    maxScrollApplyMs: 260,
    maxLongTaskMs: 0,
  }), { effects: [], reason: "below-threshold" });
});

test("thread list runtime stall keeps passive heartbeat pauses advisory", () => {
  const plan = health.threadListInteractionStallEffects({
    threadListVisible: true,
    threadListMonitorable: true,
    action: "thread-list-heartbeat",
    routeKind: "embedded-primary",
    maxRafDelayMs: 11155,
    elapsedMs: 11155,
    threadListCount: 24,
  });

  assert.equal(plan.reason, "thread-list-interaction-stall");
  assert.equal(plan.effects.length, 1);
  const event = plan.effects[0].diagnostic;
  assert.equal(event.severity_hint, "H3");
  assert.equal(event.error_code, "browser_thread_list_runtime_heartbeat_delayed");
  assert.equal(event.counts.passive_heartbeat, 1);
  assert.equal(event.counts.recent_thread_list_input, 0);
  assert.equal(event.counts.thread_list_visible, 1);
  assert.equal(event.counts.thread_list_monitorable, 1);
});

test("thread list runtime stall can report monitorable recent-input list stalls", () => {
  const plan = health.threadListInteractionStallEffects({
    threadListVisible: false,
    threadListMonitorable: true,
    action: "thread-list-heartbeat",
    routeKind: "embedded-primary",
    recentThreadListInput: true,
    recentInputAgeMs: 450,
    maxRafDelayMs: 5100,
    elapsedMs: 5100,
    threadListCount: 24,
  });

  assert.equal(plan.reason, "thread-list-interaction-stall");
  assert.equal(plan.effects.length, 1);
  const event = plan.effects[0].diagnostic;
  assert.equal(event.severity_hint, "H2");
  assert.equal(event.error_code, "browser_thread_list_interaction_blocked");
  assert.equal(event.counts.recent_thread_list_input, 1);
  assert.equal(event.counts.recent_input_age_ms, 450);
  assert.equal(event.counts.thread_list_visible, 0);
  assert.equal(event.counts.thread_list_monitorable, 1);
  assert.equal(JSON.stringify(event).includes("embedded-primary"), true);
});

test("thread list runtime stall reports bounded metadata only", () => {
  const plan = health.threadListInteractionStallEffects({
    threadListVisible: true,
    action: "thread-list-scroll",
    routeKind: "embedded-primary",
    maxRafDelayMs: 4200,
    maxScrollApplyMs: 4180,
    maxLongTaskMs: 0,
    elapsedMs: 4210,
    longTaskCount: 0,
    threadListCount: 42,
    scrollTop: 120,
    scrollHeight: 3200,
    title: "private thread title",
    message: "private message",
    url: "https://secret.example/path?token=x",
  });

  assert.equal(plan.reason, "thread-list-interaction-stall");
  assert.equal(plan.effects.length, 1);
  const event = plan.effects[0].diagnostic;
  assert.equal(event.category, "frontend_runtime_mismatch");
  assert.equal(event.diagnostic_type, "thread_list_interaction_stall");
  assert.equal(event.severity_hint, "H2");
  assert.equal(event.error_code, "browser_thread_list_interaction_blocked");
  assert.equal(event.context.surface, "thread-list-runtime");
  assert.equal(event.context.action, "thread-list-scroll");
  assert.equal(event.context.route_kind, "embedded-primary");
  assert.equal(event.counts.raf_delay_ms, 4200);
  assert.equal(event.counts.thread_list_count, 42);
  assert.equal(event.counts.thread_list_visible, 1);
  assert.equal(event.counts.thread_list_monitorable, 0);
  assert.equal(JSON.stringify(event).includes("private"), false);
  assert.equal(JSON.stringify(event).includes("secret"), false);
});

test("thread list runtime stall reports long task as advisory below H2 threshold", () => {
  const plan = health.threadListInteractionStallEffects({
    threadListVisible: true,
    action: "thread-list-heartbeat",
    maxRafDelayMs: 0,
    maxScrollApplyMs: 0,
    maxLongTaskMs: 1400,
    longTaskCount: 1,
    threadListCount: 12,
  });

  const event = plan.effects[0].diagnostic;
  assert.equal(event.severity_hint, "H3");
  assert.equal(event.error_code, "browser_main_thread_long_task");
  assert.equal(event.counts.long_task_count, 1);
});
