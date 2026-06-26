"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const { test } = require("node:test");

const {
  classifyActiveOverlayGate,
  parseArgs,
  run,
  summarizeThreadDetail,
  summarizeThreadList,
} = require("../scripts/codex-mobile-phase-b-readback-smoke");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function createMockServer(handler) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body));
    };
    Promise.resolve(handler({ req, url, send })).catch((err) => send(500, {
      error: err && err.message || String(err),
    }));
  });
}

test("phase B readback smoke collects bounded diagnostics without private fields", async (t) => {
  const seen = [];
  const server = createMockServer(({ req, url, send }) => {
    seen.push({ path: url.pathname, authorization: req.headers.authorization || "" });
    if (url.pathname === "/api/public-config") {
      send(200, {
        version: "0.1.11",
        clientBuildId: "0.1.11|codex-mobile-shell-test",
        shellCacheName: "codex-mobile-shell-test",
        authRequired: true,
      });
      return;
    }
    if (url.pathname === "/api/threads") {
      send(200, {
        data: [{
          id: "thread-private-1",
          name: "PRIVATE THREAD TITLE SHOULD NOT LEAK",
          privatePrompt: "do not leak",
        }],
        mobileDiagnostics: {
          threadListTimings: {
            totalMs: 40,
            appServerMs: 12,
            fallbackMs: 8,
            mergeMs: 2,
            fallbackCacheDecision: "miss-rebuild",
            fallbackBaselineSourceCount: 9,
            fallbackBaselineResultCount: 1,
            fallbackSourceSnapshotHit: true,
            fallbackSourceSnapshotRawCount: 12,
            coldPathOwner: "fallback-baseline",
            coldPathReason: "miss-rebuild:rollout",
          },
        },
      });
      return;
    }
    if (url.pathname === "/api/threads/thread-private-1") {
      assert.equal(url.searchParams.get("mode"), "recent");
      send(200, {
        thread: {
          id: "thread-private-1",
          name: "PRIVATE DETAIL TITLE SHOULD NOT LEAK",
          mobileReadMode: "projection-active-overlay",
          turns: [{
            id: "turn-private",
            items: [{ text: "PRIVATE MESSAGE BODY SHOULD NOT LEAK" }],
          }],
          mobileDiagnostics: {
            threadDetailTimings: {
              readDecision: "projection-active-overlay",
              coldPathOwner: "warm-path",
              coldPathReason: "warm-projection-active-overlay",
              projectionState: "hit",
              activeOverlayAction: "use-projection-overlay",
              activeOverlayReason: "overlay-evidence-complete",
              activeOverlaySource: "projection-live",
              activeOverlayItems: 3,
              activeOverlayOperationItems: 1,
              activeOverlayUploadItems: 0,
              activeOverlayAssistantItems: 1,
              activeOverlayReceiptItems: 1,
            },
          },
        },
      });
      return;
    }
    send(404, { error: "not_found" });
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = await listen(server);

  const report = await run(parseArgs(["--server", baseUrl, "--json", "--no-auth", "--require-active-overlay"]));

  assert.equal(report.ok, true);
  assert.equal(report.threadList.coldPathOwner, "fallback-baseline");
  assert.equal(report.threadList.coldPathReason, "miss-rebuild:rollout");
  assert.equal(report.threadList.fallbackSourceSnapshotHit, true);
  assert.equal(report.threadList.fallbackSourceSnapshotRawCount, 12);
  assert.equal(report.detail.readMode, "projection-active-overlay");
  assert.equal(report.detail.activeOverlayReason, "overlay-evidence-complete");
  assert.equal(report.detail.activeOverlayGate, "ready");
  assert.equal(report.detail.activeOverlayNextAction, "observe-active-overlay-readback");
  assert.equal(report.detail.activeOverlayAssistantItems, 1);
  assert.match(report.threadList.firstThreadHash, /^[a-f0-9]{16}$/);
  assert.match(report.detail.requestedThreadHash, /^[a-f0-9]{16}$/);
  assert.deepEqual(seen.map((item) => item.path), [
    "/api/public-config",
    "/api/threads",
    "/api/threads/thread-private-1",
  ]);
  assert.equal(seen.every((item) => item.authorization === ""), true);
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /PRIVATE|MESSAGE BODY|do not leak/);
});

test("phase B readback smoke fails when required thread-list cold path fields are missing", async (t) => {
  const server = createMockServer(({ url, send }) => {
    if (url.pathname === "/api/public-config") {
      send(200, { clientBuildId: "test-build" });
      return;
    }
    if (url.pathname === "/api/threads") {
      send(200, {
        data: [{ id: "thread-1", name: "private title" }],
        mobileDiagnostics: {
          threadListTimings: {
            fallbackCacheDecision: "hit",
          },
        },
      });
      return;
    }
    if (url.pathname === "/api/threads/thread-1") {
      send(200, {
        thread: {
          id: "thread-1",
          mobileReadMode: "projection-v4-cache",
          turns: [],
          mobileDiagnostics: {
            threadDetailTimings: {
              readDecision: "projection-hit",
            },
          },
        },
      });
      return;
    }
    send(404, { error: "not_found" });
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = await listen(server);

  const report = await run(parseArgs(["--server", baseUrl, "--no-auth"]));
  assert.equal(report.ok, false);
  assert.equal(report.failure, "threadListColdPath");

  const allowed = await run(parseArgs(["--server", baseUrl, "--no-auth", "--allow-missing-cold-path"]));
  assert.equal(allowed.ok, true);
});

test("phase B readback smoke verifies deferred fallback follow-up and warm check", async (t) => {
  const threadListResponses = [
    {
      data: [{ id: "thread-1", name: "private title" }],
      mobileDeferredFallback: true,
      mobileDiagnostics: {
        threadListTimings: {
          totalMs: 25,
          appServerMs: 20,
          fallbackMs: 0,
          fallbackDeferred: true,
          fallbackDeferredReason: "active-thread-detail",
          coldPathOwner: "deferred-fallback",
          coldPathReason: "active-thread-detail",
        },
      },
    },
    {
      data: [{ id: "thread-1", name: "private title" }],
      mobileDiagnostics: {
        threadListTimings: {
          totalMs: 1200,
          appServerMs: 120,
          fallbackMs: 900,
          fallbackCacheDecision: "miss-rebuild",
          fallbackBaselineSourceCount: 30,
          fallbackBaselineResultCount: 20,
          coldPathOwner: "fallback-baseline",
          coldPathReason: "miss-rebuild:rollout",
        },
      },
    },
    {
      data: [{ id: "thread-1", name: "private title" }],
      mobileDiagnostics: {
        threadListTimings: {
          totalMs: 90,
          appServerMs: 80,
          fallbackMs: 1,
          fallbackCacheHit: true,
          fallbackCacheDecision: "hit",
          fallbackCacheIncrementalUpdates: 0,
          coldPathOwner: "warm-fallback-cache",
          coldPathReason: "cache-hit",
        },
      },
    },
  ];
  const seen = [];
  const server = createMockServer(({ url, send }) => {
    seen.push(url.pathname);
    if (url.pathname === "/api/public-config") {
      send(200, { clientBuildId: "0.1.11|codex-mobile-shell-test" });
      return;
    }
    if (url.pathname === "/api/threads") {
      send(200, threadListResponses.shift() || threadListResponses[threadListResponses.length - 1]);
      return;
    }
    if (url.pathname === "/api/threads/thread-1") {
      send(200, {
        thread: {
          id: "thread-1",
          mobileReadMode: "projection-active-overlay",
          turns: [{ id: "turn-1", items: [] }],
          mobileDiagnostics: {
            threadDetailTimings: {
              readDecision: "projection-active-overlay",
              coldPathOwner: "warm-path",
              coldPathReason: "warm-projection-active-overlay",
              projectionState: "hit",
              activeOverlayAction: "use-projection-overlay",
              activeOverlayReason: "overlay-evidence-complete",
            },
          },
        },
      });
      return;
    }
    send(404, { error: "not_found" });
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = await listen(server);

  const report = await run(parseArgs(["--server", baseUrl, "--no-auth", "--require-active-overlay"]));

  assert.equal(report.ok, true);
  assert.equal(report.threadList.coldPathOwner, "deferred-fallback");
  assert.equal(report.threadListAfterDeferred.coldPathOwner, "fallback-baseline");
  assert.equal(report.threadListAfterDeferred.fallbackCacheDecision, "miss-rebuild");
  assert.equal(report.threadListWarmCheck.coldPathOwner, "warm-fallback-cache");
  assert.equal(report.threadListWarmCheck.fallbackCacheHit, true);
  assert.equal(report.decision.status, "observe");
  assert.equal(report.decision.reason, "deferred-followup-warmed");
  assert.equal(report.decision.nextAction, "observe-cold-start-first-rebuild-cost");
  assert.deepEqual(seen, [
    "/api/public-config",
    "/api/threads",
    "/api/threads/thread-1",
    "/api/threads",
    "/api/threads",
  ]);
  assert.doesNotMatch(JSON.stringify(report), /private title/);
});

test("phase B readback summary helpers keep only bounded metadata", () => {
  const list = summarizeThreadList({
    data: [{ id: "thread-secret", name: "private title" }],
    mobileDiagnostics: {
      threadListTimings: {
        coldPathOwner: "fallback-baseline",
        coldPathReason: "miss-rebuild:session-index",
        fallbackBaselineSourceCount: 1000000,
        totalMs: 999999999,
      },
    },
  });
  assert.equal(list.coldPathOwner, "fallback-baseline");
  assert.equal(list.fallbackBaselineSourceCount, 100000);
  assert.equal(list.totalMs, 600000);
  assert.doesNotMatch(JSON.stringify(list), /private title|thread-secret/);

  const detail = summarizeThreadDetail({
    thread: {
      id: "thread-secret",
      name: "private title",
      mobileReadMode: "projection-active-overlay",
      turns: [{ id: "turn-1", text: "private message" }],
      mobileDiagnostics: {
        threadDetailTimings: {
          activeOverlayReason: "overlay-evidence-complete",
          activeOverlayItems: 5,
          activeOverlayAssistantItems: 1,
        },
      },
    },
  }, "thread-secret");
  assert.equal(detail.readMode, "projection-active-overlay");
  assert.equal(detail.turnCount, 1);
  assert.equal(detail.activeOverlayGate, "ready");
  assert.equal(detail.activeOverlayAssistantItems, 1);
  assert.doesNotMatch(JSON.stringify(detail), /private title|private message|thread-secret/);
});

test("phase B readback classifies active overlay gate reasons", () => {
  assert.deepEqual(classifyActiveOverlayGate({
    readMode: "projection-active-overlay",
    activeOverlayReason: "overlay-evidence-complete",
  }), {
    status: "ready",
    reason: "overlay-evidence-complete",
    nextAction: "observe-active-overlay-readback",
  });

  assert.deepEqual(classifyActiveOverlayGate({
    activeFullReadRequired: true,
    activeOverlayAction: "require-full-read",
    activeOverlayReason: "missing-active-turn-id",
  }), {
    status: "needs_repair",
    reason: "missing-active-turn-id",
    nextAction: "retain-active-turn-id",
  });

  assert.deepEqual(classifyActiveOverlayGate({
    activeFullReadRequired: true,
    activeOverlayAction: "require-full-read",
    projectionMissReason: "dynamic-summary-stale",
  }), {
    status: "needs_repair",
    reason: "projection-dynamic-summary-stale",
    nextAction: "allow-active-overlay-stale-window",
  });

  assert.deepEqual(classifyActiveOverlayGate({
    activeFullReadRequired: false,
  }), {
    status: "not-active",
    reason: "active-full-read-not-required",
    nextAction: "observe-active-overlay-readback",
  });
});
