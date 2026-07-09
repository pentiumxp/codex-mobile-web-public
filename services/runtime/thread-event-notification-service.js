"use strict";

function createThreadEventNotificationService(deps = {}) {
  const clients = deps.clients || new Map();
  const clientHeartbeats = deps.clientHeartbeats || new WeakMap();
  const MAX_DELTA_CHARS = Number(deps.maxDeltaChars || 12000);
  const logger = deps.logger || console;
  const getCodex = typeof deps.getCodex === "function" ? deps.getCodex : () => deps.codex;
  const getProjectionService = typeof deps.getThreadDetailProjectionService === "function"
    ? deps.getThreadDetailProjectionService
    : () => deps.threadDetailProjectionService;
  const threadDetailProjectionService = {
    applyNotification(method, params) {
      const service = getProjectionService();
      if (service && typeof service.applyNotification === "function") {
        return service.applyNotification(method, params);
      }
      return null;
    },
  };
  const codex = {
    request(...args) {
      const client = getCodex();
      if (!client || typeof client.request !== "function") throw new Error("codex client unavailable");
      return client.request(...args);
    },
  };
  const {
    applyThreadStatusPayloadToThreadListFallbackCache = () => {},
    clearLocalActiveThreadStatus = () => {},
    compactItem = (item) => item,
    compactRateLimits = (value) => value,
    compactTurn = (turn) => turn,
    logThreadDetail = () => {},
    recordRateLimits = () => {},
    rememberLocalActiveThreadStatus = () => {},
    threadDetailActiveWindowPrewarmService,
    threadDetailFirstPaintPrewarmService,
    timestampToMs = () => 0,
    truncateMiddle = (value) => value,
    truncateTail = (value) => value,
    turnStartResultTurnId = () => "",
  } = deps;
  function compactNotification(payload) {
    if (!payload || payload.type !== "notification" || !payload.params) return payload;
    if (String(payload.method || "").startsWith("turn/diff/")) {
      return null;
    }
    if (payload.method === "item/commandExecution/outputDelta" || payload.method === "item/fileChange/outputDelta") {
      return null;
    }
    if (payload.method === "item/reasoning/textDelta" || payload.method === "item/reasoning/summaryTextDelta") {
      return null;
    }
    const out = {
      type: payload.type,
      method: payload.method,
      params: Object.assign({}, payload.params),
    };
    const threadId = notificationThreadId(payload);
    if (out.params.item) {
      out.params.item = compactItem(out.params.item, {
        threadId,
        contextCompactionPending: payload.method === "item/started"
          ? true
          : payload.method === "item/completed"
            ? false
            : undefined,
      });
    }
    if (out.params.turn) out.params.turn = compactTurn(out.params.turn, { allowLiveOperation: true, threadId });
    if (payload.method === "account/rateLimits/updated" && out.params.rateLimits) {
      out.params.rateLimits = compactRateLimits(out.params.rateLimits);
    }
    if (payload.method === "item/commandExecution/outputDelta" && typeof out.params.delta === "string") {
      out.params.originalDeltaChars = out.params.delta.length;
      out.params.deltaTruncated = out.params.delta.length > MAX_DELTA_CHARS;
      out.params.delta = truncateTail(out.params.delta, MAX_DELTA_CHARS, "command output delta");
    }
    if ((payload.method === "item/agentMessage/delta" || payload.method === "item/reasoning/textDelta" || payload.method === "item/reasoning/summaryTextDelta") && typeof out.params.delta === "string") {
      out.params.originalDeltaChars = out.params.delta.length;
      out.params.deltaTruncated = out.params.delta.length > MAX_DELTA_CHARS;
      out.params.delta = truncateMiddle(out.params.delta, MAX_DELTA_CHARS, "text delta");
    }
    return out;
  }

  function broadcast(payload) {
    if (payload && payload.type === "notification") {
      updateLocalActiveThreadStatusFromNotification(payload);
      const statusPayload = threadStatusChangedPayloadFromTurnNotification(payload);
      if (statusPayload) {
        applyThreadStatusPayloadToThreadListFallbackCache(statusPayload);
        broadcast(statusPayload);
      }
      try {
        threadDetailProjectionService.applyNotification(payload.method, payload.params || {});
      } catch (err) {
        console.error(`[thread projection] notification update failed: ${err.message || String(err)}`);
      }
      scheduleActiveWindowPrewarmFromNotification(payload);
    }
    const compacted = compactNotification(payload);
    if (!compacted) return;
    const body = `data: ${JSON.stringify(compacted)}\n\n`;
    for (const [res, client] of [...clients.entries()]) {
      if (!shouldSendEventToClient(compacted, client)) continue;
      try {
        if (res.destroyed || res.writableEnded || !res.write(body)) {
          removeEventClient(res);
        }
      } catch (_) {
        removeEventClient(res);
      }
    }
  }

  function notificationThreadId(payload) {
    if (!payload || payload.type !== "notification" || !payload.params) return "";
    return String(payload.params.threadId || payload.params.conversationId || "");
  }

  function threadSummaryLooksActive(summary) {
    if (!summary || typeof summary !== "object") return false;
    if (summary.activeTurnId || summary.active_turn_id) return true;
    const local = summary.mobileLocalActiveStatus && typeof summary.mobileLocalActiveStatus === "object"
      ? summary.mobileLocalActiveStatus
      : null;
    if (local && (local.turnId || local.turn_id)) return true;
    const statusValue = summary.status && typeof summary.status === "object"
      ? summary.status.type
      : summary.status || summary.mobileStatus || local && local.status;
    return /^(active|running|started|pending|queued|processing|inprogress|in_progress|in-progress)$/i
      .test(String(statusValue || "").trim());
  }

  function scheduleActiveWindowPrewarm(threadId, summary = null, reason = "", options = {}) {
    const id = String(threadId || summary && (summary.id || summary.threadId || summary.thread_id) || "").trim();
    if (!id) return { scheduled: false, reason: "missing-thread-id" };
    return threadDetailActiveWindowPrewarmService.schedule({
      codex,
      threadId: id,
      summary,
      reason,
      delayMs: options.delayMs,
      bypassMinInterval: options.bypassMinInterval === true,
      preemptPending: options.preemptPending === true,
      threadLog: (event, details = {}) => logThreadDetail(`active_window_prewarm_${event}`, Object.assign({ threadId: id }, details)),
    });
  }

  function scheduleThreadDetailFirstPaintPrewarm(threadId, summary = null, reason = "", options = {}) {
    const id = String(threadId || summary && (summary.id || summary.threadId || summary.thread_id) || "").trim();
    if (!id || !threadDetailFirstPaintPrewarmService || typeof threadDetailFirstPaintPrewarmService.schedule !== "function") {
      return { scheduled: false, reason: "unavailable" };
    }
    return threadDetailFirstPaintPrewarmService.schedule({
      codex,
      threadId: id,
      summary,
      reason,
      delayMs: options.delayMs,
      bypassMinInterval: options.bypassMinInterval === true,
      preemptPending: options.preemptPending === true,
      activeHint: options.activeHint === true,
      threadLog: (event, details = {}) => logThreadDetail(`first_paint_prewarm_${event}`, Object.assign({ threadId: id }, details)),
    });
  }

  function scheduleActiveWindowPrewarmFromNotification(payload) {
    if (!payload || payload.type !== "notification" || !payload.params) return;
    const method = String(payload.method || "");
    if (method !== "turn/started" && method !== "turn/completed" && method !== "thread/status/changed") return;
    const threadId = notificationThreadId(payload);
    if (!threadId) return;
    if (method === "thread/status/changed" && !threadSummaryLooksActive(payload.params)) return;
    const canBypassThrottle = method === "turn/started" || method === "turn/completed";
    scheduleActiveWindowPrewarm(threadId, null, method, {
      delayMs: canBypassThrottle ? 0 : undefined,
      bypassMinInterval: canBypassThrottle,
      preemptPending: canBypassThrottle,
    });
  }

  function scheduleActiveWindowPrewarmFromThreadListResult(result, reason = "") {
    const rows = Array.isArray(result && result.data)
      ? result.data
      : Array.isArray(result && result.threads)
        ? result.threads
        : [];
    for (const thread of rows) {
      if (!threadSummaryLooksActive(thread)) continue;
      scheduleActiveWindowPrewarm(thread.id || thread.threadId || thread.thread_id, thread, reason || "thread-list");
      scheduleThreadDetailFirstPaintPrewarm(thread.id || thread.threadId || thread.thread_id, thread, reason || "thread-list");
    }
  }

  function threadStatusChangedPayload(threadId, status, meta = {}) {
    const id = String(threadId || "").trim();
    if (!id) return null;
    const params = {
      threadId: id,
      status: status || { type: "notLoaded" },
    };
    const source = String(meta.source || "").trim();
    const turnId = String(meta.turnId || "").trim();
    const eventAtMs = timestampToMs(meta.eventAtMs || meta.eventAt || meta.completedAtMs || meta.completedAt || meta.startedAtMs || meta.startedAt);
    if (source) params.source = source;
    if (turnId) params.turnId = turnId;
    if (eventAtMs) params.eventAtMs = eventAtMs;
    if (meta.mobileReplay) params.mobileReplay = true;
    return {
      type: "notification",
      method: "thread/status/changed",
      params,
    };
  }

  function broadcastThreadStatusChanged(threadId, status, meta = {}) {
    const payload = threadStatusChangedPayload(threadId, status, meta);
    if (!payload) return false;
    applyThreadStatusPayloadToThreadListFallbackCache(payload);
    broadcast(payload);
    return true;
  }

  function notifyLocalTurnStarted(threadId, result, meta = {}) {
    const id = String(threadId || "").trim();
    const turnId = turnStartResultTurnId(result);
    if (!id) return turnId;
    rememberLocalActiveThreadStatus(id, turnId, { source: String(meta.source || "local-turn-start") });
    if (turnId && threadDetailProjectionService) {
      threadDetailProjectionService.applyNotification("turn/started", {
        threadId: id,
        turn: Object.assign({ id: turnId, status: { type: "active" } }, result && result.turn && typeof result.turn === "object" ? result.turn : {}),
      });
    }
    const activeSummary = { id, status: { type: "active" }, activeTurnId: turnId };
    scheduleActiveWindowPrewarm(id, activeSummary, "local-turn-start");
    scheduleThreadDetailFirstPaintPrewarm(id, activeSummary, "local-turn-start", { activeHint: true });
    broadcastThreadStatusChanged(id, { type: "active" }, {
      source: String(meta.source || "local-turn-start"),
      turnId,
    });
    return turnId;
  }

  function threadStatusChangedPayloadFromTurnNotification(payload) {
    if (!payload || payload.type !== "notification" || !payload.params) return null;
    const method = String(payload.method || "");
    if (method !== "turn/started" && method !== "turn/completed") return null;
    const threadId = notificationThreadId(payload);
    if (!threadId) return null;
    const turn = payload.params.turn && typeof payload.params.turn === "object" ? payload.params.turn : {};
    const turnId = String(turn.id || payload.params.turnId || "");
    const status = method === "turn/started"
      ? { type: "active" }
      : (turn.status || payload.params.status || { type: "completed" });
    const eventAtMs = method === "turn/started"
      ? timestampToMs(turn.startedAtMs || turn.startedAt || turn.createdAtMs || turn.createdAt || payload.params.startedAtMs || payload.params.startedAt)
      : timestampToMs(turn.completedAtMs || turn.completedAt || turn.finishedAtMs || turn.finishedAt || turn.updatedAtMs || turn.updatedAt || payload.params.completedAtMs || payload.params.completedAt || payload.params.finishedAtMs || payload.params.finishedAt || payload.params.updatedAtMs || payload.params.updatedAt);
    const fallbackEventAtMs = payload.params.mobileReplay ? 0 : Date.now();
    return threadStatusChangedPayload(threadId, status, {
      source: method,
      turnId,
      eventAtMs: eventAtMs || fallbackEventAtMs,
      mobileReplay: Boolean(payload.params.mobileReplay),
    });
  }

  function updateLocalActiveThreadStatusFromNotification(payload) {
    if (!payload || payload.type !== "notification" || !payload.params) return;
    const method = String(payload.method || "");
    if (method !== "turn/started" && method !== "turn/completed") return;
    const threadId = notificationThreadId(payload);
    if (!threadId) return;
    const turn = payload.params.turn && typeof payload.params.turn === "object" ? payload.params.turn : {};
    const turnId = String(turn.id || payload.params.turnId || "");
    if (method === "turn/started") {
      rememberLocalActiveThreadStatus(threadId, turnId, { source: method });
    } else {
      clearLocalActiveThreadStatus(threadId);
    }
  }

  function shouldSendEventToClient(payload, client = {}) {
    if (!payload || payload.type !== "notification") return true;
    if (payload.method === "account/rateLimits/updated") return false;
    if (payload.method === "thread/started"
      || payload.method === "thread/status/changed"
      || payload.method === "thread/name/updated"
      || payload.method === "thread/archived"
      || payload.method === "thread/task-card-return/changed") {
      return true;
    }
    const threadId = notificationThreadId(payload);
    if (!threadId) return true;
    return Boolean(client.threadId) && client.threadId === threadId;
  }

  function removeEventClient(res) {
    const heartbeat = clientHeartbeats.get(res);
    if (heartbeat) clearInterval(heartbeat);
    clientHeartbeats.delete(res);
    clients.delete(res);
    try {
      if (!res.destroyed && !res.writableEnded) res.end();
    } catch (_) {}
  }

  return {
    broadcast,
    broadcastThreadStatusChanged,
    clientHeartbeats,
    clients,
    compactNotification,
    notificationThreadId,
    notifyLocalTurnStarted,
    removeEventClient,
    scheduleActiveWindowPrewarm,
    scheduleActiveWindowPrewarmFromNotification,
    scheduleActiveWindowPrewarmFromThreadListResult,
    scheduleThreadDetailFirstPaintPrewarm,
    shouldSendEventToClient,
    threadStatusChangedPayload,
    threadStatusChangedPayloadFromTurnNotification,
    threadSummaryLooksActive,
    updateLocalActiveThreadStatusFromNotification,
  };
}

module.exports = {
  createThreadEventNotificationService,
};
