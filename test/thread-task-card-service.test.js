"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createThreadTaskCardService,
  normalizeCreateRequest,
} = require("../adapters/thread-task-card-service");

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

test("createMany persists one pending task card per target thread", async () => {
  const service = createThreadTaskCardService({ storageFile: tempFile("cards.json") });
  const cards = await service.createMany({
    sourceWorkspaceId: "finance",
    sourceThreadId: "thread-src",
    sourceTurnId: "turn-src",
    sourceThreadTitle: "Finance close",
    targetWorkspaceIds: {
      "thread-ops": "ops",
      "thread-hermes": "agent",
    },
    targetThreadIds: ["thread-ops", "thread-hermes", "thread-ops"],
    idempotencyKey: "finance:many",
    format: "markdown",
    title: "Need verification",
    summary: "Please verify the mapping.",
    body: "Detailed request.",
  });

  assert.equal(cards.length, 2);
  assert.deepEqual(cards.map((card) => card.target.threadId), ["thread-ops", "thread-hermes"]);
  assert.deepEqual(service.pendingCountsForThread("thread-src"), {
    pendingTotal: 2,
    pendingIncoming: 0,
    pendingOutgoing: 2,
  });
  assert.deepEqual(service.pendingCountsForThread("thread-ops"), {
    pendingTotal: 1,
    pendingIncoming: 1,
    pendingOutgoing: 0,
  });
  assert.deepEqual(service.pendingCountsForThread("thread-hermes"), {
    pendingTotal: 1,
    pendingIncoming: 1,
    pendingOutgoing: 0,
  });
});

test("createMany preserves readable UTF-8 card text and remains idempotent", async () => {
  const service = createThreadTaskCardService({ storageFile: tempFile("cards.json") });
  const request = {
    sourceWorkspaceId: "codex",
    sourceThreadId: "thread-src",
    sourceTurnId: "turn-src",
    sourceThreadTitle: "Codex Mobile",
    targetWorkspaceIds: { "thread-finance": "finance" },
    targetThreadIds: ["thread-finance"],
    idempotencyKey: "appearance-sync:finance",
    format: "markdown",
    title: "同步 Hermes 插件外观设置",
    summary: "请在财务线程同步 Hermes 插件主题和字体设置。",
    body: "启动插件时读取 `pluginTheme` 和 `pluginFontSize`，在初始化前应用，避免闪屏。",
  };

  const first = await service.createMany(request);
  const second = await service.createMany(request);

  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.equal(second[0].id, first[0].id);
  assert.equal(first[0].message.title, request.title);
  assert.equal(first[0].message.summary, request.summary);
  assert.equal(first[0].message.body, request.body);
  assert.equal(service.listForThread("thread-finance").length, 1);
});

test("create rejects likely encoding-damaged task-card text before persistence", async () => {
  const service = createThreadTaskCardService({ storageFile: tempFile("cards.json") });
  await assert.rejects(
    () => service.create({
      sourceWorkspaceId: "codex",
      sourceThreadId: "thread-src",
      targetWorkspaceId: "finance",
      targetThreadId: "thread-finance",
      idempotencyKey: "bad-encoding:1",
      format: "markdown",
      title: "?? Hermes ?????? v133",
      summary: "?????? Hermes ????????",
      body: "????????????????????????????????",
    }),
    /task_card_text_encoding_damaged:title/,
  );
  assert.equal(service.listForThread("thread-src").length, 0);
  assert.equal(service.listForThread("thread-finance").length, 0);
});

test("create bounds oversized source thread title metadata instead of failing the card", async () => {
  const service = createThreadTaskCardService({ storageFile: tempFile("cards.json") });
  const card = await service.create({
    sourceWorkspaceId: "codex",
    sourceThreadId: "thread-src",
    sourceThreadTitle: "A".repeat(260),
    targetWorkspaceId: "finance",
    targetThreadId: "thread-finance",
    idempotencyKey: "long-source-title:1",
    format: "markdown",
    title: "Sync appearance",
    summary: "Please verify the mapping.",
    body: "Detailed request.",
  });

  assert.equal(card.source.title.length, 200);
  assert.equal(card.status, "pending");
});

test("normalizeCreateRequest rejects replacement-character mojibake", () => {
  assert.throws(
    () => normalizeCreateRequest({
      sourceWorkspaceId: "codex",
      sourceThreadId: "thread-src",
      targetWorkspaceId: "finance",
      targetThreadId: "thread-finance",
      idempotencyKey: "bad-encoding:2",
      format: "markdown",
      title: "Sync appearance",
      summary: "Contains damaged text",
      body: "Hermes plugin title: �",
    }),
    /task_card_text_encoding_damaged:body/,
  );
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

test("autonomous workflow requires first target approval, then auto-approves follow-up cards for the same thread pair", async () => {
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card, message) => {
      executions.push({ card, message });
      return { threadId: card.target.threadId, turnId: `turn-auto-${executions.length}` };
    },
  });
  const first = await service.create({
    sourceWorkspaceId: "codex",
    sourceThreadId: "thread-a",
    sourceTurnId: "turn-src",
    sourceThreadTitle: "Codex Mobile",
    targetWorkspaceId: "hermes",
    targetThreadId: "thread-b",
    idempotencyKey: "workflow:first",
    format: "markdown",
    title: "Start workflow",
    summary: "Approve once to allow workflow cards.",
    body: "Please start the workflow.",
    workflowMode: "autonomous",
  });

  assert.equal(first.status, "pending");
  assert.equal(first.workflow.mode, "autonomous");
  assert.equal(first.workflow.authorized, false);
  assert.equal(executions.length, 0);

  const approved = await service.approve(first.id, "thread-b");
  const workflowId = approved.card.workflow.id;
  assert.equal(approved.card.status, "approved");
  assert.equal(approved.card.workflow.authorized, true);
  assert.equal(executions.length, 1);
  assert.match(executions[0].message.text, new RegExp(`Workflow id: ${workflowId}`));

  const followUp = await service.create({
    sourceWorkspaceId: "codex",
    sourceThreadId: "thread-a",
    sourceTurnId: "turn-src-2",
    sourceThreadTitle: "Codex Mobile",
    targetWorkspaceId: "hermes",
    targetThreadId: "thread-b",
    idempotencyKey: "workflow:second",
    format: "markdown",
    title: "Follow up",
    summary: "This card should auto-run.",
    body: "Continue without another manual approval.",
    workflowMode: "autonomous",
    workflowId,
  });

  assert.equal(followUp.status, "approved");
  assert.equal(followUp.workflow.authorized, true);
  assert.equal(followUp.injectedTurnId, "turn-auto-2");
  assert.equal(executions.length, 2);
  assert.deepEqual(service.pendingCountsForThread("thread-b"), {
    pendingTotal: 0,
    pendingIncoming: 0,
    pendingOutgoing: 0,
  });
});

test("autonomous workflow auto-approval is scoped to the same two thread ids", async () => {
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card) => {
      executions.push(card);
      return { threadId: card.target.threadId, turnId: `turn-${executions.length}` };
    },
  });
  const first = await service.create({
    sourceWorkspaceId: "codex",
    sourceThreadId: "thread-a",
    targetWorkspaceId: "hermes",
    targetThreadId: "thread-b",
    idempotencyKey: "workflow:scoped:first",
    format: "markdown",
    title: "Start workflow",
    summary: "Approve once.",
    body: "Please start the workflow.",
    workflowMode: "autonomous",
    workflowId: "shared-workflow",
  });
  await service.approve(first.id, "thread-b");

  const reverse = await service.create({
    sourceWorkspaceId: "hermes",
    sourceThreadId: "thread-b",
    targetWorkspaceId: "codex",
    targetThreadId: "thread-a",
    idempotencyKey: "workflow:scoped:reverse",
    format: "markdown",
    title: "Reverse follow-up",
    summary: "Same pair, reverse direction.",
    body: "Report back.",
    workflowMode: "autonomous",
    workflowId: "shared-workflow",
  });
  assert.equal(reverse.status, "approved");
  assert.equal(reverse.target.threadId, "thread-a");
  assert.equal(executions.length, 2);

  const unrelated = await service.create({
    sourceWorkspaceId: "codex",
    sourceThreadId: "thread-a",
    targetWorkspaceId: "finance",
    targetThreadId: "thread-c",
    idempotencyKey: "workflow:scoped:other",
    format: "markdown",
    title: "Other target",
    summary: "Same workflow id but different pair.",
    body: "This must still wait for approval.",
    workflowMode: "autonomous",
    workflowId: "shared-workflow",
  });
  assert.equal(unrelated.status, "pending");
  assert.equal(unrelated.canApprove, false);
  assert.equal(service.get(unrelated.id, "thread-c").canApprove, true);
  assert.equal(executions.length, 2);
});

test("approve persists a non-pending in-flight state before injected execution finishes", async () => {
  let markExecutionStarted;
  let releaseExecution;
  const executionStarted = new Promise((resolve) => { markExecutionStarted = resolve; });
  const executionRelease = new Promise((resolve) => { releaseExecution = resolve; });
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card) => {
      markExecutionStarted();
      await executionRelease;
      return { threadId: card.target.threadId, turnId: "turn-after-inflight" };
    },
  });
  const created = await service.create({
    sourceWorkspaceId: "finance",
    sourceThreadId: "thread-src",
    sourceTurnId: "turn-src",
    sourceThreadTitle: "Finance close",
    targetWorkspaceId: "ops",
    targetThreadId: "thread-dst",
    idempotencyKey: "finance:approve-inflight",
    format: "markdown",
    title: "Need verification",
    summary: "Please verify the mapping.",
    body: "Detailed request.",
  });

  const approving = service.approve(created.id, "thread-dst");
  await executionStarted;
  const during = service.get(created.id, "thread-dst");
  assert.equal(during.status, "approving");
  assert.equal(during.canApprove, false);
  assert.deepEqual(service.pendingCountsForThread("thread-dst"), {
    pendingTotal: 0,
    pendingIncoming: 0,
    pendingOutgoing: 0,
  });

  releaseExecution();
  const result = await approving;
  assert.equal(result.card.status, "approved");
  assert.equal(result.card.injectedTurnId, "turn-after-inflight");
});

test("approve restores pending state if injected execution fails before acceptance", async () => {
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async () => {
      throw new Error("turn/start unavailable");
    },
  });
  const created = await service.create({
    sourceWorkspaceId: "finance",
    sourceThreadId: "thread-src",
    sourceTurnId: "turn-src",
    sourceThreadTitle: "Finance close",
    targetWorkspaceId: "ops",
    targetThreadId: "thread-dst",
    idempotencyKey: "finance:approve-failure",
    format: "markdown",
    title: "Need verification",
    summary: "Please verify the mapping.",
    body: "Detailed request.",
  });

  await assert.rejects(() => service.approve(created.id, "thread-dst"), /turn\/start unavailable/);
  const after = service.get(created.id, "thread-dst");
  assert.equal(after.status, "pending");
  assert.equal(after.canApprove, true);
  assert.equal(after.audit.approvalError, "turn/start unavailable");
  assert.deepEqual(service.pendingCountsForThread("thread-dst"), {
    pendingTotal: 1,
    pendingIncoming: 1,
    pendingOutgoing: 0,
  });
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

test("reply rejects likely encoding-damaged text without settling the original card", async () => {
  const service = createThreadTaskCardService({ storageFile: tempFile("cards.json") });
  const created = await service.create({
    sourceWorkspaceId: "finance",
    sourceThreadId: "thread-src",
    sourceTurnId: "turn-src",
    sourceThreadTitle: "Finance close",
    targetWorkspaceId: "ops",
    targetThreadId: "thread-dst",
    idempotencyKey: "finance:bad-reply",
    format: "markdown",
    title: "Need verification",
    summary: "Please verify the mapping.",
    body: "Detailed request.",
  });

  await assert.rejects(
    () => service.reply(created.id, "thread-dst", {
      idempotencyKey: "reply:bad-encoding",
      format: "markdown",
      title: "?? ??????",
      summary: "????????",
      body: "????????????????",
      sourceWorkspaceId: "ops",
      sourceThreadId: "thread-dst",
      sourceThreadTitle: "Ops review",
    }),
    /task_card_text_encoding_damaged:title/,
  );
  assert.equal(service.get(created.id, "thread-dst").status, "pending");
});
