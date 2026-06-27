"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  compactThreadDetailResponseResult,
} = require("../adapters/thread-detail-response-budget-service");

function compactTurn(turn, options = {}) {
  const out = JSON.parse(JSON.stringify(turn));
  const operationTypes = new Set(["commandExecution", "collabAgentToolCall", "fileChange", "dynamicToolCall", "mcpToolCall"]);
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

test("thread detail response budget trims collab agent tool calls as operation items", () => {
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
            { id: "s1", type: "collabAgentToolCall", name: "agent-one" },
            { id: "s2", type: "collabAgentToolCall", name: "agent-two" },
            { id: "s3", type: "collabAgentToolCall", name: "agent-three" },
            { id: "a1", type: "agentMessage", text: "Working" },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeOperationItems: 1,
  });

  const items = compacted.thread.turns[0].items;
  assert.deepEqual(items.map((item) => item.id), ["u1", "s3", "a1"]);
  assert.equal(items[1].mobileVisibleKind, "operation");
  assert.equal(compacted.thread.mobileDetailResponseBudget.omittedOperationItems, 2);
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

test("thread detail response budget applies progressive active limits under active byte pressure", () => {
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
            { id: "a1", type: "agentMessage", text: "x".repeat(160) },
            { id: "a2", type: "agentMessage", text: "y".repeat(160) },
            { id: "a3", type: "agentMessage", text: "z".repeat(160) },
            { id: "a4", type: "agentMessage", text: "latest" },
            { id: "c1", type: "commandExecution", command: "cmd 1" },
            { id: "c2", type: "commandExecution", command: "cmd 2" },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeOperationItems: 2,
    activeAssistantItems: 4,
    activeReasoningItems: 2,
    activeProgressiveItemThreshold: 100,
    activeProgressiveByteThreshold: 200,
    activeProgressiveThreadByteThreshold: 0,
    progressiveActiveOperationItems: 1,
    progressiveActiveAssistantItems: 2,
    progressiveActiveReasoningItems: 1,
  });

  const itemIds = compacted.thread.turns[0].items.map((item) => item.id);
  assert.deepEqual(itemIds, ["u1", "a3", "a4", "c2"]);
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.progressiveActiveBudgetApplied, true);
  assert.equal(budget.progressiveActiveBudgetReason, "active-byte-pressure");
  assert.equal(budget.activeProgressiveByteThreshold, 200);
  assert.equal(budget.activeProgressiveThreadByteThreshold, 0);
  assert.ok(budget.progressiveActiveTurnOriginalBytes >= 200);
  assert.ok(budget.progressiveActiveOriginalBytes >= budget.progressiveActiveTurnOriginalBytes);
  assert.equal(budget.activeOperationItems, 1);
  assert.equal(budget.activeAssistantItems, 2);
});

test("thread detail response budget truncates oversized retained active assistant text under progressive pressure", () => {
  const result = {
    thread: {
      id: "thread-1",
      activeTurnId: "turn-active",
      mobileReadMode: "projection-active-overlay",
      mobileProjectionRevision: 11,
      turns: [
        {
          id: "turn-active",
          status: "inProgress",
          items: [
            { id: "u1", type: "userMessage", text: "Question" },
            { id: "a1", type: "agentMessage", text: "A".repeat(2400) },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeProgressiveItemThreshold: 100,
    activeProgressiveByteThreshold: 1000,
    activeProgressiveThreadByteThreshold: 0,
    progressiveActiveAssistantItems: 1,
    progressiveActiveTextChars: 1000,
  });

  const assistant = compacted.thread.turns[0].items[1];
  assert.equal(assistant.id, "a1");
  assert.equal(assistant.mobileTextTruncated, true);
  assert.match(assistant.text, /active item preview truncated/);
  assert.ok(assistant.text.length <= 1000);
  assert.deepEqual(assistant.mobileActiveTextBudget.fields, ["text"]);
  assert.equal(assistant.mobileActiveTextBudget.originalChars, 2400);
  assert.equal(assistant.mobileActiveTextBudget.maxChars, 1000);
  assert.ok(assistant.mobileActiveTextBudget.omittedChars > 0);
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.applied, true);
  assert.equal(budget.progressiveActiveBudgetApplied, true);
  assert.equal(budget.progressiveActiveBudgetReason, "active-byte-pressure");
  assert.equal(budget.progressiveActiveTextChars, 1000);
  assert.equal(budget.truncatedActiveTextItems, 1);
  assert.equal(budget.activeTextOriginalChars, 2400);
  assert.ok(budget.activeTextRetainedChars <= 1000);
  assert.ok(budget.omittedActiveTextChars > 0);
  assert.equal(compacted.thread.mobileProjectionRevision, 11);
  assert.deepEqual(compacted.thread.mobileVisibleItemKeys, compacted.thread.turns[0].items.map((item) => item.mobileVisibleKey));
});

test("thread detail response budget does not truncate large active text without progressive pressure", () => {
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
            { id: "a1", type: "agentMessage", text: "A".repeat(2400) },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeProgressiveItemThreshold: 100,
    activeProgressiveByteThreshold: 10_000,
    activeProgressiveThreadByteThreshold: 0,
    progressiveActiveTextChars: 1000,
  });

  assert.equal(compacted.thread.mobileDetailResponseBudget, undefined);
  assert.deepEqual(compacted, result);
});

test("thread detail response budget can disable progressive active text truncation", () => {
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
            { id: "a1", type: "agentMessage", text: "A".repeat(2400) },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeProgressiveItemThreshold: 100,
    activeProgressiveByteThreshold: 1000,
    activeProgressiveThreadByteThreshold: 0,
    progressiveActiveTextChars: 0,
  });

  const assistant = compacted.thread.turns[0].items[1];
  assert.equal(assistant.text.length, 2400);
  assert.equal(assistant.mobileActiveTextBudget, undefined);
  assert.equal(compacted.thread.mobileDetailResponseBudget.applied, false);
  assert.equal(compacted.thread.mobileDetailResponseBudget.progressiveActiveBudgetApplied, true);
  assert.equal(compacted.thread.mobileDetailResponseBudget.progressiveActiveTextChars, 0);
  assert.equal(compacted.thread.mobileDetailResponseBudget.truncatedActiveTextItems, 0);
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

test("thread detail response budget applies progressive visible item ceiling after per-turn compaction", () => {
  const completedTurn = (turnIndex) => ({
    id: `turn-${turnIndex}`,
    status: "completed",
    items: [
      { id: `u${turnIndex}`, type: "userMessage", text: `Question ${turnIndex}` },
      { id: `a${turnIndex}`, type: "agentMessage", text: `Answer ${turnIndex}` },
      { id: `usage${turnIndex}`, type: "turnUsageSummary" },
      ...Array.from({ length: 3 }, (_, index) => ({
        id: `c${turnIndex}-${index + 1}`,
        type: "commandExecution",
        command: `cmd ${turnIndex}-${index + 1}`,
      })),
    ],
  });
  const result = {
    thread: {
      id: "thread-1",
      activeTurnId: "turn-active",
      mobileReadMode: "projection-active-overlay",
      turns: [
        completedTurn(1),
        completedTurn(2),
        completedTurn(3),
        completedTurn(4),
        {
          id: "turn-active",
          status: "inProgress",
          items: [
            { id: "live-a1", type: "agentMessage", text: "Working" },
            { id: "live-c1", type: "commandExecution", command: "live 1" },
            { id: "live-c2", type: "commandExecution", command: "live 2" },
            { id: "live-r1", type: "reasoning", text: "reason" },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    completedOperationItems: 3,
    activeOperationItems: 2,
    activeAssistantItems: 1,
    activeReasoningItems: 1,
    activeProgressiveItemThreshold: 1,
    progressiveActiveOperationItems: 2,
    progressiveActiveAssistantItems: 1,
    progressiveActiveReasoningItems: 1,
    progressiveVisibleItemCeiling: 20,
  });

  const turns = compacted.thread.turns;
  assert.deepEqual(turns[0].items.map((item) => item.id), ["u1", "a1", "usage1"]);
  assert.deepEqual(turns[1].items.map((item) => item.id), ["u2", "a2", "usage2"]);
  assert.deepEqual(turns[2].items.map((item) => item.id), ["u3", "a3", "usage3", "c3-3"]);
  assert.deepEqual(turns[3].items.map((item) => item.id), ["u4", "a4", "usage4", "c4-1", "c4-2", "c4-3"]);
  assert.deepEqual(turns[4].items.map((item) => item.id), ["live-a1", "live-c1", "live-c2", "live-r1"]);
  const totalItems = turns.reduce((sum, turn) => sum + turn.items.length, 0);
  assert.equal(totalItems, 20);
  assert.equal(turns[0].mobileOmittedVisibleItemCount, 3);
  assert.equal(turns[0].mobileVisibleItemBudget.reason, "progressive-visible-item-ceiling");
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.progressiveVisibleItemBudgetApplied, true);
  assert.equal(budget.progressiveVisibleItemBudgetReason, "progressive-visible-item-ceiling");
  assert.equal(budget.progressiveVisibleItemOriginalCount, 28);
  assert.equal(budget.progressiveVisibleItemRetainedCount, 20);
  assert.equal(budget.progressiveVisibleItemCeiling, 20);
  assert.equal(budget.omittedVisibleItems, 8);
  assert.equal(budget.omittedOperationItems, 8);
  assert.equal(budget.retainedItemCount, 20);
  assert.deepEqual(compacted.thread.mobileVisibleItemKeys, turns.flatMap((turn) => turn.items.map((item) => item.mobileVisibleKey)));
});

test("thread detail response budget uses active items only after older operations for visible item ceiling", () => {
  const result = {
    thread: {
      id: "thread-1",
      activeTurnId: "turn-active",
      mobileReadMode: "projection-active-overlay",
      turns: [{
        id: "turn-active",
        status: "inProgress",
        items: [
          { id: "u1", type: "userMessage", text: "Question" },
          ...Array.from({ length: 6 }, (_, index) => ({
            id: `c${index + 1}`,
            type: "commandExecution",
            command: `cmd ${index + 1}`,
          })),
          { id: "r1", type: "reasoning", text: "reason 1" },
          { id: "r2", type: "reasoning", text: "reason 2" },
          { id: "a1", type: "agentMessage", text: "progress 1" },
          { id: "a2", type: "agentMessage", text: "progress 2" },
        ],
      }],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeOperationItems: 6,
    activeReasoningItems: 2,
    activeAssistantItems: 2,
    activeProgressiveItemThreshold: 1,
    progressiveActiveOperationItems: 6,
    progressiveActiveReasoningItems: 2,
    progressiveActiveAssistantItems: 2,
    progressiveVisibleItemCeiling: 7,
  });

  const items = compacted.thread.turns[0].items;
  assert.deepEqual(items.map((item) => item.id), ["u1", "c5", "c6", "r1", "r2", "a1", "a2"]);
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.progressiveVisibleItemBudgetApplied, true);
  assert.equal(budget.progressiveVisibleItemOriginalCount, 11);
  assert.equal(budget.progressiveVisibleItemRetainedCount, 7);
  assert.equal(budget.omittedVisibleItems, 4);
  assert.equal(budget.omittedOperationItems, 4);
  assert.equal(compacted.thread.turns[0].mobileOmittedVisibleItemCount, 4);
});

test("thread detail response budget does not apply visible item ceiling without progressive active pressure", () => {
  const result = {
    thread: {
      id: "thread-1",
      mobileReadMode: "projection-v4-dynamic",
      turns: [{
        id: "turn-completed",
        status: "completed",
        items: [
          { id: "u1", type: "userMessage", text: "Question" },
          ...Array.from({ length: 6 }, (_, index) => ({
            id: `c${index + 1}`,
            type: "commandExecution",
            command: `cmd ${index + 1}`,
          })),
          { id: "a1", type: "agentMessage", text: "Answer" },
          { id: "usage", type: "turnUsageSummary" },
        ],
      }],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    completedOperationItems: 3,
    activeProgressiveItemThreshold: 1,
    progressiveVisibleItemCeiling: 4,
  });

  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.progressiveActiveBudgetApplied, false);
  assert.equal(budget.progressiveVisibleItemBudgetApplied, false);
  assert.equal(budget.progressiveVisibleItemOriginalCount, 6);
  assert.equal(budget.progressiveVisibleItemRetainedCount, 6);
  assert.equal(budget.omittedVisibleItems, 0);
  assert.equal(budget.omittedOperationItems, 3);
});

test("thread detail response budget does not mark progressive active budget without a current active turn", () => {
  const result = {
    thread: {
      id: "thread-1",
      mobileReadMode: "projection-v4-dynamic",
      turns: [
        {
          id: "turn-completed",
          status: "completed",
          items: [
            { id: "u1", type: "userMessage", text: "Question" },
            ...Array.from({ length: 40 }, (_, index) => ({
              id: `a${index + 1}`,
              type: "agentMessage",
              text: `progress ${index + 1}`,
            })),
            { id: "usage", type: "turnUsageSummary" },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    completedAssistantItems: 1,
    activeProgressiveItemThreshold: 10,
    progressiveActiveAssistantItems: 2,
  });

  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.progressiveActiveBudgetApplied, false);
  assert.equal(budget.progressiveActiveBudgetReason, "");
  assert.equal(budget.progressiveActiveOriginalItemCount, 42);
  assert.equal(budget.progressiveActiveTurnOriginalItemCount, 0);
  assert.equal(budget.activeAssistantItems, 8);
  assert.equal(budget.omittedAssistantItems, 39);
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
