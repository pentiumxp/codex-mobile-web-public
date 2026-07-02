import { n as __toESM, t as __commonJSMin } from "./rolldown-runtime-FDOR9p9I.js";
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
//#region public/media-preview-runtime.js
var require_media_preview_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function attachMediaPreviewRuntime(root) {
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
		function defaultEscapeHtml(value) {
			return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
		}
		function createMediaPreviewRuntime(deps = {}) {
			const state = deps.state || {};
			const $ = typeof deps.$ === "function" ? deps.$ : () => null;
			const document = deps.document || root.document || {};
			const window = deps.window || root.window || root;
			const fetch = typeof deps.fetch === "function" ? deps.fetch : typeof root.fetch === "function" ? root.fetch.bind(root) : async () => {
				throw new Error("fetch unavailable");
			};
			const FileReader = deps.FileReader || root.FileReader;
			const requestAnimationFrame = typeof deps.requestAnimationFrame === "function" ? deps.requestAnimationFrame : typeof root.requestAnimationFrame === "function" ? root.requestAnimationFrame.bind(root) : defaultRequestAnimationFrame;
			const CLIENT_BUILD_ID = String(deps.CLIENT_BUILD_ID || "");
			const FILE_PREVIEW_SWIPE_CLOSE_MIN_PX = Number(deps.FILE_PREVIEW_SWIPE_CLOSE_MIN_PX || 62);
			const GITHUB_LINK_PREVIEW_TIMEOUT_MS = Number(deps.GITHUB_LINK_PREVIEW_TIMEOUT_MS || 12e3);
			const IMAGE_DIAGNOSTICS_ENABLED = deps.IMAGE_DIAGNOSTICS_ENABLED === true;
			const IMAGE_PREVIEW_MAX_SCALE = Number(deps.IMAGE_PREVIEW_MAX_SCALE || 4);
			const IMAGE_PREVIEW_MIN_SCALE = Number(deps.IMAGE_PREVIEW_MIN_SCALE || .5);
			const IMAGE_PREVIEW_ZOOM_STEP = Number(deps.IMAGE_PREVIEW_ZOOM_STEP || .25);
			const MERMAID_MAX_SCALE = Number(deps.MERMAID_MAX_SCALE || 3.2);
			const MERMAID_MIN_SCALE = Number(deps.MERMAID_MIN_SCALE || .65);
			const MERMAID_SCRIPT_URL = String(deps.MERMAID_SCRIPT_URL || "/vendor/mermaid.min.js");
			const MERMAID_ZOOM_STEP = Number(deps.MERMAID_ZOOM_STEP || .2);
			const PERF_EVENT_THROTTLE_MS = Number(deps.PERF_EVENT_THROTTLE_MS || 2e3);
			const PROTECTED_IMAGE_PLACEHOLDER_SRC = String(deps.PROTECTED_IMAGE_PLACEHOLDER_SRC || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==");
			const githubLinkPreviewCache = deps.githubLinkPreviewCache || /* @__PURE__ */ new Map();
			const { api = async () => ({}), compactStructuredForSignature = (value) => JSON.stringify(value), copyButtonHtml = noopString, diagnosticItemHash = (value) => String(value || ""), escapeHtml = defaultEscapeHtml, isHermesEmbedMode = noopFalse, isIosWebKitBrowser = noopFalse, normalizeFsPath = (value) => String(value || "").replace(/\\/g, "\\"), nowPerfMs = () => Date.now(), postPerformanceEvent = noop, primaryTouch = (event) => event && event.touches && event.touches[0] || null, publishPluginNavigationState = noop, recordHomeAiDiagnosticFailure = noop, recordHomeAiDiagnosticSuccess = noop, rememberCopyText = (value) => String(value || ""), renderContextThreadId = noopString, requestHermesPluginRefresh = noop, roundedDurationMs = (startedAt) => Math.max(0, Date.now() - Number(startedAt || Date.now())), shortPath = (value) => String(value || ""), stableTextHash = (value) => String(value || ""), truncateSingleLine = (value) => String(value || ""), visibleThreadTaskCardCommandText = (value) => String(value || "") } = deps;
			function imageUrlValue(part) {
				if (!part || typeof part !== "object") return "";
				const raw = part.url || part.image_url || part.imageUrl || "";
				if (raw && typeof raw === "object") return String(raw.url || raw.uri || raw.href || "");
				return String(raw || "");
			}
			function isInputTextPart(part) {
				if (!part || typeof part !== "object") return false;
				const type = String(part.type || "");
				return type === "text" || type === "input_text";
			}
			function inputTextValue(part) {
				if (!part || typeof part !== "object") return "";
				if (typeof part.text === "string") return part.text;
				if (typeof part.input_text === "string") return part.input_text;
				if (part.type === "input_text" && typeof part.content === "string") return part.content;
				return "";
			}
			function isInputImagePart(part) {
				if (!part || typeof part !== "object") return false;
				const type = String(part.type || "");
				const url = imageUrlValue(part);
				if (isTruncatedImagePayloadPart(part)) return true;
				return type === "image" || type === "localImage" || type === "input_image" || type === "image_url" || /^data:image\//i.test(url);
			}
			function isTruncatedImagePayloadPart(part) {
				if (!part || typeof part !== "object" || !part.truncated) return false;
				const preview = String(part.preview || "");
				return /data:image\//i.test(preview) || /"type"\s*:\s*"image"/i.test(preview);
			}
			function attachmentSummaryMarkerMatch(source) {
				return /(^|\r?\n)[ \t]*(?:>[ \t]*)?Uploaded attachments:[ \t]*(?:\r?\n|$)/.exec(source);
			}
			function stripAttachmentSummaryLinePrefix(line) {
				return String(line || "").trim().replace(/^>[ \t]?/, "").trim();
			}
			function splitAttachmentSummaryText(text) {
				const source = String(text || "");
				const markerMatch = attachmentSummaryMarkerMatch(source);
				if (!markerMatch) return {
					text: source,
					attachments: []
				};
				const markerStart = markerMatch.index + (markerMatch[1] || "").length;
				const before = source.slice(0, markerStart).trimEnd();
				const attachments = [];
				const remainder = [];
				let parsingAttachments = true;
				for (const line of source.slice(markerMatch.index + markerMatch[0].length).split(/\r?\n/)) {
					const trimmed = stripAttachmentSummaryLinePrefix(line);
					if (parsingAttachments && !trimmed) continue;
					const attachment = parsingAttachments ? parseAttachmentLine(trimmed) : null;
					if (attachment) {
						attachments.push(attachment);
						continue;
					}
					parsingAttachments = false;
					remainder.push(line);
				}
				const after = remainder.join("\n").trimStart();
				return {
					text: [before, after].filter(Boolean).join(before && after ? "\n\n" : ""),
					attachments
				};
			}
			function parseAttachmentLine(line) {
				const match = /^-\s*(.*?)\s*\((.*?)\):\s*(.+)$/.exec(String(line || ""));
				if (!match) return null;
				const meta = match[2] || "";
				return {
					name: match[1] || "attachment",
					meta,
					path: (match[3] || "").trim(),
					isImage: /\bimage\b/i.test(meta)
				};
			}
			function codexMobileUploadIdForPath(filePath) {
				const text = String(filePath || "").trim().replace(/^\\\\\?\\/, "").replace(/\\/g, "/").replace(/\/+$/, "");
				if (!text) return "";
				const index = text.toLowerCase().indexOf("/.codex-mobile-web/uploads/");
				if (index < 0) return "";
				const id = text.slice(index + 27).replace(/^\/+/, "");
				if (!id || /^[a-zA-Z]:/.test(id) || id.split("/").some((part) => !part || part === "." || part === "..")) return "";
				return id;
			}
			function uploadFileUrl(filePath) {
				const uploadId = codexMobileUploadIdForPath(filePath);
				const params = uploadId ? new URLSearchParams({ id: uploadId }) : new URLSearchParams({ path: filePath });
				if (state.key) params.set("key", state.key);
				return authenticatedApiContentUrl(`/api/uploads/file?${params.toString()}`);
			}
			function isCodexMobileUploadPath(filePath) {
				return normalizeFsPath(filePath).includes("\\.codex-mobile-web\\uploads\\");
			}
			function imageContentUrlForPath(filePath, options = {}) {
				if (!filePath) return "";
				return isCodexMobileUploadPath(filePath) ? uploadFileUrl(filePath) : localFilePreviewContentUrl(filePath, options);
			}
			function localAttachmentPreviewUrl(attachment) {
				const value = String(attachment && (attachment.previewUrl || attachment.objectUrl || attachment.localUrl) || "").trim();
				return /^(blob:|data:image\/)/i.test(value) ? value : "";
			}
			function imageSourceForPart(part, attachment = null) {
				const previewUrl = localAttachmentPreviewUrl(attachment);
				if (previewUrl) return previewUrl;
				if (attachment && attachment.path && isLikelyAbsoluteLocalPath(attachment.path)) return imageContentUrlForPath(attachment.path);
				if (part.path) return imageContentUrlForPath(part.path);
				const url = imageUrlValue(part);
				if (isLikelyAbsoluteLocalPath(url)) return imageContentUrlForPath(url);
				return url || "";
			}
			function isLikelyAbsoluteLocalPath(value) {
				const text = String(value || "").trim();
				return /^[a-zA-Z]:[\\/]/.test(text) || /^\\\\/.test(text) || text.startsWith("/");
			}
			function canRenderImageAttachment(attachment) {
				return Boolean(attachment && attachment.isImage && isLikelyAbsoluteLocalPath(attachment.path));
			}
			function isInjectedThreadTaskCardMessage(text) {
				const value = String(text || "").trimStart();
				return value.startsWith("[Cross-thread task card sent by source thread]") || value.startsWith("[Cross-thread task card approved]") || value.startsWith("[Codex Mobile task-card continuation]") || /^#\s*Continuation Bootstrap Index\b/i.test(value);
			}
			function injectedThreadTaskCardLineValue(lines, label) {
				const pattern = new RegExp(`^\\s*(?:[-*]\\s*)?${label}:\\s*`, "i");
				const line = (Array.isArray(lines) ? lines : []).find((entry) => pattern.test(entry));
				return line ? line.replace(pattern, "").trim() : "";
			}
			function injectedThreadTaskCardPurpose(lines) {
				const firstLine = String(Array.isArray(lines) ? lines[0] || "" : "").trim();
				if (/^#\s*Continuation Bootstrap Index\b/i.test(firstLine)) return "Continuation Bootstrap Index";
				if (/^\[Codex Mobile task-card continuation\]/i.test(firstLine)) return injectedThreadTaskCardLineValue(lines, "Title") || "Task-card continuation";
				const title = injectedThreadTaskCardLineValue(lines, "Title");
				if (title) return title;
				const bodyLine = (Array.isArray(lines) ? lines : []).find((line) => {
					const text = String(line || "").trim();
					return text && !text.startsWith("[Cross-thread task card") && !text.startsWith("[Codex Mobile task-card continuation]") && !/^#\s*Continuation Bootstrap Index\b/i.test(text) && !/^(?:[-*]\s*)?(Source workspace|Source thread|Source thread id|Source thread title|Approval|Workflow mode|Workflow id|Auto-return|Continuation Target|Source Thread|Workspace Context Files):/i.test(text);
				});
				return bodyLine ? bodyLine.replace(/^#+\s*/, "").trim() : "Cross-thread task card";
			}
			function injectedThreadTaskCardMetadata(text) {
				const value = String(text || "").replace(/\r\n?/g, "\n").trim();
				const lines = value.split("\n");
				return {
					value,
					source: injectedThreadTaskCardLineValue(lines, "Source thread") || injectedThreadTaskCardLineValue(lines, "Source thread title") || injectedThreadTaskCardLineValue(lines, "Source thread id") || (/^#\s*Continuation Bootstrap Index\b/i.test(value) ? "Continuation" : "source thread"),
					purpose: injectedThreadTaskCardPurpose(lines),
					charCount: value.length.toLocaleString()
				};
			}
			function injectedThreadTaskCardSummary(text) {
				const metadata = injectedThreadTaskCardMetadata(text);
				return `来源：${truncateSingleLine(metadata.source, 72)} · 目的：${truncateSingleLine(metadata.purpose, 96)}`;
			}
			function injectedThreadTaskCardTextForItem(item) {
				if (!item || item.type !== "userMessage") return "";
				const content = Array.isArray(item.content) ? item.content : [];
				for (const part of content) {
					if (!part) continue;
					const text = isInputTextPart(part) ? inputTextValue(part) : "";
					if (isInjectedThreadTaskCardMessage(text)) return text;
				}
				return "";
			}
			function renderInjectedThreadTaskCardBody(text, metadata = null) {
				const details = metadata || injectedThreadTaskCardMetadata(text);
				if (!isInjectedThreadTaskCardMessage(details.value)) return "";
				return `<details class="thread-task-card-message" data-thread-task-card-message>
    <summary><span>完整任务卡</span><small>${escapeHtml(`${details.charCount} chars`)}</small></summary>
    <pre class="thread-task-card-message-body">${escapeHtml(details.value)}</pre>
  </details>`;
			}
			function renderInjectedThreadTaskCardMessage(text) {
				const metadata = injectedThreadTaskCardMetadata(text);
				if (!isInjectedThreadTaskCardMessage(metadata.value)) return "";
				return `<div class="thread-task-card-message-standalone" data-thread-task-card-standalone>
    <div class="thread-task-card-message-overview">
      <div><span>来源</span><strong>${escapeHtml(metadata.source)}</strong></div>
      <div><span>目的</span><strong>${escapeHtml(metadata.purpose)}</strong></div>
    </div>
    ${renderInjectedThreadTaskCardBody(metadata.value, metadata)}
  </div>`;
			}
			function renderInputText(text) {
				if (!String(text || "").trim()) return "";
				const taskCardMessage = renderInjectedThreadTaskCardMessage(text);
				if (taskCardMessage) return taskCardMessage;
				return `<div class="input-text">${escapeHtml(text)}</div>`;
			}
			function renderInputImage(part, attachment = null, index = 0) {
				const src = imageSourceForPart(part, attachment);
				const label = attachment && attachment.name || shortPath(part.path || imageUrlValue(part) || "") || `Image ${index + 1}`;
				if (!src) return `<div class="input-attachment">${escapeHtml(label)}</div>`;
				const displaySrc = protectedImageDisplaySrc(src);
				return `<figure class="input-image">
    <img src="${escapeHtml(displaySrc)}" alt="Image" loading="${imageLoadingModeForSource(src)}"${protectedImageSourceAttribute(src)}>
  </figure>`;
			}
			function renderInputAttachment(attachment) {
				const label = attachment.name || shortPath(attachment.path) || "attachment";
				const meta = attachment.meta ? ` (${attachment.meta})` : "";
				return `<div class="input-attachment">
    <span>${escapeHtml(label)}</span>
    <span>${escapeHtml(meta)}</span>
    ${attachment.path ? `<code>${escapeHtml(attachment.path)}</code>` : ""}
  </div>`;
			}
			function renderAttachmentSummary(attachments, imageParts = []) {
				const html = [];
				const imageAttachments = (attachments || []).filter((attachment) => attachment.isImage);
				const parts = Array.isArray(imageParts) ? imageParts : [];
				parts.forEach((part, index) => {
					html.push(renderInputImage(part, imageAttachments[index] || null, index));
				});
				const renderedImageAttachments = /* @__PURE__ */ new Set();
				if (!parts.length) imageAttachments.filter(canRenderImageAttachment).forEach((attachment, index) => {
					renderedImageAttachments.add(attachment);
					html.push(renderInputImage({ path: attachment.path }, attachment, index));
				});
				(attachments || []).filter((attachment) => !renderedImageAttachments.has(attachment) && (!attachment.isImage || !parts.length)).forEach((attachment) => html.push(renderInputAttachment(attachment)));
				return html.join("");
			}
			function renderInputContent(content) {
				const parts = content || [];
				const imageParts = parts.filter(isInputImagePart);
				const attachments = [];
				const html = [];
				for (const part of parts) {
					if (!part || isInputImagePart(part)) continue;
					if (isInputTextPart(part)) {
						const split = splitAttachmentSummaryText(visibleThreadTaskCardCommandText(inputTextValue(part)));
						if (split.text) html.push(renderInputText(split.text));
						attachments.push(...split.attachments);
						continue;
					}
					html.push(`<div class="input-text">${escapeHtml(compactStructuredForSignature(part))}</div>`);
				}
				html.push(renderAttachmentSummary(attachments, imageParts));
				return html.join("");
			}
			function renderMarkdown(value, markdownOptions = {}) {
				const renderer = window.CodexMarkdownRenderer;
				if (!renderer || typeof renderer.renderMarkdown !== "function") return `<div class="markdown-body"><p>${escapeHtml(value || "")}</p></div>`;
				return renderer.renderMarkdown(value, {
					rememberCopyText,
					copyButtonHtml,
					...markdownOptions
				});
			}
			function renderMarkdownWithAttachmentSummary(value) {
				const split = splitAttachmentSummaryText(value || "");
				if (!split.attachments.length) return renderMarkdown(value || "", { fencedTableMode: "preview" });
				return [split.text ? renderMarkdown(split.text, { fencedTableMode: "preview" }) : "", renderAttachmentSummary(split.attachments)].filter(Boolean).join("");
			}
			function commandOutputBody(value) {
				const text = String(value || "").replace(/\r\n?/g, "\n").trim();
				if (!text) return "";
				const markerIndex = text.indexOf("\nOutput:\n");
				if (markerIndex < 0) return text;
				return text.slice(markerIndex + 9).trim();
			}
			function stripCommandOutputLineNumbers(value) {
				const text = String(value || "");
				if (!text) return "";
				const lines = text.split("\n");
				const numberedCount = lines.filter((line) => /^\s*\d+\t/.test(line)).length;
				if (numberedCount < 3 || numberedCount < Math.ceil(lines.length * .4)) return text;
				return lines.map((line) => line.replace(/^\s*\d+\t/, "")).join("\n");
			}
			function isMarkdownTableSeparatorLine(line) {
				const cells = String(line || "").trim().replace(/^\||\|$/g, "").split("|");
				return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
			}
			function containsMarkdownTable(value) {
				const lines = String(value || "").split("\n");
				for (let index = 0; index < lines.length - 1; index += 1) {
					if (!lines[index].includes("|")) continue;
					if (isMarkdownTableSeparatorLine(lines[index + 1])) return true;
				}
				return false;
			}
			function commandOutputMarkdownPreview(value, item = {}) {
				if (!value || item.type !== "commandExecution") return "";
				const body = stripCommandOutputLineNumbers(commandOutputBody(value));
				if (!containsMarkdownTable(body)) return "";
				return body;
			}
			function normalizeGitHubLinkPreview(value) {
				if (!value || typeof value !== "object") return null;
				const preview = value.preview && typeof value.preview === "object" ? value.preview : null;
				if (!preview || !value.supported) return null;
				const url = String(preview.url || value.url || "").trim();
				if (!url) return null;
				return {
					provider: "github",
					kind: String(preview.kind || "").trim(),
					kindLabel: String(preview.kindLabel || "GitHub").trim() || "GitHub",
					url,
					title: String(preview.title || "").trim(),
					subtitle: String(preview.subtitle || "").trim(),
					description: String(preview.description || "").trim(),
					meta: String(preview.meta || "").trim(),
					avatarUrl: String(preview.avatarUrl || "").trim(),
					accent: String(preview.accent || "").trim(),
					state: String(preview.state || "").trim(),
					stateLabel: String(preview.stateLabel || "").trim()
				};
			}
			function normalizeGithubPreviewUrl(value) {
				let parsed;
				try {
					parsed = new URL(String(value || "").trim());
				} catch (_) {
					return "";
				}
				const host = String(parsed.hostname || "").toLowerCase();
				if (host !== "github.com" && host !== "www.github.com") return "";
				if (parsed.protocol !== "https:") return "";
				return parsed.toString();
			}
			function gitHubLinkPreviewAccentClass(value) {
				const accent = String(value || "").trim().toLowerCase();
				if (accent === "open" || accent === "closed" || accent === "merged" || accent === "repo" || accent === "commit" || accent === "muted") return accent;
				return "muted";
			}
			function renderGitHubLinkPreviewCard(preview) {
				const accent = gitHubLinkPreviewAccentClass(preview && preview.accent);
				const statePill = preview && preview.stateLabel ? `<span class="github-link-card-state state-${escapeHtml(gitHubLinkPreviewAccentClass(preview.state || accent))}">${escapeHtml(preview.stateLabel)}</span>` : "";
				const avatar = preview && preview.avatarUrl ? `<img class="github-link-card-avatar" src="${escapeHtml(preview.avatarUrl)}" alt="" loading="lazy">` : `<span class="github-link-card-avatar github-link-card-avatar-fallback" aria-hidden="true">GH</span>`;
				const subtitle = preview && preview.subtitle ? `<div class="github-link-card-subtitle">${escapeHtml(preview.subtitle)}</div>` : "";
				const description = preview && preview.description ? `<div class="github-link-card-description">${escapeHtml(preview.description)}</div>` : "";
				const meta = preview && preview.meta ? `<div class="github-link-card-meta">${escapeHtml(preview.meta)}</div>` : "";
				return `<a class="github-link-card github-link-card-${escapeHtml(accent)}" href="${escapeHtml(preview.url)}" target="_blank" rel="noreferrer">
    <div class="github-link-card-head">
      <span class="github-link-card-badge">GitHub</span>
      <span class="github-link-card-kind">${escapeHtml(preview.kindLabel || "GitHub")}</span>
      ${statePill}
    </div>
    <div class="github-link-card-body">
      ${avatar}
      <div class="github-link-card-copy">
        <div class="github-link-card-title">${escapeHtml(preview.title || preview.url)}</div>
        ${subtitle}
        ${description}
        ${meta}
      </div>
    </div>
  </a>`;
			}
			async function fetchGitHubLinkPreview(url) {
				const cacheKey = String(url || "").trim();
				if (!cacheKey) return null;
				const cached = githubLinkPreviewCache.get(cacheKey);
				if (cached && cached.value) return cached.value;
				if (cached && cached.promise) return cached.promise;
				const promise = api(`/api/link-previews/github?url=${encodeURIComponent(cacheKey)}`, { timeoutMs: GITHUB_LINK_PREVIEW_TIMEOUT_MS }).then((value) => {
					const preview = normalizeGitHubLinkPreview(value);
					githubLinkPreviewCache.set(cacheKey, { value: preview });
					return preview;
				}).catch((err) => {
					githubLinkPreviewCache.delete(cacheKey);
					throw err;
				});
				githubLinkPreviewCache.set(cacheKey, { promise });
				return promise;
			}
			function githubLinkPreviewHosts(root = document) {
				if (!root || typeof root.querySelectorAll !== "function") return [];
				const hosts = [];
				const seen = /* @__PURE__ */ new Set();
				const push = (node) => {
					if (!node || seen.has(node)) return;
					seen.add(node);
					hosts.push(node);
				};
				if (typeof root.matches === "function" && root.matches(".item-body, #filePreviewBody")) push(root);
				root.querySelectorAll(".item-body, #filePreviewBody").forEach(push);
				return hosts;
			}
			function gitHubLinkPreviewSummary(url) {
				let parsed;
				try {
					parsed = new URL(String(url || "").trim());
				} catch (_) {
					return {
						repo: "GitHub",
						detail: "链接"
					};
				}
				const parts = parsed.pathname.split("/").filter(Boolean);
				const repo = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : "GitHub";
				let detail = "Repository";
				if (parts[2] === "issues" && parts[3]) detail = parsed.hash.startsWith("#issuecomment-") ? `#${parts[3]} comment` : `Issue #${parts[3]}`;
				else if (parts[2] === "pull" && parts[3]) detail = `PR #${parts[3]}`;
				else if (parts[2] === "commit" && parts[3]) detail = `Commit ${parts[3].slice(0, 7)}`;
				return {
					repo,
					detail
				};
			}
			function gitHubLinkPreviewInlineHost(link) {
				if (!link || typeof link.closest !== "function") return null;
				return link.closest("li, td, th, p");
			}
			function gitHubLinkPreviewInsertContainer(inlineHost) {
				if (!inlineHost) return null;
				if (inlineHost.tagName !== "P") return inlineHost;
				const next = inlineHost.nextElementSibling;
				if (next && next.matches && next.matches("[data-github-link-preview-node=\"true\"]")) return next;
				inlineHost.insertAdjacentHTML("afterend", `<span class="github-link-preview-node" data-github-link-preview-node="true"></span>`);
				return inlineHost.nextElementSibling;
			}
			function renderCollapsedGitHubLinkPreview(url) {
				const summary = gitHubLinkPreviewSummary(url);
				return `<span class="github-link-preview-inline" data-github-link-preview-inline="true">
    <button type="button" class="github-link-card-compact" data-github-link-preview-expand="true" aria-expanded="false" aria-label="预览 GitHub 链接">
      <span class="github-link-card-compact-badge">GitHub</span>
      <span class="github-link-card-compact-title">${escapeHtml(summary.detail)} · ${escapeHtml(summary.repo)}</span>
      <span class="github-link-card-compact-action">预览</span>
    </button>
    <span class="github-link-card-shell github-link-card-shell-deferred" hidden data-github-link-preview-url="${escapeHtml(url)}" data-github-link-preview-deferred="true">
      <span class="github-link-card-placeholder">正在加载 GitHub 预览...</span>
    </span>
  </span>`;
			}
			function ensureInlineGitHubLinkPreviews(root = document) {
				githubLinkPreviewHosts(root).forEach((host) => {
					host.querySelectorAll("a[href]").forEach((link) => {
						if (!link || typeof link.closest !== "function") return;
						if (link.dataset.githubLinkPreviewAttached === "true") return;
						if (link.closest(".github-link-card") || link.closest(".github-link-card-shell") || link.closest("[data-github-link-preview-inline]")) return;
						if (link.closest("pre") || link.closest("code")) return;
						const url = normalizeGithubPreviewUrl(link.getAttribute("href") || link.href || "");
						if (!url) return;
						const inlineHost = gitHubLinkPreviewInlineHost(link);
						if (!inlineHost) return;
						const insertContainer = gitHubLinkPreviewInsertContainer(inlineHost);
						if (!insertContainer) return;
						link.dataset.githubLinkPreviewAttached = "true";
						insertContainer.insertAdjacentHTML("beforeend", renderCollapsedGitHubLinkPreview(url));
					});
				});
			}
			function renderGitHubLinkPreviewUnavailable(url, label = "无法加载 GitHub 预览") {
				const href = normalizeGithubPreviewUrl(url) || String(url || "").trim();
				const link = href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">打开链接</a>` : "";
				return `<span class="github-link-card-unavailable">${escapeHtml(label)}${link ? ` · ${link}` : ""}</span>`;
			}
			function setGitHubPreviewCompactExpanded(button, expanded) {
				if (!button) return;
				button.classList.toggle("expanded", Boolean(expanded));
				button.setAttribute("aria-expanded", expanded ? "true" : "false");
				const action = button.querySelector(".github-link-card-compact-action");
				if (action) action.textContent = expanded ? "收起" : "预览";
			}
			function updateGitHubPreviewCompactTitle(slot, preview) {
				if (!slot || !preview || !preview.title) return;
				const wrapper = slot.closest ? slot.closest("[data-github-link-preview-inline]") : null;
				const title = wrapper ? wrapper.querySelector(".github-link-card-compact-title") : null;
				if (!title) return;
				title.textContent = `${preview.kindLabel ? `${preview.kindLabel} · ` : ""}${preview.title}`;
			}
			function toggleGitHubLinkPreview(button) {
				const wrapper = button && button.closest ? button.closest("[data-github-link-preview-inline]") : null;
				if (!wrapper) return;
				const slot = wrapper.querySelector(".github-link-card-shell[data-github-link-preview-url]");
				if (!slot) return;
				if (wrapper.dataset.githubLinkPreviewExpanded === "true") {
					wrapper.dataset.githubLinkPreviewExpanded = "false";
					setGitHubPreviewCompactExpanded(button, false);
					slot.hidden = true;
					slot.classList.add("github-link-card-shell-deferred");
					slot.dataset.githubLinkPreviewDeferred = "true";
					return;
				}
				wrapper.dataset.githubLinkPreviewExpanded = "true";
				setGitHubPreviewCompactExpanded(button, true);
				slot.hidden = false;
				slot.classList.remove("github-link-card-shell-deferred");
				delete slot.dataset.githubLinkPreviewDeferred;
				hydrateGitHubLinkCard(slot).catch(() => {});
			}
			async function hydrateGitHubLinkCard(slot) {
				if (!slot || !slot.dataset) return;
				if (typeof slot.matches === "function" && !slot.matches(".github-link-card-shell[data-github-link-preview-url]")) return;
				const url = String(slot.dataset.githubLinkPreviewUrl || "").trim();
				if (!url) return;
				if (slot.dataset.githubLinkPreviewState === "done") return;
				if (slot.dataset.githubLinkPreviewState === "loading") return;
				slot.dataset.githubLinkPreviewState = "loading";
				slot.classList.add("loading");
				try {
					const preview = await fetchGitHubLinkPreview(url);
					if (!preview) {
						slot.innerHTML = renderGitHubLinkPreviewUnavailable(url);
						slot.dataset.githubLinkPreviewState = "unsupported";
						slot.classList.remove("loading");
						return;
					}
					slot.innerHTML = renderGitHubLinkPreviewCard(preview);
					updateGitHubPreviewCompactTitle(slot, preview);
					slot.dataset.githubLinkPreviewState = "done";
					slot.classList.remove("loading");
				} catch (_) {
					slot.innerHTML = renderGitHubLinkPreviewUnavailable(url);
					slot.dataset.githubLinkPreviewState = "error";
					slot.classList.remove("loading");
				}
			}
			function hydrateGitHubLinkCards(root = document) {
				if (!root || typeof root.querySelectorAll !== "function") return;
				const startedAt = nowPerfMs();
				ensureInlineGitHubLinkPreviews(root);
				const slots = Array.from(root.querySelectorAll("[data-github-link-preview-url]:not([data-github-link-preview-deferred=\"true\"])"));
				slots.forEach((slot) => {
					hydrateGitHubLinkCard(slot).catch(() => {});
				});
				const inlineCount = root.querySelectorAll("[data-github-link-preview-inline='true']").length;
				if (slots.length || inlineCount) postPerformanceEvent("github_cards_hydrate_ms", {
					hydrateElapsedMs: roundedDurationMs(startedAt),
					queuedCards: slots.length,
					inlineCards: inlineCount,
					rootId: root && root.id || "",
					threadId: state.currentThreadId || ""
				}, {
					key: `github_cards_hydrate_ms|${root && root.id || "root"}`,
					minIntervalMs: PERF_EVENT_THROTTLE_MS
				});
			}
			function mermaidEffectiveTheme() {
				const preferred = String(document.documentElement.getAttribute("data-theme") || "system").trim().toLowerCase();
				if (preferred === "dark" || preferred === "light") return preferred;
				return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
			}
			function mermaidThemeName() {
				return mermaidEffectiveTheme() === "dark" ? "dark" : "default";
			}
			function mermaidConfig() {
				return {
					startOnLoad: false,
					securityLevel: "strict",
					theme: mermaidThemeName(),
					fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
					flowchart: {
						useMaxWidth: false,
						htmlLabels: true
					}
				};
			}
			function mermaidPreviewOpen() {
				const dialog = $("mermaidPreviewDialog");
				return Boolean(dialog && !dialog.classList.contains("hidden"));
			}
			function loadRuntimeScript(src, globalName) {
				const existing = document.querySelector(`script[data-runtime-script="${src}"]`);
				if (existing) {
					if (!globalName || window[globalName]) return Promise.resolve(window[globalName] || true);
					return new Promise((resolve, reject) => {
						existing.addEventListener("load", () => resolve(window[globalName] || true), { once: true });
						existing.addEventListener("error", () => reject(/* @__PURE__ */ new Error(`Failed to load ${src}`)), { once: true });
					});
				}
				return new Promise((resolve, reject) => {
					const script = document.createElement("script");
					script.src = src;
					script.async = true;
					script.dataset.runtimeScript = src;
					script.onload = () => resolve(globalName ? window[globalName] : true);
					script.onerror = () => reject(/* @__PURE__ */ new Error(`Failed to load ${src}`));
					document.head.appendChild(script);
				});
			}
			function configureMermaidApi(mermaidApi, options = {}) {
				if (!mermaidApi || typeof mermaidApi.initialize !== "function") return null;
				const theme = mermaidThemeName();
				if (!options.force && state.mermaidTheme === theme) return mermaidApi;
				mermaidApi.initialize(mermaidConfig());
				state.mermaidTheme = theme;
				return mermaidApi;
			}
			async function ensureMermaidApi() {
				if (window.mermaid && typeof window.mermaid.render === "function") return configureMermaidApi(window.mermaid, { force: !state.mermaidTheme });
				if (state.mermaidLoadPromise) return state.mermaidLoadPromise;
				state.mermaidLoadPromise = loadRuntimeScript(MERMAID_SCRIPT_URL, "mermaid").then((mermaidApi) => {
					if (!mermaidApi || typeof mermaidApi.render !== "function") throw new Error("Mermaid runtime unavailable");
					return configureMermaidApi(mermaidApi, { force: true });
				}).catch((err) => {
					state.mermaidLoadPromise = null;
					throw err;
				});
				return state.mermaidLoadPromise;
			}
			function mermaidCanvas(container) {
				return container ? container.querySelector("[data-mermaid-canvas]") : null;
			}
			function mermaidViewer(container) {
				return container ? container.querySelector("[data-mermaid-viewer]") : null;
			}
			function mermaidSourceFromContainer(container) {
				const source = container && container.querySelector(".markdown-mermaid-source");
				return source ? String(source.textContent || "") : String(container && container.dataset && container.dataset.mermaidSource || "");
			}
			function mermaidResetButton(container) {
				return container ? container.querySelector("[data-mermaid-action='reset']") : null;
			}
			function updateMermaidResetLabel(container, scale) {
				const button = mermaidResetButton(container);
				if (button) button.textContent = `${Math.round(scale * 100)}%`;
			}
			function clampMermaidScale(scale) {
				if (!Number.isFinite(scale)) return 1;
				return Math.min(MERMAID_MAX_SCALE, Math.max(MERMAID_MIN_SCALE, scale));
			}
			function mermaidCurrentScale(container) {
				return clampMermaidScale(Number(container && container.dataset ? container.dataset.mermaidScale || 1 : 1));
			}
			function mermaidSvgSize(svg) {
				if (!svg) return {
					width: 640,
					height: 360
				};
				const viewBox = svg.viewBox && svg.viewBox.baseVal;
				const width = Number(viewBox && viewBox.width || svg.getAttribute("width") || 0);
				const height = Number(viewBox && viewBox.height || svg.getAttribute("height") || 0);
				return {
					width: width > 0 ? width : 640,
					height: height > 0 ? height : 360
				};
			}
			function mermaidInitialScale(container, baseWidth) {
				const viewerEl = mermaidViewer(container);
				const fitWidth = viewerEl ? Math.max(0, viewerEl.clientWidth - 32) : 0;
				if (!fitWidth || !Number.isFinite(baseWidth) || baseWidth <= 0 || baseWidth <= fitWidth) return 1;
				return clampMermaidScale(fitWidth / baseWidth);
			}
			function applyMermaidScale(container, scale, options = {}) {
				const canvas = mermaidCanvas(container);
				const artboard = canvas && canvas.querySelector(".markdown-mermaid-artboard");
				if (!canvas || !artboard) return;
				const previousScale = mermaidCurrentScale(container);
				const nextScale = clampMermaidScale(scale);
				const baseWidth = Number(artboard.dataset.baseWidth || 0) || 640;
				const baseHeight = Number(artboard.dataset.baseHeight || 0) || 360;
				artboard.style.width = `${Math.max(180, Math.round(baseWidth * nextScale))}px`;
				artboard.style.height = `${Math.max(120, Math.round(baseHeight * nextScale))}px`;
				container.dataset.mermaidScale = String(nextScale);
				updateMermaidResetLabel(container, nextScale);
				if (options.viewer && Number.isFinite(options.anchorX) && Number.isFinite(options.anchorY) && Number.isFinite(options.contentX) && Number.isFinite(options.contentY) && previousScale > 0 && nextScale > 0) requestAnimationFrame(() => {
					options.viewer.scrollLeft = Math.max(0, options.contentX * nextScale - options.anchorX);
					options.viewer.scrollTop = Math.max(0, options.contentY * nextScale - options.anchorY);
				});
			}
			function showMermaidLoading(container, message = "正在渲染 Mermaid 图...") {
				const canvas = mermaidCanvas(container);
				if (!canvas) return;
				canvas.innerHTML = `<div class="markdown-mermaid-loading">${escapeHtml(message)}</div>`;
				updateMermaidResetLabel(container, 1);
			}
			function showMermaidError(container, sourceText, err) {
				const canvas = mermaidCanvas(container);
				if (canvas) {
					const message = err && err.message ? err.message : String(err || "Mermaid render failed");
					canvas.innerHTML = `<div class="markdown-mermaid-error">Mermaid 渲染失败<br>${escapeHtml(message)}</div>`;
				}
				const sourceDetails = container && container.querySelector(".markdown-mermaid-source-details");
				if (sourceDetails) sourceDetails.open = true;
				const previewSource = $("mermaidPreviewSource");
				if (previewSource && mermaidPreviewOpen() && container === $("mermaidPreviewDialog")) previewSource.textContent = sourceText || "";
			}
			function isMermaidErrorSvgMarkup(svgMarkup) {
				const text = String(svgMarkup || "");
				return /class=["'][^"']*\berror-icon\b/.test(text) || /class=["'][^"']*\berror-text\b/.test(text) || /Syntax error in text/.test(text);
			}
			function mermaidRenderArtifactIds(renderId) {
				const id = String(renderId || "").trim();
				return id ? [
					id,
					`d${id}`,
					`i${id}`
				] : [];
			}
			function isOwnedMermaidRenderNode(node) {
				return Boolean(node && node.closest && (node.closest("[data-mermaid-block='true']") || node.closest("#mermaidPreviewDialog") || node.closest(".markdown-mermaid-artboard")));
			}
			function removeNodeIfExternalMermaidArtifact(node) {
				if (!node || !node.remove || isOwnedMermaidRenderNode(node)) return false;
				node.remove();
				return true;
			}
			function cleanupMermaidRenderArtifacts(renderId) {
				mermaidRenderArtifactIds(renderId).forEach((id) => {
					removeNodeIfExternalMermaidArtifact(document.getElementById(id));
				});
			}
			function cleanupExternalMermaidErrorArtifacts(root = document) {
				(root && root.querySelectorAll ? root : document).querySelectorAll("svg .error-icon, svg .error-text").forEach((node) => {
					const svg = node.closest && node.closest("svg");
					removeNodeIfExternalMermaidArtifact(svg && svg.parentElement && /^d?codex-mobile-mermaid-/.test(String(svg.parentElement.id || "")) ? svg.parentElement : svg);
				});
			}
			function renderMermaidSvg(container, svgMarkup, options = {}) {
				const canvas = mermaidCanvas(container);
				if (!canvas) return;
				if (isMermaidErrorSvgMarkup(svgMarkup)) throw new Error("Mermaid syntax error");
				const artboard = document.createElement("div");
				artboard.className = "markdown-mermaid-artboard";
				artboard.innerHTML = String(svgMarkup || "");
				const svg = artboard.querySelector("svg");
				if (!svg) throw new Error("Mermaid SVG missing");
				if (svg.querySelector(".error-icon, .error-text")) throw new Error("Mermaid syntax error");
				const size = mermaidSvgSize(svg);
				artboard.dataset.baseWidth = String(size.width);
				artboard.dataset.baseHeight = String(size.height);
				svg.removeAttribute("width");
				svg.removeAttribute("height");
				svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
				canvas.innerHTML = "";
				canvas.appendChild(artboard);
				applyMermaidScale(container, mermaidInitialScale(container, size.width));
				if (options.sourceText) {
					const previewSource = $("mermaidPreviewSource");
					if (previewSource && container === $("mermaidPreviewDialog")) previewSource.textContent = options.sourceText;
				}
			}
			function mermaidRenderCandidates(sourceText) {
				const raw = String(sourceText || "");
				const normalizer = window.CodexMarkdownRenderer && typeof window.CodexMarkdownRenderer.normalizeMermaidSourceForRender === "function" ? window.CodexMarkdownRenderer.normalizeMermaidSourceForRender : null;
				const normalized = normalizer ? String(normalizer(raw) || "") : raw;
				if (!normalized || normalized === raw) return [raw];
				return [raw, normalized];
			}
			async function renderMermaidIntoContainer(container, sourceText, options = {}) {
				if (!container || !String(sourceText || "").trim()) return;
				showMermaidLoading(container, options.loadingMessage || "正在渲染 Mermaid 图...");
				const mermaidApi = await ensureMermaidApi();
				configureMermaidApi(mermaidApi);
				const renderId = `codex-mobile-mermaid-${++state.mermaidRenderSeq}`;
				let lastError = null;
				const candidates = mermaidRenderCandidates(sourceText);
				for (let index = 0; index < candidates.length; index += 1) {
					const candidateRenderId = `${renderId}-${index}`;
					try {
						const result = await mermaidApi.render(candidateRenderId, candidates[index]);
						cleanupMermaidRenderArtifacts(candidateRenderId);
						cleanupExternalMermaidErrorArtifacts();
						renderMermaidSvg(container, result && result.svg ? result.svg : "", { sourceText });
						const canvas = mermaidCanvas(container);
						if (canvas && result && typeof result.bindFunctions === "function") result.bindFunctions(canvas);
						return;
					} catch (err) {
						cleanupMermaidRenderArtifacts(candidateRenderId);
						cleanupExternalMermaidErrorArtifacts();
						lastError = err;
					}
				}
				throw lastError || /* @__PURE__ */ new Error("Mermaid render failed");
			}
			function hydrateMermaidBlock(block) {
				const sourceText = mermaidSourceFromContainer(block).trim();
				if (!block || !sourceText) return;
				const currentTheme = mermaidThemeName();
				if (block.dataset.mermaidRendered === "1" && block.dataset.mermaidTheme === currentTheme) return;
				const startedAt = nowPerfMs();
				renderMermaidIntoContainer(block, sourceText).then(() => {
					if (!block.isConnected) return;
					block.dataset.mermaidRendered = "1";
					block.dataset.mermaidTheme = currentTheme;
					postPerformanceEvent("mermaid_hydrate_ms", {
						hydrateElapsedMs: roundedDurationMs(startedAt),
						sourceChars: sourceText.length,
						theme: currentTheme,
						status: "ok",
						threadId: state.currentThreadId || ""
					}, {
						key: "mermaid_hydrate_ms",
						minIntervalMs: PERF_EVENT_THROTTLE_MS
					});
				}).catch((err) => {
					block.dataset.mermaidRendered = "error";
					showMermaidError(block, sourceText, err);
					postPerformanceEvent("mermaid_hydrate_ms", {
						hydrateElapsedMs: roundedDurationMs(startedAt),
						sourceChars: sourceText.length,
						theme: currentTheme,
						status: "error",
						error: err && err.message ? String(err.message).slice(0, 240) : String(err || "").slice(0, 240),
						threadId: state.currentThreadId || ""
					}, {
						key: "mermaid_hydrate_ms",
						minIntervalMs: PERF_EVENT_THROTTLE_MS,
						force: true
					});
				});
			}
			function hydrateMermaidDiagrams(root = document) {
				if (!root || typeof root.querySelectorAll !== "function") return;
				root.querySelectorAll("[data-mermaid-block='true']").forEach((block) => hydrateMermaidBlock(block));
			}
			function rerenderVisibleMermaidDiagrams() {
				document.querySelectorAll("[data-mermaid-block='true']").forEach((block) => {
					block.dataset.mermaidRendered = "";
					block.dataset.mermaidTheme = "";
					hydrateMermaidBlock(block);
				});
				if (mermaidPreviewOpen()) {
					const dialog = $("mermaidPreviewDialog");
					renderMermaidIntoContainer(dialog, mermaidSourceFromContainer(dialog), { loadingMessage: "正在更新 Mermaid 图..." }).catch((err) => showMermaidError(dialog, mermaidSourceFromContainer(dialog), err));
				}
			}
			function installMermaidThemeObserver() {
				if (state.mermaidThemeObserver || !window.MutationObserver) return;
				const observer = new MutationObserver(() => {
					if (state.mermaidTheme && state.mermaidTheme === mermaidThemeName()) return;
					rerenderVisibleMermaidDiagrams();
				});
				observer.observe(document.documentElement, {
					attributes: true,
					attributeFilter: ["data-theme"]
				});
				state.mermaidThemeObserver = observer;
			}
			function mermaidActionContainer(button) {
				return button.closest("[data-mermaid-block='true']") || button.closest("#mermaidPreviewDialog");
			}
			function mermaidContainerFromViewer(viewer) {
				return viewer ? viewer.closest("[data-mermaid-block='true']") || viewer.closest("#mermaidPreviewDialog") : null;
			}
			function resetMermaidScale(container) {
				const canvas = mermaidCanvas(container);
				const artboard = canvas && canvas.querySelector(".markdown-mermaid-artboard");
				if (!artboard) return;
				applyMermaidScale(container, mermaidInitialScale(container, Number(artboard.dataset.baseWidth || 0) || 640));
			}
			function openMermaidPreview(block) {
				const dialog = $("mermaidPreviewDialog");
				const sourceText = mermaidSourceFromContainer(block).trim();
				if (!dialog || !sourceText) return;
				dialog.dataset.mermaidSource = sourceText;
				const previewSource = $("mermaidPreviewSource");
				if (previewSource) previewSource.textContent = sourceText;
				dialog.classList.remove("hidden");
				publishPluginNavigationState({ force: true });
				renderMermaidIntoContainer(dialog, sourceText, { loadingMessage: "正在渲染 Mermaid 图..." }).catch((err) => showMermaidError(dialog, sourceText, err));
			}
			function closeMermaidPreview() {
				const dialog = $("mermaidPreviewDialog");
				if (!dialog) return;
				dialog.classList.add("hidden");
				dialog.dataset.mermaidSource = "";
				const canvas = mermaidCanvas(dialog);
				if (canvas) canvas.innerHTML = `<div class="markdown-mermaid-loading">正在渲染 Mermaid 图...</div>`;
				const previewSource = $("mermaidPreviewSource");
				if (previewSource) previewSource.textContent = "";
				updateMermaidResetLabel(dialog, 1);
				publishPluginNavigationState();
			}
			function handleMermaidAction(button) {
				const action = String(button && button.dataset ? button.dataset.mermaidAction || "" : "");
				const container = mermaidActionContainer(button);
				if (!action || !container) return false;
				if (action === "expand") {
					openMermaidPreview(container);
					return true;
				}
				if (action === "zoom-in") {
					applyMermaidScale(container, mermaidCurrentScale(container) + MERMAID_ZOOM_STEP);
					return true;
				}
				if (action === "zoom-out") {
					applyMermaidScale(container, mermaidCurrentScale(container) - MERMAID_ZOOM_STEP);
					return true;
				}
				if (action === "reset") {
					resetMermaidScale(container);
					return true;
				}
				return false;
			}
			function imagePreviewOpen() {
				const dialog = $("imagePreviewDialog");
				return Boolean(dialog && !dialog.classList.contains("hidden"));
			}
			function imagePreviewScaleLabel(scale = state.imagePreviewScale) {
				return `${Math.round(Number(scale || 1) * 100)}%`;
			}
			function applyImagePreviewScale(scale, options = {}) {
				const dialog = $("imagePreviewDialog");
				const stage = $("imagePreviewStage");
				if (!dialog || !stage) return;
				const previousScale = Number(state.imagePreviewScale || 1);
				const nextScale = Math.max(IMAGE_PREVIEW_MIN_SCALE, Math.min(IMAGE_PREVIEW_MAX_SCALE, Number(scale) || 1));
				const hasAnchor = Number.isFinite(options.anchorX) && Number.isFinite(options.anchorY) && Number.isFinite(options.contentX) && Number.isFinite(options.contentY);
				const keepCenter = !hasAnchor && options.keepCenter !== false && previousScale > 0 && nextScale > 0;
				const centerX = keepCenter ? (stage.scrollLeft + stage.clientWidth / 2) / previousScale : 0;
				const centerY = keepCenter ? (stage.scrollTop + stage.clientHeight / 2) / previousScale : 0;
				state.imagePreviewScale = nextScale;
				dialog.style.setProperty("--image-preview-scale", String(nextScale));
				const reset = $("imagePreviewZoomReset");
				if (reset) reset.textContent = imagePreviewScaleLabel(nextScale);
				if (hasAnchor && previousScale > 0 && nextScale > 0) requestAnimationFrame(() => {
					stage.scrollLeft = Math.max(0, options.contentX * nextScale - options.anchorX);
					stage.scrollTop = Math.max(0, options.contentY * nextScale - options.anchorY);
				});
				else if (keepCenter) requestAnimationFrame(() => {
					stage.scrollLeft = Math.max(0, centerX * nextScale - stage.clientWidth / 2);
					stage.scrollTop = Math.max(0, centerY * nextScale - stage.clientHeight / 2);
				});
			}
			function imagePreviewTitleForImage(image) {
				if (!image) return "图片预览";
				const figure = image.closest ? image.closest("figure, .file-preview-media, .attachment-chip") : null;
				const caption = figure && figure.querySelector ? figure.querySelector("figcaption") : null;
				return [
					caption && caption.textContent,
					image.getAttribute && image.getAttribute("alt"),
					image.getAttribute && image.getAttribute("title")
				].map((value) => String(value || "").trim()).find(Boolean) || "图片预览";
			}
			function openImagePreviewFromImage(image) {
				if (!image || image.closest && image.closest(".image-load-failed")) return false;
				const src = image.currentSrc || image.src || image.getAttribute("src") || "";
				if (!src) return false;
				const dialog = $("imagePreviewDialog");
				const previewImage = $("imagePreviewImage");
				if (!dialog || !previewImage) return false;
				const title = imagePreviewTitleForImage(image);
				$("imagePreviewTitle").textContent = title;
				const natural = image.naturalWidth && image.naturalHeight ? `${image.naturalWidth} x ${image.naturalHeight}` : "";
				$("imagePreviewMeta").textContent = natural;
				previewImage.src = src;
				previewImage.alt = title;
				dialog.classList.remove("hidden");
				applyImagePreviewScale(1, { keepCenter: false });
				const stage = $("imagePreviewStage");
				if (stage) {
					stage.scrollLeft = 0;
					stage.scrollTop = 0;
				}
				publishPluginNavigationState({ force: true });
				return true;
			}
			function closeImagePreview() {
				const dialog = $("imagePreviewDialog");
				if (!dialog) return;
				dialog.classList.add("hidden");
				const previewImage = $("imagePreviewImage");
				if (previewImage) {
					previewImage.removeAttribute("src");
					previewImage.alt = "";
				}
				$("imagePreviewTitle").textContent = "图片预览";
				$("imagePreviewMeta").textContent = "";
				state.imagePreviewScale = 1;
				dialog.style.removeProperty("--image-preview-scale");
				publishPluginNavigationState();
			}
			function handleImagePreviewAction(button) {
				const action = String(button && button.dataset ? button.dataset.imagePreviewAction || "" : "");
				if (!action) return false;
				if (action === "zoom-in") {
					applyImagePreviewScale(state.imagePreviewScale + IMAGE_PREVIEW_ZOOM_STEP);
					return true;
				}
				if (action === "zoom-out") {
					applyImagePreviewScale(state.imagePreviewScale - IMAGE_PREVIEW_ZOOM_STEP);
					return true;
				}
				if (action === "reset") {
					applyImagePreviewScale(1);
					return true;
				}
				return false;
			}
			function previewableImageFromEvent(event) {
				const image = event && event.target && event.target.closest ? event.target.closest(".input-image img, .image-view img, .markdown-image img, .file-preview-image, .attachment-thumb") : null;
				if (!image) return null;
				if (image.closest && image.closest(".github-link-card")) return null;
				return image;
			}
			function touchDistance(touchA, touchB) {
				if (!touchA || !touchB) return 0;
				return Math.hypot(Number(touchA.clientX || 0) - Number(touchB.clientX || 0), Number(touchA.clientY || 0) - Number(touchB.clientY || 0));
			}
			function touchCenter(touchA, touchB) {
				return {
					x: (Number(touchA && touchA.clientX || 0) + Number(touchB && touchB.clientX || 0)) / 2,
					y: (Number(touchA && touchA.clientY || 0) + Number(touchB && touchB.clientY || 0)) / 2
				};
			}
			function pinchStateFromTouches(event, scroller, scale) {
				if (!event || !event.touches || event.touches.length < 2 || !scroller) return null;
				const touchA = event.touches[0];
				const touchB = event.touches[1];
				const distance = touchDistance(touchA, touchB);
				if (!distance) return null;
				const center = touchCenter(touchA, touchB);
				const rect = scroller.getBoundingClientRect();
				const startScale = Math.max(.01, Number(scale) || 1);
				const anchorX = center.x - rect.left;
				const anchorY = center.y - rect.top;
				return {
					distance,
					scale: startScale,
					scroller,
					contentX: (scroller.scrollLeft + anchorX) / startScale,
					contentY: (scroller.scrollTop + anchorY) / startScale
				};
			}
			function anchorOptionsFromTouches(event, pinch) {
				if (!event || !event.touches || event.touches.length < 2 || !pinch || !pinch.scroller) return null;
				const center = touchCenter(event.touches[0], event.touches[1]);
				const rect = pinch.scroller.getBoundingClientRect();
				return {
					anchorX: center.x - rect.left,
					anchorY: center.y - rect.top,
					contentX: pinch.contentX,
					contentY: pinch.contentY
				};
			}
			function beginImagePreviewPinch(event) {
				const stage = event && event.target && event.target.closest ? event.target.closest("#imagePreviewStage") : null;
				if (!stage || !imagePreviewOpen() || !event.touches || event.touches.length < 2) return;
				const pinch = pinchStateFromTouches(event, stage, state.imagePreviewScale);
				if (!pinch) return;
				state.imagePreviewPinch = pinch;
				event.preventDefault();
				event.stopPropagation();
			}
			function moveImagePreviewPinch(event) {
				const pinch = state.imagePreviewPinch;
				if (!pinch) return;
				if (!event.touches || event.touches.length < 2) {
					state.imagePreviewPinch = null;
					return;
				}
				const distance = touchDistance(event.touches[0], event.touches[1]);
				const anchorOptions = anchorOptionsFromTouches(event, pinch);
				if (!distance || !anchorOptions) return;
				event.preventDefault();
				event.stopPropagation();
				applyImagePreviewScale(pinch.scale * (distance / pinch.distance), anchorOptions);
			}
			function finishImagePreviewPinch() {
				state.imagePreviewPinch = null;
			}
			function beginMermaidPinch(event) {
				const viewer = event && event.target && event.target.closest ? event.target.closest(".markdown-mermaid-viewer") : null;
				const container = mermaidContainerFromViewer(viewer);
				if (!viewer || !container || !event.touches || event.touches.length < 2) return;
				const pinch = pinchStateFromTouches(event, viewer, mermaidCurrentScale(container));
				if (!pinch) return;
				pinch.container = container;
				state.mermaidPinch = pinch;
				event.preventDefault();
				event.stopPropagation();
			}
			function moveMermaidPinch(event) {
				const pinch = state.mermaidPinch;
				if (!pinch || !pinch.container) return;
				if (!event.touches || event.touches.length < 2) {
					state.mermaidPinch = null;
					return;
				}
				const distance = touchDistance(event.touches[0], event.touches[1]);
				const anchorOptions = anchorOptionsFromTouches(event, pinch);
				if (!distance || !anchorOptions) return;
				event.preventDefault();
				event.stopPropagation();
				applyMermaidScale(pinch.container, pinch.scale * (distance / pinch.distance), Object.assign({ viewer: pinch.scroller }, anchorOptions));
			}
			function finishMermaidPinch() {
				state.mermaidPinch = null;
			}
			function renderThreadTaskCardDraftMessage(value, item, turn) {
				const text = String(value || "");
				if (parseThreadTaskCardDraftText(value)) return "";
				if (hasThreadTaskCardDraftTag(text)) return "";
				return "";
			}
			function closeFilePreview() {
				const dialog = $("filePreviewDialog");
				if (!dialog) return;
				state.filePreviewSwipe = null;
				state.filePreviewThreadId = "";
				dialog.classList.add("hidden");
				$("filePreviewBody").innerHTML = "";
				$("filePreviewMeta").textContent = "";
				$("filePreviewPath").textContent = "";
				publishPluginNavigationState();
			}
			function filePreviewOpen() {
				const dialog = $("filePreviewDialog");
				return Boolean(dialog && !dialog.classList.contains("hidden"));
			}
			function beginFilePreviewSwipe(event) {
				if (!filePreviewOpen()) return;
				if (event.touches && event.touches.length > 1) return;
				const touch = primaryTouch(event);
				if (!touch) return;
				event.stopPropagation();
				state.filePreviewSwipe = {
					startX: touch.clientX,
					startY: touch.clientY,
					currentX: touch.clientX,
					currentY: touch.clientY,
					moved: false
				};
			}
			function moveFilePreviewSwipe(event) {
				const swipe = state.filePreviewSwipe;
				if (!swipe) return;
				event.stopPropagation();
				const touch = primaryTouch(event);
				if (!touch) return;
				const dx = touch.clientX - swipe.startX;
				const dy = touch.clientY - swipe.startY;
				if (!swipe.moved) {
					if (Math.abs(dx) < 10 && Math.abs(dy) < 12) return;
					if (dx <= 0 || Math.abs(dy) > Math.abs(dx)) {
						state.filePreviewSwipe = null;
						return;
					}
				}
				swipe.moved = true;
				swipe.currentX = touch.clientX;
				swipe.currentY = touch.clientY;
				if (event.cancelable !== false) event.preventDefault();
			}
			function finishFilePreviewSwipe(event) {
				const swipe = state.filePreviewSwipe;
				state.filePreviewSwipe = null;
				if (!swipe) return;
				if (event && typeof event.stopPropagation === "function") event.stopPropagation();
				if (!swipe.moved) return;
				const dx = Number(swipe.currentX || swipe.startX) - swipe.startX;
				const dy = Number(swipe.currentY || swipe.startY) - swipe.startY;
				if (dx >= FILE_PREVIEW_SWIPE_CLOSE_MIN_PX && Math.abs(dy) <= Math.abs(dx) * .85) closeFilePreview();
			}
			function cancelFilePreviewSwipe(event) {
				state.filePreviewSwipe = null;
				if (event && typeof event.stopPropagation === "function") event.stopPropagation();
			}
			function filePreviewMetaText(file) {
				const parts = [];
				if (file && file.kind) parts.push(String(file.kind).toUpperCase());
				if (file && file.contentType) parts.push(String(file.contentType).split(";")[0]);
				if (file && Number.isFinite(Number(file.sizeBytes))) parts.push(`${Number(file.sizeBytes).toLocaleString()} bytes`);
				if (file && file.truncated) parts.push(`已截断到 ${Number(file.maxBytes || 0).toLocaleString()} bytes`);
				return parts.join(" · ");
			}
			function filePreviewContentUrl(file, options = {}) {
				if (file && file.contentUrl) return authenticatedApiContentUrl(file.contentUrl);
				if (!file || !file.path) return "";
				return localFilePreviewContentUrl(file.path, options);
			}
			function hermesPluginProxyPrefixFromPathname(pathname) {
				const match = String(pathname || "").match(/^(\/api\/hermes-plugins\/[^/]+\/proxy)(?:\/|$)/);
				return match ? match[1] : "";
			}
			function hermesPluginProxyPrefix() {
				if (!isHermesEmbedMode()) return "";
				try {
					return hermesPluginProxyPrefixFromPathname(window.location && window.location.pathname);
				} catch (_) {
					return "";
				}
			}
			function protectedImageUpstreamPathname(pathname) {
				const pathValue = String(pathname || "");
				if (pathValue === "/api/generated-images/file" || pathValue === "/api/uploads/file" || pathValue === "/api/files/preview/content") return pathValue;
				const match = pathValue.match(/^\/api\/hermes-plugins\/[^/]+\/proxy(\/api\/(?:generated-images\/file|uploads\/file|files\/preview\/content))$/);
				return match ? match[1] : "";
			}
			function browserApiContentUrl(value) {
				const raw = String(value || "");
				if (!raw) return "";
				try {
					const origin = typeof window !== "undefined" && window.location && window.location.origin ? window.location.origin : "http://127.0.0.1";
					const parsed = new URL(raw, origin);
					if (parsed.origin !== origin) return raw;
					const pathValue = `${parsed.pathname}${parsed.search}${parsed.hash}`;
					const proxyPrefix = hermesPluginProxyPrefix();
					if (proxyPrefix && parsed.pathname.startsWith("/api/") && !parsed.pathname.startsWith(`${proxyPrefix}/`)) return `${proxyPrefix}${pathValue}`;
					return pathValue;
				} catch (_) {
					return raw;
				}
			}
			function authenticatedApiContentUrl(value) {
				const raw = String(value || "");
				if (!raw) return "";
				try {
					const origin = typeof window !== "undefined" && window.location && window.location.origin ? window.location.origin : "http://127.0.0.1";
					const parsed = new URL(raw, origin);
					if (parsed.origin === origin && parsed.pathname.startsWith("/api/")) {
						if (state.key) parsed.searchParams.set("key", state.key);
						return browserApiContentUrl(`${parsed.pathname}${parsed.search}${parsed.hash}`);
					}
				} catch (_) {}
				return raw;
			}
			function localFilePreviewContentUrl(filePath, options = {}) {
				if (!filePath) return "";
				const threadId = String(options.threadId || renderContextThreadId() || "").trim();
				const params = new URLSearchParams({
					threadId,
					path: String(filePath)
				});
				if (state.key) params.set("key", state.key);
				return browserApiContentUrl(`/api/files/preview/content?${params.toString()}`);
			}
			function renderJsonPreview(content) {
				try {
					return `<pre class="file-preview-text"><code>${escapeHtml(JSON.stringify(JSON.parse(content), null, 2))}</code></pre>`;
				} catch (_) {
					return `<pre class="file-preview-text"><code>${escapeHtml(content)}</code></pre>`;
				}
			}
			function parseCsvPreviewRows(content) {
				const rows = [];
				let row = [];
				let cell = "";
				let quoted = false;
				const source = String(content || "");
				for (let index = 0; index < source.length; index += 1) {
					const ch = source[index];
					const next = source[index + 1];
					if (ch === "\"" && quoted && next === "\"") {
						cell += "\"";
						index += 1;
					} else if (ch === "\"") quoted = !quoted;
					else if (ch === "," && !quoted) {
						row.push(cell);
						cell = "";
					} else if ((ch === "\n" || ch === "\r") && !quoted) {
						if (ch === "\r" && next === "\n") index += 1;
						row.push(cell);
						rows.push(row);
						row = [];
						cell = "";
						if (rows.length >= 50) break;
					} else cell += ch;
				}
				if (rows.length < 50 && (cell || row.length)) {
					row.push(cell);
					rows.push(row);
				}
				return rows.filter((entry) => entry.some((cellValue) => String(cellValue || "").trim()));
			}
			function renderCsvPreview(content) {
				const rows = parseCsvPreviewRows(content);
				if (!rows.length) return `<pre class="file-preview-text"><code>${escapeHtml(content)}</code></pre>`;
				const head = rows[0];
				const bodyRows = rows.slice(1);
				return `<div class="file-preview-table-wrap"><table class="file-preview-table"><thead><tr>${head.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead><tbody>${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
			}
			function renderFilePreviewContent(file, options = {}) {
				const content = String(file && file.content || "");
				if (file && file.kind === "markdown") return renderMarkdown(content, { orderedListMode: "source" });
				if (file && file.kind === "image") {
					const src = filePreviewContentUrl(file, options);
					return `<div class="file-preview-media"><img class="file-preview-image" src="${escapeHtml(src)}" alt="${escapeHtml(file.fileName || "image preview")}"></div>`;
				}
				if (file && file.kind === "pdf") {
					const src = filePreviewContentUrl(file, options);
					return `<div class="file-preview-pdf"><iframe src="${escapeHtml(src)}" title="${escapeHtml(file.fileName || "PDF preview")}"></iframe><a href="${escapeHtml(src)}" target="_blank" rel="noreferrer">打开 PDF 预览</a></div>`;
				}
				if (file && file.kind === "json") return renderJsonPreview(content);
				if (file && file.kind === "csv") return renderCsvPreview(content);
				return `<pre class="file-preview-text"><code>${escapeHtml(content)}</code></pre>`;
			}
			function imageViewPath(item) {
				return String(item && (item.path || item.filePath || item.file_path || item.imagePath || item.image_path || item.savedPath || item.saved_path || item.sourcePath || item.source_path || item.arguments && (item.arguments.path || item.arguments.filePath || item.arguments.imagePath || item.arguments.savedPath) || item.result && (item.result.path || item.result.filePath || item.result.imagePath || item.result.savedPath)) || "");
			}
			function imageViewUrl(item) {
				const raw = item && (item.url || item.imageUrl || item.image_url || item.arguments && (item.arguments.url || item.arguments.imageUrl || item.arguments.image_url) || item.result && (item.result.url || item.result.imageUrl || item.result.image_url));
				const value = raw && typeof raw === "object" ? raw.url || raw.uri || raw.href : raw;
				return String(value || "");
			}
			function imageViewContentUrl(item) {
				return String(item && (item.contentUrl || item.content_url || item.result && (item.result.contentUrl || item.result.content_url)) || "");
			}
			function safeImageViewApiUrl(value) {
				const raw = String(value || "").trim();
				if (!raw) return "";
				try {
					const origin = typeof window !== "undefined" && window.location && window.location.origin ? window.location.origin : "http://127.0.0.1";
					const parsed = new URL(raw, origin);
					if (parsed.origin === origin && protectedImageUpstreamPathname(parsed.pathname)) return authenticatedApiContentUrl(`${parsed.pathname}${parsed.search}${parsed.hash}`);
				} catch (_) {}
				return "";
			}
			function safeImageViewFallbackUrl(value) {
				const raw = String(value || "").trim();
				if (!raw) return "";
				if (/^(?:data:image\/|blob:|file:\/\/)/i.test(raw)) return "";
				if (isLikelyAbsoluteLocalPath(raw)) return "";
				return safeImageViewApiUrl(raw);
			}
			function isImageViewUnavailable(item) {
				return Boolean(item && (item.imageUnavailable || item.unavailable || item.generatedImage && item.generatedImage.unavailable));
			}
			function renderImageView(item) {
				const filePath = imageViewPath(item);
				const contentUrl = imageViewContentUrl(item);
				const url = imageViewUrl(item);
				const src = contentUrl ? safeImageViewApiUrl(contentUrl) : filePath && isLikelyAbsoluteLocalPath(filePath) ? imageContentUrlForPath(filePath, { threadId: renderContextThreadId() }) : safeImageViewFallbackUrl(url);
				shortPath(filePath || item.label || item.fileName || item.file_name || item.caption || url || item.id || "image");
				if (isImageViewUnavailable(item)) return `<figure class="image-view image-load-failed"></figure>`;
				if (!src && (contentUrl || filePath || url)) return `<figure class="image-view image-load-failed" data-image-source-kind="unsafe-source"></figure>`;
				if (!src) return renderStructuredBlock(item, "Image");
				const displaySrc = protectedImageDisplaySrc(src);
				return `<figure class="image-view">
    <img src="${escapeHtml(displaySrc)}" alt="Image" loading="${imageLoadingModeForSource(src)}"${protectedImageSourceAttribute(src)}>
  </figure>`;
			}
			function handleConversationImageError(event) {
				const image = event && event.target && event.target.closest ? event.target.closest("img") : null;
				if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("error", image, {}, { force: true });
				if (handleProtectedAppImageError(image)) return;
				markFailedAppImage(image, { explicit: true });
				if (typeof imageDiagnosticDetails === "function" && typeof recordHomeAiDiagnosticFailure === "function") {
					const details = imageDiagnosticDetails(image, "error");
					recordHomeAiDiagnosticFailure({
						category: "media_render_failed",
						diagnostic_type: "image_render_failed",
						severity_hint: "H3",
						evidence_confidence: .72,
						error_code: "image_render_failed",
						context: {
							surface: "media-render",
							action: "image-load",
							source_kind: details.sourceKind || "",
							item_hash: diagnosticItemHash(details.sourceHash || "")
						},
						counts: {
							recovery_count: details.recoveryCount,
							natural_width: details.naturalWidth,
							natural_height: details.naturalHeight
						},
						breadcrumbs: [{
							kind: "media-render",
							code: "image-load",
							status: "failed",
							fields: {
								source_kind: details.sourceKind || "",
								item_hash: diagnosticItemHash(details.sourceHash || "")
							}
						}]
					});
				}
				if (typeof probeFailedAuthenticatedImage === "function") probeFailedAuthenticatedImage(image);
			}
			function handleConversationImageLoad(event) {
				const image = event && event.target && event.target.closest ? event.target.closest("img") : null;
				if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("load", image);
				if (typeof imageDiagnosticDetails === "function" && typeof recordHomeAiDiagnosticSuccess === "function") {
					const details = imageDiagnosticDetails(image, "load");
					recordHomeAiDiagnosticSuccess({
						category: "media_render_failed",
						diagnostic_type: "image_render_failed",
						error_code: "image_render_failed",
						context: {
							surface: "media-render",
							action: "image-load",
							source_kind: details.sourceKind || "",
							item_hash: diagnosticItemHash(details.sourceHash || "")
						}
					});
				}
				clearFailedAppImage(image);
			}
			function failedAppImageContainer(image) {
				return image && image.closest ? image.closest(".input-image, .image-view, .markdown-image, .attachment-chip, .file-preview-media, figure") : null;
			}
			function setRetryingAppImage(image, active) {
				if (!image) return false;
				const container = failedAppImageContainer(image);
				if (container && container.classList && typeof container.classList.toggle === "function") container.classList.toggle("image-load-retrying", Boolean(active));
				if (image.classList && typeof image.classList.toggle === "function") image.classList.toggle("image-load-retrying", Boolean(active));
				return true;
			}
			function markFailedAppImage(image, options = {}) {
				if (!image) return false;
				if (options.explicit && image.dataset) image.dataset.imageLoadError = "1";
				setRetryingAppImage(image, false);
				const container = failedAppImageContainer(image);
				if (container) container.classList.add("image-load-failed");
				else if (image.classList) image.classList.add("image-load-failed");
				image.setAttribute("aria-hidden", "true");
				return true;
			}
			function clearFailedAppImage(image) {
				if (!image) return false;
				if (image.dataset && image.dataset.imageLoadError) delete image.dataset.imageLoadError;
				if (image.dataset && image.dataset.imageLoadProbe) delete image.dataset.imageLoadProbe;
				setRetryingAppImage(image, false);
				const container = failedAppImageContainer(image);
				if (container && container.classList) container.classList.remove("image-load-failed");
				if (image.classList) image.classList.remove("image-load-failed");
				if (image.getAttribute && image.getAttribute("aria-hidden") === "true") image.removeAttribute("aria-hidden");
				return true;
			}
			function imageHadExplicitLoadError(image) {
				return Boolean(image && image.dataset && image.dataset.imageLoadError === "1");
			}
			function isLazyAppImage(image) {
				if (!image) return false;
				return String(image.getAttribute && image.getAttribute("loading") || image.loading || "").trim().toLowerCase() === "lazy";
			}
			function shouldProactivelyMarkFailedImage(image) {
				if (!image) return false;
				if (protectedAppImageElementSrc(image)) return false;
				if (imageHadExplicitLoadError(image)) return true;
				return !isLazyAppImage(image);
			}
			function protectedGeneratedImageSrc(value) {
				const raw = String(value || "");
				if (!raw) return "";
				try {
					const parsed = new URL(raw, window.location.origin);
					if (parsed.origin === window.location.origin && protectedImageUpstreamPathname(parsed.pathname)) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
				} catch (_) {}
				return "";
			}
			function imageLoadingModeForSource(src) {
				return protectedGeneratedImageSrc(src) ? "eager" : "lazy";
			}
			function shouldRenderProtectedImageDirectly(src) {
				if (!protectedGeneratedImageSrc(src)) return false;
				return isHermesEmbedMode();
			}
			function protectedImageDisplaySrc(src) {
				const protectedSrc = protectedGeneratedImageSrc(src);
				if (!protectedSrc) return src;
				return shouldRenderProtectedImageDirectly(protectedSrc) ? protectedSrc : PROTECTED_IMAGE_PLACEHOLDER_SRC;
			}
			function protectedImageSourceAttribute(src) {
				const protectedSrc = protectedGeneratedImageSrc(src);
				return protectedSrc ? ` data-protected-image-src="${escapeHtml(protectedSrc)}"` : "";
			}
			function protectedAppImageElementSrc(image) {
				const stored = image && image.dataset && image.dataset.protectedImageSrc;
				if (stored) return protectedGeneratedImageSrc(stored);
				return protectedGeneratedImageSrc(image && (image.currentSrc || image.src || image.getAttribute && image.getAttribute("src")));
			}
			function imageDiagnosticSourceKind(src) {
				const raw = String(src || "");
				if (!raw) return "empty";
				if (/^data:image\//i.test(raw)) return "data-image";
				if (/^blob:/i.test(raw)) return "blob";
				try {
					const parsed = new URL(raw, window.location.origin);
					if (parsed.origin !== window.location.origin) return "remote";
					const upstreamPathname = protectedImageUpstreamPathname(parsed.pathname) || parsed.pathname;
					if (upstreamPathname === "/api/uploads/file") return "upload";
					if (upstreamPathname === "/api/generated-images/file") return "generated-image";
					if (upstreamPathname === "/api/files/preview/content") return "file-preview";
					if (parsed.pathname.startsWith("/api/")) return "api";
					return "same-origin";
				} catch (_) {
					return "unknown";
				}
			}
			function imageDiagnosticSourceHash(src) {
				const raw = String(src || "");
				if (!raw) return "";
				if (/^data:image\//i.test(raw)) return stableTextHash(`data:${raw.length}`);
				if (/^blob:/i.test(raw)) return stableTextHash("blob");
				try {
					const parsed = new URL(raw, window.location.origin);
					for (const key of Array.from(parsed.searchParams.keys())) if (/key|token|secret|password|cookie/i.test(key)) parsed.searchParams.set(key, "REDACTED");
					return stableTextHash(`${parsed.origin}${parsed.pathname}?${parsed.searchParams.toString()}`);
				} catch (_) {
					return stableTextHash(raw.slice(0, 200));
				}
			}
			function imageDiagnosticDetails(image, phase, extra = {}) {
				const src = image && (image.currentSrc || image.src || image.getAttribute && image.getAttribute("src") || "");
				const protectedSrc = protectedAppImageElementSrc(image);
				const container = failedAppImageContainer(image);
				return Object.assign({
					phase,
					clientBuildId: CLIENT_BUILD_ID,
					readMode: String(state.currentThread && state.currentThread.mobileReadMode || ""),
					threadIdSuffix: String(state.currentThreadId || "").slice(-8),
					sourceKind: imageDiagnosticSourceKind(src || protectedSrc),
					protectedSourceKind: imageDiagnosticSourceKind(protectedSrc),
					sourceHash: imageDiagnosticSourceHash(src || protectedSrc),
					alt: shortPath(String(image && image.alt || "").trim()).slice(0, 96),
					complete: Boolean(image && image.complete),
					naturalWidth: Number(image && image.naturalWidth || 0),
					naturalHeight: Number(image && image.naturalHeight || 0),
					failedClass: Boolean(container && container.classList && container.classList.contains("image-load-failed")),
					recoveryCount: Number(image && image.dataset && image.dataset.protectedImageRecoveryCount || 0)
				}, extra || {});
			}
			function postImageDiagnosticEvent(phase, image, extra = {}, options = {}) {
				if (!IMAGE_DIAGNOSTICS_ENABLED) return false;
				const details = imageDiagnosticDetails(image, phase, extra);
				const key = [
					"image",
					phase,
					state.currentThreadId || "",
					details.sourceHash || "",
					details.alt || ""
				].join("|");
				postPerformanceEvent(`image_${phase}`, details, {
					key,
					minIntervalMs: Number(options.minIntervalMs || 8e3),
					force: Boolean(options.force)
				});
			}
			function imageStillConnected(image) {
				return Boolean(image && (!("isConnected" in image) || image.isConnected));
			}
			function protectedAppImageUrlApi() {
				if (typeof window !== "undefined" && window.URL) return window.URL;
				if (typeof URL !== "undefined") return URL;
				return null;
			}
			function revokeProtectedAppImageObjectUrl(image) {
				if (!image || !image.dataset) return false;
				const objectUrl = String(image.dataset.protectedImageObjectUrl || "");
				if (!objectUrl) return false;
				const urlApi = protectedAppImageUrlApi();
				if (urlApi && typeof urlApi.revokeObjectURL === "function" && /^blob:/i.test(objectUrl)) try {
					urlApi.revokeObjectURL(objectUrl);
				} catch (_) {}
				delete image.dataset.protectedImageObjectUrl;
				return true;
			}
			function retryProtectedAppImageSource(image, src) {
				if (!image || !src || Number(image.naturalWidth || 0) > 0) return false;
				if (!image.dataset) return false;
				const retryCount = Number(image.dataset.imageLoadRetryCount || 0);
				if (retryCount >= 2) return false;
				image.dataset.imageLoadRetryCount = String(retryCount + 1);
				revokeProtectedAppImageObjectUrl(image);
				try {
					const parsed = new URL(src, window.location.origin);
					parsed.searchParams.set("_imgRetry", `${Date.now()}-${retryCount + 1}`);
					image.src = `${parsed.pathname}${parsed.search}${parsed.hash}`;
					return true;
				} catch (_) {
					image.src = src;
					return true;
				}
			}
			function cacheBustedProtectedImageSrc(src, paramName = "_imgRetry") {
				const source = protectedGeneratedImageSrc(src);
				if (!source) return "";
				try {
					const parsed = new URL(source, window.location.origin);
					parsed.searchParams.set(paramName, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
					return `${parsed.pathname}${parsed.search}${parsed.hash}`;
				} catch (_) {
					return source;
				}
			}
			function shouldRecoverProtectedImageAsDirectUrl() {
				return isHermesEmbedMode() || typeof isIosWebKitBrowser === "function" && isIosWebKitBrowser();
			}
			function blobToDataUrl(blob) {
				if (!blob || typeof FileReader === "undefined") return Promise.resolve("");
				return new Promise((resolve) => {
					const reader = new FileReader();
					reader.onload = () => resolve(/^data:image\//i.test(String(reader.result || "")) ? String(reader.result) : "");
					reader.onerror = () => resolve("");
					try {
						reader.readAsDataURL(blob);
					} catch (_) {
						resolve("");
					}
				});
			}
			async function protectedAppImageRecoveredUrl(response, src = "") {
				if (!response) return {
					url: "",
					objectUrl: false
				};
				if (shouldRecoverProtectedImageAsDirectUrl()) {
					const directUrl = cacheBustedProtectedImageSrc(src, "_imgRecover");
					if (directUrl) return {
						url: directUrl,
						objectUrl: false,
						directUrl: true
					};
				}
				if (typeof response.blob !== "function") return {
					url: "",
					objectUrl: false
				};
				const blob = await response.blob().catch(() => null);
				if (!blob) return {
					url: "",
					objectUrl: false
				};
				const type = String(blob.type || "").trim();
				if (type && !/^image\//i.test(type)) return {
					url: "",
					objectUrl: false
				};
				const size = Number(blob.size || 0);
				if (!size || size <= 8 * 1024 * 1024) {
					const dataUrl = await blobToDataUrl(blob);
					if (dataUrl) return {
						url: dataUrl,
						objectUrl: false
					};
				}
				const urlApi = protectedAppImageUrlApi();
				if (urlApi && typeof urlApi.createObjectURL === "function") {
					const type = String(blob.type || "").trim();
					if (type && !/^image\//i.test(type)) return {
						url: "",
						objectUrl: false
					};
					return {
						url: urlApi.createObjectURL(blob),
						objectUrl: true
					};
				}
				return {
					url: "",
					objectUrl: false
				};
			}
			function applyProtectedAppImageRecoveredUrl(image, recovered) {
				const url = String(recovered && recovered.url || "");
				if (!image || !url) return false;
				revokeProtectedAppImageObjectUrl(image);
				if (image.dataset && recovered && recovered.objectUrl) image.dataset.protectedImageObjectUrl = url;
				image.src = url;
				return true;
			}
			function shouldHydrateProtectedAppImage(image) {
				if (!image || !image.dataset) return false;
				const src = protectedAppImageElementSrc(image);
				if (!src) return false;
				if (shouldRenderProtectedImageDirectly(src)) return false;
				if (image.dataset.protectedImageHydrated === "1" || image.dataset.protectedImageHydrating === "1") return false;
				const current = String(image.currentSrc || image.src || "");
				if (/^(data:image|blob:)/i.test(current) && current !== PROTECTED_IMAGE_PLACEHOLDER_SRC) return false;
				return isIosWebKitBrowser() || imageDiagnosticSourceKind(src) === "upload" || shouldRenderProtectedImageDirectly(src);
			}
			function hydrateProtectedAppImage(image, reason = "scan") {
				const src = protectedAppImageElementSrc(image);
				if (!src || !shouldHydrateProtectedAppImage(image)) return false;
				image.dataset.protectedImageHydrating = "1";
				if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("hydrate_start", image, { reason }, { force: true });
				const headers = state.key ? { "X-Codex-Mobile-Key": state.key } : {};
				fetch(src, {
					method: "GET",
					headers,
					credentials: "same-origin",
					cache: "no-store"
				}).then(async (response) => {
					if (!imageStillConnected(image)) return;
					if (image.dataset) delete image.dataset.protectedImageHydrating;
					if (!response || !response.ok) {
						if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("hydrate_response", image, {
							status: response && response.status || 0,
							ok: false
						}, { force: true });
						return;
					}
					const recovered = await protectedAppImageRecoveredUrl(response, src);
					if (!imageStillConnected(image)) {
						if (recovered && recovered.objectUrl && recovered.url) {
							const urlApi = protectedAppImageUrlApi();
							if (urlApi && typeof urlApi.revokeObjectURL === "function") try {
								urlApi.revokeObjectURL(recovered.url);
							} catch (_) {}
						}
						return;
					}
					if (applyProtectedAppImageRecoveredUrl(image, recovered)) {
						image.dataset.protectedImageHydrated = "1";
						clearFailedAppImage(image);
						if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("hydrate_apply", image, {
							recoveredKind: imageDiagnosticSourceKind(recovered && recovered.url),
							objectUrl: Boolean(recovered && recovered.objectUrl)
						}, { force: true });
					}
				}).catch(() => {
					if (!imageStillConnected(image)) return;
					if (image.dataset) delete image.dataset.protectedImageHydrating;
					if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("hydrate_fetch_error", image, { reason }, { force: true });
				});
				return true;
			}
			function hydrateProtectedAppImages(root, reason = "scan") {
				if (!root || !root.querySelectorAll) return 0;
				let count = 0;
				root.querySelectorAll("img").forEach((image) => {
					if (hydrateProtectedAppImage(image, reason)) count += 1;
				});
				return count;
			}
			function handleProtectedAppImageError(image) {
				const src = protectedAppImageElementSrc(image);
				if (!src || !image || !image.dataset) return false;
				if (image.dataset.imageLoadProbe === "1") return true;
				const recoveryCount = Number(image.dataset.protectedImageRecoveryCount || 0);
				if (recoveryCount >= 2) {
					if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("recovery_limit", image, { recoveryCount }, { force: true });
					markFailedAppImage(image, { explicit: true });
					return true;
				}
				image.dataset.protectedImageRecoveryCount = String(recoveryCount + 1);
				image.dataset.imageLoadProbe = "1";
				setRetryingAppImage(image, true);
				if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("recovery_start", image, { recoveryCount: recoveryCount + 1 }, { force: true });
				const headers = state.key ? { "X-Codex-Mobile-Key": state.key } : {};
				fetch(src, {
					method: "GET",
					headers,
					credentials: "same-origin",
					cache: "no-store"
				}).then(async (response) => {
					if (!imageStillConnected(image)) return;
					if (image.dataset) delete image.dataset.imageLoadProbe;
					if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("recovery_response", image, {
						status: response && response.status || 0,
						ok: Boolean(response && response.ok),
						contentType: response && response.headers && response.headers.get ? String(response.headers.get("content-type") || "").slice(0, 80) : ""
					}, { force: true });
					if (response && (response.status === 401 || response.status === 403)) {
						if (isHermesEmbedMode() && !state.imageAuthRefreshRequested) {
							state.imageAuthRefreshRequested = true;
							requestHermesPluginRefresh("auth_state_changed", { force: true });
						}
						markFailedAppImage(image, { explicit: true });
						return;
					}
					if (response && response.ok) {
						clearFailedAppImage(image);
						const recovered = await protectedAppImageRecoveredUrl(response, src);
						if (!imageStillConnected(image)) {
							if (recovered && recovered.objectUrl && recovered.url) {
								const urlApi = protectedAppImageUrlApi();
								if (urlApi && typeof urlApi.revokeObjectURL === "function") try {
									urlApi.revokeObjectURL(recovered.url);
								} catch (_) {}
							}
							return;
						}
						if (applyProtectedAppImageRecoveredUrl(image, recovered)) {
							if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("recovery_apply", image, {
								recoveredKind: imageDiagnosticSourceKind(recovered && recovered.url),
								objectUrl: Boolean(recovered && recovered.objectUrl)
							}, { force: true });
							return;
						}
						if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("recovery_retry_src", image, {}, { force: true });
						retryProtectedAppImageSource(image, src);
						return;
					}
					markFailedAppImage(image, { explicit: true });
				}).catch(() => {
					if (!imageStillConnected(image)) return;
					if (image.dataset) delete image.dataset.imageLoadProbe;
					if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("recovery_fetch_error", image, {}, { force: true });
					markFailedAppImage(image, { explicit: true });
				});
				return true;
			}
			function probeFailedAuthenticatedImage(image) {
				const src = protectedAppImageElementSrc(image);
				if (!src || !isHermesEmbedMode() || state.imageAuthRefreshRequested) return;
				const headers = state.key ? { "X-Codex-Mobile-Key": state.key } : {};
				fetch(src, {
					method: "GET",
					headers,
					credentials: "same-origin",
					cache: "no-store"
				}).then((response) => {
					if (!response || !(response.status === 401 || response.status === 403)) return;
					state.imageAuthRefreshRequested = true;
					requestHermesPluginRefresh("auth_state_changed", { force: true });
				}).catch(() => {});
			}
			function scanFailedAppImages(root) {
				if (!root || !root.querySelectorAll) return 0;
				let marked = 0;
				root.querySelectorAll("img").forEach((image) => {
					if (image.complete && image.naturalWidth > 0) {
						clearFailedAppImage(image);
						return;
					}
					if (image.complete && image.naturalWidth === 0) {
						if (handleProtectedAppImageError(image)) return;
						if (shouldProactivelyMarkFailedImage(image)) {
							if (markFailedAppImage(image)) marked += 1;
						} else clearFailedAppImage(image);
					}
				});
				return marked;
			}
			function scheduleFailedAppImageScan(root, delays = [
				0,
				180,
				700
			]) {
				if (!root) return;
				delays.forEach((delay) => {
					window.setTimeout(() => {
						hydrateProtectedAppImages(root, "scheduled-scan");
						scanFailedAppImages(root);
					}, delay);
				});
			}
			function scheduleVisibleImageFailureScan(delays = [
				0,
				180,
				700
			]) {
				scheduleFailedAppImageScan($("conversation"), delays);
				scheduleFailedAppImageScan($("attachmentList"), delays);
			}
			function showFilePreviewLoading(label, filePath) {
				const dialog = $("filePreviewDialog");
				if (!dialog) return;
				$("filePreviewTitle").textContent = label || "文件预览";
				$("filePreviewPath").textContent = filePath || "";
				$("filePreviewMeta").textContent = "";
				$("filePreviewBody").textContent = "正在加载文件...";
				const copyButton = $("filePreviewCopyPath");
				if (copyButton) {
					copyButton.dataset.copyKey = rememberCopyText(filePath || "");
					copyButton.textContent = "复制路径";
				}
				dialog.classList.remove("hidden");
				publishPluginNavigationState({ force: true });
			}
			function localFilePreviewThreadIdFromLink(link, options = {}) {
				const explicit = String(options.threadId || link && link.dataset && link.dataset.localFileThreadId || "").trim();
				if (explicit) return explicit;
				const pane = link && typeof link.closest === "function" ? link.closest("[data-thread-tile-pane]") : null;
				const paneThreadId = String(pane && pane.getAttribute && pane.getAttribute("data-thread-tile-pane") || "").trim();
				if (paneThreadId) return paneThreadId;
				return String(state.filePreviewThreadId || renderContextThreadId() || "").trim();
			}
			async function openLocalFilePreview(link, options = {}) {
				const filePath = link && link.dataset ? link.dataset.localFilePath || "" : "";
				if (!filePath) return;
				const threadId = localFilePreviewThreadIdFromLink(link, options);
				state.filePreviewThreadId = threadId;
				const label = link && link.dataset && link.dataset.localFileLabel || (link && link.textContent ? link.textContent.replace(/预览文件\s*$/, "").trim() : "") || "文件预览";
				showFilePreviewLoading(label, filePath);
				try {
					const file = await api(`/api/files/preview?threadId=${encodeURIComponent(threadId)}&path=${encodeURIComponent(filePath)}`, { timeoutMs: 15e3 });
					$("filePreviewTitle").textContent = file.fileName || label;
					$("filePreviewPath").textContent = file.relativePath || file.path || filePath;
					$("filePreviewMeta").textContent = filePreviewMetaText(file);
					$("filePreviewBody").innerHTML = renderFilePreviewContent(file, { threadId });
					hydrateGitHubLinkCards($("filePreviewBody"));
					hydrateMermaidDiagrams($("filePreviewBody"));
					const copyButton = $("filePreviewCopyPath");
					if (copyButton) copyButton.dataset.copyKey = rememberCopyText(file.path || filePath);
				} catch (err) {
					$("filePreviewMeta").textContent = "";
					$("filePreviewBody").innerHTML = `<div class="file-preview-error">${escapeHtml(err && err.message ? err.message : String(err))}</div>`;
				}
			}
			return {
				imageUrlValue,
				isInputTextPart,
				inputTextValue,
				isInputImagePart,
				isTruncatedImagePayloadPart,
				attachmentSummaryMarkerMatch,
				stripAttachmentSummaryLinePrefix,
				splitAttachmentSummaryText,
				parseAttachmentLine,
				codexMobileUploadIdForPath,
				uploadFileUrl,
				isCodexMobileUploadPath,
				imageContentUrlForPath,
				localAttachmentPreviewUrl,
				imageSourceForPart,
				isLikelyAbsoluteLocalPath,
				canRenderImageAttachment,
				isInjectedThreadTaskCardMessage,
				injectedThreadTaskCardLineValue,
				injectedThreadTaskCardPurpose,
				injectedThreadTaskCardMetadata,
				injectedThreadTaskCardSummary,
				injectedThreadTaskCardTextForItem,
				renderInjectedThreadTaskCardBody,
				renderInjectedThreadTaskCardMessage,
				renderInputText,
				renderInputImage,
				renderInputAttachment,
				renderAttachmentSummary,
				renderInputContent,
				renderMarkdown,
				renderMarkdownWithAttachmentSummary,
				commandOutputBody,
				stripCommandOutputLineNumbers,
				isMarkdownTableSeparatorLine,
				containsMarkdownTable,
				commandOutputMarkdownPreview,
				normalizeGitHubLinkPreview,
				normalizeGithubPreviewUrl,
				gitHubLinkPreviewAccentClass,
				renderGitHubLinkPreviewCard,
				fetchGitHubLinkPreview,
				githubLinkPreviewHosts,
				gitHubLinkPreviewSummary,
				gitHubLinkPreviewInlineHost,
				gitHubLinkPreviewInsertContainer,
				renderCollapsedGitHubLinkPreview,
				ensureInlineGitHubLinkPreviews,
				renderGitHubLinkPreviewUnavailable,
				setGitHubPreviewCompactExpanded,
				updateGitHubPreviewCompactTitle,
				toggleGitHubLinkPreview,
				hydrateGitHubLinkCard,
				hydrateGitHubLinkCards,
				mermaidEffectiveTheme,
				mermaidThemeName,
				mermaidConfig,
				mermaidPreviewOpen,
				loadRuntimeScript,
				configureMermaidApi,
				ensureMermaidApi,
				mermaidCanvas,
				mermaidViewer,
				mermaidSourceFromContainer,
				mermaidResetButton,
				updateMermaidResetLabel,
				clampMermaidScale,
				mermaidCurrentScale,
				mermaidSvgSize,
				mermaidInitialScale,
				applyMermaidScale,
				showMermaidLoading,
				showMermaidError,
				isMermaidErrorSvgMarkup,
				mermaidRenderArtifactIds,
				isOwnedMermaidRenderNode,
				removeNodeIfExternalMermaidArtifact,
				cleanupMermaidRenderArtifacts,
				cleanupExternalMermaidErrorArtifacts,
				renderMermaidSvg,
				mermaidRenderCandidates,
				renderMermaidIntoContainer,
				hydrateMermaidBlock,
				hydrateMermaidDiagrams,
				rerenderVisibleMermaidDiagrams,
				installMermaidThemeObserver,
				mermaidActionContainer,
				mermaidContainerFromViewer,
				resetMermaidScale,
				openMermaidPreview,
				closeMermaidPreview,
				handleMermaidAction,
				imagePreviewOpen,
				imagePreviewScaleLabel,
				applyImagePreviewScale,
				imagePreviewTitleForImage,
				openImagePreviewFromImage,
				closeImagePreview,
				handleImagePreviewAction,
				previewableImageFromEvent,
				touchDistance,
				touchCenter,
				pinchStateFromTouches,
				anchorOptionsFromTouches,
				beginImagePreviewPinch,
				moveImagePreviewPinch,
				finishImagePreviewPinch,
				beginMermaidPinch,
				moveMermaidPinch,
				finishMermaidPinch,
				renderThreadTaskCardDraftMessage,
				closeFilePreview,
				filePreviewOpen,
				beginFilePreviewSwipe,
				moveFilePreviewSwipe,
				finishFilePreviewSwipe,
				cancelFilePreviewSwipe,
				filePreviewMetaText,
				filePreviewContentUrl,
				hermesPluginProxyPrefixFromPathname,
				hermesPluginProxyPrefix,
				protectedImageUpstreamPathname,
				browserApiContentUrl,
				authenticatedApiContentUrl,
				localFilePreviewContentUrl,
				renderJsonPreview,
				parseCsvPreviewRows,
				renderCsvPreview,
				renderFilePreviewContent,
				imageViewPath,
				imageViewUrl,
				imageViewContentUrl,
				safeImageViewApiUrl,
				safeImageViewFallbackUrl,
				isImageViewUnavailable,
				renderImageView,
				handleConversationImageError,
				handleConversationImageLoad,
				failedAppImageContainer,
				setRetryingAppImage,
				markFailedAppImage,
				clearFailedAppImage,
				imageHadExplicitLoadError,
				isLazyAppImage,
				shouldProactivelyMarkFailedImage,
				protectedGeneratedImageSrc,
				imageLoadingModeForSource,
				shouldRenderProtectedImageDirectly,
				protectedImageDisplaySrc,
				protectedImageSourceAttribute,
				protectedAppImageElementSrc,
				imageDiagnosticSourceKind,
				imageDiagnosticSourceHash,
				imageDiagnosticDetails,
				postImageDiagnosticEvent,
				imageStillConnected,
				protectedAppImageUrlApi,
				revokeProtectedAppImageObjectUrl,
				retryProtectedAppImageSource,
				cacheBustedProtectedImageSrc,
				shouldRecoverProtectedImageAsDirectUrl,
				blobToDataUrl,
				protectedAppImageRecoveredUrl,
				applyProtectedAppImageRecoveredUrl,
				shouldHydrateProtectedAppImage,
				hydrateProtectedAppImage,
				hydrateProtectedAppImages,
				handleProtectedAppImageError,
				probeFailedAuthenticatedImage,
				scanFailedAppImages,
				scheduleFailedAppImageScan,
				scheduleVisibleImageFailureScan,
				showFilePreviewLoading,
				localFilePreviewThreadIdFromLink,
				openLocalFilePreview
			};
		}
		const api = { createMediaPreviewRuntime };
		if (typeof module !== "undefined" && module.exports) module.exports = api;
		root.CodexMediaPreviewRuntime = api;
	})(typeof window !== "undefined" ? window : globalThis);
}));
//#endregion
//#region \0virtual:codex-mobile-esm-compatibility/shard/shard-06
var import_thread_list_runtime = /* @__PURE__ */ __toESM(require_thread_list_runtime());
var import_side_chat_runtime = /* @__PURE__ */ __toESM(require_side_chat_runtime());
var import_media_preview_runtime = /* @__PURE__ */ __toESM(require_media_preview_runtime());
var moduleDefinitions = [
	{
		"id": "thread-list-runtime",
		"source": "public/thread-list-runtime.js",
		"globalName": "CodexThreadListRuntime",
		"expectedFunctions": ["createThreadListRuntime"],
		"assetPath": "/thread-list-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 37167
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
		"id": "media-preview-runtime",
		"source": "public/media-preview-runtime.js",
		"globalName": "CodexMediaPreviewRuntime",
		"expectedFunctions": ["createMediaPreviewRuntime"],
		"assetPath": "/media-preview-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 95096
	}
];
var moduleApis = {
	"thread-list-runtime": import_thread_list_runtime.default,
	"side-chat-runtime": import_side_chat_runtime.default,
	"media-preview-runtime": import_media_preview_runtime.default
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
