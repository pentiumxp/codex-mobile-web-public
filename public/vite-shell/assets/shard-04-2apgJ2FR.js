import { n as __toESM, t as __commonJSMin } from "./rolldown-runtime-FDOR9p9I.js";
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
//#region public/navigation-runtime.js
var require_navigation_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function updateConnectionState(status, fallbackText = "Starting") {
		const el = $("connectionState");
		if (!el) return;
		if (status) state.connectionStatus = status;
		const hasError = Boolean(status && !status.ready && status.lastError);
		if (status && status.ready) el.textContent = status.sharedRequired || String(status.transport || "").startsWith("external-") ? "Shared" : "Connected";
		else el.textContent = hasError ? status.lastError : fallbackText;
		el.classList.toggle("error", hasError);
		el.title = hasError ? status.lastError : "";
	}
	function restoreConnectionState(fallbackText = "Connected") {
		if (state.connectionStatus) {
			updateConnectionState(state.connectionStatus, fallbackText);
			return;
		}
		const el = $("connectionState");
		if (!el) return;
		el.textContent = fallbackText;
		el.classList.remove("error");
		el.title = "";
	}
	function autoTurnRecoveryCandidates() {
		const byId = /* @__PURE__ */ new Map();
		for (const thread of state.restartAutoRecoverThreads || []) {
			const normalized = normalizeRestartAutoRecoverThread(thread);
			if (normalized) byId.set(normalized.id, {
				threadId: normalized.id,
				activeTurnId: normalized.activeTurnId,
				cwd: normalized.cwd,
				wasRunning: true
			});
		}
		return Array.from(byId.values());
	}
	function autoTurnRecoveryRecentKey(candidate) {
		return `${candidate.threadId}|${candidate.activeTurnId || "latest"}`;
	}
	async function recoverTurnCandidateAfterReconnect(candidate, reason) {
		const key = autoTurnRecoveryRecentKey(candidate);
		const now = Date.now();
		const recentAt = Number(state.autoTurnRecoveryRecent[key] || 0);
		if (recentAt && now - recentAt < AUTO_TURN_RECOVERY_COOLDOWN_MS) return null;
		if (state.autoTurnRecoveryInFlight.has(key)) return null;
		state.autoTurnRecoveryInFlight.add(key);
		state.autoTurnRecoveryRecent[key] = now;
		try {
			const result = await api(`/api/threads/${encodeURIComponent(candidate.threadId)}/auto-recover`, {
				method: "POST",
				body: JSON.stringify({
					activeTurnId: candidate.activeTurnId,
					wasRunning: candidate.wasRunning,
					cwd: candidate.cwd,
					permissionMode: selectedComposerPermissionMode(),
					reason
				}),
				timeoutMs: 18e4
			});
			postClientEvent("auto_turn_recovery_result", {
				reason,
				threadId: candidate.threadId,
				activeTurnId: candidate.activeTurnId,
				recovered: Boolean(result && result.recovered),
				skipped: Boolean(result && result.skipped),
				action: String(result && result.action || ""),
				resultReason: String(result && result.reason || ""),
				turnId: String(result && result.turnId || "")
			});
			if (result && result.recovered && candidate.threadId === state.currentThreadId) {
				if (result.turnId) state.activeTurnId = String(result.turnId);
				scheduleCurrentThreadRefresh(500);
				scheduleLivePollIfNeeded(1e3);
			}
			return result;
		} catch (err) {
			delete state.autoTurnRecoveryRecent[key];
			postClientEvent("auto_turn_recovery_failed", {
				reason,
				threadId: candidate.threadId,
				activeTurnId: candidate.activeTurnId,
				error: err.message || String(err)
			});
			return null;
		} finally {
			state.autoTurnRecoveryInFlight.delete(key);
		}
	}
	async function maybeAutoRecoverTurnAfterReconnect(status, reason = "reconnect") {
		if (!status || !status.ready || document.visibilityState === "hidden" || !state.key) return;
		const candidates = autoTurnRecoveryCandidates();
		if (!candidates.length) return;
		markActivity("自动续接中");
		let recoveredCount = 0;
		for (const candidate of candidates) {
			const result = await recoverTurnCandidateAfterReconnect(candidate, reason);
			if (result && result.recovered) recoveredCount += 1;
		}
		if (state.restartAutoRecoverThreads.length) clearRestartAutoRecoverThreads();
		if (recoveredCount > 0) {
			markActivity(recoveredCount === 1 ? "已自动续接" : `已自动续接 ${recoveredCount} 个线程`);
			loadThreads({ silent: true }).catch(showError);
		}
	}
	function showComposerFastHint(enabled) {
		const el = $("connectionState");
		if (!el) return;
		if (state.composerFastHintTimer) window.clearTimeout(state.composerFastHintTimer);
		el.classList.remove("error");
		el.textContent = enabled ? "Fast on" : "Fast off";
		el.title = enabled ? "Fast tag enabled for this thread" : "Fast tag disabled for this thread";
		state.composerFastHintTimer = window.setTimeout(() => {
			state.composerFastHintTimer = null;
			restoreConnectionState();
		}, 1600);
	}
	function clearReconnectTimers() {
		clearTimeout(state.reconnectNoticeTimer);
		clearTimeout(state.recoveryTimer);
		clearTimeout(state.eventRetryTimer);
		clearTimeout(state.eventFallbackPollTimer);
		state.reconnectNoticeTimer = null;
		state.recoveryTimer = null;
		state.eventRetryTimer = null;
		state.eventFallbackPollTimer = null;
	}
	function markActivity(label) {
		state.activityLabel = String(label || "").trim();
		state.activityAtMs = state.activityLabel ? Date.now() : 0;
		updateTurnTimer();
	}
	function clearSteerFeedbackTimer() {
		if (state.steerFeedbackTimer) window.clearTimeout(state.steerFeedbackTimer);
		state.steerFeedbackTimer = null;
	}
	function setSteerFeedback(status, details = {}) {
		clearSteerFeedbackTimer();
		const previous = state.steerFeedback || {};
		const next = Object.assign({}, previous, details, {
			status,
			updatedAtMs: Date.now()
		});
		state.steerFeedback = next;
		const connection = $("connectionState");
		if (connection) {
			connection.classList.toggle("error", status === "failed");
			connection.textContent = steerFeedbackLabel(status);
		}
		markActivity(steerFeedbackLabel(status));
		if (status === "applied" || status === "failed" || status === "completed") state.steerFeedbackTimer = window.setTimeout(() => {
			state.steerFeedback = null;
			state.steerFeedbackTimer = null;
			restoreConnectionState();
			updateTurnTimer();
		}, status === "failed" ? 3200 : 2400);
	}
	function steerFeedbackLabel(status) {
		if (status === "sending") return "引导中…";
		if (status === "delivered") return "引导已送达";
		if (status === "applied") return "Agent 已继续处理";
		if (status === "completed") return "引导已送达，任务已结束";
		if (status === "failed") return "引导失败，请重试";
		return "";
	}
	function isPendingSteerForTurn(turnId) {
		const feedback = state.steerFeedback;
		if (!feedback || !feedback.turnId || !turnId) return false;
		if (feedback.turnId !== String(turnId)) return false;
		return feedback.status === "sending" || feedback.status === "delivered";
	}
	function markSteerAppliedIfNeeded(turnId, item = null) {
		if (!isPendingSteerForTurn(turnId)) return;
		if (item && item.type === "userMessage") return;
		setSteerFeedback("applied", { turnId: String(turnId) });
	}
	function isIdleSyncActivityLabel(label) {
		return String(label || "").trim() === "同步";
	}
	function markIdleActivity(label) {
		const liveTurn = currentLiveTurn();
		if (!state.activeTurnId && !liveTurn) return;
		if (liveActivityLabelForTurn(liveTurn)) return;
		if (isIdleSyncActivityLabel(label) && liveTurn) return;
		if (state.activityAtMs && Date.now() - state.activityAtMs < 3e3) return;
		markActivity(label);
	}
	function normalizeFsPath(value) {
		return String(value || "").replace(/^\\\\\?\\/, "").replace(/[\\/]+/g, "\\").replace(/\\+$/, "").toLowerCase();
	}
	function draftKeyForThread(threadId) {
		return draftStore.keyForThread(threadId);
	}
	function draftKeyForNewThread(cwd) {
		return draftStore.keyForNewThread(cwd);
	}
	function effectiveThreadTileSelectedThreadId(ids = state.threadTileActiveIds) {
		return threadTileStatePolicy.effectiveSelectedThreadId({
			enabled: state.threadTileMode,
			activeIds: ids,
			selectedThreadId: state.threadTileSelectedThreadId,
			currentThreadId: state.currentThreadId,
			maxPanes: THREAD_TILE_USER_MAX_PANES
		});
	}
	function threadTileComposerSurfaceActive() {
		const conversation = $("conversation");
		return Boolean(conversation && conversation.classList.contains("thread-tile-mode"));
	}
	function composerTargetPlan() {
		return threadTileStatePolicy.composerTargetPlan({
			newThreadDraft: state.newThreadDraft,
			threadTileMode: state.threadTileMode,
			tileSurfaceActive: threadTileComposerSurfaceActive(),
			activeIds: state.threadTileActiveIds,
			selectedThreadId: state.threadTileSelectedThreadId,
			currentThreadId: state.currentThreadId
		}, { maxPanes: THREAD_TILE_USER_MAX_PANES });
	}
	function currentComposerThreadId() {
		return composerTargetPlan().targetThreadId || "";
	}
	function isThreadTileComposerContext() {
		return composerTargetPlan().tileContext === true;
	}
	function composerTargetThread() {
		const id = currentComposerThreadId();
		if (!id) return null;
		if (state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
		return threadTileDisplayThread(id);
	}
	function composerTargetActiveTurnId() {
		const target = composerTargetThread();
		if (!target) return "";
		if (state.currentThread && String(state.currentThread.id || "") === String(target.id || "") && state.activeTurnId) {
			const activeTurnId = String(state.activeTurnId);
			const activeTurn = (Array.isArray(target.turns) ? target.turns : []).find((turn) => String(turn && turn.id || "") === activeTurnId);
			if (activeTurn && isLiveTurnForThread(target, activeTurn)) return activeTurnId;
			state.activeTurnId = "";
		}
		return activeTurnIdForThread(target);
	}
	function currentDraftKey() {
		if (state.newThreadDraft) return draftKeyForNewThread(state.selectedCwd);
		return draftKeyForThread(currentComposerThreadId());
	}
	function readDraftMap() {
		return draftStore.readMap();
	}
	function writeDraftMap(map) {
		draftStore.writeMap(map);
	}
	function normalizeDraftAttachmentMeta(item) {
		return draftStore.normalizeAttachmentMeta(item);
	}
	function buildCurrentDraft() {
		const draft = {
			text: composerText(),
			attachments: state.pendingAttachments.map(normalizeDraftAttachmentMeta).filter(Boolean),
			updatedAt: Date.now()
		};
		if (state.newThreadDraft) {
			draft.cwd = state.selectedCwd || "";
			if (state.newThreadTitle) draft.threadTitle = state.newThreadTitle;
			if (state.newThreadModel && state.newThreadModel !== defaultNewThreadModel()) draft.model = state.newThreadModel;
			if (state.newThreadEffort && state.newThreadEffort !== defaultNewThreadEffort()) draft.effort = state.newThreadEffort;
			const permission = normalizePermissionModeValue(state.newThreadPermissionMode);
			if (permission && permission !== defaultNewThreadPermissionMode()) draft.permissionMode = permission;
		} else {
			if (state.composerModel) draft.model = state.composerModel;
			if (state.composerEffort) draft.effort = state.composerEffort;
			const permission = normalizePermissionModeValue(state.composerPermissionMode);
			if (permission) draft.permissionMode = permission;
		}
		if (codexFastCommandEnabled()) draft.fastMode = true;
		return draft;
	}
	function draftHasContent(draft) {
		return draftStore.hasContent(draft);
	}
	async function storeDraftAttachment(draftKey, item) {
		return draftStore.storeAttachment(draftKey, item);
	}
	async function loadDraftAttachment(draftKey, meta) {
		return draftStore.loadAttachment(draftKey, meta);
	}
	async function deleteDraftAttachments(draftKey, attachmentIds = null) {
		return draftStore.deleteAttachments(draftKey, attachmentIds);
	}
	function saveDraftAttachmentFiles(draftKey, items) {
		if (!draftKey || !items || !items.length) return;
		if (!("indexedDB" in window)) {
			if (!state.draftAttachmentWarningShown) {
				state.draftAttachmentWarningShown = true;
				showError(/* @__PURE__ */ new Error("当前浏览器不能持久保存草稿附件；刷新后需要重新选择附件。"));
			}
			return;
		}
		Promise.all(items.map((item) => storeDraftAttachment(draftKey, item))).catch((err) => {
			postClientEvent("draft_attachment_save_failed", { message: err.message || String(err) });
			showError(/* @__PURE__ */ new Error("附件已加入本次发送，但浏览器没有保存草稿附件；刷新后可能需要重新选择。"));
		});
	}
	function saveCurrentDraftNow() {
		clearTimeout(state.draftSaveTimer);
		state.draftSaveTimer = null;
		if (state.composerBusy) return;
		const key = currentDraftKey();
		if (!key) return;
		writeCurrentDraftToKey(key);
	}
	function writeCurrentDraftToKey(key) {
		const targetKey = String(key || "");
		if (!targetKey) return;
		const map = readDraftMap();
		const draft = buildCurrentDraft();
		if (draftHasContent(draft)) {
			map[targetKey] = draft;
			if (targetKey.startsWith("new:")) draftStore.setTargetKey(targetKey);
		} else {
			delete map[targetKey];
			draftStore.clearTargetKeyIfMatches(targetKey);
		}
		writeDraftMap(map);
	}
	function scheduleCurrentDraftSave() {
		clearTimeout(state.draftSaveTimer);
		state.draftSaveTimer = setTimeout(saveCurrentDraftNow, DRAFT_SAVE_DEBOUNCE_MS);
	}
	function clearDraftForKey(draftKey) {
		const key = String(draftKey || "");
		if (!key) return;
		const map = readDraftMap();
		delete map[key];
		writeDraftMap(map);
		draftStore.clearTargetKeyIfMatches(key);
		deleteDraftAttachments(key).catch((err) => {
			postClientEvent("draft_attachment_clear_failed", { message: err.message || String(err) });
		});
	}
	function defaultNewThreadModel() {
		return state.defaultModel || state.modelOptions[0] || "";
	}
	function defaultNewThreadEffort() {
		return state.defaultReasoningEffort || state.reasoningEffortOptions[0] || "";
	}
	function defaultNewThreadPermissionMode() {
		return normalizePermissionModeValue(state.defaultPermissionMode) || "full";
	}
	function applyDraftRuntimeSelection(draft, options = {}) {
		const plan = threadTileStatePolicy.composerDraftRuntimeSelectionPlan({
			draft,
			newThreadDraft: state.newThreadDraft,
			modelOptions: state.modelOptions,
			reasoningEffortOptions: state.reasoningEffortOptions,
			permissionModeOptions: state.permissionModeOptions,
			effectivePermissionMode: effectiveComposerPermissionMode(draft && draft.permissionMode),
			defaultNewThreadModel: defaultNewThreadModel(),
			defaultNewThreadEffort: defaultNewThreadEffort(),
			defaultNewThreadPermissionMode: defaultNewThreadPermissionMode(),
			resetRuntimeWhenMissingDraft: options.resetRuntimeWhenMissingDraft === true
		});
		state.codexFastMode = plan.fastMode === true;
		if (plan.setNewThreadRuntime) {
			state.newThreadTitle = plan.newThreadTitle || "";
			state.newThreadModel = plan.newThreadModel || defaultNewThreadModel();
			state.newThreadEffort = plan.newThreadEffort || defaultNewThreadEffort();
			state.newThreadPermissionMode = plan.newThreadPermissionMode || defaultNewThreadPermissionMode();
			return;
		}
		if (plan.clearNewThreadTitle) state.newThreadTitle = "";
		if (!plan.setThreadRuntime) return;
		state.composerModel = plan.composerModel || "";
		state.composerEffort = plan.composerEffort || "";
		state.composerPermissionMode = plan.composerPermissionMode || "";
	}
	function revokeAttachmentPreviewUrls(attachments) {
		for (const item of attachments || []) if (item && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
	}
	function scheduleAttachmentPreviewUrlRevoke(attachments, delayMs = 18e4) {
		const urls = (attachments || []).map((item) => item && item.previewUrl).filter(Boolean);
		if (!urls.length) return;
		setTimeout(() => {
			revokeAttachmentPreviewUrls(urls.map((previewUrl) => ({ previewUrl })));
		}, Math.max(1e3, Number(delayMs) || 18e4));
	}
	function replacePendingAttachments(items, options = {}) {
		if (options.revokePreviewUrls !== false) revokeAttachmentPreviewUrls(state.pendingAttachments);
		state.pendingAttachments = Array.isArray(items) ? items : [];
		renderAttachmentList();
		if (options.saveDraft !== false) scheduleCurrentDraftSave();
	}
	function restoreDraftForCurrentTarget(options = {}) {
		clearTimeout(state.draftSaveTimer);
		state.draftSaveTimer = null;
		const key = currentDraftKey();
		const draft = key ? readDraftMap()[key] : null;
		const restoreSeq = state.draftRestoreSeq + 1;
		state.draftRestoreSeq = restoreSeq;
		setComposerText(draft && draft.text ? draft.text : "");
		applyDraftRuntimeSelection(draft || null, options);
		replacePendingAttachments([], { saveDraft: false });
		renderComposerSettings();
		updateComposerControls();
		const metas = draft && Array.isArray(draft.attachments) ? draft.attachments : [];
		if (!key || !metas.length) return;
		Promise.all(metas.map((meta) => loadDraftAttachment(key, meta).catch(() => null))).then((items) => {
			if (restoreSeq !== state.draftRestoreSeq || key !== currentDraftKey()) {
				for (const item of items) if (item && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
				return;
			}
			const restored = items.filter(Boolean);
			replacePendingAttachments(restored, { saveDraft: false });
			if (restored.length !== metas.length) showError(/* @__PURE__ */ new Error("有草稿附件没有恢复，请重新选择后再发送。"));
		}).catch((err) => {
			postClientEvent("draft_restore_failed", { message: err.message || String(err) });
		});
	}
	function visibleWorkspaceKeys() {
		return new Set(state.workspaces.map((ws) => normalizeFsPath(ws.cwd)).filter(Boolean));
	}
	function basenameForFsPath(value) {
		const parts = normalizeFsPath(value).split("\\").filter(Boolean);
		return parts.length ? parts[parts.length - 1] : "";
	}
	function visibleWorkspaceNames() {
		return new Set(state.workspaces.map((ws) => basenameForFsPath(ws.cwd)).filter(Boolean));
	}
	function codexWorktreeRepoName(value) {
		const normalized = normalizeFsPath(value);
		const index = normalized.indexOf("\\.codex\\worktrees\\");
		if (index < 0) return "";
		const parts = normalized.slice(index + 18).split("\\").filter(Boolean);
		return parts.length >= 2 ? parts[1] : "";
	}
	var MESSAGE_INPUT_MIN_HEIGHT_PX = 44;
	var MESSAGE_INPUT_MAX_HEIGHT_PX = 160;
	function threadMatchesWorkspaceCwd(...args) {
		return threadListRuntime.threadMatchesWorkspaceCwd(...args);
	}
	function threadMatchesVisibleWorkspace(...args) {
		return threadListRuntime.threadMatchesVisibleWorkspace(...args);
	}
	function isHiddenThread(...args) {
		return threadListRuntime.isHiddenThread(...args);
	}
	function visibleThreads(...args) {
		return threadListRuntime.visibleThreads(...args);
	}
	function pruneHiddenThreads(...args) {
		return threadListRuntime.pruneHiddenThreads(...args);
	}
	function applyThreadStatusToThread(...args) {
		return threadListRuntime.applyThreadStatusToThread(...args);
	}
	function scheduleThreadStatusDetailRender(...args) {
		return threadListRuntime.scheduleThreadStatusDetailRender(...args);
	}
	function updateThreadListStatus(...args) {
		return threadListRuntime.updateThreadListStatus(...args);
	}
	function localThreadForStatusContext(...args) {
		return threadListRuntime.localThreadForStatusContext(...args);
	}
	function snapshotThreadStatus(...args) {
		return threadListRuntime.snapshotThreadStatus(...args);
	}
	function restoreThreadStatusSnapshot(...args) {
		return threadListRuntime.restoreThreadStatusSnapshot(...args);
	}
	function markThreadOptimisticallyActive(threadId) {
		const id = String(threadId || "");
		if (!id) return;
		const runningStatus = { type: "active" };
		noteSubmittedProcessingThreadHint(id);
		const listThread = state.threads.find((entry) => String(entry && entry.id || "") === id) || null;
		const currentMatches = Boolean(state.currentThread && String(state.currentThread.id || "") === id);
		const tileThread = state.threadTileDetails && state.threadTileDetails.get(String(id)) || null;
		const targetThread = localThreadForStatusContext(id) || (currentMatches ? state.currentThread : listThread || tileThread);
		const previousStatus = targetThread && targetThread.status;
		updateThreadStatusHints(id, previousStatus, runningStatus, {
			thread: targetThread,
			threadName: threadDisplayName(targetThread),
			notify: false
		});
		updateThreadListStatus(id, runningStatus, { render: true });
		if (currentMatches) {
			state.currentThread = Object.assign({}, state.currentThread, { status: runningStatus });
			mergeThreadIntoThreadList(state.currentThread);
		}
	}
	function mergeThreadIntoThreadList(thread) {
		const result = threadDetailStateApi.mergeThreadSummaryIntoList(state.threads, thread, { visibleThreads });
		if (!result.changed) return false;
		state.threads = result.threads;
		return result.changed;
	}
	function isRunningStatus(status) {
		const text = statusText(status).toLowerCase();
		return /(running|active|queued|processing|inprogress|in_progress|in-progress)/.test(text) && !/(completed|failed|cancel|error|interrupted)/.test(text);
	}
	function isCompletedStatus(status) {
		return /completed|failed|cancel|error|interrupted/i.test(statusText(status));
	}
	function isTurnComplete(turn) {
		return Boolean(turn && (turn.completedAt || turn.durationMs || isCompletedStatus(turn.status)));
	}
	function isStaleOrSupersededLiveTurn(turn) {
		return Boolean(turn && (turn.mobileStaleActiveTurn || isStaleActiveStatus(turn.status) || isSupersededLiveTurn(turn)));
	}
	function isReasoningItem(item) {
		return item && item.type === "reasoning";
	}
	function syncActiveTurnFromThread() {
		const running = latestLiveTurnCandidate();
		state.activeTurnId = running ? running.id : "";
		const interrupt = $("interruptTurn");
		if (interrupt) interrupt.disabled = !state.activeTurnId;
		updateComposerControls();
	}
	function isOperationalItem(item) {
		return item && (OPERATIONAL_ITEM_TYPES.has(item.type) || isWebSearchLikeItem(item));
	}
	function isActiveOperationalItem(item) {
		if (!isOperationalItem(item)) return false;
		const completedByTimestamp = Boolean(item.completedAtMs || item.completedAt || item.completed_at_ms || item.completed_at);
		return !isCompletedStatus(statusText(item.status) || (completedByTimestamp ? "completed" : ""));
	}
	function activityLabelForItem(item) {
		if (!item) return "更新";
		const completed = isCompletedStatus(statusText(item.status));
		if (isWebSearchLikeItem(item)) return completed ? "搜索完成" : "搜索";
		if (item.type === "commandExecution") return completed ? "命令完成" : "命令";
		if (item.type === "collabAgentToolCall") return completed ? "协作完成" : "协作 Agent";
		if (item.type === "fileChange") return completed ? "文件完成" : "文件";
		if (item.type === "dynamicToolCall" || item.type === "mcpToolCall") return completed ? "工具完成" : "工具";
		if (item.type === "agentMessage") return "输出";
		if (item.type === "userMessage") return "输入";
		if (item.type === "plan") return "计划";
		if (item.type === "reasoning") return "思考";
		return completed ? "更新完成" : "更新";
	}
	function isWebSearchLikeItem(item) {
		if (!item) return false;
		return /web[_-]?search|websearch|search_query|image_query/i.test([
			item.type,
			item.tool,
			item.name,
			item.namespace,
			item.server
		].filter(Boolean).join(" "));
	}
	function isContextCompactionType(type) {
		return /context.*compaction|context.*compression|context_compaction|context_compression/i.test(String(type || ""));
	}
	function isContextCompactionItem(item) {
		return item && (isContextCompactionType(item.type) || item.mobileNotice === CONTEXT_COMPACTION_COMPLETE_NOTICE || item.mobileNotice === CONTEXT_COMPACTION_PENDING_NOTICE || item.mobileCompactionStatus);
	}
	function contextCompactionStatusKind(value) {
		const text = statusText(value).toLowerCase();
		if (!text) return "";
		if (/completed|failed|cancel|error|interrupted/.test(text)) return "complete";
		if (/running|active|queued|processing|inprogress|in_progress|in-progress|pending|started/.test(text)) return "pending";
		return "";
	}
	function canShowPendingContextCompaction(turn = null, thread = null) {
		return !turn || isLatestTurn(turn, thread) && isLiveTurn(turn, thread);
	}
	function contextCompactionState(item, turn = null, thread = null) {
		if (!item) return "";
		const itemKind = contextCompactionStatusKind(item.status);
		const mobileKind = contextCompactionStatusKind(item.mobileCompactionStatus);
		if (itemKind === "complete" || mobileKind === "complete" || item.mobileNotice === CONTEXT_COMPACTION_COMPLETE_NOTICE) return "complete";
		if (itemKind === "pending" || mobileKind === "pending" || item.mobileNotice === CONTEXT_COMPACTION_PENDING_NOTICE) return canShowPendingContextCompaction(turn, thread) ? "pending" : "";
		return "";
	}
	function contextCompactionNotice(item, turn = null, thread = null) {
		const stateText = contextCompactionState(item, turn, thread);
		if (stateText === "pending") return CONTEXT_COMPACTION_PENDING_NOTICE;
		if (stateText === "complete") return CONTEXT_COMPACTION_COMPLETE_NOTICE;
		return "";
	}
	function turnHasDisplayItems(turn) {
		return Boolean(turn && Array.isArray(turn.items) && turn.items.some(Boolean));
	}
	function latestTurn(thread = null) {
		const sourceThread = renderContextThread(thread);
		const turns = sourceThread && Array.isArray(sourceThread.turns) ? sourceThread.turns : [];
		for (let index = turns.length - 1; index >= 0; index -= 1) if (turnHasDisplayItems(turns[index])) return turns[index];
		return turns.length ? turns[turns.length - 1] : null;
	}
	function latestRawTurn(thread = null) {
		const sourceThread = renderContextThread(thread);
		const turns = sourceThread && Array.isArray(sourceThread.turns) ? sourceThread.turns : [];
		return turns.length ? turns[turns.length - 1] : null;
	}
	function turnHasNewerDisplayTurn(thread, turn) {
		if (!turn) return false;
		const sourceThread = renderContextThread(thread);
		const turns = sourceThread && Array.isArray(sourceThread.turns) ? sourceThread.turns : [];
		const index = turns.indexOf(turn);
		if (index < 0) return false;
		for (let cursor = index + 1; cursor < turns.length; cursor += 1) if (turnHasDisplayItems(turns[cursor])) return true;
		return false;
	}
	function currentThreadHasActiveRuntimeStatus(thread = null) {
		const sourceThread = renderContextThread(thread);
		if (!sourceThread || isStaleActiveStatus(sourceThread.status) || sourceThread.mobileStaleActiveTurn) return false;
		const threadId = String(sourceThread.id || "");
		if (Boolean(threadId && threadId === String(state.currentThreadId || "")) && state.activeTurnId) {
			const active = turnById(state.activeTurnId);
			if (active && isLiveTurnForThread(sourceThread, active)) return true;
		}
		return isRunningStatus(sourceThread.status);
	}
	function currentThreadHasForegroundActiveRuntimeStatus(thread = null) {
		const sourceThread = renderContextThread(thread);
		if (!sourceThread || isStaleActiveStatus(sourceThread.status) || sourceThread.mobileStaleActiveTurn) return false;
		const threadId = String(sourceThread.id || "");
		if (Boolean(threadId && threadId === String(state.currentThreadId || "")) && state.activeTurnId) {
			const active = turnById(state.activeTurnId);
			if (active && isLiveTurnForThread(sourceThread, active)) return true;
		}
		return Boolean(latestLiveTurnForThread(sourceThread));
	}
	function latestLiveTurnCandidate() {
		const displayLatest = latestTurn();
		if (displayLatest && !isStaleOrSupersededLiveTurn(displayLatest) && !isTurnComplete(displayLatest) && isRunningStatus(displayLatest.status)) return displayLatest;
		const rawLatest = latestRawTurn();
		return rawLatest && !isStaleOrSupersededLiveTurn(rawLatest) && !isTurnComplete(rawLatest) && isRunningStatus(rawLatest.status) ? rawLatest : null;
	}
	function turnById(turnId) {
		const id = String(turnId || "");
		if (!id || !state.currentThread || !Array.isArray(state.currentThread.turns)) return null;
		return state.currentThread.turns.find((turn) => String(turn && turn.id || "") === id) || null;
	}
	function isIncompleteInterruptedTurn(turn) {
		return turn && statusText(turn.status).toLowerCase() === "interrupted" && !turn.completedAt && !turn.durationMs;
	}
	function shouldPollCurrentThread() {
		if (!state.currentThreadId || document.visibilityState === "hidden") return false;
		if (currentThreadHasActiveRuntimeStatus()) return true;
		const turn = latestTurn();
		if (!turn) return false;
		if (isStaleOrSupersededLiveTurn(turn)) return false;
		if (isTurnComplete(turn)) return false;
		return Boolean(state.activeTurnId) || isRunningStatus(turn.status) || isIncompleteInterruptedTurn(turn);
	}
	function currentThreadListRowChanged() {
		if (!state.currentThreadId || !state.currentThread) return false;
		const row = threadById(state.currentThreadId);
		if (!row) return false;
		const rowUpdatedAt = threadUpdatedAtMs(row);
		const detailUpdatedAt = threadUpdatedAtMs(state.currentThread);
		if (rowUpdatedAt > 0 && rowUpdatedAt > detailUpdatedAt + 1e3) return true;
		const rowStatus = statusText(row.status);
		const detailStatus = statusText(state.currentThread.status);
		return Boolean(rowStatus && detailStatus && rowStatus !== detailStatus);
	}
	function currentThreadNeedsForegroundRefresh() {
		if (!state.currentThreadId || !state.currentThread) return false;
		if (state.currentThread.mobileLoading || state.currentThread.mobileLoadError) return true;
		return shouldPollCurrentThread() || currentThreadListRowChanged();
	}
	function isLiveTurn(turn, thread = null) {
		if (!turn || isTurnComplete(turn) || isStaleOrSupersededLiveTurn(turn)) return false;
		if (turnHasNewerDisplayTurn(thread, turn)) return false;
		return isRunningStatus(turn && turn.status) || isIncompleteInterruptedTurn(turn) || turnHasActiveLiveItems(turn) || isLatestTurn(turn, thread) && currentThreadHasActiveRuntimeStatus(thread);
	}
	function isLatestTurn(turn, thread = null) {
		return Boolean(turn && latestTurn(thread) === turn);
	}
	function stableItemKey(turn, item, index = 0, prefix = "item") {
		const threadId = renderContextThreadId() || "thread";
		const turnId = clientRenderStabilityGuard.stableTurnIdentity(turn);
		let itemId = item && item.mobileVisibleKey || item && item.id || `${item && item.type || "item"}-${index}`;
		if (item && (item.type === "imageView" || item.type === "imageGeneration")) {
			const imageSource = [
				imageViewPath(item),
				imageViewContentUrl(item),
				imageViewUrl(item)
			].filter(Boolean).map(imageSourceSignature).join("|");
			if (imageSource) itemId = `${itemId}|${stableTextHash(imageSource)}`;
		}
		return [
			prefix,
			threadId,
			turnId,
			itemId
		].map((part) => String(part || "")).join("|");
	}
	function stableTextHash(value) {
		const text = String(value || "");
		let hash = 2166136261;
		for (let index = 0; index < text.length; index += 1) {
			hash ^= text.charCodeAt(index);
			hash = Math.imul(hash, 16777619);
		}
		return (hash >>> 0).toString(36);
	}
	function stableOperationRenderKey(turn, item, index = 0) {
		return [
			"live-operation",
			renderContextThreadId() || "thread",
			turn && (turn.id || turn.startedAt || "turn"),
			operationGroupKey(item) || `item:${item && (item.id || index)}`,
			item && (item.mobileVisibleKey || item.id || item.callId || item.requestId || item.startedAtMs || item.startedAt) || `index:${index}`,
			index
		].map((part) => String(part ?? "")).join("|");
	}
	function stableTurnKey(turn, suffix = "") {
		return [
			"turn",
			renderContextThreadId() || "thread",
			clientRenderStabilityGuard.stableTurnIdentity(turn),
			suffix
		].filter(Boolean).join("|");
	}
	function existingConversationRenderKeys() {
		const el = $("conversation");
		if (!el) return /* @__PURE__ */ new Set();
		return new Set(Array.from(el.querySelectorAll("[data-render-key]")).map((node) => node.dataset.renderKey).filter(Boolean));
	}
	function entryAnimationClass(key, previousKeys) {
		return previousKeys && previousKeys.has(key) ? "" : " entry-animate";
	}
	function isNodeStartAboveConversationViewport(node) {
		const conversation = $("conversation");
		if (!conversation || !node) return false;
		const viewport = conversation.getBoundingClientRect();
		return node.getBoundingClientRect().top < viewport.top + 24;
	}
	function liveTurnHasNonUserProgress(...args) {
		return requireThreadDetailRuntime().liveTurnHasNonUserProgress(...args);
	}
	function isVisibleNonUserProgressItem(...args) {
		return requireThreadDetailRuntime().isVisibleNonUserProgressItem(...args);
	}
	function liveTurnHasNonUserProgressBefore(...args) {
		return requireThreadDetailRuntime().liveTurnHasNonUserProgressBefore(...args);
	}
	function liveTurnHasNonUserProgressAfter(...args) {
		return requireThreadDetailRuntime().liveTurnHasNonUserProgressAfter(...args);
	}
	function isUserVisibleTextReplyItem(...args) {
		return requireThreadDetailRuntime().isUserVisibleTextReplyItem(...args);
	}
	function liveTurnHasUserVisibleTextReplyAfter(...args) {
		return requireThreadDetailRuntime().liveTurnHasUserVisibleTextReplyAfter(...args);
	}
	function userMessageHasVisualAttachment(...args) {
		return requireThreadDetailRuntime().userMessageHasVisualAttachment(...args);
	}
	function shouldHideDurableLiveUserMessage(...args) {
		return requireThreadDetailRuntime().shouldHideDurableLiveUserMessage(...args);
	}
	function durableUserMessageMatchesOptimisticEcho(...args) {
		return requireThreadDetailRuntime().durableUserMessageMatchesOptimisticEcho(...args);
	}
	function threadHasDurableUserMessageWithSubmissionId(...args) {
		return requireThreadDetailRuntime().threadHasDurableUserMessageWithSubmissionId(...args);
	}
	function threadHasDurableUserMessageMatchingOptimisticEcho(...args) {
		return requireThreadDetailRuntime().threadHasDurableUserMessageMatchingOptimisticEcho(...args);
	}
	function shouldHideOptimisticUserMessageEcho(...args) {
		return requireThreadDetailRuntime().shouldHideOptimisticUserMessageEcho(...args);
	}
	function isSupersededLiveTurn(...args) {
		return requireThreadDetailRuntime().isSupersededLiveTurn(...args);
	}
	function shouldHideSupersededLiveUserMessage(...args) {
		return requireThreadDetailRuntime().shouldHideSupersededLiveUserMessage(...args);
	}
	function isRawThreadReadMode(...args) {
		return requireThreadDetailRuntime().isRawThreadReadMode(...args);
	}
	function shouldPreserveRawThreadVisibleEntry(...args) {
		return requireThreadDetailRuntime().shouldPreserveRawThreadVisibleEntry(...args);
	}
	function itemTextValue(...args) {
		return requireThreadDetailRuntime().itemTextValue(...args);
	}
	function reasoningItemHasVisibleText(...args) {
		return requireThreadDetailRuntime().reasoningItemHasVisibleText(...args);
	}
	function isLatestCompletedProcessTurn(...args) {
		return requireThreadDetailRuntime().isLatestCompletedProcessTurn(...args);
	}
	function limitRawThreadVisibleEntries(...args) {
		return requireThreadDetailRuntime().limitRawThreadVisibleEntries(...args);
	}
	function visibleItemsForTurn(...args) {
		return requireThreadDetailRuntime().visibleItemsForTurn(...args);
	}
	function currentLiveOperationEntry(...args) {
		return requireThreadDetailRuntime().currentLiveOperationEntry(...args);
	}
	function liveTurnStatusDockItem(...args) {
		return requireThreadDetailRuntime().liveTurnStatusDockItem(...args);
	}
	function visibleItemSignature(...args) {
		return requireThreadDetailRuntime().visibleItemSignature(...args);
	}
	function visibleItemBudgetForTurn(...args) {
		return requireThreadDetailRuntime().visibleItemBudgetForTurn(...args);
	}
	function visibleItemBudgetSignature(...args) {
		return requireThreadDetailRuntime().visibleItemBudgetSignature(...args);
	}
	function inputContentSignature(...args) {
		return requireThreadDetailRuntime().inputContentSignature(...args);
	}
	function imageSourceSignature(...args) {
		return requireThreadDetailRuntime().imageSourceSignature(...args);
	}
	function compactStructuredForSignature(...args) {
		return requireThreadDetailRuntime().compactStructuredForSignature(...args);
	}
	function itemVisibleWeight(...args) {
		return requireThreadDetailRuntime().itemVisibleWeight(...args);
	}
	function turnVisibleWeight(...args) {
		return requireThreadDetailRuntime().turnVisibleWeight(...args);
	}
	function isAssistantReceiptLikeItem(...args) {
		return requireThreadDetailRuntime().isAssistantReceiptLikeItem(...args);
	}
	function completedIncomingTurnHasAuthoritativeReceipt(...args) {
		return requireThreadDetailRuntime().completedIncomingTurnHasAuthoritativeReceipt(...args);
	}
	function shouldDropLocalOnlyReceiptForIncomingTurn(...args) {
		return requireThreadDetailRuntime().shouldDropLocalOnlyReceiptForIncomingTurn(...args);
	}
	function shouldPreserveLocalOnlyItem(...args) {
		return requireThreadDetailRuntime().shouldPreserveLocalOnlyItem(...args);
	}
	function isMuxUserMessage(...args) {
		return requireThreadDetailRuntime().isMuxUserMessage(...args);
	}
	function isOptimisticUserMessage(...args) {
		return requireThreadDetailRuntime().isOptimisticUserMessage(...args);
	}
	function userMessageSubmissionIdCandidates(...args) {
		return requireThreadDetailRuntime().userMessageSubmissionIdCandidates(...args);
	}
	function userMessageHasSubmissionId(...args) {
		return requireThreadDetailRuntime().userMessageHasSubmissionId(...args);
	}
	function userMessagesShareSubmissionId(...args) {
		return requireThreadDetailRuntime().userMessagesShareSubmissionId(...args);
	}
	function isTurnUsageSummaryItem(...args) {
		return requireThreadDetailRuntime().isTurnUsageSummaryItem(...args);
	}
	function isTurnDiagnosticItem(...args) {
		return requireThreadDetailRuntime().isTurnDiagnosticItem(...args);
	}
	function dedupeTurnUsageSummaryItems(...args) {
		return requireThreadDetailRuntime().dedupeTurnUsageSummaryItems(...args);
	}
	function normalizeComparableText(...args) {
		return requireThreadDetailRuntime().normalizeComparableText(...args);
	}
	function userMessageComparableParts(...args) {
		return requireThreadDetailRuntime().userMessageComparableParts(...args);
	}
	function userMessagePathOverlap(...args) {
		return requireThreadDetailRuntime().userMessagePathOverlap(...args);
	}
	function comparablePathName(...args) {
		return requireThreadDetailRuntime().comparablePathName(...args);
	}
	function userMessagePathNameOverlap(...args) {
		return requireThreadDetailRuntime().userMessagePathNameOverlap(...args);
	}
	function comparablePathNamesLikelySame(...args) {
		return requireThreadDetailRuntime().comparablePathNamesLikelySame(...args);
	}
	function isVisualReceiptItem(...args) {
		return requireThreadDetailRuntime().isVisualReceiptItem(...args);
	}
	function visualReceiptComparableNames(...args) {
		return requireThreadDetailRuntime().visualReceiptComparableNames(...args);
	}
	function visualReceiptCallId(...args) {
		return requireThreadDetailRuntime().visualReceiptCallId(...args);
	}
	function visualReceiptSuppressionKeys(...args) {
		return requireThreadDetailRuntime().visualReceiptSuppressionKeys(...args);
	}
	function suppressedVisualReceiptKeySet(...args) {
		return requireThreadDetailRuntime().suppressedVisualReceiptKeySet(...args);
	}
	function visualReceiptMatchesSuppressionKeys(...args) {
		return requireThreadDetailRuntime().visualReceiptMatchesSuppressionKeys(...args);
	}
	function userMessageSpecificity(...args) {
		return requireThreadDetailRuntime().userMessageSpecificity(...args);
	}
	function userMessagesLikelySame(...args) {
		return requireThreadDetailRuntime().userMessagesLikelySame(...args);
	}
	function userMessagesCanShadow(...args) {
		return requireThreadDetailRuntime().userMessagesCanShadow(...args);
	}
	function userMessageTimestampMs(...args) {
		return requireThreadDetailRuntime().userMessageTimestampMs(...args);
	}
	function userMessagesHaveNearbyTimestamps(...args) {
		return requireThreadDetailRuntime().userMessagesHaveNearbyTimestamps(...args);
	}
	function durableTurnCanReceivePendingEcho(...args) {
		return requireThreadDetailRuntime().durableTurnCanReceivePendingEcho(...args);
	}
	function optimisticEchoCanMatchEarlierDurable(...args) {
		return requireThreadDetailRuntime().optimisticEchoCanMatchEarlierDurable(...args);
	}
	function hasMatchingIncomingUserMessage(...args) {
		return requireThreadDetailRuntime().hasMatchingIncomingUserMessage(...args);
	}
	function hasMatchingRealUserMessage(...args) {
		return requireThreadDetailRuntime().hasMatchingRealUserMessage(...args);
	}
	function removeShadowedMuxUserMessages(...args) {
		return requireThreadDetailRuntime().removeShadowedMuxUserMessages(...args);
	}
	function userMessageShadowPriority(...args) {
		return requireThreadDetailRuntime().userMessageShadowPriority(...args);
	}
	function mergeLikelySameUserMessage(...args) {
		return requireThreadDetailRuntime().mergeLikelySameUserMessage(...args);
	}
	function dedupeLikelySameUserMessages(...args) {
		return requireThreadDetailRuntime().dedupeLikelySameUserMessages(...args);
	}
	function normalizeThreadVisibleUserMessages(...args) {
		return requireThreadDetailRuntime().normalizeThreadVisibleUserMessages(...args);
	}
	function threadUserMessageEntries(...args) {
		return requireThreadDetailRuntime().threadUserMessageEntries(...args);
	}
	function shouldDropOptimisticUserMessageForDurable(...args) {
		return requireThreadDetailRuntime().shouldDropOptimisticUserMessageForDurable(...args);
	}
	function shouldDropOptimisticUserMessageForHigherPriorityEcho(...args) {
		return requireThreadDetailRuntime().shouldDropOptimisticUserMessageForHigherPriorityEcho(...args);
	}
	function threadDurableUserMessages(...args) {
		return requireThreadDetailRuntime().threadDurableUserMessages(...args);
	}
	function shouldDropInitialSubmissionEchoTurn(...args) {
		return requireThreadDetailRuntime().shouldDropInitialSubmissionEchoTurn(...args);
	}
	function threadHasInitialSubmissionEcho(...args) {
		return requireThreadDetailRuntime().threadHasInitialSubmissionEcho(...args);
	}
	function comparableVisibleTextItem(...args) {
		return requireThreadDetailRuntime().comparableVisibleTextItem(...args);
	}
	function comparableVisibleText(...args) {
		return requireThreadDetailRuntime().comparableVisibleText(...args);
	}
	function visibleTextItemsLikelySame(...args) {
		return requireThreadDetailRuntime().visibleTextItemsLikelySame(...args);
	}
	function visibleTextItemsHaveStableSharedPrefix(...args) {
		return requireThreadDetailRuntime().visibleTextItemsHaveStableSharedPrefix(...args);
	}
	function completedReceiptItemsLikelySame(...args) {
		return requireThreadDetailRuntime().completedReceiptItemsLikelySame(...args);
	}
	function visibleTextItemsCanShareRenderIdentity(...args) {
		return requireThreadDetailRuntime().visibleTextItemsCanShareRenderIdentity(...args);
	}
	function findUnusedExistingItemIndexForIncoming(...args) {
		return requireThreadDetailRuntime().findUnusedExistingItemIndexForIncoming(...args);
	}
	function mergeIncomingOrderedItem(...args) {
		return requireThreadDetailRuntime().mergeIncomingOrderedItem(...args);
	}
	function insertLocalOnlyItemByExistingOrder(...args) {
		return requireThreadDetailRuntime().insertLocalOnlyItemByExistingOrder(...args);
	}
	function mergeItemPreservingVisibleFields(...args) {
		return requireThreadDetailRuntime().mergeItemPreservingVisibleFields(...args);
	}
	function mergeItemsPreservingLocalVisible(...args) {
		return requireThreadDetailRuntime().mergeItemsPreservingLocalVisible(...args);
	}
	function mergeTurnPreservingVisibleItems(...args) {
		return requireThreadDetailRuntime().mergeTurnPreservingVisibleItems(...args);
	}
	function shouldPreserveLiveTurnLocalVisibleItems(...args) {
		return requireThreadDetailRuntime().shouldPreserveLiveTurnLocalVisibleItems(...args);
	}
	function mergeThreadPreservingVisibleItems(...args) {
		return requireThreadDetailRuntime().mergeThreadPreservingVisibleItems(...args);
	}
	function turnOrderMs(...args) {
		return requireThreadDetailRuntime().turnOrderMs(...args);
	}
	function turnIsSupersededBy(...args) {
		return requireThreadDetailRuntime().turnIsSupersededBy(...args);
	}
	function rememberReusableThreadDetail(thread) {
		const id = String(thread && thread.id || "").trim();
		if (!id || !state.threadTileDetails || !threadHasReusableLoadedDetailState(thread)) return false;
		state.threadTileDetails.set(id, thread);
		return true;
	}
	function approvalThreadId(request) {
		return request && request.params && (request.params.threadId || request.params.conversationId || "");
	}
	function renderContextThreadId(thread = null) {
		return String(thread && thread.id || state.renderContextThreadId || state.renderContextThread && state.renderContextThread.id || state.currentThreadId || state.currentThread && state.currentThread.id || "");
	}
	function renderContextThread(thread = null) {
		return thread || state.renderContextThread || state.currentThread || null;
	}
	function withRenderContextThread(thread, callback) {
		const previousRenderThreadId = state.renderContextThreadId;
		const previousRenderThread = state.renderContextThread;
		state.renderContextThreadId = String(thread && thread.id || "");
		state.renderContextThread = thread || null;
		try {
			return callback();
		} finally {
			state.renderContextThreadId = previousRenderThreadId;
			state.renderContextThread = previousRenderThread;
		}
	}
	function approvalTurnId(request) {
		return request && request.params && request.params.turnId ? String(request.params.turnId) : "";
	}
	function isApprovalActive(request) {
		return String(request && request.status || "waiting") === "waiting";
	}
	function isApprovalSettled(request) {
		const status = String(request && request.status || "");
		return status && status !== "waiting";
	}
	function shouldShowApprovalRequest(request) {
		return request && !HIDDEN_SERVER_REQUEST_METHODS.has(request.method);
	}
	function requestBelongsToThread(request, threadId) {
		const requestThreadId = approvalThreadId(request);
		if (requestThreadId) return requestThreadId === threadId;
		return Boolean(threadId);
	}
	function approvalActionThreadId(request, fallbackThreadId = "") {
		return String(approvalThreadId(request) || fallbackThreadId || state.currentThreadId || "").trim();
	}
	function scheduleApprovalThreadRender(threadId = "") {
		const id = String(threadId || state.currentThreadId || "").trim();
		if (!id) return false;
		if (id === String(state.currentThreadId || "")) {
			scheduleRenderCurrentThread();
			return true;
		}
		if (state.threadTileMode && threadTilePaneIsVisible(id)) {
			if (!scheduleRenderThreadTilePane(id, { preserveScroll: true })) scheduleRenderCurrentThread();
			return true;
		}
		return false;
	}
	function pendingApprovalsForThread(threadId) {
		return Array.from(state.pendingApprovals.values()).filter(shouldShowApprovalRequest).filter((request) => requestBelongsToThread(request, threadId)).sort((a, b) => Number(a.receivedAt || 0) - Number(b.receivedAt || 0));
	}
	function approvalsForTurn(threadId, turnId) {
		return pendingApprovalsForThread(threadId).filter((request) => approvalTurnId(request) === String(turnId || ""));
	}
	function approvalRequestsSignature(threadId) {
		return pendingApprovalsForThread(threadId).map((request) => ({
			id: request.id,
			method: request.method,
			status: request.status,
			decision: request.decision,
			params: request.params
		}));
	}
	function threadTaskCardsForThread(thread) {
		return (Array.isArray(thread && thread.threadTaskCards) ? thread.threadTaskCards : []).filter((card) => String(card && card.status || "") === "pending").filter((card) => String(card && card.threadRole || "") === "target").slice().sort((a, b) => Number(b && b.updatedAt ? Date.parse(b.updatedAt) : 0) - Number(a && a.updatedAt ? Date.parse(a.updatedAt) : 0));
	}
	function threadTaskCardsSignature(thread) {
		return threadTaskCardsForThread(thread).map((card) => ({
			id: card.id,
			status: card.status,
			updatedAt: card.updatedAt,
			threadRole: card.threadRole,
			replyCardId: card.replyCardId || "",
			injectedTurnId: card.injectedTurnId || ""
		}));
	}
	function rolloutWarningSignature(thread) {
		const overThreshold = isRolloutOverThreshold(thread);
		const dismissed = isRolloutWarningDismissed(thread);
		const visible = Boolean(overThreshold && !dismissed);
		return {
			visible,
			overThreshold,
			dismissed,
			thresholdBytes: visible ? rolloutThresholdBytes(thread) : ""
		};
	}
	function visibleTurnsForConversation(thread) {
		const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
		return sortTurnsForDisplay(turns).slice(-maxVisibleTurnsForThread(thread));
	}
	function threadHasVisibleConversationTurns(thread) {
		return withRenderContextThread(thread, () => visibleTurnsForConversation(thread).some((turn) => visibleItemsForTurn(turn, thread).length > 0));
	}
	function threadIsLoadingWithoutVisibleTurns(thread) {
		return Boolean(thread && thread.mobileLoading && !threadHasVisibleConversationTurns(thread));
	}
	function conversationPatchShellSignature(thread) {
		if (!thread) return "home";
		return withRenderContextThread(thread, () => {
			const threadId = renderContextThreadId(thread);
			if (thread.mobileLoadError) return `load-error|${threadId}|${thread.mobileLoadError}`;
			if (threadIsLoadingWithoutVisibleTurns(thread)) return `loading|${threadId}`;
			const turns = visibleTurnsForConversation(thread);
			const omitted = Number(thread.mobileOmittedTurnCount || 0) + Math.max(0, (thread.turns || []).length - turns.length);
			const readWarningMessage = threadReadWarningMessage(thread);
			const payload = {
				threadId,
				imageAuthVersion: Number(state.imageAuthVersion || 0),
				pluginRefreshPendingNotice: String(state.pluginRefreshPendingNotice || ""),
				rolloutWarning: rolloutWarningSignature(thread),
				omitted,
				olderTurnsCursor: threadTurnsCursorSignature(thread.mobileOlderTurnsCursor),
				historyExpanded: Boolean(thread.mobileHistoryExpanded),
				historyBusy: Boolean(state.threadHistoryBusy),
				historyError: String(state.threadHistoryError || ""),
				goal: threadGoalSignature(thread),
				approvals: approvalRequestsSignature(threadId),
				taskCards: threadTaskCardsSignature(thread),
				readWarning: String(thread.mobileReadWarning || ""),
				readWarningMessage,
				visibleTurns: turns.map((turn) => turn && (turn.id || turn.startedAt || ""))
			};
			return JSON.stringify(payload);
		});
	}
	function conversationRenderSignature(thread) {
		if (!thread) return "home";
		return withRenderContextThread(thread, () => {
			const threadId = renderContextThreadId(thread);
			if (thread.mobileLoadError) return `load-error|${threadId}|${thread.mobileLoadError}`;
			if (threadIsLoadingWithoutVisibleTurns(thread)) return `loading|${threadId}`;
			const turns = visibleTurnsForConversation(thread);
			const omitted = Number(thread.mobileOmittedTurnCount || 0) + Math.max(0, (thread.turns || []).length - turns.length);
			const payload = {
				threadId,
				imageAuthVersion: Number(state.imageAuthVersion || 0),
				pluginRefreshPendingNotice: String(state.pluginRefreshPendingNotice || ""),
				rolloutWarning: rolloutWarningSignature(thread),
				omitted,
				olderTurnsCursor: threadTurnsCursorSignature(thread.mobileOlderTurnsCursor),
				historyExpanded: Boolean(thread.mobileHistoryExpanded),
				historyBusy: Boolean(state.threadHistoryBusy),
				historyError: String(state.threadHistoryError || ""),
				goal: threadGoalSignature(thread),
				approvals: approvalRequestsSignature(threadId),
				taskCards: threadTaskCardsSignature(thread),
				projectionVersion: String(thread.mobileProjectionVersion || ""),
				projectionRevision: String(thread.mobileProjectionRevision || ""),
				visibleItemKeys: Array.isArray(thread.mobileVisibleItemKeys) ? thread.mobileVisibleItemKeys : [],
				turns: turns.map((turn) => {
					const timerShowsStatus = isLatestTurn(turn, thread) && (isLiveTurn(turn, thread) || turnFinalSeconds(turn) != null);
					return {
						id: turn.id || "",
						visibleItemBudget: visibleItemBudgetSignature(turn),
						statusLine: timerShowsStatus ? "" : displayTurnStatus(turn),
						durationMs: timerShowsStatus ? "" : turn.durationMs || "",
						items: visibleItemsForTurn(turn, thread).map((entry) => ({
							sourceIndex: entry.sourceIndex,
							item: visibleItemSignature(entry.item, turn, thread)
						})).filter((entry) => entry.item)
					};
				})
			};
			return JSON.stringify(payload);
		});
	}
	function isPathLikeValue(value) {
		const text = String(value || "");
		if (!text || text.includes("\n") || text.includes("\r")) return false;
		return /^[A-Za-z]:[\\/]/.test(text) || /^\\\\\?\\/.test(text) || /^[/\\][^/\\]+/.test(text) || /[\\/][^/\\]+\.[A-Za-z0-9]{1,12}$/.test(text);
	}
	function isFileNameLikeValue(value) {
		const text = String(value || "");
		return Boolean(text && !text.includes("\n") && !text.includes("\r") && /^[^\\/]+\.[A-Za-z0-9]{1,12}$/.test(text));
	}
	function collectFileNames(value, out = [], keyHint = "") {
		if (out.length >= 5 || value == null) return out;
		if (typeof value === "string") {
			const keyLooksPath = /^(path|file|filepath|filename|name|target|source|uri)$/i.test(keyHint);
			if (isPathLikeValue(value) || keyLooksPath && isFileNameLikeValue(value)) out.push(value);
			return out;
		}
		if (Array.isArray(value)) {
			for (const entry of value) collectFileNames(entry, out, keyHint);
			return out;
		}
		if (typeof value === "object") for (const [key, entry] of Object.entries(value)) {
			if (/^(path|file|filePath|filename|name|target|source|uri)$/i.test(key) && typeof entry === "string" && (isPathLikeValue(entry) || isFileNameLikeValue(entry))) {
				out.push(entry);
				if (out.length >= 5) return out;
				continue;
			}
			collectFileNames(entry, out, key);
			if (out.length >= 5) return out;
		}
		return out;
	}
	function isLiveReasoning(item, turn, thread = null) {
		return item && item.type === "reasoning" && isLatestTurn(turn, thread) && isLiveTurn(turn, thread) && !isCompletedStatus(item.status);
	}
	function liveReasoningElapsed(item, turn) {
		const startedMs = item.startedAtMs || (item.startedAt ? item.startedAt * 1e3 : 0) || (turn && turn.startedAt ? turn.startedAt * 1e3 : 0) || state.nowMs;
		return Math.max(0, Math.floor((state.nowMs - startedMs) / 1e3));
	}
	function latestTurnForThread(thread) {
		const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
		return turns.length ? turns[turns.length - 1] : null;
	}
	function isLiveTurnForThread(thread, turn) {
		if (!turn || isTurnComplete(turn) || isStaleOrSupersededLiveTurn(turn)) return false;
		if (turnHasNewerDisplayTurn(thread, turn)) return false;
		return isRunningStatus(turn && turn.status) || isIncompleteInterruptedTurn(turn) || turnHasActiveLiveItems(turn) || latestTurnForThread(thread) === turn && isRunningStatus(thread && thread.status);
	}
	function latestLiveTurnForThread(thread) {
		const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
		for (let index = turns.length - 1; index >= 0; index -= 1) {
			const turn = turns[index];
			if (isLiveTurnForThread(thread, turn)) return turn;
		}
		return null;
	}
	function activeTurnIdForThread(thread) {
		const live = latestLiveTurnForThread(thread);
		return live && live.id ? String(live.id) : "";
	}
	function currentLiveTurn() {
		if (state.activeTurnId) {
			const active = turnById(state.activeTurnId);
			if (active && isLiveTurn(active, state.currentThread)) return active;
		}
		const latest = latestLiveTurnCandidate() || latestTurn();
		return latest && isLiveTurn(latest, state.currentThread) ? latest : null;
	}
	function turnElapsedSeconds(turn) {
		if (!turn) return 0;
		const startedMs = liveTurnStartedAtMs(turn) || state.nowMs;
		return Math.max(0, Math.floor((state.nowMs - startedMs) / 1e3));
	}
	function turnFinalSeconds(turn) {
		if (!turn) return null;
		if (turn.durationMs) return Math.max(0, Math.round(turn.durationMs / 1e3));
		if (turn.completedAt && turn.startedAt) return Math.max(0, Math.round(turn.completedAt - turn.startedAt));
		return null;
	}
	function liveActivityLabelForTurn(turn) {
		if (!turn || !isLiveTurn(turn)) return "";
		const operation = activeLiveOperationItemForTurn(turn);
		if (operation) return activityLabelForItem(operation);
		const items = Array.isArray(turn.items) ? turn.items : [];
		for (let index = items.length - 1; index >= 0; index -= 1) {
			const item = items[index];
			if (!item) continue;
			if (item.type === "reasoning" && !isCompletedStatus(item.status)) return "思考";
		}
		for (let index = items.length - 1; index >= 0; index -= 1) {
			const item = items[index];
			if (!item) continue;
			if (item.type === "agentMessage") return "输出";
			if (item.type === "plan") return "计划";
		}
		return "";
	}
	function liveTurnFallbackActivityLabel(turn) {
		if (!turn || !isLiveTurn(turn)) return "";
		const label = String(state.activityLabel || "").trim();
		if (label && !isIdleSyncActivityLabel(label) && label !== "加载线程") return label;
		if (isIncompleteInterruptedTurn(turn)) return "同步";
		return "运行";
	}
	function activeThreadFallbackActivityLabel() {
		const label = String(state.activityLabel || "").trim();
		if (label && !isIdleSyncActivityLabel(label) && label !== "加载线程") return label;
		return "运行";
	}
	function activeLiveOperationItemForTurn(turn) {
		const items = Array.isArray(turn && turn.items) ? turn.items : [];
		for (let index = items.length - 1; index >= 0; index -= 1) {
			const item = items[index];
			if (isActiveOperationalItem(item)) return item;
		}
		return null;
	}
	function turnHasActiveLiveItems(turn) {
		return (Array.isArray(turn && turn.items) ? turn.items : []).some((item) => item && (item.type === "reasoning" && !isCompletedStatus(item.status) || isActiveOperationalItem(item)));
	}
	function liveTurnStartedAtMs(turn) {
		if (!turn) return 0;
		const explicit = numericTimestampMs(turn.startedAtMs) || numericTimestampMs(turn.startedAt) || numericTimestampMs(turn.createdAtMs) || numericTimestampMs(turn.createdAt);
		if (explicit) return explicit;
		const items = Array.isArray(turn.items) ? turn.items : [];
		for (const item of items) {
			if (!item) continue;
			if (item.type === "reasoning") {
				if (isCompletedStatus(item.status)) continue;
			} else if (!isActiveOperationalItem(item)) continue;
			const itemStarted = numericTimestampMs(item.startedAtMs) || numericTimestampMs(item.startedAt) || numericTimestampMs(item.createdAtMs) || numericTimestampMs(item.createdAt);
			if (itemStarted) return itemStarted;
		}
		return 0;
	}
	function setTurnTimerContent(el, seconds, detail = "") {
		let timeEl = el.querySelector(".turn-timer-time");
		let detailEl = el.querySelector(".turn-timer-detail");
		if (!timeEl || !detailEl) {
			el.textContent = "";
			timeEl = document.createElement("span");
			timeEl.className = "turn-timer-time";
			detailEl = document.createElement("span");
			detailEl.className = "turn-timer-detail";
			el.append(timeEl, detailEl);
		}
		const timeText = `\u672c\u8f6e ${formatElapsedTime(seconds)}`;
		if (timeEl.textContent !== timeText) timeEl.textContent = timeText;
		if (detailEl.textContent !== detail) detailEl.textContent = detail;
		detailEl.classList.toggle("empty", !detail);
		el.setAttribute("aria-label", detail ? `${timeText} ${detail}` : timeText);
	}
	function turnTimerStateFromThread(thread, options = {}) {
		const activeRuntime = options.activeRuntime === true;
		const activeLabel = String(options.activeLabel || "").trim();
		const latest = options.latest || latestTurnForThread(thread);
		const live = latestLiveTurnForThread(thread);
		if (!live) {
			if (activeRuntime && latest && !isStaleOrSupersededLiveTurn(latest) && !isTurnComplete(latest)) {
				const startedMs = liveTurnStartedAtMs(latest) || turnStartedAtMs(latest) || Number(options.activityAtMs || 0) || state.nowMs;
				return {
					visible: true,
					active: true,
					settled: false,
					seconds: Math.max(0, Math.floor((state.nowMs - startedMs) / 1e3)),
					detail: activeLabel || "运行"
				};
			}
			const finalSeconds = turnFinalSeconds(latest);
			if (finalSeconds != null) return {
				visible: true,
				active: false,
				settled: true,
				seconds: finalSeconds,
				detail: "已结束"
			};
			return {
				visible: false,
				active: false,
				settled: false,
				seconds: 0,
				detail: ""
			};
		}
		return {
			visible: true,
			active: true,
			settled: false,
			seconds: turnElapsedSeconds(live),
			detail: liveActivityLabelForTurn(live) || String(options.liveFallbackLabel || "").trim() || liveTurnFallbackActivityLabel(live)
		};
	}
	function currentThreadTurnTimerState() {
		const thread = state.currentThread;
		if (!thread) return {
			visible: false,
			active: false,
			settled: false,
			seconds: 0,
			detail: ""
		};
		const latest = latestTurn();
		const live = currentLiveTurn();
		if (live) return {
			visible: true,
			active: true,
			settled: false,
			seconds: turnElapsedSeconds(live),
			detail: liveActivityLabelForTurn(live) || liveTurnFallbackActivityLabel(live)
		};
		return turnTimerStateFromThread(thread, {
			activeRuntime: currentThreadHasForegroundActiveRuntimeStatus(),
			activityAtMs: state.activityAtMs,
			activeLabel: activeThreadFallbackActivityLabel(),
			latest
		});
	}
	function applyTurnTimerState(el, timerState = {}) {
		if (!el) return;
		setTurnTimerContent(el, Number(timerState.seconds || 0), timerState.detail || "");
		el.classList.toggle("visible", Boolean(timerState.visible));
		el.classList.toggle("active", Boolean(timerState.active));
		el.classList.toggle("settled", Boolean(timerState.settled));
		el.setAttribute("aria-hidden", timerState.visible ? "false" : "true");
	}
	function turnTimerStateHtml(timerState = {}) {
		if (!timerState.visible) return "";
		const seconds = Number(timerState.seconds || 0);
		const detail = String(timerState.detail || "");
		const className = [
			"thread-tile-pane-state",
			"turn-timer",
			"visible",
			timerState.active ? "active" : "",
			timerState.settled ? "settled" : ""
		].filter(Boolean).join(" ");
		const timeText = `\u672c\u8f6e ${formatElapsedTime(seconds)}`;
		return `<div class="${escapeHtml(className)}">
    <span class="turn-timer-time">${escapeHtml(timeText)}</span><span class="turn-timer-detail${detail ? "" : " empty"}">${escapeHtml(detail)}</span>
  </div>`;
	}
	function threadTilePaneTimerState(thread) {
		return turnTimerStateFromThread(thread, {
			activeRuntime: Boolean(latestLiveTurnForThread(thread)),
			activeLabel: "运行",
			liveFallbackLabel: "运行"
		});
	}
	function updateTurnTimer() {
		const el = $("turnTimer");
		if (!el) return;
		updateComposerHeightVar();
		updateOperationDurationBadges();
		if (state.threadTileMode && state.threadTileActiveIds.length) {
			updateThreadTilePaneStatusBadges();
			applyTurnTimerState(el, {
				visible: false,
				active: false,
				settled: false,
				seconds: 0,
				detail: ""
			});
			return;
		}
		applyTurnTimerState(el, currentThreadTurnTimerState());
	}
	function updateTickTimer() {
		clearInterval(state.tickTimer);
		state.tickTimer = null;
		updateTurnTimer();
		if (state.threadTileMode && state.threadTileActiveIds.length) {
			if (!threadTileHasLiveThread()) return;
		} else if (!currentLiveTurn() && !currentThreadHasActiveRuntimeStatus()) return;
		state.tickTimer = setInterval(() => {
			state.nowMs = Date.now();
			updateTurnTimer();
		}, 1e3);
	}
	function operationStartedAtMs(item) {
		return numericTimestampMs(item && item.startedAtMs) || numericTimestampMs(item && item.startedAt) || numericTimestampMs(item && item.started_at_ms) || numericTimestampMs(item && item.started_at) || numericTimestampMs(item && item.createdAtMs) || numericTimestampMs(item && item.createdAt) || numericTimestampMs(item && item.timestampMs) || numericTimestampMs(item && item.timestamp);
	}
	function operationCompletedAtMs(item) {
		return numericTimestampMs(item && item.completedAtMs) || numericTimestampMs(item && item.completedAt) || numericTimestampMs(item && item.completed_at_ms) || numericTimestampMs(item && item.completed_at);
	}
	function operationExplicitDurationMs(item) {
		const value = Number(item && (item.durationMs || item.duration_ms || item.elapsedMs || item.elapsed_ms) || 0);
		return Number.isFinite(value) && value > 0 ? value : 0;
	}
	function operationDurationData(item, status = "") {
		const explicitMs = operationExplicitDurationMs(item);
		const startedMs = operationStartedAtMs(item);
		const completedMs = operationCompletedAtMs(item);
		let durationMs = explicitMs;
		if (!durationMs && startedMs) {
			const endMs = completedMs || (isCompletedStatus(status) ? 0 : state.nowMs);
			if (endMs > startedMs) durationMs = endMs - startedMs;
		}
		if (!durationMs) return null;
		const seconds = Math.max(0, Math.round(durationMs / 1e3));
		return {
			text: formatElapsedTime(seconds),
			startedMs,
			completedMs,
			durationMs: explicitMs
		};
	}
	function operationDurationAttrs(data) {
		return [
			`data-started-ms="${escapeHtml(data.startedMs || "")}"`,
			`data-completed-ms="${escapeHtml(data.completedMs || "")}"`,
			`data-duration-ms="${escapeHtml(data.durationMs || "")}"`
		].join(" ");
	}
	function updateOperationDurationBadges(root = document) {
		(root.querySelectorAll ? root.querySelectorAll(".operation-duration") : []).forEach((badge) => {
			const explicitMs = Number(badge.dataset.durationMs || 0);
			const startedMs = Number(badge.dataset.startedMs || 0);
			const completedMs = Number(badge.dataset.completedMs || 0);
			let durationMs = Number.isFinite(explicitMs) && explicitMs > 0 ? explicitMs : 0;
			if (!durationMs && Number.isFinite(startedMs) && startedMs > 0) {
				const endMs = Number.isFinite(completedMs) && completedMs > 0 ? completedMs : state.nowMs;
				durationMs = Math.max(0, endMs - startedMs);
			}
			if (!durationMs) return;
			const next = formatElapsedTime(Math.round(durationMs / 1e3));
			if (badge.textContent !== next) badge.textContent = next;
			if (badge.getAttribute("title") !== `Elapsed ${next}`) badge.setAttribute("title", `Elapsed ${next}`);
		});
	}
	function startRelativeTimeTimer() {
		if (state.relativeTimeTimer) return;
		state.relativeTimeTimer = setInterval(() => {
			if (!state.threads.length) return;
			renderThreads();
			if (!state.currentThread) renderHome();
		}, 6e4);
	}
	function threadSignature() {
		const turn = latestTurn();
		if (!turn) return "";
		const items = Array.isArray(turn.items) ? turn.items : [];
		const last = items.length ? items[items.length - 1] : null;
		const bodySize = items.reduce((total, item) => {
			if (!item || isOperationalItem(item) || isReasoningItem(item)) return total;
			return total + String(item.text || "").length + String((item.summary || []).join("")).length + String((item.content || []).join("")).length;
		}, 0);
		const visibleCount = items.filter((item) => item && !isReasoningItem(item)).length;
		return [
			turn.id,
			statusText(turn.status),
			visibleCount,
			last && !isReasoningItem(last) ? last.id : "",
			turn.completedAt || "",
			turn.durationMs || "",
			bodySize
		].join("|");
	}
	function createNavigationRuntime() {
		return {
			updateConnectionState: typeof updateConnectionState === "function" ? updateConnectionState : null,
			restoreConnectionState: typeof restoreConnectionState === "function" ? restoreConnectionState : null,
			markActivity: typeof markActivity === "function" ? markActivity : null,
			composerTargetPlan: typeof composerTargetPlan === "function" ? composerTargetPlan : null,
			visibleTurnsForConversation: typeof visibleTurnsForConversation === "function" ? visibleTurnsForConversation : null,
			conversationRenderSignature: typeof conversationRenderSignature === "function" ? conversationRenderSignature : null,
			updateTurnTimer: typeof updateTurnTimer === "function" ? updateTurnTimer : null
		};
	}
	(function exposeCodexNavigationRuntime(root) {
		const navigationRuntimeApi = { createNavigationRuntime };
		if (typeof module === "object" && module.exports) module.exports = navigationRuntimeApi;
		Object.assign(root, {
			updateConnectionState,
			restoreConnectionState,
			maybeAutoRecoverTurnAfterReconnect,
			showComposerFastHint,
			clearReconnectTimers,
			markActivity,
			setSteerFeedback,
			isPendingSteerForTurn,
			markSteerAppliedIfNeeded,
			markIdleActivity,
			normalizeFsPath,
			draftKeyForThread,
			effectiveThreadTileSelectedThreadId,
			composerTargetPlan,
			currentComposerThreadId,
			isThreadTileComposerContext,
			composerTargetThread,
			composerTargetActiveTurnId,
			currentDraftKey,
			readDraftMap,
			draftHasContent,
			deleteDraftAttachments,
			scheduleAttachmentPreviewUrlRevoke,
			saveDraftAttachmentFiles,
			saveCurrentDraftNow,
			writeCurrentDraftToKey,
			scheduleCurrentDraftSave,
			clearDraftForKey,
			defaultNewThreadModel,
			defaultNewThreadEffort,
			defaultNewThreadPermissionMode,
			replacePendingAttachments,
			restoreDraftForCurrentTarget,
			visibleWorkspaceKeys,
			basenameForFsPath,
			visibleWorkspaceNames,
			codexWorktreeRepoName,
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
			markThreadOptimisticallyActive,
			mergeThreadIntoThreadList,
			isCompletedStatus,
			isRunningStatus,
			isTurnComplete,
			isReasoningItem,
			syncActiveTurnFromThread,
			isOperationalItem,
			isActiveOperationalItem,
			isContextCompactionItem,
			contextCompactionNotice,
			activityLabelForItem,
			isWebSearchLikeItem,
			latestTurn,
			turnById,
			currentThreadNeedsForegroundRefresh,
			isIncompleteInterruptedTurn,
			shouldPollCurrentThread,
			isLiveTurn,
			isLatestTurn,
			stableItemKey,
			stableTurnKey,
			stableTextHash,
			stableOperationRenderKey,
			isNodeStartAboveConversationViewport,
			existingConversationRenderKeys,
			entryAnimationClass,
			liveTurnHasNonUserProgress,
			isVisibleNonUserProgressItem,
			liveTurnHasNonUserProgressBefore,
			liveTurnHasNonUserProgressAfter,
			isUserVisibleTextReplyItem,
			liveTurnHasUserVisibleTextReplyAfter,
			userMessageHasVisualAttachment,
			shouldHideDurableLiveUserMessage,
			durableUserMessageMatchesOptimisticEcho,
			threadHasDurableUserMessageWithSubmissionId,
			threadHasDurableUserMessageMatchingOptimisticEcho,
			shouldHideOptimisticUserMessageEcho,
			isSupersededLiveTurn,
			shouldHideSupersededLiveUserMessage,
			isRawThreadReadMode,
			shouldPreserveRawThreadVisibleEntry,
			itemTextValue,
			reasoningItemHasVisibleText,
			isLatestCompletedProcessTurn,
			limitRawThreadVisibleEntries,
			visibleItemsForTurn,
			currentLiveOperationEntry,
			liveTurnStatusDockItem,
			visibleItemSignature,
			visibleItemBudgetForTurn,
			visibleItemBudgetSignature,
			inputContentSignature,
			imageSourceSignature,
			compactStructuredForSignature,
			itemVisibleWeight,
			turnVisibleWeight,
			isAssistantReceiptLikeItem,
			completedIncomingTurnHasAuthoritativeReceipt,
			shouldDropLocalOnlyReceiptForIncomingTurn,
			shouldPreserveLocalOnlyItem,
			isMuxUserMessage,
			isOptimisticUserMessage,
			userMessageSubmissionIdCandidates,
			userMessageHasSubmissionId,
			userMessagesShareSubmissionId,
			isTurnUsageSummaryItem,
			isTurnDiagnosticItem,
			dedupeTurnUsageSummaryItems,
			normalizeComparableText,
			userMessageComparableParts,
			userMessagePathOverlap,
			comparablePathName,
			userMessagePathNameOverlap,
			comparablePathNamesLikelySame,
			isVisualReceiptItem,
			visualReceiptComparableNames,
			visualReceiptCallId,
			visualReceiptSuppressionKeys,
			suppressedVisualReceiptKeySet,
			visualReceiptMatchesSuppressionKeys,
			userMessageSpecificity,
			userMessagesLikelySame,
			userMessagesCanShadow,
			userMessageTimestampMs,
			userMessagesHaveNearbyTimestamps,
			durableTurnCanReceivePendingEcho,
			optimisticEchoCanMatchEarlierDurable,
			hasMatchingIncomingUserMessage,
			hasMatchingRealUserMessage,
			removeShadowedMuxUserMessages,
			userMessageShadowPriority,
			mergeLikelySameUserMessage,
			dedupeLikelySameUserMessages,
			normalizeThreadVisibleUserMessages,
			threadUserMessageEntries,
			shouldDropOptimisticUserMessageForDurable,
			shouldDropOptimisticUserMessageForHigherPriorityEcho,
			threadDurableUserMessages,
			shouldDropInitialSubmissionEchoTurn,
			threadHasInitialSubmissionEcho,
			comparableVisibleTextItem,
			comparableVisibleText,
			visibleTextItemsLikelySame,
			visibleTextItemsHaveStableSharedPrefix,
			completedReceiptItemsLikelySame,
			visibleTextItemsCanShareRenderIdentity,
			findUnusedExistingItemIndexForIncoming,
			mergeIncomingOrderedItem,
			insertLocalOnlyItemByExistingOrder,
			mergeItemPreservingVisibleFields,
			mergeItemsPreservingLocalVisible,
			mergeTurnPreservingVisibleItems,
			mergeThreadPreservingVisibleItems,
			shouldPreserveLiveTurnLocalVisibleItems,
			turnOrderMs,
			turnIsSupersededBy,
			rememberReusableThreadDetail,
			renderContextThreadId,
			renderContextThread,
			withRenderContextThread,
			approvalTurnId,
			isApprovalActive,
			isApprovalSettled,
			shouldShowApprovalRequest,
			requestBelongsToThread,
			approvalActionThreadId,
			scheduleApprovalThreadRender,
			approvalsForTurn,
			pendingApprovalsForThread,
			threadTaskCardsForThread,
			collectFileNames,
			visibleTurnsForConversation,
			threadHasVisibleConversationTurns,
			threadIsLoadingWithoutVisibleTurns,
			conversationPatchShellSignature,
			conversationRenderSignature,
			latestTurnForThread,
			isLiveTurnForThread,
			latestLiveTurnForThread,
			currentLiveTurn,
			turnHasActiveLiveItems,
			isLiveReasoning,
			liveReasoningElapsed,
			activeTurnIdForThread,
			turnTimerStateHtml,
			threadTilePaneTimerState,
			updateTurnTimer,
			updateTickTimer,
			turnFinalSeconds,
			operationDurationData,
			operationDurationAttrs,
			updateOperationDurationBadges,
			startRelativeTimeTimer,
			threadSignature,
			MESSAGE_INPUT_MIN_HEIGHT_PX,
			MESSAGE_INPUT_MAX_HEIGHT_PX
		});
		root.CodexNavigationRuntime = navigationRuntimeApi;
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
//#region \0virtual:codex-mobile-esm-compatibility/shard/shard-04
var import_modal_runtime = /* @__PURE__ */ __toESM(require_modal_runtime());
var import_navigation_runtime = /* @__PURE__ */ __toESM(require_navigation_runtime());
var import_runtime_wiring_runtime = /* @__PURE__ */ __toESM(require_runtime_wiring_runtime());
var import_app_shell_runtime = /* @__PURE__ */ __toESM(require_app_shell_runtime());
var moduleDefinitions = [
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
		"id": "navigation-runtime",
		"source": "public/navigation-runtime.js",
		"globalName": "CodexNavigationRuntime",
		"expectedFunctions": ["createNavigationRuntime"],
		"assetPath": "/navigation-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 78334
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
	}
];
var moduleApis = {
	"modal-runtime": import_modal_runtime.default,
	"navigation-runtime": import_navigation_runtime.default,
	"runtime-wiring-runtime": import_runtime_wiring_runtime.default,
	"app-shell-runtime": import_app_shell_runtime.default
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
