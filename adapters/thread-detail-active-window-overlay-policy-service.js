"use strict";

const {
  summaryActiveTurnId,
} = require("./thread-detail-active-read-policy-service");

function text(value) {
  return String(value || "").trim();
}

function bool(value) {
  return value === true;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function lower(value) {
  return text(value).toLowerCase();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function boundedReason(value) {
  return lower(value).slice(0, 80);
}

function turnId(turn) {
  return text(turn && (
    turn.id
    || turn.turnId
    || turn.turn_id
  ));
}

function itemType(item) {
  return lower(item && (
    item.type
    || item.itemType
    || item.mobileVisibleKind
    || item.kind
  ));
}

function itemTimestampMs(item) {
  return numberOrZero(item && (
    item.startedAtMs
    || item.createdAtMs
    || item.updatedAtMs
    || item.timestampMs
    || item.timeMs
  ));
}

function classifyActiveOverlayItem(item) {
  if (!item || typeof item !== "object") return "unknown";
  const type = itemType(item);
  if (
    type === "commandexecution"
    || type === "filechange"
    || type === "toolcall"
    || type === "tool_call"
    || type === "function_call"
    || type === "operation"
    || type === "live-operation"
    || type === "operationitem"
    || item.commandExecution
    || item.fileChange
    || item.toolCall
  ) {
    return "operation";
  }
  if (
    type === "input_image"
    || type === "uploaded-image"
    || type === "uploadedimage"
    || type === "attachment"
    || type === "fileattachment"
    || type === "image"
    || item.uploadedImage
    || item.upload
    || item.attachment
    || item.imageUrl
    || item.image_url
  ) {
    return "upload";
  }
  if (
    type === "agentmessage"
    || type === "assistantmessage"
    || type === "assistant"
    || type === "message"
    || type === "text"
    || item.agentMessage
  ) {
    return "assistant";
  }
  if (
    type === "usage"
    || type === "usagesummary"
    || type === "turnusage"
    || type === "turndiagnostic"
    || type === "diagnostic"
    || item.usage
    || item.turnDiagnostic
    || item.diagnostic
  ) {
    return "receipt";
  }
  return "other";
}

function summarizeActiveOverlayTurnEvidence(turn) {
  const items = asArray(turn && turn.items);
  const counts = {
    items: items.length,
    operationItems: 0,
    uploadItems: 0,
    assistantItems: 0,
    receiptItems: 0,
    otherItems: 0,
    unknownItems: 0,
  };
  let latestItemTimestampMs = 0;
  for (const item of items) {
    latestItemTimestampMs = Math.max(latestItemTimestampMs, itemTimestampMs(item));
    const kind = classifyActiveOverlayItem(item);
    if (kind === "operation") counts.operationItems += 1;
    else if (kind === "upload") counts.uploadItems += 1;
    else if (kind === "assistant") counts.assistantItems += 1;
    else if (kind === "receipt") counts.receiptItems += 1;
    else if (kind === "unknown") counts.unknownItems += 1;
    else counts.otherItems += 1;
  }
  return Object.assign({
    turnId: turnId(turn),
    latestItemTimestampMs,
  }, counts);
}

function normalizeCoverage(value, presentCount) {
  const normalized = lower(value);
  if (normalized === "present" || normalized === "none" || normalized === "preserved") return normalized;
  if (presentCount > 0) return "present";
  return "unknown";
}

function normalizeAssistantCoverage(value, evidence, input) {
  const normalized = lower(value);
  if (normalized === "fresh" || normalized === "none") return normalized;
  if (normalized === "stale" || normalized === "unknown") return normalized;
  if (evidence.assistantItems <= 0) return "unknown";
  const projectionRevision = numberOrZero(input.projectionRevision);
  const overlayRevision = numberOrZero(input.overlayRevision);
  if (projectionRevision || overlayRevision) {
    if (!projectionRevision || !overlayRevision) return "unknown";
    if (overlayRevision < projectionRevision) return "stale";
    return "fresh";
  }
  const projectionTimestampMs = numberOrZero(input.projectionTimestampMs);
  const overlayTimestampMs = numberOrZero(input.overlayTimestampMs || evidence.latestItemTimestampMs);
  if (projectionTimestampMs || overlayTimestampMs) {
    if (!projectionTimestampMs || !overlayTimestampMs) return "unknown";
    if (overlayTimestampMs < projectionTimestampMs) return "stale";
    return "fresh";
  }
  return "unknown";
}

function projectionWindowReason(thread) {
  if (!thread || typeof thread !== "object") return "missing-projection-window";
  const turns = asArray(thread.turns);
  if (!turns.length) return "empty-projection-window";
  const mode = lower(thread.mobileReadMode);
  const projection = thread.mobileProjection && typeof thread.mobileProjection === "object"
    ? thread.mobileProjection
    : {};
  const source = lower(projection.source || thread.mobileProjectionSource);
  const version = lower(projection.version || thread.mobileProjectionVersion);
  const partial = bool(projection.partial) || /partial/.test(mode) || source === "partial";
  const dynamic = /projection/.test(mode) || source === "dynamic" || source === "cache" || source === "partial" || version === "v4";
  if (!partial && !dynamic) return "not-projection-window";
  return "";
}

function authoritativeSource(value) {
  const source = lower(value);
  return source === "app-server-notification"
    || source === "mux-notification"
    || source === "projection-live"
    || source === "turn-start-overlay"
    || source === "server-active-overlay";
}

function planActiveWindowOverlay(input = {}) {
  const summary = input.summary || null;
  const expectedTurnId = text(input.activeTurnId || summaryActiveTurnId(summary));
  const overlayTurn = input.overlayTurn || null;
  const evidence = input.overlayEvidence || summarizeActiveOverlayTurnEvidence(overlayTurn);
  const resultBase = {
    action: "require-full-read",
    reason: "",
    activeTurnIdPresent: Boolean(expectedTurnId),
    projectionWindowPresent: false,
    overlayTurnPresent: Boolean(overlayTurn),
    overlaySource: lower(input.overlaySource),
    overlayTurnMatched: false,
    operationCoverage: "unknown",
    uploadCoverage: "unknown",
    assistantDeltaCoverage: "unknown",
    receiptCoverage: "unknown",
    counts: {
      items: evidence.items || 0,
      operationItems: evidence.operationItems || 0,
      uploadItems: evidence.uploadItems || 0,
      assistantItems: evidence.assistantItems || 0,
      receiptItems: evidence.receiptItems || 0,
      otherItems: evidence.otherItems || 0,
      unknownItems: evidence.unknownItems || 0,
    },
  };

  if (!expectedTurnId) return Object.assign({}, resultBase, { reason: "missing-active-turn-id" });
  const projectionReason = projectionWindowReason(input.projectionThread);
  if (projectionReason) return Object.assign({}, resultBase, { reason: projectionReason });
  resultBase.projectionWindowPresent = true;
  if (!authoritativeSource(input.overlaySource)) {
    return Object.assign({}, resultBase, { reason: "non-authoritative-overlay-source" });
  }
  if (!overlayTurn || typeof overlayTurn !== "object") {
    return Object.assign({}, resultBase, { reason: "missing-active-overlay-turn" });
  }
  const actualTurnId = text(evidence.turnId || turnId(overlayTurn));
  if (actualTurnId !== expectedTurnId) {
    return Object.assign({}, resultBase, {
      reason: "active-turn-mismatch",
      overlayTurnMatched: false,
    });
  }
  resultBase.overlayTurnMatched = true;
  if (evidence.items <= 0) return Object.assign({}, resultBase, { reason: "empty-active-overlay-turn" });
  if (evidence.unknownItems > 0) return Object.assign({}, resultBase, { reason: "unknown-overlay-item-kind" });

  const operationCoverage = normalizeCoverage(input.operationCoverage, evidence.operationItems);
  if (operationCoverage === "unknown") {
    return Object.assign({}, resultBase, { reason: "operation-evidence-unknown", operationCoverage });
  }
  const uploadCoverage = normalizeCoverage(input.uploadCoverage, evidence.uploadItems);
  if (uploadCoverage === "unknown") {
    return Object.assign({}, resultBase, { reason: "upload-evidence-unknown", operationCoverage, uploadCoverage });
  }
  const assistantDeltaCoverage = normalizeAssistantCoverage(input.assistantDeltaCoverage, evidence, input);
  if (assistantDeltaCoverage === "unknown") {
    return Object.assign({}, resultBase, {
      reason: "assistant-delta-unknown",
      operationCoverage,
      uploadCoverage,
      assistantDeltaCoverage,
    });
  }
  if (assistantDeltaCoverage === "stale") {
    return Object.assign({}, resultBase, {
      reason: "assistant-delta-stale",
      operationCoverage,
      uploadCoverage,
      assistantDeltaCoverage,
    });
  }
  const receiptCoverage = normalizeCoverage(input.receiptCoverage, evidence.receiptItems);
  if (receiptCoverage === "unknown") {
    return Object.assign({}, resultBase, {
      reason: "receipt-evidence-unknown",
      operationCoverage,
      uploadCoverage,
      assistantDeltaCoverage,
      receiptCoverage,
    });
  }

  return Object.assign({}, resultBase, {
    action: "use-projection-overlay",
    reason: "overlay-evidence-complete",
    operationCoverage,
    uploadCoverage,
    assistantDeltaCoverage,
    receiptCoverage,
  });
}

function mergeProjectionThreadWithActiveOverlay(projectionThread, overlayTurn, options = {}) {
  if (!projectionThread || typeof projectionThread !== "object") return null;
  if (!overlayTurn || typeof overlayTurn !== "object") return cloneJson(projectionThread);
  const thread = cloneJson(projectionThread);
  const turn = cloneJson(overlayTurn);
  const id = turnId(turn);
  const turns = asArray(thread.turns).map((candidate) => cloneJson(candidate));
  const existingIndex = id ? turns.findIndex((candidate) => turnId(candidate) === id) : -1;
  if (existingIndex >= 0) turns[existingIndex] = Object.assign({}, turns[existingIndex], turn);
  else turns.push(turn);
  thread.turns = turns;
  thread.status = Object.assign({}, thread.status && typeof thread.status === "object"
    ? thread.status
    : { type: thread.status || "active" }, { type: "active" });
  if (id) thread.activeTurnId = id;
  thread.mobileReadMode = options.readMode || "projection-active-overlay";
  thread.mobileProjection = Object.assign({}, thread.mobileProjection || {}, {
    activeOverlay: true,
    activeOverlaySource: lower(options.overlaySource),
  });
  thread.mobileActiveOverlay = {
    reason: boundedReason(options.reason || "overlay-evidence-complete"),
    source: lower(options.overlaySource),
    counts: Object.assign({}, options.counts || {}),
  };
  return thread;
}

module.exports = {
  classifyActiveOverlayItem,
  mergeProjectionThreadWithActiveOverlay,
  planActiveWindowOverlay,
  summarizeActiveOverlayTurnEvidence,
};
