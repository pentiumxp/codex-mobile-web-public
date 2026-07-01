"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const service = require("../services/runtime/server-event-runtime-boundary-service");
const adapter = require("../adapters/server-event-runtime-boundary-service");

test("server event runtime boundary adapter remains a compatibility wrapper", () => {
  assert.equal(adapter.createServerEventRuntimeBoundaryService, service.createServerEventRuntimeBoundaryService);
});

test("server event runtime boundary lazily delegates notification and turn pipeline calls", () => {
  const calls = [];
  let notificationService = {
    notifyLocalTurnStarted(threadId, result, meta) {
      calls.push(["notifyLocalTurnStarted", this === notificationService, threadId, result, meta]);
      return "turn-1";
    },
    removeEventClient(res) {
      calls.push(["removeEventClient", res]);
      return true;
    },
  };
  const turnPipelineService = {
    pushThreadId(params) {
      calls.push(["pushThreadId", this === turnPipelineService, params]);
      return params.threadId || "";
    },
    maybeRecordTurnTokenUsage(method, params) {
      calls.push(["maybeRecordTurnTokenUsage", method, params]);
    },
  };

  const runtime = service.createServerEventRuntimeBoundaryService({
    getThreadEventNotificationService: () => notificationService,
    getRuntimeTurnEventPipelineService: () => turnPipelineService,
  });

  assert.equal(runtime.notifyLocalTurnStarted("thread-1", { turn: { id: "turn-1" } }, { source: "test" }), "turn-1");
  assert.equal(runtime.pushThreadId({ threadId: "thread-2" }), "thread-2");
  runtime.maybeRecordTurnTokenUsage("turn/completed", { threadId: "thread-2" });
  assert.deepEqual(calls, [
    ["notifyLocalTurnStarted", true, "thread-1", { turn: { id: "turn-1" } }, { source: "test" }],
    ["pushThreadId", true, { threadId: "thread-2" }],
    ["maybeRecordTurnTokenUsage", "turn/completed", { threadId: "thread-2" }],
  ]);

  notificationService = {
    removeEventClient(res) {
      return res && res.closed === true;
    },
  };
  assert.equal(runtime.removeEventClient({ closed: true }), true);
});

test("server event runtime boundary reports missing late-bound services explicitly", () => {
  const runtime = service.createServerEventRuntimeBoundaryService({
    getThreadEventNotificationService: () => null,
    getRuntimeTurnEventPipelineService: () => ({ pushThreadId: "not-a-function" }),
  });

  assert.throws(
    () => runtime.broadcast({ type: "notification" }),
    /server_event_runtime_notification_unavailable/,
  );
  assert.throws(
    () => runtime.pushThreadId({ threadId: "thread-1" }),
    /server_event_runtime_turn_pipeline_pushThreadId_unavailable/,
  );
});
