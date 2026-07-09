"use strict";

const { createHomeAiAutonomousDeliveryReturnService } = require("./home-ai-autonomous-delivery-return-service");
const { createHomeAiSecretRefService } = require("../runtime/home-ai-secret-ref-service");
const {
  applyReasoningEffortFloor: defaultApplyReasoningEffortFloor,
  createTaskCardRuntimePolicyService,
} = require("./task-card-runtime-policy-service");
const { createThreadTaskCardService } = require("./thread-task-card-service");
const {
  isHomeAiDeployLaneThread,
} = require("./thread-task-card-deploy-lane-policy-service");
const {
  classifyThreadPurpose,
} = require("../at-loop/thread-task-card-loop-routing-service");
const {
  createWorkspaceMainThreadRoutingService,
} = require("../runtime/workspace-main-thread-routing-service");
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
  const workspaceMainThreadRoutingService = createWorkspaceMainThreadRoutingService({
    path: dependencies.path,
  });

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

  function isWorkerLaneThread(thread = {}) {
    const role = String(thread && (thread.role || thread.threadRole || thread.thread_role || thread.taskCardRole || thread.task_card_role) || "").trim().toLowerCase();
    if (role === "home_ai_worker" || role === "plugin_worker") return true;
    const classification = classifyThreadPurpose(thread || {});
    return classification && classification.purpose === "worker_lane";
  }

  function workerLifecycleRole(thread = {}, card = {}) {
    const role = String(
      thread && (thread.role || thread.threadRole || thread.thread_role || thread.taskCardRole || thread.task_card_role)
        || card && card.target && card.target.role
        || card && card.routeResolution && card.routeResolution.targetRole
        || "",
    ).trim().toLowerCase();
    if (role === "home_ai_worker" || role === "plugin_worker") return role;
    if (isWorkerLaneThread(thread)) return role || "plugin_worker";
    return "";
  }

  function workerLifecyclePluginId(thread = {}, card = {}) {
    return String(
      thread && (thread.pluginId || thread.plugin_id)
        || card && card.target && (card.target.pluginId || card.target.plugin_id)
        || card && card.routeResolution && (card.routeResolution.pluginId || card.routeResolution.plugin_id)
        || "",
    ).trim();
  }

  function workerLifecycleCwd(thread = {}, card = {}) {
    return String(
      thread && (thread.cwd || thread.workspace || thread.targetWorkspace)
        || card && card.target && (card.target.workspaceId || card.target.workspace || card.target.cwd)
        || "",
    ).trim();
  }

  async function recordWorkerLifecycleHeartbeat(event = {}, release = false) {
    const card = event.card && typeof event.card === "object" ? event.card : {};
    const heartbeat = event.heartbeat && typeof event.heartbeat === "object" ? event.heartbeat : {};
    const targetThreadId = String(
      event.targetThreadId
        || heartbeat.targetThreadId
        || card && card.target && card.target.threadId
        || "",
    ).trim();
    if (!targetThreadId) return null;
    const targetThread = readThreadTaskCardExecutionTargetSummary({ target: Object.assign({}, card.target || {}, { threadId: targetThreadId }) });
    const role = workerLifecycleRole(targetThread, card);
    if (!role || !isWorkerLaneThread(Object.assign({}, targetThread, { threadRole: role }))) return null;
    if (!atLoopRuntimeService || typeof atLoopRuntimeService.threadLifecycle !== "function") {
      return { ok: false, error: "worker_lifecycle_runtime_unavailable" };
    }
    const sourceThreadId = String(card && card.source && card.source.threadId || "").trim();
    const taskCardId = String(event.taskCardId || heartbeat.taskCardId || card.id || "").trim();
    const cwd = workerLifecycleCwd(targetThread, card);
    const pluginId = workerLifecyclePluginId(targetThread, card);
    const heartbeatResult = await atLoopRuntimeService.threadLifecycle({
      action: "heartbeat",
      role,
      targetThreadId,
      sourceThreadId,
      workspaceCwd: cwd,
      cwd,
      pluginId,
      taskCardId,
      status: String(heartbeat.status || event.status || (release ? "completed" : "working") || "").trim(),
      source: String(heartbeat.source || event.source || "").trim(),
      turnId: String(heartbeat.turnId || event.turnId || event.execution && event.execution.turnId || "").trim(),
      summary: String(heartbeat.summary || event.summary || "").trim(),
    });
    if (!release || !heartbeatResult || heartbeatResult.ok === false) return heartbeatResult;
    const releaseResult = await atLoopRuntimeService.threadLifecycle({
      action: "mark_available",
      role,
      targetThreadId,
      sourceThreadId,
      workspaceCwd: cwd,
      cwd,
      pluginId,
      taskCardId,
    });
    return Object.assign({}, releaseResult || {}, {
      heartbeat: heartbeatResult,
    });
  }

  function taskCardRoleText(...values) {
    return values
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean)
      .join(" ");
  }

  function taskCardRouteKind(card = {}) {
    return String(
      card.routeResolution && (card.routeResolution.routeKind || card.routeResolution.kind)
        || card.routeKind
        || "",
    ).trim().toLowerCase();
  }

  function taskCardWorkflowId(card = {}) {
    return String(card.workflow && card.workflow.id || "").trim();
  }

  function isAtLoopRoleSliceCard(card = {}) {
    return taskCardRouteKind(card) === "at_loop_role_slice" || taskCardWorkflowId(card).startsWith("at-loop:");
  }

  function taskCardTargetRoleText(card = {}, targetThread = {}) {
    return taskCardRoleText(
      card.target && card.target.role,
      card.routeResolution && card.routeResolution.targetRole,
      targetThread && (targetThread.threadRole || targetThread.thread_role || targetThread.role || targetThread.taskCardRole || targetThread.task_card_role),
    );
  }

  function targetThreadIdentityValue(thread = {}, target = {}, keyNames = []) {
    for (const key of keyNames) {
      const value = thread && thread[key] || target && target[key];
      if (String(value || "").trim()) return String(value || "").trim();
    }
    return "";
  }

  function mergedTaskCardTargetThread(card = {}, targetThread = {}) {
    const target = card && card.target && typeof card.target === "object" ? card.target : {};
    const routeResolution = card && card.routeResolution && typeof card.routeResolution === "object" ? card.routeResolution : {};
    const merged = Object.assign({}, targetThread || {});
    merged.id = targetThreadIdentityValue(merged, target, ["id", "threadId", "thread_id"]);
    merged.threadId = merged.id;
    merged.title = targetThreadIdentityValue(merged, target, ["title", "name", "threadTitle", "thread_title"]);
    merged.cwd = targetThreadIdentityValue(merged, target, [
      "cwd",
      "workspace",
      "workspaceId",
      "workspace_id",
      "targetWorkspace",
      "target_workspace",
      "targetWorkspaceId",
      "target_workspace_id",
    ]);
    const role = String(
      merged.threadRole
        || merged.thread_role
        || merged.role
        || merged.taskCardRole
        || merged.task_card_role
        || target.role
        || routeResolution.targetRole
        || "",
    ).trim();
    if (role) merged.threadRole = role;
    return merged;
  }

  function targetMainSourceRuntimeRole(card = {}, targetThread = {}) {
    const merged = mergedTaskCardTargetThread(card, targetThread);
    if (!merged.id) return "";
    const candidate = workspaceMainThreadRoutingService.mainCandidate(merged, {
      cwd: merged.cwd,
      role: merged.threadRole || merged.role || "",
    });
    return candidate && candidate.role || "";
  }

  function isLoopReadOnlyRoleExecutionCard(card = {}, targetThread = {}) {
    if (!isAtLoopRoleSliceCard(card)) return false;
    const roleText = taskCardTargetRoleText(card, targetThread);
    if (/(^|[\s_-])(implementation|implementer|repair|deploy|deployment)([\s_-]|$)/.test(roleText)) return false;
    return /(^|[\s_-])(product[\s_-]*audit|audit|requirements?|review|validation)([\s_-]|$)/.test(roleText);
  }

  function nonBlockingRuntimeSettings(inheritedRuntimeSettings, cwd) {
    if (typeof dependencies.applyPermissionModeOverride === "function") {
      return dependencies.applyPermissionModeOverride(inheritedRuntimeSettings, "full", cwd || null);
    }
    return Object.assign({}, inheritedRuntimeSettings || {}, {
      approvalPolicy: "never",
      sandboxPolicy: { type: "dangerFullAccess" },
      sandboxMode: "danger-full-access",
      permissionProfile: null,
    });
  }

  function isImplementationExecutionCard(card = {}, targetThread = {}) {
    const routeKind = taskCardRouteKind(card);
    const workflowId = taskCardWorkflowId(card);
    const roleText = taskCardTargetRoleText(card, targetThread);
    if (!/(^|[\s_-])(implementation|implementer|repair)([\s_-]|$)/.test(roleText)) return false;
    if (routeKind === "at_loop_role_slice" || workflowId.startsWith("at-loop:")) return true;
    return isWorkerLaneThread(targetThread);
  }

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
    const terminalReturn = {
      loopId,
      taskCardId: event.taskCardId,
      returnCardId: event.returnCardId,
      status: event.status,
      summary: event.summary,
    };
    if (event.returnBody) terminalReturn.returnBody = event.returnBody;
    const result = await atLoopRuntimeService.recordTerminalReturn(terminalReturn);
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
    applyReasoningEffortFloor = defaultApplyReasoningEffortFloor,
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
    onExecutionLeaseStarted: async (event) => recordWorkerLifecycleHeartbeat(event, false),
    onExecutionHeartbeat: async (event) => recordWorkerLifecycleHeartbeat(event, false),
    onExecutionLeaseCompleted: async (event) => recordWorkerLifecycleHeartbeat(event, true),
    onTerminalReturnCard: async (event) => {
      await recordAtLoopTerminalReturn(event);
      const externalEvent = Object.assign({}, event || {});
      delete externalEvent.returnBody;
      return homeAiAutonomousDeliveryReturnService.send(externalEvent, { workspaceId: "owner" });
    },
    onTaskCardReturnChanged: async (event) => {
      const threadId = String(event && (event.returnTargetThreadId || event.sourceThreadId) || "").trim();
      if (!threadId || typeof dependencies.broadcast !== "function") return { ok: false, reason: "broadcast_unavailable" };
      dependencies.broadcast({
        type: "notification",
        method: "thread/task-card-return/changed",
        params: Object.assign({}, event || {}, { threadId }),
      });
      return { ok: true, threadId };
    },
    executeApprovedCard: async (card, message) => {
      const requestedReasoningEffort = String(card && card.delivery && card.delivery.reasoningEffort || "").trim();
      const inheritedRuntimeSettings = await dependencies.resolveThreadRuntimeSettings(card.target.threadId);
      const targetThread = readThreadTaskCardExecutionTargetSummary(card);
      const targetIsDeployLane = isHomeAiDeployLaneThread(targetThread);
      const targetIsWorkerLane = isWorkerLaneThread(targetThread);
      const targetIsImplementationExecution = isImplementationExecutionCard(card, targetThread);
      const targetIsLoopReadOnlyRoleExecution = isLoopReadOnlyRoleExecutionCard(card, targetThread);
      const targetMainSourceRole = targetMainSourceRuntimeRole(card, targetThread);
      const targetUsesFullAccess = targetIsDeployLane || targetIsWorkerLane || targetIsImplementationExecution || targetIsLoopReadOnlyRoleExecution;
      const baseRuntimeSettings = targetUsesFullAccess
        ? nonBlockingRuntimeSettings(inheritedRuntimeSettings, targetThread && targetThread.cwd || null)
        : inheritedRuntimeSettings;
      const requestedRuntimeSettings = requestedReasoningEffort
        ? Object.assign({}, baseRuntimeSettings, { reasoningEffort: requestedReasoningEffort })
        : baseRuntimeSettings;
      const runtimeSettings = targetMainSourceRole
        ? applyReasoningEffortFloor(requestedRuntimeSettings, "xhigh")
        : requestedRuntimeSettings;
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
          workerLaneFullAccess: targetIsWorkerLane,
          implementationFullAccess: targetIsImplementationExecution,
          loopReadOnlyRoleNoApproval: targetIsLoopReadOnlyRoleExecution,
          mainSourceReasoningFloor: targetMainSourceRole || "",
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
    targetLifecycleDeliverability: (thread, details, options) => {
      if (!atLoopRuntimeService || typeof atLoopRuntimeService.workerLifecycleDeliverability !== "function") {
        return { ok: true };
      }
      return atLoopRuntimeService.workerLifecycleDeliverability(thread, details, options);
    },
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
    const startParams = applyStartThreadRuntimeSettings(startParamsBase, inheritedRuntimeSettings || {}, {
      skipWorkspaceDelegationRuntimeGuidance: true,
    });
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
      pluginId: String(input.pluginId || input.plugin_id || "").trim(),
      workerPurpose: String(input.workerPurpose || input.worker_purpose || "").trim(),
    });
    if (typeof dependencies.rememberStartedThread === "function") {
      return dependencies.rememberStartedThread(thread) || thread;
    }
    return thread;
  }

  async function startSourceRequirementsTurn(input = {}) {
    const loop = input.loop && typeof input.loop === "object" ? input.loop : {};
    const sourceThread = input.sourceThread && typeof input.sourceThread === "object" ? input.sourceThread : {};
    const threadId = String(sourceThread.id || sourceThread.threadId || loop.sourceThreadId || "").trim();
    const prompt = String(input.prompt || "").trim();
    if (!threadId) throw new Error("at_loop_source_requirements_thread_required");
    if (!prompt) throw new Error("at_loop_source_requirements_prompt_required");
    if (!dependencies.codex || typeof dependencies.codex.request !== "function") {
      throw new Error("at_loop_source_requirements_turn_unavailable");
    }
    const inheritedRuntimeSettings = typeof dependencies.resolveThreadRuntimeSettings === "function"
      ? await dependencies.resolveThreadRuntimeSettings(threadId)
      : {};
    const cwd = String(sourceThread.cwd || sourceThread.workspace || sourceThread.targetWorkspace || "").trim();
    const runtimeSettings = applyReasoningEffortFloor(
      nonBlockingRuntimeSettings(inheritedRuntimeSettings, cwd || null),
      "xhigh",
    );
    try {
      await dependencies.codex.request("thread/resume", applyResumeRuntimeSettings({
        threadId,
        cwd: cwd || null,
        persistExtendedHistory: true,
      }, runtimeSettings), { timeoutMs: dependencies.mutationRpcTimeoutMs, retry: false });
    } catch (err) {
      if (!/already|loaded|active/i.test(err && err.message || "")) throw err;
    }
    const turnParams = applyTurnRuntimeSettings({
      threadId,
      input: [{ type: "text", text: prompt }],
    }, runtimeSettings);
    const result = await dependencies.codex.request("turn/start", turnParams, {
      timeoutMs: dependencies.mutationRpcTimeoutMs,
      retry: false,
    });
    const turnId = typeof dependencies.notifyLocalTurnStarted === "function"
      ? dependencies.notifyLocalTurnStarted(threadId, result, { source: "at-loop-source-requirements" })
      : String(result && (result.turnId || result.id || "") || "");
    return {
      threadId,
      turnId,
      result,
    };
  }

  atLoopRuntimeService = atLoopRuntimeServiceFactory({
    fs: dependencies.fs,
    path: dependencies.path,
    storageFile: dependencies.atLoopStateFile,
    createThreadTaskCardsFromSourceThread: threadTaskCardRouteService.createThreadTaskCardsFromSourceThread,
    createLoopRoleThread,
    startSourceRequirementsTurn,
    recordSourceRequirementsScriptPath: dependencies.recordAtLoopRequirementsScriptPath || (dependencies.appRoot
      ? `${String(dependencies.appRoot).replace(/\/+$/, "")}/scripts/record-at-loop-requirements.js`
      : "scripts/record-at-loop-requirements.js"),
    readThreadTaskCardTargetSummary: threadTaskCardRouteService.readThreadTaskCardTargetSummary,
    readThreadTaskCardVisibleTargetSummary: threadTaskCardRouteService.readThreadTaskCardVisibleTargetSummary,
    threadTaskCardVisibleTargetThreads: threadTaskCardRouteService.threadTaskCardVisibleTargetThreads,
    assertThreadTaskCardTargetDeliverable: threadTaskCardRouteService.assertThreadTaskCardTargetDeliverable,
    resolveThreadTaskCardTargetReference: threadTaskCardRouteService.resolveThreadTaskCardTargetReference,
    readThreadTaskCardForLoopEvidence: (cardId) => {
      if (!threadTaskCardService || typeof threadTaskCardService.get !== "function") return null;
      return threadTaskCardService.get(cardId, "");
    },
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
