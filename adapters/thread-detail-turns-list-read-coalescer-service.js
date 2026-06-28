"use strict";

const crypto = require("node:crypto");

const COALESCED_TURNS_LIST_MODES = new Set([
  "turns-list-active-overlay-window",
  "turns-list-initial",
  "turns-list-large",
]);

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

function shortHash(value) {
  const raw = text(value);
  if (!raw) return "";
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 12);
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function coalescedTurnsListKey(input = {}) {
  const threadId = text(input.threadId);
  const mode = text(input.mode);
  if (!threadId || !COALESCED_TURNS_LIST_MODES.has(mode)) return "";
  const warning = text(input.warning);
  if (warning) return "";
  const limit = boundedCount(input.limit || input.maxTurns || input.maxThreadTurns);
  const settingsHash = shortHash(JSON.stringify(input.runtimeSettings || {}));
  return [
    threadId,
    mode,
    limit ? `limit:${limit}` : "limit:default",
    settingsHash ? `settings:${settingsHash}` : "settings:default",
  ].join(":");
}

function createThreadDetailTurnsListReadCoalescer(options = {}) {
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const inFlight = new Map();

  async function read(input = {}, reader) {
    if (typeof reader !== "function") {
      throw new Error("turns-list reader is required");
    }
    const key = coalescedTurnsListKey(input);
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
      return existing.promise.then(cloneJson);
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
    return entry.promise.then(cloneJson);
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
  COALESCED_TURNS_LIST_MODES,
  coalescedTurnsListKey,
  createThreadDetailTurnsListReadCoalescer,
};
