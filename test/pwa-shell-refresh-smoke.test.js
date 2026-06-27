"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const smoke = require(path.join(__dirname, "..", "scripts", "codex-mobile-pwa-shell-refresh-smoke.js"));

test("PWA shell refresh smoke initial report is bounded", () => {
  const report = smoke.createInitialReport({
    debugUrl: "https://debug.example.invalid/private/path?token=secret",
    serverUrl: "https://server.example.invalid/api?cookie=value",
  }, {
    clientBuildId: "0.1.11|codex-mobile-shell-v542",
    shellCacheName: "codex-mobile-shell-v542",
  });

  assert.equal(report.debugEndpoint, "remote");
  assert.equal(report.serverEndpoint, "remote");
  assert.equal(report.expectedClientBuildId, "0.1.11|codex-mobile-shell-v542");
  assert.equal(report.expectedShellCacheName, "codex-mobile-shell-v542");
  assert.equal(Object.hasOwn(report, "debugUrl"), false);
  assert.equal(Object.hasOwn(report, "serverUrl"), false);

  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /token=secret|cookie=value|debug\.example\.invalid|server\.example\.invalid|private\/path/);
});

test("PWA shell refresh smoke screenshot result does not expose local paths", () => {
  const result = smoke.safeScreenshotResult("/Users/example/private/pwa-shell-refresh.png", 12288);

  assert.equal(result.bytes, 12288);
  assert.equal(result.pathHash, smoke.stableTextHash("/Users/example/private/pwa-shell-refresh.png"));
  assert.equal(Object.hasOwn(result, "path"), false);
  assert.doesNotMatch(JSON.stringify(result), /Users|private|pwa-shell-refresh\.png/);
});

test("PWA shell refresh smoke browser report checks refresh contract without text capture", () => {
  const script = smoke.MEASURE_SCRIPT;

  assert.match(script, /clientBuildMatches/);
  assert.match(script, /appVisible/);
  assert.match(script, /bootRecoveryHidden/);
  assert.match(script, /hardRefreshPresent/);
  assert.match(script, /pageRefreshPromptPresent/);
  assert.match(script, /refreshPageForNewBuild/);
  assert.match(script, /clearAllShellCaches/);
  assert.match(script, /resetPageShellServiceWorker/);
  assert.match(script, /serviceWorker/);
  assert.match(script, /caches/);

  assert.doesNotMatch(script, /location\.href|innerText|textContent/);
  assert.doesNotMatch(script, /\bdebugUrl\b|\bserverUrl\b|\bpathname\b/);
  assert.doesNotMatch(script, /\btitle\s*:/);
  assert.doesNotMatch(script, /\btext\s*:/);
});

test("PWA shell refresh smoke error reporting is code-only", () => {
  assert.equal(smoke.safeErrorCode(new Error("503:https://host.invalid/path?token=secret")), "http_503");
  assert.equal(smoke.safeErrorCode(new Error("AbortError: operation timed out")), "request_timeout");
  assert.equal(smoke.safeErrorCode(new Error("screenshot_failed:/Users/private/file.png")), "screenshot_failed");
  assert.doesNotMatch(smoke.safeErrorCode(new Error("401:https://host.invalid/?cookie=value")), /host|cookie|value/);
});
