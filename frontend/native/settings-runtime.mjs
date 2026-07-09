"use strict";

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
  } catch (_) {
    // Status hints are best-effort UI state.
  }
}

function saveStringSetStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify([...value].filter(Boolean)));
  } catch (_) {
    // Status hints are best-effort UI state.
  }
}

function normalizeRestartAutoRecoverThread(thread) {
  const id = String(thread && thread.id || thread && thread.threadId || "").trim();
  if (!id) return null;
  return {
    id,
    activeTurnId: String(thread && thread.activeTurnId || ""),
    cwd: String(thread && thread.cwd || ""),
    name: String(thread && (thread.name || thread.preview) || ""),
    status: thread && thread.status ? thread.status : { type: "active" },
  };
}

function loadRestartAutoRecoverThreads() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_RESTART_AUTO_RECOVER_THREADS) || "[]");
    if (!Array.isArray(value)) return [];
    return value.map(normalizeRestartAutoRecoverThread).filter(Boolean).slice(0, 12);
  } catch (_) {
    return [];
  }
}

function saveRestartAutoRecoverThreads(threads) {
  const normalized = (threads || []).map(normalizeRestartAutoRecoverThread).filter(Boolean).slice(0, 12);
  state.restartAutoRecoverThreads = normalized;
  try {
    if (normalized.length) localStorage.setItem(STORAGE_RESTART_AUTO_RECOVER_THREADS, JSON.stringify(normalized));
    else localStorage.removeItem(STORAGE_RESTART_AUTO_RECOVER_THREADS);
  } catch (_) {
    // Restart recovery hints are best-effort UI state.
  }
  return normalized;
}

function clearRestartAutoRecoverThreads() {
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
        cardIds: Array.isArray(value.cardIds) ? value.cardIds.map((id) => String(id || "")).filter(Boolean).slice(0, 12) : [],
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
  if (appearance.theme && window.codexMobileTheme && typeof window.codexMobileTheme.apply === "function") {
    window.codexMobileTheme.apply(appearance.theme);
  }
  const storedFontSize = storedFontSizePreference();
  if (storedFontSize) {
    state.pluginAppearance = Object.assign({}, state.pluginAppearance || {}, { fontSize: storedFontSize });
  }
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

function isMenuOverlayMode() {
  return window.matchMedia(MENU_OVERLAY_MEDIA).matches
    && !window.matchMedia(TABLET_SPLIT_MEDIA).matches;
}

function viewportState() {
  const embedded = isHermesEmbedMode();
  const hostViewport = state.pluginHostViewport && typeof state.pluginHostViewport === "object"
    ? state.pluginHostViewport
    : null;
  const hostKeyboard = hostViewport && hostViewport.keyboard && typeof hostViewport.keyboard === "object"
    ? hostViewport.keyboard
    : null;
  const hostFooter = hostViewport && hostViewport.footer && typeof hostViewport.footer === "object"
    ? hostViewport.footer
    : null;
  const measured = viewportMetrics.measureViewport({
    visualHeight: window.visualViewport && window.visualViewport.height,
    visualOffsetTop: window.visualViewport && window.visualViewport.offsetTop,
    scrollTop: embedded ? Math.max(
      0,
      Number(window.scrollY || 0) || 0,
      Number(document.documentElement && document.documentElement.scrollTop || 0) || 0,
      Number(document.body && document.body.scrollTop || 0) || 0,
    ) : 0,
    innerHeight: window.innerHeight,
    clientHeight: document.documentElement && document.documentElement.clientHeight,
    activeElement: document.activeElement,
    hostViewportHeight: embedded && hostViewport && hostViewport.viewport ? hostViewport.viewport.height : 0,
    hostKeyboardVisible: Boolean(embedded && hostKeyboard && hostKeyboard.visible),
    hostKeyboardBottomInset: embedded && hostKeyboard ? hostKeyboard.bottomInset : 0,
    hostBottomSafeArea: embedded && hostFooter ? hostFooter.safeAreaBottom : 0,
  });
  measured.hostTopSafeArea = embedded && hostViewport ? boundedViewportNumber(hostViewport.hostTopSafeArea, 512) : 0;
  return measured;
}

function viewportHeight() {
  return viewportState().height;
}

function setStableRootPixelVar(name, nextValue, stateKey, options = {}) {
  const nextPx = viewportMetrics.cssPixel(nextValue);
  const previousPx = viewportMetrics.cssPixel(state[stateKey]);
  if (!options.force && !viewportMetrics.stablePixelChanged(previousPx, nextPx, options)) return false;
  state[stateKey] = nextPx;
  document.documentElement.style.setProperty(name, `${nextPx}px`);
  return true;
}

function isKeyboardEditableElement(element) {
  return Boolean(viewportMetrics
    && typeof viewportMetrics.isKeyboardEditable === "function"
    && viewportMetrics.isKeyboardEditable(element));
}

function isHermesKeyboardInputActive() {
  return isHermesEmbedMode() && isKeyboardEditableElement(document.activeElement);
}

function resetMobileKeyboardWindowScroll() {
  if (isHermesEmbedMode() || !isKeyboardEditableElement(document.activeElement)) return;
  const scrollY = Math.max(
    0,
    Number(window.scrollY || 0) || 0,
    Number(document.documentElement && document.documentElement.scrollTop || 0) || 0,
    Number(document.body && document.body.scrollTop || 0) || 0,
  );
  if (scrollY < 1) return;
  if (typeof window.scrollTo === "function") window.scrollTo(0, 0);
  if (document.documentElement) document.documentElement.scrollTop = 0;
  if (document.body) document.body.scrollTop = 0;
}

function updateViewportVars() {
  resetMobileKeyboardWindowScroll();
  const viewport = viewportState();
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

function createSubmissionId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

var RECENT_SUBMITTED_USER_MESSAGE_TTL_MS = 6 * 60 * 60 * 1000;
var RECENT_SUBMITTED_USER_MESSAGE_ACCEPTED_TTL_MS = 2 * 60 * 1000;

function pruneRecentSubmittedUserMessages(now = Date.now()) {
  const records = state.recentSubmittedUserMessages;
  if (!records || typeof records.entries !== "function") return;
  for (const [key, record] of records.entries()) {
    const acceptedAtMs = Number(record && record.acceptedAtMs || 0);
    const ttlMs = acceptedAtMs > 0
      ? RECENT_SUBMITTED_USER_MESSAGE_ACCEPTED_TTL_MS
      : RECENT_SUBMITTED_USER_MESSAGE_TTL_MS;
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
    createdAtMs: Date.now(),
  });
  if (typeof recordSubmittedEchoDiagnosticLog === "function") {
    recordSubmittedEchoDiagnosticLog("recent-submission-registered", {
      threadId,
      clientSubmissionId: id,
      attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
      textLength: String(text || "").length,
    });
  }
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
  return thread.turns.some((turn) => Array.isArray(turn && turn.items)
    && turn.items.some((item) => item && String(item.clientSubmissionId || "") === id));
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
    turns: [],
  }, summary || {});
  thread.turns = Array.isArray(thread.turns) ? thread.turns.slice() : [];
  state.threadTileDetails.set(id, thread);
  return thread;
}

function syncLocalSubmissionThread(thread) {
  if (!thread || !thread.id) return;
  const id = String(thread.id || "");
  if (state.currentThread && String(state.currentThread.id || "") === id) {
    syncActiveTurnFromThread();
  } else {
    state.threadTileDetails.set(id, thread);
  }
  mergeThreadIntoThreadList(thread);
}

function insertLocalSubmittedUserMessage(threadId, text, attachments, clientSubmissionId, options = null) {
  const id = String(threadId || "").trim();
  const thread = mutableThreadForLocalSubmission(id);
  if (!id || !thread) {
    if (typeof recordSubmittedEchoDiagnosticLog === "function") {
      recordSubmittedEchoDiagnosticLog("local-insert-skipped", {
        threadId: id,
        clientSubmissionId,
        reason: !id ? "missing_thread_id" : "missing_thread",
      });
    }
    return false;
  }
  const submissionId = String(clientSubmissionId || "").trim();
  if (submissionId && threadHasClientSubmission(thread, submissionId)) {
    if (typeof recordSubmittedEchoDiagnosticLog === "function") {
      recordSubmittedEchoDiagnosticLog("local-insert-skipped", {
        threadId: id,
        clientSubmissionId: submissionId,
        reason: "submission_already_present",
      });
    }
    return false;
  }
  const opts = options || {};
  const requestedTurnId = String(opts.turnId || "").trim();
  const requestedTurn = requestedTurnId
    ? (thread.turns || []).find((entry) => entry && String(entry.id || "") === requestedTurnId)
    : null;
  const turnId = requestedTurnId && !isTurnComplete(requestedTurn)
    ? requestedTurnId
    : localSubmittedTurnId(submissionId);
  thread.turns = Array.isArray(thread.turns) ? thread.turns : [];
  let turn = thread.turns.find((entry) => entry && String(entry.id || "") === turnId);
  if (!turn) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    turn = {
      id: turnId,
      status: { type: "active" },
      startedAt: nowSeconds,
      items: [],
    };
    thread.turns.push(turn);
  }
  clientRenderStabilityGuard.markSubmittedTurn(turn, submissionId);
  turn.items = Array.isArray(turn.items) ? turn.items : [];
  turn.status = isCompletedStatus(turn.status) ? { type: "active" } : (turn.status || { type: "active" });
  turn.items.push(localUserMessageItem(text, attachments || [], submissionId));
  thread.status = { type: "active" };
  syncLocalSubmissionThread(thread);
  if (typeof recordSubmittedEchoDiagnosticLog === "function") {
    recordSubmittedEchoDiagnosticLog("local-insert-applied", {
      threadId: id,
      clientSubmissionId: submissionId,
      requestedTurnHash: diagnosticTurnHash(requestedTurnId),
      targetTurnHash: diagnosticTurnHash(turnId),
      createdLocalTurn: !requestedTurnId || requestedTurnId !== turnId,
      attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
      textLength: String(text || "").length,
    });
  }
  return true;
}

function mergeSubmittedUserItemIntoTurn(turn, item) {
  if (!turn || !item || item.type !== "userMessage") return false;
  turn.items = Array.isArray(turn.items) ? turn.items : [];
  const existingIndex = turn.items.findIndex((existing) => existing
    && existing.type === "userMessage"
    && (existing.id === item.id || userMessagesCanShadow(existing, item)));
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
  for (const turn of Array.isArray(thread && thread.turns) ? thread.turns : []) {
    for (const item of Array.isArray(turn && turn.items) ? turn.items : []) {
      if (durableUserMessageMatchesSubmittedRecord(item, record, clientSubmissionId)) return true;
    }
  }
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
    if (typeof recordSubmittedEchoDiagnosticLog === "function") {
      recordSubmittedEchoDiagnosticLog("recent-submission-settled", {
        threadId,
        clientSubmissionId,
        source: String(source || "thread-refresh").slice(0, 80),
      });
    }
  }
  if (changed) normalizeThreadVisibleUserMessages(thread);
  return settledCount;
}

function reconcileSubmittedUserMessageTurn(threadId, clientSubmissionId, serverTurnId) {
  const id = String(threadId || "").trim();
  const submissionId = String(clientSubmissionId || "").trim();
  const turnId = String(serverTurnId || "").trim();
  const thread = mutableThreadForLocalSubmission(id);
  if (!id || !submissionId || !turnId || !thread || String(thread.id || "") !== id) {
    if (typeof recordSubmittedEchoDiagnosticLog === "function") {
      recordSubmittedEchoDiagnosticLog("reconcile-skipped", {
        threadId: id,
        clientSubmissionId: submissionId,
        serverTurnHash: diagnosticTurnHash(turnId),
        reason: !id ? "missing_thread_id"
          : !submissionId ? "missing_submission_id"
          : !turnId ? "missing_server_turn_id"
          : !thread ? "missing_thread"
          : "thread_id_mismatch",
      });
    }
    return false;
  }
  thread.turns = Array.isArray(thread.turns) ? thread.turns : [];
  let sourceTurn = null;
  let sourceItem = null;
  for (const turn of thread.turns) {
    const item = (Array.isArray(turn && turn.items) ? turn.items : []).find((entry) => entry
      && entry.type === "userMessage"
      && String(entry.clientSubmissionId || "") === submissionId
      && isOptimisticUserMessage(entry));
    if (!item) continue;
    sourceTurn = turn;
    sourceItem = item;
    break;
  }
  if (!sourceItem) {
    if (typeof recordSubmittedEchoDiagnosticLog === "function") {
      recordSubmittedEchoDiagnosticLog("reconcile-skipped", {
        threadId: id,
        clientSubmissionId: submissionId,
        serverTurnHash: diagnosticTurnHash(turnId),
        reason: "optimistic_source_item_missing",
      });
    }
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
      items: [],
    };
    thread.turns.push(targetTurn);
  }
  clientRenderStabilityGuard.transferSubmittedTurnIdentity(sourceTurn, targetTurn, submissionId);
  const changed = mergeSubmittedUserItemIntoTurn(targetTurn, sourceItem);
  markRecentSubmittedUserMessageAccepted(id, submissionId, turnId);
  if (sourceTurn && sourceTurn !== targetTurn) {
    sourceTurn.items = (sourceTurn.items || []).filter((item) => item !== sourceItem);
    if (!sourceTurn.items.length && /^local-turn-/.test(String(sourceTurn.id || ""))) {
      thread.turns = thread.turns.filter((turn) => turn !== sourceTurn);
    }
  }
  normalizeThreadVisibleUserMessages(thread);
  syncLocalSubmissionThread(thread);
  if (typeof recordSubmittedEchoDiagnosticLog === "function") {
    recordSubmittedEchoDiagnosticLog("reconcile-applied", {
      threadId: id,
      clientSubmissionId: submissionId,
      sourceTurnHash: diagnosticTurnHash(sourceTurn && sourceTurn.id),
      serverTurnHash: diagnosticTurnHash(turnId),
      changed,
      movedTurn: Boolean(sourceTurn && sourceTurn !== targetTurn),
    });
  }
  return changed;
}

function markSubmittedUserMessageFailed(threadId, text, attachments, clientSubmissionId, message) {
  const id = String(clientSubmissionId || "").trim();
  if (!id) return;
  pruneRecentSubmittedUserMessages();
  const record = state.recentSubmittedUserMessages.get(id) || {
    threadId: String(threadId || ""),
    item: localUserMessageItem(text, attachments || [], id),
    createdAtMs: Date.now(),
  };
  record.threadId = String(threadId || record.threadId || "");
  record.item = Object.assign({}, record.item || localUserMessageItem(text, attachments || [], id), {
    mobilePendingSubmission: true,
    mobileSendError: {
      message: String(message || "发送失败，请重试"),
    },
  });
  state.recentSubmittedUserMessages.set(id, record);

  const thread = mutableThreadForLocalSubmission(threadId);
  if (!thread || (threadId && thread.id !== threadId)) return;
  thread.turns = Array.isArray(thread.turns) ? thread.turns : [];
  let found = false;
  for (const turn of thread.turns) {
    if (!turn || !Array.isArray(turn.items)) continue;
    const item = turn.items.find((entry) => entry && entry.clientSubmissionId === id);
    if (!item) continue;
    Object.assign(item, {
      mobilePendingSubmission: true,
      mobileSendError: record.item.mobileSendError,
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
        startedAt: Math.floor(Date.now() / 1000),
        completedAt: Math.floor(Date.now() / 1000),
        durationMs: 0,
        items: [],
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

function isRecentlySubmittedUserMessage(item) {
  if (!item || item.type !== "userMessage") return false;
  pruneRecentSubmittedUserMessages();
  const threadId = String(state.renderContextThreadId || state.currentThreadId || (state.currentThread && state.currentThread.id) || "");
  const id = String(item.clientSubmissionId || "").trim();
  if (id) {
    const record = state.recentSubmittedUserMessages.get(id);
    if (recentSubmittedUserRecordBelongsToThread(record, threadId)) return true;
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

function htmlAttrs(attrs = {}) {
  return Object.entries(attrs || {})
    .filter(([, value]) => value !== undefined && value !== null && String(value) !== "")
    .map(([key, value]) => ` ${key}="${escapeHtml(value)}"`)
    .join("");
}

function copyButtonHtml(copyKey, label, className = "", attrs = {}) {
  if (!copyKey) return "";
  const classes = ["copy-button", className].filter(Boolean).join(" ");
  return `<button class="${escapeHtml(classes)}" type="button" data-copy-key="${escapeHtml(copyKey)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"${htmlAttrs(attrs)}>${escapeHtml(label)}</button>`;
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
  const result = await api(`/api/threads/${threadId}/copy-text?${params.toString()}`, {
    timeoutMs: 45000,
  });
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

function isStaleActiveStatus(status) {
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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
    || /^#\s*Continuation Bootstrap Index\b/i.test(text)
    || /This thread is a same-workspace continuation created by Codex Mobile Web/i.test(text);
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
    thread.preview,
  ]) {
    const text = String(value || "").trim();
    if (text && !isRecoverableThreadDisplayTitle(text, id)) return text;
  }
  return id;
}

function threadDisplayName(thread) {
  return preferredThreadDisplayTitle(thread);
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
  const staleActive = isStaleActiveStatus(status) || Boolean(viewedThread && viewedThread.mobileStaleActiveTurn);
  const freshSettled = isThreadListSettledStatus(status)
    && !shouldKeepRunningHintForSettledStatus(id, viewedThread, status, {
      eventAtMs: threadUpdatedAtMs(viewedThread),
    });
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
  if (!previous || Math.abs(nowMs - previous) > 1000) {
    state.runningThreadHintedAtById[id] = nowMs;
    changed = true;
  }
  return changed;
}

function noteSubmittedProcessingThreadHint(threadId, nowMs = Date.now()) {
  const id = String(threadId || "");
  if (!id) return false;
  const previous = Number(state.submittedProcessingThreadHintedAtById[id] || 0);
  if (previous && Math.abs(nowMs - previous) <= 1000) return false;
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

function threadUpdatedAtMs(thread) {
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
  if (isStaleActiveStatus(status) || thread.mobileStaleActiveTurn) return false;
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
  return Boolean(state.currentThread
    && String(state.currentThread.id || "") === id
    && state.currentThread.mobileLoading);
}

function shouldKeepRunningHintForSettledStatus(threadId, thread = null, status = null, options = {}) {
  const id = String(threadId || "");
  const inputThread = threadForStatusHint(id, thread);
  return threadStatusHintPolicy.shouldKeepRunningHintForSettledStatus({
    threadId: id,
    thread: inputThread,
    status: status || (inputThread && inputThread.status),
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
    nowMs: options.nowMs,
  });
}

function shouldMarkThreadUnread(threadId, thread = null, status = null, options = {}) {
  const id = String(threadId || "");
  const inputThread = threadForStatusHint(id, thread);
  return threadStatusHintPolicy.shouldMarkThreadUnread({
    threadId: id,
    currentThreadId: state.currentThreadId,
    thread: inputThread,
    status: status || (inputThread && inputThread.status),
    viewedAtMs: state.threadViewedAtById[id],
    wasRunning: Boolean(options.wasRunning),
    runningHintedAtMs: options.hintedAtMs || state.runningThreadHintedAtById[id],
    eventAtMs: options.eventAtMs,
    eventIsTerminal: Boolean(options.eventIsTerminal),
    mobileReplay: Boolean(options.mobileReplay),
    freshnessToleranceMs: STATUS_EVENT_FRESHNESS_TOLERANCE_MS,
  });
}

function runningThreadHintAgeMs(threadId, thread, nowMs = Date.now()) {
  return threadStatusHintPolicy.runningHintAgeMs({
    threadId: String(threadId || ""),
    thread,
    runningHintedAtMs: state.runningThreadHintedAtById[String(threadId || "")],
    runningHintStaleMs: RUNNING_THREAD_HINT_STALE_MS,
    nowMs,
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
    nowMs,
  });
}

function updateThreadStatusHints(threadId, previousStatus, nextStatus, options = {}) {
  const id = String(threadId || "");
  if (!id) return;
  const thread = threadForStatusHint(id, options.thread);
  const nextThread = thread ? Object.assign({}, thread, { status: nextStatus || thread.status }) : null;
  const wasRunning = state.runningThreadIds.has(id) || isRunningStatus(previousStatus);
  const isRunning = isRunningStatus(nextStatus);
  const staleActive = isStaleActiveStatus(nextStatus);
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
      allowLocalProcessing: options.allowLocalProcessing !== false,
    });
    const shouldUnread = !keepRunningHint
      && !staleActive
      && !state.unreadThreadIds.has(id)
      && shouldMarkThreadUnread(id, nextThread, nextStatus, {
        wasRunning,
        eventAtMs: options.eventAtMs,
        eventIsTerminal,
        hintedAtMs,
        mobileReplay: Boolean(options.mobileReplay),
      });
    if (!keepRunningHint && clearRunningThreadHint(id)) changed = true;
    if (shouldUnread) {
      state.unreadThreadIds.add(id);
      changed = true;
      shouldAlert = true;
    }
  } else if (!state.unreadThreadIds.has(id)
    && shouldMarkThreadUnread(id, nextThread, nextStatus, {
      wasRunning,
      eventAtMs: options.eventAtMs,
      eventIsTerminal,
      mobileReplay: Boolean(options.mobileReplay),
    })) {
    state.unreadThreadIds.add(id);
    changed = true;
    shouldAlert = true;
  }
  if (changed) saveThreadStatusHints();
  if (shouldAlert && options.notify) {
    showCompletionAlert(id, options.threadName || threadDisplayName(thread));
  }
}

function isThreadListSettledStatus(status) {
  return threadStatusHintPolicy.isSettledStatus(status);
}

function isThreadListTerminalStatus(status) {
  return threadStatusHintPolicy.isTerminalStatus(status);
}

function reconcileThreadStatusHints(threads) {
  const nowMs = Date.now();
  let changed = false;
  for (const thread of threads || []) {
    const id = String(thread && thread.id || "");
    if (!id) continue;
    const wasRunning = state.runningThreadIds.has(id);
    const staleActive = isStaleActiveStatus(thread.status) || Boolean(thread.mobileStaleActiveTurn);
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
        eventAtMs: threadUpdatedAtMs(thread),
        eventIsTerminal: Boolean(terminalAtMs),
      })) {
        if (shouldExpireRunningThreadHint(id, thread, nowMs) && clearRunningThreadHint(id)) changed = true;
        continue;
      }
      if (clearRunningThreadHint(id)) changed = true;
      if (!state.unreadThreadIds.has(id)
        && shouldMarkThreadUnread(id, thread, thread.status, {
          wasRunning,
          eventAtMs: terminalAtMs,
          eventIsTerminal: Boolean(terminalAtMs),
          hintedAtMs,
        })) {
        state.unreadThreadIds.add(id);
        changed = true;
      }
    } else if (!wasRunning && !state.unreadThreadIds.has(id)) {
      const terminalAtMs = threadLatestTerminalTurnAtMs(thread);
      if (shouldMarkThreadUnread(id, thread, thread.status, {
        wasRunning,
        eventAtMs: terminalAtMs,
        eventIsTerminal: Boolean(terminalAtMs),
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

function statusIconInfo(status, threadId = "") {
  if (isStaleActiveStatus(status)) return null;
  const text = statusText(status);
  const normalized = text.toLowerCase();
  if (/active|running|queued|processing|inprogress|in_progress|in-progress|pending|started/.test(normalized)) {
    return { kind: "running", label: text || "running", symbol: "" };
  }
  const id = String(threadId || "");
  if (id && currentThreadRefreshSupportsThreadStatusHint(id)) {
    return { kind: "running", label: "refreshing", symbol: "" };
  }
  const hintThread = id ? threadForStatusHint(id) : null;
  if (id && state.runningThreadIds.has(id)
    && (!isThreadListSettledStatus(status)
      || currentLiveTurnSupportsThreadStatusHint(id)
      || shouldKeepRunningHintForSettledStatus(id, hintThread, status))) {
    return { kind: "running", label: text && text !== "notLoaded" ? text : "running", symbol: "" };
  }
  if (id && state.unreadThreadIds.has(id)) {
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

function tokenCountValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function formatTokenMillion(value) {
  const tokens = tokenCountValue(value);
  if (!tokens) return "0百万";
  const million = tokens / 1000000;
  if (million >= 100) return `${million.toFixed(0)}百万`;
  if (million >= 10) return `${million.toFixed(1)}百万`;
  if (million >= 0.01) return `${million.toFixed(2)}百万`;
  return "<0.01百万";
}

function tokenUsageForThread(thread) {
  return thread && thread.mobileTokenUsage && typeof thread.mobileTokenUsage === "object"
    ? thread.mobileTokenUsage
    : null;
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

function normalizeThreadGoal(goal, fallbackThreadId = "") {
  if (!goal || typeof goal !== "object") return null;
  const threadId = String(goal.threadId || fallbackThreadId || "").trim();
  const objective = String(goal.objective || "").replace(/\s+/g, " ").trim();
  if (!threadId || !objective) return null;
  const tokenBudget = goal.tokenBudget === null || goal.tokenBudget === undefined || goal.tokenBudget === ""
    ? null
    : Math.max(0, Math.trunc(Number(goal.tokenBudget) || 0));
  return {
    threadId,
    objective,
    status: normalizeThreadGoalStatus(goal.status),
    tokenBudget,
    tokensUsed: Math.max(0, Math.trunc(Number(goal.tokensUsed) || 0)),
    timeUsedSeconds: Math.max(0, Math.trunc(Number(goal.timeUsedSeconds) || 0)),
    createdAt: Math.max(0, Math.trunc(Number(goal.createdAt) || 0)),
    updatedAt: Math.max(0, Math.trunc(Number(goal.updatedAt) || 0)),
  };
}

function submittedThreadGoal(threadId, objective, tokenBudget = null) {
  const now = Date.now();
  return normalizeThreadGoal({
    threadId,
    objective,
    status: "active",
    tokenBudget,
    tokensUsed: 0,
    timeUsedSeconds: 0,
    createdAt: now,
    updatedAt: now,
  }, threadId);
}

function threadGoalForThread(thread) {
  return normalizeThreadGoal(thread && thread.goal, thread && thread.id);
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

function threadGoalSignature(thread) {
  const goal = threadGoalForThread(thread);
  if (!goal) return null;
  return {
    objective: goal.objective,
    status: goal.status,
    tokenBudget: goal.tokenBudget,
    tokensUsed: goal.tokensUsed,
    timeUsedSeconds: goal.timeUsedSeconds,
    updatedAt: goal.updatedAt,
  };
}

function threadGoalBudgetText(goal) {
  if (!goal) return "";
  const parts = [];
  if (Number.isFinite(Number(goal.tokenBudget)) && Number(goal.tokenBudget) > 0) {
    parts.push(`${Number(goal.tokensUsed || 0).toLocaleString()}/${Number(goal.tokenBudget).toLocaleString()} budget tokens`);
  } else if (Number(goal.tokensUsed || 0) > 0) {
    parts.push(`${Number(goal.tokensUsed || 0).toLocaleString()} budget tokens`);
  }
  if (Number(goal.timeUsedSeconds || 0) > 0) parts.push(formatElapsedTime(goal.timeUsedSeconds));
  return parts.join(" | ");
}

function renderThreadGoalBadge(goal) {
  if (!goal) return "";
  const status = normalizeThreadGoalStatus(goal.status);
  const statusClass = threadGoalStatusClass(status);
  const label = threadGoalStatusLabel(status);
  const title = `${label}: ${goal.objective}`;
  return `<div class="thread-card-goal-badge status-${escapeHtml(statusClass)}" title="${escapeHtml(title)}">${escapeHtml(label)}</div>`;
}

function renderThreadGoal(thread, previousKeys = new Set()) {
  const goal = threadGoalForThread(thread);
  if (!goal) return "";
  const key = `thread-goal|${goal.threadId}|${goal.status}|${goal.updatedAt}|${goal.objective}`;
  const statusClass = threadGoalStatusClass(goal.status);
  const budget = threadGoalBudgetText(goal);
  return `<section class="thread-goal-card status-${escapeHtml(statusClass)}${entryAnimationClass(key, previousKeys)}" data-render-key="${escapeHtml(key)}">
    <div class="thread-goal-card-top">
      <span class="thread-goal-card-label">${escapeHtml(threadGoalStatusLabel(goal.status))}</span>
      ${budget ? `<span class="thread-goal-card-meta">${escapeHtml(budget)}</span>` : ""}
    </div>
    <div class="thread-goal-card-objective">${escapeHtml(goal.objective)}</div>
  </section>`;
}

function dialogPrefillThreadGoal(goal) {
  const normalizedGoal = normalizeThreadGoal(goal, goal && goal.threadId);
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

function updateThreadGoalDialogState(goal = state.goalDialogExistingGoal) {
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

function setThreadGoalDialogBusy(busy, busyText = "Sending...") {
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
    "goalClearButton",
  ].forEach((id) => {
    const el = $(id);
    if (el) el.disabled = state.goalSubmitBusy;
  });
  const button = $("goalSubmitButton");
  if (button) button.textContent = state.goalSubmitBusy ? state.goalDialogBusyText : (state.goalDialogExistingGoal ? "Save" : "Send");
}

function openThreadGoalDialog(threadId = state.currentThreadId) {
  const id = String(threadId || "").trim();
  if (!id) {
    showError(new Error("No thread is selected"));
    return;
  }
  const thread = threadById(id) || (state.currentThread && String(state.currentThread.id || "") === id ? state.currentThread : null);
  if (!thread) {
    showError(new Error("Thread is not loaded"));
    return;
  }
  const dialog = $("goalDialog");
  const objectiveInput = $("goalObjectiveInput");
  const budgetInput = $("goalTokenBudgetInput");
  if (!dialog || !objectiveInput || !budgetInput) return;
  const goal = dialogPrefillThreadGoal(threadGoalForThread(thread));
  state.goalDialogThreadId = id;
  objectiveInput.value = goal ? goal.objective : "";
  budgetInput.value = goal && Number(goal.tokenBudget || 0) > 0 ? String(goal.tokenBudget) : "";
  const subtitle = $("goalDialogSubtitle");
  if (subtitle) subtitle.textContent = threadTitleForDisplay(thread) || id;
  updateThreadGoalDialogState(goal);
  dialog.classList.remove("hidden");
  setThreadGoalDialogBusy(false);
  window.setTimeout(() => objectiveInput.focus(), 0);
}

function closeThreadGoalDialog(force = false) {
  if (state.goalSubmitBusy && !force) return;
  const dialog = $("goalDialog");
  if (dialog) dialog.classList.add("hidden");
  state.goalDialogThreadId = "";
  state.goalDialogExistingGoal = null;
  state.goalDialogBusyText = "";
  setThreadGoalDialogBusy(false);
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
  return effectiveComposerPermissionMode(runtimeSettings.selectedNewThreadPermission({
    selected: state.newThreadPermissionMode,
    defaultValue: defaultNewThreadPermissionMode(),
    options: state.permissionModeOptions,
  }));
}

function normalizePermissionModeValue(value) {
  return runtimeSettings.normalizePermissionModeValue(value);
}

function effectiveComposerPermissionMode(value) {
  const normalized = normalizePermissionModeValue(value);
  if (normalized === "custom" && defaultNewThreadPermissionMode() === "full") return "full";
  return normalized;
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

function rememberRateLimits(rateLimits, rateLimitsByModel, options = {}) {
  let changed = false;
  if (options && options.replace === true) {
    state.rateLimits = null;
    state.rateLimitsByModel = {};
    changed = true;
  }
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

function clearStoredRateLimits() {
  state.rateLimits = null;
  state.rateLimitsByModel = {};
  localStorage.removeItem(STORAGE_RATE_LIMITS);
  localStorage.removeItem(STORAGE_RATE_LIMITS_BY_MODEL);
  renderQuotaUsage();
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
  if (Object.prototype.hasOwnProperty.call(config, "rateLimits")
    || Object.prototype.hasOwnProperty.call(config, "rateLimitsByModel")) {
    if (hasRateLimitSnapshot(config.rateLimits || null, config.rateLimitsByModel || null)) {
      rememberRateLimits(config.rateLimits || null, config.rateLimitsByModel || null, { replace: true });
    } else if (shouldKeepStoredRateLimitsOnEmptyConfig()) {
      renderQuotaUsage();
    } else {
      clearStoredRateLimits();
    }
  }
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
  renderCodexProfileSettings();
}

function codexProfileAccountLabel(profile) {
  const displayName = String(profile && (profile.accountName || profile.displayName || profile.accountLabel) || "").trim();
  if (displayName) return displayName;
  const auth = profile && profile.auth || {};
  if (auth.status === "loggedIn") {
    return auth.email || auth.name || auth.label || auth.accountId || "Logged in";
  }
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

function renderCodexProfileSettings() {
  const el = $("codexProfileSettings");
  if (!el) return;
  const profiles = Array.isArray(state.codexProfiles) ? state.codexProfiles : [];
  if (!profiles.length) {
    el.innerHTML = '<div class="codex-profile-empty">No Codex profiles found</div>';
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
    const action = switchingThisProfile
      ? (state.codexProfileSwitchStage || "预检中...")
      : active
        ? "Active"
        : "Switch";
    const title = !state.codexProfileSwitchSupported
      ? "Profile switching is disabled for this app-server configuration"
      : !loggedIn
        ? "Login to this Codex home before switching"
        : switchingThisProfile
          ? "Checking target account before switching"
        : showingSwitchProgress
          ? "Last profile switch status"
        : active
          ? "Current active profile"
          : "Switch all workspaces to this profile";
    const status = showingSwitchProgress
      ? `<small class="codex-profile-progress">${escapeHtml(state.codexProfileSwitchStage || "正在预检目标账号...")}</small>`
      : "";
    return `<div class="codex-profile-row${active ? " active" : ""}">`
      + `<div class="codex-profile-main">`
      + `<strong>${escapeHtml(accountLabel)}</strong>`
      + `<span>${escapeHtml(codexProfileStatusLabel(profile))}</span>`
      + `<small>${escapeHtml(profile.codexHome || "")}</small>`
      + status
      + `</div>`
      + `<div class="codex-profile-side">`
      + `<span class="codex-profile-quota">${escapeHtml(quotaShortTextFromSnapshot(profile.quota))}</span>`
      + `<button type="button" data-codex-profile-id="${escapeHtml(id)}" ${disabled ? "disabled" : ""} title="${escapeHtml(title)}">${escapeHtml(action)}</button>`
      + `</div>`
      + `</div>`;
  }).join("");
}

async function loadCodexProfiles() {
  const profiles = await api("/api/codex-profiles", { timeoutMs: 12000 });
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
    updatedAt: String(input.updatedAt || ""),
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
  const title = enabled
    ? "模型/工具显式发卡可直批到目标线程"
    : "模型/工具显式发卡会保留为 pending，目标线程需要审批";
  el.innerHTML = `<div class="workspace-delegation-row${enabled ? " enabled" : ""}">`
    + `<div class="workspace-delegation-main">`
    + `<strong>${enabled ? "已开启" : "已关闭"}</strong>`
    + `<span>${escapeHtml(title)}</span>`
    + `<small>${escapeHtml(workspaceDelegationSourceLabel(config.source))} · 本地预检关闭</small>`
    + `</div>`
    + `<div class="workspace-delegation-side">`
    + `<button type="button" data-workspace-delegation-toggle ${busy ? "disabled" : ""}>${busy ? "保存中" : enabled ? "关闭" : "开启"}</button>`
    + `</div>`
    + `</div>`;
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
      timeoutMs: 12000,
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
    updatedAt: String(input.updatedAt || ""),
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
  return `<label class="remote-managed-workspace-field"><span>${escapeHtml(label)}</span>`
    + `<input type="${escapeHtml(type)}" data-rmw-field="${escapeHtml(name)}" value="${escapeHtml(value || "")}" placeholder="${escapeHtml(placeholder)}" autocomplete="off">`
    + `</label>`;
}

function remoteManagedWorkspaceReadonlyField(label, value) {
  return `<div class="remote-managed-workspace-diagnostic"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "--")}</strong></div>`;
}

function remoteManagedWorkspaceRowStatus(config, workspace) {
  const cwd = String(workspace && workspace.cwd || "");
  if (!cwd) return { label: "Invalid path", className: "invalid" };
  const active = Boolean(config.enabled && remoteManagedWorkspacePathKey(config.projectRoot) === remoteManagedWorkspacePathKey(cwd));
  if (!active) return { label: "Local", className: "local" };
  if (!config.enrollmentTokenConfigured) return { label: "Auth required", className: "auth" };
  const status = remoteManagedWorkspaceStatusLabel(config.connectionStatus);
  if (status === "connected") return { label: "Connected", className: "connected" };
  if (status === "connecting") return { label: "Connecting", className: "connecting" };
  if (status === "offline") return { label: "Offline", className: "offline" };
  if (status === "stale") return { label: "Remote managed", className: "stale" };
  if (status === "auth failed") return { label: "Auth required", className: "auth" };
  if (status === "config invalid") return { label: "Invalid path", className: "invalid" };
  return { label: "Remote managed", className: "remote" };
}

function remoteManagedWorkspaceRowsHtml(config, busy) {
  const workspaces = Array.isArray(state.workspaces) ? state.workspaces.slice(0, 24) : [];
  if (!workspaces.length) {
    return `<div class="remote-managed-workspace-empty">No local workspaces.</div>`;
  }
  return workspaces.map((workspace) => {
    const cwd = String(workspace && workspace.cwd || "");
    const label = String(workspace && workspace.label || remoteManagedWorkspaceBaseName(cwd) || "Workspace");
    const source = String(workspace && workspace.source || "local");
    const active = Boolean(config.enabled && remoteManagedWorkspacePathKey(config.projectRoot) === remoteManagedWorkspacePathKey(cwd));
    const status = remoteManagedWorkspaceRowStatus(config, workspace);
    const mainAction = active ? "disable-workspace" : "enable-workspace";
    const mainLabel = active ? "Disable" : "远程受控";
    return `<article class="remote-managed-workspace-item ${escapeHtml(status.className)}${active ? " active" : ""}">`
      + `<div class="remote-managed-workspace-item-main">`
      + `<strong>${escapeHtml(label)}</strong>`
      + `<span>${escapeHtml(cwd)}</span>`
      + `<small>${escapeHtml(status.label)} · ${escapeHtml(source)}</small>`
      + `</div>`
      + `<div class="remote-managed-workspace-item-actions">`
      + `<button type="button" data-rmw-action="${escapeHtml(mainAction)}" data-rmw-workspace-cwd="${escapeHtml(cwd)}" ${busy || !cwd ? "disabled" : ""}>${escapeHtml(mainLabel)}</button>`
      + `<button type="button" data-rmw-action="test-connection" data-rmw-workspace-cwd="${escapeHtml(cwd)}" ${busy || !active ? "disabled" : ""}>Test</button>`
      + `</div>`
      + `</article>`;
  }).join("");
}

function remoteManagedWorkspaceAdvancedHtml(config) {
  const issueText = config.issueCodes.length ? config.issueCodes.slice(0, 8).join(", ") : "";
  return `<details class="remote-managed-workspace-advanced">`
    + `<summary>Advanced / Diagnostics</summary>`
    + `<div class="remote-managed-workspace-advanced-grid">`
    + remoteManagedWorkspaceReadonlyField("workspace kind", config.workspaceKind)
    + remoteManagedWorkspaceReadonlyField("workspace id", config.workspaceId)
    + remoteManagedWorkspaceReadonlyField("node name", config.nodeName)
    + remoteManagedWorkspaceReadonlyField("project root", config.projectRoot)
    + remoteManagedWorkspaceReadonlyField("allowed root", config.allowedRoot)
    + remoteManagedWorkspaceReadonlyField("project type", config.projectType)
    + remoteManagedWorkspaceReadonlyField("connection", `${config.connectionMode} -> ${config.effectiveConnectionMode}`)
    + remoteManagedWorkspaceReadonlyField("token", config.enrollmentTokenConfigured ? (config.enrollmentTokenRef || config.enrollmentTokenPreview || "configured") : "not configured")
    + remoteManagedWorkspaceReadonlyField("roles", config.roles.join(", "))
    + remoteManagedWorkspaceReadonlyField("capabilities", config.capabilities.join(", "))
    + remoteManagedWorkspaceReadonlyField("heartbeat", config.lastHeartbeatAt)
    + remoteManagedWorkspaceReadonlyField("poll", config.lastPollAt)
    + remoteManagedWorkspaceReadonlyField("task", config.lastTaskCardId)
    + remoteManagedWorkspaceReadonlyField("return", config.lastReturnStatus)
    + remoteManagedWorkspaceReadonlyField("queued returns", String(config.queuedTerminalReturnCount || 0))
    + remoteManagedWorkspaceReadonlyField("issues", issueText)
    + `</div>`
    + `<div class="remote-managed-workspace-token-entry">`
    + remoteManagedWorkspaceFieldHtml("Enrollment token", "enrollmentToken", "", { type: "password", placeholder: config.enrollmentTokenConfigured ? "configured" : "write-only" })
    + `<button type="button" data-rmw-action="save" ${state.remoteManagedWorkspaceBusy ? "disabled" : ""}>Save secure entry</button>`
    + `</div>`
    + `</details>`;
}

function refreshRemoteManagedWorkspaceRows() {
  if (state.remoteManagedWorkspaceWorkspaceLoadInFlight) return;
  state.remoteManagedWorkspaceWorkspaceLoadInFlight = true;
  api("/api/workspaces", { timeoutMs: 12000 })
    .then((workspaceResult) => {
      if (workspaceResult && Array.isArray(workspaceResult.data)) {
        state.workspaces = workspaceResult.data;
        renderRemoteManagedWorkspaceSettings();
      }
    })
    .catch(() => {})
    .finally(() => {
      state.remoteManagedWorkspaceWorkspaceLoadInFlight = false;
      state.remoteManagedWorkspaceWorkspaceLoadAttempted = true;
    });
}

function renderRemoteManagedWorkspaceSettings() {
  const el = $("remoteManagedWorkspaceSettings");
  if (!el) return;
  if (!((state.workspaces || []).length) && !state.remoteManagedWorkspaceWorkspaceLoadAttempted) {
    refreshRemoteManagedWorkspaceRows();
  }
  const config = normalizeRemoteManagedWorkspaceConfig(state.remoteManagedWorkspace);
  const busy = Boolean(state.remoteManagedWorkspaceBusy);
  const status = remoteManagedWorkspaceStatusLabel(config.connectionStatus);
  const issueText = config.issueCodes.length ? ` · ${config.issueCodes.slice(0, 3).join(", ")}` : "";
  el.innerHTML = `<div class="remote-managed-workspace-row${config.enabled ? " enabled" : ""}">`
    + `<div class="remote-managed-workspace-main">`
    + `<strong>${escapeHtml(config.enabled ? "已开启" : "已关闭")} · ${escapeHtml(status)}</strong>`
    + `<span>${escapeHtml(config.centralUrl || "Central server not set")}</span>`
    + `<small>${escapeHtml(config.effectiveConnectionMode || "http_polling")} fallback active${escapeHtml(issueText)}</small>`
    + `</div>`
    + `<div class="remote-managed-workspace-side">`
    + `<button type="button" data-rmw-action="poll-once" ${busy || !config.enabled ? "disabled" : ""}>Poll</button>`
    + `</div>`
    + `</div>`
    + `<div class="remote-managed-workspace-simple-form">`
    + remoteManagedWorkspaceFieldHtml("中央服务器地址", "centralUrl", config.centralUrl, { placeholder: "https://home-ai.example" })
    + `<div class="remote-managed-workspace-actions">`
    + `<button type="button" data-rmw-action="save-central" ${busy ? "disabled" : ""}>${busy ? "保存中" : "保存"}</button>`
    + `<button type="button" data-rmw-action="register" ${busy || !config.enabled ? "disabled" : ""}>Register</button>`
    + `</div>`
    + `</div>`
    + `<div class="remote-managed-workspace-workspaces">`
    + `<div class="remote-managed-workspace-list-title"><strong>Workspaces</strong><span>${escapeHtml(String((state.workspaces || []).length || 0))}</span></div>`
    + remoteManagedWorkspaceRowsHtml(config, busy)
    + `</div>`
    + remoteManagedWorkspaceAdvancedHtml(config);
}

function remoteManagedWorkspaceFormPayload() {
  const el = $("remoteManagedWorkspaceSettings");
  if (!el) return {};
  const payload = {
    enabled: Boolean(state.remoteManagedWorkspace && state.remoteManagedWorkspace.enabled),
  };
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

async function loadRemoteManagedWorkspaceSettings() {
  const result = await api("/api/settings/remote-managed-workspace", { timeoutMs: 12000 });
  try {
    const workspaceResult = await api("/api/workspaces", { timeoutMs: 12000 });
    if (workspaceResult && Array.isArray(workspaceResult.data)) state.workspaces = workspaceResult.data;
  } catch (_) {}
  rememberRemoteManagedWorkspaceConfig(remoteManagedWorkspaceConfigFromResult(result));
  return result;
}

async function handleRemoteManagedWorkspaceSettingsClick(event) {
  const button = event.target.closest("[data-rmw-action]");
  if (!button || button.disabled || state.remoteManagedWorkspaceBusy) return;
  const action = button.getAttribute("data-rmw-action") || "";
  const endpoint = action === "save" || action === "save-central"
    ? "/api/settings/remote-managed-workspace"
    : action === "enable-workspace" || action === "disable-workspace"
      ? "/api/settings/remote-managed-workspace/workspace"
    : action === "test-connection"
      ? "/api/settings/remote-managed-workspace/test-connection"
      : action === "register"
        ? "/api/settings/remote-managed-workspace/register"
        : action === "poll-once"
          ? "/api/settings/remote-managed-workspace/poll-once"
          : "";
  if (!endpoint) return;
  state.remoteManagedWorkspaceBusy = true;
  renderRemoteManagedWorkspaceSettings();
  try {
    const workspaceCwd = button.getAttribute("data-rmw-workspace-cwd") || "";
    const workspace = workspaceCwd
      ? (state.workspaces || []).find((item) => remoteManagedWorkspacePathKey(item && item.cwd) === remoteManagedWorkspacePathKey(workspaceCwd)) || { cwd: workspaceCwd }
      : null;
    let body = "{}";
    if (action === "save" || action === "save-central") {
      body = JSON.stringify(remoteManagedWorkspaceFormPayload());
    } else if (action === "enable-workspace" || action === "disable-workspace") {
      const payload = remoteManagedWorkspaceFormPayload();
      body = JSON.stringify({
        action: action === "disable-workspace" ? "disable" : "enable",
        centralUrl: payload.centralUrl,
        enrollmentToken: payload.enrollmentToken,
        workspace,
      });
    }
    const result = await api(endpoint, {
      method: "POST",
      body,
      timeoutMs: 20000,
    });
    rememberRemoteManagedWorkspaceConfig(remoteManagedWorkspaceConfigFromResult(result));
    $("connectionState").textContent = "Remote Managed Workspace 已更新";
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
  const confirmed = await requestCodexProfileSwitchConfirmation(profileId, label);
  if (!confirmed) return;
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
function showReconnectRefreshPrompt(...args) {
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
function scheduleVisiblePageRefreshCheck(...args) {
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
      renderQuotaUsage: typeof renderQuotaUsage === "function" ? renderQuotaUsage : null,
      renderCodexProfileSettings: typeof renderCodexProfileSettings === "function" ? renderCodexProfileSettings : null,
      renderWorkspaceDelegationSettings: typeof renderWorkspaceDelegationSettings === "function" ? renderWorkspaceDelegationSettings : null,
      renderRemoteManagedWorkspaceSettings: typeof renderRemoteManagedWorkspaceSettings === "function" ? renderRemoteManagedWorkspaceSettings : null,
      rememberRateLimitsFromConfig: typeof rememberRateLimitsFromConfig === "function" ? rememberRateLimitsFromConfig : null,
      rememberCodexProfiles: typeof rememberCodexProfiles === "function" ? rememberCodexProfiles : null,
  };
}

const root = typeof globalThis !== "undefined" ? globalThis : window;
const settingsRuntimeApi = Object.freeze({ createSettingsRuntime });
  Object.assign(root, {
    sleep,
    loadJsonStorage,
    loadStringSetStorage,
    loadNumberMapStorage,
    saveNumberMapStorage,
    saveStringSetStorage,
    normalizeRestartAutoRecoverThread,
    loadRestartAutoRecoverThreads,
    saveRestartAutoRecoverThreads,
    clearRestartAutoRecoverThreads,
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
    isMenuOverlayMode,
    viewportState,
    viewportHeight,
    setStableRootPixelVar,
    isKeyboardEditableElement,
    isHermesKeyboardInputActive,
    resetMobileKeyboardWindowScroll,
    updateViewportVars,
    createSubmissionId,
    pruneRecentSubmittedUserMessages,
    registerSubmittedUserMessage,
    localSubmittedTurnId,
    currentThreadHasClientSubmission,
    threadHasClientSubmission,
    mutableThreadForLocalSubmission,
    syncLocalSubmissionThread,
    insertLocalSubmittedUserMessage,
    mergeSubmittedUserItemIntoTurn,
    markRecentSubmittedUserMessageAccepted,
    durableUserMessageMatchesSubmittedRecord,
    threadHasDurableSubmittedUserRecord,
    optimisticUserMessageMatchesSubmittedRecord,
    removeOptimisticSubmittedUserRecordEchoes,
    settleRecentSubmittedUserMessagesForThread,
    reconcileSubmittedUserMessageTurn,
    markSubmittedUserMessageFailed,
    recentSubmittedUserRecordBelongsToThread,
    isRecentlySubmittedUserMessage,
    base64UrlToUint8Array,
    pushSubscriptionToJson,
    pushBrowserAvailable,
    escapeHtml,
    escapeSelectorAttr,
    resetCopyTextStore,
    rememberCopyText,
    copyButtonHtml,
    fallbackCopyText,
    copyTextToClipboard,
    showCopyFeedback,
    handleCopyButtonClick,
    truncateMiddle,
    compactLiveText,
    appendCommandOutput,
    shortPath,
    formatAbsoluteTime,
    formatTime,
    sameLocalDate,
    formatCardTimestamp,
    formatElapsedTime,
    statusText,
    isStaleActiveStatus,
    saveThreadStatusHints,
    isRecoverableThreadDisplayTitle,
    preferredThreadDisplayTitle,
    threadDisplayName,
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
    noteSubmittedProcessingThreadHint,
    clearSubmittedProcessingThreadHint,
    clearRunningThreadHint,
    threadUpdatedAtMs,
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
    updateThreadStatusHints,
    isThreadListSettledStatus,
    isThreadListTerminalStatus,
    reconcileThreadStatusHints,
    statusIconInfo,
    statusIconHtml,
    rolloutSizeBytes,
    rolloutThresholdBytes,
    isRolloutOverThreshold,
    rolloutWarningDismissKey,
    isRolloutWarningDismissed,
    dismissRolloutWarning,
    rolloutSizeText,
    tokenCountValue,
    formatTokenMillion,
    tokenUsageForThread,
    normalizeThreadGoalStatus,
    normalizeThreadGoal,
    submittedThreadGoal,
    threadGoalForThread,
    threadGoalStatusLabel,
    threadGoalStatusClass,
    threadGoalSignature,
    threadGoalBudgetText,
    renderThreadGoalBadge,
    renderThreadGoal,
    dialogPrefillThreadGoal,
    currentGoalDialogThread,
    goalDialogStatusText,
    updateThreadGoalDialogState,
    setThreadGoalDialogBusy,
    openThreadGoalDialog,
    closeThreadGoalDialog,
    normalizeOptionList,
    labelForModel,
    compactLabelForModel,
    labelForEffort,
    labelForPermissionMode,
    titleForPermissionMode,
    newThreadSelectedModel,
    newThreadSelectedEffort,
    newThreadSelectedPermissionMode,
    normalizePermissionModeValue,
    effectiveComposerPermissionMode,
    normalizeModelKey,
    isSparkModelKey,
    isRateLimitCompatibleWithModel,
    rateLimitModelKeys,
    rememberRateLimits,
    clearStoredRateLimits,
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
    selectedQuotaModel,
    rateLimitsForQuota,
    renderQuotaUsage,
    quotaDetailLineHtml,
    renderQuotaDetailPanel,
    quotaShortTextFromSnapshot,
    rememberCodexProfiles,
    codexProfileAccountLabel,
    codexProfileStatusLabel,
    renderCodexProfileSettings,
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
    showReconnectRefreshPrompt,
    finishRestartingUiIfReady,
    clearReconnectRefreshPrompt,
    checkPageRefreshAvailability,
    schedulePageRefreshCheck,
    scheduleVisiblePageRefreshCheck,
    startPageRefreshChecks,
    waitForPageBuildConfig,
    refreshPageForNewBuild,
    createSettingsRuntime,
  });
root.CodexSettingsRuntime = settingsRuntimeApi;

export { createSettingsRuntime };
export default settingsRuntimeApi;
