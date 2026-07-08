"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createWorkspaceMainThreadRoutingService,
  inheritedWorkspaceMainThreadRole,
  normalizeWorkspaceMainRole,
} = require("../services/runtime/workspace-main-thread-routing-service");

const HOME_AI_CWD = "/Users/hermes-dev/HermesMobileDev/app";

test("continuation inherits Home AI main role from same-workspace source", () => {
  assert.equal(inheritedWorkspaceMainThreadRole({
    cwd: HOME_AI_CWD,
    sourceThread: {
      id: "home-0622",
      title: "Home AI 06-22",
      cwd: HOME_AI_CWD,
      status: { type: "completed" },
    },
  }), "home_ai_main");
});

test("worker and deploy sources are not promoted to workspace main", () => {
  assert.equal(inheritedWorkspaceMainThreadRole({
    cwd: HOME_AI_CWD,
    sourceThread: {
      id: "worker",
      title: "Home AI 06-22 Worker Lane",
      cwd: HOME_AI_CWD,
      threadRole: "home_ai_worker",
    },
  }), "");
  assert.equal(inheritedWorkspaceMainThreadRole({
    cwd: HOME_AI_CWD,
    sourceThread: {
      id: "deploy",
      title: "Home AI Deploy",
      cwd: HOME_AI_CWD,
      threadRole: "home_ai_deploy",
    },
  }), "");
});

test("external project main is a workspace-main role without promoting worker audit or deploy lanes", () => {
  assert.equal(normalizeWorkspaceMainRole("external_project_main"), "external_project_main");
  assert.equal(normalizeWorkspaceMainRole("remote_managed_workspace_source"), "external_project_main");

  const cwd = "/Users/remote/Project";
  const service = createWorkspaceMainThreadRoutingService({
    visibleThreads: () => [
      { id: "external-main", title: "External Project Main", cwd, threadRole: "external_project_main", updatedAt: 20 },
      { id: "external-worker", title: "External Worker Lane", cwd, threadRole: "external_project_worker", updatedAt: 30 },
      { id: "external-audit", title: "External Audit Lane", cwd, threadRole: "external_project_audit", updatedAt: 40 },
      { id: "external-deploy", title: "External Deploy Lane", cwd, threadRole: "external_project_deploy", updatedAt: 50 },
    ],
    readThreadSummary: () => ({ updatedAt: 20 }),
  });

  const resolved = service.resolve({ cwd, role: "external_project_main" });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.thread.id, "external-main");
  assert.equal(resolved.thread.role, "external_project_main");
  assert.equal(service.mainCandidate({ id: "external-worker", title: "External Worker Lane", cwd, threadRole: "external_project_worker" }, { cwd }), null);
  assert.equal(service.mainCandidate({ id: "external-audit", title: "External Audit Lane", cwd, threadRole: "external_project_audit" }, { cwd }), null);
  assert.equal(service.mainCandidate({ id: "external-deploy", title: "External Deploy Lane", cwd, threadRole: "external_project_deploy" }, { cwd }), null);
});

test("main resolver prefers a live continuation over the old source thread", () => {
  const threads = [
    { id: "home-old", title: "Home AI 06-22", cwd: HOME_AI_CWD, status: { type: "completed" }, updatedAt: 10 },
    { id: "home-new", title: "Home AI 07-05", cwd: HOME_AI_CWD, status: { type: "completed" }, updatedAt: 20 },
    { id: "worker", title: "Home AI 06-22 Worker Lane", cwd: HOME_AI_CWD, threadRole: "home_ai_worker", updatedAt: 30 },
  ];
  const service = createWorkspaceMainThreadRoutingService({
    visibleThreads: () => threads,
    readThreadSummary: (id) => threads.find((thread) => thread.id === id) || null,
    readContinuationLineageEntries: () => [{
      createdAt: "2026-07-05T00:00:00.000Z",
      sourceThreadId: "home-old",
      sourceThreadTitle: "Home AI 06-22",
      newThreadId: "home-new",
      newThreadTitle: "Home AI 07-05",
      inheritedThreadRole: "home_ai_main",
      preferredMain: true,
    }],
  });

  const resolved = service.resolve({
    role: "home_ai_main",
    cwd: HOME_AI_CWD,
    sourceThreadId: "home-old",
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.thread.id, "home-new");
  assert.equal(resolved.thread.role, "home_ai_main");
  assert.equal(resolved.thread.sourceThreadId, "home-old");
});

test("main resolver does not select non-deliverable continuations", () => {
  const threads = [
    { id: "home-old", title: "Home AI 06-22", cwd: HOME_AI_CWD, status: { type: "completed" }, updatedAt: 10 },
    { id: "home-new", title: "Home AI 07-05", cwd: HOME_AI_CWD, archived: true, updatedAt: 20 },
  ];
  const service = createWorkspaceMainThreadRoutingService({
    visibleThreads: () => threads,
    readThreadSummary: (id) => threads.find((thread) => thread.id === id) || null,
    readContinuationLineageEntries: () => [{
      createdAt: "2026-07-05T00:00:00.000Z",
      sourceThreadId: "home-old",
      newThreadId: "home-new",
      inheritedThreadRole: "home_ai_main",
      preferredMain: true,
    }],
  });

  const resolved = service.resolve({
    role: "home_ai_main",
    cwd: HOME_AI_CWD,
    sourceThreadId: "home-old",
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.thread.id, "home-old");
  assert.equal(resolved.thread.deliverabilityReason, "eligible");
});
