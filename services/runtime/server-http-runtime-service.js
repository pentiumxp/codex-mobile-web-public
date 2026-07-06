"use strict";

function valueFromGetter(getter, fallback) {
  if (typeof getter !== "function") return fallback;
  try {
    const value = getter();
    return value === undefined ? fallback : value;
  } catch (_) {
    return fallback;
  }
}

function createServerHttpRuntimeService(dependencies = {}) {
  const fs = dependencies.fs || require("node:fs");
  const path = dependencies.path || require("node:path");
  const crypto = dependencies.crypto || require("node:crypto");
  const env = dependencies.env || process.env;
  const getCodexHome = typeof dependencies.getCodexHome === "function" ? dependencies.getCodexHome : () => "";
  const authKeyFile = String(dependencies.authKeyFile || "");
  const disableAuth = Boolean(dependencies.disableAuth);
  const getAuthKey = typeof dependencies.getAuthKey === "function" ? dependencies.getAuthKey : () => "";
  const getHermesPluginService = typeof dependencies.getHermesPluginService === "function"
    ? dependencies.getHermesPluginService
    : () => null;
  const getMobileWebLogFile = typeof dependencies.getMobileWebLogFile === "function"
    ? dependencies.getMobileWebLogFile
    : () => dependencies.mobileWebLogFile || "";
  const getMobileWebLogMaxBytes = typeof dependencies.getMobileWebLogMaxBytes === "function"
    ? dependencies.getMobileWebLogMaxBytes
    : () => dependencies.mobileWebLogMaxBytes;
  const getMobileWebLogKeepBytes = typeof dependencies.getMobileWebLogKeepBytes === "function"
    ? dependencies.getMobileWebLogKeepBytes
    : () => dependencies.mobileWebLogKeepBytes;
  const getMobileWebLogEventMinIntervalMs = typeof dependencies.getMobileWebLogEventMinIntervalMs === "function"
    ? dependencies.getMobileWebLogEventMinIntervalMs
    : () => dependencies.mobileWebLogEventMinIntervalMs;
  const getMaxStructuredChars = typeof dependencies.getMaxStructuredChars === "function"
    ? dependencies.getMaxStructuredChars
    : () => dependencies.maxStructuredChars;
  const getMaxJsonBodyBytes = typeof dependencies.getMaxJsonBodyBytes === "function"
    ? dependencies.getMaxJsonBodyBytes
    : () => dependencies.maxJsonBodyBytes;
  const boundedProfilePreflightDetail = typeof dependencies.boundedProfilePreflightDetail === "function"
    ? dependencies.boundedProfilePreflightDetail
    : () => "";
  const nowMs = typeof dependencies.nowMs === "function" ? dependencies.nowMs : () => Date.now();

  let lastLogTrimAt = 0;
  const runtimeLogEventState = new Map();

  function readCodexConfigDefaults() {
    const configPath = path.join(String(getCodexHome() || ""), "config.toml");
    try {
      const text = fs.readFileSync(configPath, "utf8");
      const model = /^\s*model\s*=\s*"([^"]+)"/m.exec(text);
      const effort = /^\s*model_reasoning_effort\s*=\s*"([^"]+)"/m.exec(text);
      const summary = /^\s*model_reasoning_summary\s*=\s*"([^"]+)"/m.exec(text);
      const verbosity = /^\s*model_verbosity\s*=\s*"([^"]+)"/m.exec(text);
      const sandboxMode = /^\s*sandbox_mode\s*=\s*"([^"]+)"/m.exec(text);
      const approvalPolicy = /^\s*(approval_policy|approval_mode)\s*=\s*"([^"]+)"/m.exec(text);
      return {
        model: model ? model[1] : "",
        reasoningEffort: effort ? effort[1] : "",
        reasoningSummary: summary ? summary[1] : "",
        modelVerbosity: verbosity ? verbosity[1] : "",
        sandboxMode: sandboxMode ? sandboxMode[1] : "",
        approvalPolicy: approvalPolicy ? approvalPolicy[2] : "",
      };
    } catch (_) {
      return { model: "", reasoningEffort: "", reasoningSummary: "", modelVerbosity: "", sandboxMode: "", approvalPolicy: "" };
    }
  }

  function loadAuthKey() {
    if (env.CODEX_MOBILE_KEY && String(env.CODEX_MOBILE_KEY).trim()) {
      return String(env.CODEX_MOBILE_KEY).trim();
    }
    try {
      const value = fs.readFileSync(authKeyFile, "utf8").trim();
      if (value) return value;
    } catch (_) {
      // Create a durable local key so reloads and server restarts do not invalidate phone sessions.
    }
    const key = crypto.randomBytes(18).toString("base64url");
    fs.mkdirSync(path.dirname(authKeyFile), { recursive: true });
    fs.writeFileSync(authKeyFile, `${key}\n`, { encoding: "utf8", mode: 0o600 });
    return key;
  }

  function timingSafeEquals(a, b) {
    const left = Buffer.from(String(a || ""), "utf8");
    const right = Buffer.from(String(b || ""), "utf8");
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
  }

  function parseCookies(header) {
    const out = {};
    for (const part of String(header || "").split(";")) {
      const idx = part.indexOf("=");
      if (idx < 0) continue;
      out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
    return out;
  }

  function getUrl(req) {
    return new URL(req.url, `http://${req.headers.host || "localhost"}`);
  }

  function bearerTokenFromRequest(req) {
    const header = String(req.headers.authorization || req.headers.Authorization || "").trim();
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : "";
  }

  function requestAuthToken(req) {
    return requestAuthTokens(req)[0] || "";
  }

  function pushUniqueAuthToken(tokens, value) {
    const token = String(value || "").trim();
    if (token && !tokens.includes(token)) tokens.push(token);
  }

  function requestAuthTokens(req) {
    const url = getUrl(req);
    const cookies = parseCookies(req.headers.cookie);
    const tokens = [];
    pushUniqueAuthToken(tokens, req.headers["x-codex-mobile-key"]);
    pushUniqueAuthToken(tokens, bearerTokenFromRequest(req));
    pushUniqueAuthToken(tokens, url.searchParams.get("key"));
    pushUniqueAuthToken(tokens, url.searchParams.get("codexPluginLaunch"));
    pushUniqueAuthToken(tokens, cookies.codex_mobile_plugin_session);
    pushUniqueAuthToken(tokens, cookies.codex_mobile_key);
    return tokens;
  }

  function isAccessKeyAuthorized(req) {
    if (disableAuth) return true;
    return requestAuthTokens(req).some((token) => timingSafeEquals(token, getAuthKey()));
  }

  function isAuthorized(req) {
    if (isAccessKeyAuthorized(req)) return true;
    const hermesPluginService = getHermesPluginService();
    if (!hermesPluginService) return false;
    const tokens = requestAuthTokens(req);
    if (tokens.some((token) => hermesPluginService.isSessionAuthorized(token))) return true;
    return tokens.some((token) => hermesPluginService.isLaunchTokenAuthorized(token));
  }

  function isHttpsRequest(req) {
    return String(req && (req.headers["x-forwarded-proto"] || req.headers["x-forwarded-protocol"]) || "").split(",")[0].trim().toLowerCase() === "https";
  }

  function pluginSessionCookieHeader(req, session) {
    const sessionKey = String(session && session.session_key || "").trim();
    if (!sessionKey) return "";
    const maxAge = Math.max(1, Math.floor(Number(session && session.expires_in || 0) || 0));
    const parts = [
      `codex_mobile_plugin_session=${encodeURIComponent(sessionKey)}`,
      "Path=/",
      `Max-Age=${maxAge}`,
      "SameSite=Lax",
      "HttpOnly",
    ];
    if (isHttpsRequest(req)) parts.push("Secure");
    return parts.join("; ");
  }

  function sendJson(res, status, data, headers = {}) {
    if (!res || res.destroyed || res.writableEnded) return;
    const body = JSON.stringify(data);
    res.writeHead(status, Object.assign({
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(body),
      "Cache-Control": "no-store",
    }, headers || {}));
    res.end(body);
  }

  function readRawBody(req, limitBytes) {
    const maxBytes = Math.max(0, Number(limitBytes || 0));
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on("data", (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          reject(new Error("request body too large"));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
  }

  function readBody(req) {
    const maxBytes = Math.max(1, Number(valueFromGetter(getMaxJsonBodyBytes, 2_000_000) || 2_000_000));
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on("data", (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          reject(new Error("request body too large"));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8").trim();
        if (!raw) return resolve({});
        try {
          resolve(JSON.parse(raw));
        } catch (_) {
          reject(new Error("invalid JSON body"));
        }
      });
      req.on("error", reject);
    });
  }

  function hermesOriginFromRequest(req, url) {
    return String(
      (url && (url.searchParams.get("hermesOrigin") || url.searchParams.get("hermes_origin") || url.searchParams.get("appOrigin") || url.searchParams.get("origin")))
      || req.headers["x-hermes-origin"]
      || req.headers.origin
      || "",
    ).trim();
  }

  function requestBaseUrl(req) {
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
    const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
    const proto = forwardedProto === "https" ? "https" : "http";
    const host = forwardedHost || String(req.headers.host || "").trim();
    return host ? `${proto}://${host}` : "";
  }

  function trimLogFile(filePath, maxBytes, keepBytes) {
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || stat.size <= maxBytes) return false;
      const bytesToKeep = Math.max(0, Math.min(keepBytes, stat.size));
      const fd = fs.openSync(filePath, "r");
      try {
        const buffer = Buffer.alloc(bytesToKeep);
        const offset = stat.size - bytesToKeep;
        const bytesRead = fs.readSync(fd, buffer, 0, bytesToKeep, offset);
        fs.writeFileSync(filePath, buffer.subarray(0, bytesRead));
      } finally {
        fs.closeSync(fd);
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function trimRuntimeLogs(options = {}) {
    const now = Date.now();
    if (!options.force && now - lastLogTrimAt < 60_000) return;
    lastLogTrimAt = now;
    trimLogFile(
      String(getMobileWebLogFile() || ""),
      Number(valueFromGetter(getMobileWebLogMaxBytes, 0) || 0),
      Number(valueFromGetter(getMobileWebLogKeepBytes, 0) || 0),
    );
  }

  function safeLogDetails(details = {}) {
    const safeDetails = {};
    for (const [key, value] of Object.entries(details || {})) {
      if (value === undefined) continue;
      if (value instanceof Error) {
        safeDetails[key] = value.message || String(value);
      } else if (typeof value === "string") {
        safeDetails[key] = value.length > 600 ? `${value.slice(0, 600)}...` : value;
      } else if (value && typeof value === "object") {
        safeDetails[key] = compactStructured(value);
      } else {
        safeDetails[key] = value;
      }
    }
    return safeDetails;
  }

  function appendRuntimeLogLine(line, options = {}) {
    const suppressConsoleFallback = Boolean(options && options.suppressConsoleFallback);
    const filePath = String(valueFromGetter(getMobileWebLogFile, "") || "").trim();
    if (!filePath) {
      if (!suppressConsoleFallback) console.log(line);
      return false;
    }
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      trimRuntimeLogs();
      fs.appendFileSync(filePath, `${line}\n`, "utf8");
      return true;
    } catch (_) {
      if (!suppressConsoleFallback) console.log(line);
      return false;
    }
  }

  function runtimeLogEventMinIntervalMs() {
    const parsed = Number(valueFromGetter(getMobileWebLogEventMinIntervalMs, 30000));
    if (!Number.isFinite(parsed)) return 30000;
    return Math.max(0, Math.min(60_000, parsed));
  }

  function appendRuntimeEventLine(category, event, details = {}, options = {}) {
    const minIntervalMs = Number(options.minIntervalMs) >= 0
      ? Number(options.minIntervalMs)
      : runtimeLogEventMinIntervalMs();
    const timestampMs = Number(nowMs());
    const now = Number.isFinite(timestampMs) ? timestampMs : Date.now();
    const key = `${category}:${event}`;
    const state = runtimeLogEventState.get(key) || { lastAt: 0, suppressedCount: 0 };
    if (minIntervalMs > 0 && state.lastAt && now - state.lastAt < minIntervalMs) {
      state.suppressedCount += 1;
      runtimeLogEventState.set(key, state);
      return false;
    }

    const safeDetails = Object.assign({
      ts: new Date(now).toISOString(),
    }, safeLogDetails(details));
    if (state.suppressedCount) safeDetails.suppressedCount = state.suppressedCount;
    runtimeLogEventState.set(key, { lastAt: now, suppressedCount: 0 });
    return appendRuntimeLogLine(`[${category}] ${event} ${JSON.stringify(safeDetails)}`, {
      suppressConsoleFallback: true,
    });
  }

  function logThreadDetail(event, details = {}) {
    appendRuntimeEventLine("thread-detail", event, details);
  }

  function logThreadList(event, details = {}) {
    appendRuntimeEventLine("thread-list", event, details);
  }

  function logContinuation(event, details = {}) {
    appendRuntimeEventLine("continuation", event, details);
  }

  function logMessageSubmit(event, details = {}) {
    appendRuntimeEventLine("message-submit", event, details);
  }

  function logClientEvent(event, details = {}) {
    appendRuntimeEventLine("client-event", event, details, {
      minIntervalMs: String(event || "") === "frontend_diagnostic_log" ? 0 : undefined,
    });
  }

  function isTurnSteerUnsupportedError(err) {
    const message = String((err && err.message) || err || "").toLowerCase();
    return /method not found|unknown method/.test(message);
  }

  function isStaleActiveTurnError(err) {
    const message = String((err && err.message) || err || "").toLowerCase();
    return /not found|not active|inactive|completed|interrupted|expected turn|expected active turn id|no active turn|turn.*not.*running|turn.*not.*active/.test(message);
  }

  function isCodexAccountAuthError(err) {
    const message = String((err && err.message) || err || "").toLowerCase();
    return /token_expired|refresh_token_reused|refresh token|access token|unauthorized|401/.test(message);
  }

  function codexAccountAuthErrorPayload(err) {
    return {
      ok: false,
      error: "Codex 账号登录已失效，请重新登录该账号，或切换到可用账号后重试。",
      code: "codex_account_auth_invalid",
      detail: boundedProfilePreflightDetail(err),
    };
  }

  function truncateMiddle(value, maxChars, label) {
    const text = String(value ?? "");
    if (text.length <= maxChars) return text;
    const head = Math.floor(maxChars * 0.42);
    const tail = maxChars - head;
    return `${text.slice(0, head)}\n\n[${label} truncated: ${text.length} chars total, showing first ${head} and last ${tail}]\n\n${text.slice(-tail)}`;
  }

  function truncateTail(value, maxChars, label) {
    const text = String(value ?? "");
    if (text.length <= maxChars) return text;
    return `[${label} truncated: ${text.length} chars total, showing last ${maxChars}]\n\n${text.slice(-maxChars)}`;
  }

  function redactInlineImageDataUrls(value) {
    const text = String(value ?? "");
    if (!/data:image\//i.test(text)) return text;
    return text.replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=_-]+/gi, (match) => (
      `[inline image data omitted: ${match.length} chars]`
    ));
  }

  function compactStructured(value) {
    if (value == null) return value;
    let raw;
    try {
      raw = JSON.stringify(value);
    } catch (_) {
      raw = String(value);
    }
    const maxStructuredChars = Math.max(1, Number(valueFromGetter(getMaxStructuredChars, 24000) || 24000));
    const redacted = redactInlineImageDataUrls(raw);
    if (redacted.length <= maxStructuredChars) {
      if (redacted === raw) return value;
      try {
        return JSON.parse(redacted);
      } catch (_) {
        return redacted;
      }
    }
    if (raw.length <= maxStructuredChars) return value;
    return {
      truncated: true,
      totalChars: raw.length,
      inlineImagesRedacted: redacted !== raw || undefined,
      preview: truncateMiddle(redacted, maxStructuredChars, "structured payload"),
    };
  }

  function compactStringArray(values, maxChars, label) {
    if (!Array.isArray(values)) return values;
    return values.map((value) => (
      typeof value === "string"
        ? truncateMiddle(redactInlineImageDataUrls(value), maxChars, label)
        : compactStructured(value)
    ));
  }

  function statusText(status) {
    if (!status) return "";
    if (typeof status === "string") return status;
    return status.type || JSON.stringify(status);
  }

  return {
    readCodexConfigDefaults,
    loadAuthKey,
    timingSafeEquals,
    parseCookies,
    getUrl,
    bearerTokenFromRequest,
    requestAuthToken,
    pushUniqueAuthToken,
    requestAuthTokens,
    isAccessKeyAuthorized,
    isAuthorized,
    isHttpsRequest,
    pluginSessionCookieHeader,
    sendJson,
    readRawBody,
    readBody,
    hermesOriginFromRequest,
    requestBaseUrl,
    trimLogFile,
    trimRuntimeLogs,
    safeLogDetails,
    appendRuntimeLogLine,
    logThreadDetail,
    logThreadList,
    logContinuation,
    logMessageSubmit,
    logClientEvent,
    isTurnSteerUnsupportedError,
    isStaleActiveTurnError,
    isCodexAccountAuthError,
    codexAccountAuthErrorPayload,
    truncateMiddle,
    truncateTail,
    redactInlineImageDataUrls,
    compactStructured,
    compactStringArray,
    statusText,
  };
}

module.exports = {
  createServerHttpRuntimeService,
};
