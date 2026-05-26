"use strict";

function normalizeId(value) {
  return String(value || "").trim();
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

module.exports = {
  completedTurnHasNoFinalAgentMessage,
  shouldTrackTurnForWebPush,
};
