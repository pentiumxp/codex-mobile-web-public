"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

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

function shortHash(value, length = 16) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, length);
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

function boundedCount(...values) {
  for (const value of values) {
    if (value == null || value === "") continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return Math.max(0, Math.floor(numeric));
  }
  return 0;
}

function publicWorkspace(row = {}) {
  const source = row && typeof row === "object" ? row : {};
  const counts = source.counts && typeof source.counts === "object" ? source.counts : source;
  const session = source.session && typeof source.session === "object" ? source.session : {};
  const pairingStatus = compactOneLine(source.pairingStatus).toLowerCase();
  return {
    workspaceId: compactOneLine(source.workspaceId || source.id),
    label: boundedString(source.label || source.name || source.projectRootLabel || source.workspaceId || source.id, "workspace_label", 180, false),
    trusted: Boolean(source.trusted || source.trustStatus === "trusted"),
    paired: Boolean(source.paired || ["approved", "paired", "connected"].includes(pairingStatus)),
    connected: Boolean(source.connected || ["active", "connected", "online"].includes(compactOneLine(source.status || source.connectionStatus).toLowerCase())),
    status: boundedString(source.status || source.connectionStatus || "", "workspace_status", 80, false),
    pairingStatus: boundedString(source.pairingStatus || "", "pairing_status", 80, false),
    sessionFresh: Boolean(source.sessionFresh || session.fresh),
    lastSeenAt: boundedString(source.lastSeenAt || source.lastHeartbeatAt || session.lastSeenAt || "", "last_seen_at", 80, false),
    queuedCount: boundedCount(counts.queuedTaskCardCount, source.queuedTaskCardCount, counts.queuedCount, counts.queued),
    activeCount: boundedCount(counts.activeTaskCardCount, source.activeTaskCardCount, counts.activeCount, counts.active),
    terminalCount: boundedCount(counts.terminalTaskCardCount, source.terminalTaskCardCount, counts.terminalCount, counts.terminal, counts.completed),
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

function writeJsonAtomic(file, value, mode = 0o600) {
  const target = String(file || "").trim();
  if (!target) throw new Error("rmw_control_state_file_required");
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode });
  fs.renameSync(tmp, target);
  try {
    fs.chmodSync(target, mode);
  } catch (_) {
    // Best effort on filesystems that do not support chmod.
  }
}

function readJsonFile(file) {
  const target = String(file || "").trim();
  if (!target) return {};
  try {
    return JSON.parse(fs.readFileSync(target, "utf8"));
  } catch (_) {
    return {};
  }
}

function readSecretFile(file) {
  const target = String(file || "").trim();
  if (!target) return "";
  try {
    return normalizeControlToken(fs.readFileSync(target, "utf8"));
  } catch (_) {
    return "";
  }
}

function writeSecretFile(file, value) {
  const target = String(file || "").trim();
  const token = normalizeControlToken(value);
  if (!target) throw new Error("rmw_control_credential_file_required");
  if (!token) throw new Error("rmw_control_credential_empty");
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, `${token}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, target);
  try {
    fs.chmodSync(target, 0o600);
  } catch (_) {
    // Best effort on filesystems that do not support chmod.
  }
}

function defaultControlRuntimeRoot() {
  return process.env.CODEX_MOBILE_RUNTIME_DIR || path.join(os.homedir(), ".codex-mobile-web");
}

function defaultControlStateFile() {
  return path.join(defaultControlRuntimeRoot(), "rmw-control-client-state.json");
}

function defaultControlCredentialFile() {
  return path.join(defaultControlRuntimeRoot(), "rmw-control-credential");
}

function boundedScopes(value) {
  const raw = Array.isArray(value) ? value : ["list", "dispatch", "read"];
  const allowed = new Set(["list", "dispatch", "read"]);
  return raw.map((item) => boundedString(item, "scope", 40, false)).filter((item) => allowed.has(item)).slice(0, 3);
}

function normalizeClientIdentity(input = {}) {
  const persisted = input && typeof input === "object" ? input : {};
  const seed = `${os.hostname()}|${process.cwd()}|${os.homedir()}`;
  const installId = boundedString(persisted.installId || `install-${shortHash(seed, 20)}`, "install_id", 120, true);
  const deviceId = boundedString(persisted.deviceId || `device-${shortHash(`${os.hostname()}|${os.homedir()}`, 18)}`, "device_id", 120, true);
  const localWorkspaceId = boundedString(
    persisted.localWorkspaceId || `codex-mobile-local-${shortHash(process.cwd(), 14)}`,
    "local_workspace_id",
    180,
    true,
  );
  return {
    clientId: boundedString(persisted.clientId || `local-codex-mobile-dev-${shortHash(installId, 12)}`, "client_id", 180, true),
    clientName: boundedString(persisted.clientName || `${os.hostname() || "local"} Codex Mobile MCP`, "client_name", 180, true),
    clientKind: boundedString(persisted.clientKind || "local_codex_mobile_dev", "client_kind", 80, true),
    installId,
    deviceId,
    localWorkspaceId,
  };
}

function publicControlClientPairingRequest(pairingRequest = {}) {
  const source = pairingRequest && typeof pairingRequest === "object" ? pairingRequest : {};
  return {
    requestId: boundedString(source.requestId || source.id, "pairing_request_id", 180, false),
    status: boundedString(source.status || "", "pairing_status", 80, false),
    clientId: boundedString(source.clientId || "", "client_id", 180, false),
    clientKind: boundedString(source.clientKind || "", "client_kind", 80, false),
    localWorkspaceId: boundedString(source.localWorkspaceId || "", "local_workspace_id", 180, false),
    approvedScopes: boundedScopes(source.approvedScopes || source.scopes),
    issueCodes: boundedIssueCodes(source.issueCodes),
    contract: contractMetadata(source),
  };
}

function publicControlClientBootstrapStatus(state = {}, extra = {}) {
  const source = state && typeof state === "object" ? state : {};
  const pairing = publicControlClientPairingRequest(Object.assign({}, source.pairingRequest || {}, {
    requestId: source.pairingRequestId || source.requestId,
    status: source.pairingStatus || source.status,
    clientId: source.clientId,
    clientKind: source.clientKind,
    localWorkspaceId: source.localWorkspaceId,
    scopes: source.scopes,
  }));
  return {
    ok: false,
    skipped: boundedString(extra.skipped || source.skipped || "control_pairing_pending_approval", "skipped", 120, false),
    centralUrlConfigured: Boolean(extra.centralUrlConfigured),
    scopedControlCredentialConfigured: Boolean(extra.scopedControlCredentialConfigured),
    pairingRequest: pairing,
    issueCodes: boundedIssueCodes(extra.issueCodes || source.issueCodes),
    contract: contractMetadata(extra.contract || source.contract || {}),
  };
}

function pairingRequestFromPayload(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  return source.pairingRequest && typeof source.pairingRequest === "object"
    ? source.pairingRequest
    : source.request && typeof source.request === "object"
      ? source.request
      : source;
}

function controlCredentialTokenFromPairing(pairingRequest = {}) {
  const source = pairingRequest && typeof pairingRequest === "object" ? pairingRequest : {};
  const credential = source.controlCredential && typeof source.controlCredential === "object"
    ? source.controlCredential
    : source.scopedControlCredential && typeof source.scopedControlCredential === "object"
      ? source.scopedControlCredential
      : source.credential && typeof source.credential === "object"
        ? source.credential
        : {};
  return normalizeControlToken(credential.token || credential.controlToken || source.controlToken || source.token);
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

function createRemoteManagedWorkspaceControlBootstrapService(dependencies = {}) {
  const fetchImpl = dependencies.fetch || fetch;
  const stateFile = String(dependencies.stateFile || defaultControlStateFile()).trim();
  const credentialFile = String(dependencies.credentialFile || dependencies.tokenFile || defaultControlCredentialFile()).trim();
  const defaultCentralUrl = dependencies.centralUrl || process.env.CODEX_MOBILE_RMW_CONTROL_URL || process.env.HOME_AI_RMW_CONTROL_URL || "http://127.0.0.1:8797";
  const nowIso = dependencies.nowIso || (() => new Date().toISOString());

  function readState() {
    const state = readJsonFile(stateFile);
    return state && typeof state === "object" ? state : {};
  }

  function saveState(next) {
    writeJsonAtomic(stateFile, Object.assign({ version: 1 }, next, { updatedAt: nowIso() }), 0o600);
  }

  function savePairingState(state, pairingRequest, patch = {}) {
    const pairing = publicControlClientPairingRequest(pairingRequest);
    const next = Object.assign({}, state, normalizeClientIdentity(state), patch, {
      pairingRequestId: pairing.requestId || state.pairingRequestId || "",
      pairingStatus: pairing.status || state.pairingStatus || "",
      scopes: boundedScopes(state.scopes),
      pairingRequest: pairing,
    });
    saveState(next);
    return next;
  }

  function identityForState(state = {}) {
    return normalizeClientIdentity(Object.assign({}, state, dependencies.identity || {}));
  }

  async function requestPairing(centralUrl, identity, scopes) {
    const response = await fetchImpl(`${centralUrl}/api/remote-managed-workspace-control/client-pairing-requests`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(Object.assign({}, identity, { scopes })),
    });
    const payload = await readJsonResponse(response);
    if (!response.ok || payload.ok === false) {
      const code = compactOneLine(payload.code || payload.issueCode || payload.error || `rmw_control_pairing_http_${response.status}`);
      const err = new Error(code || "rmw_control_pairing_request_failed");
      err.statusCode = response.status;
      err.issueCode = code;
      err.contract = contractMetadata(payload);
      throw err;
    }
    return pairingRequestFromPayload(payload);
  }

  async function readPairing(centralUrl, requestId, identity) {
    const params = new URLSearchParams({
      clientId: identity.clientId,
      installId: identity.installId,
      deviceId: identity.deviceId,
      localWorkspaceId: identity.localWorkspaceId,
    });
    const response = await fetchImpl(`${centralUrl}/api/remote-managed-workspace-control/client-pairing-requests/${encodeURIComponent(requestId)}?${params.toString()}`, {
      method: "GET",
      headers: { accept: "application/json" },
    });
    const payload = await readJsonResponse(response);
    if (!response.ok || payload.ok === false) {
      const code = compactOneLine(payload.code || payload.issueCode || payload.error || `rmw_control_pairing_http_${response.status}`);
      const err = new Error(code || "rmw_control_pairing_read_failed");
      err.statusCode = response.status;
      err.issueCode = code;
      err.contract = contractMetadata(payload);
      throw err;
    }
    return pairingRequestFromPayload(payload);
  }

  async function ensureControlCredential(config = {}) {
    const centralUrl = normalizeCentralUrl(config.centralUrl || defaultCentralUrl);
    const existing = normalizeControlToken(config.controlToken || dependencies.controlToken || readSecretFile(credentialFile));
    if (existing) {
      const state = readState();
      return {
        ok: true,
        centralUrl,
        controlToken: existing,
        status: publicControlClientBootstrapStatus(state, {
          centralUrlConfigured: true,
          scopedControlCredentialConfigured: true,
          skipped: "",
        }),
      };
    }
    const state = readState();
    const identity = identityForState(state);
    const scopes = boundedScopes(config.scopes || state.scopes || dependencies.scopes);
    let pairing;
    let nextState = Object.assign({}, state, identity, { scopes });
    if (nextState.pairingRequestId && compactOneLine(nextState.pairingStatus).toLowerCase() === "rejected") {
      return {
        ok: false,
        centralUrl,
        controlToken: "",
        status: publicControlClientBootstrapStatus(nextState, {
          centralUrlConfigured: true,
          scopedControlCredentialConfigured: false,
          skipped: "control_pairing_rejected",
        }),
      };
    }
    if (nextState.pairingRequestId && !["expired", "cancelled"].includes(compactOneLine(nextState.pairingStatus).toLowerCase())) {
      pairing = await readPairing(centralUrl, nextState.pairingRequestId, identity);
      nextState = savePairingState(nextState, pairing, { lastPairingCheckAt: nowIso() });
    } else {
      pairing = await requestPairing(centralUrl, identity, scopes);
      nextState = savePairingState(nextState, pairing, { requestedAt: nowIso(), lastPairingCheckAt: nowIso() });
    }
    const token = controlCredentialTokenFromPairing(pairing);
    const status = compactOneLine(pairing.status || nextState.pairingStatus).toLowerCase();
    if (token) {
      writeSecretFile(credentialFile, token);
      nextState = savePairingState(nextState, pairing, { pairingStatus: "paired", pairedAt: nowIso() });
      return {
        ok: true,
        centralUrl,
        controlToken: token,
        status: publicControlClientBootstrapStatus(nextState, {
          centralUrlConfigured: true,
          scopedControlCredentialConfigured: true,
          skipped: "",
        }),
      };
    }
    const skipped = status === "rejected"
      ? "control_pairing_rejected"
      : status === "approved" || status === "paired"
        ? "control_pairing_approved_without_credential"
        : "control_pairing_pending_approval";
    return {
      ok: false,
      centralUrl,
      controlToken: "",
      status: publicControlClientBootstrapStatus(nextState, {
        centralUrlConfigured: true,
        scopedControlCredentialConfigured: false,
        skipped,
      }),
    };
  }

  return {
    credentialFileConfigured: Boolean(credentialFile),
    ensureControlCredential,
    publicStatus() {
      return publicControlClientBootstrapStatus(readState(), {
        centralUrlConfigured: Boolean(defaultCentralUrl),
        scopedControlCredentialConfigured: Boolean(readSecretFile(credentialFile)),
      });
    },
  };
}

module.exports = {
  DEFAULT_CONTRACT,
  contractMetadata,
  createRemoteManagedWorkspaceControlBootstrapService,
  createRemoteManagedWorkspaceControlClientService,
  defaultControlCredentialFile,
  defaultControlStateFile,
  publicControlClientBootstrapStatus,
  publicControlClientPairingRequest,
  publicDispatchResult,
  publicTaskCard,
  publicWorkspace,
};
