"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const smoke = require(path.join(__dirname, "..", "scripts", "codex-mobile-projection-replay-visual-smoke.js"));

test("projection replay visual smoke initial report is metadata-only", () => {
  const report = smoke.createInitialReport({
    debugUrl: "https://debug.example.invalid/private/path?token=secret",
    serverUrl: "https://server.example.invalid/api?cookie=value",
    threadId: "thread-private-id",
    targetTurnId: "turn-private-id",
  }, {
    clientBuildId: "0.1.11|codex-mobile-shell-v542",
    shellCacheName: "codex-mobile-shell-v542",
  });

  assert.equal(report.debugEndpoint, "remote");
  assert.equal(report.serverEndpoint, "remote");
  assert.equal(report.threadHash, smoke.stableTextHash("thread-private-id"));
  assert.equal(report.targetTurnHash, smoke.stableTextHash("turn-private-id"));
  assert.equal(report.expectedClientBuildId, "0.1.11|codex-mobile-shell-v542");
  assert.equal(report.expectedShellCacheName, "codex-mobile-shell-v542");
  assert.equal(Object.hasOwn(report, "debugUrl"), false);
  assert.equal(Object.hasOwn(report, "serverUrl"), false);
  assert.equal(Object.hasOwn(report, "threadId"), false);
  assert.equal(Object.hasOwn(report, "targetTurnId"), false);

  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /thread-private-id|turn-private-id|token=secret|cookie=value|debug\.example\.invalid|server\.example\.invalid|private\/path/);
});

test("projection replay visual smoke screenshot result does not expose local paths", () => {
  const result = smoke.safeScreenshotResult("/Users/example/private/projection-replay.png", 24576);

  assert.equal(result.bytes, 24576);
  assert.equal(result.pathHash, smoke.stableTextHash("/Users/example/private/projection-replay.png"));
  assert.equal(Object.hasOwn(result, "path"), false);
  assert.doesNotMatch(JSON.stringify(result), /Users|private|projection-replay\.png/);
});

test("projection replay visual smoke browser report compares API shape to DOM metadata", () => {
  const script = smoke.MEASURE_SCRIPT;

  assert.match(script, /detailComparisonAvailable/);
  assert.match(script, /missingDomTurnCount/);
  assert.match(script, /missingDomItemCount/);
  assert.match(script, /duplicateRenderKeyCount/);
  assert.match(script, /duplicateItemIdCount/);
  assert.match(script, /latestMismatchCount/);
  assert.match(script, /orderMismatchCount/);
  assert.match(script, /visibleKeyForItem/);
  assert.match(script, /visibleKeyHashes/);
  assert.match(script, /renderKeyHashes/);
  assert.match(script, /visibleKeyMismatchCount/);
  assert.match(script, /expected/);
  assert.match(script, /domShape/);
  assert.match(script, /mismatchCounts/);
  assert.match(script, /\/api\/threads\//);
  assert.match(script, /proxyPrefixFromPath/);
  assert.match(script, /hermes-plugins/);
  assert.match(script, /proxy/);

  assert.doesNotMatch(script, /\bthreadId\s*:/);
  assert.doesNotMatch(script, /\btargetTurnId\s*:/);
  assert.doesNotMatch(script, /\bloadedTurnIds\s*:/);
  assert.doesNotMatch(script, /\bitemIds\s*:/);
  assert.doesNotMatch(script, /\brenderKeys\s*:/);
  assert.doesNotMatch(script, /\bexpectedKeyRows\s*:/);
  assert.doesNotMatch(script, /\bdomKeyRows\s*:/);
  assert.doesNotMatch(script, /\bdetailPath\s*:/);
  assert.doesNotMatch(script, /\bhref\s*:/);
  assert.doesNotMatch(script, /\blabel\s*:/);
  assert.doesNotMatch(script, /\btext\s*:/);
  assert.doesNotMatch(script, /innerText|textContent|location\.href/);
});

test("projection replay visual smoke uses safe browser fetch and no raw auth access", () => {
  const script = smoke.MEASURE_SCRIPT;

  assert.match(script, /credentials: "include"/);
  assert.match(script, /headers: \{ "Accept": "application\/json" \}/);
  assert.doesNotMatch(script, /X-Codex-Mobile-Key/);
  assert.doesNotMatch(script, /document\.cookie|codex_mobile_key|codex_mobile_plugin_session/);
  assert.doesNotMatch(script, /Authorization|Bearer|token|secret|password/);
});

test("projection replay visual smoke error reporting is code-only", () => {
  assert.equal(smoke.safeErrorCode(new Error("500:https://host.invalid/path?token=secret")), "http_500");
  assert.equal(smoke.safeErrorCode(new Error("AbortError: operation timed out")), "request_timeout");
  assert.equal(smoke.safeErrorCode(new Error("debug_lane_lease_failed: private detail")), "debug_lane_lease_failed");
  assert.doesNotMatch(smoke.safeErrorCode(new Error("401:https://host.invalid/?cookie=value")), /host|cookie|value/);
});
