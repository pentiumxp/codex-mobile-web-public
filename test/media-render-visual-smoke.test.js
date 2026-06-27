"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const smoke = require(path.join(__dirname, "..", "scripts", "codex-mobile-media-render-visual-smoke.js"));

test("media render visual smoke initial report is metadata-only", () => {
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

test("media render visual smoke classifies image routes without leaking values", () => {
  assert.equal(smoke.imageRouteKind("/api/generated-images/file?id=thread%2Fimage.png&key=session-key"), "generated-image");
  assert.equal(smoke.imageRouteKind("/api/uploads/file?id=2026-06-23%2Fthread%2Fupload.jpg&key=session-key"), "upload");
  assert.equal(smoke.imageRouteKind("/api/hermes-plugins/codex-mobile/proxy/api/generated-images/file?id=thread%2Fimage.png&key=session-key"), "hermes-proxy-generated-image");
  assert.equal(smoke.imageRouteKind("/api/hermes-plugins/codex-mobile/proxy/api/uploads/file?id=2026-06-23%2Fthread%2Fupload.jpg&key=session-key"), "hermes-proxy-upload");
  assert.equal(smoke.imageRouteKind("data:image/png;base64,abc123"), "data-image");
  assert.equal(smoke.imageRouteKind("blob:http://127.0.0.1:8787/local-preview"), "blob");
  assert.equal(smoke.imageRouteKind("/Users/xuxin/.codex-mobile-web/uploads/private.jpg"), "local-path-leak");
  assert.equal(smoke.imageRouteKind("/api/uploads/file?path=%2FUsers%2Fxuxin%2Fsecret.jpg&key=session-key"), "local-path-leak");
});

test("media render visual smoke screenshot result does not expose local paths", () => {
  const result = smoke.safeScreenshotResult("/Users/example/private/media-render.png", 16384);

  assert.equal(result.bytes, 16384);
  assert.equal(result.pathHash, smoke.stableTextHash("/Users/example/private/media-render.png"));
  assert.equal(Object.hasOwn(result, "path"), false);
  assert.doesNotMatch(JSON.stringify(result), /Users|private|media-render\.png/);
});

test("media render visual smoke browser report is bounded DOM metadata", () => {
  const script = smoke.MEASURE_SCRIPT;

  assert.match(script, /displayRouteKind/);
  assert.match(script, /protectedRouteKind/);
  assert.match(script, /routeCounts/);
  assert.match(script, /sourceHash/);
  assert.match(script, /localPathLeakCount/);
  assert.match(script, /proxyUnsafeCount/);
  assert.match(script, /naturalWidth/);
  assert.match(script, /naturalHeight/);
  assert.match(script, /sampleRows/);

  assert.doesNotMatch(script, /\bthreadId\s*:/);
  assert.doesNotMatch(script, /\btargetTurnId\s*:/);
  assert.doesNotMatch(script, /\bloadedTurnIds\s*:/);
  assert.doesNotMatch(script, /\bdisplayValue\s*:/);
  assert.doesNotMatch(script, /\bprotectedValue\s*:/);
  assert.doesNotMatch(script, /\bcurrentSrc\s*:/);
  assert.doesNotMatch(script, /\bhref\s*:/);
  assert.doesNotMatch(script, /\blabel\s*:/);
  assert.doesNotMatch(script, /\btext\s*:/);
  assert.doesNotMatch(script, /innerText|textContent|location\.href/);
});

test("media render visual smoke error reporting is code-only", () => {
  assert.equal(smoke.safeErrorCode(new Error("500:https://host.invalid/path?token=secret")), "http_500");
  assert.equal(smoke.safeErrorCode(new Error("AbortError: operation timed out")), "request_timeout");
  assert.equal(smoke.safeErrorCode(new Error("debug_lane_lease_failed: private detail")), "debug_lane_lease_failed");
  assert.doesNotMatch(smoke.safeErrorCode(new Error("401:https://host.invalid/?cookie=value")), /host|cookie|value/);
});
