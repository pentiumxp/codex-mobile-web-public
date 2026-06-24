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
  assert.match(indexHtml, /<script src="\/thread-detail-state\.js"><\/script>\s*\n\s*<script src="\/thread-tile-layout\.js"><\/script>\s*\n\s*<script src="\/build-refresh-policy\.js"><\/script>/);
  assert.match(appJs, /const threadTileLayoutPolicy = window\.CodexThreadTileLayout/);
  assert.match(appJs, /threadTileMode: localStorage\.getItem\("codexMobileThreadDisplayMode"\) === "tile"/);
  assert.match(appJs, /threadTileActiveIds: \[\]/);
  assert.match(appJs, /threadTilePinnedIds: \[\]/);
  assert.match(appJs, /threadTileSelectedThreadId: ""/);
  assert.match(appJs, /threadTileSwitchMenuPaneId: ""/);
  assert.match(appJs, /threadTileRefreshTimer: null/);
  assert.match(appJs, /threadTileOperationModesById: new Map\(\)/);
  assert.match(appJs, /THREAD_TILE_REFRESH_INTERVAL_MS/);
  assert.match(appJs, /STORAGE_LEGACY_THREAD_TILE_MODE = "codexMobileThreadTileMode"/);

  const layoutBody = functionBody(appJs, "threadTileLayout");
  assert.match(layoutBody, /const sidebarSplitVisible = splitPaneSidebarVisible\(\)/);
  assert.match(layoutBody, /const menuOverlay = isMenuOverlayMode\(\) \|\| !sidebarSplitVisible/);
  assert.match(layoutBody, /threadTileLayoutPolicy\.layoutForViewport/);
  assert.match(layoutBody, /coarsePointer: isCoarsePointerViewport\(\)/);
  assert.match(layoutBody, /menuOverlay,/);
  assert.match(layoutBody, /verticalChromePx:/);

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
  assert.match(tileLayoutBody, /ensureThreadTileDetails\(ids\)/);
  assert.match(tileLayoutBody, /bindThreadTileActions\(\)/);
  assert.match(tileLayoutBody, /restoreThreadTilePaneScrollState\(scrollState\)/);
  assert.match(tileLayoutBody, /view: "thread-tiles"/);

  const ensureBody = functionBody(appJs, "ensureThreadTileDetails");
  assert.match(ensureBody, /state\.threadTileActiveIds = Array\.from\(activeIds\)/);
  assert.match(ensureBody, /syncThreadTileSelectedThread\(state\.threadTileActiveIds\)/);
  assert.match(ensureBody, /scheduleThreadTileRefresh\(\)/);

  const candidateBody = functionBody(appJs, "threadTileCandidateIds");
  assert.match(candidateBody, /state\.threadTilePinnedIds/);
  assert.match(candidateBody, /defaultThreadTileCandidateIds\(layout\)/);

  const loadBody = functionBody(appJs, "loadThreadTileDetail");
  assert.match(loadBody, /const force = options\.force === true/);
  assert.match(loadBody, /state\.threadTileControllers\.has\(id\)/);
  assert.match(loadBody, /THREAD_TILE_REFRESH_MIN_INTERVAL_MS/);
  assert.match(loadBody, /state\.threadTileDetails\.set\(id, result\.thread\)/);

  const tilePaneBody = functionBody(appJs, "renderThreadTilePane");
  assert.match(tilePaneBody, /thread-tile-pane-content/);
  assert.match(tilePaneBody, /effectiveThreadTileSelectedThreadId\(\)/);
  assert.match(tilePaneBody, /thread-tile-pane-state/);
  assert.match(tilePaneBody, /data-thread-tile-title/);
  assert.match(tilePaneBody, /renderThreadTileSwitchMenu\(id\)/);
  assert.match(tilePaneBody, /renderThreadTileOperationDock\(thread, previousKeys\)/);
  assert.match(tilePaneBody, /data-thread-tile-bottom/);
  assert.match(tilePaneBody, /thread-tile-bottom-button hidden/);
  assert.doesNotMatch(tilePaneBody, /data-thread-tile-open/);

  const tileActionsBody = functionBody(appJs, "bindThreadTileActions");
  assert.match(tileActionsBody, /data-thread-tile-pane/);
  assert.match(tileActionsBody, /setThreadTileSelectedThread/);
  assert.match(tileActionsBody, /data-thread-tile-title/);
  assert.match(tileActionsBody, /data-thread-tile-switch-target/);
  assert.match(tileActionsBody, /replaceThreadTilePaneThread/);
  assert.doesNotMatch(tileActionsBody, /data-thread-tile-open/);
  assert.match(tileActionsBody, /data-thread-tile-bottom/);
  assert.match(tileActionsBody, /scrollThreadTilePaneToBottom/);
  assert.match(tileActionsBody, /updateThreadTileBottomButtonForBody/);
  assert.match(tileActionsBody, /data-thread-tile-operation-toggle/);

  const tileTurnBody = functionBody(appJs, "renderThreadTileTurn");
  assert.match(tileTurnBody, /state\.renderContextThreadId/);
  assert.match(tileTurnBody, /renderVisibleItemPatchHtml/);
  assert.doesNotMatch(tileTurnBody, /renderTurn\(/);
  assert.doesNotMatch(tileTurnBody, /turn-status/);
  assert.doesNotMatch(tileTurnBody, /renderThreadTaskCardDraft/);

  const switchBody = functionBody(appJs, "replaceThreadTilePaneThread");
  assert.match(switchBody, /state\.threadTilePinnedIds = nextIds/);
  assert.match(switchBody, /state\.threadTileSelectedThreadId = to/);
  assert.match(switchBody, /loadThreadTileDetail\(to, \{ force: true, source: "tile-switch" \}\)/);

  const tileOperationDockBody = functionBody(appJs, "renderThreadTileOperationDock");
  assert.match(tileOperationDockBody, /currentLiveOperationEntry\(thread\)/);
  assert.match(tileOperationDockBody, /data-thread-tile-operation-dock/);
  assert.match(tileOperationDockBody, /data-thread-tile-operation-toggle/);
  assert.match(tileOperationDockBody, /rememberThreadTileOperationBubble/);

  const clearGlobalDockBody = functionBody(appJs, "clearGlobalLiveOperationDockForThreadTiles");
  assert.match(clearGlobalDockBody, /state\.liveOperationDockPinned = false/);
  assert.match(clearGlobalDockBody, /state\.liveOperationDockRecallHtml = ""/);
  assert.match(clearGlobalDockBody, /dock\.hidden = true/);
  assert.match(functionBody(appJs, "renderCurrentThread"), /if \(tileLayout\.enabled\) \{\s*clearGlobalLiveOperationDockForThreadTiles\(\)/);

  const mobileOperationBody = functionBody(appJs, "renderMobileOperationStack");
  assert.match(mobileOperationBody, /options\.toggleAttribute/);

  assert.match(stylesCss, /\.conversation\.thread-tile-mode\s*{/);
  assert.match(stylesCss, /\.main\.thread-tile-main \.topbar\s*{/);
  assert.match(stylesCss, /\.thread-tile-board\s*{/);
  assert.match(stylesCss, /\.thread-tile-pane\s*{/);
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
});

test("thread tile composer targets the active pane without replacing the shared composer", () => {
  const currentDraftKeyBody = functionBody(appJs, "currentDraftKey");
  assert.match(currentDraftKeyBody, /currentComposerThreadId\(\)/);

  const targetIdBody = functionBody(appJs, "currentComposerThreadId");
  assert.match(targetIdBody, /effectiveThreadTileSelectedThreadId\(\) \|\| state\.currentThreadId/);

  const updateControlsBody = functionBody(appJs, "updateComposerControls");
  assert.match(updateControlsBody, /const targetThreadId = currentComposerThreadId\(\)/);
  assert.match(updateControlsBody, /const targetActiveTurnId = composerTargetActiveTurnId\(\)/);
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
