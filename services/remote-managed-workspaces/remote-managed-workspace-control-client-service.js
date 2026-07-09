"use strict";

const DEFAULT_CONTRACT = {
  contractVersion: "remote-managed-workspace-central-contract-v1",
  contractOwner: "home-ai-central",
  contractRef: "docs/PLATFORM_CONTRACTS/remote-managed-workspace-contract.md",
  controlSurface: "remote-managed-workspace-control",
  controlAuthMode: "scoped-control",
};

function compactOneLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function boundedString(value, fieldName, maxLength, required = false) {
  const text = compactOneLine(value);
  if (required && !text) throw new Error(`${fieldName}_required`);
  if (text.length > maxLength) throw new Error(`${fieldName}_too_long`);
  return text;
}

function normalizeCentralUrl(value) {
  const text = boundedString(value, "central_url", 1000, true).replace(/\/+$/, "");
  let parsed;
  try {
    parsed = new URL(text);
  } catch (_) {
    throw new Error("central_url_invalid");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("central_url_must_use_http_or_https");
  if (parsed.username || parsed.password) throw new Error("central_url_must_not_include_credentials");
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString().replace(/\/$/, "");
}

function normalizeControlToken(value) {
  return compactOneLine(value);
}

function contractMetadata(source = {}) {
  const input = source && typeof source === "object" ? source : {};
  const metadata = input.contract && typeof input.contract === "object" ? input.contract : input;
  return {
    contractVersion: compactOneLine(metadata.contractVersion) || DEFAULT_CONTRACT.contractVersion,
    contractOwner: compactOneLine(metadata.contractOwner) || DEFAULT_CONTRACT.contractOwner,
    contractRef: compactOneLine(metadata.contractRef) || DEFAULT_CONTRACT.contractRef,
    controlSurface: compactOneLine(metadata.controlSurface) || DEFAULT_CONTRACT.controlSurface,
    controlAuthMode: compactOneLine(metadata.controlAuthMode) || DEFAULT_CONTRACT.controlAuthMode,
  };
}

function boundedIssueCodes(value) {
  const raw = Array.isArray(value) ? value : [];
  return raw.map((entry) => boundedString(entry, "issue_code", 120, false)).filter(Boolean).slice(0, 24);
}

function publicWorkspace(row = {}) {
  const source = row && typeof row === "object" ? row : {};
  const counts = source.counts && typeof source.counts === "object" ? source.counts : source;
  const session = source.session && typeof source.session === "object" ? source.session : {};
  return {
    workspaceId: compactOneLine(source.workspaceId || source.id),
    label: boundedString(source.label || source.name || source.projectRootLabel || source.workspaceId || source.id, "workspace_label", 180, false),
    trusted: Boolean(source.trusted || source.trustStatus === "trusted"),
    paired: Boolean(source.paired || ["approved", "connected"].includes(compactOneLine(source.pairingStatus).toLowerCase())),
    connected: Boolean(source.connected || ["active", "connected", "online"].includes(compactOneLine(source.status || source.connectionStatus).toLowerCase())),
    status: boundedString(source.status || source.connectionStatus || "", "workspace_status", 80, false),
    pairingStatus: boundedString(source.pairingStatus || "", "pairing_status", 80, false),
    sessionFresh: Boolean(source.sessionFresh || session.fresh),
    lastSeenAt: boundedString(source.lastSeenAt || source.lastHeartbeatAt || session.lastSeenAt || "", "last_seen_at", 80, false),
    queuedCount: Math.max(0, Number(counts.queuedCount || counts.queued || 0) || 0),
    activeCount: Math.max(0, Number(counts.activeCount || counts.active || 0) || 0),
    terminalCount: Math.max(0, Number(counts.terminalCount || counts.terminal || counts.completed || 0) || 0),
    issueCodes: boundedIssueCodes(source.issueCodes),
    contract: contractMetadata(source),
  };
}

function publicTaskCard(card = {}) {
  const source = card && typeof card === "object" ? card : {};
  const lease = source.executionLease && typeof source.executionLease === "object" ? source.executionLease : {};
  const terminal = source.terminalReturn && typeof source.terminalReturn === "object" ? source.terminalReturn : {};
  return {
    taskCardId: compactOneLine(source.taskCardId || source.id),
    status: boundedString(source.status || "", "task_card_status", 80, false),
    terminalStatus: boundedString(source.terminalStatus || terminal.status || "", "terminal_status", 80, false),
    summary: boundedString(source.summary || "", "task_card_summary", 500, false),
    terminalSummary: boundedString(terminal.summary || "", "terminal_summary", 700, false),
    duplicate: Boolean(source.duplicate),
    idempotencyKeyPresent: Boolean(source.idempotencyKey),
    leaseStatus: boundedString(lease.status || "", "lease_status", 80, false),
    lastHeartbeatAt: boundedString(lease.lastHeartbeatAt || "", "last_heartbeat_at", 80, false),
    createdAt: boundedString(source.createdAt || "", "created_at", 80, false),
    updatedAt: boundedString(source.updatedAt || "", "updated_at", 80, false),
  };
}

function publicDispatchResult(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const card = publicTaskCard(source.card || source.taskCard || source);
  return {
    ok: source.ok !== false,
    workspaceId: compactOneLine(source.workspaceId || source.workspace && source.workspace.workspaceId),
    taskCardId: card.taskCardId,
    status: card.status,
    duplicate: Boolean(source.duplicate || card.duplicate),
    idempotencyKeyPresent: card.idempotencyKeyPresent,
    issueCodes: boundedIssueCodes(source.issueCodes),
    contract: contractMetadata(source),
  };
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error(`rmw_control_response_not_json_${response.status || 0}`);
  }
}

function createRemoteManagedWorkspaceControlClientService(dependencies = {}) {
  const fetchImpl = dependencies.fetch || fetch;

  function normalizeConfig(config = {}) {
    const centralUrl = normalizeCentralUrl(config.centralUrl || dependencies.centralUrl);
    const controlToken = normalizeControlToken(config.controlToken || dependencies.controlToken);
    if (!controlToken) throw new Error("rmw_control_credential_required");
    return { centralUrl, controlToken };
  }

  async function request(config, method, routePath, body = null) {
    const normalized = normalizeConfig(config);
    const headers = {
      authorization: `Bearer ${normalized.controlToken}`,
      "content-type": "application/json; charset=utf-8",
    };
    const response = await fetchImpl(`${normalized.centralUrl}${routePath}`, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
    const payload = await readJsonResponse(response);
    if (!response.ok || payload.ok === false) {
      const code = compactOneLine(payload.issueCode || payload.error || payload.code || `rmw_control_http_${response.status}`);
      const err = new Error(code || "rmw_control_request_failed");
      err.statusCode = response.status;
      err.issueCode = code;
      err.contract = contractMetadata(payload);
      throw err;
    }
    return payload;
  }

  async function listWorkspaces(config = {}) {
    const payload = await request(config, "GET", "/api/remote-managed-workspace-control/workspaces");
    const rows = Array.isArray(payload.workspaces) ? payload.workspaces : Array.isArray(payload.data) ? payload.data : [];
    return {
      ok: payload.ok !== false,
      count: rows.length,
      workspaces: rows.map(publicWorkspace).filter((row) => row.workspaceId),
      issueCodes: boundedIssueCodes(payload.issueCodes),
      contract: contractMetadata(payload),
    };
  }

  async function dispatchTaskCard(config = {}, args = {}) {
    const workspaceId = boundedString(args.workspaceId, "workspace_id", 180, true);
    const payload = {
      title: boundedString(args.title, "title", 180, true),
      summary: boundedString(args.summary, "summary", 500, false),
      bodyMarkdown: boundedString(args.bodyMarkdown || args.body, "body_markdown", 4000, true),
      idempotencyKey: boundedString(args.idempotencyKey || args.requestId, "idempotency_key", 180, true),
      reasoningEffort: boundedString(args.reasoningEffort || "medium", "reasoning_effort", 20, false) || "medium",
    };
    const result = await request(
      config,
      "POST",
      `/api/remote-managed-workspace-control/workspaces/${encodeURIComponent(workspaceId)}/task-cards`,
      payload,
    );
    return Object.assign(publicDispatchResult(result), { workspaceId });
  }

  async function readTaskCard(config = {}, args = {}) {
    const workspaceId = boundedString(args.workspaceId, "workspace_id", 180, true);
    const taskCardId = boundedString(args.taskCardId, "task_card_id", 180, true);
    const payload = await request(
      config,
      "GET",
      `/api/remote-managed-workspace-control/workspaces/${encodeURIComponent(workspaceId)}/task-cards/${encodeURIComponent(taskCardId)}`,
    );
    return {
      ok: payload.ok !== false,
      workspaceId,
      card: publicTaskCard(payload.card || payload.taskCard || payload),
      issueCodes: boundedIssueCodes(payload.issueCodes),
      contract: contractMetadata(payload),
    };
  }

  return {
    dispatchTaskCard,
    listWorkspaces,
    readTaskCard,
  };
}

module.exports = {
  DEFAULT_CONTRACT,
  contractMetadata,
  createRemoteManagedWorkspaceControlClientService,
  publicDispatchResult,
  publicTaskCard,
  publicWorkspace,
};
