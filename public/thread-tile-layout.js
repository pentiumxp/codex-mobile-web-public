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
  const DEFAULT_MIN_DESKTOP_MANUAL_PANE_WIDTH = 300;
  const DEFAULT_MIN_TABLET_PANE_WIDTH = 260;
  const DEFAULT_MIN_LANDSCAPE_VIEWPORT_WIDTH = 760;
  const DEFAULT_MIN_PANE_HEIGHT = 360;
  const DEFAULT_MIN_LANDSCAPE_VIEWPORT_HEIGHT = 480;
  const DEFAULT_MAX_PANES = 6;
  const DEFAULT_USER_MAX_PANES = 12;

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
    const minLandscapeViewportWidth = positiveNumber(input.minLandscapeViewportWidth, DEFAULT_MIN_LANDSCAPE_VIEWPORT_WIDTH);
    const minLandscapeViewportHeight = positiveNumber(input.minLandscapeViewportHeight, DEFAULT_MIN_LANDSCAPE_VIEWPORT_HEIGHT);
    const landscapeTile = orientation === "landscape" && viewportWidth >= minLandscapeViewportWidth && viewportHeight >= minLandscapeViewportHeight;
    const menuOverlay = input.menuOverlay === true;
    const tabletLandscape = landscapeTile && (coarsePointer || menuOverlay);
    const maxPanes = clampInteger(input.maxPanes || DEFAULT_MAX_PANES, 1, DEFAULT_USER_MAX_PANES);
    const recommendedMaxPanes = clampInteger(input.recommendedMaxPanes || DEFAULT_MAX_PANES, 1, maxPanes);
    const desiredPaneCount = Math.max(0, Math.min(
      maxPanes,
      Math.floor(Number(input.desiredPaneCount || 0)) || 0,
    ));
    if (!enabled || viewportWidth <= 0 || viewportHeight <= 0) {
      return { enabled: false, reason: "disabled", columns: 1, rows: 1, maxPanes: 1, recommendedMaxPanes: 1 };
    }
    if (coarsePointer && orientation !== "landscape") {
      return { enabled: false, reason: "tablet-portrait", columns: 1, rows: 1, maxPanes: 1, recommendedMaxPanes: 1 };
    }
    if (menuOverlay && !tabletLandscape) {
      return { enabled: false, reason: "narrow", columns: 1, rows: 1, maxPanes: 1, recommendedMaxPanes: 1 };
    }

    const availableWidth = Math.max(0, viewportWidth - (menuOverlay ? 0 : sidebarWidth));
    const availableHeight = Math.max(0, viewportHeight - Math.max(0, Number(input.verticalChromePx || 0) || 0));
    const manualTargetWidth = desiredPaneCount > 0 && availableWidth > 0
      ? Math.floor(availableWidth / desiredPaneCount)
      : 0;
    const defaultMinPaneWidth = tabletLandscape
      ? DEFAULT_MIN_TABLET_PANE_WIDTH
      : (desiredPaneCount > 0
        ? Math.min(DEFAULT_MIN_DESKTOP_PANE_WIDTH, Math.max(DEFAULT_MIN_DESKTOP_MANUAL_PANE_WIDTH, manualTargetWidth))
        : DEFAULT_MIN_DESKTOP_PANE_WIDTH);
    const minPaneWidth = positiveNumber(input.minPaneWidth, defaultMinPaneWidth);
    const minPaneHeight = positiveNumber(input.minPaneHeight, DEFAULT_MIN_PANE_HEIGHT);
    const rawColumns = Math.floor(availableWidth / minPaneWidth);
    const rawRows = Math.floor(availableHeight / minPaneHeight);
    const minimumColumns = tabletLandscape ? 2 : 2;
    const maximumColumns = tabletLandscape ? Math.min(4, maxPanes) : maxPanes;
    const columns = Math.max(minimumColumns, Math.min(maximumColumns, rawColumns || 0));
    if (columns < minimumColumns || availableWidth < minPaneWidth * minimumColumns * 0.86) {
      return { enabled: false, reason: "insufficient-width", columns: 1, rows: 1, maxPanes: 1, recommendedMaxPanes: 1, availableWidth, availableHeight };
    }
    const rows = Math.max(1, Math.min(tabletLandscape ? 1 : 2, rawRows || 1));
    return {
      enabled: true,
      reason: tabletLandscape ? "tablet-landscape" : "wide",
      columns,
      rows,
      maxPanes: Math.max(1, Math.min(maxPanes, columns * rows)),
      recommendedMaxPanes: Math.max(1, Math.min(recommendedMaxPanes, columns * rows)),
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

  function selectPinnedThreadTileIds(input = {}) {
    const maxPanes = clampInteger(input.maxPanes || 1, 1, 12);
    const currentThreadId = String(input.currentThreadId || "").trim();
    const ids = uniqueThreadIds([
      ...(Array.isArray(input.pinnedThreadIds) ? input.pinnedThreadIds : []),
      ...(Array.isArray(input.threadIds) ? input.threadIds : []),
    ]).slice(0, maxPanes);
    if (!currentThreadId || ids.includes(currentThreadId)) return ids;
    if (ids.length >= maxPanes) ids[Math.max(0, maxPanes - 1)] = currentThreadId;
    else ids.push(currentThreadId);
    return uniqueThreadIds(ids).slice(0, maxPanes);
  }

  function normalizeSplitPairs(values = [], ids = []) {
    const idSet = new Set(uniqueThreadIds(ids));
    const used = new Set();
    const pairs = [];
    for (const value of Array.isArray(values) ? values : []) {
      const anchorId = String(Array.isArray(value) ? value[0] : value && (value.anchorId || value.topId || value.primaryId) || "").trim();
      const childId = String(Array.isArray(value) ? value[1] : value && (value.childId || value.bottomId || value.secondaryId) || "").trim();
      if (!anchorId || !childId || anchorId === childId) continue;
      if (idSet.size && (!idSet.has(anchorId) || !idSet.has(childId))) continue;
      if (used.has(anchorId) || used.has(childId)) continue;
      used.add(anchorId);
      used.add(childId);
      pairs.push({ anchorId, childId });
    }
    return pairs;
  }

  function threadTileColumnGroups(input = {}) {
    const ids = uniqueThreadIds(input.ids || input.threadIds || []);
    const columns = clampInteger(input.columns || 1, 1, DEFAULT_USER_MAX_PANES);
    if (!ids.length) return [];
    const pairs = normalizeSplitPairs(input.splitPairs || input.paneSplitPairs || [], ids);
    const pairByAnchor = new Map(pairs.map((pair) => [pair.anchorId, pair.childId]));
    const childIds = new Set(pairs.map((pair) => pair.childId));
    const atomicGroups = [];
    for (const id of ids) {
      if (childIds.has(id)) continue;
      const childId = pairByAnchor.get(id);
      atomicGroups.push(childId ? [id, childId] : [id]);
    }
    const targetColumns = Math.max(1, Math.min(columns, atomicGroups.length));
    const groups = atomicGroups.slice(0, targetColumns).map((group) => group.slice());
    const overflow = atomicGroups.slice(targetColumns);
    overflow.forEach((group, index) => {
      const targetIndex = Math.max(0, targetColumns - 1 - (index % targetColumns));
      groups[targetIndex].push(...group);
    });
    return groups.filter((group) => group.length);
  }

  return {
    DEFAULT_MAX_PANES,
    DEFAULT_USER_MAX_PANES,
    DEFAULT_MIN_DESKTOP_MANUAL_PANE_WIDTH,
    DEFAULT_MIN_DESKTOP_PANE_WIDTH,
    DEFAULT_MIN_LANDSCAPE_VIEWPORT_WIDTH,
    DEFAULT_MIN_LANDSCAPE_VIEWPORT_HEIGHT,
    DEFAULT_MIN_PANE_HEIGHT,
    DEFAULT_MIN_TABLET_PANE_WIDTH,
    layoutForViewport,
    normalizeSplitPairs,
    selectPinnedThreadTileIds,
    selectThreadTileIds,
    threadTileColumnGroups,
  };
}));
