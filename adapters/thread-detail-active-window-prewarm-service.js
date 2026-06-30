"use strict";

const {
  activeFullThreadReadReason,
  summaryActiveTurnId,
} = require("./thread-detail-active-read-policy-service");

function text(value) {
  return String(value || "").trim();
}

function isPromiseLike(value) {
  return value && typeof value.then === "function";
}

function boundedReason(value) {
  return text(value).slice(0, 80);
}

function boundedDelayMs(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, number);
}

function turnId(turn) {
  return text(turn && (turn.id || turn.turnId || turn.turn_id));
}

function overlayActiveTurnId(overlayInput = {}, summary = null) {
  return text(overlayInput.activeTurnId)
    || text(overlayInput.turnId)
    || turnId(overlayInput.overlayTurn)
    || summaryActiveTurnId(summary);
}

function hasProjectionThread(result) {
  return Boolean(result && result.thread && Array.isArray(result.thread.turns));
}

function createThreadDetailActiveWindowPrewarmService(options = {}) {
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const scheduleTimer = typeof options.setTimeout === "function" ? options.setTimeout : setTimeout;
  const delayMs = Math.max(0, Number(options.delayMs ?? 25));
  const minIntervalMs = Math.max(0, Number(options.minIntervalMs ?? 1000));
  const readyResultTtlMs = Math.max(0, Number(options.readyResultTtlMs ?? 15000));
  const resolveSummary = typeof options.resolveSummary === "function"
    ? options.resolveSummary
    : async () => ({ summary: null, source: "" });
  const threadRuntimeSettings = typeof options.threadRuntimeSettings === "function"
    ? options.threadRuntimeSettings
    : () => null;
  const projectionInput = typeof options.projectionInput === "function" ? options.projectionInput : () => null;
  const activeOverlayProjectionWindowLookup = typeof options.activeOverlayProjectionWindowLookup === "function"
    ? options.activeOverlayProjectionWindowLookup
    : null;
  const resolveActiveWindowOverlay = typeof options.resolveActiveWindowOverlay === "function"
    ? options.resolveActiveWindowOverlay
    : null;
  const turnsListThreadReadResult = typeof options.turnsListThreadReadResult === "function"
    ? options.turnsListThreadReadResult
    : null;
  const seedProjection = typeof options.seedProjection === "function" ? options.seedProjection : () => null;
  const log = typeof options.log === "function" ? options.log : () => {};
  const pending = new Map();
  const lastAttemptAtByThread = new Map();
  const lastResultByThread = new Map();
  let nextJobId = 0;

  async function prewarmNow(input = {}) {
    const threadId = text(input.threadId);
    if (!threadId) return { status: "skipped", reason: "missing-thread-id" };
    const startedAtMs = now();
    const inputSummary = input.summary && typeof input.summary === "object" ? input.summary : null;
    let summary = inputSummary;
    if (!summary) {
      const summaryResult = await resolveSummary(input.codex || null, threadId, {
        threadLog: typeof input.threadLog === "function" ? input.threadLog : () => {},
      });
      summary = summaryResult && summaryResult.summary || null;
    }
    const activeReason = activeFullThreadReadReason(summary);
    if (!activeReason) return { status: "skipped", reason: "not-active" };
    let runtimeSettings = threadRuntimeSettings(threadId, summary);
    let projection = projectionInput(threadId, summary);
    if (!projection && inputSummary) {
      const summaryResult = await resolveSummary(input.codex || null, threadId, {
        threadLog: typeof input.threadLog === "function" ? input.threadLog : () => {},
      });
      const resolvedSummary = summaryResult && summaryResult.summary || null;
      const resolvedActiveReason = activeFullThreadReadReason(resolvedSummary);
      if (!resolvedActiveReason) return { status: "skipped", reason: "not-active" };
      summary = resolvedSummary;
      runtimeSettings = threadRuntimeSettings(threadId, summary);
      projection = projectionInput(threadId, summary);
    }
    if (!projection) return { status: "skipped", reason: "projection-input-unavailable" };
    if (!activeOverlayProjectionWindowLookup) return { status: "skipped", reason: "window-lookup-unavailable" };
    if (!turnsListThreadReadResult) return { status: "skipped", reason: "turns-list-unavailable" };

    let overlayInput = null;
    if (resolveActiveWindowOverlay) {
      const overlayResult = resolveActiveWindowOverlay({
        threadId,
        summary,
        projection,
        runtimeSettings,
        projectionThread: null,
        projectionLookup: null,
      });
      overlayInput = isPromiseLike(overlayResult) ? await overlayResult : overlayResult;
    }
    const activeTurnId = overlayActiveTurnId(overlayInput || {}, summary);
    const lookedUp = activeOverlayProjectionWindowLookup(projection, summary, runtimeSettings, {
      allowPartial: true,
      activeOverlay: true,
      omitActiveTurnId: activeTurnId,
    });
    if (hasProjectionThread(lookedUp && lookedUp.result)) {
      return { status: "hit", reason: "active-window-already-cached" };
    }
    const activeWindowResult = await turnsListThreadReadResult({
      threadId,
      summary,
      runtimeSettings,
      warning: "",
      mode: "turns-list-active-overlay-window",
      threadLog: typeof input.threadLog === "function" ? input.threadLog : () => {},
    });
    if (!hasProjectionThread(activeWindowResult)) {
      return { status: "skipped", reason: "active-window-result-empty" };
    }
    const seeded = seedProjection(projection, activeWindowResult, {
      partial: true,
      partialKind: "turns-list-active-overlay-window",
      projectionRevision: overlayInput.overlayRevision || overlayInput.projectionRevision,
      projectionTimestampMs: overlayInput.overlayTimestampMs || overlayInput.projectionTimestampMs,
    });
    return {
      status: seeded && seeded.skipped ? "skipped" : "seeded",
      reason: seeded && seeded.reason
        ? boundedReason(seeded.reason)
        : overlayInput && overlayInput.overlayTurn
          ? "turns-list-active-overlay-window"
          : "turns-list-active-overlay-window-preseed",
      durationMs: Math.max(0, now() - startedAtMs),
    };
  }

  function finish(threadId, result, jobId = 0) {
    const current = pending.get(threadId);
    if (!current || current.jobId === jobId) {
      pending.delete(threadId);
      lastResultByThread.set(threadId, Object.assign({ updatedAtMs: now() }, result || {}));
    }
  }

  function reusableReadyResult(result, current) {
    if (!readyResultTtlMs || !result || typeof result !== "object") return false;
    if (result.status !== "hit" && result.status !== "seeded") return false;
    const updatedAtMs = Number(result.updatedAtMs || 0);
    return Boolean(updatedAtMs && current - updatedAtMs < readyResultTtlMs);
  }

  function schedule(input = {}) {
    const threadId = text(input.threadId);
    if (!threadId) return { scheduled: false, reason: "missing-thread-id" };
    if (pending.has(threadId) && input.preemptPending !== true) return { scheduled: false, reason: "already-pending" };
    const current = now();
    const lastAttemptAtMs = Number(lastAttemptAtByThread.get(threadId) || 0);
    const bypassMinInterval = input.bypassMinInterval === true;
    if (!bypassMinInterval && reusableReadyResult(lastResultByThread.get(threadId), current)) {
      return { scheduled: false, reason: "recently-ready" };
    }
    if (!bypassMinInterval && minIntervalMs && lastAttemptAtMs && current - lastAttemptAtMs < minIntervalMs) {
      return { scheduled: false, reason: "recently-attempted" };
    }
    lastAttemptAtByThread.set(threadId, current);
    const jobId = ++nextJobId;
    const job = Object.assign({}, input, { threadId, jobId });
    pending.set(threadId, {
      scheduledAtMs: current,
      reason: boundedReason(input.reason),
      jobId,
      preemptedPrevious: input.preemptPending === true,
    });
    const jobDelayMs = boundedDelayMs(input.delayMs, delayMs);
    const timer = scheduleTimer(() => {
      prewarmNow(job)
        .then((result) => {
          finish(threadId, result, jobId);
          log("active_window_prewarm_done", Object.assign({ threadId, trigger: boundedReason(job.reason) }, result));
        })
        .catch((err) => {
          const result = { status: "failed", reason: boundedReason(err && err.message || err) || "prewarm-failed" };
          finish(threadId, result, jobId);
          log("active_window_prewarm_failed", { threadId, trigger: boundedReason(job.reason), reason: result.reason });
        });
    }, jobDelayMs);
    if (timer && typeof timer.unref === "function") timer.unref();
    return { scheduled: true, reason: "scheduled" };
  }

  function status(threadId) {
    const id = text(threadId);
    return {
      pending: id ? pending.has(id) : pending.size > 0,
      pendingCount: pending.size,
      lastResult: id ? lastResultByThread.get(id) || null : null,
    };
  }

  return {
    prewarmNow,
    schedule,
    status,
  };
}

module.exports = {
  createThreadDetailActiveWindowPrewarmService,
  overlayActiveTurnId,
};
