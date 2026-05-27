"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  attachTurnUsageSummaries,
  collectTurnUsageSummariesFromEntries,
  collectTurnUsageSummariesFromRolloutText,
  contextRiskLevel,
} = require("../adapters/turn-usage-summary-service");

test("collects token_count events under the current rollout turn", () => {
  const entries = [
    { type: "turn_context", timestamp: "2026-05-27T01:00:00.000Z", payload: { turn_id: "turn-1" } },
    {
      type: "event_msg",
      timestamp: "2026-05-27T01:00:02.000Z",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: {
            input_tokens: 90_000,
            cached_input_tokens: 40_000,
            output_tokens: 1_200,
            reasoning_output_tokens: 300,
            total_tokens: 91_200,
          },
          total_token_usage: {
            input_tokens: 120_000,
            output_tokens: 4_000,
            total_tokens: 124_000,
          },
          model_context_window: 100_000,
        },
      },
    },
  ];

  const summaries = collectTurnUsageSummariesFromEntries(entries);
  const summary = summaries.byTurnId.get("turn-1");

  assert.equal(summary.turnId, "turn-1");
  assert.equal(summary.contextWindowUsedTokens, 90_000);
  assert.equal(summary.contextWindowUsedPercent, 90);
  assert.equal(summary.contextRiskLevel, "high");
  assert.equal(summary.lastTokenUsage.cachedInputTokens, 40_000);
  assert.equal(summary.totalTokenUsage.totalTokens, 124_000);
});

test("parses rollout jsonl token counts and ignores malformed lines", () => {
  const text = [
    JSON.stringify({ type: "turn_context", payload: { turn_id: "turn-jsonl" } }),
    "not-json",
    JSON.stringify({
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: { input_tokens: 70, output_tokens: 5, total_tokens: 75 },
          model_context_window: 100,
        },
      },
    }),
  ].join("\n");

  const summaries = collectTurnUsageSummariesFromRolloutText(text);

  assert.equal(summaries.byTurnId.get("turn-jsonl").contextRiskLevel, "warn");
  assert.equal(summaries.unscoped.length, 0);
});

test("attaches summaries only to completed turns and includes rollout stats", () => {
  const summaries = collectTurnUsageSummariesFromEntries([
    { type: "turn_context", payload: { turn_id: "done" } },
    {
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
          total_token_usage: { input_tokens: 20, output_tokens: 3, total_tokens: 23 },
          model_context_window: 100,
        },
      },
    },
  ]);
  const thread = {
    turns: [
      { id: "done", status: { type: "completed" }, items: [{ id: "old", type: "turnUsageSummary" }] },
      { id: "live", status: { type: "running" }, items: [] },
    ],
  };

  attachTurnUsageSummaries(thread, summaries, {
    rolloutStats: {
      sizeBytes: 1234,
      warningThresholdBytes: 2048,
      overWarningThreshold: false,
    },
  });

  assert.equal(thread.turns[0].items.length, 1);
  assert.equal(thread.turns[0].items[0].type, "turnUsageSummary");
  assert.equal(thread.turns[0].items[0].mobileUsageSummary.rolloutSizeBytes, 1234);
  assert.equal(thread.turns[1].items.length, 0);
});

test("context risk thresholds match visible warning levels", () => {
  assert.equal(contextRiskLevel(69.9), "normal");
  assert.equal(contextRiskLevel(70), "warn");
  assert.equal(contextRiskLevel(85), "high");
  assert.equal(contextRiskLevel(95), "critical");
  assert.equal(contextRiskLevel(Number.NaN), "unknown");
});
