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

test("thread-list load policy keeps active-detail defer behavior", () => {
  const plan = policy.planThreadListLoadRequest({
    silent: true,
    selectedCwd: "",
    search: "",
    threadDetailOpening: true,
    threadListLoadedAtMs: 1000,
  });

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
