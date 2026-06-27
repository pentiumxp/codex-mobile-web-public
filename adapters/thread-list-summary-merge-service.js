"use strict";

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

function identity(value) {
  return value;
}

function safeThreadList(value) {
  return Array.isArray(value) ? value.filter((thread) => thread && typeof thread === "object") : [];
}

function safeArchivedIds(value) {
  return value && typeof value.has === "function" ? value : new Set();
}

function dominantTimingStage(timings = {}) {
  const entries = Object.entries(timings)
    .map(([stage, ms]) => ({ stage, ms: boundedMs(ms) }))
    .filter((entry) => entry.ms > 0)
    .sort((left, right) => right.ms - left.ms);
  return entries[0] ? entries[0].stage : "";
}

function createThreadListSummaryMergeService(options = {}) {
  const archivedSessionThreadIds = typeof options.archivedSessionThreadIds === "function"
    ? options.archivedSessionThreadIds
    : () => new Set();
  const mergeThreadWithCachedDisplaySummary = typeof options.mergeThreadWithCachedDisplaySummary === "function"
    ? options.mergeThreadWithCachedDisplaySummary
    : identity;
  const stripThreadListDetailFields = typeof options.stripThreadListDetailFields === "function"
    ? options.stripThreadListDetailFields
    : identity;
  const normalizeThreadSummaryLiveStatus = typeof options.normalizeThreadSummaryLiveStatus === "function"
    ? options.normalizeThreadSummaryLiveStatus
    : identity;
  const mergeThreadDisplaySummary = typeof options.mergeThreadDisplaySummary === "function"
    ? options.mergeThreadDisplaySummary
    : ((base, display) => Object.assign({}, base || {}, display || {}));
  const threadHasArchiveSignal = typeof options.threadHasArchiveSignal === "function"
    ? options.threadHasArchiveSignal
    : () => false;
  const isSubagentThreadSummary = typeof options.isSubagentThreadSummary === "function"
    ? options.isSubagentThreadSummary
    : () => false;
  const hydrateThreadListTitlesFromSessionIndex = typeof options.hydrateThreadListTitlesFromSessionIndex === "function"
    ? options.hydrateThreadListTitlesFromSessionIndex
    : identity;
  const shouldHideThreadListSummary = typeof options.shouldHideThreadListSummary === "function"
    ? options.shouldHideThreadListSummary
    : () => false;
  const sortThreadListSummaries = typeof options.sortThreadListSummaries === "function"
    ? options.sortThreadListSummaries
    : identity;
  const nowMs = typeof options.nowMs === "function" ? options.nowMs : () => Date.now();

  const measure = (diagnostics, field, callback) => {
    const startedAtMs = Number(nowMs()) || 0;
    const result = callback();
    diagnostics[field] = boundedMs(Number(diagnostics[field] || 0) + Math.max(0, (Number(nowMs()) || 0) - startedAtMs));
    return result;
  };

  function mergeThreadSummaryListWithDiagnostics(threads, mergeOptions = {}) {
    const totalStartedAtMs = Number(nowMs()) || 0;
    const input = Array.isArray(threads) ? threads : [];
    const diagnostics = {
      summaryMergeInputCount: boundedCount(input.length),
      summaryMergeInvalidCount: 0,
      summaryMergeArchivedIdSkipCount: 0,
      summaryMergeDuplicateIdCount: 0,
      summaryMergeArchivedSignalDropCount: 0,
      summaryMergeSubagentDropCount: 0,
      summaryMergeByIdCount: 0,
      summaryMergeHydratedCount: 0,
      summaryMergeVisibleCount: 0,
      summaryMergeOutputCount: 0,
      summaryMergeCachedDisplayMs: 0,
      summaryMergeNormalizeMs: 0,
      summaryMergeDisplayMergeMs: 0,
      summaryMergeHydrateTitleMs: 0,
      summaryMergeFinalFilterMs: 0,
      summaryMergeSortMs: 0,
      summaryMergeTotalMs: 0,
      summaryMergeDominantStage: "",
    };
    const mergeCachedDisplay = mergeOptions && typeof mergeOptions.mergeThreadWithCachedDisplaySummary === "function"
      ? mergeOptions.mergeThreadWithCachedDisplaySummary
      : mergeThreadWithCachedDisplaySummary;
    const mergeDisplaySummary = mergeOptions && typeof mergeOptions.mergeThreadDisplaySummary === "function"
      ? mergeOptions.mergeThreadDisplaySummary
      : mergeThreadDisplaySummary;
    const archivedIds = safeArchivedIds(
      mergeOptions && mergeOptions.archivedIds
        ? mergeOptions.archivedIds
        : archivedSessionThreadIds(),
    );
    const byId = new Map();

    for (const thread of input) {
      if (!thread || !thread.id) {
        diagnostics.summaryMergeInvalidCount += 1;
        continue;
      }
      const id = String(thread.id);
      if (archivedIds.has(id)) {
        diagnostics.summaryMergeArchivedIdSkipCount += 1;
        continue;
      }
      const cachedThread = measure(diagnostics, "summaryMergeCachedDisplayMs", () => mergeCachedDisplay(thread));
      const displayThread = measure(diagnostics, "summaryMergeNormalizeMs", () => stripThreadListDetailFields(
        normalizeThreadSummaryLiveStatus(cachedThread),
      ));
      const duplicate = byId.has(id);
      if (duplicate) diagnostics.summaryMergeDuplicateIdCount += 1;
      const merged = measure(diagnostics, "summaryMergeDisplayMergeMs", () => normalizeThreadSummaryLiveStatus(
        duplicate ? mergeDisplaySummary(byId.get(id), displayThread) : displayThread,
      ));
      const archived = threadHasArchiveSignal(merged, archivedIds);
      const subagent = isSubagentThreadSummary(merged);
      if (archived || subagent) {
        if (archived) diagnostics.summaryMergeArchivedSignalDropCount += 1;
        if (subagent) diagnostics.summaryMergeSubagentDropCount += 1;
        byId.delete(id);
        continue;
      }
      byId.set(id, stripThreadListDetailFields(merged));
    }

    diagnostics.summaryMergeByIdCount = boundedCount(byId.size);
    const hydrated = measure(diagnostics, "summaryMergeHydrateTitleMs", () => safeThreadList(
      hydrateThreadListTitlesFromSessionIndex([...byId.values()], mergeOptions && mergeOptions.sessionIndexEntries),
    ));
    diagnostics.summaryMergeHydratedCount = boundedCount(hydrated.length);
    const visible = measure(diagnostics, "summaryMergeFinalFilterMs", () => hydrated
      .filter((thread) => !shouldHideThreadListSummary(thread, archivedIds)));
    diagnostics.summaryMergeVisibleCount = boundedCount(visible.length);
    const output = measure(diagnostics, "summaryMergeSortMs", () => safeThreadList(sortThreadListSummaries(visible)));
    diagnostics.summaryMergeOutputCount = boundedCount(output.length);
    diagnostics.summaryMergeTotalMs = boundedMs((Number(nowMs()) || 0) - totalStartedAtMs);
    diagnostics.summaryMergeDominantStage = compactLabel(dominantTimingStage({
      cached_display: diagnostics.summaryMergeCachedDisplayMs,
      normalize: diagnostics.summaryMergeNormalizeMs,
      display_merge: diagnostics.summaryMergeDisplayMergeMs,
      hydrate_title: diagnostics.summaryMergeHydrateTitleMs,
      final_filter: diagnostics.summaryMergeFinalFilterMs,
      sort: diagnostics.summaryMergeSortMs,
    }));

    return { threads: output, diagnostics };
  }

  function mergeThreadSummaryList(threads, mergeOptions = {}) {
    return mergeThreadSummaryListWithDiagnostics(threads, mergeOptions).threads;
  }

  return {
    mergeThreadSummaryList,
    mergeThreadSummaryListWithDiagnostics,
  };
}

module.exports = {
  createThreadListSummaryMergeService,
  dominantTimingStage,
};
