"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { runSqliteExec, runSqliteJson } = require("./sqlite-cli");

const USAGE_KEYS = [
  "totalTokens",
  "inputTokens",
  "cachedInputTokens",
  "outputTokens",
  "reasoningOutputTokens",
];

const MOJIBAKE_PATH_SEGMENTS = new Map([
  ["ϵͳ¹¤¾ß", "系统工具"],
]);

function sqlString(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
}

function normalizeFsPath(value) {
  return String(value || "").trim().replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
}

function pathSegments(value) {
  return String(value || "").trim().replace(/^\\\\\?\\/, "").split(/[\\/]+/).filter(Boolean);
}

function replacePathSegments(value, replacer) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.split(/([\\/]+)/).map((part) => replacer(part)).join("");
}

function repairKnownMojibakePath(value) {
  return replacePathSegments(value, (segment) => MOJIBAKE_PATH_SEGMENTS.get(segment) || segment);
}

function knownMojibakeVariants(value) {
  const text = String(value || "").trim();
  const variants = new Set([text, repairKnownMojibakePath(text)].filter(Boolean));
  for (const [bad, good] of MOJIBAKE_PATH_SEGMENTS.entries()) {
    if (text.includes(good)) variants.add(text.split(good).join(bad));
  }
  return [...variants].filter(Boolean);
}

function workspaceAliasMap(workspaceCwds = []) {
  const map = new Map();
  for (const cwd of workspaceCwds || []) {
    const canonical = String(cwd || "").trim();
    if (!canonical) continue;
    for (const variant of knownMojibakeVariants(canonical)) {
      const key = normalizeFsPath(variant);
      if (key) map.set(key, canonical);
    }
  }
  return map;
}

function canonicalWorkspaceCwd(value, aliasMap = new Map()) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const rawKey = normalizeFsPath(raw);
  if (rawKey && aliasMap.has(rawKey)) return aliasMap.get(rawKey);
  const repaired = repairKnownMojibakePath(raw);
  const repairedKey = normalizeFsPath(repaired);
  if (repairedKey && aliasMap.has(repairedKey)) return aliasMap.get(repairedKey);
  return repaired || raw;
}

function localDateKey(timestampMs) {
  const value = Number(timestampMs);
  const date = new Date(Number.isFinite(value) && value > 0 ? value : Date.now());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekStartDateKey(nowMs) {
  const date = new Date(Number(nowMs) || Date.now());
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return localDateKey(date.getTime());
}

function normalizeUsage(usage) {
  const source = usage && typeof usage === "object" ? usage : {};
  const out = {};
  for (const key of USAGE_KEYS) out[key] = sqlNumber(source[key]);
  if (!out.totalTokens && (out.inputTokens || out.outputTokens || out.reasoningOutputTokens)) {
    out.totalTokens = out.inputTokens + out.outputTokens + out.reasoningOutputTokens;
  }
  return out;
}

function usageFromTurnSummary(summary) {
  if (!summary || typeof summary !== "object") return normalizeUsage(null);
  return normalizeUsage(summary.turnTokenUsage || summary.lastTokenUsage || summary.finalTokenUsage || null);
}

function usageHasTokens(usage) {
  return USAGE_KEYS.some((key) => sqlNumber(usage && usage[key]) > 0);
}

function rowUsage(row) {
  return {
    totalTokens: sqlNumber(row && row.total_tokens),
    inputTokens: sqlNumber(row && row.input_tokens),
    cachedInputTokens: sqlNumber(row && row.cached_input_tokens),
    outputTokens: sqlNumber(row && row.output_tokens),
    reasoningOutputTokens: sqlNumber(row && row.reasoning_output_tokens),
  };
}

function publicUsage(row) {
  return {
    totalTokens: sqlNumber(row && row.total_tokens),
    todayTokens: sqlNumber(row && row.today_tokens),
    weekTokens: sqlNumber(row && row.week_tokens),
    inputTokens: sqlNumber(row && row.input_tokens),
    cachedInputTokens: sqlNumber(row && row.cached_input_tokens),
    outputTokens: sqlNumber(row && row.output_tokens),
    reasoningOutputTokens: sqlNumber(row && row.reasoning_output_tokens),
  };
}

function dailyRows(rows) {
  return (rows || []).map((row) => Object.assign({ date: String(row && row.day || "") }, rowUsage(row)))
    .filter((row) => row.date);
}

function addUsage(target, row) {
  for (const key of USAGE_KEYS) target[key] = sqlNumber(target[key]) + sqlNumber(row && row[key]);
  target.todayTokens = sqlNumber(target.todayTokens) + sqlNumber(row && row.todayTokens);
  target.weekTokens = sqlNumber(target.weekTokens) + sqlNumber(row && row.weekTokens);
}

function workspaceRows(rows, options = {}) {
  const aliases = workspaceAliasMap(options.workspaceCwds || []);
  const byCwd = new Map();
  for (const row of rows || []) {
    const cwd = canonicalWorkspaceCwd(row && row.cwd, aliases);
    if (!cwd) continue;
    if (!byCwd.has(cwd)) {
      byCwd.set(cwd, {
        cwd,
        totalTokens: 0,
        todayTokens: 0,
        weekTokens: 0,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningOutputTokens: 0,
      });
    }
    addUsage(byCwd.get(cwd), publicUsage(row));
  }
  return [...byCwd.values()].sort((a, b) => b.totalTokens - a.totalTokens);
}

function createTokenUsageStatsService(options = {}) {
  const dbPath = String(options.dbPath || "").trim();
  const sqlite = options.sqlite || { exec: runSqliteExec, json: runSqliteJson };
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  let initialized = false;
  let lastError = null;

  function init() {
    if (initialized) return true;
    if (!dbPath) {
      lastError = new Error("token usage db path is required");
      return false;
    }
    try {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    } catch (err) {
      lastError = err;
      return false;
    }
    const schema = `
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS token_usage_turns (
  thread_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  cwd TEXT NOT NULL DEFAULT '',
  day TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_output_tokens INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'turn_completed',
  PRIMARY KEY (thread_id, turn_id)
);
CREATE INDEX IF NOT EXISTS idx_token_usage_turns_day ON token_usage_turns(day);
CREATE INDEX IF NOT EXISTS idx_token_usage_turns_thread_day ON token_usage_turns(thread_id, day);
CREATE INDEX IF NOT EXISTS idx_token_usage_turns_cwd_day ON token_usage_turns(cwd, day);
`;
    const result = sqlite.exec(dbPath, schema, { timeoutMs: 5000, maxBuffer: 1024 * 1024 });
    if (!result || !result.ok) {
      lastError = result && result.error ? result.error : new Error("sqlite schema initialization failed");
      return false;
    }
    initialized = true;
    lastError = null;
    return true;
  }

  function recordTurnUsage(input = {}) {
    if (!init()) return { ok: false, error: lastError };
    const threadId = String(input.threadId || "").trim();
    const turnId = String(input.turnId || "").trim();
    if (!threadId || !turnId) return { ok: false, skipped: true, reason: "missing-thread-or-turn" };
    const usage = normalizeUsage(input.usage || usageFromTurnSummary(input.usageSummary));
    if (!usageHasTokens(usage)) return { ok: false, skipped: true, reason: "empty-usage" };
    const completedAtMs = Number(input.completedAtMs) || Number(input.timestampMs) || now();
    const day = localDateKey(completedAtMs);
    const cwd = canonicalWorkspaceCwd(input.cwd || "", workspaceAliasMap(input.workspaceCwds || []));
    const model = String(input.model || input.usageSummary && input.usageSummary.model || "").trim();
    const source = String(input.source || "turn_completed").trim() || "turn_completed";
    const sql = `
INSERT INTO token_usage_turns (
  thread_id, turn_id, cwd, day, updated_at_ms,
  total_tokens, input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens,
  model, source
) VALUES (
  ${sqlString(threadId)}, ${sqlString(turnId)}, ${sqlString(cwd)}, ${sqlString(day)}, ${sqlNumber(completedAtMs)},
  ${usage.totalTokens}, ${usage.inputTokens}, ${usage.cachedInputTokens}, ${usage.outputTokens}, ${usage.reasoningOutputTokens},
  ${sqlString(model)}, ${sqlString(source)}
)
ON CONFLICT(thread_id, turn_id) DO UPDATE SET
  cwd=excluded.cwd,
  day=excluded.day,
  updated_at_ms=excluded.updated_at_ms,
  total_tokens=excluded.total_tokens,
  input_tokens=excluded.input_tokens,
  cached_input_tokens=excluded.cached_input_tokens,
  output_tokens=excluded.output_tokens,
  reasoning_output_tokens=excluded.reasoning_output_tokens,
  model=excluded.model,
  source=excluded.source;
`;
    const result = sqlite.exec(dbPath, sql, { timeoutMs: 5000, maxBuffer: 1024 * 1024 });
    if (!result || !result.ok) {
      lastError = result && result.error ? result.error : new Error("sqlite token usage upsert failed");
      return { ok: false, error: lastError };
    }
    lastError = null;
    return { ok: true, threadId, turnId, day, usage };
  }

  function queryRows(sql) {
    if (!init()) return [];
    const result = sqlite.json(dbPath, sql, { timeoutMs: 5000, maxBuffer: 8 * 1024 * 1024 });
    if (!result || !result.ok) {
      lastError = result && result.error ? result.error : new Error("sqlite token usage query failed");
      return [];
    }
    lastError = null;
    return Array.isArray(result.rows) ? result.rows : [];
  }

  function buildWorkspaceWhere(cwd, optionsForQuery = {}) {
    const canonical = canonicalWorkspaceCwd(cwd, workspaceAliasMap(optionsForQuery.workspaceCwds || []));
    const variants = knownMojibakeVariants(canonical || cwd);
    const values = [...new Set(variants.map((value) => String(value || "").trim()).filter(Boolean))];
    if (!values.length) return "";
    return `WHERE lower(cwd) IN (${values.map((value) => `lower(${sqlString(value)})`).join(",")})`;
  }

  function summaryForThreads(threadIds = [], optionsForQuery = {}) {
    const ids = [...new Set((threadIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
    if (!ids.length) return { byThreadId: new Map(), workspace: workspaceSummary(optionsForQuery) };
    const today = localDateKey(optionsForQuery.nowMs || now());
    const weekStart = weekStartDateKey(optionsForQuery.nowMs || now());
    const quotedIds = ids.map(sqlString).join(",");
    const rows = queryRows(`
SELECT
  thread_id,
  SUM(total_tokens) AS total_tokens,
  SUM(CASE WHEN day = ${sqlString(today)} THEN total_tokens ELSE 0 END) AS today_tokens,
  SUM(CASE WHEN day >= ${sqlString(weekStart)} THEN total_tokens ELSE 0 END) AS week_tokens,
  SUM(input_tokens) AS input_tokens,
  SUM(cached_input_tokens) AS cached_input_tokens,
  SUM(output_tokens) AS output_tokens,
  SUM(reasoning_output_tokens) AS reasoning_output_tokens
FROM token_usage_turns
WHERE thread_id IN (${quotedIds})
GROUP BY thread_id
`);
    const byThreadId = new Map();
    for (const row of rows) byThreadId.set(String(row.thread_id || ""), publicUsage(row));
    return { byThreadId, workspace: workspaceSummary(optionsForQuery) };
  }

  function workspaceSummary(optionsForQuery = {}) {
    const nowMs = Number(optionsForQuery.nowMs) || now();
    const today = localDateKey(nowMs);
    const weekStart = weekStartDateKey(nowMs);
    const where = buildWorkspaceWhere(optionsForQuery.cwd || "", optionsForQuery);
    const workspaceLimit = Math.max(1, Math.min(200, Number(optionsForQuery.workspaceLimit || 50)));
    const rows = queryRows(`
SELECT
  SUM(total_tokens) AS total_tokens,
  SUM(CASE WHEN day = ${sqlString(today)} THEN total_tokens ELSE 0 END) AS today_tokens,
  SUM(CASE WHEN day >= ${sqlString(weekStart)} THEN total_tokens ELSE 0 END) AS week_tokens,
  SUM(input_tokens) AS input_tokens,
  SUM(cached_input_tokens) AS cached_input_tokens,
  SUM(output_tokens) AS output_tokens,
  SUM(reasoning_output_tokens) AS reasoning_output_tokens
FROM token_usage_turns
${where}
`);
    const daily = dailyRows(queryRows(`
SELECT
  day,
  SUM(total_tokens) AS total_tokens,
  SUM(input_tokens) AS input_tokens,
  SUM(cached_input_tokens) AS cached_input_tokens,
  SUM(output_tokens) AS output_tokens,
  SUM(reasoning_output_tokens) AS reasoning_output_tokens
FROM token_usage_turns
${where}
GROUP BY day
ORDER BY day DESC
LIMIT ${Math.max(1, Math.min(366, Number(optionsForQuery.days || 31)))}
`));
    const workspaces = workspaceRows(queryRows(`
SELECT
  cwd,
  SUM(total_tokens) AS total_tokens,
  SUM(CASE WHEN day = ${sqlString(today)} THEN total_tokens ELSE 0 END) AS today_tokens,
  SUM(CASE WHEN day >= ${sqlString(weekStart)} THEN total_tokens ELSE 0 END) AS week_tokens,
  SUM(input_tokens) AS input_tokens,
  SUM(cached_input_tokens) AS cached_input_tokens,
  SUM(output_tokens) AS output_tokens,
  SUM(reasoning_output_tokens) AS reasoning_output_tokens
FROM token_usage_turns
WHERE length(trim(cwd)) > 0
GROUP BY cwd
ORDER BY total_tokens DESC
LIMIT ${workspaceLimit}
`), optionsForQuery).slice(0, workspaceLimit);
    return Object.assign(publicUsage(rows[0] || {}), {
      todayDate: today,
      weekStartDate: weekStart,
      daily,
      workspaces,
    });
  }

  function decorateThreadListResult(result, optionsForQuery = {}) {
    if (!result || typeof result !== "object") return result;
    const threads = Array.isArray(result.data)
      ? result.data
      : Array.isArray(result.threads)
        ? result.threads
        : [];
    const { byThreadId, workspace } = summaryForThreads(threads.map((thread) => thread && thread.id), optionsForQuery);
    for (const thread of threads) {
      const usage = byThreadId.get(String(thread && thread.id || ""));
      if (usage) thread.mobileTokenUsage = usage;
    }
    result.mobileTokenUsage = Object.assign({ threadCount: byThreadId.size }, workspace);
    return result;
  }

  return {
    dbPath,
    decorateThreadListResult,
    getLastError: () => lastError,
    init,
    localDateKey,
    recordTurnUsage,
    workspaceSummary,
  };
}

module.exports = {
  createTokenUsageStatsService,
  repairKnownMojibakePath,
  localDateKey,
  normalizeUsage,
  usageFromTurnSummary,
  weekStartDateKey,
};
