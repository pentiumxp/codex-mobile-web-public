"use strict";

  const DEFAULT_RUNNING_HINT_STALE_MS = 20 * 60 * 1000;
  const DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS = 60 * 1000;
  const DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS = 1000;

  function timestampMs(value) {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") {
      if (!Number.isFinite(value) || value <= 0) return 0;
      return value > 1_000_000_000_000 ? Math.trunc(value) : Math.trunc(value * 1000);
    }
    if (/^\d+(?:\.\d+)?$/.test(String(value))) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) {
        return numeric > 1_000_000_000_000 ? Math.trunc(numeric) : Math.trunc(numeric * 1000);
      }
    }
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function statusText(status) {
    if (!status) return "";
    if (typeof status === "string") return status;
    if (status && typeof status === "object" && status.type) return String(status.type);
    try {
      return JSON.stringify(status);
    } catch (_) {
      return String(status);
    }
  }

  function isStaleActiveStatus(status, thread) {
    return Boolean((status && typeof status === "object"
      && (status.mobileStaleActiveTurn || status.staleActiveTurn || status.reason === "context-only-active-turn"))
      || (thread && thread.mobileStaleActiveTurn));
  }

  function isRunningStatus(status) {
    return /active|running|queued|processing|inprogress|in_progress|in-progress|pending|started/.test(statusText(status).toLowerCase());
  }

  function isSettledStatus(status) {
    return /^(idle|notloaded|not_loaded|not-loaded|completed|complete|done|failed|failure|cancelled|canceled|cancel|error|interrupted|stopped|stop)$/.test(statusText(status).toLowerCase());
  }

  function isIdleStatus(status) {
    return /^(idle|notloaded|not_loaded|not-loaded)$/.test(statusText(status).toLowerCase());
  }

  function isDeployLaneSettledIdle(thread, status) {
    return Boolean(thread && thread.mobileDeployLane && isIdleStatus(status || thread.status));
  }

  function isTerminalStatus(status) {
    return /^(completed|complete|done|failed|failure|cancelled|canceled|cancel|error|interrupted|stopped|stop)$/.test(statusText(status).toLowerCase());
  }

  function threadUpdatedAtMs(thread) {
    return timestampMs(thread && (
      thread.mobileListUpdatedAtMs
      || thread.mobile_list_updated_at_ms
      || thread.listActivityAtMs
      || thread.list_activity_at_ms
      || thread.updatedAtMs
      || thread.updatedAt
      || thread.updated_at_ms
      || thread.updated_at
      || thread.lastActivityAtMs
      || thread.lastActivityAt
      || thread.last_activity_at_ms
      || thread.last_activity_at
    ));
  }

  function terminalTurnAtMs(turn) {
    return timestampMs(turn && turn.completedAtMs)
      || timestampMs(turn && turn.completedAt)
      || timestampMs(turn && turn.completed_at_ms)
      || timestampMs(turn && turn.completed_at)
      || timestampMs(turn && turn.finishedAt)
      || timestampMs(turn && turn.finished_at)
      || timestampMs(turn && turn.updatedAtMs)
      || timestampMs(turn && turn.updatedAt)
      || timestampMs(turn && turn.updated_at_ms)
      || timestampMs(turn && turn.updated_at)
      || timestampMs(turn && turn.startedAtMs)
      || timestampMs(turn && turn.startedAt)
      || timestampMs(turn && turn.started_at_ms)
      || timestampMs(turn && turn.started_at)
      || timestampMs(turn && turn.createdAtMs)
      || timestampMs(turn && turn.createdAt)
      || timestampMs(turn && turn.created_at_ms)
      || timestampMs(turn && turn.created_at);
  }

  function notificationDurableEventAtMs(params = {}) {
    return timestampMs(params.eventAtMs)
      || timestampMs(params.eventAt)
      || terminalTurnAtMs(params.turn)
      || timestampMs(params.receivedAtMs)
      || timestampMs(params.timestampMs)
      || timestampMs(params.timestamp);
  }

  function notificationEventAtMs(params = {}, fallbackMs = 0, options = {}) {
    const durableAt = notificationDurableEventAtMs(params);
    if (durableAt) return durableAt;
    if (options.allowReplayReceivedAt !== false) {
      const replayAt = timestampMs(params.mobileReplayReceivedAtMs);
      if (replayAt) return replayAt;
    }
    return timestampMs(params.receivedAtMs)
      || timestampMs(params.timestampMs)
      || timestampMs(params.timestamp)
      || timestampMs(fallbackMs);
  }

  function latestTerminalTurn(thread) {
    const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
    const latest = turns.length ? turns[turns.length - 1] : null;
    if (!latest) return null;
    return isTerminalStatus(latest.status) ? latest : null;
  }

  function latestTerminalTurnAtMs(thread) {
    const turn = latestTerminalTurn(thread);
    return turn ? terminalTurnAtMs(turn) : 0;
  }

  function hasFreshSubmittedProcessingHint(submittedProcessingHintedAtMs, nowMs, staleMs = DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS) {
    const hintedAt = timestampMs(submittedProcessingHintedAtMs);
    const now = timestampMs(nowMs) || Date.now();
    return Boolean(hintedAt > 0 && now - hintedAt <= Math.max(0, Number(staleMs) || DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS));
  }

  function statusFreshnessAtMs(thread, eventAtMs) {
    return Math.max(threadUpdatedAtMs(thread) || 0, timestampMs(eventAtMs) || 0);
  }

  function settledStatusFreshEnoughForRunningHint(input = {}) {
    const hintedAt = timestampMs(input.runningHintedAtMs);
    if (!hintedAt) return true;
    const statusAt = statusFreshnessAtMs(input.thread, input.eventAtMs);
    if (!statusAt) return false;
    if (input.mobileReplay) return statusAt >= hintedAt;
    const tolerance = Math.max(0, Number(input.freshnessToleranceMs) || DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS);
    return statusAt + tolerance >= hintedAt;
  }

  function shouldKeepRunningHintForSettledStatus(input = {}) {
    const threadId = String(input.threadId || "");
    if (!threadId || !input.isRunningHinted) return false;
    const status = input.status || (input.thread && input.thread.status);
    if (isStaleActiveStatus(status, input.thread)) return false;
    if (!isSettledStatus(status)) return false;
    if (input.currentThreadRefreshing) return true;
    if (isDeployLaneSettledIdle(input.thread, status)) return false;
    const idleWithoutTerminalEvidence = isIdleStatus(status) && !latestTerminalTurn(input.thread) && !input.eventIsTerminal;
    if (input.allowLocalProcessing !== false
      && idleWithoutTerminalEvidence
      && hasFreshSubmittedProcessingHint(input.submittedProcessingHintedAtMs, input.nowMs, input.submittedProcessingHintStaleMs)) {
      return true;
    }
    if (idleWithoutTerminalEvidence) return false;
    if (input.currentThreadId && threadId === String(input.currentThreadId) && input.currentThreadSettled) return false;
    if (input.currentThreadHasLiveTurn) return true;
    if (!input.mobileReplay && (isTerminalStatus(status) || latestTerminalTurn(input.thread) || input.eventIsTerminal)) return false;
    return !settledStatusFreshEnoughForRunningHint(input);
  }

  function threadUnreadTerminalAtMs(thread, eventAtMs = 0, options = {}) {
    const eventAt = options.eventIsTerminal ? timestampMs(eventAtMs) : 0;
    return Math.max(latestTerminalTurnAtMs(thread) || 0, eventAt || 0);
  }

  function shouldMarkThreadUnread(input = {}) {
    const threadId = String(input.threadId || "");
    if (!threadId || threadId === String(input.currentThreadId || "")) return false;
    const status = input.status || (input.thread && input.thread.status);
    if (isStaleActiveStatus(status, input.thread)) return false;
    if (!isSettledStatus(status)) return false;
    if (isIdleStatus(status) && !latestTerminalTurn(input.thread) && !input.eventIsTerminal) return false;
    const terminalAt = threadUnreadTerminalAtMs(input.thread, input.eventAtMs, {
      eventIsTerminal: Boolean(input.eventIsTerminal),
    });
    const viewedAt = timestampMs(input.viewedAtMs);
    if (viewedAt > 0) return terminalAt > viewedAt;
    const updateAt = terminalAt || (input.wasRunning ? statusFreshnessAtMs(input.thread, input.eventAtMs) : 0);
    if (input.mobileReplay && !updateAt) return false;
    const hintedAt = timestampMs(input.runningHintedAtMs);
    if (!input.wasRunning || hintedAt <= 0) return false;
    if (!updateAt) return !input.mobileReplay;
    const tolerance = input.mobileReplay ? 0 : Math.max(0, Number(input.freshnessToleranceMs) || DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS);
    return updateAt + tolerance >= hintedAt;
  }

  function runningHintAgeMs(input = {}) {
    const hintedAt = timestampMs(input.runningHintedAtMs);
    const now = timestampMs(input.nowMs) || Date.now();
    if (hintedAt > 0) return now - hintedAt;
    const updatedAt = threadUpdatedAtMs(input.thread);
    if (updatedAt > 0) return now - updatedAt;
    return (Number(input.runningHintStaleMs) || DEFAULT_RUNNING_HINT_STALE_MS) + 1;
  }

  function shouldExpireRunningThreadHint(input = {}) {
    if (!input.threadId || !input.isRunningHinted) return false;
    const status = input.status || (input.thread && input.thread.status);
    if (isStaleActiveStatus(status, input.thread)) return true;
    if (isRunningStatus(status)) return false;
    if (input.currentThreadRefreshing) return false;
    if (isDeployLaneSettledIdle(input.thread, status)) return false;
    if (isSettledStatus(status) && !shouldKeepRunningHintForSettledStatus(input)) return false;
    if (input.currentThreadHasLiveTurn) return false;
    return runningHintAgeMs(input) > (Number(input.runningHintStaleMs) || DEFAULT_RUNNING_HINT_STALE_MS);
  }

const api = {
  DEFAULT_RUNNING_HINT_STALE_MS,
  DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS,
  DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS,
  hasFreshSubmittedProcessingHint,
  isDeployLaneSettledIdle,
  isIdleStatus,
  isRunningStatus,
  isSettledStatus,
  isStaleActiveStatus,
  isTerminalStatus,
  latestTerminalTurnAtMs,
  notificationDurableEventAtMs,
  notificationEventAtMs,
  runningHintAgeMs,
  shouldExpireRunningThreadHint,
  shouldKeepRunningHintForSettledStatus,
  shouldMarkThreadUnread,
  statusFreshnessAtMs,
  statusText,
  terminalTurnAtMs,
  threadUpdatedAtMs,
  timestampMs,
};

export {
  DEFAULT_RUNNING_HINT_STALE_MS,
  DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS,
  DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS,
  hasFreshSubmittedProcessingHint,
  isDeployLaneSettledIdle,
  isIdleStatus,
  isRunningStatus,
  isSettledStatus,
  isStaleActiveStatus,
  isTerminalStatus,
  latestTerminalTurnAtMs,
  notificationDurableEventAtMs,
  notificationEventAtMs,
  runningHintAgeMs,
  shouldExpireRunningThreadHint,
  shouldKeepRunningHintForSettledStatus,
  shouldMarkThreadUnread,
  statusFreshnessAtMs,
  statusText,
  terminalTurnAtMs,
  threadUpdatedAtMs,
  timestampMs,
};

export default api;
