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
    "refreshRenderAction",
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
    "tile-pane": true,
    "tile-pane-metadata": true,
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
    if (value.appServerDeferred) return "warm-fallback-initial";
    const decision = compactLabel(value.fallbackCacheDecision, 40);
    if (decision === "hit" || value.fallbackCacheHit) return "warm-fallback-cache";
    if (decision === "expired-rebuild") return "cold-fallback-expired-rebuild";
    if (decision === "miss-rebuild") return "cold-fallback-miss-build";
    if (Number(value.fallbackMs || 0) > 0) return "cold-fallback-build";
    if (Number(value.appServerMs || 0) > 0) return "app-server-only";
    return "unknown";
  }

  function classifyThreadDetailPhase(timings, input = {}) {
    const value = objectOrNull(timings);
    const source = objectOrNull(input) || {};
    if (source.cached === true) return "warm-client-current";
    if (!value) return "unknown";
    const existingPhase = compactLabel(value.phase, 80);
    if (existingPhase && existingPhase !== "unknown") return existingPhase;
    const readDecision = compactLabel(value.readDecision || source.readDecision, 80).toLowerCase();
    const readMode = compactLabel(value.readMode || source.readMode, 80).toLowerCase();
    const projectionState = compactLabel(value.projectionState, 80).toLowerCase();
    const projectionSource = compactLabel(value.projectionSource, 80).toLowerCase();
    const projectionSeedStatus = compactLabel(value.projectionSeedStatus, 80).toLowerCase();
    if (readDecision === "projection-partial-hit" || /projection-v?\d*-partial|projection-partial/.test(readMode)) {
      return "warm-projection-partial";
    }
    if (readDecision === "projection-hit" || projectionState === "hit") {
      if (/dynamic/.test(projectionSource) || /projection-v?\d*-dynamic|projection-dynamic/.test(readMode)) {
        return "warm-projection-dynamic";
      }
      return "warm-projection-cache";
    }
    if (readDecision === "bounded-large-turns-list" || /turns-list-large/.test(readMode)) {
      return "bounded-large-thread-window";
    }
    if (readDecision === "initial-turns-list" || /turns-list-initial/.test(readMode)) {
      return projectionSeedStatus === "seeded-partial"
        ? "cold-turns-list-initial-seeded-partial"
        : "cold-turns-list-initial";
    }
    if (/thread-read-raw/.test(readMode)) return "cold-thread-read-raw";
    if (readDecision === "full-thread-read" || /thread-read/.test(readMode)) return "cold-thread-read";
    if (readDecision === "fallback-turns-list" || /turns-list/.test(readMode)) return "fallback-turns-list";
    if (readDecision === "summary-fallback" || /summary-timeout|unmaterialized|fallback/.test(readMode)) {
      return "fallback-summary";
    }
    return "unknown";
  }

  function threadDetailEventFields(thread) {
    const timings = threadDetailTimings(thread);
    return {
      serverTimings: timings,
      performancePhase: classifyThreadDetailPhase(timings, { readMode: thread && thread.mobileReadMode }),
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
    if (source.tilePanePatchedDetail !== undefined) result.tilePanePatchedDetail = Boolean(source.tilePanePatchedDetail);
    return Object.keys(result).length ? result : null;
  }

  function threadDetailEventFieldsWithClient(thread, clientTimingInput = {}) {
    const fields = threadDetailEventFields(thread);
    fields.clientTimings = threadDetailClientTimings(clientTimingInput);
    return fields;
  }

  function statusText(status) {
    if (!status) return "";
    if (typeof status === "string") return compactLabel(status, 80);
    if (status && typeof status === "object") {
      const type = compactLabel(status.type, 80);
      if (type) return type;
      try {
        return compactLabel(JSON.stringify(status), 80);
      } catch (_) {
        return "";
      }
    }
    return compactLabel(status, 80);
  }

  function rolloutSizeBytes(thread) {
    const size = Number(thread && thread.rolloutSizeBytes);
    return Number.isFinite(size) && size > 0 ? Math.trunc(size) : 0;
  }

  function hasCursor(value) {
    if (!value) return false;
    if (typeof value === "string") return Boolean(value.trim());
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
  }

  function booleanFlag(value) {
    if (value === true || value === 1) return true;
    const text = String(value || "").trim().toLowerCase();
    return text === "true" || text === "1" || text === "yes";
  }

  function threadTurnCount(thread) {
    return Array.isArray(thread && thread.turns) ? boundedCount(thread.turns.length) : 0;
  }

  function threadOmittedTurnCount(thread) {
    return boundedCount(thread && thread.mobileOmittedTurnCount);
  }

  function setTimingField(out, key, value) {
    const timing = boundedTiming(value);
    if (timing !== null) out[key] = timing;
  }

  function threadDetailRefreshEventFields(thread, input = {}) {
    const source = objectOrNull(input) || {};
    const detailPerformance = threadDetailEventFieldsWithClient(thread, source);
    const out = {
      source: compactLabel(source.source, 40),
      threadId: compactLabel(source.threadId, 220),
      requestedMode: compactLabel(source.requestedMode, 40),
      readMode: compactLabel(thread && thread.mobileReadMode, 80),
      serverTimings: detailPerformance.serverTimings,
      performancePhase: detailPerformance.performancePhase,
      clientTimings: detailPerformance.clientTimings,
      detailShape: detailPerformance.detailShape,
      status: statusText(thread && thread.status),
      turns: threadTurnCount(thread),
      omittedTurns: threadOmittedTurnCount(thread),
      rolloutSizeBytes: rolloutSizeBytes(thread),
      renderPlanReason: compactLabel(source.renderPlanReason, 80),
      refreshRenderAction: compactLabel(source.refreshRenderAction, 80),
      patchRejectReason: compactLabel(source.patchRejectReason, 80),
      skippedDetailRender: Boolean(source.skippedDetailRender),
      locallyPatchedDetail: Boolean(source.locallyPatchedDetail),
      tilePanePatchedDetail: Boolean(source.tilePanePatchedDetail),
    };
    for (const key of ["elapsedMs", "apiElapsedMs", "renderElapsedMs"]) {
      setTimingField(out, key, source[key]);
    }
    return out;
  }

  function threadDetailFirstPaintEventFields(thread, input = {}) {
    const source = objectOrNull(input) || {};
    const cached = source.cached === true;
    const detailPerformance = threadDetailEventFieldsWithClient(thread, source);
    const performancePhase = classifyThreadDetailPhase(detailPerformance.serverTimings, {
      cached,
      readMode: thread && thread.mobileReadMode,
      readDecision: source.readDecision,
    });
    const out = {
      source: compactLabel(source.source, 40),
      threadId: compactLabel(source.threadId, 220),
      serverTimings: detailPerformance.serverTimings,
      performancePhase,
      clientTimings: detailPerformance.clientTimings,
      detailShape: detailPerformance.detailShape,
      cached,
      readMode: compactLabel(thread && thread.mobileReadMode, 80),
      turns: threadTurnCount(thread),
      rolloutSizeBytes: rolloutSizeBytes(thread),
    };
    for (const key of ["elapsedMs", "apiElapsedMs", "renderElapsedMs"]) {
      setTimingField(out, key, source[key]);
    }
    if (!cached) {
      out.status = statusText(thread && thread.status);
      out.omittedTurns = threadOmittedTurnCount(thread);
    }
    return out;
  }

  function threadDetailFullReadyEventFields(thread, input = {}) {
    const source = objectOrNull(input) || {};
    const detailPerformance = threadDetailEventFieldsWithClient(thread, source);
    const out = {
      source: compactLabel(source.source, 40),
      threadId: compactLabel(source.threadId, 220),
      serverTimings: detailPerformance.serverTimings,
      performancePhase: detailPerformance.performancePhase,
      clientTimings: detailPerformance.clientTimings,
      detailShape: detailPerformance.detailShape,
      readMode: compactLabel(thread && thread.mobileReadMode, 80),
      turns: threadTurnCount(thread),
      omittedTurns: threadOmittedTurnCount(thread),
      rolloutSizeBytes: rolloutSizeBytes(thread),
    };
    for (const key of ["elapsedMs", "apiElapsedMs", "renderElapsedMs"]) {
      setTimingField(out, key, source[key]);
    }
    return out;
  }

  function planThreadDetailSlowPathDiagnostic(event = {}, input = {}) {
    const fields = objectOrNull(event) || {};
    const source = objectOrNull(input) || {};
    const thresholdMs = boundedTiming(source.thresholdMs) || 8000;
    const elapsedMs = boundedTiming(fields.elapsedMs || fields.clientTimings && fields.clientTimings.elapsedMs) || 0;
    const apiElapsedMs = boundedTiming(fields.apiElapsedMs || fields.clientTimings && fields.clientTimings.apiElapsedMs) || 0;
    const renderElapsedMs = boundedTiming(fields.renderElapsedMs || fields.clientTimings && fields.clientTimings.renderElapsedMs) || 0;
    const serverTimings = objectOrNull(fields.serverTimings) || {};
    const slowElapsed = elapsedMs >= thresholdMs;
    const slowApi = apiElapsedMs >= thresholdMs;
    const slowRender = renderElapsedMs >= thresholdMs;
    if (!slowElapsed && !slowApi && !slowRender) {
      return {
        shouldReport: false,
        reason: "below-threshold",
        thresholdMs,
        elapsedMs,
        apiElapsedMs,
        renderElapsedMs,
      };
    }
    const performancePhase = compactLabel(fields.performancePhase, 80);
    const reason = slowApi
      ? "api-slow"
      : slowRender
        ? "render-slow"
        : "elapsed-slow";
    const severe = elapsedMs >= thresholdMs * 2
      || apiElapsedMs >= thresholdMs * 2
      || /cold-thread-read|fallback|bounded-large/.test(performancePhase);
    const detailShape = objectOrNull(fields.detailShape) || {};
    return {
      shouldReport: true,
      reason,
      severityHint: severe ? "H2" : "H3",
      thresholdMs,
      elapsedMs,
      apiElapsedMs,
      renderElapsedMs,
      readMode: compactLabel(fields.readMode, 80),
      performancePhase,
      coldPathOwner: compactLabel(fields.coldPathOwner || serverTimings.coldPathOwner, 80),
      coldPathReason: compactLabel(fields.coldPathReason || serverTimings.coldPathReason, 80),
      source: compactLabel(fields.source || source.source, 40),
      action: compactLabel(source.action || "thread-detail", 80),
      threadHash: compactLabel(source.threadHash || source.thread_hash, 80),
      durationBucket: compactLabel(source.durationBucket || source.duration_bucket, 40),
      renderMode: compactLabel(fields.clientTimings && fields.clientTimings.detailRenderMode, 40),
      rolloutSizeBytes: rolloutSizeBytes(fields),
      turns: boundedCount(fields.turns || detailShape.turns),
      visibleItems: boundedCount(detailShape.visibleItems),
      omittedTurns: boundedCount(fields.omittedTurns || detailShape.omittedTurns),
    };
  }

  function threadDetailProjectionContractFields(thread) {
    const projection = objectOrNull(thread && thread.mobileProjection) || {};
    const timings = threadDetailTimings(thread) || {};
    const readMode = compactLabel(thread && thread.mobileReadMode, 80);
    return {
      readMode,
      projectionSource: compactLabel(projection.source || thread && thread.mobileProjectionSource || timings.projectionSource, 80),
      projectionPartial: booleanFlag(projection.partial) || /projection-v?\d*-partial|projection-partial/.test(readMode),
      projectionPartialKind: compactLabel(projection.partialKind || timings.projectionPartialKind, 80),
      olderCursor: hasCursor(thread && thread.mobileOlderTurnsCursor),
      newerCursor: hasCursor(thread && thread.mobileNewerTurnsCursor),
      status: statusText(thread && thread.status),
      detailShape: threadDetailShape(thread),
      turns: threadTurnCount(thread),
      omittedTurns: threadOmittedTurnCount(thread),
      rolloutSizeBytes: rolloutSizeBytes(thread),
    };
  }

  function activeLikeStatus(value) {
    return /active|running|in[_-]?progress|pending|thinking|queued/.test(String(value || "").toLowerCase());
  }

  function planThreadDetailResponseContractDiagnostic(event = {}, input = {}) {
    const fields = objectOrNull(event) || {};
    const source = objectOrNull(input) || {};
    const contract = source.thread
      ? threadDetailProjectionContractFields(source.thread)
      : objectOrNull(source.contract) || {};
    const detailShape = objectOrNull(fields.detailShape)
      || objectOrNull(contract.detailShape)
      || objectOrNull(source.detailShape)
      || {};
    const readMode = compactLabel(fields.readMode || contract.readMode || source.readMode, 80);
    const performancePhase = compactLabel(fields.performancePhase || source.performancePhase, 80);
    const projectionSource = compactLabel(contract.projectionSource || source.projectionSource, 80);
    const projectionPartialKind = compactLabel(contract.projectionPartialKind || source.projectionPartialKind, 80);
    const projectionPartial = Boolean(contract.projectionPartial || source.projectionPartial);
    const olderCursor = Boolean(contract.olderCursor || source.olderCursor);
    const newerCursor = Boolean(contract.newerCursor || source.newerCursor);
    const turns = boundedCount(fields.turns || contract.turns || detailShape.turns);
    const items = boundedCount(detailShape.items);
    const visibleItems = boundedCount(detailShape.visibleItems);
    const activeTurns = boundedCount(detailShape.activeTurns);
    const completedTurns = boundedCount(detailShape.completedTurns);
    const omittedTurns = boundedCount(fields.omittedTurns || contract.omittedTurns || detailShape.omittedTurns);
    const status = compactLabel(fields.status || contract.status || source.status, 80);
    const activeLike = Boolean(source.expectedActiveFullRead) || activeTurns > 0 || activeLikeStatus(status);
    const windowedMode = /turns-list|projection-v?\d*-partial|projection-partial|summary-timeout|unmaterialized|fallback/.test(readMode)
      || /bounded-large|turns-list|partial|fallback/.test(performancePhase);
    const projectionModeMarkedFull = /projection-v?\d*-(cache|dynamic)|projection-(cache|dynamic)/.test(readMode)
      && !projectionPartial;
    let reason = "";
    let severityHint = "H3";
    if (projectionModeMarkedFull && newerCursor) {
      reason = "projection-window-marked-full";
      severityHint = "H2";
    } else if (turns > 0 && visibleItems === 0 && (items === 0 || projectionPartial || projectionPartialKind === "notification-shell")) {
      reason = "empty-projection-shell";
      severityHint = "H2";
    } else if (activeLike && windowedMode) {
      reason = "active-thread-window-downgrade";
      severityHint = "H2";
    }
    const base = {
      shouldReport: Boolean(reason),
      reason: reason || "ok",
      severityHint,
      action: compactLabel(source.action || fields.source || "thread-detail", 80),
      source: compactLabel(fields.source || source.source, 40),
      threadHash: compactLabel(source.threadHash || source.thread_hash, 80),
      durationBucket: compactLabel(source.durationBucket || source.duration_bucket, 40),
      readMode,
      renderMode: compactLabel(fields.clientTimings && fields.clientTimings.detailRenderMode || source.renderMode, 40),
      performancePhase,
      projectionSource,
      projectionPartialKind,
      projectionPartial,
      olderCursor,
      newerCursor,
      turns,
      items,
      visibleItems,
      activeTurns,
      completedTurns,
      omittedTurns,
      rolloutSizeBytes: rolloutSizeBytes(contract.rolloutSizeBytes ? contract : fields),
    };
    return base;
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
    classifyThreadDetailPhase,
    classifyThreadListPhase,
    rolloutSizeBytes,
    statusText,
    threadDetailClientTimings,
    threadDetailEventFields,
    threadDetailEventFieldsWithClient,
    threadDetailFirstPaintEventFields,
    threadDetailFullReadyEventFields,
    threadDetailRefreshEventFields,
    threadDetailShape,
    threadDetailTimings,
    planThreadDetailResponseContractDiagnostic,
    planThreadDetailSlowPathDiagnostic,
    threadDetailProjectionContractFields,
    threadOmittedTurnCount,
    threadTurnCount,
    threadListEventFields,
    threadListTimings,
  };
}));
