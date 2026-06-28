"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const policy = require(path.resolve(__dirname, "..", "public", "thread-list-load-policy.js"));

test("thread-list load policy uses warm fallback for first default list paint", () => {
  const plan = policy.planThreadListLoadRequest({
    silent: false,
    selectedCwd: "",
    search: "",
    threadDetailOpening: false,
    threadListLoadedAtMs: 0,
  });

  assert.equal(plan.shouldDeferFallback, false);
  assert.equal(plan.shouldUseWarmFallbackInitial, true);
  assert.deepEqual(plan.params, {
    fallback: "",
    initial: "warm-fallback",
  });
});

test("thread-list load policy defers silent list loads while detail is in flight", () => {
  const plan = policy.planThreadListLoadRequest({
    silent: true,
    selectedCwd: "",
    search: "",
    threadDetailOpening: true,
    threadListLoadedAtMs: 1000,
  });

  assert.equal(plan.shouldLoad, false);
  assert.equal(plan.skipReason, "detail-in-flight");
  assert.equal(plan.retryDelayMs, 700);
  assert.equal(plan.shouldDeferFallback, true);
  assert.equal(plan.shouldUseWarmFallbackInitial, true);
  assert.deepEqual(plan.params, {
    fallback: "defer",
    initial: "warm-fallback",
  });
});

test("thread-list load policy does not warm fallback for search, workspace, or explicit follow-up", () => {
  assert.equal(policy.planThreadListLoadRequest({
    selectedCwd: "/workspace",
    threadListLoadedAtMs: 0,
  }).params.initial, "");

  assert.equal(policy.planThreadListLoadRequest({
    search: "private text",
    threadListLoadedAtMs: 0,
  }).params.initial, "");

  assert.equal(policy.planThreadListLoadRequest({
    deferFallback: false,
    threadListLoadedAtMs: 0,
  }).params.initial, "");
});

test("thread-list load policy skips hidden silent refreshes", () => {
  const plan = policy.planThreadListLoadRequest({
    silent: true,
    documentHidden: true,
    threadListLoadedAtMs: 1000,
  });

  assert.equal(plan.shouldLoad, false);
  assert.equal(plan.skipReason, "hidden-silent");
  assert.equal(plan.retryDelayMs, 0);
});

test("thread-list load policy allows explicit foreground or detail-safe loads", () => {
  assert.equal(policy.planThreadListLoadRequest({
    silent: true,
    threadDetailOpening: true,
    allowDuringDetail: true,
    threadListLoadedAtMs: 1000,
  }).shouldLoad, true);

  assert.equal(policy.planThreadListLoadRequest({
    silent: true,
    documentHidden: true,
    allowHidden: true,
    threadListLoadedAtMs: 1000,
  }).shouldLoad, true);
});
