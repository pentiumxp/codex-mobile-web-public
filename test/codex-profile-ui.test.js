"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");
const coreApiRouteServiceJs = fs.readFileSync(path.join(root, "server-routes", "core-api-route-service.js"), "utf8");
const codexAppServerClientServiceJs = fs.readFileSync(
  path.join(root, "services", "runtime", "codex-app-server-client-service.js"),
  "utf8",
);
const profileSwitchServiceJs = fs.readFileSync(path.join(root, "adapters", "codex-profile-switch-service.js"), "utf8");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const launcher = fs.readFileSync(path.join(root, "start-codex-mobile-web-windowless.ps1"), "utf8");
const multiAccountDoc = fs.readFileSync(path.join(root, "docs", "MULTI_ACCOUNT_CODEX_CLI.md"), "utf8");

test("settings panel exposes Codex profile account and switch UI", () => {
  assert.match(indexHtml, /id="codexProfileSettings"/);
  assert.match(indexHtml, /id="profileSwitchConfirmDialog"/);
  assert.match(appJs, /function renderCodexProfileSettings\(\)/);
  assert.match(appJs, /function requestCodexProfileSwitchConfirmation\(profileId, label\)/);
  assert.match(appJs, /isHermesEmbedMode\(\)/);
  assert.match(appJs, /profileSwitchConfirmProceed/);
  assert.match(appJs, /codexProfileAccountLabel/);
  assert.match(appJs, /\/api\/codex-profiles\/active/);
  assert.match(appJs, /function clearStoredRateLimits\(\)/);
  assert.match(appJs, /codexProfileSwitchStage/);
  assert.match(appJs, /codexProfileSwitchRequestId/);
  assert.match(appJs, /startCodexProfileSwitchProgressPolling/);
  assert.match(appJs, /\/api\/codex-profiles\/switch-progress\?requestId=/);
  assert.match(appJs, /正在读取目标 Profile/);
  assert.match(appJs, /切换已写入，正在等待服务恢复/);
  assert.match(appJs, /setCodexProfileSwitchStage\(`切换失败：/);
  assert.match(appJs, /showingSwitchProgress/);
  assert.match(appJs, /switchAccepted/);
  assert.match(appJs, /function finishRestartingUiIfReady\(\)/);
  assert.match(appJs, /state\.codexProfileRestarting = false/);
  assert.match(appJs, /state\.codexProfileSwitchTargetId = ""/);
  assert.match(appJs, /state\.codexProfileSwitchRequestId = ""/);
  assert.match(appJs, /codex-profile-progress/);
  assert.match(stylesCss, /\.codex-profile-row/);
  assert.match(stylesCss, /\.profile-switch-confirm-dialog/);
});

test("server exposes profile list and active profile switch endpoints", () => {
  assert.match(serverJs, /createCodexProfileService/);
  assert.match(serverJs, /createCoreApiRouteService/);
  assert.match(codexAppServerClientServiceJs, /codexProfiles:\s*codexProfileService\.profiles\(\{/);
  assert.match(codexAppServerClientServiceJs, /activeQuota:\s*liveQuotaSnapshotForProfiles\(\)/);
  assert.match(coreApiRouteServiceJs, /url\.pathname === "\/api\/codex-profiles"/);
  assert.match(coreApiRouteServiceJs, /url\.pathname === "\/api\/codex-profiles\/switch-progress"/);
  assert.match(coreApiRouteServiceJs, /url\.pathname === "\/api\/codex-profiles\/active"/);
  assert.match(coreApiRouteServiceJs, /setProfileSwitchProgress/);
  assert.match(profileSwitchServiceJs, /target_profile_rate_limits_unavailable/);
  assert.match(coreApiRouteServiceJs, /\[codex-profile-switch\] failed/);
  assert.match(coreApiRouteServiceJs, /sharedChainRestartService\.restart/);
});

test("windowless launcher reads active profile store before starting mux", () => {
  assert.match(launcher, /function Resolve-CodexHomeFromProfileStore/);
  assert.match(launcher, /codex-profiles\.json/);
  assert.match(launcher, /\$profileCodexHome = Resolve-CodexHomeFromProfileStore/);
  assert.match(launcher, /if \(-not \[string\]::IsNullOrWhiteSpace\(\$profileCodexHome\)\) \{/);
  assert.match(launcher, /\$env:CODEX_HOME = \$profileCodexHome/);
  assert.doesNotMatch(launcher, /if \(\[string\]::IsNullOrWhiteSpace\(\$env:CODEX_HOME\)\) \{\s*\$profileCodexHome = Resolve-CodexHomeFromProfileStore/);
  assert.match(launcher, /Ensure-SharedProfileState -ProfilePath \$UserProfilePath -CodexHome \$env:CODEX_HOME/);
  assert.match(launcher, /Start-StandaloneMuxIfNeeded/);
  assert.match(launcher, /Test-MuxEndpoint -EndpointFile \$endpointFile -ExpectedCodexExe \$resolvedCodexExe/);
  assert.match(launcher, /if \(-not \$endpoint\.codexExe\) \{/);
});

test("windowless launcher maps system-task runs back to the target user profile", () => {
  assert.match(launcher, /function Set-TargetUserProfileEnvironment/);
  assert.match(launcher, /\$env:USERPROFILE = \$ProfilePath/);
  assert.match(launcher, /\$env:HOME = \$ProfilePath/);
  assert.match(launcher, /\$env:APPDATA = \$appData/);
  assert.match(launcher, /\$env:LOCALAPPDATA = \$localAppData/);
  assert.match(launcher, /\$env:TEMP = \$tempDir/);
  assert.match(launcher, /\$env:TMP = \$tempDir/);
  assert.match(launcher, /Set-TargetUserProfileEnvironment -ProfilePath \$UserProfilePath/);
  assert.match(launcher, /\$localBin = Join-Path \$env:LOCALAPPDATA "OpenAI\\Codex\\bin"/);
});

test("windowless launcher shares thread state without replacing profile auth", () => {
  assert.match(launcher, /function Backup-ProfileAuthFiles/);
  assert.match(launcher, /profile-auth-backups/);
  assert.match(launcher, /foreach \(\$name in @\("auth\.json", "config\.toml"\)\)/);
  assert.match(launcher, /function Ensure-SharedProfileState/);
  assert.match(launcher, /Name = "state_5\.sqlite"/);
  assert.match(launcher, /Name = "goals_1\.sqlite"/);
  assert.match(launcher, /Name = "\.codex-global-state\.json"/);
  assert.match(launcher, /Name = "session_index\.jsonl"/);
  assert.match(launcher, /Name = "sessions"; Kind = "Directory"/);
  assert.match(launcher, /Name = "archived_sessions"; Kind = "Directory"/);
  assert.match(launcher, /New-Item -ItemType HardLink/);
  assert.match(launcher, /New-Item -ItemType Junction/);
});

test("profile shared-state harness excludes account auth files", () => {
  const sharedStateStart = launcher.indexOf("function Ensure-SharedProfileState");
  const sharedStateEnd = launcher.indexOf("if (-not [string]::IsNullOrWhiteSpace($UserProfilePath))", sharedStateStart);
  assert.ok(sharedStateStart > 0 && sharedStateEnd > sharedStateStart, "missing shared-state launcher body");
  const sharedStateBody = launcher.slice(sharedStateStart, sharedStateEnd);

  assert.match(sharedStateBody, /Backup-ProfileAuthFiles -CodexHome \$CodexHome -RuntimePath \$RuntimePath/);
  assert.match(sharedStateBody, /profile-state-backups/);
  assert.doesNotMatch(sharedStateBody, /Name = "auth\.json"/);
  assert.doesNotMatch(sharedStateBody, /Name = "config\.toml"/);
  assert.match(sharedStateBody, /Name = "state_5\.sqlite-wal"/);
  assert.match(sharedStateBody, /Name = "state_5\.sqlite-shm"/);
  assert.match(sharedStateBody, /Name = "goals_1\.sqlite-wal"/);
  assert.match(sharedStateBody, /Name = "goals_1\.sqlite-shm"/);
});

test("multi-account docs describe current shared-thread-state profile design", () => {
  assert.match(multiAccountDoc, /Each profile\s+keeps its own `auth\.json` and `config\.toml`/);
  assert.match(multiAccountDoc, /Shared by Mobile Web for thread continuity/);
  assert.match(multiAccountDoc, /profile-auth-backups/);
  assert.match(multiAccountDoc, /profile-state-backups/);
  assert.match(multiAccountDoc, /test\/codex-profile-ui\.test\.js/);
  assert.match(multiAccountDoc, /Documentation harness should fail/);
  assert.match(multiAccountDoc, /Historical pre-switcher observation/);
  assert.match(multiAccountDoc, /That old observation is about Desktop GUI isolation, not the current Mobile Web/);
  assert.doesNotMatch(multiAccountDoc, /previous`[\s\S]{0,120}did not yet have `auth\.json`/);
  assert.doesNotMatch(multiAccountDoc, /previous`[\s\S]{0,160}did not[\s\S]{0,40}create `C:\\Users\\xuxin\\\.codex-homes\\previous\\auth\.json`/);
  assert.doesNotMatch(multiAccountDoc, /verify `previous` still has no `auth\.json`/);
});
