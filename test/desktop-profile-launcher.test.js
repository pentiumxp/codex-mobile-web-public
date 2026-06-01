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

test("desktop profile cmd wrappers call the shared launcher with forced mux restart", () => {
  for (const profile of ["default", "current", "previous"]) {
    const wrapper = fs.readFileSync(path.join(root, `start-codex-desktop-${profile}.cmd`), "utf8");
    assert.match(wrapper, /start-codex-desktop-shared\.ps1/);
    assert.match(wrapper, new RegExp(`-ProfileId ${profile}`));
    assert.match(wrapper, /-ForceRestartMux/);
  }
});
