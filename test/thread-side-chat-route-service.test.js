"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createThreadSideChatService,
} = require("../adapters/thread-side-chat-service");
const {
  handleThreadSideChatRoute,
} = require("../server-routes/thread-side-chat-route-service");
const adapterRouteService = require("../adapters/thread-side-chat-route-service");

function tempFile(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-side-chat-route-"));
  return path.join(dir, name);
}

function makeService() {
  return createThreadSideChatService({
    storageFile: tempFile("side-chats.json"),
    scopeId: "profile-a",
    idGenerator: (() => {
      let count = 0;
      return (prefix) => `${prefix}_${++count}`;
    })(),
  });
}

async function callRoute(options = {}) {
  let sent = null;
  const result = await handleThreadSideChatRoute({
    url: new URL(options.path || "/api/threads/thread-1/side-chat", "http://127.0.0.1"),
    method: options.method || "GET",
    readBody: async () => options.body || {},
    threadSideChatService: options.threadSideChatService,
    orchestrationService: options.orchestrationService,
    sendJson(status, body) {
      sent = { status, body };
    },
  });
  return { result, sent };
}

test("side chat route adapter re-exports the canonical server route", () => {
  assert.equal(adapterRouteService.handleThreadSideChatRoute, handleThreadSideChatRoute);
});

test("side chat route returns persisted state and saves draft through the route module", async () => {
  const threadSideChatService = makeService();
  const update = await callRoute({
    method: "PUT",
    path: "/api/threads/thread-1/side-chat/draft",
    body: { text: "draft from phone" },
    threadSideChatService,
  });
  assert.equal(update.result.handled, true);
  assert.equal(update.sent.status, 200);
  assert.equal(update.sent.body.sideChat.draft.text, "draft from phone");

  const read = await callRoute({
    method: "GET",
    path: "/api/threads/thread-1/side-chat",
    threadSideChatService,
  });
  assert.equal(read.sent.status, 200);
  assert.equal(read.sent.body.sideChat.draft.text, "draft from phone");
});

test("side chat message route marks assistant pending and delegates reply orchestration", async () => {
  const threadSideChatService = makeService();
  const started = [];
  const response = await callRoute({
    method: "POST",
    path: "/api/threads/thread-1/side-chat/messages",
    body: { role: "user", text: "Think through this locally." },
    threadSideChatService,
    orchestrationService: {
      startAssistantReply(threadId, message) {
        started.push({ threadId, message });
      },
    },
  });

  assert.equal(response.sent.status, 200);
  assert.equal(response.sent.body.ok, true);
  assert.equal(response.sent.body.message.role, "user");
  assert.equal(response.sent.body.state.sidecar.status, "pending");
  assert.equal(started.length, 1);
  assert.equal(started[0].threadId, "thread-1");
  assert.equal(started[0].message.text, "Think through this locally.");
});

test("side chat candidate routes delegate queue apply cancel and clear operations", async () => {
  const threadSideChatService = makeService();
  const created = await callRoute({
    method: "POST",
    path: "/api/threads/thread-1/side-chat/candidates",
    body: { body: "Send this to main thread." },
    threadSideChatService,
  });
  const candidateId = created.sent.body.candidate.id;
  assert.equal(created.sent.status, 200);

  const queued = await callRoute({
    method: "POST",
    path: `/api/threads/thread-1/side-chat/candidates/${candidateId}/queue`,
    body: { mode: "confirmWhenIdle" },
    threadSideChatService,
  });
  assert.equal(queued.sent.body.queue.status, "queued");

  const cancelled = await callRoute({
    method: "POST",
    path: `/api/threads/thread-1/side-chat/candidates/${candidateId}/cancel`,
    threadSideChatService,
  });
  assert.equal(cancelled.sent.body.candidate.status, "cancelled");

  const cleared = await callRoute({
    method: "POST",
    path: "/api/threads/thread-1/side-chat/clear",
    threadSideChatService,
  });
  assert.equal(cleared.sent.body.sideChat.messages.length, 0);
  assert.equal(cleared.sent.body.sideChat.candidates.length, 0);
});
