"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  handleThreadDetailReadRoute,
} = require("../adapters/thread-detail-route-service");

function routeUrl(pathname) {
  return new URL(pathname, "http://127.0.0.1:8787");
}

test("thread detail route service maps mode=recent to orchestration and sends response", async () => {
  const calls = [];
  let nowMs = 1000;
  const result = await handleThreadDetailReadRoute({
    threadId: "thread-1",
    codex: { transportKind: "mux" },
    url: routeUrl("/api/threads/thread-1?mode=recent"),
    requestStartedAtMs: 1000,
    now: () => {
      nowMs += 5;
      return nowMs;
    },
    readThreadDetail: async (request) => {
      calls.push({
        type: "read",
        threadId: request.threadId,
        preferRecentTurns: request.preferRecentTurns,
        responseBudgetEvidence: request.responseBudgetEvidence,
        codex: request.codex,
      });
      request.threadLog("projection_hit", { mode: "projection-v4-cache" });
      return {
        status: 200,
        mode: "projection-active-overlay",
        body: { thread: { id: "thread-1" } },
      };
    },
    sendJson: (status, body) => calls.push({ type: "send", status, body }),
    logThreadDetail: (event, details) => calls.push({ type: "log", event, details }),
  });

  assert.deepEqual(result, {
    handled: true,
    status: 200,
    mode: "projection-active-overlay",
    complete: true,
  });
  assert.equal(calls[0].type, "read");
  assert.equal(calls[0].threadId, "thread-1");
  assert.equal(calls[0].preferRecentTurns, true);
  assert.equal(calls[0].responseBudgetEvidence, "compact");
  assert.deepEqual(calls[1], {
    type: "log",
    event: "projection_hit",
    details: {
      threadId: "thread-1",
      elapsedMs: 5,
      mode: "projection-v4-cache",
    },
  });
  assert.deepEqual(calls[2], { type: "send", status: 200, body: { thread: { id: "thread-1" } } });
  assert.deepEqual(calls[3], {
    type: "log",
    event: "complete",
    details: {
      threadId: "thread-1",
      elapsedMs: 10,
      status: 200,
      mode: "projection-active-overlay",
    },
  });
});

test("thread detail route service preserves complete=false without final complete log", async () => {
  const calls = [];
  const result = await handleThreadDetailReadRoute({
    threadId: "thread-1",
    url: routeUrl("/api/threads/thread-1"),
    now: () => 2000,
    readThreadDetail: async (request) => {
      calls.push({
        type: "read",
        preferRecentTurns: request.preferRecentTurns,
        responseBudgetEvidence: request.responseBudgetEvidence,
      });
      return {
        status: 504,
        mode: "thread-read-raw-error",
        complete: false,
        body: { error: "timeout" },
      };
    },
    sendJson: (status, body) => calls.push({ type: "send", status, body }),
    logThreadDetail: (event, details) => calls.push({ type: "log", event, details }),
  });

  assert.deepEqual(result, {
    handled: true,
    status: 504,
    mode: "thread-read-raw-error",
    complete: false,
  });
  assert.deepEqual(calls, [
    { type: "read", preferRecentTurns: false, responseBudgetEvidence: "compact" },
    { type: "send", status: 504, body: { error: "timeout" } },
  ]);
});

test("thread detail route service forwards full response-budget evidence for diagnostics", async () => {
  const calls = [];
  const result = await handleThreadDetailReadRoute({
    threadId: "thread-1",
    url: routeUrl("/api/threads/thread-1?mode=recent&budget=full"),
    readThreadDetail: async (request) => {
      calls.push({
        type: "read",
        preferRecentTurns: request.preferRecentTurns,
        responseBudgetEvidence: request.responseBudgetEvidence,
      });
      return {
        status: 200,
        mode: "projection-v4-cache",
        body: { thread: { id: "thread-1" } },
      };
    },
    sendJson: (status, body) => calls.push({ type: "send", status, body }),
  });

  assert.equal(result.handled, true);
  assert.deepEqual(calls[0], {
    type: "read",
    preferRecentTurns: true,
    responseBudgetEvidence: "full",
  });
});

test("thread detail route service lets caller observe read result without blocking response", async () => {
  const calls = [];
  const result = await handleThreadDetailReadRoute({
    threadId: "thread-1",
    url: routeUrl("/api/threads/thread-1?mode=recent"),
    now: () => 3000,
    readThreadDetail: async () => ({
      status: 200,
      mode: "projection-v4-cache",
      body: { thread: { id: "thread-1", status: { type: "completed" } } },
    }),
    sendJson: (status, body) => calls.push({ type: "send", status, body }),
    onThreadDetailReadResult: async (payload) => {
      calls.push({ type: "observe", payload });
      throw new Error("observer failed");
    },
    logThreadDetail: (event, details) => calls.push({ type: "log", event, details }),
  });

  assert.equal(result.handled, true);
  assert.deepEqual(calls[0], {
    type: "send",
    status: 200,
    body: { thread: { id: "thread-1", status: { type: "completed" } } },
  });
  assert.deepEqual(calls[1], {
    type: "observe",
    payload: {
      threadId: "thread-1",
      status: 200,
      body: { thread: { id: "thread-1", status: { type: "completed" } } },
      mode: "projection-v4-cache",
      complete: true,
    },
  });
  assert.equal(calls[2].type, "log");
  assert.equal(calls[2].event, "post_read_result_sync_failed");
  assert.equal(calls[3].event, "complete");
});

test("thread detail route service rejects invalid wiring without side effects", async () => {
  const calls = [];
  const result = await handleThreadDetailReadRoute({
    threadId: "",
    url: routeUrl("/api/threads/thread-1?mode=recent"),
    readThreadDetail: async () => calls.push("read"),
    sendJson: () => calls.push("send"),
  });

  assert.deepEqual(result, {
    handled: false,
    reason: "invalid-route-input",
  });
  assert.deepEqual(calls, []);
});
