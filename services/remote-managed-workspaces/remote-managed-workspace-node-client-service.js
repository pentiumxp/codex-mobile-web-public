"use strict";

const defaultFs = require("node:fs");
const defaultPath = require("node:path");

const { DEFAULT_ROLES, WORKSPACE_KIND } = require("./remote-managed-workspace-service");

function compactOneLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function errorWithStatus(code, statusCode = 400) {
  const err = new Error(code);
  err.code = code;
  err.statusCode = statusCode;
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

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_) {
    throw errorWithStatus("remote_managed_workspace_response_not_json", response.status || 500);
  }
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
    const enrollmentToken = compactOneLine(config.enrollmentToken || config.token);
    if (!enrollmentToken) throw errorWithStatus("enrollment_token_required");
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
      projectRootEvidence: evidence,
    };
  }

  async function request(config, method, routePath, body) {
    const url = new URL(routePath, `${config.centralUrl}/`);
    const response = await fetchImpl(url.toString(), {
      method,
      headers: {
        "authorization": `Bearer ${config.enrollmentToken}`,
        "content-type": "application/json",
      },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const payload = await readJsonResponse(response);
    if (!response.ok) {
      const code = compactOneLine(payload.error || payload.code || `remote_managed_workspace_http_${response.status}`);
      throw errorWithStatus(code, response.status);
    }
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

  async function nodeHeartbeat(config, payload = {}) {
    return request(config, "POST", `/api/remote-managed-workspaces/${encodeURIComponent(config.workspaceId)}/node-heartbeat`, payload);
  }

  async function pollTaskCards(config, payload = {}) {
    const limit = Math.max(1, Math.min(10, Number(payload.limit || 4) || 4));
    return request(config, "GET", `/api/remote-managed-workspaces/${encodeURIComponent(config.workspaceId)}/task-cards/poll?limit=${limit}`);
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
    const card = Array.isArray(polled.cards) ? polled.cards[0] : null;
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
    pollTaskCards,
    processNextTaskCard,
    register,
    returnTaskCard,
    sendDailySummary,
    sendEscalation,
    validateProjectRoot: (input) => validateProjectRoot(input, { fs, path: pathModule }),
  };
}

module.exports = {
  createRemoteManagedWorkspaceNodeClientService,
  validateProjectRoot,
};
