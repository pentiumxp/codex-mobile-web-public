"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const { createApiDispatchRouteService } = require("../adapters/api-dispatch-route-service");

test("api dispatch thread detail route uses injected lifecycle tracker", async () => {
  let lifecycleTracked = false;
  let detailHandled = false;
  let sent = null;
  const req = { method: "GET", url: "/api/threads/thread-123?mode=recent" };
  const res = {
    once(event, callback) {
      assert.ok(["finish", "close"].includes(event));
      assert.equal(typeof callback, "function");
    },
  };
  const service = createApiDispatchRouteService({
    MAX_THREAD_TURNS: 10,
    READ_RPC_TIMEOUT_MS: 1000,
    CODEX_HOME: "/tmp/codex-home",
    coreApiRouteService: {
      handlePublicRoute: async () => ({ handled: false }),
      handleAuthorizedRoute: async () => ({ handled: false }),
    },
    webPushRuntimeService: { handleRoute: async () => ({ handled: false }) },
    mediaFileService: { handleMediaFileRoute: async () => ({ handled: false }) },
    handleThreadSideChatRoute: async () => ({ handled: false }),
    threadTaskCardRouteService: { handleRoute: async () => ({ handled: false }) },
    threadMessageRouteService: { handleRoute: async () => ({ handled: false }) },
    handleThreadListRoute: async () => ({ handled: false }),
    isAuthorized: () => true,
    getUrl: (request) => new URL(request.url, "http://127.0.0.1:8787"),
    readBody: async () => ({}),
    sendJson: (_res, status, body) => {
      sent = { status, body };
    },
    trackThreadDetailRequestLifecycle: (response) => {
      assert.equal(response, res);
      lifecycleTracked = true;
    },
    handleThreadDetailReadRoute: async ({ threadId, url, sendJson }) => {
      detailHandled = true;
      assert.equal(threadId, "thread-123");
      assert.equal(url.searchParams.get("mode"), "recent");
      sendJson(200, { ok: true, threadId });
    },
    threadDetailReadOrchestrationService: {
      readThreadDetail: async () => {
        throw new Error("readThreadDetail should be owned by the route adapter in this test");
      },
    },
    syncThreadDetailReadResultToThreadListFallbackCache: () => {},
    logThreadDetail: () => {},
  });

  await service.handleApi(req, res);

  assert.equal(lifecycleTracked, true);
  assert.equal(detailHandled, true);
  assert.deepEqual(sent, { status: 200, body: { ok: true, threadId: "thread-123" } });
});
