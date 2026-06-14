"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  createPendingSteerEchoStore,
  normalizeUserInputPart,
  sameUserMessageContent,
} = require("../adapters/message-pending-echo-service");

test("pending steer echo injects a temporary user message into the live turn", () => {
  let now = Date.UTC(2026, 4, 25, 10, 0, 0);
  const store = createPendingSteerEchoStore({ now: () => now, ttlMs: 60_000 });
  const key = store.remember({
    threadId: "thread-1",
    turnId: "turn-1",
    clientSubmissionId: "submission-1",
    input: [{ type: "text", text: "what happened?" }],
  });
  assert.equal(Boolean(key), true);

  const thread = {
    id: "thread-1",
    turns: [{ id: "turn-1", status: "inProgress", items: [] }],
  };
  store.injectIntoThread(thread);

  assert.equal(thread.turns[0].items.length, 1);
  assert.equal(thread.turns[0].items[0].id, "mux-user-thread-1-turn-1-submission-1");
  assert.equal(thread.turns[0].items[0].type, "userMessage");
  assert.equal(thread.turns[0].items[0].content[0].text, "what happened?");
  assert.equal(thread.turns[0].items[0].mobilePendingSubmission, true);

  now += 61_000;
  const nextThread = {
    id: "thread-1",
    turns: [{ id: "turn-1", status: "inProgress", items: [] }],
  };
  store.injectIntoThread(nextThread);
  assert.equal(nextThread.turns[0].items.length, 0);
});

test("pending steer echo does not duplicate a matching real user message", () => {
  const store = createPendingSteerEchoStore({ now: () => 1000 });
  store.remember({
    threadId: "thread-1",
    turnId: "turn-1",
    clientSubmissionId: "submission-1",
    input: [{ type: "text", text: "same text" }],
  });
  const thread = {
    id: "thread-1",
    turns: [{
      id: "turn-1",
      status: "inProgress",
      items: [{
        id: "real-user-1",
        type: "userMessage",
        content: [{ type: "text", text: "same   text" }],
      }],
    }],
  };

  store.injectIntoThread(thread);
  assert.equal(thread.turns[0].items.length, 1);
  assert.equal(thread.turns[0].items[0].id, "real-user-1");
});

test("pending steer echo is removed when durable history has the message in another turn", () => {
  const store = createPendingSteerEchoStore({ now: () => 1000 });
  store.remember({
    threadId: "thread-1",
    turnId: "turn-1",
    clientSubmissionId: "submission-1",
    input: [{ type: "text", text: "same text" }],
  });
  const thread = {
    id: "thread-1",
    turns: [
      {
        id: "turn-1",
        status: "completed",
        items: [{
          id: "mux-user-thread-1-turn-1-submission-1",
          type: "userMessage",
          mobilePendingSubmission: true,
          content: [{ type: "text", text: "same text" }],
        }],
      },
      {
        id: "turn-2",
        status: "inProgress",
        items: [{
          id: "real-user-2",
          type: "userMessage",
          content: [{ type: "input_text", text: "same   text" }],
        }],
      },
    ],
  };

  store.injectIntoThread(thread);

  assert.equal(thread.turns[0].items.length, 0);
  assert.equal(thread.turns[1].items.length, 1);
  assert.equal(thread.turns[1].items[0].id, "real-user-2");
  assert.equal(store.size(), 0);
});

test("pending steer echo is kept when only an earlier durable message has the same text", () => {
  const store = createPendingSteerEchoStore({ now: () => 1000 });
  store.remember({
    threadId: "thread-1",
    turnId: "turn-2",
    clientSubmissionId: "submission-2",
    input: [{ type: "text", text: "repeat me" }],
  });
  const thread = {
    id: "thread-1",
    turns: [
      {
        id: "turn-1",
        status: "completed",
        items: [{
          id: "real-user-1",
          type: "userMessage",
          content: [{ type: "input_text", text: "repeat   me" }],
        }],
      },
      {
        id: "turn-2",
        status: "inProgress",
        items: [],
      },
    ],
  };

  store.injectIntoThread(thread);

  assert.equal(thread.turns[0].items.length, 1);
  assert.equal(thread.turns[1].items.length, 1);
  assert.equal(thread.turns[1].items[0].id, "mux-user-thread-1-turn-2-submission-2");
  assert.equal(thread.turns[1].items[0].mobilePendingSubmission, true);
  assert.equal(store.size(), 1);
});

test("pending steer echo can be forgotten after a stale active-turn failure", () => {
  const store = createPendingSteerEchoStore({ now: () => 1000 });
  const key = store.remember({
    threadId: "thread-1",
    turnId: "turn-1",
    clientSubmissionId: "submission-1",
    input: [{ type: "text", text: "will fall back" }],
  });
  assert.equal(store.size(), 1);
  assert.equal(store.forget(key), true);
  assert.equal(store.size(), 0);
});

test("input normalization preserves text and local images for pending echoes", () => {
  assert.deepEqual(normalizeUserInputPart({ type: "text", text: "hello" }), {
    type: "text",
    text: "hello",
    text_elements: [],
  });
  assert.deepEqual(normalizeUserInputPart({ type: "localImage", path: "C:\\tmp\\a.png" }), {
    type: "localImage",
    path: "C:\\tmp\\a.png",
  });
  assert.equal(sameUserMessageContent(
    { type: "userMessage", content: [{ type: "text", text: "hello world" }] },
    { type: "userMessage", content: [{ type: "text", text: "hello   world" }] },
  ), true);
  assert.equal(sameUserMessageContent(
    { type: "userMessage", content: [{ type: "text", text: "hello world" }] },
    { type: "userMessage", content: [{ type: "input_text", text: "hello   world" }] },
  ), true);
});
