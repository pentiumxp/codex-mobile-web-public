"use strict";

function boundedLimit(value, fallback = 80) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.min(200, Math.trunc(number)));
}

function boundedCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(100000, Math.trunc(number));
}

function boundedMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(10 * 60 * 1000, Math.trunc(number));
}

function compactLabel(value, fallback = "", maxLength = 80) {
  return String(value || fallback || "").trim().slice(0, maxLength);
}

function threadRowsFromResult(result) {
  if (!result || typeof result !== "object") return [];
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.threads)) return result.threads;
  return [];
}

function safeThreadList(value) {
  return Array.isArray(value) ? value.filter((thread) => thread && typeof thread === "object") : [];
}

function objectOrNull(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function threadId(value) {
  return String(value && value.id || "").trim();
}

function timestampMs(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }
  if (/^\d+(?:\.\d+)?$/.test(String(value))) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function threadSummaryTimestampMs(thread) {
  if (!thread || typeof thread !== "object") return 0;
  return Math.max(
    timestampMs(thread.updatedAtMs || thread.updated_at_ms),
    timestampMs(thread.updatedAt || thread.updated_at),
    Number(thread.rolloutSizeUpdatedAtMs || 0),
  );
}

function countUniqueIds(threads) {
  const ids = new Set();
  for (const thread of safeThreadList(threads)) {
    const id = threadId(thread);
    if (id) ids.add(id);
  }
  return ids.size;
}

function countDuplicateIds(threads) {
  const ids = new Set();
  let duplicates = 0;
  for (const thread of safeThreadList(threads)) {
    const id = threadId(thread);
    if (!id) continue;
    if (ids.has(id)) duplicates += 1;
    else ids.add(id);
  }
  return duplicates;
}

function fallbackThreadsForRouteMerge(appServerThreads, fallbackThreads, options = {}) {
  const fallbackInput = safeThreadList(fallbackThreads);
  if (options.dropDuplicateFallbackThreads !== true) {
    return {
      fallbackThreads: fallbackInput,
      duplicateDropCount: 0,
    };
  }
  const appServerById = new Map();
  for (const thread of safeThreadList(appServerThreads)) {
    const id = threadId(thread);
    if (!id) continue;
    appServerById.set(id, thread);
  }
  if (!appServerById.size) {
    return {
      fallbackThreads: fallbackInput,
      duplicateDropCount: 0,
    };
  }
  const out = [];
  let duplicateDropCount = 0;
  for (const thread of fallbackInput) {
    const id = threadId(thread);
    const appServerThread = id ? appServerById.get(id) : null;
    if (appServerThread && threadSummaryTimestampMs(thread) <= threadSummaryTimestampMs(appServerThread) + 1000) {
      duplicateDropCount += 1;
      continue;
    }
    out.push(thread);
  }
  return {
    fallbackThreads: out,
    duplicateDropCount,
  };
}

function routeMergeDiagnostics(input = {}) {
  const appServerInput = safeThreadList(input.appServerThreads);
  const fallbackInput = safeThreadList(input.originalFallbackThreads || input.fallbackThreads);
  const rawInput = safeThreadList(input.rawInput);
  const merged = safeThreadList(input.mergedThreads);
  const output = safeThreadList(input.outputThreads);
  return {
    routeMergeAppServerInputCount: boundedCount(appServerInput.length),
    routeMergeFallbackInputCount: boundedCount(fallbackInput.length),
    routeMergeInputCount: boundedCount(rawInput.length),
    routeMergeUniqueInputCount: boundedCount(countUniqueIds(rawInput)),
    routeMergeDuplicateCount: boundedCount(countDuplicateIds(rawInput)),
    routeMergeFallbackDuplicateDropCount: boundedCount(input.fallbackDuplicateDropCount),
    routeMergeMergedCount: boundedCount(merged.length),
    routeMergeOutputCount: boundedCount(output.length),
    routeMergeLimitDropCount: boundedCount(Math.max(0, merged.length - output.length)),
  };
}

function summaryMergeDiagnostics(value) {
  const source = objectOrNull(value);
  if (!source) return {};
  return {
    summaryMergeInputCount: boundedCount(source.summaryMergeInputCount),
    summaryMergeInvalidCount: boundedCount(source.summaryMergeInvalidCount),
    summaryMergeArchivedIdSkipCount: boundedCount(source.summaryMergeArchivedIdSkipCount),
    summaryMergeDuplicateIdCount: boundedCount(source.summaryMergeDuplicateIdCount),
    summaryMergeArchivedSignalDropCount: boundedCount(source.summaryMergeArchivedSignalDropCount),
    summaryMergeSubagentDropCount: boundedCount(source.summaryMergeSubagentDropCount),
    summaryMergeByIdCount: boundedCount(source.summaryMergeByIdCount),
    summaryMergeHydratedCount: boundedCount(source.summaryMergeHydratedCount),
    summaryMergeVisibleCount: boundedCount(source.summaryMergeVisibleCount),
    summaryMergeOutputCount: boundedCount(source.summaryMergeOutputCount),
    summaryMergeCachedDisplayMs: boundedMs(source.summaryMergeCachedDisplayMs),
    summaryMergeNormalizeMs: boundedMs(source.summaryMergeNormalizeMs),
    summaryMergeDisplayMergeMs: boundedMs(source.summaryMergeDisplayMergeMs),
    summaryMergeHydrateTitleMs: boundedMs(source.summaryMergeHydrateTitleMs),
    summaryMergeFinalFilterMs: boundedMs(source.summaryMergeFinalFilterMs),
    summaryMergeSortMs: boundedMs(source.summaryMergeSortMs),
    summaryMergeTotalMs: boundedMs(source.summaryMergeTotalMs),
    summaryMergeDominantStage: compactLabel(source.summaryMergeDominantStage, "", 80),
  };
}

function mergeThreadListRouteResult(options = {}) {
  const sourceResult = options.result && typeof options.result === "object" ? options.result : {};
  const out = Object.assign({}, sourceResult);
  const appServerThreads = threadRowsFromResult(out);
  const fallbackMerge = fallbackThreadsForRouteMerge(appServerThreads, options.fallbackThreads, options);
  const fallbackThreads = fallbackMerge.fallbackThreads;
  const rawInput = [...appServerThreads, ...fallbackThreads];
  const mergeThreadSummaryList = typeof options.mergeThreadSummaryList === "function"
    ? options.mergeThreadSummaryList
    : (threads) => safeThreadList(threads);
  const mergeOutput = mergeThreadSummaryList(rawInput, options.mergeThreadSummaryListOptions || {});
  const mergeOutputObject = objectOrNull(mergeOutput);
  const mergedThreads = safeThreadList(mergeOutputObject ? mergeOutputObject.threads : mergeOutput);
  const outputThreads = mergedThreads.slice(0, boundedLimit(options.limit));

  if (Array.isArray(out.data) || !Array.isArray(out.threads)) out.data = outputThreads;
  if (Array.isArray(out.threads)) out.threads = outputThreads;

  return {
    result: out,
    diagnostics: Object.assign(
      {},
      routeMergeDiagnostics({
        appServerThreads,
        originalFallbackThreads: options.fallbackThreads,
        fallbackThreads,
        rawInput,
        mergedThreads,
        outputThreads,
        fallbackDuplicateDropCount: fallbackMerge.duplicateDropCount,
      }),
      summaryMergeDiagnostics(mergeOutputObject && mergeOutputObject.diagnostics),
    ),
  };
}

module.exports = {
  countDuplicateIds,
  countUniqueIds,
  fallbackThreadsForRouteMerge,
  mergeThreadListRouteResult,
  routeMergeDiagnostics,
  summaryMergeDiagnostics,
  threadRowsFromResult,
};
