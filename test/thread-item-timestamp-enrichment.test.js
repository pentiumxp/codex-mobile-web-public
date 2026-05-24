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
