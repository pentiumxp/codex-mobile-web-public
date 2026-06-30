"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

test("server client-event log lines include bounded server timestamp", () => {
  const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
  const start = serverJs.indexOf("function logClientEvent");
  assert.ok(start >= 0);
  const body = serverJs.slice(start, serverJs.indexOf("function truncateMiddle", start));

  assert.match(body, /ts:\s*new Date\(\)\.toISOString\(\)/);
  assert.match(body, /safeLogDetails\(details\)/);
  assert.doesNotMatch(body, /threadId.*ts|details\.threadId/);
});
