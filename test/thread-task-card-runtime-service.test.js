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
      readThreadTaskCardExecutionTargetSummary: () => ({
        id: "deploy-thread",
        title: "Home AI Deploy",
        cwd: "/Users/hermes-dev/HermesMobileDev/app",
      }),
      routeMarker: true,
    }),
    codex: {
      request: async (method, params, options) => {
        codexRequests.push({ method, params, options });
        return method === "turn/start" ? { turnId: "turn-1" } : { ok: true };
      },
    },
    resolveThreadRuntimeSettings: async () => ({ reasoningEffort: "medium", approvalPolicy: "never", sandboxPolicy: { type: "workspace-write" } }),
    applyPermissionModeOverride: (settings, approvalPolicy, cwd) => Object.assign({}, settings, { approvalPolicy, cwd }),
    mutationRpcTimeoutMs: 1234,
    notifyLocalTurnStarted: () => "turn-1",
  });

  await serviceOptions.onTerminalReturnCard({ id: "return-1" });
  const result = await serviceOptions.executeApprovedCard({
    target: { threadId: "target-thread" },
    delivery: { reasoningEffort: "high" },
  }, { text: "run it" });

  assert.equal(runtime.threadTaskCardService.kind, "task-card-service");
  assert.equal(runtime.threadTaskCardRouteService.routeMarker, true);
  assert.equal(runtime.attachWorkspaceDelegationRuntimeGuidance({}).guided, true);
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
});
