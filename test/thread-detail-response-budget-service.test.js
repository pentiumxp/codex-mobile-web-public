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
  if (maxOperations <= 0) {
    out.items = out.items.filter((item) => !operationTypes.has(String(item && item.type || "")));
    return out;
  }
  for (let index = out.items.length - 1; index >= 0; index -= 1) {
    if (!operationTypes.has(String(out.items[index] && out.items[index].type || ""))) continue;
    keep.add(index);
    if (keep.size >= maxOperations) break;
  }
  out.items = out.items.filter((item, index) => !operationTypes.has(String(item && item.type || "")) || keep.has(index));
  return out;
}

test("thread detail response budget trims historical operation and reasoning items and rebuilds visible keys", () => {
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
        {
          id: "turn-latest",
          status: "completed",
          items: [
            { id: "u2", type: "userMessage", text: "Latest question" },
            { id: "a2", type: "agentMessage", text: "Latest answer" },
            { id: "usage2", type: "turnUsageSummary" },
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
  assert.deepEqual(compacted.thread.turns[1].items.map((item) => item.id), ["u2", "a2", "usage2"]);
  assert.deepEqual(
    compacted.thread.mobileVisibleItemKeys,
    compacted.thread.turns.flatMap((turn) => turn.items.map((item) => item.mobileVisibleKey)),
  );
  assert.equal(compacted.thread.mobileProjectionRevision, 7);
  assert.equal(compacted.thread.mobileDetailResponseBudget.applied, true);
  assert.equal(compacted.thread.mobileDetailResponseBudget.omittedOperationItems, 2);
  assert.equal(compacted.thread.mobileDetailResponseBudget.omittedReasoningItems, 1);
  assert.equal(compacted.thread.mobileDetailResponseBudget.latestCompletedReplayTurnCount, 1);
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

test("thread detail response budget keeps bounded latest completed replay detail when no active turn exists", () => {
  const result = {
    thread: {
      id: "thread-1",
      mobileReadMode: "projection-v4-dynamic",
      mobileProjectionRevision: 8,
      turns: [
        {
          id: "turn-old",
          status: "completed",
          items: [
            { id: "old-u", type: "userMessage", text: "Old question" },
            { id: "old-r1", type: "reasoning", text: "old reason" },
            { id: "old-c1", type: "commandExecution", command: "old 1" },
            { id: "old-c2", type: "commandExecution", command: "old 2" },
            { id: "old-a1", type: "agentMessage", text: "old progress" },
            { id: "old-a2", type: "agentMessage", text: "old receipt" },
            { id: "old-usage", type: "turnUsageSummary" },
          ],
        },
        {
          id: "turn-latest",
          status: "completed",
          items: [
            { id: "u1", type: "userMessage", text: "Question" },
            { id: "r1", type: "reasoning", text: "" },
            { id: "r2", type: "reasoning", text: "" },
            { id: "r3", type: "reasoning", text: "" },
            { id: "c1", type: "commandExecution", command: "a" },
            { id: "c2", type: "commandExecution", command: "b" },
            { id: "c3", type: "commandExecution", command: "c" },
            { id: "a1", type: "agentMessage", text: "progress 1" },
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
    completedOperationItems: 1,
    completedReasoningItems: 0,
    completedAssistantItems: 1,
    activeOperationItems: 2,
    activeReasoningItems: 2,
    activeAssistantItems: 2,
  });

  assert.deepEqual(compacted.thread.turns[0].items.map((item) => item.id), ["old-u", "old-c2", "old-a2", "old-usage"]);
  assert.deepEqual(compacted.thread.turns[1].items.map((item) => item.id), ["u1", "a1", "plan1", "a2", "usage"]);
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.latestCompletedReplayTurnCount, 1);
  assert.equal(budget.latestCompletedReplayOperationItems, 0);
  assert.equal(budget.latestCompletedReplayReasoningItems, 0);
  assert.equal(budget.latestCompletedReplayAssistantItems, 3);
  assert.equal(budget.latestCompletedReplayOmittedAssistantItems, 0);
  assert.equal(budget.omittedOperationItems, 4);
  assert.equal(budget.omittedReasoningItems, 4);
  assert.equal(budget.omittedAssistantItems, 1);
  assert.equal(budget.preservedReplayAssistantItems, 1);
  assert.equal(budget.activeTurnCount, 0);
  assert.equal(compacted.thread.mobileProjectionRevision, 8);
  assert.deepEqual(
    compacted.thread.mobileVisibleItemKeys,
    compacted.thread.turns.flatMap((turn) => turn.items.map((item) => item.mobileVisibleKey)),
  );
});

test("thread detail response budget orders completed replay items by timestamp", () => {
  const result = {
    thread: {
      id: "thread-1",
      mobileReadMode: "projection-v4-dynamic",
      mobileProjectionRevision: 14,
      turns: [
        {
          id: "turn-latest",
          status: "completed",
          items: [
            { id: "u1", type: "userMessage", text: "Question", createdAt: "2026-06-29T11:00:00.000Z" },
            { id: "a-late", type: "agentMessage", text: "late", createdAt: "2026-06-29T11:20:00.000Z" },
            { id: "a-early", type: "agentMessage", text: "early", createdAt: "2026-06-29T11:03:00.000Z" },
            { id: "a-mid", type: "agentMessage", text: "middle", createdAtMs: Date.parse("2026-06-29T11:15:00.000Z") },
            { id: "usage", type: "turnUsageSummary", createdAt: "2026-06-29T11:21:00.000Z" },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    completedAssistantItems: 1,
    activeAssistantItems: 1,
  });

  assert.deepEqual(compacted.thread.turns[0].items.map((item) => item.id), [
    "u1",
    "a-early",
    "a-mid",
    "a-late",
    "usage",
  ]);
});

test("thread detail response budget orders completed replay items by client display fallback time", () => {
  const result = {
    thread: {
      id: "thread-1",
      mobileReadMode: "projection-v4-dynamic",
      mobileProjectionRevision: 15,
      turns: [
        {
          id: "turn-latest",
          status: "completed",
          startedAt: "2026-06-29T11:00:00.000Z",
          completedAt: "2026-06-29T11:30:00.000Z",
          items: [
            { id: "assistant-final", type: "agentMessage", text: "final" },
            { id: "user", type: "userMessage", text: "Question" },
            { id: "usage", type: "turnUsageSummary" },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    completedAssistantItems: 1,
    activeAssistantItems: 1,
  });

  assert.deepEqual(compacted.thread.turns[0].items.map((item) => item.id), [
    "user",
    "assistant-final",
    "usage",
  ]);
});

test("thread detail response budget orders active replay items after progressive budgeting", () => {
  const result = {
    thread: {
      id: "thread-1",
      activeTurnId: "turn-active",
      mobileReadMode: "projection-active-overlay",
      mobileProjectionRevision: 16,
      turns: [
        {
          id: "turn-active",
          status: "active",
          items: [
            { id: "u-new", type: "userMessage", text: "Newer question", startedAt: "2026-06-29T15:33:47.003Z" },
            { id: "a1", type: "agentMessage", text: "Progress 1", startedAt: "2026-06-29T15:34:00.000Z" },
            { id: "u-old", type: "userMessage", text: "Older question", startedAt: "2026-06-29T15:18:58.283Z" },
            { id: "a2", type: "agentMessage", text: "Progress 2", startedAt: "2026-06-29T15:35:00.000Z" },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeProgressiveItemThreshold: 1,
    activeAssistantItems: 4,
    progressiveActiveAssistantItems: 4,
    progressiveReplayAssistantItems: 4,
  });

  assert.deepEqual(compacted.thread.turns[0].items.map((item) => item.id), [
    "u-old",
    "u-new",
    "a1",
    "a2",
  ]);
});

test("thread detail response budget preserves the most recent rich completed reply before a short latest turn", () => {
  const result = {
    thread: {
      id: "thread-1",
      mobileReadMode: "projection-v4-dynamic",
      mobileProjectionRevision: 12,
      turns: [
        {
          id: "turn-rich",
          status: "completed",
          items: [
            { id: "u-rich", type: "userMessage", text: "Long task" },
            { id: "r-rich", type: "reasoning", text: "private reasoning" },
            { id: "c-rich-1", type: "commandExecution", command: "cmd 1" },
            { id: "c-rich-2", type: "commandExecution", command: "cmd 2" },
            { id: "a-rich-1", type: "agentMessage", text: "progress 1" },
            { id: "a-rich-2", type: "agentMessage", text: "progress 2" },
            { id: "a-rich-3", type: "agentMessage", text: "final" },
            { id: "usage-rich", type: "turnUsageSummary" },
          ],
        },
        {
          id: "turn-short",
          status: "completed",
          items: [
            { id: "u-short", type: "userMessage", text: "Done?" },
            { id: "a-short", type: "agentMessage", text: "Done." },
            { id: "usage-short", type: "turnUsageSummary" },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    completedOperationItems: 1,
    completedReasoningItems: 0,
    completedAssistantItems: 1,
    activeOperationItems: 1,
    activeAssistantItems: 1,
  });

  assert.deepEqual(compacted.thread.turns[0].items.map((item) => item.id), [
    "u-rich",
    "a-rich-1",
    "a-rich-2",
    "a-rich-3",
    "usage-rich",
  ]);
  assert.deepEqual(compacted.thread.turns[1].items.map((item) => item.id), ["u-short", "a-short", "usage-short"]);
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.latestCompletedReplayTurnCount, 1);
  assert.equal(budget.latestCompletedReplayAssistantItems, 1);
  assert.equal(budget.richCompletedReplayTurnCount, 1);
  assert.equal(budget.richCompletedReplayAssistantItems, 3);
  assert.equal(budget.richCompletedReplayOmittedAssistantItems, 0);
  assert.equal(budget.protectedCompletedReplayTurnCount, 2);
  assert.equal(budget.protectedCompletedReplayOmittedAssistantItems, 0);
  assert.equal(budget.omittedOperationItems, 2);
  assert.equal(budget.omittedReasoningItems, 1);
});

test("thread detail response budget keeps completed replay progress before active turn", () => {
  const result = {
    thread: {
      id: "thread-1",
      activeTurnId: "turn-active",
      mobileReadMode: "projection-active-overlay",
      mobileProjectionRevision: 9,
      turns: [
        {
          id: "turn-completed",
          status: "completed",
          items: [
            { id: "u1", type: "userMessage", text: "Question" },
            { id: "r1", type: "reasoning", text: "" },
            { id: "r2", type: "reasoning", text: "" },
            { id: "c1", type: "commandExecution", command: "old command" },
            { id: "p1", type: "agentMessage", text: "progress 1", mobileSyntheticProgressMessage: true },
            { id: "p2", type: "agentMessage", text: "progress 2", mobileSyntheticProgressMessage: true },
            { id: "p3", type: "agentMessage", text: "progress 3", mobileSyntheticProgressMessage: true },
            { id: "final", type: "agentMessage", text: "final receipt", mobileSyntheticFinalReceipt: true },
            { id: "usage", type: "turnUsageSummary" },
          ],
        },
        {
          id: "turn-active",
          status: "inProgress",
          items: [
            { id: "active-u", type: "userMessage", text: "Next" },
            { id: "active-a", type: "agentMessage", text: "Working" },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    completedAssistantItems: 1,
    completedOperationItems: 1,
    activeAssistantItems: 4,
    activeOperationItems: 0,
  });

  const completed = compacted.thread.turns[0];
  assert.deepEqual(completed.items.map((item) => item.id), ["u1", "p1", "p2", "p3", "final", "usage"]);
  assert.equal(completed.items.filter((item) => item.mobileSyntheticProgressMessage === true).length, 3);
  assert.ok(!completed.items.some((item) => item.type === "reasoning"));
  assert.ok(!completed.items.some((item) => item.type === "commandExecution"));
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.activeTurnCount, 1);
  assert.equal(budget.latestCompletedReplayTurnCount, 1);
  assert.equal(budget.latestCompletedReplayOperationItems, 0);
  assert.equal(budget.latestCompletedReplayAssistantItems, 4);
  assert.equal(budget.latestCompletedReplayReasoningItems, 0);
  assert.equal(budget.latestCompletedReplayOmittedAssistantItems, 0);
  assert.equal(budget.omittedOperationItems, 1);
  assert.equal(budget.omittedReasoningItems, 2);
  assert.equal(budget.omittedAssistantItems, 0);
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

test("thread detail response budget preserves active assistant progress items", () => {
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
  assert.deepEqual(turn.items.map((item) => item.id), ["u1", "a1", "a2", "a3", "a4", "usage"]);
  assert.equal(turn.mobileOmittedAssistantItemCount, undefined);
  assert.equal(turn.mobileAssistantItemBudget, undefined);
  assert.equal(compacted.thread.mobileDetailResponseBudget, undefined);
});

test("thread detail response budget prunes non-current empty active placeholders", () => {
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
            { id: "a1", type: "agentMessage", text: "Visible reply" },
          ],
        },
        {
          id: "empty-placeholder",
          status: "inProgress",
          items: [],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeProgressiveItemThreshold: 0,
  });

  assert.deepEqual(compacted.thread.turns.map((turn) => turn.id), ["turn-active"]);
  assert.equal(compacted.thread.mobileDetailResponseBudget.prunedEmptyActivePlaceholderTurns, 1);
  assert.equal(compacted.thread.mobileDetailResponseBudget.applied, true);
  assert.deepEqual(
    compacted.thread.mobileVisibleItemKeys,
    compacted.thread.turns[0].items.map((item) => item.mobileVisibleKey),
  );
});

test("thread detail response budget keeps non-current active placeholder content but downgrades live semantics", () => {
  const result = {
    thread: {
      id: "thread-1",
      activeTurnId: "turn-active",
      mobileReadMode: "projection-active-overlay",
      turns: [
        {
          id: "turn-active",
          status: "inProgress",
          items: [{ id: "a1", type: "agentMessage", text: "Visible reply" }],
        },
        {
          id: "receipt-placeholder",
          status: "inProgress",
          items: [{ id: "a2", type: "agentMessage", text: "Still meaningful" }],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeProgressiveItemThreshold: 0,
  });

  assert.deepEqual(compacted.thread.turns.map((turn) => turn.id), ["turn-active", "receipt-placeholder"]);
  assert.deepEqual(compacted.thread.turns[1].items.map((item) => item.id), ["a2"]);
  assert.equal(compacted.thread.turns[1].status.type, "completed");
  assert.equal(compacted.thread.turns[1].status.mobileStaleActiveTurn, true);
  assert.equal(compacted.thread.mobileDetailResponseBudget.downgradedStaleActiveTurns, 1);
  assert.equal(compacted.thread.mobileDetailResponseBudget.staleActiveTurnCount, 1);
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
  assert.equal(compacted.thread.turns[0].status.type, "completed");
  assert.equal(compacted.thread.turns[0].status.mobileStaleActiveTurn, true);
  assert.equal(compacted.thread.mobileDetailResponseBudget.activeTurnCount, 1);
  assert.equal(compacted.thread.mobileDetailResponseBudget.staleActiveTurnCount, 1);
  assert.equal(compacted.thread.mobileDetailResponseBudget.downgradedStaleActiveTurns, 1);
  assert.equal(compacted.thread.mobileDetailResponseBudget.omittedOperationItems, 2);
  assert.equal(compacted.thread.mobileDetailResponseBudget.omittedReasoningItems, 1);
  assert.equal(compacted.thread.mobileDetailResponseBudget.omittedAssistantItems, 1);
});

test("thread detail response budget remaps missing activeTurnId to latest visible active turn", () => {
  const result = {
    thread: {
      id: "thread-1",
      activeTurnId: "missing-active",
      mobileReadMode: "projection-active-overlay",
      turns: [
        {
          id: "turn-completed",
          status: "completed",
          items: [{ id: "a0", type: "agentMessage", text: "Old reply" }],
        },
        {
          id: "turn-visible-active",
          status: { type: "active", mobileRuntimeDerived: true },
          items: [
            { id: "u1", type: "userMessage", text: "Visible request" },
            { id: "a1", type: "agentMessage", text: "Visible progress" },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeProgressiveItemThreshold: 0,
  });

  assert.equal(compacted.thread.activeTurnId, "turn-visible-active");
  assert.equal(compacted.thread.mobileDetailResponseBudget.remappedMissingActiveTurnId, 1);
  assert.equal(compacted.thread.mobileDetailResponseBudget.activeTurnCount, 1);
  assert.equal(compacted.thread.mobileDetailResponseBudget.downgradedStaleActiveTurns, 0);
});

test("thread detail response budget repairs missing visible active turn status", () => {
  const result = {
    thread: {
      id: "thread-1",
      activeTurnId: "turn-active",
      mobileReadMode: "projection-active-overlay",
      turns: [
        {
          id: "turn-active",
          items: [
            { id: "a1", type: "agentMessage", text: "Visible progress" },
            { id: "c1", type: "commandExecution", status: "running", command: "npm test" },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeProgressiveItemThreshold: 0,
  });

  assert.equal(compacted.thread.turns[0].status.type, "active");
  assert.equal(compacted.thread.turns[0].status.mobileRuntimeDerived, true);
  assert.equal(compacted.thread.mobileDetailResponseBudget.repairedVisibleActiveTurnStatus, 1);
  assert.equal(compacted.thread.mobileDetailResponseBudget.activeTurnCount, 1);
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
  assert.deepEqual(itemIds, ["u1", "a1", "a2", "a3", "a4", "c2"]);
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.progressiveActiveBudgetApplied, true);
  assert.equal(budget.progressiveActiveBudgetReason, "active-byte-pressure");
  assert.equal(budget.activeProgressiveByteThreshold, 200);
  assert.equal(budget.activeProgressiveThreadByteThreshold, 0);
  assert.ok(budget.progressiveActiveTurnOriginalBytes >= 200);
  assert.ok(budget.progressiveActiveOriginalBytes >= budget.progressiveActiveTurnOriginalBytes);
  assert.equal(budget.activeOperationItems, 1);
  assert.equal(budget.activeAssistantItems, 2);
  assert.equal(budget.omittedAssistantItems, 0);
  assert.equal(budget.activeAssistantItemsBefore, 4);
  assert.equal(budget.activeAssistantItemsAfter, 4);
  assert.equal(budget.activeOmittedAssistantItems, 0);
  assert.equal(budget.preservedReplayAssistantItems, 2);
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

test("thread detail response budget truncates oversized active user input under progressive pressure", () => {
  const taskCardText = [
    "[Cross-thread task card sent by source thread]",
    "",
    "Source workspace: /workspace",
    "Source thread: Home AI",
    "Title: Large diagnostic task",
    "",
    "# Task",
    "Investigate the issue.",
    "A".repeat(5000),
  ].join("\n");
  const result = {
    thread: {
      id: "thread-1",
      activeTurnId: "turn-active",
      mobileReadMode: "projection-active-overlay",
      mobileProjectionRevision: 12,
      turns: [
        {
          id: "turn-active",
          status: "inProgress",
          items: [
            {
              id: "u1",
              type: "userMessage",
              content: [{ type: "input_text", text: taskCardText }],
            },
            { id: "a1", type: "agentMessage", text: "Working" },
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
    progressiveActiveUserTextChars: 900,
  });

  const user = compacted.thread.turns[0].items[0];
  assert.equal(user.mobileUserInputTruncated, true);
  assert.match(user.content[0].text, /^\[Cross-thread task card sent by source thread\]/);
  assert.match(user.content[0].text, /active user input preview truncated/);
  assert.ok(user.content[0].text.length <= 900);
  assert.deepEqual(user.mobileUserInputBudget.fields, ["content.text"]);
  assert.equal(user.mobileUserInputBudget.originalChars, taskCardText.length);
  assert.equal(user.mobileUserInputBudget.maxChars, 900);
  assert.ok(user.mobileUserInputBudget.omittedChars > 0);
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.applied, true);
  assert.equal(budget.progressiveActiveBudgetApplied, true);
  assert.equal(budget.progressiveActiveUserTextChars, 900);
  assert.equal(budget.truncatedActiveUserMessageItems, 1);
  assert.equal(budget.activeUserInputOriginalChars, taskCardText.length);
  assert.ok(budget.activeUserInputRetainedChars <= 900);
  assert.ok(budget.omittedActiveUserInputChars > 0);
  assert.equal(JSON.stringify(compacted).includes("A".repeat(1000)), false);
  assert.equal(compacted.thread.mobileProjectionRevision, 12);
  assert.deepEqual(compacted.thread.mobileVisibleItemKeys, compacted.thread.turns[0].items.map((item) => item.mobileVisibleKey));
});

test("thread detail response budget drops active inline image data under progressive pressure", () => {
  const dataUrl = `data:image/png;base64,${"A".repeat(4200)}`;
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
            {
              id: "u1",
              type: "userMessage",
              content: [
                { type: "text", text: "Look at this image" },
                { type: "input_image", image_url: { url: dataUrl }, fileName: "screen.png" },
              ],
            },
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
    progressiveActiveUserTextChars: 800,
  });

  const user = compacted.thread.turns[0].items[0];
  const imagePart = user.content[1];
  assert.equal(user.mobileUserInputTruncated, true);
  assert.equal(imagePart.mobileImagePayloadTruncated, true);
  assert.deepEqual(imagePart.image_url, {
    truncated: true,
    contentType: "image/png",
    totalChars: dataUrl.length,
    retainedChars: 0,
    omittedChars: dataUrl.length,
  });
  assert.equal(imagePart.fileName, "screen.png");
  assert.deepEqual(user.mobileUserInputBudget.fields, ["content.text", "content.image_url"]);
  assert.equal(JSON.stringify(compacted).includes("data:image/png;base64"), false);
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.truncatedActiveUserMessageItems, 1);
  assert.equal(budget.activeUserInputOriginalChars, "Look at this image".length + dataUrl.length);
  assert.ok(budget.omittedActiveUserInputChars >= dataUrl.length);
});

test("thread detail response budget keeps large user input unchanged without progressive pressure", () => {
  const longText = "B".repeat(5000);
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
            { id: "u1", type: "userMessage", content: [{ type: "text", text: longText }] },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeProgressiveItemThreshold: 100,
    activeProgressiveByteThreshold: 0,
    activeProgressiveThreadByteThreshold: 0,
    progressiveActiveUserTextChars: 800,
  });

  const user = compacted.thread.turns[0].items[0];
  assert.equal(user.content[0].text, longText);
  assert.equal(user.mobileUserInputTruncated, undefined);
  assert.equal(compacted.thread.mobileDetailResponseBudget, undefined);
});

test("thread detail response budget truncates retained active command output payload under progressive pressure", () => {
  const result = {
    thread: {
      id: "thread-1",
      activeTurnId: "turn-active",
      mobileReadMode: "projection-active-overlay",
      mobileProjectionRevision: 13,
      turns: [
        {
          id: "turn-active",
          status: "inProgress",
          items: [
            { id: "u1", type: "userMessage", text: "Question" },
            {
              id: "cmd-1",
              type: "commandExecution",
              command: "npm test",
              aggregatedOutput: `${"A".repeat(1800)}\nLATEST`,
            },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeOperationItems: 2,
    activeProgressiveItemThreshold: 100,
    activeProgressiveByteThreshold: 1000,
    activeProgressiveThreadByteThreshold: 0,
    progressiveActiveOperationPayloadChars: 420,
  });

  const command = compacted.thread.turns[0].items[1];
  assert.equal(command.id, "cmd-1");
  assert.equal(command.outputTruncated, true);
  assert.equal(command.outputTotalChars, 1807);
  assert.equal(command.aggregatedOutput.endsWith("LATEST"), true);
  assert.ok(command.aggregatedOutput.length <= 420);
  assert.equal(command.mobilePayloadTruncated, true);
  assert.deepEqual(command.mobileOperationPayloadBudget.fields, ["aggregatedOutput"]);
  assert.equal(command.mobileOperationPayloadBudget.maxChars, 420);
  assert.equal(command.mobileOperationPayloadBudget.originalChars, 1807);
  assert.ok(command.mobileOperationPayloadBudget.omittedChars > 0);
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.progressiveActiveBudgetApplied, true);
  assert.equal(budget.progressiveActiveBudgetReason, "active-byte-pressure");
  assert.equal(budget.progressiveActiveOperationPayloadChars, 420);
  assert.equal(budget.truncatedActiveOperationPayloadItems, 1);
  assert.equal(budget.activeOperationPayloadOriginalChars, 1807);
  assert.ok(budget.activeOperationPayloadRetainedChars <= 420);
  assert.ok(budget.omittedActiveOperationPayloadChars > 0);
  assert.equal(compacted.thread.mobileProjectionRevision, 13);
  assert.deepEqual(compacted.thread.mobileVisibleItemKeys, compacted.thread.turns[0].items.map((item) => item.mobileVisibleKey));
});

test("thread detail response budget previews retained active structured tool payloads under progressive pressure", () => {
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
            {
              id: "tool-1",
              type: "mcpToolCall",
              server: "codegraph",
              tool: "explore",
              arguments: { query: "x".repeat(1600), includePrivate: false },
              result: { body: "y".repeat(1800), status: "ok" },
            },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeOperationItems: 2,
    activeProgressiveItemThreshold: 100,
    activeProgressiveByteThreshold: 1000,
    activeProgressiveThreadByteThreshold: 0,
    progressiveActiveOperationPayloadChars: 360,
  });

  const tool = compacted.thread.turns[0].items[0];
  assert.equal(tool.mobilePayloadTruncated, true);
  assert.deepEqual(tool.mobileOperationPayloadBudget.fields, ["arguments", "result"]);
  assert.equal(tool.arguments.truncated, true);
  assert.equal(tool.result.truncated, true);
  assert.match(tool.arguments.preview, /operation payload preview truncated/);
  assert.match(tool.result.preview, /operation payload preview truncated/);
  assert.ok(tool.arguments.preview.length <= 360);
  assert.ok(tool.result.preview.length <= 360);
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.truncatedActiveOperationPayloadItems, 1);
  assert.ok(budget.activeOperationPayloadOriginalChars > budget.activeOperationPayloadRetainedChars);
});

test("thread detail response budget previews retained active file change payloads under progressive pressure", () => {
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
            {
              id: "file-1",
              type: "fileChange",
              changes: [
                {
                  path: "public/app.js",
                  diff: `${"- old\n+ new\n"}${"x".repeat(2000)}`,
                },
              ],
            },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeOperationItems: 2,
    activeProgressiveItemThreshold: 100,
    activeProgressiveByteThreshold: 1000,
    activeProgressiveThreadByteThreshold: 0,
    progressiveActiveOperationPayloadChars: 320,
  });

  const fileChange = compacted.thread.turns[0].items[0];
  assert.equal(fileChange.mobilePayloadTruncated, true);
  assert.deepEqual(fileChange.mobileOperationPayloadBudget.fields, ["changes"]);
  assert.equal(fileChange.changes.truncated, true);
  assert.match(fileChange.changes.preview, /operation payload preview truncated/);
  assert.ok(fileChange.changes.preview.length <= 320);
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.truncatedActiveOperationPayloadItems, 1);
  assert.ok(budget.activeOperationPayloadOriginalChars > budget.activeOperationPayloadRetainedChars);
});

test("thread detail response budget previews retained active collab agent display text under progressive pressure", () => {
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
            {
              id: "agent-1",
              type: "collabAgentToolCall",
              tool: "spawnAgent",
              status: "running",
              task: `${"Investigate active payload. ".repeat(120)}Keep the latest evidence.`,
            },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeOperationItems: 2,
    activeProgressiveItemThreshold: 100,
    activeProgressiveByteThreshold: 1000,
    activeProgressiveThreadByteThreshold: 0,
    progressiveActiveOperationPayloadChars: 360,
  });

  const call = compacted.thread.turns[0].items[0];
  assert.equal(call.mobilePayloadTruncated, true);
  assert.deepEqual(call.mobileOperationPayloadBudget.fields, ["task"]);
  assert.match(call.task, /operation payload preview truncated/);
  assert.ok(call.task.endsWith("Keep the latest evidence."));
  assert.ok(call.task.length <= 360);
  assert.equal(call.tool, "spawnAgent");
  assert.equal(call.status, "running");
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.truncatedActiveOperationPayloadItems, 1);
  assert.ok(budget.activeOperationPayloadOriginalChars > budget.activeOperationPayloadRetainedChars);
});

test("thread detail response budget does not truncate operation payloads without progressive pressure", () => {
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
            {
              id: "cmd-1",
              type: "commandExecution",
              command: "npm test",
              aggregatedOutput: "A".repeat(1800),
            },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeOperationItems: 1,
    activeProgressiveItemThreshold: 100,
    activeProgressiveByteThreshold: 10_000,
    activeProgressiveThreadByteThreshold: 0,
    progressiveActiveOperationPayloadChars: 360,
  });

  assert.equal(compacted.thread.mobileDetailResponseBudget, undefined);
  assert.deepEqual(compacted, result);
});

test("thread detail response budget previews protected completed replay text under active first-paint pressure", () => {
  const longReceipt = (letter) => `${letter}`.repeat(2400);
  const result = {
    thread: {
      id: "thread-1",
      activeTurnId: "turn-active",
      mobileReadMode: "projection-active-overlay",
      mobileProjectionRevision: 12,
      turns: [
        {
          id: "turn-1",
          status: "completed",
          items: [
            { id: "u1", type: "userMessage", text: "Older question" },
            { id: "a1", type: "agentMessage", text: longReceipt("A") },
            { id: "usage1", type: "turnUsageSummary" },
          ],
        },
        {
          id: "turn-2",
          status: "completed",
          items: [
            { id: "u2", type: "userMessage", text: "Recent question" },
            { id: "a2", type: "agentMessage", text: longReceipt("B") },
            { id: "usage2", type: "turnUsageSummary" },
          ],
        },
        {
          id: "turn-active",
          status: "inProgress",
          items: [
            { id: "live-a1", type: "agentMessage", text: "Working" },
          ],
        },
      ],
    },
  };
  const originalThreadBytes = Buffer.byteLength(JSON.stringify(result.thread), "utf8");

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeProgressiveItemThreshold: 100,
    activeProgressiveByteThreshold: 0,
    activeProgressiveThreadByteThreshold: 1000,
    progressiveActiveAssistantItems: 1,
    progressiveFirstPaintThreadByteCeiling: 1600,
    progressiveCompletedTextChars: 300,
  });

  const firstReceipt = compacted.thread.turns[0].items[1];
  const secondReceipt = compacted.thread.turns[1].items[1];
  assert.equal(firstReceipt.mobileTextTruncated, true);
  assert.equal(secondReceipt.mobileTextTruncated, true);
  assert.match(firstReceipt.text, /first-paint preview truncated/);
  assert.match(secondReceipt.text, /first-paint preview truncated/);
  assert.ok(firstReceipt.text.length <= 300);
  assert.ok(secondReceipt.text.length <= 300);
  assert.equal(firstReceipt.mobileFirstPaintTextBudget.scope, "completed");
  assert.equal(secondReceipt.mobileFirstPaintTextBudget.scope, "completed");
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.progressiveActiveBudgetApplied, true);
  assert.equal(budget.progressiveActiveBudgetReason, "thread-byte-pressure");
  assert.equal(budget.progressiveCompletedTextBudgetScope, "active-first-paint");
  assert.equal(budget.progressiveCompletedTextBudgetApplied, true);
  assert.equal(budget.progressiveFirstPaintThreadByteCeiling, 1600);
  assert.equal(budget.progressiveCompletedTextChars, 300);
  assert.equal(budget.progressiveCompletedTextBudgetSkippedLatestTurnCount, 0);
  assert.equal(budget.truncatedCompletedTextItems, 2);
  assert.ok(budget.omittedCompletedTextChars > 0);
  assert.ok(budget.progressiveFirstPaintBytesBeforeTextBudget >= originalThreadBytes - 1000);
  assert.ok(budget.progressiveFirstPaintBytesAfterTextBudget < budget.progressiveFirstPaintBytesBeforeTextBudget);
  assert.equal(compacted.thread.mobileProjectionRevision, 12);
  assert.deepEqual(compacted.thread.mobileVisibleItemKeys, compacted.thread.turns.flatMap((turn) => turn.items.map((item) => item.mobileVisibleKey)));
});

test("thread detail response budget previews historical completed receipts on resting first paint byte pressure", () => {
  const result = {
    thread: {
      id: "thread-1",
      mobileReadMode: "projection-v4-dynamic",
      mobileProjectionRevision: 22,
      turns: [
        {
          id: "turn-1",
          status: "completed",
          items: [
            { id: "u1", type: "userMessage", text: "Older question" },
            { id: "a1", type: "agentMessage", text: "A".repeat(2400) },
            { id: "usage1", type: "turnUsageSummary" },
          ],
        },
        {
          id: "turn-2",
          status: "completed",
          items: [
            { id: "u2", type: "userMessage", text: "Latest question" },
            { id: "a2", type: "agentMessage", text: "B".repeat(2400) },
            { id: "usage2", type: "turnUsageSummary" },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeProgressiveItemThreshold: 1,
    activeProgressiveThreadByteThreshold: 100,
    progressiveFirstPaintThreadByteCeiling: 1000,
    progressiveCompletedTextChars: 240,
  });

  const historicalReceipt = compacted.thread.turns[0].items[1];
  const latestReceipt = compacted.thread.turns[1].items[1];
  assert.equal(historicalReceipt.mobileTextTruncated, true);
  assert.match(historicalReceipt.text, /first-paint preview truncated/);
  assert.ok(historicalReceipt.text.length <= 240);
  assert.equal(historicalReceipt.mobileFirstPaintTextBudget.scope, "completed");
  assert.equal(latestReceipt.mobileTextTruncated, undefined);
  assert.equal(latestReceipt.mobileFirstPaintTextBudget, undefined);
  assert.equal(latestReceipt.text.length, 2400);
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.applied, true);
  assert.equal(budget.progressiveActiveBudgetApplied, false);
  assert.equal(budget.progressiveCompletedTextBudgetApplied, true);
  assert.equal(budget.progressiveCompletedTextBudgetScope, "resting-history-first-paint");
  assert.equal(budget.progressiveCompletedTextBudgetProtectedLatestTurn, true);
  assert.equal(budget.progressiveCompletedTextBudgetSkippedLatestTurnCount, 1);
  assert.equal(budget.truncatedCompletedTextItems, 1);
  assert.ok(budget.omittedCompletedTextChars > 0);
  assert.equal(compacted.thread.mobileProjectionRevision, 22);
  assert.deepEqual(compacted.thread.mobileVisibleItemKeys, compacted.thread.turns.flatMap((turn) => turn.items.map((item) => item.mobileVisibleKey)));
});

test("thread detail response budget does not preview the latest completed receipt without active pressure", () => {
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
            { id: "a1", type: "agentMessage", text: "A".repeat(2400) },
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeProgressiveItemThreshold: 1,
    activeProgressiveThreadByteThreshold: 100,
    progressiveFirstPaintThreadByteCeiling: 200,
    progressiveCompletedTextChars: 120,
  });

  const receipt = compacted.thread.turns[0].items[1];
  assert.equal(receipt.mobileFirstPaintTextBudget, undefined);
  assert.equal(receipt.text.length, 2400);
  assert.equal(compacted.thread.mobileDetailResponseBudget, undefined);
  assert.deepEqual(compacted, result);
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
    "a1",
    "a2",
    "a3",
    "a4",
    "a5",
    "a6",
    "a7",
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
  assert.equal(budget.preserveReplayAssistantItems, true);
  assert.equal(budget.preservedReplayAssistantItems, 7);
  assert.equal(budget.configuredActiveOperationItems, 8);
  assert.equal(budget.configuredActiveAssistantItems, 8);
  assert.equal(budget.configuredActiveReasoningItems, 2);
  assert.equal(budget.progressiveActiveOriginalItemCount, 24);
  assert.equal(budget.progressiveActiveTurnOriginalItemCount, 24);
});

test("thread detail response budget bounds preserved replay assistants under active pressure", () => {
  const completedAssistantItems = Array.from({ length: 12 }, (_, index) => ({
    id: `completed-a${index + 1}`,
    type: "agentMessage",
    text: `completed progress ${index + 1}`,
  }));
  const activeAssistantItems = Array.from({ length: 12 }, (_, index) => ({
    id: `active-a${index + 1}`,
    type: "agentMessage",
    text: `active progress ${index + 1}`,
  }));
  const result = {
    thread: {
      id: "thread-1",
      activeTurnId: "turn-active",
      mobileReadMode: "projection-active-overlay",
      turns: [
        {
          id: "turn-completed",
          status: "completed",
          items: [
            { id: "completed-u", type: "userMessage", text: "Question" },
            ...completedAssistantItems,
            { id: "completed-usage", type: "turnUsageSummary" },
          ],
        },
        {
          id: "turn-active",
          status: "inProgress",
          items: [
            { id: "active-u", type: "userMessage", text: "Next" },
            ...activeAssistantItems,
          ],
        },
      ],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeAssistantItems: 8,
    activeProgressiveItemThreshold: 10,
    progressiveActiveAssistantItems: 4,
    progressiveReplayAssistantItems: 6,
  });

  assert.deepEqual(compacted.thread.turns[0].items.map((item) => item.id), [
    "completed-u",
    "completed-a7",
    "completed-a8",
    "completed-a9",
    "completed-a10",
    "completed-a11",
    "completed-a12",
    "completed-usage",
  ]);
  assert.deepEqual(compacted.thread.turns[1].items.map((item) => item.id), [
    "active-u",
    "active-a7",
    "active-a8",
    "active-a9",
    "active-a10",
    "active-a11",
    "active-a12",
  ]);
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.progressiveActiveBudgetApplied, true);
  assert.equal(budget.activeAssistantItems, 4);
  assert.equal(budget.progressiveReplayAssistantItems, 6);
  assert.equal(budget.latestCompletedReplayAssistantItems, 6);
  assert.equal(budget.protectedCompletedReplayAssistantItems, 6);
  assert.equal(budget.activeAssistantItemsAfter, 6);
  assert.equal(budget.omittedAssistantItems, 12);
  assert.equal(budget.limitedReplayAssistantItems, 12);
  assert.equal(budget.preservedReplayAssistantItems, 4);
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
  assert.deepEqual(turns[1].items.map((item) => item.id), ["u2", "a2", "usage2", "c2-3"]);
  assert.deepEqual(turns[2].items.map((item) => item.id), ["u3", "a3", "usage3", "c3-1", "c3-2", "c3-3"]);
  assert.deepEqual(turns[3].items.map((item) => item.id), ["u4", "a4", "usage4"]);
  assert.deepEqual(turns[4].items.map((item) => item.id), ["live-a1", "live-c1", "live-c2", "live-r1"]);
  const totalItems = turns.reduce((sum, turn) => sum + turn.items.length, 0);
  assert.equal(totalItems, 20);
  assert.equal(turns[0].mobileOmittedVisibleItemCount, 3);
  assert.equal(turns[0].mobileVisibleItemBudget.reason, "progressive-visible-item-ceiling");
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.progressiveVisibleItemBudgetApplied, true);
  assert.equal(budget.progressiveVisibleItemBudgetReason, "progressive-visible-item-ceiling");
  assert.equal(budget.progressiveVisibleItemOriginalCount, 25);
  assert.equal(budget.progressiveVisibleItemRetainedCount, 20);
  assert.equal(budget.progressiveVisibleItemCeiling, 20);
  assert.equal(budget.omittedVisibleItems, 5);
  assert.equal(budget.omittedOperationItems, 8);
  assert.equal(budget.retainedItemCount, 20);
  assert.deepEqual(compacted.thread.mobileVisibleItemKeys, turns.flatMap((turn) => turn.items.map((item) => item.mobileVisibleKey)));
});

test("thread detail response budget protects active turn visible items from visible item ceiling", () => {
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
  assert.deepEqual(items.map((item) => item.id), ["u1", "c1", "c2", "c3", "c4", "c5", "c6", "r1", "r2", "a1", "a2"]);
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.progressiveVisibleItemBudgetApplied, false);
  assert.equal(budget.progressiveVisibleItemOriginalCount, 11);
  assert.equal(budget.progressiveVisibleItemRetainedCount, 11);
  assert.equal(budget.omittedVisibleItems, 0);
  assert.equal(budget.omittedOperationItems, 0);
  assert.equal(compacted.thread.turns[0].mobileOmittedVisibleItemCount, undefined);
});

test("thread detail response budget does not delete active turn visible items for first-paint byte ceiling", () => {
  const result = {
    thread: {
      id: "thread-1",
      activeTurnId: "turn-active",
      mobileReadMode: "projection-active-overlay",
      mobileProjectionRevision: 31,
      turns: [{
        id: "turn-active",
        status: "inProgress",
        items: [
          { id: "u1", type: "userMessage", text: "Question" },
          ...Array.from({ length: 10 }, (_, index) => ({
            id: `c${index + 1}`,
            type: "commandExecution",
            command: `cmd ${index + 1}`,
            aggregatedOutput: `output ${index + 1} ${"x".repeat(420)}`,
          })),
          { id: "r1", type: "reasoning", text: "reason 1" },
          { id: "r2", type: "reasoning", text: "reason 2" },
          { id: "a1", type: "agentMessage", text: "latest progress" },
          { id: "usage", type: "turnUsageSummary" },
        ],
      }],
    },
  };

  const compacted = compactThreadDetailResponseResult(result, {
    compactTurn,
    activeOperationItems: 10,
    activeReasoningItems: 2,
    activeAssistantItems: 1,
    activeProgressiveItemThreshold: 1,
    progressiveActiveOperationItems: 10,
    progressiveActiveReasoningItems: 2,
    progressiveActiveAssistantItems: 1,
    progressiveActiveOperationPayloadChars: 1000,
    progressiveVisibleItemCeiling: 100,
    progressiveActiveFirstPaintThreadByteCeiling: 3000,
  });

  const items = compacted.thread.turns[0].items;
  assert.equal(items.some((item) => item.id === "u1"), true);
  assert.equal(items.some((item) => item.id === "a1"), true);
  assert.equal(items.some((item) => item.id === "usage"), true);
  assert.equal(items.filter((item) => item.type === "commandExecution").length, 10);
  assert.equal(items.filter((item) => item.type === "reasoning").length, 2);
  const budget = compacted.thread.mobileDetailResponseBudget;
  assert.equal(budget.progressiveActiveBudgetApplied, true);
  assert.equal(budget.progressiveActiveFirstPaintThreadByteCeiling, 3000);
  assert.equal(budget.progressiveActiveFirstPaintItemBudgetApplied, false);
  assert.equal(budget.progressiveActiveFirstPaintItemBudgetReason, "no-removable-visible-items");
  assert.equal(budget.progressiveActiveFirstPaintOmittedVisibleItems, 0);
  assert.equal(budget.progressiveActiveFirstPaintBytesBeforeItemBudget, budget.progressiveActiveFirstPaintBytesAfterItemBudget);
  assert.equal(compacted.thread.turns[0].mobileVisibleItemBudget, undefined);
  assert.deepEqual(compacted.thread.mobileVisibleItemKeys, items.map((item) => item.mobileVisibleKey));
  assert.equal(compacted.thread.mobileProjectionRevision, 31);
});

test("thread detail response budget does not apply visible item ceiling without progressive active pressure", () => {
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
            ...Array.from({ length: 6 }, (_, index) => ({
              id: `c${index + 1}`,
              type: "commandExecution",
              command: `cmd ${index + 1}`,
            })),
            { id: "a1", type: "agentMessage", text: "Answer" },
            { id: "usage", type: "turnUsageSummary" },
          ],
        },
        {
          id: "turn-latest",
          status: "completed",
          items: [
            { id: "u2", type: "userMessage", text: "Latest" },
            { id: "a2", type: "agentMessage", text: "Latest answer" },
          ],
        },
      ],
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
  assert.equal(budget.progressiveVisibleItemOriginalCount, 8);
  assert.equal(budget.progressiveVisibleItemRetainedCount, 8);
  assert.equal(budget.omittedVisibleItems, 0);
  assert.equal(budget.omittedOperationItems, 3);
  assert.equal(budget.latestCompletedReplayTurnCount, 1);
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

  assert.equal(compacted.thread.mobileDetailResponseBudget, undefined);
  assert.equal(compacted.thread.turns[0].items.length, 42);
  assert.equal(compacted.thread.turns[0].items.filter((item) => item.type === "agentMessage").length, 40);
});

test("thread detail response budget keeps historical completed assistant receipt-only detail", () => {
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
        {
          id: "turn-2",
          status: "completed",
          items: [
            { id: "u2", type: "userMessage", text: "Latest question" },
            { id: "a3", type: "agentMessage", text: "latest progress" },
            { id: "a4", type: "agentMessage", text: "latest receipt" },
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
  assert.equal(compacted.thread.mobileDetailResponseBudget.latestCompletedReplayTurnCount, 1);
  assert.equal(compacted.thread.mobileDetailResponseBudget.latestCompletedReplayAssistantItems, 2);
  assert.equal(compacted.thread.mobileDetailResponseBudget.latestCompletedReplayOmittedAssistantItems, 0);
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
