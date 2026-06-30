"use strict";

const THREAD_GOAL_OBJECTIVE_MAX_CHARS = 4000;

function normalizeThreadGoalObjectiveInput(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > THREAD_GOAL_OBJECTIVE_MAX_CHARS
    ? text.slice(0, THREAD_GOAL_OBJECTIVE_MAX_CHARS).trimEnd()
    : text;
}

function normalizeThreadGoalTokenBudgetInput(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.trunc(number);
}

function isThreadGoalRpcUnsupportedError(err) {
  const message = String((err && err.message) || "").toLowerCase();
  const code = String((err && err.code) || "").toLowerCase();
  return /method not found|unknown method|not supported|unsupported|thread\/goal\/(set|clear|get)/.test(message)
    || /method_not_found|method-not-found|unsupported|not_supported/.test(code);
}

function threadGoalFromRpcResult(result) {
  if (!result || typeof result !== "object") return null;
  const goal = result.goal && typeof result.goal === "object" ? result.goal : result;
  return goal && typeof goal === "object" ? goal : null;
}

function threadGoalSetParams(threadId, objective, tokenBudget, extra = {}) {
  const params = Object.assign({ threadId, objective }, extra || {});
  if (tokenBudget !== null) params.tokenBudget = tokenBudget;
  return params;
}

function createDefaultStatusError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function createThreadGoalActionService(deps = {}) {
  const codexRequest = typeof deps.codexRequest === "function" ? deps.codexRequest : async () => ({});
  const mutationRpcTimeoutMs = Number(deps.mutationRpcTimeoutMs || 120000);
  const readRpcTimeoutMs = Number(deps.readRpcTimeoutMs || 12000);
  const normalizeThreadGoalStatus = typeof deps.normalizeThreadGoalStatus === "function"
    ? deps.normalizeThreadGoalStatus
    : (value) => String(value || "").trim().toLowerCase();
  const goalForThread = typeof deps.goalForThread === "function" ? deps.goalForThread : () => null;
  const httpStatusError = typeof deps.httpStatusError === "function" ? deps.httpStatusError : createDefaultStatusError;

  function isCompletedThreadGoal(goal) {
    if (!goal || typeof goal !== "object") return false;
    return normalizeThreadGoalStatus(goal.status) === "complete";
  }

  function currentThreadGoalForSet(threadId) {
    try {
      return goalForThread(threadId);
    } catch {
      return null;
    }
  }

  async function clearThreadGoalForSet(threadId) {
    return codexRequest("thread/goal/clear", { threadId }, {
      timeoutMs: mutationRpcTimeoutMs,
      retry: false,
    });
  }

  async function getThreadGoalRpc(threadId) {
    return codexRequest("thread/goal/get", { threadId }, {
      timeoutMs: readRpcTimeoutMs,
      retry: false,
    });
  }

  async function setThreadGoalRpc(params) {
    return codexRequest("thread/goal/set", params, {
      timeoutMs: mutationRpcTimeoutMs,
      retry: false,
    });
  }

  function threadGoalForActionFallback(threadId) {
    try {
      return currentThreadGoalForSet(threadId);
    } catch {
      return null;
    }
  }

  async function currentThreadGoalForAction(threadId) {
    try {
      return threadGoalFromRpcResult(await getThreadGoalRpc(threadId)) || threadGoalForActionFallback(threadId);
    } catch (err) {
      if (isThreadGoalRpcUnsupportedError(err)) {
        throw httpStatusError(501, "Thread goal actions are not supported by the running Codex app-server; restart Mobile Web with Codex CLI 0.135.0 or newer.");
      }
      return threadGoalForActionFallback(threadId);
    }
  }

  function threadGoalTokenBudgetParam(inputTokenBudget, currentGoal = null) {
    const inputBudget = normalizeThreadGoalTokenBudgetInput(inputTokenBudget);
    if (inputBudget !== null) return inputBudget;
    const currentBudget = normalizeThreadGoalTokenBudgetInput(currentGoal && (currentGoal.tokenBudget ?? currentGoal.token_budget));
    return currentBudget;
  }

  async function setThreadGoal(threadId, input = {}) {
    const id = String(threadId || "").trim();
    const objective = normalizeThreadGoalObjectiveInput(input.objective || input.goal || input.text);
    if (!id) throw httpStatusError(400, "Thread id is required");
    if (!objective) throw httpStatusError(400, "Goal objective is required");
    const params = { threadId: id, objective };
    const tokenBudget = normalizeThreadGoalTokenBudgetInput(input.tokenBudget ?? input.token_budget);
    if (tokenBudget !== null) params.tokenBudget = tokenBudget;
    try {
      let clearedCompletedGoal = false;
      if (isCompletedThreadGoal(currentThreadGoalForSet(id))) {
        await clearThreadGoalForSet(id);
        clearedCompletedGoal = true;
      }
      let result = await setThreadGoalRpc(params);
      let goal = threadGoalFromRpcResult(result);
      if (!clearedCompletedGoal && isCompletedThreadGoal(goal)) {
        await clearThreadGoalForSet(id);
        clearedCompletedGoal = true;
        result = await setThreadGoalRpc(params);
        goal = threadGoalFromRpcResult(result);
      }
      return { ok: true, goal: goal || result, result, clearedCompletedGoal };
    } catch (err) {
      if (isThreadGoalRpcUnsupportedError(err)) {
        throw httpStatusError(501, "Thread goal set is not supported by the running Codex app-server; restart Mobile Web with Codex CLI 0.135.0 or newer.");
      }
      throw err;
    }
  }

  async function runThreadGoalAction(threadId, input = {}) {
    const id = String(threadId || "").trim();
    const action = String(input.action || "").trim().toLowerCase();
    if (!id) throw httpStatusError(400, "Thread id is required");
    if (!action) throw httpStatusError(400, "Goal action is required");
    if (action === "cancel" || action === "clear") {
      try {
        await clearThreadGoalForSet(id);
        return { ok: true, action: "cancel", goal: null };
      } catch (err) {
        if (isThreadGoalRpcUnsupportedError(err)) {
          throw httpStatusError(501, "Thread goal clear is not supported by the running Codex app-server; restart Mobile Web with Codex CLI 0.135.0 or newer.");
        }
        throw err;
      }
    }

    const currentGoal = await currentThreadGoalForAction(id);
    const objective = normalizeThreadGoalObjectiveInput(input.objective || input.goal || input.text || currentGoal && currentGoal.objective);
    if (!objective) throw httpStatusError(400, "Goal objective is required");
    const tokenBudget = threadGoalTokenBudgetParam(input.tokenBudget ?? input.token_budget, currentGoal);

    if (action === "continue" || action === "resume") {
      if (normalizeThreadGoalStatus(currentGoal && currentGoal.status) === "active") {
        return { ok: true, action: "continue", goal: currentGoal, changed: false };
      }
      try {
        await clearThreadGoalForSet(id);
        const result = await setThreadGoalRpc(threadGoalSetParams(id, objective, tokenBudget));
        const goal = threadGoalFromRpcResult(result) || await currentThreadGoalForAction(id);
        return { ok: true, action: "continue", goal: goal || result, result, changed: true };
      } catch (err) {
        if (isThreadGoalRpcUnsupportedError(err)) {
          throw httpStatusError(501, "Thread goal continue is not supported by the running Codex app-server; restart Mobile Web with Codex CLI 0.135.0 or newer.");
        }
        throw err;
      }
    }

    if (action === "pause") {
      try {
        const result = await setThreadGoalRpc(threadGoalSetParams(id, objective, tokenBudget, { status: "blocked" }));
        let goal = threadGoalFromRpcResult(result);
        if (normalizeThreadGoalStatus(goal && goal.status) !== "blocked") goal = await currentThreadGoalForAction(id);
        if (normalizeThreadGoalStatus(goal && goal.status) !== "blocked") {
          throw httpStatusError(501, "Thread goal pause is not supported by the running Codex app-server.");
        }
        return { ok: true, action: "pause", goal, result, changed: true };
      } catch (err) {
        if (err && err.statusCode) throw err;
        if (isThreadGoalRpcUnsupportedError(err)) {
          throw httpStatusError(501, "Thread goal pause is not supported by the running Codex app-server; restart Mobile Web with Codex CLI 0.135.0 or newer.");
        }
        throw err;
      }
    }

    throw httpStatusError(400, `Unsupported goal action: ${action}`);
  }

  return {
    clearThreadGoalForSet,
    currentThreadGoalForAction,
    getThreadGoalRpc,
    isCompletedThreadGoal,
    isThreadGoalRpcUnsupportedError,
    normalizeThreadGoalObjectiveInput,
    normalizeThreadGoalTokenBudgetInput,
    runThreadGoalAction,
    setThreadGoal,
    setThreadGoalRpc,
    threadGoalFromRpcResult,
    threadGoalSetParams,
  };
}

module.exports = {
  createThreadGoalActionService,
  isThreadGoalRpcUnsupportedError,
  normalizeThreadGoalObjectiveInput,
  normalizeThreadGoalTokenBudgetInput,
  threadGoalFromRpcResult,
  threadGoalSetParams,
};
