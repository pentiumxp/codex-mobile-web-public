import { i as __toESM, r as __commonJSMin } from "./vite-shell-entry-CXGq3ZiM.js";
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
					if (state.threadListLoadController || hasThreadDetailRequestInFlight() || hasThreadDetailSelectionIntent()) {
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
//#region public/side-chat-runtime.js
var require_side_chat_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function attachSideChatRuntime(root) {
		function noop() {}
		function noopFalse() {
			return false;
		}
		function noopString() {
			return "";
		}
		function defaultRequestAnimationFrame(callback) {
			return typeof root.setTimeout === "function" ? root.setTimeout(callback, 16) : 0;
		}
		function createSideChatRuntime(deps = {}) {
			const state = deps.state || {};
			const $ = typeof deps.$ === "function" ? deps.$ : () => null;
			const document = deps.document || root.document || {};
			const window = deps.window || root.window || root;
			const requestAnimationFrame = typeof deps.requestAnimationFrame === "function" ? deps.requestAnimationFrame : typeof root.requestAnimationFrame === "function" ? root.requestAnimationFrame.bind(root) : defaultRequestAnimationFrame;
			const setTimeout = typeof deps.setTimeout === "function" ? deps.setTimeout : typeof root.setTimeout === "function" ? root.setTimeout.bind(root) : () => 0;
			const clearTimeout = typeof deps.clearTimeout === "function" ? deps.clearTimeout : typeof root.clearTimeout === "function" ? root.clearTimeout.bind(root) : noop;
			const SIDE_CHAT_DRAFT_SAVE_DEBOUNCE_MS = Math.max(0, Number(deps.SIDE_CHAT_DRAFT_SAVE_DEBOUNCE_MS || 450) || 450);
			const SIDE_CHAT_DRAFT_MAX_CHARS = Math.max(1, Number(deps.SIDE_CHAT_DRAFT_MAX_CHARS || 8e3) || 8e3);
			const SUBAGENT_EDGE_SWIPE_PX = Math.max(1, Number(deps.SUBAGENT_EDGE_SWIPE_PX || 56) || 56);
			const SUBAGENT_EDGE_SWIPE_MAX_PX = Math.max(SUBAGENT_EDGE_SWIPE_PX, Number(deps.SUBAGENT_EDGE_SWIPE_MAX_PX || 88) || 88);
			const SUBAGENT_EDGE_SWIPE_RATIO = Math.max(0, Number(deps.SUBAGENT_EDGE_SWIPE_RATIO || .08) || .08);
			const SUBAGENT_SWIPE_MIN_PX = Math.max(1, Number(deps.SUBAGENT_SWIPE_MIN_PX || 70) || 70);
			const SUBAGENT_WHEEL_SWIPE_MIN_PX = Math.max(1, Number(deps.SUBAGENT_WHEEL_SWIPE_MIN_PX || 48) || 48);
			const CLIENT_BUILD_ID = String(deps.CLIENT_BUILD_ID || "");
			const { api, collabAgentNameText = noopString, collabAgentTaskText = noopString, collabAgentThreadText = noopString, conversationDomTurnIds = () => [], conversationPatchShellSignature = noopString, conversationRenderSignature = noopString, createSubmissionId = () => "sidechat-" + Date.now(), currentLiveTurn = () => null, diagnosticThreadHash = noopString, escapeHtml = (value) => String(value || ""), escapeSelectorAttr = (value) => String(value || ""), formatTime = noopString, homeAiDiagnosticReportingApi = { boundedToken: (value) => String(value || "") }, isInteractiveGestureTarget = noopFalse, latestTurn = () => null, loadThread = async () => null, loadThreads = async () => null, markActivity = noop, normalizeClientErrorMessage = (value) => String(value || ""), primaryTouch = () => null, renderCurrentThread = noop, requestAppConfirmation = async () => false, scheduleCurrentThreadRefresh = noop, scheduleLivePollIfNeeded = noop, showError = noop, statusText = noopString, truncateMiddle = (value) => String(value || ""), visibleConversationShape = () => ({}) } = deps;
			function isSubagentItem(item) {
				return Boolean(item && item.type === "collabAgentToolCall");
			}
			function turnSubagentItems(turn) {
				return (Array.isArray(turn && turn.items) ? turn.items : []).filter(isSubagentItem);
			}
			function activeSubagentItems(turn) {
				return turnSubagentItems(turn).filter(isActiveSubagentItem);
			}
			function currentSubagentTurn() {
				if (!state.currentThread) return null;
				const live = currentLiveTurn();
				if (turnSubagentItems(live).length) return live;
				const latest = latestTurn();
				return activeSubagentItems(latest).length ? latest : null;
			}
			function currentSubagentItems() {
				const turn = currentSubagentTurn();
				if (turn && currentLiveTurn() === turn) return turnSubagentItems(turn);
				return activeSubagentItems(turn);
			}
			function subagentStatusKind(status) {
				const text = statusText(status).toLowerCase();
				if (/fail|error|denied|reject|cancel|interrupt|stop/.test(text)) return "failed";
				if (/complete|success|succeeded|done|finished|closed/.test(text)) return "completed";
				if (/queue|pending|waiting|wait/.test(text)) return "queued";
				if (/running|active|started|processing|inprogress|in_progress|in-progress|working|open|spawned|starting/.test(text)) return "running";
				return "unknown";
			}
			function isActiveSubagentItem(item) {
				const kind = subagentStatusKind(item && item.status);
				return kind === "running" || kind === "queued";
			}
			function currentSubagentStatusKind(item, turn) {
				const kind = subagentStatusKind(item && item.status);
				if (turn && currentLiveTurn() === turn && (kind === "completed" || kind === "unknown")) return "running";
				return kind;
			}
			function subagentStatusLabel(kind) {
				return {
					running: "运行中",
					queued: "等待",
					completed: "完成",
					failed: "失败",
					unknown: "未知"
				}[kind] || "未知";
			}
			function subagentSwipeAvailable() {
				return Boolean(state.currentThread);
			}
			function sideChatThreadId() {
				return String(state.currentThreadId || state.currentThread && state.currentThread.id || "");
			}
			function defaultSideChatState(threadId) {
				return {
					threadId: String(threadId || ""),
					version: 0,
					messages: [],
					draft: {
						text: "",
						updatedAt: ""
					},
					candidates: [],
					queue: null,
					sidecar: {
						status: "idle",
						pendingUserMessageId: "",
						updatedAt: "",
						error: ""
					},
					audit: {
						createdAt: "",
						updatedAt: ""
					},
					persistence: "server"
				};
			}
			function normalizeSideChatSidecar(input) {
				const source = input && typeof input === "object" ? input : {};
				const status = String(source.status || "idle").toLowerCase();
				return {
					status: [
						"idle",
						"pending",
						"failed"
					].includes(status) ? status : "idle",
					pendingUserMessageId: String(source.pendingUserMessageId || ""),
					updatedAt: String(source.updatedAt || ""),
					error: String(source.error || "")
				};
			}
			function normalizeSideChatState(input, threadId = "") {
				const source = input && typeof input === "object" ? input : {};
				return {
					threadId: String(source.threadId || threadId || ""),
					version: Math.max(0, Number(source.version) || 0),
					messages: Array.isArray(source.messages) ? source.messages.filter(Boolean) : [],
					draft: {
						text: String(source.draft && source.draft.text || ""),
						updatedAt: String(source.draft && source.draft.updatedAt || "")
					},
					candidates: Array.isArray(source.candidates) ? source.candidates.filter(Boolean) : [],
					queue: source.queue && typeof source.queue === "object" ? source.queue : null,
					sidecar: normalizeSideChatSidecar(source.sidecar),
					audit: {
						createdAt: String(source.audit && source.audit.createdAt || ""),
						updatedAt: String(source.audit && source.audit.updatedAt || "")
					},
					persistence: "server"
				};
			}
			function setSideChatState(threadId, sideChat) {
				const id = String(threadId || sideChat && sideChat.threadId || "");
				if (!id) return defaultSideChatState("");
				const normalized = normalizeSideChatState(sideChat, id);
				state.threadSideChats.set(id, normalized);
				return normalized;
			}
			function sideChatStateForThread(threadId = sideChatThreadId()) {
				const id = String(threadId || "");
				if (!id) return defaultSideChatState("");
				return state.threadSideChats.get(id) || defaultSideChatState(id);
			}
			function sideChatApiPath(threadId, suffix = "") {
				return `/api/threads/${encodeURIComponent(threadId)}/side-chat${suffix}`;
			}
			function sideChatDraftTextarea() {
				const panel = $("subagentPanel");
				if (!panel) return null;
				const textarea = panel.querySelector("[data-side-chat-draft]");
				return textarea && textarea.tagName === "TEXTAREA" ? textarea : null;
			}
			function ensureSideChatDraftVisible() {
				const textarea = sideChatDraftTextarea();
				if (!textarea || document.activeElement !== textarea) return;
				const form = textarea.closest("[data-side-chat-form]");
				const panel = $("subagentPanel");
				try {
					if (form) form.scrollIntoView({
						block: "nearest",
						inline: "nearest"
					});
					else textarea.scrollIntoView({
						block: "nearest",
						inline: "nearest"
					});
				} catch (_) {}
				if (!panel || !form) return;
				const panelRect = panel.getBoundingClientRect();
				const formRect = form.getBoundingClientRect();
				const overflow = Math.ceil(formRect.bottom - panelRect.bottom + 8);
				if (overflow > 0) panel.scrollTop = Math.max(0, Number(panel.scrollTop || 0) + overflow);
			}
			function autoSizeSideChatDraftTextarea(textarea = sideChatDraftTextarea()) {
				if (!textarea) return;
				textarea.style.height = "auto";
				const style = window.getComputedStyle ? window.getComputedStyle(textarea) : null;
				const maxHeight = style ? Number.parseFloat(style.maxHeight) : 160;
				const minHeight = style ? Number.parseFloat(style.minHeight) : 44;
				const nextHeight = Math.min(Number.isFinite(maxHeight) && maxHeight > 0 ? maxHeight : 160, Math.max(Number.isFinite(minHeight) && minHeight > 0 ? minHeight : 44, textarea.scrollHeight));
				textarea.style.height = `${nextHeight}px`;
				textarea.style.overflowY = textarea.scrollHeight > nextHeight + 1 ? "auto" : "hidden";
			}
			function sideChatScrollContainer() {
				const panel = $("subagentPanel");
				return panel ? panel.querySelector(".side-chat-scroll") : null;
			}
			function scrollSideChatToBottom() {
				const scroller = sideChatScrollContainer();
				if (!scroller) return false;
				scroller.scrollTop = scroller.scrollHeight;
				return true;
			}
			function scheduleSideChatToBottom() {
				requestAnimationFrame(() => {
					scrollSideChatToBottom();
					requestAnimationFrame(scrollSideChatToBottom);
				});
			}
			function openSideChatCandidate(candidateId = "") {
				const scroller = sideChatScrollContainer();
				if (!scroller) return false;
				const id = String(candidateId || "");
				const target = id ? scroller.querySelector(`[data-side-chat-candidate="${escapeSelectorAttr(id)}"]`) : scroller.querySelector(".side-chat-candidate");
				if (!target) {
					scrollSideChatToBottom();
					return false;
				}
				target.scrollIntoView({
					block: "center",
					inline: "nearest"
				});
				target.classList.add("side-chat-focus");
				setTimeout(() => target.classList.remove("side-chat-focus"), 1200);
				return true;
			}
			function currentSideChatDraftText(threadId = sideChatThreadId()) {
				const textarea = sideChatDraftTextarea();
				if (textarea && String(textarea.dataset.threadId || "") === String(threadId || "")) return textarea.value;
				return sideChatStateForThread(threadId).draft.text || "";
			}
			function truncateSideChatText(text) {
				const value = String(text || "");
				if (value.length <= SIDE_CHAT_DRAFT_MAX_CHARS) return value;
				return value.slice(0, SIDE_CHAT_DRAFT_MAX_CHARS);
			}
			async function loadSideChat(threadId = sideChatThreadId(), options = {}) {
				const id = String(threadId || "");
				if (!id) return null;
				const silent = options.silent === true;
				if (!silent) state.sideChatError = "";
				state.sideChatLoadingThreadId = id;
				if (state.subagentPanelOpen && !silent) updateSubagentPanelUi({ force: true });
				try {
					const result = await api(sideChatApiPath(id), { timeoutMs: 2e4 });
					const sideChat = setSideChatState(id, result && result.sideChat || null);
					if (state.sideChatLoadingThreadId === id) state.sideChatLoadingThreadId = "";
					if (state.sideChatError && sideChatThreadId() === id) state.sideChatError = "";
					if (state.subagentPanelOpen && sideChatThreadId() === id) updateSubagentPanelUi({
						force: true,
						scrollSideChatToBottom: true
					});
					if (sideChatReplyPending(id)) scheduleSideChatPoll(id);
					return sideChat;
				} catch (err) {
					if (state.sideChatLoadingThreadId === id) state.sideChatLoadingThreadId = "";
					if (sideChatThreadId() === id) state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
					if (state.subagentPanelOpen && sideChatThreadId() === id) updateSubagentPanelUi({
						force: true,
						scrollSideChatToBottom: true
					});
					throw err;
				}
			}
			function sideChatReplyPending(threadId = sideChatThreadId()) {
				const sideChat = sideChatStateForThread(threadId);
				return String(sideChat.sidecar && sideChat.sidecar.status || "") === "pending";
			}
			function scheduleSideChatPoll(threadId = sideChatThreadId(), delayMs = 1600) {
				const id = String(threadId || "");
				clearTimeout(state.sideChatPollTimer);
				state.sideChatPollTimer = null;
				if (!id || !state.subagentPanelOpen || sideChatThreadId() !== id || !sideChatReplyPending(id)) return;
				state.sideChatPollTimer = setTimeout(() => {
					state.sideChatPollTimer = null;
					loadSideChat(id, { silent: true }).then(() => {
						if (sideChatReplyPending(id)) scheduleSideChatPoll(id, 1800);
					}).catch(() => {
						if (sideChatThreadId() === id) scheduleSideChatPoll(id, 2600);
					});
				}, Math.max(500, Number(delayMs) || 1600));
			}
			async function saveSideChatDraft(threadId, text, options = {}) {
				const id = String(threadId || "");
				if (!id) return null;
				const nextText = truncateSideChatText(text);
				const result = await api(sideChatApiPath(id, "/draft"), {
					method: "PUT",
					body: JSON.stringify({ text: nextText }),
					timeoutMs: 2e4
				});
				const sideChat = setSideChatState(id, result && result.sideChat || null);
				if (state.sideChatError && sideChatThreadId() === id) state.sideChatError = "";
				if (options.render !== false && state.subagentPanelOpen && sideChatThreadId() === id) updateSubagentPanelUi({ force: true });
				return sideChat;
			}
			function scheduleSideChatDraftSave(threadId = sideChatThreadId(), text = currentSideChatDraftText(threadId)) {
				const id = String(threadId || "");
				if (!id) return;
				const sideChat = sideChatStateForThread(id);
				sideChat.draft = Object.assign({}, sideChat.draft || {}, { text: truncateSideChatText(text) });
				state.threadSideChats.set(id, sideChat);
				clearTimeout(state.sideChatDraftSaveTimer);
				const seq = state.sideChatDraftSaveSeq + 1;
				state.sideChatDraftSaveSeq = seq;
				state.sideChatDraftSaveTimer = setTimeout(() => {
					state.sideChatDraftSaveTimer = null;
					saveSideChatDraft(id, sideChatStateForThread(id).draft.text, { render: false }).catch((err) => {
						if (seq !== state.sideChatDraftSaveSeq) return;
						if (sideChatThreadId() === id) {
							state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
							updateSubagentPanelUi({ force: true });
						}
					});
				}, SIDE_CHAT_DRAFT_SAVE_DEBOUNCE_MS);
			}
			function flushSideChatDraftNow() {
				const id = sideChatThreadId();
				if (!id) return Promise.resolve(null);
				const text = currentSideChatDraftText(id);
				clearTimeout(state.sideChatDraftSaveTimer);
				state.sideChatDraftSaveTimer = null;
				return saveSideChatDraft(id, text, { render: false }).catch((err) => {
					state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
					return null;
				});
			}
			function sideChatStatusLabel(status) {
				return {
					draft: "草稿",
					queued: "已排队",
					applied: "已发送",
					cancelled: "已取消",
					sending: "发送中",
					sent: "已发送",
					failed: "失败"
				}[String(status || "").toLowerCase()] || "草稿";
			}
			function sideChatQueueSummary(queue) {
				if (!queue) return "";
				return `${sideChatStatusLabel(queue.status)} · ${queue.mode === "autoSendWhenIdle" ? "完成后自动发送" : "等待确认"}`;
			}
			function sideChatTimeLabel(value) {
				const text = String(value || "");
				const ms = Date.parse(text);
				if (!Number.isFinite(ms)) return "";
				return formatTime(Math.floor(ms / 1e3), state.nowMs);
			}
			function sideChatBusy(key) {
				return Boolean(key && state.sideChatBusyKey === key);
			}
			function setSideChatNotice(kind, message, options = {}) {
				const threadId = sideChatThreadId();
				state.sideChatNotice = {
					threadId,
					kind: String(kind || "info"),
					message: String(message || ""),
					actionLabel: String(options.actionLabel || ""),
					candidateId: String(options.candidateId || ""),
					createdAtMs: Date.now()
				};
			}
			function clearSideChatNotice() {
				state.sideChatNotice = null;
			}
			function sideChatNoticeForThread(threadId = sideChatThreadId()) {
				const notice = state.sideChatNotice;
				if (!notice || String(notice.threadId || "") !== String(threadId || "")) return null;
				return notice;
			}
			function sideChatPanelRenderSignature() {
				const threadId = sideChatThreadId();
				const sideChat = sideChatStateForThread(threadId);
				const notice = sideChatNoticeForThread(threadId);
				const messages = sideChat.messages.map((message) => [
					message.id,
					message.role,
					String(message.text || "").length,
					message.createdAt
				].join(":")).join(",");
				const candidates = sideChat.candidates.map((candidate) => [
					candidate.id,
					candidate.status,
					candidate.updatedAt,
					String(candidate.body || "").length,
					candidate.appliedTurnId || ""
				].join(":")).join(",");
				const queue = sideChat.queue ? [
					sideChat.queue.candidateId,
					sideChat.queue.mode,
					sideChat.queue.status,
					sideChat.queue.updatedAt,
					String(sideChat.queue.error || "").length
				].join(":") : "";
				const sidecar = sideChat.sidecar ? [
					sideChat.sidecar.status,
					sideChat.sidecar.pendingUserMessageId,
					sideChat.sidecar.updatedAt,
					String(sideChat.sidecar.error || "").length
				].join(":") : "";
				const turn = currentSubagentTurn();
				const subagents = currentSubagentItems().map((item) => [
					item.id || item.itemId || "",
					item.tool || item.name || "",
					statusText(item.status),
					collabAgentThreadText(item),
					String(collabAgentTaskText(item) || "").length
				].join(":")).join(",");
				return [
					threadId,
					state.activeTurnId || "",
					state.sideChatLoadingThreadId === threadId ? "loading" : "",
					state.sideChatError || "",
					state.sideChatBusyKey || "",
					notice ? [
						notice.kind,
						notice.message,
						notice.actionLabel,
						notice.candidateId
					].join(":") : "",
					messages,
					candidates,
					queue,
					sidecar,
					turn && turn.id || "",
					subagents
				].join("|");
			}
			function renderSideChatNotice(threadId = sideChatThreadId()) {
				const notice = sideChatNoticeForThread(threadId);
				if (!notice || !notice.message) return "";
				const action = notice.actionLabel ? `<button type="button" data-side-chat-action="open-notice" data-candidate-id="${escapeHtml(notice.candidateId || "")}">${escapeHtml(notice.actionLabel)}</button>` : "";
				return `<div class="side-chat-notice ${escapeHtml(notice.kind || "info")}">
    <span>${escapeHtml(notice.message)}</span>
    <span class="side-chat-notice-actions">${action}<button type="button" data-side-chat-action="dismiss-notice" aria-label="关闭提示">×</button></span>
  </div>`;
			}
			function renderSubagentStatusWindow() {
				const turn = currentSubagentTurn();
				const items = currentSubagentItems();
				if (!items.length) return "";
				const rows = items.map((item, index) => {
					const kind = currentSubagentStatusKind(item, turn);
					const label = collabAgentNameText(item) || collabAgentThreadText(item) || (item.tool === "spawnAgent" ? "Subagent" : item.tool || item.name || `Subagent ${index + 1}`);
					const task = collabAgentTaskText(item);
					const thread = collabAgentThreadText(item);
					const meta = [
						subagentStatusLabel(kind),
						thread ? truncateMiddle(thread, 32, "thread") : "",
						item.tool && item.tool !== "collabAgentToolCall" ? item.tool : ""
					].filter(Boolean).join(" | ");
					return `<article class="subagent-status-row ${escapeHtml(kind)}">
      <div class="subagent-status-main">
        <div class="subagent-status-title"><span class="subagent-status-dot ${escapeHtml(kind)}"></span>${escapeHtml(label)}</div>
        ${task ? `<div class="subagent-status-task">${escapeHtml(truncateMiddle(task, 180, "task"))}</div>` : ""}
      </div>
      <div class="subagent-status-meta">${escapeHtml(meta)}</div>
    </article>`;
				}).join("");
				return `<section class="subagent-status-window" aria-label="Subagent 状态">
    <div class="subagent-status-header">
      <div>
        <div class="subagent-status-heading">Subagent 状态</div>
        <div class="subagent-status-summary">当前进行中 · ${items.length.toLocaleString()} 个</div>
      </div>
      <button class="subagent-window-close" type="button" data-subagent-panel-close aria-label="关闭 Subagent 状态">×</button>
    </div>
    <div class="subagent-status-list">${rows}</div>
  </section>`;
			}
			function latestAssistantSideChatMessageIndex(sideChat) {
				const messages = Array.isArray(sideChat && sideChat.messages) ? sideChat.messages : [];
				for (let index = messages.length - 1; index >= 0; index -= 1) if (String(messages[index] && messages[index].role || "").toLowerCase() === "assistant") return index;
				return -1;
			}
			function renderSideChatMessage(message, index, sideChat) {
				const role = String(message && message.role || "user").toLowerCase();
				const text = String(message && message.text || "");
				const time = sideChatTimeLabel(message && message.createdAt);
				const latestAssistant = role === "assistant" && index === latestAssistantSideChatMessageIndex(sideChat);
				const running = Boolean(state.activeTurnId);
				const busy = sideChatBusy(`message:${index}`) || sideChatBusy(`message-candidate:${index}`);
				const actions = latestAssistant && text.trim() ? `<div class="side-chat-message-actions">
        <button type="button" data-side-chat-action="message-apply" data-message-index="${index}"${busy ? " disabled" : ""}>发送主线程</button>
        <button type="button" data-side-chat-action="message-queue" data-message-index="${index}"${busy ? " disabled" : ""}>${running ? "完成后发送" : "排队"}</button>
        <button type="button" data-side-chat-action="message-candidate" data-message-index="${index}"${busy ? " disabled" : ""}>存为候选</button>
      </div>` : "";
				return `<article class="side-chat-message ${escapeHtml(role)}">
    <div class="side-chat-message-meta">
      <span>${escapeHtml(role === "assistant" ? "侧聊" : "我")}</span>
      ${time ? `<time>${escapeHtml(time)}</time>` : ""}
    </div>
    <div class="side-chat-message-text">${escapeHtml(text)}</div>
    ${actions}
  </article>`;
			}
			function renderSideChatCandidate(candidate, sideChat) {
				const id = String(candidate && candidate.id || "");
				const status = String(candidate && candidate.status || "draft").toLowerCase();
				const body = String(candidate && candidate.body || "");
				const queue = sideChat.queue && sideChat.queue.candidateId === id ? sideChat.queue : null;
				const busy = sideChatBusy(`candidate:${id}`) || sideChatBusy(`apply:${id}`) || sideChatBusy(`queue:${id}`) || sideChatBusy(`cancel:${id}`);
				const running = Boolean(state.activeTurnId);
				const canApply = (status === "draft" || status === "queued") && !running;
				const canQueue = status === "draft";
				const canCancel = status === "draft" || status === "queued";
				const appliedTurn = String(candidate && candidate.appliedTurnId || "");
				const queueSummary = queue ? sideChatQueueSummary(queue) : sideChatStatusLabel(status);
				const error = queue && queue.status === "failed" && queue.error ? `<div class="side-chat-candidate-error">${escapeHtml(queue.error)}</div>` : "";
				return `<article class="side-chat-candidate ${escapeHtml(status)}" data-side-chat-candidate="${escapeHtml(id)}">
    <div class="side-chat-candidate-main">
      <div class="side-chat-candidate-title">${escapeHtml(candidate && candidate.title || "候选指令")}</div>
      <div class="side-chat-candidate-status">${escapeHtml(queueSummary)}${appliedTurn ? ` · ${escapeHtml(truncateMiddle(appliedTurn, 24, "turn"))}` : ""}</div>
      <div class="side-chat-candidate-body">${escapeHtml(truncateMiddle(body, 420, "candidate"))}</div>
      ${error}
    </div>
    <div class="side-chat-candidate-actions">
      ${canApply ? `<button type="button" data-side-chat-action="apply" data-candidate-id="${escapeHtml(id)}"${busy ? " disabled" : ""}>发送主线程</button>` : ""}
      ${running && status === "draft" ? `<button type="button" data-side-chat-action="queue" data-candidate-id="${escapeHtml(id)}"${busy ? " disabled" : ""}>完成后发送</button>` : ""}
      ${!running && canQueue && status !== "queued" ? `<button type="button" data-side-chat-action="queue" data-candidate-id="${escapeHtml(id)}"${busy ? " disabled" : ""}>排队</button>` : ""}
      ${canCancel ? `<button type="button" data-side-chat-action="cancel" data-candidate-id="${escapeHtml(id)}"${busy ? " disabled" : ""}>取消</button>` : ""}
    </div>
  </article>`;
			}
			function renderSideChatPanel() {
				const threadId = sideChatThreadId();
				const sideChat = sideChatStateForThread(threadId);
				const loading = state.sideChatLoadingThreadId === threadId;
				const messages = sideChat.messages.map((message, index) => renderSideChatMessage(message, index, sideChat)).join("");
				const candidates = sideChat.candidates.slice().reverse().map((candidate) => renderSideChatCandidate(candidate, sideChat)).join("");
				const queue = sideChat.queue && sideChat.queue.status !== "sent" && sideChat.queue.status !== "cancelled" ? `<div class="side-chat-queue ${escapeHtml(sideChat.queue.status || "queued")}">${escapeHtml(sideChatQueueSummary(sideChat.queue))}</div>` : "";
				const sidecar = normalizeSideChatSidecar(sideChat.sidecar);
				const replyStatus = sidecar.status === "pending" ? `<div class="side-chat-queue pending">侧聊正在回复...</div>` : sidecar.status === "failed" && sidecar.error ? `<div class="side-chat-error">侧聊回复失败：${escapeHtml(sidecar.error)}</div>` : "";
				const error = state.sideChatError ? `<div class="side-chat-error">${escapeHtml(state.sideChatError)}</div>` : "";
				const notice = renderSideChatNotice(threadId);
				const transcript = `${messages}${sidecar.status === "pending" ? `<article class="side-chat-message assistant pending">
    <div class="side-chat-message-meta"><span>侧聊</span></div>
    <div class="side-chat-message-text">正在整理回复...</div>
  </article>` : ""}` || `<div class="side-chat-empty">暂无侧聊内容。</div>`;
				const candidateList = candidates ? `<div class="side-chat-candidates">${candidates}</div>` : "";
				const draftText = sideChat.draft && sideChat.draft.text || "";
				const draftEmpty = !String(draftText || "").trim();
				const busy = Boolean(state.sideChatBusyKey);
				const loadingLabel = loading ? `<span class="side-chat-saving">同步中</span>` : "";
				const clearDisabled = busy || !sideChat.messages.length && !sideChat.candidates.length && draftEmpty;
				return `<section class="side-chat-section" aria-label="侧边聊天">
    <div class="side-chat-header">
      <div>
        <div class="side-chat-heading">侧边聊天</div>
        <div class="side-chat-summary">服务器保存 · ${sideChat.messages.length.toLocaleString()} 条</div>
      </div>
      ${loadingLabel}
      <button class="side-chat-clear side-chat-header-clear" type="button" data-side-chat-action="clear" aria-label="清空侧聊"${clearDisabled ? " disabled" : ""}>清空</button>
      <button class="subagent-window-close side-chat-close" type="button" data-subagent-panel-close aria-label="关闭侧边聊天">×</button>
    </div>
    ${queue}
    ${replyStatus}
    ${error}
    ${notice}
    <div class="side-chat-scroll">
      <div class="side-chat-transcript">${transcript}</div>
      ${candidateList}
    </div>
    <form class="side-chat-form" data-side-chat-form>
      <div class="side-chat-composer-row">
        <button class="side-chat-tool-button" type="button" data-side-chat-action="tools" aria-label="侧聊工具">+</button>
        <textarea data-side-chat-draft data-thread-id="${escapeHtml(threadId)}" rows="1" maxlength="${SIDE_CHAT_DRAFT_MAX_CHARS}" placeholder="整理想法，不进入主线程">${escapeHtml(draftText)}</textarea>
        <button class="side-chat-send" type="submit" data-side-chat-action="message"${busy || draftEmpty ? " disabled" : ""}>Send</button>
      </div>
      <div class="side-chat-tool-row" hidden>
        <button type="button" data-side-chat-action="candidate"${busy || draftEmpty ? " disabled" : ""}>存为候选</button>
      </div>
    </form>
  </section>`;
			}
			function renderSubagentPanel() {
				const subagentWindow = renderSubagentStatusWindow();
				return `<div class="thread-side-panel${subagentWindow ? "" : " no-subagents"}">
    ${subagentWindow}
    ${renderSideChatPanel()}
  </div>`;
			}
			function updateSubagentPanelUi(options = {}) {
				const panel = $("subagentPanel");
				if (!panel) return;
				if (!state.subagentPanelOpen || !subagentSwipeAvailable()) {
					state.subagentPanelOpen = false;
					panel.classList.add("hidden");
					panel.innerHTML = "";
					panel.dataset.renderSignature = "";
					state.sideChatRenderSignature = "";
					clearTimeout(state.sideChatPollTimer);
					state.sideChatPollTimer = null;
					return;
				}
				const signature = sideChatPanelRenderSignature();
				if (options.force !== true && panel.dataset.renderSignature === signature) return;
				panel.classList.remove("hidden");
				panel.innerHTML = renderSubagentPanel();
				panel.dataset.renderSignature = signature;
				state.sideChatRenderSignature = signature;
				panel.querySelectorAll("[data-subagent-panel-close]").forEach((button) => {
					button.addEventListener("click", () => {
						state.subagentPanelOpen = false;
						updateSubagentPanelUi();
					});
				});
				const form = panel.querySelector("[data-side-chat-form]");
				if (form) form.addEventListener("submit", submitSideChatMessage);
				const textarea = sideChatDraftTextarea();
				if (textarea) {
					textarea.addEventListener("input", handleSideChatDraftInput);
					textarea.addEventListener("focus", () => requestAnimationFrame(ensureSideChatDraftVisible));
					autoSizeSideChatDraftTextarea(textarea);
					requestAnimationFrame(() => autoSizeSideChatDraftTextarea(textarea));
				}
				panel.querySelectorAll("[data-side-chat-action]").forEach((button) => {
					if (button.closest("[data-side-chat-form]") && button.type === "submit") return;
					button.addEventListener("click", handleSideChatActionClick);
				});
				if (options.scrollSideChatToBottom) scheduleSideChatToBottom();
			}
			function visualHarnessThreadShape(thread) {
				const shape = visibleConversationShape(thread);
				const itemCount = (Array.isArray(thread && thread.turns) ? thread.turns : []).reduce((total, turn) => total + (Array.isArray(turn && turn.items) ? turn.items.length : 0), 0);
				return {
					visibleTurnCount: Number(shape.visibleTurnCount || 0),
					visibleItemCount: Number(shape.visibleItemCount || 0),
					itemCount,
					detailLoaded: Boolean(thread && thread.mobileDetailLoaded),
					loading: Boolean(thread && thread.mobileLoading),
					loadError: Boolean(thread && thread.mobileLoadError),
					readMode: homeAiDiagnosticReportingApi.boundedToken(thread && thread.mobileReadMode || "", "", 80)
				};
			}
			async function simulateEmptyCachedDetailOpenForHarness(threadId) {
				const id = String(threadId || state.currentThreadId || "").trim();
				const threadHash = diagnosticThreadHash(id);
				const before = {
					visibleTurnCount: 0,
					visibleItemCount: 0,
					itemCount: 0,
					detailLoaded: true,
					loading: false,
					loadError: false,
					readMode: "visual-harness-empty-cache"
				};
				if (!id) return {
					ok: false,
					error: "missing_thread_id",
					clientBuildId: CLIENT_BUILD_ID,
					thread_hash: "",
					before,
					after: null
				};
				state.currentThreadId = id;
				state.currentThread = {
					id,
					turns: [],
					mobileDetailLoaded: true,
					mobileLoading: false,
					mobileLoadError: "",
					mobileReadMode: "visual-harness-empty-cache"
				};
				await loadThread(id, { source: "visual-harness-empty-cache" });
				const after = visualHarnessThreadShape(state.currentThread);
				return {
					ok: Boolean(after.visibleTurnCount || after.visibleItemCount),
					error: after.loadError ? "thread_detail_load_error" : "",
					clientBuildId: CLIENT_BUILD_ID,
					thread_hash: threadHash,
					before,
					after
				};
			}
			async function simulateStableSignatureEmptyDomForHarness(threadId) {
				const id = String(threadId || state.currentThreadId || "").trim();
				const threadHash = diagnosticThreadHash(id);
				if (!id) return {
					ok: false,
					error: "missing_thread_id",
					clientBuildId: CLIENT_BUILD_ID,
					thread_hash: "",
					before: null,
					after: null,
					domBefore: null,
					domAfter: null
				};
				await loadThread(id, { source: "visual-harness-stable-signature-seed" });
				const before = visualHarnessThreadShape(state.currentThread);
				const signature = conversationRenderSignature(state.currentThread);
				const patchShellSignature = conversationPatchShellSignature(state.currentThread);
				const conversation = $("conversation");
				const domBefore = {
					turnCount: conversationDomTurnIds(conversation).length,
					itemCount: conversation ? conversation.querySelectorAll(".item[data-item]").length : 0
				};
				state.renderedConversationSignature = signature;
				state.renderedConversationPatchShellSignature = patchShellSignature;
				if (conversation) conversation.innerHTML = "<div class=\"empty-state\">No visible turns.</div>";
				renderCurrentThread({
					stickToBottom: true,
					source: "visual-harness-stable-signature-empty-dom"
				});
				const afterConversation = $("conversation");
				const hasEmptyState = afterConversation ? Boolean(afterConversation.querySelector(".empty-state")) : false;
				const domAfter = {
					turnCount: conversationDomTurnIds(afterConversation).length,
					itemCount: afterConversation ? afterConversation.querySelectorAll(".item[data-item]").length : 0,
					emptyState: hasEmptyState ? "empty-state" : ""
				};
				const after = visualHarnessThreadShape(state.currentThread);
				return {
					ok: Boolean(before.visibleTurnCount && after.visibleTurnCount && domAfter.turnCount > 0 && !hasEmptyState),
					error: after.loadError ? "thread_detail_load_error" : "",
					clientBuildId: CLIENT_BUILD_ID,
					thread_hash: threadHash,
					before,
					after,
					domBefore,
					domAfter
				};
			}
			function refreshSideChatFormButtons() {
				const textarea = sideChatDraftTextarea();
				if (!textarea) return;
				const form = textarea.closest("[data-side-chat-form]");
				if (!form) return;
				const panel = $("subagentPanel");
				const sideChat = sideChatStateForThread(String(textarea.dataset.threadId || sideChatThreadId()));
				const draftEmpty = !textarea.value.trim();
				form.querySelectorAll("[data-side-chat-action='message'], [data-side-chat-action='candidate']").forEach((button) => {
					button.disabled = Boolean(state.sideChatBusyKey) || draftEmpty;
				});
				if (panel) panel.querySelectorAll("[data-side-chat-action='clear']").forEach((button) => {
					button.disabled = Boolean(state.sideChatBusyKey) || draftEmpty && !sideChat.messages.length && !sideChat.candidates.length;
				});
			}
			function setSideChatBusy(key) {
				state.sideChatBusyKey = String(key || "");
				updateSubagentPanelUi({ force: true });
			}
			function applySideChatResult(threadId, result) {
				if (result && result.state) return setSideChatState(threadId, result.state);
				if (result && result.sideChat) return setSideChatState(threadId, result.sideChat);
				return sideChatStateForThread(threadId);
			}
			function handleSideChatDraftInput(event) {
				const textarea = event && event.currentTarget;
				if (!textarea) return;
				const threadId = String(textarea.dataset.threadId || sideChatThreadId());
				const text = truncateSideChatText(textarea.value);
				if (text !== textarea.value) textarea.value = text;
				autoSizeSideChatDraftTextarea(textarea);
				scheduleSideChatDraftSave(threadId, text);
				refreshSideChatFormButtons();
				ensureSideChatDraftVisible();
			}
			function installCodexMobileVisualHarnessFacade() {
				if (!isHermesEmbedMode() || window.__codexMobileVisualHarness) return;
				Object.defineProperty(window, "__codexMobileVisualHarness", {
					configurable: false,
					enumerable: false,
					value: Object.freeze({
						clientBuildId: () => CLIENT_BUILD_ID,
						currentThreadId: () => String(state.currentThreadId || ""),
						hostViewport: () => state.pluginHostViewport || null,
						sideChatPanelOpen: () => Boolean(state.subagentPanelOpen),
						setSideChatPanelOpen: (open) => {
							state.subagentPanelOpen = Boolean(open);
							updateSubagentPanelUi({
								force: true,
								scrollSideChatToBottom: Boolean(open)
							});
							return Boolean(state.subagentPanelOpen);
						},
						openThread: (threadId) => loadThread(String(threadId || ""), { source: "visual-harness" }),
						simulateEmptyCachedDetailOpen: (threadId) => simulateEmptyCachedDetailOpenForHarness(threadId),
						simulateStableSignatureEmptyDom: (threadId) => simulateStableSignatureEmptyDomForHarness(threadId),
						loadSideChat: (threadId) => loadSideChat(String(threadId || sideChatThreadId()), { silent: true }),
						ensureSideChatDraftVisible,
						autoSizeSideChatDraftTextarea
					})
				});
			}
			async function submitSideChatMessage(event) {
				if (event && typeof event.preventDefault === "function") event.preventDefault();
				const threadId = sideChatThreadId();
				const text = currentSideChatDraftText(threadId).trim();
				if (!threadId || !text || state.sideChatBusyKey) return;
				setSideChatBusy("message");
				try {
					clearTimeout(state.sideChatDraftSaveTimer);
					state.sideChatDraftSaveTimer = null;
					applySideChatResult(threadId, await api(sideChatApiPath(threadId, "/messages"), {
						method: "POST",
						body: JSON.stringify({
							role: "user",
							text,
							idempotencyKey: createSubmissionId()
						}),
						timeoutMs: 2e4
					}));
					state.sideChatError = "";
					if (sideChatReplyPending(threadId)) scheduleSideChatPoll(threadId, 900);
					markActivity("侧聊已发送");
				} catch (err) {
					state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
					showError(err);
				} finally {
					setSideChatBusy("");
					updateSubagentPanelUi({
						force: true,
						scrollSideChatToBottom: true
					});
				}
			}
			async function createSideChatCandidateFromText(text, options = {}) {
				const threadId = sideChatThreadId();
				const body = String(text || "").trim();
				if (!threadId || !body || state.sideChatBusyKey) return null;
				setSideChatBusy(options.busyKey || "candidate");
				try {
					clearTimeout(state.sideChatDraftSaveTimer);
					state.sideChatDraftSaveTimer = null;
					const sideChat = applySideChatResult(threadId, await api(sideChatApiPath(threadId, "/candidates"), {
						method: "POST",
						body: JSON.stringify({
							body,
							idempotencyKey: createSubmissionId()
						}),
						timeoutMs: 2e4
					}));
					if (options.clearDraft) await saveSideChatDraft(threadId, "", { render: false });
					state.sideChatError = "";
					markActivity("候选已保存");
					const candidates = Array.isArray(sideChat && sideChat.candidates) ? sideChat.candidates : [];
					const candidate = candidates[candidates.length - 1] || null;
					if (candidate && candidate.id) setSideChatNotice("success", "候选已保存，可以稍后发送到主线程。", {
						actionLabel: "打开候选",
						candidateId: candidate.id
					});
					return candidate;
				} catch (err) {
					state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
					showError(err);
					return null;
				} finally {
					setSideChatBusy("");
					updateSubagentPanelUi({
						force: true,
						scrollSideChatToBottom: true
					});
				}
			}
			async function createSideChatCandidateFromDraft() {
				const threadId = sideChatThreadId();
				const text = currentSideChatDraftText(threadId).trim();
				if (!threadId || !text || state.sideChatBusyKey) return;
				await createSideChatCandidateFromText(text, {
					clearDraft: true,
					busyKey: "candidate"
				});
			}
			function sideChatMessageTextByIndex(index) {
				const message = sideChatStateForThread(sideChatThreadId()).messages[Number(index)];
				return String(message && message.text || "").trim();
			}
			async function createSideChatCandidateFromMessage(index, nextAction = "") {
				const text = sideChatMessageTextByIndex(index);
				if (!text || state.sideChatBusyKey) return;
				const candidate = await createSideChatCandidateFromText(text, { busyKey: `message-candidate:${index}` });
				const id = String(candidate && candidate.id || "");
				if (!id) return;
				if (nextAction === "apply") await applySideChatCandidate(id);
				else if (nextAction === "queue") await queueSideChatCandidate(id, state.activeTurnId ? "autoSendWhenIdle" : "confirmWhenIdle");
			}
			async function queueSideChatCandidate(candidateId, mode = "autoSendWhenIdle") {
				const threadId = sideChatThreadId();
				const id = String(candidateId || "");
				if (!threadId || !id || state.sideChatBusyKey) return;
				setSideChatBusy(`queue:${id}`);
				try {
					applySideChatResult(threadId, await api(sideChatApiPath(threadId, `/candidates/${encodeURIComponent(id)}/queue`), {
						method: "POST",
						body: JSON.stringify({
							mode,
							idempotencyKey: `sidechat:${threadId}:${id}:${mode}`
						}),
						timeoutMs: 2e4
					}));
					state.sideChatError = "";
					setSideChatNotice("success", mode === "autoSendWhenIdle" ? "已排队，当前任务完成后会发送到主线程。" : "候选已排队，空闲后可从队列继续。", {
						actionLabel: "打开队列",
						candidateId: id
					});
					markActivity(mode === "autoSendWhenIdle" ? "侧聊已排队" : "候选已排队");
				} catch (err) {
					state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
					showError(err);
				} finally {
					setSideChatBusy("");
					updateSubagentPanelUi({
						force: true,
						scrollSideChatToBottom: true
					});
				}
			}
			async function applySideChatCandidate(candidateId) {
				const threadId = sideChatThreadId();
				const id = String(candidateId || "");
				if (!threadId || !id || state.sideChatBusyKey) return;
				if (state.activeTurnId) {
					await queueSideChatCandidate(id, "autoSendWhenIdle");
					return;
				}
				setSideChatBusy(`apply:${id}`);
				try {
					applySideChatResult(threadId, await api(sideChatApiPath(threadId, `/candidates/${encodeURIComponent(id)}/apply`), {
						method: "POST",
						body: JSON.stringify({
							mode: "confirmWhenIdle",
							idempotencyKey: `sidechat:${threadId}:${id}:apply`
						}),
						timeoutMs: 18e4
					}));
					state.sideChatError = "";
					clearSideChatNotice();
					markActivity("侧聊已发送");
					scheduleCurrentThreadRefresh(600);
					scheduleLivePollIfNeeded(1200);
					loadThreads({ silent: true }).catch(showError);
				} catch (err) {
					state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
					showError(err);
				} finally {
					setSideChatBusy("");
					updateSubagentPanelUi({ force: true });
				}
			}
			async function cancelSideChatCandidate(candidateId) {
				const threadId = sideChatThreadId();
				const id = String(candidateId || "");
				if (!threadId || !id || state.sideChatBusyKey) return;
				setSideChatBusy(`cancel:${id}`);
				try {
					applySideChatResult(threadId, await api(sideChatApiPath(threadId, `/candidates/${encodeURIComponent(id)}/cancel`), {
						method: "POST",
						body: JSON.stringify({}),
						timeoutMs: 2e4
					}));
					state.sideChatError = "";
					clearSideChatNotice();
				} catch (err) {
					state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
					showError(err);
				} finally {
					setSideChatBusy("");
					updateSubagentPanelUi({ force: true });
				}
			}
			async function clearSideChat() {
				const threadId = sideChatThreadId();
				if (!threadId || state.sideChatBusyKey) return;
				if (!await requestAppConfirmation("清空这个线程的侧聊内容？", {
					title: "清空侧聊",
					confirmLabel: "清空",
					cancelLabel: "取消"
				})) return;
				setSideChatBusy("clear");
				try {
					clearTimeout(state.sideChatDraftSaveTimer);
					state.sideChatDraftSaveTimer = null;
					applySideChatResult(threadId, await api(sideChatApiPath(threadId, "/clear"), {
						method: "POST",
						body: JSON.stringify({}),
						timeoutMs: 2e4
					}));
					state.sideChatError = "";
					clearSideChatNotice();
				} catch (err) {
					state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
					showError(err);
				} finally {
					setSideChatBusy("");
					updateSubagentPanelUi({ force: true });
				}
			}
			function handleSideChatActionClick(event) {
				const button = event && event.currentTarget || event && event.target && event.target.closest("[data-side-chat-action]");
				if (!button) return;
				const action = String(button.dataset.sideChatAction || "");
				const candidateId = String(button.dataset.candidateId || "");
				const messageIndex = String(button.dataset.messageIndex || "");
				if (action === "candidate") createSideChatCandidateFromDraft();
				else if (action === "tools") {
					const row = button.closest("[data-side-chat-form]") && button.closest("[data-side-chat-form]").querySelector(".side-chat-tool-row");
					if (row) row.hidden = !row.hidden;
				} else if (action === "message-candidate") createSideChatCandidateFromMessage(messageIndex);
				else if (action === "message-apply") createSideChatCandidateFromMessage(messageIndex, "apply");
				else if (action === "message-queue") createSideChatCandidateFromMessage(messageIndex, "queue");
				else if (action === "apply") applySideChatCandidate(candidateId);
				else if (action === "queue") queueSideChatCandidate(candidateId, state.activeTurnId ? "autoSendWhenIdle" : "confirmWhenIdle");
				else if (action === "cancel") cancelSideChatCandidate(candidateId);
				else if (action === "clear") clearSideChat();
				else if (action === "open-notice") openSideChatCandidate(candidateId);
				else if (action === "dismiss-notice") {
					clearSideChatNotice();
					updateSubagentPanelUi({ force: true });
				}
			}
			function openSubagentPanelFromGesture() {
				if (!state.currentThread) return;
				state.subagentPanelOpen = true;
				updateSubagentPanelUi({
					force: true,
					scrollSideChatToBottom: true
				});
				if (!state.threadSideChats.has(sideChatThreadId())) loadSideChat(sideChatThreadId(), { silent: true }).catch(showError);
			}
			function isHorizontalScrollableGestureTarget(target) {
				return Boolean(target && target.closest && target.closest(".markdown-mermaid-viewer, .markdown-mermaid-canvas, .markdown-mermaid-artboard, .markdown-table-wrap, .markdown-code-table-preview, .markdown-code-block pre"));
			}
			function subagentSwipeEdgeLimitPx() {
				const viewportWidth = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
				if (!viewportWidth) return SUBAGENT_EDGE_SWIPE_PX;
				const responsiveLimit = Math.round(viewportWidth * SUBAGENT_EDGE_SWIPE_RATIO);
				return Math.min(SUBAGENT_EDGE_SWIPE_MAX_PX, Math.max(SUBAGENT_EDGE_SWIPE_PX, responsiveLimit));
			}
			function subagentSwipeStartsNearEdge(clientX) {
				const x = Number(clientX);
				const viewportWidth = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
				if (!Number.isFinite(x) || !viewportWidth) return false;
				return viewportWidth - x <= subagentSwipeEdgeLimitPx();
			}
			function beginSubagentSwipe(event) {
				if (!subagentSwipeAvailable()) return;
				if (event.touches && event.touches.length > 1) return;
				if (isInteractiveGestureTarget(event.target)) return;
				if (isHorizontalScrollableGestureTarget(event.target)) return;
				const touch = primaryTouch(event);
				if (!touch) return;
				if (!subagentSwipeStartsNearEdge(touch.clientX)) return;
				state.subagentSwipe = {
					startX: touch.clientX,
					startY: touch.clientY,
					currentX: touch.clientX,
					currentY: touch.clientY,
					moved: false
				};
			}
			function moveSubagentSwipe(event) {
				const swipe = state.subagentSwipe;
				if (!swipe) return;
				const touch = primaryTouch(event);
				if (!touch) return;
				const dx = touch.clientX - swipe.startX;
				const dy = touch.clientY - swipe.startY;
				if (!swipe.moved) {
					if (Math.abs(dx) < 10 && Math.abs(dy) < 12) return;
					if (dx >= 0 || Math.abs(dy) > Math.abs(dx)) {
						cancelSubagentSwipe();
						return;
					}
				}
				swipe.moved = true;
				swipe.currentX = touch.clientX;
				swipe.currentY = touch.clientY;
				if (event.cancelable !== false) event.preventDefault();
			}
			function finishSubagentSwipe() {
				const swipe = state.subagentSwipe;
				state.subagentSwipe = null;
				if (!swipe || !swipe.moved) return;
				const dx = Number(swipe.currentX || swipe.startX) - swipe.startX;
				const dy = Number(swipe.currentY || swipe.startY) - swipe.startY;
				if (dx <= -SUBAGENT_SWIPE_MIN_PX && Math.abs(dy) <= Math.abs(dx) * .85) openSubagentPanelFromGesture();
			}
			function cancelSubagentSwipe() {
				state.subagentSwipe = null;
			}
			function handleSubagentWheelSwipe(event) {
				if (state.subagentPanelOpen || !subagentSwipeAvailable()) return;
				if (isHorizontalScrollableGestureTarget(event.target)) return;
				if (!subagentSwipeStartsNearEdge(event.clientX)) return;
				const dx = Number(event.deltaX || 0);
				const dy = Number(event.deltaY || 0);
				if (dx >= SUBAGENT_WHEEL_SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.2) openSubagentPanelFromGesture();
			}
			return Object.freeze({
				isSubagentItem,
				turnSubagentItems,
				activeSubagentItems,
				currentSubagentTurn,
				currentSubagentItems,
				subagentStatusKind,
				isActiveSubagentItem,
				currentSubagentStatusKind,
				subagentStatusLabel,
				subagentSwipeAvailable,
				sideChatThreadId,
				defaultSideChatState,
				normalizeSideChatSidecar,
				normalizeSideChatState,
				setSideChatState,
				sideChatStateForThread,
				sideChatApiPath,
				sideChatDraftTextarea,
				ensureSideChatDraftVisible,
				autoSizeSideChatDraftTextarea,
				sideChatScrollContainer,
				scrollSideChatToBottom,
				scheduleSideChatToBottom,
				openSideChatCandidate,
				currentSideChatDraftText,
				truncateSideChatText,
				loadSideChat,
				sideChatReplyPending,
				scheduleSideChatPoll,
				saveSideChatDraft,
				scheduleSideChatDraftSave,
				flushSideChatDraftNow,
				sideChatStatusLabel,
				sideChatQueueSummary,
				sideChatTimeLabel,
				sideChatBusy,
				setSideChatNotice,
				clearSideChatNotice,
				sideChatNoticeForThread,
				sideChatPanelRenderSignature,
				renderSideChatNotice,
				renderSubagentStatusWindow,
				latestAssistantSideChatMessageIndex,
				renderSideChatMessage,
				renderSideChatCandidate,
				renderSideChatPanel,
				renderSubagentPanel,
				updateSubagentPanelUi,
				visualHarnessThreadShape,
				simulateEmptyCachedDetailOpenForHarness,
				simulateStableSignatureEmptyDomForHarness,
				refreshSideChatFormButtons,
				setSideChatBusy,
				applySideChatResult,
				handleSideChatDraftInput,
				installCodexMobileVisualHarnessFacade,
				submitSideChatMessage,
				createSideChatCandidateFromText,
				createSideChatCandidateFromDraft,
				sideChatMessageTextByIndex,
				createSideChatCandidateFromMessage,
				queueSideChatCandidate,
				applySideChatCandidate,
				cancelSideChatCandidate,
				clearSideChat,
				handleSideChatActionClick,
				openSubagentPanelFromGesture,
				isHorizontalScrollableGestureTarget,
				subagentSwipeEdgeLimitPx,
				subagentSwipeStartsNearEdge,
				beginSubagentSwipe,
				moveSubagentSwipe,
				finishSubagentSwipe,
				cancelSubagentSwipe,
				handleSubagentWheelSwipe
			});
		}
		root.CodexSideChatRuntime = Object.freeze({ createSideChatRuntime });
		if (typeof module !== "undefined" && module.exports) module.exports = { createSideChatRuntime };
	})(typeof window !== "undefined" ? window : globalThis);
}));
//#endregion
//#region public/composer-bridge-runtime.js
var require_composer_bridge_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function attachComposerBridgeRuntime(root) {
		function updateComposerHeightVar(...args) {
			return composerRuntime.updateComposerHeightVar(...args);
		}
		function showError(err) {
			const raw = err instanceof Error ? err.message : String(err || "");
			const message = normalizeClientErrorMessage(raw, err) || err && err.message || String(err);
			$("connectionState").textContent = message;
			$("connectionState").classList.add("error");
			postClientEvent("client_error", {
				message,
				raw,
				currentThreadId: state.currentThreadId || "",
				composerBusy: state.composerBusy,
				continuationBusy: state.continuationBusy
			});
		}
		function clearSendProgressWatchdog(...args) {
			return composerRuntime.clearSendProgressWatchdog(...args);
		}
		function startSendProgressWatchdog(...args) {
			return composerRuntime.startSendProgressWatchdog(...args);
		}
		function finishSendProgressWatchdog(...args) {
			return composerRuntime.finishSendProgressWatchdog(...args);
		}
		function threadNotificationThrottleKey(method, params) {
			if (!params) return "";
			if (method === "thread/started" && params.thread) return `${method}:${String(params.thread.id || "")}:${String(statusText(params.thread.status) || "")}`;
			if (method === "thread/status/changed") return `${method}:${String(params.threadId || "")}:${String(statusText(params.status) || "")}`;
			if (method === "thread/name/updated") return `${method}:${String(params.threadId || "")}:${String(params.threadName || "")}`;
			if (method === "thread/archived") return `${method}:${String(params.threadId || "")}`;
			return "";
		}
		function shouldThrottleThreadNotification(method, params) {
			const key = threadNotificationThrottleKey(method, params);
			if (!key) return false;
			const now = Date.now();
			if (now - (state.threadNotificationThrottle.get(key) || 0) < 450) return true;
			state.threadNotificationThrottle.set(key, now);
			if (state.threadNotificationThrottle.size > 220) {
				for (const [existingKey, existingAt] of state.threadNotificationThrottle.entries()) if (now - existingAt > 8e3) state.threadNotificationThrottle.delete(existingKey);
				if (state.threadNotificationThrottle.size > 220) for (const existingKey of Array.from(state.threadNotificationThrottle.keys()).slice(0, 120)) state.threadNotificationThrottle.delete(existingKey);
			}
			return false;
		}
		function normalizeClientErrorMessage(...args) {
			return composerRuntime.normalizeClientErrorMessage(...args);
		}
		function rawMessageFallback(...args) {
			return composerRuntime.rawMessageFallback(...args);
		}
		function composerText(...args) {
			return composerRuntime.composerText(...args);
		}
		function setComposerText(...args) {
			return composerRuntime.setComposerText(...args);
		}
		function placeMessageInputCaretAtEnd(...args) {
			return composerRuntime.placeMessageInputCaretAtEnd(...args);
		}
		function focusMessageInput(...args) {
			return composerRuntime.focusMessageInput(...args);
		}
		function messageInputKeyboardVisible(...args) {
			return composerRuntime.messageInputKeyboardVisible(...args);
		}
		function shouldRecoverMessageInputKeyboard(...args) {
			return composerRuntime.shouldRecoverMessageInputKeyboard(...args);
		}
		function recoverMessageInputKeyboardFromGesture(...args) {
			return composerRuntime.recoverMessageInputKeyboardFromGesture(...args);
		}
		function messageInputCanEnableForNativeGesture(...args) {
			return composerRuntime.messageInputCanEnableForNativeGesture(...args);
		}
		function releaseStaleAndroidMessageInputFocusBeforeNativeTap(...args) {
			return composerRuntime.releaseStaleAndroidMessageInputFocusBeforeNativeTap(...args);
		}
		function prepareMessageInputForNativeGesture(...args) {
			return composerRuntime.prepareMessageInputForNativeGesture(...args);
		}
		function normalizedComposerIntentText(...args) {
			return composerRuntime.normalizedComposerIntentText(...args);
		}
		function composerIntentOptions(...args) {
			return composerRuntime.composerIntentOptions(...args);
		}
		function composerIntentOption(...args) {
			return composerRuntime.composerIntentOption(...args);
		}
		function composerIntentDraftKey(...args) {
			return composerRuntime.composerIntentDraftKey(...args);
		}
		function loadComposerIntentDraft(...args) {
			return composerRuntime.loadComposerIntentDraft(...args);
		}
		function saveComposerIntentDraft(...args) {
			return composerRuntime.saveComposerIntentDraft(...args);
		}
		function composerIntentBareTagKind(...args) {
			return composerRuntime.composerIntentBareTagKind(...args);
		}
		function shouldShowComposerIntentMenu(...args) {
			return composerRuntime.shouldShowComposerIntentMenu(...args);
		}
		function closeComposerIntentMenu(...args) {
			return composerRuntime.closeComposerIntentMenu(...args);
		}
		function onComposerIntentOutsidePointer(...args) {
			return composerRuntime.onComposerIntentOutsidePointer(...args);
		}
		function openComposerIntentMenu(...args) {
			return composerRuntime.openComposerIntentMenu(...args);
		}
		function positionComposerIntentMenu(...args) {
			return composerRuntime.positionComposerIntentMenu(...args);
		}
		function updateComposerIntentMenu(...args) {
			return composerRuntime.updateComposerIntentMenu(...args);
		}
		function queueComposerIntentMenuUpdate(...args) {
			return composerRuntime.queueComposerIntentMenuUpdate(...args);
		}
		function selectComposerIntent(...args) {
			return composerRuntime.selectComposerIntent(...args);
		}
		function setComposerIntentDialogStatus(...args) {
			return composerRuntime.setComposerIntentDialogStatus(...args);
		}
		function closeComposerIntentDialog(...args) {
			return composerRuntime.closeComposerIntentDialog(...args);
		}
		function openComposerIntentDialog(...args) {
			return composerRuntime.openComposerIntentDialog(...args);
		}
		async function submitComposerIntentDialog(...args) {
			return composerRuntime.submitComposerIntentDialog(...args);
		}
		function saveComposerIntentDialogDraft(...args) {
			return composerRuntime.saveComposerIntentDialogDraft(...args);
		}
		function shouldKeepAndroidMessageInputEditable(...args) {
			return composerRuntime.shouldKeepAndroidMessageInputEditable(...args);
		}
		function setMessageInputDisabled(...args) {
			return composerRuntime.setMessageInputDisabled(...args);
		}
		function messageInputTextLength(...args) {
			return composerRuntime.messageInputTextLength(...args);
		}
		function messageInputTargetHeight(...args) {
			return composerRuntime.messageInputTargetHeight(...args);
		}
		function currentMessageInputHeight(...args) {
			return composerRuntime.currentMessageInputHeight(...args);
		}
		function updateMessageInputOverflow(...args) {
			return composerRuntime.updateMessageInputOverflow(...args);
		}
		function autoSizeMessageInput(...args) {
			return composerRuntime.autoSizeMessageInput(...args);
		}
		function formatFileSize(...args) {
			return composerRuntime.formatFileSize(...args);
		}
		function appendLocalAttachmentSummary(...args) {
			return composerRuntime.appendLocalAttachmentSummary(...args);
		}
		function localImageInputPartsForAttachments(...args) {
			return composerRuntime.localImageInputPartsForAttachments(...args);
		}
		function localUserMessageItem(...args) {
			return composerRuntime.localUserMessageItem(...args);
		}
		function attachmentId(...args) {
			return composerRuntime.attachmentId(...args);
		}
		function pendingAttachmentBytes(...args) {
			return composerRuntime.pendingAttachmentBytes(...args);
		}
		async function prepareAttachmentFile(...args) {
			return composerRuntime.prepareAttachmentFile(...args);
		}
		async function prepareAttachmentFiles(...args) {
			return composerRuntime.prepareAttachmentFiles(...args);
		}
		async function addAttachmentFiles(...args) {
			return composerRuntime.addAttachmentFiles(...args);
		}
		function removeAttachment(...args) {
			return composerRuntime.removeAttachment(...args);
		}
		function clearPendingAttachments(...args) {
			return composerRuntime.clearPendingAttachments(...args);
		}
		function renderAttachmentList(...args) {
			return composerRuntime.renderAttachmentList(...args);
		}
		function composerHasContent(...args) {
			return composerRuntime.composerHasContent(...args);
		}
		function effectiveDefaultModel(...args) {
			return composerRuntime.effectiveDefaultModel(...args);
		}
		function effectiveDefaultEffort(...args) {
			return composerRuntime.effectiveDefaultEffort(...args);
		}
		function effectiveDefaultPermissionMode(...args) {
			return composerRuntime.effectiveDefaultPermissionMode(...args);
		}
		function selectedComposerModel(...args) {
			return composerRuntime.selectedComposerModel(...args);
		}
		function selectedComposerEffort(...args) {
			return composerRuntime.selectedComposerEffort(...args);
		}
		function selectedComposerPermissionMode(...args) {
			return composerRuntime.selectedComposerPermissionMode(...args);
		}
		function resetComposerRuntimeSelection(...args) {
			return composerRuntime.resetComposerRuntimeSelection(...args);
		}
		function runtimeOptionValues(...args) {
			return composerRuntime.runtimeOptionValues(...args);
		}
		function runtimeOptionLabel(...args) {
			return composerRuntime.runtimeOptionLabel(...args);
		}
		function runtimeSelectedValue(...args) {
			return composerRuntime.runtimeSelectedValue(...args);
		}
		function codexFastCommandEnabled(...args) {
			return composerRuntime.codexFastCommandEnabled(...args);
		}
		function clearLegacyCodexFastModeStorage(...args) {
			return composerRuntime.clearLegacyCodexFastModeStorage(...args);
		}
		function setCodexFastCommandEnabled(...args) {
			return composerRuntime.setCodexFastCommandEnabled(...args);
		}
		function applyRuntimeSelection(...args) {
			return composerRuntime.applyRuntimeSelection(...args);
		}
		function closeComposerRuntimeMenu(...args) {
			return composerRuntime.closeComposerRuntimeMenu(...args);
		}
		function onComposerRuntimeOutsidePointer(...args) {
			return composerRuntime.onComposerRuntimeOutsidePointer(...args);
		}
		function openComposerRuntimeMenu(...args) {
			return composerRuntime.openComposerRuntimeMenu(...args);
		}
		function composerRuntimeMenuDiagnostics(...args) {
			return composerRuntime.composerRuntimeMenuDiagnostics(...args);
		}
		function reportComposerRuntimeMenu(...args) {
			return composerRuntime.reportComposerRuntimeMenu(...args);
		}
		function handleComposerRuntimeControl(...args) {
			return composerRuntime.handleComposerRuntimeControl(...args);
		}
		function fitComposerPopupToAnchor(...args) {
			return composerRuntime.fitComposerPopupToAnchor(...args);
		}
		function closeQuotaDetails(...args) {
			return composerRuntime.closeQuotaDetails(...args);
		}
		function onQuotaOutsidePointer(...args) {
			return composerRuntime.onQuotaOutsidePointer(...args);
		}
		function toggleQuotaDetails(...args) {
			return composerRuntime.toggleQuotaDetails(...args);
		}
		function composerPlaceholderText(...args) {
			return composerRuntime.composerPlaceholderText(...args);
		}
		function composerShowsTargetPlaceholder(...args) {
			return composerRuntime.composerShowsTargetPlaceholder(...args);
		}
		function applyComposerActionControlPlan(...args) {
			return composerRuntime.applyComposerActionControlPlan(...args);
		}
		function renderComposerSettings(...args) {
			return composerRuntime.renderComposerSettings(...args);
		}
		function updateComposerControls(...args) {
			return composerRuntime.updateComposerControls(...args);
		}
		function hasTransferFiles(...args) {
			return composerRuntime.hasTransferFiles(...args);
		}
		function goalDialogFormValues(...args) {
			return composerRuntime.goalDialogFormValues(...args);
		}
		async function submitThreadGoalMessage(...args) {
			return composerRuntime.submitThreadGoalMessage(...args);
		}
		function threadGoalActionStatusText(...args) {
			return composerRuntime.threadGoalActionStatusText(...args);
		}
		function threadGoalActionBusyText(...args) {
			return composerRuntime.threadGoalActionBusyText(...args);
		}
		async function runThreadGoalDialogAction(...args) {
			return composerRuntime.runThreadGoalDialogAction(...args);
		}
		function requestGoalDialogSubmitFromEnter(...args) {
			return composerRuntime.requestGoalDialogSubmitFromEnter(...args);
		}
		function requestGoalDialogSubmitFromButton(...args) {
			return composerRuntime.requestGoalDialogSubmitFromButton(...args);
		}
		function requestGoalDialogSubmit(...args) {
			return composerRuntime.requestGoalDialogSubmit(...args);
		}
		async function sendThreadTaskCardCommand(...args) {
			return composerRuntime.sendThreadTaskCardCommand(...args);
		}
		async function sendMessage(...args) {
			return composerRuntime.sendMessage(...args);
		}
		async function sendNewThreadMessage(...args) {
			return composerRuntime.sendNewThreadMessage(...args);
		}
		function requestComposerSubmitFromButton(...args) {
			return composerRuntime.requestComposerSubmitFromButton(...args);
		}
		function requestAttachmentPickerFromButton(...args) {
			return composerRuntime.requestAttachmentPickerFromButton(...args);
		}
		async function interruptActiveTurn(...args) {
			return composerRuntime.interruptActiveTurn(...args);
		}
		async function answerServerRequest(requestId, payload, options = {}) {
			const key = requestId !== null && requestId !== void 0 ? String(requestId) : "";
			const request = state.pendingApprovals.get(key);
			if (!request || request.status !== "waiting") return;
			const threadId = approvalActionThreadId(request, options.threadId);
			request.status = "responding";
			request.decision = payload && (payload.decision || payload.action) || "submitted";
			markActivity(isUserInputRequest(request) ? "输入发送中" : "批准中");
			scheduleApprovalThreadRender(threadId);
			try {
				const result = await api(`/api/approvals/${encodeURIComponent(key)}`, {
					method: "POST",
					body: JSON.stringify(payload || {}),
					timeoutMs: 2e4
				});
				if (result && result.request) state.pendingApprovals.set(key, serverRequestWithThreadContext(result.request, threadId));
				$("connectionState").classList.remove("error");
				$("connectionState").textContent = isUserInputRequest(request) ? "Response sent" : "Approval sent";
				markActivity(isUserInputRequest(request) ? "输入已发送" : "批准发送");
				scheduleApprovalThreadRender(threadId);
			} catch (err) {
				request.status = "waiting";
				request.decision = null;
				showError(err);
				scheduleApprovalThreadRender(threadId);
			}
		}
		function answerApproval(requestId, decision, options = {}) {
			return answerServerRequest(requestId, { decision }, options);
		}
		function serverRequestPayload(request, responseText, questionId) {
			if (request && request.method === "mcpServer/elicitation/request") return {
				action: "accept",
				responseText
			};
			return {
				responseText,
				questionId
			};
		}
		function declineServerRequest(requestId, options = {}) {
			const key = requestId !== null && requestId !== void 0 ? String(requestId) : "";
			const request = state.pendingApprovals.get(key);
			if (!request) return Promise.resolve();
			if (request.method === "mcpServer/elicitation/request") return answerServerRequest(key, { action: "decline" }, options);
			if (request.method === "item/tool/requestUserInput") return answerServerRequest(key, { answers: {} }, options);
			return answerApproval(key, "deny", options);
		}
		async function mutateThreadTaskCard(cardId, action, body = {}, options = {}) {
			const id = String(cardId || "").trim();
			const threadId = String(options.threadId || body.threadId || state.currentThreadId || "").trim();
			if (!id || !threadId) return;
			$("connectionState").classList.remove("error");
			$("connectionState").textContent = action === "approve" ? "Approving task card" : `${action} task card`;
			try {
				const result = await api(`/api/thread-task-cards/${encodeURIComponent(id)}/${encodeURIComponent(action)}`, {
					method: "POST",
					body: JSON.stringify(Object.assign({}, body, { threadId })),
					timeoutMs: 3e4
				});
				if (action === "approve" && result && result.execution && result.execution.turnId) $("connectionState").textContent = "Task card approved; starting target turn";
				else $("connectionState").textContent = "Task card updated";
				settleThreadTaskCardForThread(threadId, id, action === "approve" ? "approved" : action === "delete" ? "deleted" : action === "revoke" ? "revoked" : "replied", result && result.card ? result.card : null);
				recordHomeAiDiagnosticSuccess({
					category: "task_card_workflow_failed",
					diagnostic_type: action === "reply" ? "task_card_return_failed" : "task_card_action_failed",
					error_code: action === "reply" ? "task_card_return_failed" : "task_card_action_failed",
					context: {
						surface: "task-card",
						action: homeAiDiagnosticReportingApi.boundedToken(action, "mutate", 40),
						thread_hash: diagnosticThreadHash(threadId),
						task_hash: diagnosticTaskHash(id)
					}
				});
				if (action === "approve" && result && result.execution && result.execution.turnId) {
					let injectedVisible = false;
					if (threadId === String(state.currentThreadId || "")) injectedVisible = await waitForCurrentThreadTurn(result.execution.turnId, {
						timeoutMs: 1e4,
						intervalMs: 500
					});
					else scheduleComposerTargetRefresh(threadId, 300, "task-card-approved");
					$("connectionState").textContent = injectedVisible ? "Task card approved and injected" : "Task card approved; waiting for thread refresh";
					loadThreads({ silent: true }).catch(showError);
					return;
				}
				await refreshThreadAfterTaskCard(threadId);
			} catch (err) {
				showError(err);
			}
		}
		async function replyTaskCard(cardId, options = {}) {
			const threadId = String(options.threadId || state.currentThreadId || "").trim();
			const card = findThreadTaskCard(cardId, threadId);
			if (!card) return;
			const body = await requestAppTextInput("输入回复内容。", "", {
				title: "回复任务卡片",
				confirmLabel: "发送回复",
				rows: 6
			}) || "";
			if (!String(body).trim()) return;
			const title = `Reply: ${card.message && card.message.title ? card.message.title : "Task card"}`;
			return mutateThreadTaskCard(card.id, "reply", {
				format: "markdown",
				title,
				summary: summarizeTaskCardText(body),
				body: String(body).trim(),
				idempotencyKey: `task-card-reply:${card.id}:${Date.now()}:${Math.random().toString(16).slice(2, 8)}`
			}, { threadId });
		}
		function findThreadTaskCardDraftByKey(draftKey, thread = renderContextThread()) {
			const key = String(draftKey || "");
			const sourceThread = renderContextThread(thread) || state.currentThread;
			const turns = Array.isArray(sourceThread && sourceThread.turns) ? sourceThread.turns : [];
			for (const turn of turns) {
				const items = Array.isArray(turn && turn.items) ? turn.items : [];
				for (const item of items) {
					if (!item || item.type !== "agentMessage" && item.type !== "plan") continue;
					const draft = parseThreadTaskCardDraftText(item.text || "");
					if (!draft) continue;
					const itemKey = threadTaskCardDraftKeyForDraft(turn, draft, item);
					const legacyItemKey = threadTaskCardDraftKey(turn.id, item.id || "");
					if (itemKey !== key && legacyItemKey !== key) continue;
					return {
						key,
						draft,
						turn,
						item,
						sourceThread
					};
				}
			}
			return null;
		}
		function scheduleThreadTaskCardDraftStateRender(threadId = "") {
			const id = String(threadId || state.currentThreadId || "").trim();
			if (!id || id === String(state.currentThreadId || "")) {
				renderCurrentThread();
				return true;
			}
			if (state.threadTileMode && threadTilePaneIsVisible(id)) {
				if (!scheduleRenderThreadTilePane(id, { preserveScroll: true })) renderCurrentThread();
				return true;
			}
			return false;
		}
		function setThreadTaskCardDraftState(draftKey, nextState, options = {}) {
			const key = String(draftKey || "");
			if (!key) return;
			state.threadTaskCardDraftStates.set(key, Object.assign({}, threadTaskCardDraftState(key), nextState || {}, { updatedAtMs: Date.now() }));
			saveThreadTaskCardDraftStates();
			const threadId = String(options.threadId || options.thread && options.thread.id || "").trim();
			if (options.render !== false) scheduleThreadTaskCardDraftStateRender(threadId);
		}
		function dismissThreadTaskCardDraft(draftKey, options = {}) {
			setThreadTaskCardDraftState(draftKey, {
				status: "dismissed",
				error: ""
			}, options);
		}
		function queueThreadTaskCardDraftCreation(draftKey, thread = renderContextThread()) {
			const key = String(draftKey || "");
			if (!key || state.scheduledThreadTaskCardDraftCreations.has(key) || state.activeThreadTaskCardDraftCreations.has(key)) return;
			const sourceThreadId = renderContextThreadId(thread);
			state.scheduledThreadTaskCardDraftCreations.add(key);
			const current = threadTaskCardDraftState(key);
			setThreadTaskCardDraftState(key, {
				status: "creating",
				error: "",
				attempts: Math.max(0, Number(current.attempts || 0)) + 1
			}, { render: false });
			window.setTimeout(() => {
				state.scheduledThreadTaskCardDraftCreations.delete(key);
				createThreadTaskCardDraft(key, { threadId: sourceThreadId }).catch(showError);
			}, 0);
		}
		async function createThreadTaskCardDraft(draftKey, options = {}) {
			const activeKey = String(draftKey || "");
			if (!activeKey || state.activeThreadTaskCardDraftCreations.has(activeKey)) return;
			state.activeThreadTaskCardDraftCreations.add(activeKey);
			const requestedThreadId = String(options.threadId || "").trim();
			try {
				const requestedThread = taskCardActionThread(requestedThreadId);
				const resolved = findThreadTaskCardDraftByKey(draftKey, requestedThread);
				const sourceThread = resolved && (resolved.sourceThread || requestedThread || state.currentThread);
				const sourceThreadId = String(sourceThread && sourceThread.id || requestedThreadId || "").trim();
				if (!resolved || !sourceThreadId || !sourceThread) {
					setThreadTaskCardDraftState(draftKey, {
						status: "pending",
						error: ""
					}, { render: false });
					return;
				}
				const { draft, turn } = resolved;
				const targetRefs = threadTaskCardDraftTargetThreads(draft);
				const targetThreadIds = threadTaskCardDraftTargetIds(draft);
				if (!targetThreadIds.length) {
					setThreadTaskCardDraftState(draftKey, {
						status: "failed",
						error: draft.error || "Draft did not include a target thread id"
					}, { threadId: sourceThreadId });
					return;
				}
				if (!draft.title || !draft.body) {
					setThreadTaskCardDraftState(draftKey, {
						status: "failed",
						error: draft.error || "Draft is incomplete"
					}, { threadId: sourceThreadId });
					return;
				}
				setThreadTaskCardDraftState(draftKey, {
					status: "creating",
					error: ""
				}, { threadId: sourceThreadId });
				$("connectionState").classList.remove("error");
				$("connectionState").textContent = "Creating task card";
				const body = truncateThreadTaskCardBody(draft.body);
				const targetWorkspaceIds = {};
				for (const entry of targetRefs) if (entry.thread) targetWorkspaceIds[entry.threadId] = String(entry.thread.cwd || "");
				const result = await api("/api/thread-task-cards", {
					method: "POST",
					body: JSON.stringify({
						sourceWorkspaceId: sourceThread.cwd || state.selectedCwd || "",
						sourceThreadId,
						sourceTurnId: String(turn && turn.id || ""),
						sourceThreadTitle: threadTitleForDisplay(sourceThread) || sourceThreadId,
						targetThreadIds,
						targetWorkspaceIds,
						idempotencyKey: `task-card-draft:${sourceThreadId}:${draftKey}`,
						format: "markdown",
						title: draft.title,
						summary: draft.summary || summarizeTaskCardText(body),
						body,
						workflowMode: draft.workflowMode || "manual",
						workflowId: draft.workflowId || ""
					}),
					timeoutMs: 3e4
				});
				const createdCards = Array.isArray(result && result.cards) ? result.cards.filter(Boolean) : result && result.card ? [result.card] : [];
				if (!createdCards.length) throw new Error("Task card creation returned no cards");
				for (const createdCard of createdCards) {
					const pending = String(createdCard && createdCard.status || "pending") === "pending";
					upsertThreadTaskCardOnThread(sourceThread, createdCard);
					if (pending) {
						incrementPendingOutgoingTaskCardCount(sourceThreadId, 1);
						incrementPendingIncomingTaskCardCount(createdCard && createdCard.target && createdCard.target.threadId, 1);
					}
				}
				if (state.threadTileDetails.has(sourceThreadId)) state.threadTileDetails.set(sourceThreadId, sourceThread);
				setThreadTaskCardDraftState(draftKey, {
					status: "created",
					error: "",
					cardId: String(createdCards[0] && createdCards[0].id || ""),
					cardIds: createdCards.map((card) => String(card && card.id || "")).filter(Boolean)
				}, { threadId: sourceThreadId });
				$("connectionState").classList.remove("error");
				$("connectionState").textContent = createdCards.length === 1 ? "Task card created; opening target thread" : `Task cards created: ${createdCards.length}`;
				state.pendingPluginRouteHint = createdCards.length === 1 ? normalizePluginRouteHint({
					pluginId: "codex-mobile",
					route: "thread-task-card",
					threadId: createdCards[0].target && createdCards[0].target.threadId || targetThreadIds[0],
					taskId: createdCards[0].id
				}) : null;
				recordHomeAiDiagnosticSuccess({
					category: "task_card_workflow_failed",
					diagnostic_type: "task_card_draft_materialize_failed",
					error_code: "task_card_draft_materialize_failed",
					context: {
						surface: "task-card",
						action: "draft-materialize",
						thread_hash: diagnosticThreadHash(sourceThreadId),
						item_hash: diagnosticItemHash(draftKey)
					}
				});
				renderThreads();
				loadThreads({ silent: true }).catch(showError);
				if (createdCards.length === 1) await loadThread(createdCards[0].target && createdCards[0].target.threadId || targetThreadIds[0], { source: "task-card-created" });
				else if (sourceThreadId === String(state.currentThreadId || "")) renderCurrentThread();
				else if (state.threadTileMode && threadTilePaneIsVisible(sourceThreadId)) scheduleRenderThreadTilePane(sourceThreadId, { preserveScroll: true });
				else renderCurrentThread();
			} catch (err) {
				const diagnosticThreadId = String(options.threadId || state.currentThreadId || "").trim();
				setThreadTaskCardDraftState(draftKey, {
					status: "failed",
					error: normalizeClientErrorMessage(err && err.message ? err.message : String(err)) || "Task card creation failed"
				}, { threadId: diagnosticThreadId });
				recordHomeAiDiagnosticFailure({
					category: "task_card_workflow_failed",
					diagnostic_type: "task_card_draft_materialize_failed",
					severity_hint: "H2",
					evidence_confidence: .78,
					error_code: diagnosticErrorCode(err, "task_card_draft_materialize_failed"),
					context: {
						surface: "task-card",
						action: "draft-materialize",
						thread_hash: diagnosticThreadHash(diagnosticThreadId),
						item_hash: diagnosticItemHash(draftKey)
					},
					counts: { status_code: diagnosticErrorStatus(err) },
					breadcrumbs: [{
						kind: "task-card",
						code: "draft-materialize",
						status: "failed",
						fields: {
							status_code: diagnosticErrorStatus(err),
							item_hash: diagnosticItemHash(draftKey)
						}
					}]
				});
				throw err;
			} finally {
				state.activeThreadTaskCardDraftCreations.delete(activeKey);
			}
		}
		function createComposerBridgeRuntime() {
			return {
				sendMessage: typeof sendMessage === "function" ? sendMessage : null,
				sendNewThreadMessage: typeof sendNewThreadMessage === "function" ? sendNewThreadMessage : null,
				answerServerRequest: typeof answerServerRequest === "function" ? answerServerRequest : null,
				answerApproval: typeof answerApproval === "function" ? answerApproval : null,
				declineServerRequest: typeof declineServerRequest === "function" ? declineServerRequest : null,
				mutateThreadTaskCard: typeof mutateThreadTaskCard === "function" ? mutateThreadTaskCard : null,
				replyTaskCard: typeof replyTaskCard === "function" ? replyTaskCard : null,
				queueThreadTaskCardDraftCreation: typeof queueThreadTaskCardDraftCreation === "function" ? queueThreadTaskCardDraftCreation : null,
				createThreadTaskCardDraft: typeof createThreadTaskCardDraft === "function" ? createThreadTaskCardDraft : null
			};
		}
		const legacyGlobals = {
			updateComposerHeightVar,
			showError,
			clearSendProgressWatchdog,
			startSendProgressWatchdog,
			finishSendProgressWatchdog,
			threadNotificationThrottleKey,
			shouldThrottleThreadNotification,
			normalizeClientErrorMessage,
			rawMessageFallback,
			composerText,
			setComposerText,
			placeMessageInputCaretAtEnd,
			focusMessageInput,
			messageInputKeyboardVisible,
			shouldRecoverMessageInputKeyboard,
			recoverMessageInputKeyboardFromGesture,
			messageInputCanEnableForNativeGesture,
			releaseStaleAndroidMessageInputFocusBeforeNativeTap,
			prepareMessageInputForNativeGesture,
			normalizedComposerIntentText,
			composerIntentOptions,
			composerIntentOption,
			composerIntentDraftKey,
			loadComposerIntentDraft,
			saveComposerIntentDraft,
			composerIntentBareTagKind,
			shouldShowComposerIntentMenu,
			closeComposerIntentMenu,
			onComposerIntentOutsidePointer,
			openComposerIntentMenu,
			positionComposerIntentMenu,
			updateComposerIntentMenu,
			queueComposerIntentMenuUpdate,
			selectComposerIntent,
			setComposerIntentDialogStatus,
			closeComposerIntentDialog,
			openComposerIntentDialog,
			submitComposerIntentDialog,
			saveComposerIntentDialogDraft,
			shouldKeepAndroidMessageInputEditable,
			setMessageInputDisabled,
			messageInputTextLength,
			messageInputTargetHeight,
			currentMessageInputHeight,
			updateMessageInputOverflow,
			autoSizeMessageInput,
			formatFileSize,
			appendLocalAttachmentSummary,
			localImageInputPartsForAttachments,
			localUserMessageItem,
			attachmentId,
			pendingAttachmentBytes,
			prepareAttachmentFile,
			prepareAttachmentFiles,
			addAttachmentFiles,
			removeAttachment,
			clearPendingAttachments,
			renderAttachmentList,
			composerHasContent,
			effectiveDefaultModel,
			effectiveDefaultEffort,
			effectiveDefaultPermissionMode,
			selectedComposerModel,
			selectedComposerEffort,
			selectedComposerPermissionMode,
			resetComposerRuntimeSelection,
			runtimeOptionValues,
			runtimeOptionLabel,
			runtimeSelectedValue,
			codexFastCommandEnabled,
			clearLegacyCodexFastModeStorage,
			setCodexFastCommandEnabled,
			applyRuntimeSelection,
			closeComposerRuntimeMenu,
			onComposerRuntimeOutsidePointer,
			openComposerRuntimeMenu,
			composerRuntimeMenuDiagnostics,
			reportComposerRuntimeMenu,
			handleComposerRuntimeControl,
			fitComposerPopupToAnchor,
			closeQuotaDetails,
			onQuotaOutsidePointer,
			toggleQuotaDetails,
			composerPlaceholderText,
			composerShowsTargetPlaceholder,
			applyComposerActionControlPlan,
			renderComposerSettings,
			updateComposerControls,
			hasTransferFiles,
			goalDialogFormValues,
			submitThreadGoalMessage,
			threadGoalActionStatusText,
			threadGoalActionBusyText,
			runThreadGoalDialogAction,
			requestGoalDialogSubmitFromEnter,
			requestGoalDialogSubmitFromButton,
			requestGoalDialogSubmit,
			sendThreadTaskCardCommand,
			sendMessage,
			sendNewThreadMessage,
			requestComposerSubmitFromButton,
			requestAttachmentPickerFromButton,
			interruptActiveTurn,
			answerServerRequest,
			answerApproval,
			serverRequestPayload,
			declineServerRequest,
			mutateThreadTaskCard,
			replyTaskCard,
			findThreadTaskCardDraftByKey,
			scheduleThreadTaskCardDraftStateRender,
			setThreadTaskCardDraftState,
			dismissThreadTaskCardDraft,
			queueThreadTaskCardDraftCreation,
			createThreadTaskCardDraft
		};
		const api = { createComposerBridgeRuntime };
		if (typeof module === "object" && module.exports) module.exports = api;
		for (const [name, value] of Object.entries(legacyGlobals)) if (typeof value === "function") root[name] = value;
		root.CodexComposerBridgeRuntime = api;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
//#region public/api-client-runtime.js
var require_api_client_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function attachApiClientRuntime(root) {
		async function api(path, options = {}) {
			return apiClient.request(path, options);
		}
		function postClientEvent(event, details = {}) {
			if (!state.key) return;
			const payload = JSON.stringify({
				event,
				threadId: state.currentThreadId || "",
				path: location.pathname || "/",
				details
			});
			const url = `/api/client-events?key=${encodeURIComponent(state.key)}`;
			fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: payload,
				keepalive: true
			}).catch(() => {
				try {
					if (navigator.sendBeacon) {
						const blob = new Blob([payload], { type: "application/json" });
						navigator.sendBeacon(url, blob);
					}
				} catch (_) {}
			});
		}
		function nowPerfMs() {
			return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
		}
		function roundedDurationMs(startedAt) {
			return Math.max(0, Math.round(nowPerfMs() - Number(startedAt || 0)));
		}
		function postPerformanceEvent(event, details = {}, options = {}) {
			const now = Date.now();
			const key = String(options.key || event || "");
			const minIntervalMs = Math.max(0, Number(options.minIntervalMs || 0));
			if (key && minIntervalMs > 0) {
				const last = Number(state.perfEventLastReportedAt[key] || 0);
				if (!options.force && last && now - last < minIntervalMs) return false;
				state.perfEventLastReportedAt[key] = now;
			}
			postClientEvent(event, Object.assign({
				pwa: isPwaMode(),
				embedded: isHermesEmbedMode(),
				visibility: document.visibilityState || "",
				clientBuildId: CLIENT_BUILD_ID
			}, details || {}));
			return true;
		}
		function diagnosticHash(value) {
			return homeAiDiagnosticReportingApi.hashIdentifier(String(value || ""), "h");
		}
		function diagnosticThreadHash(threadId = state.currentThreadId) {
			const id = String(threadId || "").trim();
			return id ? diagnosticHash(`thread:${id}`) : "";
		}
		function diagnosticTurnHash(turnId) {
			const id = String(turnId || "").trim();
			return id ? diagnosticHash(`turn:${id}`) : "";
		}
		function diagnosticTaskHash(taskId) {
			const id = String(taskId || "").trim();
			return id ? diagnosticHash(`task:${id}`) : "";
		}
		function diagnosticItemHash(itemId) {
			const id = String(itemId || "").trim();
			return id ? diagnosticHash(`item:${id}`) : "";
		}
		function clientSubmissionDiagnosticHash(clientSubmissionId) {
			const id = String(clientSubmissionId || "").trim();
			return id ? diagnosticHash(`submission:${id}`) : "";
		}
		function clientSubmissionDataAttr(item) {
			const hash = clientSubmissionDiagnosticHash(item && item.clientSubmissionId);
			return hash ? ` data-client-submission-hash="${escapeHtml(hash)}"` : "";
		}
		function diagnosticRouteKind() {
			if (state.newThreadDraft) return "new-thread";
			if (isHermesEmbedMode() && isHermesPluginPrimaryPage()) return "embedded-primary";
			if (state.threadTileMode) return "thread-tile";
			if (state.currentThreadId) return "thread-detail";
			return isHermesEmbedMode() ? "embedded-root" : "standalone-root";
		}
		function diagnosticErrorStatus(err) {
			let status = Number(err && (err.status || err.statusCode) || 0);
			if ((!Number.isFinite(status) || status <= 0) && err && /^\d+$/.test(String(err.code || ""))) status = Number(err.code);
			return Number.isFinite(status) && status > 0 ? status : 0;
		}
		function diagnosticErrorCode(err, fallback = "runtime_failed") {
			const explicit = String(err && err.code || "").trim();
			if (explicit && !/^\d+$/.test(explicit)) return homeAiDiagnosticReportingApi.boundedToken(explicit, fallback, 100);
			const status = diagnosticErrorStatus(err);
			if (status) return `http_${status}`;
			const message = String(err && err.message || err || "").toLowerCase();
			if (message.includes("request timed out")) return "request_timeout";
			if (message.includes("request cancelled")) return "request_cancelled";
			if (message.includes("failed to fetch")) return "network_fetch_failed";
			if (message.includes("not visible")) return "target_thread_not_visible";
			if (message.includes("terminal") && message.includes("return")) return "terminal_card_no_return_required";
			return fallback;
		}
		function diagnosticDurationBucket(ms) {
			return homeAiDiagnosticReportingApi.durationBucket(ms);
		}
		function currentHomeAiDiagnosticContext(extra = {}) {
			const context = Object.assign({
				surface: "runtime",
				action: "unknown",
				route_kind: diagnosticRouteKind(),
				build_id: CLIENT_BUILD_ID,
				shell_cache: CLIENT_BUILD_ID.split("|").pop() || "",
				thread_hash: diagnosticThreadHash(),
				embedded: isHermesEmbedMode(),
				pwa: isPwaMode(),
				client_visibility: document.visibilityState || ""
			}, extra || {});
			if (!context.thread_hash) delete context.thread_hash;
			return context;
		}
		function postHomeAiDiagnosticReport(report, meta = {}) {
			const targetOrigin = normalizePluginParentOrigin(state.pluginParentOrigin);
			if (targetOrigin) state.pluginParentOrigin = targetOrigin;
			const result = homeAiDiagnosticReportingApi.postReportToHomeAi({
				report,
				embedded: isHermesEmbedMode(),
				parentWindow: window.parent,
				selfWindow: window,
				targetOrigin: targetOrigin || "*"
			});
			postClientEvent("home_ai_diagnostic_report_post", {
				ok: Boolean(result.ok),
				reason: result.reason || "",
				category: report && report.category || "",
				diagnostic_type: report && report.diagnostic_type || "",
				error_code: report && report.error_code || "",
				signature: meta.signature || "",
				repeatedFailures: Number(meta.repeatedFailures || 0)
			});
			return result;
		}
		function recordHomeAiDiagnosticFailure(input = {}) {
			const result = state.homeAiDiagnosticReporter.recordFailure(Object.assign({}, input, { context: currentHomeAiDiagnosticContext(input.context || {}) }));
			postClientEvent("home_ai_diagnostic_failure_recorded", {
				category: input.category || "",
				diagnostic_type: input.diagnostic_type || input.diagnosticType || "",
				error_code: input.error_code || input.errorCode || "",
				eligible: Boolean(result.eligible),
				repeatedFailures: Number(result.repeatedFailures || 0),
				threshold: Number(result.threshold || 0),
				signature: result.signature || "",
				observeOnly: Boolean(result.observeOnly),
				reason: result.reason || ""
			});
			if (result.report) postHomeAiDiagnosticReport(result.report, result);
			return result;
		}
		function recordHomeAiDiagnosticSuccess(input = {}) {
			return state.homeAiDiagnosticReporter.recordSuccess(Object.assign({}, input, { context: currentHomeAiDiagnosticContext(input.context || {}) }));
		}
		function applyFrontendRuntimeHealthEffect(effect) {
			const item = effect && typeof effect === "object" ? effect : {};
			if (!item.type) return;
			if (item.type === "diagnostic-failure") {
				recordHomeAiDiagnosticFailure(item.diagnostic || {});
				return;
			}
			if (item.type === "diagnostic-success") {
				recordHomeAiDiagnosticSuccess(item.diagnostic || {});
				return;
			}
			throw new Error(`Unknown frontend runtime health effect: ${item.type}`);
		}
		function applyFrontendRuntimeHealthEffectsPlan(plan) {
			const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
			for (const effect of effects) applyFrontendRuntimeHealthEffect(effect);
		}
		function threadListRuntimeMetrics() {
			const list = $("threadList");
			if (!list || typeof list.getBoundingClientRect !== "function") return {
				present: false,
				visible: false,
				threadListCount: 0,
				scrollTop: 0,
				scrollHeight: 0
			};
			const rect = list.getBoundingClientRect();
			const viewportWidth = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
			const viewportHeight = Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
			return {
				present: true,
				visible: document.visibilityState !== "hidden" && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth,
				threadListCount: list.querySelectorAll("[data-thread]").length,
				scrollTop: Math.max(0, Math.round(Number(list.scrollTop || 0))),
				scrollHeight: Math.max(0, Math.round(Number(list.scrollHeight || 0)))
			};
		}
		function recordThreadListRuntimeStall(input = {}) {
			const now = Date.now();
			if (now - Number(state.threadListRuntimeLastReportAt || 0) < THREAD_LIST_RUNTIME_STALL_REPORT_INTERVAL_MS) return false;
			const metrics = threadListRuntimeMetrics();
			const routeKind = diagnosticRouteKind();
			const threadListMonitorable = metrics.visible || metrics.present && document.visibilityState !== "hidden" && (routeKind === "embedded-primary" || routeKind === "standalone-root");
			const plan = frontendRuntimeHealthApi.threadListInteractionStallEffects(Object.assign({
				threadListVisible: metrics.visible,
				threadListMonitorable,
				routeKind,
				minDelayMs: THREAD_LIST_RUNTIME_STALL_MIN_MS,
				h2ThresholdMs: THREAD_LIST_RUNTIME_STALL_H2_MS,
				threadListCount: metrics.threadListCount,
				scrollTop: metrics.scrollTop,
				scrollHeight: metrics.scrollHeight
			}, input || {}));
			if (!plan.effects || !plan.effects.length) return false;
			state.threadListRuntimeLastReportAt = now;
			applyFrontendRuntimeHealthEffectsPlan(plan);
			postPerformanceEvent("thread_list_runtime_stall", {
				action: input.action || "thread-list-runtime",
				routeKind,
				maxRafDelayMs: Math.max(0, Math.round(Number(input.maxRafDelayMs || 0))),
				maxScrollApplyMs: Math.max(0, Math.round(Number(input.maxScrollApplyMs || 0))),
				maxLongTaskMs: Math.max(0, Math.round(Number(input.maxLongTaskMs || 0))),
				longTaskCount: Math.max(0, Math.round(Number(input.longTaskCount || 0))),
				threadListCount: metrics.threadListCount,
				threadListVisible: Boolean(metrics.visible),
				threadListMonitorable: Boolean(threadListMonitorable)
			}, {
				key: "thread-list-runtime-stall",
				minIntervalMs: THREAD_LIST_RUNTIME_STALL_REPORT_INTERVAL_MS
			});
			return true;
		}
		function sampleThreadListInputDelay(action = "thread-list-input") {
			if (!threadListRuntimeMetrics().visible) return;
			const list = $("threadList");
			const startedAt = nowPerfMs();
			const startScrollTop = list ? Number(list.scrollTop || 0) : 0;
			requestAnimationFrame(() => {
				const rafDelayMs = roundedDurationMs(startedAt);
				requestAnimationFrame(() => {
					const elapsedMs = roundedDurationMs(startedAt);
					const scrollApplyMs = (list ? Number(list.scrollTop || 0) : startScrollTop) !== startScrollTop ? elapsedMs : rafDelayMs;
					recordThreadListRuntimeStall({
						action,
						maxRafDelayMs: rafDelayMs,
						maxScrollApplyMs: scrollApplyMs,
						elapsedMs
					});
				});
			});
		}
		function startThreadListRuntimeHeartbeat() {
			if (state.threadListRuntimeHeartbeatFrame) return;
			const tick = (timestamp) => {
				const previous = Number(state.threadListRuntimeLastFrameAt || 0);
				if (previous > 0) {
					const delayMs = Math.max(0, Math.round(Number(timestamp || 0) - previous));
					if (delayMs >= THREAD_LIST_RUNTIME_STALL_MIN_MS) recordThreadListRuntimeStall({
						action: "thread-list-heartbeat",
						maxRafDelayMs: delayMs,
						elapsedMs: delayMs
					});
				}
				state.threadListRuntimeLastFrameAt = Number(timestamp || nowPerfMs());
				state.threadListRuntimeHeartbeatFrame = requestAnimationFrame(tick);
			};
			state.threadListRuntimeHeartbeatFrame = requestAnimationFrame(tick);
		}
		function startThreadListRuntimeLongTaskObserver() {
			if (state.threadListRuntimeLongTaskObserver || typeof PerformanceObserver !== "function") return;
			try {
				const observer = new PerformanceObserver((list) => {
					let maxLongTaskMs = 0;
					let longTaskCount = 0;
					for (const entry of list.getEntries()) {
						const duration = Math.max(0, Math.round(Number(entry && entry.duration || 0)));
						if (duration < THREAD_LIST_RUNTIME_STALL_MIN_MS) continue;
						maxLongTaskMs = Math.max(maxLongTaskMs, duration);
						longTaskCount += 1;
					}
					if (maxLongTaskMs > 0) recordThreadListRuntimeStall({
						action: "thread-list-longtask",
						maxLongTaskMs,
						longTaskCount,
						elapsedMs: maxLongTaskMs
					});
				});
				observer.observe({
					type: "longtask",
					buffered: true
				});
				state.threadListRuntimeLongTaskObserver = observer;
			} catch (_) {
				state.threadListRuntimeLongTaskObserver = null;
			}
		}
		function startThreadListRuntimeStallMonitoring() {
			const list = $("threadList");
			if (list) [
				"pointerdown",
				"touchstart",
				"wheel",
				"scroll"
			].forEach((eventName) => {
				list.addEventListener(eventName, () => sampleThreadListInputDelay(`thread-list-${eventName}`), { passive: true });
			});
			document.addEventListener("visibilitychange", () => {
				if (document.visibilityState === "hidden") state.threadListRuntimeLastFrameAt = 0;
			});
			startThreadListRuntimeHeartbeat();
			startThreadListRuntimeLongTaskObserver();
		}
		function conversationHasClientSubmissionHash(submissionHash) {
			const hash = String(submissionHash || "").trim();
			const conversation = $("conversation");
			if (!hash || !conversation) return false;
			return Array.from(conversation.querySelectorAll("[data-client-submission-hash]")).some((node) => String(node && node.getAttribute && node.getAttribute("data-client-submission-hash") || "") === hash);
		}
		function frontendHealthThreadForSubmission(threadId) {
			const id = String(threadId || "").trim();
			if (!id) return null;
			if (state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
			return state.threadTileDetails && state.threadTileDetails.get(id) || null;
		}
		function probeSubmittedMessageDom(threadId, clientSubmissionId, action = "message-submit", startedAtMs = Date.now()) {
			const id = String(threadId || "").trim();
			const submissionId = String(clientSubmissionId || "").trim();
			const submissionHash = clientSubmissionDiagnosticHash(submissionId);
			if (!id || !submissionId || !submissionHash) return;
			const thread = frontendHealthThreadForSubmission(id);
			const domShape = conversationDomShape();
			const visibleShape = thread ? visibleConversationShape(thread) : { visibleItemCount: 0 };
			applyFrontendRuntimeHealthEffectsPlan(frontendRuntimeHealthApi.submittedMessageDomProbeEffects({
				elapsedMs: Date.now() - Number(startedAtMs || Date.now()),
				action,
				routeKind: diagnosticRouteKind(),
				threadHash: diagnosticThreadHash(id),
				itemHash: submissionHash,
				currentThreadMatch: !state.threadTileMode && String(state.currentThreadId || "") === id,
				hasThreadSubmission: threadHasClientSubmission(thread, submissionId),
				domHasSubmission: conversationHasClientSubmissionHash(submissionHash),
				visibleCount: visibleShape.visibleItemCount,
				domCount: domShape.itemCount,
				composerBusy: state.composerBusy
			}));
		}
		function scheduleSubmittedMessageDomProbe(threadId, clientSubmissionId, action = "message-submit") {
			const id = String(threadId || "").trim();
			const submissionId = String(clientSubmissionId || "").trim();
			if (!id || !submissionId) return;
			const startedAtMs = Date.now();
			[
				350,
				1200,
				2800
			].forEach((delayMs) => {
				setTimeout(() => probeSubmittedMessageDom(id, submissionId, action, startedAtMs), delayMs);
			});
		}
		function applyThreadDetailResponseDiagnosticEffect(effect) {
			const item = effect && typeof effect === "object" ? effect : {};
			if (!item.type) return;
			if (item.type === "diagnostic-failure") {
				recordHomeAiDiagnosticFailure(item.diagnostic || {});
				return;
			}
			if (item.type === "diagnostic-success") {
				recordHomeAiDiagnosticSuccess(item.diagnostic || {});
				return;
			}
			throw new Error(`Unknown thread detail response diagnostic effect: ${item.type}`);
		}
		function applyThreadDetailResponseDiagnosticEffectsPlan(plan) {
			const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
			for (const effect of effects) applyThreadDetailResponseDiagnosticEffect(effect);
		}
		function recordThreadDetailResponseDiagnostics(performanceEvent = {}, input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const threadHash = diagnosticThreadHash(String(source.threadId || state.currentThreadId || ""));
			const action = String(source.action || "thread-detail").slice(0, 80);
			const durationBucket = source.durationBucket || diagnosticDurationBucket(Number(performanceEvent && performanceEvent.elapsedMs || 0));
			const slowPlan = threadPerformanceMetrics.planThreadDetailSlowPathDiagnostic(performanceEvent, {
				action,
				threadHash,
				durationBucket
			});
			const contractPlan = threadPerformanceMetrics.planThreadDetailResponseContractDiagnostic(performanceEvent, {
				action,
				threadHash,
				durationBucket,
				thread: source.thread,
				expectedActiveFullRead: source.expectedActiveFullRead
			});
			applyThreadDetailResponseDiagnosticEffectsPlan(threadDiagnosticEventsApi.threadDetailResponseDiagnosticEffects({
				slowPlan,
				slowSuccessInput: {
					action,
					threadHash,
					readMode: performanceEvent && performanceEvent.readMode || "",
					renderMode: performanceEvent && performanceEvent.clientTimings && performanceEvent.clientTimings.detailRenderMode || ""
				},
				contractPlan
			}));
		}
		function conversationDomShape() {
			const conversation = $("conversation");
			if (!conversation) return {
				renderKeyCount: 0,
				duplicateRenderKeyCount: 0,
				duplicateUserMessageCount: 0,
				turnCount: 0,
				itemCount: 0
			};
			const seen = /* @__PURE__ */ new Set();
			let duplicateRenderKeyCount = 0;
			for (const node of Array.from(conversation.querySelectorAll("[data-render-key]"))) {
				const key = String(node && node.getAttribute && node.getAttribute("data-render-key") || "");
				if (!key) continue;
				if (seen.has(key)) duplicateRenderKeyCount += 1;
				else seen.add(key);
			}
			let duplicateUserMessageCount = 0;
			const userMessageNodes = [];
			for (const turnNode of Array.from(conversation.querySelectorAll("article.turn[data-turn], article.thread-tile-turn[data-thread-tile-turn]"))) for (const node of Array.from(turnNode.querySelectorAll(".item.userMessage"))) userMessageNodes.push({
				turnNode,
				node
			});
			duplicateUserMessageCount = duplicateUserMessageSignatureCount(userMessageNodes, (entry) => domUserMessageEventDuplicateSignature(entry.turnNode, entry.node));
			return {
				renderKeyCount: seen.size,
				duplicateRenderKeyCount,
				duplicateUserMessageCount,
				turnCount: conversation.querySelectorAll("article.turn[data-turn], article.thread-tile-turn[data-thread-tile-turn]").length,
				itemCount: conversation.querySelectorAll("[data-item]").length
			};
		}
		function duplicateUserMessageSignatureCount(entries, signatureForEntry) {
			const seen = /* @__PURE__ */ new Set();
			let duplicates = 0;
			for (const entry of Array.isArray(entries) ? entries : []) {
				const signature = String(signatureForEntry(entry) || "").trim();
				if (!signature) continue;
				if (seen.has(signature)) duplicates += 1;
				else seen.add(signature);
			}
			return duplicates;
		}
		function domUserMessageDuplicateSignature(turnNode, node) {
			if (!node || !node.getAttribute) return "";
			const turnId = String(turnNode && turnNode.getAttribute && (turnNode.getAttribute("data-turn") || turnNode.getAttribute("data-thread-tile-turn")) || "").trim();
			const submissionHash = String(node.getAttribute("data-client-submission-hash") || "").trim();
			if (submissionHash) return `submission:${turnId}:${submissionHash}`;
			const body = node.querySelector && node.querySelector(".item-body");
			const text = String((body || node).textContent || "").replace(/\s+/g, " ").trim();
			return text ? `text:${turnId}:${stableTextHash(text)}` : "";
		}
		function domUserMessageEventDuplicateSignature(turnNode, node) {
			if (!node || !node.getAttribute) return "";
			const submissionHash = String(node.getAttribute("data-client-submission-hash") || "").trim();
			if (submissionHash) return `submission:${submissionHash}`;
			const body = node.querySelector && node.querySelector(".item-body");
			const text = String((body || node).textContent || "").replace(/\s+/g, " ").trim();
			if (!text) return "";
			const timestamp = node.querySelector && node.querySelector(".item-timestamp");
			const datetime = String(timestamp && timestamp.getAttribute && timestamp.getAttribute("datetime") || "").trim();
			const timestampMs = datetime ? Date.parse(datetime) : 0;
			if (Number.isFinite(timestampMs) && timestampMs > 0) return `text-time:${Math.floor(timestampMs / 5e3)}:${stableTextHash(text)}`;
			return domUserMessageDuplicateSignature(turnNode, node);
		}
		function visibleUserMessageDuplicateSignature(turn, item) {
			if (!item || item.type !== "userMessage") return "";
			const turnId = String(turn && turn.id || turn && turn.mobileVisibleKey || "").trim();
			const submissionHash = clientSubmissionDiagnosticHash(item && item.clientSubmissionId);
			if (submissionHash) return `submission:${turnId}:${submissionHash}`;
			const comparable = userMessageComparableParts(item);
			const text = String(comparable.text || itemTextValue(item && item.text) || itemTextValue(item && item.message) || itemTextValue(item && item.content) || "").replace(/\s+/g, " ").trim();
			return text ? `text:${turnId}:${stableTextHash(text)}` : "";
		}
		function visibleUserMessageEventDuplicateSignature(turn, item) {
			if (!item || item.type !== "userMessage") return "";
			const submissionHash = clientSubmissionDiagnosticHash(item && item.clientSubmissionId);
			if (submissionHash) return `submission:${submissionHash}`;
			const comparable = userMessageComparableParts(item);
			const text = String(comparable.text || itemTextValue(item && item.text) || itemTextValue(item && item.message) || itemTextValue(item && item.content) || "").replace(/\s+/g, " ").trim();
			if (!text) return "";
			const timestampMs = userMessageTimestampMs(item) || turnStartedAtMs(turn);
			if (timestampMs) return `text-time:${Math.floor(timestampMs / 5e3)}:${stableTextHash(text)}`;
			return visibleUserMessageDuplicateSignature(turn, item);
		}
		function turnRendersConversationArticle(turn, thread) {
			if (!turn || !turn.id) return false;
			if (visibleItemsForTurn(turn, thread).length > 0) return true;
			if (typeof visibleItemBudgetSignature === "function" && visibleItemBudgetSignature(turn)) return true;
			const threadId = typeof renderContextThreadId === "function" ? renderContextThreadId(thread) : String(thread && thread.id || state.currentThreadId || "");
			if (typeof approvalsForTurn === "function" && approvalsForTurn(threadId, turn.id).length > 0) return true;
			if (typeof turnHasThreadTaskCardDraftResponse === "function" && turnHasThreadTaskCardDraftResponse(turn)) return true;
			return Boolean(typeof turnHasThreadTaskCardRequest === "function" && typeof isLatestTurn === "function" && typeof isLiveTurn === "function" && isLatestTurn(turn, thread) && isLiveTurn(turn, thread) && turnHasThreadTaskCardRequest(turn));
		}
		function visibleRenderableTurnsForConversation(thread) {
			return visibleTurnsForConversation(thread).filter((turn) => turnRendersConversationArticle(turn, thread));
		}
		function visibleConversationShape(thread) {
			const turns = visibleRenderableTurnsForConversation(thread);
			let visibleItemCount = 0;
			const userMessages = [];
			for (const turn of turns) {
				const visibleItems = visibleItemsForTurn(turn, thread);
				visibleItemCount += visibleItems.length;
				for (const entry of visibleItems) {
					const item = entry && entry.item;
					if (item && item.type === "userMessage") userMessages.push({
						turn,
						item
					});
				}
			}
			const duplicateUserMessageCount = duplicateUserMessageSignatureCount(userMessages, (entry) => visibleUserMessageEventDuplicateSignature(entry.turn, entry.item));
			return {
				visibleTurnCount: turns.length,
				visibleItemCount,
				duplicateUserMessageCount
			};
		}
		function rememberThreadDetailRenderEvidence(thread, source = "unknown") {
			if (!thread || thread.mobileLoading || thread.mobileLoadError) return null;
			const threadId = String(thread.id || state.currentThreadId || "").trim();
			if (!threadId) return null;
			const shape = visibleConversationShape(thread);
			if (!shape.visibleTurnCount && !shape.visibleItemCount) return null;
			const itemCount = (Array.isArray(thread.turns) ? thread.turns : []).reduce((total, turn) => total + (Array.isArray(turn && turn.items) ? turn.items.length : 0), 0);
			const evidence = threadDetailStateApi.buildThreadDetailRenderEvidence({
				atMs: Date.now(),
				threadId,
				threadHash: diagnosticThreadHash(threadId),
				readMode: thread.mobileReadMode || "",
				sourceKind: homeAiDiagnosticReportingApi.boundedToken(source, "unknown", 80),
				turnCount: shape.visibleTurnCount,
				visibleItemCount: shape.visibleItemCount,
				itemCount
			});
			if (!evidence) return null;
			state.lastThreadDetailRenderEvidence = evidence;
			return evidence;
		}
		function clearThreadDetailRenderEvidence(reason = "") {
			if (!state.lastThreadDetailRenderEvidence) return;
			state.lastThreadDetailRenderEvidence = null;
			postClientEvent("thread_detail_render_evidence_cleared", { reason: String(reason || "").slice(0, 80) });
		}
		function recentThreadDetailRenderEvidence() {
			return threadDetailStateApi.recentThreadDetailRenderEvidence({
				evidence: state.lastThreadDetailRenderEvidence,
				nowMs: Date.now(),
				maxAgeMs: PRIMARY_SHELL_CONFLICT_EVIDENCE_MS
			});
		}
		function primaryShellSelectionConflictInput(reason, details = {}) {
			const evidence = recentThreadDetailRenderEvidence() || {};
			const thread = state.currentThread || null;
			const shape = thread ? visibleConversationShape(thread) : null;
			return {
				reason,
				action: "primary-shell-selection",
				routeKind: "embedded-primary",
				sourceKind: details.source || evidence.sourceKind || "",
				threadHash: evidence.threadHash || diagnosticThreadHash(state.currentThreadId || thread && thread.id || ""),
				readMode: evidence.readMode || thread && thread.mobileReadMode || "",
				renderMode: details.renderMode || "",
				turns: evidence.turnCount || shape && shape.visibleTurnCount || 0,
				visibleItems: evidence.visibleItemCount || shape && shape.visibleItemCount || 0,
				items: evidence.itemCount || 0,
				domCount: details.domCount,
				previousCount: details.previousCount,
				recentDetailAgeMs: evidence.ageMs || 0,
				hasCurrentThread: Boolean(state.currentThread),
				hasCurrentThreadId: Boolean(state.currentThreadId),
				hasThreadLoadController: Boolean(state.threadLoadController),
				startupThreadOpenPending: Boolean(state.startupThreadOpenPending),
				mobileLoading: Boolean(state.currentThread && state.currentThread.mobileLoading)
			};
		}
		function recordPrimaryShellSelectionConflict(reason, details = {}) {
			return recordHomeAiDiagnosticFailure(threadDiagnosticEventsApi.primaryShellSelectionConflictDiagnosticEvent(primaryShellSelectionConflictInput(reason, details)));
		}
		function recordPrimaryShellSelectionHealthy(source, thread = state.currentThread) {
			const evidence = rememberThreadDetailRenderEvidence(thread, source);
			if (!evidence) return null;
			return recordHomeAiDiagnosticSuccess(threadDiagnosticEventsApi.primaryShellSelectionConflictDiagnosticSuccess({
				action: "primary-shell-selection",
				routeKind: "embedded-primary",
				sourceKind: source,
				threadHash: evidence.threadHash,
				readMode: evidence.readMode
			}));
		}
		function emptyVisibleDetailMismatchInput(reason, thread = state.currentThread, details = {}) {
			const threadId = String(thread && thread.id || state.currentThreadId || "").trim();
			const evidence = recentThreadDetailRenderEvidence();
			const sameThreadEvidence = threadDetailStateApi.sameThreadDetailRenderEvidence({
				evidence,
				threadId
			});
			const shape = thread ? visibleConversationShape(thread) : {
				visibleTurnCount: 0,
				visibleItemCount: 0
			};
			return {
				reason,
				action: details.action || "single-thread-empty-state",
				routeKind: details.routeKind || "single-thread",
				sourceKind: details.source || sameThreadEvidence && sameThreadEvidence.sourceKind || "",
				threadHash: details.threadHash || sameThreadEvidence && sameThreadEvidence.threadHash || diagnosticThreadHash(threadId),
				readMode: sameThreadEvidence && sameThreadEvidence.readMode || thread && thread.mobileReadMode || "",
				renderMode: details.renderMode || "",
				turns: Object.prototype.hasOwnProperty.call(details, "turns") ? details.turns : sameThreadEvidence && sameThreadEvidence.turnCount || 0,
				visibleItems: Object.prototype.hasOwnProperty.call(details, "visibleItems") ? details.visibleItems : sameThreadEvidence && sameThreadEvidence.visibleItemCount || 0,
				items: Object.prototype.hasOwnProperty.call(details, "items") ? details.items : sameThreadEvidence && sameThreadEvidence.itemCount || 0,
				currentTurns: Object.prototype.hasOwnProperty.call(details, "currentTurns") ? details.currentTurns : shape.visibleTurnCount,
				currentVisibleItems: Object.prototype.hasOwnProperty.call(details, "currentVisibleItems") ? details.currentVisibleItems : shape.visibleItemCount,
				domCount: details.domCount,
				previousCount: details.previousCount,
				detailLoaded: Boolean(thread && thread.mobileDetailLoaded),
				mobileLoading: Boolean(thread && thread.mobileLoading),
				recentDetailAgeMs: sameThreadEvidence && sameThreadEvidence.ageMs || 0
			};
		}
		function recordEmptyVisibleDetailMismatch(reason, thread = state.currentThread, details = {}) {
			return recordHomeAiDiagnosticFailure(threadDiagnosticEventsApi.emptyVisibleDetailMismatchDiagnosticEvent(emptyVisibleDetailMismatchInput(reason, thread, details)));
		}
		function recordEmptyVisibleDetailHealthy(source, thread = state.currentThread) {
			if (!thread || thread.mobileLoading || thread.mobileLoadError) return null;
			const threadId = String(thread.id || state.currentThreadId || "").trim();
			if (!threadId) return null;
			const shape = visibleConversationShape(thread);
			if (!shape.visibleTurnCount && !shape.visibleItemCount) return null;
			return recordHomeAiDiagnosticSuccess(threadDiagnosticEventsApi.emptyVisibleDetailMismatchDiagnosticSuccess({
				action: "single-thread-empty-state",
				routeKind: "single-thread",
				sourceKind: source,
				threadHash: diagnosticThreadHash(threadId),
				readMode: thread.mobileReadMode || ""
			}));
		}
		function maybeRecoverEmptyDetailWithHistoryEvidence(thread, details = {}) {
			const now = Date.now();
			const basePlan = threadDetailStateApi.planEmptyDetailHistoryRecovery({
				thread,
				currentThreadId: state.currentThreadId,
				details,
				nowMs: now,
				cooldownMs: 0
			});
			if (!basePlan.shouldRecover || !basePlan.recoveryKey) return false;
			const plan = threadDetailStateApi.planEmptyDetailHistoryRecovery({
				thread,
				currentThreadId: state.currentThreadId,
				details,
				nowMs: now,
				lastRecoveredAtMs: state.emptyDetailHistoryRecoveryAtByKey.get(basePlan.recoveryKey),
				cooldownMs: EMPTY_DETAIL_HISTORY_RECOVERY_COOLDOWN_MS
			});
			if (!plan.shouldRecover || !plan.recoveryKey) return false;
			state.emptyDetailHistoryRecoveryAtByKey.set(plan.recoveryKey, plan.nowMs || now);
			recordEmptyVisibleDetailMismatch(plan.diagnosticReason || "empty_render_with_history_evidence", thread, details);
			if (!hasThreadDetailRequestInFlight()) scheduleCurrentThreadRefresh(0, "empty-detail-history-evidence");
			postClientEvent("empty_detail_history_recovery", plan.event || {});
			return true;
		}
		function emptyCachedDetailReuseInput(reason, thread = state.currentThread, details = {}) {
			const threadId = String(thread && thread.id || state.currentThreadId || "").trim();
			const shape = thread ? visibleConversationShape(thread) : {
				visibleTurnCount: 0,
				visibleItemCount: 0
			};
			const itemCount = (Array.isArray(thread && thread.turns) ? thread.turns : []).reduce((total, turn) => total + (Array.isArray(turn && turn.items) ? turn.items.length : 0), 0);
			return {
				reason,
				action: "thread-open-cache-reuse",
				routeKind: "single-thread",
				sourceKind: details.source || "",
				threadHash: diagnosticThreadHash(threadId),
				readMode: thread && thread.mobileReadMode || "",
				currentTurns: shape.visibleTurnCount,
				currentVisibleItems: shape.visibleItemCount,
				items: itemCount,
				detailLoaded: Boolean(thread && thread.mobileDetailLoaded),
				reusableDetail: Boolean(details.reusableDetail),
				mobileLoading: Boolean(thread && thread.mobileLoading),
				threadTaskCardCount: Array.isArray(thread && thread.threadTaskCards) ? thread.threadTaskCards.length : 0
			};
		}
		function recordEmptyCachedDetailReuseBlocked(reason, thread = state.currentThread, details = {}) {
			return recordHomeAiDiagnosticFailure(threadDiagnosticEventsApi.emptyCachedDetailReuseBlockedDiagnosticEvent(emptyCachedDetailReuseInput(reason, thread, details)));
		}
		function recordEmptyCachedDetailReuseHealthy(source, thread = state.currentThread) {
			const threadId = String(thread && thread.id || state.currentThreadId || "").trim();
			if (!threadId) return null;
			return recordHomeAiDiagnosticSuccess(threadDiagnosticEventsApi.emptyCachedDetailReuseDiagnosticSuccess({
				action: "thread-open-cache-reuse",
				routeKind: "single-thread",
				sourceKind: source,
				threadHash: diagnosticThreadHash(threadId),
				readMode: thread && thread.mobileReadMode || ""
			}));
		}
		function checkEmptyVisibleDetailMismatchAfterRender(thread, shellPlan = {}, metrics = {}) {
			if (!thread || thread.mobileLoading || thread.mobileLoadError) return;
			if (shellPlan.hasPrimaryContent || shellPlan.emptyMessage !== "No visible turns.") return;
			const threadId = String(thread.id || state.currentThreadId || "").trim();
			const evidence = recentThreadDetailRenderEvidence();
			const details = {
				source: metrics.source || "single-thread-render",
				renderMode: metrics.renderMode || "full-render",
				domCount: metrics.domCount,
				previousCount: metrics.previousCount
			};
			if (threadDetailStateApi.hasNonemptyThreadDetailRenderEvidence(threadDetailStateApi.sameThreadDetailRenderEvidence({
				evidence,
				threadId
			}))) {
				recordEmptyVisibleDetailMismatch("empty_render_after_nonempty_detail", thread, details);
				return;
			}
			maybeRecoverEmptyDetailWithHistoryEvidence(thread, details);
		}
		function visibleRenderableTurnIds(thread) {
			return visibleRenderableTurnsForConversation(thread).map((turn) => String(turn.id));
		}
		function conversationDomTurnIds(conversation = $("conversation")) {
			if (!conversation) return [];
			return Array.from(conversation.querySelectorAll("article.turn[data-turn]")).map((node) => String(node && node.getAttribute && node.getAttribute("data-turn") || "")).filter(Boolean);
		}
		function threadTileVisibleShape(ids = state.threadTileActiveIds) {
			return (Array.isArray(ids) ? ids : []).reduce((shape, id) => {
				const thread = threadTileDisplayThread(id);
				visibleTurnsForConversation(thread).forEach((turn) => {
					const visibleItems = visibleItemsForTurn(turn, thread);
					const itemCount = visibleItems.length;
					if (itemCount > 0) {
						shape.turnCount += 1;
						shape.visibleItemCount += itemCount;
						const userMessages = visibleItems.map((entry) => entry && entry.item).filter((item) => item && item.type === "userMessage");
						shape.duplicateUserMessageCount += duplicateUserMessageSignatureCount(userMessages, (item) => visibleUserMessageDuplicateSignature(turn, item));
					}
				});
				return shape;
			}, {
				turnCount: 0,
				visibleItemCount: 0,
				duplicateUserMessageCount: 0
			});
		}
		function threadTileVisibleTurnCount(ids = state.threadTileActiveIds) {
			return threadTileVisibleShape(ids).turnCount;
		}
		function threadTileDomTurnCount(conversation = $("conversation")) {
			if (!conversation) return 0;
			return conversation.querySelectorAll("article.thread-tile-turn[data-thread-tile-turn]").length;
		}
		function conversationTurnOrderDiagnosticSnapshot(source, extra = {}, deps = {}) {
			const conversation = deps.conversation || $("conversation");
			const thread = deps.thread || state.currentThread;
			if (!conversation || !thread) return null;
			const tileMode = Object.prototype.hasOwnProperty.call(deps, "threadTileMode") ? deps.threadTileMode === true : state.threadTileMode === true;
			const tileDomActive = Object.prototype.hasOwnProperty.call(deps, "tileDomActive") ? deps.tileDomActive === true : Boolean(conversation.classList && conversation.classList.contains("thread-tile-mode"));
			if (tileMode || tileDomActive) return null;
			const expectedIds = Array.isArray(deps.expectedTurnIds) ? deps.expectedTurnIds.map(String).filter(Boolean) : visibleRenderableTurnIds(thread);
			const domIds = Array.isArray(deps.domTurnIds) ? deps.domTurnIds.map(String).filter(Boolean) : conversationDomTurnIds(conversation);
			const expectedLatestId = expectedIds[expectedIds.length - 1] || "";
			return threadDiagnosticEventsApi.turnOrderDiagnosticSnapshot({
				source,
				readMode: thread.mobileReadMode || "",
				renderMode: extra.renderMode || "",
				threadHash: diagnosticThreadHash(thread.id || state.currentThreadId),
				turnHash: diagnosticTurnHash(expectedLatestId),
				expectedTurnIds: expectedIds,
				domTurnIds: domIds
			});
		}
		function conversationProjectionDiagnosticSnapshot(source, extra = {}, deps = {}) {
			const conversation = deps.conversation || $("conversation");
			if (!conversation) return null;
			const renderedSignature = Object.prototype.hasOwnProperty.call(deps, "renderedConversationSignature") ? String(deps.renderedConversationSignature || "") : String(state.renderedConversationSignature || "");
			const domShape = deps.domShape || conversationDomShape();
			const tileMode = Object.prototype.hasOwnProperty.call(deps, "threadTileMode") ? deps.threadTileMode === true : state.threadTileMode === true;
			const tileDomActive = Object.prototype.hasOwnProperty.call(deps, "tileDomActive") ? deps.tileDomActive === true : Boolean(conversation.classList && conversation.classList.contains("thread-tile-mode"));
			return threadDiagnosticEventsApi.conversationProjectionDiagnosticSnapshot({
				source,
				renderMode: extra.renderMode,
				renderedSignature,
				domShape,
				threadTileMode: tileMode,
				tileDomActive,
				tileLayout: deps.tileLayout,
				tileIds: deps.tileIds,
				tileDisplayLayout: deps.tileDisplayLayout,
				tileSignature: deps.tileSignature,
				currentSignature: deps.currentSignature,
				thread: deps.thread || state.currentThread
			}, {
				singleSignature: conversationRenderSignature,
				tileLayout: threadTileLayout,
				tileCandidateIds: threadTileCandidateIds,
				tileDisplayLayout: threadTileDisplayLayout,
				tileRenderSignature: threadTileRenderSignature,
				tileThreadForId: typeof deps.tileThreadForId === "function" ? deps.tileThreadForId : threadTileDisplayThread,
				visibleShape: visibleConversationShape
			});
		}
		function applyConversationProjectionConsistencyEffect(effect) {
			const item = effect && typeof effect === "object" ? effect : {};
			if (!item.type) return;
			if (item.type === "diagnostic-failure") {
				recordHomeAiDiagnosticFailure(item.diagnostic || {});
				return;
			}
			if (item.type === "diagnostic-success") {
				recordHomeAiDiagnosticSuccess(item.diagnostic || {});
				return;
			}
			throw new Error(`Unknown conversation projection consistency effect: ${item.type}`);
		}
		function applyConversationProjectionConsistencyEffectsPlan(plan) {
			const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
			for (const effect of effects) applyConversationProjectionConsistencyEffect(effect);
		}
		function checkConversationProjectionConsistency(source, extra = {}) {
			if (!state.currentThread || state.currentThread.mobileLoading || state.currentThread.mobileLoadError) return;
			recordPrimaryShellSelectionHealthy(source, state.currentThread);
			recordEmptyVisibleDetailHealthy(source, state.currentThread);
			const snapshot = conversationProjectionDiagnosticSnapshot(source, extra);
			if (!snapshot) return;
			const orderSnapshot = conversationTurnOrderDiagnosticSnapshot(source, extra);
			applyConversationProjectionConsistencyEffectsPlan(threadDiagnosticEventsApi.conversationProjectionConsistencyEffects({
				snapshot,
				orderSnapshot
			}));
		}
		function startUiWatchdog() {
			if (state.uiWatchdogTimer) return;
			state.lastUiWatchdogTickAt = Date.now();
			state.uiWatchdogTimer = setInterval(() => {
				const now = Date.now();
				const lagMs = now - state.lastUiWatchdogTickAt - 1e3;
				state.lastUiWatchdogTickAt = now;
				if (document.visibilityState === "hidden" || lagMs < 2500) return;
				if (now - state.lastUiStallReportedAt < 15e3) return;
				state.lastUiStallReportedAt = now;
				postClientEvent("ui_stall", {
					lagMs: Math.round(lagMs),
					composerBusy: state.composerBusy,
					activeTurnId: state.activeTurnId || "",
					hasContent: composerHasContent()
				});
			}, 1e3);
		}
		function updatePushButton() {
			const button = $("pushNotifications");
			if (!button) return;
			button.classList.remove("hidden", "ready", "error");
			const hideButton = () => {
				button.textContent = "";
				button.disabled = true;
				button.classList.add("hidden");
			};
			if (state.pushBusy) {
				button.textContent = "Working...";
				button.disabled = true;
				return;
			}
			if (!state.pushServerSupported) {
				hideButton();
				return;
			}
			if (!window.isSecureContext) {
				hideButton();
				return;
			}
			if (!pushBrowserAvailable()) {
				hideButton();
				return;
			}
			if (Notification.permission === "denied") {
				button.textContent = "Notifications blocked";
				button.disabled = true;
				button.classList.add("error");
				return;
			}
			if (state.pushSubscribed) {
				button.textContent = "Send test notification";
				button.disabled = false;
				button.classList.add("ready");
				return;
			}
			button.textContent = "Enable notifications";
			button.disabled = false;
			if (state.pushError) button.classList.add("error");
		}
		async function registerPushServiceWorker() {
			if (state.serviceWorkerRegistration) return state.serviceWorkerRegistration;
			state.serviceWorkerRegistration = await navigator.serviceWorker.register("/sw.js");
			if (state.serviceWorkerRegistration && state.serviceWorkerRegistration.update) state.serviceWorkerRegistration.update().catch(() => {});
			return state.serviceWorkerRegistration;
		}
		async function syncExistingPushSubscription() {
			if (!state.key || !pushBrowserAvailable()) return;
			const subscription = await (await registerPushServiceWorker()).pushManager.getSubscription();
			state.pushSubscribed = Boolean(subscription);
			if (subscription) await api("/api/push/subscribe", {
				method: "POST",
				body: JSON.stringify({ subscription: pushSubscriptionToJson(subscription) })
			});
		}
		async function initializePushControls() {
			state.pushError = "";
			updatePushButton();
			if (!pushBrowserAvailable() || !state.key) return;
			try {
				await syncExistingPushSubscription();
			} catch (err) {
				state.pushError = err.message || String(err);
			} finally {
				updatePushButton();
			}
		}
		async function enablePushNotifications() {
			if (!pushBrowserAvailable()) return;
			const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
			if (permission !== "granted") {
				state.pushSubscribed = false;
				state.pushError = permission === "denied" ? "Notifications blocked" : "Notification permission not granted";
				updatePushButton();
				return;
			}
			const registration = await registerPushServiceWorker();
			let subscription = await registration.pushManager.getSubscription();
			if (!subscription) {
				const key = await api("/api/push/vapid-public-key");
				subscription = await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: base64UrlToUint8Array(key.publicKey)
				});
			}
			await api("/api/push/subscribe", {
				method: "POST",
				body: JSON.stringify({ subscription: pushSubscriptionToJson(subscription) })
			});
			state.pushSubscribed = true;
			state.pushError = "";
			$("connectionState").classList.remove("error");
			$("connectionState").textContent = "Notifications enabled";
		}
		async function sendTestPushNotification() {
			const result = await api("/api/push/test", {
				method: "POST",
				body: "{}"
			});
			$("connectionState").classList.remove("error");
			if (result.sent) {
				$("connectionState").textContent = "Test notification sent";
				return;
			}
			if (result.failed) {
				const detail = result.lastError && (result.lastError.reason || result.lastError.statusCode) ? `${result.lastError.statusCode || ""} ${result.lastError.reason || ""}`.trim() : "delivery failed";
				throw new Error(`Test notification failed: ${detail}`);
			}
			$("connectionState").textContent = "No push subscription";
		}
		async function handlePushButtonClick() {
			if (state.pushBusy) return;
			state.pushBusy = true;
			updatePushButton();
			try {
				if (state.pushSubscribed) await sendTestPushNotification();
				else await enablePushNotifications();
			} catch (err) {
				state.pushError = err.message || String(err);
				showError(err);
			} finally {
				state.pushBusy = false;
				updatePushButton();
			}
		}
		const legacyGlobals = {
			api,
			postClientEvent,
			nowPerfMs,
			roundedDurationMs,
			postPerformanceEvent,
			diagnosticHash,
			diagnosticThreadHash,
			diagnosticTurnHash,
			diagnosticTaskHash,
			diagnosticItemHash,
			clientSubmissionDiagnosticHash,
			clientSubmissionDataAttr,
			diagnosticRouteKind,
			diagnosticErrorStatus,
			diagnosticErrorCode,
			diagnosticDurationBucket,
			currentHomeAiDiagnosticContext,
			postHomeAiDiagnosticReport,
			recordHomeAiDiagnosticFailure,
			recordHomeAiDiagnosticSuccess,
			applyFrontendRuntimeHealthEffect,
			applyFrontendRuntimeHealthEffectsPlan,
			threadListRuntimeMetrics,
			recordThreadListRuntimeStall,
			sampleThreadListInputDelay,
			startThreadListRuntimeHeartbeat,
			startThreadListRuntimeLongTaskObserver,
			startThreadListRuntimeStallMonitoring,
			conversationHasClientSubmissionHash,
			frontendHealthThreadForSubmission,
			probeSubmittedMessageDom,
			scheduleSubmittedMessageDomProbe,
			applyThreadDetailResponseDiagnosticEffect,
			applyThreadDetailResponseDiagnosticEffectsPlan,
			recordThreadDetailResponseDiagnostics,
			conversationDomShape,
			duplicateUserMessageSignatureCount,
			domUserMessageDuplicateSignature,
			domUserMessageEventDuplicateSignature,
			visibleUserMessageDuplicateSignature,
			visibleUserMessageEventDuplicateSignature,
			turnRendersConversationArticle,
			visibleRenderableTurnsForConversation,
			visibleConversationShape,
			rememberThreadDetailRenderEvidence,
			clearThreadDetailRenderEvidence,
			recentThreadDetailRenderEvidence,
			primaryShellSelectionConflictInput,
			recordPrimaryShellSelectionConflict,
			recordPrimaryShellSelectionHealthy,
			emptyVisibleDetailMismatchInput,
			recordEmptyVisibleDetailMismatch,
			recordEmptyVisibleDetailHealthy,
			maybeRecoverEmptyDetailWithHistoryEvidence,
			emptyCachedDetailReuseInput,
			recordEmptyCachedDetailReuseBlocked,
			recordEmptyCachedDetailReuseHealthy,
			checkEmptyVisibleDetailMismatchAfterRender,
			visibleRenderableTurnIds,
			conversationDomTurnIds,
			threadTileVisibleShape,
			threadTileVisibleTurnCount,
			threadTileDomTurnCount,
			conversationTurnOrderDiagnosticSnapshot,
			conversationProjectionDiagnosticSnapshot,
			applyConversationProjectionConsistencyEffect,
			applyConversationProjectionConsistencyEffectsPlan,
			checkConversationProjectionConsistency,
			startUiWatchdog,
			updatePushButton,
			registerPushServiceWorker,
			syncExistingPushSubscription,
			initializePushControls,
			enablePushNotifications,
			sendTestPushNotification,
			handlePushButtonClick
		};
		function createApiClientRuntime() {
			return Object.assign({}, legacyGlobals);
		}
		const apiClientRuntimeApi = { createApiClientRuntime };
		if (typeof module === "object" && module.exports) module.exports = apiClientRuntimeApi;
		for (const [name, value] of Object.entries(legacyGlobals)) if (typeof value === "function") root[name] = value;
		root.CodexApiClientRuntime = apiClientRuntimeApi;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
//#region public/thread-list-load-policy.js
var require_thread_list_load_policy = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadListLoadPolicy = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function bool(value) {
			return value === true;
		}
		function text(value) {
			return String(value || "").trim();
		}
		function planThreadListLoadRequest(input = {}) {
			const silent = bool(input.silent);
			const selectedCwd = text(input.selectedCwd);
			const search = text(input.search);
			const threadDetailOpening = bool(input.threadDetailOpening);
			const documentHidden = bool(input.documentHidden);
			const allowDuringDetail = bool(input.allowDuringDetail);
			const allowHidden = bool(input.allowHidden);
			const hasLoadedList = Number(input.threadListLoadedAtMs || 0) > 0;
			const deferFallback = input.deferFallback;
			const suppressHiddenSilent = silent && documentHidden && !allowHidden;
			const suppressDetailSilent = silent && threadDetailOpening && !allowDuringDetail;
			const allowWarmFallbackInitial = deferFallback !== false && !selectedCwd && !search;
			const shouldDeferFallback = deferFallback === true || silent && deferFallback !== false && threadDetailOpening && !selectedCwd && !search;
			const shouldUseWarmFallbackInitial = allowWarmFallbackInitial && (shouldDeferFallback || !hasLoadedList);
			return {
				action: "thread-list-load-request",
				selectedCwd,
				search,
				silent,
				threadDetailOpening,
				documentHidden,
				shouldLoad: !suppressHiddenSilent && !suppressDetailSilent,
				skipReason: suppressHiddenSilent ? "hidden-silent" : suppressDetailSilent ? "detail-in-flight" : "",
				retryDelayMs: suppressDetailSilent ? 700 : 0,
				shouldDeferFallback,
				shouldUseWarmFallbackInitial,
				params: {
					fallback: shouldDeferFallback ? "defer" : "",
					initial: shouldUseWarmFallbackInitial ? "warm-fallback" : ""
				}
			};
		}
		return { planThreadListLoadRequest };
	});
}));
//#endregion
//#region public/thread-list-stable-order.js
var require_thread_list_stable_order = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadListStableOrder = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_HOLD_MS = 45e3;
		function text(value) {
			return String(value || "").trim();
		}
		function boundedHoldMs(value) {
			const number = Math.trunc(Number(value) || 0);
			if (number <= 0) return DEFAULT_HOLD_MS;
			return Math.min(3e5, Math.max(5e3, number));
		}
		function threadId(thread) {
			return text(thread && thread.id);
		}
		function threadListOrderScopeKey(input = {}) {
			const cwd = text(input.selectedCwd);
			const search = text(input.search).toLowerCase();
			return JSON.stringify({
				cwd,
				search
			});
		}
		function orderedThreadsById(threads, ids) {
			const byId = /* @__PURE__ */ new Map();
			for (const thread of threads || []) {
				const id = threadId(thread);
				if (id && !byId.has(id)) byId.set(id, thread);
			}
			return (ids || []).map((id) => byId.get(id)).filter(Boolean);
		}
		function mergeHeldOrder(previousOrder, incomingIds) {
			const incomingSet = new Set(incomingIds);
			const rank = new Map(incomingIds.map((id, index) => [id, index]));
			const ordered = (previousOrder || []).filter((id) => incomingSet.has(id));
			const orderedSet = new Set(ordered);
			const additions = incomingIds.filter((id) => !orderedSet.has(id));
			for (const id of additions) {
				const idRank = rank.get(id);
				let insertAt = ordered.length;
				for (let index = 0; index < ordered.length; index += 1) if ((rank.get(ordered[index]) ?? Number.MAX_SAFE_INTEGER) > idRank) {
					insertAt = index;
					break;
				}
				ordered.splice(insertAt, 0, id);
				orderedSet.add(id);
			}
			return ordered;
		}
		function planThreadListStableOrder(input = {}) {
			const threads = Array.isArray(input.threads) ? input.threads : [];
			const incomingIds = threads.map(threadId).filter(Boolean);
			const previous = input.previousState && typeof input.previousState === "object" ? input.previousState : {};
			const previousOrder = Array.isArray(previous.order) ? previous.order.map(text).filter(Boolean) : [];
			const scopeKey = text(input.scopeKey) || threadListOrderScopeKey(input);
			const nowMs = Math.max(0, Math.trunc(Number(input.nowMs) || Date.now()));
			const holdMs = boundedHoldMs(input.holdMs);
			const previousHoldUntilMs = Math.max(0, Math.trunc(Number(previous.holdUntilMs) || 0));
			const sameScope = text(previous.scopeKey) === scopeKey;
			const canHold = !input.forceServerOrder && sameScope && previousOrder.length > 0 && previousHoldUntilMs > nowMs;
			const order = canHold ? mergeHeldOrder(previousOrder, incomingIds) : incomingIds;
			const holdUntilMs = canHold ? previousHoldUntilMs : nowMs + holdMs;
			return {
				action: "thread-list-stable-order",
				held: canHold,
				scopeKey,
				holdUntilMs,
				order,
				threads: orderedThreadsById(threads, order),
				state: {
					scopeKey,
					holdUntilMs,
					order
				}
			};
		}
		return {
			DEFAULT_HOLD_MS,
			threadListOrderScopeKey,
			planThreadListStableOrder
		};
	});
}));
//#endregion
//#region public/thread-status-hints.js
var require_thread_status_hints = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadStatusHints = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_RUNNING_HINT_STALE_MS = 1200 * 1e3;
		const DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS = 60 * 1e3;
		const DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS = 1e3;
		function timestampMs(value) {
			if (value === null || value === void 0 || value === "") return 0;
			if (typeof value === "number") {
				if (!Number.isFinite(value) || value <= 0) return 0;
				return value > 0xe8d4a51000 ? Math.trunc(value) : Math.trunc(value * 1e3);
			}
			if (/^\d+(?:\.\d+)?$/.test(String(value))) {
				const numeric = Number(value);
				if (Number.isFinite(numeric) && numeric > 0) return numeric > 0xe8d4a51000 ? Math.trunc(numeric) : Math.trunc(numeric * 1e3);
			}
			const parsed = Date.parse(String(value));
			return Number.isFinite(parsed) ? parsed : 0;
		}
		function statusText(status) {
			if (!status) return "";
			if (typeof status === "string") return status;
			if (status && typeof status === "object" && status.type) return String(status.type);
			try {
				return JSON.stringify(status);
			} catch (_) {
				return String(status);
			}
		}
		function isStaleActiveStatus(status, thread) {
			return Boolean(status && typeof status === "object" && (status.mobileStaleActiveTurn || status.staleActiveTurn || status.reason === "context-only-active-turn") || thread && thread.mobileStaleActiveTurn);
		}
		function isRunningStatus(status) {
			return /active|running|queued|processing|inprogress|in_progress|in-progress|pending|started/.test(statusText(status).toLowerCase());
		}
		function isSettledStatus(status) {
			return /^(idle|notloaded|not_loaded|not-loaded|completed|complete|done|failed|failure|cancelled|canceled|cancel|error|interrupted|stopped|stop)$/.test(statusText(status).toLowerCase());
		}
		function isIdleStatus(status) {
			return /^(idle|notloaded|not_loaded|not-loaded)$/.test(statusText(status).toLowerCase());
		}
		function isTerminalStatus(status) {
			return /^(completed|complete|done|failed|failure|cancelled|canceled|cancel|error|interrupted|stopped|stop)$/.test(statusText(status).toLowerCase());
		}
		function threadUpdatedAtMs(thread) {
			return timestampMs(thread && (thread.updatedAtMs || thread.updatedAt || thread.updated_at_ms || thread.updated_at));
		}
		function terminalTurnAtMs(turn) {
			return timestampMs(turn && turn.completedAtMs) || timestampMs(turn && turn.completedAt) || timestampMs(turn && turn.completed_at_ms) || timestampMs(turn && turn.completed_at) || timestampMs(turn && turn.finishedAt) || timestampMs(turn && turn.finished_at) || timestampMs(turn && turn.updatedAtMs) || timestampMs(turn && turn.updatedAt) || timestampMs(turn && turn.updated_at_ms) || timestampMs(turn && turn.updated_at) || timestampMs(turn && turn.startedAtMs) || timestampMs(turn && turn.startedAt) || timestampMs(turn && turn.started_at_ms) || timestampMs(turn && turn.started_at) || timestampMs(turn && turn.createdAtMs) || timestampMs(turn && turn.createdAt) || timestampMs(turn && turn.created_at_ms) || timestampMs(turn && turn.created_at);
		}
		function notificationDurableEventAtMs(params = {}) {
			return timestampMs(params.eventAtMs) || timestampMs(params.eventAt) || terminalTurnAtMs(params.turn) || timestampMs(params.receivedAtMs) || timestampMs(params.timestampMs) || timestampMs(params.timestamp);
		}
		function notificationEventAtMs(params = {}, fallbackMs = 0, options = {}) {
			const durableAt = notificationDurableEventAtMs(params);
			if (durableAt) return durableAt;
			if (options.allowReplayReceivedAt !== false) {
				const replayAt = timestampMs(params.mobileReplayReceivedAtMs);
				if (replayAt) return replayAt;
			}
			return timestampMs(params.receivedAtMs) || timestampMs(params.timestampMs) || timestampMs(params.timestamp) || timestampMs(fallbackMs);
		}
		function latestTerminalTurn(thread) {
			const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
			const latest = turns.length ? turns[turns.length - 1] : null;
			if (!latest) return null;
			return isTerminalStatus(latest.status) ? latest : null;
		}
		function latestTerminalTurnAtMs(thread) {
			const turn = latestTerminalTurn(thread);
			return turn ? terminalTurnAtMs(turn) : 0;
		}
		function hasFreshSubmittedProcessingHint(submittedProcessingHintedAtMs, nowMs, staleMs = DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS) {
			const hintedAt = timestampMs(submittedProcessingHintedAtMs);
			const now = timestampMs(nowMs) || Date.now();
			return Boolean(hintedAt > 0 && now - hintedAt <= Math.max(0, Number(staleMs) || DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS));
		}
		function statusFreshnessAtMs(thread, eventAtMs) {
			return Math.max(threadUpdatedAtMs(thread) || 0, timestampMs(eventAtMs) || 0);
		}
		function settledStatusFreshEnoughForRunningHint(input = {}) {
			const hintedAt = timestampMs(input.runningHintedAtMs);
			if (!hintedAt) return true;
			const statusAt = statusFreshnessAtMs(input.thread, input.eventAtMs);
			if (!statusAt) return false;
			if (input.mobileReplay) return statusAt >= hintedAt;
			return statusAt + Math.max(0, Number(input.freshnessToleranceMs) || DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS) >= hintedAt;
		}
		function shouldKeepRunningHintForSettledStatus(input = {}) {
			const threadId = String(input.threadId || "");
			if (!threadId || !input.isRunningHinted) return false;
			const status = input.status || input.thread && input.thread.status;
			if (isStaleActiveStatus(status, input.thread)) return false;
			if (!isSettledStatus(status)) return false;
			if (isIdleStatus(status) && !latestTerminalTurn(input.thread) && !input.eventIsTerminal) return true;
			if (input.allowLocalProcessing !== false && isIdleStatus(status) && !latestTerminalTurn(input.thread) && hasFreshSubmittedProcessingHint(input.submittedProcessingHintedAtMs, input.nowMs, input.submittedProcessingHintStaleMs)) return true;
			if (input.currentThreadId && threadId === String(input.currentThreadId) && input.currentThreadSettled) return false;
			if (input.currentThreadHasLiveTurn) return true;
			if (!input.mobileReplay && (isTerminalStatus(status) || latestTerminalTurn(input.thread) || input.eventIsTerminal)) return false;
			return !settledStatusFreshEnoughForRunningHint(input);
		}
		function threadUnreadTerminalAtMs(thread, eventAtMs = 0, options = {}) {
			const eventAt = options.eventIsTerminal ? timestampMs(eventAtMs) : 0;
			return Math.max(latestTerminalTurnAtMs(thread) || 0, eventAt || 0);
		}
		function shouldMarkThreadUnread(input = {}) {
			const threadId = String(input.threadId || "");
			if (!threadId || threadId === String(input.currentThreadId || "")) return false;
			const status = input.status || input.thread && input.thread.status;
			if (isStaleActiveStatus(status, input.thread)) return false;
			if (!isSettledStatus(status)) return false;
			if (isIdleStatus(status) && !latestTerminalTurn(input.thread) && !input.eventIsTerminal) return false;
			const terminalAt = threadUnreadTerminalAtMs(input.thread, input.eventAtMs, { eventIsTerminal: Boolean(input.eventIsTerminal) });
			const viewedAt = timestampMs(input.viewedAtMs);
			if (viewedAt > 0) return terminalAt > viewedAt;
			const updateAt = terminalAt || (input.wasRunning ? statusFreshnessAtMs(input.thread, input.eventAtMs) : 0);
			if (input.mobileReplay && !updateAt) return false;
			const hintedAt = timestampMs(input.runningHintedAtMs);
			if (!input.wasRunning || hintedAt <= 0) return false;
			if (!updateAt) return !input.mobileReplay;
			return updateAt + (input.mobileReplay ? 0 : Math.max(0, Number(input.freshnessToleranceMs) || DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS)) >= hintedAt;
		}
		function runningHintAgeMs(input = {}) {
			const hintedAt = timestampMs(input.runningHintedAtMs);
			const now = timestampMs(input.nowMs) || Date.now();
			if (hintedAt > 0) return now - hintedAt;
			const updatedAt = threadUpdatedAtMs(input.thread);
			if (updatedAt > 0) return now - updatedAt;
			return (Number(input.runningHintStaleMs) || DEFAULT_RUNNING_HINT_STALE_MS) + 1;
		}
		function shouldExpireRunningThreadHint(input = {}) {
			if (!input.threadId || !input.isRunningHinted) return false;
			const status = input.status || input.thread && input.thread.status;
			if (isStaleActiveStatus(status, input.thread)) return true;
			if (isRunningStatus(status)) return false;
			if (isSettledStatus(status) && !shouldKeepRunningHintForSettledStatus(input)) return false;
			if (input.currentThreadHasLiveTurn) return false;
			return runningHintAgeMs(input) > (Number(input.runningHintStaleMs) || DEFAULT_RUNNING_HINT_STALE_MS);
		}
		return {
			DEFAULT_RUNNING_HINT_STALE_MS,
			DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS,
			DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS,
			hasFreshSubmittedProcessingHint,
			isIdleStatus,
			isRunningStatus,
			isSettledStatus,
			isStaleActiveStatus,
			isTerminalStatus,
			latestTerminalTurnAtMs,
			notificationDurableEventAtMs,
			notificationEventAtMs,
			runningHintAgeMs,
			shouldExpireRunningThreadHint,
			shouldKeepRunningHintForSettledStatus,
			shouldMarkThreadUnread,
			statusFreshnessAtMs,
			statusText,
			terminalTurnAtMs,
			threadUpdatedAtMs,
			timestampMs
		};
	});
}));
//#endregion
//#region public/thread-detail-patch-plan.js
var require_thread_detail_patch_plan = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadDetailPatchPlan = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function normalizePatchEntry(entry) {
			if (!entry || typeof entry !== "object") return null;
			const key = String(entry.key || "");
			if (!key) return null;
			return Object.assign({}, entry, { key });
		}
		function normalizeRefreshTurnPatchEntry(entry) {
			if (!entry || typeof entry !== "object") return null;
			const key = String(entry.key || "");
			if (!key) return null;
			return {
				key,
				hasPreviousTurn: Boolean(entry.hasPreviousTurn),
				itemPatchable: Boolean(entry.itemPatchable),
				articlePresent: Boolean(entry.articlePresent)
			};
		}
		function normalizedStringList(value) {
			return Array.isArray(value) ? value.map((entry) => String(entry || "")).filter(Boolean) : [];
		}
		function signatureText(signature) {
			if (signature == null) return "";
			if (typeof signature === "string") return signature;
			try {
				return JSON.stringify(signature);
			} catch (_) {
				return "";
			}
		}
		function planThreadDetailDomPatchSurface(input = {}) {
			const threadId = String(input.threadId || "").trim();
			const threadTileMode = Boolean(input.threadTileMode);
			const threadTileSurface = Boolean(input.threadTileSurface);
			const tilePaneVisible = Boolean(input.tilePaneVisible);
			const conversationPresent = Boolean(input.conversationPresent);
			if (threadTileMode || threadTileSurface) {
				if (!threadTileMode) return {
					canPatch: false,
					surface: "blocked",
					reason: "tile-surface-without-tile-mode",
					threadId
				};
				if (!threadTileSurface) return {
					canPatch: false,
					surface: "blocked",
					reason: "tile-mode-surface-mismatch",
					threadId
				};
				if (!threadId) return {
					canPatch: false,
					surface: "thread-tile-pane",
					reason: "missing-thread-id",
					threadId: ""
				};
				if (!tilePaneVisible) return {
					canPatch: false,
					surface: "thread-tile-pane",
					reason: "tile-pane-not-visible",
					threadId
				};
				return {
					canPatch: true,
					surface: "thread-tile-pane",
					reason: "tile-pane-visible",
					threadId
				};
			}
			if (!conversationPresent) return {
				canPatch: false,
				surface: "single-thread",
				reason: "missing-conversation",
				threadId
			};
			return {
				canPatch: true,
				surface: "single-thread",
				reason: "single-thread-surface",
				threadId
			};
		}
		function planThreadDetailRefreshLocalPatchPreflight(input = {}) {
			const conversationPresent = Boolean(input.conversationPresent);
			const previousThreadPresent = Boolean(input.previousThreadPresent);
			const nextThreadPresent = Boolean(input.nextThreadPresent);
			if (!conversationPresent) return {
				canPatch: false,
				terminal: false,
				reason: "missing-conversation-root"
			};
			if (!previousThreadPresent || !nextThreadPresent) return {
				canPatch: false,
				terminal: false,
				reason: "missing-thread"
			};
			if (String(input.stage || "complete") === "root") return {
				canPatch: true,
				terminal: false,
				reason: "root-ready"
			};
			if (input.tilePanePatched) return {
				canPatch: true,
				terminal: true,
				reason: "tile-pane-patched"
			};
			if (!input.singleThreadSurfaceAvailable) return {
				canPatch: false,
				terminal: false,
				reason: "single-thread-surface-unavailable"
			};
			if (input.previousLoadingOrError || input.nextLoadingOrError) return {
				canPatch: false,
				terminal: false,
				reason: "loading-or-error-state"
			};
			const renderedConversationSignature = signatureText(input.renderedConversationSignature);
			const previousConversationSignature = signatureText(input.previousConversationSignature);
			const renderedPatchShellSignature = signatureText(input.renderedPatchShellSignature);
			const previousPatchShellSignature = signatureText(input.previousPatchShellSignature);
			const nextPatchShellSignature = signatureText(input.nextPatchShellSignature);
			if (renderedConversationSignature !== previousConversationSignature && (!renderedPatchShellSignature || renderedPatchShellSignature !== previousPatchShellSignature)) return {
				canPatch: false,
				terminal: false,
				reason: "rendered-dom-stale"
			};
			if (previousPatchShellSignature !== nextPatchShellSignature) return {
				canPatch: false,
				terminal: false,
				reason: "patch-shell-changed"
			};
			return {
				canPatch: true,
				terminal: false,
				reason: "preflight-passed"
			};
		}
		function visibleItemPatchShapePreservesExisting(previousEntries, nextEntries) {
			if (!Array.isArray(previousEntries) || !Array.isArray(nextEntries)) return false;
			const previous = previousEntries.map(normalizePatchEntry).filter(Boolean);
			const next = nextEntries.map(normalizePatchEntry).filter(Boolean);
			if (previous.length !== previousEntries.length || next.length !== nextEntries.length) return false;
			if (previous.length > next.length) return false;
			let previousIndex = 0;
			for (const nextEntry of next) {
				const previousEntry = previous[previousIndex];
				if (previousEntry && previousEntry.key === nextEntry.key) previousIndex += 1;
			}
			return previousIndex === previous.length;
		}
		function planVisibleItemRefreshPatch(previousEntries, nextEntries) {
			if (!visibleItemPatchShapePreservesExisting(previousEntries, nextEntries)) return {
				canPatch: false,
				reason: "shape-changed",
				operations: []
			};
			const previousByKey = new Map(previousEntries.map(normalizePatchEntry).filter(Boolean).map((entry) => [entry.key, entry]));
			const operations = [];
			for (const rawNextEntry of nextEntries) {
				const nextEntry = normalizePatchEntry(rawNextEntry);
				if (!nextEntry) return {
					canPatch: false,
					reason: "invalid-entry",
					operations: []
				};
				const previousEntry = previousByKey.get(nextEntry.key);
				if (!previousEntry) {
					operations.push({
						type: "insert",
						key: nextEntry.key,
						nextEntry
					});
					continue;
				}
				const previousSignature = signatureText(previousEntry.signature);
				const nextSignature = signatureText(nextEntry.signature);
				operations.push({
					type: previousSignature === nextSignature ? "reuse" : "patch",
					key: nextEntry.key,
					previousEntry,
					nextEntry
				});
			}
			return {
				canPatch: true,
				reason: "shape-preserved",
				operations
			};
		}
		function planThreadDetailRefreshDomPatch(entries, options = {}) {
			if (!Array.isArray(entries)) return {
				canPatch: false,
				reason: "invalid-turn-entries",
				operations: []
			};
			const operations = [];
			const nextKeys = /* @__PURE__ */ new Set();
			for (const rawEntry of entries) {
				const entry = normalizeRefreshTurnPatchEntry(rawEntry);
				if (!entry) return {
					canPatch: false,
					reason: "invalid-turn-entry",
					operations: []
				};
				nextKeys.add(entry.key);
				if (entry.hasPreviousTurn && entry.itemPatchable && entry.articlePresent) {
					operations.push({
						type: "item-patch",
						key: entry.key,
						entry
					});
					continue;
				}
				operations.push({
					type: entry.articlePresent ? "replace-turn" : "insert-turn",
					key: entry.key,
					entry
				});
			}
			const previousTurnKeys = normalizedStringList(options.previousTurnKeys || options.previousKeys);
			for (const previousKey of previousTurnKeys) {
				if (nextKeys.has(previousKey)) continue;
				operations.push({
					type: "remove-turn",
					key: previousKey,
					entry: {
						key: previousKey,
						stale: true
					}
				});
			}
			return {
				canPatch: true,
				reason: "planned",
				operations
			};
		}
		return {
			normalizePatchEntry,
			normalizeRefreshTurnPatchEntry,
			planThreadDetailRefreshDomPatch,
			planThreadDetailRefreshLocalPatchPreflight,
			planVisibleItemRefreshPatch,
			planThreadDetailDomPatchSurface,
			visibleItemPatchShapePreservesExisting
		};
	});
}));
//#endregion
//#region public/thread-detail-actions.js
var require_thread_detail_actions = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadDetailActions = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function withinRoot(root, node) {
			if (!root || !node || typeof root.contains !== "function") return true;
			return root.contains(node);
		}
		function closestWithin(target, selector, root = null) {
			if (!target || typeof target.closest !== "function") return null;
			const node = target.closest(selector);
			if (!node || !withinRoot(root, node)) return null;
			return node;
		}
		function action(type, target, fields = {}) {
			return Object.assign({
				action: String(type || "none"),
				target: target || null,
				preventDefault: false,
				stopPropagation: false
			}, fields);
		}
		function dataValue(node, key) {
			return String(node && node.dataset && node.dataset[key] || "");
		}
		function contextThreadIdFromNode(node, explicitDatasetKey = "") {
			if (!node) return "";
			const explicit = explicitDatasetKey ? dataValue(node, explicitDatasetKey) : "";
			if (explicit) return explicit;
			if (typeof node.closest !== "function") return "";
			return dataValue(node.closest("[data-thread-tile-pane]"), "threadTilePane");
		}
		function previewableImageFromTarget(target, root = null) {
			const image = closestWithin(target, ".input-image img, .image-view img, .markdown-image img, .file-preview-image, .attachment-thumb", root);
			if (!image) return null;
			if (image.closest && image.closest(".github-link-card")) return null;
			return image;
		}
		function resolveRichContentClickAction(input = {}) {
			const target = input.target || null;
			const root = input.root || null;
			let node = closestWithin(target, "[data-copy-key]", root);
			if (node) return action("copy", node, {
				button: node,
				preventDefault: true,
				stopPropagation: true
			});
			node = closestWithin(target, "[data-local-file-path]", root);
			if (node) return action("local-file-preview", node, {
				link: node,
				threadId: contextThreadIdFromNode(node, "localFileThreadId"),
				preventDefault: true,
				stopPropagation: true
			});
			node = closestWithin(target, "[data-mermaid-action]", root);
			if (node) return action("mermaid", node, {
				button: node,
				preventDefault: true,
				stopPropagation: true
			});
			node = closestWithin(target, "[data-github-link-preview-expand]", root);
			if (node) return action("github-preview-toggle", node, {
				button: node,
				preventDefault: true,
				stopPropagation: true
			});
			return action("none", null, { reason: "no-match" });
		}
		function resolveThreadDetailClickAction(input = {}) {
			const target = input.target || null;
			const root = input.root || null;
			const rich = resolveRichContentClickAction({
				target,
				root
			});
			if (rich.action !== "none") return rich;
			let node = closestWithin(target, "[data-approval-action]", root);
			if (node) return action("approval-answer", node, {
				button: node,
				approvalId: dataValue(node, "approvalId"),
				approvalAction: dataValue(node, "approvalAction"),
				threadId: dataValue(node, "approvalThreadId")
			});
			node = closestWithin(target, "[data-task-card-action]", root);
			if (node) {
				const taskCardAction = dataValue(node, "taskCardAction");
				const cardId = dataValue(node, "taskCardId");
				const threadId = dataValue(node, "taskCardThreadId");
				if (taskCardAction === "reply") return action("task-card-reply", node, {
					button: node,
					cardId,
					taskCardAction,
					threadId
				});
				if (taskCardAction === "approve" || taskCardAction === "delete" || taskCardAction === "revoke") return action("task-card-mutate", node, {
					button: node,
					cardId,
					taskCardAction,
					threadId
				});
				return action("task-card-unknown", node, {
					button: node,
					cardId,
					taskCardAction,
					threadId
				});
			}
			node = closestWithin(target, "[data-task-card-draft-action]", root);
			if (node) return action("task-card-draft", node, {
				button: node,
				draftAction: dataValue(node, "taskCardDraftAction"),
				draftKey: dataValue(node, "taskCardDraftKey"),
				threadId: dataValue(node, "taskCardDraftThreadId")
			});
			node = closestWithin(target, "[data-server-response-text]", root);
			if (node) return action("server-response", node, {
				option: node,
				requestId: dataValue(node, "serverRequestId"),
				threadId: dataValue(node, "serverRequestThreadId"),
				responseText: dataValue(node, "serverResponseText"),
				questionId: dataValue(node, "serverQuestionId") || "answer"
			});
			node = closestWithin(target, "[data-server-request-decline]", root);
			if (node) return action("server-request-decline", node, {
				button: node,
				requestId: dataValue(node, "serverRequestId"),
				threadId: dataValue(node, "serverRequestThreadId")
			});
			return action("none", null, { reason: "no-match" });
		}
		return {
			closestWithin,
			previewableImageFromTarget,
			resolveRichContentClickAction,
			resolveThreadDetailClickAction,
			contextThreadIdFromNode
		};
	});
}));
//#endregion
//#region public/thread-detail-merge-state.js
var require_thread_detail_merge_state = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadDetailMergeState = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function defaultNormalizeThread(thread) {
			return thread;
		}
		function defaultSortTurns(turns) {
			return Array.isArray(turns) ? turns.slice() : [];
		}
		function createThreadDetailMergePolicy(options = {}) {
			const isV4ProjectionThread = typeof options.isV4ProjectionThread === "function" ? options.isV4ProjectionThread : () => false;
			const mergeV4ProjectionThread = typeof options.mergeV4ProjectionThread === "function" ? options.mergeV4ProjectionThread : (existingThread, incomingThread) => incomingThread || existingThread || null;
			const normalizeThreadVisibleUserMessages = typeof options.normalizeThreadVisibleUserMessages === "function" ? options.normalizeThreadVisibleUserMessages : defaultNormalizeThread;
			const turnVisibleWeight = typeof options.turnVisibleWeight === "function" ? options.turnVisibleWeight : () => 0;
			const shouldPreserveExistingTurnVisibleItems = typeof options.shouldPreserveExistingTurnVisibleItems === "function" ? options.shouldPreserveExistingTurnVisibleItems : () => false;
			const mergeItemsPreservingLocalVisible = typeof options.mergeItemsPreservingLocalVisible === "function" ? options.mergeItemsPreservingLocalVisible : (existingItems, incomingItems) => Array.isArray(incomingItems) ? incomingItems : existingItems;
			const shouldDropInitialSubmissionEchoTurn = typeof options.shouldDropInitialSubmissionEchoTurn === "function" ? options.shouldDropInitialSubmissionEchoTurn : () => false;
			const turnIsSupersededBy = typeof options.turnIsSupersededBy === "function" ? options.turnIsSupersededBy : () => false;
			const isTurnComplete = typeof options.isTurnComplete === "function" ? options.isTurnComplete : () => false;
			const shouldPreserveMissingExistingTurn = typeof options.shouldPreserveMissingExistingTurn === "function" ? options.shouldPreserveMissingExistingTurn : () => false;
			const sortTurnsForDisplay = typeof options.sortTurnsForDisplay === "function" ? options.sortTurnsForDisplay : defaultSortTurns;
			const threadHasInitialSubmissionEcho = typeof options.threadHasInitialSubmissionEcho === "function" ? options.threadHasInitialSubmissionEcho : () => false;
			const maxExpandedVisibleTurns = Math.max(1, Number(options.maxExpandedVisibleTurns || 200) || 200);
			function normalizeMergedThread(thread, limit = 0) {
				const normalized = normalizeThreadVisibleUserMessages(thread);
				if (normalized && Array.isArray(normalized.turns)) {
					const sorted = sortTurnsForDisplay(normalized.turns);
					normalized.turns = limit > 0 ? sorted.slice(-limit) : sorted;
				}
				return normalized;
			}
			function shouldPreserveLiveTurnLocalVisibleItems(existingTurn, incomingTurn, existingWeight = null) {
				return shouldPreserveExistingTurnVisibleItems(existingTurn, incomingTurn, existingWeight);
			}
			function mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) {
				if (!existingTurn) return incomingTurn;
				if (!incomingTurn) return existingTurn;
				const existingItems = Array.isArray(existingTurn.items) ? existingTurn.items : [];
				const incomingHasItems = Array.isArray(incomingTurn.items);
				const merged = Object.assign({}, existingTurn, incomingTurn);
				if (!incomingHasItems) {
					merged.items = existingItems;
					return merged;
				}
				const incomingWeight = turnVisibleWeight(Object.assign({}, incomingTurn, { items: incomingTurn.items || [] }));
				const existingWeight = turnVisibleWeight(existingTurn);
				const preserveLocalVisible = incomingWeight < existingWeight || shouldPreserveLiveTurnLocalVisibleItems(existingTurn, incomingTurn, existingWeight);
				merged.items = mergeItemsPreservingLocalVisible(existingItems, incomingTurn.items || [], preserveLocalVisible, incomingTurn);
				return merged;
			}
			function mergeThreadPreservingVisibleItems(existingThread, incomingThread, runtime = {}) {
				if (isV4ProjectionThread(incomingThread)) return mergeV4ProjectionThread(existingThread, incomingThread);
				if (!existingThread || !incomingThread || existingThread.id !== incomingThread.id) return normalizeMergedThread(incomingThread);
				const existingTurns = Array.isArray(existingThread.turns) ? existingThread.turns : [];
				const incomingTurns = Array.isArray(incomingThread.turns) ? incomingThread.turns : null;
				const existingById = new Map(existingTurns.map((turn) => [turn && turn.id, turn]).filter(([id]) => id));
				const initialSubmissionId = String(existingThread.mobileInitialSubmissionId || "");
				const merged = Object.assign({}, existingThread, incomingThread);
				if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoading")) delete merged.mobileLoading;
				if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoadError")) delete merged.mobileLoadError;
				if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileReadWarning")) delete merged.mobileReadWarning;
				if (!incomingTurns) return normalizeMergedThread(merged);
				const existingVisibleWeight = existingTurns.reduce((total, turn) => total + turnVisibleWeight(turn), 0);
				const incomingVisibleWeight = incomingTurns.reduce((total, turn) => total + turnVisibleWeight(turn), 0);
				const incomingHasAuthoritativeVisibleWindow = incomingTurns.length > 0 && incomingVisibleWeight > 0;
				if (!incomingTurns.length && existingTurns.length && existingVisibleWeight > 0 && incomingVisibleWeight === 0) {
					merged.turns = existingTurns;
					return normalizeMergedThread(merged);
				}
				merged.turns = incomingTurns.map((incomingTurn) => {
					const existingTurn = existingById.get(incomingTurn && incomingTurn.id);
					return existingTurn ? mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) : incomingTurn;
				});
				merged.turns = sortTurnsForDisplay(merged.turns);
				const incomingIds = new Set(merged.turns.map((turn) => turn && turn.id).filter(Boolean));
				const latestIncoming = merged.turns.length ? merged.turns[merged.turns.length - 1] : null;
				const preserveExpandedHistory = Boolean(existingThread.mobileHistoryExpanded) && (/turns-list/i.test(String(incomingThread.mobileReadMode || "")) || Boolean(incomingThread.mobileOlderTurnsCursor) || Number(incomingThread.mobileOmittedTurnCount || 0) > 0);
				let preservedExpandedTurnCount = 0;
				const activeTurnId = String(runtime.activeTurnId || "");
				for (const existingTurn of existingTurns) {
					if (!existingTurn || incomingIds.has(existingTurn.id)) continue;
					if (shouldDropInitialSubmissionEchoTurn(existingTurn, merged.turns, initialSubmissionId)) continue;
					if (preserveExpandedHistory) {
						merged.turns.push(existingTurn);
						preservedExpandedTurnCount += 1;
						continue;
					}
					if (incomingHasAuthoritativeVisibleWindow && !shouldPreserveMissingExistingTurn(existingTurn, merged, runtime)) continue;
					if (turnIsSupersededBy(existingTurn, latestIncoming)) continue;
					if (String(existingTurn.id || "") === activeTurnId || !isTurnComplete(existingTurn) && turnVisibleWeight(existingTurn) > 0) merged.turns.push(existingTurn);
				}
				if (preserveExpandedHistory) {
					merged.mobileHistoryExpanded = true;
					if (preservedExpandedTurnCount > 0) merged.mobileOmittedTurnCount = Math.max(0, Number(merged.mobileOmittedTurnCount || 0) - preservedExpandedTurnCount);
				}
				const normalized = normalizeMergedThread(merged, preserveExpandedHistory ? maxExpandedVisibleTurns : 0);
				if (!threadHasInitialSubmissionEcho(normalized, initialSubmissionId)) delete normalized.mobileInitialSubmissionId;
				return normalized;
			}
			return {
				mergeThreadPreservingVisibleItems,
				mergeTurnPreservingVisibleItems,
				shouldPreserveLiveTurnLocalVisibleItems
			};
		}
		return { createThreadDetailMergePolicy };
	});
}));
//#endregion
//#region public/thread-detail-v4-merge-state.js
var require_thread_detail_v4_merge_state = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadDetailV4MergeState = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function defaultNormalizeThread(thread) {
			return thread;
		}
		function defaultTurnVisibleWeight(turn) {
			return Array.isArray(turn && turn.items) ? turn.items.length : 0;
		}
		function defaultSortTurns(turns) {
			return Array.isArray(turns) ? turns.slice() : [];
		}
		function statusText(status) {
			if (!status) return "";
			if (typeof status === "object" && status.type) return String(status.type || "");
			return String(status || "");
		}
		function createThreadDetailV4MergePolicy(options = {}) {
			const normalizeThreadVisibleUserMessages = typeof options.normalizeThreadVisibleUserMessages === "function" ? options.normalizeThreadVisibleUserMessages : defaultNormalizeThread;
			const turnVisibleWeight = typeof options.turnVisibleWeight === "function" ? options.turnVisibleWeight : defaultTurnVisibleWeight;
			const isOptimisticUserMessage = typeof options.isOptimisticUserMessage === "function" ? options.isOptimisticUserMessage : () => false;
			const isRecentlySubmittedUserMessage = typeof options.isRecentlySubmittedUserMessage === "function" ? options.isRecentlySubmittedUserMessage : () => false;
			const isReasoningItem = typeof options.isReasoningItem === "function" ? options.isReasoningItem : () => false;
			const userMessageHasSubmissionId = typeof options.userMessageHasSubmissionId === "function" ? options.userMessageHasSubmissionId : (item, submissionId) => Boolean(item && submissionId && String(item.clientSubmissionId || "") === String(submissionId || ""));
			const userMessagesCanShadow = typeof options.userMessagesCanShadow === "function" ? options.userMessagesCanShadow : () => false;
			const isTurnComplete = typeof options.isTurnComplete === "function" ? options.isTurnComplete : (turn) => /completed|failed|cancel|error|interrupted/i.test(statusText(turn && turn.status));
			const isRunningStatus = typeof options.isRunningStatus === "function" ? options.isRunningStatus : (status) => /active|running|queued|processing|inprogress|in_progress|in-progress|pending|started/i.test(statusText(status));
			const isIncompleteInterruptedTurn = typeof options.isIncompleteInterruptedTurn === "function" ? options.isIncompleteInterruptedTurn : () => false;
			const turnHasActiveLiveItems = typeof options.turnHasActiveLiveItems === "function" ? options.turnHasActiveLiveItems : () => false;
			const turnOrderMs = typeof options.turnOrderMs === "function" ? options.turnOrderMs : () => 0;
			const mergeTurnPreservingVisibleItems = typeof options.mergeTurnPreservingVisibleItems === "function" ? options.mergeTurnPreservingVisibleItems : (existingTurn, incomingTurn) => incomingTurn || existingTurn;
			const sortTurnsForDisplay = typeof options.sortTurnsForDisplay === "function" ? options.sortTurnsForDisplay : defaultSortTurns;
			const maxVisibleTurnsForThread = typeof options.maxVisibleTurnsForThread === "function" ? options.maxVisibleTurnsForThread : () => 10;
			function isV4ProjectionThread(thread) {
				return Boolean(thread && (thread.mobileProjectionVersion === "v4" || thread.mobileProjection && thread.mobileProjection.version === "v4"));
			}
			function shouldPreserveV4PendingOverlayItem(item) {
				return Boolean(item && item.type === "userMessage" && isOptimisticUserMessage(item) && (isRecentlySubmittedUserMessage(item) || item.mobileSendError));
			}
			function v4ThreadHasPendingMatch(thread, pendingItem) {
				if (!pendingItem || pendingItem.type !== "userMessage") return false;
				const submissionId = String(pendingItem.clientSubmissionId || "").trim();
				for (const turn of Array.isArray(thread && thread.turns) ? thread.turns : []) for (const item of Array.isArray(turn && turn.items) ? turn.items : []) {
					if (!item || item.type !== "userMessage") continue;
					if (submissionId && userMessageHasSubmissionId(item, submissionId)) return true;
					if (!isOptimisticUserMessage(item) && userMessagesCanShadow(item, pendingItem)) return true;
				}
				return false;
			}
			function appendV4PendingOverlayItem(turn, item) {
				if (!turn || !item) return;
				turn.items = Array.isArray(turn.items) ? turn.items : [];
				const submissionId = String(item.clientSubmissionId || "").trim();
				if (!turn.items.some((existing) => existing && (submissionId && userMessageHasSubmissionId(existing, submissionId) || existing.id === item.id || userMessagesCanShadow(existing, item)))) turn.items.push(item);
			}
			function copyTurnWithOnlyItems(turn, items) {
				return Object.assign({}, turn || {}, { items: (items || []).slice() });
			}
			function applyV4PendingOverlay(existingThread, mergedThread) {
				if (!existingThread || !mergedThread || !Array.isArray(existingThread.turns)) return mergedThread;
				mergedThread.turns = Array.isArray(mergedThread.turns) ? mergedThread.turns : [];
				const turnsById = new Map(mergedThread.turns.map((turn) => [String(turn && turn.id || ""), turn]));
				for (const existingTurn of existingThread.turns) {
					const pendingItems = (Array.isArray(existingTurn && existingTurn.items) ? existingTurn.items : []).filter((item) => shouldPreserveV4PendingOverlayItem(item) && !v4ThreadHasPendingMatch(mergedThread, item));
					if (!pendingItems.length) continue;
					const targetTurn = turnsById.get(String(existingTurn.id || ""));
					if (targetTurn) {
						pendingItems.forEach((item) => appendV4PendingOverlayItem(targetTurn, item));
						continue;
					}
					const overlayTurn = copyTurnWithOnlyItems(existingTurn, pendingItems);
					overlayTurn.mobilePendingOverlay = true;
					mergedThread.turns.push(overlayTurn);
					if (overlayTurn.id) turnsById.set(String(overlayTurn.id), overlayTurn);
				}
				return mergedThread;
			}
			function v4ProjectionRevisionValue(thread) {
				const direct = Number(thread && thread.mobileProjectionRevision);
				if (Number.isFinite(direct) && direct > 0) return Math.trunc(direct);
				const nested = Number(thread && thread.mobileProjection && thread.mobileProjection.revision);
				return Number.isFinite(nested) && nested > 0 ? Math.trunc(nested) : 0;
			}
			function isV4ProjectionRefreshRegressive(existingThread, incomingThread) {
				const existingRevision = v4ProjectionRevisionValue(existingThread);
				const incomingRevision = v4ProjectionRevisionValue(incomingThread);
				return Boolean(existingRevision && incomingRevision && incomingRevision < existingRevision);
			}
			function isActiveLikeProjectionTurn(turn) {
				return Boolean(turn && !isTurnComplete(turn) && (isRunningStatus(turn.status) || isIncompleteInterruptedTurn(turn) || turnHasActiveLiveItems(turn)));
			}
			function incomingTurnsClearlySupersedeExistingTurn(existingTurn, incomingTurns) {
				const existingOrder = turnOrderMs(existingTurn);
				if (!existingOrder) return false;
				return (incomingTurns || []).some((incomingTurn) => {
					if (!incomingTurn || String(incomingTurn.id || "") === String(existingTurn && existingTurn.id || "")) return false;
					const incomingOrder = turnOrderMs(incomingTurn);
					return Boolean(incomingOrder && incomingOrder > existingOrder);
				});
			}
			function existingV4TurnHasOnlyMatchedPendingItems(existingTurn, incomingTurns) {
				const visibleItems = (Array.isArray(existingTurn && existingTurn.items) ? existingTurn.items : []).filter((item) => item && turnVisibleWeight({ items: [item] }) > 0 && !isReasoningItem(item));
				return Boolean(visibleItems.length && visibleItems.every((item) => shouldPreserveV4PendingOverlayItem(item) && v4ThreadHasPendingMatch({ turns: incomingTurns || [] }, item)));
			}
			function shouldPreserveExistingV4ProjectionTurn(existingThread, incomingThread, existingTurn, incomingTurns) {
				if (!existingTurn || turnVisibleWeight(existingTurn) <= 0) return false;
				const id = String(existingTurn.id || "");
				if (id && (incomingTurns || []).some((turn) => String(turn && turn.id || "") === id)) return false;
				if (existingV4TurnHasOnlyMatchedPendingItems(existingTurn, incomingTurns)) return false;
				const activeLike = isActiveLikeProjectionTurn(existingTurn);
				const regressiveRefresh = isV4ProjectionRefreshRegressive(existingThread, incomingThread);
				if (!activeLike && !regressiveRefresh) return false;
				return !incomingTurnsClearlySupersedeExistingTurn(existingTurn, incomingTurns);
			}
			function mergeV4ProjectionThread(existingThread, incomingThread) {
				if (!existingThread || !incomingThread || existingThread.id !== incomingThread.id) return normalizeThreadVisibleUserMessages(incomingThread);
				const merged = Object.assign({}, existingThread, incomingThread);
				if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoading")) delete merged.mobileLoading;
				if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoadError")) delete merged.mobileLoadError;
				if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileReadWarning")) delete merged.mobileReadWarning;
				if (Array.isArray(incomingThread.turns)) {
					const existingTurns = Array.isArray(existingThread.turns) ? existingThread.turns : [];
					const incomingTurns = incomingThread.turns.slice();
					const existingVisibleWeight = existingTurns.reduce((total, turn) => total + turnVisibleWeight(turn), 0);
					const incomingVisibleWeight = incomingTurns.reduce((total, turn) => total + turnVisibleWeight(turn), 0);
					if (!incomingTurns.length && existingTurns.length && existingVisibleWeight > 0 && incomingVisibleWeight === 0) {
						merged.turns = existingTurns;
						return normalizeThreadVisibleUserMessages(merged);
					}
					const existingById = new Map(existingTurns.map((turn) => [String(turn && turn.id || ""), turn]));
					merged.turns = incomingTurns.map((incomingTurn) => {
						const existingTurn = existingById.get(String(incomingTurn && incomingTurn.id || ""));
						return existingTurn ? mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) : incomingTurn;
					});
					for (const existingTurn of existingTurns) if (shouldPreserveExistingV4ProjectionTurn(existingThread, incomingThread, existingTurn, merged.turns)) merged.turns.push(existingTurn);
					applyV4PendingOverlay(existingThread, merged);
					merged.turns = sortTurnsForDisplay(merged.turns).slice(-maxVisibleTurnsForThread(merged));
				}
				if (isV4ProjectionRefreshRegressive(existingThread, incomingThread)) {
					const existingRevision = v4ProjectionRevisionValue(existingThread);
					if (existingRevision) {
						merged.mobileProjectionRevision = existingRevision;
						if (merged.mobileProjection && typeof merged.mobileProjection === "object") merged.mobileProjection = Object.assign({}, merged.mobileProjection, { revision: existingRevision });
					}
				}
				return normalizeThreadVisibleUserMessages(merged);
			}
			return {
				applyV4PendingOverlay,
				isV4ProjectionRefreshRegressive,
				isV4ProjectionThread,
				mergeV4ProjectionThread,
				shouldPreserveExistingV4ProjectionTurn,
				v4ProjectionRevisionValue
			};
		}
		return { createThreadDetailV4MergePolicy };
	});
}));
//#endregion
//#region \0virtual:codex-mobile-esm-compatibility/shard/shard-03
var import_thread_list_runtime = /* @__PURE__ */ __toESM(require_thread_list_runtime());
var import_side_chat_runtime = /* @__PURE__ */ __toESM(require_side_chat_runtime());
var import_composer_bridge_runtime = /* @__PURE__ */ __toESM(require_composer_bridge_runtime());
var import_api_client_runtime = /* @__PURE__ */ __toESM(require_api_client_runtime());
var import_thread_list_load_policy = /* @__PURE__ */ __toESM(require_thread_list_load_policy());
var import_thread_list_stable_order = /* @__PURE__ */ __toESM(require_thread_list_stable_order());
var import_thread_status_hints = /* @__PURE__ */ __toESM(require_thread_status_hints());
var import_thread_detail_patch_plan = /* @__PURE__ */ __toESM(require_thread_detail_patch_plan());
var import_thread_detail_actions = /* @__PURE__ */ __toESM(require_thread_detail_actions());
var import_thread_detail_merge_state = /* @__PURE__ */ __toESM(require_thread_detail_merge_state());
var import_thread_detail_v4_merge_state = /* @__PURE__ */ __toESM(require_thread_detail_v4_merge_state());
var moduleDefinitions = [
	{
		"id": "thread-list-runtime",
		"source": "public/thread-list-runtime.js",
		"globalName": "CodexThreadListRuntime",
		"expectedFunctions": ["createThreadListRuntime"],
		"assetPath": "/thread-list-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 37203
	},
	{
		"id": "side-chat-runtime",
		"source": "public/side-chat-runtime.js",
		"globalName": "CodexSideChatRuntime",
		"expectedFunctions": ["createSideChatRuntime"],
		"assetPath": "/side-chat-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 51946
	},
	{
		"id": "composer-bridge-runtime",
		"source": "public/composer-bridge-runtime.js",
		"globalName": "CodexComposerBridgeRuntime",
		"expectedFunctions": ["createComposerBridgeRuntime"],
		"assetPath": "/composer-bridge-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 32086
	},
	{
		"id": "api-client-runtime",
		"source": "public/api-client-runtime.js",
		"globalName": "CodexApiClientRuntime",
		"expectedFunctions": ["createApiClientRuntime"],
		"assetPath": "/api-client-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 49014
	},
	{
		"id": "thread-list-load-policy",
		"source": "public/thread-list-load-policy.js",
		"globalName": "CodexThreadListLoadPolicy",
		"expectedFunctions": ["planThreadListLoadRequest"],
		"assetPath": "/thread-list-load-policy.js",
		"classicLoaderExcluded": true,
		"bytes": 2160
	},
	{
		"id": "thread-list-stable-order",
		"source": "public/thread-list-stable-order.js",
		"globalName": "CodexThreadListStableOrder",
		"expectedFunctions": ["threadListOrderScopeKey", "planThreadListStableOrder"],
		"assetPath": "/thread-list-stable-order.js",
		"classicLoaderExcluded": true,
		"bytes": 3327
	},
	{
		"id": "thread-status-hints",
		"source": "public/thread-status-hints.js",
		"globalName": "CodexThreadStatusHints",
		"expectedFunctions": [
			"isRunningStatus",
			"shouldExpireRunningThreadHint",
			"shouldMarkThreadUnread"
		],
		"assetPath": "/thread-status-hints.js",
		"classicLoaderExcluded": true,
		"bytes": 9883
	},
	{
		"id": "thread-detail-patch-plan",
		"source": "public/thread-detail-patch-plan.js",
		"globalName": "CodexThreadDetailPatchPlan",
		"expectedFunctions": [
			"planThreadDetailDomPatchSurface",
			"planThreadDetailRefreshDomPatch",
			"planVisibleItemRefreshPatch"
		],
		"assetPath": "/thread-detail-patch-plan.js",
		"classicLoaderExcluded": true,
		"bytes": 8310
	},
	{
		"id": "thread-detail-actions",
		"source": "public/thread-detail-actions.js",
		"globalName": "CodexThreadDetailActions",
		"expectedFunctions": [
			"closestWithin",
			"contextThreadIdFromNode",
			"previewableImageFromTarget",
			"resolveRichContentClickAction",
			"resolveThreadDetailClickAction"
		],
		"assetPath": "/thread-detail-actions.js",
		"classicLoaderExcluded": true,
		"bytes": 5362
	},
	{
		"id": "thread-detail-merge-state",
		"source": "public/thread-detail-merge-state.js",
		"globalName": "CodexThreadDetailMergeState",
		"expectedFunctions": ["createThreadDetailMergePolicy"],
		"assetPath": "/thread-detail-merge-state.js",
		"classicLoaderExcluded": true,
		"bytes": 8461
	},
	{
		"id": "thread-detail-v4-merge-state",
		"source": "public/thread-detail-v4-merge-state.js",
		"globalName": "CodexThreadDetailV4MergeState",
		"expectedFunctions": ["createThreadDetailV4MergePolicy"],
		"assetPath": "/thread-detail-v4-merge-state.js",
		"classicLoaderExcluded": true,
		"bytes": 12071
	}
];
var moduleApis = {
	"thread-list-runtime": import_thread_list_runtime.default,
	"side-chat-runtime": import_side_chat_runtime.default,
	"composer-bridge-runtime": import_composer_bridge_runtime.default,
	"api-client-runtime": import_api_client_runtime.default,
	"thread-list-load-policy": import_thread_list_load_policy.default,
	"thread-list-stable-order": import_thread_list_stable_order.default,
	"thread-status-hints": import_thread_status_hints.default,
	"thread-detail-patch-plan": import_thread_detail_patch_plan.default,
	"thread-detail-actions": import_thread_detail_actions.default,
	"thread-detail-merge-state": import_thread_detail_merge_state.default,
	"thread-detail-v4-merge-state": import_thread_detail_v4_merge_state.default
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
	if (id === "navigation-runtime") {
		const runtime = functionReady(api, "createNavigationRuntime") ? api.createNavigationRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.updateConnectionState === "function" && typeof runtime.restoreConnectionState === "function" && typeof runtime.markActivity === "function" && typeof runtime.composerTargetPlan === "function" && typeof runtime.visibleTurnsForConversation === "function" && typeof runtime.conversationRenderSignature === "function" && typeof runtime.updateTurnTimer === "function" && typeof globalThis.updateConnectionState === "function" && typeof globalThis.composerTargetPlan === "function" && typeof globalThis.visibleTurnsForConversation === "function",
			factoryType: typeof api.createNavigationRuntime,
			updateType: typeof (runtime && runtime.updateConnectionState),
			restoreType: typeof (runtime && runtime.restoreConnectionState),
			activityType: typeof (runtime && runtime.markActivity),
			composerPlanType: typeof (runtime && runtime.composerTargetPlan),
			visibleTurnsType: typeof (runtime && runtime.visibleTurnsForConversation),
			signatureType: typeof (runtime && runtime.conversationRenderSignature),
			timerType: typeof (runtime && runtime.updateTurnTimer),
			globalUpdateType: typeof globalThis.updateConnectionState,
			globalComposerPlanType: typeof globalThis.composerTargetPlan,
			globalVisibleTurnsType: typeof globalThis.visibleTurnsForConversation
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
	if (id === "pane-layout-runtime") {
		const runtime = functionReady(api, "createPaneLayoutRuntime") ? api.createPaneLayoutRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderCurrentThread === "function" && typeof runtime.updateConversationHtml === "function" && typeof runtime.patchCurrentThreadDetailFromRefresh === "function" && typeof runtime.syncThreadTileToggle === "function" && typeof runtime.setThreadTileMode === "function" && typeof runtime.renderHome === "function" && typeof runtime.loadThread === "function" && typeof runtime.loadThreads === "function" && typeof runtime.enterNewThreadDraft === "function" && typeof runtime.handleThreadCardClick === "function" && typeof runtime.showHermesPluginPrimaryPage === "function" && typeof runtime.returnToThreadListFromDetail === "function" && typeof globalThis.loadThread === "function" && typeof globalThis.loadThreads === "function" && typeof globalThis.renderCurrentThread === "function",
			factoryType: typeof api.createPaneLayoutRuntime,
			renderType: typeof (runtime && runtime.renderCurrentThread),
			updateHtmlType: typeof (runtime && runtime.updateConversationHtml),
			patchType: typeof (runtime && runtime.patchCurrentThreadDetailFromRefresh),
			tileToggleType: typeof (runtime && runtime.syncThreadTileToggle),
			tileModeType: typeof (runtime && runtime.setThreadTileMode),
			homeType: typeof (runtime && runtime.renderHome),
			loadThreadType: typeof (runtime && runtime.loadThread),
			loadThreadsType: typeof (runtime && runtime.loadThreads),
			newThreadType: typeof (runtime && runtime.enterNewThreadDraft),
			cardClickType: typeof (runtime && runtime.handleThreadCardClick),
			pluginPrimaryType: typeof (runtime && runtime.showHermesPluginPrimaryPage),
			returnType: typeof (runtime && runtime.returnToThreadListFromDetail),
			globalLoadThreadType: typeof globalThis.loadThread,
			globalLoadThreadsType: typeof globalThis.loadThreads,
			globalRenderType: typeof globalThis.renderCurrentThread
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
	if (id === "composer-bridge-runtime") {
		const runtime = functionReady(api, "createComposerBridgeRuntime") ? api.createComposerBridgeRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.sendMessage === "function" && typeof runtime.sendNewThreadMessage === "function" && typeof runtime.answerServerRequest === "function" && typeof runtime.answerApproval === "function" && typeof runtime.declineServerRequest === "function" && typeof runtime.mutateThreadTaskCard === "function" && typeof runtime.replyTaskCard === "function" && typeof runtime.queueThreadTaskCardDraftCreation === "function" && typeof runtime.createThreadTaskCardDraft === "function" && typeof globalThis.sendMessage === "function" && typeof globalThis.answerApproval === "function" && typeof globalThis.mutateThreadTaskCard === "function" && typeof globalThis.queueThreadTaskCardDraftCreation === "function",
			factoryType: typeof api.createComposerBridgeRuntime,
			sendType: typeof (runtime && runtime.sendMessage),
			answerType: typeof (runtime && runtime.answerServerRequest),
			approvalType: typeof (runtime && runtime.answerApproval),
			mutateType: typeof (runtime && runtime.mutateThreadTaskCard),
			replyType: typeof (runtime && runtime.replyTaskCard),
			draftType: typeof (runtime && runtime.createThreadTaskCardDraft),
			globalSendType: typeof globalThis.sendMessage,
			globalApprovalType: typeof globalThis.answerApproval,
			globalMutateType: typeof globalThis.mutateThreadTaskCard,
			globalDraftQueueType: typeof globalThis.queueThreadTaskCardDraftCreation
		};
	}
	if (id === "api-client-runtime") {
		const runtime = functionReady(api, "createApiClientRuntime") ? api.createApiClientRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.api === "function" && typeof runtime.postClientEvent === "function" && typeof runtime.postPerformanceEvent === "function" && typeof runtime.recordHomeAiDiagnosticFailure === "function" && typeof runtime.recordHomeAiDiagnosticSuccess === "function" && typeof runtime.scheduleSubmittedMessageDomProbe === "function" && typeof runtime.checkConversationProjectionConsistency === "function" && typeof runtime.handlePushButtonClick === "function" && typeof globalThis.api === "function" && typeof globalThis.postClientEvent === "function" && typeof globalThis.diagnosticThreadHash === "function" && typeof globalThis.recordHomeAiDiagnosticFailure === "function" && typeof globalThis.scheduleSubmittedMessageDomProbe === "function" && typeof globalThis.checkConversationProjectionConsistency === "function" && typeof globalThis.handlePushButtonClick === "function",
			factoryType: typeof api.createApiClientRuntime,
			apiType: typeof (runtime && runtime.api),
			clientEventType: typeof (runtime && runtime.postClientEvent),
			performanceType: typeof (runtime && runtime.postPerformanceEvent),
			diagnosticFailureType: typeof (runtime && runtime.recordHomeAiDiagnosticFailure),
			diagnosticSuccessType: typeof (runtime && runtime.recordHomeAiDiagnosticSuccess),
			submittedProbeType: typeof (runtime && runtime.scheduleSubmittedMessageDomProbe),
			projectionCheckType: typeof (runtime && runtime.checkConversationProjectionConsistency),
			pushType: typeof (runtime && runtime.handlePushButtonClick),
			globalApiType: typeof globalThis.api,
			globalClientEventType: typeof globalThis.postClientEvent,
			globalThreadHashType: typeof globalThis.diagnosticThreadHash,
			globalSubmittedProbeType: typeof globalThis.scheduleSubmittedMessageDomProbe,
			globalProjectionCheckType: typeof globalThis.checkConversationProjectionConsistency,
			globalPushType: typeof globalThis.handlePushButtonClick
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
	if (id === "thread-detail-runtime") {
		const statePolicy = {
			completedIncomingTurnHasAuthoritativeReceipt: () => false,
			shouldDropLocalOnlyReceiptForIncomingTurn: () => false,
			shouldPreserveLocalOnlyItem: () => false,
			shouldPreserveExistingTurnVisibleItems: () => false
		};
		const runtime = functionReady(api, "createThreadDetailRuntime") ? api.createThreadDetailRuntime({
			threadDetailStateApi: {
				createThreadDetailStatePolicy: () => statePolicy,
				threadListSummaryFromDetailThread: () => ({}),
				planThreadOpenCacheReuse: () => ({ action: "skip" }),
				threadHasReusableLoadedDetailState: () => false
			},
			threadDetailMergeStateApi: { createThreadDetailMergePolicy: () => ({ mergeThreadPreservingVisibleItems: (existingThread, incomingThread) => incomingThread || existingThread }) },
			threadDetailV4MergeStateApi: { createThreadDetailV4MergePolicy: () => ({
				isV4ProjectionThread: () => false,
				mergeV4ProjectionThread: (existingThread, incomingThread) => incomingThread || existingThread
			}) },
			statusText: (status) => String(status && status.type || status || ""),
			isLiveTurn: (turn) => /active|running/i.test(String(turn && (turn.status && turn.status.type || turn.status) || "")),
			isLatestTurn: (turn, thread) => Array.isArray(thread && thread.turns) && thread.turns.at(-1) === turn,
			isReasoningItem: (item) => String(item && item.type || "") === "reasoning",
			isOperationalItem: (item) => String(item && item.type || "") === "commandExecution",
			isContextCompactionItem: () => false,
			isTurnComplete: (turn) => /completed|failed|cancel|interrupted/i.test(String(turn && (turn.status && turn.status.type || turn.status) || "")),
			isRunningStatus: (status) => /active|running|queued|processing/i.test(String(status && status.type || status || "")),
			sortTurnsForDisplay: (turns) => Array.isArray(turns) ? turns : []
		}) : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.visibleItemsForTurn === "function" && typeof runtime.mergeThreadPreservingVisibleItems === "function" && typeof runtime.normalizeThreadVisibleUserMessages === "function" && typeof runtime.threadUserMessageEntries === "function" && typeof runtime.turnOrderMs === "function" && typeof runtime.turnIsSupersededBy === "function" && typeof globalThis.CodexThreadDetailRuntime === "object" && typeof globalThis.CodexThreadDetailRuntime.createThreadDetailRuntime === "function",
			factoryType: typeof api.createThreadDetailRuntime,
			visibleItemsType: typeof (runtime && runtime.visibleItemsForTurn),
			mergeType: typeof (runtime && runtime.mergeThreadPreservingVisibleItems),
			normalizeType: typeof (runtime && runtime.normalizeThreadVisibleUserMessages),
			turnOrderType: typeof (runtime && runtime.turnOrderMs),
			globalFactoryType: typeof (globalThis.CodexThreadDetailRuntime && globalThis.CodexThreadDetailRuntime.createThreadDetailRuntime)
		};
	}
	if (id === "task-card-runtime") {
		const runtime = functionReady(api, "createTaskCardRuntime") ? api.createTaskCardRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderThreadTaskCard === "function" && typeof runtime.renderThreadTaskCards === "function" && typeof runtime.createThreadTaskCardFromCurrent === "function" && typeof runtime.renderApprovalRequest === "function" && typeof globalThis.CodexTaskCardRuntime === "object" && typeof globalThis.CodexTaskCardRuntime.createTaskCardRuntime === "function" && typeof globalThis.threadTaskCardCommandText === "function" && typeof globalThis.renderThreadTaskCards === "function" && typeof globalThis.renderApprovalRequest === "function",
			factoryType: typeof api.createTaskCardRuntime,
			renderType: typeof (runtime && runtime.renderThreadTaskCard),
			renderListType: typeof (runtime && runtime.renderThreadTaskCards),
			createType: typeof (runtime && runtime.createThreadTaskCardFromCurrent),
			approvalType: typeof (runtime && runtime.renderApprovalRequest),
			globalCommandType: typeof globalThis.threadTaskCardCommandText,
			globalRenderType: typeof globalThis.renderThreadTaskCards
		};
	}
	if (id === "settings-runtime") {
		const runtime = functionReady(api, "createSettingsRuntime") ? api.createSettingsRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderFontSizeControl === "function" && typeof runtime.renderQuotaUsage === "function" && typeof runtime.renderCodexProfileSettings === "function" && typeof runtime.renderWorkspaceDelegationSettings === "function" && typeof runtime.rememberRateLimitsFromConfig === "function" && typeof runtime.rememberCodexProfiles === "function" && typeof globalThis.CodexSettingsRuntime === "object" && typeof globalThis.CodexSettingsRuntime.createSettingsRuntime === "function",
			factoryType: typeof api.createSettingsRuntime,
			fontSizeType: typeof (runtime && runtime.renderFontSizeControl),
			quotaType: typeof (runtime && runtime.renderQuotaUsage),
			profileType: typeof (runtime && runtime.renderCodexProfileSettings),
			workspaceDelegationType: typeof (runtime && runtime.renderWorkspaceDelegationSettings),
			rateLimitsType: typeof (runtime && runtime.rememberRateLimitsFromConfig),
			profilesType: typeof (runtime && runtime.rememberCodexProfiles),
			globalFactoryType: typeof (globalThis.CodexSettingsRuntime && globalThis.CodexSettingsRuntime.createSettingsRuntime)
		};
	}
	if (id === "app-entry") {
		const runtime = functionReady(api, "createCodexMobileAppEntry") ? api.createCodexMobileAppEntry() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.startCodexMobileApp === "function" && typeof api.startCodexMobileApp === "function" && typeof globalThis.CodexMobileAppEntry === "object" && typeof globalThis.CodexMobileAppEntry.createCodexMobileAppEntry === "function" && typeof globalThis.CodexMobileAppEntry.startCodexMobileApp === "function",
			factoryType: typeof api.createCodexMobileAppEntry,
			startType: typeof api.startCodexMobileApp,
			runtimeStartType: typeof (runtime && runtime.startCodexMobileApp),
			globalFactoryType: typeof (globalThis.CodexMobileAppEntry && globalThis.CodexMobileAppEntry.createCodexMobileAppEntry),
			globalStartType: typeof (globalThis.CodexMobileAppEntry && globalThis.CodexMobileAppEntry.startCodexMobileApp)
		};
	}
	if (id === "notification-ui-runtime") {
		const runtime = functionReady(api, "createNotificationUiRuntime") ? api.createNotificationUiRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.showApp === "function" && typeof runtime.showLogin === "function" && typeof runtime.bootstrap === "function" && typeof runtime.requestHermesPluginRefresh === "function" && typeof runtime.handlePluginVoiceInputMessage === "function" && typeof globalThis.CodexNotificationUiRuntime === "object" && typeof globalThis.CodexNotificationUiRuntime.createNotificationUiRuntime === "function" && typeof globalThis.showApp === "function" && typeof globalThis.showLogin === "function" && typeof globalThis.bootstrap === "function" && typeof globalThis.sortTurnsForDisplay === "function",
			factoryType: typeof api.createNotificationUiRuntime,
			showAppType: typeof (runtime && runtime.showApp),
			showLoginType: typeof (runtime && runtime.showLogin),
			bootstrapType: typeof (runtime && runtime.bootstrap),
			refreshType: typeof (runtime && runtime.requestHermesPluginRefresh),
			globalBootstrapType: typeof globalThis.bootstrap,
			globalSortType: typeof globalThis.sortTurnsForDisplay
		};
	}
	if (id === "conversation-render-runtime") {
		const runtime = functionReady(api, "createConversationRenderRuntime") ? api.createConversationRenderRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderTurn === "function" && typeof runtime.renderItem === "function" && typeof runtime.renderItemBody === "function" && typeof runtime.renderUserMessageBody === "function" && typeof runtime.renderLiveOperationDock === "function" && typeof runtime.ensureTurn === "function" && typeof runtime.shouldDeferLiveFinalReceipt === "function" && typeof globalThis.CodexConversationRenderRuntime === "object" && typeof globalThis.CodexConversationRenderRuntime.createConversationRenderRuntime === "function" && typeof globalThis.renderTurn === "function" && typeof globalThis.renderItem === "function" && typeof globalThis.renderLiveOperationDock === "function" && typeof globalThis.ensureTurn === "function" && typeof globalThis.shouldDeferLiveFinalReceipt === "function" && typeof globalThis.imageUrlValue === "function" && typeof globalThis.renderMarkdownWithAttachmentSummary === "function" && typeof globalThis.renderFilePreviewContent === "function" && typeof globalThis.closeImagePreview === "function",
			factoryType: typeof api.createConversationRenderRuntime,
			renderTurnType: typeof (runtime && runtime.renderTurn),
			renderItemType: typeof (runtime && runtime.renderItem),
			liveDockType: typeof (runtime && runtime.renderLiveOperationDock),
			ensureTurnType: typeof (runtime && runtime.ensureTurn),
			globalRenderType: typeof globalThis.renderTurn,
			globalEnsureTurnType: typeof globalThis.ensureTurn,
			globalImageUrlType: typeof globalThis.imageUrlValue
		};
	}
	if (id === "event-stream-runtime") {
		const runtime = functionReady(api, "createEventStreamRuntime") ? api.createEventStreamRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.connectEvents === "function" && typeof runtime.applyNotification === "function" && typeof runtime.resumeMobileSession === "function" && typeof runtime.scrollConversationToBottom === "function" && typeof runtime.updateScrollToBottomButton === "function" && typeof globalThis.CodexEventStreamRuntime === "object" && typeof globalThis.CodexEventStreamRuntime.createEventStreamRuntime === "function" && typeof globalThis.upsertItem === "function" && typeof globalThis.connectEvents === "function" && typeof globalThis.ensureEventConnection === "function" && typeof globalThis.resumeMobileSession === "function" && typeof globalThis.followThreadOpenToBottom === "function" && typeof globalThis.scheduleBottomFollowScroll === "function" && typeof globalThis.updateScrollToBottomButton === "function",
			factoryType: typeof api.createEventStreamRuntime,
			connectType: typeof (runtime && runtime.connectEvents),
			notificationType: typeof (runtime && runtime.applyNotification),
			resumeType: typeof (runtime && runtime.resumeMobileSession),
			scrollType: typeof (runtime && runtime.scrollConversationToBottom),
			globalConnectType: typeof globalThis.connectEvents,
			globalFollowType: typeof globalThis.followThreadOpenToBottom
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
