"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const launcher = fs.readFileSync(path.join(root, "start-codex-desktop-shared.ps1"), "utf8");

test("desktop shared launcher can select a Codex profile home", () => {
  assert.match(launcher, /\[string\]\$ProfileId = ""/);
  assert.match(launcher, /\[string\]\$CodexHome = ""/);
  assert.match(launcher, /function Resolve-CodexHomeFromProfile/);
  assert.match(launcher, /Join-Path \(Join-Path \$UserProfilePath "\.codex-homes"\) \$profile/);
  assert.match(launcher, /\$env:CODEX_HOME = \$selectedCodexHome/);
});

test("desktop shared launcher uses the selected profile mux endpoint", () => {
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

test("desktop profile cmd wrappers call the shared launcher with forced mux restart", () => {
  for (const profile of ["default", "current", "previous"]) {
    const wrapper = fs.readFileSync(path.join(root, `start-codex-desktop-${profile}.cmd`), "utf8");
    assert.match(wrapper, /start-codex-desktop-shared\.ps1/);
    assert.match(wrapper, new RegExp(`-ProfileId ${profile}`));
    assert.match(wrapper, /-ForceRestartMux/);
  }
});
