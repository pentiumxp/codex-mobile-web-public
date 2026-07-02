"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const notificationUiRuntimeJs = fs.readFileSync(path.join(root, "public", "notification-ui-runtime.js"), "utf8");
const notificationUiRuntime = require(path.join(root, "public", "notification-ui-runtime.js"));

test("notification UI runtime preserves CommonJS and legacy global entry points", () => {
  assert.equal(typeof notificationUiRuntime.createNotificationUiRuntime, "function");
  const runtime = notificationUiRuntime.createNotificationUiRuntime();
  for (const name of [
    "handlePluginVoiceInputMessage",
    "requestHermesPluginRefresh",
    "showPluginEmbedRecovering",
    "showLogin",
    "showApp",
    "bootstrap",
  ]) {
    assert.equal(typeof runtime[name], "function", `${name} should be exported`);
  }
  for (const name of [
    "showApp",
    "showLogin",
    "bootstrap",
    "sortTurnsForDisplay",
    "requestHermesPluginRefresh",
    "handleServiceWorkerMessage",
    "applyUrlThreadSelection",
    "publishPluginVoiceInputCapability",
  ]) {
    assert.equal(typeof globalThis[name], "function", `${name} should remain a legacy global`);
  }
  assert.equal(globalThis.CodexNotificationUiRuntime, notificationUiRuntime);
  assert.match(notificationUiRuntimeJs, /module\.exports = notificationUiRuntimeApi/);
  assert.match(notificationUiRuntimeJs, /root\.CodexNotificationUiRuntime = notificationUiRuntimeApi/);
});
