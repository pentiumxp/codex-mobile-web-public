import { n as __toESM, t as __commonJSMin } from "./rolldown-runtime-FDOR9p9I.js";
//#region public/thread-tile-runtime.js
var require_thread_tile_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function attachThreadTileRuntime(root) {
		function createThreadTileRuntime(deps = {}) {
			const { state, $, api, document, window, localStorage, setTimeout, clearTimeout, AbortController, THREAD_TILE_USER_MAX_PANES, THREAD_TILE_DETAIL_LOAD_QUEUE_DRAIN_MS, THREAD_TILE_REFRESH_INTERVAL_MS, THREAD_TILE_REFRESH_MIN_INTERVAL_MS, THREAD_TILE_SETTINGS_SAVE_DEBOUNCE_MS, STORAGE_THREAD_DISPLAY_MODE, STORAGE_LEGACY_THREAD_TILE_MODE, LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS, threadTileActionsApi, threadTileStatePolicy, threadTileLayoutPolicy, threadDetailPatchPlanApi, isKeyboardEditableElement, splitPaneSidebarVisible, isMenuOverlayMode, visibleThreads, isRunningStatus, saveCurrentDraftNow, restoreDraftForCurrentTarget, renderComposerSettings, updateComposerControls, scheduleRenderCurrentThread, renderCurrentThread, showError, threadById, threadDisplayName, shortPath, formatTime, statusIconHtml, threadDetailApiPath, mergeThreadPreservingVisibleItems, mergeThreadIntoThreadList, withRenderContextThread, visibleItemsForTurn, renderVisibleItemPatchHtml, renderTurnVisibleItemBudgetNotice, approvalsForTurn, renderApprovalRequest, approvalTurnId, isApprovalActive, currentLiveOperationEntry, latestLiveTurnForThread, renderMobileOperationStack, visibleItemSignature, threadTitleForDisplay, turnTimerStateHtml, threadTilePaneTimerState, threadHasVisibleConversationTurns, threadReadWarningMessage, visibleTurnsForConversation, renderThreadHistoryNote, renderPendingApprovals, effectiveThreadTileSelectedThreadId, conversationRenderSignature, existingConversationRenderKeys, patchNode, hydrateThreadDetailSurface, clearGlobalLiveOperationDockForThreadTiles, updateConversationHtml, threadTileVisibleShape, threadTileDomTurnCount, conversationDomShape, diagnosticHash, publishPluginNavigationState, escapeHtml } = Object.assign({
				document: root.document || {},
				window: root.window || root,
				localStorage: root.localStorage || {
					getItem: () => null,
					setItem: () => {},
					removeItem: () => {}
				},
				setTimeout: typeof root.setTimeout === "function" ? root.setTimeout.bind(root) : () => 0,
				clearTimeout: typeof root.clearTimeout === "function" ? root.clearTimeout.bind(root) : () => {},
				AbortController: root.AbortController
			}, deps);
			function updateThreadTileGlobalHeader(layout = null, ids = []) {
				const titleEl = $("threadTitle");
				const metaEl = $("threadMeta");
				if (titleEl) titleEl.textContent = "";
				if (metaEl) metaEl.textContent = "";
			}
			function viewportPixelSize(options = {}) {
				const visualViewport = window.visualViewport;
				const visualWidth = Math.round(visualViewport && visualViewport.width || 0);
				const visualHeight = Math.round(visualViewport && visualViewport.height || 0);
				const layoutWidth = Math.round(window.innerWidth || document.documentElement.clientWidth || 0);
				const layoutHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
				if (options.preferLayoutViewport) return {
					width: Math.max(layoutWidth, visualWidth),
					height: Math.max(layoutHeight, visualHeight)
				};
				return {
					width: Math.round(visualWidth || layoutWidth || 0),
					height: Math.round(visualHeight || layoutHeight || 0)
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
					baseline: state.threadTileViewportBaseline
				});
				if (plan.updateBaseline) state.threadTileViewportBaseline = plan.nextBaseline;
				return plan.viewport;
			}
			function threadTileVerticalChromePx() {
				const plan = threadTileStatePolicy.threadTileVerticalChromePlan({
					keyboardActive: isThreadTileKeyboardFocusActive(),
					composerHeightPx: state.composerHeightPx,
					baselineComposerHeightPx: state.threadTileComposerHeightBaselinePx
				});
				if (plan.updateBaseline) state.threadTileComposerHeightBaselinePx = plan.nextComposerHeightBaselinePx;
				return plan.verticalChromePx;
			}
			function threadTileLayout(options = {}) {
				const viewport = threadTileViewportSize();
				const sidebar = $("sidebar");
				const sidebarSplitVisible = splitPaneSidebarVisible();
				const menuOverlay = isMenuOverlayMode() || !sidebarSplitVisible;
				const sidebarWidth = sidebar && sidebarSplitVisible ? Math.round(sidebar.getBoundingClientRect().width || 0) : 0;
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
					verticalChromePx: threadTileVerticalChromePx()
				});
			}
			function normalizeThreadTilePaneCount(value, fallback = 0) {
				return threadTileStatePolicy.normalizePaneCount(value, {
					fallback,
					maxPanes: THREAD_TILE_USER_MAX_PANES
				});
			}
			function threadTileLayoutCapacity(layout = threadTileLayout()) {
				return threadTileStatePolicy.layoutCapacity(layout, {
					capacityMaxPanes: threadTileLayoutPolicy.DEFAULT_MAX_PANES,
					maxPanes: THREAD_TILE_USER_MAX_PANES
				});
			}
			function defaultThreadTileCandidateIds(layout = threadTileLayout(), options = {}) {
				const maxPanes = Math.max(1, Math.min(THREAD_TILE_USER_MAX_PANES, Math.floor(Number(options.maxPanes || layout && layout.maxPanes || 1)) || 1));
				const threadIds = visibleThreads(state.threads).map((thread) => thread && thread.id).filter(Boolean);
				return threadTileLayoutPolicy.selectThreadTileIds({
					currentThreadId: state.currentThreadId,
					threadIds,
					maxPanes
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
					explicitPaneCount: state.threadTilePaneCount
				}, { maxPanes: THREAD_TILE_USER_MAX_PANES });
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
					splitPairs: threadTilePrunedSplitPairs(ids)
				}, {
					capacityMaxPanes: threadTileLayoutPolicy.DEFAULT_MAX_PANES,
					maxPanes: THREAD_TILE_USER_MAX_PANES,
					threadTileColumnGroups: threadTileLayoutPolicy.threadTileColumnGroups
				}).displayLayout;
			}
			function normalizeThreadTilePinnedIds(values = []) {
				return threadTileStatePolicy.normalizePinnedIds(values, { maxPanes: THREAD_TILE_USER_MAX_PANES });
			}
			function normalizeThreadTileSplitPairs(values = [], ids = []) {
				return threadTileStatePolicy.normalizeSplitPairs(values, ids, {
					maxPanes: THREAD_TILE_USER_MAX_PANES,
					normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs
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
				return threadTileStatePolicy.candidatePaneIdsPlan({
					pinnedIds: state.threadTilePinnedIds,
					defaultIds: defaultThreadTileCandidateIds(layout, { maxPanes }),
					visibleIds: Array.from(threadTileVisibleIdSet()),
					currentThreadId: state.currentThreadId,
					maxPanes
				}, {
					maxPanes: THREAD_TILE_USER_MAX_PANES,
					selectPinnedThreadTileIds: threadTileLayoutPolicy.selectPinnedThreadTileIds
				}).ids;
			}
			function threadDisplaySettingsPayload() {
				return threadTileStatePolicy.displaySettingsPayload({
					threadTileMode: state.threadTileMode,
					threadTilePinnedIds: state.threadTilePinnedIds,
					threadTilePaneCount: state.threadTilePaneCount,
					threadTileSplitPairs: state.threadTileSplitPairs,
					threadTileSelectedThreadId: state.threadTileSelectedThreadId
				}, {
					maxPanes: THREAD_TILE_USER_MAX_PANES,
					normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs
				});
			}
			function localThreadDisplayMode() {
				try {
					return localStorage.getItem(STORAGE_THREAD_DISPLAY_MODE) === "tile" || localStorage.getItem(STORAGE_LEGACY_THREAD_TILE_MODE) === "true" ? "tile" : "single";
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
					normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs
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
						localDisplayMode: localThreadDisplayMode()
					});
					if (plan.action === "apply-display-settings") applyThreadDisplaySettings(plan.settings || {}, { render: options.render === true });
					if (plan.saveAfterApply) await saveThreadDisplaySettingsNow();
				} catch (err) {
					state.threadDisplaySettingsLoaded = true;
					const plan = threadTileStatePolicy.displaySettingsLoadPlan({
						loadFailed: true,
						localDisplayMode: localThreadDisplayMode()
					});
					if (plan.action === "apply-display-settings") applyThreadDisplaySettings(plan.settings || {}, { render: options.render === true });
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
						body: JSON.stringify(threadDisplaySettingsPayload())
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
					currentThreadId: state.currentThreadId
				}, {
					maxPanes: THREAD_TILE_USER_MAX_PANES,
					normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs
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
				return state.threadTileDetails.get(id) || threadTileSummary(id) || {
					id,
					name: id,
					preview: id,
					turns: []
				};
			}
			function setThreadTileSelectedThread(threadId, options = {}) {
				const plan = threadTileStatePolicy.selectPanePlan({
					enabled: state.threadTileMode,
					threadId,
					activeIds: state.threadTileActiveIds,
					selectedThreadId: state.threadTileSelectedThreadId
				});
				if (plan.action !== "select-pane") return false;
				return applyThreadTileSelectedPaneEffects(threadTileStatePolicy.selectedPaneEffectsPlan(plan, { render: options.render !== false }));
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
				const runningIds = visible.filter((thread) => thread && isRunningStatus(thread.status)).map((thread) => String(thread.id || "")).filter(Boolean);
				return threadTileStatePolicy.switchMenuOptionsPlan({
					currentId,
					activeIds: state.threadTileActiveIds,
					runningIds,
					visibleIds: visible.map((thread) => String(thread && thread.id || "")).filter(Boolean)
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
					maxCount
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
					const pathText = shortPath(thread && thread.cwd || summary && summary.cwd || "") || "聊天";
					const timeText = formatTime(thread && thread.updatedAt || summary && summary.updatedAt, state.nowMs);
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
				if (Array.isArray(effect.paneSplitPairs)) state.threadTileSplitPairs = normalizeThreadTileSplitPairs(effect.paneSplitPairs, state.threadTilePinnedIds);
				if (effect.paneCount !== null && effect.paneCount !== void 0) state.threadTilePaneCount = effect.paneCount;
				if (effect.refreshActiveIds) state.threadTileActiveIds = threadTileCandidateIds(layout);
				if (effect.selectedThreadId) state.threadTileSelectedThreadId = effect.selectedThreadId;
				if (effect.selectionPolicy === "pane-selection") state.threadTileSelectedThreadId = threadTileStatePolicy.paneSelectionPlan({
					selectedThreadId: state.threadTileSelectedThreadId,
					ids: threadTileCandidateIds(layout),
					emptyFallback: effect.selectionEmptyFallback === true
				}).selectedThreadId;
				state.threadTileSwitchMenuPaneId = effect.switchMenuPaneId || "";
				(effect.scrollResetIds || []).forEach((id) => state.threadTilePaneScrollHoldById.delete(id));
				if (effect.scheduleSettingsSave) scheduleThreadDisplaySettingsSave();
				if (effect.restoreDraft) restoreDraftForCurrentTarget({ resetRuntimeWhenMissingDraft: true });
				if (effect.updateComposer) {
					renderComposerSettings();
					updateComposerControls();
				}
				if (effect.loadThreadId) loadThreadTileDetail(effect.loadThreadId, {
					force: true,
					source: effect.loadSource || "tile-switch"
				}).catch(showError);
				if (effect.renderMode === "schedule-full") scheduleRenderCurrentThread();
				else if (effect.renderMode === "full") renderCurrentThread({ stickToBottom: Boolean(effect.renderStickToBottom) });
				else if (effect.renderMode === "patch-pane" && effect.patchThreadId) {
					if (!patchThreadTilePane(effect.patchThreadId, {
						paneElement: sourcePane,
						stickToBottom: Boolean(effect.patchStickToBottom)
					}) && effect.scheduleFullRenderOnPatchMiss) scheduleRenderCurrentThread();
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
					pinnedIds: state.threadTilePinnedIds
				}, { maxPanes: THREAD_TILE_USER_MAX_PANES });
				if (plan.action === "skip") return false;
				return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, { maxPanes: THREAD_TILE_USER_MAX_PANES }), layout);
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
					splitPairs: state.threadTileSplitPairs
				}, {
					maxPanes: THREAD_TILE_USER_MAX_PANES,
					normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs
				});
				if (plan.action !== "move") return false;
				return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, { maxPanes: THREAD_TILE_USER_MAX_PANES }), layout);
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
					splitPairs: state.threadTileSplitPairs
				}, {
					maxPanes: THREAD_TILE_USER_MAX_PANES,
					normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs
				});
				if (plan.action !== "split") return false;
				return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, { maxPanes: THREAD_TILE_USER_MAX_PANES }), layout);
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
					clientY: event.clientY
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
					pinnedIds: state.threadTilePinnedIds
				}, { maxPanes: THREAD_TILE_USER_MAX_PANES });
				if (plan.action !== "replace-last") return false;
				return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, { maxPanes: THREAD_TILE_USER_MAX_PANES }), layout);
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
					for (const frame of state.threadTilePaneRenderFramesById.values()) if (window.cancelAnimationFrame) window.cancelAnimationFrame(frame);
					else clearTimeout(frame);
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
				const states = /* @__PURE__ */ new Map();
				if (!conversation) return states;
				conversation.querySelectorAll("[data-thread-tile-pane]").forEach((pane) => {
					const id = pane.getAttribute("data-thread-tile-pane") || "";
					const body = pane.querySelector(".thread-tile-pane-body");
					if (!id || !body) return;
					states.set(id, threadTileStatePolicy.paneScrollMetrics({
						scrollHeight: body.scrollHeight,
						clientHeight: body.clientHeight,
						scrollTop: body.scrollTop,
						hold: state.threadTilePaneScrollHoldById.get(id) === true
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
					hold: id ? state.threadTilePaneScrollHoldById.get(id) === true : false
				});
			}
			function scrollThreadTilePaneBodyToBottom(body, options = {}) {
				if (!body) return;
				const top = Math.max(0, Number(body.scrollHeight || 0));
				if (options.smooth && typeof body.scrollTo === "function") {
					body.scrollTo({
						top,
						behavior: "smooth"
					});
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
					scrollTop: body.scrollTop
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
					scrollTop: body.scrollTop
				}));
			}
			function updateThreadTileBottomButtonForBody(body) {
				const pane = body && body.closest && body.closest("[data-thread-tile-pane]");
				const button = pane && pane.querySelector("[data-thread-tile-bottom]");
				if (!button || !body) return;
				const metrics = threadTileStatePolicy.paneScrollMetrics({
					scrollHeight: body.scrollHeight,
					clientHeight: body.clientHeight,
					scrollTop: body.scrollTop
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
			function restoreThreadTilePaneScrollState(scrollState = /* @__PURE__ */ new Map()) {
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
						clientHeight: body.clientHeight
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
					clientHeight: body.clientHeight
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
				const pane = Array.from(document.querySelectorAll("[data-thread-tile-pane]")).find((entry) => String(entry.getAttribute("data-thread-tile-pane") || "") === id);
				scrollThreadTilePaneBodyToBottom(pane && pane.querySelector(".thread-tile-pane-body"), options);
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
					delayMs: options.delayMs
				}, { defaultDelayMs: THREAD_TILE_DETAIL_LOAD_QUEUE_DRAIN_MS });
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
					delayMs
				}, {
					defaultDelayMs: THREAD_TILE_REFRESH_INTERVAL_MS,
					minDelayMs: 500
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
					currentThreadId: state.currentThread && state.currentThread.id
				});
				if (!targetIds.length) return;
				await Promise.all(targetIds.map((id) => {
					return loadThreadTileDetail(id, {
						force: true,
						background: true,
						source: options.source || "tile-refresh"
					});
				}));
			}
			function abortThreadTileLoads() {
				clearThreadTileRefreshTimer();
				clearThreadTileDetailLoadQueueTimer();
				state.threadTileActiveIds = [];
				for (const frame of state.threadTilePaneRenderFramesById.values()) if (window.cancelAnimationFrame) window.cancelAnimationFrame(frame);
				else clearTimeout(frame);
				state.threadTilePaneRenderFramesById.clear();
				state.threadTilePaneScrollHoldById.clear();
				for (const controller of state.threadTileControllers.values()) try {
					controller.abort();
				} catch (_) {}
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
					minIntervalMs: THREAD_TILE_REFRESH_MIN_INTERVAL_MS
				});
				if (plan.action !== "load") return;
				const background = plan.background;
				const controller = new AbortController();
				applyThreadTileDetailLoadStartEffects(threadTileStatePolicy.detailLoadStartEffectsPlan(plan), controller);
				try {
					const result = await api(threadDetailApiPath(id, { mode: "recent" }), {
						timeoutMs: 2e4,
						signal: controller.signal
					});
					if (controller.signal.aborted) return;
					if (result && result.thread) applyThreadTileDetailLoadSuccessEffects(threadTileStatePolicy.detailLoadSuccessEffectsPlan({
						id,
						hasThread: true,
						nowMs: Date.now()
					}), result.thread);
				} catch (err) {
					applyThreadTileDetailLoadErrorEffects(threadTileStatePolicy.detailLoadErrorEffectsPlan({
						id,
						aborted: controller.signal.aborted,
						background,
						errorMessage: err && err.message ? err.message : String(err)
					}));
				} finally {
					applyThreadTileDetailLoadFinallyEffects(threadTileStatePolicy.detailLoadFinallyEffectsPlan({
						id,
						controllerMatches: state.threadTileControllers.get(id) === controller,
						visible: threadTilePaneIsVisible(id)
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
					if (effect.renderPane && !scheduleRenderThreadTilePane(id, { preserveScroll: effect.preserveScroll !== false })) scheduleRenderCurrentThread();
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
				if (effect.renderPane && !scheduleRenderThreadTilePane(id, { preserveScroll: effect.preserveScroll !== false })) scheduleRenderCurrentThread();
				if (effect.scheduleQueueDrain) scheduleThreadTileDetailLoadQueueDrain({ force: true });
				return true;
			}
			function applyThreadTileDetailLoadQueuePlan(plan) {
				if (!plan || plan.action !== "detail-load-queue") return false;
				for (const id of Array.isArray(plan.abortIds) ? plan.abortIds : []) {
					const controller = state.threadTileControllers.get(id);
					if (controller && typeof controller.abort === "function") try {
						controller.abort();
					} catch (_) {}
					state.threadTileControllers.delete(id);
					state.threadTileLoadingIds.delete(id);
				}
				for (const id of Array.isArray(plan.loadIds) ? plan.loadIds : []) loadThreadTileDetail(id).catch(showError);
				if (plan.scheduleDrainAfterLoad) scheduleThreadTileDetailLoadQueueDrain({ pending: true });
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
					maxPanes: THREAD_TILE_USER_MAX_PANES
				});
				applyThreadTileDetailLoadQueuePlan(threadTileStatePolicy.detailLoadQueuePlan({
					enabled: state.threadTileMode,
					activeIds: state.threadTileActiveIds,
					controllerIds: Array.from(state.threadTileControllers.keys()),
					loadingIds: Array.from(state.threadTileLoadingIds),
					readyIds,
					maxConcurrentLoads: concurrency.maxConcurrentLoads
				}));
				scheduleThreadTileRefresh();
			}
			function renderThreadTileTurn(thread, turn, previousKeys = /* @__PURE__ */ new Set()) {
				return withRenderContextThread(thread, () => {
					const threadId = String(thread && thread.id || "");
					const renderedItems = visibleItemsForTurn(turn, thread).map((entry, index) => {
						const item = entry && entry.item;
						const sourceIndex = Number.isInteger(entry && entry.sourceIndex) && entry.sourceIndex >= 0 ? entry.sourceIndex : index;
						return renderVisibleItemPatchHtml(turn, item, previousKeys, sourceIndex, thread);
					}).filter(Boolean).join("");
					const budgetNoticeHtml = renderTurnVisibleItemBudgetNotice(turn, previousKeys);
					const turnApprovals = approvalsForTurn(threadId, turn && turn.id);
					const approvalsHtml = turnApprovals.length ? `<div class="approval-stack in-turn">${turnApprovals.map((request) => renderApprovalRequest(request, previousKeys, threadId)).join("")}</div>` : "";
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
						activeIds: state.threadTileActiveIds
					});
					if (plan.action === "operation-minimum-refresh") {
						let patchedAny = false;
						for (const id of plan.patchThreadIds || []) patchedAny = scheduleRenderThreadTilePane(id, { preserveScroll: true }) || patchedAny;
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
					nowMs: Date.now()
				});
				if (!record) return;
				state.threadTileOperationBubblesById.set(id, record);
			}
			function clearThreadTileOperationBubble(threadId) {
				const id = String(threadId || "");
				if (!id) return;
				state.threadTileOperationBubblesById.delete(id);
			}
			function renderThreadTileOperationDock(thread, previousKeys = /* @__PURE__ */ new Set()) {
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
					nowMs: Date.now()
				});
				if (plan.action === "render-remembered-operation") {
					if (plan.scheduleMinimumRefresh) scheduleThreadTileOperationMinimumRefresh(plan.remainingMs);
					return plan.html || "";
				}
				if (plan.action === "clear-remembered-operation") {
					if (plan.clearRemembered) state.threadTileOperationBubblesById.delete(id);
					return "";
				}
				if (plan.action !== "render-live-operation" || !entry || !entry.item) return "";
				const html = `<div class="thread-tile-operation-dock" data-thread-tile-operation-dock="${escapeHtml(id)}" data-mode="${escapeHtml(mode)}">
    <div class="live-operation-dock-inner">
      ${renderMobileOperationStack(entry.item, entry.turn, previousKeys, entry.sourceIndex, plan.expanded, {
					toggleAttribute: "data-thread-tile-operation-toggle",
					toggleValue: id
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
					entrySignature: entry && entry.item && entry.item.type !== "liveTurnStatus" ? visibleItemSignature(entry.item, entry.turn, thread) : null
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
					maxCount
				}, { maxPanes: THREAD_TILE_USER_MAX_PANES });
				if (plan.action !== "set-pane-count") return false;
				return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, {
					maxPanes: THREAD_TILE_USER_MAX_PANES,
					render: options.render !== false
				}), layout);
			}
			function changeThreadTilePaneCount(delta) {
				const layout = threadTileLayout({ enabled: true });
				if (!layout || !layout.enabled) return false;
				return setThreadTilePaneCount(effectiveThreadTilePaneCount(layout) + (Number(delta) || 0));
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
					minCount
				}, { maxPanes: THREAD_TILE_USER_MAX_PANES });
				if (plan.action !== "close-pane") return false;
				return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, { maxPanes: THREAD_TILE_USER_MAX_PANES }), layout);
			}
			function renderThreadTilePane(threadId, layout, previousKeys = /* @__PURE__ */ new Set()) {
				const thread = threadTileDisplayThread(threadId);
				const id = String(threadId || thread && thread.id || "");
				const title = threadTitleForDisplay(thread) || id;
				const summary = threadTileSummary(id);
				const paneStateHtml = turnTimerStateHtml(threadTilePaneTimerState(thread || summary));
				const error = threadTileError(id);
				const loading = state.threadTileLoadingIds.has(id) || thread && thread.mobileLoading && !threadHasVisibleConversationTurns(thread);
				const readWarning = threadReadWarningMessage(thread);
				const turns = visibleTurnsForConversation(thread);
				const visibleTurnIds = new Set(turns.map((turn) => turn && turn.id).filter(Boolean).map(String));
				const omitted = Number(thread && thread.mobileOmittedTurnCount || 0) + Math.max(0, (thread && thread.turns || []).length - turns.length);
				const historyNote = renderThreadHistoryNote(thread, omitted, previousKeys);
				const approvalsHtml = renderPendingApprovals(thread, previousKeys, (request) => {
					const turnId = approvalTurnId(request);
					if (turnId && visibleTurnIds.has(turnId)) return false;
					return isApprovalActive(request);
				});
				const body = error ? `<div class="thread-tile-empty error">Thread failed: ${escapeHtml(error)}</div>` : loading ? `<div class="thread-tile-empty">Loading thread...</div>` : [
					historyNote,
					readWarning ? `<div class="history-note">${escapeHtml(readWarning)}</div>` : "",
					turns.map((turn) => renderThreadTileTurn(thread, turn, previousKeys)).join("") || `<div class="thread-tile-empty">No visible turns.</div>`,
					approvalsHtml
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
				return Array.from(document.querySelectorAll("[data-thread-tile-pane]")).find((entry) => String(entry.getAttribute("data-thread-tile-pane") || "") === id) || null;
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
					threadSignatures: ids.map((id) => conversationRenderSignature(threadTileDisplayThread(id)))
				}, { maxPanes: THREAD_TILE_USER_MAX_PANES }).signature;
			}
			function patchThreadTilePane(threadId, options = {}) {
				const id = String(threadId || "").trim();
				let preflight = threadTileStatePolicy.panePatchPreflightPlan({
					threadId: id,
					enabled: state.threadTileMode,
					visible: id ? threadTilePaneIsVisible(id) : false
				});
				if (!preflight.shouldContinue) return false;
				const conversation = $("conversation");
				preflight = threadTileStatePolicy.panePatchPreflightPlan({
					threadId: id,
					enabled: state.threadTileMode,
					visible: true,
					conversationPresent: Boolean(conversation),
					tileSurface: Boolean(conversation && conversation.classList.contains("thread-tile-mode"))
				});
				if (!preflight.shouldContinue) return false;
				const board = conversation.querySelector("[data-thread-tile-board]");
				preflight = threadTileStatePolicy.panePatchPreflightPlan({
					threadId: id,
					enabled: state.threadTileMode,
					visible: true,
					conversationPresent: true,
					tileSurface: true,
					boardPresent: Boolean(board)
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
					layoutEnabled: Boolean(layout && layout.enabled)
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
					ids
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
					panePresent: Boolean(pane)
				});
				if (!preflight.canPatch) return false;
				const previousScroll = captureThreadTilePaneElementScrollState(pane);
				const previousKeys = existingConversationRenderKeys();
				const template = document.createElement("template");
				template.innerHTML = renderThreadTilePane(id, displayLayout, previousKeys);
				const sourcePane = template.content.firstElementChild;
				let completion = threadTileStatePolicy.panePatchCompletionPlan({
					threadId: id,
					sourcePanePresent: Boolean(sourcePane)
				});
				if (!completion.returnValue) return false;
				const patchedPane = patchNode(pane, sourcePane);
				completion = threadTileStatePolicy.panePatchCompletionPlan({
					threadId: id,
					sourcePanePresent: true,
					patchedPanePresent: Boolean(patchedPane),
					requestAnimationFrameAvailable: typeof window.requestAnimationFrame === "function"
				});
				if (!completion.returnValue) return false;
				if (completion.hydrate) hydrateThreadDetailSurface(patchedPane, { imageScanDelays: [0, 180] });
				if (completion.restoreScroll) restoreThreadTilePaneElementScrollState(patchedPane, previousScroll, options);
				if (completion.updateBottomButton) {
					const updateBottomButton = () => updateThreadTileBottomButtonForBody(patchedPane.querySelector(".thread-tile-pane-body"));
					if (completion.updateBottomButtonMode === "animation-frame" && typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(updateBottomButton);
					else updateBottomButton();
				}
				if (completion.writeRenderSignature) state.renderedConversationSignature = threadTileRenderSignature(displayLayout, ids);
				if (completion.clearPatchShellSignature) state.renderedConversationPatchShellSignature = "";
				if (completion.bindActions) bindThreadTileActions();
				else return false;
				return completion.returnValue;
			}
			function isThreadTileConversationSurface() {
				const conversation = $("conversation");
				return Boolean(state.threadTileMode && conversation && conversation.classList && conversation.classList.contains("thread-tile-mode"));
			}
			function threadDetailDomPatchSurface(options = {}) {
				const id = String(options.threadId || state.currentThreadId || state.currentThread && state.currentThread.id || "").trim();
				return threadDetailPatchPlanApi.planThreadDetailDomPatchSurface({
					threadId: id,
					threadTileMode: state.threadTileMode,
					threadTileSurface: isThreadTileConversationSurface(),
					tilePaneVisible: id ? threadTilePaneIsVisible(id) : false,
					conversationPresent: Boolean($("conversation"))
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
					hasFrame: id ? state.threadTilePaneRenderFramesById.has(id) : false
				});
				if (plan.action === "skip" || !plan.returnValue) return false;
				if (!plan.scheduleFrame) return true;
				const render = () => {
					state.threadTilePaneRenderFramesById.delete(id);
					if (!patchThreadTilePane(id, options) && plan.fullRenderOnPatchMiss) scheduleRenderCurrentThread();
				};
				const frame = window.requestAnimationFrame ? window.requestAnimationFrame(render) : setTimeout(render, 33);
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
				const html = `<div class="thread-tile-board" data-thread-tile-board data-render-key="thread-tile-board">
    ${(Array.isArray(displayLayout.columnGroups) && displayLayout.columnGroups.length ? displayLayout.columnGroups : ids.map((id) => [id])).map((group, index) => `<div class="thread-tile-column" data-thread-tile-column="${escapeHtml(String(index))}" style="--thread-tile-column-rows: ${escapeHtml(String(Math.max(1, group.length)))}">
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
					checkProjectionConsistency: true
				});
				bindThreadTileActions();
				restoreThreadTilePaneScrollState(scrollState);
				if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(() => {
					restoreThreadTilePaneScrollState(scrollState);
					updateThreadTileBottomButtons();
				});
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
						root: conversation
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
						root: conversation
					});
					if (plan.action === "select-pane") setThreadTileSelectedThread(plan.paneId || "");
				});
				conversation.addEventListener("click", (event) => {
					const plan = threadTileActionsApi.resolveThreadTileClickAction({
						target: event.target,
						root: conversation
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
							mode: state.threadTileOperationModesById.get(id) || "compact"
						}));
					}
				});
				conversation.addEventListener("scroll", (event) => {
					const plan = threadTileActionsApi.resolveThreadTileScrollAction({
						target: event.target,
						root: conversation
					});
					if (plan.action === "pane-scroll") updateThreadTileBottomButtonForBody(plan.body);
				}, {
					passive: true,
					capture: true
				});
				conversation.addEventListener("dragstart", (event) => {
					const plan = threadTileActionsApi.resolveThreadTileDragStartAction({
						target: event.target,
						root: conversation
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
						draggingId: state.threadTileDraggingThreadId || ""
					});
					if (plan.action !== "drag-over") return;
					if (plan.preventDefault) event.preventDefault();
					if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
					plan.pane.classList.add("drag-over");
				});
				conversation.addEventListener("dragleave", (event) => {
					const plan = threadTileActionsApi.resolveThreadTileDragLeaveAction({
						target: event.target,
						root: conversation
					});
					if (plan.action === "drag-leave") plan.pane.classList.remove("drag-over");
				});
				conversation.addEventListener("drop", (event) => {
					const plan = threadTileActionsApi.resolveThreadTileDropAction({
						target: event.target,
						root: conversation,
						draggingId: state.threadTileDraggingThreadId || "",
						transferId: event.dataTransfer && event.dataTransfer.getData("text/plain") || ""
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
					const isTile = (button.getAttribute("data-thread-display-choice") || "single") === "tile";
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
				handleThreadTileModeChoice
			};
		}
		const api = { createThreadTileRuntime };
		if (typeof module === "object" && module.exports) module.exports = api;
		root.CodexThreadTileRuntime = api;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
//#region public/app-update-runtime.js
var require_app_update_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function attachAppUpdateRuntime(root) {
		function createAppUpdateRuntime(deps = {}) {
			const { state = {}, CLIENT_BUILD_ID = "", PAGE_REFRESH_CHECK_INTERVAL_MS = 6e4, PAGE_REFRESH_MIN_CHECK_INTERVAL_MS = 12e3, PAGE_SHELL_ASSETS = [], STORAGE_PUBLIC_PR_PROMPT = "codexMobilePublicPrPromptKey", PUBLIC_PR_REVIEW_THREAD_TITLE = "Codex Mobile Public PR", buildRefreshPolicy = null, $ = () => null, api = async () => ({}), escapeHtml = (value) => String(value == null ? "" : value), normalizeFsPath = (value) => String(value || ""), threadMatchesWorkspaceCwd = () => false, loadThreads = async () => {}, loadThread = async () => {}, setComposerText = () => {}, scheduleCurrentDraftSave = () => {}, updateComposerControls = () => {}, composerHasContent = () => false, requestAppAlert = async () => {}, requestAppConfirmation = async () => false, loadWorkspaces = async () => {}, postClientEvent = () => {}, saveCurrentDraftNow = () => {}, syncSidebarWorkspaceSelect = () => {}, updateWorkspacePath = () => {}, renderWorkspaceTokenUsage = () => {}, isMenuOverlayMode = () => false, closeSidebarMenu = () => {}, clearCurrentThreadSelection = () => {}, restoreDraftForCurrentTarget = () => {}, renderThreads = () => {}, renderCurrentThread = () => {}, showError = () => {}, isRunningStatus = () => false, visibleThreads = (threads) => Array.isArray(threads) ? threads : [], threadById = () => null, shortPath = (value) => String(value || ""), statusText = (status) => String(status && status.type || status || ""), saveRestartAutoRecoverThreads = () => {}, postPerformanceEvent = () => {}, roundedDurationMs = (startedAt) => Math.max(0, Date.now() - Number(startedAt || Date.now())), isHermesEmbedMode = () => false, requestHermesPluginRefresh = () => {}, rememberRateLimitsFromConfig = () => {}, rememberCodexProfiles = () => {}, renderCodexProfileSettings = () => {}, stopCodexProfileSwitchProgressPolling = () => {}, publishPluginNavigationState = () => {} } = deps;
			function appVersionText(status = state.appUpdateStatus) {
				const version = String(status && status.version || state.appVersion || "").trim();
				const client = clientBuildVersionText();
				return version ? `v${version} · ${client}` : client;
			}
			function clientBuildVersionText(buildId = CLIENT_BUILD_ID) {
				const text = String(buildId || "").trim();
				const match = text.match(/\bcodex-mobile-shell-v([0-9]+)\b/);
				if (match) return `客户端 v${match[1]}`;
				return text ? `客户端 ${text}` : "客户端未知";
			}
			function renderAppUpdateStatus() {
				const el = $("appUpdateStatus");
				if (!el) return;
				const status = state.appUpdateStatus || {};
				const supported = status.supported !== false;
				const checking = state.appUpdateBusy && !state.appUpdateRestarting;
				const applying = Boolean(status.applying) || state.appUpdateRestarting;
				const blocked = Boolean(status.updateAvailable && !status.canFastForward);
				let label = appVersionText(status);
				let title = `Check for GitHub updates；当前客户端 ${CLIENT_BUILD_ID}`;
				if (state.appUpdateRestarting) {
					label = "等待重启…";
					title = "更新已应用。服务会退出并等待启动任务或守护脚本拉起；手动启动的部署需要在服务停止后手动重启。";
				} else if (applying) {
					label = "更新中…";
					title = "正在拉取更新";
				} else if (checking) {
					label = "检查更新…";
					title = "正在检查 GitHub 更新";
				} else if (status.updateAvailable && status.canFastForward) {
					label = `有更新 ${status.remoteShort || ""}`.trim();
					title = `发现 ${status.remote || "origin"}/${status.branch || "main"} 更新，点击后确认拉取；更新后服务会退出并依赖启动任务或守护脚本重启`;
				} else if (blocked) {
					label = "更新受阻";
					title = status.reason || status.error || "检测到更新，但当前工作区不能安全 fast-forward";
				} else if (status.error) {
					label = "更新检查失败";
					title = status.error;
				} else if (!supported) title = status.reason || "当前安装方式不支持 Git 自动更新";
				else if (status.localShort) title = `${appVersionText(status)} (${status.localShort})，点击重新检查更新；当前客户端 ${CLIENT_BUILD_ID}`;
				el.textContent = label;
				el.title = title;
				el.classList.toggle("hidden", !state.appVersion && !state.appUpdateStatus);
				el.classList.toggle("available", Boolean(status.updateAvailable && status.canFastForward));
				el.classList.toggle("blocked", blocked || Boolean(status.error));
				el.classList.toggle("checking", checking || applying);
				el.disabled = state.appUpdateBusy || state.appUpdateRestarting;
			}
			async function refreshAppUpdateStatus(options = {}) {
				if (!state.key) return null;
				if (state.appUpdateBusy && !options.force) return state.appUpdateStatus;
				state.appUpdateBusy = true;
				if (!options.silent) renderAppUpdateStatus();
				try {
					const params = new URLSearchParams();
					if (options.fetch) params.set("fetch", "1");
					if (options.force) params.set("force", "1");
					const status = await api(`/api/app-update/status${params.toString() ? `?${params.toString()}` : ""}`, { timeoutMs: options.fetch ? 25e3 : 12e3 });
					state.appUpdateStatus = status;
					state.appUpdateError = status && status.error ? status.error : "";
					return status;
				} catch (err) {
					state.appUpdateError = err.message || String(err);
					state.appUpdateStatus = Object.assign({}, state.appUpdateStatus || {}, {
						version: state.appVersion,
						error: state.appUpdateError
					});
					return state.appUpdateStatus;
				} finally {
					state.appUpdateBusy = false;
					renderAppUpdateStatus();
					renderUpdatePanel();
				}
			}
			function currentUpdateUsesPublicRelease(status = state.appUpdateStatus) {
				const remoteUrl = String(status && status.remoteUrl || "").toLowerCase();
				const repository = String(state.publicReleaseRepository || state.publicPrRepository || "").toLowerCase();
				if (!remoteUrl || !repository) return false;
				return remoteUrl.includes(`github.com/${repository}`) || remoteUrl.endsWith(`/${repository}.git`) || remoteUrl.endsWith(`/${repository}`);
			}
			function updateStatusLine(status) {
				if (!status) return "Not checked";
				if (state.appUpdateRestarting || status.restartScheduled) return "Restart pending";
				if (state.appUpdateBusy || status.checking) return "Checking";
				if (status.applying) return "Updating";
				if (status.error) return `Error: ${status.error}`;
				if (status.supported === false) return status.reason || "Not supported";
				if (status.updateAvailable && status.canFastForward) return `Update available: ${status.remoteShort || status.remoteCommit || ""}`.trim();
				if (status.updateAvailable) return `Update blocked: ${status.reason || "cannot fast-forward"}`;
				return "Up to date";
			}
			function publicReleaseStatusLine(status) {
				if (!state.publicReleaseEnabled) return "Public release check disabled";
				if (!status) return "Not checked";
				if (state.publicReleaseBusy || status.checking) return "Checking";
				if (status.error) return `Error: ${status.error}`;
				if (status.supported === false) return status.reason || "Not supported";
				if (status.updateAvailable) return `Public latest: ${status.publicShort || ""}`.trim();
				return "Matches Public latest";
			}
			function updateActionButton(action, label, options = {}) {
				const classes = ["update-action-button"];
				if (options.primary) classes.push("primary");
				return `<button type="button" class="${escapeHtml(classes.join(" "))}" data-update-action="${escapeHtml(action)}" ${options.disabled ? "disabled" : ""}>${escapeHtml(label)}</button>`;
			}
			function publicPrHasOpenPullRequests(status) {
				return Boolean(status && status.hasOpenPullRequests);
			}
			function renderUpdatePanel() {
				const dialog = $("updateDialog");
				const content = $("updatePanelContent");
				if (!dialog || !content) return;
				dialog.classList.toggle("hidden", !state.updatePanelOpen);
				if (!state.updatePanelOpen) return;
				const current = state.appUpdateStatus || {};
				const release = state.publicReleaseStatus || {};
				const publicCheckout = currentUpdateUsesPublicRelease(current) || Boolean(release.currentCheckoutUsesPublicRelease);
				const canApplyCurrent = Boolean(current.updateAvailable && current.canFastForward && !state.appUpdateBusy && !state.appUpdateRestarting);
				const hasPublicPrs = publicPrHasOpenPullRequests(state.publicPrStatus);
				const publicPrActionLabel = state.publicPrBusy ? "Checking PR..." : hasPublicPrs ? "Review Public PR" : "Check PR";
				const currentButtons = [updateActionButton("refresh-current", state.appUpdateBusy ? "Checking..." : "Check current", { disabled: state.appUpdateBusy }), updateActionButton("apply-current", publicCheckout ? "Update from Public" : "Apply current update", {
					primary: canApplyCurrent,
					disabled: !canApplyCurrent
				})].join("");
				const publicButtons = [updateActionButton("refresh-public", state.publicReleaseBusy ? "Checking..." : "Check Public", { disabled: state.publicReleaseBusy || !state.publicReleaseEnabled }), updateActionButton("public-pr", publicPrActionLabel, {
					disabled: state.publicPrBusy || !state.publicPrEnabled,
					primary: hasPublicPrs
				})].join("");
				content.innerHTML = `
      <section class="update-card">
        <div class="update-card-title">Current checkout</div>
        <div class="update-row">
          <strong>${escapeHtml(updateStatusLine(current))}</strong>
          <span class="update-row-meta">${escapeHtml(current.remote || "origin")}/${escapeHtml(current.branch || "main")} ${escapeHtml(current.localShort || "")}${current.remoteShort ? ` -> ${escapeHtml(current.remoteShort)}` : ""}</span>
          <span class="update-row-detail">${escapeHtml(current.reason || current.remoteUrl || "Checks the Git remote configured for this running checkout.")}</span>
        </div>
        <div class="update-actions">${currentButtons}</div>
      </section>
      <section class="update-card">
        <div class="update-card-title">Public release</div>
        <div class="update-row">
          <strong>${escapeHtml(publicReleaseStatusLine(release))}</strong>
          <span class="update-row-meta">${escapeHtml(release.repository || state.publicReleaseRepository || "")}/${escapeHtml(release.branch || state.publicReleaseBranch || "main")} ${escapeHtml(release.publicShort || "")}</span>
          <span class="update-row-detail">${escapeHtml(publicCheckout ? "This checkout tracks Public, so the current update button applies Public fast-forward updates." : "This checkout does not track Public; Public latest is shown for reference here.")}</span>
        </div>
        <div class="update-actions">${publicButtons}</div>
      </section>`;
			}
			async function refreshPublicReleaseStatus(options = {}) {
				if (!state.key || !state.publicReleaseEnabled) return null;
				if (state.publicReleaseBusy && !options.force) return state.publicReleaseStatus;
				state.publicReleaseBusy = true;
				renderUpdatePanel();
				try {
					const params = new URLSearchParams();
					if (options.force) params.set("force", "1");
					const status = await api(`/api/public-release/status${params.toString() ? `?${params.toString()}` : ""}`, { timeoutMs: 18e3 });
					state.publicReleaseStatus = status;
					return status;
				} catch (err) {
					state.publicReleaseStatus = Object.assign({}, state.publicReleaseStatus || {}, {
						enabled: state.publicReleaseEnabled,
						repository: state.publicReleaseRepository,
						branch: state.publicReleaseBranch,
						error: err.message || String(err)
					});
					return state.publicReleaseStatus;
				} finally {
					state.publicReleaseBusy = false;
					renderUpdatePanel();
				}
			}
			function openUpdatePanel() {
				state.updatePanelOpen = true;
				renderUpdatePanel();
				publishPluginNavigationState({ force: true });
				refreshAppUpdateStatus({
					fetch: true,
					force: true,
					silent: true
				}).then(renderUpdatePanel).catch(() => renderUpdatePanel());
				refreshPublicReleaseStatus({ force: true }).catch(() => renderUpdatePanel());
			}
			function closeUpdatePanel() {
				state.updatePanelOpen = false;
				renderUpdatePanel();
				publishPluginNavigationState({ force: true });
			}
			function handleUpdatePanelClick(event) {
				const button = event.target && event.target.closest("[data-update-action]");
				if (!button) return;
				const action = button.dataset.updateAction;
				if (action === "refresh-current") refreshAppUpdateStatus({
					fetch: true,
					force: true,
					silent: true
				}).then(renderUpdatePanel).catch(showError);
				else if (action === "apply-current") handleAppUpdateClick().then(renderUpdatePanel).catch(showError);
				else if (action === "refresh-public") refreshPublicReleaseStatus({ force: true }).catch(showError);
				else if (action === "public-pr") handlePublicPrStatusClick().catch(showError);
			}
			function scheduleStartupUpdateCheck() {
				if (!state.key) return;
				window.setTimeout(() => {
					refreshAppUpdateStatus({
						fetch: true,
						force: true,
						silent: true
					}).catch(() => {});
				}, 900);
			}
			function publicPrPromptKey(status) {
				if (!publicPrHasOpenPullRequests(status)) return "";
				const pullRequests = Array.isArray(status.pullRequests) ? status.pullRequests : [];
				const marker = pullRequests.map((pr) => `#${pr.number || ""}:${pr.updatedAt || ""}`).filter(Boolean).join("|");
				return `${status.repository || ""}|${status.openPullRequestCount || pullRequests.length}|${marker}`;
			}
			function publicPrSummaryText(status) {
				const pullRequests = Array.isArray(status && status.pullRequests) ? status.pullRequests : [];
				if (!pullRequests.length) return "";
				return pullRequests.map((pr) => `#${pr.number} ${pr.title || ""}`.trim()).join("; ");
			}
			function normalizedPublicPrReviewTitle(value) {
				return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
			}
			function publicPrReviewThreadTitle() {
				return PUBLIC_PR_REVIEW_THREAD_TITLE;
			}
			function findPublicPrReviewThread(workspacePath = "") {
				const titleKey = normalizedPublicPrReviewTitle(publicPrReviewThreadTitle());
				const workspace = String(workspacePath || "").trim();
				return state.threads.find((thread) => {
					if (!thread || !thread.id) return false;
					if (normalizedPublicPrReviewTitle(thread.name || thread.title || thread.preview || "") !== titleKey) return false;
					return !workspace || threadMatchesWorkspaceCwd(thread.cwd || "", workspace);
				}) || null;
			}
			function workspacePathBaseName(value) {
				const text = String(value || "").trim().replace(/[\\/]+$/, "");
				if (!text) return "";
				const parts = text.split(/[\\/]+/).filter(Boolean);
				return parts[parts.length - 1] || "";
			}
			function workspacePathIsVisible(value) {
				const key = normalizeFsPath(value);
				if (!key) return false;
				return (state.workspaces || []).some((workspace) => normalizeFsPath(workspace && workspace.cwd) === key);
			}
			function visibleWorkspaceWithBaseName(value) {
				const baseName = workspacePathBaseName(value).toLowerCase();
				if (!baseName) return "";
				const match = (state.workspaces || []).find((workspace) => workspace && workspace.cwd && workspacePathBaseName(workspace.cwd).toLowerCase() === baseName);
				return match ? String(match.cwd || "").trim() : "";
			}
			function publicPrReviewWorkspacePath() {
				const appWorkspace = String(state.appWorkspacePath || "").trim();
				if (workspacePathIsVisible(appWorkspace)) return appWorkspace;
				const sameNameWorkspace = visibleWorkspaceWithBaseName(appWorkspace);
				if (sameNameWorkspace) return sameNameWorkspace;
				const selectedWorkspace = String(state.selectedCwd || "").trim();
				if (workspacePathIsVisible(selectedWorkspace)) return selectedWorkspace;
				const currentWorkspace = String(state.currentThread && state.currentThread.cwd || "").trim();
				if (workspacePathIsVisible(currentWorkspace)) return currentWorkspace;
				return appWorkspace || selectedWorkspace || currentWorkspace;
			}
			async function openPublicPrReviewThreadIfAvailable(workspacePath, text) {
				let target = findPublicPrReviewThread(workspacePath);
				if (!target) {
					try {
						await loadThreads({ silent: true });
					} catch (err) {
						postClientEvent("public_pr_reuse_lookup_failed", { message: err.message || String(err) });
					}
					target = findPublicPrReviewThread(workspacePath);
				}
				if (!target || !target.id) return false;
				await loadThread(target.id, { source: "public-pr" });
				setComposerText(text);
				scheduleCurrentDraftSave();
				updateComposerControls();
				return true;
			}
			function renderPublicPrStatus() {
				const el = $("publicPrStatus");
				if (!el) return;
				const status = state.publicPrStatus || {};
				const enabled = state.publicPrEnabled && status.enabled !== false;
				const checking = state.publicPrBusy || Boolean(status.checking);
				const hasPrs = publicPrHasOpenPullRequests(status);
				const blocked = Boolean(status.error || status.supported === false);
				let label = "Public PR";
				let title = state.publicPrRepository ? `Check ${state.publicPrRepository} pull requests` : "Check public pull requests";
				if (checking) {
					label = "PR...";
					title = "Checking public pull requests";
				} else if (hasPrs) {
					label = `PR ${status.openPullRequestCount || (status.pullRequests || []).length}`;
					title = `Open public PRs: ${publicPrSummaryText(status) || label}`;
				} else if (status.checkedAt && enabled) {
					label = "No PR";
					title = `No open public PRs in ${status.repository || state.publicPrRepository || "public repo"}`;
				} else if (blocked) {
					label = "PR ?";
					title = status.error || status.reason || "Public PR check is unavailable";
				}
				el.textContent = label;
				el.title = title;
				el.classList.toggle("hidden", !checking && !hasPrs && !blocked);
				el.classList.toggle("available", hasPrs);
				el.classList.toggle("blocked", blocked);
				el.classList.toggle("checking", checking);
				el.disabled = state.publicPrBusy;
			}
			async function refreshPublicPrStatus(options = {}) {
				if (!state.key || !state.publicPrEnabled) return null;
				if (state.publicPrBusy && !options.force) return state.publicPrStatus;
				state.publicPrBusy = true;
				if (!options.silent) renderPublicPrStatus();
				try {
					const params = new URLSearchParams();
					if (options.force) params.set("force", "1");
					const status = await api(`/api/public-pull-requests/status${params.toString() ? `?${params.toString()}` : ""}`, { timeoutMs: 18e3 });
					state.publicPrStatus = status;
					state.publicPrError = status && status.error ? status.error : "";
					if (!options.skipPrompt) maybePromptPublicPrMerge(status);
					return status;
				} catch (err) {
					state.publicPrError = err.message || String(err);
					state.publicPrStatus = Object.assign({}, state.publicPrStatus || {}, {
						enabled: state.publicPrEnabled,
						repository: state.publicPrRepository,
						hasOpenPullRequests: false,
						openPullRequestCount: 0,
						pullRequests: [],
						error: state.publicPrError
					});
					return state.publicPrStatus;
				} finally {
					state.publicPrBusy = false;
					renderPublicPrStatus();
					renderUpdatePanel();
				}
			}
			function scheduleStartupPublicPrCheck() {
				if (!state.key || !state.publicPrEnabled) return;
				window.setTimeout(() => {
					refreshPublicPrStatus({
						force: true,
						silent: true
					}).catch(() => {});
				}, 1600);
			}
			function publicPrMergeInstruction(status) {
				const summary = publicPrSummaryText(status);
				return [
					`请检查 public 仓库 ${status && status.repository || state.publicPrRepository || "pentiumxp/codex-mobile-web-public"} 的开放 PR${summary ? `：${summary}` : ""}。`,
					"按当前项目规则先评估 PR 是否可合并；如要合并，更新 public README 的中文发布说明，运行验证和隐私扫描，再提交并推送 public。",
					"不要复制 .agent-context、runtime state、本地密钥、上传内容或机器特定诊断。完成 public 后再同步回 private 并重新验证。"
				].join("\n");
			}
			function publicPrMergeConfirmationMessage(status) {
				return [
					`检测到 public 仓库有 ${status.openPullRequestCount || (status.pullRequests || []).length} 个开放 PR。`,
					publicPrSummaryText(status),
					"",
					"是否准备一条合并/发布检查任务？"
				].filter(Boolean).join("\n");
			}
			async function preparePublicPrMergePrompt(status) {
				const text = publicPrMergeInstruction(status);
				if (composerHasContent()) {
					await requestAppAlert("检测到 public 开放 PR，但输入框已有内容。请处理当前草稿后点击 Public PR 按钮。", { title: "Public PR" });
					return;
				}
				if (!state.workspaces.length) await loadWorkspaces().catch((err) => {
					postClientEvent("public_pr_workspace_lookup_failed", { message: err.message || String(err) });
				});
				const workspacePath = publicPrReviewWorkspacePath();
				if (!workspacePath) {
					setComposerText(text);
					scheduleCurrentDraftSave();
					updateComposerControls();
					return;
				}
				saveCurrentDraftNow();
				state.selectedCwd = workspacePath;
				syncSidebarWorkspaceSelect();
				updateWorkspacePath();
				renderWorkspaceTokenUsage();
				if (await openPublicPrReviewThreadIfAvailable(workspacePath, text)) {
					if (isMenuOverlayMode()) closeSidebarMenu();
					return;
				}
				clearCurrentThreadSelection({ saveDraft: false });
				state.selectedCwd = workspacePath;
				state.newThreadDraft = true;
				state.newThreadTitle = publicPrReviewThreadTitle();
				state.sendButtonHint = "";
				restoreDraftForCurrentTarget();
				state.newThreadTitle = publicPrReviewThreadTitle();
				setComposerText(text);
				syncSidebarWorkspaceSelect();
				updateWorkspacePath();
				renderWorkspaceTokenUsage();
				renderThreads();
				renderCurrentThread();
				updateComposerControls();
				scheduleCurrentDraftSave();
				if (isMenuOverlayMode()) closeSidebarMenu();
			}
			function rememberPublicPrPrompt(status) {
				const key = publicPrPromptKey(status);
				if (!key) return;
				state.publicPrPromptedKey = key;
				localStorage.setItem(STORAGE_PUBLIC_PR_PROMPT, key);
			}
			function maybePromptPublicPrMerge(status) {
				if (!publicPrHasOpenPullRequests(status)) return;
				const key = publicPrPromptKey(status);
				if (!key || key === state.publicPrPromptedKey) return;
				rememberPublicPrPrompt(status);
				requestAppConfirmation(publicPrMergeConfirmationMessage(status), {
					title: "Public PR",
					confirmLabel: "准备任务",
					cancelLabel: "稍后"
				}).then((confirmed) => {
					if (confirmed) preparePublicPrMergePrompt(status).catch(showError);
				}).catch(showError);
			}
			async function handlePublicPrStatusClick() {
				if (state.publicPrBusy) return;
				const status = await refreshPublicPrStatus({
					force: true,
					skipPrompt: true
				});
				if (!status) return;
				if (status.error && !publicPrHasOpenPullRequests(status)) {
					await requestAppAlert(`public PR 检查失败：${status.error}`, { title: "Public PR" });
					return;
				}
				if (!publicPrHasOpenPullRequests(status)) {
					await requestAppAlert("当前未检测到 public 开放 PR。", { title: "Public PR" });
					return;
				}
				const confirmed = await requestAppConfirmation(publicPrMergeConfirmationMessage(status), {
					title: "Public PR",
					confirmLabel: "准备任务",
					cancelLabel: "稍后"
				});
				rememberPublicPrPrompt(status);
				if (confirmed) await preparePublicPrMergePrompt(status);
			}
			async function handleAppUpdateClick() {
				if (state.appUpdateBusy || state.appUpdateRestarting) return;
				let status = state.appUpdateStatus;
				if (!status || !status.updateAvailable && !status.error) status = await refreshAppUpdateStatus({
					fetch: true,
					force: true
				});
				if (!status) return;
				if (status.supported === false) {
					await requestAppAlert(`当前安装方式不支持自动更新：${status.reason || "没有可用的 Git 远程分支"}`, { title: "更新检查" });
					return;
				}
				if (status.error && !status.updateAvailable) {
					await requestAppAlert(`更新检查失败：${status.error}`, { title: "更新检查" });
					return;
				}
				if (!status.updateAvailable) {
					await requestAppAlert("当前已经是最新版本。", { title: "更新检查" });
					return;
				}
				if (!status.canFastForward) {
					await requestAppAlert(`检测到更新，但不能自动应用：${status.reason || status.error || "当前工作区不是干净的 fast-forward 状态"}`, { title: "更新检查" });
					return;
				}
				if (!await requestAppConfirmation([
					"发现 GitHub 更新。是否拉取并重启 Mobile Web？",
					"",
					"仅在当前仓库干净、可 fast-forward 时执行；运行时数据和 Access Key 不会被覆盖。",
					"更新完成后当前 Node 服务会退出。只有通过 Windows 启动任务、windowless supervisor 或 macOS shared launcher 运行时才会自动拉起；手动运行 node/npm start 的部署需要手动重启。"
				].join("\n"), {
					title: "应用更新",
					confirmLabel: "更新并重启",
					cancelLabel: "取消"
				})) return;
				state.appUpdateBusy = true;
				renderAppUpdateStatus();
				try {
					const result = await api("/api/app-update/apply", {
						method: "POST",
						body: "{}",
						timeoutMs: 15e4
					});
					state.appUpdateStatus = result.after || result.status || status;
					if (result.updated) {
						state.appUpdateRestarting = true;
						$("connectionState").textContent = "更新已应用；如连接断开且未自动恢复，请在部署机手动重启";
						renderAppUpdateStatus();
						window.setTimeout(() => window.location.reload(), Math.max(1800, Number(result.restartInMs || 1200) + 900));
					} else await requestAppAlert("当前已经是最新版本。", { title: "更新检查" });
				} catch (err) {
					state.appUpdateError = err.message || String(err);
					state.appUpdateStatus = Object.assign({}, status || {}, { error: state.appUpdateError });
					showError(err);
				} finally {
					state.appUpdateBusy = false;
					renderAppUpdateStatus();
					renderUpdatePanel();
				}
			}
			function renderSharedRestartButton() {
				const el = $("sharedRestartButton");
				if (!el) return;
				const restarting = state.sharedRestarting;
				el.textContent = restarting ? "Restarting" : "Restart";
				el.title = restarting ? "Mobile Web is restarting" : "Restart Mobile Web shared chain";
				el.disabled = state.sharedRestartBusy || restarting;
				el.classList.toggle("checking", state.sharedRestartBusy || restarting);
			}
			function renderHardRefreshButton() {
				const el = $("hardRefreshButton");
				if (!el) return;
				const reloading = state.pageRefreshReloading;
				el.textContent = reloading ? "刷新中" : "硬刷新";
				el.title = reloading ? "Refreshing the current PWA page shell" : "Fetch current page assets, update the service worker, and reload this PWA page";
				el.disabled = reloading;
				el.classList.toggle("checking", reloading);
			}
			function markBootReady() {
				const boot = window.codexMobileBoot;
				if (boot && typeof boot.ready === "function") boot.ready();
			}
			function reportShellLoaded(startedAt, details = {}) {
				if (state.shellLoadedReported) return;
				state.shellLoadedReported = true;
				postPerformanceEvent("shell_loaded", Object.assign({
					elapsedMs: roundedDurationMs(startedAt),
					buildId: CLIENT_BUILD_ID,
					hasThreadOpenIntent: Boolean(state.startupThreadOpenPending)
				}, details || {}), { force: true });
			}
			function sharedRestartScopeLines() {
				return state.serverPlatform === "darwin" ? ["这会短暂断开当前页面连接，并重启这台 Mac 上的 Mobile Web 服务。", "不会重启 Codex Desktop、shared mux 或其它本机服务。"] : ["这会短暂断开当前页面连接，并重启 Mobile Web、shared mux 和本地 app-server。", "不会重启 WSL、Codex Desktop 或其它本机服务。"];
			}
			function restartRiskThreads(threads) {
				const seen = /* @__PURE__ */ new Set();
				const result = [];
				for (const thread of threads || []) {
					const id = String(thread && thread.id || "");
					if (!id || seen.has(id) || !isRunningStatus(thread.status)) continue;
					seen.add(id);
					result.push(thread);
				}
				if (state.currentThreadId && state.activeTurnId && !seen.has(String(state.currentThreadId))) {
					const current = state.currentThread || threadById(state.currentThreadId) || {
						id: state.currentThreadId,
						name: "Current session",
						status: { type: "active" }
					};
					result.unshift(current);
				}
				return result;
			}
			async function fetchRestartRiskThreads() {
				const params = new URLSearchParams({
					limit: "200",
					archived: "false"
				});
				const result = await api(`/api/threads?${params}`, { timeoutMs: 45e3 });
				return restartRiskThreads(visibleThreads(result.data || []));
			}
			function restartRiskThreadTitle(thread) {
				return String(thread && (thread.name || thread.preview || thread.id) || "Untitled session").trim();
			}
			function restartRiskThreadMeta(thread) {
				const parts = [];
				const cwd = shortPath(thread && thread.cwd);
				if (cwd) parts.push(cwd);
				const status = statusText(thread && thread.status);
				if (status) parts.push(status);
				return parts.join(" | ");
			}
			function renderSharedRestartDialog() {
				const dialog = $("restartConfirmDialog");
				const subtitle = $("restartConfirmSubtitle");
				const content = $("restartConfirmContent");
				const proceed = $("restartConfirmProceed");
				if (!dialog || !content || !subtitle || !proceed) return;
				dialog.classList.toggle("hidden", !state.sharedRestartDialogOpen);
				if (!state.sharedRestartDialogOpen) {
					content.innerHTML = "";
					return;
				}
				const riskThreads = state.sharedRestartRiskThreads || [];
				const hasRisk = riskThreads.length > 0;
				subtitle.textContent = hasRisk ? `${riskThreads.length} running session${riskThreads.length === 1 ? "" : "s"} may be interrupted` : "No running sessions were found";
				proceed.textContent = hasRisk ? "仍然重启" : "Restart";
				proceed.classList.toggle("danger", hasRisk);
				const scopeHtml = (state.sharedRestartScopeLines || []).map((line) => `<div class="restart-confirm-line">${escapeHtml(line)}</div>`).join("");
				const riskHtml = hasRisk ? `<div class="restart-risk-block">
          <div class="restart-risk-title">Running sessions</div>
          <div class="restart-risk-list">
            ${riskThreads.slice(0, 6).map((thread) => {
					const meta = restartRiskThreadMeta(thread);
					return `<div class="restart-risk-item">
                <div class="restart-risk-item-title">${escapeHtml(restartRiskThreadTitle(thread))}</div>
                ${meta ? `<div class="restart-risk-item-meta">${escapeHtml(meta)}</div>` : ""}
              </div>`;
				}).join("")}
            ${riskThreads.length > 6 ? `<div class="restart-risk-more">另有 ${escapeHtml(String(riskThreads.length - 6))} 个 running session</div>` : ""}
          </div>
        </div>` : `<div class="restart-safe-block">当前没有检测到 running session。重启仍会短暂断开本页面连接。</div>`;
				content.innerHTML = `
      <div class="restart-confirm-message">
        ${hasRisk ? "重启可能会打断正在通过 Codex Mobile 同步或运行的 session。建议等它们结束后再重启。" : "确认重启 Codex Mobile Web？"}
      </div>
      ${riskHtml}
      <div class="restart-confirm-scope">${scopeHtml}</div>
    `;
			}
			function closeSharedRestartDialog(confirmed = false) {
				const resolve = state.sharedRestartConfirmResolve;
				state.sharedRestartDialogOpen = false;
				state.sharedRestartRiskThreads = [];
				state.sharedRestartScopeLines = [];
				state.sharedRestartConfirmResolve = null;
				renderSharedRestartDialog();
				if (resolve) resolve(Boolean(confirmed));
			}
			function requestSharedRestartConfirmation(riskThreads, scopeLines) {
				if (state.sharedRestartConfirmResolve) closeSharedRestartDialog(false);
				state.sharedRestartRiskThreads = riskThreads || [];
				state.sharedRestartScopeLines = scopeLines || [];
				state.sharedRestartDialogOpen = true;
				renderSharedRestartDialog();
				return new Promise((resolve) => {
					state.sharedRestartConfirmResolve = resolve;
				});
			}
			async function handleSharedRestartClick() {
				if (state.sharedRestartBusy || state.sharedRestarting) return;
				state.sharedRestartBusy = true;
				renderSharedRestartButton();
				try {
					const riskThreads = await fetchRestartRiskThreads();
					if (!await requestSharedRestartConfirmation(riskThreads, sharedRestartScopeLines())) return;
					saveRestartAutoRecoverThreads(riskThreads);
					state.appServerWasUnavailable = true;
					await api("/api/restart/shared-chain", {
						method: "POST",
						body: "{}",
						timeoutMs: 12e3
					});
					state.sharedRestarting = true;
					state.sharedRestartBusy = false;
					showReconnectRefreshPrompt("restart");
					const connection = $("connectionState");
					if (connection) connection.textContent = "Restarting";
					renderSharedRestartButton();
				} catch (err) {
					showError(err);
				} finally {
					if (!state.sharedRestarting) {
						state.sharedRestartBusy = false;
						renderSharedRestartButton();
					}
				}
			}
			function serverBuildIdFromConfig(config) {
				return String(config && (config.clientBuildId || config.shellCacheName || config.buildId) || "").trim();
			}
			function shouldPromptForServerBuildChange(serverBuildId, clientBuildId) {
				if (buildRefreshPolicy && typeof buildRefreshPolicy.shouldPromptForServerBuildChange === "function") return buildRefreshPolicy.shouldPromptForServerBuildChange(serverBuildId, clientBuildId);
				return Boolean(serverBuildId && clientBuildId && serverBuildId !== clientBuildId);
			}
			function pageShellAssetUrl(asset, buildId) {
				const url = new URL(asset, window.location.origin);
				url.searchParams.set("shellBuild", buildId || "current");
				url.searchParams.set("shellCheck", String(Date.now()));
				return url.href;
			}
			function validatePageShellAsset(asset, text, config) {
				const buildId = serverBuildIdFromConfig(config);
				const shellCacheName = String(config && config.shellCacheName || "").trim();
				if (asset === "/" || asset === "/index.html") return text.includes("href=\"/styles.css\"") && text.includes("src=\"/app.js\"");
				if (asset === "/styles.css") return text.includes(".app") && text.includes(".composer");
				if (asset === "/app.js") return !buildId || text.includes(buildId) || text.includes(shellCacheName);
				if (asset === "/sw.js") return text.includes("shell-asset-manifest.js");
				return true;
			}
			async function fetchPageShellAsset(asset, config) {
				const response = await fetch(pageShellAssetUrl(asset, serverBuildIdFromConfig(config)), {
					cache: "no-store",
					credentials: "same-origin"
				});
				if (!response.ok) throw new Error(`page shell asset unavailable: ${asset}`);
				if (asset === "/" || asset.endsWith(".html") || asset.endsWith(".css") || asset.endsWith(".js") || asset.endsWith(".json") || asset.endsWith(".svg")) {
					if (!validatePageShellAsset(asset, await response.clone().text(), config)) throw new Error(`page shell asset stale: ${asset}`);
				}
				return response;
			}
			async function preparePageShellAssets(config, options = {}) {
				const populateCache = Boolean(options.populateCache);
				const shellCacheName = String(config && config.shellCacheName || "").trim();
				const cache = populateCache && shellCacheName && "caches" in window ? await window.caches.open(shellCacheName) : null;
				for (const asset of PAGE_SHELL_ASSETS) {
					const response = await fetchPageShellAsset(asset, config);
					if (cache) await cache.put(asset, response.clone());
				}
			}
			async function fetchPageBuildConfig() {
				const response = await fetch(`/api/public-config?buildCheck=${Date.now()}`, {
					cache: "no-store",
					credentials: "same-origin"
				});
				if (!response.ok) return null;
				return response.json();
			}
			async function pruneOldShellCaches(expectedCacheName) {
				if (!expectedCacheName || !("caches" in window)) return;
				const keys = await window.caches.keys();
				await Promise.all(keys.filter((key) => String(key || "").startsWith("codex-mobile-shell-") && key !== expectedCacheName).map((key) => window.caches.delete(key)));
			}
			async function clearAllShellCaches() {
				if (!("caches" in window)) return;
				const keys = await window.caches.keys();
				await Promise.all(keys.filter((key) => String(key || "").startsWith("codex-mobile-shell-")).map((key) => window.caches.delete(key)));
			}
			async function resetPageShellServiceWorker() {
				if (!("serviceWorker" in navigator)) return null;
				const registrations = await navigator.serviceWorker.getRegistrations();
				await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
				state.serviceWorkerRegistration = null;
				const registration = await navigator.serviceWorker.register("/sw.js");
				if (registration && registration.update) await registration.update().catch(() => {});
				state.serviceWorkerRegistration = registration || null;
				return registration || null;
			}
			function pageReloadUrlWithBust() {
				const url = new URL(window.location.href, window.location.origin);
				url.searchParams.set("shellReload", String(Date.now()));
				return url.href;
			}
			function initializePageBuildState(config) {
				state.serverBuildId = CLIENT_BUILD_ID || serverBuildIdFromConfig(config);
				state.serverAssetBuildId = String(config && config.buildId || "").trim();
				const currentServerBuildId = serverBuildIdFromConfig(config);
				if (shouldPromptForServerBuildChange(currentServerBuildId, state.serverBuildId)) {
					state.pageRefreshBuildId = currentServerBuildId;
					state.pageRefreshReason = "build";
					state.pageRefreshAvailable = true;
					state.pageRefreshPreparedConfig = config || null;
					if (isHermesEmbedMode()) {
						requestHermesPluginRefresh("server_build_changed", { force: true });
						return;
					}
				}
				renderPageRefreshPrompt();
			}
			function renderPageRefreshPrompt() {
				const el = $("pageRefreshPrompt");
				if (!el) return;
				const restarting = state.pageRefreshReason === "restart";
				const reconnecting = state.pageRefreshReason === "reconnect" || restarting;
				el.classList.toggle("hidden", !state.pageRefreshAvailable && !state.pageRefreshReloading);
				el.disabled = state.pageRefreshReloading;
				if (state.pageRefreshReloading) el.textContent = restarting ? "Waiting for service, then refreshing..." : reconnecting ? "Refreshing and reconnecting..." : "Refreshing page...";
				else el.textContent = restarting ? "Service restarted. Tap to refresh." : reconnecting ? "Connection changed. Tap to refresh." : "New version available. Tap to refresh.";
				el.title = restarting || reconnecting ? "Manual refresh only; the page will not reload until this button is tapped." : state.pageRefreshBuildId ? `Server version is ${state.pageRefreshBuildId}. Tap to refresh manually.` : "Server page assets changed. Tap to refresh manually.";
				renderHardRefreshButton();
			}
			async function handleHardRefreshClick() {
				if (state.pageRefreshReloading) return;
				state.pageRefreshPreparedConfig = null;
				state.pageRefreshReason = "build";
				state.pageRefreshAvailable = true;
				await refreshPageForNewBuild();
			}
			function showReconnectRefreshPrompt(reason = "reconnect") {
				if (state.pageRefreshReloading) return;
				if (isHermesEmbedMode() && reason !== "restart") return;
				state.pageRefreshAvailable = true;
				state.pageRefreshReason = reason === "restart" ? "restart" : "reconnect";
				state.pageRefreshPreparedConfig = null;
				renderPageRefreshPrompt();
			}
			function codexProfileHasQuotaSnapshot(profile) {
				const quota = profile && typeof profile === "object" ? profile.quota : null;
				if (!quota || typeof quota !== "object") return false;
				if (quota.rateLimits && typeof quota.rateLimits === "object") return true;
				const byModel = quota.rateLimitsByModel;
				return Boolean(byModel && typeof byModel === "object" && Object.keys(byModel).length);
			}
			function codexProfileRestartReadyForCompletion() {
				const targetId = String(state.codexProfileSwitchTargetId || "");
				if (!state.codexProfileRestarting || !targetId) return true;
				if (!state.activeCodexProfileId || targetId !== state.activeCodexProfileId) return false;
				const activeProfile = (Array.isArray(state.codexProfiles) ? state.codexProfiles : []).find((profile) => String(profile && profile.id || "") === targetId);
				if (!activeProfile || !codexProfileHasQuotaSnapshot(activeProfile)) {
					state.codexProfileSwitchStage = "服务已恢复，正在等待目标账号额度刷新...";
					const connection = $("connectionState");
					if (connection) connection.textContent = state.codexProfileSwitchStage;
					renderCodexProfileSettings();
					return false;
				}
				return true;
			}
			function finishRestartingUiIfReady() {
				if (!codexProfileRestartReadyForCompletion()) return false;
				const changed = Boolean(state.codexProfileRestarting || state.sharedRestarting || state.codexProfileSwitchTargetId || state.codexProfileSwitchStage);
				stopCodexProfileSwitchProgressPolling();
				state.codexProfileRestarting = false;
				state.codexProfileSwitchTargetId = "";
				state.codexProfileSwitchStage = "";
				state.codexProfileSwitchRequestId = "";
				state.sharedRestarting = false;
				state.sharedRestartBusy = false;
				if (changed) {
					renderCodexProfileSettings();
					renderSharedRestartButton();
				}
				return changed;
			}
			function clearReconnectRefreshPrompt() {
				if (!(state.pageRefreshReason === "reconnect" || state.pageRefreshReason === "restart") || state.pageRefreshReloading) return;
				state.pageRefreshAvailable = false;
				state.pageRefreshReason = "";
				state.pageRefreshPreparedConfig = null;
				finishRestartingUiIfReady();
				renderPageRefreshPrompt();
			}
			async function checkPageRefreshAvailability(options = {}) {
				if (state.pageRefreshReloading) return;
				const now = Date.now();
				if (state.pageRefreshBusy) return;
				if (!options.force && now - state.pageRefreshLastCheckAt < PAGE_REFRESH_MIN_CHECK_INTERVAL_MS) return;
				state.pageRefreshBusy = true;
				state.pageRefreshLastCheckAt = now;
				try {
					const config = await fetchPageBuildConfig();
					if (!config) return;
					const nextBuildId = serverBuildIdFromConfig(config);
					const nextAssetBuildId = String(config && config.buildId || "").trim();
					if (!state.serverBuildId) {
						state.serverBuildId = CLIENT_BUILD_ID || nextBuildId;
						state.serverAssetBuildId = nextAssetBuildId;
						return;
					}
					const serverBuildNeedsRefresh = Boolean(nextBuildId && nextBuildId !== state.serverBuildId) && shouldPromptForServerBuildChange(nextBuildId, state.serverBuildId);
					if (Boolean(nextAssetBuildId && state.serverAssetBuildId && nextAssetBuildId !== state.serverAssetBuildId) && !serverBuildNeedsRefresh) {
						state.serverAssetBuildId = nextAssetBuildId;
						return;
					}
					if (serverBuildNeedsRefresh) {
						if (isHermesEmbedMode()) {
							state.pageRefreshBuildId = nextBuildId;
							state.pageRefreshPreparedConfig = config;
							requestHermesPluginRefresh("server_build_changed");
							return;
						}
						state.pageRefreshAvailable = true;
						state.pageRefreshReason = "build";
						state.pageRefreshBuildId = nextBuildId;
						state.pageRefreshPreparedConfig = config;
						renderPageRefreshPrompt();
					}
				} catch (_) {} finally {
					state.pageRefreshBusy = false;
				}
			}
			function schedulePageRefreshCheck(delayMs = 0, options = {}) {
				window.setTimeout(() => {
					checkPageRefreshAvailability(options).catch(() => {});
				}, Math.max(0, Number(delayMs || 0)));
			}
			function scheduleVisiblePageRefreshCheck(delayMs = 0, options = {}) {
				if (document.visibilityState === "hidden") return;
				schedulePageRefreshCheck(delayMs, options);
			}
			function startPageRefreshChecks() {
				if (state.pageRefreshTimer) clearInterval(state.pageRefreshTimer);
				state.pageRefreshTimer = window.setInterval(() => {
					if (document.visibilityState === "hidden") return;
					checkPageRefreshAvailability({ silent: true }).catch(() => {});
				}, PAGE_REFRESH_CHECK_INTERVAL_MS);
			}
			async function waitForPageBuildConfig(timeoutMs = 18e3) {
				const startedAt = Date.now();
				let lastError = null;
				while (Date.now() - startedAt < timeoutMs) {
					try {
						const config = await fetchPageBuildConfig();
						if (config) return config;
					} catch (err) {
						lastError = err;
					}
					await new Promise((resolve) => setTimeout(resolve, 900));
				}
				throw lastError || /* @__PURE__ */ new Error("Mobile Web is still unavailable");
			}
			async function refreshPageForNewBuild() {
				if (state.pageRefreshReloading) return;
				state.pageRefreshReloading = true;
				renderPageRefreshPrompt();
				saveCurrentDraftNow();
				let config = state.pageRefreshPreparedConfig;
				try {
					const reconnectRefresh = state.pageRefreshReason === "reconnect" || state.pageRefreshReason === "restart";
					const latestConfig = reconnectRefresh ? await waitForPageBuildConfig() : await fetchPageBuildConfig();
					if (latestConfig) config = latestConfig;
					if (!config) throw new Error("page refresh build config unavailable");
					const nextBuildId = serverBuildIdFromConfig(config);
					const currentBuildId = state.serverBuildId || CLIENT_BUILD_ID || nextBuildId;
					if (reconnectRefresh && !shouldPromptForServerBuildChange(nextBuildId, currentBuildId)) {
						state.serverBuildId = currentBuildId || nextBuildId;
						state.serverAssetBuildId = String(config && config.buildId || state.serverAssetBuildId || "").trim();
						rememberRateLimitsFromConfig(config);
						rememberCodexProfiles(config && config.codexProfiles || null);
						const restartFinished = finishRestartingUiIfReady();
						state.pageRefreshReloading = false;
						state.pageRefreshAvailable = !restartFinished && state.codexProfileRestarting;
						state.pageRefreshReason = state.pageRefreshAvailable ? "restart" : "";
						state.pageRefreshPreparedConfig = null;
						renderPageRefreshPrompt();
						return;
					}
					rememberRateLimitsFromConfig(config);
					rememberCodexProfiles(config && config.codexProfiles || null);
					await clearAllShellCaches();
					if (config) await preparePageShellAssets(config, { populateCache: true });
					await resetPageShellServiceWorker();
					await pruneOldShellCaches(String(config && config.shellCacheName || "").trim());
					window.location.replace(pageReloadUrlWithBust());
				} catch (_) {
					state.pageRefreshReloading = false;
					state.pageRefreshPreparedConfig = null;
					if (state.pageRefreshReason !== "reconnect" && state.pageRefreshReason !== "restart") {
						state.pageRefreshAvailable = false;
						state.pageRefreshReason = "";
					}
					renderPageRefreshPrompt();
				}
			}
			return Object.freeze({
				appVersionText,
				clientBuildVersionText,
				renderAppUpdateStatus,
				refreshAppUpdateStatus,
				currentUpdateUsesPublicRelease,
				updateStatusLine,
				publicReleaseStatusLine,
				updateActionButton,
				publicPrHasOpenPullRequests,
				renderUpdatePanel,
				refreshPublicReleaseStatus,
				openUpdatePanel,
				closeUpdatePanel,
				handleUpdatePanelClick,
				scheduleStartupUpdateCheck,
				publicPrPromptKey,
				publicPrSummaryText,
				normalizedPublicPrReviewTitle,
				publicPrReviewThreadTitle,
				findPublicPrReviewThread,
				workspacePathBaseName,
				workspacePathIsVisible,
				visibleWorkspaceWithBaseName,
				publicPrReviewWorkspacePath,
				openPublicPrReviewThreadIfAvailable,
				renderPublicPrStatus,
				refreshPublicPrStatus,
				scheduleStartupPublicPrCheck,
				publicPrMergeInstruction,
				publicPrMergeConfirmationMessage,
				preparePublicPrMergePrompt,
				rememberPublicPrPrompt,
				maybePromptPublicPrMerge,
				handlePublicPrStatusClick,
				handleAppUpdateClick,
				renderSharedRestartButton,
				renderHardRefreshButton,
				markBootReady,
				reportShellLoaded,
				sharedRestartScopeLines,
				restartRiskThreads,
				fetchRestartRiskThreads,
				restartRiskThreadTitle,
				restartRiskThreadMeta,
				renderSharedRestartDialog,
				closeSharedRestartDialog,
				requestSharedRestartConfirmation,
				handleSharedRestartClick,
				serverBuildIdFromConfig,
				shouldPromptForServerBuildChange,
				pageShellAssetUrl,
				validatePageShellAsset,
				fetchPageShellAsset,
				preparePageShellAssets,
				fetchPageBuildConfig,
				pruneOldShellCaches,
				clearAllShellCaches,
				resetPageShellServiceWorker,
				pageReloadUrlWithBust,
				initializePageBuildState,
				renderPageRefreshPrompt,
				handleHardRefreshClick,
				showReconnectRefreshPrompt,
				finishRestartingUiIfReady,
				clearReconnectRefreshPrompt,
				checkPageRefreshAvailability,
				schedulePageRefreshCheck,
				scheduleVisiblePageRefreshCheck,
				startPageRefreshChecks,
				waitForPageBuildConfig,
				refreshPageForNewBuild
			});
		}
		root.CodexAppUpdateRuntime = Object.freeze({ createAppUpdateRuntime });
		if (typeof module !== "undefined" && module.exports) module.exports = { createAppUpdateRuntime };
	})(typeof window !== "undefined" ? window : globalThis);
}));
//#endregion
//#region public/modal-runtime.js
var require_modal_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function renderAppNativeDialog() {
		const dialog = $("appNativeDialog");
		const title = $("appNativeDialogTitle");
		const message = $("appNativeDialogMessage");
		const input = $("appNativeDialogInput");
		const actions = $("appNativeDialogActions");
		const cancel = $("appNativeDialogCancel");
		const proceed = $("appNativeDialogProceed");
		if (!dialog || !title || !message || !input || !actions || !cancel || !proceed) return;
		const open = Boolean(state.appNativeDialogOpen);
		const promptMode = state.appNativeDialogMode === "prompt";
		const alertMode = state.appNativeDialogMode === "alert";
		dialog.classList.toggle("hidden", !open);
		title.textContent = state.appNativeDialogTitle || "提示";
		message.textContent = state.appNativeDialogMessage || "";
		input.classList.toggle("hidden", !open || !promptMode);
		input.value = promptMode ? state.appNativeDialogValue || "" : "";
		input.placeholder = promptMode ? state.appNativeDialogPlaceholder || "" : "";
		input.rows = Math.max(2, Math.min(10, Number(state.appNativeDialogRows) || 4));
		cancel.hidden = alertMode;
		actions.classList.toggle("single", alertMode);
		cancel.textContent = state.appNativeDialogCancelLabel || "取消";
		proceed.textContent = state.appNativeDialogConfirmLabel || (alertMode ? "知道了" : "确定");
		if (open) window.setTimeout(() => {
			const focusTarget = promptMode ? input : proceed;
			if (focusTarget && typeof focusTarget.focus === "function") try {
				focusTarget.focus({ preventScroll: true });
			} catch (_) {
				focusTarget.focus();
			}
		}, 0);
	}
	function closeAppNativeDialog(confirmed = false) {
		const resolve = state.appNativeDialogResolve;
		const mode = state.appNativeDialogMode;
		const input = $("appNativeDialogInput");
		const value = input ? input.value : state.appNativeDialogValue;
		state.appNativeDialogOpen = false;
		state.appNativeDialogMode = "alert";
		state.appNativeDialogTitle = "提示";
		state.appNativeDialogMessage = "";
		state.appNativeDialogValue = "";
		state.appNativeDialogPlaceholder = "";
		state.appNativeDialogConfirmLabel = "确定";
		state.appNativeDialogCancelLabel = "取消";
		state.appNativeDialogRows = 4;
		state.appNativeDialogResolve = null;
		renderAppNativeDialog();
		if (!resolve) return;
		if (mode === "prompt") {
			resolve(confirmed ? value : null);
			return;
		}
		if (mode === "confirm") {
			resolve(Boolean(confirmed));
			return;
		}
		resolve(void 0);
	}
	function requestAppNativeDialog(options = {}) {
		if (state.appNativeDialogResolve) closeAppNativeDialog(false);
		const mode = [
			"alert",
			"confirm",
			"prompt"
		].includes(options.mode) ? options.mode : "alert";
		state.appNativeDialogOpen = true;
		state.appNativeDialogMode = mode;
		state.appNativeDialogTitle = String(options.title || "提示");
		state.appNativeDialogMessage = String(options.message || "");
		state.appNativeDialogValue = String(options.value || "");
		state.appNativeDialogPlaceholder = String(options.placeholder || "");
		state.appNativeDialogConfirmLabel = String(options.confirmLabel || (mode === "alert" ? "知道了" : "确定"));
		state.appNativeDialogCancelLabel = String(options.cancelLabel || "取消");
		state.appNativeDialogRows = Math.max(2, Math.min(10, Number(options.rows) || 4));
		renderAppNativeDialog();
		return new Promise((resolve) => {
			state.appNativeDialogResolve = resolve;
		});
	}
	function requestAppAlert(message, options = {}) {
		return requestAppNativeDialog(Object.assign({}, options, {
			mode: "alert",
			message,
			title: options.title || "提示",
			confirmLabel: options.confirmLabel || "知道了"
		}));
	}
	function requestAppConfirmation(message, options = {}) {
		return requestAppNativeDialog(Object.assign({}, options, {
			mode: "confirm",
			message,
			title: options.title || "确认操作"
		}));
	}
	function requestAppTextInput(message, value = "", options = {}) {
		return requestAppNativeDialog(Object.assign({}, options, {
			mode: "prompt",
			message,
			value,
			title: options.title || "输入内容"
		}));
	}
	function handleAppNativeDialogKeydown(event) {
		if (!state.appNativeDialogOpen) return;
		if (event.key === "Escape") {
			event.preventDefault();
			closeAppNativeDialog(false);
			return;
		}
		if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
			event.preventDefault();
			closeAppNativeDialog(true);
		}
	}
	function renderCodexProfileSwitchDialog() {
		const dialog = $("profileSwitchConfirmDialog");
		const subtitle = $("profileSwitchConfirmSubtitle");
		if (!dialog || !subtitle) return;
		dialog.classList.toggle("hidden", !state.profileSwitchConfirmOpen);
		subtitle.textContent = state.profileSwitchConfirmOpen ? `目标账号：${state.profileSwitchConfirmLabel || state.profileSwitchConfirmTargetId || "--"}` : "";
	}
	function closeCodexProfileSwitchDialog(confirmed = false) {
		const resolve = state.profileSwitchConfirmResolve;
		state.profileSwitchConfirmOpen = false;
		state.profileSwitchConfirmTargetId = "";
		state.profileSwitchConfirmLabel = "";
		state.profileSwitchConfirmResolve = null;
		renderCodexProfileSwitchDialog();
		if (resolve) resolve(Boolean(confirmed));
	}
	function requestCodexProfileSwitchConfirmation(profileId, label) {
		if (state.profileSwitchConfirmResolve) closeCodexProfileSwitchDialog(false);
		state.profileSwitchConfirmOpen = true;
		state.profileSwitchConfirmTargetId = String(profileId || "");
		state.profileSwitchConfirmLabel = String(label || profileId || "");
		renderCodexProfileSwitchDialog();
		return new Promise((resolve) => {
			state.profileSwitchConfirmResolve = resolve;
		});
	}
	function codexProfileSwitchStageLabel(stageId, fallback = "") {
		const id = String(stageId || "");
		const stage = CODEX_PROFILE_SWITCH_STAGES.find((item) => item.id === id);
		return stage ? stage.label : String(fallback || id || "");
	}
	function formatCodexProfileSwitchProgress(progress = {}) {
		const input = progress && typeof progress === "object" ? progress : {};
		const fallback = codexProfileSwitchStageLabel(input.stage, "正在切换 Profile");
		const message = String(input.message || fallback || "").trim();
		const stepIndex = Number(input.stepIndex || 0);
		const stepCount = Number(input.stepCount || 0);
		if (message && stepIndex > 0 && stepCount > 0) return `${stepIndex}/${stepCount} ${message}`;
		return message || "正在切换 Profile...";
	}
	function setCodexProfileSwitchStage(progress) {
		const text = typeof progress === "string" ? progress : formatCodexProfileSwitchProgress(progress);
		state.codexProfileSwitchStage = text;
		const connection = $("connectionState");
		if (connection) connection.textContent = text;
		renderCodexProfileSettings();
	}
	function clearCodexProfileSwitchStageTimers() {
		for (const timer of state.codexProfileSwitchStageTimers || []) window.clearTimeout(timer);
		state.codexProfileSwitchStageTimers = [];
	}
	function stopCodexProfileSwitchProgressPolling() {
		clearCodexProfileSwitchStageTimers();
		if (state.codexProfileSwitchProgressTimer) {
			window.clearTimeout(state.codexProfileSwitchProgressTimer);
			state.codexProfileSwitchProgressTimer = null;
		}
	}
	function startCodexProfileSwitchProgressPolling(requestId) {
		const id = String(requestId || "").trim();
		stopCodexProfileSwitchProgressPolling();
		if (!id) return;
		const poll = async () => {
			if (!state.codexProfileSwitchBusy || state.codexProfileSwitchRequestId !== id) return;
			try {
				const result = await api(`/api/codex-profiles/switch-progress?requestId=${encodeURIComponent(id)}`, { timeoutMs: 5e3 });
				if (result && result.progress) {
					setCodexProfileSwitchStage(result.progress);
					const status = String(result.progress.status || "");
					if (status === "failed" || status === "restarting" || status === "complete") return;
				}
			} catch (_) {}
			if (state.codexProfileSwitchBusy && state.codexProfileSwitchRequestId === id) state.codexProfileSwitchProgressTimer = window.setTimeout(poll, 700);
		};
		state.codexProfileSwitchProgressTimer = window.setTimeout(poll, 250);
	}
	async function performCodexProfileSwitch(profileId) {
		const requestId = createSubmissionId();
		let switchAccepted = false;
		state.codexProfileSwitchBusy = true;
		state.codexProfileSwitchTargetId = profileId;
		state.codexProfileSwitchRequestId = requestId;
		clearStoredRateLimits();
		setCodexProfileSwitchStage({
			stage: "profile_lookup",
			message: "正在读取目标 Profile...",
			stepIndex: 1,
			stepCount: 10
		});
		startCodexProfileSwitchProgressPolling(requestId);
		try {
			const result = await api("/api/codex-profiles/active", {
				method: "POST",
				body: JSON.stringify({
					profileId,
					requestId
				}),
				timeoutMs: 9e4
			});
			stopCodexProfileSwitchProgressPolling();
			setCodexProfileSwitchStage(result && result.progress ? result.progress : {
				stage: "waiting_for_restart",
				message: "切换已写入，正在等待服务恢复...",
				stepIndex: 10,
				stepCount: 10
			});
			state.codexProfileRestarting = true;
			switchAccepted = true;
			showReconnectRefreshPrompt("restart");
		} catch (err) {
			stopCodexProfileSwitchProgressPolling();
			let showedProgress = false;
			try {
				const progressResult = await api(`/api/codex-profiles/switch-progress?requestId=${encodeURIComponent(requestId)}`, { timeoutMs: 5e3 });
				if (progressResult && progressResult.progress) {
					setCodexProfileSwitchStage(progressResult.progress);
					showedProgress = true;
				}
			} catch (_) {}
			if (err && err.progress) {
				setCodexProfileSwitchStage(err.progress);
				showedProgress = true;
			}
			if (!showedProgress) setCodexProfileSwitchStage(`切换失败：${err.message || "Codex profile switch failed"}`);
			const connection = $("connectionState");
			if (connection) connection.textContent = state.codexProfileSwitchStage || err.message || "Codex profile switch failed";
			showError(err);
		} finally {
			state.codexProfileSwitchBusy = false;
			if (!state.codexProfileRestarting && switchAccepted) {
				state.codexProfileSwitchTargetId = "";
				state.codexProfileSwitchStage = "";
				state.codexProfileSwitchRequestId = "";
			}
			renderCodexProfileSettings();
		}
	}
	function createModalRuntime() {
		return {
			requestAppNativeDialog: typeof requestAppNativeDialog === "function" ? requestAppNativeDialog : null,
			requestAppAlert: typeof requestAppAlert === "function" ? requestAppAlert : null,
			requestAppConfirmation: typeof requestAppConfirmation === "function" ? requestAppConfirmation : null,
			requestAppTextInput: typeof requestAppTextInput === "function" ? requestAppTextInput : null,
			requestCodexProfileSwitchConfirmation: typeof requestCodexProfileSwitchConfirmation === "function" ? requestCodexProfileSwitchConfirmation : null
		};
	}
	(function exposeCodexModalRuntime(root) {
		const modalRuntimeApi = { createModalRuntime };
		if (typeof module === "object" && module.exports) module.exports = modalRuntimeApi;
		Object.assign(root, {
			renderAppNativeDialog,
			closeAppNativeDialog,
			requestAppNativeDialog,
			requestAppAlert,
			requestAppConfirmation,
			requestAppTextInput,
			handleAppNativeDialogKeydown,
			renderCodexProfileSwitchDialog,
			closeCodexProfileSwitchDialog,
			requestCodexProfileSwitchConfirmation,
			codexProfileSwitchStageLabel,
			formatCodexProfileSwitchProgress,
			setCodexProfileSwitchStage,
			clearCodexProfileSwitchStageTimers,
			stopCodexProfileSwitchProgressPolling,
			startCodexProfileSwitchProgressPolling,
			performCodexProfileSwitch
		});
		root.CodexModalRuntime = modalRuntimeApi;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
//#region public/runtime-wiring-runtime.js
var require_runtime_wiring_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function initializeThreadDetailRuntimeWiring() {
		if (threadDetailRuntime) return threadDetailRuntime;
		threadDetailRuntime = threadDetailRuntimeApi.createThreadDetailRuntime({
			state,
			MAX_EXPANDED_VISIBLE_TURNS,
			MAX_RAW_THREAD_VISIBLE_ITEMS_PER_TURN,
			threadDetailStateApi,
			threadDetailMergeStateApi,
			threadDetailV4MergeStateApi,
			statusText,
			normalizeFsPath,
			imageUrlValue,
			isInputTextPart,
			inputTextValue,
			isInputImagePart,
			splitAttachmentSummaryText,
			canRenderImageAttachment,
			truncateMiddle,
			isLiveTurn,
			isLatestTurn,
			latestTurnForThread,
			isLiveTurnForThread,
			isActiveOperationalItem,
			isReasoningItem,
			isOperationalItem,
			isContextCompactionItem,
			contextCompactionNotice,
			operationCommandText,
			operationDetailText,
			imageViewPath,
			imageViewContentUrl,
			imageViewUrl,
			isTurnComplete,
			isRunningStatus,
			isIncompleteInterruptedTurn,
			turnHasActiveLiveItems,
			isRecentlySubmittedUserMessage,
			sortTurnsForDisplay,
			maxVisibleTurnsForThread,
			numericTimestampMs,
			renderContextThread
		});
		return threadDetailRuntime;
	}
	function initializeComposerRuntimeWiring() {
		if (composerRuntime) return composerRuntime;
		composerRuntime = composerRuntimeApi.createComposerRuntime({
			$,
			COMPOSER_INTENT_BODY_MAX_CHARS,
			MESSAGE_INPUT_MAX_HEIGHT_PX,
			MESSAGE_INPUT_MIN_HEIGHT_PX,
			STORAGE_CODEX_FAST_MODE,
			STORAGE_COMPOSER_INTENT_DRAFTS,
			THREAD_GOAL_MENTION_PATTERN,
			THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN,
			THREAD_TASK_CARD_MENTION_PATTERN,
			api,
			clearDraftForKey,
			clearSubmittedMessageBottomFollow,
			closeThreadGoalDialog,
			commitPluginVoiceInputSessionsAfterSend,
			composerTargetThread,
			composerTargetActiveTurnId,
			connectEvents,
			createSubmissionId,
			currentComposerThreadId,
			currentDraftKey,
			defaultNewThreadEffort,
			defaultNewThreadModel,
			defaultNewThreadPermissionMode,
			deleteDraftAttachments,
			diagnosticErrorCode,
			diagnosticErrorStatus,
			diagnosticTaskHash,
			diagnosticThreadHash,
			document,
			draftKeyForThread,
			effectiveComposerPermissionMode,
			escapeHtml,
			followSubmittedMessageToBottom,
			homeAiDiagnosticReportingApi,
			imageCompressor,
			insertLocalSubmittedUserMessage,
			isAndroidBrowser,
			isChatGptProCommandText,
			isHermesEmbedMode,
			isKeyboardEditableElement,
			isThreadGoalCommandText,
			isThreadTaskCardCommandText,
			isThreadTileComposerContext,
			labelForEffort,
			labelForModel,
			labelForPermissionMode,
			loadJsonStorage,
			loadThread,
			loadThreads,
			localAttachmentPreviewUrl,
			localStorage,
			markActivity,
			markSubmittedUserMessageFailed,
			markThreadOptimisticallyActive,
			mergeItemsPreservingLocalVisible,
			newThreadSelectedEffort,
			newThreadSelectedModel,
			newThreadSelectedPermissionMode,
			normalizeOptionList,
			normalizeThreadGoal,
			openThreadGoalDialog,
			postClientEvent,
			publishPluginVoiceInputCapability,
			reconcileSubmittedUserMessageTurn,
			recordHomeAiDiagnosticFailure,
			renderCurrentThread,
			renderQuotaUsage,
			renderThreads,
			replacePendingAttachments,
			restoreThreadStatusSnapshot,
			saveCurrentDraftNow,
			saveDraftAttachmentFiles,
			scheduleComposerTargetRefresh,
			scheduleCurrentDraftSave,
			scheduleCurrentThreadRefresh,
			scheduleLivePollIfNeeded,
			scheduleScrollToBottomButtonUpdate,
			scheduleSubmittedMessageDomProbe,
			selectedQuotaModel,
			setComposerActionButtonLabel,
			setSteerFeedback,
			setThreadGoalDialogBusy,
			showComposerFastHint,
			showError,
			snapshotThreadStatus,
			startedTurnId,
			state,
			submitChatGptProRequest,
			submittedThreadGoal,
			threadDisplayName,
			threadTaskCardCommandText,
			threadTileStatePolicy,
			updateThreadGoalState,
			viewportMetrics,
			viewportState,
			window,
			writeCurrentDraftToKey
		});
		return composerRuntime;
	}
	function initializeThreadListRuntimeWiring() {
		if (threadListRuntime) return threadListRuntime;
		threadListRuntime = window.CodexThreadListRuntime.createThreadListRuntime({
			state,
			$,
			api,
			document,
			window,
			localStorage,
			setTimeout,
			clearTimeout,
			THREAD_LIST_PAGE_LIMIT,
			THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS,
			THREAD_LIST_DEFERRED_FALLBACK_RETRY_MS,
			THREAD_LIST_SLOW_PATH_MS,
			STORAGE_THREAD_ID,
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
			rolloutSizeBytes
		});
		return threadListRuntime;
	}
	function initializeThreadTileRuntimeWiring() {
		if (threadTileRuntime) return threadTileRuntime;
		threadTileRuntime = threadTileRuntimeApi.createThreadTileRuntime({
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
			escapeHtml
		});
		return threadTileRuntime;
	}
	function initializeCodexMobileRuntimeWiring() {
		initializeThreadDetailRuntimeWiring();
		initializeComposerRuntimeWiring();
		initializeThreadListRuntimeWiring();
		initializeThreadTileRuntimeWiring();
	}
	function createRuntimeWiringRuntime() {
		return { initialize: initializeCodexMobileRuntimeWiring };
	}
	(function exposeCodexRuntimeWiringRuntime(root) {
		const runtimeWiringApi = { createRuntimeWiringRuntime };
		if (typeof module === "object" && module.exports) module.exports = runtimeWiringApi;
		root.CodexRuntimeWiringRuntime = runtimeWiringApi;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
//#region public/app-shell-runtime.js
var require_app_shell_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function wireUi() {
		$("loginForm").addEventListener("submit", (event) => {
			event.preventDefault();
			login($("loginKey").value.trim()).catch((err) => showLogin(err.message));
		});
		const sidebarWorkspaceSelect = $("workspaceSelect");
		const sidebarWorkspaceMenu = $("workspaceSelectMenu");
		if (sidebarWorkspaceSelect && sidebarWorkspaceMenu) {
			const closeSidebarWorkspaceMenu = () => {
				sidebarWorkspaceMenu.hidden = true;
				sidebarWorkspaceMenu.style.removeProperty("--workspace-menu-max-height");
				sidebarWorkspaceSelect.setAttribute("aria-expanded", "false");
				document.removeEventListener("pointerdown", onSidebarWorkspaceOutsidePointer);
			};
			const onSidebarWorkspaceOption = (event) => {
				if (event.target.closest("[data-create-workspace]")) {
					event.preventDefault();
					event.stopPropagation();
					closeSidebarWorkspaceMenu();
					openCreateWorkspaceDialog();
					return;
				}
				const option = event.target.closest("[data-workspace-value]");
				if (!option) return;
				const selectedWorkspace = option.dataset.workspaceValue || "";
				event.preventDefault();
				event.stopPropagation();
				selectWorkspaceShortcut(selectedWorkspace).catch(showError);
				closeSidebarWorkspaceMenu();
			};
			const onSidebarWorkspaceOutsidePointer = (event) => {
				if (!sidebarWorkspaceMenu.hidden && !sidebarWorkspaceMenu.contains(event.target) && !sidebarWorkspaceSelect.contains(event.target)) closeSidebarWorkspaceMenu();
			};
			const openSidebarWorkspaceMenu = () => {
				sidebarWorkspaceMenu.hidden = false;
				fitWorkspaceMenuToViewport(sidebarWorkspaceMenu, sidebarWorkspaceSelect, { avoidComposer: false });
				sidebarWorkspaceSelect.setAttribute("aria-expanded", "true");
				document.addEventListener("pointerdown", onSidebarWorkspaceOutsidePointer);
			};
			const toggleSidebarWorkspaceMenu = (event) => {
				event.preventDefault();
				event.stopPropagation();
				if (sidebarWorkspaceSelect.disabled) return;
				if (sidebarWorkspaceMenu.hidden) openSidebarWorkspaceMenu();
				else closeSidebarWorkspaceMenu();
			};
			sidebarWorkspaceSelect.addEventListener("pointerdown", toggleSidebarWorkspaceMenu);
			sidebarWorkspaceMenu.addEventListener("click", onSidebarWorkspaceOption);
			closeSidebarWorkspaceMenu();
		}
		const workspaceTokenUsage = $("workspaceTokenUsage");
		if (workspaceTokenUsage) workspaceTokenUsage.addEventListener("click", (event) => {
			if (!(event.target && event.target.closest("[data-workspace-token-usage-toggle]"))) return;
			openWorkspaceStatsDialog();
		});
		const workspaceStatsClose = $("workspaceStatsClose");
		if (workspaceStatsClose) workspaceStatsClose.addEventListener("click", closeWorkspaceStatsDialog);
		const workspaceStatsDialog = $("workspaceStatsDialog");
		if (workspaceStatsDialog) workspaceStatsDialog.addEventListener("click", (event) => {
			if (event.target === workspaceStatsDialog) closeWorkspaceStatsDialog();
		});
		$("newThreadButton").addEventListener("click", enterNewThreadDraft);
		$("refreshThreads").addEventListener("click", () => loadThreads().catch(showError));
		$("pushNotifications").addEventListener("click", () => handlePushButtonClick().catch(showError));
		if ($("appUpdateStatus")) $("appUpdateStatus").addEventListener("click", openUpdatePanel);
		if ($("publicPrStatus")) $("publicPrStatus").addEventListener("click", () => handlePublicPrStatusClick().catch(showError));
		if ($("updateDialogClose")) $("updateDialogClose").addEventListener("click", closeUpdatePanel);
		if ($("updatePanelContent")) $("updatePanelContent").addEventListener("click", handleUpdatePanelClick);
		if ($("updateDialog")) $("updateDialog").addEventListener("click", (event) => {
			if (event.target === $("updateDialog")) closeUpdatePanel();
		});
		if ($("hardRefreshButton")) $("hardRefreshButton").addEventListener("click", () => handleHardRefreshClick().catch(showError));
		if ($("sharedRestartButton")) $("sharedRestartButton").addEventListener("click", () => handleSharedRestartClick().catch(showError));
		if ($("restartConfirmCancel")) $("restartConfirmCancel").addEventListener("click", () => closeSharedRestartDialog(false));
		if ($("restartConfirmProceed")) $("restartConfirmProceed").addEventListener("click", () => closeSharedRestartDialog(true));
		if ($("restartConfirmDialog")) $("restartConfirmDialog").addEventListener("click", (event) => {
			if (event.target === $("restartConfirmDialog")) closeSharedRestartDialog(false);
		});
		if ($("profileSwitchConfirmCancel")) $("profileSwitchConfirmCancel").addEventListener("click", () => closeCodexProfileSwitchDialog(false));
		if ($("profileSwitchConfirmProceed")) $("profileSwitchConfirmProceed").addEventListener("click", () => closeCodexProfileSwitchDialog(true));
		if ($("profileSwitchConfirmDialog")) $("profileSwitchConfirmDialog").addEventListener("click", (event) => {
			if (event.target === $("profileSwitchConfirmDialog")) closeCodexProfileSwitchDialog(false);
		});
		if ($("threadArchiveConfirmCancel")) $("threadArchiveConfirmCancel").addEventListener("click", () => closeThreadArchiveDialog(false));
		if ($("threadArchiveConfirmProceed")) $("threadArchiveConfirmProceed").addEventListener("click", () => closeThreadArchiveDialog(true));
		if ($("threadArchiveConfirmDialog")) $("threadArchiveConfirmDialog").addEventListener("click", (event) => {
			if (event.target === $("threadArchiveConfirmDialog")) closeThreadArchiveDialog(false);
		});
		if ($("appNativeDialogCancel")) $("appNativeDialogCancel").addEventListener("click", () => closeAppNativeDialog(false));
		if ($("appNativeDialogProceed")) $("appNativeDialogProceed").addEventListener("click", () => closeAppNativeDialog(true));
		if ($("appNativeDialog")) {
			$("appNativeDialog").addEventListener("click", (event) => {
				if (event.target === $("appNativeDialog")) closeAppNativeDialog(false);
			});
			$("appNativeDialog").addEventListener("keydown", handleAppNativeDialogKeydown);
		}
		if ($("goalForm")) $("goalForm").addEventListener("submit", (event) => submitThreadGoalMessage(event).catch(showError));
		if ($("goalObjectiveInput")) $("goalObjectiveInput").addEventListener("keydown", requestGoalDialogSubmitFromEnter);
		if ($("goalTokenBudgetInput")) $("goalTokenBudgetInput").addEventListener("keydown", requestGoalDialogSubmitFromEnter);
		if ($("goalSubmitButton")) $("goalSubmitButton").addEventListener("pointerdown", requestGoalDialogSubmitFromButton);
		if ($("goalSubmitButton")) $("goalSubmitButton").addEventListener("pointerup", requestGoalDialogSubmitFromButton);
		if ($("goalSubmitButton")) $("goalSubmitButton").addEventListener("touchend", requestGoalDialogSubmitFromButton, { passive: false });
		if ($("goalSubmitButton")) $("goalSubmitButton").addEventListener("click", requestGoalDialogSubmitFromButton);
		if ($("goalContinueButton")) $("goalContinueButton").addEventListener("click", (event) => runThreadGoalDialogAction("continue", event).catch(showError));
		if ($("goalPauseButton")) $("goalPauseButton").addEventListener("click", (event) => runThreadGoalDialogAction("pause", event).catch(showError));
		if ($("goalClearButton")) $("goalClearButton").addEventListener("click", (event) => runThreadGoalDialogAction("cancel", event).catch(showError));
		if ($("goalCancelButton")) $("goalCancelButton").addEventListener("click", () => closeThreadGoalDialog(false));
		if ($("goalDialogClose")) $("goalDialogClose").addEventListener("click", () => closeThreadGoalDialog(false));
		if ($("goalDialog")) $("goalDialog").addEventListener("click", (event) => {
			if (event.target === $("goalDialog")) closeThreadGoalDialog(false);
		});
		if ($("themeSettingsToggle")) $("themeSettingsToggle").addEventListener("click", () => {
			loadCodexProfiles().catch(showError);
			setTimeout(() => publishPluginNavigationState({ force: true }), 0);
		});
		const settingsPanel = $("themeSettingsPanel");
		if (settingsPanel) {
			settingsPanel.addEventListener("click", handleFontSizeChoice);
			settingsPanel.addEventListener("click", handleThreadTileModeChoice);
			settingsPanel.addEventListener("click", (event) => handleCodexProfileSettingsClick(event).catch(showError));
			settingsPanel.addEventListener("click", (event) => handleWorkspaceDelegationSettingsClick(event).catch(showError));
		}
		const commandControl = $("composerCommandControl");
		if (commandControl) {
			let lastFastToggleAt = 0;
			let suppressSyntheticFastToggleUntil = 0;
			const handleFastToggle = (event) => {
				event.preventDefault();
				event.stopPropagation();
				const now = Date.now();
				const eventType = String(event.type || "");
				if ((eventType === "click" || eventType === "touchend") && now < suppressSyntheticFastToggleUntil) return;
				if (now - lastFastToggleAt < 650) return;
				lastFastToggleAt = now;
				if (eventType === "pointerdown") suppressSyntheticFastToggleUntil = now + 2200;
				if (commandControl.disabled) return;
				closeComposerRuntimeMenu();
				setCodexFastCommandEnabled(!codexFastCommandEnabled());
			};
			commandControl.addEventListener("pointerdown", handleFastToggle);
			commandControl.addEventListener("click", handleFastToggle);
			commandControl.addEventListener("touchend", handleFastToggle, { passive: false });
		}
		for (const [id, kind] of [
			["composerModelControl", "model"],
			["composerEffortControl", "effort"],
			["composerPermissionControl", "permission"]
		]) {
			const button = $(id);
			if (!button) continue;
			button.dataset.composerRuntime = kind;
			button.addEventListener("pointerdown", (event) => {
				state.lastComposerRuntimePointerAt = Date.now();
				state.lastComposerRuntimePointerKind = kind;
				state.lastComposerRuntimePointerTarget = button;
				handleComposerRuntimeControl(event, kind, button);
			});
			button.addEventListener("click", (event) => {
				if (state.lastComposerRuntimePointerTarget === button && state.lastComposerRuntimePointerKind === kind && Date.now() - state.lastComposerRuntimePointerAt < 1500) {
					state.lastComposerRuntimePointerAt = 0;
					state.lastComposerRuntimePointerKind = "";
					state.lastComposerRuntimePointerTarget = null;
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				handleComposerRuntimeControl(event, kind, button);
			});
		}
		const runtimeMenu = $("composerRuntimeMenu");
		if (runtimeMenu) runtimeMenu.addEventListener("click", (event) => {
			const option = event.target.closest("[data-runtime-kind][data-runtime-value]");
			if (!option) return;
			event.preventDefault();
			event.stopPropagation();
			applyRuntimeSelection(option.dataset.runtimeKind, option.dataset.runtimeValue);
		});
		const intentMenu = $("composerIntentMenu");
		if (intentMenu) intentMenu.addEventListener("click", (event) => {
			const option = event.target.closest("[data-composer-intent]");
			if (!option) return;
			event.preventDefault();
			event.stopPropagation();
			selectComposerIntent(option.dataset.composerIntent || "");
		});
		if ($("composerIntentForm")) $("composerIntentForm").addEventListener("submit", (event) => submitComposerIntentDialog(event).catch(showError));
		if ($("composerIntentSaveButton")) $("composerIntentSaveButton").addEventListener("click", saveComposerIntentDialogDraft);
		if ($("composerIntentCancelButton")) $("composerIntentCancelButton").addEventListener("click", () => closeComposerIntentDialog(false));
		if ($("composerIntentDialogClose")) $("composerIntentDialogClose").addEventListener("click", () => closeComposerIntentDialog(false));
		if ($("composerIntentDialog")) $("composerIntentDialog").addEventListener("click", (event) => {
			if (event.target === $("composerIntentDialog")) closeComposerIntentDialog(false);
		});
		const quotaUsage = $("quotaUsage");
		if (quotaUsage) quotaUsage.addEventListener("pointerdown", (event) => {
			event.preventDefault();
			event.stopPropagation();
			toggleQuotaDetails(quotaUsage);
		});
		document.addEventListener("pointerdown", primeCompletionAudio, { passive: true });
		document.addEventListener("touchend", primeCompletionAudio, { passive: true });
		document.addEventListener("keydown", primeCompletionAudio);
		$("threadSearch").addEventListener("input", () => {
			clearTimeout(state.searchTimer);
			state.searchTimer = setTimeout(() => loadThreads().catch(showError), 250);
		});
		$("threadList").addEventListener("pointerdown", beginThreadLongPress);
		$("threadList").addEventListener("pointermove", moveThreadLongPressPointer, { passive: true });
		$("threadList").addEventListener("pointerup", cancelThreadLongPress);
		$("threadList").addEventListener("pointercancel", cancelThreadLongPress);
		$("threadList").addEventListener("touchstart", beginThreadLongPressTouch, { passive: true });
		$("threadList").addEventListener("touchmove", moveThreadLongPressTouch, { passive: true });
		$("threadList").addEventListener("touchend", cancelThreadLongPress, { passive: true });
		$("threadList").addEventListener("touchcancel", cancelThreadLongPress, { passive: true });
		$("threadList").addEventListener("contextmenu", handleThreadListContextMenu);
		if ($("threadActionSheet")) $("threadActionSheet").addEventListener("click", handleThreadAction);
		if ($("continuationConfirm")) $("continuationConfirm").addEventListener("click", confirmContinuationDialog);
		if ($("continuationCancel")) $("continuationCancel").addEventListener("click", closeContinuationDialog);
		if ($("continuationDialog")) $("continuationDialog").addEventListener("click", (event) => {
			if (event.target === $("continuationDialog")) closeContinuationDialog();
		});
		if ($("renameForm")) $("renameForm").addEventListener("submit", submitRename);
		if ($("renameCancel")) $("renameCancel").addEventListener("click", closeRenameDialog);
		if ($("renameDialog")) $("renameDialog").addEventListener("click", (event) => {
			if (event.target === $("renameDialog")) closeRenameDialog();
		});
		if ($("createWorkspaceForm")) $("createWorkspaceForm").addEventListener("submit", submitCreateWorkspace);
		if ($("createWorkspaceCancel")) $("createWorkspaceCancel").addEventListener("click", closeCreateWorkspaceDialog);
		if ($("createWorkspaceDialog")) $("createWorkspaceDialog").addEventListener("click", (event) => {
			if (event.target === $("createWorkspaceDialog")) closeCreateWorkspaceDialog();
		});
		document.addEventListener("touchstart", beginSidebarEdgeSwipe, { passive: false });
		document.addEventListener("touchmove", moveSidebarEdgeSwipe, { passive: false });
		document.addEventListener("touchend", finishSidebarEdgeSwipe, { passive: true });
		document.addEventListener("touchcancel", cancelSidebarEdgeSwipe, { passive: true });
		window.addEventListener("popstate", handleAndroidBackToSidebarPopState);
		ensureAndroidBackToSidebarSentinel();
		$("openMenu").addEventListener("click", handleOpenMenuClick);
		window.addEventListener("resize", syncThreadDetailLayoutState);
		window.addEventListener("orientationchange", syncThreadDetailLayoutState);
		$("closeMenu").addEventListener("click", closeSidebarMenu);
		const pageRefreshPrompt = $("pageRefreshPrompt");
		if (pageRefreshPrompt) pageRefreshPrompt.addEventListener("click", refreshPageForNewBuild);
		$("composer").addEventListener("submit", sendMessage);
		const sendButton = $("sendMessage");
		sendButton.addEventListener("pointerdown", handlePluginVoiceInputSendPointerDown);
		sendButton.addEventListener("pointerup", handlePluginVoiceInputSendPointerUp);
		sendButton.addEventListener("pointercancel", handlePluginVoiceInputSendPointerCancel);
		sendButton.addEventListener("contextmenu", (event) => {
			if (!state.pluginVoiceInputPress) return;
			event.preventDefault();
		});
		sendButton.addEventListener("click", handlePluginVoiceInputSendClick);
		sendButton.addEventListener("pointerup", requestComposerSubmitFromButton);
		sendButton.addEventListener("click", requestComposerSubmitFromButton);
		$("interruptTurn").addEventListener("click", interruptActiveTurn);
		if ($("scrollToBottom")) $("scrollToBottom").addEventListener("click", () => {
			clearConversationAutoScrollHold();
			clearSubmittedMessageBottomFollow();
			clearViewportBottomFollow();
			scrollConversationToBottom();
		});
		if ($("scrollToTurnReply")) $("scrollToTurnReply").addEventListener("click", scrollConversationToTurnReply);
		if ($("liveOperationDock")) {
			$("liveOperationDock").addEventListener("click", handleLiveOperationDockClick);
			$("liveOperationDock").addEventListener("touchstart", beginLiveOperationDockGesture, { passive: true });
			$("liveOperationDock").addEventListener("touchend", finishLiveOperationDockGesture, { passive: true });
			$("liveOperationDock").addEventListener("touchcancel", cancelLiveOperationDockGesture, { passive: true });
		}
		$("conversation").addEventListener("pointerdown", rememberConversationScrollIntent, { passive: true });
		$("conversation").addEventListener("touchstart", rememberConversationScrollIntent, { passive: true });
		$("conversation").addEventListener("touchstart", beginSubagentSwipe, { passive: true });
		$("conversation").addEventListener("touchmove", moveSubagentSwipe, { passive: false });
		$("conversation").addEventListener("touchend", finishSubagentSwipe, { passive: true });
		$("conversation").addEventListener("touchcancel", cancelSubagentSwipe, { passive: true });
		$("conversation").addEventListener("wheel", rememberConversationScrollIntent, { passive: true });
		$("conversation").addEventListener("wheel", handleSubagentWheelSwipe, { passive: true });
		$("conversation").addEventListener("toggle", handleUsageSummaryToggle, true);
		$("conversation").addEventListener("toggle", handleThreadTaskCardDetailsToggle, true);
		$("conversation").addEventListener("scroll", () => {
			updateRecentCompletedReplyAnchorFromScroll();
			updateConversationAutoScrollHoldFromScroll();
			updateScrollToBottomButton();
			maybeLoadOlderThreadTurnsFromScroll();
		}, { passive: true });
		$("conversation").addEventListener("click", (event) => {
			const conversationRoot = event.currentTarget || $("conversation");
			const previewImage = threadDetailActionsApi.previewableImageFromTarget(event.target, conversationRoot);
			if (previewImage && openImagePreviewFromImage(previewImage)) {
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			const actionPlan = threadDetailActionsApi.resolveThreadDetailClickAction({
				target: event.target,
				root: conversationRoot
			});
			if (actionPlan.preventDefault) event.preventDefault();
			if (actionPlan.stopPropagation) event.stopPropagation();
			if (actionPlan.action === "copy") {
				const copyButton = actionPlan.button || actionPlan.target;
				event.preventDefault();
				event.stopPropagation();
				handleCopyButtonClick(copyButton).catch(() => {
					copyButton.textContent = "复制失败";
					window.setTimeout(() => {
						copyButton.textContent = copyButton.getAttribute("aria-label") || "复制";
					}, 1200);
				});
				return;
			}
			if (actionPlan.action === "local-file-preview") {
				event.preventDefault();
				event.stopPropagation();
				openLocalFilePreview(actionPlan.link || actionPlan.target, { threadId: actionPlan.threadId }).catch(showError);
				return;
			}
			if (actionPlan.action === "mermaid") {
				event.preventDefault();
				event.stopPropagation();
				handleMermaidAction(actionPlan.button || actionPlan.target);
				return;
			}
			if (actionPlan.action === "github-preview-toggle") {
				event.preventDefault();
				event.stopPropagation();
				toggleGitHubLinkPreview(actionPlan.button || actionPlan.target);
				return;
			}
			if (actionPlan.action === "approval-answer") {
				answerApproval(actionPlan.approvalId, actionPlan.approvalAction, { threadId: actionPlan.threadId }).catch(showError);
				return;
			}
			if (actionPlan.action === "task-card-reply") {
				replyTaskCard(actionPlan.cardId, { threadId: actionPlan.threadId }).catch(showError);
				return;
			}
			if (actionPlan.action === "task-card-mutate") {
				mutateThreadTaskCard(actionPlan.cardId, actionPlan.taskCardAction, {}, { threadId: actionPlan.threadId }).catch(showError);
				return;
			}
			if (actionPlan.action === "task-card-unknown") return;
			if (actionPlan.action === "task-card-draft") {
				if (actionPlan.draftAction === "dismiss") dismissThreadTaskCardDraft(actionPlan.draftKey, { threadId: actionPlan.threadId });
				return;
			}
			if (actionPlan.action === "server-response") {
				const request = state.pendingApprovals.get(actionPlan.requestId !== null && actionPlan.requestId !== void 0 ? String(actionPlan.requestId) : "");
				answerServerRequest(actionPlan.requestId, serverRequestPayload(request, actionPlan.responseText || "", actionPlan.questionId || "answer"), { threadId: actionPlan.threadId }).catch(showError);
				return;
			}
			if (actionPlan.action === "server-request-decline") declineServerRequest(actionPlan.requestId, { threadId: actionPlan.threadId }).catch(showError);
		});
		$("conversation").addEventListener("submit", (event) => {
			const form = event.target.closest("[data-server-request-form]");
			if (!form) return;
			event.preventDefault();
			const requestId = form.dataset.serverRequestId;
			const request = state.pendingApprovals.get(requestId !== null && requestId !== void 0 ? String(requestId) : "");
			const responseText = new FormData(form).get("responseText") || "";
			answerServerRequest(requestId, serverRequestPayload(request, String(responseText), form.dataset.serverQuestionId || "answer"), { threadId: form.dataset.serverRequestThreadId }).catch(showError);
		});
		$("conversation").addEventListener("error", handleConversationImageError, true);
		$("conversation").addEventListener("load", handleConversationImageLoad, true);
		$("messageInput").addEventListener("input", (event) => {
			autoSizeMessageInput(event.target);
			if (state.sendButtonHint && !state.composerBusy) state.sendButtonHint = "";
			queueComposerIntentMenuUpdate();
			updateComposerControls();
			scheduleCurrentDraftSave();
		});
		$("messageInput").addEventListener("keyup", queueComposerIntentMenuUpdate);
		$("messageInput").addEventListener("focus", queueComposerIntentMenuUpdate);
		$("messageInput").addEventListener("pointerdown", prepareMessageInputForNativeGesture);
		$("messageInput").addEventListener("pointerup", recoverMessageInputKeyboardFromGesture);
		$("messageInput").addEventListener("click", recoverMessageInputKeyboardFromGesture);
		$("messageInput").addEventListener("compositionstart", () => {
			state.composerComposing = true;
		});
		$("messageInput").addEventListener("compositionend", (event) => {
			state.composerComposing = false;
			autoSizeMessageInput(event.target);
			queueComposerIntentMenuUpdate();
			updateComposerControls();
			scheduleCurrentDraftSave();
		});
		$("messageInput").addEventListener("keydown", (event) => {
			if (event.key === "Escape" && state.composerIntentMenuOpen) {
				event.preventDefault();
				closeComposerIntentMenu();
				return;
			}
			if (state.composerComposing || event.isComposing) return;
			if (event.key !== "Enter" || event.shiftKey) return;
			if (!composerHasContent() || state.composerBusy) return;
			event.preventDefault();
			$("composer").requestSubmit();
		});
		$("messageInput").addEventListener("paste", (event) => {
			const files = Array.from(event.clipboardData && event.clipboardData.files || []);
			if (files.length) addAttachmentFiles(files).catch(showError);
			const text = event.clipboardData && event.clipboardData.getData("text/plain");
			if (text) {
				event.preventDefault();
				document.execCommand("insertText", false, text);
			}
		});
		$("attachFiles").addEventListener("click", requestAttachmentPickerFromButton);
		$("attachFiles").addEventListener("keydown", (event) => {
			if (!["Enter", " "].includes(event.key)) return;
			requestAttachmentPickerFromButton(event);
		});
		$("fileInput").addEventListener("change", (event) => {
			addAttachmentFiles(event.target.files).catch(showError);
			event.target.value = "";
		});
		$("attachmentList").addEventListener("click", (event) => {
			const button = event.target.closest("[data-remove-attachment]");
			if (button) removeAttachment(button.dataset.removeAttachment);
		});
		if ($("filePreviewClose")) $("filePreviewClose").addEventListener("click", closeFilePreview);
		if ($("filePreviewDialog")) {
			const filePreviewDialog = $("filePreviewDialog");
			filePreviewDialog.addEventListener("touchstart", beginFilePreviewSwipe, { passive: false });
			filePreviewDialog.addEventListener("touchmove", moveFilePreviewSwipe, { passive: false });
			filePreviewDialog.addEventListener("touchend", finishFilePreviewSwipe, { passive: false });
			filePreviewDialog.addEventListener("touchcancel", cancelFilePreviewSwipe, { passive: true });
			filePreviewDialog.addEventListener("click", (event) => {
				if (event.target === $("filePreviewDialog")) {
					closeFilePreview();
					return;
				}
				const previewImage = previewableImageFromEvent(event);
				if (previewImage && openImagePreviewFromImage(previewImage)) {
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				const copyButton = event.target.closest("[data-copy-key]");
				if (copyButton) {
					event.preventDefault();
					handleCopyButtonClick(copyButton).catch(() => {
						copyButton.textContent = "复制失败";
					});
					return;
				}
				const localFileLink = event.target.closest("[data-local-file-path]");
				if (localFileLink) {
					event.preventDefault();
					openLocalFilePreview(localFileLink, { threadId: state.filePreviewThreadId }).catch(showError);
					return;
				}
				const mermaidButton = event.target.closest("[data-mermaid-action]");
				if (mermaidButton) {
					event.preventDefault();
					event.stopPropagation();
					handleMermaidAction(mermaidButton);
					return;
				}
				const githubPreviewExpand = event.target.closest("[data-github-link-preview-expand]");
				if (githubPreviewExpand) {
					event.preventDefault();
					event.stopPropagation();
					toggleGitHubLinkPreview(githubPreviewExpand);
				}
			});
		}
		if ($("imagePreviewClose")) $("imagePreviewClose").addEventListener("click", closeImagePreview);
		if ($("imagePreviewDialog")) {
			const imageDialog = $("imagePreviewDialog");
			const imageStage = $("imagePreviewStage");
			if (imageStage) {
				imageStage.addEventListener("touchstart", beginImagePreviewPinch, { passive: false });
				imageStage.addEventListener("touchmove", moveImagePreviewPinch, { passive: false });
				imageStage.addEventListener("touchend", finishImagePreviewPinch, { passive: true });
				imageStage.addEventListener("touchcancel", finishImagePreviewPinch, { passive: true });
			}
			imageDialog.addEventListener("click", (event) => {
				if (event.target === imageDialog) {
					closeImagePreview();
					return;
				}
				const actionButton = event.target.closest("[data-image-preview-action]");
				if (actionButton) {
					event.preventDefault();
					event.stopPropagation();
					handleImagePreviewAction(actionButton);
				}
			});
		}
		if ($("mermaidPreviewClose")) $("mermaidPreviewClose").addEventListener("click", closeMermaidPreview);
		if ($("mermaidPreviewDialog")) {
			const mermaidDialog = $("mermaidPreviewDialog");
			mermaidDialog.addEventListener("click", (event) => {
				if (event.target === mermaidDialog) {
					closeMermaidPreview();
					return;
				}
				const mermaidButton = event.target.closest("[data-mermaid-action]");
				if (mermaidButton) {
					event.preventDefault();
					event.stopPropagation();
					handleMermaidAction(mermaidButton);
				}
			});
		}
		document.addEventListener("touchstart", beginMermaidPinch, {
			passive: false,
			capture: true
		});
		document.addEventListener("touchmove", moveMermaidPinch, {
			passive: false,
			capture: true
		});
		document.addEventListener("touchend", finishMermaidPinch, {
			passive: true,
			capture: true
		});
		document.addEventListener("touchcancel", finishMermaidPinch, {
			passive: true,
			capture: true
		});
		installMermaidThemeObserver();
		$("composer").addEventListener("dragover", (event) => {
			if (!(state.currentThreadId || state.newThreadDraft) || !hasTransferFiles(event)) return;
			event.preventDefault();
			$("composer").classList.add("drag-over");
		});
		$("composer").addEventListener("dragleave", () => $("composer").classList.remove("drag-over"));
		$("composer").addEventListener("drop", (event) => {
			if (!(state.currentThreadId || state.newThreadDraft) || !hasTransferFiles(event)) return;
			event.preventDefault();
			$("composer").classList.remove("drag-over");
			addAttachmentFiles(event.dataTransfer.files).catch(showError);
		});
		updateViewportVars();
		applyPluginAppearancePreference(state.pluginAppearance);
		applyFontSizePreference();
		renderFontSizeControl();
		syncThreadTileToggle();
		installLaunchQueueHandler();
		installPluginWindowingGuards();
		installHermesPluginBackSwipeGuard();
		window.addEventListener("message", (event) => {
			if (handlePluginVoiceInputMessage(event)) return;
			if (handleHermesPluginViewportMessage(event && event.data)) return;
			if (pluginEmbedApi.isBackMessage && pluginEmbedApi.isBackMessage(event)) handlePluginBack(event, { source: "plugin-back-message" });
		});
		if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
		document.addEventListener("visibilitychange", () => {
			postClientEvent("page_visibility", {
				visibilityState: document.visibilityState,
				currentThreadId: state.currentThreadId || "",
				eventOpen: Boolean(state.events && state.events.readyState === EventSource.OPEN)
			});
			if (document.visibilityState === "visible") {
				ensureAndroidBackToSidebarSentinel();
				schedulePageRefreshCheck(200, { force: true });
			}
			scheduleMobileResume("visibility");
		});
		window.addEventListener("pageshow", (event) => {
			postClientEvent("page_show", {
				persisted: Boolean(event && event.persisted),
				currentThreadId: state.currentThreadId || ""
			});
			const threadId = applyUrlThreadSelection({ load: true });
			const pluginRouteHint = applyUrlPluginRouteHint({ load: true });
			ensureAndroidBackToSidebarSentinel();
			schedulePageRefreshCheck(200, { force: true });
			scheduleMobileResume("pageshow", threadId || pluginRouteHint ? 240 : 80);
		});
		window.addEventListener("focus", () => {
			const threadId = applyUrlThreadSelection({ load: true });
			const pluginRouteHint = applyUrlPluginRouteHint({ load: true });
			ensureAndroidBackToSidebarSentinel();
			schedulePageRefreshCheck(600);
			scheduleMobileResume("focus", threadId || pluginRouteHint ? 300 : 150);
		});
		window.addEventListener("blur", () => scheduleVisualRecovery("window-blur", 180, { render: false }));
		window.addEventListener("pagehide", saveCurrentDraftNow);
		window.addEventListener("beforeunload", saveCurrentDraftNow);
		document.addEventListener("focusin", () => {
			if (!isHermesKeyboardInputActive()) scheduleVisualRecovery("focusin", 40, {
				render: false,
				heavy: false,
				delays: [40, 180]
			});
			scheduleVisibleImageFailureScan([
				0,
				80,
				240
			]);
			cleanupExternalMermaidErrorArtifacts();
		});
		document.addEventListener("focusout", () => scheduleVisualRecovery("focusout", 160, {
			render: false,
			heavy: false,
			delays: [160, 420]
		}));
		window.addEventListener("orientationchange", () => {
			followViewportChangeToBottom("orientation");
			scheduleMobileResume("orientation", 250);
		});
		window.addEventListener("resize", () => {
			updateViewportVars();
			updateComposerHeightVar();
			positionComposerIntentMenu();
			syncThreadTileToggle();
			if (state.threadTileMode && !isThreadTileKeyboardFocusActive()) scheduleRenderCurrentThread();
			if (!isHermesKeyboardInputActive()) {
				followViewportChangeToBottom("resize");
				scheduleViewportBottomFollowScroll();
				scheduleVisualRecovery("resize", 40, {
					render: false,
					heavy: false,
					delays: [40, 180]
				});
			}
		});
		if (window.visualViewport) {
			window.visualViewport.addEventListener("resize", () => {
				updateViewportVars();
				updateComposerHeightVar();
				positionComposerIntentMenu();
				syncThreadTileToggle();
				if (state.threadTileMode && !isThreadTileKeyboardFocusActive()) scheduleRenderCurrentThread();
				if (!isHermesKeyboardInputActive()) {
					followViewportChangeToBottom("visual-viewport-resize");
					scheduleViewportBottomFollowScroll();
					scheduleVisualRecovery("visual-viewport", 40, {
						render: false,
						heavy: false,
						delays: [
							40,
							180,
							520
						]
					});
				}
			});
			window.visualViewport.addEventListener("scroll", () => {
				updateViewportVars();
				positionComposerIntentMenu();
				if (!isHermesKeyboardInputActive()) {
					followViewportChangeToBottom("visual-viewport-scroll");
					scheduleViewportBottomFollowScroll();
					scheduleVisualRecovery("visual-viewport-scroll", 40, {
						render: false,
						heavy: false,
						delays: [40, 180]
					});
				}
			});
		}
	}
	async function start() {
		const startStartedAt = nowPerfMs();
		state.startupInProgress = true;
		wireUi();
		startThreadListRuntimeStallMonitoring();
		installCodexMobileVisualHarnessFacade();
		if (isHermesEmbedMode()) showPluginStartupLoading();
		startRelativeTimeTimer();
		startUiWatchdog();
		state.startupThreadOpenPending = hasStartupThreadOpenIntent();
		if (state.key && state.startupThreadOpenPending) {
			showApp();
			renderCurrentThread();
			postStartupStage("early_opening_rendered", startStartedAt);
		}
		let config;
		try {
			config = await fetchPublicConfigWithRetry(startStartedAt);
		} catch (err) {
			postStartupStage("public_config_failed", startStartedAt, { error: err && err.message ? err.message : String(err) });
			if (isHermesEmbedMode()) {
				requestHermesPluginRefresh("public_config_failed", { force: true });
				showPluginEmbedRecovering("Codex Mobile is reloading...");
				markBootReady();
			} else {
				showApp();
				showError(err);
				markBootReady();
			}
			state.startupInProgress = false;
			return;
		}
		initializePageBuildState(config);
		startPageRefreshChecks();
		state.appVersion = String(config.version || "");
		state.serverPlatform = String(config.platform || "");
		state.maxUploadBytes = Number(config.maxUploadBytes || state.maxUploadBytes);
		state.maxUploadFiles = Number(config.maxUploadFiles || state.maxUploadFiles);
		state.rolloutWarningThresholdBytes = Number(config.rolloutWarningBytes || state.rolloutWarningThresholdBytes);
		state.modelOptions = normalizeOptionList(config.modelOptions || []);
		state.reasoningEffortOptions = normalizeOptionList(config.reasoningEffortOptions || []);
		state.permissionModeOptions = normalizeOptionList((config.permissionModeOptions || state.permissionModeOptions).map(normalizePermissionModeValue));
		state.defaultModel = String(config.defaultModel || "");
		state.defaultReasoningEffort = String(config.defaultReasoningEffort || "");
		state.defaultPermissionMode = effectiveComposerPermissionMode(config.defaultPermissionMode) || "full";
		state.newThreadModel = state.newThreadModel || state.defaultModel || state.modelOptions[0] || "";
		state.newThreadEffort = state.newThreadEffort || state.defaultReasoningEffort || state.reasoningEffortOptions[0] || "";
		state.newThreadPermissionMode = effectiveComposerPermissionMode(state.newThreadPermissionMode) || defaultNewThreadPermissionMode();
		state.pushServerSupported = Boolean(config.push && config.push.supported);
		state.appUpdateStatus = {
			supported: Boolean(config.update && config.update.enabled),
			version: state.appVersion,
			remote: config.update && config.update.remote || "origin",
			branch: config.update && config.update.branch || "main"
		};
		state.publicPrEnabled = Boolean(config.publicPullRequests && config.publicPullRequests.enabled);
		state.publicPrRepository = String(config.publicPullRequests && config.publicPullRequests.repository || "");
		state.publicReleaseEnabled = Boolean(config.publicRelease && config.publicRelease.enabled);
		state.publicReleaseRepository = String(config.publicRelease && config.publicRelease.repository || state.publicPrRepository || "");
		state.publicReleaseBranch = String(config.publicRelease && config.publicRelease.branch || "main");
		state.appWorkspacePath = String(config.workspacePath || state.appWorkspacePath || "").trim();
		state.workspaceCreateEnabled = config.workspaceCreate ? config.workspaceCreate.enabled !== false : true;
		state.workspaceCreateRoot = String(config.workspaceCreate && config.workspaceCreate.defaultRoot || "").trim();
		state.workspaceCreateRoots = normalizeOptionList(config.workspaceCreate && config.workspaceCreate.roots || []);
		rememberWorkspaceDelegationConfig(config.workspaceDelegation || null);
		state.publicPrStatus = {
			enabled: state.publicPrEnabled,
			repository: state.publicPrRepository
		};
		state.publicReleaseStatus = {
			enabled: state.publicReleaseEnabled,
			repository: state.publicReleaseRepository,
			branch: state.publicReleaseBranch
		};
		renderAppUpdateStatus();
		renderPublicPrStatus();
		renderUpdatePanel();
		renderSharedRestartButton();
		renderComposerSettings();
		rememberRateLimitsFromConfig(config);
		rememberCodexProfiles(config.codexProfiles || null);
		updatePushButton();
		if (isHermesEmbedMode() && state.pluginLaunchSession) try {
			await exchangePluginLaunchSession();
		} catch (err) {
			requestHermesPluginRefresh(pluginRefreshReasonForApiError({
				status: 401,
				message: err && err.message ? err.message : String(err),
				path: "/api/v1/hermes/plugin/session"
			}) || "plugin_launch_invalid", { force: true });
			showPluginEmbedRecovering("Refreshing Codex Mobile plugin launch...");
			markBootReady();
			state.startupInProgress = false;
			return;
		}
		if (config.authRequired && !state.key) {
			if (isHermesEmbedMode()) {
				requestHermesPluginRefresh("plugin_session_missing", { force: true });
				showPluginEmbedRecovering("Refreshing Codex Mobile plugin session...");
			} else showLogin();
			markBootReady();
			state.startupInProgress = false;
			return;
		}
		showApp();
		markBootReady();
		reportShellLoaded(startStartedAt, {
			authRequired: Boolean(config.authRequired),
			hasConfig: true
		});
		if (state.startupThreadOpenPending) renderCurrentThread();
		postStartupStage("app_shown", startStartedAt);
		await bootstrap().catch((err) => {
			hidePluginStartupLoading();
			showError(err);
			if (/unauthorized|forbidden|session expired|invalid session|invalid launch/i.test(err.message || "")) if (isHermesEmbedMode()) {
				requestHermesPluginRefresh(pluginRefreshReasonForApiError({
					status: /forbidden/i.test(err.message || "") ? 403 : 401,
					message: err && err.message ? err.message : String(err),
					path: ""
				}) || "auth_state_changed", { force: true });
				showPluginEmbedRecovering("Refreshing Codex Mobile plugin session...");
			} else showLogin();
		});
		state.startupInProgress = false;
		postStartupStage("startup_done", startStartedAt);
		resumeRememberedContinuationJob().catch(showError);
	}
	function startCodexMobileAppWithRecovery() {
		return start().catch((err) => {
			var boot = window.codexMobileBoot;
			if (boot && typeof boot.fail === "function") boot.fail("script-error");
			try {
				showApp();
				showError(err);
			} catch (_) {}
		});
	}
	function createAppShellRuntime() {
		return {
			wireUi: typeof wireUi === "function" ? wireUi : null,
			start: typeof start === "function" ? start : null,
			startCodexMobileAppWithRecovery: typeof startCodexMobileAppWithRecovery === "function" ? startCodexMobileAppWithRecovery : null
		};
	}
	(function exposeCodexAppShellRuntime(root) {
		const appShellApi = { createAppShellRuntime };
		if (typeof module === "object" && module.exports) module.exports = appShellApi;
		root.CodexAppShellRuntime = appShellApi;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
//#region public/thread-list-runtime.js
var require_thread_list_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
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
				removeItem: () => {}
			};
			const setTimeout = typeof deps.setTimeout === "function" ? deps.setTimeout : root.setTimeout.bind(root);
			const clearTimeout = typeof deps.clearTimeout === "function" ? deps.clearTimeout : root.clearTimeout.bind(root);
			const THREAD_LIST_PAGE_LIMIT = deps.THREAD_LIST_PAGE_LIMIT;
			const THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS = deps.THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS;
			const THREAD_LIST_DEFERRED_FALLBACK_RETRY_MS = deps.THREAD_LIST_DEFERRED_FALLBACK_RETRY_MS;
			const THREAD_LIST_SLOW_PATH_MS = deps.THREAD_LIST_SLOW_PATH_MS;
			const STORAGE_THREAD_ID = deps.STORAGE_THREAD_ID;
			const { normalizeFsPath, escapeHtml, shortPath, isMobileViewport, tokenCountValue, formatTokenMillion, displayInputTokensExcludingCached, saveCurrentDraftNow, flushSideChatDraftNow, resetComposerRuntimeSelection, abortCurrentThreadRefresh, clearRecentCompletedReplyAnchor, clearConversationAutoScrollHold, setComposerText, replacePendingAttachments, syncActiveTurnFromThread, connectEvents, threadListLoadPolicy, nowPerfMs, roundedDurationMs, threadListSummaryFromDetailThread, threadListStableOrderPolicy, reconcileThreadStatusHints, renderCurrentThread, threadTileLayout, isThreadTileKeyboardFocusActive, threadTileCandidateIds, threadTileIdsEqual, restoreConnectionState, scheduleVisiblePageRefreshCheck, threadPerformanceMetrics, postPerformanceEvent, diagnosticDurationBucket, recordHomeAiDiagnosticFailure, recordHomeAiDiagnosticSuccess, threadDiagnosticEventsApi, renderThreadLoadError, diagnosticErrorCode, diagnosticErrorStatus, showError, visibleWorkspaceKeys, codexWorktreeRepoName, basenameForFsPath, visibleWorkspaceNames, statusText, scheduleRenderCurrentThread, threadTilePaneIsVisible, scheduleRenderThreadTilePane, updateThreadStatusHints, normalizeThreadGoal, updateThreadGoalDialogState, draftStore, readDraftMap, draftHasContent, restoreDraftForCurrentTarget, updateComposerControls, showHermesPluginPrimaryPage, isHermesEmbedMode, loadThread, isRunningStatus, rolloutSizeText, isRolloutOverThreshold, formatAbsoluteTime, formatTime, statusIconHtml, statusIconInfo, threadGoalForThread, renderThreadGoalBadge, handleThreadCardClick, threadGoalSignature, rolloutSizeBytes } = deps;
			async function loadWorkspaces() {
				const result = await api("/api/workspaces");
				state.workspaces = result.data || [];
				const select = $("workspaceSelect");
				const menu = $("workspaceSelectMenu");
				if (state.selectedCwd && !state.workspaces.some((ws) => normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd))) state.selectedCwd = "";
				if (select) {
					select.textContent = state.selectedCwd ? selectedWorkspaceLabel() : "All workspaces";
					select.disabled = !state.workspaces.length && !state.workspaceCreateEnabled;
					select.setAttribute("title", state.workspaces.length ? "Select Workspace" : "Create Workspace");
				}
				if (menu) menu.innerHTML = workspaceSidebarOptionsHtml();
				updateWorkspacePath();
				if (shouldRenderPrimaryConversationShell()) renderCurrentThread();
			}
			function workspaceSidebarOptionsHtml() {
				const allOption = `<button type="button" class="workspace-select-option${!state.selectedCwd ? " is-selected" : ""}" data-workspace-value="">All workspaces</button>`;
				const workspaceOptions = state.workspaces.length ? state.workspaces.map((ws) => {
					const count = ws.recentThreadCount ? ` (${ws.recentThreadCount})` : "";
					const label = `${ws.label}${count} - ${ws.cwd}`;
					return `<button type="button" class="workspace-select-option${normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd) ? " is-selected" : ""}" data-workspace-value="${escapeHtml(ws.cwd)}">${escapeHtml(label)}</button>`;
				}).join("") : `<div class="workspace-select-empty">No Workspace yet</div>`;
				const createRoot = state.workspaceCreateRoot ? `Under ${state.workspaceCreateRoot}` : "Create a local folder";
				const createOption = state.workspaceCreateEnabled ? `<button type="button" class="workspace-select-option workspace-create-option" data-create-workspace><span class="workspace-create-title">Create Workspace</span><span class="workspace-create-meta">${escapeHtml(createRoot)}</span></button>` : "";
				return allOption + workspaceOptions + createOption;
			}
			function syncSidebarWorkspaceSelect() {
				const select = $("workspaceSelect");
				const menu = $("workspaceSelectMenu");
				if (!select) return;
				select.textContent = state.selectedCwd ? selectedWorkspaceLabel() : "All workspaces";
				if (menu) menu.innerHTML = workspaceSidebarOptionsHtml();
			}
			function workspaceOptionsHtml() {
				return `<option value="">All workspaces</option>` + state.workspaces.map((ws) => {
					const count = ws.recentThreadCount ? ` (${ws.recentThreadCount})` : "";
					return `<option value="${escapeHtml(ws.cwd)}">${escapeHtml(`${ws.label}${count} - ${ws.cwd}`)}</option>`;
				}).join("");
			}
			function newThreadWorkspaceOptionsHtml() {
				return `<button type="button" class="new-thread-workspace-option${!state.selectedCwd ? " is-selected" : ""}" data-new-thread-workspace=""><span>不指定 Workspace</span><span class="new-thread-workspace-option-meta">对齐 Codex App 的项目外聊天</span></button>` + state.workspaces.map((ws) => {
					const count = ws.recentThreadCount ? ` (${ws.recentThreadCount})` : "";
					const label = `${ws.label}${count} - ${ws.cwd}`;
					return `<button type="button" class="new-thread-workspace-option${normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd) ? " is-selected" : ""}" data-new-thread-workspace="${escapeHtml(ws.cwd)}">${escapeHtml(label)}</button>`;
				}).join("");
			}
			function newThreadChoiceOptionsHtml(values, selectedValue, dataName, labeler) {
				return normalizeOptionList(values).map((value) => {
					return `<button type="button" class="new-thread-choice${value === selectedValue ? " is-selected" : ""}" data-new-thread-${dataName}="${escapeHtml(value)}">${escapeHtml(labeler(value))}</button>`;
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
				const bottomLimit = options.avoidComposer !== false && composerTop > rect.bottom ? composerTop : viewportBottom;
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
				if (!(tokenCountValue(usage.totalTokens) || tokenCountValue(usage.todayTokens) || tokenCountValue(usage.weekTokens))) {
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
				const usage = state.workspaceTokenUsage && typeof state.workspaceTokenUsage === "object" ? state.workspaceTokenUsage : {};
				const daily = Array.isArray(usage.daily) ? usage.daily.slice(0, 31) : [];
				const workspaces = Array.isArray(usage.workspaces) ? usage.workspaces.slice(0, 50) : [];
				if (subtitle) subtitle.textContent = state.selectedCwd ? `当前 Workspace: ${state.selectedCwd}` : "All workspaces";
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
				return Boolean(state.currentThread || state.currentThreadId || state.threadLoadController || state.startupThreadOpenPending);
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
				return Boolean(state.threadLoadController || state.refreshThreadController || state.currentThread && state.currentThread.mobileLoading);
			}
			function scheduleThreadListDeferredFallback(delayMs = THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS) {
				clearThreadListDeferredFallbackTimer();
				const delay = Math.max(500, Number(delayMs) || THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS);
				state.threadListDeferredFallbackTimer = setTimeout(() => {
					state.threadListDeferredFallbackTimer = null;
					const search = $("threadSearch").value.trim();
					if (state.selectedCwd || search) return;
					if (state.threadListLoadController || hasThreadDetailRequestInFlight()) {
						scheduleThreadListDeferredFallback(THREAD_LIST_DEFERRED_FALLBACK_RETRY_MS);
						return;
					}
					loadThreads({
						silent: true,
						deferFallback: false
					}).catch(showError);
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
						allowHidden: false
					})).catch(showError);
				}, delay);
			}
			async function loadThreads(options = {}) {
				const silent = options.silent === true;
				if (silent && state.threadListLoadController) return null;
				if (options.deferFallback !== true) clearThreadListDeferredFallbackTimer();
				const params = new URLSearchParams({
					limit: String(THREAD_LIST_PAGE_LIMIT),
					archived: "false"
				});
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
					allowHidden: options.allowHidden === true
				});
				if (!loadPlan.shouldLoad) {
					if (loadPlan.skipReason === "detail-in-flight") scheduleThreadListDeferredSilentRefresh(loadPlan.retryDelayMs, { deferFallback: options.deferFallback });
					return null;
				}
				if (loadPlan.params && loadPlan.params.fallback) params.set("fallback", "defer");
				if (loadPlan.params && loadPlan.params.initial) params.set("initial", "warm-fallback");
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
					const result = await api(`/api/threads?${params}`, {
						timeoutMs: 45e3,
						signal: controller.signal
					});
					const apiElapsedMs = roundedDurationMs(apiStartedAt);
					if (seq !== state.threadListLoadSeq) return null;
					const renderStartedAt = nowPerfMs();
					const nextThreads = visibleThreads(result.data || []).map((thread) => threadListSummaryFromDetailThread(thread) || thread);
					const stableOrderPlan = threadListStableOrderPolicy.planThreadListStableOrder({
						threads: nextThreads,
						previousState: state.threadListStableOrder,
						scopeKey: threadListStableOrderPolicy.threadListOrderScopeKey({
							selectedCwd: state.selectedCwd,
							search
						}),
						selectedCwd: state.selectedCwd,
						search,
						nowMs: Date.now()
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
					if (result && (result.mobileDeferredFallback || result.mobileDeferredAppServer) && !state.selectedCwd && !search) scheduleThreadListDeferredFallback();
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
						mobileFallback: Boolean(result.mobileFallback)
					};
					postPerformanceEvent("thread_list_rendered", listPerformanceEvent);
					const listSlowPlan = threadPerformanceMetrics.planThreadListSlowPathDiagnostic(listPerformanceEvent, {
						action: "thread-list-load",
						source: silent ? "thread-list-refresh" : "thread-list-load",
						durationBucket: diagnosticDurationBucket(listPerformanceEvent.elapsedMs),
						thresholdMs: THREAD_LIST_SLOW_PATH_MS
					});
					if (listSlowPlan.shouldReport) recordHomeAiDiagnosticFailure(threadDiagnosticEventsApi.threadListSlowPathDiagnosticEvent(listSlowPlan));
					else recordHomeAiDiagnosticSuccess(threadDiagnosticEventsApi.threadListSlowPathDiagnosticSuccess({
						action: "thread-list-load",
						performancePhase: listPerformance.performancePhase
					}));
					recordHomeAiDiagnosticSuccess({
						category: "thread_session_load_failed",
						diagnostic_type: "thread_list_load_failed",
						error_code: "thread_list_load_failed",
						context: {
							surface: "thread-session",
							action: "thread-list-load"
						}
					});
					return result;
				} catch (err) {
					if (seq !== state.threadListLoadSeq || controller.signal.aborted) return null;
					if (!silent) renderThreadLoadError(err);
					recordHomeAiDiagnosticFailure({
						category: "thread_session_load_failed",
						diagnostic_type: "thread_list_load_failed",
						severity_hint: "H3",
						evidence_confidence: .7,
						error_code: diagnosticErrorCode(err, "thread_list_load_failed"),
						duration_bucket: diagnosticDurationBucket(roundedDurationMs(loadStartedAt)),
						context: {
							surface: "thread-session",
							action: "thread-list-load"
						},
						counts: { status_code: diagnosticErrorStatus(err) },
						breadcrumbs: [{
							kind: "thread-session",
							code: "thread-list-load",
							status: "failed",
							duration_bucket: diagnosticDurationBucket(roundedDurationMs(loadStartedAt)),
							fields: { status_code: diagnosticErrorStatus(err) }
						}]
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
				applyThreadStatusToThread(state.threads.find((entry) => String(entry && entry.id || "") === id), status);
				applyThreadStatusToThread(state.currentThread && String(state.currentThread.id || "") === id ? state.currentThread : null, status);
				applyThreadStatusToThread(state.threadTileDetails && state.threadTileDetails.get(String(id)) || null, status);
				if (options.render === true) scheduleThreadStatusDetailRender(id);
			}
			function localThreadForStatusContext(threadId) {
				const id = String(threadId || "").trim();
				if (!id) return null;
				if (state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
				return state.threads.find((entry) => String(entry && entry.id || "") === id) || state.threadTileDetails && state.threadTileDetails.get(String(id)) || null;
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
					listStatus: listThread ? listThread.status : void 0,
					hadCurrentThread: currentMatches,
					currentStatus: currentMatches ? state.currentThread.status : void 0,
					hadTileThread: Boolean(tileThread),
					tileStatus: tileThread ? tileThread.status : void 0
				};
			}
			function restoreThreadStatusSnapshot(snapshot) {
				if (!snapshot || !snapshot.id) return;
				const id = String(snapshot.id);
				const listThread = state.threads.find((entry) => String(entry && entry.id || "") === id) || null;
				const currentThread = state.currentThread && String(state.currentThread.id || "") === id ? state.currentThread : null;
				const tileThread = state.threadTileDetails && state.threadTileDetails.get(String(id)) || null;
				const restoredStatus = snapshot.hadCurrentThread ? snapshot.currentStatus : snapshot.hadListThread ? snapshot.listStatus : snapshot.tileStatus;
				const targetThread = localThreadForStatusContext(id) || currentThread || listThread || tileThread;
				updateThreadStatusHints(id, { type: "active" }, restoredStatus, {
					thread: targetThread,
					notify: false
				});
				const listIndex = state.threads.findIndex((entry) => String(entry && entry.id || "") === id);
				if (snapshot.hadListThread && listIndex >= 0) applyThreadStatusToThread(state.threads[listIndex], snapshot.listStatus);
				else if (!snapshot.hadListThread && listIndex >= 0) state.threads = state.threads.filter((entry) => String(entry && entry.id || "") !== id);
				if (snapshot.hadCurrentThread && state.currentThread && String(state.currentThread.id || "") === id) state.currentThread.status = snapshot.currentStatus;
				if (snapshot.hadTileThread) applyThreadStatusToThread(state.threadTileDetails && state.threadTileDetails.get(String(id)) || null, snapshot.tileStatus);
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
				if (window.requestAnimationFrame) state.threadListRenderFrame = window.requestAnimationFrame(render);
				else state.threadListRenderFrame = setTimeout(render, 33);
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
				if (state.goalDialogThreadId && state.goalDialogThreadId === id) updateThreadGoalDialogState(normalizedGoal);
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
				const warning = result && result.mobileFallback ? `<div class="history-note">Live thread list recovering. Showing cached session index.</div>` : "";
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
					const taskCardBadge = pendingIncomingTaskCards ? `<div class="thread-card-task-badge" title="Pending incoming task cards">${escapeHtml(`Task ${pendingIncomingTaskCards}`)}</div>` : "";
					const sizeBadge = sizeText ? `<div class="thread-card-size${sizeWarn ? " warn" : ""}" title="Rollout file size">${escapeHtml(sizeText)}</div>` : "";
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
					timeBucket: Math.floor(nowMs / 6e4),
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
						isRolloutOverThreshold(thread)
					])
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
				const workspace = cwd ? state.workspaces.find((ws) => normalizeFsPath(ws.cwd) === normalizeFsPath(cwd)) : null;
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
				selectWorkspaceShortcut
			};
		}
		const api = { createThreadListRuntime };
		if (typeof module === "object" && module.exports) module.exports = api;
		root.CodexThreadListRuntime = api;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
//#region \0virtual:codex-mobile-esm-compatibility/shard/shard-03
var import_thread_tile_runtime = /* @__PURE__ */ __toESM(require_thread_tile_runtime());
var import_app_update_runtime = /* @__PURE__ */ __toESM(require_app_update_runtime());
var import_modal_runtime = /* @__PURE__ */ __toESM(require_modal_runtime());
var import_runtime_wiring_runtime = /* @__PURE__ */ __toESM(require_runtime_wiring_runtime());
var import_app_shell_runtime = /* @__PURE__ */ __toESM(require_app_shell_runtime());
var import_thread_list_runtime = /* @__PURE__ */ __toESM(require_thread_list_runtime());
var moduleDefinitions = [
	{
		"id": "thread-tile-runtime",
		"source": "public/thread-tile-runtime.js",
		"globalName": "CodexThreadTileRuntime",
		"expectedFunctions": ["createThreadTileRuntime"],
		"assetPath": "/thread-tile-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 74569
	},
	{
		"id": "app-update-runtime",
		"source": "public/app-update-runtime.js",
		"globalName": "CodexAppUpdateRuntime",
		"expectedFunctions": ["createAppUpdateRuntime"],
		"assetPath": "/app-update-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 51619
	},
	{
		"id": "modal-runtime",
		"source": "public/modal-runtime.js",
		"globalName": "CodexModalRuntime",
		"expectedFunctions": ["createModalRuntime"],
		"assetPath": "/modal-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 12049
	},
	{
		"id": "runtime-wiring-runtime",
		"source": "public/runtime-wiring-runtime.js",
		"globalName": "CodexRuntimeWiringRuntime",
		"expectedFunctions": ["createRuntimeWiringRuntime"],
		"assetPath": "/runtime-wiring-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 8628
	},
	{
		"id": "app-shell-runtime",
		"source": "public/app-shell-runtime.js",
		"globalName": "CodexAppShellRuntime",
		"expectedFunctions": ["createAppShellRuntime"],
		"assetPath": "/app-shell-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 41219
	},
	{
		"id": "thread-list-runtime",
		"source": "public/thread-list-runtime.js",
		"globalName": "CodexThreadListRuntime",
		"expectedFunctions": ["createThreadListRuntime"],
		"assetPath": "/thread-list-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 37167
	}
];
var moduleApis = {
	"thread-tile-runtime": import_thread_tile_runtime.default,
	"app-update-runtime": import_app_update_runtime.default,
	"modal-runtime": import_modal_runtime.default,
	"runtime-wiring-runtime": import_runtime_wiring_runtime.default,
	"app-shell-runtime": import_app_shell_runtime.default,
	"thread-list-runtime": import_thread_list_runtime.default
};
function functionReady(api, name) {
	return Boolean(api && typeof api[name] === "function");
}
function publishClassicGlobal(definition, api) {
	const globalName = String(definition && definition.globalName || "");
	if (!globalName || !api || typeof api !== "object" || typeof globalThis === "undefined") return false;
	globalThis[globalName] = api;
	return globalThis[globalName] === api;
}
function sampleModule(id, api) {
	if (id === "build-refresh-policy") {
		const classification = functionReady(api, "classifyServerBuildChange") ? api.classifyServerBuildChange("0.1.11|codex-mobile-shell-v626", "0.1.11|codex-mobile-shell-v625") : "";
		const prompt = functionReady(api, "shouldPromptForServerBuildChange") ? api.shouldPromptForServerBuildChange("0.1.11|codex-mobile-shell-v626", "0.1.11|codex-mobile-shell-v625") : false;
		return {
			ok: classification === "server-newer" && prompt === true,
			classification,
			prompt
		};
	}
	if (id === "runtime-settings") {
		const normalizedOptions = functionReady(api, "normalizeOptionList") ? api.normalizeOptionList([
			"",
			"gpt-5.5",
			" gpt-5.5 ",
			"gpt-5.4"
		]) : [];
		const modelLabel = functionReady(api, "labelForModel") ? api.labelForModel("gpt-5.3-codex-spark") : "";
		const compactModelLabel = functionReady(api, "compactLabelForModel") ? api.compactLabelForModel("gpt-5.3-codex-spark") : "";
		const effortLabel = functionReady(api, "labelForEffort") ? api.labelForEffort("xhigh") : "";
		const permissionLabel = functionReady(api, "labelForPermissionMode") ? api.labelForPermissionMode("full") : "";
		const permissionTitle = functionReady(api, "titleForPermissionMode") ? api.titleForPermissionMode("custom") : "";
		const permissionAlias = functionReady(api, "normalizePermissionModeValue") ? api.normalizePermissionModeValue("full-access") : "";
		const selectedModel = functionReady(api, "selectedNewThreadModel") ? api.selectedNewThreadModel({
			selected: "",
			defaultValue: "gpt-5.5",
			options: ["gpt-5.4"]
		}) : "";
		const selectedEffort = functionReady(api, "selectedNewThreadEffort") ? api.selectedNewThreadEffort({
			selected: " high ",
			defaultValue: "medium",
			options: ["low"]
		}) : "";
		const selectedPermission = functionReady(api, "selectedNewThreadPermission") ? api.selectedNewThreadPermission({
			selected: "workspace-write",
			defaultValue: "full",
			options: ["auto"]
		}) : "";
		return {
			ok: Array.isArray(normalizedOptions) && normalizedOptions.join(",") === "gpt-5.5,gpt-5.4" && modelLabel === "GPT-5.3 Codex Spark" && compactModelLabel === "5.3 Spark" && effortLabel === "XHigh" && permissionLabel === "完全访问权限" && permissionTitle === "自定义 (config.toml)" && permissionAlias === "full" && selectedModel === "gpt-5.5" && selectedEffort === "high" && selectedPermission === "auto",
			normalizedOptions,
			modelLabel,
			compactModelLabel,
			effortLabel,
			permissionLabel,
			permissionTitle,
			permissionAlias,
			selectedModel,
			selectedEffort,
			selectedPermission
		};
	}
	if (id === "viewport-metrics") {
		const editable = functionReady(api, "isKeyboardEditable") ? api.isKeyboardEditable({
			tagName: "INPUT",
			type: "text"
		}) : false;
		const checkboxEditable = functionReady(api, "isKeyboardEditable") ? api.isKeyboardEditable({
			tagName: "INPUT",
			type: "checkbox"
		}) : true;
		const measurement = functionReady(api, "measureViewport") ? api.measureViewport({
			visualHeight: 520,
			visualOffsetTop: 16,
			innerHeight: 1024,
			clientHeight: 1024,
			activeElement: { tagName: "TEXTAREA" }
		}) : {};
		const stableChanged = functionReady(api, "stablePixelChanged") ? api.stablePixelChanged(92, 94) : false;
		const stableNoise = functionReady(api, "stablePixelChanged") ? api.stablePixelChanged(92, 93) : true;
		const cssPixel = functionReady(api, "cssPixel") ? api.cssPixel(92.6) : 0;
		return {
			ok: editable === true && checkboxEditable === false && measurement.keyboardShrunk === true && measurement.height === 520 && measurement.top === 16 && stableChanged === true && stableNoise === false && cssPixel === 93,
			editable,
			checkboxEditable,
			keyboardShrunk: Boolean(measurement.keyboardShrunk),
			height: Number(measurement.height) || 0,
			top: Number(measurement.top) || 0,
			stableChanged,
			stableNoise,
			cssPixel
		};
	}
	if (id === "conversation-scroll") {
		const nearBottom = functionReady(api, "isNearBottom") ? api.isNearBottom({
			scrollHeight: 1800,
			scrollTop: 725,
			clientHeight: 980
		}) : false;
		const notNearBottom = functionReady(api, "isNearBottom") ? api.isNearBottom({
			scrollHeight: 1800,
			scrollTop: 640,
			clientHeight: 980
		}) : true;
		const submittedFollow = functionReady(api, "createSubmittedMessageFollow") ? api.createSubmittedMessageFollow("thread-a", {
			clientSubmissionId: "submit-1",
			nowMs: 1e3,
			ttlMs: 5e3
		}) : null;
		const submittedActive = functionReady(api, "shouldFollowSubmittedMessage") ? api.shouldFollowSubmittedMessage(submittedFollow, {
			threadId: "thread-a",
			nowMs: 5999
		}) : false;
		const submittedWrongThread = functionReady(api, "shouldFollowSubmittedMessage") ? api.shouldFollowSubmittedMessage(submittedFollow, {
			threadId: "thread-b",
			nowMs: 2e3
		}) : true;
		const viewportFollow = functionReady(api, "createViewportFollow") ? api.createViewportFollow("thread-a", {
			reason: "orientation",
			nowMs: 1e3,
			ttlMs: 3e3
		}) : null;
		const viewportActive = functionReady(api, "shouldFollowViewport") ? api.shouldFollowViewport(viewportFollow, {
			threadId: "thread-a",
			nowMs: 3999
		}) : false;
		const lease = functionReady(api, "planBottomFollowLeaseEvaluation") ? api.planBottomFollowLeaseEvaluation({
			leaseActive: true,
			hasLease: true
		}) : {};
		const schedule = functionReady(api, "planBottomFollowScrollSchedule") ? api.planBottomFollowScrollSchedule() : {};
		const refresh = functionReady(api, "planAutomaticConversationRefresh") ? api.planAutomaticConversationRefresh({
			hasThread: true,
			nearBottom: false,
			userReadingCurrentTurn: true
		}) : {};
		const fullRender = functionReady(api, "planFullRenderScroll") ? api.planFullRenderScroll({ submittedMessageFollow: true }) : {};
		return {
			ok: nearBottom === true && notNearBottom === false && submittedFollow && submittedFollow.untilMs === 6e3 && submittedActive === true && submittedWrongThread === false && viewportFollow && viewportFollow.untilMs === 4e3 && viewportActive === true && lease.reason === "lease-active" && Array.isArray(schedule.delaysMs) && schedule.delaysMs.join(",") === "0,80,240,600,1200" && refresh.allowRefresh === false && refresh.reason === "user-reading-current-turn" && fullRender.stickToBottom === true && fullRender.reason === "submitted-message-follow",
			nearBottom,
			submittedActive,
			viewportActive,
			leaseReason: String(lease.reason || ""),
			scheduleDelays: Array.isArray(schedule.delaysMs) ? schedule.delaysMs : [],
			refreshReason: String(refresh.reason || ""),
			fullRenderReason: String(fullRender.reason || "")
		};
	}
	if (id === "thread-performance-metrics") {
		const listPhase = functionReady(api, "classifyThreadListPhase") ? api.classifyThreadListPhase({
			fallbackCacheDecision: "expired-rebuild",
			fallbackMs: 25
		}) : "";
		const detailPhase = functionReady(api, "classifyThreadDetailPhase") ? api.classifyThreadDetailPhase({
			readDecision: "projection-hit",
			projectionSource: "dynamic"
		}) : "";
		const clientTimings = functionReady(api, "threadDetailClientTimings") ? api.threadDetailClientTimings({
			elapsedMs: 26.4,
			renderElapsedMs: 7.2,
			detailRenderMode: "patch"
		}) : {};
		const detailFields = functionReady(api, "threadDetailEventFields") ? api.threadDetailEventFields({
			mobileDiagnostics: { threadDetailTimings: {
				phase: "warm-projection-cache",
				totalMs: 8
			} },
			turns: [{
				status: "completed",
				items: [{
					type: "userMessage",
					text: "prompt"
				}]
			}]
		}) : {};
		const shape = functionReady(api, "threadDetailShape") ? api.threadDetailShape({
			mobileOmittedTurnCount: 2,
			turns: [{
				status: "completed",
				items: [{
					type: "userMessage",
					text: "prompt"
				}]
			}, {
				status: "running",
				items: [{
					type: "agentMessage",
					text: "reply"
				}]
			}]
		}) : {};
		const slow = functionReady(api, "planThreadDetailSlowPathDiagnostic") ? api.planThreadDetailSlowPathDiagnostic({
			elapsedMs: 1600,
			apiElapsedMs: 1550,
			renderElapsedMs: 20,
			performancePhase: "cold-turns-list-initial"
		}, {
			action: "thread-detail-load",
			threadHash: "thread_hash",
			durationBucket: "1_3s"
		}) : {};
		return {
			ok: listPhase === "cold-fallback-expired-rebuild" && detailPhase === "warm-projection-dynamic" && clientTimings.elapsedMs === 26 && clientTimings.renderElapsedMs === 7 && clientTimings.detailRenderMode === "patch" && detailFields.performancePhase === "warm-projection-cache" && shape.turns === 2 && shape.visibleItems === 2 && shape.omittedTurns === 2 && shape.completedTurns === 1 && shape.activeTurns === 1 && slow.shouldReport === true && slow.reason === "api-slow",
			listPhase,
			detailPhase,
			elapsedMs: Number(clientTimings.elapsedMs) || 0,
			detailPerformancePhase: String(detailFields.performancePhase || ""),
			visibleItems: Number(shape.visibleItems) || 0,
			slowReason: String(slow.reason || "")
		};
	}
	if (id === "thread-detail-state") {
		const loadedThread = {
			id: "thread-a",
			title: "Thread A",
			status: "completed",
			mobileDetailLoaded: true,
			mobileLoading: false,
			turns: [{
				id: "turn-a",
				status: "completed",
				items: [{
					type: "userMessage",
					text: "hello"
				}]
			}],
			mobileProjection: { source: "sample" }
		};
		const summary = functionReady(api, "threadListSummaryFromDetailThread") ? api.threadListSummaryFromDetailThread(loadedThread) : {};
		const loaded = functionReady(api, "threadHasLoadedDetailState") ? api.threadHasLoadedDetailState(loadedThread) : false;
		const reusable = functionReady(api, "threadHasReusableLoadedDetailState") ? api.threadHasReusableLoadedDetailState(loadedThread) : false;
		const visualBaseline = functionReady(api, "threadHasVisualBaselineLoadedDetailState") ? api.threadHasVisualBaselineLoadedDetailState(Object.assign({}, loadedThread, { status: "active" })) : false;
		const cacheReuse = functionReady(api, "planThreadOpenCacheReuse") ? api.planThreadOpenCacheReuse({
			currentThread: loadedThread,
			threadId: "thread-a"
		}) : {};
		return {
			ok: summary && summary.id === "thread-a" && !Object.prototype.hasOwnProperty.call(summary, "turns") && !Object.prototype.hasOwnProperty.call(summary, "mobileProjection") && loaded === true && reusable === true && visualBaseline === true && cacheReuse && typeof cacheReuse === "object",
			summaryId: String(summary && summary.id || ""),
			summaryHasTurns: Object.prototype.hasOwnProperty.call(summary || {}, "turns"),
			loaded,
			reusable,
			visualBaseline,
			cacheReuseReason: String(cacheReuse.reason || "")
		};
	}
	if (id === "thread-detail-render-plan") {
		const backfill = functionReady(api, "planThreadDetailHistoryAutoBackfill") ? api.planThreadDetailHistoryAutoBackfill({
			hasOlder: true,
			thread: {
				mobileOlderTurnsCursor: "cursor-a",
				turns: [{ items: [{
					type: "assistantMessage",
					text: "[Cross-thread task card sent by source thread]"
				}] }]
			}
		}) : {};
		const request = functionReady(api, "planThreadDetailRefreshRequest") ? api.planThreadDetailRefreshRequest({
			threadId: "thread-a",
			threadLoadSeq: 7,
			options: { source: "auto-refresh" }
		}) : {};
		const postUpdate = functionReady(api, "planSingleThreadShellPostUpdateEffects") ? api.planSingleThreadShellPostUpdateEffects({
			bindCurrentThreadActions: true,
			updateTickTimer: true,
			publishPluginNavigationState: true,
			reason: "sample"
		}) : {};
		const normalizedSignature = functionReady(api, "normalizeSignature") ? api.normalizeSignature(42) : "";
		const effects = Array.isArray(postUpdate.effects) ? postUpdate.effects : [];
		return {
			ok: normalizedSignature === "42" && backfill.shouldLoad === true && backfill.reason === "sparse-conversation-context" && request.shouldRefresh === true && request.threadId === "thread-a" && request.requestedMode === "recent" && request.query && request.query.mode === "recent" && effects.map((entry) => String(entry && entry.type || "")).join(",") === "bind-current-thread-actions,update-tick-timer,publish-plugin-navigation-state",
			normalizedSignature,
			backfillReason: String(backfill.reason || ""),
			refreshReason: String(request.reason || ""),
			effectTypes: effects.map((entry) => String(entry && entry.type || ""))
		};
	}
	if (id === "thread-detail-dom-patch") {
		const patch = functionReady(api, "threadDetailPatchResult") ? api.threadDetailPatchResult(true, "patched", { patched: 2 }) : {};
		const mismatch = functionReady(api, "visibleTurnOrderMismatch") ? api.visibleTurnOrderMismatch({
			expectedTurnIds: ["a", "b"],
			renderedDomTurnIds: ["a", "c"]
		}) : false;
		const match = functionReady(api, "visibleTurnOrderMismatch") ? api.visibleTurnOrderMismatch({
			expectedTurnIds: ["a", "b"],
			renderedDomTurnIds: ["a", "b"]
		}) : true;
		const operation = functionReady(api, "normalizeOperation") ? api.normalizeOperation({
			type: "insert",
			key: "turn-a",
			nextEntry: {
				key: "turn-a",
				html: "<article></article>"
			}
		}) : null;
		const htmlUpdate = functionReady(api, "planConversationHtmlUpdate") ? api.planConversationHtmlUpdate({
			html: "<article data-turn-id=\"a\"></article>",
			previousHtml: "<article data-turn-id=\"a\"></article>",
			conversationSignature: "sig-a",
			previousConversationSignature: "sig-a"
		}) : {};
		return {
			ok: patch.ok === true && patch.reason === "patched" && patch.patched === 2 && mismatch === true && match === false && operation && operation.key === "turn-a" && htmlUpdate.action === "hydrate-existing" && htmlUpdate.reason === "signature-stable",
			patchReason: String(patch.reason || ""),
			patched: Number(patch.patched) || 0,
			mismatch,
			match,
			operationKey: String(operation && operation.key || ""),
			htmlAction: String(htmlUpdate.action || "")
		};
	}
	if (id === "draft-store") {
		const memory = /* @__PURE__ */ new Map();
		const store = functionReady(api, "createDraftStore") ? api.createDraftStore({
			storage: {
				getItem(key) {
					return memory.has(key) ? memory.get(key) : null;
				},
				setItem(key, value) {
					memory.set(key, String(value));
				},
				removeItem(key) {
					memory.delete(key);
				}
			},
			maxDrafts: 2
		}) : null;
		if (store && typeof store.writeMap === "function") {
			store.writeMap({
				old: {
					text: "old",
					updatedAt: 1
				},
				newest: {
					text: "newest",
					updatedAt: 3
				},
				middle: {
					text: "middle",
					updatedAt: 2
				}
			});
			store.setTargetKey("new:/repo");
		}
		const draftKeys = store && typeof store.readMap === "function" ? Object.keys(store.readMap()) : [];
		const threadKey = store && typeof store.keyForThread === "function" ? store.keyForThread(" abc ") : "";
		const newThreadKey = store && typeof store.keyForNewThread === "function" ? store.keyForNewThread("C:/Users/xuefu/project/") : "";
		const targetKey = store && typeof store.getTargetKey === "function" ? store.getTargetKey() : "";
		const parsed = functionReady(api, "parseDraftMap") ? api.parseDraftMap("{\"a\":{\"text\":\"draft\"}}") : {};
		const hasContent = functionReady(api, "draftHasContent") ? api.draftHasContent({ permissionMode: "full" }) : false;
		const meta = functionReady(api, "normalizeAttachmentMeta") ? api.normalizeAttachmentMeta({
			id: 7,
			file: {
				name: "screenshot.png",
				type: "image/png",
				size: 42,
				lastModified: 123
			}
		}) : null;
		const attachmentKey = functionReady(api, "attachmentStorageKey") ? api.attachmentStorageKey("new:/a b", "x/y") : "";
		const normalizedPath = functionReady(api, "defaultNormalizeFsPath") ? api.defaultNormalizeFsPath("C:/Users/xuefu/project/") : "";
		return {
			ok: threadKey === "thread:abc" && newThreadKey === "new:c:\\users\\xuefu\\project" && targetKey === "new:/repo" && draftKeys.join(",") === "newest,middle" && parsed && parsed.a && parsed.a.text === "draft" && hasContent === true && meta && meta.id === "7" && meta.size === 42 && attachmentKey === "new%3A%2Fa%20b|x%2Fy" && normalizedPath === "c:\\users\\xuefu\\project",
			threadKey,
			newThreadKey,
			targetKey,
			draftKeys,
			hasContent,
			attachmentKey,
			normalizedPath
		};
	}
	if (id === "image-compressor") {
		const compressible = functionReady(api, "isCompressibleImageFile") ? api.isCompressibleImageFile({
			type: "image/png",
			size: 300 * 1024
		}) : false;
		const smallImage = functionReady(api, "isCompressibleImageFile") ? api.isCompressibleImageFile({
			type: "image/png",
			size: 12 * 1024
		}) : true;
		const dims = functionReady(api, "targetDimensions") ? api.targetDimensions(3e3, 1500, 1200) : {};
		const name = functionReady(api, "compressedImageName") ? api.compressedImageName("folder/screen.png", "image/webp") : "";
		const useful = functionReady(api, "shouldUseCompressedBlob") ? api.shouldUseCompressedBlob({ size: 1e3 }, { size: 800 }) : false;
		const marginal = functionReady(api, "shouldUseCompressedBlob") ? api.shouldUseCompressedBlob({ size: 1e3 }, { size: 930 }) : true;
		return {
			ok: compressible === true && smallImage === false && dims.width === 1200 && dims.height === 600 && dims.scaled === true && name === "folder_screen.webp" && useful === true && marginal === false,
			compressible,
			smallImage,
			width: Number(dims.width) || 0,
			height: Number(dims.height) || 0,
			scaled: Boolean(dims.scaled),
			name,
			useful,
			marginal
		};
	}
	if (id === "plugin-voice-input") {
		const capability = functionReady(api, "capabilityStateMessage") ? api.capabilityStateMessage({
			writable: true,
			threadId: "thread-a",
			draftId: "draft-a",
			actions: [
				"append",
				"replace",
				"submit"
			],
			maxChars: 100
		}) : {};
		const start = functionReady(api, "startRequestMessage") ? api.startRequestMessage({
			requestId: "req-1",
			voiceSessionId: "voice-1",
			capability
		}) : {};
		const insert = functionReady(api, "insertResultMessage") ? api.insertResultMessage({
			ok: false,
			action: "append_text",
			code: "composer_not_writable",
			composerId: "thread-composer"
		}) : {};
		const error = functionReady(api, "errorMessage") ? api.errorMessage({
			code: "voice_error",
			error: "Voice failed"
		}) : {};
		const action = functionReady(api, "normalizeAction") ? api.normalizeAction("append") : "";
		const actionFromType = functionReady(api, "actionFromMessageType") ? api.actionFromMessageType("voice_input.replace_draft") : "";
		const text = functionReady(api, "textFromMessage") ? api.textFromMessage({ text: "  hello\xA0world  " }, 20) : "";
		const voiceMessage = functionReady(api, "isVoiceInputMessage") ? api.isVoiceInputMessage({ type: "voice_input.append_text" }) : false;
		return {
			ok: capability.type === "voice_input.capability_state" && capability.writable === true && Array.isArray(capability.actions) && capability.actions.join(",") === "append_text,replace_draft" && start.type === "voice_input.start_request" && start.requestId === "req-1" && insert.ok === false && insert.code === "composer_not_writable" && error.code === "voice_error" && action === "append_text" && actionFromType === "replace_draft" && text === "hello world" && voiceMessage === true,
			capabilityType: String(capability.type || ""),
			actions: Array.isArray(capability.actions) ? capability.actions : [],
			startType: String(start.type || ""),
			insertCode: String(insert.code || ""),
			errorCode: String(error.code || ""),
			action,
			actionFromType,
			text,
			voiceMessage
		};
	}
	if (id === "api-client") {
		function FakeFormData() {}
		const formData = new FakeFormData();
		const isFormData = functionReady(api, "isFormDataBody") ? api.isFormDataBody(formData, FakeFormData) : false;
		const jsonBody = functionReady(api, "isFormDataBody") ? api.isFormDataBody({ ok: true }, FakeFormData) : true;
		const client = functionReady(api, "createApiClient") ? api.createApiClient({
			fetch: () => Promise.resolve({
				ok: true,
				status: 204
			}),
			AbortControllerCtor: AbortController,
			FormDataCtor: FakeFormData,
			getKey: () => ""
		}) : null;
		return {
			ok: isFormData === true && jsonBody === false && client && typeof client.request === "function",
			isFormData,
			jsonBody,
			requestReady: Boolean(client && typeof client.request === "function")
		};
	}
	if (id === "markdown-renderer") {
		const escaped = functionReady(api, "escapeHtml") ? api.escapeHtml("<tag>&\"") : "";
		const safeUrl = functionReady(api, "safeMarkdownUrl") ? api.safeMarkdownUrl("https://example.com") : "";
		const unsafeUrl = functionReady(api, "safeMarkdownUrl") ? api.safeMarkdownUrl("javascript:alert(1)") : "unsafe";
		const inline = functionReady(api, "renderInlineMarkdown") ? api.renderInlineMarkdown("**bold** <https://example.com>, `code`") : "";
		const block = functionReady(api, "renderMarkdown") ? api.renderMarkdown("# Title\n\n- item\n- **bold**") : "";
		const tableSeparator = functionReady(api, "isMarkdownTableSeparator") ? api.isMarkdownTableSeparator("|---|:---:|") : false;
		const row = functionReady(api, "splitMarkdownTableRow") ? api.splitMarkdownTableRow("| A | B |") : [];
		const list = functionReady(api, "renderMarkdownList") ? api.renderMarkdownList(["1. one", "2. two"], true) : "";
		const table = functionReady(api, "renderMarkdownTable") ? api.renderMarkdownTable([
			"A | B",
			"---|---",
			"1 | 2"
		]) : "";
		return {
			ok: escaped === "&lt;tag&gt;&amp;&quot;" && safeUrl === "https://example.com" && unsafeUrl === "" && inline.includes("<strong>bold</strong>") && inline.includes("<code>code</code>") && block.includes("<h2>Title</h2>") && tableSeparator === true && Array.isArray(row) && row.join(",") === "A,B" && list.includes("<ol>") && table.includes("<table>"),
			escaped,
			safeUrl,
			unsafeUrl,
			row,
			inlineHasStrong: inline.includes("<strong>bold</strong>"),
			blockHasHeading: block.includes("<h2>Title</h2>"),
			listHasOl: list.includes("<ol>"),
			tableHasTable: table.includes("<table>")
		};
	}
	if (id === "plugin-embed") {
		const detected = functionReady(api, "detect") ? api.detect("http://127.0.0.1/?embed=hermes&pluginId=codex-mobile&pluginRoute=thread&pluginThreadId=t1&pluginTheme=dark&pluginFontSize=large") : {};
		const navigation = functionReady(api, "navigationMessage") ? api.navigationMessage({ currentThreadId: "t1" }, {}) : {};
		const openPlan = functionReady(api, "routeHintOpenPlan") ? api.routeHintOpenPlan({
			pluginId: "codex-mobile",
			threadId: "t1",
			itemId: "i1"
		}) : {};
		const selectors = functionReady(api, "routeHintTargetSelectors") ? api.routeHintTargetSelectors({ itemId: "i1" }) : [];
		const scrubbed = functionReady(api, "scrubRouteHintPath") ? api.scrubRouteHintPath("http://127.0.0.1/thread?pluginId=codex-mobile&pluginThreadId=t1", {
			workspaceId: "ws1",
			appearance: { theme: "dark" }
		}) : "";
		const external = functionReady(api, "externalLinkMessage") ? api.externalLinkMessage({ href: "https://example.com/a" }) : {};
		const refresh = functionReady(api, "refreshRequiredMessage") ? api.refreshRequiredMessage({
			reason: "version_changed",
			route: {
				kind: "thread",
				threadId: "t1"
			},
			appearance: { theme: "light" }
		}) : {};
		return {
			ok: detected.embedded === true && detected.routeHint && detected.routeHint.threadId === "t1" && detected.appearance && detected.appearance.theme === "dark" && navigation.type === "codex-mobile.plugin.navigation" && navigation.canGoBack === true && openPlan.action === "openThread" && Array.isArray(selectors) && selectors[0] === "[data-approval-card=\"i1\"]" && scrubbed === "/thread?embed=hermes&workspaceId=ws1&pluginTheme=dark" && external.type === "codex-mobile.plugin.external_link" && refresh.type === "codex-mobile.plugin.refresh_required",
			embedded: Boolean(detected.embedded),
			routeThreadId: String(detected.routeHint && detected.routeHint.threadId || ""),
			navigationType: String(navigation.type || ""),
			canGoBack: Boolean(navigation.canGoBack),
			openAction: String(openPlan.action || ""),
			firstSelector: String(selectors[0] || ""),
			scrubbed,
			externalType: String(external.type || ""),
			refreshType: String(refresh.type || "")
		};
	}
	if (id === "frontend-runtime-health") {
		const token = functionReady(api, "compactToken") ? api.compactToken(" Home AI / Thread Detail ", "fallback", 20) : "";
		const missingEffects = functionReady(api, "submittedMessageDomProbeEffects") ? api.submittedMessageDomProbeEffects({
			elapsedMs: 300,
			currentThreadMatch: true,
			hasThreadSubmission: true,
			domHasSubmission: false,
			threadHash: "abc"
		}) : {};
		const stallEffects = functionReady(api, "threadListInteractionStallEffects") ? api.threadListInteractionStallEffects({
			threadListVisible: true,
			threadListMonitorable: true,
			maxRafDelayMs: 640,
			minDelayMs: 500
		}) : {};
		const monitor = functionReady(api, "createMonitor") ? api.createMonitor({ now: () => 1e3 }) : null;
		const monitorResult = monitor && typeof monitor.recordRender === "function" ? monitor.recordRender({
			fullRender: false,
			fallbackApplied: false,
			previousCount: 2,
			domCount: 2,
			visibleCount: 2,
			duplicateCount: 0
		}) : {};
		const dropEvent = functionReady(api, "domDropEvent") ? api.domDropEvent({
			previousCount: 3,
			domCount: 1,
			visibleCount: 3
		}) : {};
		const success = functionReady(api, "runtimeSuccess") ? api.runtimeSuccess({
			diagnosticType: "render_dom_drop",
			errorCode: "render_dom_drop"
		}) : {};
		return {
			ok: token === "Home_AI_Thread_Detai" && missingEffects.reason === "submitted-message-dom-missing" && Array.isArray(missingEffects.effects) && missingEffects.effects[0] && missingEffects.effects[0].type === "diagnostic-failure" && stallEffects.reason === "thread-list-interaction-stall" && monitorResult.renderCount === 1 && Array.isArray(monitorResult.effects) && monitorResult.effects.length === 2 && dropEvent.diagnostic_type === "render_dom_drop" && success.error_code === "render_dom_drop",
			token,
			missingReason: String(missingEffects.reason || ""),
			stallReason: String(stallEffects.reason || ""),
			monitorRenderCount: Number(monitorResult.renderCount) || 0,
			dropDiagnosticType: String(dropEvent.diagnostic_type || ""),
			successErrorCode: String(success.error_code || "")
		};
	}
	if (id === "home-ai-diagnostic-reporting") {
		const token = functionReady(api, "boundedToken") ? api.boundedToken(" Home AI / Codex Mobile ", "fallback", 16) : "";
		const duration = functionReady(api, "durationBucket") ? api.durationBucket(4200) : "";
		const hash = functionReady(api, "hashIdentifier") ? api.hashIdentifier("thread-title", "t") : "";
		const sanitized = functionReady(api, "sanitizeInput") ? api.sanitizeInput({
			diagnostic_type: "render_lag",
			error_code: "lag",
			counts: {
				ok_count: 3,
				raw_body: 4
			},
			context: {
				thread_hash: "abc",
				title: "unsafe"
			}
		}) : {};
		const reporter = functionReady(api, "createDiagnosticReporter") ? api.createDiagnosticReporter({
			threshold: 2,
			throttleMs: 0,
			now: () => 1e3
		}) : null;
		const first = reporter && typeof reporter.recordFailure === "function" ? reporter.recordFailure({
			diagnostic_type: "render_lag",
			error_code: "lag"
		}) : {};
		const second = reporter && typeof reporter.recordFailure === "function" ? reporter.recordFailure({
			diagnostic_type: "render_lag",
			error_code: "lag"
		}) : {};
		const post = functionReady(api, "postReportToHomeAi") ? api.postReportToHomeAi({
			embedded: false,
			report: second.report
		}) : {};
		const textHash = functionReady(api, "stableTextHash") ? api.stableTextHash("diagnostic") : "";
		return {
			ok: token === "Home_AI_Codex_Mo" && duration === "3_10s" && /^t_/.test(hash) && sanitized.category === "codex_runtime_failure" && sanitized.counts && sanitized.counts.ok_count === 3 && !Object.prototype.hasOwnProperty.call(sanitized.counts || {}, "raw_body") && first.eligible === false && second.eligible === true && post.reason === "not_embedded" && textHash.length > 0,
			token,
			duration,
			hashPrefix: String(hash || "").slice(0, 2),
			sanitizedCategory: String(sanitized.category || ""),
			secondEligible: Boolean(second.eligible),
			postReason: String(post.reason || ""),
			textHash
		};
	}
	if (id === "thread-diagnostic-events") {
		const snapshot = functionReady(api, "conversationProjectionDiagnosticSnapshot") ? api.conversationProjectionDiagnosticSnapshot({
			renderedConversationSignature: "old",
			currentSignature: "new",
			domShape: {
				renderKeyCount: 1,
				duplicateRenderKeyCount: 1
			},
			thread: { mobileReadMode: "thread-read" }
		}, { visibleShape: () => ({
			visibleTurnCount: 2,
			visibleItemCount: 3
		}) }) : {};
		const order = functionReady(api, "turnOrderDiagnosticSnapshot") ? api.turnOrderDiagnosticSnapshot({
			expectedTurnIds: ["a", "b"],
			domTurnIds: ["a"],
			threadHash: "thread"
		}) : {};
		const effects = functionReady(api, "conversationProjectionConsistencyEffects") ? api.conversationProjectionConsistencyEffects({
			snapshot,
			orderSnapshot: order
		}) : {};
		const renderEvent = functionReady(api, "renderSignatureMismatchDiagnosticEvent") ? api.renderSignatureMismatchDiagnosticEvent(snapshot) : {};
		const responseEffects = functionReady(api, "threadDetailResponseDiagnosticEffects") ? api.threadDetailResponseDiagnosticEffects({ contractPlan: {
			shouldReport: true,
			reason: "contract",
			turns: 2,
			items: 3,
			visibleItems: 3,
			readMode: "thread-read"
		} }) : {};
		const normalized = functionReady(api, "projectionDiagnosticSnapshot") ? api.projectionDiagnosticSnapshot(snapshot) : {};
		const count = functionReady(api, "boundedCount") ? api.boundedCount(100001) : 0;
		const token = functionReady(api, "compactToken") ? api.compactToken(" Detail / Render ", "fallback", 20) : "";
		return {
			ok: snapshot.renderedSignature === "old" && normalized.counts && normalized.counts.visible_count === 3 && order.counts && order.counts.latest_mismatch_count === 1 && Array.isArray(effects.effects) && effects.effects.length === 3 && renderEvent.diagnostic_type === "render_signature_mismatch" && Array.isArray(responseEffects.effects) && responseEffects.effects[0] && responseEffects.effects[0].type === "diagnostic-failure" && count === 1e5 && token === "Detail_Render",
			renderedSignature: String(snapshot.renderedSignature || ""),
			visibleCount: Number(normalized.counts && normalized.counts.visible_count) || 0,
			latestMismatch: Number(order.counts && order.counts.latest_mismatch_count) || 0,
			effectCount: Array.isArray(effects.effects) ? effects.effects.length : 0,
			renderDiagnosticType: String(renderEvent.diagnostic_type || ""),
			responseEffectCount: Array.isArray(responseEffects.effects) ? responseEffects.effects.length : 0,
			count,
			token
		};
	}
	if (id === "thread-tile-layout") {
		const layout = functionReady(api, "layoutForViewport") ? api.layoutForViewport({
			enabled: true,
			viewportWidth: 1500,
			viewportHeight: 900,
			sidebarWidth: 0,
			coarsePointer: true,
			orientation: "landscape",
			menuOverlay: true
		}) : null;
		const ids = functionReady(api, "selectThreadTileIds") ? api.selectThreadTileIds({
			currentThreadId: "thread-2",
			pinnedThreadIds: ["thread-3", "thread-2"],
			threadIds: [
				"thread-1",
				"thread-3",
				"thread-4"
			],
			maxPanes: 3
		}) : [];
		const pinnedIds = functionReady(api, "selectPinnedThreadTileIds") ? api.selectPinnedThreadTileIds({
			currentThreadId: "thread-current",
			pinnedThreadIds: [
				"thread-1",
				"thread-2",
				"thread-3"
			],
			threadIds: ["thread-current", "thread-4"],
			maxPanes: 3
		}) : [];
		const pairs = functionReady(api, "normalizeSplitPairs") ? api.normalizeSplitPairs([{
			anchorId: "b",
			childId: "e"
		}, {
			anchorId: "b",
			childId: "c"
		}], [
			"a",
			"b",
			"c",
			"d",
			"e"
		]) : [];
		const groups = functionReady(api, "threadTileColumnGroups") ? api.threadTileColumnGroups({
			ids: [
				"a",
				"b",
				"c",
				"d",
				"e"
			],
			columns: 4,
			splitPairs: [{
				anchorId: "b",
				childId: "e"
			}]
		}) : [];
		return {
			ok: !!layout && layout.enabled === true && layout.columns === 4 && ids.join(",") === "thread-2,thread-3,thread-1" && pinnedIds.join(",") === "thread-1,thread-2,thread-current" && pairs.length === 1 && pairs[0].anchorId === "b" && pairs[0].childId === "e" && JSON.stringify(groups) === JSON.stringify([
				["a"],
				["b", "e"],
				["c"],
				["d"]
			]),
			layout,
			ids,
			pinnedIds,
			pairs,
			groups
		};
	}
	if (id === "thread-tile-actions") {
		const paneA = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-pane" ? "thread-a" : "";
			},
			closest() {
				return null;
			}
		};
		const paneB = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-pane" ? "thread-b" : "";
			},
			closest() {
				return null;
			}
		};
		const title = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-title" ? "thread-a" : "";
			},
			closest(selector) {
				return selector === "[data-thread-tile-pane]" ? paneA : null;
			}
		};
		const handle = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-drag-handle" ? "thread-a" : "";
			},
			closest(selector) {
				return selector === "[data-thread-tile-pane]" ? paneA : null;
			}
		};
		const bottom = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-bottom" ? "thread-a" : "";
			},
			closest() {
				return null;
			}
		};
		const root = { contains(node) {
			return node === paneA || node === paneB || node === title || node === handle || node === bottom;
		} };
		const titleTarget = { closest(selector) {
			return selector === "[data-thread-tile-title]" ? title : selector === "[data-thread-tile-pane]" ? paneA : null;
		} };
		const bottomTarget = { closest(selector) {
			return selector === "[data-thread-tile-bottom]" ? bottom : null;
		} };
		const handleTarget = { closest(selector) {
			return selector === "[data-thread-tile-drag-handle]" ? handle : null;
		} };
		const paneBTarget = { closest(selector) {
			return selector === "[data-thread-tile-pane]" ? paneB : null;
		} };
		const pointer = functionReady(api, "resolveThreadTilePointerAction") ? api.resolveThreadTilePointerAction({
			root,
			target: titleTarget
		}) : {};
		const click = functionReady(api, "resolveThreadTileClickAction") ? api.resolveThreadTileClickAction({
			root,
			target: bottomTarget
		}) : {};
		const dragStart = functionReady(api, "resolveThreadTileDragStartAction") ? api.resolveThreadTileDragStartAction({
			root,
			target: handleTarget
		}) : {};
		const drop = functionReady(api, "resolveThreadTileDropAction") ? api.resolveThreadTileDropAction({
			root,
			target: paneBTarget,
			draggingId: "thread-a"
		}) : {};
		return {
			ok: pointer.action === "select-pane" && pointer.paneId === "thread-a" && click.action === "scroll-pane-bottom" && click.preventDefault === true && dragStart.action === "drag-start" && dragStart.paneId === "thread-a" && drop.action === "drop-pane" && drop.draggingId === "thread-a" && drop.targetId === "thread-b",
			pointerAction: String(pointer.action || ""),
			clickAction: String(click.action || ""),
			dragStartAction: String(dragStart.action || ""),
			dropAction: String(drop.action || "")
		};
	}
	if (id === "thread-tile-state") {
		const candidate = functionReady(api, "candidatePaneIdsPlan") ? api.candidatePaneIdsPlan({
			defaultIds: ["thread-a", "thread-b"],
			visibleIds: ["thread-a", "thread-b"],
			pinnedIds: ["thread-b"],
			currentThreadId: "thread-a",
			maxPanes: 2
		}) : {};
		const paneCount = functionReady(api, "normalizePaneCount") ? api.normalizePaneCount("3", { maxPanes: 12 }) : 0;
		const refreshDelay = functionReady(api, "refreshDelayMs") ? api.refreshDelayMs({
			visible: true,
			active: true
		}) : 0;
		const loadSuccess = functionReady(api, "detailLoadSuccessEffectsPlan") ? api.detailLoadSuccessEffectsPlan({
			threadId: "thread-a",
			hasThread: true,
			nowMs: 1234
		}) : {};
		const selected = functionReady(api, "effectiveSelectedThreadId") ? api.effectiveSelectedThreadId({
			ids: ["thread-a", "thread-b"],
			selectedThreadId: "thread-a",
			currentThreadId: "thread-b"
		}) : "";
		return {
			ok: candidate.action === "candidate-pane-ids" && candidate.ids && candidate.ids.join(",") === "thread-b,thread-a" && paneCount === 3 && refreshDelay === 500 && loadSuccess.reason === "thread-loaded" && loadSuccess.loadedAtMs === 1234 && selected === "thread-a",
			candidateIds: Array.isArray(candidate.ids) ? candidate.ids : [],
			paneCount,
			refreshDelay,
			loadSuccessReason: String(loadSuccess.reason || ""),
			selected
		};
	}
	if (id === "thread-tile-runtime") {
		const statePolicy = globalThis.CodexThreadTileState || {};
		const layoutPolicy = globalThis.CodexThreadTileLayout || {};
		const actionsApi = globalThis.CodexThreadTileActions || {};
		const runtime = functionReady(api, "createThreadTileRuntime") ? api.createThreadTileRuntime({
			state: {
				threadTileMode: true,
				threadTilePaneCount: "3",
				threadTilePinnedThreadIds: [
					"thread-b",
					"thread-a",
					"thread-b"
				],
				threadTileSplitPairs: [{
					anchorId: "thread-a",
					childId: "thread-c"
				}],
				threads: [
					{
						id: "thread-a",
						status: "running"
					},
					{
						id: "thread-b",
						status: "idle"
					},
					{
						id: "thread-c",
						status: "idle"
					}
				],
				currentThreadId: "thread-b",
				threadDisplaySettingsLoaded: true,
				threadTileViewportBaseline: null,
				threadTileComposerHeightBaselinePx: 0,
				composerHeightPx: 0
			},
			document: {
				documentElement: {
					clientWidth: 1400,
					clientHeight: 900
				},
				activeElement: null
			},
			window: {
				innerWidth: 1400,
				innerHeight: 900,
				visualViewport: {
					width: 1320,
					height: 820
				},
				matchMedia: () => ({ matches: false })
			},
			threadTileStatePolicy: statePolicy,
			threadTileLayoutPolicy: layoutPolicy,
			threadTileActionsApi: actionsApi,
			THREAD_TILE_USER_MAX_PANES: 6,
			THREAD_TILE_REFRESH_INTERVAL_MS: 5e3,
			THREAD_TILE_REFRESH_MIN_INTERVAL_MS: 500,
			STORAGE_THREAD_DISPLAY_MODE: "codex.threadDisplayMode",
			STORAGE_LEGACY_THREAD_TILE_MODE: "codex.legacyThreadTileMode",
			$: () => null,
			isKeyboardEditableElement: () => false,
			splitPaneSidebarVisible: () => false,
			isMenuOverlayMode: () => false,
			visibleThreads: (threads) => Array.isArray(threads) ? threads : [],
			isRunningStatus: (status) => status === "running" || status === "in_progress"
		}) : {};
		const viewport = runtime && typeof runtime.viewportPixelSize === "function" ? runtime.viewportPixelSize({ preferLayoutViewport: true }) : {};
		const paneCount = runtime && typeof runtime.normalizeThreadTilePaneCount === "function" ? runtime.normalizeThreadTilePaneCount("3", 1) : 0;
		const pinnedIds = runtime && typeof runtime.normalizeThreadTilePinnedIds === "function" ? runtime.normalizeThreadTilePinnedIds([
			"thread-b",
			"thread-a",
			"thread-b"
		]) : [];
		const idsEqual = runtime && typeof runtime.threadTileIdsEqual === "function" ? runtime.threadTileIdsEqual(["thread-a", "thread-b"], ["thread-a", "thread-b"]) : false;
		const payload = runtime && typeof runtime.threadDisplaySettingsPayload === "function" ? runtime.threadDisplaySettingsPayload() : {};
		const layout = runtime && typeof runtime.threadTileLayout === "function" ? runtime.threadTileLayout({ enabled: true }) : {};
		const status = runtime && typeof runtime.threadTileLayoutStatusText === "function" ? runtime.threadTileLayoutStatusText(layout) : "";
		return {
			ok: runtime && typeof runtime === "object" && viewport.width === 1400 && viewport.height === 900 && paneCount === 3 && pinnedIds.join(",") === "thread-b,thread-a" && idsEqual === true && payload.displayMode === "tile" && payload.paneCount === 3 && layout.enabled === true && status === "当前视口：平铺 3/3 窗",
			factoryType: typeof api.createThreadTileRuntime,
			viewportWidth: Number(viewport.width) || 0,
			viewportHeight: Number(viewport.height) || 0,
			paneCount,
			pinnedIds,
			idsEqual,
			displayMode: String(payload.displayMode || ""),
			layoutColumns: Number(layout.columns) || 0,
			status
		};
	}
	if (id === "app-update-runtime") {
		const runtime = functionReady(api, "createAppUpdateRuntime") ? api.createAppUpdateRuntime({
			CLIENT_BUILD_ID: "0.1.11|codex-mobile-shell-v625-a5a3d596240d",
			state: {
				appVersion: "0.1.11",
				publicReleaseEnabled: true
			},
			PAGE_SHELL_ASSETS: ["/app.js", "/sw.js"],
			escapeHtml: (value) => String(value == null ? "" : value),
			buildRefreshPolicy: { shouldPromptForServerBuildChange: () => true }
		}) : null;
		const client = runtime && typeof runtime.clientBuildVersionText === "function" ? runtime.clientBuildVersionText() : "";
		const version = runtime && typeof runtime.appVersionText === "function" ? runtime.appVersionText({ version: "0.1.11" }) : "";
		const updateLine = runtime && typeof runtime.updateStatusLine === "function" ? runtime.updateStatusLine({
			updateAvailable: true,
			canFastForward: true,
			remoteShort: "abc123"
		}) : "";
		const publicLine = runtime && typeof runtime.publicReleaseStatusLine === "function" ? runtime.publicReleaseStatusLine({
			updateAvailable: true,
			publicShort: "def456"
		}) : "";
		const serverBuild = runtime && typeof runtime.serverBuildIdFromConfig === "function" ? runtime.serverBuildIdFromConfig({
			clientBuildId: "client-a",
			shellCacheName: "cache-a"
		}) : "";
		return {
			ok: runtime && typeof runtime.refreshPageForNewBuild === "function" && client === "客户端 v625" && version === "v0.1.11 · 客户端 v625" && updateLine === "Update available: abc123" && publicLine === "Public latest: def456" && serverBuild === "client-a",
			client,
			version,
			updateLine,
			publicLine,
			serverBuild,
			refreshReady: Boolean(runtime && typeof runtime.refreshPageForNewBuild === "function")
		};
	}
	if (id === "modal-runtime") {
		const runtime = functionReady(api, "createModalRuntime") ? api.createModalRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.requestAppNativeDialog === "function" && typeof runtime.requestAppAlert === "function" && typeof runtime.requestAppConfirmation === "function" && typeof runtime.requestAppTextInput === "function" && typeof runtime.requestCodexProfileSwitchConfirmation === "function" && typeof globalThis.handleAppNativeDialogKeydown === "function" && typeof globalThis.closeAppNativeDialog === "function" && typeof globalThis.performCodexProfileSwitch === "function",
			factoryType: typeof api.createModalRuntime,
			nativeDialogType: typeof (runtime && runtime.requestAppNativeDialog),
			alertType: typeof (runtime && runtime.requestAppAlert),
			confirmationType: typeof (runtime && runtime.requestAppConfirmation),
			textInputType: typeof (runtime && runtime.requestAppTextInput),
			profileSwitchType: typeof (runtime && runtime.requestCodexProfileSwitchConfirmation),
			keydownType: typeof globalThis.handleAppNativeDialogKeydown,
			closeType: typeof globalThis.closeAppNativeDialog,
			switchType: typeof globalThis.performCodexProfileSwitch
		};
	}
	if (id === "runtime-wiring-runtime") {
		const runtime = functionReady(api, "createRuntimeWiringRuntime") ? api.createRuntimeWiringRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.initialize === "function",
			factoryType: typeof api.createRuntimeWiringRuntime,
			initializeType: typeof (runtime && runtime.initialize),
			globalType: typeof globalThis.CodexRuntimeWiringRuntime
		};
	}
	if (id === "app-shell-runtime") {
		const runtime = functionReady(api, "createAppShellRuntime") ? api.createAppShellRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.wireUi === "function" && typeof runtime.start === "function" && typeof runtime.startCodexMobileAppWithRecovery === "function",
			factoryType: typeof api.createAppShellRuntime,
			wireUiType: typeof (runtime && runtime.wireUi),
			startType: typeof (runtime && runtime.start),
			recoveryType: typeof (runtime && runtime.startCodexMobileAppWithRecovery),
			globalType: typeof globalThis.CodexAppShellRuntime
		};
	}
	if (id === "thread-list-runtime") {
		const runtime = functionReady(api, "createThreadListRuntime") ? api.createThreadListRuntime({}) : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderThreads === "function" && typeof runtime.loadThreads === "function",
			factoryType: typeof api.createThreadListRuntime,
			renderThreadsType: typeof (runtime && runtime.renderThreads),
			loadThreadsType: typeof (runtime && runtime.loadThreads)
		};
	}
	if (id === "side-chat-runtime") {
		const state = {
			currentThreadId: "thread-a",
			currentThread: { id: "thread-a" },
			threadSideChats: /* @__PURE__ */ new Map(),
			nowMs: Date.parse("2026-07-02T00:00:00Z")
		};
		const runtime = functionReady(api, "createSideChatRuntime") ? api.createSideChatRuntime({
			state,
			api: async () => ({ sideChat: null }),
			escapeHtml: (value) => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
			statusText: (status) => String(status || ""),
			formatTime: () => "now",
			truncateMiddle: (value) => String(value || "")
		}) : {};
		const normalized = runtime && typeof runtime.normalizeSideChatState === "function" ? runtime.normalizeSideChatState({
			messages: [{
				role: "assistant",
				text: "hi"
			}],
			sidecar: { status: "pending" }
		}, "thread-a") : {};
		if (runtime && typeof runtime.setSideChatState === "function") runtime.setSideChatState("thread-a", normalized);
		const path = runtime && typeof runtime.sideChatApiPath === "function" ? runtime.sideChatApiPath("thread-a", "/draft") : "";
		const status = runtime && typeof runtime.sideChatStatusLabel === "function" ? runtime.sideChatStatusLabel("queued") : "";
		const queue = runtime && typeof runtime.sideChatQueueSummary === "function" ? runtime.sideChatQueueSummary({
			status: "queued",
			mode: "autoSendWhenIdle"
		}) : "";
		const pending = runtime && typeof runtime.sideChatReplyPending === "function" ? runtime.sideChatReplyPending("thread-a") : false;
		const subagentKind = runtime && typeof runtime.subagentStatusKind === "function" ? runtime.subagentStatusKind("running") : "";
		const subagentLabel = runtime && typeof runtime.subagentStatusLabel === "function" ? runtime.subagentStatusLabel("running") : "";
		const panel = runtime && typeof runtime.renderSideChatPanel === "function" ? runtime.renderSideChatPanel() : "";
		return {
			ok: runtime && typeof runtime === "object" && normalized.threadId === "thread-a" && Array.isArray(normalized.messages) && normalized.messages.length === 1 && path === "/api/threads/thread-a/side-chat/draft" && status === "已排队" && queue === "已排队 · 完成后自动发送" && pending === true && subagentKind === "running" && subagentLabel === "运行中" && String(panel || "").includes("side-chat-section"),
			factoryType: typeof api.createSideChatRuntime,
			normalizedThreadId: String(normalized.threadId || ""),
			messageCount: Array.isArray(normalized.messages) ? normalized.messages.length : 0,
			path,
			status,
			queue,
			pending,
			subagentKind,
			subagentLabel,
			panelReady: String(panel || "").includes("side-chat-section")
		};
	}
	if (id === "media-preview-runtime") {
		const element = {
			classList: {
				contains: () => false,
				add: () => {},
				remove: () => {},
				toggle: () => {}
			},
			dataset: {},
			style: {
				setProperty: () => {},
				removeProperty: () => {}
			},
			querySelector: () => null,
			querySelectorAll: () => [],
			closest: () => null,
			addEventListener: () => {},
			removeEventListener: () => {},
			appendChild: () => {},
			setAttribute: () => {},
			getAttribute: () => "",
			removeAttribute: () => {},
			textContent: "",
			innerText: id === "messageInput" ? "hello" : "",
			innerHTML: ""
		};
		const document = {
			documentElement: {
				getAttribute: () => "light",
				setAttribute: () => {}
			},
			head: element,
			createElement: () => Object.assign({}, element),
			getElementById: () => Object.assign({}, element),
			querySelector: () => null,
			querySelectorAll: () => []
		};
		const runtime = functionReady(api, "createMediaPreviewRuntime") ? api.createMediaPreviewRuntime({
			state: {
				key: "sample-key",
				currentThreadId: "thread-a",
				currentThread: { id: "thread-a" }
			},
			document,
			window: {
				location: {
					origin: "http://127.0.0.1:8787",
					pathname: "/"
				},
				CodexMarkdownRenderer: {
					renderMarkdown: (value) => `<p>${String(value == null ? "" : value)}</p>`,
					normalizeMermaidSourceForRender: (value) => String(value || "")
				},
				matchMedia: () => ({ matches: true }),
				setTimeout: (callback) => {
					if (typeof callback === "function") callback();
					return 1;
				},
				clearTimeout: () => {}
			},
			$: () => Object.assign({}, element),
			api: async () => ({}),
			escapeHtml: (value) => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
			normalizeFsPath: (value) => String(value || ""),
			shortPath: (value) => String(value || "").split("/").pop() || "",
			compactStructuredForSignature: (value) => JSON.stringify(value),
			visibleThreadTaskCardCommandText: (value) => String(value || ""),
			rememberCopyText: (value) => String(value || ""),
			copyButtonHtml: () => "<button></button>",
			stableTextHash: (value) => `hash:${String(value || "").length}`,
			renderContextThreadId: () => "thread-a",
			publishPluginNavigationState: () => {},
			postPerformanceEvent: () => {},
			roundedDurationMs: () => 1,
			nowPerfMs: () => 1,
			isHermesEmbedMode: () => false,
			isIosWebKitBrowser: () => false,
			requestHermesPluginRefresh: () => {},
			primaryTouch: (event) => event && event.touches && event.touches[0] || null
		}) : {};
		const githubUrl = runtime && typeof runtime.normalizeGithubPreviewUrl === "function" ? runtime.normalizeGithubPreviewUrl("https://github.com/openai/codex/pull/7") : "";
		const jsonPreview = runtime && typeof runtime.renderFilePreviewContent === "function" ? runtime.renderFilePreviewContent({
			kind: "json",
			content: "{\"ok\":true}"
		}) : "";
		return {
			ok: runtime && typeof runtime === "object" && githubUrl === "https://github.com/openai/codex/pull/7" && String(jsonPreview || "").includes("file-preview-text") && typeof runtime.renderMarkdownWithAttachmentSummary === "function" && typeof runtime.openImagePreviewFromImage === "function" && typeof runtime.renderImageView === "function" && typeof runtime.scheduleVisibleImageFailureScan === "function",
			factoryType: typeof api.createMediaPreviewRuntime,
			githubUrl,
			jsonPreviewReady: String(jsonPreview || "").includes("file-preview-text"),
			markdownType: typeof (runtime && runtime.renderMarkdownWithAttachmentSummary),
			imagePreviewType: typeof (runtime && runtime.openImagePreviewFromImage),
			imageViewType: typeof (runtime && runtime.renderImageView),
			scanType: typeof (runtime && runtime.scheduleVisibleImageFailureScan)
		};
	}
	if (id === "composer-runtime") {
		const elements = /* @__PURE__ */ new Map();
		const element = (id = "") => ({
			id,
			value: id === "messageInput" ? "hello" : "",
			files: [],
			classList: {
				contains: () => false,
				add: () => {},
				remove: () => {},
				toggle: () => {}
			},
			dataset: {},
			style: {
				setProperty: () => {},
				removeProperty: () => {}
			},
			getBoundingClientRect: () => ({
				width: 120,
				height: 32,
				left: 0,
				top: 0,
				right: 120,
				bottom: 32
			}),
			focus: () => {},
			blur: () => {},
			select: () => {},
			setSelectionRange: () => {},
			querySelector: () => null,
			querySelectorAll: () => [],
			closest: () => null,
			addEventListener: () => {},
			removeEventListener: () => {},
			appendChild: () => {},
			setAttribute: () => {},
			getAttribute: () => "",
			removeAttribute: () => {},
			textContent: "",
			innerHTML: ""
		});
		function getElement(id) {
			if (!elements.has(id)) elements.set(id, element(id));
			return elements.get(id);
		}
		const runtime = functionReady(api, "createComposerRuntime") ? api.createComposerRuntime({
			state: {
				threads: [],
				pendingAttachments: [],
				composerRuntimeSelection: {},
				codexProfiles: [],
				currentThreadId: "thread-a",
				currentThread: { id: "thread-a" },
				newThreadDraft: false
			},
			document: {
				documentElement: { style: {
					setProperty: () => {},
					removeProperty: () => {}
				} },
				activeElement: null,
				addEventListener: () => {},
				removeEventListener: () => {},
				createElement: () => element(),
				getElementById: getElement,
				querySelector: () => null,
				querySelectorAll: () => []
			},
			window: {
				setTimeout: (callback) => {
					if (typeof callback === "function") callback();
					return 1;
				},
				clearTimeout: () => {},
				requestAnimationFrame: (callback) => {
					if (typeof callback === "function") callback();
					return 1;
				},
				crypto: { randomUUID: () => "sample-uuid" },
				visualViewport: {
					width: 390,
					height: 700
				},
				innerWidth: 390,
				innerHeight: 700
			},
			$: getElement,
			api: async () => ({}),
			escapeHtml: (value) => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
			viewportMetrics: {
				cssPixel: (value) => Math.round(Number(value) || 0),
				stablePixelChanged: (left, right) => Math.abs((Number(left) || 0) - (Number(right) || 0)) >= 2
			},
			normalizeOptionList: (values) => Array.isArray(values) ? values.filter(Boolean).map((value) => String(value).trim()) : [],
			labelForModel: (value) => `Model ${String(value || "")}`.trim(),
			labelForEffort: (value) => `Effort ${String(value || "")}`.trim(),
			labelForPermissionMode: (value) => `Permission ${String(value || "")}`.trim(),
			defaultNewThreadModel: () => "gpt-5.5",
			defaultNewThreadEffort: () => "medium",
			defaultNewThreadPermissionMode: () => "auto",
			effectiveComposerPermissionMode: (value) => String(value || "").trim() || "auto",
			newThreadSelectedModel: () => "",
			newThreadSelectedEffort: () => "",
			newThreadSelectedPermissionMode: () => "",
			currentComposerThreadId: () => "thread-a",
			composerTargetThread: () => ({
				id: "thread-a",
				model: "gpt-5.5",
				effort: "medium",
				runtimeSettings: { permissionMode: "auto" }
			}),
			selectedQuotaModel: () => "gpt-5.5",
			threadDisplayName: () => "Thread A",
			isThreadTileComposerContext: () => false,
			isAndroidBrowser: () => false,
			isHermesEmbedMode: () => false,
			isKeyboardEditableElement: () => false,
			threadTileStatePolicy: { composerTargetPlaceholderPlan: () => ({ text: "Send to Thread A" }) },
			imageCompressor: {},
			homeAiDiagnosticReportingApi: {}
		}) : {};
		const model = runtime && typeof runtime.effectiveDefaultModel === "function" ? runtime.effectiveDefaultModel() : "";
		const effort = runtime && typeof runtime.effectiveDefaultEffort === "function" ? runtime.effectiveDefaultEffort() : "";
		const permission = runtime && typeof runtime.effectiveDefaultPermissionMode === "function" ? runtime.effectiveDefaultPermissionMode() : "";
		const label = runtime && typeof runtime.runtimeOptionLabel === "function" ? runtime.runtimeOptionLabel("model", "gpt-5.5") : "";
		const placeholder = runtime && typeof runtime.composerPlaceholderText === "function" ? runtime.composerPlaceholderText() : "";
		return {
			ok: runtime && typeof runtime === "object" && model === "gpt-5.5" && effort === "medium" && permission === "auto" && label === "Model gpt-5.5" && placeholder === "Send to Thread A" && typeof runtime.sendMessage === "function" && typeof runtime.sendNewThreadMessage === "function" && typeof runtime.interruptActiveTurn === "function",
			factoryType: typeof api.createComposerRuntime,
			model,
			effort,
			permission,
			label,
			placeholder,
			sendType: typeof (runtime && runtime.sendMessage),
			newThreadType: typeof (runtime && runtime.sendNewThreadMessage),
			interruptType: typeof (runtime && runtime.interruptActiveTurn)
		};
	}
	if (id === "thread-list-load-policy") {
		const plan = functionReady(api, "planThreadListLoadRequest") ? api.planThreadListLoadRequest({
			silent: true,
			threadDetailOpening: true,
			deferFallback: true
		}) : {};
		return {
			ok: plan && plan.action === "thread-list-load-request" && plan.shouldLoad === false && plan.skipReason === "detail-in-flight" && plan.retryDelayMs === 700,
			action: String(plan && plan.action || ""),
			shouldLoad: Boolean(plan && plan.shouldLoad),
			skipReason: String(plan && plan.skipReason || ""),
			retryDelayMs: Number(plan && plan.retryDelayMs) || 0
		};
	}
	if (id === "thread-list-stable-order") {
		const scopeKey = functionReady(api, "threadListOrderScopeKey") ? api.threadListOrderScopeKey({
			selectedCwd: "/tmp/project",
			search: "Home"
		}) : "";
		const plan = functionReady(api, "planThreadListStableOrder") ? api.planThreadListStableOrder({
			threads: [
				{ id: "b" },
				{ id: "a" },
				{ id: "c" }
			],
			previousState: {
				scopeKey,
				holdUntilMs: 2e3,
				order: ["a", "b"]
			},
			scopeKey,
			nowMs: 1e3,
			holdMs: 5e3
		}) : {};
		const order = Array.isArray(plan.order) ? plan.order : [];
		return {
			ok: scopeKey === JSON.stringify({
				cwd: "/tmp/project",
				search: "home"
			}) && plan.held === true && order.join(",") === "a,b,c",
			scopeKey,
			held: Boolean(plan.held),
			order
		};
	}
	if (id === "thread-status-hints") {
		const running = functionReady(api, "isRunningStatus") ? api.isRunningStatus("in_progress") : false;
		const unread = functionReady(api, "shouldMarkThreadUnread") ? api.shouldMarkThreadUnread({
			threadId: "target-thread",
			currentThreadId: "other-thread",
			status: "completed",
			thread: { turns: [{
				status: "completed",
				completedAtMs: 2e3
			}] },
			viewedAtMs: 1e3
		}) : false;
		const expire = functionReady(api, "shouldExpireRunningThreadHint") ? api.shouldExpireRunningThreadHint({
			threadId: "target-thread",
			isRunningHinted: true,
			status: "idle",
			runningHintedAtMs: 0,
			runningHintStaleMs: 1e3,
			nowMs: 5e3,
			thread: {}
		}) : false;
		return {
			ok: running === true && unread === true && expire === true,
			running,
			unread,
			expire
		};
	}
	if (id === "thread-detail-patch-plan") {
		const surface = functionReady(api, "planThreadDetailDomPatchSurface") ? api.planThreadDetailDomPatchSurface({
			threadId: "thread-a",
			conversationPresent: true
		}) : {};
		const visiblePatch = functionReady(api, "planVisibleItemRefreshPatch") ? api.planVisibleItemRefreshPatch([{
			key: "a",
			signature: "1"
		}], [{
			key: "a",
			signature: "1"
		}, {
			key: "b",
			signature: "2"
		}]) : {};
		const turnPatch = functionReady(api, "planThreadDetailRefreshDomPatch") ? api.planThreadDetailRefreshDomPatch([{
			key: "turn-a",
			hasPreviousTurn: true,
			itemPatchable: true,
			articlePresent: true
		}]) : {};
		const visibleOperations = Array.isArray(visiblePatch.operations) ? visiblePatch.operations : [];
		const turnOperations = Array.isArray(turnPatch.operations) ? turnPatch.operations : [];
		return {
			ok: surface.canPatch === true && surface.reason === "single-thread-surface" && visiblePatch.canPatch === true && visibleOperations.map((entry) => entry.type).join(",") === "reuse,insert" && turnPatch.canPatch === true && turnOperations.length === 1 && turnOperations[0].type === "item-patch",
			surfaceReason: String(surface.reason || ""),
			visibleOperationCount: visibleOperations.length,
			turnOperationType: String(turnOperations[0] && turnOperations[0].type || "")
		};
	}
	if (id === "thread-detail-actions") {
		const node = (dataset) => ({
			dataset,
			closest(selector) {
				if (selector === "[data-thread-tile-pane]") return { dataset: { threadTilePane: "thread-pane" } };
				return null;
			}
		});
		const copyNode = node({ copyKey: "copy-1" });
		const approvalNode = node({
			approvalId: "ap-1",
			approvalThreadId: "thread-ap",
			approvalAction: "allow_once"
		});
		const responseNode = node({
			serverRequestId: "req-1",
			serverRequestThreadId: "thread-req",
			serverResponseText: "yes",
			serverQuestionId: "answer"
		});
		const rich = functionReady(api, "resolveRichContentClickAction") ? api.resolveRichContentClickAction({ target: { closest(selector) {
			return selector === "[data-copy-key]" ? copyNode : null;
		} } }) : {};
		const approval = functionReady(api, "resolveThreadDetailClickAction") ? api.resolveThreadDetailClickAction({ target: { closest(selector) {
			return selector === "[data-approval-action]" ? approvalNode : null;
		} } }) : {};
		const response = functionReady(api, "resolveThreadDetailClickAction") ? api.resolveThreadDetailClickAction({ target: { closest(selector) {
			return selector === "[data-server-response-text]" ? responseNode : null;
		} } }) : {};
		const contextThreadId = functionReady(api, "contextThreadIdFromNode") ? api.contextThreadIdFromNode(copyNode) : "";
		return {
			ok: rich.action === "copy" && rich.preventDefault === true && rich.stopPropagation === true && approval.action === "approval-answer" && approval.approvalAction === "allow_once" && approval.threadId === "thread-ap" && response.action === "server-response" && response.responseText === "yes" && contextThreadId === "thread-pane",
			richAction: String(rich.action || ""),
			approvalAction: String(approval.action || ""),
			approvalValue: String(approval.approvalAction || ""),
			responseAction: String(response.action || ""),
			contextThreadId
		};
	}
	if (id === "thread-detail-merge-state") {
		const policy = functionReady(api, "createThreadDetailMergePolicy") ? api.createThreadDetailMergePolicy({
			sortTurnsForDisplay: (turns) => Array.isArray(turns) ? turns.slice().sort((left, right) => String(left && left.id || "").localeCompare(String(right && right.id || ""))) : [],
			turnVisibleWeight: (turn) => JSON.stringify(turn && turn.items || []).length,
			mergeItemsPreservingLocalVisible: (existingItems, incomingItems, preserveLocalVisible) => preserveLocalVisible ? existingItems : incomingItems
		}) : {};
		const merged = policy && typeof policy.mergeThreadPreservingVisibleItems === "function" ? policy.mergeThreadPreservingVisibleItems({
			id: "thread-a",
			turns: [{
				id: "b",
				items: [{
					type: "assistantMessage",
					text: "full receipt"
				}]
			}]
		}, {
			id: "thread-a",
			turns: [{
				id: "b",
				items: []
			}, {
				id: "a",
				items: [{
					type: "userMessage",
					text: "hello"
				}]
			}]
		}) : {};
		const turns = Array.isArray(merged && merged.turns) ? merged.turns : [];
		const preserved = turns.find((turn) => turn && turn.id === "b");
		return {
			ok: turns.map((turn) => String(turn && turn.id || "")).join(",") === "a,b" && Array.isArray(preserved && preserved.items) && preserved.items.length === 1 && preserved.items[0].text === "full receipt",
			turnOrder: turns.map((turn) => String(turn && turn.id || "")),
			preservedItemCount: Array.isArray(preserved && preserved.items) ? preserved.items.length : 0
		};
	}
	if (id === "thread-detail-v4-merge-state") {
		const policy = functionReady(api, "createThreadDetailV4MergePolicy") ? api.createThreadDetailV4MergePolicy({
			normalizeThreadVisibleUserMessages: (thread) => thread,
			turnVisibleWeight: (turn) => Array.isArray(turn && turn.items) ? turn.items.length : 0,
			isOptimisticUserMessage: (item) => Boolean(item && item.mobilePendingSubmission),
			isRecentlySubmittedUserMessage: (item) => Boolean(item && item.mobilePendingSubmission),
			isReasoningItem: (item) => String(item && item.type || "") === "reasoning",
			userMessagesCanShadow: () => false,
			isTurnComplete: (turn) => /completed|failed|cancel|interrupted/i.test(String(turn && (turn.status && turn.status.type || turn.status) || "")),
			isRunningStatus: (status) => /running|active|inprogress|in_progress/i.test(String(status && status.type || status || "")),
			isIncompleteInterruptedTurn: () => false,
			turnHasActiveLiveItems: () => false,
			turnOrderMs: (turn) => Number(turn && turn.startedAtMs) || 0,
			sortTurnsForDisplay: (turns) => Array.isArray(turns) ? turns.slice().sort((left, right) => (Number(left && left.startedAtMs) || 0) - (Number(right && right.startedAtMs) || 0)) : [],
			maxVisibleTurnsForThread: () => 5
		}) : {};
		const merged = policy && typeof policy.mergeV4ProjectionThread === "function" ? policy.mergeV4ProjectionThread({
			id: "thread-a",
			mobileProjectionRevision: 3,
			turns: [{
				id: "active",
				startedAtMs: 100,
				status: "running",
				items: [{
					type: "agentMessage",
					text: "streaming"
				}]
			}]
		}, {
			id: "thread-a",
			mobileProjectionRevision: 2,
			turns: [{
				id: "new",
				startedAtMs: 50,
				status: "completed",
				items: [{
					type: "userMessage",
					text: "prompt"
				}]
			}]
		}) : {};
		const turns = Array.isArray(merged && merged.turns) ? merged.turns : [];
		return {
			ok: typeof policy.mergeV4ProjectionThread === "function" && typeof policy.v4ProjectionRevisionValue === "function" && policy.v4ProjectionRevisionValue(merged) === 3 && turns.map((turn) => String(turn && turn.id || "")).join(",") === "new,active",
			revision: policy && typeof policy.v4ProjectionRevisionValue === "function" ? policy.v4ProjectionRevisionValue(merged) : 0,
			turnOrder: turns.map((turn) => String(turn && turn.id || ""))
		};
	}
	if (id === "client-render-stability-guard") {
		const sourceTurn = {
			id: "local-turn-secret",
			items: [{
				type: "userMessage",
				clientSubmissionId: "submission-secret",
				mobilePendingSubmission: true
			}]
		};
		const targetTurn = {
			id: "server-turn-a",
			items: [{
				type: "userMessage",
				clientSubmissionId: "submission-secret"
			}]
		};
		const sourceKey = functionReady(api, "markSubmittedTurn") ? api.markSubmittedTurn(sourceTurn, "submission-secret") : "";
		const transferredKey = functionReady(api, "transferSubmittedTurnIdentity") ? api.transferSubmittedTurnIdentity(sourceTurn, targetTurn, "submission-secret") : "";
		const sourceIdentity = functionReady(api, "stableTurnIdentity") ? api.stableTurnIdentity(sourceTurn) : "";
		const targetIdentity = functionReady(api, "stableTurnIdentity") ? api.stableTurnIdentity(targetTurn) : "";
		return {
			ok: Boolean(sourceKey) && sourceKey === transferredKey && sourceIdentity === sourceKey && targetIdentity === sourceKey && !String(sourceKey).includes("submission-secret"),
			sourceKey: String(sourceKey || ""),
			transferredKey: String(transferredKey || ""),
			sourceIdentity: String(sourceIdentity || ""),
			targetIdentity: String(targetIdentity || "")
		};
	}
	if (id === "live-operation-dock-state") {
		const card = functionReady(api, "operationCardContentPlan") ? api.operationCardContentPlan({
			itemId: "op-a",
			type: "tool",
			status: "running",
			title: "Run",
			detail: "working",
			durationText: "1s"
		}) : {};
		const preserve = functionReady(api, "compactBubblePreservation") ? api.compactBubblePreservation({
			nextHtml: "",
			liveTurnActive: true,
			visibleUntilMs: 2e3,
			nowMs: 1e3,
			savedThreadId: "thread-a",
			currentThreadId: "thread-a",
			savedHtml: "<div class=\"mobile-operation-bubble\"></div>",
			dockHasBubble: false
		}) : {};
		const recall = functionReady(api, "shouldShowRecall") ? api.shouldShowRecall({
			isMobile: true,
			hasCurrentThread: true,
			newThreadDraft: false,
			liveTurnActive: true,
			recallThreadId: "thread-a",
			currentThreadId: "thread-a",
			recallHtml: "<div class=\"mobile-operation-sheet\"></div>"
		}) : false;
		const classTokens = Array.isArray(card.classTokens) ? card.classTokens : [];
		return {
			ok: card.detail === "working" && classTokens.includes("live-operation") && preserve.preserve === true && preserve.patchSavedHtml === true && recall === true,
			detail: String(card.detail || ""),
			preserve: Boolean(preserve.preserve),
			recall
		};
	}
	return { ok: false };
}
function codexMobileViteEsmCompatibility() {
	const modules = moduleDefinitions.map((definition) => {
		const api = moduleApis[definition.id] && typeof moduleApis[definition.id] === "object" ? moduleApis[definition.id] : {};
		const expectedFunctions = Array.isArray(definition.expectedFunctions) ? definition.expectedFunctions : [];
		const exportedFunctions = expectedFunctions.filter((name) => functionReady(api, name));
		const sample = sampleModule(definition.id, api);
		const globalPublished = publishClassicGlobal(definition, api);
		return {
			id: definition.id,
			source: definition.source,
			assetPath: definition.assetPath,
			globalName: definition.globalName,
			classicLoaderExcluded: definition.classicLoaderExcluded === true,
			expectedFunctions: expectedFunctions.slice(),
			exportedFunctions,
			sample,
			globalPublished,
			ready: exportedFunctions.length === expectedFunctions.length && sample.ok === true && (definition.classicLoaderExcluded !== true || globalPublished === true)
		};
	});
	return {
		schemaVersion: 1,
		owner: "vite-shell-entry",
		moduleCount: modules.length,
		readyCount: modules.filter((entry) => entry.ready === true).length,
		modules
	};
}
var codexMobileViteEsmCompatibilityModules = moduleDefinitions;
//#endregion
export { codexMobileViteEsmCompatibility, codexMobileViteEsmCompatibility as default, codexMobileViteEsmCompatibilityModules };
