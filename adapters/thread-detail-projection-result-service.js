"use strict";

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
    return result;
  }

  return {
    prepareProjectedThreadReadResult,
  };
}

module.exports = {
  createThreadDetailProjectionResultService,
};
