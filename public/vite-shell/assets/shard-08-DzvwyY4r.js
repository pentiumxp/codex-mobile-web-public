//#region frontend/native/composer-runtime.mjs
var root$2 = typeof globalThis !== "undefined" ? globalThis : window;
function createComposerRuntime(deps = {}) {
	const { $, COMPOSER_INTENT_BODY_MAX_CHARS, MESSAGE_INPUT_MAX_HEIGHT_PX, MESSAGE_INPUT_MIN_HEIGHT_PX, STORAGE_CODEX_FAST_MODE, STORAGE_COMPOSER_INTENT_DRAFTS, THREAD_GOAL_MENTION_PATTERN, THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN, THREAD_TASK_CARD_MENTION_PATTERN, api, clearDraftForKey, clearSubmittedMessageBottomFollow, closeThreadGoalDialog, commitPluginVoiceInputSessionsAfterSend, composerTargetThread = () => null, connectEvents, composerTargetActiveTurnId, createSubmissionId, currentComposerThreadId, currentDraftKey, defaultNewThreadEffort, defaultNewThreadModel, defaultNewThreadPermissionMode, deleteDraftAttachments, diagnosticErrorCode, diagnosticErrorStatus, diagnosticTaskHash, diagnosticThreadHash, diagnosticTurnHash, document, draftKeyForThread, effectiveComposerPermissionMode, escapeHtml, followSubmittedMessageToBottom, homeAiDiagnosticReportingApi, imageCompressor, insertLocalSubmittedUserMessage, isAndroidBrowser, isChatGptProCommandText, isHermesEmbedMode, isKeyboardEditableElement, isThreadGoalCommandText, isThreadTaskCardCommandText, isThreadTileComposerContext, labelForEffort, labelForModel, labelForPermissionMode, loadJsonStorage, loadThread, loadThreads, localAttachmentPreviewUrl, localStorage, markActivity, markSubmittedUserMessageFailed, markThreadOptimisticallyActive, mergeItemsPreservingLocalVisible, newThreadSelectedEffort, newThreadSelectedModel, newThreadSelectedPermissionMode, normalizeOptionList, normalizeThreadGoal, openThreadGoalDialog, postClientEvent, publishPluginVoiceInputCapability, reconcileSubmittedUserMessageTurn, recordHomeAiDiagnosticFailure, recordSubmittedEchoDiagnosticLog, renderCurrentThread, renderQuotaUsage, renderThreads, replacePendingAttachments, restoreThreadStatusSnapshot, saveCurrentDraftNow, saveDraftAttachmentFiles, scheduleComposerTargetRefresh, scheduleCurrentDraftSave, scheduleCurrentThreadRefresh, scheduleLivePollIfNeeded, schedulePostCompletionThreadRefreshes, scheduleScrollToBottomButtonUpdate, scheduleSubmittedMessageDomProbe, scheduleUsageBackfillRefresh, selectedQuotaModel, setComposerActionButtonLabel, setSteerFeedback, setThreadGoalDialogBusy, showComposerFastHint, showError, snapshotThreadStatus, startedTurnId, state, submitChatGptProRequest, submittedThreadGoal, threadDisplayName, threadTaskCardCommandText, threadTileStatePolicy, updateThreadGoalState, viewportMetrics, viewportState, window, writeCurrentDraftToKey } = deps;
	function updateComposerHeightVar(options = {}) {
		const composer = $("composer");
		if (!composer) return false;
		const nextPx = viewportMetrics.cssPixel(composer.getBoundingClientRect().height);
		if (!nextPx) return false;
		const previousPx = viewportMetrics.cssPixel(state.composerHeightPx);
		if (!options.force && !viewportMetrics.stablePixelChanged(previousPx, nextPx)) return false;
		state.composerHeightPx = nextPx;
		document.documentElement.style.setProperty("--composer-height", `${nextPx}px`);
		scheduleScrollToBottomButtonUpdate();
		return true;
	}
	function clearSendProgressWatchdog() {
		if (state.sendProgressWatchdog) {
			clearTimeout(state.sendProgressWatchdog);
			state.sendProgressWatchdog = null;
		}
	}
	function startSendProgressWatchdog(threadId) {
		clearSendProgressWatchdog();
		state.sendProgressStartAt = Date.now();
		state.sendProgressWarned = false;
		const targetThreadId = String(threadId || "");
		state.sendProgressWatchdog = setTimeout(() => {
			if (!state.composerBusy || currentComposerThreadId() !== targetThreadId) return;
			state.sendProgressWarned = true;
			const steering = state.steerFeedback && state.steerFeedback.status === "sending";
			$("connectionState").textContent = steering ? "引导较慢，稍等一下，避免重复提交" : "发送较慢，检查网络后稍等，避免重复提交";
			$("connectionState").classList.add("error");
			postClientEvent("message_send_stall", {
				threadId: targetThreadId,
				elapsedMs: Date.now() - state.sendProgressStartAt,
				composerBusy: state.composerBusy,
				hasContent: composerHasContent()
			});
		}, 9500);
	}
	function finishSendProgressWatchdog() {
		clearSendProgressWatchdog();
		state.sendProgressStartAt = 0;
		state.sendProgressWarned = false;
	}
	function normalizeClientErrorMessage(message, err = null) {
		if (String(err && err.code || "").trim() === "codex_account_auth_invalid") return "Codex 账号登录已失效，请重新登录该账号，或切换到可用账号后重试。";
		const text = String(message || "").toLowerCase();
		if (/token_expired|refresh_token_reused|refresh token|access token/.test(text)) return "Codex 账号登录已失效，请重新登录该账号，或切换到可用账号后重试。";
		if (text.includes("failed to fetch")) return "网络异常，发送失败：请求未发出，请检查网络后重试";
		if (/(rate\s*limit|usage\s*limit|quota|limit reached|exhausted|insufficient credits?)/i.test(String(message || ""))) {
			const model = selectedQuotaModel();
			return model ? `${labelForModel(model)} 额度不足，请切换模型后重试` : "模型额度不足，请切换模型后重试";
		}
		if (text.includes("request timed out")) return "请求超时，服务响应较慢，请稍后再试";
		if (text.includes("request cancelled")) return "请求被取消，稍后可重试";
		if (/\bunauthorized\b/.test(text)) return "登录已失效，请重新登录";
		if (/\brpc timeout\b/.test(text)) return "请求服务端超时，请稍后重试";
		return rawMessageFallback(message);
	}
	function rawMessageFallback(message) {
		return String(message || "").trim() || "操作失败，请重试";
	}
	function composerText() {
		const el = $("messageInput");
		return (el ? el.innerText : "").replace(/\u00a0/g, " ").replace(/\n+$/g, "").trim();
	}
	function setComposerText(value) {
		const el = $("messageInput");
		if (!el) return;
		el.textContent = String(value || "");
		if (!value) el.innerHTML = "";
		autoSizeMessageInput(el, { force: true });
	}
	function placeMessageInputCaretAtEnd(input) {
		if (!input || !window.getSelection || !document.createRange) return false;
		try {
			const range = document.createRange();
			range.selectNodeContents(input);
			range.collapse(false);
			const selection = window.getSelection();
			if (!selection) return false;
			selection.removeAllRanges();
			selection.addRange(range);
			return true;
		} catch (_) {
			return false;
		}
	}
	function focusMessageInput(options = {}) {
		const input = $("messageInput");
		if (!input) return false;
		if (options.ensureEnabled !== false && (input.contentEditable === "false" || input.getAttribute("aria-disabled") === "true")) setMessageInputDisabled(false);
		if (input.contentEditable === "false" || input.getAttribute("aria-disabled") === "true") return false;
		if (options.resetActiveFocus && document.activeElement === input && (!isAndroidBrowser() || options.allowAndroidActiveFocusReset)) try {
			input.blur();
		} catch (_) {}
		try {
			input.focus({ preventScroll: true });
		} catch (_) {
			try {
				input.focus();
			} catch (err) {
				return false;
			}
		}
		if (options.moveCaretToEnd) placeMessageInputCaretAtEnd(input);
		if (options.retry && document.activeElement !== input) window.setTimeout(() => focusMessageInput(Object.assign({}, options, { retry: false })), 30);
		return true;
	}
	function messageInputKeyboardVisible() {
		if (!isKeyboardEditableElement(document.activeElement)) return false;
		const viewport = viewportState();
		return Boolean(viewport && (viewport.keyboardShrunk || viewport.hostKeyboardVisible));
	}
	function shouldRecoverMessageInputKeyboard() {
		const input = $("messageInput");
		if (!input || document.activeElement !== input) return false;
		if (!isAndroidBrowser() && !isHermesEmbedMode()) return false;
		if (state.composerBusy || state.composerComposing) return false;
		if (messageInputKeyboardVisible()) return false;
		return Date.now() - Number(state.messageInputKeyboardRecoveryAt || 0) > 450;
	}
	function recoverMessageInputKeyboardFromGesture() {
		const wasFocused = Boolean(state.messageInputPointerWasFocused);
		state.messageInputPointerWasFocused = false;
		if (!wasFocused) return false;
		if (!shouldRecoverMessageInputKeyboard()) return false;
		state.messageInputKeyboardRecoveryAt = Date.now();
		return focusMessageInput(isAndroidBrowser() ? {
			moveCaretToEnd: false,
			retry: true
		} : {
			moveCaretToEnd: false,
			resetActiveFocus: true,
			allowAndroidActiveFocusReset: true,
			retry: true
		});
	}
	function messageInputCanEnableForNativeGesture() {
		if (state.composerBusy || state.attachmentProcessingCount > 0) return false;
		if (state.newThreadDraft) return true;
		return Boolean(state.currentThreadId && state.currentThread && !state.currentThread.mobileLoading && !state.currentThread.mobileLoadError);
	}
	function releaseStaleAndroidMessageInputFocusBeforeNativeTap(input) {
		if (!input || !isAndroidBrowser()) return false;
		if (!state.messageInputPointerWasFocused) return false;
		if (document.activeElement === input) return false;
		if (!messageInputCanEnableForNativeGesture()) return false;
		if (state.composerComposing || messageInputKeyboardVisible()) return false;
		const now = Date.now();
		if (now - Number(state.messageInputKeyboardRecoveryAt || 0) <= 450) return false;
		state.messageInputKeyboardRecoveryAt = now;
		try {
			input.blur();
			return true;
		} catch (_) {
			return false;
		}
	}
	function prepareMessageInputForNativeGesture() {
		const input = $("messageInput");
		state.messageInputPointerWasFocused = document.activeElement === input;
		if (!input || !isAndroidBrowser()) return;
		if (!messageInputCanEnableForNativeGesture()) return;
		if (input.contentEditable === "false" || input.getAttribute("aria-disabled") === "true") setMessageInputDisabled(false);
		releaseStaleAndroidMessageInputFocusBeforeNativeTap(input);
	}
	function normalizedComposerIntentText(value) {
		return String(value || "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\u00a0/g, " ").trim();
	}
	function isAtLoopCommandText(value) {
		const text = normalizedComposerIntentText(value);
		return /^@loop(?:\s|$)/i.test(text) || /^@[a-z0-9][a-z0-9_-]*\s+@loop(?:\s|$)/i.test(text);
	}
	function atLoopCommandObjectiveText(value) {
		const text = normalizedComposerIntentText(value);
		if (/^@loop(?:\s|$)/i.test(text)) return text.replace(/^@loop(?:\s+|$)/i, "").trim();
		const aliasMatch = text.match(/^@[a-z0-9][a-z0-9_-]*\s+@loop(?:\s+|$)([\s\S]*)$/i);
		return aliasMatch ? String(aliasMatch[1] || "").trim() : "";
	}
	function atLoopPacketSectionLabel(sectionId) {
		const id = String(sectionId || "").trim();
		if (id === "requirements_packet") return "需求包";
		if (id === "design_contract_packet") return "设计契约包";
		if (id === "implementation_packet") return "实现包";
		if (id === "validation_packet") return "验证包";
		if (id === "privacy_packet") return "隐私包";
		return id;
	}
	function atLoopRequestClientOutcome(result) {
		const loop = result && result.loop && typeof result.loop === "object" ? result.loop : {};
		const sourceRequirementsStatus = loop.sourceRequirementsStatus && typeof loop.sourceRequirementsStatus === "object" ? loop.sourceRequirementsStatus : {};
		const loopId = String(loop.loopId || "");
		const loopStatus = String(loop.status || "");
		const nextRoute = String(loop.nextRoute || "");
		const missingSections = Array.isArray(sourceRequirementsStatus.missingSections) ? sourceRequirementsStatus.missingSections.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 6) : [];
		if (Boolean(sourceRequirementsStatus.pending) || loopStatus === "waiting_source_requirements" || nextRoute === "source_requirements_pending") {
			const missingText = missingSections.map(atLoopPacketSectionLabel).filter(Boolean).join("、");
			return {
				loopId,
				waitingSourceRequirements: true,
				loopStatus: loopStatus || "waiting_source_requirements",
				nextRoute: nextRoute || "source_requirements_pending",
				missingSections,
				statusText: missingText ? `Loop 等待主线程需求分析：${missingText}` : "Loop 等待主线程需求分析",
				activityText: "Loop 等待需求分析"
			};
		}
		return {
			loopId,
			waitingSourceRequirements: false,
			loopStatus,
			nextRoute,
			missingSections,
			statusText: loopId ? `Loop 已启动：${loopId.slice(0, 12)}` : "Loop 已启动",
			activityText: "Loop 已启动"
		};
	}
	function composerIntentOptions() {
		return [
			{
				kind: "goal",
				tag: "@目标任务",
				label: "目标任务",
				detail: "设置当前线程目标、预算和状态",
				title: "目标任务",
				subtitle: "打开目标设置框，内容不会作为普通消息发送。",
				placeholder: "",
				submitLabel: "打开目标"
			},
			{
				kind: "chatgpt-pro",
				tag: "@ChatGPT Pro",
				label: "ChatGPT Pro",
				detail: "用专用 Pro 线程生成分析文档",
				title: "ChatGPT Pro 分析",
				subtitle: "输入要交给 ChatGPT Pro 分析的问题；内容不会进入当前工作线程。",
				placeholder: "写清要分析的代码、方案、风险或决策问题。",
				submitLabel: "提交 Pro 分析"
			},
			{
				kind: "loop",
				tag: "@loop",
				label: "Loop",
				detail: "启动当前线程交付循环",
				title: "Loop",
				subtitle: "输入要循环推进的目标；提交后会创建第一张角色任务卡片。",
				placeholder: "写清目标、约束和验收标准。",
				submitLabel: "启动 Loop"
			}
		];
	}
	function composerIntentOption(kind) {
		return composerIntentOptions().find((item) => item.kind === kind) || null;
	}
	function composerIntentDraftKey(kind) {
		return `${currentDraftKey() || (state.currentThreadId ? `thread:${state.currentThreadId}` : "new-thread")}::${String(kind || "").trim()}`;
	}
	function loadComposerIntentDraft(kind) {
		const drafts = loadJsonStorage(STORAGE_COMPOSER_INTENT_DRAFTS, {});
		const key = composerIntentDraftKey(kind);
		return String(drafts && drafts[key] || "");
	}
	function saveComposerIntentDraft(kind, value) {
		const key = composerIntentDraftKey(kind);
		if (!key) return;
		const drafts = loadJsonStorage(STORAGE_COMPOSER_INTENT_DRAFTS, {});
		const text = String(value || "").slice(0, COMPOSER_INTENT_BODY_MAX_CHARS);
		if (text.trim()) drafts[key] = text;
		else delete drafts[key];
		try {
			localStorage.setItem(STORAGE_COMPOSER_INTENT_DRAFTS, JSON.stringify(drafts));
		} catch (err) {
			recordHomeAiDiagnosticFailure({
				category: "task_card_workflow_failed",
				diagnostic_type: action === "reply" ? "task_card_return_failed" : "task_card_action_failed",
				severity_hint: "H2",
				evidence_confidence: .78,
				error_code: diagnosticErrorCode(err, action === "reply" ? "task_card_return_failed" : "task_card_action_failed"),
				context: {
					surface: "task-card",
					action: homeAiDiagnosticReportingApi.boundedToken(action, "mutate", 40),
					thread_hash: diagnosticThreadHash(state.currentThreadId),
					task_hash: diagnosticTaskHash(id)
				},
				counts: { status_code: diagnosticErrorStatus(err) },
				breadcrumbs: [{
					kind: "task-card",
					code: homeAiDiagnosticReportingApi.boundedToken(action, "mutate", 40),
					status: "failed",
					fields: {
						status_code: diagnosticErrorStatus(err),
						task_hash: diagnosticTaskHash(id)
					}
				}]
			});
			showError(err);
		}
	}
	function composerIntentBareTagKind(value) {
		const text = normalizedComposerIntentText(value);
		if (!text || text === "@") return "";
		if (/^@loop$/i.test(text)) return "loop";
		if (THREAD_GOAL_MENTION_PATTERN.test(text)) return "goal";
		if (/^@(?:ChatGPT\s+Pro|ChatGPTPro|GPT\s+Pro)$/i.test(text)) return "chatgpt-pro";
		return "";
	}
	function shouldShowComposerIntentMenu() {
		return normalizedComposerIntentText(composerText()) === "@";
	}
	function closeComposerIntentMenu() {
		const menu = $("composerIntentMenu");
		if (menu) {
			menu.hidden = true;
			menu.innerHTML = "";
		}
		state.composerIntentMenuOpen = false;
		document.removeEventListener("pointerdown", onComposerIntentOutsidePointer);
	}
	function onComposerIntentOutsidePointer(event) {
		const menu = $("composerIntentMenu");
		const target = event.target;
		if (!state.composerIntentMenuOpen || !menu || menu.hidden) return;
		if (menu.contains(target)) return;
		if (target && target.closest && target.closest("#messageInput")) return;
		closeComposerIntentMenu();
	}
	function openComposerIntentMenu() {
		const menu = $("composerIntentMenu");
		if (!menu) return;
		closeComposerRuntimeMenu();
		closeQuotaDetails();
		menu.innerHTML = composerIntentOptions().map((item) => `
    <button type="button" class="composer-intent-option" role="option" data-composer-intent="${escapeHtml(item.kind)}">
      <span class="composer-intent-label">${escapeHtml(item.label)}</span>
      <span class="composer-intent-tag">${escapeHtml(item.tag)}</span>
      <span class="composer-intent-detail">${escapeHtml(item.detail)}</span>
    </button>
  `).join("");
		menu.hidden = false;
		state.composerIntentMenuOpen = true;
		positionComposerIntentMenu();
		document.addEventListener("pointerdown", onComposerIntentOutsidePointer);
	}
	function positionComposerIntentMenu() {
		const menu = $("composerIntentMenu");
		const anchor = $("messageInput") || $("composer");
		if (!menu || menu.hidden || !anchor) return;
		fitComposerPopupToAnchor(menu, anchor, {
			minWidth: 280,
			maxWidth: 420
		});
	}
	function updateComposerIntentMenu() {
		if (shouldShowComposerIntentMenu()) if (!state.composerIntentMenuOpen) openComposerIntentMenu();
		else positionComposerIntentMenu();
		else closeComposerIntentMenu();
	}
	function queueComposerIntentMenuUpdate() {
		window.setTimeout(updateComposerIntentMenu, 0);
	}
	function openSelectedComposerIntentDialog(kind, options = {}) {
		const option = composerIntentOption(kind);
		if (!option) return false;
		if (kind === "goal") {
			if (state.newThreadDraft) {
				showError(/* @__PURE__ */ new Error(`${option.label} is only available in an existing thread`));
				return false;
			}
			if (state.pendingAttachments.length) {
				showError(/* @__PURE__ */ new Error("Goal commands do not support attachments"));
				return false;
			}
			const targetThreadId = currentComposerThreadId();
			if (!targetThreadId || typeof openThreadGoalDialog !== "function") {
				showError(/* @__PURE__ */ new Error("No thread is selected"));
				return false;
			}
			setComposerText("");
			scheduleCurrentDraftSave();
			openThreadGoalDialog(targetThreadId);
			return true;
		}
		return openComposerIntentDialog(kind, options);
	}
	function selectComposerIntent(kind, options = {}) {
		const option = composerIntentOption(kind);
		if (!option) return;
		setComposerText(option.tag);
		closeComposerIntentMenu();
		updateComposerControls();
		scheduleCurrentDraftSave();
		if (options.openDialog === true && openSelectedComposerIntentDialog(kind, options)) return;
		const input = $("messageInput");
		if (input) input.focus();
	}
	function setComposerIntentDialogStatus(message, isError = false) {
		const status = $("composerIntentDialogStatus");
		if (!status) return;
		const text = String(message || "").trim();
		status.textContent = text;
		status.classList.toggle("hidden", !text);
		status.classList.toggle("error", Boolean(isError));
	}
	function closeComposerIntentDialog(clearState = true) {
		const dialog = $("composerIntentDialog");
		if (dialog) dialog.classList.add("hidden");
		if (clearState) {
			state.composerIntentDialogKind = "";
			state.composerIntentDialogBusy = false;
		}
		setComposerIntentDialogStatus("");
		updateComposerControls();
	}
	function openComposerIntentDialog(kind, options = {}) {
		const option = composerIntentOption(kind);
		if (!option) return false;
		if (kind !== "chatgpt-pro" && state.newThreadDraft) {
			showError(/* @__PURE__ */ new Error(`${option.label} is only available in an existing thread`));
			return false;
		}
		if (state.pendingAttachments.length) {
			showError(/* @__PURE__ */ new Error(`${option.tag} does not support attachments in this entry point`));
			return false;
		}
		state.composerIntentDialogKind = kind;
		state.composerIntentDialogBusy = false;
		const title = $("composerIntentDialogTitle");
		const subtitle = $("composerIntentDialogSubtitle");
		const label = $("composerIntentBodyLabel");
		const input = $("composerIntentBodyInput");
		const submit = $("composerIntentSubmitButton");
		if (title) title.textContent = option.title;
		if (subtitle) subtitle.textContent = option.subtitle;
		if (label) label.textContent = option.label;
		if (submit) submit.textContent = option.submitLabel;
		if (input) {
			input.placeholder = option.placeholder;
			input.maxLength = COMPOSER_INTENT_BODY_MAX_CHARS;
			input.value = String(options.initialBody || loadComposerIntentDraft(kind) || "").slice(0, COMPOSER_INTENT_BODY_MAX_CHARS);
		}
		setComposerIntentDialogStatus("");
		const dialog = $("composerIntentDialog");
		if (dialog) dialog.classList.remove("hidden");
		window.setTimeout(() => {
			if (input) input.focus();
		}, 30);
		return true;
	}
	async function submitComposerIntentDialog(event) {
		if (event && typeof event.preventDefault === "function") event.preventDefault();
		if (state.composerIntentDialogBusy || state.composerBusy) return;
		const kind = state.composerIntentDialogKind;
		const option = composerIntentOption(kind);
		if (!option) return;
		const input = $("composerIntentBodyInput");
		const body = String(input && input.value || "").trim();
		if (!body) {
			setComposerIntentDialogStatus("请输入内容。", true);
			return;
		}
		state.composerIntentDialogBusy = true;
		setComposerIntentDialogStatus("提交中…");
		updateComposerControls();
		try {
			let intentResult = null;
			if (kind === "chatgpt-pro") await submitChatGptProRequest(`${option.tag} ${body}`, { rethrow: true });
			else if (kind === "loop") intentResult = await submitAtLoopRequest(`${option.tag} ${body}`, { rethrow: true });
			else if (kind === "task-card" || kind === "task-card-auto") await sendThreadTaskCardCommand(`${option.tag} ${body}`, { rethrow: true });
			saveComposerIntentDraft(kind, "");
			setComposerText("");
			scheduleCurrentDraftSave();
			if (kind === "loop" && intentResult && intentResult.waitingSourceRequirements) {
				if (input) input.value = "";
				setComposerIntentDialogStatus(intentResult.statusText);
				return;
			}
			closeComposerIntentDialog();
		} catch (err) {
			setComposerIntentDialogStatus(normalizeClientErrorMessage(err && err.message ? err.message : String(err), err), true);
			showError(err);
		} finally {
			state.composerIntentDialogBusy = false;
			updateComposerControls();
		}
	}
	function saveComposerIntentDialogDraft() {
		const kind = state.composerIntentDialogKind;
		if (!composerIntentOption(kind)) return;
		const input = $("composerIntentBodyInput");
		saveComposerIntentDraft(kind, input ? input.value : "");
		setComposerIntentDialogStatus("草稿已保存。");
	}
	function shouldKeepAndroidMessageInputEditable(disabled, el) {
		if (!disabled || !isAndroidBrowser()) return false;
		if (!el) return false;
		if (!messageInputCanEnableForNativeGesture()) return false;
		return Boolean(state.composerComposing || document.activeElement === el);
	}
	function setMessageInputDisabled(disabled) {
		const el = $("messageInput");
		if (!el) return;
		const keepAndroidEditorConnection = shouldKeepAndroidMessageInputEditable(disabled, el);
		const nextContentEditable = disabled && !keepAndroidEditorConnection ? "false" : "true";
		const nextAriaDisabled = disabled ? "true" : "false";
		const nextTabIndex = disabled ? -1 : 0;
		const currentContentEditable = String(el.getAttribute("contenteditable") || el.contentEditable || "").toLowerCase();
		const currentAriaDisabled = String(el.getAttribute("aria-disabled") || "").toLowerCase();
		const currentClassDisabled = el.classList.contains("disabled");
		if (currentContentEditable === nextContentEditable && currentAriaDisabled === nextAriaDisabled && el.tabIndex === nextTabIndex && currentClassDisabled === disabled) return;
		if (!((state.composerComposing || keepAndroidEditorConnection) && currentContentEditable === "true") && currentContentEditable !== nextContentEditable) el.contentEditable = nextContentEditable;
		if (currentAriaDisabled !== nextAriaDisabled) el.setAttribute("aria-disabled", nextAriaDisabled);
		if (el.tabIndex !== nextTabIndex) el.tabIndex = nextTabIndex;
		if (currentClassDisabled !== disabled) el.classList.toggle("disabled", disabled);
	}
	function messageInputTextLength(el) {
		return String(el && (el.textContent || el.innerText) || "").length;
	}
	function messageInputTargetHeight(el) {
		const scrollHeight = viewportMetrics.cssPixel(el && el.scrollHeight);
		return Math.min(MESSAGE_INPUT_MAX_HEIGHT_PX, Math.max(MESSAGE_INPUT_MIN_HEIGHT_PX, scrollHeight));
	}
	function currentMessageInputHeight(el) {
		const inlineHeight = Number.parseFloat(el && el.style && el.style.height || "");
		return viewportMetrics.cssPixel(inlineHeight || el && el.getBoundingClientRect && el.getBoundingClientRect().height || 0);
	}
	function updateMessageInputOverflow(el, heightPx) {
		if (!el || !el.style) return;
		el.style.overflowY = el.scrollHeight > heightPx + 1 ? "auto" : "hidden";
	}
	function autoSizeMessageInput(el, options = {}) {
		if (!el) return false;
		const force = options.force === true;
		const previousTextLength = Number(state.messageInputTextLength || 0);
		const nextTextLength = messageInputTextLength(el);
		const currentHeight = currentMessageInputHeight(el);
		let nextHeight = messageInputTargetHeight(el);
		if (force || nextTextLength < previousTextLength) {
			const previousInlineHeight = el.style.height;
			el.style.height = "auto";
			nextHeight = messageInputTargetHeight(el);
			if (!force && currentHeight && !viewportMetrics.stablePixelChanged(currentHeight, nextHeight)) {
				el.style.height = previousInlineHeight;
				state.messageInputTextLength = nextTextLength;
				updateMessageInputOverflow(el, currentHeight);
				return false;
			}
		}
		state.messageInputTextLength = nextTextLength;
		if (!force && currentHeight && !viewportMetrics.stablePixelChanged(currentHeight, nextHeight)) {
			updateMessageInputOverflow(el, currentHeight);
			return false;
		}
		state.messageInputHeightPx = nextHeight;
		el.style.height = `${nextHeight}px`;
		updateMessageInputOverflow(el, nextHeight);
		updateComposerHeightVar();
		return true;
	}
	function formatFileSize(bytes) {
		if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}
	function appendLocalAttachmentSummary(text, attachments) {
		if (!attachments.length) return text;
		const lines = attachments.map((item) => {
			const file = item.file;
			const kind = file.type && file.type.startsWith("image/") ? "image" : "file";
			return `- ${file.name || "upload"} (${kind}, ${file.type || "file"}, ${formatFileSize(file.size || 0)}): ${file.name || "upload"}`;
		});
		return `${text ? `${text}\n\n` : ""}Uploaded attachments:\n${lines.join("\n")}`;
	}
	function localImageInputPartsForAttachments(attachments) {
		return (attachments || []).map((item) => {
			const file = item && item.file;
			if (!file) return null;
			const previewUrl = localAttachmentPreviewUrl(item);
			if (!previewUrl) return null;
			const name = String(file.name || "upload");
			if (!(String(file.type || "").toLowerCase().startsWith("image/") || /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)$/i.test(name))) return null;
			return {
				type: "input_image",
				image_url: { url: previewUrl },
				fileName: name
			};
		}).filter(Boolean);
	}
	function localUserMessageItem(text, attachments, clientSubmissionId) {
		const content = [{
			type: "text",
			text: appendLocalAttachmentSummary(text, attachments),
			text_elements: []
		}];
		content.push(...localImageInputPartsForAttachments(attachments));
		return {
			id: `local-user-${clientSubmissionId || Date.now()}`,
			type: "userMessage",
			mobilePendingSubmission: true,
			clientSubmissionId: clientSubmissionId || "",
			startedAtMs: Date.now(),
			content
		};
	}
	function attachmentId() {
		if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
		return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	}
	function pendingAttachmentBytes(extra = []) {
		return state.pendingAttachments.reduce((total, item) => total + item.file.size, 0) + extra.reduce((total, file) => total + file.size, 0);
	}
	async function prepareAttachmentFile(file) {
		if (!imageCompressor || typeof imageCompressor.compressImageFile !== "function") return file;
		try {
			return await imageCompressor.compressImageFile(file);
		} catch (err) {
			postClientEvent("attachment_image_compression_failed", {
				name: file && file.name ? String(file.name).slice(0, 120) : "",
				type: file && file.type ? String(file.type).slice(0, 80) : "",
				size: file && Number.isFinite(file.size) ? Number(file.size) : 0,
				message: err && err.message ? err.message : String(err)
			});
			return file;
		}
	}
	async function prepareAttachmentFiles(files) {
		const prepared = [];
		for (const file of files) prepared.push(await prepareAttachmentFile(file));
		return prepared;
	}
	async function addAttachmentFiles(fileList) {
		const files = Array.from(fileList || []).filter(Boolean);
		if (!files.length) return;
		state.attachmentProcessingCount += 1;
		updateComposerControls();
		let preparedFiles = files;
		try {
			preparedFiles = await prepareAttachmentFiles(files);
		} finally {
			state.attachmentProcessingCount = Math.max(0, state.attachmentProcessingCount - 1);
			updateComposerControls();
		}
		const draftKey = currentDraftKey();
		const startIndex = state.pendingAttachments.length;
		const accepted = [];
		for (const file of preparedFiles) {
			if (state.pendingAttachments.length + accepted.length >= state.maxUploadFiles) {
				showError(/* @__PURE__ */ new Error(`Too many attachments; max ${state.maxUploadFiles}`));
				break;
			}
			if (pendingAttachmentBytes(accepted.concat(file)) > state.maxUploadBytes) {
				showError(/* @__PURE__ */ new Error(`Attachments are too large; max ${formatFileSize(state.maxUploadBytes)}`));
				break;
			}
			accepted.push(file);
		}
		for (const file of accepted) {
			const previewUrl = file.type && file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
			state.pendingAttachments.push({
				id: attachmentId(),
				file,
				previewUrl
			});
		}
		renderAttachmentList();
		const addedItems = state.pendingAttachments.slice(startIndex);
		if (draftKey) saveDraftAttachmentFiles(draftKey, addedItems);
		scheduleCurrentDraftSave();
	}
	function removeAttachment(id) {
		const draftKey = currentDraftKey();
		const index = state.pendingAttachments.findIndex((item) => item.id === id);
		if (index < 0) return;
		const [item] = state.pendingAttachments.splice(index, 1);
		if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
		renderAttachmentList();
		if (draftKey) deleteDraftAttachments(draftKey, [id]).catch((err) => {
			postClientEvent("draft_attachment_remove_failed", { message: err.message || String(err) });
		});
		scheduleCurrentDraftSave();
	}
	function clearPendingAttachments(options = {}) {
		const draftKey = currentDraftKey();
		const attachmentsToReleaseLater = options.revokePreviewUrls === false ? state.pendingAttachments.slice() : [];
		replacePendingAttachments([], {
			saveDraft: false,
			revokePreviewUrls: options.revokePreviewUrls
		});
		if (attachmentsToReleaseLater.length) scheduleAttachmentPreviewUrlRevoke(attachmentsToReleaseLater);
		if (options.deleteDraft !== false && draftKey) deleteDraftAttachments(draftKey).catch((err) => {
			postClientEvent("draft_attachment_clear_failed", { message: err.message || String(err) });
		});
	}
	function renderAttachmentList() {
		const list = $("attachmentList");
		if (!state.pendingAttachments.length) {
			list.classList.add("hidden");
			list.innerHTML = "";
			updateComposerControls();
			updateComposerHeightVar();
			return;
		}
		list.classList.remove("hidden");
		list.innerHTML = state.pendingAttachments.map((item) => {
			const file = item.file;
			const thumb = item.previewUrl ? `<img class="attachment-thumb" src="${escapeHtml(item.previewUrl)}" alt="">` : `<div class="attachment-file-icon" aria-hidden="true"></div>`;
			return `<div class="attachment-chip" data-attachment="${escapeHtml(item.id)}">
      ${thumb}
      <div class="attachment-meta">
        <div class="attachment-name">${escapeHtml(file.name || "upload")}</div>
        <div class="attachment-size">${escapeHtml(`${file.type || "file"} - ${formatFileSize(file.size)}`)}</div>
      </div>
      <button class="attachment-remove" type="button" title="Remove attachment" data-remove-attachment="${escapeHtml(item.id)}">x</button>
    </div>`;
		}).join("");
		updateComposerControls();
		updateComposerHeightVar();
	}
	function composerHasContent() {
		return Boolean(composerText() || state.pendingAttachments.length);
	}
	function effectiveDefaultModel(thread = composerTargetThread()) {
		return thread && thread.model || state.defaultModel || "";
	}
	function effectiveDefaultEffort(thread = composerTargetThread()) {
		return thread && thread.effort || state.defaultReasoningEffort || "";
	}
	function effectiveDefaultPermissionMode(thread = composerTargetThread()) {
		const settings = thread && thread.runtimeSettings;
		if (String(settings && settings.sandboxPolicyType || "").replace(/[-_]/g, "").toLowerCase() === "dangerfullaccess") return "full";
		return effectiveComposerPermissionMode(settings && settings.permissionMode || "");
	}
	function selectedComposerModel() {
		if (state.newThreadDraft) return newThreadSelectedModel();
		return state.composerModel || effectiveDefaultModel();
	}
	function selectedComposerEffort() {
		if (state.newThreadDraft) return newThreadSelectedEffort();
		return state.composerEffort || effectiveDefaultEffort();
	}
	function selectedComposerPermissionMode() {
		if (state.newThreadDraft) return newThreadSelectedPermissionMode();
		return effectiveComposerPermissionMode(state.composerPermissionMode || effectiveDefaultPermissionMode()) || defaultNewThreadPermissionMode();
	}
	function resetComposerRuntimeSelection() {
		state.composerModel = "";
		state.composerEffort = "";
		state.composerPermissionMode = "";
		state.codexFastMode = false;
		closeComposerRuntimeMenu();
		closeComposerIntentMenu();
		state.quotaDetailsOpen = false;
	}
	function runtimeOptionValues(kind) {
		if (kind === "model") return normalizeOptionList([
			selectedComposerModel(),
			state.defaultModel,
			...state.modelOptions
		]);
		if (kind === "effort") return normalizeOptionList([
			selectedComposerEffort(),
			state.defaultReasoningEffort,
			...state.reasoningEffortOptions
		]);
		if (kind === "permission") return normalizeOptionList([
			selectedComposerPermissionMode(),
			defaultNewThreadPermissionMode(),
			...state.permissionModeOptions
		]);
		return [];
	}
	function runtimeOptionLabel(kind, value) {
		if (kind === "model") return labelForModel(value);
		if (kind === "effort") return labelForEffort(value);
		if (kind === "permission") return labelForPermissionMode(value);
		return value;
	}
	function runtimeSelectedValue(kind) {
		if (kind === "model") return selectedComposerModel();
		if (kind === "effort") return selectedComposerEffort();
		if (kind === "permission") return selectedComposerPermissionMode();
		return "";
	}
	function codexFastCommandEnabled() {
		return Boolean(state.codexFastMode);
	}
	function clearLegacyCodexFastModeStorage() {
		try {
			localStorage.removeItem(STORAGE_CODEX_FAST_MODE);
		} catch (_) {}
	}
	function setCodexFastCommandEnabled(enabled) {
		state.codexFastMode = Boolean(enabled);
		clearLegacyCodexFastModeStorage();
		renderComposerSettings();
		updateComposerControls();
		saveCurrentDraftNow();
		showComposerFastHint(state.codexFastMode);
	}
	function applyRuntimeSelection(kind, value) {
		const selected = String(value || "").trim();
		if (!selected) return;
		if (state.newThreadDraft) {
			if (kind === "model") state.newThreadModel = selected;
			if (kind === "effort") state.newThreadEffort = selected;
			if (kind === "permission") state.newThreadPermissionMode = effectiveComposerPermissionMode(selected) || defaultNewThreadPermissionMode();
		} else {
			if (kind === "model") state.composerModel = selected;
			if (kind === "effort") state.composerEffort = selected;
			if (kind === "permission") state.composerPermissionMode = effectiveComposerPermissionMode(selected) || defaultNewThreadPermissionMode();
		}
		closeComposerRuntimeMenu();
		renderComposerSettings();
		updateComposerControls();
		saveCurrentDraftNow();
	}
	function closeComposerRuntimeMenu() {
		const menu = $("composerRuntimeMenu");
		if (menu) {
			menu.hidden = true;
			menu.innerHTML = "";
		}
		for (const id of [
			"composerModelControl",
			"composerEffortControl",
			"composerPermissionControl"
		]) {
			const button = $(id);
			if (button) button.setAttribute("aria-expanded", "false");
		}
		state.composerMenuKind = "";
		document.removeEventListener("pointerdown", onComposerRuntimeOutsidePointer);
	}
	function onComposerRuntimeOutsidePointer(event) {
		const menu = $("composerRuntimeMenu");
		const target = event.target;
		if (!menu || menu.hidden) return;
		if (menu.contains(target)) return;
		if (target && target.closest && target.closest("[data-composer-runtime]")) return;
		closeComposerRuntimeMenu();
	}
	function openComposerRuntimeMenu(kind, anchor) {
		const menu = $("composerRuntimeMenu");
		if (!menu || !anchor) return;
		closeComposerIntentMenu();
		state.quotaDetailsOpen = false;
		const selected = runtimeSelectedValue(kind);
		menu.innerHTML = runtimeOptionValues(kind).map((value) => {
			return `<button type="button" class="composer-runtime-option${value === selected ? " is-selected" : ""}" role="option" aria-selected="${value === selected ? "true" : "false"}" data-runtime-kind="${escapeHtml(kind)}" data-runtime-value="${escapeHtml(value)}">${escapeHtml(runtimeOptionLabel(kind, value))}</button>`;
		}).join("");
		menu.hidden = false;
		state.composerMenuKind = kind;
		for (const id of [
			"composerModelControl",
			"composerEffortControl",
			"composerPermissionControl"
		]) {
			const button = $(id);
			if (button) button.setAttribute("aria-expanded", button === anchor ? "true" : "false");
		}
		fitComposerPopupToAnchor(menu, anchor);
		document.addEventListener("pointerdown", onComposerRuntimeOutsidePointer);
	}
	function composerRuntimeMenuDiagnostics(kind, triggerType) {
		const menu = $("composerRuntimeMenu");
		const rect = menu && !menu.hidden ? menu.getBoundingClientRect() : null;
		const visualViewport = window.visualViewport;
		const viewportWidth = Math.round(visualViewport && visualViewport.width || window.innerWidth || 0);
		const viewportHeight = Math.round(visualViewport && visualViewport.height || window.innerHeight || 0);
		return {
			kind,
			triggerType,
			menuHidden: !menu || menu.hidden,
			optionCount: menu ? menu.querySelectorAll("[data-runtime-kind][data-runtime-value]").length : 0,
			top: rect ? Math.round(rect.top) : null,
			bottom: rect ? Math.round(rect.bottom) : null,
			left: rect ? Math.round(rect.left) : null,
			right: rect ? Math.round(rect.right) : null,
			viewportWidth,
			viewportHeight,
			visible: Boolean(rect && rect.bottom > 0 && rect.top < viewportHeight && rect.right > 0 && rect.left < viewportWidth)
		};
	}
	function reportComposerRuntimeMenu(kind, triggerType) {
		(typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame.bind(window) : (callback) => window.setTimeout(callback, 0))(() => postClientEvent("composer_runtime_menu_opened", composerRuntimeMenuDiagnostics(kind, triggerType)));
	}
	function handleComposerRuntimeControl(event, kind, button) {
		event.preventDefault();
		event.stopPropagation();
		if (button.disabled) {
			postClientEvent("composer_runtime_control_ignored", {
				kind,
				triggerType: event.type,
				reason: "disabled"
			});
			return;
		}
		if (state.composerMenuKind === kind) {
			closeComposerRuntimeMenu();
			postClientEvent("composer_runtime_menu_closed", {
				kind,
				triggerType: event.type
			});
		} else {
			openComposerRuntimeMenu(kind, button);
			reportComposerRuntimeMenu(kind, event.type);
		}
	}
	function fitComposerPopupToAnchor(panel, anchor, options = {}) {
		const minWidth = Number(options.minWidth || 180);
		const maxWidth = Number(options.maxWidth || 280);
		const visualViewport = window.visualViewport;
		const viewportLeft = visualViewport ? Number(visualViewport.offsetLeft || 0) : 0;
		const viewportTop = visualViewport ? Number(visualViewport.offsetTop || 0) : 0;
		const viewportWidth = Math.max(1, Math.floor(visualViewport && visualViewport.width || window.innerWidth || document.documentElement.clientWidth || maxWidth));
		const viewportHeight = Math.max(1, Math.floor(visualViewport && visualViewport.height || window.innerHeight || document.documentElement.clientHeight || 360));
		const rawRect = anchor && typeof anchor.getBoundingClientRect === "function" ? anchor.getBoundingClientRect() : null;
		const rawVisible = Boolean(rawRect && rawRect.width > 0 && rawRect.height > 0 && rawRect.right > viewportLeft && rawRect.left < viewportLeft + viewportWidth && rawRect.bottom > viewportTop && rawRect.top < viewportTop + viewportHeight);
		const fallbackAnchorWidth = Math.min(128, Math.max(48, viewportWidth - 24));
		const fallbackAnchorHeight = 30;
		const fallbackAnchorBottom = Math.max(64, Math.min(96, viewportHeight * .18));
		const rect = rawVisible ? rawRect : {
			left: viewportLeft + viewportWidth - fallbackAnchorWidth - 12,
			right: viewportLeft + viewportWidth - 12,
			top: viewportTop + viewportHeight - fallbackAnchorBottom - fallbackAnchorHeight,
			bottom: viewportTop + viewportHeight - fallbackAnchorBottom,
			width: fallbackAnchorWidth,
			height: fallbackAnchorHeight
		};
		const width = Math.max(minWidth, Math.min(maxWidth, viewportWidth - 16, Math.max(rect.width, minWidth)));
		const left = Math.max(viewportLeft + 8, Math.min(viewportLeft + viewportWidth - width - 8, rect.left));
		const anchorTop = Math.max(viewportTop + 8, Math.min(viewportTop + viewportHeight - 8, rect.top));
		const availableAbove = Math.max(96, anchorTop - viewportTop - 12);
		const bottom = Math.max(8, viewportTop + viewportHeight - anchorTop + 6);
		panel.style.setProperty("--composer-popup-left", `${Math.round(left)}px`);
		panel.style.setProperty("--composer-popup-bottom", `${Math.round(bottom)}px`);
		panel.style.setProperty("--composer-popup-width", `${Math.round(width)}px`);
		panel.style.setProperty("--composer-popup-max-height", `${Math.round(Math.min(360, availableAbove))}px`);
	}
	function closeQuotaDetails() {
		state.quotaDetailsOpen = false;
		const panel = $("quotaDetailPanel");
		if (panel) {
			panel.hidden = true;
			panel.innerHTML = "";
		}
		const quota = $("quotaUsage");
		if (quota) quota.setAttribute("aria-expanded", "false");
		document.removeEventListener("pointerdown", onQuotaOutsidePointer);
	}
	function onQuotaOutsidePointer(event) {
		const panel = $("quotaDetailPanel");
		const quota = $("quotaUsage");
		const target = event.target;
		if (!state.quotaDetailsOpen) return;
		if (panel && panel.contains(target) || quota && quota.contains(target)) return;
		closeQuotaDetails();
	}
	function toggleQuotaDetails(anchor) {
		closeComposerRuntimeMenu();
		state.quotaDetailsOpen = !state.quotaDetailsOpen;
		renderQuotaUsage();
		const panel = $("quotaDetailPanel");
		if (state.quotaDetailsOpen && panel && anchor) {
			fitComposerPopupToAnchor(panel, anchor, {
				minWidth: 320,
				maxWidth: 390
			});
			document.addEventListener("pointerdown", onQuotaOutsidePointer);
		} else document.removeEventListener("pointerdown", onQuotaOutsidePointer);
	}
	function composerPlaceholderText() {
		const targetThreadId = currentComposerThreadId();
		const targetThread = composerTargetThread();
		return threadTileStatePolicy.composerTargetPlaceholderPlan({
			newThreadDraft: state.newThreadDraft,
			tileContext: isThreadTileComposerContext(),
			targetThreadId,
			hasTargetThread: Boolean(targetThread),
			targetTitle: targetThread ? threadDisplayName(targetThread) : "",
			newThreadPlaceholder: "输入第一条消息",
			defaultPlaceholder: "Message Codex"
		}).text;
	}
	function composerShowsTargetPlaceholder() {
		const targetThreadId = currentComposerThreadId();
		const targetThread = composerTargetThread();
		return threadTileStatePolicy.composerTargetPlaceholderPlan({
			newThreadDraft: state.newThreadDraft,
			tileContext: isThreadTileComposerContext(),
			targetThreadId,
			hasTargetThread: Boolean(targetThread)
		}).showTargetPlaceholder === true;
	}
	function applyComposerActionControlPlan(sendButton, plan) {
		if (!sendButton || !plan) return;
		setComposerActionButtonLabel(sendButton, plan.label || "Send", { proxy: plan.labelProxy === true });
		sendButton.title = plan.title || "";
		const classState = plan.classState || {};
		sendButton.classList.toggle("interrupt-mode", classState.interruptMode === true);
		sendButton.classList.toggle("sending", classState.sending === true);
		sendButton.classList.toggle("send-failed", classState.sendFailed === true);
		sendButton.classList.toggle("steer-mode", classState.steerMode === true);
		sendButton.classList.toggle("plugin-voice-input-gesture", classState.pluginVoiceInputGesture === true);
		if (plan.ariaLabel) sendButton.setAttribute("aria-label", plan.ariaLabel);
		else sendButton.removeAttribute("aria-label");
		sendButton.disabled = plan.sendButtonDisabled === true;
	}
	function renderComposerSettings() {
		const commandControl = $("composerCommandControl");
		const modelControl = $("composerModelControl");
		const effortControl = $("composerEffortControl");
		const permissionControl = $("composerPermissionControl");
		if (!commandControl || !modelControl || !effortControl || !permissionControl) return;
		const selectedModel = selectedComposerModel();
		const selectedEffort = selectedComposerEffort();
		const selectedPermission = selectedComposerPermissionMode();
		const fastEnabled = codexFastCommandEnabled();
		const fastScopeLabel = state.newThreadDraft ? "this new thread" : "this thread";
		commandControl.classList.toggle("is-fast", fastEnabled);
		commandControl.setAttribute("aria-pressed", fastEnabled ? "true" : "false");
		commandControl.title = fastEnabled ? `Fast tag on for ${fastScopeLabel}` : `Fast tag off for ${fastScopeLabel}`;
		commandControl.setAttribute("aria-label", fastEnabled ? `Fast tag on for ${fastScopeLabel}` : `Fast tag off for ${fastScopeLabel}`);
		commandControl.disabled = state.composerBusy;
		const controls = [
			[
				modelControl,
				selectedModel ? labelForModel(selectedModel) : "--",
				state.newThreadDraft || state.composerModel ? "下一轮使用" : "当前记录"
			],
			[
				effortControl,
				selectedEffort ? labelForEffort(selectedEffort) : "--",
				state.newThreadDraft || state.composerEffort ? "下一轮使用" : "当前记录"
			],
			[
				permissionControl,
				selectedPermission ? labelForPermissionMode(selectedPermission).replace(/权限$/, "") : "--",
				state.newThreadDraft || state.composerPermissionMode ? "下一轮使用" : "当前记录"
			]
		];
		for (const [button, value, mode] of controls) {
			const valueEl = button.querySelector(".composer-chip-value");
			if (valueEl) valueEl.textContent = value;
			button.title = `${button.querySelector(".composer-chip-label")?.textContent || ""}：${value}（${mode}）`;
			button.classList.toggle("has-pending-value", mode === "下一轮使用");
			button.disabled = state.composerBusy;
		}
		renderQuotaUsage();
	}
	function updateComposerControls() {
		const targetThreadId = currentComposerThreadId();
		const targetThread = composerTargetThread();
		const targetActiveTurnId = composerTargetActiveTurnId();
		const hasThread = Boolean(targetThreadId && targetThread && !targetThread.mobileLoading && !targetThread.mobileLoadError);
		const hasNewThreadDraft = Boolean(state.newThreadDraft);
		const hasContent = composerHasContent();
		const bareIntentKind = composerIntentBareTagKind(composerText());
		const goalCommandMode = Boolean(!hasNewThreadDraft && isThreadGoalCommandText(composerText()));
		const commandMode = Boolean(!hasNewThreadDraft && isThreadTaskCardCommandText(composerText()));
		const voiceGestureAvailable = pluginVoiceInputGestureAvailable();
		const bareIntentOption = bareIntentKind ? composerIntentOption(bareIntentKind) : null;
		const composerActionPlan = threadTileStatePolicy.composerActionControlPlan({
			hasThread,
			hasNewThreadDraft,
			composerBusy: state.composerBusy,
			attachmentProcessingCount: state.attachmentProcessingCount,
			hasContent,
			targetActiveTurnId,
			bareIntentKind,
			bareIntentTitle: bareIntentOption ? `Open ${bareIntentOption.label}` : "Open composer action",
			goalCommandMode,
			commandMode,
			sendButtonHint: state.sendButtonHint,
			steeringBusy: Boolean(state.steerFeedback && state.steerFeedback.status === "sending"),
			voiceGestureAvailable,
			hermesEmbedMode: isHermesEmbedMode()
		});
		const disabled = composerActionPlan.disabled === true;
		const sendButton = $("sendMessage");
		const attachButton = $("attachFiles");
		const messageInput = $("messageInput");
		for (const id of [
			"composerIntentBodyInput",
			"composerIntentSubmitButton",
			"composerIntentSaveButton"
		]) {
			const el = $(id);
			if (el) el.disabled = state.composerIntentDialogBusy || state.composerBusy;
		}
		if (messageInput) {
			messageInput.dataset.placeholder = composerPlaceholderText();
			messageInput.classList.toggle("has-target-placeholder", composerShowsTargetPlaceholder());
		}
		setMessageInputDisabled(disabled);
		$("fileInput").disabled = disabled;
		attachButton.disabled = disabled;
		attachButton.classList.toggle("disabled", disabled);
		attachButton.setAttribute("aria-disabled", disabled ? "true" : "false");
		attachButton.tabIndex = disabled ? -1 : 0;
		for (const id of [
			"composerCommandControl",
			"composerModelControl",
			"composerEffortControl",
			"composerPermissionControl",
			"quotaUsage"
		]) {
			const button = $(id);
			if (button) button.disabled = disabled;
		}
		applyComposerActionControlPlan(sendButton, composerActionPlan);
		publishPluginVoiceInputCapability();
	}
	function hasTransferFiles(event) {
		return Array.from(event.dataTransfer && event.dataTransfer.types || []).includes("Files");
	}
	function goalDialogFormValues(options = {}) {
		const requireObjective = options.requireObjective !== false;
		const thread = currentGoalDialogThread();
		const threadId = String(thread && thread.id || state.goalDialogThreadId || "").trim();
		const objectiveInput = $("goalObjectiveInput");
		const budgetInput = $("goalTokenBudgetInput");
		const objective = String(objectiveInput && objectiveInput.value || "").trim();
		const rawBudget = String(budgetInput && budgetInput.value || "").trim();
		if (!threadId) {
			showError(/* @__PURE__ */ new Error("No thread is selected"));
			return null;
		}
		if (requireObjective && !objective) {
			showError(/* @__PURE__ */ new Error("Goal objective is required"));
			if (objectiveInput) objectiveInput.focus();
			return null;
		}
		let tokenBudget = 0;
		if (rawBudget) {
			tokenBudget = Number(rawBudget);
			if (!Number.isFinite(tokenBudget) || tokenBudget <= 0) {
				showError(/* @__PURE__ */ new Error("Token budget must be a positive number"));
				if (budgetInput) budgetInput.focus();
				return null;
			}
			tokenBudget = Math.trunc(tokenBudget);
		}
		return {
			thread,
			threadId,
			objective,
			tokenBudget: tokenBudget > 0 ? tokenBudget : null
		};
	}
	async function submitThreadGoalMessage(event) {
		if (event && typeof event.preventDefault === "function") event.preventDefault();
		if (state.goalSubmitBusy || state.composerBusy) {
			if (state.composerBusy) showError(/* @__PURE__ */ new Error("A message is already sending"));
			return;
		}
		const values = goalDialogFormValues();
		if (!values) return;
		const { threadId, objective, tokenBudget } = values;
		state.composerBusy = true;
		state.sendButtonHint = "";
		setThreadGoalDialogBusy(true, "Saving...");
		markActivity("Goal set");
		updateComposerControls();
		try {
			postClientEvent("goal_request_start", { threadId });
			const result = await api(`/api/threads/${encodeURIComponent(threadId)}/goal`, {
				method: "POST",
				body: JSON.stringify({
					objective,
					tokenBudget
				}),
				timeoutMs: 3e4
			});
			const responseGoal = normalizeThreadGoal(result && result.goal, threadId);
			const visibleGoal = responseGoal || submittedThreadGoal(threadId, objective, tokenBudget);
			if (visibleGoal) updateThreadGoalState(threadId, visibleGoal);
			closeThreadGoalDialog(true);
			$("connectionState").classList.remove("error");
			$("connectionState").textContent = "Goal set";
			markActivity("Goal set");
			postClientEvent("goal_request_success", {
				threadId,
				hasResponseGoal: Boolean(responseGoal)
			});
			if (threadId === state.currentThreadId) scheduleCurrentThreadRefresh(600);
			loadThreads({ silent: true }).catch(showError);
		} catch (err) {
			const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err)) || "Goal set failed";
			$("connectionState").classList.add("error");
			$("connectionState").textContent = message;
			postClientEvent("goal_request_failure", {
				threadId,
				message
			});
			showError(new Error(message));
		} finally {
			state.composerBusy = false;
			setThreadGoalDialogBusy(false);
			updateComposerControls();
		}
	}
	function threadGoalActionStatusText(action) {
		if (action === "continue") return "Goal continued";
		if (action === "pause") return "Goal paused";
		if (action === "cancel") return "Goal cancelled";
		return "Goal updated";
	}
	function threadGoalActionBusyText(action) {
		if (action === "continue") return "Continuing...";
		if (action === "pause") return "Pausing...";
		if (action === "cancel") return "Cancelling...";
		return "Sending...";
	}
	async function runThreadGoalDialogAction(action, event) {
		if (event && typeof event.preventDefault === "function") event.preventDefault();
		if (event && typeof event.stopPropagation === "function") event.stopPropagation();
		if (state.goalSubmitBusy || state.composerBusy) {
			if (state.composerBusy) showError(/* @__PURE__ */ new Error("A message is already sending"));
			return;
		}
		const normalizedAction = String(action || "").trim().toLowerCase();
		const values = goalDialogFormValues({ requireObjective: normalizedAction !== "cancel" });
		if (!values) return;
		const { threadId, objective, tokenBudget } = values;
		state.composerBusy = true;
		state.sendButtonHint = "";
		setThreadGoalDialogBusy(true, threadGoalActionBusyText(normalizedAction));
		markActivity("Goal action");
		updateComposerControls();
		try {
			postClientEvent("goal_action_start", {
				threadId,
				action: normalizedAction
			});
			const result = await api(`/api/threads/${encodeURIComponent(threadId)}/goal/actions`, {
				method: "POST",
				body: JSON.stringify({
					action: normalizedAction,
					objective: objective || void 0,
					tokenBudget
				}),
				timeoutMs: 3e4
			});
			const responseGoal = normalizeThreadGoal(result && result.goal, threadId);
			if (normalizedAction === "cancel") updateThreadGoalState(threadId, null);
			else if (responseGoal) updateThreadGoalState(threadId, responseGoal);
			else if (objective) updateThreadGoalState(threadId, submittedThreadGoal(threadId, objective, tokenBudget));
			closeThreadGoalDialog(true);
			$("connectionState").classList.remove("error");
			$("connectionState").textContent = threadGoalActionStatusText(normalizedAction);
			markActivity(threadGoalActionStatusText(normalizedAction));
			postClientEvent("goal_action_success", {
				threadId,
				action: normalizedAction,
				hasResponseGoal: Boolean(responseGoal)
			});
			if (threadId === state.currentThreadId) scheduleCurrentThreadRefresh(600);
			loadThreads({ silent: true }).catch(showError);
		} catch (err) {
			const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err)) || "Goal action failed";
			$("connectionState").classList.add("error");
			$("connectionState").textContent = message;
			postClientEvent("goal_action_failure", {
				threadId,
				action: normalizedAction,
				message
			});
			showError(new Error(message));
		} finally {
			state.composerBusy = false;
			setThreadGoalDialogBusy(false);
			updateComposerControls();
		}
	}
	function requestGoalDialogSubmitFromEnter(event) {
		if (!event || event.key !== "Enter" || event.shiftKey || event.isComposing) return;
		if (state.goalSubmitBusy || state.composerBusy) return;
		event.preventDefault();
		event.stopPropagation();
		requestGoalDialogSubmit();
	}
	function requestGoalDialogSubmitFromButton(event) {
		if (event && typeof event.preventDefault === "function") event.preventDefault();
		if (event && typeof event.stopPropagation === "function") event.stopPropagation();
		const now = Date.now();
		if (now - state.lastGoalButtonSubmitAt < 650) return;
		state.lastGoalButtonSubmitAt = now;
		const button = $("goalSubmitButton");
		if (button && button.disabled) return;
		postClientEvent("goal_button_pressed", {
			threadId: state.goalDialogThreadId || state.currentThreadId || "",
			eventType: event && event.type || ""
		});
		requestGoalDialogSubmit();
	}
	function requestGoalDialogSubmit() {
		const form = $("goalForm");
		if (form && typeof form.requestSubmit === "function") form.requestSubmit();
		else submitThreadGoalMessage().catch(showError);
	}
	async function sendThreadTaskCardCommand(commandText, options = {}) {
		const text = String(commandText || "").trim();
		const targetThreadId = currentComposerThreadId();
		const targetThread = composerTargetThread();
		if (!text || !targetThreadId) return false;
		if (state.pendingAttachments.length) {
			const err = /* @__PURE__ */ new Error("Task-card commands do not support attachments yet");
			showError(err);
			if (options.rethrow) throw err;
			return false;
		}
		const submittedDraftKey = currentDraftKey();
		const clientSubmissionId = createSubmissionId();
		const outboundText = buildThreadTaskCardDraftRequestText(text, targetThread);
		state.composerBusy = true;
		state.sendButtonHint = "";
		startSendProgressWatchdog(targetThreadId);
		markActivity("任务卡片");
		updateComposerControls();
		if (state.sendProgressWarned) {
			$("connectionState").textContent = "Task card draft request";
			$("connectionState").classList.remove("error");
		}
		try {
			const body = new FormData();
			body.append("clientSubmissionId", clientSubmissionId);
			body.append("text", outboundText);
			if (targetThread && targetThread.cwd) body.append("cwd", targetThread.cwd);
			body.append("model", selectedComposerModel());
			body.append("effort", selectedComposerEffort());
			body.append("permissionMode", selectedComposerPermissionMode());
			if (codexFastCommandEnabled()) body.append("fastMode", "1");
			registerSubmittedUserMessage(targetThreadId, outboundText, [], clientSubmissionId);
			const insertedLocalMessage = insertLocalSubmittedUserMessage(targetThreadId, outboundText, [], clientSubmissionId);
			markThreadOptimisticallyActive(targetThreadId);
			renderThreads();
			if (insertedLocalMessage) renderCurrentThread({ stickToBottom: true });
			scheduleSubmittedMessageDomProbe(targetThreadId, clientSubmissionId, "task-card-submit");
			followSubmittedMessageToBottom(targetThreadId, clientSubmissionId);
			const result = await api(`/api/threads/${encodeURIComponent(targetThreadId)}/messages`, {
				method: "POST",
				body,
				timeoutMs: 18e4
			});
			const serverTurnId = startedTurnId(result);
			if (serverTurnId && reconcileSubmittedUserMessageTurn(targetThreadId, clientSubmissionId, serverTurnId)) renderCurrentThread({ stickToBottom: true });
			commitPluginVoiceInputSessionsAfterSend(submittedDraftKey, text, {
				threadId: targetThreadId,
				messageId: clientSubmissionId,
				composerId: "thread-composer"
			});
			setComposerText("");
			writeCurrentDraftToKey(submittedDraftKey);
			$("connectionState").classList.remove("error");
			$("connectionState").textContent = "Task card draft requested";
			markActivity("草案已请求");
			recordHomeAiDiagnosticSuccess({
				category: "task_card_workflow_failed",
				diagnostic_type: "task_card_draft_request_failed",
				error_code: "task_card_draft_request_failed",
				context: {
					surface: "task-card",
					action: "draft-request",
					thread_hash: diagnosticThreadHash(targetThreadId)
				}
			});
			scheduleComposerTargetRefresh(targetThreadId, 600, "task-card-submit");
			scheduleLivePollIfNeeded(1200);
			loadThreads({ silent: true }).catch(showError);
			return true;
		} catch (err) {
			clearSubmittedMessageBottomFollow();
			const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err), err) || "任务卡片提交失败，请重试";
			state.sendButtonHint = "重试";
			markSubmittedUserMessageFailed(targetThreadId, outboundText, [], clientSubmissionId, message);
			$("connectionState").classList.remove("error");
			$("connectionState").textContent = "发送失败，详情见消息回执";
			postClientEvent("send_failure", {
				threadId: targetThreadId || "",
				message,
				steering: false,
				taskCardCommand: true
			});
			recordHomeAiDiagnosticFailure({
				category: "task_card_workflow_failed",
				diagnostic_type: "task_card_draft_request_failed",
				severity_hint: "H2",
				evidence_confidence: .76,
				error_code: diagnosticErrorCode(err, "task_card_draft_request_failed"),
				context: {
					surface: "task-card",
					action: "draft-request",
					thread_hash: diagnosticThreadHash(targetThreadId)
				},
				counts: { status_code: diagnosticErrorStatus(err) },
				breadcrumbs: [{
					kind: "task-card",
					code: "draft-request",
					status: "failed",
					fields: {
						status_code: diagnosticErrorStatus(err),
						thread_hash: diagnosticThreadHash(targetThreadId)
					}
				}]
			});
			if (options.rethrow) throw new Error(message);
			return false;
		} finally {
			finishSendProgressWatchdog();
			state.composerBusy = false;
			updateComposerControls();
		}
	}
	async function submitAtLoopRequest(commandText, options = {}) {
		const text = String(commandText || "").trim();
		const objective = atLoopCommandObjectiveText(text);
		const targetThreadId = currentComposerThreadId();
		const targetThread = composerTargetThread();
		if (!text) return false;
		if (!isAtLoopCommandText(text) || !objective) {
			const err = /* @__PURE__ */ new Error("Loop objective is required");
			showError(err);
			if (options.rethrow) throw err;
			return false;
		}
		if (state.newThreadDraft || !targetThreadId) {
			const err = /* @__PURE__ */ new Error("Loop is only available in an existing thread");
			showError(err);
			if (options.rethrow) throw err;
			return false;
		}
		if (state.pendingAttachments.length) {
			const err = /* @__PURE__ */ new Error("@loop does not support attachments in this entry point");
			showError(err);
			if (options.rethrow) throw err;
			return false;
		}
		state.composerBusy = true;
		state.sendButtonHint = "";
		$("connectionState").classList.remove("error");
		$("connectionState").textContent = "正在启动 Loop";
		markActivity("Loop");
		updateComposerControls();
		try {
			postClientEvent("at_loop_request_start", { threadId: targetThreadId });
			const result = await api("/api/at-loop/triggers", {
				method: "POST",
				body: JSON.stringify({
					sourceThreadId: targetThreadId,
					sourceThreadTitle: targetThread ? threadDisplayName(targetThread) : "",
					cwd: targetThread && targetThread.cwd || "",
					text
				}),
				timeoutMs: 6e4
			});
			if (result && result.ok === false) throw new Error(result.error || "at_loop_start_failed");
			const outcome = atLoopRequestClientOutcome(result);
			const loopId = outcome.loopId;
			setComposerText("");
			clearPendingAttachments();
			scheduleCurrentDraftSave();
			$("connectionState").classList.remove("error");
			$("connectionState").textContent = outcome.statusText;
			markActivity(outcome.activityText);
			postClientEvent("at_loop_request_success", {
				threadId: targetThreadId,
				loopId: loopId ? loopId.slice(0, 24) : "",
				duplicateSuppressed: Boolean(result && result.duplicateSuppressed),
				waitingSourceRequirements: outcome.waitingSourceRequirements,
				loopStatus: outcome.loopStatus,
				nextRoute: outcome.nextRoute,
				missingSections: outcome.missingSections
			});
			scheduleComposerTargetRefresh(targetThreadId, 700, "at-loop-submit");
			scheduleLivePollIfNeeded(1200);
			loadThreads({ silent: true }).catch(showError);
			return outcome;
		} catch (err) {
			const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err), err) || "Loop 启动失败";
			$("connectionState").classList.add("error");
			$("connectionState").textContent = message;
			postClientEvent("at_loop_request_failure", {
				threadId: targetThreadId,
				message
			});
			showError(new Error(message));
			if (options.rethrow) throw new Error(message);
			return false;
		} finally {
			state.composerBusy = false;
			updateComposerControls();
		}
	}
	async function sendMessage(event) {
		if (event && typeof event.preventDefault === "function") event.preventDefault();
		if (state.composerBusy) return;
		state.lastSendSubmitStartedAt = Date.now();
		const input = $("messageInput");
		const text = composerText();
		const normalizedIntentText = normalizedComposerIntentText(text);
		const hasContent = Boolean(text || state.pendingAttachments.length);
		const targetThreadId = currentComposerThreadId();
		const targetThread = composerTargetThread();
		const targetActiveTurnId = composerTargetActiveTurnId();
		if (normalizedIntentText === "@") {
			openComposerIntentMenu();
			return;
		}
		const bareIntentKind = composerIntentBareTagKind(text);
		if (bareIntentKind && bareIntentKind !== "goal") {
			openComposerIntentDialog(bareIntentKind);
			return;
		}
		if (isThreadGoalCommandText(text)) {
			if (state.newThreadDraft) {
				showError(/* @__PURE__ */ new Error("Goal is only available in an existing thread"));
				return;
			}
			if (state.pendingAttachments.length) {
				showError(/* @__PURE__ */ new Error("Goal commands do not support attachments"));
				return;
			}
			if (!targetThreadId) return;
			setComposerText("");
			scheduleCurrentDraftSave();
			openThreadGoalDialog(targetThreadId);
			return;
		}
		if (isChatGptProCommandText(text)) {
			await submitChatGptProRequest(text);
			return;
		}
		if (isAtLoopCommandText(text)) {
			await submitAtLoopRequest(text);
			return;
		}
		if (state.newThreadDraft) {
			await sendNewThreadMessage(text, hasContent, input);
			return;
		}
		if (targetActiveTurnId && !hasContent) {
			await interruptActiveTurn(targetThreadId, targetActiveTurnId);
			return;
		}
		if (!text && !state.pendingAttachments.length || !targetThreadId) return;
		const threadTaskCardCommand = isThreadTaskCardCommandText(text);
		if (threadTaskCardCommand && state.pendingAttachments.length) {
			showError(/* @__PURE__ */ new Error("# task-card commands do not support attachments yet"));
			return;
		}
		if (threadTaskCardCommand) {
			await sendThreadTaskCardCommand(text);
			return;
		}
		const outboundText = text;
		const steering = Boolean(targetActiveTurnId && hasContent);
		const steerTurnId = steering ? String(targetActiveTurnId) : "";
		const submittedDraftKey = currentDraftKey();
		const clientSubmissionId = createSubmissionId();
		const submittedAttachments = state.pendingAttachments.slice();
		const previousThreadStatus = snapshotThreadStatus(targetThreadId);
		if (typeof recordSubmittedEchoDiagnosticLog === "function") recordSubmittedEchoDiagnosticLog("submit-start", {
			threadId: targetThreadId,
			clientSubmissionId,
			activeTurnHash: diagnosticTurnHash(targetActiveTurnId),
			steering,
			hasText: Boolean(outboundText),
			textLength: String(outboundText || "").length,
			attachmentCount: submittedAttachments.length,
			composerBusyBeforeSet: state.composerBusy
		});
		state.composerBusy = true;
		state.sendButtonHint = "";
		startSendProgressWatchdog(targetThreadId);
		if (steering) setSteerFeedback("sending", {
			threadId: targetThreadId,
			turnId: steerTurnId,
			clientSubmissionId
		});
		else markActivity("发送");
		updateComposerControls();
		if (state.sendProgressWarned) {
			$("connectionState").textContent = steering ? "引导中…" : "发送中…";
			$("connectionState").classList.remove("error");
		}
		try {
			const body = new FormData();
			body.append("clientSubmissionId", clientSubmissionId);
			body.append("text", outboundText);
			if (targetThread && targetThread.cwd) body.append("cwd", targetThread.cwd);
			if (steerTurnId) body.append("activeTurnId", steerTurnId);
			body.append("model", selectedComposerModel());
			body.append("effort", selectedComposerEffort());
			body.append("permissionMode", selectedComposerPermissionMode());
			if (codexFastCommandEnabled()) body.append("fastMode", "1");
			for (const item of state.pendingAttachments) body.append("attachments", item.file, item.file.name || "upload");
			registerSubmittedUserMessage(targetThreadId, outboundText, submittedAttachments, clientSubmissionId);
			const insertedLocalMessage = insertLocalSubmittedUserMessage(targetThreadId, outboundText, submittedAttachments, clientSubmissionId, { turnId: steering ? steerTurnId : "" });
			if (typeof recordSubmittedEchoDiagnosticLog === "function") recordSubmittedEchoDiagnosticLog("local-insert-result", {
				threadId: targetThreadId,
				clientSubmissionId,
				insertedLocalMessage,
				steering
			});
			if (!steering) {
				markThreadOptimisticallyActive(targetThreadId);
				renderThreads();
			}
			if (insertedLocalMessage) {
				renderCurrentThread({ stickToBottom: true });
				if (typeof recordSubmittedEchoDiagnosticLog === "function") recordSubmittedEchoDiagnosticLog("local-rendered", {
					threadId: targetThreadId,
					clientSubmissionId,
					insertedLocalMessage,
					steering
				});
			}
			scheduleSubmittedMessageDomProbe(targetThreadId, clientSubmissionId, steering ? "message-steer" : "message-submit");
			followSubmittedMessageToBottom(targetThreadId, clientSubmissionId);
			const result = await api(`/api/threads/${encodeURIComponent(targetThreadId)}/messages`, {
				method: "POST",
				body,
				timeoutMs: 18e4
			});
			const serverTurnId = startedTurnId(result);
			if (typeof recordSubmittedEchoDiagnosticLog === "function") recordSubmittedEchoDiagnosticLog("post-response", {
				threadId: targetThreadId,
				clientSubmissionId,
				serverTurnHash: diagnosticTurnHash(serverTurnId),
				steering,
				resultKeys: result && typeof result === "object" ? Object.keys(result).sort().slice(0, 20) : [],
				steeringQueued: Boolean(result && result.steeringQueued)
			});
			const reconciledSubmittedUserMessage = !steering && serverTurnId && reconcileSubmittedUserMessageTurn(targetThreadId, clientSubmissionId, serverTurnId);
			if (typeof recordSubmittedEchoDiagnosticLog === "function") recordSubmittedEchoDiagnosticLog("post-reconcile-result", {
				threadId: targetThreadId,
				clientSubmissionId,
				serverTurnHash: diagnosticTurnHash(serverTurnId),
				steering,
				reconciled: Boolean(reconciledSubmittedUserMessage)
			});
			if (reconciledSubmittedUserMessage) {
				renderCurrentThread({ stickToBottom: true });
				if (typeof recordSubmittedEchoDiagnosticLog === "function") recordSubmittedEchoDiagnosticLog("post-reconcile-rendered", {
					threadId: targetThreadId,
					clientSubmissionId,
					serverTurnHash: diagnosticTurnHash(serverTurnId),
					steering
				});
			}
			commitPluginVoiceInputSessionsAfterSend(submittedDraftKey, text, {
				threadId: targetThreadId,
				messageId: clientSubmissionId,
				composerId: "thread-composer"
			});
			setComposerText("");
			clearPendingAttachments({ revokePreviewUrls: false });
			writeCurrentDraftToKey(submittedDraftKey);
			if (!steering) renderComposerSettings();
			input.blur();
			$("connectionState").classList.remove("error");
			if (steering) {
				const steerStatus = result && result.steeringQueued ? "queued" : "delivered";
				setSteerFeedback(steerStatus, {
					threadId: targetThreadId,
					turnId: steerTurnId,
					clientSubmissionId
				});
			} else {
				$("connectionState").textContent = "Sent";
				markActivity("已发送");
			}
			scheduleComposerTargetRefresh(targetThreadId, 250, "message-submit");
			if (typeof schedulePostCompletionThreadRefreshes === "function") schedulePostCompletionThreadRefreshes(targetThreadId, [
				350,
				750,
				1200,
				2400,
				5200
			]);
			if (typeof scheduleUsageBackfillRefresh === "function" && state.currentThreadId === targetThreadId) scheduleUsageBackfillRefresh(750, { force: true });
			scheduleLivePollIfNeeded(1200);
			loadThreads({ silent: true }).catch(showError);
		} catch (err) {
			clearSubmittedMessageBottomFollow();
			if (!steering) {
				restoreThreadStatusSnapshot(previousThreadStatus);
				renderThreads();
			}
			const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err), err) || "发送失败，请重试";
			state.sendButtonHint = "重试";
			markSubmittedUserMessageFailed(targetThreadId, outboundText, submittedAttachments, clientSubmissionId, message);
			if (steering) setSteerFeedback("failed", {
				threadId: targetThreadId,
				turnId: steerTurnId,
				clientSubmissionId
			});
			else {
				$("connectionState").classList.remove("error");
				$("connectionState").textContent = "发送失败，详情见消息回执";
			}
			postClientEvent("send_failure", {
				threadId: targetThreadId || "",
				message,
				steering
			});
			if (typeof recordSubmittedEchoDiagnosticLog === "function") recordSubmittedEchoDiagnosticLog("send-error", {
				threadId: targetThreadId,
				clientSubmissionId,
				steering,
				errorCode: diagnosticErrorCode(err, "send_failed"),
				statusCode: diagnosticErrorStatus(err)
			});
		} finally {
			finishSendProgressWatchdog();
			state.composerBusy = false;
			updateComposerControls();
			if (typeof recordSubmittedEchoDiagnosticLog === "function") recordSubmittedEchoDiagnosticLog("send-finally", {
				threadId: targetThreadId,
				clientSubmissionId,
				steering,
				composerBusy: state.composerBusy
			});
		}
	}
	async function sendNewThreadMessage(text, hasContent, input) {
		if (!hasContent) return;
		const submittedDraftKey = currentDraftKey();
		const clientSubmissionId = createSubmissionId();
		const submittedModel = newThreadSelectedModel();
		const submittedEffort = newThreadSelectedEffort();
		const submittedPermissionMode = newThreadSelectedPermissionMode();
		const submittedTitle = String(state.newThreadTitle || "").trim();
		state.composerBusy = true;
		state.sendButtonHint = "";
		$("connectionState").classList.remove("error");
		$("connectionState").textContent = "正在创建新对话";
		markActivity("创建新对话");
		updateComposerControls();
		try {
			const submittedAttachments = state.pendingAttachments.slice();
			const body = new FormData();
			body.append("clientSubmissionId", clientSubmissionId);
			body.append("text", text);
			if (state.selectedCwd) body.append("cwd", state.selectedCwd);
			body.append("model", submittedModel);
			body.append("effort", submittedEffort);
			body.append("permissionMode", submittedPermissionMode);
			if (submittedTitle) body.append("title", submittedTitle);
			if (codexFastCommandEnabled()) body.append("fastMode", "1");
			for (const item of state.pendingAttachments) body.append("attachments", item.file, item.file.name || "upload");
			const result = await api("/api/threads/new-message", {
				method: "POST",
				body,
				timeoutMs: 18e4
			});
			const threadId = String(result && result.threadId || result && result.thread && result.thread.id || "");
			if (!threadId) throw new Error("新对话创建失败：未返回 threadId");
			commitPluginVoiceInputSessionsAfterSend(submittedDraftKey, text, {
				threadId,
				messageId: clientSubmissionId,
				composerId: "new-thread-composer"
			});
			registerSubmittedUserMessage(threadId, text, submittedAttachments, clientSubmissionId);
			const turnId = startedTurnId(result);
			const userItem = localUserMessageItem(text, submittedAttachments, clientSubmissionId);
			const thread = Object.assign({
				id: threadId,
				name: submittedTitle || "",
				preview: submittedTitle || text || "新建对话",
				cwd: result && result.thread && result.thread.cwd || state.selectedCwd || "",
				status: { type: "active" },
				turns: [],
				mobileInitialSubmissionId: clientSubmissionId
			}, result.thread || {});
			if (submittedTitle) {
				thread.name = submittedTitle;
				thread.preview = submittedTitle;
			}
			if (!thread.model && submittedModel) thread.model = submittedModel;
			if (!thread.effort && submittedEffort) thread.effort = submittedEffort;
			if (turnId) {
				const existingTurn = (thread.turns || []).find((turn) => turn && turn.id === turnId);
				if (existingTurn) existingTurn.items = mergeItemsPreservingLocalVisible([userItem], existingTurn.items || [], true);
				else thread.turns = (thread.turns || []).concat([{
					id: turnId,
					status: { type: "active" },
					startedAt: Math.floor(Date.now() / 1e3),
					completedAt: null,
					durationMs: null,
					items: [userItem]
				}]);
			}
			state.threads = [thread, ...state.threads.filter((entry) => entry.id !== threadId)];
			state.newThreadDraft = false;
			state.newThreadTitle = "";
			state.currentThreadId = threadId;
			state.currentThread = thread;
			state.activeTurnId = turnId || state.activeTurnId;
			state.composerModel = submittedModel || "";
			state.composerEffort = submittedEffort || "";
			state.composerPermissionMode = submittedPermissionMode || "";
			if (state.events) connectEvents();
			setComposerText("");
			clearPendingAttachments({ revokePreviewUrls: false });
			clearDraftForKey(submittedDraftKey);
			writeCurrentDraftToKey(draftKeyForThread(threadId));
			if (input) input.blur();
			renderComposerSettings();
			renderThreads();
			renderCurrentThread({ stickToBottom: true });
			scheduleSubmittedMessageDomProbe(threadId, clientSubmissionId, "new-thread-submit");
			try {
				await loadThread(threadId, { source: "new-thread" });
			} catch (err) {
				showError(err);
				renderThreads();
				renderCurrentThread({ stickToBottom: true });
			}
			$("connectionState").textContent = "新对话已创建";
			markActivity("新对话已创建");
			renderComposerSettings();
			updateComposerControls();
			scheduleCurrentThreadRefresh(900);
			scheduleLivePollIfNeeded(1200);
			loadThreads({ silent: true }).catch(showError);
		} catch (err) {
			const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err), err) || "新对话创建失败，请重试";
			state.sendButtonHint = "重试";
			$("connectionState").classList.add("error");
			$("connectionState").textContent = message;
			postClientEvent("new_thread_send_failure", {
				cwd: state.selectedCwd || "",
				message
			});
		} finally {
			state.composerBusy = false;
			updateComposerControls();
		}
	}
	function requestComposerSubmitFromButton(event) {
		event.preventDefault();
		event.stopPropagation();
		const now = Date.now();
		if (now - state.lastSendButtonSubmitAt < 650) return;
		state.lastSendButtonSubmitAt = now;
		const button = $("sendMessage");
		if (!button || button.disabled || state.composerBusy) return;
		const composerForm = $("composer");
		try {
			if (composerForm && typeof composerForm.requestSubmit === "function") composerForm.requestSubmit();
			else sendMessage(event);
		} catch (err) {
			postClientEvent("send_button_submit_exception", {
				activeElement: document.activeElement ? document.activeElement.id || document.activeElement.tagName || "" : "",
				hasContent: composerHasContent(),
				buttonDisabled: button.disabled,
				error: String(err && err.message || "")
			});
			showError(/* @__PURE__ */ new Error("发送按钮点击异常，请改用回车发送"));
		}
		setTimeout(() => {
			if (state.lastSendSubmitStartedAt >= now) return;
			postClientEvent("send_button_no_submit", {
				activeElement: document.activeElement ? document.activeElement.id || document.activeElement.tagName || "" : "",
				hasContent: composerHasContent(),
				buttonDisabled: button.disabled,
				composerBusy: state.composerBusy
			});
			if (composerHasContent()) showError(/* @__PURE__ */ new Error("发送没触发，建议重试或按回车发送"));
		}, 1200);
	}
	function requestAttachmentPickerFromButton(event) {
		if (event && typeof event.preventDefault === "function") event.preventDefault();
		if (event && typeof event.stopPropagation === "function") event.stopPropagation();
		const now = Date.now();
		if (now - Number(state.lastAttachmentPickerAt || 0) < 650) return;
		const button = $("attachFiles");
		const input = $("fileInput");
		if (!button || !input || button.disabled || input.disabled || state.composerBusy) return;
		state.lastAttachmentPickerAt = now;
		try {
			if (!isAndroidBrowser() && typeof input.showPicker === "function") input.showPicker();
			else input.click();
		} catch (err) {
			postClientEvent("attachment_picker_click_exception", {
				activeElement: document.activeElement ? document.activeElement.id || document.activeElement.tagName || "" : "",
				buttonDisabled: Boolean(button.disabled),
				inputDisabled: Boolean(input.disabled),
				error: String(err && err.message || "")
			});
			showError(/* @__PURE__ */ new Error("附件选择器打开失败，请重试"));
		}
	}
	async function interruptActiveTurn(threadId = currentComposerThreadId(), activeTurnId = composerTargetActiveTurnId()) {
		const targetThreadId = String(threadId || "").trim();
		const targetActiveTurnId = String(activeTurnId || "").trim();
		if (!targetThreadId || !targetActiveTurnId) return;
		$("connectionState").classList.remove("error");
		$("connectionState").textContent = "Interrupt requested";
		markActivity("中断");
		await api(`/api/threads/${encodeURIComponent(targetThreadId)}/turns/${encodeURIComponent(targetActiveTurnId)}/interrupt`, { method: "POST" }).then(() => scheduleComposerTargetRefresh(targetThreadId, 900)).catch(showError);
	}
	return {
		updateComposerHeightVar,
		clearSendProgressWatchdog,
		startSendProgressWatchdog,
		finishSendProgressWatchdog,
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
		atLoopRequestClientOutcome,
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
		submitAtLoopRequest,
		sendMessage,
		sendNewThreadMessage,
		requestComposerSubmitFromButton,
		requestAttachmentPickerFromButton,
		interruptActiveTurn
	};
}
var api$6 = Object.freeze({ createComposerRuntime });
root$2.CodexComposerRuntime = api$6;
//#endregion
//#region frontend/native/composer-bridge-runtime.mjs
var root$1 = typeof globalThis !== "undefined" ? globalThis : window;
function updateComposerHeightVar(...args) {
	return composerRuntime.updateComposerHeightVar(...args);
}
function showError$1(err) {
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
function composerHasContent$1(...args) {
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
async function submitAtLoopRequest(...args) {
	return composerRuntime.submitAtLoopRequest(...args);
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
	if (!request) throw new Error("Server request is not available in this browser session");
	if (request.status !== "waiting") return;
	const threadId = approvalActionThreadId(request, options.threadId);
	request.status = "responding";
	request.decision = payload && (payload.decision || payload.action) || "submitted";
	markActivity(isUserInputRequest(request) ? "输入发送中" : "批准中");
	scheduleApprovalThreadRender(threadId);
	try {
		const result = await api$5(`/api/approvals/${encodeURIComponent(key)}`, {
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
		if (isStaleServerRequestError(err)) {
			state.pendingApprovals.delete(key);
			$("connectionState").classList.remove("error");
			$("connectionState").textContent = isUserInputRequest(request) ? "Response no longer pending" : "Approval no longer pending";
			markActivity(isUserInputRequest(request) ? "输入已结束" : "批准已结束");
			scheduleApprovalThreadRender(threadId);
			scheduleCurrentThreadRefresh({ reason: "stale-server-request" });
			return;
		}
		request.status = "waiting";
		request.decision = null;
		showError$1(err);
		scheduleApprovalThreadRender(threadId);
	}
}
function isStaleServerRequestError(err) {
	const status = Number(err && (err.status || err.statusCode) || 0);
	const text = String(err && (err.code || err.message || err.detail) || err || "").toLowerCase();
	if (status === 404) return true;
	return text.includes("no longer pending") || text.includes("not pending") || text.includes("not found") || text.includes("not available");
}
function answerApproval(requestId, decision, options = {}) {
	const key = requestId !== null && requestId !== void 0 ? String(requestId) : "";
	if (!key) return Promise.reject(/* @__PURE__ */ new Error("Approval request id is missing"));
	if (state.pendingApprovals.get(key)) return answerServerRequest(key, { decision }, options);
	const threadId = String(options.threadId || state.currentThreadId || "").trim();
	markActivity("批准中");
	if (threadId) scheduleApprovalThreadRender(threadId);
	return api$5(`/api/approvals/${encodeURIComponent(key)}`, {
		method: "POST",
		body: JSON.stringify({ decision }),
		timeoutMs: 2e4
	}).then((result) => {
		if (result && result.request) state.pendingApprovals.set(key, serverRequestWithThreadContext(result.request, threadId));
		$("connectionState").classList.remove("error");
		$("connectionState").textContent = "Approval sent";
		markActivity("批准发送");
		if (threadId) scheduleApprovalThreadRender(threadId);
		return result;
	}).catch((err) => {
		if (isStaleServerRequestError(err)) {
			state.pendingApprovals.delete(key);
			$("connectionState").classList.remove("error");
			$("connectionState").textContent = "Approval no longer pending";
			markActivity("批准已结束");
			if (threadId) scheduleApprovalThreadRender(threadId);
			scheduleCurrentThreadRefresh({ reason: "stale-approval-request" });
			return {
				ok: true,
				stale: true
			};
		}
		showError$1(err);
		throw err;
	});
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
		const result = await api$5(`/api/thread-task-cards/${encodeURIComponent(id)}/${encodeURIComponent(action)}`, {
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
			loadThreads({ silent: true }).catch(showError$1);
			return;
		}
		await refreshThreadAfterTaskCard(threadId);
	} catch (err) {
		showError$1(err);
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
		createThreadTaskCardDraft(key, { threadId: sourceThreadId }).catch(showError$1);
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
		const result = await api$5("/api/thread-task-cards", {
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
		loadThreads({ silent: true }).catch(showError$1);
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
		submitAtLoopRequest: typeof submitAtLoopRequest === "function" ? submitAtLoopRequest : null,
		answerServerRequest: typeof answerServerRequest === "function" ? answerServerRequest : null,
		answerApproval: typeof answerApproval === "function" ? answerApproval : null,
		declineServerRequest: typeof declineServerRequest === "function" ? declineServerRequest : null,
		mutateThreadTaskCard: typeof mutateThreadTaskCard === "function" ? mutateThreadTaskCard : null,
		replyTaskCard: typeof replyTaskCard === "function" ? replyTaskCard : null,
		queueThreadTaskCardDraftCreation: typeof queueThreadTaskCardDraftCreation === "function" ? queueThreadTaskCardDraftCreation : null,
		createThreadTaskCardDraft: typeof createThreadTaskCardDraft === "function" ? createThreadTaskCardDraft : null
	};
}
var legacyGlobals$1 = {
	updateComposerHeightVar,
	showError: showError$1,
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
	composerHasContent: composerHasContent$1,
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
	submitAtLoopRequest,
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
var api$5 = Object.freeze({ createComposerBridgeRuntime });
for (const [name, value] of Object.entries(legacyGlobals$1)) if (typeof value === "function") root$1[name] = value;
root$1.CodexComposerBridgeRuntime = api$5;
//#endregion
//#region frontend/native/api-client-runtime.mjs
var root = typeof globalThis !== "undefined" ? globalThis : window;
var FRONTEND_DIAGNOSTIC_LOG_VERSION = "20260706-v1";
var STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENABLED = "codexMobileFrontendDiagnosticLogEnabled";
var STORAGE_FRONTEND_DIAGNOSTIC_LOG_UPLOAD = "codexMobileFrontendDiagnosticLogUpload";
var STORAGE_FRONTEND_DIAGNOSTIC_LOG_SCOPES = "codexMobileFrontendDiagnosticLogScopes";
var STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENTRIES = "codexMobileFrontendDiagnosticLogEntries";
var STORAGE_FRONTEND_DIAGNOSTIC_LOG_MAX_ENTRIES = "codexMobileFrontendDiagnosticLogMaxEntries";
var STORAGE_FRONTEND_DIAGNOSTIC_LOG_SERVER_ENABLED = "codexMobileFrontendDiagnosticLogServerEnabled";
var frontendDiagnosticLogUrlParamsApplied = false;
async function api$4(path, options = {}) {
	return apiClient.request(path, options);
}
function postClientEvent$1(event, details = {}) {
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
	postClientEvent$1(event, Object.assign({
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
function diagnosticThreadHash$1(threadId = state.currentThreadId) {
	const id = String(threadId || "").trim();
	return id ? diagnosticHash(`thread:${id}`) : "";
}
function diagnosticTurnHash(turnId) {
	const id = String(turnId || "").trim();
	return id ? diagnosticHash(`turn:${id}`) : "";
}
function diagnosticTaskHash$1(taskId) {
	const id = String(taskId || "").trim();
	return id ? diagnosticHash(`task:${id}`) : "";
}
function diagnosticItemHash$1(itemId) {
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
function frontendDiagnosticLogStorageGet(key) {
	try {
		return localStorage.getItem(key);
	} catch (_) {
		return "";
	}
}
function frontendDiagnosticLogStorageSet(key, value) {
	try {
		localStorage.setItem(key, value);
		return true;
	} catch (_) {
		return false;
	}
}
function frontendDiagnosticLogStorageRemove(key) {
	try {
		localStorage.removeItem(key);
		return true;
	} catch (_) {
		return false;
	}
}
function truthyFrontendDiagnosticLogValue(value) {
	return /^(1|true|yes|on|enable|enabled)$/i.test(String(value || "").trim());
}
function falseyFrontendDiagnosticLogValue(value) {
	return /^(0|false|no|off|disable|disabled)$/i.test(String(value || "").trim());
}
function normalizeFrontendDiagnosticLogScopes(value) {
	const scopes = (Array.isArray(value) ? value.join(",") : String(value || "")).split(/[,\s]+/g).map((item) => item.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_")).filter(Boolean).slice(0, 24);
	return scopes.length ? Array.from(new Set(scopes)) : ["submitted_echo"];
}
function boundedFrontendDiagnosticLogMaxEntries(value) {
	const number = Number(value);
	if (!Number.isFinite(number) || number <= 0) return 400;
	return Math.max(25, Math.min(2e3, Math.trunc(number)));
}
function applyFrontendDiagnosticLogUrlParams() {
	if (frontendDiagnosticLogUrlParamsApplied) return;
	frontendDiagnosticLogUrlParamsApplied = true;
	let params = null;
	try {
		params = new URL(window.location.href).searchParams;
	} catch (_) {
		return;
	}
	const enabledValue = params.get("codexFrontendLog") || params.get("codexMobileFrontendLog") || params.get("clientLog");
	if (truthyFrontendDiagnosticLogValue(enabledValue)) frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENABLED, "1");
	else if (falseyFrontendDiagnosticLogValue(enabledValue)) frontendDiagnosticLogStorageRemove(STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENABLED);
	const uploadValue = params.get("codexFrontendLogUpload") || params.get("clientLogUpload");
	if (truthyFrontendDiagnosticLogValue(uploadValue)) frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_UPLOAD, "1");
	else if (falseyFrontendDiagnosticLogValue(uploadValue)) frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_UPLOAD, "0");
	const scopesValue = params.get("codexFrontendLogScopes") || params.get("clientLogScopes");
	if (String(scopesValue || "").trim()) frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_SCOPES, normalizeFrontendDiagnosticLogScopes(scopesValue).join(","));
}
function frontendDiagnosticLogSettings() {
	applyFrontendDiagnosticLogUrlParams();
	return {
		enabled: truthyFrontendDiagnosticLogValue(frontendDiagnosticLogStorageGet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENABLED)),
		upload: !falseyFrontendDiagnosticLogValue(frontendDiagnosticLogStorageGet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_UPLOAD)),
		scopes: normalizeFrontendDiagnosticLogScopes(frontendDiagnosticLogStorageGet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_SCOPES) || "submitted_echo"),
		maxEntries: boundedFrontendDiagnosticLogMaxEntries(frontendDiagnosticLogStorageGet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_MAX_ENTRIES)),
		version: FRONTEND_DIAGNOSTIC_LOG_VERSION
	};
}
function frontendDiagnosticLogScopeEnabled(scope, settings = frontendDiagnosticLogSettings()) {
	if (!settings.enabled) return false;
	const normalized = normalizeFrontendDiagnosticLogScopes(scope || "general")[0] || "general";
	return settings.scopes.includes("all") || settings.scopes.includes(normalized);
}
function readFrontendDiagnosticLog() {
	try {
		const entries = JSON.parse(frontendDiagnosticLogStorageGet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENTRIES) || "[]");
		return Array.isArray(entries) ? entries : [];
	} catch (_) {
		return [];
	}
}
function writeFrontendDiagnosticLog(entries, maxEntries = 400) {
	const boundedEntries = (Array.isArray(entries) ? entries : []).slice(-boundedFrontendDiagnosticLogMaxEntries(maxEntries));
	return frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENTRIES, JSON.stringify(boundedEntries));
}
function clearFrontendDiagnosticLog() {
	return frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENTRIES, "[]");
}
function frontendDiagnosticLogStatus() {
	const settings = frontendDiagnosticLogSettings();
	return Object.assign({}, settings, {
		count: readFrontendDiagnosticLog().length,
		storageKey: STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENTRIES
	});
}
function setFrontendDiagnosticLogEnabled(enabled, options = {}) {
	if (enabled) frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENABLED, "1");
	else frontendDiagnosticLogStorageRemove(STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENABLED);
	if (Object.prototype.hasOwnProperty.call(options, "upload")) frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_UPLOAD, options.upload === false ? "0" : "1");
	if (options.scopes) frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_SCOPES, normalizeFrontendDiagnosticLogScopes(options.scopes).join(","));
	if (options.maxEntries) frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_MAX_ENTRIES, String(boundedFrontendDiagnosticLogMaxEntries(options.maxEntries)));
	return frontendDiagnosticLogStatus();
}
function configureFrontendDiagnosticLog(options = {}) {
	if (Object.prototype.hasOwnProperty.call(options, "enabled")) return setFrontendDiagnosticLogEnabled(Boolean(options.enabled), options);
	if (Object.prototype.hasOwnProperty.call(options, "upload")) frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_UPLOAD, options.upload === false ? "0" : "1");
	if (options.scopes) frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_SCOPES, normalizeFrontendDiagnosticLogScopes(options.scopes).join(","));
	if (options.maxEntries) frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_MAX_ENTRIES, String(boundedFrontendDiagnosticLogMaxEntries(options.maxEntries)));
	return frontendDiagnosticLogStatus();
}
function applyFrontendDiagnosticLogPublicConfig(config = {}) {
	const raw = config && config.frontendDiagnosticLog && typeof config.frontendDiagnosticLog === "object" ? config.frontendDiagnosticLog : null;
	if (!raw || typeof raw.enabled !== "boolean") return frontendDiagnosticLogStatus();
	if (raw.enabled) {
		frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_SERVER_ENABLED, "1");
		return setFrontendDiagnosticLogEnabled(true, {
			upload: raw.upload !== false,
			scopes: raw.scopes || "submitted_echo",
			maxEntries: raw.maxEntries || 400
		});
	}
	if (truthyFrontendDiagnosticLogValue(frontendDiagnosticLogStorageGet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_SERVER_ENABLED))) {
		frontendDiagnosticLogStorageRemove(STORAGE_FRONTEND_DIAGNOSTIC_LOG_SERVER_ENABLED);
		return setFrontendDiagnosticLogEnabled(false);
	}
	return frontendDiagnosticLogStatus();
}
function exportFrontendDiagnosticLog() {
	return JSON.stringify({
		exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
		status: frontendDiagnosticLogStatus(),
		entries: readFrontendDiagnosticLog()
	});
}
function frontendDiagnosticLogSensitiveKey(key) {
	return /(text|content|body|message|prompt|html|markdown|secret|token|cookie|authorization|password|access|launchkey|path|url|filename|file)/i.test(String(key || ""));
}
function sanitizeFrontendDiagnosticLogValue(value, key = "", depth = 0) {
	if (value == null) return value;
	if (typeof value === "boolean" || typeof value === "number") return value;
	if (typeof value === "string") {
		const raw = String(value || "");
		if (frontendDiagnosticLogSensitiveKey(key)) return raw ? {
			hash: diagnosticHash(`${key}:${raw}`),
			length: raw.length
		} : "";
		return raw.length > 160 ? `${raw.slice(0, 157)}...` : raw;
	}
	if (Array.isArray(value)) {
		if (depth >= 3) return { arrayLength: value.length };
		return value.slice(0, 20).map((item) => sanitizeFrontendDiagnosticLogValue(item, key, depth + 1));
	}
	if (typeof value === "object") {
		if (depth >= 3) return { objectKeys: Object.keys(value).slice(0, 20) };
		const out = {};
		for (const [entryKey, entryValue] of Object.entries(value).slice(0, 50)) out[entryKey] = sanitizeFrontendDiagnosticLogValue(entryValue, entryKey, depth + 1);
		return out;
	}
	return String(value).slice(0, 120);
}
function frontendDiagnosticLogThreadForId(threadId) {
	const id = String(threadId || "").trim();
	if (!id) return null;
	if (state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
	if (state.threadTileDetails && typeof state.threadTileDetails.get === "function") return state.threadTileDetails.get(id) || null;
	return null;
}
function submittedEchoItemSource(item) {
	if (!item || item.type !== "userMessage") return "";
	if (typeof isOptimisticUserMessage === "function" && isOptimisticUserMessage(item)) return "optimistic";
	if (item.mobilePendingSubmission) return "pending";
	if (item.clientSubmissionId) return "client-submission";
	if (item.id) return "durable";
	return "unknown";
}
function submittedEchoItemTextHash(item) {
	const text = typeof itemTextValue === "function" ? itemTextValue(item && (item.text || item.message || item.content || item.summary || item.input)) : "";
	return text ? stableTextHash(text) : "";
}
function submittedEchoThreadSnapshot(thread, clientSubmissionId = "") {
	const submissionId = String(clientSubmissionId || "").trim();
	const submissionHash = clientSubmissionDiagnosticHash(submissionId);
	const entries = [];
	let userMessageCount = 0;
	let matchingSubmissionCount = 0;
	let optimisticCount = 0;
	let durableCount = 0;
	let localTurnCount = 0;
	const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
	turns.forEach((turn, turnIndex) => {
		const turnId = String(turn && turn.id || "");
		if (/^local-turn-/.test(turnId)) localTurnCount += 1;
		(Array.isArray(turn && turn.items) ? turn.items : []).forEach((item, itemIndex) => {
			if (!item || item.type !== "userMessage") return;
			userMessageCount += 1;
			const source = submittedEchoItemSource(item);
			if (source === "optimistic" || source === "pending") optimisticCount += 1;
			else durableCount += 1;
			const matchesSubmission = Boolean(submissionId && String(item.clientSubmissionId || "") === submissionId);
			if (matchesSubmission) matchingSubmissionCount += 1;
			if (matchesSubmission || entries.length < 8) entries.push({
				turnIndex,
				itemIndex,
				turnHash: diagnosticTurnHash(turnId),
				itemHash: diagnosticItemHash$1(item.id || `${turnId}:${itemIndex}`),
				renderKeyHash: diagnosticItemHash$1(item.mobileRenderKey || item.id || `${turnId}:${itemIndex}`),
				source,
				matchesSubmission,
				clientSubmissionHash: clientSubmissionDiagnosticHash(item.clientSubmissionId || ""),
				textHash: submittedEchoItemTextHash(item),
				turnStatus: statusText(turn && turn.status)
			});
		});
	});
	return {
		threadHash: diagnosticThreadHash$1(thread && thread.id || ""),
		submissionHash,
		status: statusText(thread && thread.status),
		turnCount: turns.length,
		localTurnCount,
		userMessageCount,
		matchingSubmissionCount,
		optimisticCount,
		durableCount,
		entries: entries.slice(0, 12)
	};
}
function submittedEchoDomSnapshot(clientSubmissionId = "") {
	const submissionHash = clientSubmissionDiagnosticHash(clientSubmissionId);
	const conversation = $("conversation");
	if (!conversation) return {
		submissionHash,
		available: false,
		itemCount: 0,
		userMessageCount: 0,
		matchingSubmissionCount: 0,
		duplicateUserMessageCount: 0,
		duplicateRenderKeyCount: 0,
		entries: []
	};
	const shape = conversationDomShape();
	const userNodes = Array.from(conversation.querySelectorAll(".item.userMessage"));
	const entries = [];
	let matchingSubmissionCount = 0;
	userNodes.forEach((node, index) => {
		const nodeSubmissionHash = String(node.getAttribute("data-client-submission-hash") || "");
		const matchesSubmission = Boolean(submissionHash && nodeSubmissionHash === submissionHash);
		if (matchesSubmission) matchingSubmissionCount += 1;
		if (matchesSubmission || entries.length < 8) {
			const turnNode = node.closest("article.turn[data-turn], article.thread-tile-turn[data-thread-tile-turn]");
			entries.push({
				index,
				fromTail: userNodes.length - index - 1,
				matchesSubmission,
				clientSubmissionHash: nodeSubmissionHash,
				turnHash: diagnosticTurnHash(turnNode && (turnNode.getAttribute("data-turn") || turnNode.getAttribute("data-thread-tile-turn")) || ""),
				itemHash: diagnosticItemHash$1(node.getAttribute("data-item") || ""),
				renderKeyHash: diagnosticItemHash$1(node.getAttribute("data-render-key") || ""),
				textHash: stableTextHash(String(node.textContent || ""))
			});
		}
	});
	return {
		submissionHash,
		available: true,
		itemCount: shape.itemCount,
		turnCount: shape.turnCount,
		userMessageCount: userNodes.length,
		matchingSubmissionCount,
		duplicateUserMessageCount: shape.duplicateUserMessageCount,
		duplicateRenderKeyCount: shape.duplicateRenderKeyCount,
		entries: entries.slice(0, 12)
	};
}
function submittedEchoDiagnosticSnapshot(input = {}) {
	const threadId = String(input.threadId || state.currentThreadId || "").trim();
	const clientSubmissionId = String(input.clientSubmissionId || "").trim();
	const thread = input.thread || frontendDiagnosticLogThreadForId(threadId);
	return {
		threadId,
		threadHash: diagnosticThreadHash$1(threadId),
		submissionHash: clientSubmissionDiagnosticHash(clientSubmissionId),
		routeKind: diagnosticRouteKind(),
		currentThreadMatch: Boolean(threadId && String(state.currentThreadId || "") === threadId),
		thread: submittedEchoThreadSnapshot(thread, clientSubmissionId),
		dom: submittedEchoDomSnapshot(clientSubmissionId)
	};
}
function recordFrontendDiagnosticLog(event, details = {}, options = {}) {
	const scope = normalizeFrontendDiagnosticLogScopes(options.scope || details.scope || event || "general")[0] || "general";
	const settings = frontendDiagnosticLogSettings();
	if (!options.force && !frontendDiagnosticLogScopeEnabled(scope, settings)) return false;
	const threadId = String(details.threadId || state.currentThreadId || "").trim();
	state.frontendDiagnosticLogSeq = Number(state.frontendDiagnosticLogSeq || 0) + 1;
	const entry = {
		version: FRONTEND_DIAGNOSTIC_LOG_VERSION,
		seq: state.frontendDiagnosticLogSeq,
		at: (/* @__PURE__ */ new Date()).toISOString(),
		event: String(event || "frontend_diagnostic").slice(0, 100),
		scope,
		threadId,
		threadHash: diagnosticThreadHash$1(threadId),
		routeKind: diagnosticRouteKind(),
		visibility: document.visibilityState || "",
		clientBuildId: CLIENT_BUILD_ID,
		details: sanitizeFrontendDiagnosticLogValue(details || {})
	};
	const entries = readFrontendDiagnosticLog();
	entries.push(entry);
	writeFrontendDiagnosticLog(entries, settings.maxEntries);
	if (settings.upload && state.key) postClientEvent$1("frontend_diagnostic_log", entry);
	return entry;
}
function recordSubmittedEchoDiagnosticLog(stage, details = {}, options = {}) {
	const payload = Object.assign({ stage: String(stage || "unknown").slice(0, 80) }, details || {});
	const snapshot = submittedEchoDiagnosticSnapshot(payload);
	payload.threadHash = snapshot.threadHash;
	payload.submissionHash = snapshot.submissionHash;
	payload.snapshot = snapshot;
	return recordFrontendDiagnosticLog("submitted_echo_lifecycle", payload, Object.assign({ scope: "submitted_echo" }, options || {}));
}
function recordRecentSubmittedEchoDiagnosticLogs(stage, details = {}, options = {}) {
	const records = state.recentSubmittedUserMessages;
	if (!records || typeof records.entries !== "function") return 0;
	const threadId = String(details.threadId || state.currentThreadId || "").trim();
	let count = 0;
	for (const [clientSubmissionId, record] of Array.from(records.entries()).slice(-20)) {
		if (threadId && String(record && record.threadId || "") !== threadId) continue;
		if (recordSubmittedEchoDiagnosticLog(stage, Object.assign({}, details, {
			clientSubmissionId,
			threadId: String(record && record.threadId || threadId || "")
		}), options)) count += 1;
	}
	return count;
}
var frontendDiagnosticLogApi = Object.freeze({
	enable: (options = {}) => setFrontendDiagnosticLogEnabled(true, options),
	disable: () => setFrontendDiagnosticLogEnabled(false),
	configure: configureFrontendDiagnosticLog,
	applyPublicConfig: applyFrontendDiagnosticLogPublicConfig,
	status: frontendDiagnosticLogStatus,
	read: readFrontendDiagnosticLog,
	export: exportFrontendDiagnosticLog,
	clear: clearFrontendDiagnosticLog,
	record: recordFrontendDiagnosticLog,
	recordSubmittedEcho: recordSubmittedEchoDiagnosticLog,
	snapshotSubmittedEcho: submittedEchoDiagnosticSnapshot
});
function diagnosticRouteKind() {
	if (state.newThreadDraft) return "new-thread";
	if (isHermesEmbedMode() && isHermesPluginPrimaryPage()) return "embedded-primary";
	if (state.threadTileMode) return "thread-tile";
	if (state.currentThreadId) return "thread-detail";
	return isHermesEmbedMode() ? "embedded-root" : "standalone-root";
}
function diagnosticErrorStatus$1(err) {
	let status = Number(err && (err.status || err.statusCode) || 0);
	if ((!Number.isFinite(status) || status <= 0) && err && /^\d+$/.test(String(err.code || ""))) status = Number(err.code);
	return Number.isFinite(status) && status > 0 ? status : 0;
}
function diagnosticErrorCode$1(err, fallback = "runtime_failed") {
	const explicit = String(err && err.code || "").trim();
	if (explicit && !/^\d+$/.test(explicit)) return homeAiDiagnosticReportingApi.boundedToken(explicit, fallback, 100);
	const status = diagnosticErrorStatus$1(err);
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
		thread_hash: diagnosticThreadHash$1(),
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
	postClientEvent$1("home_ai_diagnostic_report_post", {
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
function recordHomeAiDiagnosticFailure$1(input = {}) {
	const result = state.homeAiDiagnosticReporter.recordFailure(Object.assign({}, input, { context: currentHomeAiDiagnosticContext(input.context || {}) }));
	postClientEvent$1("home_ai_diagnostic_failure_recorded", {
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
function recordHomeAiDiagnosticSuccess$1(input = {}) {
	return state.homeAiDiagnosticReporter.recordSuccess(Object.assign({}, input, { context: currentHomeAiDiagnosticContext(input.context || {}) }));
}
function applyFrontendRuntimeHealthEffect(effect) {
	const item = effect && typeof effect === "object" ? effect : {};
	if (!item.type) return;
	if (item.type === "diagnostic-failure") {
		recordHomeAiDiagnosticFailure$1(item.diagnostic || {});
		return;
	}
	if (item.type === "diagnostic-success") {
		recordHomeAiDiagnosticSuccess$1(item.diagnostic || {});
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
	const elapsedMs = Date.now() - Number(startedAtMs || Date.now());
	const thread = frontendHealthThreadForSubmission(id);
	const domShape = conversationDomShape();
	const visibleShape = thread ? visibleConversationShape(thread) : { visibleItemCount: 0 };
	recordSubmittedEchoDiagnosticLog("dom-probe", {
		threadId: id,
		clientSubmissionId: submissionId,
		action,
		elapsedMs,
		domHasSubmission: conversationHasClientSubmissionHash(submissionHash),
		hasThreadSubmission: threadHasClientSubmission(thread, submissionId),
		visibleCount: visibleShape.visibleItemCount,
		domCount: domShape.itemCount,
		composerBusy: state.composerBusy
	});
	applyFrontendRuntimeHealthEffectsPlan(frontendRuntimeHealthApi.submittedMessageDomProbeEffects({
		elapsedMs,
		action,
		routeKind: diagnosticRouteKind(),
		threadHash: diagnosticThreadHash$1(id),
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
		recordHomeAiDiagnosticFailure$1(item.diagnostic || {});
		return;
	}
	if (item.type === "diagnostic-success") {
		recordHomeAiDiagnosticSuccess$1(item.diagnostic || {});
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
	const threadHash = diagnosticThreadHash$1(String(source.threadId || state.currentThreadId || ""));
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
	const body = node.querySelector && node.querySelector(".item-body");
	const text = String((body || node).textContent || "").replace(/\s+/g, " ").trim();
	const textHash = text ? stableTextHash(text) : "";
	if (submissionHash && textHash) return `submission-text:${submissionHash}:${textHash}`;
	if (submissionHash) return `submission:${submissionHash}`;
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
	const comparable = userMessageComparableParts(item);
	const text = String(comparable.text || itemTextValue(item && item.text) || itemTextValue(item && item.message) || itemTextValue(item && item.content) || "").replace(/\s+/g, " ").trim();
	const textHash = text ? stableTextHash(text) : "";
	if (submissionHash && textHash) return `submission-text:${submissionHash}:${textHash}`;
	if (submissionHash) return `submission:${submissionHash}`;
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
		threadHash: diagnosticThreadHash$1(threadId),
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
	postClientEvent$1("thread_detail_render_evidence_cleared", { reason: String(reason || "").slice(0, 80) });
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
		threadHash: evidence.threadHash || diagnosticThreadHash$1(state.currentThreadId || thread && thread.id || ""),
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
	return recordHomeAiDiagnosticFailure$1(threadDiagnosticEventsApi.primaryShellSelectionConflictDiagnosticEvent(primaryShellSelectionConflictInput(reason, details)));
}
function recordPrimaryShellSelectionHealthy(source, thread = state.currentThread) {
	const evidence = rememberThreadDetailRenderEvidence(thread, source);
	if (!evidence) return null;
	return recordHomeAiDiagnosticSuccess$1(threadDiagnosticEventsApi.primaryShellSelectionConflictDiagnosticSuccess({
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
		threadHash: details.threadHash || sameThreadEvidence && sameThreadEvidence.threadHash || diagnosticThreadHash$1(threadId),
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
	return recordHomeAiDiagnosticFailure$1(threadDiagnosticEventsApi.emptyVisibleDetailMismatchDiagnosticEvent(emptyVisibleDetailMismatchInput(reason, thread, details)));
}
function recordEmptyVisibleDetailHealthy(source, thread = state.currentThread) {
	if (!thread || thread.mobileLoading || thread.mobileLoadError) return null;
	const threadId = String(thread.id || state.currentThreadId || "").trim();
	if (!threadId) return null;
	const shape = visibleConversationShape(thread);
	if (!shape.visibleTurnCount && !shape.visibleItemCount) return null;
	return recordHomeAiDiagnosticSuccess$1(threadDiagnosticEventsApi.emptyVisibleDetailMismatchDiagnosticSuccess({
		action: "single-thread-empty-state",
		routeKind: "single-thread",
		sourceKind: source,
		threadHash: diagnosticThreadHash$1(threadId),
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
	postClientEvent$1("empty_detail_history_recovery", plan.event || {});
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
		threadHash: diagnosticThreadHash$1(threadId),
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
	return recordHomeAiDiagnosticFailure$1(threadDiagnosticEventsApi.emptyCachedDetailReuseBlockedDiagnosticEvent(emptyCachedDetailReuseInput(reason, thread, details)));
}
function recordEmptyCachedDetailReuseHealthy(source, thread = state.currentThread) {
	const threadId = String(thread && thread.id || state.currentThreadId || "").trim();
	if (!threadId) return null;
	return recordHomeAiDiagnosticSuccess$1(threadDiagnosticEventsApi.emptyCachedDetailReuseDiagnosticSuccess({
		action: "thread-open-cache-reuse",
		routeKind: "single-thread",
		sourceKind: source,
		threadHash: diagnosticThreadHash$1(threadId),
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
		threadHash: diagnosticThreadHash$1(thread.id || state.currentThreadId),
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
		recordHomeAiDiagnosticFailure$1(item.diagnostic || {});
		return;
	}
	if (item.type === "diagnostic-success") {
		recordHomeAiDiagnosticSuccess$1(item.diagnostic || {});
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
		postClientEvent$1("ui_stall", {
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
	if (subscription) await api$4("/api/push/subscribe", {
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
		const key = await api$4("/api/push/vapid-public-key");
		subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: base64UrlToUint8Array(key.publicKey)
		});
	}
	await api$4("/api/push/subscribe", {
		method: "POST",
		body: JSON.stringify({ subscription: pushSubscriptionToJson(subscription) })
	});
	state.pushSubscribed = true;
	state.pushError = "";
	$("connectionState").classList.remove("error");
	$("connectionState").textContent = "Notifications enabled";
}
async function sendTestPushNotification() {
	const result = await api$4("/api/push/test", {
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
var legacyGlobals = {
	api: api$4,
	postClientEvent: postClientEvent$1,
	nowPerfMs,
	roundedDurationMs,
	postPerformanceEvent,
	diagnosticHash,
	diagnosticThreadHash: diagnosticThreadHash$1,
	diagnosticTurnHash,
	diagnosticTaskHash: diagnosticTaskHash$1,
	diagnosticItemHash: diagnosticItemHash$1,
	clientSubmissionDiagnosticHash,
	clientSubmissionDataAttr,
	frontendDiagnosticLogSettings,
	frontendDiagnosticLogStatus,
	applyFrontendDiagnosticLogPublicConfig,
	setFrontendDiagnosticLogEnabled,
	configureFrontendDiagnosticLog,
	readFrontendDiagnosticLog,
	clearFrontendDiagnosticLog,
	exportFrontendDiagnosticLog,
	recordFrontendDiagnosticLog,
	submittedEchoDiagnosticSnapshot,
	recordSubmittedEchoDiagnosticLog,
	recordRecentSubmittedEchoDiagnosticLogs,
	diagnosticRouteKind,
	diagnosticErrorStatus: diagnosticErrorStatus$1,
	diagnosticErrorCode: diagnosticErrorCode$1,
	diagnosticDurationBucket,
	currentHomeAiDiagnosticContext,
	postHomeAiDiagnosticReport,
	recordHomeAiDiagnosticFailure: recordHomeAiDiagnosticFailure$1,
	recordHomeAiDiagnosticSuccess: recordHomeAiDiagnosticSuccess$1,
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
root.CodexFrontendLog = frontendDiagnosticLogApi;
function createApiClientRuntime() {
	return Object.assign({}, legacyGlobals);
}
var apiClientRuntimeApi = Object.freeze({ createApiClientRuntime });
for (const [name, value] of Object.entries(legacyGlobals)) if (typeof value === "function") root[name] = value;
root.CodexApiClientRuntime = apiClientRuntimeApi;
//#endregion
//#region frontend/native/thread-list-load-policy.mjs
function bool(value) {
	return value === true;
}
function text$1(value) {
	return String(value || "").trim();
}
function planThreadListLoadRequest(input = {}) {
	const silent = bool(input.silent);
	const selectedCwd = text$1(input.selectedCwd);
	const search = text$1(input.search);
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
var thread_list_load_policy_default = { planThreadListLoadRequest };
//#endregion
//#region frontend/native/thread-list-stable-order.mjs
var DEFAULT_HOLD_MS = 45e3;
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
function timestampMs$1(value) {
	if (!value) return 0;
	const number = Number(value);
	if (!Number.isFinite(number) || number <= 0) {
		if (typeof value !== "string") return 0;
		const parsed = Date.parse(value);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
	}
	return number > 1e11 ? number : number * 1e3;
}
function threadUpdatedAtMs$1(thread) {
	return timestampMs$1(thread && (thread.mobileListUpdatedAtMs || thread.mobile_list_updated_at_ms || thread.listActivityAtMs || thread.list_activity_at_ms || thread.updatedAtMs || thread.updated_at_ms || thread.updatedAt || thread.updated_at || thread.lastActivityAtMs || thread.last_activity_at_ms || thread.lastActivityAt || thread.last_activity_at));
}
function threadUpdatedAtById(threads) {
	const byId = {};
	for (const thread of threads || []) {
		const id = threadId(thread);
		if (!id) continue;
		const updatedAtMs = threadUpdatedAtMs$1(thread);
		if (updatedAtMs > 0) byId[id] = updatedAtMs;
	}
	return byId;
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
	const incomingUpdatedAtById = threadUpdatedAtById(threads);
	const previous = input.previousState && typeof input.previousState === "object" ? input.previousState : {};
	const previousOrder = Array.isArray(previous.order) ? previous.order.map(text).filter(Boolean) : [];
	const previousUpdatedAtById = previous.updatedAtById && typeof previous.updatedAtById === "object" ? previous.updatedAtById : {};
	const scopeKey = text(input.scopeKey) || threadListOrderScopeKey(input);
	const nowMs = Math.max(0, Math.trunc(Number(input.nowMs) || Date.now()));
	const holdMs = boundedHoldMs(input.holdMs);
	const previousHoldUntilMs = Math.max(0, Math.trunc(Number(previous.holdUntilMs) || 0));
	const sameScope = text(previous.scopeKey) === scopeKey;
	const hasNewerActivity = sameScope && incomingIds.some((id) => {
		const previousUpdatedAtMs = Math.max(0, Math.trunc(Number(previousUpdatedAtById[id]) || 0));
		const incomingUpdatedAtMs = Math.max(0, Math.trunc(Number(incomingUpdatedAtById[id]) || 0));
		return previousUpdatedAtMs > 0 && incomingUpdatedAtMs > previousUpdatedAtMs;
	});
	const canHold = !input.forceServerOrder && sameScope && !hasNewerActivity && previousOrder.length > 0 && previousHoldUntilMs > nowMs;
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
			order,
			updatedAtById: incomingUpdatedAtById
		}
	};
}
var api$3 = {
	DEFAULT_HOLD_MS,
	threadListOrderScopeKey,
	planThreadListStableOrder
};
//#endregion
//#region frontend/native/thread-status-hints.mjs
var DEFAULT_RUNNING_HINT_STALE_MS = 1200 * 1e3;
var DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS = 60 * 1e3;
var DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS = 1e3;
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
function statusText$1(status) {
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
	return /active|running|queued|processing|inprogress|in_progress|in-progress|pending|started/.test(statusText$1(status).toLowerCase());
}
function isSettledStatus(status) {
	return /^(idle|notloaded|not_loaded|not-loaded|completed|complete|done|failed|failure|cancelled|canceled|cancel|error|interrupted|stopped|stop)$/.test(statusText$1(status).toLowerCase());
}
function isIdleStatus(status) {
	return /^(idle|notloaded|not_loaded|not-loaded)$/.test(statusText$1(status).toLowerCase());
}
function isDeployLaneSettledIdle(thread, status) {
	return Boolean(thread && thread.mobileDeployLane && isIdleStatus(status || thread.status));
}
function isTerminalStatus(status) {
	return /^(completed|complete|done|failed|failure|cancelled|canceled|cancel|error|interrupted|stopped|stop)$/.test(statusText$1(status).toLowerCase());
}
function threadUpdatedAtMs(thread) {
	return timestampMs(thread && (thread.mobileListUpdatedAtMs || thread.mobile_list_updated_at_ms || thread.listActivityAtMs || thread.list_activity_at_ms || thread.updatedAtMs || thread.updatedAt || thread.updated_at_ms || thread.updated_at || thread.lastActivityAtMs || thread.lastActivityAt || thread.last_activity_at_ms || thread.last_activity_at));
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
	return Boolean(hintedAt > 0 && now - hintedAt <= Math.max(0, Number(staleMs) || 6e4));
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
	return statusAt + Math.max(0, Number(input.freshnessToleranceMs) || 1e3) >= hintedAt;
}
function shouldKeepRunningHintForSettledStatus(input = {}) {
	const threadId = String(input.threadId || "");
	if (!threadId || !input.isRunningHinted) return false;
	const status = input.status || input.thread && input.thread.status;
	if (isStaleActiveStatus(status, input.thread)) return false;
	if (!isSettledStatus(status)) return false;
	if (input.currentThreadRefreshing) return true;
	if (isDeployLaneSettledIdle(input.thread, status)) return false;
	const idleWithoutTerminalEvidence = isIdleStatus(status) && !latestTerminalTurn(input.thread) && !input.eventIsTerminal;
	if (input.allowLocalProcessing !== false && idleWithoutTerminalEvidence && hasFreshSubmittedProcessingHint(input.submittedProcessingHintedAtMs, input.nowMs, input.submittedProcessingHintStaleMs)) return true;
	if (idleWithoutTerminalEvidence) return false;
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
	return updateAt + (input.mobileReplay ? 0 : Math.max(0, Number(input.freshnessToleranceMs) || 1e3)) >= hintedAt;
}
function runningHintAgeMs(input = {}) {
	const hintedAt = timestampMs(input.runningHintedAtMs);
	const now = timestampMs(input.nowMs) || Date.now();
	if (hintedAt > 0) return now - hintedAt;
	const updatedAt = threadUpdatedAtMs(input.thread);
	if (updatedAt > 0) return now - updatedAt;
	return (Number(input.runningHintStaleMs) || 12e5) + 1;
}
function shouldExpireRunningThreadHint(input = {}) {
	if (!input.threadId || !input.isRunningHinted) return false;
	const status = input.status || input.thread && input.thread.status;
	if (isStaleActiveStatus(status, input.thread)) return true;
	if (isRunningStatus(status)) return false;
	if (input.currentThreadRefreshing) return false;
	if (isDeployLaneSettledIdle(input.thread, status)) return false;
	if (isSettledStatus(status) && !shouldKeepRunningHintForSettledStatus(input)) return false;
	if (input.currentThreadHasLiveTurn) return false;
	return runningHintAgeMs(input) > (Number(input.runningHintStaleMs) || 12e5);
}
var api$2 = {
	DEFAULT_RUNNING_HINT_STALE_MS,
	DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS,
	DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS,
	hasFreshSubmittedProcessingHint,
	isDeployLaneSettledIdle,
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
	statusText: statusText$1,
	terminalTurnAtMs,
	threadUpdatedAtMs,
	timestampMs
};
//#endregion
//#region frontend/native/thread-detail-patch-plan.mjs
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
	if (threadTileSurface) {
		if (!threadTileMode) return {
			canPatch: false,
			surface: "blocked",
			reason: "tile-surface-without-tile-mode",
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
function patchEntryKind(entry) {
	if (!entry || typeof entry !== "object") return "";
	const signature = entry.signature && typeof entry.signature === "object" ? entry.signature : null;
	const item = entry.item && typeof entry.item === "object" ? entry.item : null;
	return String(signature && signature.type || item && item.type || entry.type || "");
}
function visibleUserMessagePatchKeysPreserved(previousEntries, nextEntries) {
	if (!Array.isArray(previousEntries) || !Array.isArray(nextEntries)) return false;
	const previous = previousEntries.map(normalizePatchEntry).filter(Boolean);
	const next = nextEntries.map(normalizePatchEntry).filter(Boolean);
	if (previous.length !== previousEntries.length || next.length !== nextEntries.length) return false;
	const previousKeys = previous.filter((entry) => patchEntryKind(entry) === "userMessage").map((entry) => entry.key);
	const nextKeys = next.filter((entry) => patchEntryKind(entry) === "userMessage").map((entry) => entry.key);
	if (previousKeys.length !== nextKeys.length) return false;
	return previousKeys.every((key, index) => key === nextKeys[index]);
}
function planVisibleItemRefreshPatch(previousEntries, nextEntries) {
	if (!visibleItemPatchShapePreservesExisting(previousEntries, nextEntries)) return {
		canPatch: false,
		reason: "shape-changed",
		operations: []
	};
	if (!visibleUserMessagePatchKeysPreserved(previousEntries, nextEntries)) return {
		canPatch: false,
		reason: "user-message-shape-changed",
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
var api$1 = {
	normalizePatchEntry,
	normalizeRefreshTurnPatchEntry,
	planThreadDetailRefreshDomPatch,
	planThreadDetailRefreshLocalPatchPreflight,
	planVisibleItemRefreshPatch,
	planThreadDetailDomPatchSurface,
	visibleItemPatchShapePreservesExisting,
	visibleUserMessagePatchKeysPreserved
};
//#endregion
//#region frontend/native/thread-detail-actions.mjs
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
function action$1(type, target, fields = {}) {
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
	if (node) return action$1("copy", node, {
		button: node,
		preventDefault: true,
		stopPropagation: true
	});
	node = closestWithin(target, "[data-local-file-path]", root);
	if (node) return action$1("local-file-preview", node, {
		link: node,
		threadId: contextThreadIdFromNode(node, "localFileThreadId"),
		preventDefault: true,
		stopPropagation: true
	});
	node = closestWithin(target, "[data-mermaid-action]", root);
	if (node) return action$1("mermaid", node, {
		button: node,
		preventDefault: true,
		stopPropagation: true
	});
	node = closestWithin(target, "[data-github-link-preview-expand]", root);
	if (node) return action$1("github-preview-toggle", node, {
		button: node,
		preventDefault: true,
		stopPropagation: true
	});
	return action$1("none", null, { reason: "no-match" });
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
	if (node) return action$1("approval-answer", node, {
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
		if (taskCardAction === "reply") return action$1("task-card-reply", node, {
			button: node,
			cardId,
			taskCardAction,
			threadId
		});
		if (taskCardAction === "approve" || taskCardAction === "delete" || taskCardAction === "revoke") return action$1("task-card-mutate", node, {
			button: node,
			cardId,
			taskCardAction,
			threadId
		});
		return action$1("task-card-unknown", node, {
			button: node,
			cardId,
			taskCardAction,
			threadId
		});
	}
	node = closestWithin(target, "[data-task-card-draft-action]", root);
	if (node) return action$1("task-card-draft", node, {
		button: node,
		draftAction: dataValue(node, "taskCardDraftAction"),
		draftKey: dataValue(node, "taskCardDraftKey"),
		threadId: dataValue(node, "taskCardDraftThreadId")
	});
	node = closestWithin(target, "[data-server-response-text]", root);
	if (node) return action$1("server-response", node, {
		option: node,
		requestId: dataValue(node, "serverRequestId"),
		threadId: dataValue(node, "serverRequestThreadId"),
		responseText: dataValue(node, "serverResponseText"),
		questionId: dataValue(node, "serverQuestionId") || "answer"
	});
	node = closestWithin(target, "[data-server-request-decline]", root);
	if (node) return action$1("server-request-decline", node, {
		button: node,
		requestId: dataValue(node, "serverRequestId"),
		threadId: dataValue(node, "serverRequestThreadId")
	});
	return action$1("none", null, { reason: "no-match" });
}
var api = {
	closestWithin,
	previewableImageFromTarget,
	resolveRichContentClickAction,
	resolveThreadDetailClickAction,
	contextThreadIdFromNode
};
//#endregion
//#region \0virtual:codex-mobile-esm-compatibility/shard/shard-08
var moduleDefinitions = [
	{
		"id": "composer-runtime",
		"source": "public/composer-runtime.js",
		"nativeSource": "frontend/native/composer-runtime.mjs",
		"globalName": "CodexComposerRuntime",
		"expectedFunctions": ["createComposerRuntime"],
		"assetPath": "/composer-runtime.js",
		"importSource": "frontend/native/composer-runtime.mjs",
		"compatibilityMode": "native-esm",
		"classicLoaderExcluded": true,
		"bytes": 88850
	},
	{
		"id": "composer-bridge-runtime",
		"source": "public/composer-bridge-runtime.js",
		"nativeSource": "frontend/native/composer-bridge-runtime.mjs",
		"globalName": "CodexComposerBridgeRuntime",
		"expectedFunctions": ["createComposerBridgeRuntime"],
		"assetPath": "/composer-bridge-runtime.js",
		"importSource": "frontend/native/composer-bridge-runtime.mjs",
		"compatibilityMode": "native-esm",
		"classicLoaderExcluded": true,
		"bytes": 34706
	},
	{
		"id": "api-client-runtime",
		"source": "public/api-client-runtime.js",
		"nativeSource": "frontend/native/api-client-runtime.mjs",
		"globalName": "CodexApiClientRuntime",
		"expectedFunctions": ["createApiClientRuntime"],
		"assetPath": "/api-client-runtime.js",
		"importSource": "frontend/native/api-client-runtime.mjs",
		"compatibilityMode": "native-esm",
		"classicLoaderExcluded": true,
		"bytes": 68429
	},
	{
		"id": "thread-list-load-policy",
		"source": "public/thread-list-load-policy.js",
		"nativeSource": "frontend/native/thread-list-load-policy.mjs",
		"globalName": "CodexThreadListLoadPolicy",
		"expectedFunctions": ["planThreadListLoadRequest"],
		"assetPath": "/thread-list-load-policy.js",
		"importSource": "frontend/native/thread-list-load-policy.mjs",
		"compatibilityMode": "native-esm",
		"classicLoaderExcluded": true,
		"bytes": 2160
	},
	{
		"id": "thread-list-stable-order",
		"source": "public/thread-list-stable-order.js",
		"nativeSource": "frontend/native/thread-list-stable-order.mjs",
		"globalName": "CodexThreadListStableOrder",
		"expectedFunctions": ["threadListOrderScopeKey", "planThreadListStableOrder"],
		"assetPath": "/thread-list-stable-order.js",
		"importSource": "frontend/native/thread-list-stable-order.mjs",
		"compatibilityMode": "native-esm",
		"classicLoaderExcluded": true,
		"bytes": 5110
	},
	{
		"id": "thread-status-hints",
		"source": "public/thread-status-hints.js",
		"nativeSource": "frontend/native/thread-status-hints.mjs",
		"globalName": "CodexThreadStatusHints",
		"expectedFunctions": [
			"isRunningStatus",
			"shouldExpireRunningThreadHint",
			"shouldMarkThreadUnread"
		],
		"assetPath": "/thread-status-hints.js",
		"importSource": "frontend/native/thread-status-hints.mjs",
		"compatibilityMode": "native-esm",
		"classicLoaderExcluded": true,
		"bytes": 10655
	},
	{
		"id": "thread-detail-patch-plan",
		"source": "public/thread-detail-patch-plan.js",
		"nativeSource": "frontend/native/thread-detail-patch-plan.mjs",
		"globalName": "CodexThreadDetailPatchPlan",
		"expectedFunctions": [
			"planThreadDetailDomPatchSurface",
			"planThreadDetailRefreshDomPatch",
			"planVisibleItemRefreshPatch"
		],
		"assetPath": "/thread-detail-patch-plan.js",
		"importSource": "frontend/native/thread-detail-patch-plan.mjs",
		"compatibilityMode": "native-esm",
		"classicLoaderExcluded": true,
		"bytes": 9589
	},
	{
		"id": "thread-detail-actions",
		"source": "public/thread-detail-actions.js",
		"nativeSource": "frontend/native/thread-detail-actions.mjs",
		"globalName": "CodexThreadDetailActions",
		"expectedFunctions": [
			"closestWithin",
			"contextThreadIdFromNode",
			"previewableImageFromTarget",
			"resolveRichContentClickAction",
			"resolveThreadDetailClickAction"
		],
		"assetPath": "/thread-detail-actions.js",
		"importSource": "frontend/native/thread-detail-actions.mjs",
		"compatibilityMode": "native-esm",
		"classicLoaderExcluded": true,
		"bytes": 5362
	}
];
var moduleApis = {
	"composer-runtime": api$6,
	"composer-bridge-runtime": api$5,
	"api-client-runtime": apiClientRuntimeApi,
	"thread-list-load-policy": thread_list_load_policy_default,
	"thread-list-stable-order": api$3,
	"thread-status-hints": api$2,
	"thread-detail-patch-plan": api$1,
	"thread-detail-actions": api
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
			ok: runtime && typeof runtime.refreshPageForNewBuild === "function" && client === "客户端 v625 · a5a3d596240d" && version === "v0.1.11 · 客户端 v625 · a5a3d596240d" && updateLine === "Update available: abc123" && publicLine === "Public latest: def456" && serverBuild === "client-a",
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
