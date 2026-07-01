"use strict";

(function attachSideChatRuntime(root) {
function noop() {}
function noopFalse() { return false; }
function noopString() { return ""; }
function defaultRequestAnimationFrame(callback) {
  return typeof root.setTimeout === "function" ? root.setTimeout(callback, 16) : 0;
}

function createSideChatRuntime(deps = {}) {
  const state = deps.state || {};
  const $ = typeof deps.$ === "function" ? deps.$ : () => null;
  const document = deps.document || root.document || {};
  const window = deps.window || root.window || root;
  const requestAnimationFrame = typeof deps.requestAnimationFrame === "function"
    ? deps.requestAnimationFrame
    : (typeof root.requestAnimationFrame === "function" ? root.requestAnimationFrame.bind(root) : defaultRequestAnimationFrame);
  const setTimeout = typeof deps.setTimeout === "function" ? deps.setTimeout : (typeof root.setTimeout === "function" ? root.setTimeout.bind(root) : () => 0);
  const clearTimeout = typeof deps.clearTimeout === "function" ? deps.clearTimeout : (typeof root.clearTimeout === "function" ? root.clearTimeout.bind(root) : noop);
  const SIDE_CHAT_DRAFT_SAVE_DEBOUNCE_MS = Math.max(0, Number(deps.SIDE_CHAT_DRAFT_SAVE_DEBOUNCE_MS || 450) || 450);
  const SIDE_CHAT_DRAFT_MAX_CHARS = Math.max(1, Number(deps.SIDE_CHAT_DRAFT_MAX_CHARS || 8000) || 8000);
  const SUBAGENT_EDGE_SWIPE_PX = Math.max(1, Number(deps.SUBAGENT_EDGE_SWIPE_PX || 56) || 56);
  const SUBAGENT_EDGE_SWIPE_MAX_PX = Math.max(SUBAGENT_EDGE_SWIPE_PX, Number(deps.SUBAGENT_EDGE_SWIPE_MAX_PX || 88) || 88);
  const SUBAGENT_EDGE_SWIPE_RATIO = Math.max(0, Number(deps.SUBAGENT_EDGE_SWIPE_RATIO || 0.08) || 0.08);
  const SUBAGENT_SWIPE_MIN_PX = Math.max(1, Number(deps.SUBAGENT_SWIPE_MIN_PX || 70) || 70);
  const SUBAGENT_WHEEL_SWIPE_MIN_PX = Math.max(1, Number(deps.SUBAGENT_WHEEL_SWIPE_MIN_PX || 48) || 48);
  const CLIENT_BUILD_ID = String(deps.CLIENT_BUILD_ID || "");
  const {
    api,
    collabAgentNameText = noopString,
    collabAgentTaskText = noopString,
    collabAgentThreadText = noopString,
    conversationDomTurnIds = () => [],
    conversationPatchShellSignature = noopString,
    conversationRenderSignature = noopString,
    createSubmissionId = () => "sidechat-" + Date.now(),
    currentLiveTurn = () => null,
    diagnosticThreadHash = noopString,
    escapeHtml = (value) => String(value || ""),
    escapeSelectorAttr = (value) => String(value || ""),
    formatTime = noopString,
    homeAiDiagnosticReportingApi = { boundedToken: (value) => String(value || "") },
    isInteractiveGestureTarget = noopFalse,
    latestTurn = () => null,
    loadThread = async () => null,
    loadThreads = async () => null,
    markActivity = noop,
    normalizeClientErrorMessage = (value) => String(value || ""),
    primaryTouch = () => null,
    renderCurrentThread = noop,
    requestAppConfirmation = async () => false,
    scheduleCurrentThreadRefresh = noop,
    scheduleLivePollIfNeeded = noop,
    showError = noop,
    statusText = noopString,
    truncateMiddle = (value) => String(value || ""),
    visibleConversationShape = () => ({}),
  } = deps;
function isSubagentItem(item) {
  return Boolean(item && item.type === "collabAgentToolCall");
}

function turnSubagentItems(turn) {
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  return items.filter(isSubagentItem);
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
    unknown: "未知",
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
    draft: { text: "", updatedAt: "" },
    candidates: [],
    queue: null,
    sidecar: { status: "idle", pendingUserMessageId: "", updatedAt: "", error: "" },
    audit: { createdAt: "", updatedAt: "" },
    persistence: "server",
  };
}

function normalizeSideChatSidecar(input) {
  const source = input && typeof input === "object" ? input : {};
  const status = String(source.status || "idle").toLowerCase();
  return {
    status: ["idle", "pending", "failed"].includes(status) ? status : "idle",
    pendingUserMessageId: String(source.pendingUserMessageId || ""),
    updatedAt: String(source.updatedAt || ""),
    error: String(source.error || ""),
  };
}

function normalizeSideChatState(input, threadId = "") {
  const source = input && typeof input === "object" ? input : {};
  const id = String(source.threadId || threadId || "");
  return {
    threadId: id,
    version: Math.max(0, Number(source.version) || 0),
    messages: Array.isArray(source.messages) ? source.messages.filter(Boolean) : [],
    draft: {
      text: String(source.draft && source.draft.text || ""),
      updatedAt: String(source.draft && source.draft.updatedAt || ""),
    },
    candidates: Array.isArray(source.candidates) ? source.candidates.filter(Boolean) : [],
    queue: source.queue && typeof source.queue === "object" ? source.queue : null,
    sidecar: normalizeSideChatSidecar(source.sidecar),
    audit: {
      createdAt: String(source.audit && source.audit.createdAt || ""),
      updatedAt: String(source.audit && source.audit.updatedAt || ""),
    },
    persistence: "server",
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
    if (form) form.scrollIntoView({ block: "nearest", inline: "nearest" });
    else textarea.scrollIntoView({ block: "nearest", inline: "nearest" });
  } catch (_) {
    // Older WebKit builds can throw for detached nodes during iframe relayout.
  }
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
  const boundedMax = Number.isFinite(maxHeight) && maxHeight > 0 ? maxHeight : 160;
  const boundedMin = Number.isFinite(minHeight) && minHeight > 0 ? minHeight : 44;
  const nextHeight = Math.min(boundedMax, Math.max(boundedMin, textarea.scrollHeight));
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
  const target = id
    ? scroller.querySelector(`[data-side-chat-candidate="${escapeSelectorAttr(id)}"]`)
    : scroller.querySelector(".side-chat-candidate");
  if (!target) {
    scrollSideChatToBottom();
    return false;
  }
  target.scrollIntoView({ block: "center", inline: "nearest" });
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
    const result = await api(sideChatApiPath(id), { timeoutMs: 20000 });
    const sideChat = setSideChatState(id, result && result.sideChat || null);
    if (state.sideChatLoadingThreadId === id) state.sideChatLoadingThreadId = "";
    if (state.sideChatError && sideChatThreadId() === id) state.sideChatError = "";
    if (state.subagentPanelOpen && sideChatThreadId() === id) updateSubagentPanelUi({ force: true, scrollSideChatToBottom: true });
    if (sideChatReplyPending(id)) scheduleSideChatPoll(id);
    return sideChat;
  } catch (err) {
    if (state.sideChatLoadingThreadId === id) state.sideChatLoadingThreadId = "";
    if (sideChatThreadId() === id) state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
    if (state.subagentPanelOpen && sideChatThreadId() === id) updateSubagentPanelUi({ force: true, scrollSideChatToBottom: true });
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
    timeoutMs: 20000,
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
    failed: "失败",
  }[String(status || "").toLowerCase()] || "草稿";
}

function sideChatQueueSummary(queue) {
  if (!queue) return "";
  const status = sideChatStatusLabel(queue.status);
  const mode = queue.mode === "autoSendWhenIdle" ? "完成后自动发送" : "等待确认";
  return `${status} · ${mode}`;
}

function sideChatTimeLabel(value) {
  const text = String(value || "");
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return "";
  return formatTime(Math.floor(ms / 1000), state.nowMs);
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
    createdAtMs: Date.now(),
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
    message.createdAt,
  ].join(":")).join(",");
  const candidates = sideChat.candidates.map((candidate) => [
    candidate.id,
    candidate.status,
    candidate.updatedAt,
    String(candidate.body || "").length,
    candidate.appliedTurnId || "",
  ].join(":")).join(",");
  const queue = sideChat.queue ? [
    sideChat.queue.candidateId,
    sideChat.queue.mode,
    sideChat.queue.status,
    sideChat.queue.updatedAt,
    String(sideChat.queue.error || "").length,
  ].join(":") : "";
  const sidecar = sideChat.sidecar ? [
    sideChat.sidecar.status,
    sideChat.sidecar.pendingUserMessageId,
    sideChat.sidecar.updatedAt,
    String(sideChat.sidecar.error || "").length,
  ].join(":") : "";
  const turn = currentSubagentTurn();
  const subagents = currentSubagentItems().map((item) => [
    item.id || item.itemId || "",
    item.tool || item.name || "",
    statusText(item.status),
    collabAgentThreadText(item),
    String(collabAgentTaskText(item) || "").length,
  ].join(":")).join(",");
  return [
    threadId,
    state.activeTurnId || "",
    state.sideChatLoadingThreadId === threadId ? "loading" : "",
    state.sideChatError || "",
    state.sideChatBusyKey || "",
    notice ? [notice.kind, notice.message, notice.actionLabel, notice.candidateId].join(":") : "",
    messages,
    candidates,
    queue,
    sidecar,
    turn && turn.id || "",
    subagents,
  ].join("|");
}

function renderSideChatNotice(threadId = sideChatThreadId()) {
  const notice = sideChatNoticeForThread(threadId);
  if (!notice || !notice.message) return "";
  const action = notice.actionLabel
    ? `<button type="button" data-side-chat-action="open-notice" data-candidate-id="${escapeHtml(notice.candidateId || "")}">${escapeHtml(notice.actionLabel)}</button>`
    : "";
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
    const label = collabAgentNameText(item)
      || collabAgentThreadText(item)
      || (item.tool === "spawnAgent" ? "Subagent" : item.tool || item.name || `Subagent ${index + 1}`);
    const task = collabAgentTaskText(item);
    const thread = collabAgentThreadText(item);
    const meta = [
      subagentStatusLabel(kind),
      thread ? truncateMiddle(thread, 32, "thread") : "",
      item.tool && item.tool !== "collabAgentToolCall" ? item.tool : "",
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
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (String(messages[index] && messages[index].role || "").toLowerCase() === "assistant") return index;
  }
  return -1;
}

function renderSideChatMessage(message, index, sideChat) {
  const role = String(message && message.role || "user").toLowerCase();
  const text = String(message && message.text || "");
  const time = sideChatTimeLabel(message && message.createdAt);
  const latestAssistant = role === "assistant" && index === latestAssistantSideChatMessageIndex(sideChat);
  const running = Boolean(state.activeTurnId);
  const busy = sideChatBusy(`message:${index}`) || sideChatBusy(`message-candidate:${index}`);
  const actions = latestAssistant && text.trim()
    ? `<div class="side-chat-message-actions">
        <button type="button" data-side-chat-action="message-apply" data-message-index="${index}"${busy ? " disabled" : ""}>发送主线程</button>
        <button type="button" data-side-chat-action="message-queue" data-message-index="${index}"${busy ? " disabled" : ""}>${running ? "完成后发送" : "排队"}</button>
        <button type="button" data-side-chat-action="message-candidate" data-message-index="${index}"${busy ? " disabled" : ""}>存为候选</button>
      </div>`
    : "";
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
  const queue = sideChat.queue && sideChat.queue.status !== "sent" && sideChat.queue.status !== "cancelled"
    ? `<div class="side-chat-queue ${escapeHtml(sideChat.queue.status || "queued")}">${escapeHtml(sideChatQueueSummary(sideChat.queue))}</div>`
    : "";
  const sidecar = normalizeSideChatSidecar(sideChat.sidecar);
  const replyStatus = sidecar.status === "pending"
    ? `<div class="side-chat-queue pending">侧聊正在回复...</div>`
    : sidecar.status === "failed" && sidecar.error
      ? `<div class="side-chat-error">侧聊回复失败：${escapeHtml(sidecar.error)}</div>`
      : "";
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
  const clearDisabled = busy || (!sideChat.messages.length && !sideChat.candidates.length && draftEmpty);
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
  const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
  const itemCount = turns.reduce((total, turn) => total + (Array.isArray(turn && turn.items) ? turn.items.length : 0), 0);
  return {
    visibleTurnCount: Number(shape.visibleTurnCount || 0),
    visibleItemCount: Number(shape.visibleItemCount || 0),
    itemCount,
    detailLoaded: Boolean(thread && thread.mobileDetailLoaded),
    loading: Boolean(thread && thread.mobileLoading),
    loadError: Boolean(thread && thread.mobileLoadError),
    readMode: homeAiDiagnosticReportingApi.boundedToken(thread && thread.mobileReadMode || "", "", 80),
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
    readMode: "visual-harness-empty-cache",
  };
  if (!id) {
    return {
      ok: false,
      error: "missing_thread_id",
      clientBuildId: CLIENT_BUILD_ID,
      thread_hash: "",
      before,
      after: null,
    };
  }
  state.currentThreadId = id;
  state.currentThread = {
    id,
    turns: [],
    mobileDetailLoaded: true,
    mobileLoading: false,
    mobileLoadError: "",
    mobileReadMode: "visual-harness-empty-cache",
  };
  await loadThread(id, { source: "visual-harness-empty-cache" });
  const after = visualHarnessThreadShape(state.currentThread);
  return {
    ok: Boolean(after.visibleTurnCount || after.visibleItemCount),
    error: after.loadError ? "thread_detail_load_error" : "",
    clientBuildId: CLIENT_BUILD_ID,
    thread_hash: threadHash,
    before,
    after,
  };
}

async function simulateStableSignatureEmptyDomForHarness(threadId) {
  const id = String(threadId || state.currentThreadId || "").trim();
  const threadHash = diagnosticThreadHash(id);
  if (!id) {
    return {
      ok: false,
      error: "missing_thread_id",
      clientBuildId: CLIENT_BUILD_ID,
      thread_hash: "",
      before: null,
      after: null,
      domBefore: null,
      domAfter: null,
    };
  }
  await loadThread(id, { source: "visual-harness-stable-signature-seed" });
  const before = visualHarnessThreadShape(state.currentThread);
  const signature = conversationRenderSignature(state.currentThread);
  const patchShellSignature = conversationPatchShellSignature(state.currentThread);
  const conversation = $("conversation");
  const domBefore = {
    turnCount: conversationDomTurnIds(conversation).length,
    itemCount: conversation ? conversation.querySelectorAll(".item[data-item]").length : 0,
  };
  state.renderedConversationSignature = signature;
  state.renderedConversationPatchShellSignature = patchShellSignature;
  if (conversation) conversation.innerHTML = '<div class="empty-state">No visible turns.</div>';
  renderCurrentThread({ stickToBottom: true, source: "visual-harness-stable-signature-empty-dom" });
  const afterConversation = $("conversation");
  const hasEmptyState = afterConversation ? Boolean(afterConversation.querySelector(".empty-state")) : false;
  const domAfter = {
    turnCount: conversationDomTurnIds(afterConversation).length,
    itemCount: afterConversation ? afterConversation.querySelectorAll(".item[data-item]").length : 0,
    emptyState: hasEmptyState ? "empty-state" : "",
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
    domAfter,
  };
}

function refreshSideChatFormButtons() {
  const textarea = sideChatDraftTextarea();
  if (!textarea) return;
  const form = textarea.closest("[data-side-chat-form]");
  if (!form) return;
  const panel = $("subagentPanel");
  const threadId = String(textarea.dataset.threadId || sideChatThreadId());
  const sideChat = sideChatStateForThread(threadId);
  const draftEmpty = !textarea.value.trim();
  form.querySelectorAll("[data-side-chat-action='message'], [data-side-chat-action='candidate']").forEach((button) => {
    button.disabled = Boolean(state.sideChatBusyKey) || draftEmpty;
  });
  if (panel) panel.querySelectorAll("[data-side-chat-action='clear']").forEach((button) => {
    button.disabled = Boolean(state.sideChatBusyKey) || (
      draftEmpty
      && !sideChat.messages.length
      && !sideChat.candidates.length
    );
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
        updateSubagentPanelUi({ force: true, scrollSideChatToBottom: Boolean(open) });
        return Boolean(state.subagentPanelOpen);
      },
      openThread: (threadId) => loadThread(String(threadId || ""), { source: "visual-harness" }),
      simulateEmptyCachedDetailOpen: (threadId) => simulateEmptyCachedDetailOpenForHarness(threadId),
      simulateStableSignatureEmptyDom: (threadId) => simulateStableSignatureEmptyDomForHarness(threadId),
      loadSideChat: (threadId) => loadSideChat(String(threadId || sideChatThreadId()), { silent: true }),
      ensureSideChatDraftVisible,
      autoSizeSideChatDraftTextarea,
    }),
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
    const result = await api(sideChatApiPath(threadId, "/messages"), {
      method: "POST",
      body: JSON.stringify({
        role: "user",
        text,
        idempotencyKey: createSubmissionId(),
      }),
      timeoutMs: 20000,
    });
    applySideChatResult(threadId, result);
    state.sideChatError = "";
    if (sideChatReplyPending(threadId)) scheduleSideChatPoll(threadId, 900);
    markActivity("侧聊已发送");
  } catch (err) {
    state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
    showError(err);
  } finally {
    setSideChatBusy("");
    updateSubagentPanelUi({ force: true, scrollSideChatToBottom: true });
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
    const result = await api(sideChatApiPath(threadId, "/candidates"), {
      method: "POST",
      body: JSON.stringify({
        body,
        idempotencyKey: createSubmissionId(),
      }),
      timeoutMs: 20000,
    });
    const sideChat = applySideChatResult(threadId, result);
    if (options.clearDraft) await saveSideChatDraft(threadId, "", { render: false });
    state.sideChatError = "";
    markActivity("候选已保存");
    const candidates = Array.isArray(sideChat && sideChat.candidates) ? sideChat.candidates : [];
    const candidate = candidates[candidates.length - 1] || null;
    if (candidate && candidate.id) {
      setSideChatNotice("success", "候选已保存，可以稍后发送到主线程。", {
        actionLabel: "打开候选",
        candidateId: candidate.id,
      });
    }
    return candidate;
  } catch (err) {
    state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
    showError(err);
    return null;
  } finally {
    setSideChatBusy("");
    updateSubagentPanelUi({ force: true, scrollSideChatToBottom: true });
  }
}

async function createSideChatCandidateFromDraft() {
  const threadId = sideChatThreadId();
  const text = currentSideChatDraftText(threadId).trim();
  if (!threadId || !text || state.sideChatBusyKey) return;
  await createSideChatCandidateFromText(text, { clearDraft: true, busyKey: "candidate" });
}

function sideChatMessageTextByIndex(index) {
  const sideChat = sideChatStateForThread(sideChatThreadId());
  const message = sideChat.messages[Number(index)];
  return String(message && message.text || "").trim();
}

async function createSideChatCandidateFromMessage(index, nextAction = "") {
  const text = sideChatMessageTextByIndex(index);
  if (!text || state.sideChatBusyKey) return;
  const candidate = await createSideChatCandidateFromText(text, { busyKey: `message-candidate:${index}` });
  const id = String(candidate && candidate.id || "");
  if (!id) return;
  if (nextAction === "apply") {
    await applySideChatCandidate(id);
  } else if (nextAction === "queue") {
    await queueSideChatCandidate(id, state.activeTurnId ? "autoSendWhenIdle" : "confirmWhenIdle");
  }
}

async function queueSideChatCandidate(candidateId, mode = "autoSendWhenIdle") {
  const threadId = sideChatThreadId();
  const id = String(candidateId || "");
  if (!threadId || !id || state.sideChatBusyKey) return;
  setSideChatBusy(`queue:${id}`);
  try {
    const result = await api(sideChatApiPath(threadId, `/candidates/${encodeURIComponent(id)}/queue`), {
      method: "POST",
      body: JSON.stringify({
        mode,
        idempotencyKey: `sidechat:${threadId}:${id}:${mode}`,
      }),
      timeoutMs: 20000,
    });
    applySideChatResult(threadId, result);
    state.sideChatError = "";
    setSideChatNotice("success", mode === "autoSendWhenIdle" ? "已排队，当前任务完成后会发送到主线程。" : "候选已排队，空闲后可从队列继续。", {
      actionLabel: "打开队列",
      candidateId: id,
    });
    markActivity(mode === "autoSendWhenIdle" ? "侧聊已排队" : "候选已排队");
  } catch (err) {
    state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
    showError(err);
  } finally {
    setSideChatBusy("");
    updateSubagentPanelUi({ force: true, scrollSideChatToBottom: true });
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
    const result = await api(sideChatApiPath(threadId, `/candidates/${encodeURIComponent(id)}/apply`), {
      method: "POST",
      body: JSON.stringify({
        mode: "confirmWhenIdle",
        idempotencyKey: `sidechat:${threadId}:${id}:apply`,
      }),
      timeoutMs: 180000,
    });
    applySideChatResult(threadId, result);
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
    const result = await api(sideChatApiPath(threadId, `/candidates/${encodeURIComponent(id)}/cancel`), {
      method: "POST",
      body: JSON.stringify({}),
      timeoutMs: 20000,
    });
    applySideChatResult(threadId, result);
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
  const confirmed = await requestAppConfirmation("清空这个线程的侧聊内容？", {
    title: "清空侧聊",
    confirmLabel: "清空",
    cancelLabel: "取消",
  });
  if (!confirmed) return;
  setSideChatBusy("clear");
  try {
    clearTimeout(state.sideChatDraftSaveTimer);
    state.sideChatDraftSaveTimer = null;
    const result = await api(sideChatApiPath(threadId, "/clear"), {
      method: "POST",
      body: JSON.stringify({}),
      timeoutMs: 20000,
    });
    applySideChatResult(threadId, result);
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
  if (action === "candidate") {
    createSideChatCandidateFromDraft();
  } else if (action === "tools") {
    const row = button.closest("[data-side-chat-form]") && button.closest("[data-side-chat-form]").querySelector(".side-chat-tool-row");
    if (row) row.hidden = !row.hidden;
  } else if (action === "message-candidate") {
    createSideChatCandidateFromMessage(messageIndex);
  } else if (action === "message-apply") {
    createSideChatCandidateFromMessage(messageIndex, "apply");
  } else if (action === "message-queue") {
    createSideChatCandidateFromMessage(messageIndex, "queue");
  } else if (action === "apply") {
    applySideChatCandidate(candidateId);
  } else if (action === "queue") {
    queueSideChatCandidate(candidateId, state.activeTurnId ? "autoSendWhenIdle" : "confirmWhenIdle");
  } else if (action === "cancel") {
    cancelSideChatCandidate(candidateId);
  } else if (action === "clear") {
    clearSideChat();
  } else if (action === "open-notice") {
    openSideChatCandidate(candidateId);
  } else if (action === "dismiss-notice") {
    clearSideChatNotice();
    updateSubagentPanelUi({ force: true });
  }
}

function openSubagentPanelFromGesture() {
  if (!state.currentThread) return;
  state.subagentPanelOpen = true;
  updateSubagentPanelUi({ force: true, scrollSideChatToBottom: true });
  if (!state.threadSideChats.has(sideChatThreadId())) {
    loadSideChat(sideChatThreadId(), { silent: true }).catch(showError);
  }
}

function isHorizontalScrollableGestureTarget(target) {
  return Boolean(target && target.closest && target.closest(
    ".markdown-mermaid-viewer, .markdown-mermaid-canvas, .markdown-mermaid-artboard, .markdown-table-wrap, .markdown-code-table-preview, .markdown-code-block pre"
  ));
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
    moved: false,
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
  if (dx <= -SUBAGENT_SWIPE_MIN_PX && Math.abs(dy) <= Math.abs(dx) * 0.85) openSubagentPanelFromGesture();
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
    handleSubagentWheelSwipe,
  });
}

root.CodexSideChatRuntime = Object.freeze({ createSideChatRuntime });
if (typeof module !== "undefined" && module.exports) module.exports = { createSideChatRuntime };
})(typeof window !== "undefined" ? window : globalThis);
