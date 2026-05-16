"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

function psQuote(value) {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}

function defaultPowerShellPath(env = process.env) {
  const windowsRoot = env.SystemRoot || env.WINDIR;
  if (windowsRoot) {
    return path.join(windowsRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  }
  return "powershell.exe";
}

function encodePowerShellCommand(command) {
  return Buffer.from(String(command || ""), "utf16le").toString("base64");
}

function buildRestartPowerShellCommand(options = {}) {
  const delayMs = Math.max(0, Number(options.delayMs || 0));
  const parts = [];
  if (delayMs > 0) {
    parts.push(`Start-Sleep -Milliseconds ${delayMs}`);
  }
  parts.push([
    `& ${psQuote(options.scriptPath)}`,
    `-TaskName ${psQuote(options.taskName || "Codex Mobile Web")}`,
    `-WorkspacePath ${psQuote(options.workspacePath)}`,
    `-UserProfilePath ${psQuote(options.userProfilePath)}`,
    `-Port ${Math.max(1, Number(options.port || 8787))}`,
    `-MaxWaitSeconds ${Math.max(1, Number(options.maxWaitSeconds || 45))}`,
  ].join(" "));
  return parts.join("; ");
}

function createSharedChainRestartService(deps = {}) {
  const env = deps.env || process.env;
  const fsApi = deps.fs || fs;
  const spawnFn = deps.spawn || spawn;
  const workspacePath = path.resolve(deps.workspacePath || process.cwd());
  const userProfilePath = path.resolve(deps.userProfilePath || env.USERPROFILE || env.HOME || process.cwd());
  const scriptPath = path.resolve(deps.scriptPath || path.join(workspacePath, "restart-codex-mobile-shared-chain.ps1"));
  const taskName = String(deps.taskName || env.CODEX_MOBILE_TASK_NAME || "Codex Mobile Web");
  const port = Math.max(1, Number(deps.port || env.CODEX_MOBILE_PORT || 8787));
  const maxWaitSeconds = Math.max(1, Number(deps.maxWaitSeconds || env.CODEX_MOBILE_RESTART_WAIT_SECONDS || 45));
  const powerShellPath = deps.powerShellPath || defaultPowerShellPath(env);

  function restart(options = {}) {
    if (env.CODEX_MOBILE_DISABLE_SHARED_CHAIN_RESTART && /^(1|true|yes|on)$/i.test(env.CODEX_MOBILE_DISABLE_SHARED_CHAIN_RESTART)) {
      const err = new Error("Shared-chain restart is disabled by CODEX_MOBILE_DISABLE_SHARED_CHAIN_RESTART.");
      err.statusCode = 403;
      throw err;
    }
    if (process.platform !== "win32" && options.allowNonWindows !== true && deps.allowNonWindows !== true) {
      const err = new Error("Shared-chain restart is only supported on Windows in this deployment.");
      err.statusCode = 501;
      throw err;
    }
    if (!fsApi.existsSync(scriptPath)) {
      const err = new Error(`Restart script not found: ${scriptPath}`);
      err.statusCode = 500;
      throw err;
    }

    const delayMs = Math.max(500, Number(options.delayMs || deps.delayMs || 900));
    const command = buildRestartPowerShellCommand({
      delayMs,
      scriptPath,
      taskName,
      workspacePath,
      userProfilePath,
      port,
      maxWaitSeconds,
    });
    const child = spawnFn(powerShellPath, [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-WindowStyle",
      "Hidden",
      "-EncodedCommand",
      encodePowerShellCommand(command),
    ], {
      cwd: workspacePath,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    if (child && typeof child.unref === "function") child.unref();

    return {
      ok: true,
      restarting: true,
      restartInMs: delayMs,
      pid: child && child.pid || 0,
      taskName,
      port,
    };
  }

  return { restart };
}

module.exports = {
  buildRestartPowerShellCommand,
  createSharedChainRestartService,
  defaultPowerShellPath,
  encodePowerShellCommand,
  psQuote,
};
