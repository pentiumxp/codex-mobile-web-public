"use strict";

const fs = require("node:fs");

const DEFAULT_PLUGIN_ID = "codex-mobile";
const DEFAULT_TIMEOUT_MS = 12000;
const ALLOWED_ITEM_TYPES = new Set(["todo", "delivery", "review", "approval", "mention", "error", "info"]);
const ALLOWED_PRIORITIES = new Set(["normal", "high", "urgent"]);
const ALLOWED_TOP_LEVEL_FIELDS = new Set([
  "workspaceId",
  "workspace_id",
  "eventId",
  "event_id",
  "sourceId",
  "source_id",
  "title",
  "summary",
  "itemType",
  "item_type",
  "priority",
  "route",
  "openMode",
  "open_mode",
  "notify",
  "detailMessage",
  "detail_message",
]);
const ALLOWED_ROUTE_FIELDS = new Set(["name", "tab", "itemId", "item_id", "threadId", "thread_id", "taskId", "task_id"]);
const ALLOWED_DETAIL_MESSAGE_FIELDS = new Set([
  "format",
  "sourceTurnId",
  "source_turn_id",
  "body",
  "truncated",
]);
const ALLOWED_DETAIL_FORMATS = new Set(["markdown", "text"]);
const UNSAFE_STRING_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]{12,}/i,
  /\bsk-[A-Za-z0-9_-]{16,}/i,
  /\bcpl_[A-Za-z0-9_-]{16,}/,
  /\bcps_[A-Za-z0-9_-]{16,}/,
  /\.codex-mobile-web[\\/]/i,
  /\.codex[\\/]/i,
  /\bstate_5\.sqlite\b/i,
  /\bpushSubscription\b/i,
  /\bendpoint=https?:\/\//i,
];

function stringValue(value) {
  return String(value || "").trim();
}

function errorWithStatus(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizeWorkspaceId(value) {
  return stringValue(value || "owner") || "owner";
}

function normalizePluginId(value) {
  const pluginId = stringValue(value || DEFAULT_PLUGIN_ID);
  if (!/^[a-z0-9][a-z0-9._-]{1,80}$/i.test(pluginId)) throw errorWithStatus("plugin_id_invalid");
  return pluginId;
}

function normalizeBaseUrl(value) {
  const text = stringValue(value);
  if (!text) return "";
  let parsed;
  try {
    parsed = new URL(text);
  } catch (_) {
    throw errorWithStatus("hermes_notification_base_url_invalid");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw errorWithStatus("hermes_notification_base_url_must_use_http_or_https");
  }
  if (parsed.username || parsed.password) {
    throw errorWithStatus("hermes_notification_base_url_must_not_include_credentials");
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch (_) {
    return "";
  }
}

function boundedString(value, fieldName, maxLength, required = true) {
  const text = stringValue(value);
  if (required && !text) throw errorWithStatus(`${fieldName}_required`);
  if (text.length > maxLength) throw errorWithStatus(`${fieldName}_too_long`);
  for (const pattern of UNSAFE_STRING_PATTERNS) {
    if (pattern.test(text)) throw errorWithStatus(`${fieldName}_contains_unsafe_value`);
  }
  return text;
}

function assertAllowedFields(value, allowed, scope) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw errorWithStatus(`${scope}_field_not_allowed:${key}`);
  }
}

function normalizeRoute(route) {
  if (route == null) return undefined;
  if (!route || typeof route !== "object" || Array.isArray(route)) throw errorWithStatus("route_must_be_object");
  assertAllowedFields(route, ALLOWED_ROUTE_FIELDS, "route");
  const name = boundedString(route.name, "route_name", 120);
  const out = { name };
  const tab = boundedString(route.tab, "route_tab", 120, false);
  const itemId = boundedString(route.itemId || route.item_id, "route_item_id", 180, false);
  const threadId = boundedString(route.threadId || route.thread_id, "route_thread_id", 180, false);
  const taskId = boundedString(route.taskId || route.task_id, "route_task_id", 180, false);
  if (tab) out.tab = tab;
  if (itemId) out.itemId = itemId;
  if (threadId) out.threadId = threadId;
  if (taskId) out.taskId = taskId;
  return out;
}

function normalizeDetailMessage(detailMessage) {
  if (detailMessage == null) return undefined;
  if (!detailMessage || typeof detailMessage !== "object" || Array.isArray(detailMessage)) {
    throw errorWithStatus("detail_message_must_be_object");
  }
  assertAllowedFields(detailMessage, ALLOWED_DETAIL_MESSAGE_FIELDS, "detail_message");
  const format = boundedString(detailMessage.format, "detail_message_format", 40);
  if (!ALLOWED_DETAIL_FORMATS.has(format)) throw errorWithStatus("detail_message_format_invalid");
  const body = boundedString(detailMessage.body, "detail_message_body", 12_000);
  const out = { format, body };
  const sourceTurnId = boundedString(detailMessage.sourceTurnId || detailMessage.source_turn_id, "detail_message_source_turn_id", 220, false);
  if (sourceTurnId) out.sourceTurnId = sourceTurnId;
  if (detailMessage.truncated === true) out.truncated = true;
  return out;
}

function normalizeNotificationPayload(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw errorWithStatus("notification_body_must_be_object");
  assertAllowedFields(input, ALLOWED_TOP_LEVEL_FIELDS, "notification");
  const workspaceId = normalizeWorkspaceId(input.workspaceId || input.workspace_id);
  const rawSourceId = input.sourceId || input.source_id;
  const eventId = boundedString(input.eventId || input.event_id || rawSourceId, "event_id", 220);
  const itemType = boundedString(input.itemType || input.item_type, "item_type", 40);
  if (!ALLOWED_ITEM_TYPES.has(itemType)) throw errorWithStatus("item_type_invalid");
  const priority = boundedString(input.priority, "priority", 20);
  if (!ALLOWED_PRIORITIES.has(priority)) throw errorWithStatus("priority_invalid");
  const out = {
    workspaceId,
    eventId,
    title: boundedString(input.title, "title", 160),
    summary: boundedString(input.summary, "summary", 500),
    itemType,
    priority,
  };
  const sourceId = boundedString(rawSourceId, "source_id", 220, false);
  if (sourceId && sourceId !== eventId) out.sourceId = sourceId;
  const route = normalizeRoute(input.route);
  if (route) out.route = route;
  const detailMessage = normalizeDetailMessage(input.detailMessage || input.detail_message);
  if (detailMessage) out.detailMessage = detailMessage;
  const openMode = boundedString(input.openMode || input.open_mode, "open_mode", 40, false);
  if (openMode) {
    if (openMode !== "plugin") throw errorWithStatus("open_mode_invalid");
    out.openMode = openMode;
  }
  if (input.notify === false) out.notify = false;
  return out;
}

function readSecretFile(file) {
  const path = stringValue(file);
  if (!path) return "";
  try {
    return fs.readFileSync(path, "utf8").trim();
  } catch (_) {
    return "";
  }
}

function safeInboxItem(value) {
  if (!value || typeof value !== "object") return null;
  const id = boundedString(value.id, "inbox_item_id", 180, false);
  const eventId = boundedString(value.eventId || value.event_id, "inbox_event_id", 220, false);
  const pluginId = boundedString(value.pluginId || value.plugin_id, "inbox_plugin_id", 100, false);
  const status = boundedString(value.status, "inbox_status", 80, false);
  const out = {};
  if (id) out.id = id;
  if (eventId) out.eventId = eventId;
  if (pluginId) out.pluginId = pluginId;
  if (status) out.status = status;
  if (value.route && typeof value.route === "object") out.route = normalizeRoute(value.route);
  return Object.keys(out).length ? out : null;
}

function safeHermesResponse(body, status) {
  const source = body && typeof body === "object" ? body : {};
  const inboxItem = safeInboxItem(source.inboxItem || source.inbox_item || source.item || source);
  const inboxItemId = stringValue(source.inboxItemId || source.inbox_item_id || source.id || (inboxItem && inboxItem.id));
  return Object.assign({
    ok: source.ok !== false,
    status,
  }, inboxItem ? { inboxItem } : {}, inboxItemId ? { inboxItemId } : {});
}

function parseJsonResponse(text) {
  if (!stringValue(text)) return {};
  try {
    return JSON.parse(text);
  } catch (_) {
    return {};
  }
}

function createHermesNotificationDelegateService(options = {}) {
  const pluginId = normalizePluginId(options.pluginId || DEFAULT_PLUGIN_ID);
  const explicitBaseUrl = stringValue(options.baseUrl);
  const webKey = stringValue(options.webKey || options.hermesWebKey);
  const webKeyFile = stringValue(options.webKeyFile || options.hermesWebKeyFile);
  const registrationForWorkspace = typeof options.registrationForWorkspace === "function"
    ? options.registrationForWorkspace
    : () => null;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || DEFAULT_TIMEOUT_MS));

  function notificationContract() {
    return {
      strategy: "hermes_action_inbox_delegate",
      backend_only: true,
      hermes_endpoint: `/api/hermes-plugins/${pluginId}/notifications`,
      auth_header: "X-Hermes-Web-Key",
      stable_event_id_required: true,
      default_click_target: "hermes_inbox_item",
      supports_open_mode_plugin: true,
      supports_notify_false: true,
      route_metadata_only: true,
      stores_summary_only: false,
      supports_detail_message: true,
      detail_message_formats: ["markdown", "text"],
      raw_sensitive_material_returned: false,
    };
  }

  function hermesWebKey() {
    return webKey || readSecretFile(webKeyFile);
  }

  function baseUrlForWorkspace(workspaceId = "owner") {
    if (explicitBaseUrl) return normalizeBaseUrl(explicitBaseUrl);
    const registration = registrationForWorkspace(normalizeWorkspaceId(workspaceId)) || {};
    return normalizeBaseUrl(originOf(registration.callbackUrl) || registration.appOrigin || "");
  }

  function endpointForWorkspace(workspaceId = "owner") {
    const baseUrl = baseUrlForWorkspace(workspaceId);
    return baseUrl ? `${baseUrl}/api/hermes-plugins/${encodeURIComponent(pluginId)}/notifications` : "";
  }

  function isConfiguredForWorkspace(workspaceId = "owner") {
    return Boolean(hermesWebKey() && endpointForWorkspace(workspaceId));
  }

  async function send(input = {}) {
    const payload = normalizeNotificationPayload(input);
    const key = hermesWebKey();
    if (!key) throw errorWithStatus("hermes_notification_key_not_configured", 503);
    const endpoint = endpointForWorkspace(payload.workspaceId);
    if (!endpoint) throw errorWithStatus("hermes_notification_endpoint_not_configured", 503);
    if (typeof fetchImpl !== "function") throw errorWithStatus("fetch_unavailable_for_hermes_notifications", 503);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hermes-Web-Key": key,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      if (err && err.name === "AbortError") throw errorWithStatus("hermes_notification_request_timeout", 504);
      throw errorWithStatus("hermes_notification_request_failed", 502);
    } finally {
      clearTimeout(timer);
    }

    const text = typeof response.text === "function" ? await response.text() : "";
    const body = parseJsonResponse(text);
    if (!response.ok) {
      const err = errorWithStatus(
        response.status === 401 || response.status === 403
          ? "hermes_notification_unauthorized"
          : "hermes_notification_rejected",
        response.status || 502,
      );
      throw err;
    }
    return safeHermesResponse(body, response.status || 200);
  }

  return {
    baseUrlForWorkspace,
    endpointForWorkspace,
    hermesWebKey,
    isConfiguredForWorkspace,
    notificationContract,
    normalizeNotificationPayload,
    send,
  };
}

module.exports = {
  createHermesNotificationDelegateService,
  normalizeNotificationPayload,
};
