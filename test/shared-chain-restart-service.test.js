"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const {
  buildRestartMacShellCommand,
  buildRestartPowerShellBootstrapCommand,
  buildRestartPowerShellCommand,
  buildRestartPowerShellHelperTaskCommand,
  buildRestartPowerShellProcessCommandLine,
  buildRestartPowerShellScheduledTaskBootstrapCommand,
  createSharedChainRestartService,
  psQuote,
  quoteWindowsCommandArg,
  spawnSyncFailureMessage,
} = require("../adapters/shared-chain-restart-service");

test("restart command targets the existing shared-chain restart script", () => {
  const command = buildRestartPowerShellCommand({
    delayMs: 1200,
    scriptPath: "C:\\repo\\restart-codex-mobile-shared-chain.ps1",
    taskName: "Codex Mobile Web",
    workspacePath: "C:\\repo",
    userProfilePath: "C:\\Users\\xuxin",
    port: 8787,
    maxWaitSeconds: 45,
  });

  assert.match(command, /Start-Sleep -Milliseconds 1200/);
  assert.match(command, /restart-codex-mobile-shared-chain\.ps1/);
  assert.match(command, /-TaskName 'Codex Mobile Web'/);
  assert.match(command, /-WorkspacePath 'C:\\repo'/);
  assert.match(command, /-UserProfilePath 'C:\\Users\\xuxin'/);
  assert.match(command, /-Port 8787/);
});

test("restart command can target an explicit Codex profile home", () => {
  const command = buildRestartPowerShellCommand({
    scriptPath: "C:\\repo\\restart-codex-mobile-shared-chain.ps1",
    taskName: "Codex Mobile Web",
    workspacePath: "C:\\repo",
    userProfilePath: "C:\\Users\\xuxin",
    profileId: "previous",
    codexHome: "C:\\Users\\xuxin\\.codex-homes\\previous",
    port: 8787,
  });

  assert.match(command, /-ProfileId 'previous'/);
  assert.match(command, /-CodexHome 'C:\\Users\\xuxin\\\.codex-homes\\previous'/);
});

test("restart service spawns a detached hidden PowerShell process for ordinary Windows startup", () => {
  const root = path.resolve(__dirname, "..");
  let spawnCall = null;
  let unrefCalled = false;
  const service = createSharedChainRestartService({
    allowNonWindows: true,
    platform: "win32",
    env: {
      SystemRoot: "C:\\Windows",
      USERPROFILE: path.join(root, ".tmp-user"),
    },
    fs: {
      existsSync: () => true,
    },
    spawn: (exe, args, options) => {
      spawnCall = { exe, args, options };
      return {
        pid: 12345,
        unref: () => {
          unrefCalled = true;
        },
      };
    },
    spawnSync: () => {
      throw new Error("ordinary Windows restart must not register a SYSTEM helper task");
    },
    workspacePath: root,
    taskName: "Codex Mobile Web",
    port: 8787,
  });

  const result = service.restart({ delayMs: 900 });

  assert.equal(result.ok, true);
  assert.equal(result.restarting, true);
  assert.equal(result.restartInMs, 900);
  assert.equal(result.pid, 12345);
  assert.equal(result.mode, "windows-shared-chain");
  assert.ok(unrefCalled);
  assert.match(spawnCall.exe, /powershell\.exe$/i);
  assert.deepEqual(spawnCall.args.slice(0, 5), ["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden"]);
  assert.ok(spawnCall.args.includes("-EncodedCommand"));
  assert.equal(spawnCall.options.detached, true);
  assert.equal(spawnCall.options.stdio, "ignore");
  assert.equal(spawnCall.options.windowsHide, true);

  const encoded = spawnCall.args[spawnCall.args.indexOf("-EncodedCommand") + 1];
  const decoded = Buffer.from(encoded, "base64").toString("utf16le");
  assert.match(decoded, /restart-codex-mobile-shared-chain\.ps1/);
  assert.match(decoded, /-TaskName 'Codex Mobile Web'/);
  assert.doesNotMatch(decoded, /Register-ScheduledTask/);
  assert.doesNotMatch(decoded, /New-ScheduledTaskPrincipal -UserId 'SYSTEM'/);
});

test("restart service synchronously runs a hidden PowerShell bootstrap that starts a SYSTEM helper task", () => {
  const root = path.resolve(__dirname, "..");
  let spawnCall = null;
  const service = createSharedChainRestartService({
    allowNonWindows: true,
    platform: "win32",
    env: {
      SystemRoot: "C:\\Windows",
      USERPROFILE: path.join(root, ".tmp-user"),
      CODEX_MOBILE_WINDOWS_SYSTEM_TASK: "1",
    },
    fs: {
      existsSync: () => true,
    },
    spawnSync: (exe, args, options) => {
      spawnCall = { exe, args, options };
      return { status: 0, stdout: "", stderr: "" };
    },
    workspacePath: root,
    taskName: "Codex Mobile Web",
    port: 8787,
  });

  const result = service.restart({ delayMs: 900 });

  assert.equal(result.ok, true);
  assert.equal(result.restarting, true);
  assert.equal(result.restartInMs, 900);
  assert.equal(result.pid, 0);
  assert.equal(result.mode, "windows-scheduled-task-bootstrap");
  assert.equal(result.bootstrapExitCode, 0);
  assert.match(spawnCall.exe, /powershell\.exe$/i);
  assert.deepEqual(spawnCall.args.slice(0, 5), ["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden"]);
  assert.ok(spawnCall.args.includes("-EncodedCommand"));
  assert.equal(spawnCall.options.stdio, "pipe");
  assert.equal(spawnCall.options.windowsHide, true);

  const encoded = spawnCall.args[spawnCall.args.indexOf("-EncodedCommand") + 1];
  const decoded = Buffer.from(encoded, "base64").toString("utf16le");
  assert.match(decoded, /Register-ScheduledTask/);
  assert.match(decoded, /Start-ScheduledTask/);
  assert.match(decoded, /New-ScheduledTaskPrincipal -UserId 'SYSTEM'/);
  assert.match(decoded, /Codex Mobile Web Restart Helper/);
  const nested = decoded.match(/-EncodedCommand ([A-Za-z0-9+/=]+)/);
  assert.ok(nested, "missing nested restart helper encoded command");
  const nestedDecoded = Buffer.from(nested[1], "base64").toString("utf16le");
  assert.match(nestedDecoded, /restart-codex-mobile-shared-chain\.ps1/);
  assert.match(nestedDecoded, /-TaskName 'Codex Mobile Web'/);
  assert.match(nestedDecoded, /Unregister-ScheduledTask -TaskName 'Codex Mobile Web Restart Helper'/);
  assert.doesNotMatch(nestedDecoded, /-CodexHome/);
});

test("restart service reports synchronous Windows bootstrap failures", () => {
  const root = path.resolve(__dirname, "..");
  const service = createSharedChainRestartService({
    allowNonWindows: true,
    platform: "win32",
    env: {
      SystemRoot: "C:\\Windows",
      USERPROFILE: path.join(root, ".tmp-user"),
      CODEX_MOBILE_WINDOWS_SYSTEM_TASK: "1",
    },
    fs: {
      existsSync: () => true,
    },
    spawnSync: () => ({ status: 1, stdout: "", stderr: "Access is denied." }),
    workspacePath: root,
    taskName: "Codex Mobile Web",
    port: 8787,
  });

  assert.throws(
    () => service.restart({ delayMs: 900 }),
    /PowerShell restart bootstrap exited with code 1: Access is denied\./,
  );
  assert.match(
    spawnSyncFailureMessage({ status: 2, stdout: "fallback", stderr: "" }),
    /fallback/,
  );
});

test("restart PowerShell scheduled task bootstrap preserves paths with spaces", () => {
  const command = buildRestartPowerShellCommand({
    scriptPath: "C:\\repo path\\restart-codex-mobile-shared-chain.ps1",
    taskName: "Codex Mobile Web",
    workspacePath: "C:\\repo path",
    userProfilePath: "C:\\Users\\xuxin",
    port: 8787,
  });
  const commandLine = buildRestartPowerShellProcessCommandLine({
    powerShellPath: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    command,
  });
  const bootstrap = buildRestartPowerShellScheduledTaskBootstrapCommand({
    powerShellPath: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    command,
    workspacePath: "C:\\repo path",
    helperTaskName: "Codex Mobile Web Restart Helper",
    bootstrapLogPath: "C:\\Users\\xuxin\\.codex-mobile-web\\shared-chain-restart-bootstrap.log",
  });
  const helperCommand = buildRestartPowerShellHelperTaskCommand({
    command,
    helperTaskName: "Codex Mobile Web Restart Helper",
  });
  const wmiBootstrap = buildRestartPowerShellBootstrapCommand({
    powerShellPath: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    command,
    workspacePath: "C:\\repo path",
  });

  assert.match(commandLine, /-EncodedCommand [A-Za-z0-9+/=]+/);
  assert.match(wmiBootstrap, /Win32_Process/);
  assert.match(bootstrap, /Register-ScheduledTask/);
  assert.match(bootstrap, /\$workingDirectory = 'C:\\repo path'/);
  assert.match(helperCommand, /Unregister-ScheduledTask -TaskName 'Codex Mobile Web Restart Helper'/);
  assert.equal(quoteWindowsCommandArg("C:\\Program Files\\PowerShell\\pwsh.exe"), "\"C:\\Program Files\\PowerShell\\pwsh.exe\"");
});

test("macOS restart command restarts the existing LaunchDaemon when available", () => {
  const root = path.resolve(__dirname, "..");
  const command = buildRestartMacShellCommand({
    delayMs: 1200,
    workspacePath: root,
    serverPath: path.join(root, "server.js"),
    nodePath: "/usr/local/bin/node",
    currentPid: 4321,
    launchctlPath: "/bin/launchctl",
    logPath: "/Users/xuefusong/.codex-mobile-web/logs/mobile-web.log",
    labelPrefix: "com.xuefusong.codex-mobile-web.test",
    port: 8789,
    host: "0.0.0.0",
    codexHome: "/Users/xuefusong/.codex",
    runtimeDir: "/Users/xuefusong/.codex-mobile-web",
    env: {
      XPC_SERVICE_NAME: "com.homeai.plugin.codex-mobile",
      CODEX_MOBILE_CODEX_EXE: "/Users/xuefusong/.local/bin/codex",
      CODEX_MOBILE_AUTH_KEY: "should-not-leak",
      CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER: "1",
    },
  });

  assert.match(command, /sleep 1\.200/);
  assert.match(command, /service_label='com\.homeai\.plugin\.codex-mobile'/);
  assert.match(command, /run_restart_sudo "\$launchctl_path" print "system\/\$service_label"/);
  assert.match(command, /service_domain="system\/\$service_label"/);
  assert.match(command, /target_codex_home='\/Users\/xuefusong\/\.codex'/);
  assert.match(command, /target_mux_endpoint_file='\/Users\/xuefusong\/\.codex\/app-server-mux\/endpoint\.json'/);
  assert.match(command, /system_launchdaemon_plist_path/);
  assert.match(command, /sync_system_launchdaemon_profile_env "\$service_plist_path"/);
  assert.match(command, /PlistBuddy -c "Set :EnvironmentVariables:\$\{key\} \$\{value\}"/);
  assert.match(command, /plist_set_env_value "\$plist_path" CODEX_HOME "\$target_codex_home"/);
  assert.match(command, /plist_set_env_value "\$plist_path" CODEX_MOBILE_MUX_ENDPOINT_FILE "\$target_mux_endpoint_file"/);
  assert.match(command, /repair_system_launchdaemon_stdio >/);
  assert.match(command, /std\(out\|err\) path = /);
  assert.match(command, /\/usr\/bin\/touch "\$log_path"/);
  assert.match(command, /\/usr\/sbin\/chown "\$service_user:staff" "\$log_path"/);
  assert.match(command, /bootout "\$launchd_domain\/\$old_label"/);
  assert.match(command, /restart_launchd_service/);
  assert.match(command, /run_restart_sudo "\$launchctl_path" kickstart -k "\$service_domain"/);
  assert.match(command, /\/bin\/kill 4321/);
  assert.doesNotMatch(command, /CODEX_HOME='/);
  assert.doesNotMatch(command, /CODEX_MOBILE_RUNTIME_DIR='/);
  assert.doesNotMatch(command, /CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER='/);
  assert.doesNotMatch(command, /launchctl' submit/);
  assert.doesNotMatch(command, /nohup \/usr\/bin\/env/);
  assert.doesNotMatch(command, /CODEX_MOBILE_LAUNCHD_LABEL="\$label"/);
  assert.doesNotMatch(command, /AUTH_KEY/);
  assert.doesNotMatch(command, /Codex\.app/);
  assert.doesNotMatch(command, /osascript/);
});

test("macOS restart service uses explicit profile restart arguments over inherited env", () => {
  const root = path.resolve(__dirname, "..");
  let spawnCall = null;
  const service = createSharedChainRestartService({
    platform: "darwin",
    env: {
      HOME: "/Users/xuefusong",
      XPC_SERVICE_NAME: "com.homeai.plugin.codex-mobile",
      CODEX_HOME: "/Users/xuefusong/.codex-homes/previous",
      CODEX_MOBILE_MUX_ENDPOINT_FILE: "/Users/xuefusong/.codex-homes/previous/app-server-mux/endpoint.json",
      CODEX_MOBILE_PORT: "8789",
      CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER: "1",
    },
    spawn: (exe, args, options) => {
      spawnCall = { exe, args, options };
      return { pid: 24681, unref: () => {} };
    },
    workspacePath: root,
    serverPath: path.join(root, "server.js"),
    nodePath: "/usr/local/bin/node",
    currentPid: 4321,
    launchctlPath: "/bin/launchctl",
    logPath: "/Users/xuefusong/.codex-mobile-web/logs/mobile-web.log",
  });

  service.restart({
    delayMs: 900,
    profileId: "default",
    codexHome: "/Users/xuefusong/.codex",
  });

  assert.match(spawnCall.args[1], /target_profile_id='default'/);
  assert.match(spawnCall.args[1], /target_codex_home='\/Users\/xuefusong\/\.codex'/);
  assert.match(spawnCall.args[1], /target_mux_endpoint_file='\/Users\/xuefusong\/\.codex\/app-server-mux\/endpoint\.json'/);
  assert.doesNotMatch(spawnCall.args[1], /target_codex_home='\/Users\/xuefusong\/\.codex-homes\/previous'/);
  assert.doesNotMatch(spawnCall.args[1], /target_mux_endpoint_file='\/Users\/xuefusong\/\.codex-homes\/previous\/app-server-mux\/endpoint\.json'/);
});

test("macOS restart command falls back to a one-shot nohup listener without a LaunchAgent label", () => {
  const root = path.resolve(__dirname, "..");
  const command = buildRestartMacShellCommand({
    delayMs: 900,
    workspacePath: root,
    serverPath: path.join(root, "server.js"),
    nodePath: "/usr/local/bin/node",
    currentPid: 4321,
    launchctlPath: "/bin/launchctl",
    logPath: "/Users/xuefusong/.codex-mobile-web/logs/mobile-web.log",
    labelPrefix: "com.xuefusong.codex-mobile-web.test",
    port: 8789,
    host: "0.0.0.0",
    codexHome: "/Users/xuefusong/.codex",
    runtimeDir: "/Users/xuefusong/.codex-mobile-web",
    env: {
      CODEX_MOBILE_CODEX_EXE: "/Users/xuefusong/.local/bin/codex",
      CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER: "1",
    },
  });

  assert.match(command, /service_label=''/);
  assert.match(command, /lsof -tiTCP:8789/);
  assert.match(command, /\/bin\/kill "\$pid"/);
  assert.match(command, /nohup \/usr\/bin\/env/);
  assert.match(command, /CODEX_MOBILE_LAUNCHD_LABEL_PREFIX='com\.xuefusong\.codex-mobile-web\.test'/);
  assert.match(command, /\/usr\/local\/bin\/node/);
  assert.match(command, /server\.js/);
  assert.doesNotMatch(command, /launchctl' submit/);
});

test("restart service spawns a detached macOS launchctl restart command", () => {
  const root = path.resolve(__dirname, "..");
  let spawnCall = null;
  let unrefCalled = false;
  const service = createSharedChainRestartService({
    platform: "darwin",
    env: {
      HOME: "/Users/xuefusong",
      XPC_SERVICE_NAME: "com.homeai.plugin.codex-mobile",
      CODEX_HOME: "/Users/xuefusong/.codex",
      CODEX_MOBILE_PORT: "8789",
      CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER: "1",
    },
    spawn: (exe, args, options) => {
      spawnCall = { exe, args, options };
      return {
        pid: 24680,
        unref: () => {
          unrefCalled = true;
        },
      };
    },
    workspacePath: root,
    serverPath: path.join(root, "server.js"),
    nodePath: "/usr/local/bin/node",
    currentPid: 4321,
    launchctlPath: "/bin/launchctl",
    logPath: "/Users/xuefusong/.codex-mobile-web/logs/mobile-web.log",
  });

  const result = service.restart({ delayMs: 900 });

  assert.equal(result.ok, true);
  assert.equal(result.restarting, true);
  assert.equal(result.restartInMs, 900);
  assert.equal(result.pid, 24680);
  assert.equal(result.port, 8789);
  assert.equal(result.mode, "macos-launchctl");
  assert.ok(unrefCalled);
  assert.equal(spawnCall.exe, "/bin/bash");
  assert.deepEqual(spawnCall.args.slice(0, 1), ["-lc"]);
  assert.match(spawnCall.args[1], /restart_launchd_service/);
  assert.match(spawnCall.args[1], /run_restart_sudo "\$launchctl_path" kickstart -k "\$service_domain"/);
  assert.match(spawnCall.args[1], /\/bin\/kill 4321/);
  assert.doesNotMatch(spawnCall.args[1], /launchctl' submit/);
  assert.doesNotMatch(spawnCall.args[1], /CODEX_MOBILE_PORT='8789'/);
  assert.equal(spawnCall.options.detached, true);
  assert.equal(spawnCall.options.stdio, "ignore");
});

test("PowerShell single-quote escaping doubles embedded quotes", () => {
  assert.equal(psQuote("Codex's Mobile"), "'Codex''s Mobile'");
});
