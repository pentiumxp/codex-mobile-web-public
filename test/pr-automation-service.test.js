"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const service = require("../services/runtime/pr-automation-service");
const adapter = require("../adapters/pr-automation-service");

const public91 = {
  repoKind: "public",
  repository: "pentiumxp/codex-mobile-web-public",
  number: 91,
  title: "Fix continuation thread route",
  headRefName: "fix-continuation-thread-route",
  headRefOid: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  baseRefName: "main",
  updatedAt: "2026-07-08T09:00:00Z",
  files: [{ path: "adapters/continuation-thread-service.js" }],
};

const public90 = {
  repoKind: "public",
  repository: "pentiumxp/codex-mobile-web-public",
  number: 90,
  title: "Older public repair",
  headRefName: "older-repair",
  headRefOid: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  baseRefName: "main",
  updatedAt: "2026-07-08T08:00:00Z",
  files: [{ path: "public/vite-shell/vite-shell-readback.json" }],
};

test("PR automation adapter re-exports the canonical service boundary", () => {
  assert.equal(adapter.planPrAutomationRun, service.planPrAutomationRun);
  assert.equal(adapter.PR_AUTOMATION_STATES, service.PR_AUTOMATION_STATES);
});

test("latest public PR can remain held after private absorption without premature close", () => {
  const run = service.planPrAutomationRun({
    publicOpenPullRequests: [public90, public91],
    records: [{
      identity: "github-pr:pentiumxp/codex-mobile-web-public:91",
      state: "absorbed_private",
      absorbedPrivateRef: "77d65b0cfe681d12abfad051ca15a2ff9ddf0990",
      validationPassed: true,
    }],
    releaseHolds: [{
      repository: "pentiumxp/codex-mobile-web-public",
      number: 91,
      code: "combined_head_pending",
      reason: "latest combined head/version switch fix still in progress",
    }],
  });

  assert.equal(run.state, "blocked");
  assert.equal(run.priorState, "absorbed_private");
  assert.equal(run.issueCode, "combined_head_pending");
  assert.equal(run.selectedPullRequest.number, 91);
  assert.deepEqual(run.taskCardRequests, []);
  assert.equal(run.records.find((record) => record.pr.number === 90).state, "discovered");
});

test("unhandled generated artifacts are not trusted and dispatch source absorption", () => {
  const first = service.planPrAutomationRun({
    publicOpenPullRequests: [public90],
    worktree: {
      cwd: "/repo/shared",
      dirty: true,
      cleanWorktreeAvailable: true,
    },
  });
  const second = service.planPrAutomationRun({
    publicOpenPullRequests: [public90],
    worktree: {
      cwd: "/repo/shared",
      dirty: true,
      cleanWorktreeAvailable: true,
    },
  });

  assert.equal(first.state, "absorption_dispatched");
  assert.equal(first.issueCode, service.PR_AUTOMATION_ISSUE_CODES.GENERATED_ARTIFACTS_REBUILD_REQUIRED);
  assert.equal(first.selectedPullRequest.generatedArtifactCount, 1);
  assert.equal(first.actions[0].type, "use_clean_detached_worktree");
  assert.equal(first.actions[1].type, "reject_direct_generated_artifact_merge");
  assert.equal(first.taskCardRequests[0].purpose, "pr_absorption");
  assert.equal(first.taskCardRequests[0].targetRole, "plugin_worker");
  assert.equal(first.taskCardRequests[0].idempotencyKey, second.taskCardRequests[0].idempotencyKey);
});

test("dirty shared checkout blocks when clean worktree is unavailable", () => {
  const run = service.planPrAutomationRun({
    publicOpenPullRequests: [public90],
    worktree: {
      cwd: "/repo/shared",
      dirty: true,
      cleanWorktreeAvailable: false,
    },
  });

  assert.equal(run.state, "blocked");
  assert.equal(run.issueCode, service.PR_AUTOMATION_ISSUE_CODES.SHARED_CHECKOUT_DIRTY);
  assert.deepEqual(run.taskCardRequests, []);
});

test("missing GitHub credentials fail with a bounded blocker", () => {
  const run = service.planPrAutomationRun({
    githubCredentials: {
      available: false,
      issueCode: "github_credentials_missing",
    },
  });

  assert.equal(run.state, "blocked");
  assert.equal(run.issueCode, "github_credentials_missing");
  assert.equal(run.actions[0].type, "configure_github_credentials");
});

test("absorbed private ref advances through deploy and public-ready gates", () => {
  const absorbed = service.planPrAutomationRun({
    publicOpenPullRequests: [public91],
    records: [{
      identity: "github-pr:pentiumxp/codex-mobile-web-public:91",
      state: "absorbed_private",
      absorbedPrivateRef: "77d65b0cfe681d12abfad051ca15a2ff9ddf0990",
      validationStatus: "passed",
    }],
  });

  assert.equal(absorbed.state, "absorbed_private");
  assert.equal(absorbed.issueCode, service.PR_AUTOMATION_ISSUE_CODES.DEPLOY_READBACK_REQUIRED);
  assert.equal(absorbed.taskCardRequests[0].purpose, "plugin_deployment");
  assert.equal(absorbed.taskCardRequests[0].targetRole, "home_ai_deploy");

  const deployed = service.planPrAutomationRun({
    publicOpenPullRequests: [public91],
    records: [{
      identity: "github-pr:pentiumxp/codex-mobile-web-public:91",
      state: "deploy_readback_passed",
      absorbedPrivateRef: "77d65b0cfe681d12abfad051ca15a2ff9ddf0990",
      deployReadbackPassed: true,
    }],
  });

  assert.equal(deployed.state, "deploy_readback_passed");
  assert.equal(deployed.issueCode, service.PR_AUTOMATION_ISSUE_CODES.PUBLIC_READY_GATE_REQUIRED);
  assert.equal(deployed.taskCardRequests[0].purpose, "public_release_sync");
});

test("public-ready PR cannot close before the explicit close gate", () => {
  const withoutClose = service.planPrAutomationRun({
    publicOpenPullRequests: [public91],
    records: [{
      identity: "github-pr:pentiumxp/codex-mobile-web-public:91",
      state: "public_ready",
      publicReady: true,
    }],
  });

  assert.equal(withoutClose.state, "public_ready");
  assert.equal(withoutClose.issueCode, service.PR_AUTOMATION_ISSUE_CODES.PR_CLOSE_GATE_REQUIRED);
  assert.equal(withoutClose.actions[0].type, "await_pr_close_gate");

  const withClose = service.planPrAutomationRun({
    publicOpenPullRequests: [public91],
    gates: {
      closePrAllowed: true,
    },
    records: [{
      identity: "github-pr:pentiumxp/codex-mobile-web-public:91",
      state: "public_ready",
      publicReady: true,
    }],
  });

  assert.equal(withClose.state, "pr_closed");
  assert.equal(withClose.actions[0].type, "close_pull_request");
});

test("automation state merge persists only bounded metadata", () => {
  const run = service.planPrAutomationRun({
    publicOpenPullRequests: [public90],
  });

  const state = service.mergeAutomationState({ records: [] }, run);

  assert.equal(state.version, 1);
  assert.equal(state.records.length, 1);
  assert.equal(state.records[0].identity, "github-pr:pentiumxp/codex-mobile-web-public:90");
  assert.equal(state.records[0].state, "absorption_dispatched");
  assert.equal(state.records[0].selectedHeadShort, "bbbbbbbb");
  assert.equal(state.records[0].body, undefined);
});
