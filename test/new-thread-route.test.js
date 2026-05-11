"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");

test("new-message route creates a thread before starting the first turn", () => {
  const routeIndex = serverJs.indexOf("/api/threads/new-message");
  const fallbackIndex = serverJs.indexOf('sendJson(res, 404, { error: "Not found" })');
  assert.ok(routeIndex > 0, "missing /api/threads/new-message route");
  assert.ok(routeIndex < fallbackIndex, "new-message route must run before 404 fallback");

  const routeBody = serverJs.slice(routeIndex, fallbackIndex);
  const threadStartIndex = routeBody.indexOf('codex.request("thread/start"');
  const turnStartIndex = routeBody.indexOf('codex.request("turn/start"');
  assert.ok(threadStartIndex > 0, "new-message route must call thread/start");
  assert.ok(turnStartIndex > threadStartIndex, "new-message route must start the first turn after thread/start");
});
