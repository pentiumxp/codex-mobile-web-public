"use strict";

function positiveInteger(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function boundedText(value, fallback = "", max = 120) {
  const text = String(value == null ? "" : value).trim();
  if (!text) return fallback;
  return text.replace(/[\r\n\t]+/g, " ").slice(0, max);
}

function createServerRestartDrainService(options = {}) {
  const nowMs = typeof options.nowMs === "function" ? options.nowMs : () => Date.now();
  const defaultDrainMs = positiveInteger(options.defaultDrainMs, 30_000, 0, 30 * 60_000);
  let drain = null;

  function activeTurnCountFromOptions(input = {}) {
    return positiveInteger(input.activeTurnCount, 0, 0, 10_000);
  }

  function retryAfterSeconds(deadlineMs, fallbackSeconds = 2) {
    const remainingMs = Math.max(0, Number(deadlineMs || 0) - Number(nowMs() || 0));
    if (!remainingMs) return fallbackSeconds;
    return Math.max(1, Math.min(60, Math.ceil(remainingMs / 1000)));
  }

  function beginDrain(input = {}) {
    const startedAtMs = Number(nowMs()) || Date.now();
    const maxDrainMs = positiveInteger(input.maxDrainMs, defaultDrainMs, 0, 30 * 60_000);
    drain = {
      draining: true,
      reason: boundedText(input.reason, "listener_restart"),
      source: boundedText(input.source || input.requestedBy, "codex-mobile", 80),
      startedAtMs,
      deadlineAtMs: startedAtMs + maxDrainMs,
      activeTurnCount: activeTurnCountFromOptions(input),
    };
    return status(input);
  }

  function clearDrain() {
    drain = null;
    return status();
  }

  function isDraining() {
    if (!drain) return false;
    if (drain.deadlineAtMs && Number(nowMs()) > drain.deadlineAtMs) {
      drain = null;
      return false;
    }
    return true;
  }

  function status(input = {}) {
    const activeTurnCount = activeTurnCountFromOptions(input);
    if (!isDraining()) {
      return {
        ok: true,
        ready: true,
        draining: false,
        issueCodes: [],
        activeTurnCount,
      };
    }
    const effectiveActiveTurnCount = Math.max(activeTurnCount, positiveInteger(drain.activeTurnCount, 0, 0, 10_000));
    return {
      ok: false,
      ready: false,
      draining: true,
      reason: drain.reason,
      source: drain.source,
      startedAtMs: drain.startedAtMs,
      deadlineAtMs: drain.deadlineAtMs,
      retryAfterSeconds: retryAfterSeconds(drain.deadlineAtMs),
      issueCodes: ["listener_restart_draining"],
      activeTurnCount: effectiveActiveTurnCount,
    };
  }

  return {
    beginDrain,
    clearDrain,
    isDraining,
    status,
  };
}

module.exports = {
  createServerRestartDrainService,
};
