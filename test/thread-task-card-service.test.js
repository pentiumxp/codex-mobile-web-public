"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createThreadTaskCardService,
  normalizeCreateRequest,
} = require("../services/task-cards/thread-task-card-service");

const canonicalTaskCardService = require("../services/task-cards/thread-task-card-service");
const adapterTaskCardService = require("../adapters/thread-task-card-service");
const taskCardServiceSource = fs.readFileSync(path.join(__dirname, "..", "services", "task-cards", "thread-task-card-service.js"), "utf8");

function tempFile(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-thread-task-card-"));
  return path.join(dir, name);
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} not found`);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
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

test("task-card service adapter re-exports the canonical service boundary", () => {
  assert.equal(adapterTaskCardService.createThreadTaskCardService, canonicalTaskCardService.createThreadTaskCardService);
  assert.equal(adapterTaskCardService.normalizeCreateRequest, canonicalTaskCardService.normalizeCreateRequest);
});

test("task-card store writes use unique temp files for concurrent writers", () => {
  const saveStore = functionBody(taskCardServiceSource, "saveStore");
  assert.match(saveStore, /crypto\.randomBytes/);
  assert.match(saveStore, /process\.pid/);
  assert.doesNotMatch(saveStore, /\$\{file\}\.tmp/);
});

test("task-card store writes are serialized across service instances", async () => {
  const storageFile = tempFile("cards.json");
  const serviceA = createThreadTaskCardService({
    storageFile,
    idGenerator: () => "ttc_writer_a",
  });
  const serviceB = createThreadTaskCardService({
    storageFile,
    idGenerator: () => "ttc_writer_b",
  });

  await Promise.all([
    serviceA.create({
      sourceWorkspaceId: "movie",
      sourceThreadId: "thread-src",
      sourceTurnId: "turn-src",
      sourceThreadTitle: "Movie",
      targetWorkspaceId: "movie-deploy",
      targetThreadId: "thread-dst-a",
      idempotencyKey: "movie:deploy:writer-a",
      format: "markdown",
      title: "Deploy Movie A",
      summary: "Deploy request A.",
      body: "Deploy request A.",
    }),
    serviceB.create({
      sourceWorkspaceId: "movie",
      sourceThreadId: "thread-src",
      sourceTurnId: "turn-src",
      sourceThreadTitle: "Movie",
      targetWorkspaceId: "movie-deploy",
      targetThreadId: "thread-dst-b",
      idempotencyKey: "movie:deploy:writer-b",
      format: "markdown",
      title: "Deploy Movie B",
      summary: "Deploy request B.",
      body: "Deploy request B.",
    }),
  ]);

  const store = JSON.parse(fs.readFileSync(storageFile, "utf8"));
  const ids = store.cards.map((card) => card.id).sort();
  assert.deepEqual(ids, ["ttc_writer_a", "ttc_writer_b"]);
  assert.equal(fs.existsSync(`${storageFile}.lock`), false);
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
  const batchedCounts = service.pendingCountsForThreads(["thread-src", "thread-dst", "thread-src"]);
  assert.deepEqual(batchedCounts.get("thread-src"), {
    pendingTotal: 1,
    pendingIncoming: 0,
    pendingOutgoing: 1,
  });
  assert.deepEqual(batchedCounts.get("thread-dst"), {
    pendingTotal: 1,
    pendingIncoming: 1,
    pendingOutgoing: 0,
  });
});

test("task-card read helpers reuse unchanged store snapshots", async () => {
  const storageFile = tempFile("cached-cards.json");
  let readCount = 0;
  const originalReadFileSync = fs.readFileSync;
  const service = createThreadTaskCardService({ storageFile });
  const card = await service.create({
    sourceWorkspaceId: "finance",
    sourceThreadId: "thread-src",
    sourceTurnId: "turn-src",
    sourceThreadTitle: "Finance close",
    targetWorkspaceId: "ops",
    targetThreadId: "thread-dst",
    idempotencyKey: "finance:cached-read",
    format: "markdown",
    title: "Need verification",
    summary: "Please verify the mapping.",
    body: "Detailed request.",
  });

  fs.readFileSync = function patchedReadFileSync(file, ...args) {
    if (file === storageFile) readCount += 1;
    return originalReadFileSync.call(this, file, ...args);
  };
  try {
    assert.equal(service.listForThread("thread-src").length, 1);
    assert.equal(service.pendingCountsForThread("thread-src").pendingOutgoing, 1);
    assert.equal(service.get(card.id, "thread-src").id, card.id);
    assert.equal(service.summaryForThread("thread-src").counts.pendingOutgoing, 1);
    assert.equal(readCount, 0);

    const store = JSON.parse(originalReadFileSync(storageFile, "utf8"));
    store.cards[0].message.summary = "Updated externally.";
    fs.writeFileSync(storageFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    assert.equal(service.summaryForThread("thread-src").cards[0].message.summary, "Updated externally.");
    assert.equal(readCount, 1);
  } finally {
    fs.readFileSync = originalReadFileSync;
  }
});

test("task-card secretRef metadata is stored internally but public and injected surfaces stay redacted", async () => {
  const storageFile = tempFile("cards.json");
  const service = createThreadTaskCardService({ storageFile });
  const card = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-src",
    sourceTurnId: "turn-src",
    sourceThreadTitle: "Home AI",
    targetWorkspaceId: "codex-mobile-web",
    targetThreadId: "thread-dst",
    idempotencyKey: "secret-ref:1",
    format: "markdown",
    title: "Use secure credential",
    summary: "Use secure credential.",
    body: "Use the secure credential for this task without asking the user to paste it.",
    secretRef: {
      id: "sec_taskcard1234567890",
      expiresInSeconds: 600,
      targetPlugin: "codex",
    },
  });

  assert.equal(card.sensitiveContext.secretRefs[0].id, "sec_task...7890");
  assert.doesNotMatch(JSON.stringify(card), /sec_taskcard1234567890/);

  const store = JSON.parse(fs.readFileSync(storageFile, "utf8"));
  assert.equal(store.cards[0].sensitiveContext.secretRefs[0].id, "sec_taskcard1234567890");
  const injected = service.injectedMessageText(store.cards[0]);
  assert.match(injected, /已收到安全凭据 sec_task\.\.\.7890，10 分钟内可用于当前任务。/);
  assert.match(injected, /secure secretRef consumption path/);
  assert.doesNotMatch(injected, /sec_taskcard1234567890|REAL_PASSWORD_SHOULD_NOT_LEAK/);

  const detail = service.get(card.id, "thread-dst");
  assert.equal(detail.message.body, "Use the secure credential for this task without asking the user to paste it.");
  assert.equal(detail.sensitiveContext.secretRefs[0].id, "sec_task...7890");
  assert.doesNotMatch(JSON.stringify(detail), /sec_taskcard1234567890/);
});

test("task-card secretRef normalization rejects plaintext-bearing metadata", async () => {
  const service = createThreadTaskCardService({ storageFile: tempFile("cards.json") });
  await assert.rejects(
    () => service.create({
      sourceWorkspaceId: "home-ai",
      sourceThreadId: "thread-src",
      targetWorkspaceId: "codex-mobile-web",
      targetThreadId: "thread-dst",
      idempotencyKey: "secret-ref:plaintext",
      format: "markdown",
      title: "Use secure credential",
      summary: "Use secure credential.",
      body: "Use the secure credential.",
      secretRef: {
        id: "sec_taskcard1234567890",
        value: "REAL_PASSWORD_SHOULD_NOT_LEAK",
      },
    }),
    /secret_ref_plaintext_disallowed/,
  );
});

test("listForThread returns bounded summary cards while get keeps full task-card detail", async () => {
  const storageFile = tempFile("cards.json");
  const body = Array.from({ length: 300 }, () => "Detailed request.").join(" ");
  const service = createThreadTaskCardService({
    storageFile,
    executeApprovedCard: async () => ({
      threadId: "thread-dst",
      turnId: "turn-approved",
      result: {
        syntheticProviderPayload: "provider-payload-should-not-be-in-summary".repeat(300),
      },
      runtime: {
        reasoningEffort: "xhigh",
        requestedReasoningEffort: "xhigh",
      },
    }),
  });
  const card = await service.create({
    sourceWorkspaceId: "finance",
    sourceThreadId: "thread-src",
    sourceTurnId: "turn-src",
    sourceThreadTitle: "Finance close",
    targetWorkspaceId: "ops",
    targetThreadId: "thread-dst",
    idempotencyKey: "finance:summary",
    format: "markdown",
    title: "Need verification",
    summary: "Please verify the mapping.",
    body,
    workflowMode: "autonomous",
    reasoningEffort: "xhigh",
  });
  await service.approve(card.id, "thread-dst");

  const store = JSON.parse(fs.readFileSync(storageFile, "utf8"));
  store.cards[0].audit.rawDiagnosticBody = "raw-audit-should-not-be-in-summary".repeat(200);
  store.cards[0].delivery.rawPrompt = "raw-delivery-should-not-be-in-summary".repeat(200);
  store.cards[0].workflow.rawPlan = "raw-workflow-should-not-be-in-summary".repeat(200);
  store.cards[0].executionLease.continuationTurnIds = Array.from({ length: 20 }, (_, index) => `turn-extra-${index}`);
  fs.writeFileSync(storageFile, JSON.stringify(store), "utf8");

  const summary = service.listForThread("thread-src")[0];
  const full = service.get(card.id, "thread-src");
  const summaryJson = JSON.stringify(summary);
  const fullJson = JSON.stringify(full);

  assert.equal(summary.message.body, undefined);
  assert.equal(summary.message.bodyOmitted, true);
  assert.equal(summary.message.bodyChars, body.length);
  assert.equal(summary.delivery.reasoningEffort, "xhigh");
  assert.equal(summary.workflow.mode, "autonomous");
  assert.equal(summary.workflow.id, full.workflow.id);
  assert.equal(summary.executionLease.status, "active");
  assert.equal(summary.injectionRuntime.reasoningEffort, "xhigh");
  assert.equal(summary.injectionResult, undefined);
  assert.equal(summary.idempotencyKey, undefined);
  assert.equal(summaryJson.includes("provider-payload-should-not-be-in-summary"), false);
  assert.equal(summaryJson.includes("raw-audit-should-not-be-in-summary"), false);
  assert.equal(summaryJson.includes("raw-delivery-should-not-be-in-summary"), false);
  assert.equal(summaryJson.includes("raw-workflow-should-not-be-in-summary"), false);
  assert.ok(Buffer.byteLength(summaryJson) < 2500);

  assert.equal(full.message.body, body);
  assert.ok(fullJson.includes("provider-payload-should-not-be-in-summary"));
  assert.ok(fullJson.includes("raw-audit-should-not-be-in-summary"));
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

test("execution watchdog resumes stale active task-card leases without duplicating private body text", async () => {
  let now = Date.parse("2026-07-04T02:16:31.000Z");
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    now: () => now,
    executeApprovedCard: async (card, message) => {
      executions.push({ card, message });
      return { threadId: card.target.threadId, turnId: `turn-exec-${executions.length}` };
    },
  });
  const created = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-home-ai",
    sourceTurnId: "turn-home",
    sourceThreadTitle: "Home AI",
    targetWorkspaceId: "movie",
    targetThreadId: "thread-movie-deploy",
    idempotencyKey: "watchdog:deploy-lane",
    format: "markdown",
    title: "Movie deploy readback",
    summary: "Install and return bounded readback.",
    body: "Private deploy instructions and endpoint bodies must not be copied into watchdog continuation text.",
    workflowMode: "autonomous",
    workflowId: "workflow-movie",
  });
  await service.approveFromSource(created.id, "thread-home-ai");
  assert.equal(executions.length, 1);

  now += 4 * 60 * 1000;
  const heartbeatAt = new Date(now).toISOString();
  const heartbeat = await service.heartbeatExecution(created.id, "thread-movie-deploy", {
    status: "testing",
    source: "unit-test",
    turnId: "turn-exec-1",
  });
  assert.equal(heartbeat.ok, true);
  assert.equal(heartbeat.heartbeat.status, "testing");
  assert.equal(heartbeat.card.executionLease.lastHeartbeatAt, heartbeatAt);

  now += 2 * 60 * 1000;
  const fresh = await service.resumeStaleExecutionLeases({ staleAfterMs: 5 * 60 * 1000 });
  assert.equal(fresh.inspected, 0);
  assert.equal(executions.length, 1);

  now += 4 * 60 * 1000;
  const result = await service.resumeStaleExecutionLeases({ staleAfterMs: 5 * 60 * 1000 });

  assert.equal(result.ok, true);
  assert.equal(result.inspected, 1);
  assert.equal(result.resumed, 1);
  assert.equal(result.blocked, 0);
  assert.equal(executions.length, 2);
  assert.equal(executions[1].card.source.threadId, "thread-home-ai");
  assert.equal(executions[1].card.target.threadId, "thread-movie-deploy");
  assert.match(executions[1].message.text, /\[Codex Mobile task-card watchdog continuation\]/);
  assert.match(executions[1].message.text, new RegExp(`Task card id: ${created.id}`));
  assert.match(executions[1].message.text, /Title: Movie deploy readback/);
  assert.match(executions[1].message.text, /Summary: Install and return bounded readback\./);
  assert.doesNotMatch(executions[1].message.text, /Private deploy instructions/);
  assert.doesNotMatch(executions[1].message.text, /endpoint bodies/);

  const stored = service.get(created.id, "thread-movie-deploy");
  assert.equal(stored.executionLease.status, "active");
  assert.equal(stored.executionLease.resumeRequired, true);
  assert.equal(stored.executionLease.currentTurnId, "turn-exec-2");
  assert.equal(stored.executionLease.lastContinuationTurnId, "turn-exec-2");
  assert.equal(stored.executionLease.resumeCount, 1);
  assert.equal(stored.executionLease.watchdogResumeRequestedAt, new Date(now).toISOString());
  assert.equal(stored.executionLease.lastWatchdogAttemptAt, new Date(now).toISOString());
  assert.equal(stored.executionLease.lastHeartbeatAt, heartbeatAt);
  assert.equal(stored.executionLease.lastHeartbeatStatus, "testing");
  assert.equal(stored.executionLease.watchdogStaleAfterMs, 5 * 60 * 1000);
  assert.equal(stored.executionLease.watchdogAutoResumePausedAt, new Date(now).toISOString());
  assert.equal(stored.executionLease.watchdogAutoResumePausedReason, "watchdog_resume_attempted");

  const duplicate = await service.resumeStaleExecutionLeases({ staleAfterMs: 5 * 60 * 1000 });
  assert.equal(duplicate.inspected, 0);
  assert.equal(executions.length, 2);

  now += 6 * 60 * 1000;
  const laterDuplicate = await service.resumeStaleExecutionLeases({ staleAfterMs: 5 * 60 * 1000 });
  assert.equal(laterDuplicate.inspected, 0);
  assert.equal(executions.length, 2);
});

test("execution watchdog treats queued heartbeat as progress and suppresses stale resume", async () => {
  let now = Date.parse("2026-07-04T02:16:31.000Z");
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    now: () => now,
    executeApprovedCard: async (card) => {
      executions.push({ card });
      return { threadId: card.target.threadId, turnId: `turn-exec-${executions.length}` };
    },
  });
  const created = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-home-ai",
    targetWorkspaceId: "codex-mobile",
    targetThreadId: "thread-codex-mobile",
    idempotencyKey: "watchdog:queued-heartbeat",
    format: "markdown",
    title: "Queued work",
    summary: "Report queued progress.",
    body: "Private queued work detail.",
    workflowMode: "autonomous",
    workflowId: "workflow-queued",
  });
  await service.approveFromSource(created.id, "thread-home-ai");
  now += 4 * 60 * 1000;
  const heartbeat = await service.heartbeatExecution(created.id, "thread-codex-mobile", {
    status: "queued",
    source: "unit-test",
    turnId: "turn-exec-1",
  });
  assert.equal(heartbeat.ok, true);
  assert.equal(heartbeat.heartbeat.status, "queued");

  now += 4 * 60 * 1000;
  const fresh = await service.resumeStaleExecutionLeases({ staleAfterMs: 5 * 60 * 1000 });
  assert.equal(fresh.inspected, 0);
  assert.equal(executions.length, 1);
  const stored = service.get(created.id, "thread-codex-mobile");
  assert.equal(stored.executionLease.lastHeartbeatStatus, "queued");
  assert.equal(stored.executionLease.resumeRequired, true);
});

test("execution watchdog does not repeatedly resume high-pressure stale leases", async () => {
  let now = Date.parse("2026-07-04T02:16:31.000Z");
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    now: () => now,
    executeApprovedCard: async (card) => {
      executions.push({ card });
      return { threadId: card.target.threadId, turnId: `turn-exec-${executions.length}` };
    },
  });
  for (const suffix of ["a", "b"]) {
    const created = await service.create({
      sourceWorkspaceId: "home-ai",
      sourceThreadId: "thread-home-ai",
      targetWorkspaceId: "codex-mobile",
      targetThreadId: `thread-codex-mobile-${suffix}`,
      idempotencyKey: `watchdog:pressure-${suffix}`,
      format: "markdown",
      title: `Pressure ${suffix}`,
      summary: "Bounded pressure smoke.",
      body: "Private pressure work detail.",
      workflowMode: "autonomous",
      workflowId: `workflow-pressure-${suffix}`,
    });
    await service.approveFromSource(created.id, "thread-home-ai");
  }

  now += 6 * 60 * 1000;
  const first = await service.resumeStaleExecutionLeases({ staleAfterMs: 5 * 60 * 1000, limit: 2 });
  assert.equal(first.inspected, 2);
  assert.equal(first.resumed, 2);
  assert.equal(executions.length, 4);

  now += 6 * 60 * 1000;
  const second = await service.resumeStaleExecutionLeases({ staleAfterMs: 5 * 60 * 1000, limit: 2 });
  assert.equal(second.inspected, 0);
  assert.equal(second.resumed, 0);
  assert.equal(executions.length, 4);
});

test("execution watchdog marks resume failures as bounded blocked leases", async () => {
  let now = Date.parse("2026-07-04T02:16:31.000Z");
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    now: () => now,
    executeApprovedCard: async (card, message) => {
      executions.push({ card, message });
      if (executions.length === 1) return { threadId: card.target.threadId, turnId: "turn-approved" };
      throw new Error("app_server_resume_unavailable");
    },
  });
  const created = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-home-ai",
    targetWorkspaceId: "movie",
    targetThreadId: "thread-movie-deploy",
    idempotencyKey: "watchdog:blocked",
    format: "markdown",
    title: "Movie deploy readback",
    summary: "Install and return bounded readback.",
    body: "Sensitive deploy detail should not appear in blocked metadata.",
    workflowMode: "autonomous",
    workflowId: "workflow-movie",
  });
  await service.approveFromSource(created.id, "thread-home-ai");

  now += 6 * 60 * 1000;
  const result = await service.resumeStaleExecutionLeases({ staleAfterMs: 5 * 60 * 1000 });

  assert.equal(result.ok, true);
  assert.equal(result.inspected, 1);
  assert.equal(result.resumed, 0);
  assert.equal(result.blocked, 1);
  assert.equal(result.results[0].status, "blocked");
  assert.equal(result.results[0].error, "app_server_resume_unavailable");
  assert.equal(executions.length, 2);
  assert.match(executions[1].message.text, /\[Codex Mobile task-card watchdog continuation\]/);
  assert.doesNotMatch(executions[1].message.text, /Sensitive deploy detail/);

  const stored = service.get(created.id, "thread-movie-deploy");
  assert.equal(stored.status, "approved");
  assert.equal(stored.executionLease.status, "blocked");
  assert.equal(stored.executionLease.resumeRequired, false);
  assert.equal(stored.executionLease.blockedReason, "task_card_execution_watchdog_resume_failed");
  assert.equal(stored.executionLease.lastResumeError, "app_server_resume_unavailable");
  assert.equal(stored.executionLease.blockedAt, new Date(now).toISOString());

  const duplicate = await service.resumeStaleExecutionLeases({ staleAfterMs: 5 * 60 * 1000 });
  assert.equal(duplicate.inspected, 0);
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
          approvalPolicy: "never",
          sandboxPolicyType: "dangerFullAccess",
          deployLaneNoApproval: true,
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
  assert.equal(result.card.injectionRuntime.approvalPolicy, "never");
  assert.equal(result.card.injectionRuntime.sandboxPolicyType, "dangerFullAccess");
  assert.equal(result.card.injectionRuntime.deployLaneNoApproval, true);
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
  assert.match(executions[0].message.text, /mcp__codex_mobile\.return_to_source/);
  assert.match(executions[0].message.text, /MCP discovery/);
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
    returnBody: "## Automatic workflow return\n\nCompleted target thread: thread-b\nCompleted turn: turn-1\nCompleted at: 2026-06-02T09:00:00.000Z\nWorkflow id: auto-return-workflow\n\n## Target result\nImplemented and validated.",
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

test("autonomous workflow auto-return can target an explicit reply-to thread", async () => {
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
      return { status: 200 };
    },
  });
  const card = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-hub",
    sourceThreadTitle: "Home AI Deploy",
    targetWorkspaceId: "codex-mobile",
    targetThreadId: "thread-worker",
    replyToWorkspaceId: "codex-mobile",
    replyToThreadId: "thread-origin",
    replyToThreadTitle: "Codex Mobile Source",
    replyToCardId: "ttc_origin",
    idempotencyKey: "workflow:auto-return:reply-to",
    format: "markdown",
    title: "Supplemental deploy evidence",
    summary: "Return to original requester.",
    body: "Collect supplemental evidence and close back to the original source thread.",
    workflowMode: "autonomous",
    workflowId: "reply-to-workflow",
  });
  const approved = await service.approve(card.id, "thread-worker");
  assert.match(executions[0].message.text, /Return target thread id: thread-origin/);
  assert.equal(approved.card.replyTo.threadId, "thread-origin");

  const returned = await service.maybeAutoReplyCompletedTurn({
    threadId: "thread-worker",
    turnId: "turn-1",
    completedAt: "2026-06-30T06:30:00.000Z",
    finalReceiptText: "Supplemental evidence collected.",
  });

  assert.equal(returned.card.status, "approved");
  assert.equal(returned.card.source.threadId, "thread-worker");
  assert.equal(returned.card.target.threadId, "thread-origin");
  assert.equal(returned.card.audit.returnRoutedByReplyTo, true);
  assert.equal(returned.card.audit.returnTargetThreadId, "thread-origin");
  assert.equal(returned.card.audit.originalSourceThreadId, "thread-hub");
  assert.equal(returned.card.delivery.returnToSource, true);
  assert.equal(returned.card.terminal, true);
  assert.equal(returned.card.canReply, false);
  assert.equal(returned.card.injectedTurnId, "turn-2");
  assert.equal(executions[1].card.target.threadId, "thread-origin");
  assert.match(executions[1].message.text, /Return policy: terminal receipt/);
  assert.deepEqual(returnEvents, [{
    taskCardId: card.id,
    returnCardId: returned.card.id,
    status: "completed",
    title: "Auto return: Supplemental deploy evidence",
    summary: "Target thread completed and returned the result automatically.",
    returnBody: "## Automatic workflow return\n\nCompleted target thread: thread-worker\nCompleted turn: turn-1\nCompleted at: 2026-06-30T06:30:00.000Z\nWorkflow id: reply-to-workflow\n\n## Target result\nSupplemental evidence collected.",
    metadata: {
      sourceThreadId: "thread-hub",
      targetThreadId: "thread-worker",
      returnTargetThreadId: "thread-origin",
      replyToThreadId: "thread-origin",
      workflowId: "reply-to-workflow",
      terminal: true,
      ackPolicy: "none",
    },
  }]);
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
  const retry = await service.approve(created.id, "thread-dst");
  assert.equal(retry.approvalInFlight, true);
  assert.equal(retry.card.status, "approving");
  assert.equal(retry.execution, null);
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

test("source-thread direct approval retry during in-flight injection is idempotent", async () => {
  let markExecutionStarted;
  let releaseExecution;
  let executionCount = 0;
  const executionStarted = new Promise((resolve) => { markExecutionStarted = resolve; });
  const executionRelease = new Promise((resolve) => { releaseExecution = resolve; });
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card) => {
      executionCount += 1;
      markExecutionStarted();
      await executionRelease;
      return { threadId: card.target.threadId, turnId: "turn-source-direct-after-inflight" };
    },
  });
  const created = await service.create({
    sourceWorkspaceId: "movie",
    sourceThreadId: "thread-src",
    sourceTurnId: "turn-src",
    sourceThreadTitle: "Movie",
    targetWorkspaceId: "movie-deploy",
    targetThreadId: "thread-dst",
    idempotencyKey: "movie:deploy:inflight",
    format: "markdown",
    title: "Deploy Movie",
    summary: "Deploy and return.",
    body: "Deploy request.",
  });

  const approving = service.approveFromSource(created.id, "thread-src");
  await executionStarted;
  const retry = await service.approveFromSource(created.id, "thread-src");
  assert.equal(retry.approvalInFlight, true);
  assert.equal(retry.card.status, "approving");
  assert.equal(retry.execution, null);
  assert.equal(executionCount, 1);

  releaseExecution();
  const result = await approving;
  assert.equal(result.card.status, "approved");
  assert.equal(result.card.injectedTurnId, "turn-source-direct-after-inflight");
  assert.equal(executionCount, 1);
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

test("terminal return receipt cards are not exposed as pending approval requests", () => {
  const storageFile = tempFile("cards.json");
  const createdAt = "2026-07-01T01:00:00.000Z";
  fs.writeFileSync(storageFile, JSON.stringify({
    version: 1,
    cards: [{
      id: "ttc_terminal_pending",
      status: "pending",
      idempotencyKey: "terminal:pending",
      createdAt,
      updatedAt: createdAt,
      source: {
        workspaceId: "plugin",
        threadId: "thread-plugin",
        turnId: "",
        title: "Plugin",
      },
      target: {
        workspaceId: "home-ai",
        threadId: "thread-home",
      },
      message: {
        format: "markdown",
        title: "Return: completed",
        summary: "completed",
        body: "Completed.",
      },
      delivery: {
        injectOnApprove: true,
        allowReply: false,
        allowRevoke: false,
        autoRunAfterFirstApproval: false,
        autoReturnOnCompletion: false,
        returnToSource: true,
        returnStatus: "completed",
        requiresReturn: false,
        terminal: true,
        ackPolicy: "none",
      },
      audit: {
        replyToCardId: "ttc_original",
        returnToSource: true,
        terminal: true,
        ackPolicy: "none",
      },
    }],
  }), "utf8");
  const service = createThreadTaskCardService({ storageFile });

  assert.deepEqual(service.pendingCountsForThread("thread-home"), {
    pendingTotal: 0,
    pendingIncoming: 0,
    pendingOutgoing: 0,
  });
  const [receipt] = service.listForThread("thread-home");
  assert.equal(receipt.terminal, true);
  assert.equal(receipt.canApprove, undefined);
  assert.equal(receipt.canDelete, undefined);
  assert.equal(receipt.canReply, undefined);
});

test("reply can recover an accepted card left in approving after a lost final write", async () => {
  const storageFile = tempFile("cards.json");
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile,
    executeApprovedCard: async (card, message) => {
      executions.push({ card, message });
      return { threadId: card.target.threadId, turnId: `turn-${executions.length}` };
    },
  });
  const created = await service.create({
    sourceWorkspaceId: "codex-mobile",
    sourceThreadId: "thread-source",
    sourceTurnId: "turn-source",
    sourceThreadTitle: "Codex Mobile",
    targetWorkspaceId: "codex-mobile-deploy",
    targetThreadId: "thread-deploy",
    idempotencyKey: "codex-mobile:deploy:lost-final-write",
    format: "markdown",
    title: "Deploy Codex Mobile",
    summary: "Deploy and return.",
    body: "Deploy and return.",
  });

  const store = JSON.parse(fs.readFileSync(storageFile, "utf8"));
  const stored = store.cards.find((card) => card.id === created.id);
  stored.status = "approving";
  stored.audit = Object.assign({}, stored.audit || {}, {
    directApprovingAt: new Date(0).toISOString(),
    targetApprovalBypassed: true,
  });
  fs.writeFileSync(storageFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const returned = await service.reply(created.id, "thread-deploy", {
    idempotencyKey: "return:codex-mobile:deploy:lost-final-write",
    format: "markdown",
    title: "Return: Deploy Codex Mobile",
    status: "completed",
    summary: "completed",
    body: "Completed after recovering the original approving card.",
    sourceWorkspaceId: "codex-mobile-deploy",
    sourceThreadId: "thread-deploy",
    sourceThreadTitle: "Codex Mobile Deploy",
  });

  assert.equal(returned.card.status, "replied");
  assert.equal(returned.replyCard.status, "approved");
  assert.equal(returned.replyCard.delivery.returnToSource, true);
  assert.equal(returned.replyCard.delivery.terminal, true);
  assert.equal(returned.replyCard.target.threadId, "thread-source");
  assert.equal(returned.replyCard.injectedTurnId, "turn-1");
  assert.match(executions[0].message.text, /Return policy: terminal receipt/);
  assert.equal(service.get(created.id, "thread-deploy").status, "replied");
});

test("returnToSource uses explicit reply-to thread for multi-hop supplements", async () => {
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card, message) => {
      executions.push({ card, message });
      return { threadId: card.target.threadId, turnId: `turn-${executions.length}` };
    },
  });
  const supplement = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-home-deploy",
    sourceThreadTitle: "Home AI Deploy",
    targetWorkspaceId: "home-ai",
    targetThreadId: "thread-codex-deploy",
    replyToWorkspaceId: "codex-mobile",
    replyToThreadId: "thread-original-requester",
    replyToThreadTitle: "Codex Mobile Source",
    replyToCardId: "ttc_original_deploy",
    idempotencyKey: "supplement:reply-to",
    format: "markdown",
    title: "Summarize approval friction",
    summary: "Return to original requester.",
    body: "Summarize the deploy-lane approval friction and return it to the original requester.",
  });
  await service.approveFromSource(supplement.id, "thread-home-deploy");
  assert.match(executions[0].message.text, /Return target thread id: thread-original-requester/);

  const returned = await service.reply(supplement.id, "thread-codex-deploy", {
    idempotencyKey: "supplement:reply-to:return",
    format: "markdown",
    title: "Return: approval friction",
    status: "completed",
    summary: "completed",
    body: "Approval friction summarized.",
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-codex-deploy",
    sourceThreadTitle: "Codex Mobile Deploy Lane",
  });

  assert.equal(returned.card.status, "replied");
  assert.equal(returned.replyCard.status, "approved");
  assert.equal(returned.replyCard.source.threadId, "thread-codex-deploy");
  assert.equal(returned.replyCard.target.threadId, "thread-original-requester");
  assert.equal(returned.replyCard.target.workspaceId, "codex-mobile");
  assert.equal(returned.replyCard.audit.originalSourceThreadId, "thread-home-deploy");
  assert.equal(returned.replyCard.audit.returnTargetThreadId, "thread-original-requester");
  assert.equal(returned.replyCard.audit.returnRoutedByReplyTo, true);
  assert.equal(returned.replyCard.injectedTurnId, "turn-2");
  assert.equal(executions[1].card.target.threadId, "thread-original-requester");
  assert.equal(service.listForThread("thread-home-deploy").some((card) => card.id === returned.replyCard.id), false);
  assert.equal(service.listForThread("thread-original-requester").some((card) => card.id === returned.replyCard.id), true);
});

test("reply-to can be resolved from an original task-card id", async () => {
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card, message) => {
      executions.push({ card, message });
      return { threadId: card.target.threadId, turnId: `turn-${executions.length}` };
    },
  });
  const original = await service.create({
    sourceWorkspaceId: "codex-mobile",
    sourceThreadId: "thread-origin",
    sourceThreadTitle: "Codex Mobile Source",
    targetWorkspaceId: "home-ai",
    targetThreadId: "thread-original-target",
    idempotencyKey: "original:reply-to-card-id",
    format: "markdown",
    title: "Original deploy",
    summary: "Original request.",
    body: "Original request body.",
  });
  const supplement = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-hub",
    sourceThreadTitle: "Home AI Deploy",
    targetWorkspaceId: "home-ai",
    targetThreadId: "thread-worker",
    replyToCardId: original.id,
    idempotencyKey: "supplement:reply-to-card-id",
    format: "markdown",
    title: "Supplement",
    summary: "Resolve reply target from original card.",
    body: "Supplement body.",
  });

  assert.equal(supplement.replyTo.threadId, "thread-origin");
  assert.equal(supplement.replyTo.cardId, original.id);
  await service.approveFromSource(supplement.id, "thread-hub");
  const returned = await service.reply(supplement.id, "thread-worker", {
    idempotencyKey: "supplement:reply-to-card-id:return",
    format: "markdown",
    title: "Return: supplement",
    status: "completed",
    summary: "completed",
    body: "done",
  });

  assert.equal(returned.replyCard.target.threadId, "thread-origin");
  assert.equal(returned.replyCard.audit.returnRoutedByReplyTo, true);
  assert.equal(executions[1].card.target.threadId, "thread-origin");
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
    returnBody: "Completed and validated.",
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

  const terminalDuplicate = await service.reply(returned.replyCard.id, "thread-home", {
    idempotencyKey: "home-ai:ack:should-stop",
    format: "markdown",
    title: "Ack: Music repair completed",
    summary: "acknowledged",
    body: "Acknowledged.",
    returnToSource: true,
  });
  assert.equal(terminalDuplicate.returnResolution.noOp, true);
  assert.equal(terminalDuplicate.returnResolution.reason, "already_closed");
  assert.equal(terminalDuplicate.replyCard, null);
  assert.equal(executions.length, 2);
  assert.equal(returnEvents.length, 1);
});

test("return_to_source recovers original card by workflow when visible card id is stale", async () => {
  const executions = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card) => {
      executions.push(card);
      return { threadId: card.target.threadId, turnId: `turn-${executions.length}` };
    },
  });
  const repairCard = await service.create({
    sourceWorkspaceId: "xcode",
    sourceThreadId: "thread-xcode",
    sourceTurnId: "turn-xcode",
    sourceThreadTitle: "Xcode",
    sourceRole: "xcode_implementation",
    targetWorkspaceId: "health",
    targetThreadId: "thread-health",
    targetRole: "health_implementation",
    routeKind: "repair",
    requestId: "req-xcode-health",
    routeResolution: {
      inputReferenceKind: "role",
      inputReferenceKinds: ["role"],
      inputReferenceCount: 1,
      matchedThreadIds: ["thread-health"],
      sourceRole: "xcode_implementation",
      targetRole: "health_implementation",
      code: "exact_thread_resolved",
    },
    idempotencyKey: "xcode:health:repair",
    format: "markdown",
    title: "Repair Health path",
    summary: "Repair and return.",
    body: "Please repair and return.",
    workflowMode: "autonomous",
    workflowId: "xcode-health-workflow",
  });
  assert.equal(repairCard.source.role, "xcode_implementation");
  assert.equal(repairCard.target.role, "health_implementation");
  assert.equal(repairCard.workflow.originalTaskCardId, repairCard.id);
  assert.equal(repairCard.workflow.sourceThreadId, "thread-xcode");
  assert.equal(repairCard.workflow.targetThreadId, "thread-health");
  assert.equal(repairCard.workflow.expectedActorThreadId, "thread-health");
  assert.equal(repairCard.workflow.routeKind, "repair");
  assert.equal(repairCard.workflow.requestId, "req-xcode-health");
  assert.equal(repairCard.workflow.resolverVersion, "task-card-exact-routing-v1");
  assert.equal(repairCard.routeResolution.inputReferenceKind, "role");
  assert.deepEqual(repairCard.routeResolution.matchedThreadIds, ["thread-health"]);
  await service.approveFromSource(repairCard.id, "thread-xcode");

  const returned = await service.reply("ttc_stale_visible_card", "thread-health", {
    idempotencyKey: "xcode:health:return",
    format: "markdown",
    title: "Health repair completed",
    summary: "completed",
    body: "Completed and validated.",
    returnToSource: true,
    workflowId: "xcode-health-workflow",
  });

  assert.equal(returned.card.id, repairCard.id);
  assert.equal(returned.card.status, "replied");
  assert.equal(returned.replyCard.delivery.returnToSource, true);
  assert.equal(returned.replyCard.target.threadId, "thread-xcode");

  const duplicate = await service.reply("ttc_stale_visible_card", "thread-health", {
    idempotencyKey: "xcode:health:return",
    format: "markdown",
    title: "Health repair completed",
    summary: "completed",
    body: "Completed and validated.",
    returnToSource: true,
    workflowId: "xcode-health-workflow",
  });
  assert.equal(duplicate.replyCard.id, returned.replyCard.id);
  assert.equal(service.listForThread("thread-xcode").filter((card) => card.audit && card.audit.replyToCardId === repairCard.id).length, 1);
});

test("return_to_source rejects wrong actor for Home AI Task Intake workflow returns", async () => {
  const executions = [];
  const returnEvents = [];
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card) => {
      executions.push(card);
      return { threadId: card.target.threadId, turnId: `turn-${executions.length}` };
    },
    onTerminalReturnCard: async (event) => {
      returnEvents.push(event);
      return { status: 200, eventId: "return-event-1" };
    },
  });
  const card = await service.create({
    sourceWorkspaceId: "/Users/hermes-dev/HermesMobileDev/app",
    sourceThreadId: "home-ai-task-intake",
    sourceTurnId: "turn-home-ai",
    sourceThreadTitle: "Home AI Task Intake",
    sourceRole: "home_ai_task_intake",
    targetWorkspaceId: "/Users/hermes-dev/HermesMobileDev/app",
    targetThreadId: "home-ai-implementation",
    targetRole: "home_ai_implementation",
    idempotencyKey: "home-ai:intake:owner-console",
    format: "markdown",
    title: "Repair Owner Console",
    summary: "Repair and return.",
    body: "Please repair and return.",
    workflowMode: "autonomous",
    workflowId: "home-ai-intake-workflow",
  });
  await service.approveFromSource(card.id, "home-ai-task-intake");

  await assert.rejects(
    () => service.reply("ttc_stale_home_ai_visible_card", "home-ai-task-intake", {
      idempotencyKey: "home-ai:intake:return",
      format: "markdown",
      title: "Return: Owner Console repaired",
      status: "completed",
      summary: "completed",
      body: "Completed with bounded evidence.",
      returnToSource: true,
      workflowId: "home-ai-intake-workflow",
    }),
    (err) => err
      && err.message === "workflow_actor_mismatch"
      && err.statusCode === 403
      && err.details
      && err.details.requestedActorThreadId === "home-ai-task-intake"
      && err.details.expectedActorThreadIds.includes("home-ai-implementation"),
  );

  const returned = await service.reply("ttc_stale_home_ai_visible_card", "home-ai-implementation", {
    idempotencyKey: "home-ai:intake:return",
    format: "markdown",
    title: "Return: Owner Console repaired",
    status: "completed",
    summary: "completed",
    body: "Completed with bounded evidence.",
    returnToSource: true,
    workflowId: "home-ai-intake-workflow",
  });

  assert.equal(returned.card.id, card.id);
  assert.equal(returned.card.status, "replied");
  assert.equal(returned.returnResolution.workflowRecovered, true);
  assert.equal(returned.returnResolution.actorThreadInferred, false);
  assert.equal(returned.returnResolution.requestedActorThreadId, "home-ai-implementation");
  assert.equal(returned.returnResolution.resolvedActorThreadId, "home-ai-implementation");
  assert.equal(returned.returnResolution.expectedTargetThreadId, "home-ai-implementation");
  assert.equal(returned.returnResolution.resolverVersion, "task-card-exact-routing-v1");
  assert.equal(returned.replyCard.delivery.returnToSource, true);
  assert.equal(returned.replyCard.target.threadId, "home-ai-task-intake");
  assert.equal(returned.replyCard.source.role, "home_ai_implementation");
  assert.equal(returned.replyCard.target.role, "home_ai_task_intake");
  assert.equal(returned.replyCard.status, "approved");
  assert.equal(returnEvents.length, 1);
  assert.equal(returnEvents[0].taskCardId, card.id);

  const duplicate = await service.reply("ttc_stale_home_ai_visible_card", "home-ai-implementation", {
    idempotencyKey: "home-ai:intake:return",
    format: "markdown",
    title: "Return: Owner Console repaired",
    status: "completed",
    summary: "completed",
    body: "Completed with bounded evidence.",
    returnToSource: true,
    workflowId: "home-ai-intake-workflow",
  });
  assert.equal(duplicate.replyCard.id, returned.replyCard.id);
  assert.equal(returnEvents.length, 1);
});

test("return_to_source missing stale duplicate card returns bounded no-op", async () => {
  const service = createThreadTaskCardService({ storageFile: tempFile("cards.json") });
  const result = await service.reply("ttc_missing_duplicate", "home-ai-task-intake", {
    idempotencyKey: "home-ai:missing:return",
    format: "markdown",
    title: "Return: missing duplicate",
    status: "completed",
    summary: "completed",
    body: "No remaining card was present.",
    returnToSource: true,
    workflowId: "missing-workflow",
  });

  assert.equal(result.returnResolution.noOp, true);
  assert.equal(result.returnResolution.reason, "task_card_not_found");
  assert.equal(result.replyCard, null);
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

test("concurrent return_to_source retry does not send a duplicate terminal return event", async () => {
  const events = [];
  let markEventStarted;
  let releaseEvent;
  const eventStarted = new Promise((resolve) => { markEventStarted = resolve; });
  const eventRelease = new Promise((resolve) => { releaseEvent = resolve; });
  const service = createThreadTaskCardService({
    storageFile: tempFile("cards.json"),
    executeApprovedCard: async (card) => ({ threadId: card.target.threadId, turnId: `turn-${card.id}` }),
    onTerminalReturnCard: async (event) => {
      events.push(event);
      markEventStarted();
      await eventRelease;
      return { status: 200, eventId: "event-once" };
    },
  });
  const card = await service.create({
    sourceWorkspaceId: "home-ai",
    sourceThreadId: "thread-home",
    sourceTurnId: "turn-home",
    sourceThreadTitle: "Home AI",
    targetWorkspaceId: "plugin",
    targetThreadId: "thread-plugin",
    idempotencyKey: "return-event:concurrent",
    format: "markdown",
    title: "Repair plugin",
    summary: "Repair and return.",
    body: "Please repair and return.",
  });

  const first = service.reply(card.id, "thread-plugin", {
    idempotencyKey: "return-event:concurrent:reply",
    format: "markdown",
    title: "Return: plugin repair",
    status: "completed",
    summary: "completed",
    body: "Completed.",
    returnToSource: true,
  });
  await eventStarted;
  const retry = await service.reply(card.id, "thread-plugin", {
    idempotencyKey: "return-event:concurrent:reply",
    format: "markdown",
    title: "Return: plugin repair",
    status: "completed",
    summary: "completed",
    body: "Completed.",
    returnToSource: true,
  });
  releaseEvent();
  const returned = await first;

  assert.equal(retry.replyCard.id, returned.replyCard.id);
  assert.equal(events.length, 1);
  assert.equal(service.get(returned.replyCard.id, "thread-home").audit.homeAiDeliveryReturnEventStatus, "sent");
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
