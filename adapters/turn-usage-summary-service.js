"use strict";

const TOKEN_USAGE_KEYS = [
  "inputTokens",
  "cachedInputTokens",
  "outputTokens",
  "reasoningOutputTokens",
  "totalTokens",
];

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function timestampMs(value) {
  if (Number.isFinite(Number(value))) return Number(value);
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusText(status) {
  if (typeof status === "string") return status;
  if (status && typeof status === "object") return String(status.type || status.status || status.state || "");
  return "";
}

function isCompletedStatus(status) {
  return /completed|failed|cancel|error|interrupted/i.test(statusText(status));
}

function rolloutEntryTurnId(entry) {
  const payload = entry && entry.payload;
  return String((payload && (
    payload.turn_id
    || payload.turnId
    || (payload.turn && payload.turn.id)
    || (payload.turn && payload.turn.turn_id)
  )) || entry.turn_id || entry.turnId || "");
}

function usageValue(usage, snakeKey, camelKey) {
  if (!usage || typeof usage !== "object") return null;
  return numberValue(usage[snakeKey] ?? usage[camelKey]);
}

function compactTokenUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  const compacted = {
    inputTokens: usageValue(usage, "input_tokens", "inputTokens"),
    cachedInputTokens: usageValue(usage, "cached_input_tokens", "cachedInputTokens"),
    outputTokens: usageValue(usage, "output_tokens", "outputTokens"),
    reasoningOutputTokens: usageValue(usage, "reasoning_output_tokens", "reasoningOutputTokens"),
    totalTokens: usageValue(usage, "total_tokens", "totalTokens"),
  };
  if (compacted.totalTokens === null && compacted.inputTokens !== null && compacted.outputTokens !== null) {
    compacted.totalTokens = compacted.inputTokens + compacted.outputTokens;
  }
  return Object.fromEntries(Object.entries(compacted).filter(([, value]) => value !== null));
}

function numericUsageValue(usage, key) {
  if (!usage || typeof usage !== "object") return null;
  const value = Number(usage && usage[key]);
  return Number.isFinite(value) ? value : null;
}

function tokenUsageHasPositiveComponent(usage) {
  return TOKEN_USAGE_KEYS.filter((key) => key !== "totalTokens").some((key) => {
    const value = numericUsageValue(usage, key);
    return value !== null && value > 0;
  });
}

function tokenUsageHasAnyValue(usage) {
  return TOKEN_USAGE_KEYS.some((key) => numericUsageValue(usage, key) !== null);
}

function cloneTokenUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  const cloned = {};
  for (const key of TOKEN_USAGE_KEYS) {
    const value = numericUsageValue(usage, key);
    if (value !== null) cloned[key] = value;
  }
  return Object.keys(cloned).length ? cloned : null;
}

function addTokenUsage(total, delta) {
  const next = cloneTokenUsage(total) || {};
  for (const key of TOKEN_USAGE_KEYS) {
    const value = numericUsageValue(delta, key);
    if (value === null) continue;
    next[key] = (numericUsageValue(next, key) || 0) + value;
  }
  return next;
}

function comparableTokenUsageDelta(current, previous) {
  if (!tokenUsageHasAnyValue(current) || !tokenUsageHasAnyValue(previous)) return null;
  const delta = {};
  let compared = false;
  for (const key of TOKEN_USAGE_KEYS) {
    const currentValue = numericUsageValue(current, key);
    if (currentValue === null) continue;
    const previousValue = numericUsageValue(previous, key);
    if (previousValue === null) continue;
    if (currentValue < previousValue) return null;
    delta[key] = currentValue - previousValue;
    compared = true;
  }
  return compared ? delta : null;
}

function eventTokenUsageDelta(summary, previousTotalTokenUsage) {
  const totalDelta = comparableTokenUsageDelta(
    summary && summary.totalTokenUsage,
    previousTotalTokenUsage,
  );
  if (totalDelta) return totalDelta;
  return cloneTokenUsage(summary && summary.lastTokenUsage);
}

function summaryWithTurnTokenUsage(summary, turnTokenUsage) {
  if (!summary || typeof summary !== "object") return summary;
  const normalizedTurnUsage = cloneTokenUsage(turnTokenUsage)
    || cloneTokenUsage(summary.lastTokenUsage)
    || {};
  return Object.assign({}, summary, {
    finalTokenUsage: cloneTokenUsage(summary.lastTokenUsage) || {},
    turnTokenUsage: normalizedTurnUsage,
    lastTokenUsage: normalizedTurnUsage,
  });
}

function tokenUsageTotalIsZero(usage) {
  const total = numericUsageValue(usage, "totalTokens");
  return total !== null && total === 0;
}

function isZeroWindowTokenCountSentinel(lastTokenUsage, totalTokenUsage, modelContextWindow) {
  const window = numberValue(modelContextWindow);
  const total = numericUsageValue(totalTokenUsage, "totalTokens");
  return Boolean(
    window
    && total === window
    && tokenUsageTotalIsZero(lastTokenUsage)
    && !tokenUsageHasPositiveComponent(lastTokenUsage)
    && !tokenUsageHasPositiveComponent(totalTokenUsage)
  );
}

function contextRiskLevel(percent) {
  const value = Number(percent);
  if (!Number.isFinite(value)) return "unknown";
  if (value >= 95) return "critical";
  if (value >= 85) return "high";
  if (value >= 70) return "warn";
  return "normal";
}

function tokenCountSummaryFromPayload(payload, meta = {}) {
  if (!payload || payload.type !== "token_count" || !payload.info || typeof payload.info !== "object") return null;
  const info = payload.info;
  const lastTokenUsage = compactTokenUsage(info.last_token_usage || info.lastTokenUsage);
  const totalTokenUsage = compactTokenUsage(info.total_token_usage || info.totalTokenUsage);
  if (!lastTokenUsage && !totalTokenUsage) return null;
  const modelContextWindow = numberValue(info.model_context_window ?? info.modelContextWindow);
  if (isZeroWindowTokenCountSentinel(lastTokenUsage, totalTokenUsage, modelContextWindow)) return null;
  const contextWindowUsedTokens = lastTokenUsage && Number.isFinite(Number(lastTokenUsage.inputTokens))
    ? Number(lastTokenUsage.inputTokens)
    : null;
  const contextWindowUsedPercent = modelContextWindow && contextWindowUsedTokens !== null
    ? (contextWindowUsedTokens / modelContextWindow) * 100
    : null;
  return {
    turnId: String(meta.turnId || ""),
    timestampMs: timestampMs(meta.timestamp),
    timestamp: meta.timestamp ? String(meta.timestamp) : "",
    modelContextWindow,
    contextWindowUsedTokens,
    contextWindowUsedPercent,
    contextRiskLevel: contextRiskLevel(contextWindowUsedPercent),
    lastTokenUsage: lastTokenUsage || {},
    totalTokenUsage: totalTokenUsage || {},
  };
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch (_) {
    return null;
  }
}

function collectTurnUsageSummariesFromEntries(entries) {
  const byTurnId = new Map();
  const unscoped = [];
  let currentTurnId = "";
  let previousTotalTokenUsage = null;
  for (const entry of entries || []) {
    if (!entry || !entry.payload) continue;
    const payload = entry.payload || {};
    const explicitTurnId = rolloutEntryTurnId(entry);
    if (entry.type === "turn_context" && explicitTurnId) currentTurnId = explicitTurnId;
    if (entry.type === "event_msg" && payload.type === "task_started" && explicitTurnId) currentTurnId = explicitTurnId;
    if (entry.type !== "event_msg" || payload.type !== "token_count") continue;
    const turnId = explicitTurnId || currentTurnId || "";
    const summary = tokenCountSummaryFromPayload(payload, {
      turnId,
      timestamp: entry.timestamp,
    });
    if (!summary) continue;
    const usageDelta = eventTokenUsageDelta(summary, previousTotalTokenUsage);
    if (turnId) {
      const accumulator = byTurnId.get(turnId) || {
        latestSummary: null,
        turnTokenUsage: {},
      };
      accumulator.latestSummary = summary;
      accumulator.turnTokenUsage = addTokenUsage(accumulator.turnTokenUsage, usageDelta);
      byTurnId.set(turnId, accumulator);
    } else {
      unscoped.push(summaryWithTurnTokenUsage(summary, usageDelta));
    }
    if (tokenUsageHasAnyValue(summary.totalTokenUsage)) previousTotalTokenUsage = summary.totalTokenUsage;
  }
  const normalizedByTurnId = new Map();
  for (const [turnId, accumulator] of byTurnId.entries()) {
    normalizedByTurnId.set(
      turnId,
      summaryWithTurnTokenUsage(accumulator.latestSummary, accumulator.turnTokenUsage),
    );
  }
  return { byTurnId: normalizedByTurnId, unscoped };
}

function collectTurnUsageSummariesFromRolloutText(text) {
  const entries = String(text || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseJsonLine)
    .filter(Boolean);
  return collectTurnUsageSummariesFromEntries(entries);
}

function turnIdentifier(turn) {
  return String(turn && (turn.id || turn.turnId) || "");
}

function removeExistingSummaryItems(items) {
  return (items || []).filter((item) => !item || item.type !== "turnUsageSummary");
}

function turnUsageSummaryItem(turn, summary, options = {}) {
  const rolloutStats = options.rolloutStats || {};
  const turnId = turnIdentifier(turn);
  const mobileUsageSummary = Object.assign({}, summary || {}, {
    rolloutSizeBytes: numberValue(rolloutStats.sizeBytes),
    rolloutWarningThresholdBytes: numberValue(rolloutStats.warningThresholdBytes),
    rolloutOverWarningThreshold: Boolean(rolloutStats.overWarningThreshold),
  });
  return {
    id: `mobile-turn-usage-${turnId || mobileUsageSummary.timestampMs || "summary"}`,
    type: "turnUsageSummary",
    startedAtMs: mobileUsageSummary.timestampMs || undefined,
    startedAt: mobileUsageSummary.timestampMs ? new Date(mobileUsageSummary.timestampMs).toISOString() : undefined,
    mobileUsageSummary,
  };
}

function attachTurnUsageSummaries(thread, summaries, options = {}) {
  if (!thread || typeof thread !== "object" || !Array.isArray(thread.turns) || !summaries) return thread;
  const byTurnId = summaries.byTurnId instanceof Map ? summaries.byTurnId : new Map();
  const latestUnscoped = Array.isArray(summaries.unscoped) && summaries.unscoped.length
    ? summaries.unscoped[summaries.unscoped.length - 1]
    : null;
  const completedTurns = thread.turns.filter((turn) => isCompletedStatus(turn && turn.status));
  const latestCompletedTurn = completedTurns.length ? completedTurns[completedTurns.length - 1] : null;
  for (const turn of thread.turns) {
    if (!turn || typeof turn !== "object") continue;
    turn.items = removeExistingSummaryItems(Array.isArray(turn.items) ? turn.items : []);
    if (!isCompletedStatus(turn.status)) continue;
    const turnId = turnIdentifier(turn);
    const summary = (turnId && byTurnId.get(turnId))
      || (latestUnscoped && latestCompletedTurn === turn ? latestUnscoped : null);
    if (!summary) continue;
    turn.items.push(turnUsageSummaryItem(turn, summary, options));
  }
  return thread;
}

module.exports = {
  attachTurnUsageSummaries,
  collectTurnUsageSummariesFromEntries,
  collectTurnUsageSummariesFromRolloutText,
  compactTokenUsage,
  contextRiskLevel,
  isZeroWindowTokenCountSentinel,
  tokenCountSummaryFromPayload,
  turnUsageSummaryItem,
};
