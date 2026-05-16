"use strict";

function normalizeId(value) {
  return String(value || "").trim();
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

module.exports = {
  shouldTrackTurnForWebPush,
};
