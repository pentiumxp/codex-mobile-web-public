"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const {
  createThreadDetailStatePolicy,
  mergeThreadSummaryIntoList,
  planSummaryOnlyCurrentThreadRecovery,
  threadHasLoadedDetailState,
  threadIsSummaryOnlyCurrentThread,
  threadListSummaryFromDetailThread,
} = require(path.resolve(__dirname, "..", "public", "thread-detail-state.js"));

function createPolicy(overrides = {}) {
  return createThreadDetailStatePolicy(Object.assign({
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
  }, overrides));
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

test("thread detail state preserves visible items only while an existing same turn is live", () => {
  const policy = createPolicy();

  assert.equal(policy.shouldPreserveExistingTurnVisibleItems({
    id: "turn-1",
    status: "running",
    items: [{ type: "imageView", weight: 20 }],
  }, {
    id: "turn-1",
    status: "completed",
    items: [{ type: "agentMessage", weight: 10 }],
  }), true);
  assert.equal(policy.shouldPreserveExistingTurnVisibleItems({
    id: "turn-1",
    status: "completed",
    items: [{ type: "imageView", weight: 20 }],
  }, {
    id: "turn-1",
    status: "completed",
    items: [{ type: "agentMessage", weight: 10 }],
  }), false);
  assert.equal(policy.shouldPreserveExistingTurnVisibleItems({
    id: "turn-1",
    status: "running",
    items: [{ type: "imageView", weight: 20 }],
  }, {
    id: "turn-2",
    status: "completed",
    items: [{ type: "agentMessage", weight: 10 }],
  }), false);
});

test("thread detail state detects reusable render identity for visible text items", () => {
  const policy = createPolicy({
    visibleTextItemsLikelySame(existingItem, incomingItem) {
      return Boolean(existingItem && incomingItem && existingItem.matchKey === incomingItem.matchKey);
    },
    completedReceiptItemsLikelySame(existingItem, incomingItem, incomingTurn) {
      return Boolean(incomingTurn && incomingTurn.receiptMatch
        && existingItem && incomingItem
        && existingItem.receiptKey === incomingItem.receiptKey);
    },
  });

  assert.equal(policy.visibleTextItemsCanShareRenderIdentity({ matchKey: "same" }, { matchKey: "same" }), true);
  assert.equal(policy.visibleTextItemsCanShareRenderIdentity(
    { receiptKey: "receipt-1" },
    { receiptKey: "receipt-1" },
    { receiptMatch: true },
  ), true);
  assert.equal(policy.visibleTextItemsCanShareRenderIdentity({ matchKey: "a" }, { matchKey: "b" }), false);
});

test("thread detail state preserves render identity and stronger completed receipt text", () => {
  const policy = createPolicy({
    comparableVisibleText(item) {
      return String(item && item.text || "").trim().toLowerCase();
    },
    visibleTextItemsLikelySame() {
      return false;
    },
    completedReceiptItemsLikelySame(existingItem, incomingItem, incomingTurn) {
      return Boolean(incomingTurn && incomingTurn.status === "completed"
        && existingItem && incomingItem
        && existingItem.type === "agentMessage"
        && incomingItem.type === "agentMessage");
    },
  });

  const merged = policy.mergeVisibleTextItemPreservingRenderIdentity({
    id: "existing-receipt",
    type: "agentMessage",
    text: "Final answer with an extra validation line",
    startedAtMs: 1234,
    weight: 100,
  }, {
    id: "incoming-receipt",
    type: "agentMessage",
    text: "Final answer",
    status: "completed",
    weight: 10,
  }, {
    status: "completed",
  });

  assert.equal(merged.id, "existing-receipt");
  assert.equal(merged.status, "completed");
  assert.equal(merged.text, "Final answer with an extra validation line");
  assert.equal(merged.startedAtMs, 1234);
});

test("thread detail state does not force render identity when visible text items differ", () => {
  const policy = createPolicy({
    visibleTextItemsLikelySame() {
      return false;
    },
    completedReceiptItemsLikelySame() {
      return false;
    },
  });

  const merged = policy.mergeVisibleTextItemPreservingRenderIdentity({
    id: "existing",
    type: "agentMessage",
    text: "longer visible response",
    startedAtMs: 456,
    weight: 100,
  }, {
    id: "incoming",
    type: "agentMessage",
    text: "short",
    status: "completed",
    weight: 10,
  });

  assert.equal(merged.id, "incoming");
  assert.equal(merged.text, "longer visible response");
  assert.equal(merged.startedAtMs, 456);
});

test("thread detail summaries strip detail-only state before entering thread lists", () => {
  const summary = threadListSummaryFromDetailThread({
    id: "thread-1",
    name: "Music",
    status: "completed",
    turns: [{ id: "turn-private" }],
    runtimeSettings: { model: "private" },
    threadTaskCards: [{ id: "ttc-private" }],
    mobileLoading: true,
    mobileLoadError: "private error",
    mobileReadWarning: "private warning",
    mobileReadMode: "recent",
    mobileDiagnostics: { detail: "private" },
    mobileProjectionVersion: 4,
    mobileProjection: { source: "detail" },
    mobileProjectionRevision: "rev",
    mobileVisibleItemKeys: ["item-1"],
    mobileOlderTurnsCursor: "older",
    mobileNewerTurnsCursor: "newer",
    pendingTaskCardCount: 2,
  });

  assert.equal(summary.id, "thread-1");
  assert.equal(summary.name, "Music");
  assert.equal(summary.status, "completed");
  assert.equal(summary.pendingTaskCardCount, 2);
  for (const field of [
    "turns",
    "runtimeSettings",
    "threadTaskCards",
    "mobileLoading",
    "mobileLoadError",
    "mobileReadWarning",
    "mobileReadMode",
    "mobileDiagnostics",
    "mobileProjectionVersion",
    "mobileProjection",
    "mobileProjectionRevision",
    "mobileVisibleItemKeys",
    "mobileOlderTurnsCursor",
    "mobileNewerTurnsCursor",
  ]) {
    assert.equal(Object.prototype.hasOwnProperty.call(summary, field), false, `${field} should be stripped`);
  }
});

test("thread detail loaded-state policy distinguishes empty detail from summary shells", () => {
  assert.equal(threadHasLoadedDetailState({ id: "thread-1", turns: [] }), false);
  assert.equal(threadHasLoadedDetailState({ id: "thread-1", turns: [], mobileReadMode: "recent" }), true);
  assert.equal(threadHasLoadedDetailState({ id: "thread-1", turns: [], mobileDiagnostics: {} }), true);
  assert.equal(threadHasLoadedDetailState({ id: "thread-1", turns: [], runtimeSettings: {} }), true);
  assert.equal(threadHasLoadedDetailState({ id: "thread-1", turns: [], threadTaskCards: [] }), true);
  assert.equal(threadHasLoadedDetailState({ id: "thread-1", turns: [{ id: "turn-1", items: [] }] }), true);
  assert.equal(threadHasLoadedDetailState({ id: "thread-1", turns: [{ id: "turn-1" }], mobileLoading: true }), false);
  assert.equal(threadHasLoadedDetailState({ id: "thread-1", turns: [{ id: "turn-1" }], mobileLoadError: "failed" }), false);

  assert.equal(threadIsSummaryOnlyCurrentThread({ id: "thread-1", turns: [] }, "thread-1"), true);
  assert.equal(threadIsSummaryOnlyCurrentThread({ id: "thread-1", turns: [], mobileReadMode: "recent" }, "thread-1"), false);
  assert.equal(threadIsSummaryOnlyCurrentThread({ id: "other", turns: [] }, "thread-1"), false);
});

test("thread detail summary merge cannot preserve stale detail fields", () => {
  const result = mergeThreadSummaryIntoList([{
    id: "thread-1",
    name: "Old",
    turns: [],
    mobileLoading: false,
    mobileReadMode: "stale",
    mobileDiagnostics: { detail: "stale" },
    threadTaskCards: [{ id: "stale" }],
  }, {
    id: "thread-hidden",
    hidden: true,
  }], {
    id: "thread-1",
    name: "New",
    turns: [{ id: "turn-1" }],
    runtimeSettings: { model: "private" },
    threadTaskCards: [{ id: "new" }],
    mobileReadMode: "recent",
  }, {
    visibleThreads(threads) {
      return threads.filter((thread) => !thread.hidden);
    },
  });

  assert.equal(result.changed, true);
  assert.equal(result.threads.length, 1);
  assert.equal(result.threads[0].name, "New");
  assert.equal(Object.prototype.hasOwnProperty.call(result.threads[0], "turns"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.threads[0], "runtimeSettings"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.threads[0], "threadTaskCards"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.threads[0], "mobileReadMode"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.threads[0], "mobileDiagnostics"), false);
});

test("thread detail state plans summary-only current-thread recovery", () => {
  const plan = planSummaryOnlyCurrentThreadRecovery({
    thread: {
      id: "thread-1",
      name: "Music",
      turns: [],
      mobileReadWarning: "stale-list-field",
      mobileProjectionRevision: "stale-revision",
      mobileVisibleItemKeys: ["stale-key"],
    },
    currentThreadId: "thread-1",
    clientBuildId: "build-v1",
    hasThreadLoadController: false,
    hasRefreshThreadController: false,
  });

  assert.equal(plan.shouldRecover, true);
  assert.equal(plan.shouldScheduleRefresh, true);
  assert.equal(plan.reason, "summary-only-current-thread");
  assert.equal(plan.nextThread.id, "thread-1");
  assert.equal(plan.nextThread.name, "Music");
  assert.deepEqual(plan.nextThread.turns, []);
  assert.equal(plan.nextThread.mobileLoading, true);
  assert.equal(plan.nextThread.mobileLoadError, "");
  assert.equal(Object.prototype.hasOwnProperty.call(plan.nextThread, "mobileReadWarning"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(plan.nextThread, "mobileProjectionRevision"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(plan.nextThread, "mobileVisibleItemKeys"), false);
  assert.deepEqual(plan.event, {
    threadId: "thread-1",
    reason: "summary-only-current-thread",
    hasListTurnsField: true,
    buildId: "build-v1",
  });
});

test("thread detail state does not schedule recovery when detail is loaded or refresh is active", () => {
  assert.deepEqual(planSummaryOnlyCurrentThreadRecovery({
    thread: { id: "thread-1", turns: [], mobileReadMode: "recent" },
    currentThreadId: "thread-1",
  }), {
    shouldRecover: false,
    shouldScheduleRefresh: false,
    nextThread: { id: "thread-1", turns: [], mobileReadMode: "recent" },
    event: null,
    reason: "not-summary-only-current-thread",
  });

  const busyPlan = planSummaryOnlyCurrentThreadRecovery({
    thread: { id: "thread-1", turns: [] },
    currentThreadId: "thread-1",
    hasThreadLoadController: true,
    hasRefreshThreadController: false,
  });
  assert.equal(busyPlan.shouldRecover, true);
  assert.equal(busyPlan.shouldScheduleRefresh, false);
});
