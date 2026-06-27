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

test("thread detail response budget keeps bounded active assistant tail", () => {
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
            { id: "a1", type: "agentMessage", text: "first progress" },
            { id: "a2", type: "agentMessage", text: "second progress" },
            { id: "a3", type: "agentMessage", text: "third progress" },
            { id: "a4", type: "agentMessage", text: "latest progress" },
            { id: "usage", type: "turnUsageSummary" },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeAssistantItems: 2,
  });

  const turn = compacted.thread.turns[0];
  assert.deepEqual(turn.items.map((item) => item.id), ["u1", "a3", "a4", "usage"]);
  assert.equal(turn.mobileOmittedAssistantItemCount, 2);
  assert.deepEqual(turn.mobileAssistantItemBudget, {
    version: "thread-detail-assistant-item-budget-v1",
    omitted: 2,
    retained: 2,
    original: 4,
  });
  assert.equal(compacted.thread.mobileDetailResponseBudget.omittedAssistantItems, 2);
  assert.equal(compacted.thread.mobileDetailResponseBudget.activeAssistantItems, 2);
  assert.deepEqual(compacted.thread.mobileVisibleItemKeys, turn.items.map((item) => item.mobileVisibleKey));
});

test("thread detail response budget treats non-current active-looking turns as stale when active id is known", () => {
  const result = {
    thread: {
      id: "thread-1",
      activeTurnId: "turn-current",
      mobileReadMode: "projection-active-overlay",
      turns: [
        {
          id: "turn-stale",
          status: "inProgress",
          items: [
            { id: "u1", type: "userMessage", text: "Old question" },
            { id: "a1", type: "agentMessage", text: "old progress 1" },
            { id: "a2", type: "agentMessage", text: "old progress 2" },
            { id: "r1", type: "reasoning", text: "old reason" },
            { id: "c1", type: "commandExecution", command: "a" },
            { id: "c2", type: "commandExecution", command: "b" },
            { id: "c3", type: "commandExecution", command: "c" },
          ],
        },
        {
          id: "turn-current",
          status: "inProgress",
          items: [
            { id: "a3", type: "agentMessage", text: "current progress 1" },
            { id: "a4", type: "agentMessage", text: "current progress 2" },
            { id: "c4", type: "commandExecution", command: "d" },
            { id: "c5", type: "commandExecution", command: "e" },
            { id: "r2", type: "reasoning", text: "current reason" },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    completedOperationItems: 1,
    completedAssistantItems: 1,
    completedReasoningItems: 0,
    activeOperationItems: 2,
    activeAssistantItems: 2,
    activeReasoningItems: 1,
    activeProgressiveItemThreshold: 0,
  });

  assert.deepEqual(compacted.thread.turns[0].items.map((item) => item.id), ["u1", "a2", "c3"]);
  assert.deepEqual(compacted.thread.turns[1].items.map((item) => item.id), ["a3", "a4", "c4", "c5", "r2"]);
  assert.equal(compacted.thread.mobileDetailResponseBudget.activeTurnCount, 1);
  assert.equal(compacted.thread.mobileDetailResponseBudget.staleActiveTurnCount, 1);
  assert.equal(compacted.thread.mobileDetailResponseBudget.omittedOperationItems, 2);
  assert.equal(compacted.thread.mobileDetailResponseBudget.omittedReasoningItems, 1);
  assert.equal(compacted.thread.mobileDetailResponseBudget.omittedAssistantItems, 1);
});

test("thread detail response budget applies progressive active limits under item pressure", () => {
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
            ...Array.from({ length: 10 }, (_, index) => ({
              id: `a${index + 1}`,
              type: "agentMessage",
              text: `progress ${index + 1}`,
            })),
            ...Array.from({ length: 10 }, (_, index) => ({
              id: `c${index + 1}`,
              type: "commandExecution",
              command: `cmd ${index + 1}`,
            })),
            ...Array.from({ length: 3 }, (_, index) => ({
              id: `r${index + 1}`,
              type: "reasoning",
              text: `reason ${index + 1}`,
            })),
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeOperationItems: 8,
    activeAssistantItems: 8,
    activeReasoningItems: 2,
    activeProgressiveItemThreshold: 12,
    progressiveActiveOperationItems: 4,
    progressiveActiveAssistantItems: 3,
    progressiveActiveReasoningItems: 1,
  });

  const itemIds = compacted.thread.turns[0].items.map((item) => item.id);
  assert.deepEqual(itemIds, [
    "u1",
    "a8",
    "a9",
    "a10",
    "c7",
    "c8",
    "c9",
    "c10",
    "r3",
  ]);
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.progressiveActiveBudgetApplied, true);
  assert.equal(budget.progressiveActiveBudgetReason, "active-item-pressure");
  assert.equal(budget.activeOperationItems, 4);
  assert.equal(budget.activeAssistantItems, 3);
  assert.equal(budget.activeReasoningItems, 1);
  assert.equal(budget.configuredActiveOperationItems, 8);
  assert.equal(budget.configuredActiveAssistantItems, 8);
  assert.equal(budget.configuredActiveReasoningItems, 2);
  assert.equal(budget.progressiveActiveOriginalItemCount, 24);
  assert.equal(budget.progressiveActiveTurnOriginalItemCount, 24);
});

test("thread detail response budget keeps the latest completed assistant receipt", () => {
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
            { id: "a1", type: "agentMessage", text: "old progress" },
            { id: "plan1", type: "plan", text: "plan progress" },
            { id: "a2", type: "agentMessage", text: "final receipt" },
            { id: "usage", type: "turnUsageSummary" },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    completedAssistantItems: 1,
  });

  const turn = compacted.thread.turns[0];
  assert.deepEqual(turn.items.map((item) => item.id), ["u1", "a2", "usage"]);
  assert.equal(turn.mobileOmittedAssistantItemCount, 2);
  assert.equal(compacted.thread.mobileDetailResponseBudget.omittedAssistantItems, 2);
  assert.equal(compacted.thread.mobileDetailResponseBudget.completedAssistantItems, 1);
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
