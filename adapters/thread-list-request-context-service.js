"use strict";

function safeSet(value) {
  return value && typeof value.has === "function" ? value : new Set();
}

function boundedCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(100000, Math.trunc(number));
}

function createThreadListRequestContext(options = {}) {
  const readArchivedIds = typeof options.readArchivedIds === "function"
    ? options.readArchivedIds
    : () => new Set();
  const readSessionIndexEntries = typeof options.readSessionIndexEntries === "function"
    ? options.readSessionIndexEntries
    : () => new Map();
  const readRolloutStatsForPath = typeof options.rolloutStatsForPath === "function"
    ? options.rolloutStatsForPath
    : () => null;

  let archivedIds = null;
  let archivedIdsReadCount = 0;
  const sessionIndexCache = new Map();
  let sessionIndexReadCount = 0;
  const rolloutStatsCache = new Map();
  let rolloutStatsReadCount = 0;

  function archivedIdsForRequest() {
    if (!archivedIds) {
      archivedIds = safeSet(readArchivedIds());
      archivedIdsReadCount += 1;
    }
    return archivedIds;
  }

  function sessionIndexEntriesForRequest(maxLines = 2000, readOptions = {}) {
    const boundedMaxLines = Math.max(1, Math.min(20000, Math.trunc(Number(maxLines) || 2000)));
    const key = JSON.stringify({
      maxLines: boundedMaxLines,
      fallback: readOptions && readOptions.fallback === true,
    });
    if (!sessionIndexCache.has(key)) {
      sessionIndexCache.set(key, readSessionIndexEntries(boundedMaxLines, readOptions));
      sessionIndexReadCount += 1;
    }
    return sessionIndexCache.get(key);
  }

  function rolloutStatsForPathForRequest(rolloutPath) {
    const key = String(rolloutPath || "").trim();
    if (!key) return null;
    if (!rolloutStatsCache.has(key)) {
      let stats = null;
      try {
        stats = readRolloutStatsForPath(key) || null;
      } catch (_) {
        stats = null;
      }
      rolloutStatsCache.set(key, stats);
      rolloutStatsReadCount += 1;
    }
    return rolloutStatsCache.get(key);
  }

  function diagnostics() {
    return {
      requestContextArchivedIdsReadCount: boundedCount(archivedIdsReadCount),
      requestContextSessionIndexReadCount: boundedCount(sessionIndexReadCount),
      requestContextRolloutStatReadCount: boundedCount(rolloutStatsReadCount),
    };
  }

  return {
    archivedIds: archivedIdsForRequest,
    diagnostics,
    rolloutStatsForPath: rolloutStatsForPathForRequest,
    sessionIndexEntries: sessionIndexEntriesForRequest,
  };
}

module.exports = {
  createThreadListRequestContext,
};
