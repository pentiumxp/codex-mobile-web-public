"use strict";

const { createChatGptProBridgeService } = require("../../adapters/chatgpt-pro-bridge-service");
const { createChatGptProPlannerService } = require("../../adapters/chatgpt-pro-planner-service");
const { createChatGptProMcpService } = require("../../adapters/chatgpt-pro-mcp-service");

function createChatGptProRuntimeService(dependencies = {}) {
  const bridgeFactory = dependencies.chatGptProBridgeServiceFactory || createChatGptProBridgeService;
  const plannerFactory = dependencies.chatGptProPlannerServiceFactory || createChatGptProPlannerService;
  const mcpFactory = dependencies.chatGptProMcpServiceFactory || createChatGptProMcpService;
  const codex = dependencies.codex;
  const appRoot = dependencies.appRoot || process.cwd();
  const mutationRpcTimeoutMs = dependencies.mutationRpcTimeoutMs;

  const readSourceThreadSummary = async (sourceThreadId) => {
    if (!sourceThreadId) return null;
    let summary = dependencies.readStateDbThread(sourceThreadId)
      || dependencies.readStartedThread(sourceThreadId)
      || dependencies.readRolloutSessionFallbackThread(sourceThreadId);
    if (!summary && dependencies.readThreadSummaryFromAppServer) {
      summary = await dependencies.readThreadSummaryFromAppServer(sourceThreadId).catch(() => null);
    }
    return summary || null;
  };

  async function chatGptProSourceSummary(body = {}) {
    const sourceThreadId = String(body.sourceThreadId || body.threadId || "").trim();
    const cwd = String(body.cwd || "").trim();
    const prompt = String(body.prompt || body.text || "").trim();
    const lines = [
      "Codex Mobile bounded source context for ChatGPT Pro analysis.",
      "",
      `Source thread id: ${sourceThreadId || "(none)"}`,
      `Workspace: ${cwd || "(projectless)"}`,
    ];
    const summary = await readSourceThreadSummary(sourceThreadId);
    if (summary) {
      lines.push(`Thread title: ${dependencies.truncateSingleLine(summary.name || summary.title || summary.preview || "", 180) || "(untitled)"}`);
      lines.push(`Thread status: ${dependencies.statusText(summary.status) || "unknown"}`);
      if (summary.model) lines.push(`Model: ${dependencies.truncateSingleLine(summary.model, 80)}`);
      if (summary.effort) lines.push(`Reasoning effort: ${dependencies.truncateSingleLine(summary.effort, 80)}`);
    }
    lines.push("");
    lines.push("Current user request:");
    lines.push(dependencies.compactApprovalText(prompt, 4000));
    lines.push("");
    lines.push("Safety boundary:");
    lines.push("- This context is intentionally bounded.");
    lines.push("- Do not request or expose access keys, browser cookies, raw credentials, or full private logs.");
    lines.push("- Use repository files only when the downstream ChatGPT Pro prompt explicitly needs them and they are not secrets.");
    return lines.join("\n");
  }

  const chatGptProBridgeService = bridgeFactory({
    runtimeRoot: dependencies.runtimeRoot,
    stateFile: dependencies.bridgeFile,
    outputDir: dependencies.outputDir,
    enabled: dependencies.bridgeEnabled,
    createThread: async ({ cwd }) => {
      const runtimeSettings = dependencies.applyPermissionModeOverride({}, "full", cwd || appRoot);
      const params = dependencies.applyStartThreadRuntimeSettings({
        cwd: cwd || appRoot,
        modelProvider: null,
        config: {},
        developerInstructions: [
          "This is the dedicated Codex Mobile ChatGPT Pro bridge thread.",
          "Use Chrome only when the user request explicitly asks for ChatGPT Pro generation.",
          "Do not modify source files unless a later explicit user request asks for code changes.",
        ].join("\n"),
        personality: null,
        ephemeral: null,
        dynamicTools: null,
        mockExperimentalField: null,
        experimentalRawEvents: false,
        persistExtendedHistory: false,
      }, runtimeSettings);
      const result = await codex.request("thread/start", params, { timeoutMs: mutationRpcTimeoutMs, retry: false });
      const threadId = dependencies.threadIdFromStartResult(result);
      return { threadId, thread: result && (result.thread || result.data && result.data.thread) || {} };
    },
    startTurn: async ({ threadId, cwd, input }) => {
      const runtimeSettings = dependencies.applyPermissionModeOverride(
        await dependencies.resolveThreadRuntimeSettings(threadId),
        "full",
        cwd || appRoot,
      );
      try {
        await codex.request("thread/resume", dependencies.applyResumeRuntimeSettings({
          threadId,
          cwd: cwd || appRoot,
          persistExtendedHistory: false,
        }, runtimeSettings), { timeoutMs: mutationRpcTimeoutMs, retry: false });
      } catch (err) {
        if (!/already|loaded|active/i.test(err.message || "")) throw err;
      }
      const result = await codex.request("turn/start", dependencies.applyTurnRuntimeSettings({
        threadId,
        input,
        cwd: cwd || appRoot,
      }, runtimeSettings), { timeoutMs: mutationRpcTimeoutMs, retry: false });
      dependencies.notifyLocalTurnStarted(threadId, result, { source: "chatgpt-pro-bridge" });
      return result;
    },
    updateThreadTitle: dependencies.tryUpdateThreadTitle,
    persistThreadTitle: dependencies.persistThreadTitleToSessionIndex,
    rememberThread: dependencies.rememberStartedThread,
  });

  const chatGptProPlannerService = plannerFactory({
    runtimeRoot: dependencies.runtimeRoot,
    storeRoot: dependencies.plannerDir,
    version: dependencies.appVersion,
    listWorkspaces: dependencies.listWorkspaces,
    workspaceRoots: () => {
      const roots = dependencies.visibleWorkspaceRoots(dependencies.readGlobalState());
      roots.add(appRoot);
      for (const workspace of dependencies.workspaceRegistryService.list()) {
        if (workspace && workspace.cwd) roots.add(workspace.cwd);
      }
      return Array.from(roots);
    },
    readThreadContext: async ({ threadId }) => {
      const summary = await readSourceThreadSummary(threadId);
      if (!summary) return null;
      return {
        id: summary.id || threadId,
        title: summary.name || summary.title || summary.preview || "",
        status: dependencies.statusText(summary.status) || "",
        cwd: summary.cwd || "",
        model: summary.model || "",
        reasoningEffort: summary.effort || summary.reasoningEffort || "",
        updatedAt: summary.updatedAt || summary.updated_at || summary.updatedAtMs || summary.updated_at_ms || 0,
        summary: summary.preview || summary.firstUserMessage || "",
      };
    },
  });

  const chatGptProMcpService = mcpFactory({
    plannerService: chatGptProPlannerService,
    delegateTaskCard: async (input = {}) => dependencies.createThreadTaskCardsFromSourceThread(input.sourceThreadId, input),
    allowDirectTaskCards: dependencies.mcpAllowDirectTaskCards,
    token: dependencies.mcpToken,
    tokenFile: dependencies.mcpTokenFile,
    version: dependencies.appVersion,
  });

  return {
    chatGptProBridgeService,
    chatGptProMcpService,
    chatGptProPlannerService,
    chatGptProSourceSummary,
  };
}

module.exports = {
  createChatGptProRuntimeService,
};
