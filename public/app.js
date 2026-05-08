"use strict";

const state = {
  key: localStorage.getItem("codexMobileKey") || "",
  workspaces: [],
  selectedCwd: "",
  threads: [],
  currentThread: null,
  currentThreadId: "",
  activeTurnId: "",
  events: null,
  connectionStatus: null,
  renderScheduled: false,
  renderFrame: null,
  threadListRenderScheduled: false,
  threadListRenderFrame: null,
  threadNotificationThrottle: new Map(),
  sendProgressWatchdog: null,
  sendProgressStartAt: 0,
  sendProgressWarned: false,
  refreshTimer: null,
  recoveryTimer: null,
  reconnectNoticeTimer: null,
  resumeTimer: null,
  resumeVisualTimers: [],
  resumeSeq: 0,
  visualRecoveryTimers: [],
  visualRecoverySeq: 0,
  pollTimer: null,
  pollStableCount: 0,
  lastThreadSignature: "",
  renderedConversationSignature: "",
  renderedThreadListSignature: "",
  tickTimer: null,
  relativeTimeTimer: null,
  nowMs: Date.now(),
  threadLoadSeq: 0,
  threadLoadController: null,
  threadListLoadSeq: 0,
  threadListLoadController: null,
  openThreadActionId: "",
  threadSwipe: null,
  suppressThreadClickUntil: 0,
  suppressThreadClickThreadId: "",
  continuationSourceThreadId: "",
  continuationNewThreadId: "",
  continuationJobId: "",
  pendingAttachments: [],
  composerBusy: false,
  continuationBusy: false,
  maxUploadBytes: 64 * 1024 * 1024,
  maxUploadFiles: 12,
  rolloutWarningThresholdBytes: 100 * 1024 * 1024,
  modelOptions: [],
  reasoningEffortOptions: [],
  permissionModeOptions: ["default", "auto", "full", "custom"],
  defaultModel: "",
  defaultReasoningEffort: "",
  rateLimits: null,
  rateLimitsByModel: {},
  pushServerSupported: false,
  pushSubscribed: false,
  pushBusy: false,
  pushError: "",
  serviceWorkerRegistration: null,
  pendingApprovals: new Map(),
  runningThreadIds: loadStringSetStorage("codexMobileRunningThreadIds"),
  unreadThreadIds: loadStringSetStorage("codexMobileUnreadThreadIds"),
  selectedModel: localStorage.getItem("codexMobileSelectedModel") || "",
  selectedEffort: localStorage.getItem("codexMobileSelectedEffort") || "",
  selectedPermissionModes: loadJsonStorage("codexMobileSelectedPermissionModes", {}),
  activityLabel: "",
  activityAtMs: 0,
  leavingItems: new Map(),
  leavingCleanupTimer: null,
  lastSendButtonSubmitAt: 0,
  lastSendSubmitStartedAt: 0,
  uiWatchdogTimer: null,
  lastUiWatchdogTickAt: 0,
  lastUiStallReportedAt: 0,
};

const MAX_COMMAND_OUTPUT_CHARS = 16000;
const MAX_LIVE_TEXT_CHARS = 60000;
const MAX_VISIBLE_TURNS = 12;
const MAX_RETAINED_OPERATIONS_PER_TURN = 1;
const STORAGE_THREAD_ID = "codexMobileCurrentThreadId";
const STORAGE_MODEL = "codexMobileSelectedModel";
const STORAGE_EFFORT = "codexMobileSelectedEffort";
const STORAGE_PERMISSION_MODES = "codexMobileSelectedPermissionModes";
const STORAGE_CONTINUATION_JOB = "codexMobileContinuationJobId";
const STORAGE_RUNNING_THREAD_IDS = "codexMobileRunningThreadIds";
const STORAGE_UNREAD_THREAD_IDS = "codexMobileUnreadThreadIds";
const OPERATIONAL_ITEM_TYPES = new Set(["commandExecution", "fileChange", "dynamicToolCall", "mcpToolCall"]);
const HIDDEN_SERVER_REQUEST_METHODS = new Set(["item/tool/call"]);
const USER_INPUT_REQUEST_METHODS = new Set(["item/tool/requestUserInput", "mcpServer/elicitation/request"]);
const CONTEXT_COMPACTION_PENDING_NOTICE = "\u5386\u53f2\u4e0a\u4e0b\u6587\u6b63\u5728\u538b\u7f29";
const CONTEXT_COMPACTION_COMPLETE_NOTICE = "\u5386\u53f2\u4e0a\u4e0b\u6587\u5df2\u538b\u7f29";

const $ = (id) => document.getElementById(id);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadJsonStorage(key, fallback) {
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
    return new Set();
  }
}

function saveStringSetStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify([...value].filter(Boolean)));
  } catch (_) {
    // Status hints are best-effort UI state.
  }
}

function viewportHeight() {
  const visual = window.visualViewport && Number(window.visualViewport.height);
  const inner = Number(window.innerHeight);
  const client = document.documentElement && Number(document.documentElement.clientHeight);
  return Math.max(320, Math.round(visual || inner || client || 0));
}

function updateViewportVars() {
  document.documentElement.style.setProperty("--app-height", `${viewportHeight()}px`);
}

function createSubmissionId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function base64UrlToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function pushSubscriptionToJson(subscription) {
  return typeof subscription.toJSON === "function" ? subscription.toJSON() : subscription;
}

function pushBrowserAvailable() {
  return Boolean(state.pushServerSupported
    && window.isSecureContext
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function truncateMiddle(value, maxChars, label) {
  const text = String(value ?? "");
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.42);
  const tail = maxChars - head;
  return `${text.slice(0, head)}\n\n[${label} truncated: ${text.length} chars total, showing first ${head} and last ${tail}]\n\n${text.slice(-tail)}`;
}

function compactLiveText(value) {
  return truncateMiddle(value, MAX_LIVE_TEXT_CHARS, "text");
}

function appendCommandOutput(item, delta) {
  const text = String(delta || "");
  const current = item.aggregatedOutput || "";
  const totalBefore = item.outputTotalChars || current.length;
  const nextTotal = totalBefore + text.length;
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

function shortPath(value) {
  if (!value) return "";
  return String(value).replace(/^\\\\\?\\/, "").replace(/^.*[\\/]/, "");
}

function formatAbsoluteTime(seconds) {
  if (!seconds) return "";
  const d = new Date(seconds * 1000);
  return d.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatTime(seconds, nowMs = Date.now()) {
  const value = Number(seconds || 0);
  if (!value) return "";
  const diffMs = Math.max(0, nowMs - value * 1000);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < 45 * 1000) return "刚刚";
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))}分钟前`;
  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour);
    const minutes = Math.floor((diffMs % hour) / minute);
    return minutes ? `${hours}小时${minutes}分钟前` : `${hours}小时前`;
  }
  if (diffMs < 30 * day) return `${Math.floor(diffMs / day)}天前`;
  return formatAbsoluteTime(seconds);
}

function formatElapsedTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function statusText(status) {
  if (!status) return "";
  if (typeof status === "string") return status;
  return status.type || JSON.stringify(status);
}

function saveThreadStatusHints() {
  saveStringSetStorage(STORAGE_RUNNING_THREAD_IDS, state.runningThreadIds);
  saveStringSetStorage(STORAGE_UNREAD_THREAD_IDS, state.unreadThreadIds);
}

function markThreadViewed(threadId) {
  const id = String(threadId || "");
  if (!id || !state.unreadThreadIds.has(id)) return;
  state.unreadThreadIds.delete(id);
  saveThreadStatusHints();
}

function updateThreadStatusHints(threadId, previousStatus, nextStatus) {
  const id = String(threadId || "");
  if (!id) return;
  const wasRunning = state.runningThreadIds.has(id) || isRunningStatus(previousStatus);
  const isRunning = isRunningStatus(nextStatus);
  let changed = false;
  if (isRunning) {
    if (!state.runningThreadIds.has(id)) {
      state.runningThreadIds.add(id);
      changed = true;
    }
    if (state.unreadThreadIds.delete(id)) changed = true;
  } else if (wasRunning) {
    if (state.runningThreadIds.delete(id)) changed = true;
    if (id !== state.currentThreadId && !state.unreadThreadIds.has(id)) {
      state.unreadThreadIds.add(id);
      changed = true;
    }
  }
  if (changed) saveThreadStatusHints();
}

function reconcileThreadStatusHints(threads) {
  let changed = false;
  for (const thread of threads || []) {
    const id = String(thread && thread.id || "");
    if (!id) continue;
    const wasRunning = state.runningThreadIds.has(id);
    const isRunning = isRunningStatus(thread.status);
    if (isRunning && !wasRunning) {
      state.runningThreadIds.add(id);
      state.unreadThreadIds.delete(id);
      changed = true;
    } else if (!isRunning && wasRunning) {
      state.runningThreadIds.delete(id);
      if (id !== state.currentThreadId) state.unreadThreadIds.add(id);
      changed = true;
    }
  }
  if (changed) saveThreadStatusHints();
}

function statusIconInfo(status, threadId = "") {
  const text = statusText(status);
  const normalized = text.toLowerCase();
  if (/active|running|queued|processing|inprogress|in_progress|in-progress|pending|started/.test(normalized)) {
    return { kind: "running", label: text || "running", symbol: "" };
  }
  if (threadId && state.unreadThreadIds.has(String(threadId))) {
    return { kind: "unread", label: "completed, unread", symbol: "" };
  }
  return null;
}

function statusIconHtml(status, className = "", threadId = "") {
  const info = statusIconInfo(status, threadId);
  if (!info) return "";
  return `<span class="status-icon status-icon-${escapeHtml(info.kind)}${className ? ` ${escapeHtml(className)}` : ""}" title="${escapeHtml(info.label)}" aria-label="${escapeHtml(info.label)}" role="img">${escapeHtml(info.symbol || "")}</span>`;
}

function rolloutSizeBytes(thread) {
  const size = Number(thread && thread.rolloutSizeBytes);
  return Number.isFinite(size) && size > 0 ? size : 0;
}

function rolloutThresholdBytes(thread) {
  const size = Number(thread && thread.rolloutWarningThresholdBytes);
  return Number.isFinite(size) && size > 0 ? size : state.rolloutWarningThresholdBytes;
}

function isRolloutOverThreshold(thread) {
  const size = rolloutSizeBytes(thread);
  const threshold = rolloutThresholdBytes(thread);
  return Boolean(thread && thread.rolloutOverWarningThreshold) || (size > 0 && threshold > 0 && size >= threshold);
}

function rolloutSizeText(thread) {
  const size = rolloutSizeBytes(thread);
  return size > 0 ? formatFileSize(size) : "";
}

function normalizeOptionList(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function labelForModel(value) {
  const labels = {
    "gpt-5.5": "GPT-5.5",
    "gpt-5.4": "GPT-5.4",
    "gpt-5.4-mini": "GPT-5.4 Mini",
    "gpt-5.3-codex": "GPT-5.3 Codex",
    "gpt-5.3-codex-spark": "GPT-5.3 Codex Spark",
    "gpt-5.2": "GPT-5.2",
  };
  return labels[value] || value;
}

function labelForEffort(value) {
  const labels = {
    low: "Low",
    medium: "Medium",
    high: "High",
    xhigh: "XHigh",
  };
  return labels[value] || value;
}

function labelForPermissionMode(value) {
  const labels = {
    default: "默认权限",
    auto: "自动审查",
    full: "完全访问权限",
    custom: "自定义 (config.toml)",
  };
  return labels[value] || value || "Perm";
}

function titleForPermissionMode(value) {
  const titles = {
    default: "默认权限",
    auto: "自动审查",
    full: "完全访问权限",
    custom: "自定义 (config.toml)",
  };
  return titles[value] || "Thread permission";
}

function normalizePermissionModeValue(value) {
  const text = String(value || "").trim().toLowerCase();
  const aliases = {
    "full-access": "full",
    "workspace-write": "auto",
    "read-only": "auto",
    "auto-review": "auto",
    "auto-reviewing": "auto",
    config: "custom",
    "config.toml": "custom",
    "custom-config": "custom",
  };
  return aliases[text] || text;
}

function normalizeModelKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function rateLimitModelKeys(rateLimits) {
  if (!rateLimits || typeof rateLimits !== "object") return [];
  const keys = new Set();
  const add = (value) => {
    const key = normalizeModelKey(value);
    if (key) keys.add(key);
  };
  if (Array.isArray(rateLimits.modelKeys)) {
    for (const value of rateLimits.modelKeys) add(value);
  }
  add(rateLimits.model);
  add(rateLimits.limitName);
  const limitNameKey = normalizeModelKey(rateLimits.limitName);
  for (const model of normalizeOptionList([state.defaultModel, ...state.modelOptions])) {
    const modelKey = normalizeModelKey(model);
    if (modelKey && limitNameKey === modelKey) keys.add(modelKey);
  }
  const limitId = normalizeModelKey(rateLimits.limitId);
  if (limitId === "codex-bengalfox") keys.add("gpt-5.3-codex-spark");
  else if (limitId === "codex") add(state.defaultModel || "gpt-5.5");
  return [...keys];
}

function rememberRateLimits(rateLimits, rateLimitsByModel) {
  if (rateLimitsByModel && typeof rateLimitsByModel === "object") {
    for (const [model, value] of Object.entries(rateLimitsByModel)) {
      const key = normalizeModelKey(model);
      if (key && value && typeof value === "object") state.rateLimitsByModel[key] = value;
    }
  }
  if (rateLimits && typeof rateLimits === "object") {
    state.rateLimits = rateLimits;
    for (const key of rateLimitModelKeys(rateLimits)) {
      state.rateLimitsByModel[normalizeModelKey(key)] = rateLimits;
    }
  }
  renderQuotaUsage();
}

function rateLimitWindows(rateLimits) {
  return [rateLimits && rateLimits.primary, rateLimits && rateLimits.secondary]
    .filter((windowInfo) => windowInfo && Number.isFinite(Number(windowInfo.usedPercent)));
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
  const date = new Date(Number(seconds) * 1000);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function quotaRemainingText(windowInfo) {
  if (!windowInfo) return "--";
  const used = clampPercent(windowInfo.usedPercent);
  const remaining = clampPercent(100 - used);
  return `${Math.round(remaining)}%`;
}

function quotaTitle(label, windowInfo) {
  if (!windowInfo) return `${label} quota remaining unavailable`;
  const used = clampPercent(windowInfo.usedPercent);
  const resetText = formatQuotaReset(windowInfo.resetsAt);
  return [
    `${label} quota remaining: ${quotaRemainingText(windowInfo)}`,
    `used: ${Math.round(used)}%`,
    resetText ? `resets: ${resetText}` : "",
  ].filter(Boolean).join("; ");
}

function selectedQuotaModel() {
  const modelSelect = $("modelSelect");
  return (modelSelect && modelSelect.value) || state.selectedModel || effectiveDefaultModel();
}

function rateLimitsForQuota() {
  const modelKey = normalizeModelKey(selectedQuotaModel());
  if (modelKey && state.rateLimitsByModel[modelKey]) return state.rateLimitsByModel[modelKey];
  if (!modelKey) return state.rateLimits;
  if (state.rateLimits && rateLimitModelKeys(state.rateLimits).includes(modelKey)) return state.rateLimits;
  return null;
}

function renderQuotaUsage() {
  const el = $("quotaUsage");
  if (!el) return;
  const rateLimits = rateLimitsForQuota();
  const fiveHour = fiveHourRateLimit(rateLimits);
  const weekly = weeklyRateLimit(rateLimits);
  const model = selectedQuotaModel();
  el.textContent = `${quotaRemainingText(fiveHour)} | ${quotaRemainingText(weekly)}`;
  el.title = [
    model ? `model: ${labelForModel(model)}` : "",
    `${quotaTitle("5-hour", fiveHour)} | ${quotaTitle("weekly", weekly)}`,
  ].filter(Boolean).join("; ");
  el.classList.toggle("unknown", !fiveHour && !weekly);
}

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

function clearReconnectTimers() {
  clearTimeout(state.reconnectNoticeTimer);
  clearTimeout(state.recoveryTimer);
  state.reconnectNoticeTimer = null;
  state.recoveryTimer = null;
}

function markActivity(label) {
  state.activityLabel = String(label || "").trim();
  state.activityAtMs = state.activityLabel ? Date.now() : 0;
  updateTurnTimer();
}

function markIdleActivity(label) {
  if (!state.activeTurnId && !currentLiveTurn()) return;
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

function visibleWorkspaceKeys() {
  return new Set(state.workspaces.map((ws) => normalizeFsPath(ws.cwd)).filter(Boolean));
}

function isHiddenThread(thread) {
  if (!thread) return true;
  const status = statusText(thread.status).toLowerCase();
  const location = String(thread.path || thread.rolloutPath || thread.rollout_path || "").toLowerCase();
  if (thread.archived || thread.archivedAt || thread.archived_at || thread.isArchived) return true;
  if (thread.deleted || thread.deletedAt || thread.deleted_at || thread.isDeleted || thread.removed || thread.removedAt) return true;
  if (/archived|deleted|removed/.test(status)) return true;
  if (/[/\\](archived|deleted|trash|removed)[_-]?sessions[/\\]/.test(location)) return true;
  const cwd = normalizeFsPath(thread.cwd);
  if (state.selectedCwd && cwd !== normalizeFsPath(state.selectedCwd)) return true;
  const keys = visibleWorkspaceKeys();
  if (keys.size > 0 && (!cwd || !keys.has(cwd))) return true;
  return false;
}

function visibleThreads(threads = state.threads) {
  return (threads || []).filter((thread) => !isHiddenThread(thread));
}

function pruneHiddenThreads() {
  state.threads = visibleThreads();
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

function isReasoningItem(item) {
  return item && item.type === "reasoning";
}

function syncActiveTurnFromThread() {
  const turns = state.currentThread && Array.isArray(state.currentThread.turns)
    ? state.currentThread.turns
    : [];
  const running = turns.slice().reverse().find((turn) => !isTurnComplete(turn) && isRunningStatus(turn.status));
  state.activeTurnId = running ? running.id : "";
  const interrupt = $("interruptTurn");
  if (interrupt) interrupt.disabled = !state.activeTurnId;
  updateComposerControls();
}

function isOperationalItem(item) {
  return item && (OPERATIONAL_ITEM_TYPES.has(item.type) || isWebSearchLikeItem(item));
}

function activityLabelForItem(item) {
  if (!item) return "更新";
  const status = statusText(item.status);
  const completed = isCompletedStatus(status);
  if (isWebSearchLikeItem(item)) return completed ? "搜索完成" : "搜索";
  if (item.type === "commandExecution") return completed ? "命令完成" : "命令";
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

function isContextCompactionPending(item, turn = null) {
  if (!item) return false;
  if (isCompletedStatus(item.status)) return false;
  const stateText = String(item.mobileCompactionStatus || "").toLowerCase();
  if (/running|active|queued|processing|inprogress|in_progress|in-progress|pending|started/.test(stateText)) return true;
  if (/completed|failed|cancel|error|interrupted/.test(stateText)) return false;
  const itemStatus = statusText(item.status).toLowerCase();
  if (/running|active|queued|processing|inprogress|in_progress|in-progress|pending|started/.test(itemStatus)) return true;
  return Boolean(turn && isLiveTurn(turn) && isContextCompactionType(item.type));
}

function contextCompactionNotice(item, turn = null) {
  return isContextCompactionPending(item, turn)
    ? CONTEXT_COMPACTION_PENDING_NOTICE
    : CONTEXT_COMPACTION_COMPLETE_NOTICE;
}

function latestTurn() {
  const turns = state.currentThread && Array.isArray(state.currentThread.turns)
    ? state.currentThread.turns
    : [];
  return turns.length ? turns[turns.length - 1] : null;
}

function isIncompleteInterruptedTurn(turn) {
  return turn
    && statusText(turn.status).toLowerCase() === "interrupted"
    && !turn.completedAt
    && !turn.durationMs;
}

function shouldPollCurrentThread() {
  if (!state.currentThreadId || document.visibilityState === "hidden") return false;
  const turn = latestTurn();
  if (!turn) return false;
  if (isTurnComplete(turn)) return false;
  return Boolean(state.activeTurnId) || isRunningStatus(turn.status) || isIncompleteInterruptedTurn(turn);
}

function isLiveTurn(turn) {
  if (!turn || isTurnComplete(turn)) return false;
  return isRunningStatus(turn && turn.status) || isIncompleteInterruptedTurn(turn);
}

function isLatestTurn(turn) {
  return Boolean(turn && latestTurn() === turn);
}

function stableItemKey(turn, item, index = 0, prefix = "item") {
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "thread";
  const turnId = turn && (turn.id || turn.startedAt || "turn");
  const itemId = item && (item.id || `${item.type || "item"}-${index}`);
  return [prefix, threadId, turnId, itemId].map((part) => String(part || "")).join("|");
}

function stableTurnKey(turn, suffix = "") {
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "thread";
  return ["turn", threadId, turn && (turn.id || turn.startedAt || "turn"), suffix].filter(Boolean).join("|");
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

function cleanupLeavingItems() {
  const now = Date.now();
  let needsRecheck = false;
  for (const [key, value] of state.leavingItems.entries()) {
    if (!value) {
      state.leavingItems.delete(key);
      continue;
    }
    if (value.keepUntilOutOfView) {
      if (value.maxExpiresAt && value.maxExpiresAt <= now) {
        state.leavingItems.delete(key);
        continue;
      }
      if (value.minExpiresAt && value.minExpiresAt > now) {
        needsRecheck = true;
        continue;
      }
      const node = renderNodeByKey(value.renderKey || key);
      if (node && isNodeInConversationViewport(node)) {
        needsRecheck = true;
        continue;
      }
      state.leavingItems.delete(key);
      continue;
    }
    if (value.expiresAt <= now) state.leavingItems.delete(key);
  }
  if (needsRecheck) scheduleLeavingCleanup();
}

function leavingItemsForTurn(turn) {
  cleanupLeavingItems();
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  return Array.from(state.leavingItems.values())
    .filter((value) => value.threadId === threadId && value.turnId === turn.id)
    .map((value) => ({
      html: value.html,
      sourceIndex: Number.isFinite(value.sourceIndex) ? value.sourceIndex : Number.MAX_SAFE_INTEGER,
      order: Number.isFinite(value.order) ? value.order : 0,
    }));
}

function renderNodeByKey(key) {
  const conversation = $("conversation");
  if (!conversation || !key) return null;
  return Array.from(conversation.querySelectorAll("[data-render-key]"))
    .find((node) => node.dataset.renderKey === key) || null;
}

function liveOperationNodeForItem(item) {
  const conversation = $("conversation");
  if (!conversation || !item || !item.id) return null;
  return Array.from(conversation.querySelectorAll(".live-operation"))
    .find((node) => node.dataset.item === String(item.id)) || null;
}

function isNodeInConversationViewport(node) {
  const conversation = $("conversation");
  if (!conversation || !node) return false;
  const viewport = conversation.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  const margin = 24;
  return rect.bottom > viewport.top + margin && rect.top < viewport.bottom - margin;
}

function scheduleLeavingCleanup(delay = 1200) {
  if (state.leavingCleanupTimer) return;
  state.leavingCleanupTimer = setTimeout(() => {
    state.leavingCleanupTimer = null;
    scheduleRenderCurrentThread();
  }, delay);
}

function trimRetainedOperationsForTurn(threadId, turnId, keepKey = "") {
  const retained = Array.from(state.leavingItems.entries())
    .filter(([, value]) => value
      && value.keepUntilOutOfView
      && value.threadId === threadId
      && value.turnId === turnId)
    .sort((a, b) => (Number(b[1].createdAt || 0) - Number(a[1].createdAt || 0)));
  if (keepKey && MAX_RETAINED_OPERATIONS_PER_TURN <= 1) {
    retained.forEach(([key]) => {
      if (key !== keepKey) state.leavingItems.delete(key);
    });
    return;
  }
  retained.forEach(([key], index) => {
    if (key === keepKey) return;
    if (index >= MAX_RETAINED_OPERATIONS_PER_TURN) state.leavingItems.delete(key);
  });
}

function rememberLeavingOperation(turn, item, index, options = {}) {
  if (!turn || !item || !isLatestTurn(turn)) return;
  const keepUntilOutOfView = Boolean(options.keepUntilOutOfView);
  if (options.onlyIfInViewport && !isNodeInConversationViewport(liveOperationNodeForItem(item))) return;
  const key = stableItemKey(turn, item, index, keepUntilOutOfView ? "retained-operation" : "leaving-operation");
  if (state.leavingItems.has(key)) return;
  const lines = operationSummaryLines(item);
  const body = lines.length ? `<div class="operation-body">${escapeHtml(lines.join("\n"))}</div>` : "";
  const status = statusText(item.status) || (item.completedAtMs ? "completed" : "running");
  const title = operationTitle(item, status);
  const type = item.type || "item";
  const now = Date.now();
  const transitionClass = keepUntilOutOfView ? "retained-operation" : "entry-leave";
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  const turnId = turn.id;
  state.leavingItems.set(key, {
    threadId,
    turnId,
    sourceIndex: index,
    order: 0,
    renderKey: key,
    keepUntilOutOfView,
    createdAt: now,
    minExpiresAt: keepUntilOutOfView ? now + 450 : 0,
    maxExpiresAt: keepUntilOutOfView ? now + 30000 : 0,
    expiresAt: now + (keepUntilOutOfView ? 30000 : 180),
    html: `<section class="item live-operation ${transitionClass} ${isCompletedStatus(status) ? "completed" : ""} ${escapeHtml(type)}" data-item="${escapeHtml(item.id || "")}" data-render-key="${escapeHtml(key)}">
    <div class="item-head"><span>${escapeHtml(title)}</span><span>${escapeHtml(status)}</span></div>
    ${body}
  </section>`,
  });
  if (keepUntilOutOfView) trimRetainedOperationsForTurn(threadId, turnId, key);
  setTimeout(() => scheduleRenderCurrentThread(), keepUntilOutOfView ? 480 : 190);
}

function visibleOperationIndex(turn) {
  if (!isLatestTurn(turn) || !isLiveTurn(turn)) return -1;
  const items = Array.isArray(turn.items) ? turn.items : [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (isOperationalItem(items[index])) return index;
  }
  return -1;
}

function latestVisibleOperationItem(turn) {
  const index = visibleOperationIndex(turn);
  if (index < 0) return null;
  const item = turn && Array.isArray(turn.items) ? turn.items[index] : null;
  return item ? { item, index } : null;
}

function visibleNonOperationalItemsForTurn(turn) {
  return (turn.items || []).filter((item) => !isReasoningItem(item) && !isOperationalItem(item));
}

function visibleItemsForTurn(turn) {
  const operation = latestVisibleOperationItem(turn);
  return (turn.items || []).map((item, index) => {
    if (!item || isReasoningItem(item)) return null;
    if (isOperationalItem(item) && (!operation || operation.item !== item)) return null;
    return { item, sourceIndex: index };
  }).filter(Boolean);
}

function hasVisibleNonOperationAfterIndex(turn, sourceIndex) {
  const items = turn && Array.isArray(turn.items) ? turn.items : [];
  for (let index = sourceIndex + 1; index < items.length; index += 1) {
    const item = items[index];
    if (item && !isOperationalItem(item) && !isReasoningItem(item) && itemVisibleWeight(item) > 0) return true;
  }
  return false;
}

function visibleItemSignature(item) {
  if (!item || isReasoningItem(item)) return null;
  if (isOperationalItem(item)) {
    return {
      id: item.id || "",
      type: item.type || "",
      status: statusText(item.status),
      command: item.command || "",
      fileNames: Array.isArray(item.fileNames) ? item.fileNames : [],
      tool: item.tool || "",
      server: item.server || "",
      namespace: item.namespace || "",
    };
  }
  return {
    id: item.id || "",
    type: item.type || "",
    status: statusText(item.status),
    text: item.text || "",
    content: Array.isArray(item.content) ? inputContentSignature(item.content) : [],
    summary: Array.isArray(item.summary) ? item.summary : [],
    mobileNotice: item.mobileNotice || "",
  };
}

function inputContentSignature(content) {
  return (content || []).map((part) => {
    if (!part || typeof part !== "object") return String(part || "");
    if (part.type === "text") return { type: "text", text: part.text || "" };
    if (isInputImagePart(part)) {
      return {
        type: part.type || "image",
        path: part.path || "",
        url: imageSourceSignature(part.url || part.image_url || ""),
      };
    }
    return compactStructuredForSignature(part);
  });
}

function imageSourceSignature(value) {
  const text = String(value || "");
  if (/^data:image\//i.test(text)) return `${text.slice(0, 48)}...${text.length}`;
  return text;
}

function compactStructuredForSignature(value) {
  try {
    return truncateMiddle(JSON.stringify(value), 600, "payload");
  } catch (_) {
    return String(value || "");
  }
}

function itemVisibleWeight(item) {
  const signature = visibleItemSignature(item);
  return signature ? JSON.stringify(signature).length : 0;
}

function turnVisibleWeight(turn) {
  const items = turn && Array.isArray(turn.items) ? turn.items : [];
  return items.reduce((total, item) => total + itemVisibleWeight(item), 0);
}

function shouldPreserveLocalOnlyItem(item, preserveLocalVisible = false) {
  if (!item || itemVisibleWeight(item) <= 0) return false;
  if (item.type === "userMessage" && /^mux-user-/.test(String(item.id || ""))) return true;
  return preserveLocalVisible && !isReasoningItem(item);
}

function isMuxUserMessage(item) {
  return Boolean(item && item.type === "userMessage" && /^mux-user-/.test(String(item.id || "")));
}

function normalizeComparableText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function userMessageComparableParts(item) {
  const result = { text: "", paths: [] };
  if (!item || item.type !== "userMessage") return result;
  const textParts = [];
  const paths = [];
  for (const part of item.content || []) {
    if (!part || typeof part !== "object") continue;
    if (part.type === "text") {
      const split = splitAttachmentSummaryText(part.text || "");
      if (split.text) textParts.push(split.text);
      for (const attachment of split.attachments) {
        if (attachment.path) paths.push(normalizeFsPath(attachment.path));
      }
      continue;
    }
    if (part.path) paths.push(normalizeFsPath(part.path));
  }
  result.text = normalizeComparableText(textParts.join("\n"));
  result.paths = [...new Set(paths.filter(Boolean))].sort();
  return result;
}

function userMessagePathOverlap(left, right) {
  return left.paths.length > 0 && right.paths.length > 0
    && left.paths.some((pathValue) => right.paths.includes(pathValue));
}

function userMessageSpecificity(item) {
  const parts = userMessageComparableParts(item);
  return parts.text.length + (parts.paths.length * 240);
}

function userMessagesLikelySame(left, right) {
  if (!left || !right || left.type !== "userMessage" || right.type !== "userMessage") return false;
  const a = userMessageComparableParts(left);
  const b = userMessageComparableParts(right);
  if (a.text && b.text && a.text === b.text) {
    if (!a.paths.length && !b.paths.length) return true;
    return userMessagePathOverlap(a, b);
  }
  return userMessagePathOverlap(a, b) && (!a.text || !b.text || a.text === b.text);
}

function hasMatchingIncomingUserMessage(existingItem, incomingItems) {
  if (!existingItem || existingItem.type !== "userMessage") return false;
  return (incomingItems || []).some((incomingItem) => incomingItem
    && incomingItem.id !== existingItem.id
    && incomingItem.type === "userMessage"
    && userMessagesLikelySame(existingItem, incomingItem));
}

function hasMatchingRealUserMessage(item, items) {
  if (!isMuxUserMessage(item)) return false;
  return (items || []).some((candidate) => candidate
    && candidate.id !== item.id
    && candidate.type === "userMessage"
    && !isMuxUserMessage(candidate)
    && userMessagesLikelySame(candidate, item));
}

function removeShadowedMuxUserMessages(items) {
  return (items || []).filter((item) => !hasMatchingRealUserMessage(item, items));
}

function comparableVisibleTextItem(item) {
  return Boolean(item && (item.type === "agentMessage" || item.type === "plan"));
}

function comparableVisibleText(item) {
  if (!comparableVisibleTextItem(item)) return "";
  return normalizeComparableText(item.text || "");
}

function visibleTextItemsLikelySame(existingItem, incomingItem) {
  if (!comparableVisibleTextItem(existingItem) || !comparableVisibleTextItem(incomingItem)) return false;
  if (existingItem.type !== incomingItem.type) return false;
  const existingText = comparableVisibleText(existingItem);
  const incomingText = comparableVisibleText(incomingItem);
  if (!existingText || !incomingText) return false;
  return incomingText === existingText
    || (incomingText.length >= existingText.length && incomingText.startsWith(existingText));
}

function hasMatchingIncomingVisibleItem(existingItem, incomingItems) {
  if (hasMatchingIncomingUserMessage(existingItem, incomingItems)) return true;
  return (incomingItems || []).some((incomingItem) => visibleTextItemsLikelySame(existingItem, incomingItem));
}

function mergeItemPreservingVisibleFields(existingItem, incomingItem) {
  if (!existingItem || !incomingItem) return incomingItem || existingItem;
  const existingWeight = itemVisibleWeight(existingItem);
  const incomingWeight = itemVisibleWeight(incomingItem);
  if (existingWeight <= incomingWeight) return incomingItem;
  const merged = Object.assign({}, existingItem, incomingItem);
  if (typeof existingItem.text === "string") merged.text = existingItem.text;
  if (Array.isArray(existingItem.content)) merged.content = existingItem.content;
  if (Array.isArray(existingItem.summary)) merged.summary = existingItem.summary;
  if (existingItem.mobileNotice) merged.mobileNotice = existingItem.mobileNotice;
  if (isOperationalItem(existingItem)) {
    if (existingItem.command) merged.command = existingItem.command;
    if (Array.isArray(existingItem.fileNames)) merged.fileNames = existingItem.fileNames;
    if (existingItem.tool) merged.tool = existingItem.tool;
    if (existingItem.server) merged.server = existingItem.server;
    if (existingItem.namespace) merged.namespace = existingItem.namespace;
  }
  return merged;
}

function mergeItemsPreservingLocalVisible(existingItems, incomingItems, preserveLocalVisible = false) {
  const incomingById = new Map((incomingItems || [])
    .filter((item) => item && item.id)
    .map((item) => [item.id, item]));
  const added = new Set();
  const merged = [];
  for (const existingItem of existingItems || []) {
    if (!existingItem) continue;
    const id = existingItem.id;
    if (id && incomingById.has(id)) {
      merged.push(mergeItemPreservingVisibleFields(existingItem, incomingById.get(id)));
      added.add(id);
    } else if (hasMatchingIncomingVisibleItem(existingItem, incomingItems)) {
      if (id) added.add(id);
    } else if (shouldPreserveLocalOnlyItem(existingItem, preserveLocalVisible)) {
      merged.push(existingItem);
      if (id) added.add(id);
    }
  }
  for (const incomingItem of incomingItems || []) {
    if (!incomingItem) continue;
    if (incomingItem.id && added.has(incomingItem.id)) continue;
    if (hasMatchingRealUserMessage(incomingItem, merged) || hasMatchingRealUserMessage(incomingItem, incomingItems)) continue;
    merged.push(incomingItem);
    if (incomingItem.id) added.add(incomingItem.id);
  }
  return removeShadowedMuxUserMessages(merged);
}

function mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) {
  if (!existingTurn) return incomingTurn;
  if (!incomingTurn) return existingTurn;
  const existingItems = Array.isArray(existingTurn.items) ? existingTurn.items : [];
  const incomingHasItems = Array.isArray(incomingTurn.items);
  const merged = Object.assign({}, existingTurn, incomingTurn);
  if (!incomingHasItems) merged.items = existingItems;
  else {
    const incomingWeight = turnVisibleWeight(Object.assign({}, incomingTurn, { items: incomingTurn.items || [] }));
    const preserveLocalVisible = incomingWeight < turnVisibleWeight(existingTurn);
    merged.items = mergeItemsPreservingLocalVisible(existingItems, incomingTurn.items || [], preserveLocalVisible);
  }
  return merged;
}

function mergeThreadPreservingVisibleItems(existingThread, incomingThread) {
  if (!existingThread || !incomingThread || existingThread.id !== incomingThread.id) return incomingThread;
  const existingTurns = Array.isArray(existingThread.turns) ? existingThread.turns : [];
  const incomingTurns = Array.isArray(incomingThread.turns) ? incomingThread.turns : null;
  const existingById = new Map(existingTurns.map((turn) => [turn.id, turn]));
  const merged = Object.assign({}, existingThread, incomingThread);
  if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoading")) {
    delete merged.mobileLoading;
  }
  if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoadError")) {
    delete merged.mobileLoadError;
  }
  if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileReadWarning")) {
    delete merged.mobileReadWarning;
  }
  if (!incomingTurns) return merged;
  merged.turns = incomingTurns.map((incomingTurn) => {
    const existingTurn = existingById.get(incomingTurn.id);
    return existingTurn ? mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) : incomingTurn;
  });
  const incomingIds = new Set(merged.turns.map((turn) => turn && turn.id).filter(Boolean));
  for (const existingTurn of existingTurns) {
    if (!existingTurn || incomingIds.has(existingTurn.id)) continue;
    if (existingTurn.id === state.activeTurnId || (!isTurnComplete(existingTurn) && turnVisibleWeight(existingTurn) > 0)) {
      merged.turns.push(existingTurn);
    }
  }
  return merged;
}

function approvalThreadId(request) {
  return request && request.params && (request.params.threadId || request.params.conversationId || "");
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

function conversationRenderSignature(thread) {
  if (!thread) return "home";
  if (thread.mobileLoadError) return `load-error|${state.currentThreadId || thread.id || ""}|${thread.mobileLoadError}`;
  if (thread.mobileLoading) return `loading|${state.currentThreadId || thread.id || ""}`;
  cleanupLeavingItems();
  const turns = (thread.turns || []).slice(-MAX_VISIBLE_TURNS);
  const omitted = Number(thread.mobileOmittedTurnCount || 0) + Math.max(0, (thread.turns || []).length - turns.length);
  const leavingKeys = Array.from(state.leavingItems.entries())
    .filter(([, value]) => value && value.threadId === (state.currentThreadId || thread.id || ""))
    .map(([key]) => key)
    .sort();
  const payload = {
    threadId: state.currentThreadId || thread.id || "",
    rolloutSizeBytes: rolloutSizeBytes(thread),
    rolloutWarning: isRolloutOverThreshold(thread),
    rolloutWarningThresholdBytes: rolloutThresholdBytes(thread),
    omitted,
    leavingKeys,
    approvals: approvalRequestsSignature(state.currentThreadId || thread.id || ""),
    turns: turns.map((turn) => {
      const timerShowsStatus = isLatestTurn(turn) && (isLiveTurn(turn) || turnFinalSeconds(turn) != null);
      return {
        id: turn.id || "",
        statusLine: timerShowsStatus ? "" : displayTurnStatus(turn),
        durationMs: timerShowsStatus ? "" : (turn.durationMs || ""),
        items: visibleItemsForTurn(turn).map((entry) => ({
          sourceIndex: entry.sourceIndex,
          item: visibleItemSignature(entry.item),
        })).filter((entry) => entry.item),
      };
    }),
  };
  return JSON.stringify(payload);
}

function removeOperationalItemsFromTurn(turn) {
  if (!turn || !Array.isArray(turn.items)) return;
  let visibleIndex = visibleOperationIndex(turn);
  if (visibleIndex < 0 && isLatestTurn(turn) && !isLiveTurn(turn)) {
    for (let index = turn.items.length - 1; index >= 0; index -= 1) {
      if (isOperationalItem(turn.items[index])) {
        visibleIndex = index;
        break;
      }
    }
  }
  turn.items.forEach((item, index) => {
    if (index === visibleIndex && isOperationalItem(item)) rememberLeavingOperation(turn, item, index);
  });
  turn.items = turn.items.filter((item) => !isOperationalItem(item));
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

function isLiveReasoning(item, turn) {
  return item && item.type === "reasoning" && isLatestTurn(turn) && isLiveTurn(turn) && !isCompletedStatus(item.status);
}

function liveReasoningElapsed(item, turn) {
  const startedMs = item.startedAtMs
    || (item.startedAt ? item.startedAt * 1000 : 0)
    || (turn && turn.startedAt ? turn.startedAt * 1000 : 0)
    || state.nowMs;
  return Math.max(0, Math.floor((state.nowMs - startedMs) / 1000));
}

function currentLiveTurn() {
  const turns = state.currentThread && Array.isArray(state.currentThread.turns)
    ? state.currentThread.turns
    : [];
  if (state.activeTurnId) {
    const active = turns.find((turn) => turn.id === state.activeTurnId);
    if (active && isLiveTurn(active)) return active;
  }
  return turns.slice().reverse().find((turn) => isLiveTurn(turn)) || null;
}

function turnElapsedSeconds(turn) {
  if (!turn) return 0;
  const startedMs = turn.startedAtMs
    || (turn.startedAt ? turn.startedAt * 1000 : 0)
    || state.nowMs;
  return Math.max(0, Math.floor((state.nowMs - startedMs) / 1000));
}

function turnFinalSeconds(turn) {
  if (!turn) return null;
  if (turn.durationMs) return Math.max(0, Math.round(turn.durationMs / 1000));
  if (turn.completedAt && turn.startedAt) return Math.max(0, Math.round(turn.completedAt - turn.startedAt));
  return null;
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

function updateTurnTimer() {
  const el = $("turnTimer");
  if (!el) return;
  updateComposerHeightVar();
  const turn = currentLiveTurn();
  if (!turn) {
    const latest = latestTurn();
    const finalSeconds = turnFinalSeconds(latest);
    if (finalSeconds != null) {
      setTurnTimerContent(el, finalSeconds, "已结束");
      el.classList.add("visible", "settled");
      el.classList.remove("active");
      el.setAttribute("aria-hidden", "false");
    } else {
      setTurnTimerContent(el, 0);
      el.classList.remove("visible", "settled", "active");
      el.setAttribute("aria-hidden", "true");
    }
    return;
  }
  setTurnTimerContent(el, turnElapsedSeconds(turn), state.activityLabel);
  el.classList.add("visible", "active");
  el.classList.remove("settled");
  el.setAttribute("aria-hidden", "false");
}

function updateTickTimer() {
  clearInterval(state.tickTimer);
  state.tickTimer = null;
  updateTurnTimer();
  if (!currentLiveTurn()) return;
  state.tickTimer = setInterval(() => {
    state.nowMs = Date.now();
    updateTurnTimer();
  }, 1000);
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

async function api(path, options = {}) {
  const headers = Object.assign({}, options.headers || {});
  const timeoutMs = options.timeoutMs || 30000;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const externalSignal = options.signal;
  const abortFromExternal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", abortFromExternal, { once: true });
  }
  const fetchOptions = Object.assign({}, options, { headers, signal: controller.signal });
  delete fetchOptions.timeoutMs;
  if (state.key) headers["X-Codex-Mobile-Key"] = state.key;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body && !isFormData && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  try {
    const res = await fetch(path, fetchOptions);
    if (res.status === 401) {
      showLogin();
      throw new Error("Unauthorized");
    }
    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body.error) message = body.error;
      } catch (_) {}
      throw new Error(message);
    }
    if (res.status === 204) return null;
    return res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      if (timedOut) throw new Error(`Request timed out: ${path}`);
      throw new Error(`Request cancelled: ${path}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener("abort", abortFromExternal);
  }
}

function postClientEvent(event, details = {}) {
  if (!state.key) return;
  const payload = JSON.stringify({
    event,
    threadId: state.currentThreadId || "",
    path: location.pathname || "/",
    details,
  });
  const url = `/api/client-events?key=${encodeURIComponent(state.key)}`;
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch (_) {}
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

function startUiWatchdog() {
  if (state.uiWatchdogTimer) return;
  state.lastUiWatchdogTickAt = Date.now();
  state.uiWatchdogTimer = setInterval(() => {
    const now = Date.now();
    const lagMs = now - state.lastUiWatchdogTickAt - 1000;
    state.lastUiWatchdogTickAt = now;
    if (document.visibilityState === "hidden" || lagMs < 2500) return;
    if (now - state.lastUiStallReportedAt < 15000) return;
    state.lastUiStallReportedAt = now;
    postClientEvent("ui_stall", {
      lagMs: Math.round(lagMs),
      composerBusy: state.composerBusy,
      activeTurnId: state.activeTurnId || "",
      hasContent: composerHasContent(),
    });
  }, 1000);
}

function updatePushButton() {
  const button = $("pushNotifications");
  if (!button) return;
  button.classList.remove("ready", "error");
  if (state.pushBusy) {
    button.textContent = "Working...";
    button.disabled = true;
    return;
  }
  if (!state.pushServerSupported) {
    button.textContent = "Notifications unavailable";
    button.disabled = true;
    return;
  }
  if (!window.isSecureContext) {
    button.textContent = "HTTPS required";
    button.disabled = true;
    button.classList.add("error");
    return;
  }
  if (!pushBrowserAvailable()) {
    button.textContent = "Notifications unsupported";
    button.disabled = true;
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
  return state.serviceWorkerRegistration;
}

async function syncExistingPushSubscription() {
  if (!state.key || !pushBrowserAvailable()) return;
  const registration = await registerPushServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  state.pushSubscribed = Boolean(subscription);
  if (subscription) {
    await api("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription: pushSubscriptionToJson(subscription) }),
    });
  }
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
  const permission = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission;
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
      applicationServerKey: base64UrlToUint8Array(key.publicKey),
    });
  }
  await api("/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify({ subscription: pushSubscriptionToJson(subscription) }),
  });
  state.pushSubscribed = true;
  state.pushError = "";
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "Notifications enabled";
}

async function sendTestPushNotification() {
  const result = await api("/api/push/test", { method: "POST", body: "{}" });
  $("connectionState").classList.remove("error");
  if (result.sent) {
    $("connectionState").textContent = "Test notification sent";
    return;
  }
  if (result.failed) {
    const detail = result.lastError && (result.lastError.reason || result.lastError.statusCode)
      ? `${result.lastError.statusCode || ""} ${result.lastError.reason || ""}`.trim()
      : "delivery failed";
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

function showLogin(message = "") {
  $("app").classList.add("hidden");
  $("login").classList.remove("hidden");
  $("loginError").textContent = message;
}

function showApp() {
  updateViewportVars();
  $("login").classList.add("hidden");
  $("app").classList.remove("hidden");
  updateComposerHeightVar();
}

async function login(key) {
  await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  }).then(async (res) => {
    if (!res.ok) throw new Error("Access key is not valid");
  });
  state.key = key;
  localStorage.setItem("codexMobileKey", key);
  showApp();
  await bootstrap();
}

async function bootstrap() {
  applyUrlThreadSelection();
  const status = await api("/api/status").catch((err) => {
    $("connectionState").textContent = err.message;
    $("connectionState").classList.add("error");
    return null;
  });
  if (status) updateConnectionState(status);
  if (status && (status.rateLimits || status.rateLimitsByModel)) rememberRateLimits(status.rateLimits, status.rateLimitsByModel);
  await loadWorkspaces();
  await loadThreads();
  await restoreThreadSelection();
  connectEvents();
  initializePushControls().catch((err) => {
    state.pushError = err.message || String(err);
    updatePushButton();
  });
}

function threadIdFromUrlValue(value) {
  try {
    const url = new URL(value || window.location.href, window.location.origin);
    return String(url.searchParams.get("thread") || "").trim();
  } catch (_) {
    return "";
  }
}

function clearThreadUrl() {
  try {
    window.history.replaceState({}, "", window.location.pathname || "/");
  } catch (_) {
    // URL cleanup is best-effort after external thread selection.
  }
}

async function openExternalThreadSelection(threadId) {
  const id = String(threadId || "").trim();
  if (!id) return;
  localStorage.setItem(STORAGE_THREAD_ID, id);
  clearThreadUrl();
  if (!state.key) return;
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "Opening notification thread";
  if (!state.workspaces.length) {
    try {
      await loadWorkspaces();
    } catch (_) {
      // Loading the thread by id can still succeed without refreshing workspace shortcuts.
    }
  }
  await loadThread(id);
}

function applyUrlThreadSelection(options = {}) {
  try {
    const threadId = threadIdFromUrlValue(window.location.href);
    if (!threadId) return "";
    localStorage.setItem(STORAGE_THREAD_ID, threadId);
    clearThreadUrl();
    if (options.load) openExternalThreadSelection(threadId).catch(showError);
    return threadId;
  } catch (_) {
    // URL thread selection is best-effort for notification clicks.
  }
  return "";
}

function handleServiceWorkerMessage(event) {
  const data = event && event.data ? event.data : {};
  if (!data || data.type !== "codex-open-thread") return;
  const threadId = data.threadId || threadIdFromUrlValue(data.url);
  openExternalThreadSelection(threadId).catch(showError);
}

async function loadWorkspaces() {
  const result = await api("/api/workspaces");
  state.workspaces = result.data || [];
  const select = $("workspaceSelect");
  select.innerHTML = `<option value="">All workspaces</option>` + state.workspaces.map((ws) => {
    const count = ws.recentThreadCount ? ` (${ws.recentThreadCount})` : "";
    return `<option value="${escapeHtml(ws.cwd)}">${escapeHtml(`${ws.label}${count} - ${ws.cwd}`)}</option>`;
  }).join("");
  if (state.selectedCwd && !state.workspaces.some((ws) => normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd))) {
    state.selectedCwd = "";
  }
  if (state.selectedCwd) select.value = state.selectedCwd;
  updateWorkspacePath();
  if (!state.currentThread) renderCurrentThread();
}

function updateWorkspacePath() {
  const el = $("workspacePath");
  if (!el) return;
  el.hidden = !state.selectedCwd;
  el.textContent = state.selectedCwd || "";
}

function clearCurrentThreadSelection() {
  state.threadLoadSeq += 1;
  if (state.threadLoadController) {
    state.threadLoadController.abort();
    state.threadLoadController = null;
  }
  clearTimeout(state.refreshTimer);
  clearTimeout(state.pollTimer);
  state.pollStableCount = 0;
  state.currentThread = null;
  state.currentThreadId = "";
  state.activeTurnId = "";
  state.leavingItems.clear();
  localStorage.removeItem(STORAGE_THREAD_ID);
  syncActiveTurnFromThread();
  if (state.events) connectEvents();
}

function renderThreadListLoading() {
  const list = $("threadList");
  if (!list) return;
  list.innerHTML = `<div class="empty-state">Loading threads...</div>`;
  state.renderedThreadListSignature = `loading|${state.selectedCwd}|${$("threadSearch").value.trim()}`;
}

async function loadThreads() {
  const seq = state.threadListLoadSeq + 1;
  state.threadListLoadSeq = seq;
  if (state.threadListLoadController) state.threadListLoadController.abort();
  const controller = new AbortController();
  state.threadListLoadController = controller;
  const params = new URLSearchParams({ limit: "80", archived: "false" });
  if (state.selectedCwd) params.set("cwd", state.selectedCwd);
  const search = $("threadSearch").value.trim();
  if (search) params.set("search", search);
  renderThreadListLoading();
  try {
    const result = await api(`/api/threads?${params}`, { timeoutMs: 45000, signal: controller.signal });
    if (seq !== state.threadListLoadSeq) return null;
    state.threads = visibleThreads(result.data || []);
    reconcileThreadStatusHints(state.threads);
    renderThreads(result);
    restoreConnectionState(result.mobileFallback ? "Recovered from session index" : "Connected");
    if (!state.currentThread) renderCurrentThread();
    return result;
  } catch (err) {
    if (seq !== state.threadListLoadSeq || controller.signal.aborted) return null;
    renderThreadLoadError(err);
    throw err;
  } finally {
    if (state.threadListLoadController === controller) state.threadListLoadController = null;
  }
}

async function loadThread(threadId) {
  if (threadId && threadId !== state.continuationSourceThreadId) {
    state.continuationSourceThreadId = "";
  }
  if (threadId === state.currentThreadId
    && state.currentThread
    && !state.currentThread.mobileLoading
    && !state.currentThread.mobileLoadError) {
    closeThreadActions();
    renderThreads();
    renderCurrentThread();
    if (window.matchMedia("(max-width: 760px)").matches) $("sidebar").classList.remove("open");
    return;
  }
  const seq = state.threadLoadSeq + 1;
  state.threadLoadSeq = seq;
  if (state.threadLoadController) state.threadLoadController.abort();
  const controller = new AbortController();
  state.threadLoadController = controller;
  clearTimeout(state.pollTimer);
  markThreadViewed(threadId);
  const summary = state.threads.find((thread) => thread.id === threadId);
  state.currentThreadId = threadId;
  state.currentThread = summary ? Object.assign({ turns: [], mobileLoading: true }, summary) : {
    id: threadId,
    name: threadId,
    preview: threadId,
    turns: [],
    mobileLoading: true,
  };
  renderComposerSettings();
  syncActiveTurnFromThread();
  renderThreads();
  renderCurrentThread({ stickToBottom: true });
  updateComposerControls();
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "Loading thread";
  markActivity("加载线程");
  let result;
  try {
    result = await api(`/api/threads/${encodeURIComponent(threadId)}`, {
      timeoutMs: 20000,
      signal: controller.signal,
    });
  } catch (err) {
    if (seq !== state.threadLoadSeq || controller.signal.aborted) return;
    state.currentThread = Object.assign({}, state.currentThread || { id: threadId, name: threadId, preview: threadId, turns: [] }, {
      mobileLoading: false,
      mobileLoadError: err.message || String(err),
    });
    syncActiveTurnFromThread();
    renderThreads();
    renderCurrentThread();
    updateComposerControls();
    throw err;
  } finally {
    if (state.threadLoadController === controller) state.threadLoadController = null;
  }
  if (seq !== state.threadLoadSeq || state.currentThreadId !== threadId) return;
  state.currentThread = mergeThreadPreservingVisibleItems(state.currentThread, result.thread);
  localStorage.setItem(STORAGE_THREAD_ID, threadId);
  if (state.events) connectEvents();
  renderComposerSettings();
  syncActiveTurnFromThread();
  renderThreads();
  renderCurrentThread({ stickToBottom: true });
  restoreConnectionState();
  scheduleLivePollIfNeeded(1200);
  updateComposerControls();
  if (window.matchMedia("(max-width: 760px)").matches) $("sidebar").classList.remove("open");
}

async function refreshCurrentThread() {
  if (!state.currentThreadId) return;
  markIdleActivity("同步");
  const threadId = state.currentThreadId;
  const seq = state.threadLoadSeq;
  const result = await api(`/api/threads/${encodeURIComponent(threadId)}`, { timeoutMs: 20000 });
  if (state.currentThreadId !== threadId || seq !== state.threadLoadSeq) return;
  state.currentThread = mergeThreadPreservingVisibleItems(state.currentThread, result.thread);
  renderComposerSettings();
  syncActiveTurnFromThread();
  renderThreads();
  renderCurrentThread();
  scheduleLivePollIfNeeded();
}

function scheduleCurrentThreadRefresh(delay = 600) {
  clearTimeout(state.refreshTimer);
  state.refreshTimer = setTimeout(() => {
    refreshCurrentThread().catch(showError);
  }, delay);
}

function scheduleLivePollIfNeeded(delay = 2600) {
  clearTimeout(state.pollTimer);
  if (!shouldPollCurrentThread()) return;
  const signature = threadSignature();
  if (signature === state.lastThreadSignature) state.pollStableCount += 1;
  else state.pollStableCount = 0;
  state.lastThreadSignature = signature;
  const nextDelay = state.pollStableCount > 60 ? 10000 : delay;
  state.pollTimer = setTimeout(() => {
    refreshCurrentThread().catch(showError);
  }, nextDelay);
}

function closeThreadActions(exceptThreadId = "") {
  const keep = String(exceptThreadId || "");
  if (state.openThreadActionId && state.openThreadActionId !== keep) state.openThreadActionId = "";
  document.querySelectorAll("[data-thread-row]").forEach((row) => {
    const open = keep && row.dataset.threadRow === keep;
    row.classList.toggle("swipe-open", Boolean(open));
    row.style.removeProperty("--thread-swipe-x");
    const actions = row.querySelector(".thread-row-actions");
    if (actions) actions.setAttribute("aria-hidden", open ? "false" : "true");
  });
}

function setThreadActionOpen(threadId, open) {
  state.openThreadActionId = open ? String(threadId || "") : "";
  closeThreadActions(state.openThreadActionId);
}

function applyThreadActionState() {
  closeThreadActions(state.openThreadActionId);
}

function handleThreadCardClick(event) {
  const button = event.currentTarget;
  const threadId = button && button.dataset.thread;
  if (!threadId) return;
  if (Date.now() < state.suppressThreadClickUntil
    && (!state.suppressThreadClickThreadId || state.suppressThreadClickThreadId === threadId)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (Date.now() >= state.suppressThreadClickUntil) state.suppressThreadClickThreadId = "";
  if (state.openThreadActionId) {
    event.preventDefault();
    event.stopPropagation();
    closeThreadActions();
    return;
  }
  loadThread(threadId).catch(showError);
}

function suppressThreadClickAfterSwipe(event) {
  if (Date.now() >= state.suppressThreadClickUntil) {
    state.suppressThreadClickThreadId = "";
    return;
  }
  if (event.target.closest("[data-new-thread-from-thread]")) return;
  const row = event.target.closest("[data-thread-row]");
  if (!row) return;
  const threadId = row.dataset.threadRow || "";
  if (state.suppressThreadClickThreadId && state.suppressThreadClickThreadId !== threadId) return;
  event.preventDefault();
  event.stopPropagation();
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
  const warning = result && result.mobileFallback
    ? `<div class="history-note">Live thread list recovering. Showing cached session index.</div>`
    : "";
  const nowMs = Date.now();
  const html = warning + state.threads.map((thread) => {
    const title = thread.name || thread.preview || thread.id;
    const sizeText = rolloutSizeText(thread);
    const sizeWarn = isRolloutOverThreshold(thread);
    const updatedTitle = formatAbsoluteTime(thread.updatedAt);
    const pathText = shortPath(thread.cwd);
    const timeText = formatTime(thread.updatedAt, nowMs);
    const statusIcon = statusIconHtml(thread.status, "thread-status-icon", thread.id);
    const iconKind = statusIconInfo(thread.status, thread.id)?.kind || "";
    const active = thread.id === state.currentThreadId ? " active" : "";
    const emphasis = iconKind ? ` has-status-${iconKind}` : "";
    const sizeBadge = sizeText
      ? `<div class="thread-card-size${sizeWarn ? " warn" : ""}" title="Rollout file size">${escapeHtml(sizeText)}</div>`
      : "";
    const actionOpen = state.openThreadActionId === thread.id;
    const action = `<div class="thread-row-actions" aria-hidden="${actionOpen ? "false" : "true"}">
      <button class="thread-new-button" type="button" data-new-thread-from-thread="${escapeHtml(thread.id)}">压缩续接</button>
    </div>`;
    return `<div class="thread-card-wrap${sizeWarn ? " rollout-warn" : ""}${actionOpen ? " swipe-open" : ""}" data-thread-row="${escapeHtml(thread.id)}">
      <button class="thread-card${active}${emphasis}${sizeWarn ? " rollout-warn" : ""}" type="button" data-thread="${escapeHtml(thread.id)}">
        <div class="thread-card-title-row">
          <div class="thread-card-title">${escapeHtml(title)}</div>
          ${statusIcon}
        </div>
        <div class="thread-card-meta-row">
          <div class="thread-card-meta">
            ${pathText ? `<span class="thread-card-path">${escapeHtml(pathText)}</span>` : ""}
            ${timeText ? `<span class="thread-card-time" title="${escapeHtml(updatedTitle)}">${escapeHtml(timeText)}</span>` : ""}
          </div>
          ${sizeBadge}
        </div>
      </button>
      ${action}
    </div>`;
  }).join("");
  const signature = JSON.stringify({
    warning: Boolean(warning),
    currentThreadId: state.currentThreadId,
    timeBucket: Math.floor(nowMs / 60000),
    threads: state.threads.map((thread) => [
      thread.id,
      thread.name || thread.preview || thread.id,
      shortPath(thread.cwd),
      thread.updatedAt,
      statusText(thread.status),
      statusIconInfo(thread.status, thread.id)?.kind || "",
      state.unreadThreadIds.has(thread.id) ? 1 : 0,
      rolloutSizeBytes(thread),
      isRolloutOverThreshold(thread),
      state.openThreadActionId === thread.id,
    ]),
  });
  if (state.renderedThreadListSignature === signature) return;
  list.innerHTML = html;
  state.renderedThreadListSignature = signature;
  list.querySelectorAll("[data-thread]").forEach((button) => {
    button.addEventListener("click", handleThreadCardClick);
  });
  list.querySelectorAll("[data-new-thread-from-thread]").forEach((button) => {
    button.addEventListener("click", startNewThreadFromList);
  });
  applyThreadActionState();
}

async function restoreThreadSelection() {
  if (state.currentThread) return;
  const savedThreadId = localStorage.getItem(STORAGE_THREAD_ID) || "";
  if (!state.threads.length && !savedThreadId) return;
  const saved = savedThreadId && state.threads.find((thread) => thread.id === savedThreadId);
  const active = state.threads.find((thread) => isRunningStatus(thread.status));
  const target = saved || (savedThreadId ? { id: savedThreadId } : active);
  if (!target) return;
  try {
    await loadThread(target.id);
  } catch (err) {
    if (target.id === savedThreadId) localStorage.removeItem(STORAGE_THREAD_ID);
    showError(err);
    renderCurrentThread();
  }
}

async function selectWorkspaceShortcut(cwd) {
  state.selectedCwd = cwd || "";
  clearCurrentThreadSelection();
  const select = $("workspaceSelect");
  if (select) select.value = state.selectedCwd;
  updateWorkspacePath();
  updateComposerControls();
  renderCurrentThread();
  await loadThreads();
}

function renderKeyForNode(node) {
  return node && node.nodeType === Node.ELEMENT_NODE ? node.getAttribute("data-render-key") || "" : "";
}

function canPatchNode(target, source) {
  if (!target || !source || target.nodeType !== source.nodeType) return false;
  if (target.nodeType !== Node.ELEMENT_NODE) return true;
  return target.tagName === source.tagName;
}

function syncAttributes(target, source) {
  const sourceNames = new Set(Array.from(source.attributes).map((attr) => attr.name));
  for (const attr of Array.from(target.attributes)) {
    if (!sourceNames.has(attr.name)) target.removeAttribute(attr.name);
  }
  for (const attr of Array.from(source.attributes)) {
    if (target.getAttribute(attr.name) !== attr.value) target.setAttribute(attr.name, attr.value);
  }
}

function patchNode(target, source) {
  if (!canPatchNode(target, source)) {
    const replacement = source.cloneNode(true);
    target.replaceWith(replacement);
    return replacement;
  }
  if (target.nodeType === Node.TEXT_NODE || target.nodeType === Node.COMMENT_NODE) {
    if (target.nodeValue !== source.nodeValue) target.nodeValue = source.nodeValue;
    return target;
  }
  syncAttributes(target, source);
  patchChildNodes(target, source);
  return target;
}

function patchChildNodes(target, source) {
  const sourceChildren = Array.from(source.childNodes);
  const targetChildren = Array.from(target.childNodes);
  const keyedTargets = new Map();
  for (const child of targetChildren) {
    const key = renderKeyForNode(child);
    if (key && !keyedTargets.has(key)) keyedTargets.set(key, child);
  }

  const used = new Set();
  let cursor = target.firstChild;
  for (const sourceChild of sourceChildren) {
    const key = renderKeyForNode(sourceChild);
    let targetChild = key ? keyedTargets.get(key) : null;
    if (targetChild && used.has(targetChild)) targetChild = null;
    if (!targetChild && cursor && !renderKeyForNode(cursor) && canPatchNode(cursor, sourceChild)) {
      targetChild = cursor;
    }

    if (targetChild) {
      const patched = patchNode(targetChild, sourceChild);
      used.add(patched);
      if (patched !== cursor) target.insertBefore(patched, cursor);
      cursor = patched.nextSibling;
      continue;
    }

    const inserted = sourceChild.cloneNode(true);
    target.insertBefore(inserted, cursor);
    used.add(inserted);
  }

  for (const child of Array.from(target.childNodes)) {
    if (!used.has(child)) child.remove();
  }
}

function patchHtml(target, html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  patchChildNodes(target, template.content);
}

function updateConversationHtml(html, signature, options = {}) {
  const conversation = $("conversation");
  if (state.renderedConversationSignature === signature) {
    return false;
  }
  try {
    if (conversation.childNodes.length) patchHtml(conversation, html);
    else conversation.innerHTML = html;
  } catch (err) {
    console.warn("Conversation patch failed; falling back to full render.", err);
    conversation.innerHTML = html;
  }
  state.renderedConversationSignature = signature;
  if (options.stickToBottom) scrollConversationToBottom();
  return true;
}

function renderHome() {
  clearInterval(state.tickTimer);
  state.tickTimer = null;
  updateTurnTimer();
  const selectedLabel = state.selectedCwd ? shortPath(state.selectedCwd) : "Codex Mobile";
  $("threadTitle").textContent = selectedLabel || "Codex Mobile";
  $("threadMeta").textContent = state.selectedCwd || "Recent workspaces and threads";
  const workspaces = state.workspaces.slice()
    .sort((a, b) => Number(b.active) - Number(a.active)
      || Number(b.recentThreadCount || 0) - Number(a.recentThreadCount || 0)
      || String(a.label || a.cwd).localeCompare(String(b.label || b.cwd)))
    .slice(0, 8);
  const recentThreads = visibleThreads(state.threads).slice(0, 8);
  const nowMs = Date.now();
  const workspaceHtml = workspaces.length
    ? workspaces.map((ws) => {
      const active = ws.active ? "Active" : "Workspace";
      const count = Number(ws.recentThreadCount || 0);
      const countText = `${count.toLocaleString()} recent thread${count === 1 ? "" : "s"}`;
      const selected = normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd) ? " selected" : "";
      return `<button class="home-shortcut${selected}" type="button" data-home-workspace="${escapeHtml(ws.cwd)}">
        <span class="home-shortcut-title">${escapeHtml(ws.label || shortPath(ws.cwd) || ws.cwd)}</span>
        <span class="home-shortcut-meta">${escapeHtml(`${active} | ${countText} | ${ws.cwd}`)}</span>
      </button>`;
    }).join("")
    : `<div class="home-empty">No recent workspaces.</div>`;
  const threadHtml = recentThreads.length
    ? recentThreads.map((thread) => {
      const title = thread.name || thread.preview || thread.id;
      const sizeText = rolloutSizeText(thread);
      const sizeWarn = isRolloutOverThreshold(thread);
      const updatedTitle = formatAbsoluteTime(thread.updatedAt);
      const meta = [shortPath(thread.cwd), formatTime(thread.updatedAt, nowMs), sizeText ? `rollout ${sizeText}` : ""]
        .filter(Boolean)
        .join(" | ");
      return `<button class="home-shortcut${sizeWarn ? " rollout-warn" : ""}" type="button" data-home-thread="${escapeHtml(thread.id)}">
        <span class="home-shortcut-title">${escapeHtml(title)}</span>
        <span class="home-shortcut-meta home-shortcut-meta-status"><span title="${escapeHtml(updatedTitle)}">${escapeHtml(meta)}</span>${statusIconHtml(thread.status, "home-status-icon", thread.id)}</span>
      </button>`;
    }).join("")
    : `<div class="home-empty">No recent threads.</div>`;
  const html = `<div class="home-shortcuts">
    <section class="home-section">
      <div class="home-section-title">Workspaces</div>
      <div class="home-list">${workspaceHtml}</div>
    </section>
    <section class="home-section">
      <div class="home-section-title">Recent threads</div>
      <div class="home-list">${threadHtml}</div>
    </section>
  </div>`;
  const signature = JSON.stringify({
    view: "home",
    selectedCwd: state.selectedCwd,
    timeBucket: Math.floor(nowMs / 60000),
    workspaces: workspaces.map((ws) => [ws.cwd, ws.label, ws.active, ws.recentThreadCount]),
    threads: recentThreads.map((thread) => [
      thread.id,
      thread.name,
      thread.preview,
      thread.cwd,
      thread.updatedAt,
      statusText(thread.status),
      statusIconInfo(thread.status, thread.id)?.kind || "",
      state.unreadThreadIds.has(thread.id) ? 1 : 0,
      rolloutSizeBytes(thread),
      isRolloutOverThreshold(thread),
    ]),
  });
  if (!updateConversationHtml(html, signature)) return;
  $("conversation").querySelectorAll("[data-home-workspace]").forEach((button) => {
    button.addEventListener("click", () => selectWorkspaceShortcut(button.dataset.homeWorkspace).catch(showError));
  });
  $("conversation").querySelectorAll("[data-home-thread]").forEach((button) => {
    button.addEventListener("click", () => loadThread(button.dataset.homeThread).catch(showError));
  });
}

function renderThreadLoadError(err) {
  const list = $("threadList");
  list.innerHTML = `<div class="empty-state">
    <div>Thread list failed: ${escapeHtml(err.message || String(err))}</div>
    <button id="retryThreads" class="retry-button" type="button">Retry</button>
  </div>`;
  state.renderedThreadListSignature = `error|${err.message || String(err)}`;
  const retry = $("retryThreads");
  if (retry) retry.addEventListener("click", () => loadThreads().catch(showError));
}

function renderRolloutWarning(thread, previousKeys = new Set()) {
  if (!isRolloutOverThreshold(thread)) return "";
  const size = rolloutSizeText(thread);
  const threshold = formatFileSize(rolloutThresholdBytes(thread));
  const key = `rollout-warning|${thread.id || state.currentThreadId}|${rolloutSizeBytes(thread)}`;
  return `<div class="rollout-warning${entryAnimationClass(key, previousKeys)}" data-render-key="${escapeHtml(key)}">
    <div class="rollout-warning-text">
      <strong>上下文文件 ${escapeHtml(size)}</strong>
      <span>已达到 ${escapeHtml(threshold)} 阈值。建议压缩续接：创建带详细上下文的新线程后归档旧线程。</span>
    </div>
    <button class="rollout-new-thread" type="button" data-new-thread-from-current>压缩续接</button>
  </div>`;
}

function threadReadWarningMessage(thread) {
  const rawWarning = String(thread && thread.mobileReadWarning ? thread.mobileReadWarning : "");
  const mode = String(thread && thread.mobileReadMode ? thread.mobileReadMode : "");
  if (!rawWarning) return "";
  if (
    rawWarning.includes("shared app-server endpoint unavailable")
    || rawWarning.includes("app-server-mux/endpoint.json not found")
  ) {
    return "共享模式已经断开。手机端现在只能显示本地摘要，不能读取完整会话；请在 Mac 上重新运行共享启动脚本，然后刷新手机页面。";
  }
  if (mode === "summary-timeout-fallback") {
    return "线程详情读取超时，先显示本地摘要；稍后刷新会继续补全。";
  }
  if (mode === "summary-large-rollout-fallback") {
    return "这个会话上下文太大，手机端先显示本地摘要；建议压缩续接后再继续使用。";
  }
  return "线程详情暂时没有完整读到，先显示本地摘要；稍后刷新会继续补全。";
}

function renderCurrentThread(options = {}) {
  state.nowMs = Date.now();
  const thread = state.currentThread;
  if (!thread) {
    renderHome();
    return;
  }
  const shouldStickToBottom = options.stickToBottom === true || isConversationNearBottom();
  const previousKeys = existingConversationRenderKeys();
  cleanupLeavingItems();
  const titleEl = $("threadTitle");
  const metaEl = $("threadMeta");
  if (titleEl) titleEl.textContent = thread.name || thread.preview || thread.id;
  if (metaEl) metaEl.textContent = "";
  if (thread.mobileLoading) {
    updateConversationHtml(
      `<div class="empty-state entry-animate">Loading thread...</div>`,
      conversationRenderSignature(thread),
      { stickToBottom: shouldStickToBottom },
    );
    updateTickTimer();
    return;
  }
  if (thread.mobileLoadError) {
    updateConversationHtml(
      `<div class="empty-state entry-animate">
        <div>Thread failed: ${escapeHtml(thread.mobileLoadError)}</div>
        <button id="retryCurrentThread" class="retry-button" type="button">Retry</button>
      </div>`,
      conversationRenderSignature(thread),
      { stickToBottom: shouldStickToBottom },
    );
    const retry = $("retryCurrentThread");
    if (retry) retry.onclick = () => loadThread(thread.id || state.currentThreadId).catch(showError);
    updateTickTimer();
    return;
  }
  const turns = (thread.turns || []).slice(-MAX_VISIBLE_TURNS);
  const omitted = Number(thread.mobileOmittedTurnCount || 0) + Math.max(0, (thread.turns || []).length - turns.length);
  const omittedKey = `history|${state.currentThreadId}|${omitted}`;
  const omittedBanner = omitted > 0
    ? `<div class="history-note${entryAnimationClass(omittedKey, previousKeys)}" data-render-key="${escapeHtml(omittedKey)}">Older history hidden on mobile: ${omitted.toLocaleString()} turn(s)</div>`
    : "";
  const readWarningKey = `read-warning|${state.currentThreadId}|${thread.mobileReadMode || ""}|${thread.mobileReadWarning || ""}`;
  const readWarningMessage = threadReadWarningMessage(thread);
  const readWarning = readWarningMessage
    ? `<div class="history-note${entryAnimationClass(readWarningKey, previousKeys)}" data-render-key="${escapeHtml(readWarningKey)}">${escapeHtml(readWarningMessage)}</div>`
    : "";
  const rolloutWarning = renderRolloutWarning(thread, previousKeys);
  const visibleTurnIds = new Set(turns.map((turn) => turn && turn.id).filter(Boolean).map(String));
  const turnsHtml = turns.map((turn) => renderTurn(turn, previousKeys)).join("");
  const approvalsHtml = renderPendingApprovals(thread, previousKeys, (request) => {
    const turnId = approvalTurnId(request);
    if (turnId && visibleTurnIds.has(turnId)) return false;
    return isApprovalActive(request);
  });
  const emptyMessage = readWarningMessage
    ? "暂时没有可显示的完整消息。共享模式恢复后刷新这个页面即可继续读取。"
    : "No visible turns.";
  const html = rolloutWarning + omittedBanner + readWarning + (turnsHtml || approvalsHtml ? `${turnsHtml}${approvalsHtml}` : `<div class="empty-state entry-animate">${escapeHtml(emptyMessage)}</div>`);
  updateConversationHtml(html, conversationRenderSignature(thread), { stickToBottom: shouldStickToBottom });
  bindCurrentThreadActions();
  updateTickTimer();
}

function bindCurrentThreadActions() {
  const button = $("conversation").querySelector("[data-new-thread-from-current]");
  if (button) button.addEventListener("click", startNewThreadFromCurrent);
}

function startThreadRequestBody(sourceThread = null, options = {}) {
  const thread = sourceThread || state.currentThread || {};
  const useCurrentSelectors = !sourceThread || thread.id === state.currentThreadId;
  return {
    cwd: thread.cwd || state.selectedCwd || "",
    model: useCurrentSelectors ? ($("modelSelect").value || effectiveDefaultModel() || "") : (thread.model || state.defaultModel || ""),
    effort: useCurrentSelectors ? ($("effortSelect").value || effectiveDefaultEffort() || "") : (thread.effort || state.defaultReasoningEffort || ""),
    permissionMode: useCurrentSelectors ? ($("permissionSelect").value || effectiveDefaultPermissionMode() || "") : "",
    sourceThreadId: thread.id || "",
    sourceThreadTitle: thread.name || thread.preview || thread.id || "",
    archiveSourceThread: Boolean(options.archiveSourceThread && thread.id),
  };
}

function actionWidthForThreadRow(row) {
  const action = row && row.querySelector(".thread-row-actions");
  return Math.max(72, Math.round(action ? action.getBoundingClientRect().width : 86));
}

function threadSwipeTargetRow(target) {
  if (!target || !target.closest) return null;
  if (target.closest("[data-new-thread-from-thread]")) return null;
  return target.closest("[data-thread-row]");
}

function releaseThreadSwipeCapture(swipe) {
  if (!swipe || !swipe.row || swipe.pointerId == null) return;
  try {
    if (swipe.row.hasPointerCapture && swipe.row.hasPointerCapture(swipe.pointerId)) {
      swipe.row.releasePointerCapture(swipe.pointerId);
    }
  } catch (_) {
    // Pointer capture release is best-effort across mobile browsers.
  }
}

function beginThreadSwipeAt(target, startX, startY, options = {}) {
  const row = threadSwipeTargetRow(target);
  if (!row) return;
  state.threadSwipe = {
    row,
    threadId: row.dataset.threadRow || "",
    startX: Number(startX || 0),
    startY: Number(startY || 0),
    currentX: Number(startX || 0),
    moved: false,
    wasOpen: row.classList.contains("swipe-open"),
    actionWidth: actionWidthForThreadRow(row),
    pointerId: options.pointerId,
    source: options.source || "pointer",
  };
  try {
    if (row.setPointerCapture && options.pointerId != null) row.setPointerCapture(options.pointerId);
  } catch (_) {
    // Pointer capture is a stability optimization, not required.
  }
}

function beginThreadSwipe(event) {
  if (event.pointerType === "touch") return;
  if (event.button != null && event.button !== 0) return;
  beginThreadSwipeAt(event.target, event.clientX, event.clientY, {
    pointerId: event.pointerId,
    source: "pointer",
  });
}

function moveThreadSwipeTo(xValue, yValue, event) {
  const swipe = state.threadSwipe;
  if (!swipe || !swipe.row) return;
  const x = Number(xValue || 0);
  const y = Number(yValue || 0);
  const dx = x - swipe.startX;
  const dy = y - swipe.startY;
  if (!swipe.moved && Math.abs(dx) < 10) return;
  if (!swipe.moved && Math.abs(dy) > Math.abs(dx)) {
    releaseThreadSwipeCapture(swipe);
    state.threadSwipe = null;
    return;
  }
  swipe.moved = true;
  swipe.currentX = x;
  if (event && event.cancelable !== false) event.preventDefault();
  const base = swipe.wasOpen ? -swipe.actionWidth : 0;
  const offset = Math.max(-swipe.actionWidth, Math.min(0, base + dx));
  swipe.row.style.setProperty("--thread-swipe-x", `${Math.round(offset)}px`);
  swipe.row.classList.add("swiping");
}

function moveThreadSwipe(event) {
  const swipe = state.threadSwipe;
  if (swipe && swipe.source === "touch") return;
  moveThreadSwipeTo(event.clientX, event.clientY, event);
}

function finishThreadSwipe() {
  const swipe = state.threadSwipe;
  state.threadSwipe = null;
  if (!swipe || !swipe.row) return;
  releaseThreadSwipeCapture(swipe);
  swipe.row.classList.remove("swiping");
  const dx = Number(swipe.currentX || swipe.startX) - swipe.startX;
  if (!swipe.moved) return;
  const openThreshold = Math.min(28, swipe.actionWidth * 0.32);
  const shouldOpen = swipe.wasOpen
    ? dx > 32 ? false : true
    : dx < -openThreshold;
  state.suppressThreadClickUntil = Date.now() + 1200;
  state.suppressThreadClickThreadId = swipe.threadId;
  setThreadActionOpen(swipe.threadId, shouldOpen);
}

function endThreadSwipe() {
  const swipe = state.threadSwipe;
  if (swipe && swipe.source === "touch") return;
  finishThreadSwipe();
}

function cancelThreadSwipe() {
  const swipe = state.threadSwipe;
  if (swipe && swipe.source === "touch") return;
  finishThreadSwipe();
}

function primaryTouch(event) {
  return (event.touches && event.touches[0])
    || (event.changedTouches && event.changedTouches[0])
    || null;
}

function beginThreadSwipeTouch(event) {
  if (event.touches && event.touches.length > 1) return;
  const touch = primaryTouch(event);
  if (!touch) return;
  beginThreadSwipeAt(event.target, touch.clientX, touch.clientY, { source: "touch" });
}

function moveThreadSwipeTouch(event) {
  const swipe = state.threadSwipe;
  if (!swipe || swipe.source !== "touch") return;
  const touch = primaryTouch(event);
  if (!touch) return;
  moveThreadSwipeTo(touch.clientX, touch.clientY, event);
}

function endThreadSwipeTouch() {
  const swipe = state.threadSwipe;
  if (!swipe || swipe.source !== "touch") return;
  finishThreadSwipe();
}

function startedThreadId(result) {
  return String((result && result.threadId)
    || (result && result.thread && result.thread.id)
    || (result && result.result && result.result.thread && result.result.thread.id)
    || (result && result.result && result.result.threadId)
    || "");
}

function continuationJobStatusText(job) {
  const status = String(job && job.status || "");
  const message = String(job && job.message || "").trim();
  if (message) return message;
  return {
    queued: "续接任务已排队",
    running: "正在生成交接并续接",
    done: "续接线程已就绪",
    failed: "续接任务失败",
  }[status] || "正在生成交接并续接";
}

function rememberContinuationJob(jobId) {
  const id = String(jobId || "").trim();
  if (!id) return;
  state.continuationJobId = id;
  localStorage.setItem(STORAGE_CONTINUATION_JOB, id);
}

function clearRememberedContinuationJob(jobId = "") {
  const id = String(jobId || "").trim();
  if (!id || localStorage.getItem(STORAGE_CONTINUATION_JOB) === id) {
    localStorage.removeItem(STORAGE_CONTINUATION_JOB);
  }
  if (!id || state.continuationJobId === id) state.continuationJobId = "";
}

async function openContinuationResult(result) {
  const threadId = startedThreadId(result);
  if (!threadId) throw new Error("Continuation thread was created without a thread id");
  state.continuationNewThreadId = threadId;
  const archivedSourceThreadId = result.sourceArchive && result.sourceArchive.archived
    ? result.sourceArchive.threadId
    : "";
  if (archivedSourceThreadId) {
    state.threads = state.threads.filter((entry) => entry.id !== archivedSourceThreadId);
  }
  if (result.thread) {
    state.threads = [result.thread, ...state.threads.filter((thread) => thread.id !== result.thread.id)];
    renderThreads();
  }
  $("connectionState").classList.remove("error");
  if (result.sourceArchive && result.sourceArchive.error) {
    $("connectionState").classList.add("error");
    $("connectionState").textContent = `续接线程已就绪；归档失败：${result.sourceArchive.error}`;
  } else {
    $("connectionState").textContent = "交接已生成；正在打开续接线程";
  }
  await loadThread(threadId);
  loadThreads().catch(showError);
}

async function waitForContinuationJob(jobId) {
  const id = String(jobId || "").trim();
  if (!id) throw new Error("Continuation job was created without a job id");
  rememberContinuationJob(id);
  let delayMs = 800;
  while (state.continuationJobId === id) {
    const job = await api(`/api/thread-continuations/${encodeURIComponent(id)}`, {
      timeoutMs: 30000,
    });
    $("connectionState").classList.toggle("error", job.status === "failed");
    $("connectionState").textContent = continuationJobStatusText(job);
    markActivity(job.step || "续接任务");
    if (job.status === "done") {
      clearRememberedContinuationJob(id);
      return job.result || job;
    }
    if (job.status === "failed") {
      clearRememberedContinuationJob(id);
      throw new Error(job.error || job.message || "Continuation job failed");
    }
    await sleep(delayMs);
    delayMs = Math.min(1800, Math.round(delayMs * 1.25));
  }
  throw new Error("Continuation job was cancelled");
}

async function resumeRememberedContinuationJob() {
  const jobId = String(localStorage.getItem(STORAGE_CONTINUATION_JOB) || "").trim();
  if (!jobId || state.continuationBusy) return;
  state.continuationBusy = true;
  state.continuationJobId = jobId;
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "正在恢复续接任务";
  try {
    const result = await waitForContinuationJob(jobId);
    await openContinuationResult(result);
  } catch (err) {
    clearRememberedContinuationJob(jobId);
    if (!/Continuation job not found/i.test(err.message || "")) showError(err);
  } finally {
    state.continuationBusy = false;
  }
}

async function startNewThreadFromThread(sourceThread, event) {
  if (event) event.preventDefault();
  if (event) event.stopPropagation();
  closeThreadActions();
  if (state.continuationBusy) return;
  const button = event && event.currentTarget;
  const thread = sourceThread || state.currentThread || {};
  const sourceThreadId = thread.id || state.currentThreadId || "";
  const title = thread.name || thread.preview || thread.id || "current thread";
  const size = rolloutSizeText(thread);
  const archiveConfirmed = window.confirm([
    `压缩续接“${title}”？`,
    "",
    "会创建一个同工作区的新 session。",
    "成功后自动归档旧 session。",
    size ? `当前大小：${size}` : "",
  ].filter((line) => line !== "").join("\n"));
  if (!archiveConfirmed) return;
  const body = startThreadRequestBody(thread, { archiveSourceThread: true });
  if (!body.cwd) {
    showError(new Error("Thread has no workspace path"));
    return;
  }
  if (sourceThreadId) {
    state.continuationSourceThreadId = sourceThreadId;
    state.continuationNewThreadId = "";
    clearRememberedContinuationJob();
  }
  state.continuationBusy = true;
  if (button) button.disabled = true;
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "正在创建续接任务";
  markActivity("创建续接任务");
  try {
    const job = await api("/api/thread-continuations", {
      method: "POST",
      body: JSON.stringify(body),
      timeoutMs: 30000,
    });
    $("connectionState").textContent = continuationJobStatusText(job);
    const result = await waitForContinuationJob(job.jobId);
    await openContinuationResult(result);
  } catch (err) {
    showError(err);
  } finally {
    clearRememberedContinuationJob();
    state.continuationBusy = false;
    if (button) button.disabled = false;
  }
}

async function startNewThreadFromCurrent(event) {
  await startNewThreadFromThread(state.currentThread, event);
}

async function startNewThreadFromList(event) {
  if (event) event.stopPropagation();
  const threadId = event.currentTarget && event.currentTarget.dataset.newThreadFromThread;
  const thread = state.threads.find((entry) => entry.id === threadId);
  if (!thread) {
    showError(new Error("Thread is no longer in the current list"));
    return;
  }
  await startNewThreadFromThread(thread, event);
}

function approvalTitle(method) {
  const titles = {
    "item/commandExecution/requestApproval": "命令需要批准",
    "execCommandApproval": "命令需要批准",
    "item/fileChange/requestApproval": "文件改动需要批准",
    "applyPatchApproval": "文件改动需要批准",
    "item/permissions/requestApproval": "权限需要批准",
    "item/tool/requestUserInput": "需要你补充信息",
    "mcpServer/elicitation/request": "MCP 需要输入",
    "item/tool/call": "工具请求",
    "account/chatgptAuthTokens/refresh": "账号授权",
  };
  return titles[method] || "待处理请求";
}

function approvalStatusLabel(status) {
  const text = String(status || "waiting");
  if (text === "waiting") return "等待中";
  if (text === "responding") return "发送中";
  if (text === "responded" || text === "resolved") return "已处理";
  if (text === "connectionClosed") return "已关闭";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function permissionSummary(permissions) {
  if (!permissions || typeof permissions !== "object") return "";
  const parts = [];
  if (permissions.network) parts.push(`Network: ${JSON.stringify(permissions.network)}`);
  if (permissions.fileSystem) parts.push(`File system: ${JSON.stringify(permissions.fileSystem)}`);
  return parts.join("\n");
}

function approvalDetailLines(request) {
  const params = request.params || {};
  const questions = Array.isArray(params.questions) ? params.questions : [];
  return [
    params.reason ? `原因: ${params.reason}` : "",
    params.command ? `命令:\n${params.command}` : "",
    params.cwd ? `工作目录:\n${params.cwd}` : "",
    params.grantRoot ? `授权目录:\n${params.grantRoot}` : "",
    Array.isArray(params.fileNames) && params.fileNames.length ? `文件:\n${params.fileNames.join("\n")}` : "",
    params.permissions ? `权限:\n${permissionSummary(params.permissions) || JSON.stringify(params.permissions, null, 2)}` : "",
    params.networkApprovalContext ? `网络:\n${JSON.stringify(params.networkApprovalContext, null, 2)}` : "",
    questions.length ? questions.map((question, index) => {
      const lines = [
        question.header ? `${question.header}` : `问题 ${index + 1}`,
        question.question || "",
        Array.isArray(question.options) && question.options.length
          ? question.options.map((option) => `- ${option.label}${option.description ? `: ${option.description}` : ""}`).join("\n")
          : "",
      ].filter(Boolean);
      return lines.join("\n");
    }).join("\n\n") : "",
    params.title ? `标题:\n${params.title}` : "",
    params.message ? `说明:\n${params.message}` : "",
    params.schema ? `结构:\n${JSON.stringify(params.schema, null, 2)}` : "",
    params.elicitation ? `请求:\n${JSON.stringify(params.elicitation, null, 2)}` : "",
  ].filter(Boolean);
}

function isUserInputRequest(request) {
  return USER_INPUT_REQUEST_METHODS.has(request && request.method);
}

function renderUserInputOptions(request) {
  const params = request.params || {};
  const questions = Array.isArray(params.questions) ? params.questions : [];
  const question = questions.find((entry) => Array.isArray(entry.options) && entry.options.length) || questions[0] || null;
  if (!question || !Array.isArray(question.options) || !question.options.length) return "";
  return `<div class="approval-option-grid">
    ${question.options.map((option) => `<button class="approval-option" type="button" data-server-request-id="${escapeHtml(request.id)}" data-server-question-id="${escapeHtml(question.id || "answer")}" data-server-response-text="${escapeHtml(option.label || "")}">
      <span>${escapeHtml(option.label || "选项")}</span>
      ${option.description ? `<small>${escapeHtml(option.description)}</small>` : ""}
    </button>`).join("")}
  </div>`;
}

function renderUserInputActions(request) {
  const params = request.params || {};
  const questions = Array.isArray(params.questions) ? params.questions : [];
  const question = questions[0] || {};
  return `<form class="approval-response-form" data-server-request-form data-server-request-id="${escapeHtml(request.id)}" data-server-question-id="${escapeHtml(question.id || "answer")}">
    ${renderUserInputOptions(request)}
    <textarea class="approval-response-input" name="responseText" rows="3" placeholder="输入回复内容"></textarea>
    <div class="approval-actions request-actions">
      <button class="approval-button allow" type="submit">提交</button>
      <button class="approval-button deny" type="button" data-server-request-id="${escapeHtml(request.id)}" data-server-request-decline>取消</button>
    </div>
  </form>`;
}

function renderApprovalActions(request) {
  const waiting = request.status === "waiting";
  if (!request.actionable || !waiting) {
    return "";
  }
  if (isUserInputRequest(request)) return renderUserInputActions(request);
  return `<div class="approval-actions">
    <button class="approval-button allow" type="button" data-approval-id="${escapeHtml(request.id)}" data-approval-action="allow_once">允许一次</button>
    <button class="approval-button allow" type="button" data-approval-id="${escapeHtml(request.id)}" data-approval-action="allow_session">本会话允许</button>
    <button class="approval-button deny" type="button" data-approval-id="${escapeHtml(request.id)}" data-approval-action="deny">拒绝</button>
  </div>`;
}

function renderApprovalRequest(request, previousKeys = new Set()) {
  const key = `approval|${request.id}`;
  const status = String(request.status || "waiting");
  if (isApprovalSettled(request)) {
    return `<section class="approval-card compact${entryAnimationClass(key, previousKeys)} ${escapeHtml(status)}" data-render-key="${escapeHtml(key)}" data-approval-card="${escapeHtml(request.id)}">
      <div class="approval-line">
        <span>${escapeHtml(approvalTitle(request.method))}</span>
        <span>${escapeHtml(approvalStatusLabel(request.status))}</span>
      </div>
    </section>`;
  }
  const detail = approvalDetailLines(request).join("\n");
  return `<section class="approval-card${entryAnimationClass(key, previousKeys)} ${escapeHtml(status)}" data-render-key="${escapeHtml(key)}" data-approval-card="${escapeHtml(request.id)}">
    <div class="approval-head">
      <div>
        <div class="approval-title">${escapeHtml(approvalTitle(request.method))}</div>
        <div class="approval-method">${escapeHtml(request.method)}</div>
      </div>
      <span class="approval-status">${escapeHtml(approvalStatusLabel(request.status))}</span>
    </div>
    ${detail ? `<pre class="approval-detail">${escapeHtml(detail)}</pre>` : ""}
    ${renderApprovalActions(request)}
  </section>`;
}

function renderPendingApprovals(thread, previousKeys = new Set(), filter = null) {
  const threadId = thread && (thread.id || state.currentThreadId);
  const requests = pendingApprovalsForThread(threadId)
    .filter((request) => !filter || filter(request));
  if (!requests.length) return "";
  return `<div class="approval-stack">
    ${requests.map((request) => renderApprovalRequest(request, previousKeys)).join("")}
  </div>`;
}

function renderTurn(turn, previousKeys = new Set()) {
  const renderedItems = visibleItemsForTurn(turn).map((entry, index) => {
    const item = entry.item;
    const sourceIndex = Number.isInteger(entry.sourceIndex) && entry.sourceIndex >= 0 ? entry.sourceIndex : index;
    let html = "";
    if (isContextCompactionItem(item)) html = renderContextCompaction(item, turn, previousKeys, sourceIndex);
    else if (isOperationalItem(item)) html = renderLiveOperation(item, turn, previousKeys, sourceIndex);
    else if (item.type === "reasoning" && isLiveTurn(turn)) html = "";
    else html = renderItem(item, turn, previousKeys, sourceIndex);
    return { html, sourceIndex, order: 1 };
  }).filter((entry) => entry && entry.html);
  const items = renderedItems
    .concat(leavingItemsForTurn(turn))
    .sort((a, b) => (a.sourceIndex - b.sourceIndex) || (a.order - b.order))
    .map((entry) => entry.html)
    .join("");
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  const turnApprovals = approvalsForTurn(threadId, turn.id);
  const approvalsHtml = turnApprovals.length
    ? `<div class="approval-stack in-turn">${turnApprovals.map((request) => renderApprovalRequest(request, previousKeys)).join("")}</div>`
    : "";
  if (!items.trim() && !approvalsHtml.trim()) return "";
  const turnKey = stableTurnKey(turn);
  const statusKey = stableTurnKey(turn, "status");
  const duration = turn.durationMs ? ` | ${formatElapsedTime(Math.round(turn.durationMs / 1000))}` : "";
  const timerShowsStatus = isLatestTurn(turn) && (isLiveTurn(turn) || turnFinalSeconds(turn) != null);
  const showStatusLine = !timerShowsStatus;
  return `<article class="turn" data-turn="${escapeHtml(turn.id)}" data-render-key="${escapeHtml(turnKey)}">
    ${items}${approvalsHtml}
    ${showStatusLine ? `<div class="turn-status${entryAnimationClass(statusKey, previousKeys)}" data-render-key="${escapeHtml(statusKey)}">${escapeHtml(displayTurnStatus(turn))}${duration}</div>` : ""}
  </article>`;
}

function renderLiveOperation(item, turn, previousKeys = new Set(), index = 0) {
  const operation = latestVisibleOperationItem(turn);
  if (!operation || operation.item !== item) return "";
  const lines = operationSummaryLines(item);
  const body = lines.length ? `<div class="operation-body">${escapeHtml(lines.join("\n"))}</div>` : "";
  const status = statusText(item.status) || (item.completedAtMs ? "completed" : "running");
  const title = operationTitle(item, status);
  const key = stableTurnKey(turn, "live-operation");
  return `<section class="item live-operation ${isCompletedStatus(status) ? "completed" : ""} ${escapeHtml(item.type || "item")}" data-item="${escapeHtml(item.id || "")}" data-render-key="${escapeHtml(key)}">
    <div class="item-head"><span>${escapeHtml(title)}</span><span>${escapeHtml(status)}</span></div>
    ${body}
  </section>`;
}

function operationTitle(item, status) {
  const label = labelForItem(item);
  if (isCompletedStatus(status)) return `${label} Completed`;
  return label;
}

function truncateSingleLine(value, maxChars = 96) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1))}...`;
}

function operationFileNames(item) {
  const values = Array.isArray(item.fileNames) && item.fileNames.length
    ? item.fileNames
    : collectFileNames(item.changes || item.arguments || item.result || item.contentItems);
  return [...new Set(values.map((name) => truncateSingleLine(shortPath(name), 72)).filter(Boolean))].slice(0, 5);
}

function collectSearchSummaries(value, out = [], keyHint = "") {
  if (out.length >= 3 || value == null) return out;
  const keyLooksSearch = /^(q|query|searchQuery|url|pattern)$/i.test(keyHint);
  const keyLooksQueryList = /^queries$/i.test(keyHint);
  if (typeof value === "string") {
    const text = value.replace(/\s+/g, " ").trim();
    if ((keyLooksSearch || keyLooksQueryList) && text) out.push(text);
    return out;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectSearchSummaries(entry, out, keyLooksQueryList ? "query" : keyHint);
      if (out.length >= 3) return out;
    }
    return out;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      collectSearchSummaries(entry, out, key);
      if (out.length >= 3) return out;
    }
  }
  return out;
}

function operationSearchSummary(item) {
  return [...new Set(collectSearchSummaries(item && (item.action || item.arguments || item.result || item.contentItems || item)))]
    .slice(0, 3)
    .join(" | ");
}

function operationSummaryLines(item) {
  if (item.type === "fileChange") {
    const names = operationFileNames(item);
    return names.length ? [names.join(", ")] : [];
  }
  if (item.command) return [truncateMiddle(item.command, 180, "command")];
  const searchSummary = isWebSearchLikeItem(item) ? operationSearchSummary(item) : "";
  if (searchSummary) return [truncateMiddle(searchSummary, 180, "search")];
  const names = operationFileNames(item);
  if (names.length) return [names.join(", ")];
  if (item.tool) return [item.tool];
  return [];
}

function displayTurnStatus(turn) {
  if (isIncompleteInterruptedTurn(turn)) return "syncing";
  return statusText(turn.status);
}

function renderContextCompaction(item, turn = null, previousKeys = new Set(), index = 0) {
  const key = stableItemKey(turn, item, index, "context");
  return `<div class="context-compaction-note${entryAnimationClass(key, previousKeys)}" data-item="${escapeHtml(item.id || "")}" data-render-key="${escapeHtml(key)}">${escapeHtml(contextCompactionNotice(item, turn))}</div>`;
}

function renderItem(item, turn = null, previousKeys = new Set(), index = 0) {
  if (isContextCompactionItem(item)) return renderContextCompaction(item, turn, previousKeys, index);
  if (isLiveReasoning(item, turn)) return "";
  const type = item.type || "item";
  const key = stableItemKey(turn, item, index);
  return `<section class="item${entryAnimationClass(key, previousKeys)} ${escapeHtml(type)}" data-item="${escapeHtml(item.id || "")}" data-render-key="${escapeHtml(key)}">
    <div class="item-head"><span>${escapeHtml(labelForItem(item))}</span><span>${escapeHtml(item.status ? statusText(item.status) : "")}</span></div>
    <div class="item-body">${renderItemBody(item, turn)}</div>
  </section>`;
}

function renderLiveReasoning(item, turn) {
  const elapsed = liveReasoningElapsed(item, turn);
  return `<section class="item live-reasoning reasoning" data-item="${escapeHtml(item.id || "")}">
    <div class="item-head"><span>Reasoning</span><span>${elapsed}s</span></div>
  </section>`;
}

function labelForItem(item) {
  if (isWebSearchLikeItem(item)) return "Web Search";
  const map = {
    userMessage: "You",
    agentMessage: "Codex",
    reasoning: "Reasoning",
    commandExecution: "Command",
    fileChange: "File Change",
    mcpToolCall: `MCP ${item.server || ""}.${item.tool || ""}`,
    dynamicToolCall: `${item.namespace ? item.namespace + "." : ""}${item.tool || "Tool"}`,
    plan: "Plan",
    contextCompaction: "Context",
  };
  return map[item.type] || item.type || "Item";
}

function isInputImagePart(part) {
  if (!part || typeof part !== "object") return false;
  const type = String(part.type || "");
  const url = String(part.url || part.image_url || "");
  if (isTruncatedImagePayloadPart(part)) return true;
  return type === "image" || type === "localImage" || /^data:image\//i.test(url);
}

function isTruncatedImagePayloadPart(part) {
  if (!part || typeof part !== "object" || !part.truncated) return false;
  const preview = String(part.preview || "");
  return /data:image\//i.test(preview) || /"type"\s*:\s*"image"/i.test(preview);
}

function splitAttachmentSummaryText(text) {
  const source = String(text || "");
  const marker = "Uploaded attachments:\n";
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return { text: source, attachments: [] };
  const before = source.slice(0, markerIndex).trimEnd();
  const lines = source.slice(markerIndex + marker.length)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return { text: before, attachments: lines.map(parseAttachmentLine).filter(Boolean) };
}

function parseAttachmentLine(line) {
  const match = /^-\s*(.*?)\s*\((.*?)\):\s*(.+)$/.exec(String(line || ""));
  if (!match) return null;
  const meta = match[2] || "";
  return {
    name: match[1] || "attachment",
    meta,
    path: match[3] || "",
    isImage: /\bimage\b/i.test(meta),
  };
}

function uploadFileUrl(filePath) {
  const params = new URLSearchParams({ path: filePath });
  if (state.key) params.set("key", state.key);
  return `/api/uploads/file?${params.toString()}`;
}

function imageSourceForPart(part, attachment = null) {
  if (attachment && attachment.path) return uploadFileUrl(attachment.path);
  if (part.path) return uploadFileUrl(part.path);
  const url = String(part.url || part.image_url || "");
  return url || "";
}

function renderInputText(text) {
  if (!String(text || "").trim()) return "";
  return `<div class="input-text">${escapeHtml(text)}</div>`;
}

function renderInputImage(part, attachment = null, index = 0) {
  const src = imageSourceForPart(part, attachment);
  const label = (attachment && attachment.name) || shortPath(part.path || part.url || "") || `Image ${index + 1}`;
  if (!src) return `<div class="input-attachment">${escapeHtml(label)}</div>`;
  return `<figure class="input-image">
    <img src="${escapeHtml(src)}" alt="${escapeHtml(label)}" loading="lazy">
    <figcaption>${escapeHtml(label)}</figcaption>
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

function renderInputContent(content) {
  const parts = content || [];
  const imageParts = parts.filter(isInputImagePart);
  const attachments = [];
  const html = [];
  for (const part of parts) {
    if (!part || isInputImagePart(part)) continue;
    if (part.type === "text") {
      const split = splitAttachmentSummaryText(part.text || "");
      if (split.text) html.push(renderInputText(split.text));
      attachments.push(...split.attachments);
      continue;
    }
    html.push(`<div class="input-text">${escapeHtml(compactStructuredForSignature(part))}</div>`);
  }
  const imageAttachments = attachments.filter((attachment) => attachment.isImage);
  imageParts.forEach((part, index) => {
    html.push(renderInputImage(part, imageAttachments[index] || null, index));
  });
  attachments
    .filter((attachment) => !attachment.isImage || !imageParts.length)
    .forEach((attachment) => html.push(renderInputAttachment(attachment)));
  return html.join("");
}

function isMarkdownTableSeparator(line) {
  const cells = String(line || "").trim().replace(/^\||\|$/g, "").split("|");
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitMarkdownTableRow(line) {
  return String(line || "")
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isMarkdownBlockStart(line, nextLine = "") {
  return /^```/.test(line)
    || /^(#{1,6})\s+\S/.test(line)
    || /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)
    || /^>\s?/.test(line)
    || /^\s*[-*+]\s+\S/.test(line)
    || /^\s*\d+[.)]\s+\S/.test(line)
    || (line.includes("|") && isMarkdownTableSeparator(nextLine));
}

function safeMarkdownUrl(value) {
  const url = String(value || "").trim();
  if (/^(https?:|mailto:)/i.test(url)) return url;
  return "";
}

function renderInlineMarkdown(value) {
  const placeholders = [];
  const tokenPrefix = "MDTOKEN";
  let text = String(value || "").replace(/`([^`\n]+)`/g, (_match, code) => {
    const token = `${tokenPrefix}${placeholders.length}END`;
    placeholders.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  text = escapeHtml(text);
  text = text.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
    const safeUrl = safeMarkdownUrl(url.replaceAll("&amp;", "&"));
    if (!safeUrl) return match;
    return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${label}</a>`;
  });
  text = text
    .replace(/\*\*([^*\n][^*\n]*?)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n][^_\n]*?)__/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n][^*\n]*?)\*/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\n][^_\n]*?)_/g, "$1<em>$2</em>");

  placeholders.forEach((html, index) => {
    text = text.replaceAll(`${tokenPrefix}${index}END`, html);
  });
  return text;
}

function renderMarkdownTable(lines) {
  const header = splitMarkdownTableRow(lines[0]);
  const rows = lines.slice(2).map(splitMarkdownTableRow);
  return `<div class="markdown-table-wrap"><table>
    <thead><tr>${header.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${header.map((_cell, index) => `<td>${renderInlineMarkdown(row[index] || "")}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}

function renderMarkdownList(lines, ordered) {
  const tag = ordered ? "ol" : "ul";
  const itemPattern = ordered ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/;
  const items = lines.map((line) => {
    const match = itemPattern.exec(line);
    const text = match ? match[1] : line.trim();
    return `<li>${renderInlineMarkdown(text)}</li>`;
  });
  return `<${tag}>${items.join("")}</${tag}>`;
}

function renderMarkdown(value) {
  const source = String(value || "");
  if (!source.trim()) return "";
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const fence = /^```([A-Za-z0-9_.+-]*)\s*$/.exec(line);
    if (fence) {
      const lang = fence[1] || "";
      const code = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      const langLabel = lang ? `<div class="markdown-code-lang">${escapeHtml(lang)}</div>` : "";
      blocks.push(`<div class="markdown-code-block">${langLabel}<pre><code>${escapeHtml(code.join("\n"))}</code></pre></div>`);
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = Math.min(6, heading[1].length + 1);
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      blocks.push("<hr>");
      i += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(`<blockquote>${renderMarkdown(quote.join("\n"))}</blockquote>`);
      continue;
    }

    if (line.includes("|") && isMarkdownTableSeparator(lines[i + 1])) {
      const tableLines = [line, lines[i + 1]];
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        tableLines.push(lines[i]);
        i += 1;
      }
      blocks.push(renderMarkdownTable(tableLines));
      continue;
    }

    if (/^\s*[-*+]\s+\S/.test(line)) {
      const list = [];
      while (i < lines.length && /^\s*[-*+]\s+\S/.test(lines[i])) {
        list.push(lines[i]);
        i += 1;
      }
      blocks.push(renderMarkdownList(list, false));
      continue;
    }

    if (/^\s*\d+[.)]\s+\S/.test(line)) {
      const list = [];
      while (i < lines.length && /^\s*\d+[.)]\s+\S/.test(lines[i])) {
        list.push(lines[i]);
        i += 1;
      }
      blocks.push(renderMarkdownList(list, true));
      continue;
    }

    const paragraph = [line.trim()];
    i += 1;
    while (i < lines.length && lines[i].trim() && !isMarkdownBlockStart(lines[i], lines[i + 1] || "")) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push(`<p>${paragraph.map(renderInlineMarkdown).join("<br>")}</p>`);
  }

  return `<div class="markdown-body">${blocks.join("")}</div>`;
}

function renderItemBody(item, turn = null) {
  if (isContextCompactionItem(item)) return escapeHtml(contextCompactionNotice(item, turn));
  if (item.type === "userMessage") return renderInputContent(item.content);
  if (item.type === "agentMessage") {
    return isLiveTurn(turn) ? escapeHtml(item.text || "") : renderMarkdown(item.text || "");
  }
  if (item.type === "reasoning") {
    const summary = (item.summary || []).join("\n");
    const content = (item.content || []).join("\n");
    return escapeHtml([summary, content].filter(Boolean).join("\n\n"));
  }
  if (item.type === "plan") return renderMarkdown(item.text || "");
  if (item.type === "commandExecution") {
    return `<div class="mono">${escapeHtml(item.command || "")}</div>${renderOutputBlock(item.aggregatedOutput, item)}`;
  }
  if (item.type === "fileChange") {
    return renderStructuredBlock(item.changes || [], `${Array.isArray(item.changes) ? item.changes.length : 0} change(s)`);
  }
  if (item.type === "dynamicToolCall" || item.type === "mcpToolCall") {
    return `<div class="mono">${escapeHtml(JSON.stringify(item.arguments || {}, null, 2))}</div>${renderStructuredBlock(item.result || item.contentItems, "Tool result")}`;
  }
  return escapeHtml(JSON.stringify(item, null, 2));
}

function renderOutputBlock(output, item = {}) {
  if (!output && item.outputOmitted) {
    const total = item.outputTotalChars || 0;
    return `<details class="output-details">
      <summary>${escapeHtml(`Output omitted from mobile view: ${Number(total).toLocaleString()} chars`)}</summary>
      <pre>${escapeHtml("This command output is still in the Codex session history. It is omitted here to keep the mobile client responsive.")}</pre>
    </details>`;
  }
  if (!output) return "";
  const total = item.outputTotalChars || String(output).length;
  const truncated = item.outputTruncated || total > String(output).length;
  const summary = truncated
    ? `Output preview: ${total.toLocaleString()} chars total, showing latest ${String(output).length.toLocaleString()}`
    : `Output: ${String(output).length.toLocaleString()} chars`;
  return `<details class="output-details">
    <summary>${escapeHtml(summary)}</summary>
    <pre>${escapeHtml(output)}</pre>
  </details>`;
}

function renderStructuredBlock(value, label) {
  if (!value) return "";
  if (value.truncated && value.preview) {
    return `<details class="output-details">
      <summary>${escapeHtml(`${label}: ${Number(value.totalChars || 0).toLocaleString()} chars total, preview`)}</summary>
      <pre>${escapeHtml(value.preview)}</pre>
    </details>`;
  }
  const raw = JSON.stringify(value, null, 2);
  if (!raw || raw === "null") return "";
  return `<details class="output-details">
    <summary>${escapeHtml(`${label}: ${raw.length.toLocaleString()} chars`)}</summary>
    <pre>${escapeHtml(raw)}</pre>
  </details>`;
}

function ensureTurn(turnId) {
  const thread = state.currentThread;
  if (!thread) return null;
  thread.turns = thread.turns || [];
  let turn = thread.turns.find((x) => x.id === turnId);
  if (!turn) {
    turn = { id: turnId, items: [], status: { type: "running" }, error: null, startedAt: Math.floor(Date.now() / 1000), completedAt: null, durationMs: null };
    thread.turns.push(turn);
  }
  return turn;
}

function upsertItem(turnId, item) {
  const turn = ensureTurn(turnId);
  if (!turn || !item || !item.id) return;
  markActivity(activityLabelForItem(item));
  if (isReasoningItem(item)) {
    updateTickTimer();
    return;
  }
  turn.items = turn.items || [];
  if (item.type === "userMessage") {
    const matchingExisting = turn.items.find((existing) => existing
      && existing.id !== item.id
      && existing.type === "userMessage"
      && userMessagesLikelySame(existing, item));
    if (matchingExisting && userMessageSpecificity(matchingExisting) >= userMessageSpecificity(item)) return;
    turn.items = turn.items.filter((existing) => existing.id === item.id
      || existing.type !== "userMessage"
      || !userMessagesLikelySame(existing, item));
  }
  if (item.type === "agentMessage" || item.type === "plan") {
    turn.items = turn.items.filter((existing) => existing.id === item.id || !visibleTextItemsLikelySame(existing, item));
  }
  if (isOperationalItem(item)) {
    turn.items.forEach((existing, existingIndex) => {
      if (isOperationalItem(existing) && existing.id !== item.id) {
        if (hasVisibleNonOperationAfterIndex(turn, existingIndex)) {
          rememberLeavingOperation(turn, existing, existingIndex, {
            keepUntilOutOfView: true,
            onlyIfInViewport: true,
          });
        }
      }
    });
    turn.items = turn.items.filter((existing) => !isOperationalItem(existing) || existing.id === item.id);
  }
  const index = turn.items.findIndex((x) => x.id === item.id);
  if (index >= 0 && !item.startedAtMs && turn.items[index].startedAtMs) item.startedAtMs = turn.items[index].startedAtMs;
  if (item.type === "reasoning" && !item.startedAtMs) item.startedAtMs = Date.now();
  if (isOperationalItem(item) && isCompletedStatus(item.status) && !item.completedAtMs) item.completedAtMs = Date.now();
  if (index >= 0) turn.items[index] = mergeItemPreservingVisibleFields(turn.items[index], item);
  else turn.items.push(item);
  turn.items = removeShadowedMuxUserMessages(turn.items);
  scheduleRenderCurrentThread();
}

function removeItem(turnId, itemId) {
  const turn = ensureTurn(turnId);
  if (!turn || !itemId) return;
  turn.items = (turn.items || []).filter((item) => item.id !== itemId);
  scheduleRenderCurrentThread();
}

function ensureTimerItem(turnId, itemId, itemType) {
  const turn = ensureTurn(turnId);
  if (!turn || !itemId) return;
  if (itemType === "reasoning") {
    markActivity("思考");
    updateTickTimer();
    return;
  }
  turn.items = turn.items || [];
  let item = turn.items.find((x) => x.id === itemId);
  if (!item) {
    item = { id: itemId, type: itemType, startedAtMs: Date.now() };
    turn.items.push(item);
  }
  if (!item.startedAtMs) item.startedAtMs = Date.now();
  scheduleRenderCurrentThread();
}

function appendToItem(turnId, itemId, itemType, field, delta, index = 0) {
  const turn = ensureTurn(turnId);
  if (!turn) return;
  if (itemType === "reasoning") {
    markActivity("思考");
    updateTickTimer();
    return;
  }
  markActivity(activityLabelForItem({ type: itemType }));
  let item = (turn.items || []).find((x) => x.id === itemId);
  if (!item) {
    item = { id: itemId, type: itemType };
    if (itemType === "reasoning") item.startedAtMs = Date.now();
    turn.items.push(item);
  }
  if (field === "aggregatedOutput") {
    appendCommandOutput(item, delta);
  } else if (Array.isArray(item[field])) {
    item[field][index] = (item[field][index] || "") + delta;
  } else {
    item[field] = compactLiveText((item[field] || "") + delta);
  }
  scheduleRenderCurrentThread();
}

function scheduleRenderCurrentThread() {
  if (state.renderFrame || state.renderScheduled) return;
  state.renderScheduled = true;
  const render = () => {
    state.renderFrame = null;
    state.renderScheduled = false;
    renderCurrentThread();
  };
  if (window.requestAnimationFrame) {
    state.renderFrame = window.requestAnimationFrame(render);
  } else {
    state.renderFrame = setTimeout(render, 33);
  }
}

function scheduleRenderThreads() {
  if (state.threadListRenderFrame || state.threadListRenderScheduled) return;
  state.threadListRenderScheduled = true;
  const render = () => {
    state.threadListRenderFrame = null;
    state.threadListRenderScheduled = false;
    renderThreads();
  };
  if (window.requestAnimationFrame) {
    state.threadListRenderFrame = window.requestAnimationFrame(render);
  } else {
    state.threadListRenderFrame = setTimeout(render, 33);
  }
}

function upsertServerRequest(request) {
  if (!request || request.id === null || request.id === undefined) return;
  if (!shouldShowApprovalRequest(request)) {
    state.pendingApprovals.delete(String(request.id));
    if (state.currentThread && requestBelongsToThread(request, state.currentThread.id)) scheduleRenderCurrentThread();
    return;
  }
  markActivity(isUserInputRequest(request) ? "等待输入" : "等待批准");
  state.pendingApprovals.set(String(request.id), Object.assign({}, state.pendingApprovals.get(String(request.id)) || {}, request));
  if (state.currentThread && requestBelongsToThread(request, state.currentThread.id)) scheduleRenderCurrentThread();
}

function scheduleApprovalRemoval(requestId, delayMs = 6000) {
  const key = requestId !== null && requestId !== undefined ? String(requestId) : "";
  if (!key) return;
  setTimeout(() => {
    const existing = state.pendingApprovals.get(key);
    if (!existing || !isApprovalSettled(existing)) return;
    state.pendingApprovals.delete(key);
    if (state.currentThread) scheduleRenderCurrentThread();
  }, delayMs);
}

function resolveServerRequest(payload) {
  const requestId = payload && payload.requestId !== null && payload.requestId !== undefined ? String(payload.requestId) : "";
  if (!requestId) return;
  const existing = state.pendingApprovals.get(requestId);
  let next = existing || null;
  if (payload.request) {
    next = Object.assign({}, existing || {}, payload.request);
    state.pendingApprovals.set(requestId, next);
  } else if (existing) {
    existing.status = payload.status || "resolved";
    next = existing;
  }
  if (state.currentThread && next && requestBelongsToThread(next, state.currentThread.id)) scheduleRenderCurrentThread();
  if (next) markActivity(isUserInputRequest(next) ? "输入完成" : "批准完成");
  scheduleApprovalRemoval(requestId);
}

function applyNotification(method, params) {
  if (!params) return;
  if (method === "account/rateLimits/updated") {
    rememberRateLimits(params.rateLimits || null, null);
    return;
  }
  if (shouldThrottleThreadNotification(method, params)) return;
  if (method === "thread/started" && params.thread) {
    if (isHiddenThread(params.thread)) {
      state.threads = state.threads.filter((thread) => thread.id !== params.thread.id);
      scheduleRenderThreads();
      return;
    }
    const index = state.threads.findIndex((x) => x.id === params.thread.id);
    updateThreadStatusHints(params.thread.id, index >= 0 ? state.threads[index].status : null, params.thread.status);
    if (index >= 0) state.threads[index] = Object.assign({}, state.threads[index], params.thread);
    else state.threads.unshift(params.thread);
    scheduleRenderThreads();
    return;
  }
  if (method === "thread/status/changed") {
    const thread = state.threads.find((x) => x.id === params.threadId);
    const previousStatus = thread ? thread.status : null;
    updateThreadStatusHints(params.threadId, previousStatus, params.status);
    if (thread) thread.status = params.status;
    pruneHiddenThreads();
    if (state.currentThread && state.currentThread.id === params.threadId) {
      markThreadViewed(params.threadId);
      state.currentThread.status = params.status;
      renderCurrentThread();
      scheduleLivePollIfNeeded(1400);
    }
    scheduleRenderThreads();
    return;
  }
  if (method === "thread/name/updated") {
    const thread = state.threads.find((x) => x.id === params.threadId);
    if (thread) thread.name = params.threadName;
    pruneHiddenThreads();
    if (state.currentThread && state.currentThread.id === params.threadId) {
      state.currentThread.name = params.threadName;
      renderCurrentThread();
    }
    scheduleRenderThreads();
    return;
  }
  if (method === "thread/archived") {
    state.threads = state.threads.filter((thread) => thread.id !== params.threadId);
    if (state.currentThread && state.currentThread.id === params.threadId) {
      if (state.continuationSourceThreadId === params.threadId) {
        state.currentThread = Object.assign({}, state.currentThread, {
          archived: true,
          status: params.status || { type: "archived" },
        });
      } else {
        clearCurrentThreadSelection();
      }
    }
    scheduleRenderThreads();
    renderCurrentThread();
    return;
  }
  if (!state.currentThread || params.threadId !== state.currentThread.id) return;
  if (method === "turn/started") {
    state.activeTurnId = params.turn.id;
    markActivity("开始");
    $("interruptTurn").disabled = false;
    updateComposerControls();
    ensureTurn(params.turn.id);
    renderCurrentThread();
    scheduleLivePollIfNeeded(1200);
    return;
  }
  if (method === "turn/completed") {
    const turn = ensureTurn(params.turn.id);
    Object.assign(turn, mergeTurnPreservingVisibleItems(turn, params.turn));
    removeOperationalItemsFromTurn(turn);
    state.activeTurnId = "";
    markActivity("完成");
    $("interruptTurn").disabled = true;
    updateComposerControls();
    renderCurrentThread();
    scheduleCurrentThreadRefresh(700);
    scheduleLivePollIfNeeded(1400);
    return;
  }
  if (method === "item/started" || method === "item/completed") {
    upsertItem(params.turnId, params.item);
    scheduleLivePollIfNeeded(2200);
    return;
  }
  if (method === "item/agentMessage/delta") {
    markActivity("输出");
    appendToItem(params.turnId, params.itemId, "agentMessage", "text", params.delta || "");
    return;
  }
  if (method === "item/commandExecution/outputDelta") {
    return;
  }
  if (method === "item/fileChange/outputDelta") {
    return;
  }
  if (method === "item/reasoning/textDelta") {
    markActivity("思考");
    ensureTimerItem(params.turnId, params.itemId, "reasoning");
    return;
  }
  if (method === "item/reasoning/summaryTextDelta") {
    markActivity("思考");
    ensureTimerItem(params.turnId, params.itemId, "reasoning");
  }
}

function connectEvents() {
  clearReconnectTimers();
  if (state.events) {
    state.events.onmessage = null;
    state.events.onerror = null;
    state.events.onopen = null;
    state.events.close();
  }
  const params = new URLSearchParams({ key: state.key });
  if (state.currentThreadId) params.set("threadId", state.currentThreadId);
  state.events = new EventSource(`/api/events?${params.toString()}`);
  state.events.onopen = () => {
    clearReconnectTimers();
    if (state.connectionStatus) restoreConnectionState();
  };
  state.events.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "status") {
      clearReconnectTimers();
      updateConnectionState(payload.status);
      if (payload.status.rateLimits || payload.status.rateLimitsByModel) {
        rememberRateLimits(payload.status.rateLimits, payload.status.rateLimitsByModel);
      }
      return;
    }
    if (payload.type === "notification") applyNotification(payload.method, payload.params);
    if (payload.type === "serverRequest") upsertServerRequest(payload.request);
    if (payload.type === "serverRequestResolved") resolveServerRequest(payload);
  };
  state.events.onerror = () => {
    if (document.visibilityState === "hidden") return;
    clearTimeout(state.reconnectNoticeTimer);
    state.reconnectNoticeTimer = setTimeout(() => {
      if (state.events && state.events.readyState !== EventSource.OPEN && document.visibilityState !== "hidden") {
        markActivity("重连");
        updateConnectionState(null, "Reconnecting");
      }
    }, 3000);
    clearTimeout(state.recoveryTimer);
    state.recoveryTimer = setTimeout(async () => {
      if (!state.events || state.events.readyState === EventSource.OPEN || document.visibilityState === "hidden") return;
      try {
        const status = await api("/api/status");
        updateConnectionState(status);
        if (status.rateLimits || status.rateLimitsByModel) rememberRateLimits(status.rateLimits, status.rateLimitsByModel);
        await loadThreads();
        await refreshCurrentThread();
        ensureEventConnection();
      } catch (err) {
        showError(err);
      }
    }, 8000);
    return;
  };
}

function ensureEventConnection() {
  if (!state.key) return;
  if (!state.events || state.events.readyState === EventSource.CLOSED) connectEvents();
}

function clearResumeVisualTimers() {
  for (const timer of state.resumeVisualTimers) clearTimeout(timer);
  state.resumeVisualTimers = [];
}

function clearVisualRecoveryTimers() {
  for (const timer of state.visualRecoveryTimers) clearTimeout(timer);
  state.visualRecoveryTimers = [];
}

function forceVisualRecovery(reason = "resume", options = {}) {
  updateViewportVars();
  if (!state.key) return;
  const app = $("app");
  const login = $("login");
  if (!app || !login) return;
  const root = document.documentElement;
  const body = document.body;
  const heavy = options.heavy !== false;
  login.classList.add("hidden");
  app.classList.remove("hidden");
  if (heavy) {
    root.classList.add("visual-recovering");
    if (body) body.classList.add("visual-recovering");
    app.classList.add("resume-repaint");
  }
  app.dataset.resumeReason = reason;
  const z = state.visualRecoverySeq % 2 ? "0.01px" : "0px";
  if (heavy) {
    app.style.transform = `translate3d(0, 0, ${z})`;
    app.style.webkitTransform = `translate3d(0, 0, ${z})`;
  }
  app.getBoundingClientRect();
  if (options.render !== false && (state.currentThread || state.threads.length)) renderCurrentThread();
  updateComposerHeightVar();
  window.requestAnimationFrame(() => {
    app.getBoundingClientRect();
    window.requestAnimationFrame(() => {
      if (heavy) {
        app.classList.remove("resume-repaint");
        root.classList.remove("visual-recovering");
        if (body) body.classList.remove("visual-recovering");
      }
      app.style.removeProperty("transform");
      app.style.removeProperty("-webkit-transform");
      delete app.dataset.resumeReason;
    });
  });
}

function scheduleVisualRecovery(reason = "visual", delay = 0, options = {}) {
  if (document.visibilityState === "hidden") return;
  const seq = ++state.visualRecoverySeq;
  clearVisualRecoveryTimers();
  const delays = options.delays || [delay, delay + 80, delay + 240, delay + 700, delay + 1600, delay + 3200];
  for (const visualDelay of delays) {
    state.visualRecoveryTimers.push(setTimeout(() => {
      if (seq === state.visualRecoverySeq && document.visibilityState !== "hidden") {
        forceVisualRecovery(reason, {
          render: options.render !== false,
          heavy: options.heavy !== false,
        });
      }
    }, Math.max(0, visualDelay)));
  }
}

function scheduleMobileResume(reason = "resume", delay = 80) {
  if (document.visibilityState === "hidden") return;
  const seq = ++state.resumeSeq;
  clearTimeout(state.resumeTimer);
  clearResumeVisualTimers();
  for (const visualDelay of [0, delay, delay + 220, delay + 900]) {
    state.resumeVisualTimers.push(setTimeout(() => {
      if (seq === state.resumeSeq && document.visibilityState !== "hidden") forceVisualRecovery(reason);
    }, visualDelay));
  }
  state.resumeTimer = setTimeout(() => {
    if (seq === state.resumeSeq) resumeMobileSession(reason).catch(showError);
  }, delay);
}

async function resumeMobileSession(reason = "resume") {
  if (document.visibilityState === "hidden" || !state.key) return;
  forceVisualRecovery(reason);
  updateComposerHeightVar();
  renderComposerSettings();
  updateComposerControls();
  if (state.currentThread || state.threads.length) renderCurrentThread();
  ensureEventConnection();
  state.pollStableCount = 0;
  const status = await api("/api/status");
  updateConnectionState(status);
  if (status.rateLimits || status.rateLimitsByModel) rememberRateLimits(status.rateLimits, status.rateLimitsByModel);
  await loadThreads();
  if (state.currentThreadId) await refreshCurrentThread();
  else await restoreThreadSelection();
  scheduleLivePollIfNeeded(1200);
}

function scrollConversationToBottom() {
  const el = $("conversation");
  if (!el) return;
  const target = Math.max(0, el.scrollHeight - el.clientHeight);
  if (Math.abs(el.scrollTop - target) < 2) return;
  el.scrollTop = target;
}

function isConversationNearBottom() {
  const el = $("conversation");
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 96;
}

function updateComposerHeightVar() {
  const composer = $("composer");
  if (!composer) return;
  document.documentElement.style.setProperty("--composer-height", `${Math.ceil(composer.getBoundingClientRect().height)}px`);
}

function showError(err) {
  const raw = err instanceof Error ? err.message : String(err || "");
  const message = normalizeClientErrorMessage(raw) || (err && err.message) || String(err);
  $("connectionState").textContent = message;
  $("connectionState").classList.add("error");
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
    if (!state.composerBusy || state.currentThreadId !== targetThreadId) return;
    state.sendProgressWarned = true;
    $("connectionState").textContent = "发送较慢，检查网络后稍等，避免重复提交";
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

function normalizeClientErrorMessage(message) {
  const text = String(message || "").toLowerCase();
  if (text.includes("failed to fetch")) {
    return "网络异常，发送失败：请求未发出，请检查网络后重试";
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
  autoSizeMessageInput(el);
}

function setMessageInputDisabled(disabled) {
  const el = $("messageInput");
  if (!el) return;
  el.contentEditable = disabled ? "false" : "true";
  el.setAttribute("aria-disabled", disabled ? "true" : "false");
  el.tabIndex = disabled ? -1 : 0;
  el.classList.toggle("disabled", disabled);
}

function autoSizeMessageInput(el) {
  el.style.height = "auto";
  el.style.height = `${Math.min(160, Math.max(44, el.scrollHeight))}px`;
  updateComposerHeightVar();
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function attachmentId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pendingAttachmentBytes(extra = []) {
  return state.pendingAttachments.reduce((total, item) => total + item.file.size, 0)
    + extra.reduce((total, file) => total + file.size, 0);
}

function addAttachmentFiles(fileList) {
  const files = Array.from(fileList || []).filter(Boolean);
  if (!files.length) return;
  const accepted = [];
  for (const file of files) {
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
}

function removeAttachment(id) {
  const index = state.pendingAttachments.findIndex((item) => item.id === id);
  if (index < 0) return;
  const [item] = state.pendingAttachments.splice(index, 1);
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  renderAttachmentList();
}

function clearPendingAttachments() {
  for (const item of state.pendingAttachments) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }
  state.pendingAttachments = [];
  renderAttachmentList();
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

function effectiveDefaultModel() {
  return (state.currentThread && state.currentThread.model) || state.defaultModel || "";
}

function effectiveDefaultEffort() {
  return (state.currentThread && state.currentThread.effort) || state.defaultReasoningEffort || "";
}

function effectiveDefaultPermissionMode() {
  const settings = state.currentThread && state.currentThread.runtimeSettings;
  return normalizePermissionModeValue((settings && settings.permissionMode) || "");
}

function selectedPermissionModeForCurrentThread() {
  if (!state.currentThreadId) return "";
  return normalizePermissionModeValue(state.selectedPermissionModes[state.currentThreadId] || "");
}

function setSelectedPermissionModeForCurrentThread(value) {
  if (!state.currentThreadId) return;
  const next = normalizePermissionModeValue(value);
  if (next && next !== effectiveDefaultPermissionMode()) {
    state.selectedPermissionModes[state.currentThreadId] = next;
  } else {
    delete state.selectedPermissionModes[state.currentThreadId];
  }
  localStorage.setItem(STORAGE_PERMISSION_MODES, JSON.stringify(state.selectedPermissionModes));
}

function renderComposerSettings() {
  const modelSelect = $("modelSelect");
  const effortSelect = $("effortSelect");
  const permissionSelect = $("permissionSelect");
  if (!modelSelect || !effortSelect || !permissionSelect) return;
  const defaultModel = effectiveDefaultModel();
  const defaultEffort = effectiveDefaultEffort();
  const defaultPermission = effectiveDefaultPermissionMode();
  let selectedPermission = selectedPermissionModeForCurrentThread();
  if (selectedPermission && selectedPermission === defaultPermission) {
    setSelectedPermissionModeForCurrentThread("");
    selectedPermission = "";
  }
  const modelValues = normalizeOptionList([state.selectedModel, ...state.modelOptions])
    .filter((value) => value !== defaultModel);
  const effortValues = normalizeOptionList([state.selectedEffort, ...state.reasoningEffortOptions])
    .filter((value) => value !== defaultEffort);
  const permissionValues = normalizeOptionList([selectedPermission, ...state.permissionModeOptions.map(normalizePermissionModeValue)])
    .filter((value) => value !== defaultPermission);
  modelSelect.innerHTML = `<option value="">${escapeHtml(defaultModel ? labelForModel(defaultModel) : "Default")}</option>`
    + modelValues.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labelForModel(value))}</option>`).join("");
  effortSelect.innerHTML = `<option value="">${escapeHtml(defaultEffort ? labelForEffort(defaultEffort) : "Default")}</option>`
    + effortValues.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labelForEffort(value))}</option>`).join("");
  permissionSelect.innerHTML = `<option value="">${escapeHtml(defaultPermission ? labelForPermissionMode(defaultPermission) : "Perm")}</option>`
    + permissionValues.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labelForPermissionMode(value))}</option>`).join("");
  if (state.selectedModel && state.selectedModel !== defaultModel && modelValues.includes(state.selectedModel)) modelSelect.value = state.selectedModel;
  else modelSelect.value = "";
  if (state.selectedEffort && state.selectedEffort !== defaultEffort && effortValues.includes(state.selectedEffort)) effortSelect.value = state.selectedEffort;
  else effortSelect.value = "";
  if (selectedPermission && selectedPermission !== defaultPermission && permissionValues.includes(selectedPermission)) permissionSelect.value = selectedPermission;
  else permissionSelect.value = "";
  permissionSelect.title = titleForPermissionMode(permissionSelect.value || defaultPermission);
  renderQuotaUsage();
}

function updateComposerControls() {
  const hasThread = Boolean(state.currentThreadId
    && state.currentThread
    && !state.currentThread.mobileLoading
    && !state.currentThread.mobileLoadError);
  const disabled = !hasThread || state.composerBusy;
  const hasContent = composerHasContent();
  const interruptMode = Boolean(state.activeTurnId) && !hasContent;
  const sendButton = $("sendMessage");
  const attachButton = $("attachFiles");
  setMessageInputDisabled(disabled);
  $("fileInput").disabled = disabled;
  $("modelSelect").disabled = disabled;
  $("effortSelect").disabled = disabled;
  $("permissionSelect").disabled = disabled;
  attachButton.classList.toggle("disabled", disabled);
  attachButton.setAttribute("aria-disabled", disabled ? "true" : "false");
  attachButton.tabIndex = disabled ? -1 : 0;
  sendButton.textContent = interruptMode ? "Stop" : "Send";
  sendButton.title = interruptMode ? "Interrupt current turn" : "Send message";
  sendButton.classList.toggle("interrupt-mode", interruptMode);
  sendButton.disabled = disabled || (!interruptMode && !hasContent);
}

function hasTransferFiles(event) {
  const types = Array.from((event.dataTransfer && event.dataTransfer.types) || []);
  return types.includes("Files");
}

async function sendMessage(event) {
  if (event && typeof event.preventDefault === "function") event.preventDefault();
  if (state.composerBusy) return;
  state.lastSendSubmitStartedAt = Date.now();
  const input = $("messageInput");
  const text = composerText();
  const hasContent = Boolean(text || state.pendingAttachments.length);
  if (state.activeTurnId && !hasContent) {
    await interruptActiveTurn();
    return;
  }
  if ((!text && !state.pendingAttachments.length) || !state.currentThreadId) return;
  state.composerBusy = true;
  startSendProgressWatchdog(state.currentThreadId);
  markActivity(state.activeTurnId ? "追加输入" : "发送");
  updateComposerControls();
  if (state.sendProgressWarned) {
    $("connectionState").textContent = "发送中…";
    $("connectionState").classList.remove("error");
  }
  try {
    const body = new FormData();
    body.append("clientSubmissionId", createSubmissionId());
    body.append("text", text);
    if (state.currentThread && state.currentThread.cwd) body.append("cwd", state.currentThread.cwd);
    if (state.activeTurnId) body.append("activeTurnId", state.activeTurnId);
    if ($("modelSelect").value) body.append("model", $("modelSelect").value);
    if ($("effortSelect").value) body.append("effort", $("effortSelect").value);
    if ($("permissionSelect").value) body.append("permissionMode", $("permissionSelect").value);
    for (const item of state.pendingAttachments) {
      body.append("attachments", item.file, item.file.name || "upload");
    }
    await api(`/api/threads/${encodeURIComponent(state.currentThreadId)}/messages`, {
      method: "POST",
      body,
      timeoutMs: 180000,
    });
    setComposerText("");
    clearPendingAttachments();
    input.blur();
    $("connectionState").classList.remove("error");
    $("connectionState").textContent = "Sent";
    markActivity("已发送");
    scheduleCurrentThreadRefresh(600);
    scheduleLivePollIfNeeded(1200);
  } catch (err) {
    showError(err);
  } finally {
    finishSendProgressWatchdog();
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

async function interruptActiveTurn() {
  if (!state.currentThreadId || !state.activeTurnId) return;
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "Interrupt requested";
  markActivity("中断");
  await api(`/api/threads/${encodeURIComponent(state.currentThreadId)}/turns/${encodeURIComponent(state.activeTurnId)}/interrupt`, { method: "POST" })
    .then(() => scheduleCurrentThreadRefresh(900))
    .catch(showError);
}

async function answerServerRequest(requestId, payload) {
  const key = requestId !== null && requestId !== undefined ? String(requestId) : "";
  const request = state.pendingApprovals.get(key);
  if (!request || request.status !== "waiting") return;
  request.status = "responding";
  request.decision = payload && (payload.decision || payload.action) || "submitted";
  markActivity(isUserInputRequest(request) ? "输入发送中" : "批准中");
  renderCurrentThread();
  try {
    const result = await api(`/api/approvals/${encodeURIComponent(key)}`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
      timeoutMs: 20000,
    });
    if (result && result.request) state.pendingApprovals.set(key, result.request);
    $("connectionState").classList.remove("error");
    $("connectionState").textContent = isUserInputRequest(request) ? "Response sent" : "Approval sent";
    markActivity(isUserInputRequest(request) ? "输入已发送" : "批准发送");
    renderCurrentThread();
  } catch (err) {
    request.status = "waiting";
    request.decision = null;
    showError(err);
    renderCurrentThread();
  }
}

function answerApproval(requestId, decision) {
  return answerServerRequest(requestId, { decision });
}

function serverRequestPayload(request, responseText, questionId) {
  if (request && request.method === "mcpServer/elicitation/request") {
    return { action: "accept", responseText };
  }
  return { responseText, questionId };
}

function declineServerRequest(requestId) {
  const key = requestId !== null && requestId !== undefined ? String(requestId) : "";
  const request = state.pendingApprovals.get(key);
  if (!request) return Promise.resolve();
  if (request.method === "mcpServer/elicitation/request") {
    return answerServerRequest(key, { action: "decline" });
  }
  if (request.method === "item/tool/requestUserInput") {
    return answerServerRequest(key, { answers: {} });
  }
  return answerApproval(key, "deny");
}

function wireUi() {
  $("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    login($("loginKey").value.trim()).catch((err) => showLogin(err.message));
  });
  $("workspaceSelect").addEventListener("change", (event) => {
    state.selectedCwd = event.target.value;
    clearCurrentThreadSelection();
    updateWorkspacePath();
    updateComposerControls();
    renderCurrentThread();
    loadThreads().catch(showError);
  });
  $("refreshThreads").addEventListener("click", () => loadThreads().catch(showError));
  $("pushNotifications").addEventListener("click", () => handlePushButtonClick().catch(showError));
  $("threadSearch").addEventListener("input", () => {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => loadThreads().catch(showError), 250);
  });
  $("threadList").addEventListener("pointerdown", beginThreadSwipe);
  $("threadList").addEventListener("pointermove", moveThreadSwipe, { passive: false });
  $("threadList").addEventListener("pointerup", endThreadSwipe);
  $("threadList").addEventListener("pointercancel", cancelThreadSwipe);
  $("threadList").addEventListener("touchstart", beginThreadSwipeTouch, { passive: true });
  $("threadList").addEventListener("touchmove", moveThreadSwipeTouch, { passive: false });
  $("threadList").addEventListener("touchend", endThreadSwipeTouch, { passive: true });
  $("threadList").addEventListener("touchcancel", endThreadSwipeTouch, { passive: true });
  $("threadList").addEventListener("click", suppressThreadClickAfterSwipe, true);
  $("openMenu").addEventListener("click", () => {
    $("sidebar").classList.add("open");
    loadWorkspaces()
      .then(() => loadThreads())
      .catch(showError);
  });
  $("closeMenu").addEventListener("click", () => $("sidebar").classList.remove("open"));
  $("composer").addEventListener("submit", sendMessage);
  $("sendMessage").addEventListener("pointerup", requestComposerSubmitFromButton);
  $("sendMessage").addEventListener("click", requestComposerSubmitFromButton);
  $("interruptTurn").addEventListener("click", interruptActiveTurn);
  $("conversation").addEventListener("scroll", () => {
    if (state.leavingItems.size) scheduleLeavingCleanup(120);
  }, { passive: true });
  $("conversation").addEventListener("click", (event) => {
    const button = event.target.closest("[data-approval-action]");
    if (button) {
      answerApproval(button.dataset.approvalId, button.dataset.approvalAction).catch(showError);
      return;
    }
    const option = event.target.closest("[data-server-response-text]");
    if (option) {
      const requestId = option.dataset.serverRequestId;
      const request = state.pendingApprovals.get(requestId !== null && requestId !== undefined ? String(requestId) : "");
      answerServerRequest(requestId, serverRequestPayload(request, option.dataset.serverResponseText || "", option.dataset.serverQuestionId || "answer")).catch(showError);
      return;
    }
    const decline = event.target.closest("[data-server-request-decline]");
    if (decline) {
      declineServerRequest(decline.dataset.serverRequestId).catch(showError);
    }
  });
  $("conversation").addEventListener("submit", (event) => {
    const form = event.target.closest("[data-server-request-form]");
    if (!form) return;
    event.preventDefault();
    const requestId = form.dataset.serverRequestId;
    const request = state.pendingApprovals.get(requestId !== null && requestId !== undefined ? String(requestId) : "");
    const responseText = new FormData(form).get("responseText") || "";
    answerServerRequest(requestId, serverRequestPayload(request, String(responseText), form.dataset.serverQuestionId || "answer")).catch(showError);
  });
  $("messageInput").addEventListener("input", (event) => {
    autoSizeMessageInput(event.target);
    updateComposerControls();
  });
  $("messageInput").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (!composerHasContent() || state.composerBusy) return;
    event.preventDefault();
    $("composer").requestSubmit();
  });
  $("modelSelect").addEventListener("change", (event) => {
    state.selectedModel = event.target.value;
    if (state.selectedModel) localStorage.setItem(STORAGE_MODEL, state.selectedModel);
    else localStorage.removeItem(STORAGE_MODEL);
    renderQuotaUsage();
  });
  $("effortSelect").addEventListener("change", (event) => {
    state.selectedEffort = event.target.value;
    if (state.selectedEffort) localStorage.setItem(STORAGE_EFFORT, state.selectedEffort);
    else localStorage.removeItem(STORAGE_EFFORT);
  });
  $("permissionSelect").addEventListener("change", (event) => {
    setSelectedPermissionModeForCurrentThread(event.target.value);
    event.target.title = titleForPermissionMode(event.target.value || effectiveDefaultPermissionMode());
  });
  $("messageInput").addEventListener("paste", (event) => {
    const files = Array.from((event.clipboardData && event.clipboardData.files) || []);
    if (files.length) addAttachmentFiles(files);
    const text = event.clipboardData && event.clipboardData.getData("text/plain");
    if (text) {
      event.preventDefault();
      document.execCommand("insertText", false, text);
    }
  });
  $("attachFiles").addEventListener("keydown", (event) => {
    if ($("fileInput").disabled || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    $("fileInput").click();
  });
  $("fileInput").addEventListener("change", (event) => {
    addAttachmentFiles(event.target.files);
    event.target.value = "";
  });
  $("attachmentList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-attachment]");
    if (button) removeAttachment(button.dataset.removeAttachment);
  });
  $("composer").addEventListener("dragover", (event) => {
    if (!state.currentThreadId || !hasTransferFiles(event)) return;
    event.preventDefault();
    $("composer").classList.add("drag-over");
  });
  $("composer").addEventListener("dragleave", () => $("composer").classList.remove("drag-over"));
  $("composer").addEventListener("drop", (event) => {
    if (!state.currentThreadId || !hasTransferFiles(event)) return;
    event.preventDefault();
    $("composer").classList.remove("drag-over");
    addAttachmentFiles(event.dataTransfer.files);
  });
  updateViewportVars();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
  }
  document.addEventListener("visibilitychange", () => scheduleMobileResume("visibility"));
  window.addEventListener("pageshow", () => {
    const threadId = applyUrlThreadSelection({ load: true });
    scheduleMobileResume("pageshow", threadId ? 240 : 80);
  });
  window.addEventListener("focus", () => {
    const threadId = applyUrlThreadSelection({ load: true });
    scheduleMobileResume("focus", threadId ? 300 : 150);
  });
  window.addEventListener("blur", () => scheduleVisualRecovery("window-blur", 180, { render: false }));
  document.addEventListener("focusin", () => scheduleVisualRecovery("focusin", 40, { render: false, heavy: false, delays: [40, 180] }));
  document.addEventListener("focusout", () => scheduleVisualRecovery("focusout", 160, { render: false, heavy: false, delays: [160, 420] }));
  window.addEventListener("orientationchange", () => scheduleMobileResume("orientation", 250));
  window.addEventListener("resize", () => {
    updateViewportVars();
    updateComposerHeightVar();
    scheduleVisualRecovery("resize", 40, { render: false, heavy: false, delays: [40, 180] });
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      updateViewportVars();
      updateComposerHeightVar();
      scheduleVisualRecovery("visual-viewport", 40, { render: false, heavy: false, delays: [40, 180, 520] });
    });
    window.visualViewport.addEventListener("scroll", () => {
      updateViewportVars();
      scheduleVisualRecovery("visual-viewport-scroll", 40, { render: false, heavy: false, delays: [40, 180] });
    });
  }
}

async function start() {
  wireUi();
  startRelativeTimeTimer();
  startUiWatchdog();
  const config = await fetch("/api/public-config").then((res) => res.json());
  state.maxUploadBytes = Number(config.maxUploadBytes || state.maxUploadBytes);
  state.maxUploadFiles = Number(config.maxUploadFiles || state.maxUploadFiles);
  state.rolloutWarningThresholdBytes = Number(config.rolloutWarningBytes || state.rolloutWarningThresholdBytes);
  state.modelOptions = normalizeOptionList(config.modelOptions || []);
  state.reasoningEffortOptions = normalizeOptionList(config.reasoningEffortOptions || []);
  state.permissionModeOptions = normalizeOptionList((config.permissionModeOptions || state.permissionModeOptions)
    .map(normalizePermissionModeValue));
  state.defaultModel = String(config.defaultModel || "");
  state.defaultReasoningEffort = String(config.defaultReasoningEffort || "");
  state.pushServerSupported = Boolean(config.push && config.push.supported);
  renderComposerSettings();
  rememberRateLimits(config.rateLimits || null, config.rateLimitsByModel || null);
  updatePushButton();
  if (config.authRequired && !state.key) {
    showLogin();
    return;
  }
  showApp();
  await bootstrap().catch((err) => {
    showError(err);
    if (/unauthorized/i.test(err.message)) showLogin();
  });
  resumeRememberedContinuationJob().catch(showError);
}

start();
