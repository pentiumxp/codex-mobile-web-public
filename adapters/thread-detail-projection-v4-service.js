"use strict";

const {
  createThreadDetailProjectionService,
} = require("./thread-detail-projection-service");
const {
  PROJECTION_VERSION,
  normalizeNotificationParamsForProjectionV4,
  normalizeThreadVisibleProjection,
  projectionDiffSummary,
} = require("./thread-visible-item-normalizer");

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

function notificationThreadId(params = {}) {
  if (!params || typeof params !== "object") return "";
  return String(params.threadId
    || params.conversationId
    || params.thread && params.thread.id
    || params.turn && (params.turn.threadId || params.turn.thread_id)
    || "").trim();
}

function resultThreadId(result) {
  return String(result && result.thread && (result.thread.id || result.thread.threadId) || "").trim();
}

function createThreadDetailProjectionV4Service(options = {}) {
  const policyVersion = String(options.policyVersion || "state-relevant-receipt-v4");
  const base = createThreadDetailProjectionService(Object.assign({}, options, {
    policyVersion,
  }));
  const revisions = new Map();

  function revisionForThread(threadId) {
    const id = String(threadId || "").trim();
    return id ? safeNumber(revisions.get(id)) : 0;
  }

  function bumpRevision(threadId) {
    const id = String(threadId || "").trim();
    if (!id) return 0;
    const next = revisionForThread(id) + 1;
    revisions.set(id, next);
    return next;
  }

  function normalizeResult(result, details = {}) {
    const threadId = String(details.threadId || resultThreadId(result) || "").trim();
    const revision = details.revision !== undefined ? details.revision : revisionForThread(threadId);
    return normalizeThreadVisibleProjection(result, {
      source: details.source || "projection-v4",
      revision,
    });
  }

  function seed(input = {}, result, optionsForSeed = {}) {
    const threadId = String(input.threadId || resultThreadId(result) || "").trim();
    const revision = revisionForThread(threadId) + 1;
    const normalized = normalizeResult(result, {
      threadId,
      source: "seed",
      revision,
    });
    const meta = base.seed(input, normalized, optionsForSeed);
    if (meta && meta.skipped) {
      return Object.assign({}, meta, {
        version: PROJECTION_VERSION,
        revision: revisionForThread(threadId),
      });
    }
    if (meta) revisions.set(threadId, revision);
    return meta ? Object.assign({}, meta, {
      version: PROJECTION_VERSION,
      revision,
    }) : meta;
  }

  function get(input = {}, optionsForGet = {}) {
    const cached = base.get(input, optionsForGet);
    if (!cached || !cached.result) return cached;
    const threadId = String(input.threadId || resultThreadId(cached.result) || "").trim();
    const revision = revisionForThread(threadId);
    return Object.assign({}, cached, {
      version: PROJECTION_VERSION,
      result: normalizeResult(cached.result, {
        threadId,
        source: cached.partial ? "partial" : cached.dynamic ? "dynamic" : "cache",
        revision,
      }),
    });
  }

  function lookup(input = {}, optionsForGet = {}) {
    const lookedUp = typeof base.lookup === "function"
      ? base.lookup(input, optionsForGet)
      : { cached: base.get(input, optionsForGet), missReason: "" };
    const cached = lookedUp && lookedUp.cached;
    if (!cached || !cached.result) {
      return {
        cached: null,
        missReason: lookedUp && lookedUp.missReason || "entry-missing",
      };
    }
    const threadId = String(input.threadId || resultThreadId(cached.result) || "").trim();
    const revision = revisionForThread(threadId);
    return {
      cached: Object.assign({}, cached, {
        version: PROJECTION_VERSION,
        result: normalizeResult(cached.result, {
          threadId,
          source: cached.partial ? "partial" : cached.dynamic ? "dynamic" : "cache",
          revision,
        }),
      }),
      missReason: "",
    };
  }

  function activeOverlaySnapshot(input = {}) {
    const snapshot = typeof base.activeOverlaySnapshot === "function"
      ? base.activeOverlaySnapshot(input)
      : { found: false, reason: "snapshot-unavailable" };
    const threadId = String(input.threadId
      || snapshot && snapshot.threadId
      || "").trim();
    const revision = revisionForThread(threadId);
    if (!snapshot || snapshot.found !== true) {
      return Object.assign({}, snapshot || { found: false, reason: "snapshot-unavailable" }, {
        version: PROJECTION_VERSION,
        overlayRevision: revision,
      });
    }
    const normalizedOverlay = normalizeResult({
      thread: {
        id: threadId,
        turns: [snapshot.overlayTurn],
      },
    }, {
      threadId,
      source: "projection-live",
      revision,
    });
    const overlayTurn = normalizedOverlay
      && normalizedOverlay.thread
      && Array.isArray(normalizedOverlay.thread.turns)
      ? normalizedOverlay.thread.turns[0]
      : snapshot.overlayTurn;
    return Object.assign({}, snapshot, {
      version: PROJECTION_VERSION,
      overlayRevision: revision,
      overlayTurn,
    });
  }

  function applyNotification(method, params = {}) {
    const normalizedParams = normalizeNotificationParamsForProjectionV4(method, params);
    const changed = base.applyNotification(method, normalizedParams);
    if (changed) bumpRevision(notificationThreadId(normalizedParams));
    return changed;
  }

  function forget(threadId) {
    const id = String(threadId || "").trim();
    if (id) revisions.delete(id);
    return base.forget(threadId);
  }

  function compare(leftResult, rightResult) {
    return projectionDiffSummary(
      normalizeResult(leftResult, { source: "compare-left" }),
      normalizeResult(rightResult, { source: "compare-right" }),
    );
  }

  return {
    activeOverlaySnapshot,
    applyNotification,
    compare,
    forget,
    get,
    lookup,
    normalizeResult,
    seed,
  };
}

module.exports = {
  createThreadDetailProjectionV4Service,
};
