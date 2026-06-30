"use strict";

const {
  diagnoseThreadDetailColdPath,
} = require("./thread-detail-cold-path-diagnosis-service");

function safeDurationMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number);
}

function safeCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number);
}

function nonEmptyText(value) {
  return String(value || "").trim();
}

function compactLabel(value, maxLength = 80) {
  return nonEmptyText(value).slice(0, maxLength);
}

function classifyThreadDetailPhase(readMode, options = {}) {
  const mode = nonEmptyText(readMode).toLowerCase();
  if (options.cached === true) return "warm-client-current";
  const readDecision = nonEmptyText(options.readDecision).toLowerCase();
  const projectionState = nonEmptyText(options.projectionState).toLowerCase();
  const projectionSource = nonEmptyText(options.projectionSource).toLowerCase();
  const projectionSeedStatus = nonEmptyText(options.projectionSeedStatus).toLowerCase();
  if (readDecision === "projection-partial-hit"
    || readDecision === "projection-stale-partial-hit"
    || /projection-v?\d*-partial|projection-partial/.test(mode)) {
    return "warm-projection-partial";
  }
  if (readDecision === "projection-active-overlay" || /projection-active-overlay/.test(mode)) {
    return "warm-projection-active-overlay";
  }
  if (readDecision === "projection-hit" || projectionState === "hit") {
    if (/dynamic/.test(projectionSource) || /projection-v?\d*-dynamic|projection-dynamic/.test(mode)) {
      return "warm-projection-dynamic";
    }
    return "warm-projection-cache";
  }
  if (readDecision === "bounded-large-turns-list" || /turns-list-large/.test(mode)) {
    return "bounded-large-thread-window";
  }
  if (readDecision === "initial-turns-list" || /turns-list-initial/.test(mode)) {
    return projectionSeedStatus === "seeded-partial"
      ? "cold-turns-list-initial-seeded-partial"
      : "cold-turns-list-initial";
  }
  if (readDecision === "raw-thread-read" || /thread-read-raw/.test(mode)) return "cold-thread-read-raw";
  if (readDecision === "full-thread-read" || /thread-read/.test(mode)) return "cold-thread-read";
  if (readDecision === "fallback-turns-list" || /turns-list/.test(mode)) return "fallback-turns-list";
  if (readDecision === "summary-fallback" || /summary-timeout|unmaterialized|fallback/.test(mode)) {
    return "fallback-summary";
  }
  if (!mode && !readDecision && !projectionState) return "unknown";
  return "unknown";
}

function threadCounts(thread) {
  const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
  return {
    returnedTurns: turns.length,
    omittedTurns: safeCount(thread && thread.mobileOmittedTurnCount),
  };
}

function buildThreadDetailDiagnostics(input = {}) {
  const thread = input.thread || null;
  const timings = input.timings && typeof input.timings === "object" ? input.timings : {};
  const readMode = nonEmptyText(input.readMode || (thread && thread.mobileReadMode));
  const counts = threadCounts(thread);
  const output = {
    totalMs: safeDurationMs(input.totalMs),
    requestMode: nonEmptyText(input.requestMode),
    readMode,
    phase: classifyThreadDetailPhase(readMode, input),
    readDecision: compactLabel(input.readDecision, 80),
    summarySource: nonEmptyText(input.summarySource),
    projectionState: compactLabel(input.projectionState, 80),
    projectionInputAvailable: input.projectionInputAvailable === true,
    projectionSource: compactLabel(input.projectionSource, 80),
    projectionVersion: compactLabel(input.projectionVersion, 80),
    projectionAgeMs: safeDurationMs(input.projectionAgeMs),
    projectionMissReason: compactLabel(input.projectionMissReason, 80),
    projectionSeedStatus: compactLabel(input.projectionSeedStatus, 80),
    projectionSeedSource: compactLabel(input.projectionSeedSource, 80),
    activeFullReadRequired: input.activeFullReadRequired === true,
    activeFullReadReason: compactLabel(input.activeFullReadReason, 80),
    activeOverlayAction: compactLabel(input.activeOverlayAction, 80),
    activeOverlayReason: compactLabel(input.activeOverlayReason, 80),
    activeOverlaySource: compactLabel(input.activeOverlaySource, 80),
    activeOverlayItems: safeCount(input.activeOverlayItems),
    activeOverlayOperationItems: safeCount(input.activeOverlayOperationItems),
    activeOverlayUploadItems: safeCount(input.activeOverlayUploadItems),
    activeOverlayAssistantItems: safeCount(input.activeOverlayAssistantItems),
    activeOverlayReceiptItems: safeCount(input.activeOverlayReceiptItems),
    activeOverlayWindowFirst: input.activeOverlayWindowFirst === true,
    returnedTurns: safeCount(input.returnedTurns || counts.returnedTurns),
    omittedTurns: safeCount(input.omittedTurns || counts.omittedTurns),
    rolloutSizeBytes: safeCount(input.rolloutSizeBytes),
    largeReadProtected: Boolean(input.largeReadProtected),
    largeReadRolloutSizeBytes: safeCount(input.largeReadRolloutSizeBytes),
    largeReadThresholdBytes: safeCount(input.largeReadThresholdBytes),
    largeReadSource: nonEmptyText(input.largeReadSource),
    largeReadReason: nonEmptyText(input.largeReadReason),
  };
  const coldPath = diagnoseThreadDetailColdPath(output);
  output.coldPathOwner = compactLabel(coldPath.owner, 80);
  output.coldPathReason = compactLabel(coldPath.reason, 80);
  for (const key of [
    "summaryMs",
    "projectionMs",
    "turnsListInitialMs",
    "turnsListBeforeFullMs",
    "threadReadMs",
    "rawThreadReadMs",
    "turnsListFallbackMs",
    "prepareResponseMs",
    "activeOverlayMs",
    "activeOverlayResolveMs",
    "activeOverlayProjectionLookupMs",
    "activeOverlayPlanMs",
    "activeOverlayWindowMs",
    "activeOverlayBackfillWindowMs",
    "activeOverlayFullProjectionMs",
    "activeOverlayHistoryBaselineMs",
    "activeOverlayMergeMs",
  ]) {
    output[key] = safeDurationMs(timings[key]);
  }
  return output;
}

function attachThreadDetailDiagnostics(result, input = {}) {
  if (!result || typeof result !== "object" || !result.thread || typeof result.thread !== "object") return result;
  const diagnostics = buildThreadDetailDiagnostics(Object.assign({}, input, { thread: result.thread }));
  result.thread.mobileDiagnostics = Object.assign({}, result.thread.mobileDiagnostics || {}, {
    threadDetailTimings: diagnostics,
  });
  return result;
}

module.exports = {
  attachThreadDetailDiagnostics,
  buildThreadDetailDiagnostics,
  classifyThreadDetailPhase,
};
