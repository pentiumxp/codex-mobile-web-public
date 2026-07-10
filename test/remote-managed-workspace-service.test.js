"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createRemoteManagedWorkspaceService,
} = require("../services/remote-managed-workspaces/remote-managed-workspace-service");
const {
  validateProjectRoot,
} = require("../services/remote-managed-workspaces/remote-managed-workspace-node-client-service");

function makeService() {
  return createRemoteManagedWorkspaceService({
    fs,
    path,
    crypto,
    stateFile: "",
    enrollmentTokens: ["token"],
    now: () => new Date("2026-07-08T00:00:00.000Z"),
  });
}

function registerFixture(service) {
  return service.register({
    workspaceId: "rmw_test",
    workspaceKind: "remote_managed_workspace",
    projectType: "node",
    projectRoot: "/tmp/project",
    centralUrl: "http://127.0.0.1:9999",
    nodeName: "node-a",
    contractVersion: "remote-managed-workspace.v1",
    roles: ["external_project_main", "external_project_worker", "external_project_audit", "external_project_deploy"],
    capabilities: ["task-card-relay"],
    projectRootEvidence: { exists: true, withinAllowedRoot: true },
  }, { token: "token" });
}

test("remote managed workspace registration returns bounded identity without token material", () => {
  const service = makeService();
  const result = registerFixture(service);

  assert.equal(result.ok, true);
  assert.equal(result.workspace.workspaceKind, "remote_managed_workspace");
  assert.equal(result.workspace.controlPlaneOwner, "home_ai");
  assert.equal(result.workspace.serviceMode, "codex_mobile_local_home_ai_central_simulator");
  assert.equal(result.workspace.roles.includes("external_project_main"), true);
  assert.equal(result.node.status, "registered");
  assert.doesNotMatch(JSON.stringify(result), /token|secret|Bearer/i);
});

test("remote managed workspace pairing approval issues scoped credential without snapshot leakage", () => {
  const service = createRemoteManagedWorkspaceService({
    fs,
    path,
    crypto,
    stateFile: "",
    enrollmentTokens: [],
    now: () => new Date("2026-07-08T00:00:00.000Z"),
  });
  const requested = service.requestPairing({
    workspaceId: "rmw_pairing_test",
    workspaceKind: "remote_managed_workspace",
    projectType: "node",
    projectRootLabel: "GMK-test",
    centralUrl: "http://127.0.0.1:8797",
    nodeId: "rmn_pairing",
    nodeName: "node-pairing",
    contractVersion: "remote-managed-workspace.v1",
    roles: ["external_project_main", "external_project_worker"],
    capabilities: ["task-card-poll", "task-card-return"],
    projectRootEvidence: { exists: true, withinAllowedRoot: true },
  });
  assert.equal(requested.ok, true);
  assert.equal(requested.pairing.status, "pending_approval");
  assert.doesNotMatch(JSON.stringify(requested), /scoped-node-credential/);

  const approved = service.approvePairing(requested.pairing.requestId, {
    scopedCredential: "scoped-node-credential",
  });
  assert.equal(approved.pairing.status, "approved");
  assert.equal(approved.pairing.scopedCredential, "scoped-node-credential");

  const registered = service.register({
    workspaceId: "rmw_pairing_test",
    workspaceKind: "remote_managed_workspace",
    projectType: "node",
    projectRoot: "/tmp/project",
    centralUrl: "http://127.0.0.1:8797",
    nodeName: "node-pairing",
    contractVersion: "remote-managed-workspace.v1",
    roles: ["external_project_main", "external_project_worker"],
    capabilities: ["task-card-poll", "task-card-return"],
    projectRootEvidence: { exists: true, withinAllowedRoot: true },
  }, { token: "scoped-node-credential" });
  assert.equal(registered.ok, true);

  const snapshot = service.snapshot();
  assert.equal(snapshot.pairingRequests[requested.pairing.requestId].status, "approved");
  assert.doesNotMatch(JSON.stringify(snapshot), /scoped-node-credential/);
  assert.doesNotMatch(JSON.stringify(snapshot), /credentialHash/);
});

test("remote managed workspace pairing rejection remains bounded and unauthenticated", () => {
  const service = makeService();
  const requested = service.requestPairing({
    workspaceId: "rmw_pairing_reject",
    workspaceKind: "remote_managed_workspace",
    projectType: "node",
    projectRootLabel: "Reject Demo",
    centralUrl: "http://127.0.0.1:8797",
    nodeName: "node-reject",
    contractVersion: "remote-managed-workspace.v1",
    roles: ["external_project_main", "external_project_worker"],
    capabilities: ["task-card-poll"],
  });
  const rejected = service.rejectPairing(requested.pairing.requestId, { reason: "owner_rejected" });
  assert.equal(rejected.pairing.status, "rejected");
  assert.equal(service.pairingStatus(requested.pairing.requestId).pairing.reason, "owner_rejected");
  assert.throws(() => service.register({
    workspaceId: "rmw_pairing_reject",
    workspaceKind: "remote_managed_workspace",
    projectType: "node",
    projectRoot: "/tmp/project",
    centralUrl: "http://127.0.0.1:8797",
    nodeName: "node-reject",
    contractVersion: "remote-managed-workspace.v1",
    roles: ["external_project_main", "external_project_worker"],
    capabilities: ["task-card-poll"],
    projectRootEvidence: { exists: true, withinAllowedRoot: true },
  }, { token: "not-approved" }), /remote_managed_workspace_enrollment_token_invalid/);
});

test("remote node projectRoot validation requires an existing directory inside an allowed root", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-root-"));
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  try {
    const valid = validateProjectRoot({ projectRoot, allowedRoots: [root] }, { fs, path });
    assert.equal(valid.evidence.exists, true);
    assert.equal(valid.evidence.withinAllowedRoot, true);
    assert.throws(() => validateProjectRoot({ projectRoot: path.dirname(root), allowedRoots: [root] }, { fs, path }), /project_root_outside_allowed_root/);
    assert.throws(() => validateProjectRoot({ projectRoot: path.join(root, "missing"), allowedRoots: [root] }, { fs, path }), /project_root_not_found/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote task-card relay is idempotent and tracks per-card heartbeat plus zh-CN terminal return", () => {
  const service = makeService();
  registerFixture(service);
  const first = service.enqueueTaskCard("rmw_test", {
    taskCardId: "ttc_remote_a",
    idempotencyKey: "idem-a",
    title: "Remote task",
    summary: "bounded",
    bodyMarkdown: "Run one bounded task.",
    reasoningEffort: "medium",
    executionRequirements: {
      requiresCommandExecution: true,
      minimumCompletedCommandCount: 1,
      requiredCommandClasses: ["workspace_read"],
      toolSurfaceRequired: true,
    },
  }, { token: "token" });
  const duplicate = service.enqueueTaskCard("rmw_test", {
    taskCardId: "ttc_remote_b",
    idempotencyKey: "idem-a",
    title: "Remote duplicate",
  }, { token: "token" });

  assert.equal(first.duplicate, false);
  assert.equal(first.card.executionRequirements.requiresCommandExecution, true);
  assert.deepEqual(first.card.executionRequirements.requiredCommandClasses, ["workspace_read"]);
  assert.equal(duplicate.duplicate, true);
  const polled = service.pollTaskCards("rmw_test", { limit: 4 }, { token: "token" });
  assert.equal(polled.count, 1);
  assert.equal(polled.taskCards[0].executionRequirements.minimumCompletedCommandCount, 1);

  const acked = service.ackTaskCard("rmw_test", "ttc_remote_a", { leaseId: "lease-a" }, { token: "token" });
  assert.equal(acked.card.executionLease.ackedAt, "2026-07-08T00:00:00.000Z");
  const heartbeat = service.heartbeatTaskCard("rmw_test", "ttc_remote_a", { status: "working" }, { token: "token" });
  assert.equal(heartbeat.card.executionLease.lastHeartbeatAt, "2026-07-08T00:00:00.000Z");

  const returned = service.returnTaskCard("rmw_test", "ttc_remote_a", {
    status: "completed",
    title: "完成",
    summary: "done",
    locale: "en-US",
    metadata: { validation: "focused" },
  }, { token: "token" });
  assert.equal(returned.card.terminalStatus, "completed");
  assert.equal(returned.terminalReturn.locale, "zh-CN");
  assert.equal(service.pollTaskCards("rmw_test", { limit: 4 }, { token: "token" }).count, 0);
});

test("remote daily summary and escalation reject forbidden raw/private payload classes", () => {
  const service = makeService();
  registerFixture(service);

  assert.throws(() => service.dailySummary("rmw_test", {
    changedFiles: ["/absolute/path.js"],
    buildStatus: "ok",
  }, { token: "token" }), /daily_summary_changed_file_must_be_relative/);
  assert.throws(() => service.escalation("rmw_test", {
    reason: "blocked",
    severity: "h2",
    title: "Escalation",
    rawLogs: "private",
  }, { token: "token" }), /forbidden/);

  const summary = service.dailySummary("rmw_test", {
    changedFiles: ["src/index.js"],
    buildStatus: "ok",
    testStatus: "ok",
    previewStatus: "unknown",
    nextFocus: "deploy readback",
  }, { token: "token" });
  const escalation = service.escalation("rmw_test", {
    reason: "blocked",
    severity: "h2",
    title: "Need deploy lane",
    summary: "deploy_needed",
    nextStep: "dispatch deploy lane",
  }, { token: "token" });
  assert.equal(summary.ok, true);
  assert.equal(escalation.ok, true);
});
