"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");
const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");
const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");
const swJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "sw.js"), "utf8");
const viewportMetricsJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "viewport-metrics.js"), "utf8");

test("mobile viewport and early guards disable page zoom", () => {
  assert.match(indexHtml, /name="viewport" content="[^"]*maximum-scale=1/);
  assert.match(indexHtml, /name="viewport" content="[^"]*minimum-scale=1/);
  assert.match(indexHtml, /name="viewport" content="[^"]*user-scalable=no/);
  assert.match(indexHtml, /addEventListener\("gesturestart", preventZoom, \{ passive: false \}\)/);
  assert.match(indexHtml, /addEventListener\("gesturechange", preventZoom, \{ passive: false \}\)/);
  assert.match(indexHtml, /addEventListener\("dblclick", preventZoom, \{ passive: false \}\)/);
  assert.match(indexHtml, /lastTouchEndAt < 320/);
  assert.match(indexHtml, /<script src="\/viewport-metrics\.js"><\/script>/);
  assert.match(indexHtml, /<script src="\/conversation-scroll\.js"><\/script>/);
  assert.match(indexHtml, /<script src="\/image-compressor\.js"><\/script>/);
  assert.match(indexHtml, /<script src="\/plugin-embed\.js"><\/script>/);
  assert.match(appJs, /const viewportMetrics = window\.CodexViewportMetrics/);
  assert.match(appJs, /viewportMetrics\.measureViewport\(\{/);
  assert.match(viewportMetricsJs, /const keyboardShrunk = keyboardCandidate && keyboardInputActive/);
  assert.match(viewportMetricsJs, /const height = keyboardShrunk \? visualBottom : Math\.max\(visualBottom \|\| 0, layout \|\| 0\)/);
  assert.match(appJs, /if \(viewport\.keyboardShrunk\) \{[\s\S]*--app-height/);
  assert.match(appJs, /document\.documentElement\.style\.removeProperty\("--app-height"\)/);
  assert.match(appJs, /document\.documentElement\.classList\.toggle\("keyboard-open", viewport\.keyboardShrunk\)/);
  assert.match(stylesCss, /html,\s*\nbody\s*{[\s\S]*touch-action:\s*pan-x pan-y;/);
  assert.match(stylesCss, /html\s*{[\s\S]*height:\s*-webkit-fill-available;/);
  assert.match(stylesCss, /body\s*{[\s\S]*min-height:\s*-webkit-fill-available;/);
  assert.match(stylesCss, /html\.embed-hermes \.composer\s*{[\s\S]*padding-bottom:\s*calc\(18px \+ env\(safe-area-inset-bottom, 0px\)\);/);
  assert.match(stylesCss, /html\.embed-hermes\.keyboard-open \.composer\s*{[\s\S]*padding-bottom:\s*14px;/);
  assert.match(stylesCss, /html\.embed-hermes \.main \.version-actions/);
  assert.match(indexHtml, /id="continuationDialog"/);
  assert.match(appJs, /function openContinuationDialog\(/);
  assert.match(appJs, /function continuationDialogOpen\(/);
  assert.match(appJs, /function closeContinuationDialog\(/);
  assert.match(stylesCss, /\.continuation-dialog/);
  assert.match(stylesCss, /html\.keyboard-open \.composer\s*{[\s\S]*padding-bottom:\s*12px;/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*html\.embed-hermes \.composer\s*{[\s\S]*padding-bottom:\s*calc\(14px \+ env\(safe-area-inset-bottom, 0px\)\);/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*html\.embed-hermes\.keyboard-open \.composer\s*{[\s\S]*padding-bottom:\s*10px;/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*html\.keyboard-open \.composer\s*{[\s\S]*padding-bottom:\s*7px;/);
});

test("public app shell cache advances after workspace creation placement", () => {
  assert.match(swJs, /codex-mobile-shell-v131/);
  assert.match(appJs, /CLIENT_BUILD_ID = "0\.1\.11\|codex-mobile-shell-v131"/);
  assert.match(appJs, /startupThreadOpenPending: false/);
  assert.match(appJs, /state\.startupThreadOpenPending = Boolean\(startupThreadId \|\| savedThreadId \|\| \(startupPluginRouteHint && startupPluginRouteHint\.threadId\)\);/);
  assert.match(appJs, /await loadThreads\(\{ silent: state\.startupThreadOpenPending \}\);/);
  assert.match(appJs, /function renderStartupThreadOpening\(\)/);
  assert.match(appJs, /Opening thread\.\.\./);
  assert.match(appJs, /if \(state\.startupThreadOpenPending\) \{[\s\S]*renderStartupThreadOpening\(\);[\s\S]*return;/);
  assert.match(appJs, /function showPluginEmbedRecovering\(message = ""\)/);
  assert.match(appJs, /Refreshing Codex Mobile plugin session\.\.\./);
  assert.match(appJs, /Refreshing Codex Mobile plugin launch\.\.\./);
  assert.match(appJs, /Refreshing plugin page from Hermes Mobile\.\.\./);
  assert.match(appJs, /state\.pluginRefreshPendingTimer = window\.setTimeout\(\(\) => \{/);
  assert.match(appJs, /function clearPluginRefreshPendingNotice\(\)/);
  assert.match(appJs, /Generating cross-thread task card draft\.\.\./);
  assert.match(stylesCss, /\.plugin-refresh-pending/);
  assert.match(stylesCss, /\.approval-details/);
  assert.match(stylesCss, /\.approval-summary-line/);
  assert.match(appJs, /if \(threadId === state\.currentThreadId && state\.currentThread && !state\.currentThread\.mobileLoadError\) \{/);
  assert.match(appJs, /scheduleCurrentThreadRefresh\(250\);[\s\S]*openExternalThreadSelection\(threadId\)\.catch\(showError\);/);
  assert.match(appJs, /if \(state\.currentThreadId && state\.currentThread && !state\.currentThread\.mobileLoading\) \{/);
  assert.match(appJs, /scheduleCurrentThreadRefresh\(250\);[\s\S]*else if \(state\.currentThreadId\) \{[\s\S]*await refreshCurrentThread\(\);[\s\S]*else \{[\s\S]*await restoreThreadSelection\(\);/);
  assert.match(swJs, /"\/api-client\.js"/);
  assert.match(swJs, /"\/runtime-settings\.js"/);
  assert.match(swJs, /"\/draft-store\.js"/);
  assert.match(swJs, /"\/markdown-renderer\.js"/);
  assert.match(swJs, /"\/viewport-metrics\.js"/);
  assert.match(swJs, /"\/conversation-scroll\.js"/);
  assert.match(swJs, /"\/image-compressor\.js"/);
  assert.match(swJs, /"\/plugin-embed\.js"/);
  assert.match(appJs, /"\/viewport-metrics\.js"/);
  assert.match(appJs, /"\/conversation-scroll\.js"/);
  assert.match(appJs, /"\/image-compressor\.js"/);
  assert.match(appJs, /"\/plugin-embed\.js"/);
  assert.match(appJs, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(appJs, /state\.serviceWorkerRegistration\.update\(\)\.catch/);
});

test("workspace creation lives at the bottom of the Workspace menu", () => {
  assert.match(indexHtml, /id="workspaceSelectMenu"/);
  assert.match(indexHtml, /id="newThreadButton"/);
  assert.match(indexHtml, /id="createWorkspaceDialog"/);
  assert.match(indexHtml, /id="createWorkspaceForm"/);
  assert.match(appJs, /function workspaceSidebarOptionsHtml\(\)/);
  assert.match(appJs, /data-create-workspace/);
  assert.match(appJs, /return allOption \+ workspaceOptions \+ createOption;/);
  assert.match(appJs, /openCreateWorkspaceDialog\(\)/);
  assert.match(appJs, /api\("\/api\/workspaces", \{[\s\S]*method: "POST"/);
  assert.match(stylesCss, /\.workspace-create-option/);
  assert.doesNotMatch(indexHtml, /newThreadButton[\s\S]{0,240}createWorkspace/i);
});

test("push notification control stays hidden when the browser cannot enable it", () => {
  assert.doesNotMatch(appJs, /HTTPS required/);
  assert.doesNotMatch(appJs, /Notifications unavailable/);
  assert.doesNotMatch(appJs, /Notifications unsupported/);
  assert.match(appJs, /const hideButton = \(\) => \{/);
  assert.match(appJs, /if \(!window\.isSecureContext\) \{[\s\S]*hideButton\(\);[\s\S]*return;[\s\S]*\}/);
});
