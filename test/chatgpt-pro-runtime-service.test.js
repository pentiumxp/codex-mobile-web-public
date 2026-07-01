"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const adapter = require("../adapters/chatgpt-pro-runtime-service");
const service = require("../services/runtime/chatgpt-pro-runtime-service");

test("ChatGPT Pro runtime adapter re-exports canonical runtime service", () => {
  assert.equal(adapter.createChatGptProRuntimeService, service.createChatGptProRuntimeService);
});

test("ChatGPT Pro runtime composition wires bridge, planner, MCP, and bounded summary", async () => {
  const codexCalls = [];
  const notified = [];
  const createdCards = [];
  const runtime = service.createChatGptProRuntimeService({
    appRoot: "/repo",
    appVersion: "0.1.test",
    runtimeRoot: "/runtime",
    bridgeFile: "/runtime/bridge.json",
    outputDir: "/runtime/out",
    bridgeEnabled: true,
    plannerDir: "/runtime/planner",
    mutationRpcTimeoutMs: 1234,
    mcpAllowDirectTaskCards: true,
    mcpToken: "token",
    mcpTokenFile: "/token",
    codex: {
      request: async (method, params, options) => {
        codexCalls.push({ method, params, options });
        if (method === "thread/start") return { thread: { id: "pro-thread" } };
        return { turn: { id: "turn-1" } };
      },
    },
    applyPermissionModeOverride: (settings, mode, cwd) => Object.assign({}, settings, { mode, cwd }),
    applyStartThreadRuntimeSettings: (params, runtimeSettings) => Object.assign({}, params, { runtimeSettings }),
    applyResumeRuntimeSettings: (params, runtimeSettings) => Object.assign({}, params, { runtimeSettings }),
    applyTurnRuntimeSettings: (params, runtimeSettings) => Object.assign({}, params, { runtimeSettings }),
    resolveThreadRuntimeSettings: async () => ({ model: "gpt-test" }),
    threadIdFromStartResult: () => "pro-thread",
    notifyLocalTurnStarted: (threadId, result, meta) => notified.push({ threadId, result, meta }),
    tryUpdateThreadTitle: () => {},
    persistThreadTitleToSessionIndex: () => {},
    rememberStartedThread: () => {},
    listWorkspaces: () => [],
    visibleWorkspaceRoots: () => new Set(["/visible"]),
    readGlobalState: () => ({}),
    workspaceRegistryService: { list: () => [{ cwd: "/registered" }] },
    readStateDbThread: () => ({
      id: "source-thread",
      title: "Source Title",
      status: { type: "active" },
      cwd: "/repo",
      model: "gpt-5",
      effort: "high",
      preview: "Preview text",
    }),
    readStartedThread: () => null,
    readRolloutSessionFallbackThread: () => null,
    readThreadSummaryFromAppServer: async () => null,
    statusText: (status) => status && status.type || "",
    truncateSingleLine: (value) => String(value || "").replace(/\s+/g, " ").trim(),
    compactApprovalText: (value) => String(value || "").trim(),
    createThreadTaskCardsFromSourceThread: async (sourceThreadId, input) => {
      createdCards.push({ sourceThreadId, input });
      return { ok: true };
    },
    chatGptProBridgeServiceFactory: (options) => ({
      options,
      async startTurn(input) {
        return options.startTurn(input);
      },
    }),
    chatGptProPlannerServiceFactory: (options) => ({
      options,
      status: () => ({ ok: true }),
    }),
    chatGptProMcpServiceFactory: (options) => ({
      options,
      isConfigured: () => true,
    }),
  });

  assert.equal(typeof runtime.chatGptProSourceSummary, "function");
  assert.equal(runtime.chatGptProPlannerService.options.workspaceRoots().includes("/registered"), true);

  const summary = await runtime.chatGptProSourceSummary({
    sourceThreadId: "source-thread",
    cwd: "/repo",
    prompt: "explain this",
  });
  assert.match(summary, /Codex Mobile bounded source context/);
  assert.match(summary, /Thread title: Source Title/);
  assert.match(summary, /Reasoning effort: high/);

  await runtime.chatGptProBridgeService.options.createThread({ cwd: "/repo" });
  assert.equal(codexCalls[0].method, "thread/start");
  assert.equal(codexCalls[0].params.runtimeSettings.mode, "full");

  await runtime.chatGptProBridgeService.startTurn({
    threadId: "pro-thread",
    cwd: "/repo",
    input: [{ text: "Generate" }],
  });
  assert.equal(codexCalls[1].method, "thread/resume");
  assert.equal(codexCalls[2].method, "turn/start");
  assert.equal(notified[0].meta.source, "chatgpt-pro-bridge");

  await runtime.chatGptProMcpService.options.delegateTaskCard({ sourceThreadId: "source", body: "task" });
  assert.equal(createdCards[0].sourceThreadId, "source");
  assert.equal(runtime.chatGptProMcpService.options.allowDirectTaskCards, true);
});
