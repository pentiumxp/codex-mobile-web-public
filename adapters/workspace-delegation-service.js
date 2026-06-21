"use strict";

const crypto = require("node:crypto");

const MAX_TASK_BODY_CHARS = 8_000;
const MAX_VISIBLE_REQUEST_CHARS = 5_000;
const GENERIC_ALIASES = new Set([
  "app",
  "main",
  "web",
  "mobile",
  "codex",
  "default",
  "thread",
]);

function stringValue(value) {
  return String(value || "").trim();
}

function stableTextHash(value) {
  return crypto.createHash("sha256")
    .update(String(value || ""))
    .digest("hex")
    .slice(0, 18);
}

function truncateSingleLine(value, maxChars = 120) {
  const text = stringValue(value).replace(/\s+/g, " ");
  if (!text || text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function boundedVisibleText(value, maxChars) {
  const text = stringValue(value).replace(/\r\n/g, "\n");
  if (!text || text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 17)).trimEnd()}\n\n...(truncated)`;
}

function normalizeComparableText(value) {
  return stringValue(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizePathText(value) {
  const text = stringValue(value)
    .replace(/^file:\/\//i, "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/+$/g, "");
  if (/^[a-z]:/i.test(text)) return `${text[0].toLowerCase()}${text.slice(1)}`;
  return text;
}

function pathBasename(value) {
  const normalized = normalizePathText(value);
  if (!normalized) return "";
  const parts = normalized.split("/").filter(Boolean);
  return stringValue(parts[parts.length - 1] || "");
}

function threadTitle(thread) {
  return truncateSingleLine(thread && (thread.name || thread.title || thread.preview || thread.label || thread.id) || "", 120);
}

function baseTitleAlias(value) {
  return stringValue(value)
    .replace(/\s+\d{2,4}[-/.]\d{1,2}(?:[-/.]\d{1,2})?$/g, "")
    .trim();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasContainsCjk(value) {
  return /[\u3400-\u9FFF]/.test(String(value || ""));
}

function textContainsAlias(text, alias) {
  const normalizedText = normalizeComparableText(text);
  const normalizedAlias = normalizeComparableText(alias);
  if (!normalizedAlias || normalizedAlias.length < 2 || GENERIC_ALIASES.has(normalizedAlias)) return false;
  if (aliasContainsCjk(normalizedAlias)) return normalizedText.includes(normalizedAlias);
  const pattern = new RegExp(`(^|[^a-z0-9_-])${escapeRegExp(normalizedAlias)}([^a-z0-9_-]|$)`, "i");
  return pattern.test(normalizedText);
}

function textContainsWorkspacePath(text, cwd) {
  const needle = normalizePathText(cwd);
  if (!needle || needle.length < 8) return false;
  return normalizePathText(text).toLowerCase().includes(needle.toLowerCase());
}

function hasNegativeDelegationCue(text) {
  return /不要(?:发卡|委派|跨线程|跨工作区)|别(?:发卡|委派)|直接(?:在)?当前线程|当前线程(?:处理|做)|不用(?:发卡|委派)|do\s+not\s+delegate|no\s+task\s+card|do\s+not\s+send\s+(?:a\s+)?card/i
    .test(stringValue(text));
}

function hasExplicitDelegationCue(text) {
  return /发卡|任务卡|委派|交给|转给|发给|handoff|delegate|task\s*card|send\s+(?:a\s+)?card/i
    .test(stringValue(text));
}

function hasMutationCue(text) {
  return /修复|修改|改掉|实现|优化|部署|提交|推送|更新|创建|新增|删除|移除|合并|跑测试|测试|处理|解决|接入|补上|调整|生成|执行|fix|implement|update|deploy|commit|push|merge|change|edit|add|remove|delete|test|run|execute|resolve|handle|wire|build|create/i
    .test(stringValue(text));
}

function isExplicitTaskCardCommand(text) {
  const value = stringValue(text);
  return value.startsWith("#")
    || /^@(?:任务卡片|自由协作|Task\s*Card|TaskCard|Autonomous|Auto\s*Task\s*Card|AutoTaskCard)\b/i.test(value);
}

function uniqueThreads(threads) {
  const seen = new Set();
  const out = [];
  for (const thread of Array.isArray(threads) ? threads : []) {
    const id = stringValue(thread && thread.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(thread);
  }
  return out;
}

function aliasesForThread(thread) {
  const aliases = [
    threadTitle(thread),
    baseTitleAlias(threadTitle(thread)),
    thread && thread.name,
    baseTitleAlias(thread && thread.name),
    thread && thread.title,
    baseTitleAlias(thread && thread.title),
    thread && thread.label,
    pathBasename(thread && thread.cwd),
  ].map(stringValue).filter(Boolean);
  const seen = new Set();
  return aliases.filter((alias) => {
    const key = normalizeComparableText(alias);
    if (!key || seen.has(key) || GENERIC_ALIASES.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function currentWorkspaceMatches(thread, currentThread) {
  const threadId = stringValue(thread && thread.id);
  const currentThreadId = stringValue(currentThread && currentThread.id);
  if (threadId && currentThreadId && threadId === currentThreadId) return true;
  const cwd = normalizePathText(thread && thread.cwd).toLowerCase();
  const currentCwd = normalizePathText(currentThread && currentThread.cwd).toLowerCase();
  return Boolean(cwd && currentCwd && cwd === currentCwd);
}

function collectDelegationCandidates(text, currentThread, threads) {
  const explicit = hasExplicitDelegationCue(text);
  const mutating = hasMutationCue(text);
  if (!explicit && !mutating) return [];
  const candidates = [];
  for (const thread of uniqueThreads(threads)) {
    if (!thread || currentWorkspaceMatches(thread, currentThread)) continue;
    const cwd = stringValue(thread.cwd);
    const title = threadTitle(thread) || stringValue(thread.id);
    const pathMatch = cwd ? textContainsWorkspacePath(text, cwd) : false;
    const aliases = aliasesForThread(thread);
    const aliasMatch = aliases.find((alias) => textContainsAlias(text, alias)) || "";
    if (!pathMatch && !aliasMatch) continue;
    if (pathMatch && !explicit && !mutating) continue;
    if (aliasMatch && !explicit && !mutating) continue;
    const score = pathMatch ? 0.95 : explicit ? 0.84 : 0.74;
    candidates.push({
      thread,
      threadId: stringValue(thread.id),
      title,
      cwd,
      pathMatch,
      aliasMatch,
      score,
      reason: pathMatch ? "workspace_path_match" : explicit ? "explicit_delegation_alias_match" : "mutation_alias_match",
    });
  }
  return candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (Number(right.pathMatch) !== Number(left.pathMatch)) return Number(right.pathMatch) - Number(left.pathMatch);
    return normalizePathText(right.cwd).length - normalizePathText(left.cwd).length;
  });
}

function selectDelegationCandidate(candidates) {
  if (!candidates.length) return { candidate: null, ambiguous: false };
  const top = candidates[0];
  if (candidates.length === 1) return { candidate: top, ambiguous: false };
  const second = candidates[1];
  if (top.pathMatch && second.pathMatch) {
    const topPath = normalizePathText(top.cwd).toLowerCase();
    const secondPath = normalizePathText(second.cwd).toLowerCase();
    if (topPath.length > secondPath.length && topPath.startsWith(`${secondPath}/`)) {
      return { candidate: top, ambiguous: false };
    }
  }
  if (top.score - second.score >= 0.1) return { candidate: top, ambiguous: false };
  return { candidate: null, ambiguous: true };
}

function analyzeWorkspaceDelegation(input = {}) {
  const text = stringValue(input.text);
  const currentThread = input.currentThread && typeof input.currentThread === "object" ? input.currentThread : {};
  const attachmentsCount = Number(input.attachmentsCount || 0);
  const activeTurnId = stringValue(input.activeTurnId);
  if (!text) return { shouldDelegate: false, reason: "empty_text" };
  if (attachmentsCount > 0) return { shouldDelegate: false, reason: "attachments_not_delegated" };
  if (activeTurnId) return { shouldDelegate: false, reason: "active_turn_not_delegated" };
  if (isExplicitTaskCardCommand(text)) return { shouldDelegate: false, reason: "explicit_task_card_command" };
  if (hasNegativeDelegationCue(text)) return { shouldDelegate: false, reason: "negative_delegation_cue" };
  const candidates = collectDelegationCandidates(text, currentThread, input.threads || []);
  const selected = selectDelegationCandidate(candidates);
  if (selected.ambiguous) {
    return {
      shouldDelegate: false,
      reason: "ambiguous_target",
      candidates: candidates.slice(0, 4).map((entry) => ({
        threadId: entry.threadId,
        title: entry.title,
        cwd: entry.cwd,
        reason: entry.reason,
      })),
    };
  }
  if (!selected.candidate) return { shouldDelegate: false, reason: "no_target_match" };
  const candidate = selected.candidate;
  return {
    shouldDelegate: true,
    reason: candidate.reason,
    confidence: candidate.score,
    sourceThreadId: stringValue(currentThread.id),
    sourceThreadTitle: threadTitle(currentThread) || stringValue(currentThread.id),
    sourceWorkspaceId: stringValue(currentThread.cwd),
    targetThreadId: candidate.threadId,
    targetThreadTitle: candidate.title,
    targetWorkspaceId: candidate.cwd,
    targetMatch: {
      path: Boolean(candidate.pathMatch),
      alias: candidate.aliasMatch || "",
    },
  };
}

function buildWorkspaceDelegationTaskCardPayload(input = {}) {
  const analysis = input.analysis && typeof input.analysis === "object" ? input.analysis : {};
  if (!analysis.shouldDelegate || !analysis.targetThreadId) return null;
  const text = boundedVisibleText(input.text, MAX_VISIBLE_REQUEST_CHARS);
  const sourceThread = input.currentThread && typeof input.currentThread === "object" ? input.currentThread : {};
  const sourceThreadId = stringValue(analysis.sourceThreadId || sourceThread.id);
  const sourceTitle = truncateSingleLine(analysis.sourceThreadTitle || threadTitle(sourceThread) || sourceThreadId, 120);
  const targetTitle = truncateSingleLine(analysis.targetThreadTitle || analysis.targetThreadId, 120);
  const body = boundedVisibleText([
    "## Cross-workspace delegation",
    "",
    `Source thread: ${sourceTitle || sourceThreadId}`,
    `Source workspace: ${analysis.sourceWorkspaceId || stringValue(sourceThread.cwd) || "(unknown)"}`,
    `Target thread: ${targetTitle || analysis.targetThreadId}`,
    `Target workspace: ${analysis.targetWorkspaceId || "(unknown)"}`,
    "",
    "## User request",
    "",
    "```text",
    text.replace(/```/g, "` ` `"),
    "```",
    "",
    "## Execution boundary",
    "",
    "- Handle this request inside the target workspace/thread.",
    "- Do not modify the source workspace for this delegated task unless the user explicitly asks for that later.",
    "- If the work needs source-thread follow-up, reply with a cross-thread task card instead of editing across workspaces directly.",
  ].join("\n"), MAX_TASK_BODY_CHARS);
  return {
    sourceThreadId,
    sourceWorkspaceId: analysis.sourceWorkspaceId || stringValue(sourceThread.cwd),
    sourceThreadTitle: sourceTitle || sourceThreadId,
    targetThreadId: analysis.targetThreadId,
    targetThreadIds: [analysis.targetThreadId],
    targetWorkspaceId: analysis.targetWorkspaceId || "",
    targetWorkspaceIds: analysis.targetWorkspaceId ? { [analysis.targetThreadId]: analysis.targetWorkspaceId } : {},
    idempotencyKey: `workspace-delegation:${stableTextHash(sourceThreadId)}:${stableTextHash(analysis.targetThreadId)}:${stableTextHash(text)}`,
    format: "markdown",
    title: truncateSingleLine(`跨工作区委派：${targetTitle || analysis.targetThreadId}`, 120),
    summary: truncateSingleLine(`当前线程识别到任务属于 ${targetTitle || analysis.targetThreadId}，已通过任务卡委派到目标线程。`, 280),
    body,
    workflowMode: "manual",
    autoApprove: true,
    direct: true,
  };
}

module.exports = {
  analyzeWorkspaceDelegation,
  buildWorkspaceDelegationTaskCardPayload,
  hasExplicitDelegationCue,
  hasMutationCue,
  hasNegativeDelegationCue,
  isExplicitTaskCardCommand,
  normalizePathText,
  textContainsWorkspacePath,
};
