"use strict";

const {
  createThreadDetailProjectionService,
  signatureHash,
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

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function normalizeStatus(value) {
  if (!value) return "";
  if (typeof value === "string") return value.toLowerCase();
  if (value && typeof value === "object" && value.type) return String(value.type).toLowerCase();
  return String(value).toLowerCase();
}

function isActiveLikeStatus(value) {
  const status = normalizeStatus(value).replace(/[_\s]+/g, "-");
  return /^(active|running|started|pending|queued|processing|inprogress|in-progress)$/i.test(status);
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

function turnId(turn) {
  return String(turn && (turn.id || turn.turnId || turn.turn_id) || "").trim();
}

function cloneResultForLookup(result, options = {}) {
  const omittedTurnId = String(options.omitActiveTurnId || "").trim();
  if (!omittedTurnId || !result || !result.thread || !Array.isArray(result.thread.turns)) {
    return cloneJson(result);
  }
  const cloned = cloneJson(result);
  cloned.thread.turns = cloned.thread.turns.filter((turn) => turnId(turn) !== omittedTurnId);
  return cloned;
}

function comparableSignatureFields(signature) {
  if (!signature || typeof signature !== "object") return null;
  return {
    policyVersion: String(signature.policyVersion || ""),
    threadId: String(signature.threadId || ""),
    rolloutPathHash: String(signature.rolloutPathHash || ""),
    rolloutSizeBytes: safeNumber(signature.rolloutSizeBytes),
    rolloutMtimeMs: safeNumber(signature.rolloutMtimeMs),
    maxTurns: safeNumber(signature.maxTurns),
  };
}

function comparableSignaturesMatch(left, right) {
  const leftFields = comparableSignatureFields(left);
  const rightFields = comparableSignatureFields(right);
  if (!leftFields || !rightFields) return false;
  return Object.keys(leftFields).every((key) => leftFields[key] === rightFields[key]);
}

function shouldUseActiveOverlayWindowCache(optionsForGet = {}) {
  return optionsForGet.activeOverlay === true && optionsForGet.allowPartial === true;
}

function shouldClearActiveOverlayWindowCache(method) {
  return method === "turn/started"
    || method === "turn/completed"
    || method === "thread/status/changed";
}

function createThreadDetailProjectionV4Service(options = {}) {
  const policyVersion = String(options.policyVersion || "state-relevant-receipt-v4");
  const maxTurns = Math.max(1, safeNumber(options.maxTurns) || 10);
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const base = createThreadDetailProjectionService(Object.assign({}, options, {
    policyVersion,
  }));
  const revisions = new Map();
  const activeOverlayCache = new Map();
  const activeOverlayWindowCache = new Map();

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

  function projectionReadMode(cached) {
    if (cached && cached.partial) return "projection-v4-partial";
    return cached && cached.dynamic ? "projection-v4-dynamic" : "projection-v4-cache";
  }

  function attachProjectionMetadata(result, cached, details = {}) {
    if (!result || !result.thread) return result;
    const thread = Object.assign({}, result.thread);
    thread.mobileReadMode = projectionReadMode(cached);
    thread.mobileProjection = Object.assign({}, thread.mobileProjection || {}, {
      source: cached && cached.partial ? "partial" : cached && cached.dynamic ? "dynamic" : "cache",
      version: PROJECTION_VERSION,
      partial: cached && cached.partial === true,
      partialKind: cached && cached.partialKind || "",
      revision: details.revision,
    });
    return Object.assign({}, result, { thread });
  }

  function activeOverlayCacheEntryMatches(entry, details = {}) {
    return entry
      && entry.activeTurnId === String(details.activeTurnId || "")
      && entry.revision === safeNumber(details.revision)
      && entry.updatedAtMs === safeNumber(details.updatedAtMs)
      && entry.cachedAtMs === safeNumber(details.cachedAtMs);
  }

  function clearActiveOverlayCache(threadId) {
    const id = String(threadId || "").trim();
    if (id) activeOverlayCache.delete(id);
  }

  function clearActiveOverlayWindowCache(threadId) {
    const id = String(threadId || "").trim();
    if (id) activeOverlayWindowCache.delete(id);
  }

  function projectionSignatureForInput(input = {}) {
    return typeof base.projectionSignature === "function"
      ? base.projectionSignature(Object.assign({}, input, { policyVersion, maxTurns }))
      : null;
  }

  function activeOverlayWindowCacheEntry(input = {}, optionsForGet = {}) {
    if (!shouldUseActiveOverlayWindowCache(optionsForGet)) return null;
    const threadId = String(input.threadId || "").trim();
    if (!threadId) return null;
    const entry = activeOverlayWindowCache.get(threadId);
    if (!entry || !entry.result) return null;
    const signature = projectionSignatureForInput(input);
    if (!signature) return null;
    const exactHash = signatureHash(signature);
    if (entry.signatureHash !== exactHash
      && !(isActiveLikeStatus(input.summaryStatus) && comparableSignaturesMatch(entry.signature, signature))) {
      return null;
    }
    return entry;
  }

  function lookupActiveOverlayWindow(input = {}, optionsForGet = {}) {
    const entry = activeOverlayWindowCacheEntry(input, optionsForGet);
    if (!entry) return null;
    const threadId = String(input.threadId || resultThreadId(entry.result) || "").trim();
    const revision = safeNumber(entry.revision) || revisionForThread(threadId);
    const result = cloneResultForLookup(entry.result, optionsForGet);
    const cached = {
      cachedAtMs: entry.cachedAtMs,
      updatedAtMs: entry.updatedAtMs,
      dynamic: false,
      partial: true,
      partialKind: entry.partialKind || "turns-list-active-overlay-window",
      result,
    };
    return {
      cached: Object.assign({}, cached, {
        version: PROJECTION_VERSION,
        result: optionsForGet.skipNormalizeResult === true
          ? attachProjectionMetadata(result, cached, { revision })
          : normalizeResult(result, { threadId, source: "partial", revision }),
      }),
      missReason: "",
    };
  }

  function seed(input = {}, result, optionsForSeed = {}) {
    const threadId = String(input.threadId || resultThreadId(result) || "").trim();
    const revision = revisionForThread(threadId) + 1;
    const normalized = normalizeResult(result, {
      threadId,
      source: "seed",
      revision,
    });
    if (optionsForSeed.partial === true
      && optionsForSeed.partialKind === "turns-list-active-overlay-window") {
      const signature = projectionSignatureForInput(input);
      if (!threadId || !signature || !normalized || !normalized.thread) return null;
      const cachedAtMs = safeNumber(optionsForSeed.cachedAtMs) || now();
      activeOverlayWindowCache.set(threadId, {
        threadId,
        signature,
        signatureHash: signatureHash(signature),
        cachedAtMs,
        updatedAtMs: safeNumber(optionsForSeed.projectionTimestampMs) || cachedAtMs,
        revision: safeNumber(optionsForSeed.projectionRevision) || revisionForThread(threadId),
        partialKind: "turns-list-active-overlay-window",
        result: cloneJson(normalized),
      });
      return {
        cachedAtMs,
        dynamic: false,
        partial: true,
        partialKind: "turns-list-active-overlay-window",
        signatureHash: signatureHash(signature),
        version: PROJECTION_VERSION,
        revision: revisionForThread(threadId),
      };
    }
    const meta = base.seed(input, normalized, optionsForSeed);
    if (meta && meta.skipped) {
      return Object.assign({}, meta, {
        version: PROJECTION_VERSION,
        revision: revisionForThread(threadId),
      });
    }
    if (meta) {
      revisions.set(threadId, revision);
      clearActiveOverlayCache(threadId);
    }
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
    const activeOverlayWindow = lookupActiveOverlayWindow(input, optionsForGet);
    if (activeOverlayWindow) return activeOverlayWindow;
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
    if (optionsForGet.skipNormalizeResult === true) {
      return {
        cached: Object.assign({}, cached, {
          version: PROJECTION_VERSION,
          result: attachProjectionMetadata(cached.result, cached, { revision }),
        }),
        missReason: "",
      };
    }
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
      ? base.activeOverlaySnapshot(Object.assign({}, input, { cloneOverlayTurn: false }))
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
    const activeTurnId = String(snapshot.activeTurnId || input.activeTurnId || input.turnId || "").trim();
    const updatedAtMs = safeNumber(snapshot.updatedAtMs);
    const cachedAtMs = safeNumber(snapshot.cachedAtMs);
    if (input.normalizeOverlayTurn === false) {
      return Object.assign({}, snapshot, {
        version: PROJECTION_VERSION,
        overlayRevision: revision,
        overlayCacheHit: false,
        overlayNormalized: false,
        overlayTurn: input.cloneOverlayTurn === false
          ? snapshot.overlayTurn
          : cloneJson(snapshot.overlayTurn),
      });
    }
    const cacheEntry = activeOverlayCache.get(threadId);
    if (activeOverlayCacheEntryMatches(cacheEntry, {
      activeTurnId,
      revision,
      updatedAtMs,
      cachedAtMs,
    })) {
      const overlayTurn = input.cloneOverlayTurn === false
        ? cacheEntry.overlayTurn
        : cloneJson(cacheEntry.overlayTurn);
      return Object.assign({}, snapshot, {
        version: PROJECTION_VERSION,
        overlayRevision: revision,
        overlayCacheHit: true,
        overlayTurn,
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
      : cloneJson(snapshot.overlayTurn);
    activeOverlayCache.set(threadId, {
      activeTurnId,
      revision,
      updatedAtMs,
      cachedAtMs,
      overlayTurn: cloneJson(overlayTurn),
    });
    return Object.assign({}, snapshot, {
      version: PROJECTION_VERSION,
      overlayRevision: revision,
      overlayCacheHit: false,
      overlayTurn,
    });
  }

  function applyNotification(method, params = {}) {
    const normalizedParams = normalizeNotificationParamsForProjectionV4(method, params);
    const changed = base.applyNotification(method, normalizedParams);
    if (changed) {
      const threadId = notificationThreadId(normalizedParams);
      bumpRevision(threadId);
      clearActiveOverlayCache(threadId);
      if (shouldClearActiveOverlayWindowCache(method)) clearActiveOverlayWindowCache(threadId);
    }
    return changed;
  }

  function forget(threadId) {
    const id = String(threadId || "").trim();
    if (id) {
      revisions.delete(id);
      clearActiveOverlayCache(id);
      clearActiveOverlayWindowCache(id);
    }
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
