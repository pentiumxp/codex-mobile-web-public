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

test("raw operation fallback does not attach a completed older turn operation to a new live turn", () => {
  const { dir, rolloutPath } = writeRollout([
    event("2026-05-24T10:40:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-old" }),
    event("2026-05-24T10:40:02.000Z", "response_item", {
      type: "function_call",
      call_id: "call-old",
      arguments: JSON.stringify({ command: "rg -n old public" }),
    }),
    event("2026-05-24T10:40:05.000Z", "response_item", {
      type: "function_call_output",
      call_id: "call-old",
      output: "Exit code: 0\nWall time: 0.1 seconds\nOutput:\n",
    }),
    event("2026-05-24T10:41:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-new" }),
    event("2026-05-24T10:41:01.000Z", "response_item", { type: "message", role: "user" }),
  ]);
  try {
    const compacted = compactThread({
      id: "thread-5",
      path: rolloutPath,
      turns: [
        { id: "turn-old", status: "interrupted", items: [] },
        {
          id: "turn-new",
          status: { type: "running" },
          items: [{ id: "user-new", type: "userMessage", content: [{ type: "text", text: "continue" }] }],
        },
      ],
    });

    assert.equal(compacted.turns[1].items.some((item) => item.type === "commandExecution"), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("raw operation fallback can attach an unfinished operation from the same live turn", () => {
  const { dir, rolloutPath } = writeRollout([
    event("2026-05-24T10:50:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-live" }),
    event("2026-05-24T10:50:02.000Z", "response_item", {
      type: "function_call",
      call_id: "call-live",
      arguments: JSON.stringify({ command: "rg -n live public" }),
    }),
  ]);
  try {
    const compacted = compactThread({
      id: "thread-6",
      path: rolloutPath,
      turns: [{
        id: "turn-live",
        status: { type: "running" },
        items: [{ id: "user-live", type: "userMessage", content: [{ type: "text", text: "continue" }] }],
      }],
    });

    const command = compacted.turns[0].items.find((item) => item.type === "commandExecution");
    assert.ok(command);
    assert.equal(command.status, "running");
    assert.equal(command.command, "rg -n live public");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("latest completed turn drops operation cards and ends with usage summary", () => {
  const { dir, rolloutPath } = writeRollout([
    event("2026-05-24T11:00:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-completed" }),
    event("2026-05-24T11:00:10.000Z", "event_msg", {
      type: "token_count",
      info: {
        last_token_usage: {
          input_tokens: 1200,
          cached_input_tokens: 800,
          output_tokens: 100,
          reasoning_output_tokens: 20,
          total_tokens: 1300,
        },
        total_token_usage: {
          input_tokens: 2500,
          output_tokens: 200,
          total_tokens: 2700,
        },
        model_context_window: 100000,
      },
    }),
  ]);
  try {
    const compacted = compactThread({
      id: "thread-7",
      path: rolloutPath,
      turns: [{
        id: "turn-completed",
        status: { type: "completed" },
        items: [
          { id: "user-1", type: "userMessage", content: [{ type: "text", text: "run checks" }] },
          { id: "op-old", type: "commandExecution", command: "npm.cmd test", status: "completed" },
          { id: "op-new", type: "commandExecution", command: "npm.cmd run check", status: "completed" },
          { id: "agent-1", type: "agentMessage", text: "Done." },
        ],
      }],
    });

    const items = compacted.turns[0].items;
    assert.equal(items.some((item) => item.type === "commandExecution"), false);
    assert.equal(items[items.length - 1].type, "turnUsageSummary");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("raw operation fallback can attach a completed operation from the same live latest turn", () => {
  const { dir, rolloutPath } = writeRollout([
    event("2026-05-24T11:00:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-done" }),
    event("2026-05-24T11:00:02.000Z", "response_item", {
      type: "function_call",
      call_id: "call-done",
      arguments: JSON.stringify({ command: "npm.cmd run check" }),
    }),
    event("2026-05-24T11:00:08.000Z", "response_item", {
      type: "function_call_output",
      call_id: "call-done",
      output: "Exit code: 0\nWall time: 1.2 seconds\nOutput:\n",
    }),
  ]);
  try {
    const compacted = compactThread({
      id: "thread-8",
      path: rolloutPath,
      turns: [{
        id: "turn-done",
        status: { type: "running" },
        items: [{ id: "agent-live", type: "agentMessage", text: "Still running." }],
      }],
    });

    const command = compacted.turns[0].items.find((item) => item.type === "commandExecution");
    assert.ok(command);
    assert.equal(command.status, "completed");
    assert.equal(command.command, "npm.cmd run check");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("raw operation fallback does not attach a completed operation to a completed latest turn", () => {
  const { dir, rolloutPath } = writeRollout([
    event("2026-05-24T11:10:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-finished" }),
    event("2026-05-24T11:10:02.000Z", "response_item", {
      type: "function_call",
      call_id: "call-finished",
      arguments: JSON.stringify({ command: "npm.cmd test" }),
    }),
    event("2026-05-24T11:10:08.000Z", "response_item", {
      type: "function_call_output",
      call_id: "call-finished",
      output: "Exit code: 0\nWall time: 1.2 seconds\nOutput:\n",
    }),
  ]);
  try {
    const compacted = compactThread({
      id: "thread-9",
      path: rolloutPath,
      turns: [{
        id: "turn-finished",
        status: { type: "completed" },
        items: [{ id: "agent-finished", type: "agentMessage", text: "Done." }],
      }],
    });

    assert.equal(compacted.turns[0].items.some((item) => item.type === "commandExecution"), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
