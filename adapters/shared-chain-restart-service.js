"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

function shQuote(value) {
  return `'${String(value || "").replace(/'/g, "'\\''")}'`;
}

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
  const scriptArgs = [
    `& ${psQuote(options.scriptPath)}`,
    `-TaskName ${psQuote(options.taskName || "Codex Mobile Web")}`,
    `-WorkspacePath ${psQuote(options.workspacePath)}`,
    `-UserProfilePath ${psQuote(options.userProfilePath)}`,
  ];
  if (options.profileId) {
    scriptArgs.push(`-ProfileId ${psQuote(options.profileId)}`);
  }
  if (options.codexHome) {
    scriptArgs.push(`-CodexHome ${psQuote(options.codexHome)}`);
  }
  scriptArgs.push(
    `-Port ${Math.max(1, Number(options.port || 8787))}`,
    `-MaxWaitSeconds ${Math.max(1, Number(options.maxWaitSeconds || 45))}`,
  );
  parts.push(scriptArgs.join(" "));
  return parts.join("; ");
}

function safeRestartEnvAssignments(env = {}, extras = {}) {
  const blocked = /(KEY|TOKEN|SECRET|PASSWORD|AUTH)/i;
  const names = new Set([
    "CODEX_HOME",
    "CODEX_MOBILE_RUNTIME_DIR",
    "CODEX_MOBILE_HOST",
    "CODEX_MOBILE_PORT",
    "CODEX_MOBILE_CODEX_EXE",
    "CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER",
    "CODEX_MOBILE_DISABLE_UPDATE_CHECK",
    "CODEX_MOBILE_DISABLE_AUTH",
    "CODEX_MOBILE_FILE_PREVIEW_ROOTS",
    "CODEX_MOBILE_FILE_PREVIEW_MAX_BYTES",
    "CODEX_MOBILE_FILE_PREVIEW_MEDIA_MAX_BYTES",
  ]);
  const result = {};
  for (const name of names) {
    if (blocked.test(name) && name !== "CODEX_MOBILE_DISABLE_AUTH") continue;
    const value = env[name];
    if (value !== undefined && value !== null && String(value) !== "") result[name] = String(value);
  }
  for (const [name, value] of Object.entries(extras || {})) {
    if (!name || value === undefined || value === null || String(value) === "") continue;
    result[name] = String(value);
  }
  return result;
}

function buildRestartEnvArgs(assignments) {
  return Object.entries(assignments || {})
    .map(([name, value]) => `${name}=${shQuote(value)}`)
    .join(" ");
}

function buildRestartMacShellCommand(options = {}) {
  const delayMs = Math.max(0, Number(options.delayMs || 0));
  const delaySeconds = (delayMs / 1000).toFixed(3);
  const port = Math.max(1, Number(options.port || 8787));
  const workspacePath = path.resolve(options.workspacePath || process.cwd());
  const serverPath = path.resolve(options.serverPath || path.join(workspacePath, "server.js"));
  const nodePath = options.nodePath || process.execPath || "node";
  const currentPid = Math.max(1, Number(options.currentPid || process.pid || 1));
  const launchctlPath = options.launchctlPath || "/bin/launchctl";
  const logPath = path.resolve(options.logPath || path.join(options.runtimeDir || path.join(process.env.HOME || workspacePath, ".codex-mobile-web"), "logs", "mobile-web.log"));
  const logDir = path.dirname(logPath);
  const labelPrefix = String(options.labelPrefix || `com.xuefusong.codex-mobile-web.${port}`).replace(/[^A-Za-z0-9_.-]/g, "-");
  const envArgs = buildRestartEnvArgs(safeRestartEnvAssignments(options.env || process.env, {
    CODEX_HOME: options.codexHome || (options.env && options.env.CODEX_HOME),
    CODEX_MOBILE_HOST: options.host || (options.env && options.env.CODEX_MOBILE_HOST) || "0.0.0.0",
    CODEX_MOBILE_PORT: String(port),
    CODEX_MOBILE_RUNTIME_DIR: options.runtimeDir || (options.env && options.env.CODEX_MOBILE_RUNTIME_DIR),
  }));

  return [
    "set -euo pipefail",
    `sleep ${delaySeconds}`,
    `label_prefix=${shQuote(labelPrefix)}`,
    "label=\"${label_prefix}.$$.${RANDOM:-0}\"",
    `mkdir -p ${shQuote(logDir)}`,
    `old_pids="$( { /usr/sbin/lsof -tiTCP:${port} -sTCP:LISTEN 2>/dev/null || true; printf '%s\\n' ${currentPid}; } | awk 'NF' | sort -u )"`,
    "for pid in $old_pids; do",
    "  command=\"$(/bin/ps -p \"$pid\" -o command= 2>/dev/null || true)\"",
    `  if [[ "$pid" == ${currentPid} || "$command" == *${shQuote(serverPath)}* || "$command" == *"server.js"* ]]; then`,
    "    /bin/kill \"$pid\" >/dev/null 2>&1 || true",
    "  fi",
    "done",
    "for _ in {1..40}; do",
    `  if ! /usr/sbin/lsof -nP -iTCP:${port} -sTCP:LISTEN >/dev/null 2>&1; then break; fi`,
    "  sleep 0.25",
    "done",
    [
      `exec ${shQuote(launchctlPath)} submit -l "$label"`,
      `-o ${shQuote(logPath)}`,
      `-e ${shQuote(logPath)}`,
      "-- /usr/bin/env",
      envArgs,
      "CODEX_MOBILE_LAUNCHD_LABEL=\"$label\"",
      `CODEX_MOBILE_LAUNCHD_LABEL_PREFIX=${shQuote(labelPrefix)}`,
      shQuote(nodePath),
      shQuote(serverPath),
    ].filter(Boolean).join(" "),
  ].join("\n");
}

function createSharedChainRestartService(deps = {}) {
  const env = deps.env || process.env;
  const fsApi = deps.fs || fs;
  const spawnFn = deps.spawn || spawn;
  const platform = deps.platform || process.platform;
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
    const delayMs = Math.max(500, Number(options.delayMs || deps.delayMs || 900));

    if (platform === "darwin") {
      const command = buildRestartMacShellCommand({
        delayMs,
        env,
        workspacePath,
        serverPath: deps.serverPath,
        nodePath: deps.nodePath || process.execPath,
        currentPid: deps.currentPid || process.pid,
        launchctlPath: deps.launchctlPath,
        logPath: deps.logPath,
        labelPrefix: deps.launchdLabelPrefix || env.CODEX_MOBILE_LAUNCHD_LABEL_PREFIX || `com.xuefusong.codex-mobile-web.${port}`,
        port,
        host: deps.host || env.CODEX_MOBILE_HOST,
        codexHome: deps.codexHome || env.CODEX_HOME,
        runtimeDir: deps.runtimeDir || env.CODEX_MOBILE_RUNTIME_DIR,
      });
      const child = spawnFn(deps.shellPath || "/bin/bash", ["-lc", command], {
        cwd: workspacePath,
        detached: true,
        stdio: "ignore",
      });
      if (child && typeof child.unref === "function") child.unref();
      return {
        ok: true,
        restarting: true,
        restartInMs: delayMs,
        pid: child && child.pid || 0,
        taskName,
        port,
        mode: "macos-launchctl",
      };
    }

    if (platform !== "win32" && options.allowNonWindows !== true && deps.allowNonWindows !== true) {
      const err = new Error("Shared-chain restart is only supported on Windows in this deployment.");
      err.statusCode = 501;
      throw err;
    }
    if (!fsApi.existsSync(scriptPath)) {
      const err = new Error(`Restart script not found: ${scriptPath}`);
      err.statusCode = 500;
      throw err;
    }

    const command = buildRestartPowerShellCommand({
      delayMs,
      scriptPath,
      taskName,
      workspacePath,
      userProfilePath,
      profileId: options.profileId || deps.profileId,
      codexHome: options.codexHome || deps.codexHome,
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
      mode: "windows-shared-chain",
    };
  }

  return { restart };
}

module.exports = {
  buildRestartMacShellCommand,
  buildRestartPowerShellCommand,
  createSharedChainRestartService,
  defaultPowerShellPath,
  encodePowerShellCommand,
  psQuote,
  shQuote,
};
