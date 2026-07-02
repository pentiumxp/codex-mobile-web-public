"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const service = require("../services/thread-detail/thread-detail-active-turn-evidence-service");
const adapter = require("../adapters/thread-detail-active-turn-evidence-service");

function createService(overrides = {}) {
  return service.createThreadDetailActiveTurnEvidenceService(Object.assign({
    statusText: (status) => String(status && status.type || status || ""),
    timestampToMs: (value) => Number(value || 0),
    rolloutActiveStatusWindowMs: 120000,
    isThreadListLiveStatus: (status) => /active|running|inProgress/i.test(String(status && status.type || status || "")),
    isThreadListRestStatus: (status) => /idle|completed|failed|notLoaded/i.test(String(status && status.type || status || "")),
    isEndedTurn: (turn) => Boolean(turn && (turn.completedAt || turn.durationMs || /completed|failed|cancel|error|interrupted/i.test(String(turn.status && turn.status.type || turn.status || "")))),
    isUserQuestionItem: (item) => item && item.type === "userMessage",
    userMessageHasVisualAttachment: (item) => Boolean(item && item.hasVisualAttachment),
    isTurnUsageSummaryItem: (item) => item && item.type === "turnUsageSummary",
    isOperationalItem: (item) => item && item.type === "commandExecution",
    isAssistantReceiptItem: (item) => item && item.type === "agentMessage",
    isVisualReceiptItem: (item) => item && item.type === "imageView",
    isTurnDiagnosticItem: (item) => item && item.type === "turnDiagnostic",
    isContextCompactionType: (type) => /context/i.test(String(type || "")),
  }, overrides));
}

test("thread-detail active turn evidence adapter remains a compatibility wrapper", () => {
  assert.equal(adapter.createThreadDetailActiveTurnEvidenceService, service.createThreadDetailActiveTurnEvidenceService);
});

test("thread-detail active turn evidence owns live status and superseded shell pruning", () => {
  const evidence = createService();
  const thread = {
    turns: [{
      id: "old-live",
      status: { type: "inProgress" },
      items: [
        { id: "plain-user", type: "userMessage" },
        { id: "image-user", type: "userMessage", hasVisualAttachment: true },
        { id: "reasoning", type: "reasoning" },
        { id: "receipt", type: "agentMessage" },
      ],
    }, {
      id: "current-live",
      status: { type: "inProgress" },
      items: [{ id: "current", type: "agentMessage" }],
    }],
  };

  evidence.normalizeSupersededLiveTurns(thread);
  assert.equal(thread.turns[0].status.type, "completed");
  assert.equal(thread.turns[0].mobileSupersededLive, true);
  assert.equal(thread.turns[1].status.type, "inProgress");

  evidence.pruneSupersededLiveShellTurns(thread);
  assert.deepEqual(thread.turns[0].items.map((item) => item.id), ["image-user", "receipt"]);
});

test("thread-detail active turn evidence downgrades active turns superseded by newer completed activity", () => {
  const evidence = createService();
  const thread = {
    status: { type: "idle" },
    activeTurnId: "old-active",
    mobileActiveTurnId: "old-active",
    mobileLocalActiveStatus: { turnId: "old-active" },
    mobileRolloutActiveTurn: { turnId: "old-active" },
    turns: [{
      id: "new-completed",
      status: { type: "completed" },
      completedAtMs: 3000,
      items: [{ id: "receipt", type: "agentMessage", completedAtMs: 3000 }],
    }, {
      id: "old-active",
      status: { type: "inProgress" },
      startedAtMs: 1000,
      items: [{ id: "old-receipt", type: "agentMessage", startedAtMs: 1500 }],
    }],
  };

  evidence.normalizeSupersededLiveTurns(thread);

  assert.equal(thread.activeTurnId, undefined);
  assert.equal(thread.mobileActiveTurnId, undefined);
  assert.equal(thread.mobileLocalActiveStatus, undefined);
  assert.equal(thread.mobileRolloutActiveTurn, undefined);
  assert.equal(thread.turns[1].status.type, "completed");
  assert.equal(thread.turns[1].status.mobileSupersededLive, true);
  assert.equal(thread.turns[1].mobileSupersededByCompletedActivityMs, 3000);
});

test("thread-detail active turn evidence reconciles materialized rollout active turn", () => {
  const evidence = createService({
    rolloutLatestTurnEvidence: () => ({
      turnId: "turn-rollout",
      startedAtMs: 2000,
      lastActivityMs: 2500,
      hasAssistant: true,
      hasTerminal: false,
    }),
  });
  const thread = {
    path: "/tmp/rollout-active-turn.jsonl",
    status: { type: "active" },
    activeTurnId: "turn-local-shell",
    turns: [{
      id: "turn-rollout",
      status: null,
      items: [{ id: "assistant", type: "agentMessage" }],
    }, {
      id: "turn-local-shell",
      status: { type: "inProgress" },
      items: [],
    }],
  };

  evidence.reconcileThreadActiveTurnWithRolloutEvidence(thread, { nowMs: 3000 });

  assert.equal(thread.activeTurnId, "turn-rollout");
  assert.equal(thread.status.type, "active");
  assert.equal(thread.status.mobileRuntimeDerived, true);
  assert.deepEqual(thread.turns.map((turn) => turn.id), ["turn-rollout"]);
  assert.equal(thread.turns[0].status.type, "active");
  assert.equal(thread.turns[0].startedAt, 2);
  assert.equal(thread.mobileDroppedUnmaterializedLocalActiveTurn, "turn-local-shell");
  assert.equal(thread.mobileRolloutActiveTurn.turnId, "turn-rollout");
});

test("thread-detail active turn evidence drops empty resting active shells", () => {
  const evidence = createService();
  const thread = {
    status: { type: "idle" },
    activeTurnId: "turn-shell",
    turns: [{
      id: "turn-completed",
      status: { type: "completed" },
      completedAt: 3000,
      items: [{ id: "receipt", type: "agentMessage" }],
    }, {
      id: "turn-shell",
      status: { type: "inProgress" },
      items: [],
    }],
  };

  evidence.reconcileThreadActiveTurnWithRolloutEvidence(thread);

  assert.equal(thread.status.type, "idle");
  assert.equal(thread.activeTurnId, undefined);
  assert.deepEqual(thread.turns.map((turn) => turn.id), ["turn-completed"]);
  assert.equal(thread.mobileDroppedUnmaterializedRestingActiveTurn, "turn-shell");
});
