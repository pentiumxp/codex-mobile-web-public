"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const { createThreadDetailV4MergePolicy } = require("../public/thread-detail-v4-merge-state.js");

function userMessage(text, extra = {}) {
  return Object.assign({ type: "userMessage", message: text }, extra);
}

function turn(id, items, extra = {}) {
  return Object.assign({ id, items, startedAtMs: 1, status: { type: "completed" } }, extra);
}

function comparableText(item) {
  return String(item && (item.message || item.text || item.content || "") || "").trim().toLowerCase();
}

function isCompletedStatus(status) {
  return /completed|failed|canceled|cancelled|interrupted/i.test(
    String(status && status.type || status || ""),
  );
}

function testTurnOrderMs(candidate) {
  if (!candidate) return 0;
  const fields = isCompletedStatus(candidate.status)
    ? [
      "completedAtMs",
      "completedAt",
      "updatedAtMs",
      "updatedAt",
      "startedAtMs",
      "startedAt",
      "createdAtMs",
      "createdAt",
    ]
    : [
      "startedAtMs",
      "startedAt",
      "createdAtMs",
      "createdAt",
      "updatedAtMs",
      "updatedAt",
      "completedAtMs",
      "completedAt",
    ];
  for (const field of fields) {
    const value = Number(candidate[field]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function createPolicy() {
  return createThreadDetailV4MergePolicy({
    normalizeThreadVisibleUserMessages: (thread) => thread,
    turnVisibleWeight: (candidate) => (candidate && Array.isArray(candidate.items) ? candidate.items : [])
      .filter((item) => item && item.type !== "reasoning")
      .reduce((total, item) => total + Math.max(1, JSON.stringify(item).length), 0),
    isOptimisticUserMessage: (item) => Boolean(item && item.mobilePendingSubmission),
    isRecentlySubmittedUserMessage: (item) => Boolean(item && item.mobilePendingSubmission),
    isReasoningItem: (item) => Boolean(item && item.type === "reasoning"),
    userMessageHasSubmissionId: (item, submissionId) => Boolean(
      item
      && submissionId
      && String(item.clientSubmissionId || "") === String(submissionId || ""),
    ),
    userMessagesCanShadow: (incoming, pending) => Boolean(
      incoming
      && pending
      && incoming.type === "userMessage"
      && pending.type === "userMessage"
      && comparableText(incoming) === comparableText(pending),
    ),
    isTurnComplete: (candidate) => isCompletedStatus(candidate && candidate.status),
    isRunningStatus: (status) => /active|running|queued|processing|pending|started/i.test(
      String(status && status.type || status || ""),
    ),
    isIncompleteInterruptedTurn: () => false,
    turnHasActiveLiveItems: (candidate) => (candidate && Array.isArray(candidate.items) ? candidate.items : [])
      .some((item) => item && item.status && !/completed|failed|canceled|cancelled/i.test(String(item.status.type || item.status))),
    turnOrderMs: testTurnOrderMs,
    mergeTurnPreservingVisibleItems: (existingTurn, incomingTurn) => Object.assign({}, existingTurn, incomingTurn, {
      items: Array.isArray(incomingTurn && incomingTurn.items) ? incomingTurn.items.slice() : [],
    }),
    sortTurnsForDisplay: (turns) => (turns || []).slice().sort((a, b) => (
      testTurnOrderMs(a) - testTurnOrderMs(b)
    )),
    maxVisibleTurnsForThread: () => 10,
  });
}

test("detects v4 projection threads from direct and nested version fields", () => {
  const policy = createPolicy();
  assert.equal(policy.isV4ProjectionThread({ mobileProjectionVersion: "v4" }), true);
  assert.equal(policy.isV4ProjectionThread({ mobileProjection: { version: "v4" } }), true);
  assert.equal(policy.isV4ProjectionThread({ mobileProjectionVersion: "v3" }), false);
});

test("empty incoming v4 projection keeps existing visible turns", () => {
  const policy = createPolicy();
  const existing = {
    id: "thread-a",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 5,
    turns: [turn("t1", [userMessage("kept")])],
  };
  const incoming = {
    id: "thread-a",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 6,
    mobileReadMode: "projection-v4-dynamic",
    turns: [],
  };
  const merged = policy.mergeV4ProjectionThread(existing, incoming);
  assert.equal(merged.mobileProjectionRevision, 6);
  assert.deepEqual(merged.turns.map((candidate) => candidate.id), ["t1"]);
  assert.equal(merged.turns[0].items[0].message, "kept");
});

test("keeps pending optimistic user message until durable projection arrives", () => {
  const policy = createPolicy();
  const existing = {
    id: "thread-a",
    mobileProjectionVersion: "v4",
    turns: [turn("pending-turn", [
      userMessage("send me", { id: "local", clientSubmissionId: "submit-1", mobilePendingSubmission: true }),
    ], { startedAtMs: 10, status: { type: "running" } })],
  };
  const incoming = {
    id: "thread-a",
    mobileProjectionVersion: "v4",
    turns: [turn("server-turn", [userMessage("other")], { startedAtMs: 20 })],
  };
  const merged = policy.mergeV4ProjectionThread(existing, incoming);
  const pendingTurn = merged.turns.find((candidate) => candidate.id === "pending-turn");
  assert.ok(pendingTurn);
  assert.equal(pendingTurn.mobilePendingOverlay, true);
  assert.equal(pendingTurn.items[0].clientSubmissionId, "submit-1");
});

test("drops pending overlay when durable matching user message is projected", () => {
  const policy = createPolicy();
  const existing = {
    id: "thread-a",
    mobileProjectionVersion: "v4",
    turns: [turn("pending-turn", [
      userMessage("send me", { id: "local", clientSubmissionId: "submit-1", mobilePendingSubmission: true }),
    ], { startedAtMs: 10, status: { type: "running" } })],
  };
  const incoming = {
    id: "thread-a",
    mobileProjectionVersion: "v4",
    turns: [turn("server-turn", [
      userMessage("send me", { id: "durable", clientSubmissionId: "submit-1" }),
    ], { startedAtMs: 20 })],
  };
  const merged = policy.mergeV4ProjectionThread(existing, incoming);
  assert.equal(merged.turns.some((candidate) => candidate.id === "pending-turn"), false);
  assert.equal(merged.turns[0].items[0].id, "durable");
});

test("drops stale pending overlay once same-submission durable user message is projected", () => {
  const policy = createPolicy();
  const existing = {
    id: "thread-a",
    mobileProjectionVersion: "v4",
    turns: [turn("pending-turn", [
      userMessage("local text before upload path was durable", {
        id: "local-submit-1",
        clientSubmissionId: "submit-1",
        mobilePendingSubmission: true,
      }),
    ], { startedAtMs: 300, status: { type: "running" } })],
  };
  const incoming = {
    id: "thread-a",
    mobileProjectionVersion: "v4",
    turns: [turn("durable-turn", [
      userMessage("server normalized text", { id: "durable", clientSubmissionId: "submit-1" }),
      { type: "agentMessage", id: "assistant-final", text: "done" },
    ], { startedAtMs: 100, completedAtMs: 200, status: { type: "completed" } })],
  };

  const merged = policy.mergeV4ProjectionThread(existing, incoming);

  assert.deepEqual(merged.turns.map((candidate) => candidate.id), ["durable-turn"]);
  assert.deepEqual(merged.turns[0].items.map((item) => item.id), ["durable", "assistant-final"]);
  assert.equal(JSON.stringify(merged).includes("local-submit-1"), false);
});

test("drops unanchored pending overlay after newer non-user receipt authority arrives", () => {
  const policy = createPolicy();
  const existing = {
    id: "thread-a",
    mobileProjectionVersion: "v4",
    turns: [turn("pending-turn", [
      userMessage("old pending", { id: "local-old", clientSubmissionId: "submit-old", mobilePendingSubmission: true }),
    ], { startedAtMs: 100, status: { type: "running" } })],
  };
  const incoming = {
    id: "thread-a",
    mobileProjectionVersion: "v4",
    turns: [turn("new-receipt-turn", [
      { type: "agentMessage", id: "assistant-new", text: "newer receipt" },
      { type: "turnUsageSummary", id: "usage-new" },
    ], {
      startedAtMs: 150,
      completedAtMs: 300,
      status: { type: "completed" },
    })],
  };

  const merged = policy.mergeV4ProjectionThread(existing, incoming);

  assert.deepEqual(merged.turns.map((candidate) => candidate.id), ["new-receipt-turn"]);
  assert.equal(JSON.stringify(merged).includes("local-old"), false);
});

test("anchors pending overlay before non-user items in the matching turn", () => {
  const policy = createPolicy();
  const existing = {
    id: "thread-a",
    mobileProjectionVersion: "v4",
    turns: [turn("turn-1", [
      userMessage("pending", { id: "local-pending", clientSubmissionId: "submit-1", mobilePendingSubmission: true }),
    ], { startedAtMs: 100, status: { type: "running" } })],
  };
  const incoming = {
    id: "thread-a",
    mobileProjectionVersion: "v4",
    turns: [turn("turn-1", [
      { type: "agentMessage", id: "assistant-1", text: "working" },
      { type: "turnUsageSummary", id: "usage-1" },
    ], {
      startedAtMs: 100,
      status: { type: "running" },
    })],
  };

  const merged = policy.mergeV4ProjectionThread(existing, incoming);

  assert.deepEqual(merged.turns[0].items.map((item) => item.id), [
    "local-pending",
    "assistant-1",
    "usage-1",
  ]);
});

test("regressive v4 projection refresh keeps newer revision and active visible turn", () => {
  const policy = createPolicy();
  const existing = {
    id: "thread-a",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 9,
    turns: [turn("active-turn", [userMessage("active")], { startedAtMs: 50, status: { type: "running" } })],
  };
  const incoming = {
    id: "thread-a",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 7,
    turns: [turn("old-turn", [userMessage("old")], { startedAtMs: 10 })],
  };
  const merged = policy.mergeV4ProjectionThread(existing, incoming);
  assert.equal(merged.mobileProjectionRevision, 9);
  assert.deepEqual(merged.turns.map((candidate) => candidate.id), ["old-turn", "active-turn"]);
});

test("non-regressive v4 projection drops stale active-like turn superseded by newer completed receipt", () => {
  const policy = createPolicy();
  const existing = {
    id: "thread-a",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 11,
    mobileHistoryExpanded: true,
    turns: [
      turn("old-active-turn", [userMessage("old bottom user")], {
        startedAtMs: 200,
        status: { type: "running" },
      }),
    ],
  };
  const incoming = {
    id: "thread-a",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 12,
    mobileHistoryExpanded: true,
    mobileReadMode: "projection-v4-dynamic",
    turns: [
      turn("new-receipt-turn", [userMessage("return receipt"), { type: "agentMessage", text: "done" }], {
        startedAtMs: 50,
        completedAtMs: 300,
        status: { type: "completed" },
      }),
    ],
  };
  const merged = policy.mergeV4ProjectionThread(existing, incoming);
  assert.deepEqual(merged.turns.map((candidate) => candidate.id), ["new-receipt-turn"]);
});

test("partial active v4 refresh preserves visible completed receipts omitted by active window", () => {
  const policy = createPolicy();
  const existing = {
    id: "thread-a",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 20,
    turns: [
      turn("completed-receipt", [
        userMessage("task request"),
        { type: "agentMessage", id: "receipt", text: "completed receipt" },
      ], {
        startedAtMs: 100,
        completedAtMs: 200,
        status: { type: "completed" },
      }),
      turn("active-turn", [
        userMessage("follow-up"),
        { type: "agentMessage", id: "active-progress", text: "working" },
      ], {
        startedAtMs: 300,
        status: { type: "running" },
      }),
    ],
  };
  const incoming = {
    id: "thread-a",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 21,
    mobileReadMode: "projection-v4-partial",
    mobileProjection: { version: "v4", partial: true, source: "partial" },
    turns: [
      turn("active-turn", [
        userMessage("follow-up"),
        { type: "agentMessage", id: "active-progress-2", text: "still working" },
      ], {
        startedAtMs: 300,
        status: { type: "running" },
      }),
    ],
  };

  const merged = policy.mergeV4ProjectionThread(existing, incoming);

  assert.deepEqual(merged.turns.map((candidate) => candidate.id), ["completed-receipt", "active-turn"]);
  assert.equal(merged.turns[0].items.some((item) => item && item.id === "receipt"), true);
  assert.equal(merged.turns[1].items.some((item) => item && item.id === "active-progress-2"), true);
});
