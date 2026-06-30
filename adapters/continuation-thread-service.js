"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function missingDependency(name) {
  return () => { throw new Error(`Missing continuation thread service dependency: ${name}`); };
}

function createContinuationThreadService(deps = {}) {
  const env = deps.env || process.env;
  const compactWorkspaceContext = deps.compactWorkspaceContext || (() => null);
  const logContinuation = deps.logContinuation || (() => {});
  const codexRequest = deps.codexRequest || (async () => { throw new Error("Missing continuation thread service dependency: codexRequest"); });
  const codex = { request: (...args) => codexRequest(...args) };
  const readGlobalState = deps.readGlobalState || (() => ({}));
  const visibilityFromGlobalState = deps.visibilityFromGlobalState || (() => ({ workspaceKeys: new Set() }));
  const ensureWorkspaceVisible = typeof deps.ensureWorkspaceVisible === "function"
    ? deps.ensureWorkspaceVisible
    : null;
  const normalizeFsPath = deps.normalizeFsPath || ((value) => path.resolve(String(value || "")).toLowerCase());
  const readStateDbThread = deps.readStateDbThread || (() => null);
  const readStartedThread = deps.readStartedThread || (() => null);
  const readThreadSummaryFromAppServer = deps.readThreadSummaryFromAppServer || missingDependency("readThreadSummaryFromAppServer");
  const isHiddenThread = deps.isHiddenThread || (() => false);
  const annotateThreadRolloutStats = deps.annotateThreadRolloutStats || ((thread) => thread);
  const threadRuntimeSettings = deps.threadRuntimeSettings || (() => null);
  const sortTurnsChronologically = deps.sortTurnsChronologically || ((turns) => Array.isArray(turns) ? turns : []);
  const compactTurn = deps.compactTurn || ((turn) => turn);
  const rolloutPathForThread = deps.rolloutPathForThread || (() => "");
  const rolloutStatsForPath = deps.rolloutStatsForPath || (() => null);
  const truncateMiddle = deps.truncateMiddle || ((value) => String(value || ""));
  const truncateTail = deps.truncateTail || ((value) => String(value || ""));
  const compactStructured = deps.compactStructured || ((value) => value);
  const isContextCompactionType = deps.isContextCompactionType || (() => false);
  const isWebSearchLikeItem = deps.isWebSearchLikeItem || (() => false);
  const isOperationalItem = deps.isOperationalItem || (() => false);
  const statusText = deps.statusText || ((status) => typeof status === "string" ? status : status && status.type || "");
  const publicRuntimeSettings = deps.publicRuntimeSettings || (() => ({}));
  const applyTurnRuntimeSettings = deps.applyTurnRuntimeSettings || ((params) => params);
  const applyResumeRuntimeSettings = deps.applyResumeRuntimeSettings || ((params) => params);
  const applyStartThreadRuntimeSettings = deps.applyStartThreadRuntimeSettings || ((params) => params);
  const applyPermissionModeOverride = deps.applyPermissionModeOverride || ((settings) => settings || {});
  const readStartThreadDeveloperInstructions = deps.readStartThreadDeveloperInstructions || (() => "");
  const threadIdFromStartResult = deps.threadIdFromStartResult || (() => "");
  const notifyLocalTurnStarted = deps.notifyLocalTurnStarted || (() => {});
  const persistThreadTitleToSessionIndex = deps.persistThreadTitleToSessionIndex || (() => false);
  const tryUpdateThreadTitle = deps.tryUpdateThreadTitle || (async () => false);
  const archiveVisibleThread = deps.archiveVisibleThread || (async () => ({ archived: false }));
  const mobileArchivedFallbackResult = deps.mobileArchivedFallbackResult || (() => ({ archived: false }));
  const rememberStartedThread = deps.rememberStartedThread || ((thread) => thread);
  const currentThreadGoalForAction = deps.currentThreadGoalForAction || (async () => null);
  const setThreadGoalRpc = deps.setThreadGoalRpc || (async () => ({}));
  const threadGoalSetParams = deps.threadGoalSetParams || ((threadId, objective, tokenBudget, extra = {}) => Object.assign({ threadId, objective, tokenBudget }, extra));
  const threadGoalFromRpcResult = deps.threadGoalFromRpcResult || ((result) => result && result.goal || result);
  const normalizeThreadGoalStatus = deps.normalizeThreadGoalStatus || ((status) => String(status || ""));
  const isThreadGoalRpcUnsupportedError = deps.isThreadGoalRpcUnsupportedError || (() => false);
  const continuationGoalMigrationPlan = deps.continuationGoalMigrationPlan || (() => ({ migrate: false }));
  const httpStatusError = deps.httpStatusError || ((statusCode, message) => { const err = new Error(message); err.statusCode = statusCode; return err; });
  const READ_RPC_TIMEOUT_MS = Number(deps.readRpcTimeoutMs || 12000);
  const THREAD_DETAIL_RPC_TIMEOUT_MS = Number(deps.threadDetailRpcTimeoutMs || Math.min(6000, READ_RPC_TIMEOUT_MS));
  const MUTATION_RPC_TIMEOUT_MS = Number(deps.mutationRpcTimeoutMs || 120000);
  const contextCompaction = deps.contextCompaction || {};
  const MAX_CONTINUATION_BOOTSTRAP_CHARS = Math.max(4_000, Number(env.CODEX_MOBILE_CONTINUATION_BOOTSTRAP_CHARS || "12000"));
  const CONTINUATION_SOURCE_HANDOFF_EXCERPT_CHARS = Math.max(2_000, Number(env.CODEX_MOBILE_CONTINUATION_SOURCE_HANDOFF_EXCERPT_CHARS || "12000"));
  const CONTINUATION_SOURCE_HANDOFF_STORED_CHARS = Math.max(CONTINUATION_SOURCE_HANDOFF_EXCERPT_CHARS, Number(env.CODEX_MOBILE_CONTINUATION_SOURCE_HANDOFF_STORED_CHARS || "18000"));
  const CONTINUATION_WORKSPACE_PROJECT_CONTEXT_CHARS = Math.max(4_000, Number(env.CODEX_MOBILE_CONTINUATION_WORKSPACE_PROJECT_CONTEXT_CHARS || "18000"));
  const CONTINUATION_WORKSPACE_HANDOFF_TAIL_CHARS = Math.max(4_000, Number(env.CODEX_MOBILE_CONTINUATION_WORKSPACE_HANDOFF_TAIL_CHARS || "18000"));
  const CONTINUATION_ITEM_SUMMARY_CHARS = Math.max(300, Number(env.CODEX_MOBILE_CONTINUATION_ITEM_SUMMARY_CHARS || "1200"));
  const CONTINUATION_TURN_SUMMARY_ITEMS = Math.max(1, Math.min(8, Number(env.CODEX_MOBILE_CONTINUATION_TURN_SUMMARY_ITEMS || "4")));
  const CONTINUATION_RECENT_TURNS = Math.max(1, Math.min(30, Number(env.CODEX_MOBILE_CONTINUATION_RECENT_TURNS || "12")));
  const CONTINUATION_HANDOFF_TIMEOUT_MS = Math.max(30_000, Number(env.CODEX_MOBILE_CONTINUATION_HANDOFF_TIMEOUT_MS || "240000"));
  const CONTINUATION_LATE_HANDOFF_TIMEOUT_MS = Math.max(30_000, Number(env.CODEX_MOBILE_CONTINUATION_LATE_HANDOFF_TIMEOUT_MS || "600000"));
  const CONTINUATION_REUSE_HANDOFF_MS = Math.max(0, Number(env.CODEX_MOBILE_CONTINUATION_REUSE_HANDOFF_MS || "1800000"));
  const CONTINUATION_HANDOFF_MIN_CHARS = Math.max(120, Number(env.CODEX_MOBILE_CONTINUATION_HANDOFF_MIN_CHARS || "400"));
  const CONTINUATION_HANDOFF_TURN_COMPLETION_TIMEOUT_MS = Math.max(5_000, Number(env.CODEX_MOBILE_CONTINUATION_HANDOFF_TURN_COMPLETION_TIMEOUT_MS || "60000"));
  const CONTINUATION_JOB_TTL_MS = Math.max(60_000, Number(env.CODEX_MOBILE_CONTINUATION_JOB_TTL_MS || "1800000"));
  const CONTINUATION_JOB_MAX = Math.max(10, Number(env.CODEX_MOBILE_CONTINUATION_JOB_MAX || "50"));
  const CONTINUATION_LINEAGE_MAX_DEPTH = Math.max(0, Math.min(5, Number(env.CODEX_MOBILE_CONTINUATION_LINEAGE_MAX_DEPTH || "2")));
  const CONTINUATION_LINEAGE_MAX_CHARS = Math.max(2_000, Number(env.CODEX_MOBILE_CONTINUATION_LINEAGE_MAX_CHARS || "12000"));
  const CONTINUATION_CONTEXT_FILE_COMPACT_BYTES = Math.max(50 * 1024, Number(contextCompaction.thresholdBytes || env.CODEX_MOBILE_CONTINUATION_CONTEXT_FILE_COMPACT_BYTES || String(100 * 1024)));
  const CONTINUATION_CONTEXT_PAIR_COMPACT_BYTES = Math.max(CONTINUATION_CONTEXT_FILE_COMPACT_BYTES, Number(contextCompaction.combinedThresholdBytes || env.CODEX_MOBILE_CONTINUATION_CONTEXT_PAIR_COMPACT_BYTES || String(200 * 1024)));
  const CONTINUATION_CONTEXT_COMPACT_PRESERVE_CHARS = Math.max(6_000, Number(contextCompaction.preserveChars || env.CODEX_MOBILE_CONTINUATION_CONTEXT_COMPACT_PRESERVE_CHARS || "18000"));
  const continuationJobs = new Map();
  const activeContinuationJobsBySource = new Map();

function shortThreadTitle(value, fallback = "Codex Mobile") {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+(?:续\s*)?\d{2}-\d{2}(?:\s+\d{2}:\d{2})?$/u, "");
  return (text || fallback).slice(0, 72);
}

function localTitleDate(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

function newThreadTitle({ cwd, sourceThreadTitle }) {
  const base = shortThreadTitle(sourceThreadTitle, path.basename(String(cwd || "").replace(/^\\\\\?\\/, "")) || "Codex Mobile");
  return `${base} ${localTitleDate()}`;
}

function continuationTitleCandidate(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || /^#\s/.test(text)) return "";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) return "";
  return text;
}

function sourceTitleForContinuation(sourceSnapshot, requestedTitle, cwd) {
  const summary = sourceSnapshot && sourceSnapshot.summary && typeof sourceSnapshot.summary === "object"
    ? sourceSnapshot.summary
    : {};
  const fallback = path.basename(String(cwd || "").replace(/^\\\\\?\\/, "")) || "Codex Mobile";
  for (const value of [requestedTitle, summary.name, summary.title, summary.preview]) {
    const candidate = continuationTitleCandidate(value);
    if (candidate) return candidate;
  }
  return fallback;
}

function formatByteCount(bytes) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const precision = unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

function readWorkspaceContextFile(cwd, relativePath, maxChars) {
  const workspace = String(cwd || "").trim();
  const file = workspace ? path.join(workspace, ...String(relativePath || "").split(/[\\/]+/).filter(Boolean)) : "";
  if (!file) {
    return { relativePath, path: "", exists: false, text: "", error: "Workspace path is empty" };
  }
  try {
    const text = fs.readFileSync(file, "utf8");
    return {
      relativePath,
      path: file,
      exists: true,
      text: truncateMiddle(text, maxChars, relativePath),
    };
  } catch (err) {
    return {
      relativePath,
      path: file,
      exists: false,
      text: "",
      error: err && err.code === "ENOENT" ? "missing" : (err.message || String(err)),
    };
  }
}

function continuationWorkspaceContextSections(cwd) {
  const project = readWorkspaceContextFile(cwd, ".agent-context/PROJECT_CONTEXT.md", CONTINUATION_WORKSPACE_PROJECT_CONTEXT_CHARS);
  const handoff = readWorkspaceContextFile(cwd, ".agent-context/HANDOFF.md", CONTINUATION_WORKSPACE_HANDOFF_TAIL_CHARS * 2);
  const sections = [];
  if (project.exists) {
    sections.push(`### .agent-context/PROJECT_CONTEXT.md\n${project.text}`);
  } else {
    sections.push(`### .agent-context/PROJECT_CONTEXT.md\nUnavailable: ${project.error || "missing"} (${project.path})`);
  }
  if (handoff.exists) {
    sections.push(`### .agent-context/HANDOFF.md latest tail\n${truncateTail(handoff.text, CONTINUATION_WORKSPACE_HANDOFF_TAIL_CHARS, ".agent-context/HANDOFF.md")}`);
  } else {
    sections.push(`### .agent-context/HANDOFF.md\nUnavailable: ${handoff.error || "missing"} (${handoff.path})`);
  }
  return sections.join("\n\n");
}

function continuationContentPartText(part) {
  if (part == null) return "";
  if (typeof part === "string") return part;
  if (typeof part !== "object") return String(part);
  const type = String(part.type || "");
  if (typeof part.text === "string") return part.text;
  if (typeof part.path === "string") return `[${type || "file"}: ${part.path}]`;
  if (typeof part.url === "string" && /^data:image\//i.test(part.url)) return `[${type || "image"}: inline image omitted]`;
  if (typeof part.url === "string") return `[${type || "url"}: ${part.url}]`;
  if (typeof part.image_url === "string") return `[${type || "image"}: ${part.image_url}]`;
  return truncateMiddle(JSON.stringify(compactStructured(part)), 1200, "input part");
}

function continuationItemText(item) {
  if (!item || typeof item !== "object") return "";
  if (typeof item.text === "string") return item.text;
  if (Array.isArray(item.content)) {
    return item.content.map(continuationContentPartText).filter(Boolean).join("\n");
  }
  if (Array.isArray(item.summary) && item.summary.length) return item.summary.join("\n");
  if (typeof item.mobileNotice === "string") return item.mobileNotice;
  if (item.command) return item.command;
  if (Array.isArray(item.fileNames) && item.fileNames.length) return item.fileNames.join(", ");
  if (item.tool) return item.tool;
  return "";
}

function continuationItemLabel(item) {
  if (!item || typeof item !== "object") return "item";
  if (item.type === "userMessage") return "User";
  if (item.type === "agentMessage") return "Codex";
  if (item.type === "plan") return "Plan";
  if (isContextCompactionType(item.type)) return "Context compaction";
  if (isWebSearchLikeItem(item)) return "Web Search";
  if (item.type === "commandExecution") return "Command";
  if (item.type === "fileChange") return "File change";
  if (item.type === "dynamicToolCall" || item.type === "mcpToolCall") return `Tool ${item.tool || item.name || ""}`.trim();
  return item.type || "item";
}

function continuationItemSummary(item) {
  if (!item || item.type === "reasoning") return "";
  const label = continuationItemLabel(item);
  const status = statusText(item.status);
  let text = continuationItemText(item);
  if (!text && (isOperationalItem(item) || item.result || item.arguments || item.contentItems)) {
    text = JSON.stringify(compactStructured({
      command: item.command || undefined,
      arguments: item.arguments || undefined,
      result: item.result || item.contentItems || undefined,
      fileNames: item.fileNames || undefined,
    }));
  }
  text = truncateMiddle(String(text || "").replace(/\r\n/g, "\n").trim(), CONTINUATION_ITEM_SUMMARY_CHARS, `${label} item`);
  return `- ${label}${status ? ` [${status}]` : ""}: ${text || "(no visible text)"}`;
}

function continuationTurnSummaries(turns) {
  if (!Array.isArray(turns) || !turns.length) return "No recent source turns were available from thread/turns/list.";
  return turns.map((turn, index) => {
    const items = Array.isArray(turn && turn.items) ? turn.items.filter((item) => item && item.type !== "reasoning") : [];
    const userItems = items.filter((item) => item.type === "userMessage");
    const otherItems = items.filter((item) => item.type !== "userMessage");
    const selected = userItems.concat(otherItems.slice(-CONTINUATION_TURN_SUMMARY_ITEMS));
    const omitted = Math.max(0, items.length - selected.length);
    const itemLines = selected.map(continuationItemSummary).filter(Boolean);
    if (omitted > 0) itemLines.unshift(`- ${omitted} older visible item(s) omitted from this turn summary.`);
    const title = `### Recent turn ${index + 1}: ${turn.id || "(no id)"}${statusText(turn.status) ? ` / ${statusText(turn.status)}` : ""}`;
    return `${title}\n${itemLines.length ? itemLines.join("\n") : "- No visible non-reasoning items."}`;
  }).join("\n\n");
}

function continuationSourceThreadSection(snapshot) {
  const summary = snapshot && snapshot.summary;
  const stats = summary ? rolloutStatsForPath(rolloutPathForThread(summary)) : null;
  const lines = [
    `- Source thread id: ${snapshot && snapshot.threadId ? snapshot.threadId : "(none supplied)"}`,
    `- Source thread title: ${(summary && (summary.name || summary.preview)) || (snapshot && snapshot.title) || "(unknown)"}`,
    `- Source cwd: ${(summary && summary.cwd) || "(unknown)"}`,
    `- Source rollout path: ${summary ? (rolloutPathForThread(summary) || "(unknown)") : "(unknown)"}`,
    `- Source rollout size: ${stats ? `${formatByteCount(stats.sizeBytes)} (${stats.sizeBytes} bytes)` : "(unknown)"}`,
    `- Source status: ${summary ? (statusText(summary.status) || "(unknown)") : "(unknown)"}`,
    `- Source updatedAt: ${summary && summary.updatedAt ? summary.updatedAt : "(unknown)"}`,
  ];
  if (snapshot && snapshot.readWarnings && snapshot.readWarnings.length) {
    lines.push(`- Source read warnings: ${snapshot.readWarnings.join("; ")}`);
  }
  return lines.join("\n");
}

async function continuationSourceSnapshot(sourceThreadId, sourceThreadTitle, visibility) {
  const threadId = String(sourceThreadId || "").trim();
  const snapshot = {
    threadId,
    title: String(sourceThreadTitle || "").trim(),
    summary: null,
    runtimeSettings: null,
    turns: [],
    readWarnings: [],
  };
  if (!threadId) return snapshot;
  let summary = readStateDbThread(threadId) || readStartedThread(threadId);
  if (!summary) {
    try {
      summary = await readThreadSummaryFromAppServer(codex, threadId);
    } catch (err) {
      snapshot.readWarnings.push(`thread/list summary failed: ${err.message || String(err)}`);
    }
  }
  if (summary && isHiddenThread(summary, visibility)) {
    snapshot.readWarnings.push("source thread is hidden, archived, deleted, or outside visible workspaces");
  } else if (summary) {
    snapshot.summary = annotateThreadRolloutStats(summary);
    snapshot.runtimeSettings = threadRuntimeSettings(threadId, snapshot.summary);
  }
  try {
    const turnsResult = await codex.request("thread/turns/list", {
      threadId,
      limit: CONTINUATION_RECENT_TURNS,
      sortDirection: "desc",
    }, { timeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS, retry: false, resetOnTimeout: false });
    const data = Array.isArray(turnsResult && turnsResult.data)
      ? turnsResult.data
      : Array.isArray(turnsResult && turnsResult.turns)
        ? turnsResult.turns
        : [];
    snapshot.turns = sortTurnsChronologically(data).slice(-CONTINUATION_RECENT_TURNS).map((turn) => compactTurn(turn));
  } catch (err) {
    snapshot.readWarnings.push(`thread/turns/list failed: ${err.message || String(err)}`);
  }
  return snapshot;
}

function newThreadBootstrapInput(params) {
  return [{ type: "text", text: newThreadBootstrapPromptScoped(params), text_elements: [] }];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function continuationSafeFilePart(value, fallback = "thread") {
  return (String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)) || fallback;
}

function ensureContinuationHandoffIgnore(target) {
  if (!target || !target.dir) return;
  fs.mkdirSync(target.dir, { recursive: true });
  const ignoreFile = path.join(target.dir, ".gitignore");
  const block = [
    "# Codex Mobile Web runtime handoff files.",
    "# Keep generated continuation handoffs out of commits.",
    "*",
    "!.gitignore",
    "",
  ].join("\n");
  try {
    const existing = fs.existsSync(ignoreFile) ? fs.readFileSync(ignoreFile, "utf8") : "";
    if (existing.includes("Codex Mobile Web runtime handoff files")
      || /^\s*\*\s*$/m.test(existing)) {
      return;
    }
    fs.writeFileSync(ignoreFile, existing.trimEnd() ? `${existing.trimEnd()}\n\n${block}` : block, "utf8");
  } catch (err) {
    logContinuation("handoff-ignore-failed", { dir: target.dir, error: err.message || String(err) });
  }
}

function continuationLineageIndexPath(cwd) {
  return path.join(cwd || "", ".agent-context", "thread-handoffs", "index.jsonl");
}

function normalizeContinuationLineageEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const newThreadId = String(entry.newThreadId || "").trim();
  const sourceThreadId = String(entry.sourceThreadId || "").trim();
  if (!newThreadId || !sourceThreadId) return null;
  return {
    version: Number(entry.version || 1),
    createdAt: String(entry.createdAt || new Date().toISOString()),
    workspace: String(entry.workspace || ""),
    newThreadId,
    newThreadTitle: String(entry.newThreadTitle || ""),
    sourceThreadId,
    sourceThreadTitle: String(entry.sourceThreadTitle || ""),
    sourceRolloutPath: String(entry.sourceRolloutPath || ""),
    sourceRolloutSizeBytes: Number(entry.sourceRolloutSizeBytes || 0),
    handoffFile: String(entry.handoffFile || ""),
    handoffRelativePath: String(entry.handoffRelativePath || ""),
    handoffId: String(entry.handoffId || ""),
    handoffChars: Number(entry.handoffChars || 0),
    sourceArchived: Boolean(entry.sourceArchived),
    sourceArchiveError: String(entry.sourceArchiveError || ""),
    sourceGoalMigrated: Boolean(entry.sourceGoalMigrated),
    sourceGoalMigrationError: String(entry.sourceGoalMigrationError || ""),
  };
}

function readContinuationLineageEntries(cwd) {
  if (!cwd) return [];
  const indexPath = continuationLineageIndexPath(cwd);
  let text = "";
  try {
    text = fs.readFileSync(indexPath, "utf8");
  } catch (_) {
    return [];
  }
  return text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return normalizeContinuationLineageEntry(JSON.parse(line));
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

function appendContinuationLineageEntry(cwd, entry) {
  const normalized = normalizeContinuationLineageEntry(Object.assign({
    version: 1,
    createdAt: new Date().toISOString(),
    workspace: cwd || "",
  }, entry || {}));
  if (!cwd || !normalized) return null;
  const indexPath = continuationLineageIndexPath(cwd);
  const target = { dir: path.dirname(indexPath) };
  try {
    fs.mkdirSync(target.dir, { recursive: true });
    ensureContinuationHandoffIgnore(target);
    fs.appendFileSync(indexPath, `${JSON.stringify(normalized)}\n`, "utf8");
    logContinuation("lineage-written", {
      newThreadId: normalized.newThreadId,
      sourceThreadId: normalized.sourceThreadId,
      handoffFile: normalized.handoffFile,
    });
    return normalized;
  } catch (err) {
    logContinuation("lineage-write-failed", {
      newThreadId: normalized.newThreadId,
      sourceThreadId: normalized.sourceThreadId,
      error: err.message || String(err),
    });
    return null;
  }
}

function buildContinuationLineageChain(cwd, sourceThreadId, maxDepth = CONTINUATION_LINEAGE_MAX_DEPTH) {
  const entries = readContinuationLineageEntries(cwd);
  if (!entries.length || !sourceThreadId || maxDepth <= 0) return [];
  const byNewThreadId = new Map();
  for (const entry of entries) byNewThreadId.set(entry.newThreadId, entry);
  const chain = [];
  const seen = new Set();
  let currentThreadId = String(sourceThreadId || "").trim();
  while (currentThreadId && chain.length < maxDepth && !seen.has(currentThreadId)) {
    seen.add(currentThreadId);
    const entry = byNewThreadId.get(currentThreadId);
    if (!entry) break;
    chain.push(entry);
    currentThreadId = entry.sourceThreadId;
  }
  return chain;
}

function continuationLineageHandoffExcerpt(entry, maxChars) {
  const file = entry && entry.handoffFile ? entry.handoffFile : "";
  if (!file) return "(no handoff file path recorded)";
  try {
    return truncateMiddle(fs.readFileSync(file, "utf8"), maxChars, "lineage handoff");
  } catch (err) {
    return `(handoff file unavailable: ${err.message || String(err)})`;
  }
}

function continuationLineageSection(cwd, sourceThreadId) {
  const chain = buildContinuationLineageChain(cwd, sourceThreadId);
  if (!chain.length) {
    return [
      "## 续接 lineage",
      "No prior continuation lineage was found for the source thread.",
    ].join("\n");
  }
  const perHandoffChars = Math.max(1000, Math.floor(CONTINUATION_LINEAGE_MAX_CHARS / Math.max(2, chain.length + 1)));
  const lines = [
    "## 续接 lineage",
    "本线程的源线程本身来自以下压缩续接链。这里是 Agent 可见的历史交接索引，不是隐藏后端状态。",
    "如果用户的问题涉及续接前的事实、已完成工作、未完成事项、风险、PR 状态或架构判断，先读取 lineage 指向的 handoff 文件，不要凭当前上下文猜。",
    "优先级：当前源线程交接文件 > 当前工作区持久上下文 > 下方 lineage handoff 摘要。只有 handoff 不够时，才说明原因并考虑读取旧 rollout 或归档线程。",
    "",
  ];
  chain.forEach((entry, index) => {
    lines.push(
      `### Lineage ${index + 1}`,
      `- Continuation thread id: ${entry.newThreadId}`,
      `- Continuation title: ${entry.newThreadTitle || "(unknown)"}`,
      `- Continued from source thread id: ${entry.sourceThreadId}`,
      `- Source title: ${entry.sourceThreadTitle || "(unknown)"}`,
      `- Handoff file: ${entry.handoffFile || entry.handoffRelativePath || "(unknown)"}`,
      `- Handoff id: ${entry.handoffId || "(unknown)"}`,
      `- Handoff chars: ${entry.handoffChars || 0}`,
      `- Created at: ${entry.createdAt || "(unknown)"}`,
      `- Source archived: ${entry.sourceArchived ? "yes" : "no"}${entry.sourceArchiveError ? ` (${entry.sourceArchiveError})` : ""}`,
      "",
      "#### Handoff excerpt",
      continuationLineageHandoffExcerpt(entry, perHandoffChars),
      "",
    );
  });
  return truncateMiddle(lines.join("\n"), CONTINUATION_LINEAGE_MAX_CHARS, "continuation lineage");
}

function continuationHandoffTarget(cwd, sourceThreadId) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const threadPart = continuationSafeFilePart(sourceThreadId);
  const id = `${stamp}-${threadPart}-${crypto.randomBytes(4).toString("hex")}`;
  const relativePath = path.join(".agent-context", "thread-handoffs", `${id}.md`);
  const file = path.join(cwd, relativePath);
  return { id, relativePath, file, dir: path.dirname(file) };
}

function continuationHandoffFromText(target, text, extra = {}) {
  const trimmed = String(text || "").trim();
  if (trimmed.length < CONTINUATION_HANDOFF_MIN_CHARS) return null;
  const marker = trimmed.match(/^Continuation handoff marker:\s*(.+)$/m);
  return Object.assign({
    id: marker && marker[1] ? marker[1].trim() : target.id,
    path: target.file,
    relativePath: target.relativePath,
    text: truncateMiddle(trimmed, CONTINUATION_SOURCE_HANDOFF_STORED_CHARS, "source continuation handoff"),
    chars: trimmed.length,
  }, extra);
}

function continuationFallbackReason(error, phase = "") {
  const message = error && (error.message || String(error)) || "";
  const code = error && error.code ? ` (${error.code})` : "";
  const prefix = phase ? `${phase}: ` : "";
  return truncateSingleLine(`${prefix}${message}${code}`.trim() || "source thread did not produce a handoff", 240);
}

function writeFallbackSourceContinuationHandoff({ target, cwd, sourceThreadId, sourceThreadTitle, sourceSnapshot, reason, turnId, turnStatus }) {
  const snapshot = sourceSnapshot || { threadId: sourceThreadId, title: sourceThreadTitle, turns: [], readWarnings: [] };
  const text = [
    `Continuation handoff marker: ${target.id}`,
    "",
    "# Fallback Continuation Handoff",
    "",
    "This handoff was generated by Codex Mobile Web because the source thread did not write its own continuation handoff.",
    "It is a bounded recovery index, not a source-thread model summary. The next thread must re-check repository and runtime state before changing files.",
    "",
    `Source thread id: ${sourceThreadId || "(unknown)"}`,
    `Source thread title: ${sourceThreadTitle || (snapshot && snapshot.title) || "(unknown)"}`,
    `Workspace: ${cwd || "(unknown)"}`,
    `Fallback reason: ${reason || "source thread handoff unavailable"}`,
    turnId ? `Source handoff turn id: ${turnId}` : "",
    turnStatus ? `Source handoff turn status: ${statusText(turnStatus) || turnStatus}` : "",
    "",
    "## Current Goal",
    "",
    "- Unknown from fallback generation. Treat the old thread as potentially stale and ask the user only if workspace/context files do not answer the next action.",
    "",
    "## Source Thread Snapshot",
    "",
    continuationSourceThreadSection(snapshot),
    "",
    "## Recent Visible Turns",
    "",
    continuationTurnSummaries(snapshot.turns || []),
    "",
    "## Workspace Context References",
    "",
    workspaceContextReference(cwd),
    "",
    "## Risks/Caveats",
    "",
    "- The source thread did not confirm this handoff itself.",
    "- Full rollout body, hidden UI state, raw prompts, upload contents, keys, tokens, and long logs were intentionally not copied.",
    "- Re-read `.agent-context/PROJECT_CONTEXT.md`, `.agent-context/HANDOFF.md`, and the smallest relevant docs before doing work.",
    "- If the source thread failed due account/profile/mux state, verify `/api/status`, active profile, and quota before sending another turn.",
    "",
    "## Next-Thread Suggestions",
    "",
    "- Start by confirming the current workspace status and whether the old source thread should remain archived.",
    "- Continue from durable workspace files rather than assuming this fallback captured every old-thread detail.",
  ].filter((line) => line !== "").join("\n");
  fs.writeFileSync(target.file, text, "utf8");
  return continuationHandoffFromText(target, text, {
    fallback: true,
    fallbackReason: reason || "",
    turnId: turnId || "",
    turnCompletion: turnStatus ? {
      waited: true,
      completed: isCompletedStatus(turnStatus),
      status: statusText(turnStatus) || String(turnStatus || ""),
      reason: "fallback handoff generated after source thread could not write file",
    } : {
      waited: false,
      completed: false,
      reason: "fallback handoff generated without source handoff turn status",
    },
  });
}

async function readContinuationTurnStatus(threadId, turnId) {
  const id = String(turnId || "").trim();
  if (!threadId || !id) return null;
  const result = await codex.request("thread/turns/list", {
    threadId,
    limit: Math.max(3, CONTINUATION_RECENT_TURNS),
    sortDirection: "desc",
  }, { timeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS, retry: false, resetOnTimeout: false });
  const turns = Array.isArray(result && result.data)
    ? result.data
    : Array.isArray(result && result.turns)
      ? result.turns
      : [];
  const turn = turns.find((entry) => entry && String(entry.id || "") === id);
  return turn ? turn.status : null;
}

function findRecentContinuationHandoff(cwd, sourceThreadId) {
  if (!CONTINUATION_REUSE_HANDOFF_MS || !cwd || !sourceThreadId) return null;
  const dir = path.join(cwd, ".agent-context", "thread-handoffs");
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => {
        const file = path.join(dir, entry.name);
        const stat = fs.statSync(file);
        return { name: entry.name, file, stat };
      })
      .filter((entry) => Date.now() - entry.stat.mtimeMs <= CONTINUATION_REUSE_HANDOFF_MS)
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  } catch (_) {
    return null;
  }
  for (const entry of entries) {
    let text = "";
    try {
      text = fs.readFileSync(entry.file, "utf8");
    } catch (_) {
      continue;
    }
    if (!text.includes(`Source thread id: ${sourceThreadId}`)) continue;
    const relativePath = path.relative(cwd, entry.file);
    const handoff = continuationHandoffFromText({
      id: path.basename(entry.name, ".md"),
      file: entry.file,
      relativePath,
    }, text, {
      reused: true,
      mtimeMs: entry.stat.mtimeMs,
    });
    if (handoff) return handoff;
  }
  return null;
}

function turnIdFromResult(result) {
  return String((result && result.turn && result.turn.id)
    || (result && result.data && result.data.turn && result.data.turn.id)
    || (result && result.turnId)
    || (result && result.id)
    || "");
}

function sourceContinuationHandoffPrompt({ handoffId, handoffFile, cwd, sourceThreadId, sourceThreadTitle }) {
  return [
    "# Continuation Handoff File Generation",
    "",
    "You are running inside the source thread before a continuation thread is created. Write a concise, evidence-grounded handoff file for the next thread.",
    "",
    `Target file: ${handoffFile}`,
    "",
    "Required actions:",
    "1. Read the current workspace `.agent-context/PROJECT_CONTEXT.md` and `.agent-context/HANDOFF.md` if they exist, and include only facts relevant to this workspace and source thread.",
    "2. Check the current repository state as needed, such as git status, recent changes, unfinished tasks, validation results, runtime status, and deployment caveats.",
    "3. The handoff must be freshly summarized from this source thread and the local workspace. Do not copy a fixed template and do not mix in rules from another workspace.",
    "4. Include private/public/README/release rules only when current workspace files or this source thread explicitly establish them, and name the source.",
    "5. Do not write raw secrets, access tokens, passwords, one-time approval state, hidden UI state, long logs, full rollouts, or full prompts.",
    "6. Overwrite the target file. After writing, reply only briefly that the file was written. Do not commit, push, or modify unrelated files.",
    "",
    "Handoff file format:",
    `- First line must be: Continuation handoff marker: ${handoffId}`,
    `- Must include: Source thread id: ${sourceThreadId || "(unknown)"}`,
    `- Must include: Source thread title: ${sourceThreadTitle || "(unknown)"}`,
    `- Must include: Workspace: ${cwd || "(unknown)"}`,
    "- Then use Markdown sections: Current goal, Completed work, Unfinished work, Key files/commands, Validation results, Risks/caveats, Next-thread suggestions.",
  ].join("\n");
}
async function waitForContinuationHandoffFile(target, timeoutMs = CONTINUATION_HANDOFF_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const text = fs.readFileSync(target.file, "utf8");
      const handoff = continuationHandoffFromText(target, text);
      if (handoff) return handoff;
      const trimmed = text.trim();
      lastError = `file exists but is incomplete (${trimmed.length} chars)`;
    } catch (err) {
      lastError = err && err.code === "ENOENT" ? "file not written yet" : (err.message || String(err));
    }
    await sleep(1000);
  }
  const err = new Error(`Source thread did not finish writing continuation handoff within ${Math.round(timeoutMs / 1000)}s: ${target.file} (${lastError})`);
  err.code = "HANDOFF_TIMEOUT";
  err.handoffTarget = target;
  throw err;
}

async function waitForContinuationTurnCompletion(threadId, turnId) {
  const id = String(turnId || "").trim();
  if (!threadId || !id) return { waited: false, completed: false, reason: "missing turn id" };
  const deadline = Date.now() + CONTINUATION_HANDOFF_TURN_COMPLETION_TIMEOUT_MS;
  let lastStatus = "";
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const result = await codex.request("thread/turns/list", {
        threadId,
        limit: Math.max(3, CONTINUATION_RECENT_TURNS),
        sortDirection: "desc",
      }, { timeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS, retry: false });
      const turns = Array.isArray(result && result.data)
        ? result.data
        : Array.isArray(result && result.turns)
          ? result.turns
          : [];
      const turn = turns.find((entry) => entry && String(entry.id || "") === id);
      if (turn) {
        lastStatus = statusText(turn.status) || "(no status)";
        if (isCompletedStatus(turn.status)) {
          return { waited: true, completed: true, status: lastStatus };
        }
      }
    } catch (err) {
      lastError = err.message || String(err);
    }
    await sleep(1000);
  }
  return {
    waited: true,
    completed: false,
    status: lastStatus,
    error: lastError,
    timedOut: true,
  };
}

async function createSourceContinuationHandoff({ cwd, sourceThreadId, sourceThreadTitle, runtimeSettings, sourceSnapshot, onProgress }) {
  const threadId = String(sourceThreadId || "").trim();
  if (!threadId) return null;
  const target = continuationHandoffTarget(cwd, threadId);
  target.sourceThreadId = threadId;
  fs.mkdirSync(target.dir, { recursive: true });
  ensureContinuationHandoffIgnore(target);
  const existingHandoff = findRecentContinuationHandoff(cwd, threadId);
  if (existingHandoff) {
    if (onProgress) {
      onProgress("handoff-reuse", "发现已生成交接文件，继续创建续接线程", {
        sourceThreadId: threadId,
        handoffFile: existingHandoff.path,
        chars: existingHandoff.chars || 0,
      });
    }
    return Object.assign(existingHandoff, {
      turnId: "",
      turnCompletion: { waited: false, completed: false, reason: "reused recent handoff file" },
    });
  }
  const prompt = sourceContinuationHandoffPrompt({
    handoffId: target.id,
    handoffFile: target.file,
    cwd,
    sourceThreadId: threadId,
    sourceThreadTitle,
  });
  const params = applyTurnRuntimeSettings({
    threadId,
    input: [{ type: "text", text: prompt, text_elements: [] }],
    cwd,
    summary: "auto",
  }, runtimeSettings || {});
  try {
    if (onProgress) onProgress("handoff-resume", "正在唤醒源线程");
    await codex.request("thread/resume", applyResumeRuntimeSettings({
      threadId,
      cwd,
      persistExtendedHistory: true,
    }, runtimeSettings || {}), { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
  } catch (err) {
    if (!/already|loaded|active/i.test(err.message || "")) {
      if (onProgress) onProgress("handoff-fallback", "源线程无法唤醒，改用服务端交接文件", { reason: continuationFallbackReason(err, "resume") });
      return writeFallbackSourceContinuationHandoff({
        target,
        cwd,
        sourceThreadId: threadId,
        sourceThreadTitle,
        sourceSnapshot,
        reason: continuationFallbackReason(err, "resume"),
      });
    }
  }
  if (onProgress) onProgress("handoff-turn", "正在让源线程生成交接文件");
  let result;
  try {
    result = await codex.request("turn/start", params, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
  } catch (err) {
    if (onProgress) onProgress("handoff-fallback", "源线程无法启动交接 turn，改用服务端交接文件", { reason: continuationFallbackReason(err, "turn/start") });
    return writeFallbackSourceContinuationHandoff({
      target,
      cwd,
      sourceThreadId: threadId,
      sourceThreadTitle,
      sourceSnapshot,
      reason: continuationFallbackReason(err, "turn/start"),
    });
  }
  const turnId = turnIdFromResult(result);
  notifyLocalTurnStarted(threadId, result, { source: "continuation-source-handoff" });
  if (onProgress) onProgress("handoff-file", "正在等待源线程写入交接文件", { turnId });
  let file;
  try {
    file = await waitForContinuationHandoffFile(target, Math.min(CONTINUATION_HANDOFF_TIMEOUT_MS, 30_000));
  } catch (err) {
    if (err.code !== "HANDOFF_TIMEOUT") throw err;
    let turnStatus = null;
    try {
      turnStatus = await readContinuationTurnStatus(threadId, turnId);
    } catch (_) {
      turnStatus = null;
    }
    if (isCompletedStatus(turnStatus)) {
      const reason = continuationFallbackReason(err, "source turn completed without handoff");
      if (onProgress) onProgress("handoff-fallback", "源线程已结束但没有写交接文件，改用服务端交接文件", { turnId, reason });
      return Object.assign(writeFallbackSourceContinuationHandoff({
        target,
        cwd,
        sourceThreadId: threadId,
        sourceThreadTitle,
        sourceSnapshot,
        reason,
        turnId,
        turnStatus,
      }), {
        result,
      });
    }
    if (onProgress) {
      onProgress("handoff-late", "源线程仍在写交接文件，继续后台等待", {
        turnId,
        extraTimeoutMs: CONTINUATION_LATE_HANDOFF_TIMEOUT_MS,
      });
    }
    try {
      file = await waitForContinuationHandoffFile(target, CONTINUATION_LATE_HANDOFF_TIMEOUT_MS);
    } catch (lateErr) {
      const reason = continuationFallbackReason(lateErr, "handoff timeout");
      if (onProgress) onProgress("handoff-fallback", "源线程未按时写入交接文件，改用服务端交接文件", { turnId, reason });
      let finalTurnStatus = null;
      try {
        finalTurnStatus = await readContinuationTurnStatus(threadId, turnId);
      } catch (_) {
        finalTurnStatus = null;
      }
      return Object.assign(writeFallbackSourceContinuationHandoff({
        target,
        cwd,
        sourceThreadId: threadId,
        sourceThreadTitle,
        sourceSnapshot,
        reason,
        turnId,
        turnStatus: finalTurnStatus,
      }), {
        result,
      });
    }
  }
  if (onProgress) onProgress("handoff-complete", "交接文件已写入，正在确认源线程完成", { turnId, chars: file.chars || 0 });
  const turnCompletion = await waitForContinuationTurnCompletion(threadId, turnId);
  return Object.assign(file, {
    turnId,
    turnCompletion,
    result,
  });
}

function sourceHandoffSection(sourceHandoff) {
  if (!sourceHandoff) {
    return "No source-thread-generated handoff file was requested or available.";
  }
  return [
    `- Handoff file: ${sourceHandoff.path}`,
    `- Handoff relative path: ${sourceHandoff.relativePath || "(unknown)"}`,
    `- Handoff id: ${sourceHandoff.id}`,
    `- Handoff chars: ${sourceHandoff.chars || 0}`,
    `- Handoff mode: ${sourceHandoff.fallback ? "server fallback; source thread did not write this handoff" : "source thread generated"}`,
    sourceHandoff.fallbackReason ? `- Fallback reason: ${sourceHandoff.fallbackReason}` : "",
    "- The handoff content is intentionally not inlined in this bootstrap.",
    "- Read this file first when exact source-thread state is needed.",
  ].filter(Boolean).join("\n");
}

function continuationLineageIndexReference(cwd, sourceThreadId) {
  const indexPath = continuationLineageIndexPath(cwd);
  const chain = buildContinuationLineageChain(cwd, sourceThreadId);
  const lines = [
    `- Lineage index file: ${indexPath}`,
    `- Prior continuation chain depth available: ${chain.length}`,
    "- Prior lineage handoff contents are intentionally not inlined.",
    "- Read the index, then the referenced handoff files only when older continuation provenance is needed.",
  ];
  if (chain.length) {
    lines.push("- Prior lineage references:");
    for (const entry of chain) {
      lines.push(`  - ${entry.newThreadId} <- ${entry.sourceThreadId}; handoff: ${entry.handoffFile || entry.handoffRelativePath || "(unknown)"}; chars: ${entry.handoffChars || 0}`);
    }
  }
  return lines.join("\n");
}

function workspaceContextReference(cwd) {
  return [
    `- Project context: ${path.join(cwd || "", ".agent-context", "PROJECT_CONTEXT.md")}`,
    `- Active handoff: ${path.join(cwd || "", ".agent-context", "HANDOFF.md")}`,
    `- Docs entry: ${path.join(cwd || "", "docs", "README.md")}`,
    "- These files are intentionally not inlined in this bootstrap.",
    "- Read only the smallest relevant docs after the project context and active handoff.",
  ].join("\n");
}

function homeAiCentralContractReference(pluginMode) {
  if (continuationPluginMode({ pluginMode }) !== "hermes") return "";
  return [
    "## Home AI Central Contract",
    "",
    "- This continuation was created from Home AI embedded plugin mode.",
    "- Before code changes, deployment, task-card routing, mobile visual validation, or plugin/workspace policy decisions, read the full central Home AI platform contract document:",
    "  `/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/plugin-workspace-platform-contract.md`",
    "- Treat that central contract as authoritative over plugin-local pointer docs and work according to its required workflow.",
    "- If the task touches deployment or mobile UI, also read the smallest relevant central companion contract/runbook named by that document before acting.",
  ].join("\n");
}

function newThreadBootstrapPromptScoped({ cwd, sourceThreadId, sourceThreadTitle, desiredTitle, sourceSnapshot, runtimeSettings, sourceHandoff, pluginMode }) {
  const snapshot = sourceSnapshot || { threadId: sourceThreadId, title: sourceThreadTitle, turns: [], readWarnings: [] };
  const publicRuntime = publicRuntimeSettings(runtimeSettings);
  const centralContract = homeAiCentralContractReference(pluginMode);
  const parts = [
    "# Continuation Bootstrap Index",
    "",
    "This thread is a same-workspace continuation created by Codex Mobile Web. This message is an index only; it does not inline old thread body, handoff excerpts, workspace context excerpts, or lineage excerpts.",
    "Use tools to read bounded file sections when evidence is needed, or re-check the local repository and runtime state.",
    "",
    "Startup steps:",
    "1. Read the source-thread handoff file listed below first. If it is over 20KB, read its top metadata and recent tail first, then search/read specific sections as needed.",
    "2. Read the current workspace context with bounded reads: `.agent-context/PROJECT_CONTEXT.md` top routing section and `.agent-context/HANDOFF.md` recent tail. Do not load archived/full context by default.",
    "3. Read `docs/README.md`, then only the smallest relevant docs for the current task.",
    "4. Confirm the loaded key facts briefly.",
    "5. Do not edit files, commit, or push in the first continuation turn unless the user gives a new explicit task.",
    "",
    "Do not assume the new thread inherited old chat flow, temporary shell state, one-time approvals, hidden UI state, or old-thread reasoning.",
    "",
    "## Continuation Target",
    `- New thread title: ${desiredTitle || "(not set)"}`,
    `- Workspace: ${cwd || "(unknown)"}`,
    `- Created at: ${new Date().toISOString()}`,
    "",
    "## Source Thread",
    continuationSourceThreadSection(snapshot),
    "",
    "## Source Thread Handoff",
    sourceHandoffSection(sourceHandoff),
    "",
    "## Workspace Context Files",
    workspaceContextReference(cwd),
    "",
    centralContract,
    centralContract ? "" : null,
    "## Continuation Lineage",
    continuationLineageIndexReference(cwd, sourceThreadId),
    "",
    "## Runtime Settings",
    `- Runtime settings passed by Mobile Web: ${Object.keys(publicRuntime || {}).length ? JSON.stringify(publicRuntime) : "(none detected)"}`,
    "- If later work needs different permissions or a different model, follow the current thread UI/user instruction; do not assume old one-time approvals still apply.",
    "",
    "## Privacy And Size Constraints",
    "- Do not copy handoff bodies, lineage handoff bodies, rollout bodies, or workspace context bodies back into chat unless the user explicitly asks.",
    "- Do not write or display raw secrets, access keys, VAPID private keys, subscription endpoints, upload contents, full rollouts, full prompts, or one-time approval state.",
  ].filter((part) => part !== null);
  return truncateMiddle(parts.join("\n"), MAX_CONTINUATION_BOOTSTRAP_CHARS, "continuation bootstrap");
}

function publicContinuationGoalMigration(migration) {
  if (!migration || typeof migration !== "object") return null;
  return {
    migrated: Boolean(migration.migrated),
    reason: String(migration.reason || ""),
    sourceThreadId: String(migration.sourceThreadId || ""),
    targetThreadId: String(migration.targetThreadId || ""),
    sourceStatus: String(migration.sourceStatus || ""),
    targetStatus: String(migration.targetStatus || ""),
    tokenBudget: migration.tokenBudget === null || migration.tokenBudget === undefined ? null : Number(migration.tokenBudget),
    sourceTokenBudget: migration.sourceTokenBudget === null || migration.sourceTokenBudget === undefined ? null : Number(migration.sourceTokenBudget),
    sourceTokensUsed: Number(migration.sourceTokensUsed || 0),
    sourceFrozen: Boolean(migration.sourceFrozen),
    sourceFreezeError: String(migration.sourceFreezeError || ""),
    error: String(migration.error || ""),
  };
}

async function migrateContinuationThreadGoal(sourceThreadId, targetThreadId) {
  const sourceId = String(sourceThreadId || "").trim();
  const targetId = String(targetThreadId || "").trim();
  const base = {
    migrated: false,
    reason: "",
    sourceThreadId: sourceId,
    targetThreadId: targetId,
    sourceStatus: "",
    targetStatus: "",
    tokenBudget: null,
    sourceTokenBudget: null,
    sourceTokensUsed: 0,
    sourceFrozen: false,
    sourceFreezeError: "",
    error: "",
  };
  if (!sourceId || !targetId) return Object.assign(base, { reason: "missing-thread-id" });
  if (sourceId === targetId) return Object.assign(base, { reason: "same-thread" });

  let sourceGoal = null;
  try {
    sourceGoal = await currentThreadGoalForAction(sourceId);
  } catch (err) {
    return Object.assign(base, {
      reason: isThreadGoalRpcUnsupportedError(err) ? "unsupported" : "read-error",
      error: err.message || String(err),
    });
  }

  const plan = continuationGoalMigrationPlan(sourceGoal || {});
  const migration = Object.assign(base, {
    reason: plan.reason || "",
    sourceStatus: plan.sourceStatus || "",
    targetStatus: plan.targetStatus || "",
    tokenBudget: plan.tokenBudget === undefined ? null : plan.tokenBudget,
    sourceTokenBudget: plan.sourceTokenBudget === undefined ? null : plan.sourceTokenBudget,
    sourceTokensUsed: plan.sourceTokensUsed || 0,
  });
  if (!plan.migrate) return migration;

  try {
    const targetExtra = plan.targetStatus === "blocked" ? { status: "blocked" } : {};
    const targetResult = await setThreadGoalRpc(threadGoalSetParams(targetId, plan.objective, plan.tokenBudget, targetExtra));
    let targetGoal = threadGoalFromRpcResult(targetResult);
    if (plan.targetStatus === "blocked" && normalizeThreadGoalStatus(targetGoal && targetGoal.status) !== "blocked") {
      targetGoal = await currentThreadGoalForAction(targetId);
    }
    migration.migrated = true;
    migration.targetStatus = normalizeThreadGoalStatus((targetGoal && targetGoal.status) || plan.targetStatus);
  } catch (err) {
    return Object.assign(migration, {
      reason: isThreadGoalRpcUnsupportedError(err) ? "unsupported" : "set-target-error",
      error: err.message || String(err),
    });
  }

  if (plan.sourceStatus === "active") {
    try {
      await setThreadGoalRpc(threadGoalSetParams(sourceId, plan.objective, plan.sourceTokenBudget, { status: "blocked" }));
      migration.sourceFrozen = true;
    } catch (err) {
      migration.sourceFreezeError = err.message || String(err);
    }
  }

  return migration;
}

function continuationJobSourceKey(body) {
  const sourceThreadId = String(body && body.sourceThreadId || "").trim();
  if (!sourceThreadId) return "";
  return [
    sourceThreadId,
    normalizeFsPath(String(body.cwd || "").trim()),
    Boolean(body.archiveSourceThread),
    continuationPluginMode(body),
  ].join("|");
}

function continuationPluginMode(body = {}) {
  const mode = String(body.pluginMode || body.plugin_mode || "").trim().toLowerCase();
  if (mode === "hermes" || mode === "homeai" || mode === "plugin") return "hermes";
  if (body.hermesPluginMode === true || body.hermes_plugin_mode === true || body.embeddedPlugin === true || body.embedded_plugin === true) return "hermes";
  const pluginId = String(body.pluginId || body.plugin_id || "").trim();
  return pluginId ? "hermes" : "";
}

function publicContinuationJob(job) {
  if (!job) return null;
  return {
    ok: job.status === "done",
    jobId: job.id,
    status: job.status,
    step: job.step,
    message: job.message,
    sourceThreadId: job.sourceThreadId,
    pluginMode: job.pluginMode || "",
    threadId: job.threadId || "",
    contextCompaction: job.contextCompaction || null,
    sourceArchive: job.sourceArchive || null,
    sourceGoalMigration: job.sourceGoalMigration || null,
    sourceHandoff: job.sourceHandoff || null,
    lineage: job.lineage || null,
    titleIndexed: Boolean(job.titleIndexed),
    result: job.status === "done" ? job.result : null,
    error: job.error || "",
    createdAt: new Date(job.createdAt).toISOString(),
    updatedAt: new Date(job.updatedAt).toISOString(),
  };
}

function pruneContinuationJobs(now = Date.now()) {
  for (const [jobId, job] of continuationJobs) {
    if (!job || now - job.updatedAt > CONTINUATION_JOB_TTL_MS) {
      continuationJobs.delete(jobId);
      if (job && job.sourceKey && activeContinuationJobsBySource.get(job.sourceKey) === jobId) {
        activeContinuationJobsBySource.delete(job.sourceKey);
      }
    }
  }
  while (continuationJobs.size > CONTINUATION_JOB_MAX) {
    const firstKey = continuationJobs.keys().next().value;
    if (!firstKey) break;
    const job = continuationJobs.get(firstKey);
    continuationJobs.delete(firstKey);
    if (job && job.sourceKey && activeContinuationJobsBySource.get(job.sourceKey) === firstKey) {
      activeContinuationJobsBySource.delete(job.sourceKey);
    }
  }
}

function updateContinuationJob(job, patch = {}) {
  if (!job) return;
  Object.assign(job, patch, { updatedAt: Date.now() });
  logContinuation(job.step || patch.step || "update", {
    jobId: job.id,
    status: job.status,
    sourceThreadId: job.sourceThreadId,
    threadId: job.threadId,
    message: job.message,
    error: job.error,
  });
}

function setContinuationStep(job, step, message, extra = {}) {
  updateContinuationJob(job, Object.assign({ status: "running", step, message }, extra));
}

async function startThreadFromRequestBody(body, options = {}) {
  const job = options.job || null;
  const progress = (step, message, extra) => setContinuationStep(job, step, message, extra);
  const cwd = String(body.cwd || "").trim();
  if (!cwd) {
    throw httpStatusError(400, "Workspace is required to start a new thread");
  }
  progress("validate", "正在检查工作区");
  let globalState = readGlobalState();
  let visibility = visibilityFromGlobalState(globalState);
  if (
    ensureWorkspaceVisible
    && visibility.workspaceKeys
    && visibility.workspaceKeys.size > 0
    && !visibility.workspaceKeys.has(normalizeFsPath(cwd))
  ) {
    await ensureWorkspaceVisible(cwd);
    globalState = readGlobalState();
    visibility = visibilityFromGlobalState(globalState);
  }
  if (visibility.workspaceKeys.size > 0 && !visibility.workspaceKeys.has(normalizeFsPath(cwd))) {
    throw httpStatusError(403, "Workspace is not visible in Codex Desktop");
  }
  progress("context-compaction", "Checking workspace context size");
  const contextCompaction = compactWorkspaceContext({
    cwd,
    thresholdBytes: CONTINUATION_CONTEXT_FILE_COMPACT_BYTES,
    combinedThresholdBytes: CONTINUATION_CONTEXT_PAIR_COMPACT_BYTES,
    preserveChars: CONTINUATION_CONTEXT_COMPACT_PRESERVE_CHARS,
  });
  if (job) job.contextCompaction = contextCompaction;
  if (contextCompaction && contextCompaction.compacted) {
    progress("context-compaction", "Workspace context compacted", {
      archiveDir: contextCompaction.archiveDir,
      manifestPath: contextCompaction.manifestPath,
      originalBytes: contextCompaction.originalBytes,
      compactedBytes: contextCompaction.compactedBytes,
      reductionPercent: contextCompaction.reductionPercent,
    });
  }
  const sourceThreadId = String(body.sourceThreadId || "").trim();
  const requestedSourceThreadTitle = String(body.sourceThreadTitle || "").trim();
  const archiveSourceThread = Boolean(body.archiveSourceThread && sourceThreadId);
  const pluginMode = continuationPluginMode(body);
  progress("source-snapshot", "正在读取源线程摘要", { sourceThreadId });
  const sourceSnapshot = await continuationSourceSnapshot(sourceThreadId, requestedSourceThreadTitle, visibility);
  const sourceThreadTitle = sourceTitleForContinuation(sourceSnapshot, requestedSourceThreadTitle, cwd);
  const desiredTitle = newThreadTitle({ cwd, sourceThreadTitle });
  const runtimeSettings = applyPermissionModeOverride(sourceSnapshot.runtimeSettings || {}, body.permissionMode, cwd);
  progress("handoff", "正在生成源线程交接文件", { sourceThreadId });
  const sourceHandoff = await createSourceContinuationHandoff({
    cwd,
    sourceThreadId,
    sourceThreadTitle,
    runtimeSettings,
    sourceSnapshot,
    onProgress: progress,
  });
  if (job && sourceHandoff) {
    job.sourceHandoff = {
      id: sourceHandoff.id,
      path: sourceHandoff.path,
      relativePath: sourceHandoff.relativePath,
      chars: sourceHandoff.chars || 0,
      turnId: sourceHandoff.turnId || "",
      turnCompletion: sourceHandoff.turnCompletion || null,
    };
  }
  progress("thread-start", "正在创建续接线程");
  const params = applyStartThreadRuntimeSettings({
    cwd,
    modelProvider: null,
    config: {},
    developerInstructions: readStartThreadDeveloperInstructions(cwd) || "",
    personality: null,
    ephemeral: null,
    dynamicTools: null,
    mockExperimentalField: null,
    experimentalRawEvents: false,
    persistExtendedHistory: true,
  }, runtimeSettings);
  const result = await codex.request("thread/start", params, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
  const threadId = threadIdFromStartResult(result);
  if (job) job.threadId = threadId;
  const titleIndexed = persistThreadTitleToSessionIndex(threadId, desiredTitle);
  if (job) job.titleIndexed = titleIndexed;
  progress("title", "正在设置续接线程标题", { threadId });
  const titleUpdatedBeforeBootstrap = await tryUpdateThreadTitle(threadId, desiredTitle).catch(() => false);
  const bootstrapParams = applyTurnRuntimeSettings({
    threadId,
    input: newThreadBootstrapInput({ cwd, sourceThreadId, sourceThreadTitle, desiredTitle, sourceSnapshot, runtimeSettings, sourceHandoff, pluginMode }),
    cwd,
    summary: "auto",
  }, runtimeSettings);
  progress("bootstrap", "正在写入续接启动上下文", { threadId });
  const bootstrap = threadId
    ? await codex.request("turn/start", bootstrapParams, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false })
    : null;
  if (threadId && bootstrap) notifyLocalTurnStarted(threadId, bootstrap, { source: "continuation-bootstrap" });
  const titleUpdatedAfterBootstrap = await tryUpdateThreadTitle(threadId, desiredTitle).catch(() => false);
  let sourceGoalMigration = null;
  if (sourceThreadId && threadId && sourceThreadId !== threadId && body.migrateSourceGoal !== false) {
    progress("goal-migration", "正在迁移旧线程目标", { threadId, sourceThreadId });
    sourceGoalMigration = publicContinuationGoalMigration(
      await migrateContinuationThreadGoal(sourceThreadId, threadId),
    );
  }
  if (job) job.sourceGoalMigration = sourceGoalMigration;
  let sourceArchive = null;
  if (archiveSourceThread && sourceThreadId !== threadId) {
    progress("archive-source", "正在归档旧线程", { threadId, sourceThreadId });
    try {
      const archiveResult = await archiveVisibleThread(sourceThreadId, visibility);
      sourceArchive = {
        archived: !(archiveResult && archiveResult.archived === false),
        threadId: sourceThreadId,
        result: archiveResult,
      };
    } catch (err) {
      const fallbackResult = mobileArchivedFallbackResult("continuation-fallback", sourceThreadId, err);
      sourceArchive = {
        archived: Boolean(fallbackResult.archived),
        threadId: sourceThreadId,
        result: fallbackResult,
        error: err.message || String(err),
      };
    }
  }
  if (job) job.sourceArchive = sourceArchive;
  const sourceSummary = sourceSnapshot && sourceSnapshot.summary;
  const sourceRolloutPath = sourceSummary ? rolloutPathForThread(sourceSummary) : "";
  const sourceStats = sourceRolloutPath ? rolloutStatsForPath(sourceRolloutPath) : null;
  const lineage = appendContinuationLineageEntry(cwd, {
    newThreadId: threadId,
    newThreadTitle: desiredTitle,
    sourceThreadId,
    sourceThreadTitle: sourceThreadTitle || (sourceSummary && (sourceSummary.name || sourceSummary.preview)) || "",
    sourceRolloutPath,
    sourceRolloutSizeBytes: sourceStats ? sourceStats.sizeBytes : 0,
    handoffFile: sourceHandoff && sourceHandoff.path,
    handoffRelativePath: sourceHandoff && sourceHandoff.relativePath,
    handoffId: sourceHandoff && sourceHandoff.id,
    handoffChars: sourceHandoff && sourceHandoff.chars,
    sourceArchived: Boolean(sourceArchive && sourceArchive.archived),
    sourceArchiveError: sourceArchive && sourceArchive.error,
    sourceGoalMigrated: Boolean(sourceGoalMigration && sourceGoalMigration.migrated),
    sourceGoalMigrationError: sourceGoalMigration && (sourceGoalMigration.error || sourceGoalMigration.sourceFreezeError),
  });
  if (job) job.lineage = lineage;
  const thread = rememberStartedThread(annotateThreadRolloutStats(Object.assign(
    {},
    (result && result.thread) || (result && result.data && result.data.thread) || {},
    {
      id: threadId,
      name: desiredTitle,
      preview: desiredTitle,
      cwd,
      status: { type: "active" },
      turns: [],
      mobileReadMode: "continuation-bootstrap",
    },
  )));
  return {
    ok: true,
    threadId,
    thread,
    title: desiredTitle,
    titleUpdated: Boolean(titleUpdatedBeforeBootstrap || titleUpdatedAfterBootstrap),
    titleIndexed,
    sourceGoalMigration,
    sourceArchive,
    sourceContextWarnings: sourceSnapshot.readWarnings || [],
    sourceHandoff: sourceHandoff ? {
      id: sourceHandoff.id,
      path: sourceHandoff.path,
      relativePath: sourceHandoff.relativePath,
      chars: sourceHandoff.chars || 0,
      turnId: sourceHandoff.turnId || "",
      turnCompletion: sourceHandoff.turnCompletion || null,
    } : null,
    lineage,
    continuationContextChars: bootstrapParams
      && Array.isArray(bootstrapParams.input)
      && bootstrapParams.input[0]
      ? String(bootstrapParams.input[0].text || "").length
      : 0,
    bootstrap,
    result,
  };
}

function createContinuationJob(body) {
  pruneContinuationJobs();
  const sourceKey = continuationJobSourceKey(body);
  const activeJobId = sourceKey ? activeContinuationJobsBySource.get(sourceKey) : "";
  const activeJob = activeJobId ? continuationJobs.get(activeJobId) : null;
  if (activeJob && ["queued", "running"].includes(activeJob.status)) {
    return activeJob;
  }
  const now = Date.now();
  const job = {
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"),
    status: "queued",
    step: "queued",
    message: "续接任务已创建",
    body: Object.assign({}, body),
    sourceThreadId: String(body.sourceThreadId || "").trim(),
    pluginMode: continuationPluginMode(body),
    sourceKey,
    threadId: "",
    sourceArchive: null,
    sourceGoalMigration: null,
    sourceHandoff: null,
    lineage: null,
    result: null,
    error: "",
    createdAt: now,
    updatedAt: now,
  };
  continuationJobs.set(job.id, job);
  if (sourceKey) activeContinuationJobsBySource.set(sourceKey, job.id);
  logContinuation("queued", { jobId: job.id, sourceThreadId: job.sourceThreadId, cwd: body.cwd });
  setImmediate(() => runContinuationJob(job));
  return job;
}

async function runContinuationJob(job) {
  try {
    updateContinuationJob(job, { status: "running", step: "start", message: "续接任务开始执行" });
    const result = await startThreadFromRequestBody(job.body, { job });
    updateContinuationJob(job, {
      status: "done",
      step: "done",
      message: result.sourceArchive && result.sourceArchive.error
        ? (result.sourceArchive.archived
          ? "续接线程已就绪；旧线程已在 Mobile 隐藏"
          : `续接线程已就绪；归档失败：${result.sourceArchive.error}`)
        : "续接线程已就绪",
      threadId: result.threadId || job.threadId,
      sourceArchive: result.sourceArchive || job.sourceArchive,
      sourceGoalMigration: result.sourceGoalMigration || job.sourceGoalMigration,
      sourceHandoff: result.sourceHandoff || job.sourceHandoff,
      result,
    });
  } catch (err) {
    updateContinuationJob(job, {
      status: "failed",
      step: "failed",
      message: "续接任务失败",
      error: err.message || String(err),
    });
  } finally {
    if (job.sourceKey && activeContinuationJobsBySource.get(job.sourceKey) === job.id) {
      activeContinuationJobsBySource.delete(job.sourceKey);
    }
  }
}

  function getContinuationJob(jobId) {
    return continuationJobs.get(String(jobId || ""));
  }

  return {
    continuationPluginMode,
    createContinuationJob,
    createSourceContinuationHandoff,
    getContinuationJob,
    newThreadBootstrapInput,
    newThreadBootstrapPromptScoped,
    pruneContinuationJobs,
    publicContinuationJob,
    sourceHandoffSection,
    startThreadFromRequestBody,
  };
}

module.exports = { createContinuationThreadService };
