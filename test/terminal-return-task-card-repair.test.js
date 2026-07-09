"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  repairStore,
  terminalReturnReceiptNeedsRepair,
} = require("../scripts/repair-terminal-return-task-cards");

function terminalReturnCard(overrides = {}) {
  return Object.assign({
    id: "ttc_terminal",
    status: "approved",
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
    source: { threadId: "thread-worker", workspaceId: "plugin" },
    target: { threadId: "thread-main", workspaceId: "plugin" },
    delivery: {
      injectOnApprove: true,
      returnToSource: true,
      returnStatus: "completed",
      requiresReturn: false,
      terminal: true,
      ackPolicy: "none",
    },
    audit: {
      replyToCardId: "ttc_original",
      returnToSource: true,
      terminal: true,
      ackPolicy: "none",
      homeAiDeliveryReturnEventStatus: "unknown_task_card",
    },
    injectedTurnId: "turn-terminal",
    injectedThreadId: "thread-main",
    injectionResult: {
      turn: {
        id: "turn-terminal",
        status: { type: "inProgress" },
      },
    },
  }, overrides);
}

test("terminal return task-card repair releases only terminal receipt injected state", () => {
  const ordinary = {
    id: "ttc_ordinary",
    status: "approved",
    source: { threadId: "thread-main", workspaceId: "plugin" },
    target: { threadId: "thread-worker", workspaceId: "plugin" },
    delivery: {
      returnToSource: false,
      requiresReturn: true,
      terminal: false,
      ackPolicy: "return_required",
    },
    injectedTurnId: "turn-ordinary",
    injectionResult: {
      turn: {
        id: "turn-ordinary",
        status: { type: "inProgress" },
      },
    },
    executionLease: {
      status: "active",
      resumeRequired: true,
    },
  };
  const store = {
    cards: [
      terminalReturnCard(),
      ordinary,
    ],
    workflows: [],
  };

  assert.equal(terminalReturnReceiptNeedsRepair(store.cards[0]), true);
  assert.equal(terminalReturnReceiptNeedsRepair(store.cards[1]), false);
  const { store: repaired, summary } = repairStore(store, {
    now: "2026-07-09T01:00:00.000Z",
  });

  assert.equal(summary.repairedCount, 1);
  assert.deepEqual(summary.repairedIds, ["ttc_terminal"]);
  const terminal = repaired.cards[0];
  assert.equal(terminal.injectedTurnId, undefined);
  assert.equal(terminal.injectedThreadId, undefined);
  assert.equal(terminal.delivery.injectOnApprove, false);
  assert.equal(terminal.delivery.requiresReturn, false);
  assert.equal(terminal.delivery.terminal, true);
  assert.equal(terminal.audit.terminalReturnReceiptReleaseReason, "terminal_return_receipt_no_active_turn");
  assert.equal(terminal.audit.terminalReturnReceiptInjectedTurnCleared, true);
  assert.equal(terminal.injectionResult.turn.status.type, "completed");
  assert.equal(terminal.injectionResult.turn.status.previousType, "inProgress");
  assert.equal(terminal.injectionResult.turn.mobileTerminalReturnReceiptReleased, true);

  assert.equal(repaired.cards[1].injectedTurnId, "turn-ordinary");
  assert.equal(repaired.cards[1].executionLease.status, "active");
});

test("terminal return task-card repair can be bounded to one thread", () => {
  const store = {
    cards: [
      terminalReturnCard({ id: "ttc_target", target: { threadId: "thread-main", workspaceId: "plugin" } }),
      terminalReturnCard({ id: "ttc_other", target: { threadId: "thread-other", workspaceId: "plugin" } }),
    ],
    workflows: [],
  };

  const { store: repaired, summary } = repairStore(store, {
    now: "2026-07-09T01:00:00.000Z",
    threadId: "thread-main",
  });

  assert.equal(summary.repairedCount, 1);
  assert.deepEqual(summary.repairedIds, ["ttc_target"]);
  assert.equal(repaired.cards[0].injectedTurnId, undefined);
  assert.equal(repaired.cards[1].injectedTurnId, "turn-terminal");
});
