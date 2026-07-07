"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { readFrontendSources } = require("./frontend-source-helper");

const root = path.resolve(__dirname, "..");
const appJs = readFrontendSources(root);
const composerRuntimeJs = fs.readFileSync(path.join(root, "public", "composer-runtime.js"), "utf8");
const navigationRuntimeJs = fs.readFileSync(path.join(root, "public", "navigation-runtime.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");
const threadTileRuntimeJs = fs.readFileSync(path.join(root, "public", "thread-tile-runtime.js"), "utf8");
const threadTileVisualFixture = require(path.join(root, "scripts", "codex-mobile-thread-tile-visual-fixture.js"));

const navigationRuntimeFunctionNames = new Set([
  "composerTargetPlan",
  "currentComposerThreadId",
  "isThreadTileComposerContext",
  "threadTileComposerSurfaceActive",
]);

function functionBody(source, name) {
  if (source === appJs && navigationRuntimeFunctionNames.has(name)) {
    source = navigationRuntimeJs;
  }
  let start = source.indexOf(`function ${name}(`);
  if (start < 0) start = source.indexOf(`async function ${name}(`);
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
  assert.match(indexHtml, /<script src="\/thread-detail-state\.js"><\/script>\s*\n\s*<script src="\/thread-detail-render-plan\.js"><\/script>\s*\n\s*<script src="\/thread-detail-merge-state\.js"><\/script>\s*\n\s*<script src="\/thread-detail-v4-merge-state\.js"><\/script>\s*\n\s*<script src="\/thread-detail-runtime\.js"><\/script>\s*\n\s*<script src="\/thread-detail-patch-plan\.js"><\/script>\s*\n\s*<script src="\/thread-detail-dom-patch\.js"><\/script>\s*\n\s*<script src="\/thread-detail-actions\.js"><\/script>\s*\n\s*<script src="\/thread-tile-actions\.js"><\/script>\s*\n\s*<script src="\/thread-tile-state\.js"><\/script>\s*\n\s*<script src="\/thread-tile-layout\.js"><\/script>\s*\n\s*<script src="\/thread-tile-runtime\.js"><\/script>\s*\n\s*<script src="\/build-refresh-policy\.js"><\/script>/);
  assert.match(appJs, /(?:const|var) threadTileActionsApi = window\.CodexThreadTileActions/);
  assert.match(appJs, /(?:const|var) threadTileStatePolicy = window\.CodexThreadTileState/);
  assert.match(appJs, /(?:const|var) threadTileLayoutPolicy = window\.CodexThreadTileLayout/);
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
  assert.match(threadTileRuntimeJs, /\/api\/settings\/thread-display/);
  assert.match(appJs, /function scheduleThreadDisplaySettingsSave\(/);

  const layoutBody = functionBody(threadTileRuntimeJs, "threadTileLayout");
  assert.match(appJs, /function isThreadTileKeyboardFocusActive\(/);
  assert.match(appJs, /function threadTileViewportSize\(/);
  assert.match(appJs, /function threadTileVerticalChromePx\(/);
  assert.match(functionBody(threadTileRuntimeJs, "threadTileViewportSize"), /threadTileStatePolicy\.threadTileViewportBaselinePlan/);
  assert.match(functionBody(threadTileRuntimeJs, "threadTileViewportSize"), /if \(plan\.updateBaseline\) state\.threadTileViewportBaseline = plan\.nextBaseline/);
  assert.match(functionBody(threadTileRuntimeJs, "threadTileVerticalChromePx"), /threadTileStatePolicy\.threadTileVerticalChromePlan/);
  assert.match(functionBody(threadTileRuntimeJs, "threadTileVerticalChromePx"), /if \(plan\.updateBaseline\) state\.threadTileComposerHeightBaselinePx = plan\.nextComposerHeightBaselinePx/);
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
  assert.match(functionBody(threadTileRuntimeJs, "threadTileLayoutCapacity"), /threadTileStatePolicy\.layoutCapacity/);
  assert.match(functionBody(threadTileRuntimeJs, "threadTileDisplayLayout"), /threadTileStatePolicy\.paneDisplayLayoutPlan/);
  assert.match(functionBody(threadTileRuntimeJs, "threadTileDisplayLayout"), /threadTileLayoutPolicy\.threadTileColumnGroups/);
  assert.match(functionBody(threadTileRuntimeJs, "threadTilePaneCountState"), /threadTileStatePolicy\.paneCountStatePlan/);
  assert.match(functionBody(threadTileRuntimeJs, "threadTilePaneCountState"), /candidateIds: defaultThreadTileCandidateIds\(layout, \{ maxPanes: capacity \}\)/);
  assert.match(functionBody(threadTileRuntimeJs, "threadTilePaneCountState"), /maxCandidateIds: defaultThreadTileCandidateIds\(layout, \{ maxPanes: THREAD_TILE_USER_MAX_PANES \}\)/);
  assert.match(functionBody(threadTileRuntimeJs, "threadTilePaneCountState"), /runningIds: threadTileRunningPaneIds\(\)/);
  assert.match(functionBody(threadTileRuntimeJs, "effectiveThreadTilePaneCount"), /threadTilePaneCountState\(layout\)\.effectivePaneCount/);
  assert.match(appJs, /function setThreadTilePaneCount\(/);
  assert.match(appJs, /function closeThreadTilePane\(/);
  const setCountBody = functionBody(threadTileRuntimeJs, "setThreadTilePaneCount");
  assert.match(setCountBody, /threadTileStatePolicy\.paneCountChangePlan/);
  assert.match(setCountBody, /threadTileStatePolicy\.paneSlotMutationEffectsPlan\(plan/);
  assert.match(setCountBody, /applyThreadTilePaneSlotEffects/);
  assert.doesNotMatch(setCountBody, /state\.threadTilePaneCount = plan\.paneCount/);
  const closePaneBody = functionBody(threadTileRuntimeJs, "closeThreadTilePane");
  assert.match(closePaneBody, /threadTileStatePolicy\.closePanePlan/);
  assert.match(closePaneBody, /threadTileStatePolicy\.paneSlotMutationEffectsPlan\(plan/);
  assert.match(closePaneBody, /applyThreadTilePaneSlotEffects/);
  assert.doesNotMatch(closePaneBody, /state\.threadTilePinnedIds = normalizeThreadTilePinnedIds\(plan\.paneThreadIds\)/);
  assert.doesNotMatch(closePaneBody, /state\.threadTilePaneCount = plan\.paneCount/);
  assert.match(functionBody(threadTileRuntimeJs, "threadDisplaySettingsPayload"), /threadTileStatePolicy\.displaySettingsPayload/);
  assert.match(functionBody(threadTileRuntimeJs, "threadDisplaySettingsPayload"), /normalizeSplitPairs: threadTileLayoutPolicy\.normalizeSplitPairs/);
  assert.match(functionBody(threadTileRuntimeJs, "applyThreadDisplaySettings"), /threadTileStatePolicy\.normalizeDisplaySettings/);
  assert.match(functionBody(threadTileRuntimeJs, "applyThreadDisplaySettings"), /state\.threadTilePaneCount = normalized\.paneCount/);
  assert.match(functionBody(threadTileRuntimeJs, "applyThreadDisplaySettings"), /state\.threadTileSplitPairs = normalized\.paneSplitPairs/);
  const loadDisplaySettingsBody = functionBody(threadTileRuntimeJs, "loadThreadDisplaySettings");
  assert.match(loadDisplaySettingsBody, /threadTileStatePolicy\.displaySettingsLoadPlan/);
  assert.match(loadDisplaySettingsBody, /localDisplayMode: localThreadDisplayMode\(\)/);
  assert.match(loadDisplaySettingsBody, /if \(plan\.saveAfterApply\)/);
  assert.match(loadDisplaySettingsBody, /if \(plan\.rethrow\) throw err/);
  assert.doesNotMatch(loadDisplaySettingsBody, /settings\.source !== "runtime"/);

  const toggleBody = functionBody(threadTileRuntimeJs, "syncThreadTileToggle");
  assert.match(toggleBody, /threadTileLayout\(\{ enabled: true \}\)/);
  assert.match(toggleBody, /document\.querySelectorAll\("\[data-thread-display-choice\]"\)/);
  assert.match(toggleBody, /button\.classList\.toggle\("selected", isSelected\)/);

  const choiceBody = functionBody(threadTileRuntimeJs, "handleThreadTileModeChoice");
  assert.match(choiceBody, /event\.target\.closest\("\[data-thread-display-choice\]"\)/);
  assert.match(choiceBody, /setThreadTileMode\(button\.getAttribute\("data-thread-display-choice"\) === "tile"\)/);
});

test("thread tile rendering is read-only and separate from full conversation rendering", () => {
  const renderCurrentThreadBody = functionBody(appJs, "renderCurrentThread");
  assert.match(renderCurrentThreadBody, /const tileLayout = threadTileLayout\(\)/);
  assert.match(renderCurrentThreadBody, /if \(tileLayout\.enabled\) \{/);
  assert.match(renderCurrentThreadBody, /clearGlobalLiveOperationDockForThreadTiles\(\)/);
  assert.match(renderCurrentThreadBody, /renderThreadTileLayout\(tileLayout, options\)/);

  const headerBody = functionBody(threadTileRuntimeJs, "updateThreadTileGlobalHeader");
  assert.match(headerBody, /titleEl\) titleEl\.textContent = ""/);
  assert.match(headerBody, /metaEl\) metaEl\.textContent = ""/);

  const tileLayoutBody = functionBody(threadTileRuntimeJs, "renderThreadTileLayout");
  assert.match(tileLayoutBody, /const scrollState = captureThreadTilePaneScrollState\(\)/);
  assert.match(tileLayoutBody, /const displayLayout = threadTileDisplayLayout\(layout, ids\)/);
  assert.match(tileLayoutBody, /const columnGroups = Array\.isArray\(displayLayout\.columnGroups\)/);
  assert.doesNotMatch(tileLayoutBody, /data-thread-tile-sidebar-toggle/);
  assert.doesNotMatch(tileLayoutBody, /thread-tile-board-sidebar-toggle/);
  assert.match(tileLayoutBody, /class="thread-tile-column"/);
  assert.doesNotMatch(tileLayoutBody, /renderThreadTileWindowControls/);
  assert.match(tileLayoutBody, /ensureThreadTileDetails\(ids\)/);
  assert.match(tileLayoutBody, /bindThreadTileActions\(\)/);
  assert.match(tileLayoutBody, /restoreThreadTilePaneScrollState\(scrollState\)/);
  assert.match(tileLayoutBody, /threadTileRenderSignature\(displayLayout, ids\)/);
  assert.match(functionBody(threadTileRuntimeJs, "threadTileRenderSignature"), /threadTileStatePolicy\.paneRenderSignaturePlan/);
  assert.match(functionBody(threadTileRuntimeJs, "threadTileRenderSignature"), /desiredPaneCount: normalizeThreadTilePaneCount\(state\.threadTilePaneCount, 0\)/);
  assert.match(functionBody(threadTileRuntimeJs, "threadTileRenderSignature"), /splitPairs: threadTilePrunedSplitPairs\(ids\)/);
  assert.match(functionBody(threadTileRuntimeJs, "threadTileRenderSignature"), /switchMenuPaneId: state\.threadTileSwitchMenuPaneId \|\| ""/);
  assert.match(functionBody(threadTileRuntimeJs, "threadTileRenderSignature"), /threadSignatures: ids\.map\(\(id\) => conversationRenderSignature\(threadTileDisplayThread\(id\)\)\)/);
  assert.doesNotMatch(appJs, /THREAD_TILE_DETAIL_LOAD_MAX_CONCURRENT = Math\.max\(1, Math\.min\(4, THREAD_TILE_USER_MAX_PANES\)\)/);
  assert.match(appJs, /THREAD_TILE_DETAIL_LOAD_QUEUE_DRAIN_MS = 120/);
  assert.match(appJs, /threadTileDetailLoadQueueTimer: null/);

  const syncActiveBody = functionBody(threadTileRuntimeJs, "syncThreadTileActivePaneState");
  assert.match(syncActiveBody, /threadTileStatePolicy\.activePaneSyncPlan/);
  assert.match(syncActiveBody, /state\.threadTileActiveIds = plan\.activeIds/);
  assert.match(syncActiveBody, /state\.threadTilePinnedIds = normalizeThreadTilePinnedIds\(plan\.paneThreadIds\)/);
  assert.match(syncActiveBody, /state\.threadTileSelectedThreadId = plan\.selectedThreadId/);
  assert.match(syncActiveBody, /if \(plan\.settingsChanged\) scheduleThreadDisplaySettingsSave\(\)/);
  const ensureBody = functionBody(threadTileRuntimeJs, "ensureThreadTileDetails");
  assert.match(ensureBody, /syncThreadTileActivePaneState\(ids\)/);
  assert.match(ensureBody, /threadTileStatePolicy\.detailLoadConcurrencyPlan/);
  assert.match(ensureBody, /threadTileStatePolicy\.detailLoadQueuePlan/);
  assert.match(ensureBody, /controllerIds: Array\.from\(state\.threadTileControllers\.keys\(\)\)/);
  assert.match(ensureBody, /loadingIds: Array\.from\(state\.threadTileLoadingIds\)/);
  assert.match(ensureBody, /const readyIds = state\.threadTileActiveIds\.filter/);
  assert.match(ensureBody, /state\.threadTileDetails\.get\(id\)/);
  assert.match(ensureBody, /readyIds,/);
  assert.match(ensureBody, /maxConcurrentLoads: concurrency\.maxConcurrentLoads/);
  assert.match(ensureBody, /applyThreadTileDetailLoadQueuePlan/);
  assert.doesNotMatch(ensureBody, /syncThreadTilePinnedIdsFromActiveIds/);
  assert.doesNotMatch(ensureBody, /syncThreadTileSelectedThread/);
  assert.doesNotMatch(ensureBody, /state\.threadTileControllers\.delete/);
  assert.match(ensureBody, /scheduleThreadTileRefresh\(\)/);

  const drainBody = functionBody(threadTileRuntimeJs, "scheduleThreadTileDetailLoadQueueDrain");
  assert.match(drainBody, /threadTileStatePolicy\.detailLoadQueueDrainPlan/);
  assert.match(drainBody, /hasTimer: Boolean\(state\.threadTileDetailLoadQueueTimer\)/);
  assert.match(drainBody, /defaultDelayMs: THREAD_TILE_DETAIL_LOAD_QUEUE_DRAIN_MS/);
  assert.match(drainBody, /ensureThreadTileDetails\(state\.threadTileActiveIds\)/);
  assert.match(functionBody(threadTileRuntimeJs, "clearThreadTileDetailLoadQueueTimer"), /clearTimeout\(state\.threadTileDetailLoadQueueTimer\)/);
  assert.match(functionBody(threadTileRuntimeJs, "abortThreadTileLoads"), /clearThreadTileDetailLoadQueueTimer\(\)/);

  const queuePlanBody = functionBody(threadTileRuntimeJs, "applyThreadTileDetailLoadQueuePlan");
  assert.match(queuePlanBody, /plan\.action !== "detail-load-queue"/);
  assert.match(queuePlanBody, /plan\.abortIds/);
  assert.match(queuePlanBody, /controller\.abort\(\)/);
  assert.match(queuePlanBody, /state\.threadTileControllers\.delete\(id\)/);
  assert.match(queuePlanBody, /state\.threadTileLoadingIds\.delete\(id\)/);
  assert.match(queuePlanBody, /plan\.loadIds/);
  assert.match(queuePlanBody, /loadThreadTileDetail\(id\)\.catch\(showError\)/);
  assert.match(queuePlanBody, /plan\.scheduleDrainAfterLoad/);
  assert.doesNotMatch(queuePlanBody, /plan\.deferredIds/);
  assert.match(queuePlanBody, /scheduleThreadTileDetailLoadQueueDrain\(\{ pending: true \}\)/);

  const candidateBody = functionBody(threadTileRuntimeJs, "threadTileCandidateIds");
  assert.match(candidateBody, /threadTileStatePolicy\.candidatePaneIdsPlan/);
  assert.match(candidateBody, /pinnedIds: state\.threadTilePinnedIds/);
  assert.match(candidateBody, /effectiveThreadTilePaneCount\(layout\)/);
  assert.match(candidateBody, /defaultIds: defaultThreadTileCandidateIds\(layout, \{ maxPanes \}\)/);
  assert.match(candidateBody, /visibleIds: Array\.from\(threadTileVisibleIdSet\(\)\)/);
  assert.match(candidateBody, /currentThreadId: state\.currentThreadId/);
  assert.match(candidateBody, /selectPinnedThreadTileIds: threadTileLayoutPolicy\.selectPinnedThreadTileIds/);
  assert.match(candidateBody, /return plan\.ids/);
  assert.match(functionBody(threadTileRuntimeJs, "threadTileMaximumPaneCount"), /threadTilePaneCountState\(layout\)\.maxPaneCount/);
  assert.match(functionBody(threadTileRuntimeJs, "defaultThreadTileCandidateIds"), /THREAD_TILE_USER_MAX_PANES/);

  const loadBody = functionBody(threadTileRuntimeJs, "loadThreadTileDetail");
  assert.match(loadBody, /threadTileStatePolicy\.detailLoadPlan/);
  assert.match(loadBody, /controllerActive: state\.threadTileControllers\.has\(id\)/);
  assert.match(loadBody, /loadingActive: state\.threadTileLoadingIds\.has\(id\)/);
  assert.match(loadBody, /THREAD_TILE_REFRESH_MIN_INTERVAL_MS/);
  assert.match(loadBody, /if \(plan\.action !== "load"\) return;/);
  assert.match(loadBody, /threadTileStatePolicy\.detailLoadStartEffectsPlan\(plan\)/);
  assert.match(loadBody, /applyThreadTileDetailLoadStartEffects/);
  assert.match(loadBody, /threadTileStatePolicy\.detailLoadSuccessEffectsPlan/);
  assert.match(loadBody, /applyThreadTileDetailLoadSuccessEffects/);
  assert.match(loadBody, /threadTileStatePolicy\.detailLoadErrorEffectsPlan/);
  assert.match(loadBody, /applyThreadTileDetailLoadErrorEffects/);
  assert.match(loadBody, /threadTileStatePolicy\.detailLoadFinallyEffectsPlan/);
  assert.match(loadBody, /applyThreadTileDetailLoadFinallyEffects/);
  assert.doesNotMatch(loadBody, /state\.threadTileDetails\.set\(id, result\.thread\)/);
  const loadSuccessBody = functionBody(threadTileRuntimeJs, "applyThreadTileDetailLoadSuccessEffects");
  assert.match(loadSuccessBody, /const existing = state\.threadTileDetails\.get\(id\)/);
  assert.match(loadSuccessBody, /state\.threadTileDetails\.set\(id, mergeThreadPreservingVisibleItems\(existing, thread\)\)/);
  assert.doesNotMatch(loadSuccessBody, /state\.threadTileDetails\.set\(id, thread\)/);
  const finallyEffectsBody = functionBody(threadTileRuntimeJs, "applyThreadTileDetailLoadFinallyEffects");
  assert.match(finallyEffectsBody, /effect\.scheduleQueueDrain/);
  assert.match(finallyEffectsBody, /scheduleThreadTileDetailLoadQueueDrain\(\{ force: true \}\)/);

  const tilePaneBody = functionBody(threadTileRuntimeJs, "renderThreadTilePane");
  assert.match(tilePaneBody, /thread-tile-pane-content/);
  assert.match(tilePaneBody, /draggable="true"/);
  assert.match(tilePaneBody, /data-thread-tile-drag-handle/);
  assert.match(tilePaneBody, /effectiveThreadTileSelectedThreadId\(\)/);
  assert.match(tilePaneBody, /turnTimerStateHtml\(threadTilePaneTimerState\(thread \|\| summary\)\)/);
  assert.match(tilePaneBody, /thread-tile-pane-state-slot/);
  assert.match(tilePaneBody, /data-thread-tile-pane-state/);
  assert.match(tilePaneBody, /data-thread-tile-title/);
  assert.match(tilePaneBody, /renderThreadTileSwitchMenu\(id\)/);
  const switchOptionsBody = functionBody(threadTileRuntimeJs, "threadTileVisibleThreadOptions");
  assert.match(switchOptionsBody, /threadTileStatePolicy\.switchMenuOptionsPlan/);
  assert.match(switchOptionsBody, /activeIds: state\.threadTileActiveIds/);
  assert.match(switchOptionsBody, /runningIds/);
  assert.match(switchOptionsBody, /visibleIds/);
  const switchMenuBody = functionBody(threadTileRuntimeJs, "renderThreadTileSwitchMenu");
  assert.match(switchMenuBody, /threadTileStatePolicy\.switchMenuPlan/);
  assert.match(switchMenuBody, /switchMenuPaneId: state\.threadTileSwitchMenuPaneId/);
  assert.match(switchMenuBody, /if \(plan\.action !== "render-switch-menu"\) return ""/);
  assert.match(switchMenuBody, /thread-tile-switch-actions/);
  assert.match(switchMenuBody, /data-thread-tile-close-pane="\$\{escapeHtml\(plan\.currentId\)\}"/);
  assert.match(switchMenuBody, /data-thread-tile-pane-count="1"/);
  assert.match(switchMenuBody, /plan\.options\.map/);
  assert.match(switchMenuBody, /plan\.canClose/);
  assert.match(switchMenuBody, /plan\.canAdd/);
  assert.match(tilePaneBody, /renderThreadTileOperationDock\(thread, previousKeys\)/);
  assert.match(tilePaneBody, /data-thread-tile-bottom/);
  assert.match(tilePaneBody, /thread-tile-bottom-button hidden/);
  assert.doesNotMatch(tilePaneBody, /data-thread-tile-open/);
  const selectPaneBody = functionBody(threadTileRuntimeJs, "setThreadTileSelectedThread");
  assert.match(selectPaneBody, /threadTileStatePolicy\.selectPanePlan/);
  assert.match(selectPaneBody, /threadTileStatePolicy\.selectedPaneEffectsPlan\(plan/);
  assert.match(selectPaneBody, /applyThreadTileSelectedPaneEffects/);
  assert.doesNotMatch(selectPaneBody, /state\.threadTileSelectedThreadId = plan\.selectedThreadId/);
  const selectedEffectsBody = functionBody(threadTileRuntimeJs, "applyThreadTileSelectedPaneEffects");
  assert.match(selectedEffectsBody, /effect\.action !== "selected-pane-effects"/);
  assert.match(selectedEffectsBody, /state\.threadTileSelectedThreadId = effect\.selectedThreadId/);
  assert.match(selectedEffectsBody, /Array\.isArray\(effect\.patchThreadIds\) \? effect\.patchThreadIds : \[\]/);
  assert.doesNotMatch(selectedEffectsBody, /\[effect\.selectedThreadId\]/);
  assert.match(selectedEffectsBody, /patchThreadTilePane\(id, \{ preserveScroll: effect\.patchPreserveScroll !== false \}\)/);
  assert.match(selectedEffectsBody, /effect\.scheduleFullRenderOnPatchMiss/);

  const tileActionsBody = functionBody(threadTileRuntimeJs, "bindThreadTileActions");
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
  assert.doesNotMatch(tileActionsBody, /toggle-sidebar/);
  assert.doesNotMatch(tileActionsBody, /handleOpenMenuClick\(\)/);
  assert.doesNotMatch(tileActionsBody, /if \(!event\.detail\) toggleThreadTileSwitchMenu/);
  assert.match(tileActionsBody, /replaceThreadTilePaneThread/);
  assert.match(tileActionsBody, /changeThreadTilePaneCount/);
  assert.match(tileActionsBody, /closeThreadTilePane/);
  assert.doesNotMatch(tileActionsBody, /data-thread-tile-open/);
  assert.match(tileActionsBody, /scrollThreadTilePaneToBottom/);
  assert.match(tileActionsBody, /updateThreadTileBottomButtonForBody/);
  assert.match(tileActionsBody, /threadTileStatePolicy\.operationModeTogglePlan/);
  assert.match(tileActionsBody, /applyThreadTileOperationModeTogglePlan/);
  assert.doesNotMatch(tileActionsBody, /state\.threadTileOperationModesById\.set/);
  assert.doesNotMatch(tileActionsBody, /threadTileStatePolicy\.toggleOperationMode/);

  const operationToggleEffectsBody = functionBody(threadTileRuntimeJs, "applyThreadTileOperationModeTogglePlan");
  assert.match(operationToggleEffectsBody, /operation-mode-toggle-effects/);
  assert.match(operationToggleEffectsBody, /state\.threadTileOperationModesById\.set\(id, threadTileStatePolicy\.normalizeOperationMode\(effect\.mode\)\)/);
  assert.match(operationToggleEffectsBody, /setThreadTileSelectedThread\(id, \{ render: effect\.selectPaneRender !== false \}\)/);
  assert.match(operationToggleEffectsBody, /patchThreadTilePane\(effect\.patchThreadId, \{ preserveScroll: effect\.patchPreserveScroll !== false \}\)/);

  const tileTurnBody = functionBody(threadTileRuntimeJs, "renderThreadTileTurn");
  assert.match(tileTurnBody, /withRenderContextThread\(thread/);
  assert.match(tileTurnBody, /renderVisibleItemPatchHtml/);
  assert.doesNotMatch(tileTurnBody, /renderTurn\(/);
  assert.doesNotMatch(tileTurnBody, /turn-status/);
  assert.doesNotMatch(tileTurnBody, /renderThreadTaskCardDraft/);

  const paneSlotEffectsBody = functionBody(threadTileRuntimeJs, "applyThreadTilePaneSlotEffects");
  assert.match(paneSlotEffectsBody, /effect\.action !== "pane-slot-effects"/);
  assert.match(paneSlotEffectsBody, /state\.threadTilePinnedIds = normalizeThreadTilePinnedIds\(effect\.paneThreadIds\)/);
  assert.match(paneSlotEffectsBody, /state\.threadTileSplitPairs = normalizeThreadTileSplitPairs\(effect\.paneSplitPairs, state\.threadTilePinnedIds\)/);
  assert.match(paneSlotEffectsBody, /state\.threadTileActiveIds = threadTileCandidateIds\(layout\)/);
  assert.match(paneSlotEffectsBody, /state\.threadTileSelectedThreadId = effect\.selectedThreadId/);
  assert.match(paneSlotEffectsBody, /effect\.selectionPolicy === "pane-selection"/);
  assert.match(paneSlotEffectsBody, /threadTileStatePolicy\.paneSelectionPlan/);
  assert.match(paneSlotEffectsBody, /scheduleThreadDisplaySettingsSave\(\)/);
  assert.match(paneSlotEffectsBody, /loadThreadTileDetail\(effect\.loadThreadId, \{ force: true, source: effect\.loadSource \|\| "tile-switch" \}\)/);
  assert.match(paneSlotEffectsBody, /effect\.renderMode === "schedule-full"/);
  assert.match(paneSlotEffectsBody, /patchThreadTilePane\(effect\.patchThreadId/);
  assert.match(paneSlotEffectsBody, /effect\.scheduleFullRenderOnPatchMiss/);
  assert.doesNotMatch(paneSlotEffectsBody, /if \(!patched\) scheduleRenderCurrentThread\(\)/);

  const switchBody = functionBody(threadTileRuntimeJs, "replaceThreadTilePaneThread");
  assert.match(switchBody, /threadTileStatePolicy\.replacePaneThreadPlan/);
  assert.match(switchBody, /threadTileStatePolicy\.paneSlotMutationEffectsPlan\(plan/);
  assert.match(switchBody, /applyThreadTilePaneSlotEffects/);

  const moveBody = functionBody(threadTileRuntimeJs, "moveThreadTilePaneRelative");
  assert.match(moveBody, /threadTileStatePolicy\.movePaneRelativePlan/);
  assert.match(moveBody, /threadTileStatePolicy\.paneSlotMutationEffectsPlan\(plan/);
  assert.match(moveBody, /applyThreadTilePaneSlotEffects/);

  const splitBody = functionBody(threadTileRuntimeJs, "splitThreadTilePaneWithTarget");
  assert.match(splitBody, /threadTileStatePolicy\.splitPaneWithTargetPlan/);
  assert.match(splitBody, /threadTileStatePolicy\.paneSlotMutationEffectsPlan\(plan/);
  assert.match(splitBody, /applyThreadTilePaneSlotEffects/);

  const dropBody = functionBody(threadTileRuntimeJs, "dropThreadTilePane");
  assert.match(dropBody, /threadTileStatePolicy\.dropPaneIntent/);
  assert.match(dropBody, /moveThreadTilePaneRelative\(from, to, plan\.placement\)/);
  assert.match(dropBody, /splitThreadTilePaneWithTarget\(from, to, plan\.placement\)/);

  const listOpenReplaceBody = functionBody(threadTileRuntimeJs, "replaceLastThreadTilePaneForThreadListOpen");
  assert.match(listOpenReplaceBody, /source !== "thread-list"/);
  assert.match(listOpenReplaceBody, /const ids = threadTileCandidateIds\(layout\)/);
  assert.match(listOpenReplaceBody, /threadTileStatePolicy\.replaceLastPaneForThreadListOpenPlan/);
  assert.match(listOpenReplaceBody, /threadTileStatePolicy\.paneSlotMutationEffectsPlan\(plan/);
  assert.match(listOpenReplaceBody, /applyThreadTilePaneSlotEffects/);
  assert.doesNotMatch(appJs, /function removeThreadTileSplitPairsForIds\(/);
  assert.doesNotMatch(appJs, /function setThreadTileSplitPair\(/);
  const loadThreadBody = functionBody(appJs, "loadThread");
  assert.match(loadThreadBody, /replaceLastThreadTilePaneForThreadListOpen\(threadId, \{ source \}\)/);

  const tileOperationDockBody = functionBody(threadTileRuntimeJs, "renderThreadTileOperationDock");
  assert.match(tileOperationDockBody, /currentLiveOperationEntry\(thread\)/);
  assert.match(tileOperationDockBody, /threadTileStatePolicy\.operationDockPlan/);
  assert.match(tileOperationDockBody, /data-thread-tile-operation-dock/);
  assert.match(tileOperationDockBody, /data-thread-tile-operation-toggle/);
  assert.match(tileOperationDockBody, /rememberThreadTileOperationBubble/);
  assert.match(tileOperationDockBody, /threadTileStatePolicy\.normalizeOperationMode/);
  assert.match(tileOperationDockBody, /clear-remembered-operation/);
  assert.match(functionBody(threadTileRuntimeJs, "rememberThreadTileOperationBubble"), /threadTileStatePolicy\.operationBubbleRecord/);
  assert.doesNotMatch(appJs, /function recentThreadTileOperationBubble\(/);
  assert.match(functionBody(threadTileRuntimeJs, "threadTileOperationSignature"), /threadTileStatePolicy\.operationSignature/);
  assert.match(functionBody(threadTileRuntimeJs, "threadTileOperationSignature"), /visibleItemSignature\(entry\.item, entry\.turn, thread\)/);
  const operationRefreshBody = functionBody(threadTileRuntimeJs, "scheduleThreadTileOperationMinimumRefresh");
  assert.match(operationRefreshBody, /threadTileStatePolicy\.operationMinimumRefreshPlan/);
  assert.match(operationRefreshBody, /activeIds: state\.threadTileActiveIds/);
  assert.match(operationRefreshBody, /for \(const id of plan\.patchThreadIds \|\| \[\]\)/);
  assert.match(operationRefreshBody, /if \(plan\.fullRenderOnPatchMiss && !patchedAny\) scheduleRenderCurrentThread\(\)/);

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
  const patchPaneBody = functionBody(threadTileRuntimeJs, "patchThreadTilePane");
  assert.match(patchPaneBody, /threadTileStatePolicy\.panePatchPreflightPlan/);
  assert.match(patchPaneBody, /enabled: state\.threadTileMode/);
  assert.match(patchPaneBody, /visible: id \? threadTilePaneIsVisible\(id\) : false/);
  assert.match(patchPaneBody, /conversationPresent: Boolean\(conversation\)/);
  assert.match(patchPaneBody, /tileSurface: Boolean\(conversation && conversation\.classList\.contains\("thread-tile-mode"\)\)/);
  assert.match(patchPaneBody, /boardPresent: Boolean\(board\)/);
  assert.match(patchPaneBody, /layoutEnabled: Boolean\(layout && layout\.enabled\)/);
  assert.match(patchPaneBody, /ids,/);
  assert.match(patchPaneBody, /panePresent: Boolean\(pane\)/);
  assert.match(patchPaneBody, /if \(!preflight\.canPatch\) return false/);
  assert.match(patchPaneBody, /threadTileStatePolicy\.panePatchCompletionPlan/);
  assert.match(patchPaneBody, /sourcePanePresent: Boolean\(sourcePane\)/);
  assert.match(patchPaneBody, /patchedPanePresent: Boolean\(patchedPane\)/);
  assert.match(patchPaneBody, /requestAnimationFrameAvailable: typeof window\.requestAnimationFrame === "function"/);
  assert.match(patchPaneBody, /if \(!completion\.returnValue\) return false/);
  assert.match(patchPaneBody, /if \(completion\.hydrate\) hydrateThreadDetailSurface/);
  assert.match(patchPaneBody, /if \(completion\.restoreScroll\) restoreThreadTilePaneElementScrollState/);
  assert.match(patchPaneBody, /completion\.updateBottomButtonMode === "animation-frame"/);
  assert.match(patchPaneBody, /if \(completion\.writeRenderSignature\)/);
  assert.match(patchPaneBody, /if \(completion\.clearPatchShellSignature\)/);
  assert.match(patchPaneBody, /if \(completion\.bindActions\)/);
  assert.match(patchPaneBody, /return completion\.returnValue/);
  assert.match(appJs, /function scheduleRenderThreadTilePane\(/);
  const schedulePaneBody = functionBody(threadTileRuntimeJs, "scheduleRenderThreadTilePane");
  assert.match(schedulePaneBody, /threadTileStatePolicy\.paneRenderFramePlan/);
  assert.match(schedulePaneBody, /enabled: state\.threadTileMode/);
  assert.match(schedulePaneBody, /visible: id \? threadTilePaneIsVisible\(id\) : false/);
  assert.match(schedulePaneBody, /hasFrame: id \? state\.threadTilePaneRenderFramesById\.has\(id\) : false/);
  assert.match(schedulePaneBody, /if \(plan\.action === "skip" \|\| !plan\.returnValue\) return false/);
  assert.match(schedulePaneBody, /if \(!plan\.scheduleFrame\) return true/);
  assert.match(schedulePaneBody, /if \(!patchThreadTilePane\(id, options\) && plan\.fullRenderOnPatchMiss\) scheduleRenderCurrentThread\(\)/);
  assert.match(appJs, /function rememberThreadTilePaneScrollPosition\(/);
  assert.match(functionBody(threadTileRuntimeJs, "scheduleThreadTileRefresh"), /threadTileStatePolicy\.refreshSchedulePlan/);
  assert.match(functionBody(threadTileRuntimeJs, "refreshThreadTileDetails"), /threadTileStatePolicy\.refreshTargetIds/);
  assert.match(functionBody(threadTileRuntimeJs, "refreshThreadTileDetails"), /loadedAtById: state\.threadTileLoadedAtById/);
  assert.match(functionBody(threadTileRuntimeJs, "refreshThreadTileDetails"), /nowMs: Date\.now\(\)/);
  assert.match(functionBody(threadTileRuntimeJs, "captureThreadTilePaneScrollState"), /threadTileStatePolicy\.paneScrollMetrics/);
  assert.match(functionBody(threadTileRuntimeJs, "captureThreadTilePaneElementScrollState"), /threadTileStatePolicy\.paneScrollMetrics/);
  assert.match(functionBody(threadTileRuntimeJs, "rememberThreadTilePaneScrollPosition"), /threadTileStatePolicy\.paneScrollHoldPlan/);
  assert.match(functionBody(threadTileRuntimeJs, "applyThreadTilePaneScrollHoldPlan"), /state\.threadTilePaneScrollHoldById\.set\(threadId, true\)/);
  assert.match(functionBody(threadTileRuntimeJs, "applyThreadTilePaneScrollHoldPlan"), /state\.threadTilePaneScrollHoldById\.delete\(threadId\)/);
  assert.match(functionBody(threadTileRuntimeJs, "updateThreadTileBottomButtonForBody"), /threadTileStatePolicy\.paneBottomButtonPlan/);
  assert.match(functionBody(threadTileRuntimeJs, "restoreThreadTilePaneElementScrollState"), /threadTileStatePolicy\.paneScrollRestorePlan/);
  assert.match(functionBody(threadTileRuntimeJs, "toggleThreadTileSwitchMenu"), /patchThreadTilePane\(id, \{ preserveScroll: true \}\)/);
  assert.match(functionBody(threadTileRuntimeJs, "applyThreadTileDetailLoadFinallyEffects"), /scheduleRenderThreadTilePane\(id, \{ preserveScroll: effect\.preserveScroll !== false \}\)/);
  assert.match(functionBody(threadTileRuntimeJs, "applyThreadTileSelectedPaneEffects"), /patchThreadTilePane\(id, \{ preserveScroll: effect\.patchPreserveScroll !== false \}\)/);
  assert.match(appJs, /if \(state\.threadTileMode && !isThreadTileKeyboardFocusActive\(\)\) scheduleRenderCurrentThread\(\)/);
  assert.match(functionBody(appJs, "updateTurnTimer"), /applyTurnTimerState\(el, currentThreadTurnTimerState\(\)\)/);
  assert.match(functionBody(threadTileRuntimeJs, "updateThreadTilePaneStatusBadges"), /turnTimerStateHtml\(threadTilePaneTimerState\(threadTileDisplayThread\(id\)\)\)/);
  assert.match(stylesCss, /\.conversation\.thread-tile-mode\s*{/);
  assert.match(stylesCss, /html\.embed-hermes\.thread-tile-open\.keyboard-open \.app\s*{[\s\S]*transform:\s*none;/);
  assert.match(stylesCss, /\.main\.thread-tile-main\s*{[\s\S]*--thread-tile-edge-gap:\s*8px;/);
  assert.match(stylesCss, /\.main\.thread-tile-main \.topbar\s*{/);
  assert.match(stylesCss, /\.main\.thread-tile-main > \.live-operation-dock\s*{/);
  assert.match(stylesCss, /\.conversation\.thread-tile-mode\s*{[\s\S]*padding:\s*calc\(var\(--thread-tile-edge-gap\) \+ max\(env\(safe-area-inset-top, 0px\), var\(--host-top-safe-area, 0px\)\)\) var\(--thread-tile-edge-gap\) var\(--thread-tile-edge-gap\);/);
  assert.match(stylesCss, /\.main\.thread-tile-main > \.composer\s*{[\s\S]*margin:\s*0 var\(--thread-tile-edge-gap\) var\(--thread-tile-edge-gap\);[\s\S]*border-radius:\s*8px;/);
  assert.match(stylesCss, /\.main\.thread-tile-main > \.composer\.has-target-indicator\s*{[\s\S]*border-color:\s*var\(--thread-identity-ring-strong\);[\s\S]*box-shadow:\s*0 0 0 1px var\(--thread-identity-ring\)/);
  assert.match(stylesCss, /\.thread-tile-board\s*{/);
  assert.doesNotMatch(stylesCss, /\.thread-tile-board-sidebar-toggle/);
  assert.match(stylesCss, /html\.sidebar-layout-toggle-supported \.main\.thread-tile-main #openMenu\.sidebar-toggle-visible\s*{[\s\S]*pointer-events:\s*auto;[\s\S]*background:\s*transparent;/);
  assert.match(stylesCss, /html\.sidebar-layout-toggle-supported\.sidebar-open \.main\.thread-tile-main #openMenu\.sidebar-toggle-visible\s*{[\s\S]*display:\s*none;[\s\S]*pointer-events:\s*none;/);
  assert.match(stylesCss, /html\.sidebar-layout-toggle-supported\.sidebar-overlay-mode:not\(\.sidebar-open\) \.thread-tile-board \.thread-tile-column:first-child \.thread-tile-pane:first-child \.thread-tile-pane-header\s*{[\s\S]*padding-left:\s*48px;/);
  assert.match(stylesCss, /\.thread-tile-column\s*{/);
  assert.match(stylesCss, /grid-template-rows:\s*repeat\(var\(--thread-tile-column-rows, 1\), minmax\(0, 1fr\)\);/);
  assert.match(stylesCss, /\.thread-tile-pane\.drag-over\s*{/);
  assert.match(stylesCss, /\.thread-tile-switch-actions\s*{/);
  assert.match(stylesCss, /\.thread-tile-switch-action\s*{/);
  assert.doesNotMatch(stylesCss, /\.thread-tile-window-controls\s*{/);
  assert.match(stylesCss, /\.thread-tile-pane\s*{/);
  assert.match(stylesCss, /\.thread-tile-pane-header\s*{[\s\S]*background:\s*linear-gradient\(0deg, var\(--thread-identity-tint\), var\(--thread-identity-tint\)\), var\(--thread-tile-header-bg\);/);
  assert.match(stylesCss, /\.thread-tile-pane\.active \.thread-tile-pane-header\s*{[\s\S]*background:\s*linear-gradient\(0deg, var\(--thread-identity-tint-active\), var\(--thread-identity-tint-active\)\), var\(--thread-tile-header-active-bg\);/);
  assert.match(stylesCss, /\.message-input\.has-target-placeholder:empty::before\s*{[\s\S]*color:\s*var\(--composer-target-placeholder\);/);
  assert.match(stylesCss, /\.thread-tile-pane-body\s*{/);
  assert.match(stylesCss, /\.thread-tile-pane-content\s*{/);
  assert.match(stylesCss, /\.thread-tile-pane-state\s*{/);
  assert.match(stylesCss, /\.thread-tile-switch-menu\s*{/);
  assert.match(stylesCss, /\.thread-tile-operation-dock\s*{/);
  assert.match(stylesCss, /\.thread-tile-operation-dock \.mobile-operation-stack\s*{/);
  assert.match(stylesCss, /\.thread-tile-bottom-button\s*{/);
  assert.match(stylesCss, /\.thread-tile-composer-direction\s*{[\s\S]*width:\s*16px;[\s\S]*height:\s*16px;[\s\S]*color:\s*var\(--thread-identity-label\);/);
  assert.match(stylesCss, /\.thread-tile-composer-direction span\s*{[\s\S]*width:\s*6px;[\s\S]*height:\s*6px;[\s\S]*animation:\s*thread-tile-composer-direction-pulse 1650ms ease-in-out infinite;/);
  assert.match(stylesCss, /@keyframes thread-tile-composer-direction-pulse\s*{[\s\S]*opacity:\s*0\.72;[\s\S]*translateY\(calc\(var\(--thread-tile-composer-direction-y\) - 1px\)\)/);
  assert.match(stylesCss, /@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*\.thread-tile-composer-direction span\s*{[\s\S]*animation:\s*none;/);

  const notificationBody = functionBody(appJs, "applyNotification");
  assert.match(notificationBody, /threadTilePaneIsVisible\(params\.threadId\)/);
  assert.match(notificationBody, /loadThreadTileDetail\(params\.threadId, \{ force: true, background: true/);

  const refreshBody = functionBody(appJs, "refreshCurrentThread");
  assert.match(refreshBody, /const patchSurfaceProbeStage = threadDetailRenderPlanApi\.planThreadDetailRefreshPatchSurfaceProbeStage\(\{/);
  assert.match(refreshBody, /shouldRenderDetail,[\s\S]*threadTileMode: state\.threadTileMode,[\s\S]*threadTileConversationSurface,[\s\S]*threadId,/);
  assert.match(refreshBody, /const tilePatchPlan = applyThreadDetailRefreshPatchSurfaceProbeEffectsPlan\([\s\S]*patchSurfaceProbeStage\.patchSurfaceProbeEffectsPlan,[\s\S]*\{ threadId \},[\s\S]*\);/);
  assert.match(appJs, /function applyThreadDetailRefreshPatchSurfaceProbeEffectsPlan\(plan, context = \{\}\)/);
  assert.match(functionBody(appJs, "applyThreadDetailRefreshPatchSurfaceProbeEffect"), /threadDetailDomPatchSurface\(\{[\s\S]*threadId: String\(item\.threadId \|\| context\.threadId \|\| ""\),[\s\S]*\}\);/);
  assert.doesNotMatch(refreshBody, /patchSurfaceProbePlan\.shouldProbeTilePatchSurface[\s\S]*\? threadDetailDomPatchSurface/);
  assert.doesNotMatch(refreshBody, /planThreadDetailRefreshPatchSurface\(\{/);
  assert.doesNotMatch(refreshBody, /planThreadDetailRefreshPatchSurfaceProbeEffects\(\{/);
  assert.match(refreshBody, /const patchSurfaceExecutionStage = threadDetailRenderPlanApi\.planThreadDetailRefreshPatchSurfaceExecutionStage\(\{[\s\S]*shouldRenderDetail,[\s\S]*renderPlan,[\s\S]*threadTileMode: state\.threadTileMode,[\s\S]*threadTileConversationSurface,[\s\S]*tilePatchPlan,[\s\S]*\}\);/);
  assert.doesNotMatch(refreshBody, /planThreadDetailRefreshPatchSurfaceResultStage\(\{/);
  assert.doesNotMatch(refreshBody, /planThreadDetailRefreshPatchExecutionStage\(\{/);
  assert.doesNotMatch(refreshBody, /const patchExecutionPlan = patchExecutionStage\.patchExecutionPlan;/);
  assert.match(refreshBody, /const patchAttemptEffectsPlan = patchSurfaceExecutionStage\.patchAttemptEffectsPlan;/);
  assert.doesNotMatch(refreshBody, /canPatch: renderPlan\.canPatch/);
  assert.doesNotMatch(refreshBody, /tileSurfaceRefresh: patchSurfacePlan\.tileSurfaceRefresh/);
  assert.match(refreshBody, /const patchAttempt = applyThreadDetailRefreshPatchAttemptEffectsPlan\(patchAttemptEffectsPlan, \{/);
  assert.match(refreshBody, /const patchAttemptResultEvidenceStage = threadDetailRenderPlanApi\.planThreadDetailRefreshPatchAttemptResultEvidenceStage\(\{/);
  assert.doesNotMatch(refreshBody, /let patchAttemptResultStage = patchAttemptResultEvidenceStage\.patchAttemptResultStage;/);
  assert.match(refreshBody, /const patchRejectedVisibleShapeEvidence = applyThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffectsPlan\([\s\S]*patchAttemptResultEvidenceStage\.visibleShapeEvidenceEffectsPlan,[\s\S]*previousThread,[\s\S]*nextThread: state\.currentThread,[\s\S]*\);/);
  assert.match(refreshBody, /const patchAttemptResultResolutionStage = threadDetailRenderPlanApi\.planThreadDetailRefreshPatchAttemptResultEvidenceResolutionStage\(\{/);
  assert.match(refreshBody, /patchAttemptResultStage: patchAttemptResultEvidenceStage\.patchAttemptResultStage,[\s\S]*visibleShapeEvidence: patchRejectedVisibleShapeEvidence,/);
  assert.match(refreshBody, /const patchAttemptResultStage = patchAttemptResultResolutionStage\.patchAttemptResultStage;/);
  assert.doesNotMatch(refreshBody, /if \(patchRejectedVisibleShapeEvidence\.collected\)/);
  assert.doesNotMatch(refreshBody, /planThreadDetailRefreshPatchAttemptResultEvidenceCompletionStage\(\{/);
  assert.match(refreshBody, /applyThreadDetailRefreshPatchRejectedDiagnosticEffectsPlan\(patchAttemptResultStage\.patchRejectedDiagnosticEffectsPlan\);/);
  assert.match(appJs, /function applyThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffectsPlan\(plan, context = \{\}\)/);
  assert.match(functionBody(appJs, "applyThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffect"), /previousVisibleShape: visibleConversationShape\(context\.previousThread\)/);
  assert.match(functionBody(appJs, "applyThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffect"), /nextVisibleShape: visibleConversationShape\(context\.nextThread\)/);
  assert.doesNotMatch(refreshBody, /previousVisibleShape: visibleConversationShape\(previousThread\)/);
  assert.doesNotMatch(refreshBody, /nextVisibleShape: visibleConversationShape\(state\.currentThread\)/);
  assert.doesNotMatch(refreshBody, /threadDetailRenderPlanApi\.planThreadDetailRefreshPatchAttemptResultStage\(\{/);
  assert.doesNotMatch(refreshBody, /threadDetailRenderPlanApi\.planThreadDetailRefreshPatchAttemptResult\(\{/);
  assert.doesNotMatch(refreshBody, /if \(shouldRenderDetail && !tilePanePatchedDetail && patchExecutionPlan\.tryLocalPatch\)/);
  assert.doesNotMatch(refreshBody, /renderPlan\.canPatch && !tileSurfaceRefresh/);
  assert.doesNotMatch(refreshBody, /tilePatchPlan && tilePatchPlan\.surface === "thread-tile-pane"/);
});

test("thread tile visual fixture validates wide-screen panes without private content", () => {
  const wideModel = threadTileVisualFixture.buildTileFixtureModel({
    width: 3000,
    height: 1500,
    panes: 5,
    menuOverlay: false,
    sidebarWidth: 0,
  });
  assert.equal(wideModel.layout.enabled, true);
  assert.equal(wideModel.layout.reason, "wide");
  assert.equal(wideModel.expectedSingleRow, true);
  assert.equal(wideModel.displayLayout.visiblePanes, 5);
  assert.equal(wideModel.displayLayout.columns, 5);
  assert.equal(wideModel.displayLayout.rows, 1);
  assert.deepEqual(wideModel.displayLayout.columnGroups, [["pane-a"], ["pane-b"], ["pane-c"], ["pane-d"], ["pane-e"]]);

  const overlayModel = threadTileVisualFixture.buildTileFixtureModel({
    width: 3000,
    height: 1500,
    panes: 5,
    menuOverlay: true,
  });
  assert.equal(overlayModel.layout.enabled, true);
  assert.equal(overlayModel.layout.reason, "tablet-landscape");
  assert.equal(overlayModel.expectedOverflowSplit, true);
  assert.equal(overlayModel.displayLayout.visiblePanes, 5);
  assert.equal(overlayModel.displayLayout.columns, 4);
  assert.equal(overlayModel.displayLayout.rows, 2);
  assert.equal(overlayModel.displayLayout.columnGroups.filter((group) => group.length > 1).length, 1);

  assert.equal(threadTileVisualFixture.parseArgs(["--width", "2600", "--panes", "6", "--font-size", "xxlarge"]).panes, 6);
  assert.equal(threadTileVisualFixture.parseArgs(["--keyboard", "--typed-lines", "4"]).keyboard, true);
  assert.equal(threadTileVisualFixture.parseArgs(["--keyboard", "--typed-lines", "4"]).typedLines, 4);
  assert.equal(threadTileVisualFixture.parseArgs(["--task-card", "collapsed"]).taskCard, "collapsed");
  assert.equal(threadTileVisualFixture.parseArgs(["--task-card", "expanded"]).taskCard, "expanded");
  assert.equal(threadTileVisualFixture.parseArgs(["--task-card", "unknown"]).taskCard, "none");
  assert.deepEqual(threadTileVisualFixture.parseArgs(["--split", "pane-b:pane-e"]).splits, [{ anchorId: "pane-b", childId: "pane-e" }]);
  assert.equal(threadTileVisualFixture.composerInputHeightPx(4), 110);
  assert.equal(threadTileVisualFixture.composerHeightPx(4), 158);
  assert.equal(threadTileVisualFixture.typedComposerText(2), "fixture composer input line 1\nfixture composer input line 2");
  const html = threadTileVisualFixture.fixtureHtml(stylesCss, {
    width: 3000,
    height: 1500,
    panes: 5,
    menuOverlay: false,
  });
  assert.match(html, /thread-tile-board/);
  assert.doesNotMatch(threadTileRuntimeJs, /data-thread-tile-sidebar-toggle/);
  assert.match(html, /thread-tile-operation-dock/);
  assert.match(html, /mobile-operation-bubble-duration/);
  assert.match(html, /composer-control-card/);
  assert.match(html, /durationVisible/);
  assert.match(html, /hiddenBottomButtons/);
  assert.doesNotMatch(html, /accessKey|cookie|launchToken|taskBody|rawPrompt|providerPayload|uploadBytes/);
  assert.match(stylesCss, /\.thread-tile-pane \.thread-task-card-message-body\s*{[\s\S]*max-height:\s*min\(34vh,\s*300px\);/);

  const collapsedTaskCardHtml = threadTileVisualFixture.fixtureHtml(stylesCss, {
    width: 2200,
    height: 1200,
    panes: 4,
    taskCard: "collapsed",
  });
  assert.match(collapsedTaskCardHtml, /data-thread-task-card-message/);
  assert.match(collapsedTaskCardHtml, /thread-task-card-injected/);
  assert.match(collapsedTaskCardHtml, /Fixture Source Thread/);
  assert.match(collapsedTaskCardHtml, /taskCardInsidePane/);
  assert.match(collapsedTaskCardHtml, /taskCardSummaryVisible/);
  assert.match(collapsedTaskCardHtml, /taskCardNoComposerOverlap/);
  assert.doesNotMatch(collapsedTaskCardHtml, /data-thread-task-card-message open/);
  assert.doesNotMatch(collapsedTaskCardHtml, /accessKey|cookie|launchToken|taskBody|rawPrompt|providerPayload|uploadBytes/);

  const expandedTaskCardHtml = threadTileVisualFixture.fixtureHtml(stylesCss, {
    width: 2200,
    height: 1200,
    panes: 4,
    taskCard: "expanded",
  });
  assert.match(expandedTaskCardHtml, /data-thread-task-card-message open/);
  assert.match(expandedTaskCardHtml, /taskCardBodyScrollBounded/);
  assert.match(expandedTaskCardHtml, /bounded fixture line 36/);
  assert.doesNotMatch(threadTileVisualFixture.taskCardFixtureText(), /accessKey|cookie|launchToken|taskBody|rawPrompt|providerPayload|uploadBytes/);

  const keyboardHtml = threadTileVisualFixture.fixtureHtml(stylesCss, {
    width: 1800,
    height: 920,
    panes: 3,
    menuOverlay: false,
    keyboard: true,
    typedLines: 4,
  });
  assert.match(keyboardHtml, /thread-tile-open keyboard-open/);
  assert.match(keyboardHtml, /fixture composer input line 4/);
  assert.match(keyboardHtml, /appTransformStable/);
  assert.match(keyboardHtml, /typedInputStable/);
  assert.match(keyboardHtml, /inputInsideComposer/);
  assert.match(keyboardHtml, /--composer-height:158px/);

  assert.match(packageJson, /scripts\/codex-mobile-thread-tile-visual-fixture\.js/);
});

test("thread tile composer targets the active pane without replacing the shared composer", () => {
  const currentDraftKeyBody = functionBody(appJs, "currentDraftKey");
  assert.match(currentDraftKeyBody, /currentComposerThreadId\(\)/);

  const targetIdBody = functionBody(appJs, "currentComposerThreadId");
  assert.match(targetIdBody, /composerTargetPlan\(\)\.targetThreadId/);

  const targetPlanBody = functionBody(appJs, "composerTargetPlan");
  assert.match(targetPlanBody, /threadTileStatePolicy\.composerTargetPlan/);
  assert.match(targetPlanBody, /tileSurfaceActive: threadTileComposerSurfaceActive\(\)/);
  assert.match(targetPlanBody, /selectedThreadId: state\.threadTileSelectedThreadId/);
  assert.match(targetPlanBody, /currentThreadId: state\.currentThreadId/);

  const tileComposerContextBody = functionBody(appJs, "isThreadTileComposerContext");
  assert.match(tileComposerContextBody, /composerTargetPlan\(\)\.tileContext === true/);
  assert.match(functionBody(appJs, "threadTileComposerSurfaceActive"), /conversation\.classList\.contains\("thread-tile-mode"\)/);

  const placeholderBody = functionBody(composerRuntimeJs, "composerPlaceholderText");
  assert.match(placeholderBody, /const targetThreadId = currentComposerThreadId\(\)/);
  assert.match(placeholderBody, /const targetThread = composerTargetThread\(\)/);
  assert.match(placeholderBody, /threadTileStatePolicy\.composerTargetPlaceholderPlan/);
  assert.match(placeholderBody, /targetTitle: targetThread \? threadDisplayName\(targetThread\) : ""/);
  assert.match(composerRuntimeJs, /function composerShowsTargetPlaceholder\(\)/);
  assert.match(functionBody(composerRuntimeJs, "composerShowsTargetPlaceholder"), /threadTileStatePolicy\.composerTargetPlaceholderPlan/);
  assert.match(functionBody(composerRuntimeJs, "composerShowsTargetPlaceholder"), /showTargetPlaceholder === true/);

  const updateControlsBody = functionBody(composerRuntimeJs, "updateComposerControls");
  assert.match(updateControlsBody, /const targetThreadId = currentComposerThreadId\(\)/);
  assert.match(updateControlsBody, /const targetActiveTurnId = composerTargetActiveTurnId\(\)/);
  assert.match(updateControlsBody, /threadTileStatePolicy\.composerActionControlPlan\(\{/);
  assert.match(updateControlsBody, /hasNewThreadDraft,/);
  assert.match(updateControlsBody, /targetActiveTurnId,/);
  assert.match(updateControlsBody, /applyComposerActionControlPlan\(sendButton, composerActionPlan\)/);
  assert.match(updateControlsBody, /messageInput\.dataset\.placeholder = composerPlaceholderText\(\);/);
  assert.match(updateControlsBody, /messageInput\.classList\.toggle\("has-target-placeholder", composerShowsTargetPlaceholder\(\)\);/);
  assert.match(functionBody(composerRuntimeJs, "renderComposerTargetIndicator"), /applyThreadIdentityColorVariables\(composer, visible \? plan\.cssVariables : \{\}\)/);
  assert.match(functionBody(composerRuntimeJs, "renderComposerTargetIndicator"), /visibleIds: state\.threadTileActiveIds/);
  assert.match(functionBody(threadTileRuntimeJs, "renderThreadTilePane"), /visiblePaneIds = threadTileStatePolicy\.uniqueIds/);
  assert.match(functionBody(threadTileRuntimeJs, "renderThreadTilePane"), /threadTileStatePolicy\.threadIdentityColorPlan\(\{ threadId: id, visibleIds: visiblePaneIds \}\)/);
  assert.match(functionBody(threadTileRuntimeJs, "renderThreadTilePane"), /style="\$\{escapeHtml\(identityStyle\)\}"/);

  const sendMessageBody = functionBody(composerRuntimeJs, "sendMessage");
  assert.match(sendMessageBody, /const targetThreadId = currentComposerThreadId\(\)/);
  assert.match(sendMessageBody, /openThreadGoalDialog\(targetThreadId\)/);
  assert.match(sendMessageBody, /interruptActiveTurn\(targetThreadId, targetActiveTurnId\)/);
  assert.match(sendMessageBody, /insertLocalSubmittedUserMessage\(targetThreadId/);
  assert.match(sendMessageBody, /api\(`\/api\/threads\/\$\{encodeURIComponent\(targetThreadId\)\}\/messages`/);
  assert.match(sendMessageBody, /scheduleComposerTargetRefresh\(targetThreadId/);

  const taskCardBody = functionBody(composerRuntimeJs, "sendThreadTaskCardCommand");
  assert.match(taskCardBody, /const targetThreadId = currentComposerThreadId\(\)/);
  assert.match(taskCardBody, /buildThreadTaskCardDraftRequestText\(text, targetThread\)/);
  assert.match(taskCardBody, /api\(`\/api\/threads\/\$\{encodeURIComponent\(targetThreadId\)\}\/messages`/);
});
