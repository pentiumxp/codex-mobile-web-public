"use strict";

const defaultCrypto = require("node:crypto");
const defaultFs = require("node:fs");
const defaultPath = require("node:path");

const WORKSPACE_KIND = "remote_managed_workspace";
const DEFAULT_CONTRACT_VERSION = "remote-managed-workspace.v1";
const CONTROL_PLANE_OWNER = "home_ai";
const SERVICE_MODE = "codex_mobile_local_home_ai_central_simulator";
const DEFAULT_ROLES = [
  "external_project_main",
  "external_project_worker",
  "external_project_audit",
  "external_project_deploy",
];
const RETURN_STATUSES = new Set(["completed", "blocked", "redirected", "rejected", "partially_completed"]);
const ESCALATION_REASONS = new Set([
  "high_risk",
  "blocked",
  "architecture",
  "security",
  "deploy",
  "out_of_bounds_file_access",
  "repeated_failure",
]);
const FORBIDDEN_KEY_PATTERN = /(?:secret|password|passwd|token|cookie|launch|oauth|authorization|access[_-]?key|provider[_-]?payload|private[_-]?(?:thread|message|record)|endpoint[_-]?bod(?:y|ies)|raw[_-]?(?:log|logs|cache|task|thread|body)|rawLogs|screenshot|prompt|attachment[_-]?bytes|database[_-]?row|db[_-]?row|provider[_-]?bod(?:y|ies))/i;
const FORBIDDEN_STRING_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]{12,}/i,
  /\bsk-[A-Za-z0-9_-]{16,}/i,
  /\bcpl_[A-Za-z0-9_-]{16,}/,
  /\bcps_[A-Za-z0-9_-]{16,}/,
  /\b(?:cookie|token|access[_-]?key|oauth|authorization)\s*[:=]/i,
  /\bprovider[_-]?payload\b/i,
  /\bprivate[_-]?(?:thread|message|record)\b/i,
  /\braw[_-]?(?:log|cache|task|thread|body)\b/i,
  /\bendpoint[_-]?bod(?:y|ies)\b/i,
  /^data:image\//i,
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

function safeId(value, fieldName, maxLength = 180) {
  const text = compactOneLine(value);
  if (!text) throw errorWithStatus(`${fieldName}_required`);
  if (!/^[A-Za-z0-9._:@-]+$/.test(text)) throw errorWithStatus(`${fieldName}_invalid`);
  return text.slice(0, maxLength);
}

function boundedString(value, fieldName, maxLength = 500, required = false) {
  const text = compactOneLine(value);
  if (required && !text) throw errorWithStatus(`${fieldName}_required`);
  assertSafeString(text, fieldName);
  return text.length > maxLength ? text.slice(0, maxLength).trimEnd() : text;
}

function boundedStringList(value, fieldName, options = {}) {
  const maxItems = options.maxItems || 24;
  const maxLength = options.maxLength || 120;
  const required = options.required === true;
  const source = Array.isArray(value) ? value : (value ? [value] : []);
  if (required && source.length === 0) throw errorWithStatus(`${fieldName}_required`);
  const out = [];
  for (const entry of source.slice(0, maxItems)) {
    const text = boundedString(entry, fieldName, maxLength, false);
    if (text && !out.includes(text)) out.push(text);
  }
  if (required && out.length === 0) throw errorWithStatus(`${fieldName}_required`);
  return out;
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

function assertSafeString(value, fieldName = "value") {
  const text = String(value || "");
  if (text.length > 8000) throw errorWithStatus(`${fieldName}_too_large`);
  for (const pattern of FORBIDDEN_STRING_PATTERNS) {
    if (pattern.test(text)) throw errorWithStatus(`${fieldName}_contains_forbidden_payload`);
  }
}

function assertNoForbiddenPayloadClasses(value, fieldName = "payload", depth = 0) {
  if (depth > 8) throw errorWithStatus(`${fieldName}_too_deep`);
  if (value == null) return;
  if (typeof value === "string") {
    assertSafeString(value, fieldName);
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") return;
  if (Array.isArray(value)) {
    if (value.length > 80) throw errorWithStatus(`${fieldName}_too_many_items`);
    value.forEach((entry, index) => assertNoForbiddenPayloadClasses(entry, `${fieldName}_${index}`, depth + 1));
    return;
  }
  if (typeof value !== "object") return;
  const entries = Object.entries(value);
  if (entries.length > 80) throw errorWithStatus(`${fieldName}_too_many_fields`);
  for (const [key, entry] of entries) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) throw errorWithStatus(`${fieldName}_${key}_forbidden`);
    assertNoForbiddenPayloadClasses(entry, `${fieldName}_${key}`, depth + 1);
  }
}

function normalizeRelativePath(value, fieldName) {
  const text = boundedString(value, fieldName, 240, true).replace(/\\/g, "/");
  if (text.startsWith("/") || text.includes("../") || text === ".." || text.includes("\0")) {
    throw errorWithStatus(`${fieldName}_must_be_relative`);
  }
  return text;
}

function normalizeStatus(value, fieldName, allowed = ["ok", "warning", "failed", "unknown"]) {
  const text = compactOneLine(value).toLowerCase();
  if (!text) return "unknown";
  if (!allowed.includes(text)) throw errorWithStatus(`${fieldName}_invalid`);
  return text;
}

function stableHash(cryptoModule, value) {
  return cryptoModule.createHash("sha256").update(String(value || "")).digest("hex");
}

function normalizeTokenList(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(/[\n,]+/);
  return source.map((entry) => String(entry || "").trim()).filter(Boolean);
}

function safeStateFileWrite(fs, pathModule, file, state) {
  if (!file) return;
  const dir = pathModule.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

function blankState() {
  return {
    version: 1,
    workspaces: {},
    pairingRequests: {},
    taskCards: {},
    dailySummaries: [],
    escalations: [],
    updatedAt: "",
  };
}

function normalizeProjectRootEvidence(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    exists: source.exists === true,
    withinAllowedRoot: source.withinAllowedRoot === true,
    checkedBy: boundedString(source.checkedBy || "remote_node", "project_root_evidence_checked_by", 80, false) || "remote_node",
  };
}

function publicWorkspace(row = {}) {
  return {
    workspaceId: row.workspaceId || "",
    workspaceKind: row.workspaceKind || WORKSPACE_KIND,
    controlPlaneOwner: CONTROL_PLANE_OWNER,
    serviceMode: SERVICE_MODE,
    projectType: row.projectType || "",
    projectRoot: row.projectRoot || "",
    centralUrl: row.centralUrl || "",
    nodeId: row.nodeId || "",
    nodeName: row.nodeName || "",
    contractVersion: row.contractVersion || DEFAULT_CONTRACT_VERSION,
    roles: Array.isArray(row.roles) ? row.roles.slice() : [],
    capabilities: Array.isArray(row.capabilities) ? row.capabilities.slice() : [],
    status: row.status || "registered",
    registeredAt: row.registeredAt || "",
    lastHeartbeatAt: row.lastHeartbeatAt || "",
    projectRootEvidence: Object.assign({}, row.projectRootEvidence || {}),
  };
}

function publicPairingRequest(row = {}) {
  return {
    requestId: row.requestId || "",
    workspaceId: row.workspaceId || "",
    workspaceKind: row.workspaceKind || WORKSPACE_KIND,
    controlPlaneOwner: CONTROL_PLANE_OWNER,
    serviceMode: SERVICE_MODE,
    projectType: row.projectType || "",
    projectRootLabel: row.projectRootLabel || "",
    centralUrl: row.centralUrl || "",
    nodeId: row.nodeId || "",
    nodeName: row.nodeName || "",
    contractVersion: row.contractVersion || DEFAULT_CONTRACT_VERSION,
    roles: Array.isArray(row.roles) ? row.roles.slice() : [],
    capabilities: Array.isArray(row.capabilities) ? row.capabilities.slice() : [],
    status: row.status || "pending_approval",
    reason: row.reason || "",
    requestedAt: row.requestedAt || "",
    approvedAt: row.approvedAt || "",
    rejectedAt: row.rejectedAt || "",
    updatedAt: row.updatedAt || "",
  };
}

function publicTaskCard(card = {}) {
  return {
    taskCardId: card.taskCardId || "",
    id: card.taskCardId || "",
    idempotencyKey: card.idempotencyKey || "",
    title: card.title || "",
    summary: card.summary || "",
    bodyMarkdown: card.bodyMarkdown || "",
    status: card.status || "queued",
    terminalStatus: card.terminalStatus || "",
    reasoningEffort: card.reasoningEffort || "",
    locale: card.locale || "zh-CN",
    executionLease: Object.assign({}, card.executionLease || {}),
    createdAt: card.createdAt || "",
    updatedAt: card.updatedAt || "",
  };
}

function createRemoteManagedWorkspaceService(dependencies = {}) {
  const fs = dependencies.fs || defaultFs;
  const pathModule = dependencies.path || defaultPath;
  const cryptoModule = dependencies.crypto || defaultCrypto;
  const now = dependencies.now || Date.now;
  const stateFile = compactOneLine(dependencies.stateFile || "");
  const requireEnrollmentToken = dependencies.requireEnrollmentToken !== false;
  const enrollmentTokens = normalizeTokenList(dependencies.enrollmentTokens || dependencies.enrollmentToken || "");
  const authorizedCredentials = new Set(enrollmentTokens);
  const pairingCredentialsByRequestId = new Map();
  let state = null;

  function loadState() {
    if (state) return state;
    if (!stateFile) {
      state = blankState();
      return state;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      state = Object.assign(blankState(), parsed && typeof parsed === "object" ? parsed : {});
      state.workspaces = state.workspaces && typeof state.workspaces === "object" ? state.workspaces : {};
      state.pairingRequests = state.pairingRequests && typeof state.pairingRequests === "object" ? state.pairingRequests : {};
      state.taskCards = state.taskCards && typeof state.taskCards === "object" ? state.taskCards : {};
      state.dailySummaries = Array.isArray(state.dailySummaries) ? state.dailySummaries : [];
      state.escalations = Array.isArray(state.escalations) ? state.escalations : [];
    } catch (_) {
      state = blankState();
    }
    return state;
  }

  function persist() {
    const loaded = loadState();
    loaded.updatedAt = nowIso(now);
    safeStateFileWrite(fs, pathModule, stateFile, loaded);
  }

  function assertAuthorized(token) {
    if (!requireEnrollmentToken) return true;
    const supplied = compactOneLine(token);
    if (authorizedCredentials.size === 0) throw errorWithStatus("remote_managed_workspace_enrollment_token_unconfigured", 503);
    if (!supplied) throw errorWithStatus("remote_managed_workspace_enrollment_token_required", 401);
    const allowed = Array.from(authorizedCredentials).some((entry) => {
      try {
        const left = Buffer.from(entry);
        const right = Buffer.from(supplied);
        return left.length === right.length && cryptoModule.timingSafeEqual(left, right);
      } catch (_) {
        return false;
      }
    });
    if (!allowed) throw errorWithStatus("remote_managed_workspace_enrollment_token_invalid", 403);
    return true;
  }

  function normalizePairingRequest(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw errorWithStatus("remote_managed_workspace_pairing_request_must_be_object");
    }
    const workspaceId = safeId(input.workspaceId, "workspace_id");
    const workspaceKind = compactOneLine(input.workspaceKind || WORKSPACE_KIND);
    if (workspaceKind !== WORKSPACE_KIND) throw errorWithStatus("workspace_kind_invalid");
    const roles = boundedStringList(input.roles || DEFAULT_ROLES, "roles", { maxItems: 12, maxLength: 80, required: true });
    if (!roles.includes("external_project_main")) throw errorWithStatus("external_project_main_role_required");
    return {
      workspaceId,
      workspaceKind,
      projectType: boundedString(input.projectType, "project_type", 80, true),
      projectRootLabel: boundedString(input.projectRootLabel || input.projectLabel || "workspace", "project_root_label", 120, true),
      centralUrl: normalizeUrl(input.centralUrl, "central_url"),
      nodeId: boundedString(input.nodeId || "", "node_id", 120, false),
      nodeName: boundedString(input.nodeName, "node_name", 120, true),
      contractVersion: boundedString(input.contractVersion || DEFAULT_CONTRACT_VERSION, "contract_version", 80, true),
      roles,
      capabilities: boundedStringList(input.capabilities || [], "capabilities", { maxItems: 24, maxLength: 100 }),
      projectRootEvidence: normalizeProjectRootEvidence(input.projectRootEvidence || {}),
    };
  }

  function requestPairing(input = {}) {
    const config = normalizePairingRequest(input);
    assertNoForbiddenPayloadClasses({
      workspaceId: config.workspaceId,
      workspaceKind: config.workspaceKind,
      projectType: config.projectType,
      projectRootLabel: config.projectRootLabel,
      centralUrl: config.centralUrl,
      nodeId: config.nodeId,
      nodeName: config.nodeName,
      contractVersion: config.contractVersion,
      roles: config.roles,
      capabilities: config.capabilities,
      projectRootEvidence: config.projectRootEvidence,
    }, "pairing_request");
    const loaded = loadState();
    const existing = Object.values(loaded.pairingRequests || {}).find((row) => row
      && row.workspaceId === config.workspaceId
      && row.nodeName === config.nodeName
      && row.status !== "rejected");
    if (existing) {
      const pairing = publicPairingRequest(existing);
      const credential = pairingCredentialsByRequestId.get(existing.requestId);
      if (existing.status === "approved" && credential) pairing.scopedCredential = credential;
      return { ok: true, duplicate: true, pairing };
    }
    const timestamp = nowIso(now);
    const requestId = `rmw_pair_${stableHash(cryptoModule, `${config.workspaceId}:${config.nodeName}:${timestamp}`).slice(0, 18)}`;
    const row = Object.assign({}, config, {
      requestId,
      status: "pending_approval",
      reason: "",
      requestedAt: timestamp,
      approvedAt: "",
      rejectedAt: "",
      updatedAt: timestamp,
    });
    loaded.pairingRequests[requestId] = row;
    persist();
    return { ok: true, duplicate: false, pairing: publicPairingRequest(row) };
  }

  function pairingStatus(requestId) {
    const id = safeId(requestId, "pairing_request_id");
    const row = loadState().pairingRequests[id];
    if (!row) throw errorWithStatus("remote_managed_workspace_pairing_request_not_found", 404);
    const pairing = publicPairingRequest(row);
    const credential = pairingCredentialsByRequestId.get(id);
    if (row.status === "approved" && credential) {
      pairing.scopedCredential = credential;
    }
    return { ok: true, pairing };
  }

  function approvePairing(requestId, input = {}) {
    const id = safeId(requestId, "pairing_request_id");
    const loaded = loadState();
    const row = loaded.pairingRequests[id];
    if (!row) throw errorWithStatus("remote_managed_workspace_pairing_request_not_found", 404);
    const timestamp = nowIso(now);
    const scopedCredential = compactOneLine(input.scopedCredential)
      || `rmw_scoped_${stableHash(cryptoModule, `${id}:${row.workspaceId}:${timestamp}`).slice(0, 32)}`;
    authorizedCredentials.add(scopedCredential);
    pairingCredentialsByRequestId.set(id, scopedCredential);
    row.status = "approved";
    row.reason = "";
    row.approvedAt = row.approvedAt || timestamp;
    row.rejectedAt = "";
    row.updatedAt = timestamp;
    row.credentialHash = stableHash(cryptoModule, scopedCredential);
    loaded.pairingRequests[id] = row;
    persist();
    return { ok: true, pairing: Object.assign(publicPairingRequest(row), { scopedCredential }) };
  }

  function rejectPairing(requestId, input = {}) {
    const id = safeId(requestId, "pairing_request_id");
    const loaded = loadState();
    const row = loaded.pairingRequests[id];
    if (!row) throw errorWithStatus("remote_managed_workspace_pairing_request_not_found", 404);
    const timestamp = nowIso(now);
    row.status = "rejected";
    row.reason = boundedString(input.reason || "owner_rejected", "pairing_rejection_reason", 240, false) || "owner_rejected";
    row.rejectedAt = row.rejectedAt || timestamp;
    row.approvedAt = "";
    row.updatedAt = timestamp;
    pairingCredentialsByRequestId.delete(id);
    loaded.pairingRequests[id] = row;
    persist();
    return { ok: true, pairing: publicPairingRequest(row) };
  }

  function normalizeRegistration(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw errorWithStatus("remote_managed_workspace_registration_must_be_object");
    }
    const workspaceId = safeId(input.workspaceId, "workspace_id");
    const workspaceKind = compactOneLine(input.workspaceKind || WORKSPACE_KIND);
    if (workspaceKind !== WORKSPACE_KIND) throw errorWithStatus("workspace_kind_invalid");
    const roles = boundedStringList(input.roles || DEFAULT_ROLES, "roles", { maxItems: 12, maxLength: 80, required: true });
    if (!roles.includes("external_project_main")) throw errorWithStatus("external_project_main_role_required");
    const projectRootEvidence = normalizeProjectRootEvidence(input.projectRootEvidence || input.projectRootValidation || {});
    if (input.projectRootEvidence || input.projectRootValidation) {
      if (!projectRootEvidence.exists) throw errorWithStatus("project_root_not_found");
      if (!projectRootEvidence.withinAllowedRoot) throw errorWithStatus("project_root_outside_allowed_root");
    }
    return {
      workspaceId,
      workspaceKind,
      projectType: boundedString(input.projectType, "project_type", 80, true),
      projectRoot: boundedString(input.projectRoot, "project_root", 500, true),
      centralUrl: normalizeUrl(input.centralUrl, "central_url"),
      nodeName: boundedString(input.nodeName, "node_name", 120, true),
      contractVersion: boundedString(input.contractVersion || DEFAULT_CONTRACT_VERSION, "contract_version", 80, true),
      roles,
      capabilities: boundedStringList(input.capabilities || [], "capabilities", { maxItems: 24, maxLength: 100 }),
      projectRootEvidence,
    };
  }

  function register(input = {}, options = {}) {
    assertAuthorized(options.token);
    const config = normalizeRegistration(input);
    assertNoForbiddenPayloadClasses({
      workspaceId: config.workspaceId,
      workspaceKind: config.workspaceKind,
      projectType: config.projectType,
      projectRoot: config.projectRoot,
      centralUrl: config.centralUrl,
      nodeName: config.nodeName,
      contractVersion: config.contractVersion,
      roles: config.roles,
      capabilities: config.capabilities,
      projectRootEvidence: config.projectRootEvidence,
    }, "registration");
    const loaded = loadState();
    const existing = loaded.workspaces[config.workspaceId] || {};
    const timestamp = nowIso(now);
    const nodeId = existing.nodeId || `rmn_${stableHash(cryptoModule, `${config.workspaceId}:${config.nodeName}`).slice(0, 20)}`;
    const row = Object.assign({}, existing, config, {
      nodeId,
      status: "registered",
      registeredAt: existing.registeredAt || timestamp,
      updatedAt: timestamp,
    });
    loaded.workspaces[config.workspaceId] = row;
    if (!Array.isArray(loaded.taskCards[config.workspaceId])) loaded.taskCards[config.workspaceId] = [];
    persist();
    return {
      ok: true,
      workspace: publicWorkspace(row),
      node: {
        nodeId,
        nodeName: row.nodeName,
        status: row.status,
        registeredAt: row.registeredAt,
      },
    };
  }

  function workspaceFor(workspaceId) {
    const id = safeId(workspaceId, "workspace_id");
    const row = loadState().workspaces[id];
    if (!row) throw errorWithStatus("remote_managed_workspace_not_registered", 404);
    return row;
  }

  function nodeHeartbeat(workspaceId, input = {}, options = {}) {
    assertAuthorized(options.token);
    const loaded = loadState();
    const row = workspaceFor(workspaceId);
    assertNoForbiddenPayloadClasses(input, "node_heartbeat");
    const timestamp = nowIso(now);
    row.status = "active";
    row.lastHeartbeatAt = timestamp;
    row.nodeStatus = {
      status: normalizeStatus(input.status, "node_status", ["active", "idle", "busy", "degraded", "offline", "unknown"]),
      activeTaskCardCount: Math.max(0, Math.min(20, Number(input.activeTaskCardCount || 0) || 0)),
      capabilities: boundedStringList(input.capabilities || row.capabilities || [], "node_heartbeat_capabilities", { maxItems: 24, maxLength: 100 }),
      updatedAt: timestamp,
    };
    loaded.workspaces[row.workspaceId] = row;
    persist();
    return { ok: true, workspace: publicWorkspace(row), nodeStatus: row.nodeStatus };
  }

  function normalizeTaskCard(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw errorWithStatus("task_card_must_be_object");
    const taskCardId = compactOneLine(input.taskCardId || input.id) || `ttc_remote_${stableHash(cryptoModule, `${Date.now()}:${Math.random()}`).slice(0, 18)}`;
    safeId(taskCardId, "task_card_id");
    const card = {
      taskCardId,
      idempotencyKey: boundedString(input.idempotencyKey || input.requestId || "", "task_card_idempotency_key", 180, false),
      title: boundedString(input.title, "task_card_title", 180, true),
      summary: boundedString(input.summary, "task_card_summary", 500, false),
      bodyMarkdown: boundedString(input.bodyMarkdown || input.body || "", "task_card_body_markdown", 4000, false),
      reasoningEffort: boundedString(input.reasoningEffort || "medium", "task_card_reasoning_effort", 20, false) || "medium",
      locale: "zh-CN",
    };
    assertNoForbiddenPayloadClasses({
      taskCardId: card.taskCardId,
      idempotencyKey: card.idempotencyKey,
      title: card.title,
      summary: card.summary,
      bodyMarkdown: card.bodyMarkdown,
      reasoningEffort: card.reasoningEffort,
      locale: card.locale,
    }, "task_card");
    return card;
  }

  function enqueueTaskCard(workspaceId, input = {}, options = {}) {
    if (options.skipAuth !== true) assertAuthorized(options.token);
    const loaded = loadState();
    const row = workspaceFor(workspaceId);
    const cards = loaded.taskCards[row.workspaceId] || [];
    const normalized = normalizeTaskCard(input);
    const existing = normalized.idempotencyKey
      ? cards.find((card) => card.idempotencyKey && card.idempotencyKey === normalized.idempotencyKey)
      : cards.find((card) => card.taskCardId === normalized.taskCardId);
    if (existing) {
      return { ok: true, duplicate: true, card: publicTaskCard(existing) };
    }
    const timestamp = nowIso(now);
    const card = Object.assign({}, normalized, {
      status: "queued",
      terminalStatus: "",
      executionLease: {
        status: "queued",
        leaseId: "",
        nodeId: row.nodeId || "",
        ackedAt: "",
        lastHeartbeatAt: "",
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    cards.push(card);
    loaded.taskCards[row.workspaceId] = cards;
    persist();
    return { ok: true, duplicate: false, card: publicTaskCard(card) };
  }

  function cardsFor(workspaceId) {
    const row = workspaceFor(workspaceId);
    const loaded = loadState();
    if (!Array.isArray(loaded.taskCards[row.workspaceId])) loaded.taskCards[row.workspaceId] = [];
    return { row, cards: loaded.taskCards[row.workspaceId] };
  }

  function pollTaskCards(workspaceId, input = {}, options = {}) {
    assertAuthorized(options.token);
    assertNoForbiddenPayloadClasses(input, "task_card_poll");
    const { row, cards } = cardsFor(workspaceId);
    const limit = Math.max(1, Math.min(10, Number(input.limit || 4) || 4));
    const active = cards
      .filter((card) => !card.terminalStatus && (card.status === "queued" || card.status === "acked" || card.status === "active"))
      .slice(0, limit)
      .map(publicTaskCard);
    return {
      ok: true,
      workspace: publicWorkspace(row),
      cards: active,
      count: active.length,
    };
  }

  function taskCardFor(workspaceId, taskCardId) {
    const { row, cards } = cardsFor(workspaceId);
    const id = safeId(taskCardId, "task_card_id");
    const card = cards.find((entry) => entry.taskCardId === id);
    if (!card) throw errorWithStatus("remote_managed_workspace_task_card_not_found", 404);
    return { row, card };
  }

  function ackTaskCard(workspaceId, taskCardId, input = {}, options = {}) {
    assertAuthorized(options.token);
    assertNoForbiddenPayloadClasses(input, "task_card_ack");
    const { row, card } = taskCardFor(workspaceId, taskCardId);
    if (!card.terminalStatus) {
      const timestamp = nowIso(now);
      card.status = card.status === "active" ? "active" : "acked";
      card.executionLease = Object.assign({}, card.executionLease || {}, {
        status: card.status,
        leaseId: boundedString(input.leaseId || card.executionLease && card.executionLease.leaseId || `lease_${stableHash(cryptoModule, `${card.taskCardId}:${row.nodeId}`).slice(0, 18)}`, "lease_id", 120, false),
        nodeId: row.nodeId || "",
        ackedAt: card.executionLease && card.executionLease.ackedAt || timestamp,
      });
      card.updatedAt = timestamp;
      persist();
    }
    return { ok: true, card: publicTaskCard(card) };
  }

  function heartbeatTaskCard(workspaceId, taskCardId, input = {}, options = {}) {
    assertAuthorized(options.token);
    assertNoForbiddenPayloadClasses(input, "task_card_heartbeat");
    const { row, card } = taskCardFor(workspaceId, taskCardId);
    if (!card.terminalStatus) {
      const timestamp = nowIso(now);
      card.status = "active";
      card.executionLease = Object.assign({}, card.executionLease || {}, {
        status: "active",
        nodeId: row.nodeId || "",
        lastHeartbeatAt: timestamp,
        heartbeatStatus: normalizeStatus(input.status, "task_card_heartbeat_status", ["active", "working", "blocked", "idle", "unknown"]),
      });
      card.updatedAt = timestamp;
      persist();
    }
    return { ok: true, card: publicTaskCard(card) };
  }

  function normalizeReturn(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw errorWithStatus("task_card_return_must_be_object");
    const status = compactOneLine(input.status).toLowerCase();
    if (!RETURN_STATUSES.has(status)) throw errorWithStatus("task_card_return_status_invalid");
    const payload = {
      status,
      title: boundedString(input.title || "", "task_card_return_title", 180, false),
      summary: boundedString(input.summary || "", "task_card_return_summary", 700, false),
      metadata: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata : {},
      locale: "zh-CN",
    };
    assertNoForbiddenPayloadClasses(payload, "task_card_return");
    return payload;
  }

  function returnTaskCard(workspaceId, taskCardId, input = {}, options = {}) {
    assertAuthorized(options.token);
    const { card } = taskCardFor(workspaceId, taskCardId);
    const payload = normalizeReturn(input);
    if (!card.terminalStatus) {
      const timestamp = nowIso(now);
      card.status = "returned";
      card.terminalStatus = payload.status;
      card.terminalReturn = payload;
      card.executionLease = Object.assign({}, card.executionLease || {}, {
        status: "returned",
        completedAt: timestamp,
      });
      card.updatedAt = timestamp;
      persist();
    }
    return { ok: true, card: publicTaskCard(card), terminalReturn: Object.assign({}, card.terminalReturn || payload) };
  }

  function dailySummary(workspaceId, input = {}, options = {}) {
    assertAuthorized(options.token);
    workspaceFor(workspaceId);
    assertNoForbiddenPayloadClasses(input, "daily_summary_input");
    const payload = {
      workspaceId: safeId(workspaceId, "workspace_id"),
      date: boundedString(input.date || nowIso(now).slice(0, 10), "daily_summary_date", 40, true),
      changedFiles: boundedStringList(input.changedFiles || [], "daily_summary_changed_files", { maxItems: 80, maxLength: 240 }).map((entry) => normalizeRelativePath(entry, "daily_summary_changed_file")),
      buildStatus: normalizeStatus(input.buildStatus, "daily_summary_build_status"),
      testStatus: normalizeStatus(input.testStatus, "daily_summary_test_status"),
      previewStatus: normalizeStatus(input.previewStatus, "daily_summary_preview_status"),
      openIdeas: boundedStringList(input.openIdeas || [], "daily_summary_open_ideas", { maxItems: 24, maxLength: 240 }),
      blockers: boundedStringList(input.blockers || [], "daily_summary_blockers", { maxItems: 24, maxLength: 240 }),
      risks: boundedStringList(input.risks || [], "daily_summary_risks", { maxItems: 24, maxLength: 240 }),
      nextFocus: boundedString(input.nextFocus || "", "daily_summary_next_focus", 240, false),
      createdAt: nowIso(now),
    };
    assertNoForbiddenPayloadClasses(payload, "daily_summary");
    const loaded = loadState();
    loaded.dailySummaries.push(payload);
    loaded.dailySummaries = loaded.dailySummaries.slice(-400);
    persist();
    return { ok: true, summary: payload };
  }

  function escalation(workspaceId, input = {}, options = {}) {
    assertAuthorized(options.token);
    workspaceFor(workspaceId);
    assertNoForbiddenPayloadClasses(input, "escalation_input");
    const reason = compactOneLine(input.reason || input.reasonCode || "").toLowerCase();
    if (!ESCALATION_REASONS.has(reason)) throw errorWithStatus("remote_managed_workspace_escalation_reason_invalid");
    const payload = {
      workspaceId: safeId(workspaceId, "workspace_id"),
      reason,
      severity: normalizeStatus(input.severity, "escalation_severity", ["h1", "h2", "h3", "blocked", "warning", "unknown"]),
      title: boundedString(input.title || "", "escalation_title", 180, true),
      summary: boundedString(input.summary || "", "escalation_summary", 700, false),
      blockers: boundedStringList(input.blockers || [], "escalation_blockers", { maxItems: 24, maxLength: 240 }),
      nextStep: boundedString(input.nextStep || "", "escalation_next_step", 240, false),
      createdAt: nowIso(now),
    };
    assertNoForbiddenPayloadClasses(payload, "escalation");
    const loaded = loadState();
    loaded.escalations.push(payload);
    loaded.escalations = loaded.escalations.slice(-400);
    persist();
    return { ok: true, escalation: payload };
  }

  function snapshot() {
    const loaded = loadState();
    const pairingRequests = {};
    for (const [id, row] of Object.entries(loaded.pairingRequests || {})) {
      pairingRequests[id] = publicPairingRequest(row);
    }
    return JSON.parse(JSON.stringify({
      version: loaded.version,
      workspaces: loaded.workspaces,
      pairingRequests,
      taskCards: loaded.taskCards,
      dailySummaries: loaded.dailySummaries,
      escalations: loaded.escalations,
      updatedAt: loaded.updatedAt,
    }));
  }

  return {
    assertAuthorized,
    approvePairing,
    dailySummary,
    enqueueTaskCard,
    escalation,
    heartbeatTaskCard,
    nodeHeartbeat,
    pairingStatus,
    pollTaskCards,
    register,
    rejectPairing,
    requestPairing,
    returnTaskCard,
    ackTaskCard,
    snapshot,
  };
}

module.exports = {
  CONTROL_PLANE_OWNER,
  DEFAULT_ROLES,
  SERVICE_MODE,
  WORKSPACE_KIND,
  assertNoForbiddenPayloadClasses,
  createRemoteManagedWorkspaceService,
};
