"use strict";

function createThreadSummaryReadModelService(options = {}) {
  const fs = options.fs || require("node:fs");
  const path = options.path || require("node:path");
  const codexHome = String(options.codexHome || "");
  const globalStateFiles = uniqueStrings([
    path.join(codexHome, ".codex-global-state.json"),
    ...(Array.isArray(options.globalStateFiles) ? options.globalStateFiles : []),
  ]);
  const maxStartThreadDeveloperInstructionsChars = Math.max(0, Number(options.maxStartThreadDeveloperInstructionsChars || 0));
  const startedThreadCacheTtlMs = Math.max(0, Number(options.startedThreadCacheTtlMs || 0));
  const startedThreadCacheMax = Math.max(1, Number(options.startedThreadCacheMax || 80));
  const readRpcTimeoutMs = Number(options.readRpcTimeoutMs || 0);
  const recentStartedThreads = options.recentStartedThreads instanceof Map ? options.recentStartedThreads : new Map();
  const readJsonFile = typeof options.readJsonFile === "function" ? options.readJsonFile : () => ({});
  const writeRuntimeJson = typeof options.writeRuntimeJson === "function" ? options.writeRuntimeJson : () => {};
  const annotateThreadRolloutStats = typeof options.annotateThreadRolloutStats === "function" ? options.annotateThreadRolloutStats : (thread) => thread;
  const upsertThreadListFallbackCacheThread = typeof options.upsertThreadListFallbackCacheThread === "function"
    ? options.upsertThreadListFallbackCacheThread
    : () => false;
  const normalizeStaleContextOnlyActiveThread = typeof options.normalizeStaleContextOnlyActiveThread === "function"
    ? options.normalizeStaleContextOnlyActiveThread
    : (thread) => thread;
  const threadDisplaySummaryCache = options.threadDisplaySummaryCache && typeof options.threadDisplaySummaryCache.remember === "function"
    ? options.threadDisplaySummaryCache
    : { remember: (thread) => thread };
  const isRecoverableThreadListTitle = typeof options.isRecoverableThreadListTitle === "function"
    ? options.isRecoverableThreadListTitle
    : () => false;
  const requestThreadTitleUpdate = typeof options.requestThreadTitleUpdate === "function"
    ? options.requestThreadTitleUpdate
    : async () => false;
  const logger = options.logger || console;
  const now = typeof options.now === "function" ? options.now : Date.now;

  function uniqueStrings(values) {
    const seen = new Set();
    const result = [];
    for (const value of Array.isArray(values) ? values : []) {
      const text = String(value || "").trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      result.push(text);
    }
    return result;
  }

  function mergeGlobalStateValue(current, next) {
    if (Array.isArray(next)) {
      const values = Array.isArray(current) ? current.slice() : [];
      for (const value of next) {
        if (values.includes(value)) continue;
        values.push(value);
      }
      return values;
    }
    if (
      next
      && typeof next === "object"
      && !Array.isArray(next)
      && current
      && typeof current === "object"
      && !Array.isArray(current)
    ) {
      return Object.assign({}, current, next);
    }
    return next;
  }

  function mergeGlobalStateEntries(entries) {
    const merged = {};
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      for (const [key, value] of Object.entries(entry)) {
        merged[key] = mergeGlobalStateValue(merged[key], value);
      }
    }
    return merged;
  }

  function readGlobalStateFile(file) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (_) {
      return {};
    }
  }

  function readGlobalState() {
    return mergeGlobalStateEntries(globalStateFiles.map(readGlobalStateFile));
  }

  function rememberProjectlessThreadId(threadId) {
    const id = String(threadId || "").trim();
    if (!id) return false;
    const file = path.join(codexHome, ".codex-global-state.json");
    try {
      const state = readJsonFile(file, {});
      const existing = Array.isArray(state["projectless-thread-ids"]) ? state["projectless-thread-ids"] : [];
      if (existing.includes(id)) return false;
      state["projectless-thread-ids"] = existing.concat([id]);
      writeRuntimeJson(file, state);
      return true;
    } catch (err) {
      if (logger && typeof logger.warn === "function") {
        logger.warn(`Failed to update projectless thread ids: ${err.message || String(err)}`);
      }
      return false;
    }
  }

  function agentInstructionFilesForCwd(cwd) {
    const files = [];
    if (!cwd || typeof cwd !== "string") return files;
    let current = path.resolve(cwd);
    for (;;) {
      const candidate = path.join(current, "AGENTS.md");
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) files.push(candidate);
      } catch (_) {}
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return files.reverse();
  }

  function readStartThreadDeveloperInstructions(cwd) {
    const chunks = [];
    let remaining = maxStartThreadDeveloperInstructionsChars;
    for (const file of agentInstructionFilesForCwd(cwd)) {
      if (remaining <= 0) break;
      try {
        const text = fs.readFileSync(file, "utf8");
        const header = `# Instructions from ${file}\n\n`;
        const body = text.slice(0, Math.max(0, remaining - header.length));
        if (body.trim()) {
          chunks.push(`${header}${body}`);
          remaining -= header.length + body.length;
        }
      } catch (_) {}
    }
    return chunks.join("\n\n").trim() || null;
  }

  function threadIdFromStartResult(result) {
    return String((result && result.thread && result.thread.id)
      || (result && result.data && result.data.thread && result.data.thread.id)
      || (result && result.threadId)
      || (result && result.id)
      || "");
  }

  async function tryUpdateThreadTitle(threadId, title) {
    if (!threadId || !title) return false;
    const attempts = [
      ["thread/name/set", { threadId, name: title }],
      ["thread/updateTitle", { threadId, title }],
      ["thread/update_title", { threadId, title }],
      ["thread/setTitle", { threadId, title }],
      ["thread/rename", { threadId, title }],
      ["thread/update", { threadId, title }],
      ["thread/update", { threadId, threadName: title }],
    ];
    for (const [method, params] of attempts) {
      try {
        await requestThreadTitleUpdate(method, params, { timeoutMs: readRpcTimeoutMs, retry: false });
        return true;
      } catch (err) {
        if (!/method not found|unknown method|not found|invalid params|invalid request/i.test(err.message || "")) {
          throw err;
        }
      }
    }
    return false;
  }

  function isRecoverableThreadTitleUpdateError(err) {
    const message = String((err && err.message) || "");
    return /thread metadata unavailable before name update|metadata unavailable before name update|database disk image is malformed/i.test(message);
  }

  function pruneStartedThreadCache(currentTimeMs = now()) {
    for (const [threadId, entry] of recentStartedThreads) {
      if (!entry || currentTimeMs - entry.cachedAt > startedThreadCacheTtlMs) recentStartedThreads.delete(threadId);
    }
    while (recentStartedThreads.size > startedThreadCacheMax) {
      const firstKey = recentStartedThreads.keys().next().value;
      if (!firstKey) break;
      recentStartedThreads.delete(firstKey);
    }
  }

  function rememberStartedThread(thread) {
    const threadId = thread && thread.id;
    if (!threadId) return null;
    pruneStartedThreadCache();
    const summary = annotateThreadRolloutStats(Object.assign({
      preview: threadId,
      updatedAt: Math.floor(now() / 1000),
      status: { type: "notLoaded" },
      turns: [],
      mobileReadMode: "unmaterialized",
    }, thread, { id: threadId }));
    recentStartedThreads.set(String(threadId), {
      cachedAt: now(),
      thread: summary,
    });
    pruneStartedThreadCache();
    upsertThreadListFallbackCacheThread(summary, { addIfMissing: true });
    return summary;
  }

  function readStartedThread(threadId) {
    pruneStartedThreadCache();
    const entry = recentStartedThreads.get(String(threadId || ""));
    return entry && entry.thread ? annotateThreadRolloutStats(entry.thread) : null;
  }

  async function readThreadSummaryFromAppServer(codexClient, threadId) {
    if (!threadId || !codexClient || typeof codexClient.request !== "function") return null;
    const result = await codexClient.request("thread/list", {
      limit: 1000,
      sortKey: "updated_at",
      sortDirection: "desc",
      archived: false,
      useStateDbOnly: true,
      sourceKinds: [],
    }, readRpcTimeoutMs ? { timeoutMs: readRpcTimeoutMs } : undefined);
    const threads = Array.isArray(result && result.data)
      ? result.data
      : Array.isArray(result && result.threads)
        ? result.threads
        : [];
    const thread = threads.find((candidate) => String(candidate && candidate.id) === String(threadId)) || null;
    return normalizeStaleContextOnlyActiveThread(threadDisplaySummaryCache.remember(thread) || annotateThreadRolloutStats(thread));
  }

  function truncateSingleLine(value, maxChars = 96) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text || text.length <= maxChars) return text;
    return `${text.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
  }

  function threadDisplayTitle(thread) {
    if (!thread || typeof thread !== "object") return "";
    const id = String(thread.id || thread.threadId || "").trim();
    for (const value of [
      thread.displayTitle,
      thread.threadTitle,
      thread.thread_name,
      thread.name,
      thread.title,
      thread.preview,
    ]) {
      const text = String(value || "").trim();
      if (text && !isRecoverableThreadListTitle(text, id)) return text;
    }
    return id;
  }

  return {
    agentInstructionFilesForCwd,
    isRecoverableThreadTitleUpdateError,
    pruneStartedThreadCache,
    readGlobalState,
    readStartedThread,
    readStartThreadDeveloperInstructions,
    readThreadSummaryFromAppServer,
    rememberProjectlessThreadId,
    rememberStartedThread,
    threadDisplayTitle,
    threadIdFromStartResult,
    truncateSingleLine,
    tryUpdateThreadTitle,
  };
}

module.exports = {
  createThreadSummaryReadModelService,
};
