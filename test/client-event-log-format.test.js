"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

test("server client-event log lines include bounded server timestamp", () => {
  const serviceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "server-http-runtime-service.js"), "utf8");
  const start = serviceJs.indexOf("function logClientEvent");
  assert.ok(start >= 0);
  const body = serviceJs.slice(start, serviceJs.indexOf("function isTurnSteerUnsupportedError", start));

  assert.match(body, /ts:\s*new Date\(\)\.toISOString\(\)/);
  assert.match(body, /safeLogDetails\(details\)/);
  assert.doesNotMatch(body, /threadId.*ts|details\.threadId/);
});
