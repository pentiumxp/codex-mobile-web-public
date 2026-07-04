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
      };
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
  assert.deepEqual(result.thread.goal, { status: "in_progress" });
  assert.equal(result.thread.pendingTaskCardCount, 3);
  assert.equal(result.thread.pendingIncomingTaskCardCount, 2);
  assert.equal(result.thread.pendingOutgoingTaskCardCount, 1);
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
          },
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
  assert.equal(result.thread.pendingTaskCardCount, 4);
  assert.equal(result.thread.pendingIncomingTaskCardCount, 3);
  assert.equal(result.thread.pendingOutgoingTaskCardCount, 1);
});

test("thread-detail state bridge adapter preserves canonical exports", () => {
  assert.equal(adapter.createThreadDetailStateBridgeService, createThreadDetailStateBridgeService);
  assert.equal(adapter.stableTextHash, stableTextHash);
});
