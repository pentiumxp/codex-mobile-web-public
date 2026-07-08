"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  appendLatestCompletedUserInputAnchors,
  collectRolloutUserInputAnchors,
  userInputAnchorItem,
} = require("../adapters/thread-detail-user-input-anchor-service");

test("collects rollout user inputs and appends anchors to latest completed assistant replay", () => {
  const turnId = "turn-1";
  const collected = collectRolloutUserInputAnchors([
    { type: "turn_context", payload: { turn_id: turnId } },
    { type: "response_item", payload: { id: "u1", type: "message", role: "user", content: [{ type: "input_text", text: "Question" }] } },
  ]);
  const thread = {
    turns: [
      {
        id: turnId,
        status: "completed",
        items: [
          { id: "a1", type: "agentMessage", text: "Answer" },
          { id: "usage", type: "turnUsageSummary" },
        ],
      },
    ],
  };

  const result = appendLatestCompletedUserInputAnchors(thread, collected);

  assert.equal(result.changed, true);
  assert.equal(thread.turns[0].mobileUserInputAnchorBackfilled, true);
  assert.deepEqual(thread.turns[0].items.map((item) => item.type), ["userMessage", "agentMessage", "turnUsageSummary"]);
  assert.equal(thread.turns[0].items[0].text, "Question");
});

test("does not duplicate anchors when latest completed turn already has matching user input", () => {
  const turnId = "turn-1";
  const collected = collectRolloutUserInputAnchors([
    { type: "turn_context", payload: { turn_id: turnId } },
    { type: "event_msg", payload: { type: "user_message", message: "Existing" } },
  ]);
  const thread = {
    turns: [
      {
        id: turnId,
        status: "completed",
        items: [
          { id: "u-existing", type: "userMessage", text: "Existing" },
          { id: "a1", type: "agentMessage", text: "Answer" },
          { id: "usage", type: "turnUsageSummary" },
        ],
      },
    ],
  };

  const result = appendLatestCompletedUserInputAnchors(thread, collected);

  assert.equal(result.changed, false);
  assert.deepEqual(thread.turns[0].items.map((item) => item.id), ["u-existing", "a1", "usage"]);
});

test("appends missing same-turn user input anchors when a completed turn already has earlier user input", () => {
  const turnId = "turn-1";
  const collected = collectRolloutUserInputAnchors([
    { type: "turn_context", payload: { turn_id: turnId } },
    {
      type: "response_item",
      timestamp: "2026-07-07T05:18:40.000Z",
      payload: { type: "message", role: "user", content: [{ type: "input_text", text: "First question" }] },
    },
    {
      type: "event_msg",
      timestamp: "2026-07-07T05:18:41.000Z",
      payload: { type: "user_message", message: "Second clarification" },
    },
  ]);
  const thread = {
    turns: [
      {
        id: turnId,
        status: "completed",
        items: [
          { id: "u-existing", type: "userMessage", text: "First question", startedAt: "2026-07-07T05:18:40.000Z" },
          { id: "a1", type: "agentMessage", text: "Working" },
        ],
      },
    ],
  };

  const result = appendLatestCompletedUserInputAnchors(thread, collected);

  assert.equal(result.changed, true);
  assert.equal(thread.turns[0].mobileUserInputAnchorBackfilled, true);
  assert.deepEqual(
    thread.turns[0].items.filter((item) => item.type === "userMessage").map((item) => item.text),
    ["First question", "Second clarification"],
  );
});

test("ignores internal environment context response items when collecting user input anchors", () => {
  const turnId = "turn-1";
  const collected = collectRolloutUserInputAnchors([
    { type: "event_msg", payload: { type: "task_started", turn_id: turnId } },
    {
      type: "response_item",
      timestamp: "2026-07-07T10:10:48.748Z",
      payload: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "<environment_context>\n  <current_date>2026-07-07</current_date>\n</environment_context>" }],
      },
    },
    { type: "turn_context", payload: { turn_id: turnId } },
    {
      type: "response_item",
      timestamp: "2026-07-07T10:10:48.762Z",
      payload: { type: "message", role: "user", content: [{ type: "input_text", text: "今天的市场怎么样？" }] },
    },
    {
      type: "event_msg",
      timestamp: "2026-07-07T10:10:48.762Z",
      payload: { type: "user_message", message: "今天的市场怎么样？" },
    },
  ]);

  const anchors = collected.byTurn.get(turnId);

  assert.deepEqual(anchors.map((item) => item.text), ["今天的市场怎么样？"]);
});

test("continues scanning older turns when the newest anchored turn has no missing user input", () => {
  const olderTurnId = "turn-older";
  const newerTurnId = "turn-newer";
  const collected = collectRolloutUserInputAnchors([
    { type: "turn_context", payload: { turn_id: olderTurnId } },
    {
      type: "response_item",
      timestamp: "2026-07-07T05:18:40.000Z",
      payload: { type: "message", role: "user", content: [{ type: "input_text", text: "First question" }] },
    },
    {
      type: "event_msg",
      timestamp: "2026-07-07T05:26:49.000Z",
      payload: { type: "user_message", message: "Second clarification" },
    },
    { type: "turn_context", payload: { turn_id: newerTurnId } },
    {
      type: "event_msg",
      timestamp: "2026-07-07T05:30:00.000Z",
      payload: { type: "user_message", message: "Already visible" },
    },
  ]);
  const thread = {
    turns: [
      {
        id: olderTurnId,
        status: "completed",
        items: [
          { id: "u-existing-older", type: "userMessage", text: "First question", startedAt: "2026-07-07T05:18:40.000Z" },
          { id: "a-older", type: "agentMessage", text: "Answer" },
        ],
      },
      {
        id: newerTurnId,
        status: "completed",
        items: [
          { id: "u-existing-newer", type: "userMessage", text: "Already visible", startedAt: "2026-07-07T05:30:00.000Z" },
          { id: "a-newer", type: "agentMessage", text: "Done" },
        ],
      },
    ],
  };

  const result = appendLatestCompletedUserInputAnchors(thread, collected);

  assert.equal(result.changed, true);
  assert.equal(thread.turns[0].mobileUserInputAnchorBackfilled, true);
  assert.equal(thread.turns[1].mobileUserInputAnchorBackfilled, undefined);
  assert.deepEqual(
    thread.turns[0].items.filter((item) => item.type === "userMessage").map((item) => item.text),
    ["First question", "Second clarification"],
  );
  assert.deepEqual(
    thread.turns[1].items.filter((item) => item.type === "userMessage").map((item) => item.text),
    ["Already visible"],
  );
});

test("does not append anchors to synthetic completion turns", () => {
  const turnId = "turn-1";
  const collected = collectRolloutUserInputAnchors([
    { type: "turn_context", payload: { turn_id: turnId } },
    { type: "event_msg", payload: { type: "user_message", message: "Question" } },
  ]);
  const thread = {
    turns: [
      {
        id: turnId,
        status: "completed",
        mobileSyntheticCompletionTurn: true,
        items: [{ id: "a1", type: "agentMessage", text: "Answer" }],
      },
    ],
  };

  assert.equal(appendLatestCompletedUserInputAnchors(thread, collected).changed, false);
});

test("bounds user input anchors and marks non-text input", () => {
  const item = userInputAnchorItem({
    type: "response_item",
    payload: {
      type: "message",
      role: "user",
      content: [
        { type: "input_text", text: "x".repeat(400) },
        { type: "input_image", image_url: { url: "data:image/png;base64,aaaaaaaa" } },
      ],
    },
  }, "turn-1", 0, { textLimit: 256 });

  assert.equal(item.type, "userMessage");
  assert.equal(item.mobileInputAnchorTruncated, true);
  assert.equal(item.mobileInputAnchorHasNonTextInput, true);
  assert.ok(item.text.length <= 256);
  assert.doesNotMatch(item.text, /data:image/i);
});

test("dedupes rollout user input anchors mirrored by event and response items", () => {
  const turnId = "turn-1";
  const timestamp = "2026-07-05T04:11:40.074Z";
  const collected = collectRolloutUserInputAnchors([
    { type: "turn_context", payload: { turn_id: turnId } },
    {
      type: "event_msg",
      timestamp,
      payload: { type: "user_message", message: "Same question" },
    },
    {
      type: "response_item",
      timestamp,
      payload: { type: "message", role: "user", content: [{ type: "input_text", text: "Same   question" }] },
    },
    {
      type: "response_item",
      timestamp: "2026-07-05T04:12:40.074Z",
      payload: { type: "message", role: "user", content: [{ type: "input_text", text: "Same question" }] },
    },
  ]);
  const anchors = collected.byTurn.get(turnId);

  assert.equal(anchors.length, 2);
  assert.deepEqual(anchors.map((item) => item.text), ["Same question", "Same question"]);
  assert.notEqual(anchors[0].startedAtMs, anchors[1].startedAtMs);
});

test("dedupes mirrored user input anchors across close event and response timestamps", () => {
  const turnId = "turn-1";
  const collected = collectRolloutUserInputAnchors([
    { type: "turn_context", payload: { turn_id: turnId } },
    {
      type: "event_msg",
      timestamp: "2026-07-05T04:11:40.074Z",
      payload: { type: "user_message", message: "Same question" },
    },
    {
      type: "response_item",
      timestamp: "2026-07-05T04:11:42.074Z",
      payload: { type: "message", role: "user", content: [{ type: "input_text", text: "Same   question" }] },
    },
  ]);
  const anchors = collected.byTurn.get(turnId);

  assert.equal(anchors.length, 1);
  assert.equal(anchors[0].text, "Same question");
});

test("keeps only the latest bounded anchors per turn", () => {
  const turnId = "turn-1";
  const entries = [{ type: "turn_context", payload: { turn_id: turnId } }];
  for (let index = 0; index < 5; index += 1) {
    entries.push({
      type: "event_msg",
      payload: { type: "user_message", message: `Question ${index}` },
    });
  }

  const collected = collectRolloutUserInputAnchors(entries, { maxPerTurn: 2 });
  const anchors = collected.byTurn.get(turnId);

  assert.equal(anchors.length, 2);
  assert.deepEqual(anchors.map((item) => item.text), ["Question 3", "Question 4"]);
});
