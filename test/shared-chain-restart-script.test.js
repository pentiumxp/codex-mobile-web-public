"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const script = fs.readFileSync(path.resolve(__dirname, "..", "restart-codex-mobile-shared-chain.ps1"), "utf8");

test("shared-chain restart script waits for both HTTP and mux endpoint readiness", () => {
  assert.match(script, /function Test-HttpReady/);
  assert.match(script, /Invoke-WebRequest -Uri \("http:\/\/127\.0\.0\.1:\{0\}\/" -f \$Port\)/);
  assert.match(script, /function Test-EndpointReady/);
  assert.match(script, /\$EndpointFile/);
  assert.match(script, /while \(\(Get-Date\) -lt \$deadline\) \{/);
  assert.match(script, /\$httpReady = Test-HttpReady/);
  assert.match(script, /\$endpointReady = Test-EndpointReady/);
  assert.match(script, /if \(\$httpReady -and \$endpointReady\) \{/);
  assert.match(script, /Write-RestartLog "Codex Mobile Web shared chain is ready\."/);
});

test("shared-chain restart script resolves mux endpoint from selected Codex profile", () => {
  assert.match(script, /\[string\]\$ProfileId = ""/);
  assert.match(script, /\[string\]\$CodexHome = ""/);
  assert.match(script, /function Resolve-CodexHomeFromProfile/);
  assert.match(script, /codex-profiles\.json/);
  assert.match(script, /\$store\.activeProfileId/);
  assert.match(script, /\$CodexHome = Resolve-CodexHomeFromProfile/);
  assert.match(script, /\$EndpointFile = Join-Path \$CodexHome "app-server-mux\\endpoint\.json"/);
  assert.doesNotMatch(script, /\$CodexHome = Join-Path \$UserProfilePath "\.codex"/);
});

test("shared-chain restart script scopes mux cleanup to selected endpoint pids", () => {
  assert.match(script, /function Get-EndpointProcessIds/);
  assert.match(script, /\$endpoint\.pid/);
  assert.match(script, /\$endpoint\.childPid/);
  assert.match(script, /\$endpointProcessIds = Get-EndpointProcessIds/);
  assert.match(script, /if \(\$endpointProcessIds -contains \[int\]\$_\.ProcessId\) \{/);
  assert.match(script, /if \(\$endpointProcessIds -contains \[int\]\$_\.ProcessId\) \{[\s\S]*codex-app-server-mux\.exe[\s\S]*codex\.exe[\s\S]*\n    \}/);
});

test("shared-chain restart script only reports finished after readiness succeeds", () => {
  assert.match(script, /Start-MobileTask\s+Wait-Ready\s+Write-RestartLog "Shared-chain restart finished\."/s);
  assert.match(script, /throw "Timed out waiting for Codex Mobile Web shared chain to become ready\."/);
});
