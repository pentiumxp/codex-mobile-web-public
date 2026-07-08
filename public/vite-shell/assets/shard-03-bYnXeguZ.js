var DEFAULT_PANE_NEAR_BOTTOM_PX = 48;
var DEFAULT_PANE_SCROLLABLE_DELTA_PX = 96;
function text(value) {
	return String(value || "");
}
function nowValue(value) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : Date.now();
}
function nonNegativeNumber(value, fallback = 0) {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
function maxPaneLimit(maxPanes = 12) {
	const parsed = Math.floor(Number(maxPanes));
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
}
function normalizePaneCount(value, options = {}) {
	const fallback = Number.isFinite(Number(options.fallback)) ? Math.floor(Number(options.fallback)) : 0;
	const parsed = Math.floor(Number(value));
	if (!Number.isFinite(parsed)) return fallback;
	return Math.max(0, Math.min(maxPaneLimit(options.maxPanes), parsed));
}
function normalizePinnedIds(values = [], options = {}) {
	const seen = /* @__PURE__ */ new Set();
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
	const seen = /* @__PURE__ */ new Set();
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
		maxPanes: options.maxPanes || 12
	}) || 1);
	const defaultIds = uniqueIds(input.defaultIds || input.threadIds || []).slice(0, maxPanes);
	const visibleIds = new Set(uniqueIds(input.visibleIds || []));
	const pinnedIds = normalizePinnedIds(input.pinnedIds || input.threadTilePinnedIds || [], { maxPanes: options.maxPanes || 12 }).filter((id) => visibleIds.has(id));
	const currentThreadId = text(input.currentThreadId).trim();
	if (!pinnedIds.length) return {
		action: "candidate-pane-ids",
		reason: "defaults",
		ids: defaultIds,
		pinnedIds,
		defaultIds,
		maxPanes
	};
	if (typeof options.selectPinnedThreadTileIds === "function") return {
		action: "candidate-pane-ids",
		reason: "selector",
		ids: uniqueIds(options.selectPinnedThreadTileIds({
			currentThreadId,
			pinnedThreadIds: pinnedIds,
			threadIds: defaultIds,
			maxPanes
		})).slice(0, maxPanes),
		pinnedIds,
		defaultIds,
		maxPanes
	};
	const ids = uniqueIds([...pinnedIds, ...defaultIds]).slice(0, maxPanes);
	if (currentThreadId && !ids.includes(currentThreadId)) ids[Math.max(0, ids.length - 1)] = currentThreadId;
	return {
		action: "candidate-pane-ids",
		reason: "fallback",
		ids: uniqueIds(ids).slice(0, maxPanes),
		pinnedIds,
		defaultIds,
		maxPanes
	};
}
function paneCountStatePlan(input = {}, options = {}) {
	const maxPanes = maxPaneLimit(options.maxPanes || input.maxPanes || 12);
	const capacity = Math.max(1, normalizePaneCount(input.capacity || input.layoutCapacity, {
		fallback: 1,
		maxPanes
	}) || 1);
	const candidateIds = uniqueIds(input.candidateIds || input.defaultIds || []).slice(0, capacity);
	const candidateCount = candidateIds.length;
	const maxCandidateIds = uniqueIds(input.maxCandidateIds || input.maximumCandidateIds || input.allCandidateIds || candidateIds);
	const maxCandidateCount = Math.max(1, Math.min(maxPanes, maxCandidateIds.length || candidateCount || 1));
	const runningSet = new Set(uniqueIds(input.runningIds || []));
	const currentThreadId = text(input.currentThreadId).trim();
	if (currentThreadId) runningSet.add(currentThreadId);
	const runningCount = runningSet.size;
	const explicitPaneCount = normalizePaneCount(Object.prototype.hasOwnProperty.call(input, "explicitPaneCount") ? input.explicitPaneCount : Object.prototype.hasOwnProperty.call(input, "paneCount") ? input.paneCount : input.threadTilePaneCount, {
		fallback: 0,
		maxPanes
	});
	let autoPaneCount = 1;
	if (candidateCount > 0) autoPaneCount = Math.max(1, Math.min(capacity, candidateCount, Math.max(capacity > 1 ? Math.min(2, candidateCount, capacity) : 1, runningCount)));
	return {
		action: "pane-count-state",
		reason: explicitPaneCount > 0 ? "explicit" : "auto",
		capacity,
		candidateIds,
		candidateCount,
		maxCandidateIds,
		maxCandidateCount,
		runningCount,
		explicitPaneCount,
		autoPaneCount,
		effectivePaneCount: explicitPaneCount > 0 ? Math.max(1, Math.min(maxCandidateCount, explicitPaneCount)) : Math.max(1, Math.min(capacity, candidateCount || 1, autoPaneCount)),
		minPaneCount: Math.min(capacity, candidateCount || 1) >= 2 ? 2 : 1,
		maxPaneCount: maxCandidateCount
	};
}
function layoutCapacity(input = {}, options = {}) {
	const maxPanes = maxPaneLimit(options.capacityMaxPanes || options.maxPanes || 12);
	const value = Object.prototype.hasOwnProperty.call(input, "recommendedMaxPanes") ? input.recommendedMaxPanes : input.maxPanes;
	const parsed = Math.floor(Number(value || 1));
	return Math.max(1, Math.min(maxPanes, Number.isFinite(parsed) && parsed > 0 ? parsed : 1));
}
function viewportSize(value = {}) {
	return {
		width: Math.round(nonNegativeNumber(value && value.width, 0)),
		height: Math.round(nonNegativeNumber(value && value.height, 0))
	};
}
function threadTileViewportBaselinePlan(input = {}) {
	const layoutViewport = viewportSize(input.layoutViewport || input.viewport || {});
	const baseline = viewportSize(input.baseline || input.previousBaseline || {});
	const keyboardActive = input.keyboardActive === true;
	const hasBaseline = baseline.width > 0 && baseline.height > 0;
	if (!keyboardActive) return {
		action: "thread-tile-viewport-baseline",
		reason: "layout-viewport",
		keyboardActive,
		viewport: layoutViewport,
		nextBaseline: layoutViewport,
		updateBaseline: true
	};
	return {
		action: "thread-tile-viewport-baseline",
		reason: hasBaseline ? "keyboard-baseline" : "keyboard-layout-viewport",
		keyboardActive,
		viewport: hasBaseline ? baseline : layoutViewport,
		nextBaseline: hasBaseline ? baseline : layoutViewport,
		updateBaseline: false
	};
}
function threadTileVerticalChromePlan(input = {}, options = {}) {
	const keyboardActive = input.keyboardActive === true;
	const composerHeightPx = nonNegativeNumber(input.composerHeightPx, 0);
	const baselineComposerHeightPx = nonNegativeNumber(input.baselineComposerHeightPx, 0);
	const minChromePx = nonNegativeNumber(Object.prototype.hasOwnProperty.call(options, "minChromePx") ? options.minChromePx : input.minChromePx, 120);
	const extraChromePx = nonNegativeNumber(Object.prototype.hasOwnProperty.call(options, "extraChromePx") ? options.extraChromePx : input.extraChromePx, 64);
	const effectiveComposerHeightPx = keyboardActive && baselineComposerHeightPx ? baselineComposerHeightPx : composerHeightPx;
	return {
		action: "thread-tile-vertical-chrome",
		reason: keyboardActive ? baselineComposerHeightPx ? "keyboard-baseline" : "keyboard-composer" : "composer-baseline",
		keyboardActive,
		composerHeightPx: effectiveComposerHeightPx,
		nextComposerHeightBaselinePx: keyboardActive ? baselineComposerHeightPx : composerHeightPx || baselineComposerHeightPx || 0,
		updateBaseline: !keyboardActive,
		verticalChromePx: Math.max(minChromePx, effectiveComposerHeightPx + extraChromePx)
	};
}
function normalizeColumnGroups(values = []) {
	return (Array.isArray(values) ? values : []).map((group) => uniqueIds(Array.isArray(group) ? group : [])).filter((group) => group.length);
}
function paneDisplayLayoutPlan(input = {}, options = {}) {
	const layout = input.layout && typeof input.layout === "object" ? input.layout : input;
	const ids = uniqueIds(input.ids || input.threadIds || []);
	const effectivePaneCount = normalizePaneCount(Object.prototype.hasOwnProperty.call(input, "effectivePaneCount") ? input.effectivePaneCount : input.count, {
		fallback: 0,
		maxPanes: options.maxPanes
	});
	const count = Math.max(1, ids.length ? ids.length : effectivePaneCount || 1);
	const capacityColumns = Math.max(1, Math.floor(Number(layout && layout.columns || 1)) || 1);
	const columns = Math.max(1, Math.min(capacityColumns, count));
	const splitPairs = Array.isArray(input.splitPairs || input.paneSplitPairs) ? input.splitPairs || input.paneSplitPairs : [];
	const groupFn = typeof options.threadTileColumnGroups === "function" ? options.threadTileColumnGroups : null;
	const columnGroups = normalizeColumnGroups(groupFn ? groupFn({
		ids,
		columns,
		splitPairs
	}) : ids.slice(0, count).map((id) => [id]));
	const rows = Math.max(1, ...columnGroups.map((group) => group.length || 1));
	const displayLayout = Object.assign({}, layout, {
		capacityPanes: layoutCapacity(layout, options),
		visiblePanes: count,
		columns: Math.max(1, columnGroups.length || columns),
		rows,
		columnGroups
	});
	return {
		action: "pane-display-layout",
		reason: ids.length ? "thread-ids" : "count-only",
		count,
		capacityColumns,
		columns,
		rows,
		columnGroups,
		displayLayout
	};
}
function normalizeIdValuePairs(values = [], ids = []) {
	const idSet = new Set(uniqueIds(ids));
	return (Array.isArray(values) ? values : []).map((entry) => {
		if (Array.isArray(entry)) return [text(entry[0]).trim(), entry.length > 1 ? entry[1] : ""];
		if (entry && typeof entry === "object") return [text(entry.id || entry.threadId || entry.paneId).trim(), Object.prototype.hasOwnProperty.call(entry, "value") ? entry.value : Object.prototype.hasOwnProperty.call(entry, "signature") ? entry.signature : Object.prototype.hasOwnProperty.call(entry, "error") ? entry.error : ""];
		return ["", ""];
	}).filter((entry) => entry[0] && (!idSet.size || idSet.has(entry[0])));
}
function paneRenderSignaturePlan(input = {}, options = {}) {
	const layout = input.layout && typeof input.layout === "object" ? input.layout : {};
	const ids = uniqueIds(input.ids || input.threadIds || []);
	const idSet = new Set(ids);
	const signatureObject = {
		view: "thread-tiles",
		columns: layout.columns,
		rows: layout.rows,
		visiblePanes: layout.visiblePanes || ids.length,
		capacityPanes: layout.capacityPanes || layout.maxPanes,
		desiredPaneCount: normalizePaneCount(Object.prototype.hasOwnProperty.call(input, "desiredPaneCount") ? input.desiredPaneCount : input.paneCount, {
			fallback: 0,
			maxPanes: options.maxPanes
		}),
		columnGroups: normalizeColumnGroups(input.columnGroups || layout.columnGroups || []),
		splitPairs: Array.isArray(input.splitPairs || input.paneSplitPairs) ? input.splitPairs || input.paneSplitPairs : [],
		ids,
		selected: text(input.selectedThreadId || input.selected).trim(),
		loading: uniqueIds(input.loadingIds || input.loading || []).filter((id) => !idSet.size || idSet.has(id)),
		switchMenuPaneId: text(input.switchMenuPaneId).trim(),
		errors: normalizeIdValuePairs(input.errors || input.errorPairs || [], ids),
		operations: normalizeIdValuePairs(input.operations || input.operationSignatures || [], ids),
		threads: (Array.isArray(input.threadSignatures || input.threads) ? input.threadSignatures || input.threads : []).map((value) => String(value || ""))
	};
	return {
		action: "pane-render-signature",
		reason: ids.length ? "thread-ids" : "empty",
		ids,
		signatureObject,
		signature: JSON.stringify(signatureObject)
	};
}
function paneScrollMetrics(input = {}, options = {}) {
	const scrollHeight = nonNegativeNumber(input.scrollHeight);
	const clientHeight = nonNegativeNumber(input.clientHeight);
	const scrollTop = nonNegativeNumber(input.scrollTop);
	const nearBottomPx = nonNegativeNumber(options.nearBottomPx || input.nearBottomPx, DEFAULT_PANE_NEAR_BOTTOM_PX);
	const distanceFromBottom = Math.max(0, scrollHeight - clientHeight - scrollTop);
	return {
		action: "pane-scroll-metrics",
		distanceFromBottom,
		nearBottom: distanceFromBottom <= nearBottomPx,
		hold: input.hold === true,
		scrollHeight,
		clientHeight,
		scrollTop,
		nearBottomPx
	};
}
function paneScrollHoldPlan(input = {}, options = {}) {
	const metrics = input.action === "pane-scroll-metrics" ? input : paneScrollMetrics(input, options);
	return {
		action: "pane-scroll-hold",
		reason: metrics.nearBottom ? "near-bottom" : "away-from-bottom",
		rememberHold: metrics.nearBottom !== true,
		clearHold: metrics.nearBottom === true,
		metrics
	};
}
function paneBottomButtonPlan(input = {}, options = {}) {
	const metrics = input.metrics && input.metrics.action === "pane-scroll-metrics" ? input.metrics : paneScrollMetrics(input, options);
	const scrollableDeltaPx = nonNegativeNumber(options.scrollableDeltaPx || input.scrollableDeltaPx, DEFAULT_PANE_SCROLLABLE_DELTA_PX);
	const scrollable = Math.max(0, metrics.scrollHeight - metrics.clientHeight) > scrollableDeltaPx;
	const shouldShow = Boolean(scrollable && !metrics.nearBottom);
	return {
		action: "pane-bottom-button",
		reason: shouldShow ? "show" : scrollable ? "near-bottom" : "not-scrollable",
		shouldShow,
		scrollable,
		scrollableDeltaPx,
		metrics
	};
}
function paneScrollRestorePlan(input = {}, options = {}) {
	const previous = input.previous && typeof input.previous === "object" ? input.previous : null;
	const rememberedHold = input.rememberedHold === true;
	const hold = Boolean(previous && previous.hold === true) || rememberedHold;
	const scrollHeight = nonNegativeNumber(input.scrollHeight);
	const clientHeight = nonNegativeNumber(input.clientHeight);
	const distanceFromBottom = nonNegativeNumber(previous && previous.distanceFromBottom);
	if (input.stickToBottom === true || !previous || !hold || previous.nearBottom === true) return {
		action: "pane-scroll-restore",
		reason: input.stickToBottom === true ? "stick-to-bottom" : !previous ? "missing-previous" : !hold ? "no-hold" : "previous-near-bottom",
		mode: "bottom",
		top: Math.max(0, scrollHeight),
		hold
	};
	return {
		action: "pane-scroll-restore",
		reason: "restore-distance",
		mode: "restore-distance",
		top: Math.max(0, scrollHeight - clientHeight - distanceFromBottom),
		hold
	};
}
function switchMenuOptionsPlan(input = {}) {
	return uniqueIds([
		text(input.currentId || input.currentThreadId || input.threadId).trim(),
		...Array.isArray(input.activeIds) ? input.activeIds : [],
		...Array.isArray(input.runningIds) ? input.runningIds : [],
		...Array.isArray(input.visibleIds) ? input.visibleIds : []
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
	if (!currentId) return {
		action: "skip",
		reason: "missing-id",
		currentId,
		options,
		activeIds,
		count,
		minCount,
		maxCount,
		canClose: false,
		canAdd: false
	};
	if (switchMenuPaneId !== currentId) return {
		action: "skip",
		reason: "closed",
		currentId,
		options,
		activeIds,
		count,
		minCount,
		maxCount,
		canClose: false,
		canAdd: false
	};
	if (!options.length) return {
		action: "skip",
		reason: "no-options",
		currentId,
		options,
		activeIds,
		count,
		minCount,
		maxCount,
		canClose: false,
		canAdd: false
	};
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
		canAdd: count < maxCount
	};
}
function normalizeSplitPairs(values = [], ids = [], options = {}) {
	const visibleIds = normalizePinnedIds(ids, { maxPanes: options.maxPanes });
	const normalize = typeof options.normalizeSplitPairs === "function" ? options.normalizeSplitPairs : null;
	return (normalize ? normalize(values, visibleIds) : []).map((pair) => ({
		anchorId: String(pair && pair.anchorId || ""),
		childId: String(pair && pair.childId || "")
	})).filter((pair) => pair.anchorId && pair.childId);
}
function removeSplitPairsForIds(splitPairs = [], ids = []) {
	const remove = new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean));
	if (!remove.size) return {
		changed: false,
		splitPairs: Array.isArray(splitPairs) ? splitPairs : []
	};
	const current = Array.isArray(splitPairs) ? splitPairs : [];
	const next = current.filter((pair) => pair && !remove.has(String(pair.anchorId || "")) && !remove.has(String(pair.childId || "")));
	return {
		changed: JSON.stringify(next) !== JSON.stringify(current),
		splitPairs: next
	};
}
function prependSplitPair(splitPairs = [], anchorId, childId, options = {}) {
	const anchor = String(anchorId || "").trim();
	const child = String(childId || "").trim();
	if (!anchor || !child || anchor === child) return {
		changed: false,
		splitPairs: Array.isArray(splitPairs) ? splitPairs : []
	};
	const next = (Array.isArray(splitPairs) ? splitPairs : []).filter((pair) => pair && ![anchor, child].includes(String(pair.anchorId || "")) && ![anchor, child].includes(String(pair.childId || "")));
	next.unshift({
		anchorId: anchor,
		childId: child
	});
	return {
		changed: true,
		splitPairs: normalizeSplitPairs(next, options.ids || [], options)
	};
}
function paneSlotBase(input = {}, options = {}) {
	return {
		ids: uniqueIds(input.ids || input.activeIds || []),
		pinnedIds: normalizePinnedIds(input.pinnedIds || input.threadTilePinnedIds || [], options),
		splitPairs: Array.isArray(input.splitPairs || input.threadTileSplitPairs) ? input.splitPairs || input.threadTileSplitPairs : []
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
	return Object.assign({
		action: "skip",
		reason
	}, extra);
}
function replacePaneThreadPlan(input = {}, options = {}) {
	const from = text(input.fromThreadId || input.fromId).trim();
	const to = text(input.toThreadId || input.toId || input.threadId).trim();
	const { ids, pinnedIds } = paneSlotBase(input, options);
	if (input.enabled !== true) return skipPaneSlot("disabled", {
		from,
		to,
		ids
	});
	if (!from || !to) return skipPaneSlot("missing-id", {
		from,
		to,
		ids
	});
	const index = ids.indexOf(from);
	if (index < 0) return skipPaneSlot("source-not-visible", {
		from,
		to,
		ids
	});
	if (from === to) return {
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
		loadThreadId: ""
	};
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
		loadThreadId: to
	};
}
function movePaneRelativePlan(input = {}, options = {}) {
	const from = text(input.fromThreadId || input.fromId).trim();
	const to = text(input.toThreadId || input.toId).trim();
	const placement = text(input.placement) === "before" ? "before" : "after";
	const { ids, splitPairs } = paneSlotBase(input, options);
	if (input.enabled !== true) return skipPaneSlot("disabled", {
		from,
		to,
		ids,
		placement
	});
	if (!from || !to) return skipPaneSlot("missing-id", {
		from,
		to,
		ids,
		placement
	});
	if (from === to) return skipPaneSlot("same-thread", {
		from,
		to,
		ids,
		placement
	});
	if (!ids.includes(from) || !ids.includes(to)) return skipPaneSlot("pane-not-visible", {
		from,
		to,
		ids,
		placement
	});
	const withoutFrom = ids.filter((id) => id !== from);
	const targetIndex = withoutFrom.indexOf(to);
	if (targetIndex < 0) return skipPaneSlot("target-not-visible", {
		from,
		to,
		ids,
		placement
	});
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
		switchMenuPaneId: ""
	};
}
function splitPaneWithTargetPlan(input = {}, options = {}) {
	const from = text(input.fromThreadId || input.fromId).trim();
	const to = text(input.toThreadId || input.toId).trim();
	const placement = text(input.placement) === "above" ? "above" : "below";
	const { ids, splitPairs } = paneSlotBase(input, options);
	if (input.enabled !== true) return skipPaneSlot("disabled", {
		from,
		to,
		ids,
		placement
	});
	if (!from || !to) return skipPaneSlot("missing-id", {
		from,
		to,
		ids,
		placement
	});
	if (from === to) return skipPaneSlot("same-thread", {
		from,
		to,
		ids,
		placement
	});
	if (!ids.includes(from) || !ids.includes(to)) return skipPaneSlot("pane-not-visible", {
		from,
		to,
		ids,
		placement
	});
	const targetIndex = ids.indexOf(to);
	const nextIds = ids.filter((id) => id !== from && id !== to);
	nextIds.splice(Math.max(0, targetIndex), 0, ...placement === "above" ? [from, to] : [to, from]);
	const paneThreadIds = normalizePinnedIds(nextIds, options);
	const pair = placement === "above" ? {
		anchorId: from,
		childId: to
	} : {
		anchorId: to,
		childId: from
	};
	return {
		action: "split",
		reason: "split-pane",
		from,
		to,
		placement,
		paneThreadIds,
		paneSplitPairs: prependSplitPair(splitPairs, pair.anchorId, pair.childId, Object.assign({}, options, { ids: paneThreadIds })).splitPairs,
		selectedThreadId: from,
		switchMenuPaneId: ""
	};
}
function replaceLastPaneForThreadListOpenPlan(input = {}, options = {}) {
	const id = text(input.threadId || input.toThreadId || input.toId).trim();
	const source = text(input.source).trim();
	const { ids, pinnedIds } = paneSlotBase(input, options);
	if (input.enabled !== true) return skipPaneSlot("disabled", {
		id,
		ids,
		source
	});
	if (source !== "thread-list") return skipPaneSlot("unsupported-source", {
		id,
		ids,
		source
	});
	if (!id) return skipPaneSlot("missing-id", {
		id,
		ids,
		source
	});
	if (!ids.length) return skipPaneSlot("no-panes", {
		id,
		ids,
		source
	});
	if (ids.includes(id)) return skipPaneSlot("already-visible", {
		id,
		ids,
		source
	});
	const index = ids.length - 1;
	const from = ids[index] || "";
	if (!from || from === id) return skipPaneSlot("missing-source-pane", {
		id,
		ids,
		source
	});
	const nextIds = fillPaneSlotIds(pinnedIds, ids);
	const duplicateIndex = nextIds.indexOf(id);
	if (duplicateIndex >= 0 && duplicateIndex !== index) nextIds[duplicateIndex] = from;
	nextIds[index] = id;
	const paneThreadIds = normalizePinnedIds(nextIds, options);
	if (idsEqual(pinnedIds, paneThreadIds)) return skipPaneSlot("unchanged", {
		id,
		ids,
		source
	});
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
		scrollResetIds: [from, id]
	};
}
function paneSlotMutationEffectsPlan(plan = {}, options = {}) {
	const sourceAction = text(plan.action).trim();
	if (!sourceAction || sourceAction === "skip") return skipPaneSlot("no-mutation-plan", { sourceAction });
	const paneThreadIds = Array.isArray(plan.paneThreadIds) ? normalizePinnedIds(plan.paneThreadIds, options) : null;
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
		scheduleFullRenderOnPatchMiss: false
	};
	if (sourceAction === "select" || sourceAction === "replace") return Object.assign(base, {
		saveDraft: true,
		restoreDraft: true,
		updateComposer: true,
		refreshActiveIds: true,
		renderMode: text(plan.renderMode) === "full" ? "schedule-full" : "patch-pane",
		patchThreadId: text(plan.to || plan.threadId).trim(),
		patchSourceThreadId: text(plan.from || plan.threadId).trim(),
		patchStickToBottom: true,
		scheduleFullRenderOnPatchMiss: true
	});
	if (sourceAction === "move" || sourceAction === "split") return Object.assign(base, {
		saveDraft: true,
		restoreDraft: true,
		updateComposer: true,
		renderMode: "full",
		renderStickToBottom: true
	});
	if (sourceAction === "replace-last") return Object.assign(base, { refreshActiveIds: true });
	if (sourceAction === "set-pane-count") return Object.assign(base, {
		selectionPolicy: "pane-selection",
		selectionEmptyFallback: false,
		renderMode: options.render === false ? "none" : "full",
		renderStickToBottom: options.render !== false
	});
	if (sourceAction === "close-pane") return Object.assign(base, {
		saveDraft: true,
		restoreDraft: true,
		updateComposer: true,
		selectionPolicy: "pane-selection",
		selectionEmptyFallback: true,
		renderMode: "full",
		renderStickToBottom: true
	});
	return skipPaneSlot("unsupported-mutation-plan", { sourceAction });
}
function dropPaneIntent(input = {}, options = {}) {
	const from = text(input.fromThreadId || input.fromId || input.draggingId).trim();
	const to = text(input.toThreadId || input.toId || input.targetId).trim();
	if (!from || !to) return skipPaneSlot("missing-id", {
		from,
		to
	});
	if (from === to) return skipPaneSlot("same-thread", {
		from,
		to
	});
	const left = Number(input.left || 0);
	const top = Number(input.top || 0);
	const width = Math.max(1, Number(input.width || 1));
	const height = Math.max(1, Number(input.height || 1));
	const x = (Number(input.clientX || 0) - left) / width;
	const y = (Number(input.clientY || 0) - top) / height;
	const beforeThreshold = Number.isFinite(Number(options.beforeThreshold)) ? Number(options.beforeThreshold) : .24;
	const afterThreshold = Number.isFinite(Number(options.afterThreshold)) ? Number(options.afterThreshold) : .76;
	return x < beforeThreshold ? {
		action: "move-relative",
		from,
		to,
		placement: "before",
		x,
		y
	} : x > afterThreshold ? {
		action: "move-relative",
		from,
		to,
		placement: "after",
		x,
		y
	} : {
		action: "split-with-target",
		from,
		to,
		placement: y < .5 ? "above" : "below",
		x,
		y
	};
}
function paneSelectionPlan(input = {}) {
	const ids = uniqueIds(input.ids || input.activeIds || []);
	const selectedThreadId = text(input.selectedThreadId).trim();
	if (selectedThreadId && ids.includes(selectedThreadId)) return {
		selectedThreadId,
		changed: false,
		reason: "selected-visible"
	};
	if (!selectedThreadId && input.emptyFallback !== true) return {
		selectedThreadId: "",
		changed: false,
		reason: "empty-selection"
	};
	return {
		selectedThreadId: ids[0] || "",
		changed: selectedThreadId !== (ids[0] || ""),
		reason: selectedThreadId ? "selected-missing" : "empty-fallback"
	};
}
function selectPanePlan(input = {}) {
	const id = text(input.threadId || input.paneId).trim();
	const activeIds = uniqueIds(input.activeIds || input.ids || []);
	const selectedThreadId = text(input.selectedThreadId).trim();
	if (input.enabled !== true) return skipPaneSlot("disabled", {
		id,
		activeIds
	});
	if (!id) return skipPaneSlot("missing-id", {
		id,
		activeIds
	});
	if (!activeIds.includes(id)) return skipPaneSlot("pane-not-active", {
		id,
		activeIds
	});
	if (selectedThreadId === id) return skipPaneSlot("unchanged", {
		id,
		activeIds,
		selectedThreadId
	});
	return {
		action: "select-pane",
		reason: "select-pane",
		threadId: id,
		previousThreadId: selectedThreadId,
		selectedThreadId: id,
		patchThreadIds: uniqueIds([id, selectedThreadId])
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
		scheduleFullRenderOnPatchMiss: true
	};
}
function paneCountChangePlan(input = {}, options = {}) {
	if (input.enabled !== true) return skipPaneSlot("disabled");
	if (input.layoutEnabled !== true) return skipPaneSlot("layout-disabled");
	const minCount = Math.max(1, Math.floor(Number(input.minCount || 1)) || 1);
	const maxCount = Math.max(minCount, Math.floor(Number(input.maxCount || minCount)) || minCount);
	const currentCount = Math.max(minCount, Math.floor(Number(input.currentCount || minCount)) || minCount);
	const storedPaneCount = normalizePaneCount(input.storedPaneCount, {
		fallback: 0,
		maxPanes: options.maxPanes
	});
	const requested = normalizePaneCount(input.nextCount, {
		fallback: currentCount,
		maxPanes: options.maxPanes
	});
	const paneCount = Math.max(minCount, Math.min(maxCount, requested));
	if (paneCount === currentCount && storedPaneCount === paneCount) return skipPaneSlot("unchanged", {
		paneCount,
		currentCount,
		minCount,
		maxCount
	});
	return {
		action: "set-pane-count",
		reason: "set-pane-count",
		paneCount,
		currentCount,
		minCount,
		maxCount,
		switchMenuPaneId: ""
	};
}
function closePanePlan(input = {}, options = {}) {
	const id = text(input.threadId || input.paneId).trim();
	const ids = uniqueIds(input.ids || input.activeIds || []);
	if (input.enabled !== true) return skipPaneSlot("disabled", {
		id,
		ids
	});
	if (input.layoutEnabled !== true) return skipPaneSlot("layout-disabled", {
		id,
		ids
	});
	if (!id) return skipPaneSlot("missing-id", {
		id,
		ids
	});
	if (!ids.includes(id)) return skipPaneSlot("pane-not-visible", {
		id,
		ids
	});
	const minCount = Math.max(1, Math.floor(Number(input.minCount || 1)) || 1);
	if (ids.length <= minCount) return skipPaneSlot("min-pane-count", {
		id,
		ids,
		minCount
	});
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
		scrollResetIds: [id]
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
function composerTargetPlan(input = {}, options = {}) {
	const newThreadDraft = input.newThreadDraft === true;
	const activeIds = normalizePinnedIds(input.activeIds || input.ids || [], { maxPanes: options.maxPanes || input.maxPanes });
	const tileContext = Boolean(input.threadTileMode === true && input.tileSurfaceActive === true && activeIds.length);
	const selectedThreadId = effectiveSelectedThreadId({
		enabled: input.threadTileMode === true,
		activeIds,
		selectedThreadId: input.selectedThreadId,
		currentThreadId: input.currentThreadId,
		maxPanes: options.maxPanes || input.maxPanes
	});
	const currentThreadId = text(input.currentThreadId).trim();
	return {
		action: "composer-target",
		reason: newThreadDraft ? "new-thread" : selectedThreadId ? "selected-pane" : currentThreadId ? "current-thread" : "missing-thread",
		mode: newThreadDraft ? "new-thread" : "thread",
		newThreadDraft,
		tileContext,
		activeIds,
		selectedThreadId,
		currentThreadId,
		targetThreadId: newThreadDraft ? "" : selectedThreadId || currentThreadId || ""
	};
}
function composerTargetPlaceholderPlan(input = {}) {
	if (input.newThreadDraft === true || String(input.mode || "") === "new-thread") return {
		action: "composer-target-placeholder",
		reason: "new-thread",
		showTargetPlaceholder: false,
		text: text(input.newThreadPlaceholder || "输入第一条消息")
	};
	const targetThreadId = text(input.targetThreadId).trim();
	const targetTitle = text(input.targetTitle || targetThreadId).trim();
	const showTargetPlaceholder = Boolean(input.tileContext === true && targetThreadId && input.hasTargetThread === true);
	return {
		action: "composer-target-placeholder",
		reason: showTargetPlaceholder ? "tile-target" : "default",
		showTargetPlaceholder,
		text: showTargetPlaceholder ? `发送到：${targetTitle || targetThreadId}` : text(input.defaultPlaceholder || "Message Codex")
	};
}
function composerActionControlPlan(input = {}) {
	const newThreadDraft = input.newThreadDraft === true || input.hasNewThreadDraft === true;
	const hasThread = input.hasThread === true;
	const composerBusy = input.composerBusy === true;
	const attachmentProcessingCount = Math.max(0, Math.floor(Number(input.attachmentProcessingCount || 0)) || 0);
	const hasContent = input.hasContent === true;
	const hasActiveTurn = Boolean(!newThreadDraft && text(input.targetActiveTurnId || input.activeTurnId).trim());
	const disabled = !(hasThread || newThreadDraft) || composerBusy || attachmentProcessingCount > 0;
	const interruptMode = hasActiveTurn && !hasContent;
	const steerMode = hasActiveTurn && hasContent;
	const retryMode = Boolean(text(input.sendButtonHint).trim() || input.showRetryHint === true);
	const goalCommandMode = input.goalCommandMode === true;
	const bareIntentKind = text(input.bareIntentKind).trim();
	const commandMode = input.commandMode === true;
	const steeringBusy = Boolean(input.steeringBusy === true || input.steering === true);
	const voiceGestureAvailable = input.voiceGestureAvailable === true;
	const hermesEmbedMode = input.hermesEmbedMode === true;
	const bareIntentTitle = text(input.bareIntentTitle || input.intentTitle).trim();
	let mode = "send";
	let reason = "send";
	let label = "Send";
	let title = newThreadDraft ? "Create new chat" : "Send message";
	let labelProxy = false;
	if (interruptMode) {
		mode = "interrupt";
		reason = "active-turn-interrupt";
		label = "Stop";
		title = "Interrupt current turn";
		labelProxy = hermesEmbedMode;
	} else if (composerBusy) {
		mode = "busy";
		reason = steeringBusy ? "steering-sending" : "message-sending";
		label = steeringBusy ? "引导中…" : "发送中…";
		title = steeringBusy ? "Steering current turn" : "Message is sending";
	} else if (retryMode) {
		mode = "retry";
		reason = "retry";
		label = "重试";
		title = "Retry sending message";
	} else if (goalCommandMode) {
		mode = "goal";
		reason = "goal-command";
		label = "Goal";
		title = "Open goal dialog";
	} else if (bareIntentKind) {
		mode = "intent";
		reason = "bare-intent";
		label = "Open";
		title = bareIntentTitle || "Open composer action";
	} else if (commandMode) {
		mode = "task-card";
		reason = "task-card-command";
		label = "Task card";
		title = "Ask Codex to draft a cross-thread task card";
	} else if (steerMode) {
		mode = "steer";
		reason = "active-turn-steer";
		label = "引导";
		title = "Guide the current running turn";
	}
	if (voiceGestureAvailable && !composerBusy && !interruptMode) title = `${title || "Send"}；按住录音，松开转写`;
	const ariaLabel = voiceGestureAvailable && !composerBusy && !interruptMode ? `${label || "Send"}。按住可语音输入` : interruptMode && hermesEmbedMode ? "Stop。按住可语音输入，轻点可中断当前任务" : "";
	return {
		action: "composer-action-control",
		reason,
		mode,
		disabled,
		sendButtonDisabled: disabled || !interruptMode && !hasContent && !voiceGestureAvailable,
		interruptMode,
		steerMode,
		hasContent,
		voiceGestureAvailable,
		label,
		labelProxy,
		title,
		ariaLabel,
		classState: {
			interruptMode,
			sending: mode === "busy",
			sendFailed: mode === "retry",
			steerMode: mode === "steer" || mode === "busy" && steeringBusy,
			pluginVoiceInputGesture: voiceGestureAvailable
		}
	};
}
function composerDraftRuntimeSelectionPlan(input = {}) {
	const draft = input.draft && typeof input.draft === "object" ? input.draft : null;
	const hasDraft = Boolean(draft);
	const newThreadDraft = input.newThreadDraft === true;
	const model = text(draft && draft.model).trim();
	const effort = text(draft && draft.effort).trim();
	const permissionMode = text(input.effectivePermissionMode || input.permissionMode).trim();
	const modelOptions = new Set((Array.isArray(input.modelOptions) ? input.modelOptions : []).map((value) => text(value).trim()).filter(Boolean));
	const effortOptions = new Set((Array.isArray(input.reasoningEffortOptions || input.effortOptions) ? input.reasoningEffortOptions || input.effortOptions : []).map((value) => text(value).trim()).filter(Boolean));
	const permissionOptions = new Set((Array.isArray(input.permissionModeOptions) ? input.permissionModeOptions : []).map((value) => text(value).trim()).filter(Boolean));
	const resetRuntimeWhenMissingDraft = input.resetRuntimeWhenMissingDraft === true;
	const defaultNewThreadModel = text(input.defaultNewThreadModel).trim();
	const defaultNewThreadEffort = text(input.defaultNewThreadEffort).trim();
	const defaultNewThreadPermissionMode = text(input.defaultNewThreadPermissionMode).trim();
	const plan = {
		action: "composer-draft-runtime-selection",
		reason: newThreadDraft ? hasDraft ? "new-thread-draft" : "new-thread-defaults" : hasDraft ? "thread-draft" : resetRuntimeWhenMissingDraft ? "missing-draft-reset" : "missing-draft-keep",
		mode: newThreadDraft ? "new-thread" : "thread",
		hasDraft,
		newThreadDraft,
		fastMode: Boolean(draft && draft.fastMode === true),
		clearNewThreadTitle: !newThreadDraft,
		setNewThreadRuntime: newThreadDraft,
		setThreadRuntime: !newThreadDraft && (hasDraft || resetRuntimeWhenMissingDraft),
		newThreadTitle: "",
		newThreadModel: "",
		newThreadEffort: "",
		newThreadPermissionMode: "",
		composerModel: "",
		composerEffort: "",
		composerPermissionMode: ""
	};
	if (newThreadDraft) {
		plan.newThreadTitle = text(draft && draft.threadTitle).trim();
		plan.newThreadModel = model && modelOptions.has(model) ? model : defaultNewThreadModel;
		plan.newThreadEffort = effort && effortOptions.has(effort) ? effort : defaultNewThreadEffort;
		plan.newThreadPermissionMode = permissionMode || defaultNewThreadPermissionMode;
		return plan;
	}
	if (!hasDraft && !resetRuntimeWhenMissingDraft) return plan;
	plan.composerModel = model && modelOptions.has(model) ? model : "";
	plan.composerEffort = effort && effortOptions.has(effort) ? effort : "";
	plan.composerPermissionMode = permissionMode && permissionOptions.has(permissionMode) ? permissionMode : "";
	return plan;
}
function displaySettingsPayload(input = {}, options = {}) {
	const paneThreadIds = normalizePinnedIds(input.paneThreadIds || input.threadTilePinnedIds || [], options);
	const paneCountInput = Object.prototype.hasOwnProperty.call(input, "paneCount") ? input.paneCount : input.threadTilePaneCount;
	return {
		displayMode: Boolean(input.threadTileMode) || String(input.displayMode || "").toLowerCase() === "tile" ? "tile" : "single",
		paneThreadIds,
		paneCount: normalizePaneCount(paneCountInput, {
			fallback: 0,
			maxPanes: options.maxPanes
		}),
		paneSplitPairs: normalizeSplitPairs(input.paneSplitPairs || input.threadTileSplitPairs || [], paneThreadIds, options),
		selectedThreadId: String(input.selectedThreadId || input.threadTileSelectedThreadId || "")
	};
}
function normalizeDisplaySettings(settings = {}, options = {}) {
	const displayMode = String(settings.displayMode || (settings.threadTileMode ? "tile" : "single")).toLowerCase() === "tile" ? "tile" : "single";
	const paneThreadIds = normalizePinnedIds(settings.paneThreadIds || settings.threadTilePinnedIds || [], options);
	const paneSplitPairs = normalizeSplitPairs(settings.paneSplitPairs || settings.threadTileSplitPairs || settings.splitPairs || [], paneThreadIds, options);
	const paneCountInput = Object.prototype.hasOwnProperty.call(settings, "paneCount") ? settings.paneCount : Object.prototype.hasOwnProperty.call(settings, "threadTilePaneCount") ? settings.threadTilePaneCount : settings.tilePaneCount;
	const selected = String(settings.selectedThreadId || "").trim();
	return {
		displayMode,
		threadTileMode: displayMode === "tile",
		paneThreadIds,
		paneSplitPairs,
		paneCount: normalizePaneCount(paneCountInput, {
			fallback: 0,
			maxPanes: options.maxPanes
		}),
		selectedThreadId: selected && paneThreadIds.includes(selected) ? selected : ""
	};
}
function displaySettingsLoadPlan(input = {}) {
	const localDisplayMode = text(input.localDisplayMode).trim().toLowerCase() === "tile" ? "tile" : "single";
	const settings = input.settings && typeof input.settings === "object" ? input.settings : {};
	if (input.loadFailed === true) return {
		action: localDisplayMode === "tile" ? "apply-display-settings" : "skip",
		reason: localDisplayMode === "tile" ? "load-error-local-tile" : "load-error-no-local-tile",
		settings: localDisplayMode === "tile" ? { displayMode: "tile" } : null,
		saveAfterApply: false,
		rethrow: true
	};
	const source = text(settings.source || input.source).trim();
	if (source !== "runtime" && localDisplayMode === "tile") return {
		action: "apply-display-settings",
		reason: "legacy-local-tile-migration",
		settings: {
			displayMode: "tile",
			paneThreadIds: [],
			selectedThreadId: ""
		},
		saveAfterApply: true,
		rethrow: false
	};
	return {
		action: "apply-display-settings",
		reason: source === "runtime" ? "runtime-settings" : "default-settings",
		settings,
		saveAfterApply: false,
		rethrow: false
	};
}
function syncPinnedIdsFromActiveIds(input = {}, options = {}) {
	const activeIds = normalizePinnedIds(input.activeIds || [], options);
	const currentPinnedIds = normalizePinnedIds(input.pinnedIds || input.threadTilePinnedIds || [], options);
	if (input.enabled === false || !activeIds.length) return {
		changed: false,
		paneThreadIds: currentPinnedIds,
		paneSplitPairs: input.splitPairs || []
	};
	const visibleIds = new Set((input.visibleIds || []).map((id) => String(id || "").trim()).filter(Boolean));
	if (idsEqual(currentPinnedIds.filter((id) => visibleIds.has(id)).slice(0, activeIds.length), activeIds)) return {
		changed: false,
		paneThreadIds: currentPinnedIds,
		paneSplitPairs: input.splitPairs || []
	};
	const remaining = currentPinnedIds.filter((id) => !activeIds.includes(id));
	const paneThreadIds = normalizePinnedIds([...activeIds, ...remaining], options);
	return {
		changed: true,
		paneThreadIds,
		paneSplitPairs: normalizeSplitPairs(input.splitPairs || [], paneThreadIds, options)
	};
}
function activePaneSyncPlan(input = {}, options = {}) {
	const activeIds = normalizePinnedIds(input.activeIds || [], options);
	const selectedThreadId = text(input.selectedThreadId).trim();
	const currentPinnedIds = normalizePinnedIds(input.pinnedIds || input.threadTilePinnedIds || [], options);
	const splitPairs = Array.isArray(input.splitPairs || input.threadTileSplitPairs) ? input.splitPairs || input.threadTileSplitPairs : [];
	if (input.enabled !== true || !activeIds.length) return {
		action: "sync-active-panes",
		reason: input.enabled === true ? "no-active-panes" : "disabled",
		changed: Boolean(selectedThreadId),
		settingsChanged: false,
		pinnedChanged: false,
		selectedChanged: Boolean(selectedThreadId),
		activeIds,
		paneThreadIds: currentPinnedIds,
		paneSplitPairs: splitPairs,
		selectedThreadId: ""
	};
	const pinned = syncPinnedIdsFromActiveIds({
		enabled: true,
		activeIds,
		pinnedIds: currentPinnedIds,
		visibleIds: input.visibleIds,
		splitPairs
	}, options);
	const nextSelectedThreadId = effectiveSelectedThreadId({
		enabled: true,
		activeIds,
		selectedThreadId,
		currentThreadId: input.currentThreadId,
		maxPanes: options.maxPanes
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
		selectedThreadId: nextSelectedThreadId
	};
}
function normalizeOperationMode(mode) {
	return text(mode) === "expanded" ? "expanded" : "compact";
}
function toggleOperationMode(mode) {
	return normalizeOperationMode(mode) === "expanded" ? "compact" : "expanded";
}
function operationModeTogglePlan(input = {}) {
	const id = text(input.threadId || input.paneId).trim();
	if (input.enabled !== true) return skipPaneSlot("disabled", { id });
	if (!id) return skipPaneSlot("missing-id", { id });
	const previousMode = normalizeOperationMode(input.mode || input.currentMode);
	return {
		action: "operation-mode-toggle-effects",
		reason: "toggle-operation-mode",
		id,
		previousMode,
		mode: toggleOperationMode(previousMode),
		selectPane: true,
		selectPaneRender: false,
		patchThreadId: id,
		patchPreserveScroll: true,
		scheduleFullRenderOnPatchMiss: true
	};
}
function operationBubbleRecord(input = {}) {
	const id = text(input.threadId).trim();
	const html = text(input.html);
	const marker = text(input.bubbleMarker || "mobile-operation-bubble");
	if (!id || !html || !html.includes(marker)) return null;
	const minVisibleMs = Math.max(0, Number(input.minVisibleMs || 500));
	return {
		html,
		visibleUntilMs: nowValue(input.nowMs) + minVisibleMs
	};
}
function operationBubbleSnapshot(record, input = {}) {
	if (!record) return {
		visible: false,
		html: "",
		remainingMs: 0,
		expired: false
	};
	const remainingMs = Number(record.visibleUntilMs || 0) - nowValue(input.nowMs);
	if (remainingMs <= 0) return {
		visible: false,
		html: "",
		remainingMs: 0,
		expired: true
	};
	return {
		visible: true,
		html: text(record.html),
		remainingMs,
		expired: false
	};
}
function operationDockPlan(input = {}) {
	const id = text(input.threadId || input.id).trim();
	const mode = normalizeOperationMode(input.mode);
	const expanded = mode === "expanded";
	if (!id) return {
		action: "none",
		reason: "missing-id",
		id: "",
		mode,
		expanded
	};
	const entryType = text(input.entryType || input.operationType);
	if (input.hasOperation === true || Boolean(entryType && entryType !== "liveTurnStatus")) return {
		action: "render-live-operation",
		reason: "active-operation",
		id,
		mode,
		expanded,
		remember: true
	};
	if (input.hasLiveTurn !== true) return {
		action: "none",
		reason: "no-live-turn",
		id,
		mode,
		expanded
	};
	const remembered = operationBubbleSnapshot(input.remembered, { nowMs: input.nowMs });
	if (remembered.visible) return {
		action: "render-remembered-operation",
		reason: "remembered-visible",
		id,
		mode,
		expanded,
		html: remembered.html,
		remainingMs: remembered.remainingMs,
		scheduleMinimumRefresh: true
	};
	if (remembered.expired) return {
		action: "clear-remembered-operation",
		reason: "remembered-expired",
		id,
		mode,
		expanded,
		clearRemembered: true
	};
	return {
		action: "none",
		reason: "no-remembered-operation",
		id,
		mode,
		expanded
	};
}
function operationSignature(input = {}) {
	const remembered = operationBubbleSnapshot(input.remembered, { nowMs: input.nowMs });
	return {
		mode: normalizeOperationMode(input.mode),
		rememberedVisible: remembered.visible,
		entry: input.entrySignature || null
	};
}
function operationMinimumRefreshPlan(input = {}) {
	const activeIds = uniqueIds(input.activeIds || input.ids || []);
	if (input.enabled !== true) return {
		action: "operation-minimum-refresh",
		reason: "disabled",
		patchThreadIds: [],
		fullRenderOnPatchMiss: false
	};
	return {
		action: "operation-minimum-refresh",
		reason: activeIds.length ? "patch-active-panes" : "no-active-panes",
		patchThreadIds: activeIds,
		fullRenderOnPatchMiss: true
	};
}
function paneRenderFramePlan(input = {}) {
	const id = text(input.threadId || input.paneId).trim();
	if (!id) return {
		action: "skip",
		reason: "missing-id",
		id: "",
		scheduleFrame: false,
		returnValue: false,
		fullRenderOnPatchMiss: false
	};
	if (input.enabled !== true) return {
		action: "skip",
		reason: "disabled",
		id,
		scheduleFrame: false,
		returnValue: false,
		fullRenderOnPatchMiss: false
	};
	if (input.visible !== true) return {
		action: "skip",
		reason: "pane-not-visible",
		id,
		scheduleFrame: false,
		returnValue: false,
		fullRenderOnPatchMiss: false
	};
	if (input.hasFrame === true) return {
		action: "already-scheduled",
		reason: "frame-active",
		id,
		scheduleFrame: false,
		returnValue: true,
		fullRenderOnPatchMiss: false
	};
	return {
		action: "schedule-pane-render",
		reason: "ready",
		id,
		scheduleFrame: true,
		returnValue: true,
		fullRenderOnPatchMiss: input.fullRenderOnPatchMiss !== false
	};
}
function booleanFact(input = {}, key) {
	return Object.prototype.hasOwnProperty.call(input, key) ? input[key] === true : null;
}
function panePatchPreflightSkip(reason, details = {}) {
	return Object.assign({
		action: "skip",
		reason,
		canPatch: false,
		shouldContinue: false,
		id: "",
		ids: []
	}, details);
}
function panePatchPreflightPlan(input = {}) {
	const id = text(input.threadId || input.paneId).trim();
	const hasIds = Array.isArray(input.ids || input.activeIds);
	const ids = uniqueIds(input.ids || input.activeIds || []);
	if (!id) return panePatchPreflightSkip("missing-id", {
		id: "",
		ids
	});
	if (input.enabled !== true) return panePatchPreflightSkip("disabled", {
		id,
		ids
	});
	if (input.visible !== true) return panePatchPreflightSkip("pane-not-visible", {
		id,
		ids
	});
	const conversationPresent = booleanFact(input, "conversationPresent");
	if (conversationPresent === false) return panePatchPreflightSkip("missing-conversation", {
		id,
		ids
	});
	const tileSurface = booleanFact(input, "tileSurface");
	if (tileSurface === false) return panePatchPreflightSkip("not-tile-surface", {
		id,
		ids
	});
	const boardPresent = booleanFact(input, "boardPresent");
	if (boardPresent === false) return panePatchPreflightSkip("missing-board", {
		id,
		ids
	});
	const layoutEnabled = booleanFact(input, "layoutEnabled");
	if (layoutEnabled === false) return panePatchPreflightSkip("layout-disabled", {
		id,
		ids
	});
	if (hasIds && !ids.includes(id)) return panePatchPreflightSkip("pane-not-candidate", {
		id,
		ids
	});
	const panePresent = booleanFact(input, "panePresent");
	if (panePresent === false) return panePatchPreflightSkip("missing-pane", {
		id,
		ids
	});
	const factsComplete = conversationPresent === true && tileSurface === true && boardPresent === true && layoutEnabled === true && panePresent === true && hasIds;
	return {
		action: factsComplete ? "patch-pane" : "continue",
		reason: factsComplete ? "ready" : "pending-facts",
		canPatch: factsComplete,
		shouldContinue: true,
		id,
		ids
	};
}
function panePatchCompletionSkip(reason, details = {}) {
	return Object.assign({
		action: "skip",
		reason,
		id: "",
		returnValue: false,
		hydrate: false,
		restoreScroll: false,
		updateBottomButton: false,
		updateBottomButtonMode: "none",
		writeRenderSignature: false,
		clearPatchShellSignature: false,
		bindActions: false
	}, details);
}
function panePatchCompletionPlan(input = {}) {
	const id = text(input.threadId || input.paneId).trim();
	if (!id) return panePatchCompletionSkip("missing-id");
	if (input.sourcePanePresent !== true) return panePatchCompletionSkip("missing-source-pane", { id });
	if (!Object.prototype.hasOwnProperty.call(input, "patchedPanePresent")) return Object.assign(panePatchCompletionSkip("source-pane-ready", { id }), {
		action: "continue",
		returnValue: true
	});
	if (input.patchedPanePresent === false) return panePatchCompletionSkip("missing-patched-pane", { id });
	return {
		action: "complete-pane-patch",
		reason: "ready",
		id,
		returnValue: true,
		hydrate: true,
		restoreScroll: true,
		updateBottomButton: true,
		updateBottomButtonMode: input.requestAnimationFrameAvailable === true ? "animation-frame" : "sync",
		writeRenderSignature: true,
		clearPatchShellSignature: true,
		bindActions: true
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
	if (input.enabled !== true) return {
		schedule: false,
		clearTimer: true,
		reason: "disabled",
		activeIds,
		delayMs: 0
	};
	if (text(input.visibilityState) === hiddenValue) return {
		schedule: false,
		clearTimer: true,
		reason: "hidden",
		activeIds,
		delayMs: 0
	};
	if (!activeIds.length) return {
		schedule: false,
		clearTimer: false,
		reason: "no-active-panes",
		activeIds,
		delayMs: 0
	};
	if (input.hasTimer === true) return {
		schedule: false,
		clearTimer: false,
		reason: "timer-active",
		activeIds,
		delayMs: 0
	};
	return {
		schedule: true,
		clearTimer: false,
		reason: "schedule",
		activeIds,
		delayMs: refreshDelayMs(input.delayMs, options)
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
	const readyIds = uniqueIds(input.readyIds || []);
	if (input.enabled !== true) return {
		action: "skip",
		reason: "disabled",
		activeIds,
		controllerIds,
		loadingIds,
		readyIds,
		abortIds: [],
		loadIds: [],
		deferredIds: [],
		busyIds: [],
		maxConcurrentLoads: 0,
		availableSlots: 0,
		scheduleDrainAfterLoad: false
	};
	const activeSet = new Set(activeIds);
	const controllerSet = new Set(controllerIds);
	const loadingSet = new Set(loadingIds);
	const readySet = new Set(readyIds);
	const abortIds = controllerIds.filter((id) => !activeSet.has(id));
	const busyIds = uniqueIds([...controllerIds.filter((id) => activeSet.has(id)), ...loadingIds.filter((id) => activeSet.has(id))]);
	const parsedMax = Math.floor(Number(input.maxConcurrentLoads));
	const maxConcurrentLoads = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : Math.max(1, activeIds.length || 12);
	const availableSlots = Math.max(0, maxConcurrentLoads - busyIds.length);
	const candidates = activeIds.filter((id) => !controllerSet.has(id) && !loadingSet.has(id) && !readySet.has(id));
	const loadIds = candidates.slice(0, availableSlots);
	const deferredIds = candidates.slice(availableSlots);
	const scheduleDrainAfterLoad = deferredIds.length > 0 && loadIds.length > 0;
	return {
		action: "detail-load-queue",
		reason: !activeIds.length ? "no-active-panes" : deferredIds.length ? "max-concurrency" : "queue",
		activeIds,
		controllerIds,
		loadingIds,
		readyIds,
		abortIds,
		loadIds,
		deferredIds,
		busyIds,
		maxConcurrentLoads,
		availableSlots,
		scheduleDrainAfterLoad
	};
}
function detailLoadConcurrencyPlan(input = {}, options = {}) {
	const activeIds = uniqueIds(input.activeIds || input.ids || []);
	const maxPanes = maxPaneLimit(input.maxPanes || options.maxPanes || 12);
	const configuredInput = Object.prototype.hasOwnProperty.call(input, "maxConcurrentLoads") ? input.maxConcurrentLoads : Object.prototype.hasOwnProperty.call(input, "configuredMaxConcurrentLoads") ? input.configuredMaxConcurrentLoads : options.defaultMaxConcurrentLoads;
	const parsed = Math.floor(Number(configuredInput));
	const boundedConfiguredMax = Math.max(1, Math.min(maxPanes, Number.isFinite(parsed) && parsed > 0 ? parsed : 4));
	const maxConcurrentLoads = activeIds.length ? Math.max(1, Math.min(activeIds.length, boundedConfiguredMax)) : boundedConfiguredMax;
	return {
		action: "detail-load-concurrency",
		reason: activeIds.length ? "active-panes" : "no-active-panes",
		activeIds,
		activeCount: activeIds.length,
		configuredMaxConcurrentLoads: boundedConfiguredMax,
		maxConcurrentLoads
	};
}
function detailLoadQueueDrainPlan(input = {}, options = {}) {
	const activeIds = uniqueIds(input.activeIds || input.ids || []);
	const delayMs = Math.max(0, Number(input.delayMs || options.defaultDelayMs || 0));
	if (input.enabled !== true) return {
		schedule: false,
		clearTimer: true,
		reason: "disabled",
		activeIds,
		delayMs: 0
	};
	if (!activeIds.length) return {
		schedule: false,
		clearTimer: true,
		reason: "no-active-panes",
		activeIds,
		delayMs: 0
	};
	if (input.hasTimer === true) return {
		schedule: false,
		clearTimer: false,
		reason: "timer-active",
		activeIds,
		delayMs: 0
	};
	if (input.pending !== true && input.force !== true) return {
		schedule: false,
		clearTimer: false,
		reason: "no-pending-loads",
		activeIds,
		delayMs: 0
	};
	return {
		schedule: true,
		clearTimer: false,
		reason: input.force === true ? "load-settled" : "deferred-loads",
		activeIds,
		delayMs
	};
}
function detailLoadPlan(input = {}) {
	const id = text(input.threadId).trim();
	if (!id) return {
		action: "skip",
		reason: "missing-id",
		id: ""
	};
	if (text(input.currentThreadId).trim() === id && input.currentThreadLoaded === true) return {
		action: "skip",
		reason: "current-thread-loaded",
		id
	};
	if (input.controllerActive === true) return {
		action: "skip",
		reason: "controller-active",
		id
	};
	if (input.loadingActive === true) return {
		action: "skip",
		reason: "loading-active",
		id
	};
	const cachedReady = input.cachedReady === true;
	const force = input.force === true;
	const nowMs = nowValue(input.nowMs);
	const lastLoadedAt = Number(input.lastLoadedAt || 0);
	const minIntervalMs = Math.max(0, Number(input.minIntervalMs || 0));
	if (!force && cachedReady) return {
		action: "skip",
		reason: "cached-ready",
		id
	};
	if (force && lastLoadedAt && nowMs - lastLoadedAt < minIntervalMs) return {
		action: "skip",
		reason: "min-refresh-interval",
		id
	};
	const background = Boolean(input.backgroundRequested === true && cachedReady);
	return {
		action: "load",
		reason: background ? "background-refresh" : "load",
		id,
		background,
		markLoading: !background,
		clearError: !background
	};
}
function detailLoadStartEffectsPlan(plan = {}) {
	const sourceAction = text(plan.action).trim();
	const id = text(plan.id || plan.threadId).trim();
	if (sourceAction !== "load") return skipPaneSlot("unsupported-detail-load-plan", {
		sourceAction,
		id
	});
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
		preserveScroll: true
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
		mergeThread: true
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
		errorMessage: text(input.errorMessage || input.message || input.error).trim()
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
		scheduleQueueDrain: true
	};
}
var api$1 = {
	DEFAULT_DETAIL_LOAD_MAX_CONCURRENT: 4,
	DEFAULT_OPERATION_BUBBLE_MIN_VISIBLE_MS: 500,
	DEFAULT_USER_MAX_PANES: 12,
	activePaneSyncPlan,
	candidatePaneIdsPlan,
	closePanePlan,
	composerActionControlPlan,
	composerDraftRuntimeSelectionPlan,
	composerTargetPlaceholderPlan,
	composerTargetPlan,
	displaySettingsPayload,
	displaySettingsLoadPlan,
	dropPaneIntent,
	effectiveSelectedThreadId,
	idsEqual,
	layoutCapacity,
	normalizeDisplaySettings,
	normalizeOperationMode,
	normalizePaneCount,
	normalizePinnedIds,
	normalizeSplitPairs,
	operationModeTogglePlan,
	operationBubbleRecord,
	operationBubbleSnapshot,
	operationDockPlan,
	operationMinimumRefreshPlan,
	operationSignature,
	paneBottomButtonPlan,
	paneCountChangePlan,
	paneCountStatePlan,
	paneDisplayLayoutPlan,
	panePatchCompletionPlan,
	panePatchPreflightPlan,
	paneRenderFramePlan,
	paneRenderSignaturePlan,
	paneSelectionPlan,
	paneSlotMutationEffectsPlan,
	paneScrollHoldPlan,
	paneScrollMetrics,
	paneScrollRestorePlan,
	prependSplitPair,
	detailLoadPlan,
	detailLoadErrorEffectsPlan,
	detailLoadFinallyEffectsPlan,
	detailLoadConcurrencyPlan,
	detailLoadQueueDrainPlan,
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
	threadTileVerticalChromePlan,
	threadTileViewportBaselinePlan,
	toggleOperationMode,
	uniqueIds
};
//#endregion
//#region frontend/native/thread-tile-runtime.mjs
var root = typeof globalThis !== "undefined" ? globalThis : window;
function createThreadTileRuntime(deps = {}) {
	const { state, $, api, document, window, localStorage, setTimeout, clearTimeout, AbortController, THREAD_TILE_USER_MAX_PANES, THREAD_TILE_DETAIL_LOAD_QUEUE_DRAIN_MS, THREAD_TILE_REFRESH_INTERVAL_MS, THREAD_TILE_REFRESH_MIN_INTERVAL_MS, THREAD_TILE_SETTINGS_SAVE_DEBOUNCE_MS, STORAGE_THREAD_DISPLAY_MODE, STORAGE_LEGACY_THREAD_TILE_MODE, LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS, threadTileActionsApi, threadTileStatePolicy, threadTileLayoutPolicy, threadDetailPatchPlanApi, isKeyboardEditableElement, splitPaneSidebarVisible, isMenuOverlayMode, visibleThreads, isRunningStatus, saveCurrentDraftNow, restoreDraftForCurrentTarget, renderComposerSettings, updateComposerControls, scheduleRenderCurrentThread, renderCurrentThread, showError, threadById, threadDisplayName, shortPath, formatTime, statusIconHtml, threadDetailApiPath, mergeThreadPreservingVisibleItems, mergeThreadIntoThreadList, withRenderContextThread, visibleItemsForTurn, renderVisibleItemPatchHtml, renderTurnVisibleItemBudgetNotice, approvalsForTurn, renderApprovalRequest, approvalTurnId, isApprovalActive, currentLiveOperationEntry, latestLiveTurnForThread, renderMobileOperationStack, visibleItemSignature, threadTitleForDisplay, turnTimerStateHtml, threadTilePaneTimerState, threadHasVisibleConversationTurns, threadReadWarningMessage, visibleTurnsForConversation, renderThreadHistoryNote, renderPendingApprovals, effectiveThreadTileSelectedThreadId, conversationRenderSignature, existingConversationRenderKeys, patchNode, hydrateThreadDetailSurface, clearGlobalLiveOperationDockForThreadTiles, updateConversationHtml, threadTileVisibleShape, threadTileDomTurnCount, conversationDomShape, diagnosticHash, publishPluginNavigationState, escapeHtml } = Object.assign({
		document: root.document || {},
		window: root.window || root,
		localStorage: root.localStorage || {
			getItem: () => null,
			setItem: () => {},
			removeItem: () => {}
		},
		setTimeout: typeof root.setTimeout === "function" ? root.setTimeout.bind(root) : () => 0,
		clearTimeout: typeof root.clearTimeout === "function" ? root.clearTimeout.bind(root) : () => {},
		AbortController: root.AbortController
	}, deps);
	function updateThreadTileGlobalHeader(layout = null, ids = []) {
		const titleEl = $("threadTitle");
		const metaEl = $("threadMeta");
		if (titleEl) titleEl.textContent = "";
		if (metaEl) metaEl.textContent = "";
	}
	function viewportPixelSize(options = {}) {
		const visualViewport = window.visualViewport;
		const visualWidth = Math.round(visualViewport && visualViewport.width || 0);
		const visualHeight = Math.round(visualViewport && visualViewport.height || 0);
		const layoutWidth = Math.round(window.innerWidth || document.documentElement.clientWidth || 0);
		const layoutHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
		if (options.preferLayoutViewport) return {
			width: Math.max(layoutWidth, visualWidth),
			height: Math.max(layoutHeight, visualHeight)
		};
		return {
			width: Math.round(visualWidth || layoutWidth || 0),
			height: Math.round(visualHeight || layoutHeight || 0)
		};
	}
	function isCoarsePointerViewport() {
		return Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
	}
	function isThreadTileKeyboardFocusActive() {
		return Boolean(state.threadTileMode && isKeyboardEditableElement(document.activeElement));
	}
	function threadTileViewportSize() {
		const layoutViewport = viewportPixelSize({ preferLayoutViewport: true });
		const plan = threadTileStatePolicy.threadTileViewportBaselinePlan({
			keyboardActive: isThreadTileKeyboardFocusActive(),
			layoutViewport,
			baseline: state.threadTileViewportBaseline
		});
		if (plan.updateBaseline) state.threadTileViewportBaseline = plan.nextBaseline;
		return plan.viewport;
	}
	function threadTileVerticalChromePx() {
		const plan = threadTileStatePolicy.threadTileVerticalChromePlan({
			keyboardActive: isThreadTileKeyboardFocusActive(),
			composerHeightPx: state.composerHeightPx,
			baselineComposerHeightPx: state.threadTileComposerHeightBaselinePx
		});
		if (plan.updateBaseline) state.threadTileComposerHeightBaselinePx = plan.nextComposerHeightBaselinePx;
		return plan.verticalChromePx;
	}
	function threadTileLayout(options = {}) {
		const viewport = threadTileViewportSize();
		const sidebar = $("sidebar");
		const sidebarSplitVisible = splitPaneSidebarVisible();
		const menuOverlay = isMenuOverlayMode() || !sidebarSplitVisible;
		const sidebarWidth = sidebar && sidebarSplitVisible ? Math.round(sidebar.getBoundingClientRect().width || 0) : 0;
		return threadTileLayoutPolicy.layoutForViewport({
			enabled: Object.prototype.hasOwnProperty.call(options, "enabled") ? options.enabled === true : state.threadTileMode,
			viewportWidth: viewport.width,
			viewportHeight: viewport.height,
			sidebarWidth,
			coarsePointer: isCoarsePointerViewport(),
			menuOverlay,
			maxPanes: THREAD_TILE_USER_MAX_PANES,
			recommendedMaxPanes: threadTileLayoutPolicy.DEFAULT_MAX_PANES,
			desiredPaneCount: normalizeThreadTilePaneCount(state.threadTilePaneCount, 0),
			verticalChromePx: threadTileVerticalChromePx()
		});
	}
	function normalizeThreadTilePaneCount(value, fallback = 0) {
		return threadTileStatePolicy.normalizePaneCount(value, {
			fallback,
			maxPanes: THREAD_TILE_USER_MAX_PANES
		});
	}
	function threadTileLayoutCapacity(layout = threadTileLayout()) {
		return threadTileStatePolicy.layoutCapacity(layout, {
			capacityMaxPanes: threadTileLayoutPolicy.DEFAULT_MAX_PANES,
			maxPanes: THREAD_TILE_USER_MAX_PANES
		});
	}
	function defaultThreadTileCandidateIds(layout = threadTileLayout(), options = {}) {
		const maxPanes = Math.max(1, Math.min(THREAD_TILE_USER_MAX_PANES, Math.floor(Number(options.maxPanes || layout && layout.maxPanes || 1)) || 1));
		const threadIds = visibleThreads(state.threads).map((thread) => thread && thread.id).filter(Boolean);
		return threadTileLayoutPolicy.selectThreadTileIds({
			currentThreadId: state.currentThreadId,
			threadIds,
			maxPanes
		});
	}
	function threadTileRunningPaneIds() {
		const runningIds = [];
		visibleThreads(state.threads).forEach((thread) => {
			const id = String(thread && thread.id || "");
			if (id && isRunningStatus(thread && thread.status)) runningIds.push(id);
		});
		if (state.currentThreadId) runningIds.push(String(state.currentThreadId));
		return threadTileStatePolicy.uniqueIds(runningIds);
	}
	function threadTilePaneCountState(layout = threadTileLayout()) {
		const capacity = threadTileLayoutCapacity(layout);
		return threadTileStatePolicy.paneCountStatePlan({
			capacity,
			candidateIds: defaultThreadTileCandidateIds(layout, { maxPanes: capacity }),
			maxCandidateIds: defaultThreadTileCandidateIds(layout, { maxPanes: THREAD_TILE_USER_MAX_PANES }),
			runningIds: threadTileRunningPaneIds(),
			currentThreadId: state.currentThreadId,
			explicitPaneCount: state.threadTilePaneCount
		}, { maxPanes: THREAD_TILE_USER_MAX_PANES });
	}
	function autoThreadTilePaneCount(layout = threadTileLayout()) {
		return threadTilePaneCountState(layout).autoPaneCount;
	}
	function effectiveThreadTilePaneCount(layout = threadTileLayout()) {
		return threadTilePaneCountState(layout).effectivePaneCount;
	}
	function threadTileDisplayLayout(layout = threadTileLayout(), ids = []) {
		return threadTileStatePolicy.paneDisplayLayoutPlan({
			layout,
			ids,
			effectivePaneCount: effectiveThreadTilePaneCount(layout),
			splitPairs: threadTilePrunedSplitPairs(ids)
		}, {
			capacityMaxPanes: threadTileLayoutPolicy.DEFAULT_MAX_PANES,
			maxPanes: THREAD_TILE_USER_MAX_PANES,
			threadTileColumnGroups: threadTileLayoutPolicy.threadTileColumnGroups
		}).displayLayout;
	}
	function normalizeThreadTilePinnedIds(values = []) {
		return threadTileStatePolicy.normalizePinnedIds(values, { maxPanes: THREAD_TILE_USER_MAX_PANES });
	}
	function normalizeThreadTileSplitPairs(values = [], ids = []) {
		return threadTileStatePolicy.normalizeSplitPairs(values, ids, {
			maxPanes: THREAD_TILE_USER_MAX_PANES,
			normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs
		});
	}
	function threadTilePrunedSplitPairs(ids = threadTileCandidateIds()) {
		return normalizeThreadTileSplitPairs(state.threadTileSplitPairs, ids);
	}
	function threadTileVisibleIdSet() {
		const visibleIds = new Set(visibleThreads(state.threads).map((thread) => String(thread && thread.id || "")).filter(Boolean));
		if (state.currentThreadId) visibleIds.add(String(state.currentThreadId));
		return visibleIds;
	}
	function threadTileIdsEqual(a = [], b = []) {
		return threadTileStatePolicy.idsEqual(a, b);
	}
	function threadTileCandidateIds(layout = threadTileLayout()) {
		const maxPanes = effectiveThreadTilePaneCount(layout);
		return threadTileStatePolicy.candidatePaneIdsPlan({
			pinnedIds: state.threadTilePinnedIds,
			defaultIds: defaultThreadTileCandidateIds(layout, { maxPanes }),
			visibleIds: Array.from(threadTileVisibleIdSet()),
			currentThreadId: state.currentThreadId,
			maxPanes
		}, {
			maxPanes: THREAD_TILE_USER_MAX_PANES,
			selectPinnedThreadTileIds: threadTileLayoutPolicy.selectPinnedThreadTileIds
		}).ids;
	}
	function threadDisplaySettingsPayload() {
		return threadTileStatePolicy.displaySettingsPayload({
			threadTileMode: state.threadTileMode,
			threadTilePinnedIds: state.threadTilePinnedIds,
			threadTilePaneCount: state.threadTilePaneCount,
			threadTileSplitPairs: state.threadTileSplitPairs,
			threadTileSelectedThreadId: state.threadTileSelectedThreadId
		}, {
			maxPanes: THREAD_TILE_USER_MAX_PANES,
			normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs
		});
	}
	function localThreadDisplayMode() {
		try {
			return localStorage.getItem(STORAGE_THREAD_DISPLAY_MODE) === "tile" || localStorage.getItem(STORAGE_LEGACY_THREAD_TILE_MODE) === "true" ? "tile" : "single";
		} catch (_) {
			return "single";
		}
	}
	function mirrorThreadDisplayModeToLocalStorage() {
		try {
			localStorage.removeItem(STORAGE_LEGACY_THREAD_TILE_MODE);
			if (state.threadTileMode) localStorage.setItem(STORAGE_THREAD_DISPLAY_MODE, "tile");
			else localStorage.removeItem(STORAGE_THREAD_DISPLAY_MODE);
		} catch (_) {}
	}
	function applyThreadDisplaySettings(settings = {}, options = {}) {
		const normalized = threadTileStatePolicy.normalizeDisplaySettings(settings, {
			maxPanes: THREAD_TILE_USER_MAX_PANES,
			normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs
		});
		state.threadTileMode = normalized.threadTileMode;
		state.threadTilePinnedIds = normalized.paneThreadIds;
		state.threadTileSplitPairs = normalized.paneSplitPairs;
		state.threadTilePaneCount = normalized.paneCount;
		state.threadTileSelectedThreadId = normalized.selectedThreadId;
		mirrorThreadDisplayModeToLocalStorage();
		syncThreadTileToggle();
		if (options.render === true) renderCurrentThread({ stickToBottom: true });
	}
	async function loadThreadDisplaySettings(options = {}) {
		try {
			const result = await api("/api/settings/thread-display");
			const settings = result && result.threadDisplay && typeof result.threadDisplay === "object" ? result.threadDisplay : {};
			state.threadDisplaySettingsLoaded = true;
			const plan = threadTileStatePolicy.displaySettingsLoadPlan({
				settings,
				localDisplayMode: localThreadDisplayMode()
			});
			if (plan.action === "apply-display-settings") applyThreadDisplaySettings(plan.settings || {}, { render: options.render === true });
			if (plan.saveAfterApply) await saveThreadDisplaySettingsNow();
		} catch (err) {
			state.threadDisplaySettingsLoaded = true;
			const plan = threadTileStatePolicy.displaySettingsLoadPlan({
				loadFailed: true,
				localDisplayMode: localThreadDisplayMode()
			});
			if (plan.action === "apply-display-settings") applyThreadDisplaySettings(plan.settings || {}, { render: options.render === true });
			if (plan.rethrow) throw err;
		}
	}
	async function saveThreadDisplaySettingsNow() {
		if (state.threadDisplaySettingsSaveTimer) {
			clearTimeout(state.threadDisplaySettingsSaveTimer);
			state.threadDisplaySettingsSaveTimer = null;
		}
		if (state.threadDisplaySettingsSaveInFlight) return null;
		state.threadDisplaySettingsSaveInFlight = true;
		try {
			const result = await api("/api/settings/thread-display", {
				method: "POST",
				body: JSON.stringify(threadDisplaySettingsPayload())
			});
			const settings = result && result.threadDisplay && typeof result.threadDisplay === "object" ? result.threadDisplay : null;
			if (settings) applyThreadDisplaySettings(settings, { render: false });
			return result;
		} finally {
			state.threadDisplaySettingsSaveInFlight = false;
		}
	}
	function scheduleThreadDisplaySettingsSave() {
		if (!state.threadDisplaySettingsLoaded) return;
		if (state.threadDisplaySettingsSaveTimer) clearTimeout(state.threadDisplaySettingsSaveTimer);
		state.threadDisplaySettingsSaveTimer = setTimeout(() => {
			state.threadDisplaySettingsSaveTimer = null;
			saveThreadDisplaySettingsNow().catch(showError);
		}, THREAD_TILE_SETTINGS_SAVE_DEBOUNCE_MS);
	}
	function syncThreadTileActivePaneState(activeIds = []) {
		const plan = threadTileStatePolicy.activePaneSyncPlan({
			enabled: state.threadTileMode,
			activeIds,
			pinnedIds: state.threadTilePinnedIds,
			visibleIds: Array.from(threadTileVisibleIdSet()),
			splitPairs: state.threadTileSplitPairs,
			selectedThreadId: state.threadTileSelectedThreadId,
			currentThreadId: state.currentThreadId
		}, {
			maxPanes: THREAD_TILE_USER_MAX_PANES,
			normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs
		});
		state.threadTileActiveIds = plan.activeIds;
		if (plan.pinnedChanged) {
			state.threadTilePinnedIds = normalizeThreadTilePinnedIds(plan.paneThreadIds);
			state.threadTileSplitPairs = normalizeThreadTileSplitPairs(plan.paneSplitPairs, state.threadTilePinnedIds);
		}
		if (plan.selectedChanged) state.threadTileSelectedThreadId = plan.selectedThreadId;
		if (plan.settingsChanged) scheduleThreadDisplaySettingsSave();
		return Boolean(plan.changed);
	}
	function threadTileSummary(threadId) {
		return threadById(threadId) || (state.currentThread && String(state.currentThread.id || "") === String(threadId || "") ? state.currentThread : null);
	}
	function threadTileDisplayThread(threadId) {
		const id = String(threadId || "");
		if (state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
		return state.threadTileDetails.get(id) || threadTileSummary(id) || {
			id,
			name: id,
			preview: id,
			turns: []
		};
	}
	function setThreadTileSelectedThread(threadId, options = {}) {
		const plan = threadTileStatePolicy.selectPanePlan({
			enabled: state.threadTileMode,
			threadId,
			activeIds: state.threadTileActiveIds,
			selectedThreadId: state.threadTileSelectedThreadId
		});
		if (plan.action !== "select-pane") return false;
		return applyThreadTileSelectedPaneEffects(threadTileStatePolicy.selectedPaneEffectsPlan(plan, { render: options.render !== false }));
	}
	function applyThreadTileSelectedPaneEffects(effect) {
		if (!effect || effect.action !== "selected-pane-effects") return false;
		if (effect.saveDraft) saveCurrentDraftNow();
		state.threadTileSelectedThreadId = effect.selectedThreadId;
		if (effect.restoreDraft) restoreDraftForCurrentTarget({ resetRuntimeWhenMissingDraft: true });
		if (effect.updateComposer) {
			renderComposerSettings();
			updateComposerControls();
		}
		if (effect.renderMode === "patch-panes") {
			let patchedAll = true;
			(Array.isArray(effect.patchThreadIds) ? effect.patchThreadIds : []).filter(Boolean).forEach((id) => {
				patchedAll = patchThreadTilePane(id, { preserveScroll: effect.patchPreserveScroll !== false }) && patchedAll;
			});
			if (!patchedAll && effect.scheduleFullRenderOnPatchMiss) scheduleRenderCurrentThread();
		}
		return true;
	}
	function threadTileVisibleThreadOptions(currentId = "") {
		const visible = visibleThreads(state.threads);
		const runningIds = visible.filter((thread) => thread && isRunningStatus(thread.status)).map((thread) => String(thread.id || "")).filter(Boolean);
		return threadTileStatePolicy.switchMenuOptionsPlan({
			currentId,
			activeIds: state.threadTileActiveIds,
			runningIds,
			visibleIds: visible.map((thread) => String(thread && thread.id || "")).filter(Boolean)
		});
	}
	function renderThreadTileSwitchMenu(currentId) {
		const current = String(currentId || "");
		const options = threadTileVisibleThreadOptions(current);
		const layout = threadTileLayout({ enabled: true });
		const activeIds = threadTileCandidateIds(layout);
		const count = activeIds.length || effectiveThreadTilePaneCount(layout);
		const minCount = threadTileMinimumPaneCount(layout);
		const maxCount = threadTileMaximumPaneCount(layout);
		const plan = threadTileStatePolicy.switchMenuPlan({
			currentId: current,
			switchMenuPaneId: state.threadTileSwitchMenuPaneId,
			options,
			activeIds,
			count,
			minCount,
			maxCount
		});
		if (plan.action !== "render-switch-menu") return "";
		return `<div class="thread-tile-switch-menu" role="listbox" aria-label="切换此窗口线程">
    <div class="thread-tile-switch-actions">
      <button class="thread-tile-switch-action" type="button" data-thread-tile-close-pane="${escapeHtml(plan.currentId)}"${plan.canClose ? "" : " disabled"}>关闭窗口</button>
      <span class="thread-tile-switch-count">${escapeHtml(String(plan.count))}/${escapeHtml(String(plan.maxCount))}</span>
      <button class="thread-tile-switch-action" type="button" data-thread-tile-pane-count="1"${plan.canAdd ? "" : " disabled"}>新增窗口</button>
    </div>
    ${plan.options.map((threadId) => {
			const thread = threadTileDisplayThread(threadId);
			const title = threadDisplayName(thread) || threadId;
			const summary = threadTileSummary(threadId) || thread;
			const pathText = shortPath(thread && thread.cwd || summary && summary.cwd || "") || "聊天";
			const timeText = formatTime(thread && thread.updatedAt || summary && summary.updatedAt, state.nowMs);
			const status = statusIconHtml(thread && thread.status, "thread-tile-switch-status", threadId);
			const selected = threadId === plan.currentId;
			return `<button class="thread-tile-switch-option${selected ? " selected" : ""}" type="button" role="option" aria-selected="${selected ? "true" : "false"}" data-thread-tile-switch-target="${escapeHtml(threadId)}">
        <span class="thread-tile-switch-main"><span class="thread-tile-switch-title">${escapeHtml(title)}</span><span class="thread-tile-switch-meta">${escapeHtml([pathText, timeText].filter(Boolean).join(" | "))}</span></span>
        ${status}
      </button>`;
		}).join("")}
  </div>`;
	}
	function applyThreadTilePaneSlotEffects(effect, layout = threadTileLayout()) {
		if (!effect || effect.action !== "pane-slot-effects") return false;
		const sourcePane = effect.patchSourceThreadId ? threadTilePaneElement(effect.patchSourceThreadId) : null;
		if (effect.saveDraft) saveCurrentDraftNow();
		if (Array.isArray(effect.paneThreadIds)) state.threadTilePinnedIds = normalizeThreadTilePinnedIds(effect.paneThreadIds);
		if (Array.isArray(effect.paneSplitPairs)) state.threadTileSplitPairs = normalizeThreadTileSplitPairs(effect.paneSplitPairs, state.threadTilePinnedIds);
		if (effect.paneCount !== null && effect.paneCount !== void 0) state.threadTilePaneCount = effect.paneCount;
		if (effect.refreshActiveIds) state.threadTileActiveIds = threadTileCandidateIds(layout);
		if (effect.selectedThreadId) state.threadTileSelectedThreadId = effect.selectedThreadId;
		if (effect.selectionPolicy === "pane-selection") state.threadTileSelectedThreadId = threadTileStatePolicy.paneSelectionPlan({
			selectedThreadId: state.threadTileSelectedThreadId,
			ids: threadTileCandidateIds(layout),
			emptyFallback: effect.selectionEmptyFallback === true
		}).selectedThreadId;
		state.threadTileSwitchMenuPaneId = effect.switchMenuPaneId || "";
		(effect.scrollResetIds || []).forEach((id) => state.threadTilePaneScrollHoldById.delete(id));
		if (effect.scheduleSettingsSave) scheduleThreadDisplaySettingsSave();
		if (effect.restoreDraft) restoreDraftForCurrentTarget({ resetRuntimeWhenMissingDraft: true });
		if (effect.updateComposer) {
			renderComposerSettings();
			updateComposerControls();
		}
		if (effect.loadThreadId) loadThreadTileDetail(effect.loadThreadId, {
			force: true,
			source: effect.loadSource || "tile-switch"
		}).catch(showError);
		if (effect.renderMode === "schedule-full") scheduleRenderCurrentThread();
		else if (effect.renderMode === "full") renderCurrentThread({ stickToBottom: Boolean(effect.renderStickToBottom) });
		else if (effect.renderMode === "patch-pane" && effect.patchThreadId) {
			if (!patchThreadTilePane(effect.patchThreadId, {
				paneElement: sourcePane,
				stickToBottom: Boolean(effect.patchStickToBottom)
			}) && effect.scheduleFullRenderOnPatchMiss) scheduleRenderCurrentThread();
		}
		return true;
	}
	function replaceThreadTilePaneThread(fromThreadId, toThreadId) {
		const from = String(fromThreadId || "").trim();
		const to = String(toThreadId || "").trim();
		if (!from || !to || !state.threadTileMode) return false;
		const layout = threadTileLayout();
		const ids = threadTileCandidateIds(layout);
		const plan = threadTileStatePolicy.replacePaneThreadPlan({
			enabled: state.threadTileMode,
			fromThreadId: from,
			toThreadId: to,
			ids,
			pinnedIds: state.threadTilePinnedIds
		}, { maxPanes: THREAD_TILE_USER_MAX_PANES });
		if (plan.action === "skip") return false;
		return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, { maxPanes: THREAD_TILE_USER_MAX_PANES }), layout);
	}
	function moveThreadTilePaneRelative(fromThreadId, toThreadId, placement = "after") {
		const from = String(fromThreadId || "").trim();
		const to = String(toThreadId || "").trim();
		if (!from || !to || from === to || !state.threadTileMode) return false;
		const layout = threadTileLayout();
		const ids = threadTileCandidateIds(layout);
		const plan = threadTileStatePolicy.movePaneRelativePlan({
			enabled: state.threadTileMode,
			fromThreadId: from,
			toThreadId: to,
			placement,
			ids,
			splitPairs: state.threadTileSplitPairs
		}, {
			maxPanes: THREAD_TILE_USER_MAX_PANES,
			normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs
		});
		if (plan.action !== "move") return false;
		return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, { maxPanes: THREAD_TILE_USER_MAX_PANES }), layout);
	}
	function splitThreadTilePaneWithTarget(fromThreadId, toThreadId, placement = "below") {
		const from = String(fromThreadId || "").trim();
		const to = String(toThreadId || "").trim();
		if (!from || !to || from === to || !state.threadTileMode) return false;
		const layout = threadTileLayout();
		const ids = threadTileCandidateIds(layout);
		const plan = threadTileStatePolicy.splitPaneWithTargetPlan({
			enabled: state.threadTileMode,
			fromThreadId: from,
			toThreadId: to,
			placement,
			ids,
			splitPairs: state.threadTileSplitPairs
		}, {
			maxPanes: THREAD_TILE_USER_MAX_PANES,
			normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs
		});
		if (plan.action !== "split") return false;
		return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, { maxPanes: THREAD_TILE_USER_MAX_PANES }), layout);
	}
	function dropThreadTilePane(fromThreadId, toThreadId, event) {
		const from = String(fromThreadId || "").trim();
		const to = String(toThreadId || "").trim();
		const pane = event && event.target && event.target.closest ? event.target.closest("[data-thread-tile-pane]") : null;
		if (!from || !to || from === to || !pane) return false;
		const rect = pane.getBoundingClientRect();
		const plan = threadTileStatePolicy.dropPaneIntent({
			fromThreadId: from,
			toThreadId: to,
			left: rect.left,
			top: rect.top,
			width: rect.width,
			height: rect.height,
			clientX: event.clientX,
			clientY: event.clientY
		});
		if (plan.action === "move-relative") return moveThreadTilePaneRelative(from, to, plan.placement);
		if (plan.action === "split-with-target") return splitThreadTilePaneWithTarget(from, to, plan.placement);
		return false;
	}
	function replaceLastThreadTilePaneForThreadListOpen(threadId, options = {}) {
		const id = String(threadId || "").trim();
		const source = String(options.source || "").trim();
		if (!id || source !== "thread-list" || !state.threadTileMode) return false;
		const layout = threadTileLayout({ enabled: true });
		if (!layout || !layout.enabled) return false;
		const ids = threadTileCandidateIds(layout);
		const plan = threadTileStatePolicy.replaceLastPaneForThreadListOpenPlan({
			enabled: state.threadTileMode,
			source,
			threadId: id,
			ids,
			pinnedIds: state.threadTilePinnedIds
		}, { maxPanes: THREAD_TILE_USER_MAX_PANES });
		if (plan.action !== "replace-last") return false;
		return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, { maxPanes: THREAD_TILE_USER_MAX_PANES }), layout);
	}
	function toggleThreadTileSwitchMenu(threadId) {
		const id = String(threadId || "").trim();
		if (!id || !state.threadTileMode) return false;
		setThreadTileSelectedThread(id, { render: false });
		state.threadTileSwitchMenuPaneId = state.threadTileSwitchMenuPaneId === id ? "" : id;
		if (!patchThreadTilePane(id, { preserveScroll: true })) scheduleRenderCurrentThread();
		return true;
	}
	function threadTileHasLiveThread() {
		if (!state.threadTileMode || !state.threadTileActiveIds.length) return false;
		return state.threadTileActiveIds.some((id) => {
			const thread = threadTileDisplayThread(id);
			return Boolean(latestLiveTurnForThread(thread) || isRunningStatus(thread && thread.status));
		});
	}
	function updateThreadTilePaneStatusBadges() {
		if (!state.threadTileMode) return;
		document.querySelectorAll("[data-thread-tile-pane]").forEach((pane) => {
			const id = pane.getAttribute("data-thread-tile-pane") || "";
			const container = pane.querySelector("[data-thread-tile-pane-state]");
			if (!container) return;
			const html = turnTimerStateHtml(threadTilePaneTimerState(threadTileDisplayThread(id)));
			if (container.innerHTML !== html) container.innerHTML = html;
		});
	}
	function threadTileError(threadId) {
		return state.threadTileErrors.get(String(threadId || "")) || "";
	}
	function threadTilePaneIsVisible(threadId) {
		const id = String(threadId || "");
		return Boolean(id && state.threadTileActiveIds.includes(id));
	}
	function setThreadTileConversationMode(active, layout = null) {
		const conversation = $("conversation");
		const main = document.querySelector(".main");
		document.documentElement.classList.toggle("thread-tile-open", Boolean(active));
		if (main) main.classList.toggle("thread-tile-main", Boolean(active));
		if (!conversation) return;
		conversation.classList.toggle("thread-tile-mode", Boolean(active));
		if (active && layout && layout.columns) conversation.style.setProperty("--thread-tile-columns", String(layout.columns));
		else {
			conversation.style.removeProperty("--thread-tile-columns");
			state.threadTileActiveIds = [];
			state.threadTileSelectedThreadId = "";
			state.threadTileSwitchMenuPaneId = "";
			state.threadTileViewportBaseline = null;
			state.threadTileComposerHeightBaselinePx = 0;
			for (const frame of state.threadTilePaneRenderFramesById.values()) if (window.cancelAnimationFrame) window.cancelAnimationFrame(frame);
			else clearTimeout(frame);
			state.threadTilePaneRenderFramesById.clear();
			state.threadTilePaneScrollHoldById.clear();
			clearThreadTileRefreshTimer();
			if (state.threadTileOperationRefreshTimer) {
				clearTimeout(state.threadTileOperationRefreshTimer);
				state.threadTileOperationRefreshTimer = null;
			}
		}
		updateComposerControls();
	}
	function captureThreadTilePaneScrollState() {
		const conversation = $("conversation");
		const states = /* @__PURE__ */ new Map();
		if (!conversation) return states;
		conversation.querySelectorAll("[data-thread-tile-pane]").forEach((pane) => {
			const id = pane.getAttribute("data-thread-tile-pane") || "";
			const body = pane.querySelector(".thread-tile-pane-body");
			if (!id || !body) return;
			states.set(id, threadTileStatePolicy.paneScrollMetrics({
				scrollHeight: body.scrollHeight,
				clientHeight: body.clientHeight,
				scrollTop: body.scrollTop,
				hold: state.threadTilePaneScrollHoldById.get(id) === true
			}));
		});
		return states;
	}
	function captureThreadTilePaneElementScrollState(pane) {
		const id = String(pane && pane.getAttribute && pane.getAttribute("data-thread-tile-pane") || "");
		const body = pane && pane.querySelector(".thread-tile-pane-body");
		if (!body) return null;
		return threadTileStatePolicy.paneScrollMetrics({
			scrollHeight: body.scrollHeight,
			clientHeight: body.clientHeight,
			scrollTop: body.scrollTop,
			hold: id ? state.threadTilePaneScrollHoldById.get(id) === true : false
		});
	}
	function scrollThreadTilePaneBodyToBottom(body, options = {}) {
		if (!body) return;
		const top = Math.max(0, Number(body.scrollHeight || 0));
		if (options.smooth && typeof body.scrollTo === "function") {
			body.scrollTo({
				top,
				behavior: "smooth"
			});
			setTimeout(() => updateThreadTileBottomButtonForBody(body), 220);
			return;
		}
		body.scrollTop = top;
		updateThreadTileBottomButtonForBody(body);
	}
	function isThreadTilePaneNearBottom(body) {
		if (!body) return true;
		return threadTileStatePolicy.paneScrollMetrics({
			scrollHeight: body.scrollHeight,
			clientHeight: body.clientHeight,
			scrollTop: body.scrollTop
		}).nearBottom;
	}
	function applyThreadTilePaneScrollHoldPlan(id, plan) {
		const threadId = String(id || "");
		if (!threadId || !plan || plan.action !== "pane-scroll-hold") return;
		if (plan.clearHold) state.threadTilePaneScrollHoldById.delete(threadId);
		else if (plan.rememberHold) state.threadTilePaneScrollHoldById.set(threadId, true);
	}
	function rememberThreadTilePaneScrollPosition(body) {
		const pane = body && body.closest && body.closest("[data-thread-tile-pane]");
		const id = String(pane && pane.getAttribute("data-thread-tile-pane") || "");
		if (!id || !body) return;
		applyThreadTilePaneScrollHoldPlan(id, threadTileStatePolicy.paneScrollHoldPlan({
			scrollHeight: body.scrollHeight,
			clientHeight: body.clientHeight,
			scrollTop: body.scrollTop
		}));
	}
	function updateThreadTileBottomButtonForBody(body) {
		const pane = body && body.closest && body.closest("[data-thread-tile-pane]");
		const button = pane && pane.querySelector("[data-thread-tile-bottom]");
		if (!button || !body) return;
		const metrics = threadTileStatePolicy.paneScrollMetrics({
			scrollHeight: body.scrollHeight,
			clientHeight: body.clientHeight,
			scrollTop: body.scrollTop
		});
		applyThreadTilePaneScrollHoldPlan(pane.getAttribute("data-thread-tile-pane") || "", threadTileStatePolicy.paneScrollHoldPlan(metrics));
		const plan = threadTileStatePolicy.paneBottomButtonPlan({ metrics });
		const shouldShow = Boolean(plan.shouldShow);
		button.classList.toggle("hidden", !shouldShow);
		button.setAttribute("aria-hidden", shouldShow ? "false" : "true");
		button.tabIndex = shouldShow ? 0 : -1;
	}
	function updateThreadTileBottomButtons() {
		const conversation = $("conversation");
		if (!conversation) return;
		conversation.querySelectorAll(".thread-tile-pane-body").forEach(updateThreadTileBottomButtonForBody);
	}
	function restoreThreadTilePaneScrollState(scrollState = /* @__PURE__ */ new Map()) {
		const conversation = $("conversation");
		if (!conversation) return;
		conversation.querySelectorAll("[data-thread-tile-pane]").forEach((pane) => {
			const id = pane.getAttribute("data-thread-tile-pane") || "";
			const body = pane.querySelector(".thread-tile-pane-body");
			if (!id || !body) return;
			const previous = scrollState.get(id);
			const plan = threadTileStatePolicy.paneScrollRestorePlan({
				previous,
				scrollHeight: body.scrollHeight,
				clientHeight: body.clientHeight
			});
			if (plan.mode === "restore-distance") {
				body.scrollTop = plan.top;
				updateThreadTileBottomButtonForBody(body);
				return;
			}
			scrollThreadTilePaneBodyToBottom(body);
		});
	}
	function restoreThreadTilePaneElementScrollState(pane, previous, options = {}) {
		const body = pane && pane.querySelector(".thread-tile-pane-body");
		if (!body) return;
		const id = String(pane && pane.getAttribute && pane.getAttribute("data-thread-tile-pane") || "");
		const plan = threadTileStatePolicy.paneScrollRestorePlan({
			previous,
			rememberedHold: Boolean(id && state.threadTilePaneScrollHoldById.get(id) === true),
			stickToBottom: options.stickToBottom === true,
			scrollHeight: body.scrollHeight,
			clientHeight: body.clientHeight
		});
		if (plan.mode !== "restore-distance") {
			scrollThreadTilePaneBodyToBottom(body);
			return;
		}
		body.scrollTop = plan.top;
		updateThreadTileBottomButtonForBody(body);
	}
	function scrollThreadTilePaneToBottom(threadId, options = {}) {
		const id = String(threadId || "");
		if (!id) return;
		const pane = Array.from(document.querySelectorAll("[data-thread-tile-pane]")).find((entry) => String(entry.getAttribute("data-thread-tile-pane") || "") === id);
		scrollThreadTilePaneBodyToBottom(pane && pane.querySelector(".thread-tile-pane-body"), options);
	}
	function clearThreadTileRefreshTimer() {
		clearTimeout(state.threadTileRefreshTimer);
		state.threadTileRefreshTimer = null;
	}
	function clearThreadTileDetailLoadQueueTimer() {
		clearTimeout(state.threadTileDetailLoadQueueTimer);
		state.threadTileDetailLoadQueueTimer = null;
	}
	function scheduleThreadTileDetailLoadQueueDrain(options = {}) {
		const plan = threadTileStatePolicy.detailLoadQueueDrainPlan({
			enabled: state.threadTileMode,
			activeIds: state.threadTileActiveIds,
			hasTimer: Boolean(state.threadTileDetailLoadQueueTimer),
			pending: options.pending === true,
			force: options.force === true,
			delayMs: options.delayMs
		}, { defaultDelayMs: THREAD_TILE_DETAIL_LOAD_QUEUE_DRAIN_MS });
		if (plan.clearTimer) {
			clearThreadTileDetailLoadQueueTimer();
			return false;
		}
		if (!plan.schedule) return false;
		state.threadTileDetailLoadQueueTimer = setTimeout(() => {
			state.threadTileDetailLoadQueueTimer = null;
			if (!state.threadTileMode) return;
			ensureThreadTileDetails(state.threadTileActiveIds);
		}, plan.delayMs);
		return true;
	}
	function scheduleThreadTileRefresh(delayMs = THREAD_TILE_REFRESH_INTERVAL_MS) {
		const plan = threadTileStatePolicy.refreshSchedulePlan({
			enabled: state.threadTileMode,
			visibilityState: document.visibilityState,
			activeIds: state.threadTileActiveIds,
			hasTimer: Boolean(state.threadTileRefreshTimer),
			delayMs
		}, {
			defaultDelayMs: THREAD_TILE_REFRESH_INTERVAL_MS,
			minDelayMs: 500
		});
		if (plan.clearTimer) {
			clearThreadTileRefreshTimer();
			return;
		}
		if (!plan.schedule) return;
		state.threadTileRefreshTimer = setTimeout(() => {
			state.threadTileRefreshTimer = null;
			if (!state.threadTileMode || document.visibilityState === "hidden") return;
			refreshThreadTileDetails(state.threadTileActiveIds, { source: "tile-refresh" }).catch(showError);
			scheduleThreadTileRefresh();
		}, plan.delayMs);
	}
	async function refreshThreadTileDetails(ids = [], options = {}) {
		const uniqueIds = threadTileStatePolicy.uniqueIds(ids);
		const visibleIds = uniqueIds.filter((id) => threadTilePaneIsVisible(id));
		const targetIds = threadTileStatePolicy.refreshTargetIds({
			enabled: state.threadTileMode,
			ids: uniqueIds,
			visibleIds,
			currentThreadId: state.currentThread && state.currentThread.id
		});
		if (!targetIds.length) return;
		await Promise.all(targetIds.map((id) => {
			return loadThreadTileDetail(id, {
				force: true,
				background: true,
				source: options.source || "tile-refresh"
			});
		}));
	}
	function abortThreadTileLoads() {
		clearThreadTileRefreshTimer();
		clearThreadTileDetailLoadQueueTimer();
		state.threadTileActiveIds = [];
		for (const frame of state.threadTilePaneRenderFramesById.values()) if (window.cancelAnimationFrame) window.cancelAnimationFrame(frame);
		else clearTimeout(frame);
		state.threadTilePaneRenderFramesById.clear();
		state.threadTilePaneScrollHoldById.clear();
		for (const controller of state.threadTileControllers.values()) try {
			controller.abort();
		} catch (_) {}
		state.threadTileControllers.clear();
		state.threadTileLoadingIds.clear();
	}
	async function loadThreadTileDetail(threadId, options = {}) {
		const id = String(threadId || "");
		const cached = state.threadTileDetails.get(id);
		const currentThreadId = state.currentThread && String(state.currentThread.id || "");
		const plan = threadTileStatePolicy.detailLoadPlan({
			threadId: id,
			currentThreadId,
			currentThreadLoaded: Boolean(currentThreadId === id && state.currentThread && !state.currentThread.mobileLoading),
			controllerActive: state.threadTileControllers.has(id),
			loadingActive: state.threadTileLoadingIds.has(id),
			cachedReady: Boolean(cached && !cached.mobileLoading && !cached.mobileLoadError),
			force: options.force === true,
			backgroundRequested: options.background === true,
			lastLoadedAt: Number(state.threadTileLoadedAtById.get(id) || 0),
			nowMs: Date.now(),
			minIntervalMs: THREAD_TILE_REFRESH_MIN_INTERVAL_MS
		});
		if (plan.action !== "load") return;
		const background = plan.background;
		const controller = new AbortController();
		applyThreadTileDetailLoadStartEffects(threadTileStatePolicy.detailLoadStartEffectsPlan(plan), controller);
		try {
			const result = await api(threadDetailApiPath(id, { mode: "recent" }), {
				timeoutMs: 2e4,
				signal: controller.signal
			});
			if (controller.signal.aborted) return;
			if (result && result.thread) applyThreadTileDetailLoadSuccessEffects(threadTileStatePolicy.detailLoadSuccessEffectsPlan({
				id,
				hasThread: true,
				nowMs: Date.now()
			}), result.thread);
		} catch (err) {
			applyThreadTileDetailLoadErrorEffects(threadTileStatePolicy.detailLoadErrorEffectsPlan({
				id,
				aborted: controller.signal.aborted,
				background,
				errorMessage: err && err.message ? err.message : String(err)
			}));
		} finally {
			applyThreadTileDetailLoadFinallyEffects(threadTileStatePolicy.detailLoadFinallyEffectsPlan({
				id,
				controllerMatches: state.threadTileControllers.get(id) === controller,
				visible: threadTilePaneIsVisible(id)
			}));
		}
	}
	function applyThreadTileDetailLoadStartEffects(effect, controller) {
		if (!effect || effect.action !== "detail-load-start-effects") return false;
		const id = String(effect.id || "");
		if (!id) return false;
		if (effect.setController) state.threadTileControllers.set(id, controller);
		if (effect.markLoading) {
			state.threadTileLoadingIds.add(id);
			if (effect.renderPane && !scheduleRenderThreadTilePane(id, { preserveScroll: effect.preserveScroll !== false })) scheduleRenderCurrentThread();
		}
		if (effect.clearError) state.threadTileErrors.delete(id);
		return true;
	}
	function applyThreadTileDetailLoadSuccessEffects(effect, thread) {
		if (!effect || effect.action !== "detail-load-success-effects" || !thread) return false;
		const id = String(effect.id || "");
		if (!id) return false;
		if (effect.setDetail) {
			const existing = state.threadTileDetails.get(id);
			state.threadTileDetails.set(id, mergeThreadPreservingVisibleItems(existing, thread));
		}
		if (effect.setLoadedAt) state.threadTileLoadedAtById.set(id, Number(effect.loadedAtMs || Date.now()));
		if (effect.clearError) state.threadTileErrors.delete(id);
		if (effect.mergeThread) mergeThreadIntoThreadList(thread);
		return true;
	}
	function applyThreadTileDetailLoadErrorEffects(effect) {
		if (!effect || effect.action !== "detail-load-error-effects") return false;
		const id = String(effect.id || "");
		if (!id) return false;
		state.threadTileErrors.set(id, effect.errorMessage || "Thread load failed");
		return true;
	}
	function applyThreadTileDetailLoadFinallyEffects(effect) {
		if (!effect || effect.action !== "detail-load-finally-effects") return false;
		const id = String(effect.id || "");
		if (!id) return false;
		if (effect.clearController) state.threadTileControllers.delete(id);
		if (effect.clearLoading) state.threadTileLoadingIds.delete(id);
		if (effect.renderPane && !scheduleRenderThreadTilePane(id, { preserveScroll: effect.preserveScroll !== false })) scheduleRenderCurrentThread();
		if (effect.scheduleQueueDrain) scheduleThreadTileDetailLoadQueueDrain({ force: true });
		return true;
	}
	function applyThreadTileDetailLoadQueuePlan(plan) {
		if (!plan || plan.action !== "detail-load-queue") return false;
		for (const id of Array.isArray(plan.abortIds) ? plan.abortIds : []) {
			const controller = state.threadTileControllers.get(id);
			if (controller && typeof controller.abort === "function") try {
				controller.abort();
			} catch (_) {}
			state.threadTileControllers.delete(id);
			state.threadTileLoadingIds.delete(id);
		}
		for (const id of Array.isArray(plan.loadIds) ? plan.loadIds : []) loadThreadTileDetail(id).catch(showError);
		if (plan.scheduleDrainAfterLoad) scheduleThreadTileDetailLoadQueueDrain({ pending: true });
		return true;
	}
	function ensureThreadTileDetails(ids = []) {
		if (!state.threadTileMode) return;
		syncThreadTileActivePaneState(ids);
		const currentThreadId = state.currentThread && String(state.currentThread.id || "");
		const readyIds = state.threadTileActiveIds.filter((id) => {
			if (currentThreadId && currentThreadId === id && state.currentThread && !state.currentThread.mobileLoading) return true;
			const cached = state.threadTileDetails.get(id);
			return Boolean(cached && !cached.mobileLoading && !cached.mobileLoadError);
		});
		const concurrency = threadTileStatePolicy.detailLoadConcurrencyPlan({
			activeIds: state.threadTileActiveIds,
			maxPanes: THREAD_TILE_USER_MAX_PANES
		});
		applyThreadTileDetailLoadQueuePlan(threadTileStatePolicy.detailLoadQueuePlan({
			enabled: state.threadTileMode,
			activeIds: state.threadTileActiveIds,
			controllerIds: Array.from(state.threadTileControllers.keys()),
			loadingIds: Array.from(state.threadTileLoadingIds),
			readyIds,
			maxConcurrentLoads: concurrency.maxConcurrentLoads
		}));
		scheduleThreadTileRefresh();
	}
	function renderThreadTileTurn(thread, turn, previousKeys = /* @__PURE__ */ new Set()) {
		return withRenderContextThread(thread, () => {
			const threadId = String(thread && thread.id || "");
			const renderedItems = visibleItemsForTurn(turn, thread).map((entry, index) => {
				const item = entry && entry.item;
				const sourceIndex = Number.isInteger(entry && entry.sourceIndex) && entry.sourceIndex >= 0 ? entry.sourceIndex : index;
				return renderVisibleItemPatchHtml(turn, item, previousKeys, sourceIndex, thread);
			}).filter(Boolean).join("");
			const budgetNoticeHtml = renderTurnVisibleItemBudgetNotice(turn, previousKeys);
			const turnApprovals = approvalsForTurn(threadId, turn && turn.id);
			const approvalsHtml = turnApprovals.length ? `<div class="approval-stack in-turn">${turnApprovals.map((request) => renderApprovalRequest(request, previousKeys, threadId)).join("")}</div>` : "";
			if (!budgetNoticeHtml.trim() && !renderedItems.trim() && !approvalsHtml.trim()) return "";
			const turnId = String(turn && (turn.id || turn.startedAt || "turn") || "turn");
			return `<article class="turn thread-tile-turn" data-thread-tile-turn="${escapeHtml(turnId)}" data-render-key="${escapeHtml(`tile-turn|${threadId}|${turnId}`)}">
      ${budgetNoticeHtml}${renderedItems}${approvalsHtml}
    </article>`;
		});
	}
	function scheduleThreadTileOperationMinimumRefresh(delayMs = LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS) {
		if (state.threadTileOperationRefreshTimer) clearTimeout(state.threadTileOperationRefreshTimer);
		state.threadTileOperationRefreshTimer = setTimeout(() => {
			state.threadTileOperationRefreshTimer = null;
			const plan = threadTileStatePolicy.operationMinimumRefreshPlan({
				enabled: state.threadTileMode,
				activeIds: state.threadTileActiveIds
			});
			if (plan.action === "operation-minimum-refresh") {
				let patchedAny = false;
				for (const id of plan.patchThreadIds || []) patchedAny = scheduleRenderThreadTilePane(id, { preserveScroll: true }) || patchedAny;
				if (plan.fullRenderOnPatchMiss && !patchedAny) scheduleRenderCurrentThread();
			}
		}, Math.max(0, Number(delayMs) || 0) + 16);
	}
	function rememberThreadTileOperationBubble(threadId, html = "") {
		const id = String(threadId || "");
		const record = threadTileStatePolicy.operationBubbleRecord({
			threadId: id,
			html,
			minVisibleMs: LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS,
			nowMs: Date.now()
		});
		if (!record) return;
		state.threadTileOperationBubblesById.set(id, record);
	}
	function clearThreadTileOperationBubble(threadId) {
		const id = String(threadId || "");
		if (!id) return;
		state.threadTileOperationBubblesById.delete(id);
	}
	function renderThreadTileOperationDock(thread, previousKeys = /* @__PURE__ */ new Set()) {
		const id = String(thread && thread.id || "");
		if (!id) return "";
		const entry = currentLiveOperationEntry(thread);
		const mode = threadTileStatePolicy.normalizeOperationMode(state.threadTileOperationModesById.get(id) || "compact");
		const plan = threadTileStatePolicy.operationDockPlan({
			threadId: id,
			mode,
			entryType: entry && entry.item && entry.item.type,
			hasOperation: Boolean(entry && entry.item && entry.item.type !== "liveTurnStatus"),
			hasLiveTurn: Boolean(latestLiveTurnForThread(thread)),
			remembered: state.threadTileOperationBubblesById.get(id),
			nowMs: Date.now()
		});
		if (plan.action === "render-remembered-operation") {
			if (plan.scheduleMinimumRefresh) scheduleThreadTileOperationMinimumRefresh(plan.remainingMs);
			return plan.html || "";
		}
		if (plan.action === "clear-remembered-operation") {
			if (plan.clearRemembered) state.threadTileOperationBubblesById.delete(id);
			return "";
		}
		if (plan.action !== "render-live-operation" || !entry || !entry.item) return "";
		const html = `<div class="thread-tile-operation-dock" data-thread-tile-operation-dock="${escapeHtml(id)}" data-mode="${escapeHtml(mode)}">
    <div class="live-operation-dock-inner">
      ${renderMobileOperationStack(entry.item, entry.turn, previousKeys, entry.sourceIndex, plan.expanded, {
			toggleAttribute: "data-thread-tile-operation-toggle",
			toggleValue: id
		})}
    </div>
  </div>`;
		rememberThreadTileOperationBubble(id, html);
		return html;
	}
	function threadTileOperationSignature(threadId) {
		const id = String(threadId || "");
		const thread = threadTileDisplayThread(id);
		const entry = currentLiveOperationEntry(thread);
		return threadTileStatePolicy.operationSignature({
			mode: state.threadTileOperationModesById.get(id) || "compact",
			remembered: state.threadTileOperationBubblesById.get(id),
			nowMs: Date.now(),
			entrySignature: entry && entry.item && entry.item.type !== "liveTurnStatus" ? visibleItemSignature(entry.item, entry.turn, thread) : null
		});
	}
	function applyThreadTileOperationModeTogglePlan(effect) {
		if (!effect || effect.action !== "operation-mode-toggle-effects") return false;
		const id = String(effect.id || "");
		if (!id) return false;
		state.threadTileOperationModesById.set(id, threadTileStatePolicy.normalizeOperationMode(effect.mode));
		if (effect.selectPane) setThreadTileSelectedThread(id, { render: effect.selectPaneRender !== false });
		if (effect.patchThreadId && !patchThreadTilePane(effect.patchThreadId, { preserveScroll: effect.patchPreserveScroll !== false })) {
			if (effect.scheduleFullRenderOnPatchMiss) scheduleRenderCurrentThread();
		}
		return true;
	}
	function threadTileMinimumPaneCount(layout = threadTileLayout()) {
		return threadTilePaneCountState(layout).minPaneCount;
	}
	function threadTileMaximumPaneCount(layout = threadTileLayout()) {
		return threadTilePaneCountState(layout).maxPaneCount;
	}
	function setThreadTilePaneCount(nextCount, options = {}) {
		if (!state.threadTileMode) return false;
		const layout = threadTileLayout({ enabled: true });
		if (!layout || !layout.enabled) return false;
		const minCount = threadTileMinimumPaneCount(layout);
		const maxCount = threadTileMaximumPaneCount(layout);
		const current = effectiveThreadTilePaneCount(layout);
		const plan = threadTileStatePolicy.paneCountChangePlan({
			enabled: state.threadTileMode,
			layoutEnabled: layout.enabled,
			nextCount,
			currentCount: current,
			storedPaneCount: state.threadTilePaneCount,
			minCount,
			maxCount
		}, { maxPanes: THREAD_TILE_USER_MAX_PANES });
		if (plan.action !== "set-pane-count") return false;
		return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, {
			maxPanes: THREAD_TILE_USER_MAX_PANES,
			render: options.render !== false
		}), layout);
	}
	function changeThreadTilePaneCount(delta) {
		const layout = threadTileLayout({ enabled: true });
		if (!layout || !layout.enabled) return false;
		return setThreadTilePaneCount(effectiveThreadTilePaneCount(layout) + (Number(delta) || 0));
	}
	function closeThreadTilePane(threadId) {
		const id = String(threadId || "").trim();
		if (!id || !state.threadTileMode) return false;
		const layout = threadTileLayout({ enabled: true });
		if (!layout || !layout.enabled) return false;
		const ids = threadTileCandidateIds(layout);
		const minCount = threadTileMinimumPaneCount(layout);
		const plan = threadTileStatePolicy.closePanePlan({
			enabled: state.threadTileMode,
			layoutEnabled: layout.enabled,
			threadId: id,
			ids,
			pinnedIds: state.threadTilePinnedIds,
			defaultIds: defaultThreadTileCandidateIds(layout, { maxPanes: threadTileMaximumPaneCount(layout) }),
			minCount
		}, { maxPanes: THREAD_TILE_USER_MAX_PANES });
		if (plan.action !== "close-pane") return false;
		return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, { maxPanes: THREAD_TILE_USER_MAX_PANES }), layout);
	}
	function renderThreadTilePane(threadId, layout, previousKeys = /* @__PURE__ */ new Set()) {
		const thread = threadTileDisplayThread(threadId);
		const id = String(threadId || thread && thread.id || "");
		const title = threadTitleForDisplay(thread) || id;
		const summary = threadTileSummary(id);
		const paneStateHtml = turnTimerStateHtml(threadTilePaneTimerState(thread || summary));
		const error = threadTileError(id);
		const loading = state.threadTileLoadingIds.has(id) || thread && thread.mobileLoading && !threadHasVisibleConversationTurns(thread);
		const readWarning = threadReadWarningMessage(thread);
		const turns = visibleTurnsForConversation(thread);
		const visibleTurnIds = new Set(turns.map((turn) => turn && turn.id).filter(Boolean).map(String));
		const omitted = Number(thread && thread.mobileOmittedTurnCount || 0) + Math.max(0, (thread && thread.turns || []).length - turns.length);
		const historyNote = renderThreadHistoryNote(thread, omitted, previousKeys);
		const approvalsHtml = renderPendingApprovals(thread, previousKeys, (request) => {
			const turnId = approvalTurnId(request);
			if (turnId && visibleTurnIds.has(turnId)) return false;
			return isApprovalActive(request);
		});
		const body = error ? `<div class="thread-tile-empty error">Thread failed: ${escapeHtml(error)}</div>` : loading ? `<div class="thread-tile-empty">Loading thread...</div>` : [
			historyNote,
			readWarning ? `<div class="history-note">${escapeHtml(readWarning)}</div>` : "",
			turns.map((turn) => renderThreadTileTurn(thread, turn, previousKeys)).join("") || `<div class="thread-tile-empty">No visible turns.</div>`,
			approvalsHtml
		].join("");
		const active = id && id === effectiveThreadTileSelectedThreadId() ? " active" : "";
		const operationDock = renderThreadTileOperationDock(thread, previousKeys);
		const switchMenu = renderThreadTileSwitchMenu(id);
		return `<section class="thread-tile-pane${active}" data-thread-tile-pane="${escapeHtml(id)}" data-render-key="${escapeHtml(`thread-tile|${id}`)}">
    <header class="thread-tile-pane-header">
      <div class="thread-tile-pane-title-wrap">
        <button class="thread-tile-pane-title-button" type="button" draggable="true" data-thread-tile-drag-handle="${escapeHtml(id)}" data-thread-tile-title="${escapeHtml(id)}" aria-haspopup="listbox" aria-expanded="${state.threadTileSwitchMenuPaneId === id ? "true" : "false"}">
          <span class="thread-tile-pane-title">${escapeHtml(title)}</span>
        </button>
        ${switchMenu}
      </div>
      <div class="thread-tile-pane-state-slot" data-thread-tile-pane-state>${paneStateHtml}</div>
    </header>
    <div class="thread-tile-pane-body"><div class="thread-tile-pane-content">${body}</div></div>
    ${operationDock}
    <button class="thread-tile-bottom-button hidden" type="button" data-thread-tile-bottom="${escapeHtml(id)}" aria-label="跳到此线程底部" title="跳到底部" aria-hidden="true" tabindex="-1">↓</button>
  </section>`;
	}
	function threadTilePaneElement(threadId) {
		const id = String(threadId || "");
		if (!id) return null;
		return Array.from(document.querySelectorAll("[data-thread-tile-pane]")).find((entry) => String(entry.getAttribute("data-thread-tile-pane") || "") === id) || null;
	}
	function threadTileRenderSignature(layout, ids) {
		return threadTileStatePolicy.paneRenderSignaturePlan({
			layout,
			ids,
			desiredPaneCount: normalizeThreadTilePaneCount(state.threadTilePaneCount, 0),
			splitPairs: threadTilePrunedSplitPairs(ids),
			selectedThreadId: effectiveThreadTileSelectedThreadId(ids),
			loadingIds: ids.filter((id) => state.threadTileLoadingIds.has(id)),
			switchMenuPaneId: state.threadTileSwitchMenuPaneId || "",
			errors: ids.map((id) => [id, threadTileError(id)]),
			operations: ids.map((id) => [id, threadTileOperationSignature(id)]),
			threadSignatures: ids.map((id) => conversationRenderSignature(threadTileDisplayThread(id)))
		}, { maxPanes: THREAD_TILE_USER_MAX_PANES }).signature;
	}
	function patchThreadTilePane(threadId, options = {}) {
		const id = String(threadId || "").trim();
		let preflight = threadTileStatePolicy.panePatchPreflightPlan({
			threadId: id,
			enabled: state.threadTileMode,
			visible: id ? threadTilePaneIsVisible(id) : false
		});
		if (!preflight.shouldContinue) return false;
		const conversation = $("conversation");
		preflight = threadTileStatePolicy.panePatchPreflightPlan({
			threadId: id,
			enabled: state.threadTileMode,
			visible: true,
			conversationPresent: Boolean(conversation),
			tileSurface: Boolean(conversation && conversation.classList.contains("thread-tile-mode"))
		});
		if (!preflight.shouldContinue) return false;
		const board = conversation.querySelector("[data-thread-tile-board]");
		preflight = threadTileStatePolicy.panePatchPreflightPlan({
			threadId: id,
			enabled: state.threadTileMode,
			visible: true,
			conversationPresent: true,
			tileSurface: true,
			boardPresent: Boolean(board)
		});
		if (!preflight.shouldContinue) return false;
		const layout = threadTileLayout();
		preflight = threadTileStatePolicy.panePatchPreflightPlan({
			threadId: id,
			enabled: state.threadTileMode,
			visible: true,
			conversationPresent: true,
			tileSurface: true,
			boardPresent: true,
			layoutEnabled: Boolean(layout && layout.enabled)
		});
		if (!preflight.shouldContinue) return false;
		const ids = threadTileCandidateIds(layout);
		preflight = threadTileStatePolicy.panePatchPreflightPlan({
			threadId: id,
			enabled: state.threadTileMode,
			visible: true,
			conversationPresent: true,
			tileSurface: true,
			boardPresent: true,
			layoutEnabled: true,
			ids
		});
		if (!preflight.shouldContinue) return false;
		const displayLayout = threadTileDisplayLayout(layout, ids);
		const pane = options.paneElement || threadTilePaneElement(id);
		preflight = threadTileStatePolicy.panePatchPreflightPlan({
			threadId: id,
			enabled: state.threadTileMode,
			visible: true,
			conversationPresent: true,
			tileSurface: true,
			boardPresent: true,
			layoutEnabled: true,
			ids,
			panePresent: Boolean(pane)
		});
		if (!preflight.canPatch) return false;
		const previousScroll = captureThreadTilePaneElementScrollState(pane);
		const previousKeys = existingConversationRenderKeys();
		const template = document.createElement("template");
		template.innerHTML = renderThreadTilePane(id, displayLayout, previousKeys);
		const sourcePane = template.content.firstElementChild;
		let completion = threadTileStatePolicy.panePatchCompletionPlan({
			threadId: id,
			sourcePanePresent: Boolean(sourcePane)
		});
		if (!completion.returnValue) return false;
		const patchedPane = patchNode(pane, sourcePane);
		completion = threadTileStatePolicy.panePatchCompletionPlan({
			threadId: id,
			sourcePanePresent: true,
			patchedPanePresent: Boolean(patchedPane),
			requestAnimationFrameAvailable: typeof window.requestAnimationFrame === "function"
		});
		if (!completion.returnValue) return false;
		if (completion.hydrate) hydrateThreadDetailSurface(patchedPane, { imageScanDelays: [0, 180] });
		if (completion.restoreScroll) restoreThreadTilePaneElementScrollState(patchedPane, previousScroll, options);
		if (completion.updateBottomButton) {
			const updateBottomButton = () => updateThreadTileBottomButtonForBody(patchedPane.querySelector(".thread-tile-pane-body"));
			if (completion.updateBottomButtonMode === "animation-frame" && typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(updateBottomButton);
			else updateBottomButton();
		}
		if (completion.writeRenderSignature) state.renderedConversationSignature = threadTileRenderSignature(displayLayout, ids);
		if (completion.clearPatchShellSignature) state.renderedConversationPatchShellSignature = "";
		if (completion.bindActions) bindThreadTileActions();
		else return false;
		return completion.returnValue;
	}
	function isThreadTileConversationSurface() {
		const conversation = $("conversation");
		return Boolean(state.threadTileMode && conversation && conversation.classList && conversation.classList.contains("thread-tile-mode"));
	}
	function threadDetailDomPatchSurface(options = {}) {
		const id = String(options.threadId || state.currentThreadId || state.currentThread && state.currentThread.id || "").trim();
		return threadDetailPatchPlanApi.planThreadDetailDomPatchSurface({
			threadId: id,
			threadTileMode: state.threadTileMode,
			threadTileSurface: isThreadTileConversationSurface(),
			tilePaneVisible: id ? threadTilePaneIsVisible(id) : false,
			conversationPresent: Boolean($("conversation"))
		});
	}
	function canPatchSingleThreadConversationDom(options = {}) {
		const plan = threadDetailDomPatchSurface(options);
		return Boolean(plan && plan.canPatch && plan.surface === "single-thread");
	}
	function patchCurrentThreadTilePaneFromState(options = {}) {
		const plan = threadDetailDomPatchSurface(options);
		if (!plan || !plan.canPatch || plan.surface !== "thread-tile-pane") return false;
		clearGlobalLiveOperationDockForThreadTiles();
		return patchThreadTilePane(plan.threadId, Object.assign({ preserveScroll: true }, options));
	}
	function scheduleRenderThreadTilePane(threadId, options = {}) {
		const id = String(threadId || "").trim();
		const plan = threadTileStatePolicy.paneRenderFramePlan({
			threadId: id,
			enabled: state.threadTileMode,
			visible: id ? threadTilePaneIsVisible(id) : false,
			hasFrame: id ? state.threadTilePaneRenderFramesById.has(id) : false
		});
		if (plan.action === "skip" || !plan.returnValue) return false;
		if (!plan.scheduleFrame) return true;
		const render = () => {
			state.threadTilePaneRenderFramesById.delete(id);
			if (!patchThreadTilePane(id, options) && plan.fullRenderOnPatchMiss) scheduleRenderCurrentThread();
		};
		const frame = window.requestAnimationFrame ? window.requestAnimationFrame(render) : setTimeout(render, 33);
		state.threadTilePaneRenderFramesById.set(id, frame);
		return true;
	}
	function renderThreadTileLayout(layout, options = {}) {
		const ids = threadTileCandidateIds(layout);
		if (!ids.length) return false;
		const displayLayout = threadTileDisplayLayout(layout, ids);
		const scrollState = captureThreadTilePaneScrollState();
		ensureThreadTileDetails(ids);
		updateThreadTileGlobalHeader(displayLayout, ids);
		state.nowMs = Date.now();
		const previousKeys = existingConversationRenderKeys();
		const html = `<div class="thread-tile-board" data-thread-tile-board data-render-key="thread-tile-board">
    ${(Array.isArray(displayLayout.columnGroups) && displayLayout.columnGroups.length ? displayLayout.columnGroups : ids.map((id) => [id])).map((group, index) => `<div class="thread-tile-column" data-thread-tile-column="${escapeHtml(String(index))}" style="--thread-tile-column-rows: ${escapeHtml(String(Math.max(1, group.length)))}">
      ${group.map((id) => renderThreadTilePane(id, displayLayout, previousKeys)).join("")}
    </div>`).join("")}
  </div>`;
		const signature = threadTileRenderSignature(displayLayout, ids);
		const visibleShape = threadTileVisibleShape(ids);
		const expectedVisibleTurnCount = visibleShape.turnCount;
		const renderedDomTurnCount = threadTileDomTurnCount();
		const renderedDomShape = conversationDomShape();
		setThreadTileConversationMode(true, displayLayout);
		updateConversationHtml(html, signature, {
			stickToBottom: options.stickToBottom === true,
			patchShellSignature: "",
			expectedVisibleTurnCount,
			renderedDomTurnCount,
			expectedVisibleItemCount: visibleShape.visibleItemCount,
			renderedDomItemCount: renderedDomShape.itemCount,
			duplicateRenderKeyCount: renderedDomShape.duplicateRenderKeyCount,
			duplicateUserMessageCount: renderedDomShape.duplicateUserMessageCount,
			expectedDuplicateUserMessageCount: 0,
			action: "thread-tile-empty-state",
			routeKind: "thread-tile",
			threadHash: diagnosticHash(`thread-tile:${ids.join("|")}`),
			currentTurns: expectedVisibleTurnCount,
			currentVisibleItems: visibleShape.visibleItemCount,
			source: "thread-tile-render",
			checkProjectionConsistency: true
		});
		bindThreadTileActions();
		restoreThreadTilePaneScrollState(scrollState);
		if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(() => {
			restoreThreadTilePaneScrollState(scrollState);
			updateThreadTileBottomButtons();
		});
		return true;
	}
	function bindThreadTileActions() {
		const conversation = $("conversation");
		if (!conversation) return;
		if (conversation.dataset.threadTileActionsBound === "true") return;
		conversation.dataset.threadTileActionsBound = "true";
		conversation.addEventListener("pointerdown", (event) => {
			const plan = threadTileActionsApi.resolveThreadTilePointerAction({
				target: event.target,
				root: conversation
			});
			if (plan.action === "select-pane") {
				setThreadTileSelectedThread(plan.paneId || "");
				return;
			}
			if (plan.stopPropagation) {
				event.stopPropagation();
				return;
			}
		});
		conversation.addEventListener("focusin", (event) => {
			const plan = threadTileActionsApi.resolveThreadTileFocusAction({
				target: event.target,
				root: conversation
			});
			if (plan.action === "select-pane") setThreadTileSelectedThread(plan.paneId || "");
		});
		conversation.addEventListener("click", (event) => {
			const plan = threadTileActionsApi.resolveThreadTileClickAction({
				target: event.target,
				root: conversation
			});
			if (plan.preventDefault) event.preventDefault();
			if (plan.stopPropagation) event.stopPropagation();
			if (plan.action === "toggle-switch-menu") {
				toggleThreadTileSwitchMenu(plan.paneId || "");
				return;
			}
			if (plan.action === "switch-pane-thread") {
				replaceThreadTilePaneThread(plan.fromId || "", plan.toId || "");
				return;
			}
			if (plan.action === "change-pane-count") {
				if (!plan.disabled) changeThreadTilePaneCount(Number(plan.delta || 0));
				return;
			}
			if (plan.action === "close-pane") {
				if (!plan.disabled) closeThreadTilePane(plan.paneId || "");
				return;
			}
			if (plan.action === "scroll-pane-bottom") {
				scrollThreadTilePaneToBottom(plan.paneId || "", { smooth: true });
				return;
			}
			if (plan.action === "toggle-operation") {
				const id = plan.paneId || "";
				applyThreadTileOperationModeTogglePlan(threadTileStatePolicy.operationModeTogglePlan({
					enabled: state.threadTileMode,
					threadId: id,
					mode: state.threadTileOperationModesById.get(id) || "compact"
				}));
			}
		});
		conversation.addEventListener("scroll", (event) => {
			const plan = threadTileActionsApi.resolveThreadTileScrollAction({
				target: event.target,
				root: conversation
			});
			if (plan.action === "pane-scroll") updateThreadTileBottomButtonForBody(plan.body);
		}, {
			passive: true,
			capture: true
		});
		conversation.addEventListener("dragstart", (event) => {
			const plan = threadTileActionsApi.resolveThreadTileDragStartAction({
				target: event.target,
				root: conversation
			});
			if (plan.action !== "drag-start") return;
			const id = plan.paneId || "";
			if (!id) return;
			state.threadTileDraggingThreadId = id;
			state.threadTileSwitchMenuPaneId = "";
			if (event.dataTransfer) {
				event.dataTransfer.effectAllowed = "move";
				event.dataTransfer.setData("text/plain", id);
			}
			const pane = plan.pane;
			if (pane) pane.classList.add("dragging");
		});
		conversation.addEventListener("dragover", (event) => {
			const plan = threadTileActionsApi.resolveThreadTileDragOverAction({
				target: event.target,
				root: conversation,
				draggingId: state.threadTileDraggingThreadId || ""
			});
			if (plan.action !== "drag-over") return;
			if (plan.preventDefault) event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
			plan.pane.classList.add("drag-over");
		});
		conversation.addEventListener("dragleave", (event) => {
			const plan = threadTileActionsApi.resolveThreadTileDragLeaveAction({
				target: event.target,
				root: conversation
			});
			if (plan.action === "drag-leave") plan.pane.classList.remove("drag-over");
		});
		conversation.addEventListener("drop", (event) => {
			const plan = threadTileActionsApi.resolveThreadTileDropAction({
				target: event.target,
				root: conversation,
				draggingId: state.threadTileDraggingThreadId || "",
				transferId: event.dataTransfer && event.dataTransfer.getData("text/plain") || ""
			});
			if (plan.action !== "drop-pane") return;
			if (plan.preventDefault) event.preventDefault();
			if (plan.stopPropagation) event.stopPropagation();
			document.querySelectorAll(".thread-tile-pane.drag-over, .thread-tile-pane.dragging").forEach((entry) => entry.classList.remove("drag-over", "dragging"));
			state.threadTileDraggingThreadId = "";
			dropThreadTilePane(plan.draggingId, plan.targetId, event);
		});
		conversation.addEventListener("dragend", () => {
			state.threadTileDraggingThreadId = "";
			document.querySelectorAll(".thread-tile-pane.drag-over, .thread-tile-pane.dragging").forEach((entry) => entry.classList.remove("drag-over", "dragging"));
		});
	}
	function threadTileLayoutStatusText(layout) {
		if (!state.threadTileMode) return "当前视口：单线程";
		if (layout && layout.enabled) {
			const count = effectiveThreadTilePaneCount(layout);
			const maxCount = threadTileMaximumPaneCount(layout);
			return maxCount > 1 ? `当前视口：平铺 ${count}/${maxCount} 窗` : "当前视口：平铺可用";
		}
		const reason = String(layout && layout.reason || "");
		if (reason === "tablet-portrait") return "当前视口：竖屏单线程";
		if (reason === "insufficient-width" || reason === "narrow") return "当前视口：宽度不足";
		if (reason === "disabled") return "当前视口：单线程";
		return "当前视口：暂不可平铺";
	}
	function syncThreadTileToggle() {
		const layout = threadTileLayout({ enabled: true });
		document.querySelectorAll("[data-thread-display-choice]").forEach((button) => {
			const isTile = (button.getAttribute("data-thread-display-choice") || "single") === "tile";
			const isSelected = isTile ? state.threadTileMode : !state.threadTileMode;
			button.classList.toggle("selected", isSelected);
			button.setAttribute("aria-pressed", isSelected ? "true" : "false");
			if (isTile && !layout.enabled && !state.threadTileMode) button.setAttribute("title", "平铺会在 iPad 横屏或宽屏可用时生效");
			else button.removeAttribute("title");
		});
		const status = $("threadDisplaySettingsStatus");
		if (status) status.textContent = threadTileLayoutStatusText(layout);
	}
	function setThreadTileMode(enabled) {
		state.threadTileMode = enabled === true;
		mirrorThreadDisplayModeToLocalStorage();
		if (!state.threadTileMode) {
			abortThreadTileLoads();
			state.threadTileSelectedThreadId = "";
			setThreadTileConversationMode(false);
		}
		scheduleThreadDisplaySettingsSave();
		syncThreadTileToggle();
		renderCurrentThread({ stickToBottom: true });
	}
	function handleThreadTileModeChoice(event) {
		const button = event.target.closest("[data-thread-display-choice]");
		if (!button) return;
		event.preventDefault();
		setThreadTileMode(button.getAttribute("data-thread-display-choice") === "tile");
	}
	return {
		updateThreadTileGlobalHeader,
		viewportPixelSize,
		isCoarsePointerViewport,
		isThreadTileKeyboardFocusActive,
		threadTileViewportSize,
		threadTileVerticalChromePx,
		threadTileLayout,
		normalizeThreadTilePaneCount,
		threadTileLayoutCapacity,
		defaultThreadTileCandidateIds,
		threadTileRunningPaneIds,
		threadTilePaneCountState,
		autoThreadTilePaneCount,
		effectiveThreadTilePaneCount,
		threadTileDisplayLayout,
		normalizeThreadTilePinnedIds,
		normalizeThreadTileSplitPairs,
		threadTilePrunedSplitPairs,
		threadTileVisibleIdSet,
		threadTileIdsEqual,
		threadTileCandidateIds,
		threadDisplaySettingsPayload,
		localThreadDisplayMode,
		mirrorThreadDisplayModeToLocalStorage,
		applyThreadDisplaySettings,
		loadThreadDisplaySettings,
		saveThreadDisplaySettingsNow,
		scheduleThreadDisplaySettingsSave,
		syncThreadTileActivePaneState,
		threadTileSummary,
		threadTileDisplayThread,
		setThreadTileSelectedThread,
		applyThreadTileSelectedPaneEffects,
		threadTileVisibleThreadOptions,
		renderThreadTileSwitchMenu,
		applyThreadTilePaneSlotEffects,
		replaceThreadTilePaneThread,
		moveThreadTilePaneRelative,
		splitThreadTilePaneWithTarget,
		dropThreadTilePane,
		replaceLastThreadTilePaneForThreadListOpen,
		toggleThreadTileSwitchMenu,
		threadTileHasLiveThread,
		updateThreadTilePaneStatusBadges,
		threadTileError,
		threadTilePaneIsVisible,
		setThreadTileConversationMode,
		captureThreadTilePaneScrollState,
		captureThreadTilePaneElementScrollState,
		scrollThreadTilePaneBodyToBottom,
		isThreadTilePaneNearBottom,
		applyThreadTilePaneScrollHoldPlan,
		rememberThreadTilePaneScrollPosition,
		updateThreadTileBottomButtonForBody,
		updateThreadTileBottomButtons,
		restoreThreadTilePaneScrollState,
		restoreThreadTilePaneElementScrollState,
		scrollThreadTilePaneToBottom,
		clearThreadTileRefreshTimer,
		clearThreadTileDetailLoadQueueTimer,
		scheduleThreadTileDetailLoadQueueDrain,
		scheduleThreadTileRefresh,
		refreshThreadTileDetails,
		abortThreadTileLoads,
		loadThreadTileDetail,
		applyThreadTileDetailLoadStartEffects,
		applyThreadTileDetailLoadSuccessEffects,
		applyThreadTileDetailLoadErrorEffects,
		applyThreadTileDetailLoadFinallyEffects,
		applyThreadTileDetailLoadQueuePlan,
		ensureThreadTileDetails,
		renderThreadTileTurn,
		scheduleThreadTileOperationMinimumRefresh,
		rememberThreadTileOperationBubble,
		clearThreadTileOperationBubble,
		renderThreadTileOperationDock,
		threadTileOperationSignature,
		applyThreadTileOperationModeTogglePlan,
		threadTileMinimumPaneCount,
		threadTileMaximumPaneCount,
		setThreadTilePaneCount,
		changeThreadTilePaneCount,
		closeThreadTilePane,
		renderThreadTilePane,
		threadTilePaneElement,
		threadTileRenderSignature,
		patchThreadTilePane,
		isThreadTileConversationSurface,
		threadDetailDomPatchSurface,
		canPatchSingleThreadConversationDom,
		patchCurrentThreadTilePaneFromState,
		scheduleRenderThreadTilePane,
		renderThreadTileLayout,
		bindThreadTileActions,
		threadTileLayoutStatusText,
		syncThreadTileToggle,
		setThreadTileMode,
		handleThreadTileModeChoice
	};
}
var threadTileRuntimeApi = Object.freeze({ createThreadTileRuntime });
root.CodexThreadTileRuntime = threadTileRuntimeApi;
//#endregion
//#region frontend/native/app-update-runtime.mjs
function createAppUpdateRuntime(deps = {}) {
	const { state = {}, CLIENT_BUILD_ID = "", PAGE_REFRESH_CHECK_INTERVAL_MS = 6e4, PAGE_REFRESH_MIN_CHECK_INTERVAL_MS = 12e3, PAGE_SHELL_ASSETS = [], STORAGE_PUBLIC_PR_PROMPT = "codexMobilePublicPrPromptKey", PUBLIC_PR_REVIEW_THREAD_TITLE = "Codex Mobile Public PR", buildRefreshPolicy = null, $ = () => null, api = async () => ({}), escapeHtml = (value) => String(value == null ? "" : value), normalizeFsPath = (value) => String(value || ""), threadMatchesWorkspaceCwd = () => false, loadThreads = async () => {}, loadThread = async () => {}, setComposerText = () => {}, scheduleCurrentDraftSave = () => {}, updateComposerControls = () => {}, composerHasContent = () => false, requestAppAlert = async () => {}, requestAppConfirmation = async () => false, loadWorkspaces = async () => {}, postClientEvent = () => {}, saveCurrentDraftNow = () => {}, syncSidebarWorkspaceSelect = () => {}, updateWorkspacePath = () => {}, renderWorkspaceTokenUsage = () => {}, isMenuOverlayMode = () => false, closeSidebarMenu = () => {}, clearCurrentThreadSelection = () => {}, restoreDraftForCurrentTarget = () => {}, renderThreads = () => {}, renderCurrentThread = () => {}, showError = () => {}, isRunningStatus = () => false, visibleThreads = (threads) => Array.isArray(threads) ? threads : [], threadById = () => null, shortPath = (value) => String(value || ""), statusText = (status) => String(status && status.type || status || ""), saveRestartAutoRecoverThreads = () => {}, postPerformanceEvent = () => {}, roundedDurationMs = (startedAt) => Math.max(0, Date.now() - Number(startedAt || Date.now())), isHermesEmbedMode = () => false, requestHermesPluginRefresh = () => {}, clearPluginRefreshPendingNotice = () => {}, rememberRateLimitsFromConfig = () => {}, rememberCodexProfiles = () => {}, renderCodexProfileSettings = () => {}, stopCodexProfileSwitchProgressPolling = () => {}, publishPluginNavigationState = () => {}, applyFrontendDiagnosticLogPublicConfig = () => null } = deps;
	function appVersionText(status = state.appUpdateStatus) {
		const version = String(status && status.version || state.appVersion || "").trim();
		const client = clientBuildVersionText();
		return version ? `v${version} · ${client}` : client;
	}
	function clientBuildVersionText(buildId = CLIENT_BUILD_ID) {
		const text = String(buildId || "").trim();
		const match = text.match(/\bcodex-mobile-shell-v([0-9]+)(?:-[a-f0-9]{6,})?\b/i);
		if (match) return `客户端 v${match[1]}`;
		return text ? `客户端 ${text}` : "客户端未知";
	}
	function fullClientBuildVersionText(status = state.appUpdateStatus) {
		const currentBuild = status && status.currentBuild && typeof status.currentBuild === "object" ? status.currentBuild : {};
		const clientBuildId = String(currentBuild.clientBuildId || status && status.clientBuildId || CLIENT_BUILD_ID || "").trim();
		const shellCacheName = String(currentBuild.shellCacheName || status && status.shellCacheName || "").trim();
		const classicShellCacheName = String(currentBuild.classicShellCacheName || status && status.classicShellCacheName || "").trim();
		const parts = [];
		if (clientBuildId) parts.push(`clientBuildId ${clientBuildId}`);
		if (shellCacheName && shellCacheName !== clientBuildId && shellCacheName !== classicShellCacheName) parts.push(`shellCacheName ${shellCacheName}`);
		return parts.join(" · ") || "clientBuildId unknown";
	}
	function renderAppUpdateStatus() {
		const el = $("appUpdateStatus");
		if (!el) return;
		const status = state.appUpdateStatus || {};
		const supported = status.supported !== false;
		const checking = state.appUpdateBusy && !state.appUpdateRestarting;
		const applying = Boolean(status.applying) || state.appUpdateRestarting;
		const blocked = Boolean(status.updateAvailable && !status.canFastForward);
		let label = appVersionText(status);
		let title = `Check for GitHub updates；当前客户端 ${CLIENT_BUILD_ID}`;
		if (state.appUpdateRestarting) {
			label = "等待重启…";
			title = "更新已应用。服务会退出并等待启动任务或守护脚本拉起；手动启动的部署需要在服务停止后手动重启。";
		} else if (applying) {
			label = "更新中…";
			title = "正在拉取更新";
		} else if (checking) {
			label = "检查更新…";
			title = "正在检查 GitHub 更新";
		} else if (status.updateAvailable && status.canFastForward) {
			label = `有更新 ${status.remoteShort || ""}`.trim();
			title = `发现 ${status.remote || "origin"}/${status.branch || "main"} 更新，点击后确认拉取；更新后服务会退出并依赖启动任务或守护脚本重启`;
		} else if (blocked) {
			label = "更新受阻";
			title = status.reason || status.error || "检测到更新，但当前工作区不能安全 fast-forward";
		} else if (status.error) {
			label = "更新检查失败";
			title = status.error;
		} else if (!supported) title = status.reason || "当前安装方式不支持 Git 自动更新";
		else if (status.localShort) title = `${appVersionText(status)} (${status.localShort})，点击重新检查更新；当前客户端 ${CLIENT_BUILD_ID}`;
		el.textContent = label;
		el.title = title;
		el.classList.toggle("hidden", !state.appVersion && !state.appUpdateStatus);
		el.classList.toggle("available", Boolean(status.updateAvailable && status.canFastForward));
		el.classList.toggle("blocked", blocked || Boolean(status.error));
		el.classList.toggle("checking", checking || applying);
		el.disabled = state.appUpdateBusy || state.appUpdateRestarting;
	}
	async function refreshAppUpdateStatus(options = {}) {
		if (!state.key) return null;
		if (state.appUpdateBusy && !options.force) return state.appUpdateStatus;
		state.appUpdateBusy = true;
		if (!options.silent) renderAppUpdateStatus();
		try {
			const params = new URLSearchParams();
			if (options.fetch) params.set("fetch", "1");
			if (options.force) params.set("force", "1");
			const status = await api(`/api/app-update/status${params.toString() ? `?${params.toString()}` : ""}`, { timeoutMs: options.fetch ? 25e3 : 12e3 });
			state.appUpdateStatus = status;
			state.appUpdateError = status && status.error ? status.error : "";
			return status;
		} catch (err) {
			state.appUpdateError = err.message || String(err);
			state.appUpdateStatus = Object.assign({}, state.appUpdateStatus || {}, {
				version: state.appVersion,
				error: state.appUpdateError
			});
			return state.appUpdateStatus;
		} finally {
			state.appUpdateBusy = false;
			renderAppUpdateStatus();
			renderUpdatePanel();
		}
	}
	function currentUpdateUsesPublicRelease(status = state.appUpdateStatus) {
		const remoteUrl = String(status && status.remoteUrl || "").toLowerCase();
		const repository = String(state.publicReleaseRepository || state.publicPrRepository || "").toLowerCase();
		if (!remoteUrl || !repository) return false;
		return remoteUrl.includes(`github.com/${repository}`) || remoteUrl.endsWith(`/${repository}.git`) || remoteUrl.endsWith(`/${repository}`);
	}
	function updateStatusLine(status) {
		if (!status) return "Not checked";
		if (state.appUpdateRestarting || status.restartScheduled) return "Restart pending";
		if (state.appUpdateBusy || status.checking) return "Checking";
		if (status.applying) return "Updating";
		if (status.error) return `Error: ${status.error}`;
		if (status.supported === false) return status.reason || "Not supported";
		if (status.updateAvailable && status.canFastForward) return `Update available: ${status.remoteShort || status.remoteCommit || ""}`.trim();
		if (status.updateAvailable) return `Update blocked: ${status.reason || "cannot fast-forward"}`;
		return "Up to date";
	}
	function publicReleaseStatusLine(status) {
		if (!state.publicReleaseEnabled) return "Public release check disabled";
		if (!status) return "Not checked";
		if (state.publicReleaseBusy || status.checking) return "Checking";
		if (status.error) return `Error: ${status.error}`;
		if (status.supported === false) return status.reason || "Not supported";
		if (status.updateAvailable) return `Public latest: ${status.publicShort || ""}`.trim();
		return "Matches Public latest";
	}
	function updateActionButton(action, label, options = {}) {
		const classes = ["update-action-button"];
		if (options.primary) classes.push("primary");
		return `<button type="button" class="${escapeHtml(classes.join(" "))}" data-update-action="${escapeHtml(action)}" ${options.disabled ? "disabled" : ""}>${escapeHtml(label)}</button>`;
	}
	function publicPrHasOpenPullRequests(status) {
		return Boolean(status && status.hasOpenPullRequests);
	}
	function renderUpdatePanel() {
		const dialog = $("updateDialog");
		const content = $("updatePanelContent");
		if (!dialog || !content) return;
		dialog.classList.toggle("hidden", !state.updatePanelOpen);
		if (!state.updatePanelOpen) return;
		const current = state.appUpdateStatus || {};
		const release = state.publicReleaseStatus || {};
		const publicCheckout = currentUpdateUsesPublicRelease(current) || Boolean(release.currentCheckoutUsesPublicRelease);
		const canApplyCurrent = Boolean(current.updateAvailable && current.canFastForward && !state.appUpdateBusy && !state.appUpdateRestarting);
		const hasPublicPrs = publicPrHasOpenPullRequests(state.publicPrStatus);
		const publicPrActionLabel = state.publicPrBusy ? "Checking PR..." : hasPublicPrs ? "Review Public PR" : "Check PR";
		const currentButtons = [updateActionButton("refresh-current", state.appUpdateBusy ? "Checking..." : "Check current", { disabled: state.appUpdateBusy }), updateActionButton("apply-current", publicCheckout ? "Update from Public" : "Apply current update", {
			primary: canApplyCurrent,
			disabled: !canApplyCurrent
		})].join("");
		const publicButtons = [updateActionButton("refresh-public", state.publicReleaseBusy ? "Checking..." : "Check Public", { disabled: state.publicReleaseBusy || !state.publicReleaseEnabled }), updateActionButton("public-pr", publicPrActionLabel, {
			disabled: state.publicPrBusy || !state.publicPrEnabled,
			primary: hasPublicPrs
		})].join("");
		content.innerHTML = `
      <section class="update-card update-version-card">
        <div class="update-card-title">完整客户端版本</div>
        <div class="update-row">
          <strong>${escapeHtml(appVersionText(current))}</strong>
          <span class="update-row-meta">${escapeHtml(fullClientBuildVersionText(current))}</span>
        </div>
      </section>
      <section class="update-card">
        <div class="update-card-title">Current checkout</div>
        <div class="update-row">
          <strong>${escapeHtml(updateStatusLine(current))}</strong>
          <span class="update-row-meta">${escapeHtml(current.remote || "origin")}/${escapeHtml(current.branch || "main")} ${escapeHtml(current.localShort || "")}${current.remoteShort ? ` -> ${escapeHtml(current.remoteShort)}` : ""}</span>
          <span class="update-row-detail">${escapeHtml(current.reason || current.remoteUrl || "Checks the Git remote configured for this running checkout.")}</span>
        </div>
        <div class="update-actions">${currentButtons}</div>
      </section>
      <section class="update-card">
        <div class="update-card-title">Public release</div>
        <div class="update-row">
          <strong>${escapeHtml(publicReleaseStatusLine(release))}</strong>
          <span class="update-row-meta">${escapeHtml(release.repository || state.publicReleaseRepository || "")}/${escapeHtml(release.branch || state.publicReleaseBranch || "main")} ${escapeHtml(release.publicShort || "")}</span>
          <span class="update-row-detail">${escapeHtml(publicCheckout ? "This checkout tracks Public, so the current update button applies Public fast-forward updates." : "This checkout does not track Public; Public latest is shown for reference here.")}</span>
        </div>
        <div class="update-actions">${publicButtons}</div>
      </section>`;
	}
	async function refreshPublicReleaseStatus(options = {}) {
		if (!state.key || !state.publicReleaseEnabled) return null;
		if (state.publicReleaseBusy && !options.force) return state.publicReleaseStatus;
		state.publicReleaseBusy = true;
		renderUpdatePanel();
		try {
			const params = new URLSearchParams();
			if (options.force) params.set("force", "1");
			const status = await api(`/api/public-release/status${params.toString() ? `?${params.toString()}` : ""}`, { timeoutMs: 18e3 });
			state.publicReleaseStatus = status;
			return status;
		} catch (err) {
			state.publicReleaseStatus = Object.assign({}, state.publicReleaseStatus || {}, {
				enabled: state.publicReleaseEnabled,
				repository: state.publicReleaseRepository,
				branch: state.publicReleaseBranch,
				error: err.message || String(err)
			});
			return state.publicReleaseStatus;
		} finally {
			state.publicReleaseBusy = false;
			renderUpdatePanel();
		}
	}
	function openUpdatePanel() {
		state.updatePanelOpen = true;
		renderUpdatePanel();
		publishPluginNavigationState({ force: true });
		refreshAppUpdateStatus({
			fetch: true,
			force: true,
			silent: true
		}).then(renderUpdatePanel).catch(() => renderUpdatePanel());
		refreshPublicReleaseStatus({ force: true }).catch(() => renderUpdatePanel());
	}
	function closeUpdatePanel() {
		state.updatePanelOpen = false;
		renderUpdatePanel();
		publishPluginNavigationState({ force: true });
	}
	function handleUpdatePanelClick(event) {
		const button = event.target && event.target.closest("[data-update-action]");
		if (!button) return;
		const action = button.dataset.updateAction;
		if (action === "refresh-current") refreshAppUpdateStatus({
			fetch: true,
			force: true,
			silent: true
		}).then(renderUpdatePanel).catch(showError);
		else if (action === "apply-current") handleAppUpdateClick().then(renderUpdatePanel).catch(showError);
		else if (action === "refresh-public") refreshPublicReleaseStatus({ force: true }).catch(showError);
		else if (action === "public-pr") handlePublicPrStatusClick().catch(showError);
	}
	function scheduleStartupUpdateCheck() {
		if (!state.key) return;
		window.setTimeout(() => {
			refreshAppUpdateStatus({
				fetch: true,
				force: true,
				silent: true
			}).catch(() => {});
		}, 900);
	}
	function publicPrPromptKey(status) {
		if (!publicPrHasOpenPullRequests(status)) return "";
		const pullRequests = Array.isArray(status.pullRequests) ? status.pullRequests : [];
		const marker = pullRequests.map((pr) => `#${pr.number || ""}:${pr.updatedAt || ""}`).filter(Boolean).join("|");
		return `${status.repository || ""}|${status.openPullRequestCount || pullRequests.length}|${marker}`;
	}
	function publicPrSummaryText(status) {
		const pullRequests = Array.isArray(status && status.pullRequests) ? status.pullRequests : [];
		if (!pullRequests.length) return "";
		return pullRequests.map((pr) => `#${pr.number} ${pr.title || ""}`.trim()).join("; ");
	}
	function normalizedPublicPrReviewTitle(value) {
		return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
	}
	function publicPrReviewThreadTitle() {
		return PUBLIC_PR_REVIEW_THREAD_TITLE;
	}
	function findPublicPrReviewThread(workspacePath = "") {
		const titleKey = normalizedPublicPrReviewTitle(publicPrReviewThreadTitle());
		const workspace = String(workspacePath || "").trim();
		return state.threads.find((thread) => {
			if (!thread || !thread.id) return false;
			if (normalizedPublicPrReviewTitle(thread.name || thread.title || thread.preview || "") !== titleKey) return false;
			return !workspace || threadMatchesWorkspaceCwd(thread.cwd || "", workspace);
		}) || null;
	}
	function workspacePathBaseName(value) {
		const text = String(value || "").trim().replace(/[\\/]+$/, "");
		if (!text) return "";
		const parts = text.split(/[\\/]+/).filter(Boolean);
		return parts[parts.length - 1] || "";
	}
	function workspacePathIsVisible(value) {
		const key = normalizeFsPath(value);
		if (!key) return false;
		return (state.workspaces || []).some((workspace) => normalizeFsPath(workspace && workspace.cwd) === key);
	}
	function visibleWorkspaceWithBaseName(value) {
		const baseName = workspacePathBaseName(value).toLowerCase();
		if (!baseName) return "";
		const match = (state.workspaces || []).find((workspace) => workspace && workspace.cwd && workspacePathBaseName(workspace.cwd).toLowerCase() === baseName);
		return match ? String(match.cwd || "").trim() : "";
	}
	function publicPrReviewWorkspacePath() {
		const appWorkspace = String(state.appWorkspacePath || "").trim();
		if (workspacePathIsVisible(appWorkspace)) return appWorkspace;
		const sameNameWorkspace = visibleWorkspaceWithBaseName(appWorkspace);
		if (sameNameWorkspace) return sameNameWorkspace;
		const selectedWorkspace = String(state.selectedCwd || "").trim();
		if (workspacePathIsVisible(selectedWorkspace)) return selectedWorkspace;
		const currentWorkspace = String(state.currentThread && state.currentThread.cwd || "").trim();
		if (workspacePathIsVisible(currentWorkspace)) return currentWorkspace;
		return appWorkspace || selectedWorkspace || currentWorkspace;
	}
	async function openPublicPrReviewThreadIfAvailable(workspacePath, text) {
		let target = findPublicPrReviewThread(workspacePath);
		if (!target) {
			try {
				await loadThreads({ silent: true });
			} catch (err) {
				postClientEvent("public_pr_reuse_lookup_failed", { message: err.message || String(err) });
			}
			target = findPublicPrReviewThread(workspacePath);
		}
		if (!target || !target.id) return false;
		await loadThread(target.id, { source: "public-pr" });
		setComposerText(text);
		scheduleCurrentDraftSave();
		updateComposerControls();
		return true;
	}
	function renderPublicPrStatus() {
		const el = $("publicPrStatus");
		if (!el) return;
		const status = state.publicPrStatus || {};
		const enabled = state.publicPrEnabled && status.enabled !== false;
		const checking = state.publicPrBusy || Boolean(status.checking);
		const hasPrs = publicPrHasOpenPullRequests(status);
		const blocked = Boolean(status.error || status.supported === false);
		let label = "Public PR";
		let title = state.publicPrRepository ? `Check ${state.publicPrRepository} pull requests` : "Check public pull requests";
		if (checking) {
			label = "PR...";
			title = "Checking public pull requests";
		} else if (hasPrs) {
			label = `PR ${status.openPullRequestCount || (status.pullRequests || []).length}`;
			title = `Open public PRs: ${publicPrSummaryText(status) || label}`;
		} else if (status.checkedAt && enabled) {
			label = "No PR";
			title = `No open public PRs in ${status.repository || state.publicPrRepository || "public repo"}`;
		} else if (blocked) {
			label = "PR ?";
			title = status.error || status.reason || "Public PR check is unavailable";
		}
		el.textContent = label;
		el.title = title;
		el.classList.toggle("hidden", !checking && !hasPrs && !blocked);
		el.classList.toggle("available", hasPrs);
		el.classList.toggle("blocked", blocked);
		el.classList.toggle("checking", checking);
		el.disabled = state.publicPrBusy;
	}
	async function refreshPublicPrStatus(options = {}) {
		if (!state.key || !state.publicPrEnabled) return null;
		if (state.publicPrBusy && !options.force) return state.publicPrStatus;
		state.publicPrBusy = true;
		if (!options.silent) renderPublicPrStatus();
		try {
			const params = new URLSearchParams();
			if (options.force) params.set("force", "1");
			const status = await api(`/api/public-pull-requests/status${params.toString() ? `?${params.toString()}` : ""}`, { timeoutMs: 18e3 });
			state.publicPrStatus = status;
			state.publicPrError = status && status.error ? status.error : "";
			if (!options.skipPrompt) maybePromptPublicPrMerge(status);
			return status;
		} catch (err) {
			state.publicPrError = err.message || String(err);
			state.publicPrStatus = Object.assign({}, state.publicPrStatus || {}, {
				enabled: state.publicPrEnabled,
				repository: state.publicPrRepository,
				hasOpenPullRequests: false,
				openPullRequestCount: 0,
				pullRequests: [],
				error: state.publicPrError
			});
			return state.publicPrStatus;
		} finally {
			state.publicPrBusy = false;
			renderPublicPrStatus();
			renderUpdatePanel();
		}
	}
	function scheduleStartupPublicPrCheck() {
		if (!state.key || !state.publicPrEnabled) return;
		window.setTimeout(() => {
			refreshPublicPrStatus({
				force: true,
				silent: true
			}).catch(() => {});
		}, 1600);
	}
	function publicPrMergeInstruction(status) {
		const summary = publicPrSummaryText(status);
		return [
			`请检查 public 仓库 ${status && status.repository || state.publicPrRepository || "pentiumxp/codex-mobile-web-public"} 的开放 PR${summary ? `：${summary}` : ""}。`,
			"按当前项目规则先评估 PR 是否可合并；如要合并，更新 public README 的中文发布说明，运行验证和隐私扫描，再提交并推送 public。",
			"不要复制 .agent-context、runtime state、本地密钥、上传内容或机器特定诊断。完成 public 后再同步回 private 并重新验证。"
		].join("\n");
	}
	function publicPrMergeConfirmationMessage(status) {
		return [
			`检测到 public 仓库有 ${status.openPullRequestCount || (status.pullRequests || []).length} 个开放 PR。`,
			publicPrSummaryText(status),
			"",
			"是否准备一条合并/发布检查任务？"
		].filter(Boolean).join("\n");
	}
	async function preparePublicPrMergePrompt(status) {
		const text = publicPrMergeInstruction(status);
		if (composerHasContent()) {
			await requestAppAlert("检测到 public 开放 PR，但输入框已有内容。请处理当前草稿后点击 Public PR 按钮。", { title: "Public PR" });
			return;
		}
		if (!state.workspaces.length) await loadWorkspaces().catch((err) => {
			postClientEvent("public_pr_workspace_lookup_failed", { message: err.message || String(err) });
		});
		const workspacePath = publicPrReviewWorkspacePath();
		if (!workspacePath) {
			setComposerText(text);
			scheduleCurrentDraftSave();
			updateComposerControls();
			return;
		}
		saveCurrentDraftNow();
		state.selectedCwd = workspacePath;
		syncSidebarWorkspaceSelect();
		updateWorkspacePath();
		renderWorkspaceTokenUsage();
		if (await openPublicPrReviewThreadIfAvailable(workspacePath, text)) {
			if (isMenuOverlayMode()) closeSidebarMenu();
			return;
		}
		clearCurrentThreadSelection({ saveDraft: false });
		state.selectedCwd = workspacePath;
		state.newThreadDraft = true;
		state.newThreadTitle = publicPrReviewThreadTitle();
		state.sendButtonHint = "";
		restoreDraftForCurrentTarget();
		state.newThreadTitle = publicPrReviewThreadTitle();
		setComposerText(text);
		syncSidebarWorkspaceSelect();
		updateWorkspacePath();
		renderWorkspaceTokenUsage();
		renderThreads();
		renderCurrentThread();
		updateComposerControls();
		scheduleCurrentDraftSave();
		if (isMenuOverlayMode()) closeSidebarMenu();
	}
	function rememberPublicPrPrompt(status) {
		const key = publicPrPromptKey(status);
		if (!key) return;
		state.publicPrPromptedKey = key;
		localStorage.setItem(STORAGE_PUBLIC_PR_PROMPT, key);
	}
	function maybePromptPublicPrMerge(status) {
		if (!publicPrHasOpenPullRequests(status)) return;
		const key = publicPrPromptKey(status);
		if (!key || key === state.publicPrPromptedKey) return;
		rememberPublicPrPrompt(status);
		requestAppConfirmation(publicPrMergeConfirmationMessage(status), {
			title: "Public PR",
			confirmLabel: "准备任务",
			cancelLabel: "稍后"
		}).then((confirmed) => {
			if (confirmed) preparePublicPrMergePrompt(status).catch(showError);
		}).catch(showError);
	}
	async function handlePublicPrStatusClick() {
		if (state.publicPrBusy) return;
		const status = await refreshPublicPrStatus({
			force: true,
			skipPrompt: true
		});
		if (!status) return;
		if (status.error && !publicPrHasOpenPullRequests(status)) {
			await requestAppAlert(`public PR 检查失败：${status.error}`, { title: "Public PR" });
			return;
		}
		if (!publicPrHasOpenPullRequests(status)) {
			await requestAppAlert("当前未检测到 public 开放 PR。", { title: "Public PR" });
			return;
		}
		const confirmed = await requestAppConfirmation(publicPrMergeConfirmationMessage(status), {
			title: "Public PR",
			confirmLabel: "准备任务",
			cancelLabel: "稍后"
		});
		rememberPublicPrPrompt(status);
		if (confirmed) await preparePublicPrMergePrompt(status);
	}
	async function handleAppUpdateClick() {
		if (state.appUpdateBusy || state.appUpdateRestarting) return;
		let status = state.appUpdateStatus;
		if (!status || !status.updateAvailable && !status.error) status = await refreshAppUpdateStatus({
			fetch: true,
			force: true
		});
		if (!status) return;
		if (status.supported === false) {
			await requestAppAlert(`当前安装方式不支持自动更新：${status.reason || "没有可用的 Git 远程分支"}`, { title: "更新检查" });
			return;
		}
		if (status.error && !status.updateAvailable) {
			await requestAppAlert(`更新检查失败：${status.error}`, { title: "更新检查" });
			return;
		}
		if (!status.updateAvailable) {
			await requestAppAlert("当前已经是最新版本。", { title: "更新检查" });
			return;
		}
		if (!status.canFastForward) {
			await requestAppAlert(`检测到更新，但不能自动应用：${status.reason || status.error || "当前工作区不是干净的 fast-forward 状态"}`, { title: "更新检查" });
			return;
		}
		if (!await requestAppConfirmation([
			"发现 GitHub 更新。是否拉取并重启 Mobile Web？",
			"",
			"仅在当前仓库干净、可 fast-forward 时执行；运行时数据和 Access Key 不会被覆盖。",
			"更新完成后当前 Node 服务会退出。只有通过 Windows 启动任务、windowless supervisor 或 macOS shared launcher 运行时才会自动拉起；手动运行 node/npm start 的部署需要手动重启。"
		].join("\n"), {
			title: "应用更新",
			confirmLabel: "更新并重启",
			cancelLabel: "取消"
		})) return;
		state.appUpdateBusy = true;
		renderAppUpdateStatus();
		try {
			const result = await api("/api/app-update/apply", {
				method: "POST",
				body: "{}",
				timeoutMs: 15e4
			});
			state.appUpdateStatus = result.after || result.status || status;
			if (result.updated) {
				state.appUpdateRestarting = true;
				$("connectionState").textContent = "更新已应用；如连接断开且未自动恢复，请在部署机手动重启";
				renderAppUpdateStatus();
				window.setTimeout(() => window.location.reload(), Math.max(1800, Number(result.restartInMs || 1200) + 900));
			} else await requestAppAlert("当前已经是最新版本。", { title: "更新检查" });
		} catch (err) {
			state.appUpdateError = err.message || String(err);
			state.appUpdateStatus = Object.assign({}, status || {}, { error: state.appUpdateError });
			showError(err);
		} finally {
			state.appUpdateBusy = false;
			renderAppUpdateStatus();
			renderUpdatePanel();
		}
	}
	function renderSharedRestartButton() {
		const el = $("sharedRestartButton");
		if (!el) return;
		const restarting = state.sharedRestarting;
		el.textContent = restarting ? "Restarting" : "Restart";
		el.title = restarting ? "Mobile Web is restarting" : "Restart Mobile Web shared chain";
		el.disabled = state.sharedRestartBusy || restarting;
		el.classList.toggle("checking", state.sharedRestartBusy || restarting);
	}
	function renderHardRefreshButton() {
		const el = $("hardRefreshButton");
		if (!el) return;
		const reloading = state.pageRefreshReloading;
		el.textContent = reloading ? "刷新中" : "硬刷新";
		el.title = reloading ? "Refreshing the current PWA page shell" : "Fetch current page assets, update the service worker, and reload this PWA page";
		el.disabled = reloading;
		el.classList.toggle("checking", reloading);
	}
	function markBootReady() {
		const boot = window.codexMobileBoot;
		if (boot && typeof boot.ready === "function") boot.ready();
	}
	function reportShellLoaded(startedAt, details = {}) {
		if (state.shellLoadedReported) return;
		state.shellLoadedReported = true;
		postPerformanceEvent("shell_loaded", Object.assign({
			elapsedMs: roundedDurationMs(startedAt),
			buildId: CLIENT_BUILD_ID,
			hasThreadOpenIntent: Boolean(state.startupThreadOpenPending)
		}, details || {}), { force: true });
	}
	function sharedRestartScopeLines() {
		return state.serverPlatform === "darwin" ? ["这会短暂断开当前页面连接，并重启这台 Mac 上的 Mobile Web 服务。", "不会重启 Codex Desktop、shared mux 或其它本机服务。"] : ["这会短暂断开当前页面连接，并重启 Mobile Web、shared mux 和本地 app-server。", "不会重启 WSL、Codex Desktop 或其它本机服务。"];
	}
	function restartRiskThreads(threads) {
		const seen = /* @__PURE__ */ new Set();
		const result = [];
		for (const thread of threads || []) {
			const id = String(thread && thread.id || "");
			if (!id || seen.has(id) || !isRunningStatus(thread.status)) continue;
			seen.add(id);
			result.push(thread);
		}
		if (state.currentThreadId && state.activeTurnId && !seen.has(String(state.currentThreadId))) {
			const current = state.currentThread || threadById(state.currentThreadId) || {
				id: state.currentThreadId,
				name: "Current session",
				status: { type: "active" }
			};
			result.unshift(current);
		}
		return result;
	}
	async function fetchRestartRiskThreads() {
		const params = new URLSearchParams({
			limit: "200",
			archived: "false"
		});
		const result = await api(`/api/threads?${params}`, { timeoutMs: 45e3 });
		return restartRiskThreads(visibleThreads(result.data || []));
	}
	function restartRiskThreadTitle(thread) {
		return String(thread && (thread.name || thread.preview || thread.id) || "Untitled session").trim();
	}
	function restartRiskThreadMeta(thread) {
		const parts = [];
		const cwd = shortPath(thread && thread.cwd);
		if (cwd) parts.push(cwd);
		const status = statusText(thread && thread.status);
		if (status) parts.push(status);
		return parts.join(" | ");
	}
	function renderSharedRestartDialog() {
		const dialog = $("restartConfirmDialog");
		const subtitle = $("restartConfirmSubtitle");
		const content = $("restartConfirmContent");
		const proceed = $("restartConfirmProceed");
		if (!dialog || !content || !subtitle || !proceed) return;
		dialog.classList.toggle("hidden", !state.sharedRestartDialogOpen);
		if (!state.sharedRestartDialogOpen) {
			content.innerHTML = "";
			return;
		}
		const riskThreads = state.sharedRestartRiskThreads || [];
		const hasRisk = riskThreads.length > 0;
		subtitle.textContent = hasRisk ? `${riskThreads.length} running session${riskThreads.length === 1 ? "" : "s"} may be interrupted` : "No running sessions were found";
		proceed.textContent = hasRisk ? "仍然重启" : "Restart";
		proceed.classList.toggle("danger", hasRisk);
		const scopeHtml = (state.sharedRestartScopeLines || []).map((line) => `<div class="restart-confirm-line">${escapeHtml(line)}</div>`).join("");
		const riskHtml = hasRisk ? `<div class="restart-risk-block">
          <div class="restart-risk-title">Running sessions</div>
          <div class="restart-risk-list">
            ${riskThreads.slice(0, 6).map((thread) => {
			const meta = restartRiskThreadMeta(thread);
			return `<div class="restart-risk-item">
                <div class="restart-risk-item-title">${escapeHtml(restartRiskThreadTitle(thread))}</div>
                ${meta ? `<div class="restart-risk-item-meta">${escapeHtml(meta)}</div>` : ""}
              </div>`;
		}).join("")}
            ${riskThreads.length > 6 ? `<div class="restart-risk-more">另有 ${escapeHtml(String(riskThreads.length - 6))} 个 running session</div>` : ""}
          </div>
        </div>` : `<div class="restart-safe-block">当前没有检测到 running session。重启仍会短暂断开本页面连接。</div>`;
		content.innerHTML = `
      <div class="restart-confirm-message">
        ${hasRisk ? "重启可能会打断正在通过 Codex Mobile 同步或运行的 session。建议等它们结束后再重启。" : "确认重启 Codex Mobile Web？"}
      </div>
      ${riskHtml}
      <div class="restart-confirm-scope">${scopeHtml}</div>
    `;
	}
	function closeSharedRestartDialog(confirmed = false) {
		const resolve = state.sharedRestartConfirmResolve;
		state.sharedRestartDialogOpen = false;
		state.sharedRestartRiskThreads = [];
		state.sharedRestartScopeLines = [];
		state.sharedRestartConfirmResolve = null;
		renderSharedRestartDialog();
		if (resolve) resolve(Boolean(confirmed));
	}
	function requestSharedRestartConfirmation(riskThreads, scopeLines) {
		if (state.sharedRestartConfirmResolve) closeSharedRestartDialog(false);
		state.sharedRestartRiskThreads = riskThreads || [];
		state.sharedRestartScopeLines = scopeLines || [];
		state.sharedRestartDialogOpen = true;
		renderSharedRestartDialog();
		return new Promise((resolve) => {
			state.sharedRestartConfirmResolve = resolve;
		});
	}
	async function handleSharedRestartClick() {
		if (state.sharedRestartBusy || state.sharedRestarting) return;
		state.sharedRestartBusy = true;
		renderSharedRestartButton();
		try {
			const riskThreads = await fetchRestartRiskThreads();
			if (!await requestSharedRestartConfirmation(riskThreads, sharedRestartScopeLines())) return;
			saveRestartAutoRecoverThreads(riskThreads);
			state.appServerWasUnavailable = true;
			await api("/api/restart/shared-chain", {
				method: "POST",
				body: "{}",
				timeoutMs: 12e3
			});
			state.sharedRestarting = true;
			state.sharedRestartBusy = false;
			showReconnectRefreshPrompt("restart");
			const connection = $("connectionState");
			if (connection) connection.textContent = "Restarting";
			renderSharedRestartButton();
		} catch (err) {
			showError(err);
		} finally {
			if (!state.sharedRestarting) {
				state.sharedRestartBusy = false;
				renderSharedRestartButton();
			}
		}
	}
	function serverBuildIdFromConfig(config) {
		return String(config && (config.clientBuildId || config.shellCacheName || config.buildId) || "").trim();
	}
	function shouldPromptForServerBuildChange(serverBuildId, clientBuildId) {
		if (buildRefreshPolicy && typeof buildRefreshPolicy.shouldPromptForServerBuildChange === "function") return buildRefreshPolicy.shouldPromptForServerBuildChange(serverBuildId, clientBuildId);
		return Boolean(serverBuildId && clientBuildId && serverBuildId !== clientBuildId);
	}
	function loadedClientBuildId() {
		return String(CLIENT_BUILD_ID || "").trim();
	}
	function serverBuildMatchesLoadedClient(config) {
		const nextBuildId = serverBuildIdFromConfig(config);
		const clientBuildId = loadedClientBuildId();
		return Boolean(nextBuildId && clientBuildId && !shouldPromptForServerBuildChange(nextBuildId, clientBuildId));
	}
	function clearSettledServerBuildPluginRefresh(config) {
		if (!isHermesEmbedMode() || !serverBuildMatchesLoadedClient(config)) return false;
		return Boolean(clearPluginRefreshPendingNotice("server_build_changed"));
	}
	function acceptLoadedClientBuild(config) {
		const clientBuildId = loadedClientBuildId();
		const nextBuildId = serverBuildIdFromConfig(config);
		state.serverBuildId = clientBuildId || nextBuildId || state.serverBuildId;
		state.serverAssetBuildId = String(config && config.buildId || state.serverAssetBuildId || "").trim();
		if (state.pageRefreshReason === "build") {
			state.pageRefreshAvailable = false;
			state.pageRefreshReason = "";
			state.pageRefreshBuildId = "";
			state.pageRefreshPreparedConfig = null;
			renderPageRefreshPrompt();
		}
	}
	function frontendDiagnosticPublicConfigSignature(config) {
		const raw = config && config.frontendDiagnosticLog && typeof config.frontendDiagnosticLog === "object" ? config.frontendDiagnosticLog : null;
		if (!raw || typeof raw.enabled !== "boolean") return "";
		return JSON.stringify({
			enabled: Boolean(raw.enabled),
			upload: raw.upload !== false,
			scopes: raw.scopes || "submitted_echo",
			maxEntries: raw.maxEntries || 400,
			updatedAt: raw.updatedAt || ""
		});
	}
	function applyRuntimePublicConfig(config, source = "public-config") {
		const signature = frontendDiagnosticPublicConfigSignature(config);
		if (!signature || state.frontendDiagnosticLogPublicConfigSignature === signature) return null;
		state.frontendDiagnosticLogPublicConfigSignature = signature;
		try {
			const status = applyFrontendDiagnosticLogPublicConfig(config) || {};
			postClientEvent("frontend_diagnostic_log_settings_applied", {
				source,
				enabled: Boolean(status.enabled),
				upload: Boolean(status.upload),
				scopes: Array.isArray(status.scopes) ? status.scopes.join(",") : String(status.scopes || ""),
				maxEntries: Number(status.maxEntries || 0)
			});
			return status;
		} catch (err) {
			postClientEvent("frontend_diagnostic_log_settings_apply_failed", {
				source,
				error: err && err.message ? err.message : String(err)
			});
			return null;
		}
	}
	function pageShellAssetUrl(asset, buildId) {
		const url = new URL(asset, window.location.origin);
		url.searchParams.set("shellBuild", buildId || "current");
		url.searchParams.set("shellCheck", String(Date.now()));
		return url.href;
	}
	function validatePageShellAsset(asset, text, config) {
		const buildId = serverBuildIdFromConfig(config);
		const shellCacheName = String(config && config.shellCacheName || "").trim();
		if (asset === "/" || asset === "/index.html") return text.includes("href=\"/styles.css\"") && text.includes("src=\"/app.js\"");
		if (asset === "/styles.css") return text.includes(".app") && text.includes(".composer");
		if (asset === "/app.js") return !buildId || text.includes(buildId) || text.includes(shellCacheName);
		if (asset === "/sw.js") return text.includes("shell-asset-manifest.js");
		return true;
	}
	async function fetchPageShellAsset(asset, config) {
		const response = await fetch(pageShellAssetUrl(asset, serverBuildIdFromConfig(config)), {
			cache: "no-store",
			credentials: "same-origin"
		});
		if (!response.ok) throw new Error(`page shell asset unavailable: ${asset}`);
		if (asset === "/" || asset.endsWith(".html") || asset.endsWith(".css") || asset.endsWith(".js") || asset.endsWith(".json") || asset.endsWith(".svg")) {
			if (!validatePageShellAsset(asset, await response.clone().text(), config)) throw new Error(`page shell asset stale: ${asset}`);
		}
		return response;
	}
	async function preparePageShellAssets(config, options = {}) {
		const populateCache = Boolean(options.populateCache);
		const shellCacheName = String(config && config.shellCacheName || "").trim();
		const cache = populateCache && shellCacheName && "caches" in window ? await window.caches.open(shellCacheName) : null;
		for (const asset of PAGE_SHELL_ASSETS) {
			const response = await fetchPageShellAsset(asset, config);
			if (cache) await cache.put(asset, response.clone());
		}
	}
	async function fetchPageBuildConfig() {
		const response = await fetch(`/api/public-config?buildCheck=${Date.now()}`, {
			cache: "no-store",
			credentials: "same-origin"
		});
		if (!response.ok) return null;
		const config = await response.json();
		applyRuntimePublicConfig(config, "page-build-check");
		return config;
	}
	async function pruneOldShellCaches(expectedCacheName) {
		if (!expectedCacheName || !("caches" in window)) return;
		const keys = await window.caches.keys();
		await Promise.all(keys.filter((key) => String(key || "").startsWith("codex-mobile-shell-") && key !== expectedCacheName).map((key) => window.caches.delete(key)));
	}
	async function clearAllShellCaches() {
		if (!("caches" in window)) return;
		const keys = await window.caches.keys();
		await Promise.all(keys.filter((key) => String(key || "").startsWith("codex-mobile-shell-")).map((key) => window.caches.delete(key)));
	}
	async function resetPageShellServiceWorker() {
		if (!("serviceWorker" in navigator)) return null;
		const registrations = await navigator.serviceWorker.getRegistrations();
		await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
		state.serviceWorkerRegistration = null;
		const registration = await navigator.serviceWorker.register("/sw.js");
		if (registration && registration.update) await registration.update().catch(() => {});
		state.serviceWorkerRegistration = registration || null;
		return registration || null;
	}
	function pageReloadUrlWithBust() {
		const url = new URL(window.location.href, window.location.origin);
		url.searchParams.set("shellReload", String(Date.now()));
		return url.href;
	}
	function recordPageRefreshFailure(err, phase = "refresh") {
		try {
			postClientEvent("page_refresh_failed", {
				phase,
				reason: String(state.pageRefreshReason || ""),
				currentBuildId: String(state.serverBuildId || CLIENT_BUILD_ID || ""),
				targetBuildId: String(state.pageRefreshBuildId || ""),
				errorName: err && err.name ? String(err.name) : "",
				errorMessage: err && err.message ? String(err.message).slice(0, 180) : String(err || "").slice(0, 180)
			});
		} catch (_) {}
	}
	function initializePageBuildState(config) {
		state.serverBuildId = CLIENT_BUILD_ID || serverBuildIdFromConfig(config);
		state.serverAssetBuildId = String(config && config.buildId || "").trim();
		const currentServerBuildId = serverBuildIdFromConfig(config);
		if (shouldPromptForServerBuildChange(currentServerBuildId, state.serverBuildId)) {
			state.pageRefreshBuildId = currentServerBuildId;
			state.pageRefreshReason = "build";
			state.pageRefreshAvailable = true;
			state.pageRefreshPreparedConfig = config || null;
			if (isHermesEmbedMode()) {
				requestHermesPluginRefresh("server_build_changed", { force: true });
				return;
			}
		}
		clearSettledServerBuildPluginRefresh(config);
		renderPageRefreshPrompt();
	}
	function renderPageRefreshPrompt() {
		const el = $("pageRefreshPrompt");
		if (!el) return;
		const restarting = state.pageRefreshReason === "restart";
		const reconnecting = state.pageRefreshReason === "reconnect" || restarting;
		el.classList.toggle("hidden", !state.pageRefreshAvailable && !state.pageRefreshReloading);
		el.disabled = state.pageRefreshReloading;
		if (state.pageRefreshReloading) el.textContent = restarting ? "Waiting for service, then refreshing..." : reconnecting ? "Refreshing and reconnecting..." : "Refreshing page...";
		else el.textContent = restarting ? "Service restarted. Tap to refresh." : reconnecting ? "Connection changed. Tap to refresh." : "New version available. Tap to refresh.";
		el.title = restarting || reconnecting ? "Manual refresh only; the page will not reload until this button is tapped." : state.pageRefreshBuildId ? `Server version is ${state.pageRefreshBuildId}. Tap to refresh manually.` : "Server page assets changed. Tap to refresh manually.";
		renderHardRefreshButton();
	}
	async function handleHardRefreshClick() {
		if (state.pageRefreshReloading) return;
		state.pageRefreshPreparedConfig = null;
		state.pageRefreshReason = "build";
		state.pageRefreshAvailable = true;
		await refreshPageForNewBuild();
	}
	function showReconnectRefreshPrompt(reason = "reconnect") {
		if (state.pageRefreshReloading) return;
		if (isHermesEmbedMode() && reason !== "restart") return;
		state.pageRefreshAvailable = true;
		state.pageRefreshReason = reason === "restart" ? "restart" : "reconnect";
		state.pageRefreshPreparedConfig = null;
		renderPageRefreshPrompt();
	}
	function codexProfileHasQuotaSnapshot(profile) {
		const quota = profile && typeof profile === "object" ? profile.quota : null;
		if (!quota || typeof quota !== "object") return false;
		if (quota.rateLimits && typeof quota.rateLimits === "object") return true;
		const byModel = quota.rateLimitsByModel;
		return Boolean(byModel && typeof byModel === "object" && Object.keys(byModel).length);
	}
	function codexProfileRestartReadyForCompletion() {
		const targetId = String(state.codexProfileSwitchTargetId || "");
		if (!state.codexProfileRestarting || !targetId) return true;
		if (!state.activeCodexProfileId || targetId !== state.activeCodexProfileId) return false;
		const activeProfile = (Array.isArray(state.codexProfiles) ? state.codexProfiles : []).find((profile) => String(profile && profile.id || "") === targetId);
		if (!activeProfile || !codexProfileHasQuotaSnapshot(activeProfile)) {
			state.codexProfileSwitchStage = "服务已恢复，正在等待目标账号额度刷新...";
			const connection = $("connectionState");
			if (connection) connection.textContent = state.codexProfileSwitchStage;
			renderCodexProfileSettings();
			return false;
		}
		return true;
	}
	function finishRestartingUiIfReady() {
		if (!codexProfileRestartReadyForCompletion()) return false;
		const changed = Boolean(state.codexProfileRestarting || state.sharedRestarting || state.codexProfileSwitchTargetId || state.codexProfileSwitchStage);
		stopCodexProfileSwitchProgressPolling();
		state.codexProfileRestarting = false;
		state.codexProfileSwitchTargetId = "";
		state.codexProfileSwitchStage = "";
		state.codexProfileSwitchRequestId = "";
		state.sharedRestarting = false;
		state.sharedRestartBusy = false;
		if (changed) {
			renderCodexProfileSettings();
			renderSharedRestartButton();
		}
		return changed;
	}
	function clearReconnectRefreshPrompt() {
		if (!(state.pageRefreshReason === "reconnect" || state.pageRefreshReason === "restart") || state.pageRefreshReloading) return;
		state.pageRefreshAvailable = false;
		state.pageRefreshReason = "";
		state.pageRefreshPreparedConfig = null;
		finishRestartingUiIfReady();
		renderPageRefreshPrompt();
	}
	async function checkPageRefreshAvailability(options = {}) {
		if (state.pageRefreshReloading) return;
		const now = Date.now();
		if (state.pageRefreshBusy) return;
		if (!options.force && now - state.pageRefreshLastCheckAt < PAGE_REFRESH_MIN_CHECK_INTERVAL_MS) return;
		state.pageRefreshBusy = true;
		state.pageRefreshLastCheckAt = now;
		try {
			const config = await fetchPageBuildConfig();
			if (!config) return;
			const nextBuildId = serverBuildIdFromConfig(config);
			const nextAssetBuildId = String(config && config.buildId || "").trim();
			if (!state.serverBuildId) {
				state.serverBuildId = CLIENT_BUILD_ID || nextBuildId;
				state.serverAssetBuildId = nextAssetBuildId;
				return;
			}
			if (serverBuildMatchesLoadedClient(config)) {
				acceptLoadedClientBuild(config);
				clearSettledServerBuildPluginRefresh(config);
				return;
			}
			const serverBuildNeedsRefresh = Boolean(nextBuildId && nextBuildId !== state.serverBuildId) && shouldPromptForServerBuildChange(nextBuildId, state.serverBuildId);
			if (Boolean(nextAssetBuildId && state.serverAssetBuildId && nextAssetBuildId !== state.serverAssetBuildId) && !serverBuildNeedsRefresh) {
				state.serverAssetBuildId = nextAssetBuildId;
				return;
			}
			if (serverBuildNeedsRefresh) {
				if (isHermesEmbedMode()) {
					state.pageRefreshBuildId = nextBuildId;
					state.pageRefreshPreparedConfig = config;
					requestHermesPluginRefresh("server_build_changed");
					return;
				}
				state.pageRefreshAvailable = true;
				state.pageRefreshReason = "build";
				state.pageRefreshBuildId = nextBuildId;
				state.pageRefreshPreparedConfig = config;
				renderPageRefreshPrompt();
			}
		} catch (_) {} finally {
			state.pageRefreshBusy = false;
		}
	}
	function schedulePageRefreshCheck(delayMs = 0, options = {}) {
		window.setTimeout(() => {
			checkPageRefreshAvailability(options).catch(() => {});
		}, Math.max(0, Number(delayMs || 0)));
	}
	function scheduleVisiblePageRefreshCheck(delayMs = 0, options = {}) {
		if (document.visibilityState === "hidden") return;
		schedulePageRefreshCheck(delayMs, options);
	}
	function startPageRefreshChecks() {
		if (state.pageRefreshTimer) clearInterval(state.pageRefreshTimer);
		state.pageRefreshTimer = window.setInterval(() => {
			if (document.visibilityState === "hidden") return;
			checkPageRefreshAvailability({ silent: true }).catch(() => {});
		}, PAGE_REFRESH_CHECK_INTERVAL_MS);
	}
	async function waitForPageBuildConfig(timeoutMs = 18e3) {
		const startedAt = Date.now();
		let lastError = null;
		while (Date.now() - startedAt < timeoutMs) {
			try {
				const config = await fetchPageBuildConfig();
				if (config) return config;
			} catch (err) {
				lastError = err;
			}
			await new Promise((resolve) => setTimeout(resolve, 900));
		}
		throw lastError || /* @__PURE__ */ new Error("Mobile Web is still unavailable");
	}
	async function refreshPageForNewBuild() {
		if (state.pageRefreshReloading) return;
		state.pageRefreshReloading = true;
		renderPageRefreshPrompt();
		saveCurrentDraftNow();
		let config = state.pageRefreshPreparedConfig;
		try {
			const reconnectRefresh = state.pageRefreshReason === "reconnect" || state.pageRefreshReason === "restart";
			const latestConfig = reconnectRefresh ? await waitForPageBuildConfig() : await fetchPageBuildConfig();
			if (latestConfig) config = latestConfig;
			if (!config) throw new Error("page refresh build config unavailable");
			const nextBuildId = serverBuildIdFromConfig(config);
			const currentBuildId = state.serverBuildId || CLIENT_BUILD_ID || nextBuildId;
			if (serverBuildMatchesLoadedClient(config)) {
				rememberRateLimitsFromConfig(config);
				rememberCodexProfiles(config && config.codexProfiles || null);
				acceptLoadedClientBuild(config);
				clearSettledServerBuildPluginRefresh(config);
				const restartFinished = reconnectRefresh ? finishRestartingUiIfReady() : false;
				state.pageRefreshReloading = false;
				state.pageRefreshAvailable = !restartFinished && state.codexProfileRestarting;
				state.pageRefreshReason = state.pageRefreshAvailable ? "restart" : "";
				state.pageRefreshPreparedConfig = null;
				renderPageRefreshPrompt();
				return;
			}
			if (reconnectRefresh && !shouldPromptForServerBuildChange(nextBuildId, currentBuildId)) {
				state.serverBuildId = currentBuildId || nextBuildId;
				state.serverAssetBuildId = String(config && config.buildId || state.serverAssetBuildId || "").trim();
				rememberRateLimitsFromConfig(config);
				rememberCodexProfiles(config && config.codexProfiles || null);
				const restartFinished = finishRestartingUiIfReady();
				state.pageRefreshReloading = false;
				state.pageRefreshAvailable = !restartFinished && state.codexProfileRestarting;
				state.pageRefreshReason = state.pageRefreshAvailable ? "restart" : "";
				state.pageRefreshPreparedConfig = null;
				renderPageRefreshPrompt();
				return;
			}
			rememberRateLimitsFromConfig(config);
			rememberCodexProfiles(config && config.codexProfiles || null);
			await clearAllShellCaches();
			if (config) await preparePageShellAssets(config, { populateCache: true });
			await resetPageShellServiceWorker();
			await pruneOldShellCaches(String(config && config.shellCacheName || "").trim());
			window.location.replace(pageReloadUrlWithBust());
		} catch (err) {
			recordPageRefreshFailure(err, "new-build-refresh");
			state.pageRefreshReloading = false;
			state.pageRefreshPreparedConfig = null;
			if (state.pageRefreshReason !== "reconnect" && state.pageRefreshReason !== "restart") {
				state.pageRefreshAvailable = true;
				state.pageRefreshReason = "build";
			}
			renderPageRefreshPrompt();
		}
	}
	return Object.freeze({
		appVersionText,
		clientBuildVersionText,
		fullClientBuildVersionText,
		renderAppUpdateStatus,
		refreshAppUpdateStatus,
		currentUpdateUsesPublicRelease,
		updateStatusLine,
		publicReleaseStatusLine,
		updateActionButton,
		publicPrHasOpenPullRequests,
		renderUpdatePanel,
		refreshPublicReleaseStatus,
		openUpdatePanel,
		closeUpdatePanel,
		handleUpdatePanelClick,
		scheduleStartupUpdateCheck,
		publicPrPromptKey,
		publicPrSummaryText,
		normalizedPublicPrReviewTitle,
		publicPrReviewThreadTitle,
		findPublicPrReviewThread,
		workspacePathBaseName,
		workspacePathIsVisible,
		visibleWorkspaceWithBaseName,
		publicPrReviewWorkspacePath,
		openPublicPrReviewThreadIfAvailable,
		renderPublicPrStatus,
		refreshPublicPrStatus,
		scheduleStartupPublicPrCheck,
		publicPrMergeInstruction,
		publicPrMergeConfirmationMessage,
		preparePublicPrMergePrompt,
		rememberPublicPrPrompt,
		maybePromptPublicPrMerge,
		handlePublicPrStatusClick,
		handleAppUpdateClick,
		renderSharedRestartButton,
		renderHardRefreshButton,
		markBootReady,
		reportShellLoaded,
		sharedRestartScopeLines,
		restartRiskThreads,
		fetchRestartRiskThreads,
		restartRiskThreadTitle,
		restartRiskThreadMeta,
		renderSharedRestartDialog,
		closeSharedRestartDialog,
		requestSharedRestartConfirmation,
		handleSharedRestartClick,
		serverBuildIdFromConfig,
		shouldPromptForServerBuildChange,
		clearSettledServerBuildPluginRefresh,
		pageShellAssetUrl,
		validatePageShellAsset,
		fetchPageShellAsset,
		preparePageShellAssets,
		fetchPageBuildConfig,
		pruneOldShellCaches,
		clearAllShellCaches,
		resetPageShellServiceWorker,
		pageReloadUrlWithBust,
		initializePageBuildState,
		renderPageRefreshPrompt,
		handleHardRefreshClick,
		showReconnectRefreshPrompt,
		finishRestartingUiIfReady,
		clearReconnectRefreshPrompt,
		checkPageRefreshAvailability,
		schedulePageRefreshCheck,
		scheduleVisiblePageRefreshCheck,
		startPageRefreshChecks,
		waitForPageBuildConfig,
		refreshPageForNewBuild
	});
}
var api = Object.freeze({ createAppUpdateRuntime });
//#endregion
//#region \0virtual:codex-mobile-esm-compatibility/shard/shard-03
var moduleDefinitions = [
	{
		"id": "thread-tile-state",
		"source": "public/thread-tile-state.js",
		"nativeSource": "frontend/native/thread-tile-state.mjs",
		"globalName": "CodexThreadTileState",
		"expectedFunctions": [
			"activePaneSyncPlan",
			"candidatePaneIdsPlan",
			"closePanePlan",
			"composerActionControlPlan",
			"composerDraftRuntimeSelectionPlan",
			"composerTargetPlaceholderPlan",
			"composerTargetPlan",
			"displaySettingsPayload",
			"displaySettingsLoadPlan",
			"dropPaneIntent",
			"effectiveSelectedThreadId",
			"idsEqual",
			"layoutCapacity",
			"normalizeDisplaySettings",
			"normalizeOperationMode",
			"normalizePaneCount",
			"normalizePinnedIds",
			"normalizeSplitPairs",
			"operationModeTogglePlan",
			"operationBubbleRecord",
			"operationBubbleSnapshot",
			"operationDockPlan",
			"operationMinimumRefreshPlan",
			"operationSignature",
			"paneBottomButtonPlan",
			"paneCountChangePlan",
			"paneCountStatePlan",
			"paneDisplayLayoutPlan",
			"panePatchCompletionPlan",
			"panePatchPreflightPlan",
			"paneRenderFramePlan",
			"paneRenderSignaturePlan",
			"paneSelectionPlan",
			"paneSlotMutationEffectsPlan",
			"paneScrollHoldPlan",
			"paneScrollMetrics",
			"paneScrollRestorePlan",
			"prependSplitPair",
			"detailLoadPlan",
			"detailLoadErrorEffectsPlan",
			"detailLoadFinallyEffectsPlan",
			"detailLoadConcurrencyPlan",
			"detailLoadQueueDrainPlan",
			"detailLoadQueuePlan",
			"detailLoadStartEffectsPlan",
			"detailLoadSuccessEffectsPlan",
			"refreshDelayMs",
			"refreshSchedulePlan",
			"refreshTargetIds",
			"replaceLastPaneForThreadListOpenPlan",
			"replacePaneThreadPlan",
			"removeSplitPairsForIds",
			"movePaneRelativePlan",
			"selectPanePlan",
			"selectedPaneEffectsPlan",
			"splitPaneWithTargetPlan",
			"switchMenuOptionsPlan",
			"switchMenuPlan",
			"syncPinnedIdsFromActiveIds",
			"threadTileVerticalChromePlan",
			"threadTileViewportBaselinePlan",
			"toggleOperationMode",
			"uniqueIds"
		],
		"assetPath": "/thread-tile-state.js",
		"importSource": "frontend/native/thread-tile-state.mjs",
		"compatibilityMode": "native-esm",
		"classicLoaderExcluded": true,
		"bytes": 83691
	},
	{
		"id": "thread-tile-runtime",
		"source": "public/thread-tile-runtime.js",
		"nativeSource": "frontend/native/thread-tile-runtime.mjs",
		"globalName": "CodexThreadTileRuntime",
		"expectedFunctions": ["createThreadTileRuntime"],
		"assetPath": "/thread-tile-runtime.js",
		"importSource": "frontend/native/thread-tile-runtime.mjs",
		"compatibilityMode": "native-esm",
		"classicLoaderExcluded": true,
		"bytes": 75347
	},
	{
		"id": "app-update-runtime",
		"source": "public/app-update-runtime.js",
		"nativeSource": "frontend/native/app-update-runtime.mjs",
		"globalName": "CodexAppUpdateRuntime",
		"expectedFunctions": ["createAppUpdateRuntime"],
		"assetPath": "/app-update-runtime.js",
		"importSource": "frontend/native/app-update-runtime.mjs",
		"compatibilityMode": "native-esm",
		"classicLoaderExcluded": true,
		"bytes": 57393
	}
];
var moduleApis = {
	"thread-tile-state": api$1,
	"thread-tile-runtime": threadTileRuntimeApi,
	"app-update-runtime": api
};
function functionReady(api, name) {
	return Boolean(api && typeof api[name] === "function");
}
function publishClassicGlobal(definition, api) {
	const globalName = String(definition && definition.globalName || "");
	if (!globalName || !api || typeof api !== "object" || typeof globalThis === "undefined") return false;
	globalThis[globalName] = api;
	return globalThis[globalName] === api;
}
function sampleModule(id, api) {
	if (id === "build-refresh-policy") {
		const classification = functionReady(api, "classifyServerBuildChange") ? api.classifyServerBuildChange("0.1.11|codex-mobile-shell-v626", "0.1.11|codex-mobile-shell-v625") : "";
		const prompt = functionReady(api, "shouldPromptForServerBuildChange") ? api.shouldPromptForServerBuildChange("0.1.11|codex-mobile-shell-v626", "0.1.11|codex-mobile-shell-v625") : false;
		return {
			ok: classification === "server-newer" && prompt === true,
			classification,
			prompt
		};
	}
	if (id === "runtime-settings") {
		const normalizedOptions = functionReady(api, "normalizeOptionList") ? api.normalizeOptionList([
			"",
			"gpt-5.5",
			" gpt-5.5 ",
			"gpt-5.4"
		]) : [];
		const modelLabel = functionReady(api, "labelForModel") ? api.labelForModel("gpt-5.3-codex-spark") : "";
		const compactModelLabel = functionReady(api, "compactLabelForModel") ? api.compactLabelForModel("gpt-5.3-codex-spark") : "";
		const effortLabel = functionReady(api, "labelForEffort") ? api.labelForEffort("xhigh") : "";
		const permissionLabel = functionReady(api, "labelForPermissionMode") ? api.labelForPermissionMode("full") : "";
		const permissionTitle = functionReady(api, "titleForPermissionMode") ? api.titleForPermissionMode("custom") : "";
		const permissionAlias = functionReady(api, "normalizePermissionModeValue") ? api.normalizePermissionModeValue("full-access") : "";
		const selectedModel = functionReady(api, "selectedNewThreadModel") ? api.selectedNewThreadModel({
			selected: "",
			defaultValue: "gpt-5.5",
			options: ["gpt-5.4"]
		}) : "";
		const selectedEffort = functionReady(api, "selectedNewThreadEffort") ? api.selectedNewThreadEffort({
			selected: " high ",
			defaultValue: "medium",
			options: ["low"]
		}) : "";
		const selectedPermission = functionReady(api, "selectedNewThreadPermission") ? api.selectedNewThreadPermission({
			selected: "workspace-write",
			defaultValue: "full",
			options: ["auto"]
		}) : "";
		return {
			ok: Array.isArray(normalizedOptions) && normalizedOptions.join(",") === "gpt-5.5,gpt-5.4" && modelLabel === "GPT-5.3 Codex Spark" && compactModelLabel === "5.3 Spark" && effortLabel === "XHigh" && permissionLabel === "完全访问权限" && permissionTitle === "自定义 (config.toml)" && permissionAlias === "full" && selectedModel === "gpt-5.5" && selectedEffort === "high" && selectedPermission === "auto",
			normalizedOptions,
			modelLabel,
			compactModelLabel,
			effortLabel,
			permissionLabel,
			permissionTitle,
			permissionAlias,
			selectedModel,
			selectedEffort,
			selectedPermission
		};
	}
	if (id === "viewport-metrics") {
		const editable = functionReady(api, "isKeyboardEditable") ? api.isKeyboardEditable({
			tagName: "INPUT",
			type: "text"
		}) : false;
		const checkboxEditable = functionReady(api, "isKeyboardEditable") ? api.isKeyboardEditable({
			tagName: "INPUT",
			type: "checkbox"
		}) : true;
		const measurement = functionReady(api, "measureViewport") ? api.measureViewport({
			visualHeight: 520,
			visualOffsetTop: 16,
			innerHeight: 1024,
			clientHeight: 1024,
			activeElement: { tagName: "TEXTAREA" }
		}) : {};
		const stableChanged = functionReady(api, "stablePixelChanged") ? api.stablePixelChanged(92, 94) : false;
		const stableNoise = functionReady(api, "stablePixelChanged") ? api.stablePixelChanged(92, 93) : true;
		const cssPixel = functionReady(api, "cssPixel") ? api.cssPixel(92.6) : 0;
		return {
			ok: editable === true && checkboxEditable === false && measurement.keyboardShrunk === true && measurement.height === 520 && measurement.top === 16 && stableChanged === true && stableNoise === false && cssPixel === 93,
			editable,
			checkboxEditable,
			keyboardShrunk: Boolean(measurement.keyboardShrunk),
			height: Number(measurement.height) || 0,
			top: Number(measurement.top) || 0,
			stableChanged,
			stableNoise,
			cssPixel
		};
	}
	if (id === "conversation-scroll") {
		const nearBottom = functionReady(api, "isNearBottom") ? api.isNearBottom({
			scrollHeight: 1800,
			scrollTop: 725,
			clientHeight: 980
		}) : false;
		const notNearBottom = functionReady(api, "isNearBottom") ? api.isNearBottom({
			scrollHeight: 1800,
			scrollTop: 640,
			clientHeight: 980
		}) : true;
		const submittedFollow = functionReady(api, "createSubmittedMessageFollow") ? api.createSubmittedMessageFollow("thread-a", {
			clientSubmissionId: "submit-1",
			nowMs: 1e3,
			ttlMs: 5e3
		}) : null;
		const submittedActive = functionReady(api, "shouldFollowSubmittedMessage") ? api.shouldFollowSubmittedMessage(submittedFollow, {
			threadId: "thread-a",
			nowMs: 5999
		}) : false;
		const submittedWrongThread = functionReady(api, "shouldFollowSubmittedMessage") ? api.shouldFollowSubmittedMessage(submittedFollow, {
			threadId: "thread-b",
			nowMs: 2e3
		}) : true;
		const viewportFollow = functionReady(api, "createViewportFollow") ? api.createViewportFollow("thread-a", {
			reason: "orientation",
			nowMs: 1e3,
			ttlMs: 3e3
		}) : null;
		const viewportActive = functionReady(api, "shouldFollowViewport") ? api.shouldFollowViewport(viewportFollow, {
			threadId: "thread-a",
			nowMs: 3999
		}) : false;
		const lease = functionReady(api, "planBottomFollowLeaseEvaluation") ? api.planBottomFollowLeaseEvaluation({
			leaseActive: true,
			hasLease: true
		}) : {};
		const schedule = functionReady(api, "planBottomFollowScrollSchedule") ? api.planBottomFollowScrollSchedule() : {};
		const refresh = functionReady(api, "planAutomaticConversationRefresh") ? api.planAutomaticConversationRefresh({
			hasThread: true,
			nearBottom: false,
			userReadingCurrentTurn: true
		}) : {};
		const fullRender = functionReady(api, "planFullRenderScroll") ? api.planFullRenderScroll({ submittedMessageFollow: true }) : {};
		return {
			ok: nearBottom === true && notNearBottom === false && submittedFollow && submittedFollow.untilMs === 6e3 && submittedActive === true && submittedWrongThread === false && viewportFollow && viewportFollow.untilMs === 4e3 && viewportActive === true && lease.reason === "lease-active" && Array.isArray(schedule.delaysMs) && schedule.delaysMs.join(",") === "0,80,240,600,1200" && refresh.allowRefresh === false && refresh.reason === "user-reading-current-turn" && fullRender.stickToBottom === true && fullRender.reason === "submitted-message-follow",
			nearBottom,
			submittedActive,
			viewportActive,
			leaseReason: String(lease.reason || ""),
			scheduleDelays: Array.isArray(schedule.delaysMs) ? schedule.delaysMs : [],
			refreshReason: String(refresh.reason || ""),
			fullRenderReason: String(fullRender.reason || "")
		};
	}
	if (id === "thread-performance-metrics") {
		const listPhase = functionReady(api, "classifyThreadListPhase") ? api.classifyThreadListPhase({
			fallbackCacheDecision: "expired-rebuild",
			fallbackMs: 25
		}) : "";
		const detailPhase = functionReady(api, "classifyThreadDetailPhase") ? api.classifyThreadDetailPhase({
			readDecision: "projection-hit",
			projectionSource: "dynamic"
		}) : "";
		const clientTimings = functionReady(api, "threadDetailClientTimings") ? api.threadDetailClientTimings({
			elapsedMs: 26.4,
			renderElapsedMs: 7.2,
			detailRenderMode: "patch"
		}) : {};
		const detailFields = functionReady(api, "threadDetailEventFields") ? api.threadDetailEventFields({
			mobileDiagnostics: { threadDetailTimings: {
				phase: "warm-projection-cache",
				totalMs: 8
			} },
			turns: [{
				status: "completed",
				items: [{
					type: "userMessage",
					text: "prompt"
				}]
			}]
		}) : {};
		const shape = functionReady(api, "threadDetailShape") ? api.threadDetailShape({
			mobileOmittedTurnCount: 2,
			turns: [{
				status: "completed",
				items: [{
					type: "userMessage",
					text: "prompt"
				}]
			}, {
				status: "running",
				items: [{
					type: "agentMessage",
					text: "reply"
				}]
			}]
		}) : {};
		const slow = functionReady(api, "planThreadDetailSlowPathDiagnostic") ? api.planThreadDetailSlowPathDiagnostic({
			elapsedMs: 1600,
			apiElapsedMs: 1550,
			renderElapsedMs: 20,
			performancePhase: "cold-turns-list-initial"
		}, {
			action: "thread-detail-load",
			threadHash: "thread_hash",
			durationBucket: "1_3s"
		}) : {};
		return {
			ok: listPhase === "cold-fallback-expired-rebuild" && detailPhase === "warm-projection-dynamic" && clientTimings.elapsedMs === 26 && clientTimings.renderElapsedMs === 7 && clientTimings.detailRenderMode === "patch" && detailFields.performancePhase === "warm-projection-cache" && shape.turns === 2 && shape.visibleItems === 2 && shape.omittedTurns === 2 && shape.completedTurns === 1 && shape.activeTurns === 1 && slow.shouldReport === true && slow.reason === "api-slow",
			listPhase,
			detailPhase,
			elapsedMs: Number(clientTimings.elapsedMs) || 0,
			detailPerformancePhase: String(detailFields.performancePhase || ""),
			visibleItems: Number(shape.visibleItems) || 0,
			slowReason: String(slow.reason || "")
		};
	}
	if (id === "thread-detail-state") {
		const loadedThread = {
			id: "thread-a",
			title: "Thread A",
			status: "completed",
			mobileDetailLoaded: true,
			mobileLoading: false,
			turns: [{
				id: "turn-a",
				status: "completed",
				items: [{
					type: "userMessage",
					text: "hello"
				}]
			}],
			mobileProjection: { source: "sample" }
		};
		const summary = functionReady(api, "threadListSummaryFromDetailThread") ? api.threadListSummaryFromDetailThread(loadedThread) : {};
		const loaded = functionReady(api, "threadHasLoadedDetailState") ? api.threadHasLoadedDetailState(loadedThread) : false;
		const reusable = functionReady(api, "threadHasReusableLoadedDetailState") ? api.threadHasReusableLoadedDetailState(loadedThread) : false;
		const visualBaseline = functionReady(api, "threadHasVisualBaselineLoadedDetailState") ? api.threadHasVisualBaselineLoadedDetailState(Object.assign({}, loadedThread, { status: "active" })) : false;
		const cacheReuse = functionReady(api, "planThreadOpenCacheReuse") ? api.planThreadOpenCacheReuse({
			currentThread: loadedThread,
			threadId: "thread-a"
		}) : {};
		return {
			ok: summary && summary.id === "thread-a" && !Object.prototype.hasOwnProperty.call(summary, "turns") && !Object.prototype.hasOwnProperty.call(summary, "mobileProjection") && loaded === true && reusable === true && visualBaseline === true && cacheReuse && typeof cacheReuse === "object",
			summaryId: String(summary && summary.id || ""),
			summaryHasTurns: Object.prototype.hasOwnProperty.call(summary || {}, "turns"),
			loaded,
			reusable,
			visualBaseline,
			cacheReuseReason: String(cacheReuse.reason || "")
		};
	}
	if (id === "thread-detail-render-plan") {
		const backfill = functionReady(api, "planThreadDetailHistoryAutoBackfill") ? api.planThreadDetailHistoryAutoBackfill({
			hasOlder: true,
			thread: {
				mobileOlderTurnsCursor: "cursor-a",
				turns: [{ items: [{
					type: "assistantMessage",
					text: "[Cross-thread task card sent by source thread]"
				}] }]
			}
		}) : {};
		const request = functionReady(api, "planThreadDetailRefreshRequest") ? api.planThreadDetailRefreshRequest({
			threadId: "thread-a",
			threadLoadSeq: 7,
			options: { source: "auto-refresh" }
		}) : {};
		const postUpdate = functionReady(api, "planSingleThreadShellPostUpdateEffects") ? api.planSingleThreadShellPostUpdateEffects({
			bindCurrentThreadActions: true,
			updateTickTimer: true,
			publishPluginNavigationState: true,
			reason: "sample"
		}) : {};
		const normalizedSignature = functionReady(api, "normalizeSignature") ? api.normalizeSignature(42) : "";
		const effects = Array.isArray(postUpdate.effects) ? postUpdate.effects : [];
		return {
			ok: normalizedSignature === "42" && backfill.shouldLoad === true && backfill.reason === "sparse-conversation-context" && request.shouldRefresh === true && request.threadId === "thread-a" && request.requestedMode === "recent" && request.query && request.query.mode === "recent" && effects.map((entry) => String(entry && entry.type || "")).join(",") === "bind-current-thread-actions,update-tick-timer,publish-plugin-navigation-state",
			normalizedSignature,
			backfillReason: String(backfill.reason || ""),
			refreshReason: String(request.reason || ""),
			effectTypes: effects.map((entry) => String(entry && entry.type || ""))
		};
	}
	if (id === "thread-detail-dom-patch") {
		const patch = functionReady(api, "threadDetailPatchResult") ? api.threadDetailPatchResult(true, "patched", { patched: 2 }) : {};
		const mismatch = functionReady(api, "visibleTurnOrderMismatch") ? api.visibleTurnOrderMismatch({
			expectedTurnIds: ["a", "b"],
			renderedDomTurnIds: ["a", "c"]
		}) : false;
		const match = functionReady(api, "visibleTurnOrderMismatch") ? api.visibleTurnOrderMismatch({
			expectedTurnIds: ["a", "b"],
			renderedDomTurnIds: ["a", "b"]
		}) : true;
		const operation = functionReady(api, "normalizeOperation") ? api.normalizeOperation({
			type: "insert",
			key: "turn-a",
			nextEntry: {
				key: "turn-a",
				html: "<article></article>"
			}
		}) : null;
		const htmlUpdate = functionReady(api, "planConversationHtmlUpdate") ? api.planConversationHtmlUpdate({
			html: "<article data-turn-id=\"a\"></article>",
			previousHtml: "<article data-turn-id=\"a\"></article>",
			conversationSignature: "sig-a",
			previousConversationSignature: "sig-a"
		}) : {};
		return {
			ok: patch.ok === true && patch.reason === "patched" && patch.patched === 2 && mismatch === true && match === false && operation && operation.key === "turn-a" && htmlUpdate.action === "hydrate-existing" && htmlUpdate.reason === "signature-stable",
			patchReason: String(patch.reason || ""),
			patched: Number(patch.patched) || 0,
			mismatch,
			match,
			operationKey: String(operation && operation.key || ""),
			htmlAction: String(htmlUpdate.action || "")
		};
	}
	if (id === "draft-store") {
		const memory = /* @__PURE__ */ new Map();
		const store = functionReady(api, "createDraftStore") ? api.createDraftStore({
			storage: {
				getItem(key) {
					return memory.has(key) ? memory.get(key) : null;
				},
				setItem(key, value) {
					memory.set(key, String(value));
				},
				removeItem(key) {
					memory.delete(key);
				}
			},
			maxDrafts: 2
		}) : null;
		if (store && typeof store.writeMap === "function") {
			store.writeMap({
				old: {
					text: "old",
					updatedAt: 1
				},
				newest: {
					text: "newest",
					updatedAt: 3
				},
				middle: {
					text: "middle",
					updatedAt: 2
				}
			});
			store.setTargetKey("new:/repo");
		}
		const draftKeys = store && typeof store.readMap === "function" ? Object.keys(store.readMap()) : [];
		const threadKey = store && typeof store.keyForThread === "function" ? store.keyForThread(" abc ") : "";
		const newThreadKey = store && typeof store.keyForNewThread === "function" ? store.keyForNewThread("C:/Users/xuefu/project/") : "";
		const targetKey = store && typeof store.getTargetKey === "function" ? store.getTargetKey() : "";
		const parsed = functionReady(api, "parseDraftMap") ? api.parseDraftMap("{\"a\":{\"text\":\"draft\"}}") : {};
		const hasContent = functionReady(api, "draftHasContent") ? api.draftHasContent({ permissionMode: "full" }) : false;
		const meta = functionReady(api, "normalizeAttachmentMeta") ? api.normalizeAttachmentMeta({
			id: 7,
			file: {
				name: "screenshot.png",
				type: "image/png",
				size: 42,
				lastModified: 123
			}
		}) : null;
		const attachmentKey = functionReady(api, "attachmentStorageKey") ? api.attachmentStorageKey("new:/a b", "x/y") : "";
		const normalizedPath = functionReady(api, "defaultNormalizeFsPath") ? api.defaultNormalizeFsPath("C:/Users/xuefu/project/") : "";
		return {
			ok: threadKey === "thread:abc" && newThreadKey === "new:c:\\users\\xuefu\\project" && targetKey === "new:/repo" && draftKeys.join(",") === "newest,middle" && parsed && parsed.a && parsed.a.text === "draft" && hasContent === true && meta && meta.id === "7" && meta.size === 42 && attachmentKey === "new%3A%2Fa%20b|x%2Fy" && normalizedPath === "c:\\users\\xuefu\\project",
			threadKey,
			newThreadKey,
			targetKey,
			draftKeys,
			hasContent,
			attachmentKey,
			normalizedPath
		};
	}
	if (id === "image-compressor") {
		const compressible = functionReady(api, "isCompressibleImageFile") ? api.isCompressibleImageFile({
			type: "image/png",
			size: 300 * 1024
		}) : false;
		const smallImage = functionReady(api, "isCompressibleImageFile") ? api.isCompressibleImageFile({
			type: "image/png",
			size: 12 * 1024
		}) : true;
		const dims = functionReady(api, "targetDimensions") ? api.targetDimensions(3e3, 1500, 1200) : {};
		const name = functionReady(api, "compressedImageName") ? api.compressedImageName("folder/screen.png", "image/webp") : "";
		const useful = functionReady(api, "shouldUseCompressedBlob") ? api.shouldUseCompressedBlob({ size: 1e3 }, { size: 800 }) : false;
		const marginal = functionReady(api, "shouldUseCompressedBlob") ? api.shouldUseCompressedBlob({ size: 1e3 }, { size: 930 }) : true;
		return {
			ok: compressible === true && smallImage === false && dims.width === 1200 && dims.height === 600 && dims.scaled === true && name === "folder_screen.webp" && useful === true && marginal === false,
			compressible,
			smallImage,
			width: Number(dims.width) || 0,
			height: Number(dims.height) || 0,
			scaled: Boolean(dims.scaled),
			name,
			useful,
			marginal
		};
	}
	if (id === "plugin-voice-input") {
		const capability = functionReady(api, "capabilityStateMessage") ? api.capabilityStateMessage({
			writable: true,
			threadId: "thread-a",
			draftId: "draft-a",
			actions: [
				"append",
				"replace",
				"submit"
			],
			maxChars: 100
		}) : {};
		const start = functionReady(api, "startRequestMessage") ? api.startRequestMessage({
			requestId: "req-1",
			voiceSessionId: "voice-1",
			capability
		}) : {};
		const insert = functionReady(api, "insertResultMessage") ? api.insertResultMessage({
			ok: false,
			action: "append_text",
			code: "composer_not_writable",
			composerId: "thread-composer"
		}) : {};
		const error = functionReady(api, "errorMessage") ? api.errorMessage({
			code: "voice_error",
			error: "Voice failed"
		}) : {};
		const action = functionReady(api, "normalizeAction") ? api.normalizeAction("append") : "";
		const actionFromType = functionReady(api, "actionFromMessageType") ? api.actionFromMessageType("voice_input.replace_draft") : "";
		const text = functionReady(api, "textFromMessage") ? api.textFromMessage({ text: "  hello\xA0world  " }, 20) : "";
		const voiceMessage = functionReady(api, "isVoiceInputMessage") ? api.isVoiceInputMessage({ type: "voice_input.append_text" }) : false;
		return {
			ok: capability.type === "voice_input.capability_state" && capability.writable === true && Array.isArray(capability.actions) && capability.actions.join(",") === "append_text,replace_draft" && start.type === "voice_input.start_request" && start.requestId === "req-1" && insert.ok === false && insert.code === "composer_not_writable" && error.code === "voice_error" && action === "append_text" && actionFromType === "replace_draft" && text === "hello world" && voiceMessage === true,
			capabilityType: String(capability.type || ""),
			actions: Array.isArray(capability.actions) ? capability.actions : [],
			startType: String(start.type || ""),
			insertCode: String(insert.code || ""),
			errorCode: String(error.code || ""),
			action,
			actionFromType,
			text,
			voiceMessage
		};
	}
	if (id === "api-client") {
		function FakeFormData() {}
		const formData = new FakeFormData();
		const isFormData = functionReady(api, "isFormDataBody") ? api.isFormDataBody(formData, FakeFormData) : false;
		const jsonBody = functionReady(api, "isFormDataBody") ? api.isFormDataBody({ ok: true }, FakeFormData) : true;
		const client = functionReady(api, "createApiClient") ? api.createApiClient({
			fetch: () => Promise.resolve({
				ok: true,
				status: 204
			}),
			AbortControllerCtor: AbortController,
			FormDataCtor: FakeFormData,
			getKey: () => ""
		}) : null;
		return {
			ok: isFormData === true && jsonBody === false && client && typeof client.request === "function",
			isFormData,
			jsonBody,
			requestReady: Boolean(client && typeof client.request === "function")
		};
	}
	if (id === "markdown-renderer") {
		const escaped = functionReady(api, "escapeHtml") ? api.escapeHtml("<tag>&\"") : "";
		const safeUrl = functionReady(api, "safeMarkdownUrl") ? api.safeMarkdownUrl("https://example.com") : "";
		const unsafeUrl = functionReady(api, "safeMarkdownUrl") ? api.safeMarkdownUrl("javascript:alert(1)") : "unsafe";
		const inline = functionReady(api, "renderInlineMarkdown") ? api.renderInlineMarkdown("**bold** <https://example.com>, `code`") : "";
		const block = functionReady(api, "renderMarkdown") ? api.renderMarkdown("# Title\n\n- item\n- **bold**") : "";
		const tableSeparator = functionReady(api, "isMarkdownTableSeparator") ? api.isMarkdownTableSeparator("|---|:---:|") : false;
		const row = functionReady(api, "splitMarkdownTableRow") ? api.splitMarkdownTableRow("| A | B |") : [];
		const list = functionReady(api, "renderMarkdownList") ? api.renderMarkdownList(["1. one", "2. two"], true) : "";
		const table = functionReady(api, "renderMarkdownTable") ? api.renderMarkdownTable([
			"A | B",
			"---|---",
			"1 | 2"
		]) : "";
		return {
			ok: escaped === "&lt;tag&gt;&amp;&quot;" && safeUrl === "https://example.com" && unsafeUrl === "" && inline.includes("<strong>bold</strong>") && inline.includes("<code>code</code>") && block.includes("<h2>Title</h2>") && tableSeparator === true && Array.isArray(row) && row.join(",") === "A,B" && list.includes("<ol>") && table.includes("<table>"),
			escaped,
			safeUrl,
			unsafeUrl,
			row,
			inlineHasStrong: inline.includes("<strong>bold</strong>"),
			blockHasHeading: block.includes("<h2>Title</h2>"),
			listHasOl: list.includes("<ol>"),
			tableHasTable: table.includes("<table>")
		};
	}
	if (id === "plugin-embed") {
		const detected = functionReady(api, "detect") ? api.detect("http://127.0.0.1/?embed=hermes&pluginId=codex-mobile&pluginRoute=thread&pluginThreadId=t1&pluginTheme=dark&pluginFontSize=large") : {};
		const navigation = functionReady(api, "navigationMessage") ? api.navigationMessage({ currentThreadId: "t1" }, {}) : {};
		const openPlan = functionReady(api, "routeHintOpenPlan") ? api.routeHintOpenPlan({
			pluginId: "codex-mobile",
			threadId: "t1",
			itemId: "i1"
		}) : {};
		const selectors = functionReady(api, "routeHintTargetSelectors") ? api.routeHintTargetSelectors({ itemId: "i1" }) : [];
		const scrubbed = functionReady(api, "scrubRouteHintPath") ? api.scrubRouteHintPath("http://127.0.0.1/thread?pluginId=codex-mobile&pluginThreadId=t1", {
			workspaceId: "ws1",
			appearance: { theme: "dark" }
		}) : "";
		const external = functionReady(api, "externalLinkMessage") ? api.externalLinkMessage({ href: "https://example.com/a" }) : {};
		const refresh = functionReady(api, "refreshRequiredMessage") ? api.refreshRequiredMessage({
			reason: "version_changed",
			route: {
				kind: "thread",
				threadId: "t1"
			},
			appearance: { theme: "light" }
		}) : {};
		return {
			ok: detected.embedded === true && detected.routeHint && detected.routeHint.threadId === "t1" && detected.appearance && detected.appearance.theme === "dark" && navigation.type === "codex-mobile.plugin.navigation" && navigation.canGoBack === true && openPlan.action === "openThread" && Array.isArray(selectors) && selectors[0] === "[data-approval-card=\"i1\"]" && scrubbed === "/thread?embed=hermes&workspaceId=ws1&pluginTheme=dark" && external.type === "codex-mobile.plugin.external_link" && refresh.type === "codex-mobile.plugin.refresh_required",
			embedded: Boolean(detected.embedded),
			routeThreadId: String(detected.routeHint && detected.routeHint.threadId || ""),
			navigationType: String(navigation.type || ""),
			canGoBack: Boolean(navigation.canGoBack),
			openAction: String(openPlan.action || ""),
			firstSelector: String(selectors[0] || ""),
			scrubbed,
			externalType: String(external.type || ""),
			refreshType: String(refresh.type || "")
		};
	}
	if (id === "frontend-runtime-health") {
		const token = functionReady(api, "compactToken") ? api.compactToken(" Home AI / Thread Detail ", "fallback", 20) : "";
		const missingEffects = functionReady(api, "submittedMessageDomProbeEffects") ? api.submittedMessageDomProbeEffects({
			elapsedMs: 300,
			currentThreadMatch: true,
			hasThreadSubmission: true,
			domHasSubmission: false,
			threadHash: "abc"
		}) : {};
		const stallEffects = functionReady(api, "threadListInteractionStallEffects") ? api.threadListInteractionStallEffects({
			threadListVisible: true,
			threadListMonitorable: true,
			maxRafDelayMs: 640,
			minDelayMs: 500
		}) : {};
		const monitor = functionReady(api, "createMonitor") ? api.createMonitor({ now: () => 1e3 }) : null;
		const monitorResult = monitor && typeof monitor.recordRender === "function" ? monitor.recordRender({
			fullRender: false,
			fallbackApplied: false,
			previousCount: 2,
			domCount: 2,
			visibleCount: 2,
			duplicateCount: 0
		}) : {};
		const dropEvent = functionReady(api, "domDropEvent") ? api.domDropEvent({
			previousCount: 3,
			domCount: 1,
			visibleCount: 3
		}) : {};
		const success = functionReady(api, "runtimeSuccess") ? api.runtimeSuccess({
			diagnosticType: "render_dom_drop",
			errorCode: "render_dom_drop"
		}) : {};
		return {
			ok: token === "Home_AI_Thread_Detai" && missingEffects.reason === "submitted-message-dom-missing" && Array.isArray(missingEffects.effects) && missingEffects.effects[0] && missingEffects.effects[0].type === "diagnostic-failure" && stallEffects.reason === "thread-list-interaction-stall" && monitorResult.renderCount === 1 && Array.isArray(monitorResult.effects) && monitorResult.effects.length === 2 && dropEvent.diagnostic_type === "render_dom_drop" && success.error_code === "render_dom_drop",
			token,
			missingReason: String(missingEffects.reason || ""),
			stallReason: String(stallEffects.reason || ""),
			monitorRenderCount: Number(monitorResult.renderCount) || 0,
			dropDiagnosticType: String(dropEvent.diagnostic_type || ""),
			successErrorCode: String(success.error_code || "")
		};
	}
	if (id === "home-ai-diagnostic-reporting") {
		const token = functionReady(api, "boundedToken") ? api.boundedToken(" Home AI / Codex Mobile ", "fallback", 16) : "";
		const duration = functionReady(api, "durationBucket") ? api.durationBucket(4200) : "";
		const hash = functionReady(api, "hashIdentifier") ? api.hashIdentifier("thread-title", "t") : "";
		const sanitized = functionReady(api, "sanitizeInput") ? api.sanitizeInput({
			diagnostic_type: "render_lag",
			error_code: "lag",
			counts: {
				ok_count: 3,
				raw_body: 4
			},
			context: {
				thread_hash: "abc",
				title: "unsafe"
			}
		}) : {};
		const reporter = functionReady(api, "createDiagnosticReporter") ? api.createDiagnosticReporter({
			threshold: 2,
			throttleMs: 0,
			now: () => 1e3
		}) : null;
		const first = reporter && typeof reporter.recordFailure === "function" ? reporter.recordFailure({
			diagnostic_type: "render_lag",
			error_code: "lag"
		}) : {};
		const second = reporter && typeof reporter.recordFailure === "function" ? reporter.recordFailure({
			diagnostic_type: "render_lag",
			error_code: "lag"
		}) : {};
		const post = functionReady(api, "postReportToHomeAi") ? api.postReportToHomeAi({
			embedded: false,
			report: second.report
		}) : {};
		const textHash = functionReady(api, "stableTextHash") ? api.stableTextHash("diagnostic") : "";
		return {
			ok: token === "Home_AI_Codex_Mo" && duration === "3_10s" && /^t_/.test(hash) && sanitized.category === "codex_runtime_failure" && sanitized.counts && sanitized.counts.ok_count === 3 && !Object.prototype.hasOwnProperty.call(sanitized.counts || {}, "raw_body") && first.eligible === false && second.eligible === true && post.reason === "not_embedded" && textHash.length > 0,
			token,
			duration,
			hashPrefix: String(hash || "").slice(0, 2),
			sanitizedCategory: String(sanitized.category || ""),
			secondEligible: Boolean(second.eligible),
			postReason: String(post.reason || ""),
			textHash
		};
	}
	if (id === "thread-diagnostic-events") {
		const snapshot = functionReady(api, "conversationProjectionDiagnosticSnapshot") ? api.conversationProjectionDiagnosticSnapshot({
			renderedConversationSignature: "old",
			currentSignature: "new",
			domShape: {
				renderKeyCount: 1,
				duplicateRenderKeyCount: 1
			},
			thread: { mobileReadMode: "thread-read" }
		}, { visibleShape: () => ({
			visibleTurnCount: 2,
			visibleItemCount: 3
		}) }) : {};
		const order = functionReady(api, "turnOrderDiagnosticSnapshot") ? api.turnOrderDiagnosticSnapshot({
			expectedTurnIds: ["a", "b"],
			domTurnIds: ["a"],
			threadHash: "thread"
		}) : {};
		const effects = functionReady(api, "conversationProjectionConsistencyEffects") ? api.conversationProjectionConsistencyEffects({
			snapshot,
			orderSnapshot: order
		}) : {};
		const renderEvent = functionReady(api, "renderSignatureMismatchDiagnosticEvent") ? api.renderSignatureMismatchDiagnosticEvent(snapshot) : {};
		const responseEffects = functionReady(api, "threadDetailResponseDiagnosticEffects") ? api.threadDetailResponseDiagnosticEffects({ contractPlan: {
			shouldReport: true,
			reason: "contract",
			turns: 2,
			items: 3,
			visibleItems: 3,
			readMode: "thread-read"
		} }) : {};
		const normalized = functionReady(api, "projectionDiagnosticSnapshot") ? api.projectionDiagnosticSnapshot(snapshot) : {};
		const count = functionReady(api, "boundedCount") ? api.boundedCount(100001) : 0;
		const token = functionReady(api, "compactToken") ? api.compactToken(" Detail / Render ", "fallback", 20) : "";
		return {
			ok: snapshot.renderedSignature === "old" && normalized.counts && normalized.counts.visible_count === 3 && order.counts && order.counts.latest_mismatch_count === 1 && Array.isArray(effects.effects) && effects.effects.length === 3 && renderEvent.diagnostic_type === "render_signature_mismatch" && Array.isArray(responseEffects.effects) && responseEffects.effects[0] && responseEffects.effects[0].type === "diagnostic-failure" && count === 1e5 && token === "Detail_Render",
			renderedSignature: String(snapshot.renderedSignature || ""),
			visibleCount: Number(normalized.counts && normalized.counts.visible_count) || 0,
			latestMismatch: Number(order.counts && order.counts.latest_mismatch_count) || 0,
			effectCount: Array.isArray(effects.effects) ? effects.effects.length : 0,
			renderDiagnosticType: String(renderEvent.diagnostic_type || ""),
			responseEffectCount: Array.isArray(responseEffects.effects) ? responseEffects.effects.length : 0,
			count,
			token
		};
	}
	if (id === "thread-tile-layout") {
		const layout = functionReady(api, "layoutForViewport") ? api.layoutForViewport({
			enabled: true,
			viewportWidth: 1500,
			viewportHeight: 900,
			sidebarWidth: 0,
			coarsePointer: true,
			orientation: "landscape",
			menuOverlay: true
		}) : null;
		const ids = functionReady(api, "selectThreadTileIds") ? api.selectThreadTileIds({
			currentThreadId: "thread-2",
			pinnedThreadIds: ["thread-3", "thread-2"],
			threadIds: [
				"thread-1",
				"thread-3",
				"thread-4"
			],
			maxPanes: 3
		}) : [];
		const pinnedIds = functionReady(api, "selectPinnedThreadTileIds") ? api.selectPinnedThreadTileIds({
			currentThreadId: "thread-current",
			pinnedThreadIds: [
				"thread-1",
				"thread-2",
				"thread-3"
			],
			threadIds: ["thread-current", "thread-4"],
			maxPanes: 3
		}) : [];
		const pairs = functionReady(api, "normalizeSplitPairs") ? api.normalizeSplitPairs([{
			anchorId: "b",
			childId: "e"
		}, {
			anchorId: "b",
			childId: "c"
		}], [
			"a",
			"b",
			"c",
			"d",
			"e"
		]) : [];
		const groups = functionReady(api, "threadTileColumnGroups") ? api.threadTileColumnGroups({
			ids: [
				"a",
				"b",
				"c",
				"d",
				"e"
			],
			columns: 4,
			splitPairs: [{
				anchorId: "b",
				childId: "e"
			}]
		}) : [];
		return {
			ok: !!layout && layout.enabled === true && layout.columns === 4 && ids.join(",") === "thread-2,thread-3,thread-1" && pinnedIds.join(",") === "thread-1,thread-2,thread-current" && pairs.length === 1 && pairs[0].anchorId === "b" && pairs[0].childId === "e" && JSON.stringify(groups) === JSON.stringify([
				["a"],
				["b", "e"],
				["c"],
				["d"]
			]),
			layout,
			ids,
			pinnedIds,
			pairs,
			groups
		};
	}
	if (id === "thread-tile-actions") {
		const paneA = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-pane" ? "thread-a" : "";
			},
			closest() {
				return null;
			}
		};
		const paneB = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-pane" ? "thread-b" : "";
			},
			closest() {
				return null;
			}
		};
		const title = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-title" ? "thread-a" : "";
			},
			closest(selector) {
				return selector === "[data-thread-tile-pane]" ? paneA : null;
			}
		};
		const handle = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-drag-handle" ? "thread-a" : "";
			},
			closest(selector) {
				return selector === "[data-thread-tile-pane]" ? paneA : null;
			}
		};
		const bottom = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-bottom" ? "thread-a" : "";
			},
			closest() {
				return null;
			}
		};
		const root = { contains(node) {
			return node === paneA || node === paneB || node === title || node === handle || node === bottom;
		} };
		const titleTarget = { closest(selector) {
			return selector === "[data-thread-tile-title]" ? title : selector === "[data-thread-tile-pane]" ? paneA : null;
		} };
		const bottomTarget = { closest(selector) {
			return selector === "[data-thread-tile-bottom]" ? bottom : null;
		} };
		const handleTarget = { closest(selector) {
			return selector === "[data-thread-tile-drag-handle]" ? handle : null;
		} };
		const paneBTarget = { closest(selector) {
			return selector === "[data-thread-tile-pane]" ? paneB : null;
		} };
		const pointer = functionReady(api, "resolveThreadTilePointerAction") ? api.resolveThreadTilePointerAction({
			root,
			target: titleTarget
		}) : {};
		const click = functionReady(api, "resolveThreadTileClickAction") ? api.resolveThreadTileClickAction({
			root,
			target: bottomTarget
		}) : {};
		const dragStart = functionReady(api, "resolveThreadTileDragStartAction") ? api.resolveThreadTileDragStartAction({
			root,
			target: handleTarget
		}) : {};
		const drop = functionReady(api, "resolveThreadTileDropAction") ? api.resolveThreadTileDropAction({
			root,
			target: paneBTarget,
			draggingId: "thread-a"
		}) : {};
		return {
			ok: pointer.action === "select-pane" && pointer.paneId === "thread-a" && click.action === "scroll-pane-bottom" && click.preventDefault === true && dragStart.action === "drag-start" && dragStart.paneId === "thread-a" && drop.action === "drop-pane" && drop.draggingId === "thread-a" && drop.targetId === "thread-b",
			pointerAction: String(pointer.action || ""),
			clickAction: String(click.action || ""),
			dragStartAction: String(dragStart.action || ""),
			dropAction: String(drop.action || "")
		};
	}
	if (id === "thread-tile-state") {
		const candidate = functionReady(api, "candidatePaneIdsPlan") ? api.candidatePaneIdsPlan({
			defaultIds: ["thread-a", "thread-b"],
			visibleIds: ["thread-a", "thread-b"],
			pinnedIds: ["thread-b"],
			currentThreadId: "thread-a",
			maxPanes: 2
		}) : {};
		const paneCount = functionReady(api, "normalizePaneCount") ? api.normalizePaneCount("3", { maxPanes: 12 }) : 0;
		const refreshDelay = functionReady(api, "refreshDelayMs") ? api.refreshDelayMs({
			visible: true,
			active: true
		}) : 0;
		const loadSuccess = functionReady(api, "detailLoadSuccessEffectsPlan") ? api.detailLoadSuccessEffectsPlan({
			threadId: "thread-a",
			hasThread: true,
			nowMs: 1234
		}) : {};
		const selected = functionReady(api, "effectiveSelectedThreadId") ? api.effectiveSelectedThreadId({
			ids: ["thread-a", "thread-b"],
			selectedThreadId: "thread-a",
			currentThreadId: "thread-b"
		}) : "";
		return {
			ok: candidate.action === "candidate-pane-ids" && candidate.ids && candidate.ids.join(",") === "thread-b,thread-a" && paneCount === 3 && refreshDelay === 500 && loadSuccess.reason === "thread-loaded" && loadSuccess.loadedAtMs === 1234 && selected === "thread-a",
			candidateIds: Array.isArray(candidate.ids) ? candidate.ids : [],
			paneCount,
			refreshDelay,
			loadSuccessReason: String(loadSuccess.reason || ""),
			selected
		};
	}
	if (id === "thread-tile-runtime") {
		const statePolicy = globalThis.CodexThreadTileState || {};
		const layoutPolicy = globalThis.CodexThreadTileLayout || {};
		const actionsApi = globalThis.CodexThreadTileActions || {};
		const runtime = functionReady(api, "createThreadTileRuntime") ? api.createThreadTileRuntime({
			state: {
				threadTileMode: true,
				threadTilePaneCount: "3",
				threadTilePinnedThreadIds: [
					"thread-b",
					"thread-a",
					"thread-b"
				],
				threadTileSplitPairs: [{
					anchorId: "thread-a",
					childId: "thread-c"
				}],
				threads: [
					{
						id: "thread-a",
						status: "running"
					},
					{
						id: "thread-b",
						status: "idle"
					},
					{
						id: "thread-c",
						status: "idle"
					}
				],
				currentThreadId: "thread-b",
				threadDisplaySettingsLoaded: true,
				threadTileViewportBaseline: null,
				threadTileComposerHeightBaselinePx: 0,
				composerHeightPx: 0
			},
			document: {
				documentElement: {
					clientWidth: 1400,
					clientHeight: 900
				},
				activeElement: null
			},
			window: {
				innerWidth: 1400,
				innerHeight: 900,
				visualViewport: {
					width: 1320,
					height: 820
				},
				matchMedia: () => ({ matches: false })
			},
			threadTileStatePolicy: statePolicy,
			threadTileLayoutPolicy: layoutPolicy,
			threadTileActionsApi: actionsApi,
			THREAD_TILE_USER_MAX_PANES: 6,
			THREAD_TILE_REFRESH_INTERVAL_MS: 5e3,
			THREAD_TILE_REFRESH_MIN_INTERVAL_MS: 500,
			STORAGE_THREAD_DISPLAY_MODE: "codex.threadDisplayMode",
			STORAGE_LEGACY_THREAD_TILE_MODE: "codex.legacyThreadTileMode",
			$: () => null,
			isKeyboardEditableElement: () => false,
			splitPaneSidebarVisible: () => false,
			isMenuOverlayMode: () => false,
			visibleThreads: (threads) => Array.isArray(threads) ? threads : [],
			isRunningStatus: (status) => status === "running" || status === "in_progress"
		}) : {};
		const viewport = runtime && typeof runtime.viewportPixelSize === "function" ? runtime.viewportPixelSize({ preferLayoutViewport: true }) : {};
		const paneCount = runtime && typeof runtime.normalizeThreadTilePaneCount === "function" ? runtime.normalizeThreadTilePaneCount("3", 1) : 0;
		const pinnedIds = runtime && typeof runtime.normalizeThreadTilePinnedIds === "function" ? runtime.normalizeThreadTilePinnedIds([
			"thread-b",
			"thread-a",
			"thread-b"
		]) : [];
		const idsEqual = runtime && typeof runtime.threadTileIdsEqual === "function" ? runtime.threadTileIdsEqual(["thread-a", "thread-b"], ["thread-a", "thread-b"]) : false;
		const payload = runtime && typeof runtime.threadDisplaySettingsPayload === "function" ? runtime.threadDisplaySettingsPayload() : {};
		const layout = runtime && typeof runtime.threadTileLayout === "function" ? runtime.threadTileLayout({ enabled: true }) : {};
		const status = runtime && typeof runtime.threadTileLayoutStatusText === "function" ? runtime.threadTileLayoutStatusText(layout) : "";
		return {
			ok: runtime && typeof runtime === "object" && viewport.width === 1400 && viewport.height === 900 && paneCount === 3 && pinnedIds.join(",") === "thread-b,thread-a" && idsEqual === true && payload.displayMode === "tile" && payload.paneCount === 3 && layout.enabled === true && status === "当前视口：平铺 3/3 窗",
			factoryType: typeof api.createThreadTileRuntime,
			viewportWidth: Number(viewport.width) || 0,
			viewportHeight: Number(viewport.height) || 0,
			paneCount,
			pinnedIds,
			idsEqual,
			displayMode: String(payload.displayMode || ""),
			layoutColumns: Number(layout.columns) || 0,
			status
		};
	}
	if (id === "app-update-runtime") {
		const runtime = functionReady(api, "createAppUpdateRuntime") ? api.createAppUpdateRuntime({
			CLIENT_BUILD_ID: "0.1.11|codex-mobile-shell-v625-a5a3d596240d",
			state: {
				appVersion: "0.1.11",
				publicReleaseEnabled: true
			},
			PAGE_SHELL_ASSETS: ["/app.js", "/sw.js"],
			escapeHtml: (value) => String(value == null ? "" : value),
			buildRefreshPolicy: { shouldPromptForServerBuildChange: () => true }
		}) : null;
		const client = runtime && typeof runtime.clientBuildVersionText === "function" ? runtime.clientBuildVersionText() : "";
		const version = runtime && typeof runtime.appVersionText === "function" ? runtime.appVersionText({ version: "0.1.11" }) : "";
		const fullVersion = runtime && typeof runtime.fullClientBuildVersionText === "function" ? runtime.fullClientBuildVersionText({
			clientBuildId: "0.1.11|codex-mobile-shell-v625-a5a3d596240d",
			shellCacheName: "codex-mobile-shell-v625-a5a3d596240d"
		}) : "";
		const updateLine = runtime && typeof runtime.updateStatusLine === "function" ? runtime.updateStatusLine({
			updateAvailable: true,
			canFastForward: true,
			remoteShort: "abc123"
		}) : "";
		const publicLine = runtime && typeof runtime.publicReleaseStatusLine === "function" ? runtime.publicReleaseStatusLine({
			updateAvailable: true,
			publicShort: "def456"
		}) : "";
		const serverBuild = runtime && typeof runtime.serverBuildIdFromConfig === "function" ? runtime.serverBuildIdFromConfig({
			clientBuildId: "client-a",
			shellCacheName: "cache-a"
		}) : "";
		return {
			ok: runtime && typeof runtime.refreshPageForNewBuild === "function" && client === "客户端 v625" && version === "v0.1.11 · 客户端 v625" && fullVersion === "clientBuildId 0.1.11|codex-mobile-shell-v625-a5a3d596240d · shellCacheName codex-mobile-shell-v625-a5a3d596240d" && updateLine === "Update available: abc123" && publicLine === "Public latest: def456" && serverBuild === "client-a",
			client,
			version,
			fullVersion,
			updateLine,
			publicLine,
			serverBuild,
			refreshReady: Boolean(runtime && typeof runtime.refreshPageForNewBuild === "function")
		};
	}
	if (id === "modal-runtime") {
		const runtime = functionReady(api, "createModalRuntime") ? api.createModalRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.requestAppNativeDialog === "function" && typeof runtime.requestAppAlert === "function" && typeof runtime.requestAppConfirmation === "function" && typeof runtime.requestAppTextInput === "function" && typeof runtime.requestCodexProfileSwitchConfirmation === "function" && typeof globalThis.handleAppNativeDialogKeydown === "function" && typeof globalThis.closeAppNativeDialog === "function" && typeof globalThis.performCodexProfileSwitch === "function",
			factoryType: typeof api.createModalRuntime,
			nativeDialogType: typeof (runtime && runtime.requestAppNativeDialog),
			alertType: typeof (runtime && runtime.requestAppAlert),
			confirmationType: typeof (runtime && runtime.requestAppConfirmation),
			textInputType: typeof (runtime && runtime.requestAppTextInput),
			profileSwitchType: typeof (runtime && runtime.requestCodexProfileSwitchConfirmation),
			keydownType: typeof globalThis.handleAppNativeDialogKeydown,
			closeType: typeof globalThis.closeAppNativeDialog,
			switchType: typeof globalThis.performCodexProfileSwitch
		};
	}
	if (id === "navigation-runtime") {
		const runtime = functionReady(api, "createNavigationRuntime") ? api.createNavigationRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.updateConnectionState === "function" && typeof runtime.restoreConnectionState === "function" && typeof runtime.markActivity === "function" && typeof runtime.composerTargetPlan === "function" && typeof runtime.visibleTurnsForConversation === "function" && typeof runtime.conversationRenderSignature === "function" && typeof runtime.updateTurnTimer === "function" && typeof globalThis.updateConnectionState === "function" && typeof globalThis.composerTargetPlan === "function" && typeof globalThis.visibleTurnsForConversation === "function",
			factoryType: typeof api.createNavigationRuntime,
			updateType: typeof (runtime && runtime.updateConnectionState),
			restoreType: typeof (runtime && runtime.restoreConnectionState),
			activityType: typeof (runtime && runtime.markActivity),
			composerPlanType: typeof (runtime && runtime.composerTargetPlan),
			visibleTurnsType: typeof (runtime && runtime.visibleTurnsForConversation),
			signatureType: typeof (runtime && runtime.conversationRenderSignature),
			timerType: typeof (runtime && runtime.updateTurnTimer),
			globalUpdateType: typeof globalThis.updateConnectionState,
			globalComposerPlanType: typeof globalThis.composerTargetPlan,
			globalVisibleTurnsType: typeof globalThis.visibleTurnsForConversation
		};
	}
	if (id === "runtime-wiring-runtime") {
		const runtime = functionReady(api, "createRuntimeWiringRuntime") ? api.createRuntimeWiringRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.initialize === "function",
			factoryType: typeof api.createRuntimeWiringRuntime,
			initializeType: typeof (runtime && runtime.initialize),
			globalType: typeof globalThis.CodexRuntimeWiringRuntime
		};
	}
	if (id === "app-shell-runtime") {
		const runtime = functionReady(api, "createAppShellRuntime") ? api.createAppShellRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.wireUi === "function" && typeof runtime.start === "function" && typeof runtime.startCodexMobileAppWithRecovery === "function",
			factoryType: typeof api.createAppShellRuntime,
			wireUiType: typeof (runtime && runtime.wireUi),
			startType: typeof (runtime && runtime.start),
			recoveryType: typeof (runtime && runtime.startCodexMobileAppWithRecovery),
			globalType: typeof globalThis.CodexAppShellRuntime
		};
	}
	if (id === "pane-layout-runtime") {
		const runtime = functionReady(api, "createPaneLayoutRuntime") ? api.createPaneLayoutRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderCurrentThread === "function" && typeof runtime.updateConversationHtml === "function" && typeof runtime.patchCurrentThreadDetailFromRefresh === "function" && typeof runtime.syncThreadTileToggle === "function" && typeof runtime.setThreadTileMode === "function" && typeof runtime.renderHome === "function" && typeof runtime.loadThread === "function" && typeof runtime.loadThreads === "function" && typeof runtime.enterNewThreadDraft === "function" && typeof runtime.handleThreadCardClick === "function" && typeof runtime.showHermesPluginPrimaryPage === "function" && typeof runtime.returnToThreadListFromDetail === "function" && typeof globalThis.loadThread === "function" && typeof globalThis.loadThreads === "function" && typeof globalThis.renderCurrentThread === "function",
			factoryType: typeof api.createPaneLayoutRuntime,
			renderType: typeof (runtime && runtime.renderCurrentThread),
			updateHtmlType: typeof (runtime && runtime.updateConversationHtml),
			patchType: typeof (runtime && runtime.patchCurrentThreadDetailFromRefresh),
			tileToggleType: typeof (runtime && runtime.syncThreadTileToggle),
			tileModeType: typeof (runtime && runtime.setThreadTileMode),
			homeType: typeof (runtime && runtime.renderHome),
			loadThreadType: typeof (runtime && runtime.loadThread),
			loadThreadsType: typeof (runtime && runtime.loadThreads),
			newThreadType: typeof (runtime && runtime.enterNewThreadDraft),
			cardClickType: typeof (runtime && runtime.handleThreadCardClick),
			pluginPrimaryType: typeof (runtime && runtime.showHermesPluginPrimaryPage),
			returnType: typeof (runtime && runtime.returnToThreadListFromDetail),
			globalLoadThreadType: typeof globalThis.loadThread,
			globalLoadThreadsType: typeof globalThis.loadThreads,
			globalRenderType: typeof globalThis.renderCurrentThread
		};
	}
	if (id === "thread-list-runtime") {
		const runtime = functionReady(api, "createThreadListRuntime") ? api.createThreadListRuntime({}) : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderThreads === "function" && typeof runtime.loadThreads === "function",
			factoryType: typeof api.createThreadListRuntime,
			renderThreadsType: typeof (runtime && runtime.renderThreads),
			loadThreadsType: typeof (runtime && runtime.loadThreads)
		};
	}
	if (id === "side-chat-runtime") {
		const state = {
			currentThreadId: "thread-a",
			currentThread: { id: "thread-a" },
			threadSideChats: /* @__PURE__ */ new Map(),
			nowMs: Date.parse("2026-07-02T00:00:00Z")
		};
		const runtime = functionReady(api, "createSideChatRuntime") ? api.createSideChatRuntime({
			state,
			api: async () => ({ sideChat: null }),
			escapeHtml: (value) => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
			statusText: (status) => String(status || ""),
			formatTime: () => "now",
			truncateMiddle: (value) => String(value || "")
		}) : {};
		const normalized = runtime && typeof runtime.normalizeSideChatState === "function" ? runtime.normalizeSideChatState({
			messages: [{
				role: "assistant",
				text: "hi"
			}],
			sidecar: { status: "pending" }
		}, "thread-a") : {};
		if (runtime && typeof runtime.setSideChatState === "function") runtime.setSideChatState("thread-a", normalized);
		const path = runtime && typeof runtime.sideChatApiPath === "function" ? runtime.sideChatApiPath("thread-a", "/draft") : "";
		const status = runtime && typeof runtime.sideChatStatusLabel === "function" ? runtime.sideChatStatusLabel("queued") : "";
		const queue = runtime && typeof runtime.sideChatQueueSummary === "function" ? runtime.sideChatQueueSummary({
			status: "queued",
			mode: "autoSendWhenIdle"
		}) : "";
		const pending = runtime && typeof runtime.sideChatReplyPending === "function" ? runtime.sideChatReplyPending("thread-a") : false;
		const subagentKind = runtime && typeof runtime.subagentStatusKind === "function" ? runtime.subagentStatusKind("running") : "";
		const subagentLabel = runtime && typeof runtime.subagentStatusLabel === "function" ? runtime.subagentStatusLabel("running") : "";
		const panel = runtime && typeof runtime.renderSideChatPanel === "function" ? runtime.renderSideChatPanel() : "";
		return {
			ok: runtime && typeof runtime === "object" && normalized.threadId === "thread-a" && Array.isArray(normalized.messages) && normalized.messages.length === 1 && path === "/api/threads/thread-a/side-chat/draft" && status === "已排队" && queue === "已排队 · 完成后自动发送" && pending === true && subagentKind === "running" && subagentLabel === "运行中" && String(panel || "").includes("side-chat-section"),
			factoryType: typeof api.createSideChatRuntime,
			normalizedThreadId: String(normalized.threadId || ""),
			messageCount: Array.isArray(normalized.messages) ? normalized.messages.length : 0,
			path,
			status,
			queue,
			pending,
			subagentKind,
			subagentLabel,
			panelReady: String(panel || "").includes("side-chat-section")
		};
	}
	if (id === "media-preview-runtime") {
		const element = {
			classList: {
				contains: () => false,
				add: () => {},
				remove: () => {},
				toggle: () => {}
			},
			dataset: {},
			style: {
				setProperty: () => {},
				removeProperty: () => {}
			},
			querySelector: () => null,
			querySelectorAll: () => [],
			closest: () => null,
			addEventListener: () => {},
			removeEventListener: () => {},
			appendChild: () => {},
			setAttribute: () => {},
			getAttribute: () => "",
			removeAttribute: () => {},
			textContent: "",
			innerText: id === "messageInput" ? "hello" : "",
			innerHTML: ""
		};
		const document = {
			documentElement: {
				getAttribute: () => "light",
				setAttribute: () => {}
			},
			head: element,
			createElement: () => Object.assign({}, element),
			getElementById: () => Object.assign({}, element),
			querySelector: () => null,
			querySelectorAll: () => []
		};
		const runtime = functionReady(api, "createMediaPreviewRuntime") ? api.createMediaPreviewRuntime({
			state: {
				key: "sample-key",
				currentThreadId: "thread-a",
				currentThread: { id: "thread-a" }
			},
			document,
			window: {
				location: {
					origin: "http://127.0.0.1:8787",
					pathname: "/"
				},
				CodexMarkdownRenderer: {
					renderMarkdown: (value) => `<p>${String(value == null ? "" : value)}</p>`,
					normalizeMermaidSourceForRender: (value) => String(value || "")
				},
				matchMedia: () => ({ matches: true }),
				setTimeout: (callback) => {
					if (typeof callback === "function") callback();
					return 1;
				},
				clearTimeout: () => {}
			},
			$: () => Object.assign({}, element),
			api: async () => ({}),
			escapeHtml: (value) => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
			normalizeFsPath: (value) => String(value || ""),
			shortPath: (value) => String(value || "").split("/").pop() || "",
			compactStructuredForSignature: (value) => JSON.stringify(value),
			visibleThreadTaskCardCommandText: (value) => String(value || ""),
			rememberCopyText: (value) => String(value || ""),
			copyButtonHtml: () => "<button></button>",
			stableTextHash: (value) => `hash:${String(value || "").length}`,
			renderContextThreadId: () => "thread-a",
			publishPluginNavigationState: () => {},
			postPerformanceEvent: () => {},
			roundedDurationMs: () => 1,
			nowPerfMs: () => 1,
			isHermesEmbedMode: () => false,
			isIosWebKitBrowser: () => false,
			requestHermesPluginRefresh: () => {},
			primaryTouch: (event) => event && event.touches && event.touches[0] || null
		}) : {};
		const githubUrl = runtime && typeof runtime.normalizeGithubPreviewUrl === "function" ? runtime.normalizeGithubPreviewUrl("https://github.com/openai/codex/pull/7") : "";
		const jsonPreview = runtime && typeof runtime.renderFilePreviewContent === "function" ? runtime.renderFilePreviewContent({
			kind: "json",
			content: "{\"ok\":true}"
		}) : "";
		return {
			ok: runtime && typeof runtime === "object" && githubUrl === "https://github.com/openai/codex/pull/7" && String(jsonPreview || "").includes("file-preview-text") && typeof runtime.renderMarkdownWithAttachmentSummary === "function" && typeof runtime.openImagePreviewFromImage === "function" && typeof runtime.renderImageView === "function" && typeof runtime.scheduleVisibleImageFailureScan === "function",
			factoryType: typeof api.createMediaPreviewRuntime,
			githubUrl,
			jsonPreviewReady: String(jsonPreview || "").includes("file-preview-text"),
			markdownType: typeof (runtime && runtime.renderMarkdownWithAttachmentSummary),
			imagePreviewType: typeof (runtime && runtime.openImagePreviewFromImage),
			imageViewType: typeof (runtime && runtime.renderImageView),
			scanType: typeof (runtime && runtime.scheduleVisibleImageFailureScan)
		};
	}
	if (id === "composer-runtime") {
		const elements = /* @__PURE__ */ new Map();
		const element = (id = "") => ({
			id,
			value: id === "messageInput" ? "hello" : "",
			files: [],
			classList: {
				contains: () => false,
				add: () => {},
				remove: () => {},
				toggle: () => {}
			},
			dataset: {},
			style: {
				setProperty: () => {},
				removeProperty: () => {}
			},
			getBoundingClientRect: () => ({
				width: 120,
				height: 32,
				left: 0,
				top: 0,
				right: 120,
				bottom: 32
			}),
			focus: () => {},
			blur: () => {},
			select: () => {},
			setSelectionRange: () => {},
			querySelector: () => null,
			querySelectorAll: () => [],
			closest: () => null,
			addEventListener: () => {},
			removeEventListener: () => {},
			appendChild: () => {},
			setAttribute: () => {},
			getAttribute: () => "",
			removeAttribute: () => {},
			textContent: "",
			innerHTML: ""
		});
		function getElement(id) {
			if (!elements.has(id)) elements.set(id, element(id));
			return elements.get(id);
		}
		const runtime = functionReady(api, "createComposerRuntime") ? api.createComposerRuntime({
			state: {
				threads: [],
				pendingAttachments: [],
				composerRuntimeSelection: {},
				codexProfiles: [],
				currentThreadId: "thread-a",
				currentThread: { id: "thread-a" },
				newThreadDraft: false
			},
			document: {
				documentElement: { style: {
					setProperty: () => {},
					removeProperty: () => {}
				} },
				activeElement: null,
				addEventListener: () => {},
				removeEventListener: () => {},
				createElement: () => element(),
				getElementById: getElement,
				querySelector: () => null,
				querySelectorAll: () => []
			},
			window: {
				setTimeout: (callback) => {
					if (typeof callback === "function") callback();
					return 1;
				},
				clearTimeout: () => {},
				requestAnimationFrame: (callback) => {
					if (typeof callback === "function") callback();
					return 1;
				},
				crypto: { randomUUID: () => "sample-uuid" },
				visualViewport: {
					width: 390,
					height: 700
				},
				innerWidth: 390,
				innerHeight: 700
			},
			$: getElement,
			api: async () => ({}),
			escapeHtml: (value) => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
			viewportMetrics: {
				cssPixel: (value) => Math.round(Number(value) || 0),
				stablePixelChanged: (left, right) => Math.abs((Number(left) || 0) - (Number(right) || 0)) >= 2
			},
			normalizeOptionList: (values) => Array.isArray(values) ? values.filter(Boolean).map((value) => String(value).trim()) : [],
			labelForModel: (value) => `Model ${String(value || "")}`.trim(),
			labelForEffort: (value) => `Effort ${String(value || "")}`.trim(),
			labelForPermissionMode: (value) => `Permission ${String(value || "")}`.trim(),
			defaultNewThreadModel: () => "gpt-5.5",
			defaultNewThreadEffort: () => "medium",
			defaultNewThreadPermissionMode: () => "auto",
			effectiveComposerPermissionMode: (value) => String(value || "").trim() || "auto",
			newThreadSelectedModel: () => "",
			newThreadSelectedEffort: () => "",
			newThreadSelectedPermissionMode: () => "",
			currentComposerThreadId: () => "thread-a",
			composerTargetThread: () => ({
				id: "thread-a",
				model: "gpt-5.5",
				effort: "medium",
				runtimeSettings: { permissionMode: "auto" }
			}),
			selectedQuotaModel: () => "gpt-5.5",
			threadDisplayName: () => "Thread A",
			isThreadTileComposerContext: () => false,
			isAndroidBrowser: () => false,
			isHermesEmbedMode: () => false,
			isKeyboardEditableElement: () => false,
			threadTileStatePolicy: { composerTargetPlaceholderPlan: () => ({ text: "Send to Thread A" }) },
			imageCompressor: {},
			homeAiDiagnosticReportingApi: {}
		}) : {};
		const model = runtime && typeof runtime.effectiveDefaultModel === "function" ? runtime.effectiveDefaultModel() : "";
		const effort = runtime && typeof runtime.effectiveDefaultEffort === "function" ? runtime.effectiveDefaultEffort() : "";
		const permission = runtime && typeof runtime.effectiveDefaultPermissionMode === "function" ? runtime.effectiveDefaultPermissionMode() : "";
		const label = runtime && typeof runtime.runtimeOptionLabel === "function" ? runtime.runtimeOptionLabel("model", "gpt-5.5") : "";
		const placeholder = runtime && typeof runtime.composerPlaceholderText === "function" ? runtime.composerPlaceholderText() : "";
		return {
			ok: runtime && typeof runtime === "object" && model === "gpt-5.5" && effort === "medium" && permission === "auto" && label === "Model gpt-5.5" && placeholder === "Send to Thread A" && typeof runtime.sendMessage === "function" && typeof runtime.sendNewThreadMessage === "function" && typeof runtime.interruptActiveTurn === "function",
			factoryType: typeof api.createComposerRuntime,
			model,
			effort,
			permission,
			label,
			placeholder,
			sendType: typeof (runtime && runtime.sendMessage),
			newThreadType: typeof (runtime && runtime.sendNewThreadMessage),
			interruptType: typeof (runtime && runtime.interruptActiveTurn)
		};
	}
	if (id === "composer-bridge-runtime") {
		const runtime = functionReady(api, "createComposerBridgeRuntime") ? api.createComposerBridgeRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.sendMessage === "function" && typeof runtime.sendNewThreadMessage === "function" && typeof runtime.answerServerRequest === "function" && typeof runtime.answerApproval === "function" && typeof runtime.declineServerRequest === "function" && typeof runtime.mutateThreadTaskCard === "function" && typeof runtime.replyTaskCard === "function" && typeof runtime.queueThreadTaskCardDraftCreation === "function" && typeof runtime.createThreadTaskCardDraft === "function" && typeof runtime.closeQuotaDetails === "function" && typeof runtime.toggleQuotaDetails === "function" && typeof globalThis.sendMessage === "function" && typeof globalThis.answerApproval === "function" && typeof globalThis.mutateThreadTaskCard === "function" && typeof globalThis.queueThreadTaskCardDraftCreation === "function",
			factoryType: typeof api.createComposerBridgeRuntime,
			sendType: typeof (runtime && runtime.sendMessage),
			answerType: typeof (runtime && runtime.answerServerRequest),
			approvalType: typeof (runtime && runtime.answerApproval),
			mutateType: typeof (runtime && runtime.mutateThreadTaskCard),
			replyType: typeof (runtime && runtime.replyTaskCard),
			draftType: typeof (runtime && runtime.createThreadTaskCardDraft),
			closeQuotaType: typeof (runtime && runtime.closeQuotaDetails),
			toggleQuotaType: typeof (runtime && runtime.toggleQuotaDetails),
			globalSendType: typeof globalThis.sendMessage,
			globalApprovalType: typeof globalThis.answerApproval,
			globalMutateType: typeof globalThis.mutateThreadTaskCard,
			globalDraftQueueType: typeof globalThis.queueThreadTaskCardDraftCreation
		};
	}
	if (id === "api-client-runtime") {
		const runtime = functionReady(api, "createApiClientRuntime") ? api.createApiClientRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.api === "function" && typeof runtime.postClientEvent === "function" && typeof runtime.postPerformanceEvent === "function" && typeof runtime.recordHomeAiDiagnosticFailure === "function" && typeof runtime.recordHomeAiDiagnosticSuccess === "function" && typeof runtime.scheduleSubmittedMessageDomProbe === "function" && typeof runtime.checkConversationProjectionConsistency === "function" && typeof runtime.handlePushButtonClick === "function" && typeof globalThis.api === "function" && typeof globalThis.postClientEvent === "function" && typeof globalThis.diagnosticThreadHash === "function" && typeof globalThis.recordHomeAiDiagnosticFailure === "function" && typeof globalThis.scheduleSubmittedMessageDomProbe === "function" && typeof globalThis.checkConversationProjectionConsistency === "function" && typeof globalThis.handlePushButtonClick === "function",
			factoryType: typeof api.createApiClientRuntime,
			apiType: typeof (runtime && runtime.api),
			clientEventType: typeof (runtime && runtime.postClientEvent),
			performanceType: typeof (runtime && runtime.postPerformanceEvent),
			diagnosticFailureType: typeof (runtime && runtime.recordHomeAiDiagnosticFailure),
			diagnosticSuccessType: typeof (runtime && runtime.recordHomeAiDiagnosticSuccess),
			submittedProbeType: typeof (runtime && runtime.scheduleSubmittedMessageDomProbe),
			projectionCheckType: typeof (runtime && runtime.checkConversationProjectionConsistency),
			pushType: typeof (runtime && runtime.handlePushButtonClick),
			globalApiType: typeof globalThis.api,
			globalClientEventType: typeof globalThis.postClientEvent,
			globalThreadHashType: typeof globalThis.diagnosticThreadHash,
			globalSubmittedProbeType: typeof globalThis.scheduleSubmittedMessageDomProbe,
			globalProjectionCheckType: typeof globalThis.checkConversationProjectionConsistency,
			globalPushType: typeof globalThis.handlePushButtonClick
		};
	}
	if (id === "thread-list-load-policy") {
		const plan = functionReady(api, "planThreadListLoadRequest") ? api.planThreadListLoadRequest({
			silent: true,
			threadDetailOpening: true,
			deferFallback: true
		}) : {};
		return {
			ok: plan && plan.action === "thread-list-load-request" && plan.shouldLoad === false && plan.skipReason === "detail-in-flight" && plan.retryDelayMs === 700,
			action: String(plan && plan.action || ""),
			shouldLoad: Boolean(plan && plan.shouldLoad),
			skipReason: String(plan && plan.skipReason || ""),
			retryDelayMs: Number(plan && plan.retryDelayMs) || 0
		};
	}
	if (id === "thread-list-stable-order") {
		const scopeKey = functionReady(api, "threadListOrderScopeKey") ? api.threadListOrderScopeKey({
			selectedCwd: "/tmp/project",
			search: "Home"
		}) : "";
		const plan = functionReady(api, "planThreadListStableOrder") ? api.planThreadListStableOrder({
			threads: [
				{ id: "b" },
				{ id: "a" },
				{ id: "c" }
			],
			previousState: {
				scopeKey,
				holdUntilMs: 2e3,
				order: ["a", "b"]
			},
			scopeKey,
			nowMs: 1e3,
			holdMs: 5e3
		}) : {};
		const order = Array.isArray(plan.order) ? plan.order : [];
		return {
			ok: scopeKey === JSON.stringify({
				cwd: "/tmp/project",
				search: "home"
			}) && plan.held === true && order.join(",") === "a,b,c",
			scopeKey,
			held: Boolean(plan.held),
			order
		};
	}
	if (id === "thread-status-hints") {
		const running = functionReady(api, "isRunningStatus") ? api.isRunningStatus("in_progress") : false;
		const unread = functionReady(api, "shouldMarkThreadUnread") ? api.shouldMarkThreadUnread({
			threadId: "target-thread",
			currentThreadId: "other-thread",
			status: "completed",
			thread: { turns: [{
				status: "completed",
				completedAtMs: 2e3
			}] },
			viewedAtMs: 1e3
		}) : false;
		const expire = functionReady(api, "shouldExpireRunningThreadHint") ? api.shouldExpireRunningThreadHint({
			threadId: "target-thread",
			isRunningHinted: true,
			status: {
				type: "completed",
				mobileStaleActiveTurn: true
			},
			runningHintedAtMs: 0,
			runningHintStaleMs: 1e3,
			nowMs: 5e3,
			thread: { mobileStaleActiveTurn: true }
		}) : false;
		return {
			ok: running === true && unread === true && expire === true,
			running,
			unread,
			expire
		};
	}
	if (id === "thread-detail-patch-plan") {
		const surface = functionReady(api, "planThreadDetailDomPatchSurface") ? api.planThreadDetailDomPatchSurface({
			threadId: "thread-a",
			conversationPresent: true
		}) : {};
		const visiblePatch = functionReady(api, "planVisibleItemRefreshPatch") ? api.planVisibleItemRefreshPatch([{
			key: "a",
			signature: "1"
		}], [{
			key: "a",
			signature: "1"
		}, {
			key: "b",
			signature: "2"
		}]) : {};
		const turnPatch = functionReady(api, "planThreadDetailRefreshDomPatch") ? api.planThreadDetailRefreshDomPatch([{
			key: "turn-a",
			hasPreviousTurn: true,
			itemPatchable: true,
			articlePresent: true
		}]) : {};
		const visibleOperations = Array.isArray(visiblePatch.operations) ? visiblePatch.operations : [];
		const turnOperations = Array.isArray(turnPatch.operations) ? turnPatch.operations : [];
		return {
			ok: surface.canPatch === true && surface.reason === "single-thread-surface" && visiblePatch.canPatch === true && visibleOperations.map((entry) => entry.type).join(",") === "reuse,insert" && turnPatch.canPatch === true && turnOperations.length === 1 && turnOperations[0].type === "item-patch",
			surfaceReason: String(surface.reason || ""),
			visibleOperationCount: visibleOperations.length,
			turnOperationType: String(turnOperations[0] && turnOperations[0].type || "")
		};
	}
	if (id === "thread-detail-actions") {
		const node = (dataset) => ({
			dataset,
			closest(selector) {
				if (selector === "[data-thread-tile-pane]") return { dataset: { threadTilePane: "thread-pane" } };
				return null;
			}
		});
		const copyNode = node({ copyKey: "copy-1" });
		const approvalNode = node({
			approvalId: "ap-1",
			approvalThreadId: "thread-ap",
			approvalAction: "allow_once"
		});
		const responseNode = node({
			serverRequestId: "req-1",
			serverRequestThreadId: "thread-req",
			serverResponseText: "yes",
			serverQuestionId: "answer"
		});
		const rich = functionReady(api, "resolveRichContentClickAction") ? api.resolveRichContentClickAction({ target: { closest(selector) {
			return selector === "[data-copy-key]" ? copyNode : null;
		} } }) : {};
		const approval = functionReady(api, "resolveThreadDetailClickAction") ? api.resolveThreadDetailClickAction({ target: { closest(selector) {
			return selector === "[data-approval-action]" ? approvalNode : null;
		} } }) : {};
		const response = functionReady(api, "resolveThreadDetailClickAction") ? api.resolveThreadDetailClickAction({ target: { closest(selector) {
			return selector === "[data-server-response-text]" ? responseNode : null;
		} } }) : {};
		const contextThreadId = functionReady(api, "contextThreadIdFromNode") ? api.contextThreadIdFromNode(copyNode) : "";
		return {
			ok: rich.action === "copy" && rich.preventDefault === true && rich.stopPropagation === true && approval.action === "approval-answer" && approval.approvalAction === "allow_once" && approval.threadId === "thread-ap" && response.action === "server-response" && response.responseText === "yes" && contextThreadId === "thread-pane",
			richAction: String(rich.action || ""),
			approvalAction: String(approval.action || ""),
			approvalValue: String(approval.approvalAction || ""),
			responseAction: String(response.action || ""),
			contextThreadId
		};
	}
	if (id === "thread-detail-merge-state") {
		const policy = functionReady(api, "createThreadDetailMergePolicy") ? api.createThreadDetailMergePolicy({
			sortTurnsForDisplay: (turns) => Array.isArray(turns) ? turns.slice().sort((left, right) => String(left && left.id || "").localeCompare(String(right && right.id || ""))) : [],
			turnVisibleWeight: (turn) => JSON.stringify(turn && turn.items || []).length,
			mergeItemsPreservingLocalVisible: (existingItems, incomingItems, preserveLocalVisible) => preserveLocalVisible ? existingItems : incomingItems
		}) : {};
		const merged = policy && typeof policy.mergeThreadPreservingVisibleItems === "function" ? policy.mergeThreadPreservingVisibleItems({
			id: "thread-a",
			turns: [{
				id: "b",
				items: [{
					type: "assistantMessage",
					text: "full receipt"
				}]
			}]
		}, {
			id: "thread-a",
			turns: [{
				id: "b",
				items: []
			}, {
				id: "a",
				items: [{
					type: "userMessage",
					text: "hello"
				}]
			}]
		}) : {};
		const turns = Array.isArray(merged && merged.turns) ? merged.turns : [];
		const preserved = turns.find((turn) => turn && turn.id === "b");
		return {
			ok: turns.map((turn) => String(turn && turn.id || "")).join(",") === "a,b" && Array.isArray(preserved && preserved.items) && preserved.items.length === 1 && preserved.items[0].text === "full receipt",
			turnOrder: turns.map((turn) => String(turn && turn.id || "")),
			preservedItemCount: Array.isArray(preserved && preserved.items) ? preserved.items.length : 0
		};
	}
	if (id === "thread-detail-v4-merge-state") {
		const policy = functionReady(api, "createThreadDetailV4MergePolicy") ? api.createThreadDetailV4MergePolicy({
			normalizeThreadVisibleUserMessages: (thread) => thread,
			turnVisibleWeight: (turn) => Array.isArray(turn && turn.items) ? turn.items.length : 0,
			isOptimisticUserMessage: (item) => Boolean(item && item.mobilePendingSubmission),
			isRecentlySubmittedUserMessage: (item) => Boolean(item && item.mobilePendingSubmission),
			isReasoningItem: (item) => String(item && item.type || "") === "reasoning",
			userMessagesCanShadow: () => false,
			isTurnComplete: (turn) => /completed|failed|cancel|interrupted/i.test(String(turn && (turn.status && turn.status.type || turn.status) || "")),
			isRunningStatus: (status) => /running|active|inprogress|in_progress/i.test(String(status && status.type || status || "")),
			isIncompleteInterruptedTurn: () => false,
			turnHasActiveLiveItems: () => false,
			turnOrderMs: (turn) => Number(turn && turn.startedAtMs) || 0,
			sortTurnsForDisplay: (turns) => Array.isArray(turns) ? turns.slice().sort((left, right) => (Number(left && left.startedAtMs) || 0) - (Number(right && right.startedAtMs) || 0)) : [],
			maxVisibleTurnsForThread: () => 5
		}) : {};
		const merged = policy && typeof policy.mergeV4ProjectionThread === "function" ? policy.mergeV4ProjectionThread({
			id: "thread-a",
			mobileProjectionRevision: 3,
			turns: [{
				id: "active",
				startedAtMs: 100,
				status: "running",
				items: [{
					type: "agentMessage",
					text: "streaming"
				}]
			}]
		}, {
			id: "thread-a",
			mobileProjectionRevision: 2,
			turns: [{
				id: "new",
				startedAtMs: 50,
				status: "completed",
				items: [{
					type: "userMessage",
					text: "prompt"
				}]
			}]
		}) : {};
		const turns = Array.isArray(merged && merged.turns) ? merged.turns : [];
		return {
			ok: typeof policy.mergeV4ProjectionThread === "function" && typeof policy.v4ProjectionRevisionValue === "function" && policy.v4ProjectionRevisionValue(merged) === 3 && turns.map((turn) => String(turn && turn.id || "")).join(",") === "new,active",
			revision: policy && typeof policy.v4ProjectionRevisionValue === "function" ? policy.v4ProjectionRevisionValue(merged) : 0,
			turnOrder: turns.map((turn) => String(turn && turn.id || ""))
		};
	}
	if (id === "thread-detail-runtime") {
		const statePolicy = {
			completedIncomingTurnHasAuthoritativeReceipt: () => false,
			shouldDropLocalOnlyReceiptForIncomingTurn: () => false,
			shouldPreserveLocalOnlyItem: () => false,
			shouldPreserveExistingTurnVisibleItems: () => false
		};
		const runtime = functionReady(api, "createThreadDetailRuntime") ? api.createThreadDetailRuntime({
			threadDetailStateApi: {
				createThreadDetailStatePolicy: () => statePolicy,
				threadListSummaryFromDetailThread: () => ({}),
				planThreadOpenCacheReuse: () => ({ action: "skip" }),
				threadHasReusableLoadedDetailState: () => false
			},
			threadDetailMergeStateApi: { createThreadDetailMergePolicy: () => ({ mergeThreadPreservingVisibleItems: (existingThread, incomingThread) => incomingThread || existingThread }) },
			threadDetailV4MergeStateApi: { createThreadDetailV4MergePolicy: () => ({
				isV4ProjectionThread: () => false,
				mergeV4ProjectionThread: (existingThread, incomingThread) => incomingThread || existingThread
			}) },
			statusText: (status) => String(status && status.type || status || ""),
			isLiveTurn: (turn) => /active|running/i.test(String(turn && (turn.status && turn.status.type || turn.status) || "")),
			isLatestTurn: (turn, thread) => Array.isArray(thread && thread.turns) && thread.turns.at(-1) === turn,
			isReasoningItem: (item) => String(item && item.type || "") === "reasoning",
			isOperationalItem: (item) => String(item && item.type || "") === "commandExecution",
			isContextCompactionItem: () => false,
			isTurnComplete: (turn) => /completed|failed|cancel|interrupted/i.test(String(turn && (turn.status && turn.status.type || turn.status) || "")),
			isRunningStatus: (status) => /active|running|queued|processing/i.test(String(status && status.type || status || "")),
			sortTurnsForDisplay: (turns) => Array.isArray(turns) ? turns : []
		}) : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.visibleItemsForTurn === "function" && typeof runtime.mergeThreadPreservingVisibleItems === "function" && typeof runtime.normalizeThreadVisibleUserMessages === "function" && typeof runtime.threadUserMessageEntries === "function" && typeof runtime.turnOrderMs === "function" && typeof runtime.turnIsSupersededBy === "function" && typeof globalThis.CodexThreadDetailRuntime === "object" && typeof globalThis.CodexThreadDetailRuntime.createThreadDetailRuntime === "function",
			factoryType: typeof api.createThreadDetailRuntime,
			visibleItemsType: typeof (runtime && runtime.visibleItemsForTurn),
			mergeType: typeof (runtime && runtime.mergeThreadPreservingVisibleItems),
			normalizeType: typeof (runtime && runtime.normalizeThreadVisibleUserMessages),
			turnOrderType: typeof (runtime && runtime.turnOrderMs),
			globalFactoryType: typeof (globalThis.CodexThreadDetailRuntime && globalThis.CodexThreadDetailRuntime.createThreadDetailRuntime)
		};
	}
	if (id === "task-card-runtime") {
		const runtime = functionReady(api, "createTaskCardRuntime") ? api.createTaskCardRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderThreadTaskCard === "function" && typeof runtime.renderThreadTaskCards === "function" && typeof runtime.createThreadTaskCardFromCurrent === "function" && typeof runtime.renderApprovalRequest === "function" && typeof globalThis.CodexTaskCardRuntime === "object" && typeof globalThis.CodexTaskCardRuntime.createTaskCardRuntime === "function" && typeof globalThis.threadTaskCardCommandText === "function" && typeof globalThis.renderThreadTaskCards === "function" && typeof globalThis.renderApprovalRequest === "function",
			factoryType: typeof api.createTaskCardRuntime,
			renderType: typeof (runtime && runtime.renderThreadTaskCard),
			renderListType: typeof (runtime && runtime.renderThreadTaskCards),
			createType: typeof (runtime && runtime.createThreadTaskCardFromCurrent),
			approvalType: typeof (runtime && runtime.renderApprovalRequest),
			globalCommandType: typeof globalThis.threadTaskCardCommandText,
			globalRenderType: typeof globalThis.renderThreadTaskCards
		};
	}
	if (id === "settings-runtime") {
		const runtime = functionReady(api, "createSettingsRuntime") ? api.createSettingsRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderFontSizeControl === "function" && typeof runtime.renderQuotaUsage === "function" && typeof runtime.renderCodexProfileSettings === "function" && typeof runtime.renderWorkspaceDelegationSettings === "function" && typeof runtime.rememberRateLimitsFromConfig === "function" && typeof runtime.rememberCodexProfiles === "function" && typeof globalThis.CodexSettingsRuntime === "object" && typeof globalThis.CodexSettingsRuntime.createSettingsRuntime === "function",
			factoryType: typeof api.createSettingsRuntime,
			fontSizeType: typeof (runtime && runtime.renderFontSizeControl),
			quotaType: typeof (runtime && runtime.renderQuotaUsage),
			profileType: typeof (runtime && runtime.renderCodexProfileSettings),
			workspaceDelegationType: typeof (runtime && runtime.renderWorkspaceDelegationSettings),
			rateLimitsType: typeof (runtime && runtime.rememberRateLimitsFromConfig),
			profilesType: typeof (runtime && runtime.rememberCodexProfiles),
			globalFactoryType: typeof (globalThis.CodexSettingsRuntime && globalThis.CodexSettingsRuntime.createSettingsRuntime)
		};
	}
	if (id === "app-entry") {
		const runtime = functionReady(api, "createCodexMobileAppEntry") ? api.createCodexMobileAppEntry() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.startCodexMobileApp === "function" && typeof api.startCodexMobileApp === "function" && typeof globalThis.CodexMobileAppEntry === "object" && typeof globalThis.CodexMobileAppEntry.createCodexMobileAppEntry === "function" && typeof globalThis.CodexMobileAppEntry.startCodexMobileApp === "function",
			factoryType: typeof api.createCodexMobileAppEntry,
			startType: typeof api.startCodexMobileApp,
			runtimeStartType: typeof (runtime && runtime.startCodexMobileApp),
			globalFactoryType: typeof (globalThis.CodexMobileAppEntry && globalThis.CodexMobileAppEntry.createCodexMobileAppEntry),
			globalStartType: typeof (globalThis.CodexMobileAppEntry && globalThis.CodexMobileAppEntry.startCodexMobileApp)
		};
	}
	if (id === "notification-ui-runtime") {
		const runtime = functionReady(api, "createNotificationUiRuntime") ? api.createNotificationUiRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.showApp === "function" && typeof runtime.showLogin === "function" && typeof runtime.bootstrap === "function" && typeof runtime.requestHermesPluginRefresh === "function" && typeof runtime.handlePluginVoiceInputMessage === "function" && typeof globalThis.CodexNotificationUiRuntime === "object" && typeof globalThis.CodexNotificationUiRuntime.createNotificationUiRuntime === "function" && typeof globalThis.showApp === "function" && typeof globalThis.showLogin === "function" && typeof globalThis.bootstrap === "function" && typeof globalThis.sortTurnsForDisplay === "function",
			factoryType: typeof api.createNotificationUiRuntime,
			showAppType: typeof (runtime && runtime.showApp),
			showLoginType: typeof (runtime && runtime.showLogin),
			bootstrapType: typeof (runtime && runtime.bootstrap),
			refreshType: typeof (runtime && runtime.requestHermesPluginRefresh),
			globalBootstrapType: typeof globalThis.bootstrap,
			globalSortType: typeof globalThis.sortTurnsForDisplay
		};
	}
	if (id === "conversation-render-runtime") {
		const runtime = functionReady(api, "createConversationRenderRuntime") ? api.createConversationRenderRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderTurn === "function" && typeof runtime.renderItem === "function" && typeof runtime.renderItemBody === "function" && typeof runtime.renderUserMessageBody === "function" && typeof runtime.renderLiveOperationDock === "function" && typeof runtime.ensureTurn === "function" && typeof runtime.shouldDeferLiveFinalReceipt === "function" && typeof globalThis.CodexConversationRenderRuntime === "object" && typeof globalThis.CodexConversationRenderRuntime.createConversationRenderRuntime === "function" && typeof globalThis.renderTurn === "function" && typeof globalThis.renderItem === "function" && typeof globalThis.renderLiveOperationDock === "function" && typeof globalThis.ensureTurn === "function" && typeof globalThis.shouldDeferLiveFinalReceipt === "function" && typeof globalThis.imageUrlValue === "function" && typeof globalThis.renderMarkdownWithAttachmentSummary === "function" && typeof globalThis.renderFilePreviewContent === "function" && typeof globalThis.closeImagePreview === "function",
			factoryType: typeof api.createConversationRenderRuntime,
			renderTurnType: typeof (runtime && runtime.renderTurn),
			renderItemType: typeof (runtime && runtime.renderItem),
			liveDockType: typeof (runtime && runtime.renderLiveOperationDock),
			ensureTurnType: typeof (runtime && runtime.ensureTurn),
			globalRenderType: typeof globalThis.renderTurn,
			globalEnsureTurnType: typeof globalThis.ensureTurn,
			globalImageUrlType: typeof globalThis.imageUrlValue
		};
	}
	if (id === "event-stream-runtime") {
		const runtime = functionReady(api, "createEventStreamRuntime") ? api.createEventStreamRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.connectEvents === "function" && typeof runtime.applyNotification === "function" && typeof runtime.resumeMobileSession === "function" && typeof runtime.scrollConversationToBottom === "function" && typeof runtime.updateScrollToBottomButton === "function" && typeof globalThis.CodexEventStreamRuntime === "object" && typeof globalThis.CodexEventStreamRuntime.createEventStreamRuntime === "function" && typeof globalThis.upsertItem === "function" && typeof globalThis.connectEvents === "function" && typeof globalThis.ensureEventConnection === "function" && typeof globalThis.resumeMobileSession === "function" && typeof globalThis.followThreadOpenToBottom === "function" && typeof globalThis.scheduleBottomFollowScroll === "function" && typeof globalThis.updateScrollToBottomButton === "function",
			factoryType: typeof api.createEventStreamRuntime,
			connectType: typeof (runtime && runtime.connectEvents),
			notificationType: typeof (runtime && runtime.applyNotification),
			resumeType: typeof (runtime && runtime.resumeMobileSession),
			scrollType: typeof (runtime && runtime.scrollConversationToBottom),
			globalConnectType: typeof globalThis.connectEvents,
			globalFollowType: typeof globalThis.followThreadOpenToBottom
		};
	}
	if (id === "client-render-stability-guard") {
		const sourceTurn = {
			id: "local-turn-secret",
			items: [{
				type: "userMessage",
				clientSubmissionId: "submission-secret",
				mobilePendingSubmission: true
			}]
		};
		const targetTurn = {
			id: "server-turn-a",
			items: [{
				type: "userMessage",
				clientSubmissionId: "submission-secret"
			}]
		};
		const sourceKey = functionReady(api, "markSubmittedTurn") ? api.markSubmittedTurn(sourceTurn, "submission-secret") : "";
		const transferredKey = functionReady(api, "transferSubmittedTurnIdentity") ? api.transferSubmittedTurnIdentity(sourceTurn, targetTurn, "submission-secret") : "";
		const sourceIdentity = functionReady(api, "stableTurnIdentity") ? api.stableTurnIdentity(sourceTurn) : "";
		const targetIdentity = functionReady(api, "stableTurnIdentity") ? api.stableTurnIdentity(targetTurn) : "";
		return {
			ok: Boolean(sourceKey) && sourceKey === transferredKey && sourceIdentity === sourceKey && targetIdentity === sourceKey && !String(sourceKey).includes("submission-secret"),
			sourceKey: String(sourceKey || ""),
			transferredKey: String(transferredKey || ""),
			sourceIdentity: String(sourceIdentity || ""),
			targetIdentity: String(targetIdentity || "")
		};
	}
	if (id === "live-operation-dock-state") {
		const card = functionReady(api, "operationCardContentPlan") ? api.operationCardContentPlan({
			itemId: "op-a",
			type: "tool",
			status: "running",
			title: "Run",
			detail: "working",
			durationText: "1s"
		}) : {};
		const preserve = functionReady(api, "compactBubblePreservation") ? api.compactBubblePreservation({
			nextHtml: "",
			liveTurnActive: true,
			visibleUntilMs: 2e3,
			nowMs: 1e3,
			savedThreadId: "thread-a",
			currentThreadId: "thread-a",
			savedHtml: "<div class=\"mobile-operation-bubble\"></div>",
			dockHasBubble: false
		}) : {};
		const recall = functionReady(api, "shouldShowRecall") ? api.shouldShowRecall({
			isMobile: true,
			hasCurrentThread: true,
			newThreadDraft: false,
			liveTurnActive: true,
			recallThreadId: "thread-a",
			currentThreadId: "thread-a",
			recallHtml: "<div class=\"mobile-operation-sheet\"></div>"
		}) : false;
		const classTokens = Array.isArray(card.classTokens) ? card.classTokens : [];
		return {
			ok: card.detail === "working" && classTokens.includes("live-operation") && preserve.preserve === true && preserve.patchSavedHtml === true && recall === true,
			detail: String(card.detail || ""),
			preserve: Boolean(preserve.preserve),
			recall
		};
	}
	return { ok: false };
}
function codexMobileViteEsmCompatibility() {
	const modules = moduleDefinitions.map((definition) => {
		const api = moduleApis[definition.id] && typeof moduleApis[definition.id] === "object" ? moduleApis[definition.id] : {};
		const expectedFunctions = Array.isArray(definition.expectedFunctions) ? definition.expectedFunctions : [];
		const exportedFunctions = expectedFunctions.filter((name) => functionReady(api, name));
		const sample = sampleModule(definition.id, api);
		const globalPublished = publishClassicGlobal(definition, api);
		return {
			id: definition.id,
			source: definition.source,
			assetPath: definition.assetPath,
			nativeSource: definition.nativeSource || "",
			importSource: definition.importSource || definition.source,
			compatibilityMode: definition.compatibilityMode || "classic-global-compat",
			globalName: definition.globalName,
			classicLoaderExcluded: definition.classicLoaderExcluded === true,
			expectedFunctions: expectedFunctions.slice(),
			exportedFunctions,
			sample,
			globalPublished,
			ready: exportedFunctions.length === expectedFunctions.length && sample.ok === true && (definition.classicLoaderExcluded !== true || globalPublished === true)
		};
	});
	return {
		schemaVersion: 1,
		owner: "vite-shell-entry",
		moduleCount: modules.length,
		nativeEsmModuleCount: modules.filter((entry) => entry.compatibilityMode === "native-esm").length,
		classicGlobalCompatibilityModuleCount: modules.filter((entry) => entry.compatibilityMode !== "native-esm").length,
		readyCount: modules.filter((entry) => entry.ready === true).length,
		modules
	};
}
var codexMobileViteEsmCompatibilityModules = moduleDefinitions;
//#endregion
export { codexMobileViteEsmCompatibility, codexMobileViteEsmCompatibility as default, codexMobileViteEsmCompatibilityModules };
