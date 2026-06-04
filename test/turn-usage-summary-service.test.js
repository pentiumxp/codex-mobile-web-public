"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  attachTurnUsageSummaries,
  collectTokenUsageStatsFromEntries,
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
  assert.equal(summary.turnTokenUsage.cachedInputTokens, 40_000);
  assert.equal(summary.finalTokenUsage.cachedInputTokens, 40_000);
  assert.equal(summary.totalTokenUsage.totalTokens, 124_000);
});

test("derives turn token usage from cumulative token deltas across repeated token_count events", () => {
  const entries = [
    { type: "turn_context", timestamp: "2026-05-27T00:59:00.000Z", payload: { turn_id: "previous" } },
    {
      type: "event_msg",
      timestamp: "2026-05-27T00:59:30.000Z",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: {
            input_tokens: 1_000,
            cached_input_tokens: 400,
            output_tokens: 100,
            reasoning_output_tokens: 50,
            total_tokens: 1_100,
          },
          total_token_usage: {
            input_tokens: 10_000,
            cached_input_tokens: 4_000,
            output_tokens: 1_000,
            reasoning_output_tokens: 500,
            total_tokens: 11_000,
          },
          model_context_window: 20_000,
        },
      },
    },
    { type: "turn_context", timestamp: "2026-05-27T01:00:00.000Z", payload: { turn_id: "turn-multi" } },
    {
      type: "event_msg",
      timestamp: "2026-05-27T01:00:20.000Z",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: {
            input_tokens: 1_200,
            cached_input_tokens: 600,
            output_tokens: 60,
            reasoning_output_tokens: 30,
            total_tokens: 1_260,
          },
          total_token_usage: {
            input_tokens: 10_200,
            cached_input_tokens: 4_100,
            output_tokens: 1_060,
            reasoning_output_tokens: 530,
            total_tokens: 11_260,
          },
          model_context_window: 20_000,
        },
      },
    },
    {
      type: "event_msg",
      timestamp: "2026-05-27T01:00:21.000Z",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: {
            input_tokens: 1_200,
            cached_input_tokens: 600,
            output_tokens: 60,
            reasoning_output_tokens: 30,
            total_tokens: 1_260,
          },
          total_token_usage: {
            input_tokens: 10_200,
            cached_input_tokens: 4_100,
            output_tokens: 1_060,
            reasoning_output_tokens: 530,
            total_tokens: 11_260,
          },
          model_context_window: 20_000,
        },
      },
    },
    {
      type: "event_msg",
      timestamp: "2026-05-27T01:01:00.000Z",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: {
            input_tokens: 1_500,
            cached_input_tokens: 1_300,
            output_tokens: 70,
            reasoning_output_tokens: 20,
            total_tokens: 1_570,
          },
          total_token_usage: {
            input_tokens: 10_600,
            cached_input_tokens: 4_300,
            output_tokens: 1_120,
            reasoning_output_tokens: 550,
            total_tokens: 11_720,
          },
          model_context_window: 20_000,
        },
      },
    },
  ];

  const summaries = collectTurnUsageSummariesFromEntries(entries);
  const summary = summaries.byTurnId.get("turn-multi");

  assert.equal(summary.timestamp, "2026-05-27T01:01:00.000Z");
  assert.equal(summary.contextWindowUsedTokens, 1_500);
  assert.equal(summary.finalTokenUsage.inputTokens, 1_500);
  assert.equal(summary.finalTokenUsage.outputTokens, 70);
  assert.equal(summary.turnTokenUsage.inputTokens, 600);
  assert.equal(summary.turnTokenUsage.cachedInputTokens, 300);
  assert.equal(summary.turnTokenUsage.outputTokens, 120);
  assert.equal(summary.turnTokenUsage.reasoningOutputTokens, 50);
  assert.equal(summary.turnTokenUsage.totalTokens, 720);
  assert.equal(summary.lastTokenUsage.inputTokens, 600);
  assert.equal(summary.lastTokenUsage.totalTokens, 720);
  assert.equal(summary.totalTokenUsage.totalTokens, 11_720);
});

test("ignores final zero window token_count sentinel and preserves prior valid usage", () => {
  const entries = [
    { type: "turn_context", timestamp: "2026-05-27T10:44:59.075Z", payload: { turn_id: "turn-sentinel" } },
    {
      type: "event_msg",
      timestamp: "2026-05-27T10:48:56.171Z",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: {
            input_tokens: 208_473,
            cached_input_tokens: 201_600,
            output_tokens: 918,
            reasoning_output_tokens: 433,
            total_tokens: 209_391,
          },
          total_token_usage: {
            input_tokens: 811_881,
            cached_input_tokens: 642_048,
            output_tokens: 3_466,
            reasoning_output_tokens: 1_869,
            total_tokens: 1_073_747,
          },
          model_context_window: 258_400,
        },
      },
    },
    {
      type: "event_msg",
      timestamp: "2026-05-27T10:53:17.789Z",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: {
            input_tokens: 0,
            cached_input_tokens: 0,
            output_tokens: 0,
            reasoning_output_tokens: 0,
            total_tokens: 0,
          },
          total_token_usage: {
            input_tokens: 0,
            cached_input_tokens: 0,
            output_tokens: 0,
            reasoning_output_tokens: 0,
            total_tokens: 258_400,
          },
          model_context_window: 258_400,
        },
      },
    },
  ];

  const summaries = collectTurnUsageSummariesFromEntries(entries);
  const summary = summaries.byTurnId.get("turn-sentinel");

  assert.equal(summary.timestamp, "2026-05-27T10:48:56.171Z");
  assert.equal(summary.contextWindowUsedTokens, 208_473);
  assert.equal(summary.contextRiskLevel, "warn");
  assert.equal(summary.lastTokenUsage.inputTokens, 208_473);
  assert.equal(summary.totalTokenUsage.totalTokens, 1_073_747);
});

test("omits usage summary when a turn only has zero window sentinel token_count", () => {
  const summaries = collectTurnUsageSummariesFromEntries([
    { type: "turn_context", timestamp: "2026-05-27T10:39:21.731Z", payload: { turn_id: "turn-only-sentinel" } },
    {
      type: "event_msg",
      timestamp: "2026-05-27T10:41:58.198Z",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: {
            input_tokens: 0,
            cached_input_tokens: 0,
            output_tokens: 0,
            reasoning_output_tokens: 0,
            total_tokens: 0,
          },
          total_token_usage: {
            input_tokens: 0,
            cached_input_tokens: 0,
            output_tokens: 0,
            reasoning_output_tokens: 0,
            total_tokens: 258_400,
          },
          model_context_window: 258_400,
        },
      },
    },
  ]);

  assert.equal(summaries.byTurnId.has("turn-only-sentinel"), false);
  assert.equal(summaries.unscoped.length, 0);
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
    workspaceContextStats: {
      projectContextSizeBytes: 4096,
      handoffSizeBytes: 8192,
      agentsSizeBytes: 512,
      workspaceContextPairSizeBytes: 12288,
      fileThresholdBytes: 102400,
      handoffPromptThresholdBytes: 204800,
      pairThresholdBytes: 204800,
    },
  });

  assert.equal(thread.turns[0].items.length, 1);
  assert.equal(thread.turns[0].items[0].type, "turnUsageSummary");
  assert.equal(thread.turns[0].items[0].mobileUsageSummary.rolloutSizeBytes, 1234);
  assert.equal(thread.turns[0].items[0].mobileUsageSummary.projectContextSizeBytes, 4096);
  assert.equal(thread.turns[0].items[0].mobileUsageSummary.handoffSizeBytes, 8192);
  assert.equal(thread.turns[0].items[0].mobileUsageSummary.workspaceContextPairSizeBytes, 12288);
  assert.equal(thread.turns[0].items[0].mobileUsageSummary.workspaceHandoffPromptThresholdBytes, 204800);
  assert.equal(thread.turns[1].items.length, 0);
});

test("context risk thresholds match visible warning levels", () => {
  assert.equal(contextRiskLevel(69.9), "normal");
  assert.equal(contextRiskLevel(70), "warn");
  assert.equal(contextRiskLevel(85), "high");
  assert.equal(contextRiskLevel(95), "critical");
  assert.equal(contextRiskLevel(Number.NaN), "unknown");
});

test("aggregates daily token usage stats from scoped token_count deltas", () => {
  const entries = [
    { type: "turn_context", timestamp: "2026-05-31T22:00:00.000+08:00", payload: { turn_id: "old" } },
    {
      type: "event_msg",
      timestamp: "2026-05-31T22:00:20.000+08:00",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: { input_tokens: 9_000, output_tokens: 1_000, total_tokens: 10_000 },
          total_token_usage: { input_tokens: 9_000, output_tokens: 1_000, total_tokens: 10_000 },
          model_context_window: 20_000,
        },
      },
    },
    { type: "turn_context", timestamp: "2026-06-01T09:00:00.000+08:00", payload: { turn_id: "today" } },
    {
      type: "event_msg",
      timestamp: "2026-06-01T09:00:10.000+08:00",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: { input_tokens: 12_000, cached_input_tokens: 2_000, output_tokens: 2_000, total_tokens: 14_000 },
          total_token_usage: { input_tokens: 21_000, cached_input_tokens: 2_000, output_tokens: 3_000, total_tokens: 24_000 },
          model_context_window: 30_000,
        },
      },
    },
    {
      type: "event_msg",
      timestamp: "2026-06-01T09:01:10.000+08:00",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: { input_tokens: 2_000, output_tokens: 1_000, total_tokens: 3_000 },
          total_token_usage: { input_tokens: 23_000, cached_input_tokens: 2_000, output_tokens: 4_000, total_tokens: 27_000 },
          model_context_window: 30_000,
        },
      },
    },
  ];

  const stats = collectTokenUsageStatsFromEntries(entries, {
    nowMs: Date.parse("2026-06-01T12:00:00.000+08:00"),
  });

  assert.equal(stats.totals.totalTokens, 27_000);
  assert.equal(stats.today.totalTokens, 17_000);
  assert.equal(stats.week.totalTokens, 17_000);
  assert.equal(stats.daily[0].date, "2026-06-01");
  assert.equal(stats.daily[0].totalTokens, 17_000);
  assert.equal(stats.daily[1].date, "2026-05-31");
  assert.equal(stats.daily[1].totalTokens, 10_000);
  assert.equal(stats.byTurnId.get("today").totalTokens, 17_000);
  assert.equal(stats.eventCount, 3);
});
