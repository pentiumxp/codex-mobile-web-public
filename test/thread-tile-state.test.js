"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const state = require(path.resolve(__dirname, "..", "public", "thread-tile-state.js"));
const layout = require(path.resolve(__dirname, "..", "public", "thread-tile-layout.js"));

test("thread tile state normalizes pane counts and pinned ids", () => {
  assert.equal(state.normalizePaneCount("5.9", { maxPanes: 12 }), 5);
  assert.equal(state.normalizePaneCount("bad", { fallback: 2, maxPanes: 12 }), 2);
  assert.equal(state.normalizePaneCount(99, { maxPanes: 12 }), 12);

  assert.deepEqual(state.normalizePinnedIds(["a", "", "b", "a", " c "], { maxPanes: 2 }), ["a", "b", "c"]);
});

test("thread tile state normalizes split pairs through layout policy", () => {
  const pairs = state.normalizeSplitPairs([
    { anchorId: "a", childId: "b" },
    { anchorId: "a", childId: "c" },
    ["c", "d"],
    { anchorId: "x", childId: "y" },
  ], ["a", "b", "c", "d"], {
    normalizeSplitPairs: layout.normalizeSplitPairs,
  });

  assert.deepEqual(pairs, [
    { anchorId: "a", childId: "b" },
    { anchorId: "c", childId: "d" },
  ]);
});

test("thread tile state selects active pane without depending on app globals", () => {
  assert.equal(state.effectiveSelectedThreadId({
    enabled: false,
    activeIds: ["a"],
    selectedThreadId: "a",
    currentThreadId: "a",
  }), "");
  assert.equal(state.effectiveSelectedThreadId({
    enabled: true,
    activeIds: ["a", "b"],
    selectedThreadId: "b",
    currentThreadId: "a",
  }), "b");
  assert.equal(state.effectiveSelectedThreadId({
    enabled: true,
    activeIds: ["a", "b"],
    selectedThreadId: "missing",
    currentThreadId: "b",
  }), "b");
  assert.equal(state.effectiveSelectedThreadId({
    enabled: true,
    activeIds: ["a", "b"],
    selectedThreadId: "missing",
    currentThreadId: "missing",
  }), "a");
});

test("thread tile state builds and applies display settings payloads", () => {
  const payload = state.displaySettingsPayload({
    threadTileMode: true,
    threadTilePinnedIds: ["a", "b", "a"],
    threadTilePaneCount: "3",
    threadTileSplitPairs: [{ anchorId: "a", childId: "b" }, { anchorId: "x", childId: "y" }],
    threadTileSelectedThreadId: "b",
  }, {
    normalizeSplitPairs: layout.normalizeSplitPairs,
  });

  assert.deepEqual(payload, {
    displayMode: "tile",
    paneThreadIds: ["a", "b"],
    paneCount: 3,
    paneSplitPairs: [{ anchorId: "a", childId: "b" }],
    selectedThreadId: "b",
  });

  const settings = state.normalizeDisplaySettings({
    displayMode: "tile",
    paneThreadIds: ["a", "b"],
    paneCount: "2",
    paneSplitPairs: [["a", "b"]],
    selectedThreadId: "missing",
  }, {
    normalizeSplitPairs: layout.normalizeSplitPairs,
  });

  assert.deepEqual(settings, {
    displayMode: "tile",
    threadTileMode: true,
    paneThreadIds: ["a", "b"],
    paneSplitPairs: [{ anchorId: "a", childId: "b" }],
    paneCount: 2,
    selectedThreadId: "",
  });
});

test("thread tile state syncs active ids into pinned slots only when needed", () => {
  const unchanged = state.syncPinnedIdsFromActiveIds({
    enabled: true,
    activeIds: ["a", "b"],
    pinnedIds: ["a", "b", "c"],
    visibleIds: ["a", "b", "c"],
    splitPairs: [{ anchorId: "b", childId: "c" }],
  }, {
    normalizeSplitPairs: layout.normalizeSplitPairs,
  });
  assert.equal(unchanged.changed, false);

  const changed = state.syncPinnedIdsFromActiveIds({
    enabled: true,
    activeIds: ["b", "d"],
    pinnedIds: ["a", "b", "c"],
    visibleIds: ["a", "b", "c", "d"],
    splitPairs: [{ anchorId: "a", childId: "c" }, { anchorId: "b", childId: "d" }],
  }, {
    normalizeSplitPairs: layout.normalizeSplitPairs,
  });
  assert.equal(changed.changed, true);
  assert.deepEqual(changed.paneThreadIds, ["b", "d", "a", "c"]);
  assert.deepEqual(changed.paneSplitPairs, [{ anchorId: "a", childId: "c" }, { anchorId: "b", childId: "d" }]);
});

test("thread tile state plans active pane sync as one policy boundary", () => {
  assert.deepEqual(state.activePaneSyncPlan({
    enabled: true,
    activeIds: ["a", "b"],
    pinnedIds: ["a", "b", "c"],
    visibleIds: ["a", "b", "c"],
    splitPairs: [{ anchorId: "b", childId: "c" }],
    selectedThreadId: "b",
    currentThreadId: "a",
  }, {
    maxPanes: 12,
    normalizeSplitPairs: layout.normalizeSplitPairs,
  }), {
    action: "sync-active-panes",
    reason: "unchanged",
    changed: false,
    settingsChanged: false,
    pinnedChanged: false,
    selectedChanged: false,
    activeIds: ["a", "b"],
    paneThreadIds: ["a", "b", "c"],
    paneSplitPairs: [{ anchorId: "b", childId: "c" }],
    selectedThreadId: "b",
  });

  assert.deepEqual(state.activePaneSyncPlan({
    enabled: true,
    activeIds: ["b", "d"],
    pinnedIds: ["a", "b", "c"],
    visibleIds: ["a", "b", "c", "d"],
    splitPairs: [{ anchorId: "a", childId: "c" }, { anchorId: "b", childId: "d" }],
    selectedThreadId: "missing",
    currentThreadId: "d",
  }, {
    maxPanes: 12,
    normalizeSplitPairs: layout.normalizeSplitPairs,
  }), {
    action: "sync-active-panes",
    reason: "sync",
    changed: true,
    settingsChanged: true,
    pinnedChanged: true,
    selectedChanged: true,
    activeIds: ["b", "d"],
    paneThreadIds: ["b", "d", "a", "c"],
    paneSplitPairs: [{ anchorId: "a", childId: "c" }, { anchorId: "b", childId: "d" }],
    selectedThreadId: "d",
  });

  assert.deepEqual(state.activePaneSyncPlan({
    enabled: true,
    activeIds: [],
    pinnedIds: ["a"],
    splitPairs: [{ anchorId: "a", childId: "b" }],
    selectedThreadId: "a",
  }, { maxPanes: 12 }), {
    action: "sync-active-panes",
    reason: "no-active-panes",
    changed: true,
    settingsChanged: false,
    pinnedChanged: false,
    selectedChanged: true,
    activeIds: [],
    paneThreadIds: ["a"],
    paneSplitPairs: [{ anchorId: "a", childId: "b" }],
    selectedThreadId: "",
  });
});

test("thread tile state plans candidate pane ids without app globals", () => {
  assert.deepEqual(state.candidatePaneIdsPlan({
    pinnedIds: ["hidden"],
    defaultIds: ["a", "b"],
    visibleIds: ["a", "b"],
    currentThreadId: "a",
    maxPanes: 2,
  }, { maxPanes: 12 }), {
    action: "candidate-pane-ids",
    reason: "defaults",
    ids: ["a", "b"],
    pinnedIds: [],
    defaultIds: ["a", "b"],
    maxPanes: 2,
  });

  assert.deepEqual(state.candidatePaneIdsPlan({
    pinnedIds: ["p1", "p2"],
    defaultIds: ["a", "b"],
    visibleIds: ["p1", "p2", "a", "b"],
    currentThreadId: "current",
    maxPanes: 3,
  }, { maxPanes: 12 }), {
    action: "candidate-pane-ids",
    reason: "fallback",
    ids: ["p1", "p2", "current"],
    pinnedIds: ["p1", "p2"],
    defaultIds: ["a", "b"],
    maxPanes: 3,
  });

  assert.deepEqual(state.candidatePaneIdsPlan({
    pinnedIds: ["p1", "p2"],
    defaultIds: ["a", "b"],
    visibleIds: ["p1", "p2", "a", "b"],
    currentThreadId: "p2",
    maxPanes: 3,
  }, {
    maxPanes: 12,
    selectPinnedThreadTileIds: ({ pinnedThreadIds, threadIds, maxPanes }) => [threadIds[0], ...pinnedThreadIds].slice(0, maxPanes),
  }), {
    action: "candidate-pane-ids",
    reason: "selector",
    ids: ["a", "p1", "p2"],
    pinnedIds: ["p1", "p2"],
    defaultIds: ["a", "b"],
    maxPanes: 3,
  });
});

test("thread tile state plans switch menu options and controls without app globals", () => {
  assert.deepEqual(state.switchMenuOptionsPlan({
    currentId: "b",
    activeIds: ["a", "b"],
    runningIds: ["c", "a"],
    visibleIds: ["d", "c"],
  }), ["b", "a", "c", "d"]);

  assert.deepEqual(state.switchMenuPlan({
    currentId: "b",
    switchMenuPaneId: "a",
    options: ["b", "a"],
    activeIds: ["a", "b"],
    count: 2,
    minCount: 1,
    maxCount: 3,
  }), {
    action: "skip",
    reason: "closed",
    currentId: "b",
    options: ["b", "a"],
    activeIds: ["a", "b"],
    count: 2,
    minCount: 1,
    maxCount: 3,
    canClose: false,
    canAdd: false,
  });

  assert.deepEqual(state.switchMenuPlan({
    currentId: "b",
    switchMenuPaneId: "b",
    options: ["b", "a"],
    activeIds: ["a", "b"],
    count: 2,
    minCount: 1,
    maxCount: 3,
  }), {
    action: "render-switch-menu",
    reason: "open",
    currentId: "b",
    options: ["b", "a"],
    activeIds: ["a", "b"],
    count: 2,
    minCount: 1,
    maxCount: 3,
    canClose: true,
    canAdd: true,
  });

  const maxed = state.switchMenuPlan({
    currentId: "b",
    switchMenuPaneId: "b",
    options: ["b", "a"],
    activeIds: ["a"],
    count: 3,
    minCount: 3,
    maxCount: 3,
  });
  assert.equal(maxed.canClose, false);
  assert.equal(maxed.canAdd, false);
});

test("thread tile state plans pane slot mutation side effects", () => {
  assert.deepEqual(state.paneSlotMutationEffectsPlan({
    action: "replace",
    reason: "replace-pane-thread",
    from: "a",
    to: "b",
    paneThreadIds: ["b", "c"],
    selectedThreadId: "b",
    switchMenuPaneId: "",
    scrollResetIds: ["a", "b"],
    renderMode: "patch-source-pane",
    loadThreadId: "b",
  }, { maxPanes: 12 }), {
    action: "pane-slot-effects",
    reason: "replace-pane-thread",
    sourceAction: "replace",
    paneThreadIds: ["b", "c"],
    paneSplitPairs: null,
    paneCount: null,
    selectedThreadId: "b",
    switchMenuPaneId: "",
    scrollResetIds: ["a", "b"],
    saveDraft: true,
    restoreDraft: true,
    updateComposer: true,
    scheduleSettingsSave: true,
    refreshActiveIds: true,
    selectionPolicy: "none",
    selectionEmptyFallback: false,
    loadThreadId: "b",
    loadSource: "tile-switch",
    renderMode: "patch-pane",
    renderStickToBottom: false,
    patchThreadId: "b",
    patchSourceThreadId: "a",
    patchStickToBottom: true,
  });

  assert.equal(state.paneSlotMutationEffectsPlan({
    action: "replace",
    renderMode: "full",
  }).renderMode, "schedule-full");

  assert.deepEqual(state.paneSlotMutationEffectsPlan({
    action: "move",
    reason: "move-pane",
    paneThreadIds: ["c", "a", "b"],
    paneSplitPairs: [{ anchorId: "a", childId: "b" }],
    selectedThreadId: "c",
  }, { maxPanes: 12 }), {
    action: "pane-slot-effects",
    reason: "move-pane",
    sourceAction: "move",
    paneThreadIds: ["c", "a", "b"],
    paneSplitPairs: [{ anchorId: "a", childId: "b" }],
    paneCount: null,
    selectedThreadId: "c",
    switchMenuPaneId: "",
    scrollResetIds: [],
    saveDraft: true,
    restoreDraft: true,
    updateComposer: true,
    scheduleSettingsSave: true,
    refreshActiveIds: false,
    selectionPolicy: "none",
    selectionEmptyFallback: false,
    loadThreadId: "",
    loadSource: "tile-switch",
    renderMode: "full",
    renderStickToBottom: true,
    patchThreadId: "",
    patchSourceThreadId: "",
    patchStickToBottom: false,
  });

  const replaceLast = state.paneSlotMutationEffectsPlan({
    action: "replace-last",
    paneThreadIds: ["a", "d"],
    selectedThreadId: "d",
    scrollResetIds: ["b", "d"],
  }, { maxPanes: 12 });
  assert.equal(replaceLast.saveDraft, false);
  assert.equal(replaceLast.renderMode, "none");
  assert.equal(replaceLast.refreshActiveIds, true);
  const count = state.paneSlotMutationEffectsPlan({
    action: "set-pane-count",
    paneCount: 4,
    switchMenuPaneId: "",
  }, { maxPanes: 12 });
  assert.equal(count.paneThreadIds, null);
  assert.equal(count.paneCount, 4);
  assert.equal(count.selectionPolicy, "pane-selection");
  assert.equal(count.selectionEmptyFallback, false);
  assert.equal(count.renderMode, "full");
  assert.equal(count.renderStickToBottom, true);
  assert.equal(state.paneSlotMutationEffectsPlan({
    action: "set-pane-count",
    paneCount: 4,
  }, { render: false }).renderMode, "none");
  const close = state.paneSlotMutationEffectsPlan({
    action: "close-pane",
    paneThreadIds: ["a", "c"],
    paneCount: 2,
    scrollResetIds: ["b"],
  }, { maxPanes: 12 });
  assert.equal(close.saveDraft, true);
  assert.equal(close.restoreDraft, true);
  assert.equal(close.updateComposer, true);
  assert.equal(close.selectionPolicy, "pane-selection");
  assert.equal(close.selectionEmptyFallback, true);
  assert.equal(close.renderMode, "full");
  assert.equal(close.renderStickToBottom, true);
  assert.equal(state.paneSlotMutationEffectsPlan({ action: "unknown" }).reason, "unsupported-mutation-plan");
});

test("thread tile state updates split pairs without keeping stale ids", () => {
  const removed = state.removeSplitPairsForIds([
    { anchorId: "a", childId: "b" },
    { anchorId: "c", childId: "d" },
  ], ["b"]);
  assert.equal(removed.changed, true);
  assert.deepEqual(removed.splitPairs, [{ anchorId: "c", childId: "d" }]);

  const prepended = state.prependSplitPair([{ anchorId: "a", childId: "b" }], "c", "d", {
    ids: ["a", "b", "c", "d"],
    normalizeSplitPairs: layout.normalizeSplitPairs,
  });
  assert.equal(prepended.changed, true);
  assert.deepEqual(prepended.splitPairs, [
    { anchorId: "c", childId: "d" },
    { anchorId: "a", childId: "b" },
  ]);
});

test("thread tile state plans pane count changes and selection fallback", () => {
  assert.equal(state.paneCountChangePlan({ enabled: false }).action, "skip");
  assert.deepEqual(state.paneCountChangePlan({
    enabled: true,
    layoutEnabled: true,
    nextCount: 5,
    currentCount: 2,
    storedPaneCount: 0,
    minCount: 2,
    maxCount: 4,
  }, { maxPanes: 12 }), {
    action: "set-pane-count",
    reason: "set-pane-count",
    paneCount: 4,
    currentCount: 2,
    minCount: 2,
    maxCount: 4,
    switchMenuPaneId: "",
  });
  assert.equal(state.paneCountChangePlan({
    enabled: true,
    layoutEnabled: true,
    nextCount: 3,
    currentCount: 3,
    storedPaneCount: 3,
    minCount: 2,
    maxCount: 4,
  }, { maxPanes: 12 }).reason, "unchanged");
  assert.deepEqual(state.paneSelectionPlan({
    selectedThreadId: "c",
    ids: ["a", "b"],
    emptyFallback: false,
  }), {
    selectedThreadId: "a",
    changed: true,
    reason: "selected-missing",
  });
  assert.deepEqual(state.paneSelectionPlan({
    selectedThreadId: "",
    ids: ["a", "b"],
    emptyFallback: false,
  }), {
    selectedThreadId: "",
    changed: false,
    reason: "empty-selection",
  });
  assert.deepEqual(state.paneSelectionPlan({
    selectedThreadId: "",
    ids: ["a", "b"],
    emptyFallback: true,
  }), {
    selectedThreadId: "a",
    changed: true,
    reason: "empty-fallback",
  });
});

test("thread tile state plans explicit pane selection", () => {
  assert.equal(state.selectPanePlan({
    enabled: false,
    threadId: "a",
    activeIds: ["a"],
  }).reason, "disabled");
  assert.equal(state.selectPanePlan({
    enabled: true,
    threadId: "c",
    activeIds: ["a", "b"],
  }).reason, "pane-not-active");
  assert.equal(state.selectPanePlan({
    enabled: true,
    threadId: "a",
    activeIds: ["a", "b"],
    selectedThreadId: "a",
  }).reason, "unchanged");
  assert.deepEqual(state.selectPanePlan({
    enabled: true,
    threadId: "b",
    activeIds: ["a", "b", "b"],
    selectedThreadId: "a",
  }), {
    action: "select-pane",
    reason: "select-pane",
    threadId: "b",
    previousThreadId: "a",
    selectedThreadId: "b",
    patchThreadIds: ["b", "a"],
  });

  assert.deepEqual(state.selectedPaneEffectsPlan({
    action: "select-pane",
    reason: "select-pane",
    threadId: "b",
    selectedThreadId: "b",
    patchThreadIds: ["b", "a", "b"],
  }), {
    action: "selected-pane-effects",
    reason: "select-pane",
    sourceAction: "select-pane",
    selectedThreadId: "b",
    patchThreadIds: ["b", "a"],
    saveDraft: true,
    restoreDraft: true,
    updateComposer: true,
    renderMode: "patch-panes",
    patchPreserveScroll: true,
    scheduleFullRenderOnPatchMiss: true,
  });
  assert.equal(state.selectedPaneEffectsPlan({
    action: "select-pane",
    selectedThreadId: "b",
  }, { render: false }).renderMode, "none");
  assert.equal(state.selectedPaneEffectsPlan({ action: "skip" }).reason, "unsupported-select-pane-plan");
});

test("thread tile state plans pane close without app globals", () => {
  assert.equal(state.closePanePlan({
    enabled: true,
    layoutEnabled: true,
    threadId: "a",
    ids: ["a"],
    minCount: 1,
  }).reason, "min-pane-count");

  assert.deepEqual(state.closePanePlan({
    enabled: true,
    layoutEnabled: true,
    threadId: "b",
    ids: ["a", "b", "c"],
    minCount: 2,
    pinnedIds: ["a", "b", "c"],
    defaultIds: ["a", "b", "c", "d"],
  }, { maxPanes: 12 }), {
    action: "close-pane",
    reason: "close-pane",
    threadId: "b",
    paneCount: 2,
    paneThreadIds: ["a", "c", "d"],
    switchMenuPaneId: "",
    scrollResetIds: ["b"],
  });
});

test("thread tile state owns operation bubble dwell and expiry policy", () => {
  assert.equal(state.operationBubbleRecord({
    threadId: "pane-1",
    html: "<div>no operation</div>",
    nowMs: 1000,
  }), null);

  const record = state.operationBubbleRecord({
    threadId: "pane-1",
    html: "<button class=\"mobile-operation-bubble\">cmd</button>",
    nowMs: 1000,
    minVisibleMs: 500,
  });
  assert.deepEqual(record, {
    html: "<button class=\"mobile-operation-bubble\">cmd</button>",
    visibleUntilMs: 1500,
  });

  assert.deepEqual(state.operationBubbleSnapshot(record, { nowMs: 1200 }), {
    visible: true,
    html: "<button class=\"mobile-operation-bubble\">cmd</button>",
    remainingMs: 300,
    expired: false,
  });
  assert.deepEqual(state.operationBubbleSnapshot(record, { nowMs: 1600 }), {
    visible: false,
    html: "",
    remainingMs: 0,
    expired: true,
  });
});

test("thread tile state owns operation mode and signature policy", () => {
  assert.equal(state.normalizeOperationMode("expanded"), "expanded");
  assert.equal(state.normalizeOperationMode("unknown"), "compact");
  assert.equal(state.toggleOperationMode("expanded"), "compact");
  assert.equal(state.toggleOperationMode("compact"), "expanded");

  const record = state.operationBubbleRecord({
    threadId: "pane-1",
    html: "<button class=\"mobile-operation-bubble\">cmd</button>",
    nowMs: 1000,
    minVisibleMs: 500,
  });
  assert.deepEqual(state.operationSignature({
    mode: "expanded",
    remembered: record,
    nowMs: 1200,
    entrySignature: { type: "command", key: "k1" },
  }), {
    mode: "expanded",
    rememberedVisible: true,
    entry: { type: "command", key: "k1" },
  });
  assert.deepEqual(state.operationSignature({
    mode: "bad",
    remembered: record,
    nowMs: 1600,
    entrySignature: null,
  }), {
    mode: "compact",
    rememberedVisible: false,
    entry: null,
  });
});

test("thread tile state plans pane refresh scheduling without DOM state", () => {
  assert.deepEqual(state.refreshSchedulePlan({
    enabled: false,
    visibilityState: "visible",
    activeIds: ["a"],
  }, { defaultDelayMs: 1000 }), {
    schedule: false,
    clearTimer: true,
    reason: "disabled",
    activeIds: ["a"],
    delayMs: 0,
  });
  assert.deepEqual(state.refreshSchedulePlan({
    enabled: true,
    visibilityState: "hidden",
    activeIds: ["a"],
  }, { defaultDelayMs: 1000 }), {
    schedule: false,
    clearTimer: true,
    reason: "hidden",
    activeIds: ["a"],
    delayMs: 0,
  });
  assert.deepEqual(state.refreshSchedulePlan({
    enabled: true,
    visibilityState: "visible",
    activeIds: ["a", "a", "b"],
    hasTimer: false,
    delayMs: 200,
  }, { defaultDelayMs: 1000, minDelayMs: 500 }), {
    schedule: true,
    clearTimer: false,
    reason: "schedule",
    activeIds: ["a", "b"],
    delayMs: 500,
  });
  assert.deepEqual(state.refreshSchedulePlan({
    enabled: true,
    visibilityState: "visible",
    activeIds: ["a"],
    hasTimer: true,
  }, { defaultDelayMs: 1000 }), {
    schedule: false,
    clearTimer: false,
    reason: "timer-active",
    activeIds: ["a"],
    delayMs: 0,
  });
});

test("thread tile state chooses pane refresh targets without app globals", () => {
  assert.deepEqual(state.refreshTargetIds({
    enabled: false,
    ids: ["a", "b"],
  }), []);
  assert.deepEqual(state.refreshTargetIds({
    enabled: true,
    ids: ["a", "b", "a", "c"],
    visibleIds: ["a", "c"],
    currentThreadId: "a",
  }), ["c"]);
  assert.deepEqual(state.refreshTargetIds({
    enabled: true,
    ids: ["a", "b"],
    currentThreadId: "",
  }), ["a", "b"]);
});

test("thread tile state plans detail loads and skips stale work", () => {
  assert.deepEqual(state.detailLoadPlan({ threadId: "" }), {
    action: "skip",
    reason: "missing-id",
    id: "",
  });
  assert.deepEqual(state.detailLoadPlan({
    threadId: "a",
    currentThreadId: "a",
    currentThreadLoaded: true,
  }), {
    action: "skip",
    reason: "current-thread-loaded",
    id: "a",
  });
  assert.deepEqual(state.detailLoadPlan({
    threadId: "a",
    controllerActive: true,
  }), {
    action: "skip",
    reason: "controller-active",
    id: "a",
  });
  assert.deepEqual(state.detailLoadPlan({
    threadId: "a",
    cachedReady: true,
    force: false,
  }), {
    action: "skip",
    reason: "cached-ready",
    id: "a",
  });
  assert.deepEqual(state.detailLoadPlan({
    threadId: "a",
    cachedReady: true,
    force: true,
    backgroundRequested: true,
    lastLoadedAt: 1000,
    nowMs: 2000,
    minIntervalMs: 500,
  }), {
    action: "load",
    reason: "background-refresh",
    id: "a",
    background: true,
    markLoading: false,
    clearError: false,
  });
  assert.deepEqual(state.detailLoadPlan({
    threadId: "a",
    cachedReady: false,
    force: true,
    backgroundRequested: true,
    lastLoadedAt: 1000,
    nowMs: 1100,
    minIntervalMs: 500,
  }), {
    action: "skip",
    reason: "min-refresh-interval",
    id: "a",
  });
  assert.deepEqual(state.detailLoadPlan({
    threadId: "a",
    cachedReady: false,
  }), {
    action: "load",
    reason: "load",
    id: "a",
    background: false,
    markLoading: true,
    clearError: true,
  });

  assert.deepEqual(state.detailLoadStartEffectsPlan({
    action: "load",
    reason: "load",
    id: "a",
    background: false,
    markLoading: true,
    clearError: true,
  }), {
    action: "detail-load-start-effects",
    reason: "load",
    id: "a",
    background: false,
    setController: true,
    markLoading: true,
    clearError: true,
    renderPane: true,
    preserveScroll: true,
  });
  assert.deepEqual(state.detailLoadSuccessEffectsPlan({
    id: "a",
    hasThread: true,
    nowMs: 1234,
  }), {
    action: "detail-load-success-effects",
    reason: "thread-loaded",
    id: "a",
    setDetail: true,
    setLoadedAt: true,
    loadedAtMs: 1234,
    clearError: true,
    mergeThread: true,
  });
  assert.deepEqual(state.detailLoadErrorEffectsPlan({
    id: "a",
    errorMessage: "boom",
  }), {
    action: "detail-load-error-effects",
    reason: "foreground-error",
    id: "a",
    errorMessage: "boom",
  });
  assert.equal(state.detailLoadErrorEffectsPlan({
    id: "a",
    background: true,
    errorMessage: "hidden",
  }).reason, "background-refresh");
  assert.deepEqual(state.detailLoadFinallyEffectsPlan({
    id: "a",
    controllerMatches: true,
    visible: true,
  }), {
    action: "detail-load-finally-effects",
    reason: "settle",
    id: "a",
    clearController: true,
    clearLoading: true,
    renderPane: true,
    preserveScroll: true,
  });
});

test("thread tile state plans pane slot replacement without app globals", () => {
  assert.deepEqual(state.replacePaneThreadPlan({
    enabled: false,
    fromThreadId: "a",
    toThreadId: "d",
    ids: ["a", "b", "c"],
  }).action, "skip");

  assert.deepEqual(state.replacePaneThreadPlan({
    enabled: true,
    fromThreadId: "b",
    toThreadId: "d",
    ids: ["a", "b", "c"],
    pinnedIds: [],
  }, { maxPanes: 12 }), {
    action: "replace",
    reason: "replace-pane-thread",
    from: "b",
    to: "d",
    index: 1,
    duplicateIndex: -1,
    paneThreadIds: ["a", "d", "c"],
    selectedThreadId: "d",
    switchMenuPaneId: "",
    scrollResetIds: ["b", "d"],
    renderMode: "patch-source-pane",
    loadThreadId: "d",
  });

  assert.deepEqual(state.replacePaneThreadPlan({
    enabled: true,
    fromThreadId: "a",
    toThreadId: "c",
    ids: ["a", "b", "c"],
    pinnedIds: ["a", "b", "c"],
  }, { maxPanes: 12 }), {
    action: "replace",
    reason: "replace-pane-thread",
    from: "a",
    to: "c",
    index: 0,
    duplicateIndex: 2,
    paneThreadIds: ["c", "b", "a"],
    selectedThreadId: "c",
    switchMenuPaneId: "",
    scrollResetIds: ["a", "c"],
    renderMode: "full",
    loadThreadId: "c",
  });

  assert.equal(state.replacePaneThreadPlan({
    enabled: true,
    fromThreadId: "a",
    toThreadId: "a",
    ids: ["a", "b"],
  }).action, "select");
});

test("thread tile state plans pane moves and split pairs", () => {
  assert.deepEqual(state.movePaneRelativePlan({
    enabled: true,
    fromThreadId: "c",
    toThreadId: "a",
    placement: "before",
    ids: ["a", "b", "c"],
    splitPairs: [{ anchorId: "c", childId: "b" }, { anchorId: "a", childId: "b" }],
  }, {
    maxPanes: 12,
    normalizeSplitPairs: layout.normalizeSplitPairs,
  }), {
    action: "move",
    reason: "move-pane",
    from: "c",
    to: "a",
    placement: "before",
    paneThreadIds: ["c", "a", "b"],
    paneSplitPairs: [{ anchorId: "a", childId: "b" }],
    selectedThreadId: "c",
    switchMenuPaneId: "",
  });

  assert.deepEqual(state.splitPaneWithTargetPlan({
    enabled: true,
    fromThreadId: "c",
    toThreadId: "a",
    placement: "below",
    ids: ["a", "b", "c"],
    splitPairs: [],
  }, {
    maxPanes: 12,
    normalizeSplitPairs: layout.normalizeSplitPairs,
  }), {
    action: "split",
    reason: "split-pane",
    from: "c",
    to: "a",
    placement: "below",
    paneThreadIds: ["a", "c", "b"],
    paneSplitPairs: [{ anchorId: "a", childId: "c" }],
    selectedThreadId: "c",
    switchMenuPaneId: "",
  });
});

test("thread tile state plans thread-list pane replacement and drop intent", () => {
  assert.deepEqual(state.replaceLastPaneForThreadListOpenPlan({
    enabled: true,
    source: "thread-list",
    threadId: "d",
    ids: ["a", "b", "c"],
    pinnedIds: ["a", "b", "c"],
  }, { maxPanes: 12 }), {
    action: "replace-last",
    reason: "thread-list-open",
    from: "c",
    to: "d",
    index: 2,
    duplicateIndex: -1,
    paneThreadIds: ["a", "b", "d"],
    selectedThreadId: "d",
    switchMenuPaneId: "",
    scrollResetIds: ["c", "d"],
  });

  assert.equal(state.replaceLastPaneForThreadListOpenPlan({
    enabled: true,
    source: "search",
    threadId: "d",
    ids: ["a", "b", "c"],
  }).reason, "unsupported-source");

  assert.deepEqual(state.dropPaneIntent({
    fromThreadId: "a",
    toThreadId: "b",
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    clientX: 10,
    clientY: 40,
  }).action, "move-relative");
  assert.equal(state.dropPaneIntent({
    fromThreadId: "a",
    toThreadId: "b",
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    clientX: 90,
    clientY: 40,
  }).placement, "after");
  assert.deepEqual(state.dropPaneIntent({
    fromThreadId: "a",
    toThreadId: "b",
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    clientX: 50,
    clientY: 20,
  }).action, "split-with-target");
  assert.equal(state.dropPaneIntent({
    fromThreadId: "a",
    toThreadId: "b",
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    clientX: 50,
    clientY: 80,
  }).placement, "below");
});
