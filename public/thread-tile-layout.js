"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexThreadTileLayout = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  const DEFAULT_MIN_DESKTOP_PANE_WIDTH = 420;
  const DEFAULT_MIN_TABLET_PANE_WIDTH = 300;
  const DEFAULT_MIN_PANE_HEIGHT = 360;
  const DEFAULT_MAX_PANES = 6;

  function positiveNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function clampInteger(value, min, max) {
    const parsed = Math.floor(positiveNumber(value, min));
    return Math.max(min, Math.min(max, parsed));
  }

  function viewportOrientation(width, height) {
    return positiveNumber(width) >= positiveNumber(height) ? "landscape" : "portrait";
  }

  function layoutForViewport(input = {}) {
    const enabled = input.enabled === true;
    const viewportWidth = positiveNumber(input.viewportWidth);
    const viewportHeight = positiveNumber(input.viewportHeight);
    const sidebarWidth = Math.max(0, Number(input.sidebarWidth || 0) || 0);
    const coarsePointer = input.coarsePointer === true;
    const orientation = String(input.orientation || viewportOrientation(viewportWidth, viewportHeight));
    const tabletLandscape = coarsePointer && orientation === "landscape" && viewportWidth >= 900 && viewportHeight >= 600;
    const menuOverlay = input.menuOverlay === true;
    const maxPanes = clampInteger(input.maxPanes || DEFAULT_MAX_PANES, 1, 12);
    if (!enabled || viewportWidth <= 0 || viewportHeight <= 0) {
      return { enabled: false, reason: "disabled", columns: 1, rows: 1, maxPanes: 1 };
    }
    if (coarsePointer && orientation !== "landscape") {
      return { enabled: false, reason: "tablet-portrait", columns: 1, rows: 1, maxPanes: 1 };
    }
    if (menuOverlay && !tabletLandscape) {
      return { enabled: false, reason: "narrow", columns: 1, rows: 1, maxPanes: 1 };
    }

    const minPaneWidth = positiveNumber(input.minPaneWidth, tabletLandscape ? DEFAULT_MIN_TABLET_PANE_WIDTH : DEFAULT_MIN_DESKTOP_PANE_WIDTH);
    const minPaneHeight = positiveNumber(input.minPaneHeight, DEFAULT_MIN_PANE_HEIGHT);
    const availableWidth = Math.max(0, viewportWidth - (menuOverlay ? 0 : sidebarWidth));
    const availableHeight = Math.max(0, viewportHeight - Math.max(0, Number(input.verticalChromePx || 0) || 0));
    const rawColumns = Math.floor(availableWidth / minPaneWidth);
    const rawRows = Math.floor(availableHeight / minPaneHeight);
    const minimumColumns = tabletLandscape ? 2 : 2;
    const maximumColumns = tabletLandscape ? 3 : 4;
    const columns = Math.max(minimumColumns, Math.min(maximumColumns, rawColumns || 0));
    if (columns < minimumColumns || availableWidth < minPaneWidth * minimumColumns * 0.86) {
      return { enabled: false, reason: "insufficient-width", columns: 1, rows: 1, maxPanes: 1, availableWidth, availableHeight };
    }
    const rows = Math.max(1, Math.min(tabletLandscape ? 1 : 2, rawRows || 1));
    return {
      enabled: true,
      reason: tabletLandscape ? "tablet-landscape" : "wide",
      columns,
      rows,
      maxPanes: Math.max(1, Math.min(maxPanes, columns * rows)),
      availableWidth,
      availableHeight,
      minPaneWidth,
      minPaneHeight,
    };
  }

  function uniqueThreadIds(values = []) {
    const seen = new Set();
    const ids = [];
    for (const value of values || []) {
      const id = String(value || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }

  function selectThreadTileIds(input = {}) {
    const maxPanes = clampInteger(input.maxPanes || 1, 1, 12);
    const ids = uniqueThreadIds([
      input.currentThreadId,
      ...(Array.isArray(input.pinnedThreadIds) ? input.pinnedThreadIds : []),
      ...(Array.isArray(input.threadIds) ? input.threadIds : []),
    ]);
    return ids.slice(0, maxPanes);
  }

  return {
    DEFAULT_MAX_PANES,
    DEFAULT_MIN_DESKTOP_PANE_WIDTH,
    DEFAULT_MIN_PANE_HEIGHT,
    DEFAULT_MIN_TABLET_PANE_WIDTH,
    layoutForViewport,
    selectThreadTileIds,
  };
}));
