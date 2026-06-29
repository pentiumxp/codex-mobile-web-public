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
