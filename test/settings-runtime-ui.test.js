"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const appBootstrapJs = fs.readFileSync(path.join(root, "public", "app-bootstrap.js"), "utf8");
const settingsRuntimeJs = fs.readFileSync(path.join(root, "public", "settings-runtime.js"), "utf8");
const settingsRuntime = require(path.join(root, "public", "settings-runtime.js"));

test("settings runtime preserves CommonJS and legacy global entry points", () => {
  assert.equal(typeof settingsRuntime.createSettingsRuntime, "function");
  const runtime = settingsRuntime.createSettingsRuntime();
  for (const name of [
    "renderFontSizeControl",
    "renderQuotaUsage",
    "renderCodexProfileSettings",
    "renderWorkspaceDelegationSettings",
    "rememberRateLimitsFromConfig",
    "rememberCodexProfiles",
  ]) {
    assert.equal(typeof runtime[name], "function", `${name} should be exported`);
  }
  for (const name of [
    "saveRestartAutoRecoverThreads",
    "clearRestartAutoRecoverThreads",
    "initializeRestartAutoRecoverThreads",
    "renderQuotaUsage",
    "renderCodexProfileSettings",
    "rememberRateLimitsFromConfig",
    "rememberCodexProfiles",
    "threadDisplayName",
    "statusText",
    "showCompletionAlert",
    "requestSharedRestartConfirmation",
    "refreshPageForNewBuild",
  ]) {
    assert.equal(typeof globalThis[name], "function", `${name} should remain a legacy global`);
  }
  assert.equal(globalThis.CodexSettingsRuntime, settingsRuntime);
  assert.match(settingsRuntimeJs, /module\.exports = settingsRuntimeApi/);
  assert.match(settingsRuntimeJs, /Object\.assign\(root,/);
  assert.match(settingsRuntimeJs, /root\.CodexSettingsRuntime = settingsRuntimeApi/);
  assert.match(appBootstrapJs, /if \(typeof initializeRestartAutoRecoverThreads === "function"\) \{[\s\S]*initializeRestartAutoRecoverThreads\(\);/);
});
