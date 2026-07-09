"use strict";

const root = typeof globalThis !== "undefined" ? globalThis : window;

function updateConnectionState(status, fallbackText = "Starting") {
  const el = $("connectionState");
  if (!el) return;
  if (status) state.connectionStatus = status;
  const hasError = Boolean(status && !status.ready && status.lastError);
  if (status && status.ready) {
    el.textContent = status.sharedRequired || String(status.transport || "").startsWith("external-")
      ? "Shared"
      : "Connected";
  } else {
    el.textContent = hasError ? status.lastError : fallbackText;
  }
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

function autoTurnRecoveryCandidate() {
  if (!state.currentThreadId) return null;
  const thread = state.currentThread || threadById(state.currentThreadId);
  const live = currentLiveTurn();
  const wasRunning = Boolean(state.activeTurnId || live || state.runningThreadIds.has(String(state.currentThreadId)) || isRunningStatus(thread && thread.status));
  if (!wasRunning) return null;
  return {
    threadId: String(state.currentThreadId),
    activeTurnId: String(state.activeTurnId || (live && live.id) || ""),
    cwd: String((thread && thread.cwd) || ""),
    wasRunning,
  };
}

function autoTurnRecoveryCandidates() {
  const byId = new Map();
  for (const thread of state.restartAutoRecoverThreads || []) {
    const normalized = normalizeRestartAutoRecoverThread(thread);
    if (normalized) byId.set(normalized.id, {
      threadId: normalized.id,
      activeTurnId: normalized.activeTurnId,
      cwd: normalized.cwd,
      wasRunning: true,
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
        reason,
      }),
      timeoutMs: 180000,
    });
    postClientEvent("auto_turn_recovery_result", {
      reason,
      threadId: candidate.threadId,
      activeTurnId: candidate.activeTurnId,
      recovered: Boolean(result && result.recovered),
      skipped: Boolean(result && result.skipped),
      action: String(result && result.action || ""),
      resultReason: String(result && result.reason || ""),
      turnId: String(result && result.turnId || ""),
    });
    if (result && result.recovered && candidate.threadId === state.currentThreadId) {
      if (result.turnId) state.activeTurnId = String(result.turnId);
      scheduleCurrentThreadRefresh(500);
      scheduleLivePollIfNeeded(1000);
    }
    return result;
  } catch (err) {
    delete state.autoTurnRecoveryRecent[key];
    postClientEvent("auto_turn_recovery_failed", {
      reason,
      threadId: candidate.threadId,
      activeTurnId: candidate.activeTurnId,
      error: err.message || String(err),
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
    updatedAtMs: Date.now(),
  });
  state.steerFeedback = next;
  const connection = $("connectionState");
  if (connection) {
    connection.classList.toggle("error", status === "failed");
    connection.textContent = steerFeedbackLabel(status);
  }
  markActivity(steerFeedbackLabel(status));
  if (status === "applied" || status === "failed" || status === "completed") {
    state.steerFeedbackTimer = window.setTimeout(() => {
      state.steerFeedback = null;
      state.steerFeedbackTimer = null;
      restoreConnectionState();
      updateTurnTimer();
    }, status === "failed" ? 3200 : 2400);
  }
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
  if (state.activityAtMs && Date.now() - state.activityAtMs < 3000) return;
  markActivity(label);
}

function normalizeFsPath(value) {
  return String(value || "")
    .replace(/^\\\\\?\\/, "")
    .replace(/[\\/]+/g, "\\")
    .replace(/\\+$/, "")
    .toLowerCase();
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
    maxPanes: THREAD_TILE_USER_MAX_PANES,
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
    currentThreadId: state.currentThreadId,
  }, {
    maxPanes: THREAD_TILE_USER_MAX_PANES,
  });
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
    const activeTurn = (Array.isArray(target.turns) ? target.turns : [])
      .find((turn) => String(turn && turn.id || "") === activeTurnId);
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
    updatedAt: Date.now(),
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

function draftAttachmentStorageKey(draftKey, attachmentIdValue) {
  return draftStore.attachmentStorageKey(draftKey, attachmentIdValue);
}

function openDraftDb() {
  return draftStore.openAttachmentDb();
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
      showError(new Error("当前浏览器不能持久保存草稿附件；刷新后需要重新选择附件。"));
    }
    return;
  }
  Promise.all(items.map((item) => storeDraftAttachment(draftKey, item))).catch((err) => {
    postClientEvent("draft_attachment_save_failed", { message: err.message || String(err) });
    showError(new Error("附件已加入本次发送，但浏览器没有保存草稿附件；刷新后可能需要重新选择。"));
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
    resetRuntimeWhenMissingDraft: options.resetRuntimeWhenMissingDraft === true,
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
  if (!plan.setThreadRuntime) {
    return;
  }
  state.composerModel = plan.composerModel || "";
  state.composerEffort = plan.composerEffort || "";
  state.composerPermissionMode = plan.composerPermissionMode || "";
}

function revokeAttachmentPreviewUrls(attachments) {
  for (const item of attachments || []) {
    if (item && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }
}

function scheduleAttachmentPreviewUrlRevoke(attachments, delayMs = 180000) {
  const urls = (attachments || [])
    .map((item) => item && item.previewUrl)
    .filter(Boolean);
  if (!urls.length) return;
  setTimeout(() => {
    revokeAttachmentPreviewUrls(urls.map((previewUrl) => ({ previewUrl })));
  }, Math.max(1000, Number(delayMs) || 180000));
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
      for (const item of items) {
        if (item && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
      return;
    }
    const restored = items.filter(Boolean);
    replacePendingAttachments(restored, { saveDraft: false });
    if (restored.length !== metas.length) {
      showError(new Error("有草稿附件没有恢复，请重新选择后再发送。"));
    }
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
  const marker = "\\.codex\\worktrees\\";
  const index = normalized.indexOf(marker);
  if (index < 0) return "";
  const parts = normalized.slice(index + marker.length).split("\\").filter(Boolean);
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
    notify: false,
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
  return /(running|active|queued|processing|inprogress|in_progress|in-progress)/.test(text)
    && !/(completed|failed|cancel|error|interrupted)/.test(text);
}

function isCompletedStatus(status) {
  return /completed|failed|cancel|error|interrupted/i.test(statusText(status));
}

function isTurnComplete(turn) {
  return Boolean(turn && (turn.completedAt || turn.durationMs || isCompletedStatus(turn.status)));
}

function isStaleOrSupersededLiveTurn(turn) {
  return Boolean(turn && (
    turn.mobileStaleActiveTurn
    || isStaleActiveStatus(turn.status)
    || isSupersededLiveTurn(turn)
  ));
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
  const status = statusText(item.status) || (completedByTimestamp ? "completed" : "");
  return !isCompletedStatus(status);
}

function activityLabelForItem(item) {
  if (!item) return "更新";
  const status = statusText(item.status);
  const completed = isCompletedStatus(status);
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
    item.server,
  ].filter(Boolean).join(" "));
}

function isContextCompactionType(type) {
  return /context.*compaction|context.*compression|context_compaction|context_compression/i.test(String(type || ""));
}

function isContextCompactionItem(item) {
  return item && (isContextCompactionType(item.type)
    || item.mobileNotice === CONTEXT_COMPACTION_COMPLETE_NOTICE
    || item.mobileNotice === CONTEXT_COMPACTION_PENDING_NOTICE
    || item.mobileCompactionStatus);
}

function contextCompactionStatusKind(value) {
  const text = statusText(value).toLowerCase();
  if (!text) return "";
  if (/completed|failed|cancel|error|interrupted/.test(text)) return "complete";
  if (/running|active|queued|processing|inprogress|in_progress|in-progress|pending|started/.test(text)) return "pending";
  return "";
}

function canShowPendingContextCompaction(turn = null, thread = null) {
  return !turn || (isLatestTurn(turn, thread) && isLiveTurn(turn, thread));
}

function contextCompactionState(item, turn = null, thread = null) {
  if (!item) return "";
  const itemKind = contextCompactionStatusKind(item.status);
  const mobileKind = contextCompactionStatusKind(item.mobileCompactionStatus);
  if (itemKind === "complete" || mobileKind === "complete" || item.mobileNotice === CONTEXT_COMPACTION_COMPLETE_NOTICE) return "complete";
  if (itemKind === "pending" || mobileKind === "pending" || item.mobileNotice === CONTEXT_COMPACTION_PENDING_NOTICE) {
    return canShowPendingContextCompaction(turn, thread) ? "pending" : "";
  }
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
  const turns = sourceThread && Array.isArray(sourceThread.turns)
    ? sourceThread.turns
    : [];
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    if (turnHasDisplayItems(turns[index])) return turns[index];
  }
  return turns.length ? turns[turns.length - 1] : null;
}

function latestRawTurn(thread = null) {
  const sourceThread = renderContextThread(thread);
  const turns = sourceThread && Array.isArray(sourceThread.turns)
    ? sourceThread.turns
    : [];
  return turns.length ? turns[turns.length - 1] : null;
}

function turnHasNewerDisplayTurn(thread, turn) {
  if (!turn) return false;
  const sourceThread = renderContextThread(thread);
  const turns = sourceThread && Array.isArray(sourceThread.turns)
    ? sourceThread.turns
    : [];
  const index = turns.indexOf(turn);
  if (index < 0) return false;
  for (let cursor = index + 1; cursor < turns.length; cursor += 1) {
    if (turnHasDisplayItems(turns[cursor])) return true;
  }
  return false;
}

function currentThreadHasActiveRuntimeStatus(thread = null) {
  const sourceThread = renderContextThread(thread);
  if (!sourceThread || isStaleActiveStatus(sourceThread.status) || sourceThread.mobileStaleActiveTurn) return false;
  const threadId = String(sourceThread.id || "");
  const isCurrentThread = Boolean(threadId && threadId === String(state.currentThreadId || ""));
  if (isCurrentThread && state.activeTurnId) {
    const active = turnById(state.activeTurnId);
    if (active && isLiveTurnForThread(sourceThread, active)) return true;
  }
  return isRunningStatus(sourceThread.status);
}

function currentThreadHasForegroundActiveRuntimeStatus(thread = null) {
  const sourceThread = renderContextThread(thread);
  if (!sourceThread || isStaleActiveStatus(sourceThread.status) || sourceThread.mobileStaleActiveTurn) return false;
  const threadId = String(sourceThread.id || "");
  const isCurrentThread = Boolean(threadId && threadId === String(state.currentThreadId || ""));
  if (isCurrentThread && state.activeTurnId) {
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
  return turn
    && statusText(turn.status).toLowerCase() === "interrupted"
    && !turn.completedAt
    && !turn.durationMs;
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
  if (rowUpdatedAt > 0 && rowUpdatedAt > detailUpdatedAt + 1000) return true;
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
  return isRunningStatus(turn && turn.status)
    || isIncompleteInterruptedTurn(turn)
    || turnHasActiveLiveItems(turn)
    || (isLatestTurn(turn, thread) && currentThreadHasActiveRuntimeStatus(thread));
}

function isLatestTurn(turn, thread = null) {
  return Boolean(turn && latestTurn(thread) === turn);
}

function stableItemKey(turn, item, index = 0, prefix = "item") {
  const threadId = renderContextThreadId() || "thread";
  const turnId = clientRenderStabilityGuard.stableTurnIdentity(turn);
  const visibleKey = item && item.mobileVisibleKey;
  let itemId = visibleKey || (item && item.id || `${item && item.type || "item"}-${index}`);
  if (item && (item.type === "imageView" || item.type === "imageGeneration")) {
    const imageSource = [
      imageViewPath(item),
      imageViewContentUrl(item),
      imageViewUrl(item),
    ].filter(Boolean).map(imageSourceSignature).join("|");
    if (imageSource) itemId = `${itemId}|${stableTextHash(imageSource)}`;
  }
  return [prefix, threadId, turnId, itemId].map((part) => String(part || "")).join("|");
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
  const threadId = renderContextThreadId() || "thread";
  const turnId = turn && (turn.id || turn.startedAt || "turn");
  const groupKey = operationGroupKey(item) || `item:${item && (item.id || index)}`;
  const itemIdentity = item && (
    item.mobileVisibleKey
    || item.id
    || item.callId
    || item.requestId
    || item.startedAtMs
    || item.startedAt
  ) || `index:${index}`;
  return ["live-operation", threadId, turnId, groupKey, itemIdentity, index].map((part) => String(part ?? "")).join("|");
}

function stableTurnKey(turn, suffix = "") {
  const threadId = renderContextThreadId() || "thread";
  return ["turn", threadId, clientRenderStabilityGuard.stableTurnIdentity(turn), suffix].filter(Boolean).join("|");
}

function existingConversationRenderKeys() {
  const el = $("conversation");
  if (!el) return new Set();
  return new Set(Array.from(el.querySelectorAll("[data-render-key]"))
    .map((node) => node.dataset.renderKey)
    .filter(Boolean));
}

function entryAnimationClass(key, previousKeys) {
  return previousKeys && previousKeys.has(key) ? "" : " entry-animate";
}

function isNodeStartAboveConversationViewport(node) {
  const conversation = $("conversation");
  if (!conversation || !node) return false;
  const viewport = conversation.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  return rect.top < viewport.top + 24;
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

function mergeVisibleTextItemPreservingRenderIdentity(...args) {
  return requireThreadDetailRuntime().mergeVisibleTextItemPreservingRenderIdentity(...args);
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
  return String(thread && thread.id
    || state.renderContextThreadId
    || state.renderContextThread && state.renderContextThread.id
    || state.currentThreadId
    || state.currentThread && state.currentThread.id
    || "");
}

function renderContextThread(thread = null) {
  return thread
    || state.renderContextThread
    || state.currentThread
    || null;
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
  const status = String(request && request.status || "waiting");
  return status === "waiting";
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
  return Array.from(state.pendingApprovals.values())
    .filter(shouldShowApprovalRequest)
    .filter((request) => requestBelongsToThread(request, threadId))
    .sort((a, b) => Number(a.receivedAt || 0) - Number(b.receivedAt || 0));
}

function approvalsForTurn(threadId, turnId) {
  return pendingApprovalsForThread(threadId)
    .filter((request) => approvalTurnId(request) === String(turnId || ""));
}

function approvalRequestsSignature(threadId) {
  return pendingApprovalsForThread(threadId).map((request) => ({
    id: request.id,
    method: request.method,
    status: request.status,
    decision: request.decision,
    params: request.params,
  }));
}

function taskCardVisibleInThread(card) {
  const status = String(card && card.status || "").trim();
  const threadRole = String(card && card.threadRole || "").trim();
  return threadRole === "target" && status === "pending";
}

function taskCardTerminalReturnReceiptVisibleInThread(card) {
  const threadRole = String(card && card.threadRole || "").trim();
  if (threadRole !== "target") return false;
  const delivery = card && card.delivery && typeof card.delivery === "object" ? card.delivery : {};
  const audit = card && card.audit && typeof card.audit === "object" ? card.audit : {};
  const terminal = card && card.terminal === true
    || delivery.terminal === true
    || audit.terminal === true;
  const returnToSource = delivery.returnToSource === true
    || audit.returnToSource === true
    || String(card && card.ackPolicy || delivery.ackPolicy || audit.ackPolicy || "").trim() === "none";
  return terminal && returnToSource;
}

function taskCardReceiptTimestampMs(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value < 10000000000 ? value * 1000 : value;
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
  return taskCardReceiptTimestampMs(delivery.returnedAtMs)
    || taskCardReceiptTimestampMs(delivery.returnedAt)
    || taskCardReceiptTimestampMs(delivery.deliveredAtMs)
    || taskCardReceiptTimestampMs(delivery.deliveredAt)
    || taskCardReceiptTimestampMs(audit.returnedAtMs)
    || taskCardReceiptTimestampMs(audit.returnedAt)
    || taskCardReceiptTimestampMs(card && card.returnedAtMs)
    || taskCardReceiptTimestampMs(card && card.returnedAt)
    || taskCardReceiptTimestampMs(message.createdAtMs)
    || taskCardReceiptTimestampMs(message.createdAt)
    || taskCardReceiptTimestampMs(card && card.createdAtMs)
    || taskCardReceiptTimestampMs(card && card.createdAt)
    || taskCardReceiptTimestampMs(card && card.updatedAtMs)
    || taskCardReceiptTimestampMs(card && card.updatedAt);
}

function threadTaskCardReturnReceiptsForThread(thread) {
  const cards = Array.isArray(thread && thread.threadTaskCards) ? thread.threadTaskCards : [];
  return cards
    .filter(taskCardTerminalReturnReceiptVisibleInThread)
    .slice()
    .sort((a, b) => taskCardReceiptUpdatedAtMs(b) - taskCardReceiptUpdatedAtMs(a))
    .slice(0, 1);
}

function threadTaskCardsForThread(thread) {
  const cards = Array.isArray(thread && thread.threadTaskCards) ? thread.threadTaskCards : [];
  return cards
    .filter(taskCardVisibleInThread)
    .slice()
    .sort((a, b) => Number(b && b.updatedAt ? Date.parse(b.updatedAt) : 0) - Number(a && a.updatedAt ? Date.parse(a.updatedAt) : 0));
}

function threadTaskCardsSignature(thread) {
  return threadTaskCardsForThread(thread).map((card) => ({
    id: card.id,
    status: card.status,
    updatedAt: card.updatedAt,
    threadRole: card.threadRole,
    replyCardId: card.replyCardId || "",
    injectedTurnId: card.injectedTurnId || "",
  }));
}

function threadTaskCardReturnReceiptsSignature(thread) {
  return threadTaskCardReturnReceiptsForThread(thread).map((card) => ({
    id: card.id,
    status: card.status,
    updatedAt: card.updatedAt,
    threadRole: card.threadRole,
    terminal: card.terminal === true,
    ackPolicy: card.ackPolicy || "",
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
    thresholdBytes: visible ? rolloutThresholdBytes(thread) : "",
  };
}

function visibleTurnsForConversation(thread) {
  const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
  return sortTurnsForDisplay(turns).slice(-maxVisibleTurnsForThread(thread));
}

function threadHasVisibleConversationTurns(thread) {
  return withRenderContextThread(thread, () => (
    visibleTurnsForConversation(thread).some((turn) => visibleItemsForTurn(turn, thread).length > 0)
  ));
}

function threadIsLoadingWithoutVisibleTurns(thread) {
  return Boolean(thread && thread.mobileLoading && !threadHasVisibleConversationTurns(thread));
}

function conversationRootSignature(thread) {
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
      readMode: String(thread.mobileReadMode || ""),
      projectionVersion: String(thread.mobileProjectionVersion || ""),
      projectionRevision: String(thread.mobileProjectionRevision || ""),
      readWarning: String(thread.mobileReadWarning || ""),
      readWarningMessage,
      visibleItemKeys: Array.isArray(thread.mobileVisibleItemKeys) ? thread.mobileVisibleItemKeys : [],
      visibleTurns: turns.map((turn) => turn && (turn.id || turn.startedAt || "")),
    };
    return JSON.stringify(payload);
  });
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
      taskCardReceipts: threadTaskCardReturnReceiptsSignature(thread),
      readWarning: String(thread.mobileReadWarning || ""),
      readWarningMessage,
      visibleTurns: turns.map((turn) => turn && (turn.id || turn.startedAt || "")),
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
      taskCardReceipts: threadTaskCardReturnReceiptsSignature(thread),
      projectionVersion: String(thread.mobileProjectionVersion || ""),
      projectionRevision: String(thread.mobileProjectionRevision || ""),
      visibleItemKeys: Array.isArray(thread.mobileVisibleItemKeys) ? thread.mobileVisibleItemKeys : [],
      turns: turns.map((turn) => {
        const timerShowsStatus = isLatestTurn(turn, thread) && (isLiveTurn(turn, thread) || turnFinalSeconds(turn) != null);
        return {
          id: turn.id || "",
          visibleItemBudget: visibleItemBudgetSignature(turn),
          statusLine: timerShowsStatus ? "" : displayTurnStatus(turn),
          durationMs: timerShowsStatus ? "" : (turn.durationMs || ""),
          items: visibleItemsForTurn(turn, thread).map((entry) => ({
            sourceIndex: entry.sourceIndex,
            item: visibleItemSignature(entry.item, turn, thread),
          })).filter((entry) => entry.item),
        };
      }),
    };
    return JSON.stringify(payload);
  });
}

function isPathLikeValue(value) {
  const text = String(value || "");
  if (!text || text.includes("\n") || text.includes("\r")) return false;
  return /^[A-Za-z]:[\\/]/.test(text)
    || /^\\\\\?\\/.test(text)
    || /^[/\\][^/\\]+/.test(text)
    || /[\\/][^/\\]+\.[A-Za-z0-9]{1,12}$/.test(text);
}

function isFileNameLikeValue(value) {
  const text = String(value || "");
  return Boolean(text && !text.includes("\n") && !text.includes("\r") && /^[^\\/]+\.[A-Za-z0-9]{1,12}$/.test(text));
}

function collectFileNames(value, out = [], keyHint = "") {
  if (out.length >= 5 || value == null) return out;
  if (typeof value === "string") {
    const keyLooksPath = /^(path|file|filepath|filename|name|target|source|uri)$/i.test(keyHint);
    if (isPathLikeValue(value) || (keyLooksPath && isFileNameLikeValue(value))) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectFileNames(entry, out, keyHint);
    return out;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (/^(path|file|filePath|filename|name|target|source|uri)$/i.test(key) && typeof entry === "string"
        && (isPathLikeValue(entry) || isFileNameLikeValue(entry))) {
        out.push(entry);
        if (out.length >= 5) return out;
        continue;
      }
      collectFileNames(entry, out, key);
      if (out.length >= 5) return out;
    }
  }
  return out;
}

function isLiveReasoning(item, turn, thread = null) {
  return item && item.type === "reasoning" && isLatestTurn(turn, thread) && isLiveTurn(turn, thread) && !isCompletedStatus(item.status);
}

function liveReasoningElapsed(item, turn) {
  const startedMs = item.startedAtMs
    || (item.startedAt ? item.startedAt * 1000 : 0)
    || (turn && turn.startedAt ? turn.startedAt * 1000 : 0)
    || state.nowMs;
  return Math.max(0, Math.floor((state.nowMs - startedMs) / 1000));
}

function latestTurnForThread(thread) {
  const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
  return turns.length ? turns[turns.length - 1] : null;
}

function isLiveTurnForThread(thread, turn) {
  if (!turn || isTurnComplete(turn) || isStaleOrSupersededLiveTurn(turn)) return false;
  if (turnHasNewerDisplayTurn(thread, turn)) return false;
  return isRunningStatus(turn && turn.status)
    || isIncompleteInterruptedTurn(turn)
    || turnHasActiveLiveItems(turn)
    || (latestTurnForThread(thread) === turn && isRunningStatus(thread && thread.status));
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
  return Math.max(0, Math.floor((state.nowMs - startedMs) / 1000));
}

function activeThreadFallbackElapsedSeconds(latest = null) {
  const latestStarted = liveTurnStartedAtMs(latest) || turnStartedAtMs(latest);
  const startedMs = latestStarted || Number(state.activityAtMs || 0) || state.nowMs;
  return Math.max(0, Math.floor((state.nowMs - startedMs) / 1000));
}

function turnFinalSeconds(turn) {
  if (!turn) return null;
  if (turn.durationMs) return Math.max(0, Math.round(turn.durationMs / 1000));
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
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  return items.some((item) => item && (
    (item.type === "reasoning" && !isCompletedStatus(item.status))
    || isActiveOperationalItem(item)
  ));
}

function liveTurnStartedAtMs(turn) {
  if (!turn) return 0;
  const explicit = numericTimestampMs(turn.startedAtMs)
    || numericTimestampMs(turn.startedAt)
    || numericTimestampMs(turn.createdAtMs)
    || numericTimestampMs(turn.createdAt);
  if (explicit) return explicit;
  const items = Array.isArray(turn.items) ? turn.items : [];
  for (const item of items) {
    if (!item) continue;
    if (item.type === "reasoning") {
      if (isCompletedStatus(item.status)) continue;
    } else if (!isActiveOperationalItem(item)) {
      continue;
    }
    const itemStarted = numericTimestampMs(item.startedAtMs)
      || numericTimestampMs(item.startedAt)
      || numericTimestampMs(item.createdAtMs)
      || numericTimestampMs(item.createdAt);
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
  const latest = options.latest || latestTurnForThread(thread);
  const live = latestLiveTurnForThread(thread);
  if (!live) {
    if (activeRuntime && latest && !isStaleOrSupersededLiveTurn(latest) && !isTurnComplete(latest)) {
      const startedMs = liveTurnStartedAtMs(latest) || turnStartedAtMs(latest) || Number(options.activityAtMs || 0) || state.nowMs;
      const seconds = Math.max(0, Math.floor((state.nowMs - startedMs) / 1000));
      return { visible: true, active: true, settled: false, seconds, detail: activeLabel || "运行" };
    }
    const finalSeconds = turnFinalSeconds(latest);
    if (finalSeconds != null) return { visible: true, active: false, settled: true, seconds: finalSeconds, detail: "已结束" };
    return { visible: false, active: false, settled: false, seconds: 0, detail: "" };
  }
  return {
    visible: true,
    active: true,
    settled: false,
    seconds: turnElapsedSeconds(live),
    detail: liveActivityLabelForTurn(live) || String(options.liveFallbackLabel || "").trim() || liveTurnFallbackActivityLabel(live),
  };
}

function currentThreadTurnTimerState() {
  const thread = state.currentThread;
  if (!thread) return { visible: false, active: false, settled: false, seconds: 0, detail: "" };
  const latest = latestTurn();
  const live = currentLiveTurn();
  if (live) {
    return {
      visible: true,
      active: true,
      settled: false,
      seconds: turnElapsedSeconds(live),
      detail: liveActivityLabelForTurn(live) || liveTurnFallbackActivityLabel(live),
    };
  }
  return turnTimerStateFromThread(thread, {
    activeRuntime: currentThreadHasForegroundActiveRuntimeStatus(),
    activityAtMs: state.activityAtMs,
    activeLabel: activeThreadFallbackActivityLabel(),
    latest,
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
    timerState.settled ? "settled" : "",
  ].filter(Boolean).join(" ");
  const timeText = formatElapsedTime(seconds);
  return `<div class="${escapeHtml(className)}">
    <span class="turn-timer-time">${escapeHtml(timeText)}</span><span class="turn-timer-detail${detail ? "" : " empty"}">${escapeHtml(detail)}</span>
  </div>`;
}

function threadTilePaneTimerState(thread) {
  return turnTimerStateFromThread(thread, {
    activeRuntime: Boolean(latestLiveTurnForThread(thread)),
    activeLabel: "运行",
    liveFallbackLabel: "运行",
  });
}

function updateTurnTimer() {
  const el = $("turnTimer");
  if (!el) return;
  updateComposerHeightVar();
  updateOperationDurationBadges();
  if (state.threadTileMode && state.threadTileActiveIds.length) {
    updateThreadTilePaneStatusBadges();
    applyTurnTimerState(el, { visible: false, active: false, settled: false, seconds: 0, detail: "" });
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
  }, 1000);
}

function operationStartedAtMs(item) {
  return numericTimestampMs(item && item.startedAtMs)
    || numericTimestampMs(item && item.startedAt)
    || numericTimestampMs(item && item.started_at_ms)
    || numericTimestampMs(item && item.started_at)
    || numericTimestampMs(item && item.createdAtMs)
    || numericTimestampMs(item && item.createdAt)
    || numericTimestampMs(item && item.timestampMs)
    || numericTimestampMs(item && item.timestamp);
}

function operationCompletedAtMs(item) {
  return numericTimestampMs(item && item.completedAtMs)
    || numericTimestampMs(item && item.completedAt)
    || numericTimestampMs(item && item.completed_at_ms)
    || numericTimestampMs(item && item.completed_at);
}

function operationExplicitDurationMs(item) {
  const value = Number((item && (item.durationMs || item.duration_ms || item.elapsedMs || item.elapsed_ms)) || 0);
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
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  return {
    text: formatElapsedTime(seconds),
    startedMs,
    completedMs,
    durationMs: explicitMs,
  };
}

function operationDurationAttrs(data) {
  return [
    `data-started-ms="${escapeHtml(data.startedMs || "")}"`,
    `data-completed-ms="${escapeHtml(data.completedMs || "")}"`,
    `data-duration-ms="${escapeHtml(data.durationMs || "")}"`,
  ].join(" ");
}

function updateOperationDurationBadges(root = document) {
  const badges = root.querySelectorAll ? root.querySelectorAll(".operation-duration") : [];
  badges.forEach((badge) => {
    const explicitMs = Number(badge.dataset.durationMs || 0);
    const startedMs = Number(badge.dataset.startedMs || 0);
    const completedMs = Number(badge.dataset.completedMs || 0);
    let durationMs = Number.isFinite(explicitMs) && explicitMs > 0 ? explicitMs : 0;
    if (!durationMs && Number.isFinite(startedMs) && startedMs > 0) {
      const endMs = Number.isFinite(completedMs) && completedMs > 0 ? completedMs : state.nowMs;
      durationMs = Math.max(0, endMs - startedMs);
    }
    if (!durationMs) return;
    const next = formatElapsedTime(Math.round(durationMs / 1000));
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
  }, 60000);
}

function threadSignature() {
  const turn = latestTurn();
  if (!turn) return "";
  const items = Array.isArray(turn.items) ? turn.items : [];
  const last = items.length ? items[items.length - 1] : null;
  const bodySize = items.reduce((total, item) => {
    if (!item || isOperationalItem(item) || isReasoningItem(item)) return total;
    return total
      + String(item.text || "").length
      + String((item.summary || []).join("")).length
      + String((item.content || []).join("")).length;
  }, 0);
  const visibleCount = items.filter((item) => item && !isReasoningItem(item)).length;
  return [turn.id, statusText(turn.status), visibleCount, last && !isReasoningItem(last) ? last.id : "", turn.completedAt || "", turn.durationMs || "", bodySize].join("|");
}


function createNavigationRuntime() {
  return {
    updateConnectionState: typeof updateConnectionState === "function" ? updateConnectionState : null,
    restoreConnectionState: typeof restoreConnectionState === "function" ? restoreConnectionState : null,
    markActivity: typeof markActivity === "function" ? markActivity : null,
    composerTargetPlan: typeof composerTargetPlan === "function" ? composerTargetPlan : null,
    visibleTurnsForConversation: typeof visibleTurnsForConversation === "function" ? visibleTurnsForConversation : null,
    conversationRenderSignature: typeof conversationRenderSignature === "function" ? conversationRenderSignature : null,
    updateTurnTimer: typeof updateTurnTimer === "function" ? updateTurnTimer : null,
  };
}

const navigationRuntimeApi = Object.freeze({ createNavigationRuntime });
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
    approvalThreadId,
    approvalTurnId,
    isApprovalActive,
    isApprovalSettled,
    shouldShowApprovalRequest,
    requestBelongsToThread,
    approvalActionThreadId,
    scheduleApprovalThreadRender,
    approvalsForTurn,
    pendingApprovalsForThread,
    taskCardTerminalReturnReceiptVisibleInThread,
    threadTaskCardReturnReceiptsSignature,
    threadTaskCardReturnReceiptsForThread,
    taskCardVisibleInThread,
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
    MESSAGE_INPUT_MAX_HEIGHT_PX,
  });
  root.CodexNavigationRuntime = navigationRuntimeApi;

export { createNavigationRuntime };
export default navigationRuntimeApi;
