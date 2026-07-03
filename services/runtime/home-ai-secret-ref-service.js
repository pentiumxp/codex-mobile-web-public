"use strict";

const fs = require("node:fs");

const DEFAULT_SECRET_REF_TTL_SECONDS = 10 * 60;
const MAX_SECRET_REF_TTL_SECONDS = 60 * 60;
const MAX_SECRET_REFS = 8;
const SECRET_REF_ID_PATTERN = /^sec_[A-Za-z0-9][A-Za-z0-9_-]{2,160}$/;
const RAW_SECRET_KEYS = new Set([
  "secret",
  "plaintext",
  "plainText",
  "value",
  "password",
  "passphrase",
  "token",
  "accessToken",
  "access_token",
  "accessKey",
  "access_key",
  "apiKey",
  "api_key",
  "cookie",
  "authorization",
]);

function stringValue(value) {
  return String(value || "").trim();
}

function errorWithStatus(message, statusCode = 400, details = {}) {
  const err = new Error(message);
  err.code = message;
  err.statusCode = statusCode;
  err.details = safeDetails(details);
  return err;
}

function boundedString(value, maxLength = 220) {
  const text = stringValue(value).replace(/\s+/g, " ").trim();
  return text.length <= maxLength ? text : text.slice(0, maxLength).trimEnd();
}

function safeDetails(details = {}) {
  const source = details && typeof details === "object" && !Array.isArray(details) ? details : {};
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "boolean" || typeof value === "number") {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value.slice(0, 12).map((entry) => boundedString(entry, 120)).filter(Boolean);
    } else if (typeof value === "object") {
      out[key] = safeDetails(value);
    } else {
      out[key] = boundedString(value, 180);
    }
  }
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

function normalizeBaseUrl(value, fieldName = "home_ai_secret_ref_base_url") {
  const text = stringValue(value);
  if (!text) return "";
  let parsed;
  try {
    parsed = new URL(text);
  } catch (_) {
    throw errorWithStatus(`${fieldName}_invalid`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw errorWithStatus(`${fieldName}_must_use_http_or_https`);
  }
  if (parsed.username || parsed.password) {
    throw errorWithStatus(`${fieldName}_must_not_include_credentials`);
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

function normalizeConsumePath(value) {
  const text = stringValue(value || "/api/secret-refs/consume");
  if (!text.startsWith("/") || /[\r\n]/.test(text)) {
    throw errorWithStatus("home_ai_secret_ref_consume_path_invalid");
  }
  return text.replace(/\/{2,}/g, "/");
}

function assertNoInlinePlaintextSecret(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    if (RAW_SECRET_KEYS.has(key) && stringValue(value[key])) {
      throw errorWithStatus("secret_ref_plaintext_disallowed", 400, { field: key });
    }
  }
}

function normalizeSecretRefId(value, fieldName = "secret_ref") {
  const id = stringValue(value);
  if (!id) throw errorWithStatus(`${fieldName}_required`);
  if (!SECRET_REF_ID_PATTERN.test(id)) {
    throw errorWithStatus(`${fieldName}_invalid`);
  }
  return id;
}

function displaySecretRefId(value) {
  const id = stringValue(value);
  if (!id) return "";
  if (!id.startsWith("sec_")) return "sec_...";
  const suffix = id.slice(4);
  if (suffix.length <= 8) return `sec_${suffix}`;
  return `sec_${suffix.slice(0, 4)}...${suffix.slice(-4)}`;
}

function normalizeTtlSeconds(value, fallback = DEFAULT_SECRET_REF_TTL_SECONDS) {
  const number = Math.trunc(Number(value));
  const seconds = Number.isFinite(number) && number > 0 ? number : fallback;
  return Math.max(60, Math.min(MAX_SECRET_REF_TTL_SECONDS, seconds));
}

function ttlSecondsFromCandidate(candidate = {}) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return DEFAULT_SECRET_REF_TTL_SECONDS;
  if (candidate.expiresInMinutes || candidate.expires_in_minutes) {
    return normalizeTtlSeconds(Number(candidate.expiresInMinutes || candidate.expires_in_minutes) * 60);
  }
  return normalizeTtlSeconds(
    candidate.ttlSeconds
      || candidate.ttl_seconds
      || candidate.expiresInSeconds
      || candidate.expires_in_seconds
      || candidate.ttl,
  );
}

function safeScope(input = {}, context = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const scope = source.scope && typeof source.scope === "object" && !Array.isArray(source.scope) ? source.scope : {};
  const merged = Object.assign({}, scope, context.scope || {}, context);
  return {
    sourceThreadId: boundedString(merged.sourceThreadId || merged.source_thread_id, 220),
    targetThreadId: boundedString(merged.targetThreadId || merged.target_thread_id || merged.threadId || merged.thread_id, 220),
    threadId: boundedString(merged.threadId || merged.thread_id || merged.targetThreadId || merged.target_thread_id, 220),
    sourceTurnId: boundedString(merged.sourceTurnId || merged.source_turn_id || merged.turnId || merged.turn_id, 220),
    taskCardId: boundedString(merged.taskCardId || merged.task_card_id, 180),
    taskId: boundedString(merged.taskId || merged.task_id, 180),
    workspaceId: boundedString(merged.workspaceId || merged.workspace_id, 260),
    workspaceCwd: boundedString(merged.workspaceCwd || merged.workspace_cwd || merged.cwd, 320),
  };
}

function normalizeTargetPlugin(value) {
  const text = stringValue(value || "codex").toLowerCase();
  if (!text || text === "codex") return "codex";
  throw errorWithStatus("secret_ref_target_plugin_invalid");
}

function normalizeSecretRefCandidate(candidate, context = {}) {
  if (typeof candidate === "string") {
    return {
      id: normalizeSecretRefId(candidate),
      targetPlugin: "codex",
      expiresInSeconds: DEFAULT_SECRET_REF_TTL_SECONDS,
      scope: safeScope({}, context),
      source: boundedString(context.source || "", 80),
    };
  }
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw errorWithStatus("secret_ref_invalid");
  }
  assertNoInlinePlaintextSecret(candidate);
  const id = normalizeSecretRefId(
    candidate.secretRef
      || candidate.secret_ref
      || candidate.id
      || candidate.ref,
  );
  return {
    id,
    targetPlugin: normalizeTargetPlugin(candidate.targetPlugin || candidate.target_plugin || context.targetPlugin),
    expiresInSeconds: ttlSecondsFromCandidate(candidate),
    scope: safeScope(candidate, context),
    source: boundedString(candidate.source || context.source || "", 80),
    purpose: boundedString(candidate.purpose || context.purpose || "", 120),
  };
}

function collectSecretRefCandidates(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const candidates = [];
  const pushValue = (value) => {
    if (value == null || value === "") return;
    if (Array.isArray(value)) {
      for (const entry of value) pushValue(entry);
      return;
    }
    candidates.push(value);
  };
  pushValue(source.secretRef || source.secret_ref);
  pushValue(source.secretRefs || source.secret_refs);
  const sensitiveContext = source.sensitiveContext || source.sensitive_context;
  if (sensitiveContext && typeof sensitiveContext === "object" && !Array.isArray(sensitiveContext)) {
    pushValue(sensitiveContext.secretRef || sensitiveContext.secret_ref);
    pushValue(sensitiveContext.secretRefs || sensitiveContext.secret_refs);
  }
  const attachmentFields = [
    source.attachments,
    source.attachmentMetadata,
    source.attachment_metadata,
    source.sensitiveAttachments,
    source.sensitive_attachments,
  ];
  for (const value of attachmentFields) {
    const entries = Array.isArray(value) ? value : [];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const kind = stringValue(entry.type || entry.kind || entry.attachmentType || entry.attachment_type).toLowerCase();
      if (kind === "secretref" || kind === "secret_ref" || entry.secretRef || entry.secret_ref) {
        pushValue(entry);
      }
    }
  }
  return candidates;
}

function normalizeSecretRefsFromInput(input = {}, context = {}) {
  const seen = new Set();
  const refs = [];
  for (const candidate of collectSecretRefCandidates(input)) {
    const ref = normalizeSecretRefCandidate(candidate, context);
    if (seen.has(ref.id)) continue;
    seen.add(ref.id);
    refs.push(ref);
    if (refs.length >= MAX_SECRET_REFS) break;
  }
  return refs.length ? { secretRefs: refs } : null;
}

function scopeSecretRefs(secretContext = null, context = {}) {
  const refs = Array.isArray(secretContext && secretContext.secretRefs) ? secretContext.secretRefs : [];
  if (!refs.length) return null;
  return {
    secretRefs: refs.map((ref) => Object.assign({}, ref, {
      scope: safeScope(ref, Object.assign({}, context, { scope: ref.scope || {} })),
    })),
  };
}

function publicSecretRef(ref = {}) {
  const expiresInSeconds = normalizeTtlSeconds(ref.expiresInSeconds, DEFAULT_SECRET_REF_TTL_SECONDS);
  const minutes = Math.max(1, Math.ceil(expiresInSeconds / 60));
  const scope = ref.scope && typeof ref.scope === "object" ? ref.scope : {};
  const out = {
    id: displaySecretRefId(ref.id),
    targetPlugin: "codex",
    expiresInSeconds,
    expiresInMinutes: minutes,
    source: boundedString(ref.source, 80),
    purpose: boundedString(ref.purpose, 120),
    scope: {
      threadId: boundedString(scope.threadId || scope.targetThreadId, 220),
      sourceThreadId: boundedString(scope.sourceThreadId, 220),
      taskCardId: boundedString(scope.taskCardId, 180),
      taskId: boundedString(scope.taskId, 180),
      workspaceId: boundedString(scope.workspaceId, 260),
    },
  };
  for (const key of Object.keys(out.scope)) {
    if (!out.scope[key]) delete out.scope[key];
  }
  if (!Object.keys(out.scope).length) delete out.scope;
  for (const key of Object.keys(out)) {
    if (!out[key]) delete out[key];
  }
  return out;
}

function publicSensitiveContext(secretContext = null) {
  const refs = Array.isArray(secretContext && secretContext.secretRefs) ? secretContext.secretRefs : [];
  if (!refs.length) return null;
  return {
    secretRefs: refs.map(publicSecretRef),
  };
}

function secretRefReceiptLine(ref = {}) {
  const publicRef = publicSecretRef(ref);
  const minutes = publicRef.expiresInMinutes || 10;
  return `已收到安全凭据 ${publicRef.id || "sec_..."}，${minutes} 分钟内可用于当前任务。`;
}

function secretRefReceiptText(secretContext = null) {
  const refs = Array.isArray(secretContext && secretContext.secretRefs) ? secretContext.secretRefs : [];
  if (!refs.length) return "";
  return refs.map(secretRefReceiptLine).join("\n");
}

function appendSecretRefReceiptText(text, secretContext = null) {
  const receipt = secretRefReceiptText(secretContext);
  if (!receipt) return String(text || "");
  const base = String(text || "").trim();
  return base ? `${base}\n\n${receipt}` : receipt;
}

function parseJsonResponse(text) {
  if (!stringValue(text)) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function secretValueFromResponse(body = {}) {
  const source = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const candidates = [
    source.secret,
    source.value,
    source.plaintext,
    source.plainText,
    source.credential,
    source.data && source.data.secret,
    source.data && source.data.value,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate) return candidate;
  }
  return "";
}

function secretRefErrorCode(status, body = {}) {
  const remote = stringValue(body.code || body.error || body.reason || body.message).toLowerCase();
  if (/expired/.test(remote) || status === 410) return "home_ai_secret_ref_expired";
  if (/used|consumed|spent/.test(remote) || status === 409) return "home_ai_secret_ref_used";
  if (/unauthor|forbidden|scope/.test(remote) || status === 401 || status === 403) return "home_ai_secret_ref_unauthorized";
  if (/not[_-]?found|unknown/.test(remote) || status === 404) return "home_ai_secret_ref_unknown";
  if (/invalid|malformed/.test(remote) || status === 400 || status === 422) return "home_ai_secret_ref_invalid";
  if (status === 429) return "home_ai_secret_ref_rate_limited";
  return "home_ai_secret_ref_rejected";
}

function publicSecretRefConsumeResult(result = {}) {
  const ref = result.secretRef || result.ref || {};
  return {
    ok: result.ok !== false,
    consumed: result.consumed === true,
    secretRef: publicSecretRef(ref),
    broker: {
      status: Math.max(0, Math.trunc(Number(result.broker && result.broker.status || 0)) || 0),
      eventId: boundedString(result.broker && result.broker.eventId, 160),
      caseId: boundedString(result.broker && result.broker.caseId, 120),
    },
  };
}

function createHomeAiSecretRefService(options = {}) {
  const explicitBaseUrl = stringValue(options.baseUrl);
  const webKey = stringValue(options.webKey || options.hermesWebKey);
  const webKeyFile = stringValue(options.webKeyFile || options.hermesWebKeyFile);
  const consumePath = normalizeConsumePath(options.consumePath || options.path);
  const registrationForWorkspace = typeof options.registrationForWorkspace === "function"
    ? options.registrationForWorkspace
    : () => null;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || 12000));

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
    return baseUrl ? `${baseUrl}${consumePath}` : "";
  }

  function isConfiguredForWorkspace(workspaceId = "owner") {
    return Boolean(homeAiWebKey() && endpointForWorkspace(workspaceId));
  }

  async function consumeSecretRef(input = {}, optionsForConsume = {}) {
    const ref = normalizeSecretRefCandidate(input.secretRef || input.secret_ref || input, {
      source: optionsForConsume.source || "consume",
      targetPlugin: "codex",
      purpose: optionsForConsume.purpose || input.purpose || "",
      scope: Object.assign({}, input.scope || {}, optionsForConsume.scope || {}),
    });
    const key = homeAiWebKey();
    if (!key) throw errorWithStatus("home_ai_secret_ref_key_not_configured", 503);
    const endpoint = endpointForWorkspace(optionsForConsume.workspaceId || "owner");
    if (!endpoint) throw errorWithStatus("home_ai_secret_ref_endpoint_not_configured", 503);
    if (typeof fetchImpl !== "function") throw errorWithStatus("fetch_unavailable_for_home_ai_secret_ref", 503);

    const payload = {
      secretRef: ref.id,
      targetPlugin: "codex",
      purpose: boundedString(optionsForConsume.purpose || ref.purpose || "", 120),
      action: boundedString(optionsForConsume.action || "", 120),
      scope: safeScope(ref, optionsForConsume.scope || {}),
    };

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
      if (err && err.name === "AbortError") throw errorWithStatus("home_ai_secret_ref_request_timeout", 504);
      throw errorWithStatus("home_ai_secret_ref_request_failed", 502);
    } finally {
      clearTimeout(timer);
    }

    const text = typeof response.text === "function" ? await response.text() : "";
    const body = parseJsonResponse(text);
    if (!response.ok || body.ok === false) {
      const code = secretRefErrorCode(response.status || 0, body);
      throw errorWithStatus(code, response.status || 502, {
        status: response.status || 0,
        secretRef: displaySecretRefId(ref.id),
      });
    }
    const value = secretValueFromResponse(body);
    if (!value) {
      throw errorWithStatus("home_ai_secret_ref_value_missing", 502, {
        status: response.status || 0,
        secretRef: displaySecretRefId(ref.id),
      });
    }
    return {
      ok: true,
      consumed: true,
      secretRef: ref,
      value,
      broker: {
        status: response.status || 200,
        eventId: boundedString(body.eventId || body.event_id || body.id, 160),
        caseId: boundedString(body.caseId || body.case_id, 120),
      },
    };
  }

  return {
    baseUrlForWorkspace,
    consumeSecretRef,
    endpointForWorkspace,
    homeAiWebKey,
    isConfiguredForWorkspace,
  };
}

module.exports = {
  appendSecretRefReceiptText,
  createHomeAiSecretRefService,
  displaySecretRefId,
  normalizeSecretRefId,
  normalizeSecretRefsFromInput,
  publicSecretRef,
  publicSecretRefConsumeResult,
  publicSensitiveContext,
  scopeSecretRefs,
  secretRefReceiptText,
};
