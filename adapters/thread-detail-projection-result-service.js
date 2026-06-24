"use strict";

function createThreadDetailProjectionResultService(options = {}) {
  const maxTurns = Math.max(1, Number(options.maxTurns || 1));
  const compactThreadReadResult = typeof options.compactThreadReadResult === "function"
    ? options.compactThreadReadResult
    : (result) => result;
  const mergeThreadDisplaySummary = typeof options.mergeThreadDisplaySummary === "function"
    ? options.mergeThreadDisplaySummary
    : (thread) => thread;
  const applySessionIndexTitleToThread = typeof options.applySessionIndexTitleToThread === "function"
    ? options.applySessionIndexTitleToThread
    : (thread) => thread;
  const readSessionIndexEntries = typeof options.readSessionIndexEntries === "function"
    ? options.readSessionIndexEntries
    : () => new Map();
  const mergeThreadRuntimeFromStateDb = typeof options.mergeThreadRuntimeFromStateDb === "function"
    ? options.mergeThreadRuntimeFromStateDb
    : (thread) => thread;
  const normalizeThreadSummaryLiveStatus = typeof options.normalizeThreadSummaryLiveStatus === "function"
    ? options.normalizeThreadSummaryLiveStatus
    : (thread) => thread;
  const publicRuntimeSettings = typeof options.publicRuntimeSettings === "function"
    ? options.publicRuntimeSettings
    : () => ({});
  const now = typeof options.now === "function" ? options.now : Date.now;

  function sessionIndexEntry(threadId) {
    const entries = readSessionIndexEntries();
    return entries && typeof entries.get === "function" ? entries.get(threadId) : undefined;
  }

  function mobileReadMode(cached, projectionVersion) {
    const v4 = projectionVersion === "v4";
    return cached && cached.dynamic
      ? (v4 ? "projection-v4-dynamic" : "projection-dynamic")
      : (v4 ? "projection-v4-cache" : "projection-cache");
  }

  function prepareProjectedThreadReadResult(cached, summary, runtimeSettings) {
    if (!cached || !cached.result || !cached.result.thread) return null;
    const mergedResult = Object.assign({}, cached.result, {
      thread: mergeThreadDisplaySummary(cached.result.thread, summary) || cached.result.thread,
    });
    const result = compactThreadReadResult(mergedResult, { maxTurns });
    if (!result || !result.thread) return null;
    result.thread = applySessionIndexTitleToThread(result.thread, sessionIndexEntry(result.thread.id));
    result.thread = mergeThreadRuntimeFromStateDb(result.thread, summary);
    result.thread = normalizeThreadSummaryLiveStatus(result.thread);
    result.thread.runtimeSettings = publicRuntimeSettings(runtimeSettings);
    const projectionVersion = String(cached.version || result.thread.mobileProjectionVersion || "");
    result.thread.mobileReadMode = mobileReadMode(cached, projectionVersion);
    result.thread.mobileProjection = {
      ...(result.thread.mobileProjection || {}),
      source: cached.dynamic ? "dynamic" : "cache",
      version: projectionVersion || result.thread.mobileProjectionVersion || "",
      cachedAtMs: cached.cachedAtMs || null,
      updatedAtMs: cached.updatedAtMs || cached.cachedAtMs || null,
      ageMs: cached.updatedAtMs ? Math.max(0, now() - cached.updatedAtMs) : null,
    };
    return result;
  }

  return {
    prepareProjectedThreadReadResult,
  };
}

module.exports = {
  createThreadDetailProjectionResultService,
};
