"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

test("server client-event log lines include bounded server timestamp", () => {
  const serviceJs = fs.readFileSync(path.resolve(__dirname, "..", "services", "runtime", "server-http-runtime-service.js"), "utf8");
  const appendStart = serviceJs.indexOf("function appendRuntimeEventLine");
  assert.ok(appendStart >= 0);
  const appendBody = serviceJs.slice(appendStart, serviceJs.indexOf("function logThreadDetail", appendStart));
  const clientStart = serviceJs.indexOf("function logClientEvent");
  assert.ok(clientStart >= 0);
  const clientBody = serviceJs.slice(clientStart, serviceJs.indexOf("function isTurnSteerUnsupportedError", clientStart));

  assert.match(appendBody, /ts:\s*new Date\(now\)\.toISOString\(\)/);
  assert.match(appendBody, /safeLogDetails\(details\)/);
  assert.match(clientBody, /appendRuntimeEventLine\("client-event", event, details/);
  assert.match(clientBody, /frontend_diagnostic_log/);
  assert.doesNotMatch(appendBody, /threadId.*ts|details\.threadId/);
});
