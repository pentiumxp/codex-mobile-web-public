"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const dock = require(path.resolve(__dirname, "..", "public", "live-operation-dock-state.js"));

test("live operation dock state keeps compact bubble for at least the minimum dwell", () => {
  const remembered = dock.rememberCompactBubble({
    html: "<button class=\"mobile-operation-bubble\">exec</button><div class=\"mobile-operation-sheet\"></div>",
    threadId: "thread-1",
    nowMs: 1000,
    minVisibleMs: 500,
  });

  assert.equal(remembered.visibleUntilMs, 1500);
  assert.equal(remembered.threadId, "thread-1");
  assert.equal(remembered.recallThreadId, "thread-1");
  assert.equal(remembered.recallAtMs, 1000);

  const preservation = dock.compactBubblePreservation({
    nextHtml: "",
    visibleUntilMs: remembered.visibleUntilMs,
    nowMs: 1200,
    savedHtml: remembered.html,
    savedThreadId: remembered.threadId,
    currentThreadId: "thread-1",
    dockHasBubble: false,
  });

  assert.equal(preservation.preserve, true);
  assert.equal(preservation.remainingMs, 300);
  assert.equal(preservation.patchSavedHtml, true);
  assert.match(preservation.savedHtml, /mobile-operation-bubble/);
});

test("live operation dock state does not preserve compact bubble after thread changes or dwell expires", () => {
  assert.equal(dock.compactBubblePreservation({
    nextHtml: "",
    visibleUntilMs: 1500,
    nowMs: 1200,
    savedHtml: "<button class=\"mobile-operation-bubble\"></button>",
    savedThreadId: "thread-1",
    currentThreadId: "thread-2",
    dockHasBubble: true,
  }).preserve, false);

  assert.equal(dock.compactBubblePreservation({
    nextHtml: "",
    visibleUntilMs: 1500,
    nowMs: 1600,
    savedHtml: "<button class=\"mobile-operation-bubble\"></button>",
    savedThreadId: "thread-1",
    currentThreadId: "thread-1",
    dockHasBubble: true,
  }).preserve, false);

  assert.equal(dock.compactBubblePreservation({
    nextHtml: "",
    visibleUntilMs: 1500,
    nowMs: 1200,
    savedHtml: "<button class=\"mobile-operation-bubble\"></button>",
    savedThreadId: "thread-1",
    currentThreadId: "thread-1",
    dockHasBubble: true,
    liveTurnActive: false,
  }).preserve, false);
});

test("live operation dock state preserves pinned sheet and recall only under same-thread rules", () => {
  assert.equal(dock.shouldPreservePinned({
    pinned: true,
    mode: "expanded",
    pinnedThreadId: "thread-1",
    currentThreadId: "thread-1",
    dockHasSheet: true,
    nextHtml: "",
  }), true);
  assert.equal(dock.shouldPreservePinned({
    pinned: true,
    mode: "expanded",
    pinnedThreadId: "thread-1",
    currentThreadId: "thread-1",
    dockHasSheet: true,
    nextHtml: "<button class=\"mobile-operation-bubble\"></button>",
  }), false);
  assert.equal(dock.shouldPreservePinned({
    pinned: true,
    mode: "expanded",
    pinnedThreadId: "thread-1",
    currentThreadId: "thread-1",
    dockHasSheet: true,
    nextHtml: "",
    liveTurnActive: false,
  }), false);

  assert.equal(dock.shouldShowRecall({
    isMobile: true,
    hasCurrentThread: true,
    newThreadDraft: false,
    currentThreadId: "thread-1",
    recallThreadId: "thread-1",
    recallHtml: "<div class=\"mobile-operation-sheet\"></div>",
  }), true);
  assert.equal(dock.shouldShowRecall({
    isMobile: true,
    hasCurrentThread: true,
    newThreadDraft: true,
    currentThreadId: "thread-1",
    recallThreadId: "thread-1",
    recallHtml: "<div class=\"mobile-operation-sheet\"></div>",
  }), false);
  assert.equal(dock.shouldShowRecall({
    isMobile: true,
    hasCurrentThread: true,
    newThreadDraft: false,
    currentThreadId: "thread-1",
    recallThreadId: "thread-1",
    recallHtml: "<div class=\"mobile-operation-sheet\"></div>",
    liveTurnActive: false,
  }), false);
});

test("live operation dock state plans operation card content without DOM or HTML escaping", () => {
  assert.deepEqual(dock.operationCardContentPlan({
    itemId: "cmd-1",
    type: "commandExecution",
    status: "running",
    title: "Command",
    detail: "npm   test",
    durationText: "00:00:05",
    durationAttrs: "data-started-at-ms=\"1\" data-ended-at-ms=\"6\"",
    extraClass: "mobile-operation-sheet-card",
  }), {
    itemId: "cmd-1",
    type: "commandExecution",
    status: "running",
    title: "Command",
    detail: "npm test",
    detailEmpty: false,
    statusVisible: true,
    durationVisible: true,
    durationText: "00:00:05",
    durationTitle: "Elapsed 00:00:05",
    durationAttrs: "data-started-at-ms=\"1\" data-ended-at-ms=\"6\"",
    classTokens: ["item", "live-operation", "mobile-operation-sheet-card", "commandExecution"],
  });

  assert.deepEqual(dock.operationCardContentPlan({
    itemId: "cmd-2",
    type: "commandExecution",
    status: "completed",
    title: "Command",
  }), {
    itemId: "cmd-2",
    type: "commandExecution",
    status: "completed",
    title: "Command",
    detail: "",
    detailEmpty: true,
    statusVisible: true,
    durationVisible: false,
    durationText: "",
    durationTitle: "",
    durationAttrs: "",
    classTokens: ["item", "live-operation", "completed", "commandExecution"],
  });
});
