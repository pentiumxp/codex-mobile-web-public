"use strict";

const crypto = require("node:crypto");
const defaultFs = require("node:fs");
const defaultPath = require("node:path");

const { DEFAULT_ROLES, WORKSPACE_KIND } = require("./remote-managed-workspace-service");

function compactOneLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

const SCOPED_NODE_CREDENTIAL_INVALID_CODE = "remote_managed_workspace_scoped_node_credential_invalid";
const PAIRING_APPROVAL_REQUIRED_CODE = "remote_managed_workspace_pairing_approval_required";
const SCOPED_NODE_CREDENTIAL_INVALID_ALIASES = new Set([
  SCOPED_NODE_CREDENTIAL_INVALID_CODE,
  "remote_managed_workspace_scoped_node_credential_is_invalid",
]);
const PAIRING_APPROVAL_REQUIRED_ALIASES = new Set([
  PAIRING_APPROVAL_REQUIRED_CODE,
  "remote_managed_workspace_pairing_must_be_approved_before_node_access",
]);
const SCOPED_NODE_CREDENTIAL_INVALID_MESSAGE = "remote managed workspace scoped node credential is invalid";
const PAIRING_APPROVAL_REQUIRED_MESSAGE = "remote managed workspace pairing must be approved before node access";

function compactLower(value) {
  return compactOneLine(value).toLowerCase();
}

function isAuthStatus(statusCode) {
  return Number(statusCode || 0) === 401 || Number(statusCode || 0) === 403;
}

function normalizeRemoteManagedWorkspaceNodeErrorCode(code, options = {}) {
  const text = compactOneLine(code);
  const lower = text.toLowerCase();
  if (SCOPED_NODE_CREDENTIAL_INVALID_ALIASES.has(lower)) return SCOPED_NODE_CREDENTIAL_INVALID_CODE;
  if (PAIRING_APPROVAL_REQUIRED_ALIASES.has(lower)) return PAIRING_APPROVAL_REQUIRED_CODE;
  if (isAuthStatus(options.statusCode)) {
    const responseText = compactLower(options.responseText);
    const payloadMessage = compactLower(options.payloadMessage);
    if (responseText === SCOPED_NODE_CREDENTIAL_INVALID_MESSAGE || payloadMessage === SCOPED_NODE_CREDENTIAL_INVALID_MESSAGE) {
      return SCOPED_NODE_CREDENTIAL_INVALID_CODE;
    }
    if (responseText === PAIRING_APPROVAL_REQUIRED_MESSAGE || payloadMessage === PAIRING_APPROVAL_REQUIRED_MESSAGE) {
      return PAIRING_APPROVAL_REQUIRED_CODE;
    }
  }
  return text;
}

function errorWithStatus(code, statusCode = 400, metadata = {}) {
  const err = new Error(code);
  err.code = code;
  err.statusCode = statusCode;
  if (metadata.originalCode && metadata.originalCode !== code) err.originalCode = metadata.originalCode;
  if (metadata.parseErrorCode) err.parseErrorCode = metadata.parseErrorCode;
  return err;
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

function normalizeStringList(value) {
  const source = Array.isArray(value) ? value : (value ? [value] : []);
  return source.map((entry) => compactOneLine(entry)).filter(Boolean);
}

function stableHash(value, length = 20) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, length);
}

function isPathInside(pathModule, child, parent) {
  const relative = pathModule.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !pathModule.isAbsolute(relative));
}

function validateProjectRoot(input = {}, dependencies = {}) {
  const fs = dependencies.fs || defaultFs;
  const pathModule = dependencies.path || defaultPath;
  const projectRootText = compactOneLine(input.projectRoot);
  if (!projectRootText) throw errorWithStatus("project_root_required");
  const projectRoot = pathModule.resolve(projectRootText);
  const allowedRoots = normalizeStringList(input.allowedRoots || input.allowedProjectRoots)
    .map((entry) => pathModule.resolve(entry));
  if (allowedRoots.length === 0) throw errorWithStatus("allowed_roots_required");
  if (!allowedRoots.some((root) => isPathInside(pathModule, projectRoot, root))) {
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
    evidence: {
      exists: true,
      withinAllowedRoot: true,
      checkedBy: "remote_node",
    },
  };
}

async function readResponsePayload(response) {
  const text = await response.text();
  if (!text) return { payload: {}, rawText: "" };
  try {
    return { payload: JSON.parse(text), rawText: "" };
  } catch (_) {
    return {
      payload: {},
      rawText: text,
      parseErrorCode: "remote_managed_workspace_response_not_json",
    };
  }
}

function errorCodeFromPayload(payload = {}) {
  const directCandidates = [payload.error, payload.code, payload.issueCode, payload.errorCode]
    .map((entry) => compactOneLine(entry))
    .filter(Boolean);
  const issueCodes = Array.isArray(payload.issueCodes) ? payload.issueCodes : [];
  const issueCandidates = issueCodes.map((entry) => compactOneLine(entry)).filter(Boolean);
  const invalidCandidate = [...directCandidates, ...issueCandidates]
    .find((entry) => normalizeRemoteManagedWorkspaceNodeErrorCode(entry) === SCOPED_NODE_CREDENTIAL_INVALID_CODE);
  if (invalidCandidate) return invalidCandidate;
  const pairingApprovalCandidate = [...directCandidates, ...issueCandidates]
    .find((entry) => normalizeRemoteManagedWorkspaceNodeErrorCode(entry) === PAIRING_APPROVAL_REQUIRED_CODE);
  if (pairingApprovalCandidate) return pairingApprovalCandidate;
  return directCandidates[0] || issueCandidates[0] || "";
}

function taskCardIdentity(card = {}) {
  return compactOneLine(card.taskCardId || card.id);
}

function normalizeTaskCardArray(value, fieldName) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw errorWithStatus(`remote_managed_workspace_poll_${fieldName}_invalid`, 502);
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw errorWithStatus(`remote_managed_workspace_poll_${fieldName}_invalid`, 502);
    }
    const id = taskCardIdentity(entry);
    if (!id) throw errorWithStatus("remote_managed_workspace_poll_task_card_id_missing", 502);
    return entry.taskCardId ? entry : Object.assign({}, entry, { taskCardId: id });
  });
}

function normalizePolledTaskCardsPayload(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw errorWithStatus("remote_managed_workspace_poll_payload_invalid", 502);
  }
  const source = payload;
  const canonical = normalizeTaskCardArray(source.taskCards, "task_cards");
  const legacy = normalizeTaskCardArray(source.cards, "cards");
  const seen = new Set();
  const taskCards = [];
  for (const card of [...canonical, ...legacy]) {
    const id = taskCardIdentity(card);
    if (seen.has(id)) continue;
    seen.add(id);
    taskCards.push(card);
  }
  const hasCount = source.count != null;
  const count = hasCount ? Number(source.count) : taskCards.length;
  if (!Number.isInteger(count) || count < 0) {
    throw errorWithStatus("remote_managed_workspace_poll_count_invalid", 502);
  }
  if (count !== taskCards.length) {
    throw errorWithStatus("remote_managed_workspace_poll_count_mismatch", 502);
  }
  return Object.assign({}, source, {
    taskCards,
    cards: taskCards,
    count,
  });
}

function defaultFetch() {
  if (typeof fetch === "function") return fetch;
  throw errorWithStatus("fetch_unavailable", 500);
}

function createRemoteManagedWorkspaceNodeClientService(dependencies = {}) {
  const fs = dependencies.fs || defaultFs;
  const pathModule = dependencies.path || defaultPath;
  const fetchImpl = dependencies.fetch || defaultFetch();
  const executedKeys = new Set(dependencies.executedKeys || []);

  function normalizeConfig(config = {}) {
    const { projectRoot, evidence } = validateProjectRoot(config, { fs, path: pathModule });
    const workspaceId = compactOneLine(config.workspaceId);
    if (!workspaceId) throw errorWithStatus("workspace_id_required");
    const centralUrl = normalizeUrl(config.centralUrl, "central_url");
    const enrollmentToken = compactOneLine(config.scopedCredential || config.enrollmentToken || config.token);
    if (!enrollmentToken) throw errorWithStatus("scoped_node_credential_required");
    const workspaceKind = compactOneLine(config.workspaceKind || WORKSPACE_KIND);
    if (workspaceKind !== WORKSPACE_KIND) throw errorWithStatus("workspace_kind_invalid");
    return {
      workspaceId,
      workspaceKind,
      projectType: compactOneLine(config.projectType || "unknown"),
      projectRoot,
      centralUrl,
      nodeName: compactOneLine(config.nodeName || "remote-node"),
      contractVersion: compactOneLine(config.contractVersion || "remote-managed-workspace.v1"),
      roles: normalizeStringList(config.roles || DEFAULT_ROLES),
      capabilities: normalizeStringList(config.capabilities || []),
      enrollmentToken,
      scopedCredential: enrollmentToken,
      projectRootEvidence: evidence,
    };
  }

  function normalizePairingConfig(config = {}) {
    const { projectRoot, evidence } = validateProjectRoot(config, { fs, path: pathModule });
    const workspaceId = compactOneLine(config.workspaceId);
    if (!workspaceId) throw errorWithStatus("workspace_id_required");
    const centralUrl = normalizeUrl(config.centralUrl, "central_url");
    const workspaceKind = compactOneLine(config.workspaceKind || WORKSPACE_KIND);
    if (workspaceKind !== WORKSPACE_KIND) throw errorWithStatus("workspace_kind_invalid");
    const nodeName = compactOneLine(config.nodeName || "remote-node");
    return {
      workspaceId,
      workspaceKind,
      projectType: compactOneLine(config.projectType || "unknown"),
      projectRoot,
      projectRootLabel: compactOneLine(config.projectRootLabel || pathModule.basename(projectRoot) || "workspace").slice(0, 120),
      centralUrl,
      nodeId: compactOneLine(config.nodeId || `rmn_${stableHash(`${workspaceId}:${nodeName}`, 20)}`).slice(0, 120),
      nodeName,
      contractVersion: compactOneLine(config.contractVersion || "remote-managed-workspace.v1"),
      roles: normalizeStringList(config.roles || DEFAULT_ROLES),
      capabilities: normalizeStringList(config.capabilities || []),
      projectRootEvidence: evidence,
    };
  }

  async function request(config, method, routePath, body, options = {}) {
    const url = new URL(routePath, `${config.centralUrl}/`);
    const credential = compactOneLine(config.scopedCredential || config.enrollmentToken || config.token);
    const headers = { "content-type": "application/json" };
    if (!options.skipAuth) {
      if (!credential) throw errorWithStatus("scoped_node_credential_required");
      headers.authorization = `Bearer ${credential}`;
    }
    const response = await fetchImpl(url.toString(), {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
    const { payload, rawText, parseErrorCode } = await readResponsePayload(response);
    if (!response.ok) {
      const originalCode = errorCodeFromPayload(payload)
        || parseErrorCode
        || `remote_managed_workspace_http_${response.status}`;
      const code = normalizeRemoteManagedWorkspaceNodeErrorCode(originalCode, {
        statusCode: response.status,
        responseText: rawText,
        payloadMessage: payload.message,
      });
      throw errorWithStatus(code, response.status, { originalCode, parseErrorCode });
    }
    if (parseErrorCode) throw errorWithStatus(parseErrorCode, response.status || 500, { parseErrorCode });
    return payload;
  }

  async function register(rawConfig) {
    const config = normalizeConfig(rawConfig);
    const payload = {
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
    };
    const result = await request(config, "POST", "/api/remote-managed-workspaces/register", payload);
    return { config, result };
  }

  async function requestPairing(rawConfig) {
    const config = normalizePairingConfig(rawConfig);
    const payload = {
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
    };
    const result = await request(config, "POST", "/api/remote-managed-workspaces/pairing-requests", payload, { skipAuth: true });
    return { config, result };
  }

  async function pollPairingStatus(rawConfig, pairingRequestId) {
    const config = normalizePairingConfig(rawConfig);
    const requestId = compactOneLine(pairingRequestId);
    if (!requestId) throw errorWithStatus("pairing_request_id_required");
    const result = await request(config, "GET", `/api/remote-managed-workspaces/pairing-requests/${encodeURIComponent(requestId)}`, null, { skipAuth: true });
    return { config, result };
  }

  async function nodeHeartbeat(config, payload = {}) {
    return request(config, "POST", `/api/remote-managed-workspaces/${encodeURIComponent(config.workspaceId)}/node-heartbeat`, payload);
  }

  async function pollTaskCards(config, payload = {}) {
    const limit = Math.max(1, Math.min(10, Number(payload.limit || 4) || 4));
    const result = await request(config, "GET", `/api/remote-managed-workspaces/${encodeURIComponent(config.workspaceId)}/task-cards/poll?limit=${limit}`);
    return normalizePolledTaskCardsPayload(result);
  }

  async function ackTaskCard(config, taskCardId, payload = {}) {
    return request(config, "POST", `/api/remote-managed-workspaces/${encodeURIComponent(config.workspaceId)}/task-cards/${encodeURIComponent(taskCardId)}/ack`, payload);
  }

  async function heartbeatTaskCard(config, taskCardId, payload = {}) {
    return request(config, "POST", `/api/remote-managed-workspaces/${encodeURIComponent(config.workspaceId)}/task-cards/${encodeURIComponent(taskCardId)}/heartbeat`, payload);
  }

  async function returnTaskCard(config, taskCardId, payload = {}) {
    return request(config, "POST", `/api/remote-managed-workspaces/${encodeURIComponent(config.workspaceId)}/task-cards/${encodeURIComponent(taskCardId)}/return`, Object.assign({}, payload, {
      locale: "zh-CN",
    }));
  }

  async function sendDailySummary(config, payload = {}) {
    return request(config, "POST", `/api/remote-managed-workspaces/${encodeURIComponent(config.workspaceId)}/daily-summary`, payload);
  }

  async function sendEscalation(config, payload = {}) {
    return request(config, "POST", `/api/remote-managed-workspaces/${encodeURIComponent(config.workspaceId)}/escalations`, payload);
  }

  async function processNextTaskCard(config, options = {}) {
    const execute = typeof options.execute === "function" ? options.execute : async () => ({
      status: "completed",
      title: "Remote task completed",
      summary: "remote_task_completed",
    });
    const polled = await pollTaskCards(config, { limit: 1 });
    const card = polled.taskCards[0] || null;
    if (!card) return { ok: true, executed: false, duplicateSuppressed: false };
    await ackTaskCard(config, card.taskCardId, { leaseId: `lease:${card.taskCardId}` });
    const executionKey = compactOneLine(card.idempotencyKey || card.taskCardId);
    if (executedKeys.has(executionKey)) {
      await returnTaskCard(config, card.taskCardId, {
        status: "completed",
        title: "重复任务已抑制",
        summary: "duplicate_idempotency_suppressed",
        metadata: { duplicateSuppressed: true },
      });
      return { ok: true, executed: false, duplicateSuppressed: true, card };
    }
    executedKeys.add(executionKey);
    await heartbeatTaskCard(config, card.taskCardId, { status: "working" });
    const terminal = await execute(card);
    const returned = await returnTaskCard(config, card.taskCardId, terminal);
    return { ok: true, executed: true, duplicateSuppressed: false, card, returned };
  }

  return {
    ackTaskCard,
    heartbeatTaskCard,
    nodeHeartbeat,
    normalizeConfig,
    normalizePairingConfig,
    pollTaskCards,
    pollPairingStatus,
    processNextTaskCard,
    register,
    requestPairing,
    returnTaskCard,
    sendDailySummary,
    sendEscalation,
    validateProjectRoot: (input) => validateProjectRoot(input, { fs, path: pathModule }),
  };
}

module.exports = {
  createRemoteManagedWorkspaceNodeClientService,
  normalizeRemoteManagedWorkspaceNodeErrorCode,
  normalizePolledTaskCardsPayload,
  validateProjectRoot,
};
