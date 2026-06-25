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
  const CLIENT_LABEL_KEYS = [
    "renderPlanReason",
    "patchRejectReason",
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
  const MAX_COUNT = 100000;

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
      detailShape: threadDetailShape(thread),
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
    for (const key of CLIENT_LABEL_KEYS) {
      const label = compactLabel(source[key]);
      if (label) result[key] = label;
    }
    if (source.skippedDetailRender !== undefined) result.skippedDetailRender = Boolean(source.skippedDetailRender);
    if (source.locallyPatchedDetail !== undefined) result.locallyPatchedDetail = Boolean(source.locallyPatchedDetail);
    return Object.keys(result).length ? result : null;
  }

  function threadDetailEventFieldsWithClient(thread, clientTimingInput = {}) {
    const fields = threadDetailEventFields(thread);
    fields.clientTimings = threadDetailClientTimings(clientTimingInput);
    return fields;
  }

  function boundedCount(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.min(MAX_COUNT, Math.trunc(number));
  }

  function itemType(value) {
    return String(value && value.type || "").trim();
  }

  function isVisibleItem(item) {
    if (!item || typeof item !== "object") return false;
    if (item.hidden || item.mobileHidden) return false;
    const type = itemType(item);
    if (!type || type === "reasoning") return false;
    if (typeof item.text === "string" && item.text.trim()) return true;
    if (Array.isArray(item.content) && item.content.length) return true;
    if (Array.isArray(item.summary) && item.summary.length) return true;
    if (type === "imageView" || type === "generatedImage" || type === "fileChange" || type === "commandExecution") return true;
    if (type === "turnUsageSummary" || type === "taskCard" || type === "toolCall") return true;
    return false;
  }

  function itemShapeBucket(item) {
    const type = itemType(item);
    if (type === "userMessage") return "userItems";
    if (type === "agentMessage" || type === "plan") return "receiptItems";
    if (type === "imageView" || type === "generatedImage") return "imageItems";
    if (type === "commandExecution" || type === "fileChange" || type === "toolCall") return "operationItems";
    if (type === "turnUsageSummary") return "usageItems";
    if (type === "turnDiagnostic") return "diagnosticItems";
    return "";
  }

  function turnIsComplete(turn) {
    const text = String(turn && (turn.status && turn.status.type || turn.status) || "").toLowerCase();
    return /completed|success|succeeded|done|finished|failed|error|cancel|cancelled|canceled|interrupted/.test(text);
  }

  function threadDetailShape(thread) {
    const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
    const shape = {
      turns: boundedCount(turns.length),
      omittedTurns: boundedCount(thread && thread.mobileOmittedTurnCount),
      items: 0,
      visibleItems: 0,
      userItems: 0,
      receiptItems: 0,
      imageItems: 0,
      operationItems: 0,
      usageItems: 0,
      diagnosticItems: 0,
      completedTurns: 0,
      activeTurns: 0,
    };
    for (const turn of turns) {
      if (turnIsComplete(turn)) shape.completedTurns += 1;
      else shape.activeTurns += 1;
      const items = Array.isArray(turn && turn.items) ? turn.items : [];
      shape.items += items.length;
      for (const item of items) {
        if (isVisibleItem(item)) shape.visibleItems += 1;
        const bucket = itemShapeBucket(item);
        if (bucket) shape[bucket] += 1;
      }
    }
    for (const key of Object.keys(shape)) shape[key] = boundedCount(shape[key]);
    return shape;
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
    threadDetailShape,
    threadDetailTimings,
    threadListEventFields,
    threadListTimings,
  };
}));
