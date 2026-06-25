"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const bodyStart = source.indexOf(") {", start) + 2;
  assert.notEqual(bodyStart, 1, `missing function body ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }
  throw new Error(`could not parse function ${name}`);
}

test("thread tile layout is wired as an explicit shell policy", () => {
  assert.doesNotMatch(indexHtml, /id="threadTileToggle"/);
  assert.match(indexHtml, /data-thread-display-choice="single"[\s\S]*data-thread-display-choice="tile"/);
  assert.match(indexHtml, /<script src="\/thread-detail-state\.js"><\/script>\s*\n\s*<script src="\/thread-detail-render-plan\.js"><\/script>\s*\n\s*<script src="\/thread-detail-merge-state\.js"><\/script>\s*\n\s*<script src="\/thread-detail-patch-plan\.js"><\/script>\s*\n\s*<script src="\/thread-detail-dom-patch\.js"><\/script>\s*\n\s*<script src="\/thread-detail-actions\.js"><\/script>\s*\n\s*<script src="\/thread-tile-actions\.js"><\/script>\s*\n\s*<script src="\/thread-tile-state\.js"><\/script>\s*\n\s*<script src="\/thread-tile-layout\.js"><\/script>\s*\n\s*<script src="\/build-refresh-policy\.js"><\/script>/);
  assert.match(appJs, /const threadTileActionsApi = window\.CodexThreadTileActions/);
  assert.match(appJs, /const threadTileStatePolicy = window\.CodexThreadTileState/);
  assert.match(appJs, /const threadTileLayoutPolicy = window\.CodexThreadTileLayout/);
  assert.match(appJs, /threadTileMode: false/);
  assert.match(appJs, /threadDisplaySettingsLoaded: false/);
  assert.match(appJs, /threadDisplaySettingsSaveTimer: null/);
  assert.match(appJs, /threadTileActiveIds: \[\]/);
  assert.match(appJs, /threadTilePinnedIds: \[\]/);
  assert.match(appJs, /threadTileSplitPairs: \[\]/);
  assert.match(appJs, /threadTileDraggingThreadId: ""/);
  assert.match(appJs, /threadTilePaneCount: 0/);
  assert.match(appJs, /threadTileSelectedThreadId: ""/);
  assert.match(appJs, /threadTileSwitchMenuPaneId: ""/);
  assert.match(appJs, /threadTileRefreshTimer: null/);
  assert.match(appJs, /threadTilePaneRenderFramesById: new Map\(\)/);
  assert.match(appJs, /threadTilePaneScrollHoldById: new Map\(\)/);
  assert.match(appJs, /threadTileOperationModesById: new Map\(\)/);
  assert.match(appJs, /threadTileViewportBaseline: null/);
  assert.match(appJs, /threadTileComposerHeightBaselinePx: 0/);
  assert.match(appJs, /THREAD_TILE_REFRESH_INTERVAL_MS/);
  assert.match(appJs, /THREAD_TILE_SETTINGS_SAVE_DEBOUNCE_MS/);
  assert.match(appJs, /THREAD_TILE_USER_MAX_PANES/);
  assert.match(appJs, /STORAGE_LEGACY_THREAD_TILE_MODE = "codexMobileThreadTileMode"/);
  assert.match(appJs, /function loadThreadDisplaySettings\(/);
  assert.match(appJs, /\/api\/settings\/thread-display/);
  assert.match(appJs, /function scheduleThreadDisplaySettingsSave\(/);

  const layoutBody = functionBody(appJs, "threadTileLayout");
  assert.match(appJs, /function isThreadTileKeyboardFocusActive\(/);
  assert.match(appJs, /function threadTileViewportSize\(/);
  assert.match(appJs, /function threadTileVerticalChromePx\(/);
  assert.match(functionBody(appJs, "threadTileViewportSize"), /state\.threadTileViewportBaseline = layoutViewport/);
  assert.match(functionBody(appJs, "threadTileViewportSize"), /return baseline && baseline\.width && baseline\.height \? baseline : layoutViewport/);
  assert.match(layoutBody, /const viewport = threadTileViewportSize\(\)/);
  assert.match(layoutBody, /const sidebarSplitVisible = splitPaneSidebarVisible\(\)/);
  assert.match(layoutBody, /const menuOverlay = isMenuOverlayMode\(\) \|\| !sidebarSplitVisible/);
  assert.match(layoutBody, /threadTileLayoutPolicy\.layoutForViewport/);
  assert.match(layoutBody, /coarsePointer: isCoarsePointerViewport\(\)/);
  assert.match(layoutBody, /menuOverlay,/);
  assert.match(layoutBody, /maxPanes: THREAD_TILE_USER_MAX_PANES/);
  assert.match(layoutBody, /recommendedMaxPanes: threadTileLayoutPolicy\.DEFAULT_MAX_PANES/);
  assert.match(layoutBody, /desiredPaneCount: normalizeThreadTilePaneCount\(state\.threadTilePaneCount, 0\)/);
  assert.match(layoutBody, /verticalChromePx: threadTileVerticalChromePx\(\)/);
  assert.match(appJs, /function effectiveThreadTilePaneCount\(/);
  assert.match(functionBody(appJs, "threadTileLayoutCapacity"), /layout\.recommendedMaxPanes \|\| layout\.maxPanes/);
  assert.match(functionBody(appJs, "effectiveThreadTilePaneCount"), /if \(explicit > 0\) \{[\s\S]*threadTileMaximumPaneCount\(layout\)[\s\S]*explicit/);
  assert.match(appJs, /function setThreadTilePaneCount\(/);
  assert.match(appJs, /function closeThreadTilePane\(/);
  const setCountBody = functionBody(appJs, "setThreadTilePaneCount");
  assert.match(setCountBody, /threadTileStatePolicy\.paneCountChangePlan/);
  assert.match(setCountBody, /state\.threadTilePaneCount = plan\.paneCount/);
  assert.match(setCountBody, /state\.threadTileSwitchMenuPaneId = plan\.switchMenuPaneId \|\| ""/);
  assert.match(setCountBody, /threadTileStatePolicy\.paneSelectionPlan/);
  const closePaneBody = functionBody(appJs, "closeThreadTilePane");
  assert.match(closePaneBody, /threadTileStatePolicy\.closePanePlan/);
  assert.match(closePaneBody, /state\.threadTilePinnedIds = normalizeThreadTilePinnedIds\(plan\.paneThreadIds\)/);
  assert.match(closePaneBody, /state\.threadTilePaneCount = plan\.paneCount/);
  assert.match(closePaneBody, /threadTileStatePolicy\.paneSelectionPlan/);
  assert.match(functionBody(appJs, "threadDisplaySettingsPayload"), /threadTileStatePolicy\.displaySettingsPayload/);
  assert.match(functionBody(appJs, "threadDisplaySettingsPayload"), /normalizeSplitPairs: threadTileLayoutPolicy\.normalizeSplitPairs/);
  assert.match(functionBody(appJs, "applyThreadDisplaySettings"), /threadTileStatePolicy\.normalizeDisplaySettings/);
  assert.match(functionBody(appJs, "applyThreadDisplaySettings"), /state\.threadTilePaneCount = normalized\.paneCount/);
  assert.match(functionBody(appJs, "applyThreadDisplaySettings"), /state\.threadTileSplitPairs = normalized\.paneSplitPairs/);

  const toggleBody = functionBody(appJs, "syncThreadTileToggle");
  assert.match(toggleBody, /threadTileLayout\(\{ enabled: true \}\)/);
  assert.match(toggleBody, /document\.querySelectorAll\("\[data-thread-display-choice\]"\)/);
  assert.match(toggleBody, /button\.classList\.toggle\("selected", isSelected\)/);

  const choiceBody = functionBody(appJs, "handleThreadTileModeChoice");
  assert.match(choiceBody, /event\.target\.closest\("\[data-thread-display-choice\]"\)/);
  assert.match(choiceBody, /setThreadTileMode\(button\.getAttribute\("data-thread-display-choice"\) === "tile"\)/);
});

test("thread tile rendering is read-only and separate from full conversation rendering", () => {
  const renderCurrentThreadBody = functionBody(appJs, "renderCurrentThread");
  assert.match(renderCurrentThreadBody, /const tileLayout = threadTileLayout\(\)/);
  assert.match(renderCurrentThreadBody, /if \(tileLayout\.enabled\) \{/);
  assert.match(renderCurrentThreadBody, /clearGlobalLiveOperationDockForThreadTiles\(\)/);
  assert.match(renderCurrentThreadBody, /renderThreadTileLayout\(tileLayout, options\)/);

  const headerBody = functionBody(appJs, "updateThreadTileGlobalHeader");
  assert.match(headerBody, /titleEl\) titleEl\.textContent = ""/);
  assert.match(headerBody, /metaEl\) metaEl\.textContent = ""/);

  const tileLayoutBody = functionBody(appJs, "renderThreadTileLayout");
  assert.match(tileLayoutBody, /const scrollState = captureThreadTilePaneScrollState\(\)/);
  assert.match(tileLayoutBody, /const displayLayout = threadTileDisplayLayout\(layout, ids\)/);
  assert.match(tileLayoutBody, /const columnGroups = Array\.isArray\(displayLayout\.columnGroups\)/);
  assert.match(tileLayoutBody, /class="thread-tile-column"/);
  assert.doesNotMatch(tileLayoutBody, /renderThreadTileWindowControls/);
  assert.match(tileLayoutBody, /ensureThreadTileDetails\(ids\)/);
  assert.match(tileLayoutBody, /bindThreadTileActions\(\)/);
  assert.match(tileLayoutBody, /restoreThreadTilePaneScrollState\(scrollState\)/);
  assert.match(tileLayoutBody, /threadTileRenderSignature\(displayLayout, ids\)/);
  assert.match(functionBody(appJs, "threadTileRenderSignature"), /view: "thread-tiles"/);
  assert.match(functionBody(appJs, "threadTileRenderSignature"), /desiredPaneCount: normalizeThreadTilePaneCount\(state\.threadTilePaneCount, 0\)/);
  assert.match(functionBody(appJs, "threadTileRenderSignature"), /columnGroups: layout\.columnGroups \|\| \[\]/);
  assert.match(functionBody(appJs, "threadTileRenderSignature"), /splitPairs: threadTilePrunedSplitPairs\(ids\)/);
  assert.match(functionBody(appJs, "threadTileRenderSignature"), /switchMenuPaneId: state\.threadTileSwitchMenuPaneId \|\| ""/);

  const syncActiveBody = functionBody(appJs, "syncThreadTileActivePaneState");
  assert.match(syncActiveBody, /threadTileStatePolicy\.activePaneSyncPlan/);
  assert.match(syncActiveBody, /state\.threadTileActiveIds = plan\.activeIds/);
  assert.match(syncActiveBody, /state\.threadTilePinnedIds = normalizeThreadTilePinnedIds\(plan\.paneThreadIds\)/);
  assert.match(syncActiveBody, /state\.threadTileSelectedThreadId = plan\.selectedThreadId/);
  assert.match(syncActiveBody, /if \(plan\.settingsChanged\) scheduleThreadDisplaySettingsSave\(\)/);
  const ensureBody = functionBody(appJs, "ensureThreadTileDetails");
  assert.match(ensureBody, /syncThreadTileActivePaneState\(ids\)/);
  assert.doesNotMatch(ensureBody, /syncThreadTilePinnedIdsFromActiveIds/);
  assert.doesNotMatch(ensureBody, /syncThreadTileSelectedThread/);
  assert.match(ensureBody, /scheduleThreadTileRefresh\(\)/);

  const candidateBody = functionBody(appJs, "threadTileCandidateIds");
  assert.match(candidateBody, /threadTileStatePolicy\.candidatePaneIdsPlan/);
  assert.match(candidateBody, /pinnedIds: state\.threadTilePinnedIds/);
  assert.match(candidateBody, /effectiveThreadTilePaneCount\(layout\)/);
  assert.match(candidateBody, /defaultIds: defaultThreadTileCandidateIds\(layout, \{ maxPanes \}\)/);
  assert.match(candidateBody, /visibleIds: Array\.from\(threadTileVisibleIdSet\(\)\)/);
  assert.match(candidateBody, /currentThreadId: state\.currentThreadId/);
  assert.match(candidateBody, /selectPinnedThreadTileIds: threadTileLayoutPolicy\.selectPinnedThreadTileIds/);
  assert.match(candidateBody, /return plan\.ids/);
  assert.match(functionBody(appJs, "threadTileMaximumPaneCount"), /THREAD_TILE_USER_MAX_PANES/);
  assert.match(functionBody(appJs, "defaultThreadTileCandidateIds"), /THREAD_TILE_USER_MAX_PANES/);

  const loadBody = functionBody(appJs, "loadThreadTileDetail");
  assert.match(loadBody, /threadTileStatePolicy\.detailLoadPlan/);
  assert.match(loadBody, /controllerActive: state\.threadTileControllers\.has\(id\)/);
  assert.match(loadBody, /loadingActive: state\.threadTileLoadingIds\.has\(id\)/);
  assert.match(loadBody, /THREAD_TILE_REFRESH_MIN_INTERVAL_MS/);
  assert.match(loadBody, /if \(plan\.action !== "load"\) return;/);
  assert.match(loadBody, /state\.threadTileDetails\.set\(id, result\.thread\)/);

  const tilePaneBody = functionBody(appJs, "renderThreadTilePane");
  assert.match(tilePaneBody, /thread-tile-pane-content/);
  assert.match(tilePaneBody, /draggable="true"/);
  assert.match(tilePaneBody, /data-thread-tile-drag-handle/);
  assert.match(tilePaneBody, /effectiveThreadTileSelectedThreadId\(\)/);
  assert.match(tilePaneBody, /turnTimerStateHtml\(threadTilePaneTimerState\(thread \|\| summary\)\)/);
  assert.match(tilePaneBody, /thread-tile-pane-state-slot/);
  assert.match(tilePaneBody, /data-thread-tile-pane-state/);
  assert.match(tilePaneBody, /data-thread-tile-title/);
  assert.match(tilePaneBody, /renderThreadTileSwitchMenu\(id\)/);
  const switchMenuBody = functionBody(appJs, "renderThreadTileSwitchMenu");
  assert.match(switchMenuBody, /thread-tile-switch-actions/);
  assert.match(switchMenuBody, /data-thread-tile-close-pane/);
  assert.match(switchMenuBody, /data-thread-tile-pane-count="1"/);
  assert.match(tilePaneBody, /renderThreadTileOperationDock\(thread, previousKeys\)/);
  assert.match(tilePaneBody, /data-thread-tile-bottom/);
  assert.match(tilePaneBody, /thread-tile-bottom-button hidden/);
  assert.doesNotMatch(tilePaneBody, /data-thread-tile-open/);
  const selectPaneBody = functionBody(appJs, "setThreadTileSelectedThread");
  assert.match(selectPaneBody, /threadTileStatePolicy\.selectPanePlan/);
  assert.match(selectPaneBody, /state\.threadTileSelectedThreadId = plan\.selectedThreadId/);
  assert.match(selectPaneBody, /plan\.patchThreadIds/);
  assert.match(selectPaneBody, /patchThreadTilePane\(id, \{ preserveScroll: true \}\)/);

  const tileActionsBody = functionBody(appJs, "bindThreadTileActions");
  assert.match(tileActionsBody, /threadTileActionsApi\.resolveThreadTilePointerAction/);
  assert.match(tileActionsBody, /threadTileActionsApi\.resolveThreadTileFocusAction/);
  assert.match(tileActionsBody, /threadTileActionsApi\.resolveThreadTileClickAction/);
  assert.match(tileActionsBody, /threadTileActionsApi\.resolveThreadTileScrollAction/);
  assert.match(tileActionsBody, /threadTileActionsApi\.resolveThreadTileDragStartAction/);
  assert.match(tileActionsBody, /threadTileActionsApi\.resolveThreadTileDragOverAction/);
  assert.match(tileActionsBody, /threadTileActionsApi\.resolveThreadTileDragLeaveAction/);
  assert.match(tileActionsBody, /threadTileActionsApi\.resolveThreadTileDropAction/);
  assert.match(tileActionsBody, /setThreadTileSelectedThread/);
  assert.match(tileActionsBody, /conversation\.dataset\.threadTileActionsBound/);
  assert.match(tileActionsBody, /conversation\.addEventListener\("pointerdown"/);
  assert.match(tileActionsBody, /conversation\.addEventListener\("click"/);
  assert.match(tileActionsBody, /conversation\.addEventListener\("dragstart"/);
  assert.match(tileActionsBody, /conversation\.addEventListener\("dragover"/);
  assert.match(tileActionsBody, /conversation\.addEventListener\("drop"/);
  assert.match(tileActionsBody, /dropThreadTilePane\(plan\.draggingId, plan\.targetId, event\)/);
  assert.match(tileActionsBody, /conversation\.addEventListener\("scroll"/);
  assert.match(tileActionsBody, /updateThreadTileBottomButtonForBody\(plan\.body\)/);
  assert.match(tileActionsBody, /toggleThreadTileSwitchMenu\(plan\.paneId \|\| ""\)/);
  assert.doesNotMatch(tileActionsBody, /if \(!event\.detail\) toggleThreadTileSwitchMenu/);
  assert.match(tileActionsBody, /replaceThreadTilePaneThread/);
  assert.match(tileActionsBody, /changeThreadTilePaneCount/);
  assert.match(tileActionsBody, /closeThreadTilePane/);
  assert.doesNotMatch(tileActionsBody, /data-thread-tile-open/);
  assert.match(tileActionsBody, /scrollThreadTilePaneToBottom/);
  assert.match(tileActionsBody, /updateThreadTileBottomButtonForBody/);
  assert.match(tileActionsBody, /threadTileStatePolicy\.toggleOperationMode/);

  const tileTurnBody = functionBody(appJs, "renderThreadTileTurn");
  assert.match(tileTurnBody, /state\.renderContextThreadId/);
  assert.match(tileTurnBody, /renderVisibleItemPatchHtml/);
  assert.doesNotMatch(tileTurnBody, /renderTurn\(/);
  assert.doesNotMatch(tileTurnBody, /turn-status/);
  assert.doesNotMatch(tileTurnBody, /renderThreadTaskCardDraft/);

  const switchBody = functionBody(appJs, "replaceThreadTilePaneThread");
  assert.match(switchBody, /threadTileStatePolicy\.replacePaneThreadPlan/);
  assert.match(switchBody, /state\.threadTilePinnedIds = normalizeThreadTilePinnedIds\(plan\.paneThreadIds\)/);
  assert.match(switchBody, /scheduleThreadDisplaySettingsSave\(\)/);
  assert.match(switchBody, /state\.threadTileSelectedThreadId = plan\.selectedThreadId \|\| to/);
  assert.match(switchBody, /loadThreadTileDetail\(plan\.loadThreadId, \{ force: true, source: "tile-switch" \}\)/);
  assert.match(switchBody, /plan\.renderMode === "full"/);

  const moveBody = functionBody(appJs, "moveThreadTilePaneRelative");
  assert.match(moveBody, /threadTileStatePolicy\.movePaneRelativePlan/);
  assert.match(moveBody, /state\.threadTilePinnedIds = normalizeThreadTilePinnedIds\(plan\.paneThreadIds\)/);
  assert.match(moveBody, /state\.threadTileSplitPairs = normalizeThreadTileSplitPairs\(plan\.paneSplitPairs, state\.threadTilePinnedIds\)/);

  const splitBody = functionBody(appJs, "splitThreadTilePaneWithTarget");
  assert.match(splitBody, /threadTileStatePolicy\.splitPaneWithTargetPlan/);
  assert.match(splitBody, /state\.threadTilePinnedIds = normalizeThreadTilePinnedIds\(plan\.paneThreadIds\)/);
  assert.match(splitBody, /state\.threadTileSplitPairs = normalizeThreadTileSplitPairs\(plan\.paneSplitPairs, state\.threadTilePinnedIds\)/);

  const dropBody = functionBody(appJs, "dropThreadTilePane");
  assert.match(dropBody, /threadTileStatePolicy\.dropPaneIntent/);
  assert.match(dropBody, /moveThreadTilePaneRelative\(from, to, plan\.placement\)/);
  assert.match(dropBody, /splitThreadTilePaneWithTarget\(from, to, plan\.placement\)/);

  const listOpenReplaceBody = functionBody(appJs, "replaceLastThreadTilePaneForThreadListOpen");
  assert.match(listOpenReplaceBody, /source !== "thread-list"/);
  assert.match(listOpenReplaceBody, /const ids = threadTileCandidateIds\(layout\)/);
  assert.match(listOpenReplaceBody, /threadTileStatePolicy\.replaceLastPaneForThreadListOpenPlan/);
  assert.match(listOpenReplaceBody, /state\.threadTilePinnedIds = normalizeThreadTilePinnedIds\(plan\.paneThreadIds\)/);
  assert.match(listOpenReplaceBody, /state\.threadTileSelectedThreadId = plan\.selectedThreadId \|\| id/);
  assert.match(listOpenReplaceBody, /scheduleThreadDisplaySettingsSave\(\)/);
  assert.doesNotMatch(appJs, /function removeThreadTileSplitPairsForIds\(/);
  assert.doesNotMatch(appJs, /function setThreadTileSplitPair\(/);
  const loadThreadBody = functionBody(appJs, "loadThread");
  assert.match(loadThreadBody, /replaceLastThreadTilePaneForThreadListOpen\(threadId, \{ source \}\)/);

  const tileOperationDockBody = functionBody(appJs, "renderThreadTileOperationDock");
  assert.match(tileOperationDockBody, /currentLiveOperationEntry\(thread\)/);
  assert.match(tileOperationDockBody, /data-thread-tile-operation-dock/);
  assert.match(tileOperationDockBody, /data-thread-tile-operation-toggle/);
  assert.match(tileOperationDockBody, /rememberThreadTileOperationBubble/);
  assert.match(tileOperationDockBody, /threadTileStatePolicy\.normalizeOperationMode/);
  assert.match(functionBody(appJs, "rememberThreadTileOperationBubble"), /threadTileStatePolicy\.operationBubbleRecord/);
  assert.match(functionBody(appJs, "recentThreadTileOperationBubble"), /threadTileStatePolicy\.operationBubbleSnapshot/);
  assert.match(functionBody(appJs, "threadTileOperationSignature"), /threadTileStatePolicy\.operationSignature/);

  const clearGlobalDockBody = functionBody(appJs, "clearGlobalLiveOperationDockForThreadTiles");
  assert.match(clearGlobalDockBody, /state\.liveOperationDockPinned = false/);
  assert.match(clearGlobalDockBody, /state\.liveOperationDockRecallHtml = ""/);
  assert.match(clearGlobalDockBody, /dock\.hidden = true/);
  assert.match(functionBody(appJs, "renderCurrentThread"), /if \(tileLayout\.enabled\) \{\s*clearGlobalLiveOperationDockForThreadTiles\(\)/);

  const mobileOperationBody = functionBody(appJs, "renderMobileOperationStack");
  assert.match(mobileOperationBody, /options\.toggleAttribute/);

  assert.match(appJs, /function turnTimerStateFromThread\(/);
  assert.match(appJs, /function turnTimerStateHtml\(/);
  assert.match(appJs, /function threadTilePaneTimerState\(/);
  assert.match(appJs, /function patchThreadTilePane\(/);
  assert.match(appJs, /function scheduleRenderThreadTilePane\(/);
  assert.match(appJs, /function rememberThreadTilePaneScrollPosition\(/);
  assert.match(functionBody(appJs, "scheduleThreadTileRefresh"), /threadTileStatePolicy\.refreshSchedulePlan/);
  assert.match(functionBody(appJs, "refreshThreadTileDetails"), /threadTileStatePolicy\.refreshTargetIds/);
  assert.match(functionBody(appJs, "captureThreadTilePaneScrollState"), /hold: state\.threadTilePaneScrollHoldById\.get\(id\) === true/);
  assert.match(functionBody(appJs, "rememberThreadTilePaneScrollPosition"), /state\.threadTilePaneScrollHoldById\.set\(id, true\)/);
  assert.match(functionBody(appJs, "rememberThreadTilePaneScrollPosition"), /state\.threadTilePaneScrollHoldById\.delete\(id\)/);
  assert.match(functionBody(appJs, "restoreThreadTilePaneElementScrollState"), /!hold/);
  assert.match(functionBody(appJs, "toggleThreadTileSwitchMenu"), /patchThreadTilePane\(id, \{ preserveScroll: true \}\)/);
  assert.match(functionBody(appJs, "loadThreadTileDetail"), /scheduleRenderThreadTilePane\(id, \{ preserveScroll: true \}\)/);
  assert.match(functionBody(appJs, "setThreadTileSelectedThread"), /patchThreadTilePane\(id, \{ preserveScroll: true \}\)/);
  assert.match(appJs, /if \(state\.threadTileMode && !isThreadTileKeyboardFocusActive\(\)\) scheduleRenderCurrentThread\(\)/);
  assert.match(functionBody(appJs, "updateTurnTimer"), /applyTurnTimerState\(el, currentThreadTurnTimerState\(\)\)/);
  assert.match(functionBody(appJs, "updateThreadTilePaneStatusBadges"), /turnTimerStateHtml\(threadTilePaneTimerState\(threadTileDisplayThread\(id\)\)\)/);
  assert.match(stylesCss, /\.conversation\.thread-tile-mode\s*{/);
  assert.match(stylesCss, /html\.embed-hermes\.thread-tile-open\.keyboard-open \.app\s*{[\s\S]*transform:\s*none;/);
  assert.match(stylesCss, /\.main\.thread-tile-main \.topbar\s*{/);
  assert.match(stylesCss, /\.main\.thread-tile-main > \.live-operation-dock\s*{/);
  assert.match(stylesCss, /\.conversation\.thread-tile-mode\s*{[\s\S]*max\(env\(safe-area-inset-top, 0px\), var\(--host-top-safe-area, 0px\)\)/);
  assert.match(stylesCss, /\.thread-tile-board\s*{/);
  assert.match(stylesCss, /\.thread-tile-column\s*{/);
  assert.match(stylesCss, /grid-template-rows:\s*repeat\(var\(--thread-tile-column-rows, 1\), minmax\(0, 1fr\)\);/);
  assert.match(stylesCss, /\.thread-tile-pane\.drag-over\s*{/);
  assert.match(stylesCss, /\.thread-tile-switch-actions\s*{/);
  assert.match(stylesCss, /\.thread-tile-switch-action\s*{/);
  assert.doesNotMatch(stylesCss, /\.thread-tile-window-controls\s*{/);
  assert.match(stylesCss, /\.thread-tile-pane\s*{/);
  assert.match(stylesCss, /\.thread-tile-pane-header\s*{[\s\S]*background:\s*var\(--thread-tile-header-bg\);/);
  assert.match(stylesCss, /\.thread-tile-pane\.active \.thread-tile-pane-header\s*{[\s\S]*background:\s*var\(--thread-tile-header-active-bg\);/);
  assert.match(stylesCss, /\.message-input\.has-target-placeholder:empty::before\s*{[\s\S]*color:\s*var\(--composer-target-placeholder\);/);
  assert.match(stylesCss, /\.thread-tile-pane-body\s*{/);
  assert.match(stylesCss, /\.thread-tile-pane-content\s*{/);
  assert.match(stylesCss, /\.thread-tile-pane-state\s*{/);
  assert.match(stylesCss, /\.thread-tile-switch-menu\s*{/);
  assert.match(stylesCss, /\.thread-tile-operation-dock\s*{/);
  assert.match(stylesCss, /\.thread-tile-operation-dock \.mobile-operation-stack\s*{/);
  assert.match(stylesCss, /\.thread-tile-bottom-button\s*{/);

  const notificationBody = functionBody(appJs, "applyNotification");
  assert.match(notificationBody, /threadTilePaneIsVisible\(params\.threadId\)/);
  assert.match(notificationBody, /loadThreadTileDetail\(params\.threadId, \{ force: true, background: true/);

  const refreshBody = functionBody(appJs, "refreshCurrentThread");
  assert.match(refreshBody, /const tilePatchPlan = threadDetailDomPatchSurface\(\{ threadId \}\)/);
  assert.match(refreshBody, /state\.threadTileMode[\s\S]*isThreadTileConversationSurface\(\)[\s\S]*tilePatchPlan && tilePatchPlan\.surface === "thread-tile-pane"/);
  assert.match(refreshBody, /renderPlan\.canPatch && !tileSurfaceRefresh/);
});

test("thread tile composer targets the active pane without replacing the shared composer", () => {
  const currentDraftKeyBody = functionBody(appJs, "currentDraftKey");
  assert.match(currentDraftKeyBody, /currentComposerThreadId\(\)/);

  const targetIdBody = functionBody(appJs, "currentComposerThreadId");
  assert.match(targetIdBody, /effectiveThreadTileSelectedThreadId\(\) \|\| state\.currentThreadId/);

  const tileComposerContextBody = functionBody(appJs, "isThreadTileComposerContext");
  assert.match(tileComposerContextBody, /state\.threadTileMode/);
  assert.match(tileComposerContextBody, /conversation\.classList\.contains\("thread-tile-mode"\)/);
  assert.match(tileComposerContextBody, /state\.threadTileActiveIds\.length/);

  const placeholderBody = functionBody(appJs, "composerPlaceholderText");
  assert.match(placeholderBody, /const targetThreadId = currentComposerThreadId\(\)/);
  assert.match(placeholderBody, /const targetThread = composerTargetThread\(\)/);
  assert.match(placeholderBody, /Boolean\(isThreadTileComposerContext\(\) && targetThreadId && targetThread\)/);
  assert.match(placeholderBody, /return `发送到：\$\{title\}`;/);
  assert.match(appJs, /function composerShowsTargetPlaceholder\(\)/);
  assert.match(functionBody(appJs, "composerShowsTargetPlaceholder"), /Boolean\(isThreadTileComposerContext\(\) && targetThreadId && targetThread\)/);

  const updateControlsBody = functionBody(appJs, "updateComposerControls");
  assert.match(updateControlsBody, /const targetThreadId = currentComposerThreadId\(\)/);
  assert.match(updateControlsBody, /const targetActiveTurnId = composerTargetActiveTurnId\(\)/);
  assert.match(updateControlsBody, /messageInput\.dataset\.placeholder = composerPlaceholderText\(\);/);
  assert.match(updateControlsBody, /messageInput\.classList\.toggle\("has-target-placeholder", composerShowsTargetPlaceholder\(\)\);/);
  assert.match(updateControlsBody, /Boolean\(!hasNewThreadDraft && targetActiveTurnId\) && hasContent/);

  const sendMessageBody = functionBody(appJs, "sendMessage");
  assert.match(sendMessageBody, /const targetThreadId = currentComposerThreadId\(\)/);
  assert.match(sendMessageBody, /openThreadGoalDialog\(targetThreadId\)/);
  assert.match(sendMessageBody, /interruptActiveTurn\(targetThreadId, targetActiveTurnId\)/);
  assert.match(sendMessageBody, /insertLocalSubmittedUserMessage\(targetThreadId/);
  assert.match(sendMessageBody, /api\(`\/api\/threads\/\$\{encodeURIComponent\(targetThreadId\)\}\/messages`/);
  assert.match(sendMessageBody, /scheduleComposerTargetRefresh\(targetThreadId/);

  const taskCardBody = functionBody(appJs, "sendThreadTaskCardCommand");
  assert.match(taskCardBody, /const targetThreadId = currentComposerThreadId\(\)/);
  assert.match(taskCardBody, /buildThreadTaskCardDraftRequestText\(text, targetThread\)/);
  assert.match(taskCardBody, /api\(`\/api\/threads\/\$\{encodeURIComponent\(targetThreadId\)\}\/messages`/);
});
