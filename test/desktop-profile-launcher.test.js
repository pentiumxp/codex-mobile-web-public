"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const launcher = fs.readFileSync(path.join(root, "start-codex-desktop-shared.ps1"), "utf8");
const hiddenLauncher = fs.readFileSync(path.join(root, "start-codex-desktop-shared-hidden.vbs"), "utf8");
const mobileLauncher = fs.readFileSync(path.join(root, "start-codex-mobile-web.ps1"), "utf8");
const mobileWindowlessLauncher = fs.readFileSync(path.join(root, "start-codex-mobile-web-windowless.ps1"), "utf8");
const muxShim = fs.readFileSync(path.join(root, "codex-app-server-mux-shim.cs"), "utf8");
const muxJs = fs.readFileSync(path.join(root, "codex-app-server-mux.js"), "utf8");
const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");
const codexAppServerClientServiceJs = fs.readFileSync(path.join(root, "adapters", "codex-app-server-client-service.js"), "utf8");

test("desktop shared launcher can select a Codex profile home", () => {
  assert.match(launcher, /\[string\]\$ProfileId = ""/);
  assert.match(launcher, /\[string\]\$CodexHome = ""/);
  assert.match(launcher, /function Resolve-CodexHomeFromProfile/);
  assert.match(launcher, /Join-Path \(Join-Path \$UserProfilePath "\.codex-homes"\) \$profile/);
  assert.match(launcher, /\$env:CODEX_HOME = \$selectedCodexHome/);
});

test("desktop shared launcher uses the selected profile mux endpoint", () => {
  assert.match(launcher, /\$MuxCommand = Join-Path \$scriptRoot "codex-app-server-mux-win\.exe"/);
  assert.match(launcher, /\$endpointFile = Join-Path \$selectedCodexHome "app-server-mux\\endpoint\.json"/);
  assert.doesNotMatch(launcher, /\$endpointFile = Join-Path \$env:USERPROFILE "\.codex\\app-server-mux\\endpoint\.json"/);
  assert.match(launcher, /Write-Host "  CODEX_HOME=\$env:CODEX_HOME"/);
});

test("desktop shared launcher prepares non-auth shared profile state", () => {
  assert.match(launcher, /function Ensure-SharedProfileState/);
  assert.match(
    launcher,
    /Ensure-SharedProfileState -ProfilePath \$env:USERPROFILE -CodexHome \$selectedCodexHome -RuntimePath \$runtimeRoot/,
  );
  for (const name of [
    ".codex-global-state.json",
    "state_5.sqlite",
    "state_5.sqlite-wal",
    "state_5.sqlite-shm",
    "goals_1.sqlite",
    "goals_1.sqlite-wal",
    "goals_1.sqlite-shm",
    "session_index.jsonl",
    "sessions",
    "archived_sessions",
  ]) {
    assert.match(launcher, new RegExp(`Name = "${name.replace(/[.]/g, "\\.")}"`));
  }
  const sharedStateList = launcher.match(
    /\$backupRoot = Join-Path \(Join-Path \$RuntimePath "profile-state-backups"\)[\s\S]*?foreach \(\$item in @\(([\s\S]*?)\)\) \{\r?\n\s*Ensure-LinkedStatePath/,
  );
  assert.ok(sharedStateList);
  assert.doesNotMatch(sharedStateList[1], /auth\.json/);
  assert.doesNotMatch(sharedStateList[1], /config\.toml/);
});

test("desktop profile cmd wrappers use the hidden shared launcher", () => {
  for (const profile of ["default", "current", "previous"]) {
    const wrapper = fs.readFileSync(path.join(root, `start-codex-desktop-${profile}.cmd`), "utf8");
    assert.match(wrapper, /start "" wscript\.exe "%~dp0start-codex-desktop-shared-hidden\.vbs"/);
    assert.match(wrapper, new RegExp(`-ProfileId ${profile}`));
    assert.match(wrapper, /-ForceRestartMux/);
    assert.match(wrapper, /exit \/b 0/);
    assert.doesNotMatch(wrapper, /powershell\.exe/i);
    assert.doesNotMatch(wrapper, /start-codex-desktop-shared\.ps1/);
  }
});

test("desktop mux shim starts its node child without a visible window", () => {
  assert.match(launcher, /\/target:winexe/);
  assert.doesNotMatch(launcher, /\/target:exe/);
  assert.match(muxShim, /codex-app-server-mux-shim 2/);
  assert.match(muxShim, /CREATE_NO_WINDOW = 0x08000000/);
  assert.match(muxShim, /STARTF_USESHOWWINDOW = 0x00000001/);
  assert.match(muxShim, /SW_HIDE = 0/);
  assert.match(muxShim, /STARTF_USESTDHANDLES \| STARTF_USESHOWWINDOW/);
  assert.match(muxShim, /startupInfo\.wShowWindow = SW_HIDE/);
  assert.match(muxShim, /CREATE_NO_WINDOW,\s*\r?\n\s*IntPtr\.Zero,\s*\r?\n\s*workingDirectory,/);
});

test("desktop hidden launcher wraps PowerShell through WScript", () => {
  assert.match(hiddenLauncher, /CreateObject\("WScript\.Shell"\)/);
  assert.match(hiddenLauncher, /start-codex-desktop-shared\.ps1/);
  assert.match(hiddenLauncher, /-WindowStyle Hidden/);
  assert.match(hiddenLauncher, /shell\.Run command, 0, True/);
});

test("mobile app-server launchers do not leak desktop bridge env into real CLI", () => {
  assert.match(mobileLauncher, /function Clear-DesktopBridgeEnvironment/);
  assert.match(mobileLauncher, /Remove-Item Env:\\CODEX_CLI_PATH/);
  assert.match(mobileLauncher, /Get-ChildItem Env:CODEX_MUX_\*/);
  assert.match(mobileLauncher, /Clear-DesktopBridgeEnvironment/);

  assert.match(mobileWindowlessLauncher, /function Save-AndClearCodexBridgeEnvironment/);
  assert.match(mobileWindowlessLauncher, /function Restore-CodexBridgeEnvironment/);
  assert.match(mobileWindowlessLauncher, /Remove-Item Env:\\CODEX_CLI_PATH/);
  assert.match(mobileWindowlessLauncher, /Get-ChildItem Env:CODEX_MUX_\*/);
  assert.match(mobileWindowlessLauncher, /\$oldBridgeEnvironment = Save-AndClearCodexBridgeEnvironment/);
  assert.match(mobileWindowlessLauncher, /Restore-CodexBridgeEnvironment -Saved \$oldBridgeEnvironment/);

  assert.match(serverJs, /function codexAppServerChildEnv/);
  assert.match(serverJs, /key === "CODEX_CLI_PATH" \|\| key\.startsWith\("CODEX_MUX_"\)/);
  assert.match(codexAppServerClientServiceJs, /env: codexAppServerChildEnv\(\{ CODEX_HOME \}\)/);
  assert.match(muxJs, /function realCodexChildEnv/);
  assert.match(muxJs, /key === "CODEX_CLI_PATH" \|\| key\.startsWith\("CODEX_MUX_"\)/);
  assert.match(muxJs, /env: realCodexChildEnv\(\)/);
});
