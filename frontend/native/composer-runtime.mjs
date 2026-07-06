"use strict";

const root = typeof globalThis !== "undefined" ? globalThis : window;

function createComposerRuntime(deps = {}) {
  const {
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
    composerTargetThread = () => null,
    connectEvents,
    composerTargetActiveTurnId,
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
    writeCurrentDraftToKey,
  } = deps;

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
      hasContent: composerHasContent(),
    });
  }, 9500);
}

function finishSendProgressWatchdog() {
  clearSendProgressWatchdog();
  state.sendProgressStartAt = 0;
  state.sendProgressWarned = false;
}

function normalizeClientErrorMessage(message, err = null) {
  const code = String(err && err.code || "").trim();
  if (code === "codex_account_auth_invalid") {
    return "Codex 账号登录已失效，请重新登录该账号，或切换到可用账号后重试。";
  }
  const text = String(message || "").toLowerCase();
  if (/token_expired|refresh_token_reused|refresh token|access token/.test(text)) {
    return "Codex 账号登录已失效，请重新登录该账号，或切换到可用账号后重试。";
  }
  if (text.includes("failed to fetch")) {
    return "网络异常，发送失败：请求未发出，请检查网络后重试";
  }
  if (/(rate\s*limit|usage\s*limit|quota|limit reached|exhausted|insufficient credits?)/i.test(String(message || ""))) {
    const model = selectedQuotaModel();
    return model
      ? `${labelForModel(model)} 额度不足，请切换模型后重试`
      : "模型额度不足，请切换模型后重试";
  }
  if (text.includes("request timed out")) {
    return "请求超时，服务响应较慢，请稍后再试";
  }
  if (text.includes("request cancelled")) {
    return "请求被取消，稍后可重试";
  }
  if (/\bunauthorized\b/.test(text)) {
    return "登录已失效，请重新登录";
  }
  if (/\brpc timeout\b/.test(text)) {
    return "请求服务端超时，请稍后重试";
  }
  return rawMessageFallback(message);
}

function rawMessageFallback(message) {
  const text = String(message || "").trim();
  return text || "操作失败，请重试";
}

function composerText() {
  const el = $("messageInput");
  return (el ? el.innerText : "")
    .replace(/\u00a0/g, " ")
    .replace(/\n+$/g, "")
    .trim();
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
  if (options.ensureEnabled !== false
    && (input.contentEditable === "false" || input.getAttribute("aria-disabled") === "true")) {
    setMessageInputDisabled(false);
  }
  if (input.contentEditable === "false" || input.getAttribute("aria-disabled") === "true") return false;
  if (options.resetActiveFocus
    && document.activeElement === input
    && (!isAndroidBrowser() || options.allowAndroidActiveFocusReset)) {
    try {
      input.blur();
    } catch (_) {}
  }
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
  if (options.retry && document.activeElement !== input) {
    window.setTimeout(() => focusMessageInput(Object.assign({}, options, { retry: false })), 30);
  }
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
  const now = Date.now();
  return now - Number(state.messageInputKeyboardRecoveryAt || 0) > 450;
}

function recoverMessageInputKeyboardFromGesture() {
  const wasFocused = Boolean(state.messageInputPointerWasFocused);
  state.messageInputPointerWasFocused = false;
  if (!wasFocused) return false;
  if (!shouldRecoverMessageInputKeyboard()) return false;
  state.messageInputKeyboardRecoveryAt = Date.now();
  return focusMessageInput(isAndroidBrowser() ? {
    moveCaretToEnd: false,
    retry: true,
  } : {
    moveCaretToEnd: false,
    resetActiveFocus: true,
    allowAndroidActiveFocusReset: true,
    retry: true,
  });
}

function messageInputCanEnableForNativeGesture() {
  if (state.composerBusy || state.attachmentProcessingCount > 0) return false;
  if (state.newThreadDraft) return true;
  return Boolean(state.currentThreadId
    && state.currentThread
    && !state.currentThread.mobileLoading
    && !state.currentThread.mobileLoadError);
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
  if (input.contentEditable === "false" || input.getAttribute("aria-disabled") === "true") {
    setMessageInputDisabled(false);
  }
  releaseStaleAndroidMessageInputFocusBeforeNativeTap(input);
}

function normalizedComposerIntentText(value) {
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00a0/g, " ")
    .trim();
}

function isAtLoopCommandText(value) {
  const text = normalizedComposerIntentText(value);
  return /^@loop(?:\s|$)/i.test(text)
    || /^@[a-z0-9][a-z0-9_-]*\s+@loop(?:\s|$)/i.test(text);
}

function atLoopCommandObjectiveText(value) {
  const text = normalizedComposerIntentText(value);
  if (/^@loop(?:\s|$)/i.test(text)) {
    return text.replace(/^@loop(?:\s+|$)/i, "").trim();
  }
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
  const sourceRequirementsStatus = loop.sourceRequirementsStatus && typeof loop.sourceRequirementsStatus === "object"
    ? loop.sourceRequirementsStatus
    : {};
  const loopId = String(loop.loopId || "");
  const loopStatus = String(loop.status || "");
  const nextRoute = String(loop.nextRoute || "");
  const missingSections = Array.isArray(sourceRequirementsStatus.missingSections)
    ? sourceRequirementsStatus.missingSections.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 6)
    : [];
  const waitingSourceRequirements = Boolean(sourceRequirementsStatus.pending)
    || loopStatus === "waiting_source_requirements"
    || nextRoute === "source_requirements_pending";
  if (waitingSourceRequirements) {
    const missingText = missingSections.map(atLoopPacketSectionLabel).filter(Boolean).join("、");
    return {
      loopId,
      waitingSourceRequirements: true,
      loopStatus: loopStatus || "waiting_source_requirements",
      nextRoute: nextRoute || "source_requirements_pending",
      missingSections,
      statusText: missingText
        ? `Loop 等待主线程需求分析：${missingText}`
        : "Loop 等待主线程需求分析",
      activityText: "Loop 等待需求分析",
    };
  }
  return {
    loopId,
    waitingSourceRequirements: false,
    loopStatus,
    nextRoute,
    missingSections,
    statusText: loopId ? `Loop 已启动：${loopId.slice(0, 12)}` : "Loop 已启动",
    activityText: "Loop 已启动",
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
      submitLabel: "打开目标",
    },
    {
      kind: "chatgpt-pro",
      tag: "@ChatGPT Pro",
      label: "ChatGPT Pro",
      detail: "用专用 Pro 线程生成分析文档",
      title: "ChatGPT Pro 分析",
      subtitle: "输入要交给 ChatGPT Pro 分析的问题；内容不会进入当前工作线程。",
      placeholder: "写清要分析的代码、方案、风险或决策问题。",
      submitLabel: "提交 Pro 分析",
    },
    {
      kind: "loop",
      tag: "@loop",
      label: "Loop",
      detail: "启动当前线程交付循环",
      title: "Loop",
      subtitle: "输入要循环推进的目标；提交后会创建第一张角色任务卡片。",
      placeholder: "写清目标、约束和验收标准。",
      submitLabel: "启动 Loop",
    },
  ];
}

function composerIntentOption(kind) {
  return composerIntentOptions().find((item) => item.kind === kind) || null;
}

function composerIntentDraftKey(kind) {
  const scope = currentDraftKey() || (state.currentThreadId ? `thread:${state.currentThreadId}` : "new-thread");
  return `${scope}::${String(kind || "").trim()}`;
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
      evidence_confidence: 0.78,
      error_code: diagnosticErrorCode(err, action === "reply" ? "task_card_return_failed" : "task_card_action_failed"),
      context: {
        surface: "task-card",
        action: homeAiDiagnosticReportingApi.boundedToken(action, "mutate", 40),
        thread_hash: diagnosticThreadHash(state.currentThreadId),
        task_hash: diagnosticTaskHash(id),
      },
      counts: {
        status_code: diagnosticErrorStatus(err),
      },
      breadcrumbs: [{
        kind: "task-card",
        code: homeAiDiagnosticReportingApi.boundedToken(action, "mutate", 40),
        status: "failed",
        fields: {
          status_code: diagnosticErrorStatus(err),
          task_hash: diagnosticTaskHash(id),
        },
      }],
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
  fitComposerPopupToAnchor(menu, anchor, { minWidth: 280, maxWidth: 420 });
}

function updateComposerIntentMenu() {
  if (shouldShowComposerIntentMenu()) {
    if (!state.composerIntentMenuOpen) openComposerIntentMenu();
    else positionComposerIntentMenu();
  } else {
    closeComposerIntentMenu();
  }
}

function queueComposerIntentMenuUpdate() {
  window.setTimeout(updateComposerIntentMenu, 0);
}

function openSelectedComposerIntentDialog(kind, options = {}) {
  const option = composerIntentOption(kind);
  if (!option) return false;
  if (kind === "goal") {
    if (state.newThreadDraft) {
      showError(new Error(`${option.label} is only available in an existing thread`));
      return false;
    }
    if (state.pendingAttachments.length) {
      showError(new Error("Goal commands do not support attachments"));
      return false;
    }
    const targetThreadId = currentComposerThreadId();
    if (!targetThreadId || typeof openThreadGoalDialog !== "function") {
      showError(new Error("No thread is selected"));
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
    showError(new Error(`${option.label} is only available in an existing thread`));
    return false;
  }
  if (state.pendingAttachments.length) {
    showError(new Error(`${option.tag} does not support attachments in this entry point`));
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
    if (kind === "chatgpt-pro") {
      await submitChatGptProRequest(`${option.tag} ${body}`, { rethrow: true });
    } else if (kind === "loop") {
      intentResult = await submitAtLoopRequest(`${option.tag} ${body}`, { rethrow: true });
    } else if (kind === "task-card" || kind === "task-card-auto") {
      await sendThreadTaskCardCommand(`${option.tag} ${body}`, { rethrow: true });
    }
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
  const option = composerIntentOption(kind);
  if (!option) return;
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
  const alreadyApplied = currentContentEditable === nextContentEditable
    && currentAriaDisabled === nextAriaDisabled
    && el.tabIndex === nextTabIndex
    && currentClassDisabled === disabled;
  if (alreadyApplied) return;

  const preserveImeConnection = (state.composerComposing || keepAndroidEditorConnection)
    && currentContentEditable === "true";
  if (!preserveImeConnection && currentContentEditable !== nextContentEditable) {
    el.contentEditable = nextContentEditable;
  }
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
  return viewportMetrics.cssPixel(inlineHeight || (el && el.getBoundingClientRect && el.getBoundingClientRect().height) || 0);
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
  return (attachments || [])
    .map((item) => {
      const file = item && item.file;
      if (!file) return null;
      const previewUrl = localAttachmentPreviewUrl(item);
      if (!previewUrl) return null;
      const name = String(file.name || "upload");
      const mimeType = String(file.type || "").toLowerCase();
      const imageLike = mimeType.startsWith("image/") || /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)$/i.test(name);
      if (!imageLike) return null;
      return {
        type: "input_image",
        image_url: { url: previewUrl },
        fileName: name,
      };
    })
    .filter(Boolean);
}

function localUserMessageItem(text, attachments, clientSubmissionId) {
  const content = [{
    type: "text",
    text: appendLocalAttachmentSummary(text, attachments),
    text_elements: [],
  }];
  content.push(...localImageInputPartsForAttachments(attachments));
  return {
    id: `local-user-${clientSubmissionId || Date.now()}`,
    type: "userMessage",
    mobilePendingSubmission: true,
    clientSubmissionId: clientSubmissionId || "",
    startedAtMs: Date.now(),
    content,
  };
}

function attachmentId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pendingAttachmentBytes(extra = []) {
  return state.pendingAttachments.reduce((total, item) => total + item.file.size, 0)
    + extra.reduce((total, file) => total + file.size, 0);
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
      message: err && err.message ? err.message : String(err),
    });
    return file;
  }
}

async function prepareAttachmentFiles(files) {
  const prepared = [];
  for (const file of files) {
    prepared.push(await prepareAttachmentFile(file));
  }
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
      showError(new Error(`Too many attachments; max ${state.maxUploadFiles}`));
      break;
    }
    if (pendingAttachmentBytes(accepted.concat(file)) > state.maxUploadBytes) {
      showError(new Error(`Attachments are too large; max ${formatFileSize(state.maxUploadBytes)}`));
      break;
    }
    accepted.push(file);
  }
  for (const file of accepted) {
    const previewUrl = file.type && file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
    state.pendingAttachments.push({ id: attachmentId(), file, previewUrl });
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
  if (draftKey) {
    deleteDraftAttachments(draftKey, [id]).catch((err) => {
      postClientEvent("draft_attachment_remove_failed", { message: err.message || String(err) });
    });
  }
  scheduleCurrentDraftSave();
}

function clearPendingAttachments(options = {}) {
  const draftKey = currentDraftKey();
  const attachmentsToReleaseLater = options.revokePreviewUrls === false ? state.pendingAttachments.slice() : [];
  replacePendingAttachments([], {
    saveDraft: false,
    revokePreviewUrls: options.revokePreviewUrls,
  });
  if (attachmentsToReleaseLater.length) scheduleAttachmentPreviewUrlRevoke(attachmentsToReleaseLater);
  if (options.deleteDraft !== false && draftKey) {
    deleteDraftAttachments(draftKey).catch((err) => {
      postClientEvent("draft_attachment_clear_failed", { message: err.message || String(err) });
    });
  }
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
    const thumb = item.previewUrl
      ? `<img class="attachment-thumb" src="${escapeHtml(item.previewUrl)}" alt="">`
      : `<div class="attachment-file-icon" aria-hidden="true"></div>`;
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
  return (thread && thread.model) || state.defaultModel || "";
}

function effectiveDefaultEffort(thread = composerTargetThread()) {
  return (thread && thread.effort) || state.defaultReasoningEffort || "";
}

function effectiveDefaultPermissionMode(thread = composerTargetThread()) {
  const settings = thread && thread.runtimeSettings;
  const sandboxType = String((settings && settings.sandboxPolicyType) || "").replace(/[-_]/g, "").toLowerCase();
  if (sandboxType === "dangerfullaccess") return "full";
  return effectiveComposerPermissionMode((settings && settings.permissionMode) || "");
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
  return effectiveComposerPermissionMode(state.composerPermissionMode || effectiveDefaultPermissionMode())
    || defaultNewThreadPermissionMode();
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
  if (kind === "model") return normalizeOptionList([selectedComposerModel(), state.defaultModel, ...state.modelOptions]);
  if (kind === "effort") return normalizeOptionList([selectedComposerEffort(), state.defaultReasoningEffort, ...state.reasoningEffortOptions]);
  if (kind === "permission") return normalizeOptionList([selectedComposerPermissionMode(), defaultNewThreadPermissionMode(), ...state.permissionModeOptions]);
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
  } catch (_) {
    // Ignore storage errors; Fast state is now stored in the per-target draft.
  }
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
  for (const id of ["composerModelControl", "composerEffortControl", "composerPermissionControl"]) {
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
  const options = runtimeOptionValues(kind);
  menu.innerHTML = options.map((value) => {
    const isSelected = value === selected ? " is-selected" : "";
    return `<button type="button" class="composer-runtime-option${isSelected}" role="option" aria-selected="${value === selected ? "true" : "false"}" data-runtime-kind="${escapeHtml(kind)}" data-runtime-value="${escapeHtml(value)}">${escapeHtml(runtimeOptionLabel(kind, value))}</button>`;
  }).join("");
  menu.hidden = false;
  state.composerMenuKind = kind;
  for (const id of ["composerModelControl", "composerEffortControl", "composerPermissionControl"]) {
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
  const viewportWidth = Math.round((visualViewport && visualViewport.width) || window.innerWidth || 0);
  const viewportHeight = Math.round((visualViewport && visualViewport.height) || window.innerHeight || 0);
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
    visible: Boolean(rect && rect.bottom > 0 && rect.top < viewportHeight && rect.right > 0 && rect.left < viewportWidth),
  };
}

function reportComposerRuntimeMenu(kind, triggerType) {
  const schedule = typeof window.requestAnimationFrame === "function"
    ? window.requestAnimationFrame.bind(window)
    : (callback) => window.setTimeout(callback, 0);
  schedule(() => postClientEvent("composer_runtime_menu_opened", composerRuntimeMenuDiagnostics(kind, triggerType)));
}

function handleComposerRuntimeControl(event, kind, button) {
  event.preventDefault();
  event.stopPropagation();
  if (button.disabled) {
    postClientEvent("composer_runtime_control_ignored", { kind, triggerType: event.type, reason: "disabled" });
    return;
  }
  if (state.composerMenuKind === kind) {
    closeComposerRuntimeMenu();
    postClientEvent("composer_runtime_menu_closed", { kind, triggerType: event.type });
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
  const viewportWidth = Math.max(1, Math.floor((visualViewport && visualViewport.width) || window.innerWidth || document.documentElement.clientWidth || maxWidth));
  const viewportHeight = Math.max(1, Math.floor((visualViewport && visualViewport.height) || window.innerHeight || document.documentElement.clientHeight || 360));
  const rawRect = anchor && typeof anchor.getBoundingClientRect === "function" ? anchor.getBoundingClientRect() : null;
  const rawVisible = Boolean(rawRect
    && rawRect.width > 0
    && rawRect.height > 0
    && rawRect.right > viewportLeft
    && rawRect.left < viewportLeft + viewportWidth
    && rawRect.bottom > viewportTop
    && rawRect.top < viewportTop + viewportHeight);
  const fallbackAnchorWidth = Math.min(128, Math.max(48, viewportWidth - 24));
  const fallbackAnchorHeight = 30;
  const fallbackAnchorBottom = Math.max(64, Math.min(96, viewportHeight * 0.18));
  const rect = rawVisible ? rawRect : {
    left: viewportLeft + viewportWidth - fallbackAnchorWidth - 12,
    right: viewportLeft + viewportWidth - 12,
    top: viewportTop + viewportHeight - fallbackAnchorBottom - fallbackAnchorHeight,
    bottom: viewportTop + viewportHeight - fallbackAnchorBottom,
    width: fallbackAnchorWidth,
    height: fallbackAnchorHeight,
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
  if ((panel && panel.contains(target)) || (quota && quota.contains(target))) return;
  closeQuotaDetails();
}

function toggleQuotaDetails(anchor) {
  closeComposerRuntimeMenu();
  state.quotaDetailsOpen = !state.quotaDetailsOpen;
  renderQuotaUsage();
  const panel = $("quotaDetailPanel");
  if (state.quotaDetailsOpen && panel && anchor) {
    fitComposerPopupToAnchor(panel, anchor, { minWidth: 320, maxWidth: 390 });
    document.addEventListener("pointerdown", onQuotaOutsidePointer);
  } else {
    document.removeEventListener("pointerdown", onQuotaOutsidePointer);
  }
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
    defaultPlaceholder: "Message Codex",
  }).text;
}

function composerShowsTargetPlaceholder() {
  const targetThreadId = currentComposerThreadId();
  const targetThread = composerTargetThread();
  return threadTileStatePolicy.composerTargetPlaceholderPlan({
    newThreadDraft: state.newThreadDraft,
    tileContext: isThreadTileComposerContext(),
    targetThreadId,
    hasTargetThread: Boolean(targetThread),
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
  if (plan.ariaLabel) {
    sendButton.setAttribute("aria-label", plan.ariaLabel);
  } else {
    sendButton.removeAttribute("aria-label");
  }
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
    [modelControl, selectedModel ? labelForModel(selectedModel) : "--", state.newThreadDraft || state.composerModel ? "下一轮使用" : "当前记录"],
    [effortControl, selectedEffort ? labelForEffort(selectedEffort) : "--", state.newThreadDraft || state.composerEffort ? "下一轮使用" : "当前记录"],
    [permissionControl, selectedPermission ? labelForPermissionMode(selectedPermission).replace(/权限$/, "") : "--", state.newThreadDraft || state.composerPermissionMode ? "下一轮使用" : "当前记录"],
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
  const hasThread = Boolean(targetThreadId
    && targetThread
    && !targetThread.mobileLoading
    && !targetThread.mobileLoadError);
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
    hermesEmbedMode: isHermesEmbedMode(),
  });
  const disabled = composerActionPlan.disabled === true;
  const sendButton = $("sendMessage");
  const attachButton = $("attachFiles");
  const messageInput = $("messageInput");
  for (const id of ["composerIntentBodyInput", "composerIntentSubmitButton", "composerIntentSaveButton"]) {
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
  for (const id of ["composerCommandControl", "composerModelControl", "composerEffortControl", "composerPermissionControl", "quotaUsage"]) {
    const button = $(id);
    if (button) button.disabled = disabled;
  }
  applyComposerActionControlPlan(sendButton, composerActionPlan);
  publishPluginVoiceInputCapability();
}

function hasTransferFiles(event) {
  const types = Array.from((event.dataTransfer && event.dataTransfer.types) || []);
  return types.includes("Files");
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
    showError(new Error("No thread is selected"));
    return null;
  }
  if (requireObjective && !objective) {
    showError(new Error("Goal objective is required"));
    if (objectiveInput) objectiveInput.focus();
    return null;
  }
  let tokenBudget = 0;
  if (rawBudget) {
    tokenBudget = Number(rawBudget);
    if (!Number.isFinite(tokenBudget) || tokenBudget <= 0) {
      showError(new Error("Token budget must be a positive number"));
      if (budgetInput) budgetInput.focus();
      return null;
    }
    tokenBudget = Math.trunc(tokenBudget);
  }
  return {
    thread,
    threadId,
    objective,
    tokenBudget: tokenBudget > 0 ? tokenBudget : null,
  };
}

async function submitThreadGoalMessage(event) {
  if (event && typeof event.preventDefault === "function") event.preventDefault();
  if (state.goalSubmitBusy || state.composerBusy) {
    if (state.composerBusy) showError(new Error("A message is already sending"));
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
        tokenBudget,
      }),
      timeoutMs: 30000,
    });
    const responseGoal = normalizeThreadGoal(result && result.goal, threadId);
    const visibleGoal = responseGoal || submittedThreadGoal(threadId, objective, tokenBudget);
    if (visibleGoal) updateThreadGoalState(threadId, visibleGoal);
    closeThreadGoalDialog(true);
    $("connectionState").classList.remove("error");
    $("connectionState").textContent = "Goal set";
    markActivity("Goal set");
    postClientEvent("goal_request_success", { threadId, hasResponseGoal: Boolean(responseGoal) });
    if (threadId === state.currentThreadId) scheduleCurrentThreadRefresh(600);
    loadThreads({ silent: true }).catch(showError);
  } catch (err) {
    const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err))
      || "Goal set failed";
    $("connectionState").classList.add("error");
    $("connectionState").textContent = message;
    postClientEvent("goal_request_failure", {
      threadId,
      message,
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
    if (state.composerBusy) showError(new Error("A message is already sending"));
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
    postClientEvent("goal_action_start", { threadId, action: normalizedAction });
    const result = await api(`/api/threads/${encodeURIComponent(threadId)}/goal/actions`, {
      method: "POST",
      body: JSON.stringify({
        action: normalizedAction,
        objective: objective || undefined,
        tokenBudget,
      }),
      timeoutMs: 30000,
    });
    const responseGoal = normalizeThreadGoal(result && result.goal, threadId);
    if (normalizedAction === "cancel") {
      updateThreadGoalState(threadId, null);
    } else if (responseGoal) {
      updateThreadGoalState(threadId, responseGoal);
    } else if (objective) {
      updateThreadGoalState(threadId, submittedThreadGoal(threadId, objective, tokenBudget));
    }
    closeThreadGoalDialog(true);
    $("connectionState").classList.remove("error");
    $("connectionState").textContent = threadGoalActionStatusText(normalizedAction);
    markActivity(threadGoalActionStatusText(normalizedAction));
    postClientEvent("goal_action_success", { threadId, action: normalizedAction, hasResponseGoal: Boolean(responseGoal) });
    if (threadId === state.currentThreadId) scheduleCurrentThreadRefresh(600);
    loadThreads({ silent: true }).catch(showError);
  } catch (err) {
    const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err))
      || "Goal action failed";
    $("connectionState").classList.add("error");
    $("connectionState").textContent = message;
    postClientEvent("goal_action_failure", {
      threadId,
      action: normalizedAction,
      message,
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
    eventType: event && event.type || "",
  });
  requestGoalDialogSubmit();
}

function requestGoalDialogSubmit() {
  const form = $("goalForm");
  if (form && typeof form.requestSubmit === "function") {
    form.requestSubmit();
  } else {
    submitThreadGoalMessage().catch(showError);
  }
}

async function sendThreadTaskCardCommand(commandText, options = {}) {
  const text = String(commandText || "").trim();
  const targetThreadId = currentComposerThreadId();
  const targetThread = composerTargetThread();
  if (!text || !targetThreadId) return false;
  if (state.pendingAttachments.length) {
    const err = new Error("Task-card commands do not support attachments yet");
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
      timeoutMs: 180000,
    });
    const serverTurnId = startedTurnId(result);
    if (serverTurnId && reconcileSubmittedUserMessageTurn(targetThreadId, clientSubmissionId, serverTurnId)) {
      renderCurrentThread({ stickToBottom: true });
    }
    commitPluginVoiceInputSessionsAfterSend(submittedDraftKey, text, {
      threadId: targetThreadId,
      messageId: clientSubmissionId,
      composerId: "thread-composer",
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
        thread_hash: diagnosticThreadHash(targetThreadId),
      },
    });
    scheduleComposerTargetRefresh(targetThreadId, 600, "task-card-submit");
    scheduleLivePollIfNeeded(1200);
    loadThreads({ silent: true }).catch(showError);
    return true;
  } catch (err) {
    clearSubmittedMessageBottomFollow();
    const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err), err)
      || "任务卡片提交失败，请重试";
    state.sendButtonHint = "重试";
    markSubmittedUserMessageFailed(targetThreadId, outboundText, [], clientSubmissionId, message);
    $("connectionState").classList.remove("error");
    $("connectionState").textContent = "发送失败，详情见消息回执";
    postClientEvent("send_failure", {
      threadId: targetThreadId || "",
      message,
      steering: false,
      taskCardCommand: true,
    });
    recordHomeAiDiagnosticFailure({
      category: "task_card_workflow_failed",
      diagnostic_type: "task_card_draft_request_failed",
      severity_hint: "H2",
      evidence_confidence: 0.76,
      error_code: diagnosticErrorCode(err, "task_card_draft_request_failed"),
      context: {
        surface: "task-card",
        action: "draft-request",
        thread_hash: diagnosticThreadHash(targetThreadId),
      },
      counts: {
        status_code: diagnosticErrorStatus(err),
      },
      breadcrumbs: [{
        kind: "task-card",
        code: "draft-request",
        status: "failed",
        fields: {
          status_code: diagnosticErrorStatus(err),
          thread_hash: diagnosticThreadHash(targetThreadId),
        },
      }],
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
    const err = new Error("Loop objective is required");
    showError(err);
    if (options.rethrow) throw err;
    return false;
  }
  if (state.newThreadDraft || !targetThreadId) {
    const err = new Error("Loop is only available in an existing thread");
    showError(err);
    if (options.rethrow) throw err;
    return false;
  }
  if (state.pendingAttachments.length) {
    const err = new Error("@loop does not support attachments in this entry point");
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
        text,
      }),
      timeoutMs: 60000,
    });
    if (result && result.ok === false) {
      throw new Error(result.error || "at_loop_start_failed");
    }
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
      missingSections: outcome.missingSections,
    });
    scheduleComposerTargetRefresh(targetThreadId, 700, "at-loop-submit");
    scheduleLivePollIfNeeded(1200);
    loadThreads({ silent: true }).catch(showError);
    return outcome;
  } catch (err) {
    const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err), err)
      || "Loop 启动失败";
    $("connectionState").classList.add("error");
    $("connectionState").textContent = message;
    postClientEvent("at_loop_request_failure", {
      threadId: targetThreadId,
      message,
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
  const threadGoalCommand = isThreadGoalCommandText(text);
  if (threadGoalCommand) {
    if (state.newThreadDraft) {
      showError(new Error("Goal is only available in an existing thread"));
      return;
    }
    if (state.pendingAttachments.length) {
      showError(new Error("Goal commands do not support attachments"));
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
  if ((!text && !state.pendingAttachments.length) || !targetThreadId) return;
  const threadTaskCardCommand = isThreadTaskCardCommandText(text);
  if (threadTaskCardCommand && state.pendingAttachments.length) {
    showError(new Error("# task-card commands do not support attachments yet"));
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
  if (typeof recordSubmittedEchoDiagnosticLog === "function") {
    recordSubmittedEchoDiagnosticLog("submit-start", {
      threadId: targetThreadId,
      clientSubmissionId,
      activeTurnHash: diagnosticTurnHash(targetActiveTurnId),
      steering,
      hasText: Boolean(outboundText),
      textLength: String(outboundText || "").length,
      attachmentCount: submittedAttachments.length,
      composerBusyBeforeSet: state.composerBusy,
    });
  }
  state.composerBusy = true;
  state.sendButtonHint = "";
  startSendProgressWatchdog(targetThreadId);
  if (steering) setSteerFeedback("sending", { threadId: targetThreadId, turnId: steerTurnId, clientSubmissionId });
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
    for (const item of state.pendingAttachments) {
      body.append("attachments", item.file, item.file.name || "upload");
    }
    registerSubmittedUserMessage(targetThreadId, outboundText, submittedAttachments, clientSubmissionId);
    const insertedLocalMessage = insertLocalSubmittedUserMessage(targetThreadId, outboundText, submittedAttachments, clientSubmissionId, {
      turnId: steering ? steerTurnId : "",
    });
    if (typeof recordSubmittedEchoDiagnosticLog === "function") {
      recordSubmittedEchoDiagnosticLog("local-insert-result", {
        threadId: targetThreadId,
        clientSubmissionId,
        insertedLocalMessage,
        steering,
      });
    }
    if (!steering) {
      markThreadOptimisticallyActive(targetThreadId);
      renderThreads();
    }
    if (insertedLocalMessage) {
      renderCurrentThread({ stickToBottom: true });
      if (typeof recordSubmittedEchoDiagnosticLog === "function") {
        recordSubmittedEchoDiagnosticLog("local-rendered", {
          threadId: targetThreadId,
          clientSubmissionId,
          insertedLocalMessage,
          steering,
        });
      }
    }
    scheduleSubmittedMessageDomProbe(targetThreadId, clientSubmissionId, steering ? "message-steer" : "message-submit");
    followSubmittedMessageToBottom(targetThreadId, clientSubmissionId);
    const result = await api(`/api/threads/${encodeURIComponent(targetThreadId)}/messages`, {
      method: "POST",
      body,
      timeoutMs: 180000,
    });
    const serverTurnId = startedTurnId(result);
    if (typeof recordSubmittedEchoDiagnosticLog === "function") {
      recordSubmittedEchoDiagnosticLog("post-response", {
        threadId: targetThreadId,
        clientSubmissionId,
        serverTurnHash: diagnosticTurnHash(serverTurnId),
        steering,
        resultKeys: result && typeof result === "object" ? Object.keys(result).sort().slice(0, 20) : [],
        steeringQueued: Boolean(result && result.steeringQueued),
      });
    }
    const reconciledSubmittedUserMessage = serverTurnId
      && reconcileSubmittedUserMessageTurn(targetThreadId, clientSubmissionId, serverTurnId);
    if (typeof recordSubmittedEchoDiagnosticLog === "function") {
      recordSubmittedEchoDiagnosticLog("post-reconcile-result", {
        threadId: targetThreadId,
        clientSubmissionId,
        serverTurnHash: diagnosticTurnHash(serverTurnId),
        steering,
        reconciled: Boolean(reconciledSubmittedUserMessage),
      });
    }
    if (reconciledSubmittedUserMessage) {
      renderCurrentThread({ stickToBottom: true });
      if (typeof recordSubmittedEchoDiagnosticLog === "function") {
        recordSubmittedEchoDiagnosticLog("post-reconcile-rendered", {
          threadId: targetThreadId,
          clientSubmissionId,
          serverTurnHash: diagnosticTurnHash(serverTurnId),
          steering,
        });
      }
    }
    commitPluginVoiceInputSessionsAfterSend(submittedDraftKey, text, {
      threadId: targetThreadId,
      messageId: clientSubmissionId,
      composerId: "thread-composer",
    });
    setComposerText("");
    clearPendingAttachments({ revokePreviewUrls: false });
    writeCurrentDraftToKey(submittedDraftKey);
    if (!steering) {
      renderComposerSettings();
    }
    input.blur();
    $("connectionState").classList.remove("error");
    if (steering) {
      const steerStatus = result && result.steeringQueued ? "queued" : "delivered";
      setSteerFeedback(steerStatus, { threadId: targetThreadId, turnId: steerTurnId, clientSubmissionId });
    }
    else {
      $("connectionState").textContent = "Sent";
      markActivity("已发送");
    }
    scheduleComposerTargetRefresh(targetThreadId, 250, "message-submit");
    if (typeof schedulePostCompletionThreadRefreshes === "function") {
      schedulePostCompletionThreadRefreshes(targetThreadId, [350, 750, 1200, 2400, 5200]);
    }
    if (typeof scheduleUsageBackfillRefresh === "function" && state.currentThreadId === targetThreadId) {
      scheduleUsageBackfillRefresh(750, { force: true });
    }
    scheduleLivePollIfNeeded(1200);
    loadThreads({ silent: true }).catch(showError);
  } catch (err) {
    clearSubmittedMessageBottomFollow();
    if (!steering) {
      restoreThreadStatusSnapshot(previousThreadStatus);
      renderThreads();
    }
    const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err), err)
      || "发送失败，请重试";
    state.sendButtonHint = "重试";
    markSubmittedUserMessageFailed(targetThreadId, outboundText, submittedAttachments, clientSubmissionId, message);
    if (steering) setSteerFeedback("failed", { threadId: targetThreadId, turnId: steerTurnId, clientSubmissionId });
    else {
      $("connectionState").classList.remove("error");
      $("connectionState").textContent = "发送失败，详情见消息回执";
    }
    postClientEvent("send_failure", {
      threadId: targetThreadId || "",
      message,
      steering,
    });
    if (typeof recordSubmittedEchoDiagnosticLog === "function") {
      recordSubmittedEchoDiagnosticLog("send-error", {
        threadId: targetThreadId,
        clientSubmissionId,
        steering,
        errorCode: diagnosticErrorCode(err, "send_failed"),
        statusCode: diagnosticErrorStatus(err),
      });
    }
  } finally {
    finishSendProgressWatchdog();
    state.composerBusy = false;
    updateComposerControls();
    if (typeof recordSubmittedEchoDiagnosticLog === "function") {
      recordSubmittedEchoDiagnosticLog("send-finally", {
        threadId: targetThreadId,
        clientSubmissionId,
        steering,
        composerBusy: state.composerBusy,
      });
    }
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
    for (const item of state.pendingAttachments) {
      body.append("attachments", item.file, item.file.name || "upload");
    }
    const result = await api("/api/threads/new-message", {
      method: "POST",
      body,
      timeoutMs: 180000,
    });
    const threadId = String((result && result.threadId) || (result && result.thread && result.thread.id) || "");
    if (!threadId) throw new Error("新对话创建失败：未返回 threadId");
    commitPluginVoiceInputSessionsAfterSend(submittedDraftKey, text, {
      threadId,
      messageId: clientSubmissionId,
      composerId: "new-thread-composer",
    });
    registerSubmittedUserMessage(threadId, text, submittedAttachments, clientSubmissionId);
    const turnId = startedTurnId(result);
    const userItem = localUserMessageItem(text, submittedAttachments, clientSubmissionId);
    const thread = Object.assign({
      id: threadId,
      name: submittedTitle || "",
      preview: submittedTitle || text || "新建对话",
      cwd: (result && result.thread && result.thread.cwd) || state.selectedCwd || "",
      status: { type: "active" },
      turns: [],
      mobileInitialSubmissionId: clientSubmissionId,
    }, result.thread || {});
    if (submittedTitle) {
      thread.name = submittedTitle;
      thread.preview = submittedTitle;
    }
    if (!thread.model && submittedModel) thread.model = submittedModel;
    if (!thread.effort && submittedEffort) thread.effort = submittedEffort;
    if (turnId) {
      const existingTurn = (thread.turns || []).find((turn) => turn && turn.id === turnId);
      if (existingTurn) {
        existingTurn.items = mergeItemsPreservingLocalVisible([userItem], existingTurn.items || [], true);
      } else {
        thread.turns = (thread.turns || []).concat([{
          id: turnId,
          status: { type: "active" },
          startedAt: Math.floor(Date.now() / 1000),
          completedAt: null,
          durationMs: null,
          items: [userItem],
        }]);
      }
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
    const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err), err)
      || "新对话创建失败，请重试";
    state.sendButtonHint = "重试";
    $("connectionState").classList.add("error");
    $("connectionState").textContent = message;
    postClientEvent("new_thread_send_failure", {
      cwd: state.selectedCwd || "",
      message,
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
    if (composerForm && typeof composerForm.requestSubmit === "function") {
      composerForm.requestSubmit();
    } else {
      sendMessage(event);
    }
  } catch (err) {
    postClientEvent("send_button_submit_exception", {
      activeElement: document.activeElement ? document.activeElement.id || document.activeElement.tagName || "" : "",
      hasContent: composerHasContent(),
      buttonDisabled: button.disabled,
      error: String(err && err.message || ""),
    });
    showError(new Error("发送按钮点击异常，请改用回车发送"));
  }
  setTimeout(() => {
    if (state.lastSendSubmitStartedAt >= now) return;
    postClientEvent("send_button_no_submit", {
      activeElement: document.activeElement ? document.activeElement.id || document.activeElement.tagName || "" : "",
      hasContent: composerHasContent(),
      buttonDisabled: button.disabled,
      composerBusy: state.composerBusy,
    });
    if (composerHasContent()) {
      showError(new Error("发送没触发，建议重试或按回车发送"));
    }
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
      error: String(err && err.message || ""),
    });
    showError(new Error("附件选择器打开失败，请重试"));
  }
}

async function interruptActiveTurn(threadId = currentComposerThreadId(), activeTurnId = composerTargetActiveTurnId()) {
  const targetThreadId = String(threadId || "").trim();
  const targetActiveTurnId = String(activeTurnId || "").trim();
  if (!targetThreadId || !targetActiveTurnId) return;
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "Interrupt requested";
  markActivity("中断");
  await api(`/api/threads/${encodeURIComponent(targetThreadId)}/turns/${encodeURIComponent(targetActiveTurnId)}/interrupt`, { method: "POST" })
    .then(() => scheduleComposerTargetRefresh(targetThreadId, 900))
    .catch(showError);
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
    interruptActiveTurn,
  };
}

const api = Object.freeze({ createComposerRuntime });

root.CodexComposerRuntime = api;

export { createComposerRuntime };
export default api;
