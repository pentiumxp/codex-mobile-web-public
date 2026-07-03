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
  const codexRequests = [];
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
      applyStartThreadRuntimeSettings: (params) => params,
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
      readThreadTaskCardExecutionTargetSummary: () => ({
        id: "deploy-thread",
        title: "Home AI Deploy",
        cwd: "/Users/hermes-dev/HermesMobileDev/app",
      }),
      routeMarker: true,
    }),
    atLoopRuntimeServiceFactory: (options) => {
      atLoopOptions = options;
      return { kind: "at-loop-service" };
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
  });

  await serviceOptions.onTerminalReturnCard({ id: "return-1" });
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
  assert.deepEqual(homeAiEvents, [
    { event: { id: "return-1" }, options: { workspaceId: "owner" } },
  ]);
  assert.equal(result.threadId, "target-thread");
  assert.equal(result.turnId, "turn-1");
  assert.equal(result.runtime.reasoningEffort, "high");
  assert.equal(result.runtime.deployLaneNoApproval, true);
  assert.equal(codexRequests[0].method, "thread/resume");
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
});
