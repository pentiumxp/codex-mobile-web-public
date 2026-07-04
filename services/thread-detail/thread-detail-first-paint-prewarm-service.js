"use strict";

const {
  activeFullThreadReadReason,
} = require("./thread-detail-active-read-policy-service");
const {
  threadDetailFirstPaintPrewarmJobPolicy,
  withThreadDetailFirstPaintPrewarmJobPolicy,
} = require("./thread-detail-first-paint-prewarm-scheduler-service");

function text(value) {
  return String(value || "").trim();
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

function boundedNonNegativeInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.trunc(number));
}

function statusText(status) {
  if (!status) return "";
  if (typeof status === "string") return status;
  return String(status.type || status.status || status.state || "");
}

function summaryLooksActive(summary, activeHint = false) {
  if (activeHint) return true;
  if (!summary || typeof summary !== "object") return false;
  if (activeFullThreadReadReason(summary)) return true;
  const local = summary.mobileLocalActiveStatus && typeof summary.mobileLocalActiveStatus === "object"
    ? summary.mobileLocalActiveStatus
    : null;
  if (local && (local.turnId || local.turn_id)) return true;
  return /^(active|running|started|pending|queued|processing|inprogress|in_progress|in-progress)$/i
    .test(statusText(summary.status || summary.mobileStatus || local && local.status));
}

function summaryRolloutSizeBytes(summary) {
  const value = Number(summary && (summary.rolloutSizeBytes || summary.rollout_size_bytes));
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

function detailThreadFromReadResult(result) {
  if (!result || typeof result !== "object") return null;
  if (result.thread && typeof result.thread === "object") return result.thread;
  const body = result.body && typeof result.body === "object" ? result.body : null;
  if (body && body.thread && typeof body.thread === "object") return body.thread;
  return null;
}

function detailTiming(thread, name) {
  const timings = thread && thread.mobileDiagnostics && thread.mobileDiagnostics.threadDetailTimings;
  const value = timings && timings[name];
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : undefined;
}

function detailMode(result, thread) {
  return text(result && result.mode)
    || text(thread && thread.mobileReadMode)
    || "thread-detail";
}

function createThreadDetailFirstPaintPrewarmService(options = {}) {
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const scheduleTimer = typeof options.setTimeout === "function" ? options.setTimeout : setTimeout;
  const enabled = options.enabled !== false;
  const delayMs = boundedNonNegativeInteger(options.delayMs, 75);
  const minIntervalMs = boundedNonNegativeInteger(options.minIntervalMs, 15000);
  const readyResultTtlMs = boundedNonNegativeInteger(options.readyResultTtlMs, 60000);
  const minRolloutBytes = boundedNonNegativeInteger(options.minRolloutBytes, 8 * 1024 * 1024);
  const maxPending = Math.max(1, boundedNonNegativeInteger(options.maxPending, 2));
  const readThreadDetail = typeof options.readThreadDetail === "function"
    ? options.readThreadDetail
    : async () => ({ status: 503, body: { error: "thread_detail_reader_unavailable" } });
  const log = typeof options.log === "function" ? options.log : () => {};
  const pending = new Map();
  const lastAttemptAtByThread = new Map();
  const lastResultByThread = new Map();
  let nextJobId = 0;

  async function prewarmNow(input = {}) {
    const threadId = text(input.threadId);
    if (!enabled) return withThreadDetailFirstPaintPrewarmJobPolicy({ status: "skipped", reason: "disabled" });
    if (!threadId) return withThreadDetailFirstPaintPrewarmJobPolicy({ status: "skipped", reason: "missing-thread-id" });
    const summary = input.summary && typeof input.summary === "object" ? input.summary : null;
    const activeHint = input.activeHint === true;
    if (!summaryLooksActive(summary, activeHint)) {
      return withThreadDetailFirstPaintPrewarmJobPolicy({ status: "skipped", reason: "not-active" });
    }
    const rolloutBytes = summaryRolloutSizeBytes(summary);
    if (minRolloutBytes > 0 && rolloutBytes > 0 && rolloutBytes < minRolloutBytes) {
      return withThreadDetailFirstPaintPrewarmJobPolicy({
        status: "skipped",
        reason: "below-rollout-threshold",
        rolloutSizeBytes: rolloutBytes,
        minRolloutBytes,
      });
    }
    if (minRolloutBytes > 0 && !rolloutBytes && !activeHint) {
      return withThreadDetailFirstPaintPrewarmJobPolicy({
        status: "skipped",
        reason: "rollout-size-unavailable",
        minRolloutBytes,
      });
    }
    const startedAtMs = now();
    const result = await readThreadDetail({
      codex: input.codex || null,
      threadId,
      preferRecentTurns: false,
      responseBudgetEvidence: "compact",
      threadLog: typeof input.threadLog === "function" ? input.threadLog : () => {},
    });
    const thread = detailThreadFromReadResult(result);
    if (!thread) {
      return withThreadDetailFirstPaintPrewarmJobPolicy({
        status: "skipped",
        reason: "detail-empty",
        durationMs: Math.max(0, now() - startedAtMs),
      });
    }
    return withThreadDetailFirstPaintPrewarmJobPolicy({
      status: "warmed",
      reason: "first-paint-detail",
      mode: detailMode(result, thread),
      durationMs: Math.max(0, now() - startedAtMs),
      totalMs: detailTiming(thread, "totalMs"),
      prepareResponseMs: detailTiming(thread, "prepareResponseMs"),
      prepareResponseBudgetMs: detailTiming(thread, "prepareResponseBudgetMs"),
      rolloutSizeBytes: rolloutBytes || undefined,
    });
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
    if (result.status !== "warmed") return false;
    const updatedAtMs = Number(result.updatedAtMs || 0);
    return Boolean(updatedAtMs && current - updatedAtMs < readyResultTtlMs);
  }

  function schedule(input = {}) {
    const threadId = text(input.threadId || input.summary && (input.summary.id || input.summary.threadId || input.summary.thread_id));
    if (!enabled) return withThreadDetailFirstPaintPrewarmJobPolicy({ scheduled: false, reason: "disabled" });
    if (!threadId) return withThreadDetailFirstPaintPrewarmJobPolicy({ scheduled: false, reason: "missing-thread-id" });
    if (pending.has(threadId) && input.preemptPending !== true) {
      return withThreadDetailFirstPaintPrewarmJobPolicy({ scheduled: false, reason: "already-pending" });
    }
    if (!pending.has(threadId) && pending.size >= maxPending) {
      return withThreadDetailFirstPaintPrewarmJobPolicy({ scheduled: false, reason: "pending-limit" });
    }
    const current = now();
    const bypassMinInterval = input.bypassMinInterval === true;
    const lastAttemptAtMs = Number(lastAttemptAtByThread.get(threadId) || 0);
    if (!bypassMinInterval && reusableReadyResult(lastResultByThread.get(threadId), current)) {
      return withThreadDetailFirstPaintPrewarmJobPolicy({ scheduled: false, reason: "recently-ready" });
    }
    if (!bypassMinInterval && minIntervalMs && lastAttemptAtMs && current - lastAttemptAtMs < minIntervalMs) {
      return withThreadDetailFirstPaintPrewarmJobPolicy({ scheduled: false, reason: "recently-attempted" });
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
          log("first_paint_prewarm_done", Object.assign({ threadId, trigger: boundedReason(job.reason) }, result));
        })
        .catch((err) => {
          const result = { status: "failed", reason: boundedReason(err && err.message || err) || "prewarm-failed" };
          finish(threadId, withThreadDetailFirstPaintPrewarmJobPolicy(result), jobId);
          log("first_paint_prewarm_failed", { threadId, trigger: boundedReason(job.reason), reason: result.reason });
        });
    }, jobDelayMs);
    if (timer && typeof timer.unref === "function") timer.unref();
    return withThreadDetailFirstPaintPrewarmJobPolicy({ scheduled: true, reason: "scheduled" });
  }

  function status(threadId) {
    const id = text(threadId);
    return {
      job: threadDetailFirstPaintPrewarmJobPolicy(),
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
  createThreadDetailFirstPaintPrewarmService,
  summaryLooksActive,
  summaryRolloutSizeBytes,
  threadDetailFirstPaintPrewarmJobPolicy,
};
