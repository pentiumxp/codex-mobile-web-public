"use strict";

function nonEmptyText(value) {
  return String(value || "").trim();
}

function compactLabel(value, maxLength = 80) {
  return nonEmptyText(value).slice(0, maxLength);
}

function lowerLabel(value, maxLength = 80) {
  return compactLabel(value, maxLength).toLowerCase();
}

function booleanFlag(value) {
  return value === true;
}

function projectionMissReasonLabel(value) {
  const reason = compactLabel(value, 80);
  if (!reason) return "";
  return `projection-miss:${reason}`.slice(0, 80);
}

function projectionInputUnavailableReason(input = {}) {
  const largeReadReason = compactLabel(input.largeReadReason, 80);
  if (largeReadReason) return `projection-input-unavailable:${largeReadReason}`.slice(0, 80);
  return "projection-input-unavailable";
}

function diagnoseThreadDetailColdPath(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const phase = lowerLabel(source.phase);
  const readDecision = lowerLabel(source.readDecision);
  const readMode = lowerLabel(source.readMode);
  const projectionState = lowerLabel(source.projectionState);
  const projectionSource = lowerLabel(source.projectionSource);
  const projectionMissReason = compactLabel(source.projectionMissReason, 80);
  const projectionSeedStatus = lowerLabel(source.projectionSeedStatus);
  const projectionSeedSource = lowerLabel(source.projectionSeedSource);
  const largeReadSource = lowerLabel(source.largeReadSource);
  const largeReadReason = compactLabel(source.largeReadReason, 80);
  const activeFullReadRequired = booleanFlag(source.activeFullReadRequired);
  const activeFullReadReason = compactLabel(source.activeFullReadReason, 80);
  const projectionInputAvailable = booleanFlag(source.projectionInputAvailable);

  if (phase.startsWith("warm-") || readDecision === "projection-hit" || readDecision === "projection-partial-hit" || projectionState === "hit") {
    return {
      owner: "warm-path",
      reason: phase && phase !== "unknown" ? phase : (readDecision || projectionSource || "projection-hit"),
    };
  }

  if (activeFullReadRequired || largeReadReason === "active-thread-requires-full-read") {
    return {
      owner: "active-read-policy",
      reason: activeFullReadReason || largeReadReason || "active-thread-requires-full-read",
    };
  }

  if (readDecision === "initial-turns-list" || /turns-list-initial/.test(readMode)) {
    if (projectionSeedStatus === "seeded-partial") {
      return {
        owner: "projection-cache",
        reason: "seeded-partial-current-window",
      };
    }
    if (!projectionInputAvailable || projectionSeedSource === "no-projection-input") {
      return {
        owner: "projection-input",
        reason: "initial-window-no-projection-input",
      };
    }
    return {
      owner: "bounded-turns-list",
      reason: projectionSeedStatus ? `initial-window:${projectionSeedStatus}`.slice(0, 80) : "initial-current-window",
    };
  }

  if (readDecision === "bounded-large-turns-list" || /turns-list-large/.test(readMode)) {
    if (largeReadSource === "summary" && !projectionInputAvailable) {
      return {
        owner: "summary",
        reason: largeReadReason ? `summary:${largeReadReason}`.slice(0, 80) : "summary-large-window",
      };
    }
    if (!projectionInputAvailable || projectionState === "unavailable") {
      return {
        owner: "projection-input",
        reason: projectionInputUnavailableReason(source),
      };
    }
    if (projectionState === "miss" || projectionMissReason) {
      return {
        owner: "projection-cache",
        reason: projectionMissReasonLabel(projectionMissReason) || "projection-miss-large-window",
      };
    }
    return {
      owner: "bounded-turns-list",
      reason: largeReadReason || "large-window",
    };
  }

  if (readDecision === "full-thread-read" || /thread-read/.test(readMode)) {
    if (!projectionInputAvailable || projectionState === "unavailable") {
      return {
        owner: "projection-input",
        reason: projectionInputUnavailableReason(source),
      };
    }
    if (projectionState === "miss" || projectionMissReason) {
      return {
        owner: "projection-cache",
        reason: projectionMissReasonLabel(projectionMissReason) || "projection-miss-full-read",
      };
    }
    if (projectionSeedStatus === "failed") {
      return {
        owner: "projection-cache",
        reason: "projection-seed-failed",
      };
    }
    return {
      owner: "app-server-thread-read",
      reason: readDecision || "full-thread-read",
    };
  }

  if (readDecision === "fallback-turns-list" || /(^|-)turns-list$/.test(readMode)) {
    return {
      owner: "app-server-turns-list",
      reason: "thread-read-fallback",
    };
  }

  if (readDecision === "summary-fallback" || /summary-timeout|unmaterialized|fallback/.test(readMode)) {
    return {
      owner: "app-server-fallback",
      reason: readMode || "summary-fallback",
    };
  }

  return {
    owner: "unknown",
    reason: readDecision || readMode || phase || "unknown",
  };
}

module.exports = {
  diagnoseThreadDetailColdPath,
};
