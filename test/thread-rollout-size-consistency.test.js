"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadDetailResponsePreparationService,
} = require("../services/thread-detail/thread-detail-response-preparation-service");
const responsePreparationAdapter = require("../adapters/thread-detail-response-preparation-service");
const {
  createThreadSummaryStateService,
} = require("../adapters/thread-summary-state-service");
const {
  createThreadDetailCompactionService,
} = require("../adapters/thread-detail-compaction-service");

test("display summary merge preserves fresh rollout metadata over stale projection metadata", () => {
  const service = createThreadSummaryStateService({
    annotateThreadRolloutStats: (thread) => thread,
    normalizeStaleContextOnlyActiveThread: (thread) => thread,
    threadListSummaryTimestampMs(thread) {
      return Number(thread && thread.rolloutSizeUpdatedAtMs || 0);
    },
  });

  const merged = service.mergeThreadDisplaySummary({
    id: "thread-1",
    name: "Cached projection",
    path: "/tmp/stale-rollout.jsonl",
    rolloutSizeBytes: 9_102_421,
    rolloutSizeUpdatedAtMs: 100,
  }, {
    id: "thread-1",
    name: "Current summary",
    path: "/tmp/current-rollout.jsonl",
    rolloutSizeBytes: 36_525_689,
    rolloutSizeUpdatedAtMs: 200,
    rolloutWarningThresholdBytes: 8_000_000,
    rolloutOverWarningThreshold: true,
  });

  assert.equal(merged.name, "Current summary");
  assert.equal(merged.path, "/tmp/current-rollout.jsonl");
  assert.equal(merged.rolloutSizeBytes, 36_525_689);
  assert.equal(merged.rolloutSizeUpdatedAtMs, 200);
  assert.equal(merged.rolloutWarningThresholdBytes, 8_000_000);
  assert.equal(merged.rolloutOverWarningThreshold, true);
});

test("thread detail rollout size prefers current file stat over stale thread field", () => {
  const service = createThreadDetailResponsePreparationService({
    rolloutPathForThread: (thread) => thread && thread.path,
    rolloutStatsForPath: (rolloutPath) => rolloutPath
      ? { sizeBytes: 36_525_689, mtimeMs: 200 }
      : null,
  });

  assert.equal(service.threadRolloutSizeBytes({
    id: "thread-1",
    path: "/tmp/current-rollout.jsonl",
    rolloutSizeBytes: 9_102_421,
  }), 36_525_689);
  assert.equal(service.threadRolloutSizeBytes({
    id: "thread-2",
    rolloutSizeBytes: 9_102_421,
  }), 9_102_421);
});

test("thread detail response preparation adapter exports the canonical service", () => {
  assert.equal(
    responsePreparationAdapter.createThreadDetailResponsePreparationService,
    createThreadDetailResponsePreparationService,
  );
});

test("turns-list initial detail preparation keeps bounded usage summaries on window path", async () => {
  const calls = [];
  let compactOptions = null;
  let requestPayload = null;
  const service = createThreadDetailResponsePreparationService({
    maxThreadTurns: 3,
    codex: {
      request: async (method, payload) => {
        calls.push(`request:${method}`);
        requestPayload = payload;
        return {
          data: [
            { id: "turn-1", status: { type: "completed" }, items: [{ id: "u1", type: "userMessage", text: "hello" }] },
          ],
        };
      },
    },
    compactThreadReadResult: (result, options = {}) => {
      calls.push("compact-thread");
      compactOptions = options;
      return result;
    },
    compactTurnsListResult: (result, options = {}) => {
      calls.push("compact-turns-list");
      assert.equal(options.threadId, "thread-1");
      assert.equal(options.summary.id, "thread-1");
      return Object.assign({}, result, {
        data: result.data.map((turn) => Object.assign({}, turn, {
          mobileTurnsListCompacted: true,
        })),
      });
    },
    compactThreadDetailResponseResult: (result) => {
      calls.push("response-budget");
      return result;
    },
    enrichThreadItemTimestampsFromRollout: (thread) => {
      calls.push("enrich-timestamps");
      return thread;
    },
    backfillMissingRolloutCompletionTurnsForDetailResult: (result) => {
      calls.push("completion-backfill");
      return result;
    },
    rolloutPathForThread: (thread) => thread && thread.rolloutPath,
    readRolloutTurnUsageSummaries: (rolloutPath, options = {}) => {
      calls.push("read-usage");
      assert.equal(rolloutPath, "/tmp/rollout.jsonl");
      assert.deepEqual(options.targetTurnIds, ["turn-1"]);
      return {
        byTurnId: new Map([[
          "turn-1",
          { timestampMs: 1_234, totalTokenUsage: { totalTokens: 42 } },
        ]]),
        unscoped: [],
      };
    },
    attachTurnUsageSummaries: (thread, summaries) => {
      calls.push("attach-usage");
      const summary = summaries.byTurnId.get("turn-1");
      thread.turns[0].items.push({
        id: "usage-1",
        type: "turnUsageSummary",
        mobileUsageSummary: summary,
      });
    },
    appendRolloutUserInputAnchorsToDetailResult: (result) => {
      calls.push("user-input-anchors");
      return result;
    },
    appendRolloutActiveAssistantItemsToDetailResult: (result) => {
      calls.push("active-assistant");
      return result;
    },
    finalizeActiveAssistantProjectionDetailResult: (result) => {
      calls.push("finalize-active-assistant");
      return result;
    },
    prepareThreadTaskCardsToResult: async (result) => {
      calls.push("task-cards");
      return result;
    },
    finalizeThreadDetailProjectionResult: (result) => {
      calls.push("projection-finalize");
      return result;
    },
    publicRuntimeSettings: (settings) => settings || {},
    sortTurnsChronologically: (turns) => turns || [],
    isLiveTurn: () => false,
    normalizeThreadSummaryLiveStatus: (thread) => thread,
    annotateThreadRolloutStats: (thread) => thread,
  });

  const result = await service.turnsListThreadReadResult(
    "thread-1",
    { id: "thread-1", status: { type: "idle" }, rolloutPath: "/tmp/rollout.jsonl" },
    { model: "gpt-5" },
    "",
    "turns-list-initial",
  );

  assert.equal(requestPayload.limit, 3);
  assert.equal(result.thread.id, "thread-1");
  assert.equal(result.thread.mobileReadMode, "turns-list-initial");
  assert.equal(result.thread.turns[0].mobileTurnsListCompacted, true);
  assert.deepEqual(result.thread.turns[0].items.map((item) => item.type), [
    "userMessage",
    "turnUsageSummary",
  ]);
  assert.deepEqual(compactOptions, {
    maxTurns: 3,
    turnsListWindow: true,
  });
  assert.equal(calls.includes("enrich-timestamps"), false);
  assert.equal(calls.includes("completion-backfill"), false);
  assert.equal(calls.includes("user-input-anchors"), false);
  assert.equal(calls.includes("active-assistant"), false);
  assert.equal(calls.includes("finalize-active-assistant"), false);
  assert.deepEqual(calls, [
    "request:thread/turns/list",
    "compact-turns-list",
    "compact-thread",
    "read-usage",
    "attach-usage",
    "task-cards",
    "projection-finalize",
    "response-budget",
  ]);
});

test("turns-list window compaction skips rollout-heavy detail enrichment", () => {
  const calls = [];
  const service = createThreadDetailCompactionService({
    operationalItemTypes: new Set(["command"]),
    maxThreadTurns: 1,
    pendingSteerEchoStore: {
      injectIntoThread: () => calls.push("pending-steer"),
    },
    reconcileThreadActiveTurnWithRolloutEvidence: () => calls.push("reconcile-rollout"),
    normalizeSupersededLiveTurns: () => calls.push("normalize-superseded"),
    pruneSupersededLiveShellTurns: () => calls.push("prune-shell"),
    appendMissingRolloutCompletionTurnsToThread: () => calls.push("append-completion"),
    enrichThreadItemTimestampsFromRollout: () => calls.push("enrich-timestamps"),
    readRolloutToolOutputImageItems: () => {
      calls.push("read-tool-images");
      return { suppressedUploadViewImageCallIdsByTurn: new Map() };
    },
    appendRolloutToolOutputImagesToThread: () => calls.push("append-tool-images"),
    appendRolloutFinalReceiptsToThread: () => calls.push("append-final-receipts"),
    appendRolloutEmptyCompletionDiagnosticsToThread: () => calls.push("append-empty-diagnostics"),
    attachTurnUsageSummaries: () => calls.push("attach-usage"),
    readRolloutTurnUsageSummaries: () => {
      calls.push("read-usage");
      return {};
    },
    rolloutPathForThread: () => "/tmp/large-rollout.jsonl",
    rolloutStatsForPath: () => ({ sizeBytes: 600_000_000 }),
    workspaceContextStatsForCwd: () => ({}),
    inferTurnItemDisplayTimestamps: (turn) => turn,
    orderTurnItemsByDisplayTimestamp: (turn) => turn,
    dedupeUserMessageEchoesInThread: (thread) => {
      calls.push("dedupe-user-echoes");
      return thread;
    },
    normalizeStaleContextOnlyActiveThread: (thread) => thread,
    annotateThreadRolloutStats: (thread) => thread,
    isLiveTurn: () => false,
    isCompletedStatus: (status) => String(status && status.type || status || "") === "completed",
    statusText: (status) => String(status && status.type || status || ""),
    truncateMiddle: (value) => value,
    truncateTail: (value) => value,
    compactStringArray: (value) => value,
    compactStructured: (value) => value,
    attachGeneratedImageContent: () => {},
  });

  const compacted = service.compactThread({
    id: "thread-1",
    status: { type: "idle" },
    turns: [
      { id: "old", status: { type: "completed" }, items: [{ id: "old-user", type: "userMessage", text: "old" }] },
      {
        id: "new",
        status: { type: "completed" },
        items: [
          { id: "new-user", type: "userMessage", text: "new" },
          { id: "cmd", type: "command", text: "expensive op" },
        ],
      },
    ],
  }, {
    maxTurns: 1,
    turnsListWindow: true,
  });

  assert.equal(compacted.turns.length, 1);
  assert.equal(compacted.turns[0].id, "new");
  assert.deepEqual(compacted.turns[0].items.map((item) => item.id), ["new-user"]);
  assert.equal(compacted.mobileTurnsListWindowCompaction.skippedRolloutEnrichment, true);
  assert.equal(calls.includes("reconcile-rollout"), false);
  assert.equal(calls.includes("append-completion"), false);
  assert.equal(calls.includes("enrich-timestamps"), false);
  assert.equal(calls.includes("read-tool-images"), false);
  assert.equal(calls.includes("append-final-receipts"), false);
  assert.equal(calls.includes("read-usage"), false);
  assert.deepEqual(calls, [
    "pending-steer",
    "normalize-superseded",
    "prune-shell",
    "dedupe-user-echoes",
  ]);
});
