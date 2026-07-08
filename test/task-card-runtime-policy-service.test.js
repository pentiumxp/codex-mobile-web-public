"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createTaskCardRuntimePolicyService,
} = require("../services/task-cards/task-card-runtime-policy-service");

function tempProjectRoot(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `codex-mobile-runtime-policy-${name}-`));
  fs.mkdirSync(path.join(root, ".git"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name }), "utf8");
  return root;
}

function tempHomeAiRoot() {
  const root = tempProjectRoot("home-ai");
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "PLATFORM_CONTRACTS"), { recursive: true });
  fs.writeFileSync(path.join(root, "scripts", "ai-ops-control-plane.js"), "", "utf8");
  fs.writeFileSync(path.join(root, "scripts", "deploy-macos-production.js"), "", "utf8");
  fs.writeFileSync(path.join(root, "docs", "PLATFORM_CONTRACTS", "plugin-workspace-platform-contract.md"), "", "utf8");
  return root;
}

function createService(overrides = {}) {
  const threads = overrides.threads || new Map();
  return createTaskCardRuntimePolicyService(Object.assign({
    actionableApprovalMethods: new Set(["applyPatchApproval", "item/commandExecution/requestApproval"]),
    latestThreadIdByTurnId: overrides.latestThreadIdByTurnId || new Map(),
    recentStartedThreads: overrides.recentStartedThreads || new Map(),
    normalizeFsPath: (value) => String(value || "").replace(/[\\/]+/g, "/").replace(/\/+$/, "").toLowerCase(),
    workspaceDelegationPublicSettings: () => ({ enabled: true }),
    workspaceWriteSandboxPolicy: (cwd, inheritedPolicy) => Object.assign({
      type: "workspaceWrite",
      writableRoots: [cwd],
      networkAccess: false,
    }, inheritedPolicy || {}),
    normalizeSandboxPolicyType: (value) => String(value || ""),
    workspaceDelegationWriteGuardPermissionProfile: (cwd) => ({ type: "managed", cwd }),
    attachWorkspaceDelegationRuntimeGuidance: (params) => {
      params.developerInstructions = [params.developerInstructions, "workspace delegation guidance"].filter(Boolean).join("\n");
    },
    readStateDbThread: (threadId) => threads.get(threadId) || null,
    readStartedThread: () => null,
    readRolloutSessionFallbackThread: () => null,
    visibleWorkspaceRoots: () => new Set(overrides.workspaceRoots || []),
    readGlobalState: () => ({}),
    readThreadListFallback: () => [],
    pushThreadId: (params = {}) => String(params.threadId || params.thread_id || ""),
    shortIdentifier: (value) => String(value || "").slice(0, 12),
    compactOneLine: (value) => String(value || "").replace(/\s+/g, " ").trim(),
  }, overrides));
}

test("task-card runtime policy applies inherited model, effort, guidance, and workspace guard", () => {
  const workspace = tempProjectRoot("target");
  const threads = new Map([["thread-1", { id: "thread-1", cwd: workspace }]]);
  const service = createService({ threads, workspaceRoots: [workspace] });

  const params = service.applyTurnRuntimeSettings({ threadId: "thread-1" }, {
    model: "gpt-5.5",
    reasoningEffort: "high",
    reasoningSummary: "auto",
    sandboxPolicy: { type: "workspaceWrite", writableRoots: [workspace] },
  });

  assert.equal(params.cwd, workspace);
  assert.equal(params.model, "gpt-5.5");
  assert.equal(params.effort, "high");
  assert.equal(params.summary, "auto");
  assert.equal(params.approvalPolicy, "on-request");
  assert.equal(params.sandboxPolicy.type, "workspaceWrite");
  assert.ok(params.sandboxPolicy.writableRoots.includes(path.join(workspace, ".git")));
  assert.deepEqual(params.permissionProfile, { type: "managed", cwd: workspace });
  assert.match(params.developerInstructions, /workspace delegation guidance/);

  fs.rmSync(workspace, { recursive: true, force: true });
});

test("task-card runtime policy applies a normalized reasoning effort floor", () => {
  const service = createService();

  assert.deepEqual(service.applyReasoningEffortFloor({ reasoningEffort: "high" }, "xhigh"), {
    reasoningEffort: "xhigh",
  });
  assert.deepEqual(service.applyReasoningEffortFloor({ reasoningEffort: "xhigh" }, "high"), {
    reasoningEffort: "xhigh",
  });
  assert.deepEqual(service.applyReasoningEffortFloor({ model: "gpt-5.5" }, "xhigh"), {
    model: "gpt-5.5",
    reasoningEffort: "xhigh",
  });
});

test("task-card runtime policy applies reasoning effort to resume and turn params", () => {
  const service = createService();

  const resumeParams = service.applyResumeRuntimeSettings({}, { reasoningEffort: "xhigh" });
  const turnParams = service.applyTurnRuntimeSettings({}, { reasoningEffort: "xhigh" });

  assert.equal(resumeParams.effort, "xhigh");
  assert.equal(turnParams.effort, "xhigh");
});

test("task-card runtime policy keeps source-thread cwd before command cwd in approval guard", () => {
  const source = tempProjectRoot("source");
  const foreign = tempProjectRoot("foreign");
  const threads = new Map([["thread-1", { id: "thread-1", cwd: source }]]);
  const service = createService({ threads, workspaceRoots: [source, foreign] });

  const decision = service.workspaceSourceWriteGuardDecisionForRequest({
    id: "approval-1",
    method: "item/commandExecution/requestApproval",
    params: {
      threadId: "thread-1",
      cwd: foreign,
      command: "git status",
    },
  });

  assert.equal(decision.action, "allow");
  assert.equal(decision.reason, "read_or_non_write_command");

  const logPayload = service.workspaceSourceWriteGuardLogPayload({ id: "approval-1", params: { threadId: "thread-1", cwd: foreign } }, decision, "allow");
  assert.equal(logPayload.cwd, source);

  fs.rmSync(source, { recursive: true, force: true });
  fs.rmSync(foreign, { recursive: true, force: true });
});

test("task-card runtime policy preserves codex-mobile and Home AI maintenance exemptions", () => {
  const codexMobile = tempProjectRoot("codex-mobile-web");
  fs.writeFileSync(path.join(codexMobile, "server.js"), "", "utf8");
  const homeAi = tempHomeAiRoot();
  const service = createService();

  assert.equal(service.workspaceDelegationGuardExemptCwd(codexMobile), true);
  assert.equal(service.workspaceDelegationGuardExemptCwd(homeAi), true);
  assert.equal(service.applyStartThreadRuntimeSettings({ cwd: codexMobile }, {}).sandbox, undefined);

  fs.rmSync(codexMobile, { recursive: true, force: true });
  fs.rmSync(homeAi, { recursive: true, force: true });
});

test("task-card runtime policy can skip delegation guidance for internal role thread starts", () => {
  const workspace = tempProjectRoot("target");
  const service = createService();

  const guided = service.applyStartThreadRuntimeSettings({ cwd: workspace }, {});
  assert.match(guided.developerInstructions, /workspace delegation guidance/);

  const internal = service.applyStartThreadRuntimeSettings({ cwd: workspace }, {}, {
    skipWorkspaceDelegationRuntimeGuidance: true,
  });
  assert.doesNotMatch(internal.developerInstructions || "", /workspace delegation guidance/);

  fs.rmSync(workspace, { recursive: true, force: true });
});

test("task-card runtime policy supports explicit full-access compatibility mode", () => {
  const workspace = tempProjectRoot("target");
  const service = createService({
    workspaceDelegationApprovalProxyOnly: true,
    workspaceDelegationEnforceSandboxGuard: false,
  });

  const startParams = service.applyStartThreadRuntimeSettings({ cwd: workspace }, {});
  assert.equal(startParams.approvalPolicy, "on-request");
  assert.equal(startParams.sandbox, "danger-full-access");
  assert.equal(startParams.permissionProfile, undefined);

  const turnParams = service.applyTurnRuntimeSettings({ cwd: workspace }, {});
  assert.equal(turnParams.approvalPolicy, "on-request");
  assert.deepEqual(turnParams.sandboxPolicy, { type: "dangerFullAccess" });
  assert.equal(turnParams.permissionProfile, undefined);

  fs.rmSync(workspace, { recursive: true, force: true });
});

test("task-card runtime policy preserves explicit no-approval full-access runtime", () => {
  const workspace = tempProjectRoot("target");
  const service = createService();
  const runtimeSettings = {
    approvalPolicy: "never",
    sandboxMode: "danger-full-access",
    sandboxPolicy: { type: "dangerFullAccess" },
  };

  const resumeParams = service.applyResumeRuntimeSettings({ cwd: workspace }, runtimeSettings);
  assert.equal(resumeParams.approvalPolicy, "never");
  assert.equal(resumeParams.sandbox, "danger-full-access");
  assert.equal(resumeParams.permissionProfile, undefined);

  const turnParams = service.applyTurnRuntimeSettings({ cwd: workspace }, runtimeSettings);
  assert.equal(turnParams.approvalPolicy, "never");
  assert.deepEqual(turnParams.sandboxPolicy, { type: "dangerFullAccess" });
  assert.equal(turnParams.permissionProfile, undefined);

  fs.rmSync(workspace, { recursive: true, force: true });
});
