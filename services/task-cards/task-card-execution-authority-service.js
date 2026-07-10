"use strict";

const path = require("node:path");

const AUTHORITY_VERSION = "task-card-execution-authority-v1";
const AUTHORITY_SOURCE = "trusted_autonomous_task_card";
const DEFAULT_AUTHORITY_TTL_MS = 30 * 60 * 1000;
const ALLOWED_SCOPE_CLASSES = [
  "workspace_read",
  "workspace_test",
  "workspace_build",
  "localhost_health_probe",
];
const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function stringValue(value) {
  return String(value || "").trim();
}

function boundedMetadataString(value, maxLength = 160) {
  const text = stringValue(value);
  if (!text) return "";
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeFsPath(value) {
  const text = stringValue(value);
  if (!text) return "";
  try {
    return path.resolve(text);
  } catch (_) {
    return "";
  }
}

function comparablePath(value) {
  return stringValue(value)
    .replace(/^\\\\\?\\/, "")
    .replace(/[\\/]+/g, path.sep)
    .replace(new RegExp(`${path.sep.replace("\\", "\\\\")}+$`), "")
    .toLowerCase();
}

function isPathInside(child, parent) {
  const childPath = comparablePath(normalizeFsPath(child));
  const parentPath = comparablePath(normalizeFsPath(parent));
  if (!childPath || !parentPath) return false;
  return childPath === parentPath || childPath.startsWith(`${parentPath}${path.sep}`);
}

function looksLikeFsPath(value) {
  const text = stringValue(value);
  return Boolean(text && (path.isAbsolute(text) || /^[A-Za-z]:[\\/]/.test(text) || /^~(?:[\\/]|$)/.test(text)));
}

function nowMs(now) {
  const value = typeof now === "function" ? now() : now;
  const millis = Number(value || Date.now());
  return Number.isFinite(millis) ? millis : Date.now();
}

function isoFromMs(value) {
  return new Date(Number.isFinite(value) ? value : Date.now()).toISOString();
}

function commandTextFromRequest(request = {}) {
  const method = stringValue(request && request.method);
  const params = request && request.params && typeof request.params === "object" ? request.params : {};
  if (method === "execCommandApproval" && Array.isArray(params.command)) return params.command.join(" ");
  if (typeof params.command === "string") return params.command;
  if (Array.isArray(params.commandActions) && params.commandActions.length) {
    return params.commandActions.map((action) => action && action.command).filter(Boolean).join(" && ");
  }
  return "";
}

function requestThreadId(request = {}) {
  const params = request && request.params && typeof request.params === "object" ? request.params : {};
  return stringValue(params.threadId || params.conversationId);
}

function requestTurnId(request = {}) {
  const params = request && request.params && typeof request.params === "object" ? request.params : {};
  return stringValue(params.turnId || params.turn_id);
}

function requestCwd(request = {}) {
  const params = request && request.params && typeof request.params === "object" ? request.params : {};
  return stringValue(params.cwd || params.workingDirectory || params.workdir);
}

function unique(values) {
  return Array.from(new Set((values || []).map(stringValue).filter(Boolean)));
}

function authorityTurnIds(authority = {}) {
  return unique([
    authority.turnId,
    authority.injectedTurnId,
    ...safeArray(authority.turnIds),
  ]);
}

function authorityExpired(authority = {}, now = Date.now()) {
  const expiresAtMs = Date.parse(stringValue(authority.expiresAt));
  if (!expiresAtMs) return true;
  return expiresAtMs <= nowMs(now);
}

function isTrustedAutonomousExecutionCard(card = {}) {
  const workflow = card && card.workflow && typeof card.workflow === "object" ? card.workflow : {};
  const delivery = card && card.delivery && typeof card.delivery === "object" ? card.delivery : {};
  return workflow.mode === "autonomous"
    && stringValue(workflow.id)
    && (workflow.authorized === true || delivery.targetApprovalBypassed === true || delivery.approvalMode === "source_thread_direct");
}

function createExecutionAuthorityForCard(card = {}, execution = {}, options = {}) {
  if (options.trustedAutonomous !== true && !isTrustedAutonomousExecutionCard(card)) return null;
  const threadId = stringValue(execution.threadId || card.target && card.target.threadId);
  const turnId = stringValue(execution.turnId || card.injectedTurnId);
  if (!threadId || !turnId) return null;
  const startMs = nowMs(options.now);
  const ttlMs = Math.max(60_000, Math.trunc(Number(options.ttlMs || DEFAULT_AUTHORITY_TTL_MS)) || DEFAULT_AUTHORITY_TTL_MS);
  return {
    version: AUTHORITY_VERSION,
    configured: true,
    source: boundedMetadataString(options.source || AUTHORITY_SOURCE, 80),
    taskCardId: boundedMetadataString(card.id || card.taskCardId, 180),
    workflowId: boundedMetadataString(options.workflowId || card.workflow && card.workflow.id, 220),
    sourceThreadId: boundedMetadataString(card.source && card.source.threadId, 220),
    sourceWorkspaceId: boundedMetadataString(card.source && card.source.workspaceId, 260),
    targetThreadId: boundedMetadataString(threadId, 220),
    targetWorkspaceId: boundedMetadataString(options.targetWorkspaceId || card.target && card.target.workspaceId, 260),
    targetRole: boundedMetadataString(card.target && card.target.role, 80),
    routeKind: boundedMetadataString(card.workflow && card.workflow.routeKind || card.routeResolution && card.routeResolution.routeKind, 80),
    workspaceRoot: boundedMetadataString(options.workspaceRoot || card.target && card.target.workspaceId, 500),
    turnId: boundedMetadataString(turnId, 220),
    turnIds: [boundedMetadataString(turnId, 220)],
    scope: {
      classes: ALLOWED_SCOPE_CLASSES.slice(),
      network: ["localhost"],
    },
    generation: boundedMetadataString(`${card.id}:${turnId}:${AUTHORITY_VERSION}`, 500),
    createdAt: isoFromMs(startMs),
    expiresAt: isoFromMs(startMs + ttlMs),
    approvalResolution: {
      status: "configured",
      issueCodes: [],
    },
  };
}

function summarizeExecutionAuthority(authority = {}, now = Date.now()) {
  if (!authority || typeof authority !== "object") return null;
  const scope = authority.scope && typeof authority.scope === "object" ? authority.scope : {};
  const resolution = authority.approvalResolution && typeof authority.approvalResolution === "object"
    ? authority.approvalResolution
    : {};
  const out = {
    configured: authority.configured === true,
    source: boundedMetadataString(authority.source, 80),
    version: boundedMetadataString(authority.version, 80),
    taskCardId: boundedMetadataString(authority.taskCardId, 180),
    workflowId: boundedMetadataString(authority.workflowId, 220),
    targetThreadId: boundedMetadataString(authority.targetThreadId, 220),
    targetWorkspaceId: boundedMetadataString(authority.targetWorkspaceId, 260),
    scopeClasses: safeArray(scope.classes).map((entry) => boundedMetadataString(entry, 80)).filter(Boolean).slice(0, 12),
    networkScope: safeArray(scope.network).map((entry) => boundedMetadataString(entry, 80)).filter(Boolean).slice(0, 12),
    expiresAtPresent: Boolean(stringValue(authority.expiresAt)),
    expired: authorityExpired(authority, now) === true,
    approvalResolution: {
      status: boundedMetadataString(resolution.status || "configured", 80),
      issueCodes: safeArray(resolution.issueCodes).map((entry) => boundedMetadataString(entry, 120)).filter(Boolean).slice(0, 12),
    },
  };
  for (const key of Object.keys(out)) {
    if (out[key] == null || out[key] === "" || out[key] === false) delete out[key];
  }
  if (!out.approvalResolution.issueCodes.length) delete out.approvalResolution.issueCodes;
  return out;
}

function commandHasUnsafeShellControl(command) {
  const text = stringValue(command);
  if (!text) return false;
  if (/[`]|[$][(]/.test(text)) return true;
  if (/(?:^|[^>])(?:&&|\|\||;|\|)/.test(text)) return true;
  if (/(?:^|[\s])>>?\s*(?!\/dev\/null\b)/.test(text)) return true;
  return false;
}

function commandReferencesSecretPath(command) {
  return /\b(?:access[_-]?key|owner[_-]?key|scoped[_-]?credential|credential|secret|token|cookie|launch[_-]?token|id_rsa|id_ed25519|\.pem|\.p12|\.pfx|\.env|keychain|\.ssh)\b/i
    .test(stringValue(command));
}

function commandLooksPrivileged(command) {
  return /(?:^|[\s;&|])(?:sudo|su|doas)\b/i.test(stringValue(command));
}

function commandLooksDestructive(command) {
  return new RegExp([
    "(?:^|[\\s;&|])(?:rm|mv|cp|rsync|truncate|chmod|chown|kill|pkill|launchctl)\\b",
    "(?:^|[\\s;&|])git\\s+(?:add|commit|checkout|reset|clean|rm|mv|restore|switch|rebase|merge|cherry-pick|stash|push|pull)\\b",
    "\\bapply_patch\\b",
    "\\bsed\\s+-[^\\n;&|]*i",
    "\\bperl\\s+-[^\\n;&|]*i",
    "\\b(?:npm|pnpm|yarn)\\s+(?:install|i|ci|update|dedupe|add|remove|upgrade)\\b",
    "\\b(?:pip|pip3)\\s+install\\b",
  ].join("|"), "i").test(stringValue(command));
}

function urlsInCommand(command) {
  const text = stringValue(command);
  const matches = text.match(/\bhttps?:\/\/[^\s"'<>)]*/gi) || [];
  return matches.map((entry) => {
    try {
      return new URL(entry);
    } catch (_) {
      return null;
    }
  }).filter(Boolean);
}

function hasExternalNetwork(command) {
  return urlsInCommand(command).some((url) => !LOCALHOST_HOSTS.has(url.hostname.toLowerCase()));
}

function looksLikeLocalhostHealthProbe(command) {
  const urls = urlsInCommand(command);
  if (!urls.length) return false;
  if (!urls.every((url) => LOCALHOST_HOSTS.has(url.hostname.toLowerCase()))) return false;
  if (!urls.some((url) => /\/(?:api\/)?(?:readyz|healthz|status)\b/i.test(url.pathname))) return false;
  if (!/^\s*(?:env\s+[\w.-]+=[^\s]+\s+)*(?:\/usr\/bin\/)?(?:curl|wget)\b/i.test(command)) return false;
  if (/\s-X\s*(?:POST|PUT|PATCH|DELETE)\b/i.test(command)) return false;
  return true;
}

function looksLikeWorkspaceRead(command) {
  return /^(?:env\s+[\w.-]+=[^\s]+\s+)*(?:pwd|ls\b|find\b|rg\b|grep\b|sed\s+-n\b|cat\b|wc\b|git\s+(?:status|diff\s+--check|diff\b|show\b|rev-parse\b|log\b|ls-files\b|branch\b|status\b))/i
    .test(stringValue(command));
}

function looksLikeWorkspaceBuild(command) {
  const text = stringValue(command);
  return /^(?:env\s+[\w.-]+=[^\s]+\s+)*(?:npm|npm\.cmd|pnpm|yarn)\s+(?:(?:run|exec)\s+)?(?:--silent\s+)?(?:build|lint|typecheck|verify)(?:\b|:)/i.test(text);
}

function looksLikeWorkspaceTest(command) {
  const text = stringValue(command);
  return /^(?:env\s+[\w.-]+=[^\s]+\s+)*(?:npm|npm\.cmd|pnpm|yarn)\s+(?:(?:run|exec)\s+)?(?:--silent\s+)?(?:test|check)(?:\b|:)/i.test(text)
    || /^(?:env\s+[\w.-]+=[^\s]+\s+)*node\s+--(?:test|check)\b/i.test(text)
    || /^(?:env\s+[\w.-]+=[^\s]+\s+)*node\s+(?:test\/|scripts\/)[^;&|]*\b(?:test|check|harness|self-check)\b/i.test(text);
}

function authorityMatchesRequest(authority = {}, request = {}) {
  const threadId = requestThreadId(request);
  const turnId = requestTurnId(request);
  if (!threadId || threadId !== stringValue(authority.targetThreadId)) return false;
  const turns = authorityTurnIds(authority);
  if (!turnId || !turns.includes(turnId)) return false;
  return true;
}

function classifyAuthorityCommand(authority = {}, request = {}, options = {}) {
  const command = commandTextFromRequest(request);
  const cwd = requestCwd(request);
  const workspaceRoot = stringValue(authority.workspaceRoot || authority.targetWorkspaceId);
  if (!command) return { action: "deny", reason: "command_missing", issueCode: "task_card_authority_command_missing" };
  if (authorityExpired(authority, options.now)) {
    return { action: "deny", reason: "authority_expired", issueCode: "task_card_authority_expired" };
  }
  if (looksLikeFsPath(workspaceRoot) && cwd && !isPathInside(cwd, workspaceRoot)) {
    return { action: "deny", reason: "cwd_outside_authority_workspace", issueCode: "task_card_authority_cwd_outside_workspace" };
  }
  if (commandLooksPrivileged(command)) return { action: "deny", reason: "privileged_command", issueCode: "task_card_authority_privileged_command" };
  if (commandReferencesSecretPath(command)) return { action: "deny", reason: "secret_path_reference", issueCode: "task_card_authority_secret_path_reference" };
  if (hasExternalNetwork(command)) return { action: "deny", reason: "external_network_not_in_scope", issueCode: "task_card_authority_external_network_not_allowed" };
  if (commandHasUnsafeShellControl(command)) return { action: "deny", reason: "unsafe_shell_control", issueCode: "task_card_authority_unsafe_shell_control" };
  if (commandLooksDestructive(command)) return { action: "deny", reason: "destructive_command", issueCode: "task_card_authority_destructive_command" };
  if (looksLikeLocalhostHealthProbe(command)) return { action: "allow", reason: "localhost_health_probe", scopeClass: "localhost_health_probe" };
  if (looksLikeWorkspaceBuild(command)) return { action: "allow", reason: "workspace_build", scopeClass: "workspace_build" };
  if (looksLikeWorkspaceTest(command)) return { action: "allow", reason: "workspace_test", scopeClass: "workspace_test" };
  if (looksLikeWorkspaceRead(command)) return { action: "allow", reason: "workspace_read", scopeClass: "workspace_read" };
  return { action: "deny", reason: "command_class_not_in_authority_scope", issueCode: "task_card_authority_command_scope_denied" };
}

function authorityDecisionForServerRequest(authority = {}, request = {}, options = {}) {
  if (!authority || authority.configured !== true) return null;
  if (!authorityMatchesRequest(authority, request)) return null;
  const method = stringValue(request && request.method);
  if (method !== "item/commandExecution/requestApproval" && method !== "execCommandApproval") {
    return {
      action: "deny",
      responseDecision: "deny",
      reason: "approval_method_not_in_authority_scope",
      issueCode: "task_card_authority_method_denied",
      authority,
    };
  }
  const commandDecision = classifyAuthorityCommand(authority, request, options);
  return Object.assign({}, commandDecision, {
    responseDecision: commandDecision.action === "allow" ? "allow_once" : "deny",
    authority,
  });
}

function executionAuthoritiesForCards(cards = []) {
  return safeArray(cards)
    .map((card) => card && card.executionAuthority)
    .filter((authority) => authority && authority.configured === true);
}

function executionAuthoritiesForStore(store = {}) {
  return [
    ...executionAuthoritiesForCards(store.cards),
    ...safeArray(store.executionAuthorities),
  ].filter((authority) => authority && authority.configured === true);
}

function authorityDecisionForStore(store = {}, request = {}, options = {}) {
  for (const authority of executionAuthoritiesForStore(store)) {
    const decision = authorityDecisionForServerRequest(authority, request, options);
    if (decision) return decision;
  }
  return null;
}

function authorityLogPayload(request = {}, decision = {}) {
  const authority = decision.authority || {};
  return {
    requestId: boundedMetadataString(request && request.id, 80),
    method: boundedMetadataString(request && request.method, 80),
    action: boundedMetadataString(decision.action, 40),
    responseDecision: boundedMetadataString(decision.responseDecision, 40),
    reason: boundedMetadataString(decision.reason, 120),
    issueCode: boundedMetadataString(decision.issueCode, 120),
    taskCardId: boundedMetadataString(authority.taskCardId, 80),
    workflowId: boundedMetadataString(authority.workflowId, 120),
    threadId: boundedMetadataString(requestThreadId(request), 80),
    turnId: boundedMetadataString(requestTurnId(request), 80),
    scopeClass: boundedMetadataString(decision.scopeClass, 80),
  };
}

module.exports = {
  ALLOWED_SCOPE_CLASSES,
  AUTHORITY_SOURCE,
  AUTHORITY_VERSION,
  authorityExpired,
  classifyAuthorityCommand,
  authorityDecisionForServerRequest,
  authorityDecisionForStore,
  authorityLogPayload,
  createExecutionAuthorityForCard,
  summarizeExecutionAuthority,
};
