"use strict";

const crypto = require("node:crypto");
const defaultFs = require("node:fs");
const defaultPath = require("node:path");
const os = require("node:os");

const {
  DEFAULT_ROLES,
  WORKSPACE_KIND,
} = require("./remote-managed-workspace-service");

const DEFAULT_PROJECT_TYPE = "vite_game";
const DEFAULT_CONNECTION_MODE = "persistent";
const EFFECTIVE_CONNECTION_MODE = "http_polling";
const SECRET_PREVIEW = "********";
const PAIRING_STATUS_VALUES = new Set([
  "unconfigured",
  "requesting_pairing",
  "pending_approval",
  "approved",
  "connected",
  "rejected",
  "auth_failed",
  "offline_retrying",
]);
const STATUS_VALUES = new Set([
  "disconnected",
  "connecting",
  "connected",
  "stale",
  "auth_failed",
  "config_invalid",
  "offline",
]);
const CONNECTION_MODES = new Set(["persistent", "http_polling", "polling"]);
const GENERATED_WORKSPACE_CONFIG_ISSUES = new Set([
  "project_root_required",
  "allowed_root_required",
  "project_root_outside_allowed_root",
  "project_root_not_found",
  "project_root_not_directory",
  "workspace_id_required",
  "node_name_required",
]);
const DEFAULT_CAPABILITIES = [
  "task-card-poll",
  "task-card-ack",
  "task-card-heartbeat",
  "task-card-return",
  "daily-summary",
  "bounded-escalation",
];

function compactOneLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function errorWithStatus(code, statusCode = 400) {
  const err = new Error(code);
  err.code = code;
  err.statusCode = statusCode;
  return err;
}

function nowIso(now) {
  const value = typeof now === "function" ? now() : Date.now();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function normalizeUrl(value, fieldName) {
  const text = compactOneLine(value);
  if (!text) throw errorWithStatus(`${fieldName}_required`);
  let parsed;
  try {
    parsed = new URL(text);
  } catch (_) {
    throw errorWithStatus(`${fieldName}_invalid`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw errorWithStatus(`${fieldName}_must_use_http_or_https`);
  }
  if (parsed.username || parsed.password) throw errorWithStatus(`${fieldName}_must_not_include_credentials`);
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function normalizeStringList(value, fallback = [], limit = 24) {
  const source = Array.isArray(value) ? value : (compactOneLine(value) ? String(value).split(/[\n,]+/) : fallback);
  const seen = new Set();
  const result = [];
  for (const item of source || []) {
    const text = compactOneLine(item).slice(0, 120);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeStatus(value) {
  const text = compactOneLine(value).toLowerCase();
  return STATUS_VALUES.has(text) ? text : "disconnected";
}

function normalizePairingStatus(value) {
  const text = compactOneLine(value).toLowerCase();
  return PAIRING_STATUS_VALUES.has(text) ? text : "unconfigured";
}

function isPathInside(pathModule, child, parent) {
  const relative = pathModule.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !pathModule.isAbsolute(relative));
}

function readJsonFile(fs, file, fallback) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeJsonFile(fs, pathModule, file, value) {
  if (!file) return;
  fs.mkdirSync(pathModule.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, file);
}

function defaultSettings(defaultAllowedRoot = "") {
  return {
    version: 1,
    enabled: false,
    workspaceKind: WORKSPACE_KIND,
    workspaceId: "",
    nodeName: "",
    centralUrl: "",
    projectRoot: "",
    allowedRoot: defaultAllowedRoot,
    projectType: DEFAULT_PROJECT_TYPE,
    enrollmentTokenRef: "",
    connectionMode: DEFAULT_CONNECTION_MODE,
    roles: DEFAULT_ROLES.slice(),
    capabilities: DEFAULT_CAPABILITIES.slice(),
    updatedAt: "",
  };
}

function blankState() {
  return {
    version: 1,
    connectionStatus: "disconnected",
    issueCodes: [],
    diagnostics: [],
    activeTaskCardId: "",
    activeLocalThreadId: "",
    activeLocalTurnId: "",
    activeTaskCardStartedAt: "",
    lastHeartbeatAt: "",
    lastPollAt: "",
    lastTaskCardId: "",
    lastLocalThreadId: "",
    lastLocalTurnId: "",
    lastReturnStatus: "",
    lastExecutionBridgeStatus: "",
    lastRegisterAt: "",
    lastConnectionCheckAt: "",
    pairingStatus: "unconfigured",
    pairingRequestId: "",
    pairingRequestedAt: "",
    pairingApprovedAt: "",
    pairingRejectedAt: "",
    pairingRejectionReason: "",
    lastPairingCheckAt: "",
    consecutiveFailures: 0,
    nextRetryAt: "",
    queuedTerminalReturns: [],
    executedIdempotencyKeys: [],
    updatedAt: "",
  };
}

function boundedIssueCodes(value) {
  return normalizeStringList(value, [], 12)
    .map((entry) => entry.toLowerCase().replace(/[^a-z0-9_-]+/g, "_"))
    .filter(Boolean);
}

function normalizeDiagnostics(value) {
  const source = Array.isArray(value) ? value : [];
  return source.map((entry) => {
    const item = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
    return {
      code: compactOneLine(item.code).toLowerCase().replace(/[^a-z0-9_-]+/g, "_").slice(0, 120),
      status: compactOneLine(item.status).slice(0, 80),
      at: compactOneLine(item.at).slice(0, 80),
    };
  }).filter((entry) => entry.code).slice(-20);
}

function normalizeConnectionMode(value) {
  const text = compactOneLine(value).toLowerCase();
  if (!text) return DEFAULT_CONNECTION_MODE;
  if (!CONNECTION_MODES.has(text)) throw errorWithStatus("connection_mode_invalid");
  return text === "polling" ? "http_polling" : text;
}

function withoutIssueCodes(state = {}, issueCodes = new Set()) {
  const codes = boundedIssueCodes(state.issueCodes).filter((code) => !issueCodes.has(code));
  const diagnostics = normalizeDiagnostics(state.diagnostics).filter((entry) => !issueCodes.has(entry.code));
  return Object.assign({}, state, { issueCodes: codes, diagnostics });
}

function stableHash(value, length = 12) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, length);
}

function slugValue(value, fallback = "workspace", limit = 48) {
  const text = compactOneLine(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, limit);
  return text || fallback;
}

function workspaceIdentity(pathModule, workspace = {}) {
  const rawProjectRoot = compactOneLine(workspace.cwd || workspace.projectRoot || workspace.path);
  if (!rawProjectRoot) throw errorWithStatus("workspace_path_required");
  const projectRoot = pathModule.resolve(rawProjectRoot);
  const label = compactOneLine(workspace.label || pathModule.basename(projectRoot) || "workspace");
  const hash = stableHash(projectRoot);
  const slug = slugValue(label);
  const hostSlug = slugValue(os.hostname() || "node", "node", 32);
  return {
    projectRoot,
    allowedRoot: projectRoot,
    workspaceId: `rmw_${slug}_${hash}`.slice(0, 180),
    nodeName: `${hostSlug}_${slug}_${hash.slice(0, 8)}`.slice(0, 120),
  };
}

function createRemoteManagedWorkspaceSettingsService(dependencies = {}) {
  const fs = dependencies.fs || defaultFs;
  const pathModule = dependencies.path || defaultPath;
  const now = dependencies.now || Date.now;
  const env = dependencies.env || process.env || {};
  const defaultAllowedRoot = compactOneLine(dependencies.defaultAllowedRoot || "");
  const settingsFile = compactOneLine(dependencies.settingsFile || "");
  const stateFile = compactOneLine(dependencies.stateFile || "");
  const enrollmentTokenFile = compactOneLine(dependencies.enrollmentTokenFile || "");
  const enrollmentTokenEnv = compactOneLine(dependencies.enrollmentTokenEnv || "CODEX_MOBILE_REMOTE_MANAGED_WORKSPACE_ENROLLMENT_TOKEN");

  function readSettings() {
    const loaded = Object.assign(defaultSettings(defaultAllowedRoot), readJsonFile(fs, settingsFile, {}));
    loaded.roles = normalizeStringList(loaded.roles, DEFAULT_ROLES, 16);
    if (!loaded.roles.includes("external_project_main")) loaded.roles.unshift("external_project_main");
    loaded.capabilities = normalizeStringList(loaded.capabilities, DEFAULT_CAPABILITIES, 24);
    try {
      loaded.connectionMode = normalizeConnectionMode(loaded.connectionMode);
    } catch (_) {
      loaded.connectionMode = DEFAULT_CONNECTION_MODE;
    }
    loaded.workspaceKind = compactOneLine(loaded.workspaceKind || WORKSPACE_KIND) || WORKSPACE_KIND;
    loaded.projectType = compactOneLine(loaded.projectType || DEFAULT_PROJECT_TYPE) || DEFAULT_PROJECT_TYPE;
    return loaded;
  }

  function writeSettings(settings) {
    const next = Object.assign(defaultSettings(defaultAllowedRoot), settings || {}, {
      version: 1,
      updatedAt: nowIso(now),
    });
    delete next.enrollmentToken;
    delete next.token;
    writeJsonFile(fs, pathModule, settingsFile, next);
    return next;
  }

  function readState() {
    const loaded = Object.assign(blankState(), readJsonFile(fs, stateFile, {}));
    loaded.connectionStatus = normalizeStatus(loaded.connectionStatus);
    loaded.pairingStatus = normalizePairingStatus(loaded.pairingStatus);
    loaded.issueCodes = boundedIssueCodes(loaded.issueCodes);
    loaded.diagnostics = normalizeDiagnostics(loaded.diagnostics);
    loaded.queuedTerminalReturns = Array.isArray(loaded.queuedTerminalReturns) ? loaded.queuedTerminalReturns.slice(-20) : [];
    loaded.executedIdempotencyKeys = normalizeStringList(loaded.executedIdempotencyKeys, [], 200);
    return loaded;
  }

  function writeState(state) {
    const next = Object.assign(blankState(), state || {}, {
      version: 1,
      updatedAt: nowIso(now),
    });
    next.connectionStatus = normalizeStatus(next.connectionStatus);
    next.pairingStatus = normalizePairingStatus(next.pairingStatus);
    next.issueCodes = boundedIssueCodes(next.issueCodes);
    next.diagnostics = normalizeDiagnostics(next.diagnostics);
    next.activeTaskCardId = compactOneLine(next.activeTaskCardId).slice(0, 180);
    next.activeLocalThreadId = compactOneLine(next.activeLocalThreadId).slice(0, 180);
    next.activeLocalTurnId = compactOneLine(next.activeLocalTurnId).slice(0, 180);
    next.activeTaskCardStartedAt = compactOneLine(next.activeTaskCardStartedAt).slice(0, 80);
    next.lastTaskCardId = compactOneLine(next.lastTaskCardId).slice(0, 180);
    next.lastLocalThreadId = compactOneLine(next.lastLocalThreadId).slice(0, 180);
    next.lastLocalTurnId = compactOneLine(next.lastLocalTurnId).slice(0, 180);
    next.lastReturnStatus = compactOneLine(next.lastReturnStatus).slice(0, 80);
    next.lastExecutionBridgeStatus = compactOneLine(next.lastExecutionBridgeStatus).slice(0, 120);
    next.pairingRequestId = compactOneLine(next.pairingRequestId).slice(0, 180);
    next.pairingRequestedAt = compactOneLine(next.pairingRequestedAt).slice(0, 80);
    next.pairingApprovedAt = compactOneLine(next.pairingApprovedAt).slice(0, 80);
    next.pairingRejectedAt = compactOneLine(next.pairingRejectedAt).slice(0, 80);
    next.pairingRejectionReason = compactOneLine(next.pairingRejectionReason).slice(0, 240);
    next.lastPairingCheckAt = compactOneLine(next.lastPairingCheckAt).slice(0, 80);
    next.queuedTerminalReturns = Array.isArray(next.queuedTerminalReturns) ? next.queuedTerminalReturns.slice(-20) : [];
    next.executedIdempotencyKeys = normalizeStringList(next.executedIdempotencyKeys, [], 200);
    writeJsonFile(fs, pathModule, stateFile, next);
    return next;
  }

  function readEnrollmentToken(settings = readSettings()) {
    const fileToken = enrollmentTokenFile ? compactOneLine(readSecretFile(enrollmentTokenFile)) : "";
    if (fileToken) return fileToken;
    const ref = compactOneLine(settings && settings.enrollmentTokenRef || "");
    if (/^env:[A-Za-z_][A-Za-z0-9_]*$/.test(ref)) {
      const name = ref.slice(4);
      const refToken = compactOneLine(env[name] || "");
      if (refToken) return refToken;
    }
    return compactOneLine(env[enrollmentTokenEnv] || env.CODEX_MOBILE_REMOTE_MANAGED_WORKSPACE_TOKEN || "");
  }

  function readSecretFile(file) {
    try {
      return fs.readFileSync(file, "utf8");
    } catch (_) {
      return "";
    }
  }

  function writeEnrollmentToken(value) {
    const token = compactOneLine(value);
    if (!token) return false;
    if (!enrollmentTokenFile) throw errorWithStatus("enrollment_token_secret_file_unconfigured", 500);
    fs.mkdirSync(pathModule.dirname(enrollmentTokenFile), { recursive: true });
    fs.writeFileSync(enrollmentTokenFile, `${token}\n`, { encoding: "utf8", mode: 0o600 });
    try {
      fs.chmodSync(enrollmentTokenFile, 0o600);
    } catch (_) {}
    return true;
  }

  function writeScopedCredential(value) {
    return writeEnrollmentToken(value);
  }

  function clearEnrollmentToken() {
    if (!enrollmentTokenFile) return false;
    try {
      fs.rmSync(enrollmentTokenFile, { force: true });
      return true;
    } catch (_) {
      return false;
    }
  }

  function validateProjectRoots(settings, options = {}) {
    const projectRootText = compactOneLine(settings.projectRoot);
    const allowedRootText = compactOneLine(settings.allowedRoot);
    const requirePaths = options.requirePaths === true;
    if (!projectRootText && !allowedRootText && !requirePaths) {
      return { projectRoot: "", allowedRoot: "", evidence: { exists: false, withinAllowedRoot: false } };
    }
    if (!projectRootText) throw errorWithStatus("project_root_required");
    if (!allowedRootText) throw errorWithStatus("allowed_root_required");
    const projectRoot = pathModule.resolve(projectRootText);
    const allowedRoot = pathModule.resolve(allowedRootText);
    if (!isPathInside(pathModule, projectRoot, allowedRoot)) {
      throw errorWithStatus("project_root_outside_allowed_root");
    }
    let stat;
    try {
      stat = fs.statSync(projectRoot);
    } catch (_) {
      throw errorWithStatus("project_root_not_found");
    }
    if (!stat.isDirectory()) throw errorWithStatus("project_root_not_directory");
    return {
      projectRoot,
      allowedRoot,
      evidence: {
        exists: true,
        withinAllowedRoot: true,
        checkedBy: "remote_node_settings",
      },
    };
  }

  function normalizeSettings(input = {}, current = readSettings()) {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const enabled = Object.prototype.hasOwnProperty.call(source, "enabled")
      ? Boolean(source.enabled)
      : Boolean(current.enabled);
    const workspaceKind = compactOneLine(source.workspaceKind || current.workspaceKind || WORKSPACE_KIND);
    if (workspaceKind !== WORKSPACE_KIND) throw errorWithStatus("workspace_kind_invalid");
    const next = {
      enabled,
      workspaceKind,
      workspaceId: compactOneLine(source.workspaceId || current.workspaceId).slice(0, 180),
      nodeName: compactOneLine(source.nodeName || current.nodeName).slice(0, 120),
      centralUrl: compactOneLine(source.centralUrl || current.centralUrl),
      projectRoot: compactOneLine(source.projectRoot || current.projectRoot),
      allowedRoot: compactOneLine(source.allowedRoot || source.allowedProjectRoot || current.allowedRoot || defaultAllowedRoot),
      projectType: compactOneLine(source.projectType || current.projectType || DEFAULT_PROJECT_TYPE).slice(0, 80) || DEFAULT_PROJECT_TYPE,
      enrollmentTokenRef: compactOneLine(source.enrollmentTokenRef || current.enrollmentTokenRef).slice(0, 180),
      connectionMode: normalizeConnectionMode(source.connectionMode || current.connectionMode || DEFAULT_CONNECTION_MODE),
      roles: normalizeStringList(source.roles || current.roles, DEFAULT_ROLES, 16),
      capabilities: normalizeStringList(source.capabilities || current.capabilities, DEFAULT_CAPABILITIES, 24),
    };
    if (!next.roles.includes("external_project_main")) next.roles.unshift("external_project_main");
    if (next.centralUrl) next.centralUrl = normalizeUrl(next.centralUrl, "central_url");
    if (enabled) {
      if (!next.workspaceId) throw errorWithStatus("workspace_id_required");
      if (!next.nodeName) throw errorWithStatus("node_name_required");
      if (!next.centralUrl) throw errorWithStatus("central_url_required");
      validateProjectRoots(next, { requirePaths: true });
    } else if (next.projectRoot) {
      validateProjectRoots(next, { requirePaths: true });
    }
    return next;
  }

  function normalizeProjectType(value, workspace = {}) {
    const text = compactOneLine(value || workspace.projectType || workspace.type || workspace.kind || DEFAULT_PROJECT_TYPE)
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, "_")
      .slice(0, 80);
    return text || DEFAULT_PROJECT_TYPE;
  }

  function stateWithoutLegacyCredentialIssues(state = readState()) {
    return Object.assign({}, state, {
      issueCodes: boundedIssueCodes((state.issueCodes || []).filter((code) => code !== "enrollment_token_required")),
      diagnostics: normalizeDiagnostics((state.diagnostics || []).filter((entry) => entry && entry.code !== "enrollment_token_required")),
    });
  }

  function enableWorkspace(input = {}) {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const current = readSettings();
    const workspace = source.workspace && typeof source.workspace === "object" && !Array.isArray(source.workspace)
      ? source.workspace
      : source;
    const centralUrl = compactOneLine(source.centralUrl || current.centralUrl);
    if (!centralUrl) throw errorWithStatus("central_url_required");
    const identity = workspaceIdentity(pathModule, workspace);
    const next = normalizeSettings({
      enabled: true,
      workspaceKind: WORKSPACE_KIND,
      workspaceId: identity.workspaceId,
      nodeName: identity.nodeName,
      centralUrl,
      projectRoot: identity.projectRoot,
      allowedRoot: identity.allowedRoot,
      projectType: normalizeProjectType(source.projectType, workspace),
      enrollmentTokenRef: compactOneLine(source.enrollmentTokenRef || current.enrollmentTokenRef || "local_secret_entry"),
      enrollmentToken: source.enrollmentToken,
      connectionMode: DEFAULT_CONNECTION_MODE,
      roles: DEFAULT_ROLES,
      capabilities: DEFAULT_CAPABILITIES,
    }, current);
    if (Object.prototype.hasOwnProperty.call(source, "enrollmentToken")) {
      const token = compactOneLine(source.enrollmentToken);
      if (token) writeEnrollmentToken(token);
    }
    const saved = writeSettings(next);
    const state = withoutIssueCodes(readState(), GENERATED_WORKSPACE_CONFIG_ISSUES);
    const credentialConfigured = Boolean(readEnrollmentToken(saved));
    writeState(Object.assign({}, stateWithoutLegacyCredentialIssues(state), {
      connectionStatus: "disconnected",
      pairingStatus: credentialConfigured ? "approved" : "unconfigured",
      pairingRequestId: "",
      pairingRequestedAt: "",
      pairingApprovedAt: credentialConfigured ? nowIso(now) : "",
      pairingRejectedAt: "",
      pairingRejectionReason: "",
      lastPairingCheckAt: "",
      consecutiveFailures: 0,
      nextRetryAt: "",
    }));
    return publicSettings();
  }

  function disableWorkspace(input = {}) {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const current = readSettings();
    const requestedRoot = compactOneLine(source.cwd || source.projectRoot || source.path);
    if (requestedRoot) {
      const requested = pathModule.resolve(requestedRoot);
      const active = current.projectRoot ? pathModule.resolve(current.projectRoot) : "";
      if (active && requested !== active) return publicSettings();
    }
    const saved = writeSettings(Object.assign({}, current, { enabled: false }));
    writeState(Object.assign({}, readState(), {
      connectionStatus: "disconnected",
      activeTaskCardId: "",
      activeLocalThreadId: "",
      activeLocalTurnId: "",
      activeTaskCardStartedAt: "",
      issueCodes: [],
      diagnostics: [],
      consecutiveFailures: 0,
      nextRetryAt: "",
    }));
    return publicSettings(saved);
  }

  function saveSettings(input = {}) {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const next = normalizeSettings(source);
    if (Object.prototype.hasOwnProperty.call(source, "enrollmentToken")) {
      const token = compactOneLine(source.enrollmentToken);
      if (token) writeEnrollmentToken(token);
    }
    if (Object.prototype.hasOwnProperty.call(source, "scopedCredential")) {
      const credential = compactOneLine(source.scopedCredential);
      if (credential) writeScopedCredential(credential);
    }
    if (source.clearEnrollmentToken === true) clearEnrollmentToken();
    if (source.clearScopedCredential === true) clearEnrollmentToken();
    const saved = writeSettings(next);
    const state = readState();
    if (!saved.enabled) {
      writeState(Object.assign({}, state, {
        connectionStatus: "disconnected",
        pairingStatus: readEnrollmentToken(saved) ? "approved" : "unconfigured",
        issueCodes: [],
        diagnostics: [],
        consecutiveFailures: 0,
        nextRetryAt: "",
      }));
    } else if (readEnrollmentToken(saved) && ((state.issueCodes || []).includes("enrollment_token_required") || state.pairingStatus === "unconfigured")) {
      writeState(Object.assign({}, stateWithoutLegacyCredentialIssues(state), {
        connectionStatus: state.connectionStatus === "auth_failed" ? "disconnected" : state.connectionStatus,
        pairingStatus: state.pairingStatus === "connected" ? "connected" : "approved",
        pairingApprovedAt: state.pairingApprovedAt || nowIso(now),
      }));
    }
    return publicSettings(saved);
  }

  function configForClient(options = {}) {
    const settings = normalizeSettings(readSettings());
    const token = readEnrollmentToken(settings);
    if (options.requireEnabled !== false && !settings.enabled) throw errorWithStatus("remote_managed_workspace_disabled", 409);
    if (options.requireToken !== false && !token) throw errorWithStatus("scoped_node_credential_unavailable", 409);
    const roots = validateProjectRoots(settings, { requirePaths: true });
    return Object.assign({}, settings, {
      allowedRoots: [roots.allowedRoot],
      projectRoot: roots.projectRoot,
      enrollmentToken: token,
      scopedCredential: token,
      projectRootEvidence: roots.evidence,
    });
  }

  function configForPairingIntent(options = {}) {
    const settings = normalizeSettings(readSettings());
    if (options.requireEnabled !== false && !settings.enabled) throw errorWithStatus("remote_managed_workspace_disabled", 409);
    const roots = validateProjectRoots(settings, { requirePaths: true });
    return Object.assign({}, settings, {
      allowedRoots: [roots.allowedRoot],
      projectRoot: roots.projectRoot,
      projectRootLabel: pathModule.basename(roots.projectRoot) || "workspace",
      projectRootEvidence: roots.evidence,
    });
  }

  function applyPairingResult(result = {}) {
    const source = result && typeof result === "object" && !Array.isArray(result)
      ? (result.pairing || result.registration || result)
      : {};
    const current = readState();
    const timestamp = nowIso(now);
    const requestId = compactOneLine(
      source.requestId
      || source.pairingRequestId
      || result.requestId
      || result.pairingRequestId
      || current.pairingRequestId,
    ).slice(0, 180);
    const credential = compactOneLine(
      source.scopedCredential
      || source.nodeCredential
      || source.credential
      || result.scopedCredential
      || result.nodeCredential
      || result.credential,
    );
    if (credential) writeScopedCredential(credential);
    const rawStatus = source.status || result.status || "";
    const normalized = credential ? "approved" : normalizePairingStatus(rawStatus || "pending_approval");
    const reason = compactOneLine(
      source.reason
      || source.rejectionReason
      || result.reason
      || result.rejectionReason,
    ).slice(0, 240);
    const next = Object.assign({}, stateWithoutLegacyCredentialIssues(current), {
      pairingStatus: normalized,
      pairingRequestId: requestId,
      lastPairingCheckAt: timestamp,
    });
    if (normalized === "pending_approval" || normalized === "requesting_pairing") {
      next.connectionStatus = "connecting";
      next.pairingRequestedAt = next.pairingRequestedAt || timestamp;
      next.pairingApprovedAt = "";
      next.pairingRejectedAt = "";
      next.pairingRejectionReason = "";
    } else if (normalized === "approved") {
      next.connectionStatus = current.connectionStatus === "connected" ? "connected" : "connecting";
      next.pairingApprovedAt = next.pairingApprovedAt || timestamp;
      next.pairingRejectedAt = "";
      next.pairingRejectionReason = "";
    } else if (normalized === "rejected") {
      next.connectionStatus = "auth_failed";
      next.pairingRejectedAt = timestamp;
      next.pairingRejectionReason = reason || "pairing_rejected";
    } else if (normalized === "auth_failed") {
      next.connectionStatus = "auth_failed";
    } else if (normalized === "offline_retrying") {
      next.connectionStatus = "offline";
    }
    return writeState(next);
  }

  function updateConnectionState(patch = {}) {
    const current = readState();
    const next = Object.assign({}, current, patch || {});
    if (patch.issueCode) {
      next.issueCodes = boundedIssueCodes([...(current.issueCodes || []), patch.issueCode]);
      next.diagnostics = normalizeDiagnostics([...(current.diagnostics || []), {
        code: patch.issueCode,
        status: patch.connectionStatus || current.connectionStatus,
        at: nowIso(now),
      }]);
      delete next.issueCode;
    }
    return writeState(next);
  }

  function rememberIdempotencyKey(key) {
    const text = compactOneLine(key);
    if (!text) return readState();
    const current = readState();
    if (!current.executedIdempotencyKeys.includes(text)) {
      current.executedIdempotencyKeys.push(text);
      current.executedIdempotencyKeys = current.executedIdempotencyKeys.slice(-200);
    }
    return writeState(current);
  }

  function queueTerminalReturn(entry = {}) {
    const current = readState();
    current.queuedTerminalReturns.push({
      workspaceId: compactOneLine(entry.workspaceId).slice(0, 180),
      taskCardId: compactOneLine(entry.taskCardId).slice(0, 180),
      payload: entry.payload && typeof entry.payload === "object" && !Array.isArray(entry.payload) ? entry.payload : {},
      queuedAt: nowIso(now),
    });
    current.queuedTerminalReturns = current.queuedTerminalReturns.slice(-20);
    return writeState(current);
  }

  function replaceQueuedTerminalReturns(entries = []) {
    const current = readState();
    current.queuedTerminalReturns = Array.isArray(entries) ? entries.slice(-20) : [];
    return writeState(current);
  }

  function publicSettings(settings = readSettings(), state = readState()) {
    const tokenConfigured = Boolean(readEnrollmentToken(settings));
    const effectiveMode = EFFECTIVE_CONNECTION_MODE;
    const pairingStatus = tokenConfigured && state.pairingStatus === "unconfigured"
      ? "approved"
      : normalizePairingStatus(state.pairingStatus);
    return {
      enabled: Boolean(settings.enabled),
      workspaceKind: settings.workspaceKind || WORKSPACE_KIND,
      workspaceId: settings.workspaceId || "",
      nodeName: settings.nodeName || "",
      centralUrl: settings.centralUrl || "",
      projectRoot: settings.projectRoot || "",
      allowedRoot: settings.allowedRoot || "",
      projectType: settings.projectType || DEFAULT_PROJECT_TYPE,
      connectionMode: settings.connectionMode || DEFAULT_CONNECTION_MODE,
      effectiveConnectionMode: effectiveMode,
      persistentSession: settings.connectionMode === "persistent" ? "fallback_http_polling" : "not_requested",
      fallbackReason: settings.connectionMode === "persistent" ? "home_ai_persistent_endpoint_unavailable" : "",
      roles: Array.isArray(settings.roles) ? settings.roles.slice() : DEFAULT_ROLES.slice(),
      capabilities: Array.isArray(settings.capabilities) ? settings.capabilities.slice() : DEFAULT_CAPABILITIES.slice(),
      reasoningFloorByRole: { external_project_main: "xhigh" },
      scopedCredentialConfigured: tokenConfigured,
      scopedCredentialRef: settings.enrollmentTokenRef || (tokenConfigured ? "local_secret_entry" : ""),
      scopedCredentialPreview: tokenConfigured ? SECRET_PREVIEW : "",
      enrollmentTokenConfigured: tokenConfigured,
      enrollmentTokenRef: settings.enrollmentTokenRef || (tokenConfigured ? "local_secret_entry" : ""),
      enrollmentTokenPreview: tokenConfigured ? SECRET_PREVIEW : "",
      connectionStatus: normalizeStatus(state.connectionStatus),
      pairingStatus,
      pairingRequestId: state.pairingRequestId || "",
      pairingRequestedAt: state.pairingRequestedAt || "",
      pairingApprovedAt: state.pairingApprovedAt || "",
      pairingRejectedAt: state.pairingRejectedAt || "",
      pairingRejectionReason: state.pairingRejectionReason || "",
      lastPairingCheckAt: state.lastPairingCheckAt || "",
      activeTaskCardId: state.activeTaskCardId || "",
      activeLocalThreadId: state.activeLocalThreadId || "",
      activeLocalTurnId: state.activeLocalTurnId || "",
      activeTaskCardStartedAt: state.activeTaskCardStartedAt || "",
      lastHeartbeatAt: state.lastHeartbeatAt || "",
      lastPollAt: state.lastPollAt || "",
      lastTaskCardId: state.lastTaskCardId || "",
      lastLocalThreadId: state.lastLocalThreadId || "",
      lastLocalTurnId: state.lastLocalTurnId || "",
      lastReturnStatus: state.lastReturnStatus || "",
      lastExecutionBridgeStatus: state.lastExecutionBridgeStatus || "",
      lastRegisterAt: state.lastRegisterAt || "",
      lastConnectionCheckAt: state.lastConnectionCheckAt || "",
      issueCodes: boundedIssueCodes(state.issueCodes),
      diagnostics: normalizeDiagnostics(state.diagnostics),
      queuedTerminalReturnCount: Array.isArray(state.queuedTerminalReturns) ? state.queuedTerminalReturns.length : 0,
      source: settings.updatedAt ? "runtime" : "default",
      updatedAt: settings.updatedAt || "",
    };
  }

  return {
    applyPairingResult,
    configForClient,
    configForPairingIntent,
    disableWorkspace,
    enableWorkspace,
    publicSettings,
    queueTerminalReturn,
    readEnrollmentToken,
    readSettings,
    readState,
    rememberIdempotencyKey,
    replaceQueuedTerminalReturns,
    saveSettings,
    updateConnectionState,
    validateProjectRoots,
    writeState,
  };
}

module.exports = {
  DEFAULT_CAPABILITIES,
  DEFAULT_CONNECTION_MODE,
  DEFAULT_PROJECT_TYPE,
  EFFECTIVE_CONNECTION_MODE,
  createRemoteManagedWorkspaceSettingsService,
};
