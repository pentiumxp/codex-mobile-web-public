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

test("does not append anchors when latest completed turn already has user input", () => {
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
