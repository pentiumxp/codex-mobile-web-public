"use strict";

function shouldRenderAfterUpsert(turn, item) {
  return !shouldDeferLiveFinalReceipt(turn, item && item.type);
}

function upsertItem(turnId, item) {
  const turn = ensureTurn(turnId);
  if (!turn || !item || !item.id) return;
  markActivity(activityLabelForItem(item));
  if (isReasoningItem(item)) {
    updateTickTimer();
    return;
  }
  turn.items = turn.items || [];
  let structureChanged = false;
  if (item.type === "userMessage") {
    const matchingExistingIndex = turn.items.findIndex((existing) => existing
      && existing.id !== item.id
      && existing.type === "userMessage"
      && userMessagesCanShadow(existing, item));
    if (matchingExistingIndex >= 0) {
      const mergedUserMessage = mergeLikelySameUserMessage(turn.items[matchingExistingIndex], item);
      turn.items[matchingExistingIndex] = mergedUserMessage;
      normalizeThreadVisibleUserMessages(state.currentThread);
      if (shouldRenderAfterUpsert(turn, mergedUserMessage)) scheduleRenderCurrentThread();
      return;
    }
  }
  if (item.type === "agentMessage" || item.type === "plan") {
    const beforeLength = turn.items.length;
    turn.items = turn.items.filter((existing) => existing.id === item.id || !visibleTextItemsLikelySame(existing, item));
    structureChanged = structureChanged || turn.items.length !== beforeLength;
  }
  if (isTurnUsageSummaryItem(item)) {
    const beforeLength = turn.items.length;
    turn.items = turn.items.filter((existing) => existing.id === item.id || !isTurnUsageSummaryItem(existing));
    structureChanged = structureChanged || turn.items.length !== beforeLength;
  }
  const index = turn.items.findIndex((x) => x.id === item.id);
  const canPatchExistingItem = index >= 0;
  let nextItem = item;
  if (index >= 0 && !item.startedAtMs && turn.items[index].startedAtMs) item.startedAtMs = turn.items[index].startedAtMs;
  if (item.type === "reasoning" && !item.startedAtMs) item.startedAtMs = Date.now();
  if (isOperationalItem(item) && isCompletedStatus(item.status) && !item.completedAtMs) item.completedAtMs = Date.now();
  if (index >= 0) {
    turn.items[index] = mergeItemPreservingVisibleFields(turn.items[index], item);
    nextItem = turn.items[index];
  } else {
    turn.items.push(item);
  }
  normalizeThreadVisibleUserMessages(state.currentThread);
  if (shouldRenderAfterUpsert(turn, nextItem)) {
    if (structureChanged) scheduleRenderCurrentThread();
    else if (canPatchExistingItem) {
      if (!patchVisibleItemDom(turn, nextItem)) scheduleRenderCurrentThread();
    } else if (!insertVisibleItemDom(turn, nextItem)) {
      scheduleRenderCurrentThread();
    }
  }
}

function removeItem(turnId, itemId) {
  const turn = ensureTurn(turnId);
  if (!turn || !itemId) return;
  turn.items = (turn.items || []).filter((item) => item.id !== itemId);
  scheduleRenderCurrentThread();
}

function ensureTimerItem(turnId, itemId, itemType) {
  const turn = ensureTurn(turnId);
  if (!turn || !itemId) return;
  if (itemType === "reasoning") {
    markActivity("思考");
    updateTickTimer();
    return;
  }
  turn.items = turn.items || [];
  let item = turn.items.find((x) => x.id === itemId);
  let createdItem = false;
  if (!item) {
    item = { id: itemId, type: itemType, startedAtMs: Date.now() };
    turn.items.push(item);
    createdItem = true;
  }
  if (!item.startedAtMs) item.startedAtMs = Date.now();
  if (createdItem) {
    if (!insertVisibleItemDom(turn, item)) scheduleRenderCurrentThread();
  } else if (!patchVisibleItemDom(turn, item)) {
    scheduleRenderCurrentThread();
  }
}

function shouldRenderAfterAppend(turn, itemType, field, previousValue, nextValue, options = {}) {
  if (options.render === false) return false;
  return true;
}

function appendToItem(turnId, itemId, itemType, field, delta, index = 0, options = {}) {
  const turn = ensureTurn(turnId);
  if (!turn) return;
  if (itemType === "reasoning") {
    markActivity("思考");
    updateTickTimer();
    return;
  }
  markActivity(activityLabelForItem({ type: itemType }));
  let item = (turn.items || []).find((x) => x.id === itemId);
  let createdItem = false;
  if (!item) {
    item = { id: itemId, type: itemType, startedAtMs: Date.now() };
    turn.items.push(item);
    createdItem = true;
  }
  if (!item.startedAtMs) item.startedAtMs = Date.now();
  const previousValue = Array.isArray(item[field]) ? item[field][index] : item[field];
  let nextValue = previousValue;
  if (field === "aggregatedOutput") {
    appendCommandOutput(item, delta);
    nextValue = item[field];
  } else if (Array.isArray(item[field])) {
    item[field][index] = (item[field][index] || "") + delta;
    nextValue = item[field][index];
  } else {
    item[field] = compactLiveText((item[field] || "") + delta);
    nextValue = item[field];
  }
  sustainSubmittedMessageBottomFollow(turn, itemType, field);
  if (shouldRenderAfterAppend(turn, itemType, field, previousValue, nextValue, options)) {
    if (isOperationalItem(item)) updateLiveOperationDockForLocalPatch();
    else if (createdItem) {
      if (!insertVisibleItemDom(turn, item)) scheduleRenderCurrentThread();
    } else if (!patchLiveTextItemDom(turn, item)) scheduleRenderCurrentThread();
  }
}

function scheduleRenderCurrentThread() {
  if (state.renderFrame || state.renderScheduled) return;
  state.renderScheduled = true;
  const render = () => {
    state.renderFrame = null;
    state.renderScheduled = false;
    renderCurrentThread();
  };
  if (window.requestAnimationFrame) {
    state.renderFrame = window.requestAnimationFrame(render);
  } else {
    state.renderFrame = setTimeout(render, 33);
  }
}

function scheduleRenderThreads(...args) {
  return threadListRuntime.scheduleRenderThreads(...args);
}
function upsertServerRequest(request, fallbackThreadId = "") {
  if (!request || request.id === null || request.id === undefined) return;
  const key = String(request.id);
  const existing = state.pendingApprovals.get(key);
  const threadId = approvalActionThreadId(existing, fallbackThreadId);
  if (!shouldShowApprovalRequest(request)) {
    state.pendingApprovals.delete(key);
    scheduleApprovalThreadRender(approvalActionThreadId(request, threadId));
    return;
  }
  markActivity(isUserInputRequest(request) ? "等待输入" : "等待批准");
  const next = serverRequestWithThreadContext(Object.assign({}, existing || {}, request), threadId);
  state.pendingApprovals.set(key, next);
  scheduleApprovalThreadRender(approvalActionThreadId(next));
}

function scheduleApprovalRemoval(requestId, delayMs = 6000) {
  const key = requestId !== null && requestId !== undefined ? String(requestId) : "";
  if (!key) return;
  setTimeout(() => {
    const existing = state.pendingApprovals.get(key);
    if (!existing || !isApprovalSettled(existing)) return;
    const threadId = approvalActionThreadId(existing);
    state.pendingApprovals.delete(key);
    scheduleApprovalThreadRender(threadId);
  }, delayMs);
}

function resolveServerRequest(payload) {
  const requestId = payload && payload.requestId !== null && payload.requestId !== undefined ? String(payload.requestId) : "";
  if (!requestId) return;
  const existing = state.pendingApprovals.get(requestId);
  let next = existing || null;
  if (payload.request) {
    next = serverRequestWithThreadContext(
      Object.assign({}, existing || {}, payload.request),
      approvalActionThreadId(existing),
    );
    state.pendingApprovals.set(requestId, next);
  } else if (existing) {
    existing.status = payload.status || "resolved";
    next = existing;
  }
  if (next) scheduleApprovalThreadRender(approvalActionThreadId(next));
  if (next) markActivity(isUserInputRequest(next) ? "输入完成" : "批准完成");
  scheduleApprovalRemoval(requestId);
}

function serverRequestWithThreadContext(request, threadId) {
  const id = String(threadId || "").trim();
  if (!request || !id || approvalThreadId(request)) return request;
  return Object.assign({}, request, {
    params: Object.assign({}, request.params || {}, { threadId: id }),
  });
}

function syncThreadPendingServerRequests(thread) {
  const threadId = String(thread && (thread.id || state.currentThreadId) || "").trim();
  const requests = Array.isArray(thread && thread.pendingServerRequests) ? thread.pendingServerRequests : [];
  if (!threadId || !requests.length) return;
  for (const request of requests) {
    if (!request || request.id === null || request.id === undefined) continue;
    if (!requestBelongsToThread(request, threadId)) continue;
    upsertServerRequest(request, threadId);
  }
}

function applyThreadGoalToThread(thread, normalizedGoal) {
  if (!thread) return false;
  if (normalizedGoal) thread.goal = normalizedGoal;
  else delete thread.goal;
  return true;
}

function scheduleThreadGoalDetailRender(threadId = "") {
  const id = String(threadId || state.currentThreadId || "").trim();
  if (!id) return false;
  if (state.currentThread && String(state.currentThread.id || "") === id) {
    scheduleRenderCurrentThread();
    return true;
  }
  if (state.threadTileMode && threadTilePaneIsVisible(id)) {
    if (!scheduleRenderThreadTilePane(id, { preserveScroll: true })) scheduleRenderCurrentThread();
    return true;
  }
  return false;
}

function updateThreadGoalState(...args) {
  return threadListRuntime.updateThreadGoalState(...args);
}
function applyNotification(method, params) {
  if (!params) return;
  if (method === "account/rateLimits/updated") {
    // Rate-limit notifications do not carry a thread/workspace/profile source.
    // Use status/public-config snapshots from the active Mobile Web chain
    // instead of letting unrelated workspace events overwrite the composer UI.
    return;
  }
  if (shouldThrottleThreadNotification(method, params)) return;
  if ((method === "turn/started" || method === "turn/completed") && params.threadId) {
    clearThreadTileOperationBubble(params.threadId);
  }
  if (method === "thread/started" && params.thread) {
    if (isHiddenThread(params.thread)) {
      state.threads = state.threads.filter((thread) => thread.id !== params.thread.id);
      scheduleRenderThreads();
      return;
    }
    const index = state.threads.findIndex((x) => x.id === params.thread.id);
    updateThreadStatusHints(params.thread.id, index >= 0 ? state.threads[index].status : null, params.thread.status, {
      thread: params.thread,
      threadName: threadDisplayName(params.thread),
      notify: true,
    });
    if (index >= 0) state.threads[index] = Object.assign({}, state.threads[index], params.thread);
    else state.threads.unshift(params.thread);
    scheduleRenderThreads();
    return;
  }
  if (method === "thread/status/changed") {
    const replayed = Boolean(params.mobileReplay);
    const runningNotification = isRunningStatus(params.status);
    const eventAtMs = threadStatusNotificationEventAtMs(params, runningNotification ? Date.now() : 0, {
      allowReplayReceivedAt: !replayed || runningNotification,
    });
    const thread = localThreadForStatusContext(params.threadId);
    const previousStatus = thread ? thread.status : null;
    updateThreadStatusHints(params.threadId, previousStatus, params.status, {
      thread,
      notify: true,
      threadName: threadDisplayName(thread),
      eventAtMs,
      mobileReplay: replayed,
    });
    updateThreadListStatus(params.threadId, params.status);
    pruneHiddenThreads();
    if (state.currentThread && state.currentThread.id === params.threadId) {
      markThreadViewed(params.threadId, state.currentThread, eventAtMs);
      renderCurrentThread();
      scheduleLivePollIfNeeded(1400);
    } else if (state.threadTileMode && threadTilePaneIsVisible(params.threadId)) {
      scheduleThreadStatusDetailRender(params.threadId);
      loadThreadTileDetail(params.threadId, { force: true, background: true, source: "tile-status" }).catch(showError);
    }
    scheduleRenderThreads();
    return;
  }
  if (method === "thread/name/updated") {
    updateThreadNameLocally(params.threadId, params.threadName);
    pruneHiddenThreads();
    if (!(state.currentThread && state.currentThread.id === params.threadId)
      && state.threadTileMode
      && threadTilePaneIsVisible(params.threadId)) {
      loadThreadTileDetail(params.threadId, { force: true, background: true, source: "tile-name" }).catch(showError);
    }
    return;
  }
  if (method === "thread/goal/updated") {
    updateThreadGoalState(params.threadId, params.goal);
    return;
  }
  if (method === "thread/goal/cleared") {
    updateThreadGoalState(params.threadId, null);
    return;
  }
  if (method === "thread/archived") {
    state.threads = state.threads.filter((thread) => thread.id !== params.threadId);
    if (state.currentThread && state.currentThread.id === params.threadId) {
      if (state.continuationSourceThreadId === params.threadId) {
        state.currentThread = Object.assign({}, state.currentThread, {
          archived: true,
          status: params.status || { type: "archived" },
        });
      } else {
        clearCurrentThreadSelection();
      }
    }
    scheduleRenderThreads();
    renderCurrentThread();
    return;
  }
  if (!state.currentThread || params.threadId !== state.currentThread.id) {
    if (state.threadTileMode && params.threadId && threadTilePaneIsVisible(params.threadId)) {
      loadThreadTileDetail(params.threadId, { force: true, background: true, source: `tile-${method}` }).catch(showError);
    }
    return;
  }
  if (method === "turn/started") {
    const replayed = Boolean(params.mobileReplay);
    const eventAtMs = threadStatusNotificationEventAtMs(params, Date.now(), {
      allowReplayReceivedAt: true,
    });
    const runningStatus = { type: "active" };
    state.activeTurnId = params.turn.id;
    updateThreadStatusHints(params.threadId, state.currentThread.status, runningStatus, {
      thread: state.currentThread,
      threadName: threadDisplayName(state.currentThread),
      notify: false,
      eventAtMs,
      mobileReplay: replayed,
    });
    updateThreadListStatus(params.threadId, runningStatus);
    clearRecentCompletedReplyAnchor();
    clearConversationAutoScrollHold();
    clearLiveOperationDockRuntimeState();
    markActivity("开始");
    $("interruptTurn").disabled = false;
    updateComposerControls();
    ensureTurn(params.turn.id);
    renderCurrentThread();
    scheduleRenderThreads();
    scheduleCurrentThreadRefresh(500);
    scheduleLivePollIfNeeded(1200);
    return;
  }
  if (method === "turn/completed") {
    const replayed = Boolean(params.mobileReplay);
    const eventAtMs = threadStatusNotificationEventAtMs(params, Date.now(), {
      allowReplayReceivedAt: !replayed,
    });
    const completedStatus = (params.turn && params.turn.status) || { type: "completed" };
    const turn = ensureTurn(params.turn.id);
    Object.assign(turn, mergeTurnPreservingVisibleItems(turn, params.turn));
    rememberRecentCompletedTurnReply(params.turn.id);
    const completedPendingSteer = isPendingSteerForTurn(params.turn.id);
    updateThreadStatusHints(params.threadId, state.currentThread.status, completedStatus, {
      thread: state.currentThread,
      threadName: threadDisplayName(state.currentThread),
      notify: true,
      eventAtMs,
      mobileReplay: replayed,
    });
    updateThreadListStatus(params.threadId, completedStatus);
    state.activeTurnId = "";
    clearLiveOperationDockRuntimeState();
    markActivity("完成");
    if (completedPendingSteer) setSteerFeedback("completed", { turnId: String(params.turn.id) });
    $("interruptTurn").disabled = true;
    updateComposerControls();
    const suppressAutomaticRefresh = shouldSuppressAutomaticCurrentThreadRefresh("post-completion", { threadId: params.threadId });
    renderCurrentThread({ stickToBottom: !suppressAutomaticRefresh });
    scheduleRenderThreads();
    if (!suppressAutomaticRefresh) schedulePostCompletionThreadRefreshes(params.threadId, [700, 2400]);
    setTimeout(() => {
      if (state.currentThreadId === params.threadId) loadSideChat(params.threadId, { silent: true }).catch(showError);
    }, 900);
    if (!suppressAutomaticRefresh) {
      scheduleUsageBackfillRefresh(1400);
      scheduleLivePollIfNeeded(1400);
    }
    return;
  }
  if (method === "item/started" || method === "item/completed") {
    upsertItem(params.turnId, params.item);
    markSteerAppliedIfNeeded(params.turnId, params.item);
    scheduleLivePollIfNeeded(2200);
    return;
  }
  if (method === "item/agentMessage/delta") {
    markActivity("输出");
    appendToItem(params.turnId, params.itemId, "agentMessage", "text", params.delta || "", 0);
    markSteerAppliedIfNeeded(params.turnId, { type: "agentMessage" });
    return;
  }
  if (method === "item/commandExecution/outputDelta") {
    return;
  }
  if (method === "item/fileChange/outputDelta") {
    return;
  }
  if (method === "item/reasoning/textDelta") {
    markActivity("思考");
    ensureTimerItem(params.turnId, params.itemId, "reasoning");
    markSteerAppliedIfNeeded(params.turnId, { type: "reasoning" });
    return;
  }
  if (method === "item/reasoning/summaryTextDelta") {
    markActivity("思考");
    ensureTimerItem(params.turnId, params.itemId, "reasoning");
    markSteerAppliedIfNeeded(params.turnId, { type: "reasoning" });
  }
}

function resetEventFallbackState() {
  clearTimeout(state.eventRetryTimer);
  clearTimeout(state.eventFallbackPollTimer);
  state.eventRetryTimer = null;
  state.eventFallbackPollTimer = null;
  state.eventReconnectFailures = 0;
  state.eventReconnectDelayMs = 5000;
  state.eventFallbackMode = false;
}

function scheduleEventReconnectRetry() {
  clearTimeout(state.eventRetryTimer);
  if (!state.key || !state.events || state.events.readyState === EventSource.OPEN) return;
  const delay = Math.min(Math.max(Number(state.eventReconnectDelayMs) || 5000, 5000), 45000);
  state.eventReconnectDelayMs = Math.min(delay * 2, 45000);
  state.eventRetryTimer = setTimeout(() => {
    state.eventRetryTimer = null;
    if (!state.key || document.visibilityState === "hidden") return;
    if (state.events && state.events.readyState === EventSource.OPEN) return;
    connectEvents();
  }, delay);
}

function shouldRefreshThreadListDuringEventRecovery(options = {}) {
  return Boolean(options.force) || !isHermesEmbedMode() || !state.threads.length;
}

async function refreshThreadListDuringEventRecovery(options = {}) {
  if (!shouldRefreshThreadListDuringEventRecovery(options)) return false;
  await loadThreads({ silent: isHermesEmbedMode() || Boolean(state.threads.length) });
  return true;
}

function scheduleEventFallbackPoll(delayMs = 8000) {
  clearTimeout(state.eventFallbackPollTimer);
  if (!isHermesEmbedMode()) return;
  if (state.events && state.events.readyState === EventSource.OPEN) return;
  state.eventFallbackMode = true;
  state.eventFallbackPollTimer = setTimeout(async () => {
    state.eventFallbackPollTimer = null;
    if (!state.key || document.visibilityState === "hidden") return;
    if (state.events && state.events.readyState === EventSource.OPEN) return;
    try {
      const status = await api("/api/status");
      updateConnectionState(status);
      clearReconnectRefreshPrompt();
      rememberRateLimitsFromConfig(status);
      if (status.codexProfiles) rememberCodexProfiles(status.codexProfiles);
      await refreshThreadListDuringEventRecovery();
      if (state.currentThreadId) await refreshCurrentThread({ source: "event-fallback-poll" });
      scheduleEventFallbackPoll();
    } catch (err) {
      showReconnectRefreshPrompt("reconnect");
      if (!isHermesEmbedMode()) showError(err);
    }
  }, delayMs);
}

async function recoverEventStreamWithApiFallback(options = {}) {
  const wasUnavailable = state.appServerWasUnavailable || Boolean(state.connectionStatus && !state.connectionStatus.ready);
  const status = await api("/api/status");
  updateConnectionState(status);
  const recovered = (wasUnavailable || Boolean(options.afterEventReconnect)) && status && status.ready;
  state.appServerWasUnavailable = Boolean(status && !status.ready);
  clearReconnectRefreshPrompt();
  rememberRateLimitsFromConfig(status);
  if (status.codexProfiles) rememberCodexProfiles(status.codexProfiles);
  await refreshThreadListDuringEventRecovery({ force: Boolean(options.afterEventReconnect) });
  if (state.currentThreadId) await refreshCurrentThread({ source: "event-recovery" });
  if (recovered) await maybeAutoRecoverTurnAfterReconnect(status, "event-fallback-reconnect");
  if (isHermesEmbedMode()) {
    state.eventFallbackMode = true;
    scheduleEventFallbackPoll();
    scheduleEventReconnectRetry();
  } else {
    ensureEventConnection();
  }
}

function connectEvents() {
  clearReconnectTimers();
  if (state.events) {
    state.events.onmessage = null;
    state.events.onerror = null;
    state.events.onopen = null;
    state.events.close();
  }
  const params = new URLSearchParams({ key: state.key });
  if (state.currentThreadId) params.set("threadId", state.currentThreadId);
  state.events = new EventSource(`/api/events?${params.toString()}`);
  state.events.onopen = () => {
    const hadReconnectFailure = state.eventReconnectFailures > 0 || state.eventFallbackMode;
    clearReconnectTimers();
    resetEventFallbackState();
    clearReconnectRefreshPrompt();
    if (state.connectionStatus) restoreConnectionState();
    scheduleVisiblePageRefreshCheck(200, { force: true });
    if (hadReconnectFailure) {
      recoverEventStreamWithApiFallback({ afterEventReconnect: true }).catch((err) => {
        state.appServerWasUnavailable = true;
        showReconnectRefreshPrompt("reconnect");
        if (!isHermesEmbedMode()) showError(err);
      });
    }
  };
  state.events.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "status") {
      clearReconnectTimers();
      const wasUnavailable = state.appServerWasUnavailable || Boolean(state.connectionStatus && !state.connectionStatus.ready);
      updateConnectionState(payload.status);
      const recovered = wasUnavailable && payload.status && payload.status.ready;
      state.appServerWasUnavailable = Boolean(payload.status && !payload.status.ready);
      rememberRateLimitsFromConfig(payload.status);
      if (payload.status.codexProfiles) rememberCodexProfiles(payload.status.codexProfiles);
      scheduleVisiblePageRefreshCheck(1200);
      if (recovered) maybeAutoRecoverTurnAfterReconnect(payload.status, "app-server-reconnect").catch(() => {});
      return;
    }
    if (payload.type === "notification") applyNotification(payload.method, payload.params);
    if (payload.type === "serverRequest") upsertServerRequest(payload.request);
    if (payload.type === "serverRequestResolved") resolveServerRequest(payload);
  };
  state.events.onerror = () => {
    if (document.visibilityState === "hidden") return;
    state.eventReconnectFailures += 1;
    clearTimeout(state.reconnectNoticeTimer);
    state.reconnectNoticeTimer = setTimeout(() => {
      if (state.events && state.events.readyState !== EventSource.OPEN && document.visibilityState !== "hidden") {
        if (!isHermesEmbedMode()) {
          markActivity("重连");
          updateConnectionState(null, "Reconnecting");
        }
      }
    }, 3000);
    clearTimeout(state.recoveryTimer);
    state.recoveryTimer = setTimeout(async () => {
      if (!state.events || state.events.readyState === EventSource.OPEN || document.visibilityState === "hidden") return;
      try {
        await recoverEventStreamWithApiFallback();
      } catch (err) {
        state.appServerWasUnavailable = true;
        showReconnectRefreshPrompt("reconnect");
        if (!isHermesEmbedMode()) showError(err);
      }
    }, 8000);
    return;
  };
}

function ensureEventConnection() {
  if (!state.key) return;
  if (!state.events || state.events.readyState === EventSource.CLOSED) connectEvents();
}

function clearResumeVisualTimers() {
  for (const timer of state.resumeVisualTimers) clearTimeout(timer);
  state.resumeVisualTimers = [];
}

function clearVisualRecoveryTimers() {
  for (const timer of state.visualRecoveryTimers) clearTimeout(timer);
  state.visualRecoveryTimers = [];
}

function visualRecoveryReasonAllowsHeavy(reason = "") {
  return !/^(focus|focusin|focusout|resize|visual-viewport|visual-viewport-scroll|window-blur)$/.test(String(reason || ""));
}

function shouldRunHeavyVisualRecovery(reason = "resume") {
  if (!visualRecoveryReasonAllowsHeavy(reason)) return false;
  const now = Date.now();
  if (now - state.lastHeavyVisualRecoveryAt < HEAVY_VISUAL_RECOVERY_MIN_INTERVAL_MS) return false;
  state.lastHeavyVisualRecoveryAt = now;
  return true;
}

function forceVisualRecovery(reason = "resume", options = {}) {
  updateViewportVars();
  if (!state.key) return;
  const app = $("app");
  const login = $("login");
  if (!app || !login) return;
  const root = document.documentElement;
  const body = document.body;
  const heavy = options.heavy !== false && shouldRunHeavyVisualRecovery(reason);
  login.classList.add("hidden");
  app.classList.remove("hidden");
  if (heavy) {
    root.classList.add("visual-recovering");
    if (body) body.classList.add("visual-recovering");
    app.classList.add("resume-repaint");
  }
  app.dataset.resumeReason = reason;
  if (heavy) {
    app.style.transform = "translateY(var(--app-top, 0px)) translateZ(0)";
    app.style.webkitTransform = "translateY(var(--app-top, 0px)) translateZ(0)";
  }
  app.getBoundingClientRect();
  if (options.render !== false && (state.currentThread || state.threads.length)) renderCurrentThread();
  updateComposerHeightVar();
  window.requestAnimationFrame(() => {
    app.getBoundingClientRect();
    window.requestAnimationFrame(() => {
      if (heavy) {
        app.classList.remove("resume-repaint");
        root.classList.remove("visual-recovering");
        if (body) body.classList.remove("visual-recovering");
      }
      app.style.removeProperty("transform");
      app.style.removeProperty("-webkit-transform");
      delete app.dataset.resumeReason;
    });
  });
}

function scheduleVisualRecovery(reason = "visual", delay = 0, options = {}) {
  if (document.visibilityState === "hidden") return;
  const seq = ++state.visualRecoverySeq;
  clearVisualRecoveryTimers();
  const delays = options.delays || [delay, delay + 80, delay + 240, delay + 700, delay + 1600, delay + 3200];
  for (const visualDelay of delays) {
    state.visualRecoveryTimers.push(setTimeout(() => {
      if (seq === state.visualRecoverySeq && document.visibilityState !== "hidden") {
        forceVisualRecovery(reason, {
          render: options.render !== false,
          heavy: options.heavy !== false,
        });
      }
    }, Math.max(0, visualDelay)));
  }
}

function scheduleMobileResume(reason = "resume", delay = 80) {
  if (document.visibilityState === "hidden") return;
  clearTimeout(state.resumeRetryTimer);
  state.resumeRetryTimer = null;
  if (state.startupInProgress) {
    forceVisualRecovery(reason);
    postClientEvent("mobile_resume_skipped_startup", {
      reason,
      currentThreadId: state.currentThreadId || "",
      hasThreadOpenIntent: Boolean(state.startupThreadOpenPending),
    });
    return;
  }
  const seq = ++state.resumeSeq;
  clearTimeout(state.resumeTimer);
  clearResumeVisualTimers();
  const allowHeavyRecovery = visualRecoveryReasonAllowsHeavy(reason);
  for (const [index, visualDelay] of [0, delay, delay + 220, delay + 900].entries()) {
    state.resumeVisualTimers.push(setTimeout(() => {
      if (seq === state.resumeSeq && document.visibilityState !== "hidden") {
        forceVisualRecovery(reason, { heavy: index === 0 && allowHeavyRecovery });
      }
    }, visualDelay));
  }
  state.resumeTimer = setTimeout(() => {
    if (seq === state.resumeSeq) resumeMobileSession(reason).catch(showError);
  }, delay);
}

function isTransientResumeError(err) {
  const message = String(err && err.message || err || "");
  return /load failed|failed to fetch|networkerror|network request failed|request timed out|cancelled/i.test(message);
}

function scheduleTransientResumeRetry(reason, delay = 1200) {
  clearTimeout(state.resumeRetryTimer);
  state.resumeRetryTimer = setTimeout(() => {
    state.resumeRetryTimer = null;
    if (document.visibilityState === "hidden" || state.startupInProgress || !state.key) return;
    scheduleMobileResume(`${reason}-retry`, 120);
  }, delay);
}

async function resumeMobileSession(reason = "resume") {
  if (document.visibilityState === "hidden" || !state.key) return;
  const startedAt = nowPerfMs();
  try {
    forceVisualRecovery(reason, { heavy: false });
    updateComposerHeightVar();
    renderComposerSettings();
    updateComposerControls();
    if (state.currentThread || state.threads.length) renderCurrentThread();
    ensureEventConnection();
    state.pollStableCount = 0;
    const wasUnavailable = state.appServerWasUnavailable || Boolean(state.connectionStatus && !state.connectionStatus.ready);
    const status = await api("/api/status");
    updateConnectionState(status);
    const recovered = wasUnavailable && status && status.ready;
    state.appServerWasUnavailable = Boolean(status && !status.ready);
    rememberRateLimitsFromConfig(status);
    if (status.codexProfiles) rememberCodexProfiles(status.codexProfiles);
    await loadThreads({ silent: Boolean(state.threads.length) });
    if (state.currentThreadId && state.currentThread && !state.currentThread.mobileLoading && !state.currentThread.mobileLoadError) {
      const foregroundRefresh = currentThreadNeedsForegroundRefresh();
      postClientEvent("mobile_resume_thread_refresh_scheduled", {
        reason,
        currentThreadId: state.currentThreadId || "",
        status: statusText(state.currentThread && state.currentThread.status),
        activeTurnId: state.activeTurnId || "",
        foregroundRefresh,
      });
      if (foregroundRefresh) scheduleCurrentThreadRefresh(250, "resume");
      else await refreshCurrentThread({ source: "resume" });
    } else if (state.currentThreadId) {
      await refreshCurrentThread({ source: "resume" });
    } else {
      await restoreThreadSelection();
    }
    if (recovered) await maybeAutoRecoverTurnAfterReconnect(status, reason);
    scheduleLivePollIfNeeded(1200);
    const elapsedMs = roundedDurationMs(startedAt);
    if (elapsedMs > 1200) {
      postClientEvent("mobile_resume_slow", {
        reason,
        elapsedMs,
        currentThreadId: state.currentThreadId || "",
        hadThreads: Boolean(state.threads.length),
      });
    }
  } catch (err) {
    if (isTransientResumeError(err)) state.appServerWasUnavailable = true;
    postClientEvent("mobile_resume_error", {
      reason,
      elapsedMs: roundedDurationMs(startedAt),
      error: err.message || String(err),
      transient: isTransientResumeError(err),
    });
    forceVisualRecovery(reason, { heavy: false });
    if (isTransientResumeError(err)) {
      scheduleTransientResumeRetry(reason);
      return;
    }
    showError(err);
  }
}

function scrollConversationToBottom() {
  const el = $("conversation");
  if (!el) return;
  const target = Math.max(0, el.scrollHeight - el.clientHeight);
  if (Math.abs(el.scrollTop - target) < 2) {
    scheduleScrollToBottomButtonUpdate();
    return;
  }
  markProgrammaticConversationScroll();
  el.scrollTop = target;
  syncConversationScrollPosition();
  scheduleScrollToBottomButtonUpdate();
}

function planConversationViewportPreservation(options = {}) {
  const nearBottom = Object.prototype.hasOwnProperty.call(options, "nearBottom")
    ? Boolean(options.nearBottom)
    : isConversationNearBottom();
  return conversationScroll.planReadingViewportPreservation({
    nearBottom,
    userReadingCurrentTurn: Boolean(options.userReadingCurrentTurn),
    autoScrollHold: shouldHoldAutoScrollForCurrentTurn(),
    userReadingAwayFromBottom: isUserReadingAwayFromConversationBottom({ nearBottom }),
    recentScrollIntent: hasRecentConversationScrollIntent(),
  });
}

function captureConversationViewportAnchor(options = {}) {
  const conversation = $("conversation");
  if (!conversation) return null;
  const plan = planConversationViewportPreservation(options);
  if (!plan.preserve) return null;
  const viewport = conversation.getBoundingClientRect();
  const nodes = Array.from(conversation.querySelectorAll("[data-render-key]"));
  for (const node of nodes) {
    if (!node || typeof node.getBoundingClientRect !== "function") continue;
    const key = String(node.getAttribute && node.getAttribute("data-render-key") || "");
    if (!key) continue;
    const rect = node.getBoundingClientRect();
    if (rect.bottom <= viewport.top + 1 || rect.top >= viewport.bottom - 1) continue;
    return {
      threadId: state.currentThreadId || (state.currentThread && state.currentThread.id) || "",
      renderKey: key,
      topOffset: rect.top - viewport.top,
      scrollTop: conversation.scrollTop,
      reason: plan.reason,
    };
  }
  return {
    threadId: state.currentThreadId || (state.currentThread && state.currentThread.id) || "",
    renderKey: "",
    topOffset: 0,
    scrollTop: conversation.scrollTop,
    reason: plan.reason,
  };
}

function restoreConversationViewportAnchor(anchor) {
  if (!anchor) return false;
  const conversation = $("conversation");
  if (!conversation) return false;
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  if (String(anchor.threadId || "") !== String(threadId || "")) return false;
  let nextScrollTop = Number(anchor.scrollTop || 0);
  if (anchor.renderKey) {
    const target = conversation.querySelector(`[data-render-key="${escapeSelectorAttr(anchor.renderKey)}"]`);
    if (target && typeof target.getBoundingClientRect === "function") {
      const viewport = conversation.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      nextScrollTop = conversation.scrollTop + (rect.top - viewport.top - Number(anchor.topOffset || 0));
    }
  }
  const maxScrollTop = Math.max(0, conversation.scrollHeight - conversation.clientHeight);
  nextScrollTop = Math.max(0, Math.min(maxScrollTop, nextScrollTop));
  if (Math.abs(conversation.scrollTop - nextScrollTop) < 1) {
    scheduleScrollToBottomButtonUpdate();
    return false;
  }
  markProgrammaticConversationScroll();
  conversation.scrollTop = nextScrollTop;
  syncConversationScrollPosition();
  scheduleScrollToBottomButtonUpdate();
  return true;
}

function scheduleConversationToBottom() {
  if (state.bottomScrollFrame) return;
  const scroll = () => {
    state.bottomScrollFrame = null;
    scrollConversationToBottom();
  };
  if (window.requestAnimationFrame) {
    state.bottomScrollFrame = window.requestAnimationFrame(scroll);
  } else {
    state.bottomScrollFrame = setTimeout(scroll, 33);
  }
}

function clearBottomFollowTimers() {
  state.bottomFollowTimers.forEach((timer) => clearTimeout(timer));
  state.bottomFollowTimers = [];
}

function clearSubmittedMessageBottomFollow() {
  state.submittedMessageBottomFollow = null;
}

function clearViewportBottomFollow() {
  state.viewportBottomFollow = null;
}

function shouldFollowSubmittedMessageToBottom() {
  const userReadingCurrentTurn = isUserReadingCurrentTurn();
  let leaseActive = false;
  if (!userReadingCurrentTurn) {
    const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
    leaseActive = conversationScroll.shouldFollowSubmittedMessage(state.submittedMessageBottomFollow, {
      threadId,
      nowMs: Date.now(),
    });
  }
  const plan = conversationScroll.planBottomFollowLeaseEvaluation({
    userReadingCurrentTurn,
    leaseActive,
    hasLease: Boolean(state.submittedMessageBottomFollow),
  });
  if (plan.clearLease) clearSubmittedMessageBottomFollow();
  return Boolean(plan.shouldFollow);
}

function shouldFollowViewportChangeToBottom() {
  const userReadingCurrentTurn = isUserReadingCurrentTurn();
  let leaseActive = false;
  if (!userReadingCurrentTurn) {
    const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
    leaseActive = conversationScroll.shouldFollowViewport(state.viewportBottomFollow, {
      threadId,
      nowMs: Date.now(),
    });
  }
  const plan = conversationScroll.planBottomFollowLeaseEvaluation({
    userReadingCurrentTurn,
    leaseActive,
    hasLease: Boolean(state.viewportBottomFollow),
  });
  if (plan.clearLease) clearViewportBottomFollow();
  return Boolean(plan.shouldFollow);
}

function scheduleBottomFollowScroll(shouldFollow) {
  const plan = conversationScroll.planBottomFollowScrollSchedule();
  if (plan.clearExistingTimers) clearBottomFollowTimers();
  plan.delaysMs.forEach((delay) => {
    const timer = window.setTimeout(() => {
      state.bottomFollowTimers = state.bottomFollowTimers.filter((entry) => entry !== timer);
      if (shouldFollow()) scheduleConversationToBottom();
    }, delay);
    state.bottomFollowTimers.push(timer);
  });
}

function scheduleSubmittedMessageBottomFollowScroll() {
  scheduleBottomFollowScroll(shouldFollowSubmittedMessageToBottom);
}

function scheduleViewportBottomFollowScroll() {
  scheduleBottomFollowScroll(shouldFollowViewportChangeToBottom);
}

function followSubmittedMessageToBottom(threadId, clientSubmissionId = "") {
  state.submittedMessageBottomFollow = conversationScroll.createSubmittedMessageFollow(threadId, {
    clientSubmissionId,
    nowMs: Date.now(),
  });
  if (!state.submittedMessageBottomFollow) return;
  clearConversationAutoScrollHold();
  clearRecentCompletedReplyAnchor();
  scheduleSubmittedMessageBottomFollowScroll();
}

function sustainSubmittedMessageBottomFollow(turn, itemType, field) {
  if (itemType !== "agentMessage" || field !== "text") return;
  if (!turn || !isLatestTurn(turn) || !isLiveTurn(turn)) return;
  const follow = state.submittedMessageBottomFollow;
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  if (!threadId || !follow || String(follow.threadId || "") !== String(threadId)) return;
  if (!conversationScroll.shouldFollowSubmittedMessage(follow, { threadId, nowMs: Date.now() })) return;
  state.submittedMessageBottomFollow = conversationScroll.extendSubmittedMessageFollow(follow, {
    nowMs: Date.now(),
  });
  scheduleSubmittedMessageBottomFollowScroll();
}

function sustainSubmittedMessageBottomFollowFromThread(thread) {
  const follow = state.submittedMessageBottomFollow;
  const threadId = state.currentThreadId || (thread && thread.id) || "";
  if (!threadId || !follow || String(follow.threadId || "") !== String(threadId)) return false;
  if (!conversationScroll.shouldFollowSubmittedMessage(follow, { threadId, nowMs: Date.now() })) return false;
  const liveTurn = latestLiveTurnForThread(thread);
  if (!liveTurn) return false;
  const hasVisibleProgress = visibleItemsForTurn(liveTurn, thread)
    .some((entry) => entry && entry.item && entry.item.type !== "userMessage");
  if (!hasVisibleProgress) return false;
  state.submittedMessageBottomFollow = conversationScroll.extendSubmittedMessageFollow(follow, {
    nowMs: Date.now(),
  });
  return true;
}

function followThreadOpenToBottom(threadId, ttlMs = 8000) {
  const id = String(threadId || "").trim();
  if (!id) return;
  state.viewportBottomFollow = conversationScroll.createViewportFollow(id, {
    reason: "thread-open",
    nowMs: Date.now(),
    ttlMs,
  });
  clearConversationAutoScrollHold();
  clearRecentCompletedReplyAnchor();
  scheduleViewportBottomFollowScroll();
}

function followViewportChangeToBottom(reason = "viewport") {
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  if (!threadId || !state.currentThread) return;
  const nowMs = Date.now();
  const alreadyFollowing = shouldFollowViewportChangeToBottom();
  const lastNearBottomAtMs = state.conversationNearBottomThreadId === threadId
    ? state.conversationNearBottomAtMs
    : 0;
  const shouldStart = alreadyFollowing || conversationScroll.shouldStartViewportFollow({
    nearBottom: isConversationNearBottom(),
    lastNearBottomAtMs,
    nowMs,
  });
  if (!shouldStart) return;
  if (!alreadyFollowing) {
    state.viewportBottomFollow = conversationScroll.createViewportFollow(threadId, {
      reason,
      nowMs,
    });
  }
  scheduleViewportBottomFollowScroll();
}

function markProgrammaticConversationScroll() {
  state.programmaticScrollUntilMs = Date.now() + 500;
}

function clearConversationNearBottomState() {
  state.conversationNearBottomAtMs = 0;
  state.conversationNearBottomThreadId = "";
}

function clearConversationUserScrollAwayState() {
  state.conversationUserScrollAwayThreadId = "";
}

function rememberConversationUserScrollAwayState() {
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  state.conversationUserScrollAwayThreadId = threadId ? String(threadId) : "";
}

function noteConversationBottomState(options = {}) {
  const nearBottom = isConversationNearBottom();
  if (nearBottom) {
    state.conversationNearBottomAtMs = Date.now();
    state.conversationNearBottomThreadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
    clearConversationUserScrollAwayState();
  } else if (options.userIntent) {
    clearConversationNearBottomState();
    rememberConversationUserScrollAwayState();
  }
  return nearBottom;
}

function syncConversationScrollPosition(options = {}) {
  const el = $("conversation");
  if (el) state.conversationLastScrollTop = el.scrollTop;
  noteConversationBottomState(options);
}

function hasRecentConversationScrollIntent(nowMs = Date.now()) {
  return nowMs - Number(state.conversationScrollIntentAtMs || 0) <= CONVERSATION_SCROLL_INTENT_MS;
}

function isUserReadingAwayFromConversationBottom(options = {}) {
  const threadId = String(options.threadId || state.currentThreadId || state.currentThread && state.currentThread.id || "").trim();
  if (!threadId || state.conversationUserScrollAwayThreadId !== threadId) return false;
  const nearBottom = Object.prototype.hasOwnProperty.call(options, "nearBottom")
    ? Boolean(options.nearBottom)
    : isConversationNearBottom();
  return !nearBottom;
}

function rememberConversationScrollIntent() {
  state.conversationScrollIntentAtMs = Date.now();
  clearSubmittedMessageBottomFollow();
  clearViewportBottomFollow();
  syncConversationScrollPosition();
  cancelAutomaticConversationRefreshesIfReading();
}

function clearConversationAutoScrollHold() {
  state.autoScrollHold = null;
}

function rememberConversationAutoScrollHold() {
  const turn = turnForConversationAutoScrollHold();
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  if (!threadId || !turn || !turn.id) return;
  state.autoScrollHold = {
    threadId: String(threadId),
    turnId: String(turn.id),
  };
}

function shouldHoldAutoScrollForCurrentTurn() {
  const hold = state.autoScrollHold;
  if (!hold) return false;
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  const turn = latestTurn();
  return Boolean(threadId && turn && hold.threadId === String(threadId) && hold.turnId === String(turn.id || ""));
}

function turnForConversationAutoScrollHold() {
  const live = currentLiveTurn();
  if (live) return live;
  const turn = latestTurn();
  return isRecentReplyJumpTurn(turn) ? turn : null;
}

function isUserReadingCurrentTurn(options = {}) {
  const nearBottom = Object.prototype.hasOwnProperty.call(options, "nearBottom")
    ? Boolean(options.nearBottom)
    : isConversationNearBottom();
  const planInput = { nearBottom };
  if (!nearBottom) {
    planInput.autoScrollHold = shouldHoldAutoScrollForCurrentTurn();
    if (!planInput.autoScrollHold) {
      planInput.recentScrollIntent = hasRecentConversationScrollIntent();
      if (planInput.recentScrollIntent) {
        planInput.hasCurrentTurn = Boolean(turnForConversationAutoScrollHold());
      }
    }
  }
  const plan = conversationScroll.planUserReadingCurrentTurn(planInput);
  return Boolean(plan.userReadingCurrentTurn);
}

function isAutomaticConversationRefreshSource(source) {
  return AUTOMATIC_CONVERSATION_REFRESH_SOURCES.has(String(source || "").trim());
}

function automaticConversationRefreshPlan(options = {}) {
  const threadId = String(options.threadId || state.currentThreadId || "").trim();
  const currentThreadId = String(state.currentThreadId || state.currentThread && state.currentThread.id || "").trim();
  const nearBottom = Object.prototype.hasOwnProperty.call(options, "nearBottom")
    ? Boolean(options.nearBottom)
    : isConversationNearBottom();
  const hasThread = Boolean(
    threadId
      && currentThreadId
      && threadId === currentThreadId
      && state.currentThread
      && String(state.currentThread.id || currentThreadId) === currentThreadId,
  );
  return conversationScroll.planAutomaticConversationRefresh({
    hasThread,
    nearBottom,
    userReadingCurrentTurn: !nearBottom && isUserReadingCurrentTurn({ nearBottom }),
    autoScrollHold: !nearBottom && shouldHoldAutoScrollForCurrentTurn(),
    userReadingAwayFromBottom: !nearBottom && isUserReadingAwayFromConversationBottom({ threadId, nearBottom }),
    recentScrollIntent: !nearBottom && hasRecentConversationScrollIntent(),
    userInitiated: options.userInitiated === true,
  });
}

function shouldSuppressAutomaticCurrentThreadRefresh(source, options = {}) {
  if (!isAutomaticConversationRefreshSource(source)) return false;
  const plan = automaticConversationRefreshPlan(options);
  return !plan.allowRefresh;
}

function clearAutomaticConversationRefreshTimersForUserReading() {
  clearTimeout(state.refreshTimer);
  state.refreshTimer = null;
  state.postCompletionRefreshTimers.forEach((timer) => clearTimeout(timer));
  state.postCompletionRefreshTimers = [];
  clearUsageBackfillRefresh();
  clearTimeout(state.pollTimer);
  state.pollTimer = null;
}

function cancelAutomaticConversationRefreshesIfReading() {
  const plan = automaticConversationRefreshPlan();
  if (!plan.cancelScheduled) return false;
  clearAutomaticConversationRefreshTimersForUserReading();
  return true;
}

function updateConversationAutoScrollHoldFromScroll() {
  const nearBottom = isConversationNearBottom();
  const planInput = { nearBottom };
  if (!nearBottom) {
    planInput.recentScrollIntent = hasRecentConversationScrollIntent();
    if (planInput.recentScrollIntent) {
      planInput.hasCurrentTurn = Boolean(turnForConversationAutoScrollHold());
    }
  }
  const plan = conversationScroll.planConversationAutoScrollHoldFromScroll(planInput);
  if (plan.action === "clear-hold") {
    clearConversationAutoScrollHold();
    return;
  }
  if (plan.action === "remember-hold") rememberConversationAutoScrollHold();
  cancelAutomaticConversationRefreshesIfReading();
}

function clearRecentCompletedReplyAnchor() {
  state.recentCompletedReplyAnchor = null;
}

function rememberRecentCompletedTurnReply(turnId) {
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  if (!threadId || !turnId) return;
  const normalizedThreadId = String(threadId);
  const normalizedTurnId = String(turnId);
  const previousAnchor = state.recentCompletedReplyAnchor;
  const keepActivatedByUserScroll = Boolean(
    previousAnchor
      && previousAnchor.threadId === normalizedThreadId
      && previousAnchor.turnId === normalizedTurnId
      && previousAnchor.activatedByUserScroll,
  );
  state.recentCompletedReplyAnchor = {
    threadId: normalizedThreadId,
    turnId: normalizedTurnId,
    completedAtMs: Date.now(),
    activatedByCompletion: true,
    activatedByUserScroll: keepActivatedByUserScroll,
    receiptStartLocated: false,
  };
}

function numericTimestampMs(value) {
  if (!value) return 0;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    if (typeof value !== "string") return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  return number > 100000000000 ? number : number * 1000;
}

function uuidV7TimestampMs(value) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) return 0;
  const timestampMs = Number.parseInt(text.replace(/-/g, "").slice(0, 12), 16);
  if (!Number.isFinite(timestampMs)) return 0;
  if (timestampMs < 946684800000 || timestampMs > 4102444800000) return 0;
  return timestampMs;
}

function turnIdentityTimestampMs(turn) {
  return uuidV7TimestampMs(turn && (turn.id || turn.turnId || turn.turn_id));
}

function turnCompletedAtMs(turn, thread = null) {
  if (!turn) return 0;
  const explicitCompletedAt = numericTimestampMs(turn.completedAtMs)
    || numericTimestampMs(turn.completedAt)
    || numericTimestampMs(turn.completed_at_ms)
    || numericTimestampMs(turn.completed_at)
    || numericTimestampMs(turn.finishedAt)
    || numericTimestampMs(turn.finished_at);
  if (explicitCompletedAt) return explicitCompletedAt;
  if (!isTurnComplete(turn)) return 0;
  const startedAt = turnStartedAtMs(turn);
  const fallback = numericTimestampMs(turn.updatedAt)
    || numericTimestampMs(turn.updated_at)
    || (turnIdentityTimestampMs(turn) ? 0 : numericTimestampMs(thread && (thread.updatedAt || thread.updated_at)));
  if (!fallback || (startedAt && fallback < startedAt)) return 0;
  return fallback;
}

function isRecentReplyJumpTurn(turn) {
  if (!turn) return false;
  if (isLiveTurn(turn)) return true;
  return isTurnComplete(turn);
}

function activateRecentCompletedReplyAnchorFromUserScroll() {
  const turn = currentLiveTurn() || latestTurn();
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  if (!threadId || !turn || !turn.id) return false;
  if (!isRecentReplyJumpTurn(turn)) return false;
  state.recentCompletedReplyAnchor = {
    threadId: String(threadId),
    turnId: String(turn.id),
    completedAtMs: Date.now(),
    activatedByCompletion: false,
    activatedByUserScroll: true,
    receiptStartLocated: false,
  };
  return true;
}

function updateRecentCompletedReplyAnchorFromScroll() {
  const el = $("conversation");
  if (!el) return;
  const currentTop = el.scrollTop;
  const previousTop = Number(state.conversationLastScrollTop || 0);
  const delta = currentTop - previousTop;
  state.conversationLastScrollTop = currentTop;
  noteConversationBottomState({ userIntent: hasRecentConversationScrollIntent() });
  if (Date.now() < state.programmaticScrollUntilMs) return;
  if (!hasRecentConversationScrollIntent()) return;
  if (delta < -2) {
    activateRecentCompletedReplyAnchorFromUserScroll();
  } else if (delta > 2 && !(state.recentCompletedReplyAnchor && state.recentCompletedReplyAnchor.activatedByCompletion)) {
    clearRecentCompletedReplyAnchor();
  }
}

function currentRecentCompletedReplyAnchor() {
  const anchor = state.recentCompletedReplyAnchor;
  if (!anchor) return null;
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  if (!threadId || anchor.threadId !== String(threadId)) return null;
  if (!anchor.activatedByUserScroll && !anchor.activatedByCompletion) return null;
  const turn = latestTurn();
  if (!turn || String(turn.id || "") !== anchor.turnId || (!isTurnComplete(turn) && !isLiveTurn(turn))) return null;
  return anchor;
}

function turnNodeForId(turnId) {
  const conversation = $("conversation");
  if (!conversation || !turnId) return null;
  return Array.from(conversation.querySelectorAll(".turn"))
    .find((node) => node.dataset.turn === String(turnId)) || null;
}

function turnFinalReceiptNode(anchor = currentRecentCompletedReplyAnchor()) {
  if (!anchor) return null;
  const turnNode = turnNodeForId(anchor.turnId);
  if (!turnNode) return null;
  const finalReceipts = Array.from(turnNode.querySelectorAll(".item.agentMessage, .item.plan"));
  if (finalReceipts.length) return finalReceipts[finalReceipts.length - 1];
  const fallbackItems = Array.from(turnNode.querySelectorAll(".item:not(.userMessage):not(.live-operation):not(.turnUsageSummary)"));
  if (fallbackItems.length) return fallbackItems[fallbackItems.length - 1];
  return turnNode;
}

function finalReceiptItemForTurn(turn) {
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item && (item.type === "agentMessage" || item.type === "plan")) return item;
  }
  return null;
}

function finalReceiptTextForTurn(turn) {
  const item = finalReceiptItemForTurn(turn);
  return String(item && item.text || "").trim();
}

function shouldScrollToLongReceiptStart(turn) {
  return Boolean(turn && isTurnComplete(turn) && finalReceiptTextForTurn(turn).length >= LONG_RECEIPT_SCROLL_CHARS);
}

function pendingCompletedReceiptStartTurnId() {
  const anchor = currentRecentCompletedReplyAnchor();
  if (!anchor || !anchor.activatedByCompletion || anchor.receiptStartLocated) return "";
  const turn = turnById(anchor.turnId);
  if (!shouldScrollToLongReceiptStart(turn)) return "";
  return String(anchor.turnId || "");
}

function scrollConversationToTurnReceiptStart(turnId) {
  if (!turnId) return;
  const target = turnFinalReceiptNode({ turnId });
  if (!target) return;
  clearSubmittedMessageBottomFollow();
  clearViewportBottomFollow();
  clearConversationNearBottomState();
  scrollNodeIntoConversationView(target);
  if (state.recentCompletedReplyAnchor && state.recentCompletedReplyAnchor.turnId === String(turnId)) {
    state.recentCompletedReplyAnchor.receiptStartLocated = true;
  }
  scheduleScrollToBottomButtonUpdate();
}

function scrollNodeIntoConversationView(node, margin = 12) {
  const el = $("conversation");
  if (!el || !node) return;
  const viewport = el.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  const target = el.scrollTop + rect.top - viewport.top - margin;
  markProgrammaticConversationScroll();
  el.scrollTop = Math.max(0, Math.min(target, Math.max(0, el.scrollHeight - el.clientHeight)));
  syncConversationScrollPosition();
}

function ensureUsageSummaryExpandedVisible(summary) {
  const el = $("conversation");
  if (!el || !summary || !summary.open) return;
  const adjust = () => {
    if (!summary.open || !summary.isConnected) return;
    const viewport = el.getBoundingClientRect();
    const rect = summary.getBoundingClientRect();
    const margin = 14;
    const availableHeight = Math.max(0, viewport.height - margin * 2);
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    let nextScrollTop = el.scrollTop;
    if (rect.height > availableHeight && rect.top < viewport.top + margin) {
      nextScrollTop += rect.top - viewport.top - margin;
    } else if (rect.bottom > viewport.bottom - margin) {
      nextScrollTop += rect.bottom - viewport.bottom + margin;
    }
    nextScrollTop = Math.max(0, Math.min(nextScrollTop, maxScrollTop));
    if (Math.abs(nextScrollTop - el.scrollTop) < 2) return;
    markProgrammaticConversationScroll();
    el.scrollTop = nextScrollTop;
    syncConversationScrollPosition();
    scheduleScrollToBottomButtonUpdate();
  };
  if (window.requestAnimationFrame) window.requestAnimationFrame(adjust);
  else window.setTimeout(adjust, 0);
  window.setTimeout(adjust, 160);
}

function handleUsageSummaryToggle(event) {
  const summary = event && event.target && event.target.closest
    ? event.target.closest(".turn-usage-summary")
    : null;
  if (!summary || !summary.open) return;
  ensureUsageSummaryExpandedVisible(summary);
}

function scrollConversationToTurnReply() {
  const target = turnFinalReceiptNode();
  if (!target) return;
  clearSubmittedMessageBottomFollow();
  clearViewportBottomFollow();
  clearConversationNearBottomState();
  scrollNodeIntoConversationView(target);
  clearRecentCompletedReplyAnchor();
  scheduleScrollToBottomButtonUpdate();
}

function isConversationNearBottom() {
  const el = $("conversation");
  if (!el) return true;
  return conversationScroll.isNearBottom({
    scrollHeight: el.scrollHeight,
    scrollTop: el.scrollTop,
    clientHeight: el.clientHeight,
  });
}

function updateScrollToBottomButton() {
  const button = $("scrollToBottom");
  const replyButton = $("scrollToTurnReply");
  const el = $("conversation");
  if (!button || !el) return;
  const isScrollable = el.scrollHeight - el.clientHeight > 128;
  const replyAnchor = replyButton ? currentRecentCompletedReplyAnchor() : null;
  const replyNode = replyButton ? turnFinalReceiptNode(replyAnchor) : null;
  const jumpPlan = conversationScroll.planConversationJumpButtons({
    hasThread: Boolean(state.currentThread),
    loading: Boolean(state.currentThread && state.currentThread.mobileLoading),
    loadError: Boolean(state.currentThread && state.currentThread.mobileLoadError),
    isScrollable,
    nearBottom: isConversationNearBottom(),
    hasReplyTarget: Boolean(replyNode),
    replyTargetAbove: Boolean(replyNode && isNodeStartAboveConversationViewport(replyNode)),
  });
  const shouldShow = Boolean(jumpPlan.showBottom);
  button.classList.toggle("hidden", !shouldShow);
  button.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  button.tabIndex = shouldShow ? 0 : -1;
  if (!replyButton) return;
  const shouldShowReply = Boolean(jumpPlan.showReply);
  replyButton.classList.toggle("hidden", !shouldShowReply);
  replyButton.setAttribute("aria-hidden", shouldShowReply ? "false" : "true");
  replyButton.tabIndex = shouldShowReply ? 0 : -1;
}

function scheduleScrollToBottomButtonUpdate() {
  if (state.scrollToBottomFrame) return;
  const update = () => {
    state.scrollToBottomFrame = null;
    updateScrollToBottomButton();
  };
  if (window.requestAnimationFrame) {
    state.scrollToBottomFrame = window.requestAnimationFrame(update);
  } else {
    state.scrollToBottomFrame = setTimeout(update, 33);
  }
}


(function exposeCodexEventStreamRuntime(root) {
  root.CodexEventStreamRuntime = root.CodexEventStreamRuntime || {
    createEventStreamRuntime: function createEventStreamRuntime() {
      return {
      connectEvents: typeof connectEvents === "function" ? connectEvents : null,
      applyNotification: typeof applyNotification === "function" ? applyNotification : null,
      resumeMobileSession: typeof resumeMobileSession === "function" ? resumeMobileSession : null,
      scrollConversationToBottom: typeof scrollConversationToBottom === "function" ? scrollConversationToBottom : null,
      updateScrollToBottomButton: typeof updateScrollToBottomButton === "function" ? updateScrollToBottomButton : null,
      };
    },
  };
})(window);
