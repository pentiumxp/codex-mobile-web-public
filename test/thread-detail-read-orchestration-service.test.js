"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadDetailReadOrchestrationService,
} = require("../adapters/thread-detail-read-orchestration-service");

function createHarness(overrides = {}) {
  const calls = [];
  let nowMs = 1_000;
  const summary = overrides.summary || {
    id: "thread-1",
    status: { type: "idle" },
    rolloutPath: "/tmp/rollout.jsonl",
  };
  const service = createThreadDetailReadOrchestrationService(Object.assign({
    now: () => {
      nowMs += 3;
      return nowMs;
    },
    attachDiagnostics: (result, input) => {
      calls.push(`diagnostics:${input.readMode}`);
      if (result && result.thread) {
        result.thread.mobileDiagnostics = {
          threadDetailTimings: {
            requestMode: input.requestMode,
            readMode: input.readMode,
            summarySource: input.summarySource,
            phase: input.readMode,
            timings: Object.assign({}, input.timings),
            totalMs: input.totalMs,
          },
        };
      }
      return result;
    },
    resolveSummary: async () => {
      calls.push("summary");
      return { summary, source: "state-db" };
    },
    resolveVisibility: () => {
      calls.push("visibility");
      return { visible: true };
    },
    threadRuntimeSettings: () => {
      calls.push("runtime");
      return { model: "gpt-5" };
    },
    isHiddenThread: () => false,
    rawAllEnabled: () => false,
    projectionInput: () => {
      calls.push("projection-input");
      return { threadId: "thread-1" };
    },
    projectedThreadResult: () => {
      calls.push("projection-miss");
      return null;
    },
    rememberThreadSummary: () => calls.push("remember"),
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      return {
        thread: {
          id: "thread-1",
          turns: [{ id: "turn-from-list" }],
          mobileReadMode: mode,
        },
      };
    },
    readFullThread: async () => {
      calls.push("thread-read");
      return {
        thread: {
          id: "thread-1",
          turns: [{ id: "turn-from-read" }],
          mobileReadMode: "thread-read",
        },
      };
    },
    seedProjection: () => calls.push("seed"),
    prepareResponse: async (result, details) => {
      calls.push(`prepare:${details.source}`);
      return result;
    },
    fallbackThreadReadResult: ({ mode }) => {
      calls.push(`fallback:${mode}`);
      return {
        thread: {
          id: "thread-1",
          turns: [],
          mobileReadMode: mode,
        },
      };
    },
    isReadTimeoutError: (err) => Boolean(err && err.code === "RPC_TIMEOUT"),
    isUnmaterializedThreadError: (err) => /not materialized/i.test(err && err.message || ""),
    threadRolloutSizeBytes: () => 2048,
    readTimeoutMs: 12000,
    threadDetailRpcTimeoutMs: 6000,
    maxThreadTurns: 10,
    maxFullThreadTurns: 10,
  }, overrides));
  return { service, calls };
}

test("thread detail orchestration returns warm projection before app-server reads", async () => {
  const { service, calls } = createHarness({
    projectedThreadResult: () => {
      calls.push("projection-hit");
      return {
        thread: {
          id: "thread-1",
          turns: [{ id: "turn-cached" }],
          mobileReadMode: "projection-v4-cache",
        },
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: false,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-v4-cache");
  assert.deepEqual(response.body.thread.turns.map((turn) => turn.id), ["turn-cached"]);
  assert.ok(calls.indexOf("projection-hit") > calls.indexOf("summary"));
  assert.equal(calls.includes("thread-read"), false);
  assert.equal(calls.includes("turns-list:turns-list"), false);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.summarySource, "state-db");
});

test("thread detail orchestration preserves full thread/read before bounded turns/list fallback", async () => {
  const { service, calls } = createHarness();

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: false,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "thread-read");
  assert.deepEqual(response.body.thread.turns.map((turn) => turn.id), ["turn-from-read"]);
  assert.ok(calls.indexOf("thread-read") > calls.indexOf("projection-miss"));
  assert.equal(calls.includes("turns-list:turns-list"), false);
  assert.ok(calls.indexOf("seed") > calls.indexOf("thread-read"));
});

test("large projection miss can use bounded turns/list before full thread/read", async () => {
  const { service, calls } = createHarness({
    preferBoundedReadBeforeFullRead: () => true,
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: false,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "turns-list-large");
  assert.deepEqual(response.body.thread.turns.map((turn) => turn.id), ["turn-from-list"]);
  assert.ok(calls.indexOf("turns-list:turns-list-large") > calls.indexOf("projection-miss"));
  assert.equal(calls.includes("thread-read"), false);
  assert.ok(calls.indexOf("seed") > calls.indexOf("turns-list:turns-list-large"));
});

test("recent thread detail can use initial bounded turns/list without full read", async () => {
  const { service, calls } = createHarness();

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "turns-list-initial");
  assert.deepEqual(response.body.thread.turns.map((turn) => turn.id), ["turn-from-list"]);
  assert.ok(calls.indexOf("turns-list:turns-list-initial") > calls.indexOf("projection-miss"));
  assert.equal(calls.includes("thread-read"), false);
});

test("thread/read failure falls back to bounded turns/list", async () => {
  const { service, calls } = createHarness({
    readFullThread: async () => {
      calls.push("thread-read");
      throw new Error("thread/read failed");
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: false,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "turns-list");
  assert.ok(calls.indexOf("turns-list:turns-list") > calls.indexOf("thread-read"));
  assert.equal(calls.includes("fallback:summary-error-fallback"), false);
});

test("thread/read and turns/list timeout returns bounded summary fallback", async () => {
  const { service, calls } = createHarness({
    readFullThread: async () => {
      calls.push("thread-read");
      throw new Error("thread/read failed");
    },
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      const err = new Error("thread/turns/list timed out");
      err.code = "RPC_TIMEOUT";
      throw err;
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: false,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "summary-timeout-fallback");
  assert.equal(response.body.thread.mobileReadMode, "summary-timeout-fallback");
  assert.ok(calls.indexOf("fallback:summary-timeout-fallback") > calls.indexOf("turns-list:turns-list"));
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.readMode, "summary-timeout-fallback");
});

test("hidden summary rejects before projection or thread reads", async () => {
  const { service, calls } = createHarness({
    isHiddenThread: (thread) => Boolean(thread && thread.id === "thread-1"),
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: false,
    threadLog: () => {},
  });

  assert.equal(response.status, 404);
  assert.equal(response.mode, "hidden");
  assert.equal(calls.includes("projection-input"), false);
  assert.equal(calls.includes("thread-read"), false);
});
