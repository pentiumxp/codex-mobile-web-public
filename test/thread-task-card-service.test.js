"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { createThreadTaskCardService } = require("../adapters/thread-task-card-service");

function tempFile(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-thread-task-card-"));
  return path.join(dir, name);
}

test("create persists a pending task card and lists it for source and target threads", async () => {
  const service = createThreadTaskCardService({ storageFile: tempFile("cards.json") });
  const card = await service.create({
    sourceWorkspaceId: "finance",
    sourceThreadId: "thread-src",
    sourceTurnId: "turn-src",
    sourceThreadTitle: "Finance close",
    targetWorkspaceId: "ops",
    targetThreadId: "thread-dst",
    idempotencyKey: "finance:1",
    format: "markdown",
    title: "Need verification",
    summary: "Please verify the mapping.",
    body: "Detailed request.",
  });

  assert.equal(card.status, "pending");
  assert.equal(service.listForThread("thread-src").length, 1);
  assert.equal(service.listForThread("thread-dst").length, 1);
  assert.equal(service.listForThread("thread-src")[0].threadRole, "source");
  assert.equal(service.listForThread("thread-dst")[0].threadRole, "target");
  assert.deepEqual(service.pendingCountsForThread("thread-src"), {
    pendingTotal: 1,
    pendingIncoming: 0,
    pendingOutgoing: 1,
  });
  assert.deepEqual(service.pendingCountsForThread("thread-dst"), {
    pendingTotal: 1,
    pendingIncoming: 1,
    pendingOutgoing: 0,
  });
});

test("approve runs injected execution and marks the card approved", async () => {
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card, message) => {
      executions.push({ card, message });
      return { threadId: card.target.threadId, turnId: "turn-approved" };
    },
  });
  const created = await service.create({
    sourceWorkspaceId: "finance",
    sourceThreadId: "thread-src",
    sourceTurnId: "turn-src",
    sourceThreadTitle: "Finance close",
    targetWorkspaceId: "ops",
    targetThreadId: "thread-dst",
    idempotencyKey: "finance:2",
    format: "markdown",
    title: "Need verification",
    summary: "Please verify the mapping.",
    body: "Detailed request.",
  });

  const result = await service.approve(created.id, "thread-dst");
  assert.equal(result.card.status, "approved");
  assert.equal(result.card.injectedTurnId, "turn-approved");
  assert.equal(executions.length, 1);
  assert.match(executions[0].message.text, /\[Cross-thread task card approved\]/);
});

test("reply creates a reverse-direction pending card", async () => {
  const service = createThreadTaskCardService({ storageFile: tempFile("cards.json") });
  const created = await service.create({
    sourceWorkspaceId: "finance",
    sourceThreadId: "thread-src",
    sourceTurnId: "turn-src",
    sourceThreadTitle: "Finance close",
    targetWorkspaceId: "ops",
    targetThreadId: "thread-dst",
    idempotencyKey: "finance:3",
    format: "markdown",
    title: "Need verification",
    summary: "Please verify the mapping.",
    body: "Detailed request.",
  });

  const result = await service.reply(created.id, "thread-dst", {
    idempotencyKey: "reply:3",
    format: "markdown",
    title: "Reply: Need verification",
    summary: "Confirmed.",
    body: "Confirmed.",
    sourceWorkspaceId: "ops",
    sourceThreadId: "thread-dst",
    sourceThreadTitle: "Ops review",
  });

  assert.equal(result.card.status, "replied");
  assert.equal(result.replyCard.status, "pending");
  assert.equal(result.replyCard.source.threadId, "thread-dst");
  assert.equal(result.replyCard.target.threadId, "thread-src");
});
