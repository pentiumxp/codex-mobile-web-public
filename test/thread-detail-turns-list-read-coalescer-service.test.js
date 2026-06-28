"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  coalescedTurnsListKey,
  createThreadDetailTurnsListReadCoalescer,
} = require("../adapters/thread-detail-turns-list-read-coalescer-service");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("coalescedTurnsListKey accepts only bounded no-warning detail window reads", () => {
  assert.match(coalescedTurnsListKey({
    threadId: "thread-1",
    mode: "turns-list-initial",
    limit: 10,
  }), /^thread-1:turns-list-initial:limit:10:/);
  assert.match(coalescedTurnsListKey({
    threadId: "thread-1",
    mode: "turns-list-large",
  }), /^thread-1:turns-list-large:limit:default:/);
  assert.match(coalescedTurnsListKey({
    threadId: "thread-1",
    mode: "turns-list-active-overlay-window",
  }), /^thread-1:turns-list-active-overlay-window:limit:default:/);
  assert.equal(coalescedTurnsListKey({
    threadId: "thread-1",
    mode: "turns-list",
  }), "");
  assert.equal(coalescedTurnsListKey({
    threadId: "thread-1",
    mode: "turns-list-initial",
    warning: "thread/read failed",
  }), "");
  assert.equal(coalescedTurnsListKey({
    mode: "turns-list-initial",
  }), "");
});

test("coalesces concurrent initial turns-list reads for the same thread and mode", async () => {
  let nowMs = 1_000;
  const service = createThreadDetailTurnsListReadCoalescer({
    now: () => {
      nowMs += 25;
      return nowMs;
    },
  });
  const blocker = deferred();
  const calls = [];
  const logs = [];
  const reader = async (input) => {
    calls.push(`reader:${input.threadId}:${input.mode}`);
    return blocker.promise;
  };
  const input = {
    threadId: "thread-1",
    mode: "turns-list-initial",
    limit: 10,
    threadLog: (event, details = {}) => logs.push({ event, details }),
  };

  const first = service.read(input, reader);
  const second = service.read(input, reader);
  await Promise.resolve();

  assert.deepEqual(calls, ["reader:thread-1:turns-list-initial"]);
  assert.equal(service.status().pendingCount, 1);
  assert.equal(service.status().joinCount, 1);
  assert.deepEqual(logs.map((entry) => entry.event), ["turns_list_coalesced"]);
  assert.equal(logs[0].details.mode, "turns-list-initial");
  assert.equal(logs[0].details.joinCount, 1);

  blocker.resolve({ thread: { id: "thread-1", turns: [{ id: "turn-1" }] } });
  const firstResult = await first;
  const secondResult = await second;
  assert.deepEqual(firstResult, secondResult);
  assert.notEqual(firstResult, secondResult);
  firstResult.thread.turns.push({ id: "mutated" });
  assert.deepEqual(secondResult.thread.turns.map((turn) => turn.id), ["turn-1"]);
  assert.equal(service.status().pendingCount, 0);
});

test("does not coalesce different modes, different limits, warnings, or failed retries", async () => {
  const service = createThreadDetailTurnsListReadCoalescer();
  let calls = 0;
  const reader = async (input) => {
    calls += 1;
    return { key: `${input.threadId}:${input.mode}:${input.limit || "default"}:${calls}` };
  };

  const initial = await service.read({
    threadId: "thread-1",
    mode: "turns-list-initial",
    limit: 10,
  }, reader);
  const large = await service.read({
    threadId: "thread-1",
    mode: "turns-list-large",
    limit: 10,
  }, reader);
  const wider = await service.read({
    threadId: "thread-1",
    mode: "turns-list-initial",
    limit: 20,
  }, reader);
  const warning = await service.read({
    threadId: "thread-1",
    mode: "turns-list-initial",
    warning: "thread/read failed",
  }, reader);

  assert.equal(calls, 4);
  assert.equal(initial.key, "thread-1:turns-list-initial:10:1");
  assert.equal(large.key, "thread-1:turns-list-large:10:2");
  assert.equal(wider.key, "thread-1:turns-list-initial:20:3");
  assert.equal(warning.key, "thread-1:turns-list-initial:default:4");

  const failing = createThreadDetailTurnsListReadCoalescer();
  const firstBlocker = deferred();
  const secondBlocker = deferred();
  const blockers = [firstBlocker, secondBlocker];
  let failingCalls = 0;
  const failingReader = () => {
    const blocker = blockers[failingCalls];
    failingCalls += 1;
    return blocker.promise;
  };
  const input = { threadId: "thread-1", mode: "turns-list-initial" };
  const first = failing.read(input, failingReader);
  firstBlocker.reject(new Error("first failed"));
  await assert.rejects(first, /first failed/);
  assert.equal(failing.status().pendingCount, 0);
  const second = failing.read(input, failingReader);
  secondBlocker.resolve({ ok: true });
  assert.deepEqual(await second, { ok: true });
  assert.equal(failingCalls, 2);
});
