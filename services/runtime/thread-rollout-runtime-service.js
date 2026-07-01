"use strict";

function createThreadRolloutRuntimeService(dependencies = {}) {
  const fs = dependencies.fs || require("node:fs");
  const path = dependencies.path || require("node:path");
  const rolloutWarningBytes = Math.max(1, Number(dependencies.rolloutWarningBytes || 25 * 1024 * 1024));
  const continuationContextFileCompactBytes = Math.max(0, Number(dependencies.continuationContextFileCompactBytes || 0));
  const continuationContextHandoffPromptBytes = Math.max(0, Number(dependencies.continuationContextHandoffPromptBytes || 0));
  const continuationContextPairCompactBytes = Math.max(0, Number(dependencies.continuationContextPairCompactBytes || 0));
  const terminalIdleActiveTurnMs = Math.max(0, Number(dependencies.terminalIdleActiveTurnMs || 0));
  const staleActiveTurnMs = Math.max(0, Number(dependencies.staleActiveTurnMs || 0));
  const threadDetailRpcTimeoutMs = Math.max(0, Number(dependencies.threadDetailRpcTimeoutMs || 0));
  const nowMs = typeof dependencies.nowMs === "function" ? dependencies.nowMs : () => Date.now();
  const readStateDbThread = typeof dependencies.readStateDbThread === "function" ? dependencies.readStateDbThread : () => null;
  const readStartedThread = typeof dependencies.readStartedThread === "function" ? dependencies.readStartedThread : () => null;
  const detectStaleActiveTurnForSubmission = typeof dependencies.detectStaleActiveTurnForSubmission === "function"
    ? dependencies.detectStaleActiveTurnForSubmission
    : () => ({ stale: false, reason: "stale-detector-unavailable" });

  function rolloutPathForThread(thread) {
    return thread && (thread.path || thread.rolloutPath || thread.rollout_path) || "";
  }

  function rolloutStatsForPath(rolloutPath) {
    if (!rolloutPath || typeof rolloutPath !== "string") return null;
    try {
      const stat = fs.statSync(rolloutPath);
      if (!stat.isFile()) return null;
      return {
        sizeBytes: stat.size,
        mtimeMs: Math.trunc(Number(stat.mtimeMs || 0)),
        warningThresholdBytes: rolloutWarningBytes,
        overWarningThreshold: stat.size >= rolloutWarningBytes,
      };
    } catch (_) {
      return null;
    }
  }

  function fileSizeBytes(filePath) {
    if (!filePath || typeof filePath !== "string") return 0;
    try {
      const stat = fs.statSync(filePath);
      return stat.isFile() ? stat.size : 0;
    } catch (_) {
      return 0;
    }
  }

  function workspaceContextStatsForCwd(cwd) {
    const root = String(cwd || "").trim();
    if (!root) {
      return {
        projectContextSizeBytes: 0,
        handoffSizeBytes: 0,
        agentsSizeBytes: 0,
        workspaceContextPairSizeBytes: 0,
        fileThresholdBytes: continuationContextFileCompactBytes,
        handoffPromptThresholdBytes: continuationContextHandoffPromptBytes,
        pairThresholdBytes: continuationContextPairCompactBytes,
      };
    }
    const projectContextSizeBytes = fileSizeBytes(path.join(root, ".agent-context", "PROJECT_CONTEXT.md"));
    const handoffSizeBytes = fileSizeBytes(path.join(root, ".agent-context", "HANDOFF.md"));
    return {
      projectContextSizeBytes,
      handoffSizeBytes,
      agentsSizeBytes: fileSizeBytes(path.join(root, "AGENTS.md")),
      workspaceContextPairSizeBytes: projectContextSizeBytes + handoffSizeBytes,
      fileThresholdBytes: continuationContextFileCompactBytes,
      handoffPromptThresholdBytes: continuationContextHandoffPromptBytes,
      pairThresholdBytes: continuationContextPairCompactBytes,
    };
  }

  function annotateThreadRolloutStats(thread, options = {}) {
    if (!thread || typeof thread !== "object") return thread;
    const out = Object.assign({}, thread);
    out.rolloutWarningThresholdBytes = rolloutWarningBytes;
    const hasExistingRolloutStats = Number.isFinite(Number(out.rolloutSizeBytes))
      && Number.isFinite(Number(out.rolloutSizeUpdatedAtMs));
    if (options.preferExistingRolloutStats === true && hasExistingRolloutStats) {
      if (typeof out.rolloutOverWarningThreshold !== "boolean") {
        out.rolloutOverWarningThreshold = Number(out.rolloutSizeBytes || 0) >= rolloutWarningBytes;
      }
      return out;
    }
    const readRolloutStats = typeof options.rolloutStatsForPath === "function"
      ? options.rolloutStatsForPath
      : rolloutStatsForPath;
    const stats = readRolloutStats(rolloutPathForThread(out));
    if (!stats) return out;
    out.rolloutSizeBytes = stats.sizeBytes;
    out.rolloutSizeUpdatedAtMs = stats.mtimeMs;
    out.rolloutOverWarningThreshold = stats.overWarningThreshold;
    return out;
  }

  async function staleActiveTurnPreflight(codexClient, threadId, activeTurnId) {
    if (!activeTurnId) return { stale: false, reason: "no-active-turn" };
    const summary = readStateDbThread(threadId) || readStartedThread(threadId);
    const rolloutStats = summary ? rolloutStatsForPath(rolloutPathForThread(summary)) : null;
    if (!rolloutStats) return { stale: false, reason: "no-rollout-stats" };
    if (nowMs() - rolloutStats.mtimeMs < terminalIdleActiveTurnMs) {
      return { stale: false, reason: "rollout-recent" };
    }
    let turnsResult = null;
    try {
      turnsResult = await codexClient.request("thread/turns/list", {
        threadId,
        limit: 20,
        sortDirection: "desc",
      }, { timeoutMs: threadDetailRpcTimeoutMs, retry: false, resetOnTimeout: false });
    } catch (err) {
      return {
        stale: false,
        reason: "turns-list-error",
        error: err.message || String(err),
      };
    }
    return detectStaleActiveTurnForSubmission({
      activeTurnId,
      threadId,
      turnsResult,
      rolloutStats,
      pendingServerRequests: codexClient.pendingServerRequests(),
      nowMs: nowMs(),
      staleMs: staleActiveTurnMs,
      terminalIdleMs: terminalIdleActiveTurnMs,
    });
  }

  return {
    rolloutPathForThread,
    rolloutStatsForPath,
    fileSizeBytes,
    workspaceContextStatsForCwd,
    annotateThreadRolloutStats,
    staleActiveTurnPreflight,
  };
}

module.exports = {
  createThreadRolloutRuntimeService,
};
