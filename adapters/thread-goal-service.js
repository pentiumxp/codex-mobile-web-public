"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { runSqliteJson } = require("./sqlite-cli");

const MAX_GOAL_OBJECTIVE_CHARS = 500;

function sqlString(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function positiveInteger(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.trunc(number);
}

function nullablePositiveInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.trunc(number);
}

function boundedSingleLine(value, maxChars = MAX_GOAL_OBJECTIVE_CHARS) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function normalizeThreadGoalStatus(value) {
  const raw = String(value || "").trim();
  if (!raw) return "active";
  const normalized = raw.replace(/[-\s]+/g, "_").toLowerCase();
  if (normalized === "active") return "active";
  if (normalized === "paused") return "paused";
  if (normalized === "complete" || normalized === "completed") return "complete";
  if (normalized === "budget_limited" || normalized === "budgetlimited") return "budgetLimited";
  if (normalized === "usage_limited" || normalized === "usagelimited") return "usageLimited";
  if (normalized === "blocked") return "blocked";
  return normalized.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

function publicThreadGoal(row = {}) {
  const threadId = String(row.thread_id ?? row.threadId ?? "").trim();
  const objective = boundedSingleLine(row.objective);
  if (!threadId || !objective) return null;
  return {
    threadId,
    objective,
    status: normalizeThreadGoalStatus(row.status),
    tokenBudget: nullablePositiveInteger(row.token_budget ?? row.tokenBudget),
    tokensUsed: positiveInteger(row.tokens_used ?? row.tokensUsed),
    timeUsedSeconds: positiveInteger(row.time_used_seconds ?? row.timeUsedSeconds),
    createdAt: positiveInteger(row.created_at_ms ?? row.createdAt),
    updatedAt: positiveInteger(row.updated_at_ms ?? row.updatedAt),
  };
}

function collectThreadIds(threads = []) {
  return [...new Set((threads || [])
    .map((thread) => String(thread && thread.id || "").trim())
    .filter(Boolean))];
}

function createThreadGoalService(options = {}) {
  const rawDbPath = String(options.dbPath || "").trim();
  const dbPath = rawDbPath ? path.resolve(rawDbPath) : "";
  const sqlite = options.sqlite || { json: runSqliteJson };
  const userHome = options.userHome || process.env.USERPROFILE || process.env.HOME || "";
  let lastError = null;

  function queryGoals(threadIds = []) {
    const ids = collectThreadIds(threadIds.map((id) => ({ id })));
    if (!ids.length || !dbPath || !fs.existsSync(dbPath)) return [];
    const query = `
SELECT
  thread_id,
  objective,
  status,
  token_budget,
  tokens_used,
  time_used_seconds,
  created_at_ms,
  updated_at_ms
FROM thread_goals
WHERE thread_id IN (${ids.map(sqlString).join(",")});
`;
    let result;
    try {
      result = sqlite.json(dbPath, query, { timeoutMs: 3000, maxBuffer: 1024 * 1024, userHome });
    } catch (err) {
      lastError = err;
      return [];
    }
    if (!result || !result.ok) {
      lastError = result && result.error ? result.error : new Error("thread goal query failed");
      return [];
    }
    lastError = null;
    return Array.isArray(result.rows) ? result.rows : [];
  }

  function goalsForThreads(threadIds = []) {
    const byThreadId = new Map();
    for (const row of queryGoals(threadIds)) {
      const goal = publicThreadGoal(row);
      if (goal) byThreadId.set(goal.threadId, goal);
    }
    return byThreadId;
  }

  function goalForThread(threadId) {
    return goalsForThreads([threadId]).get(String(threadId || "")) || null;
  }

  function attachGoalToThread(thread) {
    if (!thread || typeof thread !== "object" || !thread.id) return thread;
    const goal = goalForThread(thread.id);
    if (goal) thread.goal = goal;
    return thread;
  }

  function attachGoalsToThreads(threads = []) {
    if (!Array.isArray(threads) || !threads.length) return threads;
    const byThreadId = goalsForThreads(threads.map((thread) => thread && thread.id));
    for (const thread of threads) {
      if (!thread || typeof thread !== "object") continue;
      const goal = byThreadId.get(String(thread.id || ""));
      if (goal) thread.goal = goal;
    }
    return threads;
  }

  function attachGoalsToThreadListResult(result) {
    if (!result || typeof result !== "object") return result;
    const arrays = [];
    if (Array.isArray(result.data)) arrays.push(result.data);
    if (Array.isArray(result.threads) && result.threads !== result.data) arrays.push(result.threads);
    const ids = collectThreadIds(arrays.flat());
    const byThreadId = goalsForThreads(ids);
    for (const threads of arrays) {
      for (const thread of threads) {
        if (!thread || typeof thread !== "object") continue;
        const goal = byThreadId.get(String(thread.id || ""));
        if (goal) thread.goal = goal;
      }
    }
    return result;
  }

  return {
    attachGoalToThread,
    attachGoalsToThreadListResult,
    attachGoalsToThreads,
    dbPath,
    getLastError: () => lastError,
    goalForThread,
    goalsForThreads,
  };
}

module.exports = {
  createThreadGoalService,
  normalizeThreadGoalStatus,
  publicThreadGoal,
};
