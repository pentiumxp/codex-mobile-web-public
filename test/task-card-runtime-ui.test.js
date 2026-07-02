"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const taskCardRuntimeJs = fs.readFileSync(path.join(root, "public", "task-card-runtime.js"), "utf8");
const taskCardRuntime = require(path.join(root, "public", "task-card-runtime.js"));

test("task card runtime preserves CommonJS and legacy global entry points", () => {
  assert.equal(typeof taskCardRuntime.createTaskCardRuntime, "function");
  const runtime = taskCardRuntime.createTaskCardRuntime();
  for (const name of [
    "renderThreadTaskCard",
    "renderThreadTaskCards",
    "createThreadTaskCardFromCurrent",
    "renderApprovalRequest",
  ]) {
    assert.equal(typeof runtime[name], "function", `${name} should be exported`);
  }
  for (const name of [
    "threadTaskCardCommandText",
    "parseThreadTaskCardDraftText",
    "renderThreadTaskCard",
    "renderThreadTaskCards",
    "renderApprovalRequest",
    "createThreadTaskCardFromCurrent",
    "refreshCurrentThreadAfterTaskCard",
    "waitForContinuationJob",
  ]) {
    assert.equal(typeof globalThis[name], "function", `${name} should remain a legacy global`);
  }
  assert.equal(globalThis.CodexTaskCardRuntime, taskCardRuntime);
  assert.match(taskCardRuntimeJs, /module\.exports = taskCardRuntimeApi/);
  assert.match(taskCardRuntimeJs, /root\.CodexTaskCardRuntime = taskCardRuntimeApi/);
});
