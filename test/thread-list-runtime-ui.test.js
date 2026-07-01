"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const { createThreadListRuntime } = require(path.resolve(__dirname, "..", "public", "thread-list-runtime.js"));

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeFsPath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
}

function basenameForFsPath(value) {
  const parts = normalizeFsPath(value).split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

function createRuntime(state) {
  return createThreadListRuntime({
    state,
    $: () => null,
    api: async () => ({}),
    document: { documentElement: { clientHeight: 800 } },
    window: { innerHeight: 800 },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    setTimeout,
    clearTimeout,
    THREAD_LIST_PAGE_LIMIT: 40,
    THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS: 200,
    THREAD_LIST_DEFERRED_FALLBACK_RETRY_MS: 1000,
    THREAD_LIST_SLOW_PATH_MS: 2500,
    STORAGE_THREAD_ID: "threadId",
    normalizeFsPath,
    escapeHtml,
    shortPath: (value) => basenameForFsPath(value) || String(value || ""),
    isMobileViewport: () => false,
    tokenCountValue: (value) => Number(value || 0),
    formatTokenMillion: (value) => String(value || 0),
    displayInputTokensExcludingCached: () => 0,
    saveCurrentDraftNow: () => {},
    flushSideChatDraftNow: () => {},
    resetComposerRuntimeSelection: () => {},
    abortCurrentThreadRefresh: () => {},
    clearRecentCompletedReplyAnchor: () => {},
    clearConversationAutoScrollHold: () => {},
    setComposerText: () => {},
    replacePendingAttachments: () => {},
    syncActiveTurnFromThread: () => {},
    connectEvents: () => {},
    threadListLoadPolicy: {},
    nowPerfMs: () => 0,
    roundedDurationMs: (value) => value,
    threadListSummaryFromDetailThread: (thread) => thread,
    threadListStableOrderPolicy: { mergeThreadListsStable: ({ currentThreads, incomingThreads }) => incomingThreads || currentThreads || [] },
    reconcileThreadStatusHints: () => {},
    renderCurrentThread: () => {},
    threadTileLayout: () => ({ enabled: false }),
    isThreadTileKeyboardFocusActive: () => false,
    threadTileCandidateIds: () => [],
    threadTileIdsEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    restoreConnectionState: () => {},
    scheduleVisiblePageRefreshCheck: () => {},
    threadPerformanceMetrics: { threadListRenderedPlan: () => ({ action: "none" }) },
    postPerformanceEvent: () => {},
    diagnosticDurationBucket: () => "fast",
    recordHomeAiDiagnosticFailure: () => {},
    recordHomeAiDiagnosticSuccess: () => {},
    threadDiagnosticEventsApi: {},
    renderThreadLoadError: () => {},
    diagnosticErrorCode: () => "",
    diagnosticErrorStatus: () => 0,
    showError: (err) => { throw err; },
    visibleWorkspaceKeys: () => new Set(state.workspaces.map((workspace) => normalizeFsPath(workspace.cwd))),
    codexWorktreeRepoName: () => "",
    basenameForFsPath,
    visibleWorkspaceNames: () => new Set(state.workspaces.map((workspace) => basenameForFsPath(workspace.cwd))),
    statusText: (status) => String(status && (status.text || status.type) || ""),
    scheduleRenderCurrentThread: () => {},
    threadTilePaneIsVisible: () => false,
    scheduleRenderThreadTilePane: () => false,
    updateThreadStatusHints: () => {},
    normalizeThreadGoal: (goal) => goal || null,
    updateThreadGoalDialogState: () => {},
    draftStore: {},
    readDraftMap: () => ({}),
    draftHasContent: () => false,
    restoreDraftForCurrentTarget: () => {},
    updateComposerControls: () => {},
    showHermesPluginPrimaryPage: () => {},
    isHermesEmbedMode: () => false,
    loadThread: async () => {},
    isRunningStatus: () => false,
    rolloutSizeText: () => "",
    isRolloutOverThreshold: () => false,
    formatAbsoluteTime: () => "",
    formatTime: () => "",
    statusIconHtml: () => "",
    statusIconInfo: () => ({}),
    threadGoalForThread: () => null,
    renderThreadGoalBadge: () => "",
    handleThreadCardClick: () => {},
    threadGoalSignature: () => "",
    rolloutSizeBytes: () => 0,
  });
}

test("thread list runtime owns workspace menu labels and cwd visibility filtering", () => {
  const state = {
    workspaceCreateEnabled: true,
    workspaceCreateRoot: "/repos",
    selectedCwd: "/repos/music",
    workspaces: [{ cwd: "/repos/music", label: "Music", recentThreadCount: 2 }],
    threads: [
      { id: "music-a", cwd: "/repos/music", name: "Music A" },
      { id: "other-a", cwd: "/repos/other", name: "Other A" },
      { id: "archived-a", cwd: "/repos/music", archived: true, name: "Archived A" },
    ],
  };
  const runtime = createRuntime(state);

  assert.equal(runtime.selectedWorkspaceLabel(), "Music");
  const menuHtml = runtime.workspaceSidebarOptionsHtml();
  assert.ok(menuHtml.includes("Music (2) - /repos/music"));
  assert.match(menuHtml, /Create Workspace/);

  assert.deepEqual(runtime.visibleThreads().map((thread) => thread.id), ["music-a"]);
  assert.equal(runtime.threadMatchesWorkspaceCwd("/tmp/.codex/worktrees/abc/music", "/repos/music"), false);
});
