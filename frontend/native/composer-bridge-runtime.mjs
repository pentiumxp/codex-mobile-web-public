"use strict";

const root = typeof globalThis !== "undefined" ? globalThis : window;

function updateComposerHeightVar(...args) {
  return composerRuntime.updateComposerHeightVar(...args);
}

function showError(err) {
  const raw = err instanceof Error ? err.message : String(err || "");
  const message = normalizeClientErrorMessage(raw, err) || (err && err.message) || String(err);
  $("connectionState").textContent = message;
  $("connectionState").classList.add("error");
  postClientEvent("client_error", {
    message,
    raw,
    currentThreadId: state.currentThreadId || "",
    composerBusy: state.composerBusy,
    continuationBusy: state.continuationBusy,
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
  if (method === "thread/started" && params.thread) {
    return `${method}:${String(params.thread.id || "")}:${String(statusText(params.thread.status) || "")}`;
  }
  if (method === "thread/status/changed") {
    return `${method}:${String(params.threadId || "")}:${String(statusText(params.status) || "")}`;
  }
  if (method === "thread/name/updated") {
    return `${method}:${String(params.threadId || "")}:${String(params.threadName || "")}`;
  }
  if (method === "thread/archived") {
    return `${method}:${String(params.threadId || "")}`;
  }
  return "";
}

function shouldThrottleThreadNotification(method, params) {
  const key = threadNotificationThrottleKey(method, params);
  if (!key) return false;
  const now = Date.now();
  const lastAt = state.threadNotificationThrottle.get(key) || 0;
  if (now - lastAt < 450) return true;
  state.threadNotificationThrottle.set(key, now);
  if (state.threadNotificationThrottle.size > 220) {
    for (const [existingKey, existingAt] of state.threadNotificationThrottle.entries()) {
      if (now - existingAt > 8000) state.threadNotificationThrottle.delete(existingKey);
    }
    if (state.threadNotificationThrottle.size > 220) {
      for (const existingKey of Array.from(state.threadNotificationThrottle.keys()).slice(0, 120)) {
        state.threadNotificationThrottle.delete(existingKey);
      }
    }
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
  const key = requestId !== null && requestId !== undefined ? String(requestId) : "";
  const request = state.pendingApprovals.get(key);
  if (!request) {
    throw new Error("Server request is not available in this browser session");
  }
  if (request.status !== "waiting") return;
  const threadId = approvalActionThreadId(request, options.threadId);
  request.status = "responding";
  request.decision = payload && (payload.decision || payload.action) || "submitted";
  markActivity(isUserInputRequest(request) ? "输入发送中" : "批准中");
  scheduleApprovalThreadRender(threadId);
  try {
    const result = await api(`/api/approvals/${encodeURIComponent(key)}`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
      timeoutMs: 20000,
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
    showError(err);
    scheduleApprovalThreadRender(threadId);
  }
}

function isStaleServerRequestError(err) {
  const status = Number(err && (err.status || err.statusCode) || 0);
  const text = String(err && (err.code || err.message || err.detail) || err || "").toLowerCase();
  if (status === 404) return true;
  return text.includes("no longer pending")
    || text.includes("not pending")
    || text.includes("not found")
    || text.includes("not available");
}

function answerApproval(requestId, decision, options = {}) {
  const key = requestId !== null && requestId !== undefined ? String(requestId) : "";
  if (!key) return Promise.reject(new Error("Approval request id is missing"));
  const request = state.pendingApprovals.get(key);
  if (request) return answerServerRequest(key, { decision }, options);
  const threadId = String(options.threadId || state.currentThreadId || "").trim();
  markActivity("批准中");
  if (threadId) scheduleApprovalThreadRender(threadId);
  return api(`/api/approvals/${encodeURIComponent(key)}`, {
    method: "POST",
    body: JSON.stringify({ decision }),
    timeoutMs: 20000,
  }).then((result) => {
    if (result && result.request) {
      state.pendingApprovals.set(key, serverRequestWithThreadContext(result.request, threadId));
    }
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
      return { ok: true, stale: true };
    }
    showError(err);
    throw err;
  });
}

function serverRequestPayload(request, responseText, questionId) {
  if (request && request.method === "mcpServer/elicitation/request") {
    return { action: "accept", responseText };
  }
  return { responseText, questionId };
}

function declineServerRequest(requestId, options = {}) {
  const key = requestId !== null && requestId !== undefined ? String(requestId) : "";
  const request = state.pendingApprovals.get(key);
  if (!request) return Promise.resolve();
  if (request.method === "mcpServer/elicitation/request") {
    return answerServerRequest(key, { action: "decline" }, options);
  }
  if (request.method === "item/tool/requestUserInput") {
    return answerServerRequest(key, { answers: {} }, options);
  }
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
      timeoutMs: 30000,
    });
    if (action === "approve" && result && result.execution && result.execution.turnId) {
      $("connectionState").textContent = "Task card approved; starting target turn";
    } else {
      $("connectionState").textContent = "Task card updated";
    }
    settleThreadTaskCardForThread(threadId, id, action === "approve" ? "approved" : action === "delete" ? "deleted" : action === "revoke" ? "revoked" : "replied", result && result.card ? result.card : null);
    recordHomeAiDiagnosticSuccess({
      category: "task_card_workflow_failed",
      diagnostic_type: action === "reply" ? "task_card_return_failed" : "task_card_action_failed",
      error_code: action === "reply" ? "task_card_return_failed" : "task_card_action_failed",
      context: {
        surface: "task-card",
        action: homeAiDiagnosticReportingApi.boundedToken(action, "mutate", 40),
        thread_hash: diagnosticThreadHash(threadId),
        task_hash: diagnosticTaskHash(id),
      },
    });
    if (action === "approve" && result && result.execution && result.execution.turnId) {
      let injectedVisible = false;
      if (threadId === String(state.currentThreadId || "")) {
        injectedVisible = await waitForCurrentThreadTurn(result.execution.turnId, { timeoutMs: 10000, intervalMs: 500 });
      } else {
        scheduleComposerTargetRefresh(threadId, 300, "task-card-approved");
      }
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
    rows: 6,
  }) || "";
  if (!String(body).trim()) return;
  const title = `Reply: ${card.message && card.message.title ? card.message.title : "Task card"}`;
  return mutateThreadTaskCard(card.id, "reply", {
    format: "markdown",
    title,
    summary: summarizeTaskCardText(body),
    body: String(body).trim(),
    idempotencyKey: `task-card-reply:${card.id}:${Date.now()}:${Math.random().toString(16).slice(2, 8)}`,
  }, { threadId });
}

function findThreadTaskCardDraftByKey(draftKey, thread = renderContextThread()) {
  const key = String(draftKey || "");
  const sourceThread = renderContextThread(thread) || state.currentThread;
  const turns = Array.isArray(sourceThread && sourceThread.turns) ? sourceThread.turns : [];
  for (const turn of turns) {
    const items = Array.isArray(turn && turn.items) ? turn.items : [];
    for (const item of items) {
      if (!item || (item.type !== "agentMessage" && item.type !== "plan")) continue;
      const draft = parseThreadTaskCardDraftText(item.text || "");
      if (!draft) continue;
      const itemKey = threadTaskCardDraftKeyForDraft(turn, draft, item);
      const legacyItemKey = threadTaskCardDraftKey(turn.id, item.id || "");
      if (itemKey !== key && legacyItemKey !== key) continue;
      return { key, draft, turn, item, sourceThread };
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
  setThreadTaskCardDraftState(draftKey, { status: "dismissed", error: "" }, options);
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
    attempts: Math.max(0, Number(current.attempts || 0)) + 1,
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
      setThreadTaskCardDraftState(draftKey, { status: "pending", error: "" }, { render: false });
      return;
    }
    const { draft, turn } = resolved;
    const targetRefs = threadTaskCardDraftTargetThreads(draft);
    const targetThreadIds = threadTaskCardDraftTargetIds(draft);
    if (!targetThreadIds.length) {
      setThreadTaskCardDraftState(draftKey, { status: "failed", error: draft.error || "Draft did not include a target thread id" }, { threadId: sourceThreadId });
      return;
    }
    if (!draft.title || !draft.body) {
      setThreadTaskCardDraftState(draftKey, { status: "failed", error: draft.error || "Draft is incomplete" }, { threadId: sourceThreadId });
      return;
    }
    setThreadTaskCardDraftState(draftKey, { status: "creating", error: "" }, { threadId: sourceThreadId });
    $("connectionState").classList.remove("error");
    $("connectionState").textContent = "Creating task card";
    const body = truncateThreadTaskCardBody(draft.body);
    const targetWorkspaceIds = {};
    for (const entry of targetRefs) {
      if (entry.thread) targetWorkspaceIds[entry.threadId] = String(entry.thread.cwd || "");
    }
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
        workflowId: draft.workflowId || "",
      }),
      timeoutMs: 30000,
    });
    const createdCards = Array.isArray(result && result.cards)
      ? result.cards.filter(Boolean)
      : (result && result.card ? [result.card] : []);
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
      cardIds: createdCards.map((card) => String(card && card.id || "")).filter(Boolean),
    }, { threadId: sourceThreadId });
    $("connectionState").classList.remove("error");
    $("connectionState").textContent = createdCards.length === 1
      ? "Task card created; opening target thread"
      : `Task cards created: ${createdCards.length}`;
    state.pendingPluginRouteHint = createdCards.length === 1 ? normalizePluginRouteHint({
      pluginId: "codex-mobile",
      route: "thread-task-card",
      threadId: createdCards[0].target && createdCards[0].target.threadId || targetThreadIds[0],
      taskId: createdCards[0].id,
    }) : null;
    recordHomeAiDiagnosticSuccess({
      category: "task_card_workflow_failed",
      diagnostic_type: "task_card_draft_materialize_failed",
      error_code: "task_card_draft_materialize_failed",
      context: {
        surface: "task-card",
        action: "draft-materialize",
        thread_hash: diagnosticThreadHash(sourceThreadId),
        item_hash: diagnosticItemHash(draftKey),
      },
    });
    renderThreads();
    loadThreads({ silent: true }).catch(showError);
    if (createdCards.length === 1) {
      await loadThread(createdCards[0].target && createdCards[0].target.threadId || targetThreadIds[0], { source: "task-card-created" });
    } else {
      if (sourceThreadId === String(state.currentThreadId || "")) {
        renderCurrentThread();
      } else if (state.threadTileMode && threadTilePaneIsVisible(sourceThreadId)) {
        scheduleRenderThreadTilePane(sourceThreadId, { preserveScroll: true });
      } else {
        renderCurrentThread();
      }
    }
  } catch (err) {
    const diagnosticThreadId = String(options.threadId || state.currentThreadId || "").trim();
    setThreadTaskCardDraftState(draftKey, {
      status: "failed",
      error: normalizeClientErrorMessage(err && err.message ? err.message : String(err)) || "Task card creation failed",
    }, { threadId: diagnosticThreadId });
    recordHomeAiDiagnosticFailure({
      category: "task_card_workflow_failed",
      diagnostic_type: "task_card_draft_materialize_failed",
      severity_hint: "H2",
      evidence_confidence: 0.78,
      error_code: diagnosticErrorCode(err, "task_card_draft_materialize_failed"),
      context: {
        surface: "task-card",
        action: "draft-materialize",
        thread_hash: diagnosticThreadHash(diagnosticThreadId),
        item_hash: diagnosticItemHash(draftKey),
      },
      counts: {
        status_code: diagnosticErrorStatus(err),
      },
      breadcrumbs: [{
        kind: "task-card",
        code: "draft-materialize",
        status: "failed",
        fields: {
          status_code: diagnosticErrorStatus(err),
          item_hash: diagnosticItemHash(draftKey),
        },
      }],
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
      createThreadTaskCardDraft: typeof createThreadTaskCardDraft === "function" ? createThreadTaskCardDraft : null,
      closeQuotaDetails: typeof closeQuotaDetails === "function" ? closeQuotaDetails : null,
      toggleQuotaDetails: typeof toggleQuotaDetails === "function" ? toggleQuotaDetails : null,
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
  createThreadTaskCardDraft,
};

const api = Object.freeze({ createComposerBridgeRuntime });
for (const [name, value] of Object.entries(legacyGlobals)) {
  if (typeof value === "function") root[name] = value;
}
root.CodexComposerBridgeRuntime = api;

export { createComposerBridgeRuntime };
export default api;
