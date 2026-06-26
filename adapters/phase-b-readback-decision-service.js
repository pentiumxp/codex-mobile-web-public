"use strict";

function compactLabel(value, maxLength = 100) {
  return String(value || "").trim().slice(0, maxLength);
}

function objectOrNull(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function lowerLabel(value, maxLength = 100) {
  return compactLabel(value, maxLength).toLowerCase();
}

function buildEvidence(report = {}) {
  const list = objectOrNull(report.threadList) || {};
  const detail = objectOrNull(report.detail) || {};
  return {
    threadListOwner: compactLabel(list.coldPathOwner, 80),
    threadListReason: compactLabel(list.coldPathReason, 80),
    threadListCacheDecision: compactLabel(list.fallbackCacheDecision, 80),
    threadListSourceSnapshotHit: list.fallbackSourceSnapshotHit === true,
    threadListSourceSnapshotRawCount: Number.isFinite(Number(list.fallbackSourceSnapshotRawCount)) ? Math.max(0, Math.min(100000, Math.trunc(Number(list.fallbackSourceSnapshotRawCount)))) : 0,
    threadListResultCount: Number.isFinite(Number(list.resultCount)) ? Math.max(0, Math.min(100000, Math.trunc(Number(list.resultCount)))) : 0,
    detailOwner: compactLabel(detail.coldPathOwner, 80),
    detailReason: compactLabel(detail.coldPathReason, 80),
    detailReadMode: compactLabel(detail.readMode, 100),
    detailReadDecision: compactLabel(detail.readDecision, 100),
    detailProjectionState: compactLabel(detail.projectionState, 80),
    detailActiveOverlayAction: compactLabel(detail.activeOverlayAction, 80),
    detailActiveOverlayReason: compactLabel(detail.activeOverlayReason, 80),
    detailActiveOverlayGate: compactLabel(detail.activeOverlayGate, 80),
    detailActiveOverlayGateReason: compactLabel(detail.activeOverlayGateReason, 80),
    detailActiveOverlayNextAction: compactLabel(detail.activeOverlayNextAction, 100),
    detailTurnCount: Number.isFinite(Number(detail.turnCount)) ? Math.max(0, Math.min(100000, Math.trunc(Number(detail.turnCount)))) : 0,
  };
}

function checkFailureDecision(report = {}, options = {}) {
  const failure = compactLabel(report.failure, 80);
  if (!failure) return null;
  if (failure === "activeOverlay") {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "active-overlay",
      reason: "required-active-overlay-missing",
      nextAction: "repair-active-overlay-proof-gate",
    };
  }
  if (failure === "threadListColdPath" && options.allowMissingColdPath === true) return null;
  return {
    status: "blocked",
    priority: "H2",
    owner: "readback-contract",
    reason: `missing-${failure || "required-field"}`.slice(0, 100),
    nextAction: "repair-phase-b-readback-contract",
  };
}

function detailDecision(detail = {}) {
  const owner = lowerLabel(detail.coldPathOwner, 80);
  const reason = compactLabel(detail.coldPathReason, 80);
  const activeFullReadRequired = detail.activeFullReadRequired === true;
  const readMode = lowerLabel(detail.readMode, 100);
  const readDecision = lowerLabel(detail.readDecision, 100);

  if (!owner && !readMode && !readDecision) return null;
  if (owner === "warm-path" || readMode === "projection-active-overlay" || readDecision === "projection-active-overlay") {
    return null;
  }
  if (activeFullReadRequired || owner === "active-read-policy") {
    const overlayReason = compactLabel(detail.activeOverlayGateReason || detail.activeOverlayReason || detail.projectionMissReason, 80);
    const overlayNextAction = compactLabel(detail.activeOverlayNextAction, 100);
    return {
      status: "needs_repair",
      priority: "H1",
      owner: "active-overlay",
      reason: overlayReason || reason || "active-full-read-required",
      nextAction: overlayNextAction || "complete-active-window-overlay-coverage",
    };
  }
  if (owner === "projection-cache") {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "projection-cache",
      reason: reason || "projection-cache-cold-path",
      nextAction: "repair-projection-cache-lifecycle",
    };
  }
  if (owner === "projection-input") {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "projection-input",
      reason: reason || "projection-input-unavailable",
      nextAction: "repair-projection-input-availability",
    };
  }
  if (owner === "summary") {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "summary-rollout-evidence",
      reason: reason || "summary-large-window",
      nextAction: "repair-summary-rollout-size-evidence",
    };
  }
  if (owner === "app-server-thread-read" || owner === "app-server-turns-list" || owner === "app-server-fallback") {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "app-server-detail-read",
      reason: reason || owner,
      nextAction: "reduce-app-server-detail-fallback",
    };
  }
  if (owner === "bounded-turns-list") {
    return {
      status: "observe",
      priority: "H3",
      owner: "bounded-turns-list",
      reason: reason || "bounded-current-window",
      nextAction: "observe-bounded-window-before-optimizing",
    };
  }
  return null;
}

function threadListDecision(list = {}) {
  const owner = lowerLabel(list.coldPathOwner, 80);
  const reason = compactLabel(list.coldPathReason, 80);
  if (!owner || owner === "warm-fallback-cache" || owner === "fallback-source-snapshot") return null;
  if (owner === "fallback-baseline") {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "thread-list-fallback-baseline",
      reason: reason || "fallback-baseline-build",
      nextAction: "optimize-thread-list-fallback-baseline",
    };
  }
  if (owner === "fallback-cache-policy") {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "thread-list-cache-freshness",
      reason: reason || "fallback-cache-policy",
      nextAction: "repair-thread-list-cache-freshness",
    };
  }
  if (owner === "app-server-thread-list") {
    return {
      status: "needs_repair",
      priority: "H2",
      owner: "app-server-thread-list",
      reason: reason || "app-server-thread-list",
      nextAction: "investigate-app-server-thread-list",
    };
  }
  if (owner === "deferred-fallback") {
    return {
      status: "observe",
      priority: "H3",
      owner: "thread-list-deferred-fallback",
      reason: reason || "deferred-fallback",
      nextAction: "observe-deferred-fallback-before-optimizing",
    };
  }
  return null;
}

function classifyPhaseBReadback(report = {}, options = {}) {
  const failure = checkFailureDecision(report, options);
  const detail = objectOrNull(report.detail) || {};
  const list = objectOrNull(report.threadList) || {};
  const decision = failure || detailDecision(detail) || threadListDecision(list) || {
    status: "ready",
    priority: "H3",
    owner: "phase-b-readback",
    reason: "warm-or-bounded-paths",
    nextAction: "proceed-to-next-phase-b-root-cause-target",
  };
  return Object.assign({}, decision, {
    evidence: buildEvidence(report),
  });
}

module.exports = {
  classifyPhaseBReadback,
};
