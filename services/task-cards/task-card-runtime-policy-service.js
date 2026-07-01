"use strict";

const fsDefault = require("node:fs");
const pathDefault = require("node:path");

const {
  createWorkspaceSourceWriteGuard,
} = require("../../adapters/workspace-source-write-guard-service");

function createTaskCardRuntimePolicyService(options = {}) {
  const fs = options.fs || fsDefault;
  const path = options.path || pathDefault;
  const platform = options.platform || process.platform;
  const actionableApprovalMethods = options.actionableApprovalMethods instanceof Set
    ? options.actionableApprovalMethods
    : new Set(options.actionableApprovalMethods || []);
  const latestThreadIdByTurnId = options.latestThreadIdByTurnId instanceof Map
    ? options.latestThreadIdByTurnId
    : new Map();
  const recentStartedThreads = options.recentStartedThreads instanceof Map
    ? options.recentStartedThreads
    : new Map();

  let workspaceSourceWriteGuardRootsCache = { roots: [], cachedAt: 0 };

  const normalizeFsPath = typeof options.normalizeFsPath === "function"
    ? options.normalizeFsPath
    : (value) => String(value || "").toLowerCase();
  const workspaceDelegationPublicSettings = typeof options.workspaceDelegationPublicSettings === "function"
    ? options.workspaceDelegationPublicSettings
    : () => ({ enabled: false });
  const workspaceWriteSandboxPolicy = typeof options.workspaceWriteSandboxPolicy === "function"
    ? options.workspaceWriteSandboxPolicy
    : (cwd, inheritedPolicy) => Object.assign({ type: "workspaceWrite", writableRoots: cwd ? [cwd] : [] }, inheritedPolicy || {});
  const normalizeSandboxPolicyType = typeof options.normalizeSandboxPolicyType === "function"
    ? options.normalizeSandboxPolicyType
    : (value) => String(value || "");
  const workspaceDelegationWriteGuardPermissionProfile = typeof options.workspaceDelegationWriteGuardPermissionProfile === "function"
    ? options.workspaceDelegationWriteGuardPermissionProfile
    : () => "";
  const attachWorkspaceDelegationRuntimeGuidance = typeof options.attachWorkspaceDelegationRuntimeGuidance === "function"
    ? options.attachWorkspaceDelegationRuntimeGuidance
    : () => {};
  const readStateDbThread = typeof options.readStateDbThread === "function" ? options.readStateDbThread : () => null;
  const readStartedThread = typeof options.readStartedThread === "function" ? options.readStartedThread : () => null;
  const readRolloutSessionFallbackThread = typeof options.readRolloutSessionFallbackThread === "function"
    ? options.readRolloutSessionFallbackThread
    : () => null;
  const visibleWorkspaceRoots = typeof options.visibleWorkspaceRoots === "function" ? options.visibleWorkspaceRoots : () => new Set();
  const readGlobalState = typeof options.readGlobalState === "function" ? options.readGlobalState : () => ({});
  const readThreadListFallback = typeof options.readThreadListFallback === "function" ? options.readThreadListFallback : () => [];
  const pushThreadId = typeof options.pushThreadId === "function" ? options.pushThreadId : () => "";
  const shortIdentifier = typeof options.shortIdentifier === "function" ? options.shortIdentifier : (value) => String(value || "").slice(0, 12);
  const compactOneLine = typeof options.compactOneLine === "function" ? options.compactOneLine : (value) => String(value || "");

  function workspaceDelegationWriteGuardSandboxPolicy(cwd, inheritedPolicy) {
    const policy = workspaceWriteSandboxPolicy(cwd, inheritedPolicy);
    const writableRoots = Array.isArray(policy.writableRoots) ? policy.writableRoots.slice() : [];
    for (const root of Array.isArray(policy.writableRoots) ? policy.writableRoots : []) {
      if (path.basename(root) === ".git") continue;
      const gitRoot = path.join(root, ".git");
      if (!writableRoots.includes(gitRoot)) writableRoots.push(gitRoot);
    }
    policy.writableRoots = writableRoots;
    const inheritedType = normalizeSandboxPolicyType(inheritedPolicy && inheritedPolicy.type);
    if (inheritedType === "dangerFullAccess") {
      policy.networkAccess = true;
    }
    return policy;
  }

  function workspaceDelegationGuardPathCandidates(cwd) {
    const raw = String(cwd || "").trim();
    if (!raw) return [];
    const candidates = [raw];
    try {
      const real = fs.realpathSync.native ? fs.realpathSync.native(raw) : fs.realpathSync(raw);
      if (real && real !== raw) candidates.push(real);
    } catch (_) {
      // Keep the raw cwd candidate when the path is not currently readable.
    }
    return candidates;
  }

  function workspaceDelegationGuardNormalizedPathSet(cwd) {
    return new Set(workspaceDelegationGuardPathCandidates(cwd).map((entry) => normalizeFsPath(entry)).filter(Boolean));
  }

  function workspaceDelegationGuardExemptCwds() {
    const separator = platform === "win32" ? /[;\n\r]+/ : /[:;\n\r]+/;
    return new Set(String(options.workspaceDelegationGuardExemptCwds || "")
      .split(separator)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .flatMap((entry) => Array.from(workspaceDelegationGuardNormalizedPathSet(entry))));
  }

  function workspaceDelegationGuardHasFile(cwd, ...parts) {
    try {
      return fs.existsSync(path.join(cwd, ...parts));
    } catch (_) {
      return false;
    }
  }

  function workspaceDelegationGuardPackageName(cwd) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
      return String(pkg && pkg.name || "").trim();
    } catch (_) {
      return "";
    }
  }

  function isCodexMobileMaintenanceCwd(cwd) {
    if (options.workspaceDelegationGuardSelfExemptionDisabled) return false;
    return workspaceDelegationGuardPackageName(cwd) === "codex-mobile-web"
      && workspaceDelegationGuardHasFile(cwd, "server.js");
  }

  function isHomeAiControlPlaneCwd(cwd) {
    if (options.workspaceDelegationGuardPlatformExemptionDisabled) return false;
    return workspaceDelegationGuardHasFile(cwd, "scripts", "ai-ops-control-plane.js")
      && workspaceDelegationGuardHasFile(cwd, "scripts", "deploy-macos-production.js")
      && workspaceDelegationGuardHasFile(cwd, "docs", "PLATFORM_CONTRACTS", "plugin-workspace-platform-contract.md");
  }

  function workspaceDelegationGuardExemptCwd(cwd) {
    const normalizedCandidates = workspaceDelegationGuardNormalizedPathSet(cwd);
    if (!normalizedCandidates.size) return false;
    const explicitExemptCwds = workspaceDelegationGuardExemptCwds();
    for (const candidate of normalizedCandidates) {
      if (explicitExemptCwds.has(candidate)) return true;
    }
    return isCodexMobileMaintenanceCwd(cwd) || isHomeAiControlPlaneCwd(cwd);
  }

  function threadForRuntimeThreadId(threadId) {
    const id = String(threadId || "").trim();
    if (!id) return null;
    return readStateDbThread(id) || readStartedThread(id) || readRolloutSessionFallbackThread(id) || null;
  }

  function runtimeCwdForParams(params) {
    const explicitCwd = String(params && params.cwd || "").trim();
    if (explicitCwd) return explicitCwd;
    const threadId = String(params && params.threadId || "").trim();
    const thread = threadForRuntimeThreadId(threadId);
    return String(thread && thread.cwd || "").trim();
  }

  function workspaceSourceWriteGuardWorkspaceRoots() {
    const now = Date.now();
    if (now - Number(workspaceSourceWriteGuardRootsCache.cachedAt || 0) < 10_000) {
      return workspaceSourceWriteGuardRootsCache.roots.slice();
    }
    const roots = new Set([...visibleWorkspaceRoots(readGlobalState())]);
    try {
      for (const thread of readThreadListFallback(300, { archived: false }) || []) {
        if (thread && thread.cwd) roots.add(thread.cwd);
      }
    } catch (_) {}
    for (const entry of recentStartedThreads.values()) {
      if (entry && entry.thread && entry.thread.cwd) roots.add(entry.thread.cwd);
    }
    workspaceSourceWriteGuardRootsCache = {
      roots: [...roots].filter(Boolean),
      cachedAt: now,
    };
    return workspaceSourceWriteGuardRootsCache.roots.slice();
  }

  function threadCwdForRuntimeThreadId(threadId) {
    const thread = threadForRuntimeThreadId(threadId);
    return String(thread && thread.cwd || "").trim();
  }

  function workspaceSourceWriteGuardThreadCwdForRequest(request) {
    const params = request && request.params && typeof request.params === "object" ? request.params : {};
    const threadId = pushThreadId(params)
      || String(params.threadId || params.conversationId || params.sessionId || params.thread_id || params.conversation_id || params.session_id || "").trim();
    const threadCwd = threadCwdForRuntimeThreadId(threadId);
    if (threadCwd) return threadCwd;
    const turnId = String(params.turnId || params.turn_id || params.itemTurnId || params.item_turn_id
      || params.item && (params.item.turnId || params.item.turn_id)
      || "").trim();
    const inferredThreadId = turnId ? latestThreadIdByTurnId.get(turnId) : "";
    return threadCwdForRuntimeThreadId(inferredThreadId);
  }

  function workspaceSourceWriteGuardCwdForRequest(request) {
    const threadCwd = workspaceSourceWriteGuardThreadCwdForRequest(request);
    if (threadCwd) return threadCwd;
    const params = request && request.params && typeof request.params === "object" ? request.params : {};
    return String(params.cwd || "").trim();
  }

  const workspaceSourceWriteGuardService = createWorkspaceSourceWriteGuard({
    currentCwdForRequest: workspaceSourceWriteGuardCwdForRequest,
    workspaceRoots: workspaceSourceWriteGuardWorkspaceRoots,
  });

  function workspaceSourceWriteGuardDecisionForRequest(request) {
    if (!workspaceDelegationPublicSettings().enabled) return null;
    if (options.workspaceDelegationWriteGuardDisabled) return null;
    if (!request || !actionableApprovalMethods.has(request.method)) return null;
    const sourceCwd = workspaceSourceWriteGuardThreadCwdForRequest(request);
    const cwd = sourceCwd || workspaceSourceWriteGuardCwdForRequest(request);
    if (cwd && workspaceDelegationGuardExemptCwd(cwd)) return null;
    return workspaceSourceWriteGuardService.classify(request);
  }

  function workspaceSourceWriteGuardLogPayload(request, decision, responseDecision) {
    return {
      requestId: shortIdentifier(request && request.id),
      method: request && request.method || "",
      action: decision && decision.action || "",
      responseDecision,
      reason: decision && decision.reason || "",
      threadId: shortIdentifier(pushThreadId(request && request.params || {})),
      turnId: shortIdentifier(request && request.params && (request.params.turnId || request.params.turn_id) || ""),
      cwd: compactOneLine(workspaceSourceWriteGuardCwdForRequest(request), 160),
      matchedRoot: compactOneLine(decision && decision.matchedRoot || "", 160),
    };
  }

  function applyWorkspaceDelegationFullAccessCompatRuntime(params, applyOptions = {}) {
    if (!params || typeof params !== "object") return params;
    params.approvalPolicy = "on-request";
    if (applyOptions.useSandboxPolicy) {
      params.sandboxPolicy = { type: "dangerFullAccess" };
      delete params.permissionProfile;
      delete params.sandbox;
    } else {
      params.sandbox = "danger-full-access";
      delete params.permissionProfile;
      delete params.sandboxPolicy;
    }
    return params;
  }

  function applyWorkspaceDelegationRuntimeGuard(params, settings, applyOptions = {}) {
    if (!params || typeof params !== "object") return params;
    if (!workspaceDelegationPublicSettings().enabled) return params;
    if (options.workspaceDelegationWriteGuardDisabled) return params;
    const cwd = runtimeCwdForParams(params);
    if (!cwd) return params;
    params.cwd = cwd;
    if (workspaceDelegationGuardExemptCwd(cwd)) return params;
    if (options.workspaceDelegationApprovalProxyOnly && !options.workspaceDelegationEnforceSandboxGuard) {
      return applyWorkspaceDelegationFullAccessCompatRuntime(params, applyOptions);
    }
    params.approvalPolicy = "on-request";
    if (applyOptions.useSandboxPolicy) {
      params.sandboxPolicy = workspaceDelegationWriteGuardSandboxPolicy(cwd, settings && settings.sandboxPolicy);
      params.permissionProfile = workspaceDelegationWriteGuardPermissionProfile(cwd, settings && settings.sandboxPolicy);
      delete params.sandbox;
    } else {
      params.sandbox = "workspace-write";
      params.permissionProfile = workspaceDelegationWriteGuardPermissionProfile(cwd, settings && settings.sandboxPolicy);
      delete params.sandboxPolicy;
    }
    return params;
  }

  function applyResumeRuntimeSettings(params, settings) {
    if (settings) {
      if (settings.approvalPolicy) params.approvalPolicy = settings.approvalPolicy;
      if (settings.permissionProfile) params.permissionProfile = settings.permissionProfile;
      else if (settings.sandboxMode) params.sandbox = settings.sandboxMode;
      if (settings.model) params.model = settings.model;
      const config = {};
      if (settings.reasoningSummary) config.model_reasoning_summary = settings.reasoningSummary;
      if (settings.modelVerbosity) config.model_verbosity = settings.modelVerbosity;
      if (Object.keys(config).length) params.config = Object.assign({}, params.config || {}, config);
    }
    return applyWorkspaceDelegationRuntimeGuard(params, settings, { useSandboxPolicy: false });
  }

  function applyStartThreadRuntimeSettings(params, settings) {
    attachWorkspaceDelegationRuntimeGuidance(params);
    if (settings) {
      if (settings.approvalPolicy) params.approvalPolicy = settings.approvalPolicy;
      if (settings.permissionProfile) params.permissionProfile = settings.permissionProfile;
      else if (settings.sandboxMode) params.sandbox = settings.sandboxMode;
      if (settings.model) params.model = settings.model;
      const config = {};
      if (settings.reasoningSummary) config.model_reasoning_summary = settings.reasoningSummary;
      if (settings.modelVerbosity) config.model_verbosity = settings.modelVerbosity;
      if (Object.keys(config).length) params.config = Object.assign({}, params.config || {}, config);
    }
    return applyWorkspaceDelegationRuntimeGuard(params, settings, { useSandboxPolicy: false });
  }

  function applyTurnRuntimeSettings(params, settings) {
    attachWorkspaceDelegationRuntimeGuidance(params);
    if (settings) {
      if (settings.approvalPolicy) params.approvalPolicy = settings.approvalPolicy;
      if (settings.sandboxPolicy) params.sandboxPolicy = settings.sandboxPolicy;
      else if (settings.permissionProfile) params.permissionProfile = settings.permissionProfile;
      if (settings.model) params.model = settings.model;
      if (settings.reasoningEffort) params.effort = settings.reasoningEffort;
      if (settings.reasoningSummary) params.summary = settings.reasoningSummary;
    }
    return applyWorkspaceDelegationRuntimeGuard(params, settings, { useSandboxPolicy: true });
  }

  function requestedCodexFastMode(value) {
    return /^(1|true|on|yes|fast|priority)$/i.test(String(value || "").trim());
  }

  function applyCodexFastServiceTier(params, enabled) {
    if (enabled) params.serviceTier = "priority";
    return params;
  }

  return {
    applyCodexFastServiceTier,
    applyResumeRuntimeSettings,
    applyStartThreadRuntimeSettings,
    applyTurnRuntimeSettings,
    applyWorkspaceDelegationFullAccessCompatRuntime,
    applyWorkspaceDelegationRuntimeGuard,
    isCodexMobileMaintenanceCwd,
    isHomeAiControlPlaneCwd,
    requestedCodexFastMode,
    runtimeCwdForParams,
    threadCwdForRuntimeThreadId,
    workspaceDelegationGuardExemptCwd,
    workspaceDelegationGuardExemptCwds,
    workspaceDelegationGuardHasFile,
    workspaceDelegationGuardPackageName,
    workspaceDelegationGuardPathCandidates,
    workspaceDelegationWriteGuardSandboxPolicy,
    workspaceSourceWriteGuardCwdForRequest,
    workspaceSourceWriteGuardDecisionForRequest,
    workspaceSourceWriteGuardLogPayload,
    workspaceSourceWriteGuardThreadCwdForRequest,
    workspaceSourceWriteGuardWorkspaceRoots,
  };
}

module.exports = {
  createTaskCardRuntimePolicyService,
};
