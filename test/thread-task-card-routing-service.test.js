"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadTaskCardRoutingService,
  threadTaskCardTargetReferenceEntries,
  threadTaskCardTargetReferences,
} = require("../adapters/thread-task-card-routing-service");

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

test("exact targetThreadId wins over same-workspace canonical cwd routing", () => {
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
  assert.equal(service.resolveTargetReference(cwd, sourceThreadId), newestThreadId);
  assert.deepEqual(
    service.resolvedTargetIds({ targetThreadId: exactThreadId, targetCwd: cwd }, sourceThreadId),
    [exactThreadId],
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
