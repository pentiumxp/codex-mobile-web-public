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
            readDecision: input.readDecision,
            summarySource: input.summarySource,
            phase: input.readMode,
            projectionState: String(input.projectionState || ""),
            projectionInputAvailable: input.projectionInputAvailable === true,
            projectionSource: String(input.projectionSource || ""),
            projectionVersion: String(input.projectionVersion || ""),
            projectionAgeMs: Number(input.projectionAgeMs || 0),
            projectionSeedStatus: String(input.projectionSeedStatus || ""),
            projectionSeedSource: String(input.projectionSeedSource || ""),
            timings: Object.assign({}, input.timings),
            totalMs: input.totalMs,
            largeReadProtected: Boolean(input.largeReadProtected),
            largeReadRolloutSizeBytes: Number(input.largeReadRolloutSizeBytes || 0),
            largeReadThresholdBytes: Number(input.largeReadThresholdBytes || 0),
            largeReadSource: String(input.largeReadSource || ""),
            largeReadReason: String(input.largeReadReason || ""),
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
          mobileProjection: {
            source: "cache",
            version: "v4",
            ageMs: 456,
          },
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
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.readDecision, "projection-hit");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionState, "hit");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionInputAvailable, true);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionSource, "cache");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionVersion, "v4");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionAgeMs, 456);
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
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.readDecision, "full-thread-read");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionState, "miss");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionInputAvailable, true);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionSeedStatus, "seeded");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionSeedSource, "thread-read");
});

test("large projection miss can use bounded turns/list before full thread/read", async () => {
  const { service, calls } = createHarness({
    preferBoundedReadBeforeFullRead: () => ({
      prefer: true,
      rolloutSizeBytes: 12_000_000,
      thresholdBytes: 8_000_000,
      source: "projection",
      reason: "large-rollout",
    }),
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
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.largeReadProtected, true);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.largeReadSource, "projection");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.largeReadReason, "large-rollout");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.readDecision, "bounded-large-turns-list");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionState, "miss");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionInputAvailable, true);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionSeedStatus, "seeded");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionSeedSource, "turns-list-large");
});

test("large summary read uses bounded turns/list even when projection input is unavailable", async () => {
  const { service, calls } = createHarness({
    projectionInput: () => {
      calls.push("projection-input");
      return null;
    },
    preferBoundedReadBeforeFullRead: ({ summary, projection }) => ({
      prefer: !projection && Number(summary && summary.rolloutSizeBytes) >= 8_000_000,
      rolloutSizeBytes: Number(summary && summary.rolloutSizeBytes || 0),
      thresholdBytes: 8_000_000,
      source: "summary",
      reason: "large-rollout",
    }),
    summary: {
      id: "thread-1",
      status: { type: "idle" },
      rolloutSizeBytes: 12_000_000,
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: false,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "turns-list-large");
  assert.equal(calls.includes("thread-read"), false);
  assert.ok(calls.indexOf("turns-list:turns-list-large") > calls.indexOf("projection-input"));
  assert.equal(calls.includes("seed"), false);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.largeReadProtected, true);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.largeReadRolloutSizeBytes, 12_000_000);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.largeReadThresholdBytes, 8_000_000);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.largeReadSource, "summary");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.readDecision, "bounded-large-turns-list");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionState, "unavailable");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionInputAvailable, false);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionSeedStatus, "skipped");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionSeedSource, "no-projection-input");
});

test("small summary read still uses full thread/read when projection input is unavailable", async () => {
  const { service, calls } = createHarness({
    projectionInput: () => {
      calls.push("projection-input");
      return null;
    },
    preferBoundedReadBeforeFullRead: ({ summary, projection }) => ({
      prefer: !projection && Number(summary && summary.rolloutSizeBytes) >= 8_000_000,
      rolloutSizeBytes: Number(summary && summary.rolloutSizeBytes || 0),
      thresholdBytes: 8_000_000,
      source: "summary",
      reason: "below-threshold",
    }),
    summary: {
      id: "thread-1",
      status: { type: "idle" },
      rolloutSizeBytes: 2_000_000,
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: false,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "thread-read");
  assert.ok(calls.indexOf("thread-read") > calls.indexOf("projection-input"));
  assert.equal(calls.includes("turns-list:turns-list-large"), false);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.largeReadProtected, false);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.largeReadReason, "below-threshold");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.readDecision, "full-thread-read");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionState, "unavailable");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionInputAvailable, false);
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
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.readDecision, "initial-turns-list");
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
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.readDecision, "fallback-turns-list");
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
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.readDecision, "summary-fallback");
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
