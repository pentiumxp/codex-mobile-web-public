"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const tile = require(path.resolve(__dirname, "..", "public", "thread-tile-layout.js"));

test("thread tile layout is disabled until explicitly enabled", () => {
  const layout = tile.layoutForViewport({
    enabled: false,
    viewportWidth: 1800,
    viewportHeight: 1000,
    sidebarWidth: 520,
  });

  assert.equal(layout.enabled, false);
  assert.equal(layout.reason, "disabled");
});

test("thread tile layout uses multiple desktop panes when width allows", () => {
  const layout = tile.layoutForViewport({
    enabled: true,
    viewportWidth: 2200,
    viewportHeight: 1200,
    sidebarWidth: 520,
    coarsePointer: false,
    menuOverlay: false,
  });

  assert.equal(layout.enabled, true);
  assert.equal(layout.columns, 4);
  assert.equal(layout.rows, 2);
  assert.equal(layout.maxPanes, 6);
});

test("thread tile layout exposes a separate user pane ceiling", () => {
  assert.equal(tile.DEFAULT_MAX_PANES, 6);
  assert.equal(tile.DEFAULT_USER_MAX_PANES, 12);
});

test("thread tile layout keeps iPad portrait in single-thread mode", () => {
  const layout = tile.layoutForViewport({
    enabled: true,
    viewportWidth: 820,
    viewportHeight: 1180,
    sidebarWidth: 0,
    coarsePointer: true,
    orientation: "portrait",
    menuOverlay: true,
  });

  assert.equal(layout.enabled, false);
  assert.equal(layout.reason, "tablet-portrait");
});

test("thread tile layout gives iPad landscape at least two panes and up to three", () => {
  const twoPane = tile.layoutForViewport({
    enabled: true,
    viewportWidth: 1024,
    viewportHeight: 768,
    sidebarWidth: 368,
    coarsePointer: true,
    orientation: "landscape",
    menuOverlay: false,
  });
  const threePane = tile.layoutForViewport({
    enabled: true,
    viewportWidth: 1366,
    viewportHeight: 1024,
    sidebarWidth: 400,
    coarsePointer: true,
    orientation: "landscape",
    menuOverlay: false,
  });

  assert.equal(twoPane.enabled, true);
  assert.equal(twoPane.columns, 2);
  assert.equal(threePane.enabled, true);
  assert.equal(threePane.columns, 3);
});

test("thread tile layout keeps iPad embedded landscape available below split height", () => {
  const embeddedLandscape = tile.layoutForViewport({
    enabled: true,
    viewportWidth: 1024,
    viewportHeight: 560,
    sidebarWidth: 0,
    coarsePointer: true,
    orientation: "landscape",
    menuOverlay: true,
  });
  const desktopPointerIpad = tile.layoutForViewport({
    enabled: true,
    viewportWidth: 1024,
    viewportHeight: 700,
    sidebarWidth: 0,
    coarsePointer: false,
    orientation: "landscape",
    menuOverlay: true,
  });

  assert.equal(embeddedLandscape.enabled, true);
  assert.equal(embeddedLandscape.reason, "tablet-landscape");
  assert.equal(embeddedLandscape.columns, 3);
  assert.equal(desktopPointerIpad.enabled, true);
  assert.equal(desktopPointerIpad.reason, "tablet-landscape");
  assert.equal(desktopPointerIpad.columns, 3);
});

test("thread tile layout supports narrower Home AI iPad landscape with three panes", () => {
  const layout = tile.layoutForViewport({
    enabled: true,
    viewportWidth: 820,
    viewportHeight: 620,
    sidebarWidth: 0,
    coarsePointer: true,
    orientation: "landscape",
    menuOverlay: true,
  });

  assert.equal(layout.enabled, true);
  assert.equal(layout.reason, "tablet-landscape");
  assert.equal(layout.columns, 3);
  assert.equal(layout.maxPanes, 3);
});

test("thread tile layout gives iPad Pro 11 landscape three panes after sidebar", () => {
  const layout = tile.layoutForViewport({
    enabled: true,
    viewportWidth: 1194,
    viewportHeight: 834,
    sidebarWidth: 360,
    coarsePointer: true,
    orientation: "landscape",
    menuOverlay: false,
  });

  assert.equal(layout.enabled, true);
  assert.equal(layout.reason, "tablet-landscape");
  assert.equal(layout.columns, 3);
  assert.equal(layout.maxPanes, 3);
});

test("thread tile layout allows four panes on wide Android tablets", () => {
  const layout = tile.layoutForViewport({
    enabled: true,
    viewportWidth: 1500,
    viewportHeight: 900,
    sidebarWidth: 0,
    coarsePointer: true,
    orientation: "landscape",
    menuOverlay: true,
  });

  assert.equal(layout.enabled, true);
  assert.equal(layout.reason, "tablet-landscape");
  assert.equal(layout.columns, 4);
  assert.equal(layout.maxPanes, 4);
});

test("thread tile id selection starts with current thread then fills recents", () => {
  assert.deepEqual(tile.selectThreadTileIds({
    currentThreadId: "thread-2",
    pinnedThreadIds: ["thread-3", "thread-2"],
    threadIds: ["thread-1", "thread-3", "thread-4"],
    maxPanes: 3,
  }), ["thread-2", "thread-3", "thread-1"]);
});

test("thread tile id selection can fill the user pane ceiling", () => {
  const threadIds = Array.from({ length: 16 }, (_, index) => `thread-${index + 1}`);

  assert.deepEqual(tile.selectThreadTileIds({
    currentThreadId: "thread-0",
    threadIds,
    maxPanes: tile.DEFAULT_USER_MAX_PANES,
  }), [
    "thread-0",
    "thread-1",
    "thread-2",
    "thread-3",
    "thread-4",
    "thread-5",
    "thread-6",
    "thread-7",
    "thread-8",
    "thread-9",
    "thread-10",
    "thread-11",
  ]);
});
