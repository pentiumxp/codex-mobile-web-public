"use strict";

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function normalizeEnabled(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return !/^(0|false|no|off)$/i.test(String(value).trim());
}

function compactLabel(value, fallback = "", maxLength = 80) {
  const text = String(value || fallback || "").trim();
  return text.slice(0, maxLength);
}

function boundedCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(number));
}

function normalizePrewarmConfig(config = {}) {
  return {
    enabled: normalizeEnabled(config.enabled, true),
    delayMs: boundedNumber(config.delayMs, 1500, 0, 10 * 60 * 1000),
    retryDelayMs: boundedNumber(config.retryDelayMs, 2500, 100, 10 * 60 * 1000),
    maxDeferrals: boundedNumber(config.maxDeferrals, 5, 0, 100),
    limit: boundedNumber(config.limit, 40, 1, 200),
  };
}

function summarizePrewarmResult({ status, limit, startedAtMs, finishedAtMs, threads, diagnostics, errorCode }) {
  const elapsedMs = Math.max(0, Number(finishedAtMs || 0) - Number(startedAtMs || 0));
  const safeDiagnostics = diagnostics && typeof diagnostics === "object" ? diagnostics : {};
  return {
    status: compactLabel(status, "unknown", 40),
    limit: boundedCount(limit),
    elapsedMs: boundedCount(elapsedMs),
    resultCount: Array.isArray(threads) ? boundedCount(threads.length) : 0,
    cacheDecision: compactLabel(safeDiagnostics.cacheDecision, "", 80),
    cacheHit: safeDiagnostics.cacheHit === true,
    sourceSnapshotHit: safeDiagnostics.sourceSnapshotHit === true,
    sourceSnapshotBuildCount: boundedCount(safeDiagnostics.sourceSnapshotBuildCount),
    sourceSnapshotRawCount: boundedCount(safeDiagnostics.sourceSnapshotRawCount),
    baselineSourceCount: boundedCount(safeDiagnostics.baselineSourceCount),
    baselineResultCount: boundedCount(safeDiagnostics.baselineResultCount),
    errorCode: compactLabel(errorCode, "", 80),
  };
}

function summarizePrewarmStatus(status = {}, config = {}) {
  const safeStatus = status && typeof status === "object" ? status : {};
  const normalized = normalizePrewarmConfig(config);
  const lastResult = safeStatus.lastResult && typeof safeStatus.lastResult === "object"
    ? safeStatus.lastResult
    : {};
  return {
    enabled: normalized.enabled,
    scheduled: safeStatus.scheduled === true,
    running: safeStatus.running === true,
    completed: safeStatus.completed === true,
    deferralCount: boundedCount(safeStatus.deferralCount),
    delayMs: normalized.delayMs,
    retryDelayMs: normalized.retryDelayMs,
    maxDeferrals: normalized.maxDeferrals,
    limit: normalized.limit,
    lastStatus: compactLabel(lastResult.status, "", 40),
    lastErrorCode: compactLabel(lastResult.errorCode, "", 80),
    lastCacheDecision: compactLabel(lastResult.cacheDecision, "", 80),
    lastCacheHit: lastResult.cacheHit === true,
    lastSourceSnapshotHit: lastResult.sourceSnapshotHit === true,
    lastResultCount: boundedCount(lastResult.resultCount),
    lastElapsedMs: boundedCount(lastResult.elapsedMs),
    lastSourceSnapshotBuildCount: boundedCount(lastResult.sourceSnapshotBuildCount),
    lastSourceSnapshotRawCount: boundedCount(lastResult.sourceSnapshotRawCount),
    lastBaselineSourceCount: boundedCount(lastResult.baselineSourceCount),
    lastBaselineResultCount: boundedCount(lastResult.baselineResultCount),
  };
}

function defaultLogger() {
  return console;
}

function createThreadListFallbackPrewarmService(options = {}) {
  const now = typeof options.now === "function" ? options.now : Date.now;
  const setTimer = typeof options.setTimer === "function" ? options.setTimer : setTimeout;
  const readFallback = typeof options.readFallback === "function" ? options.readFallback : null;
  const readGlobalState = typeof options.readGlobalState === "function" ? options.readGlobalState : () => ({});
  const shouldRun = typeof options.shouldRun === "function" ? options.shouldRun : () => true;
  const logger = options.logger === false
    ? null
    : (options.logger && typeof options.logger === "object" ? options.logger : defaultLogger());
  let scheduled = false;
  let running = false;
  let completed = false;
  let deferralCount = 0;
  let lastResult = null;

  function log(level, message, payload) {
    if (!logger || typeof logger[level] !== "function") return;
    try {
      logger[level](message, payload);
    } catch (_) {}
  }

  function run(config = {}) {
    const normalized = normalizePrewarmConfig(config);
    if (!normalized.enabled) {
      lastResult = summarizePrewarmResult({
        status: "disabled",
        limit: normalized.limit,
        startedAtMs: now(),
        finishedAtMs: now(),
      });
      return lastResult;
    }
    if (!readFallback) {
      lastResult = summarizePrewarmResult({
        status: "failed",
        limit: normalized.limit,
        startedAtMs: now(),
        finishedAtMs: now(),
        errorCode: "missing-read-fallback",
      });
      return lastResult;
    }
    if (running) {
      return Object.assign({}, lastResult || {}, {
        status: "already-running",
      });
    }
    const runGate = shouldRun();
    if (runGate === false || runGate && typeof runGate === "object" && runGate.run === false) {
      lastResult = summarizePrewarmResult({
        status: "deferred",
        limit: normalized.limit,
        startedAtMs: now(),
        finishedAtMs: now(),
        errorCode: runGate && typeof runGate === "object" ? runGate.reason : "not-ready",
      });
      return lastResult;
    }
    running = true;
    const startedAtMs = Number(now());
    const diagnostics = {};
    try {
      const globalState = readGlobalState();
      const threads = readFallback(normalized.limit, {
        globalState,
        diagnostics,
      });
      const result = summarizePrewarmResult({
        status: "completed",
        limit: normalized.limit,
        startedAtMs,
        finishedAtMs: Number(now()),
        threads,
        diagnostics,
      });
      completed = true;
      lastResult = result;
      log("log", "[thread-list-prewarm] completed", result);
      return result;
    } catch (err) {
      const result = summarizePrewarmResult({
        status: "failed",
        limit: normalized.limit,
        startedAtMs,
        finishedAtMs: Number(now()),
        diagnostics,
        errorCode: err && (err.code || err.name) || "prewarm_failed",
      });
      lastResult = result;
      log("warn", "[thread-list-prewarm] failed", result);
      return result;
    } finally {
      running = false;
    }
  }

  function schedule(config = {}) {
    const normalized = normalizePrewarmConfig(config);
    if (!normalized.enabled) {
      return {
        scheduled: false,
        reason: "disabled",
        delayMs: normalized.delayMs,
        limit: normalized.limit,
      };
    }
    if (scheduled) {
      return {
        scheduled: false,
        reason: "already-scheduled",
        delayMs: normalized.delayMs,
        limit: normalized.limit,
      };
    }
    if (running) {
      return {
        scheduled: false,
        reason: "already-running",
        delayMs: normalized.delayMs,
        limit: normalized.limit,
      };
    }
    if (completed) {
      return {
        scheduled: false,
        reason: "already-completed",
        delayMs: normalized.delayMs,
        limit: normalized.limit,
      };
    }
    scheduled = true;
    const timer = setTimer(() => {
      scheduled = false;
      const runGate = shouldRun();
      if ((runGate === false || runGate && typeof runGate === "object" && runGate.run === false)
        && deferralCount < normalized.maxDeferrals) {
        deferralCount += 1;
        lastResult = summarizePrewarmResult({
          status: "deferred",
          limit: normalized.limit,
          startedAtMs: now(),
          finishedAtMs: now(),
          errorCode: runGate && typeof runGate === "object" ? runGate.reason : "not-ready",
        });
        schedule(Object.assign({}, normalized, { delayMs: normalized.retryDelayMs }));
        return;
      }
      run(normalized);
    }, normalized.delayMs);
    if (timer && typeof timer.unref === "function") timer.unref();
    return {
      scheduled: true,
      reason: "scheduled",
      delayMs: normalized.delayMs,
      limit: normalized.limit,
    };
  }

  function status() {
    return {
      scheduled,
      running,
      completed,
      deferralCount,
      lastResult: lastResult ? Object.assign({}, lastResult) : null,
    };
  }

  return {
    run,
    schedule,
    status,
  };
}

module.exports = {
  createThreadListFallbackPrewarmService,
  normalizePrewarmConfig,
  summarizePrewarmResult,
  summarizePrewarmStatus,
};
