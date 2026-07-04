"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadDetailProjectionResultService,
} = require("../adapters/thread-detail-projection-result-service");

test("projection result returns null for missing cached thread or compacted thread", () => {
  const service = createThreadDetailProjectionResultService({
    maxTurns: 10,
    compactThreadReadResult() {
      return {};
    },
  });

  assert.equal(service.prepareProjectedThreadReadResult(null, {}, {}), null);
  assert.equal(service.prepareProjectedThreadReadResult({ result: {} }, {}, {}), null);
  assert.equal(service.prepareProjectedThreadReadResult({
    result: { thread: { id: "thread-1" } },
  }, {}, {}), null);
});

test("projection result decorates cached thread detail with summary, runtime, title, and public settings", () => {
  const calls = [];
  const service = createThreadDetailProjectionResultService({
    maxTurns: 25,
    now: () => 2000,
    compactThreadReadResult(result, options) {
      calls.push(["compact", options]);
      assert.equal(result.thread.name, "Summary title");
      return Object.assign({}, result, {
        thread: Object.assign({}, result.thread, {
          compactedMaxTurns: options.maxTurns,
        }),
      });
    },
    mergeThreadDisplaySummary(thread, summary) {
      calls.push(["merge", summary.name]);
      return Object.assign({}, thread, {
        name: summary.name,
        mobileProjectionVersion: "v3",
      });
    },
    readSessionIndexEntries() {
      calls.push(["readSessionIndex"]);
      return new Map([["thread-1", { title: "Session index title" }]]);
    },
    applySessionIndexTitleToThread(thread, entry) {
      calls.push(["applySessionIndex", entry.title]);
      return Object.assign({}, thread, { title: entry.title });
    },
    mergeThreadRuntimeFromStateDb(thread, summary) {
      calls.push(["runtime", summary.model]);
      return Object.assign({}, thread, { model: summary.model });
    },
    normalizeThreadSummaryLiveStatus(thread) {
      calls.push(["normalize"]);
      return Object.assign({}, thread, { normalizedLiveStatus: true });
    },
    publicRuntimeSettings(settings) {
      calls.push(["publicSettings", settings.privateValue]);
      return { safeValue: settings.safeValue };
    },
  });

  const result = service.prepareProjectedThreadReadResult({
    cachedAtMs: 1200,
    updatedAtMs: 1500,
    dynamic: false,
    result: {
      thread: {
        id: "thread-1",
        name: "Cached title",
        mobileProjection: { retained: true },
      },
    },
  }, {
    name: "Summary title",
    model: "gpt-test",
  }, {
    safeValue: true,
    privateValue: "hidden",
  });

  assert.equal(result.thread.id, "thread-1");
  assert.equal(result.thread.title, "Session index title");
  assert.equal(result.thread.name, "Summary title");
  assert.equal(result.thread.model, "gpt-test");
  assert.equal(result.thread.compactedMaxTurns, 25);
  assert.equal(result.thread.normalizedLiveStatus, true);
  assert.deepEqual(result.thread.runtimeSettings, { safeValue: true });
  assert.equal(result.thread.mobileReadMode, "projection-cache");
  assert.deepEqual(result.thread.mobileProjection, {
    retained: true,
    source: "cache",
    version: "v3",
    partial: false,
    partialKind: "",
    cachedAtMs: 1200,
    updatedAtMs: 1500,
    ageMs: 500,
  });
  assert.deepEqual(calls, [
    ["merge", "Summary title"],
    ["compact", { maxTurns: 25 }],
    ["readSessionIndex"],
    ["applySessionIndex", "Session index title"],
    ["runtime", "gpt-test"],
    ["normalize"],
    ["publicSettings", "hidden"],
  ]);
});

test("projection result read mode follows cache source and v4 version", () => {
  const service = createThreadDetailProjectionResultService({
    maxTurns: 5,
    now: () => 1000,
  });

  const dynamic = service.prepareProjectedThreadReadResult({
    dynamic: true,
    version: "v4",
    cachedAtMs: 900,
    result: { thread: { id: "thread-1" } },
  }, {}, {});
  assert.equal(dynamic.thread.mobileReadMode, "projection-v4-dynamic");
  assert.deepEqual(dynamic.thread.mobileProjection, {
    source: "dynamic",
    version: "v4",
    partial: false,
    partialKind: "",
    cachedAtMs: 900,
    updatedAtMs: 900,
    ageMs: null,
  });

  const cache = service.prepareProjectedThreadReadResult({
    dynamic: false,
    version: "v4",
    cachedAtMs: 800,
    updatedAtMs: 950,
    result: { thread: { id: "thread-2" } },
  }, {}, {});
  assert.equal(cache.thread.mobileReadMode, "projection-v4-cache");
  assert.equal(cache.thread.mobileProjection.ageMs, 50);
});

test("projection result skips compaction for response-ready v4 projection hits", () => {
  let compactCalls = 0;
  let decorateCalls = 0;
  const service = createThreadDetailProjectionResultService({
    maxTurns: 5,
    now: () => 1000,
    compactThreadReadResult() {
      compactCalls += 1;
      throw new Error("response-ready v4 projection should not compact");
    },
    decorateThreadReadResult(result, details) {
      decorateCalls += 1;
      assert.equal(details.projectionVersion, "v4");
      return Object.assign({}, result, {
        thread: Object.assign({}, result.thread, {
          decorated: true,
          turns: result.thread.turns.map((turn) => Object.assign({}, turn, {
            items: [
              ...turn.items,
              {
                id: "usage-1",
                type: "turnUsageSummary",
                mobileProjectionVersion: "v4",
                mobileVisibleKey: "turn-1:turnUsageSummary",
              },
            ],
          })),
        }),
      });
    },
  });

  const result = service.prepareProjectedThreadReadResult({
    version: "v4",
    cachedAtMs: 800,
    updatedAtMs: 900,
    result: {
      thread: {
        id: "thread-1",
        mobileProjectionVersion: "v4",
        mobileVisibleItemKeys: ["turn-1:user:user-1"],
        turns: [{
          id: "turn-1",
          mobileProjectionVersion: "v4",
          mobileVisibleKey: "turn:turn-1",
          mobileVisibleItemKeys: ["turn-1:user:user-1"],
          items: [{
            id: "user-1",
            type: "userMessage",
            mobileProjectionVersion: "v4",
            mobileVisibleKey: "turn-1:user:user-1",
          }],
        }],
      },
    },
  }, {}, {});

  assert.equal(compactCalls, 0);
  assert.equal(decorateCalls, 1);
  assert.equal(result.thread.decorated, true);
  assert.equal(result.thread.mobileReadMode, "projection-v4-cache");
  assert.equal(result.thread.mobileProjection.version, "v4");
  assert.equal(result.thread.turns[0].items.some((item) => item.type === "turnUsageSummary"), true);
  assert.deepEqual(result.thread.mobileVisibleItemKeys, ["turn-1:user:user-1"]);
});

test("projection result compacts v4 projections that are not response-ready", () => {
  let compactCalls = 0;
  const service = createThreadDetailProjectionResultService({
    maxTurns: 5,
    now: () => 1000,
    compactThreadReadResult(result, options) {
      compactCalls += 1;
      assert.equal(options.maxTurns, 5);
      return Object.assign({}, result, {
        thread: Object.assign({}, result.thread, {
          compacted: true,
          mobileProjectionVersion: "v4",
        }),
      });
    },
  });

  const result = service.prepareProjectedThreadReadResult({
    version: "v4",
    cachedAtMs: 800,
    result: {
      thread: {
        id: "thread-1",
        mobileProjectionVersion: "v4",
        mobileVisibleItemKeys: [],
        turns: [{
          id: "turn-1",
          mobileProjectionVersion: "v4",
          mobileVisibleKey: "turn:turn-1",
          mobileVisibleItemKeys: [],
          items: [{
            id: "agent-1",
            type: "agentMessage",
          }],
        }],
      },
    },
  }, {}, {});

  assert.equal(compactCalls, 1);
  assert.equal(result.thread.compacted, true);
  assert.equal(result.thread.mobileReadMode, "projection-v4-cache");
});

test("projection result exposes partial recent window source and read mode", () => {
  const service = createThreadDetailProjectionResultService({
    maxTurns: 5,
    now: () => 1000,
  });

  const partial = service.prepareProjectedThreadReadResult({
    partial: true,
    partialKind: "recent-window",
    version: "v4",
    cachedAtMs: 800,
    updatedAtMs: 900,
    result: {
      thread: {
        id: "thread-1",
        turns: [{ id: "turn-recent" }],
      },
    },
  }, {}, {});

  assert.ok(partial);
  assert.equal(partial.thread.mobileReadMode, "projection-v4-partial");
  assert.deepEqual(partial.thread.mobileProjection, {
    source: "partial",
    version: "v4",
    partial: true,
    partialKind: "recent-window",
    cachedAtMs: 800,
    updatedAtMs: 900,
    ageMs: 100,
  });
});

test("projection result rejects cached detail missing the local active turn", () => {
  const service = createThreadDetailProjectionResultService({
    maxTurns: 5,
    now: () => 1000,
  });

  const stale = service.prepareProjectedThreadReadResult({
    dynamic: true,
    version: "v4",
    cachedAtMs: 900,
    result: {
      thread: {
        id: "thread-1",
        turns: [{
          id: "turn-old",
          status: { type: "active" },
          items: [{ id: "agent-old", type: "agentMessage", text: "old output" }],
        }],
      },
    },
  }, {
    id: "thread-1",
    status: { type: "active" },
    activeTurnId: "turn-new",
    mobileLocalActiveStatus: { turnId: "turn-new" },
  }, {});

  assert.equal(stale, null);

  const current = service.prepareProjectedThreadReadResult({
    dynamic: true,
    version: "v4",
    cachedAtMs: 900,
    result: {
      thread: {
        id: "thread-1",
        turns: [{
          id: "turn-new",
          status: { type: "active" },
          items: [{ id: "agent-new", type: "agentMessage", text: "new output" }],
        }],
      },
    },
  }, {
    id: "thread-1",
    status: { type: "active" },
    mobileLocalActiveStatus: { turnId: "turn-new" },
  }, {});

  assert.ok(current);
  assert.equal(current.thread.turns[0].id, "turn-new");
});

test("projection result rejects cached detail older than summary update", () => {
  const service = createThreadDetailProjectionResultService({
    maxTurns: 5,
    now: () => 10_000,
  });

  const stale = service.prepareProjectedThreadReadResult({
    dynamic: false,
    version: "v4",
    cachedAtMs: 9_000,
    updatedAtMs: 9_000,
    result: {
      thread: {
        id: "thread-1",
        turns: [{
          id: "turn-old",
          completedAt: 1_000,
          items: [{ id: "agent-old", type: "agentMessage" }],
        }],
      },
    },
  }, {
    id: "thread-1",
    updatedAt: 2_000,
  }, {});

  assert.equal(stale, null);

  const current = service.prepareProjectedThreadReadResult({
    dynamic: false,
    version: "v4",
    cachedAtMs: 9_000,
    updatedAtMs: 9_000,
    result: {
      thread: {
        id: "thread-1",
        turns: [{
          id: "turn-current",
          completedAt: 2_000,
          items: [{ id: "agent-current", type: "agentMessage" }],
        }],
      },
    },
  }, {
    id: "thread-1",
    updatedAt: 2_000,
  }, {});

  assert.ok(current);
  assert.equal(current.thread.turns[0].id, "turn-current");
});

test("projection result keeps stale partial first paint while refresh is pending", () => {
  const service = createThreadDetailProjectionResultService({
    maxTurns: 5,
    now: () => 10_000,
  });

  const stalePartial = service.prepareProjectedThreadReadResult({
    dynamic: false,
    partial: true,
    partialKind: "recent-window",
    stalePartial: true,
    staleReason: "backing-signature-mismatch",
    version: "v4",
    cachedAtMs: 8_000,
    updatedAtMs: 8_000,
    result: {
      thread: {
        id: "thread-1",
        turns: [{
          id: "turn-old",
          completedAt: 1_000,
          items: [{ id: "agent-old", type: "agentMessage" }],
        }],
      },
    },
  }, {
    id: "thread-1",
    updatedAt: 20_000,
  }, {});

  assert.ok(stalePartial);
  assert.equal(stalePartial.thread.mobileReadMode, "projection-v4-partial");
  assert.equal(stalePartial.thread.mobileProjection.stalePartial, true);
  assert.equal(stalePartial.thread.mobileProjection.staleReason, "backing-signature-mismatch");

  const missingActiveTurn = service.prepareProjectedThreadReadResult({
    dynamic: false,
    partial: true,
    partialKind: "recent-window",
    stalePartial: true,
    version: "v4",
    cachedAtMs: 8_000,
    updatedAtMs: 8_000,
    result: {
      thread: {
        id: "thread-1",
        turns: [{ id: "turn-old", status: { type: "active" }, items: [] }],
      },
    },
  }, {
    id: "thread-1",
    status: { type: "active" },
    activeTurnId: "turn-new",
    mobileLocalActiveStatus: { turnId: "turn-new" },
  }, {});

  assert.equal(missingActiveTurn, null);

  const staleRestingSummaryWithResidualActiveMarker = service.prepareProjectedThreadReadResult({
    dynamic: false,
    partial: true,
    partialKind: "recent-window",
    stalePartial: true,
    staleReason: "backing-signature-mismatch",
    version: "v4",
    cachedAtMs: 8_000,
    updatedAtMs: 8_000,
    result: {
      thread: {
        id: "thread-1",
        turns: [{ id: "turn-old", status: { type: "active" }, items: [] }],
      },
    },
  }, {
    id: "thread-1",
    status: { type: "completed" },
    activeTurnId: "turn-new",
    mobileLocalActiveStatus: { turnId: "turn-new", status: { type: "active" } },
  }, {});

  assert.ok(staleRestingSummaryWithResidualActiveMarker);
  assert.equal(staleRestingSummaryWithResidualActiveMarker.thread.mobileReadMode, "projection-v4-partial");
  assert.equal(staleRestingSummaryWithResidualActiveMarker.thread.mobileProjection.stalePartial, true);
});

test("projection result accepts fresh status-only active cache when summary heartbeat is newer", () => {
  const service = createThreadDetailProjectionResultService({
    maxTurns: 5,
    now: () => 40_000,
  });
  const cached = {
    partial: true,
    partialKind: "turns-list-window",
    version: "v4",
    cachedAtMs: 39_000,
    updatedAtMs: 39_000,
    result: {
      thread: {
        id: "thread-1",
        turns: [{
          id: "turn-active",
          status: { type: "active" },
          startedAt: 1_000,
          items: [{ id: "agent-active", type: "agentMessage" }],
        }],
      },
    },
  };

  const current = service.prepareProjectedThreadReadResult(cached, {
    id: "thread-1",
    status: { type: "active" },
    updatedAt: 39_020,
  }, {});

  assert.ok(current);
  assert.equal(current.thread.mobileReadMode, "projection-v4-partial");
  assert.equal(current.thread.turns[0].id, "turn-active");

  const stale = service.prepareProjectedThreadReadResult(cached, {
    id: "thread-1",
    status: { type: "active" },
    updatedAt: 39_050,
  }, {});
  assert.equal(stale, null);
});

test("projection result accepts cache seeded for current summary signature without turn timestamps", () => {
  const service = createThreadDetailProjectionResultService({
    maxTurns: 5,
    now: () => 12_000,
  });
  const cached = {
    partial: true,
    partialKind: "recent-window",
    version: "v4",
    cachedAtMs: 10_000,
    updatedAtMs: 10_000,
    signatureSummaryUpdatedAtMs: 9_999,
    result: {
      thread: {
        id: "thread-1",
        turns: [{
          id: "turn-complete",
          status: { type: "completed" },
          items: [{ id: "agent-complete", type: "agentMessage" }],
        }],
      },
    },
  };

  const current = service.prepareProjectedThreadReadResult(cached, {
    id: "thread-1",
    status: { type: "completed" },
    updatedAt: 9_999,
  }, {});

  assert.ok(current);
  assert.equal(current.thread.mobileReadMode, "projection-v4-partial");

  const stale = service.prepareProjectedThreadReadResult(cached, {
    id: "thread-1",
    status: { type: "completed" },
    updatedAt: 13_000,
  }, {});
  assert.equal(stale, null);
});

test("projection result can reuse summary-stale partials when caller allows stale first paint", () => {
  const seededAtMs = 1_700_000_009_000;
  const laterSummaryAtMs = 1_700_000_019_000;
  const service = createThreadDetailProjectionResultService({
    maxTurns: 5,
    now: () => laterSummaryAtMs + 1000,
  });
  const cached = {
    partial: true,
    partialKind: "recent-window",
    version: "v4",
    cachedAtMs: seededAtMs,
    updatedAtMs: seededAtMs,
    signatureSummaryUpdatedAtMs: seededAtMs,
    result: {
      thread: {
        id: "thread-1",
        turns: [{
          id: "turn-window",
          status: { type: "completed" },
          items: [{ id: "agent-window", type: "agentMessage" }],
        }],
      },
    },
  };

  const summary = {
    id: "thread-1",
    status: { type: "completed" },
    updatedAtMs: laterSummaryAtMs,
  };

  assert.equal(service.prepareProjectedThreadReadResult(cached, summary, {}), null);

  const readiness = service.projectedThreadReadiness(cached, summary, { allowStalePartial: true });
  assert.deepEqual(readiness, {
    ready: true,
    stalePartial: true,
    staleReason: "summary-updated-after-window",
  });

  const staleFirstPaint = service.prepareProjectedThreadReadResult(
    cached,
    summary,
    {},
    { allowStalePartial: true },
  );

  assert.ok(staleFirstPaint);
  assert.equal(staleFirstPaint.thread.mobileReadMode, "projection-v4-partial");
  assert.equal(staleFirstPaint.thread.mobileProjection.partial, true);
  assert.equal(staleFirstPaint.thread.mobileProjection.stalePartial, true);
  assert.equal(staleFirstPaint.thread.mobileProjection.staleReason, "summary-updated-after-window");
});

test("projection result does not reuse summary-stale partials for active summaries", () => {
  const seededAtMs = 1_700_000_009_000;
  const laterSummaryAtMs = 1_700_000_019_000;
  const service = createThreadDetailProjectionResultService({
    maxTurns: 5,
    now: () => laterSummaryAtMs + 1000,
  });
  const cached = {
    partial: true,
    partialKind: "recent-window",
    version: "v4",
    cachedAtMs: seededAtMs,
    updatedAtMs: seededAtMs,
    signatureSummaryUpdatedAtMs: seededAtMs,
    result: {
      thread: {
        id: "thread-1",
        turns: [{
          id: "turn-window",
          status: { type: "completed" },
          items: [{ id: "agent-window", type: "agentMessage" }],
        }],
      },
    },
  };

  const summary = {
    id: "thread-1",
    status: { type: "active" },
    updatedAtMs: laterSummaryAtMs,
  };

  assert.deepEqual(service.projectedThreadReadiness(cached, summary, { allowStalePartial: true }), {
    ready: false,
    reason: "summary-updated-after-window",
  });
  assert.equal(service.prepareProjectedThreadReadResult(cached, summary, {}, { allowStalePartial: true }), null);
});

test("projection result allows missing local active turn only for active overlay window assembly", () => {
  const service = createThreadDetailProjectionResultService({
    maxTurns: 5,
    now: () => 1000,
  });
  const cached = {
    partial: true,
    partialKind: "recent-window",
    version: "v4",
    cachedAtMs: 800,
    updatedAtMs: 900,
    result: {
      thread: {
        id: "thread-1",
        turns: [{
          id: "turn-window",
          items: [{ id: "agent-window", type: "agentMessage" }],
        }],
      },
    },
  };
  const summary = {
    id: "thread-1",
    status: { type: "active" },
    activeTurnId: "turn-live",
    mobileLocalActiveStatus: { turnId: "turn-live" },
  };

  assert.equal(service.prepareProjectedThreadReadResult(cached, summary, {}), null);

  const overlayWindow = service.prepareProjectedThreadReadResult(cached, summary, {}, { activeOverlay: true });
  assert.ok(overlayWindow);
  assert.equal(overlayWindow.thread.turns[0].id, "turn-window");
  assert.equal(overlayWindow.thread.mobileReadMode, "projection-v4-partial");
  assert.equal(overlayWindow.thread.mobileProjection.partial, true);
});
