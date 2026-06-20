"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  CONTEXT_COMPACTION_COMPLETE_NOTICE,
  CONTEXT_COMPACTION_PENDING_NOTICE,
  normalizeNotificationParamsForProjectionV4,
  normalizeThreadVisibleProjection,
  projectionDiffSummary,
} = require("../adapters/thread-visible-item-normalizer");

test("v4 normalizer adds explicit context compaction notice state from notification method", () => {
  const started = normalizeNotificationParamsForProjectionV4("item/started", {
    threadId: "thread-1",
    turnId: "turn-1",
    item: { id: "ctx-1", type: "contextCompaction" },
  });

  assert.equal(started.item.mobileProjectionVersion, "v4");
  assert.equal(started.item.mobileVisibleKey, "turn-1:contextCompaction");
  assert.equal(started.item.mobileCompactionStatus, "running");
  assert.equal(started.item.mobileNotice, CONTEXT_COMPACTION_PENDING_NOTICE);

  const completed = normalizeNotificationParamsForProjectionV4("item/completed", {
    threadId: "thread-1",
    turnId: "turn-1",
    item: { id: "ctx-1", type: "contextCompaction" },
  });

  assert.equal(completed.item.mobileVisibleKey, "turn-1:contextCompaction");
  assert.equal(completed.item.mobileCompactionStatus, "completed");
  assert.equal(completed.item.mobileNotice, CONTEXT_COMPACTION_COMPLETE_NOTICE);
});

test("v4 normalizer keeps type-only historical context markers non-noticeable", () => {
  const result = normalizeThreadVisibleProjection({
    thread: {
      id: "thread-1",
      turns: [{
        id: "turn-1",
        items: [{ id: "ctx-1", type: "contextCompaction" }],
      }],
    },
  }, { revision: 7, source: "test" });

  const item = result.thread.turns[0].items[0];
  assert.equal(result.thread.mobileProjectionVersion, "v4");
  assert.equal(result.thread.mobileProjectionRevision, 7);
  assert.equal(item.mobileVisibleKey, "turn-1:contextCompaction");
  assert.equal(item.mobileVisibleKind, "contextCompaction");
  assert.equal(item.mobileNotice, undefined);
  assert.equal(item.mobileCompactionStatus, undefined);
});

test("v4 normalizer emits stable visible item keys for mixed visible content", () => {
  const result = normalizeThreadVisibleProjection({
    thread: {
      id: "thread-1",
      turns: [{
        id: "turn-1",
        items: [
          { id: "user-1", type: "userMessage", clientSubmissionId: "submit-1" },
          { id: "image-1", type: "imageView", url: "/api/generated-images/file?id=x" },
          { id: "usage-1", type: "turnUsageSummary" },
        ],
      }],
    },
  }, { revision: 3, source: "test" });

  assert.deepEqual(result.thread.mobileVisibleItemKeys, [
    "turn-1:user:user-1",
    "turn-1:image:image-1",
    "turn-1:turnUsageSummary",
  ]);
  assert.deepEqual(result.thread.turns[0].mobileVisibleItemKeys, result.thread.mobileVisibleItemKeys);
});

test("v4 projection diff summary is bounded and key-based", () => {
  const left = normalizeThreadVisibleProjection({
    thread: { id: "thread-1", turns: [{ id: "turn-1", items: [{ id: "user-1", type: "userMessage" }] }] },
  });
  const right = normalizeThreadVisibleProjection({
    thread: { id: "thread-1", turns: [{ id: "turn-1", items: [{ id: "agent-1", type: "agentMessage" }] }] },
  });

  const diff = projectionDiffSummary(left, right);

  assert.equal(diff.equal, false);
  assert.equal(diff.firstDiffIndex, 0);
  assert.equal(diff.left.firstDifferentKey, "turn-1:user:user-1");
  assert.equal(diff.right.firstDifferentKey, "turn-1:receipt:agent-1");
  assert.equal(diff.left.kindCounts.user, 1);
  assert.equal(diff.right.kindCounts.receipt, 1);
});
