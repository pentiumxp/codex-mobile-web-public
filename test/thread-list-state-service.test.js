"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadListStateService,
} = require("../services/thread-list/thread-list-state-service");

function normalizeFsPath(value) {
  return String(value || "").replace(/\/+$/, "").toLowerCase();
}

test("thread-list state service attaches goals and task-card counts to list summaries", () => {
  const service = createThreadListStateService({
    stripThreadListDetailFields: (thread) => {
      const summary = Object.assign({}, thread);
      delete summary.turns;
      delete summary.threadTaskCards;
      return summary;
    },
    threadTaskCardService: {
      pendingCountsForThreads: (threadIds) => new Map(threadIds.map((threadId, index) => [
        String(threadId || ""),
        {
          pendingTotal: index + 1,
          pendingIncoming: index,
          pendingOutgoing: index + 2,
        },
      ])),
      pendingCountsForThread: () => ({ pendingTotal: 9, pendingIncoming: 4, pendingOutgoing: 5 }),
    },
    threadGoalService: {
      attachGoalsToThreadListResult: (result) => {
        result.goalAttached = true;
        return result;
      },
    },
  });

  const result = service.attachThreadListStateToResult({
    data: [
      { id: "a", title: "A", turns: [], threadTaskCards: [{}] },
      { id: "b", title: "B", turns: [] },
    ],
  });

  assert.equal(result.goalAttached, true);
  assert.deepEqual(result.data.map((thread) => thread.pendingTaskCardCount), [1, 2]);
  assert.deepEqual(result.data.map((thread) => thread.pendingIncomingTaskCardCount), [0, 1]);
  assert.deepEqual(result.data.map((thread) => thread.pendingOutgoingTaskCardCount), [2, 3]);
  assert.equal("turns" in result.data[0], false);
  assert.equal("threadTaskCards" in result.data[0], false);
});

test("thread-list state service exposes return receipt and follow-up counts in summaries", () => {
  const service = createThreadListStateService({
    stripThreadListDetailFields: (thread) => {
      const summary = Object.assign({}, thread);
      delete summary.threadTaskCards;
      delete summary.taskCardReturnLedger;
      return summary;
    },
    threadTaskCardService: {
      summaryCountsForThreads: (threadIds) => new Map(threadIds.map((threadId) => [
        String(threadId || ""),
        {
          pendingTotal: 0,
          pendingIncoming: 0,
          pendingOutgoing: 0,
          returnReceiptTotal: threadId === "source-resting" ? 1 : 0,
          returnFollowUpTotal: threadId === "source-resting" ? 1 : 0,
          latestReturnReceiptId: "ttc-return",
          latestReturnReceiptAt: "2026-07-09T06:00:00.000Z",
          latestReturnReceiptStatus: "partially_completed",
          latestReturnFollowUpId: "ttc-return",
          latestReturnFollowUpAt: "2026-07-09T06:00:00.000Z",
          latestReturnFollowUpStatus: "partially_completed",
        },
      ])),
    },
  });

  const result = service.attachThreadListStateToResult({
    data: [{ id: "source-resting", title: "Source", threadTaskCards: [{}], taskCardReturnLedger: [{}] }],
  });

  assert.equal("threadTaskCards" in result.data[0], false);
  assert.equal("taskCardReturnLedger" in result.data[0], false);
  assert.equal(result.data[0].pendingTaskCardCount, 0);
  assert.equal(result.data[0].returnReceiptTaskCardCount, 1);
  assert.equal(result.data[0].returnFollowUpTaskCardCount, 1);
  assert.equal(result.data[0].returnFollowUpPending, true);
  assert.equal(result.data[0].latestReturnFollowUpTaskCardId, "ttc-return");
});

test("thread-list state service upserts rows from result data and alternate threads arrays", () => {
  const upserted = [];
  const service = createThreadListStateService({
    upsertThreadListFallbackCacheThread: (thread, options) => {
      upserted.push({ id: thread && thread.id, options });
      return thread && thread.changed === true;
    },
  });

  const result = {
    data: [{ id: "a", changed: true }],
    threads: [{ id: "b", changed: false }, { id: "c", changed: true }],
  };

  assert.equal(service.upsertThreadListFallbackCacheThreads(result, { addIfMissing: true }), 2);
  assert.deepEqual(upserted.map((entry) => entry.id), ["a", "b", "c"]);
  assert.deepEqual(upserted.map((entry) => entry.options.addIfMissing), [true, true, true]);
});

test("thread-list state service uses bulk fallback cache upsert when available", () => {
  const singleUpserts = [];
  const bulkCalls = [];
  const service = createThreadListStateService({
    upsertThreadListFallbackCacheThread: (thread) => {
      singleUpserts.push(thread && thread.id);
      return true;
    },
    upsertThreadListFallbackCacheThreadsBulk: (threads, options) => {
      bulkCalls.push({ ids: threads.map((thread) => thread && thread.id), options });
      return threads.length;
    },
  });

  assert.equal(service.upsertThreadListFallbackCacheThreads([
    { id: "a" },
    { id: "b" },
    { id: "c" },
  ], { addIfMissing: true }), 3);
  assert.deepEqual(singleUpserts, []);
  assert.deepEqual(bulkCalls, [{
    ids: ["a", "b", "c"],
    options: { addIfMissing: true },
  }]);
});

test("thread-list state service hides inactive same-label empty workspace duplicates", async () => {
  const newMusic = "/Users/hermes-dev/HermesMobileDev/plugins/music";
  const oldMusic = "/Users/xuxin/Documents/Music";
  const service = createThreadListStateService({
    readGlobalState: () => ({
      "active-workspace-roots": [newMusic],
    }),
    visibleWorkspaceRoots: () => new Set([oldMusic, newMusic]),
    visibilityFromGlobalState: () => ({ hidden: true }),
    workspaceRegistryService: {
      list: () => [
        { cwd: newMusic, label: "Music" },
        { cwd: oldMusic, label: "Music" },
      ],
    },
    normalizeFsPath,
    isHiddenThread: (thread) => thread && thread.hidden === true,
    requestThreadList: async (params, options) => {
      assert.equal(params.useStateDbOnly, true);
      assert.equal(options.timeoutMs, 1234);
      return {
        data: [
          { id: "visible", cwd: newMusic },
          { id: "hidden", cwd: oldMusic, hidden: true },
        ],
      };
    },
    readRpcTimeoutMs: 1234,
  });

  const rows = await service.listWorkspaces();

  assert.deepEqual(rows.map((row) => row.cwd), [newMusic]);
  assert.equal(rows[0].active, true);
  assert.equal(rows[0].recentThreadCount, 1);
  assert.equal(rows[0].source, "mobile");
});

test("thread-list state service keeps inactive duplicate workspace when it owns recent threads", async () => {
  const newMusic = "/Users/hermes-dev/HermesMobileDev/plugins/music";
  const oldMusic = "/Users/xuxin/Documents/Music";
  const service = createThreadListStateService({
    readGlobalState: () => ({
      "active-workspace-roots": [newMusic],
    }),
    visibleWorkspaceRoots: () => new Set([oldMusic, newMusic]),
    workspaceRegistryService: {
      list: () => [
        { cwd: newMusic, label: "Music" },
        { cwd: oldMusic, label: "Music" },
      ],
    },
    normalizeFsPath,
    requestThreadList: async () => ({
      data: [
        { id: "new", cwd: newMusic },
        { id: "old-1", cwd: oldMusic },
        { id: "old-2", cwd: oldMusic },
      ],
    }),
  });

  const rows = await service.listWorkspaces();

  assert.deepEqual(rows.map((row) => [row.cwd, row.active, row.recentThreadCount]), [
    [newMusic, true, 1],
    [oldMusic, false, 2],
  ]);
});

test("thread-list state service token workspace snapshot combines visible and registered roots", () => {
  const service = createThreadListStateService({
    readGlobalState: () => ({ marker: true }),
    visibleWorkspaceRoots: () => new Set(["/visible/a", "/visible/b"]),
    workspaceRegistryService: {
      list: () => [{ cwd: "/registered/c" }, { cwd: "" }, null],
    },
  });

  assert.deepEqual(service.tokenUsageWorkspaceCwds(), ["/visible/a", "/visible/b", "/registered/c"]);
});

test("thread-list state service lists Windows desktop global-state workspace roots", async () => {
  const windowsWorkspace = "C:\\Users\\codex\\Documents\\GMK-test";
  const service = createThreadListStateService({
    readGlobalState: () => ({
      "electron-saved-workspace-roots": [windowsWorkspace],
    }),
    visibleWorkspaceRoots: (globalState) => new Set(globalState["electron-saved-workspace-roots"] || []),
    workspaceRegistryService: { list: () => [] },
    normalizeFsPath,
    requestThreadList: async () => ({ data: [] }),
  });

  const rows = await service.listWorkspaces();

  assert.equal(rows.length, 1);
  assert.equal(rows[0].cwd, windowsWorkspace);
  assert.equal(rows[0].source, "codex");
});
