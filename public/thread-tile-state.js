"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexThreadTileState = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  const DEFAULT_USER_MAX_PANES = 12;
  const DEFAULT_OPERATION_BUBBLE_MIN_VISIBLE_MS = 500;

  function text(value) {
    return String(value || "");
  }

  function nowValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  function maxPaneLimit(maxPanes = DEFAULT_USER_MAX_PANES) {
    const parsed = Math.floor(Number(maxPanes));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USER_MAX_PANES;
  }

  function normalizePaneCount(value, options = {}) {
    const fallback = Number.isFinite(Number(options.fallback)) ? Math.floor(Number(options.fallback)) : 0;
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.min(maxPaneLimit(options.maxPanes), parsed));
  }

  function normalizePinnedIds(values = [], options = {}) {
    const seen = new Set();
    const ids = [];
    const limit = Math.max(1, maxPaneLimit(options.maxPanes) * Math.max(1, Number(options.overflowMultiplier || 2) || 2));
    for (const value of Array.isArray(values) ? values : []) {
      const id = String(value || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      if (ids.length >= limit) break;
    }
    return ids;
  }

  function uniqueIds(values = []) {
    const seen = new Set();
    const ids = [];
    for (const value of Array.isArray(values) ? values : []) {
      const id = text(value).trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }

  function idsEqual(a = [], b = []) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((id, index) => String(id || "") === String(b[index] || ""));
  }

  function normalizeSplitPairs(values = [], ids = [], options = {}) {
    const visibleIds = normalizePinnedIds(ids, { maxPanes: options.maxPanes });
    const normalize = typeof options.normalizeSplitPairs === "function"
      ? options.normalizeSplitPairs
      : null;
    const normalized = normalize ? normalize(values, visibleIds) : [];
    return normalized.map((pair) => ({
      anchorId: String(pair && pair.anchorId || ""),
      childId: String(pair && pair.childId || ""),
    })).filter((pair) => pair.anchorId && pair.childId);
  }

  function removeSplitPairsForIds(splitPairs = [], ids = []) {
    const remove = new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean));
    if (!remove.size) return { changed: false, splitPairs: Array.isArray(splitPairs) ? splitPairs : [] };
    const current = Array.isArray(splitPairs) ? splitPairs : [];
    const next = current.filter((pair) => (
      pair && !remove.has(String(pair.anchorId || "")) && !remove.has(String(pair.childId || ""))
    ));
    return {
      changed: JSON.stringify(next) !== JSON.stringify(current),
      splitPairs: next,
    };
  }

  function prependSplitPair(splitPairs = [], anchorId, childId, options = {}) {
    const anchor = String(anchorId || "").trim();
    const child = String(childId || "").trim();
    if (!anchor || !child || anchor === child) return { changed: false, splitPairs: Array.isArray(splitPairs) ? splitPairs : [] };
    const current = Array.isArray(splitPairs) ? splitPairs : [];
    const next = current.filter((pair) => (
      pair && ![anchor, child].includes(String(pair.anchorId || "")) && ![anchor, child].includes(String(pair.childId || ""))
    ));
    next.unshift({ anchorId: anchor, childId: child });
    return {
      changed: true,
      splitPairs: normalizeSplitPairs(next, options.ids || [], options),
    };
  }

  function effectiveSelectedThreadId(input = {}) {
    const activeIds = normalizePinnedIds(input.activeIds || input.ids || [], { maxPanes: input.maxPanes });
    if (input.enabled === false || !activeIds.length) return "";
    const selected = String(input.selectedThreadId || "").trim();
    if (selected && activeIds.includes(selected)) return selected;
    const current = String(input.currentThreadId || "").trim();
    if (current && activeIds.includes(current)) return current;
    return activeIds[0] || "";
  }

  function displaySettingsPayload(input = {}, options = {}) {
    const paneThreadIds = normalizePinnedIds(input.paneThreadIds || input.threadTilePinnedIds || [], options);
    const paneCountInput = Object.prototype.hasOwnProperty.call(input, "paneCount")
      ? input.paneCount
      : input.threadTilePaneCount;
    const tileMode = Boolean(input.threadTileMode) || String(input.displayMode || "").toLowerCase() === "tile";
    return {
      displayMode: tileMode ? "tile" : "single",
      paneThreadIds,
      paneCount: normalizePaneCount(paneCountInput, { fallback: 0, maxPanes: options.maxPanes }),
      paneSplitPairs: normalizeSplitPairs(input.paneSplitPairs || input.threadTileSplitPairs || [], paneThreadIds, options),
      selectedThreadId: String(input.selectedThreadId || input.threadTileSelectedThreadId || ""),
    };
  }

  function normalizeDisplaySettings(settings = {}, options = {}) {
    const displayMode = String(settings.displayMode || (settings.threadTileMode ? "tile" : "single")).toLowerCase() === "tile"
      ? "tile"
      : "single";
    const paneThreadIds = normalizePinnedIds(settings.paneThreadIds || settings.threadTilePinnedIds || [], options);
    const paneSplitPairs = normalizeSplitPairs(
      settings.paneSplitPairs || settings.threadTileSplitPairs || settings.splitPairs || [],
      paneThreadIds,
      options,
    );
    const paneCountInput = Object.prototype.hasOwnProperty.call(settings, "paneCount")
      ? settings.paneCount
      : Object.prototype.hasOwnProperty.call(settings, "threadTilePaneCount")
        ? settings.threadTilePaneCount
        : settings.tilePaneCount;
    const selected = String(settings.selectedThreadId || "").trim();
    return {
      displayMode,
      threadTileMode: displayMode === "tile",
      paneThreadIds,
      paneSplitPairs,
      paneCount: normalizePaneCount(paneCountInput, { fallback: 0, maxPanes: options.maxPanes }),
      selectedThreadId: selected && paneThreadIds.includes(selected) ? selected : "",
    };
  }

  function syncPinnedIdsFromActiveIds(input = {}, options = {}) {
    const activeIds = normalizePinnedIds(input.activeIds || [], options);
    const currentPinnedIds = normalizePinnedIds(input.pinnedIds || input.threadTilePinnedIds || [], options);
    if (input.enabled === false || !activeIds.length) {
      return { changed: false, paneThreadIds: currentPinnedIds, paneSplitPairs: input.splitPairs || [] };
    }
    const visibleIds = new Set((input.visibleIds || []).map((id) => String(id || "").trim()).filter(Boolean));
    const existingVisible = currentPinnedIds.filter((id) => visibleIds.has(id));
    if (idsEqual(existingVisible.slice(0, activeIds.length), activeIds)) {
      return { changed: false, paneThreadIds: currentPinnedIds, paneSplitPairs: input.splitPairs || [] };
    }
    const remaining = currentPinnedIds.filter((id) => !activeIds.includes(id));
    const paneThreadIds = normalizePinnedIds([...activeIds, ...remaining], options);
    return {
      changed: true,
      paneThreadIds,
      paneSplitPairs: normalizeSplitPairs(input.splitPairs || [], paneThreadIds, options),
    };
  }

  function normalizeOperationMode(mode) {
    return text(mode) === "expanded" ? "expanded" : "compact";
  }

  function toggleOperationMode(mode) {
    return normalizeOperationMode(mode) === "expanded" ? "compact" : "expanded";
  }

  function operationBubbleRecord(input = {}) {
    const id = text(input.threadId).trim();
    const html = text(input.html);
    const marker = text(input.bubbleMarker || "mobile-operation-bubble");
    if (!id || !html || !html.includes(marker)) return null;
    const minVisibleMs = Math.max(0, Number(input.minVisibleMs || DEFAULT_OPERATION_BUBBLE_MIN_VISIBLE_MS));
    return {
      html,
      visibleUntilMs: nowValue(input.nowMs) + minVisibleMs,
    };
  }

  function operationBubbleSnapshot(record, input = {}) {
    if (!record) return { visible: false, html: "", remainingMs: 0, expired: false };
    const remainingMs = Number(record.visibleUntilMs || 0) - nowValue(input.nowMs);
    if (remainingMs <= 0) {
      return { visible: false, html: "", remainingMs: 0, expired: true };
    }
    return {
      visible: true,
      html: text(record.html),
      remainingMs,
      expired: false,
    };
  }

  function operationSignature(input = {}) {
    const remembered = operationBubbleSnapshot(input.remembered, { nowMs: input.nowMs });
    return {
      mode: normalizeOperationMode(input.mode),
      rememberedVisible: remembered.visible,
      entry: input.entrySignature || null,
    };
  }

  function refreshDelayMs(value, options = {}) {
    const defaultDelayMs = Math.max(0, Number(options.defaultDelayMs || 0));
    const minDelayMs = Math.max(0, Number(options.minDelayMs || 500));
    const parsed = Number(value);
    return Math.max(minDelayMs, Number.isFinite(parsed) ? parsed : defaultDelayMs);
  }

  function refreshSchedulePlan(input = {}, options = {}) {
    const activeIds = uniqueIds(input.activeIds || []);
    const hiddenValue = text(options.hiddenVisibilityState || "hidden");
    if (input.enabled !== true) {
      return { schedule: false, clearTimer: true, reason: "disabled", activeIds, delayMs: 0 };
    }
    if (text(input.visibilityState) === hiddenValue) {
      return { schedule: false, clearTimer: true, reason: "hidden", activeIds, delayMs: 0 };
    }
    if (!activeIds.length) {
      return { schedule: false, clearTimer: false, reason: "no-active-panes", activeIds, delayMs: 0 };
    }
    if (input.hasTimer === true) {
      return { schedule: false, clearTimer: false, reason: "timer-active", activeIds, delayMs: 0 };
    }
    return {
      schedule: true,
      clearTimer: false,
      reason: "schedule",
      activeIds,
      delayMs: refreshDelayMs(input.delayMs, options),
    };
  }

  function refreshTargetIds(input = {}) {
    if (input.enabled !== true) return [];
    const ids = uniqueIds(input.ids || input.activeIds || []);
    const visibleInput = input.visibleIds;
    const visibleIds = Array.isArray(visibleInput) ? new Set(uniqueIds(visibleInput)) : null;
    const currentThreadId = text(input.currentThreadId).trim();
    return ids.filter((id) => {
      if (visibleIds && !visibleIds.has(id)) return false;
      return !currentThreadId || id !== currentThreadId;
    });
  }

  function detailLoadPlan(input = {}) {
    const id = text(input.threadId).trim();
    if (!id) return { action: "skip", reason: "missing-id", id: "" };
    if (text(input.currentThreadId).trim() === id && input.currentThreadLoaded === true) {
      return { action: "skip", reason: "current-thread-loaded", id };
    }
    if (input.controllerActive === true) return { action: "skip", reason: "controller-active", id };
    if (input.loadingActive === true) return { action: "skip", reason: "loading-active", id };
    const cachedReady = input.cachedReady === true;
    const force = input.force === true;
    const nowMs = nowValue(input.nowMs);
    const lastLoadedAt = Number(input.lastLoadedAt || 0);
    const minIntervalMs = Math.max(0, Number(input.minIntervalMs || 0));
    if (!force && cachedReady) return { action: "skip", reason: "cached-ready", id };
    if (force && lastLoadedAt && nowMs - lastLoadedAt < minIntervalMs) {
      return { action: "skip", reason: "min-refresh-interval", id };
    }
    const background = Boolean(input.backgroundRequested === true && cachedReady);
    return {
      action: "load",
      reason: background ? "background-refresh" : "load",
      id,
      background,
      markLoading: !background,
      clearError: !background,
    };
  }

  return {
    DEFAULT_OPERATION_BUBBLE_MIN_VISIBLE_MS,
    DEFAULT_USER_MAX_PANES,
    displaySettingsPayload,
    effectiveSelectedThreadId,
    idsEqual,
    normalizeDisplaySettings,
    normalizeOperationMode,
    normalizePaneCount,
    normalizePinnedIds,
    normalizeSplitPairs,
    operationBubbleRecord,
    operationBubbleSnapshot,
    operationSignature,
    prependSplitPair,
    detailLoadPlan,
    refreshDelayMs,
    refreshSchedulePlan,
    refreshTargetIds,
    removeSplitPairsForIds,
    syncPinnedIdsFromActiveIds,
    toggleOperationMode,
    uniqueIds,
  };
}));
