"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const policy = require(path.resolve(__dirname, "..", "public", "thread-list-stable-order.js"));

function ids(threads) {
  return threads.map((thread) => thread.id);
}

test("thread-list stable order adopts server order on first scope read", () => {
  const plan = policy.planThreadListStableOrder({
    threads: [{ id: "a" }, { id: "b" }],
    selectedCwd: "",
    search: "",
    nowMs: 1000,
  });

  assert.equal(plan.held, false);
  assert.deepEqual(ids(plan.threads), ["a", "b"]);
  assert.deepEqual(plan.state.order, ["a", "b"]);
  assert.deepEqual(plan.state.updatedAtById, {});
  assert.equal(plan.state.holdUntilMs, 1000 + policy.DEFAULT_HOLD_MS);
});

test("thread-list stable order keeps existing rows during hold window", () => {
  const first = policy.planThreadListStableOrder({
    threads: [{ id: "a" }, { id: "b" }, { id: "c" }],
    nowMs: 1000,
  });

  const second = policy.planThreadListStableOrder({
    threads: [{ id: "b" }, { id: "a" }, { id: "c" }],
    previousState: first.state,
    nowMs: 2000,
  });

  assert.equal(second.held, true);
  assert.deepEqual(ids(second.threads), ["a", "b", "c"]);
  assert.equal(second.state.holdUntilMs, first.state.holdUntilMs);
});

test("thread-list stable order inserts new rows without reshuffling held rows", () => {
  const previousState = {
    scopeKey: policy.threadListOrderScopeKey({ selectedCwd: "", search: "" }),
    holdUntilMs: 60_000,
    order: ["a", "b", "c"],
  };

  const plan = policy.planThreadListStableOrder({
    threads: [{ id: "d" }, { id: "b" }, { id: "a" }, { id: "c" }],
    previousState,
    nowMs: 10_000,
  });

  assert.equal(plan.held, true);
  assert.deepEqual(ids(plan.threads), ["d", "a", "b", "c"]);
});

test("thread-list stable order adopts server order when an existing row has newer activity", () => {
  const previousState = {
    scopeKey: policy.threadListOrderScopeKey({ selectedCwd: "", search: "" }),
    holdUntilMs: 60_000,
    order: ["a", "b", "c"],
    updatedAtById: {
      a: 1000,
      b: 2000,
      c: 3000,
    },
  };

  const plan = policy.planThreadListStableOrder({
    threads: [
      { id: "a", updatedAt: 5 },
      { id: "c", updatedAt: 3 },
      { id: "b", updatedAt: 2 },
    ],
    previousState,
    nowMs: 10_000,
  });

  assert.equal(plan.held, false);
  assert.deepEqual(ids(plan.threads), ["a", "c", "b"]);
  assert.equal(plan.state.updatedAtById.a, 5000);
});

test("thread-list stable order adopts server order after hold window expires", () => {
  const previousState = {
    scopeKey: policy.threadListOrderScopeKey({ selectedCwd: "", search: "" }),
    holdUntilMs: 10_000,
    order: ["a", "b", "c"],
  };

  const plan = policy.planThreadListStableOrder({
    threads: [{ id: "c" }, { id: "b" }, { id: "a" }],
    previousState,
    nowMs: 11_000,
  });

  assert.equal(plan.held, false);
  assert.deepEqual(ids(plan.threads), ["c", "b", "a"]);
  assert.equal(plan.state.holdUntilMs, 11_000 + policy.DEFAULT_HOLD_MS);
});

test("thread-list stable order resets on search or workspace scope changes", () => {
  const previousState = {
    scopeKey: policy.threadListOrderScopeKey({ selectedCwd: "", search: "" }),
    holdUntilMs: 60_000,
    order: ["a", "b"],
  };

  const plan = policy.planThreadListStableOrder({
    threads: [{ id: "b" }, { id: "a" }],
    previousState,
    selectedCwd: "",
    search: "target",
    nowMs: 2_000,
  });

  assert.equal(plan.held, false);
  assert.deepEqual(ids(plan.threads), ["b", "a"]);
});
