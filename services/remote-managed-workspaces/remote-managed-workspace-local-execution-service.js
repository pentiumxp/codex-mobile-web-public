"use strict";

const defaultFs = require("node:fs");
const defaultPath = require("node:path");

const {
  validateProjectRoot,
} = require("./remote-managed-workspace-node-client-service");
const {
  applyReasoningEffortFloor,
} = require("../task-cards/task-card-runtime-policy-service");
const {
  ALLOWED_SCOPE_CLASSES,
  classifyAuthorityCommand,
  createExecutionAuthorityForCard,
  summarizeExecutionAuthority,
} = require("../task-cards/task-card-execution-authority-service");

const MAX_TITLE_CHARS = 120;
const MAX_SUMMARY_CHARS = 300;
const MAX_BODY_CHARS = 8_000;
const MAX_RETURN_BODY_CHARS = 1_200;
const MAX_REQUIRED_COMMAND_COUNT = 20;
const DEFAULT_COMPLETION_POLL_INTERVAL_MS = 5_000;
const DEFAULT_COMPLETION_TIMEOUT_MS = 30 * 60 * 1000;
const REQUIRED_COMMAND_MISSING_CODE = "remote_managed_workspace_required_command_execution_missing";
const REQUIRED_COMMAND_CLASS_MISSING_CODE = "remote_managed_workspace_required_command_class_missing";
const COMMAND_TOOL_UNAVAILABLE_CODE = "remote_managed_workspace_command_tool_unavailable";
const COMMAND_TOOL_SURFACE_UNAVAILABLE_CODE = "remote_managed_workspace_command_tool_surface_unavailable";
const LOCAL_EXECUTION_CONTRACT_VERSION = "remote-managed-workspace-local-execution-v1";

function compactOneLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function boundedVisibleText(value, maxLength) {
  const text = String(value || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  const suffix = "\n\n...(truncated)";
  return `${text.slice(0, Math.max(0, maxLength - suffix.length)).trimEnd()}${suffix}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms || 0))));
}

function errorWithStatus(code, statusCode = 500) {
  const err = new Error(code);
  err.code = code;
  err.statusCode = statusCode;
  return err;
}

function turnListFromResult(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result && result.data)) return result.data;
  if (Array.isArray(result && result.turns)) return result.turns;
  return [];
}

function turnIdentifier(turn = {}) {
  return compactOneLine(turn.id || turn.turnId || turn.turn_id);
}

function statusText(value) {
  if (!value) return "";
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "object") {
    return compactOneLine(value.type || value.status || value.state || "").toLowerCase();
  }
  return compactOneLine(value).toLowerCase();
}

function isCompletedStatus(value) {
  return /^(completed|complete|succeeded|success|failed|failure|error|cancelled|canceled|interrupted|stopped)$/i
    .test(statusText(value));
}

function isFailureStatus(value) {
  return /^(failed|failure|error|cancelled|canceled|interrupted|stopped)$/i.test(statusText(value));
}

function isCompletedTurn(turn = {}) {
  return Boolean(turn && typeof turn === "object" && (
    isCompletedStatus(turn.status || turn.state)
      || turn.completedAt
      || turn.completedAtMs
      || turn.completed_at
      || turn.completed_at_ms
      || turn.finishedAt
      || turn.finishedAtMs
      || turn.durationMs
      || turn.duration_ms
  ));
}

function terminalStatusForTurn(turn = {}) {
  if (isFailureStatus(turn.status || turn.state)) return "blocked";
  return "completed";
}

function normalizedCardId(card = {}) {
  return compactOneLine(card.taskCardId || card.id).slice(0, 180);
}

function booleanFromValue(value) {
  if (value === true) return true;
  if (value === false || value == null) return false;
  return /^(1|true|yes)$/i.test(compactOneLine(value));
}

function positiveBoundedInteger(value, fallback = 0) {
  const numeric = Math.trunc(Number(value));
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.min(MAX_REQUIRED_COMMAND_COUNT, numeric));
}

function normalizeExecutionRequirements(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const raw = source.executionRequirements && typeof source.executionRequirements === "object" && !Array.isArray(source.executionRequirements)
    ? source.executionRequirements
    : {};
  const requiresCommandExecution = booleanFromValue(raw.requiresCommandExecution);
  const minimumCompletedCommandCount = requiresCommandExecution
    ? positiveBoundedInteger(raw.minimumCompletedCommandCount, 1)
    : 0;
  const allowlist = new Set(ALLOWED_SCOPE_CLASSES);
  const requiredCommandClasses = Array.isArray(raw.requiredCommandClasses)
    ? raw.requiredCommandClasses
        .map((entry) => compactOneLine(entry).toLowerCase())
        .filter((entry) => allowlist.has(entry))
        .slice(0, 8)
    : [];
  const uniqueClasses = Array.from(new Set(requiredCommandClasses));
  const toolSurfaceRequired = requiresCommandExecution
    ? (Object.prototype.hasOwnProperty.call(raw, "toolSurfaceRequired") ? booleanFromValue(raw.toolSurfaceRequired) : true)
    : false;
  if (!requiresCommandExecution && !toolSurfaceRequired && uniqueClasses.length === 0) return null;
  return {
    requiresCommandExecution,
    minimumCompletedCommandCount,
    requiredCommandClasses: uniqueClasses,
    toolSurfaceRequired,
  };
}

function normalizeToolSurfaceAvailability(value = {}, requirements = null) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const required = Boolean(requirements && requirements.toolSurfaceRequired);
  const available = required
    ? source.available !== false && source.commandExecutionToolAvailable !== false
    : true;
  const status = required
    ? available ? "available" : "unavailable"
    : "not_required";
  const issueCode = available
    ? ""
    : compactOneLine(source.issueCode || COMMAND_TOOL_SURFACE_UNAVAILABLE_CODE)
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "_")
        .slice(0, 120);
  const out = {
    required,
    available,
    status: compactOneLine(source.status || status).slice(0, 80),
    source: compactOneLine(source.source || (required ? "local_execution_authority_bridge" : "not_required")).slice(0, 120),
    commandExecutionToolAvailable: available,
    authorityBridgeAvailable: source.authorityBridgeAvailable !== false,
    issueCode,
    checkedAt: compactOneLine(source.checkedAt).slice(0, 80),
  };
  if (!out.issueCode) delete out.issueCode;
  if (!out.checkedAt) delete out.checkedAt;
  return out;
}

function cardText(card = {}) {
  const message = card.message && typeof card.message === "object" ? card.message : {};
  return {
    id: normalizedCardId(card),
    title: boundedVisibleText(card.title || message.title || "Remote Managed Workspace task", MAX_TITLE_CHARS),
    summary: boundedVisibleText(card.summary || message.summary || "", MAX_SUMMARY_CHARS),
    body: boundedVisibleText(
      card.bodyMarkdown
        || card.body
        || card.bodyText
        || card.markdown
        || message.body
        || "",
      MAX_BODY_CHARS,
    ),
    reasoningEffort: compactOneLine(card.reasoningEffort || card.requestedReasoningEffort || card.delivery && card.delivery.reasoningEffort),
    idempotencyKey: compactOneLine(card.idempotencyKey || card.id || card.taskCardId).slice(0, 220),
  };
}

function buildRemoteTaskPrompt(card = {}, config = {}) {
  const text = cardText(card);
  const requirements = normalizeExecutionRequirements(card);
  const requirementLines = requirements ? [
    "",
    "Structured execution requirements:",
    `- requiresCommandExecution: ${requirements.requiresCommandExecution ? "true" : "false"}`,
    `- minimumCompletedCommandCount: ${requirements.minimumCompletedCommandCount}`,
    `- requiredCommandClasses: ${requirements.requiredCommandClasses.length ? requirements.requiredCommandClasses.join(",") : "none"}`,
    `- toolSurfaceRequired: ${requirements.toolSurfaceRequired ? "true" : "false"}`,
    "If command execution is required, use the standard command execution tool surface. Do not satisfy this task with assistant text only.",
  ] : [];
  const lines = [
    "[Remote Managed Workspace task card received from Home AI central]",
    "",
    `Task card id: ${text.id || "unknown"}`,
    text.idempotencyKey ? `Idempotency key: ${text.idempotencyKey}` : "",
    `Workspace kind: ${compactOneLine(config.workspaceKind || "remote_managed_workspace")}`,
    `Workspace id: ${compactOneLine(config.workspaceId)}`,
    `Project type: ${compactOneLine(config.projectType || "unknown")}`,
    `Local project root: ${compactOneLine(config.projectRoot)}`,
    "",
    `# ${text.title || "Remote task"}`,
    text.summary ? `\n${text.summary}` : "",
    text.body ? `\n${text.body}` : "",
    ...requirementLines,
    "",
    "Return a concise zh-CN final answer with bounded metadata only. Do not include secrets, cookies, launch tokens, raw logs, endpoint bodies, private thread bodies, raw cache JSON, database rows, screenshots, or provider payloads.",
  ];
  return boundedVisibleText(lines.filter((line) => line !== "").join("\n"), MAX_BODY_CHARS + 1200);
}

function buildRequiredCommandDeveloperInstructions(requirements = null, availability = null) {
  if (!requirements || !requirements.requiresCommandExecution) return "";
  return [
    "Remote Managed Workspace structured execution contract:",
    "- This turn has trusted structured executionRequirements in remoteManagedWorkspaceExecution.",
    "- You must use the standard command execution tool surface before the final answer.",
    `- Complete at least ${requirements.minimumCompletedCommandCount} command execution item(s).`,
    `- Required command classes: ${requirements.requiredCommandClasses.length ? requirements.requiredCommandClasses.join(", ") : "none"}.`,
    "- Do not satisfy this task with assistant text only.",
    "- Keep commands within the configured task-card execution authority; unsafe, destructive, outside-workspace, external-network, privileged, or secret-path commands are out of scope.",
    availability && availability.available === false
      ? `- Tool surface availability is ${availability.status || "unavailable"}; do not proceed as completed.`
      : "",
  ].filter(Boolean).join("\n");
}

function appendDeveloperInstructions(params = {}, instructions = "", marker = "") {
  const text = compactOneLine(marker) && String(instructions || "").includes(marker)
    ? String(instructions || "").trim()
    : String(instructions || "").trim();
  if (!text) return params;
  const existing = String(params.developerInstructions || "").trim();
  if (marker && existing.includes(marker)) return params;
  params.developerInstructions = existing ? `${existing}\n\n${text}` : text;
  return params;
}

function buildRemoteManagedWorkspaceTurnContract(card = {}, config = {}, requirements = null, availability = null) {
  if (!requirements) return null;
  const text = cardText(card);
  const toolSurfaceAvailability = normalizeToolSurfaceAvailability(availability, requirements);
  return {
    contractVersion: LOCAL_EXECUTION_CONTRACT_VERSION,
    source: "remote_managed_workspace",
    taskCardId: text.id,
    idempotencyKey: text.idempotencyKey,
    workspaceId: compactOneLine(config.workspaceId).slice(0, 180),
    projectType: compactOneLine(config.projectType || "unknown").slice(0, 120),
    executionRequirements: requirements,
    requiredToolSurface: {
      commandExecution: requirements.requiresCommandExecution === true,
      minimumCompletedCommandCount: requirements.minimumCompletedCommandCount,
      requiredCommandClasses: requirements.requiredCommandClasses,
      toolSurfaceRequired: requirements.toolSurfaceRequired,
    },
    toolSurfaceAvailability,
    terminalValidation: {
      requireBoundedCommandEvidence: requirements.requiresCommandExecution === true,
      rejectTextOnlyCompletion: requirements.requiresCommandExecution === true,
      rejectZeroResponseItems: requirements.requiresCommandExecution === true,
    },
  };
}

function turnItems(turn = {}) {
  const arrays = [
    turn.items,
    turn.outputItems,
    turn.output,
    turn.events,
    turn.messages,
    turn.steps,
  ].filter(Array.isArray);
  return arrays.flat().filter((item) => item && typeof item === "object" && !Array.isArray(item)).slice(0, 200);
}

function itemType(item = {}) {
  return compactOneLine(item.type || item.entryType || item.kind || item.name).toLowerCase();
}

function isCommandExecutionItem(item = {}) {
  const type = itemType(item);
  return type === "commandexecution"
    || type === "command_execution"
    || type === "execcommand"
    || type === "exec_command"
    || type === "item/commandexecution"
    || type === "item/commandexecution/completed";
}

function commandItemStatus(item = {}) {
  return statusText(item.status || item.state || item.result && item.result.status || item.outcome || "");
}

function isCompletedCommandItem(item = {}) {
  const status = commandItemStatus(item);
  if (/^(completed|complete|succeeded|success)$/i.test(status)) return true;
  if (/^(failed|failure|error|cancelled|canceled|interrupted|stopped|running|active|pending)$/i.test(status)) return false;
  if (item.completedAt || item.completedAtMs || item.completed_at || item.completed_at_ms) return true;
  if (Number(item.exitCode) === 0 || Number(item.exit_code) === 0 || Number(item.result && item.result.exitCode) === 0) return true;
  return false;
}

function commandTextFromItem(item = {}) {
  const command = item.command || item.cmd || item.text || item.args && item.args.command || item.params && item.params.command;
  if (Array.isArray(command)) return command.join(" ");
  return compactOneLine(command).slice(0, 500);
}

function commandClassesFromItem(item = {}, execution = {}, config = {}) {
  const direct = [
    item.commandClass,
    item.scopeClass,
    item.class,
    item.metadata && item.metadata.commandClass,
    item.metadata && item.metadata.scopeClass,
    item.authority && item.authority.scopeClass,
  ].map((entry) => compactOneLine(entry).toLowerCase()).filter(Boolean);
  const classList = Array.isArray(item.commandClasses) ? item.commandClasses : Array.isArray(item.scopeClasses) ? item.scopeClasses : [];
  direct.push(...classList.map((entry) => compactOneLine(entry).toLowerCase()).filter(Boolean));
  const command = commandTextFromItem(item);
  if (command && execution.executionAuthority) {
    const authority = Object.assign({}, execution.executionAuthority, {
      configured: true,
      targetThreadId: execution.threadId,
      turnId: execution.turnId,
      turnIds: [execution.turnId],
      workspaceRoot: config.projectRoot,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const decision = classifyAuthorityCommand(authority, {
      method: "item/commandExecution/requestApproval",
      params: {
        threadId: execution.threadId,
        turnId: execution.turnId,
        cwd: config.projectRoot,
        command,
      },
    });
    if (decision && decision.scopeClass) direct.push(decision.scopeClass);
  }
  const allowlist = new Set(ALLOWED_SCOPE_CLASSES);
  return Array.from(new Set(direct.filter((entry) => allowlist.has(entry))));
}

function evaluateExecutionRequirements(requirements, turn = {}, execution = {}, config = {}) {
  if (!requirements) return null;
  const authorityConfigured = Boolean(execution.executionAuthority && execution.executionAuthority.configured === true);
  const availability = normalizeToolSurfaceAvailability(execution.toolSurfaceAvailability, requirements);
  if (requirements.toolSurfaceRequired && availability.available === false) {
    return {
      ok: false,
      issueCode: availability.issueCode || COMMAND_TOOL_SURFACE_UNAVAILABLE_CODE,
      commandExecutionCount: 0,
      minimumCompletedCommandCount: requirements.minimumCompletedCommandCount,
      requiredCommandClasses: requirements.requiredCommandClasses,
      completedCommandClasses: [],
      toolSurfaceRequired: requirements.toolSurfaceRequired,
      toolSurfaceAvailability: availability,
    };
  }
  const toolUnavailable = turn.commandToolAvailable === false
    || turn.toolSurfaceAvailable === false
    || turn.commandExecutionToolAvailable === false
    || !authorityConfigured;
  if (requirements.toolSurfaceRequired && toolUnavailable) {
    return {
      ok: false,
      issueCode: COMMAND_TOOL_UNAVAILABLE_CODE,
      commandExecutionCount: 0,
      minimumCompletedCommandCount: requirements.minimumCompletedCommandCount,
      requiredCommandClasses: requirements.requiredCommandClasses,
      completedCommandClasses: [],
      toolSurfaceRequired: requirements.toolSurfaceRequired,
      toolSurfaceAvailability: Object.assign({}, availability, {
        available: false,
        status: "unavailable",
        commandExecutionToolAvailable: false,
        issueCode: COMMAND_TOOL_UNAVAILABLE_CODE,
      }),
    };
  }
  const commandItems = turnItems(turn).filter(isCommandExecutionItem);
  const completedItems = commandItems.filter(isCompletedCommandItem);
  const completedCommandClasses = Array.from(new Set(completedItems.flatMap((item) => commandClassesFromItem(item, execution, config))));
  const commandExecutionCount = completedItems.length;
  if (requirements.requiresCommandExecution && commandExecutionCount < requirements.minimumCompletedCommandCount) {
    return {
      ok: false,
      issueCode: REQUIRED_COMMAND_MISSING_CODE,
      commandExecutionCount,
      minimumCompletedCommandCount: requirements.minimumCompletedCommandCount,
      requiredCommandClasses: requirements.requiredCommandClasses,
      completedCommandClasses,
      toolSurfaceRequired: requirements.toolSurfaceRequired,
      toolSurfaceAvailability: availability,
    };
  }
  const missingClasses = (requirements.requiredCommandClasses || []).filter((entry) => !completedCommandClasses.includes(entry));
  if (missingClasses.length) {
    return {
      ok: false,
      issueCode: REQUIRED_COMMAND_CLASS_MISSING_CODE,
      commandExecutionCount,
      minimumCompletedCommandCount: requirements.minimumCompletedCommandCount,
      requiredCommandClasses: requirements.requiredCommandClasses,
      completedCommandClasses,
      missingCommandClasses: missingClasses,
      toolSurfaceRequired: requirements.toolSurfaceRequired,
      toolSurfaceAvailability: availability,
    };
  }
  return {
    ok: true,
    issueCode: "",
    commandExecutionCount,
    minimumCompletedCommandCount: requirements.minimumCompletedCommandCount,
    requiredCommandClasses: requirements.requiredCommandClasses,
    completedCommandClasses,
    toolSurfaceRequired: requirements.toolSurfaceRequired,
    toolSurfaceAvailability: availability,
  };
}

function threadIdFromStartResult(result = {}) {
  return compactOneLine(
    result.threadId
      || result.id
      || result.thread && (result.thread.id || result.thread.threadId)
      || result.data && (result.data.threadId || result.data.id || result.data.thread && result.data.thread.id),
  );
}

function turnIdFromStartResult(result = {}) {
  return compactOneLine(
    result.turnId
      || result.id
      || result.turn && (result.turn.id || result.turn.turnId)
      || result.data && (result.data.turnId || result.data.id || result.data.turn && result.data.turn.id),
  );
}

function createRemoteManagedWorkspaceLocalExecutionService(dependencies = {}) {
  const fs = dependencies.fs || defaultFs;
  const path = dependencies.path || defaultPath;
  const codex = dependencies.codex;
  const logger = dependencies.logger || console;
  const now = typeof dependencies.now === "function" ? dependencies.now : Date.now;
  const completionPollIntervalMs = Math.max(10, Number(dependencies.completionPollIntervalMs || DEFAULT_COMPLETION_POLL_INTERVAL_MS) || DEFAULT_COMPLETION_POLL_INTERVAL_MS);
  const completionTimeoutMs = Math.max(0, Number(dependencies.completionTimeoutMs || DEFAULT_COMPLETION_TIMEOUT_MS) || DEFAULT_COMPLETION_TIMEOUT_MS);
  const readRpcTimeoutMs = Math.max(1000, Number(dependencies.readRpcTimeoutMs || 30_000) || 30_000);
  const mutationRpcTimeoutMs = Math.max(1000, Number(dependencies.mutationRpcTimeoutMs || 120_000) || 120_000);
  const sleepImpl = typeof dependencies.sleep === "function" ? dependencies.sleep : sleep;
  const applyStartThreadRuntimeSettings = typeof dependencies.applyStartThreadRuntimeSettings === "function"
    ? dependencies.applyStartThreadRuntimeSettings
    : (params) => params;
  const applyTurnRuntimeSettings = typeof dependencies.applyTurnRuntimeSettings === "function"
    ? dependencies.applyTurnRuntimeSettings
    : (params, settings) => Object.assign({}, params, settings && settings.reasoningEffort ? { effort: settings.reasoningEffort } : {});
  const resolveThreadRuntimeSettings = typeof dependencies.resolveThreadRuntimeSettings === "function"
    ? dependencies.resolveThreadRuntimeSettings
    : async () => ({});
  const applyPermissionModeOverride = typeof dependencies.applyPermissionModeOverride === "function"
    ? dependencies.applyPermissionModeOverride
    : (settings) => settings;
  const readStartThreadDeveloperInstructions = typeof dependencies.readStartThreadDeveloperInstructions === "function"
    ? dependencies.readStartThreadDeveloperInstructions
    : () => "";
  const rememberStartedThread = typeof dependencies.rememberStartedThread === "function"
    ? dependencies.rememberStartedThread
    : () => null;
  const notifyLocalTurnStarted = typeof dependencies.notifyLocalTurnStarted === "function"
    ? dependencies.notifyLocalTurnStarted
    : (_threadId, result) => turnIdFromStartResult(result);
  const persistThreadTitleToSessionIndex = typeof dependencies.persistThreadTitleToSessionIndex === "function"
    ? dependencies.persistThreadTitleToSessionIndex
    : () => false;
  const tryUpdateThreadTitle = typeof dependencies.tryUpdateThreadTitle === "function"
    ? dependencies.tryUpdateThreadTitle
    : async () => false;
  const registerExecutionAuthority = typeof dependencies.registerExecutionAuthority === "function"
    ? dependencies.registerExecutionAuthority
    : null;
  const resolveCommandToolSurfaceAvailability = typeof dependencies.resolveCommandToolSurfaceAvailability === "function"
    ? dependencies.resolveCommandToolSurfaceAvailability
    : async (_requirements) => ({
        required: Boolean(_requirements && _requirements.toolSurfaceRequired),
        available: Boolean(!_requirements || !_requirements.toolSurfaceRequired || registerExecutionAuthority),
        source: "local_execution_authority_bridge",
        authorityBridgeAvailable: Boolean(registerExecutionAuthority),
      });

  function requireCodex() {
    if (!codex || typeof codex.request !== "function") {
      throw errorWithStatus("local_codex_runtime_unavailable", 503);
    }
    return codex;
  }

  function normalizeConfig(config = {}) {
    const project = validateProjectRoot({
      projectRoot: config.projectRoot,
      allowedRoots: config.allowedRoots || [config.allowedRoot],
    }, { fs, path });
    return Object.assign({}, config, {
      projectRoot: project.projectRoot,
      allowedRoots: Array.isArray(config.allowedRoots) ? config.allowedRoots : [config.allowedRoot].filter(Boolean),
      projectRootEvidence: project.evidence,
    });
  }

  async function startLocalThread(card, config, runtimeSettings) {
    const text = cardText(card);
    const title = boundedVisibleText(`Remote: ${text.title || text.id || "task"}`, MAX_TITLE_CHARS);
    const params = applyStartThreadRuntimeSettings({
      cwd: config.projectRoot,
      config: {},
      developerInstructions: readStartThreadDeveloperInstructions(config.projectRoot) || "",
      persistExtendedHistory: true,
    }, runtimeSettings || {}, {
      skipWorkspaceDelegationRuntimeGuidance: true,
    });
    const result = await requireCodex().request("thread/start", params, {
      timeoutMs: mutationRpcTimeoutMs,
      retry: false,
    });
    const threadId = typeof dependencies.threadIdFromStartResult === "function"
      ? compactOneLine(dependencies.threadIdFromStartResult(result))
      : threadIdFromStartResult(result);
    if (!threadId) throw errorWithStatus("local_task_card_execution_missing_thread_id", 502);
    const thread = Object.assign({}, result && (result.thread || result.data && result.data.thread) || {}, {
      id: threadId,
      title,
      name: title,
      preview: title,
      cwd: config.projectRoot,
      threadRole: "external_project_main",
      pluginId: "codex-mobile",
      workerPurpose: "remote_managed_workspace",
    });
    rememberStartedThread(thread);
    persistThreadTitleToSessionIndex(threadId, title);
    try {
      await tryUpdateThreadTitle(threadId, title);
    } catch (err) {
      if (logger && typeof logger.error === "function") {
        logger.error(`[remote-managed-workspace-local-execution] title update failed: ${compactOneLine(err && err.message || String(err)).slice(0, 180)}`);
      }
    }
    return { threadId, thread };
  }

  async function startLocalTurn(card, config, threadId, runtimeSettings, toolSurfaceAvailability) {
    const prompt = buildRemoteTaskPrompt(card, config);
    const requirements = normalizeExecutionRequirements(card);
    const turnContract = buildRemoteManagedWorkspaceTurnContract(card, config, requirements, toolSurfaceAvailability);
    const params = applyTurnRuntimeSettings({
      threadId,
      input: [{ type: "text", text: prompt }],
      remoteManagedWorkspaceExecution: turnContract || undefined,
    }, runtimeSettings || {});
    appendDeveloperInstructions(
      params,
      buildRequiredCommandDeveloperInstructions(requirements, toolSurfaceAvailability),
      "Remote Managed Workspace structured execution contract:",
    );
    if (!params.remoteManagedWorkspaceExecution) delete params.remoteManagedWorkspaceExecution;
    const result = await requireCodex().request("turn/start", params, {
      timeoutMs: mutationRpcTimeoutMs,
      retry: false,
    });
    const turnId = notifyLocalTurnStarted(threadId, result, { source: "remote-managed-workspace" })
      || turnIdFromStartResult(result);
    if (!turnId) throw errorWithStatus("local_task_card_execution_missing_turn_id", 502);
    return { turnId, result };
  }

  async function readTurn(threadId, turnId) {
    const result = await requireCodex().request("thread/turns/list", {
      threadId,
      limit: 12,
      sortDirection: "desc",
    }, {
      timeoutMs: readRpcTimeoutMs,
      retry: false,
      resetOnTimeout: false,
    });
    const turns = turnListFromResult(result);
    return turns.find((turn) => turnIdentifier(turn) === turnId) || null;
  }

  async function waitForTurnCompletion(threadId, turnId, heartbeat) {
    const deadline = now() + completionTimeoutMs;
    let lastTurn = null;
    let pollCount = 0;
    for (;;) {
      pollCount += 1;
      const turn = await readTurn(threadId, turnId);
      if (turn) lastTurn = turn;
      if (turn && isCompletedTurn(turn)) {
        return { completed: true, turn, pollCount };
      }
      if (completionTimeoutMs === 0 || now() >= deadline) {
        return { completed: false, turn: lastTurn, pollCount };
      }
      if (typeof heartbeat === "function") {
        await heartbeat({ status: "working", localThreadId: threadId, localTurnId: turnId, pollCount });
      }
      await sleepImpl(Math.min(completionPollIntervalMs, Math.max(0, deadline - now())));
    }
  }

  function workflowIdForCard(card = {}, config = {}) {
    const workflow = card.workflow && typeof card.workflow === "object" ? card.workflow : {};
    return compactOneLine(
      workflow.id
        || card.workflowId
        || card.workflow_id
        || card.workflow && card.workflow.workflowId
        || `rmw:${config.workspaceId || "workspace"}:${normalizedCardId(card)}`,
    ).slice(0, 220);
  }

  function sourceThreadIdForCard(card = {}) {
    const source = card.source && typeof card.source === "object" ? card.source : {};
    return compactOneLine(
      source.threadId
        || source.thread_id
        || card.sourceThreadId
        || card.source_thread_id
        || "home_ai_rmw_control",
    ).slice(0, 220);
  }

  function sourceWorkspaceIdForCard(card = {}) {
    const source = card.source && typeof card.source === "object" ? card.source : {};
    return compactOneLine(
      source.workspaceId
        || source.workspace_id
        || card.sourceWorkspaceId
        || card.source_workspace_id
        || "home_ai_central",
    ).slice(0, 260);
  }

  function authorityCardForRemoteExecution(card = {}, config = {}) {
    const taskCardId = normalizedCardId(card);
    return {
      id: taskCardId,
      taskCardId,
      workflow: {
        mode: "autonomous",
        id: workflowIdForCard(card, config),
        authorized: true,
        routeKind: "remote_managed_workspace",
      },
      source: {
        threadId: sourceThreadIdForCard(card),
        workspaceId: sourceWorkspaceIdForCard(card),
      },
      target: {
        threadId: "",
        workspaceId: compactOneLine(config.workspaceId).slice(0, 260),
        role: "external_project_main",
      },
      delivery: {
        approvalMode: "remote_managed_workspace_central",
        targetApprovalBypassed: true,
      },
    };
  }

  async function configureExecutionAuthority(card = {}, config = {}, execution = {}) {
    const authorityCard = authorityCardForRemoteExecution(card, config);
    authorityCard.target.threadId = execution.threadId;
    const authority = createExecutionAuthorityForCard(authorityCard, execution, {
      trustedAutonomous: true,
      source: "remote_managed_workspace",
      workflowId: authorityCard.workflow.id,
      targetWorkspaceId: config.workspaceId,
      workspaceRoot: config.projectRoot,
      now,
    });
    const summary = summarizeExecutionAuthority(authority, now());
    if (authority && registerExecutionAuthority) {
      try {
        return await registerExecutionAuthority(authority) || summary;
      } catch (err) {
        if (logger && typeof logger.error === "function") {
          logger.error(`[remote-managed-workspace-local-execution] authority registration failed: ${compactOneLine(err && err.message || String(err)).slice(0, 180)}`);
        }
      }
    }
    return summary;
  }

  async function commandToolSurfaceAvailability(card, config, runtimeSettings) {
    const requirements = normalizeExecutionRequirements(card);
    const fallback = normalizeToolSurfaceAvailability(null, requirements);
    if (!requirements || !requirements.toolSurfaceRequired) return fallback;
    let raw = null;
    try {
      raw = await resolveCommandToolSurfaceAvailability(requirements, config, runtimeSettings);
    } catch (err) {
      raw = {
        available: false,
        source: "local_execution_authority_bridge",
        issueCode: COMMAND_TOOL_SURFACE_UNAVAILABLE_CODE,
        status: "unavailable",
      };
      if (logger && typeof logger.error === "function") {
        logger.error(`[remote-managed-workspace-local-execution] tool surface availability failed: ${compactOneLine(err && err.message || String(err)).slice(0, 180)}`);
      }
    }
    return normalizeToolSurfaceAvailability(raw, requirements);
  }

  function terminalForToolSurfaceUnavailable(card, config, availability) {
    const requirements = normalizeExecutionRequirements(card);
    const issueCode = availability && availability.issueCode || COMMAND_TOOL_SURFACE_UNAVAILABLE_CODE;
    const executionResult = {
      ok: false,
      issueCode,
      commandExecutionCount: 0,
      minimumCompletedCommandCount: requirements ? requirements.minimumCompletedCommandCount : 0,
      requiredCommandClasses: requirements ? requirements.requiredCommandClasses : [],
      completedCommandClasses: [],
      toolSurfaceRequired: Boolean(requirements && requirements.toolSurfaceRequired),
      toolSurfaceAvailability: availability || null,
    };
    return {
      status: "blocked",
      title: "远程任务执行未闭合",
      summary: issueCode,
      body: boundedVisibleText([
        "## Remote Managed Workspace 回卡",
        "",
        "- status: blocked",
        "- bridge: codex_mobile_local_runtime",
        `- taskCardId: ${normalizedCardId(card)}`,
        `- workspaceId: ${compactOneLine(config.workspaceId)}`,
        `- issueCode: ${issueCode}`,
        "- commandExecutionCount: 0",
      ].join("\n"), MAX_RETURN_BODY_CHARS),
      metadata: {
        bridge: "codex_mobile_local_runtime",
        localExecutionBridge: "codex_mobile_local_runtime",
        taskCardId: normalizedCardId(card),
        workspaceId: compactOneLine(config.workspaceId).slice(0, 180),
        localThreadId: "",
        localTurnId: "",
        turnStatus: "not_started",
        completed: false,
        issueCode,
        executionAuthority: null,
        toolSurfaceAvailability: availability || null,
        executionRequirements: requirements || null,
        executionResult: Object.assign({
          taskCardId: normalizedCardId(card),
          workspaceId: compactOneLine(config.workspaceId).slice(0, 180),
          localThreadId: "",
          localTurnId: "",
          terminalStatus: "blocked",
        }, executionResult),
      },
    };
  }

  function terminalForCompletedTurn(card, config, execution, completion) {
    const turn = completion.turn || {};
    const turnStatus = statusText(turn.status || turn.state) || (completion.completed ? "completed" : "timeout");
    const requirements = normalizeExecutionRequirements(card);
    const executionResult = completion.completed
      ? evaluateExecutionRequirements(requirements, turn, execution, config)
      : requirements
        ? {
            ok: false,
          issueCode: "local_task_card_execution_completion_timeout",
            commandExecutionCount: 0,
            minimumCompletedCommandCount: requirements.minimumCompletedCommandCount,
            requiredCommandClasses: requirements.requiredCommandClasses,
            completedCommandClasses: [],
            toolSurfaceRequired: requirements.toolSurfaceRequired,
            toolSurfaceAvailability: normalizeToolSurfaceAvailability(execution.toolSurfaceAvailability, requirements),
          }
        : null;
    const executionIssue = executionResult && executionResult.ok === false ? executionResult.issueCode : "";
    const terminalStatus = executionIssue
      ? "blocked"
      : completion.completed ? terminalStatusForTurn(turn) : "partially_completed";
    const timeout = completion.completed ? "" : "local_task_card_execution_completion_timeout";
    const issueCode = executionIssue || timeout;
    return {
      status: terminalStatus,
      title: terminalStatus === "completed" ? "远程任务执行完成" : "远程任务执行未闭合",
      summary: terminalStatus === "completed" ? "local_task_card_execution_completed" : issueCode,
      body: boundedVisibleText([
        "## Remote Managed Workspace 回卡",
        "",
        `- status: ${terminalStatus}`,
        `- bridge: codex_mobile_local_runtime`,
        `- taskCardId: ${normalizedCardId(card)}`,
        `- workspaceId: ${compactOneLine(config.workspaceId)}`,
        `- localThreadId: ${execution.threadId}`,
        `- localTurnId: ${execution.turnId}`,
        `- turnStatus: ${turnStatus}`,
        issueCode ? `- issueCode: ${issueCode}` : "",
        executionResult ? `- commandExecutionCount: ${executionResult.commandExecutionCount || 0}` : "",
      ].filter(Boolean).join("\n"), MAX_RETURN_BODY_CHARS),
      metadata: {
        bridge: "codex_mobile_local_runtime",
        localExecutionBridge: "codex_mobile_local_runtime",
        taskCardId: normalizedCardId(card),
        workspaceId: compactOneLine(config.workspaceId).slice(0, 180),
        localThreadId: execution.threadId,
        localTurnId: execution.turnId,
        turnStatus,
        completed: completion.completed === true,
        issueCode,
        executionAuthority: execution.executionAuthority || null,
        toolSurfaceAvailability: execution.toolSurfaceAvailability || null,
        executionRequirements: requirements || null,
        executionResult: executionResult ? Object.assign({
          taskCardId: normalizedCardId(card),
          workspaceId: compactOneLine(config.workspaceId).slice(0, 180),
          localThreadId: execution.threadId,
          localTurnId: execution.turnId,
          terminalStatus,
        }, executionResult) : null,
      },
    };
  }

  async function execute(card = {}, options = {}) {
    const config = normalizeConfig(options.config || {});
    const requestedReasoningEffort = compactOneLine(cardText(card).reasoningEffort);
    const inheritedRuntimeSettings = applyPermissionModeOverride(
      await resolveThreadRuntimeSettings(""),
      "full",
      config.projectRoot,
    );
    const runtimeSettings = applyReasoningEffortFloor(Object.assign({}, inheritedRuntimeSettings || {}, requestedReasoningEffort ? {
      reasoningEffort: requestedReasoningEffort,
    } : {}), "xhigh");
    const toolSurfaceAvailability = await commandToolSurfaceAvailability(card, config, runtimeSettings);
    const requirements = normalizeExecutionRequirements(card);
    if (requirements && requirements.toolSurfaceRequired && toolSurfaceAvailability.available === false) {
      return terminalForToolSurfaceUnavailable(card, config, toolSurfaceAvailability);
    }
    const started = await startLocalThread(card, config, runtimeSettings);
    const turn = await startLocalTurn(card, config, started.threadId, runtimeSettings, toolSurfaceAvailability);
    const execution = {
      threadId: started.threadId,
      turnId: turn.turnId,
      requestedReasoningEffort,
      reasoningEffort: runtimeSettings.reasoningEffort || "",
      toolSurfaceAvailability,
    };
    execution.executionAuthority = await configureExecutionAuthority(card, config, execution);
    if (typeof options.onExecutionStarted === "function") {
      options.onExecutionStarted(execution);
    }
    const completion = await waitForTurnCompletion(started.threadId, turn.turnId, options.heartbeat);
    return terminalForCompletedTurn(card, config, execution, completion);
  }

  return {
    buildRemoteTaskPrompt,
    cardText,
    execute,
    isCompletedTurn,
    isCompletedStatus,
    normalizeConfig,
    terminalForCompletedTurn,
    waitForTurnCompletion,
  };
}

module.exports = {
  buildRemoteTaskPrompt,
  createRemoteManagedWorkspaceLocalExecutionService,
  evaluateExecutionRequirements,
  isCompletedTurn,
  isCompletedStatus,
  normalizeExecutionRequirements,
};
