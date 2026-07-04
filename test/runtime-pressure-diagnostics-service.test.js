"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createRuntimePressureDiagnosticsService,
  normalizeRoutePath,
  responseObjectCount,
} = require("../services/runtime/runtime-pressure-diagnostics-service");

test("runtime pressure diagnostics normalizes private ids and counts bounded objects", () => {
  assert.equal(
    normalizeRoutePath("/api/thread-task-cards/ttc_abcdef1234567890/return?detail=1"),
    "/api/thread-task-cards/:taskCardId/return",
  );
  assert.equal(
    normalizeRoutePath("/api/at-loop/status/loop_abcdef1234567890"),
    "/api/at-loop/status/:loopId",
  );
  assert.equal(
    normalizeRoutePath("/api/threads/019eed86-2002-7cc2-b0b7-937eb5355f36"),
    "/api/threads/:threadId",
  );
  assert.equal(responseObjectCount({ threads: [{ id: "a" }, { id: "b" }] }), 2);
  assert.equal(responseObjectCount({ thread: { turns: [{ id: "t1" }, { id: "t2" }, { id: "t3" }] } }), 3);
  assert.equal(responseObjectCount({ ok: true, ready: true }), 2);
});

test("runtime pressure diagnostics reports event loop, process, and slow route summaries", () => {
  let enabled = false;
  let now = 1000;
  const service = createRuntimePressureDiagnosticsService({
    now: () => now,
    historyLimit: 4,
    slowRouteMs: 100,
    eventLoopDelay: {
      enable: () => {
        enabled = true;
      },
      mean: 5_000_000,
      max: 250_000_000,
      percentile: (percentile) => percentile === 95 ? 100_000_000 : 200_000_000,
    },
    processRef: {
      pid: 12345,
      uptime: () => 42.4,
      memoryUsage: () => ({
        rss: 128 * 1024 * 1024,
        heapUsed: 32 * 1024 * 1024,
        heapTotal: 64 * 1024 * 1024,
        external: 8 * 1024 * 1024,
      }),
    },
  });

  service.enable();
  now = 1100;
  service.recordRoute({
    method: "get",
    path: "/api/public-config",
    status: 200,
    elapsedMs: 25,
    responseBytes: 1024,
    responseObjectCount: 3,
  });
  now = 1200;
  service.recordRoute({
    method: "GET",
    path: "/api/threads/019eed86-2002-7cc2-b0b7-937eb5355f36",
    status: 200,
    elapsedMs: 350,
    responseBytes: 4096,
    responseObjectCount: 12,
  });

  const status = service.status();
  assert.equal(enabled, true);
  assert.equal(status.process.pid, 12345);
  assert.equal(status.process.uptimeSec, 42);
  assert.equal(status.process.rssMb, 128);
  assert.equal(status.process.heapUsedMb, 32);
  assert.equal(status.eventLoop.enabled, true);
  assert.equal(status.eventLoop.lagMeanMs, 5);
  assert.equal(status.eventLoop.lagMaxMs, 250);
  assert.equal(status.eventLoop.lagP95Ms, 100);
  assert.equal(status.routes.recent.length, 2);
  assert.equal(status.routes.slow.length, 1);
  assert.equal(status.routes.slow[0].path, "/api/threads/:threadId");
  assert.equal(status.routes.stats[0].path, "/api/threads/:threadId");
  assert.equal(status.routes.stats[0].slowCount, 1);
  assert.equal(status.routes.stats[0].maxBytes, 4096);
});
