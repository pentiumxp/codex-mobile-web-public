"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const {
  activeDetailLoadingPreviewThread,
  buildThreadDetailRenderEvidence,
  createThreadDetailStatePolicy,
  emptyDetailHistoryEvidenceForThread,
  hasNonemptyThreadDetailRenderEvidence,
  mergeThreadSummaryIntoList,
  planEmptyDetailHistoryRecovery,
  planThreadOpenLoadingShell,
  planThreadOpenCacheReuse,
  planSummaryOnlyCurrentThreadRecovery,
  planSummaryOnlyCurrentThreadRecoveryEffects,
  recentThreadDetailRenderEvidence,
  rolloutSizeBytesFromThread,
  sameThreadDetailRenderEvidence,
  threadHasLoadedDetailState,
  threadHasReusableLoadedDetailState,
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
    "mobileDetailLoaded",
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
  assert.equal(threadHasLoadedDetailState({ id: "thread-1", turns: [], mobileReadMode: "recent" }), false);
  assert.equal(threadHasLoadedDetailState({ id: "thread-1", turns: [], mobileDiagnostics: {} }), false);
  assert.equal(threadHasLoadedDetailState({ id: "thread-1", turns: [], runtimeSettings: {} }), false);
  assert.equal(threadHasLoadedDetailState({ id: "thread-1", turns: [], threadTaskCards: [] }), false);
  assert.equal(threadHasLoadedDetailState({ id: "thread-1", turns: [], mobileDetailLoaded: true }), true);
  assert.equal(threadHasLoadedDetailState({ id: "thread-1", turns: [{ id: "turn-1", items: [] }] }), true);
  assert.equal(threadHasLoadedDetailState({ id: "thread-1", turns: [{ id: "turn-1" }], mobileLoading: true }), false);
  assert.equal(threadHasLoadedDetailState({ id: "thread-1", turns: [{ id: "turn-1" }], mobileLoadError: "failed" }), false);

  assert.equal(threadHasReusableLoadedDetailState({ id: "thread-1", turns: [], mobileDetailLoaded: true }), false);
  assert.equal(threadHasReusableLoadedDetailState({ id: "thread-1", turns: [{ id: "turn-1", items: [] }] }), true);
  assert.equal(threadHasReusableLoadedDetailState({
    id: "thread-1",
    activeTurnId: "turn-active",
    turns: [{ id: "turn-active", status: "running", items: [{ id: "assistant-old" }] }],
  }), false);
  assert.equal(threadHasReusableLoadedDetailState({ id: "thread-1", turns: [{ id: "turn-1" }], mobileLoading: true }), false);

  assert.equal(threadIsSummaryOnlyCurrentThread({ id: "thread-1", turns: [] }, "thread-1"), true);
  assert.equal(threadIsSummaryOnlyCurrentThread({ id: "thread-1", turns: [], mobileReadMode: "recent" }, "thread-1"), true);
  assert.equal(threadIsSummaryOnlyCurrentThread({ id: "thread-1", turns: [], threadTaskCards: [] }, "thread-1"), true);
  assert.equal(threadIsSummaryOnlyCurrentThread({ id: "thread-1", turns: [], mobileDetailLoaded: true }, "thread-1"), false);
  assert.equal(threadIsSummaryOnlyCurrentThread({ id: "other", turns: [] }, "thread-1"), false);
});

test("thread detail state plans open-thread cache reuse without accepting empty loaded detail", () => {
  assert.deepEqual(planThreadOpenCacheReuse({
    requestedThreadId: "thread-1",
    currentThreadId: "thread-1",
    currentThread: { id: "thread-1", turns: [{ id: "turn-1", items: [] }], mobileDetailLoaded: true },
  }), {
    shouldUseCachedCurrent: true,
    shouldReportEmptyCachedDetail: false,
    reason: "reusable-loaded-detail",
  });

  assert.deepEqual(planThreadOpenCacheReuse({
    requestedThreadId: "thread-1",
    currentThreadId: "thread-1",
    summaryThread: { id: "thread-1", updatedAt: "2026-06-30T02:05:00.000Z" },
    currentThread: {
      id: "thread-1",
      updatedAt: "2026-06-30T02:00:00.000Z",
      turns: [{ id: "turn-1", items: [] }],
      mobileDetailLoaded: true,
    },
  }), {
    shouldUseCachedCurrent: false,
    shouldReportEmptyCachedDetail: false,
    reason: "summary-newer-than-cached-detail",
  });

  assert.deepEqual(planThreadOpenCacheReuse({
    requestedThreadId: "thread-1",
    currentThreadId: "thread-1",
    summaryThread: { id: "thread-1", updatedAt: "2026-06-30T02:05:00.000Z" },
    currentThread: {
      id: "thread-1",
      turns: [{ id: "turn-1", items: [] }],
      mobileDetailLoaded: true,
    },
  }), {
    shouldUseCachedCurrent: false,
    shouldReportEmptyCachedDetail: false,
    reason: "summary-newer-than-cached-detail",
  });

  assert.deepEqual(planThreadOpenCacheReuse({
    requestedThreadId: "thread-1",
    currentThreadId: "thread-1",
    currentThread: {
      id: "thread-1",
      activeTurnId: "turn-active",
      turns: [{ id: "turn-active", status: "running", items: [{ id: "old-receipt" }] }],
      mobileDetailLoaded: true,
    },
  }), {
    shouldUseCachedCurrent: true,
    shouldRefreshCurrent: true,
    shouldReportEmptyCachedDetail: false,
    reason: "active-loaded-detail-refresh-baseline",
  });

  assert.deepEqual(planThreadOpenCacheReuse({
    requestedThreadId: "thread-1",
    currentThreadId: "thread-1",
    summaryThread: { id: "thread-1", updatedAt: "2026-06-30T02:05:00.000Z" },
    currentThread: {
      id: "thread-1",
      updatedAt: "2026-06-30T02:00:00.000Z",
      status: { type: "active" },
      turns: [{ id: "turn-active", status: "running", items: [{ id: "old-receipt" }] }],
      mobileDetailLoaded: true,
    },
  }), {
    shouldUseCachedCurrent: false,
    shouldUseActivePreview: true,
    shouldReportEmptyCachedDetail: false,
    reason: "active-detail-summary-newer-preview",
  });

  assert.deepEqual(planThreadOpenCacheReuse({
    requestedThreadId: "thread-1",
    currentThreadId: "thread-1",
    currentThread: { id: "thread-1", turns: [], mobileDetailLoaded: true, mobileReadMode: "projection-v4-dynamic" },
  }), {
    shouldUseCachedCurrent: false,
    shouldReportEmptyCachedDetail: true,
    reason: "empty-loaded-detail-not-reusable",
  });

  assert.deepEqual(planThreadOpenCacheReuse({
    requestedThreadId: "thread-2",
    currentThreadId: "thread-1",
    currentThread: { id: "thread-1", turns: [{ id: "turn-1" }], mobileDetailLoaded: true },
  }), {
    shouldUseCachedCurrent: false,
    shouldReportEmptyCachedDetail: false,
    reason: "different-current-thread",
  });

  assert.deepEqual(planThreadOpenCacheReuse({
    requestedThreadId: "thread-1",
    currentThreadId: "thread-1",
    currentThread: { id: "thread-1", turns: [{ id: "turn-1" }], mobileLoading: true },
  }), {
    shouldUseCachedCurrent: false,
    shouldReportEmptyCachedDetail: false,
    reason: "current-thread-loading",
  });
});

test("thread detail state builds active loading preview without stale assistant progress", () => {
  const source = {
    id: "thread-1",
    status: "running",
    activeTurnId: "turn-active",
    mobileDetailLoaded: true,
    turns: [
      {
        id: "turn-completed",
        status: "completed",
        items: [{ id: "completed-assistant", type: "agentMessage", text: "done" }],
      },
      {
        id: "turn-active",
        status: "running",
        items: [
          { id: "active-user", type: "userMessage", content: [{ type: "text", text: "current request" }] },
          { id: "old-assistant", type: "agentMessage", text: "old receipt" },
          { id: "old-plan", type: "plan", text: "old plan" },
          { id: "old-usage", type: "turnUsageSummary" },
          { id: "old-command", type: "commandExecution", command: "npm test" },
        ],
      },
    ],
  };

  const preview = activeDetailLoadingPreviewThread(source);

  assert.ok(preview);
  assert.equal(preview.mobileLoading, true);
  assert.equal(preview.mobileActiveCachePreview, true);
  assert.equal(preview.turns[0], source.turns[0]);
  assert.equal(preview.turns[1].mobileActiveCachePreview, true);
  assert.equal(preview.turns[1].mobileLoading, true);
  assert.deepEqual(preview.turns[1].items.map((item) => item.id), ["active-user"]);
  assert.notEqual(preview.turns[1].items[0], source.turns[1].items[0]);
});

test("thread detail state uses active preview instead of stale active cache when summary is newer", () => {
  const cached = {
    id: "thread-1",
    updatedAt: "2026-06-30T02:00:00.000Z",
    status: { type: "active" },
    activeTurnId: "turn-active",
    mobileDetailLoaded: true,
    turns: [{
      id: "turn-active",
      status: "running",
      items: [
        { id: "active-user", type: "userMessage", content: [{ type: "text", text: "new request" }] },
        { id: "old-assistant", type: "agentMessage", text: "old receipt" },
      ],
    }],
  };
  const plan = planThreadOpenCacheReuse({
    requestedThreadId: "thread-1",
    currentThreadId: "thread-1",
    summaryThread: { id: "thread-1", updatedAt: "2026-06-30T02:05:00.000Z" },
    currentThread: cached,
  });
  const preview = activeDetailLoadingPreviewThread(cached);

  assert.equal(plan.shouldUseCachedCurrent, false);
  assert.equal(plan.shouldUseActivePreview, true);
  assert.equal(plan.reason, "active-detail-summary-newer-preview");
  assert.deepEqual(preview.turns[0].items.map((item) => item.id), ["active-user"]);
});

test("thread detail state drops active preview optimistic user echoes matched by durable input", () => {
  const source = {
    id: "thread-1",
    status: "running",
    activeTurnId: "turn-active",
    mobileDetailLoaded: true,
    turns: [
      {
        id: "turn-completed",
        status: "completed",
        items: [
          {
            id: "durable-user",
            type: "userMessage",
            clientSubmissionId: "sub-1",
            content: [{ type: "text", text: "already sent" }],
          },
          { id: "completed-assistant", type: "agentMessage", text: "done" },
        ],
      },
      {
        id: "turn-active",
        status: "running",
        items: [
          {
            id: "local-user-sub-1",
            type: "userMessage",
            clientSubmissionId: "sub-1",
            mobilePendingSubmission: true,
            content: [{ type: "text", text: "already sent" }],
          },
          {
            id: "local-user-late",
            type: "userMessage",
            mobileSendError: { message: "failed" },
            content: [{ type: "text", text: "already sent" }],
          },
          {
            id: "local-user-new",
            type: "userMessage",
            mobilePendingSubmission: true,
            content: [{ type: "text", text: "new pending" }],
          },
          { id: "active-task", type: "taskCard" },
        ],
      },
    ],
  };

  const preview = activeDetailLoadingPreviewThread(source);

  assert.ok(preview);
  assert.deepEqual(preview.turns[1].items.map((item) => item.id), ["local-user-new", "active-task"]);
});

test("thread detail state plans open-thread loading shell from summary without detail ownership", () => {
  const plan = planThreadOpenLoadingShell({
    threadId: "thread-1",
    summaryThread: {
      id: "thread-1",
      name: "Readable title",
      preview: "Preview text",
      status: { type: "active" },
      turns: [{ id: "stale-turn" }],
      threadTaskCards: [{ id: "private-card" }],
      runtimeSettings: { effort: "xhigh" },
      mobileDiagnostics: { private: "detail" },
      mobileDetailLoaded: true,
      mobileReadMode: "projection-v4-dynamic",
    },
  });

  assert.equal(plan.currentThreadId, "thread-1");
  assert.equal(plan.reason, "summary-loading-shell");
  assert.equal(plan.hasSummary, true);
  assert.equal(plan.summaryAccepted, true);
  assert.equal(plan.hadListTurnsField, true);
  assert.equal(plan.thread.id, "thread-1");
  assert.equal(plan.thread.name, "Readable title");
  assert.equal(plan.thread.preview, "Preview text");
  assert.deepEqual(plan.thread.status, { type: "active" });
  assert.deepEqual(plan.thread.turns, []);
  assert.equal(plan.thread.mobileLoading, true);
  assert.equal(plan.thread.mobileLoadError, "");
  assert.equal(Object.prototype.hasOwnProperty.call(plan.thread, "threadTaskCards"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(plan.thread, "runtimeSettings"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(plan.thread, "mobileDiagnostics"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(plan.thread, "mobileDetailLoaded"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(plan.thread, "mobileReadMode"), false);

  const missingSummary = planThreadOpenLoadingShell({ threadId: "thread-2" });
  assert.equal(missingSummary.reason, "fallback-loading-shell");
  assert.equal(missingSummary.thread.id, "thread-2");
  assert.equal(missingSummary.thread.name, "thread-2");
  assert.deepEqual(missingSummary.thread.turns, []);
  assert.equal(missingSummary.thread.mobileLoading, true);

  const mismatchedSummary = planThreadOpenLoadingShell({
    threadId: "thread-3",
    summaryThread: { id: "thread-other", name: "Wrong thread", turns: [{ id: "wrong" }] },
  });
  assert.equal(mismatchedSummary.reason, "fallback-loading-shell");
  assert.equal(mismatchedSummary.hasSummary, true);
  assert.equal(mismatchedSummary.summaryAccepted, false);
  assert.equal(mismatchedSummary.hadListTurnsField, true);
  assert.equal(mismatchedSummary.thread.id, "thread-3");
  assert.equal(mismatchedSummary.thread.name, "thread-3");
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
    mobileDetailLoaded: true,
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
  assert.equal(Object.prototype.hasOwnProperty.call(result.threads[0], "mobileDetailLoaded"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.threads[0], "mobileReadMode"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.threads[0], "mobileDiagnostics"), false);
});

test("thread detail empty-history recovery plans bounded detail refresh evidence", () => {
  const thread = {
    id: "thread-1",
    mobileReadMode: "projection-v4-dynamic",
    rolloutSizeBytes: 46888840,
    mobileOmittedTurnCount: 79,
    mobileVisibleItemKeys: ["a", "b"],
    threadTaskCards: [{ id: "ttc-private-body" }],
  };

  assert.equal(rolloutSizeBytesFromThread(thread), 46888840);
  assert.deepEqual(emptyDetailHistoryEvidenceForThread(thread), {
    hasEvidence: true,
    rolloutSizeBytes: 46888840,
    omittedTurns: 79,
    visibleItemKeyCount: 2,
    hasActiveTurnEvidence: false,
    taskCardCount: 1,
    pendingTaskCardCount: 0,
  });

  const plan = planEmptyDetailHistoryRecovery({
    thread,
    currentThreadId: "thread-1",
    nowMs: 1000,
    cooldownMs: 30000,
    details: {
      source: "single-thread-render",
      renderMode: "full-render",
      rawMessageText: "private text must not be copied",
      taskCardBody: "private card body must not be copied",
    },
  });

  assert.equal(plan.shouldRecover, true);
  assert.equal(plan.reason, "empty-detail-history-evidence");
  assert.equal(plan.recoveryKey, "thread-1|projection-v4-dynamic|46888840|79|2");
  assert.equal(plan.diagnosticReason, "empty_render_with_history_evidence");
  assert.deepEqual(plan.event, {
    threadId: "thread-1",
    readMode: "projection-v4-dynamic",
    rolloutSizeBytes: 46888840,
    omittedTurns: 79,
    visibleItemKeyCount: 2,
    source: "single-thread-render",
    renderMode: "full-render",
  });
  assert.equal(JSON.stringify(plan).includes("private text"), false);
  assert.equal(JSON.stringify(plan).includes("private card body"), false);
});

test("thread detail empty-history recovery fails closed for weak or cooling evidence", () => {
  assert.equal(planEmptyDetailHistoryRecovery({ thread: null }).reason, "missing-thread");
  assert.equal(planEmptyDetailHistoryRecovery({ thread: { id: "t", mobileLoading: true } }).reason, "thread-loading");
  assert.equal(planEmptyDetailHistoryRecovery({ thread: { id: "t", mobileLoadError: "failed" } }).reason, "thread-load-error");
  assert.equal(planEmptyDetailHistoryRecovery({ thread: { id: "t" } }).reason, "no-history-evidence");

  const activeEvidence = planEmptyDetailHistoryRecovery({
    thread: { id: "t", activeTurnId: "turn-active" },
    nowMs: 100,
  });
  assert.equal(activeEvidence.shouldRecover, true);
  assert.equal(activeEvidence.evidence.hasActiveTurnEvidence, true);

  const pendingEvidence = planEmptyDetailHistoryRecovery({
    thread: { id: "t", pendingTaskCardCount: 1 },
    nowMs: 100,
  });
  assert.equal(pendingEvidence.shouldRecover, true);
  assert.equal(pendingEvidence.evidence.pendingTaskCardCount, 1);

  const cooling = planEmptyDetailHistoryRecovery({
    thread: { id: "t", rolloutSizeBytes: 1 },
    nowMs: 1000,
    lastRecoveredAtMs: 900,
    cooldownMs: 30000,
  });
  assert.equal(cooling.shouldRecover, false);
  assert.equal(cooling.reason, "cooldown");
});

test("thread detail render evidence policy bounds freshness and thread matching", () => {
  const evidence = buildThreadDetailRenderEvidence({
    atMs: 1000,
    threadId: "thread-1",
    threadHash: "hash-1",
    readMode: "projection-v4-dynamic",
    sourceKind: "single-thread-render",
    turnCount: 3,
    visibleItemCount: 9,
    itemCount: 12,
    rawText: "private text must not be copied",
  });

  assert.deepEqual(evidence, {
    atMs: 1000,
    threadId: "thread-1",
    threadHash: "hash-1",
    readMode: "projection-v4-dynamic",
    sourceKind: "single-thread-render",
    turnCount: 3,
    visibleItemCount: 9,
    itemCount: 12,
  });
  assert.equal(JSON.stringify(evidence).includes("private text"), false);
  assert.equal(hasNonemptyThreadDetailRenderEvidence(evidence), true);
  assert.equal(sameThreadDetailRenderEvidence({ evidence, threadId: "thread-1" }), evidence);
  assert.equal(sameThreadDetailRenderEvidence({ evidence, threadId: "thread-2" }), null);

  assert.deepEqual(recentThreadDetailRenderEvidence({
    evidence,
    nowMs: 1200,
    maxAgeMs: 30000,
  }), Object.assign({}, evidence, { ageMs: 200 }));
  assert.equal(recentThreadDetailRenderEvidence({
    evidence,
    nowMs: 40000,
    maxAgeMs: 30000,
  }), null);
  assert.equal(buildThreadDetailRenderEvidence({ threadId: "thread-1", turnCount: 0, visibleItemCount: 0 }), null);
  assert.equal(buildThreadDetailRenderEvidence({ threadId: "", turnCount: 1, visibleItemCount: 1 }), null);
  assert.equal(hasNonemptyThreadDetailRenderEvidence({ turnCount: -1, visibleItemCount: 0 }), false);
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

  assert.deepEqual(planSummaryOnlyCurrentThreadRecoveryEffects(plan), {
    effects: [
      {
        type: "set-current-thread",
        thread: plan.nextThread,
      },
      {
        type: "post-client-event",
        name: "thread_summary_detail_recovery",
        payload: plan.event,
      },
      {
        type: "schedule-current-thread-refresh",
        delayMs: 0,
        reason: "summary-detail-recovery",
      },
    ],
    reason: "summary-only-current-thread",
  });
});

test("thread detail state does not schedule recovery when detail is loaded or refresh is active", () => {
  const notRecoveredPlan = planSummaryOnlyCurrentThreadRecovery({
    thread: { id: "thread-1", turns: [], mobileDetailLoaded: true, mobileReadMode: "recent" },
    currentThreadId: "thread-1",
  });
  assert.deepEqual(notRecoveredPlan, {
    shouldRecover: false,
    shouldScheduleRefresh: false,
    nextThread: { id: "thread-1", turns: [], mobileDetailLoaded: true, mobileReadMode: "recent" },
    event: null,
    reason: "not-summary-only-current-thread",
  });
  assert.deepEqual(planSummaryOnlyCurrentThreadRecoveryEffects(notRecoveredPlan), {
    effects: [],
    reason: "not-summary-only-current-thread",
  });

  const staleDetailFieldsPlan = planSummaryOnlyCurrentThreadRecovery({
    thread: {
      id: "thread-1",
      turns: [],
      mobileReadMode: "recent",
      runtimeSettings: {},
      threadTaskCards: [],
    },
    currentThreadId: "thread-1",
    hasThreadLoadController: false,
    hasRefreshThreadController: false,
  });
  assert.equal(staleDetailFieldsPlan.shouldRecover, true);
  assert.equal(staleDetailFieldsPlan.shouldScheduleRefresh, true);
  assert.equal(staleDetailFieldsPlan.reason, "summary-only-current-thread");

  const busyPlan = planSummaryOnlyCurrentThreadRecovery({
    thread: { id: "thread-1", turns: [] },
    currentThreadId: "thread-1",
    hasThreadLoadController: true,
    hasRefreshThreadController: false,
  });
  assert.equal(busyPlan.shouldRecover, true);
  assert.equal(busyPlan.shouldScheduleRefresh, false);
});
