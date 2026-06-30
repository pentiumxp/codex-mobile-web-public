"use strict";

function autoTurnRecoveryKey(threadId) {
  return String(threadId || "");
}

function turnStartResultTurnId(result) {
  return String((result && result.turnId) || (result && result.id) || (result && result.turn && result.turn.id) || "");
}

function createAutoTurnRecoveryService(deps = {}) {
  const {
    applyPermissionModeOverride,
    applyResumeRuntimeSettings,
    applyTurnRuntimeSettings,
    codex,
    cooldownMs = 120000,
    httpStatusError,
    isLiveTurn,
    isStaleActiveTurnError,
    isTurnSteerUnsupportedError,
    mutationRpcTimeoutMs = 120000,
    notifyLocalTurnStarted,
    prompt = "",
    readRpcTimeoutMs = 12000,
    resolveThreadRuntimeSettings,
    turnIdentifier,
    turnListFromResult,
  } = deps;
  const now = typeof deps.now === "function" ? deps.now : () => Date.now();
  const recent = deps.recent instanceof Map ? deps.recent : new Map();
  const inflight = deps.inflight instanceof Map ? deps.inflight : new Map();

  function makeStatusError(statusCode, message) {
    if (typeof httpStatusError === "function") return httpStatusError(statusCode, message);
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
  }

  function pruneRecent(nowMs = now()) {
    for (const [key, entry] of recent.entries()) {
      if (!entry || Number(entry.expiresAt || 0) <= nowMs) recent.delete(key);
    }
  }

  async function autoRecoverThreadTurn(threadId, options = {}) {
    const id = String(threadId || "").trim();
    if (!id) throw makeStatusError(400, "Thread id is required");
    if (!prompt) throw makeStatusError(409, "Automatic turn recovery is disabled");
    const activeTurnId = String(options.activeTurnId || "").trim();
    const wasRunning = Boolean(options.wasRunning || activeTurnId);
    if (!wasRunning) {
      return { skipped: true, reason: "not_marked_running", threadId: id };
    }

    pruneRecent();
    const key = autoTurnRecoveryKey(id);
    if (inflight.has(key)) {
      return inflight.get(key);
    }
    const cached = recent.get(key);
    if (cached && Number(cached.expiresAt || 0) > now()) {
      return {
        skipped: true,
        reason: "cooldown",
        threadId: id,
        action: cached.action || "",
        turnId: cached.turnId || "",
      };
    }

    const promise = (async () => {
      const runtimeSettings = applyPermissionModeOverride(
        await resolveThreadRuntimeSettings(id),
        options.permissionMode,
        options.cwd || null,
      );
      const input = [{ type: "text", text: prompt }];
      const turnsResult = await codex.request("thread/turns/list", {
        threadId: id,
        limit: 5,
        sortDirection: "desc",
      }, { timeoutMs: readRpcTimeoutMs, retry: true, resetOnTimeout: false });
      const turns = turnListFromResult(turnsResult);
      const liveTurn = turns.find((turn) => activeTurnId && turnIdentifier(turn) === activeTurnId && isLiveTurn(turn))
        || turns.find((turn) => isLiveTurn(turn));
      if (liveTurn) {
        const liveTurnId = turnIdentifier(liveTurn);
        try {
          await codex.request("turn/steer", {
            threadId: id,
            input,
            expectedTurnId: liveTurnId,
          }, { timeoutMs: mutationRpcTimeoutMs, retry: false });
          codex.notifyMuxUserMessage({
            threadId: id,
            turnId: liveTurnId,
            input,
            clientSubmissionId: `auto-recover-${now()}`,
          });
          return { recovered: true, action: "steered", threadId: id, turnId: liveTurnId };
        } catch (err) {
          if (!isTurnSteerUnsupportedError(err) && !isStaleActiveTurnError(err)) throw err;
        }
      }

      try {
        await codex.request("thread/resume", applyResumeRuntimeSettings({
          threadId: id,
          cwd: options.cwd || null,
          persistExtendedHistory: true,
        }, runtimeSettings), { timeoutMs: mutationRpcTimeoutMs, retry: false });
      } catch (err) {
        if (!/already|loaded|active/i.test(err.message || "")) throw err;
      }
      const params = applyTurnRuntimeSettings({
        threadId: id,
        input,
      }, runtimeSettings);
      if (options.cwd) params.cwd = options.cwd;
      const result = await codex.request("turn/start", params, { timeoutMs: mutationRpcTimeoutMs, retry: false });
      const turnId = notifyLocalTurnStarted(id, result, { source: "auto-turn-recovery" });
      return { recovered: true, action: "started", threadId: id, turnId };
    })();

    inflight.set(key, promise);
    try {
      const result = await promise;
      if (result && result.recovered) {
        recent.set(key, {
          expiresAt: now() + cooldownMs,
          action: result.action || "",
          turnId: result.turnId || "",
        });
      }
      return result;
    } finally {
      inflight.delete(key);
    }
  }

  return {
    autoRecoverThreadTurn,
    pruneRecent,
  };
}

module.exports = {
  autoTurnRecoveryKey,
  createAutoTurnRecoveryService,
  turnStartResultTurnId,
};
