"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  authorityDecisionForServerRequest,
  createExecutionAuthorityForCard,
  summarizeExecutionAuthority,
} = require("../services/task-cards/task-card-execution-authority-service");

function authority(overrides = {}) {
  const card = {
    id: "ttc_authority",
    source: {
      workspaceId: "/source",
      threadId: "thread-source",
      role: "plugin_main",
    },
    target: {
      workspaceId: "/workspace/project",
      threadId: "thread-target",
      role: "plugin_worker",
    },
    delivery: {
      targetApprovalBypassed: true,
      approvalMode: "source_thread_direct",
    },
    workflow: {
      mode: "autonomous",
      id: "twf_authority",
      routeKind: "implementation",
    },
  };
  return Object.assign(createExecutionAuthorityForCard(card, {
    threadId: "thread-target",
    turnId: "turn-target",
  }, { now: () => Date.parse("2099-07-10T00:00:00.000Z") }), overrides);
}

function request(command, overrides = {}) {
  return Object.assign({
    id: "approval-1",
    method: "item/commandExecution/requestApproval",
    params: {
      threadId: "thread-target",
      turnId: "turn-target",
      cwd: "/workspace/project",
      command,
    },
  }, overrides);
}

test("trusted autonomous task-card authority allows localhost readyz and workspace checks", () => {
  assert.equal(
    authorityDecisionForServerRequest(authority(), request("curl -fsS http://127.0.0.1:8787/api/readyz")).action,
    "allow",
  );
  assert.equal(
    authorityDecisionForServerRequest(authority(), request("npm run --silent check")).action,
    "allow",
  );
  assert.equal(
    authorityDecisionForServerRequest(authority(), request("git status --short")).action,
    "allow",
  );
});

test("task-card authority denies privileged destructive external and secret commands", () => {
  assert.equal(
    authorityDecisionForServerRequest(authority(), request("sudo cat /etc/passwd")).reason,
    "privileged_command",
  );
  assert.equal(
    authorityDecisionForServerRequest(authority(), request("rm -rf tmp/cache")).reason,
    "destructive_command",
  );
  assert.equal(
    authorityDecisionForServerRequest(authority(), request("curl -fsS https://api.example.test/status")).reason,
    "external_network_not_in_scope",
  );
  assert.equal(
    authorityDecisionForServerRequest(authority(), request("cat ~/.codex-mobile-web/access_key")).reason,
    "secret_path_reference",
  );
  assert.equal(
    authorityDecisionForServerRequest(authority(), request("curl -fsS http://127.0.0.1:8787/api/readyz; rm -rf tmp/cache")).reason,
    "unsafe_shell_control",
  );
});

test("task-card authority is exact-thread exact-turn and fails closed when expired or outside cwd", () => {
  assert.equal(
    authorityDecisionForServerRequest(authority(), request("git status", {
      params: { threadId: "thread-other", turnId: "turn-target", cwd: "/workspace/project", command: "git status" },
    })),
    null,
  );
  assert.equal(
    authorityDecisionForServerRequest(authority(), request("git status", {
      params: { threadId: "thread-target", turnId: "turn-other", cwd: "/workspace/project", command: "git status" },
    })),
    null,
  );
  assert.equal(
    authorityDecisionForServerRequest(authority(), request("git status", {
      params: { threadId: "thread-target", turnId: "turn-target", cwd: "/outside/project", command: "git status" },
    })).reason,
    "cwd_outside_authority_workspace",
  );
  assert.equal(
    authorityDecisionForServerRequest(authority({ workspaceRoot: "owner", targetWorkspaceId: "owner" }), request("curl -fsS http://localhost:8787/api/readyz", {
      params: { threadId: "thread-target", turnId: "turn-target", cwd: "/workspace/project", command: "curl -fsS http://localhost:8787/api/readyz" },
    })).action,
    "allow",
  );
  assert.equal(
    authorityDecisionForServerRequest(authority({ expiresAt: "2099-07-09T00:00:00.000Z" }), request("git status"), {
      now: () => Date.parse("2099-07-10T00:00:00.000Z"),
    }).reason,
    "authority_expired",
  );
});

test("task-card authority public summary is metadata-only", () => {
  const summary = summarizeExecutionAuthority(authority());
  assert.equal(summary.configured, true);
  assert.equal(summary.source, "trusted_autonomous_task_card");
  assert.deepEqual(summary.scopeClasses, [
    "workspace_read",
    "workspace_test",
    "workspace_build",
    "localhost_health_probe",
  ]);
  assert.equal(summary.expiresAtPresent, true);
  assert.equal(JSON.stringify(summary).includes("command"), false);
});
