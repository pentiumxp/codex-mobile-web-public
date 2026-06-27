"use strict";

const fs = require("node:fs");

const DEFAULT_TIMEOUT_MS = 12000;
const RETURN_STATUSES = new Set(["completed", "blocked", "redirected", "rejected", "partially_completed"]);
const UNSAFE_STRING_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]{12,}/i,
  /\bsk-[A-Za-z0-9_-]{16,}/i,
  /\bcpl_[A-Za-z0-9_-]{16,}/,
  /\bcps_[A-Za-z0-9_-]{16,}/,
  /\b(?:cookie|token|access[_-]?key|oauth|authorization)\s*[:=]/i,
  /\.codex-mobile-web[\\/]/i,
  /\.codex[\\/]/i,
  /\bstate_5\.sqlite\b/i,
  /\b(upload|screenshot|provider_payload|prompt|completion|body)\s*[:=]/i,
];

function stringValue(value) {
  return String(value || "").trim();
}

function errorWithStatus(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function boundedString(value, fieldName, maxLength, required = true) {
  const text = stringValue(value).replace(/\s+/g, " ").trim();
  if (required && !text) throw errorWithStatus(`${fieldName}_required`);
  if (text.length > maxLength) return text.slice(0, maxLength).trimEnd();
  return text;
}

function assertSafeString(value, fieldName) {
  const text = stringValue(value);
  for (const pattern of UNSAFE_STRING_PATTERNS) {
    if (pattern.test(text)) throw errorWithStatus(`${fieldName}_contains_unsafe_value`);
  }
}

function normalizeReturnStatus(value) {
  const status = stringValue(value).toLowerCase();
  if (!RETURN_STATUSES.has(status)) throw errorWithStatus("return_status_invalid");
  return status;
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

function normalizeBaseUrl(value) {
  const text = stringValue(value);
  if (!text) return "";
  let parsed;
  try {
    parsed = new URL(text);
  } catch (_) {
    throw errorWithStatus("home_ai_autonomous_delivery_base_url_invalid");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw errorWithStatus("home_ai_autonomous_delivery_base_url_must_use_http_or_https");
  }
  if (parsed.username || parsed.password) {
    throw errorWithStatus("home_ai_autonomous_delivery_base_url_must_not_include_credentials");
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

function safeMetadata(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const out = {
    sourceThreadId: boundedString(source.sourceThreadId, "metadata_source_thread_id", 180, false),
    targetThreadId: boundedString(source.targetThreadId, "metadata_target_thread_id", 180, false),
    workflowId: boundedString(source.workflowId, "metadata_workflow_id", 180, false),
    terminal: true,
    ackPolicy: "none",
  };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === "string") assertSafeString(value, `metadata_${key}`);
  }
  return out;
}

function normalizeAutonomousDeliveryReturnEvent(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw errorWithStatus("return_card_event_must_be_object");
  }
  const payload = {
    taskCardId: boundedString(input.taskCardId, "task_card_id", 180),
    returnCardId: boundedString(input.returnCardId, "return_card_id", 180),
    status: normalizeReturnStatus(input.status),
    title: boundedString(input.title, "title", 160),
    summary: boundedString(input.summary, "summary", 500, false),
    metadata: safeMetadata(input.metadata || {}),
  };
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string") assertSafeString(value, key);
  }
  return payload;
}

function safeResponse(body, status) {
  const source = body && typeof body === "object" ? body : {};
  return {
    ok: source.ok !== false,
    status,
    caseId: boundedString(source.caseId || source.case_id || "", "case_id", 120, false),
    sliceId: boundedString(source.sliceId || source.slice_id || "", "slice_id", 120, false),
    eventId: boundedString(source.eventId || source.event_id || source.id || "", "event_id", 160, false),
    deduped: source.deduped === true || source.duplicate === true,
  };
}

function parseJsonResponse(text) {
  if (!stringValue(text)) return {};
  try {
    return JSON.parse(text);
  } catch (_) {
    return {};
  }
}

function createHomeAiAutonomousDeliveryReturnService(options = {}) {
  const explicitBaseUrl = stringValue(options.baseUrl);
  const webKey = stringValue(options.webKey || options.hermesWebKey);
  const webKeyFile = stringValue(options.webKeyFile || options.hermesWebKeyFile);
  const registrationForWorkspace = typeof options.registrationForWorkspace === "function"
    ? options.registrationForWorkspace
    : () => null;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || DEFAULT_TIMEOUT_MS));

  function homeAiWebKey() {
    return webKey || readSecretFile(webKeyFile);
  }

  function baseUrlForWorkspace(workspaceId = "owner") {
    if (explicitBaseUrl) return normalizeBaseUrl(explicitBaseUrl);
    const registration = registrationForWorkspace(stringValue(workspaceId) || "owner") || {};
    return normalizeBaseUrl(originOf(registration.callbackUrl) || registration.appOrigin || "");
  }

  function endpointForWorkspace(workspaceId = "owner") {
    const baseUrl = baseUrlForWorkspace(workspaceId);
    return baseUrl ? `${baseUrl}/api/autonomous-delivery/return-card-events` : "";
  }

  function isConfiguredForWorkspace(workspaceId = "owner") {
    return Boolean(homeAiWebKey() && endpointForWorkspace(workspaceId));
  }

  async function send(input = {}, optionsForSend = {}) {
    const payload = normalizeAutonomousDeliveryReturnEvent(input);
    const key = homeAiWebKey();
    if (!key) throw errorWithStatus("home_ai_autonomous_delivery_key_not_configured", 503);
    const endpoint = endpointForWorkspace(optionsForSend.workspaceId || "owner");
    if (!endpoint) throw errorWithStatus("home_ai_autonomous_delivery_endpoint_not_configured", 503);
    if (typeof fetchImpl !== "function") throw errorWithStatus("fetch_unavailable_for_home_ai_autonomous_delivery", 503);

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
      if (err && err.name === "AbortError") throw errorWithStatus("home_ai_autonomous_delivery_request_timeout", 504);
      throw errorWithStatus("home_ai_autonomous_delivery_request_failed", 502);
    } finally {
      clearTimeout(timer);
    }

    const text = typeof response.text === "function" ? await response.text() : "";
    const body = parseJsonResponse(text);
    if (!response.ok) {
      const err = errorWithStatus(
        response.status === 404
          ? "home_ai_autonomous_delivery_task_card_unknown"
          : "home_ai_autonomous_delivery_rejected",
        response.status || 502,
      );
      err.responseStatus = response.status || 0;
      throw err;
    }
    return safeResponse(body, response.status || 200);
  }

  return {
    baseUrlForWorkspace,
    endpointForWorkspace,
    homeAiWebKey,
    isConfiguredForWorkspace,
    normalizeAutonomousDeliveryReturnEvent,
    send,
  };
}

module.exports = {
  createHomeAiAutonomousDeliveryReturnService,
  normalizeAutonomousDeliveryReturnEvent,
};
