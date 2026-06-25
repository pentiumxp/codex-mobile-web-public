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

  function candidatePaneIdsPlan(input = {}, options = {}) {
    const maxPanes = Math.max(1, normalizePaneCount(input.maxPanes, {
      fallback: 1,
      maxPanes: options.maxPanes || DEFAULT_USER_MAX_PANES,
    }) || 1);
    const defaultIds = uniqueIds(input.defaultIds || input.threadIds || []).slice(0, maxPanes);
    const visibleIds = new Set(uniqueIds(input.visibleIds || []));
    const pinnedIds = normalizePinnedIds(input.pinnedIds || input.threadTilePinnedIds || [], {
      maxPanes: options.maxPanes || DEFAULT_USER_MAX_PANES,
    }).filter((id) => visibleIds.has(id));
    const currentThreadId = text(input.currentThreadId).trim();

    if (!pinnedIds.length) {
      return {
        action: "candidate-pane-ids",
        reason: "defaults",
        ids: defaultIds,
        pinnedIds,
        defaultIds,
        maxPanes,
      };
    }

    if (typeof options.selectPinnedThreadTileIds === "function") {
      const selectedIds = uniqueIds(options.selectPinnedThreadTileIds({
        currentThreadId,
        pinnedThreadIds: pinnedIds,
        threadIds: defaultIds,
        maxPanes,
      })).slice(0, maxPanes);
      return {
        action: "candidate-pane-ids",
        reason: "selector",
        ids: selectedIds,
        pinnedIds,
        defaultIds,
        maxPanes,
      };
    }

    const ids = uniqueIds([...pinnedIds, ...defaultIds]).slice(0, maxPanes);
    if (currentThreadId && !ids.includes(currentThreadId)) ids[Math.max(0, ids.length - 1)] = currentThreadId;
    return {
      action: "candidate-pane-ids",
      reason: "fallback",
      ids: uniqueIds(ids).slice(0, maxPanes),
      pinnedIds,
      defaultIds,
      maxPanes,
    };
  }

  function switchMenuOptionsPlan(input = {}) {
    const currentId = text(input.currentId || input.currentThreadId || input.threadId).trim();
    return uniqueIds([
      currentId,
      ...(Array.isArray(input.activeIds) ? input.activeIds : []),
      ...(Array.isArray(input.runningIds) ? input.runningIds : []),
      ...(Array.isArray(input.visibleIds) ? input.visibleIds : []),
    ]);
  }

  function switchMenuPlan(input = {}) {
    const currentId = text(input.currentId || input.threadId).trim();
    const switchMenuPaneId = text(input.switchMenuPaneId || input.openPaneId).trim();
    const options = uniqueIds(input.options || switchMenuOptionsPlan(input));
    const activeIds = uniqueIds(input.activeIds || []);
    const countInput = Number(input.count);
    const count = Math.max(0, Math.floor(Number.isFinite(countInput) ? countInput : activeIds.length));
    const minCount = Math.max(0, Math.floor(Number(input.minCount || 0)) || 0);
    const maxCount = Math.max(minCount, Math.floor(Number(input.maxCount || 0)) || 0);
    if (!currentId) {
      return { action: "skip", reason: "missing-id", currentId, options, activeIds, count, minCount, maxCount, canClose: false, canAdd: false };
    }
    if (switchMenuPaneId !== currentId) {
      return { action: "skip", reason: "closed", currentId, options, activeIds, count, minCount, maxCount, canClose: false, canAdd: false };
    }
    if (!options.length) {
      return { action: "skip", reason: "no-options", currentId, options, activeIds, count, minCount, maxCount, canClose: false, canAdd: false };
    }
    return {
      action: "render-switch-menu",
      reason: "open",
      currentId,
      options,
      activeIds,
      count,
      minCount,
      maxCount,
      canClose: activeIds.includes(currentId) && count > minCount,
      canAdd: count < maxCount,
    };
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

  function paneSlotBase(input = {}, options = {}) {
    return {
      ids: uniqueIds(input.ids || input.activeIds || []),
      pinnedIds: normalizePinnedIds(input.pinnedIds || input.threadTilePinnedIds || [], options),
      splitPairs: Array.isArray(input.splitPairs || input.threadTileSplitPairs)
        ? (input.splitPairs || input.threadTileSplitPairs)
        : [],
    };
  }

  function fillPaneSlotIds(pinnedIds = [], ids = []) {
    const nextIds = Array.isArray(pinnedIds) && pinnedIds.length ? pinnedIds.slice() : (ids || []).slice();
    while (nextIds.length < ids.length) {
      const fillId = ids[nextIds.length];
      if (!fillId) break;
      nextIds.push(fillId);
    }
    return nextIds;
  }

  function skipPaneSlot(reason, extra = {}) {
    return Object.assign({ action: "skip", reason }, extra);
  }

  function replacePaneThreadPlan(input = {}, options = {}) {
    const from = text(input.fromThreadId || input.fromId).trim();
    const to = text(input.toThreadId || input.toId || input.threadId).trim();
    const { ids, pinnedIds } = paneSlotBase(input, options);
    if (input.enabled !== true) return skipPaneSlot("disabled", { from, to, ids });
    if (!from || !to) return skipPaneSlot("missing-id", { from, to, ids });
    const index = ids.indexOf(from);
    if (index < 0) return skipPaneSlot("source-not-visible", { from, to, ids });
    if (from === to) {
      return {
        action: "select",
        reason: "same-thread",
        from,
        to,
        index,
        duplicateIndex: index,
        paneThreadIds: pinnedIds.length ? pinnedIds : ids,
        selectedThreadId: to,
        switchMenuPaneId: "",
        scrollResetIds: [],
        renderMode: "patch",
        loadThreadId: "",
      };
    }
    const nextIds = fillPaneSlotIds(pinnedIds, ids);
    const duplicateIndex = nextIds.indexOf(to);
    if (duplicateIndex >= 0 && duplicateIndex !== index) nextIds[duplicateIndex] = from;
    nextIds[index] = to;
    return {
      action: "replace",
      reason: "replace-pane-thread",
      from,
      to,
      index,
      duplicateIndex,
      paneThreadIds: normalizePinnedIds(nextIds, options),
      selectedThreadId: to,
      switchMenuPaneId: "",
      scrollResetIds: [from, to],
      renderMode: duplicateIndex >= 0 && duplicateIndex !== index ? "full" : "patch-source-pane",
      loadThreadId: to,
    };
  }

  function movePaneRelativePlan(input = {}, options = {}) {
    const from = text(input.fromThreadId || input.fromId).trim();
    const to = text(input.toThreadId || input.toId).trim();
    const placement = text(input.placement) === "before" ? "before" : "after";
    const { ids, splitPairs } = paneSlotBase(input, options);
    if (input.enabled !== true) return skipPaneSlot("disabled", { from, to, ids, placement });
    if (!from || !to) return skipPaneSlot("missing-id", { from, to, ids, placement });
    if (from === to) return skipPaneSlot("same-thread", { from, to, ids, placement });
    if (!ids.includes(from) || !ids.includes(to)) return skipPaneSlot("pane-not-visible", { from, to, ids, placement });
    const withoutFrom = ids.filter((id) => id !== from);
    const targetIndex = withoutFrom.indexOf(to);
    if (targetIndex < 0) return skipPaneSlot("target-not-visible", { from, to, ids, placement });
    withoutFrom.splice(placement === "before" ? targetIndex : targetIndex + 1, 0, from);
    const paneThreadIds = normalizePinnedIds(withoutFrom, options);
    const withoutSplit = removeSplitPairsForIds(splitPairs, [from]).splitPairs;
    return {
      action: "move",
      reason: "move-pane",
      from,
      to,
      placement,
      paneThreadIds,
      paneSplitPairs: normalizeSplitPairs(withoutSplit, paneThreadIds, options),
      selectedThreadId: from,
      switchMenuPaneId: "",
    };
  }

  function splitPaneWithTargetPlan(input = {}, options = {}) {
    const from = text(input.fromThreadId || input.fromId).trim();
    const to = text(input.toThreadId || input.toId).trim();
    const placement = text(input.placement) === "above" ? "above" : "below";
    const { ids, splitPairs } = paneSlotBase(input, options);
    if (input.enabled !== true) return skipPaneSlot("disabled", { from, to, ids, placement });
    if (!from || !to) return skipPaneSlot("missing-id", { from, to, ids, placement });
    if (from === to) return skipPaneSlot("same-thread", { from, to, ids, placement });
    if (!ids.includes(from) || !ids.includes(to)) return skipPaneSlot("pane-not-visible", { from, to, ids, placement });
    const targetIndex = ids.indexOf(to);
    const nextIds = ids.filter((id) => id !== from && id !== to);
    nextIds.splice(Math.max(0, targetIndex), 0, ...(placement === "above" ? [from, to] : [to, from]));
    const paneThreadIds = normalizePinnedIds(nextIds, options);
    const pair = placement === "above"
      ? { anchorId: from, childId: to }
      : { anchorId: to, childId: from };
    const splitResult = prependSplitPair(splitPairs, pair.anchorId, pair.childId, Object.assign({}, options, { ids: paneThreadIds }));
    return {
      action: "split",
      reason: "split-pane",
      from,
      to,
      placement,
      paneThreadIds,
      paneSplitPairs: splitResult.splitPairs,
      selectedThreadId: from,
      switchMenuPaneId: "",
    };
  }

  function replaceLastPaneForThreadListOpenPlan(input = {}, options = {}) {
    const id = text(input.threadId || input.toThreadId || input.toId).trim();
    const source = text(input.source).trim();
    const { ids, pinnedIds } = paneSlotBase(input, options);
    if (input.enabled !== true) return skipPaneSlot("disabled", { id, ids, source });
    if (source !== "thread-list") return skipPaneSlot("unsupported-source", { id, ids, source });
    if (!id) return skipPaneSlot("missing-id", { id, ids, source });
    if (!ids.length) return skipPaneSlot("no-panes", { id, ids, source });
    if (ids.includes(id)) return skipPaneSlot("already-visible", { id, ids, source });
    const index = ids.length - 1;
    const from = ids[index] || "";
    if (!from || from === id) return skipPaneSlot("missing-source-pane", { id, ids, source });
    const nextIds = fillPaneSlotIds(pinnedIds, ids);
    const duplicateIndex = nextIds.indexOf(id);
    if (duplicateIndex >= 0 && duplicateIndex !== index) nextIds[duplicateIndex] = from;
    nextIds[index] = id;
    const paneThreadIds = normalizePinnedIds(nextIds, options);
    if (idsEqual(pinnedIds, paneThreadIds)) return skipPaneSlot("unchanged", { id, ids, source });
    return {
      action: "replace-last",
      reason: "thread-list-open",
      from,
      to: id,
      index,
      duplicateIndex,
      paneThreadIds,
      selectedThreadId: id,
      switchMenuPaneId: "",
      scrollResetIds: [from, id],
    };
  }

  function paneSlotMutationEffectsPlan(plan = {}, options = {}) {
    const sourceAction = text(plan.action).trim();
    if (!sourceAction || sourceAction === "skip") return skipPaneSlot("no-mutation-plan", { sourceAction });
    const paneThreadIds = Array.isArray(plan.paneThreadIds)
      ? normalizePinnedIds(plan.paneThreadIds, options)
      : null;
    const base = {
      action: "pane-slot-effects",
      reason: text(plan.reason || sourceAction).trim() || sourceAction,
      sourceAction,
      paneThreadIds,
      paneSplitPairs: Array.isArray(plan.paneSplitPairs) ? plan.paneSplitPairs : null,
      paneCount: Number.isFinite(Number(plan.paneCount)) ? Math.max(0, Math.floor(Number(plan.paneCount))) : null,
      selectedThreadId: text(plan.selectedThreadId).trim(),
      switchMenuPaneId: text(plan.switchMenuPaneId).trim(),
      scrollResetIds: uniqueIds(plan.scrollResetIds || []),
      saveDraft: false,
      restoreDraft: false,
      updateComposer: false,
      scheduleSettingsSave: true,
      refreshActiveIds: false,
      selectionPolicy: "none",
      selectionEmptyFallback: false,
      loadThreadId: text(plan.loadThreadId).trim(),
      loadSource: "tile-switch",
      renderMode: "none",
      renderStickToBottom: false,
      patchThreadId: "",
      patchSourceThreadId: "",
      patchStickToBottom: false,
    };
    if (sourceAction === "select" || sourceAction === "replace") {
      return Object.assign(base, {
        saveDraft: true,
        restoreDraft: true,
        updateComposer: true,
        refreshActiveIds: true,
        renderMode: text(plan.renderMode) === "full" ? "schedule-full" : "patch-pane",
        patchThreadId: text(plan.to || plan.threadId).trim(),
        patchSourceThreadId: text(plan.from || plan.threadId).trim(),
        patchStickToBottom: true,
      });
    }
    if (sourceAction === "move" || sourceAction === "split") {
      return Object.assign(base, {
        saveDraft: true,
        restoreDraft: true,
        updateComposer: true,
        renderMode: "full",
        renderStickToBottom: true,
      });
    }
    if (sourceAction === "replace-last") {
      return Object.assign(base, {
        refreshActiveIds: true,
      });
    }
    if (sourceAction === "set-pane-count") {
      return Object.assign(base, {
        selectionPolicy: "pane-selection",
        selectionEmptyFallback: false,
        renderMode: options.render === false ? "none" : "full",
        renderStickToBottom: options.render !== false,
      });
    }
    if (sourceAction === "close-pane") {
      return Object.assign(base, {
        saveDraft: true,
        restoreDraft: true,
        updateComposer: true,
        selectionPolicy: "pane-selection",
        selectionEmptyFallback: true,
        renderMode: "full",
        renderStickToBottom: true,
      });
    }
    return skipPaneSlot("unsupported-mutation-plan", { sourceAction });
  }

  function dropPaneIntent(input = {}, options = {}) {
    const from = text(input.fromThreadId || input.fromId || input.draggingId).trim();
    const to = text(input.toThreadId || input.toId || input.targetId).trim();
    if (!from || !to) return skipPaneSlot("missing-id", { from, to });
    if (from === to) return skipPaneSlot("same-thread", { from, to });
    const left = Number(input.left || 0);
    const top = Number(input.top || 0);
    const width = Math.max(1, Number(input.width || 1));
    const height = Math.max(1, Number(input.height || 1));
    const x = (Number(input.clientX || 0) - left) / width;
    const y = (Number(input.clientY || 0) - top) / height;
    const beforeThreshold = Number.isFinite(Number(options.beforeThreshold)) ? Number(options.beforeThreshold) : 0.24;
    const afterThreshold = Number.isFinite(Number(options.afterThreshold)) ? Number(options.afterThreshold) : 0.76;
    return x < beforeThreshold
      ? { action: "move-relative", from, to, placement: "before", x, y }
      : x > afterThreshold
        ? { action: "move-relative", from, to, placement: "after", x, y }
        : { action: "split-with-target", from, to, placement: y < 0.5 ? "above" : "below", x, y };
  }

  function paneSelectionPlan(input = {}) {
    const ids = uniqueIds(input.ids || input.activeIds || []);
    const selectedThreadId = text(input.selectedThreadId).trim();
    if (selectedThreadId && ids.includes(selectedThreadId)) {
      return { selectedThreadId, changed: false, reason: "selected-visible" };
    }
    if (!selectedThreadId && input.emptyFallback !== true) {
      return { selectedThreadId: "", changed: false, reason: "empty-selection" };
    }
    return {
      selectedThreadId: ids[0] || "",
      changed: selectedThreadId !== (ids[0] || ""),
      reason: selectedThreadId ? "selected-missing" : "empty-fallback",
    };
  }

  function selectPanePlan(input = {}) {
    const id = text(input.threadId || input.paneId).trim();
    const activeIds = uniqueIds(input.activeIds || input.ids || []);
    const selectedThreadId = text(input.selectedThreadId).trim();
    if (input.enabled !== true) return skipPaneSlot("disabled", { id, activeIds });
    if (!id) return skipPaneSlot("missing-id", { id, activeIds });
    if (!activeIds.includes(id)) return skipPaneSlot("pane-not-active", { id, activeIds });
    if (selectedThreadId === id) return skipPaneSlot("unchanged", { id, activeIds, selectedThreadId });
    return {
      action: "select-pane",
      reason: "select-pane",
      threadId: id,
      previousThreadId: selectedThreadId,
      selectedThreadId: id,
      patchThreadIds: uniqueIds([id, selectedThreadId]),
    };
  }

  function selectedPaneEffectsPlan(plan = {}, options = {}) {
    const sourceAction = text(plan.action).trim();
    if (sourceAction !== "select-pane") return skipPaneSlot("unsupported-select-pane-plan", { sourceAction });
    const selectedThreadId = text(plan.selectedThreadId || plan.threadId).trim();
    if (!selectedThreadId) return skipPaneSlot("missing-id", { selectedThreadId });
    return {
      action: "selected-pane-effects",
      reason: text(plan.reason || sourceAction).trim() || sourceAction,
      sourceAction,
      selectedThreadId,
      patchThreadIds: uniqueIds(plan.patchThreadIds || [selectedThreadId]),
      saveDraft: true,
      restoreDraft: true,
      updateComposer: true,
      renderMode: options.render === false ? "none" : "patch-panes",
      patchPreserveScroll: true,
      scheduleFullRenderOnPatchMiss: true,
    };
  }

  function paneCountChangePlan(input = {}, options = {}) {
    if (input.enabled !== true) return skipPaneSlot("disabled");
    if (input.layoutEnabled !== true) return skipPaneSlot("layout-disabled");
    const minCount = Math.max(1, Math.floor(Number(input.minCount || 1)) || 1);
    const maxCount = Math.max(minCount, Math.floor(Number(input.maxCount || minCount)) || minCount);
    const currentCount = Math.max(minCount, Math.floor(Number(input.currentCount || minCount)) || minCount);
    const storedPaneCount = normalizePaneCount(input.storedPaneCount, { fallback: 0, maxPanes: options.maxPanes });
    const requested = normalizePaneCount(input.nextCount, { fallback: currentCount, maxPanes: options.maxPanes });
    const paneCount = Math.max(minCount, Math.min(maxCount, requested));
    if (paneCount === currentCount && storedPaneCount === paneCount) {
      return skipPaneSlot("unchanged", { paneCount, currentCount, minCount, maxCount });
    }
    return {
      action: "set-pane-count",
      reason: "set-pane-count",
      paneCount,
      currentCount,
      minCount,
      maxCount,
      switchMenuPaneId: "",
    };
  }

  function closePanePlan(input = {}, options = {}) {
    const id = text(input.threadId || input.paneId).trim();
    const ids = uniqueIds(input.ids || input.activeIds || []);
    if (input.enabled !== true) return skipPaneSlot("disabled", { id, ids });
    if (input.layoutEnabled !== true) return skipPaneSlot("layout-disabled", { id, ids });
    if (!id) return skipPaneSlot("missing-id", { id, ids });
    if (!ids.includes(id)) return skipPaneSlot("pane-not-visible", { id, ids });
    const minCount = Math.max(1, Math.floor(Number(input.minCount || 1)) || 1);
    if (ids.length <= minCount) return skipPaneSlot("min-pane-count", { id, ids, minCount });
    const nextCount = Math.max(minCount, ids.length - 1);
    const pinnedIds = normalizePinnedIds(input.pinnedIds || [], options);
    const sourceIds = pinnedIds.length ? pinnedIds : ids;
    const defaultIds = uniqueIds(input.defaultIds || input.fillIds || []);
    const remaining = sourceIds.filter((candidateId) => candidateId !== id);
    const fillIds = defaultIds.filter((candidateId) => candidateId !== id);
    return {
      action: "close-pane",
      reason: "close-pane",
      threadId: id,
      paneCount: nextCount,
      paneThreadIds: normalizePinnedIds([...remaining, ...fillIds], options),
      switchMenuPaneId: "",
      scrollResetIds: [id],
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

  function activePaneSyncPlan(input = {}, options = {}) {
    const activeIds = normalizePinnedIds(input.activeIds || [], options);
    const selectedThreadId = text(input.selectedThreadId).trim();
    const currentPinnedIds = normalizePinnedIds(input.pinnedIds || input.threadTilePinnedIds || [], options);
    const splitPairs = Array.isArray(input.splitPairs || input.threadTileSplitPairs)
      ? (input.splitPairs || input.threadTileSplitPairs)
      : [];
    if (input.enabled !== true || !activeIds.length) {
      return {
        action: "sync-active-panes",
        reason: input.enabled === true ? "no-active-panes" : "disabled",
        changed: Boolean(selectedThreadId),
        settingsChanged: false,
        pinnedChanged: false,
        selectedChanged: Boolean(selectedThreadId),
        activeIds,
        paneThreadIds: currentPinnedIds,
        paneSplitPairs: splitPairs,
        selectedThreadId: "",
      };
    }
    const pinned = syncPinnedIdsFromActiveIds({
      enabled: true,
      activeIds,
      pinnedIds: currentPinnedIds,
      visibleIds: input.visibleIds,
      splitPairs,
    }, options);
    const nextSelectedThreadId = effectiveSelectedThreadId({
      enabled: true,
      activeIds,
      selectedThreadId,
      currentThreadId: input.currentThreadId,
      maxPanes: options.maxPanes,
    });
    const selectedChanged = selectedThreadId !== nextSelectedThreadId;
    return {
      action: "sync-active-panes",
      reason: pinned.changed || selectedChanged ? "sync" : "unchanged",
      changed: pinned.changed || selectedChanged,
      settingsChanged: pinned.changed,
      pinnedChanged: pinned.changed,
      selectedChanged,
      activeIds,
      paneThreadIds: pinned.paneThreadIds,
      paneSplitPairs: pinned.paneSplitPairs,
      selectedThreadId: nextSelectedThreadId,
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

  function detailLoadQueuePlan(input = {}) {
    const activeIds = uniqueIds(input.activeIds || input.ids || []);
    const controllerIds = uniqueIds(input.controllerIds || []);
    const loadingIds = uniqueIds(input.loadingIds || []);
    if (input.enabled !== true) {
      return {
        action: "skip",
        reason: "disabled",
        activeIds,
        controllerIds,
        loadingIds,
        abortIds: [],
        loadIds: [],
        deferredIds: [],
        busyIds: [],
        maxConcurrentLoads: 0,
        availableSlots: 0,
      };
    }

    const activeSet = new Set(activeIds);
    const controllerSet = new Set(controllerIds);
    const loadingSet = new Set(loadingIds);
    const abortIds = controllerIds.filter((id) => !activeSet.has(id));
    const busyIds = uniqueIds([
      ...controllerIds.filter((id) => activeSet.has(id)),
      ...loadingIds.filter((id) => activeSet.has(id)),
    ]);
    const parsedMax = Math.floor(Number(input.maxConcurrentLoads));
    const maxConcurrentLoads = Number.isFinite(parsedMax) && parsedMax > 0
      ? parsedMax
      : Math.max(1, activeIds.length || DEFAULT_USER_MAX_PANES);
    const availableSlots = Math.max(0, maxConcurrentLoads - busyIds.length);
    const candidates = activeIds.filter((id) => !controllerSet.has(id) && !loadingSet.has(id));
    const loadIds = candidates.slice(0, availableSlots);
    const deferredIds = candidates.slice(availableSlots);
    return {
      action: "detail-load-queue",
      reason: !activeIds.length ? "no-active-panes" : (deferredIds.length ? "max-concurrency" : "queue"),
      activeIds,
      controllerIds,
      loadingIds,
      abortIds,
      loadIds,
      deferredIds,
      busyIds,
      maxConcurrentLoads,
      availableSlots,
    };
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

  function detailLoadStartEffectsPlan(plan = {}) {
    const sourceAction = text(plan.action).trim();
    const id = text(plan.id || plan.threadId).trim();
    if (sourceAction !== "load") return skipPaneSlot("unsupported-detail-load-plan", { sourceAction, id });
    if (!id) return skipPaneSlot("missing-id", { id });
    return {
      action: "detail-load-start-effects",
      reason: text(plan.reason || sourceAction).trim() || sourceAction,
      id,
      background: plan.background === true,
      setController: true,
      markLoading: plan.markLoading === true,
      clearError: plan.clearError === true,
      renderPane: plan.markLoading === true,
      preserveScroll: true,
    };
  }

  function detailLoadSuccessEffectsPlan(input = {}) {
    const id = text(input.id || input.threadId).trim();
    if (!id) return skipPaneSlot("missing-id", { id });
    if (input.hasThread !== true) return skipPaneSlot("missing-thread", { id });
    return {
      action: "detail-load-success-effects",
      reason: "thread-loaded",
      id,
      setDetail: true,
      setLoadedAt: true,
      loadedAtMs: nowValue(input.nowMs),
      clearError: true,
      mergeThread: true,
    };
  }

  function detailLoadErrorEffectsPlan(input = {}) {
    const id = text(input.id || input.threadId).trim();
    if (!id) return skipPaneSlot("missing-id", { id });
    if (input.aborted === true) return skipPaneSlot("aborted", { id });
    if (input.background === true) return skipPaneSlot("background-refresh", { id });
    return {
      action: "detail-load-error-effects",
      reason: "foreground-error",
      id,
      errorMessage: text(input.errorMessage || input.message || input.error).trim(),
    };
  }

  function detailLoadFinallyEffectsPlan(input = {}) {
    const id = text(input.id || input.threadId).trim();
    if (!id) return skipPaneSlot("missing-id", { id });
    return {
      action: "detail-load-finally-effects",
      reason: "settle",
      id,
      clearController: input.controllerMatches === true,
      clearLoading: true,
      renderPane: input.visible === true,
      preserveScroll: true,
    };
  }

  return {
    DEFAULT_OPERATION_BUBBLE_MIN_VISIBLE_MS,
    DEFAULT_USER_MAX_PANES,
    activePaneSyncPlan,
    candidatePaneIdsPlan,
    closePanePlan,
    displaySettingsPayload,
    dropPaneIntent,
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
    paneCountChangePlan,
    paneSelectionPlan,
    paneSlotMutationEffectsPlan,
    prependSplitPair,
    detailLoadPlan,
    detailLoadErrorEffectsPlan,
    detailLoadFinallyEffectsPlan,
    detailLoadQueuePlan,
    detailLoadStartEffectsPlan,
    detailLoadSuccessEffectsPlan,
    refreshDelayMs,
    refreshSchedulePlan,
    refreshTargetIds,
    replaceLastPaneForThreadListOpenPlan,
    replacePaneThreadPlan,
    removeSplitPairsForIds,
    movePaneRelativePlan,
    selectPanePlan,
    selectedPaneEffectsPlan,
    splitPaneWithTargetPlan,
    switchMenuOptionsPlan,
    switchMenuPlan,
    syncPinnedIdsFromActiveIds,
    toggleOperationMode,
    uniqueIds,
  };
}));
