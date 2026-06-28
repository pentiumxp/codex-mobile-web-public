"use strict";

function compactLabel(value, maxLength = 80) {
  return String(value || "").trim().slice(0, maxLength);
}

function lowerLabel(value, maxLength = 80) {
  return compactLabel(value, maxLength).toLowerCase();
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function booleanFlag(value) {
  return value === true;
}

function dominantSource(input = {}) {
  const sources = [
    { name: "state-db", ms: numberValue(input.fallbackStateDbMs), count: numberValue(input.fallbackStateDbCount) },
    { name: "rollout", ms: numberValue(input.fallbackRolloutMs), count: numberValue(input.fallbackRolloutCount) },
    { name: "session-index", ms: numberValue(input.fallbackSessionIndexMs), count: numberValue(input.fallbackSessionIndexCount) },
  ];
  const byTime = sources.slice().sort((left, right) => right.ms - left.ms)[0];
  if (byTime && byTime.ms > 0) return byTime.name;
  const byCount = sources.slice().sort((left, right) => right.count - left.count)[0];
  if (byCount && byCount.count > 0) return byCount.name;
  return "";
}

function baselineReason(prefix, input = {}) {
  const source = dominantSource(input);
  if (source) return `${prefix}:${source}`.slice(0, 80);
  const sourceCount = numberValue(input.fallbackBaselineSourceCount);
  const resultCount = numberValue(input.fallbackBaselineResultCount);
  if (!sourceCount && !resultCount) return `${prefix}:empty-baseline`.slice(0, 80);
  const finalFilterInputCount = numberValue(input.fallbackBaselineFinalFilterInputCount);
  const finalFilterOutputCount = numberValue(input.fallbackBaselineFinalFilterOutputCount);
  const mergeInputCount = numberValue(input.fallbackBaselineMergeInputCount);
  const mergeOutputCount = numberValue(input.fallbackBaselineMergeOutputCount);
  const mergeDuplicateCount = numberValue(input.fallbackBaselineMergeDuplicateCount);
  const limitDropCount = numberValue(input.fallbackBaselineLimitDropCount);
  if (finalFilterInputCount > 0 && finalFilterOutputCount === 0) {
    return `${prefix}:final-filter-empty`.slice(0, 80);
  }
  if (finalFilterInputCount > finalFilterOutputCount && finalFilterOutputCount > 0) {
    return `${prefix}:final-filter`.slice(0, 80);
  }
  if (mergeDuplicateCount > 0 || mergeInputCount > mergeOutputCount && mergeOutputCount > 0) {
    return `${prefix}:merge-dedupe`.slice(0, 80);
  }
  if (limitDropCount > 0) return `${prefix}:limit-drop`.slice(0, 80);
  return `${prefix}:baseline`.slice(0, 80);
}

function diagnoseThreadListColdPath(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const decision = lowerLabel(source.fallbackCacheDecision);
  const appServerError = compactLabel(source.appServerError, 80);
  const decorateMs = numberValue(source.decorateMs);
  const stateAttachMs = numberValue(source.stateAttachMs);
  const totalMs = numberValue(source.totalMs);

  if (stateAttachMs >= 50 && stateAttachMs >= Math.max(50, totalMs * 0.5)) {
    return {
      owner: "thread-list-state-attach",
      reason: "task-card-goal-state",
    };
  }

  if (decorateMs >= 50 && decorateMs >= Math.max(50, totalMs * 0.5)) {
    const queryCount = numberValue(source.tokenUsageQueryCount);
    const staleCacheHits = numberValue(source.tokenUsageStaleCacheHitCount);
    return {
      owner: "token-usage-decoration",
      reason: queryCount > 0 ? "sqlite-aggregate" : staleCacheHits > 0 ? "stale-cache" : "decorate",
    };
  }

  if (booleanFlag(source.fallbackDeferred)) {
    return {
      owner: "deferred-fallback",
      reason: compactLabel(source.fallbackDeferredReason, 80) || "deferred",
    };
  }

  if (appServerError) {
    return {
      owner: "app-server-thread-list",
      reason: "app-server-error-fallback",
    };
  }

  if (booleanFlag(source.appServerDeferred)) {
    const deferredReason = compactLabel(source.appServerDeferredReason, 80) || "app-server-deferred";
    if (
      deferredReason === "cold-fallback-initial"
      || decision === "miss-rebuild"
      || (!booleanFlag(source.fallbackCacheHit) && numberValue(source.fallbackMs) > 0)
    ) {
      return {
        owner: "fallback-baseline",
        reason: baselineReason("cold-fallback-initial", source),
      };
    }
    return {
      owner: "warm-fallback-cache",
      reason: deferredReason,
    };
  }

  if (decision === "hit" || booleanFlag(source.fallbackCacheHit)) {
    const incrementalUpdates = numberValue(source.fallbackCacheIncrementalUpdates);
    return {
      owner: "warm-fallback-cache",
      reason: incrementalUpdates > 0 ? "cache-hit-incremental" : "cache-hit",
    };
  }

  if (booleanFlag(source.fallbackSourceSnapshotHit) || booleanFlag(source.sourceSnapshotHit)) {
    return {
      owner: "fallback-source-snapshot",
      reason: "source-snapshot-hit",
    };
  }

  if (decision === "expired-rebuild") {
    return {
      owner: "fallback-cache-policy",
      reason: baselineReason("ttl-expired", source),
    };
  }

  if (decision === "miss-rebuild") {
    return {
      owner: "fallback-baseline",
      reason: baselineReason("miss-rebuild", source),
    };
  }

  if (numberValue(source.fallbackMs) > 0) {
    return {
      owner: "fallback-baseline",
      reason: baselineReason("fallback-build", source),
    };
  }

  if (numberValue(source.appServerMs) > 0) {
    return {
      owner: "app-server-thread-list",
      reason: booleanFlag(source.cursor) ? "cursor-page" : "app-server-only",
    };
  }

  return {
    owner: "unknown",
    reason: decision || "unknown",
  };
}

module.exports = {
  diagnoseThreadListColdPath,
};
