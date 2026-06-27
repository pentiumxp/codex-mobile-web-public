"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadDetailSummaryService,
  summaryStatus,
  summaryTitle,
} = require("../adapters/thread-detail-summary-service");

function createResolver(overrides = {}) {
  let nowMs = Number(overrides.nowMs || 1000);
  const logs = [];
  const calls = {
    state: 0,
    started: 0,
    rollout: 0,
    display: 0,
    appServer: 0,
  };
  const service = createThreadDetailSummaryService({
    now: () => nowMs,
    readStateDbThread(threadId) {
      calls.state += 1;
      return typeof overrides.readStateDbThread === "function" ? overrides.readStateDbThread(threadId) : null;
    },
    readStartedThread(threadId) {
      calls.started += 1;
      return typeof overrides.readStartedThread === "function" ? overrides.readStartedThread(threadId) : null;
    },
    readRolloutSessionFallbackThread(threadId) {
      calls.rollout += 1;
      return typeof overrides.readRolloutSessionFallbackThread === "function"
        ? overrides.readRolloutSessionFallbackThread(threadId)
        : null;
    },
    readDisplaySummaryThread(threadId) {
      calls.display += 1;
      return typeof overrides.readDisplaySummaryThread === "function"
        ? overrides.readDisplaySummaryThread(threadId)
        : null;
    },
    async readThreadSummaryFromAppServer(codex, threadId) {
      calls.appServer += 1;
      return typeof overrides.readThreadSummaryFromAppServer === "function"
        ? overrides.readThreadSummaryFromAppServer(codex, threadId)
        : null;
    },
    mergeThreadDisplaySummary(base, display) {
      return Object.assign({}, base || {}, display || {});
    },
    applyLocalActiveThreadStatusToSummary(summary, options) {
      return typeof overrides.applyLocalActiveThreadStatusToSummary === "function"
        ? overrides.applyLocalActiveThreadStatusToSummary(summary, options)
        : summary;
    },
    threadRolloutSizeBytes(summary) {
      return summary && summary.rolloutSizeBytes || 0;
    },
    appServerRefreshTtlMs: overrides.appServerRefreshTtlMs,
    skipAppServerRefreshWhenDisplayCachePresent: overrides.skipAppServerRefreshWhenDisplayCachePresent,
  });
  return {
    calls,
    logs,
    service,
    setNow(value) {
      nowMs = value;
    },
    threadLog(event, details = {}) {
      logs.push([event, details]);
    },
  };
}

test("summary resolver refreshes state-db summary with app-server display data", async () => {
  const resolver = createResolver({
    readStateDbThread: () => ({ id: "thread-1", name: "State title", status: { type: "idle" }, rolloutSizeBytes: 123 }),
    readThreadSummaryFromAppServer: () => ({ id: "thread-1", name: "App title", model: "gpt-test" }),
  });
  const result = await resolver.service.resolveSummary({}, "thread-1", { threadLog: resolver.threadLog });

  assert.deepEqual(result, {
    summary: {
      id: "thread-1",
      name: "App title",
      status: { type: "idle" },
      rolloutSizeBytes: 123,
      model: "gpt-test",
    },
    source: "state-db+app-server",
  });
  assert.deepEqual(resolver.calls, { state: 1, started: 0, rollout: 0, display: 1, appServer: 1 });
  assert.deepEqual(resolver.logs, [
    ["summary_app_server_refresh_start", { baseSource: "state-db" }],
    ["summary_app_server_refresh_ok", { durationMs: 0, found: true }],
    ["summary_ready", {
      source: "state-db+app-server",
      title: "App title",
      rolloutSizeBytes: 123,
      status: "idle",
    }],
  ]);
});

test("summary resolver falls through started and rollout before app-server lookup", async () => {
  const resolver = createResolver({
    readStartedThread: () => ({ id: "thread-1", name: "Started", status: "active" }),
    readThreadSummaryFromAppServer: () => null,
  });
  const result = await resolver.service.resolveSummary({}, "thread-1", { threadLog: resolver.threadLog });

  assert.equal(result.source, "started-cache");
  assert.equal(result.summary.name, "Started");
  assert.deepEqual(resolver.calls, { state: 1, started: 1, rollout: 0, display: 1, appServer: 1 });
  assert.deepEqual(resolver.logs.map(([event]) => event), [
    "summary_app_server_refresh_start",
    "summary_app_server_refresh_ok",
    "summary_ready",
  ]);
  assert.equal(resolver.logs[1][1].found, false);
  assert.equal(resolver.logs[2][1].status, "active");
});

test("summary resolver uses app-server as primary when local summaries are absent", async () => {
  const resolver = createResolver({
    readThreadSummaryFromAppServer: () => ({ id: "thread-1", preview: "App preview", status: { type: "completed" } }),
    applyLocalActiveThreadStatusToSummary(summary, options) {
      return Object.assign({}, summary, { activeOverlayThreadId: options.threadId });
    },
  });
  const result = await resolver.service.resolveSummary({}, "thread-1", { threadLog: resolver.threadLog });

  assert.equal(result.source, "app-server");
  assert.equal(result.summary.activeOverlayThreadId, "thread-1");
  assert.deepEqual(resolver.calls, { state: 1, started: 1, rollout: 1, display: 1, appServer: 1 });
  assert.deepEqual(resolver.logs.map(([event]) => event), [
    "summary_app_server_start",
    "summary_app_server_ok",
    "summary_ready",
  ]);
  assert.equal(resolver.logs[2][1].title, "App preview");
  assert.equal(resolver.logs[2][1].status, "completed");
});

test("summary resolver logs app-server errors without hiding local fallback summary", async () => {
  const resolver = createResolver({
    readRolloutSessionFallbackThread: () => ({ id: "thread-1", name: "Rollout title" }),
    readThreadSummaryFromAppServer: () => {
      throw new Error("offline");
    },
  });
  resolver.setNow(1500);
  const result = await resolver.service.resolveSummary({}, "thread-1", { threadLog: resolver.threadLog });

  assert.equal(result.source, "rollout-session");
  assert.equal(result.summary.name, "Rollout title");
  assert.equal(resolver.logs[0][0], "summary_app_server_refresh_start");
  assert.deepEqual(resolver.logs[1], ["summary_app_server_refresh_error", {
    durationMs: 0,
    error: "offline",
  }]);
  assert.equal(resolver.logs[2][0], "summary_ready");
});

test("summary resolver merges display cache and skips app-server refresh for existing summaries", async () => {
  const resolver = createResolver({
    readStateDbThread: () => ({ id: "thread-1", name: "State title", status: { type: "idle" } }),
    readDisplaySummaryThread: () => ({ id: "thread-1", name: "Cached title", preview: "Cached preview", model: "gpt-cache" }),
    readThreadSummaryFromAppServer: () => ({ id: "thread-1", name: "App title" }),
    skipAppServerRefreshWhenDisplayCachePresent: true,
    appServerRefreshTtlMs: 30_000,
  });
  const result = await resolver.service.resolveSummary({}, "thread-1", { threadLog: resolver.threadLog });

  assert.equal(result.source, "state-db+display-cache");
  assert.equal(result.summary.name, "Cached title");
  assert.equal(result.summary.model, "gpt-cache");
  assert.deepEqual(resolver.calls, { state: 1, started: 0, rollout: 0, display: 1, appServer: 0 });
  assert.deepEqual(resolver.logs.map(([event]) => event), [
    "summary_display_cache_merge",
    "summary_app_server_refresh_skipped",
    "summary_ready",
  ]);
  assert.equal(resolver.logs[1][1].reason, "display-cache");
});

test("summary resolver can use display cache as the local summary source", async () => {
  const resolver = createResolver({
    readDisplaySummaryThread: () => ({ id: "thread-1", name: "Cached title", status: { type: "completed" } }),
    readThreadSummaryFromAppServer: () => ({ id: "thread-1", name: "App title" }),
    skipAppServerRefreshWhenDisplayCachePresent: true,
    appServerRefreshTtlMs: 30_000,
  });
  const result = await resolver.service.resolveSummary({}, "thread-1", { threadLog: resolver.threadLog });

  assert.equal(result.source, "display-cache");
  assert.equal(result.summary.name, "Cached title");
  assert.deepEqual(resolver.calls, { state: 1, started: 1, rollout: 1, display: 1, appServer: 0 });
  assert.deepEqual(resolver.logs.map(([event]) => event), [
    "summary_display_cache_hit",
    "summary_app_server_refresh_skipped",
    "summary_ready",
  ]);
});

test("summary resolver skips repeated app-server refreshes within ttl", async () => {
  const resolver = createResolver({
    readStateDbThread: () => ({ id: "thread-1", name: "State title", status: { type: "idle" } }),
    readThreadSummaryFromAppServer: () => ({ id: "thread-1", name: "App title" }),
    appServerRefreshTtlMs: 30_000,
  });
  const first = await resolver.service.resolveSummary({}, "thread-1", { threadLog: resolver.threadLog });
  resolver.setNow(10_000);
  const second = await resolver.service.resolveSummary({}, "thread-1", { threadLog: resolver.threadLog });

  assert.equal(first.source, "state-db+app-server");
  assert.equal(second.source, "state-db");
  assert.deepEqual(resolver.calls, { state: 2, started: 0, rollout: 0, display: 2, appServer: 1 });
  const skipLog = resolver.logs.find(([event]) => event === "summary_app_server_refresh_skipped");
  assert.ok(skipLog);
  assert.equal(skipLog[1].reason, "recent-app-server-refresh");
  assert.equal(skipLog[1].ageMs, 9000);
});

test("summary helper fields match route diagnostics", () => {
  assert.equal(summaryTitle({ name: "Name", preview: "Preview" }), "Name");
  assert.equal(summaryTitle({ preview: "Preview" }), "Preview");
  assert.equal(summaryTitle(null), "");
  assert.equal(summaryStatus({ status: { type: "active" } }), "active");
  assert.equal(summaryStatus({ status: "completed" }), "completed");
  assert.equal(summaryStatus({}), null);
});
