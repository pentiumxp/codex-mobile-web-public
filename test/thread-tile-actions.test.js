"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const actions = require(path.resolve(__dirname, "..", "public", "thread-tile-actions.js"));

function node(name, attrs = {}, options = {}) {
  const matches = new Map();
  const entry = {
    name,
    disabled: options.disabled === true,
    getAttribute(key) {
      return Object.prototype.hasOwnProperty.call(attrs, key) ? attrs[key] : "";
    },
    closest(selector) {
      return matches.get(selector) || null;
    },
  };
  entry.match = (selector, value = entry) => {
    matches.set(selector, value);
    return entry;
  };
  return entry;
}

function targetWith(matches = {}) {
  return {
    closest(selector) {
      return matches[selector] || null;
    },
  };
}

function rootContaining(...nodes) {
  const allowed = new Set(nodes);
  return {
    contains(candidate) {
      return allowed.has(candidate);
    },
  };
}

test("thread tile pointer actions select panes and stop tile controls", () => {
  const pane = node("pane", { "data-thread-tile-pane": "thread-a" });
  const title = node("title", { "data-thread-tile-title": "thread-a" })
    .match("[data-thread-tile-pane]", pane);
  const titleTarget = targetWith({
    "[data-thread-tile-title]": title,
    "[data-thread-tile-pane]": pane,
  });
  assert.deepEqual(actions.resolveThreadTilePointerAction({
    root: rootContaining(title, pane),
    target: titleTarget,
  }), {
    action: "select-pane",
    target: title,
    preventDefault: false,
    stopPropagation: false,
    paneId: "thread-a",
    source: "title",
  });

  const bottom = node("bottom", { "data-thread-tile-bottom": "thread-a" });
  const controlTarget = targetWith({
    "[data-thread-tile-switch-target], .thread-tile-switch-menu, [data-thread-tile-bottom], [data-thread-tile-operation-toggle], [data-thread-tile-pane-count], [data-thread-tile-close-pane]": bottom,
  });
  const stopPlan = actions.resolveThreadTilePointerAction({
    root: rootContaining(bottom),
    target: controlTarget,
  });
  assert.equal(stopPlan.action, "stop-control");
  assert.equal(stopPlan.stopPropagation, true);
});

test("thread tile focus ignores controls and selects pane bodies", () => {
  const title = node("title", { "data-thread-tile-title": "thread-a" });
  const ignored = actions.resolveThreadTileFocusAction({
    root: rootContaining(title),
    target: targetWith({ "[data-thread-tile-title], [data-thread-tile-switch-target], .thread-tile-switch-menu": title }),
  });
  assert.equal(ignored.action, "none");
  assert.equal(ignored.reason, "ignored-control");

  const pane = node("pane", { "data-thread-tile-pane": "thread-b" });
  const selected = actions.resolveThreadTileFocusAction({
    root: rootContaining(pane),
    target: targetWith({ "[data-thread-tile-pane]": pane }),
  });
  assert.equal(selected.action, "select-pane");
  assert.equal(selected.paneId, "thread-b");
});

test("thread tile click actions classify switch, count, close, bottom, and operation controls", () => {
  const pane = node("pane", { "data-thread-tile-pane": "from-thread" });
  const option = node("option", { "data-thread-tile-switch-target": "to-thread" })
    .match("[data-thread-tile-pane]", pane);
  const switchPlan = actions.resolveThreadTileClickAction({
    root: rootContaining(option, pane),
    target: targetWith({
      "[data-thread-tile-switch-target]": option,
      "[data-thread-tile-pane]": pane,
    }),
  });
  assert.equal(switchPlan.action, "switch-pane-thread");
  assert.equal(switchPlan.fromId, "from-thread");
  assert.equal(switchPlan.toId, "to-thread");
  assert.equal(switchPlan.preventDefault, true);
  assert.equal(switchPlan.stopPropagation, true);

  const count = node("count", { "data-thread-tile-pane-count": "1" }, { disabled: true });
  const countPlan = actions.resolveThreadTileClickAction({
    root: rootContaining(count),
    target: targetWith({ "[data-thread-tile-pane-count]": count }),
  });
  assert.equal(countPlan.action, "change-pane-count");
  assert.equal(countPlan.delta, 1);
  assert.equal(countPlan.disabled, true);

  const close = node("close", { "data-thread-tile-close-pane": "thread-a" });
  assert.equal(actions.resolveThreadTileClickAction({
    root: rootContaining(close),
    target: targetWith({ "[data-thread-tile-close-pane]": close }),
  }).action, "close-pane");

  const bottom = node("bottom", { "data-thread-tile-bottom": "thread-a" });
  const bottomPlan = actions.resolveThreadTileClickAction({
    root: rootContaining(bottom),
    target: targetWith({ "[data-thread-tile-bottom]": bottom }),
  });
  assert.equal(bottomPlan.action, "scroll-pane-bottom");
  assert.equal(bottomPlan.preventDefault, true);
  assert.equal(bottomPlan.stopPropagation, false);

  const operation = node("operation", { "data-thread-tile-operation-toggle": "thread-c" });
  const operationPlan = actions.resolveThreadTileClickAction({
    root: rootContaining(operation),
    target: targetWith({ "[data-thread-tile-operation-toggle]": operation }),
  });
  assert.equal(operationPlan.action, "toggle-operation");
  assert.equal(operationPlan.paneId, "thread-c");
});

test("thread tile drag actions classify valid drag lifecycle events", () => {
  const paneA = node("pane-a", { "data-thread-tile-pane": "a" });
  const paneB = node("pane-b", { "data-thread-tile-pane": "b" });
  const handle = node("handle", { "data-thread-tile-drag-handle": "a" })
    .match("[data-thread-tile-pane]", paneA);

  const start = actions.resolveThreadTileDragStartAction({
    root: rootContaining(handle, paneA, paneB),
    target: targetWith({ "[data-thread-tile-drag-handle]": handle }),
  });
  assert.equal(start.action, "drag-start");
  assert.equal(start.paneId, "a");
  assert.equal(start.pane, paneA);

  const over = actions.resolveThreadTileDragOverAction({
    root: rootContaining(handle, paneA, paneB),
    target: targetWith({ "[data-thread-tile-pane]": paneB }),
    draggingId: "a",
  });
  assert.equal(over.action, "drag-over");
  assert.equal(over.targetId, "b");
  assert.equal(over.preventDefault, true);

  const drop = actions.resolveThreadTileDropAction({
    root: rootContaining(handle, paneA, paneB),
    target: targetWith({ "[data-thread-tile-pane]": paneB }),
    draggingId: "",
    transferId: "a",
  });
  assert.equal(drop.action, "drop-pane");
  assert.equal(drop.draggingId, "a");
  assert.equal(drop.targetId, "b");
  assert.equal(drop.stopPropagation, true);
});

test("thread tile actions reject matches outside the supplied root", () => {
  const pane = node("outside-pane", { "data-thread-tile-pane": "outside" });
  const plan = actions.resolveThreadTileFocusAction({
    root: rootContaining(),
    target: targetWith({ "[data-thread-tile-pane]": pane }),
  });
  assert.equal(plan.action, "none");
  assert.equal(plan.reason, "no-match");
});
