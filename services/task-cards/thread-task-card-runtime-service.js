"use strict";

const { createHomeAiAutonomousDeliveryReturnService } = require("./home-ai-autonomous-delivery-return-service");
const { createHomeAiSecretRefService } = require("../runtime/home-ai-secret-ref-service");
const { createTaskCardRuntimePolicyService } = require("./task-card-runtime-policy-service");
const { createThreadTaskCardService } = require("./thread-task-card-service");
const {
  isHomeAiDeployLaneThread,
} = require("./thread-task-card-deploy-lane-policy-service");
const { createLoopTaskRuntimeService } = require("../at-loop/loop-task-runtime-service");
const { createAtLoopRouteService } = require("../../server-routes/at-loop-route-service");
const { createThreadTaskCardRouteService } = require("../../server-routes/thread-task-card-route-service");

function createThreadTaskCardRuntimeService(dependencies = {}) {
  const homeAiAutonomousDeliveryReturnServiceFactory = dependencies.homeAiAutonomousDeliveryReturnServiceFactory
    || createHomeAiAutonomousDeliveryReturnService;
  const homeAiSecretRefServiceFactory = dependencies.homeAiSecretRefServiceFactory
    || createHomeAiSecretRefService;
  const taskCardRuntimePolicyServiceFactory = dependencies.taskCardRuntimePolicyServiceFactory
    || createTaskCardRuntimePolicyService;
  const threadTaskCardServiceFactory = dependencies.threadTaskCardServiceFactory
    || createThreadTaskCardService;
  const threadTaskCardRouteServiceFactory = dependencies.threadTaskCardRouteServiceFactory
    || createThreadTaskCardRouteService;
  const atLoopRuntimeServiceFactory = dependencies.atLoopRuntimeServiceFactory
    || createLoopTaskRuntimeService;
  const atLoopRouteServiceFactory = dependencies.atLoopRouteServiceFactory
    || createAtLoopRouteService;

  const homeAiAutonomousDeliveryReturnService = homeAiAutonomousDeliveryReturnServiceFactory({
    baseUrl: dependencies.hermesPluginNotificationBaseUrl,
    webKey: dependencies.hermesPluginNotificationKey,
    webKeyFile: dependencies.hermesPluginNotificationKeyFile,
    registrationForWorkspace: dependencies.registrationForWorkspace,
  });
  const homeAiSecretRefService = homeAiSecretRefServiceFactory({
    baseUrl: dependencies.homeAiSecretRefBaseUrl || dependencies.hermesPluginNotificationBaseUrl,
    webKey: dependencies.homeAiSecretRefKey || dependencies.hermesPluginNotificationKey,
    webKeyFile: dependencies.homeAiSecretRefKeyFile || dependencies.hermesPluginNotificationKeyFile,
    consumePath: dependencies.homeAiSecretRefConsumePath,
    timeoutMs: dependencies.homeAiSecretRefTimeoutMs,
    registrationForWorkspace: dependencies.registrationForWorkspace,
  });

  let attachWorkspaceDelegationRuntimeGuidance = () => null;
  let readThreadTaskCardExecutionTargetSummary = () => null;
  let atLoopRuntimeService = null;

  function atLoopLoopIdFromTerminalReturnEvent(event = {}) {
    const metadata = event && typeof event.metadata === "object" ? event.metadata : {};
    const workflowId = String(metadata.workflowId || "").trim();
    return workflowId.startsWith("at-loop:") ? workflowId.slice("at-loop:".length).trim() : "";
  }

  async function recordAtLoopTerminalReturn(event = {}) {
    const loopId = atLoopLoopIdFromTerminalReturnEvent(event);
    if (!loopId) return null;
    if (!atLoopRuntimeService || typeof atLoopRuntimeService.recordTerminalReturn !== "function") {
      const err = new Error("at_loop_runtime_unavailable_for_terminal_return");
      err.statusCode = 503;
      throw err;
    }
    const result = await atLoopRuntimeService.recordTerminalReturn({
      loopId,
      taskCardId: event.taskCardId,
      returnCardId: event.returnCardId,
      status: event.status,
      summary: event.summary,
    });
    if (result && result.ok === false) {
      const err = new Error(result.error || "at_loop_terminal_return_correlation_failed");
      err.statusCode = 409;
      throw err;
    }
    return result || null;
  }

  const taskCardRuntimePolicyService = taskCardRuntimePolicyServiceFactory({
    fs: dependencies.fs,
    path: dependencies.path,
    platform: dependencies.platform,
    actionableApprovalMethods: dependencies.actionableApprovalMethods,
    latestThreadIdByTurnId: dependencies.latestThreadIdByTurnId,
    recentStartedThreads: dependencies.recentStartedThreads,
    normalizeFsPath: dependencies.normalizeFsPath,
    workspaceDelegationPublicSettings: dependencies.workspaceDelegationPublicSettings,
    workspaceWriteSandboxPolicy: dependencies.workspaceWriteSandboxPolicy,
    normalizeSandboxPolicyType: dependencies.normalizeSandboxPolicyType,
    workspaceDelegationWriteGuardPermissionProfile: dependencies.workspaceDelegationWriteGuardPermissionProfile,
    attachWorkspaceDelegationRuntimeGuidance: (...args) => attachWorkspaceDelegationRuntimeGuidance(...args),
    readStateDbThread: dependencies.readStateDbThread,
    readStartedThread: dependencies.readStartedThread,
    readRolloutSessionFallbackThread: dependencies.readRolloutSessionFallbackThread,
    visibleWorkspaceRoots: dependencies.visibleWorkspaceRoots,
    readGlobalState: dependencies.readGlobalState,
    readThreadListFallback: dependencies.readThreadListFallback,
    pushThreadId: dependencies.pushThreadId,
    shortIdentifier: dependencies.shortIdentifier,
    compactOneLine: dependencies.compactOneLine,
    workspaceDelegationGuardExemptCwds: dependencies.workspaceDelegationGuardExemptCwds,
    workspaceDelegationGuardSelfExemptionDisabled: dependencies.workspaceDelegationGuardSelfExemptionDisabled,
    workspaceDelegationGuardPlatformExemptionDisabled: dependencies.workspaceDelegationGuardPlatformExemptionDisabled,
    workspaceDelegationWriteGuardDisabled: dependencies.workspaceDelegationWriteGuardDisabled,
    workspaceDelegationApprovalProxyOnly: dependencies.workspaceDelegationApprovalProxyOnly,
    workspaceDelegationEnforceSandboxGuard: dependencies.workspaceDelegationEnforceSandboxGuard,
  });
  const {
    applyCodexFastServiceTier,
    applyResumeRuntimeSettings,
    applyStartThreadRuntimeSettings,
    applyTurnRuntimeSettings,
    requestedCodexFastMode,
    workspaceSourceWriteGuardDecisionForRequest,
    workspaceSourceWriteGuardLogPayload,
  } = taskCardRuntimePolicyService;

  const threadTaskCardService = threadTaskCardServiceFactory({
    storageFile: dependencies.threadTaskCardFile,
    returnThreadTaskCardScriptPath: dependencies.returnThreadTaskCardScriptPath,
    onTerminalReturnCard: async (event) => {
      await recordAtLoopTerminalReturn(event);
      return homeAiAutonomousDeliveryReturnService.send(event, { workspaceId: "owner" });
    },
    executeApprovedCard: async (card, message) => {
      const requestedReasoningEffort = String(card && card.delivery && card.delivery.reasoningEffort || "").trim();
      const inheritedRuntimeSettings = await dependencies.resolveThreadRuntimeSettings(card.target.threadId);
      const targetThread = readThreadTaskCardExecutionTargetSummary(card);
      const targetIsDeployLane = isHomeAiDeployLaneThread(targetThread);
      const baseRuntimeSettings = targetIsDeployLane
        ? dependencies.applyPermissionModeOverride(inheritedRuntimeSettings, "full", targetThread && targetThread.cwd || null)
        : inheritedRuntimeSettings;
      const runtimeSettings = requestedReasoningEffort
        ? Object.assign({}, baseRuntimeSettings, { reasoningEffort: requestedReasoningEffort })
        : baseRuntimeSettings;
      try {
        await dependencies.codex.request("thread/resume", applyResumeRuntimeSettings({
          threadId: card.target.threadId,
          cwd: targetThread && targetThread.cwd || null,
          persistExtendedHistory: true,
        }, runtimeSettings), { timeoutMs: dependencies.mutationRpcTimeoutMs, retry: false });
      } catch (err) {
        if (!/already|loaded|active/i.test(err.message || "")) throw err;
      }
      const turnParams = applyTurnRuntimeSettings({
        threadId: card.target.threadId,
        input: [{ type: "text", text: message.text }],
      }, runtimeSettings);
      const result = await dependencies.codex.request("turn/start", turnParams, {
        timeoutMs: dependencies.mutationRpcTimeoutMs,
        retry: false,
      });
      const turnId = dependencies.notifyLocalTurnStarted(card.target.threadId, result, {
        source: "thread-task-card-approval",
      });
      return {
        threadId: String(card.target.threadId || ""),
        turnId,
        result,
        runtime: {
          reasoningEffort: runtimeSettings.reasoningEffort || "",
          requestedReasoningEffort,
          approvalPolicy: runtimeSettings.approvalPolicy || "",
          sandboxPolicyType: runtimeSettings.sandboxPolicy && runtimeSettings.sandboxPolicy.type || "",
          deployLaneNoApproval: targetIsDeployLane,
        },
      };
    },
  });

  const threadTaskCardRouteService = threadTaskCardRouteServiceFactory({
    appRoot: dependencies.appRoot,
    threadTaskCardService,
    threadTaskCardDraftTag: dependencies.threadTaskCardDraftTag,
    threadTaskCardBodyMaxChars: dependencies.threadTaskCardBodyMaxChars,
    workspaceDelegationToolNamespace: dependencies.workspaceDelegationToolNamespace,
    workspaceDelegationToolName: dependencies.workspaceDelegationToolName,
    taskCardReturnToolName: dependencies.taskCardReturnToolName,
    reasoningEffortOptions: dependencies.reasoningEffortOptions,
    readRuntimeSettings: dependencies.readRuntimeSettings,
    workspaceDelegationPublicSettings: dependencies.workspaceDelegationPublicSettings,
    recentStartedThreads: dependencies.recentStartedThreads,
    readStateDbThread: dependencies.readStateDbThread,
    readStartedThread: dependencies.readStartedThread,
    readRolloutSessionFallbackThread: dependencies.readRolloutSessionFallbackThread,
    hydrateThreadTitleFromSessionIndex: dependencies.hydrateThreadTitleFromSessionIndex,
    readThreadListFallback: dependencies.readThreadListFallback,
    visibilityFromGlobalState: dependencies.visibilityFromGlobalState,
    threadHasArchiveSignal: dependencies.threadHasArchiveSignal,
    isHiddenThread: dependencies.isHiddenThread,
    isSubagentThreadSummary: dependencies.isSubagentThreadSummary,
    isSideChatSidecarThreadSummary: dependencies.isSideChatSidecarThreadSummary,
    normalizeFsPath: dependencies.normalizeFsPath,
    threadDisplayTitle: dependencies.threadDisplayTitle,
    isRecoverableThreadListTitle: dependencies.isRecoverableThreadListTitle,
    stableTextHash: dependencies.stableTextHash,
    truncateSingleLine: dependencies.truncateSingleLine,
    truncateToolDescriptionText: dependencies.truncateToolDescriptionText,
    shortIdentifier: dependencies.shortIdentifier,
    pushThreadId: dependencies.pushThreadId,
    threadIdForTurnId: dependencies.threadIdForTurnId,
    attachThreadTaskCardsToResult: dependencies.attachThreadTaskCardsToResult,
    attachPendingServerRequestsToResult: dependencies.attachPendingServerRequestsToResult,
    httpStatusError: dependencies.httpStatusError,
    createTargetError: dependencies.createTargetError,
    logger: dependencies.logger,
  });

  attachWorkspaceDelegationRuntimeGuidance = threadTaskCardRouteService.attachWorkspaceDelegationRuntimeGuidance;
  readThreadTaskCardExecutionTargetSummary = threadTaskCardRouteService.readThreadTaskCardExecutionTargetSummary;

  async function createLoopRoleThread(input = {}) {
    const role = String(input.role || "").trim();
    const sourceThread = input.sourceThread && typeof input.sourceThread === "object" ? input.sourceThread : {};
    const cwd = String(input.cwd || sourceThread.cwd || "").trim();
    const title = String(input.title || `${sourceThread.title || sourceThread.id || "Loop"} ${role || "role"}`).replace(/\s+/g, " ").trim();
    if (!role) throw new Error("at_loop_role_required");
    if (!cwd) throw new Error("at_loop_role_thread_cwd_required");
    if (!dependencies.codex || typeof dependencies.codex.request !== "function") {
      throw new Error("at_loop_role_thread_create_unavailable");
    }
    const sourceThreadId = String(input.loop && input.loop.sourceThreadId || sourceThread.id || sourceThread.threadId || "").trim();
    const inheritedRuntimeSettings = sourceThreadId && typeof dependencies.resolveThreadRuntimeSettings === "function"
      ? await dependencies.resolveThreadRuntimeSettings(sourceThreadId)
      : {};
    const startParamsBase = {
      cwd,
      config: {},
      developerInstructions: typeof dependencies.readStartThreadDeveloperInstructions === "function"
        ? dependencies.readStartThreadDeveloperInstructions(cwd) || ""
        : "",
      persistExtendedHistory: true,
    };
    const startParams = applyStartThreadRuntimeSettings(startParamsBase, inheritedRuntimeSettings || {});
    const startResult = await dependencies.codex.request("thread/start", startParams, {
      timeoutMs: dependencies.mutationRpcTimeoutMs,
      retry: false,
    });
    const threadId = typeof dependencies.threadIdFromStartResult === "function"
      ? dependencies.threadIdFromStartResult(startResult)
      : String(startResult && (startResult.threadId || startResult.id || startResult.thread && startResult.thread.id) || "");
    if (!threadId) throw new Error("at_loop_role_thread_create_missing_thread_id");
    if (title && typeof dependencies.persistThreadTitleToSessionIndex === "function") {
      dependencies.persistThreadTitleToSessionIndex(threadId, title);
    }
    if (title && typeof dependencies.tryUpdateThreadTitle === "function") {
      try {
        await dependencies.tryUpdateThreadTitle(threadId, title);
      } catch (_) {}
    }
    const startedThread = startResult && (startResult.thread || startResult.data && startResult.data.thread) || {};
    const thread = Object.assign({}, startedThread, {
      id: threadId,
      name: title || startedThread.name,
      title: title || startedThread.title,
      preview: title || startedThread.preview || role,
      cwd: cwd || startedThread.cwd || "",
      status: { type: "notLoaded" },
      threadRole: String(input.threadRole || role || "").trim(),
    });
    if (typeof dependencies.rememberStartedThread === "function") {
      return dependencies.rememberStartedThread(thread) || thread;
    }
    return thread;
  }

  atLoopRuntimeService = atLoopRuntimeServiceFactory({
    fs: dependencies.fs,
    path: dependencies.path,
    storageFile: dependencies.atLoopStateFile,
    createThreadTaskCardsFromSourceThread: threadTaskCardRouteService.createThreadTaskCardsFromSourceThread,
    createLoopRoleThread,
    readThreadTaskCardTargetSummary: threadTaskCardRouteService.readThreadTaskCardTargetSummary,
    readThreadTaskCardVisibleTargetSummary: threadTaskCardRouteService.readThreadTaskCardVisibleTargetSummary,
    threadTaskCardVisibleTargetThreads: threadTaskCardRouteService.threadTaskCardVisibleTargetThreads,
    assertThreadTaskCardTargetDeliverable: threadTaskCardRouteService.assertThreadTaskCardTargetDeliverable,
    resolveThreadTaskCardTargetReference: threadTaskCardRouteService.resolveThreadTaskCardTargetReference,
    loopTargetAliases: dependencies.atLoopTargetAliases,
    listWorkspaces: dependencies.listWorkspaces,
    maxIterations: dependencies.atLoopMaxIterations,
    watchdogStaleMs: dependencies.atLoopWatchdogStaleMs,
    clock: dependencies.clock,
  });
  const atLoopRouteService = atLoopRouteServiceFactory({
    atLoopRuntimeService,
  });

  return Object.assign({
    atLoopRouteService,
    atLoopRuntimeService,
    homeAiAutonomousDeliveryReturnService,
    homeAiSecretRefService,
    taskCardRuntimePolicyService,
    threadTaskCardRouteService,
    threadTaskCardService,
  }, taskCardRuntimePolicyService, threadTaskCardRouteService);
}

module.exports = {
  createThreadTaskCardRuntimeService,
};
