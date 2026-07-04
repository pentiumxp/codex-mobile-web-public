"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadTaskCardRoutingService,
  threadTaskCardTargetReferenceEntries,
  threadTaskCardTargetReferences,
} = require("../services/task-cards/thread-task-card-routing-service");

const canonicalRoutingService = require("../services/task-cards/thread-task-card-routing-service");
const adapterRoutingService = require("../adapters/thread-task-card-routing-service");

function fakeRoutingService(options = {}) {
  const summaries = options.summaries || new Map();
  const hiddenIds = new Set(options.hiddenIds || []);
  return createThreadTaskCardRoutingService({
    readThreadListFallback(limit, filters) {
      assert.equal(limit, 500);
      assert.deepEqual(filters, { archived: false });
      return options.visibleThreads || [];
    },
    readThreadSummary(threadId) {
      return summaries.get(threadId) || null;
    },
    threadDisplayTitle(thread) {
      return String(thread && (thread.name || thread.title || thread.id) || "").trim();
    },
    visibilityFromGlobalState(globalState = {}) {
      return {
        workspaceKeys: new Set(globalState.workspaceKeys || []),
        workspaceNames: new Set(),
        projectlessThreadIds: new Set(globalState.projectlessThreadIds || []),
      };
    },
    threadHasArchiveSignal(thread) {
      return Boolean(thread && (thread.archived || thread.deleted || thread.localArchive));
    },
    isHiddenThread(thread) {
      return Boolean(thread && (thread.hidden || hiddenIds.has(thread.id)));
    },
    isSubagentThreadSummary(thread) {
      return Boolean(thread && thread.agentNickname);
    },
    isSideChatSidecarThreadSummary(thread) {
      return Boolean(thread && thread.sidecar);
    },
  });
}

test("task-card routing adapter re-exports the canonical service boundary", () => {
  assert.equal(adapterRoutingService.createThreadTaskCardRoutingService, canonicalRoutingService.createThreadTaskCardRoutingService);
  assert.equal(adapterRoutingService.threadTaskCardTargetReferences, canonicalRoutingService.threadTaskCardTargetReferences);
});

test("target reference extraction gives exact thread and title references priority over workspace fallbacks", () => {
  assert.deepEqual(threadTaskCardTargetReferenceEntries({
    targetThreadIds: ["10000000-0000-4000-8000-000000000002"],
    targetThreadTitle: "Plugin Workspace Audit",
    targetCwd: "/tmp/shared",
  }), [
    { kind: "threadId", text: "10000000-0000-4000-8000-000000000002" },
    { kind: "title", text: "Plugin Workspace Audit" },
  ]);
  assert.deepEqual(threadTaskCardTargetReferences({
    targetWorkspace: { cwd: "/tmp/shared" },
  }), ["/tmp/shared"]);
  assert.deepEqual(threadTaskCardTargetReferenceEntries({
    targetRole: "home_ai_deploy",
    targetCwd: "/tmp/shared",
  }), [
    { kind: "role", text: "home_ai_deploy" },
  ]);
});

test("visible target list dedupes and excludes archived, subagent, and sidecar threads", () => {
  const keep = { id: "10000000-0000-4000-8000-000000000002", name: "Plugin Workspace Audit", cwd: "/tmp/shared" };
  const service = fakeRoutingService({
    visibleThreads: [
      keep,
      Object.assign({}, keep, { name: "duplicate" }),
      { id: "10000000-0000-4000-8000-000000000003", archived: true, cwd: "/tmp/shared" },
      { id: "10000000-0000-4000-8000-000000000004", agentNickname: "worker", cwd: "/tmp/shared" },
      { id: "10000000-0000-4000-8000-000000000005", sidecar: true, cwd: "/tmp/shared" },
    ],
  });

  assert.deepEqual(service.visibleTargetThreads().map((thread) => thread.id), [keep.id]);
});

test("exact targetThreadId wins and ambiguous same-workspace cwd routing fails closed", () => {
  const cwd = "/tmp/codex-mobile-routing/shared";
  const sourceThreadId = "10000000-0000-4000-8000-000000000001";
  const exactThreadId = "10000000-0000-4000-8000-000000000002";
  const newestThreadId = "10000000-0000-4000-8000-000000000003";
  const service = fakeRoutingService({
    visibleThreads: [
      { id: newestThreadId, name: "Newer implementation", cwd, updatedAt: 300 },
      { id: exactThreadId, name: "Plugin Workspace Audit", cwd, updatedAt: 200 },
    ],
  });

  assert.equal(service.resolveTargetReference(exactThreadId, sourceThreadId), exactThreadId);
  assert.equal(service.resolveTargetReference("Plugin Workspace Audit", sourceThreadId), exactThreadId);
  assert.throws(
    () => service.resolveTargetReference(cwd, sourceThreadId),
    (err) => err
      && err.code === "target_workspace_ambiguous"
      && err.statusCode === 409
      && err.details
      && err.details.matchCount === 2,
  );
  assert.deepEqual(
    service.resolvedTargetIds({ targetThreadId: exactThreadId, targetCwd: cwd }, sourceThreadId),
    [exactThreadId],
  );
});

test("workspace cwd routing is allowed only for a unique visible deliverable thread", () => {
  const cwd = "/tmp/codex-mobile-routing/unique";
  const sourceThreadId = "10000000-0000-4000-8000-000000000001";
  const targetThreadId = "10000000-0000-4000-8000-000000000002";
  const service = fakeRoutingService({
    visibleThreads: [
      { id: targetThreadId, name: "Only implementation", cwd, updatedAt: 200 },
    ],
  });

  assert.equal(service.resolveTargetReference(cwd, sourceThreadId), targetThreadId);
  assert.equal(service.canonicalTargetForCwd(cwd, service.visibleTargetThreads()).id, targetThreadId);
});

test("role routing resolves a unique role and fails closed for duplicate role candidates", () => {
  const cwd = "/tmp/codex-mobile-routing/roles";
  const sourceThreadId = "10000000-0000-4000-8000-000000000001";
  const deployThreadId = "10000000-0000-4000-8000-000000000002";
  const auditThreadId = "10000000-0000-4000-8000-000000000003";
  const secondAuditThreadId = "10000000-0000-4000-8000-000000000004";
  const service = fakeRoutingService({
    visibleThreads: [
      { id: sourceThreadId, name: "Home AI Task Intake", cwd, updatedAt: 400 },
      { id: deployThreadId, name: "Home AI Deploy", cwd: "/tmp/home-ai", role: "home_ai_deploy", updatedAt: 300 },
      { id: auditThreadId, name: "Plugin Workspace Audit", cwd: "/tmp/home-ai", role: "plugin_workspace_audit", updatedAt: 200 },
      { id: secondAuditThreadId, name: "Plugin Workspace Audit 2", cwd: "/tmp/home-ai", role: "plugin_workspace_audit", updatedAt: 100 },
    ],
  });

  assert.equal(service.resolveTargetReference({ kind: "role", text: "home_ai_deploy" }, sourceThreadId), deployThreadId);
  assert.equal(service.resolvedTargetIds({ targetRole: "home_ai_deploy", targetCwd: cwd }, sourceThreadId)[0], deployThreadId);
  assert.throws(
    () => service.resolveTargetReference({ kind: "role", text: "plugin_workspace_audit" }, sourceThreadId),
    (err) => err
      && err.code === "target_thread_ambiguous"
      && err.statusCode === 409
      && err.details
      && err.details.matchCount === 2
      && err.details.matchedThreads.every((thread) => thread.role === "plugin_workspace_audit"),
  );
});

test("workspace cwd routing includes the source thread in ambiguity checks", () => {
  const cwd = "/tmp/codex-mobile-routing/codex-mobile-web";
  const sourceThreadId = "10000000-0000-4000-8000-000000000001";
  const chatGptProThreadId = "10000000-0000-4000-8000-000000000002";
  const service = fakeRoutingService({
    visibleThreads: [
      { id: sourceThreadId, name: "codex mobile 06-30", cwd, status: { type: "active" }, updatedAt: 300 },
      { id: chatGptProThreadId, name: "ChatGPT Pro", cwd, status: "completed", updatedAt: 200 },
    ],
  });

  assert.throws(
    () => service.resolveTargetReference(cwd, sourceThreadId),
    (err) => err
      && err.code === "target_workspace_ambiguous"
      && err.statusCode === 409
      && err.details
      && err.details.matchCount === 2
      && err.details.matchedThreads.some((thread) => thread.threadId === sourceThreadId)
      && err.details.matchedThreads.some((thread) => thread.threadId === chatGptProThreadId),
  );
});

test("workspace cwd routing rejects the source thread when it is the only cwd match", () => {
  const cwd = "/tmp/codex-mobile-routing/source-only";
  const sourceThreadId = "10000000-0000-4000-8000-000000000001";
  const service = fakeRoutingService({
    visibleThreads: [
      { id: sourceThreadId, name: "codex mobile 06-30", cwd, status: { type: "active" }, updatedAt: 300 },
    ],
  });

  assert.throws(
    () => service.resolveTargetReference(cwd, sourceThreadId),
    (err) => err
      && err.code === "target_thread_self"
      && err.statusCode === 400
      && err.details
      && err.details.sourceThreadId === sourceThreadId
      && err.details.matchedThread
      && err.details.matchedThread.threadId === sourceThreadId,
  );
});

test("ambiguous exact titles fail closed instead of selecting the first visible thread", () => {
  const cwd = "/tmp/codex-mobile-routing/shared";
  const sourceThreadId = "10000000-0000-4000-8000-000000000001";
  const firstThreadId = "10000000-0000-4000-8000-000000000002";
  const secondThreadId = "10000000-0000-4000-8000-000000000003";
  const service = fakeRoutingService({
    visibleThreads: [
      { id: firstThreadId, name: "codex mobile 06-30", cwd, updatedAt: 100 },
      { id: secondThreadId, name: "codex mobile 06-30", cwd, updatedAt: 200 },
    ],
  });

  assert.equal(service.resolveTargetReference(firstThreadId, sourceThreadId), firstThreadId);
  assert.throws(
    () => service.resolveTargetReference("codex mobile 06-30", sourceThreadId),
    (err) => err
      && err.code === "target_thread_title_ambiguous"
      && err.statusCode === 409
      && err.details
      && err.details.matchCount === 2
      && Array.isArray(err.details.matchedThreadIds)
      && err.details.matchedThreadIds.includes(firstThreadId)
      && err.details.matchedThreadIds.includes(secondThreadId),
  );
});

test("same-workspace implementation and public-pr candidates fail closed for cwd-only routing", () => {
  const cwd = "/tmp/codex-mobile-routing/shared";
  const sourceThreadId = "10000000-0000-4000-8000-000000000001";
  const activeThreadId = "10000000-0000-4000-8000-000000000002";
  const publicPrThreadId = "10000000-0000-4000-8000-000000000003";
  const chatgptProThreadId = "10000000-0000-4000-8000-000000000004";
  const service = fakeRoutingService({
    visibleThreads: [
      { id: publicPrThreadId, name: "Codex Mobile Public PR", cwd, status: "completed", updatedAt: 900 },
      { id: chatgptProThreadId, name: "ChatGPT Pro", cwd, status: "completed", updatedAt: 800 },
      { id: activeThreadId, name: "codex mobile 06-30", cwd, status: { type: "active" }, updatedAt: 100 },
    ],
  });

  assert.throws(
    () => service.resolveTargetReference(cwd, sourceThreadId),
    (err) => err
      && err.code === "target_workspace_ambiguous"
      && err.statusCode === 409
      && err.details
      && err.details.matchedThreads
      && err.details.matchedThreads.some((thread) => thread.threadId === activeThreadId)
      && err.details.matchedThreads.some((thread) => thread.threadId === publicPrThreadId)
      && err.details.matchedThreads.some((thread) => thread.threadId === chatgptProThreadId),
  );
  assert.deepEqual(
    service.canonicalVisibleTargets(service.visibleTargetThreads()).map((thread) => thread.id),
    [activeThreadId, publicPrThreadId, chatgptProThreadId],
  );
});

test("codex-mobile implementation role excludes ChatGPT Pro and Public PR lanes", () => {
  const cwd = "/tmp/codex-mobile-routing/plugins/codex-mobile-web";
  const sourceThreadId = "10000000-0000-4000-8000-000000000001";
  const implementationThreadId = "10000000-0000-4000-8000-000000000002";
  const publicPrThreadId = "10000000-0000-4000-8000-000000000003";
  const chatgptProThreadId = "10000000-0000-4000-8000-000000000004";
  const service = fakeRoutingService({
    visibleThreads: [
      { id: publicPrThreadId, name: "Codex Mobile Public PR", cwd, status: "completed", updatedAt: 900 },
      { id: chatgptProThreadId, name: "ChatGPT Pro", cwd, status: { type: "active" }, updatedAt: 800 },
      { id: implementationThreadId, name: "codex mobile 07-04", cwd, status: { type: "active" }, updatedAt: 700 },
    ],
  });

  assert.equal(
    service.resolveTargetReference({ kind: "role", text: "codex_mobile_implementation" }, sourceThreadId),
    implementationThreadId,
  );
  assert.equal(
    service.resolveTargetReference({ kind: "role", text: "codex_mobile_public_pr" }, sourceThreadId),
    publicPrThreadId,
  );
  assert.equal(
    service.resolveTargetReference({ kind: "role", text: "chatgpt_pro" }, sourceThreadId),
    chatgptProThreadId,
  );
});

test("workspace cwd routing rejects multiple terminal same-cwd candidates", () => {
  const cwd = "/tmp/codex-mobile-routing/shared";
  const sourceThreadId = "10000000-0000-4000-8000-000000000001";
  const olderThreadId = "10000000-0000-4000-8000-000000000002";
  const newerThreadId = "10000000-0000-4000-8000-000000000003";
  const service = fakeRoutingService({
    visibleThreads: [
      { id: olderThreadId, name: "Older completed", cwd, status: "completed", updatedAt: 100 },
      { id: newerThreadId, name: "Newer completed", cwd, status: "completed", updatedAt: 200 },
    ],
  });

  assert.throws(
    () => service.resolveTargetReference(cwd, sourceThreadId),
    (err) => err
      && err.code === "target_workspace_ambiguous"
      && err.statusCode === 409
      && err.details
      && err.details.matchCount === 2
      && err.details.matchedThreads[0].threadId === newerThreadId
      && err.details.matchedThreads[1].threadId === olderThreadId,
  );
});

test("readable exact thread id can resolve outside current visible list but must still be deliverable", () => {
  const sourceThreadId = "10000000-0000-4000-8000-000000000001";
  const directThreadId = "10000000-0000-4000-8000-000000000006";
  const archivedThreadId = "10000000-0000-4000-8000-000000000007";
  const hiddenThreadId = "10000000-0000-4000-8000-000000000008";
  const subagentThreadId = "10000000-0000-4000-8000-000000000009";
  const summaries = new Map([
    [directThreadId, { id: directThreadId, name: "Readable target", cwd: "/tmp/readable" }],
    [archivedThreadId, { id: archivedThreadId, name: "Archived target", cwd: "/tmp/readable", archived: true }],
    [hiddenThreadId, { id: hiddenThreadId, name: "Hidden target", cwd: "/tmp/readable", hidden: true }],
    [subagentThreadId, { id: subagentThreadId, name: "Subagent target", cwd: "/tmp/readable", agentNickname: "worker" }],
  ]);
  const service = fakeRoutingService({ summaries });

  assert.equal(service.resolveTargetReference(directThreadId, sourceThreadId), directThreadId);
  assert.throws(
    () => service.resolveTargetReference(archivedThreadId, sourceThreadId),
    (err) => err && err.code === "target_thread_archived" && err.statusCode === 409,
  );
  assert.throws(
    () => service.resolveTargetReference(hiddenThreadId, sourceThreadId),
    (err) => err
      && err.code === "target_thread_not_visible"
      && err.statusCode === 404
      && err.details
      && err.details.requestedTarget
      && err.details.requestedTarget.threadId === hiddenThreadId,
  );
  assert.throws(
    () => service.resolveTargetReference(subagentThreadId, sourceThreadId),
    (err) => err && err.code === "target_thread_not_visible" && err.statusCode === 404,
  );
});

test("archived exact implementation id returns bounded visible replacement metadata", () => {
  const cwd = "/tmp/codex-mobile-routing/plugins/codex-mobile-web";
  const sourceThreadId = "10000000-0000-4000-8000-000000000001";
  const archivedThreadId = "10000000-0000-4000-8000-000000000002";
  const currentThreadId = "10000000-0000-4000-8000-000000000003";
  const publicPrThreadId = "10000000-0000-4000-8000-000000000004";
  const summaries = new Map([
    [archivedThreadId, { id: archivedThreadId, name: "codex mobile 06-30", cwd, archived: true }],
  ]);
  const service = fakeRoutingService({
    summaries,
    visibleThreads: [
      { id: publicPrThreadId, name: "Codex Mobile Public PR", cwd, status: "completed", updatedAt: 900 },
      { id: currentThreadId, name: "codex mobile 07-04", cwd, status: { type: "active" }, updatedAt: 800 },
    ],
  });

  assert.throws(
    () => service.resolveTargetReference(archivedThreadId, sourceThreadId),
    (err) => err
      && err.code === "target_thread_archived"
      && err.statusCode === 409
      && err.details
      && err.details.requestedTarget.threadId === archivedThreadId
      && err.details.suggestedTargetReason === "same_role_visible_target"
      && err.details.suggestedTargets.length === 1
      && err.details.suggestedTargets[0].threadId === currentThreadId
      && err.details.suggestedTargets[0].role === "codex_mobile_implementation",
  );
});

test("target resolution rejects self targets and missing exact thread ids without returning raw input", () => {
  const sourceThreadId = "10000000-0000-4000-8000-000000000001";
  const missingThreadId = "10000000-0000-4000-8000-000000000099";
  const service = fakeRoutingService();

  assert.throws(
    () => service.resolveTargetReference(sourceThreadId, sourceThreadId),
    (err) => err && err.code === "target_thread_self" && err.statusCode === 400,
  );
  assert.throws(
    () => service.resolveTargetReference(missingThreadId, sourceThreadId),
    (err) => err
      && err.code === "target_thread_not_visible"
      && err.statusCode === 404
      && err.details
      && err.details.reference === missingThreadId,
  );
});
