"use strict";

const root = typeof globalThis !== "undefined" ? globalThis : {};

  const PLUGIN_ID = "codex-mobile";
  const VERSION = 1;
  const MAX_TEXT_CHARS = 12000;
  const TYPES = Object.freeze({
    CAPABILITY_QUERY: "voice_input.capability_query",
    CAPABILITY_STATE: "voice_input.capability_state",
    INSERT_TEXT: "voice_input.insert_text",
    APPEND_TEXT: "voice_input.append_text",
    REPLACE_DRAFT: "voice_input.replace_draft",
    PROVISIONAL_TEXT: "voice_input.provisional_text",
    SUBMIT: "voice_input.submit",
    START_REQUEST: "voice_input.start_request",
    STOP_REQUEST: "voice_input.stop_request",
    CANCEL_REQUEST: "voice_input.cancel_request",
    INSERT_RESULT: "voice_input.insert_result",
    COMMIT_RESULT: "voice_input.commit_result",
    ERROR: "voice_input.error",
  });
  const ACTION_TYPES = Object.freeze({
    insert_text: TYPES.INSERT_TEXT,
    append_text: TYPES.APPEND_TEXT,
    replace_draft: TYPES.REPLACE_DRAFT,
    provisional_text: TYPES.PROVISIONAL_TEXT,
    submit: TYPES.SUBMIT,
  });
  const ACTIONS_BY_TYPE = Object.freeze(Object.fromEntries(
    Object.entries(ACTION_TYPES).map(([action, type]) => [type, action]),
  ));

  function stringValue(value) {
    return String(value || "").trim();
  }

  function boundedString(value, maxLength) {
    const text = stringValue(value);
    const limit = Math.max(0, Number(maxLength) || 0);
    return text ? text.slice(0, limit) : "";
  }

  function boundedText(value, maxLength = MAX_TEXT_CHARS) {
    const text = String(value || "").replace(/\u00a0/g, " ");
    const limit = Math.max(1, Number(maxLength) || MAX_TEXT_CHARS);
    return text.slice(0, limit);
  }

  function normalizeAction(action) {
    const value = stringValue(action).toLowerCase();
    if (value === "append") return "append_text";
    if (value === "insert") return "insert_text";
    if (value === "replace") return "replace_draft";
    if (value === "provisional") return "provisional_text";
    return ACTION_TYPES[value] ? value : "";
  }

  function normalizeActions(actions) {
    const source = Array.isArray(actions)
      ? actions
      : (actions && typeof actions === "object"
        ? Object.keys(actions).filter((key) => actions[key])
        : []);
    const normalized = source.map(normalizeAction).filter(Boolean);
    return [...new Set(normalized)];
  }

  function requestIdFrom(payload = {}) {
    return boundedString(payload.requestId || payload.request_id, 160);
  }

  function voiceSessionIdFrom(payload = {}) {
    return boundedString(payload.voiceSessionId || payload.voice_session_id, 160);
  }

  function pluginIdFrom(payload = {}) {
    return boundedString(payload.pluginId || payload.plugin_id || PLUGIN_ID, 80) || PLUGIN_ID;
  }

  function baseMessage(type, input = {}) {
    const message = {
      type,
      version: VERSION,
      pluginId: pluginIdFrom(input),
    };
    const requestId = requestIdFrom(input);
    const voiceSessionId = voiceSessionIdFrom(input);
    if (requestId) message.requestId = requestId;
    if (voiceSessionId) message.voiceSessionId = voiceSessionId;
    return message;
  }

  function capabilityStateMessage(input = {}) {
    const actions = normalizeActions(input.actions).filter((action) => action !== "submit");
    const composerId = boundedString(input.composerId || input.composer_id || "thread-composer", 120) || "thread-composer";
    const threadId = boundedString(input.threadId || input.thread_id, 160);
    const draftId = boundedString(input.draftId || input.draft_id, 220);
    const maxChars = Math.max(1, Math.min(Number(input.maxChars || input.max_chars || MAX_TEXT_CHARS) || MAX_TEXT_CHARS, MAX_TEXT_CHARS));
    const message = Object.assign(baseMessage(TYPES.CAPABILITY_STATE, input), {
      writable: Boolean(input.writable || input.composerWritable),
      composerId,
      threadId,
      draftId,
      maxChars,
      actions: actions.length ? actions : ["append_text", "replace_draft"],
    });
    message.composer = {
      writable: message.writable,
      composerId,
      threadId,
      draftId,
      maxChars,
    };
    return message;
  }

  function startRequestMessage(input = {}) {
    const capability = capabilityStateMessage(input.capability || input);
    return Object.assign(baseMessage(TYPES.START_REQUEST, input), {
      composerId: capability.composerId,
      threadId: capability.threadId,
      draftId: capability.draftId,
      writable: capability.writable,
      maxChars: capability.maxChars,
      actions: capability.actions,
      capability,
    });
  }

  function stopRequestMessage(input = {}) {
    return Object.assign(baseMessage(TYPES.STOP_REQUEST, input), {
      composerId: boundedString(input.composerId || input.composer_id || "thread-composer", 120) || "thread-composer",
      threadId: boundedString(input.threadId || input.thread_id, 160),
    });
  }

  function cancelRequestMessage(input = {}) {
    return Object.assign(baseMessage(TYPES.CANCEL_REQUEST, input), {
      composerId: boundedString(input.composerId || input.composer_id || "thread-composer", 120) || "thread-composer",
      threadId: boundedString(input.threadId || input.thread_id, 160),
    });
  }

  function insertResultMessage(input = {}) {
    return Object.assign(baseMessage(TYPES.INSERT_RESULT, input), {
      ok: input.ok !== false,
      action: boundedString(input.action || input.insertAction || input.insert_action, 40),
      code: input.ok === false ? boundedString(input.code || input.errorCode || input.error_code, 80) : "",
      composerId: boundedString(input.composerId || input.composer_id || "thread-composer", 120) || "thread-composer",
      draftId: boundedString(input.draftId || input.draft_id, 220),
      error: input.ok === false ? boundedString(input.error || input.message, 240) : "",
    });
  }

  function commitResultMessage(input = {}) {
    return Object.assign(baseMessage(TYPES.COMMIT_RESULT, input), {
      ok: input.ok !== false,
      action: boundedString(input.action || "submitted", 40) || "submitted",
      composerId: boundedString(input.composerId || input.composer_id || "thread-composer", 120) || "thread-composer",
      threadId: boundedString(input.threadId || input.thread_id, 160),
      messageId: boundedString(input.messageId || input.message_id, 180),
      finalText: boundedText(input.finalText || input.final_text || input.text, input.maxChars || MAX_TEXT_CHARS).trim(),
    });
  }

  function errorMessage(input = {}) {
    return Object.assign(baseMessage(TYPES.ERROR, input), {
      code: boundedString(input.code || "plugin_voice_input_error", 80) || "plugin_voice_input_error",
      error: boundedString(input.error || input.message || "Plugin voice input error", 240),
      composerId: boundedString(input.composerId || input.composer_id || "thread-composer", 120) || "thread-composer",
    });
  }

  function isVoiceInputMessage(value) {
    return Boolean(value && typeof value === "object" && stringValue(value.type).startsWith("voice_input."));
  }

  function actionFromMessageType(type) {
    return ACTIONS_BY_TYPE[stringValue(type)] || "";
  }

  function textFromMessage(payload = {}, maxChars = MAX_TEXT_CHARS) {
    return boundedText(payload.text || payload.finalText || payload.final_text, maxChars).trim();
  }

  function postToParent(parentWindow, message, targetOrigin) {
    if (!parentWindow || parentWindow === root || !message) return false;
    parentWindow.postMessage(message, targetOrigin || "*");
    return true;
  }

const api = {
  ACTION_TYPES,
  MAX_TEXT_CHARS,
  PLUGIN_ID,
  TYPES,
  VERSION,
  actionFromMessageType,
  boundedString,
  boundedText,
  cancelRequestMessage,
  capabilityStateMessage,
  commitResultMessage,
  errorMessage,
  insertResultMessage,
  isVoiceInputMessage,
  normalizeAction,
  normalizeActions,
  pluginIdFrom,
  postToParent,
  requestIdFrom,
  startRequestMessage,
  stopRequestMessage,
  textFromMessage,
  voiceSessionIdFrom,
};

export {
  ACTION_TYPES,
  MAX_TEXT_CHARS,
  PLUGIN_ID,
  TYPES,
  VERSION,
  actionFromMessageType,
  boundedString,
  boundedText,
  cancelRequestMessage,
  capabilityStateMessage,
  commitResultMessage,
  errorMessage,
  insertResultMessage,
  isVoiceInputMessage,
  normalizeAction,
  normalizeActions,
  pluginIdFrom,
  postToParent,
  requestIdFrom,
  startRequestMessage,
  stopRequestMessage,
  textFromMessage,
  voiceSessionIdFrom,
};

export default api;
