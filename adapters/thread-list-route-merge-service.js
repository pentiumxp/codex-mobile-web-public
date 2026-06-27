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

function threadRowsFromResult(result) {
  if (!result || typeof result !== "object") return [];
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.threads)) return result.threads;
  return [];
}

function safeThreadList(value) {
  return Array.isArray(value) ? value.filter((thread) => thread && typeof thread === "object") : [];
}

function threadId(value) {
  return String(value && value.id || "").trim();
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

function routeMergeDiagnostics(input = {}) {
  const appServerInput = safeThreadList(input.appServerThreads);
  const fallbackInput = safeThreadList(input.fallbackThreads);
  const rawInput = safeThreadList(input.rawInput);
  const merged = safeThreadList(input.mergedThreads);
  const output = safeThreadList(input.outputThreads);
  return {
    routeMergeAppServerInputCount: boundedCount(appServerInput.length),
    routeMergeFallbackInputCount: boundedCount(fallbackInput.length),
    routeMergeInputCount: boundedCount(rawInput.length),
    routeMergeUniqueInputCount: boundedCount(countUniqueIds(rawInput)),
    routeMergeDuplicateCount: boundedCount(countDuplicateIds(rawInput)),
    routeMergeMergedCount: boundedCount(merged.length),
    routeMergeOutputCount: boundedCount(output.length),
    routeMergeLimitDropCount: boundedCount(Math.max(0, merged.length - output.length)),
  };
}

function mergeThreadListRouteResult(options = {}) {
  const sourceResult = options.result && typeof options.result === "object" ? options.result : {};
  const out = Object.assign({}, sourceResult);
  const appServerThreads = threadRowsFromResult(out);
  const fallbackThreads = safeThreadList(options.fallbackThreads);
  const rawInput = [...appServerThreads, ...fallbackThreads];
  const mergeThreadSummaryList = typeof options.mergeThreadSummaryList === "function"
    ? options.mergeThreadSummaryList
    : (threads) => safeThreadList(threads);
  const mergedThreads = safeThreadList(mergeThreadSummaryList(rawInput));
  const outputThreads = mergedThreads.slice(0, boundedLimit(options.limit));

  if (Array.isArray(out.data) || !Array.isArray(out.threads)) out.data = outputThreads;
  if (Array.isArray(out.threads)) out.threads = outputThreads;

  return {
    result: out,
    diagnostics: routeMergeDiagnostics({
      appServerThreads,
      fallbackThreads,
      rawInput,
      mergedThreads,
      outputThreads,
    }),
  };
}

module.exports = {
  countDuplicateIds,
  countUniqueIds,
  mergeThreadListRouteResult,
  routeMergeDiagnostics,
  threadRowsFromResult,
};
