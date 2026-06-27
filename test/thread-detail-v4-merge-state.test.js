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
    isTurnComplete: (candidate) => /completed|failed|canceled|cancelled|interrupted/i.test(
      String(candidate && (candidate.status && candidate.status.type || candidate.status) || ""),
    ),
    isRunningStatus: (status) => /active|running|queued|processing|pending|started/i.test(
      String(status && status.type || status || ""),
    ),
    isIncompleteInterruptedTurn: () => false,
    turnHasActiveLiveItems: (candidate) => (candidate && Array.isArray(candidate.items) ? candidate.items : [])
      .some((item) => item && item.status && !/completed|failed|canceled|cancelled/i.test(String(item.status.type || item.status))),
    turnOrderMs: (candidate) => Number(candidate && (candidate.startedAtMs || candidate.completedAtMs || 0)) || 0,
    mergeTurnPreservingVisibleItems: (existingTurn, incomingTurn) => Object.assign({}, existingTurn, incomingTurn, {
      items: Array.isArray(incomingTurn && incomingTurn.items) ? incomingTurn.items.slice() : [],
    }),
    sortTurnsForDisplay: (turns) => (turns || []).slice().sort((a, b) => (
      (Number(a && a.startedAtMs) || 0) - (Number(b && b.startedAtMs) || 0)
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
