"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createAtLoopRouteService,
} = require("../server-routes/at-loop-route-service");

function routeUrl(pathname) {
  return new URL(`http://127.0.0.1${pathname}`);
}

test("at-loop route service handles trigger, status, return, and watchdog routes", async () => {
  const calls = [];
  const responses = [];
  const service = createAtLoopRouteService({
    atLoopRuntimeService: {
      startLoop: async (body) => {
        calls.push(["startLoop", body]);
        return { ok: true, loop: { loopId: "loop_1234" } };
      },
      status: (input) => {
        calls.push(["status", input]);
        return { ok: true, loopCount: input.loopId ? 1 : 0, loops: input.loopId ? [{ loopId: input.loopId }] : [] };
      },
      recordTerminalReturn: async (body) => {
        calls.push(["return", body]);
        return { ok: true };
      },
      runWatchdog: (body) => {
        calls.push(["watchdog", body]);
        return { ok: true, staleCount: 0, retried: false };
      },
    },
  });

  await service.handleRoute({
    url: routeUrl("/api/at-loop/triggers"),
    method: "POST",
    readBody: async () => ({ sourceThreadId: "source", text: "@loop work" }),
    sendJson: (status, body) => responses.push({ status, body }),
  });
  await service.handleRoute({
    url: routeUrl("/api/at-loop/status/loop_1234"),
    method: "GET",
    sendJson: (status, body) => responses.push({ status, body }),
  });
  await service.handleRoute({
    url: routeUrl("/api/at-loop/returns"),
    method: "POST",
    readBody: async () => ({ loopId: "loop_1234", taskCardId: "ttc_1" }),
    sendJson: (status, body) => responses.push({ status, body }),
  });
  await service.handleRoute({
    url: routeUrl("/api/at-loop/watchdog"),
    method: "POST",
    readBody: async () => ({ loopId: "loop_1234" }),
    sendJson: (status, body) => responses.push({ status, body }),
  });

  assert.deepEqual(calls.map((call) => call[0]), ["startLoop", "status", "return", "watchdog"]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200, 200, 200]);
});

test("at-loop route service returns unavailable when runtime is absent", async () => {
  const responses = [];
  const service = createAtLoopRouteService();
  const result = await service.handleRoute({
    url: routeUrl("/api/at-loop/status"),
    method: "GET",
    sendJson: (status, body) => responses.push({ status, body }),
  });
  assert.equal(result.handled, true);
  assert.equal(responses[0].status, 503);
  assert.equal(responses[0].body.error, "at_loop_runtime_unavailable");
});
