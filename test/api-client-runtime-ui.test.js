"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const apiClientRuntimeJs = fs.readFileSync(path.join(root, "public", "api-client-runtime.js"), "utf8");
const apiClientRuntime = require(path.join(root, "public", "api-client-runtime.js"));

test("api client runtime preserves CommonJS and legacy global entry points", () => {
  assert.equal(typeof apiClientRuntime.createApiClientRuntime, "function");
  const runtime = apiClientRuntime.createApiClientRuntime();
  assert.ok(Object.keys(runtime).length >= 70);
  for (const name of [
    "api",
    "postClientEvent",
    "postPerformanceEvent",
    "diagnosticThreadHash",
    "recordHomeAiDiagnosticFailure",
    "recordHomeAiDiagnosticSuccess",
    "scheduleSubmittedMessageDomProbe",
    "recordThreadDetailResponseDiagnostics",
    "checkConversationProjectionConsistency",
    "initializePushControls",
    "handlePushButtonClick",
  ]) {
    assert.equal(typeof runtime[name], "function", `${name} should be exported`);
    assert.equal(typeof globalThis[name], "function", `${name} should remain a legacy global`);
  }
  assert.equal(globalThis.CodexApiClientRuntime, apiClientRuntime);
  assert.match(apiClientRuntimeJs, /module\.exports = apiClientRuntimeApi/);
  assert.match(apiClientRuntimeJs, /root\.CodexApiClientRuntime = apiClientRuntimeApi/);
});
