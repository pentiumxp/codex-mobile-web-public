"use strict";

function defaultLogger() {
  return {
    error() {},
  };
}

function createRuntimeTurnEventPipelineService(options = {}) {
  const latestThreadIdByTurnId = options.latestThreadIdByTurnId instanceof Map
    ? options.latestThreadIdByTurnId
    : new Map();
  const runtimeContextCacheMax = Math.max(1, Math.trunc(Number(options.runtimeContextCacheMax || 200)) || 200);
  const processStartedAtMs = Math.max(0, Number(
    Object.prototype.hasOwnProperty.call(options, "processStartedAtMs") ? options.processStartedAtMs : Date.now(),
  ) || 0);
  const oldEventGraceMs = Math.max(0, Number(
    Object.prototype.hasOwnProperty.call(options, "oldEventGraceMs") ? options.oldEventGraceMs : 120000,
  ) || 0);
  const timestampToMs = typeof options.timestampToMs === "function" ? options.timestampToMs : () => 0;
  const now = typeof options.now === "function" ? options.now : Date.now;
  const setTimer = typeof options.setTimer === "function" ? options.setTimer : setTimeout;
  const logger = options.logger || defaultLogger();
  const getCodex = typeof options.getCodex === "function" ? options.getCodex : () => options.codex;

  function pushTurnId(params) {
    return String((params && params.turn && params.turn.id) || (params && params.turnId) || "");
  }

  function threadIdFromRolloutPath(value) {
    const text = String(value || "");
    const match = /rollout-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl/i.exec(text);
    return match ? match[1] : "";
  }

  function turnTimestampMs(params, field) {
    return timestampToMs((params && params.turn && params.turn[field]) || (params && params[field]));
  }

  function isOldPushTurnEvent(params, fields) {
    for (const field of fields) {
      const timestamp = turnTimestampMs(params, field);
      if (timestamp) return timestamp < processStartedAtMs - oldEventGraceMs;
    }
    return false;
  }

  function pushThreadId(params) {
    return String((params && params.threadId)
      || (params && params.conversationId)
      || (params && params.sessionId)
      || (params && params.thread_id)
      || (params && params.conversation_id)
      || (params && params.session_id)
      || (params && params.thread && params.thread.id)
      || (params && params.thread && params.thread.threadId)
      || (params && params.thread && params.thread.conversationId)
      || (params && params.thread && params.thread.sessionId)
      || (params && params.thread && params.thread.thread_id)
      || (params && params.thread && params.thread.conversation_id)
      || (params && params.thread && params.thread.session_id)
      || (params && params.turn && params.turn.threadId)
      || (params && params.turn && params.turn.conversationId)
      || (params && params.turn && params.turn.sessionId)
      || (params && params.turn && params.turn.thread_id)
      || (params && params.turn && params.turn.conversation_id)
      || (params && params.turn && params.turn.session_id)
      || (params && params.turn && params.turn.thread && params.turn.thread.id)
      || (params && params.turn && params.turn.thread && params.turn.thread.threadId)
      || (params && params.turn && params.turn.thread && params.turn.thread.conversationId)
      || (params && params.turn && params.turn.thread && params.turn.thread.sessionId)
      || (params && params.turn && params.turn.thread && params.turn.thread.thread_id)
      || (params && params.turn && params.turn.thread && params.turn.thread.conversation_id)
      || (params && params.turn && params.turn.thread && params.turn.thread.session_id)
      || threadIdFromRolloutPath(params && params.rolloutPath)
      || threadIdFromRolloutPath(params && params.rollout_path)
      || threadIdFromRolloutPath(params && params.thread && params.thread.rolloutPath)
      || threadIdFromRolloutPath(params && params.thread && params.thread.rollout_path)
      || threadIdFromRolloutPath(params && params.turn && params.turn.rolloutPath)
      || threadIdFromRolloutPath(params && params.turn && params.turn.rollout_path)
      || "");
  }

  function rememberThreadIdForTurnId(threadId, turnId) {
    const tid = String(turnId || "").trim();
    const sid = String(threadId || "").trim();
    if (!tid || !sid) return;
    latestThreadIdByTurnId.set(tid, sid);
    while (latestThreadIdByTurnId.size > runtimeContextCacheMax) {
      const firstKey = latestThreadIdByTurnId.keys().next().value;
      latestThreadIdByTurnId.delete(firstKey);
    }
  }

  function rememberThreadIdForTurnParams(method, params) {
    if (!params || typeof params !== "object") return;
    if (method !== "turn/started" && method !== "turn/completed" && method !== "item/started" && method !== "item/completed") return;
    const turnId = pushTurnId(params)
      || String(params.turn_id || params.itemTurnId || params.item_turn_id || params.item && (params.item.turnId || params.item.turn_id) || "").trim();
    const threadId = pushThreadId(params)
      || String(params.itemThreadId || params.item_thread_id || params.item && (params.item.threadId || params.item.thread_id) || "").trim();
    rememberThreadIdForTurnId(threadId, turnId);
  }

  function threadIdForTurnId(turnId) {
    return latestThreadIdByTurnId.get(String(turnId || "").trim()) || "";
  }

  function pushThreadSummary(threadId) {
    const id = String(threadId || "");
    if (!id) return null;
    const displayCache = options.threadDisplaySummaryCache;
    if (displayCache && typeof displayCache.read === "function") {
      const cached = displayCache.read(id);
      if (cached) return cached;
    }
    return (typeof options.readStateDbThread === "function" && options.readStateDbThread(id))
      || (typeof options.readStartedThread === "function" && options.readStartedThread(id))
      || null;
  }

  function maybeRecordTurnTokenUsage(method, params) {
    if (method !== "turn/completed") return;
    const turnId = pushTurnId(params);
    if (!turnId || isOldPushTurnEvent(params, ["completedAt", "updatedAt"])) return;
    const threadId = pushThreadId(params);
    if (!threadId) return;
    const usageSummary = typeof options.turnCompletionUsageSummary === "function"
      ? options.turnCompletionUsageSummary(threadId, turnId)
      : null;
    if (!usageSummary) return;
    const threadSummary = pushThreadSummary(threadId) || (typeof options.readStateDbThread === "function" && options.readStateDbThread(threadId)) || null;
    const tokenUsageStatsService = options.tokenUsageStatsService;
    if (!tokenUsageStatsService || typeof tokenUsageStatsService.recordTurnUsage !== "function") return;
    const result = tokenUsageStatsService.recordTurnUsage({
      threadId,
      turnId,
      cwd: threadSummary && threadSummary.cwd || "",
      workspaceCwds: typeof options.tokenUsageWorkspaceCwds === "function" ? options.tokenUsageWorkspaceCwds() : [],
      completedAtMs: turnTimestampMs(params, "completedAt") || turnTimestampMs(params, "updatedAt") || now(),
      model: threadSummary && threadSummary.model || usageSummary.model || "",
      usageSummary,
      source: "turn_completed",
    });
    if (result && !result.ok && !result.skipped) {
      const err = result.error;
      logger.error(`[token usage] record failed: ${err && err.message ? err.message : String(err)}`);
    }
  }

  function maybeAutoReplyThreadTaskCard(method, params) {
    if (method !== "turn/completed") return;
    const turnId = pushTurnId(params);
    if (!turnId || isOldPushTurnEvent(params, ["completedAt", "updatedAt"])) return;
    const threadId = pushThreadId(params);
    if (!threadId) return;
    const completedAtMs = turnTimestampMs(params, "completedAt") || turnTimestampMs(params, "updatedAt") || now();
    const completed = {
      threadId,
      turnId,
      completedAt: new Date(completedAtMs).toISOString(),
      finalReceiptText: typeof options.finalReceiptTextFromParams === "function"
        ? options.finalReceiptTextFromParams(params)
        : "",
    };
    const threadTaskCardService = options.threadTaskCardService;
    if (!threadTaskCardService) return;
    if (typeof threadTaskCardService.maybeAutoReplyCompletedTurn === "function") {
      threadTaskCardService.maybeAutoReplyCompletedTurn(completed).catch((err) => {
        logger.error(`[thread task card] auto-return failed: ${err.message || String(err)}`);
      });
    }
    if (typeof threadTaskCardService.maybeResumeInterruptedTaskCard === "function") {
      threadTaskCardService.maybeResumeInterruptedTaskCard(completed).catch((err) => {
        logger.error(`[thread task card] interruption resume failed: ${err.message || String(err)}`);
      });
    }
  }

  function maybeApplyQueuedThreadSideChat(method, params) {
    const service = options.threadSideChatOrchestrationService;
    if (service && typeof service.maybeApplyQueuedThreadSideChat === "function") {
      service.maybeApplyQueuedThreadSideChat(method, params);
    }
  }

  function maybeMaterializeThreadTaskCardDrafts(method, params) {
    if (method !== "turn/completed") return;
    const turnId = pushTurnId(params);
    if (!turnId || isOldPushTurnEvent(params, ["completedAt", "updatedAt"])) return;
    const threadId = pushThreadId(params);
    if (!threadId) return;
    const timer = setTimer(async () => {
      try {
        const summary = pushThreadSummary(threadId)
          || (typeof options.readStateDbThread === "function" && options.readStateDbThread(threadId))
          || (typeof options.readStartedThread === "function" && options.readStartedThread(threadId))
          || { id: threadId };
        const codex = getCodex();
        if (!codex || typeof codex.request !== "function") throw new Error("codex client unavailable");
        const turnsResult = await codex.request("thread/turns/list", {
          threadId,
          limit: Math.max(1, Math.trunc(Number(options.threadTaskCardDraftTurnLookback || 4)) || 4),
          sortDirection: "desc",
        }, { timeoutMs: options.threadDetailRpcTimeoutMs, retry: false, resetOnTimeout: false });
        const thread = typeof options.threadFromTurnsList === "function"
          ? options.threadFromTurnsList(threadId, summary, turnsResult)
          : Object.assign({}, summary, { id: threadId, turns: turnsResult && turnsResult.turns || [] });
        if (typeof options.materializeThreadTaskCardDraftsForThread === "function") {
          await options.materializeThreadTaskCardDraftsForThread(thread);
        }
      } catch (err) {
        const shortIdentifier = typeof options.shortIdentifier === "function" ? options.shortIdentifier : (value) => String(value || "");
        logger.error(`[thread task card] server completion materialization failed thread=${shortIdentifier(threadId)} turn=${shortIdentifier(turnId)}: ${err.message || String(err)}`);
      }
    }, 0);
    if (timer && typeof timer.unref === "function") timer.unref();
  }

  function maybeSendTurnCompletedPush(method, params) {
    const service = options.webPushRuntimeService;
    return service && typeof service.maybeSendTurnCompletedPush === "function"
      ? service.maybeSendTurnCompletedPush(method, params)
      : undefined;
  }

  return {
    isOldPushTurnEvent,
    maybeApplyQueuedThreadSideChat,
    maybeAutoReplyThreadTaskCard,
    maybeMaterializeThreadTaskCardDrafts,
    maybeRecordTurnTokenUsage,
    maybeSendTurnCompletedPush,
    pushThreadId,
    pushThreadSummary,
    pushTurnId,
    rememberThreadIdForTurnId,
    rememberThreadIdForTurnParams,
    threadIdForTurnId,
    threadIdFromRolloutPath,
    turnTimestampMs,
  };
}

module.exports = {
  createRuntimeTurnEventPipelineService,
};
