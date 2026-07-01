"use strict";

function defaultLastString(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function createThreadRuntimeSettingsService(dependencies = {}) {
  const fs = dependencies.fs || require("node:fs");
  const latestRuntimeContextByPath = dependencies.latestRuntimeContextByPath || new Map();
  const maxRuntimeContextScanBytes = Math.max(1, Number(dependencies.maxRuntimeContextScanBytes || 32 * 1024 * 1024));
  const runtimeContextCacheTtlMs = Math.max(1, Number(dependencies.runtimeContextCacheTtlMs || 30_000));
  const runtimeContextCacheMax = Math.max(1, Number(dependencies.runtimeContextCacheMax || 200));
  const modelOptions = Array.isArray(dependencies.modelOptions) ? dependencies.modelOptions : [];
  const reasoningEffortOptions = Array.isArray(dependencies.reasoningEffortOptions) ? dependencies.reasoningEffortOptions : [];
  const codexConfigDefaults = dependencies.codexConfigDefaults || {};
  const approvalOptions = new Set(["untrusted", "on-request", "on-failure", "never"]);
  const reasoningSummaryOptions = new Set(["auto", "concise", "detailed", "none"]);
  const modelVerbosityOptions = new Set(["low", "medium", "high"]);

  const normalizeFsPath = typeof dependencies.normalizeFsPath === "function"
    ? dependencies.normalizeFsPath
    : (value) => String(value || "");
  const parseJsonLine = typeof dependencies.parseJsonLine === "function"
    ? dependencies.parseJsonLine
    : (line) => {
      try {
        return JSON.parse(line);
      } catch (_) {
        return null;
      }
    };
  const lastString = typeof dependencies.lastString === "function"
    ? dependencies.lastString
    : defaultLastString;
  const readStateDbThread = typeof dependencies.readStateDbThread === "function"
    ? dependencies.readStateDbThread
    : () => null;
  const readThreadSummaryFromAppServer = typeof dependencies.readThreadSummaryFromAppServer === "function"
    ? dependencies.readThreadSummaryFromAppServer
    : async () => null;
  const normalizeEnumValue = typeof dependencies.normalizeEnumValue === "function"
    ? dependencies.normalizeEnumValue
    : (value, allowed) => (allowed && allowed.has(value) ? value : "");
  const normalizeSandboxPolicy = typeof dependencies.normalizeSandboxPolicy === "function"
    ? dependencies.normalizeSandboxPolicy
    : () => ({ type: "" });
  const normalizePermissionProfile = typeof dependencies.normalizePermissionProfile === "function"
    ? dependencies.normalizePermissionProfile
    : () => ({ type: "" });
  const isFullAccessRuntime = typeof dependencies.isFullAccessRuntime === "function"
    ? dependencies.isFullAccessRuntime
    : () => false;
  const sandboxModeFromPolicy = typeof dependencies.sandboxModeFromPolicy === "function"
    ? dependencies.sandboxModeFromPolicy
    : () => "";

  function runtimeContextCacheKey(rolloutPath, stat) {
    return `${normalizeFsPath(rolloutPath)}:${stat.size}:${Math.trunc(Number(stat.mtimeMs || 0))}`;
  }

  function rememberRuntimeContext(key, payload) {
    latestRuntimeContextByPath.set(key, {
      cachedAt: Date.now(),
      payload: payload || null,
    });
    while (latestRuntimeContextByPath.size > runtimeContextCacheMax) {
      const firstKey = latestRuntimeContextByPath.keys().next().value;
      latestRuntimeContextByPath.delete(firstKey);
    }
  }

  function readLatestTurnContext(thread) {
    const rolloutPath = thread && (thread.path || thread.rolloutPath || thread.rollout_path);
    if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) return null;
    let fd = null;
    try {
      const stat = fs.statSync(rolloutPath);
      const cacheKey = runtimeContextCacheKey(rolloutPath, stat);
      const cached = latestRuntimeContextByPath.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt <= runtimeContextCacheTtlMs) {
        return cached.payload;
      }
      fd = fs.openSync(rolloutPath, "r");
      const chunkSize = 1024 * 1024;
      let position = stat.size;
      let scanned = 0;
      let carry = "";
      while (position > 0 && scanned < maxRuntimeContextScanBytes) {
        const length = Math.min(chunkSize, position, maxRuntimeContextScanBytes - scanned);
        position -= length;
        scanned += length;
        const buffer = Buffer.alloc(length);
        fs.readSync(fd, buffer, 0, length, position);
        const text = buffer.toString("utf8") + carry;
        const lines = text.split(/\r?\n/);
        carry = lines.shift() || "";
        for (let index = lines.length - 1; index >= 0; index -= 1) {
          const line = lines[index];
          if (!line || !line.includes('"type":"turn_context"')) continue;
          const entry = parseJsonLine(line);
          if (entry && entry.type === "turn_context" && entry.payload && typeof entry.payload === "object") {
            rememberRuntimeContext(cacheKey, entry.payload);
            return entry.payload;
          }
        }
      }
      if (carry && carry.includes('"type":"turn_context"')) {
        const entry = parseJsonLine(carry);
        if (entry && entry.type === "turn_context" && entry.payload && typeof entry.payload === "object") {
          rememberRuntimeContext(cacheKey, entry.payload);
          return entry.payload;
        }
      }
    } catch (_) {
      return null;
    } finally {
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch (_) {}
      }
    }
    try {
      const stat = fs.statSync(rolloutPath);
      rememberRuntimeContext(runtimeContextCacheKey(rolloutPath, stat), null);
    } catch (_) {}
    return null;
  }

  function threadRuntimeSettings(threadId, fallbackThread = null) {
    const thread = readStateDbThread(threadId) || fallbackThread;
    const context = readLatestTurnContext(thread) || {};
    const model = normalizeEnumValue(
      lastString(context.model, thread && thread.model, codexConfigDefaults.model),
      new Set(modelOptions),
    );
    const reasoningEffort = normalizeEnumValue(
      lastString(context.effort, context.reasoning_effort, context.model_reasoning_effort, thread && thread.effort, codexConfigDefaults.reasoningEffort),
      new Set(reasoningEffortOptions),
    );
    const sandboxPolicy = normalizeSandboxPolicy(context.sandbox_policy || (thread && thread.sandboxPolicy));
    const permissionProfile = normalizePermissionProfile(context.permission_profile || (thread && thread.permissionProfile));
    let approvalPolicy = normalizeEnumValue(
      lastString(context.approval_policy, thread && thread.approvalPolicy),
      approvalOptions,
    );
    if (isFullAccessRuntime(sandboxPolicy, permissionProfile) && (!approvalPolicy || approvalPolicy === "on-request")) {
      approvalPolicy = "never";
    }
    const reasoningSummary = normalizeEnumValue(
      lastString(context.summary, context.reasoning_summary, context.model_reasoning_summary, codexConfigDefaults.reasoningSummary),
      reasoningSummaryOptions,
    );
    const modelVerbosity = normalizeEnumValue(
      lastString(context.model_verbosity, codexConfigDefaults.modelVerbosity),
      modelVerbosityOptions,
    );
    return {
      model,
      reasoningEffort,
      approvalPolicy,
      sandboxPolicy,
      sandboxMode: sandboxModeFromPolicy(sandboxPolicy),
      permissionProfile,
      reasoningSummary,
      modelVerbosity,
    };
  }

  async function resolveThreadRuntimeSettings(threadId) {
    if (readStateDbThread(threadId)) return threadRuntimeSettings(threadId);
    let fallbackThread = null;
    try {
      fallbackThread = await readThreadSummaryFromAppServer(threadId);
    } catch (_) {
      fallbackThread = null;
    }
    return threadRuntimeSettings(threadId, fallbackThread);
  }

  return {
    latestRuntimeContextByPath,
    readLatestTurnContext,
    rememberRuntimeContext,
    resolveThreadRuntimeSettings,
    runtimeContextCacheKey,
    threadRuntimeSettings,
  };
}

module.exports = {
  createThreadRuntimeSettingsService,
};
