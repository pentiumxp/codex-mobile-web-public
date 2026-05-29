"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  buildTurnCompletionDetailMessage,
  finalReceiptTextFromParams,
} = require("../adapters/turn-completion-receipt-service");

test("extracts final receipt text from turn completion payload", () => {
  const text = finalReceiptTextFromParams({
    last_agent_message: {
      content: [
        { type: "output_text", text: "Line 1" },
        { type: "output_text", text: "Line 2" },
      ],
    },
  });
  assert.equal(text, "Line 1\nLine 2");
});

test("builds bounded markdown detail message with final receipt and usage", () => {
  const detail = buildTurnCompletionDetailMessage({
    threadTitle: "Finance thread",
    completedAt: "2026-05-29T15:20:00.000Z",
    turnId: "turn-1",
    params: {
      last_agent_message: "Final answer",
    },
    turnUsageSummary: {
      contextWindowUsedPercent: 83,
      contextWindowUsedTokens: 83000,
      modelContextWindow: 100000,
      contextRiskLevel: "high",
      lastTokenUsage: { inputTokens: 1200, outputTokens: 80, totalTokens: 1280 },
      totalTokenUsage: { inputTokens: 50000, outputTokens: 4000, totalTokens: 54000 },
      rolloutSizeBytes: 1024 * 1024,
      rolloutWarningThresholdBytes: 200 * 1024 * 1024,
    },
  });

  assert.equal(detail.format, "markdown");
  assert.equal(detail.sourceTurnId, "turn-1");
  assert.equal(detail.truncated, false);
  assert.match(detail.body, /# Finance thread/);
  assert.match(detail.body, /## 最终回执/);
  assert.match(detail.body, /Final answer/);
  assert.match(detail.body, /## Usage/);
  assert.match(detail.body, /context window: 83%/);
});

test("truncates overly long receipt bodies", () => {
  const detail = buildTurnCompletionDetailMessage({
    threadTitle: "Long thread",
    turnId: "turn-2",
    params: { last_agent_message: "A".repeat(4000) },
    maxChars: 1200,
  });
  assert.equal(detail.truncated, true);
  assert.match(detail.body, /\.\.\.\(truncated\)$/);
  assert.ok(detail.body.length <= 1200);
});
