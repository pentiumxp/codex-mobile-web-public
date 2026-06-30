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

function itemKey(item) {
  return [
    text(item && (item.id || item.itemId || item.item_id)),
    text(item && (item.type || item.itemType || item.kind)),
  ].join(":");
}

function evidenceCacheKey(threadId, activeTurnId, turn) {
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  return [
    text(threadId),
    text(activeTurnId),
    items.length,
    itemKey(items[0]),
    itemKey(items[items.length - 1]),
  ].join("|");
}

function rememberBoundedMapEntry(map, key, value, maxSize = 100) {
  if (!map || !key) return value;
  if (map.size >= maxSize && !map.has(key)) {
    const firstKey = map.keys().next().value;
    if (firstKey) map.delete(firstKey);
  }
  map.set(key, value);
  return value;
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

function overlayCompletenessForSnapshot(snapshot = {}) {
  const partialKind = boundedReason(snapshot.partialKind);
  if (snapshot.partial === true) return "partial";
  if (partialKind === "notification-shell") return "partial";
  if (snapshot.signatureHashPresent === false) return "partial";
  return "full";
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
  const summarizeOverlayTurnEvidence = typeof options.summarizeOverlayTurnEvidence === "function"
    ? options.summarizeOverlayTurnEvidence
    : summarizeActiveOverlayTurnEvidence;
  const evidenceCache = new Map();

  function cachedOverlayEvidence(threadId, activeTurnId, turn) {
    const key = evidenceCacheKey(threadId, activeTurnId, turn);
    if (key && evidenceCache.has(key)) return evidenceCache.get(key);
    return rememberBoundedMapEntry(evidenceCache, key, summarizeOverlayTurnEvidence(turn));
  }

  function resolveActiveWindowOverlay(input = {}) {
    const threadId = text(input.threadId);
    if (!projectionService || typeof projectionService.activeOverlaySnapshot !== "function") {
      return unavailableOverlayInput(summaryActiveTurnId(input.summary), "snapshot-api-unavailable");
    }
    const summaryTurnId = summaryActiveTurnId(input.summary);
    const snapshot = projectionService.activeOverlaySnapshot({
      threadId,
      activeTurnId: summaryTurnId,
      cloneOverlayTurn: false,
      normalizeOverlayTurn: false,
    });
    const activeTurnId = summaryTurnId || text(snapshot && snapshot.activeTurnId);
    if (!activeTurnId) return unavailableOverlayInput("", snapshot && snapshot.reason || "missing-active-turn-id");
    if (!snapshot || snapshot.found !== true) {
      return unavailableOverlayInput(activeTurnId, snapshot && snapshot.reason || "snapshot-missing");
    }

    const evidence = cachedOverlayEvidence(threadId, activeTurnId, snapshot.overlayTurn);
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
      overlayCompleteness: overlayCompletenessForSnapshot(snapshot),
      overlayPartial: snapshot.partial === true,
      overlayPartialKind: boundedReason(snapshot.partialKind),
      overlaySignatureHashPresent: snapshot.signatureHashPresent === true,
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
