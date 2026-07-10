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
  createExecutionAuthorityForCard,
  summarizeExecutionAuthority,
} = require("../task-cards/task-card-execution-authority-service");

const MAX_TITLE_CHARS = 120;
const MAX_SUMMARY_CHARS = 300;
const MAX_BODY_CHARS = 8_000;
const MAX_RETURN_BODY_CHARS = 1_200;
const DEFAULT_COMPLETION_POLL_INTERVAL_MS = 5_000;
const DEFAULT_COMPLETION_TIMEOUT_MS = 30 * 60 * 1000;

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
    "",
    "Return a concise zh-CN final answer with bounded metadata only. Do not include secrets, cookies, launch tokens, raw logs, endpoint bodies, private thread bodies, raw cache JSON, database rows, screenshots, or provider payloads.",
  ];
  return boundedVisibleText(lines.filter((line) => line !== "").join("\n"), MAX_BODY_CHARS + 1200);
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

  async function startLocalTurn(card, config, threadId, runtimeSettings) {
    const prompt = buildRemoteTaskPrompt(card, config);
    const params = applyTurnRuntimeSettings({
      threadId,
      input: [{ type: "text", text: prompt }],
    }, runtimeSettings || {});
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

  function terminalForCompletedTurn(card, config, execution, completion) {
    const turn = completion.turn || {};
    const turnStatus = statusText(turn.status || turn.state) || (completion.completed ? "completed" : "timeout");
    const terminalStatus = completion.completed ? terminalStatusForTurn(turn) : "partially_completed";
    const timeout = completion.completed ? "" : "local_task_card_execution_completion_timeout";
    return {
      status: terminalStatus,
      title: terminalStatus === "completed" ? "远程任务执行完成" : "远程任务执行未闭合",
      summary: terminalStatus === "completed" ? "local_task_card_execution_completed" : timeout,
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
        timeout ? `- issueCode: ${timeout}` : "",
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
        issueCode: timeout,
        executionAuthority: execution.executionAuthority || null,
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
    const started = await startLocalThread(card, config, runtimeSettings);
    const turn = await startLocalTurn(card, config, started.threadId, runtimeSettings);
    const execution = {
      threadId: started.threadId,
      turnId: turn.turnId,
      requestedReasoningEffort,
      reasoningEffort: runtimeSettings.reasoningEffort || "",
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
  isCompletedTurn,
  isCompletedStatus,
};
