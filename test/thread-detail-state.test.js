"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const { createThreadDetailStatePolicy } = require(path.resolve(__dirname, "..", "public", "thread-detail-state.js"));

function createPolicy() {
  return createThreadDetailStatePolicy({
    itemVisibleWeight(item) {
      if (item && Object.prototype.hasOwnProperty.call(item, "weight")) return Number(item.weight) || 0;
      return JSON.stringify(item || {}).length;
    },
    isContextCompactionItem(item) {
      return Boolean(item && item.type === "contextCompaction");
    },
    isOperationalItem(item) {
      return Boolean(item && item.type === "commandExecution");
    },
    isAssistantReceiptLikeItem(item) {
      return Boolean(item && (item.type === "agentMessage" || item.type === "plan"));
    },
    isTurnComplete(turn) {
      return Boolean(turn && turn.status === "completed");
    },
    isReasoningItem(item) {
      return Boolean(item && item.type === "reasoning");
    },
    visualReceiptMatchesSuppressionKeys(item, keys) {
      return Boolean(item && keys && keys.has(item.suppressionKey));
    },
  });
}

test("thread detail state keeps stronger existing visible fields when incoming is smaller", () => {
  const policy = createPolicy();
  const merged = policy.mergeItemPreservingVisibleFields({
    id: "existing",
    type: "agentMessage",
    text: "longer visible response",
    content: [{ type: "text", text: "full content" }],
    summary: ["full summary"],
    mobileNotice: "keep notice",
    weight: 100,
  }, {
    id: "incoming",
    type: "agentMessage",
    text: "short",
    content: [{ type: "text", text: "short" }],
    summary: ["short"],
    status: "completed",
    weight: 10,
  });

  assert.equal(merged.id, "incoming");
  assert.equal(merged.status, "completed");
  assert.equal(merged.text, "longer visible response");
  assert.deepEqual(merged.content, [{ type: "text", text: "full content" }]);
  assert.deepEqual(merged.summary, ["full summary"]);
  assert.equal(merged.mobileNotice, "keep notice");
});

test("thread detail state uses incoming authoritative item when it is equally or more complete", () => {
  const policy = createPolicy();
  const incoming = { id: "incoming", text: "authoritative", weight: 20 };

  assert.equal(policy.mergeItemPreservingVisibleFields({ id: "existing", text: "old", weight: 10 }, incoming), incoming);
  assert.equal(policy.mergeItemPreservingVisibleFields({ id: "existing", text: "old", weight: 20 }, incoming), incoming);
});

test("thread detail state does not preserve stale context compaction notice fields", () => {
  const policy = createPolicy();
  const merged = policy.mergeItemPreservingVisibleFields({
    type: "contextCompaction",
    text: "context compacting",
    mobileNotice: "stale",
    mobileCompactionStatus: "pending",
    weight: 100,
  }, {
    type: "contextCompaction",
    text: "context compacting",
    status: "completed",
    weight: 10,
  });

  assert.equal(merged.status, "completed");
  assert.equal(merged.mobileNotice, undefined);
  assert.equal(merged.mobileCompactionStatus, undefined);
});

test("thread detail state keeps operation fields from stronger existing operation item", () => {
  const policy = createPolicy();
  const merged = policy.mergeItemPreservingVisibleFields({
    type: "commandExecution",
    text: "running command",
    command: "npm test",
    fileNames: ["package.json"],
    tool: "exec_command",
    server: "local",
    namespace: "functions",
    weight: 100,
  }, {
    type: "commandExecution",
    text: "running",
    status: "completed",
    weight: 10,
  });

  assert.equal(merged.status, "completed");
  assert.equal(merged.command, "npm test");
  assert.deepEqual(merged.fileNames, ["package.json"]);
  assert.equal(merged.tool, "exec_command");
  assert.equal(merged.server, "local");
  assert.equal(merged.namespace, "functions");
});

test("thread detail state detects authoritative completed incoming receipts", () => {
  const policy = createPolicy();

  assert.equal(policy.completedIncomingTurnHasAuthoritativeReceipt({
    status: "completed",
    items: [{ type: "agentMessage", text: "done" }],
  }), true);
  assert.equal(policy.completedIncomingTurnHasAuthoritativeReceipt({
    status: "running",
    items: [{ type: "agentMessage", text: "working" }],
  }), false);
  assert.equal(policy.completedIncomingTurnHasAuthoritativeReceipt({
    status: "completed",
    items: [{ type: "commandExecution", text: "npm test" }],
  }), false);
});

test("thread detail state drops local-only receipts when incoming turn is authoritative", () => {
  const policy = createPolicy();
  const incomingTurn = {
    status: "completed",
    items: [{ type: "agentMessage", text: "final" }],
  };

  assert.equal(policy.shouldDropLocalOnlyReceiptForIncomingTurn({ type: "agentMessage", text: "local" }, incomingTurn), true);
  assert.equal(policy.shouldDropLocalOnlyReceiptForIncomingTurn({ type: "userMessage", text: "prompt" }, incomingTurn), false);
});

test("thread detail state preserves only eligible local-only items", () => {
  const policy = createPolicy();
  const suppressed = new Set(["visual-call-1"]);
  const authoritativeTurn = {
    status: "completed",
    items: [{ type: "agentMessage", text: "final" }],
  };

  assert.equal(policy.shouldPreserveLocalOnlyItem(null, true), false);
  assert.equal(policy.shouldPreserveLocalOnlyItem({ id: "empty", type: "agentMessage", weight: 0 }, true), false);
  assert.equal(policy.shouldPreserveLocalOnlyItem({ id: "image", type: "imageView", suppressionKey: "visual-call-1", weight: 10 }, true, suppressed), false);
  assert.equal(policy.shouldPreserveLocalOnlyItem({ id: "local-receipt", type: "agentMessage", text: "local", weight: 10 }, true, null, authoritativeTurn), false);
  assert.equal(policy.shouldPreserveLocalOnlyItem({ id: "mux-user-1", type: "userMessage", weight: 10 }, false), true);
  assert.equal(policy.shouldPreserveLocalOnlyItem({ id: "reasoning-1", type: "reasoning", weight: 10 }, true), false);
  assert.equal(policy.shouldPreserveLocalOnlyItem({ id: "operation-1", type: "commandExecution", weight: 10 }, true), true);
  assert.equal(policy.shouldPreserveLocalOnlyItem({ id: "operation-1", type: "commandExecution", weight: 10 }, false), false);
});
