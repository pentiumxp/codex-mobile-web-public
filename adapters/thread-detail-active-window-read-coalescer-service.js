"use strict";

function text(value) {
  return String(value || "").trim();
}

function boundedCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(number));
}

function boundedMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(number));
}

function activeWindowKey(input = {}) {
  const threadId = text(input.threadId);
  const mode = text(input.mode);
  if (!threadId || mode !== "turns-list-active-overlay-window") return "";
  return `${threadId}:${mode}`;
}

function createThreadDetailActiveWindowReadCoalescer(options = {}) {
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const inFlight = new Map();

  async function read(input = {}, reader) {
    if (typeof reader !== "function") {
      throw new Error("active window reader is required");
    }
    const key = activeWindowKey(input);
    if (!key) return reader(input);
    const existing = inFlight.get(key);
    if (existing && existing.promise) {
      existing.joinCount += 1;
      const threadLog = typeof input.threadLog === "function" ? input.threadLog : null;
      if (threadLog) {
        threadLog("turns_list_coalesced", {
          mode: text(input.mode),
          elapsedMs: boundedMs(now() - existing.startedAtMs),
          joinCount: boundedCount(existing.joinCount),
        });
      }
      return existing.promise;
    }
    const entry = {
      startedAtMs: now(),
      joinCount: 0,
      promise: null,
    };
    entry.promise = Promise.resolve()
      .then(() => reader(input))
      .finally(() => {
        if (inFlight.get(key) === entry) inFlight.delete(key);
      });
    inFlight.set(key, entry);
    return entry.promise;
  }

  function status() {
    let joinCount = 0;
    for (const entry of inFlight.values()) joinCount += boundedCount(entry.joinCount);
    return {
      pending: inFlight.size > 0,
      pendingCount: inFlight.size,
      joinCount,
    };
  }

  return {
    read,
    status,
  };
}

module.exports = {
  activeWindowKey,
  createThreadDetailActiveWindowReadCoalescer,
};
