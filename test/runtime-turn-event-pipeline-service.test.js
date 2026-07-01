"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const service = require("../services/runtime/runtime-turn-event-pipeline-service");
const adapter = require("../adapters/runtime-turn-event-pipeline-service");

function timestampToMs(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

test("runtime turn event pipeline adapter remains a compatibility wrapper", () => {
  assert.equal(adapter.createRuntimeTurnEventPipelineService, service.createRuntimeTurnEventPipelineService);
});

test("runtime turn event pipeline resolves thread ids from nested fields and rollout paths", () => {
  const pipeline = service.createRuntimeTurnEventPipelineService({ timestampToMs });
  const rolloutPath = "/tmp/rollout-2026-07-01T03-10-00-019f16bd-c6e2-7532-b455-d3df6bc362cd.jsonl";

  assert.equal(pipeline.pushTurnId({ turn: { id: "turn-nested" } }), "turn-nested");
  assert.equal(pipeline.threadIdFromRolloutPath(rolloutPath), "019f16bd-c6e2-7532-b455-d3df6bc362cd");
  assert.equal(pipeline.pushThreadId({ turn: { rolloutPath } }), "019f16bd-c6e2-7532-b455-d3df6bc362cd");
  assert.equal(pipeline.pushThreadId({ thread: { thread_id: "thread-nested" } }), "thread-nested");
});

test("runtime turn event pipeline remembers bounded turn to thread context", () => {
  const latestThreadIdByTurnId = new Map();
  const pipeline = service.createRuntimeTurnEventPipelineService({
    latestThreadIdByTurnId,
    runtimeContextCacheMax: 2,
    timestampToMs,
  });

  pipeline.rememberThreadIdForTurnParams("item/completed", {
    item: { turn_id: "turn-a", thread_id: "thread-a" },
  });
  pipeline.rememberThreadIdForTurnId("thread-b", "turn-b");
  pipeline.rememberThreadIdForTurnId("thread-c", "turn-c");

  assert.equal(pipeline.threadIdForTurnId("turn-a"), "");
  assert.equal(pipeline.threadIdForTurnId("turn-b"), "thread-b");
  assert.equal(pipeline.threadIdForTurnId("turn-c"), "thread-c");
  assert.deepEqual([...latestThreadIdByTurnId.keys()], ["turn-b", "turn-c"]);
});

test("runtime turn event pipeline records token usage for fresh completed turns", () => {
  const calls = [];
  const pipeline = service.createRuntimeTurnEventPipelineService({
    processStartedAtMs: 1000,
    oldEventGraceMs: 0,
    timestampToMs,
    readStateDbThread: () => ({ cwd: "/workspace", model: "gpt-test" }),
    turnCompletionUsageSummary: () => ({ totalTokens: 42, model: "fallback-model" }),
    tokenUsageWorkspaceCwds: () => ["/workspace"],
    tokenUsageStatsService: {
      recordTurnUsage(payload) {
        calls.push(payload);
        return { ok: true };
      },
    },
  });

  pipeline.maybeRecordTurnTokenUsage("turn/completed", {
    threadId: "thread-1",
    turnId: "turn-1",
    completedAt: 1200,
  });
  pipeline.maybeRecordTurnTokenUsage("turn/completed", {
    threadId: "thread-old",
    turnId: "turn-old",
    completedAt: 900,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].threadId, "thread-1");
  assert.equal(calls[0].turnId, "turn-1");
  assert.equal(calls[0].cwd, "/workspace");
  assert.equal(calls[0].model, "gpt-test");
  assert.equal(calls[0].source, "turn_completed");
});

test("runtime turn event pipeline dispatches task-card auto return and resume hooks", async () => {
  const calls = [];
  const pipeline = service.createRuntimeTurnEventPipelineService({
    processStartedAtMs: 1000,
    oldEventGraceMs: 0,
    timestampToMs,
    finalReceiptTextFromParams: () => "bounded receipt",
    threadTaskCardService: {
      async maybeAutoReplyCompletedTurn(payload) {
        calls.push(["auto", payload]);
      },
      async maybeResumeInterruptedTaskCard(payload) {
        calls.push(["resume", payload]);
      },
    },
  });

  pipeline.maybeAutoReplyThreadTaskCard("turn/completed", {
    threadId: "thread-1",
    turnId: "turn-1",
    completedAt: 1200,
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(calls.map(([kind]) => kind), ["auto", "resume"]);
  assert.equal(calls[0][1].threadId, "thread-1");
  assert.equal(calls[0][1].turnId, "turn-1");
  assert.equal(calls[0][1].finalReceiptText, "bounded receipt");
});

test("runtime turn event pipeline schedules server-side task-card draft materialization", async () => {
  const timers = [];
  const calls = [];
  const pipeline = service.createRuntimeTurnEventPipelineService({
    processStartedAtMs: 1000,
    oldEventGraceMs: 0,
    timestampToMs,
    setTimer(callback) {
      timers.push(callback);
      return { unref() {} };
    },
    codex: {
      async request(method, params, options) {
        calls.push(["request", method, params, options]);
        return { turns: [{ id: "turn-1" }] };
      },
    },
    readStateDbThread: () => ({ id: "thread-1", title: "Thread" }),
    threadFromTurnsList(threadId, summary, turnsResult) {
      calls.push(["threadFromTurnsList", threadId, summary, turnsResult]);
      return { id: threadId, turns: turnsResult.turns };
    },
    async materializeThreadTaskCardDraftsForThread(thread) {
      calls.push(["materialize", thread]);
    },
    threadTaskCardDraftTurnLookback: 3,
    threadDetailRpcTimeoutMs: 5000,
  });

  pipeline.maybeMaterializeThreadTaskCardDrafts("turn/completed", {
    threadId: "thread-1",
    turnId: "turn-1",
    completedAt: 1200,
  });
  assert.equal(timers.length, 1);
  await timers[0]();

  assert.deepEqual(calls[0], [
    "request",
    "thread/turns/list",
    { threadId: "thread-1", limit: 3, sortDirection: "desc" },
    { timeoutMs: 5000, retry: false, resetOnTimeout: false },
  ]);
  assert.equal(calls[1][0], "threadFromTurnsList");
  assert.deepEqual(calls[2], ["materialize", { id: "thread-1", turns: [{ id: "turn-1" }] }]);
});
