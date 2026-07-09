"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadDetailStateBridgeService,
  stableTextHash,
} = require("../services/thread-detail/thread-detail-state-bridge-service");
const adapter = require("../adapters/thread-detail-state-bridge-service");

test("thread-detail state bridge resolves late-bound summary state service", () => {
  let summaryService = null;
  const service = createThreadDetailStateBridgeService({
    threadSummaryStateService: () => summaryService,
  });

  assert.equal(service.applyLocalActiveThreadStatusToSummary({ id: "thread-1" }).id, "thread-1");
  summaryService = {
    applyLocalActiveThreadStatusToSummary(thread, options) {
      assert.equal(options.source, "test");
      return Object.assign({}, thread, { status: { type: "active" }, bridged: true });
    },
    readStateDbThread(threadId) {
      return { id: threadId, model: "gpt-test" };
    },
  };

  assert.deepEqual(service.readStateDbThread("thread-2"), { id: "thread-2", model: "gpt-test" });
  assert.equal(service.applyLocalActiveThreadStatusToSummary({ id: "thread-1" }, { source: "test" }).bridged, true);
});

test("thread-detail state bridge attaches task cards, goals, and pending server requests", () => {
  const threadTaskCardService = {
    listForThread(threadId) {
      return [{ id: `card-${threadId}` }];
    },
    pendingCountsForThread(threadId) {
      return {
        pendingTotal: threadId === "thread-1" ? 3 : 0,
        pendingIncoming: 2,
        pendingOutgoing: 1,
        returnReceiptTotal: 1,
        returnFollowUpTotal: 0,
        latestReturnReceiptId: "ttc-return-1",
        latestReturnReceiptAt: "2026-07-09T06:00:00.000Z",
        latestReturnReceiptStatus: "completed",
      };
    },
    returnLedgerForThread(threadId) {
      return [{
        taskCardId: `ttc-${threadId}`,
        status: "return_visible",
        terminalReturnCardId: "ttc-return-1",
        visibilityState: "return_visible",
        issueCodes: [],
      }];
    },
  };
  const threadGoalService = {
    attachGoalToThread(thread) {
      thread.goal = { status: "in_progress" };
      return thread;
    },
  };
  const codexClient = {
    pendingServerRequests() {
      return [
        { method: "item/tool/call", params: { threadId: "thread-1" } },
        { method: "item/tool/call", params: { threadId: "other-thread" } },
        { method: "untracked", params: { threadId: "thread-1" } },
      ];
    },
  };
  const service = createThreadDetailStateBridgeService({
    threadTaskCardService,
    threadGoalService,
    codexClient,
    serverRequestMethods: new Set(["item/tool/call"]),
  });

  const result = service.attachPendingServerRequestsToResult(
    service.attachThreadTaskCardsToResult({ thread: { id: "thread-1" } }),
  );

  assert.deepEqual(result.thread.threadTaskCards, [{ id: "card-thread-1" }]);
  assert.deepEqual(result.thread.taskCardReturnLedger, [{
    taskCardId: "ttc-thread-1",
    status: "return_visible",
    terminalReturnCardId: "ttc-return-1",
    visibilityState: "return_visible",
    issueCodes: [],
  }]);
  assert.deepEqual(result.thread.taskCardReturnLedgerStatusCounts, {});
  assert.deepEqual(result.thread.taskCardReturnLedgerIssueCodes, []);
  assert.deepEqual(result.thread.goal, { status: "in_progress" });
  assert.equal(result.thread.pendingTaskCardCount, 3);
  assert.equal(result.thread.pendingIncomingTaskCardCount, 2);
  assert.equal(result.thread.pendingOutgoingTaskCardCount, 1);
  assert.equal(result.thread.returnReceiptTaskCardCount, 1);
  assert.equal(result.thread.returnFollowUpTaskCardCount, 0);
  assert.equal(result.thread.returnFollowUpPending, false);
  assert.equal(result.thread.latestReturnReceiptTaskCardId, "ttc-return-1");
  assert.deepEqual(result.thread.pendingServerRequests, [
    { method: "item/tool/call", params: { threadId: "thread-1" } },
  ]);
});

test("thread-detail state bridge prefers task-card combined summary to avoid duplicate store reads", () => {
  let summaryCalls = 0;
  let listCalls = 0;
  let countCalls = 0;
  const service = createThreadDetailStateBridgeService({
    threadTaskCardService: {
      summaryForThread(threadId) {
        summaryCalls += 1;
        return {
          cards: [{ id: `summary-${threadId}` }],
          counts: {
          pendingTotal: 4,
          pendingIncoming: 3,
          pendingOutgoing: 1,
          returnReceiptTotal: 2,
          returnFollowUpTotal: 1,
          latestReturnReceiptId: "ttc-return-summary",
          latestReturnReceiptAt: "2026-07-09T06:00:00.000Z",
          latestReturnReceiptStatus: "partially_completed",
          latestReturnFollowUpId: "ttc-return-summary",
          latestReturnFollowUpAt: "2026-07-09T06:00:00.000Z",
          latestReturnFollowUpStatus: "partially_completed",
        },
          returnLedger: [{ taskCardId: "ttc-summary", status: "pending" }],
          returnLedgerStatusCounts: { pending: 1 },
          returnLedgerIssueCodes: [],
        };
      },
      listForThread() {
        listCalls += 1;
        return [];
      },
      pendingCountsForThread() {
        countCalls += 1;
        return {
          pendingTotal: 0,
          pendingIncoming: 0,
          pendingOutgoing: 0,
        };
      },
    },
  });

  const result = service.attachThreadTaskCardsToResult({ thread: { id: "thread-1" } });

  assert.equal(summaryCalls, 1);
  assert.equal(listCalls, 0);
  assert.equal(countCalls, 0);
  assert.deepEqual(result.thread.threadTaskCards, [{ id: "summary-thread-1" }]);
  assert.deepEqual(result.thread.taskCardReturnLedger, [{ taskCardId: "ttc-summary", status: "pending" }]);
  assert.deepEqual(result.thread.taskCardReturnLedgerStatusCounts, { pending: 1 });
  assert.deepEqual(result.thread.taskCardReturnLedgerIssueCodes, []);
  assert.equal(result.thread.pendingTaskCardCount, 4);
  assert.equal(result.thread.pendingIncomingTaskCardCount, 3);
  assert.equal(result.thread.pendingOutgoingTaskCardCount, 1);
  assert.equal(result.thread.returnReceiptTaskCardCount, 2);
  assert.equal(result.thread.returnFollowUpTaskCardCount, 1);
  assert.equal(result.thread.returnFollowUpPending, true);
  assert.equal(result.thread.latestReturnFollowUpTaskCardId, "ttc-return-summary");
});

test("thread-detail state bridge uses summary counts for return follow-up re-entry", () => {
  const service = createThreadDetailStateBridgeService({
    threadTaskCardService: {
      listForThread: () => [],
      summaryCountsForThread(threadId) {
        return {
          pendingTotal: 0,
          pendingIncoming: 0,
          pendingOutgoing: 0,
          returnReceiptTotal: 1,
          returnFollowUpTotal: threadId === "thread-source" ? 1 : 0,
          latestReturnReceiptId: "ttc-return",
          latestReturnReceiptAt: "2026-07-09T06:00:00.000Z",
          latestReturnReceiptStatus: "partially_completed",
          latestReturnFollowUpId: "ttc-return",
          latestReturnFollowUpAt: "2026-07-09T06:00:00.000Z",
          latestReturnFollowUpStatus: "partially_completed",
        };
      },
    },
  });

  const result = service.attachThreadTaskCardsToResult({ thread: { id: "thread-source" } });

  assert.equal(result.thread.pendingTaskCardCount, 0);
  assert.equal(result.thread.returnReceiptTaskCardCount, 1);
  assert.equal(result.thread.returnFollowUpTaskCardCount, 1);
  assert.equal(result.thread.returnFollowUpPending, true);
  assert.equal(result.thread.latestReturnReceiptTaskCardId, "ttc-return");
});

test("thread-detail state bridge adapter preserves canonical exports", () => {
  assert.equal(adapter.createThreadDetailStateBridgeService, createThreadDetailStateBridgeService);
  assert.equal(adapter.stableTextHash, stableTextHash);
});
