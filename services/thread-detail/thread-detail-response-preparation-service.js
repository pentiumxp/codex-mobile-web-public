"use strict";

function createThreadDetailResponsePreparationService(dependencies = {}) {
  const codex = dependencies.codex && typeof dependencies.codex.request === "function"
    ? dependencies.codex
    : { request: async () => { throw new Error("codex_request_unavailable"); } };
  const MAX_THREAD_TURNS = Math.max(1, Number(dependencies.maxThreadTurns || 10));
  const MAX_FULL_THREAD_TURNS = Math.max(MAX_THREAD_TURNS, Number(dependencies.maxFullThreadTurns || MAX_THREAD_TURNS));
  const READ_RPC_TIMEOUT_MS = Math.max(1, Number(dependencies.readRpcTimeoutMs || 12000));
  const THREAD_DETAIL_RPC_TIMEOUT_MS = Math.max(1, Number(dependencies.threadDetailRpcTimeoutMs || READ_RPC_TIMEOUT_MS));
  const responseBudgetOptions = typeof dependencies.responseBudgetOptions === "function"
    ? dependencies.responseBudgetOptions
    : () => ({});
  const compactThreadReadResult = typeof dependencies.compactThreadReadResult === "function" ? dependencies.compactThreadReadResult : (result) => result;
  const compactTurnsListResult = typeof dependencies.compactTurnsListResult === "function" ? dependencies.compactTurnsListResult : (result) => result;
  const compactThreadDetailResponseResult = typeof dependencies.compactThreadDetailResponseResult === "function" ? dependencies.compactThreadDetailResponseResult : (result) => result;
  const compactTurn = typeof dependencies.compactTurn === "function" ? dependencies.compactTurn : (turn) => turn;
  const enrichThreadItemTimestampsFromRollout = typeof dependencies.enrichThreadItemTimestampsFromRollout === "function" ? dependencies.enrichThreadItemTimestampsFromRollout : (thread) => thread;
  const sortTurnsChronologically = typeof dependencies.sortTurnsChronologically === "function" ? dependencies.sortTurnsChronologically : (turns) => turns || [];
  const isLiveTurn = typeof dependencies.isLiveTurn === "function" ? dependencies.isLiveTurn : () => false;
  const normalizeThreadSummaryLiveStatus = typeof dependencies.normalizeThreadSummaryLiveStatus === "function" ? dependencies.normalizeThreadSummaryLiveStatus : (thread) => thread;
  const annotateThreadRolloutStats = typeof dependencies.annotateThreadRolloutStats === "function" ? dependencies.annotateThreadRolloutStats : (thread) => thread;
  const publicRuntimeSettings = typeof dependencies.publicRuntimeSettings === "function" ? dependencies.publicRuntimeSettings : (settings) => settings || {};
  const rolloutPathForThread = typeof dependencies.rolloutPathForThread === "function" ? dependencies.rolloutPathForThread : () => "";
  const rolloutStatsForPath = typeof dependencies.rolloutStatsForPath === "function" ? dependencies.rolloutStatsForPath : () => null;
  const readRolloutTurnUsageSummaries = typeof dependencies.readRolloutTurnUsageSummaries === "function" ? dependencies.readRolloutTurnUsageSummaries : () => null;
  const attachTurnUsageSummaries = typeof dependencies.attachTurnUsageSummaries === "function" ? dependencies.attachTurnUsageSummaries : () => {};
  const workspaceContextStatsForCwd = typeof dependencies.workspaceContextStatsForCwd === "function" ? dependencies.workspaceContextStatsForCwd : () => ({});
  const backfillMissingRolloutCompletionTurnsForDetailResult = typeof dependencies.backfillMissingRolloutCompletionTurnsForDetailResult === "function" ? dependencies.backfillMissingRolloutCompletionTurnsForDetailResult : (result) => result;
  const appendRolloutUserInputAnchorsToDetailResult = typeof dependencies.appendRolloutUserInputAnchorsToDetailResult === "function" ? dependencies.appendRolloutUserInputAnchorsToDetailResult : (result) => result;
  const appendRolloutLatestCompletedAssistantItemsToDetailResult = typeof dependencies.appendRolloutLatestCompletedAssistantItemsToDetailResult === "function" ? dependencies.appendRolloutLatestCompletedAssistantItemsToDetailResult : (result) => result;
  const appendRolloutActiveAssistantItemsToDetailResult = typeof dependencies.appendRolloutActiveAssistantItemsToDetailResult === "function" ? dependencies.appendRolloutActiveAssistantItemsToDetailResult : (result) => result;
  const finalizeActiveAssistantProjectionDetailResult = typeof dependencies.finalizeActiveAssistantProjectionDetailResult === "function" ? dependencies.finalizeActiveAssistantProjectionDetailResult : (result) => result;
  const applyLocalActiveThreadStatusToResult = typeof dependencies.applyLocalActiveThreadStatusToResult === "function" ? dependencies.applyLocalActiveThreadStatusToResult : (result) => result;
  const prepareThreadTaskCardsToResult = typeof dependencies.prepareThreadTaskCardsToResult === "function" ? dependencies.prepareThreadTaskCardsToResult : async (result) => result;
  const finalizeThreadDetailProjectionResult = typeof dependencies.finalizeThreadDetailProjectionResult === "function" ? dependencies.finalizeThreadDetailProjectionResult : (result) => result;
  const applySessionIndexTitleToThread = typeof dependencies.applySessionIndexTitleToThread === "function" ? dependencies.applySessionIndexTitleToThread : (thread) => thread;
  const readSessionIndexEntries = typeof dependencies.readSessionIndexEntries === "function" ? dependencies.readSessionIndexEntries : () => new Map();
  const threadDisplaySummaryCache = dependencies.threadDisplaySummaryCache && typeof dependencies.threadDisplaySummaryCache.remember === "function"
    ? dependencies.threadDisplaySummaryCache
    : { remember: (thread) => thread };
  const mergeThreadRuntimeFromStateDb = typeof dependencies.mergeThreadRuntimeFromStateDb === "function" ? dependencies.mergeThreadRuntimeFromStateDb : (thread) => thread;
  const appendRolloutFinalReceiptsToThread = typeof dependencies.appendRolloutFinalReceiptsToThread === "function" ? dependencies.appendRolloutFinalReceiptsToThread : (thread) => thread;
  const attachPendingServerRequestsToResult = typeof dependencies.attachPendingServerRequestsToResult === "function" ? dependencies.attachPendingServerRequestsToResult : (result) => result;
  const attachThreadTaskCardsToResult = typeof dependencies.attachThreadTaskCardsToResult === "function" ? dependencies.attachThreadTaskCardsToResult : (result) => result;

  function isWindowOnlyTurnsListMode(mode) {
    return mode === "turns-list-initial" || mode === "turns-list-large";
  }

  function threadFromTurnsList(threadId, summary, turnsResult, options = {}) {
    const data = Array.isArray(turnsResult && turnsResult.data)
      ? turnsResult.data
      : Array.isArray(turnsResult && turnsResult.turns)
        ? turnsResult.turns
        : [];
    const source = Object.assign({ turns: data }, summary || {}, { id: threadId });
    const enriched = options.skipRolloutEnrichment === true
      ? source
      : enrichThreadItemTimestampsFromRollout(source);
    const turns = sortTurnsChronologically(enriched.turns).slice(-MAX_THREAD_TURNS);
    const latest = turns[turns.length - 1];
    const status = latest && isLiveTurn(latest) ? { type: "active" } : (summary && summary.status) || { type: "notLoaded" };
    return normalizeThreadSummaryLiveStatus(annotateThreadRolloutStats(Object.assign({
      id: threadId,
      name: null,
      preview: threadId,
      cwd: null,
      path: null,
      updatedAt: 0,
      status,
      turns,
      mobileReadMode: "turns-list",
    }, summary || {}, { id: threadId, status, turns, mobileReadMode: "turns-list" })));
  }

  function threadRolloutSizeBytes(thread) {
    const stats = rolloutStatsForPath(rolloutPathForThread(thread));
    if (stats && Number.isFinite(Number(stats.sizeBytes)) && Number(stats.sizeBytes) > 0) {
      return Number(stats.sizeBytes);
    }
    const size = Number(thread && thread.rolloutSizeBytes);
    return Number.isFinite(size) && size > 0 ? size : 0;
  }

  function fallbackThreadReadResult(threadId, summary, runtimeSettings, warning, mode = "summary-fallback") {
    const fallbackThread = annotateThreadRolloutStats(Object.assign({
      id: threadId,
      name: null,
      preview: threadId,
      cwd: null,
      path: null,
      updatedAt: Math.floor(Date.now() / 1000),
      status: { type: "notLoaded" },
      turns: [],
      mobileReadMode: mode,
    }, summary || {}, { id: threadId, turns: [], mobileReadMode: mode }));
    if (fallbackThread) fallbackThread.runtimeSettings = publicRuntimeSettings(runtimeSettings);
    return attachPendingServerRequestsToResult(attachThreadTaskCardsToResult({
      thread: fallbackThread,
      mobileReadWarning: warning || "",
    }));
  }

  function hasTurnUsageSummaryPayload(summaries) {
    return Boolean(summaries && (
      summaries.byTurnId instanceof Map && summaries.byTurnId.size > 0
      || Array.isArray(summaries.unscoped) && summaries.unscoped.length > 0
    ));
  }

  function cloneThreadForUsageDecoration(thread) {
    return Object.assign({}, thread, {
      turns: (Array.isArray(thread && thread.turns) ? thread.turns : []).map((turn) => {
        if (!turn || typeof turn !== "object") return turn;
        return Object.assign({}, turn, {
          items: Array.isArray(turn.items) ? turn.items.slice() : turn.items,
        });
      }),
    });
  }

  function attachRolloutUsageSummariesToDetailResult(result) {
    const thread = result && result.thread;
    if (!thread || !Array.isArray(thread.turns)) return result;
    const rolloutPath = rolloutPathForThread(thread);
    if (!rolloutPath) return result;
    const targetTurnIds = thread.turns
      .map((turn) => turn && (turn.id || turn.turnId || turn.turn_id))
      .filter(Boolean);
    if (!targetTurnIds.length) return result;
    const summaries = readRolloutTurnUsageSummaries(rolloutPath, { targetTurnIds });
    if (!hasTurnUsageSummaryPayload(summaries)) return result;
    const out = Object.assign({}, result, {
      thread: cloneThreadForUsageDecoration(thread),
    });
    attachTurnUsageSummaries(out.thread, summaries, {
      rolloutStats: rolloutStatsForPath(rolloutPath),
      workspaceContextStats: workspaceContextStatsForCwd(out.thread.cwd),
    });
    return out;
  }

  function markPrepareTiming(timings, name, startedAtMs) {
    if (!timings || typeof timings !== "object") return 0;
    const elapsed = Math.max(0, Date.now() - Number(startedAtMs || Date.now()));
    timings[name] = elapsed;
    return elapsed;
  }

  async function prepareThreadDetailResponseResult(result, details = {}) {
    const timings = {};
    details.prepareResponseTimings = timings;
    const turnsListWindow = details.turnsListWindow === true;
    let phaseStartedAtMs = Date.now();
    const completionBackfilled = turnsListWindow
      ? result
      : backfillMissingRolloutCompletionTurnsForDetailResult(result, details);
    markPrepareTiming(timings, "prepareCompletionBackfillMs", phaseStartedAtMs);
    phaseStartedAtMs = Date.now();
    const usageDecorated = attachRolloutUsageSummariesToDetailResult(completionBackfilled);
    markPrepareTiming(timings, "prepareUsageSummariesMs", phaseStartedAtMs);
    phaseStartedAtMs = Date.now();
    const inputAnchored = turnsListWindow
      ? usageDecorated
      : appendRolloutUserInputAnchorsToDetailResult(usageDecorated);
    markPrepareTiming(timings, "prepareUserInputAnchorsMs", phaseStartedAtMs);
    phaseStartedAtMs = Date.now();
    const latestCompletedAssistantDecorated = turnsListWindow
      ? inputAnchored
      : appendRolloutLatestCompletedAssistantItemsToDetailResult(inputAnchored);
    markPrepareTiming(timings, "prepareLatestCompletedAssistantMs", phaseStartedAtMs);
    phaseStartedAtMs = Date.now();
    const activeAssistantDecorated = turnsListWindow
      ? latestCompletedAssistantDecorated
      : appendRolloutActiveAssistantItemsToDetailResult(latestCompletedAssistantDecorated);
    markPrepareTiming(timings, "prepareActiveAssistantMs", phaseStartedAtMs);
    phaseStartedAtMs = Date.now();
    const detailResult = turnsListWindow
      ? activeAssistantDecorated
      : finalizeActiveAssistantProjectionDetailResult(activeAssistantDecorated);
    markPrepareTiming(timings, "prepareFinalizeActiveAssistantMs", phaseStartedAtMs);
    phaseStartedAtMs = Date.now();
    const prepared = applyLocalActiveThreadStatusToResult(
      await prepareThreadTaskCardsToResult(applyLocalActiveThreadStatusToResult(detailResult, details)),
      details,
    );
    markPrepareTiming(timings, "prepareTaskCardsMs", phaseStartedAtMs);
    phaseStartedAtMs = Date.now();
    const finalized = applyLocalActiveThreadStatusToResult(
      finalizeThreadDetailProjectionResult(prepared, details),
      details,
    );
    markPrepareTiming(timings, "prepareProjectionFinalizeMs", phaseStartedAtMs);
    phaseStartedAtMs = Date.now();
    const budgetOptions = Object.assign({}, responseBudgetOptions() || {}, {
      compactTurn,
      responseBudgetEvidence: details.responseBudgetEvidence || "",
    });
    const budgeted = applyLocalActiveThreadStatusToResult(
      compactThreadDetailResponseResult(finalized, budgetOptions),
      details,
    );
    markPrepareTiming(timings, "prepareResponseBudgetMs", phaseStartedAtMs);
    return budgeted;
  }

  async function turnsListThreadReadResult(threadId, summary, runtimeSettings, warning, mode = "turns-list", threadLog = null, responseBudgetEvidence = "") {
    const startedAtMs = Date.now();
    const turnsListWindow = isWindowOnlyTurnsListMode(mode);
    if (threadLog) {
      threadLog("turns_list_start", {
        limit: MAX_THREAD_TURNS,
        timeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS,
        fallbackFrom: mode,
      });
    }
    const rawTurnsResult = await codex.request("thread/turns/list", {
      threadId,
      limit: MAX_THREAD_TURNS,
      sortDirection: "desc",
    }, { timeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS, retry: false, resetOnTimeout: false });
    const turnsResult = turnsListWindow
      ? compactTurnsListResult(rawTurnsResult, { threadId, summary })
      : rawTurnsResult;
    const result = compactThreadReadResult({
      thread: threadFromTurnsList(threadId, summary, turnsResult, {
        skipRolloutEnrichment: turnsListWindow,
      }),
    }, {
      maxTurns: MAX_THREAD_TURNS,
      turnsListWindow,
    });
    if (result.thread) {
      result.thread.runtimeSettings = publicRuntimeSettings(runtimeSettings);
      result.thread.mobileReadMode = mode;
      result.thread.mobileReadWarning = warning || "";
      result.thread.mobileOlderTurnsCursor = turnsResult && turnsResult.nextCursor ? turnsResult.nextCursor : null;
      result.thread.mobileNewerTurnsCursor = turnsResult && turnsResult.backwardsCursor ? turnsResult.backwardsCursor : null;
    }
    result.mobileReadWarning = warning || "";
    if (threadLog) {
      threadLog("turns_list_ok", {
        durationMs: Date.now() - startedAtMs,
        returnedTurns: result.thread && Array.isArray(result.thread.turns) ? result.thread.turns.length : null,
        mode,
      });
    }
    return prepareThreadDetailResponseResult(result, {
      threadId,
      source: mode,
      responseBudgetEvidence,
      turnsListWindow,
    });
  }

  async function readRawThreadDetailForOrchestrator({ threadId, summary, runtimeSettings }) {
    const result = await codex.request("thread/read", { threadId, includeTurns: true }, {
      timeoutMs: READ_RPC_TIMEOUT_MS,
      retry: false,
      resetOnTimeout: false,
    });
    if (result && result.thread) {
      result.thread = applySessionIndexTitleToThread(result.thread, readSessionIndexEntries().get(threadId));
      threadDisplaySummaryCache.remember(result.thread);
      result.thread = mergeThreadRuntimeFromStateDb(result.thread, summary);
      result.thread.runtimeSettings = publicRuntimeSettings(runtimeSettings);
      result.thread.mobileReadMode = "thread-read-raw";
      result.thread.mobileProjectionVersion = "raw";
      result.thread.mobileProjection = {
        source: "thread-read",
        version: "raw",
        projectionDisabled: true,
      };
      result.thread.mobileRawThreadRead = true;
      appendRolloutFinalReceiptsToThread(result.thread);
    }
    return result;
  }

  async function readFullThreadDetailForOrchestrator({ threadId, summary, runtimeSettings }) {
    const result = compactThreadReadResult(await codex.request("thread/read", { threadId, includeTurns: true }, {
      timeoutMs: READ_RPC_TIMEOUT_MS,
      retry: false,
      resetOnTimeout: false,
    }), { maxTurns: MAX_FULL_THREAD_TURNS });
    if (result.thread) {
      result.thread = applySessionIndexTitleToThread(result.thread, readSessionIndexEntries().get(threadId));
      threadDisplaySummaryCache.remember(result.thread);
      result.thread = mergeThreadRuntimeFromStateDb(result.thread, summary);
      result.thread.runtimeSettings = publicRuntimeSettings(runtimeSettings);
      result.thread.mobileReadMode = "thread-read";
    }
    return result;
  }

  function fallbackThreadReadResultForOrchestrator({ threadId, summary, runtimeSettings, warning, mode }) {
    return finalizeThreadDetailProjectionResult(
      fallbackThreadReadResult(threadId, summary, runtimeSettings, warning, mode),
      { threadId, source: mode },
    );
  }

  return {
    threadFromTurnsList,
    threadRolloutSizeBytes,
    fallbackThreadReadResult,
    hasTurnUsageSummaryPayload,
    cloneThreadForUsageDecoration,
    attachRolloutUsageSummariesToDetailResult,
    prepareThreadDetailResponseResult,
    turnsListThreadReadResult,
    readRawThreadDetailForOrchestrator,
    readFullThreadDetailForOrchestrator,
    fallbackThreadReadResultForOrchestrator,
  };
}

module.exports = {
  createThreadDetailResponsePreparationService,
};
