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

    const latest = compacted.turns.find((turn) => turn.id === "turn-new");
    assert.ok(latest);
    assert.equal(latest.items.some((item) => item.type === "commandExecution"), false);
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

test("latest completed turn keeps all operation cards and ends with usage summary", () => {
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
    const operations = Array.from({ length: 14 }, (_, index) => ({
      id: `op-${index}`,
      type: "commandExecution",
      command: `echo ${index}`,
      status: "completed",
    }));
    const compacted = compactThread({
      id: "thread-7",
      path: rolloutPath,
      turns: [{
        id: "turn-completed",
        status: { type: "completed" },
        items: [
          { id: "user-1", type: "userMessage", content: [{ type: "text", text: "run checks" }] },
          ...operations,
          { id: "agent-1", type: "agentMessage", text: "Done." },
        ],
      }],
    });

    const items = compacted.turns[0].items;
    assert.deepEqual(
      items.filter((item) => item.type === "commandExecution").map((item) => item.command),
      operations.map((item) => item.command),
    );
    assert.equal(items[items.length - 1].type, "turnUsageSummary");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("older compacted turns keep only question and receipt items", () => {
  const turns = [];
  const rolloutEvents = [];
  for (let index = 0; index < 11; index += 1) {
    rolloutEvents.push(
      event(`2026-05-24T10:${String(index).padStart(2, "0")}:00.000Z`, "event_msg", {
        type: "task_started",
        turn_id: `turn-${index}`,
      }),
      event(`2026-05-24T10:${String(index).padStart(2, "0")}:30.000Z`, "event_msg", {
        type: "token_count",
        turn_id: `turn-${index}`,
        info: {
          last_token_usage: {
            input_tokens: 100 + index,
            cached_input_tokens: 50,
            output_tokens: 10,
            reasoning_output_tokens: 1,
            total_tokens: 110 + index,
          },
          total_token_usage: {
            input_tokens: 1000 + index,
            cached_input_tokens: 500,
            output_tokens: 100,
            reasoning_output_tokens: 10,
            total_tokens: 1100 + index,
          },
          model_context_window: 200000,
        },
      }),
    );
    turns.push({
      id: `turn-${index}`,
      status: { type: "completed" },
      items: [
        { id: `user-${index}`, type: "userMessage", text: `question ${index}` },
        { id: `agent-mid-${index}`, type: "agentMessage", text: `middle update ${index}` },
        { id: `op-${index}`, type: "commandExecution", command: `echo ${index}`, status: "completed" },
        { id: `reason-${index}`, type: "reasoning", text: `reasoning ${index}` },
        { id: `agent-final-${index}`, type: "agentMessage", text: `receipt ${index}` },
      ],
    });
  }

  const { dir, rolloutPath } = writeRollout(rolloutEvents);
  try {
    const compacted = compactThread({ id: "thread-old", path: rolloutPath, turns }, { maxTurns: 11 });
    const olderItems = compacted.turns[0].items;
    const recentItems = compacted.turns[10].items;

    assert.deepEqual(olderItems.map((item) => item.type), ["userMessage", "agentMessage", "turnUsageSummary"]);
    assert.deepEqual(olderItems.map((item) => item.id), ["user-0", "agent-final-0", "mobile-turn-usage-turn-0"]);
    assert.equal(recentItems.some((item) => item.type === "commandExecution"), true);
    assert.equal(recentItems.some((item) => item.type === "reasoning"), true);
    assert.equal(recentItems.some((item) => item.id === "agent-mid-10"), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("live turn and previous ended turn keep intermediate items while older turns are receipt-only", () => {
  const turns = [
    {
      id: "turn-old",
      status: { type: "completed" },
      items: [
        { id: "user-old", type: "userMessage", text: "old question" },
        { id: "agent-old-mid", type: "agentMessage", text: "old middle update" },
        { id: "op-old", type: "commandExecution", command: "echo old", status: "completed" },
        { id: "reason-old", type: "reasoning", text: "old reasoning" },
        { id: "agent-old-final", type: "agentMessage", text: "old receipt" },
      ],
    },
    {
      id: "turn-previous",
      status: { type: "completed" },
      items: [
        { id: "user-previous", type: "userMessage", text: "previous question" },
        { id: "op-previous", type: "commandExecution", command: "echo previous", status: "completed" },
        { id: "reason-previous", type: "reasoning", text: "previous reasoning" },
        { id: "agent-previous", type: "agentMessage", text: "previous receipt" },
      ],
    },
    {
      id: "turn-live",
      status: { type: "running" },
      items: [
        { id: "user-live", type: "userMessage", text: "live question" },
        { id: "op-live", type: "commandExecution", command: "echo live", status: "running" },
        { id: "reason-live", type: "reasoning", text: "live reasoning" },
      ],
    },
  ];

  const compacted = compactThread({ id: "thread-live-window", turns }, { maxTurns: 3 });

  assert.deepEqual(compacted.turns[0].items.map((item) => item.type), ["userMessage", "agentMessage"]);
  assert.deepEqual(compacted.turns[0].items.map((item) => item.id), ["user-old", "agent-old-final"]);
  assert.equal(compacted.turns[1].items.some((item) => item.type === "commandExecution"), true);
  assert.equal(compacted.turns[1].items.some((item) => item.type === "reasoning"), true);
  assert.equal(compacted.turns[2].items.some((item) => item.type === "commandExecution"), true);
  assert.equal(compacted.turns[2].items.some((item) => item.type === "reasoning"), true);
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

test("projected tool output images are inserted by rollout timestamp inside the turn", () => {
  const pngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
  const { dir, rolloutPath } = writeRollout([
    event("2026-05-24T14:25:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-images" }),
    event("2026-05-24T14:25:01.000Z", "response_item", { type: "message", role: "user" }),
    event("2026-05-24T14:25:01.001Z", "event_msg", { type: "user_message", turn_id: "turn-images" }),
    event("2026-05-24T14:26:00.000Z", "response_item", {
      type: "function_call_output",
      call_id: "call-view-image",
      output: [{ type: "input_image", image_url: pngDataUrl }],
    }),
    event("2026-05-24T14:27:00.000Z", "event_msg", { type: "agent_message", turn_id: "turn-images" }),
    event("2026-05-24T14:27:00.001Z", "response_item", {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "I will fix it." }],
    }),
  ]);
  try {
    const compacted = compactThread({
      id: "thread-image-order",
      path: rolloutPath,
      turns: [{
        id: "turn-images",
        status: { type: "completed" },
        items: [
          { id: "user-images", type: "userMessage", text: "show screenshot" },
          { id: "agent-images", type: "agentMessage", text: "I will fix it." },
        ],
      }],
    });

    assert.deepEqual(compacted.turns[0].items.map((item) => item.type), ["userMessage", "imageView", "agentMessage"]);
    const image = compacted.turns[0].items[1];
    assert.equal(image.startedAtMs, Date.parse("2026-05-24T14:26:00.000Z"));
    assert.ok(String(image.contentUrl || "").startsWith("/api/generated-images/file?id="));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("existing image items are restored to timestamp order inside the turn", () => {
  const compacted = compactThread({
    id: "thread-existing-image-order",
    turns: [{
      id: "turn-existing-images",
      status: { type: "completed" },
      items: [
        { id: "user-existing", type: "userMessage", text: "show screenshot", startedAt: "2026-05-24T14:25:00.000Z" },
        { id: "agent-existing", type: "agentMessage", text: "This came later.", startedAt: "2026-05-24T14:27:00.000Z" },
        { id: "image-existing", type: "imageView", contentUrl: "/api/generated-images/file?id=thread%2Fimage.png", startedAt: "2026-05-24T14:26:00.000Z" },
      ],
    }],
  });

  assert.deepEqual(compacted.turns[0].items.map((item) => item.id), ["user-existing", "image-existing", "agent-existing"]);
});

test("superseded live turns with images are rendered as historical turns", () => {
  const compacted = compactThread({
    id: "thread-superseded-live-image",
    turns: [
      {
        id: "turn-old-live",
        startedAtMs: Date.parse("2026-06-18T12:00:00.000Z"),
        status: "inProgress",
        items: [
          { id: "user-old", type: "userMessage", text: "old upload" },
          {
            id: "image-old",
            type: "imageView",
            contentUrl: "/api/generated-images/file?id=thread%2Fold.png",
            startedAt: "2026-06-18T12:01:00.000Z",
          },
        ],
      },
      {
        id: "turn-new-live",
        startedAtMs: Date.parse("2026-06-18T23:00:00.000Z"),
        status: "inProgress",
        items: [{ id: "user-new", type: "userMessage", text: "new question" }],
      },
    ],
  }, { maxTurns: 2 });

  assert.equal(compacted.turns[0].status.type, "completed");
  assert.equal(compacted.turns[0].mobileSupersededLive, true);
  assert.equal(compacted.turns[0].items.some((item) => item.id === "image-old"), true);
  assert.equal(compacted.turns[1].status, "inProgress");
  assert.deepEqual(compacted.turns.map((turn) => turn.id), ["turn-old-live", "turn-new-live"]);
});

test("superseded live user-only shells are pruned before compact turn trimming", () => {
  const compacted = compactThread({
    id: "thread-superseded-prune-window",
    turns: [
      {
        id: "useful-completed",
        status: { type: "completed" },
        items: [{ id: "agent-useful", type: "agentMessage", text: "older useful receipt" }],
      },
      {
        id: "stale-live-user-1",
        status: "inProgress",
        items: [{ id: "old-user-1", type: "userMessage", text: "old prompt 1" }],
      },
      {
        id: "stale-live-user-2",
        status: "inProgress",
        items: [
          { id: "old-user-2", type: "userMessage", text: "old prompt 2" },
          { id: "reason-old", type: "reasoning", text: "hidden" },
        ],
      },
      {
        id: "superseded-with-receipt",
        status: "inProgress",
        items: [
          { id: "old-user-3", type: "userMessage", text: "old prompt 3" },
          { id: "agent-receipt", type: "agentMessage", text: "recent receipt" },
        ],
      },
      {
        id: "latest-live",
        status: "inProgress",
        items: [{ id: "latest-user", type: "userMessage", text: "latest prompt" }],
      },
    ],
  }, { maxTurns: 3 });

  assert.deepEqual(compacted.turns.map((turn) => turn.id), [
    "useful-completed",
    "superseded-with-receipt",
    "latest-live",
  ]);
  const superseded = compacted.turns.find((turn) => turn.id === "superseded-with-receipt");
  assert.equal(superseded.mobileSupersededLive, true);
  assert.equal(superseded.items.some((item) => item.id === "old-user-3"), false);
  assert.equal(superseded.items.some((item) => item.id === "agent-receipt"), true);
});

test("live latest turn rehydrates several recent raw operations", () => {
  const { dir, rolloutPath } = writeRollout([
    event("2026-05-24T11:05:00.000Z", "event_msg", { type: "task_started", turn_id: "turn-live" }),
    event("2026-05-24T11:05:02.000Z", "response_item", {
      type: "function_call",
      call_id: "call-test",
      arguments: JSON.stringify({ command: "npm.cmd test" }),
    }),
    event("2026-05-24T11:05:04.000Z", "response_item", {
      type: "function_call_output",
      call_id: "call-test",
      output: "Exit code: 0\nWall time: 1.2 seconds\nOutput:\n",
    }),
    event("2026-05-24T11:05:05.000Z", "response_item", {
      type: "custom_tool_call",
      call_id: "call-patch",
      name: "apply_patch",
      input: "*** Begin Patch\n*** Update File: public/app.js\n@@\n-old\n+new\n*** End Patch\n",
    }),
    event("2026-05-24T11:05:06.000Z", "response_item", {
      type: "custom_tool_call_output",
      call_id: "call-patch",
      output: "Success.",
    }),
    event("2026-05-24T11:05:08.000Z", "response_item", {
      type: "function_call",
      call_id: "call-check",
      arguments: JSON.stringify({ command: "node --check server.js" }),
    }),
  ]);
  try {
    const compacted = compactThread({
      id: "thread-live-raw",
      path: rolloutPath,
      turns: [{
        id: "turn-live",
        status: { type: "running" },
        items: [
          { id: "user-live", type: "userMessage", content: [{ type: "text", text: "continue" }] },
          { id: "agent-live", type: "agentMessage", text: "Working." },
        ],
      }],
    });

    const operations = compacted.turns[0].items.filter((item) => {
      return item.type === "commandExecution" || item.type === "fileChange" || item.type === "dynamicToolCall";
    });
    assert.equal(operations.length, 3);
    assert.equal(operations[0].type, "commandExecution");
    assert.equal(operations[0].status, "completed");
    assert.equal(operations[0].command, "npm.cmd test");
    assert.equal(operations[1].type, "fileChange");
    assert.equal(operations[1].status, "completed");
    assert.deepEqual(operations[1].fileNames, ["public/app.js"]);
    assert.equal(operations[2].type, "commandExecution");
    assert.equal(operations[2].status, "running");
    assert.equal(operations[2].command, "node --check server.js");
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
