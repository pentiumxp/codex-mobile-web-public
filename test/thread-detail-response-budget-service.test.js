"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  compactThreadDetailResponseResult,
} = require("../adapters/thread-detail-response-budget-service");

function compactTurn(turn, options = {}) {
  const out = JSON.parse(JSON.stringify(turn));
  const operationTypes = new Set(["commandExecution", "fileChange", "dynamicToolCall", "mcpToolCall"]);
  const maxOperations = Math.max(0, Number(options.maxOperationItems || 0));
  const keep = new Set();
  for (let index = out.items.length - 1; index >= 0; index -= 1) {
    if (!operationTypes.has(String(out.items[index] && out.items[index].type || ""))) continue;
    keep.add(index);
    if (keep.size >= maxOperations) break;
  }
  out.items = out.items.filter((item, index) => !operationTypes.has(String(item && item.type || "")) || keep.has(index));
  return out;
}

test("thread detail response budget trims operation and reasoning items and rebuilds visible keys", () => {
  const result = {
    thread: {
      id: "thread-1",
      mobileReadMode: "projection-v4-dynamic",
      mobileProjectionRevision: 7,
      mobileVisibleItemKeys: ["stale"],
      turns: [
        {
          id: "turn-1",
          status: "completed",
          items: [
            { id: "u1", type: "userMessage", text: "Question" },
            { id: "r1", type: "reasoning", text: "" },
            { id: "c1", type: "commandExecution", command: "a" },
            { id: "c2", type: "commandExecution", command: "b" },
            { id: "c3", type: "commandExecution", command: "c" },
            { id: "a1", type: "agentMessage", text: "Answer part" },
            { id: "usage", type: "turnUsageSummary" },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    completedOperationItems: 1,
    completedReasoningItems: 0,
  });

  const items = compacted.thread.turns[0].items;
  assert.deepEqual(items.map((item) => item.type), [
    "userMessage",
    "commandExecution",
    "agentMessage",
    "turnUsageSummary",
  ]);
  assert.equal(items[1].id, "c3");
  assert.deepEqual(compacted.thread.mobileVisibleItemKeys, items.map((item) => item.mobileVisibleKey));
  assert.equal(compacted.thread.mobileProjectionRevision, 7);
  assert.equal(compacted.thread.mobileDetailResponseBudget.applied, true);
  assert.equal(compacted.thread.mobileDetailResponseBudget.omittedOperationItems, 2);
  assert.equal(compacted.thread.mobileDetailResponseBudget.omittedReasoningItems, 1);
});

test("thread detail response budget keeps bounded active reasoning and operation tail", () => {
  const result = {
    thread: {
      id: "thread-1",
      activeTurnId: "turn-active",
      mobileReadMode: "projection-active-overlay",
      turns: [
        {
          id: "turn-active",
          status: "inProgress",
          items: [
            { id: "u1", type: "userMessage", text: "Question" },
            { id: "r1", type: "reasoning", text: "" },
            { id: "r2", type: "reasoning", text: "" },
            { id: "r3", type: "reasoning", text: "" },
            { id: "c1", type: "commandExecution", command: "a" },
            { id: "c2", type: "commandExecution", command: "b" },
            { id: "a1", type: "agentMessage", text: "Working" },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeOperationItems: 1,
    activeReasoningItems: 2,
  });

  const items = compacted.thread.turns[0].items;
  assert.deepEqual(items.map((item) => item.id), ["u1", "r2", "r3", "c2", "a1"]);
  assert.equal(compacted.thread.mobileDetailResponseBudget.omittedOperationItems, 1);
  assert.equal(compacted.thread.mobileDetailResponseBudget.omittedReasoningItems, 1);
});

test("thread detail response budget leaves already small details unchanged", () => {
  const result = {
    thread: {
      id: "thread-1",
      mobileReadMode: "projection-v4-dynamic",
      turns: [
        {
          id: "turn-1",
          status: "completed",
          items: [
            { id: "u1", type: "userMessage", text: "Question" },
            { id: "a1", type: "agentMessage", text: "Answer" },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, { compactTurn });

  assert.equal(compacted.thread.mobileDetailResponseBudget, undefined);
  assert.deepEqual(compacted, result);
});
