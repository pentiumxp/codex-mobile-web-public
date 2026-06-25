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
