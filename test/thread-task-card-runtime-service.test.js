"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadTaskCardRuntimeService,
} = require("../services/task-cards/thread-task-card-runtime-service");

test("thread task-card runtime adapter re-exports canonical composition service", () => {
  const adapter = require("../adapters/thread-task-card-runtime-service");
  const canonical = require("../services/task-cards/thread-task-card-runtime-service");
  assert.equal(adapter.createThreadTaskCardRuntimeService, canonical.createThreadTaskCardRuntimeService);
});

test("thread task-card runtime composition wires return hook, policy, route, and approval execution", async () => {
  const homeAiEvents = [];
  const atLoopReturns = [];
  const codexRequests = [];
  const startRuntimeCalls = [];
  let serviceOptions = null;
  let atLoopOptions = null;
  let rememberedLoopThread = null;
  const runtime = createThreadTaskCardRuntimeService({
    homeAiAutonomousDeliveryReturnServiceFactory: () => ({
      send: async (event, options) => homeAiEvents.push({ event, options }),
    }),
    taskCardRuntimePolicyServiceFactory: () => ({
      applyCodexFastServiceTier: (params) => Object.assign({ codexFast: true }, params),
      applyResumeRuntimeSettings: (params, settings) => Object.assign({}, params, { resumeRuntime: settings.reasoningEffort }),
      applyStartThreadRuntimeSettings: (params, settings, applyOptions) => {
        startRuntimeCalls.push({ params, settings, applyOptions });
        return params;
      },
      applyTurnRuntimeSettings: (params, settings) => Object.assign({}, params, { turnRuntime: settings.reasoningEffort }),
      requestedCodexFastMode: () => "",
      workspaceSourceWriteGuardDecisionForRequest: () => ({ ok: true }),
      workspaceSourceWriteGuardLogPayload: () => ({ ok: true }),
    }),
    threadTaskCardServiceFactory: (options) => {
      serviceOptions = options;
      return { kind: "task-card-service" };
    },
    threadTaskCardRouteServiceFactory: () => ({
      attachWorkspaceDelegationRuntimeGuidance: (value) => Object.assign({ guided: true }, value),
      assertThreadTaskCardTargetDeliverable: () => "target-thread",
      resolveThreadTaskCardTargetReference: (threadId) => threadId,
      readThreadTaskCardExecutionTargetSummary: () => ({
        id: "deploy-thread",
        title: "Home AI Deploy",
        cwd: "/Users/hermes-dev/HermesMobileDev/app",
      }),
      routeMarker: true,
    }),
    atLoopRuntimeServiceFactory: (options) => {
      atLoopOptions = options;
      return {
        kind: "at-loop-service",
        recordTerminalReturn: async (input) => {
          atLoopReturns.push(input);
          return { ok: true, loop: { loopId: input.loopId } };
        },
      };
    },
    atLoopRouteServiceFactory: (options) => ({ kind: "at-loop-route", atLoopRuntimeService: options.atLoopRuntimeService }),
    codex: {
      request: async (method, params, options) => {
        codexRequests.push({ method, params, options });
        if (method === "thread/start") return { threadId: "loop-role-thread", thread: { id: "loop-role-thread", cwd: params.cwd } };
        return method === "turn/start" ? { turnId: "turn-1" } : { ok: true };
      },
    },
    resolveThreadRuntimeSettings: async () => ({ reasoningEffort: "medium", approvalPolicy: "never", sandboxPolicy: { type: "workspace-write" } }),
    applyPermissionModeOverride: (settings, approvalPolicy, cwd) => Object.assign({}, settings, { approvalPolicy, cwd }),
    mutationRpcTimeoutMs: 1234,
    notifyLocalTurnStarted: () => "turn-1",
    readStartThreadDeveloperInstructions: () => "AGENTS",
    persistThreadTitleToSessionIndex: () => true,
    tryUpdateThreadTitle: async () => true,
    rememberStartedThread: (thread) => {
      rememberedLoopThread = thread;
      return thread;
    },
    listWorkspaces: async () => [{ cwd: "/repo/plugin", label: "Plugin" }],
  });

  await serviceOptions.onTerminalReturnCard({ id: "return-1" });
  await serviceOptions.onTerminalReturnCard({
    taskCardId: "ttc_loop_role",
    returnCardId: "ttc_loop_return",
    status: "completed",
    summary: "implementation completed",
    returnBody: "## Validation Packet\n- focused test passed",
    metadata: {
      workflowId: "at-loop:loop_abc123",
      sourceThreadId: "source-thread",
      targetThreadId: "target-thread",
    },
  });
  const result = await serviceOptions.executeApprovedCard({
    target: { threadId: "target-thread" },
    delivery: { reasoningEffort: "high" },
  }, { text: "run it" });

  assert.equal(runtime.threadTaskCardService.kind, "task-card-service");
  assert.equal(runtime.threadTaskCardRouteService.routeMarker, true);
  assert.equal(runtime.atLoopRuntimeService.kind, "at-loop-service");
  assert.equal(runtime.atLoopRouteService.kind, "at-loop-route");
  assert.equal(runtime.attachWorkspaceDelegationRuntimeGuidance({}).guided, true);
  assert.equal(typeof atLoopOptions.assertThreadTaskCardTargetDeliverable, "function");
  assert.equal(typeof atLoopOptions.resolveThreadTaskCardTargetReference, "function");
  assert.equal(typeof atLoopOptions.listWorkspaces, "function");
  assert.equal(typeof atLoopOptions.startSourceRequirementsTurn, "function");
  assert.deepEqual(homeAiEvents, [
    { event: { id: "return-1" }, options: { workspaceId: "owner" } },
    {
      event: {
        taskCardId: "ttc_loop_role",
        returnCardId: "ttc_loop_return",
        status: "completed",
        summary: "implementation completed",
        metadata: {
          workflowId: "at-loop:loop_abc123",
          sourceThreadId: "source-thread",
          targetThreadId: "target-thread",
        },
      },
      options: { workspaceId: "owner" },
    },
  ]);
  assert.deepEqual(atLoopReturns, [{
    loopId: "loop_abc123",
    taskCardId: "ttc_loop_role",
    returnCardId: "ttc_loop_return",
    status: "completed",
    summary: "implementation completed",
    returnBody: "## Validation Packet\n- focused test passed",
  }]);
  assert.equal(result.threadId, "target-thread");
  assert.equal(result.turnId, "turn-1");
  assert.equal(result.runtime.reasoningEffort, "high");
  assert.equal(result.runtime.deployLaneNoApproval, true);
  assert.equal(codexRequests[0].method, "thread/resume");
  assert.equal(codexRequests[0].params.cwd, "/Users/hermes-dev/HermesMobileDev/app");
  assert.equal(codexRequests[0].params.resumeRuntime, "high");
  assert.equal(codexRequests[1].method, "turn/start");
  assert.equal(codexRequests[1].params.turnRuntime, "high");

  const roleThread = await atLoopOptions.createLoopRoleThread({
    role: "implementation",
    cwd: "/repo/plugin",
    title: "Plugin Loop Implementation",
    threadRole: "implementation",
    sourceThread: { id: "source-thread", title: "Plugin", cwd: "/repo/plugin" },
    loop: { sourceThreadId: "source-thread" },
  });
  assert.equal(roleThread.id, "loop-role-thread");
  assert.equal(rememberedLoopThread.threadRole, "implementation");
  assert.equal(rememberedLoopThread.title, "Plugin Loop Implementation");
  assert.equal(codexRequests[2].method, "thread/start");
  assert.equal(codexRequests[2].params.cwd, "/repo/plugin");
  assert.equal(codexRequests[2].params.developerInstructions, "AGENTS");
  assert.equal(startRuntimeCalls.length, 1);
  assert.equal(startRuntimeCalls[0].applyOptions.skipWorkspaceDelegationRuntimeGuidance, true);

  const sourceRequirementsTurn = await atLoopOptions.startSourceRequirementsTurn({
    loop: { loopId: "loop_source", sourceThreadId: "source-thread" },
    slice: { roleSliceId: "loop_source:requirements:1" },
    sourceThread: { id: "source-thread", cwd: "/repo/plugin" },
    prompt: "produce requirements packets",
  });
  assert.equal(sourceRequirementsTurn.threadId, "source-thread");
  assert.equal(sourceRequirementsTurn.turnId, "turn-1");
  assert.equal(codexRequests[3].method, "thread/resume");
  assert.equal(codexRequests[3].params.threadId, "source-thread");
  assert.equal(codexRequests[3].params.cwd, "/repo/plugin");
  assert.equal(codexRequests[4].method, "turn/start");
  assert.equal(codexRequests[4].params.threadId, "source-thread");
  assert.deepEqual(codexRequests[4].params.input, [{ type: "text", text: "produce requirements packets" }]);
  assert.equal(codexRequests[4].params.turnRuntime, "medium");
});

test("thread task-card runtime grants worker lanes full access by default", async () => {
  const codexRequests = [];
  const overrides = [];
  let serviceOptions = null;
  createThreadTaskCardRuntimeService({
    homeAiAutonomousDeliveryReturnServiceFactory: () => ({ send: async () => ({ ok: true }) }),
    taskCardRuntimePolicyServiceFactory: () => ({
      applyCodexFastServiceTier: (params) => params,
      applyResumeRuntimeSettings: (params, settings) => Object.assign({}, params, {
        resumeApprovalPolicy: settings.approvalPolicy,
        resumeSandboxPolicyType: settings.sandboxPolicy && settings.sandboxPolicy.type,
      }),
      applyStartThreadRuntimeSettings: (params) => params,
      applyTurnRuntimeSettings: (params, settings) => Object.assign({}, params, {
        turnApprovalPolicy: settings.approvalPolicy,
        turnSandboxPolicyType: settings.sandboxPolicy && settings.sandboxPolicy.type,
      }),
      requestedCodexFastMode: () => "",
      workspaceSourceWriteGuardDecisionForRequest: () => null,
      workspaceSourceWriteGuardLogPayload: () => ({}),
    }),
    threadTaskCardServiceFactory: (options) => {
      serviceOptions = options;
      return { kind: "task-card-service" };
    },
    threadTaskCardRouteServiceFactory: () => ({
      attachWorkspaceDelegationRuntimeGuidance: (value) => value,
      assertThreadTaskCardTargetDeliverable: () => "worker-thread",
      resolveThreadTaskCardTargetReference: (threadId) => threadId,
      readThreadTaskCardExecutionTargetSummary: () => ({
        id: "worker-thread",
        title: "Home AI Worker Lane",
        cwd: "/Users/hermes-dev/HermesMobileDev/app",
        threadRole: "home_ai_worker",
      }),
    }),
    atLoopRuntimeServiceFactory: () => ({ recordTerminalReturn: async () => ({ ok: true }) }),
    atLoopRouteServiceFactory: () => ({ kind: "at-loop-route" }),
    codex: {
      request: async (method, params, options) => {
        codexRequests.push({ method, params, options });
        return method === "turn/start" ? { turnId: "turn-worker" } : { ok: true };
      },
    },
    resolveThreadRuntimeSettings: async () => ({
      reasoningEffort: "medium",
      approvalPolicy: "on-request",
      sandboxPolicy: { type: "workspaceWrite" },
    }),
    applyPermissionModeOverride: (settings, approvalPolicy, cwd) => {
      overrides.push({ approvalPolicy, cwd });
      return Object.assign({}, settings, {
        approvalPolicy: "never",
        sandboxPolicy: { type: "dangerFullAccess" },
        cwd,
      });
    },
    mutationRpcTimeoutMs: 1234,
    notifyLocalTurnStarted: () => "turn-worker",
  });

  const result = await serviceOptions.executeApprovedCard({
    target: { threadId: "worker-thread" },
    delivery: {},
  }, { text: "run worker task" });

  assert.deepEqual(overrides, [{ approvalPolicy: "full", cwd: "/Users/hermes-dev/HermesMobileDev/app" }]);
  assert.equal(result.runtime.workerLaneFullAccess, true);
  assert.equal(result.runtime.approvalPolicy, "never");
  assert.equal(result.runtime.sandboxPolicyType, "dangerFullAccess");
  assert.equal(codexRequests[0].params.resumeApprovalPolicy, "never");
  assert.equal(codexRequests[1].params.turnApprovalPolicy, "never");
  assert.equal(codexRequests[1].params.turnSandboxPolicyType, "dangerFullAccess");
});

test("thread task-card runtime grants at-loop implementation roles writable execution policy", async () => {
  const codexRequests = [];
  const overrides = [];
  let serviceOptions = null;
  createThreadTaskCardRuntimeService({
    homeAiAutonomousDeliveryReturnServiceFactory: () => ({ send: async () => ({ ok: true }) }),
    taskCardRuntimePolicyServiceFactory: () => ({
      applyCodexFastServiceTier: (params) => params,
      applyResumeRuntimeSettings: (params, settings) => Object.assign({}, params, {
        resumeApprovalPolicy: settings.approvalPolicy,
        resumeSandboxPolicyType: settings.sandboxPolicy && settings.sandboxPolicy.type,
      }),
      applyStartThreadRuntimeSettings: (params) => params,
      applyTurnRuntimeSettings: (params, settings) => Object.assign({}, params, {
        turnApprovalPolicy: settings.approvalPolicy,
        turnSandboxPolicyType: settings.sandboxPolicy && settings.sandboxPolicy.type,
      }),
      requestedCodexFastMode: () => "",
      workspaceSourceWriteGuardDecisionForRequest: () => null,
      workspaceSourceWriteGuardLogPayload: () => ({}),
    }),
    threadTaskCardServiceFactory: (options) => {
      serviceOptions = options;
      return { kind: "task-card-service" };
    },
    threadTaskCardRouteServiceFactory: () => ({
      attachWorkspaceDelegationRuntimeGuidance: (value) => value,
      assertThreadTaskCardTargetDeliverable: () => "implementation-thread",
      resolveThreadTaskCardTargetReference: (threadId) => threadId,
      readThreadTaskCardExecutionTargetSummary: () => ({
        id: "implementation-thread",
        title: "Plugin Loop Implementation",
        cwd: "/repo/plugin",
        threadRole: "implementation",
      }),
    }),
    atLoopRuntimeServiceFactory: () => ({ recordTerminalReturn: async () => ({ ok: true }) }),
    atLoopRouteServiceFactory: () => ({ kind: "at-loop-route" }),
    codex: {
      request: async (method, params, options) => {
        codexRequests.push({ method, params, options });
        return method === "turn/start" ? { turnId: "turn-implementation" } : { ok: true };
      },
    },
    resolveThreadRuntimeSettings: async () => ({
      reasoningEffort: "medium",
      approvalPolicy: "on-request",
      sandboxPolicy: { type: "readOnly" },
    }),
    applyPermissionModeOverride: (settings, approvalPolicy, cwd) => {
      overrides.push({ approvalPolicy, cwd });
      return Object.assign({}, settings, {
        approvalPolicy: "never",
        sandboxPolicy: { type: "dangerFullAccess" },
        cwd,
      });
    },
    mutationRpcTimeoutMs: 1234,
    notifyLocalTurnStarted: () => "turn-implementation",
  });

  const result = await serviceOptions.executeApprovedCard({
    target: { threadId: "implementation-thread", role: "implementation" },
    routeResolution: {
      routeKind: "at_loop_role_slice",
      targetRole: "implementation",
    },
    workflow: { id: "at-loop:loop_implementation" },
    delivery: {},
  }, { text: "run implementation task" });

  assert.deepEqual(overrides, [{ approvalPolicy: "full", cwd: "/repo/plugin" }]);
  assert.equal(result.runtime.implementationFullAccess, true);
  assert.equal(result.runtime.approvalPolicy, "never");
  assert.equal(result.runtime.sandboxPolicyType, "dangerFullAccess");
  assert.equal(codexRequests[0].params.resumeApprovalPolicy, "never");
  assert.equal(codexRequests[1].params.turnApprovalPolicy, "never");
  assert.equal(codexRequests[1].params.turnSandboxPolicyType, "dangerFullAccess");
});

test("thread task-card runtime keeps at-loop audit roles on inherited policy", async () => {
  const codexRequests = [];
  const overrides = [];
  let serviceOptions = null;
  createThreadTaskCardRuntimeService({
    homeAiAutonomousDeliveryReturnServiceFactory: () => ({ send: async () => ({ ok: true }) }),
    taskCardRuntimePolicyServiceFactory: () => ({
      applyCodexFastServiceTier: (params) => params,
      applyResumeRuntimeSettings: (params, settings) => Object.assign({}, params, {
        resumeApprovalPolicy: settings.approvalPolicy,
        resumeSandboxPolicyType: settings.sandboxPolicy && settings.sandboxPolicy.type,
      }),
      applyStartThreadRuntimeSettings: (params) => params,
      applyTurnRuntimeSettings: (params, settings) => Object.assign({}, params, {
        turnApprovalPolicy: settings.approvalPolicy,
        turnSandboxPolicyType: settings.sandboxPolicy && settings.sandboxPolicy.type,
      }),
      requestedCodexFastMode: () => "",
      workspaceSourceWriteGuardDecisionForRequest: () => null,
      workspaceSourceWriteGuardLogPayload: () => ({}),
    }),
    threadTaskCardServiceFactory: (options) => {
      serviceOptions = options;
      return { kind: "task-card-service" };
    },
    threadTaskCardRouteServiceFactory: () => ({
      attachWorkspaceDelegationRuntimeGuidance: (value) => value,
      assertThreadTaskCardTargetDeliverable: () => "audit-thread",
      resolveThreadTaskCardTargetReference: (threadId) => threadId,
      readThreadTaskCardExecutionTargetSummary: () => ({
        id: "audit-thread",
        title: "Product Audit Lane",
        cwd: "/repo/plugin",
        threadRole: "product_audit",
      }),
    }),
    atLoopRuntimeServiceFactory: () => ({ recordTerminalReturn: async () => ({ ok: true }) }),
    atLoopRouteServiceFactory: () => ({ kind: "at-loop-route" }),
    codex: {
      request: async (method, params, options) => {
        codexRequests.push({ method, params, options });
        return method === "turn/start" ? { turnId: "turn-audit" } : { ok: true };
      },
    },
    resolveThreadRuntimeSettings: async () => ({
      reasoningEffort: "medium",
      approvalPolicy: "on-request",
      sandboxPolicy: { type: "readOnly" },
    }),
    applyPermissionModeOverride: (settings, approvalPolicy, cwd) => {
      overrides.push({ approvalPolicy, cwd });
      return Object.assign({}, settings, {
        approvalPolicy: "never",
        sandboxPolicy: { type: "dangerFullAccess" },
        cwd,
      });
    },
    mutationRpcTimeoutMs: 1234,
    notifyLocalTurnStarted: () => "turn-audit",
  });

  const result = await serviceOptions.executeApprovedCard({
    target: { threadId: "audit-thread", role: "product_audit" },
    routeResolution: {
      routeKind: "at_loop_role_slice",
      targetRole: "product_audit",
    },
    workflow: { id: "at-loop:loop_audit" },
    delivery: {},
  }, { text: "run audit task" });

  assert.deepEqual(overrides, []);
  assert.equal(result.runtime.implementationFullAccess, false);
  assert.equal(result.runtime.approvalPolicy, "on-request");
  assert.equal(result.runtime.sandboxPolicyType, "readOnly");
  assert.equal(codexRequests[0].params.resumeApprovalPolicy, "on-request");
  assert.equal(codexRequests[1].params.turnApprovalPolicy, "on-request");
  assert.equal(codexRequests[1].params.turnSandboxPolicyType, "readOnly");
});

test("thread task-card runtime fails at-loop terminal return before external notification when local correlation fails", async () => {
  const homeAiEvents = [];
  let serviceOptions = null;
  createThreadTaskCardRuntimeService({
    homeAiAutonomousDeliveryReturnServiceFactory: () => ({
      send: async (event, options) => homeAiEvents.push({ event, options }),
    }),
    taskCardRuntimePolicyServiceFactory: () => ({
      applyCodexFastServiceTier: (params) => params,
      applyResumeRuntimeSettings: (params) => params,
      applyStartThreadRuntimeSettings: (params) => params,
      applyTurnRuntimeSettings: (params) => params,
      requestedCodexFastMode: () => "",
      workspaceSourceWriteGuardDecisionForRequest: () => ({ ok: true }),
      workspaceSourceWriteGuardLogPayload: () => ({ ok: true }),
    }),
    threadTaskCardServiceFactory: (options) => {
      serviceOptions = options;
      return { kind: "task-card-service" };
    },
    threadTaskCardRouteServiceFactory: () => ({
      attachWorkspaceDelegationRuntimeGuidance: (value) => value,
      assertThreadTaskCardTargetDeliverable: () => "target-thread",
      resolveThreadTaskCardTargetReference: (threadId) => threadId,
      readThreadTaskCardExecutionTargetSummary: () => null,
    }),
    atLoopRuntimeServiceFactory: () => ({
      recordTerminalReturn: async () => ({ ok: false, error: "at_loop_return_slice_not_found" }),
    }),
    atLoopRouteServiceFactory: (options) => ({ atLoopRuntimeService: options.atLoopRuntimeService }),
  });

  await assert.rejects(() => serviceOptions.onTerminalReturnCard({
    taskCardId: "ttc_loop_role",
    returnCardId: "ttc_loop_return",
    status: "blocked",
    summary: "blocked",
    metadata: { workflowId: "at-loop:loop_missing" },
  }), /at_loop_return_slice_not_found/);
  assert.deepEqual(homeAiEvents, []);
});
