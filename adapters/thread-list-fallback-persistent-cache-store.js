"use strict";

const fs = require("node:fs");
const path = require("node:path");

const STORE_VERSION = 1;
const DEFAULT_MAX_ENTRIES = 12;
const DEFAULT_MAX_THREADS_PER_ENTRY = 200;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const SAFE_STRING_THREAD_FIELDS = new Set([
  "activeTurnId",
  "agentNickname",
  "agentRole",
  "approvalPolicy",
  "archivedAt",
  "cwd",
  "effort",
  "id",
  "mobileStatusSource",
  "mobileStatusTurnId",
  "model",
  "name",
  "preview",
  "sandboxPolicy",
  "threadId",
  "title",
]);

const SAFE_NUMBER_THREAD_FIELDS = new Set([
  "pendingIncomingTaskCardCount",
  "pendingOutgoingTaskCardCount",
  "pendingTaskCardCount",
  "rolloutSizeBytes",
  "rolloutSizeUpdatedAtMs",
  "rolloutWarningThresholdBytes",
  "updatedAt",
  "updated_at",
]);

const SAFE_BOOLEAN_THREAD_FIELDS = new Set([
  "archived",
  "isSpawnedChildThread",
  "mobileFallback",
  "rolloutOverWarningThreshold",
]);

const SAFE_TIMING_FIELDS = new Set([
  "baselineFinalFilterInputCount",
  "baselineFinalFilterOutputCount",
  "baselineFinalFilterPassCount",
  "baselineLimitDropCount",
  "baselineMergeDuplicateCount",
  "baselineMergeInputCount",
  "baselineMergeOutputCount",
  "baselineResultCount",
  "baselineSourceCount",
  "rolloutCandidateFileCount",
  "rolloutCandidateScannedCount",
  "rolloutCount",
  "rolloutDirectoryReadCount",
  "rolloutFileCollectedCount",
  "rolloutFileSortedCount",
  "rolloutFileStatCount",
  "rolloutHeadBytes",
  "rolloutHeadReadCount",
  "rolloutMs",
  "rolloutStatusAttachCount",
  "rolloutStatusStatReadCount",
  "rolloutStatusStatReuseCount",
  "rolloutStatusTailBytes",
  "rolloutStatusTailReadCount",
  "sessionIndexCount",
  "sessionIndexEntryCount",
  "sessionIndexLineCount",
  "sessionIndexMs",
  "sessionIndexReadCount",
  "sessionIndexReuseCount",
  "sourceSnapshotAgeMs",
  "sourceSnapshotBuildCount",
  "sourceSnapshotBuildNumber",
  "sourceSnapshotHit",
  "sourceSnapshotLimit",
  "sourceSnapshotRawCount",
  "stateDbCount",
  "stateDbMs",
]);

function boundedNumber(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function boundedString(value, maxLength = 1000) {
  return String(value || "").trim().slice(0, maxLength);
}

function safeScalarObject(value, depth = 0) {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 1) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    const safeKey = boundedString(key, 80);
    if (!safeKey || /token|cookie|secret|password|access.?key|authorization|prompt|body|content|payload/i.test(safeKey)) {
      continue;
    }
    if (typeof raw === "string") out[safeKey] = boundedString(raw, 160);
    else if (typeof raw === "number" && Number.isFinite(raw)) out[safeKey] = boundedNumber(raw);
    else if (typeof raw === "boolean") out[safeKey] = raw;
    else if (raw && typeof raw === "object" && !Array.isArray(raw)) out[safeKey] = safeScalarObject(raw, depth + 1);
  }
  return out;
}

function safeTimingObject(value) {
  const out = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const key of SAFE_TIMING_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    if (typeof value[key] === "boolean") out[key] = value[key];
    else out[key] = boundedNumber(value[key]);
  }
  return out;
}

function safeThreadSummary(thread) {
  if (!thread || typeof thread !== "object" || Array.isArray(thread)) return null;
  const out = {};
  for (const key of SAFE_STRING_THREAD_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(thread, key)) out[key] = boundedString(thread[key], key === "preview" ? 500 : 240);
  }
  for (const key of SAFE_NUMBER_THREAD_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(thread, key)) out[key] = boundedNumber(thread[key]);
  }
  for (const key of SAFE_BOOLEAN_THREAD_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(thread, key)) out[key] = thread[key] === true;
  }
  if (thread.status && typeof thread.status === "object" && !Array.isArray(thread.status)) {
    out.status = safeScalarObject(thread.status);
  } else if (thread.status !== undefined) {
    out.status = boundedString(thread.status, 80);
  }
  if (thread.mobileTokenUsage && typeof thread.mobileTokenUsage === "object" && !Array.isArray(thread.mobileTokenUsage)) {
    out.mobileTokenUsage = safeScalarObject(thread.mobileTokenUsage);
  }
  const id = boundedString(out.id || out.threadId, 240);
  return id ? Object.assign(out, { id }) : null;
}

function safeEntry(entry, options = {}) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const maxThreadsPerEntry = boundedNumber(options.maxThreadsPerEntry, DEFAULT_MAX_THREADS_PER_ENTRY, 1, 1000);
  const key = boundedString(entry.key, 20_000);
  if (!key) return null;
  const threads = (Array.isArray(entry.threads) ? entry.threads : [])
    .slice(0, maxThreadsPerEntry)
    .map(safeThreadSummary)
    .filter(Boolean);
  return {
    key,
    cachedAt: boundedNumber(entry.cachedAt),
    updatedAt: boundedNumber(entry.updatedAt || entry.cachedAt),
    buildNumber: boundedNumber(entry.buildNumber),
    limit: boundedNumber(entry.limit, 80, 1, 200),
    filters: safeScalarObject(entry.filters),
    filterScopeKey: boundedString(entry.filterScopeKey, 20_000),
    threads,
    timings: safeTimingObject(entry.timings),
    incrementalUpdates: boundedNumber(entry.incrementalUpdates),
  };
}

function normalizeEntries(raw, options = {}) {
  const now = typeof options.now === "function" ? options.now : Date.now;
  const maxEntries = boundedNumber(options.maxEntries, DEFAULT_MAX_ENTRIES, 1, 100);
  const maxAgeMs = boundedNumber(options.maxAgeMs, DEFAULT_MAX_AGE_MS, 0, 365 * 24 * 60 * 60 * 1000);
  const entries = Array.isArray(raw && raw.entries) ? raw.entries : [];
  const nowMs = Number(now());
  return entries
    .map((entry) => safeEntry(entry, options))
    .filter((entry) => {
      if (!entry) return false;
      if (!entry.threads.length) return false;
      if (!maxAgeMs) return true;
      const updatedAt = Number(entry.updatedAt || entry.cachedAt || 0);
      return updatedAt > 0 && Math.max(0, nowMs - updatedAt) <= maxAgeMs;
    })
    .sort((left, right) => Number(right.updatedAt || right.cachedAt || 0) - Number(left.updatedAt || left.cachedAt || 0))
    .slice(0, maxEntries);
}

function createThreadListFallbackPersistentCacheStore(options = {}) {
  const rawFilePath = String(options.filePath || "").trim();
  const filePath = rawFilePath ? path.resolve(rawFilePath) : "";
  const now = typeof options.now === "function" ? options.now : Date.now;
  const maxEntries = boundedNumber(options.maxEntries, DEFAULT_MAX_ENTRIES, 1, 100);
  const maxThreadsPerEntry = boundedNumber(options.maxThreadsPerEntry, DEFAULT_MAX_THREADS_PER_ENTRY, 1, 1000);
  const maxAgeMs = boundedNumber(options.maxAgeMs, DEFAULT_MAX_AGE_MS, 0, 365 * 24 * 60 * 60 * 1000);
  let lastReadStatus = "";
  let lastWriteStatus = "";
  let lastEntryCount = 0;

  function loadEntries() {
    if (!filePath) {
      lastReadStatus = "disabled";
      lastEntryCount = 0;
      return [];
    }
    let raw = null;
    try {
      raw = fs.readFileSync(filePath, "utf8");
    } catch (err) {
      lastReadStatus = err && err.code === "ENOENT" ? "missing" : "read-failed";
      lastEntryCount = 0;
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== STORE_VERSION) {
        lastReadStatus = "unsupported-version";
        lastEntryCount = 0;
        return [];
      }
      const entries = normalizeEntries(parsed, { now, maxEntries, maxThreadsPerEntry, maxAgeMs });
      lastReadStatus = "ok";
      lastEntryCount = entries.length;
      return entries;
    } catch (_) {
      lastReadStatus = "invalid-json";
      lastEntryCount = 0;
      return [];
    }
  }

  function saveEntries(entries) {
    if (!filePath) {
      lastWriteStatus = "disabled";
      return false;
    }
    const safeEntries = normalizeEntries({ entries }, {
      now,
      maxEntries,
      maxThreadsPerEntry,
      maxAgeMs: 0,
    });
    const payload = {
      version: STORE_VERSION,
      writtenAt: Number(now()),
      entries: safeEntries,
    };
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
      fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      fs.renameSync(tmp, filePath);
      lastWriteStatus = "ok";
      lastEntryCount = safeEntries.length;
      return true;
    } catch (_) {
      lastWriteStatus = "write-failed";
      return false;
    }
  }

  function clear() {
    if (!filePath) return false;
    try {
      fs.rmSync(filePath, { force: true });
      lastWriteStatus = "cleared";
      lastEntryCount = 0;
      return true;
    } catch (_) {
      lastWriteStatus = "clear-failed";
      return false;
    }
  }

  function status() {
    return {
      fileConfigured: Boolean(filePath),
      lastReadStatus,
      lastWriteStatus,
      lastEntryCount,
      maxEntries,
      maxThreadsPerEntry,
      maxAgeMs,
    };
  }

  return {
    clear,
    loadEntries,
    saveEntries,
    status,
  };
}

module.exports = {
  STORE_VERSION,
  createThreadListFallbackPersistentCacheStore,
  normalizeEntries,
  safeThreadSummary,
};
