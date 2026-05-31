"use strict";

function initialPluginLaunchKeyFromUrl() {
  try {
    const params = new URL(window.location.href, window.location.origin).searchParams;
    return String(params.get("codexPluginLaunch") || params.get("pluginLaunch") || "").trim();
  } catch (_) {
    return "";
  }
}

const pluginEmbedApi = window.CodexPluginEmbed || {
  detect: () => ({ embedded: false, launchKey: initialPluginLaunchKeyFromUrl(), workspaceId: "", routeHint: null, appearance: {} }),
  isBackMessage: () => false,
  navigationMessage: () => null,
  parentOriginFromReferrer: () => "",
  postBackResult: () => null,
  postNavigation: () => null,
};
const INITIAL_PLUGIN_EMBED = pluginEmbedApi.detect(window.location.href);
const INITIAL_PLUGIN_LAUNCH_KEY = INITIAL_PLUGIN_EMBED.launchKey || initialPluginLaunchKeyFromUrl();

const state = {
  key: INITIAL_PLUGIN_LAUNCH_KEY || (INITIAL_PLUGIN_EMBED.embedded ? "" : localStorage.getItem("codexMobileKey")) || "",
  pluginEmbed: INITIAL_PLUGIN_EMBED,
  pluginLaunchSession: Boolean(INITIAL_PLUGIN_LAUNCH_KEY),
  pluginSessionActive: false,
  pluginLaunchTarget: null,
  pluginAppearance: INITIAL_PLUGIN_EMBED.appearance || null,
  queuedPluginRouteHint: INITIAL_PLUGIN_EMBED.routeHint || null,
  pendingPluginRouteHint: null,
  pluginParentOrigin: pluginEmbedApi.parentOriginFromReferrer(document.referrer) || "*",
  pluginNavigationSignature: "",
  pluginRefreshRequestSignature: "",
  pluginRefreshPendingNotice: "",
  pluginRefreshPendingTimer: null,
  startupThreadOpenPending: false,
  workspaces: [],
  workspaceCreateEnabled: true,
  workspaceCreateRoot: "",
  workspaceCreateRoots: [],
  workspaceCreateBusy: false,
  selectedCwd: "",
  threads: [],
  currentThread: null,
  currentThreadId: "",
  newThreadDraft: false,
  activeTurnId: "",
  events: null,
  connectionStatus: null,
  renderScheduled: false,
  renderFrame: null,
  scrollToBottomFrame: null,
  recentCompletedReplyAnchor: null,
  conversationScrollIntentAtMs: 0,
  conversationLastScrollTop: 0,
  conversationNearBottomAtMs: 0,
  conversationNearBottomThreadId: "",
  programmaticScrollUntilMs: 0,
  autoScrollHold: null,
  submittedMessageBottomFollow: null,
  viewportBottomFollow: null,
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
  draftSaveTimer: null,
  draftRestoreSeq: 0,
  draftAttachmentWarningShown: false,
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
  refreshThreadController: null,
  threadListLoadSeq: 0,
  threadListLoadController: null,
  threadListLoadedAtMs: 0,
  threadActionMenuId: "",
  threadLongPress: null,
  renameThreadId: "",
  continuationDialogThreadId: "",
  renameBusy: false,
  sidebarEdgeSwipe: null,
  subagentSwipe: null,
  subagentPanelOpen: false,
  suppressThreadClickUntil: 0,
  suppressThreadClickThreadId: "",
  continuationSourceThreadId: "",
  continuationNewThreadId: "",
  continuationJobId: "",
  pendingAttachments: [],
  composerBusy: false,
  sendButtonHint: "",
  completionSoundEnabled: true,
  continuationBusy: false,
  maxUploadBytes: 64 * 1024 * 1024,
  maxUploadFiles: 12,
  rolloutWarningThresholdBytes: 100 * 1024 * 1024,
  appVersion: "",
  serverPlatform: "",
  appUpdateStatus: null,
  appUpdateBusy: false,
  appUpdateError: "",
  appUpdateRestarting: false,
  publicPrStatus: null,
  publicPrBusy: false,
  publicPrError: "",
  publicPrEnabled: false,
  publicPrRepository: "",
  publicPrPromptedKey: localStorage.getItem("codexMobilePublicPrPromptKey") || "",
  appWorkspacePath: "",
  sharedRestartBusy: false,
  sharedRestarting: false,
  serverBuildId: "",
  serverAssetBuildId: "",
  pageRefreshAvailable: false,
  pageRefreshBuildId: "",
  pageRefreshReason: "",
  pageRefreshPreparedConfig: null,
  pageRefreshBusy: false,
  pageRefreshReloading: false,
  pageRefreshTimer: null,
  pageRefreshLastCheckAt: 0,
  modelOptions: [],
  reasoningEffortOptions: [],
  permissionModeOptions: ["default", "auto", "full", "custom"],
  defaultModel: "",
  defaultReasoningEffort: "",
  composerModel: "",
  composerEffort: "",
  composerPermissionMode: "",
  composerMenuKind: "",
  quotaDetailsOpen: false,
  newThreadModel: "",
  newThreadEffort: "",
  newThreadPermissionMode: "full",
  rateLimits: loadJsonStorage("codexMobileRateLimits", null),
  rateLimitsByModel: loadJsonStorage("codexMobileRateLimitsByModel", {}),
  pushServerSupported: false,
  pushSubscribed: false,
  pushBusy: false,
  pushError: "",
  serviceWorkerRegistration: null,
  pendingApprovals: new Map(),
  threadTaskCardDraftStates: new Map(Object.entries(loadJsonStorage("codexMobileThreadTaskCardDraftStates", {}))),
  scheduledThreadTaskCardDraftCreations: new Set(),
  runningThreadIds: loadStringSetStorage("codexMobileRunningThreadIds"),
  unreadThreadIds: loadStringSetStorage("codexMobileUnreadThreadIds"),
  rolloutWarningDismissals: loadStringSetStorage("codexMobileDismissedRolloutWarnings"),
  fontSize: (INITIAL_PLUGIN_EMBED.appearance && INITIAL_PLUGIN_EMBED.appearance.fontSize)
    || localStorage.getItem("codexMobileFontSize")
    || "default",
  activityLabel: "",
  activityAtMs: 0,
  lastSendButtonSubmitAt: 0,
  lastSendSubmitStartedAt: 0,
  uiWatchdogTimer: null,
  lastUiWatchdogTickAt: 0,
  lastUiStallReportedAt: 0,
  lastCompletionSoundAt: 0,
  completionAudioContext: null,
  completionAudioUnlocked: false,
  copyTextStore: new Map(),
  copySeq: 0,
  copyFeedbackTimers: new Map(),
  steerFeedback: null,
  steerFeedbackTimer: null,
  attachmentProcessingCount: 0,
  filePreviewSwipe: null,
};

const MAX_COMMAND_OUTPUT_CHARS = 16000;
const MAX_LIVE_TEXT_CHARS = 60000;
const MAX_VISIBLE_TURNS = 12;
const CLIENT_BUILD_ID = "0.1.11|codex-mobile-shell-v134";
const PAGE_REFRESH_CHECK_INTERVAL_MS = 60000;
const PAGE_REFRESH_MIN_CHECK_INTERVAL_MS = 12000;
const PAGE_SHELL_ASSETS = Object.freeze([
  "/",
  "/index.html",
  "/styles.css",
  "/api-client.js",
  "/runtime-settings.js",
  "/draft-store.js",
  "/markdown-renderer.js",
  "/viewport-metrics.js",
  "/conversation-scroll.js",
  "/image-compressor.js",
  "/plugin-embed.js",
  "/app.js",
  "/manifest.json",
  "/sw.js",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
]);
const TURN_REPLY_JUMP_WINDOW_MS = 10 * 60 * 1000;
const CONVERSATION_SCROLL_INTENT_MS = 1200;
const STORAGE_THREAD_ID = "codexMobileCurrentThreadId";
const STORAGE_CONTINUATION_JOB = "codexMobileContinuationJobId";
const STORAGE_RUNNING_THREAD_IDS = "codexMobileRunningThreadIds";
const STORAGE_UNREAD_THREAD_IDS = "codexMobileUnreadThreadIds";
const STORAGE_DISMISSED_ROLLOUT_WARNINGS = "codexMobileDismissedRolloutWarnings";
const STORAGE_FONT_SIZE = "codexMobileFontSize";
const STORAGE_RATE_LIMITS = "codexMobileRateLimits";
const STORAGE_RATE_LIMITS_BY_MODEL = "codexMobileRateLimitsByModel";
const STORAGE_PUBLIC_PR_PROMPT = "codexMobilePublicPrPromptKey";
const STORAGE_TASK_CARD_DRAFT_STATES = "codexMobileThreadTaskCardDraftStates";
const DRAFT_SAVE_DEBOUNCE_MS = 250;
const THREAD_TASK_CARD_REQUEST_TAG = "codex-mobile-thread-task-card-request";
const THREAD_TASK_CARD_DRAFT_TAG = "codex-mobile-thread-task-card-draft";
const THEME_VALUES = new Set(["system", "dark", "light"]);
const FONT_SIZE_VALUES = new Set(["small", "default", "large", "xlarge", "xxlarge"]);
const MENU_OVERLAY_MEDIA = "(max-width: 1180px), (pointer: coarse) and (max-width: 1400px)";
const TABLET_SPLIT_MEDIA = "(pointer: coarse) and (orientation: landscape) and (min-width: 900px) and (min-height: 600px)";
const SIDEBAR_EDGE_SWIPE_PX = 34;
const SIDEBAR_EDGE_OPEN_MIN_PX = 76;
const SIDEBAR_EDGE_OPEN_RATIO = 0.22;
const SUBAGENT_SWIPE_MIN_PX = 70;
const SUBAGENT_WHEEL_SWIPE_MIN_PX = 48;
const FILE_PREVIEW_SWIPE_CLOSE_MIN_PX = 62;
const OPERATIONAL_ITEM_TYPES = new Set(["commandExecution", "fileChange", "dynamicToolCall", "mcpToolCall"]);
const HIDDEN_SERVER_REQUEST_METHODS = new Set(["item/tool/call"]);
const USER_INPUT_REQUEST_METHODS = new Set(["item/tool/requestUserInput", "mcpServer/elicitation/request"]);
const CONTEXT_COMPACTION_PENDING_NOTICE = "\u5386\u53f2\u4e0a\u4e0b\u6587\u6b63\u5728\u538b\u7f29";
const CONTEXT_COMPACTION_COMPLETE_NOTICE = "\u5386\u53f2\u4e0a\u4e0b\u6587\u5df2\u538b\u7f29";

const $ = (id) => document.getElementById(id);
const apiClient = window.CodexApiClient.createApiClient({
  fetch: window.fetch.bind(window),
  AbortControllerCtor: AbortController,
  FormDataCtor: window.FormData,
  getKey() {
    return state.key;
  },
  onUnauthorized() {
    if (isHermesEmbedMode()) {
      requestHermesPluginRefresh("auth_state_changed");
      showPluginEmbedRecovering("Refreshing Codex Mobile plugin session...");
    }
    else showLogin();
  },
  onResponseError(details) {
    if (!isHermesEmbedMode()) return;
    const reason = pluginRefreshReasonForApiError(details);
    if (!reason) return;
    requestHermesPluginRefresh(reason);
  },
});
const runtimeSettings = window.CodexRuntimeSettings;
const viewportMetrics = window.CodexViewportMetrics;
const conversationScroll = window.CodexConversationScroll;
const imageCompressor = window.CodexImageCompressor;
const draftStore = window.CodexDraftStore.createDraftStore({
  storage: localStorage,
  indexedDB: window.indexedDB,
  FileCtor: window.File,
  URLApi: URL,
  IDBKeyRangeCtor: window.IDBKeyRange,
  normalizeFsPath,
  reportError(type, details) {
    postClientEvent(type, details || {});
  },
});

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
      };
    }
    localStorage.setItem(STORAGE_TASK_CARD_DRAFT_STATES, JSON.stringify(entries));
  } catch (_) {
    // Draft-state persistence is best-effort UI state.
  }
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
  if (appearance.theme && window.codexMobileTheme && typeof window.codexMobileTheme.apply === "function") {
    window.codexMobileTheme.apply(appearance.theme);
  }
  if (appearance.fontSize) {
    state.fontSize = appearance.fontSize;
    applyFontSizePreference();
    renderFontSizeControl();
    const input = $("messageInput");
    if (input) autoSizeMessageInput(input);
  }
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
  if (input) autoSizeMessageInput(input);
}

function handleFontSizeChoice(event) {
  const button = event.target.closest("[data-font-size-choice]");
  if (!button) return;
  event.preventDefault();
  setFontSizePreference(button.dataset.fontSizeChoice || "default");
}

function isMenuOverlayMode() {
  return window.matchMedia(MENU_OVERLAY_MEDIA).matches
    && !window.matchMedia(TABLET_SPLIT_MEDIA).matches;
}

function viewportState() {
  return viewportMetrics.measureViewport({
    visualHeight: window.visualViewport && window.visualViewport.height,
    visualOffsetTop: window.visualViewport && window.visualViewport.offsetTop,
    innerHeight: window.innerHeight,
    clientHeight: document.documentElement && document.documentElement.clientHeight,
    activeElement: document.activeElement,
  });
}

function viewportHeight() {
  return viewportState().height;
}

function updateViewportVars() {
  const viewport = viewportState();
  if (viewport.keyboardShrunk) {
    document.documentElement.style.setProperty("--app-height", `${viewport.height}px`);
  } else {
    document.documentElement.style.removeProperty("--app-height");
  }
  document.documentElement.classList.toggle("keyboard-open", viewport.keyboardShrunk);
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
  if (isHermesEmbedMode()) return false;
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

function escapeSelectorAttr(value) {
  const text = String(value ?? "");
  if (typeof CSS !== "undefined" && CSS && typeof CSS.escape === "function") return CSS.escape(text);
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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

function copyButtonHtml(copyKey, label, className = "") {
  if (!copyKey) return "";
  const classes = ["copy-button", className].filter(Boolean).join(" ");
  return `<button class="${escapeHtml(classes)}" type="button" data-copy-key="${escapeHtml(copyKey)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
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
  const text = state.copyTextStore.get(key || "");
  if (!text) return;
  await copyTextToClipboard(text);
  showCopyFeedback(button);
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

function sameLocalDate(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function formatCardTimestamp(ms, nowMs = Date.now()) {
  const value = Number(ms || 0);
  if (!Number.isFinite(value) || value <= 0) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameLocalDate(date, new Date(nowMs))) return time;
  return `${date.toLocaleDateString([], { month: "2-digit", day: "2-digit" })} ${time}`;
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

function threadDisplayName(thread) {
  return String(thread && (thread.name || thread.preview || thread.id || "") || "");
}

function isPwaMode() {
  return Boolean((window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
    || window.navigator.standalone);
}

function triggerCompletionHaptic() {
  if (!supportsCompletionHaptic()) return false;
  const visible = document.visibilityState === "visible";
  const inPwa = isPwaMode();
  if (!visible && !inPwa) return false;
  try {
    return navigator.vibrate([140, 70, 140]);
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
    const notes = audible
      ? [
        { at: 0, frequency: 523.25, duration: 0.11, peak: 0.038 },
        { at: 0.115, frequency: 659.25, duration: 0.15, peak: 0.032 },
      ]
      : [{ at: 0, frequency: 440, duration: 0.035, peak: 0.0001 }];
    notes.forEach((note) => {
      const startAt = nowAt + note.at;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(note.frequency, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.linearRampToValueAtTime(note.peak, startAt + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + note.duration);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(startAt);
      osc.stop(startAt + note.duration + 0.02);
      setTimeout(() => {
        osc.disconnect();
        gain.disconnect();
      }, Math.ceil((note.at + note.duration + 0.12) * 1000));
    });
  };
  if (audioContext.state === "suspended") {
    audioContext.resume()
      .then(() => {
        state.completionAudioUnlocked = true;
        playTone();
      })
      .catch(() => {});
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
  const title = String(threadName || threadDisplayName(state.threads.find((thread) => String(thread.id || "") === String(threadId || ""))) || threadId || "").trim();
  if (document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
    const notifier = new Notification("会话任务完成", {
      body: `${title || "会话"} 已完成，可切回查看`,
      tag: `codex-thread-complete-${threadId}`,
      renotify: false,
      silent: false,
      requireInteraction: false,
      vibrate: [90, 45, 90],
    });
    if (notifier && "addEventListener" in notifier) {
      notifier.onclick = () => {
        try {
          window.focus();
          $("app").scrollIntoView();
        } catch (_) {}
      };
    }
  }
  playCompletionTone({ audible: true });
}

function markThreadViewed(threadId) {
  const id = String(threadId || "");
  if (!id || !state.unreadThreadIds.has(id)) return;
  state.unreadThreadIds.delete(id);
  saveThreadStatusHints();
}

function updateThreadStatusHints(threadId, previousStatus, nextStatus, options = {}) {
  const id = String(threadId || "");
  if (!id) return;
  const wasRunning = state.runningThreadIds.has(id) || isRunningStatus(previousStatus);
  const isRunning = isRunningStatus(nextStatus);
  let changed = false;
  let shouldAlert = false;
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
      shouldAlert = true;
    }
  }
  if (changed) saveThreadStatusHints();
  if (shouldAlert && options.notify) {
    showCompletionAlert(id, options.threadName || threadDisplayName(options.thread));
  }
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

function rolloutWarningDismissKey(thread) {
  const threadId = String((thread && thread.id) || state.currentThreadId || "").trim();
  const size = rolloutSizeBytes(thread);
  return threadId && size > 0 ? `${threadId}|${size}` : "";
}

function isRolloutWarningDismissed(thread) {
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

function rolloutSizeText(thread) {
  const size = rolloutSizeBytes(thread);
  return size > 0 ? formatFileSize(size) : "";
}

function normalizeOptionList(values) {
  return runtimeSettings.normalizeOptionList(values);
}

function labelForModel(value) {
  return runtimeSettings.labelForModel(value);
}

function compactLabelForModel(value) {
  return runtimeSettings.compactLabelForModel(value);
}

function labelForEffort(value) {
  return runtimeSettings.labelForEffort(value);
}

function labelForPermissionMode(value) {
  return runtimeSettings.labelForPermissionMode(value);
}

function titleForPermissionMode(value) {
  return runtimeSettings.titleForPermissionMode(value);
}

function newThreadSelectedModel() {
  return runtimeSettings.selectedNewThreadModel({
    selected: state.newThreadModel,
    defaultValue: state.defaultModel,
    options: state.modelOptions,
  });
}

function newThreadSelectedEffort() {
  return runtimeSettings.selectedNewThreadEffort({
    selected: state.newThreadEffort,
    defaultValue: state.defaultReasoningEffort,
    options: state.reasoningEffortOptions,
  });
}

function newThreadSelectedPermissionMode() {
  return runtimeSettings.selectedNewThreadPermission({
    selected: state.newThreadPermissionMode,
    options: state.permissionModeOptions,
  });
}

function normalizePermissionModeValue(value) {
  return runtimeSettings.normalizePermissionModeValue(value);
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
  else if (limitId === "codex") {
    for (const model of normalizeOptionList([state.defaultModel, ...state.modelOptions])) {
      const modelKey = normalizeModelKey(model);
      if (modelKey && !isSparkModelKey(modelKey)) keys.add(modelKey);
    }
  }
  return [...keys];
}

function rememberRateLimits(rateLimits, rateLimitsByModel) {
  let changed = false;
  if (rateLimitsByModel && typeof rateLimitsByModel === "object") {
    for (const [model, value] of Object.entries(rateLimitsByModel)) {
      const key = normalizeModelKey(model);
      if (key && value && typeof value === "object" && hasCurrentRateLimitWindow(value)) {
        state.rateLimitsByModel[key] = value;
        changed = true;
      }
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
  renderQuotaUsage();
}

function rateLimitWindows(rateLimits) {
  return [rateLimits && rateLimits.primary, rateLimits && rateLimits.secondary]
    .filter((windowInfo) => windowInfo && Number.isFinite(Number(windowInfo.usedPercent)));
}

function hasCurrentRateLimitWindow(rateLimits) {
  const nowSeconds = Date.now() / 1000;
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
  const date = new Date(Number(seconds) * 1000);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatQuotaResetShort(seconds) {
  if (!seconds) return "--";
  const date = new Date(Number(seconds) * 1000);
  if (!Number.isFinite(date.getTime())) return "--";
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const resetDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayOffset = Math.round((resetDayStart - dayStart) / 86400000);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (dayOffset === 0) return time;
  if (dayOffset === 1) return `明天 ${time}`;
  if (dayOffset > 1 && dayOffset < 7) {
    return `${date.toLocaleDateString([], { weekday: "short" })} ${time}`;
  }
  return date.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function quotaRemainingText(windowInfo) {
  if (!windowInfo) return "--";
  const used = clampPercent(windowInfo.usedPercent);
  const remaining = clampPercent(100 - used);
  return `${Math.round(remaining)}%`;
}

function quotaRiskLevel(windowInfo, nearResetMinutes) {
  if (!windowInfo) return "unknown";
  const used = clampPercent(windowInfo.usedPercent);
  const remaining = clampPercent(100 - used);
  let risk = remaining > 50 ? 0 : remaining >= 30 ? 1 : 2;
  const resetMs = Number(windowInfo.resetsAt || 0) * 1000;
  const minutesToReset = resetMs ? (resetMs - Date.now()) / 60000 : Infinity;
  if (minutesToReset >= 0 && minutesToReset <= nearResetMinutes) risk = Math.max(0, risk - 1);
  return ["ok", "warn", "danger"][risk] || "unknown";
}

function quotaChipHtml(label, windowInfo, nearResetMinutes) {
  const status = quotaRiskLevel(windowInfo, nearResetMinutes);
  const remaining = quotaRemainingText(windowInfo);
  const reset = windowInfo ? formatQuotaResetShort(windowInfo.resetsAt) : "--";
  const compactLabel = label === "5小时" ? "5h" : label.replace("额度", "");
  return `<span class="quota-chip quota-${escapeHtml(status)}">`
    + `<span class="quota-chip-label">${escapeHtml(label)}</span>`
    + `<span class="quota-chip-compact-label">${escapeHtml(compactLabel)}</span>`
    + `<span class="quota-chip-main">`
    + `<span class="quota-chip-value">${escapeHtml(remaining)}</span>`
    + `<span class="quota-chip-reset"><span class="quota-chip-reset-prefix">重置 </span>${escapeHtml(reset)}</span>`
    + "</span>"
    + "</span>";
}

function quotaInlineHtml() {
  const rateLimits = rateLimitsForQuota();
  const fiveHour = fiveHourRateLimit(rateLimits);
  const weekly = weeklyRateLimit(rateLimits);
  const fiveStatus = quotaRiskLevel(fiveHour, 60);
  const weeklyStatus = quotaRiskLevel(weekly, 1440);
  return `<span class="quota-inline"><span class="quota-inline-part quota-${escapeHtml(fiveStatus)}"><span class="quota-inline-label">5h</span> <span class="quota-chip-value">${escapeHtml(quotaRemainingText(fiveHour))}</span></span><span class="quota-inline-sep">·</span><span class="quota-inline-part quota-${escapeHtml(weeklyStatus)}"><span class="quota-inline-label">周</span> <span class="quota-chip-value">${escapeHtml(quotaRemainingText(weekly))}</span></span></span>`;
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
  return selectedComposerModel();
}

function rateLimitsForQuota() {
  const modelKey = normalizeModelKey(selectedQuotaModel());
  if (modelKey && state.rateLimitsByModel[modelKey] && hasCurrentRateLimitWindow(state.rateLimitsByModel[modelKey])) {
    return state.rateLimitsByModel[modelKey];
  }
  if (isRateLimitCompatibleWithModel(state.rateLimits, modelKey)) return state.rateLimits;
  if (!modelKey) return null;
  return null;
}

function renderQuotaUsage() {
  const el = $("quotaUsage");
  if (!el) return;
  const rateLimits = rateLimitsForQuota();
  const fiveHour = fiveHourRateLimit(rateLimits);
  const weekly = weeklyRateLimit(rateLimits);
  const model = selectedQuotaModel();
  el.innerHTML = `<span class="composer-chip-label">额度</span><span class="composer-chip-value">${quotaInlineHtml()}</span>`;
  el.title = [
    model ? `model: ${labelForModel(model)}` : "",
    `${quotaTitle("5-hour", fiveHour)} | ${quotaTitle("weekly", weekly)}`,
  ].filter(Boolean).join("; ");
  el.classList.toggle("unknown", !fiveHour && !weekly);
  el.setAttribute("aria-expanded", state.quotaDetailsOpen ? "true" : "false");
  renderQuotaDetailPanel(fiveHour, weekly, model);
}

function quotaDetailLineHtml(label, windowInfo, nearResetMinutes) {
  const status = quotaRiskLevel(windowInfo, nearResetMinutes);
  const remaining = quotaRemainingText(windowInfo);
  const used = windowInfo ? clampPercent(windowInfo.usedPercent) : 0;
  const remainingPercent = clampPercent(100 - used);
  const reset = windowInfo ? formatQuotaResetShort(windowInfo.resetsAt) : "--";
  return `<div class="quota-detail-line quota-${escapeHtml(status)}">`
    + `<div class="quota-detail-meta"><span>${escapeHtml(label)}</span><small>重置 ${escapeHtml(reset)}</small></div>`
    + `<div class="quota-detail-track" aria-hidden="true"><span style="width:${escapeHtml(String(remainingPercent))}%"></span></div>`
    + `<strong class="quota-detail-value">${escapeHtml(remaining)}</strong>`
    + "</div>";
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
    `<div class="quota-detail-title"><span>额度</span><strong>${escapeHtml(model ? labelForModel(model) : "当前模型")}</strong></div>`,
    quotaDetailLineHtml("5小时额度", fiveHour, 60),
    quotaDetailLineHtml("周额度", weekly, 1440),
  ].join("");
}

function appVersionText(status = state.appUpdateStatus) {
  const version = String((status && status.version) || state.appVersion || "").trim();
  return version ? `v${version}` : "Version";
}

function renderAppUpdateStatus() {
  const el = $("appUpdateStatus");
  if (!el) return;
  const status = state.appUpdateStatus || {};
  const supported = status.supported !== false;
  const checking = state.appUpdateBusy && !state.appUpdateRestarting;
  const applying = Boolean(status.applying) || state.appUpdateRestarting;
  const blocked = Boolean(status.updateAvailable && !status.canFastForward);
  let label = appVersionText(status);
  let title = "Check for GitHub updates";
  if (state.appUpdateRestarting) {
    label = "等待重启…";
    title = "更新已应用。服务会退出并等待启动任务或守护脚本拉起；手动启动的部署需要在服务停止后手动重启。";
  } else if (applying) {
    label = "更新中…";
    title = "正在拉取更新";
  } else if (checking) {
    label = "检查更新…";
    title = "正在检查 GitHub 更新";
  } else if (status.updateAvailable && status.canFastForward) {
    label = `有更新 ${status.remoteShort || ""}`.trim();
    title = `发现 ${status.remote || "origin"}/${status.branch || "main"} 更新，点击后确认拉取；更新后服务会退出并依赖启动任务或守护脚本重启`;
  } else if (blocked) {
    label = "更新受阻";
    title = status.reason || status.error || "检测到更新，但当前工作区不能安全 fast-forward";
  } else if (status.error) {
    label = "更新检查失败";
    title = status.error;
  } else if (!supported) {
    title = status.reason || "当前安装方式不支持 Git 自动更新";
  } else if (status.localShort) {
    title = `${appVersionText(status)} (${status.localShort})，点击重新检查更新`;
  }
  el.textContent = label;
  el.title = title;
  el.classList.toggle("hidden", !state.appVersion && !state.appUpdateStatus);
  el.classList.toggle("available", Boolean(status.updateAvailable && status.canFastForward));
  el.classList.toggle("blocked", blocked || Boolean(status.error));
  el.classList.toggle("checking", checking || applying);
  el.disabled = state.appUpdateBusy || state.appUpdateRestarting;
}

async function refreshAppUpdateStatus(options = {}) {
  if (!state.key) return null;
  if (state.appUpdateBusy && !options.force) return state.appUpdateStatus;
  state.appUpdateBusy = true;
  if (!options.silent) renderAppUpdateStatus();
  try {
    const params = new URLSearchParams();
    if (options.fetch) params.set("fetch", "1");
    if (options.force) params.set("force", "1");
    const status = await api(`/api/app-update/status${params.toString() ? `?${params.toString()}` : ""}`, {
      timeoutMs: options.fetch ? 25000 : 12000,
    });
    state.appUpdateStatus = status;
    state.appUpdateError = status && status.error ? status.error : "";
    return status;
  } catch (err) {
    state.appUpdateError = err.message || String(err);
    state.appUpdateStatus = Object.assign({}, state.appUpdateStatus || {}, {
      version: state.appVersion,
      error: state.appUpdateError,
    });
    return state.appUpdateStatus;
  } finally {
    state.appUpdateBusy = false;
    renderAppUpdateStatus();
  }
}

function scheduleStartupUpdateCheck() {
  if (!state.key) return;
  window.setTimeout(() => {
    refreshAppUpdateStatus({ fetch: true, force: true, silent: true }).catch(() => {});
  }, 900);
}

function publicPrPromptKey(status) {
  if (!status || !status.hasOpenPullRequests) return "";
  const pullRequests = Array.isArray(status.pullRequests) ? status.pullRequests : [];
  const marker = pullRequests
    .map((pr) => `#${pr.number || ""}:${pr.updatedAt || ""}`)
    .filter(Boolean)
    .join("|");
  return `${status.repository || ""}|${status.openPullRequestCount || pullRequests.length}|${marker}`;
}

function publicPrSummaryText(status) {
  const pullRequests = Array.isArray(status && status.pullRequests) ? status.pullRequests : [];
  if (!pullRequests.length) return "";
  return pullRequests
    .map((pr) => `#${pr.number} ${pr.title || ""}`.trim())
    .join("; ");
}

function renderPublicPrStatus() {
  const el = $("publicPrStatus");
  if (!el) return;
  const status = state.publicPrStatus || {};
  const enabled = state.publicPrEnabled && status.enabled !== false;
  const checking = state.publicPrBusy || Boolean(status.checking);
  const hasPrs = Boolean(status.hasOpenPullRequests);
  const blocked = Boolean(status.error || status.supported === false);
  let label = "Public PR";
  let title = state.publicPrRepository ? `Check ${state.publicPrRepository} pull requests` : "Check public pull requests";
  if (checking) {
    label = "PR...";
    title = "Checking public pull requests";
  } else if (hasPrs) {
    label = `PR ${status.openPullRequestCount || (status.pullRequests || []).length}`;
    title = `Open public PRs: ${publicPrSummaryText(status) || label}`;
  } else if (status.checkedAt && enabled) {
    label = "No PR";
    title = `No open public PRs in ${status.repository || state.publicPrRepository || "public repo"}`;
  } else if (blocked) {
    label = "PR ?";
    title = status.error || status.reason || "Public PR check is unavailable";
  }
  el.textContent = label;
  el.title = title;
  el.classList.toggle("hidden", !enabled && !status.error);
  el.classList.toggle("available", hasPrs);
  el.classList.toggle("blocked", blocked);
  el.classList.toggle("checking", checking);
  el.disabled = state.publicPrBusy;
}

async function refreshPublicPrStatus(options = {}) {
  if (!state.key || !state.publicPrEnabled) return null;
  if (state.publicPrBusy && !options.force) return state.publicPrStatus;
  state.publicPrBusy = true;
  if (!options.silent) renderPublicPrStatus();
  try {
    const params = new URLSearchParams();
    if (options.force) params.set("force", "1");
    const status = await api(`/api/public-pull-requests/status${params.toString() ? `?${params.toString()}` : ""}`, {
      timeoutMs: 18000,
    });
    state.publicPrStatus = status;
    state.publicPrError = status && status.error ? status.error : "";
    if (!options.skipPrompt) maybePromptPublicPrMerge(status);
    return status;
  } catch (err) {
    state.publicPrError = err.message || String(err);
    state.publicPrStatus = Object.assign({}, state.publicPrStatus || {}, {
      enabled: state.publicPrEnabled,
      repository: state.publicPrRepository,
      error: state.publicPrError,
    });
    return state.publicPrStatus;
  } finally {
    state.publicPrBusy = false;
    renderPublicPrStatus();
  }
}

function scheduleStartupPublicPrCheck() {
  if (!state.key || !state.publicPrEnabled) return;
  window.setTimeout(() => {
    refreshPublicPrStatus({ force: true, silent: true }).catch(() => {});
  }, 1600);
}

function publicPrMergeInstruction(status) {
  const summary = publicPrSummaryText(status);
  const repository = status && status.repository || state.publicPrRepository || "pentiumxp/codex-mobile-web-public";
  return [
    `请检查 public 仓库 ${repository} 的开放 PR${summary ? `：${summary}` : ""}。`,
    "按当前项目规则先评估 PR 是否可合并；如要合并，更新 public README 的中文发布说明，运行验证和隐私扫描，再提交并推送 public。",
    "不要复制 .agent-context、runtime state、本地密钥、上传内容或机器特定诊断。完成 public 后再同步回 private 并重新验证。",
  ].join("\n");
}

function preparePublicPrMergePrompt(status) {
  const text = publicPrMergeInstruction(status);
  if (composerHasContent()) {
    window.alert("检测到 public 开放 PR，但输入框已有内容。请处理当前草稿后点击 Public PR 按钮。");
    return;
  }
  const workspacePath = String(state.appWorkspacePath || state.selectedCwd || (state.currentThread && state.currentThread.cwd) || "").trim();
  if (!workspacePath) {
    setComposerText(text);
    scheduleCurrentDraftSave();
    updateComposerControls();
    return;
  }
  saveCurrentDraftNow();
  clearCurrentThreadSelection({ saveDraft: false });
  state.selectedCwd = workspacePath;
  state.newThreadDraft = true;
  state.sendButtonHint = "";
  restoreDraftForCurrentTarget();
  setComposerText(text);
  syncSidebarWorkspaceSelect();
  updateWorkspacePath();
  renderThreads();
  renderCurrentThread();
  updateComposerControls();
  scheduleCurrentDraftSave();
  if (isMenuOverlayMode()) closeSidebarMenu();
}

function rememberPublicPrPrompt(status) {
  const key = publicPrPromptKey(status);
  if (!key) return;
  state.publicPrPromptedKey = key;
  localStorage.setItem(STORAGE_PUBLIC_PR_PROMPT, key);
}

function maybePromptPublicPrMerge(status) {
  if (!status || !status.hasOpenPullRequests) return;
  const key = publicPrPromptKey(status);
  if (!key || key === state.publicPrPromptedKey) return;
  const confirmed = window.confirm([
    `检测到 public 仓库有 ${status.openPullRequestCount || (status.pullRequests || []).length} 个开放 PR。`,
    publicPrSummaryText(status),
    "",
    "是否准备一条合并/发布检查任务？",
  ].filter(Boolean).join("\n"));
  rememberPublicPrPrompt(status);
  if (confirmed) preparePublicPrMergePrompt(status);
}

async function handlePublicPrStatusClick() {
  if (state.publicPrBusy) return;
  let status = state.publicPrStatus;
  if (!status || !status.checkedAt || status.error) {
    status = await refreshPublicPrStatus({ force: true, skipPrompt: true });
  }
  if (!status) return;
  if (status.error && !status.hasOpenPullRequests) {
    window.alert(`public PR 检查失败：${status.error}`);
    return;
  }
  if (!status.hasOpenPullRequests) {
    window.alert("当前未检测到 public 开放 PR。");
    return;
  }
  const confirmed = window.confirm([
    `检测到 public 仓库有 ${status.openPullRequestCount || (status.pullRequests || []).length} 个开放 PR。`,
    publicPrSummaryText(status),
    "",
    "是否准备一条合并/发布检查任务？",
  ].filter(Boolean).join("\n"));
  rememberPublicPrPrompt(status);
  if (confirmed) preparePublicPrMergePrompt(status);
}

async function handleAppUpdateClick() {
  if (state.appUpdateBusy || state.appUpdateRestarting) return;
  let status = state.appUpdateStatus;
  if (!status || (!status.updateAvailable && !status.error)) {
    status = await refreshAppUpdateStatus({ fetch: true, force: true });
  }
  if (!status) return;
  if (status.supported === false) {
    window.alert(`当前安装方式不支持自动更新：${status.reason || "没有可用的 Git 远程分支"}`);
    return;
  }
  if (status.error && !status.updateAvailable) {
    window.alert(`更新检查失败：${status.error}`);
    return;
  }
  if (!status.updateAvailable) {
    window.alert("当前已经是最新版本。");
    return;
  }
  if (!status.canFastForward) {
    window.alert(`检测到更新，但不能自动应用：${status.reason || status.error || "当前工作区不是干净的 fast-forward 状态"}`);
    return;
  }
  const confirmed = window.confirm([
    "发现 GitHub 更新。是否拉取并重启 Mobile Web？",
    "",
    "仅在当前仓库干净、可 fast-forward 时执行；运行时数据和 Access Key 不会被覆盖。",
    "更新完成后当前 Node 服务会退出。只有通过 Windows 启动任务、windowless supervisor 或 macOS shared launcher 运行时才会自动拉起；手动运行 node/npm start 的部署需要手动重启。",
  ].join("\n"));
  if (!confirmed) return;
  state.appUpdateBusy = true;
  renderAppUpdateStatus();
  try {
    const result = await api("/api/app-update/apply", {
      method: "POST",
      body: "{}",
      timeoutMs: 150000,
    });
    state.appUpdateStatus = result.after || result.status || status;
    if (result.updated) {
      state.appUpdateRestarting = true;
      $("connectionState").textContent = "更新已应用；如连接断开且未自动恢复，请在部署机手动重启";
      renderAppUpdateStatus();
      window.setTimeout(() => window.location.reload(), Math.max(1800, Number(result.restartInMs || 1200) + 900));
    } else {
      window.alert("当前已经是最新版本。");
    }
  } catch (err) {
    state.appUpdateError = err.message || String(err);
    state.appUpdateStatus = Object.assign({}, status || {}, {
      error: state.appUpdateError,
    });
    showError(err);
  } finally {
    state.appUpdateBusy = false;
    renderAppUpdateStatus();
  }
}

function renderSharedRestartButton() {
  const el = $("sharedRestartButton");
  if (!el) return;
  const restarting = state.sharedRestarting;
  el.textContent = restarting ? "Restarting" : "Restart";
  el.title = restarting ? "Mobile Web is restarting" : "Restart Mobile Web shared chain";
  el.disabled = state.sharedRestartBusy || restarting;
  el.classList.toggle("checking", state.sharedRestartBusy || restarting);
}

async function handleSharedRestartClick() {
  if (state.sharedRestartBusy || state.sharedRestarting) return;
  const isMac = state.serverPlatform === "darwin";
  const scopeLines = isMac
    ? [
      "这会短暂断开当前页面连接，并重启这台 Mac 上的 Mobile Web 服务。",
      "不会重启 Codex Desktop、shared mux 或其它本机服务。",
    ]
    : [
      "这会短暂断开当前页面连接，并重启 Mobile Web、shared mux 和本地 app-server。",
      "不会重启 WSL、Codex Desktop 或其它本机服务。",
    ];
  const confirmed = window.confirm([
    "确认重启 Codex Mobile Web？",
    "",
    ...scopeLines,
  ].join("\n"));
  if (!confirmed) return;
  state.sharedRestartBusy = true;
  renderSharedRestartButton();
  try {
    const result = await api("/api/restart/shared-chain", {
      method: "POST",
      body: "{}",
      timeoutMs: 12000,
    });
    state.sharedRestarting = true;
    state.sharedRestartBusy = false;
    showReconnectRefreshPrompt("restart");
    const connection = $("connectionState");
    if (connection) connection.textContent = "Restarting";
    renderSharedRestartButton();
    window.setTimeout(() => {
      refreshPageForNewBuild().catch(showError);
    }, Math.max(1800, Number(result.restartInMs || 900) + 1200));
  } catch (err) {
    state.sharedRestartBusy = false;
    renderSharedRestartButton();
    showError(err);
  }
}

function serverBuildIdFromConfig(config) {
  return String(config && (config.clientBuildId || config.shellCacheName || config.buildId || config.version) || "").trim();
}

function pageShellAssetUrl(asset, buildId) {
  const url = new URL(asset, window.location.origin);
  url.searchParams.set("shellBuild", buildId || "current");
  url.searchParams.set("shellCheck", String(Date.now()));
  return url.href;
}

function validatePageShellAsset(asset, text, config) {
  const buildId = serverBuildIdFromConfig(config);
  const shellCacheName = String(config && config.shellCacheName || "").trim();
  if (asset === "/" || asset === "/index.html") {
    return text.includes('href="/styles.css"') && text.includes('src="/app.js"');
  }
  if (asset === "/styles.css") {
    return text.includes(".app") && text.includes(".composer");
  }
  if (asset === "/app.js") {
    return !buildId || text.includes(buildId) || text.includes(shellCacheName);
  }
  if (asset === "/sw.js") {
    return !shellCacheName || text.includes(shellCacheName);
  }
  return true;
}

async function fetchPageShellAsset(asset, config) {
  const response = await fetch(pageShellAssetUrl(asset, serverBuildIdFromConfig(config)), {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(`page shell asset unavailable: ${asset}`);
  }
  if (asset === "/" || asset.endsWith(".html") || asset.endsWith(".css") || asset.endsWith(".js") || asset.endsWith(".json") || asset.endsWith(".svg")) {
    const text = await response.clone().text();
    if (!validatePageShellAsset(asset, text, config)) {
      throw new Error(`page shell asset stale: ${asset}`);
    }
  }
  return response;
}

async function preparePageShellAssets(config, options = {}) {
  const populateCache = Boolean(options.populateCache);
  const shellCacheName = String(config && config.shellCacheName || "").trim();
  const cache = populateCache && shellCacheName && "caches" in window
    ? await window.caches.open(shellCacheName)
    : null;
  for (const asset of PAGE_SHELL_ASSETS) {
    const response = await fetchPageShellAsset(asset, config);
    if (cache) await cache.put(asset, response.clone());
  }
}

async function fetchPageBuildConfig() {
  const response = await fetch(`/api/public-config?buildCheck=${Date.now()}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) return null;
  return response.json();
}

async function pruneOldShellCaches(expectedCacheName) {
  if (!expectedCacheName || !("caches" in window)) return;
  const keys = await window.caches.keys();
  await Promise.all(keys
    .filter((key) => String(key || "").startsWith("codex-mobile-shell-") && key !== expectedCacheName)
    .map((key) => window.caches.delete(key)));
}

function initializePageBuildState(config) {
  state.serverBuildId = CLIENT_BUILD_ID || serverBuildIdFromConfig(config);
  state.serverAssetBuildId = String(config && config.buildId || "").trim();
  const currentServerBuildId = serverBuildIdFromConfig(config);
  if (state.serverBuildId && currentServerBuildId && currentServerBuildId !== state.serverBuildId) {
    state.pageRefreshBuildId = currentServerBuildId;
    schedulePageRefreshCheck(0, { force: true });
  }
  renderPageRefreshPrompt();
}

function renderPageRefreshPrompt() {
  const el = $("pageRefreshPrompt");
  if (!el) return;
  if (isHermesEmbedMode()) {
    el.classList.add("hidden");
    el.disabled = false;
    return;
  }
  const restarting = state.pageRefreshReason === "restart";
  const reconnecting = state.pageRefreshReason === "reconnect" || restarting;
  el.classList.toggle("hidden", !state.pageRefreshAvailable && !state.pageRefreshReloading);
  el.disabled = state.pageRefreshReloading;
  if (state.pageRefreshReloading) {
    el.textContent = restarting ? "正在等待服务恢复…" : reconnecting ? "正在刷新并重连…" : "正在刷新页面…";
  } else {
    el.textContent = restarting ? "服务重启中，点击刷新并重连" : reconnecting ? "连接中断，点击刷新并重连" : "页面有新版本，点击刷新";
  }
  el.title = restarting
    ? "Mobile Web 服务恢复后会刷新页面并重新连接"
    : reconnecting
    ? "当前连接中断；点击后会等待 Mobile Web 恢复并重新连接"
    : state.pageRefreshBuildId
    ? `服务端版本已变为 ${state.pageRefreshBuildId}，点击刷新页面`
    : "服务端页面资源已更新，点击刷新页面";
}

function showReconnectRefreshPrompt(reason = "reconnect") {
  if (state.pageRefreshReloading) return;
  state.pageRefreshAvailable = true;
  state.pageRefreshReason = reason === "restart" ? "restart" : "reconnect";
  state.pageRefreshPreparedConfig = null;
  renderPageRefreshPrompt();
}

function clearReconnectRefreshPrompt() {
  if (state.pageRefreshReason !== "reconnect" || state.pageRefreshReloading) return;
  state.pageRefreshAvailable = false;
  state.pageRefreshReason = "";
  state.pageRefreshPreparedConfig = null;
  renderPageRefreshPrompt();
}

async function checkPageRefreshAvailability(options = {}) {
  if (state.pageRefreshReloading) return;
  const now = Date.now();
  if (state.pageRefreshBusy) return;
  if (!options.force && now - state.pageRefreshLastCheckAt < PAGE_REFRESH_MIN_CHECK_INTERVAL_MS) return;
  state.pageRefreshBusy = true;
  state.pageRefreshLastCheckAt = now;
  try {
    const config = await fetchPageBuildConfig();
    if (!config) return;
    const nextBuildId = serverBuildIdFromConfig(config);
    const nextAssetBuildId = String(config && config.buildId || "").trim();
    if (!state.serverBuildId) {
      state.serverBuildId = CLIENT_BUILD_ID || nextBuildId;
      state.serverAssetBuildId = nextAssetBuildId;
      return;
    }
    const clientChanged = Boolean(nextBuildId && nextBuildId !== state.serverBuildId);
    const assetsChanged = Boolean(nextAssetBuildId && state.serverAssetBuildId && nextAssetBuildId !== state.serverAssetBuildId);
    if (clientChanged || assetsChanged) {
      if (isHermesEmbedMode()) {
        state.pageRefreshBuildId = nextBuildId;
        state.pageRefreshReason = "build";
        requestHermesPluginRefresh("server_build_changed", { force: true });
        return;
      }
      await preparePageShellAssets(config, { populateCache: true });
      state.pageRefreshAvailable = true;
      state.pageRefreshReason = "build";
      state.pageRefreshBuildId = nextBuildId;
      state.pageRefreshPreparedConfig = config;
      renderPageRefreshPrompt();
    }
  } catch (_) {
    // Version checks are best-effort; normal API connection state handles real failures.
  } finally {
    state.pageRefreshBusy = false;
  }
}

function schedulePageRefreshCheck(delayMs = 0, options = {}) {
  window.setTimeout(() => {
    checkPageRefreshAvailability(options).catch(() => {});
  }, Math.max(0, Number(delayMs || 0)));
}

function startPageRefreshChecks() {
  if (state.pageRefreshTimer) clearInterval(state.pageRefreshTimer);
  state.pageRefreshTimer = window.setInterval(() => {
    if (document.visibilityState === "hidden") return;
    checkPageRefreshAvailability({ silent: true }).catch(() => {});
  }, PAGE_REFRESH_CHECK_INTERVAL_MS);
}

async function waitForPageBuildConfig(timeoutMs = 18000) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const config = await fetchPageBuildConfig();
      if (config) return config;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  throw lastError || new Error("Mobile Web is still unavailable");
}

async function refreshPageForNewBuild() {
  if (state.pageRefreshReloading) return;
  if (isHermesEmbedMode()) {
    requestHermesPluginRefresh("server_build_changed", { force: true });
    return;
  }
  state.pageRefreshReloading = true;
  renderPageRefreshPrompt();
  saveCurrentDraftNow();
  let config = state.pageRefreshPreparedConfig;
  try {
    const reconnectRefresh = state.pageRefreshReason === "reconnect" || state.pageRefreshReason === "restart";
    const latestConfig = reconnectRefresh
      ? await waitForPageBuildConfig()
      : await fetchPageBuildConfig();
    if (latestConfig) config = latestConfig;
    if (!config) throw new Error("page refresh build config unavailable");
    if (config) await preparePageShellAssets(config, { populateCache: true });
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && registration.update) await registration.update();
    }
    await pruneOldShellCaches(String(config && config.shellCacheName || "").trim());
    window.location.reload();
  } catch (_) {
    state.pageRefreshReloading = false;
    state.pageRefreshPreparedConfig = null;
    if (state.pageRefreshReason !== "reconnect" && state.pageRefreshReason !== "restart") {
      state.pageRefreshAvailable = false;
      state.pageRefreshReason = "";
    }
    renderPageRefreshPrompt();
    schedulePageRefreshCheck(5000, { force: true });
  }
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

function draftKeyForThread(threadId) {
  return draftStore.keyForThread(threadId);
}

function draftKeyForNewThread(cwd) {
  return draftStore.keyForNewThread(cwd);
}

function currentDraftKey() {
  if (state.newThreadDraft) return draftKeyForNewThread(state.selectedCwd);
  return draftKeyForThread(state.currentThreadId);
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
  const map = readDraftMap();
  const draft = buildCurrentDraft();
  if (draftHasContent(draft)) {
    map[key] = draft;
    if (key.startsWith("new:")) draftStore.setTargetKey(key);
  } else {
    delete map[key];
    draftStore.clearTargetKeyIfMatches(key);
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
  return "full";
}

function applyDraftRuntimeSelection(draft) {
  const model = String(draft && draft.model || "");
  const effort = String(draft && draft.effort || "");
  const permission = normalizePermissionModeValue(draft && draft.permissionMode);
  if (state.newThreadDraft) {
    state.newThreadModel = model && state.modelOptions.includes(model) ? model : defaultNewThreadModel();
    state.newThreadEffort = effort && state.reasoningEffortOptions.includes(effort) ? effort : defaultNewThreadEffort();
    state.newThreadPermissionMode = permission || defaultNewThreadPermissionMode();
    return;
  }
  state.composerModel = model && state.modelOptions.includes(model) ? model : "";
  state.composerEffort = effort && state.reasoningEffortOptions.includes(effort) ? effort : "";
  state.composerPermissionMode = permission && state.permissionModeOptions.includes(permission) ? permission : "";
}

function replacePendingAttachments(items, options = {}) {
  for (const item of state.pendingAttachments) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }
  state.pendingAttachments = Array.isArray(items) ? items : [];
  renderAttachmentList();
  if (options.saveDraft !== false) scheduleCurrentDraftSave();
}

function restoreDraftForCurrentTarget() {
  clearTimeout(state.draftSaveTimer);
  state.draftSaveTimer = null;
  const key = currentDraftKey();
  const draft = key ? readDraftMap()[key] : null;
  const restoreSeq = state.draftRestoreSeq + 1;
  state.draftRestoreSeq = restoreSeq;
  setComposerText(draft && draft.text ? draft.text : "");
  applyDraftRuntimeSelection(draft || null);
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
  if (state.selectedCwd && cwd !== normalizeFsPath(state.selectedCwd)) return true;
  const keys = visibleWorkspaceKeys();
  if (keys.size > 0 && cwd && !keys.has(cwd)) return true;
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
  const latest = turns.length ? turns[turns.length - 1] : null;
  const running = latest && !isTurnComplete(latest) && isRunningStatus(latest.status) ? latest : null;
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

function contextCompactionStatusKind(value) {
  const text = statusText(value).toLowerCase();
  if (!text) return "";
  if (/completed|failed|cancel|error|interrupted/.test(text)) return "complete";
  if (/running|active|queued|processing|inprogress|in_progress|in-progress|pending|started/.test(text)) return "pending";
  return "";
}

function canShowPendingContextCompaction(turn = null) {
  return !turn || (isLatestTurn(turn) && isLiveTurn(turn));
}

function contextCompactionState(item, turn = null) {
  if (!item) return "";
  const itemKind = contextCompactionStatusKind(item.status);
  const mobileKind = contextCompactionStatusKind(item.mobileCompactionStatus);
  if (itemKind === "complete" || mobileKind === "complete" || item.mobileNotice === CONTEXT_COMPACTION_COMPLETE_NOTICE) return "complete";
  if (itemKind === "pending" || mobileKind === "pending" || item.mobileNotice === CONTEXT_COMPACTION_PENDING_NOTICE) {
    return canShowPendingContextCompaction(turn) ? "pending" : "";
  }
  return "";
}

function contextCompactionNotice(item, turn = null) {
  const stateText = contextCompactionState(item, turn);
  if (stateText === "pending") return CONTEXT_COMPACTION_PENDING_NOTICE;
  if (stateText === "complete") return CONTEXT_COMPACTION_COMPLETE_NOTICE;
  return "";
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
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "thread";
  const turnId = turn && (turn.id || turn.startedAt || "turn");
  const groupKey = operationGroupKey(item) || `item:${item && (item.id || index)}`;
  return ["live-operation", threadId, turnId, groupKey].map((part) => String(part || "")).join("|");
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

function isNodeStartAboveConversationViewport(node) {
  const conversation = $("conversation");
  if (!conversation || !node) return false;
  const viewport = conversation.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  return rect.top < viewport.top + 24;
}

function visibleItemsForTurn(turn) {
  const showOperations = isLatestTurn(turn) && isLiveTurn(turn);
  const visible = [];
  let latestOperationEntry = null;
  const contextEntryByKey = new Map();
  (turn.items || []).forEach((item, index) => {
    if (!item || isReasoningItem(item)) return;
    if (isContextCompactionItem(item)) {
      const notice = contextCompactionNotice(item, turn);
      if (!notice) return;
      const groupKey = "context-compaction";
      const existing = contextEntryByKey.get(groupKey);
      if (existing) visible[existing.visibleIndex] = null;
      contextEntryByKey.set(groupKey, { visibleIndex: visible.length });
      visible.push({ item, sourceIndex: index });
      return;
    }
    if (isOperationalItem(item)) {
      if (!showOperations) return;
      if (latestOperationEntry) visible[latestOperationEntry.visibleIndex] = null;
      latestOperationEntry = { visibleIndex: visible.length, sourceIndex: index };
      visible.push({ item, sourceIndex: index });
      return;
    }
    visible.push({ item, sourceIndex: index });
  });
  return visible.filter(Boolean);
}

function visibleItemSignature(item, turn = null) {
  if (!item || isReasoningItem(item)) return null;
  if (isContextCompactionItem(item)) {
    const notice = contextCompactionNotice(item, turn);
    if (!notice) return null;
    return {
      id: item.id || "",
      type: item.type || "",
      status: statusText(item.status),
      mobileCompactionStatus: item.mobileCompactionStatus || "",
      mobileNotice: item.mobileNotice || "",
      notice,
    };
  }
  if (isOperationalItem(item)) {
    return {
      id: item.id || "",
      type: item.type || "",
      status: statusText(item.status),
      startedAtMs: item.startedAtMs || item.startedAt || item.started_at_ms || item.started_at || "",
      completedAtMs: item.completedAtMs || item.completedAt || item.completed_at_ms || item.completed_at || "",
      durationMs: item.durationMs || item.duration_ms || item.elapsedMs || item.elapsed_ms || "",
      command: item.command || "",
      fileNames: Array.isArray(item.fileNames) ? item.fileNames : [],
      tool: item.tool || "",
      server: item.server || "",
      namespace: item.namespace || "",
      detail: operationDetailText(item),
    };
  }
  if (item.type === "turnUsageSummary") {
    return {
      id: item.id || "",
      type: item.type || "",
      status: statusText(item.status),
      mobileUsageSummary: item.mobileUsageSummary || {},
    };
  }
  if (item.type === "imageView") {
    return {
      id: item.id || "",
      type: item.type || "",
      status: statusText(item.status),
      path: imageViewPath(item),
      contentUrl: imageSourceSignature(imageViewContentUrl(item)),
      url: imageSourceSignature(imageViewUrl(item)),
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
    if (isInputTextPart(part)) return { type: "text", text: inputTextValue(part) };
    if (isInputImagePart(part)) {
      return {
        type: part.type || "image",
        path: part.path || "",
        url: imageSourceSignature(imageUrlValue(part)),
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
  if (isContextCompactionItem(existingItem) || isContextCompactionItem(incomingItem)) {
    if (!Object.prototype.hasOwnProperty.call(incomingItem, "mobileNotice")) delete merged.mobileNotice;
    if (!Object.prototype.hasOwnProperty.call(incomingItem, "mobileCompactionStatus")) delete merged.mobileCompactionStatus;
  } else if (existingItem.mobileNotice) {
    merged.mobileNotice = existingItem.mobileNotice;
  }
  if (isOperationalItem(existingItem)) {
    if (existingItem.command) merged.command = existingItem.command;
    if (Array.isArray(existingItem.fileNames)) merged.fileNames = existingItem.fileNames;
    if (existingItem.tool) merged.tool = existingItem.tool;
    if (existingItem.server) merged.server = existingItem.server;
    if (existingItem.namespace) merged.namespace = existingItem.namespace;
  }
  return merged;
}

function mergeVisibleTextItemPreservingRenderIdentity(existingItem, incomingItem) {
  const merged = mergeItemPreservingVisibleFields(existingItem, incomingItem);
  if (!existingItem || !incomingItem || !merged || !visibleTextItemsLikelySame(existingItem, incomingItem)) return merged;
  if (existingItem.id) merged.id = existingItem.id;
  if (existingItem.startedAtMs && !incomingItem.startedAtMs) merged.startedAtMs = existingItem.startedAtMs;
  return merged;
}

function mergeItemsPreservingLocalVisible(existingItems, incomingItems, preserveLocalVisible = false) {
  const incomingById = new Map((incomingItems || [])
    .filter((item) => item && item.id)
    .map((item) => [item.id, item]));
  const added = new Set();
  const addedIncomingItems = new Set();
  const merged = [];
  for (const existingItem of existingItems || []) {
    if (!existingItem) continue;
    const id = existingItem.id;
    if (id && incomingById.has(id)) {
      const incomingMatch = incomingById.get(id);
      merged.push(mergeItemPreservingVisibleFields(existingItem, incomingMatch));
      added.add(id);
      addedIncomingItems.add(incomingMatch);
    } else if (hasMatchingIncomingVisibleItem(existingItem, incomingItems)) {
      const incomingUserMatch = (incomingItems || []).find((incomingItem) => incomingItem
        && incomingItem.id !== id
        && incomingItem.type === "userMessage"
        && existingItem.type === "userMessage"
        && userMessagesLikelySame(existingItem, incomingItem));
      const incomingTextMatch = incomingUserMatch
        ? null
        : (incomingItems || []).find((incomingItem) => visibleTextItemsLikelySame(existingItem, incomingItem));
      if (incomingUserMatch) {
        merged.push(mergeItemPreservingVisibleFields(existingItem, incomingUserMatch));
        if (incomingUserMatch.id) added.add(incomingUserMatch.id);
        addedIncomingItems.add(incomingUserMatch);
      } else if (incomingTextMatch) {
        merged.push(mergeVisibleTextItemPreservingRenderIdentity(existingItem, incomingTextMatch));
        if (incomingTextMatch.id) added.add(incomingTextMatch.id);
        addedIncomingItems.add(incomingTextMatch);
      }
      if (id) added.add(id);
    } else if (shouldPreserveLocalOnlyItem(existingItem, preserveLocalVisible)) {
      merged.push(existingItem);
      if (id) added.add(id);
    }
  }
  for (const incomingItem of incomingItems || []) {
    if (!incomingItem) continue;
    if (addedIncomingItems.has(incomingItem)) continue;
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
  const latestIncoming = merged.turns.length ? merged.turns[merged.turns.length - 1] : null;
  for (const existingTurn of existingTurns) {
    if (!existingTurn || incomingIds.has(existingTurn.id)) continue;
    if (turnIsSupersededBy(existingTurn, latestIncoming)) continue;
    if (existingTurn.id === state.activeTurnId || (!isTurnComplete(existingTurn) && turnVisibleWeight(existingTurn) > 0)) {
      merged.turns.push(existingTurn);
    }
  }
  return merged;
}

function turnOrderMs(turn) {
  if (!turn) return 0;
  return numericTimestampMs(turn.completedAtMs)
    || numericTimestampMs(turn.completedAt)
    || numericTimestampMs(turn.completed_at_ms)
    || numericTimestampMs(turn.completed_at)
    || numericTimestampMs(turn.startedAtMs)
    || numericTimestampMs(turn.startedAt)
    || numericTimestampMs(turn.started_at_ms)
    || numericTimestampMs(turn.started_at)
    || 0;
}

function turnIsSupersededBy(turn, newerTurn) {
  if (!turn || !newerTurn || turn.id === newerTurn.id) return false;
  const left = turnOrderMs(turn);
  const right = turnOrderMs(newerTurn);
  if (left && right) return right > left;
  return isTurnComplete(newerTurn) && !isTurnComplete(turn);
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

function threadTaskCardsForThread(thread) {
  const cards = Array.isArray(thread && thread.threadTaskCards) ? thread.threadTaskCards : [];
  return cards
    .filter((card) => String(card && card.status || "") === "pending")
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

function conversationRenderSignature(thread) {
  if (!thread) return "home";
  if (thread.mobileLoadError) return `load-error|${state.currentThreadId || thread.id || ""}|${thread.mobileLoadError}`;
  if (thread.mobileLoading) return `loading|${state.currentThreadId || thread.id || ""}`;
  const turns = (thread.turns || []).slice(-MAX_VISIBLE_TURNS);
  const omitted = Number(thread.mobileOmittedTurnCount || 0) + Math.max(0, (thread.turns || []).length - turns.length);
  const payload = {
    threadId: state.currentThreadId || thread.id || "",
    pluginRefreshPendingNotice: String(state.pluginRefreshPendingNotice || ""),
    rolloutSizeBytes: rolloutSizeBytes(thread),
    rolloutWarning: isRolloutOverThreshold(thread),
    rolloutWarningDismissed: isRolloutWarningDismissed(thread),
    rolloutWarningThresholdBytes: rolloutThresholdBytes(thread),
    omitted,
    approvals: approvalRequestsSignature(state.currentThreadId || thread.id || ""),
    taskCards: threadTaskCardsSignature(thread),
    turns: turns.map((turn) => {
      const timerShowsStatus = isLatestTurn(turn) && (isLiveTurn(turn) || turnFinalSeconds(turn) != null);
      return {
        id: turn.id || "",
        statusLine: timerShowsStatus ? "" : displayTurnStatus(turn),
        durationMs: timerShowsStatus ? "" : (turn.durationMs || ""),
        items: visibleItemsForTurn(turn).map((entry) => ({
          sourceIndex: entry.sourceIndex,
          item: visibleItemSignature(entry.item, turn),
        })).filter((entry) => entry.item),
      };
    }),
  };
  return JSON.stringify(payload);
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
  const latest = turns.length ? turns[turns.length - 1] : null;
  if (state.activeTurnId) {
    const active = latest && latest.id === state.activeTurnId ? latest : null;
    if (active && isLiveTurn(active)) return active;
  }
  return latest && isLiveTurn(latest) ? latest : null;
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
  updateOperationDurationBadges();
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

async function api(path, options = {}) {
  return apiClient.request(path, options);
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

function nowPerfMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function roundedDurationMs(startedAt) {
  return Math.max(0, Math.round(nowPerfMs() - Number(startedAt || 0)));
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
  if (state.serviceWorkerRegistration && state.serviceWorkerRegistration.update) {
    state.serviceWorkerRegistration.update().catch(() => {});
  }
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

function isHermesEmbedMode() {
  return Boolean(state.pluginEmbed && state.pluginEmbed.embedded);
}

function normalizePluginParentOrigin(value) {
  const origin = String(value || "").trim();
  if (origin && origin !== "*") return origin;
  const referrerOrigin = pluginEmbedApi.parentOriginFromReferrer
    ? pluginEmbedApi.parentOriginFromReferrer(document.referrer)
    : "";
  return String(referrerOrigin || "").trim();
}

function boundedPluginRefreshValue(value, maxLength) {
  const text = String(value || "").trim();
  return text ? text.slice(0, Math.max(0, Number(maxLength) || 0)) : "";
}

function pluginRefreshReasonForApiError(details = {}) {
  const status = Number(details && details.status || 0);
  const path = String(details && details.path || "").trim();
  const message = String(details && details.message || "").trim().toLowerCase();
  if (!(status === 401 || status === 403)) return "";
  if (path === "/api/v1/hermes/plugin/session") return "plugin_launch_invalid";
  if (message.includes("plugin_launch_invalid_or_expired")) return "plugin_launch_invalid";
  if (message.includes("invalid launch") || message.includes("invalid session")) return "plugin_session_invalid";
  if (message.includes("session is unauthorized") || message.includes("session expired")) return "plugin_session_invalid";
  if (message.includes("unauthorized") || message.includes("forbidden")) return "auth_state_changed";
  return "";
}

function currentHermesRefreshRoute(options = {}) {
  const explicit = options && typeof options.route === "object" ? options.route : null;
  const hinted = normalizePluginRouteHint(state.pendingPluginRouteHint)
    || normalizePluginRouteHint(state.queuedPluginRouteHint);
  const route = {};
  const name = boundedPluginRefreshValue(
    explicit && explicit.name
      ? explicit.name
      : (state.currentThreadId || (hinted && hinted.threadId) ? "thread" : "root"),
    48,
  );
  const threadId = boundedPluginRefreshValue(
    explicit && explicit.threadId
      ? explicit.threadId
      : (state.currentThreadId || (hinted && hinted.threadId) || (state.pluginLaunchTarget && state.pluginLaunchTarget.threadId) || ""),
    160,
  );
  const itemId = boundedPluginRefreshValue(
    explicit && explicit.itemId
      ? explicit.itemId
      : (hinted && (hinted.itemId || hinted.taskId)) || "",
    160,
  );
  const pluginRoute = boundedPluginRefreshValue(
    explicit && explicit.pluginRoute
      ? explicit.pluginRoute
      : (hinted && hinted.route) || "",
    80,
  );
  const pluginThreadId = boundedPluginRefreshValue(
    explicit && explicit.pluginThreadId
      ? explicit.pluginThreadId
      : threadId,
    160,
  );
  const pluginTaskId = boundedPluginRefreshValue(
    explicit && explicit.pluginTaskId
      ? explicit.pluginTaskId
      : (hinted && hinted.taskId) || "",
    160,
  );
  const pluginItemId = boundedPluginRefreshValue(
    explicit && explicit.pluginItemId
      ? explicit.pluginItemId
      : itemId,
    160,
  );
  if (name) route.name = name;
  if (threadId) route.threadId = threadId;
  if (itemId) route.itemId = itemId;
  if (pluginRoute) route.pluginRoute = pluginRoute;
  if (pluginThreadId) route.pluginThreadId = pluginThreadId;
  if (pluginTaskId) route.pluginTaskId = pluginTaskId;
  if (pluginItemId) route.pluginItemId = pluginItemId;
  return route;
}

function requestHermesPluginRefresh(reason, options = {}) {
  if (!isHermesEmbedMode() || !pluginEmbedApi.postRefreshRequired) return false;
  const normalizedReason = boundedPluginRefreshValue(reason || "refresh_required", 80) || "refresh_required";
  const route = currentHermesRefreshRoute(options);
  const targetOrigin = normalizePluginParentOrigin(state.pluginParentOrigin);
  const signature = JSON.stringify({
    reason: normalizedReason,
    targetOrigin: targetOrigin || "*",
    route,
  });
  if (!options.force && signature === state.pluginRefreshRequestSignature) return false;
  state.pluginRefreshRequestSignature = signature;
  if (targetOrigin) state.pluginParentOrigin = targetOrigin;
  if (state.pluginRefreshPendingTimer) {
    clearTimeout(state.pluginRefreshPendingTimer);
    state.pluginRefreshPendingTimer = null;
  }
  state.pluginRefreshPendingNotice = pluginRefreshPendingMessage(normalizedReason);
  state.pluginRefreshPendingTimer = window.setTimeout(() => {
    state.pluginRefreshPendingTimer = null;
    clearPluginRefreshPendingNotice();
  }, 10000);
  if (state.currentThreadId || state.currentThread) renderCurrentThread();
  else if (state.newThreadDraft) renderNewThreadDraft();
  if ($("connectionState")) $("connectionState").textContent = state.pluginRefreshPendingNotice || "Requesting plugin refresh...";
  pluginEmbedApi.postRefreshRequired(window.parent, {
    reason: normalizedReason,
    route,
  }, {
    targetOrigin: targetOrigin || "*",
  });
  postClientEvent("plugin_refresh_required", {
    reason: normalizedReason,
    targetOrigin: targetOrigin || "*",
    hasThreadId: Boolean(route.threadId),
    hasItemId: Boolean(route.itemId),
    usedWildcardFallback: !targetOrigin,
  });
  return true;
}

function pluginRefreshPendingMessage(reason) {
  const normalized = boundedPluginRefreshValue(reason || "refresh_required", 80) || "refresh_required";
  if (normalized === "server_build_changed") return "Refreshing plugin page for a new Mobile Web build...";
  if (normalized === "plugin_session_missing" || normalized === "plugin_launch_invalid") return "Refreshing plugin page because the Hermes launch session is no longer valid...";
  if (normalized === "auth_state_changed") return "Refreshing plugin page because the Codex auth/session state changed...";
  return "Refreshing plugin page from Hermes Mobile...";
}

function clearPluginRefreshPendingNotice() {
  if (state.pluginRefreshPendingTimer) {
    clearTimeout(state.pluginRefreshPendingTimer);
    state.pluginRefreshPendingTimer = null;
  }
  if (!state.pluginRefreshPendingNotice) return;
  state.pluginRefreshPendingNotice = "";
  if (state.currentThreadId || state.currentThread) renderCurrentThread();
  else if (state.newThreadDraft) renderNewThreadDraft();
}

function renderPluginRefreshPendingNotice(previousKeys = new Set()) {
  if (!isHermesEmbedMode()) return "";
  const message = String(state.pluginRefreshPendingNotice || "").trim();
  if (!message) return "";
  const key = `plugin-refresh-pending|${message}`;
  return `<div class="history-note plugin-refresh-pending${entryAnimationClass(key, previousKeys)}" data-render-key="${escapeHtml(key)}">${escapeHtml(message)}</div>`;
}

function scrubPluginLaunchUrl() {
  if (!isHermesEmbedMode()) return;
  try {
    const url = new URL(window.location.href, window.location.origin);
    url.searchParams.set("embed", "hermes");
    url.searchParams.delete("codexPluginLaunch");
    url.searchParams.delete("pluginLaunch");
    if (state.pluginEmbed.workspaceId) url.searchParams.set("workspaceId", state.pluginEmbed.workspaceId);
    const appearance = normalizePluginAppearance(state.pluginAppearance);
    if (appearance && appearance.theme) url.searchParams.set("pluginTheme", appearance.theme);
    if (appearance && appearance.fontSize) url.searchParams.set("pluginFontSize", appearance.fontSize);
    window.history.replaceState({}, "", `${url.pathname || "/"}?${url.searchParams.toString()}${url.hash || ""}`);
  } catch (_) {
    // URL scrubbing is best-effort; auth state is already held in memory.
  }
}

function pluginRootPath() {
  if (!isHermesEmbedMode()) return window.location.pathname || "/";
  const params = new URLSearchParams({ embed: "hermes" });
  if (state.pluginEmbed && state.pluginEmbed.workspaceId) params.set("workspaceId", state.pluginEmbed.workspaceId);
  return `/?${params.toString()}`;
}

function showPluginEmbedAuthError(message = "") {
  const app = $("app");
  const login = $("login");
  const panel = document.querySelector("#login .login-panel");
  if (app) app.classList.add("hidden");
  if (login) login.classList.remove("hidden");
  if (panel) panel.classList.add("plugin-embed-login-panel");
  const brand = document.querySelector("#login .brand");
  if (brand) brand.textContent = "Codex Mobile";
  const input = $("loginKey");
  const submit = document.querySelector("#loginForm button[type='submit']");
  if (input) input.classList.add("hidden");
  if (submit) submit.classList.add("hidden");
  $("loginError").textContent = message || "Codex Mobile plugin launch is invalid or expired.";
  publishPluginNavigationState();
}

function showPluginEmbedRecovering(message = "") {
  showApp();
  clearPluginRefreshPendingNotice();
  state.newThreadDraft = false;
  state.startupThreadOpenPending = false;
  state.currentThread = null;
  state.currentThreadId = "";
  state.activeTurnId = "";
  clearInterval(state.tickTimer);
  state.tickTimer = null;
  updateSubagentPanelUi();
  updateTurnTimer();
  $("threadTitle").textContent = "Refreshing plugin";
  $("threadMeta").textContent = "Waiting for Hermes Mobile to relaunch Codex";
  $("conversation").innerHTML = `<div class="empty-state entry-animate">${escapeHtml(message || "Refreshing Codex Mobile plugin session...")}</div>`;
  state.renderedConversationSignature = `plugin-recovering|${String(message || "").slice(0, 120)}`;
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = message || "Refreshing Codex Mobile plugin session...";
  publishPluginNavigationState({ force: true });
}

function showLogin(message = "") {
  if (isHermesEmbedMode()) {
    showPluginEmbedAuthError(message);
    return;
  }
  $("app").classList.add("hidden");
  $("login").classList.remove("hidden");
  $("loginError").textContent = message;
}

function showApp() {
  updateViewportVars();
  $("login").classList.add("hidden");
  $("app").classList.remove("hidden");
  if (isHermesEmbedMode()) document.documentElement.classList.add("embed-hermes");
  updateComposerHeightVar();
  publishPluginNavigationState();
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
  state.pluginLaunchSession = false;
  state.pluginSessionActive = false;
  localStorage.setItem("codexMobileKey", key);
  showApp();
  await bootstrap();
}

async function exchangePluginLaunchSession() {
  if (!isHermesEmbedMode() || !state.pluginLaunchSession || !state.key) return;
  const result = await api("/api/v1/hermes/plugin/session", {
    method: "POST",
    body: JSON.stringify({ codexPluginLaunch: state.key }),
    timeoutMs: 12000,
  });
  if (!result || !result.session_key) throw new Error("Plugin session exchange failed");
  state.key = String(result.session_key || "");
  const hermesOrigin = normalizePluginParentOrigin(result && result.hermes_origin);
  if (hermesOrigin) state.pluginParentOrigin = hermesOrigin;
  state.pluginLaunchTarget = result && result.target && typeof result.target === "object" ? result.target : null;
  applyPluginAppearancePreference(result && result.appearance);
  if (state.pluginLaunchTarget && state.pluginLaunchTarget.cwd && !state.currentThreadId) {
    state.selectedCwd = String(state.pluginLaunchTarget.cwd || "").trim();
  }
  state.pluginLaunchSession = false;
  state.pluginSessionActive = true;
  scrubPluginLaunchUrl();
}

async function applyPluginLaunchTarget() {
  const target = state.pluginLaunchTarget && typeof state.pluginLaunchTarget === "object" ? state.pluginLaunchTarget : null;
  if (!target) return false;
  state.pluginLaunchTarget = null;
  const threadId = String(target.threadId || "").trim();
  if (threadId) {
    localStorage.setItem(STORAGE_THREAD_ID, threadId);
    clearThreadUrl();
    await loadThread(threadId, { source: "plugin-launch" });
    return true;
  }
  const cwd = String(target.cwd || "").trim();
  if (!cwd) return false;
  const workspace = state.workspaces.find((ws) => normalizeFsPath(ws.cwd) === normalizeFsPath(cwd));
  saveCurrentDraftNow();
  state.selectedCwd = workspace ? workspace.cwd : cwd;
  clearCurrentThreadSelection({ saveDraft: false });
  state.newThreadDraft = true;
  state.startupThreadOpenPending = false;
  restoreDraftForCurrentTarget();
  syncSidebarWorkspaceSelect();
  updateWorkspacePath();
  renderThreads();
  renderCurrentThread();
  updateComposerControls();
  return true;
}

async function bootstrap() {
  const startupThreadId = applyUrlThreadSelection();
  const startupPluginRouteHint = applyUrlPluginRouteHint();
  const savedThreadId = isHermesEmbedMode() ? "" : (localStorage.getItem(STORAGE_THREAD_ID) || "");
  state.startupThreadOpenPending = Boolean(startupThreadId || savedThreadId || (startupPluginRouteHint && startupPluginRouteHint.threadId));
  const status = await api("/api/status").catch((err) => {
    $("connectionState").textContent = err.message;
    $("connectionState").classList.add("error");
    return null;
  });
  if (status) updateConnectionState(status);
  if (status && (status.rateLimits || status.rateLimitsByModel)) rememberRateLimits(status.rateLimits, status.rateLimitsByModel);
  await loadWorkspaces();
  await loadThreads({ silent: state.startupThreadOpenPending });
  let appliedPluginLaunchTarget = false;
  let appliedPluginRouteHint = false;
  try {
    appliedPluginLaunchTarget = await applyPluginLaunchTarget();
    if (!appliedPluginLaunchTarget) {
      appliedPluginRouteHint = await openHermesPluginRouteHint(state.queuedPluginRouteHint);
    }
  } catch (err) {
    showError(err);
  }
  if (!appliedPluginLaunchTarget && !appliedPluginRouteHint && startupThreadId) {
    try {
      await openExternalThreadSelection(startupThreadId, { statusMessage: "Opening linked thread" });
    } catch (err) {
      showError(err);
    } finally {
      state.startupThreadOpenPending = false;
    }
  } else if (!appliedPluginLaunchTarget && !appliedPluginRouteHint) {
    await restoreThreadSelection();
  } else {
    state.startupThreadOpenPending = false;
  }
  connectEvents();
  scheduleStartupUpdateCheck();
  scheduleStartupPublicPrCheck();
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

function normalizePluginRouteHint(value) {
  if (!value || typeof value !== "object") return null;
  const pluginId = String(value.pluginId || "").trim().slice(0, 80);
  const route = String(value.route || "").trim().slice(0, 80);
  const itemId = String(value.itemId || "").trim().slice(0, 160);
  const threadId = String(value.threadId || "").trim().slice(0, 160);
  const taskId = String(value.taskId || "").trim().slice(0, 160);
  if (!(pluginId || route || itemId || threadId || taskId)) return null;
  return { pluginId, route, itemId, threadId, taskId };
}

function pluginRouteHintFromUrl(value) {
  try {
    const detected = pluginEmbedApi.detect ? pluginEmbedApi.detect(value || window.location.href) : null;
    const normalized = normalizePluginRouteHint(detected && detected.routeHint);
    if (normalized) return normalized;
    const url = new URL(value || window.location.href, window.location.origin);
    return normalizePluginRouteHint({
      pluginId: url.searchParams.get("pluginId"),
      route: url.searchParams.get("pluginRoute"),
      itemId: url.searchParams.get("pluginItemId"),
      threadId: url.searchParams.get("pluginThreadId"),
      taskId: url.searchParams.get("pluginTaskId"),
    });
  } catch (_) {
    return null;
  }
}

function pluginRouteHintTargetId(hint) {
  if (!hint) return "";
  return String(hint.taskId || hint.itemId || "").trim();
}

function setPluginRouteDiagnostic(message, options = {}) {
  const text = String(message || "").trim().slice(0, 240);
  if (!text) return;
  $("connectionState").textContent = text;
  $("connectionState").classList.toggle("error", options.error !== false);
}

function clearThreadUrl() {
  try {
    window.history.replaceState({}, "", isHermesEmbedMode() ? pluginRootPath() : (window.location.pathname || "/"));
  } catch (_) {
    // URL cleanup is best-effort after external thread selection.
  }
}

function findPluginRouteTargetNode(hint) {
  const targetId = pluginRouteHintTargetId(hint);
  if (!targetId) return null;
  const conversation = $("conversation");
  if (!conversation) return null;
  return conversation.querySelector(`[data-approval-card="${escapeSelectorAttr(targetId)}"]`)
    || conversation.querySelector(`[data-task-card="${escapeSelectorAttr(targetId)}"]`)
    || conversation.querySelector(`[data-turn="${escapeSelectorAttr(targetId)}"]`)
    || conversation.querySelector(`[data-item="${escapeSelectorAttr(targetId)}"]`);
}

function focusPluginRouteTargetNode(hint) {
  const node = findPluginRouteTargetNode(hint);
  if (!node) return false;
  markProgrammaticConversationScroll();
  if (typeof node.scrollIntoView === "function") {
    node.scrollIntoView({ block: "center", inline: "nearest" });
  }
  scheduleScrollToBottomButtonUpdate();
  return true;
}

function applyPendingPluginRouteHintFocus() {
  const hint = normalizePluginRouteHint(state.pendingPluginRouteHint);
  if (!hint) return false;
  const threadId = String(state.currentThreadId || "").trim();
  if (!threadId || hint.threadId !== threadId) return false;
  const targetId = pluginRouteHintTargetId(hint);
  if (!targetId) {
    state.pendingPluginRouteHint = null;
    return false;
  }
  const focused = focusPluginRouteTargetNode(hint);
  if (focused) {
    state.pendingPluginRouteHint = null;
    setPluginRouteDiagnostic("Opened notification target", { error: false });
    return true;
  }
  state.pendingPluginRouteHint = null;
  showHermesPluginPrimaryPage();
  setPluginRouteDiagnostic("Notification target is no longer available", { error: true });
  return false;
}

async function openExternalThreadSelection(threadId, options = {}) {
  const id = String(threadId || "").trim();
  if (!id) return;
  localStorage.setItem(STORAGE_THREAD_ID, id);
  clearThreadUrl();
  if (!state.key) return;
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = String(options.statusMessage || "Opening notification thread");
  if (!state.workspaces.length) {
    try {
      await loadWorkspaces();
    } catch (_) {
      // Loading the thread by id can still succeed without refreshing workspace shortcuts.
    }
  }
  await loadThread(id, { source: "external" });
}

async function openHermesPluginRouteHint(hint) {
  const normalized = normalizePluginRouteHint(hint);
  if (!normalized || normalized.pluginId !== "codex-mobile") return false;
  state.queuedPluginRouteHint = null;
  clearThreadUrl();
  const threadId = String(normalized.threadId || "").trim();
  const targetId = pluginRouteHintTargetId(normalized);
  if (!threadId && !targetId) {
    if (normalized.route && normalized.route !== "root") {
      setPluginRouteDiagnostic("Notification target is unavailable", { error: true });
    }
    showHermesPluginPrimaryPage();
    return true;
  }
  if (!threadId) {
    showHermesPluginPrimaryPage();
    setPluginRouteDiagnostic("Notification thread is unavailable", { error: true });
    return true;
  }
  try {
    state.pendingPluginRouteHint = targetId ? normalized : null;
    await openExternalThreadSelection(threadId, {
      statusMessage: targetId ? "Opening notification target" : "Opening notification thread",
    });
    if (!targetId) {
      setPluginRouteDiagnostic("Opened notification thread", { error: false });
    } else {
      applyPendingPluginRouteHintFocus();
    }
    return true;
  } catch (error) {
    state.pendingPluginRouteHint = null;
    showHermesPluginPrimaryPage();
    setPluginRouteDiagnostic(targetId ? "Notification target is unavailable" : "Notification thread is unavailable", {
      error: true,
    });
    return true;
  }
}

function applyUrlPluginRouteHint(options = {}) {
  if (!isHermesEmbedMode()) return null;
  try {
    const hint = pluginRouteHintFromUrl(window.location.href);
    if (!hint || hint.pluginId !== "codex-mobile") return null;
    state.queuedPluginRouteHint = hint;
    clearThreadUrl();
    if (options.load) openHermesPluginRouteHint(hint).catch(showError);
    return hint;
  } catch (_) {
    return null;
  }
}

function applyUrlThreadSelection(options = {}) {
  try {
    const threadId = threadIdFromUrlValue(window.location.href);
    if (!threadId) return "";
    localStorage.setItem(STORAGE_THREAD_ID, threadId);
    clearThreadUrl();
    if (options.load) {
      if (threadId === state.currentThreadId && state.currentThread && !state.currentThread.mobileLoadError) {
        scheduleCurrentThreadRefresh(250);
      } else {
        openExternalThreadSelection(threadId).catch(showError);
      }
    }
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

function handleLaunchTargetUrl(targetUrl) {
  const threadId = threadIdFromUrlValue(targetUrl);
  postClientEvent("launch_target", {
    hasThread: Boolean(threadId),
    pwa: isPwaMode(),
  });
  if (threadId) {
    openExternalThreadSelection(threadId).catch(showError);
    return;
  }
  scheduleMobileResume("launch-target", 120);
}

function installLaunchQueueHandler() {
  const launchQueue = window.launchQueue;
  if (!launchQueue || typeof launchQueue.setConsumer !== "function") return;
  try {
    launchQueue.setConsumer((launchParams) => {
      if (!launchParams || !launchParams.targetURL) return;
      handleLaunchTargetUrl(launchParams.targetURL);
    });
    postClientEvent("launch_queue_ready", { pwa: isPwaMode() });
  } catch (err) {
    postClientEvent("launch_queue_failed", { message: err.message || String(err) });
  }
}

async function loadWorkspaces() {
  const result = await api("/api/workspaces");
  state.workspaces = result.data || [];
  const select = $("workspaceSelect");
  const menu = $("workspaceSelectMenu");
  if (state.selectedCwd && !state.workspaces.some((ws) => normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd))) {
    state.selectedCwd = "";
  }
  if (select) {
    select.textContent = state.selectedCwd ? selectedWorkspaceLabel() : "All workspaces";
    select.disabled = !state.workspaces.length && !state.workspaceCreateEnabled;
    select.setAttribute("title", state.workspaces.length ? "Select Workspace" : "Create Workspace");
  }
  if (menu) {
    menu.innerHTML = workspaceSidebarOptionsHtml();
  }
  updateWorkspacePath();
  if (!state.currentThread) renderCurrentThread();
}

function workspaceSidebarOptionsHtml() {
  const allSelected = !state.selectedCwd ? " is-selected" : "";
  const allOption = `<button type="button" class="workspace-select-option${allSelected}" data-workspace-value="">All workspaces</button>`;
  const workspaceOptions = state.workspaces.length ? state.workspaces.map((ws) => {
    const count = ws.recentThreadCount ? ` (${ws.recentThreadCount})` : "";
    const label = `${ws.label}${count} - ${ws.cwd}`;
    const selected = normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd) ? " is-selected" : "";
    return `<button type="button" class="workspace-select-option${selected}" data-workspace-value="${escapeHtml(ws.cwd)}">${escapeHtml(label)}</button>`;
  }).join("") : `<div class="workspace-select-empty">No Workspace yet</div>`;
  const createRoot = state.workspaceCreateRoot ? `Under ${state.workspaceCreateRoot}` : "Create a local folder";
  const createOption = state.workspaceCreateEnabled
    ? `<button type="button" class="workspace-select-option workspace-create-option" data-create-workspace><span class="workspace-create-title">Create Workspace</span><span class="workspace-create-meta">${escapeHtml(createRoot)}</span></button>`
    : "";
  return allOption + workspaceOptions + createOption;
}

function syncSidebarWorkspaceSelect() {
  const select = $("workspaceSelect");
  const menu = $("workspaceSelectMenu");
  if (!select) return;
  select.textContent = state.selectedCwd ? selectedWorkspaceLabel() : "All workspaces";
  if (menu) {
    menu.innerHTML = workspaceSidebarOptionsHtml();
  }
}

function workspaceOptionsHtml() {
  return `<option value="">All workspaces</option>` + state.workspaces.map((ws) => {
    const count = ws.recentThreadCount ? ` (${ws.recentThreadCount})` : "";
    return `<option value="${escapeHtml(ws.cwd)}">${escapeHtml(`${ws.label}${count} - ${ws.cwd}`)}</option>`;
  }).join("");
}

function newThreadWorkspaceOptionsHtml() {
  return state.workspaces.map((ws) => {
    const count = ws.recentThreadCount ? ` (${ws.recentThreadCount})` : "";
    const label = `${ws.label}${count} - ${ws.cwd}`;
    const selected = normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd) ? " is-selected" : "";
    return `<button type="button" class="new-thread-workspace-option${selected}" data-new-thread-workspace="${escapeHtml(ws.cwd)}">${escapeHtml(label)}</button>`;
  }).join("");
}

function newThreadChoiceOptionsHtml(values, selectedValue, dataName, labeler) {
  return normalizeOptionList(values).map((value) => {
    const selected = value === selectedValue ? " is-selected" : "";
    return `<button type="button" class="new-thread-choice${selected}" data-new-thread-${dataName}="${escapeHtml(value)}">${escapeHtml(labeler(value))}</button>`;
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
  const bottomLimit = options.avoidComposer !== false && composerTop > rect.bottom
    ? composerTop
    : viewportBottom;
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

function clearCurrentThreadSelection(options = {}) {
  if (options.saveDraft !== false) saveCurrentDraftNow();
  state.threadLoadSeq += 1;
  state.sendButtonHint = "";
  resetComposerRuntimeSelection();
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

async function loadThreads(options = {}) {
  const silent = options.silent === true;
  if (silent && state.threadListLoadController) return null;
  const seq = state.threadListLoadSeq + 1;
  state.threadListLoadSeq = seq;
  if (state.threadListLoadController) state.threadListLoadController.abort();
  const controller = new AbortController();
  state.threadListLoadController = controller;
  const params = new URLSearchParams({ limit: "80", archived: "false" });
  if (state.selectedCwd) params.set("cwd", state.selectedCwd);
  const search = $("threadSearch").value.trim();
  if (search) params.set("search", search);
  if (!silent) renderThreadListLoading();
  try {
    const result = await api(`/api/threads?${params}`, { timeoutMs: 45000, signal: controller.signal });
    if (seq !== state.threadListLoadSeq) return null;
    state.threads = visibleThreads(result.data || []);
    state.threadListLoadedAtMs = Date.now();
    reconcileThreadStatusHints(state.threads);
    renderThreads(result);
    restoreConnectionState(result.mobileFallback ? "Recovered from session index" : "Connected");
    if (!state.currentThread) renderCurrentThread();
    return result;
  } catch (err) {
    if (seq !== state.threadListLoadSeq || controller.signal.aborted) return null;
    if (!silent) renderThreadLoadError(err);
    throw err;
  } finally {
    if (state.threadListLoadController === controller) state.threadListLoadController = null;
  }
}

async function loadThread(threadId, options = {}) {
  saveCurrentDraftNow();
  state.newThreadDraft = false;
  const switchStartedAt = nowPerfMs();
  const fromThreadId = state.currentThreadId || "";
  const source = String(options.source || "unknown").slice(0, 40);
  if (threadId !== fromThreadId) resetComposerRuntimeSelection();
  if (threadId !== fromThreadId) {
    state.subagentPanelOpen = false;
    cancelSubagentSwipe();
    updateSubagentPanelUi();
  }
  const listAgeMs = state.threadListLoadedAtMs ? Date.now() - state.threadListLoadedAtMs : null;
  postClientEvent("thread_switch_start", {
    source,
    fromThreadId,
    toThreadId: threadId || "",
    listAgeMs,
    currentHadThread: Boolean(state.currentThread),
    eventOpen: Boolean(state.events && state.events.readyState === EventSource.OPEN),
  });
  if (threadId && threadId !== state.continuationSourceThreadId) {
    state.continuationSourceThreadId = "";
  }
  if (threadId === state.currentThreadId
    && state.currentThread
    && !state.currentThread.mobileLoading
    && !state.currentThread.mobileLoadError) {
    renderThreads();
    renderCurrentThread();
    if (isMenuOverlayMode()) closeSidebarMenu();
    postClientEvent("thread_switch_cached", {
      source,
      threadId,
      elapsedMs: roundedDurationMs(switchStartedAt),
    });
    return;
  }
  const seq = state.threadLoadSeq + 1;
  state.threadLoadSeq = seq;
  state.sendButtonHint = "";
  clearRecentCompletedReplyAnchor();
  clearConversationAutoScrollHold();
  abortCurrentThreadRefresh();
  if (state.threadLoadController) state.threadLoadController.abort();
  const controller = new AbortController();
  state.threadLoadController = controller;
  clearTimeout(state.pollTimer);
  markThreadViewed(threadId);
  const summary = state.threads.find((thread) => thread.id === threadId);
  state.currentThreadId = threadId;
  state.startupThreadOpenPending = false;
  state.currentThread = summary ? Object.assign({ turns: [], mobileLoading: true }, summary) : {
    id: threadId,
    name: threadId,
    preview: threadId,
    turns: [],
    mobileLoading: true,
  };
  restoreDraftForCurrentTarget();
  renderComposerSettings();
  syncActiveTurnFromThread();
  renderThreads();
  renderCurrentThread({ stickToBottom: true });
  updateComposerControls();
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "Loading thread";
  markActivity("加载线程");
  let result;
  const apiStartedAt = nowPerfMs();
  try {
    result = await api(`/api/threads/${encodeURIComponent(threadId)}`, {
      timeoutMs: 20000,
      signal: controller.signal,
    });
  } catch (err) {
    if (seq !== state.threadLoadSeq || controller.signal.aborted) {
      postClientEvent("thread_switch_cancelled", {
        source,
        threadId,
        elapsedMs: roundedDurationMs(switchStartedAt),
        apiElapsedMs: roundedDurationMs(apiStartedAt),
      });
      return;
    }
    state.currentThread = Object.assign({}, state.currentThread || { id: threadId, name: threadId, preview: threadId, turns: [] }, {
      mobileLoading: false,
      mobileLoadError: err.message || String(err),
    });
    syncActiveTurnFromThread();
    renderThreads();
    renderCurrentThread();
    updateComposerControls();
    postClientEvent("thread_switch_error", {
      source,
      threadId,
      elapsedMs: roundedDurationMs(switchStartedAt),
      apiElapsedMs: roundedDurationMs(apiStartedAt),
      error: err.message || String(err),
    });
    throw err;
  } finally {
    if (state.threadLoadController === controller) state.threadLoadController = null;
  }
  const apiElapsedMs = roundedDurationMs(apiStartedAt);
  if (seq !== state.threadLoadSeq || state.currentThreadId !== threadId) {
    postClientEvent("thread_switch_cancelled", {
      source,
      threadId,
      elapsedMs: roundedDurationMs(switchStartedAt),
      apiElapsedMs,
    });
    return;
  }
  const renderStartedAt = nowPerfMs();
  state.currentThread = mergeThreadPreservingVisibleItems(state.currentThread, result.thread);
  localStorage.setItem(STORAGE_THREAD_ID, threadId);
  draftStore.setTargetKey("");
  if (state.events) connectEvents();
  renderComposerSettings();
  syncActiveTurnFromThread();
  renderThreads();
  renderCurrentThread({ stickToBottom: true });
  restoreConnectionState();
  scheduleLivePollIfNeeded(1200);
  updateComposerControls();
  if (isMenuOverlayMode()) closeSidebarMenu();
  postClientEvent("thread_switch_complete", {
    source,
    threadId,
    elapsedMs: roundedDurationMs(switchStartedAt),
    apiElapsedMs,
    renderElapsedMs: roundedDurationMs(renderStartedAt),
    readMode: result.thread && result.thread.mobileReadMode || "",
    status: statusText(result.thread && result.thread.status),
    turns: Array.isArray(result.thread && result.thread.turns) ? result.thread.turns.length : 0,
    omittedTurns: Number(result.thread && result.thread.mobileOmittedTurnCount || 0),
    rolloutSizeBytes: rolloutSizeBytes(result.thread),
  });
}

async function refreshCurrentThread() {
  if (!state.currentThreadId) return;
  markIdleActivity("同步");
  const threadId = state.currentThreadId;
  const seq = state.threadLoadSeq;
  if (state.refreshThreadController) state.refreshThreadController.abort();
  const controller = new AbortController();
  state.refreshThreadController = controller;
  let result;
  try {
    result = await api(`/api/threads/${encodeURIComponent(threadId)}`, {
      timeoutMs: 20000,
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted || err.name === "AbortError") return;
    throw err;
  } finally {
    if (state.refreshThreadController === controller) state.refreshThreadController = null;
  }
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

function abortCurrentThreadRefresh() {
  clearTimeout(state.refreshTimer);
  clearTimeout(state.pollTimer);
  if (state.refreshThreadController) {
    state.refreshThreadController.abort();
    state.refreshThreadController = null;
  }
  state.pollStableCount = 0;
  state.lastThreadSignature = "";
}

function scheduleLivePollIfNeeded(delay = 2600) {
  clearTimeout(state.pollTimer);
  if (!shouldPollCurrentThread()) return;
  const signature = threadSignature();
  if (signature === state.lastThreadSignature) state.pollStableCount += 1;
  else state.pollStableCount = 0;
  state.lastThreadSignature = signature;
  let nextDelay = delay;
  if (state.pollStableCount > 12) nextDelay = Math.max(delay, 12000);
  else if (state.pollStableCount > 3) nextDelay = Math.max(delay, 5000);
  state.pollTimer = setTimeout(() => {
    refreshCurrentThread().catch(showError);
  }, nextDelay);
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
  loadThread(threadId, { source: "thread-list" }).catch(showError);
}

function isMobileViewport() {
  return isMenuOverlayMode();
}

function closeSidebarMenu() {
  const sidebar = $("sidebar");
  if (!sidebar) return;
  sidebar.classList.remove("open", "edge-dragging");
  sidebar.style.removeProperty("--sidebar-edge-x");
  state.sidebarEdgeSwipe = null;
  const settingsPanel = $("themeSettingsPanel");
  const settingsToggle = $("themeSettingsToggle");
  if (settingsPanel) settingsPanel.classList.add("hidden");
  if (settingsToggle) settingsToggle.setAttribute("aria-expanded", "false");
  publishPluginNavigationState();
}

function isHermesPluginPrimaryPage() {
  return isHermesEmbedMode() && !state.currentThreadId && !state.newThreadDraft;
}

function syncHermesPluginPageLevel() {
  if (!isHermesEmbedMode()) return;
  document.documentElement.classList.toggle("embed-hermes-primary", isHermesPluginPrimaryPage());
}

function showHermesPluginPrimaryPage() {
  if (!isHermesEmbedMode()) return false;
  clearCurrentThreadSelection();
  state.newThreadDraft = false;
  const sidebar = $("sidebar");
  if (sidebar) {
    sidebar.classList.remove("open", "edge-dragging");
    sidebar.style.removeProperty("--sidebar-edge-x");
  }
  state.sidebarEdgeSwipe = null;
  renderComposerSettings();
  renderThreads();
  renderCurrentThread();
  updateComposerControls();
  restoreConnectionState();
  syncHermesPluginPageLevel();
  publishPluginNavigationState({ force: true });
  refreshSidebarListAfterOpen();
  return true;
}

function refreshSidebarListAfterOpen() {
  const loadedAt = Number(state.threadListLoadedAtMs || 0);
  if (!loadedAt) {
    loadWorkspaces()
      .then(() => loadThreads())
      .catch(showError);
    return;
  }
  if (Date.now() - loadedAt < 60000) return;
  loadWorkspaces()
    .then(() => loadThreads({ silent: true }))
    .catch(() => {
      // Sidebar opening should stay instant; visible refresh still reports errors.
    });
}

function openSidebarMenu() {
  if (isHermesEmbedMode()) {
    showHermesPluginPrimaryPage();
    return;
  }
  const sidebar = $("sidebar");
  if (!sidebar) return;
  sidebar.classList.remove("edge-dragging");
  sidebar.style.removeProperty("--sidebar-edge-x");
  sidebar.classList.add("open");
  state.sidebarEdgeSwipe = null;
  refreshSidebarListAfterOpen();
  publishPluginNavigationState({ force: true });
}

function isSidebarOpen() {
  const sidebar = $("sidebar");
  return Boolean(sidebar && sidebar.classList.contains("open"));
}

function isInteractiveGestureTarget(target) {
  return Boolean(target && target.closest && target.closest(
    "a, button, input, textarea, select, label, [contenteditable='true'], .rename-input, .composer, .thread-action-sheet, .continuation-dialog"
  ));
}

function beginSidebarEdgeSwipe(event) {
  if (!isMobileViewport() || isHermesEmbedMode() || isSidebarOpen() || state.renameThreadId || createWorkspaceDialogOpen() || state.threadActionMenuId || state.continuationDialogThreadId) return;
  if (event.touches && event.touches.length > 1) return;
  if (isInteractiveGestureTarget(event.target)) return;
  const touch = primaryTouch(event);
  if (!touch || touch.clientX > SIDEBAR_EDGE_SWIPE_PX) return;
  const sidebar = $("sidebar");
  state.sidebarEdgeSwipe = {
    startX: touch.clientX,
    startY: touch.clientY,
    currentX: touch.clientX,
    moved: false,
    width: Math.max(1, Math.round((sidebar && sidebar.getBoundingClientRect().width) || window.innerWidth || 1)),
  };
}

function moveSidebarEdgeSwipe(event) {
  const swipe = state.sidebarEdgeSwipe;
  if (!swipe) return;
  const touch = primaryTouch(event);
  if (!touch) return;
  const dx = touch.clientX - swipe.startX;
  const dy = touch.clientY - swipe.startY;
  if (!swipe.moved) {
    if (dx < 8 && Math.abs(dy) < 12) return;
    if (dx <= 0 || Math.abs(dy) > Math.abs(dx)) {
      cancelSidebarEdgeSwipe();
      return;
    }
  }
  swipe.moved = true;
  swipe.currentX = touch.clientX;
  if (event.cancelable !== false) event.preventDefault();
  const sidebar = $("sidebar");
  if (!sidebar) return;
  const offset = Math.max(0, Math.min(swipe.width, dx));
  sidebar.classList.add("edge-dragging");
  sidebar.style.setProperty("--sidebar-edge-x", `${Math.round(offset)}px`);
}

function finishSidebarEdgeSwipe() {
  const swipe = state.sidebarEdgeSwipe;
  if (!swipe) return;
  const dx = Number(swipe.currentX || swipe.startX) - swipe.startX;
  const shouldOpen = swipe.moved && dx >= Math.max(SIDEBAR_EDGE_OPEN_MIN_PX, swipe.width * SIDEBAR_EDGE_OPEN_RATIO);
  if (shouldOpen) openSidebarMenu();
  else cancelSidebarEdgeSwipe();
}

function cancelSidebarEdgeSwipe() {
  const sidebar = $("sidebar");
  if (sidebar) {
    sidebar.classList.remove("edge-dragging");
    sidebar.style.removeProperty("--sidebar-edge-x");
  }
  state.sidebarEdgeSwipe = null;
}

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

function renderSubagentPanel() {
  const turn = currentSubagentTurn();
  const items = currentSubagentItems();
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
  const empty = items.length ? "" : `<div class="subagent-empty">当前线程暂无正在进行的 Subagent。</div>`;
  return `<div class="subagent-status-window">
    <div class="subagent-status-header">
      <div>
        <div class="subagent-status-heading">Subagent 状态</div>
        <div class="subagent-status-summary">当前进行中 · ${items.length.toLocaleString()} 个</div>
      </div>
      <button class="subagent-window-close" type="button" data-subagent-panel-close aria-label="关闭 Subagent 状态">×</button>
    </div>
    <div class="subagent-status-list">${rows}${empty}</div>
  </div>`;
}

function updateSubagentPanelUi() {
  const panel = $("subagentPanel");
  if (!panel) return;
  if (!state.subagentPanelOpen || !subagentSwipeAvailable()) {
    state.subagentPanelOpen = false;
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }
  panel.classList.remove("hidden");
  panel.innerHTML = renderSubagentPanel();
  panel.querySelectorAll("[data-subagent-panel-close]").forEach((button) => {
    button.addEventListener("click", () => {
      state.subagentPanelOpen = false;
      updateSubagentPanelUi();
    });
  });
}

function openSubagentPanelFromGesture() {
  if (!state.currentThread) return;
  state.subagentPanelOpen = true;
  updateSubagentPanelUi();
}

function beginSubagentSwipe(event) {
  if (!subagentSwipeAvailable()) return;
  if (event.touches && event.touches.length > 1) return;
  if (isInteractiveGestureTarget(event.target)) return;
  const touch = primaryTouch(event);
  if (!touch) return;
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
  const dx = Number(event.deltaX || 0);
  const dy = Number(event.deltaY || 0);
  if (dx >= SUBAGENT_WHEEL_SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.2) openSubagentPanelFromGesture();
}

function threadById(threadId) {
  const id = String(threadId || "");
  return state.threads.find((thread) => String(thread && thread.id || "") === id)
    || (state.currentThread && String(state.currentThread.id || "") === id ? state.currentThread : null);
}

function threadTitleForDisplay(thread) {
  return String(thread && (thread.name || thread.preview || thread.id) || "").trim();
}

function updateThreadNameLocally(threadId, name) {
  const id = String(threadId || "");
  const title = String(name || "").trim();
  if (!id || !title) return;
  const thread = state.threads.find((entry) => String(entry && entry.id || "") === id);
  if (thread) thread.name = title;
  if (state.currentThread && String(state.currentThread.id || "") === id) {
    state.currentThread.name = title;
    renderCurrentThread();
  }
  state.renderedThreadListSignature = "";
  renderThreads();
}

function cancelThreadLongPress() {
  if (state.threadLongPress && state.threadLongPress.timer) clearTimeout(state.threadLongPress.timer);
  state.threadLongPress = null;
}

function clearTextSelection() {
  try {
    const selection = window.getSelection && window.getSelection();
    if (selection && typeof selection.removeAllRanges === "function") selection.removeAllRanges();
  } catch (_) {
    // Clearing accidental mobile text selection is best-effort.
  }
}

function openThreadActionSheet(threadId) {
  const id = String(threadId || "");
  const sheet = $("threadActionSheet");
  if (!id || !sheet) return;
  const thread = threadById(id);
  if (!thread) return;
  cancelThreadLongPress();
  clearTextSelection();
  state.threadActionMenuId = id;
  const title = $("threadActionTitle");
  if (title) title.textContent = threadTitleForDisplay(thread) || "Session";
  sheet.classList.remove("hidden");
  setTimeout(clearTextSelection, 0);
  state.suppressThreadClickUntil = Date.now() + 900;
  state.suppressThreadClickThreadId = id;
}

function closeThreadActionSheet() {
  const sheet = $("threadActionSheet");
  if (sheet) sheet.classList.add("hidden");
  state.threadActionMenuId = "";
  publishPluginNavigationState();
}

function scheduleThreadLongPress(target, x, y) {
  const row = threadActionTargetRow(target);
  if (!row) return;
  const threadId = row.dataset.threadRow || "";
  if (!threadId) return;
  cancelThreadLongPress();
  state.threadLongPress = {
    threadId,
    startX: Number(x || 0),
    startY: Number(y || 0),
    timer: setTimeout(() => openThreadActionSheet(threadId), 560),
  };
}

function moveThreadLongPress(x, y) {
  const press = state.threadLongPress;
  if (!press) return;
  if (Math.abs(Number(x || 0) - press.startX) > 12 || Math.abs(Number(y || 0) - press.startY) > 12) {
    cancelThreadLongPress();
  }
}

function handleThreadListContextMenu(event) {
  const row = threadActionTargetRow(event.target);
  if (!row) return;
  event.preventDefault();
  openThreadActionSheet(row.dataset.threadRow || "");
}

function beginThreadLongPress(event) {
  if (event.button != null && event.button !== 0) return;
  scheduleThreadLongPress(event.target, event.clientX, event.clientY);
}

function moveThreadLongPressPointer(event) {
  moveThreadLongPress(event.clientX, event.clientY);
}

function beginThreadLongPressTouch(event) {
  if (event.touches && event.touches.length > 1) return;
  const touch = primaryTouch(event);
  if (!touch) return;
  scheduleThreadLongPress(event.target, touch.clientX, touch.clientY);
}

function moveThreadLongPressTouch(event) {
  const touch = primaryTouch(event);
  if (!touch) return;
  moveThreadLongPress(touch.clientX, touch.clientY);
}

function openRenameDialog(threadId) {
  const id = String(threadId || "");
  const dialog = $("renameDialog");
  const input = $("renameInput");
  if (!id || !dialog || !input) return;
  const thread = threadById(id);
  if (!thread) return;
  state.renameThreadId = id;
  input.value = threadTitleForDisplay(thread);
  dialog.classList.remove("hidden");
  setTimeout(() => {
    input.focus();
    input.select();
  }, 30);
}

function closeRenameDialog(options = {}) {
  if (state.renameBusy && !options.force) return;
  const dialog = $("renameDialog");
  if (dialog) dialog.classList.add("hidden");
  state.renameThreadId = "";
  publishPluginNavigationState();
}

function createWorkspaceDialogOpen() {
  const dialog = $("createWorkspaceDialog");
  return Boolean(dialog && !dialog.classList.contains("hidden"));
}

function workspaceCreateRootLabel() {
  return state.workspaceCreateRoot || state.workspaceCreateRoots[0] || "";
}

function setCreateWorkspaceError(message) {
  const errorNode = $("createWorkspaceError");
  if (errorNode) {
    errorNode.textContent = message || "";
    errorNode.hidden = !message;
  }
}

function setCreateWorkspaceBusy(busy) {
  state.workspaceCreateBusy = Boolean(busy);
  const input = $("createWorkspaceInput");
  const submit = $("createWorkspaceSubmit");
  const cancel = $("createWorkspaceCancel");
  if (input) input.disabled = state.workspaceCreateBusy;
  if (submit) submit.disabled = state.workspaceCreateBusy;
  if (cancel) cancel.disabled = state.workspaceCreateBusy;
}

function openCreateWorkspaceDialog() {
  if (!state.workspaceCreateEnabled) {
    showError(new Error("Workspace creation is not enabled"));
    return;
  }
  const dialog = $("createWorkspaceDialog");
  const input = $("createWorkspaceInput");
  const root = $("createWorkspaceRoot");
  if (!dialog || !input) return;
  input.value = "";
  setCreateWorkspaceError("");
  setCreateWorkspaceBusy(false);
  if (root) root.textContent = workspaceCreateRootLabel() ? `Create under ${workspaceCreateRootLabel()}` : "Create a local workspace folder";
  dialog.classList.remove("hidden");
  setTimeout(() => input.focus(), 30);
  publishPluginNavigationState({ force: true });
}

function closeCreateWorkspaceDialog(options = {}) {
  if (state.workspaceCreateBusy && !options.force) return;
  const dialog = $("createWorkspaceDialog");
  if (dialog) dialog.classList.add("hidden");
  setCreateWorkspaceBusy(false);
  setCreateWorkspaceError("");
  publishPluginNavigationState({ force: true });
}

async function selectCreatedWorkspace(workspace) {
  if (!workspace || !workspace.cwd) throw new Error("Workspace create response did not include a path");
  await loadWorkspaces();
  if (!state.workspaces.some((ws) => normalizeFsPath(ws.cwd) === normalizeFsPath(workspace.cwd))) {
    state.workspaces.push(workspace);
  }
  saveCurrentDraftNow();
  state.selectedCwd = workspace.cwd;
  clearCurrentThreadSelection({ saveDraft: false });
  state.newThreadDraft = true;
  state.sendButtonHint = "";
  state.threads = [];
  state.renderedThreadListSignature = "";
  restoreDraftForCurrentTarget();
  syncSidebarWorkspaceSelect();
  updateWorkspacePath();
  renderComposerSettings();
  renderThreads();
  renderCurrentThread();
  updateComposerControls();
  restoreConnectionState("Workspace created");
  loadThreads({ silent: true }).catch(showError);
}

async function submitCreateWorkspace(event) {
  if (event) event.preventDefault();
  if (state.workspaceCreateBusy) return;
  const input = $("createWorkspaceInput");
  const name = String(input && input.value || "").trim();
  if (!name) {
    setCreateWorkspaceError("Workspace name is required");
    if (input) input.focus();
    return;
  }
  setCreateWorkspaceBusy(true);
  setCreateWorkspaceError("");
  try {
    const result = await api("/api/workspaces", {
      method: "POST",
      timeoutMs: 30000,
      body: JSON.stringify({ name }),
    });
    closeCreateWorkspaceDialog({ force: true });
    await selectCreatedWorkspace(result && result.workspace);
  } catch (err) {
    setCreateWorkspaceError(err.message || String(err));
    setCreateWorkspaceBusy(false);
  }
}

function continuationDialogOpen() {
  const dialog = $("continuationDialog");
  return Boolean(dialog && !dialog.classList.contains("hidden"));
}

function openContinuationDialog(sourceThread) {
  const thread = sourceThread || state.currentThread || {};
  const threadId = String(thread.id || state.currentThreadId || "").trim();
  const cwd = thread.cwd ? String(thread.cwd).trim() : String(state.selectedCwd || "").trim();
  if (!cwd) {
    showError(new Error("Thread has no workspace path"));
    return false;
  }
  const dialog = $("continuationDialog");
  if (!dialog) return false;
  state.continuationDialogThreadId = threadId || "__current__";
  const title = thread.name || thread.preview || thread.id || "current thread";
  const titleNode = $("continuationTitle");
  const summaryNode = $("continuationSummary");
  if (titleNode) titleNode.textContent = `压缩续接“${title}”`;
  if (summaryNode) {
    const size = rolloutSizeText(thread);
    summaryNode.textContent = [
      "会创建一个同工作区的新线程。",
      "成功后自动归档旧线程。",
      size ? `当前 rollout 大小：${size}` : "",
    ].filter(Boolean).join(" ");
  }
  dialog.classList.remove("hidden");
  setTimeout(clearTextSelection, 0);
  publishPluginNavigationState({ force: true });
  return true;
}

function closeContinuationDialog() {
  const dialog = $("continuationDialog");
  if (dialog) dialog.classList.add("hidden");
  state.continuationDialogThreadId = "";
  publishPluginNavigationState({ force: true });
}

function pluginNavigationUiState() {
  return {
    filePreviewOpen: filePreviewOpen(),
    createWorkspaceOpen: createWorkspaceDialogOpen(),
    primaryPage: isHermesPluginPrimaryPage(),
    sidebarOpen: isSidebarOpen(),
    settingsOpen: Boolean($("themeSettingsPanel") && !$("themeSettingsPanel").classList.contains("hidden")),
  };
}

function publishPluginNavigationState(options = {}) {
  if (!isHermesEmbedMode()) return;
  syncHermesPluginPageLevel();
  const message = pluginEmbedApi.navigationMessage
    ? pluginEmbedApi.navigationMessage(state, pluginNavigationUiState())
    : null;
  if (!message) return;
  const signature = JSON.stringify(message);
  if (!options.force && signature === state.pluginNavigationSignature) return;
  state.pluginNavigationSignature = signature;
  pluginEmbedApi.postNavigation(window.parent, state, {
    targetOrigin: state.pluginParentOrigin || "*",
    ui: pluginNavigationUiState(),
  });
}

function postPluginBackResult(handled, reason) {
  if (!isHermesEmbedMode() || !pluginEmbedApi.postBackResult) return null;
  return pluginEmbedApi.postBackResult(window.parent, state, {
    targetOrigin: state.pluginParentOrigin || "*",
    ui: pluginNavigationUiState(),
    handled,
    reason,
  });
}

function handlePluginBack(event) {
  if (!isHermesEmbedMode()) return;
  if (event && typeof event.preventDefault === "function") event.preventDefault();
  if (event && typeof event.stopPropagation === "function") event.stopPropagation();
  let handled = false;
  if (filePreviewOpen()) {
    closeFilePreview();
    handled = true;
  } else if (state.renameThreadId) {
    closeRenameDialog({ force: true });
    handled = true;
  } else if (createWorkspaceDialogOpen()) {
    closeCreateWorkspaceDialog({ force: true });
    handled = true;
  } else if (state.continuationDialogThreadId) {
    closeContinuationDialog();
    handled = true;
  } else if (state.threadActionMenuId) {
    closeThreadActionSheet();
    handled = true;
  } else if (state.subagentPanelOpen) {
    state.subagentPanelOpen = false;
    cancelSubagentSwipe();
    updateSubagentPanelUi();
    renderCurrentThread();
    handled = true;
  } else if (state.currentThreadId || state.newThreadDraft || state.selectedCwd) {
    handled = showHermesPluginPrimaryPage();
  } else if (isSidebarOpen()) {
    closeSidebarMenu();
    handled = true;
  }
  publishPluginNavigationState({ force: true });
  if (handled) postPluginBackResult(true, "handled_in_iframe");
  return handled;
}

function installPluginWindowingGuards() {
  if (!isHermesEmbedMode()) return;
  const originalOpen = window.open;
  window.open = function guardedPluginOpen(url, target, features) {
    const value = String(url || "");
    if (pluginEmbedApi.isInternalUrl && pluginEmbedApi.isInternalUrl(value, window.location.origin)) {
      window.location.assign(value);
      return window;
    }
    postClientEvent("plugin_window_blocked", {
      url: value.slice(0, 240),
      target: String(target || "").slice(0, 80),
      features: String(features || "").slice(0, 160),
    });
    return null;
  };
  window.open.originalCodexMobileOpen = originalOpen;
  document.addEventListener("click", (event) => {
    const link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!link) return;
    const href = link.getAttribute("href") || "";
    const target = String(link.getAttribute("target") || "").toLowerCase();
    const internal = pluginEmbedApi.isInternalUrl ? pluginEmbedApi.isInternalUrl(href, window.location.origin) : false;
    if (target === "_blank" || !internal) {
      event.preventDefault();
      event.stopPropagation();
      if (internal) window.location.assign(new URL(href, window.location.origin).toString());
      else postClientEvent("plugin_external_link_blocked", { href: href.slice(0, 240) });
    }
  }, true);
}

async function submitRename(event) {
  event.preventDefault();
  if (state.renameBusy) return;
  const threadId = state.renameThreadId;
  const input = $("renameInput");
  const submit = $("renameSubmit");
  const name = String(input && input.value || "").trim();
  if (!threadId || !name) {
    if (input) input.focus();
    return;
  }
  state.renameBusy = true;
  if (submit) submit.disabled = true;
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "正在重命名";
  try {
    const result = await api(`/api/threads/${encodeURIComponent(threadId)}/name`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
      timeoutMs: 20000,
    });
    updateThreadNameLocally(threadId, result.name || name);
    closeRenameDialog({ force: true });
    restoreConnectionState("已重命名");
  } catch (err) {
    showError(err);
  } finally {
    state.renameBusy = false;
    if (submit) submit.disabled = false;
  }
}

function handleThreadAction(event) {
  const target = event.target.closest("[data-thread-action]");
  if (!target) return;
  event.preventDefault();
  const action = target.dataset.threadAction;
  const threadId = state.threadActionMenuId;
  if (action === "cancel") {
    closeThreadActionSheet();
    return;
  }
  if (action === "rename") {
    closeThreadActionSheet();
    openRenameDialog(threadId);
    return;
  }
  if (action === "continue") {
    const thread = threadById(threadId);
    closeThreadActionSheet();
    if (thread) startNewThreadFromThread(thread, event).catch(showError);
    return;
  }
  if (action === "archive") {
    closeThreadActionSheet();
    archiveThread(threadId, target).catch(showError);
  }
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
    const pathText = shortPath(thread.cwd) || "聊天";
    const isWorkspaceLess = !thread.cwd;
    const timeText = formatTime(thread.updatedAt, nowMs);
    const statusIcon = statusIconHtml(thread.status, "thread-status-icon", thread.id);
    const iconKind = statusIconInfo(thread.status, thread.id)?.kind || "";
    const active = thread.id === state.currentThreadId ? " active" : "";
    const emphasis = iconKind ? ` has-status-${iconKind}` : "";
    const pendingIncomingTaskCards = Math.max(0, Number(thread && thread.pendingIncomingTaskCardCount) || 0);
    const taskCardBadge = pendingIncomingTaskCards
      ? `<div class="thread-card-task-badge" title="Pending incoming task cards">${escapeHtml(`Task ${pendingIncomingTaskCards}`)}</div>`
      : "";
    const sizeBadge = sizeText
      ? `<div class="thread-card-size${sizeWarn ? " warn" : ""}" title="Rollout file size">${escapeHtml(sizeText)}</div>`
      : "";
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
    timeBucket: Math.floor(nowMs / 60000),
    threads: state.threads.map((thread) => [
      thread.id,
      thread.name || thread.preview || thread.id,
      shortPath(thread.cwd) || "聊天",
      thread.updatedAt,
      statusText(thread.status),
      statusIconInfo(thread.status, thread.id)?.kind || "",
        state.unreadThreadIds.has(thread.id) ? 1 : 0,
        Number(thread.pendingIncomingTaskCardCount || 0),
        rolloutSizeBytes(thread),
        isRolloutOverThreshold(thread),
      ]),
    });
  if (state.renderedThreadListSignature === signature) return;
  list.innerHTML = html;
  state.renderedThreadListSignature = signature;
  list.querySelectorAll("[data-thread]").forEach((button) => {
    button.addEventListener("click", handleThreadCardClick);
  });
}

async function restoreThreadSelection() {
  if (state.currentThread) return;
  if (isHermesEmbedMode()) {
    state.startupThreadOpenPending = false;
    showHermesPluginPrimaryPage();
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
  const workspace = cwd
    ? state.workspaces.find((ws) => normalizeFsPath(ws.cwd) === normalizeFsPath(cwd))
    : null;
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
    scheduleScrollToBottomButtonUpdate();
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
  else scheduleScrollToBottomButtonUpdate();
  return true;
}

function renderHome() {
  clearInterval(state.tickTimer);
  state.tickTimer = null;
  state.subagentPanelOpen = false;
  updateSubagentPanelUi();
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
  const meta = [shortPath(thread.cwd) || "聊天", formatTime(thread.updatedAt, nowMs), sizeText ? `rollout ${sizeText}` : ""]
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
  if (!updateConversationHtml(html, signature)) {
    publishPluginNavigationState();
    return;
  }
  $("conversation").querySelectorAll("[data-home-workspace]").forEach((button) => {
    button.addEventListener("click", () => selectWorkspaceShortcut(button.dataset.homeWorkspace).catch(showError));
  });
  $("conversation").querySelectorAll("[data-home-thread]").forEach((button) => {
    button.addEventListener("click", () => loadThread(button.dataset.homeThread, { source: "home" }).catch(showError));
  });
  publishPluginNavigationState();
}

function renderStartupThreadOpening() {
  clearInterval(state.tickTimer);
  state.tickTimer = null;
  state.subagentPanelOpen = false;
  updateSubagentPanelUi();
  updateTurnTimer();
  $("threadTitle").textContent = "Opening thread";
  $("threadMeta").textContent = "Restoring your current conversation";
  $("conversation").innerHTML = `<div class="empty-state entry-animate">Opening thread...</div>`;
  state.renderedConversationSignature = "startup-thread-open-pending";
  publishPluginNavigationState();
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
  if (isRolloutWarningDismissed(thread)) return "";
  const size = rolloutSizeText(thread);
  const threshold = formatFileSize(rolloutThresholdBytes(thread));
  const key = `rollout-warning|${thread.id || state.currentThreadId}|${rolloutSizeBytes(thread)}`;
  return `<div class="rollout-warning${entryAnimationClass(key, previousKeys)}" data-render-key="${escapeHtml(key)}">
    <div class="rollout-warning-text">
      <strong>上下文文件 ${escapeHtml(size)}</strong>
      <span>已达到 ${escapeHtml(threshold)} 阈值。建议压缩续接：创建带详细上下文的新线程后归档旧线程。</span>
    </div>
    <div class="rollout-warning-actions">
      <button class="rollout-skip" type="button" data-dismiss-rollout-warning>跳过</button>
      <button class="rollout-new-thread" type="button" data-new-thread-from-current>压缩续接</button>
    </div>
  </div>`;
}

function renderThreadTaskToolbar(thread) {
  if (!thread || !thread.id) return "";
  return `<div class="rollout-warning-actions thread-task-toolbar">
    <button class="approval-button allow" type="button" data-create-thread-task-card>Send task card</button>
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
  if (state.newThreadDraft) {
    renderNewThreadDraft();
    return;
  }
  const thread = state.currentThread;
  if (!thread) {
    if (state.startupThreadOpenPending) {
      renderStartupThreadOpening();
      return;
    }
    renderHome();
    return;
  }
  updateSubagentPanelUi();
  const nearBottom = isConversationNearBottom();
  const userReadingCurrentTurn = isUserReadingCurrentTurn({ nearBottom });
  const shouldFollowBottom = !userReadingCurrentTurn
    && (shouldFollowSubmittedMessageToBottom() || shouldFollowViewportChangeToBottom());
  const shouldStickToBottom = !userReadingCurrentTurn
    && (shouldFollowBottom
      || (!shouldHoldAutoScrollForCurrentTurn()
        && (options.stickToBottom === true || nearBottom)));
  const previousKeys = existingConversationRenderKeys();
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
    publishPluginNavigationState();
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
    if (retry) retry.onclick = () => loadThread(thread.id || state.currentThreadId, { source: "retry" }).catch(showError);
    updateTickTimer();
    publishPluginNavigationState();
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
  const taskToolbar = renderThreadTaskToolbar(thread);
  const pluginRefreshNotice = renderPluginRefreshPendingNotice(previousKeys);
  const visibleTurnIds = new Set(turns.map((turn) => turn && turn.id).filter(Boolean).map(String));
  resetCopyTextStore();
  const turnsHtml = turns.map((turn) => renderTurn(turn, previousKeys)).join("");
  const taskCardsHtml = renderThreadTaskCards(thread, previousKeys);
  const approvalsHtml = renderPendingApprovals(thread, previousKeys, (request) => {
    const turnId = approvalTurnId(request);
    if (turnId && visibleTurnIds.has(turnId)) return false;
    return isApprovalActive(request);
  });
  const emptyMessage = readWarningMessage
    ? "暂时没有可显示的完整消息。共享模式恢复后刷新这个页面即可继续读取。"
    : "No visible turns.";
    const html = rolloutWarning + taskToolbar + omittedBanner + readWarning + (turnsHtml || approvalsHtml || taskCardsHtml ? `${turnsHtml}${approvalsHtml}${taskCardsHtml}${pluginRefreshNotice}` : `${pluginRefreshNotice || ""}<div class="empty-state entry-animate">${escapeHtml(emptyMessage)}</div>`);
  updateConversationHtml(html, conversationRenderSignature(thread), { stickToBottom: shouldStickToBottom });
  bindCurrentThreadActions();
  applyPendingPluginRouteHintFocus();
  updateTickTimer();
  publishPluginNavigationState();
}

function renderNewThreadDraft() {
  clearInterval(state.tickTimer);
  state.tickTimer = null;
  state.subagentPanelOpen = false;
  updateSubagentPanelUi();
  const titleEl = $("threadTitle");
  const metaEl = $("threadMeta");
  const workspaceLabel = selectedWorkspaceLabel();
  if (titleEl) titleEl.textContent = "新建对话";
  if (metaEl) metaEl.textContent = state.selectedCwd ? workspaceLabel : "请先选择 Workspace";
  const workspaceOptions = newThreadWorkspaceOptionsHtml();
  const hasWorkspaceOptions = state.workspaces.length > 0;
  const workspaceStatus = state.selectedCwd
    ? `<div class="new-thread-path">${escapeHtml(state.selectedCwd)}</div>`
    : `<div class="new-thread-path">请先在侧边栏或下方选择 workspace</div>`;
  const selectedModel = newThreadSelectedModel();
  const selectedEffort = newThreadSelectedEffort();
  const selectedPermission = newThreadSelectedPermissionMode();
  const pluginRefreshNotice = renderPluginRefreshPendingNotice();
  const html = `<div class="new-thread-page">
    <div class="new-thread-panel">
      ${pluginRefreshNotice}
      <div class="new-thread-kicker">New chat</div>
      <h1>新建对话</h1>
      <div class="new-thread-workspace">
        <label for="newThreadWorkspaceSelect">Workspace</label>
        <button id="newThreadWorkspaceSelect" class="new-thread-workspace-select" type="button" aria-haspopup="listbox" aria-expanded="false">
          ${escapeHtml(workspaceLabel)}
        </button>
        <div id="newThreadWorkspaceMenu" class="new-thread-workspace-menu" role="listbox" aria-label="Workspace 列表" hidden>
          ${workspaceOptions || `<div class="new-thread-workspace-empty">暂无可用 Workspace</div>`}
        </div>
        <div class="new-thread-selected">${escapeHtml(workspaceLabel)}</div>
        ${workspaceStatus}
      </div>
    </div>
  </div>`;
  updateConversationHtml(html, `new-thread|${state.selectedCwd}|${state.workspaces.length}|${selectedModel}|${selectedEffort}|${selectedPermission}`);
  const selectButton = $("newThreadWorkspaceSelect");
  const workspaceMenu = $("newThreadWorkspaceMenu");
  const shouldDisableWorkspaceSelect = !hasWorkspaceOptions;
  if (selectButton && workspaceMenu) {
    selectButton.textContent = workspaceLabel;
    selectButton.disabled = shouldDisableWorkspaceSelect;
    selectButton.setAttribute("title", shouldDisableWorkspaceSelect ? "暂无可用 Workspace" : "选择 Workspace");
    workspaceMenu.hidden = true;
    const closeMenu = () => {
      workspaceMenu.hidden = true;
      workspaceMenu.style.removeProperty("--workspace-menu-max-height");
      selectButton.setAttribute("aria-expanded", "false");
      document.removeEventListener("pointerdown", onOutsidePointer);
    };
    const onOutsidePointer = (event) => {
      if (!workspaceMenu.hidden && !workspaceMenu.contains(event.target) && !selectButton.contains(event.target)) {
        closeMenu();
      }
    };
    const openMenu = () => {
      workspaceMenu.hidden = false;
      fitWorkspaceMenuToViewport(workspaceMenu, selectButton);
      selectButton.setAttribute("aria-expanded", "true");
      document.addEventListener("pointerdown", onOutsidePointer);
    };
    const toggleMenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (shouldDisableWorkspaceSelect) return;
      if (workspaceMenu.hidden) {
        openMenu();
      } else {
        closeMenu();
      }
    };
    selectButton.addEventListener("pointerdown", toggleMenu);
    if (workspaceMenu) {
      workspaceMenu.querySelectorAll("[data-new-thread-workspace]").forEach((workspaceOption) => {
        workspaceOption.addEventListener("click", (event) => {
          const selectedWorkspace = event.currentTarget.dataset.newThreadWorkspace || "";
          event.preventDefault();
          event.stopPropagation();
          saveCurrentDraftNow();
          state.selectedCwd = selectedWorkspace || "";
          restoreDraftForCurrentTarget();
          const sidebarSelect = $("workspaceSelect");
          if (sidebarSelect) sidebarSelect.textContent = state.selectedCwd ? selectedWorkspaceLabel() : "All workspaces";
          syncSidebarWorkspaceSelect();
          updateWorkspacePath();
          renderNewThreadDraft();
          updateComposerControls();
          loadThreads({ silent: true }).catch(showError);
          closeMenu();
        });
      });
    }
    if (shouldDisableWorkspaceSelect) {
      workspaceMenu.hidden = true;
    }
  }
  renderComposerSettings();
  updateComposerControls();
  updateTurnTimer();
  publishPluginNavigationState();
}

function enterNewThreadDraft() {
  saveCurrentDraftNow();
  clearCurrentThreadSelection({ saveDraft: false });
  state.newThreadDraft = true;
  state.sendButtonHint = "";
  restoreDraftForCurrentTarget();
  renderComposerSettings();
  renderThreads();
  renderCurrentThread();
  restoreConnectionState();
  if (isMobileViewport()) closeSidebarMenu();
  window.setTimeout(() => {
    const input = $("messageInput");
    if (input) input.focus();
  }, 80);
}

function bindCurrentThreadActions() {
  const button = $("conversation").querySelector("[data-new-thread-from-current]");
  if (button) button.addEventListener("click", startNewThreadFromCurrent);
  const taskButton = $("conversation").querySelector("[data-create-thread-task-card]");
  if (taskButton) taskButton.addEventListener("click", createThreadTaskCardFromCurrent);
  const dismiss = $("conversation").querySelector("[data-dismiss-rollout-warning]");
  if (dismiss) dismiss.addEventListener("click", () => dismissRolloutWarning(state.currentThread));
}

function findThreadTaskCard(cardId) {
  const cards = threadTaskCardsForThread(state.currentThread || {});
  return cards.find((card) => card.id === String(cardId || "")) || null;
}

function summarizeTaskCardText(value) {
  return truncateSingleLine(String(value || "").replace(/\s+/g, " ").trim(), 280);
}

function isThreadTaskCardCommandText(value) {
  return String(value || "").trim().startsWith("#");
}

function threadTaskCardCommandText(value) {
  return String(value || "").trim().replace(/^#+\s*/, "").trim();
}

function threadTaskCardVisibleTargets() {
  return (state.threads || [])
    .filter((thread) => thread && thread.id && thread.id !== state.currentThreadId)
    .slice(0, 40)
    .map((thread) => ({
      threadId: String(thread.id || ""),
      title: threadTitleForDisplay(thread) || String(thread.id || ""),
      cwd: String(thread.cwd || ""),
    }));
}

function buildThreadTaskCardDraftRequestText(commandText) {
  const original = String(commandText || "").trim();
  const compactCommand = threadTaskCardCommandText(original);
  if (!compactCommand) throw new Error("Task-card command is empty");
  const sourceThread = state.currentThread || {};
  const envelope = {
    version: 1,
    sourceThreadId: String(state.currentThreadId || ""),
    sourceThreadTitle: threadTitleForDisplay(sourceThread) || String(state.currentThreadId || ""),
    availableTargets: threadTaskCardVisibleTargets(),
  };
  return [
    original,
    "",
    `<${THREAD_TASK_CARD_REQUEST_TAG}>`,
    JSON.stringify(envelope, null, 2),
    `</${THREAD_TASK_CARD_REQUEST_TAG}>`,
    "",
    "Interpret the # command above as a cross-thread pending task card request.",
    "Return only one XML block in exactly this format:",
    `<${THREAD_TASK_CARD_DRAFT_TAG}>`,
    "{\"targetThreadIds\":[\"one or more exact threadId values from availableTargets\"],\"title\":\"short title\",\"summary\":\"one-line summary\",\"body\":\"full markdown body\",\"error\":\"\"}",
    `</${THREAD_TASK_CARD_DRAFT_TAG}>`,
    "Rules:",
    "- Choose one or more targetThreadIds only from availableTargets.threadId.",
    "- Do not invent a thread id; when the request names multiple clear targets, include all of them.",
    "- If the command is unclear or no target fits, set targetThreadIds to an empty array and explain the problem in error.",
    "- Keep title under 120 chars and summary under 280 chars.",
    "- Put the actual requested work in body.",
    "- Do not add any explanation outside the XML block.",
  ].join("\n");
}

function threadTaskCardRequestMarkerMatch(value) {
  const text = String(value || "");
  const pattern = new RegExp(`\\n\\s*<${THREAD_TASK_CARD_REQUEST_TAG}>[\\s\\S]*?<\\/${THREAD_TASK_CARD_REQUEST_TAG}>[\\s\\S]*$`, "i");
  return pattern.exec(text);
}

function uniqueThreadTaskCardTargetIds(values, fallbackValue = "") {
  const raw = Array.isArray(values) && values.length ? values : [fallbackValue];
  const seen = new Set();
  const ids = [];
  for (const value of raw) {
    const id = String(value || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= 12) break;
  }
  return ids;
}

function visibleThreadTaskCardCommandText(value) {
  const text = String(value || "");
  const match = threadTaskCardRequestMarkerMatch(text);
  return match ? text.slice(0, match.index).trimEnd() : text;
}

function parseThreadTaskCardDraftText(value) {
  const text = String(value || "");
  const match = new RegExp(`<${THREAD_TASK_CARD_DRAFT_TAG}>\\s*([\\s\\S]*?)\\s*<\\/${THREAD_TASK_CARD_DRAFT_TAG}>`, "i").exec(text);
  if (!match) return null;
  let parsed;
  try {
    parsed = JSON.parse(match[1]);
  } catch (_) {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const targetThreadIds = uniqueThreadTaskCardTargetIds(parsed.targetThreadIds, parsed.targetThreadId);
  return {
    rawText: text,
    targetThreadId: targetThreadIds[0] || "",
    targetThreadIds,
    title: truncateSingleLine(String(parsed.title || "").trim(), 120),
    summary: truncateSingleLine(String(parsed.summary || "").trim(), 280),
    body: String(parsed.body || "").trim(),
    error: truncateSingleLine(String(parsed.error || "").trim(), 280),
  };
}

function hasThreadTaskCardDraftTag(value) {
  return String(value || "").includes(`<${THREAD_TASK_CARD_DRAFT_TAG}>`);
}

function turnHasThreadTaskCardRequest(turn) {
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  return items.some((item) => {
    if (!item || item.type !== "userMessage") return false;
    const parts = Array.isArray(item.content) ? item.content : [];
    return parts.some((part) => isInputTextPart(part) && Boolean(threadTaskCardRequestMarkerMatch(inputTextValue(part))));
  });
}

function turnHasThreadTaskCardDraftResponse(turn) {
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  return items.some((item) => item && (item.type === "agentMessage" || item.type === "plan") && hasThreadTaskCardDraftTag(item.text || ""));
}

function renderTurnThreadTaskCardDraft(turn, previousKeys = new Set()) {
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  for (const item of items) {
    if (!item || (item.type !== "agentMessage" && item.type !== "plan")) continue;
    const text = String(item.text || "");
    const draft = parseThreadTaskCardDraftText(text);
    if (draft) {
      const draftKey = threadTaskCardDraftKey(turn.id, item.id || "");
      let draftState = threadTaskCardDraftState(draftKey);
      if (draftState.status === "created" || draftState.status === "dismissed") return "";
      if (draftState.status === "pending") {
        queueThreadTaskCardDraftCreation(draftKey);
        draftState = Object.assign({}, draftState, { status: "creating" });
      }
      if (draftState.status === "creating") return renderPendingThreadTaskCardDraft("Sending cross-thread task card...", "Sending");
      return renderThreadTaskCardDraft(draft, item, turn, previousKeys);
    }
    if (hasThreadTaskCardDraftTag(text)) {
      return renderPendingThreadTaskCardDraft("Generating cross-thread task card draft...", "Generating");
    }
  }
  return "";
}

function renderPendingThreadTaskCardDraft(message, status = "Generating") {
  const detail = escapeHtml(String(message || "Generating cross-thread task card draft..."));
  return `<section class="approval-card thread-task-card-draft pending synthetic">
    <div class="approval-head">
      <div>
        <div class="approval-title">Cross-thread task card draft</div>
        <div class="approval-method">Pending</div>
      </div>
      <span class="approval-status">${escapeHtml(String(status || "Generating"))}</span>
    </div>
    <div class="approval-summary-line">${detail}</div>
  </section>`;
}

function threadTaskCardDraftKey(turnId, itemId) {
  return `task-card-draft|${String(turnId || "")}|${String(itemId || "")}`;
}

function findThreadById(threadId) {
  const id = String(threadId || "").trim();
  return (state.threads || []).find((thread) => String(thread && thread.id || "") === id) || null;
}

function threadTaskCardDraftTargetIds(draft) {
  return uniqueThreadTaskCardTargetIds(draft && draft.targetThreadIds, draft && draft.targetThreadId);
}

function threadTaskCardDraftTargetThreads(draft) {
  return threadTaskCardDraftTargetIds(draft).map((threadId) => ({
    threadId,
    thread: findThreadById(threadId),
  }));
}

function upsertThreadTaskCardOnThread(thread, card) {
  if (!thread || !card) return;
  const existing = Array.isArray(thread.threadTaskCards) ? thread.threadTaskCards : [];
  thread.threadTaskCards = [card, ...existing.filter((entry) => String(entry && entry.id || "") !== String(card.id || ""))];
}

function incrementPendingIncomingTaskCardCount(threadId, delta = 1) {
  const thread = findThreadById(threadId);
  const currentThread = state.currentThread && String(state.currentThread.id || "") === String(threadId || "") ? state.currentThread : null;
  const base = thread || currentThread;
  if (!base) return;
  const current = Math.max(0, Number(base.pendingIncomingTaskCardCount) || 0);
  const next = Math.max(0, current + Number(delta || 0));
  const outgoing = Math.max(0, Number(base.pendingOutgoingTaskCardCount) || 0);
  if (thread) {
    thread.pendingIncomingTaskCardCount = next;
    thread.pendingTaskCardCount = next + outgoing;
  }
  if (currentThread) {
    currentThread.pendingIncomingTaskCardCount = next;
    currentThread.pendingTaskCardCount = next + outgoing;
  }
}

function incrementPendingOutgoingTaskCardCount(threadId, delta = 1) {
  const thread = findThreadById(threadId);
  const currentThread = state.currentThread && String(state.currentThread.id || "") === String(threadId || "") ? state.currentThread : null;
  const base = thread || currentThread;
  if (!base) return;
  const current = Math.max(0, Number(base.pendingOutgoingTaskCardCount) || 0);
  const next = Math.max(0, current + Number(delta || 0));
  const incoming = Math.max(0, Number(base.pendingIncomingTaskCardCount) || 0);
  if (thread) {
    thread.pendingOutgoingTaskCardCount = next;
    thread.pendingTaskCardCount = incoming + next;
  }
  if (currentThread) {
    currentThread.pendingOutgoingTaskCardCount = next;
    currentThread.pendingTaskCardCount = incoming + next;
  }
}

function settleCurrentThreadTaskCard(cardId, nextStatus, nextCard = null) {
  const thread = state.currentThread;
  if (!thread || !Array.isArray(thread.threadTaskCards)) return;
  const id = String(cardId || "").trim();
  if (!id) return;
  let settledCard = null;
  thread.threadTaskCards = thread.threadTaskCards.map((entry) => {
    if (String(entry && entry.id || "") !== id) return entry;
    settledCard = Object.assign({}, entry || {}, nextCard || {}, { status: nextStatus || (nextCard && nextCard.status) || entry.status });
    return settledCard;
  });
  if (!settledCard) return;
  if (settledCard.threadRole === "incoming") incrementPendingIncomingTaskCardCount(thread.id, -1);
  if (settledCard.threadRole === "outgoing") incrementPendingOutgoingTaskCardCount(thread.id, -1);
  renderThreads();
  renderCurrentThread();
}

function resolveTargetThreadReference(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const lowered = raw.toLowerCase();
  return state.threads.find((thread) => thread
    && thread.id !== state.currentThreadId
    && (
      String(thread.id || "").toLowerCase() === lowered
      || String(threadTitleForDisplay(thread) || "").trim().toLowerCase() === lowered
    )) || null;
}

function resolveTargetThreadReferences(input) {
  const parts = String(input || "")
    .split(/[\n,;，；]+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  const seen = new Set();
  const targets = [];
  for (const part of parts) {
    const thread = resolveTargetThreadReference(part);
    const id = String((thread && thread.id) || part || "").trim();
    if (!id || id === state.currentThreadId || seen.has(id)) continue;
    seen.add(id);
    targets.push({ threadId: id, thread });
    if (targets.length >= 12) break;
  }
  return targets;
}

async function refreshCurrentThreadAfterTaskCard() {
  if (!state.currentThreadId) return;
  await refreshCurrentThread();
  loadThreads({ silent: true }).catch(showError);
}

function currentThreadHasTurn(turnId) {
  const targetTurnId = String(turnId || "").trim();
  if (!targetTurnId || !state.currentThread) return false;
  const turns = Array.isArray(state.currentThread.turns) ? state.currentThread.turns : [];
  return turns.some((turn) => String(turn && turn.id || "") === targetTurnId);
}

async function waitForCurrentThreadTurn(turnId, options = {}) {
  const targetTurnId = String(turnId || "").trim();
  if (!targetTurnId || !state.currentThreadId) return false;
  const timeoutMs = Math.max(500, Number(options.timeoutMs) || 10000);
  const intervalMs = Math.max(150, Number(options.intervalMs) || 500);
  const deadline = Date.now() + timeoutMs;
  while (state.currentThreadId && Date.now() <= deadline) {
    await refreshCurrentThread();
    if (!state.currentThreadId) return false;
    if (currentThreadHasTurn(targetTurnId)) {
      state.pendingPluginRouteHint = normalizePluginRouteHint({
        pluginId: "codex-mobile",
        route: "thread-turn",
        threadId: state.currentThreadId,
        itemId: targetTurnId,
      });
      renderCurrentThread();
      return true;
    }
    await sleep(intervalMs);
  }
  return currentThreadHasTurn(targetTurnId);
}

async function createThreadTaskCardFromCurrent(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const thread = state.currentThread;
  if (!thread || !thread.id) return;
  const targetInput = window.prompt("Target thread id or exact title; separate multiple targets with commas", "");
  if (targetInput == null) return;
  const targets = resolveTargetThreadReferences(targetInput);
  if (!targets.length) {
    showError(new Error("At least one different target thread is required"));
    return;
  }
  const title = window.prompt("Task card title", `Need response from ${threadTitleForDisplay(thread) || thread.id}`) || "";
  if (!String(title).trim()) return;
  const body = window.prompt("Task card body", "") || "";
  if (!String(body).trim()) return;
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "Creating task card";
  try {
    const targetWorkspaceIds = {};
    for (const target of targets) {
      if (target.thread) targetWorkspaceIds[target.threadId] = String(target.thread.cwd || "");
    }
    await api("/api/thread-task-cards", {
      method: "POST",
      body: JSON.stringify({
        sourceWorkspaceId: thread.cwd || state.selectedCwd || "",
        sourceThreadId: thread.id,
        sourceTurnId: currentLiveTurn() ? currentLiveTurn().id : "",
        sourceThreadTitle: threadTitleForDisplay(thread) || thread.id,
        targetThreadIds: targets.map((target) => target.threadId),
        targetWorkspaceIds,
        idempotencyKey: `task-card:${thread.id}:${Date.now()}:${Math.random().toString(16).slice(2, 8)}`,
        format: "markdown",
        title: String(title).trim(),
        summary: summarizeTaskCardText(body),
        body: String(body).trim(),
      }),
      timeoutMs: 30000,
    });
    $("connectionState").textContent = "Task card created";
    await refreshCurrentThreadAfterTaskCard();
  } catch (err) {
    showError(err);
  }
}

function startThreadRequestBody(sourceThread = null, options = {}) {
  const thread = sourceThread || state.currentThread || {};
  return {
    cwd: thread.cwd || state.selectedCwd || "",
    sourceThreadId: thread.id || "",
    sourceThreadTitle: thread.name || thread.preview || thread.id || "",
    archiveSourceThread: Boolean(options.archiveSourceThread && thread.id),
  };
}

function threadActionTargetRow(target) {
  if (!target || !target.closest) return null;
  return target.closest("[data-thread-row]");
}

function primaryTouch(event) {
  return (event.touches && event.touches[0])
    || (event.changedTouches && event.changedTouches[0])
    || null;
}

function startedThreadId(result) {
  return String((result && result.threadId)
    || (result && result.thread && result.thread.id)
    || (result && result.result && result.result.thread && result.result.thread.id)
    || (result && result.result && result.result.threadId)
    || "");
}

function startedTurnId(result) {
  return String((result && result.turnId)
    || (result && result.turn && result.turn.id)
    || (result && result.result && result.result.turnId)
    || (result && result.result && result.result.turn && result.result.turn.id)
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
  await loadThread(threadId, { source: "continuation" });
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
  if (state.continuationBusy) return;
  const thread = sourceThread || state.currentThread || {};
  if (!continuationDialogOpen()) {
    openContinuationDialog(thread);
    return;
  }
  const button = event && event.currentTarget;
  const cwd = thread.cwd ? String(thread.cwd).trim() : String(state.selectedCwd || "").trim();
  closeContinuationDialog();
  const sourceThreadId = thread.id || state.currentThreadId || "";
  const body = {
    cwd,
    sourceThreadId: thread.id || "",
    sourceThreadTitle: thread.name || thread.preview || thread.id || "",
    archiveSourceThread: Boolean(thread.id),
  };
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

async function archiveThread(threadId, button = null) {
  const id = String(threadId || "");
  const thread = state.threads.find((entry) => entry.id === id);
  if (!thread) {
    showError(new Error("Thread is no longer in the current list"));
    return;
  }
  const title = threadTitleForDisplay(thread) || "会话";
  const archiveConfirmed = window.confirm(`归档“${title}”？`);
  if (!archiveConfirmed) return;
  if (button) button.disabled = true;
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "正在归档会话";
  markActivity("归档会话");
  try {
    await api(`/api/threads/${encodeURIComponent(thread.id)}/archive`, { method: "POST", timeoutMs: 30000 });
    if (state.currentThreadId === thread.id) {
      clearCurrentThreadSelection();
      renderCurrentThread();
    }
    loadThreads().catch(showError);
  } catch (err) {
    showError(err);
  } finally {
    if (button) button.disabled = false;
  }
}

function taskCardStatusLabel(status) {
  const text = String(status || "pending");
  return {
    pending: "Pending",
    approved: "Approved",
    deleted: "Deleted",
    revoked: "Revoked",
    replied: "Replied",
  }[text] || text;
}

function taskCardDirectionLabel(card) {
  if (!card) return "Task card";
  if (card.threadRole === "target") {
    return `Task card from ${card.source && (card.source.title || card.source.threadId || card.source.workspaceId || "source thread")}`;
  }
  if (card.threadRole === "source") {
    return `Task card to ${card.target && (card.target.threadId || card.target.workspaceId || "target thread")}`;
  }
  return "Task card";
}

function taskCardDetailLines(card) {
  if (!card) return [];
  return [
    card.target && card.threadRole === "source" ? `Target thread: ${card.target.threadId}` : "",
    card.source && card.threadRole === "target" ? `Source workspace: ${card.source.workspaceId}` : "",
    card.injectedTurnId ? `Injected turn: ${card.injectedTurnId}` : "",
  ].filter(Boolean);
}

function threadTaskCardSummaryLine(text) {
  return truncateSingleLine(String(text || "").trim(), 220);
}

function renderThreadTaskCardExpandable(preview, sections) {
  const blocks = (Array.isArray(sections) ? sections : []).filter(Boolean);
  if (!blocks.length) return "";
  return `<details class="approval-details">
    <summary><span>${escapeHtml(threadTaskCardSummaryLine(preview) || "Show details")}</span></summary>
    ${blocks.join("")}
  </details>`;
}

function renderThreadTaskCardActions(card) {
  if (!card) return "";
  if (card.canApprove || card.canDelete || card.canReply || card.canRevoke) {
    const buttons = [];
    if (card.canApprove) buttons.push(`<button class="approval-button allow" type="button" data-task-card-action="approve" data-task-card-id="${escapeHtml(card.id)}">Approve</button>`);
    if (card.canReply) buttons.push(`<button class="approval-button allow" type="button" data-task-card-action="reply" data-task-card-id="${escapeHtml(card.id)}">Reply</button>`);
    if (card.canDelete) buttons.push(`<button class="approval-button deny" type="button" data-task-card-action="delete" data-task-card-id="${escapeHtml(card.id)}">Delete</button>`);
    if (card.canRevoke) buttons.push(`<button class="approval-button deny" type="button" data-task-card-action="revoke" data-task-card-id="${escapeHtml(card.id)}">Revoke</button>`);
    return `<div class="approval-actions">${buttons.join("")}</div>`;
  }
  return "";
}

function renderThreadTaskCard(card, previousKeys = new Set()) {
  const key = `task-card|${card.id}`;
  const status = String(card.status || "pending");
  const detail = taskCardDetailLines(card).join("\n");
  const summary = threadTaskCardSummaryLine(card.message && card.message.summary ? card.message.summary : "");
  const body = card.message && card.message.body ? `<pre class="approval-detail">${escapeHtml(card.message.body)}</pre>` : "";
  const compact = status !== "pending" ? " compact" : "";
  const detailBlocks = [
    detail ? `<pre class="approval-detail">${escapeHtml(detail)}</pre>` : "",
    body,
  ];
  return `<section class="approval-card thread-task-card${compact}${entryAnimationClass(key, previousKeys)} ${escapeHtml(status)}" data-render-key="${escapeHtml(key)}" data-task-card="${escapeHtml(card.id)}">
    <div class="approval-head">
      <div>
        <div class="approval-title">${escapeHtml(taskCardDirectionLabel(card))}</div>
        <div class="approval-method">${escapeHtml(card.message && card.message.title || "Task card")}</div>
      </div>
      <span class="approval-status">${escapeHtml(taskCardStatusLabel(status))}</span>
    </div>
    ${summary ? `<div class="approval-summary-line">${escapeHtml(summary)}</div>` : ""}
    ${renderThreadTaskCardExpandable(summary || detail || (card.message && card.message.title) || "Task card details", detailBlocks)}
    ${renderThreadTaskCardActions(card)}
  </section>`;
}

function renderThreadTaskCards(thread, previousKeys = new Set()) {
  const cards = threadTaskCardsForThread(thread);
  if (!cards.length) return "";
  return `<div class="approval-stack thread-task-card-stack">
    ${cards.map((card) => renderThreadTaskCard(card, previousKeys)).join("")}
  </div>`;
}

function threadTaskCardDraftState(key) {
  return state.threadTaskCardDraftStates.get(String(key || "")) || { status: "pending", error: "", cardId: "" };
}

function threadTaskCardDraftStatusLabel(status) {
  return {
    pending: "Draft",
    creating: "Creating",
    created: "Created",
    dismissed: "Dismissed",
    failed: "Failed",
  }[status] || "Draft";
}

function threadTaskCardDraftDetailLines(draft, targetRefs, draftState) {
  const refs = Array.isArray(targetRefs) ? targetRefs : [];
  const targetLine = refs.length
    ? `Target threads: ${refs.map((entry) => {
      const thread = entry && entry.thread;
      return thread ? (thread.title || thread.id || entry.threadId) : (entry && entry.threadId || "");
    }).filter(Boolean).join(", ")}`
    : "";
  const missing = refs.filter((entry) => entry && !entry.thread).map((entry) => entry.threadId).filter(Boolean);
  return [
    targetLine,
    missing.length ? `Missing targets: ${missing.join(", ")}` : "",
    draft.error ? `Model note: ${draft.error}` : "",
    draftState.error ? `Last error: ${draftState.error}` : "",
  ].filter(Boolean);
}

function renderThreadTaskCardDraftActions(draftKey, draft, draftState) {
  if (!draft || draftState.status === "pending" || draftState.status === "creating" || draftState.status === "created" || draftState.status === "dismissed") return "";
  if (draftState.status === "failed") {
    return `<div class="approval-actions">
      <button class="approval-button deny" type="button" data-task-card-draft-action="dismiss" data-task-card-draft-key="${escapeHtml(draftKey)}">Dismiss</button>
    </div>`;
  }
  return `<div class="approval-actions">
    <button class="approval-button deny" type="button" data-task-card-draft-action="dismiss" data-task-card-draft-key="${escapeHtml(draftKey)}">Dismiss</button>
  </div>`;
}

function renderThreadTaskCardDraft(draft, item, turn, previousKeys = new Set()) {
  if (!draft || !item || !turn) return "";
  const draftKey = threadTaskCardDraftKey(turn.id, item.id || "");
  const draftState = threadTaskCardDraftState(draftKey);
  const targetRefs = threadTaskCardDraftTargetThreads(draft);
  const compact = draftState.status === "created" || draftState.status === "dismissed" ? " compact" : "";
  const detail = threadTaskCardDraftDetailLines(draft, targetRefs, draftState).join("\n");
  const summary = threadTaskCardSummaryLine(draft.summary || draft.error || "");
  const detailBlocks = [
    detail ? `<pre class="approval-detail">${escapeHtml(detail)}</pre>` : "",
    draft.body ? `<pre class="approval-detail">${escapeHtml(draft.body)}</pre>` : "",
  ];
  return `<section class="approval-card thread-task-card-draft${compact}${entryAnimationClass(draftKey, previousKeys)} ${escapeHtml(draftState.status)}" data-render-key="${escapeHtml(draftKey)}" data-task-card-draft="${escapeHtml(draftKey)}">
    <div class="approval-head">
      <div>
        <div class="approval-title">Cross-thread task card draft</div>
        <div class="approval-method">${escapeHtml(draft.title || "Task card draft")}</div>
      </div>
      <span class="approval-status">${escapeHtml(threadTaskCardDraftStatusLabel(draftState.status))}</span>
    </div>
    ${summary ? `<div class="approval-summary-line">${escapeHtml(summary)}</div>` : ""}
    ${renderThreadTaskCardExpandable(summary || detail || draft.title || "Task card draft details", detailBlocks)}
    ${renderThreadTaskCardDraftActions(draftKey, draft, draftState)}
  </section>`;
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
    .sort((a, b) => (a.sourceIndex - b.sourceIndex) || (a.order - b.order))
    .map((entry) => entry.html)
    .join("");
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  const turnApprovals = approvalsForTurn(threadId, turn.id);
  const approvalsHtml = turnApprovals.length
    ? `<div class="approval-stack in-turn">${turnApprovals.map((request) => renderApprovalRequest(request, previousKeys)).join("")}</div>`
    : "";
  const draftHtml = renderTurnThreadTaskCardDraft(turn, previousKeys);
  const pendingDraftHtml = !draftHtml && !turnHasThreadTaskCardDraftResponse(turn) && isLatestTurn(turn) && isLiveTurn(turn) && turnHasThreadTaskCardRequest(turn)
    ? renderPendingThreadTaskCardDraft("Generating cross-thread task card draft...", "Generating")
    : "";
  if (!items.trim() && !approvalsHtml.trim() && !draftHtml.trim() && !pendingDraftHtml.trim()) return "";
  const turnKey = stableTurnKey(turn);
  const statusKey = stableTurnKey(turn, "status");
  const duration = turn.durationMs ? ` | ${formatElapsedTime(Math.round(turn.durationMs / 1000))}` : "";
  const timerShowsStatus = isLatestTurn(turn) && (isLiveTurn(turn) || turnFinalSeconds(turn) != null);
  const showStatusLine = !timerShowsStatus;
  return `<article class="turn" data-turn="${escapeHtml(turn.id)}" data-render-key="${escapeHtml(turnKey)}">
    ${items}${approvalsHtml}
    ${showStatusLine ? `<div class="turn-status${entryAnimationClass(statusKey, previousKeys)}" data-render-key="${escapeHtml(statusKey)}">${escapeHtml(displayTurnStatus(turn))}${duration}</div>` : ""}
    ${draftHtml}${pendingDraftHtml}
  </article>`;
}

function renderLiveOperation(item, turn, previousKeys = new Set(), index = 0) {
  const status = statusText(item.status) || (item.completedAtMs ? "completed" : "running");
  const key = stableOperationRenderKey(turn, item, index);
  return renderOperationCard(item, key, { status });
}

function renderOperationCard(item, key, options = {}) {
  const status = options.status || statusText(item.status) || (item.completedAtMs ? "completed" : "running");
  const type = options.type || item.type || "item";
  const title = operationTitle(item);
  const detail = operationDetailText(item);
  const durationData = operationDurationData(item, status);
  const duration = durationData
    ? `<time class="operation-duration" ${operationDurationAttrs(durationData)} title="${escapeHtml(`Elapsed ${durationData.text}`)}">${escapeHtml(durationData.text)}</time>`
    : "";
  const classes = [
    "item",
    "live-operation",
    options.extraClass || "",
    isCompletedStatus(status) ? "completed" : "",
    type,
  ].filter(Boolean).map(escapeHtml).join(" ");
  const body = detail
    ? `<div class="operation-detail-line"><span class="operation-detail">${escapeHtml(detail)}</span></div>`
    : "";
  return `<section class="${classes}" data-item="${escapeHtml(item.id || "")}" data-render-key="${escapeHtml(key)}">
    <div class="operation-meta-line"><span class="operation-meta-main"><span class="operation-title">${escapeHtml(title)}</span><span class="operation-status">${escapeHtml(status)}</span></span>${duration}</div>
    ${body}
  </section>`;
}

function operationTitle(item) {
  return labelForItem(item);
}

function operationDetailText(item) {
  return operationSummaryLines(item).filter(Boolean).join(" | ");
}

function truncateSingleLine(value, maxChars = 96) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1))}...`;
}

function normalizeOperationIdentityValue(value) {
  return String(value || "").replace(/\\/g, "/").replace(/\s+/g, " ").trim().toLowerCase();
}

function stripMatchingOuterQuotes(value) {
  const text = String(value || "").trim();
  if (text.length >= 2) {
    const first = text[0];
    const last = text[text.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) return text.slice(1, -1).trim();
  }
  return text;
}

function operationCommandSummary(item) {
  const raw = String(item && item.command || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const commandMatch = raw.match(/(?:^|\s)-(?:Command|c)\s+([\s\S]+)$/i);
  if (commandMatch && /(?:powershell|pwsh)(?:\.exe)?/i.test(raw.slice(0, commandMatch.index + commandMatch[0].length))) {
    const script = stripMatchingOuterQuotes(commandMatch[1]);
    if (script) return truncateSingleLine(script, 180);
  }
  if (/(?:^|\s)-(?:EncodedCommand|enc|e)\b/i.test(raw) && /(?:powershell|pwsh)(?:\.exe)?/i.test(raw)) {
    return "PowerShell -EncodedCommand";
  }
  return truncateSingleLine(raw, 180);
}

function operationCommandName(item) {
  const raw = String(item && item.command || "").trim();
  if (!raw) return "";
  const quoted = raw.match(/^["']([^"']+)["']/);
  const token = quoted ? quoted[1] : raw.split(/\s+/, 1)[0];
  const name = shortPath(stripMatchingOuterQuotes(token));
  return name || stripMatchingOuterQuotes(token);
}

function operationCommandGroupText(item) {
  return operationCommandName(item);
}

function operationRawFileNames(item) {
  const values = Array.isArray(item.fileNames) && item.fileNames.length
    ? item.fileNames
    : collectFileNames(item.changes || item.arguments || item.result || item.contentItems);
  return [...new Set(values.map((name) => String(name || "").trim()).filter(Boolean))].slice(0, 5);
}

function operationFileNames(item) {
  return operationRawFileNames(item)
    .map((name) => truncateSingleLine(shortPath(name), 72))
    .filter(Boolean);
}

function operationGroupKey(item) {
  if (!item || !isOperationalItem(item)) return "";
  const type = isWebSearchLikeItem(item) ? "webSearch" : (item.type || "item");
  const fileNames = operationRawFileNames(item)
    .map(normalizeOperationIdentityValue)
    .filter(Boolean)
    .sort();
  if (fileNames.length) return `${type}:files:${stableTextHash(fileNames.join("|"))}`;
  if (item.command) return `${type}:command:${stableTextHash(normalizeOperationIdentityValue(operationCommandGroupText(item)))}`;
  const searchSummary = isWebSearchLikeItem(item) ? operationSearchSummary(item) : "";
  if (searchSummary) return `${type}:search:${stableTextHash(normalizeOperationIdentityValue(searchSummary))}`;
  const toolParts = [item.server, item.namespace, item.tool].map(normalizeOperationIdentityValue).filter(Boolean);
  if (toolParts.length) return `${type}:tool:${stableTextHash(toolParts.join("|"))}`;
  const detail = operationDetailText(item);
  if (detail) return `${type}:detail:${stableTextHash(normalizeOperationIdentityValue(detail))}`;
  return item.id ? `${type}:item:${item.id}` : "";
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
  if (item.command) return [operationCommandSummary(item)];
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
  const notice = contextCompactionNotice(item, turn);
  if (!notice) return "";
  const key = stableItemKey(turn, item, index, "context");
  return `<div class="context-compaction-note${entryAnimationClass(key, previousKeys)}" data-item="${escapeHtml(item.id || "")}" data-render-key="${escapeHtml(key)}">${escapeHtml(notice)}</div>`;
}

function renderItem(item, turn = null, previousKeys = new Set(), index = 0) {
  if (isContextCompactionItem(item)) return renderContextCompaction(item, turn, previousKeys, index);
  if (isLiveReasoning(item, turn)) return "";
  const type = item.type || "item";
  const key = stableItemKey(turn, item, index);
  const itemCopyKey = rememberCopyText(copyTextForItem(item));
  const itemCopyButton = copyButtonHtml(itemCopyKey, "复制全文", "item-copy-button");
  const timestampHtml = renderItemTimestampHtml(item, turn);
  return `<section class="item${entryAnimationClass(key, previousKeys)} ${escapeHtml(type)}" data-item="${escapeHtml(item.id || "")}" data-render-key="${escapeHtml(key)}">
    <div class="item-head">
      <span>${escapeHtml(labelForItem(item))}</span>
      <span class="item-head-actions">${timestampHtml}<span>${escapeHtml(item.status ? statusText(item.status) : "")}</span>${itemCopyButton}</span>
    </div>
    <div class="item-body">${renderItemBody(item, turn)}</div>
  </section>`;
}

function renderItemTimestampHtml(item, turn = null) {
  const timestampMs = itemTimestampMs(item, turn);
  if (!timestampMs) return "";
  const label = formatCardTimestamp(timestampMs, state.nowMs);
  if (!label) return "";
  const title = new Date(timestampMs).toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `<time class="item-timestamp" datetime="${escapeHtml(new Date(timestampMs).toISOString())}" title="${escapeHtml(title)}">${escapeHtml(label)}</time>`;
}

function itemTimestampMs(item, turn = null) {
  if (!item) return 0;
  const itemStarted = numericTimestampMs(item.createdAtMs)
    || numericTimestampMs(item.createdAt)
    || numericTimestampMs(item.created_at_ms)
    || numericTimestampMs(item.created_at)
    || numericTimestampMs(item.startedAtMs)
    || numericTimestampMs(item.startedAt)
    || numericTimestampMs(item.started_at_ms)
    || numericTimestampMs(item.started_at)
    || numericTimestampMs(item.timestampMs)
    || numericTimestampMs(item.timestamp);
  if (itemStarted) return itemStarted;
  if (item.type === "agentMessage" || item.type === "plan") {
    return numericTimestampMs(item.completedAtMs)
      || numericTimestampMs(item.completedAt)
      || numericTimestampMs(item.completed_at_ms)
      || numericTimestampMs(item.completed_at)
      || turnCompletedAtMs(turn, state.currentThread)
      || (isLiveTurn(turn) ? 0 : turnStartedAtMs(turn))
      || 0;
  }
  if (isLiveTurn(turn) && isOperationalItem(item)) return 0;
  return turnStartedAtMs(turn) || turnCompletedAtMs(turn, state.currentThread);
}

function turnStartedAtMs(turn) {
  if (!turn) return 0;
  return numericTimestampMs(turn.startedAtMs)
    || numericTimestampMs(turn.startedAt)
    || numericTimestampMs(turn.started_at_ms)
    || numericTimestampMs(turn.started_at)
    || numericTimestampMs(turn.createdAtMs)
    || numericTimestampMs(turn.createdAt)
    || numericTimestampMs(turn.created_at_ms)
    || numericTimestampMs(turn.created_at);
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
    collabAgentToolCall: "协作 Agent",
    imageView: "Image",
    mcpToolCall: `MCP ${item.server || ""}.${item.tool || ""}`,
    dynamicToolCall: `${item.namespace ? item.namespace + "." : ""}${item.tool || "Tool"}`,
    plan: "Plan",
    contextCompaction: "Context",
    turnUsageSummary: "Usage",
  };
  return map[item.type] || item.type || "Item";
}

function copyTextForItem(item) {
  if (!item || item.type !== "agentMessage") return "";
  return item.text || "";
}

function imageUrlValue(part) {
  if (!part || typeof part !== "object") return "";
  const raw = part.url || part.image_url || part.imageUrl || "";
  if (raw && typeof raw === "object") return String(raw.url || raw.uri || "");
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
  if (!markerMatch) return { text: source, attachments: [] };
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
  const visibleText = [before, after].filter(Boolean).join(before && after ? "\n\n" : "");
  return { text: visibleText, attachments };
}

function parseAttachmentLine(line) {
  const match = /^-\s*(.*?)\s*\((.*?)\):\s*(.+)$/.exec(String(line || ""));
  if (!match) return null;
  const meta = match[2] || "";
  return {
    name: match[1] || "attachment",
    meta,
    path: (match[3] || "").trim(),
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
  const url = imageUrlValue(part);
  return url || "";
}

function isLikelyAbsoluteLocalPath(value) {
  const text = String(value || "").trim();
  return /^[a-zA-Z]:[\\/]/.test(text) || /^\\\\/.test(text);
}

function canRenderImageAttachment(attachment) {
  return Boolean(attachment && attachment.isImage && isLikelyAbsoluteLocalPath(attachment.path));
}

function renderInputText(text) {
  if (!String(text || "").trim()) return "";
  return `<div class="input-text">${escapeHtml(text)}</div>`;
}

function renderInputImage(part, attachment = null, index = 0) {
  const src = imageSourceForPart(part, attachment);
  const label = (attachment && attachment.name) || shortPath(part.path || imageUrlValue(part) || "") || `Image ${index + 1}`;
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

function renderAttachmentSummary(attachments, imageParts = []) {
  const html = [];
  const imageAttachments = (attachments || []).filter((attachment) => attachment.isImage);
  const parts = Array.isArray(imageParts) ? imageParts : [];
  parts.forEach((part, index) => {
    html.push(renderInputImage(part, imageAttachments[index] || null, index));
  });
  const renderedImageAttachments = new Set();
  if (!parts.length) {
    imageAttachments
      .filter(canRenderImageAttachment)
      .forEach((attachment, index) => {
        renderedImageAttachments.add(attachment);
        html.push(renderInputImage({ path: attachment.path }, attachment, index));
      });
  }
  (attachments || [])
    .filter((attachment) => !renderedImageAttachments.has(attachment) && (!attachment.isImage || !parts.length))
    .forEach((attachment) => html.push(renderInputAttachment(attachment)));
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

function renderMarkdown(value) {
  const renderer = window.CodexMarkdownRenderer;
  if (!renderer || typeof renderer.renderMarkdown !== "function") {
    return `<div class="markdown-body"><p>${escapeHtml(value || "")}</p></div>`;
  }
  return renderer.renderMarkdown(value, {
    rememberCopyText,
    copyButtonHtml,
  });
}

function renderMarkdownWithAttachmentSummary(value) {
  const split = splitAttachmentSummaryText(value || "");
  if (!split.attachments.length) return renderMarkdown(value || "");
  return [
    split.text ? renderMarkdown(split.text) : "",
    renderAttachmentSummary(split.attachments),
  ].filter(Boolean).join("");
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
    moved: false,
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
  if (dx >= FILE_PREVIEW_SWIPE_CLOSE_MIN_PX && Math.abs(dy) <= Math.abs(dx) * 0.85) closeFilePreview();
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

function filePreviewContentUrl(file) {
  if (file && file.contentUrl) return authenticatedApiContentUrl(file.contentUrl);
  if (!file || !file.path) return "";
  return localFilePreviewContentUrl(file.path);
}

function authenticatedApiContentUrl(value) {
  const raw = String(value || "");
  if (!raw || !state.key) return raw;
  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.origin === window.location.origin && parsed.pathname.startsWith("/api/") && !parsed.searchParams.has("key")) {
      parsed.searchParams.set("key", state.key);
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch (_) {}
  return raw;
}

function localFilePreviewContentUrl(filePath) {
  if (!filePath) return "";
  const params = new URLSearchParams({
    threadId: state.currentThreadId || "",
    path: String(filePath),
  });
  if (state.key) params.set("key", state.key);
  return `/api/files/preview/content?${params.toString()}`;
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
    if (ch === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      if (rows.length >= 50) break;
    } else {
      cell += ch;
    }
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
  const headHtml = head.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("");
  const bodyHtml = bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  return `<div class="file-preview-table-wrap"><table class="file-preview-table"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
}

function renderFilePreviewContent(file) {
  const content = String((file && file.content) || "");
  if (file && file.kind === "markdown") return renderMarkdown(content);
  if (file && file.kind === "image") {
    const src = filePreviewContentUrl(file);
    return `<div class="file-preview-media"><img class="file-preview-image" src="${escapeHtml(src)}" alt="${escapeHtml(file.fileName || "image preview")}"></div>`;
  }
  if (file && file.kind === "pdf") {
    const src = filePreviewContentUrl(file);
    return `<div class="file-preview-pdf"><iframe src="${escapeHtml(src)}" title="${escapeHtml(file.fileName || "PDF preview")}"></iframe><a href="${escapeHtml(src)}" target="_blank" rel="noreferrer">打开 PDF 预览</a></div>`;
  }
  if (file && file.kind === "json") return renderJsonPreview(content);
  if (file && file.kind === "csv") return renderCsvPreview(content);
  return `<pre class="file-preview-text"><code>${escapeHtml(content)}</code></pre>`;
}

function imageViewPath(item) {
  return String((item && (
    item.path
    || item.filePath
    || item.file_path
    || item.imagePath
    || item.image_path
    || item.sourcePath
    || item.source_path
    || item.arguments && (item.arguments.path || item.arguments.filePath || item.arguments.imagePath)
    || item.result && (item.result.path || item.result.filePath || item.result.imagePath)
  )) || "");
}

function imageViewUrl(item) {
  return String((item && (
    item.url
    || item.imageUrl
    || item.image_url
    || item.arguments && (item.arguments.url || item.arguments.imageUrl || item.arguments.image_url)
    || item.result && (item.result.url || item.result.imageUrl || item.result.image_url)
  )) || "");
}

function imageViewContentUrl(item) {
  return String((item && (
    item.contentUrl
    || item.content_url
    || item.result && (item.result.contentUrl || item.result.content_url)
  )) || "");
}

function renderImageView(item) {
  const filePath = imageViewPath(item);
  const contentUrl = imageViewContentUrl(item);
  const url = imageViewUrl(item);
  const src = contentUrl ? authenticatedApiContentUrl(contentUrl) : (filePath ? localFilePreviewContentUrl(filePath) : url);
  const label = shortPath(filePath || url || item.id || "image");
  if (!src) return renderStructuredBlock(item, "Image");
  return `<figure class="image-view">
    <img src="${escapeHtml(src)}" alt="${escapeHtml(label)}" loading="lazy">
    ${label ? `<figcaption>${escapeHtml(label)}</figcaption>` : ""}
  </figure>`;
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

async function openLocalFilePreview(link) {
  const filePath = link && link.dataset ? link.dataset.localFilePath || "" : "";
  if (!filePath) return;
  const label = (link && link.dataset && link.dataset.localFileLabel) || (link && link.textContent ? link.textContent.replace(/预览文件\s*$/, "").trim() : "") || "文件预览";
  showFilePreviewLoading(label, filePath);
  try {
    const file = await api(`/api/files/preview?threadId=${encodeURIComponent(state.currentThreadId || "")}&path=${encodeURIComponent(filePath)}`, {
      timeoutMs: 15000,
    });
    $("filePreviewTitle").textContent = file.fileName || label;
    $("filePreviewPath").textContent = file.relativePath || file.path || filePath;
    $("filePreviewMeta").textContent = filePreviewMetaText(file);
    $("filePreviewBody").innerHTML = renderFilePreviewContent(file);
    const copyButton = $("filePreviewCopyPath");
    if (copyButton) copyButton.dataset.copyKey = rememberCopyText(file.path || filePath);
  } catch (err) {
    $("filePreviewMeta").textContent = "";
    $("filePreviewBody").innerHTML = `<div class="file-preview-error">${escapeHtml(err && err.message ? err.message : String(err))}</div>`;
  }
}

function nestedStringValue(value, keys, depth = 0, seen = new Set()) {
  if (!value || typeof value !== "object" || depth > 3 || seen.has(value)) return "";
  seen.add(value);
  const wanted = new Set(keys.map((key) => String(key).toLowerCase()));
  for (const [key, entry] of Object.entries(value)) {
    if (wanted.has(String(key).toLowerCase()) && typeof entry === "string" && entry.trim()) return entry;
  }
  for (const entry of Object.values(value)) {
    const found = nestedStringValue(entry, keys, depth + 1, seen);
    if (found) return found;
  }
  return "";
}

function collabAgentTaskText(item) {
  return nestedStringValue(item, ["task", "message", "prompt", "description", "instructions"]);
}

function collabAgentThreadText(item) {
  return nestedStringValue(item, ["targetThread", "targetThreadId", "threadId", "agentThreadId", "modelThread"]);
}

function collabAgentNameText(item) {
  return nestedStringValue(item, ["name", "agentName", "nickname", "role", "agentType", "agent_type"]);
}

function collabAgentMetaPill(label, value) {
  if (!value) return "";
  return `<span class="collab-agent-pill"><span>${escapeHtml(label)}</span>${escapeHtml(value)}</span>`;
}

function renderCollabAgentToolCall(item) {
  const tool = item.tool || item.name || "collabAgentToolCall";
  const status = statusText(item.status);
  const thread = collabAgentThreadText(item);
  const agentName = collabAgentNameText(item);
  const task = collabAgentTaskText(item);
  const raw = JSON.stringify(item, null, 2);
  const rawCopyButton = copyButtonHtml(rememberCopyText(raw), "复制", "output-copy-button");
  const pills = [
    collabAgentMetaPill("工具", tool),
    collabAgentMetaPill("状态", status),
    collabAgentMetaPill("Agent", agentName),
    collabAgentMetaPill("线程", thread),
  ].filter(Boolean).join("");
  return `<div class="collab-agent-card">
    <div class="collab-agent-title">${escapeHtml(tool === "spawnAgent" ? "协作 Agent 已启动" : "协作 Agent 调用")}</div>
    ${pills ? `<div class="collab-agent-meta">${pills}</div>` : ""}
    ${task ? `<div class="collab-agent-task">${escapeHtml(truncateMiddle(task, 260, "task"))}</div>` : ""}
    <details class="output-details collab-agent-raw">
      <summary><span>${escapeHtml(`原始 JSON: ${raw.length.toLocaleString()} chars`)}</span>${rawCopyButton}</summary>
      <pre>${escapeHtml(raw)}</pre>
    </details>
  </div>`;
}

function formatTokenCount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : "--";
}

function displayInputTokensExcludingCached(usage) {
  const input = Number(usage && usage.inputTokens);
  if (!Number.isFinite(input)) return usage && usage.inputTokens;
  const cached = Number(usage && usage.cachedInputTokens);
  if (!Number.isFinite(cached)) return input;
  return Math.max(0, input - cached);
}

function formatUsagePercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  if (number < 10) return `${number.toFixed(1)}%`;
  return `${Math.round(number)}%`;
}

function tokenUsageSummaryText(usage) {
  const value = usage && typeof usage === "object" ? usage : {};
  const parts = [
    `in ${formatTokenCount(displayInputTokensExcludingCached(value))}`,
    value.cachedInputTokens !== undefined ? `cached ${formatTokenCount(value.cachedInputTokens)}` : "",
    `out ${formatTokenCount(value.outputTokens)}`,
    value.reasoningOutputTokens !== undefined ? `reasoning ${formatTokenCount(value.reasoningOutputTokens)}` : "",
    `total ${formatTokenCount(value.totalTokens)}`,
  ].filter(Boolean);
  return parts.join(" / ");
}

function contextRiskLabel(level) {
  const map = {
    normal: "normal",
    warn: "watch",
    high: "high",
    critical: "critical",
    unknown: "unknown",
  };
  return map[level] || "unknown";
}

function renderUsageMetric(label, value, detail = "") {
  return `<div class="turn-usage-metric">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
    ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
  </div>`;
}

function renderTurnUsageSummary(item) {
  const summary = item && item.mobileUsageSummary && typeof item.mobileUsageSummary === "object"
    ? item.mobileUsageSummary
    : {};
  const contextTokens = Number(summary.contextWindowUsedTokens);
  const contextWindow = Number(summary.modelContextWindow);
  const contextDetail = Number.isFinite(contextTokens) && Number.isFinite(contextWindow) && contextWindow > 0
    ? `${formatTokenCount(contextTokens)} / ${formatTokenCount(contextWindow)}`
    : "";
  const lastUsage = tokenUsageSummaryText(summary.lastTokenUsage || {});
  const totalUsage = tokenUsageSummaryText(summary.totalTokenUsage || {});
  const rolloutSize = Number(summary.rolloutSizeBytes);
  const rolloutThreshold = Number(summary.rolloutWarningThresholdBytes);
  const rolloutDetail = Number.isFinite(rolloutThreshold) && rolloutThreshold > 0
    ? `warn ${formatFileSize(rolloutThreshold)}`
    : "";
  const risk = contextRiskLabel(summary.contextRiskLevel || "unknown");
  return `<div class="turn-usage-summary risk-${escapeHtml(risk)}">
    <div class="turn-usage-summary-head">
      <span>Context and token usage</span>
      <strong>${escapeHtml(risk)}</strong>
    </div>
    <div class="turn-usage-grid">
      ${renderUsageMetric("context window", formatUsagePercent(summary.contextWindowUsedPercent), contextDetail)}
      ${renderUsageMetric("last turn", lastUsage)}
      ${renderUsageMetric("thread total", totalUsage)}
      ${renderUsageMetric("rollout", Number.isFinite(rolloutSize) ? formatFileSize(rolloutSize) : "--", rolloutDetail)}
    </div>
  </div>`;
}

function renderItemBody(item, turn = null) {
  if (isContextCompactionItem(item)) return escapeHtml(contextCompactionNotice(item, turn));
  if (item.type === "turnUsageSummary") return renderTurnUsageSummary(item);
  if (item.type === "userMessage") return renderInputContent(item.content);
  if (item.type === "agentMessage") {
    return renderThreadTaskCardDraftMessage(item.text || "", item, turn) || renderMarkdownWithAttachmentSummary(item.text || "");
  }
  if (item.type === "reasoning") {
    const summary = (item.summary || []).join("\n");
    const content = (item.content || []).join("\n");
    return escapeHtml([summary, content].filter(Boolean).join("\n\n"));
  }
  if (item.type === "plan") return renderThreadTaskCardDraftMessage(item.text || "", item, turn) || renderMarkdownWithAttachmentSummary(item.text || "");
  if (item.type === "imageView") return renderImageView(item);
  if (item.type === "commandExecution") {
    return `<div class="mono">${escapeHtml(item.command || "")}</div>${renderOutputBlock(item.aggregatedOutput, item)}`;
  }
  if (item.type === "fileChange") {
    return renderStructuredBlock(item.changes || [], `${Array.isArray(item.changes) ? item.changes.length : 0} change(s)`);
  }
  if (item.type === "collabAgentToolCall") return renderCollabAgentToolCall(item);
  if (item.type === "dynamicToolCall" || item.type === "mcpToolCall") {
    return `<div class="mono">${escapeHtml(JSON.stringify(item.arguments || {}, null, 2))}</div>${renderStructuredBlock(item.result || item.contentItems, "Tool result")}`;
  }
  return escapeHtml(JSON.stringify(item, null, 2));
}

function renderOutputBlock(output, item = {}) {
  if (!output && item.outputOmitted) {
    const total = item.outputTotalChars || 0;
    const omittedText = "This command output is still in the Codex session history. It is omitted here to keep the mobile client responsive.";
    return `<details class="output-details">
      <summary><span>${escapeHtml(`Output omitted from mobile view: ${Number(total).toLocaleString()} chars`)}</span>${copyButtonHtml(rememberCopyText(omittedText), "复制", "output-copy-button")}</summary>
      <pre>${escapeHtml(omittedText)}</pre>
    </details>`;
  }
  if (!output) return "";
  const outputText = String(output);
  const total = item.outputTotalChars || String(output).length;
  const truncated = item.outputTruncated || total > outputText.length;
  const summary = truncated
    ? `Output preview: ${total.toLocaleString()} chars total, showing latest ${outputText.length.toLocaleString()}`
    : `Output: ${outputText.length.toLocaleString()} chars`;
  return `<details class="output-details">
    <summary><span>${escapeHtml(summary)}</span>${copyButtonHtml(rememberCopyText(outputText), "复制", "output-copy-button")}</summary>
    <pre>${escapeHtml(outputText)}</pre>
  </details>`;
}

function renderStructuredBlock(value, label) {
  if (!value) return "";
  if (value.truncated && value.preview) {
    const preview = String(value.preview || "");
    return `<details class="output-details">
      <summary><span>${escapeHtml(`${label}: ${Number(value.totalChars || 0).toLocaleString()} chars total, preview`)}</span>${copyButtonHtml(rememberCopyText(preview), "复制", "output-copy-button")}</summary>
      <pre>${escapeHtml(preview)}</pre>
    </details>`;
  }
  const raw = JSON.stringify(value, null, 2);
  if (!raw || raw === "null") return "";
  return `<details class="output-details">
    <summary><span>${escapeHtml(`${label}: ${raw.length.toLocaleString()} chars`)}</span>${copyButtonHtml(rememberCopyText(raw), "复制", "output-copy-button")}</summary>
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
    item = { id: itemId, type: itemType, startedAtMs: Date.now() };
    turn.items.push(item);
  }
  if (!item.startedAtMs) item.startedAtMs = Date.now();
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
    updateThreadStatusHints(params.thread.id, index >= 0 ? state.threads[index].status : null, params.thread.status, {
      thread: params.thread,
      threadName: threadDisplayName(params.thread),
      notify: true,
    });
    if (index >= 0) state.threads[index] = Object.assign({}, state.threads[index], params.thread);
    else state.threads.unshift(params.thread);
    scheduleRenderThreads();
    return;
  }
  if (method === "thread/status/changed") {
    const thread = state.threads.find((x) => x.id === params.threadId);
    const previousStatus = thread ? thread.status : null;
    updateThreadStatusHints(params.threadId, previousStatus, params.status, {
      thread,
      notify: true,
      threadName: threadDisplayName(thread),
    });
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
    clearRecentCompletedReplyAnchor();
    clearConversationAutoScrollHold();
    markActivity("开始");
    $("interruptTurn").disabled = false;
    updateComposerControls();
    ensureTurn(params.turn.id);
    renderCurrentThread();
    scheduleCurrentThreadRefresh(500);
    scheduleLivePollIfNeeded(1200);
    return;
  }
  if (method === "turn/completed") {
    const turn = ensureTurn(params.turn.id);
    Object.assign(turn, mergeTurnPreservingVisibleItems(turn, params.turn));
    rememberRecentCompletedTurnReply(params.turn.id);
    const completedPendingSteer = isPendingSteerForTurn(params.turn.id);
    state.activeTurnId = "";
    markActivity("完成");
    if (completedPendingSteer) setSteerFeedback("completed", { turnId: String(params.turn.id) });
    $("interruptTurn").disabled = true;
    updateComposerControls();
    renderCurrentThread();
    scheduleCurrentThreadRefresh(700);
    scheduleLivePollIfNeeded(1400);
    return;
  }
  if (method === "item/started" || method === "item/completed") {
    upsertItem(params.turnId, params.item);
    markSteerAppliedIfNeeded(params.turnId, params.item);
    scheduleLivePollIfNeeded(2200);
    return;
  }
  if (method === "item/agentMessage/delta") {
    markActivity("输出");
    appendToItem(params.turnId, params.itemId, "agentMessage", "text", params.delta || "");
    markSteerAppliedIfNeeded(params.turnId, { type: "agentMessage" });
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
    markSteerAppliedIfNeeded(params.turnId, { type: "reasoning" });
    return;
  }
  if (method === "item/reasoning/summaryTextDelta") {
    markActivity("思考");
    ensureTimerItem(params.turnId, params.itemId, "reasoning");
    markSteerAppliedIfNeeded(params.turnId, { type: "reasoning" });
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
    clearReconnectRefreshPrompt();
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
        clearReconnectRefreshPrompt();
        if (status.rateLimits || status.rateLimitsByModel) rememberRateLimits(status.rateLimits, status.rateLimitsByModel);
        await loadThreads();
        await refreshCurrentThread();
        ensureEventConnection();
      } catch (err) {
        showReconnectRefreshPrompt("reconnect");
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
  const startedAt = nowPerfMs();
  try {
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
    await loadThreads({ silent: Boolean(state.threads.length) });
    if (state.currentThreadId && state.currentThread && !state.currentThread.mobileLoading) {
      scheduleCurrentThreadRefresh(250);
    } else if (state.currentThreadId) {
      await refreshCurrentThread();
    } else {
      await restoreThreadSelection();
    }
    scheduleLivePollIfNeeded(1200);
    const elapsedMs = roundedDurationMs(startedAt);
    if (elapsedMs > 1200) {
      postClientEvent("mobile_resume_slow", {
        reason,
        elapsedMs,
        currentThreadId: state.currentThreadId || "",
        hadThreads: Boolean(state.threads.length),
      });
    }
  } catch (err) {
    postClientEvent("mobile_resume_error", {
      reason,
      elapsedMs: roundedDurationMs(startedAt),
      error: err.message || String(err),
    });
    throw err;
  }
}

function scrollConversationToBottom() {
  const el = $("conversation");
  if (!el) return;
  const target = Math.max(0, el.scrollHeight - el.clientHeight);
  if (Math.abs(el.scrollTop - target) < 2) {
    scheduleScrollToBottomButtonUpdate();
    return;
  }
  markProgrammaticConversationScroll();
  el.scrollTop = target;
  syncConversationScrollPosition();
  scheduleScrollToBottomButtonUpdate();
}

function clearSubmittedMessageBottomFollow() {
  state.submittedMessageBottomFollow = null;
}

function clearViewportBottomFollow() {
  state.viewportBottomFollow = null;
}

function shouldFollowSubmittedMessageToBottom() {
  if (isUserReadingCurrentTurn()) {
    clearSubmittedMessageBottomFollow();
    return false;
  }
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  const shouldFollow = conversationScroll.shouldFollowSubmittedMessage(state.submittedMessageBottomFollow, {
    threadId,
    nowMs: Date.now(),
  });
  if (!shouldFollow && state.submittedMessageBottomFollow) clearSubmittedMessageBottomFollow();
  return shouldFollow;
}

function shouldFollowViewportChangeToBottom() {
  if (isUserReadingCurrentTurn()) {
    clearViewportBottomFollow();
    return false;
  }
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  const shouldFollow = conversationScroll.shouldFollowViewport(state.viewportBottomFollow, {
    threadId,
    nowMs: Date.now(),
  });
  if (!shouldFollow && state.viewportBottomFollow) clearViewportBottomFollow();
  return shouldFollow;
}

function scheduleBottomFollowScroll(shouldFollow) {
  [0, 80, 240, 600, 1200].forEach((delay) => {
    window.setTimeout(() => {
      if (shouldFollow()) scrollConversationToBottom();
    }, delay);
  });
}

function scheduleSubmittedMessageBottomFollowScroll() {
  scheduleBottomFollowScroll(shouldFollowSubmittedMessageToBottom);
}

function scheduleViewportBottomFollowScroll() {
  scheduleBottomFollowScroll(shouldFollowViewportChangeToBottom);
}

function followSubmittedMessageToBottom(threadId, clientSubmissionId = "") {
  state.submittedMessageBottomFollow = conversationScroll.createSubmittedMessageFollow(threadId, {
    clientSubmissionId,
    nowMs: Date.now(),
  });
  if (!state.submittedMessageBottomFollow) return;
  clearConversationAutoScrollHold();
  clearRecentCompletedReplyAnchor();
  scheduleSubmittedMessageBottomFollowScroll();
}

function followViewportChangeToBottom(reason = "viewport") {
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  if (!threadId || !state.currentThread) return;
  const nowMs = Date.now();
  const alreadyFollowing = shouldFollowViewportChangeToBottom();
  const lastNearBottomAtMs = state.conversationNearBottomThreadId === threadId
    ? state.conversationNearBottomAtMs
    : 0;
  const shouldStart = alreadyFollowing || conversationScroll.shouldStartViewportFollow({
    nearBottom: isConversationNearBottom(),
    lastNearBottomAtMs,
    nowMs,
  });
  if (!shouldStart) return;
  if (!alreadyFollowing) {
    state.viewportBottomFollow = conversationScroll.createViewportFollow(threadId, {
      reason,
      nowMs,
    });
  }
  scheduleViewportBottomFollowScroll();
}

function markProgrammaticConversationScroll() {
  state.programmaticScrollUntilMs = Date.now() + 500;
}

function clearConversationNearBottomState() {
  state.conversationNearBottomAtMs = 0;
  state.conversationNearBottomThreadId = "";
}

function noteConversationBottomState(options = {}) {
  const nearBottom = isConversationNearBottom();
  if (nearBottom) {
    state.conversationNearBottomAtMs = Date.now();
    state.conversationNearBottomThreadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  } else if (options.userIntent) {
    clearConversationNearBottomState();
  }
  return nearBottom;
}

function syncConversationScrollPosition(options = {}) {
  const el = $("conversation");
  if (el) state.conversationLastScrollTop = el.scrollTop;
  noteConversationBottomState(options);
}

function hasRecentConversationScrollIntent(nowMs = Date.now()) {
  return nowMs - Number(state.conversationScrollIntentAtMs || 0) <= CONVERSATION_SCROLL_INTENT_MS;
}

function rememberConversationScrollIntent() {
  state.conversationScrollIntentAtMs = Date.now();
  clearSubmittedMessageBottomFollow();
  clearViewportBottomFollow();
  syncConversationScrollPosition();
}

function clearConversationAutoScrollHold() {
  state.autoScrollHold = null;
}

function rememberConversationAutoScrollHold() {
  const turn = turnForConversationAutoScrollHold();
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  if (!threadId || !turn || !turn.id) return;
  state.autoScrollHold = {
    threadId: String(threadId),
    turnId: String(turn.id),
  };
}

function shouldHoldAutoScrollForCurrentTurn() {
  const hold = state.autoScrollHold;
  if (!hold) return false;
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  const turn = latestTurn();
  return Boolean(threadId && turn && hold.threadId === String(threadId) && hold.turnId === String(turn.id || ""));
}

function turnForConversationAutoScrollHold() {
  const live = currentLiveTurn();
  if (live) return live;
  const turn = latestTurn();
  return isRecentReplyJumpTurn(turn) ? turn : null;
}

function isUserReadingCurrentTurn(options = {}) {
  const nearBottom = Object.prototype.hasOwnProperty.call(options, "nearBottom")
    ? Boolean(options.nearBottom)
    : isConversationNearBottom();
  if (nearBottom) return false;
  if (shouldHoldAutoScrollForCurrentTurn()) return true;
  if (!hasRecentConversationScrollIntent()) return false;
  return Boolean(turnForConversationAutoScrollHold());
}

function updateConversationAutoScrollHoldFromScroll() {
  if (isConversationNearBottom()) {
    clearConversationAutoScrollHold();
    return;
  }
  if (!hasRecentConversationScrollIntent()) return;
  if (turnForConversationAutoScrollHold()) rememberConversationAutoScrollHold();
}

function clearRecentCompletedReplyAnchor() {
  state.recentCompletedReplyAnchor = null;
}

function rememberRecentCompletedTurnReply(turnId) {
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  if (!threadId || !turnId) return;
  const normalizedThreadId = String(threadId);
  const normalizedTurnId = String(turnId);
  const previousAnchor = state.recentCompletedReplyAnchor;
  const keepActivatedByUserScroll = Boolean(
    previousAnchor
      && previousAnchor.threadId === normalizedThreadId
      && previousAnchor.turnId === normalizedTurnId
      && previousAnchor.activatedByUserScroll,
  );
  state.recentCompletedReplyAnchor = {
    threadId: normalizedThreadId,
    turnId: normalizedTurnId,
    completedAtMs: Date.now(),
    activatedByUserScroll: keepActivatedByUserScroll,
  };
}

function numericTimestampMs(value) {
  if (!value) return 0;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    if (typeof value !== "string") return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  return number > 100000000000 ? number : number * 1000;
}

function turnCompletedAtMs(turn, thread = null) {
  if (!turn) return 0;
  const explicitCompletedAt = numericTimestampMs(turn.completedAtMs)
    || numericTimestampMs(turn.completedAt)
    || numericTimestampMs(turn.completed_at_ms)
    || numericTimestampMs(turn.completed_at)
    || numericTimestampMs(turn.finishedAt)
    || numericTimestampMs(turn.finished_at);
  if (explicitCompletedAt) return explicitCompletedAt;
  if (!isTurnComplete(turn)) return 0;
  const startedAt = turnStartedAtMs(turn);
  const fallback = numericTimestampMs(turn.updatedAt)
    || numericTimestampMs(turn.updated_at)
    || numericTimestampMs(thread && (thread.updatedAt || thread.updated_at));
  if (!fallback || (startedAt && fallback < startedAt)) return 0;
  return fallback;
}

function isRecentReplyJumpTurn(turn) {
  if (!turn) return false;
  if (isLiveTurn(turn)) return true;
  const completedAtMs = turnCompletedAtMs(turn, state.currentThread);
  return Boolean(completedAtMs && Date.now() - completedAtMs <= TURN_REPLY_JUMP_WINDOW_MS);
}

function activateRecentCompletedReplyAnchorFromUserScroll() {
  const turn = currentLiveTurn() || latestTurn();
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  if (!threadId || !turn || !turn.id) return false;
  if (!isRecentReplyJumpTurn(turn)) return false;
  state.recentCompletedReplyAnchor = {
    threadId: String(threadId),
    turnId: String(turn.id),
    completedAtMs: Date.now(),
    activatedByUserScroll: true,
  };
  return true;
}

function updateRecentCompletedReplyAnchorFromScroll() {
  const el = $("conversation");
  if (!el) return;
  const currentTop = el.scrollTop;
  const previousTop = Number(state.conversationLastScrollTop || 0);
  const delta = currentTop - previousTop;
  state.conversationLastScrollTop = currentTop;
  noteConversationBottomState({ userIntent: hasRecentConversationScrollIntent() });
  if (Date.now() < state.programmaticScrollUntilMs) return;
  if (!hasRecentConversationScrollIntent()) return;
  if (delta < -2) {
    activateRecentCompletedReplyAnchorFromUserScroll();
  } else if (delta > 2) {
    clearRecentCompletedReplyAnchor();
  }
}

function currentRecentCompletedReplyAnchor() {
  const anchor = state.recentCompletedReplyAnchor;
  if (!anchor) return null;
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  if (!threadId || anchor.threadId !== String(threadId)) return null;
  if (!anchor.activatedByUserScroll) return null;
  if (Date.now() - Number(anchor.completedAtMs || 0) > TURN_REPLY_JUMP_WINDOW_MS) {
    clearRecentCompletedReplyAnchor();
    return null;
  }
  const turn = latestTurn();
  if (!turn || String(turn.id || "") !== anchor.turnId || (!isTurnComplete(turn) && !isLiveTurn(turn))) return null;
  return anchor;
}

function turnNodeForId(turnId) {
  const conversation = $("conversation");
  if (!conversation || !turnId) return null;
  return Array.from(conversation.querySelectorAll(".turn"))
    .find((node) => node.dataset.turn === String(turnId)) || null;
}

function turnFinalReceiptNode(anchor = currentRecentCompletedReplyAnchor()) {
  if (!anchor) return null;
  const turnNode = turnNodeForId(anchor.turnId);
  if (!turnNode) return null;
  const finalReceipts = Array.from(turnNode.querySelectorAll(".item.agentMessage, .item.plan"));
  if (finalReceipts.length) return finalReceipts[finalReceipts.length - 1];
  const fallbackItems = Array.from(turnNode.querySelectorAll(".item:not(.userMessage):not(.live-operation):not(.turnUsageSummary)"));
  if (fallbackItems.length) return fallbackItems[fallbackItems.length - 1];
  return turnNode;
}

function scrollNodeIntoConversationView(node, margin = 12) {
  const el = $("conversation");
  if (!el || !node) return;
  const viewport = el.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  const target = el.scrollTop + rect.top - viewport.top - margin;
  markProgrammaticConversationScroll();
  el.scrollTop = Math.max(0, Math.min(target, Math.max(0, el.scrollHeight - el.clientHeight)));
  syncConversationScrollPosition();
}

function scrollConversationToTurnReply() {
  const target = turnFinalReceiptNode();
  if (!target) return;
  clearSubmittedMessageBottomFollow();
  clearViewportBottomFollow();
  clearConversationNearBottomState();
  scrollNodeIntoConversationView(target);
  clearRecentCompletedReplyAnchor();
  scheduleScrollToBottomButtonUpdate();
}

function isConversationNearBottom() {
  const el = $("conversation");
  if (!el) return true;
  return conversationScroll.isNearBottom({
    scrollHeight: el.scrollHeight,
    scrollTop: el.scrollTop,
    clientHeight: el.clientHeight,
  });
}

function updateScrollToBottomButton() {
  const button = $("scrollToBottom");
  const replyButton = $("scrollToTurnReply");
  const el = $("conversation");
  if (!button || !el) return;
  const isScrollable = el.scrollHeight - el.clientHeight > 128;
  const shouldShow = Boolean(
    state.currentThread
      && !state.currentThread.mobileLoading
      && !state.currentThread.mobileLoadError
      && isScrollable
      && !isConversationNearBottom(),
  );
  button.classList.toggle("hidden", !shouldShow);
  button.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  button.tabIndex = shouldShow ? 0 : -1;
  if (!replyButton) return;
  const replyAnchor = currentRecentCompletedReplyAnchor();
  const replyNode = turnFinalReceiptNode(replyAnchor);
  const shouldShowReply = Boolean(
    state.currentThread
      && !state.currentThread.mobileLoading
      && !state.currentThread.mobileLoadError
      && isScrollable
      && replyNode
      && isNodeStartAboveConversationViewport(replyNode),
  );
  replyButton.classList.toggle("hidden", !shouldShowReply);
  replyButton.setAttribute("aria-hidden", shouldShowReply ? "false" : "true");
  replyButton.tabIndex = shouldShowReply ? 0 : -1;
}

function scheduleScrollToBottomButtonUpdate() {
  if (state.scrollToBottomFrame) return;
  const update = () => {
    state.scrollToBottomFrame = null;
    updateScrollToBottomButton();
  };
  if (window.requestAnimationFrame) {
    state.scrollToBottomFrame = window.requestAnimationFrame(update);
  } else {
    state.scrollToBottomFrame = setTimeout(update, 33);
  }
}

function updateComposerHeightVar() {
  const composer = $("composer");
  if (!composer) return;
  document.documentElement.style.setProperty("--composer-height", `${Math.ceil(composer.getBoundingClientRect().height)}px`);
  scheduleScrollToBottomButtonUpdate();
}

function showError(err) {
  const raw = err instanceof Error ? err.message : String(err || "");
  const message = normalizeClientErrorMessage(raw) || (err && err.message) || String(err);
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

function appendLocalAttachmentSummary(text, attachments) {
  if (!attachments.length) return text;
  const lines = attachments.map((item) => {
    const file = item.file;
    const kind = file.type && file.type.startsWith("image/") ? "image" : "file";
    return `- ${file.name || "upload"} (${kind}, ${file.type || "file"}, ${formatFileSize(file.size || 0)}): ${file.name || "upload"}`;
  });
  return `${text ? `${text}\n\n` : ""}Uploaded attachments:\n${lines.join("\n")}`;
}

function localUserMessageItem(text, attachments, clientSubmissionId) {
  return {
    id: `local-user-${clientSubmissionId || Date.now()}`,
    type: "userMessage",
    startedAtMs: Date.now(),
    content: [{
      type: "text",
      text: appendLocalAttachmentSummary(text, attachments),
      text_elements: [],
    }],
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
  replacePendingAttachments([], { saveDraft: false });
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
  return normalizePermissionModeValue(state.composerPermissionMode || effectiveDefaultPermissionMode()) || "default";
}

function resetComposerRuntimeSelection() {
  state.composerModel = "";
  state.composerEffort = "";
  state.composerPermissionMode = "";
  closeComposerRuntimeMenu();
  state.quotaDetailsOpen = false;
}

function runtimeOptionValues(kind) {
  if (kind === "model") return normalizeOptionList([selectedComposerModel(), state.defaultModel, ...state.modelOptions]);
  if (kind === "effort") return normalizeOptionList([selectedComposerEffort(), state.defaultReasoningEffort, ...state.reasoningEffortOptions]);
  if (kind === "permission") return normalizeOptionList([selectedComposerPermissionMode(), ...state.permissionModeOptions]);
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

function applyRuntimeSelection(kind, value) {
  const selected = String(value || "").trim();
  if (!selected) return;
  if (state.newThreadDraft) {
    if (kind === "model") state.newThreadModel = selected;
    if (kind === "effort") state.newThreadEffort = selected;
    if (kind === "permission") state.newThreadPermissionMode = normalizePermissionModeValue(selected) || "full";
  } else {
    if (kind === "model") state.composerModel = selected;
    if (kind === "effort") state.composerEffort = selected;
    if (kind === "permission") state.composerPermissionMode = normalizePermissionModeValue(selected) || "default";
  }
  closeComposerRuntimeMenu();
  renderComposerSettings();
  updateComposerControls();
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

function fitComposerPopupToAnchor(panel, anchor, options = {}) {
  const rect = anchor.getBoundingClientRect();
  const composer = $("composer");
  const composerRect = composer ? composer.getBoundingClientRect() : { left: 0, right: window.innerWidth, top: window.innerHeight };
  const minWidth = Number(options.minWidth || 180);
  const maxWidth = Number(options.maxWidth || 280);
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || maxWidth;
  const width = Math.max(minWidth, Math.min(maxWidth, viewportWidth - 16, Math.max(rect.width, minWidth)));
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left));
  const bottom = Math.max(8, window.innerHeight - composerRect.top + 6);
  panel.style.setProperty("--composer-popup-left", `${Math.round(left)}px`);
  panel.style.setProperty("--composer-popup-bottom", `${Math.round(bottom)}px`);
  panel.style.setProperty("--composer-popup-width", `${Math.round(width)}px`);
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

function renderComposerSettings() {
  const modelControl = $("composerModelControl");
  const effortControl = $("composerEffortControl");
  const permissionControl = $("composerPermissionControl");
  if (!modelControl || !effortControl || !permissionControl) return;
  const selectedModel = selectedComposerModel();
  const selectedEffort = selectedComposerEffort();
  const selectedPermission = selectedComposerPermissionMode();
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
  const hasThread = Boolean(state.currentThreadId
    && state.currentThread
    && !state.currentThread.mobileLoading
    && !state.currentThread.mobileLoadError);
  const hasNewThreadDraft = Boolean(state.newThreadDraft);
  const canComposeNewThread = Boolean(hasNewThreadDraft && state.selectedCwd);
  const disabled = !(hasThread || canComposeNewThread) || state.composerBusy || state.attachmentProcessingCount > 0;
  const hasContent = composerHasContent();
  const commandMode = Boolean(!hasNewThreadDraft && isThreadTaskCardCommandText(composerText()));
  const interruptMode = Boolean(!hasNewThreadDraft && state.activeTurnId) && !hasContent;
  const steerMode = Boolean(!hasNewThreadDraft && state.activeTurnId) && hasContent;
  const sendButton = $("sendMessage");
  const attachButton = $("attachFiles");
  const messageInput = $("messageInput");
  if (messageInput) {
    messageInput.dataset.placeholder = hasNewThreadDraft
      ? "输入第一条消息"
      : "Message Codex";
  }
  setMessageInputDisabled(disabled);
  $("fileInput").disabled = disabled;
  attachButton.classList.toggle("disabled", disabled);
  attachButton.setAttribute("aria-disabled", disabled ? "true" : "false");
  attachButton.tabIndex = disabled ? -1 : 0;
  for (const id of ["composerModelControl", "composerEffortControl", "composerPermissionControl", "quotaUsage"]) {
    const button = $(id);
    if (button) button.disabled = disabled;
  }
  const showRetryHint = Boolean(state.sendButtonHint);
  if (interruptMode) {
    sendButton.textContent = "Stop";
    sendButton.title = "Interrupt current turn";
    sendButton.classList.add("interrupt-mode");
    sendButton.classList.remove("sending", "send-failed", "steer-mode");
  } else if (state.composerBusy) {
    const steering = state.steerFeedback && state.steerFeedback.status === "sending";
    sendButton.textContent = steering ? "引导中…" : "发送中…";
    sendButton.title = steering ? "Steering current turn" : "Message is sending";
    sendButton.classList.add("sending");
    sendButton.classList.toggle("steer-mode", Boolean(steering));
    sendButton.classList.remove("send-failed", "interrupt-mode");
  } else if (showRetryHint) {
    sendButton.textContent = "重试";
    sendButton.title = "Retry sending message";
    sendButton.classList.add("send-failed");
    sendButton.classList.remove("sending", "interrupt-mode", "steer-mode");
  } else if (commandMode) {
    sendButton.textContent = "Task card";
    sendButton.title = "Ask Codex to draft a cross-thread task card";
    sendButton.classList.remove("sending", "send-failed", "interrupt-mode", "steer-mode");
  } else if (steerMode) {
    sendButton.textContent = "引导";
    sendButton.title = "Guide the current running turn";
    sendButton.classList.add("steer-mode");
    sendButton.classList.remove("sending", "send-failed", "interrupt-mode");
  } else {
    sendButton.textContent = "Send";
    sendButton.title = hasNewThreadDraft ? "Create new chat" : "Send message";
    sendButton.classList.remove("sending", "send-failed", "interrupt-mode", "steer-mode");
  }
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
  if (state.newThreadDraft) {
    await sendNewThreadMessage(text, hasContent, input);
    return;
  }
  if (state.activeTurnId && !hasContent) {
    await interruptActiveTurn();
    return;
  }
  if ((!text && !state.pendingAttachments.length) || !state.currentThreadId) return;
  const threadTaskCardCommand = isThreadTaskCardCommandText(text);
  if (threadTaskCardCommand && state.pendingAttachments.length) {
    showError(new Error("Task-card commands do not support attachments yet"));
    return;
  }
  const outboundText = threadTaskCardCommand ? buildThreadTaskCardDraftRequestText(text) : text;
  const steering = Boolean(state.activeTurnId && hasContent);
  const steerTurnId = steering ? String(state.activeTurnId) : "";
  const submittedDraftKey = currentDraftKey();
  const clientSubmissionId = createSubmissionId();
  state.composerBusy = true;
  state.sendButtonHint = "";
  startSendProgressWatchdog(state.currentThreadId);
  if (steering) setSteerFeedback("sending", { threadId: state.currentThreadId, turnId: steerTurnId, clientSubmissionId });
  else markActivity(threadTaskCardCommand ? "任务卡片" : "发送");
  updateComposerControls();
  if (state.sendProgressWarned) {
    $("connectionState").textContent = steering ? "引导中…" : (threadTaskCardCommand ? "Task card draft request" : "发送中…");
    $("connectionState").classList.remove("error");
  }
  try {
    const body = new FormData();
    body.append("clientSubmissionId", clientSubmissionId);
    body.append("text", outboundText);
    if (state.currentThread && state.currentThread.cwd) body.append("cwd", state.currentThread.cwd);
    if (steerTurnId) body.append("activeTurnId", steerTurnId);
    body.append("model", selectedComposerModel());
    body.append("effort", selectedComposerEffort());
    body.append("permissionMode", selectedComposerPermissionMode());
    for (const item of state.pendingAttachments) {
      body.append("attachments", item.file, item.file.name || "upload");
    }
    followSubmittedMessageToBottom(state.currentThreadId, clientSubmissionId);
    await api(`/api/threads/${encodeURIComponent(state.currentThreadId)}/messages`, {
      method: "POST",
      body,
      timeoutMs: 180000,
    });
    setComposerText("");
    clearPendingAttachments();
    clearDraftForKey(submittedDraftKey);
    if (!steering) {
      state.composerModel = "";
      state.composerEffort = "";
      state.composerPermissionMode = "";
      renderComposerSettings();
    }
    input.blur();
    $("connectionState").classList.remove("error");
    if (steering) setSteerFeedback("delivered", { threadId: state.currentThreadId, turnId: steerTurnId, clientSubmissionId });
    else {
      $("connectionState").textContent = threadTaskCardCommand ? "Task card draft requested" : "Sent";
      markActivity(threadTaskCardCommand ? "草案已请求" : "已发送");
    }
    scheduleCurrentThreadRefresh(600);
    scheduleLivePollIfNeeded(1200);
  } catch (err) {
    clearSubmittedMessageBottomFollow();
    const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err))
      || "发送失败，请重试";
    state.sendButtonHint = "重试";
    if (steering) setSteerFeedback("failed", { threadId: state.currentThreadId, turnId: steerTurnId, clientSubmissionId });
    else {
      $("connectionState").classList.add("error");
      $("connectionState").textContent = message.includes("发送") ? message : "发送失败，请重试";
    }
    postClientEvent("send_failure", {
      threadId: state.currentThreadId || "",
      message,
      steering,
    });
  } finally {
    finishSendProgressWatchdog();
    state.composerBusy = false;
    updateComposerControls();
  }
}

async function sendNewThreadMessage(text, hasContent, input) {
  if (!hasContent) return;
  const submittedDraftKey = currentDraftKey();
  const clientSubmissionId = createSubmissionId();
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
    body.append("model", newThreadSelectedModel());
    body.append("effort", newThreadSelectedEffort());
    body.append("permissionMode", newThreadSelectedPermissionMode());
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
    const turnId = startedTurnId(result);
    const userItem = localUserMessageItem(text, submittedAttachments, clientSubmissionId);
    const thread = Object.assign({
      id: threadId,
      preview: text || "新建对话",
      cwd: (result && result.thread && result.thread.cwd) || state.selectedCwd || "",
      status: { type: "active" },
      turns: [],
    }, result.thread || {});
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
    state.currentThreadId = threadId;
    state.currentThread = thread;
    state.activeTurnId = turnId || state.activeTurnId;
    if (state.events) connectEvents();
    setComposerText("");
    clearPendingAttachments();
    clearDraftForKey(submittedDraftKey);
    if (input) input.blur();
    renderComposerSettings();
    renderThreads();
    renderCurrentThread({ stickToBottom: true });
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
    const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err))
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

async function mutateThreadTaskCard(cardId, action, body = {}) {
  const id = String(cardId || "").trim();
  if (!id || !state.currentThreadId) return;
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = action === "approve" ? "Approving task card" : `${action} task card`;
  try {
    const result = await api(`/api/thread-task-cards/${encodeURIComponent(id)}/${encodeURIComponent(action)}`, {
      method: "POST",
      body: JSON.stringify(Object.assign({ threadId: state.currentThreadId }, body)),
      timeoutMs: 30000,
    });
    if (action === "approve" && result && result.execution && result.execution.turnId) {
      $("connectionState").textContent = "Task card approved; starting target turn";
    } else {
      $("connectionState").textContent = "Task card updated";
    }
    settleCurrentThreadTaskCard(id, action === "approve" ? "approved" : action === "delete" ? "deleted" : action === "revoke" ? "revoked" : "replied", result && result.card ? result.card : null);
    if (action === "approve" && result && result.execution && result.execution.turnId) {
      const injectedVisible = await waitForCurrentThreadTurn(result.execution.turnId, { timeoutMs: 10000, intervalMs: 500 });
      $("connectionState").textContent = injectedVisible ? "Task card approved and injected" : "Task card approved; waiting for thread refresh";
      loadThreads({ silent: true }).catch(showError);
      return;
    }
    await refreshCurrentThreadAfterTaskCard();
  } catch (err) {
    showError(err);
  }
}

function replyTaskCard(cardId) {
  const card = findThreadTaskCard(cardId);
  if (!card) return Promise.resolve();
  const body = window.prompt("Reply body", "") || "";
  if (!String(body).trim()) return Promise.resolve();
  const title = `Reply: ${card.message && card.message.title ? card.message.title : "Task card"}`;
  return mutateThreadTaskCard(card.id, "reply", {
    format: "markdown",
    title,
    summary: summarizeTaskCardText(body),
    body: String(body).trim(),
    idempotencyKey: `task-card-reply:${card.id}:${Date.now()}:${Math.random().toString(16).slice(2, 8)}`,
  });
}

function findThreadTaskCardDraftByKey(draftKey) {
  const key = String(draftKey || "");
  const thread = state.currentThread;
  const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
  for (const turn of turns) {
    const items = Array.isArray(turn && turn.items) ? turn.items : [];
    for (const item of items) {
      if (!item || (item.type !== "agentMessage" && item.type !== "plan")) continue;
      const itemKey = threadTaskCardDraftKey(turn.id, item.id || "");
      if (itemKey !== key) continue;
      const draft = parseThreadTaskCardDraftText(item.text || "");
      if (!draft) return null;
      return { key, draft, turn, item };
    }
  }
  return null;
}

function setThreadTaskCardDraftState(draftKey, nextState, options = {}) {
  const key = String(draftKey || "");
  if (!key) return;
  state.threadTaskCardDraftStates.set(key, Object.assign({}, threadTaskCardDraftState(key), nextState || {}));
  saveThreadTaskCardDraftStates();
  if (options.render !== false) renderCurrentThread();
}

function dismissThreadTaskCardDraft(draftKey) {
  setThreadTaskCardDraftState(draftKey, { status: "dismissed", error: "" });
}

function queueThreadTaskCardDraftCreation(draftKey) {
  const key = String(draftKey || "");
  if (!key || state.scheduledThreadTaskCardDraftCreations.has(key)) return;
  state.scheduledThreadTaskCardDraftCreations.add(key);
  setThreadTaskCardDraftState(key, { status: "creating", error: "" }, { render: false });
  window.setTimeout(() => {
    state.scheduledThreadTaskCardDraftCreations.delete(key);
    createThreadTaskCardDraft(key).catch(showError);
  }, 0);
}

async function createThreadTaskCardDraft(draftKey) {
  const resolved = findThreadTaskCardDraftByKey(draftKey);
  if (!resolved || !state.currentThreadId || !state.currentThread) {
    setThreadTaskCardDraftState(draftKey, { status: "pending", error: "" }, { render: false });
    return;
  }
  const { draft, turn } = resolved;
  const targetRefs = threadTaskCardDraftTargetThreads(draft);
  const targetThreadIds = targetRefs.map((entry) => entry.threadId).filter(Boolean);
  const missingTargets = targetRefs.filter((entry) => !entry.thread).map((entry) => entry.threadId).filter(Boolean);
  if (!targetThreadIds.length || missingTargets.length) {
    setThreadTaskCardDraftState(draftKey, { status: "failed", error: draft.error || `Target thread is missing from the visible thread list${missingTargets.length ? `: ${missingTargets.join(", ")}` : ""}` });
    return;
  }
  if (!draft.title || !draft.body) {
    setThreadTaskCardDraftState(draftKey, { status: "failed", error: draft.error || "Draft is incomplete" });
    return;
  }
  setThreadTaskCardDraftState(draftKey, { status: "creating", error: "" });
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "Creating task card";
  try {
    const targetWorkspaceIds = {};
    for (const entry of targetRefs) {
      if (entry.thread) targetWorkspaceIds[entry.threadId] = String(entry.thread.cwd || "");
    }
    const result = await api("/api/thread-task-cards", {
      method: "POST",
      body: JSON.stringify({
        sourceWorkspaceId: state.currentThread.cwd || state.selectedCwd || "",
        sourceThreadId: state.currentThreadId,
        sourceTurnId: String(turn && turn.id || ""),
        sourceThreadTitle: threadTitleForDisplay(state.currentThread) || state.currentThreadId,
        targetThreadIds,
        targetWorkspaceIds,
        idempotencyKey: `task-card-draft:${state.currentThreadId}:${draftKey}`,
        format: "markdown",
        title: draft.title,
        summary: draft.summary || summarizeTaskCardText(draft.body),
        body: draft.body,
      }),
      timeoutMs: 30000,
    });
    const createdCards = Array.isArray(result && result.cards)
      ? result.cards.filter(Boolean)
      : (result && result.card ? [result.card] : []);
    if (state.currentThread && String(state.currentThread.id || "") === String(state.currentThreadId || "")) {
      for (const createdCard of createdCards) {
        upsertThreadTaskCardOnThread(state.currentThread, createdCard);
        incrementPendingOutgoingTaskCardCount(state.currentThreadId, 1);
        incrementPendingIncomingTaskCardCount(createdCard && createdCard.target && createdCard.target.threadId, 1);
      }
    }
    setThreadTaskCardDraftState(draftKey, {
      status: "created",
      error: "",
      cardId: String(createdCards[0] && createdCards[0].id || ""),
      cardIds: createdCards.map((card) => String(card && card.id || "")).filter(Boolean),
    });
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
    renderThreads();
    loadThreads({ silent: true }).catch(showError);
    if (createdCards.length === 1) {
      await loadThread(createdCards[0].target && createdCards[0].target.threadId || targetThreadIds[0], { source: "task-card-created" });
    } else {
      renderCurrentThread();
    }
  } catch (err) {
    setThreadTaskCardDraftState(draftKey, {
      status: "failed",
      error: normalizeClientErrorMessage(err && err.message ? err.message : String(err)) || "Task card creation failed",
    });
    throw err;
  }
}

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
      const createOption = event.target.closest("[data-create-workspace]");
      if (createOption) {
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
      if (!sidebarWorkspaceMenu.hidden && !sidebarWorkspaceMenu.contains(event.target) && !sidebarWorkspaceSelect.contains(event.target)) {
        closeSidebarWorkspaceMenu();
      }
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
      if (sidebarWorkspaceMenu.hidden) {
        openSidebarWorkspaceMenu();
      } else {
        closeSidebarWorkspaceMenu();
      }
    };
    sidebarWorkspaceSelect.addEventListener("pointerdown", toggleSidebarWorkspaceMenu);
    sidebarWorkspaceMenu.addEventListener("click", onSidebarWorkspaceOption);
    closeSidebarWorkspaceMenu();
  }
  $("newThreadButton").addEventListener("click", enterNewThreadDraft);
  $("refreshThreads").addEventListener("click", () => loadThreads().catch(showError));
  $("pushNotifications").addEventListener("click", () => handlePushButtonClick().catch(showError));
  if ($("appUpdateStatus")) $("appUpdateStatus").addEventListener("click", () => handleAppUpdateClick().catch(showError));
  if ($("publicPrStatus")) $("publicPrStatus").addEventListener("click", () => handlePublicPrStatusClick().catch(showError));
  if ($("sharedRestartButton")) $("sharedRestartButton").addEventListener("click", () => handleSharedRestartClick().catch(showError));
  if ($("themeSettingsToggle")) $("themeSettingsToggle").addEventListener("click", () => {
    setTimeout(() => publishPluginNavigationState({ force: true }), 0);
  });
  const settingsPanel = $("themeSettingsPanel");
  if (settingsPanel) settingsPanel.addEventListener("click", handleFontSizeChoice);
  const runtimeControls = [
    ["composerModelControl", "model"],
    ["composerEffortControl", "effort"],
    ["composerPermissionControl", "permission"],
  ];
  for (const [id, kind] of runtimeControls) {
    const button = $(id);
    if (!button) continue;
    button.dataset.composerRuntime = kind;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      if (state.composerMenuKind === kind) closeComposerRuntimeMenu();
      else openComposerRuntimeMenu(kind, button);
    });
  }
  const runtimeMenu = $("composerRuntimeMenu");
  if (runtimeMenu) {
    runtimeMenu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-runtime-kind][data-runtime-value]");
      if (!option) return;
      event.preventDefault();
      event.stopPropagation();
      applyRuntimeSelection(option.dataset.runtimeKind, option.dataset.runtimeValue);
    });
  }
  const quotaUsage = $("quotaUsage");
  if (quotaUsage) {
    quotaUsage.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleQuotaDetails(quotaUsage);
    });
  }
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
  if ($("continuationConfirm")) $("continuationConfirm").addEventListener("click", () => {
    const threadId = state.continuationDialogThreadId;
    const thread = threadId === "__current__" ? (state.currentThread || null) : threadById(threadId);
    startNewThreadFromThread(thread).catch(showError);
  });
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
  document.addEventListener("touchstart", beginSidebarEdgeSwipe, { passive: true });
  document.addEventListener("touchmove", moveSidebarEdgeSwipe, { passive: false });
  document.addEventListener("touchend", finishSidebarEdgeSwipe, { passive: true });
  document.addEventListener("touchcancel", cancelSidebarEdgeSwipe, { passive: true });
  $("openMenu").addEventListener("click", openSidebarMenu);
  $("closeMenu").addEventListener("click", closeSidebarMenu);
  const pageRefreshPrompt = $("pageRefreshPrompt");
  if (pageRefreshPrompt) pageRefreshPrompt.addEventListener("click", refreshPageForNewBuild);
  $("composer").addEventListener("submit", sendMessage);
  $("sendMessage").addEventListener("pointerup", requestComposerSubmitFromButton);
  $("sendMessage").addEventListener("click", requestComposerSubmitFromButton);
  $("interruptTurn").addEventListener("click", interruptActiveTurn);
  if ($("scrollToBottom")) $("scrollToBottom").addEventListener("click", () => {
    clearConversationAutoScrollHold();
    clearRecentCompletedReplyAnchor();
    clearSubmittedMessageBottomFollow();
    clearViewportBottomFollow();
    scrollConversationToBottom();
  });
  if ($("scrollToTurnReply")) $("scrollToTurnReply").addEventListener("click", scrollConversationToTurnReply);
  $("conversation").addEventListener("pointerdown", rememberConversationScrollIntent, { passive: true });
  $("conversation").addEventListener("touchstart", rememberConversationScrollIntent, { passive: true });
  $("conversation").addEventListener("touchstart", beginSubagentSwipe, { passive: true });
  $("conversation").addEventListener("touchmove", moveSubagentSwipe, { passive: false });
  $("conversation").addEventListener("touchend", finishSubagentSwipe, { passive: true });
  $("conversation").addEventListener("touchcancel", cancelSubagentSwipe, { passive: true });
  $("conversation").addEventListener("wheel", rememberConversationScrollIntent, { passive: true });
  $("conversation").addEventListener("wheel", handleSubagentWheelSwipe, { passive: true });
  $("conversation").addEventListener("scroll", () => {
    updateRecentCompletedReplyAnchorFromScroll();
    updateConversationAutoScrollHoldFromScroll();
    updateScrollToBottomButton();
  }, { passive: true });
  $("conversation").addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy-key]");
    if (copyButton) {
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
    const localFileLink = event.target.closest("[data-local-file-path]");
    if (localFileLink) {
      event.preventDefault();
      event.stopPropagation();
      openLocalFilePreview(localFileLink).catch(showError);
      return;
    }
    const button = event.target.closest("[data-approval-action]");
    if (button) {
      answerApproval(button.dataset.approvalId, button.dataset.approvalAction).catch(showError);
      return;
    }
    const taskButton = event.target.closest("[data-task-card-action]");
    if (taskButton) {
      const action = taskButton.dataset.taskCardAction || "";
      const cardId = taskButton.dataset.taskCardId || "";
      if (action === "reply") {
        replyTaskCard(cardId).catch(showError);
      } else if (action === "approve" || action === "delete" || action === "revoke") {
        mutateThreadTaskCard(cardId, action).catch(showError);
      }
      return;
    }
    const taskDraftButton = event.target.closest("[data-task-card-draft-action]");
    if (taskDraftButton) {
      const action = String(taskDraftButton.dataset.taskCardDraftAction || "");
      const draftKey = String(taskDraftButton.dataset.taskCardDraftKey || "");
      if (action === "dismiss") dismissThreadTaskCardDraft(draftKey);
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
    if (state.sendButtonHint && !state.composerBusy) state.sendButtonHint = "";
    updateComposerControls();
    scheduleCurrentDraftSave();
  });
  $("messageInput").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (!composerHasContent() || state.composerBusy) return;
    event.preventDefault();
    $("composer").requestSubmit();
  });
  $("messageInput").addEventListener("paste", (event) => {
    const files = Array.from((event.clipboardData && event.clipboardData.files) || []);
    if (files.length) addAttachmentFiles(files).catch(showError);
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
      openLocalFilePreview(localFileLink).catch(showError);
    }
    });
  }
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
  installLaunchQueueHandler();
  installPluginWindowingGuards();
  window.addEventListener("message", (event) => {
    if (pluginEmbedApi.isBackMessage && pluginEmbedApi.isBackMessage(event)) handlePluginBack(event);
  });
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
  }
  document.addEventListener("visibilitychange", () => {
    postClientEvent("page_visibility", {
      visibilityState: document.visibilityState,
      currentThreadId: state.currentThreadId || "",
      eventOpen: Boolean(state.events && state.events.readyState === EventSource.OPEN),
    });
    if (document.visibilityState === "visible") schedulePageRefreshCheck(200, { force: true });
    scheduleMobileResume("visibility");
  });
  window.addEventListener("pageshow", (event) => {
    postClientEvent("page_show", {
      persisted: Boolean(event && event.persisted),
      currentThreadId: state.currentThreadId || "",
    });
    const threadId = applyUrlThreadSelection({ load: true });
    const pluginRouteHint = applyUrlPluginRouteHint({ load: true });
    schedulePageRefreshCheck(200, { force: true });
    scheduleMobileResume("pageshow", threadId || pluginRouteHint ? 240 : 80);
  });
  window.addEventListener("focus", () => {
    const threadId = applyUrlThreadSelection({ load: true });
    const pluginRouteHint = applyUrlPluginRouteHint({ load: true });
    schedulePageRefreshCheck(600);
    scheduleMobileResume("focus", threadId || pluginRouteHint ? 300 : 150);
  });
  window.addEventListener("blur", () => scheduleVisualRecovery("window-blur", 180, { render: false }));
  window.addEventListener("pagehide", saveCurrentDraftNow);
  window.addEventListener("beforeunload", saveCurrentDraftNow);
  document.addEventListener("focusin", () => scheduleVisualRecovery("focusin", 40, { render: false, heavy: false, delays: [40, 180] }));
  document.addEventListener("focusout", () => scheduleVisualRecovery("focusout", 160, { render: false, heavy: false, delays: [160, 420] }));
  window.addEventListener("orientationchange", () => {
    followViewportChangeToBottom("orientation");
    scheduleMobileResume("orientation", 250);
  });
  window.addEventListener("resize", () => {
    followViewportChangeToBottom("resize");
    updateViewportVars();
    updateComposerHeightVar();
    scheduleViewportBottomFollowScroll();
    scheduleVisualRecovery("resize", 40, { render: false, heavy: false, delays: [40, 180] });
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      followViewportChangeToBottom("visual-viewport-resize");
      updateViewportVars();
      updateComposerHeightVar();
      scheduleViewportBottomFollowScroll();
      scheduleVisualRecovery("visual-viewport", 40, { render: false, heavy: false, delays: [40, 180, 520] });
    });
    window.visualViewport.addEventListener("scroll", () => {
      followViewportChangeToBottom("visual-viewport-scroll");
      updateViewportVars();
      scheduleViewportBottomFollowScroll();
      scheduleVisualRecovery("visual-viewport-scroll", 40, { render: false, heavy: false, delays: [40, 180] });
    });
  }
}

async function start() {
  wireUi();
  startRelativeTimeTimer();
  startUiWatchdog();
  const config = await fetch("/api/public-config").then((res) => res.json());
  initializePageBuildState(config);
  startPageRefreshChecks();
  state.appVersion = String(config.version || "");
  state.serverPlatform = String(config.platform || "");
  state.maxUploadBytes = Number(config.maxUploadBytes || state.maxUploadBytes);
  state.maxUploadFiles = Number(config.maxUploadFiles || state.maxUploadFiles);
  state.rolloutWarningThresholdBytes = Number(config.rolloutWarningBytes || state.rolloutWarningThresholdBytes);
  state.modelOptions = normalizeOptionList(config.modelOptions || []);
  state.reasoningEffortOptions = normalizeOptionList(config.reasoningEffortOptions || []);
  state.permissionModeOptions = normalizeOptionList((config.permissionModeOptions || state.permissionModeOptions)
    .map(normalizePermissionModeValue));
  state.defaultModel = String(config.defaultModel || "");
  state.defaultReasoningEffort = String(config.defaultReasoningEffort || "");
  state.newThreadModel = state.newThreadModel || state.defaultModel || state.modelOptions[0] || "";
  state.newThreadEffort = state.newThreadEffort || state.defaultReasoningEffort || state.reasoningEffortOptions[0] || "";
  state.newThreadPermissionMode = normalizePermissionModeValue(state.newThreadPermissionMode)
    || normalizePermissionModeValue(state.permissionModeOptions[0])
    || "full";
  state.pushServerSupported = Boolean(config.push && config.push.supported);
  state.appUpdateStatus = {
    supported: Boolean(config.update && config.update.enabled),
    version: state.appVersion,
    remote: config.update && config.update.remote || "origin",
    branch: config.update && config.update.branch || "main",
  };
  state.publicPrEnabled = Boolean(config.publicPullRequests && config.publicPullRequests.enabled);
  state.publicPrRepository = String(config.publicPullRequests && config.publicPullRequests.repository || "");
  state.appWorkspacePath = String(config.workspacePath || state.appWorkspacePath || "").trim();
  state.workspaceCreateEnabled = config.workspaceCreate ? config.workspaceCreate.enabled !== false : true;
  state.workspaceCreateRoot = String(config.workspaceCreate && config.workspaceCreate.defaultRoot || "").trim();
  state.workspaceCreateRoots = normalizeOptionList(config.workspaceCreate && config.workspaceCreate.roots || []);
  state.publicPrStatus = {
    enabled: state.publicPrEnabled,
    repository: state.publicPrRepository,
  };
  renderAppUpdateStatus();
  renderPublicPrStatus();
  renderSharedRestartButton();
  renderComposerSettings();
  rememberRateLimits(config.rateLimits || null, config.rateLimitsByModel || null);
  updatePushButton();
  if (isHermesEmbedMode() && state.pluginLaunchSession) {
    try {
      await exchangePluginLaunchSession();
    } catch (err) {
      requestHermesPluginRefresh(pluginRefreshReasonForApiError({
        status: 401,
        message: err && err.message ? err.message : String(err),
        path: "/api/v1/hermes/plugin/session",
      }) || "plugin_launch_invalid", { force: true });
      showPluginEmbedRecovering("Refreshing Codex Mobile plugin launch...");
      return;
    }
  }
  if (config.authRequired && !state.key) {
    if (isHermesEmbedMode()) {
      requestHermesPluginRefresh("plugin_session_missing", { force: true });
      showPluginEmbedRecovering("Refreshing Codex Mobile plugin session...");
    }
    else showLogin();
    return;
  }
  showApp();
  await bootstrap().catch((err) => {
    showError(err);
    if (/unauthorized|forbidden|session expired|invalid session|invalid launch/i.test(err.message || "")) {
      if (isHermesEmbedMode()) {
        requestHermesPluginRefresh(pluginRefreshReasonForApiError({
          status: /forbidden/i.test(err.message || "") ? 403 : 401,
          message: err && err.message ? err.message : String(err),
          path: "",
        }) || "auth_state_changed", { force: true });
        showPluginEmbedRecovering("Refreshing Codex Mobile plugin session...");
      }
      else showLogin();
    }
  });
  resumeRememberedContinuationJob().catch(showError);
}

start();
