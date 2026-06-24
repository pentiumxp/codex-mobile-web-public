"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexThreadPerformanceMetrics = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  function objectOrNull(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  }

  const MAX_TIMING_MS = 10 * 60 * 1000;
  const CLIENT_TIMING_KEYS = [
    "elapsedMs",
    "apiElapsedMs",
    "renderElapsedMs",
    "mergeMs",
    "draftRestoreMs",
    "composerRenderMs",
    "threadListRenderMs",
    "conversationRenderMs",
    "detailPatchMs",
    "metadataUpdateMs",
    "postRenderMs",
  ];
  const ALLOWED_DETAIL_RENDER_MODES = Object.freeze({
    "cached-current": true,
    "first-paint": true,
    "full-backfill": true,
    "full-render": true,
    "metadata-only": true,
    patch: true,
    skipped: true,
  });

  function threadDetailTimings(thread) {
    const diagnostics = objectOrNull(thread && thread.mobileDiagnostics);
    return objectOrNull(diagnostics && diagnostics.threadDetailTimings);
  }

  function threadListTimings(result) {
    const diagnostics = objectOrNull(result && result.mobileDiagnostics);
    return objectOrNull(diagnostics && diagnostics.threadListTimings);
  }

  function classifyThreadListPhase(timings) {
    const value = objectOrNull(timings);
    if (!value) return "unknown";
    if (value.fallbackDeferred) return "deferred-fallback";
    if (value.fallbackCacheHit) return "warm-fallback-cache";
    if (Number(value.fallbackMs || 0) > 0) return "cold-fallback-build";
    if (Number(value.appServerMs || 0) > 0) return "app-server-only";
    return "unknown";
  }

  function threadDetailEventFields(thread) {
    const timings = threadDetailTimings(thread);
    return {
      serverTimings: timings,
      performancePhase: timings && timings.phase || "unknown",
    };
  }

  function boundedTiming(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return null;
    return Math.min(MAX_TIMING_MS, Math.round(number));
  }

  function compactLabel(value, maxLength = 40) {
    return String(value || "").trim().slice(0, maxLength);
  }

  function threadDetailClientTimings(input = {}) {
    const source = objectOrNull(input) || {};
    const result = {};
    for (const key of CLIENT_TIMING_KEYS) {
      const timing = boundedTiming(source[key]);
      if (timing !== null) result[key] = timing;
    }
    const renderMode = compactLabel(source.detailRenderMode || source.renderMode);
    if (renderMode && ALLOWED_DETAIL_RENDER_MODES[renderMode]) result.detailRenderMode = renderMode;
    const sourceLabel = compactLabel(source.source);
    if (sourceLabel) result.source = sourceLabel;
    if (source.skippedDetailRender !== undefined) result.skippedDetailRender = Boolean(source.skippedDetailRender);
    if (source.locallyPatchedDetail !== undefined) result.locallyPatchedDetail = Boolean(source.locallyPatchedDetail);
    return Object.keys(result).length ? result : null;
  }

  function threadDetailEventFieldsWithClient(thread, clientTimingInput = {}) {
    const fields = threadDetailEventFields(thread);
    fields.clientTimings = threadDetailClientTimings(clientTimingInput);
    return fields;
  }

  function threadListEventFields(result) {
    const timings = threadListTimings(result);
    return {
      serverTimings: timings,
      performancePhase: classifyThreadListPhase(timings),
    };
  }

  return {
    boundedTiming,
    classifyThreadListPhase,
    threadDetailClientTimings,
    threadDetailEventFields,
    threadDetailEventFieldsWithClient,
    threadDetailTimings,
    threadListEventFields,
    threadListTimings,
  };
}));
