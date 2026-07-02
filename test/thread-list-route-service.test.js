"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { handleThreadListRoute } = require("../server-routes/thread-list-route-service");
const threadListRouteAdapter = require("../adapters/thread-list-route-service");

function makeThread(id, cwd = "/Users/hermes-dev/HermesMobileDev/app", updatedAt = "2026-07-02T00:00:00.000Z") {
  return {
    id,
    cwd,
    updatedAt,
    status: { type: "completed" },
  };
}

function makeThreadListRouteHarness({
  url = "http://127.0.0.1/api/threads?limit=80",
  cachedThreads = [],
  appServerThreads = [],
} = {}) {
  const responses = [];
  let codexCalls = 0;
  let fallbackReads = 0;
  const mergeThreadSummaryListWithDiagnostics = (threads) => ({
    threads: [...threads],
    diagnostics: {},
  });

  return {
    responses,
    codexCallCount: () => codexCalls,
    fallbackReadCount: () => fallbackReads,
    options: {
      url: new URL(url),
      method: "GET",
      sendJson: (status, body) => responses.push({ status, body }),
      archivedSessionThreadIds: () => new Set(),
      readSessionIndexEntries: () => new Map(),
      rolloutStatsForPath: () => null,
      threadDisplaySummaryCache: {
        read: () => null,
        rememberList: () => {},
      },
      mergeThreadDisplaySummary: (base, display) => Object.assign({}, base || {}, display || {}),
      normalizeStaleContextOnlyActiveThread: (thread) => thread,
      readGlobalState: () => ({}),
      visibilityFromGlobalState: () => ({ workspaceKeys: new Set(["/Users/hermes-dev/HermesMobileDev/Movie"]) }),
      normalizeFsPath: (value) => String(value || ""),
      threadListResponseCoalescer: {
        begin: () => ({ enabled: false, leader: false }),
      },
      readThreadListCachedFallback: (limit, { diagnostics } = {}) => {
        Object.assign(diagnostics || {}, {
          cacheHit: true,
          cacheDecision: "hit",
          cacheEntryCount: 1,
          cacheBuildCount: 1,
          cachedSourceTimings: {
            baselineResultCount: cachedThreads.length,
          },
        });
        return cachedThreads.slice(0, limit);
      },
      readThreadListFallback: (limit, { diagnostics } = {}) => {
        fallbackReads += 1;
        Object.assign(diagnostics || {}, {
          cacheHit: true,
          cacheDecision: "hit",
          cacheEntryCount: 1,
          cacheBuildCount: 1,
          cachedSourceTimings: {
            baselineResultCount: cachedThreads.length,
          },
        });
        return cachedThreads.slice(0, limit);
      },
      threadListFallbackBaselineWorkTimingFields: () => ({}),
      threadListFallbackSourceDiagnosticTimingFields: () => ({}),
      normalizeThreadListResultStatuses: (result) => result,
      attachThreadListStateToResult: (result) => result,
      tokenUsageStatsService: {
        decorateThreadListResult: (result) => result,
      },
      tokenUsageWorkspaceCwds: () => [],
      threadListTokenUsageTimingFields: () => ({}),
      logThreadList: () => {},
      scheduleActiveWindowPrewarmFromThreadListResult: () => {},
      codex: {
        request: async () => {
          codexCalls += 1;
          return { data: appServerThreads };
        },
      },
      filterVisibleThreads: (result) => result,
      filterThreadListByCwd: (result, cwd) => {
        if (!cwd || !Array.isArray(result && result.data)) return result;
        return { data: result.data.filter((thread) => thread.cwd === cwd) };
      },
      shouldDeferThreadListFallbackForActiveDetail: () => false,
      hydrateThreadListResultTitlesFromSessionIndex: (result) => result,
      upsertThreadListFallbackCacheThreads: () => 0,
      mergeThreadSummaryListWithDiagnostics,
      normalizeThreadSummaryLiveStatus: (thread) => thread,
      threadListDefaultWarmFallbackEnabled: true,
      readRpcTimeoutMs: 1000,
    },
  };
}

test("thread-list route adapter re-exports the canonical server route", () => {
  assert.equal(threadListRouteAdapter.handleThreadListRoute, handleThreadListRoute);
});

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

test("thread-list route continues to app-server when default warm fallback has an incomplete requested window", async () => {
  const movieThread = makeThread(
    "019efca1-ea69-7292-87b7-025ba023ca87",
    "/Users/hermes-dev/HermesMobileDev/Movie",
    "2026-07-02T03:00:00.000Z",
  );
  const cachedThreads = Array.from({ length: 20 }, (_, index) => makeThread(`cached-${index}`));
  const appServerThreads = [
    ...Array.from({ length: 4 }, (_, index) => makeThread(`server-before-${index}`)),
    movieThread,
    ...Array.from({ length: 29 }, (_, index) => makeThread(`server-after-${index}`)),
  ];
  const harness = makeThreadListRouteHarness({
    url: "http://127.0.0.1/api/threads?limit=80",
    cachedThreads,
    appServerThreads,
  });

  const result = await handleThreadListRoute(harness.options);

  assert.deepEqual(result, { handled: true });
  assert.equal(harness.codexCallCount(), 1);
  assert.equal(harness.fallbackReadCount(), 1);
  const response = harness.responses[0];
  assert.equal(response.status, 200);
  assert.equal(response.body.data.some((thread) => thread.id === movieThread.id), true);
  const timings = response.body.mobileDiagnostics.threadListTimings;
  assert.equal(timings.initialFallbackSkipped, true);
  assert.equal(timings.initialFallbackSkippedReason, "insufficient-default-warm-cache-window");
  assert.equal(timings.initialFallbackResultCount, 20);
  assert.equal(timings.initialFallbackRequestedLimit, 80);
  assert.equal(timings.appServerDeferred, undefined);
  assert.equal(timings.appServerFilteredCount, appServerThreads.length);
});

test("thread-list route keeps default warm fallback for complete small requested windows", async () => {
  const cachedThreads = Array.from({ length: 20 }, (_, index) => makeThread(`cached-${index}`));
  const harness = makeThreadListRouteHarness({
    url: "http://127.0.0.1/api/threads?limit=2",
    cachedThreads,
    appServerThreads: [makeThread("server-should-not-be-read")],
  });

  const result = await handleThreadListRoute(harness.options);

  assert.deepEqual(result, { handled: true });
  assert.equal(harness.codexCallCount(), 0);
  assert.equal(harness.fallbackReadCount(), 0);
  const response = harness.responses[0];
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.map((thread) => thread.id), ["cached-0", "cached-1"]);
  assert.equal(response.body.mobileDeferredAppServer, true);
  const timings = response.body.mobileDiagnostics.threadListTimings;
  assert.equal(timings.appServerDeferred, true);
  assert.equal(timings.appServerDeferredReason, "warm-fallback-default");
  assert.equal(timings.initialFallbackSkipped, undefined);
});
