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
