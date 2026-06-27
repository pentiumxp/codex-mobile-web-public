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

test("missing task-card store is treated as first-run empty state", () => {
  const service = createThreadTaskCardService({ storageFile: tempFile("missing-cards.json") });

  assert.deepEqual(service.listForThread("thread-src"), []);
  assert.equal(service.pendingCountForThread("thread-src"), 0);
  assert.deepEqual(service.pendingCountsForThread("thread-src"), {
    pendingTotal: 0,
    pendingIncoming: 0,
    pendingOutgoing: 0,
  });
});

test("malformed task-card store fails closed instead of returning empty state", async () => {
  const storageFile = tempFile("malformed-cards.json");
  fs.writeFileSync(storageFile, "{ not json", "utf8");
  const service = createThreadTaskCardService({ storageFile });

  assert.throws(() => service.listForThread("thread-src"), /task_card_store_malformed_json/);
  assert.throws(() => service.pendingCountsForThread("thread-src"), /task_card_store_malformed_json/);
  await assert.rejects(
    () => service.create({
      sourceWorkspaceId: "finance",
      sourceThreadId: "thread-src",
      targetWorkspaceId: "ops",
      targetThreadId: "thread-dst",
      idempotencyKey: "malformed:1",
      format: "markdown",
      title: "Need verification",
      summary: "Please verify the mapping.",
      body: "Detailed request.",
    }),
    /task_card_store_malformed_json/,
  );
  assert.equal(fs.readFileSync(storageFile, "utf8"), "{ not json");
});

test("wrong-shaped task-card store fails closed", () => {
  const storageFile = tempFile("wrong-shape-cards.json");
  fs.writeFileSync(storageFile, JSON.stringify({ cards: {}, workflows: [] }), "utf8");
  const service = createThreadTaskCardService({ storageFile });

  assert.throws(() => service.listForThread("thread-src"), /task_card_store_invalid_shape/);
  assert.throws(() => service.get("missing", "thread-src"), /task_card_store_invalid_shape/);
});

test("unreadable task-card store fails closed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-thread-task-card-dir-"));
  const service = createThreadTaskCardService({ storageFile: dir });

  assert.throws(() => service.pendingCountForThread("thread-src"), /task_card_store_unreadable/);
});

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
  assert.equal(card.message.body, "Detailed request.");
  assert.equal(service.listForThread("thread-src").length, 1);
  assert.equal(service.listForThread("thread-dst").length, 1);
  const sourceListCard = service.listForThread("thread-src")[0];
  const targetListCard = service.listForThread("thread-dst")[0];
  assert.equal(sourceListCard.threadRole, "source");
  assert.equal(targetListCard.threadRole, "target");
  assert.equal(sourceListCard.message.body, undefined);
  assert.equal(sourceListCard.message.bodyOmitted, true);
  assert.equal(sourceListCard.message.bodyChars, "Detailed request.".length);
  assert.equal(service.get(card.id, "thread-src").message.body, "Detailed request.");
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

test("normalizeCreateRequest validates optional reasoning effort", () => {
  assert.equal(normalizeCreateRequest({
    sourceWorkspaceId: "codex",
    sourceThreadId: "thread-src",
    targetWorkspaceId: "audit",
    targetThreadId: "thread-audit",
    idempotencyKey: "reasoning:xhigh",
    format: "markdown",
    title: "Deep audit",
    summary: "Run deep audit.",
    body: "Body.",
    reasoning_effort: "XHIGH",
  }).reasoningEffort, "xhigh");
  assert.throws(
    () => normalizeCreateRequest({
      sourceWorkspaceId: "codex",
      sourceThreadId: "thread-src",
      targetWorkspaceId: "audit",
      targetThreadId: "thread-audit",
      idempotencyKey: "reasoning:bad",
      format: "markdown",
      title: "Deep audit",
      summary: "Run deep audit.",
      body: "Body.",
      reasoningEffort: "deepest",
    }),
    /reasoning_effort_invalid/,
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

  assert.equal(created.requiresReturn, true);
  assert.equal(created.terminal, false);
  assert.equal(created.ackPolicy, "return_required");
  const result = await service.approve(created.id, "thread-dst");
  assert.equal(result.card.status, "approved");
  assert.equal(result.card.injectedTurnId, "turn-approved");
  assert.equal(executions.length, 1);
  assert.match(executions[0].message.text, /\[Cross-thread task card approved\]/);
  assert.match(executions[0].message.text, /Task card id: ttc_/);
  assert.match(executions[0].message.text, /Return required:/);
  const stored = service.get(created.id, "thread-dst");
  assert.equal(stored.executionLease.status, "active");
  assert.equal(stored.executionLease.resumeRequired, true);
  assert.equal(stored.executionLease.sourceThreadId, "thread-src");
  assert.equal(stored.executionLease.targetThreadId, "thread-dst");
  assert.equal(stored.executionLease.injectedTurnId, "turn-approved");
  assert.equal(stored.executionLease.currentTurnId, "turn-approved");
});

test("ordinary user interruption resumes the active task-card execution lease", async () => {
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card, message) => {
      executions.push({ card, message });
      return { threadId: card.target.threadId, turnId: `turn-exec-${executions.length}` };
    },
  });
  const created = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-home",
    sourceTurnId: "turn-home",
    sourceThreadTitle: "Home AI",
    targetWorkspaceId: "music",
    targetThreadId: "thread-music",
    idempotencyKey: "interruption:resume",
    format: "markdown",
    title: "Repair Music",
    summary: "Repair and return.",
    body: "Long private repair instructions should not be copied into continuation text.",
  });
  const approved = await service.approveFromSource(created.id, "thread-home");
  assert.equal(approved.card.executionLease.status, "active");
  assert.equal(approved.card.executionLease.currentTurnId, "turn-exec-1");

  const resumed = await service.maybeResumeInterruptedTaskCard({
    threadId: "thread-music",
    turnId: "turn-user-question",
    completedAt: "2026-06-25T10:00:00.000Z",
    finalReceiptText: "Answered an unrelated user question.",
  });

  assert.equal(resumed.card.id, created.id);
  assert.equal(resumed.card.status, "approved");
  assert.equal(resumed.card.executionLease.status, "active");
  assert.equal(resumed.card.executionLease.resumeRequired, true);
  assert.equal(resumed.card.executionLease.lastInterruptedTurnId, "turn-user-question");
  assert.equal(resumed.card.executionLease.lastContinuationTurnId, "turn-exec-2");
  assert.equal(resumed.card.executionLease.currentTurnId, "turn-exec-2");
  assert.equal(resumed.card.executionLease.resumeCount, 1);
  assert.equal(executions.length, 2);
  assert.match(executions[1].message.text, /\[Codex Mobile task-card continuation\]/);
  assert.match(executions[1].message.text, new RegExp(`Task card id: ${created.id}`));
  assert.match(executions[1].message.text, /Interrupted ordinary turn completed: turn-user-question/);
  assert.match(executions[1].message.text, /Title: Repair Music/);
  assert.match(executions[1].message.text, /Summary: Repair and return\./);
  assert.doesNotMatch(executions[1].message.text, /Long private repair instructions/);

  const duplicate = await service.maybeResumeInterruptedTaskCard({
    threadId: "thread-music",
    turnId: "turn-user-question",
  });
  assert.equal(duplicate, null);
  assert.equal(executions.length, 2);
});

test("task-card execution turn completion does not resume itself", async () => {
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card) => {
      executions.push(card);
      return { threadId: card.target.threadId, turnId: `turn-card-${executions.length}` };
    },
  });
  const created = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-home",
    targetWorkspaceId: "music",
    targetThreadId: "thread-music",
    idempotencyKey: "interruption:self",
    format: "markdown",
    title: "Repair Music",
    summary: "Repair and return.",
    body: "Body.",
  });
  const approved = await service.approveFromSource(created.id, "thread-home");

  const resumed = await service.maybeResumeInterruptedTaskCard({
    threadId: "thread-music",
    turnId: approved.card.executionLease.currentTurnId,
  });

  assert.equal(resumed, null);
  assert.equal(executions.length, 1);
});

test("pausing or cancelling an execution lease prevents interruption continuation", async () => {
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card) => {
      executions.push(card);
      return { threadId: card.target.threadId, turnId: `turn-${executions.length}` };
    },
  });
  const pausedCard = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-home",
    targetWorkspaceId: "music",
    targetThreadId: "thread-music",
    idempotencyKey: "interruption:pause",
    format: "markdown",
    title: "Pause repair",
    summary: "Repair and return.",
    body: "Body.",
  });
  await service.approveFromSource(pausedCard.id, "thread-home");
  const paused = await service.pauseExecution(pausedCard.id, "thread-music");
  assert.equal(paused.executionLease.status, "paused");
  assert.equal(paused.executionLease.resumeRequired, false);
  assert.equal(await service.maybeResumeInterruptedTaskCard({
    threadId: "thread-music",
    turnId: "turn-user-after-pause",
  }), null);

  const cancelledCard = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-home",
    targetWorkspaceId: "music",
    targetThreadId: "thread-music",
    idempotencyKey: "interruption:cancel",
    format: "markdown",
    title: "Cancel repair",
    summary: "Repair and return.",
    body: "Body.",
  });
  await service.approveFromSource(cancelledCard.id, "thread-home");
  const cancelled = await service.cancelExecution(cancelledCard.id, "thread-home");
  assert.equal(cancelled.executionLease.status, "cancelled");
  assert.equal(cancelled.executionLease.resumeRequired, false);
  assert.equal(await service.maybeResumeInterruptedTaskCard({
    threadId: "thread-music",
    turnId: "turn-user-after-cancel",
  }), null);
  assert.equal(executions.length, 2);
});

test("multiple active task-card leases resume in deterministic oldest-first order", async () => {
  let now = Date.parse("2026-06-25T10:00:00.000Z");
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    now: () => now,
    executeApprovedCard: async (card, message) => {
      executions.push({ card, message });
      return { threadId: card.target.threadId, turnId: `turn-${executions.length}` };
    },
  });
  const first = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-home",
    targetWorkspaceId: "music",
    targetThreadId: "thread-music",
    idempotencyKey: "interruption:queue:first",
    format: "markdown",
    title: "First repair",
    summary: "First.",
    body: "Body.",
  });
  await service.approveFromSource(first.id, "thread-home");
  now += 1000;
  const second = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-home",
    targetWorkspaceId: "music",
    targetThreadId: "thread-music",
    idempotencyKey: "interruption:queue:second",
    format: "markdown",
    title: "Second repair",
    summary: "Second.",
    body: "Body.",
  });
  await service.approveFromSource(second.id, "thread-home");

  const resumed = await service.maybeResumeInterruptedTaskCard({
    threadId: "thread-music",
    turnId: "turn-user-queue",
  });

  assert.equal(resumed.card.id, first.id);
  assert.equal(service.get(first.id, "thread-music").executionLease.resumeCount, 1);
  assert.equal(service.get(second.id, "thread-music").executionLease.resumeCount, 0);
  assert.match(executions[2].message.text, /Title: First repair/);
});

test("approve preserves requested reasoning effort in injected task-card metadata", async () => {
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card, message) => {
      executions.push({ card, message });
      return {
        threadId: card.target.threadId,
        turnId: "turn-xhigh",
        runtime: {
          reasoningEffort: "xhigh",
          requestedReasoningEffort: card.delivery.reasoningEffort,
        },
      };
    },
  });
  const created = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-home",
    sourceTurnId: "turn-home",
    sourceThreadTitle: "Home AI",
    targetWorkspaceId: "audit",
    targetThreadId: "thread-audit",
    idempotencyKey: "deep-audit:xhigh",
    format: "markdown",
    title: "Deep Product Reality audit",
    summary: "Run a deep audit.",
    body: "Audit this surface.",
    reasoningEffort: "xhigh",
  });

  assert.equal(created.delivery.reasoningEffort, "xhigh");
  const result = await service.approveFromSource(created.id, "thread-home");
  assert.equal(result.card.status, "approved");
  assert.equal(result.card.delivery.reasoningEffort, "xhigh");
  assert.equal(result.card.injectionRuntime.reasoningEffort, "xhigh");
  assert.equal(result.card.injectionRuntime.requestedReasoningEffort, "xhigh");
  assert.equal(executions[0].card.delivery.reasoningEffort, "xhigh");
  assert.match(executions[0].message.text, /Requested reasoning effort: xhigh/);
});

test("source-thread direct approval bypasses target pending approval with audit markers", async () => {
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card, message) => {
      executions.push({ card, message });
      return { threadId: card.target.threadId, turnId: "turn-direct" };
    },
  });
  const created = await service.create({
    sourceWorkspaceId: "codex",
    sourceThreadId: "thread-src",
    sourceTurnId: "turn-src",
    sourceThreadTitle: "Codex Mobile",
    targetWorkspaceId: "ops",
    targetThreadId: "thread-dst",
    idempotencyKey: "direct:1",
    format: "markdown",
    title: "Direct optimization request",
    summary: "Run without a target-side approval card.",
    body: "Please inspect the scoped issue and report back.",
  });

  const result = await service.approveFromSource(created.id, "thread-src");
  assert.equal(result.card.status, "approved");
  assert.equal(result.card.injectedTurnId, "turn-direct");
  assert.equal(result.card.delivery.approvalMode, "source_thread_direct");
  assert.equal(result.card.delivery.targetApprovalBypassed, true);
  assert.equal(result.card.audit.targetApprovalBypassed, true);
  assert.equal(result.card.audit.directApprovedByThreadId, "thread-src");
  assert.equal(executions.length, 1);
  assert.match(executions[0].message.text, /\[Cross-thread task card sent by source thread\]/);
  assert.match(executions[0].message.text, /target approval bypassed/);
  assert.match(executions[0].message.text, /Task card id: ttc_/);
  assert.match(executions[0].message.text, /codex_mobile\.return_to_source/);

  const retry = await service.approveFromSource(created.id, "thread-src");
  assert.equal(retry.alreadyApproved, true);
  assert.equal(executions.length, 1);
});

test("source-thread direct approval rejects non-source actors", async () => {
  const service = createThreadTaskCardService({ storageFile: tempFile("cards.json") });
  const created = await service.create({
    sourceWorkspaceId: "codex",
    sourceThreadId: "thread-src",
    targetWorkspaceId: "ops",
    targetThreadId: "thread-dst",
    idempotencyKey: "direct:reject",
    format: "markdown",
    title: "Direct request",
    summary: "Only the source thread can use direct approval.",
    body: "Body.",
  });
  await assert.rejects(
    () => service.approveFromSource(created.id, "thread-dst"),
    /direct_approval_requires_source_thread/,
  );
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

test("autonomous workflow auto-returns to the source when the injected target turn completes", async () => {
  const executions = [];
  const returnEvents = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card, message) => {
      executions.push({ card, message });
      return { threadId: card.target.threadId, turnId: `turn-${executions.length}` };
    },
    onTerminalReturnCard: async (event) => {
      returnEvents.push(event);
      return { status: 200, eventId: `event-${returnEvents.length}` };
    },
  });
  const first = await service.create({
    sourceWorkspaceId: "codex",
    sourceThreadId: "thread-a",
    sourceTurnId: "turn-src",
    sourceThreadTitle: "Codex Mobile",
    targetWorkspaceId: "hermes",
    targetThreadId: "thread-b",
    idempotencyKey: "workflow:auto-return:first",
    format: "markdown",
    title: "Start workflow",
    summary: "Approve once.",
    body: "Please complete this and return the result.",
    workflowMode: "autonomous",
    workflowId: "auto-return-workflow",
  });

  const approved = await service.approve(first.id, "thread-b");
  assert.equal(approved.card.injectedTurnId, "turn-1");
  assert.equal(approved.card.delivery.autoReturnOnCompletion, true);
  assert.equal(approved.card.requiresReturn, true);
  assert.equal(approved.card.terminal, false);
  assert.match(executions[0].message.text, /Auto-return:/);

  const returned = await service.maybeAutoReplyCompletedTurn({
    threadId: "thread-b",
    turnId: "turn-1",
    completedAt: "2026-06-02T09:00:00.000Z",
    finalReceiptText: "Implemented and validated.",
  });

  assert.equal(returned.card.status, "approved");
  assert.equal(returned.card.source.threadId, "thread-b");
  assert.equal(returned.card.target.threadId, "thread-a");
  assert.equal(returned.card.workflow.id, "auto-return-workflow");
  assert.equal(returned.card.delivery.autoReturnOnCompletion, false);
  assert.equal(returned.card.delivery.requiresReturn, false);
  assert.equal(returned.card.delivery.terminal, true);
  assert.equal(returned.card.delivery.ackPolicy, "none");
  assert.equal(returned.card.requiresReturn, false);
  assert.equal(returned.card.terminal, true);
  assert.equal(returned.card.canReply, false);
  assert.equal(returned.card.message.title, "Auto return: Start workflow");
  assert.equal(returned.card.injectedTurnId, "turn-2");
  assert.match(executions[1].message.text, /Implemented and validated/);
  assert.match(executions[1].message.text, /Workflow id: auto-return-workflow/);
  assert.match(executions[1].message.text, /Return policy: terminal receipt/);
  assert.doesNotMatch(executions[1].message.text, /Return required:/);
  assert.doesNotMatch(executions[1].message.text, /when this injected turn completes/);
  const original = service.get(first.id, "thread-b");
  assert.equal(original.autoReplyCardId, returned.card.id);
  assert.deepEqual(returnEvents, [{
    taskCardId: first.id,
    returnCardId: returned.card.id,
    status: "completed",
    title: "Auto return: Start workflow",
    summary: "Target thread completed and returned the result automatically.",
    metadata: {
      sourceThreadId: "thread-a",
      targetThreadId: "thread-b",
      workflowId: "auto-return-workflow",
      terminal: true,
      ackPolicy: "none",
    },
  }]);
  assert.equal(service.get(returned.card.id, "thread-a").audit.homeAiDeliveryReturnEventStatus, "sent");

  const duplicate = await service.maybeAutoReplyCompletedTurn({
    threadId: "thread-b",
    turnId: "turn-1",
    completedAt: "2026-06-02T09:00:00.000Z",
    finalReceiptText: "Implemented and validated.",
  });
  assert.equal(duplicate, null);
  assert.equal(executions.length, 2);
  assert.equal(returnEvents.length, 1);

  const recursive = await service.maybeAutoReplyCompletedTurn({
    threadId: "thread-a",
    turnId: "turn-2",
    completedAt: "2026-06-02T09:01:00.000Z",
    finalReceiptText: "Returned receipt was injected.",
  });
  assert.equal(recursive, null);
  assert.equal(executions.length, 2);
});

test("autonomous workflow auto-return titles do not stack prefixes", async () => {
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card) => ({ threadId: card.target.threadId, turnId: card.id }),
  });
  const first = await service.create({
    sourceWorkspaceId: "codex",
    sourceThreadId: "thread-a",
    sourceTurnId: "turn-src",
    sourceThreadTitle: "Codex Mobile",
    targetWorkspaceId: "hermes",
    targetThreadId: "thread-b",
    idempotencyKey: "workflow:auto-return:stacked-title",
    format: "markdown",
    title: "Auto return: Auto return: Auto return: Auto return: Evaluate compaction",
    summary: "Approve once.",
    body: "Please complete this and return the result.",
    workflowMode: "autonomous",
    workflowId: "auto-return-title-workflow",
  });

  const approved = await service.approve(first.id, "thread-b");
  const returned = await service.maybeAutoReplyCompletedTurn({
    threadId: "thread-b",
    turnId: approved.card.injectedTurnId,
    completedAt: "2026-06-02T09:00:00.000Z",
    finalReceiptText: "Completed.",
  });

  assert.equal(returned.card.message.title, "Auto return: Evaluate compaction");
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

test("reply can return an approved implementation card and is idempotent", async () => {
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card, message) => {
      executions.push({ card, message });
      return { threadId: card.target.threadId, turnId: "turn-approved-return" };
    },
  });
  const created = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-home",
    sourceTurnId: "turn-home",
    sourceThreadTitle: "Home AI",
    targetWorkspaceId: "note",
    targetThreadId: "thread-note",
    idempotencyKey: "home-ai:note:manual",
    format: "markdown",
    title: "Repair Note",
    summary: "Repair and return.",
    body: "Please repair this and return a card.",
  });
  const approved = await service.approveFromSource(created.id, "thread-home");
  assert.equal(approved.card.status, "approved");
  assert.equal(approved.card.canReply, false);
  assert.equal(service.get(created.id, "thread-note").canReply, true);

  const returned = await service.reply(created.id, "thread-note", {
    idempotencyKey: "return:home-ai:note:manual",
    format: "markdown",
    title: "Return: Repair Note",
    status: "completed",
    summary: "completed",
    body: "Completed and validated.",
    sourceWorkspaceId: "note",
    sourceThreadId: "thread-note",
    sourceThreadTitle: "Note",
  });
  assert.equal(returned.card.status, "replied");
  assert.equal(returned.card.executionLease.status, "completed");
  assert.equal(returned.card.executionLease.resumeRequired, false);
  assert.equal(returned.card.executionLease.completedByReplyCardId, undefined);
  assert.equal(returned.replyCard.status, "approved");
  assert.equal(returned.replyCard.source.threadId, "thread-note");
  assert.equal(returned.replyCard.target.threadId, "thread-home");
  assert.equal(returned.replyCard.delivery.returnToSource, true);
  assert.equal(returned.replyCard.delivery.returnStatus, "completed");
  assert.equal(returned.replyCard.delivery.requiresReturn, false);
  assert.equal(returned.replyCard.delivery.terminal, true);
  assert.equal(returned.replyCard.delivery.ackPolicy, "none");
  assert.equal(returned.replyCard.requiresReturn, false);
  assert.equal(returned.replyCard.terminal, true);
  assert.equal(returned.replyCard.canReply, false);
  assert.equal(returned.replyCard.injectedTurnId, "turn-approved-return");
  assert.equal(returned.replyCard.canApprove, false);
  assert.match(executions[1].message.text, /Return policy: terminal receipt/);
  assert.doesNotMatch(executions[1].message.text, /Return required:/);
  assert.deepEqual(service.pendingCountsForThread("thread-home"), {
    pendingTotal: 0,
    pendingIncoming: 0,
    pendingOutgoing: 0,
  });

  const duplicate = await service.reply(created.id, "thread-note", {
    idempotencyKey: "return:home-ai:note:manual",
    format: "markdown",
    title: "Return: Repair Note",
    status: "completed",
    summary: "completed",
    body: "Completed and validated.",
  });
  assert.equal(duplicate.replyCard.id, returned.replyCard.id);
  assert.equal(duplicate.replyCard.status, "approved");
  assert.equal(service.listForThread("thread-home").filter((card) => card.audit && card.audit.replyToCardId === created.id).length, 1);
});

test("explicit returnToSource replies are terminal and cannot start acknowledgement loops", async () => {
  const executions = [];
  const returnEvents = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card, message) => {
      executions.push({ card, message });
      return { threadId: card.target.threadId, turnId: `turn-${executions.length}` };
    },
    onTerminalReturnCard: async (event) => {
      returnEvents.push(event);
      return { status: 200, eventId: `event-${returnEvents.length}` };
    },
  });
  const repairCard = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-home",
    sourceTurnId: "turn-home",
    sourceThreadTitle: "Home AI",
    targetWorkspaceId: "music",
    targetThreadId: "thread-music",
    idempotencyKey: "music:repair:loop",
    format: "markdown",
    title: "Repair Music diagnostics",
    summary: "Repair and return.",
    body: "Please repair the diagnostic path and return a card.",
    workflowMode: "autonomous",
    workflowId: "music-loop-workflow",
  });

  await service.approveFromSource(repairCard.id, "thread-home");
  const returned = await service.reply(repairCard.id, "thread-music", {
    idempotencyKey: "music:return:completed",
    format: "markdown",
    title: "Music repair completed",
    summary: "completed",
    body: "Completed and validated.",
    returnToSource: true,
  });

  assert.equal(returned.replyCard.status, "approved");
  assert.equal(returned.replyCard.delivery.returnToSource, true);
  assert.equal(returned.replyCard.delivery.requiresReturn, false);
  assert.equal(returned.replyCard.delivery.terminal, true);
  assert.equal(returned.replyCard.delivery.ackPolicy, "none");
  assert.equal(returned.replyCard.requiresReturn, false);
  assert.equal(returned.replyCard.terminal, true);
  assert.equal(returned.replyCard.canReply, false);
  assert.equal(returned.replyCard.executionLease, null);
  assert.match(executions[1].message.text, /Return policy: terminal receipt/);
  assert.doesNotMatch(executions[1].message.text, /Return required:/);
  assert.deepEqual(returnEvents, [{
    taskCardId: repairCard.id,
    returnCardId: returned.replyCard.id,
    status: "completed",
    title: "Music repair completed",
    summary: "completed",
    metadata: {
      sourceThreadId: "thread-home",
      targetThreadId: "thread-music",
      workflowId: "music-loop-workflow",
      terminal: true,
      ackPolicy: "none",
    },
  }]);
  const duplicateReturn = await service.reply(repairCard.id, "thread-music", {
    idempotencyKey: "music:return:completed",
    format: "markdown",
    title: "Music repair completed",
    summary: "completed",
    body: "Completed and validated.",
    returnToSource: true,
  });
  assert.equal(duplicateReturn.replyCard.id, returned.replyCard.id);
  assert.equal(returnEvents.length, 1);

  await assert.rejects(
    () => service.reply(returned.replyCard.id, "thread-home", {
      idempotencyKey: "home-ai:ack:should-stop",
      format: "markdown",
      title: "Ack: Music repair completed",
      summary: "acknowledged",
      body: "Acknowledged.",
      returnToSource: true,
    }),
    /task_card_terminal_no_return_required/,
  );
  assert.equal(executions.length, 2);
  assert.equal(returnEvents.length, 1);
});

test("terminal return cards report bounded Home AI delivery events for supported statuses", async () => {
  const events = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card) => ({ threadId: card.target.threadId, turnId: `turn-${card.id}` }),
    onTerminalReturnCard: async (event) => {
      events.push(event);
      return { status: 200 };
    },
  });
  for (const status of ["blocked", "redirected", "partially_completed", "rejected"]) {
    const card = await service.create({
      sourceWorkspaceId: "home-ai",
      sourceThreadId: `thread-home-${status}`,
      sourceTurnId: `turn-home-${status}`,
      sourceThreadTitle: "Home AI",
      targetWorkspaceId: "plugin",
      targetThreadId: `thread-plugin-${status}`,
      idempotencyKey: `return-status:${status}`,
      format: "markdown",
      title: `Repair ${status}`,
      summary: "Repair and return.",
      body: "Please repair and return.",
    });
    await service.reply(card.id, `thread-plugin-${status}`, {
      idempotencyKey: `return-status:${status}:reply`,
      format: "markdown",
      title: `Return: ${status}`,
      status,
      summary: status,
      body: "Bounded return body is not part of the Home AI event.",
      returnToSource: true,
    });
  }
  assert.deepEqual(events.map((event) => event.status), ["blocked", "redirected", "partially_completed", "rejected"]);
  assert.equal(events.every((event) => event.metadata.terminal === true && event.metadata.ackPolicy === "none"), true);
  assert.equal(events.some((event) => Object.hasOwn(event, "body")), false);
});

test("Home AI delivery event 404 is recorded without blocking return-card delivery", async () => {
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card) => ({ threadId: card.target.threadId, turnId: "turn-return" }),
    onTerminalReturnCard: async () => {
      const err = new Error("home_ai_autonomous_delivery_task_card_unknown");
      err.statusCode = 404;
      err.responseStatus = 404;
      throw err;
    },
  });
  const card = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-home",
    sourceTurnId: "turn-home",
    sourceThreadTitle: "Home AI",
    targetWorkspaceId: "plugin",
    targetThreadId: "thread-plugin",
    idempotencyKey: "return-event:404",
    format: "markdown",
    title: "Repair plugin",
    summary: "Repair and return.",
    body: "Please repair and return.",
  });

  const returned = await service.reply(card.id, "thread-plugin", {
    idempotencyKey: "return-event:404:reply",
    format: "markdown",
    title: "Return: plugin repair",
    status: "completed",
    summary: "completed",
    body: "Completed.",
    returnToSource: true,
  });

  assert.equal(returned.replyCard.status, "approved");
  const stored = service.get(returned.replyCard.id, "thread-home");
  assert.equal(stored.audit.homeAiDeliveryReturnEventStatus, "unknown_task_card");
  assert.equal(stored.audit.homeAiDeliveryReturnEventHttpStatus, 404);
  assert.equal(stored.delivery.terminal, true);
  assert.equal(stored.requiresReturn, false);
});

test("return_to_source retry approves a previously pending reverse card", async () => {
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card) => {
      executions.push(card);
      return { threadId: card.target.threadId, turnId: `turn-return-${executions.length}` };
    },
  });
  const created = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-home",
    sourceTurnId: "turn-home",
    sourceThreadTitle: "Home AI",
    targetWorkspaceId: "note",
    targetThreadId: "thread-note",
    idempotencyKey: "home-ai:note:old-return",
    format: "markdown",
    title: "Repair Note",
    summary: "Repair and return.",
    body: "Please repair this and return a card.",
  });
  await service.approveFromSource(created.id, "thread-home");

  const pendingReply = await service.reply(created.id, "thread-note", {
    idempotencyKey: "return:retry:old-pending",
    format: "markdown",
    title: "Return: Repair Note",
    summary: "completed",
    body: "Completed and validated.",
  });
  assert.equal(pendingReply.replyCard.status, "pending");
  assert.equal(executions.length, 1);

  const returned = await service.reply(created.id, "thread-note", {
    idempotencyKey: "return:retry:old-pending",
    format: "markdown",
    title: "Return: Repair Note",
    status: "completed",
    summary: "completed",
    body: "Completed and validated.",
  });
  assert.equal(returned.replyCard.id, pendingReply.replyCard.id);
  assert.equal(returned.replyCard.status, "approved");
  assert.equal(returned.replyCard.delivery.returnToSource, true);
  assert.equal(returned.replyCard.delivery.returnStatus, "completed");
  assert.equal(returned.replyCard.delivery.requiresReturn, false);
  assert.equal(returned.replyCard.delivery.terminal, true);
  assert.equal(returned.replyCard.delivery.ackPolicy, "none");
  assert.equal(returned.replyCard.requiresReturn, false);
  assert.equal(returned.replyCard.terminal, true);
  assert.equal(returned.replyCard.canReply, false);
  assert.equal(returned.replyCard.injectedTurnId, "turn-return-2");
  assert.deepEqual(service.pendingCountsForThread("thread-home"), {
    pendingTotal: 0,
    pendingIncoming: 0,
    pendingOutgoing: 0,
  });
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
