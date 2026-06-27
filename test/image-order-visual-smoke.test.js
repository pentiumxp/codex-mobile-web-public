"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const smoke = require(path.join(__dirname, "..", "scripts", "codex-mobile-image-order-visual-smoke.js"));

test("image-order visual smoke initial report exposes hashes instead of raw ids or urls", () => {
  const report = smoke.createInitialReport({
    debugUrl: "https://debug.example.invalid/private/path?token=secret",
    threadId: "thread-private-id",
    targetTurnId: "turn-private-id",
  });

  assert.equal(report.debugEndpoint, "remote-debug");
  assert.equal(report.threadHash, smoke.stableTextHash("thread-private-id"));
  assert.equal(report.targetTurnHash, smoke.stableTextHash("turn-private-id"));
  assert.equal(Object.hasOwn(report, "debugUrl"), false);
  assert.equal(Object.hasOwn(report, "threadId"), false);
  assert.equal(Object.hasOwn(report, "targetTurnId"), false);

  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /thread-private-id|turn-private-id|token=secret|debug\.example\.invalid|private\/path/);
});

test("image-order visual smoke screenshot result does not expose local paths", () => {
  const result = smoke.safeScreenshotResult("/Users/example/private/thread-image-order.png", 8192);

  assert.equal(result.bytes, 8192);
  assert.equal(result.pathHash, smoke.stableTextHash("/Users/example/private/thread-image-order.png"));
  assert.equal(Object.hasOwn(result, "path"), false);
  assert.doesNotMatch(JSON.stringify(result), /Users|private|thread-image-order\.png/);
});

test("image-order visual smoke error reporting is code-only", () => {
  assert.equal(smoke.safeErrorCode(new Error("500:https://host.invalid/path?token=secret")), "http_500");
  assert.equal(smoke.safeErrorCode(new Error("AbortError: operation timed out")), "request_timeout");
  assert.equal(smoke.safeErrorCode(new Error("debug_lane_lease_failed: private detail")), "debug_lane_lease_failed");
  assert.doesNotMatch(smoke.safeErrorCode(new Error("401:https://host.invalid/?cookie=value")), /host|cookie|value/);
});

test("image-order visual smoke browser report script is metadata-only", () => {
  const script = smoke.MEASURE_SCRIPT;

  assert.match(script, /turnHash:/);
  assert.match(script, /targetTurnHash/);
  assert.match(script, /loadedTurnHashes:/);
  assert.match(script, /itemHash:/);
  assert.match(script, /routeKind:/);

  assert.doesNotMatch(script, /\bthreadId\s*:/);
  assert.doesNotMatch(script, /\btargetTurnId\s*:/);
  assert.doesNotMatch(script, /\bloadedTurnIds\s*:/);
  assert.doesNotMatch(script, /\bitemId\s*:/);
  assert.doesNotMatch(script, /\bturnId\s*:/);
  assert.doesNotMatch(script, /\bhref\s*:/);
  assert.doesNotMatch(script, /\blabel\s*:/);
  assert.doesNotMatch(script, /\btext\s*:/);
  assert.doesNotMatch(script, /innerText|textContent|location\.href/);
});
