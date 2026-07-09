//#region frontend/native/settings-runtime.mjs
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
function loadJsonStorage$1(key, fallback) {
	try {
		const value = JSON.parse(localStorage.getItem(key) || "");
		return value && typeof value === "object" ? value : fallback;
	} catch (_) {
		return fallback;
	}
}
function loadStringSetStorage(key) {
	try {
		const value = JSON.parse(localStorage.getItem(key) || "[]");
		return new Set(Array.isArray(value) ? value.map((item) => String(item || "")).filter(Boolean) : []);
	} catch (_) {
		return /* @__PURE__ */ new Set();
	}
}
function loadNumberMapStorage(key, fallback = {}) {
	try {
		const value = JSON.parse(localStorage.getItem(key) || "{}");
		if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
		const out = {};
		for (const [id, timestamp] of Object.entries(value)) {
			const keyId = String(id || "").trim();
			const number = Number(timestamp || 0);
			if (keyId && Number.isFinite(number) && number > 0) out[keyId] = number;
		}
		return out;
	} catch (_) {
		return fallback;
	}
}
function saveNumberMapStorage(key, value) {
	try {
		localStorage.setItem(key, JSON.stringify(value && typeof value === "object" ? value : {}));
	} catch (_) {}
}
function saveStringSetStorage(key, value) {
	try {
		localStorage.setItem(key, JSON.stringify([...value].filter(Boolean)));
	} catch (_) {}
}
function normalizeRestartAutoRecoverThread$1(thread) {
	const id = String(thread && thread.id || thread && thread.threadId || "").trim();
	if (!id) return null;
	return {
		id,
		activeTurnId: String(thread && thread.activeTurnId || ""),
		cwd: String(thread && thread.cwd || ""),
		name: String(thread && (thread.name || thread.preview) || ""),
		status: thread && thread.status ? thread.status : { type: "active" }
	};
}
function loadRestartAutoRecoverThreads() {
	try {
		const value = JSON.parse(localStorage.getItem(STORAGE_RESTART_AUTO_RECOVER_THREADS) || "[]");
		if (!Array.isArray(value)) return [];
		return value.map(normalizeRestartAutoRecoverThread$1).filter(Boolean).slice(0, 12);
	} catch (_) {
		return [];
	}
}
function saveRestartAutoRecoverThreads(threads) {
	const normalized = (threads || []).map(normalizeRestartAutoRecoverThread$1).filter(Boolean).slice(0, 12);
	state.restartAutoRecoverThreads = normalized;
	try {
		if (normalized.length) localStorage.setItem(STORAGE_RESTART_AUTO_RECOVER_THREADS, JSON.stringify(normalized));
		else localStorage.removeItem(STORAGE_RESTART_AUTO_RECOVER_THREADS);
	} catch (_) {}
	return normalized;
}
function clearRestartAutoRecoverThreads$1() {
	state.restartAutoRecoverThreads = [];
	try {
		localStorage.removeItem(STORAGE_RESTART_AUTO_RECOVER_THREADS);
	} catch (_) {}
}
function initializeRestartAutoRecoverThreads() {
	if (typeof state === "undefined" || !state) return [];
	state.restartAutoRecoverThreads = loadRestartAutoRecoverThreads();
	return state.restartAutoRecoverThreads;
}
initializeRestartAutoRecoverThreads();
function saveThreadTaskCardDraftStates() {
	try {
		const entries = {};
		for (const [key, value] of state.threadTaskCardDraftStates.entries()) {
			if (!key || !value || typeof value !== "object") continue;
			const status = String(value.status || "").trim();
			if (!status || status === "pending" || status === "creating") continue;
			entries[key] = {
				status,
				error: String(value.error || ""),
				cardId: String(value.cardId || ""),
				cardIds: Array.isArray(value.cardIds) ? value.cardIds.map((id) => String(id || "")).filter(Boolean).slice(0, 12) : []
			};
		}
		localStorage.setItem(STORAGE_TASK_CARD_DRAFT_STATES, JSON.stringify(entries));
	} catch (_) {}
}
function normalizeFontSizeValue(value) {
	const normalized = String(value || "default").trim().toLowerCase();
	return FONT_SIZE_VALUES.has(normalized) ? normalized : "default";
}
function normalizeThemeValue(value) {
	const normalized = String(value || "").trim().toLowerCase();
	return THEME_VALUES.has(normalized) ? normalized : "";
}
function normalizePluginFontSizeValue(value) {
	const normalized = String(value || "").trim().toLowerCase();
	return FONT_SIZE_VALUES.has(normalized) ? normalized : "";
}
function storedFontSizePreference() {
	try {
		return normalizePluginFontSizeValue(localStorage.getItem(STORAGE_FONT_SIZE) || "");
	} catch (_) {
		return "";
	}
}
function normalizePluginAppearance(value) {
	const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
	const appearance = {};
	const theme = normalizeThemeValue(source.theme || source.pluginTheme || source.tone || source.colorScheme || source.color_scheme);
	const hasFontSize = source.fontSize || source.pluginFontSize || source.font_size;
	const fontSize = hasFontSize ? normalizePluginFontSizeValue(hasFontSize) : "";
	if (theme) appearance.theme = theme;
	if (fontSize) appearance.fontSize = fontSize;
	return Object.keys(appearance).length ? appearance : null;
}
function applyPluginAppearancePreference(value) {
	if (!isHermesEmbedMode()) return;
	const appearance = normalizePluginAppearance(value);
	if (!appearance) return;
	state.pluginAppearance = Object.assign({}, state.pluginAppearance || {}, appearance);
	if (appearance.theme && window.codexMobileTheme && typeof window.codexMobileTheme.apply === "function") window.codexMobileTheme.apply(appearance.theme);
	const storedFontSize = storedFontSizePreference();
	if (storedFontSize) state.pluginAppearance = Object.assign({}, state.pluginAppearance || {}, { fontSize: storedFontSize });
	if (appearance.fontSize && !storedFontSize) {
		state.fontSize = appearance.fontSize;
		applyFontSizePreference();
		renderFontSizeControl();
		const input = $("messageInput");
		if (input) autoSizeMessageInput(input, { force: true });
	}
}
function currentPluginAppearanceForHost() {
	if (!isHermesEmbedMode()) return null;
	const base = normalizePluginAppearance(state.pluginAppearance) || {};
	const appearance = {};
	if (base.theme) appearance.theme = base.theme;
	const fontSize = normalizePluginFontSizeValue(state.fontSize);
	if (fontSize) appearance.fontSize = fontSize;
	return Object.keys(appearance).length ? appearance : null;
}
function syncPluginAppearanceStateFromPreferences() {
	const appearance = currentPluginAppearanceForHost();
	if (!appearance) return null;
	state.pluginAppearance = Object.assign({}, state.pluginAppearance || {}, appearance);
	return appearance;
}
function applyFontSizePreference() {
	state.fontSize = normalizeFontSizeValue(state.fontSize);
	document.documentElement.dataset.fontSize = state.fontSize;
}
function renderFontSizeControl() {
	const selected = normalizeFontSizeValue(state.fontSize);
	document.querySelectorAll("[data-font-size-choice]").forEach((button) => {
		const isSelected = button.dataset.fontSizeChoice === selected;
		button.classList.toggle("selected", isSelected);
		button.setAttribute("aria-pressed", isSelected ? "true" : "false");
	});
}
function setFontSizePreference(value) {
	state.fontSize = normalizeFontSizeValue(value);
	if (state.fontSize === "default") localStorage.removeItem(STORAGE_FONT_SIZE);
	else localStorage.setItem(STORAGE_FONT_SIZE, state.fontSize);
	applyFontSizePreference();
	renderFontSizeControl();
	const input = $("messageInput");
	if (input) autoSizeMessageInput(input, { force: true });
	if (isHermesEmbedMode()) {
		syncPluginAppearanceStateFromPreferences();
		scrubPluginLaunchUrl();
		publishPluginNavigationState({ force: true });
	}
}
function handleFontSizeChoice(event) {
	const button = event.target.closest("[data-font-size-choice]");
	if (!button) return;
	event.preventDefault();
	setFontSizePreference(button.dataset.fontSizeChoice || "default");
}
function isMenuOverlayMode$1() {
	return window.matchMedia(MENU_OVERLAY_MEDIA).matches && !window.matchMedia(TABLET_SPLIT_MEDIA).matches;
}
function viewportState$1() {
	const embedded = isHermesEmbedMode();
	const hostViewport = state.pluginHostViewport && typeof state.pluginHostViewport === "object" ? state.pluginHostViewport : null;
	const hostKeyboard = hostViewport && hostViewport.keyboard && typeof hostViewport.keyboard === "object" ? hostViewport.keyboard : null;
	const hostFooter = hostViewport && hostViewport.footer && typeof hostViewport.footer === "object" ? hostViewport.footer : null;
	const measured = viewportMetrics.measureViewport({
		visualHeight: window.visualViewport && window.visualViewport.height,
		visualOffsetTop: window.visualViewport && window.visualViewport.offsetTop,
		scrollTop: embedded ? Math.max(0, Number(window.scrollY || 0) || 0, Number(document.documentElement && document.documentElement.scrollTop || 0) || 0, Number(document.body && document.body.scrollTop || 0) || 0) : 0,
		innerHeight: window.innerHeight,
		clientHeight: document.documentElement && document.documentElement.clientHeight,
		activeElement: document.activeElement,
		hostViewportHeight: embedded && hostViewport && hostViewport.viewport ? hostViewport.viewport.height : 0,
		hostKeyboardVisible: Boolean(embedded && hostKeyboard && hostKeyboard.visible),
		hostKeyboardBottomInset: embedded && hostKeyboard ? hostKeyboard.bottomInset : 0,
		hostBottomSafeArea: embedded && hostFooter ? hostFooter.safeAreaBottom : 0
	});
	measured.hostTopSafeArea = embedded && hostViewport ? boundedViewportNumber(hostViewport.hostTopSafeArea, 512) : 0;
	return measured;
}
function viewportHeight() {
	return viewportState$1().height;
}
function setStableRootPixelVar(name, nextValue, stateKey, options = {}) {
	const nextPx = viewportMetrics.cssPixel(nextValue);
	const previousPx = viewportMetrics.cssPixel(state[stateKey]);
	if (!options.force && !viewportMetrics.stablePixelChanged(previousPx, nextPx, options)) return false;
	state[stateKey] = nextPx;
	document.documentElement.style.setProperty(name, `${nextPx}px`);
	return true;
}
function isKeyboardEditableElement$1(element) {
	return Boolean(viewportMetrics && typeof viewportMetrics.isKeyboardEditable === "function" && viewportMetrics.isKeyboardEditable(element));
}
function isHermesKeyboardInputActive() {
	return isHermesEmbedMode() && isKeyboardEditableElement$1(document.activeElement);
}
function resetMobileKeyboardWindowScroll() {
	if (isHermesEmbedMode() || !isKeyboardEditableElement$1(document.activeElement)) return;
	if (Math.max(0, Number(window.scrollY || 0) || 0, Number(document.documentElement && document.documentElement.scrollTop || 0) || 0, Number(document.body && document.body.scrollTop || 0) || 0) < 1) return;
	if (typeof window.scrollTo === "function") window.scrollTo(0, 0);
	if (document.documentElement) document.documentElement.scrollTop = 0;
	if (document.body) document.body.scrollTop = 0;
}
function updateViewportVars() {
	resetMobileKeyboardWindowScroll();
	const viewport = viewportState$1();
	if (viewport.keyboardShrunk) {
		setStableRootPixelVar("--app-top", viewport.top, "viewportAppTopPx");
		setStableRootPixelVar("--app-height", viewport.height, "viewportAppHeightPx");
	} else {
		document.documentElement.style.removeProperty("--app-top");
		document.documentElement.style.removeProperty("--app-height");
		state.viewportAppTopPx = 0;
		state.viewportAppHeightPx = 0;
	}
	setStableRootPixelVar("--host-top-safe-area", viewport.hostTopSafeArea, "hostTopSafeAreaPx", { epsilonPx: 0 });
	setStableRootPixelVar("--host-bottom-safe-area", viewport.hostBottomSafeArea, "hostBottomSafeAreaPx", { epsilonPx: 0 });
	document.documentElement.classList.toggle("keyboard-open", viewport.keyboardShrunk);
}
function createSubmissionId$1() {
	if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
var RECENT_SUBMITTED_USER_MESSAGE_TTL_MS = 360 * 60 * 1e3;
var RECENT_SUBMITTED_USER_MESSAGE_ACCEPTED_TTL_MS = 120 * 1e3;
function pruneRecentSubmittedUserMessages(now = Date.now()) {
	const records = state.recentSubmittedUserMessages;
	if (!records || typeof records.entries !== "function") return;
	for (const [key, record] of records.entries()) {
		const acceptedAtMs = Number(record && record.acceptedAtMs || 0);
		const ttlMs = acceptedAtMs > 0 ? RECENT_SUBMITTED_USER_MESSAGE_ACCEPTED_TTL_MS : RECENT_SUBMITTED_USER_MESSAGE_TTL_MS;
		const anchorMs = acceptedAtMs || Number(record && record.createdAtMs || 0);
		if (!record || now - anchorMs > ttlMs) records.delete(key);
	}
}
function registerSubmittedUserMessage(threadId, text, attachments, clientSubmissionId) {
	const id = String(clientSubmissionId || "").trim();
	if (!id) return;
	pruneRecentSubmittedUserMessages();
	state.recentSubmittedUserMessages.set(id, {
		threadId: String(threadId || ""),
		item: localUserMessageItem(text, attachments || [], id),
		createdAtMs: Date.now()
	});
	if (typeof recordSubmittedEchoDiagnosticLog === "function") recordSubmittedEchoDiagnosticLog("recent-submission-registered", {
		threadId,
		clientSubmissionId: id,
		attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
		textLength: String(text || "").length
	});
}
function localSubmittedTurnId(clientSubmissionId) {
	const id = String(clientSubmissionId || "").trim();
	return id ? `local-turn-${id}` : `local-turn-${Date.now()}`;
}
function currentThreadHasClientSubmission(clientSubmissionId) {
	const id = String(clientSubmissionId || "").trim();
	return threadHasClientSubmission(state.currentThread, id);
}
function threadHasClientSubmission(thread, clientSubmissionId) {
	const id = String(clientSubmissionId || "").trim();
	if (!id || !thread || !Array.isArray(thread.turns)) return false;
	return thread.turns.some((turn) => Array.isArray(turn && turn.items) && turn.items.some((item) => item && String(item.clientSubmissionId || "") === id));
}
function mutableThreadForLocalSubmission(threadId) {
	const id = String(threadId || "").trim();
	if (!id) return null;
	if (state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
	const existing = state.threadTileDetails.get(id);
	if (existing) return existing;
	const summary = threadById(id);
	const thread = Object.assign({
		id,
		name: id,
		preview: id,
		turns: []
	}, summary || {});
	thread.turns = Array.isArray(thread.turns) ? thread.turns.slice() : [];
	state.threadTileDetails.set(id, thread);
	return thread;
}
function syncLocalSubmissionThread(thread) {
	if (!thread || !thread.id) return;
	const id = String(thread.id || "");
	if (state.currentThread && String(state.currentThread.id || "") === id) syncActiveTurnFromThread();
	else state.threadTileDetails.set(id, thread);
	mergeThreadIntoThreadList(thread);
}
function insertLocalSubmittedUserMessage$1(threadId, text, attachments, clientSubmissionId, options = null) {
	const id = String(threadId || "").trim();
	const thread = mutableThreadForLocalSubmission(id);
	if (!id || !thread) {
		if (typeof recordSubmittedEchoDiagnosticLog === "function") recordSubmittedEchoDiagnosticLog("local-insert-skipped", {
			threadId: id,
			clientSubmissionId,
			reason: !id ? "missing_thread_id" : "missing_thread"
		});
		return false;
	}
	const submissionId = String(clientSubmissionId || "").trim();
	if (submissionId && threadHasClientSubmission(thread, submissionId)) {
		if (typeof recordSubmittedEchoDiagnosticLog === "function") recordSubmittedEchoDiagnosticLog("local-insert-skipped", {
			threadId: id,
			clientSubmissionId: submissionId,
			reason: "submission_already_present"
		});
		return false;
	}
	const requestedTurnId = String((options || {}).turnId || "").trim();
	const requestedTurn = requestedTurnId ? (thread.turns || []).find((entry) => entry && String(entry.id || "") === requestedTurnId) : null;
	const turnId = requestedTurnId && !isTurnComplete(requestedTurn) ? requestedTurnId : localSubmittedTurnId(submissionId);
	thread.turns = Array.isArray(thread.turns) ? thread.turns : [];
	let turn = thread.turns.find((entry) => entry && String(entry.id || "") === turnId);
	if (!turn) {
		turn = {
			id: turnId,
			status: { type: "active" },
			startedAt: Math.floor(Date.now() / 1e3),
			items: []
		};
		thread.turns.push(turn);
	}
	clientRenderStabilityGuard.markSubmittedTurn(turn, submissionId);
	turn.items = Array.isArray(turn.items) ? turn.items : [];
	turn.status = isCompletedStatus(turn.status) ? { type: "active" } : turn.status || { type: "active" };
	turn.items.push(localUserMessageItem(text, attachments || [], submissionId));
	thread.status = { type: "active" };
	syncLocalSubmissionThread(thread);
	if (typeof recordSubmittedEchoDiagnosticLog === "function") recordSubmittedEchoDiagnosticLog("local-insert-applied", {
		threadId: id,
		clientSubmissionId: submissionId,
		requestedTurnHash: diagnosticTurnHash(requestedTurnId),
		targetTurnHash: diagnosticTurnHash(turnId),
		createdLocalTurn: !requestedTurnId || requestedTurnId !== turnId,
		attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
		textLength: String(text || "").length
	});
	return true;
}
function mergeSubmittedUserItemIntoTurn(turn, item) {
	if (!turn || !item || item.type !== "userMessage") return false;
	turn.items = Array.isArray(turn.items) ? turn.items : [];
	const existingIndex = turn.items.findIndex((existing) => existing && existing.type === "userMessage" && (existing.id === item.id || userMessagesCanShadow(existing, item)));
	if (existingIndex >= 0) {
		turn.items[existingIndex] = mergeLikelySameUserMessage(turn.items[existingIndex], item);
		return true;
	}
	turn.items.unshift(item);
	return true;
}
function markRecentSubmittedUserMessageAccepted(threadId, clientSubmissionId, serverTurnId) {
	const id = String(clientSubmissionId || "").trim();
	if (!id || !state.recentSubmittedUserMessages || typeof state.recentSubmittedUserMessages.get !== "function") return false;
	const record = state.recentSubmittedUserMessages.get(id);
	if (!record) return false;
	record.threadId = String(threadId || record.threadId || "");
	record.serverTurnId = String(serverTurnId || record.serverTurnId || "");
	record.acceptedAtMs = Date.now();
	state.recentSubmittedUserMessages.set(id, record);
	return true;
}
function durableUserMessageMatchesSubmittedRecord(item, record, clientSubmissionId) {
	if (!item || item.type !== "userMessage" || isOptimisticUserMessage(item)) return false;
	const submissionId = String(clientSubmissionId || "").trim();
	if (submissionId && String(item.clientSubmissionId || "") === submissionId) return true;
	const recordItem = record && record.item;
	return Boolean(recordItem && userMessagesCanShadow(item, recordItem));
}
function threadHasDurableSubmittedUserRecord(thread, record, clientSubmissionId) {
	for (const turn of Array.isArray(thread && thread.turns) ? thread.turns : []) for (const item of Array.isArray(turn && turn.items) ? turn.items : []) if (durableUserMessageMatchesSubmittedRecord(item, record, clientSubmissionId)) return true;
	return false;
}
function optimisticUserMessageMatchesSubmittedRecord(item, record, clientSubmissionId) {
	if (!item || item.type !== "userMessage" || !isOptimisticUserMessage(item)) return false;
	const submissionId = String(clientSubmissionId || "").trim();
	if (submissionId && String(item.clientSubmissionId || "") === submissionId) return true;
	const recordItem = record && record.item;
	return Boolean(recordItem && userMessagesCanShadow(item, recordItem));
}
function removeOptimisticSubmittedUserRecordEchoes(thread, record, clientSubmissionId) {
	if (!thread || !Array.isArray(thread.turns)) return false;
	let changed = false;
	thread.turns = thread.turns.filter((turn) => {
		if (!turn || !Array.isArray(turn.items)) return true;
		const nextItems = turn.items.filter((item) => !optimisticUserMessageMatchesSubmittedRecord(item, record, clientSubmissionId));
		if (nextItems.length !== turn.items.length) {
			turn.items = nextItems;
			changed = true;
		}
		return Boolean(turn.items.length || !/^local-turn-/.test(String(turn.id || "")));
	});
	return changed;
}
function settleRecentSubmittedUserMessagesForThread(thread, source = "thread-refresh") {
	const records = state.recentSubmittedUserMessages;
	if (!thread || !records || typeof records.entries !== "function") return 0;
	pruneRecentSubmittedUserMessages();
	const threadId = String(thread.id || state.currentThreadId || "").trim();
	let settledCount = 0;
	let changed = false;
	for (const [clientSubmissionId, record] of Array.from(records.entries())) {
		if (!recentSubmittedUserRecordBelongsToThread(record, threadId)) continue;
		if (!threadHasDurableSubmittedUserRecord(thread, record, clientSubmissionId)) continue;
		records.delete(clientSubmissionId);
		settledCount += 1;
		changed = removeOptimisticSubmittedUserRecordEchoes(thread, record, clientSubmissionId) || changed;
		if (typeof recordSubmittedEchoDiagnosticLog === "function") recordSubmittedEchoDiagnosticLog("recent-submission-settled", {
			threadId,
			clientSubmissionId,
			source: String(source || "thread-refresh").slice(0, 80)
		});
	}
	if (changed) normalizeThreadVisibleUserMessages(thread);
	return settledCount;
}
function reconcileSubmittedUserMessageTurn$1(threadId, clientSubmissionId, serverTurnId) {
	const id = String(threadId || "").trim();
	const submissionId = String(clientSubmissionId || "").trim();
	const turnId = String(serverTurnId || "").trim();
	const thread = mutableThreadForLocalSubmission(id);
	if (!id || !submissionId || !turnId || !thread || String(thread.id || "") !== id) {
		if (typeof recordSubmittedEchoDiagnosticLog === "function") recordSubmittedEchoDiagnosticLog("reconcile-skipped", {
			threadId: id,
			clientSubmissionId: submissionId,
			serverTurnHash: diagnosticTurnHash(turnId),
			reason: !id ? "missing_thread_id" : !submissionId ? "missing_submission_id" : !turnId ? "missing_server_turn_id" : !thread ? "missing_thread" : "thread_id_mismatch"
		});
		return false;
	}
	thread.turns = Array.isArray(thread.turns) ? thread.turns : [];
	let sourceTurn = null;
	let sourceItem = null;
	for (const turn of thread.turns) {
		const item = (Array.isArray(turn && turn.items) ? turn.items : []).find((entry) => entry && entry.type === "userMessage" && String(entry.clientSubmissionId || "") === submissionId && isOptimisticUserMessage(entry));
		if (!item) continue;
		sourceTurn = turn;
		sourceItem = item;
		break;
	}
	if (!sourceItem) {
		if (typeof recordSubmittedEchoDiagnosticLog === "function") recordSubmittedEchoDiagnosticLog("reconcile-skipped", {
			threadId: id,
			clientSubmissionId: submissionId,
			serverTurnHash: diagnosticTurnHash(turnId),
			reason: "optimistic_source_item_missing"
		});
		return false;
	}
	let targetTurn = thread.turns.find((turn) => String(turn && turn.id || "") === turnId);
	if (!targetTurn) {
		targetTurn = {
			id: turnId,
			status: { type: "active" },
			startedAt: sourceTurn && sourceTurn.startedAt,
			startedAtMs: sourceTurn && sourceTurn.startedAtMs,
			completedAt: null,
			durationMs: null,
			items: []
		};
		thread.turns.push(targetTurn);
	}
	clientRenderStabilityGuard.transferSubmittedTurnIdentity(sourceTurn, targetTurn, submissionId);
	const changed = mergeSubmittedUserItemIntoTurn(targetTurn, sourceItem);
	markRecentSubmittedUserMessageAccepted(id, submissionId, turnId);
	if (sourceTurn && sourceTurn !== targetTurn) {
		sourceTurn.items = (sourceTurn.items || []).filter((item) => item !== sourceItem);
		if (!sourceTurn.items.length && /^local-turn-/.test(String(sourceTurn.id || ""))) thread.turns = thread.turns.filter((turn) => turn !== sourceTurn);
	}
	normalizeThreadVisibleUserMessages(thread);
	syncLocalSubmissionThread(thread);
	if (typeof recordSubmittedEchoDiagnosticLog === "function") recordSubmittedEchoDiagnosticLog("reconcile-applied", {
		threadId: id,
		clientSubmissionId: submissionId,
		sourceTurnHash: diagnosticTurnHash(sourceTurn && sourceTurn.id),
		serverTurnHash: diagnosticTurnHash(turnId),
		changed,
		movedTurn: Boolean(sourceTurn && sourceTurn !== targetTurn)
	});
	return changed;
}
function markSubmittedUserMessageFailed$1(threadId, text, attachments, clientSubmissionId, message) {
	const id = String(clientSubmissionId || "").trim();
	if (!id) return;
	pruneRecentSubmittedUserMessages();
	const record = state.recentSubmittedUserMessages.get(id) || {
		threadId: String(threadId || ""),
		item: localUserMessageItem(text, attachments || [], id),
		createdAtMs: Date.now()
	};
	record.threadId = String(threadId || record.threadId || "");
	record.item = Object.assign({}, record.item || localUserMessageItem(text, attachments || [], id), {
		mobilePendingSubmission: true,
		mobileSendError: { message: String(message || "发送失败，请重试") }
	});
	state.recentSubmittedUserMessages.set(id, record);
	const thread = mutableThreadForLocalSubmission(threadId);
	if (!thread || threadId && thread.id !== threadId) return;
	thread.turns = Array.isArray(thread.turns) ? thread.turns : [];
	let found = false;
	for (const turn of thread.turns) {
		if (!turn || !Array.isArray(turn.items)) continue;
		const item = turn.items.find((entry) => entry && entry.clientSubmissionId === id);
		if (!item) continue;
		Object.assign(item, {
			mobilePendingSubmission: true,
			mobileSendError: record.item.mobileSendError
		});
		found = true;
	}
	if (!found) {
		const localTurnId = activeTurnIdForThread(thread) || `local-turn-${id}`;
		let turn = thread.turns.find((entry) => entry && entry.id === localTurnId);
		if (!turn) {
			turn = {
				id: localTurnId,
				status: { type: "failed" },
				startedAt: Math.floor(Date.now() / 1e3),
				completedAt: Math.floor(Date.now() / 1e3),
				durationMs: 0,
				items: []
			};
			thread.turns.push(turn);
		}
		turn.items = mergeItemsPreservingLocalVisible([record.item], turn.items || [], true);
	}
	syncLocalSubmissionThread(thread);
	scheduleRenderCurrentThread();
}
function recentSubmittedUserRecordBelongsToThread(record, threadId) {
	if (!record) return false;
	return !(record.threadId && threadId && record.threadId !== threadId);
}
function isRecentlySubmittedUserMessage$1(item) {
	if (!item || item.type !== "userMessage") return false;
	pruneRecentSubmittedUserMessages();
	const threadId = String(state.renderContextThreadId || state.currentThreadId || state.currentThread && state.currentThread.id || "");
	const id = String(item.clientSubmissionId || "").trim();
	if (id) {
		if (recentSubmittedUserRecordBelongsToThread(state.recentSubmittedUserMessages.get(id), threadId)) return true;
	}
	const records = state.recentSubmittedUserMessages;
	if (!records || typeof records.values !== "function") return false;
	for (const record of records.values()) {
		if (!recentSubmittedUserRecordBelongsToThread(record, threadId)) continue;
		if (record && record.item && userMessagesLikelySame(record.item, item)) return true;
	}
	return false;
}
function base64UrlToUint8Array(value) {
	const base64 = `${value}${"=".repeat((4 - value.length % 4) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
	const raw = window.atob(base64);
	const out = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
	return out;
}
function pushSubscriptionToJson(subscription) {
	return typeof subscription.toJSON === "function" ? subscription.toJSON() : subscription;
}
function pushBrowserAvailable() {
	if (isHermesEmbedMode()) return false;
	return Boolean(state.pushServerSupported && window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
}
function escapeHtml$1(value) {
	return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#039;");
}
function escapeSelectorAttr(value) {
	const text = String(value ?? "");
	if (typeof CSS !== "undefined" && CSS && typeof CSS.escape === "function") return CSS.escape(text);
	return text.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}
function resetCopyTextStore() {
	state.copyTextStore.clear();
	state.copySeq = 0;
}
function rememberCopyText(value) {
	const text = String(value ?? "");
	if (!text.trim()) return "";
	state.copySeq += 1;
	const key = `copy-${state.copySeq}`;
	state.copyTextStore.set(key, text);
	return key;
}
function htmlAttrs(attrs = {}) {
	return Object.entries(attrs || {}).filter(([, value]) => value !== void 0 && value !== null && String(value) !== "").map(([key, value]) => ` ${key}="${escapeHtml$1(value)}"`).join("");
}
function copyButtonHtml(copyKey, label, className = "", attrs = {}) {
	if (!copyKey) return "";
	return `<button class="${escapeHtml$1(["copy-button", className].filter(Boolean).join(" "))}" type="button" data-copy-key="${escapeHtml$1(copyKey)}" title="${escapeHtml$1(label)}" aria-label="${escapeHtml$1(label)}"${htmlAttrs(attrs)}>${escapeHtml$1(label)}</button>`;
}
function fallbackCopyText(text) {
	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.top = "-1000px";
	textarea.style.left = "-1000px";
	textarea.style.opacity = "0";
	document.body.appendChild(textarea);
	textarea.focus();
	textarea.select();
	textarea.setSelectionRange(0, textarea.value.length);
	let ok = false;
	try {
		ok = document.execCommand("copy");
	} finally {
		textarea.remove();
	}
	if (!ok) throw new Error("copy failed");
}
async function copyTextToClipboard(text) {
	if (navigator.clipboard && window.isSecureContext) {
		await navigator.clipboard.writeText(text);
		return;
	}
	fallbackCopyText(text);
}
async function fullCopyTextForButton(button) {
	if (!button || !button.dataset || !button.dataset.fullCopyThreadId || !button.dataset.fullCopyItemId) return "";
	const params = new URLSearchParams({ itemId: button.dataset.fullCopyItemId });
	if (button.dataset.fullCopyTurnId) params.set("turnId", button.dataset.fullCopyTurnId);
	const threadId = encodeURIComponent(button.dataset.fullCopyThreadId);
	const result = await api(`/api/threads/${threadId}/copy-text?${params.toString()}`, { timeoutMs: 45e3 });
	return String(result && result.text || "");
}
function showCopyFeedback(button) {
	if (!button) return;
	const previous = button.textContent || "复制";
	const existing = state.copyFeedbackTimers.get(button);
	if (existing) window.clearTimeout(existing);
	button.textContent = "已复制";
	button.classList.add("copied");
	const timer = window.setTimeout(() => {
		button.textContent = previous;
		button.classList.remove("copied");
		state.copyFeedbackTimers.delete(button);
	}, 900);
	state.copyFeedbackTimers.set(button, timer);
}
async function handleCopyButtonClick(button) {
	const key = button && button.dataset ? button.dataset.copyKey : "";
	let text = "";
	if (button && button.dataset && button.dataset.fullCopyText === "true") {
		text = await fullCopyTextForButton(button);
		if (text && key) state.copyTextStore.set(key, text);
	}
	if (!text) text = state.copyTextStore.get(key || "");
	if (!text) return;
	await copyTextToClipboard(text);
	showCopyFeedback(button);
}
function truncateMiddle$1(value, maxChars, label) {
	const text = String(value ?? "");
	if (text.length <= maxChars) return text;
	const head = Math.floor(maxChars * .42);
	const tail = maxChars - head;
	return `${text.slice(0, head)}\n\n[${label} truncated: ${text.length} chars total, showing first ${head} and last ${tail}]\n\n${text.slice(-tail)}`;
}
function compactLiveText(value) {
	return truncateMiddle$1(value, MAX_LIVE_TEXT_CHARS, "text");
}
function appendCommandOutput(item, delta) {
	const text = String(delta || "");
	const current = item.aggregatedOutput || "";
	const nextTotal = (item.outputTotalChars || current.length) + text.length;
	let next = current + text;
	if (next.length > MAX_COMMAND_OUTPUT_CHARS) {
		next = next.slice(-MAX_COMMAND_OUTPUT_CHARS);
		item.outputTruncated = true;
	}
	if (item.outputTruncated || nextTotal > next.length) {
		item.outputTruncated = true;
		item.outputTotalChars = nextTotal;
	}
	item.aggregatedOutput = next;
}
function shortPath$1(value) {
	if (!value) return "";
	return String(value).replace(/^\\\\\?\\/, "").replace(/^.*[\\/]/, "");
}
function formatAbsoluteTime$1(seconds) {
	if (!seconds) return "";
	return (/* @__PURE__ */ new Date(seconds * 1e3)).toLocaleString([], {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit"
	});
}
function formatTime$1(seconds, nowMs = Date.now()) {
	const value = Number(seconds || 0);
	if (!value) return "";
	const diffMs = Math.max(0, nowMs - value * 1e3);
	const minute = 60 * 1e3;
	const hour = 60 * minute;
	const day = 24 * hour;
	if (diffMs < 45 * 1e3) return "刚刚";
	if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))}分钟前`;
	if (diffMs < day) {
		const hours = Math.floor(diffMs / hour);
		const minutes = Math.floor(diffMs % hour / minute);
		return minutes ? `${hours}小时${minutes}分钟前` : `${hours}小时前`;
	}
	if (diffMs < 30 * day) return `${Math.floor(diffMs / day)}天前`;
	return formatAbsoluteTime$1(seconds);
}
function sameLocalDate(left, right) {
	return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}
function formatCardTimestamp(ms, nowMs = Date.now()) {
	const value = Number(ms || 0);
	if (!Number.isFinite(value) || value <= 0) return "";
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) return "";
	const time = date.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit"
	});
	if (sameLocalDate(date, new Date(nowMs))) return time;
	return `${date.toLocaleDateString([], {
		month: "2-digit",
		day: "2-digit"
	})} ${time}`;
}
function formatElapsedTime$1(seconds) {
	const total = Math.max(0, Math.floor(Number(seconds) || 0));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor(total % 3600 / 60);
	const secs = total % 60;
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
function statusText$1(status) {
	if (!status) return "";
	if (typeof status === "string") return status;
	return status.type || JSON.stringify(status);
}
function isStaleActiveStatus$1(status) {
	if (!status || typeof status !== "object") return false;
	return Boolean(status.mobileStaleActiveTurn || status.staleActiveTurn || status.reason === "context-only-active-turn");
}
function saveThreadStatusHints() {
	saveStringSetStorage(STORAGE_RUNNING_THREAD_IDS, state.runningThreadIds);
	saveNumberMapStorage(STORAGE_RUNNING_THREAD_HINTED_AT, state.runningThreadHintedAtById);
	saveStringSetStorage(STORAGE_UNREAD_THREAD_IDS, state.unreadThreadIds);
	saveNumberMapStorage(STORAGE_THREAD_VIEWED_AT, state.threadViewedAtById);
}
function isRecoverableThreadDisplayTitle(value, threadId = "") {
	const text = String(value || "").trim();
	const id = String(threadId || "").trim();
	if (!text) return true;
	if (id && text === id) return true;
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) || /^#\s*Continuation Bootstrap Index\b/i.test(text) || /This thread is a same-workspace continuation created by Codex Mobile Web/i.test(text);
}
function preferredThreadDisplayTitle(thread) {
	if (!thread || typeof thread !== "object") return "";
	const id = String(thread.id || thread.threadId || "");
	for (const value of [
		thread.displayTitle,
		thread.threadTitle,
		thread.thread_name,
		thread.name,
		thread.title,
		thread.preview
	]) {
		const text = String(value || "").trim();
		if (text && !isRecoverableThreadDisplayTitle(text, id)) return text;
	}
	return id;
}
function threadDisplayName$1(thread) {
	return preferredThreadDisplayTitle(thread);
}
function isPwaMode() {
	return Boolean(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone);
}
function triggerCompletionHaptic() {
	if (!supportsCompletionHaptic()) return false;
	const visible = document.visibilityState === "visible";
	const inPwa = isPwaMode();
	if (!visible && !inPwa) return false;
	try {
		return navigator.vibrate([
			140,
			70,
			140
		]);
	} catch (_) {
		return false;
	}
}
function supportsCompletionHaptic() {
	return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}
function completionAudioContext() {
	const AudioContext = window.AudioContext || window.webkitAudioContext;
	if (!AudioContext) return null;
	if (!state.completionAudioContext) state.completionAudioContext = new AudioContext();
	return state.completionAudioContext;
}
function playCompletionTone(options = {}) {
	const audioContext = completionAudioContext();
	if (!audioContext) return false;
	const audible = options.audible !== false;
	const playTone = () => {
		const nowAt = audioContext.currentTime;
		(audible ? [{
			at: 0,
			frequency: 523.25,
			duration: .11,
			peak: .038
		}, {
			at: .115,
			frequency: 659.25,
			duration: .15,
			peak: .032
		}] : [{
			at: 0,
			frequency: 440,
			duration: .035,
			peak: 1e-4
		}]).forEach((note) => {
			const startAt = nowAt + note.at;
			const osc = audioContext.createOscillator();
			const gain = audioContext.createGain();
			osc.type = "sine";
			osc.frequency.setValueAtTime(note.frequency, startAt);
			gain.gain.setValueAtTime(1e-4, startAt);
			gain.gain.linearRampToValueAtTime(note.peak, startAt + .012);
			gain.gain.exponentialRampToValueAtTime(1e-4, startAt + note.duration);
			osc.connect(gain);
			gain.connect(audioContext.destination);
			osc.start(startAt);
			osc.stop(startAt + note.duration + .02);
			setTimeout(() => {
				osc.disconnect();
				gain.disconnect();
			}, Math.ceil((note.at + note.duration + .12) * 1e3));
		});
	};
	if (audioContext.state === "suspended") {
		audioContext.resume().then(() => {
			state.completionAudioUnlocked = true;
			playTone();
		}).catch(() => {});
		return false;
	}
	state.completionAudioUnlocked = true;
	playTone();
	return true;
}
function primeCompletionAudio() {
	if (!state.completionSoundEnabled || state.completionAudioUnlocked) return;
	playCompletionTone({ audible: false });
}
function showCompletionAlert(threadId, threadName) {
	if (isHermesEmbedMode()) return;
	if (!state.completionSoundEnabled) return;
	const now = Date.now();
	if (now - state.lastCompletionSoundAt < 1800) return;
	state.lastCompletionSoundAt = now;
	triggerCompletionHaptic();
	const title = String(threadName || threadDisplayName$1(state.threads.find((thread) => String(thread.id || "") === String(threadId || ""))) || threadId || "").trim();
	if (document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
		const notifier = new Notification("会话任务完成", {
			body: `${title || "会话"} 已完成，可切回查看`,
			tag: `codex-thread-complete-${threadId}`,
			renotify: false,
			silent: false,
			requireInteraction: false,
			vibrate: [
				90,
				45,
				90
			]
		});
		if (notifier && "addEventListener" in notifier) notifier.onclick = () => {
			try {
				window.focus();
				$("app").scrollIntoView();
			} catch (_) {}
		};
	}
	playCompletionTone({ audible: true });
}
function threadForStatusHint(threadId, inputThread = null) {
	const id = String(threadId || "");
	if (!id) return inputThread || null;
	if (inputThread && String(inputThread.id || id) === id) return inputThread;
	if (state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
	return state.threads.find((thread) => String(thread && thread.id || "") === id) || inputThread || null;
}
function threadViewedAtMs(threadId) {
	return Number(state.threadViewedAtById[String(threadId || "")] || 0);
}
function markThreadViewed(threadId, thread = null, viewedAtMs = Date.now()) {
	const id = String(threadId || "");
	if (!id) return;
	const viewedThread = threadForStatusHint(id, thread);
	const nowMs = Date.now();
	const explicitViewedAt = Math.min(numericTimestampMs(viewedAtMs), nowMs);
	const viewedAt = Math.max(explicitViewedAt || 0, nowMs);
	let changed = false;
	if (state.unreadThreadIds.delete(id)) changed = true;
	if (Number.isFinite(viewedAt) && viewedAt > 0 && viewedAt > threadViewedAtMs(id)) {
		state.threadViewedAtById[id] = viewedAt;
		changed = true;
	}
	const status = viewedThread && viewedThread.status;
	const staleActive = isStaleActiveStatus$1(status) || Boolean(viewedThread && viewedThread.mobileStaleActiveTurn);
	const freshSettled = isThreadListSettledStatus(status) && !shouldKeepRunningHintForSettledStatus(id, viewedThread, status, { eventAtMs: threadUpdatedAtMs$1(viewedThread) });
	if ((staleActive || freshSettled) && clearRunningThreadHint(id)) changed = true;
	if (changed) saveThreadStatusHints();
}
function noteRunningThreadHint(threadId, nowMs = Date.now()) {
	const id = String(threadId || "");
	if (!id) return false;
	let changed = false;
	if (!state.runningThreadIds.has(id)) {
		state.runningThreadIds.add(id);
		changed = true;
	}
	const previous = Number(state.runningThreadHintedAtById[id] || 0);
	if (!previous || Math.abs(nowMs - previous) > 1e3) {
		state.runningThreadHintedAtById[id] = nowMs;
		changed = true;
	}
	return changed;
}
function noteSubmittedProcessingThreadHint$1(threadId, nowMs = Date.now()) {
	const id = String(threadId || "");
	if (!id) return false;
	const previous = Number(state.submittedProcessingThreadHintedAtById[id] || 0);
	if (previous && Math.abs(nowMs - previous) <= 1e3) return false;
	state.submittedProcessingThreadHintedAtById[id] = nowMs;
	return true;
}
function clearSubmittedProcessingThreadHint(threadId) {
	const id = String(threadId || "");
	if (!id) return false;
	if (!Object.prototype.hasOwnProperty.call(state.submittedProcessingThreadHintedAtById, id)) return false;
	delete state.submittedProcessingThreadHintedAtById[id];
	return true;
}
function clearRunningThreadHint(threadId) {
	const id = String(threadId || "");
	if (!id) return false;
	let changed = false;
	if (state.runningThreadIds.delete(id)) changed = true;
	if (Object.prototype.hasOwnProperty.call(state.runningThreadHintedAtById, id)) {
		delete state.runningThreadHintedAtById[id];
		changed = true;
	}
	if (clearSubmittedProcessingThreadHint(id)) changed = true;
	return changed;
}
function threadUpdatedAtMs$1(thread) {
	return threadStatusHintPolicy.threadUpdatedAtMs(thread);
}
function threadStatusNotificationDurableEventAtMs(params = {}) {
	return threadStatusHintPolicy.notificationDurableEventAtMs(params);
}
function threadStatusNotificationEventAtMs(params = {}, fallbackMs = 0, options = {}) {
	return threadStatusHintPolicy.notificationEventAtMs(params, fallbackMs, options);
}
function threadLatestTerminalTurnAtMs(thread) {
	return threadStatusHintPolicy.latestTerminalTurnAtMs(thread);
}
function currentThreadAllowsLiveTurn() {
	const thread = state.currentThread;
	if (!thread) return true;
	const status = thread.status;
	if (isStaleActiveStatus$1(status) || thread.mobileStaleActiveTurn) return false;
	if (isThreadListSettledStatus(status)) return false;
	return true;
}
function currentLiveTurnSupportsThreadStatusHint(threadId = "") {
	const id = String(threadId || "");
	return Boolean(id && id === state.currentThreadId && currentThreadAllowsLiveTurn() && currentLiveTurn());
}
function currentThreadRefreshSupportsThreadStatusHint(threadId = "") {
	const id = String(threadId || "");
	if (!id || id !== String(state.currentThreadId || "")) return false;
	if (state.threadLoadController || state.refreshThreadController) return true;
	return Boolean(state.currentThread && String(state.currentThread.id || "") === id && state.currentThread.mobileLoading);
}
function shouldKeepRunningHintForSettledStatus(threadId, thread = null, status = null, options = {}) {
	const id = String(threadId || "");
	const inputThread = threadForStatusHint(id, thread);
	return threadStatusHintPolicy.shouldKeepRunningHintForSettledStatus({
		threadId: id,
		thread: inputThread,
		status: status || inputThread && inputThread.status,
		isRunningHinted: state.runningThreadIds.has(id),
		runningHintedAtMs: state.runningThreadHintedAtById[id],
		submittedProcessingHintedAtMs: state.submittedProcessingThreadHintedAtById[id],
		submittedProcessingHintStaleMs: SUBMITTED_PROCESSING_HINT_STALE_MS,
		currentThreadId: state.currentThreadId,
		currentThreadSettled: !currentThreadAllowsLiveTurn(),
		currentThreadHasLiveTurn: currentLiveTurnSupportsThreadStatusHint(id),
		currentThreadRefreshing: currentThreadRefreshSupportsThreadStatusHint(id),
		eventAtMs: options.eventAtMs,
		eventIsTerminal: Boolean(options.eventIsTerminal),
		mobileReplay: Boolean(options.mobileReplay),
		allowLocalProcessing: options.allowLocalProcessing !== false,
		freshnessToleranceMs: STATUS_EVENT_FRESHNESS_TOLERANCE_MS,
		nowMs: options.nowMs
	});
}
function shouldMarkThreadUnread(threadId, thread = null, status = null, options = {}) {
	const id = String(threadId || "");
	const inputThread = threadForStatusHint(id, thread);
	return threadStatusHintPolicy.shouldMarkThreadUnread({
		threadId: id,
		currentThreadId: state.currentThreadId,
		thread: inputThread,
		status: status || inputThread && inputThread.status,
		viewedAtMs: state.threadViewedAtById[id],
		wasRunning: Boolean(options.wasRunning),
		runningHintedAtMs: options.hintedAtMs || state.runningThreadHintedAtById[id],
		eventAtMs: options.eventAtMs,
		eventIsTerminal: Boolean(options.eventIsTerminal),
		mobileReplay: Boolean(options.mobileReplay),
		freshnessToleranceMs: STATUS_EVENT_FRESHNESS_TOLERANCE_MS
	});
}
function runningThreadHintAgeMs(threadId, thread, nowMs = Date.now()) {
	return threadStatusHintPolicy.runningHintAgeMs({
		threadId: String(threadId || ""),
		thread,
		runningHintedAtMs: state.runningThreadHintedAtById[String(threadId || "")],
		runningHintStaleMs: RUNNING_THREAD_HINT_STALE_MS,
		nowMs
	});
}
function shouldExpireRunningThreadHint(threadId, thread, nowMs = Date.now()) {
	const id = String(threadId || "");
	const inputThread = threadForStatusHint(id, thread);
	return threadStatusHintPolicy.shouldExpireRunningThreadHint({
		threadId: id,
		thread: inputThread,
		status: inputThread && inputThread.status,
		isRunningHinted: state.runningThreadIds.has(id),
		runningHintedAtMs: state.runningThreadHintedAtById[id],
		submittedProcessingHintedAtMs: state.submittedProcessingThreadHintedAtById[id],
		submittedProcessingHintStaleMs: SUBMITTED_PROCESSING_HINT_STALE_MS,
		currentThreadId: state.currentThreadId,
		currentThreadSettled: !currentThreadAllowsLiveTurn(),
		currentThreadHasLiveTurn: currentLiveTurnSupportsThreadStatusHint(id),
		currentThreadRefreshing: currentThreadRefreshSupportsThreadStatusHint(id),
		freshnessToleranceMs: STATUS_EVENT_FRESHNESS_TOLERANCE_MS,
		runningHintStaleMs: RUNNING_THREAD_HINT_STALE_MS,
		nowMs
	});
}
function updateThreadStatusHints$1(threadId, previousStatus, nextStatus, options = {}) {
	const id = String(threadId || "");
	if (!id) return;
	const thread = threadForStatusHint(id, options.thread);
	const nextThread = thread ? Object.assign({}, thread, { status: nextStatus || thread.status }) : null;
	const wasRunning = state.runningThreadIds.has(id) || isRunningStatus(previousStatus);
	const isRunning = isRunningStatus(nextStatus);
	const staleActive = isStaleActiveStatus$1(nextStatus);
	const eventIsTerminal = isThreadListTerminalStatus(nextStatus);
	let changed = false;
	let shouldAlert = false;
	if (isRunning) {
		if (noteRunningThreadHint(id)) changed = true;
		if (state.unreadThreadIds.delete(id)) changed = true;
	} else if (wasRunning) {
		const hintedAtMs = Number(state.runningThreadHintedAtById[id] || 0);
		const keepRunningHint = shouldKeepRunningHintForSettledStatus(id, nextThread, nextStatus, {
			eventAtMs: options.eventAtMs,
			eventIsTerminal,
			mobileReplay: Boolean(options.mobileReplay),
			allowLocalProcessing: options.allowLocalProcessing !== false
		});
		const shouldUnread = !keepRunningHint && !staleActive && !state.unreadThreadIds.has(id) && shouldMarkThreadUnread(id, nextThread, nextStatus, {
			wasRunning,
			eventAtMs: options.eventAtMs,
			eventIsTerminal,
			hintedAtMs,
			mobileReplay: Boolean(options.mobileReplay)
		});
		if (!keepRunningHint && clearRunningThreadHint(id)) changed = true;
		if (shouldUnread) {
			state.unreadThreadIds.add(id);
			changed = true;
			shouldAlert = true;
		}
	} else if (!state.unreadThreadIds.has(id) && shouldMarkThreadUnread(id, nextThread, nextStatus, {
		wasRunning,
		eventAtMs: options.eventAtMs,
		eventIsTerminal,
		mobileReplay: Boolean(options.mobileReplay)
	})) {
		state.unreadThreadIds.add(id);
		changed = true;
		shouldAlert = true;
	}
	if (changed) saveThreadStatusHints();
	if (shouldAlert && options.notify) showCompletionAlert(id, options.threadName || threadDisplayName$1(thread));
}
function isThreadListSettledStatus(status) {
	return threadStatusHintPolicy.isSettledStatus(status);
}
function isThreadListTerminalStatus(status) {
	return threadStatusHintPolicy.isTerminalStatus(status);
}
function reconcileThreadStatusHints$1(threads) {
	const nowMs = Date.now();
	let changed = false;
	for (const thread of threads || []) {
		const id = String(thread && thread.id || "");
		if (!id) continue;
		const wasRunning = state.runningThreadIds.has(id);
		const staleActive = isStaleActiveStatus$1(thread.status) || Boolean(thread.mobileStaleActiveTurn);
		const isRunning = !staleActive && isRunningStatus(thread.status);
		if (isRunning && !wasRunning) {
			if (noteRunningThreadHint(id, nowMs)) changed = true;
			if (state.unreadThreadIds.delete(id)) changed = true;
		} else if (isRunning) {
			if (noteRunningThreadHint(id, nowMs)) changed = true;
			if (state.unreadThreadIds.delete(id)) changed = true;
		} else if (wasRunning && staleActive) {
			if (clearRunningThreadHint(id)) changed = true;
		} else if (wasRunning && isThreadListSettledStatus(thread.status)) {
			const terminalAtMs = threadLatestTerminalTurnAtMs(thread);
			if (currentThreadRefreshSupportsThreadStatusHint(id)) {
				if (noteRunningThreadHint(id, nowMs)) changed = true;
				continue;
			}
			if (currentLiveTurnSupportsThreadStatusHint(id)) {
				if (noteRunningThreadHint(id, nowMs)) changed = true;
				continue;
			}
			const hintedAtMs = Number(state.runningThreadHintedAtById[id] || 0);
			if (shouldKeepRunningHintForSettledStatus(id, thread, thread.status, {
				eventAtMs: threadUpdatedAtMs$1(thread),
				eventIsTerminal: Boolean(terminalAtMs)
			})) {
				if (shouldExpireRunningThreadHint(id, thread, nowMs) && clearRunningThreadHint(id)) changed = true;
				continue;
			}
			if (clearRunningThreadHint(id)) changed = true;
			if (!state.unreadThreadIds.has(id) && shouldMarkThreadUnread(id, thread, thread.status, {
				wasRunning,
				eventAtMs: terminalAtMs,
				eventIsTerminal: Boolean(terminalAtMs),
				hintedAtMs
			})) {
				state.unreadThreadIds.add(id);
				changed = true;
			}
		} else if (!wasRunning && !state.unreadThreadIds.has(id)) {
			const terminalAtMs = threadLatestTerminalTurnAtMs(thread);
			if (shouldMarkThreadUnread(id, thread, thread.status, {
				wasRunning,
				eventAtMs: terminalAtMs,
				eventIsTerminal: Boolean(terminalAtMs)
			})) {
				state.unreadThreadIds.add(id);
				changed = true;
			}
		} else if (shouldExpireRunningThreadHint(id, thread, nowMs)) {
			if (clearRunningThreadHint(id)) changed = true;
		}
	}
	if (changed) saveThreadStatusHints();
}
function statusIconInfo$1(status, threadId = "") {
	if (isStaleActiveStatus$1(status)) return null;
	const text = statusText$1(status);
	const normalized = text.toLowerCase();
	if (/active|running|queued|processing|inprogress|in_progress|in-progress|pending|started/.test(normalized)) return {
		kind: "running",
		label: text || "running",
		symbol: ""
	};
	const id = String(threadId || "");
	if (id && currentThreadRefreshSupportsThreadStatusHint(id)) return {
		kind: "running",
		label: "refreshing",
		symbol: ""
	};
	const hintThread = id ? threadForStatusHint(id) : null;
	if (id && state.runningThreadIds.has(id) && (!isThreadListSettledStatus(status) || currentLiveTurnSupportsThreadStatusHint(id) || shouldKeepRunningHintForSettledStatus(id, hintThread, status))) return {
		kind: "running",
		label: text && text !== "notLoaded" ? text : "running",
		symbol: ""
	};
	if (id && state.unreadThreadIds.has(id)) return {
		kind: "unread",
		label: "completed, unread",
		symbol: ""
	};
	return null;
}
function statusIconHtml$1(status, className = "", threadId = "") {
	const info = statusIconInfo$1(status, threadId);
	if (!info) return "";
	return `<span class="status-icon status-icon-${escapeHtml$1(info.kind)}${className ? ` ${escapeHtml$1(className)}` : ""}" title="${escapeHtml$1(info.label)}" aria-label="${escapeHtml$1(info.label)}" role="img">${escapeHtml$1(info.symbol || "")}</span>`;
}
function rolloutSizeBytes$1(thread) {
	const size = Number(thread && thread.rolloutSizeBytes);
	return Number.isFinite(size) && size > 0 ? size : 0;
}
function rolloutThresholdBytes$1(thread) {
	const size = Number(thread && thread.rolloutWarningThresholdBytes);
	return Number.isFinite(size) && size > 0 ? size : state.rolloutWarningThresholdBytes;
}
function isRolloutOverThreshold$1(thread) {
	const size = rolloutSizeBytes$1(thread);
	const threshold = rolloutThresholdBytes$1(thread);
	return Boolean(thread && thread.rolloutOverWarningThreshold) || size > 0 && threshold > 0 && size >= threshold;
}
function rolloutWarningDismissKey(thread) {
	const threadId = String(thread && thread.id || state.currentThreadId || "").trim();
	const size = rolloutSizeBytes$1(thread);
	return threadId && size > 0 ? `${threadId}|${size}` : "";
}
function isRolloutWarningDismissed$1(thread) {
	const key = rolloutWarningDismissKey(thread);
	return Boolean(key && state.rolloutWarningDismissals.has(key));
}
function dismissRolloutWarning(thread) {
	const key = rolloutWarningDismissKey(thread);
	if (!key) return;
	state.rolloutWarningDismissals.add(key);
	saveStringSetStorage(STORAGE_DISMISSED_ROLLOUT_WARNINGS, state.rolloutWarningDismissals);
	renderCurrentThread();
}
function rolloutSizeText$1(thread) {
	const size = rolloutSizeBytes$1(thread);
	return size > 0 ? formatFileSize(size) : "";
}
function tokenCountValue$1(value) {
	const number = Number(value);
	return Number.isFinite(number) && number > 0 ? number : 0;
}
function formatTokenMillion$1(value) {
	const tokens = tokenCountValue$1(value);
	if (!tokens) return "0百万";
	const million = tokens / 1e6;
	if (million >= 100) return `${million.toFixed(0)}百万`;
	if (million >= 10) return `${million.toFixed(1)}百万`;
	if (million >= .01) return `${million.toFixed(2)}百万`;
	return "<0.01百万";
}
function tokenUsageForThread(thread) {
	return thread && thread.mobileTokenUsage && typeof thread.mobileTokenUsage === "object" ? thread.mobileTokenUsage : null;
}
function normalizeThreadGoalStatus(value) {
	const raw = String(value || "").trim();
	if (!raw) return "active";
	const normalized = raw.replace(/[-\s]+/g, "_").toLowerCase();
	if (normalized === "active") return "active";
	if (normalized === "paused") return "paused";
	if (normalized === "complete" || normalized === "completed") return "complete";
	if (normalized === "budget_limited" || normalized === "budgetlimited") return "budgetLimited";
	if (normalized === "usage_limited" || normalized === "usagelimited") return "usageLimited";
	if (normalized === "blocked") return "blocked";
	return normalized.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}
function normalizeThreadGoal$1(goal, fallbackThreadId = "") {
	if (!goal || typeof goal !== "object") return null;
	const threadId = String(goal.threadId || fallbackThreadId || "").trim();
	const objective = String(goal.objective || "").replace(/\s+/g, " ").trim();
	if (!threadId || !objective) return null;
	const tokenBudget = goal.tokenBudget === null || goal.tokenBudget === void 0 || goal.tokenBudget === "" ? null : Math.max(0, Math.trunc(Number(goal.tokenBudget) || 0));
	return {
		threadId,
		objective,
		status: normalizeThreadGoalStatus(goal.status),
		tokenBudget,
		tokensUsed: Math.max(0, Math.trunc(Number(goal.tokensUsed) || 0)),
		timeUsedSeconds: Math.max(0, Math.trunc(Number(goal.timeUsedSeconds) || 0)),
		createdAt: Math.max(0, Math.trunc(Number(goal.createdAt) || 0)),
		updatedAt: Math.max(0, Math.trunc(Number(goal.updatedAt) || 0))
	};
}
function submittedThreadGoal$1(threadId, objective, tokenBudget = null) {
	const now = Date.now();
	return normalizeThreadGoal$1({
		threadId,
		objective,
		status: "active",
		tokenBudget,
		tokensUsed: 0,
		timeUsedSeconds: 0,
		createdAt: now,
		updatedAt: now
	}, threadId);
}
function threadGoalForThread$1(thread) {
	return normalizeThreadGoal$1(thread && thread.goal, thread && thread.id);
}
function threadGoalStatusLabel(status) {
	const value = normalizeThreadGoalStatus(status);
	if (value === "paused") return "Paused";
	if (value === "complete") return "Done";
	if (value === "budgetLimited") return "Budget";
	if (value === "usageLimited") return "Limited";
	if (value === "blocked") return "Blocked";
	return "Goal";
}
function threadGoalStatusClass(status) {
	return normalizeThreadGoalStatus(status).replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
}
function threadGoalSignature$1(thread) {
	const goal = threadGoalForThread$1(thread);
	if (!goal) return null;
	return {
		objective: goal.objective,
		status: goal.status,
		tokenBudget: goal.tokenBudget,
		tokensUsed: goal.tokensUsed,
		timeUsedSeconds: goal.timeUsedSeconds,
		updatedAt: goal.updatedAt
	};
}
function threadGoalBudgetText(goal) {
	if (!goal) return "";
	const parts = [];
	if (Number.isFinite(Number(goal.tokenBudget)) && Number(goal.tokenBudget) > 0) parts.push(`${Number(goal.tokensUsed || 0).toLocaleString()}/${Number(goal.tokenBudget).toLocaleString()} budget tokens`);
	else if (Number(goal.tokensUsed || 0) > 0) parts.push(`${Number(goal.tokensUsed || 0).toLocaleString()} budget tokens`);
	if (Number(goal.timeUsedSeconds || 0) > 0) parts.push(formatElapsedTime$1(goal.timeUsedSeconds));
	return parts.join(" | ");
}
function renderThreadGoalBadge$1(goal) {
	if (!goal) return "";
	const status = normalizeThreadGoalStatus(goal.status);
	const statusClass = threadGoalStatusClass(status);
	const label = threadGoalStatusLabel(status);
	const title = `${label}: ${goal.objective}`;
	return `<div class="thread-card-goal-badge status-${escapeHtml$1(statusClass)}" title="${escapeHtml$1(title)}">${escapeHtml$1(label)}</div>`;
}
function renderThreadGoal(thread, previousKeys = /* @__PURE__ */ new Set()) {
	const goal = threadGoalForThread$1(thread);
	if (!goal) return "";
	const key = `thread-goal|${goal.threadId}|${goal.status}|${goal.updatedAt}|${goal.objective}`;
	const statusClass = threadGoalStatusClass(goal.status);
	const budget = threadGoalBudgetText(goal);
	return `<section class="thread-goal-card status-${escapeHtml$1(statusClass)}${entryAnimationClass(key, previousKeys)}" data-render-key="${escapeHtml$1(key)}">
    <div class="thread-goal-card-top">
      <span class="thread-goal-card-label">${escapeHtml$1(threadGoalStatusLabel(goal.status))}</span>
      ${budget ? `<span class="thread-goal-card-meta">${escapeHtml$1(budget)}</span>` : ""}
    </div>
    <div class="thread-goal-card-objective">${escapeHtml$1(goal.objective)}</div>
  </section>`;
}
function dialogPrefillThreadGoal(goal) {
	const normalizedGoal = normalizeThreadGoal$1(goal, goal && goal.threadId);
	if (!normalizedGoal) return null;
	return normalizedGoal.status === "complete" ? null : normalizedGoal;
}
function currentGoalDialogThread() {
	const threadId = String(state.goalDialogThreadId || state.currentThreadId || "").trim();
	return threadById(threadId) || (state.currentThread && String(state.currentThread.id || "") === threadId ? state.currentThread : null);
}
function goalDialogStatusText(goal) {
	if (!goal) return "";
	const parts = [threadGoalStatusLabel(goal.status)];
	const budget = threadGoalBudgetText(goal);
	if (budget) parts.push(budget);
	return parts.join(" | ");
}
function updateThreadGoalDialogState$1(goal = state.goalDialogExistingGoal) {
	const normalizedGoal = dialogPrefillThreadGoal(goal);
	state.goalDialogExistingGoal = normalizedGoal;
	const status = $("goalDialogStatus");
	if (status) {
		const text = goalDialogStatusText(normalizedGoal);
		status.textContent = text;
		status.classList.toggle("hidden", !text);
	}
	const actions = $("goalStateActions");
	if (actions) actions.classList.toggle("hidden", !normalizedGoal);
	const submitButton = $("goalSubmitButton");
	if (submitButton && !state.goalSubmitBusy) submitButton.textContent = normalizedGoal ? "Save" : "Send";
	const closeButton = $("goalCancelButton");
	if (closeButton) closeButton.textContent = normalizedGoal ? "Close" : "Cancel";
}
function setThreadGoalDialogBusy$1(busy, busyText = "Sending...") {
	state.goalSubmitBusy = Boolean(busy);
	state.goalDialogBusyText = state.goalSubmitBusy ? String(busyText || "Sending...") : "";
	[
		"goalObjectiveInput",
		"goalTokenBudgetInput",
		"goalSubmitButton",
		"goalCancelButton",
		"goalDialogClose",
		"goalContinueButton",
		"goalPauseButton",
		"goalClearButton"
	].forEach((id) => {
		const el = $(id);
		if (el) el.disabled = state.goalSubmitBusy;
	});
	const button = $("goalSubmitButton");
	if (button) button.textContent = state.goalSubmitBusy ? state.goalDialogBusyText : state.goalDialogExistingGoal ? "Save" : "Send";
}
function openThreadGoalDialog$1(threadId = state.currentThreadId) {
	const id = String(threadId || "").trim();
	if (!id) {
		showError(/* @__PURE__ */ new Error("No thread is selected"));
		return;
	}
	const thread = threadById(id) || (state.currentThread && String(state.currentThread.id || "") === id ? state.currentThread : null);
	if (!thread) {
		showError(/* @__PURE__ */ new Error("Thread is not loaded"));
		return;
	}
	const dialog = $("goalDialog");
	const objectiveInput = $("goalObjectiveInput");
	const budgetInput = $("goalTokenBudgetInput");
	if (!dialog || !objectiveInput || !budgetInput) return;
	const goal = dialogPrefillThreadGoal(threadGoalForThread$1(thread));
	state.goalDialogThreadId = id;
	objectiveInput.value = goal ? goal.objective : "";
	budgetInput.value = goal && Number(goal.tokenBudget || 0) > 0 ? String(goal.tokenBudget) : "";
	const subtitle = $("goalDialogSubtitle");
	if (subtitle) subtitle.textContent = threadTitleForDisplay(thread) || id;
	updateThreadGoalDialogState$1(goal);
	dialog.classList.remove("hidden");
	setThreadGoalDialogBusy$1(false);
	window.setTimeout(() => objectiveInput.focus(), 0);
}
function closeThreadGoalDialog$1(force = false) {
	if (state.goalSubmitBusy && !force) return;
	const dialog = $("goalDialog");
	if (dialog) dialog.classList.add("hidden");
	state.goalDialogThreadId = "";
	state.goalDialogExistingGoal = null;
	state.goalDialogBusyText = "";
	setThreadGoalDialogBusy$1(false);
}
function normalizeOptionList$1(values) {
	return runtimeSettings.normalizeOptionList(values);
}
function labelForModel$1(value) {
	return runtimeSettings.labelForModel(value);
}
function compactLabelForModel(value) {
	return runtimeSettings.compactLabelForModel(value);
}
function labelForEffort$1(value) {
	return runtimeSettings.labelForEffort(value);
}
function labelForPermissionMode$1(value) {
	return runtimeSettings.labelForPermissionMode(value);
}
function titleForPermissionMode(value) {
	return runtimeSettings.titleForPermissionMode(value);
}
function newThreadSelectedModel$1() {
	return runtimeSettings.selectedNewThreadModel({
		selected: state.newThreadModel,
		defaultValue: state.defaultModel,
		options: state.modelOptions
	});
}
function newThreadSelectedEffort$1() {
	return runtimeSettings.selectedNewThreadEffort({
		selected: state.newThreadEffort,
		defaultValue: state.defaultReasoningEffort,
		options: state.reasoningEffortOptions
	});
}
function newThreadSelectedPermissionMode$1() {
	return effectiveComposerPermissionMode$1(runtimeSettings.selectedNewThreadPermission({
		selected: state.newThreadPermissionMode,
		defaultValue: defaultNewThreadPermissionMode(),
		options: state.permissionModeOptions
	}));
}
function normalizePermissionModeValue$1(value) {
	return runtimeSettings.normalizePermissionModeValue(value);
}
function effectiveComposerPermissionMode$1(value) {
	const normalized = normalizePermissionModeValue$1(value);
	if (normalized === "custom" && defaultNewThreadPermissionMode() === "full") return "full";
	return normalized;
}
function normalizeModelKey(value) {
	return String(value || "").trim().toLowerCase().replace(/_/g, "-").replace(/[^a-z0-9.]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function isSparkModelKey(key) {
	return /\bspark\b/.test(normalizeModelKey(key));
}
function isRateLimitCompatibleWithModel(rateLimits, modelKey) {
	if (!rateLimits || !hasCurrentRateLimitWindow(rateLimits)) return false;
	const key = normalizeModelKey(modelKey);
	if (!key) return true;
	const limitId = normalizeModelKey(rateLimits.limitId);
	if (limitId === "codex-bengalfox") return isSparkModelKey(key);
	if (limitId === "codex") return !isSparkModelKey(key);
	const keys = rateLimitModelKeys(rateLimits);
	return keys.length === 0 || keys.includes(key);
}
function rateLimitModelKeys(rateLimits) {
	if (!rateLimits || typeof rateLimits !== "object") return [];
	const keys = /* @__PURE__ */ new Set();
	const add = (value) => {
		const key = normalizeModelKey(value);
		if (key) keys.add(key);
	};
	if (Array.isArray(rateLimits.modelKeys)) for (const value of rateLimits.modelKeys) add(value);
	add(rateLimits.model);
	add(rateLimits.limitName);
	const limitNameKey = normalizeModelKey(rateLimits.limitName);
	for (const model of normalizeOptionList$1([state.defaultModel, ...state.modelOptions])) {
		const modelKey = normalizeModelKey(model);
		if (modelKey && limitNameKey === modelKey) keys.add(modelKey);
	}
	const limitId = normalizeModelKey(rateLimits.limitId);
	if (limitId === "codex-bengalfox") keys.add("gpt-5.3-codex-spark");
	else if (limitId === "codex") for (const model of normalizeOptionList$1([state.defaultModel, ...state.modelOptions])) {
		const modelKey = normalizeModelKey(model);
		if (modelKey && !isSparkModelKey(modelKey)) keys.add(modelKey);
	}
	return [...keys];
}
function rememberRateLimits(rateLimits, rateLimitsByModel, options = {}) {
	let changed = false;
	if (options && options.replace === true) {
		state.rateLimits = null;
		state.rateLimitsByModel = {};
		changed = true;
	}
	if (rateLimitsByModel && typeof rateLimitsByModel === "object") for (const [model, value] of Object.entries(rateLimitsByModel)) {
		const key = normalizeModelKey(model);
		if (key && value && typeof value === "object" && hasCurrentRateLimitWindow(value)) {
			state.rateLimitsByModel[key] = value;
			changed = true;
		}
	}
	if (rateLimits && typeof rateLimits === "object" && hasCurrentRateLimitWindow(rateLimits)) {
		state.rateLimits = rateLimits;
		changed = true;
		for (const key of rateLimitModelKeys(rateLimits)) {
			state.rateLimitsByModel[normalizeModelKey(key)] = rateLimits;
			changed = true;
		}
	}
	if (changed) {
		localStorage.setItem(STORAGE_RATE_LIMITS, JSON.stringify(state.rateLimits || null));
		localStorage.setItem(STORAGE_RATE_LIMITS_BY_MODEL, JSON.stringify(state.rateLimitsByModel || {}));
	}
	renderQuotaUsage$1();
}
function clearStoredRateLimits$1() {
	state.rateLimits = null;
	state.rateLimitsByModel = {};
	localStorage.removeItem(STORAGE_RATE_LIMITS);
	localStorage.removeItem(STORAGE_RATE_LIMITS_BY_MODEL);
	renderQuotaUsage$1();
}
function hasRateLimitSnapshot(rateLimits, rateLimitsByModel) {
	if (rateLimits && typeof rateLimits === "object" && hasCurrentRateLimitWindow(rateLimits)) return true;
	if (!rateLimitsByModel || typeof rateLimitsByModel !== "object") return false;
	return Object.values(rateLimitsByModel).some((value) => value && typeof value === "object" && hasCurrentRateLimitWindow(value));
}
function shouldKeepStoredRateLimitsOnEmptyConfig() {
	return isHermesEmbedMode() && hasRateLimitSnapshot(state.rateLimits, state.rateLimitsByModel);
}
function rememberRateLimitsFromConfig(config) {
	if (!config || typeof config !== "object") return;
	if (Object.prototype.hasOwnProperty.call(config, "rateLimits") || Object.prototype.hasOwnProperty.call(config, "rateLimitsByModel")) if (hasRateLimitSnapshot(config.rateLimits || null, config.rateLimitsByModel || null)) rememberRateLimits(config.rateLimits || null, config.rateLimitsByModel || null, { replace: true });
	else if (shouldKeepStoredRateLimitsOnEmptyConfig()) renderQuotaUsage$1();
	else clearStoredRateLimits$1();
}
function rateLimitWindows(rateLimits) {
	return [rateLimits && rateLimits.primary, rateLimits && rateLimits.secondary].filter((windowInfo) => windowInfo && Number.isFinite(Number(windowInfo.usedPercent)));
}
function hasCurrentRateLimitWindow(rateLimits) {
	const nowSeconds = Date.now() / 1e3;
	return rateLimitWindows(rateLimits).some((windowInfo) => {
		const resetsAt = Number(windowInfo.resetsAt || 0);
		return !resetsAt || resetsAt > nowSeconds;
	});
}
function rateLimitWindowForMinutes(rateLimits, targetMinutes) {
	const windows = rateLimitWindows(rateLimits);
	if (!windows.length) return null;
	return windows.find((windowInfo) => Number(windowInfo.windowDurationMins || 0) === targetMinutes) || null;
}
function weeklyRateLimit(rateLimits) {
	return rateLimitWindowForMinutes(rateLimits, 10080);
}
function fiveHourRateLimit(rateLimits) {
	return rateLimitWindowForMinutes(rateLimits, 300);
}
function clampPercent(value) {
	return Math.max(0, Math.min(100, Number(value) || 0));
}
function formatQuotaReset(seconds) {
	if (!seconds) return "";
	const date = /* @__PURE__ */ new Date(Number(seconds) * 1e3);
	if (!Number.isFinite(date.getTime())) return "";
	return date.toLocaleString([], {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit"
	});
}
function formatQuotaResetShort(seconds) {
	if (!seconds) return "--";
	const date = /* @__PURE__ */ new Date(Number(seconds) * 1e3);
	if (!Number.isFinite(date.getTime())) return "--";
	const now = /* @__PURE__ */ new Date();
	const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const resetDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
	const dayOffset = Math.round((resetDayStart - dayStart) / 864e5);
	const time = date.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit"
	});
	if (dayOffset === 0) return time;
	if (dayOffset === 1) return `明天 ${time}`;
	if (dayOffset > 1 && dayOffset < 7) return `${date.toLocaleDateString([], { weekday: "short" })} ${time}`;
	return date.toLocaleString([], {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit"
	});
}
function quotaRemainingText(windowInfo) {
	if (!windowInfo) return "--";
	const remaining = clampPercent(100 - clampPercent(windowInfo.usedPercent));
	return `${Math.round(remaining)}%`;
}
function quotaRiskLevel(windowInfo, nearResetMinutes) {
	if (!windowInfo) return "unknown";
	const remaining = clampPercent(100 - clampPercent(windowInfo.usedPercent));
	let risk = remaining > 50 ? 0 : remaining >= 30 ? 1 : 2;
	const resetMs = Number(windowInfo.resetsAt || 0) * 1e3;
	const minutesToReset = resetMs ? (resetMs - Date.now()) / 6e4 : Infinity;
	if (minutesToReset >= 0 && minutesToReset <= nearResetMinutes) risk = Math.max(0, risk - 1);
	return [
		"ok",
		"warn",
		"danger"
	][risk] || "unknown";
}
function quotaChipHtml(label, windowInfo, nearResetMinutes) {
	const status = quotaRiskLevel(windowInfo, nearResetMinutes);
	const remaining = quotaRemainingText(windowInfo);
	const reset = windowInfo ? formatQuotaResetShort(windowInfo.resetsAt) : "--";
	const compactLabel = label === "5小时" ? "5h" : label.replace("额度", "");
	return `<span class="quota-chip quota-${escapeHtml$1(status)}"><span class="quota-chip-label">${escapeHtml$1(label)}</span><span class="quota-chip-compact-label">${escapeHtml$1(compactLabel)}</span><span class="quota-chip-main"><span class="quota-chip-value">${escapeHtml$1(remaining)}</span><span class="quota-chip-reset"><span class="quota-chip-reset-prefix">重置 </span>${escapeHtml$1(reset)}</span></span></span>`;
}
function quotaInlineHtml() {
	const rateLimits = rateLimitsForQuota();
	const fiveHour = fiveHourRateLimit(rateLimits);
	const weekly = weeklyRateLimit(rateLimits);
	const fiveStatus = quotaRiskLevel(fiveHour, 60);
	const weeklyStatus = quotaRiskLevel(weekly, 1440);
	return `<span class="quota-inline"><span class="quota-inline-part quota-${escapeHtml$1(fiveStatus)}"><span class="quota-inline-label">5h</span> <span class="quota-chip-value">${escapeHtml$1(quotaRemainingText(fiveHour))}</span></span><span class="quota-inline-sep">·</span><span class="quota-inline-part quota-${escapeHtml$1(weeklyStatus)}"><span class="quota-inline-label">周</span> <span class="quota-chip-value">${escapeHtml$1(quotaRemainingText(weekly))}</span></span></span>`;
}
function quotaTitle(label, windowInfo) {
	if (!windowInfo) return `${label} quota remaining unavailable`;
	const used = clampPercent(windowInfo.usedPercent);
	const resetText = formatQuotaReset(windowInfo.resetsAt);
	return [
		`${label} quota remaining: ${quotaRemainingText(windowInfo)}`,
		`used: ${Math.round(used)}%`,
		resetText ? `resets: ${resetText}` : ""
	].filter(Boolean).join("; ");
}
function selectedQuotaModel$1() {
	return selectedComposerModel();
}
function rateLimitsForQuota() {
	const modelKey = normalizeModelKey(selectedQuotaModel$1());
	if (modelKey && state.rateLimitsByModel[modelKey] && hasCurrentRateLimitWindow(state.rateLimitsByModel[modelKey])) return state.rateLimitsByModel[modelKey];
	if (isRateLimitCompatibleWithModel(state.rateLimits, modelKey)) return state.rateLimits;
	if (!modelKey) return null;
	return null;
}
function renderQuotaUsage$1() {
	const el = $("quotaUsage");
	if (!el) return;
	const rateLimits = rateLimitsForQuota();
	const fiveHour = fiveHourRateLimit(rateLimits);
	const weekly = weeklyRateLimit(rateLimits);
	const model = selectedQuotaModel$1();
	el.innerHTML = `<span class="composer-chip-label">额度</span><span class="composer-chip-value">${quotaInlineHtml()}</span>`;
	el.title = [model ? `model: ${labelForModel$1(model)}` : "", `${quotaTitle("5-hour", fiveHour)} | ${quotaTitle("weekly", weekly)}`].filter(Boolean).join("; ");
	el.classList.toggle("unknown", !fiveHour && !weekly);
	el.setAttribute("aria-expanded", state.quotaDetailsOpen ? "true" : "false");
	renderQuotaDetailPanel(fiveHour, weekly, model);
}
function quotaDetailLineHtml(label, windowInfo, nearResetMinutes) {
	const status = quotaRiskLevel(windowInfo, nearResetMinutes);
	const remaining = quotaRemainingText(windowInfo);
	const remainingPercent = clampPercent(100 - (windowInfo ? clampPercent(windowInfo.usedPercent) : 0));
	const reset = windowInfo ? formatQuotaResetShort(windowInfo.resetsAt) : "--";
	return `<div class="quota-detail-line quota-${escapeHtml$1(status)}"><div class="quota-detail-meta"><span>${escapeHtml$1(label)}</span><small>重置 ${escapeHtml$1(reset)}</small></div><div class="quota-detail-track" aria-hidden="true"><span style="width:${escapeHtml$1(String(remainingPercent))}%"></span></div><strong class="quota-detail-value">${escapeHtml$1(remaining)}</strong></div>`;
}
function renderQuotaDetailPanel(fiveHour, weekly, model) {
	const panel = $("quotaDetailPanel");
	if (!panel) return;
	if (!state.quotaDetailsOpen) {
		panel.hidden = true;
		panel.innerHTML = "";
		return;
	}
	panel.hidden = false;
	panel.innerHTML = [
		`<div class="quota-detail-title"><span>额度</span><strong>${escapeHtml$1(model ? labelForModel$1(model) : "当前模型")}</strong></div>`,
		quotaDetailLineHtml("5小时额度", fiveHour, 60),
		quotaDetailLineHtml("周额度", weekly, 1440)
	].join("");
}
function quotaShortTextFromSnapshot(quota) {
	const rateLimits = quota && quota.rateLimits || null;
	const fiveHour = fiveHourRateLimit(rateLimits);
	const weekly = weeklyRateLimit(rateLimits);
	return `5h ${quotaRemainingText(fiveHour)} / week ${quotaRemainingText(weekly)}`;
}
function rememberCodexProfiles(value) {
	const profiles = value && Array.isArray(value.profiles) ? value.profiles : [];
	state.codexProfiles = profiles;
	state.activeCodexProfileId = String(value && value.activeProfileId || "");
	state.codexProfileSwitchSupported = value ? value.switchSupported !== false : false;
	finishRestartingUiIfReady();
	renderCodexProfileSettings$1();
}
function codexProfileAccountLabel(profile) {
	const displayName = String(profile && (profile.accountName || profile.displayName || profile.accountLabel) || "").trim();
	if (displayName) return displayName;
	const auth = profile && profile.auth || {};
	if (auth.status === "loggedIn") return auth.email || auth.name || auth.label || auth.accountId || "Logged in";
	if (auth.status === "error") return "Auth unreadable";
	return "Not logged in";
}
function codexProfileStatusLabel(profile) {
	const explicit = String(profile && profile.authStatusLabel || "").trim();
	if (explicit) return explicit;
	const auth = profile && profile.auth || {};
	if (auth.status === "loggedIn") return "Signed in";
	if (auth.status === "error") return "Auth unreadable";
	return "Not logged in";
}
function renderCodexProfileSettings$1() {
	const el = $("codexProfileSettings");
	if (!el) return;
	const profiles = Array.isArray(state.codexProfiles) ? state.codexProfiles : [];
	if (!profiles.length) {
		el.innerHTML = "<div class=\"codex-profile-empty\">No Codex profiles found</div>";
		return;
	}
	el.innerHTML = profiles.map((profile) => {
		const id = String(profile.id || "");
		const active = Boolean(profile.active) || id === state.activeCodexProfileId;
		const switchingThisProfile = state.codexProfileSwitchBusy && state.codexProfileSwitchTargetId === id;
		const showingSwitchProgress = state.codexProfileSwitchTargetId === id && Boolean(state.codexProfileSwitchStage);
		const loggedIn = profile.auth && profile.auth.status === "loggedIn";
		const disabled = active || state.codexProfileSwitchBusy || state.codexProfileRestarting || !state.codexProfileSwitchSupported || !loggedIn;
		const accountLabel = codexProfileAccountLabel(profile);
		const action = switchingThisProfile ? state.codexProfileSwitchStage || "预检中..." : active ? "Active" : "Switch";
		const title = !state.codexProfileSwitchSupported ? "Profile switching is disabled for this app-server configuration" : !loggedIn ? "Login to this Codex home before switching" : switchingThisProfile ? "Checking target account before switching" : showingSwitchProgress ? "Last profile switch status" : active ? "Current active profile" : "Switch all workspaces to this profile";
		const status = showingSwitchProgress ? `<small class="codex-profile-progress">${escapeHtml$1(state.codexProfileSwitchStage || "正在预检目标账号...")}</small>` : "";
		return `<div class="codex-profile-row${active ? " active" : ""}"><div class="codex-profile-main"><strong>${escapeHtml$1(accountLabel)}</strong><span>${escapeHtml$1(codexProfileStatusLabel(profile))}</span><small>${escapeHtml$1(profile.codexHome || "")}</small>` + status + `</div><div class="codex-profile-side"><span class="codex-profile-quota">${escapeHtml$1(quotaShortTextFromSnapshot(profile.quota))}</span><button type="button" data-codex-profile-id="${escapeHtml$1(id)}" ${disabled ? "disabled" : ""} title="${escapeHtml$1(title)}">${escapeHtml$1(action)}</button></div></div>`;
	}).join("");
}
async function loadCodexProfiles() {
	const profiles = await api("/api/codex-profiles", { timeoutMs: 12e3 });
	rememberCodexProfiles(profiles);
	return profiles;
}
function normalizeWorkspaceDelegationConfig(value) {
	const input = value && typeof value === "object" ? value : {};
	return {
		enabled: Boolean(input.enabled),
		mode: String(input.mode || (input.enabled ? "model_driven_explicit_task_card" : "off")),
		directTaskCardAutoApproval: Boolean(input.directTaskCardAutoApproval),
		ordinarySendPreflight: Boolean(input.ordinarySendPreflight),
		localHeuristics: Boolean(input.localHeuristics),
		source: String(input.source || "default"),
		updatedAt: String(input.updatedAt || "")
	};
}
function rememberWorkspaceDelegationConfig(value) {
	state.workspaceDelegation = normalizeWorkspaceDelegationConfig(value);
	renderWorkspaceDelegationSettings();
}
function workspaceDelegationSourceLabel(source) {
	if (source === "runtime") return "手动设置";
	if (source === "environment") return "环境变量默认";
	return "默认关闭";
}
function renderWorkspaceDelegationSettings() {
	const el = $("workspaceDelegationSettings");
	if (!el) return;
	const config = normalizeWorkspaceDelegationConfig(state.workspaceDelegation);
	const enabled = Boolean(config.enabled);
	const busy = Boolean(state.workspaceDelegationBusy);
	el.innerHTML = `<div class="workspace-delegation-row${enabled ? " enabled" : ""}"><div class="workspace-delegation-main"><strong>${enabled ? "已开启" : "已关闭"}</strong><span>${escapeHtml$1(enabled ? "模型/工具显式发卡可直批到目标线程" : "模型/工具显式发卡会保留为 pending，目标线程需要审批")}</span><small>${escapeHtml$1(workspaceDelegationSourceLabel(config.source))} · 本地预检关闭</small></div><div class="workspace-delegation-side"><button type="button" data-workspace-delegation-toggle ${busy ? "disabled" : ""}>${busy ? "保存中" : enabled ? "关闭" : "开启"}</button></div></div>`;
}
async function handleWorkspaceDelegationSettingsClick(event) {
	const button = event.target.closest("[data-workspace-delegation-toggle]");
	if (!button || button.disabled || state.workspaceDelegationBusy) return;
	const nextEnabled = !Boolean(state.workspaceDelegation && state.workspaceDelegation.enabled);
	state.workspaceDelegationBusy = true;
	$("connectionState").textContent = nextEnabled ? "正在开启跨工作区委派..." : "正在关闭跨工作区委派...";
	renderWorkspaceDelegationSettings();
	try {
		const result = await api("/api/settings/workspace-delegation", {
			method: "POST",
			body: JSON.stringify({ enabled: nextEnabled }),
			timeoutMs: 12e3
		});
		rememberWorkspaceDelegationConfig(result && result.workspaceDelegation || null);
		$("connectionState").textContent = nextEnabled ? "跨工作区委派已开启" : "跨工作区委派已关闭";
	} catch (err) {
		showError(err);
		$("connectionState").textContent = err.message || "跨工作区委派设置失败";
		renderWorkspaceDelegationSettings();
	} finally {
		state.workspaceDelegationBusy = false;
		renderWorkspaceDelegationSettings();
	}
}
function normalizeRemoteManagedWorkspaceList(value) {
	if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
	return String(value || "").split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}
function normalizeRemoteManagedWorkspaceConfig(value) {
	const input = value && typeof value === "object" ? value : {};
	return {
		enabled: Boolean(input.enabled),
		workspaceKind: String(input.workspaceKind || "remote_managed_workspace"),
		workspaceId: String(input.workspaceId || ""),
		nodeName: String(input.nodeName || ""),
		centralUrl: String(input.centralUrl || ""),
		projectRoot: String(input.projectRoot || ""),
		allowedRoot: String(input.allowedRoot || ""),
		projectType: String(input.projectType || "vite_game"),
		connectionMode: String(input.connectionMode || "persistent"),
		effectiveConnectionMode: String(input.effectiveConnectionMode || "http_polling"),
		persistentSession: String(input.persistentSession || ""),
		fallbackReason: String(input.fallbackReason || ""),
		enrollmentTokenConfigured: Boolean(input.enrollmentTokenConfigured),
		enrollmentTokenRef: String(input.enrollmentTokenRef || ""),
		enrollmentTokenPreview: String(input.enrollmentTokenPreview || ""),
		connectionStatus: String(input.connectionStatus || "disconnected"),
		lastHeartbeatAt: String(input.lastHeartbeatAt || ""),
		lastPollAt: String(input.lastPollAt || ""),
		activeTaskCardId: String(input.activeTaskCardId || ""),
		activeLocalThreadId: String(input.activeLocalThreadId || ""),
		activeLocalTurnId: String(input.activeLocalTurnId || ""),
		activeTaskCardStartedAt: String(input.activeTaskCardStartedAt || ""),
		lastTaskCardId: String(input.lastTaskCardId || ""),
		lastLocalThreadId: String(input.lastLocalThreadId || ""),
		lastLocalTurnId: String(input.lastLocalTurnId || ""),
		lastReturnStatus: String(input.lastReturnStatus || ""),
		lastExecutionBridgeStatus: String(input.lastExecutionBridgeStatus || ""),
		lastRegisterAt: String(input.lastRegisterAt || ""),
		lastConnectionCheckAt: String(input.lastConnectionCheckAt || ""),
		queuedTerminalReturnCount: Number(input.queuedTerminalReturnCount || 0) || 0,
		roles: normalizeRemoteManagedWorkspaceList(input.roles),
		capabilities: normalizeRemoteManagedWorkspaceList(input.capabilities),
		issueCodes: normalizeRemoteManagedWorkspaceList(input.issueCodes),
		source: String(input.source || "default"),
		updatedAt: String(input.updatedAt || "")
	};
}
function rememberRemoteManagedWorkspaceConfig(value) {
	state.remoteManagedWorkspace = normalizeRemoteManagedWorkspaceConfig(value);
	renderRemoteManagedWorkspaceSettings();
}
function remoteManagedWorkspaceStatusLabel(status) {
	switch (String(status || "")) {
		case "connected": return "connected";
		case "connecting": return "connecting";
		case "stale": return "stale";
		case "auth_failed": return "auth failed";
		case "config_invalid": return "config invalid";
		case "offline": return "offline";
		default: return "disconnected";
	}
}
function remoteManagedWorkspacePathKey(value) {
	return String(value || "").replace(/[\\/]+$/, "").toLowerCase();
}
function remoteManagedWorkspaceBaseName(value) {
	const text = String(value || "").replace(/[\\/]+$/, "");
	const parts = text.split(/[\\/]+/).filter(Boolean);
	return parts.length ? parts[parts.length - 1] : text;
}
function remoteManagedWorkspaceFieldHtml(label, name, value, options = {}) {
	const type = options.type || "text";
	const placeholder = options.placeholder || "";
	return `<label class="remote-managed-workspace-field"><span>${escapeHtml$1(label)}</span><input type="${escapeHtml$1(type)}" data-rmw-field="${escapeHtml$1(name)}" value="${escapeHtml$1(value || "")}" placeholder="${escapeHtml$1(placeholder)}" autocomplete="off"></label>`;
}
function remoteManagedWorkspaceReadonlyField(label, value) {
	return `<div class="remote-managed-workspace-diagnostic"><span>${escapeHtml$1(label)}</span><strong>${escapeHtml$1(value || "--")}</strong></div>`;
}
function remoteManagedWorkspaceRowStatus(config, workspace) {
	const cwd = String(workspace && workspace.cwd || "");
	if (!cwd) return {
		label: "Invalid path",
		className: "invalid"
	};
	if (!Boolean(config.enabled && remoteManagedWorkspacePathKey(config.projectRoot) === remoteManagedWorkspacePathKey(cwd))) return {
		label: "Local",
		className: "local"
	};
	if (!config.enrollmentTokenConfigured) return {
		label: "Auth required",
		className: "auth"
	};
	const status = remoteManagedWorkspaceStatusLabel(config.connectionStatus);
	if (status === "connected") return {
		label: "Connected",
		className: "connected"
	};
	if (status === "connecting") return {
		label: "Connecting",
		className: "connecting"
	};
	if (status === "offline") return {
		label: "Offline",
		className: "offline"
	};
	if (status === "stale") return {
		label: "Remote managed",
		className: "stale"
	};
	if (status === "auth failed") return {
		label: "Auth required",
		className: "auth"
	};
	if (status === "config invalid") return {
		label: "Invalid path",
		className: "invalid"
	};
	return {
		label: "Remote managed",
		className: "remote"
	};
}
function remoteManagedWorkspaceRowsHtml(config, busy) {
	const workspaces = Array.isArray(state.workspaces) ? state.workspaces.slice(0, 24) : [];
	if (!workspaces.length) return `<div class="remote-managed-workspace-empty">No local workspaces.</div>`;
	return workspaces.map((workspace) => {
		const cwd = String(workspace && workspace.cwd || "");
		const label = String(workspace && workspace.label || remoteManagedWorkspaceBaseName(cwd) || "Workspace");
		const source = String(workspace && workspace.source || "local");
		const active = Boolean(config.enabled && remoteManagedWorkspacePathKey(config.projectRoot) === remoteManagedWorkspacePathKey(cwd));
		const status = remoteManagedWorkspaceRowStatus(config, workspace);
		const mainAction = active ? "disable-workspace" : "enable-workspace";
		const mainLabel = active ? "Disable" : "远程受控";
		return `<article class="remote-managed-workspace-item ${escapeHtml$1(status.className)}${active ? " active" : ""}"><div class="remote-managed-workspace-item-main"><strong>${escapeHtml$1(label)}</strong><span>${escapeHtml$1(cwd)}</span><small>${escapeHtml$1(status.label)} · ${escapeHtml$1(source)}</small></div><div class="remote-managed-workspace-item-actions"><button type="button" data-rmw-action="${escapeHtml$1(mainAction)}" data-rmw-workspace-cwd="${escapeHtml$1(cwd)}" ${busy || !cwd ? "disabled" : ""}>${escapeHtml$1(mainLabel)}</button><button type="button" data-rmw-action="test-connection" data-rmw-workspace-cwd="${escapeHtml$1(cwd)}" ${busy || !active ? "disabled" : ""}>Test</button></div></article>`;
	}).join("");
}
function remoteManagedWorkspaceAdvancedHtml(config) {
	const issueText = config.issueCodes.length ? config.issueCodes.slice(0, 8).join(", ") : "";
	return "<details class=\"remote-managed-workspace-advanced\"><summary>Advanced / Diagnostics</summary><div class=\"remote-managed-workspace-advanced-grid\">" + remoteManagedWorkspaceReadonlyField("workspace kind", config.workspaceKind) + remoteManagedWorkspaceReadonlyField("workspace id", config.workspaceId) + remoteManagedWorkspaceReadonlyField("node name", config.nodeName) + remoteManagedWorkspaceReadonlyField("project root", config.projectRoot) + remoteManagedWorkspaceReadonlyField("allowed root", config.allowedRoot) + remoteManagedWorkspaceReadonlyField("project type", config.projectType) + remoteManagedWorkspaceReadonlyField("connection", `${config.connectionMode} -> ${config.effectiveConnectionMode}`) + remoteManagedWorkspaceReadonlyField("token", config.enrollmentTokenConfigured ? config.enrollmentTokenRef || config.enrollmentTokenPreview || "configured" : "not configured") + remoteManagedWorkspaceReadonlyField("roles", config.roles.join(", ")) + remoteManagedWorkspaceReadonlyField("capabilities", config.capabilities.join(", ")) + remoteManagedWorkspaceReadonlyField("heartbeat", config.lastHeartbeatAt) + remoteManagedWorkspaceReadonlyField("poll", config.lastPollAt) + remoteManagedWorkspaceReadonlyField("task", config.lastTaskCardId) + remoteManagedWorkspaceReadonlyField("return", config.lastReturnStatus) + remoteManagedWorkspaceReadonlyField("queued returns", String(config.queuedTerminalReturnCount || 0)) + remoteManagedWorkspaceReadonlyField("issues", issueText) + "</div><div class=\"remote-managed-workspace-token-entry\">" + remoteManagedWorkspaceFieldHtml("Enrollment token", "enrollmentToken", "", {
		type: "password",
		placeholder: config.enrollmentTokenConfigured ? "configured" : "write-only"
	}) + `<button type="button" data-rmw-action="save" ${state.remoteManagedWorkspaceBusy ? "disabled" : ""}>Save secure entry</button></div></details>`;
}
function refreshRemoteManagedWorkspaceRows() {
	if (state.remoteManagedWorkspaceWorkspaceLoadInFlight) return;
	state.remoteManagedWorkspaceWorkspaceLoadInFlight = true;
	api("/api/workspaces", { timeoutMs: 12e3 }).then((workspaceResult) => {
		if (workspaceResult && Array.isArray(workspaceResult.data)) {
			state.workspaces = workspaceResult.data;
			renderRemoteManagedWorkspaceSettings();
		}
	}).catch(() => {}).finally(() => {
		state.remoteManagedWorkspaceWorkspaceLoadInFlight = false;
		state.remoteManagedWorkspaceWorkspaceLoadAttempted = true;
	});
}
function renderRemoteManagedWorkspaceSettings() {
	const el = $("remoteManagedWorkspaceSettings");
	if (!el) return;
	if (!(state.workspaces || []).length && !state.remoteManagedWorkspaceWorkspaceLoadAttempted) refreshRemoteManagedWorkspaceRows();
	const config = normalizeRemoteManagedWorkspaceConfig(state.remoteManagedWorkspace);
	const busy = Boolean(state.remoteManagedWorkspaceBusy);
	const status = remoteManagedWorkspaceStatusLabel(config.connectionStatus);
	const issueText = config.issueCodes.length ? ` · ${config.issueCodes.slice(0, 3).join(", ")}` : "";
	el.innerHTML = `<div class="remote-managed-workspace-row${config.enabled ? " enabled" : ""}"><div class="remote-managed-workspace-main"><strong>${escapeHtml$1(config.enabled ? "已开启" : "已关闭")} · ${escapeHtml$1(status)}</strong><span>${escapeHtml$1(config.centralUrl || "Central server not set")}</span><small>${escapeHtml$1(config.effectiveConnectionMode || "http_polling")} fallback active${escapeHtml$1(issueText)}</small></div><div class="remote-managed-workspace-side"><button type="button" data-rmw-action="poll-once" ${busy || !config.enabled ? "disabled" : ""}>Poll</button></div></div><div class="remote-managed-workspace-simple-form">` + remoteManagedWorkspaceFieldHtml("中央服务器地址", "centralUrl", config.centralUrl, { placeholder: "https://home-ai.example" }) + `<div class="remote-managed-workspace-actions"><button type="button" data-rmw-action="save-central" ${busy ? "disabled" : ""}>${busy ? "保存中" : "保存"}</button><button type="button" data-rmw-action="register" ${busy || !config.enabled ? "disabled" : ""}>Register</button></div></div><div class="remote-managed-workspace-workspaces"><div class="remote-managed-workspace-list-title"><strong>Workspaces</strong><span>${escapeHtml$1(String((state.workspaces || []).length || 0))}</span></div>` + remoteManagedWorkspaceRowsHtml(config, busy) + `</div>` + remoteManagedWorkspaceAdvancedHtml(config);
}
function remoteManagedWorkspaceFormPayload() {
	const el = $("remoteManagedWorkspaceSettings");
	if (!el) return {};
	const payload = { enabled: Boolean(state.remoteManagedWorkspace && state.remoteManagedWorkspace.enabled) };
	el.querySelectorAll("[data-rmw-field]").forEach((field) => {
		const name = field.getAttribute("data-rmw-field");
		if (!name) return;
		if (name === "enrollmentToken" && !String(field.value || "").trim()) return;
		payload[name] = String(field.value || "").trim();
	});
	return payload;
}
function remoteManagedWorkspaceConfigFromResult(result) {
	return result && (result.remoteManagedWorkspace || result.status || result.remoteManagedWorkspaceStatus) || null;
}
function remoteManagedWorkspaceComparableCentralUrl(value) {
	const raw = String(value || "").trim();
	if (!raw) return "";
	try {
		const url = new URL(raw);
		url.hash = "";
		return url.toString().replace(/\/+$/, "");
	} catch (_) {
		return raw.replace(/\/+$/, "");
	}
}
async function loadRemoteManagedWorkspaceSettings() {
	const result = await api("/api/settings/remote-managed-workspace", { timeoutMs: 12e3 });
	try {
		const workspaceResult = await api("/api/workspaces", { timeoutMs: 12e3 });
		if (workspaceResult && Array.isArray(workspaceResult.data)) state.workspaces = workspaceResult.data;
	} catch (_) {}
	rememberRemoteManagedWorkspaceConfig(remoteManagedWorkspaceConfigFromResult(result));
	return result;
}
async function handleRemoteManagedWorkspaceSettingsClick(event) {
	const button = event.target.closest("[data-rmw-action]");
	if (!button || button.disabled || state.remoteManagedWorkspaceBusy) return;
	const action = button.getAttribute("data-rmw-action") || "";
	const workspaceCwd = button.getAttribute("data-rmw-workspace-cwd") || "";
	const workspace = workspaceCwd ? (state.workspaces || []).find((item) => remoteManagedWorkspacePathKey(item && item.cwd) === remoteManagedWorkspacePathKey(workspaceCwd)) || { cwd: workspaceCwd } : null;
	const formPayload = remoteManagedWorkspaceFormPayload();
	const expectedCentralUrl = remoteManagedWorkspaceComparableCentralUrl(formPayload.centralUrl);
	if ((action === "save-central" || action === "enable-workspace") && !expectedCentralUrl) {
		const error = /* @__PURE__ */ new Error("中央服务器地址不能为空");
		showError(error);
		$("connectionState").textContent = error.message;
		return;
	}
	const endpoint = action === "save" || action === "save-central" ? "/api/settings/remote-managed-workspace" : action === "enable-workspace" || action === "disable-workspace" ? "/api/settings/remote-managed-workspace/workspace" : action === "test-connection" ? "/api/settings/remote-managed-workspace/test-connection" : action === "register" ? "/api/settings/remote-managed-workspace/register" : action === "poll-once" ? "/api/settings/remote-managed-workspace/poll-once" : "";
	if (!endpoint) return;
	state.remoteManagedWorkspaceBusy = true;
	renderRemoteManagedWorkspaceSettings();
	try {
		let body = "{}";
		if (action === "save" || action === "save-central") body = JSON.stringify(formPayload);
		else if (action === "enable-workspace" || action === "disable-workspace") body = JSON.stringify({
			action: action === "disable-workspace" ? "disable" : "enable",
			centralUrl: formPayload.centralUrl,
			enrollmentToken: formPayload.enrollmentToken,
			workspace
		});
		let config = remoteManagedWorkspaceConfigFromResult(await api(endpoint, {
			method: "POST",
			body,
			timeoutMs: 2e4
		}));
		rememberRemoteManagedWorkspaceConfig(config);
		if (action === "save" || action === "save-central" || action === "enable-workspace" || action === "disable-workspace") config = remoteManagedWorkspaceConfigFromResult(await loadRemoteManagedWorkspaceSettings()) || config;
		if (action === "save-central") {
			if (remoteManagedWorkspaceComparableCentralUrl(config && config.centralUrl) !== expectedCentralUrl) throw new Error("Remote Managed Workspace 保存读回失败");
		}
		$("connectionState").textContent = "Remote Managed Workspace 已保存";
	} catch (err) {
		showError(err);
		$("connectionState").textContent = err.message || "Remote Managed Workspace 设置失败";
		try {
			await loadRemoteManagedWorkspaceSettings();
		} catch (_) {
			renderRemoteManagedWorkspaceSettings();
		}
	} finally {
		state.remoteManagedWorkspaceBusy = false;
		renderRemoteManagedWorkspaceSettings();
	}
}
async function handleCodexProfileSettingsClick(event) {
	const button = event.target.closest("[data-codex-profile-id]");
	if (!button || button.disabled) return;
	const profileId = button.getAttribute("data-codex-profile-id") || "";
	if (!profileId || state.codexProfileSwitchBusy || state.codexProfileRestarting) return;
	const profile = state.codexProfiles.find((item) => String(item.id || "") === profileId);
	const label = profile ? codexProfileAccountLabel(profile) : profileId;
	if (!await requestCodexProfileSwitchConfirmation(profileId, label)) return;
	await performCodexProfileSwitch(profileId);
}
function appVersionText(...args) {
	return requireAppUpdateRuntime().appVersionText(...args);
}
function clientBuildVersionText(...args) {
	return requireAppUpdateRuntime().clientBuildVersionText(...args);
}
function renderAppUpdateStatus(...args) {
	return requireAppUpdateRuntime().renderAppUpdateStatus(...args);
}
async function refreshAppUpdateStatus(...args) {
	return requireAppUpdateRuntime().refreshAppUpdateStatus(...args);
}
function currentUpdateUsesPublicRelease(...args) {
	return requireAppUpdateRuntime().currentUpdateUsesPublicRelease(...args);
}
function updateStatusLine(...args) {
	return requireAppUpdateRuntime().updateStatusLine(...args);
}
function publicReleaseStatusLine(...args) {
	return requireAppUpdateRuntime().publicReleaseStatusLine(...args);
}
function updateActionButton(...args) {
	return requireAppUpdateRuntime().updateActionButton(...args);
}
function publicPrHasOpenPullRequests(...args) {
	return requireAppUpdateRuntime().publicPrHasOpenPullRequests(...args);
}
function renderUpdatePanel(...args) {
	return requireAppUpdateRuntime().renderUpdatePanel(...args);
}
async function refreshPublicReleaseStatus(...args) {
	return requireAppUpdateRuntime().refreshPublicReleaseStatus(...args);
}
function openUpdatePanel(...args) {
	return requireAppUpdateRuntime().openUpdatePanel(...args);
}
function closeUpdatePanel(...args) {
	return requireAppUpdateRuntime().closeUpdatePanel(...args);
}
function handleUpdatePanelClick(...args) {
	return requireAppUpdateRuntime().handleUpdatePanelClick(...args);
}
function scheduleStartupUpdateCheck(...args) {
	return requireAppUpdateRuntime().scheduleStartupUpdateCheck(...args);
}
function publicPrPromptKey(...args) {
	return requireAppUpdateRuntime().publicPrPromptKey(...args);
}
function publicPrSummaryText(...args) {
	return requireAppUpdateRuntime().publicPrSummaryText(...args);
}
function normalizedPublicPrReviewTitle(...args) {
	return requireAppUpdateRuntime().normalizedPublicPrReviewTitle(...args);
}
function publicPrReviewThreadTitle(...args) {
	return requireAppUpdateRuntime().publicPrReviewThreadTitle(...args);
}
function findPublicPrReviewThread(...args) {
	return requireAppUpdateRuntime().findPublicPrReviewThread(...args);
}
function workspacePathBaseName(...args) {
	return requireAppUpdateRuntime().workspacePathBaseName(...args);
}
function workspacePathIsVisible(...args) {
	return requireAppUpdateRuntime().workspacePathIsVisible(...args);
}
function visibleWorkspaceWithBaseName(...args) {
	return requireAppUpdateRuntime().visibleWorkspaceWithBaseName(...args);
}
function publicPrReviewWorkspacePath(...args) {
	return requireAppUpdateRuntime().publicPrReviewWorkspacePath(...args);
}
async function openPublicPrReviewThreadIfAvailable(...args) {
	return requireAppUpdateRuntime().openPublicPrReviewThreadIfAvailable(...args);
}
function renderPublicPrStatus(...args) {
	return requireAppUpdateRuntime().renderPublicPrStatus(...args);
}
async function refreshPublicPrStatus(...args) {
	return requireAppUpdateRuntime().refreshPublicPrStatus(...args);
}
function scheduleStartupPublicPrCheck(...args) {
	return requireAppUpdateRuntime().scheduleStartupPublicPrCheck(...args);
}
function publicPrMergeInstruction(...args) {
	return requireAppUpdateRuntime().publicPrMergeInstruction(...args);
}
function publicPrMergeConfirmationMessage(...args) {
	return requireAppUpdateRuntime().publicPrMergeConfirmationMessage(...args);
}
async function preparePublicPrMergePrompt(...args) {
	return requireAppUpdateRuntime().preparePublicPrMergePrompt(...args);
}
function rememberPublicPrPrompt(...args) {
	return requireAppUpdateRuntime().rememberPublicPrPrompt(...args);
}
function maybePromptPublicPrMerge(...args) {
	return requireAppUpdateRuntime().maybePromptPublicPrMerge(...args);
}
async function handlePublicPrStatusClick(...args) {
	return requireAppUpdateRuntime().handlePublicPrStatusClick(...args);
}
async function handleAppUpdateClick(...args) {
	return requireAppUpdateRuntime().handleAppUpdateClick(...args);
}
function renderSharedRestartButton(...args) {
	return requireAppUpdateRuntime().renderSharedRestartButton(...args);
}
function renderHardRefreshButton(...args) {
	return requireAppUpdateRuntime().renderHardRefreshButton(...args);
}
function markBootReady(...args) {
	return requireAppUpdateRuntime().markBootReady(...args);
}
function reportShellLoaded(...args) {
	return requireAppUpdateRuntime().reportShellLoaded(...args);
}
function sharedRestartScopeLines(...args) {
	return requireAppUpdateRuntime().sharedRestartScopeLines(...args);
}
function restartRiskThreads(...args) {
	return requireAppUpdateRuntime().restartRiskThreads(...args);
}
async function fetchRestartRiskThreads(...args) {
	return requireAppUpdateRuntime().fetchRestartRiskThreads(...args);
}
function restartRiskThreadTitle(...args) {
	return requireAppUpdateRuntime().restartRiskThreadTitle(...args);
}
function restartRiskThreadMeta(...args) {
	return requireAppUpdateRuntime().restartRiskThreadMeta(...args);
}
function renderSharedRestartDialog(...args) {
	return requireAppUpdateRuntime().renderSharedRestartDialog(...args);
}
function closeSharedRestartDialog(...args) {
	return requireAppUpdateRuntime().closeSharedRestartDialog(...args);
}
function requestSharedRestartConfirmation(...args) {
	return requireAppUpdateRuntime().requestSharedRestartConfirmation(...args);
}
async function handleSharedRestartClick(...args) {
	return requireAppUpdateRuntime().handleSharedRestartClick(...args);
}
function serverBuildIdFromConfig(...args) {
	return requireAppUpdateRuntime().serverBuildIdFromConfig(...args);
}
function shouldPromptForServerBuildChange(...args) {
	return requireAppUpdateRuntime().shouldPromptForServerBuildChange(...args);
}
function clearSettledServerBuildPluginRefreshAfterThreadEntry(...args) {
	return requireAppUpdateRuntime().clearSettledServerBuildPluginRefreshAfterThreadEntry(...args);
}
function pageShellAssetUrl(...args) {
	return requireAppUpdateRuntime().pageShellAssetUrl(...args);
}
function validatePageShellAsset(...args) {
	return requireAppUpdateRuntime().validatePageShellAsset(...args);
}
async function fetchPageShellAsset(...args) {
	return requireAppUpdateRuntime().fetchPageShellAsset(...args);
}
async function preparePageShellAssets(...args) {
	return requireAppUpdateRuntime().preparePageShellAssets(...args);
}
async function fetchPageBuildConfig(...args) {
	return requireAppUpdateRuntime().fetchPageBuildConfig(...args);
}
async function pruneOldShellCaches(...args) {
	return requireAppUpdateRuntime().pruneOldShellCaches(...args);
}
async function clearAllShellCaches(...args) {
	return requireAppUpdateRuntime().clearAllShellCaches(...args);
}
async function resetPageShellServiceWorker(...args) {
	return requireAppUpdateRuntime().resetPageShellServiceWorker(...args);
}
function pageReloadUrlWithBust(...args) {
	return requireAppUpdateRuntime().pageReloadUrlWithBust(...args);
}
function initializePageBuildState(...args) {
	return requireAppUpdateRuntime().initializePageBuildState(...args);
}
function renderPageRefreshPrompt(...args) {
	return requireAppUpdateRuntime().renderPageRefreshPrompt(...args);
}
async function handleHardRefreshClick(...args) {
	return requireAppUpdateRuntime().handleHardRefreshClick(...args);
}
function showReconnectRefreshPrompt$1(...args) {
	return requireAppUpdateRuntime().showReconnectRefreshPrompt(...args);
}
function finishRestartingUiIfReady(...args) {
	return requireAppUpdateRuntime().finishRestartingUiIfReady(...args);
}
function clearReconnectRefreshPrompt(...args) {
	return requireAppUpdateRuntime().clearReconnectRefreshPrompt(...args);
}
async function checkPageRefreshAvailability(...args) {
	return requireAppUpdateRuntime().checkPageRefreshAvailability(...args);
}
function schedulePageRefreshCheck(...args) {
	return requireAppUpdateRuntime().schedulePageRefreshCheck(...args);
}
function scheduleVisiblePageRefreshCheck$1(...args) {
	return requireAppUpdateRuntime().scheduleVisiblePageRefreshCheck(...args);
}
function startPageRefreshChecks(...args) {
	return requireAppUpdateRuntime().startPageRefreshChecks(...args);
}
async function waitForPageBuildConfig(...args) {
	return requireAppUpdateRuntime().waitForPageBuildConfig(...args);
}
async function refreshPageForNewBuild(...args) {
	return requireAppUpdateRuntime().refreshPageForNewBuild(...args);
}
function createSettingsRuntime() {
	return {
		renderFontSizeControl: typeof renderFontSizeControl === "function" ? renderFontSizeControl : null,
		renderQuotaUsage: typeof renderQuotaUsage$1 === "function" ? renderQuotaUsage$1 : null,
		renderCodexProfileSettings: typeof renderCodexProfileSettings$1 === "function" ? renderCodexProfileSettings$1 : null,
		renderWorkspaceDelegationSettings: typeof renderWorkspaceDelegationSettings === "function" ? renderWorkspaceDelegationSettings : null,
		renderRemoteManagedWorkspaceSettings: typeof renderRemoteManagedWorkspaceSettings === "function" ? renderRemoteManagedWorkspaceSettings : null,
		rememberRateLimitsFromConfig: typeof rememberRateLimitsFromConfig === "function" ? rememberRateLimitsFromConfig : null,
		rememberCodexProfiles: typeof rememberCodexProfiles === "function" ? rememberCodexProfiles : null
	};
}
var root$3 = typeof globalThis !== "undefined" ? globalThis : window;
var settingsRuntimeApi = Object.freeze({ createSettingsRuntime });
Object.assign(root$3, {
	sleep,
	loadJsonStorage: loadJsonStorage$1,
	loadStringSetStorage,
	loadNumberMapStorage,
	saveNumberMapStorage,
	saveStringSetStorage,
	normalizeRestartAutoRecoverThread: normalizeRestartAutoRecoverThread$1,
	loadRestartAutoRecoverThreads,
	saveRestartAutoRecoverThreads,
	clearRestartAutoRecoverThreads: clearRestartAutoRecoverThreads$1,
	initializeRestartAutoRecoverThreads,
	saveThreadTaskCardDraftStates,
	normalizeFontSizeValue,
	normalizeThemeValue,
	normalizePluginFontSizeValue,
	storedFontSizePreference,
	normalizePluginAppearance,
	applyPluginAppearancePreference,
	currentPluginAppearanceForHost,
	syncPluginAppearanceStateFromPreferences,
	applyFontSizePreference,
	renderFontSizeControl,
	setFontSizePreference,
	handleFontSizeChoice,
	isMenuOverlayMode: isMenuOverlayMode$1,
	viewportState: viewportState$1,
	viewportHeight,
	setStableRootPixelVar,
	isKeyboardEditableElement: isKeyboardEditableElement$1,
	isHermesKeyboardInputActive,
	resetMobileKeyboardWindowScroll,
	updateViewportVars,
	createSubmissionId: createSubmissionId$1,
	pruneRecentSubmittedUserMessages,
	registerSubmittedUserMessage,
	localSubmittedTurnId,
	currentThreadHasClientSubmission,
	threadHasClientSubmission,
	mutableThreadForLocalSubmission,
	syncLocalSubmissionThread,
	insertLocalSubmittedUserMessage: insertLocalSubmittedUserMessage$1,
	mergeSubmittedUserItemIntoTurn,
	markRecentSubmittedUserMessageAccepted,
	durableUserMessageMatchesSubmittedRecord,
	threadHasDurableSubmittedUserRecord,
	optimisticUserMessageMatchesSubmittedRecord,
	removeOptimisticSubmittedUserRecordEchoes,
	settleRecentSubmittedUserMessagesForThread,
	reconcileSubmittedUserMessageTurn: reconcileSubmittedUserMessageTurn$1,
	markSubmittedUserMessageFailed: markSubmittedUserMessageFailed$1,
	recentSubmittedUserRecordBelongsToThread,
	isRecentlySubmittedUserMessage: isRecentlySubmittedUserMessage$1,
	base64UrlToUint8Array,
	pushSubscriptionToJson,
	pushBrowserAvailable,
	escapeHtml: escapeHtml$1,
	escapeSelectorAttr,
	resetCopyTextStore,
	rememberCopyText,
	copyButtonHtml,
	fallbackCopyText,
	copyTextToClipboard,
	showCopyFeedback,
	handleCopyButtonClick,
	truncateMiddle: truncateMiddle$1,
	compactLiveText,
	appendCommandOutput,
	shortPath: shortPath$1,
	formatAbsoluteTime: formatAbsoluteTime$1,
	formatTime: formatTime$1,
	sameLocalDate,
	formatCardTimestamp,
	formatElapsedTime: formatElapsedTime$1,
	statusText: statusText$1,
	isStaleActiveStatus: isStaleActiveStatus$1,
	saveThreadStatusHints,
	isRecoverableThreadDisplayTitle,
	preferredThreadDisplayTitle,
	threadDisplayName: threadDisplayName$1,
	isPwaMode,
	triggerCompletionHaptic,
	supportsCompletionHaptic,
	completionAudioContext,
	playCompletionTone,
	primeCompletionAudio,
	showCompletionAlert,
	threadForStatusHint,
	threadViewedAtMs,
	markThreadViewed,
	noteRunningThreadHint,
	noteSubmittedProcessingThreadHint: noteSubmittedProcessingThreadHint$1,
	clearSubmittedProcessingThreadHint,
	clearRunningThreadHint,
	threadUpdatedAtMs: threadUpdatedAtMs$1,
	threadStatusNotificationDurableEventAtMs,
	threadStatusNotificationEventAtMs,
	threadLatestTerminalTurnAtMs,
	currentThreadAllowsLiveTurn,
	currentLiveTurnSupportsThreadStatusHint,
	currentThreadRefreshSupportsThreadStatusHint,
	shouldKeepRunningHintForSettledStatus,
	shouldMarkThreadUnread,
	runningThreadHintAgeMs,
	shouldExpireRunningThreadHint,
	updateThreadStatusHints: updateThreadStatusHints$1,
	isThreadListSettledStatus,
	isThreadListTerminalStatus,
	reconcileThreadStatusHints: reconcileThreadStatusHints$1,
	statusIconInfo: statusIconInfo$1,
	statusIconHtml: statusIconHtml$1,
	rolloutSizeBytes: rolloutSizeBytes$1,
	rolloutThresholdBytes: rolloutThresholdBytes$1,
	isRolloutOverThreshold: isRolloutOverThreshold$1,
	rolloutWarningDismissKey,
	isRolloutWarningDismissed: isRolloutWarningDismissed$1,
	dismissRolloutWarning,
	rolloutSizeText: rolloutSizeText$1,
	tokenCountValue: tokenCountValue$1,
	formatTokenMillion: formatTokenMillion$1,
	tokenUsageForThread,
	normalizeThreadGoalStatus,
	normalizeThreadGoal: normalizeThreadGoal$1,
	submittedThreadGoal: submittedThreadGoal$1,
	threadGoalForThread: threadGoalForThread$1,
	threadGoalStatusLabel,
	threadGoalStatusClass,
	threadGoalSignature: threadGoalSignature$1,
	threadGoalBudgetText,
	renderThreadGoalBadge: renderThreadGoalBadge$1,
	renderThreadGoal,
	dialogPrefillThreadGoal,
	currentGoalDialogThread,
	goalDialogStatusText,
	updateThreadGoalDialogState: updateThreadGoalDialogState$1,
	setThreadGoalDialogBusy: setThreadGoalDialogBusy$1,
	openThreadGoalDialog: openThreadGoalDialog$1,
	closeThreadGoalDialog: closeThreadGoalDialog$1,
	normalizeOptionList: normalizeOptionList$1,
	labelForModel: labelForModel$1,
	compactLabelForModel,
	labelForEffort: labelForEffort$1,
	labelForPermissionMode: labelForPermissionMode$1,
	titleForPermissionMode,
	newThreadSelectedModel: newThreadSelectedModel$1,
	newThreadSelectedEffort: newThreadSelectedEffort$1,
	newThreadSelectedPermissionMode: newThreadSelectedPermissionMode$1,
	normalizePermissionModeValue: normalizePermissionModeValue$1,
	effectiveComposerPermissionMode: effectiveComposerPermissionMode$1,
	normalizeModelKey,
	isSparkModelKey,
	isRateLimitCompatibleWithModel,
	rateLimitModelKeys,
	rememberRateLimits,
	clearStoredRateLimits: clearStoredRateLimits$1,
	hasRateLimitSnapshot,
	shouldKeepStoredRateLimitsOnEmptyConfig,
	rememberRateLimitsFromConfig,
	rateLimitWindows,
	hasCurrentRateLimitWindow,
	rateLimitWindowForMinutes,
	weeklyRateLimit,
	fiveHourRateLimit,
	clampPercent,
	formatQuotaReset,
	formatQuotaResetShort,
	quotaRemainingText,
	quotaRiskLevel,
	quotaChipHtml,
	quotaInlineHtml,
	quotaTitle,
	selectedQuotaModel: selectedQuotaModel$1,
	rateLimitsForQuota,
	renderQuotaUsage: renderQuotaUsage$1,
	quotaDetailLineHtml,
	renderQuotaDetailPanel,
	quotaShortTextFromSnapshot,
	rememberCodexProfiles,
	codexProfileAccountLabel,
	codexProfileStatusLabel,
	renderCodexProfileSettings: renderCodexProfileSettings$1,
	loadCodexProfiles,
	normalizeWorkspaceDelegationConfig,
	rememberWorkspaceDelegationConfig,
	workspaceDelegationSourceLabel,
	renderWorkspaceDelegationSettings,
	handleWorkspaceDelegationSettingsClick,
	normalizeRemoteManagedWorkspaceConfig,
	rememberRemoteManagedWorkspaceConfig,
	remoteManagedWorkspaceStatusLabel,
	renderRemoteManagedWorkspaceSettings,
	remoteManagedWorkspaceFormPayload,
	loadRemoteManagedWorkspaceSettings,
	handleRemoteManagedWorkspaceSettingsClick,
	handleCodexProfileSettingsClick,
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
	clearSettledServerBuildPluginRefreshAfterThreadEntry,
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
	showReconnectRefreshPrompt: showReconnectRefreshPrompt$1,
	finishRestartingUiIfReady,
	clearReconnectRefreshPrompt,
	checkPageRefreshAvailability,
	schedulePageRefreshCheck,
	scheduleVisiblePageRefreshCheck: scheduleVisiblePageRefreshCheck$1,
	startPageRefreshChecks,
	waitForPageBuildConfig,
	refreshPageForNewBuild,
	createSettingsRuntime
});
root$3.CodexSettingsRuntime = settingsRuntimeApi;
//#endregion
//#region frontend/native/modal-runtime.mjs
var root$2 = typeof globalThis !== "undefined" ? globalThis : window;
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
function requestCodexProfileSwitchConfirmation$1(profileId, label) {
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
async function performCodexProfileSwitch$1(profileId) {
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
		requestCodexProfileSwitchConfirmation: typeof requestCodexProfileSwitchConfirmation$1 === "function" ? requestCodexProfileSwitchConfirmation$1 : null
	};
}
var modalRuntimeApi = Object.freeze({ createModalRuntime });
Object.assign(root$2, {
	renderAppNativeDialog,
	closeAppNativeDialog,
	requestAppNativeDialog,
	requestAppAlert,
	requestAppConfirmation,
	requestAppTextInput,
	handleAppNativeDialogKeydown,
	renderCodexProfileSwitchDialog,
	closeCodexProfileSwitchDialog,
	requestCodexProfileSwitchConfirmation: requestCodexProfileSwitchConfirmation$1,
	codexProfileSwitchStageLabel,
	formatCodexProfileSwitchProgress,
	setCodexProfileSwitchStage,
	clearCodexProfileSwitchStageTimers,
	stopCodexProfileSwitchProgressPolling,
	startCodexProfileSwitchProgressPolling,
	performCodexProfileSwitch: performCodexProfileSwitch$1
});
root$2.CodexModalRuntime = modalRuntimeApi;
//#endregion
//#region frontend/native/navigation-runtime.mjs
var root$1 = typeof globalThis !== "undefined" ? globalThis : window;
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
function restoreConnectionState$1(fallbackText = "Connected") {
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
	markActivity$1("自动续接中");
	let recoveredCount = 0;
	for (const candidate of candidates) {
		const result = await recoverTurnCandidateAfterReconnect(candidate, reason);
		if (result && result.recovered) recoveredCount += 1;
	}
	if (state.restartAutoRecoverThreads.length) clearRestartAutoRecoverThreads();
	if (recoveredCount > 0) {
		markActivity$1(recoveredCount === 1 ? "已自动续接" : `已自动续接 ${recoveredCount} 个线程`);
		loadThreads({ silent: true }).catch(showError);
	}
}
function showComposerFastHint$1(enabled) {
	const el = $("connectionState");
	if (!el) return;
	if (state.composerFastHintTimer) window.clearTimeout(state.composerFastHintTimer);
	el.classList.remove("error");
	el.textContent = enabled ? "Fast on" : "Fast off";
	el.title = enabled ? "Fast tag enabled for this thread" : "Fast tag disabled for this thread";
	state.composerFastHintTimer = window.setTimeout(() => {
		state.composerFastHintTimer = null;
		restoreConnectionState$1();
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
function markActivity$1(label) {
	state.activityLabel = String(label || "").trim();
	state.activityAtMs = state.activityLabel ? Date.now() : 0;
	updateTurnTimer();
}
function clearSteerFeedbackTimer() {
	if (state.steerFeedbackTimer) window.clearTimeout(state.steerFeedbackTimer);
	state.steerFeedbackTimer = null;
}
function setSteerFeedback$1(status, details = {}) {
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
	markActivity$1(steerFeedbackLabel(status));
	if (status === "applied" || status === "failed" || status === "completed") state.steerFeedbackTimer = window.setTimeout(() => {
		state.steerFeedback = null;
		state.steerFeedbackTimer = null;
		restoreConnectionState$1();
		updateTurnTimer();
	}, status === "failed" ? 3200 : 2400);
}
function steerFeedbackLabel(status) {
	if (status === "sending") return "引导中…";
	if (status === "queued") return "引导已排队";
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
	return feedback.status === "sending" || feedback.status === "queued" || feedback.status === "delivered";
}
function markSteerAppliedIfNeeded(turnId, item = null) {
	if (!isPendingSteerForTurn(turnId)) return;
	if (item && item.type === "userMessage") return;
	setSteerFeedback$1("applied", { turnId: String(turnId) });
}
function isIdleSyncActivityLabel(label) {
	return String(label || "").trim() === "同步";
}
function markIdleActivity(label) {
	const liveTurn = currentLiveTurn$1();
	if (!state.activeTurnId && !liveTurn) return;
	if (liveActivityLabelForTurn(liveTurn)) return;
	if (isIdleSyncActivityLabel(label) && liveTurn) return;
	if (state.activityAtMs && Date.now() - state.activityAtMs < 3e3) return;
	markActivity$1(label);
}
function normalizeFsPath$1(value) {
	return String(value || "").replace(/^\\\\\?\\/, "").replace(/[\\/]+/g, "\\").replace(/\\+$/, "").toLowerCase();
}
function draftKeyForThread$1(threadId) {
	return draftStore.keyForThread(threadId);
}
function draftKeyForNewThread(cwd) {
	return draftStore.keyForNewThread(cwd);
}
function effectiveThreadTileSelectedThreadId$1(ids = state.threadTileActiveIds) {
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
function currentComposerThreadId$1() {
	return composerTargetPlan().targetThreadId || "";
}
function isThreadTileComposerContext$1() {
	return composerTargetPlan().tileContext === true;
}
function composerTargetThread$1() {
	const id = currentComposerThreadId$1();
	if (!id) return null;
	if (state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
	return threadTileDisplayThread(id);
}
function composerTargetActiveTurnId$1() {
	const target = composerTargetThread$1();
	if (!target) return "";
	if (state.currentThread && String(state.currentThread.id || "") === String(target.id || "") && state.activeTurnId) {
		const activeTurnId = String(state.activeTurnId);
		const activeTurn = (Array.isArray(target.turns) ? target.turns : []).find((turn) => String(turn && turn.id || "") === activeTurnId);
		if (activeTurn && isLiveTurnForThread$1(target, activeTurn)) return activeTurnId;
		state.activeTurnId = "";
	}
	return activeTurnIdForThread$1(target);
}
function currentDraftKey$1() {
	if (state.newThreadDraft) return draftKeyForNewThread(state.selectedCwd);
	return draftKeyForThread$1(currentComposerThreadId$1());
}
function readDraftMap$1() {
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
		if (state.newThreadModel && state.newThreadModel !== defaultNewThreadModel$1()) draft.model = state.newThreadModel;
		if (state.newThreadEffort && state.newThreadEffort !== defaultNewThreadEffort$1()) draft.effort = state.newThreadEffort;
		const permission = normalizePermissionModeValue(state.newThreadPermissionMode);
		if (permission && permission !== defaultNewThreadPermissionMode$1()) draft.permissionMode = permission;
	} else {
		if (state.composerModel) draft.model = state.composerModel;
		if (state.composerEffort) draft.effort = state.composerEffort;
		const permission = normalizePermissionModeValue(state.composerPermissionMode);
		if (permission) draft.permissionMode = permission;
	}
	if (codexFastCommandEnabled()) draft.fastMode = true;
	return draft;
}
function draftHasContent$1(draft) {
	return draftStore.hasContent(draft);
}
async function storeDraftAttachment(draftKey, item) {
	return draftStore.storeAttachment(draftKey, item);
}
async function loadDraftAttachment(draftKey, meta) {
	return draftStore.loadAttachment(draftKey, meta);
}
async function deleteDraftAttachments$1(draftKey, attachmentIds = null) {
	return draftStore.deleteAttachments(draftKey, attachmentIds);
}
function saveDraftAttachmentFiles$1(draftKey, items) {
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
function saveCurrentDraftNow$1() {
	clearTimeout(state.draftSaveTimer);
	state.draftSaveTimer = null;
	if (state.composerBusy) return;
	const key = currentDraftKey$1();
	if (!key) return;
	writeCurrentDraftToKey$1(key);
}
function writeCurrentDraftToKey$1(key) {
	const targetKey = String(key || "");
	if (!targetKey) return;
	const map = readDraftMap$1();
	const draft = buildCurrentDraft();
	if (draftHasContent$1(draft)) {
		map[targetKey] = draft;
		if (targetKey.startsWith("new:")) draftStore.setTargetKey(targetKey);
	} else {
		delete map[targetKey];
		draftStore.clearTargetKeyIfMatches(targetKey);
	}
	writeDraftMap(map);
}
function scheduleCurrentDraftSave$1() {
	clearTimeout(state.draftSaveTimer);
	state.draftSaveTimer = setTimeout(saveCurrentDraftNow$1, DRAFT_SAVE_DEBOUNCE_MS);
}
function clearDraftForKey$1(draftKey) {
	const key = String(draftKey || "");
	if (!key) return;
	const map = readDraftMap$1();
	delete map[key];
	writeDraftMap(map);
	draftStore.clearTargetKeyIfMatches(key);
	deleteDraftAttachments$1(key).catch((err) => {
		postClientEvent("draft_attachment_clear_failed", { message: err.message || String(err) });
	});
}
function defaultNewThreadModel$1() {
	return state.defaultModel || state.modelOptions[0] || "";
}
function defaultNewThreadEffort$1() {
	return state.defaultReasoningEffort || state.reasoningEffortOptions[0] || "";
}
function defaultNewThreadPermissionMode$1() {
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
		defaultNewThreadModel: defaultNewThreadModel$1(),
		defaultNewThreadEffort: defaultNewThreadEffort$1(),
		defaultNewThreadPermissionMode: defaultNewThreadPermissionMode$1(),
		resetRuntimeWhenMissingDraft: options.resetRuntimeWhenMissingDraft === true
	});
	state.codexFastMode = plan.fastMode === true;
	if (plan.setNewThreadRuntime) {
		state.newThreadTitle = plan.newThreadTitle || "";
		state.newThreadModel = plan.newThreadModel || defaultNewThreadModel$1();
		state.newThreadEffort = plan.newThreadEffort || defaultNewThreadEffort$1();
		state.newThreadPermissionMode = plan.newThreadPermissionMode || defaultNewThreadPermissionMode$1();
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
function replacePendingAttachments$1(items, options = {}) {
	if (options.revokePreviewUrls !== false) revokeAttachmentPreviewUrls(state.pendingAttachments);
	state.pendingAttachments = Array.isArray(items) ? items : [];
	renderAttachmentList();
	if (options.saveDraft !== false) scheduleCurrentDraftSave$1();
}
function restoreDraftForCurrentTarget$1(options = {}) {
	clearTimeout(state.draftSaveTimer);
	state.draftSaveTimer = null;
	const key = currentDraftKey$1();
	const draft = key ? readDraftMap$1()[key] : null;
	const restoreSeq = state.draftRestoreSeq + 1;
	state.draftRestoreSeq = restoreSeq;
	setComposerText(draft && draft.text ? draft.text : "");
	applyDraftRuntimeSelection(draft || null, options);
	replacePendingAttachments$1([], { saveDraft: false });
	renderComposerSettings();
	updateComposerControls();
	const metas = draft && Array.isArray(draft.attachments) ? draft.attachments : [];
	if (!key || !metas.length) return;
	Promise.all(metas.map((meta) => loadDraftAttachment(key, meta).catch(() => null))).then((items) => {
		if (restoreSeq !== state.draftRestoreSeq || key !== currentDraftKey$1()) {
			for (const item of items) if (item && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
			return;
		}
		const restored = items.filter(Boolean);
		replacePendingAttachments$1(restored, { saveDraft: false });
		if (restored.length !== metas.length) showError(/* @__PURE__ */ new Error("有草稿附件没有恢复，请重新选择后再发送。"));
	}).catch((err) => {
		postClientEvent("draft_restore_failed", { message: err.message || String(err) });
	});
}
function visibleWorkspaceKeys$1() {
	return new Set(state.workspaces.map((ws) => normalizeFsPath$1(ws.cwd)).filter(Boolean));
}
function basenameForFsPath$1(value) {
	const parts = normalizeFsPath$1(value).split("\\").filter(Boolean);
	return parts.length ? parts[parts.length - 1] : "";
}
function visibleWorkspaceNames$1() {
	return new Set(state.workspaces.map((ws) => basenameForFsPath$1(ws.cwd)).filter(Boolean));
}
function codexWorktreeRepoName$1(value) {
	const normalized = normalizeFsPath$1(value);
	const index = normalized.indexOf("\\.codex\\worktrees\\");
	if (index < 0) return "";
	const parts = normalized.slice(index + 18).split("\\").filter(Boolean);
	return parts.length >= 2 ? parts[1] : "";
}
var MESSAGE_INPUT_MIN_HEIGHT_PX$1 = 44;
var MESSAGE_INPUT_MAX_HEIGHT_PX$1 = 160;
function threadMatchesWorkspaceCwd(...args) {
	return threadListRuntime.threadMatchesWorkspaceCwd(...args);
}
function threadMatchesVisibleWorkspace(...args) {
	return threadListRuntime.threadMatchesVisibleWorkspace(...args);
}
function isHiddenThread(...args) {
	return threadListRuntime.isHiddenThread(...args);
}
function visibleThreads$1(...args) {
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
function snapshotThreadStatus$1(...args) {
	return threadListRuntime.snapshotThreadStatus(...args);
}
function restoreThreadStatusSnapshot$1(...args) {
	return threadListRuntime.restoreThreadStatusSnapshot(...args);
}
function markThreadOptimisticallyActive$1(threadId) {
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
		mergeThreadIntoThreadList$1(state.currentThread);
	}
}
function mergeThreadIntoThreadList$1(thread) {
	const result = threadDetailStateApi.mergeThreadSummaryIntoList(state.threads, thread, { visibleThreads: visibleThreads$1 });
	if (!result.changed) return false;
	state.threads = result.threads;
	return result.changed;
}
function isRunningStatus$1(status) {
	const text = statusText(status).toLowerCase();
	return /(running|active|queued|processing|inprogress|in_progress|in-progress)/.test(text) && !/(completed|failed|cancel|error|interrupted)/.test(text);
}
function isCompletedStatus$1(status) {
	return /completed|failed|cancel|error|interrupted/i.test(statusText(status));
}
function isTurnComplete$1(turn) {
	return Boolean(turn && (turn.completedAt || turn.durationMs || isCompletedStatus$1(turn.status)));
}
function isStaleOrSupersededLiveTurn(turn) {
	return Boolean(turn && (turn.mobileStaleActiveTurn || isStaleActiveStatus(turn.status) || isSupersededLiveTurn(turn)));
}
function isReasoningItem$1(item) {
	return item && item.type === "reasoning";
}
function syncActiveTurnFromThread$1() {
	const running = latestLiveTurnCandidate();
	state.activeTurnId = running ? running.id : "";
	const interrupt = $("interruptTurn");
	if (interrupt) interrupt.disabled = !state.activeTurnId;
	updateComposerControls();
}
function isOperationalItem$1(item) {
	return item && (OPERATIONAL_ITEM_TYPES.has(item.type) || isWebSearchLikeItem(item));
}
function isActiveOperationalItem$1(item) {
	if (!isOperationalItem$1(item)) return false;
	const completedByTimestamp = Boolean(item.completedAtMs || item.completedAt || item.completed_at_ms || item.completed_at);
	return !isCompletedStatus$1(statusText(item.status) || (completedByTimestamp ? "completed" : ""));
}
function activityLabelForItem(item) {
	if (!item) return "更新";
	const completed = isCompletedStatus$1(statusText(item.status));
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
function isContextCompactionItem$1(item) {
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
	return !turn || isLatestTurn$1(turn, thread) && isLiveTurn$1(turn, thread);
}
function contextCompactionState(item, turn = null, thread = null) {
	if (!item) return "";
	const itemKind = contextCompactionStatusKind(item.status);
	const mobileKind = contextCompactionStatusKind(item.mobileCompactionStatus);
	if (itemKind === "complete" || mobileKind === "complete" || item.mobileNotice === CONTEXT_COMPACTION_COMPLETE_NOTICE) return "complete";
	if (itemKind === "pending" || mobileKind === "pending" || item.mobileNotice === CONTEXT_COMPACTION_PENDING_NOTICE) return canShowPendingContextCompaction(turn, thread) ? "pending" : "";
	return "";
}
function contextCompactionNotice$1(item, turn = null, thread = null) {
	const stateText = contextCompactionState(item, turn, thread);
	if (stateText === "pending") return CONTEXT_COMPACTION_PENDING_NOTICE;
	if (stateText === "complete") return CONTEXT_COMPACTION_COMPLETE_NOTICE;
	return "";
}
function turnHasDisplayItems(turn) {
	return Boolean(turn && Array.isArray(turn.items) && turn.items.some(Boolean));
}
function latestTurn(thread = null) {
	const sourceThread = renderContextThread$1(thread);
	const turns = sourceThread && Array.isArray(sourceThread.turns) ? sourceThread.turns : [];
	for (let index = turns.length - 1; index >= 0; index -= 1) if (turnHasDisplayItems(turns[index])) return turns[index];
	return turns.length ? turns[turns.length - 1] : null;
}
function latestRawTurn(thread = null) {
	const sourceThread = renderContextThread$1(thread);
	const turns = sourceThread && Array.isArray(sourceThread.turns) ? sourceThread.turns : [];
	return turns.length ? turns[turns.length - 1] : null;
}
function turnHasNewerDisplayTurn(thread, turn) {
	if (!turn) return false;
	const sourceThread = renderContextThread$1(thread);
	const turns = sourceThread && Array.isArray(sourceThread.turns) ? sourceThread.turns : [];
	const index = turns.indexOf(turn);
	if (index < 0) return false;
	for (let cursor = index + 1; cursor < turns.length; cursor += 1) if (turnHasDisplayItems(turns[cursor])) return true;
	return false;
}
function currentThreadHasActiveRuntimeStatus(thread = null) {
	const sourceThread = renderContextThread$1(thread);
	if (!sourceThread || isStaleActiveStatus(sourceThread.status) || sourceThread.mobileStaleActiveTurn) return false;
	const threadId = String(sourceThread.id || "");
	if (Boolean(threadId && threadId === String(state.currentThreadId || "")) && state.activeTurnId) {
		const active = turnById(state.activeTurnId);
		if (active && isLiveTurnForThread$1(sourceThread, active)) return true;
	}
	return isRunningStatus$1(sourceThread.status);
}
function currentThreadHasForegroundActiveRuntimeStatus(thread = null) {
	const sourceThread = renderContextThread$1(thread);
	if (!sourceThread || isStaleActiveStatus(sourceThread.status) || sourceThread.mobileStaleActiveTurn) return false;
	const threadId = String(sourceThread.id || "");
	if (Boolean(threadId && threadId === String(state.currentThreadId || "")) && state.activeTurnId) {
		const active = turnById(state.activeTurnId);
		if (active && isLiveTurnForThread$1(sourceThread, active)) return true;
	}
	return Boolean(latestLiveTurnForThread$1(sourceThread));
}
function latestLiveTurnCandidate() {
	const displayLatest = latestTurn();
	if (displayLatest && !isStaleOrSupersededLiveTurn(displayLatest) && !isTurnComplete$1(displayLatest) && isRunningStatus$1(displayLatest.status)) return displayLatest;
	const rawLatest = latestRawTurn();
	return rawLatest && !isStaleOrSupersededLiveTurn(rawLatest) && !isTurnComplete$1(rawLatest) && isRunningStatus$1(rawLatest.status) ? rawLatest : null;
}
function turnById(turnId) {
	const id = String(turnId || "");
	if (!id || !state.currentThread || !Array.isArray(state.currentThread.turns)) return null;
	return state.currentThread.turns.find((turn) => String(turn && turn.id || "") === id) || null;
}
function isIncompleteInterruptedTurn$1(turn) {
	return turn && statusText(turn.status).toLowerCase() === "interrupted" && !turn.completedAt && !turn.durationMs;
}
function shouldPollCurrentThread() {
	if (!state.currentThreadId || document.visibilityState === "hidden") return false;
	if (currentThreadHasActiveRuntimeStatus()) return true;
	const turn = latestTurn();
	if (!turn) return false;
	if (isStaleOrSupersededLiveTurn(turn)) return false;
	if (isTurnComplete$1(turn)) return false;
	return Boolean(state.activeTurnId) || isRunningStatus$1(turn.status) || isIncompleteInterruptedTurn$1(turn);
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
function isLiveTurn$1(turn, thread = null) {
	if (!turn || isTurnComplete$1(turn) || isStaleOrSupersededLiveTurn(turn)) return false;
	if (turnHasNewerDisplayTurn(thread, turn)) return false;
	return isRunningStatus$1(turn && turn.status) || isIncompleteInterruptedTurn$1(turn) || turnHasActiveLiveItems$1(turn) || isLatestTurn$1(turn, thread) && currentThreadHasActiveRuntimeStatus(thread);
}
function isLatestTurn$1(turn, thread = null) {
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
function existingConversationRenderKeys$1() {
	const el = $("conversation");
	if (!el) return /* @__PURE__ */ new Set();
	return new Set(Array.from(el.querySelectorAll("[data-render-key]")).map((node) => node.dataset.renderKey).filter(Boolean));
}
function entryAnimationClass$1(key, previousKeys) {
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
function visibleItemsForTurn$1(...args) {
	return requireThreadDetailRuntime().visibleItemsForTurn(...args);
}
function currentLiveOperationEntry$1(...args) {
	return requireThreadDetailRuntime().currentLiveOperationEntry(...args);
}
function liveTurnStatusDockItem(...args) {
	return requireThreadDetailRuntime().liveTurnStatusDockItem(...args);
}
function visibleItemSignature$1(...args) {
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
function isOptimisticUserMessage$1(...args) {
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
function userMessagesLikelySame$1(...args) {
	return requireThreadDetailRuntime().userMessagesLikelySame(...args);
}
function userMessagesCanShadow$1(...args) {
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
function mergeLikelySameUserMessage$1(...args) {
	return requireThreadDetailRuntime().mergeLikelySameUserMessage(...args);
}
function dedupeLikelySameUserMessages(...args) {
	return requireThreadDetailRuntime().dedupeLikelySameUserMessages(...args);
}
function normalizeThreadVisibleUserMessages$1(...args) {
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
function mergeItemsPreservingLocalVisible$1(...args) {
	return requireThreadDetailRuntime().mergeItemsPreservingLocalVisible(...args);
}
function mergeTurnPreservingVisibleItems(...args) {
	return requireThreadDetailRuntime().mergeTurnPreservingVisibleItems(...args);
}
function shouldPreserveLiveTurnLocalVisibleItems(...args) {
	return requireThreadDetailRuntime().shouldPreserveLiveTurnLocalVisibleItems(...args);
}
function mergeThreadPreservingVisibleItems$1(...args) {
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
function renderContextThread$1(thread = null) {
	return thread || state.renderContextThread || state.currentThread || null;
}
function withRenderContextThread$1(thread, callback) {
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
function approvalTurnId$1(request) {
	return request && request.params && request.params.turnId ? String(request.params.turnId) : "";
}
function isApprovalActive$1(request) {
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
function approvalsForTurn$1(threadId, turnId) {
	return pendingApprovalsForThread(threadId).filter((request) => approvalTurnId$1(request) === String(turnId || ""));
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
function taskCardVisibleInThread(card) {
	const status = String(card && card.status || "").trim();
	return String(card && card.threadRole || "").trim() === "target" && status === "pending";
}
function taskCardTerminalReturnReceiptVisibleInThread(card) {
	if (String(card && card.threadRole || "").trim() !== "target") return false;
	const delivery = card && card.delivery && typeof card.delivery === "object" ? card.delivery : {};
	const audit = card && card.audit && typeof card.audit === "object" ? card.audit : {};
	const terminal = card && card.terminal === true || delivery.terminal === true || audit.terminal === true;
	const returnToSource = delivery.returnToSource === true || audit.returnToSource === true || String(card && card.ackPolicy || delivery.ackPolicy || audit.ackPolicy || "").trim() === "none";
	return terminal && returnToSource;
}
function taskCardReceiptTimestampMs(value) {
	if (value == null || value === "") return 0;
	if (typeof value === "number") {
		if (!Number.isFinite(value) || value <= 0) return 0;
		return value < 1e10 ? value * 1e3 : value;
	}
	const text = String(value || "").trim();
	if (!text) return 0;
	if (/^\d+$/.test(text)) return taskCardReceiptTimestampMs(Number(text));
	const parsed = Date.parse(text);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
function taskCardReceiptUpdatedAtMs(card) {
	const delivery = card && card.delivery && typeof card.delivery === "object" ? card.delivery : {};
	const audit = card && card.audit && typeof card.audit === "object" ? card.audit : {};
	const message = card && card.message && typeof card.message === "object" ? card.message : {};
	return taskCardReceiptTimestampMs(delivery.returnedAtMs) || taskCardReceiptTimestampMs(delivery.returnedAt) || taskCardReceiptTimestampMs(delivery.deliveredAtMs) || taskCardReceiptTimestampMs(delivery.deliveredAt) || taskCardReceiptTimestampMs(audit.returnedAtMs) || taskCardReceiptTimestampMs(audit.returnedAt) || taskCardReceiptTimestampMs(card && card.returnedAtMs) || taskCardReceiptTimestampMs(card && card.returnedAt) || taskCardReceiptTimestampMs(message.createdAtMs) || taskCardReceiptTimestampMs(message.createdAt) || taskCardReceiptTimestampMs(card && card.createdAtMs) || taskCardReceiptTimestampMs(card && card.createdAt) || taskCardReceiptTimestampMs(card && card.updatedAtMs) || taskCardReceiptTimestampMs(card && card.updatedAt);
}
function threadTaskCardReturnReceiptsForThread(thread) {
	return (Array.isArray(thread && thread.threadTaskCards) ? thread.threadTaskCards : []).filter(taskCardTerminalReturnReceiptVisibleInThread).slice().sort((a, b) => taskCardReceiptUpdatedAtMs(b) - taskCardReceiptUpdatedAtMs(a)).slice(0, 1);
}
function threadTaskCardsForThread(thread) {
	return (Array.isArray(thread && thread.threadTaskCards) ? thread.threadTaskCards : []).filter(taskCardVisibleInThread).slice().sort((a, b) => Number(b && b.updatedAt ? Date.parse(b.updatedAt) : 0) - Number(a && a.updatedAt ? Date.parse(a.updatedAt) : 0));
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
function threadTaskCardReturnReceiptsSignature(thread) {
	return threadTaskCardReturnReceiptsForThread(thread).map((card) => ({
		id: card.id,
		status: card.status,
		updatedAt: card.updatedAt,
		threadRole: card.threadRole,
		terminal: card.terminal === true,
		ackPolicy: card.ackPolicy || ""
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
function visibleTurnsForConversation$1(thread) {
	const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
	return sortTurnsForDisplay(turns).slice(-maxVisibleTurnsForThread(thread));
}
function threadHasVisibleConversationTurns$1(thread) {
	return withRenderContextThread$1(thread, () => visibleTurnsForConversation$1(thread).some((turn) => visibleItemsForTurn$1(turn, thread).length > 0));
}
function threadIsLoadingWithoutVisibleTurns(thread) {
	return Boolean(thread && thread.mobileLoading && !threadHasVisibleConversationTurns$1(thread));
}
function conversationPatchShellSignature(thread) {
	if (!thread) return "home";
	return withRenderContextThread$1(thread, () => {
		const threadId = renderContextThreadId(thread);
		if (thread.mobileLoadError) return `load-error|${threadId}|${thread.mobileLoadError}`;
		if (threadIsLoadingWithoutVisibleTurns(thread)) return `loading|${threadId}`;
		const turns = visibleTurnsForConversation$1(thread);
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
			taskCardReceipts: threadTaskCardReturnReceiptsSignature(thread),
			readWarning: String(thread.mobileReadWarning || ""),
			readWarningMessage,
			visibleTurns: turns.map((turn) => turn && (turn.id || turn.startedAt || ""))
		};
		return JSON.stringify(payload);
	});
}
function conversationRenderSignature$1(thread) {
	if (!thread) return "home";
	return withRenderContextThread$1(thread, () => {
		const threadId = renderContextThreadId(thread);
		if (thread.mobileLoadError) return `load-error|${threadId}|${thread.mobileLoadError}`;
		if (threadIsLoadingWithoutVisibleTurns(thread)) return `loading|${threadId}`;
		const turns = visibleTurnsForConversation$1(thread);
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
			taskCardReceipts: threadTaskCardReturnReceiptsSignature(thread),
			projectionVersion: String(thread.mobileProjectionVersion || ""),
			projectionRevision: String(thread.mobileProjectionRevision || ""),
			visibleItemKeys: Array.isArray(thread.mobileVisibleItemKeys) ? thread.mobileVisibleItemKeys : [],
			turns: turns.map((turn) => {
				const timerShowsStatus = isLatestTurn$1(turn, thread) && (isLiveTurn$1(turn, thread) || turnFinalSeconds(turn) != null);
				return {
					id: turn.id || "",
					visibleItemBudget: visibleItemBudgetSignature(turn),
					statusLine: timerShowsStatus ? "" : displayTurnStatus(turn),
					durationMs: timerShowsStatus ? "" : turn.durationMs || "",
					items: visibleItemsForTurn$1(turn, thread).map((entry) => ({
						sourceIndex: entry.sourceIndex,
						item: visibleItemSignature$1(entry.item, turn, thread)
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
	return item && item.type === "reasoning" && isLatestTurn$1(turn, thread) && isLiveTurn$1(turn, thread) && !isCompletedStatus$1(item.status);
}
function liveReasoningElapsed(item, turn) {
	const startedMs = item.startedAtMs || (item.startedAt ? item.startedAt * 1e3 : 0) || (turn && turn.startedAt ? turn.startedAt * 1e3 : 0) || state.nowMs;
	return Math.max(0, Math.floor((state.nowMs - startedMs) / 1e3));
}
function latestTurnForThread$1(thread) {
	const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
	return turns.length ? turns[turns.length - 1] : null;
}
function isLiveTurnForThread$1(thread, turn) {
	if (!turn || isTurnComplete$1(turn) || isStaleOrSupersededLiveTurn(turn)) return false;
	if (turnHasNewerDisplayTurn(thread, turn)) return false;
	return isRunningStatus$1(turn && turn.status) || isIncompleteInterruptedTurn$1(turn) || turnHasActiveLiveItems$1(turn) || latestTurnForThread$1(thread) === turn && isRunningStatus$1(thread && thread.status);
}
function latestLiveTurnForThread$1(thread) {
	const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
	for (let index = turns.length - 1; index >= 0; index -= 1) {
		const turn = turns[index];
		if (isLiveTurnForThread$1(thread, turn)) return turn;
	}
	return null;
}
function activeTurnIdForThread$1(thread) {
	const live = latestLiveTurnForThread$1(thread);
	return live && live.id ? String(live.id) : "";
}
function currentLiveTurn$1() {
	if (state.activeTurnId) {
		const active = turnById(state.activeTurnId);
		if (active && isLiveTurn$1(active, state.currentThread)) return active;
	}
	const latest = latestLiveTurnCandidate() || latestTurn();
	return latest && isLiveTurn$1(latest, state.currentThread) ? latest : null;
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
	if (!turn || !isLiveTurn$1(turn)) return "";
	const operation = activeLiveOperationItemForTurn(turn);
	if (operation) return activityLabelForItem(operation);
	const items = Array.isArray(turn.items) ? turn.items : [];
	for (let index = items.length - 1; index >= 0; index -= 1) {
		const item = items[index];
		if (!item) continue;
		if (item.type === "reasoning" && !isCompletedStatus$1(item.status)) return "思考";
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
	if (!turn || !isLiveTurn$1(turn)) return "";
	const label = String(state.activityLabel || "").trim();
	if (label && !isIdleSyncActivityLabel(label) && label !== "加载线程") return label;
	if (isIncompleteInterruptedTurn$1(turn)) return "同步";
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
		if (isActiveOperationalItem$1(item)) return item;
	}
	return null;
}
function turnHasActiveLiveItems$1(turn) {
	return (Array.isArray(turn && turn.items) ? turn.items : []).some((item) => item && (item.type === "reasoning" && !isCompletedStatus$1(item.status) || isActiveOperationalItem$1(item)));
}
function liveTurnStartedAtMs(turn) {
	if (!turn) return 0;
	const explicit = numericTimestampMs(turn.startedAtMs) || numericTimestampMs(turn.startedAt) || numericTimestampMs(turn.createdAtMs) || numericTimestampMs(turn.createdAt);
	if (explicit) return explicit;
	const items = Array.isArray(turn.items) ? turn.items : [];
	for (const item of items) {
		if (!item) continue;
		if (item.type === "reasoning") {
			if (isCompletedStatus$1(item.status)) continue;
		} else if (!isActiveOperationalItem$1(item)) continue;
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
	const timeText = formatElapsedTime(seconds);
	if (timeEl.textContent !== timeText) timeEl.textContent = timeText;
	if (detailEl.textContent !== detail) detailEl.textContent = detail;
	detailEl.classList.toggle("empty", !detail);
	el.setAttribute("aria-label", detail ? `${timeText} ${detail}` : timeText);
}
function turnTimerStateFromThread(thread, options = {}) {
	const activeRuntime = options.activeRuntime === true;
	const activeLabel = String(options.activeLabel || "").trim();
	const latest = options.latest || latestTurnForThread$1(thread);
	const live = latestLiveTurnForThread$1(thread);
	if (!live) {
		if (activeRuntime && latest && !isStaleOrSupersededLiveTurn(latest) && !isTurnComplete$1(latest)) {
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
	const live = currentLiveTurn$1();
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
function turnTimerStateHtml$1(timerState = {}) {
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
	const timeText = formatElapsedTime(seconds);
	return `<div class="${escapeHtml(className)}">
    <span class="turn-timer-time">${escapeHtml(timeText)}</span><span class="turn-timer-detail${detail ? "" : " empty"}">${escapeHtml(detail)}</span>
  </div>`;
}
function threadTilePaneTimerState$1(thread) {
	return turnTimerStateFromThread(thread, {
		activeRuntime: Boolean(latestLiveTurnForThread$1(thread)),
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
	} else if (!currentLiveTurn$1() && !currentThreadHasActiveRuntimeStatus()) return;
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
		const endMs = completedMs || (isCompletedStatus$1(status) ? 0 : state.nowMs);
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
		if (!item || isOperationalItem$1(item) || isReasoningItem$1(item)) return total;
		return total + String(item.text || "").length + String((item.summary || []).join("")).length + String((item.content || []).join("")).length;
	}, 0);
	const visibleCount = items.filter((item) => item && !isReasoningItem$1(item)).length;
	return [
		turn.id,
		statusText(turn.status),
		visibleCount,
		last && !isReasoningItem$1(last) ? last.id : "",
		turn.completedAt || "",
		turn.durationMs || "",
		bodySize
	].join("|");
}
function createNavigationRuntime() {
	return {
		updateConnectionState: typeof updateConnectionState === "function" ? updateConnectionState : null,
		restoreConnectionState: typeof restoreConnectionState$1 === "function" ? restoreConnectionState$1 : null,
		markActivity: typeof markActivity$1 === "function" ? markActivity$1 : null,
		composerTargetPlan: typeof composerTargetPlan === "function" ? composerTargetPlan : null,
		visibleTurnsForConversation: typeof visibleTurnsForConversation$1 === "function" ? visibleTurnsForConversation$1 : null,
		conversationRenderSignature: typeof conversationRenderSignature$1 === "function" ? conversationRenderSignature$1 : null,
		updateTurnTimer: typeof updateTurnTimer === "function" ? updateTurnTimer : null
	};
}
var navigationRuntimeApi = Object.freeze({ createNavigationRuntime });
Object.assign(root$1, {
	updateConnectionState,
	restoreConnectionState: restoreConnectionState$1,
	maybeAutoRecoverTurnAfterReconnect,
	showComposerFastHint: showComposerFastHint$1,
	clearReconnectTimers,
	markActivity: markActivity$1,
	setSteerFeedback: setSteerFeedback$1,
	isPendingSteerForTurn,
	markSteerAppliedIfNeeded,
	markIdleActivity,
	normalizeFsPath: normalizeFsPath$1,
	draftKeyForThread: draftKeyForThread$1,
	effectiveThreadTileSelectedThreadId: effectiveThreadTileSelectedThreadId$1,
	composerTargetPlan,
	currentComposerThreadId: currentComposerThreadId$1,
	isThreadTileComposerContext: isThreadTileComposerContext$1,
	composerTargetThread: composerTargetThread$1,
	composerTargetActiveTurnId: composerTargetActiveTurnId$1,
	currentDraftKey: currentDraftKey$1,
	readDraftMap: readDraftMap$1,
	draftHasContent: draftHasContent$1,
	deleteDraftAttachments: deleteDraftAttachments$1,
	scheduleAttachmentPreviewUrlRevoke,
	saveDraftAttachmentFiles: saveDraftAttachmentFiles$1,
	saveCurrentDraftNow: saveCurrentDraftNow$1,
	writeCurrentDraftToKey: writeCurrentDraftToKey$1,
	scheduleCurrentDraftSave: scheduleCurrentDraftSave$1,
	clearDraftForKey: clearDraftForKey$1,
	defaultNewThreadModel: defaultNewThreadModel$1,
	defaultNewThreadEffort: defaultNewThreadEffort$1,
	defaultNewThreadPermissionMode: defaultNewThreadPermissionMode$1,
	replacePendingAttachments: replacePendingAttachments$1,
	restoreDraftForCurrentTarget: restoreDraftForCurrentTarget$1,
	visibleWorkspaceKeys: visibleWorkspaceKeys$1,
	basenameForFsPath: basenameForFsPath$1,
	visibleWorkspaceNames: visibleWorkspaceNames$1,
	codexWorktreeRepoName: codexWorktreeRepoName$1,
	threadMatchesWorkspaceCwd,
	threadMatchesVisibleWorkspace,
	isHiddenThread,
	visibleThreads: visibleThreads$1,
	pruneHiddenThreads,
	applyThreadStatusToThread,
	scheduleThreadStatusDetailRender,
	updateThreadListStatus,
	localThreadForStatusContext,
	snapshotThreadStatus: snapshotThreadStatus$1,
	restoreThreadStatusSnapshot: restoreThreadStatusSnapshot$1,
	markThreadOptimisticallyActive: markThreadOptimisticallyActive$1,
	mergeThreadIntoThreadList: mergeThreadIntoThreadList$1,
	isCompletedStatus: isCompletedStatus$1,
	isRunningStatus: isRunningStatus$1,
	isTurnComplete: isTurnComplete$1,
	isReasoningItem: isReasoningItem$1,
	syncActiveTurnFromThread: syncActiveTurnFromThread$1,
	isOperationalItem: isOperationalItem$1,
	isActiveOperationalItem: isActiveOperationalItem$1,
	isContextCompactionItem: isContextCompactionItem$1,
	contextCompactionNotice: contextCompactionNotice$1,
	activityLabelForItem,
	isWebSearchLikeItem,
	latestTurn,
	turnById,
	currentThreadNeedsForegroundRefresh,
	isIncompleteInterruptedTurn: isIncompleteInterruptedTurn$1,
	shouldPollCurrentThread,
	isLiveTurn: isLiveTurn$1,
	isLatestTurn: isLatestTurn$1,
	stableItemKey,
	stableTurnKey,
	stableTextHash,
	stableOperationRenderKey,
	isNodeStartAboveConversationViewport,
	existingConversationRenderKeys: existingConversationRenderKeys$1,
	entryAnimationClass: entryAnimationClass$1,
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
	visibleItemsForTurn: visibleItemsForTurn$1,
	currentLiveOperationEntry: currentLiveOperationEntry$1,
	liveTurnStatusDockItem,
	visibleItemSignature: visibleItemSignature$1,
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
	isOptimisticUserMessage: isOptimisticUserMessage$1,
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
	userMessagesLikelySame: userMessagesLikelySame$1,
	userMessagesCanShadow: userMessagesCanShadow$1,
	userMessageTimestampMs,
	userMessagesHaveNearbyTimestamps,
	durableTurnCanReceivePendingEcho,
	optimisticEchoCanMatchEarlierDurable,
	hasMatchingIncomingUserMessage,
	hasMatchingRealUserMessage,
	removeShadowedMuxUserMessages,
	userMessageShadowPriority,
	mergeLikelySameUserMessage: mergeLikelySameUserMessage$1,
	dedupeLikelySameUserMessages,
	normalizeThreadVisibleUserMessages: normalizeThreadVisibleUserMessages$1,
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
	mergeItemsPreservingLocalVisible: mergeItemsPreservingLocalVisible$1,
	mergeTurnPreservingVisibleItems,
	mergeThreadPreservingVisibleItems: mergeThreadPreservingVisibleItems$1,
	shouldPreserveLiveTurnLocalVisibleItems,
	turnOrderMs,
	turnIsSupersededBy,
	rememberReusableThreadDetail,
	renderContextThreadId,
	renderContextThread: renderContextThread$1,
	withRenderContextThread: withRenderContextThread$1,
	approvalThreadId,
	approvalTurnId: approvalTurnId$1,
	isApprovalActive: isApprovalActive$1,
	isApprovalSettled,
	shouldShowApprovalRequest,
	requestBelongsToThread,
	approvalActionThreadId,
	scheduleApprovalThreadRender,
	approvalsForTurn: approvalsForTurn$1,
	pendingApprovalsForThread,
	taskCardTerminalReturnReceiptVisibleInThread,
	threadTaskCardReturnReceiptsSignature,
	threadTaskCardReturnReceiptsForThread,
	taskCardVisibleInThread,
	threadTaskCardsForThread,
	collectFileNames,
	visibleTurnsForConversation: visibleTurnsForConversation$1,
	threadHasVisibleConversationTurns: threadHasVisibleConversationTurns$1,
	threadIsLoadingWithoutVisibleTurns,
	conversationPatchShellSignature,
	conversationRenderSignature: conversationRenderSignature$1,
	latestTurnForThread: latestTurnForThread$1,
	isLiveTurnForThread: isLiveTurnForThread$1,
	latestLiveTurnForThread: latestLiveTurnForThread$1,
	currentLiveTurn: currentLiveTurn$1,
	turnHasActiveLiveItems: turnHasActiveLiveItems$1,
	isLiveReasoning,
	liveReasoningElapsed,
	activeTurnIdForThread: activeTurnIdForThread$1,
	turnTimerStateHtml: turnTimerStateHtml$1,
	threadTilePaneTimerState: threadTilePaneTimerState$1,
	updateTurnTimer,
	updateTickTimer,
	turnFinalSeconds,
	operationDurationData,
	operationDurationAttrs,
	updateOperationDurationBadges,
	startRelativeTimeTimer,
	threadSignature,
	MESSAGE_INPUT_MIN_HEIGHT_PX: MESSAGE_INPUT_MIN_HEIGHT_PX$1,
	MESSAGE_INPUT_MAX_HEIGHT_PX: MESSAGE_INPUT_MAX_HEIGHT_PX$1
});
root$1.CodexNavigationRuntime = navigationRuntimeApi;
//#endregion
//#region frontend/native/runtime-wiring-runtime.mjs
var root = typeof globalThis !== "undefined" ? globalThis : window;
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
	exposeThreadDetailRuntimeHelpers(threadDetailRuntime);
	return threadDetailRuntime;
}
function exposeThreadDetailRuntimeHelpers(runtime) {
	if (!runtime || typeof runtime !== "object") return;
	[
		"userMessagesAreSameTurnDuplicateEvent",
		"mergeLikelySameUserMessage",
		"normalizeThreadVisibleUserMessages",
		"visibleTextItemsLikelySame",
		"isTurnUsageSummaryItem",
		"mergeItemPreservingVisibleFields"
	].forEach((name) => {
		if (typeof runtime[name] === "function") root[name] = runtime[name];
	});
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
		diagnosticTurnHash,
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
		recordSubmittedEchoDiagnosticLog,
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
		schedulePostCompletionThreadRefreshes,
		scheduleScrollToBottomButtonUpdate,
		scheduleSubmittedMessageDomProbe,
		scheduleUsageBackfillRefresh,
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
var runtimeWiringApi = { createRuntimeWiringRuntime };
root.CodexRuntimeWiringRuntime = runtimeWiringApi;
//#endregion
//#region \0virtual:codex-mobile-esm-compatibility/shard/shard-04
var moduleDefinitions = [
	{
		"id": "settings-runtime",
		"source": "public/settings-runtime.js",
		"nativeSource": "frontend/native/settings-runtime.mjs",
		"globalName": "CodexSettingsRuntime",
		"expectedFunctions": ["createSettingsRuntime"],
		"assetPath": "/settings-runtime.js",
		"importSource": "frontend/native/settings-runtime.mjs",
		"compatibilityMode": "native-esm",
		"classicLoaderExcluded": true,
		"bytes": 121024
	},
	{
		"id": "modal-runtime",
		"source": "public/modal-runtime.js",
		"nativeSource": "frontend/native/modal-runtime.mjs",
		"globalName": "CodexModalRuntime",
		"expectedFunctions": ["createModalRuntime"],
		"assetPath": "/modal-runtime.js",
		"importSource": "frontend/native/modal-runtime.mjs",
		"compatibilityMode": "native-esm",
		"classicLoaderExcluded": true,
		"bytes": 12049
	},
	{
		"id": "navigation-runtime",
		"source": "public/navigation-runtime.js",
		"nativeSource": "frontend/native/navigation-runtime.mjs",
		"globalName": "CodexNavigationRuntime",
		"expectedFunctions": ["createNavigationRuntime"],
		"assetPath": "/navigation-runtime.js",
		"importSource": "frontend/native/navigation-runtime.mjs",
		"compatibilityMode": "native-esm",
		"classicLoaderExcluded": true,
		"bytes": 81824
	},
	{
		"id": "runtime-wiring-runtime",
		"source": "public/runtime-wiring-runtime.js",
		"nativeSource": "frontend/native/runtime-wiring-runtime.mjs",
		"globalName": "CodexRuntimeWiringRuntime",
		"expectedFunctions": ["createRuntimeWiringRuntime"],
		"assetPath": "/runtime-wiring-runtime.js",
		"importSource": "frontend/native/runtime-wiring-runtime.mjs",
		"compatibilityMode": "native-esm",
		"classicLoaderExcluded": true,
		"bytes": 9963
	}
];
var moduleApis = {
	"settings-runtime": settingsRuntimeApi,
	"modal-runtime": modalRuntimeApi,
	"navigation-runtime": navigationRuntimeApi,
	"runtime-wiring-runtime": runtimeWiringApi
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
		const fullVersion = runtime && typeof runtime.fullClientBuildVersionText === "function" ? runtime.fullClientBuildVersionText({
			clientBuildId: "0.1.11|codex-mobile-shell-v625-a5a3d596240d",
			shellCacheName: "codex-mobile-shell-v625-a5a3d596240d"
		}) : "";
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
			ok: runtime && typeof runtime.refreshPageForNewBuild === "function" && client === "客户端 v625" && version === "v0.1.11 · 客户端 v625" && fullVersion === "clientBuildId 0.1.11|codex-mobile-shell-v625-a5a3d596240d · shellCacheName codex-mobile-shell-v625-a5a3d596240d" && updateLine === "Update available: abc123" && publicLine === "Public latest: def456" && serverBuild === "client-a",
			client,
			version,
			fullVersion,
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
			ok: runtime && typeof runtime === "object" && typeof runtime.sendMessage === "function" && typeof runtime.sendNewThreadMessage === "function" && typeof runtime.answerServerRequest === "function" && typeof runtime.answerApproval === "function" && typeof runtime.declineServerRequest === "function" && typeof runtime.mutateThreadTaskCard === "function" && typeof runtime.replyTaskCard === "function" && typeof runtime.queueThreadTaskCardDraftCreation === "function" && typeof runtime.createThreadTaskCardDraft === "function" && typeof runtime.closeQuotaDetails === "function" && typeof runtime.toggleQuotaDetails === "function" && typeof globalThis.sendMessage === "function" && typeof globalThis.answerApproval === "function" && typeof globalThis.mutateThreadTaskCard === "function" && typeof globalThis.queueThreadTaskCardDraftCreation === "function",
			factoryType: typeof api.createComposerBridgeRuntime,
			sendType: typeof (runtime && runtime.sendMessage),
			answerType: typeof (runtime && runtime.answerServerRequest),
			approvalType: typeof (runtime && runtime.answerApproval),
			mutateType: typeof (runtime && runtime.mutateThreadTaskCard),
			replyType: typeof (runtime && runtime.replyTaskCard),
			draftType: typeof (runtime && runtime.createThreadTaskCardDraft),
			closeQuotaType: typeof (runtime && runtime.closeQuotaDetails),
			toggleQuotaType: typeof (runtime && runtime.toggleQuotaDetails),
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
			status: {
				type: "completed",
				mobileStaleActiveTurn: true
			},
			runningHintedAtMs: 0,
			runningHintStaleMs: 1e3,
			nowMs: 5e3,
			thread: { mobileStaleActiveTurn: true }
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
			nativeSource: definition.nativeSource || "",
			importSource: definition.importSource || definition.source,
			compatibilityMode: definition.compatibilityMode || "classic-global-compat",
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
		nativeEsmModuleCount: modules.filter((entry) => entry.compatibilityMode === "native-esm").length,
		classicGlobalCompatibilityModuleCount: modules.filter((entry) => entry.compatibilityMode !== "native-esm").length,
		readyCount: modules.filter((entry) => entry.ready === true).length,
		modules
	};
}
var codexMobileViteEsmCompatibilityModules = moduleDefinitions;
//#endregion
export { codexMobileViteEsmCompatibility, codexMobileViteEsmCompatibility as default, codexMobileViteEsmCompatibilityModules };
