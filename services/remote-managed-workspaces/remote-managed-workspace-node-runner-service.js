"use strict";

function compactOneLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function nowIso(now) {
  const value = typeof now === "function" ? now() : Date.now();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function errorCode(err) {
  return compactOneLine(err && (err.code || err.message)) || "remote_managed_workspace_runner_error";
}

const SCOPED_NODE_CREDENTIAL_INVALID_CODE = "remote_managed_workspace_scoped_node_credential_invalid";

function isInvalidScopedCredentialError(err) {
  const statusCode = Number(err && err.statusCode || 0);
  if (statusCode !== 401 && statusCode !== 403) return false;
  return errorCode(err).toLowerCase() === SCOPED_NODE_CREDENTIAL_INVALID_CODE;
}

function classifyConnectionStatus(err) {
  const statusCode = Number(err && err.statusCode || 0);
  if (statusCode === 401 || statusCode === 403 || /auth|token|unauthorized|forbidden/i.test(errorCode(err))) {
    return "auth_failed";
  }
  if (/config|workspace_id_required|central_url|project_root|allowed_root|enrollment_token_secret_unavailable|scoped_node_credential_unavailable|scoped_node_credential_required/i.test(errorCode(err))) {
    return "config_invalid";
  }
  if (/fetch failed|econn|enotfound|etimedout|offline|network|socket/i.test(errorCode(err))) {
    return "offline";
  }
  return "stale";
}

function backoffMs(failures, options = {}) {
  const min = Number(options.minBackoffMs || 1000) || 1000;
  const max = Number(options.maxBackoffMs || 60_000) || 60_000;
  const exponent = Math.max(0, Math.min(6, Number(failures || 0)));
  return Math.max(min, Math.min(max, min * (2 ** exponent)));
}

function shouldPollExistingPairingRequest(state = {}, options = {}) {
  const requestId = compactOneLine(state.pairingRequestId);
  if (!requestId || options.forceRequest === true) return false;
  const status = compactOneLine(state.pairingStatus).toLowerCase();
  if (status === "rejected") return false;
  const issues = Array.isArray(state.issueCodes) ? state.issueCodes.map((code) => compactOneLine(code).toLowerCase()) : [];
  if (status === "auth_failed" && issues.includes("scoped_node_credential_missing_after_approval")) {
    return false;
  }
  return true;
}

function hasIssueCode(state = {}, code = "") {
  const expected = compactOneLine(code).toLowerCase();
  if (!expected) return false;
  const issues = Array.isArray(state.issueCodes) ? state.issueCodes.map((entry) => compactOneLine(entry).toLowerCase()) : [];
  return issues.includes(expected);
}

function boundedTerminalWithoutExecutionBridge(card = {}) {
  return {
    status: "partially_completed",
    title: "远程任务未执行",
    summary: "local_task_card_execution_bridge_unavailable",
    metadata: {
      blocker: "local_task_card_execution_bridge_unavailable",
      taskCardId: compactOneLine(card.taskCardId || card.id).slice(0, 180),
    },
  };
}

function boundedTerminalForExecutionError(card = {}, err = {}) {
  const code = errorCode(err) || "local_task_card_execution_failed";
  return {
    status: "blocked",
    title: "远程任务执行失败",
    summary: code,
    metadata: {
      blocker: code,
      taskCardId: compactOneLine(card.taskCardId || card.id).slice(0, 180),
      localExecutionBridge: "codex_mobile_local_runtime",
    },
  };
}

function createRemoteManagedWorkspaceNodeRunnerService(dependencies = {}) {
  const settingsService = dependencies.settingsService;
  const nodeClientService = dependencies.nodeClientService;
  const now = dependencies.now || Date.now;
  const logger = dependencies.logger || console;
  const setTimer = dependencies.setTimeout || setTimeout;
  const clearTimer = dependencies.clearTimeout || clearTimeout;
  const setIntervalTimer = dependencies.setInterval || setInterval;
  const clearIntervalTimer = dependencies.clearInterval || clearInterval;
  const pollIntervalMs = Number(dependencies.pollIntervalMs || 30_000) || 30_000;
  const taskCardHeartbeatIntervalMs = Number(dependencies.taskCardHeartbeatIntervalMs || 30_000) || 30_000;
  const minBackoffMs = Number(dependencies.minBackoffMs || 1000) || 1000;
  const maxBackoffMs = Number(dependencies.maxBackoffMs || 60_000) || 60_000;
  const fetchImpl = dependencies.fetch || (typeof fetch === "function" ? fetch : null);
  const taskCardExecutor = typeof dependencies.taskCardExecutor === "function"
    ? dependencies.taskCardExecutor
    : null;
  let timer = null;
  let running = false;
  let started = false;

  if (!settingsService) throw new Error("remote_managed_workspace_settings_service_required");
  if (!nodeClientService) throw new Error("remote_managed_workspace_node_client_service_required");

  function setState(patch = {}) {
    return settingsService.updateConnectionState(Object.assign({}, patch, {
      updatedAt: nowIso(now),
    }));
  }

  function publicStatus() {
    return settingsService.publicSettings();
  }

  function recoverInvalidScopedCredential(err) {
    if (!isInvalidScopedCredentialError(err)) return null;
    if (typeof settingsService.clearScopedCredentialForRecovery !== "function") return null;
    return settingsService.clearScopedCredentialForRecovery({
      issueCode: SCOPED_NODE_CREDENTIAL_INVALID_CODE,
    });
  }

  function schedule(delayMs) {
    if (!started) return;
    if (timer) clearTimer(timer);
    timer = setTimer(() => {
      timer = null;
      runOnce({ scheduled: true }).catch((err) => {
        try {
          const state = settingsService.readState();
          const failures = Number(state.consecutiveFailures || 0) + 1;
          const delay = backoffMs(failures, { minBackoffMs, maxBackoffMs });
          setState({
            connectionStatus: classifyConnectionStatus(err),
            issueCode: errorCode(err),
            consecutiveFailures: failures,
            nextRetryAt: new Date(Date.now() + delay).toISOString(),
          });
          schedule(delay);
        } catch (stateErr) {
          if (logger && typeof logger.error === "function") {
            logger.error(`[remote-managed-workspace-runner] ${errorCode(stateErr)}`);
          }
        }
      });
    }, Math.max(0, Number(delayMs || 0)));
    if (timer && typeof timer.unref === "function") timer.unref();
  }

  function start() {
    started = true;
    schedule(0);
    return publicStatus();
  }

  function stop() {
    started = false;
    if (timer) clearTimer(timer);
    timer = null;
    setState({ connectionStatus: "disconnected", nextRetryAt: "" });
    return publicStatus();
  }

  async function testConnection() {
    let config;
    if (!fetchImpl) {
      const err = new Error("fetch_unavailable");
      err.code = "fetch_unavailable";
      throw err;
    }
    try {
      config = settingsService.configForClient({ requireEnabled: false, requireToken: false });
    } catch (err) {
      setState({
        connectionStatus: "config_invalid",
        issueCode: errorCode(err),
        lastConnectionCheckAt: nowIso(now),
      });
      throw err;
    }
    setState({ connectionStatus: "connecting", lastConnectionCheckAt: nowIso(now) });
    try {
      const response = await fetchImpl(config.centralUrl, { method: "GET" });
      const reachable = response && Number(response.status || 0) < 500;
      const state = setState({
        connectionStatus: reachable ? "connected" : "stale",
        issueCodes: reachable ? [] : ["central_url_unhealthy"],
        diagnostics: reachable ? [] : [{ code: "central_url_unhealthy", status: `http_${response.status}`, at: nowIso(now) }],
        lastConnectionCheckAt: nowIso(now),
        consecutiveFailures: reachable ? 0 : 1,
      });
      return { ok: reachable, status: settingsService.publicSettings(undefined, state) };
    } catch (err) {
      setState({
        connectionStatus: classifyConnectionStatus(err),
        issueCode: "central_url_unreachable",
        lastConnectionCheckAt: nowIso(now),
        consecutiveFailures: 1,
      });
      throw err;
    }
  }

  async function registerNow() {
    const currentPublic = settingsService.publicSettings();
    const approval = await ensurePairingApproved({
      requireEnabled: false,
      forceRequest: currentPublic.pairingStatus === "rejected",
    });
    if (!approval.approved) {
      return {
        ok: true,
        skipped: approval.skipped || "pending_approval",
        status: approval.status || publicStatus(),
      };
    }
    const config = settingsService.configForClient({ requireEnabled: false, requireToken: true });
    try {
      setState({ connectionStatus: "connecting", pairingStatus: "approved" });
      const registered = await nodeClientService.register(config);
      const state = setState({
        connectionStatus: "connected",
        pairingStatus: "connected",
        issueCodes: [],
        diagnostics: [],
        lastRegisterAt: nowIso(now),
        consecutiveFailures: 0,
        nextRetryAt: "",
      });
      return { ok: true, result: registered.result, status: settingsService.publicSettings(undefined, state) };
    } catch (err) {
      recoverInvalidScopedCredential(err);
      throw err;
    }
  }

  async function ensurePairingApproved(options = {}) {
    const publicSettings = settingsService.publicSettings();
    if (publicSettings.scopedCredentialConfigured || publicSettings.enrollmentTokenConfigured) {
      return { approved: true, status: publicSettings };
    }
    const pairingStatus = compactOneLine(publicSettings.pairingStatus || "");
    if (pairingStatus === "rejected" && options.forceRequest !== true) {
      return { approved: false, skipped: "pairing_rejected", status: publicSettings };
    }
    if (!nodeClientService || typeof nodeClientService.requestPairing !== "function" || typeof nodeClientService.pollPairingStatus !== "function") {
      const state = setState({
        connectionStatus: "config_invalid",
        pairingStatus: "auth_failed",
        issueCode: "remote_managed_workspace_pairing_client_unavailable",
        lastPairingCheckAt: nowIso(now),
      });
      return { approved: false, skipped: "pairing_client_unavailable", status: settingsService.publicSettings(undefined, state) };
    }
    const config = settingsService.configForPairingIntent({ requireEnabled: options.requireEnabled !== false });
    const state = settingsService.readState();
    const pollExistingRequest = shouldPollExistingPairingRequest(state, options);
    setState({
      connectionStatus: "connecting",
      pairingStatus: pollExistingRequest ? "pending_approval" : "requesting_pairing",
      lastPairingCheckAt: nowIso(now),
    });
    const response = pollExistingRequest
      ? await nodeClientService.pollPairingStatus(config, state.pairingRequestId)
      : await nodeClientService.requestPairing(config);
    const nextState = settingsService.applyPairingResult(response.result || response);
    const nextPublic = settingsService.publicSettings(undefined, nextState);
    if (nextPublic.scopedCredentialConfigured || nextPublic.enrollmentTokenConfigured) {
      return { approved: true, status: nextPublic };
    }
    if (nextPublic.pairingStatus === "approved") {
      if (pollExistingRequest
        && hasIssueCode(state, SCOPED_NODE_CREDENTIAL_INVALID_CODE)
        && typeof settingsService.retireStalePairingRequestForRecovery === "function") {
        const retiredState = settingsService.retireStalePairingRequestForRecovery({
          pairingRequestId: state.pairingRequestId,
          issueCode: "stale_pairing_request_missing_scoped_credential",
        });
        return {
          approved: false,
          skipped: "stale_pairing_request_retired",
          status: settingsService.publicSettings(undefined, retiredState),
        };
      }
      const missingCredentialState = setState({
        connectionStatus: "auth_failed",
        pairingStatus: "auth_failed",
        issueCode: "scoped_node_credential_missing_after_approval",
        lastPairingCheckAt: nowIso(now),
      });
      return {
        approved: false,
        skipped: "approval_missing_scoped_credential",
        status: settingsService.publicSettings(undefined, missingCredentialState),
      };
    }
    return {
      approved: false,
      skipped: nextPublic.pairingStatus === "rejected" ? "pairing_rejected" : "pending_approval",
      status: nextPublic,
    };
  }

  async function flushQueuedTerminalReturns(config) {
    const state = settingsService.readState();
    const queued = Array.isArray(state.queuedTerminalReturns) ? state.queuedTerminalReturns.slice() : [];
    if (!queued.length) return { flushed: 0 };
    const remaining = [];
    let flushed = 0;
    for (const entry of queued) {
      try {
        await nodeClientService.returnTaskCard(config, entry.taskCardId, entry.payload || {});
        flushed += 1;
      } catch (err) {
        if (isInvalidScopedCredentialError(err)) throw err;
        remaining.push(entry);
      }
    }
    settingsService.replaceQueuedTerminalReturns(remaining);
    return { flushed };
  }

  async function terminalForCard(card, context = {}) {
    if (taskCardExecutor) return taskCardExecutor(card, context);
    return boundedTerminalWithoutExecutionBridge(card);
  }

  async function executeCardWithHeartbeat(config, taskCardId, card) {
    let heartbeatTimer = null;
    let lastLocalThreadId = "";
    let lastLocalTurnId = "";
    let heartbeatCount = 0;
    const sendHeartbeat = async (payload = {}) => {
      heartbeatCount += 1;
      const localThreadId = compactOneLine(payload.localThreadId || lastLocalThreadId).slice(0, 180);
      const localTurnId = compactOneLine(payload.localTurnId || lastLocalTurnId).slice(0, 180);
      if (localThreadId) lastLocalThreadId = localThreadId;
      if (localTurnId) lastLocalTurnId = localTurnId;
      await nodeClientService.heartbeatTaskCard(config, taskCardId, {
        status: compactOneLine(payload.status || "working").slice(0, 80) || "working",
        heartbeatCount,
        localThreadId,
        localTurnId,
      });
      setState({
        lastHeartbeatAt: nowIso(now),
        activeLocalThreadId: localThreadId,
        activeLocalTurnId: localTurnId,
      });
      return { ok: true, heartbeatCount };
    };
    const onExecutionStarted = (execution = {}) => {
      lastLocalThreadId = compactOneLine(execution.localThreadId || execution.threadId).slice(0, 180);
      lastLocalTurnId = compactOneLine(execution.localTurnId || execution.turnId).slice(0, 180);
      setState({
        activeLocalThreadId: lastLocalThreadId,
        activeLocalTurnId: lastLocalTurnId,
        lastExecutionBridgeStatus: "local_turn_started",
      });
    };
    await sendHeartbeat({ status: "working" });
    if (taskCardHeartbeatIntervalMs > 0) {
      heartbeatTimer = setIntervalTimer(() => {
        sendHeartbeat({ status: "working" }).catch((err) => {
          if (logger && typeof logger.error === "function") {
            logger.error(`[remote-managed-workspace-runner] task heartbeat failed: ${errorCode(err)}`);
          }
        });
      }, taskCardHeartbeatIntervalMs);
      if (heartbeatTimer && typeof heartbeatTimer.unref === "function") heartbeatTimer.unref();
    }
    try {
      return await terminalForCard(card, {
        config,
        taskCardId,
        heartbeat: sendHeartbeat,
        onExecutionStarted,
      });
    } catch (err) {
      return boundedTerminalForExecutionError(card, err);
    } finally {
      if (heartbeatTimer) clearIntervalTimer(heartbeatTimer);
    }
  }

  async function processCard(config, card) {
    const taskCardId = compactOneLine(card && (card.taskCardId || card.id));
    if (!taskCardId) return { processed: false };
    const executionKey = compactOneLine(card.idempotencyKey || taskCardId);
    const state = settingsService.readState();
    await nodeClientService.ackTaskCard(config, taskCardId, {
      leaseId: `remote-node:${taskCardId}`,
    });
    if (state.executedIdempotencyKeys.includes(executionKey)) {
      const duplicatePayload = {
        status: "completed",
        title: "重复任务已抑制",
        summary: "duplicate_idempotency_suppressed",
        metadata: { duplicateSuppressed: true },
      };
      await nodeClientService.returnTaskCard(config, taskCardId, duplicatePayload);
      setState({
        activeTaskCardId: "",
        activeLocalThreadId: "",
        activeLocalTurnId: "",
        activeTaskCardStartedAt: "",
        lastTaskCardId: taskCardId,
        lastReturnStatus: "completed",
        lastExecutionBridgeStatus: "duplicate_suppressed",
      });
      return { processed: true, duplicateSuppressed: true };
    }
    settingsService.rememberIdempotencyKey(executionKey);
    setState({
      activeTaskCardId: taskCardId,
      activeTaskCardStartedAt: nowIso(now),
      lastTaskCardId: taskCardId,
      lastExecutionBridgeStatus: taskCardExecutor ? "started" : "local_task_card_execution_bridge_unavailable",
    });
    const terminal = await executeCardWithHeartbeat(config, taskCardId, card);
    const terminalMetadata = terminal && terminal.metadata && typeof terminal.metadata === "object"
      ? terminal.metadata
      : {};
    try {
      await nodeClientService.returnTaskCard(config, taskCardId, terminal);
    } catch (err) {
      settingsService.queueTerminalReturn({
        workspaceId: config.workspaceId,
        taskCardId,
        payload: terminal,
      });
      setState({
        activeTaskCardId: "",
        activeLocalThreadId: "",
        activeLocalTurnId: "",
        activeTaskCardStartedAt: "",
        lastTaskCardId: taskCardId,
        lastReturnStatus: compactOneLine(terminal.status || ""),
        lastLocalThreadId: compactOneLine(terminalMetadata.localThreadId || "").slice(0, 180),
        lastLocalTurnId: compactOneLine(terminalMetadata.localTurnId || "").slice(0, 180),
        lastExecutionBridgeStatus: compactOneLine(terminalMetadata.localExecutionBridge || terminalMetadata.bridge || terminal.summary || "").slice(0, 120),
      });
      throw err;
    }
    setState({
      activeTaskCardId: "",
      activeLocalThreadId: "",
      activeLocalTurnId: "",
      activeTaskCardStartedAt: "",
      lastTaskCardId: taskCardId,
      lastReturnStatus: compactOneLine(terminal.status || ""),
      lastLocalThreadId: compactOneLine(terminalMetadata.localThreadId || "").slice(0, 180),
      lastLocalTurnId: compactOneLine(terminalMetadata.localTurnId || "").slice(0, 180),
      lastExecutionBridgeStatus: compactOneLine(terminalMetadata.localExecutionBridge || terminalMetadata.bridge || terminal.summary || "").slice(0, 120),
    });
    return { processed: true, duplicateSuppressed: false, terminalStatus: terminal.status || "" };
  }

  async function runOnce(options = {}) {
    if (running && !options.force) return { ok: true, skipped: "already_running", status: publicStatus() };
    running = true;
    try {
      const publicSettings = settingsService.publicSettings();
      if (!publicSettings.enabled && options.requireEnabled !== false) {
        const state = setState({ connectionStatus: "disconnected", nextRetryAt: "" });
        return { ok: true, skipped: "disabled", status: settingsService.publicSettings(undefined, state) };
      }
      const approval = await ensurePairingApproved({ requireEnabled: options.requireEnabled !== false });
      if (!approval.approved) {
        if (started && approval.skipped !== "pairing_rejected") schedule(pollIntervalMs);
        return {
          ok: true,
          skipped: approval.skipped || "pending_approval",
          status: approval.status || publicStatus(),
        };
      }
      const config = settingsService.configForClient({ requireEnabled: options.requireEnabled !== false, requireToken: true });
      setState({ connectionStatus: "connecting", pairingStatus: "approved" });
      const registered = await nodeClientService.register(config);
      const heartbeat = await nodeClientService.nodeHeartbeat(config, {
        status: "idle",
        activeTaskCardCount: 0,
        capabilities: config.capabilities,
      });
      await flushQueuedTerminalReturns(config);
      const polled = await nodeClientService.pollTaskCards(config, { limit: 1 });
      const card = Array.isArray(polled.cards) ? polled.cards[0] : null;
      let processed = { processed: false };
      if (card) processed = await processCard(config, card);
      const state = setState({
        connectionStatus: "connected",
        pairingStatus: "connected",
        issueCodes: [],
        diagnostics: [],
        lastRegisterAt: nowIso(now),
        lastHeartbeatAt: nowIso(now),
        lastPollAt: nowIso(now),
        lastTaskCardId: card ? compactOneLine(card.taskCardId || card.id) : settingsService.readState().lastTaskCardId || "",
        consecutiveFailures: 0,
        nextRetryAt: "",
      });
      if (started) schedule(pollIntervalMs);
      return {
        ok: true,
        registered: registered.result && registered.result.ok === true,
        heartbeatOk: heartbeat && heartbeat.ok === true,
        polledCount: Number(polled.count || 0),
        processed,
        status: settingsService.publicSettings(undefined, state),
      };
    } catch (err) {
      const invalidScopedCredential = isInvalidScopedCredentialError(err);
      const recovered = invalidScopedCredential ? recoverInvalidScopedCredential(err) : null;
      const current = recovered || settingsService.readState();
      const failures = Number(current.consecutiveFailures || 0) + 1;
      const delay = backoffMs(failures, { minBackoffMs, maxBackoffMs });
      const classified = classifyConnectionStatus(err);
      const pairingPatch = invalidScopedCredential
        ? { lastPairingCheckAt: nowIso(now) }
        : settingsService.publicSettings().scopedCredentialConfigured
        ? {}
        : {
            pairingStatus: classified === "offline" ? "offline_retrying" : (classified === "auth_failed" ? "auth_failed" : current.pairingStatus),
            lastPairingCheckAt: nowIso(now),
          };
      const state = setState({
        connectionStatus: classified,
        ...pairingPatch,
        issueCode: errorCode(err),
        consecutiveFailures: failures,
        nextRetryAt: new Date(Date.now() + delay).toISOString(),
      });
      if (started) schedule(delay);
      if (options.suppressErrors) return { ok: false, error: errorCode(err), status: settingsService.publicSettings(undefined, state) };
      throw err;
    } finally {
      running = false;
    }
  }

  function handleSettingsChanged() {
    const settings = settingsService.publicSettings();
    if (settings.enabled) return start();
    return stop();
  }

  return {
    handleSettingsChanged,
    publicStatus,
    registerNow,
    runOnce,
    start,
    stop,
    testConnection,
  };
}

module.exports = {
  boundedTerminalForExecutionError,
  boundedTerminalWithoutExecutionBridge,
  createRemoteManagedWorkspaceNodeRunnerService,
};
