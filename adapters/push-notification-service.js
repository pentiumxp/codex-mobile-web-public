"use strict";

function normalizeId(value) {
  return String(value || "").trim();
}

function compactNotificationText(value, maxChars = 80) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 3))}...`;
}

function firstCompactText(values, maxChars = 80) {
  for (const value of values) {
    const text = compactNotificationText(value, maxChars);
    if (text) return text;
  }
  return "";
}

function hasOwn(object, key) {
  return Boolean(object && typeof object === "object" && Object.prototype.hasOwnProperty.call(object, key));
}

function valueHasFinalAgentMessage(value) {
  if (value == null || value === false) return false;
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return true;
  return Boolean(value);
}

function completedTurnHasNoFinalAgentMessage(params) {
  const containers = [
    params,
    params && params.turn,
  ];
  const keys = [
    "lastAgentMessage",
    "last_agent_message",
    "finalAgentMessage",
    "final_agent_message",
  ];
  for (const container of containers) {
    for (const key of keys) {
      if (hasOwn(container, key)) return !valueHasFinalAgentMessage(container[key]);
    }
  }
  return false;
}

function shouldTrackTurnForWebPush(meta, deps = {}) {
  if (normalizeId(meta && (meta.agentNickname || meta.agentRole))) {
    return { track: false, reason: "subagent-thread-metadata" };
  }
  const threadId = normalizeId(meta && meta.threadId);
  if (!threadId) {
    return deps.allowMissingThreadId
      ? { track: true, reason: "pending-thread-id" }
      : { track: false, reason: "missing-thread-id" };
  }
  if (typeof deps.classifyThread === "function") {
    try {
      const classification = String(deps.classifyThread(threadId) || "").trim().toLowerCase();
      if (classification === "subagent" || classification === "child" || classification === "agent") {
        return { track: false, reason: "subagent-thread" };
      }
      if (classification === "main" || classification === "parent" || classification === "normal") {
        return { track: true, reason: "" };
      }
      return { track: false, reason: "unknown-thread" };
    } catch (_) {
      return { track: false, reason: "thread-lookup-failed" };
    }
  }
  const isSubagentThread = deps.isSubagentThread || deps.isSpawnedChildThread;
  if (typeof isSubagentThread !== "function") {
    return { track: true, reason: "" };
  }
  try {
    if (isSubagentThread(threadId)) {
      return { track: false, reason: "subagent-thread" };
    }
  } catch (_) {
    return { track: true, reason: "" };
  }
  return { track: true, reason: "" };
}

function explicitThreadTitleFromParams(params) {
  return firstCompactText([
    params && params.threadTitle,
    params && params.threadName,
    params && params.thread && params.thread.name,
    params && params.thread && params.thread.title,
    params && params.thread && params.thread.displayName,
    params && params.thread && params.thread.display_name,
    params && params.turn && params.turn.threadTitle,
    params && params.turn && params.turn.threadName,
    params && params.turn && params.turn.thread && params.turn.thread.name,
    params && params.turn && params.turn.thread && params.turn.thread.title,
    params && params.turn && params.turn.thread && params.turn.thread.displayName,
    params && params.turn && params.turn.thread && params.turn.thread.display_name,
  ]);
}

function previewThreadTitleFromParams(params) {
  return firstCompactText([
    params && params.thread && params.thread.preview,
    params && params.turn && params.turn.thread && params.turn.thread.preview,
  ]);
}

function resolveThreadTitleForNotification(input = {}) {
  const params = input.params || null;
  const summary = input.summary && typeof input.summary === "object" ? input.summary : {};
  const threadId = normalizeId(input.threadId);
  return firstCompactText([
    explicitThreadTitleFromParams(params),
    summary.name,
    input.existingTitle,
    previewThreadTitleFromParams(params),
    summary.preview,
    input.fallbackTitle,
    threadId,
    "Codex Mobile Web",
  ]);
}

function createThreadDisplaySummaryCache(options = {}) {
  const ttlMs = Math.max(60_000, Number(options.ttlMs || 7_200_000));
  const maxEntries = Math.max(1, Number(options.maxEntries || 500));
  const decorateSummary = typeof options.decorateSummary === "function"
    ? options.decorateSummary
    : (summary) => summary;
  const decorateOnRead = options.decorateOnRead !== false;
  const mergeSummary = typeof options.mergeSummary === "function"
    ? options.mergeSummary
    : null;
  const entries = new Map();

  function prune(now = Date.now()) {
    for (const [threadId, entry] of entries) {
      if (!entry || now - entry.cachedAt > ttlMs) entries.delete(threadId);
    }
    while (entries.size > maxEntries) {
      const firstKey = entries.keys().next().value;
      if (!firstKey) break;
      entries.delete(firstKey);
    }
  }

  function summaryFromThread(thread) {
    if (!thread || typeof thread !== "object") return null;
    const threadId = normalizeId(thread.id || thread.threadId || thread.thread_id);
    if (!threadId) return null;
    const name = compactNotificationText(
      thread.name
        || thread.title
        || thread.displayName
        || thread.display_name
        || thread.threadName
        || thread.thread_name
        || "",
      160,
    );
    const preview = compactNotificationText(
      thread.preview
        || thread.firstUserMessage
        || thread.first_user_message
        || "",
      240,
    );
    if (!name && !preview && !thread.cwd && !thread.rolloutPath && !thread.rollout_path) return null;
    const summary = Object.assign({}, thread, { id: threadId });
    if (name) summary.name = name;
    if (preview) summary.preview = preview;
    return decorateSummary(summary);
  }

  function remember(thread) {
    const summary = summaryFromThread(thread);
    if (!summary) return null;
    prune();
    const threadId = String(summary.id);
    const previous = entries.get(threadId);
    const merged = previous && previous.thread && mergeSummary
      ? (mergeSummary(previous.thread, summary) || summary)
      : summary;
    entries.set(threadId, {
      cachedAt: Date.now(),
      thread: merged,
    });
    return merged;
  }

  function rememberList(result) {
    if (!result || typeof result !== "object") return result;
    const threads = Array.isArray(result.data)
      ? result.data
      : Array.isArray(result.threads)
        ? result.threads
        : [];
    threads.forEach(remember);
    return result;
  }

  function read(threadId) {
    prune();
    const entry = entries.get(normalizeId(threadId));
    if (!entry || !entry.thread) return null;
    return decorateOnRead ? decorateSummary(entry.thread) : Object.assign({}, entry.thread);
  }

  return {
    remember,
    rememberList,
    read,
  };
}

module.exports = {
  completedTurnHasNoFinalAgentMessage,
  createThreadDisplaySummaryCache,
  resolveThreadTitleForNotification,
  shouldTrackTurnForWebPush,
};
