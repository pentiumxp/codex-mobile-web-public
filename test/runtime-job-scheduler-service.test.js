"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const service = require("../adapters/runtime-job-scheduler-service");

test("runtime job scheduler keeps periodic checks lightweight by default", () => {
  const plan = service.resolveRuntimeSelfCheckPlan({ gateMode: "periodic" });

  assert.equal(plan.privacy, "metadata_only");
  assert.equal(plan.profile.browserMode, "off");
  assert.deepEqual(plan.enabledJobNames, ["api-thread", "client-events"]);
  assert.equal(service.runtimeSelfCheckJob(plan, "browser-runtime").enabled, false);
  assert.equal(service.runtimeSelfCheckJob(plan, "browser-runtime").reason, "browser_mode_off");
});

test("runtime job scheduler enables browser checks for deploy gates", () => {
  const plan = service.resolveRuntimeSelfCheckPlan({ gateMode: "deploy" });

  assert.equal(plan.profile.browserMode, "full");
  assert.deepEqual(plan.enabledJobNames, ["api-thread", "browser-runtime", "client-events"]);
  assert.equal(service.runtimeSelfCheckJob(plan, "browser-runtime").timeoutMs, service.DEFAULT_JOB_TIMEOUT_MS);
  assert.equal(service.runtimeSelfCheckJob(plan, "browser-runtime").maxConcurrency, 1);
  assert.equal(service.runtimeSelfCheckJob(plan, "browser-runtime").usesBrowser, true);
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
