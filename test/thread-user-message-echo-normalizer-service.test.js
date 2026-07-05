"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  dedupeUserMessageEchoesInItems,
  dedupeUserMessageEchoesInThread,
  dedupeUserMessageEchoesInTurn,
  isProjectionIndexUserMessage,
  isSyntheticUserMessage,
  userMessagesAreSameEvent,
} = require("../adapters/thread-user-message-echo-normalizer-service");

test("user message echo normalizer keeps repeated durable messages without shared submission identity", () => {
  const result = dedupeUserMessageEchoesInItems([
    { id: "user-1", type: "userMessage", content: [{ type: "text", text: "same request" }] },
    { id: "assistant-1", type: "agentMessage", text: "working" },
    { id: "user-2", type: "userMessage", content: [{ type: "text", text: "same request" }] },
  ]);

  assert.equal(result.removed, 0);
  assert.deepEqual(result.items.map((item) => item.id), ["user-1", "assistant-1", "user-2"]);
});

test("user message echo normalizer collapses same-turn durable duplicate messages with nearby timestamps", () => {
  const result = dedupeUserMessageEchoesInItems([
    {
      id: "durable-user-1",
      type: "userMessage",
      startedAtMs: 1783220100000,
      content: [{ type: "text", text: "same request" }],
    },
    { id: "assistant-1", type: "agentMessage", text: "working" },
    {
      id: "durable-user-2",
      type: "userMessage",
      startedAtMs: 1783220101200,
      content: [{ type: "input_text", text: "same   request" }],
    },
  ]);

  assert.equal(result.removed, 1);
  assert.deepEqual(result.items.map((item) => item.id), ["durable-user-1", "assistant-1"]);
});

test("user message echo normalizer skips long durable content comparisons without echo identity", () => {
  const longText = "x".repeat(128 * 1024);
  const items = [];
  for (let index = 0; index < 120; index += 1) {
    items.push({
      id: `user-${index}`,
      type: "userMessage",
      content: [{ type: "text", text: `${index}-${longText}` }],
    });
  }
  const startedAt = Date.now();
  const result = dedupeUserMessageEchoesInItems(items);

  assert.equal(result.removed, 0);
  assert.equal(result.items.length, 120);
  assert.ok(Date.now() - startedAt < 100);
});

test("user message echo normalizer converges active projection index and durable user echo", () => {
  const result = dedupeUserMessageEchoesInItems([
    {
      id: "item-1",
      type: "userMessage",
      content: [{ type: "text", text: "sync production database" }],
    },
    { id: "assistant-1", type: "agentMessage", text: "working" },
    {
      id: "919b799b-1977-495d-b8db-000000000001",
      type: "userMessage",
      content: [{ type: "input_text", text: "sync production database" }],
    },
  ]);

  assert.equal(result.removed, 1);
  assert.deepEqual(result.items.map((item) => item.id), [
    "919b799b-1977-495d-b8db-000000000001",
    "assistant-1",
  ]);
  assert.equal(isProjectionIndexUserMessage({ id: "item-1", type: "userMessage", text: "x" }), true);
  assert.equal(userMessagesAreSameEvent(
    { id: "item-1", type: "userMessage", text: "x" },
    { id: "919b799b-1977-495d-b8db-000000000001", type: "userMessage", text: "x" },
  ), true);
});

test("user message echo normalizer does not collapse two projection index messages", () => {
  const result = dedupeUserMessageEchoesInItems([
    { id: "item-1", type: "userMessage", text: "repeat" },
    { id: "item-2", type: "userMessage", text: "repeat" },
  ]);

  assert.equal(result.removed, 0);
  assert.deepEqual(result.items.map((item) => item.id), ["item-1", "item-2"]);
});

test("user message echo normalizer collapses duplicate projection index messages with same timestamp", () => {
  const result = dedupeUserMessageEchoesInItems([
    { id: "item-1", type: "userMessage", startedAtMs: 1782710145041, text: "repeat once" },
    { id: "item-10114", type: "userMessage", startedAt: "2026-06-29T05:15:45.041Z", text: "repeat   once" },
    { id: "assistant-1", type: "agentMessage", text: "working" },
  ]);

  assert.equal(result.removed, 1);
  assert.deepEqual(result.items.map((item) => item.id), ["item-1", "assistant-1"]);
});

test("user message echo normalizer collapses near duplicate projection index messages", () => {
  const result = dedupeUserMessageEchoesInItems([
    { id: "item-1", type: "userMessage", startedAtMs: 1782710145041, text: "repeat once" },
    { id: "item-2", type: "userMessage", startedAtMs: 1782710147041, text: "repeat once" },
    { id: "assistant-1", type: "agentMessage", text: "working" },
  ]);

  assert.equal(result.removed, 1);
  assert.deepEqual(result.items.map((item) => item.id), ["item-1", "assistant-1"]);
});

test("user message echo normalizer keeps repeated projection index messages with different timestamps", () => {
  const result = dedupeUserMessageEchoesInItems([
    { id: "item-1", type: "userMessage", startedAtMs: 1782710145041, text: "repeat later" },
    { id: "item-2", type: "userMessage", startedAtMs: 1782710155041, text: "repeat later" },
  ]);

  assert.equal(result.removed, 0);
  assert.deepEqual(result.items.map((item) => item.id), ["item-1", "item-2"]);
});

test("user message echo normalizer removes duplicate durable user messages with shared submission identity", () => {
  const result = dedupeUserMessageEchoesInItems([
    {
      id: "user-1",
      type: "userMessage",
      clientSubmissionId: "submit-1",
      content: [{ type: "text", text: "same request" }],
    },
    { id: "assistant-1", type: "agentMessage", text: "working" },
    {
      id: "user-2",
      type: "userMessage",
      clientSubmissionId: "submit-1",
      content: [{ type: "text", text: "same request" }],
    },
  ]);

  assert.equal(result.removed, 1);
  assert.deepEqual(result.items.map((item) => item.id), ["user-1", "assistant-1"]);
});

test("user message echo normalizer prefers durable server echo over pending synthetic echo", () => {
  const result = dedupeUserMessageEchoesInItems([
    {
      id: "mux-user-thread-turn-client-1",
      type: "userMessage",
      mobilePendingSubmission: true,
      clientSubmissionId: "client-1",
      content: [{ type: "text", text: "send this once" }],
    },
    {
      id: "durable-user-1",
      type: "userMessage",
      content: [{ type: "text", text: "send this once" }],
    },
  ]);

  assert.equal(result.removed, 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, "durable-user-1");
  assert.equal(isSyntheticUserMessage(result.items[0]), false);
});

test("user message echo normalizer keeps distinct user messages", () => {
  const result = dedupeUserMessageEchoesInItems([
    { id: "user-1", type: "userMessage", content: [{ type: "text", text: "first request" }] },
    { id: "user-2", type: "userMessage", content: [{ type: "text", text: "second request" }] },
  ]);

  assert.equal(result.removed, 0);
  assert.deepEqual(result.items.map((item) => item.id), ["user-1", "user-2"]);
});

test("user message echo normalizer classifies same event without raw text-only collapse", () => {
  const durableA = { id: "real-a", type: "userMessage", content: [{ type: "input_text", text: "again" }] };
  const durableB = { id: "real-b", type: "userMessage", content: [{ type: "input_text", text: "again" }] };
  const pending = {
    id: "mux-user-thread-turn-submit-1",
    type: "userMessage",
    mobilePendingSubmission: true,
    clientSubmissionId: "submit-1",
    content: [{ type: "text", text: "again" }],
  };

  assert.equal(userMessagesAreSameEvent(durableA, durableB), false);
  assert.equal(userMessagesAreSameEvent(durableA, pending), true);
});

test("user message echo normalizer matches uploaded attachment summary path variants", () => {
  const result = dedupeUserMessageEchoesInItems([
    {
      id: "pending-upload",
      type: "userMessage",
      mobilePendingSubmission: true,
      content: [{
        type: "text",
        text: "check image\n\nUploaded attachments:\n- photo.jpg (image/jpeg): /tmp/a/178-photo.jpg",
      }],
    },
    {
      id: "durable-upload",
      type: "userMessage",
      content: [{
        type: "text",
        text: "check image\n\nUploaded attachments:\n- photo.jpg (image/jpeg): /Users/x/.codex-mobile-web/uploads/photo.jpg",
      }],
    },
  ]);

  assert.equal(result.removed, 1);
  assert.equal(result.items[0].id, "durable-upload");
});

test("user message echo normalizer annotates turn and thread with bounded counts", () => {
  const turn = {
    id: "turn-1",
    items: [
      { id: "user-1", type: "userMessage", text: "same" },
      { id: "user-2", type: "userMessage", mobilePendingSubmission: true, text: "same" },
      { id: "assistant-1", type: "agentMessage", text: "visible" },
    ],
  };
  const turnResult = dedupeUserMessageEchoesInTurn(turn);

  assert.equal(turnResult.removed, 1);
  assert.deepEqual(turn.items.map((item) => item.id), ["user-1", "assistant-1"]);
  assert.deepEqual(turn.mobileUserMessageEchoDedupe, {
    version: "user-message-echo-dedupe-v1",
    removed: 1,
  });

  const thread = {
    id: "thread-1",
    turns: [
      turn,
      {
        id: "turn-2",
        items: [
          { id: "user-3", type: "userMessage", text: "other" },
          { id: "user-4", type: "userMessage", mobilePendingSubmission: true, text: "other" },
        ],
      },
    ],
  };
  const threadResult = dedupeUserMessageEchoesInThread(thread);

  assert.equal(threadResult.removed, 1);
  assert.deepEqual(thread.mobileUserMessageEchoDedupe, {
    version: "user-message-echo-dedupe-v1",
    removed: 1,
  });
});
