"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const service = require("../services/runtime/runtime-job-scheduler-service");
const adapter = require("../adapters/runtime-job-scheduler-service");

test("runtime job scheduler adapter remains a compatibility wrapper", () => {
  assert.equal(adapter.resolveRuntimeSelfCheckPlan, service.resolveRuntimeSelfCheckPlan);
  assert.equal(adapter.RUNTIME_SELF_CHECK_JOBS, service.RUNTIME_SELF_CHECK_JOBS);
  assert.equal(adapter.RUNTIME_PREWARM_JOBS, service.RUNTIME_PREWARM_JOBS);
  assert.equal(adapter.RUNTIME_DIAGNOSTIC_JOBS, service.RUNTIME_DIAGNOSTIC_JOBS);
  assert.equal(adapter.RUNTIME_JOB_REGISTRY, service.RUNTIME_JOB_REGISTRY);
});

test("runtime job registry declares production scheduling budgets", () => {
  for (const name of service.RUNTIME_JOB_ORDER) {
    const job = service.runtimeJobDeclaration(name);
    assert.equal(job.name, name);
    assert.equal(typeof job.periodicAllowed, "boolean");
    assert.equal(typeof job.maxConcurrency, "number");
    assert.ok(job.maxConcurrency >= 1);
    assert.equal(typeof job.timeBudgetMs, "number");
    assert.ok(job.timeBudgetMs > 0);
    assert.equal(typeof job.timeoutMs, "number");
    assert.equal(job.timeoutMs, job.timeBudgetMs);
    assert.match(job.cpuBudgetClass, /^(low|medium|high)$/);
    assert.equal(typeof job.realBrowserAllowed, "boolean");
    assert.equal(job.usesBrowser, job.realBrowserAllowed);
    assert.equal(typeof job.userRequestPreemptible, "boolean");
    assert.equal(job.preemptibleByForeground, job.userRequestPreemptible);
  }
});

test("runtime job registry owns prewarm declarations", () => {
  assert.deepEqual(service.PREWARM_JOB_ORDER, [
    "thread-list-fallback-prewarm",
    "thread-detail-active-window-prewarm",
  ]);
  for (const name of service.PREWARM_JOB_ORDER) {
    const job = service.RUNTIME_PREWARM_JOBS[name];
    assert.equal(job, service.RUNTIME_JOB_REGISTRY[name]);
    assert.equal(job, service.runtimeJobDeclaration(name));
    assert.equal(job.periodicAllowed, false);
    assert.equal(job.deployDefaultEnabled, false);
    assert.equal(job.realBrowserAllowed, false);
    assert.equal(job.userRequestPreemptible, true);
    assert.equal(job.timeoutMs, 30000);
    assert.equal(job.cpuBudgetClass, "medium");
  }
});

test("runtime job registry owns manual diagnostic declarations", () => {
  assert.deepEqual(service.DIAGNOSTIC_JOB_ORDER, [
    "phase-b-readback-smoke",
    "thread-self-check",
    "projection-replay-visual-smoke",
    "media-render-visual-smoke",
    "image-order-visual-smoke",
    "pwa-shell-refresh-smoke",
    "empty-detail-cache-smoke",
  ]);

  for (const name of service.DIAGNOSTIC_JOB_ORDER) {
    const job = service.RUNTIME_DIAGNOSTIC_JOBS[name];
    assert.equal(job, service.RUNTIME_JOB_REGISTRY[name]);
    assert.equal(job, service.runtimeJobDeclaration(name));
    assert.equal(job.periodicAllowed, false);
    assert.equal(job.periodicDefaultEnabled, false);
    assert.equal(job.deployDefaultEnabled, false);
    assert.equal(job.maxConcurrency, 1);
    assert.equal(job.userRequestPreemptible, true);
    assert.ok(job.timeBudgetMs >= 60000);
  }

  assert.equal(service.RUNTIME_DIAGNOSTIC_JOBS["phase-b-readback-smoke"].realBrowserAllowed, false);
  assert.equal(service.RUNTIME_DIAGNOSTIC_JOBS["thread-self-check"].realBrowserAllowed, false);
  for (const name of [
    "projection-replay-visual-smoke",
    "media-render-visual-smoke",
    "image-order-visual-smoke",
    "pwa-shell-refresh-smoke",
    "empty-detail-cache-smoke",
  ]) {
    assert.equal(service.RUNTIME_DIAGNOSTIC_JOBS[name].realBrowserAllowed, true);
    assert.equal(service.RUNTIME_DIAGNOSTIC_JOBS[name].cpuBudgetClass, "high");
    assert.equal(service.RUNTIME_DIAGNOSTIC_JOBS[name].timeoutMs, 120000);
  }
});

test("runtime job scheduler keeps periodic checks lightweight by default", () => {
  const plan = service.resolveRuntimeSelfCheckPlan({ gateMode: "periodic" });

  assert.equal(plan.privacy, "metadata_only");
  assert.equal(plan.profile.browserMode, "off");
  assert.deepEqual(plan.enabledJobNames, ["api-thread", "client-events"]);
  assert.equal(service.runtimeSelfCheckJob(plan, "browser-runtime").enabled, false);
  assert.equal(service.runtimeSelfCheckJob(plan, "browser-runtime").reason, "browser_mode_off");
  assert.equal(service.runtimeSelfCheckJob(plan, "browser-runtime").realBrowserAllowed, true);
  assert.equal(service.runtimeSelfCheckJob(plan, "browser-runtime").periodicAllowed, true);
});

test("runtime job scheduler enables browser checks for deploy gates", () => {
  const plan = service.resolveRuntimeSelfCheckPlan({ gateMode: "deploy" });

  assert.equal(plan.profile.browserMode, "full");
  assert.deepEqual(plan.enabledJobNames, ["api-thread", "browser-runtime", "client-events"]);
  assert.equal(service.runtimeSelfCheckJob(plan, "browser-runtime").timeoutMs, service.DEFAULT_JOB_TIMEOUT_MS);
  assert.equal(service.runtimeSelfCheckJob(plan, "browser-runtime").timeBudgetMs, service.DEFAULT_JOB_TIMEOUT_MS);
  assert.equal(service.runtimeSelfCheckJob(plan, "browser-runtime").maxConcurrency, 1);
  assert.equal(service.runtimeSelfCheckJob(plan, "browser-runtime").usesBrowser, true);
  assert.equal(service.runtimeSelfCheckJob(plan, "browser-runtime").realBrowserAllowed, true);
  assert.equal(service.runtimeSelfCheckJob(plan, "browser-runtime").cpuBudgetClass, "high");
  assert.equal(service.runtimeSelfCheckJob(plan, "browser-runtime").userRequestPreemptible, true);
});

test("runtime job scheduler allows explicit periodic browser diagnostics", () => {
  const plan = service.resolveRuntimeSelfCheckPlan({
    gateMode: "periodic",
    browserMode: "full",
  });

  assert.equal(plan.profile.browserMode, "full");
  assert.deepEqual(plan.enabledJobNames, ["api-thread", "browser-runtime", "client-events"]);
});

test("runtime job scheduler distinguishes skip flags from budget policy", () => {
  const plan = service.resolveRuntimeSelfCheckPlan({
    gateMode: "deploy",
    skipBrowser: true,
    skipClientEvents: true,
  });

  assert.deepEqual(plan.enabledJobNames, ["api-thread"]);
  assert.equal(service.runtimeSelfCheckJob(plan, "browser-runtime").reason, "skip_flag");
  assert.equal(service.runtimeSelfCheckJob(plan, "client-events").reason, "skip_flag");
});

test("runtime job scheduler normalizes invalid modes to periodic safe defaults", () => {
  const plan = service.resolveRuntimeSelfCheckPlan({
    gateMode: "unexpected",
    browserMode: "unexpected",
  });

  assert.equal(plan.profile.gateMode, "periodic");
  assert.equal(plan.profile.browserMode, "off");
  assert.deepEqual(plan.enabledJobNames, ["api-thread", "client-events"]);
});
