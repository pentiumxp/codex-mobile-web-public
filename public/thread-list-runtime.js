"use strict";

(function attachThreadListRuntime(root) {
function createThreadListRuntime(deps = {}) {
  const state = deps.state || {};
  const $ = typeof deps.$ === "function" ? deps.$ : () => null;
  const api = deps.api;
  const document = deps.document || root.document || {};
  const window = deps.window || root.window || root;
  const localStorage = deps.localStorage || root.localStorage || {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const setTimeout = typeof deps.setTimeout === "function" ? deps.setTimeout : root.setTimeout.bind(root);
  const clearTimeout = typeof deps.clearTimeout === "function" ? deps.clearTimeout : root.clearTimeout.bind(root);
  const THREAD_LIST_PAGE_LIMIT = deps.THREAD_LIST_PAGE_LIMIT;
  const THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS = deps.THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS;
  const THREAD_LIST_DEFERRED_FALLBACK_RETRY_MS = deps.THREAD_LIST_DEFERRED_FALLBACK_RETRY_MS;
  const THREAD_LIST_SLOW_PATH_MS = deps.THREAD_LIST_SLOW_PATH_MS;
  const STORAGE_THREAD_ID = deps.STORAGE_THREAD_ID;
  const {
    normalizeFsPath,
    escapeHtml,
    shortPath,
    isMobileViewport,
    tokenCountValue,
    formatTokenMillion,
    displayInputTokensExcludingCached,
    saveCurrentDraftNow,
    flushSideChatDraftNow,
    resetComposerRuntimeSelection,
    abortCurrentThreadRefresh,
    clearRecentCompletedReplyAnchor,
    clearConversationAutoScrollHold,
    setComposerText,
    replacePendingAttachments,
    syncActiveTurnFromThread,
    connectEvents,
    threadListLoadPolicy,
    nowPerfMs,
    roundedDurationMs,
    threadListSummaryFromDetailThread,
    threadListStableOrderPolicy,
    reconcileThreadStatusHints,
    renderCurrentThread,
    threadTileLayout,
    isThreadTileKeyboardFocusActive,
    threadTileCandidateIds,
    threadTileIdsEqual,
    restoreConnectionState,
    scheduleVisiblePageRefreshCheck,
    threadPerformanceMetrics,
    postPerformanceEvent,
    diagnosticDurationBucket,
    recordHomeAiDiagnosticFailure,
    recordHomeAiDiagnosticSuccess,
    threadDiagnosticEventsApi,
    renderThreadLoadError,
    diagnosticErrorCode,
    diagnosticErrorStatus,
    showError,
    visibleWorkspaceKeys,
    codexWorktreeRepoName,
    basenameForFsPath,
    visibleWorkspaceNames,
    statusText,
    threadUpdatedAtMs,
    scheduleRenderCurrentThread,
    threadTilePaneIsVisible,
    scheduleRenderThreadTilePane,
    updateThreadStatusHints,
    normalizeThreadGoal,
    updateThreadGoalDialogState,
    draftStore,
    readDraftMap,
    draftHasContent,
    restoreDraftForCurrentTarget,
    updateComposerControls,
    showHermesPluginPrimaryPage,
    isHermesEmbedMode,
    loadThread,
    isRunningStatus,
    rolloutSizeText,
    isRolloutOverThreshold,
    formatAbsoluteTime,
    formatTime,
    statusIconHtml,
    statusIconInfo,
    threadGoalForThread,
    renderThreadGoalBadge,
    handleThreadCardClick,
    threadGoalSignature,
    rolloutSizeBytes,
  } = deps;

async function loadWorkspaces() {
  const result = await api("/api/workspaces");
  state.workspaces = result.data || [];
  const select = $("workspaceSelect");
  const menu = $("workspaceSelectMenu");
  if (state.selectedCwd && !state.workspaces.some((ws) => normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd))) {
    state.selectedCwd = "";
  }
  if (select) {
    select.textContent = state.selectedCwd ? selectedWorkspaceLabel() : "All workspaces";
    select.disabled = !state.workspaces.length && !state.workspaceCreateEnabled;
    select.setAttribute("title", state.workspaces.length ? "Select Workspace" : "Create Workspace");
  }
  if (menu) {
    menu.innerHTML = workspaceSidebarOptionsHtml();
  }
  updateWorkspacePath();
  if (shouldRenderPrimaryConversationShell()) renderCurrentThread();
}

function workspaceSidebarOptionsHtml() {
  const allSelected = !state.selectedCwd ? " is-selected" : "";
  const allOption = `<button type="button" class="workspace-select-option${allSelected}" data-workspace-value="">All workspaces</button>`;
  const workspaceOptions = state.workspaces.length ? state.workspaces.map((ws) => {
    const count = ws.recentThreadCount ? ` (${ws.recentThreadCount})` : "";
    const label = `${ws.label}${count} - ${ws.cwd}`;
    const selected = normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd) ? " is-selected" : "";
    return `<button type="button" class="workspace-select-option${selected}" data-workspace-value="${escapeHtml(ws.cwd)}">${escapeHtml(label)}</button>`;
  }).join("") : `<div class="workspace-select-empty">No Workspace yet</div>`;
  const createRoot = state.workspaceCreateRoot ? `Under ${state.workspaceCreateRoot}` : "Create a local folder";
  const createOption = state.workspaceCreateEnabled
    ? `<button type="button" class="workspace-select-option workspace-create-option" data-create-workspace><span class="workspace-create-title">Create Workspace</span><span class="workspace-create-meta">${escapeHtml(createRoot)}</span></button>`
    : "";
  return allOption + workspaceOptions + createOption;
}

function syncSidebarWorkspaceSelect() {
  const select = $("workspaceSelect");
  const menu = $("workspaceSelectMenu");
  if (!select) return;
  select.textContent = state.selectedCwd ? selectedWorkspaceLabel() : "All workspaces";
  if (menu) {
    menu.innerHTML = workspaceSidebarOptionsHtml();
  }
}

function workspaceOptionsHtml() {
  return `<option value="">All workspaces</option>` + state.workspaces.map((ws) => {
    const count = ws.recentThreadCount ? ` (${ws.recentThreadCount})` : "";
    return `<option value="${escapeHtml(ws.cwd)}">${escapeHtml(`${ws.label}${count} - ${ws.cwd}`)}</option>`;
  }).join("");
}

function newThreadWorkspaceOptionsHtml() {
  const projectlessSelected = !state.selectedCwd ? " is-selected" : "";
  const projectlessOption = `<button type="button" class="new-thread-workspace-option${projectlessSelected}" data-new-thread-workspace=""><span>不指定 Workspace</span><span class="new-thread-workspace-option-meta">对齐 Codex App 的项目外聊天</span></button>`;
  return projectlessOption + state.workspaces.map((ws) => {
    const count = ws.recentThreadCount ? ` (${ws.recentThreadCount})` : "";
    const label = `${ws.label}${count} - ${ws.cwd}`;
    const selected = normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd) ? " is-selected" : "";
    return `<button type="button" class="new-thread-workspace-option${selected}" data-new-thread-workspace="${escapeHtml(ws.cwd)}">${escapeHtml(label)}</button>`;
  }).join("");
}

function newThreadChoiceOptionsHtml(values, selectedValue, dataName, labeler) {
  return normalizeOptionList(values).map((value) => {
    const selected = value === selectedValue ? " is-selected" : "";
    return `<button type="button" class="new-thread-choice${selected}" data-new-thread-${dataName}="${escapeHtml(value)}">${escapeHtml(labeler(value))}</button>`;
  }).join("");
}

function selectedWorkspaceLabel() {
  if (!state.selectedCwd) return "聊天";
  const workspace = state.workspaces.find((ws) => normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd));
  return workspace && workspace.label ? workspace.label : shortPath(state.selectedCwd);
}

function fitWorkspaceMenuToViewport(menu, anchor, options = {}) {
  if (!menu || !anchor) return;
  const rect = anchor.getBoundingClientRect();
  const composer = $("composer");
  const composerTop = composer ? composer.getBoundingClientRect().top : 0;
  const viewportBottom = window.innerHeight || document.documentElement.clientHeight || 0;
  const bottomLimit = options.avoidComposer !== false && composerTop > rect.bottom
    ? composerTop
    : viewportBottom;
  const gap = Number(options.gap || 18);
  const cap = Number(options.cap || (isMobileViewport() ? 360 : 420));
  const available = Math.max(120, Math.floor(bottomLimit - rect.bottom - gap));
  const height = Math.max(120, Math.min(cap, available));
  menu.style.setProperty("--workspace-menu-max-height", `${height}px`);
}

function updateWorkspacePath() {
  const el = $("workspacePath");
  if (!el) return;
  el.hidden = !state.selectedCwd;
  el.textContent = state.selectedCwd || "";
}

function renderWorkspaceTokenUsage() {
  const el = $("workspaceTokenUsage");
  if (!el) return;
  const usage = state.workspaceTokenUsage;
  if (!usage || typeof usage !== "object") {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  const hasAny = tokenCountValue(usage.totalTokens) || tokenCountValue(usage.todayTokens) || tokenCountValue(usage.weekTokens);
  if (!hasAny) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  el.innerHTML = `<div class="workspace-token-usage-summary">
    <span title="当前 Workspace 累计 token">总 ${escapeHtml(formatTokenMillion(usage.totalTokens))}</span>
    <span title="本周 token">周 ${escapeHtml(formatTokenMillion(usage.weekTokens))}</span>
    <span title="今日 token">今 ${escapeHtml(formatTokenMillion(usage.todayTokens))}</span>
    <button type="button" class="workspace-token-usage-toggle" data-workspace-token-usage-toggle>统计</button>
  </div>`;
  renderWorkspaceStatsDialog();
}

function tokenBreakdownHtml(entry, className = "workspace-token-usage-breakdown") {
  return `<div class="${escapeHtml(className)}" aria-label="Token usage breakdown">
    <span title="Uncached input tokens">Uncached ${escapeHtml(formatTokenMillion(displayInputTokensExcludingCached(entry)))}</span>
    <span title="Cached input tokens">Cached ${escapeHtml(formatTokenMillion(entry && entry.cachedInputTokens))}</span>
    <span title="Output tokens">Out ${escapeHtml(formatTokenMillion(entry && entry.outputTokens))}</span>
    <span title="Reasoning output tokens">Reason ${escapeHtml(formatTokenMillion(entry && entry.reasoningOutputTokens))}</span>
  </div>`;
}

function renderWorkspaceStatsDialog() {
  const dialog = $("workspaceStatsDialog");
  const content = $("workspaceStatsContent");
  const subtitle = $("workspaceStatsSubtitle");
  if (!dialog || !content) return;
  if (!state.workspaceTokenStatsOpen) {
    dialog.classList.add("hidden");
    content.innerHTML = "";
    return;
  }
  const usage = state.workspaceTokenUsage && typeof state.workspaceTokenUsage === "object"
    ? state.workspaceTokenUsage
    : {};
  const daily = Array.isArray(usage.daily) ? usage.daily.slice(0, 31) : [];
  const workspaces = Array.isArray(usage.workspaces) ? usage.workspaces.slice(0, 50) : [];
  if (subtitle) {
    subtitle.textContent = state.selectedCwd ? `当前 Workspace: ${state.selectedCwd}` : "All workspaces";
  }
  content.innerHTML = `<section class="workspace-stats-section">
    <div class="workspace-stats-section-title">总览</div>
    <div class="workspace-stats-summary-grid">
      <div><span>总计</span><strong>${escapeHtml(formatTokenMillion(usage.totalTokens))}</strong></div>
      <div><span>本周</span><strong>${escapeHtml(formatTokenMillion(usage.weekTokens))}</strong></div>
      <div><span>今日</span><strong>${escapeHtml(formatTokenMillion(usage.todayTokens))}</strong></div>
    </div>
    ${tokenBreakdownHtml(usage, "workspace-stats-breakdown")}
  </section>
  <section class="workspace-stats-section">
    <div class="workspace-stats-section-title">按天</div>
    <div class="workspace-stats-list">
      ${daily.length ? daily.map((entry) => `<article class="workspace-stats-row">
        <div class="workspace-stats-row-head">
          <span>${escapeHtml(entry.date || "")}</span>
          <strong>${escapeHtml(formatTokenMillion(entry.totalTokens))}</strong>
        </div>
        ${tokenBreakdownHtml(entry, "workspace-stats-breakdown")}
      </article>`).join("") : `<div class="workspace-token-usage-empty">暂无每日明细</div>`}
    </div>
  </section>
  <section class="workspace-stats-section">
    <div class="workspace-stats-section-title">按项目</div>
    <div class="workspace-stats-list">
      ${workspaces.length ? workspaces.map((entry) => `<article class="workspace-stats-row">
        <div class="workspace-stats-row-head">
          <span title="${escapeHtml(entry.cwd || "")}">${escapeHtml(shortPath(entry.cwd) || entry.cwd || "")}</span>
          <strong>${escapeHtml(formatTokenMillion(entry.totalTokens))}</strong>
        </div>
        <div class="workspace-stats-row-meta">
          <span>周 ${escapeHtml(formatTokenMillion(entry.weekTokens))}</span>
          <span>今 ${escapeHtml(formatTokenMillion(entry.todayTokens))}</span>
        </div>
        ${tokenBreakdownHtml(entry, "workspace-stats-breakdown")}
      </article>`).join("") : `<div class="workspace-token-usage-empty">暂无项目明细</div>`}
    </div>
  </section>`;
  dialog.classList.remove("hidden");
}

function openWorkspaceStatsDialog() {
  state.workspaceTokenStatsOpen = true;
  renderWorkspaceStatsDialog();
}

function closeWorkspaceStatsDialog() {
  state.workspaceTokenStatsOpen = false;
  renderWorkspaceStatsDialog();
}

function clearCurrentThreadSelection(options = {}) {
  if (options.saveDraft !== false) saveCurrentDraftNow();
  flushSideChatDraftNow().catch(() => {});
  state.threadLoadSeq += 1;
  state.sendButtonHint = "";
  resetComposerRuntimeSelection();
  state.newThreadTitle = "";
  if (state.threadLoadController) {
    state.threadLoadController.abort();
    state.threadLoadController = null;
  }
  abortCurrentThreadRefresh();
  state.currentThread = null;
  state.currentThreadId = "";
  state.activeTurnId = "";
  clearRecentCompletedReplyAnchor();
  clearConversationAutoScrollHold();
  localStorage.removeItem(STORAGE_THREAD_ID);
  setComposerText("");
  replacePendingAttachments([], { saveDraft: false });
  syncActiveTurnFromThread();
  if (state.events) connectEvents();
}

function renderThreadListLoading() {
  const list = $("threadList");
  if (!list) return;
  list.innerHTML = `<div class="empty-state">Loading threads...</div>`;
  state.renderedThreadListSignature = `loading|${state.selectedCwd}|${$("threadSearch").value.trim()}`;
}

function hasThreadDetailSelectionIntent() {
  return Boolean(
    state.currentThread
    || state.currentThreadId
    || state.threadLoadController
    || state.startupThreadOpenPending,
  );
}

function shouldRenderPrimaryConversationShell() {
  return !hasThreadDetailSelectionIntent() && !state.newThreadDraft;
}

function clearThreadListDeferredFallbackTimer() {
  if (!state.threadListDeferredFallbackTimer) return;
  clearTimeout(state.threadListDeferredFallbackTimer);
  state.threadListDeferredFallbackTimer = null;
}

function clearThreadListDeferredSilentTimer() {
  if (!state.threadListDeferredSilentTimer) return;
  clearTimeout(state.threadListDeferredSilentTimer);
  state.threadListDeferredSilentTimer = null;
}

function hasThreadDetailRequestInFlight() {
  return Boolean(
    state.threadLoadController
    || state.refreshThreadController
    || (state.currentThread && state.currentThread.mobileLoading),
  );
}

function scheduleThreadListDeferredFallback(delayMs = THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS) {
  clearThreadListDeferredFallbackTimer();
  const delay = Math.max(500, Number(delayMs) || THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS);
  state.threadListDeferredFallbackTimer = setTimeout(() => {
    state.threadListDeferredFallbackTimer = null;
    const search = $("threadSearch").value.trim();
    if (state.selectedCwd || search) return;
    if (state.threadListLoadController || hasThreadDetailRequestInFlight() || hasThreadDetailSelectionIntent()) {
      scheduleThreadListDeferredFallback(THREAD_LIST_DEFERRED_FALLBACK_RETRY_MS);
      return;
    }
    loadThreads({ silent: true, deferFallback: false }).catch(showError);
  }, delay);
}

function scheduleThreadListDeferredSilentRefresh(delayMs = 700, options = {}) {
  clearThreadListDeferredSilentTimer();
  const delay = Math.max(250, Number(delayMs) || 700);
  state.threadListDeferredSilentTimer = setTimeout(() => {
    state.threadListDeferredSilentTimer = null;
    if (document.visibilityState === "hidden") return;
    if (state.threadListLoadController || hasThreadDetailRequestInFlight()) {
      scheduleThreadListDeferredSilentRefresh(900, options);
      return;
    }
    loadThreads(Object.assign({}, options, {
      silent: true,
      allowDuringDetail: true,
      allowHidden: false,
    })).catch(showError);
  }, delay);
}

async function loadThreads(options = {}) {
  const silent = options.silent === true;
  if (silent && state.threadListLoadController) return null;
  if (options.deferFallback !== true) clearThreadListDeferredFallbackTimer();
  const params = new URLSearchParams({ limit: String(THREAD_LIST_PAGE_LIMIT), archived: "false" });
  if (state.selectedCwd) params.set("cwd", state.selectedCwd);
  const search = $("threadSearch").value.trim();
  if (search) params.set("search", search);
  const threadDetailOpening = hasThreadDetailRequestInFlight();
  const loadPlan = threadListLoadPolicy.planThreadListLoadRequest({
    deferFallback: options.deferFallback,
    search,
    selectedCwd: state.selectedCwd,
    silent,
    threadDetailOpening,
    threadListLoadedAtMs: state.threadListLoadedAtMs,
    documentHidden: document.visibilityState === "hidden",
    allowDuringDetail: options.allowDuringDetail === true,
    allowHidden: options.allowHidden === true,
  });
  if (!loadPlan.shouldLoad) {
    if (loadPlan.skipReason === "detail-in-flight") {
      scheduleThreadListDeferredSilentRefresh(loadPlan.retryDelayMs, {
        deferFallback: options.deferFallback,
      });
    }
    return null;
  }
  if (loadPlan.params && loadPlan.params.fallback) {
    params.set("fallback", "defer");
  }
  if (loadPlan.params && loadPlan.params.initial) {
    params.set("initial", "warm-fallback");
  }
  clearThreadListDeferredSilentTimer();
  const loadStartedAt = nowPerfMs();
  const seq = state.threadListLoadSeq + 1;
  state.threadListLoadSeq = seq;
  if (state.threadListLoadController) state.threadListLoadController.abort();
  const controller = new AbortController();
  state.threadListLoadController = controller;
  if (!silent) renderThreadListLoading();
  try {
    const apiStartedAt = nowPerfMs();
    const result = await api(`/api/threads?${params}`, { timeoutMs: 45000, signal: controller.signal });
    const apiElapsedMs = roundedDurationMs(apiStartedAt);
    if (seq !== state.threadListLoadSeq) return null;
    const renderStartedAt = nowPerfMs();
    const nextThreads = visibleThreads(result.data || [])
      .map((thread) => threadListSummaryFromDetailThread(thread) || thread);
    const stableOrderPlan = threadListStableOrderPolicy.planThreadListStableOrder({
      threads: nextThreads,
      previousState: state.threadListStableOrder,
      scopeKey: threadListStableOrderPolicy.threadListOrderScopeKey({ selectedCwd: state.selectedCwd, search }),
      selectedCwd: state.selectedCwd,
      search,
      nowMs: Date.now(),
    });
    state.threads = stableOrderPlan.threads;
    state.threadListStableOrder = stableOrderPlan.state;
    state.workspaceTokenUsage = result.mobileTokenUsage || null;
    state.threadListLoadedAtMs = Date.now();
    reconcileThreadStatusHints(state.threads);
    renderWorkspaceTokenUsage();
    renderThreads(result);
    if (state.currentThread && state.threadTileMode && !isThreadTileKeyboardFocusActive()) {
      const tileLayout = threadTileLayout();
      if (tileLayout.enabled) {
        const nextTileIds = threadTileCandidateIds(tileLayout);
        if (!threadTileIdsEqual(nextTileIds, state.threadTileActiveIds)) renderCurrentThread({ stickToBottom: true });
      }
    }
    restoreConnectionState(result.mobileFallback ? "Recovered from session index" : "Connected");
    scheduleVisiblePageRefreshCheck(500);
    if (result && (result.mobileDeferredFallback || result.mobileDeferredAppServer) && !state.selectedCwd && !search) {
      scheduleThreadListDeferredFallback();
    }
    if (shouldRenderPrimaryConversationShell()) renderCurrentThread();
    const listPerformance = threadPerformanceMetrics.threadListEventFields(result);
    const listPerformanceEvent = {
      elapsedMs: roundedDurationMs(loadStartedAt),
      apiElapsedMs,
      renderElapsedMs: roundedDurationMs(renderStartedAt),
      serverTimings: listPerformance.serverTimings,
      performancePhase: listPerformance.performancePhase,
      count: state.threads.length,
      silent,
      hasSearch: Boolean(search),
      hasWorkspace: Boolean(state.selectedCwd),
      mobileFallback: Boolean(result.mobileFallback),
    };
    postPerformanceEvent("thread_list_rendered", listPerformanceEvent);
    const listSlowPlan = threadPerformanceMetrics.planThreadListSlowPathDiagnostic(listPerformanceEvent, {
      action: "thread-list-load",
      source: silent ? "thread-list-refresh" : "thread-list-load",
      durationBucket: diagnosticDurationBucket(listPerformanceEvent.elapsedMs),
      thresholdMs: THREAD_LIST_SLOW_PATH_MS,
    });
    if (listSlowPlan.shouldReport) {
      recordHomeAiDiagnosticFailure(threadDiagnosticEventsApi.threadListSlowPathDiagnosticEvent(listSlowPlan));
    } else {
      recordHomeAiDiagnosticSuccess(threadDiagnosticEventsApi.threadListSlowPathDiagnosticSuccess({
        action: "thread-list-load",
        performancePhase: listPerformance.performancePhase,
      }));
    }
    recordHomeAiDiagnosticSuccess({
      category: "thread_session_load_failed",
      diagnostic_type: "thread_list_load_failed",
      error_code: "thread_list_load_failed",
      context: {
        surface: "thread-session",
        action: "thread-list-load",
      },
    });
    return result;
  } catch (err) {
    if (seq !== state.threadListLoadSeq || controller.signal.aborted) return null;
    if (!silent) renderThreadLoadError(err);
    recordHomeAiDiagnosticFailure({
      category: "thread_session_load_failed",
      diagnostic_type: "thread_list_load_failed",
      severity_hint: "H3",
      evidence_confidence: 0.7,
      error_code: diagnosticErrorCode(err, "thread_list_load_failed"),
      duration_bucket: diagnosticDurationBucket(roundedDurationMs(loadStartedAt)),
      context: {
        surface: "thread-session",
        action: "thread-list-load",
      },
      counts: {
        status_code: diagnosticErrorStatus(err),
      },
      breadcrumbs: [{
        kind: "thread-session",
        code: "thread-list-load",
        status: "failed",
        duration_bucket: diagnosticDurationBucket(roundedDurationMs(loadStartedAt)),
        fields: {
          status_code: diagnosticErrorStatus(err),
        },
      }],
    });
    throw err;
  } finally {
    if (state.threadListLoadController === controller) state.threadListLoadController = null;
  }
}

function threadMatchesWorkspaceCwd(threadCwd, workspaceCwd) {
  const threadKey = normalizeFsPath(threadCwd);
  const workspaceKey = normalizeFsPath(workspaceCwd);
  if (!workspaceKey) return true;
  if (threadKey === workspaceKey) return true;
  const repoName = codexWorktreeRepoName(threadCwd);
  return Boolean(repoName && repoName === basenameForFsPath(workspaceCwd));
}

function threadMatchesVisibleWorkspace(threadCwd) {
  const cwd = normalizeFsPath(threadCwd);
  const keys = visibleWorkspaceKeys();
  if (keys.size <= 0 || !cwd) return true;
  if (keys.has(cwd)) return true;
  const repoName = codexWorktreeRepoName(threadCwd);
  return Boolean(repoName && visibleWorkspaceNames().has(repoName));
}

function isHiddenThread(thread) {
  if (!thread) return true;
  const status = statusText(thread.status).toLowerCase();
  const location = String(thread.path || thread.rolloutPath || thread.rollout_path || "").toLowerCase();
  if (thread.archived || thread.archivedAt || thread.archived_at || thread.isArchived) return true;
  if (thread.deleted || thread.deletedAt || thread.deleted_at || thread.isDeleted || thread.removed || thread.removedAt) return true;
  if (/archived|deleted|removed/.test(status)) return true;
  if (/[/\\](archived|deleted|trash|removed)[_-]?sessions[/\\]/.test(location)) return true;
  if (/\.jsonl\.(bak|backup|old)(?:\b|[-_.])/.test(location)) return true;
  const cwd = normalizeFsPath(thread.cwd);
  if (state.selectedCwd && !threadMatchesWorkspaceCwd(thread.cwd, state.selectedCwd)) return true;
  if (cwd && !threadMatchesVisibleWorkspace(thread.cwd)) return true;
  return false;
}

function visibleThreads(threads = state.threads) {
  return (threads || []).filter((thread) => !isHiddenThread(thread));
}

function pruneHiddenThreads() {
  state.threads = visibleThreads();
}

function applyThreadStatusToThread(thread, status) {
  if (!thread) return false;
  thread.status = status;
  return true;
}

function updateThreadActivityTimestamp(thread, eventAtMs = 0) {
  if (!thread) return false;
  const nextMs = Math.max(0, Math.trunc(Number(eventAtMs) || 0));
  if (!nextMs) return false;
  const currentMs = typeof threadUpdatedAtMs === "function" ? threadUpdatedAtMs(thread) : 0;
  if (currentMs && currentMs >= nextMs) return false;
  thread.updatedAt = Math.floor(nextMs / 1000);
  return true;
}

function syncThreadListStableOrderFromCurrentThreads() {
  if (!state.threadListStableOrder || typeof state.threadListStableOrder !== "object") return;
  const updatedAtById = {};
  const order = [];
  for (const thread of state.threads || []) {
    const id = String(thread && thread.id || "");
    if (!id) continue;
    order.push(id);
    const updatedAtMs = typeof threadUpdatedAtMs === "function" ? threadUpdatedAtMs(thread) : 0;
    if (updatedAtMs > 0) updatedAtById[id] = updatedAtMs;
  }
  state.threadListStableOrder = Object.assign({}, state.threadListStableOrder, {
    order,
    updatedAtById,
  });
}

function sortThreadListByUpdatedAt() {
  const indexed = (state.threads || []).map((thread, index) => ({
    thread,
    index,
    updatedAtMs: typeof threadUpdatedAtMs === "function" ? threadUpdatedAtMs(thread) : 0,
  }));
  indexed.sort((left, right) => (right.updatedAtMs - left.updatedAtMs) || (left.index - right.index));
  state.threads = indexed.map((entry) => entry.thread);
  syncThreadListStableOrderFromCurrentThreads();
}

function promoteThreadListActivity(threadId, eventAtMs = 0) {
  const id = String(threadId || "");
  if (!id) return false;
  const listThread = state.threads.find((entry) => String(entry && entry.id || "") === id);
  let changed = false;
  if (updateThreadActivityTimestamp(listThread, eventAtMs)) changed = true;
  if (updateThreadActivityTimestamp(state.currentThread && String(state.currentThread.id || "") === id ? state.currentThread : null, eventAtMs)) changed = true;
  if (updateThreadActivityTimestamp(state.threadTileDetails && state.threadTileDetails.get(String(id)) || null, eventAtMs)) changed = true;
  if (changed && listThread) sortThreadListByUpdatedAt();
  return changed;
}

function scheduleThreadStatusDetailRender(threadId = "") {
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

function updateThreadListStatus(threadId, status, options = {}) {
  const id = String(threadId || "");
  if (!id) return;
  const thread = state.threads.find((entry) => String(entry && entry.id || "") === id);
  applyThreadStatusToThread(thread, status);
  applyThreadStatusToThread(state.currentThread && String(state.currentThread.id || "") === id ? state.currentThread : null, status);
  applyThreadStatusToThread(state.threadTileDetails && state.threadTileDetails.get(String(id)) || null, status);
  if (options.promote !== false) promoteThreadListActivity(id, options.eventAtMs || 0);
  if (options.render === true) scheduleThreadStatusDetailRender(id);
}

function localThreadForStatusContext(threadId) {
  const id = String(threadId || "").trim();
  if (!id) return null;
  if (state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
  return state.threads.find((entry) => String(entry && entry.id || "") === id)
    || state.threadTileDetails && state.threadTileDetails.get(String(id))
    || null;
}

function snapshotThreadStatus(threadId) {
  const id = String(threadId || "");
  if (!id) return null;
  const listThread = state.threads.find((entry) => String(entry && entry.id || "") === id) || null;
  const currentMatches = Boolean(state.currentThread && String(state.currentThread.id || "") === id);
  const tileThread = state.threadTileDetails && state.threadTileDetails.get(String(id)) || null;
  return {
    id,
    hadListThread: Boolean(listThread),
    listStatus: listThread ? listThread.status : undefined,
    hadCurrentThread: currentMatches,
    currentStatus: currentMatches ? state.currentThread.status : undefined,
    hadTileThread: Boolean(tileThread),
    tileStatus: tileThread ? tileThread.status : undefined,
  };
}

function restoreThreadStatusSnapshot(snapshot) {
  if (!snapshot || !snapshot.id) return;
  const id = String(snapshot.id);
  const listThread = state.threads.find((entry) => String(entry && entry.id || "") === id) || null;
  const currentThread = state.currentThread && String(state.currentThread.id || "") === id ? state.currentThread : null;
  const tileThread = state.threadTileDetails && state.threadTileDetails.get(String(id)) || null;
  const restoredStatus = snapshot.hadCurrentThread
    ? snapshot.currentStatus
    : snapshot.hadListThread
      ? snapshot.listStatus
      : snapshot.tileStatus;
  const targetThread = localThreadForStatusContext(id) || currentThread || listThread || tileThread;
  updateThreadStatusHints(id, { type: "active" }, restoredStatus, {
    thread: targetThread,
    notify: false,
  });
  const listIndex = state.threads.findIndex((entry) => String(entry && entry.id || "") === id);
  if (snapshot.hadListThread && listIndex >= 0) {
    applyThreadStatusToThread(state.threads[listIndex], snapshot.listStatus);
  } else if (!snapshot.hadListThread && listIndex >= 0) {
    state.threads = state.threads.filter((entry) => String(entry && entry.id || "") !== id);
  }
  if (snapshot.hadCurrentThread && state.currentThread && String(state.currentThread.id || "") === id) {
    state.currentThread.status = snapshot.currentStatus;
  }
  if (snapshot.hadTileThread) {
    applyThreadStatusToThread(state.threadTileDetails && state.threadTileDetails.get(String(id)) || null, snapshot.tileStatus);
  }
  pruneHiddenThreads();
  scheduleThreadStatusDetailRender(id);
}

function scheduleRenderThreads() {
  if (state.threadListRenderFrame || state.threadListRenderScheduled) return;
  state.threadListRenderScheduled = true;
  const render = () => {
    state.threadListRenderFrame = null;
    state.threadListRenderScheduled = false;
    renderThreads();
  };
  if (window.requestAnimationFrame) {
    state.threadListRenderFrame = window.requestAnimationFrame(render);
  } else {
    state.threadListRenderFrame = setTimeout(render, 33);
  }
}

function updateThreadGoalState(threadId, goal) {
  const id = String(threadId || goal && goal.threadId || "").trim();
  if (!id) return;
  const normalizedGoal = goal ? normalizeThreadGoal(goal, id) : null;
  const thread = state.threads.find((entry) => String(entry && entry.id || "") === id);
  applyThreadGoalToThread(thread, normalizedGoal);
  applyThreadGoalToThread(state.currentThread && String(state.currentThread.id || "") === id ? state.currentThread : null, normalizedGoal);
  applyThreadGoalToThread(state.threadTileDetails && state.threadTileDetails.get(String(id)) || null, normalizedGoal);
  scheduleThreadGoalDetailRender(id);
  if (state.goalDialogThreadId && state.goalDialogThreadId === id) {
    updateThreadGoalDialogState(normalizedGoal);
  }
  scheduleRenderThreads();
}

function renderThreads(result = null) {
  const list = $("threadList");
  pruneHiddenThreads();
  if (!state.threads.length) {
    if (state.renderedThreadListSignature !== "empty") {
      list.innerHTML = `<div class="empty-state">No threads.</div>`;
      state.renderedThreadListSignature = "empty";
    }
    return;
  }
  const warning = result && result.mobileFallback
    ? `<div class="history-note">Live thread list recovering. Showing cached session index.</div>`
    : "";
  const nowMs = Date.now();
  const html = warning + state.threads.map((thread) => {
    const title = thread.name || thread.preview || thread.id;
    const sizeText = rolloutSizeText(thread);
    const sizeWarn = isRolloutOverThreshold(thread);
    const updatedTitle = formatAbsoluteTime(thread.updatedAt);
    const pathText = shortPath(thread.cwd) || "聊天";
    const isWorkspaceLess = !thread.cwd;
    const timeText = formatTime(thread.updatedAt, nowMs);
    const statusIcon = statusIconHtml(thread.status, "thread-status-icon", thread.id);
    const iconKind = statusIconInfo(thread.status, thread.id)?.kind || "";
    const active = thread.id === state.currentThreadId ? " active" : "";
    const emphasis = iconKind ? ` has-status-${iconKind}` : "";
    const goal = threadGoalForThread(thread);
    const goalBadge = renderThreadGoalBadge(goal);
    const pendingIncomingTaskCards = Math.max(0, Number(thread && thread.pendingIncomingTaskCardCount) || 0);
    const taskCardBadge = pendingIncomingTaskCards
      ? `<div class="thread-card-task-badge" title="Pending incoming task cards">${escapeHtml(`Task ${pendingIncomingTaskCards}`)}</div>`
      : "";
    const sizeBadge = sizeText
      ? `<div class="thread-card-size${sizeWarn ? " warn" : ""}" title="Rollout file size">${escapeHtml(sizeText)}</div>`
      : "";
    return `<div class="thread-card-wrap${sizeWarn ? " rollout-warn" : ""}" data-thread-row="${escapeHtml(thread.id)}">
      <button class="thread-card${active}${emphasis}${sizeWarn ? " rollout-warn" : ""}" type="button" data-thread="${escapeHtml(thread.id)}">
        <div class="thread-card-title-row">
          <div class="thread-card-title">${escapeHtml(title)}</div>
          <div class="thread-card-title-actions">${statusIcon}</div>
        </div>
        <div class="thread-card-meta-row">
          <div class="thread-card-meta">
            <span class="thread-card-path${isWorkspaceLess ? " thread-card-path-chat" : ""}">${escapeHtml(pathText)}</span>
            ${timeText ? `<span class="thread-card-time" title="${escapeHtml(updatedTitle)}">${escapeHtml(timeText)}</span>` : ""}
          </div>
          <div class="thread-card-meta-badges">
            ${goalBadge}
            ${taskCardBadge}
            ${sizeBadge}
          </div>
        </div>
      </button>
    </div>`;
  }).join("");
  const signature = JSON.stringify({
    warning: Boolean(warning),
    currentThreadId: state.currentThreadId,
    timeBucket: Math.floor(nowMs / 60000),
    threads: state.threads.map((thread) => [
      thread.id,
      thread.name || thread.preview || thread.id,
      shortPath(thread.cwd) || "聊天",
      thread.updatedAt,
      statusText(thread.status),
      statusIconInfo(thread.status, thread.id)?.kind || "",
      threadGoalSignature(thread),
      state.unreadThreadIds.has(thread.id) ? 1 : 0,
      Number(thread.pendingIncomingTaskCardCount || 0),
      rolloutSizeBytes(thread),
      isRolloutOverThreshold(thread),
    ]),
  });
  if (state.renderedThreadListSignature === signature) return;
  list.innerHTML = html;
  state.renderedThreadListSignature = signature;
  list.querySelectorAll("[data-thread]").forEach((button) => {
    button.addEventListener("click", handleThreadCardClick);
  });
}

async function restoreThreadSelection() {
  if (hasThreadDetailSelectionIntent()) return;
  if (isHermesEmbedMode()) {
    state.startupThreadOpenPending = false;
    showHermesPluginPrimaryPage({ source: "restore-empty" });
    return;
  }
  const savedThreadId = localStorage.getItem(STORAGE_THREAD_ID) || "";
  if (!state.threads.length && !savedThreadId) {
    state.startupThreadOpenPending = false;
    restoreNewThreadDraftSelection();
    return;
  }
  const saved = savedThreadId && state.threads.find((thread) => thread.id === savedThreadId);
  const active = state.threads.find((thread) => isRunningStatus(thread.status));
  const target = saved || (savedThreadId ? { id: savedThreadId } : active);
  if (!target) {
    state.startupThreadOpenPending = false;
    restoreNewThreadDraftSelection();
    return;
  }
  try {
    await loadThread(target.id, { source: "restore" });
  } catch (err) {
    state.startupThreadOpenPending = false;
    if (target.id === savedThreadId) localStorage.removeItem(STORAGE_THREAD_ID);
    showError(err);
    renderCurrentThread();
  }
}

function restoreNewThreadDraftSelection() {
  const key = draftStore.getTargetKey();
  if (!key.startsWith("new:")) return false;
  const draft = readDraftMap()[key];
  if (!draftHasContent(draft)) return false;
  const cwd = String(draft.cwd || "");
  const workspace = cwd
    ? state.workspaces.find((ws) => normalizeFsPath(ws.cwd) === normalizeFsPath(cwd))
    : null;
  if (!workspace) return false;
  state.selectedCwd = workspace.cwd || cwd;
  clearCurrentThreadSelection({ saveDraft: false });
  state.newThreadDraft = true;
  restoreDraftForCurrentTarget();
  syncSidebarWorkspaceSelect();
  updateWorkspacePath();
  renderThreads();
  renderCurrentThread();
  updateComposerControls();
  return true;
}

async function selectWorkspaceShortcut(cwd) {
  saveCurrentDraftNow();
  state.selectedCwd = cwd || "";
  clearCurrentThreadSelection({ saveDraft: false });
  const select = $("workspaceSelect");
  if (select) select.textContent = state.selectedCwd ? selectedWorkspaceLabel() : "All workspaces";
  syncSidebarWorkspaceSelect();
  updateWorkspacePath();
  updateComposerControls();
  renderCurrentThread();
  await loadThreads();
}

  return {
    loadWorkspaces,
    workspaceSidebarOptionsHtml,
    syncSidebarWorkspaceSelect,
    workspaceOptionsHtml,
    newThreadWorkspaceOptionsHtml,
    newThreadChoiceOptionsHtml,
    selectedWorkspaceLabel,
    fitWorkspaceMenuToViewport,
    updateWorkspacePath,
    renderWorkspaceTokenUsage,
    tokenBreakdownHtml,
    renderWorkspaceStatsDialog,
    openWorkspaceStatsDialog,
    closeWorkspaceStatsDialog,
    clearCurrentThreadSelection,
    renderThreadListLoading,
    hasThreadDetailSelectionIntent,
    shouldRenderPrimaryConversationShell,
    clearThreadListDeferredFallbackTimer,
    clearThreadListDeferredSilentTimer,
    hasThreadDetailRequestInFlight,
    scheduleThreadListDeferredFallback,
    scheduleThreadListDeferredSilentRefresh,
    loadThreads,
    threadMatchesWorkspaceCwd,
    threadMatchesVisibleWorkspace,
    isHiddenThread,
    visibleThreads,
    pruneHiddenThreads,
    applyThreadStatusToThread,
    scheduleThreadStatusDetailRender,
    updateThreadListStatus,
    localThreadForStatusContext,
    snapshotThreadStatus,
    restoreThreadStatusSnapshot,
    scheduleRenderThreads,
    updateThreadGoalState,
    renderThreads,
    restoreThreadSelection,
    restoreNewThreadDraftSelection,
    selectWorkspaceShortcut,
  };
}

const api = { createThreadListRuntime };

if (typeof module === "object" && module.exports) {
  module.exports = api;
}

root.CodexThreadListRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
