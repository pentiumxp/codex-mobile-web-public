"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const runtimePath = path.join(root, "public", "event-stream-runtime.js");
const runtimeSource = fs.readFileSync(runtimePath, "utf8");
const eventStreamRuntime = require(runtimePath);

test("event stream runtime exposes CommonJS and classic globals", () => {
  assert.equal(typeof eventStreamRuntime.createEventStreamRuntime, "function");
  const runtime = eventStreamRuntime.createEventStreamRuntime();
  [
    "upsertItem",
    "appendToItem",
    "applyNotification",
    "connectEvents",
    "ensureEventConnection",
    "resumeMobileSession",
    "followThreadOpenToBottom",
    "scheduleBottomFollowScroll",
    "scrollConversationToBottom",
    "updateScrollToBottomButton",
  ].forEach((name) => {
    assert.equal(typeof globalThis[name], "function", `${name} legacy global`);
  });
  [
    "connectEvents",
    "applyNotification",
    "resumeMobileSession",
    "scrollConversationToBottom",
    "updateScrollToBottomButton",
  ].forEach((name) => {
    assert.equal(typeof runtime[name], "function", `${name} factory export`);
  });
  assert.equal(globalThis.CodexEventStreamRuntime, eventStreamRuntime);
  assert.match(runtimeSource, /module\.exports = eventStreamRuntimeApi/);
  assert.match(runtimeSource, /root\.CodexEventStreamRuntime = eventStreamRuntimeApi/);
});
