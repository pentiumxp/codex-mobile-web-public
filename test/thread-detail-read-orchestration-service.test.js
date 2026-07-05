"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadDetailReadOrchestrationService,
} = require("../services/thread-detail/thread-detail-read-orchestration-service");
const adapterExports = require("../adapters/thread-detail-read-orchestration-service");

test("thread-detail read orchestration adapter re-exports canonical service", () => {
  assert.equal(adapterExports.createThreadDetailReadOrchestrationService, createThreadDetailReadOrchestrationService);
});

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
            projectionMissReason: String(input.projectionMissReason || ""),
            projectionSeedStatus: String(input.projectionSeedStatus || ""),
            projectionSeedSource: String(input.projectionSeedSource || ""),
            activeFullReadRequired: input.activeFullReadRequired === true,
            activeFullReadReason: String(input.activeFullReadReason || ""),
            activeOverlayAction: String(input.activeOverlayAction || ""),
            activeOverlayReason: String(input.activeOverlayReason || ""),
            activeOverlaySource: String(input.activeOverlaySource || ""),
            activeOverlayItems: Number(input.activeOverlayItems || 0),
            activeOverlayOperationItems: Number(input.activeOverlayOperationItems || 0),
            activeOverlayUploadItems: Number(input.activeOverlayUploadItems || 0),
            activeOverlayAssistantItems: Number(input.activeOverlayAssistantItems || 0),
            activeOverlayReceiptItems: Number(input.activeOverlayReceiptItems || 0),
            activeOverlayWindowFirst: input.activeOverlayWindowFirst === true,
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
    seedProjection: (input, result, options = {}) => {
      if (options.partial) {
        calls.push("seed:partial");
        return {
          partial: true,
          partialKind: options.partialKind || "recent-window",
          signatureHash: "partial-signature",
        };
      }
      calls.push("seed");
      return {
        partial: false,
        signatureHash: "full-signature",
      };
    },
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
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionMissReason, "");
});

test("thread detail orchestration records bounded projection lookup miss reason", async () => {
  const { service, calls } = createHarness({
    projectedThreadLookup: () => {
      calls.push("projection-lookup-miss");
      return {
        result: null,
        missReason: "static-signature-mismatch",
      };
    },
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
  assert.equal(calls.includes("projection-miss"), false);
  assert.ok(calls.indexOf("turns-list:turns-list-large") > calls.indexOf("projection-lookup-miss"));
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionState, "miss");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionMissReason, "static-signature-mismatch");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.readDecision, "bounded-large-turns-list");
});

test("thread detail orchestration returns stale partial projection and schedules refresh", async () => {
  const scheduled = [];
  const { service, calls } = createHarness({
    projectedThreadLookup: (projection, summary, runtimeSettings, options) => {
      calls.push(`projection-lookup-stale:${options.allowStalePartial === true}`);
      return {
        stalePartial: true,
        staleReason: "backing-signature-mismatch",
        result: {
          thread: {
            id: "thread-1",
            turns: [{ id: "turn-cached" }],
            mobileReadMode: "projection-v4-partial",
            mobileProjection: {
              source: "partial",
              version: "v4",
              partial: true,
              stalePartial: true,
              staleReason: "backing-signature-mismatch",
            },
          },
        },
        missReason: "",
      };
    },
    scheduleProjectionRefresh: (input) => {
      calls.push(`schedule-refresh:${input.reason}`);
      scheduled.push(input);
      return { scheduled: true };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-v4-partial");
  assert.deepEqual(response.body.thread.turns.map((turn) => turn.id), ["turn-cached"]);
  assert.equal(calls.includes("turns-list:turns-list-initial"), false);
  assert.equal(calls.includes("thread-read"), false);
  assert.equal(calls.includes("projection-lookup-stale:true"), true);
  assert.equal(calls.includes("schedule-refresh:backing-signature-mismatch"), true);
  assert.equal(scheduled.length, 1);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.readDecision, "projection-stale-partial-hit");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionState, "hit");
});

test("thread detail orchestration reuses stale partial when resting summary has residual active marker", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "completed" },
      activeTurnId: "turn-new",
      mobileLocalActiveStatus: { turnId: "turn-new", status: { type: "active" } },
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadLookup: (projection, summary, runtimeSettings, options) => {
      calls.push(`projection-lookup-stale:${options.allowStalePartial === true}`);
      return {
        stalePartial: true,
        staleReason: "backing-signature-mismatch",
        result: {
          thread: {
            id: "thread-1",
            activeTurnId: "turn-old",
            mobileLocalActiveStatus: { turnId: "turn-old", status: { type: "active" } },
            turns: [{
              id: "turn-old",
              status: { type: "active" },
              items: [],
            }],
            mobileReadMode: "projection-v4-partial",
            mobileProjection: {
              source: "partial",
              version: "v4",
              partial: true,
              stalePartial: true,
              staleReason: "backing-signature-mismatch",
            },
          },
        },
        missReason: "",
      };
    },
    scheduleProjectionRefresh: (input) => {
      calls.push(`schedule-refresh:${input.reason}`);
      return { scheduled: true };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: (event) => calls.push(`log:${event}`),
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-v4-partial");
  assert.equal(calls.includes("turns-list:turns-list-initial"), false);
  assert.equal(calls.includes("thread-read"), false);
  assert.equal(calls.includes("projection-lookup-stale:true"), true);
  assert.equal(calls.includes("schedule-refresh:backing-signature-mismatch"), true);
  assert.equal(calls.includes("log:projection_stale_active_turns_downgraded"), true);
  const thread = response.body.thread;
  assert.equal(thread.activeTurnId, undefined);
  assert.equal(thread.mobileLocalActiveStatus, undefined);
  assert.equal(thread.turns[0].mobileStaleActiveTurn, true);
  assert.equal(thread.turns[0].status.type, "completed");
  assert.equal(thread.turns[0].status.mobileStaleActiveTurn, true);
  assert.equal(thread.turns[0].status.previousType, "active");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.readDecision, "projection-stale-partial-hit");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionState, "hit");
});

test("thread detail orchestration preserves active projection window newer than resting summary", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "completed" },
      updatedAt: 2_000,
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadResult: () => {
      calls.push("projection-hit");
      return {
        thread: {
          id: "thread-1",
          status: { type: "active" },
          activeTurnId: "turn-active",
          turns: [{
            id: "turn-active",
            status: { type: "active" },
            items: [
              { id: "u1", type: "userMessage", startedAt: 3_000 },
              { id: "a1", type: "agentMessage", startedAt: 3_100 },
            ],
          }],
          mobileReadMode: "projection-v4-cache",
        },
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: (event) => calls.push(`log:${event}`),
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-v4-cache");
  assert.equal(calls.includes("thread-read"), false);
  assert.equal(calls.includes("log:projection_stale_active_turns_downgraded"), false);
  const thread = response.body.thread;
  assert.equal(thread.status.type, "active");
  assert.equal(thread.activeTurnId, "turn-active");
  assert.equal(thread.mobileRestingSummaryActiveWindowPreserved.count, 1);
  assert.equal(thread.turns[0].status.type, "active");
  assert.equal(thread.turns[0].mobileStaleActiveTurn, undefined);
});

test("thread detail orchestration normalizes active window with terminal usage as completed", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "completed" },
      updatedAt: 4_000,
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadResult: () => {
      calls.push("projection-hit");
      return {
        thread: {
          id: "thread-1",
          status: { type: "active" },
          activeTurnId: "turn-active",
          turns: [{
            id: "turn-active",
            status: { type: "active" },
            items: [
              { id: "u1", type: "userMessage", startedAt: 3_000 },
              { id: "a1", type: "agentMessage", startedAt: 3_100 },
              { id: "usage", type: "turnUsageSummary", startedAt: 3_900 },
            ],
          }],
          mobileReadMode: "projection-v4-cache",
        },
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: (event) => calls.push(`log:${event}`),
  });

  assert.equal(response.status, 200);
  const thread = response.body.thread;
  assert.equal(thread.activeTurnId, undefined);
  assert.equal(thread.mobileCompletedActiveTurn.count, 1);
  assert.equal(thread.mobileStaleActiveTurn, undefined);
  assert.equal(thread.turns[0].mobileCompletedActiveTurn, true);
  assert.equal(thread.turns[0].mobileStaleActiveTurn, undefined);
  assert.equal(thread.turns[0].status.type, "completed");
  assert.equal(thread.turns[0].status.mobileCompletedActiveTurn, true);
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

test("initial turns-list active window requires full read when overlay is unavailable", async () => {
  const { service, calls } = createHarness({
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      return {
        thread: {
          id: "thread-1",
          turns: [
            {
              id: "active-turn",
              status: { type: "running" },
              items: [{ id: "agent-tail", type: "agentMessage" }],
            },
          ],
          mobileReadMode: mode,
        },
      };
    },
    readFullThread: async () => {
      calls.push("thread-read");
      return {
        thread: {
          id: "thread-1",
          turns: [
            {
              id: "active-turn",
              status: { type: "running" },
              items: [
                { id: "agent-1", type: "agentMessage" },
                { id: "agent-2", type: "agentMessage" },
              ],
            },
          ],
          mobileReadMode: "thread-read",
        },
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "thread-read");
  assert.deepEqual(calls.filter((call) => call.startsWith("turns-list:")), ["turns-list:turns-list-initial"]);
  assert.equal(calls.includes("thread-read"), true);
  assert.equal(calls.includes("seed:partial"), false);
  assert.equal(calls.includes("seed"), true);
  assert.equal(response.body.thread.turns[0].items.length, 2);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.activeFullReadRequired, true);
  assert.equal(timings.activeFullReadReason, "initial-window-active-turn");
  assert.equal(timings.activeOverlayAction, "");
  assert.equal(timings.activeOverlayReason, "");
  assert.equal(timings.readDecision, "full-thread-read");
  assert.equal(timings.projectionSeedStatus, "seeded");
  assert.equal(timings.projectionSeedSource, "active-thread-read");
});

test("initial turns-list active window falls through to full read when summary missed active state", async () => {
  const { service, calls } = createHarness({
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      return {
        thread: {
          id: "thread-1",
          turns: [
            { id: "older-turn", items: [{ id: "agent-old", type: "agentMessage" }] },
            {
              id: "active-turn",
              status: { type: "running" },
              items: [
                { id: "user-1", type: "userMessage" },
                { id: "agent-early", type: "agentMessage", text: "early assistant" },
                { id: "agent-live", type: "agentMessage", text: "stale live assistant" },
              ],
            },
          ],
          mobileReadMode: mode,
        },
      };
    },
    resolveActiveWindowOverlay: ({ projectionThread }) => {
      calls.push(`overlay-provider:${projectionThread && projectionThread.mobileReadMode}`);
      return {
        activeTurnId: "active-turn",
        overlaySource: "projection-live",
        overlayCompleteness: "full",
        overlayPartial: false,
        overlaySignatureHashPresent: true,
        operationCoverage: "present",
        uploadCoverage: "none",
        assistantDeltaCoverage: "",
        receiptCoverage: "present",
        overlayRevision: 9,
        overlayTimestampMs: 9000,
        overlayTurn: {
          id: "active-turn",
          status: { type: "running" },
          items: [
            { id: "cmd-1", type: "commandExecution" },
            { id: "agent-live", type: "agentMessage", text: "fresh assistant" },
            { id: "usage-1", type: "turnUsageSummary" },
          ],
        },
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "thread-read");
  assert.deepEqual(calls.filter((call) => call.startsWith("turns-list:")), ["turns-list:turns-list-initial"]);
  assert.equal(calls.includes("overlay-provider:projection-active-window"), false);
  assert.equal(calls.includes("thread-read"), true);
  assert.equal(calls.includes("seed:partial"), false);
  assert.deepEqual(response.body.thread.turns.map((turn) => turn.id), ["turn-from-read"]);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.activeFullReadRequired, true);
  assert.equal(timings.activeFullReadReason, "initial-window-active-turn");
  assert.equal(timings.readDecision, "full-thread-read");
  assert.equal(timings.projectionState, "miss");
  assert.equal(timings.projectionSource, "");
  assert.equal(timings.projectionSeedStatus, "seeded");
  assert.equal(timings.projectionSeedSource, "active-thread-read");
  assert.equal(timings.activeOverlayAction, "");
  assert.equal(timings.activeOverlayReason, "");
  assert.equal(timings.activeOverlayItems, 0);
  assert.equal(timings.activeOverlayOperationItems, 0);
  assert.equal(timings.activeOverlayAssistantItems, 0);
  assert.equal(timings.activeOverlayReceiptItems, 0);
  assert.equal(timings.activeOverlayWindowFirst, true);
  assert.doesNotMatch(JSON.stringify(timings), /fresh assistant|early assistant|stale live assistant/);
});

test("full live overlay preprobe returns without generic initial turns-list", async () => {
  const { service, calls } = createHarness({
    activeOverlayProjectionWindowLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`active-overlay-window-lookup:${options.activeOverlayStatusProven === true}:${options.omitActiveTurnId || ""}`);
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [
              { id: "older-turn", items: [{ id: "agent-old", type: "agentMessage" }] },
            ],
            mobileReadMode: "projection-active-window",
            mobileProjection: {
              source: "partial",
              version: "active-window",
              partial: true,
              partialKind: "turns-list-active-overlay-window",
              activeOverlayWindow: true,
              revision: 11,
              ageMs: 5,
            },
          },
        },
        missReason: "",
      };
    },
    resolveActiveWindowOverlay: ({ projectionThread }) => {
      calls.push(`overlay-provider:${projectionThread ? projectionThread.mobileReadMode : "no-window"}`);
      return {
        activeTurnId: "active-turn",
        overlaySource: "projection-live",
        overlayCompleteness: "full",
        overlayPartial: false,
        operationCoverage: "present",
        uploadCoverage: "none",
        assistantDeltaCoverage: "",
        receiptCoverage: "present",
        projectionRevision: projectionThread ? 11 : 0,
        overlayRevision: 12,
        overlayTimestampMs: 12000,
        overlayTurn: {
          id: "active-turn",
          status: { type: "running" },
          items: [
            { id: "cmd-1", type: "commandExecution" },
            { id: "agent-live", type: "agentMessage", text: "live assistant" },
            { id: "usage-1", type: "turnUsageSummary" },
          ],
        },
      };
    },
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      return {
        thread: {
          id: "thread-1",
          turns: [
            { id: "older-turn", items: [{ id: "agent-old", type: "agentMessage" }] },
            {
              id: "active-turn",
              status: { type: "running" },
              items: [
                { id: "agent-window", type: "agentMessage", text: "window assistant" },
              ],
            },
          ],
          mobileReadMode: mode,
        },
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-active-overlay");
  assert.deepEqual(calls.filter((call) => call.startsWith("active-overlay-window-lookup:")), [
    "active-overlay-window-lookup:true:active-turn",
  ]);
  assert.deepEqual(calls.filter((call) => call.startsWith("turns-list:")), []);
  assert.equal(calls.includes("thread-read"), false);
  assert.deepEqual(response.body.thread.turns.map((turn) => turn.id), ["older-turn", "active-turn"]);
  const activeTurn = response.body.thread.turns.find((turn) => turn.id === "active-turn");
  assert.deepEqual(activeTurn.items.map((item) => item.id || item.type), [
    "cmd-1",
    "agent-live",
    "usage-1",
  ]);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.activeFullReadRequired, true);
  assert.equal(timings.activeFullReadReason, "projection-live-active-turn");
  assert.equal(timings.readDecision, "projection-active-overlay");
  assert.equal(timings.projectionState, "hit");
  assert.equal(timings.projectionSource, "partial");
  assert.equal(timings.projectionSeedStatus, "");
  assert.equal(timings.projectionSeedSource, "");
  assert.equal(timings.activeOverlayAction, "use-projection-overlay");
  assert.equal(timings.activeOverlayReason, "overlay-evidence-complete");
  assert.equal(response.body.thread.mobileActiveOverlay.completeness, "full");
  assert.equal(timings.activeOverlayItems, 3);
  assert.equal(timings.activeOverlayOperationItems, 1);
  assert.equal(timings.activeOverlayAssistantItems, 1);
  assert.equal(timings.activeOverlayReceiptItems, 1);
  assert.equal(timings.activeOverlayWindowFirst, false);
  assert.doesNotMatch(JSON.stringify(timings), /live assistant/);
});

test("partial live overlay preprobe falls through to full read when initial window is active", async () => {
  const { service, calls } = createHarness({
    activeOverlayProjectionWindowLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`active-overlay-window-lookup:${options.activeOverlayStatusProven === true}:${options.omitActiveTurnId || ""}`);
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [
              { id: "older-turn", items: [{ id: "agent-old", type: "agentMessage" }] },
            ],
            mobileReadMode: "projection-active-window",
            mobileProjection: {
              source: "partial",
              version: "active-window",
              partial: true,
              partialKind: "turns-list-active-overlay-window",
              activeOverlayWindow: true,
              revision: 11,
              ageMs: 5,
            },
          },
        },
        missReason: "",
      };
    },
    resolveActiveWindowOverlay: ({ projectionThread }) => {
      calls.push(`overlay-provider:${projectionThread ? projectionThread.mobileReadMode : "no-window"}`);
      return {
        activeTurnId: "active-turn",
        overlaySource: "projection-live",
        overlayCompleteness: "partial",
        overlayPartial: true,
        overlayPartialKind: "notification-shell",
        overlaySignatureHashPresent: false,
        operationCoverage: "none",
        uploadCoverage: "none",
        assistantDeltaCoverage: "",
        receiptCoverage: "none",
        overlayTimestampMs: 12000,
        overlayTurn: {
          id: "active-turn",
          status: { type: "running" },
          items: [
            { id: "agent-live", type: "agentMessage" },
          ],
        },
      };
    },
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      return {
        thread: {
          id: "thread-1",
          turns: [
            {
              id: "active-turn",
              status: { type: "running" },
              items: [{ id: "agent-tail", type: "agentMessage" }],
            },
          ],
          mobileReadMode: mode,
        },
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "thread-read");
  assert.ok(calls.includes("turns-list:turns-list-initial"));
  assert.equal(calls.includes("thread-read"), true);
  assert.deepEqual(response.body.thread.turns.map((turn) => turn.id), ["turn-from-read"]);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.activeFullReadRequired, true);
  assert.equal(timings.activeFullReadReason, "initial-window-active-turn");
  assert.equal(timings.readDecision, "full-thread-read");
  assert.equal(timings.activeOverlayAction, "");
  assert.equal(timings.activeOverlayReason, "");
  assert.equal(timings.projectionSeedSource, "active-thread-read");
});

test("projection hit active window upgrades to full read when summary missed active state", async () => {
  const { service, calls } = createHarness({
    projectedThreadResult: () => {
      calls.push("projection-hit-active");
      return {
        thread: {
          id: "thread-1",
          turns: [
            {
              id: "active-turn",
              status: { type: "running" },
              items: [{ id: "agent-tail", type: "agentMessage" }],
            },
          ],
          mobileReadMode: "projection-v4-partial",
          mobileProjection: { source: "partial", version: "v4", partial: true },
        },
      };
    },
    readFullThread: async () => {
      calls.push("thread-read");
      return {
        thread: {
          id: "thread-1",
          turns: [
            {
              id: "active-turn",
              status: { type: "running" },
              items: [
                { id: "agent-1", type: "agentMessage" },
                { id: "agent-2", type: "agentMessage" },
              ],
            },
          ],
          mobileReadMode: "thread-read",
        },
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "thread-read");
  assert.equal(calls.includes("turns-list:turns-list-initial"), false);
  assert.equal(calls.includes("remember"), false);
  assert.ok(calls.includes("thread-read"));
  assert.ok(calls.includes("seed"));
  assert.equal(response.body.thread.turns[0].items.length, 2);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.activeFullReadRequired, true);
  assert.equal(timings.activeFullReadReason, "projection-window-active-turn");
  assert.equal(timings.activeOverlayAction, "require-full-read");
  assert.equal(timings.activeOverlayReason, "active-full-read-not-overlay-closable");
  assert.equal(timings.readDecision, "full-thread-read");
  assert.equal(timings.projectionSeedStatus, "seeded");
  assert.equal(timings.projectionSeedSource, "active-thread-read");
});

test("full projection active window can return when summary missed active state", async () => {
  const { service, calls } = createHarness({
    projectedThreadResult: () => {
      calls.push("projection-hit-full-active");
      return {
        thread: {
          id: "thread-1",
          turns: [
            {
              id: "active-turn",
              status: { type: "running" },
              items: [
                { id: "agent-1", type: "agentMessage" },
                { id: "agent-2", type: "agentMessage" },
              ],
            },
          ],
          mobileReadMode: "projection-v4-cache",
          mobileProjection: { source: "cache", version: "v4", partial: false },
        },
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-v4-cache");
  assert.equal(calls.includes("thread-read"), false);
  assert.ok(calls.includes("remember"));
  assert.equal(response.body.thread.turns[0].items.length, 2);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.activeFullReadRequired, false);
  assert.equal(timings.readDecision, "projection-hit");
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

test("active recent thread detail skips partial windows and bounded turns/list", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "turn-active",
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadResult: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`projection-allow-partial:${options.allowPartial === true}`);
      return null;
    },
    preferBoundedReadBeforeFullRead: () => ({
      prefer: true,
      rolloutSizeBytes: 12_000_000,
      thresholdBytes: 8_000_000,
      source: "summary",
      reason: "large-rollout",
    }),
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "thread-read");
  assert.deepEqual(response.body.thread.turns.map((turn) => turn.id), ["turn-from-read"]);
  assert.ok(calls.includes("projection-allow-partial:false"));
  assert.equal(calls.includes("turns-list:turns-list-initial"), false);
  assert.equal(calls.includes("turns-list:turns-list-large"), false);
  assert.ok(calls.includes("thread-read"));
  assert.equal(calls.includes("seed"), true);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.readDecision, "full-thread-read");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeFullReadRequired, true);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeFullReadReason, "active-turn-id");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeOverlayAction, "require-full-read");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeOverlayReason, "overlay-provider-unavailable");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionSeedStatus, "seeded");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionSeedSource, "active-thread-read");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.largeReadProtected, false);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.largeReadReason, "active-thread-requires-full-read");
});

test("active overlay incomplete evidence still falls through to full thread/read", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "active-turn",
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`projection-lookup:${options.allowPartial === true ? "partial" : "full"}:${options.omitActiveTurnId || ""}`);
      if (!options.allowPartial) return { result: null, missReason: "partial-not-allowed" };
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [{ id: "older-turn", items: [{ type: "agentMessage" }] }],
            mobileReadMode: "projection-v4-partial",
            mobileProjection: { source: "partial", version: "v4", partial: true },
          },
        },
        missReason: "",
      };
    },
    activeOverlayProjectionWindowLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`active-overlay-window-lookup:${options.omitActiveTurnId || ""}`);
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [{ id: "older-turn", items: [{ type: "agentMessage" }] }],
            mobileReadMode: "projection-v4-partial",
            mobileProjection: {
              source: "partial",
              version: "v4",
              partial: true,
              revision: 4,
              ageMs: 12,
            },
          },
        },
        missReason: "",
      };
    },
    resolveActiveWindowOverlay: async () => {
      calls.push("overlay-provider");
      return {
        overlaySource: "app-server-notification",
        overlayTurn: {
          id: "active-turn",
          items: [{ type: "agentMessage" }],
        },
        operationCoverage: "none",
        uploadCoverage: "none",
        receiptCoverage: "none",
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "thread-read");
  assert.equal(calls.includes("projection-lookup:full:"), false);
  assert.ok(calls.includes("active-overlay-window-lookup:"));
  assert.ok(calls.indexOf("overlay-provider") < calls.indexOf("active-overlay-window-lookup:"));
  assert.ok(calls.includes("thread-read"));
  assert.equal(calls.includes("seed"), true);
  assert.equal(calls.includes("turns-list:turns-list-initial"), false);
  assert.equal(calls.includes("turns-list:turns-list-large"), false);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.readDecision, "full-thread-read");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeOverlayAction, "require-full-read");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeOverlayReason, "assistant-delta-unknown");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeOverlaySource, "app-server-notification");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeOverlayAssistantItems, 1);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeOverlayWindowFirst, true);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionSeedStatus, "seeded");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionSeedSource, "active-thread-read");
});

test("active overlay retries history-window lookup with active turn omitted before rebuilding window", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "active-turn",
      rolloutPath: "/tmp/rollout.jsonl",
    },
    activeOverlayProjectionWindowLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`active-overlay-window-lookup:${options.activeOverlayStatusProven === true}:${options.omitActiveTurnId || ""}`);
      if (!options.omitActiveTurnId) return { result: null, missReason: "dynamic-age-signature-mismatch" };
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [{ id: "older-turn", items: [{ id: "agent-old", type: "agentMessage" }] }],
            mobileReadMode: "projection-v4-dynamic",
            mobileProjection: {
              source: "dynamic",
              version: "v4",
              revision: 4,
              updatedAtMs: 12000,
              ageMs: 12,
            },
          },
        },
        missReason: "",
      };
    },
    resolveActiveWindowOverlay: ({ projectionThread }) => {
      calls.push(`overlay-provider:${projectionThread ? projectionThread.mobileReadMode : "no-window"}`);
      return {
        activeTurnId: "active-turn",
        overlaySource: "projection-live",
        overlayCompleteness: "full",
        overlayPartial: false,
        operationCoverage: "present",
        uploadCoverage: "none",
        assistantDeltaCoverage: "",
        receiptCoverage: "present",
        overlayRevision: 5,
        overlayTimestampMs: 13000,
        overlayTurn: {
          id: "active-turn",
          status: { type: "running" },
          items: [
            { id: "cmd-1", type: "commandExecution" },
            { id: "agent-live", type: "agentMessage", text: "live assistant" },
            { id: "usage-1", type: "turnUsageSummary" },
          ],
        },
      };
    },
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      throw new Error("turns-list should not be needed after history-window retry");
    },
    readFullThread: async () => {
      calls.push("thread-read");
      throw new Error("thread/read should not be needed after history-window retry");
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: (event) => calls.push(`log:${event}`),
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-active-overlay");
  assert.deepEqual(calls.filter((call) => call.startsWith("active-overlay-window-lookup:")), [
    "active-overlay-window-lookup:false:",
    "active-overlay-window-lookup:true:active-turn",
  ]);
  assert.ok(calls.includes("log:active_overlay_projection_window_retry"));
  assert.equal(calls.some((call) => call.startsWith("turns-list:")), false);
  assert.equal(calls.includes("thread-read"), false);
  assert.deepEqual(response.body.thread.turns.map((turn) => turn.id), ["older-turn", "active-turn"]);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "projection-active-overlay");
  assert.equal(timings.projectionState, "hit");
  assert.equal(timings.activeOverlayAction, "use-projection-overlay");
  assert.equal(timings.activeOverlayReason, "overlay-evidence-complete");
  assert.equal(Object.prototype.hasOwnProperty.call(timings.timings, "activeOverlayWindowMs"), false);
});

test("active overlay complete evidence backfills active turn from cached active-window without app-server reads", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "active-turn",
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`projection-lookup:${options.allowPartial === true ? "partial" : "full"}:${options.omitActiveTurnId || ""}`);
      if (!options.allowPartial) return { result: null, missReason: "partial-not-allowed" };
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [{ id: "older-turn", items: [{ type: "agentMessage" }] }],
            mobileReadMode: "projection-v4-partial",
            mobileProjection: {
              source: "partial",
              version: "v4",
              partial: true,
              ageMs: 12,
            },
          },
        },
        missReason: "",
      };
    },
    activeOverlayProjectionWindowLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`active-overlay-window-lookup:${options.omitActiveTurnId || ""}`);
      const turns = options.omitActiveTurnId
        ? [{ id: "older-turn", items: [{ type: "agentMessage" }] }]
        : [
          { id: "older-turn", items: [{ type: "agentMessage" }] },
          {
            id: "active-turn",
            items: [
              { id: "user-1", type: "userMessage" },
              { id: "agent-early", type: "agentMessage", text: "early assistant" },
              { id: "agent-live", type: "agentMessage", text: "stale live assistant" },
            ],
          },
        ];
      return {
        result: {
          thread: {
            id: "thread-1",
            turns,
            mobileReadMode: "projection-v4-partial",
            mobileProjection: {
              source: "partial",
              version: "v4",
              partial: true,
              revision: 4,
              ageMs: 12,
            },
          },
        },
        missReason: "",
      };
    },
    resolveActiveWindowOverlay: ({ projectionThread }) => {
      calls.push(`overlay-provider:${projectionThread && projectionThread.mobileReadMode}`);
      Promise.resolve().then(() => calls.push("overlay-provider-microtask"));
      return {
        overlaySource: "app-server-notification",
        overlayTurn: {
          id: "active-turn",
          items: [
            { type: "commandExecution", startedAtMs: 110, text: "private command" },
            { type: "input_image", createdAtMs: 111, path: "/private/upload.png" },
            { id: "agent-live", type: "agentMessage", updatedAtMs: 120, text: "private response" },
            { type: "turnDiagnostic", createdAtMs: 121 },
          ],
        },
        projectionRevision: 4,
        overlayRevision: 5,
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-active-overlay");
  assert.equal(calls.includes("thread-read"), false);
  assert.equal(calls.includes("turns-list:turns-list-initial"), false);
  assert.equal(calls.includes("turns-list:turns-list-large"), false);
  assert.equal(calls.includes("turns-list:turns-list-active-overlay-window"), false);
  assert.deepEqual(calls.filter((call) => call.startsWith("projection-lookup:")), [
  ]);
  assert.deepEqual(calls.filter((call) => call.startsWith("active-overlay-window-lookup:")), [
    "active-overlay-window-lookup:",
  ]);
  assert.ok(calls.indexOf("active-overlay-window-lookup:") < calls.indexOf("overlay-provider-microtask"));
  assert.deepEqual(response.body.thread.turns.map((turn) => turn.id), ["older-turn", "active-turn"]);
  const activeTurn = response.body.thread.turns.find((turn) => turn.id === "active-turn");
  assert.deepEqual(activeTurn.items.map((item) => item.id || item.type), [
    "user-1",
    "agent-early",
    "commandExecution",
    "input_image",
    "agent-live",
    "turnDiagnostic",
  ]);
  assert.equal(activeTurn.items[4].text, "private response");
  assert.equal(response.body.thread.mobileProjection.activeOverlay, true);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.readDecision, "projection-active-overlay");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeFullReadRequired, true);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeOverlayAction, "use-projection-overlay");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeOverlayReason, "overlay-evidence-complete");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeOverlayItems, 6);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeOverlayOperationItems, 1);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeOverlayUploadItems, 1);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeOverlayAssistantItems, 2);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeOverlayReceiptItems, 1);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeOverlayWindowFirst, true);
  assert.doesNotMatch(JSON.stringify(response.body.thread.mobileDiagnostics.threadDetailTimings), /private|upload\.png/);
});

test("large active overlay skips foreground full history baseline", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "active-turn",
      rolloutPath: "/tmp/large-rollout.jsonl",
    },
    projectedThreadResult: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`projection-result:${options.activeOverlay === true ? "active" : "ordinary"}:${options.allowPartial === true ? "partial" : "full"}`);
      return null;
    },
    activeOverlayProjectionWindowLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`active-overlay-window-lookup:${options.omitActiveTurnId || ""}`);
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [
              { id: "older-turn", items: [{ type: "agentMessage" }] },
              {
                id: "active-turn",
                items: [
                  { id: "user-1", type: "userMessage" },
                  { id: "agent-live", type: "agentMessage", text: "stale live assistant" },
                ],
              },
            ],
            mobileReadMode: "projection-v4-partial",
            mobileProjection: {
              source: "partial",
              version: "v4",
              partial: true,
              activeOverlayWindow: true,
              ageMs: 12,
            },
          },
        },
        missReason: "",
      };
    },
    resolveActiveWindowOverlay: ({ projectionThread }) => {
      calls.push(`overlay-provider:${projectionThread && projectionThread.mobileReadMode}`);
      return {
        overlaySource: "app-server-notification",
        overlayTurn: {
          id: "active-turn",
          items: [
            { type: "commandExecution", startedAtMs: 110, text: "private command" },
            { type: "input_image", createdAtMs: 111, path: "/private/upload.png" },
            { id: "agent-live", type: "agentMessage", text: "fresh response" },
            { id: "usage", type: "turnUsageSummary" },
            { type: "turnDiagnostic", createdAtMs: 121 },
          ],
        },
        overlayRevision: 5,
        overlayTimestampMs: 12_000,
      };
    },
    preferBoundedReadBeforeFullRead: () => ({
      prefer: true,
      rolloutSizeBytes: 514_000_000,
      thresholdBytes: 64_000_000,
      source: "summary",
      reason: "large-rollout",
    }),
  });
  const logs = [];

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: (event, details = {}) => logs.push({ event, details }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-active-overlay");
  assert.equal(calls.includes("projection-result:active:full"), false);
  assert.equal(calls.includes("turns-list:turns-list-active-overlay-window"), false);
  assert.equal(logs.some((entry) => entry.event === "active_overlay_history_baseline_skipped"
    && entry.details.reason === "large-rollout"), true);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.largeReadProtected, true);
  assert.equal(timings.largeReadRolloutSizeBytes, 514_000_000);
  assert.equal(Object.prototype.hasOwnProperty.call(timings.timings, "activeOverlayHistoryBaselineMs"), false);
  assert.equal(response.body.thread.turns.find((turn) => turn.id === "active-turn").items.find((item) => item.id === "agent-live").text, "fresh response");
});

test("projection-live incomplete active overlay requires fresh active-window backfill", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "active-turn",
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadResult: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`projection-result:${options.activeOverlay === true ? "active-overlay" : "ordinary"}:${options.allowPartial === true ? "partial" : "full"}`);
      if (options.activeOverlay !== true || options.allowPartial === true) return null;
      return {
        thread: {
          id: "thread-1",
          turns: [
            {
              id: "completed-turn",
              status: "completed",
              items: [
                { id: "done-user", type: "userMessage" },
                { id: "done-agent-1", type: "agentMessage" },
                { id: "done-agent-2", type: "agentMessage" },
                { id: "done-usage", type: "turnUsageSummary" },
              ],
            },
            {
              id: "active-turn",
              items: [
                { id: "user-1", type: "userMessage" },
                { id: "agent-old-live", type: "agentMessage" },
              ],
            },
          ],
          mobileReadMode: "projection-v4-dynamic",
          mobileProjection: {
            source: "dynamic",
            version: "v4",
            partial: false,
            revision: 6,
          },
        },
      };
    },
    projectedThreadLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`projection-lookup:${options.activeOverlay === true ? "active-overlay" : "ordinary"}:${options.omitActiveTurnId || ""}`);
      if (options.activeOverlay !== true) return { result: null, missReason: "dynamic-summary-stale" };
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [
              { id: "older-turn", items: [{ id: "agent-old", type: "agentMessage" }] },
              {
                id: "active-turn",
                items: [
                  { id: "user-1", type: "userMessage" },
                  { id: "agent-old-live", type: "agentMessage" },
                ],
              },
            ],
            mobileReadMode: "projection-v4-partial",
            mobileProjection: {
              source: "partial",
              version: "v4",
              partial: true,
              revision: 4,
              ageMs: 12,
            },
          },
        },
        missReason: "",
      };
    },
    activeOverlayProjectionWindowLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`active-overlay-window-lookup:${options.omitActiveTurnId || ""}`);
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [
              { id: "older-turn", items: [{ id: "agent-old", type: "agentMessage" }] },
              {
                id: "active-turn",
                items: [
                  { id: "user-1", type: "userMessage" },
                  { id: "agent-old-live", type: "agentMessage" },
                ],
              },
            ],
            mobileReadMode: "projection-v4-partial",
            mobileProjection: {
              source: "partial",
              version: "v4",
              partial: true,
              partialKind: "turns-list-active-overlay-window",
              revision: 4,
              ageMs: 12,
            },
          },
        },
        missReason: "",
      };
    },
    resolveActiveWindowOverlay: ({ projectionThread }) => {
      calls.push(`overlay-provider:${projectionThread && projectionThread.mobileReadMode || "none"}`);
      return {
        activeTurnId: "active-turn",
        overlaySource: "projection-live",
        overlayCompleteness: "full",
        overlayPartial: false,
        overlaySignatureHashPresent: false,
        operationCoverage: "none",
        uploadCoverage: "none",
        assistantDeltaCoverage: "",
        receiptCoverage: "present",
        overlayRevision: 5,
        overlayTimestampMs: 24_000,
        overlayTurn: {
          id: "active-turn",
          items: [
            { id: "user-1", type: "userMessage" },
            { id: "agent-old-live", type: "agentMessage" },
          ],
        },
      };
    },
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      return {
        thread: {
          id: "thread-1",
          turns: [
            { id: "older-turn", items: [{ id: "agent-old", type: "agentMessage" }] },
            {
              id: "active-turn",
              items: [
                { id: "user-1", type: "userMessage" },
                { id: "agent-old-live", type: "agentMessage" },
                { id: "agent-fresh-1", type: "agentMessage" },
                { id: "agent-fresh-2", type: "agentMessage" },
              ],
            },
          ],
          mobileReadMode: mode,
        },
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-active-overlay");
  assert.equal(calls.includes("thread-read"), false);
  assert.ok(calls.includes("active-overlay-window-lookup:"));
  assert.ok(calls.includes("turns-list:turns-list-active-overlay-window"));
  const activeTurn = response.body.thread.turns.find((turn) => turn.id === "active-turn");
  assert.deepEqual(activeTurn.items.map((item) => item.id || item.type), [
    "user-1",
    "agent-old-live",
    "agent-fresh-1",
    "agent-fresh-2",
  ]);
  const completedTurn = response.body.thread.turns.find((turn) => turn.id === "completed-turn");
  assert.deepEqual(completedTurn.items.map((item) => item.id || item.type), [
    "done-user",
    "done-agent-1",
    "done-agent-2",
    "done-usage",
  ]);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "projection-active-overlay");
  assert.equal(timings.activeOverlayAction, "use-projection-overlay");
  assert.equal(timings.activeOverlayReason, "overlay-evidence-complete");
  assert.equal(timings.activeOverlayAssistantItems, 3);
  assert.ok(Object.prototype.hasOwnProperty.call(timings.timings, "activeOverlayWindowMs"));
});

test("projection-live incomplete active overlay reuses trusted cached active-window backfill", async () => {
  const logs = [];
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "active-turn",
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadResult: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`projection-result:${options.activeOverlay === true ? "active-overlay" : "ordinary"}:${options.allowPartial === true ? "partial" : "full"}`);
      return {
        thread: {
          id: "thread-1",
          turns: [
            {
              id: "completed-turn",
              status: "completed",
              items: [
                { id: "done-user", type: "userMessage" },
                { id: "done-agent", type: "agentMessage" },
                { id: "done-usage", type: "turnUsageSummary" },
              ],
            },
            {
              id: "active-turn",
              items: [
                { id: "user-1", type: "userMessage" },
              ],
            },
          ],
          mobileReadMode: "projection-v4-dynamic",
          mobileProjection: {
            source: "dynamic",
            version: "v4",
            partial: false,
            revision: 6,
          },
        },
      };
    },
    activeOverlayProjectionWindowLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`active-overlay-window-lookup:${options.activeOverlayStatusProven === true ? "trusted" : "ordinary"}`);
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [
              {
                id: "active-turn",
                items: [
                  { id: "user-1", type: "userMessage" },
                  { id: "agent-window-1", type: "agentMessage" },
                ],
              },
            ],
            mobileReadMode: "projection-active-window",
            mobileProjection: {
              source: "partial",
              version: "v4",
              partial: true,
              partialKind: "turns-list-active-overlay-window",
              activeOverlayWindow: true,
              revision: 7,
              updatedAtMs: 25_000,
            },
          },
        },
        missReason: "",
      };
    },
    resolveActiveWindowOverlay: ({ projectionThread }) => {
      calls.push(`overlay-provider:${projectionThread && projectionThread.mobileReadMode || "none"}`);
      return {
        activeTurnId: "active-turn",
        overlaySource: "projection-live",
        overlayCompleteness: "partial",
        overlayPartial: true,
        overlayPartialKind: "notification-shell",
        overlaySignatureHashPresent: false,
        operationCoverage: "none",
        uploadCoverage: "none",
        assistantDeltaCoverage: "",
        receiptCoverage: "none",
        projectionRevision: 6,
        overlayRevision: 7,
        projectionTimestampMs: 24_000,
        overlayTimestampMs: 25_000,
        overlayTurn: {
          id: "active-turn",
          items: [
            { id: "user-1", type: "userMessage" },
            { id: "agent-live-1", type: "agentMessage" },
          ],
        },
      };
    },
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      return {
        thread: {
          id: "thread-1",
          turns: [{ id: "active-turn", items: [{ id: "agent-fresh", type: "agentMessage" }] }],
          mobileReadMode: mode,
        },
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: (event, details = {}) => logs.push({ event, details }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-active-overlay");
  assert.equal(calls.includes("turns-list:turns-list-active-overlay-window"), false);
  assert.ok(calls.includes("active-overlay-window-lookup:trusted"));
  assert.equal(logs.some((entry) => entry.event === "active_overlay_cached_window_reused"
    && entry.details.source === "trusted-cached-active-window"), true);
  const activeTurn = response.body.thread.turns.find((turn) => turn.id === "active-turn");
  assert.deepEqual(activeTurn.items.map((item) => item.id || item.type), [
    "user-1",
    "agent-window-1",
    "agent-live-1",
  ]);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "projection-active-overlay");
  assert.equal(timings.activeOverlayAction, "use-projection-overlay");
  assert.equal(timings.activeOverlayReason, "overlay-evidence-complete");
  assert.equal(Object.prototype.hasOwnProperty.call(timings.timings, "activeOverlayWindowMs"), false);
  assert.ok(Object.prototype.hasOwnProperty.call(timings.timings, "activeOverlayBackfillWindowMs"));
});

test("projection-live complete active overlay skips fresh active-window backfill", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "active-turn",
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadResult: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`projection-result:${options.activeOverlay === true ? "active-overlay" : "ordinary"}:${options.allowPartial === true ? "partial" : "full"}`);
      return {
        thread: {
          id: "thread-1",
          turns: [
            {
              id: "completed-turn",
              status: "completed",
              items: [
                { id: "done-user", type: "userMessage" },
                { id: "done-agent", type: "agentMessage" },
                { id: "done-usage", type: "turnUsageSummary" },
              ],
            },
            {
              id: "active-turn",
              items: [
                { id: "user-1", type: "userMessage" },
                { id: "agent-old-live", type: "agentMessage" },
              ],
            },
          ],
          mobileReadMode: "projection-v4-dynamic",
          mobileProjection: {
            source: "dynamic",
            version: "v4",
            partial: false,
            revision: 6,
          },
        },
      };
    },
    resolveActiveWindowOverlay: ({ projectionThread }) => {
      calls.push(`overlay-provider:${projectionThread && projectionThread.mobileReadMode || "none"}`);
      return {
        activeTurnId: "active-turn",
        overlaySource: "projection-live",
        overlayCompleteness: "full",
        overlayPartial: false,
        overlaySignatureHashPresent: true,
        operationCoverage: "none",
        uploadCoverage: "none",
        assistantDeltaCoverage: "",
        receiptCoverage: "present",
        overlayRevision: 7,
        overlayTimestampMs: 25_000,
        projectionRevision: 6,
        projectionTimestampMs: 24_000,
        overlayTurn: {
          id: "active-turn",
          items: [
            { id: "user-1", type: "userMessage" },
            { id: "agent-old-live", type: "agentMessage" },
            { id: "agent-live-1", type: "agentMessage", updatedAtMs: 25_000 },
            { id: "usage-live", type: "turnUsageSummary" },
          ],
        },
      };
    },
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      return {
        thread: {
          id: "thread-1",
          turns: [
            { id: "older-turn", items: [{ id: "agent-old", type: "agentMessage" }] },
            {
              id: "active-turn",
              items: [
                { id: "user-1", type: "userMessage" },
                { id: "agent-should-not-be-read", type: "agentMessage" },
              ],
            },
          ],
          mobileReadMode: mode,
        },
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-active-overlay");
  assert.equal(calls.includes("thread-read"), false);
  assert.deepEqual(calls.filter((call) => call.startsWith("turns-list:")), []);
  const activeTurn = response.body.thread.turns.find((turn) => turn.id === "active-turn");
  assert.deepEqual(activeTurn.items.map((item) => item.id || item.type), [
    "user-1",
    "agent-old-live",
    "agent-live-1",
    "usage-live",
  ]);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "projection-active-overlay");
  assert.equal(timings.activeOverlayAction, "use-projection-overlay");
  assert.equal(timings.activeOverlayReason, "overlay-evidence-complete");
  assert.equal(Object.prototype.hasOwnProperty.call(timings.timings, "activeOverlayWindowMs"), false);
});

test("active overlay reads bounded active-window when cached window lacks active turn", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "active-turn",
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`projection-lookup:${options.allowPartial === true ? "partial" : "full"}:${options.omitActiveTurnId || ""}`);
      if (!options.allowPartial) return { result: null, missReason: "partial-not-allowed" };
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [{ id: "older-turn", items: [{ type: "agentMessage" }] }],
            mobileReadMode: "projection-v4-partial",
            mobileProjection: {
              source: "partial",
              version: "v4",
              partial: true,
              ageMs: 12,
            },
          },
        },
        missReason: "",
      };
    },
    activeOverlayProjectionWindowLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`active-overlay-window-lookup:${options.omitActiveTurnId || ""}`);
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [{ id: "older-turn", items: [{ type: "agentMessage" }] }],
            mobileReadMode: "projection-v4-partial",
            mobileProjection: {
              source: "partial",
              version: "v4",
              partial: true,
              revision: 4,
              ageMs: 12,
            },
          },
        },
        missReason: "",
      };
    },
    resolveActiveWindowOverlay: () => ({
      overlaySource: "app-server-notification",
      overlayTurn: {
        id: "active-turn",
        items: [
          { id: "agent-live", type: "agentMessage", updatedAtMs: 120, text: "private response" },
          { type: "turnDiagnostic", createdAtMs: 121 },
        ],
      },
      operationCoverage: "none",
      uploadCoverage: "none",
      projectionRevision: 4,
      overlayRevision: 5,
    }),
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      return {
        thread: {
          id: "thread-1",
          turns: [
            { id: "older-turn", items: [{ type: "agentMessage" }] },
            {
              id: "active-turn",
              status: "inProgress",
              items: [
                { id: "user-1", type: "userMessage" },
                { id: "agent-early", type: "agentMessage", text: "early assistant" },
                { id: "agent-live", type: "agentMessage", text: "stale live assistant" },
              ],
            },
          ],
          mobileReadMode: mode,
        },
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-active-overlay");
  assert.ok(calls.includes("turns-list:turns-list-active-overlay-window"));
  assert.ok(calls.includes("seed:partial"));
  const activeTurn = response.body.thread.turns.find((turn) => turn.id === "active-turn");
  assert.deepEqual(activeTurn.items.map((item) => item.id || item.type), [
    "user-1",
    "agent-early",
    "agent-live",
    "turnDiagnostic",
  ]);
  assert.equal(activeTurn.items[2].text, "private response");
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "projection-active-overlay");
  assert.equal(timings.activeOverlayAction, "use-projection-overlay");
  assert.equal(timings.activeOverlayAssistantItems, 2);
  assert.ok(Object.prototype.hasOwnProperty.call(timings.timings, "activeOverlayBackfillWindowMs"));
  assert.doesNotMatch(JSON.stringify(timings), /private/);
});

test("active overlay rebuilds cached window missing latest completed input from bounded turns-list", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "active-turn",
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadResult: (projection, summary, runtimeSettings, options = {}) => {
      calls.push(`full-projection:${options.activeOverlay === true}:${options.allowPartial === true}`);
      return null;
    },
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      return {
        thread: {
          id: "thread-1",
          turns: [
            {
              id: "completed-turn",
              status: "completed",
              items: [
                { id: "user-1", type: "userMessage" },
                { id: "agent-1", type: "agentMessage" },
                { id: "usage-1", type: "turnUsageSummary" },
              ],
            },
          ],
          mobileReadMode: mode,
          mobileProjection: {
            source: "partial",
            version: "active-window",
            partial: true,
            partialKind: "turns-list-active-overlay-window",
            activeOverlayWindow: true,
            revision: 12,
            ageMs: 4,
          },
        },
      };
    },
    activeOverlayProjectionWindowLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`active-overlay-window-lookup:${options.omitActiveTurnId || ""}`);
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [
              {
                id: "completed-turn",
                status: "completed",
                items: [
                  { id: "agent-1", type: "agentMessage" },
                  { id: "usage-1", type: "turnUsageSummary" },
                ],
              },
            ],
            mobileReadMode: "projection-active-window",
            mobileProjection: {
              source: "partial",
              version: "active-window",
              partial: true,
              partialKind: "turns-list-active-overlay-window",
              activeOverlayWindow: true,
              revision: 12,
              ageMs: 12,
            },
          },
        },
        missReason: "",
      };
    },
    resolveActiveWindowOverlay: () => ({
      activeTurnId: "active-turn",
      overlaySource: "projection-live",
        overlayCompleteness: "full",
        overlayPartial: false,
      operationCoverage: "present",
      uploadCoverage: "none",
      assistantDeltaCoverage: "",
      receiptCoverage: "present",
      projectionRevision: 12,
      overlayRevision: 13,
      overlayTimestampMs: 13000,
      overlayTurn: {
        id: "active-turn",
        status: "running",
        items: [
          { id: "cmd-1", type: "commandExecution" },
          { id: "agent-live", type: "agentMessage" },
          { id: "usage-live", type: "turnUsageSummary" },
        ],
      },
    }),
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-active-overlay");
  assert.equal(calls.includes("thread-read"), false);
  assert.deepEqual(calls.filter((call) => call.startsWith("active-overlay-window-lookup:")), [
    "active-overlay-window-lookup:",
  ]);
  assert.deepEqual(calls.filter((call) => call.startsWith("turns-list:")), [
    "turns-list:turns-list-active-overlay-window",
  ]);
  assert.deepEqual(calls.filter((call) => call.startsWith("full-projection:")), [
    "full-projection:false:false",
    "full-projection:true:false",
  ]);
  const completed = response.body.thread.turns.find((turn) => turn.id === "completed-turn");
  assert.ok(completed);
  assert.deepEqual(completed.items.map((item) => item.type), [
    "userMessage",
    "agentMessage",
    "turnUsageSummary",
  ]);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "projection-active-overlay");
  assert.equal(timings.activeOverlayAction, "use-projection-overlay");
  assert.equal(timings.activeOverlayReason, "overlay-evidence-complete");
  assert.ok(Object.prototype.hasOwnProperty.call(timings.timings, "activeOverlayWindowMs"));
  assert.equal(Object.prototype.hasOwnProperty.call(timings.timings, "activeOverlayFullProjectionMs"), false);
});

test("active overlay falls back to full projection only after bounded rebuild still lacks input", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "active-turn",
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadResult: (projection, summary, runtimeSettings, options = {}) => {
      calls.push(`full-projection:${options.activeOverlay === true}:${options.allowPartial === true}`);
      if (options.activeOverlay !== true) return null;
      return {
        thread: {
          id: "thread-1",
          turns: [
            {
              id: "completed-turn",
              status: "completed",
              items: [
                { id: "user-1", type: "userMessage" },
                { id: "agent-1", type: "agentMessage" },
                { id: "usage-1", type: "turnUsageSummary" },
              ],
            },
          ],
          mobileReadMode: "projection-v4-dynamic",
          mobileProjection: {
            source: "dynamic",
            version: "v4",
            revision: 12,
            updatedAtMs: 12000,
            ageMs: 4,
          },
        },
      };
    },
    activeOverlayProjectionWindowLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`active-overlay-window-lookup:${options.omitActiveTurnId || ""}`);
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [
              {
                id: "completed-turn",
                status: "completed",
                items: [
                  { id: "agent-1", type: "agentMessage" },
                  { id: "usage-1", type: "turnUsageSummary" },
                ],
              },
            ],
            mobileReadMode: "projection-active-window",
            mobileProjection: {
              source: "partial",
              version: "active-window",
              partial: true,
              partialKind: "turns-list-active-overlay-window",
              activeOverlayWindow: true,
              revision: 12,
              ageMs: 12,
            },
          },
        },
        missReason: "",
      };
    },
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      return {
        thread: {
          id: "thread-1",
          turns: [
            {
              id: "completed-turn",
              status: "completed",
              items: [
                { id: "agent-1", type: "agentMessage" },
                { id: "usage-1", type: "turnUsageSummary" },
              ],
            },
          ],
          mobileReadMode: mode,
        },
      };
    },
    resolveActiveWindowOverlay: () => ({
      activeTurnId: "active-turn",
      overlaySource: "projection-live",
        overlayCompleteness: "full",
        overlayPartial: false,
      operationCoverage: "present",
      uploadCoverage: "none",
      assistantDeltaCoverage: "",
      receiptCoverage: "present",
      projectionRevision: 12,
      overlayRevision: 13,
      overlayTimestampMs: 13000,
      overlayTurn: {
        id: "active-turn",
        status: "running",
        items: [
          { id: "cmd-1", type: "commandExecution" },
          { id: "agent-live", type: "agentMessage" },
        ],
      },
    }),
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-active-overlay");
  assert.equal(calls.includes("thread-read"), false);
  assert.deepEqual(calls.filter((call) => call.startsWith("turns-list:")), [
    "turns-list:turns-list-active-overlay-window",
  ]);
  assert.deepEqual(calls.filter((call) => call.startsWith("full-projection:")), [
    "full-projection:false:false",
    "full-projection:true:false",
  ]);
  const completed = response.body.thread.turns.find((turn) => turn.id === "completed-turn");
  assert.ok(completed);
  assert.deepEqual(completed.items.map((item) => item.type), [
    "userMessage",
    "agentMessage",
    "turnUsageSummary",
  ]);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "projection-active-overlay");
  assert.equal(timings.activeOverlayAction, "use-projection-overlay");
  assert.equal(timings.activeOverlayReason, "overlay-evidence-complete");
  assert.ok(Object.prototype.hasOwnProperty.call(timings.timings, "activeOverlayWindowMs"));
  assert.ok(Object.prototype.hasOwnProperty.call(timings.timings, "activeOverlayFullProjectionMs"));
});

test("active overlay window projection revision does not force full read when live overlay is older", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "active-turn",
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`projection-lookup:${options.allowPartial === true ? "partial" : "full"}:${options.omitActiveTurnId || ""}`);
      if (!options.allowPartial) return { result: null, missReason: "partial-not-allowed" };
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [{ id: "older-turn", items: [{ type: "agentMessage" }] }],
            mobileReadMode: "projection-v4-partial",
            mobileProjection: {
              source: "partial",
              version: "v4",
              partial: true,
              ageMs: 12,
            },
          },
        },
        missReason: "",
      };
    },
    activeOverlayProjectionWindowLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`active-overlay-window-lookup:${options.omitActiveTurnId || ""}`);
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [{ id: "older-turn", items: [{ type: "agentMessage" }] }],
            mobileReadMode: "projection-active-window",
            mobileProjection: {
              source: "partial",
              version: "active-window",
              partial: true,
              partialKind: "turns-list-active-overlay-window",
              activeOverlayWindow: true,
              revision: 10,
              ageMs: 12,
            },
          },
        },
        missReason: "",
      };
    },
    resolveActiveWindowOverlay: ({ projectionThread }) => {
      calls.push(`overlay-provider:${projectionThread && projectionThread.mobileReadMode}`);
      return {
        overlaySource: "projection-live",
        overlayCompleteness: "full",
        overlayPartial: false,
        overlayTurn: {
          id: "active-turn",
          items: [
            { type: "commandExecution", startedAtMs: 110 },
            { type: "agentMessage", updatedAtMs: 120 },
            { type: "turnDiagnostic", createdAtMs: 121 },
          ],
        },
        projectionRevision: 10,
        overlayRevision: 9,
        operationCoverage: "present",
        uploadCoverage: "none",
        receiptCoverage: "present",
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-active-overlay");
  assert.equal(calls.includes("thread-read"), false);
  assert.deepEqual(calls.filter((call) => call.startsWith("projection-lookup:")), []);
  assert.deepEqual(calls.filter((call) => call.startsWith("active-overlay-window-lookup:")), [
    "active-overlay-window-lookup:",
  ]);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeOverlayAction, "use-projection-overlay");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeOverlayReason, "overlay-evidence-complete");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.activeOverlayWindowFirst, true);
});

test("projection-live active overlay reuses active-turn keyed cached window before bounded read", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "active-turn",
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`projection-lookup:${options.allowPartial === true ? "partial" : "full"}:${options.omitActiveTurnId || ""}`);
      return { result: null, missReason: "active-window-first" };
    },
    activeOverlayProjectionWindowLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`active-overlay-window-lookup:${options.omitActiveTurnId || ""}`);
      if (options.omitActiveTurnId !== "active-turn") {
        return {
          result: {
            thread: {
              id: "thread-1",
              turns: [{ id: "older-turn", items: [{ id: "agent-old", type: "agentMessage" }] }],
              mobileReadMode: "projection-active-window",
              mobileProjection: {
                source: "partial",
                version: "active-window",
                partial: true,
                partialKind: "turns-list-active-overlay-window",
                activeOverlayWindow: true,
                revision: 20,
                updatedAtMs: 20000,
              },
            },
          },
          missReason: "",
        };
      }
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [
              { id: "older-turn", items: [{ id: "agent-old", type: "agentMessage" }] },
              {
                id: "active-turn",
                status: "running",
                items: [
                  { id: "user-1", type: "userMessage" },
                  { id: "agent-early", type: "agentMessage" },
                ],
              },
            ],
            mobileReadMode: "projection-active-window",
            mobileProjection: {
              source: "partial",
              version: "active-window",
              partial: true,
              partialKind: "turns-list-active-overlay-window",
              activeOverlayWindow: true,
              revision: 20,
              updatedAtMs: 20000,
            },
          },
        },
        missReason: "",
      };
    },
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      throw new Error("cached active window should avoid bounded read");
    },
    resolveActiveWindowOverlay: () => ({
      activeTurnId: "active-turn",
      overlaySource: "projection-live",
      overlayCompleteness: "partial",
      overlayPartial: true,
      operationCoverage: "present",
      uploadCoverage: "none",
      receiptCoverage: "present",
      projectionRevision: 20,
      overlayRevision: 19,
      overlayTimestampMs: 19000,
      overlayTurn: {
        id: "active-turn",
        status: "running",
        items: [
          { id: "cmd-1", type: "commandExecution" },
          { id: "agent-live", type: "agentMessage" },
        ],
      },
    }),
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-active-overlay");
  assert.deepEqual(calls.filter((call) => call.startsWith("active-overlay-window-lookup:")), [
    "active-overlay-window-lookup:",
    "active-overlay-window-lookup:active-turn",
  ]);
  assert.deepEqual(calls.filter((call) => call.startsWith("turns-list:")), []);
  const activeTurn = response.body.thread.turns.find((turn) => turn.id === "active-turn");
  assert.deepEqual(activeTurn.items.map((item) => item.id || item.type), [
    "user-1",
    "agent-early",
    "cmd-1",
    "agent-live",
  ]);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.activeOverlayAction, "use-projection-overlay");
  assert.equal(timings.activeOverlayReason, "overlay-evidence-complete");
  assert.equal(Object.prototype.hasOwnProperty.call(timings.timings, "activeOverlayWindowMs"), false);
  assert.ok(Object.prototype.hasOwnProperty.call(timings.timings, "activeOverlayBackfillWindowMs"));
});

test("active overlay accepts context compaction as latest completed input anchor", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "active-turn",
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadResult: (projection, summary, runtimeSettings, options = {}) => {
      calls.push(`full-projection:${options.activeOverlay === true}:${options.allowPartial === true}`);
      return null;
    },
    activeOverlayProjectionWindowLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`active-overlay-window-lookup:${options.omitActiveTurnId || ""}`);
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [
              {
                id: "completed-turn",
                status: "completed",
                items: [
                  { id: "context-1", type: "contextCompaction" },
                  { id: "agent-1", type: "agentMessage" },
                  { id: "usage-1", type: "turnUsageSummary" },
                ],
              },
            ],
            mobileReadMode: "projection-active-window",
            mobileProjection: {
              source: "partial",
              version: "active-window",
              partial: true,
              partialKind: "turns-list-active-overlay-window",
              activeOverlayWindow: true,
              revision: 12,
              ageMs: 12,
            },
          },
        },
        missReason: "",
      };
    },
    resolveActiveWindowOverlay: () => ({
      activeTurnId: "active-turn",
      overlaySource: "projection-live",
        overlayCompleteness: "full",
        overlayPartial: false,
      operationCoverage: "present",
      uploadCoverage: "none",
      assistantDeltaCoverage: "",
      receiptCoverage: "present",
      projectionRevision: 12,
      overlayRevision: 13,
      overlayTimestampMs: 13000,
      overlayTurn: {
        id: "active-turn",
        status: "running",
        items: [
          { id: "cmd-1", type: "commandExecution" },
          { id: "agent-live", type: "agentMessage" },
        ],
      },
    }),
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-active-overlay");
  assert.equal(calls.includes("thread-read"), false);
  assert.deepEqual(calls.filter((call) => call.startsWith("full-projection:")), [
    "full-projection:false:false",
    "full-projection:true:false",
  ]);
  const completed = response.body.thread.turns.find((turn) => turn.id === "completed-turn");
  assert.ok(completed);
  assert.deepEqual(completed.items.map((item) => item.type), [
    "contextCompaction",
    "agentMessage",
    "turnUsageSummary",
  ]);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "projection-active-overlay");
  assert.equal(timings.activeOverlayAction, "use-projection-overlay");
  assert.equal(timings.activeOverlayReason, "overlay-evidence-complete");
  assert.equal(timings.activeOverlayWindowFirst, true);
});

test("active overlay accepts synthetic rollout completion turns without input anchor", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "active-turn",
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadResult: (projection, summary, runtimeSettings, options = {}) => {
      calls.push(`full-projection:${options.activeOverlay === true}:${options.allowPartial === true}`);
      return null;
    },
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      return {
        thread: {
          id: "thread-1",
          turns: [{ id: "should-not-read" }],
          mobileReadMode: mode,
        },
      };
    },
    activeOverlayProjectionWindowLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`active-overlay-window-lookup:${options.omitActiveTurnId || ""}`);
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [
              {
                id: "completed-turn",
                status: "completed",
                source: "rollout_task_complete",
                mobileSyntheticCompletionTurn: true,
                items: [
                  { id: "agent-1", type: "agentMessage" },
                  { id: "usage-1", type: "turnUsageSummary" },
                ],
              },
            ],
            mobileReadMode: "projection-active-window",
            mobileProjection: {
              source: "partial",
              version: "active-window",
              partial: true,
              partialKind: "turns-list-active-overlay-window",
              activeOverlayWindow: true,
              revision: 12,
              ageMs: 12,
            },
          },
        },
        missReason: "",
      };
    },
    resolveActiveWindowOverlay: () => ({
      activeTurnId: "active-turn",
      overlaySource: "projection-live",
        overlayCompleteness: "full",
        overlayPartial: false,
      operationCoverage: "present",
      uploadCoverage: "none",
      assistantDeltaCoverage: "",
      receiptCoverage: "present",
      projectionRevision: 12,
      overlayRevision: 13,
      overlayTimestampMs: 13000,
      overlayTurn: {
        id: "active-turn",
        status: "running",
        items: [
          { id: "cmd-1", type: "commandExecution" },
          { id: "agent-live", type: "agentMessage" },
        ],
      },
    }),
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-active-overlay");
  assert.equal(calls.includes("thread-read"), false);
  assert.deepEqual(calls.filter((call) => call.startsWith("turns-list:")), [
    "turns-list:turns-list-active-overlay-window",
  ]);
  assert.deepEqual(calls.filter((call) => call.startsWith("full-projection:")), [
    "full-projection:false:false",
    "full-projection:true:false",
  ]);
  const completed = response.body.thread.turns.find((turn) => turn.id === "completed-turn");
  assert.ok(completed);
  assert.equal(completed.mobileSyntheticCompletionTurn, true);
  assert.deepEqual(completed.items.map((item) => item.type), [
    "agentMessage",
    "turnUsageSummary",
  ]);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "projection-active-overlay");
  assert.equal(timings.activeOverlayAction, "use-projection-overlay");
  assert.equal(timings.activeOverlayReason, "overlay-evidence-complete");
  assert.equal(timings.activeOverlayWindowFirst, true);
});

test("active ordinary projection hits still pass through active overlay proof gate", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "active-turn",
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`projection-lookup:${options.activeOverlay === true ? "active-overlay" : "ordinary"}`);
      if (options.activeOverlay === true) return { result: null, missReason: "entry-missing" };
      return {
        result: {
          thread: {
            id: "thread-1",
            turns: [{ id: "older-turn", items: [{ id: "agent-old", type: "agentMessage" }] }],
            mobileReadMode: "projection-v4-dynamic",
            mobileProjection: {
              source: "dynamic",
              version: "v4",
              revision: 7,
              updatedAtMs: 7000,
              ageMs: 10,
            },
          },
        },
        missReason: "",
      };
    },
    resolveActiveWindowOverlay: async ({ projectionThread }) => {
      calls.push(`overlay-provider:${projectionThread && projectionThread.mobileReadMode}`);
      return {
        activeTurnId: "active-turn",
        overlaySource: "projection-live",
        overlayCompleteness: "full",
        overlayPartial: false,
        operationCoverage: "present",
        uploadCoverage: "none",
        assistantDeltaCoverage: "",
        receiptCoverage: "present",
        projectionRevision: 7,
        overlayRevision: 8,
        overlayTimestampMs: 8000,
        overlayTurn: {
          id: "active-turn",
          items: [
            { id: "cmd-1", type: "commandExecution" },
            { id: "agent-1", type: "agentMessage" },
            { id: "usage-1", type: "turnUsageSummary" },
          ],
        },
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-active-overlay");
  assert.deepEqual(calls.filter((call) => call.startsWith("projection-lookup:")), [
    "projection-lookup:ordinary",
  ]);
  assert.ok(calls.includes("overlay-provider:projection-v4-dynamic"));
  assert.equal(calls.includes("thread-read"), false);
  assert.deepEqual(response.body.thread.turns.map((turn) => turn.id), ["older-turn", "active-turn"]);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "projection-active-overlay");
  assert.equal(timings.projectionState, "hit");
  assert.equal(timings.projectionSource, "dynamic");
  assert.equal(timings.activeOverlayAction, "use-projection-overlay");
  assert.equal(timings.activeOverlayReason, "overlay-evidence-complete");
  assert.equal(timings.activeOverlayOperationItems, 1);
  assert.equal(timings.activeOverlayAssistantItems, 1);
  assert.equal(timings.activeOverlayReceiptItems, 1);
});

test("status-only active summary cannot close with a bounded overlay window", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`projection-lookup:${options.activeOverlay === true ? "active-overlay" : "ordinary"}`);
      return {
        result: null,
        missReason: options.activeOverlay === true ? "entry-missing" : "dynamic-summary-stale",
      };
    },
    resolveActiveWindowOverlay: async ({ projectionThread }) => {
      calls.push(`overlay-provider:${projectionThread ? projectionThread.mobileReadMode : "missing-window"}`);
      return {
        activeTurnId: "active-turn",
        overlaySource: "projection-live",
        overlayCompleteness: "full",
        overlayPartial: false,
        operationCoverage: "present",
        uploadCoverage: "none",
        assistantDeltaCoverage: "",
        receiptCoverage: "present",
        overlayRevision: 8,
        overlayTimestampMs: 24000,
        overlayTurn: {
          id: "active-turn",
          items: [
            { id: "cmd-1", type: "commandExecution" },
            { id: "agent-1", type: "agentMessage" },
            { id: "usage-1", type: "turnUsageSummary" },
          ],
        },
      };
    },
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      return {
        thread: {
          id: "thread-1",
          turns: [
            { id: "older-turn", items: [{ id: "agent-old", type: "agentMessage" }] },
            {
              id: "active-turn",
              status: { type: "running" },
              items: [
                { id: "cmd-1", type: "commandExecution" },
                { id: "agent-early", type: "agentMessage" },
                { id: "agent-1", type: "agentMessage" },
                { id: "usage-1", type: "turnUsageSummary" },
              ],
            },
          ],
          mobileReadMode: mode,
        },
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "thread-read");
  assert.equal(calls.includes("thread-read"), true);
  assert.equal(calls.includes("turns-list:turns-list-initial"), false);
  assert.deepEqual(calls.filter((call) => call.startsWith("projection-lookup:")), [
    "projection-lookup:ordinary",
  ]);
  assert.deepEqual(calls.filter((call) => call === "projection-lookup:active-overlay"), []);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "full-thread-read");
  assert.equal(timings.projectionState, "miss");
  assert.equal(timings.projectionSeedStatus, "seeded");
  assert.equal(timings.projectionSeedSource, "active-thread-read");
  assert.equal(timings.activeOverlayAction, "require-full-read");
  assert.equal(timings.activeOverlayReason, "active-full-read-not-overlay-closable");
  assert.equal(timings.activeOverlayWindowFirst, false);
  assert.equal(Object.prototype.hasOwnProperty.call(timings.timings, "activeOverlayMs"), false);
});

test("notification active overlay seeds bounded window so repeated reads avoid turns-list", async () => {
  let seededWindow = null;
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "active" },
      activeTurnId: "active-turn",
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadLookup: (input, summary, runtimeSettings, options = {}) => {
      calls.push(`projection-lookup:${options.activeOverlay === true ? "active-overlay" : "ordinary"}`);
      if (options.activeOverlay === true && seededWindow) {
        return {
          result: JSON.parse(JSON.stringify(seededWindow)),
          missReason: "",
        };
      }
      return {
        result: null,
        missReason: options.activeOverlay === true ? "entry-missing" : "dynamic-summary-stale",
      };
    },
    resolveActiveWindowOverlay: () => ({
      activeTurnId: "active-turn",
      overlaySource: "app-server-notification",
        overlayCompleteness: "full",
        overlayPartial: false,
      operationCoverage: "present",
      uploadCoverage: "none",
      assistantDeltaCoverage: "",
      receiptCoverage: "present",
      overlayRevision: 8,
      overlayTimestampMs: 24000,
      overlayTurn: {
        id: "active-turn",
        items: [
          { id: "cmd-1", type: "commandExecution" },
          { id: "agent-1", type: "agentMessage" },
          { id: "usage-1", type: "turnUsageSummary" },
        ],
      },
    }),
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      return {
        thread: {
          id: "thread-1",
          turns: [
            { id: "older-turn", items: [{ id: "agent-old", type: "agentMessage" }] },
            {
              id: "active-turn",
              items: [
                { id: "cmd-1", type: "commandExecution" },
                { id: "agent-early", type: "agentMessage" },
                { id: "agent-1", type: "agentMessage" },
                { id: "usage-1", type: "turnUsageSummary" },
              ],
            },
          ],
          mobileReadMode: mode,
        },
      };
    },
    seedProjection: (input, result, options = {}) => {
      calls.push(`seed:${options.partialKind || "full"}`);
      seededWindow = result;
      return {
        partial: options.partial === true,
        partialKind: options.partialKind || "",
        signatureHash: "seeded-active-window",
      };
    },
  });

  const first = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(first.status, 200);
  assert.equal(first.mode, "projection-active-overlay");
  assert.ok(calls.includes("turns-list:turns-list-active-overlay-window"));
  assert.ok(calls.includes("seed:turns-list-active-overlay-window"));

  calls.length = 0;
  const second = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(second.status, 200);
  assert.equal(second.mode, "projection-active-overlay");
  assert.deepEqual(calls.filter((call) => call.startsWith("projection-lookup:")), [
    "projection-lookup:ordinary",
    "projection-lookup:active-overlay",
  ]);
  assert.equal(calls.includes("turns-list:turns-list-active-overlay-window"), false);
  assert.deepEqual(second.body.thread.turns.map((turn) => turn.id), ["older-turn", "active-turn"]);
  const timings = second.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "projection-active-overlay");
  assert.equal(timings.activeOverlayAction, "use-projection-overlay");
  assert.equal(timings.activeOverlayWindowFirst, false);
  assert.equal(timings.projectionSeedStatus, "");
  assert.equal(timings.projectionSeedSource, "");
});

test("status-only active summary can use bounded turns/list before full thread/read", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "running" },
      rolloutPath: "/tmp/rollout.jsonl",
    },
    preferBoundedReadBeforeFullRead: () => ({
      prefer: true,
      rolloutSizeBytes: 12_000_000,
      thresholdBytes: 8_000_000,
      source: "summary",
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
  assert.equal(calls.includes("turns-list:turns-list-large"), true);
  assert.equal(calls.includes("thread-read"), false);
  assert.equal(calls.includes("seed"), true);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "bounded-large-turns-list");
  assert.equal(timings.activeFullReadRequired, true);
  assert.equal(timings.activeFullReadReason, "status-active");
  assert.equal(timings.activeOverlayAction, "require-full-read");
  assert.equal(timings.activeOverlayReason, "active-full-read-not-overlay-closable");
  assert.equal(timings.largeReadProtected, true);
  assert.equal(timings.largeReadReason, "large-rollout");
  assert.equal(timings.projectionSeedStatus, "seeded");
  assert.equal(timings.projectionSeedSource, "turns-list-large");
});

test("status-only active summary can reuse non-partial projection hits", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "running" },
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadResult: () => {
      calls.push("projection-hit");
      return {
        thread: {
          id: "thread-1",
          turns: [{ id: "turn-from-projection" }],
          mobileReadMode: "projection-v4-cache",
          mobileProjection: {
            source: "cache",
            version: "v4",
            partial: false,
          },
        },
      };
    },
    preferBoundedReadBeforeFullRead: () => ({
      prefer: true,
      rolloutSizeBytes: 12_000_000,
      thresholdBytes: 8_000_000,
      source: "summary",
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
  assert.equal(response.mode, "projection-v4-cache");
  assert.deepEqual(response.body.thread.turns.map((turn) => turn.id), ["turn-from-projection"]);
  assert.equal(calls.includes("turns-list:turns-list-large"), false);
  assert.equal(calls.includes("thread-read"), false);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "projection-hit");
  assert.equal(timings.activeFullReadRequired, true);
  assert.equal(timings.activeFullReadReason, "status-active");
  assert.equal(timings.projectionState, "hit");
  assert.equal(timings.projectionSource, "cache");
  assert.equal(timings.projectionSeedStatus, "");
});

test("status-only active recent summary can reuse partial projection hits", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "running" },
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadResult: () => {
      calls.push("projection-partial-hit");
      return {
        thread: {
          id: "thread-1",
          turns: [{ id: "turn-from-partial" }],
          mobileReadMode: "projection-v4-partial",
          mobileProjection: {
            source: "partial",
            version: "v4",
            partial: true,
            partialKind: "turns-list-window",
          },
        },
      };
    },
    preferBoundedReadBeforeFullRead: () => ({
      prefer: true,
      rolloutSizeBytes: 12_000_000,
      thresholdBytes: 8_000_000,
      source: "summary",
      reason: "large-rollout",
    }),
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-v4-partial");
  assert.deepEqual(response.body.thread.turns.map((turn) => turn.id), ["turn-from-partial"]);
  assert.equal(calls.includes("turns-list:turns-list-large"), false);
  assert.equal(calls.includes("thread-read"), false);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "projection-partial-hit");
  assert.equal(timings.activeFullReadRequired, true);
  assert.equal(timings.activeFullReadReason, "status-active");
  assert.equal(timings.projectionState, "hit");
  assert.equal(timings.projectionSource, "partial");
});

test("status-only active summary does not close with partial projection hits", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "running" },
      rolloutPath: "/tmp/rollout.jsonl",
    },
    projectedThreadResult: () => {
      calls.push("projection-partial-hit");
      return {
        thread: {
          id: "thread-1",
          turns: [{ id: "turn-from-partial" }],
          mobileReadMode: "projection-v4-partial",
          mobileProjection: {
            source: "partial",
            version: "v4",
            partial: true,
          },
        },
      };
    },
    preferBoundedReadBeforeFullRead: () => ({
      prefer: true,
      rolloutSizeBytes: 12_000_000,
      thresholdBytes: 8_000_000,
      source: "summary",
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
  assert.equal(calls.includes("turns-list:turns-list-large"), true);
  assert.equal(calls.includes("thread-read"), false);
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.readDecision, "bounded-large-turns-list");
  assert.equal(timings.projectionState, "hit");
  assert.equal(timings.largeReadReason, "large-rollout");
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
  assert.ok(calls.indexOf("seed:partial") > calls.indexOf("turns-list:turns-list-initial"));
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.readDecision, "initial-turns-list");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionSeedStatus, "seeded-partial");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionSeedSource, "turns-list-initial");
});

test("large resting recent projection miss defers initial turns/list seed", async () => {
  const deferredTasks = [];
  const deferredTaskOptions = [];
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "completed" },
      rolloutPath: "/tmp/rollout.jsonl",
    },
    scheduleDeferredTask: (task, options = {}) => {
      calls.push("defer-task");
      deferredTaskOptions.push(options);
      deferredTasks.push(task);
      return { unref() {} };
    },
    preferBoundedReadBeforeFullRead: () => ({
      prefer: true,
      rolloutSizeBytes: 600_000_000,
      thresholdBytes: 8_000_000,
      source: "rollout-size",
      reason: "large-rollout",
    }),
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: (event) => calls.push(`log:${event}`),
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "deferred-initial-turns-list");
  assert.deepEqual(response.body.thread.turns, []);
  assert.equal(response.body.thread.mobileDeferredProjectionSeed.scheduled, true);
  assert.equal(response.body.thread.mobileDeferredProjectionSeed.targetMode, "turns-list-initial");
  assert.equal(response.body.thread.mobileDeferredProjectionSeed.delayMs, 3000);
  assert.equal(response.body.thread.mobileDeferredProjectionSeed.retryAfterMs, 3000);
  assert.equal(response.body.thread.mobileDeferredProjectionSeed.refreshAfterMs, 3900);
  assert.equal(calls.includes("turns-list:turns-list-initial"), false);
  assert.equal(calls.includes("thread-read"), false);
  assert.equal(calls.includes("defer-task"), true);
  assert.equal(calls.includes("log:turns_list_initial_deferred"), true);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.readDecision, "deferred-initial-turns-list");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionSeedStatus, "deferred");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.largeReadProtected, true);

  assert.equal(deferredTasks.length, 1);
  assert.equal(deferredTaskOptions.length, 1);
  assert.equal(deferredTaskOptions[0].delayMs, 3000);
  assert.equal(deferredTaskOptions[0].name, "deferred-initial-turns-list-seed");

  const pending = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: (event) => calls.push(`log:${event}`),
  });
  assert.equal(pending.body.thread.mobileDeferredProjectionSeed.scheduled, false);
  assert.equal(pending.body.thread.mobileDeferredProjectionSeed.reason, "already-pending");
  assert.equal(pending.body.thread.mobileDeferredProjectionSeed.delayMs, 3000);
  assert.ok(pending.body.thread.mobileDeferredProjectionSeed.retryAfterMs > 0);
  assert.ok(pending.body.thread.mobileDeferredProjectionSeed.refreshAfterMs > 900);
  assert.equal(deferredTasks.length, 1);

  await deferredTasks[0]();
  assert.ok(calls.indexOf("turns-list:turns-list-initial") > calls.indexOf("defer-task"));
  assert.ok(calls.indexOf("seed:partial") > calls.indexOf("turns-list:turns-list-initial"));
  assert.equal(calls.includes("log:deferred_turns_list_initial_seed_start"), true);
  assert.equal(calls.includes("log:deferred_turns_list_initial_seed_done"), true);
});

test("deferred initial turns/list seed timeout releases pending state with backoff", async () => {
  const deferredTasks = [];
  const deferredTaskOptions = [];
  let nowMs = 1_000;
  const { service, calls } = createHarness({
    now: () => {
      nowMs += 3;
      return nowMs;
    },
    summary: {
      id: "thread-1",
      status: { type: "completed" },
      rolloutPath: "/tmp/rollout.jsonl",
    },
    scheduleDeferredTask: (task, options = {}) => {
      calls.push("defer-task");
      deferredTaskOptions.push(options);
      deferredTasks.push(task);
      return { unref() {} };
    },
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      return new Promise(() => {});
    },
    preferBoundedReadBeforeFullRead: () => ({
      prefer: true,
      rolloutSizeBytes: 600_000_000,
      thresholdBytes: 8_000_000,
      source: "rollout-size",
      reason: "large-rollout",
    }),
    deferredInitialTurnsListSeedTimeoutMs: 1,
    deferredInitialTurnsListSeedBackoffMs: 100,
  });

  const first = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: (event) => calls.push(`log:${event}`),
  });
  assert.equal(first.body.thread.mobileDeferredProjectionSeed.reason, "large-projection-miss");
  assert.equal(first.body.thread.mobileDeferredProjectionSeed.delayMs, 3000);
  assert.equal(first.body.thread.mobileDeferredProjectionSeed.refreshAfterMs, 3900);
  assert.equal(deferredTasks.length, 1);
  assert.equal(deferredTaskOptions[0].delayMs, 3000);

  await deferredTasks[0]();
  assert.equal(calls.includes("log:deferred_turns_list_initial_seed_error"), true);

  const second = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: (event) => calls.push(`log:${event}`),
  });
  assert.equal(second.body.thread.mobileDeferredProjectionSeed.scheduled, false);
  assert.equal(second.body.thread.mobileDeferredProjectionSeed.reason, "seed-backoff");
  assert.ok(second.body.thread.mobileDeferredProjectionSeed.retryAfterMs > 0);
  assert.equal(second.body.thread.mobileDiagnostics.threadDetailTimings.projectionSeedStatus, "deferred-backoff");
  assert.equal(deferredTasks.length, 1);

  nowMs += 200;
  const third = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: (event) => calls.push(`log:${event}`),
  });
  assert.equal(third.body.thread.mobileDeferredProjectionSeed.scheduled, true);
  assert.equal(third.body.thread.mobileDeferredProjectionSeed.reason, "large-projection-miss");
  assert.equal(deferredTasks.length, 2);
});

test("recent completed thread downgrades stale active initial window instead of full read", async () => {
  const { service, calls } = createHarness({
    summary: {
      id: "thread-1",
      status: { type: "completed" },
      rolloutPath: "/tmp/rollout.jsonl",
    },
    turnsListThreadReadResult: async ({ mode }) => {
      calls.push(`turns-list:${mode}`);
      return {
        thread: {
          id: "thread-1",
          status: { type: "completed" },
          turns: [{
            id: "stale-active-turn",
            status: { type: "active" },
            items: [{ id: "agent-1", type: "agentMessage", text: "done" }],
          }],
          mobileReadMode: mode,
        },
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: (event) => calls.push(`log:${event}`),
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "turns-list-initial");
  assert.deepEqual(calls.filter((call) => call.startsWith("turns-list:")), ["turns-list:turns-list-initial"]);
  assert.equal(calls.includes("thread-read"), false);
  assert.equal(calls.includes("turns-list:turns-list-large"), false);
  assert.ok(calls.includes("seed:partial"));
  assert.ok(calls.includes("log:turns_list_initial_stale_active_turns_downgraded"));
  const turn = response.body.thread.turns[0];
  assert.equal(turn.mobileStaleActiveTurn, true);
  assert.equal(turn.status.type, "completed");
  assert.equal(turn.status.mobileStaleActiveTurn, true);
  assert.equal(turn.status.previousType, "active");
  const timings = response.body.thread.mobileDiagnostics.threadDetailTimings;
  assert.equal(timings.activeFullReadRequired, false);
  assert.equal(timings.readDecision, "initial-turns-list");
  assert.equal(timings.projectionSeedStatus, "seeded-partial");
});

test("recent thread detail can reuse partial projection without app-server reads", async () => {
  const { service, calls } = createHarness({
    projectedThreadResult: (input, summary, runtimeSettings, options = {}) => {
      calls.push(options.allowPartial ? "projection-partial-hit" : "projection-no-partial");
      if (!options.allowPartial) return null;
      return {
        thread: {
          id: "thread-1",
          turns: [{ id: "turn-partial" }],
          mobileReadMode: "projection-v4-partial",
          mobileProjection: {
            source: "partial",
            version: "v4",
            partial: true,
            partialKind: "recent-window",
            ageMs: 12,
          },
        },
      };
    },
  });

  const response = await service.readThreadDetail({
    codex: { transportKind: "mux", ready: true },
    threadId: "thread-1",
    preferRecentTurns: true,
    threadLog: () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(response.mode, "projection-v4-partial");
  assert.deepEqual(response.body.thread.turns.map((turn) => turn.id), ["turn-partial"]);
  assert.equal(calls.includes("turns-list:turns-list-initial"), false);
  assert.equal(calls.includes("thread-read"), false);
  assert.equal(calls.includes("seed:partial"), false);
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.readDecision, "projection-partial-hit");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionState, "hit");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionSource, "partial");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionVersion, "v4");
  assert.equal(response.body.thread.mobileDiagnostics.threadDetailTimings.projectionAgeMs, 12);
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
