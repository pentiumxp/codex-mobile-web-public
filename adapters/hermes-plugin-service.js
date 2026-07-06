"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_PLUGIN_ID = "codex-mobile";
const DEFAULT_PLUGIN_TITLE = "Codex Mobile";
const DEFAULT_LAUNCH_TOKEN_TTL_MS = 5 * 60 * 1000;
const DEFAULT_PLUGIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_SYNC_SCHEMA_VERSION = 1;
const PLUGIN_THEME_VALUES = Object.freeze(["system", "dark", "light"]);
const PLUGIN_FONT_SIZE_VALUES = Object.freeze(["small", "default", "large", "xlarge", "xxlarge"]);
const PLUGIN_THEME_VALUE_SET = new Set(PLUGIN_THEME_VALUES);
const PLUGIN_FONT_SIZE_VALUE_SET = new Set(PLUGIN_FONT_SIZE_VALUES);

function stringValue(value) {
  return String(value || "").trim();
}

function normalizeWorkspaceId(value) {
  return stringValue(value || "owner") || "owner";
}

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch (_) {
    return "";
  }
}

function normalizeHttpUrl(value, fieldName = "url") {
  const text = stringValue(value);
  if (!text) {
    const err = new Error(`${fieldName}_required`);
    err.statusCode = 400;
    throw err;
  }
  let parsed;
  try {
    parsed = new URL(text);
  } catch (_) {
    const err = new Error(`${fieldName}_invalid`);
    err.statusCode = 400;
    throw err;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    const err = new Error(`${fieldName}_must_use_http_or_https`);
    err.statusCode = 400;
    throw err;
  }
  if (parsed.username || parsed.password) {
    const err = new Error(`${fieldName}_must_not_include_credentials`);
    err.statusCode = 400;
    throw err;
  }
  parsed.hash = "";
  return parsed.toString();
}

function normalizeHttpOrigin(value, fieldName = "origin") {
  const url = normalizeHttpUrl(value, fieldName);
  return new URL(url).origin;
}

function normalizeOptionalHttpUrl(value, fieldName) {
  return stringValue(value) ? normalizeHttpUrl(value, fieldName) : "";
}

function normalizeBaseUrl(value) {
  const url = normalizeOptionalHttpUrl(value, "base_url");
  if (!url) return "";
  const parsed = new URL(url);
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function joinUrl(baseUrl, targetPath) {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) return stringValue(targetPath);
  return new URL(targetPath, `${base}/`).toString();
}

function appendQueryParam(url, key, value) {
  const text = stringValue(url);
  const param = stringValue(key);
  const paramValue = stringValue(value);
  if (!text || !param || !paramValue) return text;
  const joiner = text.includes("?") ? "&" : "?";
  return `${text}${joiner}${encodeURIComponent(param)}=${encodeURIComponent(paramValue)}`;
}

function manifestBuildIdentity(input = {}, options = {}) {
  const buildId = stringValue(input.buildId || options.buildId);
  const clientBuildId = stringValue(input.clientBuildId || options.clientBuildId);
  const shellCacheName = stringValue(input.shellCacheName || options.shellCacheName);
  return {
    buildId,
    clientBuildId,
    shellCacheName,
    identity: clientBuildId || shellCacheName || buildId,
  };
}

function callbackUrlFromBody(body = {}) {
  return body.hermes_callback_url
    || body.hermesCallbackUrl
    || body.callback_url
    || body.callbackUrl
    || body.callback
    || "";
}

function appOriginFromBody(body = {}) {
  const raw = body.hermes_app_origin || body.hermesAppOrigin || body.app_origin || body.appOrigin || body.hermesOrigin || "";
  if (!stringValue(raw)) return "";
  return normalizeHttpOrigin(raw, "hermes_app_origin");
}

function hermesOriginFromBody(body = {}) {
  const raw = body.hermes_origin || body.hermesOrigin || body.hermes_app_origin || body.hermesAppOrigin || body.app_origin || body.appOrigin || body.origin || "";
  if (!stringValue(raw)) return "";
  return normalizeHttpOrigin(raw, "hermes_origin");
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    const text = stringValue(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function normalizeOriginList(value) {
  const raw = Array.isArray(value)
    ? value
    : String(value || "").split(/[\s,]+/);
  return uniqueStrings(raw.filter((entry) => stringValue(entry)).map((entry) => normalizeHttpOrigin(entry, "hermes_origin")));
}

function safeRegistrationLabel(value) {
  return stringValue(value).slice(0, 120);
}

function readJsonFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return fallback;
  }
}

function writeJsonFile(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function publicRegistration(record = {}) {
  return {
    pluginId: stringValue(record.pluginId || DEFAULT_PLUGIN_ID),
    workspaceId: normalizeWorkspaceId(record.workspaceId),
    callbackUrl: stringValue(record.callbackUrl),
    appOrigin: stringValue(record.appOrigin),
    label: stringValue(record.label),
    registeredAt: stringValue(record.registeredAt),
    updatedAt: stringValue(record.updatedAt),
  };
}

function normalizeState(value = {}) {
  const rawWorkspaces = value && typeof value === "object" && value.workspaces && typeof value.workspaces === "object"
    ? value.workspaces
    : {};
  const workspaces = {};
  for (const [workspaceId, record] of Object.entries(rawWorkspaces)) {
    const normalized = publicRegistration(Object.assign({}, record, { workspaceId }));
    if (normalized.callbackUrl || normalized.appOrigin) workspaces[normalized.workspaceId] = normalized;
  }
  return {
    pluginId: stringValue(value.pluginId || DEFAULT_PLUGIN_ID),
    updatedAt: stringValue(value.updatedAt),
    workspaces,
  };
}

function launchTokenFromRequestValue(value) {
  const token = stringValue(value);
  return token && /^cpl_[A-Za-z0-9_-]{16,}$/.test(token) ? token : "";
}

function pluginSessionTokenFromRequestValue(value) {
  const token = stringValue(value);
  return token && /^cps_[A-Za-z0-9_-]{16,}$/.test(token) ? token : "";
}

function boundedOptionalString(value, maxLength) {
  const text = stringValue(value);
  if (!text) return "";
  return text.slice(0, Math.max(1, maxLength || 1));
}

function normalizedEnumValue(value, allowedValues) {
  const text = stringValue(value).toLowerCase();
  return allowedValues.has(text) ? text : "";
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function launchTargetFromBody(body = {}) {
  const route = objectValue(body.route);
  const cwd = boundedOptionalString(
    body.cwd || body.workspace_cwd || body.workspaceCwd || route.cwd || route.workspace || "",
    4096,
  );
  const threadId = boundedOptionalString(
    body.thread_id || body.threadId || route.threadId || route.itemId || "",
    200,
  );
  const target = {};
  if (cwd) target.cwd = cwd;
  if (threadId) target.threadId = threadId;
  return Object.keys(target).length ? target : null;
}

function pluginAppearanceFromBody(body = {}) {
  const route = objectValue(body.route);
  const sources = [
    objectValue(body.appearance),
    objectValue(body.ui),
    objectValue(route.appearance),
    objectValue(route.ui),
    body,
  ];
  const appearance = {};
  for (const source of sources) {
    if (!appearance.theme) {
      const theme = normalizedEnumValue(
        source.theme || source.pluginTheme || source.tone || source.colorScheme || source.color_scheme,
        PLUGIN_THEME_VALUE_SET,
      );
      if (theme) appearance.theme = theme;
    }
    if (!appearance.fontSize) {
      const fontSize = normalizedEnumValue(
        source.fontSize || source.pluginFontSize || source.font_size || source.textSize || source.text_size,
        PLUGIN_FONT_SIZE_VALUE_SET,
      );
      if (fontSize) appearance.fontSize = fontSize;
    }
  }
  return Object.keys(appearance).length ? appearance : null;
}

function createHermesPluginService(options = {}) {
  const registrationFile = options.registrationFile;
  const pluginId = stringValue(options.pluginId || DEFAULT_PLUGIN_ID);
  const title = stringValue(options.title || DEFAULT_PLUGIN_TITLE);
  const tokenTtlMs = Math.max(30_000, Number(options.launchTokenTtlMs || DEFAULT_LAUNCH_TOKEN_TTL_MS));
  const sessionTtlMs = Math.max(30_000, Number(options.pluginSessionTtlMs || DEFAULT_PLUGIN_SESSION_TTL_MS));
  const staticHermesOrigins = normalizeOriginList(options.hermesOrigins || "");
  const nowMs = typeof options.nowMs === "function" ? options.nowMs : () => Date.now();
  const nowIso = typeof options.nowIso === "function" ? options.nowIso : () => new Date(nowMs()).toISOString();
  const randomToken = typeof options.randomToken === "function"
    ? options.randomToken
    : () => `cpl_${crypto.randomBytes(24).toString("base64url")}`;
  const randomSessionToken = typeof options.randomSessionToken === "function"
    ? options.randomSessionToken
    : () => `cps_${crypto.randomBytes(32).toString("base64url")}`;
  const launchTokens = new Map();
  const pluginSessions = new Map();

  function loadState() {
    return normalizeState(registrationFile ? readJsonFile(registrationFile, {}) : {});
  }

  function saveState(state) {
    if (!registrationFile) return;
    writeJsonFile(registrationFile, normalizeState(state));
  }

  function pruneLaunchTokens() {
    const now = nowMs();
    for (const [token, record] of launchTokens.entries()) {
      if (!record || record.expiresAtMs <= now) launchTokens.delete(token);
    }
  }

  function prunePluginSessions() {
    const now = nowMs();
    for (const [token, record] of pluginSessions.entries()) {
      if (!record || record.expiresAtMs <= now) pluginSessions.delete(token);
    }
  }

  function registeredOrigins() {
    const stateOrigins = Object.values(loadState().workspaces || {}).map((record) => record.appOrigin);
    return uniqueStrings(staticHermesOrigins.concat(stateOrigins));
  }

  function frameAncestors() {
    return ["'self'"].concat(registeredOrigins());
  }

  function frameAncestorsHeader() {
    return frameAncestors().join(" ");
  }

  function manifestDiagnostics(entryUrl, input = {}) {
    const diagnostics = [];
    const hermesOrigin = stringValue(input.hermesOrigin || input.appOrigin || input.origin)
      ? normalizeHttpOrigin(input.hermesOrigin || input.appOrigin || input.origin, "hermes_origin")
      : "";
    const entryOrigin = originOf(entryUrl);
    if (hermesOrigin && hermesOrigin.startsWith("https://") && entryOrigin.startsWith("http://")) {
      diagnostics.push({
        code: "https_hermes_cannot_embed_http_codex_entry",
        severity: "error",
        message: "HTTPS Hermes Mobile cannot embed an HTTP Codex Mobile entry. Configure CODEX_MOBILE_HERMES_PLUGIN_BASE_URL or CODEX_MOBILE_PUBLIC_BASE_URL to an HTTPS Codex Mobile origin.",
        hermes_origin: hermesOrigin,
        entry_origin: entryOrigin,
      });
    }
    return diagnostics;
  }

  function manifest(input = {}) {
    const baseUrl = normalizeBaseUrl(input.baseUrl || options.baseUrl || "");
    const version = stringValue(input.version || options.version);
    const buildIdentity = manifestBuildIdentity(input, options);
    const entryUrl = appendQueryParam(joinUrl(baseUrl, "/?embed=hermes"), "codexMobileBuild", buildIdentity.identity);
    const manifestVersion = buildIdentity.identity || version;
    const origins = registeredOrigins();
    return {
      id: pluginId,
      title,
      description: "Authenticated Codex Mobile Web embedded in Hermes Mobile as an independent plugin.",
      kind: "embedded_app",
      version,
      buildId: buildIdentity.buildId,
      clientBuildId: buildIdentity.clientBuildId,
      shellCacheName: buildIdentity.shellCacheName,
      build: {
        buildId: buildIdentity.buildId,
        clientBuildId: buildIdentity.clientBuildId,
        shellCacheName: buildIdentity.shellCacheName,
        identity: buildIdentity.identity,
      },
      entry: {
        type: "web",
        url: entryUrl,
        frame_policy: "csp_frame_ancestors",
        required_query: Object.assign(
          { embed: "hermes" },
          buildIdentity.identity ? { codexMobileBuild: buildIdentity.identity } : {},
        ),
      },
      embedding: {
        refreshOnVersionChange: true,
        version: manifestVersion,
        buildId: buildIdentity.buildId,
        clientBuildId: buildIdentity.clientBuildId,
        shellCacheName: buildIdentity.shellCacheName,
        entryQueryParam: buildIdentity.identity ? "codexMobileBuild" : "",
      },
      embed: {
        refreshOnVersionChange: true,
        version: manifestVersion,
        buildId: buildIdentity.buildId,
        clientBuildId: buildIdentity.clientBuildId,
        shellCacheName: buildIdentity.shellCacheName,
        entryQueryParam: buildIdentity.identity ? "codexMobileBuild" : "",
      },
      program_api: {
        base_url: baseUrl,
        plugin_manifest: "/api/v1/hermes/plugin/manifest",
        workspace_registration: "/api/v1/hermes/plugin/workspaces",
        callback_registration: "/api/v1/hermes/plugin/callbacks",
        origin_registration: "/api/v1/hermes/plugin/origins",
        plugin_launch: "/api/v1/hermes/plugin/launch",
        plugin_session: "/api/v1/hermes/plugin/session",
        notification_delegate_test: "/api/v1/hermes/plugin/notifications",
        hermes_notification_endpoint: `/api/hermes-plugins/${pluginId}/notifications`,
        sync_schema_version: DEFAULT_SYNC_SCHEMA_VERSION,
      },
      appearance_sync: {
        schema_version: 1,
        launch_fields: ["appearance.theme", "appearance.fontSize"],
        entry_query_params: ["pluginTheme", "pluginFontSize"],
        session_response_field: "appearance",
        apply_before_initialization: true,
        theme_values: PLUGIN_THEME_VALUES,
        font_size_values: PLUGIN_FONT_SIZE_VALUES,
        raw_sensitive_material_returned: false,
      },
      owner_binding: {
        strategy: "workspace_bound_codex_mobile_key",
        credential: "codex_mobile_access_key",
        raw_access_key_returned_by_codex_mobile: false,
        raw_key_returned_by_codex_mobile: false,
        auth_header_returned_by_manifest: false,
        local_paths_returned_by_manifest: false,
      },
      permissions: {
        register_workspace_requires: ["codex_mobile_access_key"],
        owner_token_scopes: ["threads:read", "threads:write", "uploads:write"],
      },
      launch: {
        entry_path_only: true,
        token_ttl_seconds: Math.max(1, Math.floor(tokenTtlMs / 1000)),
        browser_session_exchange: "/api/v1/hermes/plugin/session",
      },
      frame_embedding: {
        frame_ancestors: frameAncestors(),
        registered_origins: origins,
        registration_path: "/api/v1/hermes/plugin/origins",
        https_hermes_requires_https_entry: true,
        diagnostics: manifestDiagnostics(entryUrl, input),
      },
      navigation: {
        state_message: {
          type: "codex-mobile.plugin.navigation",
          version: 1,
        },
        back_message: {
          type: "hermes.plugin.back",
          version: 1,
        },
        back_result_message: {
          type: "codex-mobile.plugin.back_result",
          version: 1,
        },
      },
      notifications: {
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
      },
      callback_registration: {
        accepts: ["http", "https"],
        path: "/api/v1/hermes/plugin/callbacks",
        field: "hermes_callback_url",
      },
    };
  }

  function registerWorkspace(body = {}) {
    const workspaceId = normalizeWorkspaceId(body.workspace_id || body.workspaceId);
    const callbackUrl = normalizeHttpUrl(callbackUrlFromBody(body), "hermes_callback_url");
    const appOrigin = appOriginFromBody(body) || originOf(callbackUrl);
    const state = loadState();
    const existing = state.workspaces[workspaceId] || {};
    const now = nowIso();
    const record = publicRegistration({
      pluginId,
      workspaceId,
      callbackUrl,
      appOrigin,
      label: safeRegistrationLabel(body.label || body.name || existing.label || "Hermes Mobile"),
      registeredAt: existing.registeredAt || now,
      updatedAt: now,
    });
    state.pluginId = pluginId;
    state.updatedAt = now;
    state.workspaces[workspaceId] = record;
    saveState(state);
    return record;
  }

  function registerOrigin(body = {}) {
    const workspaceId = normalizeWorkspaceId(body.workspace_id || body.workspaceId);
    const appOrigin = hermesOriginFromBody(body);
    const callbackRaw = callbackUrlFromBody(body);
    const callbackUrl = callbackRaw ? normalizeHttpUrl(callbackRaw, "hermes_callback_url") : "";
    const state = loadState();
    const existing = state.workspaces[workspaceId] || {};
    const now = nowIso();
    const record = publicRegistration({
      pluginId,
      workspaceId,
      callbackUrl: callbackUrl || existing.callbackUrl || "",
      appOrigin,
      label: safeRegistrationLabel(body.label || body.name || existing.label || "Hermes Mobile"),
      registeredAt: existing.registeredAt || now,
      updatedAt: now,
    });
    state.pluginId = pluginId;
    state.updatedAt = now;
    state.workspaces[workspaceId] = record;
    saveState(state);
    return record;
  }

  function registration(input = {}) {
    const workspaceId = normalizeWorkspaceId(input.workspace_id || input.workspaceId);
    return loadState().workspaces[workspaceId] || null;
  }

  function createLaunch(body = {}) {
    pruneLaunchTokens();
    const workspaceId = normalizeWorkspaceId(body.workspace_id || body.workspaceId);
    const target = launchTargetFromBody(body);
    const appearance = pluginAppearanceFromBody(body);
    const token = launchTokenFromRequestValue(randomToken()) || `cpl_${crypto.randomBytes(24).toString("base64url")}`;
    const createdAtMs = nowMs();
    const expiresAtMs = createdAtMs + tokenTtlMs;
    launchTokens.set(token, {
      token,
      workspaceId,
      target,
      appearance,
      createdAtMs,
      expiresAtMs,
    });
    const params = new URLSearchParams({
      embed: "hermes",
      codexPluginLaunch: token,
      workspaceId,
    });
    if (appearance && appearance.theme) params.set("pluginTheme", appearance.theme);
    if (appearance && appearance.fontSize) params.set("pluginFontSize", appearance.fontSize);
    return {
      ok: true,
      entry_path: `/?${params.toString()}`,
      expires_in: Math.max(1, Math.floor(tokenTtlMs / 1000)),
    };
  }

  function pluginSessionResponse(record) {
    if (!record || record.expiresAtMs <= nowMs()) return null;
    const registrationRecord = registration({ workspaceId: record.workspaceId });
    const response = {
      ok: true,
      session_key: record.token,
      expires_in: Math.max(1, Math.floor((record.expiresAtMs - nowMs()) / 1000)),
      token_type: "codex_mobile_plugin_session",
    };
    if (record.target) response.target = record.target;
    if (record.appearance) response.appearance = record.appearance;
    if (registrationRecord && registrationRecord.appOrigin) response.hermes_origin = registrationRecord.appOrigin;
    return response;
  }

  function createSession(input = {}) {
    pruneLaunchTokens();
    prunePluginSessions();
    const launchToken = launchTokenFromRequestValue(input.codexPluginLaunch || input.pluginLaunch || input.launchToken || input.token || input.key);
    const launch = launchToken ? launchTokens.get(launchToken) : null;
    if (!launch || launch.expiresAtMs <= nowMs()) {
      const err = new Error("plugin_launch_invalid_or_expired");
      err.statusCode = 401;
      throw err;
    }
    launchTokens.delete(launchToken);
    const sessionKey = pluginSessionTokenFromRequestValue(randomSessionToken()) || `cps_${crypto.randomBytes(32).toString("base64url")}`;
    const createdAtMs = nowMs();
    const expiresAtMs = createdAtMs + sessionTtlMs;
    const record = {
      token: sessionKey,
      workspaceId: launch.workspaceId,
      target: launch.target || null,
      appearance: launch.appearance || null,
      createdAtMs,
      expiresAtMs,
    };
    pluginSessions.set(sessionKey, record);
    return pluginSessionResponse(record);
  }

  function readSession(input = {}) {
    prunePluginSessions();
    const token = pluginSessionTokenFromRequestValue(input.sessionKey || input.session_key || input.pluginSession || input.plugin_session || input.token || input.key);
    const record = token ? pluginSessions.get(token) : null;
    return pluginSessionResponse(record);
  }

  function isLaunchTokenAuthorized(value) {
    pruneLaunchTokens();
    const token = launchTokenFromRequestValue(value);
    return Boolean(token && launchTokens.has(token));
  }

  function isSessionAuthorized(value) {
    prunePluginSessions();
    const token = pluginSessionTokenFromRequestValue(value);
    return Boolean(token && pluginSessions.has(token));
  }

  return {
    createLaunch,
    createSession,
    frameAncestors,
    frameAncestorsHeader,
    isLaunchTokenAuthorized,
    isSessionAuthorized,
    loadState,
    manifest,
    readSession,
    registeredOrigins,
    registerOrigin,
    registerWorkspace,
    registration,
  };
}

module.exports = {
  DEFAULT_LAUNCH_TOKEN_TTL_MS,
  DEFAULT_PLUGIN_ID,
  callbackUrlFromBody,
  createHermesPluginService,
  launchTokenFromRequestValue,
  normalizeHttpOrigin,
  normalizeHttpUrl,
  pluginSessionTokenFromRequestValue,
  publicRegistration,
};
