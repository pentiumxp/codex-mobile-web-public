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
    "frontendDiagnosticLogStatus",
    "configureFrontendDiagnosticLog",
    "recordFrontendDiagnosticLog",
    "recordSubmittedEchoDiagnosticLog",
    "clearFrontendDiagnosticLog",
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
  assert.equal(typeof globalThis.CodexFrontendLog, "object");
  assert.equal(typeof globalThis.CodexFrontendLog.enable, "function");
});

test("frontend diagnostic log is switchable, persistent, bounded, and metadata-only", () => {
  const store = new Map();
  const posted = [];
  globalThis.localStorage = {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  globalThis.window = {
    location: { href: "http://127.0.0.1:8787/?codexFrontendLog=0" },
  };
  globalThis.location = { pathname: "/thread/test-thread" };
  globalThis.document = { visibilityState: "visible" };
  Object.defineProperty(globalThis, "navigator", {
    value: {},
    configurable: true,
  });
  globalThis.fetch = (url, options = {}) => {
    posted.push({ url, body: options.body || "" });
    return Promise.resolve({ ok: true });
  };
  globalThis.state = {
    key: "access-key",
    currentThreadId: "thread-a",
    threadTileMode: false,
    perfEventLastReportedAt: {},
  };
  globalThis.CLIENT_BUILD_ID = "test-build";
  globalThis.isHermesEmbedMode = () => false;
  globalThis.isHermesPluginPrimaryPage = () => false;
  globalThis.homeAiDiagnosticReportingApi = {
    hashIdentifier: (value, prefix = "h") => `${prefix}${String(value || "").length}`,
    durationBucket: () => "lt_1s",
    boundedToken: (value, fallback) => String(value || fallback || "").slice(0, 100),
  };

  const runtime = apiClientRuntime.createApiClientRuntime();

  assert.equal(runtime.recordFrontendDiagnosticLog("submitted_echo_lifecycle", {
    scope: "submitted_echo",
    text: "raw private message",
  }), false);

  const status = runtime.configureFrontendDiagnosticLog({
    enabled: true,
    scopes: ["submitted_echo"],
    upload: true,
    maxEntries: 25,
  });
  assert.equal(status.enabled, true);

  runtime.recordFrontendDiagnosticLog("submitted_echo_lifecycle", {
    scope: "submitted_echo",
    threadId: "thread-a",
    text: "raw private message",
    safeStage: "submit-start",
  });
  runtime.recordFrontendDiagnosticLog("submitted_echo_lifecycle", {
    scope: "submitted_echo",
    threadId: "thread-a",
    message: "another raw message",
    safeStage: "post-response",
  });
  runtime.recordFrontendDiagnosticLog("submitted_echo_lifecycle", {
    scope: "submitted_echo",
    threadId: "thread-a",
    safeStage: "dom-probe",
  });
  for (let index = 0; index < 25; index += 1) {
    runtime.recordFrontendDiagnosticLog("submitted_echo_lifecycle", {
      scope: "submitted_echo",
      threadId: "thread-a",
      safeStage: `sample-${index}`,
    });
  }

  const entries = runtime.readFrontendDiagnosticLog();
  const serializedEntries = JSON.stringify(entries);
  assert.equal(entries.length, 25);
  assert.equal(serializedEntries.includes("raw private message"), false);
  assert.equal(serializedEntries.includes("another raw message"), false);
  assert.equal(entries[0].scope, "submitted_echo");
  assert.equal(posted.length, 28);
  assert.equal(JSON.stringify(posted).includes("raw private message"), false);

  assert.equal(runtime.clearFrontendDiagnosticLog(), true);
  assert.deepEqual(runtime.readFrontendDiagnosticLog(), []);
  runtime.setFrontendDiagnosticLogEnabled(false);
});
