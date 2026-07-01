"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const { createThreadTileRuntime } = require(path.resolve(__dirname, "..", "public", "thread-tile-runtime.js"));
const threadTileActionsApi = require(path.resolve(__dirname, "..", "public", "thread-tile-actions.js"));
const threadTileStatePolicy = require(path.resolve(__dirname, "..", "public", "thread-tile-state.js"));
const threadTileLayoutPolicy = require(path.resolve(__dirname, "..", "public", "thread-tile-layout.js"));

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function classList() {
  return {
    add: () => {},
    remove: () => {},
    toggle: () => {},
    contains: () => false,
  };
}

function createRuntime(state) {
  const elements = {
    sidebar: { getBoundingClientRect: () => ({ width: 420 }) },
  };
  const document = {
    activeElement: null,
    visibilityState: "visible",
    documentElement: { clientWidth: 2200, clientHeight: 1200, classList: classList() },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ innerHTML: "", content: { firstElementChild: null } }),
  };
  const window = {
    innerWidth: 2200,
    innerHeight: 1200,
    visualViewport: null,
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (fn) => {
      if (typeof fn === "function") fn();
      return 1;
    },
    cancelAnimationFrame: () => {},
  };
  return createThreadTileRuntime({
    state,
    $: (id) => elements[id] || null,
    api: async () => ({}),
    document,
    window,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    setTimeout,
    clearTimeout,
    AbortController,
    THREAD_TILE_USER_MAX_PANES: threadTileLayoutPolicy.DEFAULT_USER_MAX_PANES,
    THREAD_TILE_DETAIL_LOAD_QUEUE_DRAIN_MS: 50,
    THREAD_TILE_REFRESH_INTERVAL_MS: 1000,
    THREAD_TILE_REFRESH_MIN_INTERVAL_MS: 250,
    THREAD_TILE_SETTINGS_SAVE_DEBOUNCE_MS: 10,
    STORAGE_THREAD_DISPLAY_MODE: "threadDisplayMode",
    STORAGE_LEGACY_THREAD_TILE_MODE: "threadTileMode",
    LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS: 10,
    threadTileActionsApi,
    threadTileStatePolicy,
    threadTileLayoutPolicy,
    threadDetailPatchPlanApi: { planThreadDetailDomPatchSurface: () => ({ canPatch: false }) },
    isKeyboardEditableElement: () => false,
    splitPaneSidebarVisible: () => true,
    isMenuOverlayMode: () => false,
    visibleThreads: (threads) => threads || [],
    isRunningStatus: (status) => String(status && status.type || status || "") === "active",
    saveCurrentDraftNow: () => {},
    restoreDraftForCurrentTarget: () => {},
    renderComposerSettings: () => {},
    updateComposerControls: () => {},
    scheduleRenderCurrentThread: () => {},
    renderCurrentThread: () => {},
    showError: (err) => { throw err; },
    threadById: (id) => state.threads.find((thread) => String(thread.id) === String(id)) || null,
    threadDisplayName: (thread) => thread && (thread.name || thread.preview || thread.id) || "",
    shortPath: (value) => String(value || ""),
    formatTime: () => "now",
    statusIconHtml: () => "",
    threadDetailApiPath: (id) => `/api/threads/${id}`,
    mergeThreadPreservingVisibleItems: (existing, thread) => Object.assign({}, existing || {}, thread || {}),
    mergeThreadIntoThreadList: () => true,
    withRenderContextThread: (_thread, fn) => fn(),
    visibleItemsForTurn: () => [],
    renderVisibleItemPatchHtml: () => "",
    renderTurnVisibleItemBudgetNotice: () => "",
    approvalsForTurn: () => [],
    renderApprovalRequest: () => "",
    approvalTurnId: () => "",
    isApprovalActive: () => false,
    currentLiveOperationEntry: () => null,
    latestLiveTurnForThread: () => null,
    renderMobileOperationStack: () => "",
    visibleItemSignature: () => "",
    threadTitleForDisplay: (thread) => thread && (thread.name || thread.preview || thread.id) || "",
    turnTimerStateHtml: () => "<span class=\"timer\"></span>",
    threadTilePaneTimerState: () => ({}),
    threadHasVisibleConversationTurns: () => false,
    threadReadWarningMessage: () => "",
    visibleTurnsForConversation: () => [],
    renderThreadHistoryNote: () => "",
    renderPendingApprovals: () => "",
    effectiveThreadTileSelectedThreadId: () => state.threadTileSelectedThreadId || "",
    conversationRenderSignature: (thread) => `sig:${thread && thread.id || ""}`,
    existingConversationRenderKeys: () => new Set(),
    patchNode: () => null,
    hydrateThreadDetailSurface: () => {},
    clearGlobalLiveOperationDockForThreadTiles: () => {},
    updateConversationHtml: () => {},
    threadTileVisibleShape: () => ({ turnCount: 0, visibleItemCount: 0, duplicateUserMessageCount: 0 }),
    threadTileDomTurnCount: () => 0,
    conversationDomShape: () => ({ itemCount: 0, duplicateRenderKeyCount: 0, duplicateUserMessageCount: 0 }),
    diagnosticHash: (value) => value,
    publishPluginNavigationState: () => {},
    escapeHtml,
  });
}

test("thread tile runtime owns viewport layout, candidate ids, and pane HTML", () => {
  const state = {
    threadTileMode: true,
    threadTileDetails: new Map(),
    threadTileLoadingIds: new Set(),
    threadTileErrors: new Map(),
    threadTileControllers: new Map(),
    threadTileLoadedAtById: new Map(),
    threadTileActiveIds: [],
    threadTilePinnedIds: [],
    threadTileSplitPairs: [],
    threadTilePaneCount: 0,
    threadTileSelectedThreadId: "thread-a",
    threadTileSwitchMenuPaneId: "",
    threadTilePaneScrollHoldById: new Map(),
    threadTileOperationModesById: new Map(),
    threadTileOperationBubblesById: new Map(),
    threadTilePaneRenderFramesById: new Map(),
    threadTileViewportBaseline: null,
    threadTileComposerHeightBaselinePx: 0,
    composerHeightPx: 72,
    currentThreadId: "thread-a",
    currentThread: { id: "thread-a", name: "Alpha Thread", turns: [] },
    threads: [
      { id: "thread-a", name: "Alpha Thread", turns: [] },
      { id: "thread-b", name: "Beta Thread", status: { type: "active" }, turns: [] },
    ],
  };
  const runtime = createRuntime(state);

  const layout = runtime.threadTileLayout({ enabled: true });
  assert.equal(layout.enabled, true);
  assert.ok(layout.maxPanes >= 2);

  const ids = runtime.threadTileCandidateIds(layout);
  assert.ok(ids.includes("thread-a"));
  state.threadTileActiveIds = ids;

  const displayLayout = runtime.threadTileDisplayLayout(layout, ids);
  const html = runtime.renderThreadTilePane("thread-a", displayLayout, new Set());
  assert.match(html, /data-thread-tile-pane="thread-a"/);
  assert.match(html, /Alpha Thread/);
  assert.ok(html.includes("No visible turns."));
});
