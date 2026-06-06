"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const {
  buildRestartMacShellCommand,
  buildRestartPowerShellCommand,
  createSharedChainRestartService,
  psQuote,
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

test("restart service spawns a detached hidden PowerShell process", () => {
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
    workspacePath: root,
    taskName: "Codex Mobile Web",
    port: 8787,
  });

  const result = service.restart({ delayMs: 900 });

  assert.equal(result.ok, true);
  assert.equal(result.restarting, true);
  assert.equal(result.restartInMs, 900);
  assert.equal(result.pid, 12345);
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
  assert.doesNotMatch(decoded, /-CodexHome/);
});

test("macOS restart command restarts the existing LaunchAgent when available", () => {
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
  assert.match(command, /bootout "\$launchd_domain\/\$old_label"/);
  assert.match(command, /kickstart -k "\$launchd_domain\/\$service_label"/);
  assert.match(command, /\/bin\/kill 4321/);
  assert.doesNotMatch(command, /kickstart -k "system\/\$service_label"/);
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
  assert.match(spawnCall.args[1], /kickstart -k "\$launchd_domain\/\$service_label"/);
  assert.match(spawnCall.args[1], /\/bin\/kill 4321/);
  assert.doesNotMatch(spawnCall.args[1], /kickstart -k "system\/\$service_label"/);
  assert.doesNotMatch(spawnCall.args[1], /launchctl' submit/);
  assert.doesNotMatch(spawnCall.args[1], /CODEX_MOBILE_PORT='8789'/);
  assert.equal(spawnCall.options.detached, true);
  assert.equal(spawnCall.options.stdio, "ignore");
});

test("PowerShell single-quote escaping doubles embedded quotes", () => {
  assert.equal(psQuote("Codex's Mobile"), "'Codex''s Mobile'");
});
