"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  canAttachCompletedTurnDiagnostic,
  completionPayloadHasFinalMessageField,
  createThreadCompletionDiagnosticService,
} = require("../adapters/thread-completion-diagnostic-service");

function event(timestamp, type, payload = {}) {
  return { timestamp, type, payload };
}

function serviceForEntries(entries) {
  return createThreadCompletionDiagnosticService({
    fs: {
      existsSync: () => true,
      statSync: () => ({ size: 100, mtimeMs: 200 }),
    },
    cacheTtlMs: 1000,
    cacheKeyForStat: (rolloutPath, stat) => `${rolloutPath}:${stat.size}:${stat.mtimeMs}`,
    finalReceiptTextFromParams: (payload) => {
      const value = payload && (payload.last_agent_message || payload.lastAgentMessage);
      return typeof value === "string" ? value.trim() : "";
    },
    readRolloutEnrichmentEntries: () => entries,
    rolloutCompletionTimestampMs: (entry) => Date.parse(entry.timestamp),
    rolloutPathForThread: (thread) => thread.path,
  });
}

test("completionPayloadHasFinalMessageField detects explicit empty final fields", () => {
  assert.equal(completionPayloadHasFinalMessageField({}), false);
  assert.equal(completionPayloadHasFinalMessageField({ last_agent_message: null }), true);
  assert.equal(completionPayloadHasFinalMessageField({ turn: { finalAgentMessage: "" } }), true);
});

test("collectEmptyCompletionDiagnosticsFromEntries emits diagnostics only for explicit empty completions", () => {
  const service = serviceForEntries([]);
  const payload = service.collectEmptyCompletionDiagnosticsFromEntries([
    event("2026-06-24T01:00:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-empty" }),
    event("2026-06-24T01:00:10.000Z", "event_msg", { type: "task_complete", last_agent_message: null, duration_ms: 10000 }),
    event("2026-06-24T01:01:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-normal" }),
    event("2026-06-24T01:01:10.000Z", "event_msg", { type: "task_complete", last_agent_message: "done" }),
    event("2026-06-24T01:02:10.000Z", "event_msg", { type: "task_complete" }),
  ]);

  assert.equal(payload.scopedCount, 1);
  const item = payload.byTurn.get("turn-empty");
  assert.equal(item.type, "turnDiagnostic");
  assert.equal(item.code, "runtime_completed_without_response");
  assert.equal(item.completedAtMs, Date.parse("2026-06-24T01:00:10.000Z"));
  assert.equal(item.durationMs, 10000);
  assert.equal(payload.byTurn.has("turn-normal"), false);
});

test("appendEmptyCompletionDiagnosticsToThread attaches only to completed turns without receipts", () => {
  const service = serviceForEntries([
    event("2026-06-24T02:00:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-empty" }),
    event("2026-06-24T02:00:02.000Z", "event_msg", { type: "task_complete", last_agent_message: null }),
    event("2026-06-24T02:01:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-with-receipt" }),
    event("2026-06-24T02:01:02.000Z", "event_msg", { type: "task_complete", last_agent_message: null }),
    event("2026-06-24T02:02:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-running" }),
    event("2026-06-24T02:02:02.000Z", "event_msg", { type: "task_complete", last_agent_message: null }),
  ]);
  const thread = {
    status: "idle",
    path: "/tmp/rollout.jsonl",
    turns: [
      { id: "turn-empty", status: "completed", items: [{ id: "u1", type: "userMessage" }] },
      { id: "turn-with-receipt", status: "completed", items: [{ id: "a1", type: "agentMessage", text: "already present" }] },
      { id: "turn-running", status: "running", items: [] },
    ],
  };

  service.appendEmptyCompletionDiagnosticsToThread(thread);

  assert.equal(thread.turns[0].items.some((item) => item.type === "turnDiagnostic"), true);
  assert.equal(thread.turns[1].items.some((item) => item.type === "turnDiagnostic"), false);
  assert.equal(thread.turns[2].items.some((item) => item.type === "turnDiagnostic"), false);
});

test("canAttachCompletedTurnDiagnostic rejects live or failed turn statuses", () => {
  assert.equal(canAttachCompletedTurnDiagnostic("completed"), true);
  assert.equal(canAttachCompletedTurnDiagnostic("idle", { allowRestingThreadStatus: true }), true);
  assert.equal(canAttachCompletedTurnDiagnostic("idle"), false);
  assert.equal(canAttachCompletedTurnDiagnostic("running"), false);
  assert.equal(canAttachCompletedTurnDiagnostic("failed"), false);
});
