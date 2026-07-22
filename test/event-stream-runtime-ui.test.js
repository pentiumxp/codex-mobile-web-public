"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const runtimePath = path.join(root, "public", "event-stream-runtime.js");
const runtimeSource = fs.readFileSync(runtimePath, "utf8");
const eventStreamRuntime = require(runtimePath);

function functionSource(source, name) {
  const marker = `function ${name}(`;
  const asyncMarker = `async ${marker}`;
  let start = source.indexOf(asyncMarker);
  if (start < 0) start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing function ${name}`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`could not parse function ${name}`);
}

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

test("mobile resume single-flight coalesces overlapping high-latency resumes", async () => {
  const source = functionSource(runtimeSource, "runMobileResumeSingleFlight");
  const harness = Function(`
const state = { resumeInFlight: null, currentThreadId: "thread-1" };
let calls = 0;
const events = [];
let release;
function postClientEvent(name, details) { events.push({ name, details }); }
function resumeMobileSession(reason) {
  calls += 1;
  return new Promise((resolve) => { release = () => resolve(reason); });
}
${source}
return {
  run: runMobileResumeSingleFlight,
  calls: () => calls,
  events,
  release: () => release(),
  inFlight: () => state.resumeInFlight,
};
`)();

  const first = harness.run("pageshow");
  const second = harness.run("orientation");
  assert.equal(harness.calls(), 1);
  assert.equal(harness.events.length, 1);
  assert.equal(harness.events[0].name, "mobile_resume_coalesced");
  harness.release();
  assert.deepEqual(await Promise.all([first, second]), ["pageshow", "pageshow"]);
  assert.equal(harness.inFlight(), null);
});
