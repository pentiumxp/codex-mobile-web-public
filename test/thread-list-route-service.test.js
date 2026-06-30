"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { handleThreadListRoute } = require("../adapters/thread-list-route-service");

test("thread-list route service ignores unrelated routes", async () => {
  assert.deepEqual(await handleThreadListRoute({
    url: new URL("http://127.0.0.1/api/status"),
    method: "GET",
  }), { handled: false });
});

test("thread-list route service marks early workspace visibility responses as handled", async () => {
  const responses = [];

  const result = await handleThreadListRoute({
    url: new URL("http://127.0.0.1/api/threads?cwd=/hidden"),
    method: "GET",
    sendJson: (status, body) => responses.push({ status, body }),
    readGlobalState: () => ({}),
    visibilityFromGlobalState: () => ({ workspaceKeys: new Set(["/visible"]) }),
    normalizeFsPath: (value) => value,
    threadListDefaultWarmFallbackEnabled: true,
  });

  assert.deepEqual(result, { handled: true });
  assert.deepEqual(responses, [{ status: 200, body: { data: [] } }]);
});
