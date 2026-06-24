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
  assert.match(renderCurrentThreadBody, /renderThreadTileLayout\(tileLayout, options\)/);

  const tileLayoutBody = functionBody(appJs, "renderThreadTileLayout");
  assert.match(tileLayoutBody, /ensureThreadTileDetails\(ids\)/);
  assert.match(tileLayoutBody, /bindThreadTileActions\(\)/);
  assert.match(tileLayoutBody, /view: "thread-tiles"/);

  const tileTurnBody = functionBody(appJs, "renderThreadTileTurn");
  assert.match(tileTurnBody, /renderVisibleItemPatchHtml/);
  assert.doesNotMatch(tileTurnBody, /renderTurn\(/);
  assert.doesNotMatch(tileTurnBody, /renderThreadTaskCardDraft/);

  assert.match(stylesCss, /\.conversation\.thread-tile-mode\s*{/);
  assert.match(stylesCss, /\.thread-tile-board\s*{/);
  assert.match(stylesCss, /\.thread-tile-pane\s*{/);
  assert.match(stylesCss, /\.thread-tile-pane-body\s*{/);
});
