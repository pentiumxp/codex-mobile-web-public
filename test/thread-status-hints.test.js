"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const policy = require(path.resolve(__dirname, "..", "public", "thread-status-hints.js"));

test("thread status hints keep running state for stale replayed completion", () => {
  const thread = {
    id: "thread-a",
    status: { type: "completed" },
    updatedAtMs: 1000,
    turns: [
      { id: "turn-a", status: { type: "completed" }, completedAtMs: 1000 },
    ],
  };

  assert.equal(policy.shouldKeepRunningHintForSettledStatus({
    threadId: "thread-a",
    thread,
    status: thread.status,
    isRunningHinted: true,
    runningHintedAtMs: 2000,
    eventAtMs: 1000,
    mobileReplay: true,
  }), true);

  assert.equal(policy.shouldMarkThreadUnread({
    threadId: "thread-a",
    currentThreadId: "",
    thread,
    status: thread.status,
    wasRunning: true,
    runningHintedAtMs: 2000,
    eventAtMs: 1000,
    eventIsTerminal: true,
    mobileReplay: true,
  }), false);
});

test("thread status hints mark unread only when terminal activity is newer than the view", () => {
  const thread = {
    id: "thread-a",
    status: "completed",
    turns: [
      { id: "turn-a", status: "completed", completedAtMs: 3500 },
    ],
  };

  assert.equal(policy.shouldMarkThreadUnread({
    threadId: "thread-a",
    currentThreadId: "thread-b",
    thread,
    status: thread.status,
    viewedAtMs: 3000,
    wasRunning: false,
  }), true);

  assert.equal(policy.shouldMarkThreadUnread({
    threadId: "thread-a",
    currentThreadId: "thread-b",
    thread,
    status: thread.status,
    viewedAtMs: 4000,
    wasRunning: false,
  }), false);
});

test("thread status hints keep short submitted-processing idle rows running", () => {
  const thread = {
    id: "thread-a",
    status: "idle",
    updatedAtMs: 2000,
    turns: [],
  };

  assert.equal(policy.shouldKeepRunningHintForSettledStatus({
    threadId: "thread-a",
    thread,
    status: thread.status,
    isRunningHinted: true,
    runningHintedAtMs: 2000,
    submittedProcessingHintedAtMs: 2000,
    nowMs: 30_000,
  }), true);

  assert.equal(policy.shouldKeepRunningHintForSettledStatus({
    threadId: "thread-a",
    thread,
    status: thread.status,
    isRunningHinted: true,
    runningHintedAtMs: 2000,
    submittedProcessingHintedAtMs: 2000,
    nowMs: 90_000,
  }), true);

  assert.equal(policy.shouldExpireRunningThreadHint({
    threadId: "thread-a",
    thread,
    status: thread.status,
    isRunningHinted: true,
    runningHintedAtMs: 2000,
    submittedProcessingHintedAtMs: 2000,
    nowMs: 25 * 60 * 1000,
  }), true);
});

test("thread status notification event time ignores replay receive time for settled notifications", () => {
  const params = {
    mobileReplay: true,
    mobileReplayReceivedAtMs: 1_700_000_000_000,
  };

  assert.equal(policy.notificationEventAtMs(params, 0, { allowReplayReceivedAt: false }), 0);
  assert.equal(policy.notificationEventAtMs(params, 0, { allowReplayReceivedAt: true }), 1_700_000_000_000);
});

test("thread status hints do not mark unknown idle rows unread without terminal evidence", () => {
  assert.equal(policy.shouldMarkThreadUnread({
    threadId: "thread-a",
    currentThreadId: "thread-b",
    thread: { id: "thread-a", status: "notLoaded", updatedAtMs: 5000, turns: [] },
    status: "notLoaded",
    wasRunning: true,
    runningHintedAtMs: 4000,
    eventAtMs: 5000,
  }), false);
});
