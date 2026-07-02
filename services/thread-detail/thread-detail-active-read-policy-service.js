"use strict";

function nonEmptyText(value) {
  return String(value || "").trim();
}

function statusText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && value.type) return String(value.type || "");
  return String(value || "");
}

function isActiveLikeStatus(value) {
  return /^(active|running|started|pending|queued|processing|inprogress|in_progress|in-progress)$/i
    .test(statusText(value).trim());
}

function summaryActiveTurnId(summary) {
  return nonEmptyText(summary && (
    summary.activeTurnId
    || summary.active_turn_id
    || summary.mobileLocalActiveStatus && (
      summary.mobileLocalActiveStatus.turnId
      || summary.mobileLocalActiveStatus.turn_id
    )
  ));
}

function activeFullThreadReadReason(summary) {
  if (!summary || typeof summary !== "object") return "";
  if (summaryActiveTurnId(summary)) return "active-turn-id";
  if (isActiveLikeStatus(summary.status)) return "status-active";
  if (isActiveLikeStatus(summary.mobileStatus)) return "mobile-status-active";
  if (isActiveLikeStatus(summary.mobileLocalActiveStatus && summary.mobileLocalActiveStatus.status)) {
    return "local-active-status";
  }
  return "";
}

function planActiveThreadDetailReadPolicy(input = {}) {
  const preferRecentTurns = input.preferRecentTurns === true;
  const activeFullReadReason = activeFullThreadReadReason(input.summary);
  const activeFullReadRequired = Boolean(activeFullReadReason);
  return {
    activeFullReadRequired,
    activeFullReadReason,
    allowPartialProjection: preferRecentTurns && !activeFullReadRequired,
    shouldUseInitialTurnsList: preferRecentTurns && !activeFullReadRequired,
    initialTurnsListSkipReason: preferRecentTurns && activeFullReadRequired
      ? "active-thread-requires-full-read"
      : "",
  };
}

function activeReasonRequiresFullThreadRead(reason) {
  const normalized = nonEmptyText(reason);
  return normalized === "active-turn-id" || normalized === "projection-live-active-turn";
}

function applyActiveThreadPolicyToBoundedReadDecision(boundedReadDecision, activePolicy = {}) {
  const decision = boundedReadDecision && typeof boundedReadDecision === "object"
    ? boundedReadDecision
    : {};
  if (decision.prefer
    && activePolicy.activeFullReadRequired
    && activeReasonRequiresFullThreadRead(activePolicy.activeFullReadReason)) {
    return Object.assign({}, decision, {
      prefer: false,
      reason: "active-thread-requires-full-read",
    });
  }
  return decision;
}

module.exports = {
  activeReasonRequiresFullThreadRead,
  activeFullThreadReadReason,
  applyActiveThreadPolicyToBoundedReadDecision,
  isActiveLikeStatus,
  planActiveThreadDetailReadPolicy,
  statusText,
  summaryActiveTurnId,
};
