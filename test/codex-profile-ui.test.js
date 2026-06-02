"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const launcher = fs.readFileSync(path.join(root, "start-codex-mobile-web-windowless.ps1"), "utf8");

test("settings panel exposes Codex profile account and switch UI", () => {
  assert.match(indexHtml, /id="codexProfileSettings"/);
  assert.match(appJs, /function renderCodexProfileSettings\(\)/);
  assert.match(appJs, /codexProfileAccountLabel/);
  assert.match(appJs, /\/api\/codex-profiles\/active/);
  assert.match(appJs, /function clearStoredRateLimits\(\)/);
  assert.match(appJs, /clearStoredRateLimits\(\);\s*\$\("connectionState"\)\.textContent = "Switching Codex profile\.\.\."/);
  assert.match(stylesCss, /\.codex-profile-row/);
});

test("server exposes profile list and active profile switch endpoints", () => {
  assert.match(serverJs, /createCodexProfileService/);
  assert.match(serverJs, /codexProfiles:\s*codexProfileService\.profiles\(\{/);
  assert.match(serverJs, /activeQuota:\s*\{\s*rateLimits:\s*activeRateLimits\(\)/);
  assert.match(serverJs, /url\.pathname === "\/api\/codex-profiles"/);
  assert.match(serverJs, /url\.pathname === "\/api\/codex-profiles\/active"/);
  assert.match(serverJs, /sharedChainRestartService\.restart/);
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
});

test("windowless launcher shares thread state without replacing profile auth", () => {
  assert.match(launcher, /function Backup-ProfileAuthFiles/);
  assert.match(launcher, /profile-auth-backups/);
  assert.match(launcher, /foreach \(\$name in @\("auth\.json", "config\.toml"\)\)/);
  assert.match(launcher, /function Ensure-SharedProfileState/);
  assert.match(launcher, /Name = "state_5\.sqlite"/);
  assert.match(launcher, /Name = "\.codex-global-state\.json"/);
  assert.match(launcher, /Name = "session_index\.jsonl"/);
  assert.match(launcher, /Name = "sessions"; Kind = "Directory"/);
  assert.match(launcher, /Name = "archived_sessions"; Kind = "Directory"/);
  assert.match(launcher, /New-Item -ItemType HardLink/);
  assert.match(launcher, /New-Item -ItemType Junction/);
});
