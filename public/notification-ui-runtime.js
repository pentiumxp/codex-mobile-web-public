"use strict";

function isHermesEmbedMode() {
  return Boolean(state.pluginEmbed && state.pluginEmbed.embedded);
}

function currentPluginParentWindowOrigin() {
  try {
    if (!window.parent || window.parent === window || !window.parent.location) return "";
    const origin = String(window.parent.location.origin || "").trim();
    return origin && origin !== "null" ? origin : "";
  } catch (_) {
    return "";
  }
}

function normalizePluginParentOrigin(value) {
  const liveParentOrigin = currentPluginParentWindowOrigin();
  if (liveParentOrigin) return liveParentOrigin;
  const origin = String(value || "").trim();
  if (origin && origin !== "*") return origin;
  const referrerOrigin = pluginEmbedApi.parentOriginFromReferrer
    ? pluginEmbedApi.parentOriginFromReferrer(document.referrer)
    : "";
  return String(referrerOrigin || "").trim();
}

function pluginVoiceInputParentOriginAllowed(event) {
  if (!isHermesEmbedMode()) return false;
  if (event && event.source && event.source !== window.parent) return false;
  const origin = String(event && event.origin || "").trim();
  const expected = normalizePluginParentOrigin(state.pluginParentOrigin);
  if (expected && origin && origin !== expected) return false;
  if (!expected && origin && origin !== "null" && (!state.pluginParentOrigin || state.pluginParentOrigin === "*")) {
    state.pluginParentOrigin = origin;
  }
  return true;
}

function pluginVoiceInputSafeDraftId() {
  if (state.newThreadDraft) return "new-thread";
  return state.currentThreadId ? `thread:${String(state.currentThreadId).slice(0, 160)}` : "";
}

function pluginVoiceInputComposerId() {
  return state.newThreadDraft ? "new-thread-composer" : "thread-composer";
}

function pluginVoiceInputComposerWritable() {
  if (!isHermesEmbedMode()) return false;
  if (state.composerBusy || state.attachmentProcessingCount > 0) return false;
  const input = $("messageInput");
  if (!input || input.contentEditable === "false" || input.getAttribute("aria-disabled") === "true") return false;
  if (state.newThreadDraft) return Boolean(state.selectedCwd);
  return Boolean(
    state.currentThreadId
    && state.currentThread
    && !state.currentThread.mobileLoading
    && !state.currentThread.mobileLoadError
  );
}

function pluginVoiceInputActiveTurnHoldAvailable() {
  if (!isHermesEmbedMode()) return false;
  if (!state.activeTurnId || state.attachmentProcessingCount > 0) return false;
  return Boolean(state.currentThreadId && state.currentThread && !state.currentThread.mobileLoading && !state.currentThread.mobileLoadError);
}

function pluginVoiceInputCanReceiveText() {
  if (pluginVoiceInputComposerWritable()) return true;
  return pluginVoiceInputActiveTurnHoldAvailable();
}

function pluginVoiceInputEnsureComposerWritableForDraft() {
  if (!isHermesEmbedMode()) return false;
  const input = $("messageInput");
  if (!input) return false;
  if (input.contentEditable === "false" || input.getAttribute("aria-disabled") === "true") {
    setMessageInputDisabled(false);
  }
  if (input.contentEditable === "false" || input.getAttribute("aria-disabled") === "true") return false;
  focusMessageInput({ moveCaretToEnd: true, retry: true });
  return true;
}

function persistPluginVoiceInputDraft(draftKey = currentPluginVoiceInputDraftKey()) {
  const key = String(draftKey || "");
  if (!key) return false;
  writeCurrentDraftToKey(key);
  return true;
}

function pluginVoiceInputCapabilityPayload(extra = {}) {
  return Object.assign({
    pluginId: "codex-mobile",
    writable: pluginVoiceInputCanReceiveText(),
    composerId: pluginVoiceInputComposerId(),
    threadId: String(state.currentThreadId || "").slice(0, 160),
    draftId: pluginVoiceInputSafeDraftId(),
    maxChars: Math.max(1, Number(pluginVoiceInputApi.MAX_TEXT_CHARS || 12000) || 12000),
    actions: ["append_text", "replace_draft", "insert_text", "provisional_text"],
  }, extra || {});
}

function pluginVoiceInputGestureAvailable() {
  if (!isHermesEmbedMode()) return false;
  if (pluginVoiceInputActiveTurnHoldAvailable()) return true;
  if (state.activeTurnId && !composerHasContent()) return false;
  return pluginVoiceInputComposerWritable();
}

function postPluginVoiceInputMessage(message) {
  if (!isHermesEmbedMode() || !message) return false;
  const targetOrigin = normalizePluginParentOrigin(state.pluginParentOrigin);
  if (targetOrigin) state.pluginParentOrigin = targetOrigin;
  return pluginVoiceInputApi.postToParent
    ? pluginVoiceInputApi.postToParent(window.parent, message, targetOrigin || "*")
    : false;
}

function publishPluginVoiceInputCapability(options = {}) {
  if (!isHermesEmbedMode()) return false;
  const payload = pluginVoiceInputCapabilityPayload({
    requestId: options.requestId || "",
  });
  const signature = JSON.stringify({
    writable: payload.writable,
    composerId: payload.composerId,
    threadId: payload.threadId,
    draftId: payload.draftId,
    maxChars: payload.maxChars,
    actions: payload.actions,
  });
  if (!options.force && !options.requestId && state.pluginVoiceInputCapabilitySignature === signature) return false;
  state.pluginVoiceInputCapabilitySignature = signature;
  return postPluginVoiceInputMessage(pluginVoiceInputApi.capabilityStateMessage(payload));
}

function currentPluginVoiceInputDraftKey() {
  return currentDraftKey() || "";
}

function rememberPluginVoiceInputSession(payload = {}, insertedText = "") {
  const voiceSessionId = pluginVoiceInputApi.voiceSessionIdFrom
    ? pluginVoiceInputApi.voiceSessionIdFrom(payload)
    : String(payload.voiceSessionId || payload.voice_session_id || "").trim();
  if (!voiceSessionId) return;
  const draftKey = currentPluginVoiceInputDraftKey();
  if (!draftKey) return;
  const sessions = state.pluginVoiceInputSessionsByDraftKey[draftKey] || [];
  const existing = sessions.find((entry) => entry.voiceSessionId === voiceSessionId);
  const next = {
    voiceSessionId,
    composerId: pluginVoiceInputComposerId(),
    threadId: String(state.currentThreadId || "").slice(0, 160),
    insertedText: String(insertedText || "").slice(0, Number(pluginVoiceInputApi.MAX_TEXT_CHARS || 12000) || 12000),
    insertedAtMs: Date.now(),
  };
  if (existing) Object.assign(existing, next);
  else sessions.push(next);
  state.pluginVoiceInputSessionsByDraftKey[draftKey] = sessions.slice(-8);
}

function takePluginVoiceInputSessionsForDraft(draftKey) {
  const key = String(draftKey || "");
  if (!key) return [];
  const sessions = Array.isArray(state.pluginVoiceInputSessionsByDraftKey[key])
    ? state.pluginVoiceInputSessionsByDraftKey[key].slice()
    : [];
  delete state.pluginVoiceInputSessionsByDraftKey[key];
  return sessions;
}

function commitPluginVoiceInputSessionsAfterSend(draftKey, finalText, options = {}) {
  if (!isHermesEmbedMode()) return;
  const sessions = takePluginVoiceInputSessionsForDraft(draftKey);
  const submittedText = String(finalText || "").trim();
  if (!sessions.length || !submittedText) return;
  for (const session of sessions) {
    postPluginVoiceInputMessage(pluginVoiceInputApi.commitResultMessage({
      voiceSessionId: session.voiceSessionId,
      composerId: options.composerId || session.composerId || pluginVoiceInputComposerId(),
      threadId: options.threadId || state.currentThreadId || session.threadId || "",
      messageId: options.messageId || "",
      finalText: submittedText,
      action: "submitted",
    }));
  }
}

function pluginVoiceInputAppendText(currentText, insertedText) {
  const current = String(currentText || "").trim();
  const next = String(insertedText || "").trim();
  if (!current) return next;
  if (!next) return current;
  return `${current}\n${next}`;
}

function pluginVoiceInputSessionIdFromPayload(payload = {}) {
  return pluginVoiceInputApi.voiceSessionIdFrom
    ? pluginVoiceInputApi.voiceSessionIdFrom(payload)
    : String(payload.voiceSessionId || payload.voice_session_id || "").trim();
}

function clearPluginVoiceInputProvisionalSession() {
  state.pluginVoiceInputProvisional = null;
}

function restorePluginVoiceInputProvisionalBase(payload = {}) {
  const session = state.pluginVoiceInputProvisional;
  const voiceSessionId = pluginVoiceInputSessionIdFromPayload(payload);
  if (!session || !voiceSessionId || session.voiceSessionId !== voiceSessionId) return false;
  if (session.draftKey && session.draftKey !== currentPluginVoiceInputDraftKey()) return false;
  if (composerText() !== session.currentText) {
    clearPluginVoiceInputProvisionalSession();
    return false;
  }
  setComposerText(session.baseText || "");
  clearPluginVoiceInputProvisionalSession();
  return true;
}

function applyPluginVoiceInputProvisionalText(payload = {}, text = "") {
  const voiceSessionId = pluginVoiceInputSessionIdFromPayload(payload);
  if (!voiceSessionId) return false;
  const draftKey = currentPluginVoiceInputDraftKey();
  if (!draftKey) return false;
  if (!pluginVoiceInputEnsureComposerWritableForDraft()) return false;
  const currentText = composerText();
  let session = state.pluginVoiceInputProvisional;
  if (
    !session
    || session.voiceSessionId !== voiceSessionId
    || session.draftKey !== draftKey
  ) {
    session = {
      voiceSessionId,
      draftKey,
      baseText: currentText,
      currentText,
    };
  } else if (currentText !== session.currentText) {
    clearPluginVoiceInputProvisionalSession();
    return false;
  }
  const nextText = pluginVoiceInputAppendText(session.baseText, text);
  setComposerText(nextText);
  persistPluginVoiceInputDraft(draftKey);
  updateComposerControls();
  focusMessageInput({ moveCaretToEnd: true, retry: true });
  state.pluginVoiceInputProvisional = Object.assign({}, session, {
    currentText: nextText,
    text: String(text || "").slice(0, Number(pluginVoiceInputApi.MAX_TEXT_CHARS || 12000) || 12000),
    updatedAtMs: Date.now(),
  });
  return true;
}

function rejectPluginVoiceInputInsert(payload, code, message) {
  const action = pluginVoiceInputApi.actionFromMessageType
    ? pluginVoiceInputApi.actionFromMessageType(payload.type)
    : "";
  postPluginVoiceInputMessage(pluginVoiceInputApi.insertResultMessage({
    requestId: pluginVoiceInputApi.requestIdFrom ? pluginVoiceInputApi.requestIdFrom(payload) : payload.requestId,
    voiceSessionId: pluginVoiceInputApi.voiceSessionIdFrom ? pluginVoiceInputApi.voiceSessionIdFrom(payload) : payload.voiceSessionId,
    composerId: payload.composerId || payload.composer_id || pluginVoiceInputComposerId(),
    draftId: pluginVoiceInputSafeDraftId(),
    action,
    ok: false,
    error: message || code || "composer_not_writable",
  }));
  postClientEvent("plugin_voice_input_insert_rejected", {
    code: String(code || "insert_rejected").slice(0, 80),
    writable: pluginVoiceInputCanReceiveText(),
    threadId: state.currentThreadId || "",
  });
}

function applyPluginVoiceInputTextMessage(payload = {}) {
  const action = pluginVoiceInputApi.actionFromMessageType
    ? pluginVoiceInputApi.actionFromMessageType(payload.type)
    : "";
  if (!action || action === "submit") {
    postPluginVoiceInputMessage(pluginVoiceInputApi.errorMessage({
      requestId: payload.requestId,
      voiceSessionId: payload.voiceSessionId,
      composerId: payload.composerId || pluginVoiceInputComposerId(),
      code: "unsupported_voice_input_action",
      error: "Unsupported voice input action.",
    }));
    return true;
  }
  const capability = pluginVoiceInputCapabilityPayload();
  if (!capability.writable) {
    rejectPluginVoiceInputInsert(payload, "composer_not_writable", "Composer is not writable.");
    return true;
  }
  if (!pluginVoiceInputEnsureComposerWritableForDraft()) {
    rejectPluginVoiceInputInsert(payload, "composer_dom_unavailable", "Composer is not available.");
    return true;
  }
  const text = pluginVoiceInputApi.textFromMessage
    ? pluginVoiceInputApi.textFromMessage(payload, capability.maxChars)
    : String(payload.text || "").trim().slice(0, capability.maxChars);
  if (!text) {
    rejectPluginVoiceInputInsert(payload, "empty_voice_input_text", "Voice input text is empty.");
    return true;
  }
  if (action === "provisional_text") {
    if (!applyPluginVoiceInputProvisionalText(payload, text)) {
      rejectPluginVoiceInputInsert(payload, "provisional_voice_input_rejected", "Voice input draft changed.");
      return true;
    }
    postPluginVoiceInputMessage(pluginVoiceInputApi.insertResultMessage({
      requestId: pluginVoiceInputApi.requestIdFrom ? pluginVoiceInputApi.requestIdFrom(payload) : payload.requestId,
      voiceSessionId: pluginVoiceInputSessionIdFromPayload(payload),
      composerId: capability.composerId,
      draftId: capability.draftId,
      action,
      ok: true,
    }));
    publishPluginVoiceInputCapability({ force: true });
    return true;
  }
  restorePluginVoiceInputProvisionalBase(payload);
  const nextText = action === "replace_draft"
    ? text
    : pluginVoiceInputAppendText(composerText(), text);
  setComposerText(nextText);
  persistPluginVoiceInputDraft();
  updateComposerControls();
  focusMessageInput({ moveCaretToEnd: true, retry: true });
  rememberPluginVoiceInputSession(payload, text);
  postPluginVoiceInputMessage(pluginVoiceInputApi.insertResultMessage({
    requestId: pluginVoiceInputApi.requestIdFrom ? pluginVoiceInputApi.requestIdFrom(payload) : payload.requestId,
    voiceSessionId: pluginVoiceInputApi.voiceSessionIdFrom ? pluginVoiceInputApi.voiceSessionIdFrom(payload) : payload.voiceSessionId,
    composerId: capability.composerId,
    draftId: capability.draftId,
    action,
    ok: true,
  }));
  publishPluginVoiceInputCapability({ force: true });
  return true;
}

function handlePluginVoiceInputMessage(event) {
  const payload = event && event.data;
  if (!pluginVoiceInputApi.isVoiceInputMessage || !pluginVoiceInputApi.isVoiceInputMessage(payload)) return false;
  if (!pluginVoiceInputParentOriginAllowed(event)) return true;
  if (payload.pluginId && String(payload.pluginId) !== "codex-mobile") return true;
  if (payload.version && Number(payload.version) !== 1) return true;
  if (payload.type === pluginVoiceInputApi.TYPES.CAPABILITY_QUERY || payload.type === "voice_input.capability_query") {
    publishPluginVoiceInputCapability({
      force: true,
      requestId: pluginVoiceInputApi.requestIdFrom ? pluginVoiceInputApi.requestIdFrom(payload) : payload.requestId,
    });
    return true;
  }
  if (
    payload.type === pluginVoiceInputApi.TYPES.APPEND_TEXT
    || payload.type === pluginVoiceInputApi.TYPES.INSERT_TEXT
    || payload.type === pluginVoiceInputApi.TYPES.REPLACE_DRAFT
    || payload.type === pluginVoiceInputApi.TYPES.PROVISIONAL_TEXT
    || payload.type === pluginVoiceInputApi.TYPES.SUBMIT
  ) {
    return applyPluginVoiceInputTextMessage(payload);
  }
  return false;
}

function clearPluginVoiceInputPress(options = {}) {
  const press = state.pluginVoiceInputPress;
  if (press && press.timer) clearTimeout(press.timer);
  const button = $("sendMessage");
  if (button) button.classList.remove("plugin-voice-input-recording");
  state.pluginVoiceInputPress = options.keepSuppress && press
    ? Object.assign({}, press, { timer: 0, started: false })
    : null;
}

function handlePluginVoiceInputSendPointerDown(event) {
  if (!pluginVoiceInputGestureAvailable()) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  const button = event.currentTarget;
  clearPluginVoiceInputPress();
  const press = {
    pointerId: event.pointerId,
    started: false,
    suppressClick: false,
    timer: 0,
  };
  state.pluginVoiceInputPress = press;
  try {
    button.setPointerCapture?.(event.pointerId);
  } catch (_) {}
  press.timer = setTimeout(() => {
    press.timer = 0;
    press.started = true;
    press.suppressClick = true;
    clearTextSelection();
    if (button) button.classList.add("plugin-voice-input-recording");
    const capability = pluginVoiceInputCapabilityPayload({ writable: true });
    const ok = postPluginVoiceInputMessage(pluginVoiceInputApi.startRequestMessage(capability));
    if (!ok) {
      postClientEvent("plugin_voice_input_start_failed", { reason: "post_to_parent_failed" });
    }
  }, PLUGIN_VOICE_INPUT_LONG_PRESS_MS);
}

function handlePluginVoiceInputSendPointerUp(event) {
  const press = state.pluginVoiceInputPress;
  if (!press) return;
  if (press.pointerId && event.pointerId !== press.pointerId) return;
  if (press.timer) {
    clearPluginVoiceInputPress();
    return;
  }
  try {
    event.currentTarget?.releasePointerCapture?.(event.pointerId);
  } catch (_) {}
  if (!press.started) {
    clearPluginVoiceInputPress();
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  postPluginVoiceInputMessage(pluginVoiceInputApi.stopRequestMessage(pluginVoiceInputCapabilityPayload()));
  clearPluginVoiceInputPress({ keepSuppress: true });
  window.setTimeout(() => {
    if (state.pluginVoiceInputPress && state.pluginVoiceInputPress.suppressClick) state.pluginVoiceInputPress = null;
  }, 1200);
}

function handlePluginVoiceInputSendPointerCancel(event) {
  const press = state.pluginVoiceInputPress;
  if (!press) return;
  if (press.started) {
    postPluginVoiceInputMessage(pluginVoiceInputApi.cancelRequestMessage(pluginVoiceInputCapabilityPayload()));
  }
  if (event && typeof event.preventDefault === "function") event.preventDefault();
  clearPluginVoiceInputPress();
}

function handlePluginVoiceInputSendClick(event) {
  const press = state.pluginVoiceInputPress;
  if (!press || !press.suppressClick) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  state.pluginVoiceInputPress = null;
}

function setComposerActionButtonLabel(button, label, options = {}) {
  if (!button) return;
  const text = String(label || "");
  const useProxy = Boolean(options.proxy);
  button.classList.toggle("plugin-voice-input-label-proxy", useProxy);
  if (useProxy) {
    button.textContent = "";
    button.dataset.visualLabel = text;
    button.setAttribute("aria-label", text);
  } else {
    button.textContent = text;
    delete button.dataset.visualLabel;
  }
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
    appearance: currentPluginAppearanceForHost(),
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
    appearance: currentPluginAppearanceForHost(),
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

function boundedViewportNumber(value, max = 4096) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(Math.round(numeric), Math.max(0, Number(max) || 0)));
}

function normalizeHermesPluginViewportRect(rect) {
  if (!rect || typeof rect !== "object") return null;
  return {
    top: boundedViewportNumber(rect.top),
    right: boundedViewportNumber(rect.right),
    bottom: boundedViewportNumber(rect.bottom),
    left: boundedViewportNumber(rect.left),
    width: boundedViewportNumber(rect.width),
    height: boundedViewportNumber(rect.height),
  };
}

function normalizeHermesPluginViewportMessage(data) {
  if (!data || data.type !== "hermes.plugin.viewport" || data.version !== 1) return null;
  const pluginId = String(data.pluginId || "").trim();
  if (pluginId && pluginId !== "codex-mobile") return null;
  const viewport = data.viewport && typeof data.viewport === "object" ? data.viewport : {};
  const keyboard = data.keyboard && typeof data.keyboard === "object" ? data.keyboard : {};
  const host = data.host && typeof data.host === "object" ? data.host : {};
  const footer = data.footer && typeof data.footer === "object" ? data.footer : {};
  const topSafeArea = viewport.safeAreaTop || viewport.hostTopSafeArea
    || host.safeAreaTop || host.topSafeArea || host.hostTopSafeArea
    || footer.safeAreaTop || footer.topSafeArea || footer.hostTopSafeArea;
  const footerSafeArea = footer.safeAreaBottom || footer.bottomSafeArea || footer.hostBottomSafeArea || footer.safeAreaInsetBottom;
  return {
    receivedAtMs: Date.now(),
    reason: String(data.reason || "").trim().slice(0, 60),
    hostTopSafeArea: boundedViewportNumber(topSafeArea, 512),
    viewport: {
      width: boundedViewportNumber(viewport.width),
      height: boundedViewportNumber(viewport.height),
      offsetTop: boundedViewportNumber(viewport.offsetTop),
      offsetLeft: boundedViewportNumber(viewport.offsetLeft),
      layoutWidth: boundedViewportNumber(viewport.layoutWidth),
      layoutHeight: boundedViewportNumber(viewport.layoutHeight),
    },
    keyboard: {
      visible: Boolean(keyboard.visible),
      bottomInset: boundedViewportNumber(keyboard.bottomInset || keyboard.height, 1024),
      offsetTop: boundedViewportNumber(keyboard.offsetTop),
      height: boundedViewportNumber(keyboard.height || keyboard.bottomInset, 1024),
    },
    footer: {
      safeAreaBottom: boundedViewportNumber(footerSafeArea, 512),
    },
    iframe: normalizeHermesPluginViewportRect(data.iframe),
    host: normalizeHermesPluginViewportRect(data.host),
  };
}

function handleHermesPluginViewportMessage(data) {
  const normalized = normalizeHermesPluginViewportMessage(data);
  if (!normalized) return false;
  state.pluginHostViewport = normalized;
  syncThreadDetailLayoutState();
  updateViewportVars();
  updateComposerHeightVar();
  requestAnimationFrame(ensureSideChatDraftVisible);
  if (!isHermesKeyboardInputActive()) {
    scheduleVisualRecovery("hermes-plugin-viewport", 40, { render: false, heavy: false, delays: [40, 180] });
  }
  return true;
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
    const scrubbed = pluginEmbedApi.scrubRouteHintPath(window.location.href, {
      workspaceId: state.pluginEmbed.workspaceId,
      appearance: currentPluginAppearanceForHost(),
    });
    if (scrubbed) window.history.replaceState({}, "", scrubbed);
  } catch (_) {
    // URL scrubbing is best-effort; auth state is already held in memory.
  }
}

function pluginRootPath() {
  if (!isHermesEmbedMode()) return window.location.pathname || "/";
  return pluginEmbedApi.scrubRouteHintPath("/", {
    workspaceId: state.pluginEmbed && state.pluginEmbed.workspaceId,
  }) || "/?embed=hermes";
}

function showPluginEmbedAuthError(message = "") {
  hidePluginStartupLoading();
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
  hidePluginStartupLoading();
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
  state.renderedConversationPatchShellSignature = "";
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

function turnDisplaySortPhase(turn) {
  if (isRunningStatus(turn && turn.status) && !isTurnComplete(turn)) return 2;
  if (isTurnComplete(turn)) return 1;
  return 0;
}

function turnDisplaySortTimestampMs(value) {
  if (value === null || value === undefined || value === "") return 0;
  const numberValue = Number(value);
  if (Number.isFinite(numberValue) && numberValue > 0) {
    return numberValue > 1_000_000_000_000 ? Math.trunc(numberValue) : Math.trunc(numberValue * 1000);
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function turnDisplayItemTimestampMs(item) {
  if (!item || typeof item !== "object") return 0;
  const fields = [
    "createdAtMs",
    "createdAt",
    "created_at_ms",
    "created_at",
    "startedAtMs",
    "startedAt",
    "started_at_ms",
    "started_at",
    "updatedAtMs",
    "updatedAt",
    "updated_at_ms",
    "updated_at",
    "timestampMs",
    "timestamp",
    "mobileDisplayTimestampMs",
    "mobileDisplayTimestamp",
    "completedAtMs",
    "completedAt",
    "completed_at_ms",
    "completed_at",
  ];
  for (const field of fields) {
    const timestamp = turnDisplaySortTimestampMs(item[field]);
    if (timestamp) return timestamp;
  }
  return 0;
}

function turnDisplayItemTimestampRange(turn) {
  const timestamps = (Array.isArray(turn && turn.items) ? turn.items : [])
    .map(turnDisplayItemTimestampMs)
    .filter((timestamp) => timestamp > 0);
  return {
    first: timestamps.length ? Math.min(...timestamps) : 0,
    last: timestamps.length ? Math.max(...timestamps) : 0,
  };
}

function sortTurnsForDisplay(turns) {
  return (turns || []).slice().sort((leftTurn, rightTurn) => {
    const leftPhase = turnDisplaySortPhase(leftTurn);
    const rightPhase = turnDisplaySortPhase(rightTurn);
    if (leftPhase !== rightPhase) return leftPhase - rightPhase;
    const left = turnOrderMs(leftTurn);
    const right = turnOrderMs(rightTurn);
    if (left !== right) return left - right;
    const leftRange = turnDisplayItemTimestampRange(leftTurn);
    const rightRange = turnDisplayItemTimestampRange(rightTurn);
    if (leftRange.first !== rightRange.first) return leftRange.first - rightRange.first;
    if (leftRange.last !== rightRange.last) return leftRange.last - rightRange.last;
    return String(leftTurn && leftTurn.id || "").localeCompare(String(rightTurn && rightTurn.id || ""));
  });
}

function maxVisibleTurnsForThread(thread) {
  if (isRawThreadReadMode(thread) && !thread.mobileHistoryExpanded) return MAX_RAW_THREAD_VISIBLE_TURNS;
  return thread && thread.mobileHistoryExpanded ? MAX_EXPANDED_VISIBLE_TURNS : MAX_VISIBLE_TURNS;
}

function threadTurnsCursorSignature(cursor) {
  if (!cursor) return "";
  try {
    return JSON.stringify(cursor);
  } catch (_) {
    return String(cursor || "");
  }
}

function pluginStartupLoadingText(message = "") {
  const text = String(message || "").trim();
  return text || "正在加载 Codex...";
}

function showPluginStartupLoading(message = "") {
  if (!isHermesEmbedMode()) return;
  state.pluginStartupLoading = true;
  state.pluginStartupMessage = pluginStartupLoadingText(message);
  document.documentElement.classList.add("plugin-startup-loading");
  const loading = $("pluginStartupLoading");
  if (loading) {
    loading.classList.remove("hidden");
    const title = loading.querySelector("[data-plugin-startup-title]");
    if (title) title.textContent = state.pluginStartupMessage;
  }
}

function hidePluginStartupLoading() {
  if (!isHermesEmbedMode()) return;
  state.pluginStartupLoading = false;
  state.pluginStartupMessage = "";
  document.documentElement.classList.remove("plugin-startup-loading");
  const loading = $("pluginStartupLoading");
  if (loading) loading.classList.add("hidden");
}

function showApp() {
  updateViewportVars();
  if (isHermesEmbedMode()) {
    document.documentElement.classList.add("embed-hermes");
    if (state.pluginStartupLoading) showPluginStartupLoading();
  }
  $("login").classList.add("hidden");
  $("app").classList.remove("hidden");
  updateComposerHeightVar();
  ensureAndroidBackToSidebarSentinel();
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
  setAuthKey(key);
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
  setAuthKey(result.session_key);
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
  const bootstrapStartedAt = nowPerfMs();
  if (isHermesEmbedMode()) showPluginStartupLoading();
  const startupThreadId = applyUrlThreadSelection();
  const startupPluginRouteHint = applyUrlPluginRouteHint();
  const savedThreadId = isHermesEmbedMode() ? "" : (localStorage.getItem(STORAGE_THREAD_ID) || "");
  state.startupThreadOpenPending = Boolean(startupThreadId || savedThreadId || (startupPluginRouteHint && startupPluginRouteHint.threadId));
  const startupThreadOpenPending = state.startupThreadOpenPending;
  postStartupStage("bootstrap_start", bootstrapStartedAt, {
    hasStartupThreadId: Boolean(startupThreadId),
    hasSavedThreadId: Boolean(savedThreadId),
    hasPluginRouteThreadId: Boolean(startupPluginRouteHint && startupPluginRouteHint.threadId),
  });
  const earlyRestorePromise = savedThreadId && !startupThreadId
    ? loadThread(savedThreadId, { source: "restore-startup", suppressLoadFailureDiagnostic: true }).catch((err) => {
      localStorage.removeItem(STORAGE_THREAD_ID);
      showError(err);
      renderCurrentThread();
      return null;
    })
    : null;
  if (earlyRestorePromise) postStartupStage("restore_start", bootstrapStartedAt, { threadId: savedThreadId });
  const statusStartedAt = nowPerfMs();
  const status = await api("/api/status").catch((err) => {
    $("connectionState").textContent = err.message;
    $("connectionState").classList.add("error");
    return null;
  });
  postStartupStage("status_done", bootstrapStartedAt, {
    durationMs: roundedDurationMs(statusStartedAt),
    ok: Boolean(status),
  });
  if (status) updateConnectionState(status);
  if (status) rememberRateLimitsFromConfig(status);
  if (status && status.codexProfiles) rememberCodexProfiles(status.codexProfiles);
  const workspacesStartedAt = nowPerfMs();
  await loadWorkspaces();
  postStartupStage("workspaces_done", bootstrapStartedAt, {
    durationMs: roundedDurationMs(workspacesStartedAt),
    workspaceCount: Array.isArray(state.workspaces) ? state.workspaces.length : 0,
  });
  const threadDisplayStartedAt = nowPerfMs();
  await loadThreadDisplaySettings({ render: false }).catch(showError);
  postStartupStage("thread_display_done", bootstrapStartedAt, {
    durationMs: roundedDurationMs(threadDisplayStartedAt),
    mode: state.threadTileMode ? "tile" : "single",
    paneCount: normalizeThreadTilePaneCount(state.threadTilePaneCount, 0),
    paneSlotCount: normalizeThreadTilePinnedIds(state.threadTilePinnedIds).length,
  });
  const threadsStartedAt = nowPerfMs();
  await loadThreads({ silent: startupThreadOpenPending, deferFallback: true });
  postStartupStage("threads_done", bootstrapStartedAt, {
    durationMs: roundedDurationMs(threadsStartedAt),
    threadCount: Array.isArray(state.threads) ? state.threads.length : 0,
  });
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
    if (earlyRestorePromise) await earlyRestorePromise;
    else await restoreThreadSelection();
  } else {
    state.startupThreadOpenPending = false;
  }
  connectEvents();
  postStartupStage("bootstrap_done", bootstrapStartedAt, {
    hasCurrentThread: Boolean(state.currentThread),
  });
  scheduleStartupUpdateCheck();
  scheduleStartupPublicPrCheck();
  initializePushControls().catch((err) => {
    state.pushError = err.message || String(err);
    updatePushButton();
  });
  hidePluginStartupLoading();
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
  return pluginEmbedApi.normalizeRouteHint(value);
}

function pluginRouteHintFromUrl(value) {
  try {
    return pluginEmbedApi.routeHintFromUrl(value || window.location.href);
  } catch (_) {
    return null;
  }
}

function pluginRouteHintTargetId(hint) {
  return pluginEmbedApi.routeHintTargetId(hint);
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
  const conversation = $("conversation");
  if (!conversation) return null;
  return pluginEmbedApi.findRouteHintTargetNode(conversation, hint, { escapeSelector: escapeSelectorAttr });
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
  const node = findPluginRouteTargetNode(hint);
  const plan = pluginEmbedApi.routeHintFocusPlan(hint, {
    currentThreadId: state.currentThreadId,
    targetFound: Boolean(node),
  });
  if (!plan || plan.action === "ignore" || plan.action === "wait") return false;
  if (plan.action === "clear") {
    state.pendingPluginRouteHint = null;
    return false;
  }
  if (plan.action === "focused") {
    focusPluginRouteTargetNode(hint);
    state.pendingPluginRouteHint = null;
    if (plan.diagnostic) setPluginRouteDiagnostic(plan.diagnostic.message, { error: plan.diagnostic.error });
    recordHomeAiDiagnosticSuccess({
      category: "thread_session_load_failed",
      diagnostic_type: "route_hint_target_missing",
      error_code: "route_hint_target_missing",
      context: {
        surface: "thread-session",
        action: "route-hint-focus",
        route_kind: "plugin-route",
        thread_hash: diagnosticThreadHash(hint.threadId || hint.pluginThreadId || state.currentThreadId),
        task_hash: diagnosticTaskHash(hint.taskId || hint.pluginTaskId || ""),
        item_hash: diagnosticItemHash(hint.itemId || hint.pluginItemId || ""),
      },
    });
    return true;
  }
  state.pendingPluginRouteHint = null;
  showHermesPluginPrimaryPage({ force: true, source: "route-hint-target-missing" });
  if (plan.diagnostic) setPluginRouteDiagnostic(plan.diagnostic.message, { error: plan.diagnostic.error });
  recordHomeAiDiagnosticFailure({
    category: "thread_session_load_failed",
    diagnostic_type: "route_hint_target_missing",
    severity_hint: "H2",
    evidence_confidence: 0.78,
    error_code: "route_hint_target_missing",
    context: {
      surface: "thread-session",
      action: "route-hint-focus",
      route_kind: "plugin-route",
      thread_hash: diagnosticThreadHash(hint.threadId || hint.pluginThreadId || state.currentThreadId),
      task_hash: diagnosticTaskHash(hint.taskId || hint.pluginTaskId || ""),
      item_hash: diagnosticItemHash(hint.itemId || hint.pluginItemId || ""),
    },
    counts: {
      missing_count: 1,
    },
    breadcrumbs: [{
      kind: "thread-session",
      code: "route-hint-focus",
      status: "failed",
      fields: {
        route_kind: "plugin-route",
        thread_hash: diagnosticThreadHash(hint.threadId || hint.pluginThreadId || state.currentThreadId),
        task_hash: diagnosticTaskHash(hint.taskId || hint.pluginTaskId || ""),
        item_hash: diagnosticItemHash(hint.itemId || hint.pluginItemId || ""),
      },
    }],
  });
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
  await loadThread(id, {
    source: String(options.source || "external").slice(0, 40),
    suppressLoadFailureDiagnostic: options.suppressLoadFailureDiagnostic === true,
  });
}

async function openHermesPluginRouteHint(hint) {
  const plan = pluginEmbedApi.routeHintOpenPlan(hint);
  if (!plan || plan.action === "ignore") return false;
  state.queuedPluginRouteHint = null;
  clearThreadUrl();
  if (plan.action === "primary") {
    if (plan.diagnostic) setPluginRouteDiagnostic(plan.diagnostic.message, { error: plan.diagnostic.error });
    showHermesPluginPrimaryPage({ force: true, source: "route-hint-primary" });
    return true;
  }
  try {
    state.pendingPluginRouteHint = plan.pendingHint || null;
    await openExternalThreadSelection(plan.threadId, {
      statusMessage: plan.statusMessage,
      source: "route-hint",
      suppressLoadFailureDiagnostic: true,
    });
    if (!plan.targetId) {
      setPluginRouteDiagnostic("Opened notification thread", { error: false });
    } else {
      applyPendingPluginRouteHintFocus();
    }
    recordHomeAiDiagnosticSuccess({
      category: "thread_session_load_failed",
      diagnostic_type: "route_hint_thread_unavailable",
      error_code: "route_hint_thread_unavailable",
      context: {
        surface: "thread-session",
        action: "route-hint-open",
        route_kind: "plugin-route",
        thread_hash: diagnosticThreadHash(plan.threadId || hint.threadId || hint.pluginThreadId || ""),
      },
    });
    return true;
  } catch (error) {
    state.pendingPluginRouteHint = null;
    showHermesPluginPrimaryPage({ force: true, source: "route-hint-open-failed" });
    setPluginRouteDiagnostic(plan.targetId ? "Notification target is unavailable" : "Notification thread is unavailable", {
      error: true,
    });
    recordHomeAiDiagnosticFailure({
      category: "thread_session_load_failed",
      diagnostic_type: plan.targetId ? "route_hint_target_unavailable" : "route_hint_thread_unavailable",
      severity_hint: "H2",
      evidence_confidence: 0.78,
      error_code: diagnosticErrorCode(error, plan.targetId ? "route_hint_target_unavailable" : "route_hint_thread_unavailable"),
      context: {
        surface: "thread-session",
        action: "route-hint-open",
        route_kind: "plugin-route",
        thread_hash: diagnosticThreadHash(plan.threadId || hint.threadId || hint.pluginThreadId || ""),
        task_hash: diagnosticTaskHash(hint.taskId || hint.pluginTaskId || ""),
        item_hash: diagnosticItemHash(hint.itemId || hint.pluginItemId || ""),
      },
      counts: {
        status_code: diagnosticErrorStatus(error),
      },
      breadcrumbs: [{
        kind: "thread-session",
        code: "route-hint-open",
        status: "failed",
        fields: {
          status_code: diagnosticErrorStatus(error),
          route_kind: "plugin-route",
          thread_hash: diagnosticThreadHash(plan.threadId || hint.threadId || hint.pluginThreadId || ""),
        },
      }],
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


(function exposeCodexNotificationUiRuntime(root) {
  root.CodexNotificationUiRuntime = root.CodexNotificationUiRuntime || {
    createNotificationUiRuntime: function createNotificationUiRuntime() {
      return {
      handlePluginVoiceInputMessage: typeof handlePluginVoiceInputMessage === "function" ? handlePluginVoiceInputMessage : null,
      requestHermesPluginRefresh: typeof requestHermesPluginRefresh === "function" ? requestHermesPluginRefresh : null,
      showPluginEmbedRecovering: typeof showPluginEmbedRecovering === "function" ? showPluginEmbedRecovering : null,
      showLogin: typeof showLogin === "function" ? showLogin : null,
      showApp: typeof showApp === "function" ? showApp : null,
      bootstrap: typeof bootstrap === "function" ? bootstrap : null,
      };
    },
  };
})(window);
