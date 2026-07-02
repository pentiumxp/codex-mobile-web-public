"use strict";

function handleLaunchTargetUrl(targetUrl) {
  const threadId = threadIdFromUrlValue(targetUrl);
  postClientEvent("launch_target", {
    hasThread: Boolean(threadId),
    pwa: isPwaMode(),
  });
  if (threadId) {
    openExternalThreadSelection(threadId).catch(showError);
    return;
  }
  scheduleMobileResume("launch-target", 120);
}

function installLaunchQueueHandler() {
  const launchQueue = window.launchQueue;
  if (!launchQueue || typeof launchQueue.setConsumer !== "function") return;
  try {
    launchQueue.setConsumer((launchParams) => {
      if (!launchParams || !launchParams.targetURL) return;
      handleLaunchTargetUrl(launchParams.targetURL);
    });
    postClientEvent("launch_queue_ready", { pwa: isPwaMode() });
  } catch (err) {
    postClientEvent("launch_queue_failed", { message: err.message || String(err) });
  }
}

function loadWorkspaces(...args) {
  return threadListRuntime.loadWorkspaces(...args);
}
function workspaceSidebarOptionsHtml(...args) {
  return threadListRuntime.workspaceSidebarOptionsHtml(...args);
}
function syncSidebarWorkspaceSelect(...args) {
  return threadListRuntime.syncSidebarWorkspaceSelect(...args);
}
function workspaceOptionsHtml(...args) {
  return threadListRuntime.workspaceOptionsHtml(...args);
}
function newThreadWorkspaceOptionsHtml(...args) {
  return threadListRuntime.newThreadWorkspaceOptionsHtml(...args);
}
function newThreadChoiceOptionsHtml(...args) {
  return threadListRuntime.newThreadChoiceOptionsHtml(...args);
}
function selectedWorkspaceLabel(...args) {
  return threadListRuntime.selectedWorkspaceLabel(...args);
}
function fitWorkspaceMenuToViewport(...args) {
  return threadListRuntime.fitWorkspaceMenuToViewport(...args);
}
function updateWorkspacePath(...args) {
  return threadListRuntime.updateWorkspacePath(...args);
}
function renderWorkspaceTokenUsage(...args) {
  return threadListRuntime.renderWorkspaceTokenUsage(...args);
}
function tokenBreakdownHtml(...args) {
  return threadListRuntime.tokenBreakdownHtml(...args);
}
function renderWorkspaceStatsDialog(...args) {
  return threadListRuntime.renderWorkspaceStatsDialog(...args);
}
function openWorkspaceStatsDialog(...args) {
  return threadListRuntime.openWorkspaceStatsDialog(...args);
}
function closeWorkspaceStatsDialog(...args) {
  return threadListRuntime.closeWorkspaceStatsDialog(...args);
}
function clearCurrentThreadSelection(...args) {
  return threadListRuntime.clearCurrentThreadSelection(...args);
}
function renderThreadListLoading(...args) {
  return threadListRuntime.renderThreadListLoading(...args);
}
function hasThreadDetailSelectionIntent(...args) {
  return threadListRuntime.hasThreadDetailSelectionIntent(...args);
}
function shouldRenderPrimaryConversationShell(...args) {
  return threadListRuntime.shouldRenderPrimaryConversationShell(...args);
}
function clearThreadListDeferredFallbackTimer(...args) {
  return threadListRuntime.clearThreadListDeferredFallbackTimer(...args);
}
function clearThreadListDeferredSilentTimer(...args) {
  return threadListRuntime.clearThreadListDeferredSilentTimer(...args);
}
function hasThreadDetailRequestInFlight(...args) {
  return threadListRuntime.hasThreadDetailRequestInFlight(...args);
}
function scheduleThreadListDeferredFallback(...args) {
  return threadListRuntime.scheduleThreadListDeferredFallback(...args);
}
function scheduleThreadListDeferredSilentRefresh(...args) {
  return threadListRuntime.scheduleThreadListDeferredSilentRefresh(...args);
}
function loadThreads(...args) {
  return threadListRuntime.loadThreads(...args);
}
function clearThreadLoadWatchdog() {
  if (!state.threadLoadWatchdogTimer) return;
  clearTimeout(state.threadLoadWatchdogTimer);
  state.threadLoadWatchdogTimer = null;
}

function startThreadLoadWatchdog(threadId, details = {}) {
  clearThreadLoadWatchdog();
  const seq = state.threadLoadSeq;
  const startedAt = nowPerfMs();
  state.threadLoadWatchdogTimer = setTimeout(() => {
    state.threadLoadWatchdogTimer = null;
    if (seq !== state.threadLoadSeq || state.currentThreadId !== threadId) return;
    if (!state.currentThread || !state.currentThread.mobileLoading) return;
    postClientEvent("thread_switch_stall", Object.assign({
      threadId,
      elapsedMs: roundedDurationMs(startedAt),
      connectionText: $("connectionState") ? $("connectionState").textContent : "",
      eventOpen: Boolean(state.events && state.events.readyState === EventSource.OPEN),
    }, details || {}));
    recordHomeAiDiagnosticFailure(threadDiagnosticEventsApi.threadDetailSlowPathDiagnosticEvent({
      action: "thread-detail-load",
      reason: "api-pending",
      severityHint: "H2",
      thresholdMs: THREAD_LOAD_STALL_MS,
      elapsedMs: roundedDurationMs(startedAt),
      apiElapsedMs: roundedDurationMs(startedAt),
      renderElapsedMs: 0,
      source: String(details && details.source || "thread-load-watchdog").slice(0, 40),
      threadHash: diagnosticThreadHash(threadId),
      durationBucket: diagnosticDurationBucket(roundedDurationMs(startedAt)),
    }));
    $("connectionState").textContent = "Loading thread is slow, retrying...";
    refreshCurrentThread({ source: "thread-switch-stall" }).catch((err) => {
      postClientEvent("thread_switch_stall_retry_failed", {
        threadId,
        error: err && err.message ? err.message : String(err),
      });
    });
  }, THREAD_LOAD_STALL_MS);
}

async function loadThread(threadId, options = {}) {
  saveCurrentDraftNow();
  flushSideChatDraftNow().catch(() => {});
  state.newThreadDraft = false;
  state.newThreadTitle = "";
  const switchStartedAt = nowPerfMs();
  const fromThreadId = state.currentThreadId || "";
  const source = String(options.source || "unknown").slice(0, 40);
  const suppressLoadFailureDiagnostic = options.suppressLoadFailureDiagnostic === true;
  if (threadId !== fromThreadId) resetComposerRuntimeSelection();
  if (threadId !== fromThreadId) {
    state.subagentPanelOpen = false;
    cancelSubagentSwipe();
    updateSubagentPanelUi();
  }
  const listAgeMs = state.threadListLoadedAtMs ? Date.now() - state.threadListLoadedAtMs : null;
  const startEventPlan = threadDetailRenderPlanApi.planThreadDetailSwitchStartClientEvent({
    source,
    fromThreadId,
    toThreadId: threadId || "",
    listAgeMs,
    currentHadThread: Boolean(state.currentThread),
    eventOpen: Boolean(state.events && state.events.readyState === EventSource.OPEN),
  });
  applyThreadDetailSwitchClientEventPlan(startEventPlan);
  if (threadId && threadId !== state.continuationSourceThreadId) {
    state.continuationSourceThreadId = "";
  }
  const replacedTilePaneForThreadListOpen = replaceLastThreadTilePaneForThreadListOpen(threadId, { source });
  const cacheReusePlan = planThreadOpenCacheReuse({
    requestedThreadId: threadId,
    currentThreadId: state.currentThreadId,
    currentThread: state.currentThread,
    summaryThread: state.threads.find((thread) => thread && thread.id === threadId),
  });
  if (cacheReusePlan.shouldReportEmptyCachedDetail) {
    recordEmptyCachedDetailReuseBlocked(cacheReusePlan.reason, state.currentThread, { source });
  }
  if (cacheReusePlan.shouldUseCachedCurrent) {
    const renderStartedAt = nowPerfMs();
    const postMergePlan = threadDetailRenderPlanApi.planThreadDetailRefreshPostMergeEffects();
    followThreadOpenToBottom(threadId);
    applyThreadDetailRefreshPostMergeEffectsGroup(postMergePlan, "merge");
    const threadListRenderMs = applyThreadDetailRefreshTimedPostMergeEffectsGroup(postMergePlan, "thread-list-render");
    const conversationRenderStartedAt = nowPerfMs();
    renderCurrentThread({ stickToBottom: true });
    const conversationRenderMs = roundedDurationMs(conversationRenderStartedAt);
    const cachedCurrentPostRenderPlan = threadDetailRenderPlanApi.planThreadDetailCachedCurrentPostRenderEffects({
      threadId,
      seq: state.threadLoadSeq,
      source: "cached-current",
      replacedTilePane: replacedTilePaneForThreadListOpen,
      hasSideChat: state.threadSideChats.has(threadId),
    });
    applyThreadDetailPostRenderEffectsPlan(cachedCurrentPostRenderPlan, { thread: state.currentThread });
    const renderElapsedMs = roundedDurationMs(renderStartedAt);
    const cachedFirstPaintReportingStage = threadDetailRenderPlanApi.planThreadDetailFirstPaintReportingStage({
      source,
      threadId,
      detailRenderMode: "cached-current",
      cached: true,
      timings: {
        elapsedMs: roundedDurationMs(switchStartedAt),
        apiElapsedMs: 0,
        renderElapsedMs,
        threadListRenderMs,
        conversationRenderMs,
      },
      threadHash: diagnosticThreadHash(threadId),
    });
    const firstPaintPerformance = threadPerformanceMetrics.threadDetailFirstPaintEventFields(
      state.currentThread,
      cachedFirstPaintReportingStage.performanceInput,
    );
    const cachedTelemetryPlan = threadDetailRenderPlanApi.planThreadDetailCachedCurrentTelemetryEffects(Object.assign({
      performanceEvent: firstPaintPerformance,
    }, cachedFirstPaintReportingStage.telemetryInput));
    applyThreadDetailFirstPaintTelemetryEffectsPlan(cachedTelemetryPlan, { thread: state.currentThread });
    if (cacheReusePlan.shouldRefreshCurrent) {
      scheduleCurrentThreadRefresh(0, cacheReusePlan.reason || "cached-current-refresh");
    }
    return;
  }
  const seq = state.threadLoadSeq + 1;
  state.threadLoadSeq = seq;
  state.sendButtonHint = "";
  state.threadHistoryBusy = false;
  state.threadHistoryError = "";
  clearRecentCompletedReplyAnchor();
  clearConversationAutoScrollHold();
  abortCurrentThreadRefresh();
  if (state.threadLoadController) state.threadLoadController.abort();
  const controller = new AbortController();
  state.threadLoadController = controller;
  clearTimeout(state.pollTimer);
  markThreadViewed(threadId);
  const summary = state.threads.find((thread) => thread.id === threadId);
  const cachedThread = state.threadTileDetails && state.threadTileDetails.get(threadId);
  const cachedDetailOpenPlan = planThreadOpenCacheReuse({
    requestedThreadId: threadId,
    currentThreadId: threadId,
    currentThread: cachedThread,
    summaryThread: summary,
  });
  const activePreviewThread = cachedDetailOpenPlan.shouldUseActivePreview
    ? threadDetailStateApi.activeDetailLoadingPreviewThread(cachedThread)
    : null;
  const loadingShellPlan = cachedDetailOpenPlan.shouldUseCachedCurrent
    ? { currentThreadId: threadId, thread: cachedThread, reason: "cached-detail-first-paint" }
    : activePreviewThread
      ? { currentThreadId: threadId, thread: activePreviewThread, reason: "active-detail-cache-preview" }
    : threadDetailStateApi.planThreadOpenLoadingShell({ threadId, summaryThread: summary });
  state.currentThreadId = loadingShellPlan.currentThreadId || threadId;
  state.startupThreadOpenPending = false;
  state.currentThread = loadingShellPlan.thread || {
    id: threadId,
    name: threadId,
    preview: threadId,
    turns: [],
    mobileLoading: true,
    mobileLoadError: "",
  };
  if (cachedDetailOpenPlan.shouldUseCachedCurrent || activePreviewThread) {
    const cachedPreRenderPlan = threadDetailRenderPlanApi.planThreadDetailFirstPaintPreRenderEffects({
      threadId,
      hasEvents: Boolean(state.events),
    });
    applyThreadDetailPostRenderEffectsPlan(cachedPreRenderPlan, { thread: state.currentThread });
    const cachedDraftRestorePlan = threadDetailRenderPlanApi.planThreadDetailFirstPaintDraftRestoreEffects();
    applyThreadDetailPostRenderEffectsPlan(cachedDraftRestorePlan, { thread: state.currentThread });
    syncActiveTurnFromThread();
    renderThreads();
    renderCurrentThread({ stickToBottom: true });
    const cachedCurrentPostRenderPlan = threadDetailRenderPlanApi.planThreadDetailCachedCurrentPostRenderEffects({
      threadId,
      seq,
      source: activePreviewThread ? "active-detail-cache-preview" : "cached-detail-first-paint",
      replacedTilePane: replacedTilePaneForThreadListOpen,
      hasSideChat: state.threadSideChats.has(threadId),
    });
    applyThreadDetailPostRenderEffectsPlan(cachedCurrentPostRenderPlan, { thread: state.currentThread });
    updateComposerControls();
    publishPluginNavigationState({ force: true });
    $("connectionState").classList.remove("error");
    $("connectionState").textContent = "Refreshing thread";
    markActivity("刷新线程");
  } else {
    const loadingShellPostStatePlan = threadDetailRenderPlanApi.planThreadDetailLoadingShellPostStateEffects({
      threadId,
      source,
    });
    applyThreadDetailPostRenderEffectsPlan(loadingShellPostStatePlan, { thread: state.currentThread });
  }
  let result;
  const apiStartedAt = nowPerfMs();
  try {
    result = await api(threadDetailApiPath(threadId, { mode: "recent" }), {
      timeoutMs: 20000,
      signal: controller.signal,
    });
  } catch (err) {
    if (seq !== state.threadLoadSeq || controller.signal.aborted) {
      const cancelledEventPlan = threadDetailRenderPlanApi.planThreadDetailSwitchCancelledClientEvent({
        source,
        threadId,
        elapsedMs: roundedDurationMs(switchStartedAt),
        apiElapsedMs: roundedDurationMs(apiStartedAt),
      });
      applyThreadDetailSwitchClientEventPlan(cancelledEventPlan);
      return;
    }
    const loadErrorPlan = threadDetailRenderPlanApi.planThreadDetailLoadErrorEffects({
      threadId,
      errorMessage: err.message || String(err),
    });
    applyThreadDetailPostRenderEffectsPlan(loadErrorPlan, { thread: state.currentThread });
    const errorEventPlan = threadDetailRenderPlanApi.planThreadDetailSwitchErrorClientEvent({
      source,
      threadId,
      elapsedMs: roundedDurationMs(switchStartedAt),
      apiElapsedMs: roundedDurationMs(apiStartedAt),
      error: err.message || String(err),
    });
    applyThreadDetailSwitchClientEventPlan(errorEventPlan);
    if (suppressLoadFailureDiagnostic) {
      postClientEvent("thread_detail_load_failure_diagnostic_suppressed", {
        source,
        threadHash: diagnosticThreadHash(threadId),
        errorCode: diagnosticErrorCode(err, "thread_detail_load_failed"),
        statusCode: diagnosticErrorStatus(err),
        durationBucket: diagnosticDurationBucket(roundedDurationMs(switchStartedAt)),
      });
    } else {
      recordHomeAiDiagnosticFailure(threadDiagnosticEventsApi.threadDetailLoadFailedDiagnosticEvent({
        errorCode: diagnosticErrorCode(err, "thread_detail_load_failed"),
        durationBucket: diagnosticDurationBucket(roundedDurationMs(switchStartedAt)),
        statusCode: diagnosticErrorStatus(err),
        threadHash: diagnosticThreadHash(threadId),
      }));
    }
    throw err;
  } finally {
    clearThreadLoadWatchdog();
    if (state.threadLoadController === controller) state.threadLoadController = null;
  }
  const apiElapsedMs = roundedDurationMs(apiStartedAt);
  if (seq !== state.threadLoadSeq || state.currentThreadId !== threadId) {
    const cancelledEventPlan = threadDetailRenderPlanApi.planThreadDetailSwitchCancelledClientEvent({
      source,
      threadId,
      elapsedMs: roundedDurationMs(switchStartedAt),
      apiElapsedMs,
    });
    applyThreadDetailSwitchClientEventPlan(cancelledEventPlan);
    return;
  }
  const renderStartedAt = nowPerfMs();
  const mergeStartedAt = nowPerfMs();
  const firstPaintResponsePlan = threadDetailRenderPlanApi.planThreadDetailFirstPaintResponseEffects({
    source,
  });
  applyThreadDetailRefreshResponseEffectsPlan(firstPaintResponsePlan, { thread: result.thread });
  const postMergePlan = threadDetailRenderPlanApi.planThreadDetailRefreshPostMergeEffects();
  const firstPaintPostMergeTimingPlan = threadDetailRenderPlanApi.planThreadDetailFirstPaintPostMergeTimingEffects(postMergePlan);
  if (!firstPaintPostMergeTimingPlan.ok) {
    throw new Error(`Thread detail first-paint post-merge timing metadata invalid: ${firstPaintPostMergeTimingPlan.reason || "unknown"}`);
  }
  const firstPaintPostMergeTimings = applyThreadDetailRefreshTimedPostMergeEntries(
    postMergePlan,
    firstPaintPostMergeTimingPlan.beforeDraftRestore,
    Object.assign({}, firstPaintPostMergeTimingPlan.timings),
    { mergeStartedAt },
  );
  const firstPaintPreRenderPlan = threadDetailRenderPlanApi.planThreadDetailFirstPaintPreRenderEffects({
    threadId,
    hasEvents: Boolean(state.events),
  });
  applyThreadDetailPostRenderEffectsPlan(firstPaintPreRenderPlan, { thread: state.currentThread });
  const mergeMs = firstPaintPostMergeTimings.mergeMs;
  const draftRestoreStartedAt = nowPerfMs();
  const firstPaintDraftRestorePlan = threadDetailRenderPlanApi.planThreadDetailFirstPaintDraftRestoreEffects();
  applyThreadDetailPostRenderEffectsPlan(firstPaintDraftRestorePlan, { thread: state.currentThread });
  const draftRestoreMs = roundedDurationMs(draftRestoreStartedAt);
  applyThreadDetailRefreshTimedPostMergeEntries(
    postMergePlan,
    firstPaintPostMergeTimingPlan.afterDraftRestore,
    firstPaintPostMergeTimings,
  );
  const composerRenderMs = firstPaintPostMergeTimings.composerRenderMs;
  const threadListRenderMs = firstPaintPostMergeTimings.threadListRenderMs;
  const conversationRenderStartedAt = nowPerfMs();
  renderCurrentThread({ stickToBottom: true });
  const conversationRenderMs = roundedDurationMs(conversationRenderStartedAt);
  const firstPaintAfterRenderPlan = threadDetailRenderPlanApi.planThreadDetailFirstPaintAfterRenderEffects({
    seq,
    source: "first-paint",
  });
  applyThreadDetailPostRenderEffectsPlan(firstPaintAfterRenderPlan, { thread: state.currentThread });
  const postRenderStartedAt = nowPerfMs();
  const firstPaintPostRenderPlan = threadDetailRenderPlanApi.planThreadDetailFirstPaintPostRenderEffects({
    threadId,
    seq,
    source,
  });
  applyThreadDetailPostRenderEffectsPlan(firstPaintPostRenderPlan, { thread: result.thread });
  const postRenderMs = roundedDurationMs(postRenderStartedAt);
  const firstPaintPostTimingPlan = threadDetailRenderPlanApi.planThreadDetailFirstPaintPostTimingEffects();
  applyThreadDetailPostRenderEffectsPlan(firstPaintPostTimingPlan, { thread: result.thread });
  const renderElapsedMs = roundedDurationMs(renderStartedAt);
  const firstPaintReportingStage = threadDetailRenderPlanApi.planThreadDetailFirstPaintReportingStage({
    source,
    threadId,
    detailRenderMode: "first-paint",
    cached: false,
    timings: {
      elapsedMs: roundedDurationMs(switchStartedAt),
      apiElapsedMs,
      renderElapsedMs,
      mergeMs,
      draftRestoreMs,
      composerRenderMs,
      threadListRenderMs,
      conversationRenderMs,
      postRenderMs,
    },
    readMode: result.thread && result.thread.mobileReadMode || "",
    status: statusText(result.thread && result.thread.status),
    turns: Array.isArray(result.thread && result.thread.turns) ? result.thread.turns.length : 0,
    omittedTurns: Number(result.thread && result.thread.mobileOmittedTurnCount || 0),
    rolloutSizeBytes: rolloutSizeBytes(result.thread),
    threadHash: diagnosticThreadHash(threadId),
  });
  const firstPaintPerformance = threadPerformanceMetrics.threadDetailFirstPaintEventFields(
    result.thread,
    firstPaintReportingStage.performanceInput,
  );
  const firstPaintTelemetryPlan = threadDetailRenderPlanApi.planThreadDetailFirstPaintTelemetryEffects(Object.assign({
    performanceEvent: firstPaintPerformance,
  }, firstPaintReportingStage.telemetryInput));
  applyThreadDetailFirstPaintTelemetryEffectsPlan(firstPaintTelemetryPlan, { thread: result.thread });
}

function isSuccessfulCompletedTurn(turn) {
  const text = statusText(turn && turn.status).toLowerCase();
  if (!text || /interrupt|fail|cancel|error|running|active|progress|pending|inprogress|in_progress|in-progress/.test(text)) return false;
  return /completed|success|succeeded|done|finished|closed/.test(text);
}

function turnHasUsageSummary(turn) {
  return Array.isArray(turn && turn.items)
    && turn.items.some((item) => item && item.type === "turnUsageSummary");
}

function latestSuccessfulCompletedTurnMissingUsage() {
  const turns = state.currentThread && Array.isArray(state.currentThread.turns)
    ? state.currentThread.turns
    : [];
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (!isSuccessfulCompletedTurn(turn)) continue;
    return turnHasUsageSummary(turn) ? null : turn;
  }
  return null;
}

function clearUsageBackfillRefresh() {
  clearTimeout(state.usageBackfillTimer);
  state.usageBackfillTimer = null;
  state.usageBackfillKey = "";
  state.usageBackfillAttempts = 0;
}

function scheduleUsageBackfillRefresh(delay = 1200) {
  if (!state.currentThreadId || document.visibilityState === "hidden") return;
  const turn = latestSuccessfulCompletedTurnMissingUsage();
  if (!turn || !turn.id) {
    clearUsageBackfillRefresh();
    return;
  }
  const key = `${state.currentThreadId}|${turn.id}`;
  if (state.usageBackfillKey !== key) {
    clearTimeout(state.usageBackfillTimer);
    state.usageBackfillTimer = null;
    state.usageBackfillKey = key;
    state.usageBackfillAttempts = 0;
  }
  if (state.usageBackfillAttempts >= 6 || state.usageBackfillTimer) return;
  if (shouldSuppressAutomaticCurrentThreadRefresh("usage-backfill")) return;
  state.usageBackfillAttempts += 1;
  state.usageBackfillTimer = setTimeout(() => {
    state.usageBackfillTimer = null;
    if (document.visibilityState === "hidden") return;
    if (!state.currentThreadId || `${state.currentThreadId}|${turn.id}` !== state.usageBackfillKey) return;
    if (shouldSuppressAutomaticCurrentThreadRefresh("usage-backfill")) return;
    refreshCurrentThread({ source: "usage-backfill" }).catch(showError);
  }, delay);
}

function applyThreadDetailRefreshMetadataEffect(effect) {
  const key = String(effect || "");
  if (key === "update-current-thread-header") {
    updateCurrentThreadHeader(state.currentThread);
    return true;
  }
  if (key === "update-live-operation-dock") {
    updateLiveOperationDockHtml(renderLiveOperationDock(state.currentThread, existingConversationRenderKeys()));
    return true;
  }
  if (key === "update-tick-timer") {
    updateTickTimer();
    return true;
  }
  if (key === "publish-plugin-navigation-state") {
    publishPluginNavigationState();
    return true;
  }
  if (key === "schedule-scroll-button-update") {
    scheduleScrollToBottomButtonUpdate();
    return true;
  }
  throw new Error(`Unknown thread detail refresh metadata effect: ${key || "empty"}`);
}

function applyThreadDetailRefreshCompletionEffect(effect) {
  const item = effect && typeof effect === "object" ? effect : {};
  const type = String(item.type || "");
  if (type === "diagnostic-success") {
    recordHomeAiDiagnosticSuccess(item.payload || {});
    return true;
  }
  if (type === "schedule-usage-backfill-refresh") {
    scheduleUsageBackfillRefresh();
    return true;
  }
  if (type === "schedule-live-poll") {
    scheduleLivePollIfNeeded();
    return true;
  }
  throw new Error(`Unknown thread detail refresh completion effect: ${type || "empty"}`);
}

function applyThreadDetailRefreshCompletionEffectsPlan(plan) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  for (const effect of effects) applyThreadDetailRefreshCompletionEffect(effect);
}

function applyThreadDetailPostRenderEffect(effect, context = {}) {
  const item = effect && typeof effect === "object" ? effect : {};
  const type = String(item.type || "");
  if (type === "persist-current-thread-id") {
    const threadId = String(item.threadId || "");
    if (threadId) localStorage.setItem(STORAGE_THREAD_ID, threadId);
    return true;
  }
  if (type === "clear-draft-target-key") {
    draftStore.setTargetKey("");
    return true;
  }
  if (type === "follow-thread-open-to-bottom") {
    followThreadOpenToBottom(String(item.threadId || ""));
    return true;
  }
  if (type === "restore-draft-for-current-target") {
    restoreDraftForCurrentTarget();
    return true;
  }
  if (type === "render-composer-settings") {
    renderComposerSettings();
    return true;
  }
  if (type === "sync-active-turn-from-thread") {
    syncActiveTurnFromThread();
    return true;
  }
  if (type === "connect-events") {
    connectEvents();
    return true;
  }
  if (type === "render-thread-list") {
    renderThreads();
    return true;
  }
  if (type === "render-current-thread") {
    const options = item.options && typeof item.options === "object" ? item.options : {};
    renderCurrentThread({ stickToBottom: Boolean(options.stickToBottom) });
    return true;
  }
  if (type === "set-current-thread-load-error") {
    const threadId = String(item.threadId || state.currentThreadId || "");
    state.currentThread = Object.assign({}, state.currentThread || {
      id: threadId,
      name: threadId,
      preview: threadId,
      turns: [],
    }, {
      mobileLoading: false,
      mobileLoadError: String(item.errorMessage || ""),
    });
    return true;
  }
  if (type === "publish-plugin-navigation-state") {
    publishPluginNavigationState({ force: Boolean(item.force) });
    return true;
  }
  if (type === "restore-connection-state") {
    restoreConnectionState();
    return true;
  }
  if (type === "schedule-live-poll") {
    const delayMs = Number(item.delayMs);
    scheduleLivePollIfNeeded(Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : undefined);
    return true;
  }
  if (type === "update-composer-controls") {
    updateComposerControls();
    return true;
  }
  if (type === "history-auto-backfill") {
    maybeAutoBackfillThreadHistory(context.thread, {
      seq: Number(item.seq || 0),
      source: String(item.source || "unknown").slice(0, 40),
    });
    return true;
  }
  if (type === "restore-composer-for-replaced-tile-pane") {
    restoreDraftForCurrentTarget({ resetRuntimeWhenMissingDraft: true });
    renderComposerSettings();
    updateComposerControls();
    return true;
  }
  if (type === "close-sidebar-menu-if-overlay") {
    if (isMenuOverlayMode()) closeSidebarMenu();
    return true;
  }
  if (type === "check-conversation-projection-consistency") {
    checkConversationProjectionConsistency(String(item.phase || ""), {
      renderMode: String(item.renderMode || ""),
    });
    return true;
  }
  if (type === "record-empty-cached-detail-reuse-healthy") {
    recordEmptyCachedDetailReuseHealthy(String(item.reason || ""), context.thread);
    return true;
  }
  if (type === "load-side-chat") {
    const sideChatThreadId = String(item.threadId || "");
    if (sideChatThreadId) loadSideChat(sideChatThreadId, { silent: item.silent !== false }).catch(showError);
    return true;
  }
  if (type === "set-connection-state") {
    const element = $("connectionState");
    const removeClass = String(item.removeClass || "");
    if (removeClass) element.classList.remove(removeClass);
    element.textContent = String(item.text || "");
    return true;
  }
  if (type === "mark-activity") {
    markActivity(String(item.label || ""));
    return true;
  }
  if (type === "start-thread-load-watchdog") {
    startThreadLoadWatchdog(String(item.threadId || ""), { source: String(item.source || "").slice(0, 40) });
    return true;
  }
  if (type === "backfill-full-thread-detail-if-needed") {
    if (shouldBackfillFullThreadDetail(context.thread)) {
      backfillFullThreadDetail(String(item.threadId || ""), {
        seq: Number(item.seq || 0),
        source: String(item.source || "").slice(0, 40),
      }).catch(() => {});
    }
    return true;
  }
  if (type === "schedule-usage-backfill-refresh") {
    scheduleUsageBackfillRefresh();
    return true;
  }
  throw new Error(`Unknown thread detail post-render effect: ${type || "empty"}`);
}

function applyThreadDetailPostRenderEffectsPlan(plan, context = {}) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  for (const effect of effects) applyThreadDetailPostRenderEffect(effect, context);
}

function applyThreadDetailFirstPaintTelemetryEffect(effect, context = {}) {
  const item = effect && typeof effect === "object" ? effect : {};
  const type = String(item.type || "");
  if (type === "post-performance-event") {
    postPerformanceEvent(String(item.eventName || ""), item.payload || {}, item.options || {});
    return true;
  }
  if (type === "record-thread-detail-response-diagnostics") {
    const eventContext = item.context && typeof item.context === "object" ? item.context : {};
    recordThreadDetailResponseDiagnostics(item.performanceEvent || {}, {
      action: String(eventContext.action || ""),
      threadId: String(eventContext.threadId || ""),
      thread: context.thread,
    });
    return true;
  }
  if (type === "post-client-event") {
    postClientEvent(String(item.eventName || ""), item.payload || {});
    return true;
  }
  if (type === "diagnostic-success") {
    recordHomeAiDiagnosticSuccess(item.payload || {});
    return true;
  }
  throw new Error(`Unknown thread detail first-paint telemetry effect: ${type || "empty"}`);
}

function applyThreadDetailFirstPaintTelemetryEffectsPlan(plan, context = {}) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  for (const effect of effects) applyThreadDetailFirstPaintTelemetryEffect(effect, context);
}

function applyThreadDetailSwitchClientEventEffect(effect) {
  const item = effect && typeof effect === "object" ? effect : {};
  const type = String(item.type || "");
  if (type === "post-client-event") {
    postClientEvent(String(item.eventName || ""), item.payload || {});
    return true;
  }
  throw new Error(`Unknown thread detail switch client event effect: ${type || "empty"}`);
}

function applyThreadDetailSwitchClientEventPlan(plan) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  for (const effect of effects) applyThreadDetailSwitchClientEventEffect(effect);
}

function applyThreadDetailRefreshPostMergeEffect(effect) {
  const key = String(effect || "");
  if (key === "merge-thread-list") {
    mergeThreadIntoThreadList(state.currentThread);
    return true;
  }
  if (key === "render-composer-settings") {
    renderComposerSettings();
    return true;
  }
  if (key === "sync-active-turn") {
    syncActiveTurnFromThread();
    return true;
  }
  if (key === "render-threads") {
    renderThreads();
    return true;
  }
  throw new Error(`Unknown thread detail refresh post-merge effect: ${key || "empty"}`);
}

function applyThreadDetailRefreshPostMergeEffectsGroup(plan, timing) {
  const groups = Array.isArray(plan && plan.groups) ? plan.groups : [];
  const group = groups.find((item) => item && item.timing === timing);
  const effects = group && Array.isArray(group.effects) ? group.effects : [];
  if (!effects.length) throw new Error(`Thread detail refresh post-merge effects missing for ${timing}`);
  for (const effect of effects) applyThreadDetailRefreshPostMergeEffect(effect);
}

function applyThreadDetailRefreshTimedPostMergeEffectsGroup(plan, timing, options = {}) {
  const startedAt = Number.isFinite(options.startedAt) ? options.startedAt : nowPerfMs();
  applyThreadDetailRefreshPostMergeEffectsGroup(plan, timing);
  return roundedDurationMs(startedAt);
}

function applyThreadDetailRefreshTimedPostMergeEntries(plan, entries, timings, options = {}) {
  const result = timings && typeof timings === "object" ? timings : {};
  const list = Array.isArray(entries) ? entries : [];
  for (const entry of list) {
    const timing = String(entry && entry.timing || "");
    const field = String(entry && entry.field || "");
    if (!timing || !field) throw new Error("Thread detail refresh post-merge timing entry missing");
    const startedAt = timing === "merge" && Number.isFinite(options.mergeStartedAt)
      ? options.mergeStartedAt
      : nowPerfMs();
    result[field] = applyThreadDetailRefreshTimedPostMergeEffectsGroup(plan, timing, { startedAt });
  }
  return result;
}

function applyThreadDetailRefreshTimedPostMergeEffectsPlan(plan, options = {}) {
  const timingFieldsPlan = threadDetailRenderPlanApi.planThreadDetailRefreshPostMergeTimingFields(plan);
  if (!timingFieldsPlan.ok) {
    throw new Error(`Thread detail refresh post-merge timing metadata invalid: ${timingFieldsPlan.reason || "unknown"}`);
  }
  return applyThreadDetailRefreshTimedPostMergeEntries(
    plan,
    timingFieldsPlan.entries,
    Object.assign({}, timingFieldsPlan.timings),
    options,
  );
}

function applyThreadDetailRefreshResponseEffect(effect, context = {}) {
  const item = effect && typeof effect === "object" ? effect : {};
  const type = String(item.type || "");
  const thread = context.thread;
  if (type === "mark-thread-detail-loaded") {
    markThreadDetailLoaded(thread);
    return true;
  }
  if (type === "remember-render-evidence") {
    rememberThreadDetailRenderEvidence(thread, String(item.source || "refresh-detail-api"));
    return true;
  }
  if (type === "sync-pending-server-requests") {
    syncThreadPendingServerRequests(thread);
    return true;
  }
  if (type === "merge-current-thread") {
    state.currentThread = mergeThreadPreservingVisibleItems(state.currentThread, thread);
    rememberReusableThreadDetail(state.currentThread);
    return true;
  }
  throw new Error(`Unknown thread detail refresh response effect: ${type || "empty"}`);
}

function applyThreadDetailRefreshResponseEffectsPlan(plan, context = {}) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  for (const effect of effects) applyThreadDetailRefreshResponseEffect(effect, context);
}

function applyThreadDetailRefreshExecutionEffect(effect) {
  const item = effect && typeof effect === "object" ? effect : {};
  const type = String(item.type || "");
  if (type === "metadata-effects") {
    const metadataEffects = Array.isArray(item.metadataEffects) ? item.metadataEffects : [];
    if (item.requireEffects && !metadataEffects.length) {
      throw new Error("Thread detail refresh metadata effects are empty");
    }
    const metadataStartedAt = nowPerfMs();
    for (const metadataEffect of metadataEffects) applyThreadDetailRefreshMetadataEffect(metadataEffect);
    return {
      timingTarget: "metadata-update",
      elapsedMs: roundedDurationMs(metadataStartedAt),
    };
  }
  if (type === "full-render") {
    const conversationRenderStartedAt = nowPerfMs();
    renderCurrentThread();
    return {
      timingTarget: "conversation-render",
      elapsedMs: roundedDurationMs(conversationRenderStartedAt),
    };
  }
  throw new Error(`Unknown thread detail refresh execution action: ${type || "empty"}`);
}

function applyThreadDetailRefreshExecutionEffectsPlan(plan) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  const timings = {
    metadataUpdateMs: 0,
    conversationRenderMs: 0,
  };
  for (const effect of effects) {
    const executionResult = applyThreadDetailRefreshExecutionEffect(effect);
    if (executionResult.timingTarget === "metadata-update") {
      timings.metadataUpdateMs += executionResult.elapsedMs;
    } else if (executionResult.timingTarget === "conversation-render") {
      timings.conversationRenderMs += executionResult.elapsedMs;
    }
  }
  return timings;
}

function applyThreadDetailRefreshConsistencyCheckEffect(effect) {
  const item = effect && typeof effect === "object" ? effect : {};
  const type = String(item.type || "");
  if (type === "conversation-projection-consistency-check") {
    checkConversationProjectionConsistency(String(item.phase || ""), { renderMode: String(item.renderMode || "") });
    return true;
  }
  throw new Error(`Unknown thread detail refresh consistency effect: ${type || "empty"}`);
}

function applyThreadDetailRefreshConsistencyCheckEffectsPlan(plan) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  for (const effect of effects) applyThreadDetailRefreshConsistencyCheckEffect(effect);
}

function applyThreadDetailRefreshTelemetryEffect(effect, context = {}) {
  const item = effect && typeof effect === "object" ? effect : {};
  const type = String(item.type || "");
  if (type === "post-performance-event") {
    postPerformanceEvent(String(item.eventName || ""), item.payload || {}, item.options || {});
    return true;
  }
  if (type === "record-thread-detail-response-diagnostics") {
    const eventContext = item.context && typeof item.context === "object" ? item.context : {};
    recordThreadDetailResponseDiagnostics(item.performanceEvent || {}, {
      action: String(eventContext.action || ""),
      threadId: String(eventContext.threadId || ""),
      thread: context.thread,
    });
    return true;
  }
  throw new Error(`Unknown thread detail refresh telemetry effect: ${type || "empty"}`);
}

function applyThreadDetailRefreshTelemetryEffectsPlan(plan, context = {}) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  for (const effect of effects) applyThreadDetailRefreshTelemetryEffect(effect, context);
}

function applyThreadDetailRefreshFailureDiagnosticEffect(effect) {
  const item = effect && typeof effect === "object" ? effect : {};
  const type = String(item.type || "");
  if (type === "thread-detail-refresh-failed-diagnostic-failure") {
    recordHomeAiDiagnosticFailure(threadDiagnosticEventsApi.threadDetailRefreshFailedDiagnosticEvent(item.diagnosticInput || {}));
    return true;
  }
  throw new Error(`Unknown thread detail refresh failure diagnostic effect: ${type || "empty"}`);
}

function applyThreadDetailRefreshFailureDiagnosticEffectsPlan(plan) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  for (const effect of effects) applyThreadDetailRefreshFailureDiagnosticEffect(effect);
}

function applyThreadDetailRefreshPatchRejectedDiagnosticEffect(effect) {
  const item = effect && typeof effect === "object" ? effect : {};
  const type = String(item.type || "");
  if (type === "detail-patch-rejected-diagnostic-failure") {
    recordHomeAiDiagnosticFailure(threadDiagnosticEventsApi.detailPatchRejectedDiagnosticEvent(item.diagnosticInput || {}));
    return true;
  }
  throw new Error(`Unknown thread detail refresh patch rejected diagnostic effect: ${type || "empty"}`);
}

function applyThreadDetailRefreshPatchRejectedDiagnosticEffectsPlan(plan) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  for (const effect of effects) applyThreadDetailRefreshPatchRejectedDiagnosticEffect(effect);
}

function applyThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffect(effect, context = {}) {
  const item = effect && typeof effect === "object" ? effect : {};
  const type = String(item.type || "");
  if (type === "collect-patch-rejected-visible-shapes") {
    return {
      collected: true,
      previousVisibleShape: visibleConversationShape(context.previousThread),
      nextVisibleShape: visibleConversationShape(context.nextThread),
    };
  }
  throw new Error(`Unknown thread detail refresh visible-shape evidence effect: ${type || "empty"}`);
}

function applyThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffectsPlan(plan, context = {}) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  let evidence = { collected: false };
  for (const effect of effects) {
    const nextEvidence = applyThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffect(effect, context);
    if (nextEvidence && nextEvidence.collected) evidence = nextEvidence;
  }
  return evidence;
}

function applyThreadDetailRefreshPatchAttemptEffect(effect, context) {
  const item = effect && typeof effect === "object" ? effect : {};
  const type = String(item.type || "");
  if (type === "tile-pane-patch") {
    const startedAt = nowPerfMs();
    return {
      tilePanePatchAttempted: true,
      tilePanePatchedDetail: patchCurrentThreadTilePaneFromState({
        threadId: context.threadId,
        preserveScroll: item.preserveScroll !== false,
      }),
      tilePanePatchMs: roundedDurationMs(startedAt),
    };
  }
  if (type === "local-patch") {
    if (item.skipWhenTilePanePatched && context.tilePanePatchedDetail) {
      return {
        localPatchAttempted: false,
        locallyPatchedDetail: false,
        localPatchMs: 0,
      };
    }
    const startedAt = nowPerfMs();
    const patchResult = patchCurrentThreadDetailFromRefresh(
      context.previousThread,
      state.currentThread,
      context.previousConversationSignature,
    );
    const patched = Boolean(patchResult && patchResult.ok);
    return {
      localPatchAttempted: true,
      locallyPatchedDetail: patched,
      patchRejectReason: patched ? "" : String((patchResult && patchResult.reason) || "unknown"),
      localPatchMs: roundedDurationMs(startedAt),
    };
  }
  throw new Error(`Unknown thread detail refresh patch attempt effect: ${type || "empty"}`);
}

function applyThreadDetailRefreshPatchAttemptEffectsPlan(plan, context = {}) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  let result = threadDetailRenderPlanApi.emptyThreadDetailRefreshPatchAttempt();
  for (const effect of effects) {
    const attemptContext = threadDetailRenderPlanApi.threadDetailRefreshPatchAttemptEffectContext(context, result);
    const attempt = applyThreadDetailRefreshPatchAttemptEffect(effect, attemptContext);
    result = threadDetailRenderPlanApi.reduceThreadDetailRefreshPatchAttempt(result, attempt);
  }
  return result;
}

function applyThreadDetailRefreshPatchSurfaceProbeEffect(effect, context = {}) {
  const item = effect && typeof effect === "object" ? effect : {};
  const type = String(item.type || "");
  if (type === "probe-thread-detail-dom-patch-surface") {
    return threadDetailDomPatchSurface({
      threadId: String(item.threadId || context.threadId || ""),
    });
  }
  throw new Error(`Unknown thread detail refresh patch surface probe effect: ${type || "empty"}`);
}

function applyThreadDetailRefreshPatchSurfaceProbeEffectsPlan(plan, context = {}) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  let result = { surface: "" };
  for (const effect of effects) {
    const probe = applyThreadDetailRefreshPatchSurfaceProbeEffect(effect, context);
    if (probe && typeof probe === "object") result = probe;
  }
  return result;
}

async function refreshCurrentThread(options = {}) {
  const requestPlan = threadDetailRenderPlanApi.planThreadDetailRefreshRequest({
    threadId: state.currentThreadId,
    threadLoadSeq: state.threadLoadSeq,
    options,
    hasActiveRefreshController: Boolean(state.refreshThreadController),
    hasActiveThreadLoadController: Boolean(state.threadLoadController),
    documentHidden: document.visibilityState === "hidden",
  });
  if (!requestPlan.shouldRefresh) {
    if (requestPlan.reason === "thread-load-in-flight") {
      scheduleCurrentThreadRefresh(700, requestPlan.source || "deferred-refresh");
    }
    return;
  }
  markIdleActivity("同步");
  const threadId = requestPlan.threadId;
  const seq = requestPlan.seq;
  const source = requestPlan.source;
  const requestedMode = requestPlan.requestedMode;
  if (shouldSuppressAutomaticCurrentThreadRefresh(source, { threadId })) return;
  if (requestPlan.abortActiveRefresh && state.refreshThreadController) state.refreshThreadController.abort();
  const controller = new AbortController();
  state.refreshThreadController = controller;
  let result;
  const refreshStartedAt = nowPerfMs();
  const apiStartedAt = nowPerfMs();
  try {
    result = await api(threadDetailApiPath(threadId, requestPlan.query), {
      timeoutMs: requestPlan.timeoutMs,
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted || err.name === "AbortError") return;
    const failureEffectsPlan = threadDetailRenderPlanApi.planThreadDetailRefreshFailureDiagnosticEffects({
      errorCode: diagnosticErrorCode(err, "thread_detail_refresh_failed"),
      durationBucket: diagnosticDurationBucket(roundedDurationMs(refreshStartedAt)),
      statusCode: diagnosticErrorStatus(err),
      threadHash: diagnosticThreadHash(threadId),
    });
    applyThreadDetailRefreshFailureDiagnosticEffectsPlan(failureEffectsPlan);
    throw err;
  } finally {
    if (state.refreshThreadController === controller) state.refreshThreadController = null;
  }
  const apiElapsedMs = roundedDurationMs(apiStartedAt);
  const responseEffectsPlan = threadDetailRenderPlanApi.planThreadDetailRefreshResponseEffects({
    threadId,
    seq,
    currentThreadId: state.currentThreadId,
    currentThreadSeq: state.threadLoadSeq,
    source,
  });
  if (!responseEffectsPlan.shouldApply) return;
  if (shouldSuppressAutomaticCurrentThreadRefresh(source, { threadId })) return;
  const renderStartedAt = nowPerfMs();
  const mergeStartedAt = nowPerfMs();
  const previousThread = state.currentThread;
  const previousConversationSignature = conversationRenderSignature(state.currentThread);
  const previousPatchShellSignature = conversationPatchShellSignature(previousThread);
  applyThreadDetailRefreshResponseEffectsPlan(responseEffectsPlan, { thread: result.thread });
  const nextVisibleShape = visibleConversationShape(state.currentThread);
  const nextConversationSignature = conversationRenderSignature(state.currentThread);
  const currentDomShape = conversationDomShape();
  const refreshRenderStage = threadDetailRenderPlanApi.planThreadDetailRefreshRenderStage({
    previousConversationSignature,
    nextConversationSignature,
    renderedConversationSignature: state.renderedConversationSignature,
    previousPatchShellSignature,
    renderedPatchShellSignature: state.renderedConversationPatchShellSignature,
    singleThreadSurfaceAvailable: canPatchSingleThreadConversationDom({ threadId }),
    renderedDomTurnCount: conversationDomTurnIds().length,
    renderedDomItemCount: currentDomShape.itemCount,
    duplicateRenderKeyCount: currentDomShape.duplicateRenderKeyCount,
    nextVisibleShape,
    expectedTurnIds: visibleRenderableTurnIds(state.currentThread),
    renderedDomTurnIds: conversationDomTurnIds(),
  });
  const renderPlan = refreshRenderStage.renderPlan;
  const shouldRenderDetail = renderPlan.shouldRenderDetail;
  const postMergePlan = threadDetailRenderPlanApi.planThreadDetailRefreshPostMergeEffects();
  const postMergeTimings = applyThreadDetailRefreshTimedPostMergeEffectsPlan(postMergePlan, {
    mergeStartedAt,
  });
  const mergeMs = postMergeTimings.mergeMs;
  const composerRenderMs = postMergeTimings.composerRenderMs;
  const threadListRenderMs = postMergeTimings.threadListRenderMs;
  let conversationRenderMs = 0;
  let metadataUpdateMs = 0;
  const threadTileConversationSurface = isThreadTileConversationSurface();
  const patchSurfaceProbeStage = threadDetailRenderPlanApi.planThreadDetailRefreshPatchSurfaceProbeStage({
    shouldRenderDetail,
    threadTileMode: state.threadTileMode,
    threadTileConversationSurface,
    threadId,
  });
  const tilePatchPlan = applyThreadDetailRefreshPatchSurfaceProbeEffectsPlan(
    patchSurfaceProbeStage.patchSurfaceProbeEffectsPlan,
    { threadId },
  );
  const patchSurfaceExecutionStage = threadDetailRenderPlanApi.planThreadDetailRefreshPatchSurfaceExecutionStage({
    shouldRenderDetail,
    renderPlan,
    threadTileMode: state.threadTileMode,
    threadTileConversationSurface,
    tilePatchPlan,
  });
  const patchAttemptEffectsPlan = patchSurfaceExecutionStage.patchAttemptEffectsPlan;
  const patchAttempt = applyThreadDetailRefreshPatchAttemptEffectsPlan(patchAttemptEffectsPlan, {
    threadId,
    previousThread,
    previousConversationSignature,
  });
  const patchAttemptResultEvidenceStage = threadDetailRenderPlanApi.planThreadDetailRefreshPatchAttemptResultEvidenceStage({
    shouldRenderDetail,
    patchAttempt,
    renderPlan,
    readMode: result.thread && result.thread.mobileReadMode,
  });
  const patchRejectedVisibleShapeEvidence = applyThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffectsPlan(
    patchAttemptResultEvidenceStage.visibleShapeEvidenceEffectsPlan,
    {
      previousThread,
      nextThread: state.currentThread,
    },
  );
  const patchAttemptResultResolutionStage = threadDetailRenderPlanApi.planThreadDetailRefreshPatchAttemptResultEvidenceResolutionStage({
    shouldRenderDetail,
    patchAttempt,
    renderPlan,
    readMode: result.thread && result.thread.mobileReadMode,
    patchAttemptResultStage: patchAttemptResultEvidenceStage.patchAttemptResultStage,
    visibleShapeEvidence: patchRejectedVisibleShapeEvidence,
  });
  const patchAttemptResultStage = patchAttemptResultResolutionStage.patchAttemptResultStage;
  const patchAttemptResult = patchAttemptResultStage.patchAttemptResult;
  applyThreadDetailRefreshPatchRejectedDiagnosticEffectsPlan(patchAttemptResultStage.patchRejectedDiagnosticEffectsPlan);
  const outcomeExecutionStage = threadDetailRenderPlanApi.planThreadDetailRefreshOutcomeExecutionStage({
    renderPlan,
    patchAttemptResult,
  });
  const renderOutcome = outcomeExecutionStage.renderOutcome;
  const executionTimings = applyThreadDetailRefreshExecutionEffectsPlan(outcomeExecutionStage.executionEffectsPlan);
  metadataUpdateMs += executionTimings.metadataUpdateMs;
  conversationRenderMs += executionTimings.conversationRenderMs;
  applyThreadDetailRefreshConsistencyCheckEffectsPlan(outcomeExecutionStage.consistencyCheckEffectsPlan);
  const renderElapsedMs = roundedDurationMs(renderStartedAt);
  const refreshReportingStage = threadDetailRenderPlanApi.planThreadDetailRefreshReportingStage({
    source,
    threadId,
    requestedMode,
    shouldRenderDetail,
    renderPlan,
    renderOutcome,
    patchAttemptResult,
    patchSurfacePlan: patchSurfaceExecutionStage.patchSurfacePlan,
    patchExecutionPlan: patchSurfaceExecutionStage.patchExecutionPlan,
    timings: {
      elapsedMs: roundedDurationMs(refreshStartedAt),
      apiElapsedMs,
      renderElapsedMs,
      mergeMs,
      composerRenderMs,
      threadListRenderMs,
      conversationRenderMs,
      metadataUpdateMs,
    },
    eventName: "thread_refresh_ms",
    throttleKey: "thread_refresh_ms",
    minIntervalMs: PERF_EVENT_THROTTLE_MS,
    action: "thread-detail-refresh",
    threadHash: diagnosticThreadHash(threadId),
  });
  const refreshPerformance = threadPerformanceMetrics.threadDetailRefreshEventFields(
    result.thread,
    refreshReportingStage.performanceInput,
  );
  const refreshReportingEffectsStage = threadDetailRenderPlanApi.planThreadDetailRefreshReportingEffectsStage({
    performanceEvent: refreshPerformance,
    telemetryConfig: refreshReportingStage.telemetryConfig,
    completionConfig: refreshReportingStage.completionConfig,
  });
  applyThreadDetailRefreshTelemetryEffectsPlan(refreshReportingEffectsStage.telemetryEffectsPlan, { thread: result.thread });
  applyThreadDetailRefreshCompletionEffectsPlan(refreshReportingEffectsStage.completionEffectsPlan);
}

function threadTurnsCursorParam(cursor) {
  if (!cursor) return "";
  return typeof cursor === "string" ? cursor : JSON.stringify(cursor);
}

function turnsArrayFromListResult(result) {
  if (Array.isArray(result && result.data)) return result.data;
  if (Array.isArray(result && result.turns)) return result.turns;
  return [];
}

function shouldBackfillFullThreadDetail(thread) {
  return /turns-list-initial/i.test(String(thread && thread.mobileReadMode || ""));
}

function threadHistoryAutoBackfillKey(thread) {
  const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
  const firstTurn = turns[0] || {};
  const lastTurn = turns[turns.length - 1] || {};
  return [
    state.currentThreadId || thread.id || "",
    threadTurnsCursorSignature(thread && thread.mobileOlderTurnsCursor),
    firstTurn.id || firstTurn.startedAt || "",
    lastTurn.id || lastTurn.startedAt || "",
  ].join("|");
}

function applyThreadDetailHistoryAutoBackfillEffect(effect) {
  const item = effect && typeof effect === "object" ? effect : {};
  const type = String(item.type || "");
  if (type === "remember-history-auto-backfill-key") {
    const key = String(item.key || "");
    if (key) state.threadHistoryAutoBackfillKeys.add(key);
    return true;
  }
  if (type === "post-client-event") {
    postClientEvent(String(item.eventName || ""), item.payload || {});
    return true;
  }
  if (type === "schedule-load-older-thread-turns") {
    const threadId = String(item.threadId || "");
    const seq = Number(item.seq || 0);
    const delayMs = Math.max(0, Number(item.delayMs || 0));
    setTimeout(() => {
      if (state.currentThreadId === threadId) {
        if (seq !== state.threadLoadSeq) return;
      } else if (!state.threadTileMode || !threadTilePaneIsVisible(threadId)) {
        return;
      }
      loadOlderThreadTurns({
        threadId,
        preserveScroll: item.preserveScroll !== false,
        source: String(item.source || "auto-context").slice(0, 40),
      }).catch(showError);
    }, delayMs);
    return true;
  }
  throw new Error(`Unknown thread detail history auto-backfill effect: ${type || "empty"}`);
}

function applyThreadDetailHistoryAutoBackfillEffectsPlan(plan) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  for (const effect of effects) applyThreadDetailHistoryAutoBackfillEffect(effect);
}

function maybeAutoBackfillThreadHistory(thread, options = {}) {
  if (!thread || !thread.id) return;
  const key = threadHistoryAutoBackfillKey(thread);
  const plan = threadDetailRenderPlanApi.planThreadDetailHistoryAutoBackfill({
    thread,
    alreadyRequested: state.threadHistoryAutoBackfillKeys.has(key),
    historyBusy: state.threadHistoryBusy,
  });
  if (!plan.shouldLoad) return;
  const threadId = String(thread.id || state.currentThreadId || "");
  const seq = Number(options.seq || state.threadLoadSeq || 0);
  const effectsPlan = threadDetailRenderPlanApi.planThreadDetailHistoryAutoBackfillEffects({
    plan,
    key,
    threadId,
    seq,
    source: String(options.source || "unknown").slice(0, 40),
    threadHash: diagnosticThreadHash(threadId),
    readMode: String(thread.mobileReadMode || ""),
    buildId: CLIENT_BUILD_ID,
  });
  applyThreadDetailHistoryAutoBackfillEffectsPlan(effectsPlan);
}

function threadDetailApiPath(threadId, params = {}) {
  const suffix = new URLSearchParams(params);
  const query = suffix.toString();
  return `/api/threads/${encodeURIComponent(threadId)}${query ? `?${query}` : ""}`;
}

function markThreadDetailLoaded(thread) {
  if (thread && typeof thread === "object") {
    thread.mobileDetailLoaded = true;
  }
  return thread;
}

async function backfillFullThreadDetail(threadId, options = {}) {
  const id = String(threadId || "");
  const seq = Number(options.seq || 0);
  if (!id || state.currentThreadId !== id || seq !== state.threadLoadSeq) return;
  if (state.refreshThreadController) state.refreshThreadController.abort();
  const controller = new AbortController();
  state.refreshThreadController = controller;
  const apiStartedAt = nowPerfMs();
  let result;
  try {
    result = await api(threadDetailApiPath(id), {
      timeoutMs: 20000,
      signal: controller.signal,
    });
  } catch (err) {
    if (!controller.signal.aborted && err.name !== "AbortError") {
      postClientEvent("thread_detail_full_backfill_error", {
        source: String(options.source || "unknown").slice(0, 40),
        threadId: id,
        elapsedMs: roundedDurationMs(apiStartedAt),
        error: err.message || String(err),
      });
    }
    return;
  } finally {
    if (state.refreshThreadController === controller) state.refreshThreadController = null;
  }
  if (state.currentThreadId !== id || seq !== state.threadLoadSeq || !result || !result.thread) return;
  const apiElapsedMs = roundedDurationMs(apiStartedAt);
  const renderStartedAt = nowPerfMs();
  const wasNearBottom = isConversationNearBottom();
  const mergeStartedAt = nowPerfMs();
  const fullBackfillResponsePlan = threadDetailRenderPlanApi.planThreadDetailFullBackfillResponseEffects({
    source: options.source || "unknown",
  });
  applyThreadDetailRefreshResponseEffectsPlan(fullBackfillResponsePlan, { thread: result.thread });
  const postMergePlan = threadDetailRenderPlanApi.planThreadDetailRefreshPostMergeEffects();
  const postMergeTimings = applyThreadDetailRefreshTimedPostMergeEffectsPlan(postMergePlan, {
    mergeStartedAt,
  });
  const mergeMs = postMergeTimings.mergeMs;
  const composerRenderMs = postMergeTimings.composerRenderMs;
  const threadListRenderMs = postMergeTimings.threadListRenderMs;
  const conversationRenderStartedAt = nowPerfMs();
  renderCurrentThread({ stickToBottom: wasNearBottom });
  const conversationRenderMs = roundedDurationMs(conversationRenderStartedAt);
  const postRenderStartedAt = nowPerfMs();
  const fullBackfillPostRenderPlan = threadDetailRenderPlanApi.planThreadDetailFullBackfillPostRenderEffects();
  applyThreadDetailPostRenderEffectsPlan(fullBackfillPostRenderPlan);
  const postRenderMs = roundedDurationMs(postRenderStartedAt);
  const renderElapsedMs = roundedDurationMs(renderStartedAt);
  const source = String(options.source || "unknown").slice(0, 40);
  const fullBackfillReportingStage = threadDetailRenderPlanApi.planThreadDetailFullBackfillReportingStage({
    source,
    threadId: id,
    timings: {
      elapsedMs: roundedDurationMs(apiStartedAt),
      apiElapsedMs,
      renderElapsedMs,
      mergeMs,
      composerRenderMs,
      threadListRenderMs,
      conversationRenderMs,
      postRenderMs,
    },
  });
  const fullReadyPerformance = threadPerformanceMetrics.threadDetailFullReadyEventFields(
    result.thread,
    fullBackfillReportingStage.performanceInput,
  );
  const fullBackfillTelemetryPlan = threadDetailRenderPlanApi.planThreadDetailFullBackfillTelemetryEffects(Object.assign({
    performanceEvent: fullReadyPerformance,
  }, fullBackfillReportingStage.telemetryInput));
  applyThreadDetailRefreshTelemetryEffectsPlan(fullBackfillTelemetryPlan, { thread: result.thread });
}

function preserveConversationScrollAfterPrepend(previousScrollTop, previousScrollHeight) {
  const conversation = $("conversation");
  if (!conversation) return;
  const nextScrollHeight = conversation.scrollHeight;
  const delta = Math.max(0, nextScrollHeight - Number(previousScrollHeight || 0));
  if (delta <= 0) return;
  markProgrammaticConversationScroll();
  conversation.scrollTop = Number(previousScrollTop || 0) + delta;
  syncConversationScrollPosition();
  scheduleScrollToBottomButtonUpdate();
}

function threadHistoryLoadTarget(options = {}) {
  const explicitThread = options.thread && typeof options.thread === "object" ? options.thread : null;
  const id = String(options.threadId || explicitThread && explicitThread.id || state.currentThreadId || state.currentThread && state.currentThread.id || "").trim();
  if (!id) return { threadId: "", thread: null, current: false, tile: false };
  if (state.currentThread && String(state.currentThread.id || "") === id) {
    return { threadId: id, thread: state.currentThread, current: true, tile: false };
  }
  if (explicitThread && String(explicitThread.id || "") === id) {
    return {
      threadId: id,
      thread: explicitThread,
      current: id === String(state.currentThreadId || ""),
      tile: Boolean(state.threadTileMode && threadTilePaneIsVisible(id)),
    };
  }
  if (state.threadTileDetails && state.threadTileDetails.has(id)) {
    return { threadId: id, thread: state.threadTileDetails.get(id), current: false, tile: Boolean(state.threadTileMode && threadTilePaneIsVisible(id)) };
  }
  const listThread = findThreadById(id);
  return { threadId: id, thread: listThread || null, current: false, tile: Boolean(state.threadTileMode && threadTilePaneIsVisible(id)) };
}

function renderThreadHistoryLoadTarget(threadId, options = {}) {
  const id = String(threadId || "").trim();
  if (id && state.currentThreadId === id) {
    renderCurrentThread({ stickToBottom: false });
    return true;
  }
  if (id && state.threadTileMode && threadTilePaneIsVisible(id)) {
    if (!scheduleRenderThreadTilePane(id, { preserveScroll: options.preserveScroll !== false })) renderCurrentThread({ stickToBottom: false });
    return true;
  }
  renderCurrentThread({ stickToBottom: false });
  return false;
}

async function loadOlderThreadTurns(options = {}) {
  const target = threadHistoryLoadTarget(options);
  const thread = target.thread;
  const threadId = target.threadId;
  const cursor = thread && thread.mobileOlderTurnsCursor;
  if (!thread || !threadId || !cursor || state.threadHistoryBusy) return;
  const preserveScroll = Boolean(options.preserveScroll);
  const conversation = $("conversation");
  const previousScrollTop = preserveScroll && conversation ? conversation.scrollTop : 0;
  const previousScrollHeight = preserveScroll && conversation ? conversation.scrollHeight : 0;
  state.threadHistoryBusy = true;
  state.threadHistoryError = "";
  renderThreadHistoryLoadTarget(threadId, { preserveScroll });
  try {
    const params = new URLSearchParams({
      limit: String(MAX_VISIBLE_TURNS),
      sortDirection: "desc",
      cursor: threadTurnsCursorParam(cursor),
    });
    const result = await api(`/api/threads/${encodeURIComponent(threadId)}/turns?${params.toString()}`, {
      timeoutMs: 30000,
    });
    const latestTarget = threadHistoryLoadTarget({ threadId, thread });
    const targetThread = latestTarget.thread;
    if (!targetThread) return;
    const incomingTurns = sortTurnsForDisplay(turnsArrayFromListResult(result));
    const existingTurns = Array.isArray(targetThread.turns) ? targetThread.turns : [];
    const existingById = new Map(existingTurns.map((turn) => [String(turn && turn.id || ""), turn]));
    const mergedById = new Map();
    let newlyLoadedTurnCount = 0;
    for (const incomingTurn of incomingTurns) {
      if (!incomingTurn || !incomingTurn.id) continue;
      const existingTurn = existingById.get(String(incomingTurn.id));
      if (!existingTurn) newlyLoadedTurnCount += 1;
      mergedById.set(String(incomingTurn.id), existingTurn ? mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) : incomingTurn);
    }
    for (const existingTurn of existingTurns) {
      if (!existingTurn || !existingTurn.id) continue;
      if (!mergedById.has(String(existingTurn.id))) mergedById.set(String(existingTurn.id), existingTurn);
    }
    targetThread.turns = sortTurnsForDisplay(Array.from(mergedById.values())).slice(-MAX_EXPANDED_VISIBLE_TURNS);
    targetThread.mobileHistoryExpanded = true;
    if (newlyLoadedTurnCount > 0) {
      targetThread.mobileOmittedTurnCount = Math.max(0, Number(targetThread.mobileOmittedTurnCount || 0) - newlyLoadedTurnCount);
    }
    targetThread.mobileOlderTurnsCursor = result && result.nextCursor ? result.nextCursor : null;
    targetThread.mobileNewerTurnsCursor = result && result.backwardsCursor ? result.backwardsCursor : targetThread.mobileNewerTurnsCursor;
    if (threadId === state.currentThreadId) state.currentThread = targetThread;
    if (state.threadTileMode && state.threadTileDetails && threadTilePaneIsVisible(threadId)) state.threadTileDetails.set(threadId, targetThread);
    markIdleActivity("History loaded");
  } catch (err) {
    state.threadHistoryError = `Older history failed: ${normalizeClientErrorMessage(err && err.message ? err.message : String(err)) || String(err && err.message || err)}`;
    showError(new Error(state.threadHistoryError));
  } finally {
    state.threadHistoryBusy = false;
    renderThreadHistoryLoadTarget(threadId, { preserveScroll });
    if (preserveScroll && state.currentThreadId === threadId) {
      preserveConversationScrollAfterPrepend(previousScrollTop, previousScrollHeight);
    }
  }
}

function maybeLoadOlderThreadTurnsFromScroll() {
  const conversation = $("conversation");
  const thread = state.currentThread;
  if (!conversation || !thread || !thread.mobileOlderTurnsCursor || state.threadHistoryBusy) return;
  if (!hasRecentConversationScrollIntent()) return;
  if (conversation.scrollTop > THREAD_HISTORY_TOP_LOAD_PX) return;
  loadOlderThreadTurns({ preserveScroll: true, source: "scroll-top" }).catch(showError);
}

function scheduleCurrentThreadRefresh(delay = 600, source = "scheduled") {
  clearTimeout(state.refreshTimer);
  if (shouldSuppressAutomaticCurrentThreadRefresh(source)) return;
  state.refreshTimer = setTimeout(() => {
    if (shouldSuppressAutomaticCurrentThreadRefresh(source)) return;
    refreshCurrentThread({ source }).catch(showError);
  }, delay);
}

function scheduleComposerTargetRefresh(threadId, delay = 600, source = "scheduled") {
  const id = String(threadId || "").trim();
  if (!id) return;
  if (id === String(state.currentThreadId || "")) {
    scheduleCurrentThreadRefresh(delay, source);
    return;
  }
  setTimeout(() => {
    if (!state.threadTileMode || !threadTilePaneIsVisible(id)) return;
    loadThreadTileDetail(id, { force: true, background: true, source }).catch(showError);
  }, Math.max(0, Number(delay) || 0));
}

function schedulePostCompletionThreadRefreshes(threadId, delays = [700, 2400]) {
  const id = String(threadId || "");
  if (!id) return;
  state.postCompletionRefreshTimers.forEach((timer) => clearTimeout(timer));
  state.postCompletionRefreshTimers = [];
  if (shouldSuppressAutomaticCurrentThreadRefresh("post-completion", { threadId: id })) return;
  state.postCompletionRefreshTimers = delays.map((delay, index) => {
    const timer = setTimeout(() => {
      state.postCompletionRefreshTimers = state.postCompletionRefreshTimers.filter((entry) => entry !== timer);
      if (document.visibilityState === "hidden") return;
      if (state.currentThreadId !== id) return;
      if (shouldSuppressAutomaticCurrentThreadRefresh("post-completion", { threadId: id })) return;
      refreshCurrentThread({
        source: "post-completion",
        full: true,
      }).catch(showError);
    }, delay);
    return timer;
  });
}

function abortCurrentThreadRefresh() {
  clearTimeout(state.refreshTimer);
  state.postCompletionRefreshTimers.forEach((timer) => clearTimeout(timer));
  state.postCompletionRefreshTimers = [];
  clearUsageBackfillRefresh();
  clearTimeout(state.pollTimer);
  if (state.refreshThreadController) {
    state.refreshThreadController.abort();
    state.refreshThreadController = null;
  }
  state.pollStableCount = 0;
  state.lastThreadSignature = "";
}

function scheduleLivePollIfNeeded(delay = 2600) {
  clearTimeout(state.pollTimer);
  if (!shouldPollCurrentThread()) return;
  if (shouldSuppressAutomaticCurrentThreadRefresh("live-poll")) return;
  const signature = threadSignature();
  if (signature === state.lastThreadSignature) state.pollStableCount += 1;
  else state.pollStableCount = 0;
  state.lastThreadSignature = signature;
  let nextDelay = delay;
  if (state.pollStableCount > 12) nextDelay = Math.max(delay, 12000);
  else if (state.pollStableCount > 3) nextDelay = Math.max(delay, 5000);
  state.pollTimer = setTimeout(() => {
    if (shouldSuppressAutomaticCurrentThreadRefresh("live-poll")) return;
    refreshCurrentThread({ source: "live-poll" }).catch(showError);
  }, nextDelay);
}

function handleThreadCardClick(event) {
  const button = event.currentTarget;
  const threadId = button && button.dataset.thread;
  if (!threadId) return;
  if (Date.now() < state.suppressThreadClickUntil
    && (!state.suppressThreadClickThreadId || state.suppressThreadClickThreadId === threadId)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (Date.now() >= state.suppressThreadClickUntil) state.suppressThreadClickThreadId = "";
  loadThread(threadId, { source: "thread-list" }).catch(showError);
}

function isMobileViewport() {
  return isMenuOverlayMode();
}

function isAndroidBrowser() {
  const ua = String(navigator.userAgent || navigator.vendor || "").toLowerCase();
  return ua.includes("android");
}

function isIosWebKitBrowser() {
  const ua = String(navigator.userAgent || navigator.vendor || "").toLowerCase();
  const platform = String(navigator.platform || "").toLowerCase();
  const iosLike = /iphone|ipad|ipod/.test(ua)
    || (/mac/.test(platform) && Number(navigator.maxTouchPoints || 0) > 1);
  return iosLike && /applewebkit/.test(ua) && !/crios|fxios|edgios/.test(ua);
}

function sidebarEdgeSwipeStartLimitPx() {
  return isAndroidBrowser() ? ANDROID_SIDEBAR_EDGE_SWIPE_PX : SIDEBAR_EDGE_SWIPE_PX;
}

function pointInComposerGestureZone(point) {
  if (!point) return false;
  const composer = $("composer");
  if (!composer) return false;
  const rect = composer.getBoundingClientRect();
  if (!rect || rect.height <= 0) return false;
  return point.clientY >= Math.max(0, rect.top - 10);
}

function closeSidebarMenu() {
  const sidebar = $("sidebar");
  if (!sidebar) return;
  sidebar.classList.remove("open", "edge-dragging");
  sidebar.style.removeProperty("--sidebar-edge-x");
  state.sidebarEdgeSwipe = null;
  const settingsPanel = $("themeSettingsPanel");
  const settingsToggle = $("themeSettingsToggle");
  if (settingsPanel) settingsPanel.classList.add("hidden");
  if (settingsToggle) settingsToggle.setAttribute("aria-expanded", "false");
  publishPluginNavigationState();
}

function isHermesPluginPrimaryPage() {
  return isHermesEmbedMode() && !state.currentThreadId && !state.newThreadDraft;
}

function syncHermesPluginPageLevel() {
  if (!isHermesEmbedMode()) return;
  document.documentElement.classList.toggle("embed-hermes-primary", isHermesPluginPrimaryPage());
}

function showHermesPluginPrimaryPage(options = {}) {
  if (!isHermesEmbedMode()) return false;
  const force = options.force === true;
  if (!force && (
    state.threadLoadController
    || state.startupThreadOpenPending
    || (state.currentThread && state.currentThread.mobileLoading)
  )) {
    postClientEvent("plugin_primary_suppressed_thread_open", {
      source: String(options.source || "").slice(0, 80),
      currentThreadId: state.currentThreadId || "",
      hasThreadLoadController: Boolean(state.threadLoadController),
      startupThreadOpenPending: Boolean(state.startupThreadOpenPending),
    });
    recordPrimaryShellSelectionConflict("primary_shell_suppressed_thread_open", {
      source: String(options.source || "").slice(0, 80),
      renderMode: "primary-suppressed",
    });
    return false;
  }
  if (force) clearThreadDetailRenderEvidence(`primary-force:${String(options.source || "").slice(0, 48)}`);
  clearCurrentThreadSelection();
  state.newThreadDraft = false;
  const sidebar = $("sidebar");
  if (sidebar) {
    sidebar.classList.remove("open", "edge-dragging");
    sidebar.style.removeProperty("--sidebar-edge-x");
  }
  state.sidebarEdgeSwipe = null;
  renderComposerSettings();
  renderThreads();
  renderCurrentThread();
  updateComposerControls();
  restoreConnectionState();
  syncHermesPluginPageLevel();
  publishPluginNavigationState({ force: true });
  refreshSidebarListAfterOpen();
  return true;
}

function refreshSidebarListAfterOpen() {
  const loadedAt = Number(state.threadListLoadedAtMs || 0);
  if (!loadedAt) {
    loadWorkspaces()
      .then(() => loadThreads())
      .catch(showError);
    return;
  }
  if (Date.now() - loadedAt < 60000) return;
  loadWorkspaces()
    .then(() => loadThreads({ silent: true }))
    .catch(() => {
      // Sidebar opening should stay instant; visible refresh still reports errors.
    });
}

function openSidebarMenu() {
  if (isHermesEmbedMode()) {
    showHermesPluginPrimaryPage({ force: true, source: "sidebar" });
    return;
  }
  const sidebar = $("sidebar");
  if (!sidebar) return;
  sidebar.classList.remove("edge-dragging");
  sidebar.style.removeProperty("--sidebar-edge-x");
  sidebar.classList.add("open");
  state.sidebarEdgeSwipe = null;
  refreshSidebarListAfterOpen();
  publishPluginNavigationState({ force: true });
}

function androidBackToSidebarAvailable() {
  const app = $("app");
  return Boolean(isAndroidBrowser()
    && isMobileViewport()
    && !isHermesEmbedMode()
    && state.key
    && app
    && !app.classList.contains("hidden")
    && !filePreviewOpen()
    && !mermaidPreviewOpen()
    && !state.renameThreadId
    && !createWorkspaceDialogOpen()
    && !updatePanelOpen()
    && !state.threadActionMenuId
    && !state.continuationDialogThreadId
    && !state.sharedRestartDialogOpen);
}

function currentHistoryStateObject() {
  return (window.history && window.history.state && typeof window.history.state === "object")
    ? window.history.state
    : {};
}

function androidBackSidebarStateKind(value = null) {
  const source = value || currentHistoryStateObject();
  return String(source && source[ANDROID_BACK_SIDEBAR_STATE] || "");
}

function ensureAndroidBackToSidebarSentinel() {
  if (!androidBackToSidebarAvailable()) {
    state.androidBackSidebarSentinelReady = false;
    return;
  }
  try {
    const currentState = currentHistoryStateObject();
    const currentKind = androidBackSidebarStateKind(currentState);
    if (currentKind === ANDROID_BACK_SIDEBAR_TOP) {
      state.androidBackSidebarSentinelReady = true;
      return;
    }
    if (currentKind !== ANDROID_BACK_SIDEBAR_BASE) {
      window.history.replaceState(Object.assign({}, currentState, {
        [ANDROID_BACK_SIDEBAR_STATE]: ANDROID_BACK_SIDEBAR_BASE,
      }), "", window.location.href);
    }
    window.history.pushState(Object.assign({}, currentState, {
      [ANDROID_BACK_SIDEBAR_STATE]: ANDROID_BACK_SIDEBAR_TOP,
    }), "", window.location.href);
    state.androidBackSidebarSentinelReady = true;
  } catch (_) {
    state.androidBackSidebarSentinelReady = false;
  }
}

function handleAndroidBackToSidebarPopState(event) {
  state.androidBackSidebarSentinelReady = false;
  if (!androidBackToSidebarAvailable()) return;
  const stateKind = androidBackSidebarStateKind(event && event.state);
  if (stateKind && stateKind !== ANDROID_BACK_SIDEBAR_BASE && stateKind !== ANDROID_BACK_SIDEBAR_TOP) return;
  if (event && typeof event.preventDefault === "function") event.preventDefault();
  if (!isSidebarOpen()) openSidebarMenu();
  window.setTimeout(ensureAndroidBackToSidebarSentinel, 0);
}

function isSidebarOpen() {
  const sidebar = $("sidebar");
  return Boolean(sidebar && sidebar.classList.contains("open"));
}

function sidebarTransformIsNone(transform) {
  const value = String(transform || "").replace(/\s+/g, "").toLowerCase();
  return !value
    || value === "none"
    || value === "matrix(1,0,0,1,0,0)"
    || value === "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
}

function splitPaneSidebarVisible() {
  const sidebar = $("sidebar");
  if (!sidebar || typeof window.getComputedStyle !== "function") return false;
  const style = window.getComputedStyle(sidebar);
  const rect = typeof sidebar.getBoundingClientRect === "function"
    ? sidebar.getBoundingClientRect()
    : { width: sidebar.offsetWidth || 0, height: sidebar.offsetHeight || 0 };
  if (Number(rect.width || 0) < 80 || Number(rect.height || 0) < 80) return false;
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (style.position === "fixed") return false;
  return sidebarTransformIsNone(style.transform);
}

function hostEmbeddedSplitPaneVisible() {
  if (!isHermesEmbedMode()) return false;
  const hostViewport = state.pluginHostViewport && typeof state.pluginHostViewport === "object"
    ? state.pluginHostViewport
    : null;
  const iframe = hostViewport && hostViewport.iframe && typeof hostViewport.iframe === "object"
    ? hostViewport.iframe
    : null;
  const viewport = hostViewport && hostViewport.viewport && typeof hostViewport.viewport === "object"
    ? hostViewport.viewport
    : null;
  const host = hostViewport && hostViewport.host && typeof hostViewport.host === "object"
    ? hostViewport.host
    : null;
  const frameLeft = Number(iframe && iframe.left || 0);
  const frameWidth = Number(iframe && iframe.width || 0);
  const hostWidth = Number(
    (viewport && (viewport.layoutWidth || viewport.width))
    || (host && host.width)
    || 0,
  );
  return frameLeft >= HOST_EMBED_SPLIT_LEFT_MIN_PX
    && frameWidth >= HOST_EMBED_SPLIT_FRAME_MIN_PX
    && hostWidth >= HOST_EMBED_SPLIT_VIEWPORT_MIN_PX
    && frameWidth < hostWidth - 24;
}

function threadDetailReturnButtonVisible() {
  const detailActive = Boolean(state.currentThreadId || state.currentThread);
  if (!detailActive) return false;
  if (isHermesEmbedMode()) return hostEmbeddedSplitPaneVisible();
  return splitPaneSidebarVisible();
}

function syncThreadDetailLayoutState() {
  const detailActive = Boolean(state.currentThreadId || state.currentThread);
  document.documentElement.classList.toggle("thread-detail-active", detailActive);
  const openMenuButton = $("openMenu");
  if (!openMenuButton) return;
  const splitReturn = threadDetailReturnButtonVisible();
  openMenuButton.classList.toggle("split-return-visible", splitReturn);
  openMenuButton.textContent = splitReturn ? "←" : "☰";
  openMenuButton.title = splitReturn ? "返回线程列表" : "Menu";
  openMenuButton.setAttribute("aria-label", splitReturn ? "返回线程列表" : "Menu");
}

function returnToThreadListFromDetail() {
  if (!state.currentThreadId && !state.currentThread) return false;
  clearCurrentThreadSelection();
  renderThreads();
  renderCurrentThread();
  updateComposerControls();
  restoreConnectionState();
  syncHermesPluginPageLevel();
  publishPluginNavigationState({ force: true });
  refreshSidebarListAfterOpen();
  return true;
}

function handleOpenMenuClick() {
  if (threadDetailReturnButtonVisible() && returnToThreadListFromDetail()) return;
  openSidebarMenu();
}

function isInteractiveGestureTarget(target) {
  return Boolean(target && target.closest && target.closest(
    "a, button, input, textarea, select, label, [contenteditable='true'], .rename-input, .composer, .composer-controls, .thread-action-sheet, .continuation-dialog, .update-dialog, .app-native-dialog"
  ));
}

function beginSidebarEdgeSwipe(event) {
  if (!isMobileViewport() || isHermesEmbedMode() || isSidebarOpen() || state.renameThreadId || createWorkspaceDialogOpen() || updatePanelOpen() || state.threadActionMenuId || state.continuationDialogThreadId) return;
  if (event.touches && event.touches.length > 1) return;
  if (isInteractiveGestureTarget(event.target)) return;
  const touch = primaryTouch(event);
  if (pointInComposerGestureZone(touch)) return;
  if (!touch || touch.clientX > sidebarEdgeSwipeStartLimitPx()) return;
  ensureAndroidBackToSidebarSentinel();
  if (event.cancelable !== false) event.preventDefault();
  const sidebar = $("sidebar");
  state.sidebarEdgeSwipe = {
    startX: touch.clientX,
    startY: touch.clientY,
    currentX: touch.clientX,
    moved: false,
    width: Math.max(1, Math.round((sidebar && sidebar.getBoundingClientRect().width) || window.innerWidth || 1)),
  };
}

function moveSidebarEdgeSwipe(event) {
  const swipe = state.sidebarEdgeSwipe;
  if (!swipe) return;
  const touch = primaryTouch(event);
  if (!touch) return;
  const dx = touch.clientX - swipe.startX;
  const dy = touch.clientY - swipe.startY;
  if (!swipe.moved) {
    if (dx < 8 && Math.abs(dy) < 12) return;
    if (dx <= 0 || Math.abs(dy) > Math.abs(dx)) {
      cancelSidebarEdgeSwipe();
      return;
    }
  }
  swipe.moved = true;
  swipe.currentX = touch.clientX;
  if (event.cancelable !== false) event.preventDefault();
  const sidebar = $("sidebar");
  if (!sidebar) return;
  const offset = Math.max(0, Math.min(swipe.width, dx));
  sidebar.classList.add("edge-dragging");
  sidebar.style.setProperty("--sidebar-edge-x", `${Math.round(offset)}px`);
}

function finishSidebarEdgeSwipe() {
  const swipe = state.sidebarEdgeSwipe;
  if (!swipe) return;
  const dx = Number(swipe.currentX || swipe.startX) - swipe.startX;
  const shouldOpen = swipe.moved && dx >= Math.max(SIDEBAR_EDGE_OPEN_MIN_PX, swipe.width * SIDEBAR_EDGE_OPEN_RATIO);
  if (shouldOpen) openSidebarMenu();
  else cancelSidebarEdgeSwipe();
}

function cancelSidebarEdgeSwipe() {
  const sidebar = $("sidebar");
  if (sidebar) {
    sidebar.classList.remove("edge-dragging");
    sidebar.style.removeProperty("--sidebar-edge-x");
  }
  state.sidebarEdgeSwipe = null;
}

var sideChatRuntime = null;
function requireSideChatRuntime() {
  if (!sideChatRuntime) {
    sideChatRuntime = sideChatRuntimeApi.createSideChatRuntime({
      state,
      $,
      document,
      window,
      requestAnimationFrame: typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback) => window.setTimeout(callback, 16),
      setTimeout: window.setTimeout.bind(window),
      clearTimeout: window.clearTimeout.bind(window),
      SIDE_CHAT_DRAFT_SAVE_DEBOUNCE_MS,
      SIDE_CHAT_DRAFT_MAX_CHARS,
      SUBAGENT_EDGE_SWIPE_PX,
      SUBAGENT_EDGE_SWIPE_MAX_PX,
      SUBAGENT_EDGE_SWIPE_RATIO,
      SUBAGENT_SWIPE_MIN_PX,
      SUBAGENT_WHEEL_SWIPE_MIN_PX,
      CLIENT_BUILD_ID,
      api,
      collabAgentNameText,
      collabAgentTaskText,
      collabAgentThreadText,
      conversationDomTurnIds,
      conversationPatchShellSignature,
      conversationRenderSignature,
      createSubmissionId,
      currentLiveTurn,
      diagnosticThreadHash,
      escapeHtml,
      escapeSelectorAttr,
      formatTime,
      homeAiDiagnosticReportingApi,
      isInteractiveGestureTarget,
      latestTurn,
      loadThread,
      loadThreads,
      markActivity,
      normalizeClientErrorMessage,
      primaryTouch,
      renderCurrentThread,
      requestAppConfirmation,
      scheduleCurrentThreadRefresh,
      scheduleLivePollIfNeeded,
      showError,
      statusText,
      truncateMiddle,
      visibleConversationShape,
    });
  }
  return sideChatRuntime;
}

function isSubagentItem(...args) {
  return requireSideChatRuntime().isSubagentItem(...args);
}

function turnSubagentItems(...args) {
  return requireSideChatRuntime().turnSubagentItems(...args);
}

function activeSubagentItems(...args) {
  return requireSideChatRuntime().activeSubagentItems(...args);
}

function currentSubagentTurn(...args) {
  return requireSideChatRuntime().currentSubagentTurn(...args);
}

function currentSubagentItems(...args) {
  return requireSideChatRuntime().currentSubagentItems(...args);
}

function subagentStatusKind(...args) {
  return requireSideChatRuntime().subagentStatusKind(...args);
}

function isActiveSubagentItem(...args) {
  return requireSideChatRuntime().isActiveSubagentItem(...args);
}

function currentSubagentStatusKind(...args) {
  return requireSideChatRuntime().currentSubagentStatusKind(...args);
}

function subagentStatusLabel(...args) {
  return requireSideChatRuntime().subagentStatusLabel(...args);
}

function subagentSwipeAvailable(...args) {
  return requireSideChatRuntime().subagentSwipeAvailable(...args);
}

function sideChatThreadId(...args) {
  return requireSideChatRuntime().sideChatThreadId(...args);
}

function defaultSideChatState(...args) {
  return requireSideChatRuntime().defaultSideChatState(...args);
}

function normalizeSideChatSidecar(...args) {
  return requireSideChatRuntime().normalizeSideChatSidecar(...args);
}

function normalizeSideChatState(...args) {
  return requireSideChatRuntime().normalizeSideChatState(...args);
}

function setSideChatState(...args) {
  return requireSideChatRuntime().setSideChatState(...args);
}

function sideChatStateForThread(...args) {
  return requireSideChatRuntime().sideChatStateForThread(...args);
}

function sideChatApiPath(...args) {
  return requireSideChatRuntime().sideChatApiPath(...args);
}

function sideChatDraftTextarea(...args) {
  return requireSideChatRuntime().sideChatDraftTextarea(...args);
}

function ensureSideChatDraftVisible(...args) {
  return requireSideChatRuntime().ensureSideChatDraftVisible(...args);
}

function autoSizeSideChatDraftTextarea(...args) {
  return requireSideChatRuntime().autoSizeSideChatDraftTextarea(...args);
}

function sideChatScrollContainer(...args) {
  return requireSideChatRuntime().sideChatScrollContainer(...args);
}

function scrollSideChatToBottom(...args) {
  return requireSideChatRuntime().scrollSideChatToBottom(...args);
}

function scheduleSideChatToBottom(...args) {
  return requireSideChatRuntime().scheduleSideChatToBottom(...args);
}

function openSideChatCandidate(...args) {
  return requireSideChatRuntime().openSideChatCandidate(...args);
}

function currentSideChatDraftText(...args) {
  return requireSideChatRuntime().currentSideChatDraftText(...args);
}

function truncateSideChatText(...args) {
  return requireSideChatRuntime().truncateSideChatText(...args);
}

async function loadSideChat(...args) {
  return requireSideChatRuntime().loadSideChat(...args);
}

function sideChatReplyPending(...args) {
  return requireSideChatRuntime().sideChatReplyPending(...args);
}

function scheduleSideChatPoll(...args) {
  return requireSideChatRuntime().scheduleSideChatPoll(...args);
}

async function saveSideChatDraft(...args) {
  return requireSideChatRuntime().saveSideChatDraft(...args);
}

function scheduleSideChatDraftSave(...args) {
  return requireSideChatRuntime().scheduleSideChatDraftSave(...args);
}

function flushSideChatDraftNow(...args) {
  return requireSideChatRuntime().flushSideChatDraftNow(...args);
}

function sideChatStatusLabel(...args) {
  return requireSideChatRuntime().sideChatStatusLabel(...args);
}

function sideChatQueueSummary(...args) {
  return requireSideChatRuntime().sideChatQueueSummary(...args);
}

function sideChatTimeLabel(...args) {
  return requireSideChatRuntime().sideChatTimeLabel(...args);
}

function sideChatBusy(...args) {
  return requireSideChatRuntime().sideChatBusy(...args);
}

function setSideChatNotice(...args) {
  return requireSideChatRuntime().setSideChatNotice(...args);
}

function clearSideChatNotice(...args) {
  return requireSideChatRuntime().clearSideChatNotice(...args);
}

function sideChatNoticeForThread(...args) {
  return requireSideChatRuntime().sideChatNoticeForThread(...args);
}

function sideChatPanelRenderSignature(...args) {
  return requireSideChatRuntime().sideChatPanelRenderSignature(...args);
}

function renderSideChatNotice(...args) {
  return requireSideChatRuntime().renderSideChatNotice(...args);
}

function renderSubagentStatusWindow(...args) {
  return requireSideChatRuntime().renderSubagentStatusWindow(...args);
}

function latestAssistantSideChatMessageIndex(...args) {
  return requireSideChatRuntime().latestAssistantSideChatMessageIndex(...args);
}

function renderSideChatMessage(...args) {
  return requireSideChatRuntime().renderSideChatMessage(...args);
}

function renderSideChatCandidate(...args) {
  return requireSideChatRuntime().renderSideChatCandidate(...args);
}

function renderSideChatPanel(...args) {
  return requireSideChatRuntime().renderSideChatPanel(...args);
}

function renderSubagentPanel(...args) {
  return requireSideChatRuntime().renderSubagentPanel(...args);
}

function updateSubagentPanelUi(...args) {
  return requireSideChatRuntime().updateSubagentPanelUi(...args);
}

function visualHarnessThreadShape(...args) {
  return requireSideChatRuntime().visualHarnessThreadShape(...args);
}

async function simulateEmptyCachedDetailOpenForHarness(...args) {
  return requireSideChatRuntime().simulateEmptyCachedDetailOpenForHarness(...args);
}

async function simulateStableSignatureEmptyDomForHarness(...args) {
  return requireSideChatRuntime().simulateStableSignatureEmptyDomForHarness(...args);
}

function refreshSideChatFormButtons(...args) {
  return requireSideChatRuntime().refreshSideChatFormButtons(...args);
}

function setSideChatBusy(...args) {
  return requireSideChatRuntime().setSideChatBusy(...args);
}

function applySideChatResult(...args) {
  return requireSideChatRuntime().applySideChatResult(...args);
}

function handleSideChatDraftInput(...args) {
  return requireSideChatRuntime().handleSideChatDraftInput(...args);
}

function installCodexMobileVisualHarnessFacade(...args) {
  return requireSideChatRuntime().installCodexMobileVisualHarnessFacade(...args);
}

async function submitSideChatMessage(...args) {
  return requireSideChatRuntime().submitSideChatMessage(...args);
}

async function createSideChatCandidateFromText(...args) {
  return requireSideChatRuntime().createSideChatCandidateFromText(...args);
}

async function createSideChatCandidateFromDraft(...args) {
  return requireSideChatRuntime().createSideChatCandidateFromDraft(...args);
}

function sideChatMessageTextByIndex(...args) {
  return requireSideChatRuntime().sideChatMessageTextByIndex(...args);
}

async function createSideChatCandidateFromMessage(...args) {
  return requireSideChatRuntime().createSideChatCandidateFromMessage(...args);
}

async function queueSideChatCandidate(...args) {
  return requireSideChatRuntime().queueSideChatCandidate(...args);
}

async function applySideChatCandidate(...args) {
  return requireSideChatRuntime().applySideChatCandidate(...args);
}

async function cancelSideChatCandidate(...args) {
  return requireSideChatRuntime().cancelSideChatCandidate(...args);
}

async function clearSideChat(...args) {
  return requireSideChatRuntime().clearSideChat(...args);
}

function handleSideChatActionClick(...args) {
  return requireSideChatRuntime().handleSideChatActionClick(...args);
}

function openSubagentPanelFromGesture(...args) {
  return requireSideChatRuntime().openSubagentPanelFromGesture(...args);
}

function isHorizontalScrollableGestureTarget(...args) {
  return requireSideChatRuntime().isHorizontalScrollableGestureTarget(...args);
}

function subagentSwipeEdgeLimitPx(...args) {
  return requireSideChatRuntime().subagentSwipeEdgeLimitPx(...args);
}

function subagentSwipeStartsNearEdge(...args) {
  return requireSideChatRuntime().subagentSwipeStartsNearEdge(...args);
}

function beginSubagentSwipe(...args) {
  return requireSideChatRuntime().beginSubagentSwipe(...args);
}

function moveSubagentSwipe(...args) {
  return requireSideChatRuntime().moveSubagentSwipe(...args);
}

function finishSubagentSwipe(...args) {
  return requireSideChatRuntime().finishSubagentSwipe(...args);
}

function cancelSubagentSwipe(...args) {
  return requireSideChatRuntime().cancelSubagentSwipe(...args);
}

function handleSubagentWheelSwipe(...args) {
  return requireSideChatRuntime().handleSubagentWheelSwipe(...args);
}
function threadById(threadId) {
  const id = String(threadId || "");
  return state.threads.find((thread) => String(thread && thread.id || "") === id)
    || (state.currentThread && String(state.currentThread.id || "") === id ? state.currentThread : null);
}

function threadTitleForDisplay(thread) {
  return preferredThreadDisplayTitle(thread);
}

function applyThreadNameToThread(thread, title) {
  if (!thread || !title) return false;
  thread.name = title;
  return true;
}

function scheduleThreadNameDetailRender(threadId = "") {
  const id = String(threadId || state.currentThreadId || "").trim();
  if (!id) return false;
  if (state.currentThread && String(state.currentThread.id || "") === id) {
    renderCurrentThread();
    return true;
  }
  if (state.threadTileMode && threadTilePaneIsVisible(id)) {
    if (!scheduleRenderThreadTilePane(id, { preserveScroll: true })) renderCurrentThread();
    return true;
  }
  return false;
}

function updateThreadNameLocally(threadId, name) {
  const id = String(threadId || "");
  const title = String(name || "").trim();
  if (!id || !title) return;
  const thread = state.threads.find((entry) => String(entry && entry.id || "") === id);
  applyThreadNameToThread(thread, title);
  applyThreadNameToThread(state.currentThread && String(state.currentThread.id || "") === id ? state.currentThread : null, title);
  applyThreadNameToThread(state.threadTileDetails && state.threadTileDetails.get(String(id)) || null, title);
  scheduleThreadNameDetailRender(id);
  state.renderedThreadListSignature = "";
  renderThreads();
}

function cancelThreadLongPress() {
  if (state.threadLongPress && state.threadLongPress.timer) clearTimeout(state.threadLongPress.timer);
  state.threadLongPress = null;
}

function clearTextSelection() {
  try {
    const selection = window.getSelection && window.getSelection();
    if (selection && typeof selection.removeAllRanges === "function") selection.removeAllRanges();
  } catch (_) {
    // Clearing accidental mobile text selection is best-effort.
  }
}

function openThreadActionSheet(threadId) {
  const id = String(threadId || "");
  const sheet = $("threadActionSheet");
  if (!id || !sheet) return;
  const thread = threadById(id);
  if (!thread) return;
  cancelThreadLongPress();
  clearTextSelection();
  state.threadActionMenuId = id;
  const title = $("threadActionTitle");
  if (title) title.textContent = threadTitleForDisplay(thread) || "Session";
  sheet.classList.remove("hidden");
  setTimeout(clearTextSelection, 0);
  state.suppressThreadClickUntil = Date.now() + 900;
  state.suppressThreadClickThreadId = id;
}

function closeThreadActionSheet() {
  const sheet = $("threadActionSheet");
  if (sheet) sheet.classList.add("hidden");
  state.threadActionMenuId = "";
  publishPluginNavigationState();
}

function scheduleThreadLongPress(target, x, y) {
  const row = threadActionTargetRow(target);
  if (!row) return;
  const threadId = row.dataset.threadRow || "";
  if (!threadId) return;
  cancelThreadLongPress();
  state.threadLongPress = {
    threadId,
    startX: Number(x || 0),
    startY: Number(y || 0),
    timer: setTimeout(() => openThreadActionSheet(threadId), 560),
  };
}

function moveThreadLongPress(x, y) {
  const press = state.threadLongPress;
  if (!press) return;
  if (Math.abs(Number(x || 0) - press.startX) > 12 || Math.abs(Number(y || 0) - press.startY) > 12) {
    cancelThreadLongPress();
  }
}

function handleThreadListContextMenu(event) {
  const row = threadActionTargetRow(event.target);
  if (!row) return;
  event.preventDefault();
  openThreadActionSheet(row.dataset.threadRow || "");
}

function beginThreadLongPress(event) {
  if (event.button != null && event.button !== 0) return;
  scheduleThreadLongPress(event.target, event.clientX, event.clientY);
}

function moveThreadLongPressPointer(event) {
  moveThreadLongPress(event.clientX, event.clientY);
}

function beginThreadLongPressTouch(event) {
  if (event.touches && event.touches.length > 1) return;
  const touch = primaryTouch(event);
  if (!touch) return;
  scheduleThreadLongPress(event.target, touch.clientX, touch.clientY);
}

function moveThreadLongPressTouch(event) {
  const touch = primaryTouch(event);
  if (!touch) return;
  moveThreadLongPress(touch.clientX, touch.clientY);
}

function openRenameDialog(threadId) {
  const id = String(threadId || "");
  const dialog = $("renameDialog");
  const input = $("renameInput");
  if (!id || !dialog || !input) return;
  const thread = threadById(id);
  if (!thread) return;
  state.renameThreadId = id;
  input.value = threadTitleForDisplay(thread);
  dialog.classList.remove("hidden");
  setTimeout(() => {
    input.focus();
    input.select();
  }, 30);
}

function closeRenameDialog(options = {}) {
  if (state.renameBusy && !options.force) return;
  const dialog = $("renameDialog");
  if (dialog) dialog.classList.add("hidden");
  state.renameThreadId = "";
  publishPluginNavigationState();
}

function createWorkspaceDialogOpen() {
  const dialog = $("createWorkspaceDialog");
  return Boolean(dialog && !dialog.classList.contains("hidden"));
}

function updatePanelOpen() {
  const dialog = $("updateDialog");
  return Boolean(dialog && !dialog.classList.contains("hidden"));
}

function workspaceCreateRootLabel() {
  return state.workspaceCreateRoot || state.workspaceCreateRoots[0] || "";
}

function workspaceCreateSelectedRoot() {
  const select = $("createWorkspaceRootSelect");
  return String(select && select.value || workspaceCreateRootLabel() || "").trim();
}

function populateCreateWorkspaceRootSelect() {
  const select = $("createWorkspaceRootSelect");
  if (!select) return;
  const roots = normalizeOptionList(state.workspaceCreateRoots);
  const preferred = workspaceCreateRootLabel();
  select.textContent = "";
  for (const root of roots) {
    const option = document.createElement("option");
    option.value = root;
    option.textContent = root;
    if (normalizeFsPath(root) === normalizeFsPath(preferred)) option.selected = true;
    select.appendChild(option);
  }
  select.hidden = roots.length <= 1;
  if (roots.length <= 1) select.value = roots[0] || "";
}

function setCreateWorkspaceError(message) {
  const errorNode = $("createWorkspaceError");
  if (errorNode) {
    errorNode.textContent = message || "";
    errorNode.hidden = !message;
  }
}

function setCreateWorkspaceBusy(busy) {
  state.workspaceCreateBusy = Boolean(busy);
  const input = $("createWorkspaceInput");
  const rootSelect = $("createWorkspaceRootSelect");
  const submit = $("createWorkspaceSubmit");
  const cancel = $("createWorkspaceCancel");
  if (input) input.disabled = state.workspaceCreateBusy;
  if (rootSelect) rootSelect.disabled = state.workspaceCreateBusy;
  if (submit) submit.disabled = state.workspaceCreateBusy;
  if (cancel) cancel.disabled = state.workspaceCreateBusy;
}

function openCreateWorkspaceDialog() {
  if (!state.workspaceCreateEnabled) {
    showError(new Error("Workspace creation is not enabled"));
    return;
  }
  const dialog = $("createWorkspaceDialog");
  const input = $("createWorkspaceInput");
  const root = $("createWorkspaceRoot");
  if (!dialog || !input) return;
  input.value = "";
  setCreateWorkspaceError("");
  populateCreateWorkspaceRootSelect();
  setCreateWorkspaceBusy(false);
  if (root) {
    const roots = normalizeOptionList(state.workspaceCreateRoots);
    const label = workspaceCreateRootLabel();
    root.textContent = label
      ? (roots.length > 1 ? "Create under" : `Create under ${label}`)
      : "Create a local workspace folder";
  }
  dialog.classList.remove("hidden");
  setTimeout(() => input.focus(), 30);
  publishPluginNavigationState({ force: true });
}

function closeCreateWorkspaceDialog(options = {}) {
  if (state.workspaceCreateBusy && !options.force) return;
  const dialog = $("createWorkspaceDialog");
  if (dialog) dialog.classList.add("hidden");
  setCreateWorkspaceBusy(false);
  setCreateWorkspaceError("");
  publishPluginNavigationState({ force: true });
}

async function selectCreatedWorkspace(workspace) {
  if (!workspace || !workspace.cwd) throw new Error("Workspace create response did not include a path");
  await loadWorkspaces();
  if (!state.workspaces.some((ws) => normalizeFsPath(ws.cwd) === normalizeFsPath(workspace.cwd))) {
    state.workspaces.push(workspace);
  }
  saveCurrentDraftNow();
  state.selectedCwd = workspace.cwd;
  clearCurrentThreadSelection({ saveDraft: false });
  state.newThreadDraft = true;
  state.sendButtonHint = "";
  state.threads = [];
  state.renderedThreadListSignature = "";
  restoreDraftForCurrentTarget();
  syncSidebarWorkspaceSelect();
  updateWorkspacePath();
  renderComposerSettings();
  renderThreads();
  renderCurrentThread();
  updateComposerControls();
  restoreConnectionState("Workspace created");
  loadThreads({ silent: true }).catch(showError);
}

async function submitCreateWorkspace(event) {
  if (event) event.preventDefault();
  if (state.workspaceCreateBusy) return;
  const input = $("createWorkspaceInput");
  const name = String(input && input.value || "").trim();
  if (!name) {
    setCreateWorkspaceError("Workspace name is required");
    if (input) input.focus();
    return;
  }
  setCreateWorkspaceBusy(true);
  setCreateWorkspaceError("");
  try {
    const result = await api("/api/workspaces", {
      method: "POST",
      timeoutMs: 30000,
      body: JSON.stringify({ name, parent: workspaceCreateSelectedRoot() }),
    });
    closeCreateWorkspaceDialog({ force: true });
    await selectCreatedWorkspace(result && result.workspace);
  } catch (err) {
    setCreateWorkspaceError(err.message || String(err));
    setCreateWorkspaceBusy(false);
  }
}

function continuationDialogOpen() {
  const dialog = $("continuationDialog");
  return Boolean(dialog && !dialog.classList.contains("hidden"));
}

function setContinuationDialogStatus(message, options = {}) {
  const statusNode = $("continuationStatus");
  if (!statusNode) return;
  const text = String(message || "").trim();
  statusNode.textContent = text;
  statusNode.classList.toggle("hidden", !text);
  statusNode.classList.toggle("error", Boolean(options.error));
}

function setContinuationDialogBusy(busy, message = "", options = {}) {
  const isBusy = Boolean(busy);
  const confirm = $("continuationConfirm");
  const cancel = $("continuationCancel");
  if (confirm) {
    confirm.disabled = isBusy;
    confirm.textContent = isBusy ? "处理中" : "继续";
  }
  if (cancel) cancel.disabled = isBusy;
  setContinuationDialogStatus(message, options);
}

function openContinuationDialog(sourceThread) {
  const thread = sourceThread || state.currentThread || {};
  const threadId = String(thread.id || state.currentThreadId || "").trim();
  const cwd = thread.cwd ? String(thread.cwd).trim() : String(state.selectedCwd || "").trim();
  if (!cwd) {
    showError(new Error("Thread has no workspace path"));
    return false;
  }
  const dialog = $("continuationDialog");
  if (!dialog) return false;
  state.continuationDialogThreadId = threadId || "__current__";
  const title = threadTitleForDisplay(thread) || "current thread";
  const titleNode = $("continuationTitle");
  const summaryNode = $("continuationSummary");
  if (titleNode) titleNode.textContent = `压缩续接“${title}”`;
  if (summaryNode) {
    const size = rolloutSizeText(thread);
    summaryNode.textContent = [
      "会创建一个同工作区的新线程。",
      "成功后自动归档旧线程。",
      size ? `当前 rollout 大小：${size}` : "",
    ].filter(Boolean).join(" ");
  }
  setContinuationDialogBusy(false);
  postClientEvent("continuation_dialog_opened", {
    sourceThreadId: threadId,
    hasWorkspace: Boolean(cwd),
    rolloutBytes: Number(thread.rolloutSizeBytes || 0) || 0,
  });
  dialog.classList.remove("hidden");
  setTimeout(clearTextSelection, 0);
  publishPluginNavigationState({ force: true });
  return true;
}

function closeContinuationDialog(options = {}) {
  if (state.continuationBusy && !options.force) {
    setContinuationDialogStatus("续接任务正在运行，请稍等。");
    postClientEvent("continuation_dialog_close_blocked", {
      jobId: state.continuationJobId || "",
      sourceThreadId: state.continuationSourceThreadId || "",
    });
    return false;
  }
  const dialog = $("continuationDialog");
  if (dialog) dialog.classList.add("hidden");
  state.continuationDialogThreadId = "";
  setContinuationDialogBusy(false);
  publishPluginNavigationState({ force: true });
  return true;
}

function continuationDialogSourceThread() {
  const threadId = String(state.continuationDialogThreadId || "").trim();
  if (!threadId || threadId === "__current__") return state.currentThread || null;
  return threadById(threadId)
    || (state.threadTileDetails && state.threadTileDetails.has(threadId) ? state.threadTileDetails.get(threadId) : null);
}

function confirmContinuationDialog() {
  const thread = continuationDialogSourceThread();
  if (!thread) {
    showError(new Error("Continuation source thread is no longer available"));
    return;
  }
  startNewThreadFromThread(thread).catch(showError);
}

function pluginNavigationUiState() {
  return {
    imagePreviewOpen: imagePreviewOpen(),
    filePreviewOpen: filePreviewOpen(),
    mermaidPreviewOpen: mermaidPreviewOpen(),
    createWorkspaceOpen: createWorkspaceDialogOpen(),
    updatePanelOpen: updatePanelOpen(),
    primaryPage: isHermesPluginPrimaryPage(),
    sidebarOpen: isSidebarOpen(),
    settingsOpen: Boolean($("themeSettingsPanel") && !$("themeSettingsPanel").classList.contains("hidden")),
  };
}

function publishPluginNavigationState(options = {}) {
  if (!isHermesEmbedMode()) return;
  syncHermesPluginPageLevel();
  const message = pluginEmbedApi.navigationMessage
    ? pluginEmbedApi.navigationMessage(state, pluginNavigationUiState())
    : null;
  if (!message) return;
  const signature = JSON.stringify(message);
  if (!options.force && signature === state.pluginNavigationSignature) return;
  state.pluginNavigationSignature = signature;
  const targetOrigin = normalizePluginParentOrigin(state.pluginParentOrigin);
  if (targetOrigin) state.pluginParentOrigin = targetOrigin;
  pluginEmbedApi.postNavigation(window.parent, state, {
    targetOrigin: targetOrigin || "*",
    ui: pluginNavigationUiState(),
  });
}

function postPluginBackResult(handled, reason) {
  if (!isHermesEmbedMode() || !pluginEmbedApi.postBackResult) return null;
  const targetOrigin = normalizePluginParentOrigin(state.pluginParentOrigin);
  if (targetOrigin) state.pluginParentOrigin = targetOrigin;
  return pluginEmbedApi.postBackResult(window.parent, state, {
    targetOrigin: targetOrigin || "*",
    ui: pluginNavigationUiState(),
    handled,
    reason,
  });
}

function externalLinkDiagnostics(href, source = "receipt-link", opened = false) {
  const details = {
    source: String(source || "receipt-link").slice(0, 80),
    opened: Boolean(opened),
  };
  try {
    const url = new URL(href, window.location.origin);
    details.protocol = String(url.protocol || "").replace(/:$/, "").slice(0, 16);
    details.hostHash = diagnosticHash(`external-link-host:${url.host}`);
  } catch (_) {
    details.protocol = "unknown";
  }
  return details;
}

function postPluginExternalLink(href, source = "receipt-link") {
  if (!isHermesEmbedMode() || !pluginEmbedApi.postExternalLink) return null;
  const targetOrigin = normalizePluginParentOrigin(state.pluginParentOrigin);
  if (targetOrigin) state.pluginParentOrigin = targetOrigin;
  return pluginEmbedApi.postExternalLink(window.parent, {
    href,
    origin: window.location.origin,
    source,
  }, {
    targetOrigin: targetOrigin || "*",
  });
}

function openPluginExternalBrowserLink(rawHref, options = {}) {
  const href = pluginEmbedApi.externalBrowserUrl
    ? pluginEmbedApi.externalBrowserUrl(rawHref, window.location.origin)
    : "";
  if (!href) return null;
  const source = String(options.source || "receipt-link").slice(0, 80) || "receipt-link";
  postPluginExternalLink(href, source);
  const opener = options.openWindow || null;
  let opened = null;
  if (typeof opener === "function") {
    try {
      opened = opener.call(window, href, "_blank", "noopener,noreferrer");
    } catch (err) {
      postClientEvent("plugin_external_link_open_failed", Object.assign(externalLinkDiagnostics(href, source, false), {
        message: String(err && err.message || err || "").slice(0, 160),
      }));
      return null;
    }
  }
  postClientEvent("plugin_external_link_opened", externalLinkDiagnostics(href, source, Boolean(opened)));
  return opened;
}

function pluginEmbedBackSwipeCanHandle() {
  if (!isHermesEmbedMode() || !pluginEmbedApi.navigationMessage) return false;
  const message = pluginEmbedApi.navigationMessage(state, pluginNavigationUiState());
  return Boolean(message && message.canGoBack);
}

function pluginEmbedBackSwipeInteractiveTarget(target) {
  return Boolean(target?.closest?.(
    "input, select, textarea, button, a, [role='button'], [contenteditable='true'], .composer, .dialog, .modal, .app-native-dialog, .file-preview-dialog"
  ));
}

function installHermesPluginBackSwipeGuard() {
  if (!isHermesEmbedMode()) return;
  const root = document.documentElement;
  if (!root || root.dataset.pluginBackSwipeGuardBound) return;
  root.dataset.pluginBackSwipeGuardBound = "1";
  let swipe = null;
  const clear = () => {
    swipe = null;
  };
  const stopNativeBack = (event) => {
    if (event && event.cancelable) event.preventDefault();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
  };
  const startPluginBackSwipe = (event) => {
    if (!isHermesEmbedMode() || event.touches?.length !== 1 || !pluginEmbedBackSwipeCanHandle()) {
      clear();
      return;
    }
    if (pluginEmbedBackSwipeInteractiveTarget(event.target)) {
      clear();
      return;
    }
    const point = event.touches[0];
    if (!point || point.clientX > PLUGIN_EMBED_BACK_EDGE_SWIPE_PX) {
      clear();
      return;
    }
    swipe = {
      startX: point.clientX,
      startY: point.clientY,
      lastX: point.clientX,
      lastY: point.clientY,
      startedAt: performance.now(),
      moved: false,
    };
    stopNativeBack(event);
  };
  const movePluginBackSwipe = (event) => {
    if (!swipe || !isHermesEmbedMode() || event.touches?.length !== 1) return;
    const point = event.touches[0];
    const dx = point.clientX - swipe.startX;
    const dy = point.clientY - swipe.startY;
    const horizontal = Math.abs(dx);
    const vertical = Math.abs(dy);
    swipe.lastX = point.clientX;
    swipe.lastY = point.clientY;
    if (vertical > 12 && vertical > horizontal) {
      clear();
      return;
    }
    if (dx <= 0 || horizontal < 10 || horizontal < vertical * PLUGIN_EMBED_BACK_SWIPE_HORIZONTAL_RATIO) return;
    swipe.moved = true;
    stopNativeBack(event);
  };
  const finishPluginBackSwipe = (event) => {
    const current = swipe;
    clear();
    if (!current || !isHermesEmbedMode()) return;
    const point = event.changedTouches?.[0];
    const dx = (point ? point.clientX : current.lastX) - current.startX;
    const dy = (point ? point.clientY : current.lastY) - current.startY;
    const horizontal = Math.abs(dx);
    const vertical = Math.abs(dy);
    if (!current.moved) return;
    if (dx >= PLUGIN_EMBED_BACK_SWIPE_MIN_PX
      && horizontal >= vertical * PLUGIN_EMBED_BACK_SWIPE_HORIZONTAL_RATIO) {
      stopNativeBack(event);
      handlePluginBack({
        preventDefault() {},
        stopPropagation() {},
      }, { source: "plugin-back-swipe" });
    }
  };
  document.addEventListener("touchstart", startPluginBackSwipe, { passive: false, capture: true });
  document.addEventListener("touchmove", movePluginBackSwipe, { passive: false, capture: true });
  document.addEventListener("touchend", finishPluginBackSwipe, { passive: false, capture: true });
  document.addEventListener("touchcancel", clear, { passive: true, capture: true });
}

function shouldSuppressPluginBackForRecentConversationScroll(source = "") {
  if (source !== "plugin-back-swipe") return false;
  if (!state.currentThreadId || !state.currentThread) return false;
  const elapsedMs = Date.now() - Number(state.conversationScrollIntentAtMs || 0);
  if (elapsedMs < 0 || elapsedMs > PLUGIN_EMBED_BACK_RECENT_SCROLL_SUPPRESS_MS) return false;
  postClientEvent("plugin_back_suppressed_recent_conversation_scroll", {
    source: String(source || "").slice(0, 80),
    threadId: state.currentThreadId || "",
    elapsedMs,
    consumedInIframe: true,
  });
  postPluginBackResult(true, "suppressed_recent_conversation_scroll");
  return true;
}

function handlePluginBack(event, options = {}) {
  if (!isHermesEmbedMode()) return;
  if (event && typeof event.preventDefault === "function") event.preventDefault();
  if (event && typeof event.stopPropagation === "function") event.stopPropagation();
  const source = String(options.source || "plugin-back");
  if (shouldSuppressPluginBackForRecentConversationScroll(source)) return true;
  let handled = false;
  if (imagePreviewOpen()) {
    closeImagePreview();
    handled = true;
  } else if (mermaidPreviewOpen()) {
    closeMermaidPreview();
    handled = true;
  } else if (filePreviewOpen()) {
    closeFilePreview();
    handled = true;
  } else if (state.renameThreadId) {
    closeRenameDialog({ force: true });
    handled = true;
  } else if (createWorkspaceDialogOpen()) {
    closeCreateWorkspaceDialog({ force: true });
    handled = true;
  } else if (updatePanelOpen()) {
    closeUpdatePanel();
    handled = true;
  } else if (state.continuationDialogThreadId) {
    closeContinuationDialog();
    handled = true;
  } else if (state.threadActionMenuId) {
    closeThreadActionSheet();
    handled = true;
  } else if (state.subagentPanelOpen) {
    state.subagentPanelOpen = false;
    cancelSubagentSwipe();
    updateSubagentPanelUi();
    renderCurrentThread();
    handled = true;
  } else if (state.currentThreadId || state.newThreadDraft || state.selectedCwd) {
    handled = showHermesPluginPrimaryPage({ force: true, source });
  } else if (isSidebarOpen()) {
    closeSidebarMenu();
    handled = true;
  }
  publishPluginNavigationState({ force: true });
  if (handled) postPluginBackResult(true, source || "handled_in_iframe");
  return handled;
}

function installPluginWindowingGuards() {
  if (!isHermesEmbedMode()) return;
  const originalOpen = window.open;
  window.open = function guardedPluginOpen(url, target, features) {
    const value = String(url || "");
    if (pluginEmbedApi.isInternalUrl && pluginEmbedApi.isInternalUrl(value, window.location.origin)) {
      window.location.assign(value);
      return window;
    }
    if (pluginEmbedApi.externalBrowserUrl && pluginEmbedApi.externalBrowserUrl(value, window.location.origin)) {
      return openPluginExternalBrowserLink(value, {
        source: "window-open",
        openWindow: originalOpen,
      });
    }
    postClientEvent("plugin_window_blocked", {
      target: String(target || "").slice(0, 80),
      features: String(features || "").slice(0, 160),
      reason: "unsupported_external_window",
    });
    return null;
  };
  window.open.originalCodexMobileOpen = originalOpen;
  document.addEventListener("click", (event) => {
    const link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!link) return;
    const href = link.getAttribute("href") || "";
    const target = String(link.getAttribute("target") || "").toLowerCase();
    const internal = pluginEmbedApi.isInternalUrl ? pluginEmbedApi.isInternalUrl(href, window.location.origin) : false;
    if (target === "_blank" || !internal) {
      event.preventDefault();
      event.stopPropagation();
      if (internal) window.location.assign(new URL(href, window.location.origin).toString());
      else {
        if (pluginEmbedApi.externalBrowserUrl && pluginEmbedApi.externalBrowserUrl(href, window.location.origin)) {
          openPluginExternalBrowserLink(href, {
            source: "receipt-link",
            openWindow: originalOpen,
          });
        } else {
          postClientEvent("plugin_external_link_blocked", Object.assign(externalLinkDiagnostics(href, "receipt-link", false), {
            reason: "unsupported_external_link",
          }));
        }
      }
    }
  }, true);
}

async function submitRename(event) {
  event.preventDefault();
  if (state.renameBusy) return;
  const threadId = state.renameThreadId;
  const input = $("renameInput");
  const submit = $("renameSubmit");
  const name = String(input && input.value || "").trim();
  if (!threadId || !name) {
    if (input) input.focus();
    return;
  }
  state.renameBusy = true;
  if (submit) submit.disabled = true;
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "正在重命名";
  try {
    const result = await api(`/api/threads/${encodeURIComponent(threadId)}/name`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
      timeoutMs: 20000,
    });
    updateThreadNameLocally(threadId, result.name || name);
    closeRenameDialog({ force: true });
    restoreConnectionState("已重命名");
  } catch (err) {
    showError(err);
  } finally {
    state.renameBusy = false;
    if (submit) submit.disabled = false;
  }
}

async function copyThreadIdFromActionSheet(threadId) {
  const id = String(threadId || "").trim();
  if (!id) return;
  closeThreadActionSheet();
  await copyTextToClipboard(id);
  restoreConnectionState("已复制 Session ID");
}

function handleThreadAction(event) {
  const target = event.target.closest("[data-thread-action]");
  if (!target) return;
  event.preventDefault();
  const action = target.dataset.threadAction;
  const threadId = state.threadActionMenuId;
  if (action === "cancel") {
    closeThreadActionSheet();
    return;
  }
  if (action === "rename") {
    closeThreadActionSheet();
    openRenameDialog(threadId);
    return;
  }
  if (action === "copy-id") {
    copyThreadIdFromActionSheet(threadId).catch(showError);
    return;
  }
  if (action === "continue") {
    const thread = threadById(threadId);
    closeThreadActionSheet();
    if (thread) startNewThreadFromThread(thread, event).catch(showError);
    return;
  }
  if (action === "archive") {
    closeThreadActionSheet();
    archiveThread(threadId, target).catch(showError);
  }
}

function renderThreads(...args) {
  return threadListRuntime.renderThreads(...args);
}
function restoreThreadSelection(...args) {
  return threadListRuntime.restoreThreadSelection(...args);
}
function restoreNewThreadDraftSelection(...args) {
  return threadListRuntime.restoreNewThreadDraftSelection(...args);
}
function selectWorkspaceShortcut(...args) {
  return threadListRuntime.selectWorkspaceShortcut(...args);
}
function patchNode(target, source) {
  return threadDetailDomPatchApi.patchNode(target, source);
}

function patchHtml(target, html) {
  const patchResult = threadDetailDomPatchApi.patchHtml({ target, html, document });
  if (!patchResult || !patchResult.ok) throw new Error(patchResult && patchResult.reason || "patch-html-failed");
  return patchResult.target || target;
}

function checkPrimaryShellSelectionConflictAfterRender(metrics = {}) {
  if (!isHermesEmbedMode() || !isHermesPluginPrimaryPage()) return;
  if (!recentThreadDetailRenderEvidence()) return;
  recordPrimaryShellSelectionConflict("primary_shell_render_after_detail", {
    source: "conversation-render",
    renderMode: "primary-shell",
    domCount: metrics.childCount,
    previousCount: metrics.previousChildCount,
  });
}

function updateConversationHtml(html, signature, options = {}) {
  const conversation = $("conversation");
  const scrollAnchor = options.stickToBottom
    ? null
    : captureConversationViewportAnchor({ userReadingCurrentTurn: Boolean(options.userReadingCurrentTurn) });
  const preDomShape = conversationDomShape();
  const expectedVisibleTurnCount = Math.max(0, Number(options.expectedVisibleTurnCount || 0));
  const expectedVisibleItemCount = Math.max(0, Number(options.expectedVisibleItemCount || 0));
  const renderedDomTurnCount = Object.prototype.hasOwnProperty.call(options, "renderedDomTurnCount")
    ? Math.max(0, Number(options.renderedDomTurnCount || 0))
    : preDomShape.turnCount;
  const renderedDomItemCount = Object.prototype.hasOwnProperty.call(options, "renderedDomItemCount")
    ? Math.max(0, Number(options.renderedDomItemCount || 0))
    : preDomShape.itemCount;
  const duplicateRenderKeyCount = Object.prototype.hasOwnProperty.call(options, "duplicateRenderKeyCount")
    ? Math.max(0, Number(options.duplicateRenderKeyCount || 0))
    : preDomShape.duplicateRenderKeyCount;
  const duplicateUserMessageCount = Object.prototype.hasOwnProperty.call(options, "duplicateUserMessageCount")
    ? Math.max(0, Number(options.duplicateUserMessageCount || 0))
    : preDomShape.duplicateUserMessageCount;
  const expectedDuplicateUserMessageCount = Object.prototype.hasOwnProperty.call(options, "expectedDuplicateUserMessageCount")
    ? Math.max(0, Number(options.expectedDuplicateUserMessageCount || 0))
    : 0;
  const renderedDomTurnIds = Array.isArray(options.renderedDomTurnIds)
    ? options.renderedDomTurnIds.map(String).filter(Boolean)
    : conversationDomTurnIds(conversation);
  const expectedTurnIds = Array.isArray(options.expectedTurnIds)
    ? options.expectedTurnIds.map(String).filter(Boolean)
    : [];
  const updatePlan = threadDetailDomPatchApi.planConversationHtmlUpdate({
    signature,
    renderedConversationSignature: state.renderedConversationSignature,
    renderedConversationPatchShellSignature: state.renderedConversationPatchShellSignature,
    patchShellSignature: options.patchShellSignature,
    stickToBottom: options.stickToBottom,
    hasExistingChildren: Boolean(conversation && conversation.childNodes && conversation.childNodes.length),
    expectedVisibleTurnCount,
    renderedDomTurnCount,
    expectedVisibleItemCount,
    renderedDomItemCount,
    duplicateRenderKeyCount,
    duplicateUserMessageCount,
    expectedDuplicateUserMessageCount,
    expectedTurnIds,
    renderedDomTurnIds,
  });
  const effectsPlan = threadDetailDomPatchApi.planConversationHtmlUpdateEffects(updatePlan);
  const shouldCheckProjectionConsistency = options.checkProjectionConsistency === true;
  const projectionConsistencySource = String(options.source || "conversation-update");
  if (updatePlan.action === "hydrate-existing") {
    applyConversationHtmlUpdateEffectsPlan(effectsPlan, { root: conversation });
    restoreConversationViewportAnchor(scrollAnchor);
    if (shouldCheckProjectionConsistency) {
      checkConversationProjectionConsistency(projectionConsistencySource, {
        renderMode: String(options.renderMode || updatePlan.action || ""),
      });
    }
    return false;
  }
  const previousChildCount = conversation ? conversation.childNodes.length : 0;
  const authorityInvalidationPlan = threadDetailDomPatchApi.planConversationDomAuthorityInvalidation({
    updatePlan,
    source: options.source || "conversation-update",
    action: options.action,
    routeKind: options.routeKind,
    threadHash: options.threadHash,
    currentTurns: Object.prototype.hasOwnProperty.call(options, "currentTurns") ? options.currentTurns : undefined,
    currentVisibleItems: Object.prototype.hasOwnProperty.call(options, "currentVisibleItems") ? options.currentVisibleItems : undefined,
    expectedVisibleTurnCount,
    renderedDomTurnCount,
    expectedVisibleItemCount,
    renderedDomItemCount,
    duplicateRenderKeyCount,
    duplicateUserMessageCount,
    expectedDuplicateUserMessageCount,
    previousChildCount,
    threadId: state.currentThreadId || "",
  });
  if (authorityInvalidationPlan.shouldRecordMismatch) {
    recordEmptyVisibleDetailMismatch(
      authorityInvalidationPlan.mismatchReason,
      state.currentThread,
      authorityInvalidationPlan.mismatchPayload || {},
    );
  }
  if (authorityInvalidationPlan.shouldPostClientEvent) {
    postClientEvent(authorityInvalidationPlan.clientEventName, authorityInvalidationPlan.clientEventPayload);
  }
  const startedAt = nowPerfMs();
  let applicationPlan = threadDetailDomPatchApi.planConversationHtmlUpdateApplication({
    updatePlan,
  });
  if (updatePlan.action === "patch-html") {
    const patchResult = threadDetailDomPatchApi.patchHtml({ target: conversation, html, document });
    applicationPlan = threadDetailDomPatchApi.planConversationHtmlUpdateApplication({
      updatePlan,
      patchResult,
    });
    if (applicationPlan.fallbackApplied) conversation.innerHTML = html;
  } else if (updatePlan.action === "set-inner-html") {
    conversation.innerHTML = html;
  }
  const postDomShape = conversationDomShape();
  const postApplyConsistencyPlan = threadDetailDomPatchApi.planConversationPostApplyDomConsistency({
    updatePlan,
    applicationPlan,
    expectedVisibleTurnCount,
    renderedDomTurnCount: postDomShape.turnCount,
    expectedVisibleItemCount,
    renderedDomItemCount: postDomShape.itemCount,
    duplicateRenderKeyCount: postDomShape.duplicateRenderKeyCount,
    duplicateUserMessageCount: postDomShape.duplicateUserMessageCount,
    expectedDuplicateUserMessageCount,
    expectedTurnIds,
    renderedDomTurnIds: conversationDomTurnIds(conversation),
    readMode: state.currentThread && state.currentThread.mobileReadMode || "",
  });
  if (postApplyConsistencyPlan.shouldFallbackToInnerHtml && conversation) {
    conversation.innerHTML = html;
    applicationPlan = Object.assign({}, applicationPlan, {
      finalAction: "set-inner-html",
      fallbackApplied: true,
      patchRejectReason: postApplyConsistencyPlan.reason,
      reason: "post-apply-dom-inconsistent",
    });
  }
  if (postApplyConsistencyPlan.shouldReport) {
    recordHomeAiDiagnosticFailure(
      threadDiagnosticEventsApi.detailPatchRejectedDiagnosticEvent(postApplyConsistencyPlan.diagnosticInput || {}),
    );
  }
  const fallbackEventPlan = threadDetailDomPatchApi.planConversationHtmlPatchFallbackClientEvent({
    applicationPlan,
    updatePlan,
    threadId: state.currentThreadId || "",
    expectedVisibleTurnCount,
    renderedDomTurnCount,
  });
  if (fallbackEventPlan.shouldPost) postClientEvent(fallbackEventPlan.eventName, fallbackEventPlan.payload);
  applyConversationHtmlUpdateEffectsPlan(effectsPlan, { root: conversation });
  restoreConversationViewportAnchor(scrollAnchor);
  if (shouldCheckProjectionConsistency) {
    checkConversationProjectionConsistency(projectionConsistencySource, {
      renderMode: String(options.renderMode || applicationPlan.finalAction || updatePlan.action || ""),
    });
  }
  const renderElapsedMs = roundedDurationMs(startedAt);
  const performancePlan = threadDetailDomPatchApi.planConversationHtmlPerformanceEvent({
    updatePlan,
    applicationPlan,
    renderElapsedMs,
    previousChildCount,
    childCount: conversation ? conversation.childNodes.length : 0,
    stickToBottom: Boolean(options.stickToBottom),
    threadId: state.currentThreadId || "",
    currentThreadStatus: statusText(state.currentThread && state.currentThread.status),
    html,
    slowThresholdMs: PERF_SLOW_RENDER_REPORT_MS,
    minIntervalMs: PERF_EVENT_THROTTLE_MS,
  });
  postPerformanceEvent(performancePlan.eventName, performancePlan.payload, performancePlan.options);
  applyFrontendRuntimeHealthEffectsPlan(state.frontendRuntimeHealthMonitor.recordRender({
    action: options.source || "conversation-update",
    routeKind: options.routeKind || diagnosticRouteKind(),
    threadHash: options.threadHash || diagnosticThreadHash(state.currentThreadId),
    readMode: state.currentThread && state.currentThread.mobileReadMode || "",
    renderMode: String(options.renderMode || applicationPlan.finalAction || updatePlan.action || ""),
    finalAction: String(applicationPlan.finalAction || updatePlan.action || ""),
    renderPlanReason: String(updatePlan.reason || applicationPlan.reason || ""),
    patchRejectReason: String(applicationPlan.patchRejectReason || postApplyConsistencyPlan.reason || ""),
    fallbackApplied: Boolean(applicationPlan.fallbackApplied),
    fullRender: String(applicationPlan.finalAction || updatePlan.action || "") === "set-inner-html",
    previousCount: previousChildCount,
    domCount: conversation ? conversation.childNodes.length : 0,
    visibleCount: expectedVisibleItemCount,
    duplicateCount: postDomShape.duplicateRenderKeyCount,
    renderElapsedMs,
  }));
  checkPrimaryShellSelectionConflictAfterRender({
    childCount: conversation ? conversation.childNodes.length : 0,
    previousChildCount,
  });
  return true;
}

function updateCurrentThreadHeader(thread = state.currentThread) {
  const titleEl = $("threadTitle");
  const metaEl = $("threadMeta");
  if (titleEl) titleEl.textContent = thread ? (thread.name || thread.preview || thread.id) : "Select a thread";
  if (metaEl) metaEl.textContent = "";
}

function updateThreadTileGlobalHeader(...args) {
  return threadTileRuntime.updateThreadTileGlobalHeader(...args);
}
function viewportPixelSize(...args) {
  return threadTileRuntime.viewportPixelSize(...args);
}
function isCoarsePointerViewport(...args) {
  return threadTileRuntime.isCoarsePointerViewport(...args);
}
function isThreadTileKeyboardFocusActive(...args) {
  return threadTileRuntime.isThreadTileKeyboardFocusActive(...args);
}
function threadTileViewportSize(...args) {
  return threadTileRuntime.threadTileViewportSize(...args);
}
function threadTileVerticalChromePx(...args) {
  return threadTileRuntime.threadTileVerticalChromePx(...args);
}
function threadTileLayout(...args) {
  return threadTileRuntime.threadTileLayout(...args);
}
function normalizeThreadTilePaneCount(...args) {
  return threadTileRuntime.normalizeThreadTilePaneCount(...args);
}
function threadTileLayoutCapacity(...args) {
  return threadTileRuntime.threadTileLayoutCapacity(...args);
}
function defaultThreadTileCandidateIds(...args) {
  return threadTileRuntime.defaultThreadTileCandidateIds(...args);
}
function threadTileRunningPaneIds(...args) {
  return threadTileRuntime.threadTileRunningPaneIds(...args);
}
function threadTilePaneCountState(...args) {
  return threadTileRuntime.threadTilePaneCountState(...args);
}
function autoThreadTilePaneCount(...args) {
  return threadTileRuntime.autoThreadTilePaneCount(...args);
}
function effectiveThreadTilePaneCount(...args) {
  return threadTileRuntime.effectiveThreadTilePaneCount(...args);
}
function threadTileDisplayLayout(...args) {
  return threadTileRuntime.threadTileDisplayLayout(...args);
}
function normalizeThreadTilePinnedIds(...args) {
  return threadTileRuntime.normalizeThreadTilePinnedIds(...args);
}
function normalizeThreadTileSplitPairs(...args) {
  return threadTileRuntime.normalizeThreadTileSplitPairs(...args);
}
function threadTilePrunedSplitPairs(...args) {
  return threadTileRuntime.threadTilePrunedSplitPairs(...args);
}
function threadTileVisibleIdSet(...args) {
  return threadTileRuntime.threadTileVisibleIdSet(...args);
}
function threadTileIdsEqual(...args) {
  return threadTileRuntime.threadTileIdsEqual(...args);
}
function threadTileCandidateIds(...args) {
  return threadTileRuntime.threadTileCandidateIds(...args);
}
function threadDisplaySettingsPayload(...args) {
  return threadTileRuntime.threadDisplaySettingsPayload(...args);
}
function localThreadDisplayMode(...args) {
  return threadTileRuntime.localThreadDisplayMode(...args);
}
function mirrorThreadDisplayModeToLocalStorage(...args) {
  return threadTileRuntime.mirrorThreadDisplayModeToLocalStorage(...args);
}
function applyThreadDisplaySettings(...args) {
  return threadTileRuntime.applyThreadDisplaySettings(...args);
}
function loadThreadDisplaySettings(...args) {
  return threadTileRuntime.loadThreadDisplaySettings(...args);
}
function saveThreadDisplaySettingsNow(...args) {
  return threadTileRuntime.saveThreadDisplaySettingsNow(...args);
}
function scheduleThreadDisplaySettingsSave(...args) {
  return threadTileRuntime.scheduleThreadDisplaySettingsSave(...args);
}
function syncThreadTileActivePaneState(...args) {
  return threadTileRuntime.syncThreadTileActivePaneState(...args);
}
function threadTileSummary(...args) {
  return threadTileRuntime.threadTileSummary(...args);
}
function threadTileDisplayThread(...args) {
  return threadTileRuntime.threadTileDisplayThread(...args);
}
function setThreadTileSelectedThread(...args) {
  return threadTileRuntime.setThreadTileSelectedThread(...args);
}
function applyThreadTileSelectedPaneEffects(...args) {
  return threadTileRuntime.applyThreadTileSelectedPaneEffects(...args);
}
function threadTileVisibleThreadOptions(...args) {
  return threadTileRuntime.threadTileVisibleThreadOptions(...args);
}
function renderThreadTileSwitchMenu(...args) {
  return threadTileRuntime.renderThreadTileSwitchMenu(...args);
}
function applyThreadTilePaneSlotEffects(...args) {
  return threadTileRuntime.applyThreadTilePaneSlotEffects(...args);
}
function replaceThreadTilePaneThread(...args) {
  return threadTileRuntime.replaceThreadTilePaneThread(...args);
}
function moveThreadTilePaneRelative(...args) {
  return threadTileRuntime.moveThreadTilePaneRelative(...args);
}
function splitThreadTilePaneWithTarget(...args) {
  return threadTileRuntime.splitThreadTilePaneWithTarget(...args);
}
function dropThreadTilePane(...args) {
  return threadTileRuntime.dropThreadTilePane(...args);
}
function replaceLastThreadTilePaneForThreadListOpen(...args) {
  return threadTileRuntime.replaceLastThreadTilePaneForThreadListOpen(...args);
}
function toggleThreadTileSwitchMenu(...args) {
  return threadTileRuntime.toggleThreadTileSwitchMenu(...args);
}
function threadTileHasLiveThread(...args) {
  return threadTileRuntime.threadTileHasLiveThread(...args);
}
function updateThreadTilePaneStatusBadges(...args) {
  return threadTileRuntime.updateThreadTilePaneStatusBadges(...args);
}
function threadTileError(...args) {
  return threadTileRuntime.threadTileError(...args);
}
function threadTilePaneIsVisible(...args) {
  return threadTileRuntime.threadTilePaneIsVisible(...args);
}
function setThreadTileConversationMode(...args) {
  return threadTileRuntime.setThreadTileConversationMode(...args);
}
function captureThreadTilePaneScrollState(...args) {
  return threadTileRuntime.captureThreadTilePaneScrollState(...args);
}
function captureThreadTilePaneElementScrollState(...args) {
  return threadTileRuntime.captureThreadTilePaneElementScrollState(...args);
}
function scrollThreadTilePaneBodyToBottom(...args) {
  return threadTileRuntime.scrollThreadTilePaneBodyToBottom(...args);
}
function isThreadTilePaneNearBottom(...args) {
  return threadTileRuntime.isThreadTilePaneNearBottom(...args);
}
function applyThreadTilePaneScrollHoldPlan(...args) {
  return threadTileRuntime.applyThreadTilePaneScrollHoldPlan(...args);
}
function rememberThreadTilePaneScrollPosition(...args) {
  return threadTileRuntime.rememberThreadTilePaneScrollPosition(...args);
}
function updateThreadTileBottomButtonForBody(...args) {
  return threadTileRuntime.updateThreadTileBottomButtonForBody(...args);
}
function updateThreadTileBottomButtons(...args) {
  return threadTileRuntime.updateThreadTileBottomButtons(...args);
}
function restoreThreadTilePaneScrollState(...args) {
  return threadTileRuntime.restoreThreadTilePaneScrollState(...args);
}
function restoreThreadTilePaneElementScrollState(...args) {
  return threadTileRuntime.restoreThreadTilePaneElementScrollState(...args);
}
function scrollThreadTilePaneToBottom(...args) {
  return threadTileRuntime.scrollThreadTilePaneToBottom(...args);
}
function clearThreadTileRefreshTimer(...args) {
  return threadTileRuntime.clearThreadTileRefreshTimer(...args);
}
function clearThreadTileDetailLoadQueueTimer(...args) {
  return threadTileRuntime.clearThreadTileDetailLoadQueueTimer(...args);
}
function scheduleThreadTileDetailLoadQueueDrain(...args) {
  return threadTileRuntime.scheduleThreadTileDetailLoadQueueDrain(...args);
}
function scheduleThreadTileRefresh(...args) {
  return threadTileRuntime.scheduleThreadTileRefresh(...args);
}
function refreshThreadTileDetails(...args) {
  return threadTileRuntime.refreshThreadTileDetails(...args);
}
function abortThreadTileLoads(...args) {
  return threadTileRuntime.abortThreadTileLoads(...args);
}
function loadThreadTileDetail(...args) {
  return threadTileRuntime.loadThreadTileDetail(...args);
}
function applyThreadTileDetailLoadStartEffects(...args) {
  return threadTileRuntime.applyThreadTileDetailLoadStartEffects(...args);
}
function applyThreadTileDetailLoadSuccessEffects(...args) {
  return threadTileRuntime.applyThreadTileDetailLoadSuccessEffects(...args);
}
function applyThreadTileDetailLoadErrorEffects(...args) {
  return threadTileRuntime.applyThreadTileDetailLoadErrorEffects(...args);
}
function applyThreadTileDetailLoadFinallyEffects(...args) {
  return threadTileRuntime.applyThreadTileDetailLoadFinallyEffects(...args);
}
function applyThreadTileDetailLoadQueuePlan(...args) {
  return threadTileRuntime.applyThreadTileDetailLoadQueuePlan(...args);
}
function ensureThreadTileDetails(...args) {
  return threadTileRuntime.ensureThreadTileDetails(...args);
}
function renderThreadTileTurn(...args) {
  return threadTileRuntime.renderThreadTileTurn(...args);
}
function scheduleThreadTileOperationMinimumRefresh(...args) {
  return threadTileRuntime.scheduleThreadTileOperationMinimumRefresh(...args);
}
function rememberThreadTileOperationBubble(...args) {
  return threadTileRuntime.rememberThreadTileOperationBubble(...args);
}
function clearThreadTileOperationBubble(...args) {
  return threadTileRuntime.clearThreadTileOperationBubble(...args);
}
function renderThreadTileOperationDock(...args) {
  return threadTileRuntime.renderThreadTileOperationDock(...args);
}
function threadTileOperationSignature(...args) {
  return threadTileRuntime.threadTileOperationSignature(...args);
}
function applyThreadTileOperationModeTogglePlan(...args) {
  return threadTileRuntime.applyThreadTileOperationModeTogglePlan(...args);
}
function threadTileMinimumPaneCount(...args) {
  return threadTileRuntime.threadTileMinimumPaneCount(...args);
}
function threadTileMaximumPaneCount(...args) {
  return threadTileRuntime.threadTileMaximumPaneCount(...args);
}
function setThreadTilePaneCount(...args) {
  return threadTileRuntime.setThreadTilePaneCount(...args);
}
function changeThreadTilePaneCount(...args) {
  return threadTileRuntime.changeThreadTilePaneCount(...args);
}
function closeThreadTilePane(...args) {
  return threadTileRuntime.closeThreadTilePane(...args);
}
function renderThreadTilePane(...args) {
  return threadTileRuntime.renderThreadTilePane(...args);
}
function threadTilePaneElement(...args) {
  return threadTileRuntime.threadTilePaneElement(...args);
}
function threadTileRenderSignature(...args) {
  return threadTileRuntime.threadTileRenderSignature(...args);
}
function patchThreadTilePane(...args) {
  return threadTileRuntime.patchThreadTilePane(...args);
}
function isThreadTileConversationSurface(...args) {
  return threadTileRuntime.isThreadTileConversationSurface(...args);
}
function threadDetailDomPatchSurface(...args) {
  return threadTileRuntime.threadDetailDomPatchSurface(...args);
}
function canPatchSingleThreadConversationDom(...args) {
  return threadTileRuntime.canPatchSingleThreadConversationDom(...args);
}
function patchCurrentThreadTilePaneFromState(...args) {
  return threadTileRuntime.patchCurrentThreadTilePaneFromState(...args);
}
function scheduleRenderThreadTilePane(...args) {
  return threadTileRuntime.scheduleRenderThreadTilePane(...args);
}
function renderThreadTileLayout(...args) {
  return threadTileRuntime.renderThreadTileLayout(...args);
}
function bindThreadTileActions(...args) {
  return threadTileRuntime.bindThreadTileActions(...args);
}
function threadTileLayoutStatusText(...args) {
  return threadTileRuntime.threadTileLayoutStatusText(...args);
}
function syncThreadTileToggle(...args) {
  return threadTileRuntime.syncThreadTileToggle(...args);
}
function setThreadTileMode(...args) {
  return threadTileRuntime.setThreadTileMode(...args);
}
function handleThreadTileModeChoice(...args) {
  return threadTileRuntime.handleThreadTileModeChoice(...args);
}

function shouldPreservePinnedLiveOperationDock(dock, html = "") {
  return liveOperationDockPolicy.shouldPreservePinned({
    pinned: state.liveOperationDockPinned,
    mode: state.liveOperationDockMode,
    pinnedThreadId: state.liveOperationDockPinnedThreadId,
    currentThreadId: state.currentThreadId,
    dockHasSheet: Boolean(dock && dock.querySelector(".mobile-operation-sheet")),
    nextHtml: html,
    liveTurnActive: Boolean(currentLiveTurn()),
  });
}

function preservePinnedLiveOperationDock(dock) {
  if (!dock) return false;
  dock.hidden = false;
  dock.dataset.mode = "expanded";
  dock.dataset.mobileVisible = "true";
  dock.querySelectorAll("[data-live-operation-dock-toggle]").forEach((button) => {
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", "收起 Command 框");
    button.setAttribute("title", "收起 Command 框");
    if (!button.classList.contains("mobile-operation-bubble") && !button.classList.contains("mobile-operation-recall")) button.textContent = "↓";
  });
  return true;
}

function clearCompactLiveOperationBubbleState() {
  state.liveOperationDockCompactVisibleUntilMs = 0;
  state.liveOperationDockCompactHtml = "";
  state.liveOperationDockCompactThreadId = "";
}

function clearLiveOperationDockRuntimeState() {
  if (state.liveOperationDockCompactTimer) {
    clearTimeout(state.liveOperationDockCompactTimer);
    state.liveOperationDockCompactTimer = null;
  }
  state.liveOperationDockPinned = false;
  state.liveOperationDockPinnedThreadId = "";
  state.liveOperationDockMode = "compact";
  clearCompactLiveOperationBubbleState();
  state.liveOperationDockRecallHtml = "";
  state.liveOperationDockRecallThreadId = "";
  state.liveOperationDockRecallAtMs = 0;
}

function rememberCompactLiveOperationBubbleHtml(html = "") {
  const next = liveOperationDockPolicy.rememberCompactBubble({
    html,
    threadId: state.currentThreadId,
    nowMs: Date.now(),
    minVisibleMs: LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS,
    existingVisibleUntilMs: state.liveOperationDockCompactVisibleUntilMs,
  });
  state.liveOperationDockCompactVisibleUntilMs = next.visibleUntilMs;
  state.liveOperationDockCompactHtml = next.html;
  state.liveOperationDockCompactThreadId = next.threadId;
  state.liveOperationDockRecallHtml = next.recallHtml;
  state.liveOperationDockRecallThreadId = next.recallThreadId;
  state.liveOperationDockRecallAtMs = next.recallAtMs;
}

function renderLiveOperationRecallDockHtml() {
  const savedHtml = String(state.liveOperationDockRecallHtml || "");
  if (!liveOperationDockPolicy.shouldShowRecall({
    isMobile: isMobileViewport(),
    hasCurrentThread: Boolean(state.currentThread),
    newThreadDraft: state.newThreadDraft,
    currentThreadId: state.currentThreadId,
    recallThreadId: state.liveOperationDockRecallThreadId,
    recallHtml: savedHtml,
    liveTurnActive: Boolean(currentLiveTurn()),
  })) return "";
  const root = firstElementFromHtml(savedHtml);
  if (!root) return "";
  const stack = root.querySelector(".mobile-operation-stack");
  if (!stack || !stack.querySelector(".mobile-operation-sheet")) return "";
  stack.querySelectorAll(".mobile-operation-bubble, .mobile-operation-recall").forEach((node) => node.remove());
  const expanded = normalizeLiveOperationDockMode(state.liveOperationDockMode) === "expanded";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mobile-operation-recall";
  button.dataset.liveOperationDockToggle = "";
  button.dataset.liveOperationRecall = "true";
  button.setAttribute("aria-expanded", String(expanded));
  button.setAttribute("aria-label", expanded ? "收起最近 Command 框" : "查看最近 Command 框");
  button.setAttribute("title", expanded ? "收起最近 Command 框" : "查看最近 Command 框");
  button.innerHTML = `<span class="mobile-operation-recall-dot" aria-hidden="true"></span>`;
  stack.appendChild(button);
  return root.outerHTML;
}

function renderLiveOperationDockOnly() {
  state.nowMs = Date.now();
  const html = state.currentThread && !state.newThreadDraft
    ? renderLiveOperationDock(state.currentThread, existingConversationRenderKeys())
    : "";
  updateLiveOperationDockHtml(html);
  updateOperationDurationBadges();
}

function scheduleLiveOperationDockCompactMinimumRefresh(delayMs = LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS) {
  if (state.liveOperationDockCompactTimer) clearTimeout(state.liveOperationDockCompactTimer);
  const delay = Math.max(0, Number(delayMs) || 0);
  state.liveOperationDockCompactTimer = setTimeout(() => {
    state.liveOperationDockCompactTimer = null;
    renderLiveOperationDockOnly();
  }, delay + 16);
}

function shouldPreserveCompactLiveOperationBubble(dock, html = "") {
  if (!dock) return false;
  const dockHasBubble = Boolean(dock.querySelector(".mobile-operation-bubble"));
  const preservation = liveOperationDockPolicy.compactBubblePreservation({
    nextHtml: html,
    visibleUntilMs: state.liveOperationDockCompactVisibleUntilMs,
    nowMs: Date.now(),
    savedHtml: state.liveOperationDockCompactHtml,
    savedThreadId: state.liveOperationDockCompactThreadId,
    currentThreadId: state.currentThreadId,
    dockHasBubble,
    liveTurnActive: Boolean(currentLiveTurn()),
  });
  if (!preservation.preserve) return false;
  if (preservation.patchSavedHtml) {
    dock.hidden = false;
    dock.dataset.mode = "compact";
    dock.dataset.mobileVisible = "true";
    if (dock.innerHTML !== preservation.savedHtml) patchHtml(dock, preservation.savedHtml);
  }
  scheduleLiveOperationDockCompactMinimumRefresh(preservation.remainingMs);
  return true;
}

function updateLiveOperationDockHtml(html = "") {
  const dock = $("liveOperationDock");
  if (!dock) return false;
  const next = String(html || "");
  if (next.includes("mobile-operation-bubble")) {
    rememberCompactLiveOperationBubbleHtml(next);
  }
  if (shouldPreservePinnedLiveOperationDock(dock, next)) return preservePinnedLiveOperationDock(dock);
  if (shouldPreserveCompactLiveOperationBubble(dock, next)) return true;
  const recall = !next ? renderLiveOperationRecallDockHtml() : "";
  if (recall) {
    clearCompactLiveOperationBubbleState();
    dock.hidden = false;
    dock.dataset.mode = normalizeLiveOperationDockMode(state.liveOperationDockMode);
    dock.dataset.mobileVisible = "true";
    dock.dataset.recallVisible = "true";
    if (dock.innerHTML !== recall) patchHtml(dock, recall);
    return true;
  }
  if (!next.includes("mobile-operation-bubble")) {
    state.liveOperationDockPinned = false;
    state.liveOperationDockPinnedThreadId = "";
    state.liveOperationDockMode = "compact";
    clearCompactLiveOperationBubbleState();
  }
  if (!next) {
    if (dock.innerHTML) dock.innerHTML = "";
    dock.hidden = true;
    delete dock.dataset.mobileVisible;
    delete dock.dataset.recallVisible;
    return true;
  }
  dock.hidden = false;
  dock.dataset.mode = normalizeLiveOperationDockMode(state.liveOperationDockMode);
  dock.dataset.mobileVisible = next.includes("mobile-operation-bubble") ? "true" : "false";
  delete dock.dataset.recallVisible;
  if (dock.innerHTML !== next) patchHtml(dock, next);
  return true;
}

function clearGlobalLiveOperationDockForThreadTiles() {
  const dock = $("liveOperationDock");
  if (state.liveOperationDockCompactTimer) {
    clearTimeout(state.liveOperationDockCompactTimer);
    state.liveOperationDockCompactTimer = null;
  }
  state.liveOperationDockPinned = false;
  state.liveOperationDockPinnedThreadId = "";
  state.liveOperationDockMode = "compact";
  clearCompactLiveOperationBubbleState();
  state.liveOperationDockRecallHtml = "";
  state.liveOperationDockRecallThreadId = "";
  state.liveOperationDockRecallAtMs = 0;
  if (!dock) return false;
  if (dock.innerHTML) dock.innerHTML = "";
  dock.hidden = true;
  delete dock.dataset.mobileVisible;
  delete dock.dataset.recallVisible;
  delete dock.dataset.mode;
  return true;
}

function normalizeLiveOperationDockMode(mode) {
  return liveOperationDockPolicy.normalizeMode(mode);
}

function setLiveOperationDockMode(mode) {
  const next = normalizeLiveOperationDockMode(mode);
  state.liveOperationDockMode = next;
  state.liveOperationDockPinned = next === "expanded";
  state.liveOperationDockPinnedThreadId = state.liveOperationDockPinned ? String(state.currentThreadId || "") : "";
  const dock = $("liveOperationDock");
  if (!dock) return;
  dock.dataset.mode = next;
  dock.querySelectorAll("[data-live-operation-dock-toggle]").forEach((button) => {
    button.setAttribute("aria-expanded", String(next === "expanded"));
    button.setAttribute("aria-label", next === "expanded" ? "收起 Command 框" : "展开 Command 框");
    button.setAttribute("title", next === "expanded" ? "收起 Command 框" : "展开 Command 框");
    if (!button.classList.contains("mobile-operation-bubble") && !button.classList.contains("mobile-operation-recall")) {
      button.textContent = next === "expanded" ? "↓" : "↑";
    }
  });
}

function beginLiveOperationDockGesture(event) {
  const touch = event.touches && event.touches[0];
  if (!touch) return;
  state.liveOperationDockGesture = {
    y: Number(touch.clientY || 0),
    at: Date.now(),
  };
}

function finishLiveOperationDockGesture(event) {
  const start = state.liveOperationDockGesture;
  state.liveOperationDockGesture = null;
  const touch = event.changedTouches && event.changedTouches[0];
  if (!start || !touch) return;
  const deltaY = Number(touch.clientY || 0) - Number(start.y || 0);
  if (Math.abs(deltaY) < 24 || Date.now() - Number(start.at || 0) > 900) return;
  if (deltaY > 0) setLiveOperationDockMode("compact");
  else setLiveOperationDockMode("expanded");
}

function cancelLiveOperationDockGesture() {
  state.liveOperationDockGesture = null;
}

function handleLiveOperationDockClick(event) {
  const button = event.target.closest("[data-live-operation-dock-toggle]");
  if (!button) return;
  event.preventDefault();
  const current = normalizeLiveOperationDockMode(state.liveOperationDockMode);
  setLiveOperationDockMode(current === "expanded" ? "compact" : "expanded");
}

function sourceIndexForVisibleItem(turn, item, thread = null) {
  if (!turn || !item) return 0;
  const contextThread = renderContextThread(thread);
  const entry = visibleItemsForTurn(turn, contextThread).find((candidate) => candidate && candidate.item === item);
  if (entry && Number.isInteger(entry.sourceIndex) && entry.sourceIndex >= 0) return entry.sourceIndex;
  const index = Array.isArray(turn.items) ? turn.items.indexOf(item) : -1;
  return index >= 0 ? index : 0;
}

function renderVisibleItemPatchHtml(turn, item, previousKeys = new Set(), index = 0, thread = null) {
  const contextThread = renderContextThread(thread);
  return withRenderContextThread(contextThread, () => {
    if (!item) return "";
    if (isContextCompactionItem(item)) return renderContextCompaction(item, turn, previousKeys, index, contextThread);
    if (isOperationalItem(item)) return renderLiveOperation(item, turn, previousKeys, index);
    if (item.type === "reasoning" && isLiveTurn(turn, contextThread)) return "";
    return renderItem(item, turn, previousKeys, index, contextThread);
  });
}

function firstElementFromHtml(html) {
  return threadDetailDomPatchApi.createElementFromHtml({ document, html });
}

function hydrateThreadDetailSurface(root, options = {}) {
  return threadDetailDomPatchApi.hydrateRenderedSurface({
    root,
    hydrateGitHubLinks: options.skipRichHydration ? null : hydrateGitHubLinkCards,
    hydrateMermaid: options.skipRichHydration ? null : hydrateMermaidDiagrams,
    scheduleImageScan: scheduleFailedAppImageScan,
    ...(Object.prototype.hasOwnProperty.call(options, "imageScanDelays") ? { imageScanDelays: options.imageScanDelays } : {}),
  });
}

function applyThreadDetailDomUpdateEffect(effect, context = {}) {
  const item = effect && typeof effect === "object" ? effect : {};
  const type = String(item.type || "");
  if (type === "hydrate-root") {
    hydrateThreadDetailSurface(context.root, item.hydrateOptions || {});
    return;
  }
  if (type === "set-rendered-conversation-signature") {
    state.renderedConversationSignature = String(item.value || "");
    return;
  }
  if (type === "set-rendered-conversation-patch-shell-signature") {
    state.renderedConversationPatchShellSignature = String(item.value || "");
    return;
  }
  if (type === "schedule-conversation-to-bottom") {
    scheduleConversationToBottom();
    return;
  }
  if (type === "schedule-scroll-button-update") {
    scheduleScrollToBottomButtonUpdate();
    return;
  }
  throw new Error(`Unknown thread detail DOM update effect: ${type || "empty"}`);
}

function applyThreadDetailDomUpdateEffectsPlan(plan, context = {}) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  for (const effect of effects) applyThreadDetailDomUpdateEffect(effect, context);
}

function applyLocalConversationDomUpdateCompletionEffect(effect, context = {}) {
  applyThreadDetailDomUpdateEffect(effect, context);
}

function applyLocalConversationDomUpdateCompletionEffectsPlan(plan, context = {}) {
  applyThreadDetailDomUpdateEffectsPlan(plan, context);
}

function applyConversationHtmlUpdateEffectsPlan(plan, context = {}) {
  applyThreadDetailDomUpdateEffectsPlan(plan, context);
}

function completeLocalConversationDomUpdate(root, wasNearBottom, userReadingCurrentTurn, options = {}) {
  const hasOption = (key) => Object.prototype.hasOwnProperty.call(options || {}, key);
  const providedSnapshot = options && options.completionSnapshot && typeof options.completionSnapshot === "object"
    ? options.completionSnapshot
    : null;
  const completionSnapshot = providedSnapshot || (() => {
    const tilePanePatched = hasOption("tilePanePatched")
      ? Boolean(options.tilePanePatched)
      : patchCurrentThreadTilePaneFromState({ preserveScroll: true });
    const canPatchSingleThread = tilePanePatched
      ? false
      : (hasOption("canPatchSingleThread") ? Boolean(options.canPatchSingleThread) : canPatchSingleThreadConversationDom());
    const scrollPlan = options && options.scrollPlan && typeof options.scrollPlan === "object"
      ? options.scrollPlan
      : tilePanePatched
      ? { action: "none" }
      : conversationScroll.planLocalPatchScrollCompletion({
        userReadingCurrentTurn,
        autoScrollHold: shouldHoldAutoScrollForCurrentTurn(),
        nearBottom: wasNearBottom,
        submittedMessageFollow: shouldFollowSubmittedMessageToBottom(),
        viewportFollow: shouldFollowViewportChangeToBottom(),
      });
    return threadDetailDomPatchApi.planLocalConversationDomUpdateCompletionSnapshot({
      tilePanePatched,
      canPatchSingleThread,
      hasRoot: Boolean(root),
      conversationSignature: hasOption("conversationSignature")
        ? options.conversationSignature
        : (tilePanePatched ? "" : conversationRenderSignature(state.currentThread)),
      patchShellSignature: hasOption("patchShellSignature")
        ? options.patchShellSignature
        : (tilePanePatched ? "" : conversationPatchShellSignature(state.currentThread)),
      scrollAction: scrollPlan.action,
    });
  })();
  const completionPlan = threadDetailDomPatchApi.planLocalConversationDomUpdateCompletion(completionSnapshot);
  if (!completionPlan.complete) return false;
  const effectsPlan = threadDetailDomPatchApi.planLocalConversationDomUpdateCompletionEffects(completionPlan);
  applyLocalConversationDomUpdateCompletionEffectsPlan(effectsPlan, { root });
  restoreConversationViewportAnchor(options.scrollAnchor || null);
  return true;
}

function updateLiveOperationDockForLocalPatch(previousKeys = existingConversationRenderKeys()) {
  if (patchCurrentThreadTilePaneFromState({ preserveScroll: true })) return true;
  if (!canPatchSingleThreadConversationDom()) return false;
  const wasNearBottom = isConversationNearBottom();
  const userReadingCurrentTurn = isUserReadingCurrentTurn({ nearBottom: wasNearBottom });
  const scrollAnchor = captureConversationViewportAnchor({
    nearBottom: wasNearBottom,
    userReadingCurrentTurn,
  });
  updateLiveOperationDockHtml(renderLiveOperationDock(state.currentThread, previousKeys));
  return completeLocalConversationDomUpdate($("liveOperationDock"), wasNearBottom, userReadingCurrentTurn, { scrollAnchor });
}

function turnArticleNode(turn) {
  const conversation = $("conversation");
  if (!turn) return null;
  const key = stableTurnKey(turn);
  return threadDetailDomPatchApi.findTurnArticleElement({
    conversation,
    turnKey: key,
    escapeSelectorAttr,
  });
}

function insertTurnArticleDom(turn, previousKeys = existingConversationRenderKeys()) {
  const source = threadDetailDomPatchApi.createTurnArticleElement({
    document,
    turn,
    previousKeys,
    renderTurnHtml: (candidate, keys) => renderTurn(candidate, keys),
  });
  if (!source) return null;
  return insertTurnArticleElementDom(turn, source);
}

function insertTurnArticleElementDom(turn, source) {
  const conversation = $("conversation");
  if (!conversation || !turn || !source) return null;
  const result = threadDetailDomPatchApi.insertTurnArticleElement({
    conversation,
    turn,
    source,
    visibleTurns: visibleTurnsForConversation(state.currentThread),
    findTurnElement: (candidate) => turnArticleNode(candidate),
    firstTurnElement: () => conversation.querySelector(".turn"),
  });
  return result.ok ? source : null;
}

function insertVisibleItemDom(turn, item) {
  if (!turn || !item || !item.id || isReasoningItem(item)) return false;
  if (patchCurrentThreadTilePaneFromState({ preserveScroll: true })) return true;
  if (!canPatchSingleThreadConversationDom()) return false;
  if (isOperationalItem(item)) return updateLiveOperationDockForLocalPatch();
  const conversation = $("conversation");
  if (!conversation) return false;
  const wasNearBottom = isConversationNearBottom();
  const userReadingCurrentTurn = isUserReadingCurrentTurn({ nearBottom: wasNearBottom });
  const scrollAnchor = captureConversationViewportAnchor({
    nearBottom: wasNearBottom,
    userReadingCurrentTurn,
  });
  const previousKeys = existingConversationRenderKeys();
  let article = turnArticleNode(turn);
  if (!article) {
    article = insertTurnArticleDom(turn, previousKeys);
    if (!article) return false;
    bindCurrentThreadActions();
    return completeLocalConversationDomUpdate(article, wasNearBottom, userReadingCurrentTurn, { scrollAnchor });
  }
  const thread = renderContextThread();
  const entries = visibleItemsForTurn(turn, thread);
  const visibleIndex = entries.findIndex((entry) => entry && entry.item === item);
  if (visibleIndex < 0) return false;
  const sourceIndex = Number.isInteger(entries[visibleIndex].sourceIndex) ? entries[visibleIndex].sourceIndex : sourceIndexForVisibleItem(turn, item, thread);
  const html = renderVisibleItemPatchHtml(turn, item, previousKeys, sourceIndex, thread);
  const source = firstElementFromHtml(html);
  if (!source) return false;
  const insertResult = threadDetailDomPatchApi.insertVisibleItemElement({
    article,
    source,
    entries,
    visibleIndex,
    keyForEntry: (entry) => entry && entry.item ? stableItemKey(turn, entry.item, entry.sourceIndex) : "",
    findElementByKey: (key) => article.querySelector(`[data-render-key="${escapeSelectorAttr(key)}"]`),
  });
  if (!insertResult || !insertResult.ok) return false;
  return completeLocalConversationDomUpdate(insertResult.target || source, wasNearBottom, userReadingCurrentTurn, { scrollAnchor });
}

function patchVisibleItemDom(turn, item) {
  if (patchCurrentThreadTilePaneFromState({ preserveScroll: true })) return true;
  if (!canPatchSingleThreadConversationDom()) return false;
  if (isOperationalItem(item)) return updateLiveOperationDockForLocalPatch();
  const wasNearBottom = isConversationNearBottom();
  const userReadingCurrentTurn = isUserReadingCurrentTurn({ nearBottom: wasNearBottom });
  const scrollAnchor = captureConversationViewportAnchor({
    nearBottom: wasNearBottom,
    userReadingCurrentTurn,
  });
  const target = patchVisibleItemDomNode(turn, item, existingConversationRenderKeys());
  if (!target) return false;
  return completeLocalConversationDomUpdate(target, wasNearBottom, userReadingCurrentTurn, { scrollAnchor });
}

function patchVisibleItemDomNode(turn, item, previousKeys, sourceIndex = null) {
  if (!turn || !item || !item.id || isReasoningItem(item)) return null;
  if (!canPatchSingleThreadConversationDom()) return null;
  const conversation = $("conversation");
  if (!conversation) return null;
  const index = Number.isInteger(sourceIndex) && sourceIndex >= 0
    ? sourceIndex
    : sourceIndexForVisibleItem(turn, item, renderContextThread());
  const key = stableItemKey(turn, item, index);
  const target = conversation.querySelector(`[data-render-key="${escapeSelectorAttr(key)}"]`);
  if (!target) return null;
  return patchVisibleItemElement(target, turn, item, previousKeys, index);
}

function patchVisibleItemElement(target, turn, item, previousKeys, sourceIndex = null) {
  if (!target || !turn || !item || !item.id || isReasoningItem(item)) return null;
  const index = Number.isInteger(sourceIndex) && sourceIndex >= 0
    ? sourceIndex
    : sourceIndexForVisibleItem(turn, item, renderContextThread());
  const html = renderVisibleItemPatchHtml(turn, item, previousKeys, index, renderContextThread());
  const source = firstElementFromHtml(html);
  if (!source) return null;
  patchNode(target, source);
  return target;
}

function visibleItemPatchEntries(turn) {
  const thread = renderContextThread();
  return visibleItemsForTurn(turn, thread).map((entry, index) => {
    const item = entry && entry.item;
    const sourceIndex = Number.isInteger(entry && entry.sourceIndex) && entry.sourceIndex >= 0
      ? entry.sourceIndex
      : index;
    return {
      item,
      sourceIndex,
      key: stableItemKey(turn, item, sourceIndex),
      signature: visibleItemSignature(item, turn, thread),
    };
  }).filter((entry) => entry.item && entry.key && entry.signature);
}

function visibleItemPatchShapePreservesExisting(previousEntries, nextEntries) {
  return threadDetailPatchPlanApi.visibleItemPatchShapePreservesExisting(previousEntries, nextEntries);
}

function planVisibleItemsOnlyFromRefresh(previousTurn, nextTurn) {
  if (!previousTurn || !nextTurn || !isLatestTurn(nextTurn)) return false;
  const previousEntries = visibleItemPatchEntries(previousTurn);
  const nextEntries = visibleItemPatchEntries(nextTurn);
  return threadDetailPatchPlanApi.planVisibleItemRefreshPatch(previousEntries, nextEntries);
}

function applyVisibleItemsOnlyRefreshPatch(nextTurn, patchPlan, previousKeys) {
  const article = turnArticleNode(nextTurn);
  const result = threadDetailDomPatchApi.applyVisibleItemRefreshDomPatch({
    article,
    patchPlan,
    findElementByKey: (key) => article
      ? article.querySelector(`[data-render-key="${escapeSelectorAttr(key)}"]`)
      : null,
    renderElement: (nextEntry) => firstElementFromHtml(renderVisibleItemPatchHtml(
      nextTurn,
      nextEntry.item,
      previousKeys,
      nextEntry.sourceIndex,
      renderContextThread(),
    )),
    patchElement: (target, nextEntry) => patchVisibleItemElement(
      target,
      nextTurn,
      nextEntry.item,
      previousKeys,
      nextEntry.sourceIndex,
    ),
  });
  return Boolean(result && result.ok);
}

function patchLiveTextItemDom(turn, item) {
  if (!turn || !item || !item.id) return false;
  if (item.type !== "agentMessage" && item.type !== "plan") return false;
  if (patchCurrentThreadTilePaneFromState({ preserveScroll: true })) return true;
  if (!canPatchSingleThreadConversationDom()) return false;
  const conversation = $("conversation");
  if (!conversation) return false;
  const index = sourceIndexForVisibleItem(turn, item, renderContextThread());
  const key = stableItemKey(turn, item, index);
  const wasNearBottom = isConversationNearBottom();
  const userReadingCurrentTurn = isUserReadingCurrentTurn({ nearBottom: wasNearBottom });
  const scrollAnchor = captureConversationViewportAnchor({
    nearBottom: wasNearBottom,
    userReadingCurrentTurn,
  });
  const previousKeys = existingConversationRenderKeys();
  const patchResult = threadDetailDomPatchApi.applyLiveTextItemDomPatch({
    conversation,
    key,
    document,
    escapeSelectorAttr,
    renderHtml: () => renderItem(item, turn, previousKeys, index, renderContextThread()),
    patchElement: (target, source) => {
      patchNode(target, source);
      return target;
    },
  });
  if (!patchResult || !patchResult.ok || !patchResult.target) return false;
  return completeLocalConversationDomUpdate(patchResult.target, wasNearBottom, userReadingCurrentTurn, { scrollAnchor });
}

function threadDetailRefreshLocalPatchTransactionCallback(effect, context = {}) {
  const item = effect && typeof effect === "object" ? effect : {};
  const type = String(item.type || item.name || "");
  if (type === "complete-local-conversation-dom-update") {
    return {
      name: "complete-local-conversation-dom-update",
      apply: () => completeLocalConversationDomUpdate(
        context.conversation,
        context.wasNearBottom,
        context.userReadingCurrentTurn,
        { completionSnapshot: item.completionSnapshot || {} },
      )
        ? { ok: true }
        : { ok: false, reason: "complete-dom-update-failed" },
    };
  }
  if (type === "update-live-operation-dock") {
    return {
      name: "update-live-operation-dock",
      apply: () => {
        updateLiveOperationDockHtml(renderLiveOperationDock(context.nextThread, context.previousKeys));
        return { ok: true };
      },
    };
  }
  if (type === "bind-current-thread-actions") {
    return {
      name: "bind-current-thread-actions",
      apply: () => {
        bindCurrentThreadActions();
        return { ok: true };
      },
    };
  }
  return {
    name: type || "unknown-local-patch-transaction-effect",
    apply: () => ({ ok: false, reason: `unknown-effect:${type || "empty"}`.slice(0, 80) }),
  };
}

function threadDetailRefreshLocalPatchTransactionCallbacks(plan = {}, context = {}) {
  const commitEffects = Array.isArray(plan.commitEffects) ? plan.commitEffects : [];
  const afterSuccess = Array.isArray(plan.afterSuccess) ? plan.afterSuccess : [];
  return {
    commitEffects: commitEffects.map((effect) => threadDetailRefreshLocalPatchTransactionCallback(effect, context)),
    afterSuccess: afterSuccess.map((effect) => threadDetailRefreshLocalPatchTransactionCallback(effect, context)),
  };
}

function rejectThreadDetailPatch(reason) {
  return threadDetailDomPatchApi.threadDetailPatchResult(false, reason || "unknown");
}

function acceptThreadDetailPatch(reason) {
  return threadDetailDomPatchApi.threadDetailPatchResult(true, reason || "patched");
}

function patchCurrentThreadDetailFromRefresh(previousThread, nextThread, previousConversationSignature) {
  const conversation = $("conversation");
  const rootPreflight = threadDetailPatchPlanApi.planThreadDetailRefreshLocalPatchPreflight({
    stage: "root",
    conversationPresent: Boolean(conversation),
    previousThreadPresent: Boolean(previousThread),
    nextThreadPresent: Boolean(nextThread),
  });
  if (!rootPreflight.canPatch) return rejectThreadDetailPatch(rootPreflight.reason);
  const targetThreadId = nextThread.id || state.currentThreadId;
  const tilePanePatched = patchCurrentThreadTilePaneFromState({ threadId: targetThreadId, preserveScroll: true });
  if (tilePanePatched) {
    const tilePreflight = threadDetailPatchPlanApi.planThreadDetailRefreshLocalPatchPreflight({
      conversationPresent: true,
      previousThreadPresent: true,
      nextThreadPresent: true,
      tilePanePatched: true,
    });
    return acceptThreadDetailPatch(tilePreflight.reason);
  }
  const previousPatchShellSignature = conversationPatchShellSignature(previousThread);
  const renderedPatchShellSignature = String(state.renderedConversationPatchShellSignature || "");
  const preflightPlan = threadDetailPatchPlanApi.planThreadDetailRefreshLocalPatchPreflight({
    conversationPresent: true,
    previousThreadPresent: true,
    nextThreadPresent: true,
    singleThreadSurfaceAvailable: canPatchSingleThreadConversationDom({ threadId: targetThreadId }),
    previousLoadingOrError: Boolean(previousThread.mobileLoading || previousThread.mobileLoadError),
    nextLoadingOrError: Boolean(nextThread.mobileLoading || nextThread.mobileLoadError),
    renderedConversationSignature: state.renderedConversationSignature,
    previousConversationSignature,
    renderedPatchShellSignature,
    previousPatchShellSignature,
    nextPatchShellSignature: conversationPatchShellSignature(nextThread),
  });
  if (!preflightPlan.canPatch) return rejectThreadDetailPatch(preflightPlan.reason);
  const wasNearBottom = isConversationNearBottom();
  const userReadingCurrentTurn = isUserReadingCurrentTurn({ nearBottom: wasNearBottom });
  const previousKeys = existingConversationRenderKeys();
  const scrollPlan = conversationScroll.planLocalPatchScrollCompletion({
    userReadingCurrentTurn,
    autoScrollHold: shouldHoldAutoScrollForCurrentTurn(),
    nearBottom: wasNearBottom,
    submittedMessageFollow: shouldFollowSubmittedMessageToBottom(),
    viewportFollow: shouldFollowViewportChangeToBottom(),
  });
  const completionSnapshot = threadDetailDomPatchApi.planLocalConversationDomUpdateCompletionSnapshot({
    tilePanePatched: false,
    canPatchSingleThread: true,
    hasRoot: Boolean(conversation),
    conversationSignature: conversationRenderSignature(nextThread),
    patchShellSignature: conversationPatchShellSignature(nextThread),
    scrollAction: scrollPlan.action,
  });
  const previousTurnById = new Map(visibleTurnsForConversation(previousThread)
    .map((turn) => [String(turn && turn.id || ""), turn])
    .filter(([id]) => id));
  const previousDomTurnKeys = Array.from(conversation.querySelectorAll("article.turn[data-render-key]"))
    .map((node) => String(node && node.getAttribute && node.getAttribute("data-render-key") || ""))
    .filter(Boolean);
  const nextTurns = visibleTurnsForConversation(nextThread);
  const turnByKey = new Map();
  const itemPatchPlanByTurnKey = new Map();
  const turnPatchEntries = nextTurns.map((turn) => {
    const key = stableTurnKey(turn);
    const previousTurn = previousTurnById.get(String(turn && turn.id || ""));
    const itemPatchPlan = planVisibleItemsOnlyFromRefresh(previousTurn, turn);
    turnByKey.set(key, turn);
    itemPatchPlanByTurnKey.set(key, itemPatchPlan);
    return {
      key,
      hasPreviousTurn: Boolean(previousTurn),
      itemPatchable: Boolean(itemPatchPlan && itemPatchPlan.canPatch),
      articlePresent: Boolean(turnArticleNode(turn)),
    };
  });
  const turnPatchPlan = threadDetailPatchPlanApi.planThreadDetailRefreshDomPatch(turnPatchEntries, {
    previousTurnKeys: previousDomTurnKeys,
  });
  if (!turnPatchPlan.canPatch) return rejectThreadDetailPatch(turnPatchPlan.reason || "turn-patch-plan-rejected");
  const transactionEffectsPlan = threadDetailDomPatchApi.planThreadDetailRefreshLocalPatchTransactionEffects({
    completionSnapshot,
  });
  const scrollAnchor = captureConversationViewportAnchor({
    nearBottom: wasNearBottom,
    userReadingCurrentTurn,
  });
  const transactionCallbacks = threadDetailRefreshLocalPatchTransactionCallbacks(transactionEffectsPlan, {
    conversation,
    wasNearBottom,
    userReadingCurrentTurn,
    nextThread,
    previousKeys,
  });
  const applyResult = threadDetailDomPatchApi.applyThreadDetailPatchTransaction({
    applyPatch: () => threadDetailDomPatchApi.applyThreadTurnRefreshDomPatch({
      patchPlan: turnPatchPlan,
      conversation,
      findTurnByKey: (key) => turnByKey.get(String(key || "")),
      findTurnElementByKey: (key) => {
        const renderKey = String(key || "");
        if (!renderKey) return null;
        return conversation.querySelector(`article.turn[data-render-key="${escapeSelectorAttr(renderKey)}"]`);
      },
      firstTurnElement: () => conversation.querySelector("article.turn"),
      applyItemPatch: (turn, operation) => {
        const patchPlan = itemPatchPlanByTurnKey.get(operation.key);
        const article = turnArticleNode(turn);
        return applyVisibleItemsOnlyRefreshPatch(turn, patchPlan, previousKeys)
          ? { ok: true, target: article }
          : { ok: false, reason: "item-patch-failed" };
      },
      renderTurnElement: (turn) => threadDetailDomPatchApi.createTurnArticleElement({
        document,
        turn,
        previousKeys,
        renderTurnHtml: (candidate, keys) => renderTurn(candidate, keys),
      }),
      insertTurnElement: (source, turn) => insertTurnArticleElementDom(turn, source)
        ? { ok: true, target: source }
        : { ok: false, reason: "insert-turn-failed" },
      replaceTurnElement: (source, turn) => {
        const article = turnArticleNode(turn);
        if (!article) return { ok: false, reason: "replace-turn-missing-article" };
        const target = patchNode(article, source);
        return { ok: true, target: target || article };
      },
      removeTurnElement: (operation) => {
        const key = String(operation && operation.key || "");
        if (!key) return { ok: false, reason: "remove-turn-missing-key" };
        const article = conversation.querySelector(`article.turn[data-render-key="${escapeSelectorAttr(key)}"]`);
        if (!article) return { ok: true, reason: "remove-turn-already-absent" };
        if (typeof article.remove === "function") article.remove();
        else if (article.parentNode) article.parentNode.removeChild(article);
        return { ok: true };
      },
    }),
    commitEffects: transactionCallbacks.commitEffects,
    afterSuccess: transactionCallbacks.afterSuccess,
  });
  restoreConversationViewportAnchor(scrollAnchor);
  if (!applyResult.ok) return rejectThreadDetailPatch(applyResult.reason || "turn-patch-apply-failed");
  return acceptThreadDetailPatch("patched");
}

function renderHome() {
  setThreadTileConversationMode(false);
  clearInterval(state.tickTimer);
  state.tickTimer = null;
  state.subagentPanelOpen = false;
  updateSubagentPanelUi();
  updateTurnTimer();
  const selectedLabel = state.selectedCwd ? shortPath(state.selectedCwd) : "Codex Mobile";
  $("threadTitle").textContent = selectedLabel || "Codex Mobile";
  $("threadMeta").textContent = state.selectedCwd || "Recent workspaces and threads";
  const workspaces = state.workspaces.slice()
    .sort((a, b) => Number(b.active) - Number(a.active)
      || Number(b.recentThreadCount || 0) - Number(a.recentThreadCount || 0)
      || String(a.label || a.cwd).localeCompare(String(b.label || b.cwd)))
    .slice(0, 8);
  const recentThreads = visibleThreads(state.threads).slice(0, 8);
  const nowMs = Date.now();
  const workspaceHtml = workspaces.length
    ? workspaces.map((ws) => {
      const active = ws.active ? "Active" : "Workspace";
      const count = Number(ws.recentThreadCount || 0);
      const countText = `${count.toLocaleString()} recent thread${count === 1 ? "" : "s"}`;
      const selected = normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd) ? " selected" : "";
      return `<button class="home-shortcut${selected}" type="button" data-home-workspace="${escapeHtml(ws.cwd)}">
        <span class="home-shortcut-title">${escapeHtml(ws.label || shortPath(ws.cwd) || ws.cwd)}</span>
        <span class="home-shortcut-meta">${escapeHtml(`${active} | ${countText} | ${ws.cwd}`)}</span>
      </button>`;
    }).join("")
    : `<div class="home-empty">No recent workspaces.</div>`;
  const threadHtml = recentThreads.length
    ? recentThreads.map((thread) => {
      const title = thread.name || thread.preview || thread.id;
      const sizeText = rolloutSizeText(thread);
      const sizeWarn = isRolloutOverThreshold(thread);
      const updatedTitle = formatAbsoluteTime(thread.updatedAt);
  const meta = [shortPath(thread.cwd) || "聊天", formatTime(thread.updatedAt, nowMs), sizeText ? `rollout ${sizeText}` : ""]
    .filter(Boolean)
    .join(" | ");
      return `<button class="home-shortcut${sizeWarn ? " rollout-warn" : ""}" type="button" data-home-thread="${escapeHtml(thread.id)}">
        <span class="home-shortcut-title">${escapeHtml(title)}</span>
        <span class="home-shortcut-meta home-shortcut-meta-status"><span title="${escapeHtml(updatedTitle)}">${escapeHtml(meta)}</span>${statusIconHtml(thread.status, "home-status-icon", thread.id)}</span>
      </button>`;
    }).join("")
    : `<div class="home-empty">No recent threads.</div>`;
  const html = `<div class="home-shortcuts">
    <section class="home-section">
      <div class="home-section-title">Workspaces</div>
      <div class="home-list">${workspaceHtml}</div>
    </section>
    <section class="home-section">
      <div class="home-section-title">Recent threads</div>
      <div class="home-list">${threadHtml}</div>
    </section>
  </div>`;
  const signature = JSON.stringify({
    view: "home",
    selectedCwd: state.selectedCwd,
    timeBucket: Math.floor(nowMs / 60000),
    workspaces: workspaces.map((ws) => [ws.cwd, ws.label, ws.active, ws.recentThreadCount]),
    threads: recentThreads.map((thread) => [
      thread.id,
      thread.name,
      thread.preview,
      thread.cwd,
      thread.updatedAt,
      statusText(thread.status),
      statusIconInfo(thread.status, thread.id)?.kind || "",
      state.unreadThreadIds.has(thread.id) ? 1 : 0,
      rolloutSizeBytes(thread),
      isRolloutOverThreshold(thread),
    ]),
  });
  if (!updateConversationHtml(html, signature, { patchShellSignature: "home" })) {
    publishPluginNavigationState();
    return;
  }
  $("conversation").querySelectorAll("[data-home-workspace]").forEach((button) => {
    button.addEventListener("click", () => selectWorkspaceShortcut(button.dataset.homeWorkspace).catch(showError));
  });
  $("conversation").querySelectorAll("[data-home-thread]").forEach((button) => {
    button.addEventListener("click", () => loadThread(button.dataset.homeThread, { source: "home" }).catch(showError));
  });
  publishPluginNavigationState();
}

function renderStartupThreadOpening() {
  syncThreadDetailLayoutState();
  clearInterval(state.tickTimer);
  state.tickTimer = null;
  state.subagentPanelOpen = false;
  updateSubagentPanelUi();
  updateTurnTimer();
  $("threadTitle").textContent = "Opening thread";
  $("threadMeta").textContent = "Restoring your current conversation";
  $("conversation").innerHTML = `<div class="empty-state entry-animate">Opening thread...</div>`;
  state.renderedConversationSignature = "startup-thread-open-pending";
  state.renderedConversationPatchShellSignature = "";
  publishPluginNavigationState();
}

function renderThreadLoadError(err) {
  const list = $("threadList");
  list.innerHTML = `<div class="empty-state">
    <div>Thread list failed: ${escapeHtml(err.message || String(err))}</div>
    <button id="retryThreads" class="retry-button" type="button">Retry</button>
  </div>`;
  state.renderedThreadListSignature = `error|${err.message || String(err)}`;
  const retry = $("retryThreads");
  if (retry) retry.addEventListener("click", () => loadThreads().catch(showError));
}

function renderRolloutWarning(thread, previousKeys = new Set()) {
  if (!isRolloutOverThreshold(thread)) return "";
  if (isRolloutWarningDismissed(thread)) return "";
  const size = rolloutSizeText(thread);
  const threshold = formatFileSize(rolloutThresholdBytes(thread));
  const threadId = String(thread && thread.id || state.currentThreadId || "").trim();
  const ownerAttribute = threadId ? ` data-thread-action-thread-id="${escapeHtml(threadId)}"` : "";
  const key = `rollout-warning|${threadId}`;
  return `<div class="rollout-warning${entryAnimationClass(key, previousKeys)}" data-render-key="${escapeHtml(key)}">
    <div class="rollout-warning-text">
      <strong>上下文文件 ${escapeHtml(size)}</strong>
      <span>已达到 ${escapeHtml(threshold)} 阈值。建议压缩续接：创建带详细上下文的新线程后归档旧线程。</span>
    </div>
    <div class="rollout-warning-actions">
      <button class="rollout-skip" type="button" data-dismiss-rollout-warning${ownerAttribute}>跳过</button>
      <button class="rollout-new-thread" type="button" data-new-thread-from-current${ownerAttribute}>压缩续接</button>
    </div>
  </div>`;
}

function renderThreadTaskToolbar(thread) {
  if (!thread || !thread.id) return "";
  const ownerAttribute = ` data-thread-action-thread-id="${escapeHtml(thread.id)}"`;
  return `<div class="rollout-warning-actions thread-task-toolbar">
    <button class="approval-button allow" type="button" data-create-thread-task-card${ownerAttribute}>Send task card</button>
  </div>`;
}

function threadReadWarningMessage(thread) {
  const rawWarning = String(thread && thread.mobileReadWarning ? thread.mobileReadWarning : "");
  const mode = String(thread && thread.mobileReadMode ? thread.mobileReadMode : "");
  if (!rawWarning) return "";
  if (
    rawWarning.includes("shared app-server endpoint unavailable")
    || rawWarning.includes("app-server-mux/endpoint.json not found")
  ) {
    return "共享模式已经断开。手机端现在只能显示本地摘要，不能读取完整会话；请在 Mac 上重新运行共享启动脚本，然后刷新手机页面。";
  }
  if (mode === "summary-timeout-fallback") {
    return "线程详情读取超时，先显示本地摘要；稍后刷新会继续补全。";
  }
  return "线程详情暂时没有完整读到，先显示本地摘要；稍后刷新会继续补全。";
}

function renderThreadHistoryNote(thread, omitted, previousKeys = new Set()) {
  const olderCursor = thread && thread.mobileOlderTurnsCursor;
  const hasOlder = Boolean(olderCursor);
  const busy = Boolean(state.threadHistoryBusy);
  const error = String(state.threadHistoryError || "");
  if (!omitted && !hasOlder && !busy && !error) return "";
  const loaded = Array.isArray(thread && thread.turns) ? thread.turns.length : 0;
  const threadId = String(thread && thread.id || state.currentThreadId || "").trim();
  const ownerAttribute = threadId ? ` data-thread-action-thread-id="${escapeHtml(threadId)}"` : "";
  const key = `history|${threadId}|${omitted}|${threadTurnsCursorSignature(olderCursor)}|${busy}|${error}`;
  const parts = [];
  if (omitted > 0) {
    parts.push(`Older history hidden on mobile: ${omitted.toLocaleString()} turn(s).`);
  } else if (hasOlder) {
    parts.push(`Showing ${loaded.toLocaleString()} recent turn(s). Older history is available.`);
  } else if (thread && thread.mobileHistoryExpanded) {
    parts.push(`Showing ${loaded.toLocaleString()} loaded turn(s).`);
  }
  if (error) parts.push(error);
  const button = hasOlder
    ? `<button class="history-load-button" type="button" data-load-older-turns${ownerAttribute}${busy ? " disabled" : ""}>${busy ? "Loading..." : "Load older"}</button>`
    : "";
  return `<div class="history-note history-loader${entryAnimationClass(key, previousKeys)}" data-render-key="${escapeHtml(key)}">
    <span>${escapeHtml(parts.join(" "))}</span>
    ${button}
  </div>`;
}

function applySingleThreadShellPostUpdateEffect(effect, context = {}) {
  const item = effect && typeof effect === "object" ? effect : {};
  const type = String(item.type || "");
  if (type === "bind-retry-current-thread") {
    const retry = $("retryCurrentThread");
    if (retry) {
      const retryThreadId = String(item.threadId || context.threadId || "");
      retry.onclick = () => loadThread(retryThreadId, { source: "retry" }).catch(showError);
    }
    return;
  }
  if (type === "check-empty-visible-detail-mismatch") {
    checkEmptyVisibleDetailMismatchAfterRender(context.thread, context.shellPlan, {
      source: String(item.source || "single-thread-render"),
      renderMode: String(item.renderMode || "full-render"),
      domCount: Math.max(0, Number(item.domCount || 0)),
      previousCount: Math.max(0, Number(item.previousCount || 0)),
    });
    return;
  }
  if (type === "bind-current-thread-actions") {
    bindCurrentThreadActions();
    return;
  }
  if (type === "scroll-turn-receipt-start") {
    scrollConversationToTurnReceiptStart(item.turnId);
    return;
  }
  if (type === "apply-pending-plugin-route-hint-focus") {
    applyPendingPluginRouteHintFocus();
    return;
  }
  if (type === "update-tick-timer") {
    updateTickTimer();
    return;
  }
  if (type === "publish-plugin-navigation-state") {
    publishPluginNavigationState();
    return;
  }
  throw new Error(`Unknown single-thread shell post-update effect: ${type || "empty"}`);
}

function applySingleThreadShellPostUpdateEffectsPlan(plan, context = {}) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  for (const effect of effects) applySingleThreadShellPostUpdateEffect(effect, context);
}

function applySummaryOnlyCurrentThreadRecoveryEffect(effect) {
  const item = effect && typeof effect === "object" ? effect : {};
  const type = String(item.type || "");
  if (type === "set-current-thread") {
    state.currentThread = item.thread || null;
    return;
  }
  if (type === "post-client-event") {
    postClientEvent(String(item.name || ""), item.payload || {});
    return;
  }
  if (type === "schedule-current-thread-refresh") {
    scheduleCurrentThreadRefresh(Math.max(0, Number(item.delayMs || 0)), String(item.reason || "refresh"));
    return;
  }
  throw new Error(`Unknown summary-only current thread recovery effect: ${type || "empty"}`);
}

function applySummaryOnlyCurrentThreadRecoveryEffectsPlan(plan) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  for (const effect of effects) applySummaryOnlyCurrentThreadRecoveryEffect(effect);
}

function renderCurrentThread(options = {}) {
  syncThreadDetailLayoutState();
  syncThreadTileToggle();
  state.nowMs = Date.now();
  if (state.newThreadDraft) {
    setThreadTileConversationMode(false);
    renderNewThreadDraft();
    return;
  }
  let thread = state.currentThread;
  if (!thread) {
    if (state.startupThreadOpenPending) {
      renderStartupThreadOpening();
      return;
    }
    renderHome();
    return;
  }
  updateSubagentPanelUi();
  const nearBottom = isConversationNearBottom();
  const userReadingCurrentTurn = isUserReadingCurrentTurn({ nearBottom });
  const explicitNoStickToBottom = options.stickToBottom === false || Boolean(options.scrollToTurnReceiptStart);
  const sustainedSubmittedFollow = !explicitNoStickToBottom
    && !userReadingCurrentTurn
    && sustainSubmittedMessageBottomFollowFromThread(thread);
  const fullRenderScrollPlan = conversationScroll.planFullRenderScroll({
    stickToBottom: options.stickToBottom,
    scrollToTurnReceiptStart: options.scrollToTurnReceiptStart,
    nearBottom,
    userReadingCurrentTurn,
    autoScrollHold: shouldHoldAutoScrollForCurrentTurn(),
    sustainedSubmittedFollow,
    submittedMessageFollow: shouldFollowSubmittedMessageToBottom(),
    viewportFollow: shouldFollowViewportChangeToBottom(),
  });
  const shouldStickToBottom = Boolean(fullRenderScrollPlan.stickToBottom);
  const previousKeys = existingConversationRenderKeys();
  const tileLayout = threadTileLayout();
  if (tileLayout.enabled) {
    clearGlobalLiveOperationDockForThreadTiles();
    if (renderThreadTileLayout(tileLayout, options)) {
      updateTickTimer();
      publishPluginNavigationState();
      return;
    }
  }
  updateCurrentThreadHeader(thread);
  setThreadTileConversationMode(false);
  const summaryRecoveryPlan = threadDetailStateApi.planSummaryOnlyCurrentThreadRecovery({
    thread,
    currentThreadId: state.currentThreadId,
    clientBuildId: CLIENT_BUILD_ID,
    hasThreadLoadController: Boolean(state.threadLoadController),
    hasRefreshThreadController: Boolean(state.refreshThreadController),
  });
  if (summaryRecoveryPlan.shouldRecover) {
    const summaryRecoveryEffectsPlan = threadDetailStateApi.planSummaryOnlyCurrentThreadRecoveryEffects(summaryRecoveryPlan);
    applySummaryOnlyCurrentThreadRecoveryEffectsPlan(summaryRecoveryEffectsPlan);
    thread = state.currentThread;
  }
  const earlyShellPlan = threadDetailRenderPlanApi.planSingleThreadEarlyShellExecution({
    threadId: thread.id || state.currentThreadId || "",
    currentThreadId: state.currentThreadId,
    loadingWithoutVisibleTurns: threadIsLoadingWithoutVisibleTurns(thread),
    loadError: thread.mobileLoadError,
    conversationSignature: conversationRenderSignature(thread),
    patchShellSignature: conversationPatchShellSignature(thread),
    stickToBottom: shouldStickToBottom,
    escapeHtml,
  });
  if (earlyShellPlan.shouldRender) {
    if (earlyShellPlan.clearLiveOperationDock) updateLiveOperationDockHtml("");
    const earlyUpdatePlan = threadDetailRenderPlanApi.planSingleThreadShellConversationUpdate({
      shellPlan: earlyShellPlan,
      conversationSignature: earlyShellPlan.conversationSignature,
      patchShellSignature: earlyShellPlan.patchShellSignature,
      stickToBottom: earlyShellPlan.stickToBottom,
      expectedVisibleTurnCount: 0,
      source: "single-thread-early-shell",
    });
    updateConversationHtml(
      earlyUpdatePlan.html,
      earlyUpdatePlan.conversationSignature,
      Object.assign({}, earlyUpdatePlan.options, { userReadingCurrentTurn }),
    );
    const earlyPostUpdateEffectsPlan = threadDetailRenderPlanApi.planSingleThreadShellPostUpdateEffects({
      shellPlan: earlyShellPlan,
      bindRetry: earlyShellPlan.bindRetry,
      retryThreadId: earlyShellPlan.retryThreadId || thread.id || state.currentThreadId,
      updateTickTimer: true,
      publishPluginNavigationState: true,
      reason: "single-thread-early-shell",
    });
    applySingleThreadShellPostUpdateEffectsPlan(earlyPostUpdateEffectsPlan, {
      thread,
      shellPlan: earlyShellPlan,
      threadId: thread.id || state.currentThreadId || "",
    });
    return;
  }
  const turns = visibleTurnsForConversation(thread);
  const omitted = Number(thread.mobileOmittedTurnCount || 0) + Math.max(0, (thread.turns || []).length - turns.length);
  const omittedBanner = renderThreadHistoryNote(thread, omitted, previousKeys);
  const readWarningKey = `read-warning|${state.currentThreadId}|${thread.mobileReadMode || ""}|${thread.mobileReadWarning || ""}`;
  const readWarningMessage = threadReadWarningMessage(thread);
  const readWarning = readWarningMessage
    ? `<div class="history-note${entryAnimationClass(readWarningKey, previousKeys)}" data-render-key="${escapeHtml(readWarningKey)}">${escapeHtml(readWarningMessage)}</div>`
    : "";
  const goalCard = renderThreadGoal(thread, previousKeys);
  const rolloutWarning = renderRolloutWarning(thread, previousKeys);
  const loadingNote = thread.mobileLoading
    ? `<div class="history-note entry-animate" data-render-key="loading-visible|${escapeHtml(state.currentThreadId || thread.id || "")}">正在加载最新线程状态...</div>`
    : "";
  const taskToolbar = renderThreadTaskToolbar(thread);
  const pluginRefreshNotice = renderPluginRefreshPendingNotice(previousKeys);
  const visibleTurnIds = new Set(turns.map((turn) => turn && turn.id).filter(Boolean).map(String));
  resetCopyTextStore();
  const turnsHtml = turns.map((turn) => renderTurn(turn, previousKeys)).join("");
  const liveOperationDock = renderLiveOperationDock(thread, previousKeys);
  const taskCardsHtml = renderThreadTaskCards(thread, previousKeys);
  const approvalsHtml = renderPendingApprovals(thread, previousKeys, (request) => {
    const turnId = approvalTurnId(request);
    if (turnId && visibleTurnIds.has(turnId)) return false;
    return isApprovalActive(request);
  });
  const shellPlan = threadDetailRenderPlanApi.planSingleThreadFullRenderShell({
    threadId: state.currentThreadId || thread.id || "",
    goalCard,
    rolloutWarning,
    loadingNote,
    taskToolbar,
    omittedBanner,
    readWarning,
    turnsHtml,
    approvalsHtml,
    taskCardsHtml,
    pluginRefreshNotice,
    readWarningMessage,
    escapeHtml,
  });
  updateLiveOperationDockHtml(liveOperationDock);
  const previousChildCount = $("conversation") ? $("conversation").childNodes.length : 0;
  const renderVisibleShape = visibleConversationShape(thread);
  const renderDomShape = conversationDomShape();
  const shellUpdatePlan = threadDetailRenderPlanApi.planSingleThreadShellConversationUpdate({
    shellPlan,
    conversationSignature: conversationRenderSignature(thread),
    patchShellSignature: conversationPatchShellSignature(thread),
    stickToBottom: shouldStickToBottom,
    expectedVisibleTurnCount: renderVisibleShape.visibleTurnCount,
    expectedVisibleItemCount: renderVisibleShape.visibleItemCount,
    renderedDomTurnCount: conversationDomTurnIds().length,
    renderedDomItemCount: renderDomShape.itemCount,
    duplicateRenderKeyCount: renderDomShape.duplicateRenderKeyCount,
    duplicateUserMessageCount: renderDomShape.duplicateUserMessageCount,
    expectedDuplicateUserMessageCount: renderVisibleShape.duplicateUserMessageCount,
    expectedTurnIds: visibleRenderableTurnIds(thread),
    renderedDomTurnIds: conversationDomTurnIds(),
    source: "single-thread-render",
    checkProjectionConsistency: true,
  });
  updateConversationHtml(
    shellUpdatePlan.html,
    shellUpdatePlan.conversationSignature,
    Object.assign({}, shellUpdatePlan.options, { userReadingCurrentTurn }),
  );
  const postUpdateEffectsPlan = threadDetailRenderPlanApi.planSingleThreadShellPostUpdateEffects({
    shellPlan,
    source: "single-thread-render",
    renderMode: "full-render",
    checkEmptyVisibleDetailMismatch: true,
    domCount: $("conversation") ? $("conversation").childNodes.length : 0,
    previousCount: previousChildCount,
    bindCurrentThreadActions: true,
    scrollToTurnReceiptStart: options.scrollToTurnReceiptStart,
    applyPendingPluginRouteHintFocus: true,
    updateTickTimer: true,
    publishPluginNavigationState: true,
  });
  applySingleThreadShellPostUpdateEffectsPlan(postUpdateEffectsPlan, {
    thread,
    shellPlan,
    threadId: thread.id || state.currentThreadId || "",
  });
}

function renderNewThreadDraft() {
  setThreadTileConversationMode(false);
  clearInterval(state.tickTimer);
  state.tickTimer = null;
  state.subagentPanelOpen = false;
  updateSubagentPanelUi();
  updateLiveOperationDockHtml("");
  const titleEl = $("threadTitle");
  const metaEl = $("threadMeta");
  const workspaceLabel = selectedWorkspaceLabel();
  if (titleEl) titleEl.textContent = "新建对话";
  if (metaEl) metaEl.textContent = state.selectedCwd ? workspaceLabel : "不指定 Workspace";
  const workspaceOptions = newThreadWorkspaceOptionsHtml();
  const hasWorkspaceOptions = true;
  const workspaceStatus = state.selectedCwd
    ? `<div class="new-thread-path">${escapeHtml(state.selectedCwd)}</div>`
    : `<div class="new-thread-path">将按 Codex App 的项目外聊天方式创建</div>`;
  const selectedModel = newThreadSelectedModel();
  const selectedEffort = newThreadSelectedEffort();
  const selectedPermission = newThreadSelectedPermissionMode();
  const pluginRefreshNotice = renderPluginRefreshPendingNotice();
  const html = `<div class="new-thread-page">
    <div class="new-thread-panel">
      ${pluginRefreshNotice}
      <div class="new-thread-kicker">New chat</div>
      <h1>新建对话</h1>
      <div class="new-thread-workspace">
        <label for="newThreadWorkspaceSelect">Workspace</label>
        <button id="newThreadWorkspaceSelect" class="new-thread-workspace-select" type="button" aria-haspopup="listbox" aria-expanded="false">
          ${escapeHtml(workspaceLabel)}
        </button>
        <div id="newThreadWorkspaceMenu" class="new-thread-workspace-menu" role="listbox" aria-label="Workspace 列表" hidden>
          ${workspaceOptions || `<div class="new-thread-workspace-empty">暂无可用 Workspace</div>`}
        </div>
        <div class="new-thread-selected">${escapeHtml(workspaceLabel)}</div>
        ${workspaceStatus}
      </div>
    </div>
  </div>`;
  updateConversationHtml(html, `new-thread|${state.selectedCwd}|${state.workspaces.length}|${selectedModel}|${selectedEffort}|${selectedPermission}`, {
    patchShellSignature: "",
  });
  const selectButton = $("newThreadWorkspaceSelect");
  const workspaceMenu = $("newThreadWorkspaceMenu");
  const shouldDisableWorkspaceSelect = !hasWorkspaceOptions;
  if (selectButton && workspaceMenu) {
    selectButton.textContent = workspaceLabel;
    selectButton.disabled = shouldDisableWorkspaceSelect;
    selectButton.setAttribute("title", shouldDisableWorkspaceSelect ? "暂无可用 Workspace" : "选择 Workspace");
    workspaceMenu.hidden = true;
    const closeMenu = () => {
      workspaceMenu.hidden = true;
      workspaceMenu.style.removeProperty("--workspace-menu-max-height");
      selectButton.setAttribute("aria-expanded", "false");
      document.removeEventListener("pointerdown", onOutsidePointer);
    };
    const onOutsidePointer = (event) => {
      if (!workspaceMenu.hidden && !workspaceMenu.contains(event.target) && !selectButton.contains(event.target)) {
        closeMenu();
      }
    };
    const openMenu = () => {
      workspaceMenu.hidden = false;
      fitWorkspaceMenuToViewport(workspaceMenu, selectButton);
      selectButton.setAttribute("aria-expanded", "true");
      document.addEventListener("pointerdown", onOutsidePointer);
    };
    const toggleMenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (shouldDisableWorkspaceSelect) return;
      if (workspaceMenu.hidden) {
        openMenu();
      } else {
        closeMenu();
      }
    };
    selectButton.addEventListener("pointerdown", toggleMenu);
    if (workspaceMenu) {
      workspaceMenu.querySelectorAll("[data-new-thread-workspace]").forEach((workspaceOption) => {
        workspaceOption.addEventListener("click", (event) => {
          const selectedWorkspace = event.currentTarget.dataset.newThreadWorkspace || "";
          event.preventDefault();
          event.stopPropagation();
          saveCurrentDraftNow();
          state.selectedCwd = selectedWorkspace || "";
          restoreDraftForCurrentTarget();
          const sidebarSelect = $("workspaceSelect");
          if (sidebarSelect) sidebarSelect.textContent = state.selectedCwd ? selectedWorkspaceLabel() : "All workspaces";
          syncSidebarWorkspaceSelect();
          updateWorkspacePath();
          renderNewThreadDraft();
          updateComposerControls();
          loadThreads({ silent: true }).catch(showError);
          closeMenu();
        });
      });
    }
    if (shouldDisableWorkspaceSelect) {
      workspaceMenu.hidden = true;
    }
  }
  renderComposerSettings();
  updateComposerControls();
  updateTurnTimer();
  publishPluginNavigationState();
}

function enterNewThreadDraft() {
  saveCurrentDraftNow();
  clearCurrentThreadSelection({ saveDraft: false });
  state.newThreadDraft = true;
  state.sendButtonHint = "";
  restoreDraftForCurrentTarget();
  renderComposerSettings();
  renderThreads();
  renderCurrentThread();
  restoreConnectionState();
  if (isMobileViewport()) closeSidebarMenu();
  window.setTimeout(() => {
    const input = $("messageInput");
    if (input) input.focus();
  }, 80);
}

function threadActionElementThreadId(element) {
  if (!element) return "";
  const direct = String(element.dataset && element.dataset.threadActionThreadId || "").trim();
  if (direct) return direct;
  const pane = typeof element.closest === "function" ? element.closest("[data-thread-tile-pane]") : null;
  return String(pane && pane.dataset && pane.dataset.threadTilePane || "").trim();
}

function threadActionContextFromElement(element) {
  const id = threadActionElementThreadId(element);
  if (id && state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
  if (id && state.threadTileDetails && state.threadTileDetails.has(id)) return state.threadTileDetails.get(id);
  if (id) return findThreadById(id);
  return state.currentThread || null;
}

function bindCurrentThreadActions() {
  $("conversation").querySelectorAll("[data-new-thread-from-current]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const thread = threadActionContextFromElement(button);
      if (thread) startNewThreadFromThread(thread, event).catch(showError);
    });
  });
  $("conversation").querySelectorAll("[data-create-thread-task-card]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const thread = threadActionContextFromElement(button);
      createThreadTaskCardFromThread(thread, event).catch(showError);
    });
  });
  $("conversation").querySelectorAll("[data-dismiss-rollout-warning]").forEach((button) => {
    button.addEventListener("click", () => dismissRolloutWarning(threadActionContextFromElement(button)));
  });
  $("conversation").querySelectorAll("[data-load-older-turns]").forEach((button) => {
    button.addEventListener("click", () => {
      const thread = threadActionContextFromElement(button);
      loadOlderThreadTurns({
        thread,
        threadId: threadActionElementThreadId(button) || thread && thread.id || "",
        preserveScroll: true,
        source: "button",
      }).catch(showError);
    });
  });
}


(function exposeCodexPaneLayoutRuntime(root) {
  root.CodexPaneLayoutRuntime = root.CodexPaneLayoutRuntime || {
    createPaneLayoutRuntime: function createPaneLayoutRuntime() {
      return {
      renderCurrentThread: typeof renderCurrentThread === "function" ? renderCurrentThread : null,
      updateConversationHtml: typeof updateConversationHtml === "function" ? updateConversationHtml : null,
      patchCurrentThreadDetailFromRefresh: typeof patchCurrentThreadDetailFromRefresh === "function" ? patchCurrentThreadDetailFromRefresh : null,
      syncThreadTileToggle: typeof syncThreadTileToggle === "function" ? syncThreadTileToggle : null,
      setThreadTileMode: typeof setThreadTileMode === "function" ? setThreadTileMode : null,
      renderHome: typeof renderHome === "function" ? renderHome : null,
      };
    },
  };
})(window);
