"use strict";

const SUMMARY_TURN_STALENESS_GRACE_MS = 2000;

function timestampToMs(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value > 1_000_000_000_000 ? Math.trunc(value) : Math.trunc(value * 1000);
  }
  if (/^\d+(?:\.\d+)?$/.test(String(value))) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric > 1_000_000_000_000 ? Math.trunc(numeric) : Math.trunc(numeric * 1000);
    }
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function summaryUpdatedAtMs(summary) {
  return timestampToMs(summary && (
    summary.updatedAt
    || summary.updated_at
    || summary.updatedAtMs
    || summary.updated_at_ms
  ));
}

function turnActivityAtMs(turn) {
  return timestampToMs(turn && (
    turn.completedAt
    || turn.completedAtMs
    || turn.completed_at
    || turn.completed_at_ms
    || turn.updatedAt
    || turn.updatedAtMs
    || turn.updated_at
    || turn.updated_at_ms
    || turn.startedAt
    || turn.startedAtMs
    || turn.started_at
    || turn.started_at_ms
    || turn.createdAt
    || turn.createdAtMs
    || turn.created_at
    || turn.created_at_ms
  ));
}

function latestProjectedTurnActivityAtMs(thread) {
  const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
  return turns.reduce((max, turn) => Math.max(max, turnActivityAtMs(turn)), 0);
}

function createThreadDetailProjectionResultService(options = {}) {
  const maxTurns = Math.max(1, Number(options.maxTurns || 1));
  const compactThreadReadResult = typeof options.compactThreadReadResult === "function"
    ? options.compactThreadReadResult
    : (result) => result;
  const mergeThreadDisplaySummary = typeof options.mergeThreadDisplaySummary === "function"
    ? options.mergeThreadDisplaySummary
    : (thread) => thread;
  const applySessionIndexTitleToThread = typeof options.applySessionIndexTitleToThread === "function"
    ? options.applySessionIndexTitleToThread
    : (thread) => thread;
  const readSessionIndexEntries = typeof options.readSessionIndexEntries === "function"
    ? options.readSessionIndexEntries
    : () => new Map();
  const mergeThreadRuntimeFromStateDb = typeof options.mergeThreadRuntimeFromStateDb === "function"
    ? options.mergeThreadRuntimeFromStateDb
    : (thread) => thread;
  const normalizeThreadSummaryLiveStatus = typeof options.normalizeThreadSummaryLiveStatus === "function"
    ? options.normalizeThreadSummaryLiveStatus
    : (thread) => thread;
  const publicRuntimeSettings = typeof options.publicRuntimeSettings === "function"
    ? options.publicRuntimeSettings
    : () => ({});
  const now = typeof options.now === "function" ? options.now : Date.now;

  function sessionIndexEntry(threadId) {
    const entries = readSessionIndexEntries();
    return entries && typeof entries.get === "function" ? entries.get(threadId) : undefined;
  }

  function mobileReadMode(cached, projectionVersion) {
    const v4 = projectionVersion === "v4";
    if (cached && cached.partial) return v4 ? "projection-v4-partial" : "projection-partial";
    return cached && cached.dynamic
      ? (v4 ? "projection-v4-dynamic" : "projection-dynamic")
      : (v4 ? "projection-v4-cache" : "projection-cache");
  }

  function summaryLocalActiveTurnId(summary) {
    return String(summary && (
      summary.activeTurnId
      || summary.active_turn_id
      || summary.mobileLocalActiveStatus && summary.mobileLocalActiveStatus.turnId
      || summary.mobileLocalActiveStatus && summary.mobileLocalActiveStatus.turn_id
    ) || "").trim();
  }

  function projectedThreadHasTurn(thread, turnId) {
    const id = String(turnId || "").trim();
    if (!id || !thread || !Array.isArray(thread.turns)) return !id;
    return thread.turns.some((turn) => String(turn && (turn.id || turn.turnId || turn.turn_id) || "").trim() === id);
  }

  function projectedThreadSatisfiesLocalActiveSummary(cached, summary) {
    const localActiveTurnId = summaryLocalActiveTurnId(summary);
    if (!localActiveTurnId) return true;
    return projectedThreadHasTurn(cached && cached.result && cached.result.thread, localActiveTurnId);
  }

  function projectedThreadCoversSummaryUpdatedAt(cached, summary) {
    const updatedAtMs = summaryUpdatedAtMs(summary);
    if (!updatedAtMs) return true;
    const latestTurnAtMs = latestProjectedTurnActivityAtMs(cached && cached.result && cached.result.thread);
    if (!latestTurnAtMs) return false;
    return updatedAtMs <= latestTurnAtMs + SUMMARY_TURN_STALENESS_GRACE_MS;
  }

  function isResponseReadyV4Projection(cached, result) {
    if (!cached || String(cached.version || "") !== "v4") return false;
    const thread = result && result.thread;
    if (!thread || thread.mobileProjectionVersion !== "v4") return false;
    const turns = Array.isArray(thread.turns) ? thread.turns : [];
    if (turns.length > maxTurns) return false;
    const threadVisibleItemKeys = [];
    for (const turn of turns) {
      if (!turn || turn.mobileProjectionVersion !== "v4" || !turn.mobileVisibleKey) return false;
      const items = Array.isArray(turn.items) ? turn.items : [];
      const turnVisibleItemKeys = [];
      const seenKeys = new Set();
      for (const item of items) {
        if (!item || item.mobileProjectionVersion !== "v4") return false;
        const key = String(item.mobileVisibleKey || "");
        if (!key || seenKeys.has(key)) return false;
        seenKeys.add(key);
        turnVisibleItemKeys.push(key);
        threadVisibleItemKeys.push(key);
      }
      const existingTurnKeys = Array.isArray(turn.mobileVisibleItemKeys) ? turn.mobileVisibleItemKeys : [];
      if (existingTurnKeys.length !== turnVisibleItemKeys.length) return false;
      for (let index = 0; index < turnVisibleItemKeys.length; index += 1) {
        if (existingTurnKeys[index] !== turnVisibleItemKeys[index]) return false;
      }
    }
    const existingThreadKeys = Array.isArray(thread.mobileVisibleItemKeys) ? thread.mobileVisibleItemKeys : [];
    if (existingThreadKeys.length !== threadVisibleItemKeys.length) return false;
    for (let index = 0; index < threadVisibleItemKeys.length; index += 1) {
      if (existingThreadKeys[index] !== threadVisibleItemKeys[index]) return false;
    }
    return true;
  }

  function prepareProjectedThreadReadResult(cached, summary, runtimeSettings, options = {}) {
    if (!cached || !cached.result || !cached.result.thread) return null;
    if (options.activeOverlay !== true && !projectedThreadSatisfiesLocalActiveSummary(cached, summary)) return null;
    if (options.activeOverlay !== true && !projectedThreadCoversSummaryUpdatedAt(cached, summary)) return null;
    const mergedResult = Object.assign({}, cached.result, {
      thread: mergeThreadDisplaySummary(cached.result.thread, summary) || cached.result.thread,
    });
    const result = isResponseReadyV4Projection(cached, mergedResult)
      ? mergedResult
      : compactThreadReadResult(mergedResult, { maxTurns });
    if (!result || !result.thread) return null;
    result.thread = applySessionIndexTitleToThread(result.thread, sessionIndexEntry(result.thread.id));
    result.thread = mergeThreadRuntimeFromStateDb(result.thread, summary);
    result.thread = normalizeThreadSummaryLiveStatus(result.thread);
    result.thread.runtimeSettings = publicRuntimeSettings(runtimeSettings);
    const projectionVersion = String(cached.version || result.thread.mobileProjectionVersion || "");
    result.thread.mobileReadMode = mobileReadMode(cached, projectionVersion);
    result.thread.mobileProjection = {
      ...(result.thread.mobileProjection || {}),
      source: cached.partial ? "partial" : cached.dynamic ? "dynamic" : "cache",
      version: projectionVersion || result.thread.mobileProjectionVersion || "",
      partial: cached.partial === true,
      partialKind: cached.partialKind || "",
      cachedAtMs: cached.cachedAtMs || null,
      updatedAtMs: cached.updatedAtMs || cached.cachedAtMs || null,
      ageMs: cached.updatedAtMs ? Math.max(0, now() - cached.updatedAtMs) : null,
    };
    if (cached.stalePartial === true) {
      result.thread.mobileProjection.stalePartial = true;
      result.thread.mobileProjection.staleReason = cached.staleReason || "";
    }
    return result;
  }

  return {
    prepareProjectedThreadReadResult,
  };
}

module.exports = {
  createThreadDetailProjectionResultService,
};
