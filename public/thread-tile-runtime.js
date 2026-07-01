"use strict";

(function attachThreadTileRuntime(root) {
function createThreadTileRuntime(deps = {}) {
  const fallbackStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const {
    state,
    $,
    api,
    document,
    window,
    localStorage,
    setTimeout,
    clearTimeout,
    AbortController,
    THREAD_TILE_USER_MAX_PANES,
    THREAD_TILE_DETAIL_LOAD_QUEUE_DRAIN_MS,
    THREAD_TILE_REFRESH_INTERVAL_MS,
    THREAD_TILE_REFRESH_MIN_INTERVAL_MS,
    THREAD_TILE_SETTINGS_SAVE_DEBOUNCE_MS,
    STORAGE_THREAD_DISPLAY_MODE,
    STORAGE_LEGACY_THREAD_TILE_MODE,
    LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS,
    threadTileActionsApi,
    threadTileStatePolicy,
    threadTileLayoutPolicy,
    threadDetailPatchPlanApi,
    isKeyboardEditableElement,
    splitPaneSidebarVisible,
    isMenuOverlayMode,
    visibleThreads,
    isRunningStatus,
    saveCurrentDraftNow,
    restoreDraftForCurrentTarget,
    renderComposerSettings,
    updateComposerControls,
    scheduleRenderCurrentThread,
    renderCurrentThread,
    showError,
    threadById,
    threadDisplayName,
    shortPath,
    formatTime,
    statusIconHtml,
    threadDetailApiPath,
    mergeThreadPreservingVisibleItems,
    mergeThreadIntoThreadList,
    withRenderContextThread,
    visibleItemsForTurn,
    renderVisibleItemPatchHtml,
    renderTurnVisibleItemBudgetNotice,
    approvalsForTurn,
    renderApprovalRequest,
    approvalTurnId,
    isApprovalActive,
    currentLiveOperationEntry,
    latestLiveTurnForThread,
    renderMobileOperationStack,
    visibleItemSignature,
    threadTitleForDisplay,
    turnTimerStateHtml,
    threadTilePaneTimerState,
    threadHasVisibleConversationTurns,
    threadReadWarningMessage,
    visibleTurnsForConversation,
    renderThreadHistoryNote,
    renderPendingApprovals,
    effectiveThreadTileSelectedThreadId,
    conversationRenderSignature,
    existingConversationRenderKeys,
    patchNode,
    hydrateThreadDetailSurface,
    clearGlobalLiveOperationDockForThreadTiles,
    updateConversationHtml,
    threadTileVisibleShape,
    threadTileDomTurnCount,
    conversationDomShape,
    diagnosticHash,
    publishPluginNavigationState,
    escapeHtml,
  } = Object.assign({
    document: root.document || {},
    window: root.window || root,
    localStorage: root.localStorage || fallbackStorage,
    setTimeout: typeof root.setTimeout === "function" ? root.setTimeout.bind(root) : () => 0,
    clearTimeout: typeof root.clearTimeout === "function" ? root.clearTimeout.bind(root) : () => {},
    AbortController: root.AbortController,
  }, deps);

function updateThreadTileGlobalHeader(layout = null, ids = []) {
  const titleEl = $("threadTitle");
  const metaEl = $("threadMeta");
  if (titleEl) titleEl.textContent = "";
  if (metaEl) metaEl.textContent = "";
}

function viewportPixelSize(options = {}) {
  const visualViewport = window.visualViewport;
  const visualWidth = Math.round((visualViewport && visualViewport.width) || 0);
  const visualHeight = Math.round((visualViewport && visualViewport.height) || 0);
  const layoutWidth = Math.round(window.innerWidth || document.documentElement.clientWidth || 0);
  const layoutHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
  if (options.preferLayoutViewport) {
    return {
      width: Math.max(layoutWidth, visualWidth),
      height: Math.max(layoutHeight, visualHeight),
    };
  }
  return {
    width: Math.round(visualWidth || layoutWidth || 0),
    height: Math.round(visualHeight || layoutHeight || 0),
  };
}

function isCoarsePointerViewport() {
  return Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
}

function isThreadTileKeyboardFocusActive() {
  return Boolean(state.threadTileMode && isKeyboardEditableElement(document.activeElement));
}

function threadTileViewportSize() {
  const layoutViewport = viewportPixelSize({ preferLayoutViewport: true });
  const plan = threadTileStatePolicy.threadTileViewportBaselinePlan({
    keyboardActive: isThreadTileKeyboardFocusActive(),
    layoutViewport,
    baseline: state.threadTileViewportBaseline,
  });
  if (plan.updateBaseline) state.threadTileViewportBaseline = plan.nextBaseline;
  return plan.viewport;
}

function threadTileVerticalChromePx() {
  const plan = threadTileStatePolicy.threadTileVerticalChromePlan({
    keyboardActive: isThreadTileKeyboardFocusActive(),
    composerHeightPx: state.composerHeightPx,
    baselineComposerHeightPx: state.threadTileComposerHeightBaselinePx,
  });
  if (plan.updateBaseline) state.threadTileComposerHeightBaselinePx = plan.nextComposerHeightBaselinePx;
  return plan.verticalChromePx;
}

function threadTileLayout(options = {}) {
  const viewport = threadTileViewportSize();
  const sidebar = $("sidebar");
  const sidebarSplitVisible = splitPaneSidebarVisible();
  const menuOverlay = isMenuOverlayMode() || !sidebarSplitVisible;
  const sidebarWidth = sidebar && sidebarSplitVisible
    ? Math.round(sidebar.getBoundingClientRect().width || 0)
    : 0;
  return threadTileLayoutPolicy.layoutForViewport({
    enabled: Object.prototype.hasOwnProperty.call(options, "enabled") ? options.enabled === true : state.threadTileMode,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    sidebarWidth,
    coarsePointer: isCoarsePointerViewport(),
    menuOverlay,
    maxPanes: THREAD_TILE_USER_MAX_PANES,
    recommendedMaxPanes: threadTileLayoutPolicy.DEFAULT_MAX_PANES,
    desiredPaneCount: normalizeThreadTilePaneCount(state.threadTilePaneCount, 0),
    verticalChromePx: threadTileVerticalChromePx(),
  });
}

function normalizeThreadTilePaneCount(value, fallback = 0) {
  return threadTileStatePolicy.normalizePaneCount(value, {
    fallback,
    maxPanes: THREAD_TILE_USER_MAX_PANES,
  });
}

function threadTileLayoutCapacity(layout = threadTileLayout()) {
  return threadTileStatePolicy.layoutCapacity(layout, {
    capacityMaxPanes: threadTileLayoutPolicy.DEFAULT_MAX_PANES,
    maxPanes: THREAD_TILE_USER_MAX_PANES,
  });
}

function defaultThreadTileCandidateIds(layout = threadTileLayout(), options = {}) {
  const maxPanes = Math.max(1, Math.min(
    THREAD_TILE_USER_MAX_PANES,
    Math.floor(Number(options.maxPanes || layout && layout.maxPanes || 1)) || 1,
  ));
  const threadIds = visibleThreads(state.threads).map((thread) => thread && thread.id).filter(Boolean);
  return threadTileLayoutPolicy.selectThreadTileIds({
    currentThreadId: state.currentThreadId,
    threadIds,
    maxPanes,
  });
}

function threadTileRunningPaneIds() {
  const runningIds = [];
  visibleThreads(state.threads).forEach((thread) => {
    const id = String(thread && thread.id || "");
    if (id && isRunningStatus(thread && thread.status)) runningIds.push(id);
  });
  if (state.currentThreadId) runningIds.push(String(state.currentThreadId));
  return threadTileStatePolicy.uniqueIds(runningIds);
}

function threadTilePaneCountState(layout = threadTileLayout()) {
  const capacity = threadTileLayoutCapacity(layout);
  return threadTileStatePolicy.paneCountStatePlan({
    capacity,
    candidateIds: defaultThreadTileCandidateIds(layout, { maxPanes: capacity }),
    maxCandidateIds: defaultThreadTileCandidateIds(layout, { maxPanes: THREAD_TILE_USER_MAX_PANES }),
    runningIds: threadTileRunningPaneIds(),
    currentThreadId: state.currentThreadId,
    explicitPaneCount: state.threadTilePaneCount,
  }, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
  });
}

function autoThreadTilePaneCount(layout = threadTileLayout()) {
  return threadTilePaneCountState(layout).autoPaneCount;
}

function effectiveThreadTilePaneCount(layout = threadTileLayout()) {
  return threadTilePaneCountState(layout).effectivePaneCount;
}

function threadTileDisplayLayout(layout = threadTileLayout(), ids = []) {
  return threadTileStatePolicy.paneDisplayLayoutPlan({
    layout,
    ids,
    effectivePaneCount: effectiveThreadTilePaneCount(layout),
    splitPairs: threadTilePrunedSplitPairs(ids),
  }, {
    capacityMaxPanes: threadTileLayoutPolicy.DEFAULT_MAX_PANES,
    maxPanes: THREAD_TILE_USER_MAX_PANES,
    threadTileColumnGroups: threadTileLayoutPolicy.threadTileColumnGroups,
  }).displayLayout;
}

function normalizeThreadTilePinnedIds(values = []) {
  return threadTileStatePolicy.normalizePinnedIds(values, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
  });
}

function normalizeThreadTileSplitPairs(values = [], ids = []) {
  return threadTileStatePolicy.normalizeSplitPairs(values, ids, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
    normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs,
  });
}

function threadTilePrunedSplitPairs(ids = threadTileCandidateIds()) {
  return normalizeThreadTileSplitPairs(state.threadTileSplitPairs, ids);
}

function threadTileVisibleIdSet() {
  const visibleIds = new Set(visibleThreads(state.threads).map((thread) => String(thread && thread.id || "")).filter(Boolean));
  if (state.currentThreadId) visibleIds.add(String(state.currentThreadId));
  return visibleIds;
}

function threadTileIdsEqual(a = [], b = []) {
  return threadTileStatePolicy.idsEqual(a, b);
}

function threadTileCandidateIds(layout = threadTileLayout()) {
  const maxPanes = effectiveThreadTilePaneCount(layout);
  const plan = threadTileStatePolicy.candidatePaneIdsPlan({
    pinnedIds: state.threadTilePinnedIds,
    defaultIds: defaultThreadTileCandidateIds(layout, { maxPanes }),
    visibleIds: Array.from(threadTileVisibleIdSet()),
    currentThreadId: state.currentThreadId,
    maxPanes,
  }, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
    selectPinnedThreadTileIds: threadTileLayoutPolicy.selectPinnedThreadTileIds,
  });
  return plan.ids;
}

function threadDisplaySettingsPayload() {
  return threadTileStatePolicy.displaySettingsPayload({
    threadTileMode: state.threadTileMode,
    threadTilePinnedIds: state.threadTilePinnedIds,
    threadTilePaneCount: state.threadTilePaneCount,
    threadTileSplitPairs: state.threadTileSplitPairs,
    threadTileSelectedThreadId: state.threadTileSelectedThreadId,
  }, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
    normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs,
  });
}

function localThreadDisplayMode() {
  try {
    return localStorage.getItem(STORAGE_THREAD_DISPLAY_MODE) === "tile"
      || localStorage.getItem(STORAGE_LEGACY_THREAD_TILE_MODE) === "true"
      ? "tile"
      : "single";
  } catch (_) {
    return "single";
  }
}

function mirrorThreadDisplayModeToLocalStorage() {
  try {
    localStorage.removeItem(STORAGE_LEGACY_THREAD_TILE_MODE);
    if (state.threadTileMode) localStorage.setItem(STORAGE_THREAD_DISPLAY_MODE, "tile");
    else localStorage.removeItem(STORAGE_THREAD_DISPLAY_MODE);
  } catch (_) {}
}

function applyThreadDisplaySettings(settings = {}, options = {}) {
  const normalized = threadTileStatePolicy.normalizeDisplaySettings(settings, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
    normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs,
  });
  state.threadTileMode = normalized.threadTileMode;
  state.threadTilePinnedIds = normalized.paneThreadIds;
  state.threadTileSplitPairs = normalized.paneSplitPairs;
  state.threadTilePaneCount = normalized.paneCount;
  state.threadTileSelectedThreadId = normalized.selectedThreadId;
  mirrorThreadDisplayModeToLocalStorage();
  syncThreadTileToggle();
  if (options.render === true) renderCurrentThread({ stickToBottom: true });
}

async function loadThreadDisplaySettings(options = {}) {
  try {
    const result = await api("/api/settings/thread-display");
    const settings = result && result.threadDisplay && typeof result.threadDisplay === "object" ? result.threadDisplay : {};
    state.threadDisplaySettingsLoaded = true;
    const plan = threadTileStatePolicy.displaySettingsLoadPlan({
      settings,
      localDisplayMode: localThreadDisplayMode(),
    });
    if (plan.action === "apply-display-settings") {
      applyThreadDisplaySettings(plan.settings || {}, { render: options.render === true });
    }
    if (plan.saveAfterApply) {
      await saveThreadDisplaySettingsNow();
    }
  } catch (err) {
    state.threadDisplaySettingsLoaded = true;
    const plan = threadTileStatePolicy.displaySettingsLoadPlan({
      loadFailed: true,
      localDisplayMode: localThreadDisplayMode(),
    });
    if (plan.action === "apply-display-settings") {
      applyThreadDisplaySettings(plan.settings || {}, { render: options.render === true });
    }
    if (plan.rethrow) throw err;
  }
}

async function saveThreadDisplaySettingsNow() {
  if (state.threadDisplaySettingsSaveTimer) {
    clearTimeout(state.threadDisplaySettingsSaveTimer);
    state.threadDisplaySettingsSaveTimer = null;
  }
  if (state.threadDisplaySettingsSaveInFlight) return null;
  state.threadDisplaySettingsSaveInFlight = true;
  try {
    const result = await api("/api/settings/thread-display", {
      method: "POST",
      body: JSON.stringify(threadDisplaySettingsPayload()),
    });
    const settings = result && result.threadDisplay && typeof result.threadDisplay === "object" ? result.threadDisplay : null;
    if (settings) applyThreadDisplaySettings(settings, { render: false });
    return result;
  } finally {
    state.threadDisplaySettingsSaveInFlight = false;
  }
}

function scheduleThreadDisplaySettingsSave() {
  if (!state.threadDisplaySettingsLoaded) return;
  if (state.threadDisplaySettingsSaveTimer) clearTimeout(state.threadDisplaySettingsSaveTimer);
  state.threadDisplaySettingsSaveTimer = setTimeout(() => {
    state.threadDisplaySettingsSaveTimer = null;
    saveThreadDisplaySettingsNow().catch(showError);
  }, THREAD_TILE_SETTINGS_SAVE_DEBOUNCE_MS);
}

function syncThreadTileActivePaneState(activeIds = []) {
  const plan = threadTileStatePolicy.activePaneSyncPlan({
    enabled: state.threadTileMode,
    activeIds,
    pinnedIds: state.threadTilePinnedIds,
    visibleIds: Array.from(threadTileVisibleIdSet()),
    splitPairs: state.threadTileSplitPairs,
    selectedThreadId: state.threadTileSelectedThreadId,
    currentThreadId: state.currentThreadId,
  }, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
    normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs,
  });
  state.threadTileActiveIds = plan.activeIds;
  if (plan.pinnedChanged) {
    state.threadTilePinnedIds = normalizeThreadTilePinnedIds(plan.paneThreadIds);
    state.threadTileSplitPairs = normalizeThreadTileSplitPairs(plan.paneSplitPairs, state.threadTilePinnedIds);
  }
  if (plan.selectedChanged) state.threadTileSelectedThreadId = plan.selectedThreadId;
  if (plan.settingsChanged) scheduleThreadDisplaySettingsSave();
  return Boolean(plan.changed);
}

function threadTileSummary(threadId) {
  return threadById(threadId) || (state.currentThread && String(state.currentThread.id || "") === String(threadId || "") ? state.currentThread : null);
}

function threadTileDisplayThread(threadId) {
  const id = String(threadId || "");
  if (state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
  return state.threadTileDetails.get(id) || threadTileSummary(id) || { id, name: id, preview: id, turns: [] };
}

function setThreadTileSelectedThread(threadId, options = {}) {
  const plan = threadTileStatePolicy.selectPanePlan({
    enabled: state.threadTileMode,
    threadId,
    activeIds: state.threadTileActiveIds,
    selectedThreadId: state.threadTileSelectedThreadId,
  });
  if (plan.action !== "select-pane") return false;
  return applyThreadTileSelectedPaneEffects(threadTileStatePolicy.selectedPaneEffectsPlan(plan, {
    render: options.render !== false,
  }));
}

function applyThreadTileSelectedPaneEffects(effect) {
  if (!effect || effect.action !== "selected-pane-effects") return false;
  if (effect.saveDraft) saveCurrentDraftNow();
  state.threadTileSelectedThreadId = effect.selectedThreadId;
  if (effect.restoreDraft) restoreDraftForCurrentTarget({ resetRuntimeWhenMissingDraft: true });
  if (effect.updateComposer) {
    renderComposerSettings();
    updateComposerControls();
  }
  if (effect.renderMode === "patch-panes") {
    let patchedAll = true;
    (Array.isArray(effect.patchThreadIds) ? effect.patchThreadIds : []).filter(Boolean).forEach((id) => {
      patchedAll = patchThreadTilePane(id, { preserveScroll: effect.patchPreserveScroll !== false }) && patchedAll;
    });
    if (!patchedAll && effect.scheduleFullRenderOnPatchMiss) scheduleRenderCurrentThread();
  }
  return true;
}

function threadTileVisibleThreadOptions(currentId = "") {
  const visible = visibleThreads(state.threads);
  const runningIds = visible
    .filter((thread) => thread && isRunningStatus(thread.status))
    .map((thread) => String(thread.id || ""))
    .filter(Boolean);
  return threadTileStatePolicy.switchMenuOptionsPlan({
    currentId,
    activeIds: state.threadTileActiveIds,
    runningIds,
    visibleIds: visible.map((thread) => String(thread && thread.id || "")).filter(Boolean),
  });
}

function renderThreadTileSwitchMenu(currentId) {
  const current = String(currentId || "");
  const options = threadTileVisibleThreadOptions(current);
  const layout = threadTileLayout({ enabled: true });
  const activeIds = threadTileCandidateIds(layout);
  const count = activeIds.length || effectiveThreadTilePaneCount(layout);
  const minCount = threadTileMinimumPaneCount(layout);
  const maxCount = threadTileMaximumPaneCount(layout);
  const plan = threadTileStatePolicy.switchMenuPlan({
    currentId: current,
    switchMenuPaneId: state.threadTileSwitchMenuPaneId,
    options,
    activeIds,
    count,
    minCount,
    maxCount,
  });
  if (plan.action !== "render-switch-menu") return "";
  return `<div class="thread-tile-switch-menu" role="listbox" aria-label="切换此窗口线程">
    <div class="thread-tile-switch-actions">
      <button class="thread-tile-switch-action" type="button" data-thread-tile-close-pane="${escapeHtml(plan.currentId)}"${plan.canClose ? "" : " disabled"}>关闭窗口</button>
      <span class="thread-tile-switch-count">${escapeHtml(String(plan.count))}/${escapeHtml(String(plan.maxCount))}</span>
      <button class="thread-tile-switch-action" type="button" data-thread-tile-pane-count="1"${plan.canAdd ? "" : " disabled"}>新增窗口</button>
    </div>
    ${plan.options.map((threadId) => {
      const thread = threadTileDisplayThread(threadId);
      const title = threadDisplayName(thread) || threadId;
      const summary = threadTileSummary(threadId) || thread;
      const pathText = shortPath((thread && thread.cwd) || (summary && summary.cwd) || "") || "聊天";
      const timeText = formatTime((thread && thread.updatedAt) || (summary && summary.updatedAt), state.nowMs);
      const status = statusIconHtml(thread && thread.status, "thread-tile-switch-status", threadId);
      const selected = threadId === plan.currentId;
      return `<button class="thread-tile-switch-option${selected ? " selected" : ""}" type="button" role="option" aria-selected="${selected ? "true" : "false"}" data-thread-tile-switch-target="${escapeHtml(threadId)}">
        <span class="thread-tile-switch-main"><span class="thread-tile-switch-title">${escapeHtml(title)}</span><span class="thread-tile-switch-meta">${escapeHtml([pathText, timeText].filter(Boolean).join(" | "))}</span></span>
        ${status}
      </button>`;
    }).join("")}
  </div>`;
}

function applyThreadTilePaneSlotEffects(effect, layout = threadTileLayout()) {
  if (!effect || effect.action !== "pane-slot-effects") return false;
  const sourcePane = effect.patchSourceThreadId ? threadTilePaneElement(effect.patchSourceThreadId) : null;
  if (effect.saveDraft) saveCurrentDraftNow();
  if (Array.isArray(effect.paneThreadIds)) state.threadTilePinnedIds = normalizeThreadTilePinnedIds(effect.paneThreadIds);
  if (Array.isArray(effect.paneSplitPairs)) {
    state.threadTileSplitPairs = normalizeThreadTileSplitPairs(effect.paneSplitPairs, state.threadTilePinnedIds);
  }
  if (effect.paneCount !== null && effect.paneCount !== undefined) state.threadTilePaneCount = effect.paneCount;
  if (effect.refreshActiveIds) state.threadTileActiveIds = threadTileCandidateIds(layout);
  if (effect.selectedThreadId) state.threadTileSelectedThreadId = effect.selectedThreadId;
  if (effect.selectionPolicy === "pane-selection") {
    state.threadTileSelectedThreadId = threadTileStatePolicy.paneSelectionPlan({
      selectedThreadId: state.threadTileSelectedThreadId,
      ids: threadTileCandidateIds(layout),
      emptyFallback: effect.selectionEmptyFallback === true,
    }).selectedThreadId;
  }
  state.threadTileSwitchMenuPaneId = effect.switchMenuPaneId || "";
  (effect.scrollResetIds || []).forEach((id) => state.threadTilePaneScrollHoldById.delete(id));
  if (effect.scheduleSettingsSave) scheduleThreadDisplaySettingsSave();
  if (effect.restoreDraft) restoreDraftForCurrentTarget({ resetRuntimeWhenMissingDraft: true });
  if (effect.updateComposer) {
    renderComposerSettings();
    updateComposerControls();
  }
  if (effect.loadThreadId) loadThreadTileDetail(effect.loadThreadId, { force: true, source: effect.loadSource || "tile-switch" }).catch(showError);
  if (effect.renderMode === "schedule-full") scheduleRenderCurrentThread();
  else if (effect.renderMode === "full") renderCurrentThread({ stickToBottom: Boolean(effect.renderStickToBottom) });
  else if (effect.renderMode === "patch-pane" && effect.patchThreadId) {
    const patched = patchThreadTilePane(effect.patchThreadId, {
      paneElement: sourcePane,
      stickToBottom: Boolean(effect.patchStickToBottom),
    });
    if (!patched && effect.scheduleFullRenderOnPatchMiss) scheduleRenderCurrentThread();
  }
  return true;
}

function replaceThreadTilePaneThread(fromThreadId, toThreadId) {
  const from = String(fromThreadId || "").trim();
  const to = String(toThreadId || "").trim();
  if (!from || !to || !state.threadTileMode) return false;
  const layout = threadTileLayout();
  const ids = threadTileCandidateIds(layout);
  const plan = threadTileStatePolicy.replacePaneThreadPlan({
    enabled: state.threadTileMode,
    fromThreadId: from,
    toThreadId: to,
    ids,
    pinnedIds: state.threadTilePinnedIds,
  }, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
  });
  if (plan.action === "skip") return false;
  return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
  }), layout);
}

function moveThreadTilePaneRelative(fromThreadId, toThreadId, placement = "after") {
  const from = String(fromThreadId || "").trim();
  const to = String(toThreadId || "").trim();
  if (!from || !to || from === to || !state.threadTileMode) return false;
  const layout = threadTileLayout();
  const ids = threadTileCandidateIds(layout);
  const plan = threadTileStatePolicy.movePaneRelativePlan({
    enabled: state.threadTileMode,
    fromThreadId: from,
    toThreadId: to,
    placement,
    ids,
    splitPairs: state.threadTileSplitPairs,
  }, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
    normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs,
  });
  if (plan.action !== "move") return false;
  return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
  }), layout);
}

function splitThreadTilePaneWithTarget(fromThreadId, toThreadId, placement = "below") {
  const from = String(fromThreadId || "").trim();
  const to = String(toThreadId || "").trim();
  if (!from || !to || from === to || !state.threadTileMode) return false;
  const layout = threadTileLayout();
  const ids = threadTileCandidateIds(layout);
  const plan = threadTileStatePolicy.splitPaneWithTargetPlan({
    enabled: state.threadTileMode,
    fromThreadId: from,
    toThreadId: to,
    placement,
    ids,
    splitPairs: state.threadTileSplitPairs,
  }, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
    normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs,
  });
  if (plan.action !== "split") return false;
  return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
  }), layout);
}

function dropThreadTilePane(fromThreadId, toThreadId, event) {
  const from = String(fromThreadId || "").trim();
  const to = String(toThreadId || "").trim();
  const pane = event && event.target && event.target.closest ? event.target.closest("[data-thread-tile-pane]") : null;
  if (!from || !to || from === to || !pane) return false;
  const rect = pane.getBoundingClientRect();
  const plan = threadTileStatePolicy.dropPaneIntent({
    fromThreadId: from,
    toThreadId: to,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    clientX: event.clientX,
    clientY: event.clientY,
  });
  if (plan.action === "move-relative") return moveThreadTilePaneRelative(from, to, plan.placement);
  if (plan.action === "split-with-target") return splitThreadTilePaneWithTarget(from, to, plan.placement);
  return false;
}

function replaceLastThreadTilePaneForThreadListOpen(threadId, options = {}) {
  const id = String(threadId || "").trim();
  const source = String(options.source || "").trim();
  if (!id || source !== "thread-list" || !state.threadTileMode) return false;
  const layout = threadTileLayout({ enabled: true });
  if (!layout || !layout.enabled) return false;
  const ids = threadTileCandidateIds(layout);
  const plan = threadTileStatePolicy.replaceLastPaneForThreadListOpenPlan({
    enabled: state.threadTileMode,
    source,
    threadId: id,
    ids,
    pinnedIds: state.threadTilePinnedIds,
  }, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
  });
  if (plan.action !== "replace-last") return false;
  return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
  }), layout);
}

function toggleThreadTileSwitchMenu(threadId) {
  const id = String(threadId || "").trim();
  if (!id || !state.threadTileMode) return false;
  setThreadTileSelectedThread(id, { render: false });
  state.threadTileSwitchMenuPaneId = state.threadTileSwitchMenuPaneId === id ? "" : id;
  if (!patchThreadTilePane(id, { preserveScroll: true })) scheduleRenderCurrentThread();
  return true;
}

function threadTileHasLiveThread() {
  if (!state.threadTileMode || !state.threadTileActiveIds.length) return false;
  return state.threadTileActiveIds.some((id) => {
    const thread = threadTileDisplayThread(id);
    return Boolean(latestLiveTurnForThread(thread) || isRunningStatus(thread && thread.status));
  });
}

function updateThreadTilePaneStatusBadges() {
  if (!state.threadTileMode) return;
  document.querySelectorAll("[data-thread-tile-pane]").forEach((pane) => {
    const id = pane.getAttribute("data-thread-tile-pane") || "";
    const container = pane.querySelector("[data-thread-tile-pane-state]");
    if (!container) return;
    const html = turnTimerStateHtml(threadTilePaneTimerState(threadTileDisplayThread(id)));
    if (container.innerHTML !== html) container.innerHTML = html;
  });
}

function threadTileError(threadId) {
  return state.threadTileErrors.get(String(threadId || "")) || "";
}

function threadTilePaneIsVisible(threadId) {
  const id = String(threadId || "");
  return Boolean(id && state.threadTileActiveIds.includes(id));
}

function setThreadTileConversationMode(active, layout = null) {
  const conversation = $("conversation");
  const main = document.querySelector(".main");
  document.documentElement.classList.toggle("thread-tile-open", Boolean(active));
  if (main) main.classList.toggle("thread-tile-main", Boolean(active));
  if (!conversation) return;
  conversation.classList.toggle("thread-tile-mode", Boolean(active));
  if (active && layout && layout.columns) conversation.style.setProperty("--thread-tile-columns", String(layout.columns));
  else {
    conversation.style.removeProperty("--thread-tile-columns");
    state.threadTileActiveIds = [];
    state.threadTileSelectedThreadId = "";
    state.threadTileSwitchMenuPaneId = "";
    state.threadTileViewportBaseline = null;
    state.threadTileComposerHeightBaselinePx = 0;
    for (const frame of state.threadTilePaneRenderFramesById.values()) {
      if (window.cancelAnimationFrame) window.cancelAnimationFrame(frame);
      else clearTimeout(frame);
    }
    state.threadTilePaneRenderFramesById.clear();
    state.threadTilePaneScrollHoldById.clear();
    clearThreadTileRefreshTimer();
    if (state.threadTileOperationRefreshTimer) {
      clearTimeout(state.threadTileOperationRefreshTimer);
      state.threadTileOperationRefreshTimer = null;
    }
  }
  updateComposerControls();
}

function captureThreadTilePaneScrollState() {
  const conversation = $("conversation");
  const states = new Map();
  if (!conversation) return states;
  conversation.querySelectorAll("[data-thread-tile-pane]").forEach((pane) => {
    const id = pane.getAttribute("data-thread-tile-pane") || "";
    const body = pane.querySelector(".thread-tile-pane-body");
    if (!id || !body) return;
    states.set(id, threadTileStatePolicy.paneScrollMetrics({
      scrollHeight: body.scrollHeight,
      clientHeight: body.clientHeight,
      scrollTop: body.scrollTop,
      hold: state.threadTilePaneScrollHoldById.get(id) === true,
    }));
  });
  return states;
}

function captureThreadTilePaneElementScrollState(pane) {
  const id = String(pane && pane.getAttribute && pane.getAttribute("data-thread-tile-pane") || "");
  const body = pane && pane.querySelector(".thread-tile-pane-body");
  if (!body) return null;
  return threadTileStatePolicy.paneScrollMetrics({
    scrollHeight: body.scrollHeight,
    clientHeight: body.clientHeight,
    scrollTop: body.scrollTop,
    hold: id ? state.threadTilePaneScrollHoldById.get(id) === true : false,
  });
}

function scrollThreadTilePaneBodyToBottom(body, options = {}) {
  if (!body) return;
  const top = Math.max(0, Number(body.scrollHeight || 0));
  if (options.smooth && typeof body.scrollTo === "function") {
    body.scrollTo({ top, behavior: "smooth" });
    setTimeout(() => updateThreadTileBottomButtonForBody(body), 220);
    return;
  }
  body.scrollTop = top;
  updateThreadTileBottomButtonForBody(body);
}

function isThreadTilePaneNearBottom(body) {
  if (!body) return true;
  return threadTileStatePolicy.paneScrollMetrics({
    scrollHeight: body.scrollHeight,
    clientHeight: body.clientHeight,
    scrollTop: body.scrollTop,
  }).nearBottom;
}

function applyThreadTilePaneScrollHoldPlan(id, plan) {
  const threadId = String(id || "");
  if (!threadId || !plan || plan.action !== "pane-scroll-hold") return;
  if (plan.clearHold) state.threadTilePaneScrollHoldById.delete(threadId);
  else if (plan.rememberHold) state.threadTilePaneScrollHoldById.set(threadId, true);
}

function rememberThreadTilePaneScrollPosition(body) {
  const pane = body && body.closest && body.closest("[data-thread-tile-pane]");
  const id = String(pane && pane.getAttribute("data-thread-tile-pane") || "");
  if (!id || !body) return;
  applyThreadTilePaneScrollHoldPlan(id, threadTileStatePolicy.paneScrollHoldPlan({
    scrollHeight: body.scrollHeight,
    clientHeight: body.clientHeight,
    scrollTop: body.scrollTop,
  }));
}

function updateThreadTileBottomButtonForBody(body) {
  const pane = body && body.closest && body.closest("[data-thread-tile-pane]");
  const button = pane && pane.querySelector("[data-thread-tile-bottom]");
  if (!button || !body) return;
  const metrics = threadTileStatePolicy.paneScrollMetrics({
    scrollHeight: body.scrollHeight,
    clientHeight: body.clientHeight,
    scrollTop: body.scrollTop,
  });
  applyThreadTilePaneScrollHoldPlan(pane.getAttribute("data-thread-tile-pane") || "", threadTileStatePolicy.paneScrollHoldPlan(metrics));
  const plan = threadTileStatePolicy.paneBottomButtonPlan({ metrics });
  const shouldShow = Boolean(plan.shouldShow);
  button.classList.toggle("hidden", !shouldShow);
  button.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  button.tabIndex = shouldShow ? 0 : -1;
}

function updateThreadTileBottomButtons() {
  const conversation = $("conversation");
  if (!conversation) return;
  conversation.querySelectorAll(".thread-tile-pane-body").forEach(updateThreadTileBottomButtonForBody);
}

function restoreThreadTilePaneScrollState(scrollState = new Map()) {
  const conversation = $("conversation");
  if (!conversation) return;
  conversation.querySelectorAll("[data-thread-tile-pane]").forEach((pane) => {
    const id = pane.getAttribute("data-thread-tile-pane") || "";
    const body = pane.querySelector(".thread-tile-pane-body");
    if (!id || !body) return;
    const previous = scrollState.get(id);
    const plan = threadTileStatePolicy.paneScrollRestorePlan({
      previous,
      scrollHeight: body.scrollHeight,
      clientHeight: body.clientHeight,
    });
    if (plan.mode === "restore-distance") {
      body.scrollTop = plan.top;
      updateThreadTileBottomButtonForBody(body);
      return;
    }
    scrollThreadTilePaneBodyToBottom(body);
  });
}

function restoreThreadTilePaneElementScrollState(pane, previous, options = {}) {
  const body = pane && pane.querySelector(".thread-tile-pane-body");
  if (!body) return;
  const id = String(pane && pane.getAttribute && pane.getAttribute("data-thread-tile-pane") || "");
  const plan = threadTileStatePolicy.paneScrollRestorePlan({
    previous,
    rememberedHold: Boolean(id && state.threadTilePaneScrollHoldById.get(id) === true),
    stickToBottom: options.stickToBottom === true,
    scrollHeight: body.scrollHeight,
    clientHeight: body.clientHeight,
  });
  if (plan.mode !== "restore-distance") {
    scrollThreadTilePaneBodyToBottom(body);
    return;
  }
  body.scrollTop = plan.top;
  updateThreadTileBottomButtonForBody(body);
}

function scrollThreadTilePaneToBottom(threadId, options = {}) {
  const id = String(threadId || "");
  if (!id) return;
  const pane = Array.from(document.querySelectorAll("[data-thread-tile-pane]"))
    .find((entry) => String(entry.getAttribute("data-thread-tile-pane") || "") === id);
  const body = pane && pane.querySelector(".thread-tile-pane-body");
  scrollThreadTilePaneBodyToBottom(body, options);
}

function clearThreadTileRefreshTimer() {
  clearTimeout(state.threadTileRefreshTimer);
  state.threadTileRefreshTimer = null;
}

function clearThreadTileDetailLoadQueueTimer() {
  clearTimeout(state.threadTileDetailLoadQueueTimer);
  state.threadTileDetailLoadQueueTimer = null;
}

function scheduleThreadTileDetailLoadQueueDrain(options = {}) {
  const plan = threadTileStatePolicy.detailLoadQueueDrainPlan({
    enabled: state.threadTileMode,
    activeIds: state.threadTileActiveIds,
    hasTimer: Boolean(state.threadTileDetailLoadQueueTimer),
    pending: options.pending === true,
    force: options.force === true,
    delayMs: options.delayMs,
  }, {
    defaultDelayMs: THREAD_TILE_DETAIL_LOAD_QUEUE_DRAIN_MS,
  });
  if (plan.clearTimer) {
    clearThreadTileDetailLoadQueueTimer();
    return false;
  }
  if (!plan.schedule) return false;
  state.threadTileDetailLoadQueueTimer = setTimeout(() => {
    state.threadTileDetailLoadQueueTimer = null;
    if (!state.threadTileMode) return;
    ensureThreadTileDetails(state.threadTileActiveIds);
  }, plan.delayMs);
  return true;
}

function scheduleThreadTileRefresh(delayMs = THREAD_TILE_REFRESH_INTERVAL_MS) {
  const plan = threadTileStatePolicy.refreshSchedulePlan({
    enabled: state.threadTileMode,
    visibilityState: document.visibilityState,
    activeIds: state.threadTileActiveIds,
    hasTimer: Boolean(state.threadTileRefreshTimer),
    delayMs,
  }, {
    defaultDelayMs: THREAD_TILE_REFRESH_INTERVAL_MS,
    minDelayMs: 500,
  });
  if (plan.clearTimer) {
    clearThreadTileRefreshTimer();
    return;
  }
  if (!plan.schedule) return;
  state.threadTileRefreshTimer = setTimeout(() => {
    state.threadTileRefreshTimer = null;
    if (!state.threadTileMode || document.visibilityState === "hidden") return;
    refreshThreadTileDetails(state.threadTileActiveIds, { source: "tile-refresh" }).catch(showError);
    scheduleThreadTileRefresh();
  }, plan.delayMs);
}

async function refreshThreadTileDetails(ids = [], options = {}) {
  const uniqueIds = threadTileStatePolicy.uniqueIds(ids);
  const visibleIds = uniqueIds.filter((id) => threadTilePaneIsVisible(id));
  const targetIds = threadTileStatePolicy.refreshTargetIds({
    enabled: state.threadTileMode,
    ids: uniqueIds,
    visibleIds,
    currentThreadId: state.currentThread && state.currentThread.id,
  });
  if (!targetIds.length) return;
  await Promise.all(targetIds.map((id) => {
    return loadThreadTileDetail(id, {
      force: true,
      background: true,
      source: options.source || "tile-refresh",
    });
  }));
}

function abortThreadTileLoads() {
  clearThreadTileRefreshTimer();
  clearThreadTileDetailLoadQueueTimer();
  state.threadTileActiveIds = [];
  for (const frame of state.threadTilePaneRenderFramesById.values()) {
    if (window.cancelAnimationFrame) window.cancelAnimationFrame(frame);
    else clearTimeout(frame);
  }
  state.threadTilePaneRenderFramesById.clear();
  state.threadTilePaneScrollHoldById.clear();
  for (const controller of state.threadTileControllers.values()) {
    try {
      controller.abort();
    } catch (_) {}
  }
  state.threadTileControllers.clear();
  state.threadTileLoadingIds.clear();
}

async function loadThreadTileDetail(threadId, options = {}) {
  const id = String(threadId || "");
  const cached = state.threadTileDetails.get(id);
  const currentThreadId = state.currentThread && String(state.currentThread.id || "");
  const plan = threadTileStatePolicy.detailLoadPlan({
    threadId: id,
    currentThreadId,
    currentThreadLoaded: Boolean(currentThreadId === id && state.currentThread && !state.currentThread.mobileLoading),
    controllerActive: state.threadTileControllers.has(id),
    loadingActive: state.threadTileLoadingIds.has(id),
    cachedReady: Boolean(cached && !cached.mobileLoading && !cached.mobileLoadError),
    force: options.force === true,
    backgroundRequested: options.background === true,
    lastLoadedAt: Number(state.threadTileLoadedAtById.get(id) || 0),
    nowMs: Date.now(),
    minIntervalMs: THREAD_TILE_REFRESH_MIN_INTERVAL_MS,
  });
  if (plan.action !== "load") return;
  const background = plan.background;
  const controller = new AbortController();
  applyThreadTileDetailLoadStartEffects(threadTileStatePolicy.detailLoadStartEffectsPlan(plan), controller);
  try {
    const result = await api(threadDetailApiPath(id, { mode: "recent" }), {
      timeoutMs: 20000,
      signal: controller.signal,
    });
    if (controller.signal.aborted) return;
    if (result && result.thread) {
      applyThreadTileDetailLoadSuccessEffects(threadTileStatePolicy.detailLoadSuccessEffectsPlan({
        id,
        hasThread: true,
        nowMs: Date.now(),
      }), result.thread);
    }
  } catch (err) {
    applyThreadTileDetailLoadErrorEffects(threadTileStatePolicy.detailLoadErrorEffectsPlan({
      id,
      aborted: controller.signal.aborted,
      background,
      errorMessage: err && err.message ? err.message : String(err),
    }));
  } finally {
    applyThreadTileDetailLoadFinallyEffects(threadTileStatePolicy.detailLoadFinallyEffectsPlan({
      id,
      controllerMatches: state.threadTileControllers.get(id) === controller,
      visible: threadTilePaneIsVisible(id),
    }));
  }
}

function applyThreadTileDetailLoadStartEffects(effect, controller) {
  if (!effect || effect.action !== "detail-load-start-effects") return false;
  const id = String(effect.id || "");
  if (!id) return false;
  if (effect.setController) state.threadTileControllers.set(id, controller);
  if (effect.markLoading) {
    state.threadTileLoadingIds.add(id);
    if (effect.renderPane && !scheduleRenderThreadTilePane(id, { preserveScroll: effect.preserveScroll !== false })) {
      scheduleRenderCurrentThread();
    }
  }
  if (effect.clearError) state.threadTileErrors.delete(id);
  return true;
}

function applyThreadTileDetailLoadSuccessEffects(effect, thread) {
  if (!effect || effect.action !== "detail-load-success-effects" || !thread) return false;
  const id = String(effect.id || "");
  if (!id) return false;
  if (effect.setDetail) {
    const existing = state.threadTileDetails.get(id);
    state.threadTileDetails.set(id, mergeThreadPreservingVisibleItems(existing, thread));
  }
  if (effect.setLoadedAt) state.threadTileLoadedAtById.set(id, Number(effect.loadedAtMs || Date.now()));
  if (effect.clearError) state.threadTileErrors.delete(id);
  if (effect.mergeThread) mergeThreadIntoThreadList(thread);
  return true;
}

function applyThreadTileDetailLoadErrorEffects(effect) {
  if (!effect || effect.action !== "detail-load-error-effects") return false;
  const id = String(effect.id || "");
  if (!id) return false;
  state.threadTileErrors.set(id, effect.errorMessage || "Thread load failed");
  return true;
}

function applyThreadTileDetailLoadFinallyEffects(effect) {
  if (!effect || effect.action !== "detail-load-finally-effects") return false;
  const id = String(effect.id || "");
  if (!id) return false;
  if (effect.clearController) state.threadTileControllers.delete(id);
  if (effect.clearLoading) state.threadTileLoadingIds.delete(id);
  if (effect.renderPane && !scheduleRenderThreadTilePane(id, { preserveScroll: effect.preserveScroll !== false })) {
    scheduleRenderCurrentThread();
  }
  if (effect.scheduleQueueDrain) scheduleThreadTileDetailLoadQueueDrain({ force: true });
  return true;
}

function applyThreadTileDetailLoadQueuePlan(plan) {
  if (!plan || plan.action !== "detail-load-queue") return false;
  for (const id of Array.isArray(plan.abortIds) ? plan.abortIds : []) {
    const controller = state.threadTileControllers.get(id);
    if (controller && typeof controller.abort === "function") {
      try {
        controller.abort();
      } catch (_) {}
    }
    state.threadTileControllers.delete(id);
    state.threadTileLoadingIds.delete(id);
  }
  for (const id of Array.isArray(plan.loadIds) ? plan.loadIds : []) {
    loadThreadTileDetail(id).catch(showError);
  }
  if (plan.scheduleDrainAfterLoad) {
    scheduleThreadTileDetailLoadQueueDrain({ pending: true });
  }
  return true;
}

function ensureThreadTileDetails(ids = []) {
  if (!state.threadTileMode) return;
  syncThreadTileActivePaneState(ids);
  const currentThreadId = state.currentThread && String(state.currentThread.id || "");
  const readyIds = state.threadTileActiveIds.filter((id) => {
    if (currentThreadId && currentThreadId === id && state.currentThread && !state.currentThread.mobileLoading) return true;
    const cached = state.threadTileDetails.get(id);
    return Boolean(cached && !cached.mobileLoading && !cached.mobileLoadError);
  });
  const concurrency = threadTileStatePolicy.detailLoadConcurrencyPlan({
    activeIds: state.threadTileActiveIds,
    maxPanes: THREAD_TILE_USER_MAX_PANES,
  });
  applyThreadTileDetailLoadQueuePlan(threadTileStatePolicy.detailLoadQueuePlan({
    enabled: state.threadTileMode,
    activeIds: state.threadTileActiveIds,
    controllerIds: Array.from(state.threadTileControllers.keys()),
    loadingIds: Array.from(state.threadTileLoadingIds),
    readyIds,
    maxConcurrentLoads: concurrency.maxConcurrentLoads,
  }));
  scheduleThreadTileRefresh();
}

function renderThreadTileTurn(thread, turn, previousKeys = new Set()) {
  return withRenderContextThread(thread, () => {
    const threadId = String(thread && thread.id || "");
    const renderedItems = visibleItemsForTurn(turn, thread).map((entry, index) => {
      const item = entry && entry.item;
      const sourceIndex = Number.isInteger(entry && entry.sourceIndex) && entry.sourceIndex >= 0 ? entry.sourceIndex : index;
      return renderVisibleItemPatchHtml(turn, item, previousKeys, sourceIndex, thread);
    }).filter(Boolean).join("");
    const budgetNoticeHtml = renderTurnVisibleItemBudgetNotice(turn, previousKeys);
    const turnApprovals = approvalsForTurn(threadId, turn && turn.id);
    const approvalsHtml = turnApprovals.length
      ? `<div class="approval-stack in-turn">${turnApprovals.map((request) => renderApprovalRequest(request, previousKeys, threadId)).join("")}</div>`
      : "";
    if (!budgetNoticeHtml.trim() && !renderedItems.trim() && !approvalsHtml.trim()) return "";
    const turnId = String(turn && (turn.id || turn.startedAt || "turn") || "turn");
    return `<article class="turn thread-tile-turn" data-thread-tile-turn="${escapeHtml(turnId)}" data-render-key="${escapeHtml(`tile-turn|${threadId}|${turnId}`)}">
      ${budgetNoticeHtml}${renderedItems}${approvalsHtml}
    </article>`;
  });
}

function scheduleThreadTileOperationMinimumRefresh(delayMs = LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS) {
  if (state.threadTileOperationRefreshTimer) clearTimeout(state.threadTileOperationRefreshTimer);
  state.threadTileOperationRefreshTimer = setTimeout(() => {
    state.threadTileOperationRefreshTimer = null;
    const plan = threadTileStatePolicy.operationMinimumRefreshPlan({
      enabled: state.threadTileMode,
      activeIds: state.threadTileActiveIds,
    });
    if (plan.action === "operation-minimum-refresh") {
      let patchedAny = false;
      for (const id of plan.patchThreadIds || []) {
        patchedAny = scheduleRenderThreadTilePane(id, { preserveScroll: true }) || patchedAny;
      }
      if (plan.fullRenderOnPatchMiss && !patchedAny) scheduleRenderCurrentThread();
    }
  }, Math.max(0, Number(delayMs) || 0) + 16);
}

function rememberThreadTileOperationBubble(threadId, html = "") {
  const id = String(threadId || "");
  const record = threadTileStatePolicy.operationBubbleRecord({
    threadId: id,
    html,
    minVisibleMs: LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS,
    nowMs: Date.now(),
  });
  if (!record) return;
  state.threadTileOperationBubblesById.set(id, record);
}

function clearThreadTileOperationBubble(threadId) {
  const id = String(threadId || "");
  if (!id) return;
  state.threadTileOperationBubblesById.delete(id);
}

function renderThreadTileOperationDock(thread, previousKeys = new Set()) {
  const id = String(thread && thread.id || "");
  if (!id) return "";
  const entry = currentLiveOperationEntry(thread);
  const mode = threadTileStatePolicy.normalizeOperationMode(state.threadTileOperationModesById.get(id) || "compact");
  const plan = threadTileStatePolicy.operationDockPlan({
    threadId: id,
    mode,
    entryType: entry && entry.item && entry.item.type,
    hasOperation: Boolean(entry && entry.item && entry.item.type !== "liveTurnStatus"),
    hasLiveTurn: Boolean(latestLiveTurnForThread(thread)),
    remembered: state.threadTileOperationBubblesById.get(id),
    nowMs: Date.now(),
  });
  if (plan.action === "render-remembered-operation") {
    if (plan.scheduleMinimumRefresh) scheduleThreadTileOperationMinimumRefresh(plan.remainingMs);
    return plan.html || "";
  }
  if (plan.action === "clear-remembered-operation") {
    if (plan.clearRemembered) state.threadTileOperationBubblesById.delete(id);
    return "";
  }
  if (plan.action !== "render-live-operation" || !entry || !entry.item) {
    return "";
  }
  const html = `<div class="thread-tile-operation-dock" data-thread-tile-operation-dock="${escapeHtml(id)}" data-mode="${escapeHtml(mode)}">
    <div class="live-operation-dock-inner">
      ${renderMobileOperationStack(entry.item, entry.turn, previousKeys, entry.sourceIndex, plan.expanded, {
        toggleAttribute: "data-thread-tile-operation-toggle",
        toggleValue: id,
      })}
    </div>
  </div>`;
  rememberThreadTileOperationBubble(id, html);
  return html;
}

function threadTileOperationSignature(threadId) {
  const id = String(threadId || "");
  const thread = threadTileDisplayThread(id);
  const entry = currentLiveOperationEntry(thread);
  return threadTileStatePolicy.operationSignature({
    mode: state.threadTileOperationModesById.get(id) || "compact",
    remembered: state.threadTileOperationBubblesById.get(id),
    nowMs: Date.now(),
    entrySignature: entry && entry.item && entry.item.type !== "liveTurnStatus"
      ? visibleItemSignature(entry.item, entry.turn, thread)
      : null,
  });
}

function applyThreadTileOperationModeTogglePlan(effect) {
  if (!effect || effect.action !== "operation-mode-toggle-effects") return false;
  const id = String(effect.id || "");
  if (!id) return false;
  state.threadTileOperationModesById.set(id, threadTileStatePolicy.normalizeOperationMode(effect.mode));
  if (effect.selectPane) setThreadTileSelectedThread(id, { render: effect.selectPaneRender !== false });
  if (effect.patchThreadId && !patchThreadTilePane(effect.patchThreadId, { preserveScroll: effect.patchPreserveScroll !== false })) {
    if (effect.scheduleFullRenderOnPatchMiss) scheduleRenderCurrentThread();
  }
  return true;
}

function threadTileMinimumPaneCount(layout = threadTileLayout()) {
  return threadTilePaneCountState(layout).minPaneCount;
}

function threadTileMaximumPaneCount(layout = threadTileLayout()) {
  return threadTilePaneCountState(layout).maxPaneCount;
}

function setThreadTilePaneCount(nextCount, options = {}) {
  if (!state.threadTileMode) return false;
  const layout = threadTileLayout({ enabled: true });
  if (!layout || !layout.enabled) return false;
  const minCount = threadTileMinimumPaneCount(layout);
  const maxCount = threadTileMaximumPaneCount(layout);
  const current = effectiveThreadTilePaneCount(layout);
  const plan = threadTileStatePolicy.paneCountChangePlan({
    enabled: state.threadTileMode,
    layoutEnabled: layout.enabled,
    nextCount,
    currentCount: current,
    storedPaneCount: state.threadTilePaneCount,
    minCount,
    maxCount,
  }, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
  });
  if (plan.action !== "set-pane-count") return false;
  return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
    render: options.render !== false,
  }), layout);
}

function changeThreadTilePaneCount(delta) {
  const layout = threadTileLayout({ enabled: true });
  if (!layout || !layout.enabled) return false;
  const current = effectiveThreadTilePaneCount(layout);
  return setThreadTilePaneCount(current + (Number(delta) || 0));
}

function closeThreadTilePane(threadId) {
  const id = String(threadId || "").trim();
  if (!id || !state.threadTileMode) return false;
  const layout = threadTileLayout({ enabled: true });
  if (!layout || !layout.enabled) return false;
  const ids = threadTileCandidateIds(layout);
  const minCount = threadTileMinimumPaneCount(layout);
  const plan = threadTileStatePolicy.closePanePlan({
    enabled: state.threadTileMode,
    layoutEnabled: layout.enabled,
    threadId: id,
    ids,
    pinnedIds: state.threadTilePinnedIds,
    defaultIds: defaultThreadTileCandidateIds(layout, { maxPanes: threadTileMaximumPaneCount(layout) }),
    minCount,
  }, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
  });
  if (plan.action !== "close-pane") return false;
  return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
  }), layout);
}

function renderThreadTilePane(threadId, layout, previousKeys = new Set()) {
  const thread = threadTileDisplayThread(threadId);
  const id = String(threadId || thread && thread.id || "");
  const title = threadTitleForDisplay(thread) || id;
  const summary = threadTileSummary(id);
  const paneStateHtml = turnTimerStateHtml(threadTilePaneTimerState(thread || summary));
  const error = threadTileError(id);
  const loading = state.threadTileLoadingIds.has(id) || (thread && thread.mobileLoading && !threadHasVisibleConversationTurns(thread));
  const readWarning = threadReadWarningMessage(thread);
  const turns = visibleTurnsForConversation(thread);
  const visibleTurnIds = new Set(turns.map((turn) => turn && turn.id).filter(Boolean).map(String));
  const omitted = Number(thread && thread.mobileOmittedTurnCount || 0) + Math.max(0, ((thread && thread.turns) || []).length - turns.length);
  const historyNote = renderThreadHistoryNote(thread, omitted, previousKeys);
  const approvalsHtml = renderPendingApprovals(thread, previousKeys, (request) => {
    const turnId = approvalTurnId(request);
    if (turnId && visibleTurnIds.has(turnId)) return false;
    return isApprovalActive(request);
  });
  const body = error
    ? `<div class="thread-tile-empty error">Thread failed: ${escapeHtml(error)}</div>`
    : loading
      ? `<div class="thread-tile-empty">Loading thread...</div>`
      : [
        historyNote,
        readWarning ? `<div class="history-note">${escapeHtml(readWarning)}</div>` : "",
        turns.map((turn) => renderThreadTileTurn(thread, turn, previousKeys)).join("") || `<div class="thread-tile-empty">No visible turns.</div>`,
        approvalsHtml,
      ].join("");
  const active = id && id === effectiveThreadTileSelectedThreadId() ? " active" : "";
  const operationDock = renderThreadTileOperationDock(thread, previousKeys);
  const switchMenu = renderThreadTileSwitchMenu(id);
  return `<section class="thread-tile-pane${active}" data-thread-tile-pane="${escapeHtml(id)}" data-render-key="${escapeHtml(`thread-tile|${id}`)}">
    <header class="thread-tile-pane-header">
      <div class="thread-tile-pane-title-wrap">
        <button class="thread-tile-pane-title-button" type="button" draggable="true" data-thread-tile-drag-handle="${escapeHtml(id)}" data-thread-tile-title="${escapeHtml(id)}" aria-haspopup="listbox" aria-expanded="${state.threadTileSwitchMenuPaneId === id ? "true" : "false"}">
          <span class="thread-tile-pane-title">${escapeHtml(title)}</span>
        </button>
        ${switchMenu}
      </div>
      <div class="thread-tile-pane-state-slot" data-thread-tile-pane-state>${paneStateHtml}</div>
    </header>
    <div class="thread-tile-pane-body"><div class="thread-tile-pane-content">${body}</div></div>
    ${operationDock}
    <button class="thread-tile-bottom-button hidden" type="button" data-thread-tile-bottom="${escapeHtml(id)}" aria-label="跳到此线程底部" title="跳到底部" aria-hidden="true" tabindex="-1">↓</button>
  </section>`;
}

function threadTilePaneElement(threadId) {
  const id = String(threadId || "");
  if (!id) return null;
  return Array.from(document.querySelectorAll("[data-thread-tile-pane]"))
    .find((entry) => String(entry.getAttribute("data-thread-tile-pane") || "") === id) || null;
}

function threadTileRenderSignature(layout, ids) {
  return threadTileStatePolicy.paneRenderSignaturePlan({
    layout,
    ids,
    desiredPaneCount: normalizeThreadTilePaneCount(state.threadTilePaneCount, 0),
    splitPairs: threadTilePrunedSplitPairs(ids),
    selectedThreadId: effectiveThreadTileSelectedThreadId(ids),
    loadingIds: ids.filter((id) => state.threadTileLoadingIds.has(id)),
    switchMenuPaneId: state.threadTileSwitchMenuPaneId || "",
    errors: ids.map((id) => [id, threadTileError(id)]),
    operations: ids.map((id) => [id, threadTileOperationSignature(id)]),
    threadSignatures: ids.map((id) => conversationRenderSignature(threadTileDisplayThread(id))),
  }, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
  }).signature;
}

function patchThreadTilePane(threadId, options = {}) {
  const id = String(threadId || "").trim();
  let preflight = threadTileStatePolicy.panePatchPreflightPlan({
    threadId: id,
    enabled: state.threadTileMode,
    visible: id ? threadTilePaneIsVisible(id) : false,
  });
  if (!preflight.shouldContinue) return false;
  const conversation = $("conversation");
  preflight = threadTileStatePolicy.panePatchPreflightPlan({
    threadId: id,
    enabled: state.threadTileMode,
    visible: true,
    conversationPresent: Boolean(conversation),
    tileSurface: Boolean(conversation && conversation.classList.contains("thread-tile-mode")),
  });
  if (!preflight.shouldContinue) return false;
  const board = conversation.querySelector("[data-thread-tile-board]");
  preflight = threadTileStatePolicy.panePatchPreflightPlan({
    threadId: id,
    enabled: state.threadTileMode,
    visible: true,
    conversationPresent: true,
    tileSurface: true,
    boardPresent: Boolean(board),
  });
  if (!preflight.shouldContinue) return false;
  const layout = threadTileLayout();
  preflight = threadTileStatePolicy.panePatchPreflightPlan({
    threadId: id,
    enabled: state.threadTileMode,
    visible: true,
    conversationPresent: true,
    tileSurface: true,
    boardPresent: true,
    layoutEnabled: Boolean(layout && layout.enabled),
  });
  if (!preflight.shouldContinue) return false;
  const ids = threadTileCandidateIds(layout);
  preflight = threadTileStatePolicy.panePatchPreflightPlan({
    threadId: id,
    enabled: state.threadTileMode,
    visible: true,
    conversationPresent: true,
    tileSurface: true,
    boardPresent: true,
    layoutEnabled: true,
    ids,
  });
  if (!preflight.shouldContinue) return false;
  const displayLayout = threadTileDisplayLayout(layout, ids);
  const pane = options.paneElement || threadTilePaneElement(id);
  preflight = threadTileStatePolicy.panePatchPreflightPlan({
    threadId: id,
    enabled: state.threadTileMode,
    visible: true,
    conversationPresent: true,
    tileSurface: true,
    boardPresent: true,
    layoutEnabled: true,
    ids,
    panePresent: Boolean(pane),
  });
  if (!preflight.canPatch) return false;
  const previousScroll = captureThreadTilePaneElementScrollState(pane);
  const previousKeys = existingConversationRenderKeys();
  const template = document.createElement("template");
  template.innerHTML = renderThreadTilePane(id, displayLayout, previousKeys);
  const sourcePane = template.content.firstElementChild;
  let completion = threadTileStatePolicy.panePatchCompletionPlan({
    threadId: id,
    sourcePanePresent: Boolean(sourcePane),
  });
  if (!completion.returnValue) return false;
  const patchedPane = patchNode(pane, sourcePane);
  completion = threadTileStatePolicy.panePatchCompletionPlan({
    threadId: id,
    sourcePanePresent: true,
    patchedPanePresent: Boolean(patchedPane),
    requestAnimationFrameAvailable: typeof window.requestAnimationFrame === "function",
  });
  if (!completion.returnValue) return false;
  if (completion.hydrate) hydrateThreadDetailSurface(patchedPane, { imageScanDelays: [0, 180] });
  if (completion.restoreScroll) restoreThreadTilePaneElementScrollState(patchedPane, previousScroll, options);
  if (completion.updateBottomButton) {
    const updateBottomButton = () => updateThreadTileBottomButtonForBody(patchedPane.querySelector(".thread-tile-pane-body"));
    if (completion.updateBottomButtonMode === "animation-frame" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(updateBottomButton);
    } else {
      updateBottomButton();
    }
  }
  if (completion.writeRenderSignature) {
    state.renderedConversationSignature = threadTileRenderSignature(displayLayout, ids);
  }
  if (completion.clearPatchShellSignature) {
    state.renderedConversationPatchShellSignature = "";
  }
  if (completion.bindActions) {
    bindThreadTileActions();
  } else {
    return false;
  }
  return completion.returnValue;
}

function isThreadTileConversationSurface() {
  const conversation = $("conversation");
  return Boolean(state.threadTileMode
    && conversation
    && conversation.classList
    && conversation.classList.contains("thread-tile-mode"));
}

function threadDetailDomPatchSurface(options = {}) {
  const id = String(options.threadId || state.currentThreadId || state.currentThread && state.currentThread.id || "").trim();
  return threadDetailPatchPlanApi.planThreadDetailDomPatchSurface({
    threadId: id,
    threadTileMode: state.threadTileMode,
    threadTileSurface: isThreadTileConversationSurface(),
    tilePaneVisible: id ? threadTilePaneIsVisible(id) : false,
    conversationPresent: Boolean($("conversation")),
  });
}

function canPatchSingleThreadConversationDom(options = {}) {
  const plan = threadDetailDomPatchSurface(options);
  return Boolean(plan && plan.canPatch && plan.surface === "single-thread");
}

function patchCurrentThreadTilePaneFromState(options = {}) {
  const plan = threadDetailDomPatchSurface(options);
  if (!plan || !plan.canPatch || plan.surface !== "thread-tile-pane") return false;
  clearGlobalLiveOperationDockForThreadTiles();
  return patchThreadTilePane(plan.threadId, Object.assign({ preserveScroll: true }, options));
}

function scheduleRenderThreadTilePane(threadId, options = {}) {
  const id = String(threadId || "").trim();
  const plan = threadTileStatePolicy.paneRenderFramePlan({
    threadId: id,
    enabled: state.threadTileMode,
    visible: id ? threadTilePaneIsVisible(id) : false,
    hasFrame: id ? state.threadTilePaneRenderFramesById.has(id) : false,
  });
  if (plan.action === "skip" || !plan.returnValue) return false;
  if (!plan.scheduleFrame) return true;
  const render = () => {
    state.threadTilePaneRenderFramesById.delete(id);
    if (!patchThreadTilePane(id, options) && plan.fullRenderOnPatchMiss) scheduleRenderCurrentThread();
  };
  const frame = window.requestAnimationFrame
    ? window.requestAnimationFrame(render)
    : setTimeout(render, 33);
  state.threadTilePaneRenderFramesById.set(id, frame);
  return true;
}

function renderThreadTileLayout(layout, options = {}) {
  const ids = threadTileCandidateIds(layout);
  if (!ids.length) return false;
  const displayLayout = threadTileDisplayLayout(layout, ids);
  const scrollState = captureThreadTilePaneScrollState();
  ensureThreadTileDetails(ids);
  updateThreadTileGlobalHeader(displayLayout, ids);
  state.nowMs = Date.now();
  const previousKeys = existingConversationRenderKeys();
  const columnGroups = Array.isArray(displayLayout.columnGroups) && displayLayout.columnGroups.length
    ? displayLayout.columnGroups
    : ids.map((id) => [id]);
  const html = `<div class="thread-tile-board" data-thread-tile-board data-render-key="thread-tile-board">
    ${columnGroups.map((group, index) => `<div class="thread-tile-column" data-thread-tile-column="${escapeHtml(String(index))}" style="--thread-tile-column-rows: ${escapeHtml(String(Math.max(1, group.length)))}">
      ${group.map((id) => renderThreadTilePane(id, displayLayout, previousKeys)).join("")}
    </div>`).join("")}
  </div>`;
  const signature = threadTileRenderSignature(displayLayout, ids);
  const visibleShape = threadTileVisibleShape(ids);
  const expectedVisibleTurnCount = visibleShape.turnCount;
  const renderedDomTurnCount = threadTileDomTurnCount();
  const renderedDomShape = conversationDomShape();
  setThreadTileConversationMode(true, displayLayout);
  updateConversationHtml(html, signature, {
    stickToBottom: options.stickToBottom === true,
    patchShellSignature: "",
    expectedVisibleTurnCount,
    renderedDomTurnCount,
    expectedVisibleItemCount: visibleShape.visibleItemCount,
    renderedDomItemCount: renderedDomShape.itemCount,
    duplicateRenderKeyCount: renderedDomShape.duplicateRenderKeyCount,
    duplicateUserMessageCount: renderedDomShape.duplicateUserMessageCount,
    expectedDuplicateUserMessageCount: visibleShape.duplicateUserMessageCount,
    action: "thread-tile-empty-state",
    routeKind: "thread-tile",
    threadHash: diagnosticHash(`thread-tile:${ids.join("|")}`),
    currentTurns: expectedVisibleTurnCount,
    currentVisibleItems: visibleShape.visibleItemCount,
    source: "thread-tile-render",
    checkProjectionConsistency: true,
  });
  bindThreadTileActions();
  restoreThreadTilePaneScrollState(scrollState);
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => {
      restoreThreadTilePaneScrollState(scrollState);
      updateThreadTileBottomButtons();
    });
  }
  return true;
}

function bindThreadTileActions() {
  const conversation = $("conversation");
  if (!conversation) return;
  if (conversation.dataset.threadTileActionsBound === "true") return;
  conversation.dataset.threadTileActionsBound = "true";
  conversation.addEventListener("pointerdown", (event) => {
    const plan = threadTileActionsApi.resolveThreadTilePointerAction({
      target: event.target,
      root: conversation,
    });
    if (plan.action === "select-pane") {
      setThreadTileSelectedThread(plan.paneId || "");
      return;
    }
    if (plan.stopPropagation) {
      event.stopPropagation();
      return;
    }
  });
  conversation.addEventListener("focusin", (event) => {
    const plan = threadTileActionsApi.resolveThreadTileFocusAction({
      target: event.target,
      root: conversation,
    });
    if (plan.action === "select-pane") setThreadTileSelectedThread(plan.paneId || "");
  });
  conversation.addEventListener("click", (event) => {
    const plan = threadTileActionsApi.resolveThreadTileClickAction({
      target: event.target,
      root: conversation,
    });
    if (plan.preventDefault) event.preventDefault();
    if (plan.stopPropagation) event.stopPropagation();
    if (plan.action === "toggle-switch-menu") {
      toggleThreadTileSwitchMenu(plan.paneId || "");
      return;
    }
    if (plan.action === "switch-pane-thread") {
      replaceThreadTilePaneThread(plan.fromId || "", plan.toId || "");
      return;
    }
    if (plan.action === "change-pane-count") {
      if (!plan.disabled) changeThreadTilePaneCount(Number(plan.delta || 0));
      return;
    }
    if (plan.action === "close-pane") {
      if (!plan.disabled) closeThreadTilePane(plan.paneId || "");
      return;
    }
    if (plan.action === "scroll-pane-bottom") {
      scrollThreadTilePaneToBottom(plan.paneId || "", { smooth: true });
      return;
    }
    if (plan.action === "toggle-operation") {
      const id = plan.paneId || "";
      applyThreadTileOperationModeTogglePlan(threadTileStatePolicy.operationModeTogglePlan({
        enabled: state.threadTileMode,
        threadId: id,
        mode: state.threadTileOperationModesById.get(id) || "compact",
      }));
    }
  });
  conversation.addEventListener("scroll", (event) => {
    const plan = threadTileActionsApi.resolveThreadTileScrollAction({
      target: event.target,
      root: conversation,
    });
    if (plan.action === "pane-scroll") updateThreadTileBottomButtonForBody(plan.body);
  }, { passive: true, capture: true });
  conversation.addEventListener("dragstart", (event) => {
    const plan = threadTileActionsApi.resolveThreadTileDragStartAction({
      target: event.target,
      root: conversation,
    });
    if (plan.action !== "drag-start") return;
    const id = plan.paneId || "";
    if (!id) return;
    state.threadTileDraggingThreadId = id;
    state.threadTileSwitchMenuPaneId = "";
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
    }
    const pane = plan.pane;
    if (pane) pane.classList.add("dragging");
  });
  conversation.addEventListener("dragover", (event) => {
    const plan = threadTileActionsApi.resolveThreadTileDragOverAction({
      target: event.target,
      root: conversation,
      draggingId: state.threadTileDraggingThreadId || "",
    });
    if (plan.action !== "drag-over") return;
    if (plan.preventDefault) event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    plan.pane.classList.add("drag-over");
  });
  conversation.addEventListener("dragleave", (event) => {
    const plan = threadTileActionsApi.resolveThreadTileDragLeaveAction({
      target: event.target,
      root: conversation,
    });
    if (plan.action === "drag-leave") plan.pane.classList.remove("drag-over");
  });
  conversation.addEventListener("drop", (event) => {
    const plan = threadTileActionsApi.resolveThreadTileDropAction({
      target: event.target,
      root: conversation,
      draggingId: state.threadTileDraggingThreadId || "",
      transferId: event.dataTransfer && event.dataTransfer.getData("text/plain") || "",
    });
    if (plan.action !== "drop-pane") return;
    if (plan.preventDefault) event.preventDefault();
    if (plan.stopPropagation) event.stopPropagation();
    document.querySelectorAll(".thread-tile-pane.drag-over, .thread-tile-pane.dragging").forEach((entry) => entry.classList.remove("drag-over", "dragging"));
    state.threadTileDraggingThreadId = "";
    dropThreadTilePane(plan.draggingId, plan.targetId, event);
  });
  conversation.addEventListener("dragend", () => {
    state.threadTileDraggingThreadId = "";
    document.querySelectorAll(".thread-tile-pane.drag-over, .thread-tile-pane.dragging").forEach((entry) => entry.classList.remove("drag-over", "dragging"));
  });
}

function threadTileLayoutStatusText(layout) {
  if (!state.threadTileMode) return "当前视口：单线程";
  if (layout && layout.enabled) {
    const count = effectiveThreadTilePaneCount(layout);
    const maxCount = threadTileMaximumPaneCount(layout);
    return maxCount > 1 ? `当前视口：平铺 ${count}/${maxCount} 窗` : "当前视口：平铺可用";
  }
  const reason = String(layout && layout.reason || "");
  if (reason === "tablet-portrait") return "当前视口：竖屏单线程";
  if (reason === "insufficient-width" || reason === "narrow") return "当前视口：宽度不足";
  if (reason === "disabled") return "当前视口：单线程";
  return "当前视口：暂不可平铺";
}

function syncThreadTileToggle() {
  const layout = threadTileLayout({ enabled: true });
  document.querySelectorAll("[data-thread-display-choice]").forEach((button) => {
    const choice = button.getAttribute("data-thread-display-choice") || "single";
    const isTile = choice === "tile";
    const isSelected = isTile ? state.threadTileMode : !state.threadTileMode;
    button.classList.toggle("selected", isSelected);
    button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    if (isTile && !layout.enabled && !state.threadTileMode) button.setAttribute("title", "平铺会在 iPad 横屏或宽屏可用时生效");
    else button.removeAttribute("title");
  });
  const status = $("threadDisplaySettingsStatus");
  if (status) status.textContent = threadTileLayoutStatusText(layout);
}

function setThreadTileMode(enabled) {
  state.threadTileMode = enabled === true;
  mirrorThreadDisplayModeToLocalStorage();
  if (!state.threadTileMode) {
    abortThreadTileLoads();
    state.threadTileSelectedThreadId = "";
    setThreadTileConversationMode(false);
  }
  scheduleThreadDisplaySettingsSave();
  syncThreadTileToggle();
  renderCurrentThread({ stickToBottom: true });
}

function handleThreadTileModeChoice(event) {
  const button = event.target.closest("[data-thread-display-choice]");
  if (!button) return;
  event.preventDefault();
  setThreadTileMode(button.getAttribute("data-thread-display-choice") === "tile");
}

  return {
    updateThreadTileGlobalHeader,
    viewportPixelSize,
    isCoarsePointerViewport,
    isThreadTileKeyboardFocusActive,
    threadTileViewportSize,
    threadTileVerticalChromePx,
    threadTileLayout,
    normalizeThreadTilePaneCount,
    threadTileLayoutCapacity,
    defaultThreadTileCandidateIds,
    threadTileRunningPaneIds,
    threadTilePaneCountState,
    autoThreadTilePaneCount,
    effectiveThreadTilePaneCount,
    threadTileDisplayLayout,
    normalizeThreadTilePinnedIds,
    normalizeThreadTileSplitPairs,
    threadTilePrunedSplitPairs,
    threadTileVisibleIdSet,
    threadTileIdsEqual,
    threadTileCandidateIds,
    threadDisplaySettingsPayload,
    localThreadDisplayMode,
    mirrorThreadDisplayModeToLocalStorage,
    applyThreadDisplaySettings,
    loadThreadDisplaySettings,
    saveThreadDisplaySettingsNow,
    scheduleThreadDisplaySettingsSave,
    syncThreadTileActivePaneState,
    threadTileSummary,
    threadTileDisplayThread,
    setThreadTileSelectedThread,
    applyThreadTileSelectedPaneEffects,
    threadTileVisibleThreadOptions,
    renderThreadTileSwitchMenu,
    applyThreadTilePaneSlotEffects,
    replaceThreadTilePaneThread,
    moveThreadTilePaneRelative,
    splitThreadTilePaneWithTarget,
    dropThreadTilePane,
    replaceLastThreadTilePaneForThreadListOpen,
    toggleThreadTileSwitchMenu,
    threadTileHasLiveThread,
    updateThreadTilePaneStatusBadges,
    threadTileError,
    threadTilePaneIsVisible,
    setThreadTileConversationMode,
    captureThreadTilePaneScrollState,
    captureThreadTilePaneElementScrollState,
    scrollThreadTilePaneBodyToBottom,
    isThreadTilePaneNearBottom,
    applyThreadTilePaneScrollHoldPlan,
    rememberThreadTilePaneScrollPosition,
    updateThreadTileBottomButtonForBody,
    updateThreadTileBottomButtons,
    restoreThreadTilePaneScrollState,
    restoreThreadTilePaneElementScrollState,
    scrollThreadTilePaneToBottom,
    clearThreadTileRefreshTimer,
    clearThreadTileDetailLoadQueueTimer,
    scheduleThreadTileDetailLoadQueueDrain,
    scheduleThreadTileRefresh,
    refreshThreadTileDetails,
    abortThreadTileLoads,
    loadThreadTileDetail,
    applyThreadTileDetailLoadStartEffects,
    applyThreadTileDetailLoadSuccessEffects,
    applyThreadTileDetailLoadErrorEffects,
    applyThreadTileDetailLoadFinallyEffects,
    applyThreadTileDetailLoadQueuePlan,
    ensureThreadTileDetails,
    renderThreadTileTurn,
    scheduleThreadTileOperationMinimumRefresh,
    rememberThreadTileOperationBubble,
    clearThreadTileOperationBubble,
    renderThreadTileOperationDock,
    threadTileOperationSignature,
    applyThreadTileOperationModeTogglePlan,
    threadTileMinimumPaneCount,
    threadTileMaximumPaneCount,
    setThreadTilePaneCount,
    changeThreadTilePaneCount,
    closeThreadTilePane,
    renderThreadTilePane,
    threadTilePaneElement,
    threadTileRenderSignature,
    patchThreadTilePane,
    isThreadTileConversationSurface,
    threadDetailDomPatchSurface,
    canPatchSingleThreadConversationDom,
    patchCurrentThreadTilePaneFromState,
    scheduleRenderThreadTilePane,
    renderThreadTileLayout,
    bindThreadTileActions,
    threadTileLayoutStatusText,
    syncThreadTileToggle,
    setThreadTileMode,
    handleThreadTileModeChoice,
  };
}

const api = { createThreadTileRuntime };

if (typeof module === "object" && module.exports) {
  module.exports = api;
}

root.CodexThreadTileRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
