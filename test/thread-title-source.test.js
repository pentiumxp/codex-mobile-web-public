"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");

test("thread detail refreshes display title from app-server summary", () => {
  assert.match(serverJs, /function mergeThreadDisplaySummary\(base, display\)/);
  assert.match(serverJs, /summary = mergeThreadDisplaySummary\(summary, appServerSummary\);/);
  assert.match(serverJs, /summarySource = `\$\{summarySource\}\+app-server`;/);
});

test("thread display summary keeps local runtime fields while accepting display fields", () => {
  const helperStart = serverJs.indexOf("function mergeThreadDisplaySummary(base, display)");
  assert.notEqual(helperStart, -1, "missing mergeThreadDisplaySummary helper");
  const helperEnd = serverJs.indexOf("function mergeThreadRuntimeFromStateDb", helperStart);
  assert.ok(helperEnd > helperStart, "helper should be placed before runtime merge");
  const helperBody = serverJs.slice(helperStart, helperEnd);

  assert.match(helperBody, /Object\.assign\(\{\}, base\)/);
  assert.match(helperBody, /for \(const key of \["name", "preview", "cwd"\]\)/);
  assert.match(helperBody, /displayUpdatedAtMs[\s\S]*>= baseUpdatedAtMs/);
  assert.match(helperBody, /shouldReplaceThreadDisplayStatus\(base\.status, display\.status, baseUpdatedAtMs, displayUpdatedAtMs\)/);
  assert.doesNotMatch(helperBody, /if \(display\.status\) next\.status = display\.status;/);
  assert.doesNotMatch(helperBody, /model|effort|sandboxPolicy|approvalPolicy/);
});
