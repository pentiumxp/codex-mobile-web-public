"use strict";

function boundedMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(10 * 60 * 1000, Math.trunc(number));
}

function boundedLimit(value, fallback = 80) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.min(200, Math.trunc(number)));
}

function bool(value) {
  return value === true;
}

function text(value) {
  return String(value || "").trim();
}

function defaultThreadListCoalescingKey(input = {}) {
  const limit = boundedLimit(input.limit);
  if (text(input.cursor) || bool(input.archived)) return "";
  if (text(input.cwd) || text(input.searchTerm)) return "";
  if (text(input.fallbackMode) || text(input.initialMode)) return "";
  return JSON.stringify({
    route: "thread-list-default",
    limit,
  });
}

function assignCoalescedDiagnostics(result, patch = {}) {
  if (!result || typeof result !== "object") return result;
  const mobileDiagnostics = result.mobileDiagnostics && typeof result.mobileDiagnostics === "object"
    ? result.mobileDiagnostics
    : {};
  const timings = mobileDiagnostics.threadListTimings && typeof mobileDiagnostics.threadListTimings === "object"
    ? mobileDiagnostics.threadListTimings
    : {};
  return Object.assign({}, result, {
    mobileDiagnostics: Object.assign({}, mobileDiagnostics, {
    threadListTimings: Object.assign({}, timings, {
      threadListCoalescedRequest: true,
      threadListCoalescedWaitMs: boundedMs(patch.waitMs),
      threadListCoalescedLeaderTotalMs: boundedMs(timings.totalMs),
      threadListCoalescedKeyHash: text(patch.keyHash).slice(0, 16),
    }),
    }),
  });
}

function shortStableHash(value) {
  const source = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(36).padStart(6, "0").slice(0, 16);
}

function createThreadListResponseCoalescer(options = {}) {
  const nowMs = typeof options.nowMs === "function" ? options.nowMs : () => Date.now();
  const keyFor = typeof options.keyFor === "function" ? options.keyFor : defaultThreadListCoalescingKey;
  const inFlight = new Map();

  function begin(input = {}) {
    const key = keyFor(input);
    if (!key) {
      return { enabled: false, leader: false, key: "" };
    }
    const keyHash = shortStableHash(key);
    const existing = inFlight.get(key);
    const startedAtMs = Number(nowMs()) || 0;
    if (existing && existing.promise) {
      return {
        enabled: true,
        leader: false,
        key,
        keyHash,
        startedAtMs,
        async result() {
          const value = await existing.promise;
          return assignCoalescedDiagnostics(value, {
            waitMs: (Number(nowMs()) || 0) - startedAtMs,
            keyHash,
          });
        },
      };
    }

    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    inFlight.set(key, {
      startedAtMs,
      promise,
    });
    let settled = false;

    function settle(callback) {
      if (settled) return;
      settled = true;
      inFlight.delete(key);
      callback();
    }

    return {
      enabled: true,
      leader: true,
      key,
      keyHash,
      startedAtMs,
      complete(result) {
        settle(() => resolvePromise(result));
      },
      fail(error) {
        settle(() => rejectPromise(error));
      },
    };
  }

  function size() {
    return inFlight.size;
  }

  return {
    begin,
    size,
  };
}

module.exports = {
  assignCoalescedDiagnostics,
  createThreadListResponseCoalescer,
  defaultThreadListCoalescingKey,
};
