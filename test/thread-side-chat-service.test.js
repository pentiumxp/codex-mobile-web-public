"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createThreadSideChatService,
} = require("../adapters/thread-side-chat-service");

function tempFile(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-thread-side-chat-"));
  return path.join(dir, name);
}

function deterministicIds() {
  let count = 0;
  return (prefix) => `${prefix}_${++count}`;
}

test("side chat draft is persisted server-side per thread and profile scope", async () => {
  const storageFile = tempFile("side-chats.json");
  const ids = deterministicIds();
  const first = createThreadSideChatService({
    storageFile,
    scopeId: "profile-a",
    idGenerator: ids,
    now: () => 1000,
  });

  await first.updateDraft("thread-a", { text: "thinking through a bug" });

  const restored = createThreadSideChatService({
    storageFile,
    scopeId: "profile-a",
    idGenerator: ids,
  });
  assert.equal(restored.get("thread-a").draft.text, "thinking through a bug");
  assert.equal(restored.get("thread-b").draft.text, "");

  const otherProfile = createThreadSideChatService({
    storageFile,
    scopeId: "profile-b",
    idGenerator: ids,
  });
  assert.equal(otherProfile.get("thread-a").draft.text, "");
  assert.equal(restored.get("thread-a").persistence, "server");
});

test("side chat messages persist and do not require browser storage", async () => {
  const storageFile = tempFile("side-chats.json");
  const service = createThreadSideChatService({
    storageFile,
    scopeId: "profile-a",
    idGenerator: deterministicIds(),
    now: () => 2000,
  });

  const result = await service.addMessage("thread-a", {
    role: "user",
    text: "Do not steer the current turn yet.",
    idempotencyKey: "message-1",
  });
  const replay = await service.addMessage("thread-a", {
    role: "user",
    text: "Do not duplicate.",
    idempotencyKey: "message-1",
  });

  assert.equal(result.message.id, replay.message.id);
  assert.equal(service.get("thread-a").messages.length, 1);
  assert.equal(JSON.parse(fs.readFileSync(storageFile, "utf8")).sideChats.length, 1);
});

test("side chat candidates queue idempotently without applying to the main thread", async () => {
  const service = createThreadSideChatService({
    storageFile: tempFile("side-chats.json"),
    scopeId: "profile-a",
    idGenerator: deterministicIds(),
    now: () => 3000,
  });

  const created = await service.createCandidate("thread-a", {
    title: "Follow-up",
    body: "After the current turn completes, verify the keyboard behavior.",
    idempotencyKey: "candidate-1",
  });
  const queued = await service.queueCandidate("thread-a", created.candidate.id, {
    mode: "autoSendWhenIdle",
    idempotencyKey: "queue-1",
  });
  const replay = await service.queueCandidate("thread-a", created.candidate.id, {
    mode: "confirmWhenIdle",
    idempotencyKey: "queue-1",
  });

  assert.equal(queued.queue.candidateId, created.candidate.id);
  assert.equal(queued.queue.mode, "autoSendWhenIdle");
  assert.equal(replay.queue.mode, "autoSendWhenIdle");
  assert.equal(service.get("thread-a").candidates[0].status, "queued");
});

test("side chat candidate cancel clears active queue state for that candidate", async () => {
  const service = createThreadSideChatService({
    storageFile: tempFile("side-chats.json"),
    scopeId: "profile-a",
    idGenerator: deterministicIds(),
  });

  const created = await service.createCandidate("thread-a", {
    body: "Check this later.",
  });
  await service.queueCandidate("thread-a", created.candidate.id, {});
  const cancelled = await service.cancelCandidate("thread-a", created.candidate.id);

  assert.equal(cancelled.candidate.status, "cancelled");
  assert.equal(cancelled.queue.status, "cancelled");
});

test("side chat apply starts one main-thread turn and is idempotent", async () => {
  const calls = [];
  const service = createThreadSideChatService({
    storageFile: tempFile("side-chats.json"),
    scopeId: "profile-a",
    idGenerator: deterministicIds(),
    executeCandidate: async (candidate) => {
      calls.push(candidate);
      return { threadId: candidate.threadId, turnId: `turn-${calls.length}` };
    },
  });

  const created = await service.createCandidate("thread-a", {
    body: "Send this to the main thread after review.",
  });
  const applied = await service.applyCandidate("thread-a", created.candidate.id, {
    idempotencyKey: "apply-1",
  });
  const replay = await service.applyCandidate("thread-a", created.candidate.id, {
    idempotencyKey: "apply-1",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].body, "Send this to the main thread after review.");
  assert.equal(applied.candidate.status, "applied");
  assert.equal(applied.candidate.appliedTurnId, "turn-1");
  assert.equal(applied.queue.status, "sent");
  assert.equal(replay.candidate.appliedTurnId, "turn-1");
  assert.equal(service.get("thread-a").candidates[0].appliedTurnId, "turn-1");
});

test("side chat auto-send queue applies only for autoSendWhenIdle", async () => {
  const calls = [];
  const service = createThreadSideChatService({
    storageFile: tempFile("side-chats.json"),
    scopeId: "profile-a",
    idGenerator: deterministicIds(),
    executeCandidate: async (candidate) => {
      calls.push(candidate);
      return { threadId: candidate.threadId, turnId: `turn-${calls.length}` };
    },
  });

  const confirm = await service.createCandidate("thread-a", { body: "Wait for confirmation." });
  await service.queueCandidate("thread-a", confirm.candidate.id, {
    mode: "confirmWhenIdle",
    idempotencyKey: "queue-confirm",
  });
  const skipped = await service.maybeApplyQueuedCandidate("thread-a");
  assert.equal(skipped.skipped, true);
  assert.equal(calls.length, 0);

  const auto = await service.createCandidate("thread-a", { body: "Auto send when idle." });
  await service.queueCandidate("thread-a", auto.candidate.id, {
    mode: "autoSendWhenIdle",
    idempotencyKey: "queue-auto",
  });
  const applied = await service.maybeApplyQueuedCandidate("thread-a");
  const replay = await service.maybeApplyQueuedCandidate("thread-a");

  assert.equal(applied.skipped, false);
  assert.equal(applied.candidate.status, "applied");
  assert.equal(applied.queue.status, "sent");
  assert.equal(calls.length, 1);
  assert.equal(replay.skipped, true);
  assert.equal(calls.length, 1);
});

test("side chat service recovers from corrupt server store with empty state", () => {
  const storageFile = tempFile("side-chats.json");
  fs.writeFileSync(storageFile, "{not-json", "utf8");
  const service = createThreadSideChatService({
    storageFile,
    scopeId: "profile-a",
  });

  const state = service.get("thread-a");
  assert.equal(state.threadId, "thread-a");
  assert.deepEqual(state.messages, []);
  assert.equal(state.draft.text, "");
});
