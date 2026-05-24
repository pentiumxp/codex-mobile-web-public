"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  compactThread,
  enrichThreadItemTimestampsFromRollout,
} = require("../server");

function writeRollout(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-timestamps-"));
  const rolloutPath = path.join(dir, "rollout-2026-05-24T10-00-00-00000000-0000-4000-8000-000000000001.jsonl");
  fs.writeFileSync(rolloutPath, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
  return { dir, rolloutPath };
}

function event(timestamp, type, payload = {}) {
  return { timestamp, type, payload };
}

test("thread detail items receive per-item timestamps from rollout events", () => {
  const { dir, rolloutPath } = writeRollout([
    event("2026-05-24T10:00:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-1" }),
    event("2026-05-24T10:00:01.000Z", "response_item", { type: "message", role: "user" }),
    event("2026-05-24T10:00:01.001Z", "event_msg", { type: "user_message" }),
    event("2026-05-24T10:00:05.000Z", "event_msg", { type: "agent_message" }),
    event("2026-05-24T10:00:05.001Z", "response_item", { type: "message", role: "assistant" }),
    event("2026-05-24T10:00:09.000Z", "event_msg", { type: "agent_message" }),
    event("2026-05-24T10:00:09.001Z", "response_item", { type: "message", role: "assistant" }),
  ]);
  try {
    const thread = {
      id: "thread-1",
      path: rolloutPath,
      turns: [{
        id: "turn-1",
        items: [
          { id: "u1", type: "userMessage" },
          { id: "a1", type: "agentMessage" },
          { id: "a2", type: "agentMessage" },
        ],
      }],
    };

    enrichThreadItemTimestampsFromRollout(thread);

    assert.equal(thread.turns[0].items[0].startedAtMs, Date.parse("2026-05-24T10:00:01.000Z"));
    assert.equal(thread.turns[0].items[1].startedAtMs, Date.parse("2026-05-24T10:00:05.000Z"));
    assert.equal(thread.turns[0].items[2].startedAtMs, Date.parse("2026-05-24T10:00:09.000Z"));
    assert.notEqual(thread.turns[0].items[1].startedAtMs, thread.turns[0].items[2].startedAtMs);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("compacted live operation items keep rollout-derived timestamps", () => {
  const { dir, rolloutPath } = writeRollout([
    event("2026-05-24T10:10:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-2" }),
    event("2026-05-24T10:10:07.000Z", "response_item", {
      type: "function_call",
      call_id: "call-1",
      arguments: JSON.stringify({ command: "git status --short" }),
    }),
  ]);
  try {
    const compacted = compactThread({
      id: "thread-2",
      path: rolloutPath,
      turns: [{
        id: "turn-2",
        status: { type: "running" },
        items: [{ id: "op1", type: "commandExecution", command: "git status --short", status: "running" }],
      }],
    });

    assert.equal(compacted.turns[0].items.length, 1);
    assert.equal(compacted.turns[0].items[0].startedAtMs, Date.parse("2026-05-24T10:10:07.000Z"));
    assert.equal(compacted.turns[0].items[0].startedAt, "2026-05-24T10:10:07.000Z");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("agent message timestamps are matched by text instead of only sequence", () => {
  const { dir, rolloutPath } = writeRollout([
    event("2026-05-24T10:20:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-3" }),
    event("2026-05-24T10:20:02.000Z", "event_msg", { type: "agent_message", message: "first visible card" }),
    event("2026-05-24T10:20:05.000Z", "event_msg", { type: "agent_message", message: "second visible card" }),
    event("2026-05-24T10:20:08.000Z", "event_msg", { type: "agent_message", message: "third visible card" }),
  ]);
  try {
    const thread = {
      id: "thread-3",
      path: rolloutPath,
      turns: [{
        id: "turn-3",
        items: [
          { id: "a2", type: "agentMessage", text: "second visible card" },
          { id: "a3", type: "agentMessage", text: "third visible card" },
        ],
      }],
    };

    enrichThreadItemTimestampsFromRollout(thread);

    assert.equal(thread.turns[0].items[0].startedAtMs, Date.parse("2026-05-24T10:20:05.000Z"));
    assert.equal(thread.turns[0].items[1].startedAtMs, Date.parse("2026-05-24T10:20:08.000Z"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("operation timestamps prefer matching rollout call id", () => {
  const { dir, rolloutPath } = writeRollout([
    event("2026-05-24T10:30:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-4" }),
    event("2026-05-24T10:30:02.000Z", "response_item", {
      type: "function_call",
      call_id: "call-old",
      arguments: JSON.stringify({ command: "echo old" }),
    }),
    event("2026-05-24T10:30:07.000Z", "response_item", {
      type: "function_call",
      call_id: "call-current",
      arguments: JSON.stringify({ command: "echo current" }),
    }),
  ]);
  try {
    const thread = {
      id: "thread-4",
      path: rolloutPath,
      turns: [{
        id: "turn-4",
        status: { type: "running" },
        items: [{ id: "call-current", type: "commandExecution", command: "echo current", status: "running" }],
      }],
    };

    enrichThreadItemTimestampsFromRollout(thread);

    assert.equal(thread.turns[0].items[0].startedAtMs, Date.parse("2026-05-24T10:30:07.000Z"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
