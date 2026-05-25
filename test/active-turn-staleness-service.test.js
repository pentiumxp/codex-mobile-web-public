"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  detectStaleActiveTurnForSubmission,
} = require("../adapters/active-turn-staleness-service");

test("does not auto-interrupt the latest quiet live active turn", () => {
  const result = detectStaleActiveTurnForSubmission({
    activeTurnId: "turn-1",
    threadId: "thread-1",
    nowMs: 1_000_000,
    staleMs: 180_000,
    rolloutStats: { mtimeMs: 700_000 },
    turnsResult: {
      data: [
        {
          id: "turn-1",
          status: "inProgress",
          items: [
            { id: "cmd-1", type: "commandExecution", status: "completed" },
          ],
        },
      ],
    },
    pendingServerRequests: [],
  });

  assert.equal(result.stale, false);
  assert.equal(result.reason, "latest-live-terminal-idle");
  assert.equal(result.quietMs, 300_000);
});

test("does not mark a recent active turn stale", () => {
  const result = detectStaleActiveTurnForSubmission({
    activeTurnId: "turn-1",
    nowMs: 1_000_000,
    staleMs: 180_000,
    rolloutStats: { mtimeMs: 950_000 },
    turnsResult: { data: [{ id: "turn-1", status: "inProgress", items: [] }] },
  });

  assert.equal(result.stale, false);
  assert.equal(result.reason, "active-turn-latest-live");
});

test("does not auto-interrupt latest active turn stopped after context compaction", () => {
  const result = detectStaleActiveTurnForSubmission({
    activeTurnId: "turn-1",
    nowMs: 1_000_000,
    staleMs: 180_000,
    terminalIdleMs: 45_000,
    rolloutStats: { mtimeMs: 950_000 },
    turnsResult: {
      data: [
        {
          id: "turn-1",
          status: "inProgress",
          items: [
            { id: "ctx-1", type: "contextCompaction" },
          ],
        },
      ],
    },
  });

  assert.equal(result.stale, false);
  assert.equal(result.reason, "latest-live-terminal-idle");
  assert.equal(result.quietMs, 50_000);
});

test("does not mark a short quiet active turn stale without a terminal boundary", () => {
  const result = detectStaleActiveTurnForSubmission({
    activeTurnId: "turn-1",
    nowMs: 1_000_000,
    staleMs: 180_000,
    terminalIdleMs: 45_000,
    rolloutStats: { mtimeMs: 950_000 },
    turnsResult: {
      data: [
        {
          id: "turn-1",
          status: "inProgress",
          items: [
            { id: "message-1", type: "agentMessage" },
          ],
        },
      ],
    },
  });

  assert.equal(result.stale, false);
  assert.equal(result.reason, "active-turn-latest-live");
});

test("detects an active turn superseded by a newer completed turn", () => {
  const result = detectStaleActiveTurnForSubmission({
    activeTurnId: "turn-1",
    threadId: "thread-1",
    nowMs: 1_000_000,
    staleMs: 180_000,
    terminalIdleMs: 45_000,
    rolloutStats: { mtimeMs: 990_000 },
    turnsResult: {
      data: [
        { id: "turn-2", status: "completed", items: [] },
        { id: "turn-1", status: "inProgress", items: [] },
      ],
    },
  });

  assert.equal(result.stale, true);
  assert.equal(result.reason, "active-turn-superseded");
});

test("does not mark a recently unmaterialized active turn stale", () => {
  const result = detectStaleActiveTurnForSubmission({
    activeTurnId: "turn-3",
    threadId: "thread-1",
    nowMs: 1_000_000,
    staleMs: 180_000,
    terminalIdleMs: 45_000,
    rolloutStats: { mtimeMs: 990_000 },
    turnsResult: {
      data: [
        { id: "turn-2", status: "completed", items: [] },
      ],
    },
  });

  assert.equal(result.stale, false);
  assert.equal(result.reason, "active-turn-not-latest-recent");
});

test("does not mark active turn stale while an item is pending", () => {
  const result = detectStaleActiveTurnForSubmission({
    activeTurnId: "turn-1",
    nowMs: 1_000_000,
    staleMs: 180_000,
    rolloutStats: { mtimeMs: 700_000 },
    turnsResult: {
      data: [
        {
          id: "turn-1",
          status: "inProgress",
          items: [
            { id: "cmd-1", type: "commandExecution", status: "running" },
          ],
        },
      ],
    },
  });

  assert.equal(result.stale, false);
  assert.equal(result.reason, "pending-item");
});

test("does not mark active turn stale while approval is pending", () => {
  const result = detectStaleActiveTurnForSubmission({
    activeTurnId: "turn-1",
    threadId: "thread-1",
    nowMs: 1_000_000,
    staleMs: 180_000,
    rolloutStats: { mtimeMs: 700_000 },
    turnsResult: { data: [{ id: "turn-1", status: "inProgress", items: [] }] },
    pendingServerRequests: [{ turnId: "turn-1", threadId: "thread-1" }],
  });

  assert.equal(result.stale, false);
  assert.equal(result.reason, "pending-server-request");
});
