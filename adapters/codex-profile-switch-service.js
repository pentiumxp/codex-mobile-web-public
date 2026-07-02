"use strict";

const crypto = require("node:crypto");

function createCodexProfileSwitchService(options = {}) {
  const progressTtlMs = Math.max(60_000, Number(options.progressTtlMs || 300000));
  const preflightTimeoutMs = Math.max(4000, Number(options.preflightTimeoutMs || 12000));
  const getFreePort = typeof options.getFreePort === "function" ? options.getFreePort : null;
  const spawn = typeof options.spawn === "function" ? options.spawn : null;
  const codeExe = String(options.codeExe || "");
  const appRoot = String(options.appRoot || process.cwd());
  const codexAppServerChildEnv = typeof options.codexAppServerChildEnv === "function"
    ? options.codexAppServerChildEnv
    : (extra = {}) => Object.assign({}, process.env, extra || {});
  const WebSocketCtor = options.WebSocket || globalThis.WebSocket;
  const logger = options.logger || console;
  const profileSwitchProgress = new Map();

  function profileSwitchProgressRequestId(value) {
    const raw = String(value || "").trim();
    if (/^[a-zA-Z0-9_-]{8,80}$/.test(raw)) return raw;
    return crypto.randomUUID();
  }

  function cleanupProfileSwitchProgress(now = Date.now()) {
    for (const [id, item] of profileSwitchProgress.entries()) {
      const updatedAtMs = Number(item && item.updatedAtMs || 0);
      if (!updatedAtMs || now - updatedAtMs > progressTtlMs) {
        profileSwitchProgress.delete(id);
      }
    }
  }

  function setProfileSwitchProgress(requestId, patch = {}) {
    const id = profileSwitchProgressRequestId(requestId);
    const now = Date.now();
    cleanupProfileSwitchProgress(now);
    const previous = profileSwitchProgress.get(id) || {
      requestId: id,
      ok: true,
      status: "running",
      stepIndex: 0,
      stepCount: 10,
      stage: "queued",
      message: "正在准备切换 Profile...",
      createdAtMs: now,
      createdAt: new Date(now).toISOString(),
    };
    const next = Object.assign({}, previous, patch || {}, {
      requestId: id,
      updatedAtMs: now,
      updatedAt: new Date(now).toISOString(),
    });
    if (!next.message) next.message = "正在切换 Profile...";
    if (!next.stage) next.stage = "running";
    if (!next.status) next.status = "running";
    profileSwitchProgress.set(id, next);
    return profileSwitchProgressSnapshot(next);
  }

  function getProfileSwitchProgress(requestId) {
    cleanupProfileSwitchProgress();
    const id = String(requestId || "").trim();
    if (!id) return null;
    const item = profileSwitchProgress.get(id);
    return item ? profileSwitchProgressSnapshot(item) : null;
  }

  function profileSwitchProgressSnapshot(item = {}) {
    return {
      requestId: String(item.requestId || ""),
      targetProfileId: String(item.targetProfileId || ""),
      targetProfileLabel: String(item.targetProfileLabel || ""),
      status: String(item.status || "running"),
      stage: String(item.stage || "running"),
      message: String(item.message || ""),
      stepIndex: Number(item.stepIndex || 0),
      stepCount: Number(item.stepCount || 10),
      restarting: Boolean(item.restarting),
      error: item.error ? String(item.error) : undefined,
      code: item.code ? String(item.code) : undefined,
      detail: item.detail ? String(item.detail) : undefined,
      failedStage: item.failedStage ? String(item.failedStage) : undefined,
      warnings: Array.isArray(item.warnings) ? item.warnings.slice(0, 5).map((warning) => ({
        code: warning && warning.code ? String(warning.code) : "",
        message: warning && warning.message ? String(warning.message) : "",
        detail: warning && warning.detail ? String(warning.detail) : "",
      })) : undefined,
      updatedAt: item.updatedAt || "",
      createdAt: item.createdAt || "",
    };
  }

  function profileSwitchPreflightError(err) {
    const raw = String(err && (err.message || err) || "");
    const lower = raw.toLowerCase();
    if (/token_expired|refresh_token_reused|refresh token|access token|unauthorized|401/.test(lower)) {
      return {
        code: "target_profile_auth_invalid",
        message: "目标 Codex 账号登录已失效，请先重新登录该账号，再切换。",
      };
    }
    if (/not found|enoent|eacces|permission denied|spawn/.test(lower)) {
      return {
        code: "target_profile_app_server_unavailable",
        message: "目标 Codex 账号的 app-server 无法启动，请检查该账号配置后再切换。",
      };
    }
    if (/timed out|timeout/.test(lower)) {
      return {
        code: "target_profile_preflight_timeout",
        message: "目标 Codex 账号登录检测超时，请稍后重试或重新登录该账号。",
      };
    }
    return {
      code: "target_profile_preflight_failed",
      message: "目标 Codex 账号登录检测失败，请先修复该账号后再切换。",
    };
  }

  function boundedProfilePreflightDetail(err) {
    const raw = String(err && (err.message || err) || "").replace(/\s+/g, " ").trim();
    if (!raw) return "";
    return raw.slice(0, 260);
  }

  function profileSwitchLogDetail(value) {
    const raw = String(value || "").replace(/\s+/g, " ").trim();
    if (!raw) return "";
    return raw.slice(0, 220);
  }

  function profileSwitchRateLimitsWarningForError(err) {
    const classified = profileSwitchPreflightError(err);
    if (classified.code === "target_profile_auth_invalid") return null;
    return null;
  }

  function profileSwitchRateLimitsErrorForError(err) {
    const classified = profileSwitchPreflightError(err);
    if (classified.code === "target_profile_auth_invalid") return null;
    return {
      code: "target_profile_rate_limits_unavailable",
      message: "目标账号额度读取失败，未切换。请确认目标账号登录和网络可用后重试。",
      detail: boundedProfilePreflightDetail(err),
    };
  }

  function profileSwitchStage(id, label, status = "completed", detail = "") {
    const cleanStatus = ["pending", "running", "completed", "warning", "failed"].includes(status)
      ? status
      : "completed";
    return {
      id: String(id || "").trim(),
      label: String(label || id || "").trim(),
      status: cleanStatus,
      detail: String(detail || "").replace(/\s+/g, " ").trim().slice(0, 220),
      at: new Date().toISOString(),
    };
  }

  function connectPreflightWebSocket(url, timeoutMs) {
    if (typeof WebSocketCtor !== "function") {
      return Promise.reject(new Error("profile switch preflight websocket is unavailable"));
    }
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + Math.max(500, Number(timeoutMs || 0));
      let ws = null;
      let settled = false;
      let retryTimer = null;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          if (ws) ws.close();
        } catch (_) {}
        reject(new Error("profile switch preflight websocket timeout"));
      }, timeoutMs);

      const attempt = () => {
        if (settled) return;
        try {
          ws = new WebSocketCtor(url);
        } catch (err) {
          if (Date.now() >= deadline) {
            settled = true;
            clearTimeout(timer);
            reject(err);
            return;
          }
          retryTimer = setTimeout(attempt, 200);
          return;
        }
        ws.onopen = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (retryTimer) clearTimeout(retryTimer);
          resolve(ws);
        };
        ws.onerror = () => {
          if (settled) return;
          try {
            ws.close();
          } catch (_) {}
          if (Date.now() >= deadline) {
            settled = true;
            clearTimeout(timer);
            reject(new Error("profile switch preflight websocket connection failed"));
            return;
          }
          retryTimer = setTimeout(attempt, 200);
        };
      };

      attempt();
    });
  }

  function preflightRpc(ws, id, method, params, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.onmessage = null;
        reject(new Error(`profile switch preflight timed out: ${method}`));
      }, timeoutMs);
      ws.onmessage = (event) => {
        let msg = null;
        try {
          msg = JSON.parse(String(event.data || ""));
        } catch (_) {
          return;
        }
        if (!msg || msg.id !== id) return;
        clearTimeout(timer);
        ws.onmessage = null;
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      };
      ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    });
  }

  async function preflightCodexProfileSwitch(profile, preflightOptions = {}) {
    const codexHome = String(profile && profile.codexHome || "").trim();
    if (!codexHome) {
      const err = new Error("Target Codex profile home is missing.");
      err.statusCode = 409;
      throw err;
    }
    if (!getFreePort || !spawn || !codeExe) {
      throw new Error("profile switch preflight dependencies are not configured");
    }
    const onProgress = typeof preflightOptions.onProgress === "function" ? preflightOptions.onProgress : null;
    const emitProgress = (patch) => {
      if (!onProgress) return;
      try {
        onProgress(patch || {});
      } catch (_) {}
    };
    const timeoutMs = Math.max(3000, Number(preflightOptions.timeoutMs || preflightTimeoutMs));
    const startedAt = Date.now();
    const warnings = [];
    let rateLimitsChecked = false;
    const port = await getFreePort();
    emitProgress({
      stage: "preflight_spawn",
      message: "正在启动目标账号 app-server...",
      stepIndex: 4,
    });
    const childEnv = codexAppServerChildEnv({ CODEX_HOME: codexHome });
    const child = spawn(codeExe, ["app-server", "--listen", `ws://127.0.0.1:${port}`], {
      cwd: appRoot,
      env: childEnv,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let logTail = "";
    const appendLog = (chunk) => {
      logTail = `${logTail}${String(chunk || "")}`.slice(-2000);
    };
    child.stdout.on("data", appendLog);
    child.stderr.on("data", appendLog);

    const closeChild = () => {
      try {
        if (child.exitCode === null && child.signalCode === null) child.kill();
      } catch (_) {}
    };

    try {
      await new Promise((resolve, reject) => {
        child.once("spawn", resolve);
        child.once("error", reject);
        child.once("exit", (code, signal) => {
          reject(new Error(`profile switch preflight app-server exited (${code ?? signal ?? "unknown"})`));
        });
      });
      emitProgress({
        stage: "preflight_connect",
        message: "正在连接目标账号 app-server...",
        stepIndex: 5,
      });
      const ws = await connectPreflightWebSocket(`ws://127.0.0.1:${port}`, timeoutMs);
      try {
        const remaining = Math.max(2000, timeoutMs - (Date.now() - startedAt));
        emitProgress({
          stage: "preflight_initialize",
          message: "正在初始化目标账号会话...",
          stepIndex: 6,
        });
        await preflightRpc(ws, 1, "initialize", {
          clientInfo: {
            name: "codex-mobile-web",
            title: "Codex Mobile Web Profile Switch Preflight",
            version: "0.1.0",
            replayNotificationLimit: 0,
          },
          capabilities: { experimentalApi: true },
        }, remaining);
        emitProgress({
          stage: "preflight_rate_limits",
          message: "正在读取目标账号额度...",
          stepIndex: 7,
        });
        try {
          await preflightRpc(ws, 2, "account/rateLimits/read", {}, Math.max(2000, timeoutMs - (Date.now() - startedAt)));
          rateLimitsChecked = true;
        } catch (rateLimitErr) {
          const failure = profileSwitchRateLimitsErrorForError(rateLimitErr);
          if (!failure) throw rateLimitErr;
          logger.error(`[codex-profile-switch] rate_limits_failed ${JSON.stringify({
            targetProfileId: String(profile.id || ""),
            code: failure.code,
            detail: profileSwitchLogDetail(failure.detail),
          })}`);
          emitProgress({
            stage: "preflight_rate_limits",
            status: "failed",
            message: failure.message,
            stepIndex: 7,
            code: failure.code,
            detail: failure.detail,
          });
          const out = new Error(failure.message);
          out.statusCode = 409;
          out.code = failure.code;
          out.detail = failure.detail;
          throw out;
        }
        emitProgress({
          stage: "preflight_done",
          message: "目标账号预检通过",
          stepIndex: 8,
        });
      } finally {
        try {
          ws.close();
        } catch (_) {}
      }
      return {
        ok: true,
        profileId: profile.id,
        checked: rateLimitsChecked ? ["initialize", "account/rateLimits/read"] : ["initialize"],
        warnings,
      };
    } catch (err) {
      if (err && err.statusCode && err.code) throw err;
      const classified = profileSwitchPreflightError(err);
      const out = new Error(classified.message);
      out.statusCode = 409;
      out.code = classified.code;
      out.detail = boundedProfilePreflightDetail(err) || boundedProfilePreflightDetail(logTail);
      throw out;
    } finally {
      closeChild();
    }
  }

  return {
    connectPreflightWebSocket,
    getProfileSwitchProgress,
    preflightCodexProfileSwitch,
    preflightRpc,
    profileSwitchLogDetail,
    profileSwitchPreflightError,
    profileSwitchProgressRequestId,
    profileSwitchProgressSnapshot,
    profileSwitchRateLimitsWarningForError,
    profileSwitchStage,
    setProfileSwitchProgress,
  };
}

module.exports = {
  createCodexProfileSwitchService,
};
