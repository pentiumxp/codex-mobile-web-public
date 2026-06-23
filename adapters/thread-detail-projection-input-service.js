"use strict";

function statusText(status) {
  if (!status) return "";
  if (typeof status === "string") return status;
  return String(status.type || JSON.stringify(status));
}

function timestampToMs(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value > 1_000_000_000_000 ? value : value * 1000;
  }
  if (/^\d+(?:\.\d+)?$/.test(String(value))) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function rolloutPathForThread(thread) {
  return String(thread && (thread.path || thread.rolloutPath || thread.rollout_path) || "");
}

function summaryUpdatedAtMs(summary, parseTimestamp = timestampToMs) {
  return parseTimestamp(summary && (summary.updatedAt || summary.updated_at || summary.updatedAtMs || summary.updated_at_ms));
}

function createThreadDetailProjectionInputService(options = {}) {
  const maxTurns = Math.max(1, Number(options.maxTurns || 1));
  const rolloutStatsForPath = typeof options.rolloutStatsForPath === "function" ? options.rolloutStatsForPath : () => null;
  const parseTimestamp = typeof options.timestampToMs === "function" ? options.timestampToMs : timestampToMs;
  const statusTextForSummary = typeof options.statusText === "function" ? options.statusText : statusText;

  function projectionInput(threadId, summary) {
    const id = String(threadId || "").trim();
    const rolloutPath = rolloutPathForThread(summary);
    const rolloutStats = rolloutStatsForPath(rolloutPath);
    if (!id || !rolloutPath || !rolloutStats) return null;
    return {
      threadId: id,
      rolloutPath,
      rolloutStats,
      maxTurns,
      summaryUpdatedAtMs: summaryUpdatedAtMs(summary, parseTimestamp),
      summaryStatus: statusTextForSummary(summary && summary.status),
    };
  }

  return {
    projectionInput,
  };
}

module.exports = {
  createThreadDetailProjectionInputService,
  rolloutPathForThread,
  statusText,
  summaryUpdatedAtMs,
  timestampToMs,
};
