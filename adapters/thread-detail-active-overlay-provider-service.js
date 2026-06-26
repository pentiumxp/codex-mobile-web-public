"use strict";

const {
  summaryActiveTurnId,
} = require("./thread-detail-active-read-policy-service");
const {
  summarizeActiveOverlayTurnEvidence,
} = require("./thread-detail-active-window-overlay-policy-service");

function text(value) {
  return String(value || "").trim();
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
}

function boundedReason(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 80);
}

function coverageForCount(count) {
  return Number(count || 0) > 0 ? "present" : "none";
}

function projectionRevisionFromThread(thread) {
  const projection = thread && thread.mobileProjection && typeof thread.mobileProjection === "object"
    ? thread.mobileProjection
    : {};
  return numberOrZero(projection.revision || thread && thread.mobileProjectionRevision);
}

function projectionTimestampFromThread(thread) {
  const projection = thread && thread.mobileProjection && typeof thread.mobileProjection === "object"
    ? thread.mobileProjection
    : {};
  return numberOrZero(
    projection.updatedAtMs
      || projection.cachedAtMs
      || thread && thread.mobileProjectionUpdatedAtMs
      || thread && thread.updatedAtMs,
  );
}

function unavailableOverlayInput(activeTurnId, reason) {
  return {
    activeTurnId,
    overlaySource: "projection-live",
    overlayUnavailableReason: boundedReason(reason || "snapshot-unavailable"),
    operationCoverage: "unknown",
    uploadCoverage: "unknown",
    assistantDeltaCoverage: "unknown",
    receiptCoverage: "unknown",
  };
}

function createThreadDetailActiveOverlayProviderService(options = {}) {
  const projectionService = options.projectionService || null;

  function resolveActiveWindowOverlay(input = {}) {
    const threadId = text(input.threadId);
    const activeTurnId = summaryActiveTurnId(input.summary);
    if (!activeTurnId) return unavailableOverlayInput("", "missing-active-turn-id");
    if (!projectionService || typeof projectionService.activeOverlaySnapshot !== "function") {
      return unavailableOverlayInput(activeTurnId, "snapshot-api-unavailable");
    }
    const snapshot = projectionService.activeOverlaySnapshot({ threadId, activeTurnId });
    if (!snapshot || snapshot.found !== true) {
      return unavailableOverlayInput(activeTurnId, snapshot && snapshot.reason || "snapshot-missing");
    }

    const evidence = summarizeActiveOverlayTurnEvidence(snapshot.overlayTurn);
    const projectionRevision = projectionRevisionFromThread(input.projectionThread);
    const overlayRevision = numberOrZero(snapshot.overlayRevision);
    const projectionTimestampMs = projectionTimestampFromThread(input.projectionThread);
    const overlayTimestampMs = numberOrZero(snapshot.updatedAtMs);
    const assistantDeltaCoverage = evidence.assistantItems > 0 ? "" : "none";

    return {
      activeTurnId,
      overlaySource: snapshot.overlaySource || "projection-live",
      overlayTurn: snapshot.overlayTurn,
      overlayEvidence: evidence,
      operationCoverage: coverageForCount(evidence.operationItems),
      uploadCoverage: coverageForCount(evidence.uploadItems),
      assistantDeltaCoverage,
      receiptCoverage: coverageForCount(evidence.receiptItems),
      projectionRevision,
      overlayRevision,
      projectionTimestampMs,
      overlayTimestampMs,
    };
  }

  return {
    resolveActiveWindowOverlay,
  };
}

module.exports = {
  createThreadDetailActiveOverlayProviderService,
};
