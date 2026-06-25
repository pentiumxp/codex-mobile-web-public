"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexThreadTileActions = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  const TILE_CONTROL_SELECTOR = [
    "[data-thread-tile-switch-target]",
    ".thread-tile-switch-menu",
    "[data-thread-tile-bottom]",
    "[data-thread-tile-operation-toggle]",
    "[data-thread-tile-pane-count]",
    "[data-thread-tile-close-pane]",
  ].join(", ");

  function withinRoot(root, node) {
    if (!root || !node || typeof root.contains !== "function") return true;
    return root.contains(node);
  }

  function closestWithin(target, selector, root = null) {
    if (!target || typeof target.closest !== "function") return null;
    const node = target.closest(selector);
    if (!node || !withinRoot(root, node)) return null;
    return node;
  }

  function attr(node, name) {
    if (!node || typeof node.getAttribute !== "function") return "";
    return String(node.getAttribute(name) || "");
  }

  function paneFor(node, root = null) {
    return closestWithin(node, "[data-thread-tile-pane]", root);
  }

  function paneIdFor(node, root = null) {
    return attr(paneFor(node, root), "data-thread-tile-pane");
  }

  function action(type, target, fields = {}) {
    return Object.assign({
      action: String(type || "none"),
      target: target || null,
      preventDefault: false,
      stopPropagation: false,
    }, fields);
  }

  function resolveThreadTilePointerAction(input = {}) {
    const target = input.target || null;
    const root = input.root || null;
    const title = closestWithin(target, "[data-thread-tile-title]", root);
    if (title) {
      return action("select-pane", title, {
        paneId: paneIdFor(title, root),
        source: "title",
      });
    }
    const control = closestWithin(target, TILE_CONTROL_SELECTOR, root);
    if (control) return action("stop-control", control, { stopPropagation: true });
    const pane = closestWithin(target, "[data-thread-tile-pane]", root);
    if (pane) return action("select-pane", pane, { paneId: attr(pane, "data-thread-tile-pane"), source: "pane" });
    return action("none", null, { reason: "no-match" });
  }

  function resolveThreadTileFocusAction(input = {}) {
    const target = input.target || null;
    const root = input.root || null;
    const ignored = closestWithin(target, "[data-thread-tile-title], [data-thread-tile-switch-target], .thread-tile-switch-menu", root);
    if (ignored) return action("none", ignored, { reason: "ignored-control" });
    const pane = closestWithin(target, "[data-thread-tile-pane]", root);
    if (pane) return action("select-pane", pane, { paneId: attr(pane, "data-thread-tile-pane"), source: "focus" });
    return action("none", null, { reason: "no-match" });
  }

  function resolveThreadTileClickAction(input = {}) {
    const target = input.target || null;
    const root = input.root || null;
    let node = closestWithin(target, "[data-thread-tile-title]", root);
    if (node) {
      return action("toggle-switch-menu", node, {
        paneId: attr(node, "data-thread-tile-title"),
        preventDefault: true,
        stopPropagation: true,
      });
    }
    node = closestWithin(target, "[data-thread-tile-switch-target]", root);
    if (node) {
      return action("switch-pane-thread", node, {
        fromId: paneIdFor(node, root),
        toId: attr(node, "data-thread-tile-switch-target"),
        preventDefault: true,
        stopPropagation: true,
      });
    }
    node = closestWithin(target, "[data-thread-tile-pane-count]", root);
    if (node) {
      return action("change-pane-count", node, {
        delta: Number(attr(node, "data-thread-tile-pane-count") || 0),
        disabled: Boolean(node.disabled),
        preventDefault: true,
        stopPropagation: true,
      });
    }
    node = closestWithin(target, "[data-thread-tile-close-pane]", root);
    if (node) {
      return action("close-pane", node, {
        paneId: attr(node, "data-thread-tile-close-pane"),
        disabled: Boolean(node.disabled),
        preventDefault: true,
        stopPropagation: true,
      });
    }
    node = closestWithin(target, "[data-thread-tile-bottom]", root);
    if (node) {
      return action("scroll-pane-bottom", node, {
        paneId: attr(node, "data-thread-tile-bottom"),
        preventDefault: true,
      });
    }
    node = closestWithin(target, "[data-thread-tile-operation-toggle]", root);
    if (node) {
      return action("toggle-operation", node, {
        paneId: attr(node, "data-thread-tile-operation-toggle"),
        preventDefault: true,
        stopPropagation: true,
      });
    }
    return action("none", null, { reason: "no-match" });
  }

  function resolveThreadTileScrollAction(input = {}) {
    const body = closestWithin(input.target || null, ".thread-tile-pane-body", input.root || null);
    if (body) return action("pane-scroll", body, { body });
    return action("none", null, { reason: "no-match" });
  }

  function resolveThreadTileDragStartAction(input = {}) {
    const handle = closestWithin(input.target || null, "[data-thread-tile-drag-handle]", input.root || null);
    if (!handle) return action("none", null, { reason: "no-handle" });
    const paneId = attr(handle, "data-thread-tile-drag-handle");
    if (!paneId) return action("none", handle, { reason: "missing-pane-id" });
    return action("drag-start", handle, {
      handle,
      paneId,
      pane: paneFor(handle, input.root || null),
    });
  }

  function resolveThreadTileDragOverAction(input = {}) {
    const root = input.root || null;
    const pane = closestWithin(input.target || null, "[data-thread-tile-pane]", root);
    const dragging = String(input.draggingId || "");
    const targetId = attr(pane, "data-thread-tile-pane");
    if (!dragging || !targetId || dragging === targetId || !pane) {
      return action("none", pane, { reason: "invalid-drag-target" });
    }
    return action("drag-over", pane, { pane, targetId, preventDefault: true });
  }

  function resolveThreadTileDragLeaveAction(input = {}) {
    const pane = closestWithin(input.target || null, "[data-thread-tile-pane]", input.root || null);
    if (pane) return action("drag-leave", pane, { pane });
    return action("none", null, { reason: "no-match" });
  }

  function resolveThreadTileDropAction(input = {}) {
    const root = input.root || null;
    const pane = closestWithin(input.target || null, "[data-thread-tile-pane]", root);
    const dragging = String(input.draggingId || input.transferId || "");
    const targetId = attr(pane, "data-thread-tile-pane");
    if (!dragging || !targetId || dragging === targetId || !pane) {
      return action("none", pane, { reason: "invalid-drop-target" });
    }
    return action("drop-pane", pane, {
      pane,
      draggingId: dragging,
      targetId,
      preventDefault: true,
      stopPropagation: true,
    });
  }

  return {
    closestWithin,
    resolveThreadTilePointerAction,
    resolveThreadTileFocusAction,
    resolveThreadTileClickAction,
    resolveThreadTileScrollAction,
    resolveThreadTileDragStartAction,
    resolveThreadTileDragOverAction,
    resolveThreadTileDragLeaveAction,
    resolveThreadTileDropAction,
  };
}));
