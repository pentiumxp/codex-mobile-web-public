"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createHomeAiAutonomousDeliveryReturnService,
  normalizeAutonomousDeliveryReturnEvent,
} = require("../adapters/home-ai-autonomous-delivery-return-service");

test("Home AI autonomous delivery return service posts bounded terminal return metadata", async () => {
  const calls = [];
  const service = createHomeAiAutonomousDeliveryReturnService({
    baseUrl: "http://127.0.0.1:8797",
    webKey: "test-web-key",
    fetchImpl: async (url, options) => {
      calls.push({
        url,
        headers: options.headers,
        body: JSON.parse(options.body),
      });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true, eventId: "event-1", deduped: true }),
      };
    },
  });

  const result = await service.send({
    taskCardId: "ttc_original",
    returnCardId: "ttc_return",
    status: "completed",
    title: "Return: completed",
    summary: "Completed and validated.",
    body: "must not be sent",
    prompt: "must not be sent",
    metadata: {
      sourceThreadId: "thread-source",
      targetThreadId: "thread-target",
      workflowId: "workflow-1",
      terminal: false,
      ackPolicy: "return_required",
      token: "must not be sent",
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.eventId, "event-1");
  assert.equal(result.deduped, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://127.0.0.1:8797/api/autonomous-delivery/return-card-events");
  assert.equal(calls[0].headers["X-Hermes-Web-Key"], "test-web-key");
  assert.deepEqual(calls[0].body, {
    taskCardId: "ttc_original",
    returnCardId: "ttc_return",
    status: "completed",
    title: "Return: completed",
    summary: "Completed and validated.",
    metadata: {
      sourceThreadId: "thread-source",
      targetThreadId: "thread-target",
      workflowId: "workflow-1",
      terminal: true,
      ackPolicy: "none",
    },
  });
  assert.equal(Object.hasOwn(calls[0].body, "body"), false);
  assert.equal(Object.hasOwn(calls[0].body, "prompt"), false);
});

test("Home AI autonomous delivery return event normalization rejects unsafe visible metadata", () => {
  assert.throws(
    () => normalizeAutonomousDeliveryReturnEvent({
      taskCardId: "ttc_original",
      returnCardId: "ttc_return",
      status: "completed",
      title: "Return: Bearer abcdefghijklmnopqrstuvwxyz",
      summary: "Completed.",
      metadata: {
        sourceThreadId: "thread-source",
        targetThreadId: "thread-target",
      },
    }),
    /title_contains_unsafe_value/,
  );
});

test("Home AI autonomous delivery return service surfaces unknown task-card ids as bounded errors", async () => {
  const service = createHomeAiAutonomousDeliveryReturnService({
    baseUrl: "http://127.0.0.1:8797",
    webKey: "test-web-key",
    fetchImpl: async () => ({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ ok: false, error: "unknown" }),
    }),
  });

  await assert.rejects(
    () => service.send({
      taskCardId: "ttc_missing",
      returnCardId: "ttc_return",
      status: "blocked",
      title: "Return: blocked",
      summary: "Blocked.",
      metadata: {
        sourceThreadId: "thread-source",
        targetThreadId: "thread-target",
        terminal: true,
        ackPolicy: "none",
      },
    }),
    (err) => err && err.message === "home_ai_autonomous_delivery_task_card_unknown" && err.statusCode === 404,
  );
});
