"use strict";

const {
  buildThreadListWorkspaceRows,
  mapRegisteredWorkspaces,
} = require("./thread-list-workspace-merge-service");

function defaultCounts() {
  return {
    pendingTotal: 0,
    pendingIncoming: 0,
    pendingOutgoing: 0,
  };
}

function createThreadListStateService(dependencies = {}) {
  const stripThreadListDetailFields = typeof dependencies.stripThreadListDetailFields === "function"
    ? dependencies.stripThreadListDetailFields
    : (thread) => Object.assign({}, thread || {});
  const threadTaskCardService = dependencies.threadTaskCardService || {};
  const pendingCountsForThread = typeof threadTaskCardService.pendingCountsForThread === "function"
    ? (threadId) => threadTaskCardService.pendingCountsForThread(threadId)
    : () => defaultCounts();
  const pendingCountsForThreads = typeof threadTaskCardService.pendingCountsForThreads === "function"
    ? (threadIds) => threadTaskCardService.pendingCountsForThreads(threadIds)
    : () => new Map();
  const threadGoalService = dependencies.threadGoalService || {};
  const attachGoalsToThreadListResult = typeof threadGoalService.attachGoalsToThreadListResult === "function"
    ? (result) => threadGoalService.attachGoalsToThreadListResult(result)
    : (result) => result;
  const upsertThreadListFallbackCacheThread = typeof dependencies.upsertThreadListFallbackCacheThread === "function"
    ? dependencies.upsertThreadListFallbackCacheThread
    : () => false;
  const upsertThreadListFallbackCacheThreadsBulk = typeof dependencies.upsertThreadListFallbackCacheThreadsBulk === "function"
    ? dependencies.upsertThreadListFallbackCacheThreadsBulk
    : null;
  const readGlobalState = typeof dependencies.readGlobalState === "function" ? dependencies.readGlobalState : () => ({});
  const visibleWorkspaceRoots = typeof dependencies.visibleWorkspaceRoots === "function"
    ? dependencies.visibleWorkspaceRoots
    : () => new Set();
  const visibilityFromGlobalState = typeof dependencies.visibilityFromGlobalState === "function"
    ? dependencies.visibilityFromGlobalState
    : () => ({});
  const workspaceRegistryService = dependencies.workspaceRegistryService || {};
  const listRegisteredWorkspaces = typeof workspaceRegistryService.list === "function"
    ? () => workspaceRegistryService.list()
    : () => [];
  const normalizeFsPath = typeof dependencies.normalizeFsPath === "function"
    ? dependencies.normalizeFsPath
    : (value) => String(value || "");
  const isHiddenThread = typeof dependencies.isHiddenThread === "function" ? dependencies.isHiddenThread : () => false;
  const requestThreadList = typeof dependencies.requestThreadList === "function"
    ? dependencies.requestThreadList
    : async () => ({ data: [] });
  const readRpcTimeoutMs = Number(dependencies.readRpcTimeoutMs || 0);

  function threadListRowsFromResult(result) {
    if (!result || typeof result !== "object") return [];
    const rows = [];
    if (Array.isArray(result.data)) rows.push(...result.data);
    if (Array.isArray(result.threads) && result.threads !== result.data) rows.push(...result.threads);
    return rows;
  }

  function upsertThreadListFallbackCacheThreads(resultOrThreads, options = {}) {
    const rows = Array.isArray(resultOrThreads)
      ? resultOrThreads
      : threadListRowsFromResult(resultOrThreads);
    if (upsertThreadListFallbackCacheThreadsBulk) {
      return upsertThreadListFallbackCacheThreadsBulk(rows, options);
    }
    let changed = 0;
    for (const thread of rows) {
      if (upsertThreadListFallbackCacheThread(thread, options)) changed += 1;
    }
    return changed;
  }

  function attachThreadTaskCardCountsToSummary(thread, taskCardCounts = null) {
    if (!thread || typeof thread !== "object" || !thread.id) return thread;
    const summary = stripThreadListDetailFields(thread);
    const counts = taskCardCounts || pendingCountsForThread(thread.id) || defaultCounts();
    summary.pendingTaskCardCount = Number(counts.pendingTotal || 0);
    summary.pendingIncomingTaskCardCount = Number(counts.pendingIncoming || 0);
    summary.pendingOutgoingTaskCardCount = Number(counts.pendingOutgoing || 0);
    return summary;
  }

  function attachThreadGoalsToThreadListResult(result) {
    return attachGoalsToThreadListResult(result);
  }

  function attachThreadTaskCardCountsToThreadListResult(result) {
    if (!result || typeof result !== "object") return result;
    const threads = threadListRowsFromResult(result);
    const countsByThreadId = pendingCountsForThreads(threads.map((thread) => thread && thread.id));
    const attach = (thread) => {
      const threadId = String(thread && thread.id || "");
      return attachThreadTaskCardCountsToSummary(thread, countsByThreadId.get(threadId));
    };
    if (Array.isArray(result.data)) result.data = result.data.map(attach);
    if (Array.isArray(result.threads)) result.threads = result.threads.map(attach);
    return result;
  }

  function attachThreadListStateToResult(result) {
    return attachThreadTaskCardCountsToThreadListResult(attachThreadGoalsToThreadListResult(result));
  }

  async function listWorkspaces() {
    const globalState = readGlobalState();
    const roots = visibleWorkspaceRoots(globalState);
    const visibility = visibilityFromGlobalState(globalState);
    const registered = mapRegisteredWorkspaces(listRegisteredWorkspaces(), normalizeFsPath);
    let recentThreads = [];
    try {
      const result = await requestThreadList({
        limit: 500,
        sortKey: "updated_at",
        sortDirection: "desc",
        archived: false,
        useStateDbOnly: true,
        sourceKinds: [],
      }, readRpcTimeoutMs ? { timeoutMs: readRpcTimeoutMs } : undefined);
      recentThreads = (result.data || []).filter((thread) => !isHiddenThread(thread, visibility));
    } catch (_) {
      recentThreads = [];
    }
    const active = Array.isArray(globalState["active-workspace-roots"])
      ? globalState["active-workspace-roots"]
      : [];
    return buildThreadListWorkspaceRows({
      roots,
      registered,
      recentThreads,
      activeWorkspaceRoots: active,
      normalizeFsPath,
    });
  }

  function tokenUsageWorkspaceCwds(globalState = readGlobalState()) {
    return [
      ...visibleWorkspaceRoots(globalState),
      ...listRegisteredWorkspaces().map((workspace) => workspace && workspace.cwd).filter(Boolean),
    ];
  }

  return {
    attachThreadGoalsToThreadListResult,
    attachThreadListStateToResult,
    attachThreadTaskCardCountsToSummary,
    attachThreadTaskCardCountsToThreadListResult,
    listWorkspaces,
    threadListRowsFromResult,
    tokenUsageWorkspaceCwds,
    upsertThreadListFallbackCacheThreads,
  };
}

module.exports = {
  createThreadListStateService,
};
