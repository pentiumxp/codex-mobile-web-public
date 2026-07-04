"use strict";

function defaultThreadTaskCardCounts() {
  return {
    pendingTotal: 0,
    pendingIncoming: 0,
    pendingOutgoing: 0,
  };
}

function stableTextHash(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function createThreadDetailStateBridgeService(dependencies = {}) {
  const threadTaskCardService = dependencies.threadTaskCardService || {};
  const threadGoalService = dependencies.threadGoalService || {};
  const serverRequestMethods = dependencies.serverRequestMethods instanceof Set
    ? dependencies.serverRequestMethods
    : new Set();

  function threadSummaryStateService() {
    if (typeof dependencies.threadSummaryStateService === "function") {
      return dependencies.threadSummaryStateService() || null;
    }
    return dependencies.threadSummaryStateService || null;
  }

  function codexClient() {
    if (typeof dependencies.codexClient === "function") return dependencies.codexClient() || null;
    return dependencies.codexClient || null;
  }

  function callThreadSummaryState(method, args, fallback) {
    const service = threadSummaryStateService();
    if (service && typeof service[method] === "function") return service[method](...args);
    return typeof fallback === "function" ? fallback(...args) : fallback;
  }

  function statusTurnId(status) {
    if (!status || typeof status !== "object") return "";
    return callThreadSummaryState("statusTurnId", [status], () => (
      String(status.turnId || status.turn_id || status.activeTurnId || status.active_turn_id || "").trim()
    ));
  }

  function rowToFallbackThread(row) {
    return callThreadSummaryState("rowToFallbackThread", [row], () => null);
  }

  function sqlString(value) {
    return callThreadSummaryState("sqlString", [value], () => `'${String(value || "").replace(/'/g, "''")}'`);
  }

  function pruneLocalActiveThreadStatuses(now = Date.now()) {
    return callThreadSummaryState("pruneLocalActiveThreadStatuses", [now], undefined);
  }

  function rolloutHasTerminalEntryAtOrAfter(rolloutPath, timestampMs = 0) {
    return callThreadSummaryState("rolloutHasTerminalEntryAtOrAfter", [rolloutPath, timestampMs], false);
  }

  function localActiveSupersedingRolloutEvidence(rolloutPath, entry, nowMs = Date.now()) {
    return callThreadSummaryState("localActiveSupersedingRolloutEvidence", [rolloutPath, entry, nowMs], null);
  }

  function localActiveSummaryRolloutPath(threadId, summary = null) {
    return callThreadSummaryState("localActiveSummaryRolloutPath", [threadId, summary], "");
  }

  function readLocalActiveThreadStatus(threadId, summary = null, nowMs = Date.now()) {
    return callThreadSummaryState("readLocalActiveThreadStatus", [threadId, summary, nowMs], null);
  }

  function rememberLocalActiveThreadStatus(threadId, turnId = "", meta = {}) {
    return callThreadSummaryState("rememberLocalActiveThreadStatus", [threadId, turnId, meta], null);
  }

  function clearLocalActiveThreadStatus(threadId) {
    return callThreadSummaryState("clearLocalActiveThreadStatus", [threadId], false);
  }

  function applyLocalActiveThreadStatusToSummary(thread, options = {}) {
    return callThreadSummaryState("applyLocalActiveThreadStatusToSummary", [thread, options], () => thread);
  }

  function applyLocalActiveThreadStatusToResult(result, options = {}) {
    return callThreadSummaryState("applyLocalActiveThreadStatusToResult", [result, options], () => result);
  }

  function normalizeThreadSummaryLiveStatus(thread, options = {}) {
    return callThreadSummaryState("normalizeThreadSummaryLiveStatus", [thread, options], () => thread);
  }

  function readStateDbThread(threadId) {
    return callThreadSummaryState("readStateDbThread", [threadId], null);
  }

  function isThreadListLiveStatus(status) {
    return callThreadSummaryState("isThreadListLiveStatus", [status], false);
  }

  function isThreadListRestStatus(status) {
    return callThreadSummaryState("isThreadListRestStatus", [status], false);
  }

  function isThreadListUnknownStatus(status) {
    return callThreadSummaryState("isThreadListUnknownStatus", [status], false);
  }

  function shouldReplaceThreadDisplayStatus(baseStatus, displayStatus, baseUpdatedAtMs, displayUpdatedAtMs) {
    return callThreadSummaryState("shouldReplaceThreadDisplayStatus", [
      baseStatus,
      displayStatus,
      baseUpdatedAtMs,
      displayUpdatedAtMs,
    ], true);
  }

  function clearThreadSummaryActiveMarkers(thread) {
    return callThreadSummaryState("clearThreadSummaryActiveMarkers", [thread], () => thread);
  }

  function mergeThreadWithCachedDisplaySummary(thread, options = {}) {
    return callThreadSummaryState("mergeThreadWithCachedDisplaySummary", [thread, options], () => thread);
  }

  function mergeThreadDisplaySummary(base, display, options = {}) {
    return callThreadSummaryState("mergeThreadDisplaySummary", [base, display, options], () => display || base || null);
  }

  function mergeThreadRuntimeFromStateDb(thread, summary = null) {
    return callThreadSummaryState("mergeThreadRuntimeFromStateDb", [thread, summary], () => thread);
  }

  function detailReadThreadSummaryForFallbackCache(body = {}) {
    return callThreadSummaryState("detailReadThreadSummaryForFallbackCache", [body], null);
  }

  function syncThreadDetailReadResultToThreadListFallbackCache(payload = {}) {
    return callThreadSummaryState("syncThreadDetailReadResultToThreadListFallbackCache", [payload], {
      synced: false,
      reason: "thread-summary-state-unavailable",
    });
  }

  function attachThreadTaskCardsToThread(thread) {
    if (!thread || typeof thread !== "object" || !thread.id) return thread;
    const summary = typeof threadTaskCardService.summaryForThread === "function"
      ? threadTaskCardService.summaryForThread(thread.id)
      : null;
    const counts = summary && summary.counts
      ? summary.counts
      : typeof threadTaskCardService.pendingCountsForThread === "function"
        ? threadTaskCardService.pendingCountsForThread(thread.id)
        : defaultThreadTaskCardCounts();
    thread.threadTaskCards = summary && Array.isArray(summary.cards)
      ? summary.cards
      : typeof threadTaskCardService.listForThread === "function"
        ? threadTaskCardService.listForThread(thread.id)
        : [];
    thread.pendingTaskCardCount = Number(counts.pendingTotal || 0);
    thread.pendingIncomingTaskCardCount = Number(counts.pendingIncoming || 0);
    thread.pendingOutgoingTaskCardCount = Number(counts.pendingOutgoing || 0);
    return thread;
  }

  function attachThreadGoalToThread(thread) {
    if (threadGoalService && typeof threadGoalService.attachGoalToThread === "function") {
      return threadGoalService.attachGoalToThread(thread);
    }
    return thread;
  }

  function attachThreadTaskCardsToResult(result) {
    if (!result || typeof result !== "object" || !result.thread) return result;
    attachThreadGoalToThread(result.thread);
    attachThreadTaskCardsToThread(result.thread);
    return result;
  }

  function shouldExposeServerRequestInThread(request) {
    return Boolean(request && serverRequestMethods.has(request.method));
  }

  function pendingServerRequestsForThread(client, threadId) {
    const id = String(threadId || "").trim();
    if (!client || typeof client.pendingServerRequests !== "function") return [];
    return client.pendingServerRequests()
      .filter((request) => {
        if (!request || !shouldExposeServerRequestInThread(request)) return false;
        const params = request.params || {};
        const requestThreadId = String(params.threadId || params.conversationId || "").trim();
        return requestThreadId ? requestThreadId === id : Boolean(id);
      });
  }

  function attachPendingServerRequestsToResult(result, client = codexClient()) {
    if (!result || typeof result !== "object" || !result.thread) return result;
    const pendingServerRequests = pendingServerRequestsForThread(client, result.thread.id || result.thread.threadId || "");
    result.thread.pendingServerRequests = pendingServerRequests;
    return result;
  }

  return {
    attachPendingServerRequestsToResult,
    attachThreadGoalToThread,
    attachThreadTaskCardsToResult,
    attachThreadTaskCardsToThread,
    clearLocalActiveThreadStatus,
    clearThreadSummaryActiveMarkers,
    detailReadThreadSummaryForFallbackCache,
    isThreadListLiveStatus,
    isThreadListRestStatus,
    isThreadListUnknownStatus,
    localActiveSummaryRolloutPath,
    localActiveSupersedingRolloutEvidence,
    mergeThreadDisplaySummary,
    mergeThreadRuntimeFromStateDb,
    mergeThreadWithCachedDisplaySummary,
    normalizeThreadSummaryLiveStatus,
    pendingServerRequestsForThread,
    pruneLocalActiveThreadStatuses,
    readLocalActiveThreadStatus,
    readStateDbThread,
    rememberLocalActiveThreadStatus,
    rolloutHasTerminalEntryAtOrAfter,
    rowToFallbackThread,
    shouldExposeServerRequestInThread,
    shouldReplaceThreadDisplayStatus,
    sqlString,
    stableTextHash,
    statusTurnId,
    syncThreadDetailReadResultToThreadListFallbackCache,
    applyLocalActiveThreadStatusToResult,
    applyLocalActiveThreadStatusToSummary,
  };
}

module.exports = {
  createThreadDetailStateBridgeService,
  stableTextHash,
};
