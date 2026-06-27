"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  activeWindowKey,
  createThreadDetailActiveWindowReadCoalescer,
} = require("../adapters/thread-detail-active-window-read-coalescer-service");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("activeWindowKey only accepts active overlay window reads", () => {
  assert.equal(activeWindowKey({
    threadId: "thread-1",
    mode: "turns-list-active-overlay-window",
  }), "thread-1:turns-list-active-overlay-window");
  assert.equal(activeWindowKey({
    threadId: "thread-1",
    mode: "turns-list-initial",
  }), "");
  assert.equal(activeWindowKey({
    mode: "turns-list-active-overlay-window",
  }), "");
});

test("coalesces concurrent active overlay window reads for the same thread", async () => {
  let nowMs = 1_000;
  const service = createThreadDetailActiveWindowReadCoalescer({
    now: () => {
      nowMs += 25;
      return nowMs;
    },
  });
  const calls = [];
  const blocker = deferred();
  const reader = async (input) => {
    calls.push(`reader:${input.threadId}:${input.mode}`);
    return blocker.promise;
  };
  const logs = [];
  const input = {
    threadId: "thread-1",
    mode: "turns-list-active-overlay-window",
    threadLog: (event, details = {}) => logs.push({ event, details }),
  };

  const first = service.read(input, reader);
  const second = service.read(input, reader);
  await Promise.resolve();

  assert.equal(calls.length, 1);
  assert.equal(service.status().pendingCount, 1);
  assert.equal(service.status().joinCount, 1);
  assert.deepEqual(logs.map((entry) => entry.event), ["turns_list_coalesced"]);
  assert.equal(logs[0].details.mode, "turns-list-active-overlay-window");
  assert.equal(logs[0].details.joinCount, 1);

  const result = { thread: { id: "thread-1", turns: [{ id: "turn-1" }] } };
  blocker.resolve(result);
  assert.equal(await first, result);
  assert.equal(await second, result);
  assert.equal(service.status().pendingCount, 0);
});

test("does not coalesce non-window modes or different threads", async () => {
  const service = createThreadDetailActiveWindowReadCoalescer();
  let calls = 0;
  const reader = async (input) => {
    calls += 1;
    return { key: `${input.threadId}:${input.mode}:${calls}` };
  };

  const initial = await service.read({
    threadId: "thread-1",
    mode: "turns-list-initial",
  }, reader);
  const otherThread = await service.read({
    threadId: "thread-2",
    mode: "turns-list-active-overlay-window",
  }, reader);

  assert.equal(calls, 2);
  assert.equal(initial.key, "thread-1:turns-list-initial:1");
  assert.equal(otherThread.key, "thread-2:turns-list-active-overlay-window:2");
});

test("clears failed active window reads so retries can run", async () => {
  const service = createThreadDetailActiveWindowReadCoalescer();
  const firstBlocker = deferred();
  const secondBlocker = deferred();
  const blockers = [firstBlocker, secondBlocker];
  let calls = 0;
  const reader = () => {
    const blocker = blockers[calls];
    calls += 1;
    return blocker.promise;
  };
  const input = {
    threadId: "thread-1",
    mode: "turns-list-active-overlay-window",
  };

  const first = service.read(input, reader);
  firstBlocker.reject(new Error("first failed"));
  await assert.rejects(first, /first failed/);
  assert.equal(service.status().pendingCount, 0);

  const second = service.read(input, reader);
  secondBlocker.resolve({ ok: true });
  assert.deepEqual(await second, { ok: true });
  assert.equal(calls, 2);
});
