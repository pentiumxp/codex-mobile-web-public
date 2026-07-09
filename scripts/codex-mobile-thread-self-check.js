#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline");

const {
  analyzeThreadDetail,
  analyzeThreadList,
  combineSelfCheck,
  compareDetailReadbacks,
  compareThreadListRowToDetail,
  compareThreadListReadbacks,
  latestCompletedTurn,
  shortHash,
  summarizeTurn,
  threadRows,
} = require("../adapters/thread-detail-self-check-service");

function usage() {
  return [
    "Usage:",
    "  node scripts/codex-mobile-thread-self-check.js [options]",
    "",
    "Runs metadata-only Codex Mobile display-contract self checks against a running server.",
    "It checks thread list shape, detail refresh stability, latest completed turn Usage,",
    "timestamps, completed replay reasoning/operation rows, duplicate keys, and bounded",
    "response-budget evidence without printing message text, titles, task-card bodies,",
    "uploads, tokens, cookies, raw paths, or long logs.",
    "Repeated warnings and H1/H2 violations are also summarized as metadata-only",
    "diagnosticCandidates that can feed the Home AI Owner-gated repair loop.",
    "",
    "Options:",
    "  --server <url>             Codex Mobile server. Default: http://127.0.0.1:8787",
    "  --key-file <path>          Access key file. Default: $HOME/.codex-mobile-web/access_key",
    "  --thread-id <id>           Thread id to check. Repeatable.",
    "  --sample-threads <n>       Number of list rows to sample when no thread id is passed. Default: 3.",
    "  --list-limit <n>           Thread-list limit. Default: 30.",
    "  --workspace-cwd <path>     Optional workspace filter for /api/threads.",
    "  --repeat <n>               Repeat list/detail reads to catch refresh downgrades. Default: 2.",
    "  --repeat-delay-ms <n>      Delay between repeated reads. Default: 150.",
    "  --timeout-ms <n>           Request timeout. Default: 15000.",
    "  --raw-active-max-bytes <n> Max local rollout bytes for active-turn raw count checks. Default: 314572800.",
    "  --no-auth                  Do not send an auth key.",
    "  --json                     Print JSON only.",
    "  --help                     Show this help.",
  ].join("\n");
}

function readPositiveInt(value, fallback, max = 100000) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(max, Math.trunc(number));
}

function normalizeBaseUrl(value) {
  const url = new URL(value || "http://127.0.0.1:8787");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.toString();
}

function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    server: env.CODEX_MOBILE_BASE_URL || "http://127.0.0.1:8787",
    keyFile: env.CODEX_MOBILE_KEY_FILE || path.join(os.homedir(), ".codex-mobile-web", "access_key"),
    threadIds: [],
    sampleThreads: readPositiveInt(env.CODEX_MOBILE_SELF_CHECK_SAMPLE_THREADS || "3", 3, 20),
    listLimit: readPositiveInt(env.CODEX_MOBILE_SELF_CHECK_LIST_LIMIT || "30", 30, 200),
    workspaceCwd: "",
    repeat: readPositiveInt(env.CODEX_MOBILE_SELF_CHECK_REPEAT || "2", 2, 5),
    repeatDelayMs: readPositiveInt(env.CODEX_MOBILE_SELF_CHECK_REPEAT_DELAY_MS || "150", 150, 5000),
    timeoutMs: readPositiveInt(env.CODEX_MOBILE_SELF_CHECK_TIMEOUT_MS || "15000", 15000, 60000),
    rawActiveMaxBytes: readPositiveInt(env.CODEX_MOBILE_SELF_CHECK_RAW_ACTIVE_MAX_BYTES || "314572800", 314572800, 1073741824),
    noAuth: false,
    json: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`missing value for ${arg}`);
      return argv[index];
    };
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--server") options.server = next();
    else if (arg === "--key-file") options.keyFile = next();
    else if (arg === "--thread-id") options.threadIds.push(next());
    else if (arg === "--sample-threads") options.sampleThreads = readPositiveInt(next(), options.sampleThreads, 20);
    else if (arg === "--list-limit") options.listLimit = readPositiveInt(next(), options.listLimit, 500);
    else if (arg === "--workspace-cwd") options.workspaceCwd = next();
    else if (arg === "--repeat") options.repeat = readPositiveInt(next(), options.repeat, 5);
    else if (arg === "--repeat-delay-ms") options.repeatDelayMs = readPositiveInt(next(), options.repeatDelayMs, 5000);
    else if (arg === "--timeout-ms") options.timeoutMs = readPositiveInt(next(), options.timeoutMs, 60000);
    else if (arg === "--raw-active-max-bytes") options.rawActiveMaxBytes = readPositiveInt(next(), options.rawActiveMaxBytes, 1073741824);
    else if (arg === "--no-auth") options.noAuth = true;
    else if (arg === "--json") options.json = true;
    else throw new Error(`unknown option: ${arg}`);
  }
  options.server = normalizeBaseUrl(options.server);
  options.threadIds = options.threadIds.map((id) => String(id || "").trim()).filter(Boolean);
  options.workspaceCwd = String(options.workspaceCwd || "").trim();
  return options;
}

function readAccessKey(options = {}, env = process.env) {
  if (options.noAuth) return "";
  const inline = String(env.CODEX_MOBILE_KEY || env.CODEX_MOBILE_ACCESS_KEY || "").trim();
  if (inline) return inline;
  const key = fs.readFileSync(options.keyFile, "utf8").trim();
  if (!key) throw new Error("access key file is empty");
  return key;
}

function requestUrl(options, pathname, params = {}) {
  const url = new URL(pathname.replace(/^\//, ""), options.server);
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function fetchJson(url, options = {}, key = "") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const headers = {};
    if (key) headers.Authorization = `Bearer ${key}`;
    const response = await fetch(url, { headers, signal: controller.signal });
    const text = await response.text();
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch (_) {
      parsed = { raw: text.slice(0, 160) };
    }
    if (!response.ok) {
      const error = parsed && (parsed.error || parsed.message) || response.statusText || "request_failed";
      const err = new Error(`${response.status}:${String(error).slice(0, 120)}`);
      err.status = response.status;
      throw err;
    }
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function summarizePublicConfig(config = {}) {
  return {
    version: String(config.version || "").slice(0, 40),
    clientBuildId: String(config.clientBuildId || "").slice(0, 120),
    shellCacheName: String(config.shellCacheName || "").slice(0, 120),
    authRequired: config.authRequired === true,
  };
}

function safeThreadIds(ids) {
  return ids.map((id) => ({ threadHash: shortHash(id) }));
}

function text(value) {
  return String(value || "").trim();
}

function objectOrNull(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function threadId(row) {
  return text(row && (row.id || row.threadId || row.thread_id));
}

function statusText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && value.type) return text(value.type);
  return text(value);
}

function isActiveStatus(value) {
  return /active|running|started|pending|queued|processing|inprogress|in_progress|in-progress/i.test(statusText(value));
}

function activeTurnIdFromThreadRow(row = {}) {
  const localActive = objectOrNull(row.mobileLocalActiveStatus) || {};
  const status = objectOrNull(row.status) || {};
  return text(
    row.activeTurnId
    || row.active_turn_id
    || localActive.turnId
    || localActive.turn_id
    || status.turnId
    || status.turn_id,
  );
}

function rolloutPathFromThreadRow(row = {}) {
  const value = text(row.path || row.rolloutPath || row.rollout_path || row.sessionPath || row.session_path);
  if (!value || !path.isAbsolute(value)) return "";
  return value;
}

function selectThreadRefs(options, listResult) {
  const rows = threadRows(listResult);
  const rowsById = new Map(rows.map((row) => [threadId(row), row]).filter(([id]) => id));
  if (options.threadIds.length) {
    return options.threadIds.map((id) => ({ id, row: rowsById.get(id) || { id } }));
  }
  return rows
    .map((row) => ({ id: threadId(row), row }))
    .filter((ref) => ref.id)
    .slice(0, options.sampleThreads);
}

async function fetchThreadDetail(options, key, threadId, refreshIndex = 0) {
  const params = {
    mode: "recent",
    budget: "full",
  };
  if (refreshIndex > 0) params.forceRefresh = "1";
  return fetchJson(requestUrl(options, `/api/threads/${encodeURIComponent(threadId)}`, params), options, key);
}

function payloadOfJsonlEvent(event = {}) {
  return objectOrNull(event.payload) || event;
}

function jsonlEventType(event = {}) {
  return text(event.type || event.item_type || event.kind);
}

function turnIdFromTurnContextPayload(payload = {}) {
  return text(payload.turn_id || payload.turnId || payload.id || payload.turn);
}

function turnIdFromDetailTurn(turn = {}) {
  return text(turn && (turn.id || turn.turnId || turn.turn_id));
}

function rawPayloadType(payload = {}) {
  return text(payload.type || payload.item_type || payload.kind);
}

function rawPayloadRole(payload = {}) {
  return text(payload.role || payload.authorRole || payload.author);
}

function isRawUserInputPayload(eventType = "", payload = {}) {
  const type = rawPayloadType(payload).toLowerCase();
  const role = rawPayloadRole(payload).toLowerCase();
  if (eventType === "response_item" && type === "message" && role === "user") return true;
  if (eventType === "event_msg" && /^(user_message|user_input|input_message|submitted_user_message)$/.test(type)) return true;
  if (type === "message" && role === "user") return true;
  return false;
}

function isRawAssistantPayload(eventType = "", payload = {}) {
  const type = rawPayloadType(payload).toLowerCase();
  const role = rawPayloadRole(payload).toLowerCase();
  if (eventType === "response_item" && type === "message" && role === "assistant") return true;
  if (eventType === "event_msg" && type === "agent_message") return true;
  if (type === "message" && role === "assistant") return true;
  return false;
}

async function readRawTurnCounts(row = {}, turnId = "", options = {}) {
  const expectedTurnId = text(turnId);
  const rolloutPath = rolloutPathFromThreadRow(row);
  if (!expectedTurnId || !rolloutPath) return null;
  let stat = null;
  try {
    stat = fs.statSync(rolloutPath);
  } catch (_) {
    return null;
  }
  if (!stat || !stat.isFile()) return null;
  const maxBytes = Number(options.rawActiveMaxBytes) || 0;
  if (maxBytes > 0 && stat.size > maxBytes) return {
      checked: false,
      skippedReason: "rollout_too_large",
      threadHash: shortHash(threadId(row)),
      turnHash: shortHash(expectedTurnId),
      rolloutSizeBytes: stat.size,
    };

  const counts = {
    checked: true,
    found: false,
    threadHash: shortHash(threadId(row)),
    turnHash: shortHash(expectedTurnId),
    rawLineCount: 0,
    rawAssistantItems: 0,
    rawAgentMessageEvents: 0,
    rawUserItems: 0,
    rawUserLikeEvents: 0,
  };
  let currentTurnId = "";
  const input = fs.createReadStream(rolloutPath, { encoding: "utf8" });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (!line || !line.trim()) continue;
      let event = null;
      try {
        event = JSON.parse(line);
      } catch (_) {
        continue;
      }
      const payload = payloadOfJsonlEvent(event);
      const eventType = jsonlEventType(event);
      if (eventType === "turn_context") {
        currentTurnId = turnIdFromTurnContextPayload(payload);
      }
      if (currentTurnId !== expectedTurnId) continue;
      counts.found = true;
      counts.rawLineCount += 1;
      const payloadType = rawPayloadType(payload).toLowerCase();
      const payloadRole = rawPayloadRole(payload).toLowerCase();
      if (eventType === "response_item" && payloadType === "message" && payloadRole === "assistant") {
        counts.rawAssistantItems += 1;
      } else if (eventType === "response_item" && payloadType === "message" && payloadRole === "user") {
        counts.rawUserItems += 1;
      } else if (eventType === "event_msg" && payloadType === "agent_message") {
        counts.rawAgentMessageEvents += 1;
      }
      if (isRawUserInputPayload(eventType, payload)) counts.rawUserLikeEvents += 1;
    }
  } finally {
    lines.close();
  }
  return counts;
}

async function readRawActiveTurnCounts(row = {}, options = {}) {
  return readRawTurnCounts(row, activeTurnIdFromThreadRow(row), options);
}

function rawActiveCountSource(row = {}, detail = {}) {
  const thread = detailThread(detail);
  const detailActiveTurnId = activeTurnIdFromThreadRow(thread);
  const rowActiveTurnId = activeTurnIdFromThreadRow(row);
  return Object.assign({}, row || {}, {
    id: threadId(row) || threadId(thread),
    activeTurnId: detailActiveTurnId || rowActiveTurnId,
    active_turn_id: detailActiveTurnId || rowActiveTurnId,
    path: rolloutPathFromThreadRow(row) || rolloutPathFromThreadRow(thread),
    rolloutPath: rolloutPathFromThreadRow(row) || rolloutPathFromThreadRow(thread),
  });
}

function rawCountsForDetailComparison(beforeDetail = null, afterDetail = null) {
  const beforeUsable = beforeDetail && beforeDetail.checked === true && beforeDetail.found === true;
  const afterUsable = afterDetail && afterDetail.checked === true && afterDetail.found === true;
  const selected = beforeUsable ? beforeDetail : afterDetail;
  if (!selected || typeof selected !== "object") return selected;
  const result = Object.assign({}, selected);
  if (beforeUsable && afterUsable) {
    result.rawAssistantItemsBeforeDetail = beforeDetail.rawAssistantItems || 0;
    result.rawAssistantItemsAfterDetail = afterDetail.rawAssistantItems || 0;
    result.rawActiveGrewDuringDetailRead = result.rawAssistantItemsAfterDetail > result.rawAssistantItemsBeforeDetail;
  }
  return result;
}

function rawLatestCompletedCountSource(row = {}, detail = {}) {
  const thread = detailThread(detail);
  return Object.assign({}, row || {}, {
    id: threadId(row) || threadId(thread),
    path: rolloutPathFromThreadRow(row) || rolloutPathFromThreadRow(thread),
    rolloutPath: rolloutPathFromThreadRow(row) || rolloutPathFromThreadRow(thread),
  });
}

function detailThread(detail = {}) {
  return objectOrNull(detail.thread) || objectOrNull(detail) || {};
}

function findTurnById(thread = {}, expectedTurnId = "") {
  const id = text(expectedTurnId);
  if (!id) return null;
  return safeArray(thread.turns).find((turn) => text(turn && (turn.id || turn.turnId || turn.turn_id)) === id) || null;
}

function analyzeActiveTurnRawProjection(row = {}, detail = {}, rawCounts = null) {
  if (!rawCounts || rawCounts.checked !== true || rawCounts.found !== true) return null;
  const thread = detailThread(detail);
  const activeTurnId = activeTurnIdFromThreadRow(thread) || activeTurnIdFromThreadRow(row);
  if (!activeTurnId || rawCounts.rawAssistantItems <= 0) return null;
  const turn = findTurnById(thread, activeTurnId);
  if (!turn || !isActiveStatus(turn && turn.status)) return null;
  const summary = turn ? summarizeTurn(turn, thread) : null;
  const detailAssistantItems = summary ? summary.assistantItems : 0;
  const issues = [];
  const budget = objectOrNull(thread.mobileDetailResponseBudget) || {};
  const progressiveBudgetApplied = budget.progressiveActiveBudgetApplied === true;
  const retainedAssistantBudget = Math.max(
    Number(budget.progressiveReplayAssistantItems) || 0,
    Number(budget.activeAssistantItemsAfter) || 0,
  );
  const omittedAssistantItems = Number(budget.activeOmittedAssistantItems) || 0;
  const rawAssistantGap = Math.max(0, rawCounts.rawAssistantItems - detailAssistantItems);
  const budgetExplainsGap = Boolean(progressiveBudgetApplied
    && omittedAssistantItems > 0
    && retainedAssistantBudget > 0
    && detailAssistantItems >= retainedAssistantBudget
    && rawAssistantGap <= omittedAssistantItems
    && rawCounts.rawAssistantItems > detailAssistantItems);
  if (detailAssistantItems < rawCounts.rawAssistantItems && !budgetExplainsGap) {
    issues.push({
      code: "active_turn_assistant_projection_gap",
      severity: "H2",
      surface: "thread-detail-active-turn",
      threadHash: rawCounts.threadHash,
      turnHash: rawCounts.turnHash,
      rawAssistantItems: rawCounts.rawAssistantItems,
      detailAssistantItems,
    });
  }
  return {
    ok: issues.length === 0,
    threadHash: rawCounts.threadHash,
    turnHash: rawCounts.turnHash,
    rawAssistantItems: rawCounts.rawAssistantItems,
    detailAssistantItems,
    responseBudgetExplainsAssistantGap: budgetExplainsGap,
    issues,
  };
}

function rawAssistantItemCount(rawCounts = {}) {
  return Math.max(
    Number(rawCounts.rawAssistantItems || 0),
    Number(rawCounts.rawAgentMessageEvents || 0),
  );
}

function analyzeLatestCompletedRawProjection(row = {}, detail = {}, rawCounts = null) {
  if (!rawCounts || rawCounts.checked !== true || rawCounts.found !== true) return null;
  const thread = detailThread(detail);
  const latest = latestCompletedTurn(thread);
  if (!latest || !latest.turn) return null;
  const rawAssistantItems = rawAssistantItemCount(rawCounts);
  if (rawAssistantItems <= 0) return null;
  const summary = summarizeTurn(latest.turn, thread);
  const detailAssistantItems = summary ? summary.assistantItems : 0;
  const budget = objectOrNull(thread.mobileDetailResponseBudget) || {};
  const retainedAssistantBudget = Math.max(
    Number(budget.latestCompletedReplayAssistantItems) || 0,
    Number(budget.protectedCompletedReplayAssistantItems) || 0,
    Number(budget.richCompletedReplayAssistantItems) || 0,
  );
  const omittedAssistantItems = Math.max(
    Number(budget.latestCompletedReplayOmittedAssistantItems) || 0,
    Number(budget.protectedCompletedReplayOmittedAssistantItems) || 0,
    Number(budget.richCompletedReplayOmittedAssistantItems) || 0,
  );
  const rawAssistantGap = Math.max(0, rawAssistantItems - detailAssistantItems);
  const budgetExplainsGap = Boolean(
    omittedAssistantItems > 0
      && retainedAssistantBudget > 0
      && detailAssistantItems >= retainedAssistantBudget
      && rawAssistantGap <= omittedAssistantItems,
  );
  const issues = [];
  if (detailAssistantItems < rawAssistantItems && !budgetExplainsGap) {
    issues.push({
      code: "latest_completed_assistant_projection_gap",
      severity: "H2",
      surface: "thread-detail-latest-completed",
      threadHash: rawCounts.threadHash,
      turnHash: rawCounts.turnHash,
      rawAssistantItems,
      detailAssistantItems,
    });
  }
  return {
    ok: issues.length === 0,
    threadHash: rawCounts.threadHash,
    turnHash: rawCounts.turnHash,
    rawAssistantItems,
    detailAssistantItems,
    responseBudgetExplainsAssistantGap: budgetExplainsGap,
    issues,
  };
}

async function readRawLatestCompletedTurnCounts(row = {}, detail = {}, options = {}) {
  const thread = detailThread(detail);
  const latest = latestCompletedTurn(thread);
  const turnId = turnIdFromDetailTurn(latest && latest.turn);
  if (!turnId) return null;
  return readRawTurnCounts(rawLatestCompletedCountSource(row, detail), turnId, options);
}

function suppressRawProvenSystemInputMissingIssue(analysis = {}, rawCounts = null) {
  if (!analysis || !rawCounts || rawCounts.checked !== true || rawCounts.found !== true) return analysis;
  if (Number(rawCounts.rawUserItems || 0) > 0 || Number(rawCounts.rawUserLikeEvents || 0) > 0) return analysis;
  const issues = Array.isArray(analysis.issues) ? analysis.issues : [];
  const suppressed = [];
  const kept = issues.filter((issue) => {
    if (!issue || issue.code !== "latest_completed_user_input_missing") return true;
    if (text(issue.turnHash) !== text(rawCounts.turnHash)) return true;
    suppressed.push(Object.assign({}, issue, {
      suppressedReason: "raw_completed_turn_has_no_user_input",
      rawLineCount: rawCounts.rawLineCount || 0,
    }));
    return false;
  });
  if (!suppressed.length) return analysis;
  return Object.assign({}, analysis, {
    issues: kept,
    suppressedIssues: [
      ...(Array.isArray(analysis.suppressedIssues) ? analysis.suppressedIssues : []),
      ...suppressed,
    ],
    rawLatestCompletedInputEvidence: {
      checked: true,
      found: true,
      threadHash: rawCounts.threadHash,
      turnHash: rawCounts.turnHash,
      rawLineCount: rawCounts.rawLineCount || 0,
      rawUserItems: rawCounts.rawUserItems || 0,
      rawUserLikeEvents: rawCounts.rawUserLikeEvents || 0,
      rawAssistantItems: rawAssistantItemCount(rawCounts),
    },
  });
}

function rawLatestCompletedInputEvidence(rawCounts = null) {
  if (!rawCounts || typeof rawCounts !== "object") return null;
  const evidence = {
    checked: rawCounts.checked === true,
    found: rawCounts.found === true,
    threadHash: text(rawCounts.threadHash),
    turnHash: text(rawCounts.turnHash),
    rawLineCount: rawCounts.rawLineCount || 0,
    rawUserItems: rawCounts.rawUserItems || 0,
    rawUserLikeEvents: rawCounts.rawUserLikeEvents || 0,
    rawAssistantItems: rawAssistantItemCount(rawCounts),
  };
  if (rawCounts.skippedReason) evidence.skippedReason = text(rawCounts.skippedReason).slice(0, 80);
  if (rawCounts.rolloutSizeBytes) evidence.rolloutSizeBytes = rawCounts.rolloutSizeBytes;
  return evidence;
}

async function run(options = {}, env = process.env) {
  const key = readAccessKey(options, env);
  const report = {
    ok: false,
    privacy: "metadata_only",
    server: options.server,
    startedAt: new Date().toISOString(),
    publicConfig: null,
    checkedThreads: [],
    threadList: null,
    threadListRepeat: null,
    threadListRepeatChecks: [],
    threadDetails: [],
    summary: null,
  };
  const publicConfig = await fetchJson(requestUrl(options, "/api/public-config"), options, key);
  report.publicConfig = summarizePublicConfig(publicConfig);

  const listParams = { limit: options.listLimit };
  if (options.workspaceCwd) listParams.cwd = options.workspaceCwd;
  const listReads = [];
  const listFirst = await fetchJson(requestUrl(options, "/api/threads", listParams), options, key);
  listReads.push(listFirst);
  report.threadList = analyzeThreadList(listFirst);

  const listRepeatChecks = [];
  for (let index = 1; index < options.repeat; index += 1) {
    await sleep(options.repeatDelayMs);
    const nextList = await fetchJson(requestUrl(options, "/api/threads", listParams), options, key);
    listReads.push(nextList);
    const previousComparison = compareThreadListReadbacks(listReads[index - 1], nextList);
    if (previousComparison.issues.length) {
      listRepeatChecks.push(Object.assign({ index, baseline: "previous" }, previousComparison));
    }
    const firstComparison = compareThreadListReadbacks(listFirst, nextList);
    if (firstComparison.issues.length) {
      listRepeatChecks.push(Object.assign({ index, baseline: "first" }, firstComparison));
    }
  }
  if (options.repeat > 1) {
    report.threadListRepeat = compareThreadListReadbacks(listFirst, listReads[listReads.length - 1]);
    report.threadListRepeatChecks = listRepeatChecks;
  }

  const selectedThreadRefs = selectThreadRefs(options, listReads[listReads.length - 1] || listFirst);
  const selectedThreadIds = selectedThreadRefs.map((ref) => ref.id);
  report.checkedThreads = safeThreadIds(selectedThreadIds);

  for (const { id: threadId, row } of selectedThreadRefs) {
    const rawCountsBeforeFirstDetail = await readRawActiveTurnCounts(row, options);
    const firstDetail = await fetchThreadDetail(options, key, threadId, 0);
    const rawCountsAfterFirstDetail = await readRawActiveTurnCounts(rawActiveCountSource(row, firstDetail), options);
    const rawCountsForFirstDetail = rawCountsForDetailComparison(rawCountsBeforeFirstDetail, rawCountsAfterFirstDetail);
    const rawLatestCompletedCountsBeforeFirstDetail = await readRawLatestCompletedTurnCounts(row, firstDetail, options);
    const firstAnalysis = suppressRawProvenSystemInputMissingIssue(
      analyzeThreadDetail(firstDetail, { threadId }),
      rawLatestCompletedCountsBeforeFirstDetail,
    );
    const firstActiveRawProjection = analyzeActiveTurnRawProjection(row, firstDetail, rawCountsForFirstDetail);
    const firstLatestCompletedRawProjection = analyzeLatestCompletedRawProjection(
      row,
      firstDetail,
      rawLatestCompletedCountsBeforeFirstDetail,
    );
    const listDetailConsistency = compareThreadListRowToDetail(row, firstDetail);
    const detailReport = {
      threadHash: shortHash(threadId),
      first: firstAnalysis,
      activeTurnRawProjection: firstActiveRawProjection,
      latestCompletedRawProjection: firstLatestCompletedRawProjection,
      listDetailConsistency,
      rawLatestCompletedInputEvidence: firstAnalysis.rawLatestCompletedInputEvidence
        || rawLatestCompletedInputEvidence(rawLatestCompletedCountsBeforeFirstDetail),
      repeat: null,
    };
    if (options.repeat > 1) {
      const detailReads = [firstDetail];
      const repeatChecks = [];
      let lastDetail = firstDetail;
      let lastAnalysis = firstAnalysis;
      let lastRawLatestCompletedCounts = rawLatestCompletedCountsBeforeFirstDetail;
      for (let index = 1; index < options.repeat; index += 1) {
        await sleep(options.repeatDelayMs);
        const rawCountsBeforeNextDetail = await readRawActiveTurnCounts(rawActiveCountSource(row, lastDetail), options);
        const nextDetail = await fetchThreadDetail(options, key, threadId, index);
        const rawCountsAfterNextDetail = await readRawActiveTurnCounts(rawActiveCountSource(row, nextDetail), options);
        const rawCountsForNextDetail = rawCountsForDetailComparison(rawCountsBeforeNextDetail, rawCountsAfterNextDetail);
        const rawLatestCompletedCountsBeforeNextDetail = await readRawLatestCompletedTurnCounts(row, nextDetail, options);
        detailReads.push(nextDetail);
        const nextAnalysis = suppressRawProvenSystemInputMissingIssue(
          analyzeThreadDetail(nextDetail, { threadId }),
          rawLatestCompletedCountsBeforeNextDetail,
        );
        const nextActiveRawProjection = analyzeActiveTurnRawProjection(row, nextDetail, rawCountsForNextDetail);
        const nextLatestCompletedRawProjection = analyzeLatestCompletedRawProjection(
          row,
          nextDetail,
          rawLatestCompletedCountsBeforeNextDetail,
        );
        if (nextActiveRawProjection && nextActiveRawProjection.issues.length) {
          repeatChecks.push(Object.assign({ index, baseline: "raw-active-turn" }, nextActiveRawProjection));
        }
        if (nextLatestCompletedRawProjection && nextLatestCompletedRawProjection.issues.length) {
          repeatChecks.push(Object.assign({ index, baseline: "raw-latest-completed-turn" }, nextLatestCompletedRawProjection));
        }
        const previousComparison = compareDetailReadbacks(lastDetail, nextDetail, {
          threadId,
          rawLatestCompletedCounts: rawLatestCompletedCountsBeforeNextDetail,
        });
        if (previousComparison.issues.length) {
          repeatChecks.push(Object.assign({ index, baseline: "previous" }, previousComparison));
        }
        const firstComparison = compareDetailReadbacks(firstDetail, nextDetail, {
          threadId,
          rawLatestCompletedCounts: rawLatestCompletedCountsBeforeNextDetail,
        });
        if (firstComparison.issues.length) {
          repeatChecks.push(Object.assign({ index, baseline: "first" }, firstComparison));
        }
        lastDetail = nextDetail;
        lastAnalysis = nextAnalysis;
        lastRawLatestCompletedCounts = rawLatestCompletedCountsBeforeNextDetail;
      }
      detailReport.second = lastAnalysis;
      detailReport.repeat = compareDetailReadbacks(firstDetail, lastDetail, {
        threadId,
        rawLatestCompletedCounts: lastRawLatestCompletedCounts,
      });
      detailReport.repeatChecks = repeatChecks;
    }
    report.threadDetails.push(detailReport);
  }

  const detailParts = [];
  for (const detail of report.threadDetails) {
    if (detail.first) detailParts.push(detail.first);
    if (detail.activeTurnRawProjection) detailParts.push(detail.activeTurnRawProjection);
    if (detail.latestCompletedRawProjection) detailParts.push(detail.latestCompletedRawProjection);
    if (detail.listDetailConsistency) detailParts.push(detail.listDetailConsistency);
    if (detail.second) detailParts.push(detail.second);
    if (detail.repeat) detailParts.push(detail.repeat);
    if (Array.isArray(detail.repeatChecks)) detailParts.push(...detail.repeatChecks);
  }
  report.summary = combineSelfCheck({
    threadList: report.threadList,
    threadListRepeat: report.threadListRepeat,
    threadListRepeatChecks: report.threadListRepeatChecks,
    details: detailParts,
  });
  report.ok = report.summary.ok;
  return report;
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const report = await run(options);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`${err && err.message ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  run,
  summarizePublicConfig,
};
