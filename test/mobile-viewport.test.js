"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { readFrontendSources } = require("./frontend-source-helper");

const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");
const appJs = readFrontendSources(path.resolve(__dirname, ".."));
const mediaPreviewRuntimeJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "media-preview-runtime.js"), "utf8");
const appUpdateRuntimeJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app-update-runtime.js"), "utf8");
const composerRuntimeJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "composer-runtime.js"), "utf8");
const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");
const swJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "sw.js"), "utf8");
const shellManifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "public", "shell-asset-manifest.json"), "utf8"));
const threadListRuntimeJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "thread-list-runtime.js"), "utf8");
const threadTileRuntimeJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "thread-tile-runtime.js"), "utf8");
const threadDetailMergeStateJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "thread-detail-merge-state.js"), "utf8");
const threadDetailRuntimeJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "thread-detail-runtime.js"), "utf8");
const sideChatRuntimeJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "side-chat-runtime.js"), "utf8");
const paneLayoutRuntimeJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "pane-layout-runtime.js"), "utf8");
const appShellRuntimeJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app-shell-runtime.js"), "utf8");
const apiClientRuntimeJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "api-client-runtime.js"), "utf8");
const viewportMetricsJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "viewport-metrics.js"), "utf8");
const platformPointer = fs.readFileSync(path.resolve(__dirname, "..", "docs", "HOME_AI_PLATFORM_CONTRACT.md"), "utf8");

function sourceFunctionBody(source, name) {
  return sourceFunction(source, name).body;
}

function sourceFunction(source, name) {
  if (source === appJs) {
    if (paneLayoutRuntimeJs.includes(`function ${name}(`)) source = paneLayoutRuntimeJs;
    else if (appShellRuntimeJs.includes(`function ${name}(`)) source = appShellRuntimeJs;
    else if (apiClientRuntimeJs.includes(`function ${name}(`)) source = apiClientRuntimeJs;
  }
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const bodyStart = source.indexOf(") {", start) + 2;
  assert.notEqual(bodyStart, 1, `missing function body ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return {
        source: source.slice(start, index + 1),
        body: source.slice(bodyStart + 1, index),
      };
    }
  }
  throw new Error(`could not parse function ${name}`);
}

function functionBody(name) {
  return sourceFunctionBody(appJs, name);
}

function composerRuntimeFunctionBody(name) {
  return sourceFunctionBody(composerRuntimeJs, name);
}

function threadListRuntimeFunctionBody(name) {
  return sourceFunctionBody(threadListRuntimeJs, name);
}

function threadTileRuntimeFunctionBody(name) {
  return sourceFunctionBody(threadTileRuntimeJs, name);
}

function evaluatedSortTurnsForDisplay() {
  const sources = [
    "turnDisplaySortTimestampMs",
    "turnDisplayItemTimestampMs",
    "turnDisplayItemTimestampRange",
    "turnDisplayStartMs",
    "turnDisplayActivityMs",
    "turnDisplaySortPhase",
    "sortTurnsForDisplay",
  ].map((name) => sourceFunction(appJs, name).source).join("\n");
  return Function("turnOrderMs", "isRunningStatus", "isTurnComplete", `
${sources}
return sortTurnsForDisplay;
  `)(
    (turn) => {
      const completed = /completed|failed|cancel/i.test(String(turn && (turn.status && turn.status.type || turn.status) || ""));
      const fields = completed
        ? ["completedAtMs", "updatedAtMs", "startedAtMs", "createdAtMs"]
        : ["startedAtMs", "createdAtMs", "updatedAtMs", "completedAtMs"];
      for (const field of fields) {
        const value = Number(turn && turn[field]);
        if (Number.isFinite(value) && value > 0) return value;
      }
      return 0;
    },
    (status) => /active|running|queued|processing/i.test(String(status && status.type || status || "")),
    (turn) => /completed|failed|cancel/i.test(String(turn && (turn.status && turn.status.type || turn.status) || "")),
  );
}

test("client turn ordering keeps active turns stable and completed turns completion-ordered", () => {
  const body = sourceFunctionBody(threadDetailRuntimeJs, "turnOrderMs");
  const completedBranchStart = body.indexOf("if (isTurnComplete(turn))");
  const completedAtIndex = body.indexOf('"completedAtMs"', completedBranchStart);
  const startedAtIndex = body.indexOf('"startedAtMs"', completedBranchStart);
  assert.notEqual(startedAtIndex, -1);
  assert.notEqual(completedAtIndex, -1);
  assert.ok(completedAtIndex < startedAtIndex, "completed turns must sort by completedAt before startedAt");
  assert.match(body, /if \(isTurnComplete\(turn\)\) \{[\s\S]*"completedAtMs"[\s\S]*"updatedAtMs"[\s\S]*"startedAtMs"[\s\S]*"createdAtMs"/);
  assert.match(body, /return firstTurnTimestampMs\(turn, \[[\s\S]*"startedAtMs"[\s\S]*"createdAtMs"[\s\S]*"updatedAtMs"[\s\S]*"completedAtMs"/);
  assert.match(sourceFunctionBody(threadDetailRuntimeJs, "firstTurnTimestampMs"), /numericTimestampMs\(turn && turn\[field\]\)/);
  assert.match(functionBody("turnDisplaySortPhase"), /isRunningStatus\(turn && turn\.status\) && !isTurnComplete\(turn\)[\s\S]*return 2/);
  assert.match(functionBody("turnDisplaySortPhase"), /if \(isTurnComplete\(turn\)\) return 1/);
  assert.match(functionBody("turnDisplayStartMs"), /"startedAtMs"[\s\S]*"createdAtMs"[\s\S]*"completedAtMs"/);
  assert.match(functionBody("turnDisplayActivityMs"), /if \(isTurnComplete\(turn\)\) return orderMs \|\| range\.first \|\| range\.last;/);
  assert.match(functionBody("turnDisplayActivityMs"), /return Math\.max\(orderMs, range\.last, range\.first\);/);
  const sortBody = functionBody("sortTurnsForDisplay");
  assert.match(sortBody, /const leftActivity = turnDisplayActivityMs\(leftTurn\);/);
  assert.match(sortBody, /if \(leftActivity !== rightActivity\) return leftActivity - rightActivity;/);
  assert.match(sortBody, /const leftPhase = turnDisplaySortPhase\(leftTurn\);/);
  assert.match(sortBody, /if \(leftPhase !== rightPhase\) return leftPhase - rightPhase;/);
  assert.ok(sortBody.indexOf("leftActivity") < sortBody.indexOf("leftPhase"), "turn activity timestamp must sort before state phase tie-breaker");
  assert.match(functionBody("turnDisplayItemTimestampRange"), /Array\.isArray\(turn && turn\.items\) \? turn\.items : \[\]/);
  assert.match(functionBody("turnDisplayItemTimestampMs"), /"mobileDisplayTimestampMs"[\s\S]*"completedAtMs"/);
  assert.match(sortBody, /const leftRange = turnDisplayItemTimestampRange\(leftTurn\);/);
  assert.match(sortBody, /if \(leftRange\.first !== rightRange\.first\) return leftRange\.first - rightRange\.first;/);
  assert.match(sortBody, /if \(leftRange\.last !== rightRange\.last\) return leftRange\.last - rightRange\.last;/);

  const consistencyBody = functionBody("checkConversationProjectionConsistency");
  assert.match(consistencyBody, /const orderSnapshot = conversationTurnOrderDiagnosticSnapshot\(source, extra\);/);
  assert.match(consistencyBody, /threadDiagnosticEventsApi\.conversationProjectionConsistencyEffects\(\{ snapshot, orderSnapshot \}\)/);
  assert.match(consistencyBody, /applyConversationProjectionConsistencyEffectsPlan\(effectsPlan\)/);
  assert.doesNotMatch(consistencyBody, /hasTurnOrderMismatch\(orderSnapshot\)/);
  assert.doesNotMatch(consistencyBody, /turnOrderMismatchDiagnosticEvent\(orderSnapshot\)/);
  assert.doesNotMatch(consistencyBody, /turnOrderMismatchDiagnosticSuccess\(orderSnapshot\)/);
});

test("client turn display sorting does not pin older active turns below newer completed receipts", () => {
  const sortTurnsForDisplay = evaluatedSortTurnsForDisplay();
  const base = 1_780_000_000_000;
  const olderActive = {
    id: "older-active",
    status: { type: "running" },
    startedAtMs: base + 1000,
    items: [{ id: "old-progress", type: "agentMessage", createdAtMs: base + 1500 }],
  };
  const newerCompleted = {
    id: "newer-completed",
    status: "completed",
    startedAtMs: base + 2000,
    completedAtMs: base + 5000,
    items: [{ id: "new-receipt", type: "agentMessage", completedAtMs: base + 5000 }],
  };
  const latestActive = {
    id: "latest-active",
    status: { type: "running" },
    startedAtMs: base + 1000,
    items: [{ id: "latest-progress", type: "agentMessage", createdAtMs: base + 6000 }],
  };
  const sameTimeActive = {
    id: "same-time-active",
    status: { type: "running" },
    startedAtMs: base + 5000,
    items: [],
  };

  assert.deepEqual(sortTurnsForDisplay([newerCompleted, olderActive]).map((turn) => turn.id), [
    "older-active",
    "newer-completed",
  ]);
  assert.deepEqual(sortTurnsForDisplay([latestActive, newerCompleted]).map((turn) => turn.id), [
    "newer-completed",
    "latest-active",
  ]);
  assert.deepEqual(sortTurnsForDisplay([sameTimeActive, newerCompleted]).map((turn) => turn.id), [
    "newer-completed",
    "same-time-active",
  ]);

  const overlappingCompletedEarly = {
    id: "overlapping-completed-early",
    status: "completed",
    startedAtMs: base + 2500,
    completedAtMs: base + 9000,
    items: [{ id: "slow-receipt", type: "agentMessage", completedAtMs: base + 9000 }],
  };
  const overlappingCompletedLater = {
    id: "overlapping-completed-later",
    status: "completed",
    startedAtMs: base + 3000,
    completedAtMs: base + 5000,
    items: [{ id: "fast-receipt", type: "agentMessage", completedAtMs: base + 5000 }],
  };
  assert.deepEqual(sortTurnsForDisplay([overlappingCompletedLater, overlappingCompletedEarly]).map((turn) => turn.id), [
    "overlapping-completed-early",
    "overlapping-completed-later",
  ]);
});

test("thread detail response diagnostics are planned before Home AI reporting", () => {
  const body = functionBody("recordThreadDetailResponseDiagnostics");
  assert.match(body, /threadPerformanceMetrics\.planThreadDetailSlowPathDiagnostic\(performanceEvent, \{/);
  assert.match(body, /threadPerformanceMetrics\.planThreadDetailResponseContractDiagnostic\(performanceEvent, \{/);
  assert.match(body, /threadDiagnosticEventsApi\.threadDetailResponseDiagnosticEffects\(\{/);
  assert.match(body, /slowPlan,/);
  assert.match(body, /slowSuccessInput: \{/);
  assert.match(body, /contractPlan,/);
  assert.match(body, /applyThreadDetailResponseDiagnosticEffectsPlan\(effectsPlan\)/);
  assert.match(functionBody("applyThreadDetailResponseDiagnosticEffect"), /recordHomeAiDiagnosticFailure\(item\.diagnostic \|\| \{\}\)/);
  assert.match(functionBody("applyThreadDetailResponseDiagnosticEffect"), /recordHomeAiDiagnosticSuccess\(item\.diagnostic \|\| \{\}\)/);
  assert.doesNotMatch(body, /threadDetailSlowPathDiagnosticEvent\(slowPlan\)/);
  assert.doesNotMatch(body, /threadDetailResponseContractDiagnosticEvent\(contractPlan\)/);
  assert.doesNotMatch(body, /taskBody|messageText|rawPrompt|upload/);
});

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
  assert.match(appJs, /(?:const|var) viewportMetrics = window\.CodexViewportMetrics/);
  assert.match(appJs, /viewportMetrics\.measureViewport\(\{/);
  assert.match(viewportMetricsJs, /const keyboardShrunk = Boolean\(keyboardInputActive && \(keyboardCandidate \|\| offsetKeyboardShifted \|\| scrollKeyboardShifted \|\| hostKeyboardVisible\)\)/);
  assert.match(viewportMetricsJs, /hostKeyboardBottomInset/);
  assert.match(viewportMetricsJs, /hostKeyboardVisible/);
  assert.match(viewportMetricsJs, /hostViewportHeight/);
  assert.match(viewportMetricsJs, /offsetKeyboardShifted/);
  assert.match(viewportMetricsJs, /scrollKeyboardShifted/);
  assert.match(appJs, /hostViewportHeight:\s*embedded && hostViewport && hostViewport\.viewport \? hostViewport\.viewport\.height : 0/);
  assert.match(appJs, /scrollTop:\s*embedded \? Math\.max\(/);
  assert.match(appJs, /function resetMobileKeyboardWindowScroll\(\)/);
  assert.match(appJs, /if \(isHermesEmbedMode\(\) \|\| !isKeyboardEditableElement\(document\.activeElement\)\) return;/);
  assert.match(appJs, /if \(typeof window\.scrollTo === "function"\) window\.scrollTo\(0, 0\);/);
  assert.match(appJs, /if \(viewport\.keyboardShrunk\) \{[\s\S]*--app-height/);
  assert.match(appJs, /--app-top/);
  assert.match(appJs, /document\.documentElement\.style\.removeProperty\("--app-height"\)/);
  assert.match(appJs, /document\.documentElement\.classList\.toggle\("keyboard-open", viewport\.keyboardShrunk\)/);
  assert.match(appJs, /pluginHostViewport: null/);
  assert.match(appJs, /function normalizeHermesPluginViewportRect\(rect\)/);
  assert.match(appJs, /function normalizeHermesPluginViewportMessage\(data\)/);
  assert.match(appJs, /data\.type !== "hermes\.plugin\.viewport"/);
  assert.match(appJs, /iframe:\s*normalizeHermesPluginViewportRect\(data\.iframe\)/);
  assert.match(appJs, /host:\s*normalizeHermesPluginViewportRect\(data\.host\)/);
  assert.match(appJs, /handleHermesPluginViewportMessage\(event && event\.data\)/);
  assert.match(appJs, /state\.pluginHostViewport = normalized;[\s\S]*syncThreadDetailLayoutState\(\);/);
  assert.match(appJs, /function isHermesKeyboardInputActive\(\) \{[\s\S]*isHermesEmbedMode\(\)[\s\S]*isKeyboardEditableElement\(document\.activeElement\)/);
  assert.match(appJs, /window\.visualViewport\.addEventListener\("resize", \(\) => \{[\s\S]*if \(!isHermesKeyboardInputActive\(\)\) \{[\s\S]*scheduleVisualRecovery\("visual-viewport"/);
  assert.match(appJs, /window\.visualViewport\.addEventListener\("scroll", \(\) => \{[\s\S]*if \(!isHermesKeyboardInputActive\(\)\) \{[\s\S]*scheduleVisualRecovery\("visual-viewport-scroll"/);
  assert.match(appJs, /HEAVY_VISUAL_RECOVERY_MIN_INTERVAL_MS = 4000/);
  assert.match(appJs, /function visualRecoveryReasonAllowsHeavy\(reason = ""\)/);
  assert.match(appJs, /\^\(focus\|focusin\|focusout\|resize\|visual-viewport\|visual-viewport-scroll\|window-blur\)\$/);
  assert.match(appJs, /function shouldRunHeavyVisualRecovery\(reason = "resume"\)/);
  assert.match(appJs, /now - state\.lastHeavyVisualRecoveryAt < HEAVY_VISUAL_RECOVERY_MIN_INTERVAL_MS/);
  assert.match(appJs, /forceVisualRecovery\(reason, \{ heavy: index === 0 && allowHeavyRecovery \}\)/);
  assert.match(appJs, /forceVisualRecovery\(reason, \{ heavy: false \}\);[\s\S]*updateComposerHeightVar\(\);/);
  assert.doesNotMatch(appJs, /0\.01px/);
  assert.match(stylesCss, /html,\s*\nbody\s*{[\s\S]*touch-action:\s*pan-x pan-y;/);
  assert.match(stylesCss, /html\s*{[\s\S]*height:\s*-webkit-fill-available;/);
  assert.match(stylesCss, /body\s*{[\s\S]*min-height:\s*-webkit-fill-available;/);
  assert.match(stylesCss, /html\.embed-hermes \.app\s*{[\s\S]*height:\s*var\(--app-height, 100dvh\);/);
  assert.match(stylesCss, /html\.embed-hermes \.app\s*{[\s\S]*min-height:\s*0;/);
  assert.match(stylesCss, /html\.embed-hermes \.app\s*{[\s\S]*transform:\s*translateY\(var\(--app-top, 0px\)\);/);
  assert.match(stylesCss, /\.app\.resume-repaint\s*{[\s\S]*transform:\s*translateY\(var\(--app-top, 0px\)\) translateZ\(0\);/);
  assert.match(stylesCss, /--host-top-safe-area:\s*0px;/);
  assert.match(stylesCss, /html\.embed-hermes \.topbar\s*{[\s\S]*padding-top:\s*calc\(6px \+ max\(env\(safe-area-inset-top, 0px\), var\(--host-top-safe-area, 0px\)\)\);[\s\S]*padding-bottom:\s*6px;/);
  assert.match(appJs, /hostTopSafeArea:\s*boundedViewportNumber\(topSafeArea, 512\)/);
  assert.match(appJs, /--host-top-safe-area/);
  assert.match(stylesCss, /html\.embed-hermes \.composer\s*{[\s\S]*padding-bottom:\s*max\(12px, var\(--host-bottom-safe-area, 0px\)\);/);
  assert.match(stylesCss, /html\.embed-hermes\.keyboard-open \.composer\s*{[\s\S]*padding-bottom:\s*max\(10px, var\(--host-bottom-safe-area, 0px\)\);/);
  assert.match(stylesCss, /html\.embed-hermes \.main \.version-actions/);
  assert.match(indexHtml, /id="continuationDialog"/);
  assert.match(appJs, /function openContinuationDialog\(/);
  assert.match(appJs, /function continuationDialogOpen\(/);
  assert.match(appJs, /function closeContinuationDialog\(/);
  assert.match(stylesCss, /\.continuation-dialog/);
  assert.match(stylesCss, /html\.keyboard-open \.composer\s*{[\s\S]*padding-bottom:\s*12px;/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.composer\s*{[\s\S]*gap:\s*6px;[\s\S]*padding:\s*7px 12px clamp\(8px, calc\(env\(safe-area-inset-bottom, 0px\) - 88px\), 52px\);/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*html\.embed-hermes \.composer\s*{[\s\S]*padding-bottom:\s*max\(12px, var\(--host-bottom-safe-area, 0px\)\);/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*html\.embed-hermes\.keyboard-open \.composer\s*{[\s\S]*padding-bottom:\s*max\(8px, var\(--host-bottom-safe-area, 0px\)\);/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*html\.keyboard-open \.composer\s*{[\s\S]*padding-bottom:\s*7px;/);
  assert.match(platformPointer, /embedded-plugin-keyboard-composer/);
  assert.match(platformPointer, /--plugin-thread-id <thread-id>/);
  assert.match(platformPointer, /development visual check passes/);
});

test("Android composer focused native tap preserves IME focus", () => {
  const prepareBody = composerRuntimeFunctionBody("prepareMessageInputForNativeGesture");
  const recoverBody = composerRuntimeFunctionBody("recoverMessageInputKeyboardFromGesture");
  const shouldRecoverBody = composerRuntimeFunctionBody("shouldRecoverMessageInputKeyboard");
  const releaseBody = composerRuntimeFunctionBody("releaseStaleAndroidMessageInputFocusBeforeNativeTap");
  assert.match(prepareBody, /if \(!input \|\| !isAndroidBrowser\(\)\) return;/);
  assert.match(prepareBody, /setMessageInputDisabled\(false\)/);
  assert.match(prepareBody, /releaseStaleAndroidMessageInputFocusBeforeNativeTap\(input\)/);
  assert.doesNotMatch(prepareBody, /focusMessageInput|preventDefault/);
  assert.match(releaseBody, /messageInputKeyboardVisible\(\)/);
  assert.match(releaseBody, /document\.activeElement === input[\s\S]*return false/);
  assert.match(releaseBody, /input\.blur\(\)/);
  assert.match(shouldRecoverBody, /if \(!isAndroidBrowser\(\) && !isHermesEmbedMode\(\)\) return false;/);
  assert.doesNotMatch(shouldRecoverBody, /if \(isAndroidBrowser\(\)\) return false;/);
  assert.doesNotMatch(recoverBody, /if \(isAndroidBrowser\(\)\) return false;/);
  assert.match(recoverBody, /resetActiveFocus: true/);
  assert.match(recoverBody, /allowAndroidActiveFocusReset: true/);
});

test("composer sizing avoids one-pixel layout churn while typing and streaming", () => {
  assert.match(appJs, /composerHeightPx:\s*0/);
  assert.match(composerRuntimeJs, /function updateComposerHeightVar\(options = \{\}\)/);
  assert.match(composerRuntimeJs, /stablePixelChanged\(previousPx, nextPx\)/);
  assert.match(composerRuntimeJs, /document\.documentElement\.style\.setProperty\("--composer-height", `\$\{nextPx\}px`\)/);
  assert.match(composerRuntimeJs, /function autoSizeMessageInput\(el, options = \{\}\)/);
  assert.match(composerRuntimeJs, /nextTextLength < previousTextLength/);
  assert.match(appJs, /autoSizeMessageInput\(event\.target\);/);
  assert.match(composerRuntimeJs, /updateMessageInputOverflow\(el, nextHeight\)/);
  assert.match(stylesCss, /\.message-input\s*{[\s\S]*height:\s*44px;[\s\S]*overflow-y:\s*hidden;/);
});

test("turn timer preserves elapsed digits on narrow embedded viewports", () => {
  assert.match(stylesCss, /\.turn-timer\s*{[\s\S]*width:\s*auto;/);
  assert.match(stylesCss, /\.turn-timer\s*{[\s\S]*max-width:\s*min\(44vw, 260px\);/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.turn-timer\s*{[\s\S]*max-width:\s*min\(36vw, 180px\);/);
  assert.match(stylesCss, /\.turn-timer\.visible\s*{[\s\S]*display:\s*inline-flex;/);
  assert.match(stylesCss, /\.turn-timer-time\s*{[\s\S]*flex:\s*0 0 auto;/);
  assert.match(stylesCss, /\.turn-timer-time\s*{[\s\S]*min-width:\s*8ch;/);
  assert.match(stylesCss, /\.turn-timer-time\s*{[\s\S]*overflow:\s*visible;/);
  assert.match(stylesCss, /\.turn-timer-detail\s*{[\s\S]*flex:\s*1 1 auto;/);
  assert.match(stylesCss, /\.turn-timer-detail\s*{[\s\S]*text-overflow:\s*ellipsis;/);
  assert.doesNotMatch(appJs, /\\u672c\\u8f6e \$\{formatElapsedTime/);
  assert.doesNotMatch(appJs, /本轮 00:00:00/);
  assert.doesNotMatch(stylesCss, /\.turn-timer-time\s*{[\s\S]*flex:\s*0 0 104px;/);
});

test("visual harness can replay empty cached detail openings without exposing thread content", () => {
  const installBody = sourceFunctionBody(sideChatRuntimeJs, "installCodexMobileVisualHarnessFacade");
  const harnessBody = sourceFunctionBody(sideChatRuntimeJs, "simulateEmptyCachedDetailOpenForHarness");
  const stableDomHarnessBody = sourceFunctionBody(sideChatRuntimeJs, "simulateStableSignatureEmptyDomForHarness");
  const shapeBody = sourceFunctionBody(sideChatRuntimeJs, "visualHarnessThreadShape");
  const smokeScript = fs.readFileSync(path.resolve(__dirname, "..", "scripts", "codex-mobile-empty-detail-cache-smoke.js"), "utf8");
  const smokeHarness = require(path.resolve(__dirname, "..", "scripts", "codex-mobile-empty-detail-cache-smoke.js"));

  assert.match(installBody, /simulateEmptyCachedDetailOpen:\s*\(threadId\) => simulateEmptyCachedDetailOpenForHarness\(threadId\)/);
  assert.match(installBody, /simulateStableSignatureEmptyDom:\s*\(threadId\) => simulateStableSignatureEmptyDomForHarness\(threadId\)/);
  assert.match(harnessBody, /state\.currentThread = \{[\s\S]*turns:\s*\[\],[\s\S]*mobileDetailLoaded:\s*true,[\s\S]*mobileReadMode:\s*"visual-harness-empty-cache"/);
  assert.match(harnessBody, /await loadThread\(id, \{ source: "visual-harness-empty-cache" \}\)/);
  assert.match(harnessBody, /thread_hash:\s*threadHash/);
  assert.match(harnessBody, /before,[\s\S]*after,/);
  assert.match(stableDomHarnessBody, /await loadThread\(id, \{ source: "visual-harness-stable-signature-seed" \}\)/);
  assert.match(stableDomHarnessBody, /const signature = conversationRenderSignature\(state\.currentThread\)/);
  assert.match(stableDomHarnessBody, /state\.renderedConversationSignature = signature/);
  assert.match(stableDomHarnessBody, /state\.renderedConversationPatchShellSignature = patchShellSignature/);
  assert.match(stableDomHarnessBody, /conversation\.innerHTML = '<div class="empty-state">No visible turns\.<\/div>'/);
  assert.match(stableDomHarnessBody, /renderCurrentThread\(\{ stickToBottom: true, source: "visual-harness-stable-signature-empty-dom" \}\)/);
  assert.match(stableDomHarnessBody, /const hasEmptyState = afterConversation \? Boolean\(afterConversation\.querySelector\("\.empty-state"\)\) : false/);
  assert.match(stableDomHarnessBody, /emptyState: hasEmptyState \? "empty-state" : ""/);
  assert.match(stableDomHarnessBody, /domBefore/);
  assert.match(stableDomHarnessBody, /domAfter/);
  assert.doesNotMatch(stableDomHarnessBody, /textContent|innerText|node\.innerHTML/);
  assert.doesNotMatch(stableDomHarnessBody, /text|message|prompt|cookie|token|contentUrl|localPath|filePath/);
  assert.match(shapeBody, /visibleConversationShape\(thread\)/);
  assert.match(shapeBody, /visibleTurnCount/);
  assert.match(shapeBody, /visibleItemCount/);
  assert.match(shapeBody, /itemCount/);
  assert.doesNotMatch(harnessBody, /text|message|prompt|cookie|token|contentUrl|localPath|filePath/);

  assert.match(smokeScript, /methodName = scenario === "stable-signature-empty-dom" \? "simulateStableSignatureEmptyDom" : "simulateEmptyCachedDetailOpen"/);
  assert.match(smokeScript, /harness\[methodName\]\(threadId\)/);
  assert.match(smokeScript, /const runKey = String\(arguments\[2\] \|\| "default"\)/);
  assert.match(smokeScript, /"__codexMobileEmptyDetailCacheSmoke:" \+ scenario \+ ":" \+ runKey/);
  assert.match(smokeScript, /args: \[options\.threadId, options\.scenario, runKey\]/);
  assert.match(smokeScript, /simulateStableSignatureEmptyDom/);
  assert.match(smokeScript, /stable-signature-empty-dom/);
  assert.match(smokeScript, /--scenario <name>/);
  assert.match(smokeScript, /No visible turns/);
  assert.match(smokeScript, /thread_hash/);
  assert.match(smokeScript, /turnCount/);
  assert.match(smokeScript, /itemCount/);
  assert.equal(smokeHarness.parseArgs(["--scenario", "stable-signature-empty-dom"]).scenario, "stable-signature-empty-dom");
  assert.throws(() => smokeHarness.parseArgs(["--scenario", "unknown"]), /unknown_scenario:unknown/);
  assert.doesNotMatch(smokeScript, /innerText|rawPrompt|taskBody|accessKey|cookie|uploadBytes|providerPayload/);
});

test("public app shell cache advances with static frontend changes", () => {
  assert.match(shellManifest.clientBuildId, /^0\.1\.11\|codex-mobile-shell-v625-[a-f0-9]{12}$/);
  assert.match(shellManifest.shellCacheName, /^codex-mobile-shell-v625-[a-f0-9]{12}$/);
  assert.match(swJs, /shell-asset-manifest\.js/);
  assert.ok(shellManifest.precacheAssets.includes("/home-ai-diagnostic-reporting.js"));
  assert.match(appJs, /"\/home-ai-diagnostic-reporting\.js"/);
  assert.ok(shellManifest.precacheAssets.includes("/thread-diagnostic-events.js"));
  assert.match(appJs, /"\/thread-diagnostic-events\.js"/);
  for (const asset of [
    "/thread-status-hints.js",
    "/thread-performance-metrics.js",
    "/thread-list-load-policy.js",
    "/thread-list-stable-order.js",
    "/thread-list-runtime.js",
    "/live-operation-dock-state.js",
    "/thread-detail-state.js",
    "/thread-detail-render-plan.js",
    "/thread-detail-merge-state.js",
    "/thread-detail-v4-merge-state.js",
    "/thread-detail-runtime.js",
    "/thread-detail-patch-plan.js",
    "/thread-detail-dom-patch.js",
    "/thread-detail-actions.js",
    "/thread-tile-actions.js",
    "/thread-tile-state.js",
    "/thread-tile-layout.js",
    "/thread-tile-runtime.js",
    "/composer-runtime.js",
    "/app-update-runtime.js",
    "/side-chat-runtime.js",
  ]) {
    assert.ok(shellManifest.precacheAssets.includes(asset), `manifest missing ${asset}`);
  }
  assert.match(appJs, /"\/side-chat-runtime\.js"/);
  assert.match(indexHtml, /<script src="\/side-chat-runtime\.js"><\/script>[\s\S]*<script src="\/media-preview-runtime\.js"><\/script>[\s\S]*<script src="\/app\.js"><\/script>/);
  assert.match(appJs, /(?:const|var) sideChatRuntimeApi = window\.CodexSideChatRuntime/);
  assert.match(appJs, /function requireSideChatRuntime\(\)/);
  assert.match(stylesCss, /\.subagent-panel\s*{[\s\S]*position:\s*fixed;[\s\S]*height:\s*var\(--app-height, 100dvh\);/);
  assert.match(stylesCss, /\.thread-side-panel\s*{[\s\S]*grid-template-rows:\s*minmax\(92px, 0\.42fr\) minmax\(224px, 1fr\);/);
  assert.match(stylesCss, /\.thread-side-panel\.no-subagents\s*{[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\);/);
  assert.match(stylesCss, /\.side-chat-scroll\s*{[\s\S]*overflow:\s*auto;/);
  assert.match(stylesCss, /\.side-chat-section\s*{[\s\S]*height:\s*100%;/);
  assert.match(stylesCss, /\.side-chat-header\s*{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto auto auto;/);
  assert.match(stylesCss, /\.side-chat-composer-row\s*{[\s\S]*grid-template-columns:\s*44px minmax\(0, 1fr\) max-content;/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.composer\s*{[\s\S]*grid-template-columns:\s*52px minmax\(0, 1fr\) max-content;/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.attachment-picker-cell\s*{[\s\S]*width:\s*52px;[\s\S]*height:\s*44px;/);
  assert.match(stylesCss, /\.side-chat-header-clear\s*{[\s\S]*justify-self:\s*end;/);
  assert.match(stylesCss, /\.side-chat-form textarea\s*{[\s\S]*min-height:\s*44px;[\s\S]*max-height:\s*160px;[\s\S]*overflow-y:\s*hidden;/);
  assert.match(stylesCss, /\.subagent-panel\s*{[\s\S]*z-index:\s*40;/);
  assert.match(stylesCss, /html\.keyboard-open \.subagent-panel\s*{[\s\S]*height:\s*var\(--app-height, 100dvh\);[\s\S]*max-height:\s*none;/);
  assert.match(stylesCss, /html\.keyboard-open \.thread-side-panel\s*{[\s\S]*grid-template-rows:\s*minmax\(44px, 0\.18fr\) minmax\(0, 1fr\);/);
  assert.match(stylesCss, /html\.keyboard-open \.thread-side-panel\.no-subagents\s*{[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\);/);
  assert.match(stylesCss, /html\.keyboard-open \.side-chat-form textarea\s*{[\s\S]*min-height:\s*44px;[\s\S]*max-height:\s*min\(14vh, 84px\);/);
  assert.match(appJs, /function ensureSideChatDraftVisible\(/);
  assert.match(appJs, /function autoSizeSideChatDraftTextarea\(/);
  assert.match(sideChatRuntimeJs, /autoSizeSideChatDraftTextarea\(textarea\)/);
  assert.match(sideChatRuntimeJs, /requestAnimationFrame\(ensureSideChatDraftVisible\)/);
  assert.match(appJs, /function scheduleSideChatPoll\(/);
  assert.match(sideChatRuntimeJs, /侧聊正在回复/);
  assert.match(appJs, /function flushSideChatDraftNow\(/);
  assert.match(appJs, /threadDetailRenderPlanApi\.planThreadDetailLoadingShellPostStateEffects/);
  assert.match(functionBody("applyThreadDetailPostRenderEffect"), /loadSideChat\(sideChatThreadId, \{ silent: item\.silent !== false \}\)\.catch\(showError\);/);
  assert.match(appUpdateRuntimeJs, /function serverBuildIdFromConfig\(config\) \{\s*return String\(config && \(config\.clientBuildId \|\| config\.shellCacheName \|\| config\.buildId\) \|\| ""\)\.trim\(\);/);
  assert.doesNotMatch(appUpdateRuntimeJs, /function serverBuildIdFromConfig\(config\) \{\s*return String\(config && \(config\.clientBuildId \|\| config\.shellCacheName \|\| config\.buildId \|\| config\.version\)/);
  assert.match(appJs, /startupThreadOpenPending: false/);
  assert.match(indexHtml, /id="pluginStartupLoading"/);
  assert.match(indexHtml, /data-plugin-startup-title>正在加载 Codex\.\.\.</);
  assert.match(appJs, /pluginStartupLoading: Boolean\(INITIAL_PLUGIN_EMBED\.embedded\)/);
  assert.match(appJs, /function showPluginStartupLoading\(message = ""\)/);
  assert.match(appJs, /function hidePluginStartupLoading\(\)/);
  assert.match(appJs, /if \(isHermesEmbedMode\(\)\) showPluginStartupLoading\(\);/);
  assert.match(appJs, /hidePluginStartupLoading\(\);[\s\S]*}\s*\n\s*function threadIdFromUrlValue/);
  assert.match(stylesCss, /html\.embed-hermes\.plugin-startup-loading \.app/);
  assert.match(stylesCss, /\.plugin-startup-loading\s*{[\s\S]*position:\s*fixed;[\s\S]*place-items:\s*center;/);
  assert.doesNotMatch(appJs, /thread-card-token-badge/);
  assert.doesNotMatch(stylesCss, /thread-card-token-badge/);
  assert.match(appJs, /(?:const|var) savedThreadId = isHermesEmbedMode\(\) \? "" : \(localStorage\.getItem\(STORAGE_THREAD_ID\) \|\| ""\);/);
  assert.match(appJs, /function hasStartupThreadOpenIntent\(\)/);
  assert.match(appJs, /postClientEvent\("startup_stage"/);
  assert.match(appUpdateRuntimeJs, /postPerformanceEvent\("shell_loaded"/);
  assert.match(threadListRuntimeJs, /postPerformanceEvent\("thread_list_rendered"/);
  assert.match(threadListRuntimeJs, /const listPerformance = threadPerformanceMetrics\.threadListEventFields\(result\);/);
  assert.match(appJs, /THREAD_LIST_SLOW_PATH_MS = 1500/);
  assert.match(threadListRuntimeJs, /const listSlowPlan = threadPerformanceMetrics\.planThreadListSlowPathDiagnostic\(listPerformanceEvent, \{/);
  assert.match(threadListRuntimeJs, /threadDiagnosticEventsApi\.threadListSlowPathDiagnosticEvent\(listSlowPlan\)/);
  assert.match(threadListRuntimeJs, /threadDiagnosticEventsApi\.threadListSlowPathDiagnosticSuccess\(\{/);
  assert.match(threadListRuntimeJs, /serverTimings: listPerformance\.serverTimings/);
  assert.match(threadListRuntimeJs, /performancePhase: listPerformance\.performancePhase/);
  assert.match(functionBody("loadThread"), /const cachedFirstPaintReportingStage = threadDetailRenderPlanApi\.planThreadDetailFirstPaintReportingStage\(\{[\s\S]*detailRenderMode: "cached-current",[\s\S]*cached: true,[\s\S]*threadHash: diagnosticThreadHash\(threadId\),[\s\S]*\}\);[\s\S]*threadPerformanceMetrics\.threadDetailFirstPaintEventFields\(\s*state\.currentThread,\s*cachedFirstPaintReportingStage\.performanceInput,\s*\);/);
  assert.match(functionBody("loadThread"), /const firstPaintReportingStage = threadDetailRenderPlanApi\.planThreadDetailFirstPaintReportingStage\(\{[\s\S]*detailRenderMode: "first-paint",[\s\S]*cached: false,[\s\S]*threadHash: diagnosticThreadHash\(threadId\),[\s\S]*\}\);[\s\S]*threadPerformanceMetrics\.threadDetailFirstPaintEventFields\(\s*result\.thread,\s*firstPaintReportingStage\.performanceInput,\s*\);/);
  assert.match(functionBody("loadThread"), /const cachedTelemetryPlan = threadDetailRenderPlanApi\.planThreadDetailCachedCurrentTelemetryEffects\(Object\.assign\(\{[\s\S]*performanceEvent: firstPaintPerformance,[\s\S]*\}, cachedFirstPaintReportingStage\.telemetryInput\)\);/);
  assert.match(functionBody("loadThread"), /applyThreadDetailFirstPaintTelemetryEffectsPlan\(cachedTelemetryPlan, \{ thread: state\.currentThread \}\);/);
  assert.match(functionBody("loadThread"), /const firstPaintTelemetryPlan = threadDetailRenderPlanApi\.planThreadDetailFirstPaintTelemetryEffects\(Object\.assign\(\{[\s\S]*performanceEvent: firstPaintPerformance,[\s\S]*\}, firstPaintReportingStage\.telemetryInput\)\);/);
  assert.match(functionBody("loadThread"), /applyThreadDetailFirstPaintTelemetryEffectsPlan\(firstPaintTelemetryPlan, \{ thread: result\.thread \}\);/);
  assert.match(functionBody("loadThread"), /const suppressLoadFailureDiagnostic = options\.suppressLoadFailureDiagnostic === true;/);
  assert.match(functionBody("loadThread"), /if \(suppressLoadFailureDiagnostic\) \{[\s\S]*postClientEvent\("thread_detail_load_failure_diagnostic_suppressed"[\s\S]*\} else \{[\s\S]*threadDiagnosticEventsApi\.threadDetailLoadFailedDiagnosticEvent\(\{[\s\S]*errorCode: diagnosticErrorCode\(err, "thread_detail_load_failed"\),[\s\S]*durationBucket: diagnosticDurationBucket\(roundedDurationMs\(switchStartedAt\)\),[\s\S]*statusCode: diagnosticErrorStatus\(err\),[\s\S]*threadHash: diagnosticThreadHash\(threadId\),[\s\S]*\}\)/);
  assert.doesNotMatch(functionBody("loadThread"), /recordHomeAiDiagnosticFailure\(\{[\s\S]*diagnostic_type: "thread_detail_load_failed"/);
  assert.match(functionBody("loadThread"), /threadDetailRenderPlanApi\.planThreadDetailSwitchStartClientEvent\(\{/);
  assert.match(functionBody("loadThread"), /threadDetailRenderPlanApi\.planThreadDetailSwitchCancelledClientEvent\(\{/);
  assert.match(functionBody("loadThread"), /threadDetailRenderPlanApi\.planThreadDetailSwitchErrorClientEvent\(\{/);
  assert.match(functionBody("loadThread"), /const loadErrorPlan = threadDetailRenderPlanApi\.planThreadDetailLoadErrorEffects\(\{[\s\S]*threadId,[\s\S]*errorMessage: err\.message \|\| String\(err\),[\s\S]*\}\);[\s\S]*applyThreadDetailPostRenderEffectsPlan\(loadErrorPlan, \{ thread: state\.currentThread \}\);/);
  assert.match(functionBody("applyThreadDetailPostRenderEffect"), /if \(type === "set-current-thread-load-error"\) \{[\s\S]*state\.currentThread = Object\.assign\(\{\}, state\.currentThread \|\| \{[\s\S]*mobileLoading: false,[\s\S]*mobileLoadError: String\(item\.errorMessage \|\| ""\),[\s\S]*\}\);/);
  assert.match(functionBody("applyThreadDetailSwitchClientEventEffect"), /postClientEvent\(String\(item\.eventName \|\| ""\), item\.payload \|\| \{\}\);/);
  assert.doesNotMatch(functionBody("loadThread"), /postClientEvent\("thread_switch_start"/);
  assert.doesNotMatch(functionBody("loadThread"), /postClientEvent\("thread_switch_cancelled"/);
  assert.doesNotMatch(functionBody("loadThread"), /postClientEvent\("thread_switch_error"/);
  assert.match(functionBody("applyThreadDetailFirstPaintTelemetryEffect"), /postPerformanceEvent\(String\(item\.eventName \|\| ""\), item\.payload \|\| \{\}, item\.options \|\| \{\}\);/);
  assert.match(functionBody("applyThreadDetailFirstPaintTelemetryEffect"), /recordThreadDetailResponseDiagnostics\(item\.performanceEvent \|\| \{\}, \{/);
  assert.match(functionBody("applyThreadDetailFirstPaintTelemetryEffect"), /postClientEvent\(String\(item\.eventName \|\| ""\), item\.payload \|\| \{\}\);/);
  assert.match(appJs, /threadDetailDomPatchApi\.planConversationHtmlPerformanceEvent\(\{/);
  assert.match(appJs, /postPerformanceEvent\(performancePlan\.eventName, performancePlan\.payload, performancePlan\.options\)/);
  assert.match(mediaPreviewRuntimeJs, /postPerformanceEvent\("github_cards_hydrate_ms"/);
  assert.match(mediaPreviewRuntimeJs, /postPerformanceEvent\("mermaid_hydrate_ms"/);
  assert.match(appJs, /eventName: "thread_refresh_ms"/);
  assert.match(appJs, /state\.startupThreadOpenPending = hasStartupThreadOpenIntent\(\);[\s\S]*early_opening_rendered/);
  assert.match(appJs, /async function fetchPublicConfigWithRetry\(startedAt\)/);
  assert.match(appJs, /PUBLIC_CONFIG_RETRY_DELAYS_MS = \[0, 300, 1200\]/);
  assert.match(appJs, /fetchJsonWithTimeout\("\/api\/public-config"/);
  assert.match(appJs, /postStartupStage\("public_config_done"/);
  assert.match(appJs, /postStartupStage\("public_config_failed"/);
  assert.match(appJs, /requestHermesPluginRefresh\("public_config_failed", \{ force: true \}\)/);
  assert.match(appJs, /(?:const|var) deferStartupRestoreForTileMode = Boolean\([\s\S]*localThreadDisplayMode\(\) === "tile"[\s\S]*\);/);
  assert.match(appJs, /state\.startupThreadOpenPending = Boolean\([\s\S]*savedThreadId && !deferStartupRestoreForTileMode[\s\S]*startupPluginRouteHint && startupPluginRouteHint\.threadId[\s\S]*\);/);
  assert.match(appJs, /(?:const|var) earlyRestorePromise = savedThreadId && !startupThreadId && !deferStartupRestoreForTileMode[\s\S]*loadThread\(savedThreadId, \{ source: "restore-startup", suppressLoadFailureDiagnostic: true \}\)/);
  assert.match(appJs, /postStartupStage\("restore_deferred"[\s\S]*reason: "tile-startup"/);
  assert.match(appJs, /(?:const|var) status = await api\("\/api\/status"\)\.catch/);
  assert.match(appJs, /(?:const|var) workspacesStartedAt = nowPerfMs\(\);\s*\n\s*await loadWorkspaces\(\);/);
  assert.match(appJs, /await loadWorkspaces\(\);[\s\S]*await loadThreads\(\{ silent: startupThreadOpenPending, deferFallback: true \}\);/);
  assert.match(appJs, /postStartupStage\("status_done"/);
  assert.match(appJs, /postStartupStage\("threads_done"/);
  assert.match(appJs, /startupInProgress: false/);
  assert.match(appJs, /mobile_resume_skipped_startup/);
  assert.match(appJs, /await loadThreads\(\{ silent: startupThreadOpenPending, deferFallback: true \}\);/);
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
  assert.match(appJs, /function currentThreadNeedsForegroundRefresh\(\)/);
  assert.match(appJs, /function currentThreadListRowChanged\(\)/);
  assert.match(appJs, /threadUpdatedAtMs\(row\)/);
  assert.match(appJs, /mobile_resume_thread_refresh_scheduled/);
  assert.match(appJs, /function isTransientResumeError\(err\)/);
  assert.match(appJs, /function scheduleTransientResumeRetry\(reason, delay = 1200\)/);
  assert.match(appJs, /async function resumeMobileSession\(reason = "resume"\)[\s\S]*transient: isTransientResumeError\(err\)/);
  assert.match(appJs, /async function resumeMobileSession\(reason = "resume"\)[\s\S]*if \(isTransientResumeError\(err\)\) \{[\s\S]*scheduleTransientResumeRetry\(reason\);[\s\S]*return;/);
  assert.match(appJs, /function autoTurnRecoveryCandidate\(\)/);
  assert.match(appJs, /function autoTurnRecoveryCandidates\(\)/);
  assert.match(appJs, /function autoTurnRecoveryCandidates\(\)[\s\S]*for \(const thread of state\.restartAutoRecoverThreads \|\| \[\]\)/);
  assert.doesNotMatch(appJs, /function autoTurnRecoveryCandidates\(\)[\s\S]*for \(const thread of state\.threads \|\| \[\]\)[\s\S]*return Array\.from\(byId\.values\(\)\);/);
  assert.doesNotMatch(appJs, /function autoTurnRecoveryCandidates\(\)[\s\S]*const current = autoTurnRecoveryCandidate\(\)[\s\S]*return Array\.from\(byId\.values\(\)\);/);
  assert.match(appJs, /STORAGE_RESTART_AUTO_RECOVER_THREADS/);
  assert.match(appJs, /async function maybeAutoRecoverTurnAfterReconnect\(status, reason = "reconnect"\)/);
  assert.match(appJs, /\/auto-recover/);
  assert.match(appJs, /(?:const|var) recovered = wasUnavailable && status && status\.ready;/);
  assert.match(appJs, /maybeAutoRecoverTurnAfterReconnect\(payload\.status, "app-server-reconnect"\)/);
  assert.match(appJs, /if \(state\.currentThreadId && state\.currentThread && !state\.currentThread\.mobileLoading && !state\.currentThread\.mobileLoadError\) \{/);
  assert.match(appJs, /return shouldPollCurrentThread\(\) \|\| currentThreadListRowChanged\(\);/);
  assert.match(appJs, /(?:const|var) foregroundRefresh = currentThreadNeedsForegroundRefresh\(\);[\s\S]*mobile_resume_thread_refresh_scheduled[\s\S]*if \(foregroundRefresh\) scheduleCurrentThreadRefresh\(250, "resume"\);[\s\S]*else await refreshCurrentThread\(\{ source: "resume" \}\);[\s\S]*else if \(state\.currentThreadId\) \{[\s\S]*await refreshCurrentThread\(\{ source: "resume" \}\);[\s\S]*else \{[\s\S]*await restoreThreadSelection\(\);/);
  assert.match(threadListRuntimeJs, /function hasThreadDetailSelectionIntent\(\) \{[\s\S]*state\.currentThreadId[\s\S]*state\.threadLoadController[\s\S]*state\.startupThreadOpenPending/);
  assert.match(threadListRuntimeJs, /function shouldRenderPrimaryConversationShell\(\) \{[\s\S]*return !hasThreadDetailSelectionIntent\(\) && !state\.newThreadDraft;/);
  assert.match(threadListRuntimeFunctionBody("loadWorkspaces"), /if \(shouldRenderPrimaryConversationShell\(\)\) renderCurrentThread\(\);/);
  assert.match(threadListRuntimeFunctionBody("loadThreads"), /if \(shouldRenderPrimaryConversationShell\(\)\) renderCurrentThread\(\);/);
  assert.doesNotMatch(threadListRuntimeFunctionBody("loadWorkspaces"), /if \(!state\.currentThread\) renderCurrentThread\(\);/);
  assert.doesNotMatch(threadListRuntimeFunctionBody("loadThreads"), /if \(!state\.currentThread\) renderCurrentThread\(\);/);
  assert.match(appJs, /function showHermesPluginPrimaryPage\(options = \{\}\) \{[\s\S]*const force = options\.force === true;[\s\S]*plugin_primary_suppressed_thread_open/);
  assert.match(functionBody("showHermesPluginPrimaryPage"), /state\.threadLoadController[\s\S]*state\.startupThreadOpenPending[\s\S]*state\.currentThread && state\.currentThread\.mobileLoading/);
  assert.match(threadListRuntimeJs, /async function restoreThreadSelection\(\) \{[\s\S]*if \(hasThreadDetailSelectionIntent\(\)\) return;[\s\S]*showHermesPluginPrimaryPage\(\{ source: "restore-empty" \}\);[\s\S]*return;/);
  assert.match(functionBody("loadThread"), /const loadingShellPostStatePlan = threadDetailRenderPlanApi\.planThreadDetailLoadingShellPostStateEffects\(\{[\s\S]*threadId,[\s\S]*source,[\s\S]*\}\);/);
  assert.match(functionBody("loadThread"), /applyThreadDetailPostRenderEffectsPlan\(loadingShellPostStatePlan, \{ thread: state\.currentThread \}\);/);
  assert.doesNotMatch(functionBody("loadThread"), /renderCurrentThread\(\{ stickToBottom: true \}\);\s*\n\s*publishPluginNavigationState\(\{ force: true \}\);\s*\n\s*updateComposerControls\(\);/);
  assert.doesNotMatch(appJs, /function shouldOpenLargeThreadHistoryAtTop/);
  assert.doesNotMatch(appJs, /function threadOpenRenderOptions/);
  assert.doesNotMatch(appJs, /scrollConversationToTop/);
  assert.doesNotMatch(appJs, /scrollToTop/);
  assert.match(appJs, /(?:const|var) explicitNoStickToBottom = options\.stickToBottom === false \|\| Boolean\(options\.scrollToTurnReceiptStart\);/);
  assert.match(functionBody("updateScrollToBottomButton"), /conversationScroll\.planConversationJumpButtons\(\{/);
  assert.match(functionBody("updateScrollToBottomButton"), /hasThread: Boolean\(state\.currentThread\),/);
  assert.match(functionBody("updateScrollToBottomButton"), /nearBottom: isConversationNearBottom\(\),/);
  assert.match(functionBody("updateScrollToBottomButton"), /hasReplyTarget: Boolean\(replyNode\),/);
  assert.match(functionBody("updateScrollToBottomButton"), /replyTargetAbove: Boolean\(replyNode && isNodeStartAboveConversationViewport\(replyNode\)\),/);
  assert.match(functionBody("updateScrollToBottomButton"), /const shouldShow = Boolean\(jumpPlan\.showBottom\);/);
  assert.match(functionBody("updateScrollToBottomButton"), /const shouldShowReply = Boolean\(jumpPlan\.showReply\);/);
  assert.doesNotMatch(functionBody("updateScrollToBottomButton"), /!shouldShow[\s\S]*state\.currentThread[\s\S]*isNodeStartAboveConversationViewport/);
  assert.match(functionBody("loadThread"), /const cachedCurrentPostRenderPlan = threadDetailRenderPlanApi\.planThreadDetailCachedCurrentPostRenderEffects\(\{[\s\S]*threadId,[\s\S]*seq: state\.threadLoadSeq,[\s\S]*source: "cached-current",[\s\S]*replacedTilePane: replacedTilePaneForThreadListOpen,[\s\S]*hasSideChat: state\.threadSideChats\.has\(threadId\),[\s\S]*\}\);/);
  assert.match(functionBody("loadThread"), /applyThreadDetailPostRenderEffectsPlan\(cachedCurrentPostRenderPlan, \{ thread: state\.currentThread \}\);/);
  assert.doesNotMatch(functionBody("loadThread"), /maybeAutoBackfillThreadHistory\(state\.currentThread, \{ seq: state\.threadLoadSeq, source: "cached-current" \}\);/);
  assert.doesNotMatch(functionBody("loadThread"), /if \(replacedTilePaneForThreadListOpen\) \{[\s\S]*restoreDraftForCurrentTarget\(\{ resetRuntimeWhenMissingDraft: true \}\);[\s\S]*updateComposerControls\(\);[\s\S]*\}\s*\n\s*if \(isMenuOverlayMode\(\)\) closeSidebarMenu\(\);/);
  assert.match(functionBody("applyThreadDetailPostRenderEffect"), /maybeAutoBackfillThreadHistory\(context\.thread, \{[\s\S]*seq: Number\(item\.seq \|\| 0\),[\s\S]*source: String\(item\.source \|\| "unknown"\)\.slice\(0, 40\),[\s\S]*\}\);/);
  assert.match(functionBody("applyThreadDetailPostRenderEffect"), /restoreDraftForCurrentTarget\(\{ resetRuntimeWhenMissingDraft: true \}\);[\s\S]*renderComposerSettings\(\);[\s\S]*updateComposerControls\(\);/);
  assert.match(functionBody("applyThreadDetailPostRenderEffect"), /checkConversationProjectionConsistency\(String\(item\.phase \|\| ""\), \{[\s\S]*renderMode: String\(item\.renderMode \|\| ""\),[\s\S]*\}\);/);
  assert.match(functionBody("applyThreadDetailPostRenderEffect"), /recordEmptyCachedDetailReuseHealthy\(String\(item\.reason \|\| ""\), context\.thread\);/);
  assert.match(functionBody("applyThreadDetailPostRenderEffect"), /loadSideChat\(sideChatThreadId, \{ silent: item\.silent !== false \}\)\.catch\(showError\);/);
  assert.match(functionBody("applyThreadDetailPostRenderEffect"), /localStorage\.setItem\(STORAGE_THREAD_ID, threadId\);/);
  assert.match(functionBody("applyThreadDetailPostRenderEffect"), /draftStore\.setTargetKey\(""\);/);
  assert.match(functionBody("applyThreadDetailPostRenderEffect"), /followThreadOpenToBottom\(String\(item\.threadId \|\| ""\)\);/);
  assert.match(functionBody("applyThreadDetailPostRenderEffect"), /connectEvents\(\);/);
  assert.match(functionBody("applyThreadDetailPostRenderEffect"), /renderCurrentThread\(\{ stickToBottom: Boolean\(options\.stickToBottom\) \}\);/);
  assert.match(functionBody("applyThreadDetailPostRenderEffect"), /startThreadLoadWatchdog\(String\(item\.threadId \|\| ""\), \{ source: String\(item\.source \|\| ""\)\.slice\(0, 40\) \}\);/);
  assert.match(functionBody("startThreadLoadWatchdog"), /recordHomeAiDiagnosticFailure\(threadDiagnosticEventsApi\.threadDetailSlowPathDiagnosticEvent\(\{/);
  assert.match(functionBody("startThreadLoadWatchdog"), /reason: "api-pending"/);
  assert.match(functionBody("startThreadLoadWatchdog"), /thresholdMs: THREAD_LOAD_STALL_MS/);
  assert.match(functionBody("startThreadLoadWatchdog"), /threadHash: diagnosticThreadHash\(threadId\)/);
  assert.match(functionBody("loadThread"), /const firstPaintPreRenderPlan = threadDetailRenderPlanApi\.planThreadDetailFirstPaintPreRenderEffects\(\{[\s\S]*threadId,[\s\S]*hasEvents: Boolean\(state\.events\),[\s\S]*\}\);/);
  assert.match(functionBody("loadThread"), /const firstPaintPostMergeTimings = applyThreadDetailRefreshTimedPostMergeEntries\([\s\S]*firstPaintPostMergeTimingPlan\.beforeDraftRestore,[\s\S]*\{ mergeStartedAt \},[\s\S]*\);[\s\S]*applyThreadDetailPostRenderEffectsPlan\(firstPaintPreRenderPlan, \{ thread: state\.currentThread \}\);[\s\S]*const mergeMs = firstPaintPostMergeTimings\.mergeMs;/);
  assert.match(functionBody("loadThread"), /const draftRestoreStartedAt = nowPerfMs\(\);\s*\n\s*const firstPaintDraftRestorePlan = threadDetailRenderPlanApi\.planThreadDetailFirstPaintDraftRestoreEffects\(\);\s*\n\s*applyThreadDetailPostRenderEffectsPlan\(firstPaintDraftRestorePlan, \{ thread: state\.currentThread \}\);\s*\n\s*const draftRestoreMs = roundedDurationMs\(draftRestoreStartedAt\);/);
  assert.doesNotMatch(functionBody("loadThread"), /localStorage\.setItem\(STORAGE_THREAD_ID, threadId\);\s*\n\s*draftStore\.setTargetKey\(""\);\s*\n\s*followThreadOpenToBottom\(threadId\);\s*\n\s*if \(state\.events\) connectEvents\(\);/);
  assert.match(appJs, /renderCurrentThread\(\{ stickToBottom: true \}\);\s*\n\s*const conversationRenderMs = roundedDurationMs\(conversationRenderStartedAt\);\s*\n\s*const firstPaintAfterRenderPlan = threadDetailRenderPlanApi\.planThreadDetailFirstPaintAfterRenderEffects\(\{[\s\S]*seq,[\s\S]*source: "first-paint",[\s\S]*\}\);\s*\n\s*applyThreadDetailPostRenderEffectsPlan\(firstPaintAfterRenderPlan, \{ thread: state\.currentThread \}\);\s*\n\s*const postRenderStartedAt = nowPerfMs\(\);\s*\n\s*const firstPaintPostRenderPlan = threadDetailRenderPlanApi\.planThreadDetailFirstPaintPostRenderEffects\(\{[\s\S]*threadId,[\s\S]*seq,[\s\S]*source,[\s\S]*\}\);\s*\n\s*applyThreadDetailPostRenderEffectsPlan\(firstPaintPostRenderPlan, \{ thread: result\.thread \}\);/);
  assert.match(appJs, /(?:const|var) postRenderMs = roundedDurationMs\(postRenderStartedAt\);\s*\n\s*const firstPaintPostTimingPlan = threadDetailRenderPlanApi\.planThreadDetailFirstPaintPostTimingEffects\(\);\s*\n\s*applyThreadDetailPostRenderEffectsPlan\(firstPaintPostTimingPlan, \{ thread: result\.thread \}\);\s*\n\s*const renderElapsedMs = roundedDurationMs\(renderStartedAt\);/);
  assert.doesNotMatch(functionBody("loadThread"), /maybeAutoBackfillThreadHistory\(state\.currentThread, \{ seq, source: "first-paint" \}\);/);
  assert.doesNotMatch(functionBody("loadThread"), /checkConversationProjectionConsistency\("first-paint", \{ renderMode: "first-paint" \}\);/);
  assert.match(appJs, /(?:const|var) PLUGIN_EMBED_BACK_EDGE_SWIPE_PX = 44/);
  assert.match(appJs, /(?:const|var) PLUGIN_EMBED_BACK_SWIPE_HORIZONTAL_RATIO = 2\.2/);
  assert.match(appJs, /(?:const|var) PLUGIN_EMBED_BACK_RECENT_SCROLL_SUPPRESS_MS = 1200/);
  assert.match(appJs, /function installHermesPluginBackSwipeGuard\(\)/);
  assert.match(appJs, /pluginEmbedApi\.navigationMessage\(state, pluginNavigationUiState\(\)\)/);
  assert.doesNotMatch(appJs, /function pluginEmbedBackSwipeShouldExitHost\(\)/);
  assert.doesNotMatch(functionBody("pluginEmbedBackSwipeInteractiveTarget"), /#conversation/);
  assert.match(functionBody("installHermesPluginBackSwipeGuard"), /moved: false,[\s\S]*stopNativeBack\(event\);/);
  assert.match(functionBody("installHermesPluginBackSwipeGuard"), /vertical > 12 && vertical > horizontal/);
  assert.match(functionBody("installHermesPluginBackSwipeGuard"), /horizontal < vertical \* PLUGIN_EMBED_BACK_SWIPE_HORIZONTAL_RATIO/);
  assert.match(functionBody("shouldSuppressPluginBackForRecentConversationScroll"), /if \(source !== "plugin-back-swipe"\) return false;/);
  assert.match(functionBody("shouldSuppressPluginBackForRecentConversationScroll"), /plugin_back_suppressed_recent_conversation_scroll/);
  assert.match(functionBody("shouldSuppressPluginBackForRecentConversationScroll"), /PLUGIN_EMBED_BACK_RECENT_SCROLL_SUPPRESS_MS/);
  assert.match(functionBody("shouldSuppressPluginBackForRecentConversationScroll"), /consumedInIframe: true/);
  assert.match(functionBody("shouldSuppressPluginBackForRecentConversationScroll"), /postPluginBackResult\(true, "suppressed_recent_conversation_scroll"\)/);
  assert.match(appJs, /document\.addEventListener\("touchstart", startPluginBackSwipe, \{ passive: false, capture: true \}\)/);
  assert.doesNotMatch(appJs, /plugin_root_unhandled/);
  assert.match(appJs, /handlePluginBack\(\{\s*\n\s*preventDefault\(\) \{\},\s*\n\s*stopPropagation\(\) \{\},\s*\n\s*\}, \{ source: "plugin-back-swipe" \}\);/);
  assert.match(appJs, /source: "plugin-back-swipe"/);
  assert.match(appJs, /installPluginWindowingGuards\(\);\s*\n\s*installHermesPluginBackSwipeGuard\(\);/);
  assert.match(appJs, /(?:const|var) MAX_VISIBLE_TURNS = 10/);
  assert.match(appJs, /(?:const|var) MAX_EXPANDED_VISIBLE_TURNS = 200/);
  assert.match(appJs, /(?:const|var) THREAD_HISTORY_TOP_LOAD_PX = 64/);
  assert.match(threadDetailRuntimeJs, /threadDetailMergePolicy\.mergeThreadPreservingVisibleItems\(existingThread, incomingThread/);
  assert.match(threadDetailMergeStateJs, /Boolean\(incomingThread\.mobileOlderTurnsCursor\)/);
  assert.match(threadDetailMergeStateJs, /Number\(incomingThread\.mobileOmittedTurnCount \|\| 0\) > 0/);
  assert.match(threadDetailMergeStateJs, /preservedExpandedTurnCount \+= 1/);
  assert.match(threadDetailMergeStateJs, /merged\.mobileOmittedTurnCount = Math\.max\(0, Number\(merged\.mobileOmittedTurnCount \|\| 0\) - preservedExpandedTurnCount\)/);
  assert.match(appJs, /function loadOlderThreadTurns\(options = \{\}\)/);
  assert.match(appJs, /(?:const|var) preserveScroll = Boolean\(options\.preserveScroll\)/);
  assert.match(appJs, /let newlyLoadedTurnCount = 0/);
  assert.match(appJs, /if \(!existingTurn\) newlyLoadedTurnCount \+= 1/);
  assert.match(appJs, /targetThread\.mobileOmittedTurnCount = Math\.max\(0, Number\(targetThread\.mobileOmittedTurnCount \|\| 0\) - newlyLoadedTurnCount\)/);
  assert.match(appJs, /renderThreadHistoryLoadTarget\(threadId, \{ preserveScroll \}\)/);
  assert.match(appJs, /preserveConversationScrollAfterPrepend\(previousScrollTop, previousScrollHeight\)/);
  assert.match(appJs, /function threadHistoryLoadTarget\(options = \{\}\)/);
  assert.match(appJs, /function renderThreadHistoryLoadTarget\(threadId, options = \{\}\)/);
  assert.match(appJs, /function maybeLoadOlderThreadTurnsFromScroll\(\)/);
  assert.match(appJs, /conversation\.scrollTop > THREAD_HISTORY_TOP_LOAD_PX/);
  assert.match(appJs, /loadOlderThreadTurns\(\{ preserveScroll: true, source: "scroll-top" \}\)/);
  assert.match(appJs, /maybeLoadOlderThreadTurnsFromScroll\(\);/);
  assert.match(appJs, /function maybeAutoBackfillThreadHistory\(thread, options = \{\}\)/);
  assert.match(appJs, /planThreadDetailHistoryAutoBackfill\(\{/);
  assert.match(functionBody("maybeAutoBackfillThreadHistory"), /const effectsPlan = threadDetailRenderPlanApi\.planThreadDetailHistoryAutoBackfillEffects\(\{[\s\S]*plan,[\s\S]*key,[\s\S]*threadId,[\s\S]*seq,[\s\S]*source: String\(options\.source \|\| "unknown"\)\.slice\(0, 40\),[\s\S]*threadHash: diagnosticThreadHash\(threadId\),[\s\S]*readMode: String\(thread\.mobileReadMode \|\| ""\),[\s\S]*buildId: CLIENT_BUILD_ID,[\s\S]*\}\);/);
  assert.match(functionBody("maybeAutoBackfillThreadHistory"), /applyThreadDetailHistoryAutoBackfillEffectsPlan\(effectsPlan\);/);
  assert.doesNotMatch(functionBody("maybeAutoBackfillThreadHistory"), /postClientEvent\("thread_history_auto_backfill"/);
  assert.doesNotMatch(functionBody("maybeAutoBackfillThreadHistory"), /setTimeout\(\(\) => \{/);
  assert.match(functionBody("applyThreadDetailHistoryAutoBackfillEffect"), /postClientEvent\(String\(item\.eventName \|\| ""\), item\.payload \|\| \{\}\);/);
  assert.match(functionBody("applyThreadDetailHistoryAutoBackfillEffect"), /loadOlderThreadTurns\(\{[\s\S]*threadId,[\s\S]*preserveScroll: item\.preserveScroll !== false,[\s\S]*source: String\(item\.source \|\| "auto-context"\)\.slice\(0, 40\),[\s\S]*\}\)\.catch\(showError\);/);
  assert.match(appJs, /data-load-older-turns/);
  assert.match(functionBody("bindCurrentThreadActions"), /querySelectorAll\("\[data-load-older-turns\]"\)/);
  assert.match(functionBody("bindCurrentThreadActions"), /threadId: threadActionElementThreadId\(button\) \|\| thread && thread\.id \|\| ""/);
  assert.match(appJs, /cursor: threadTurnsCursorParam\(cursor\)/);
  assert.match(appJs, /mobileHistoryExpanded = true/);
  assert.match(appJs, /function shouldBackfillFullThreadDetail\(thread\)/);
  assert.match(appJs, /turns-list-initial/);
  assert.match(appJs, /function threadDetailApiPath\(threadId, params = \{\}\)/);
  assert.match(appJs, /api\(threadDetailApiPath\(threadId, \{ mode: "recent" \}\)/);
  assert.match(appJs, /async function refreshCurrentThread\(options = \{\}\)/);
  assert.match(functionBody("refreshCurrentThread"), /const requestPlan = threadDetailRenderPlanApi\.planThreadDetailRefreshRequest\(\{/);
  assert.match(functionBody("refreshCurrentThread"), /threadId: state\.currentThreadId,[\s\S]*threadLoadSeq: state\.threadLoadSeq,[\s\S]*options,[\s\S]*hasActiveRefreshController: Boolean\(state\.refreshThreadController\),[\s\S]*hasActiveThreadLoadController: Boolean\(state\.threadLoadController\),[\s\S]*documentHidden: document\.visibilityState === "hidden",/);
  assert.match(functionBody("refreshCurrentThread"), /if \(!requestPlan\.shouldRefresh\) \{[\s\S]*requestPlan\.reason === "thread-load-in-flight"[\s\S]*scheduleCurrentThreadRefresh\(700, requestPlan\.source \|\| "deferred-refresh"\);[\s\S]*return;[\s\S]*\}/);
  assert.match(functionBody("refreshCurrentThread"), /const requestedMode = requestPlan\.requestedMode;/);
  assert.match(functionBody("refreshCurrentThread"), /if \(requestPlan\.abortActiveRefresh && state\.refreshThreadController\) state\.refreshThreadController\.abort\(\);/);
  assert.match(functionBody("refreshCurrentThread"), /api\(threadDetailApiPath\(threadId, requestPlan\.query\), \{[\s\S]*timeoutMs: requestPlan\.timeoutMs,/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /const requestedMode = options\.full === true \|\| String\(options\.mode \|\| ""\)\.toLowerCase\(\) === "full"/);
  assert.match(functionBody("refreshCurrentThread"), /const failureEffectsPlan = threadDetailRenderPlanApi\.planThreadDetailRefreshFailureDiagnosticEffects\(\{[\s\S]*errorCode: diagnosticErrorCode\(err, "thread_detail_refresh_failed"\),[\s\S]*durationBucket: diagnosticDurationBucket\(roundedDurationMs\(refreshStartedAt\)\),[\s\S]*statusCode: diagnosticErrorStatus\(err\),[\s\S]*threadHash: diagnosticThreadHash\(threadId\),[\s\S]*\}\);/);
  assert.match(functionBody("refreshCurrentThread"), /applyThreadDetailRefreshFailureDiagnosticEffectsPlan\(failureEffectsPlan\);/);
  assert.match(appJs, /function applyThreadDetailRefreshFailureDiagnosticEffectsPlan\(plan\)/);
  assert.match(functionBody("applyThreadDetailRefreshFailureDiagnosticEffect"), /threadDiagnosticEventsApi\.threadDetailRefreshFailedDiagnosticEvent\(item\.diagnosticInput \|\| \{\}\)/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /recordHomeAiDiagnosticFailure\(\{[\s\S]*diagnostic_type: "thread_detail_refresh_failed"/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /recordHomeAiDiagnosticFailure\(threadDiagnosticEventsApi\.threadDetailRefreshFailedDiagnosticEvent\(\{/);
  assert.match(appJs, /(?:const|var) previousConversationSignature = conversationRenderSignature\(state\.currentThread\);/);
  assert.match(appJs, /(?:const|var) threadDetailRenderPlanApi = window\.CodexThreadDetailRenderPlan;/);
  assert.match(appJs, /(?:const|var) previousPatchShellSignature = conversationPatchShellSignature\(previousThread\);/);
  assert.match(appJs, /(?:const|var) refreshRenderStage = threadDetailRenderPlanApi\.planThreadDetailRefreshRenderStage\(\{[\s\S]*previousConversationSignature,[\s\S]*nextConversationSignature,[\s\S]*renderedConversationSignature: state\.renderedConversationSignature,[\s\S]*previousPatchShellSignature,[\s\S]*renderedPatchShellSignature: state\.renderedConversationPatchShellSignature,[\s\S]*nextVisibleShape,[\s\S]*\}\);/);
  assert.match(appJs, /(?:const|var) renderPlan = refreshRenderStage\.renderPlan;/);
  assert.match(functionBody("refreshCurrentThread"), /const shouldRenderDetail = renderPlan\.shouldRenderDetail;/);
  assert.match(functionBody("refreshCurrentThread"), /const postMergePlan = threadDetailRenderPlanApi\.planThreadDetailRefreshPostMergeEffects\(\);/);
  assert.match(appJs, /function applyThreadDetailRefreshTimedPostMergeEffectsGroup\(plan, timing, options = \{\}\)/);
  assert.match(appJs, /function applyThreadDetailRefreshTimedPostMergeEntries\(plan, entries, timings, options = \{\}\)/);
  assert.match(appJs, /function applyThreadDetailRefreshTimedPostMergeEffectsPlan\(plan, options = \{\}\)/);
  assert.match(functionBody("applyThreadDetailRefreshTimedPostMergeEffectsGroup"), /const startedAt = Number\.isFinite\(options\.startedAt\) \? options\.startedAt : nowPerfMs\(\);/);
  assert.match(functionBody("applyThreadDetailRefreshTimedPostMergeEffectsGroup"), /applyThreadDetailRefreshPostMergeEffectsGroup\(plan, timing\);/);
  assert.match(functionBody("applyThreadDetailRefreshTimedPostMergeEffectsGroup"), /return roundedDurationMs\(startedAt\);/);
  assert.match(functionBody("refreshCurrentThread"), /const postMergeTimings = applyThreadDetailRefreshTimedPostMergeEffectsPlan\(postMergePlan, \{[\s\S]*mergeStartedAt,[\s\S]*\}\);/);
  assert.match(functionBody("refreshCurrentThread"), /const mergeMs = postMergeTimings\.mergeMs;/);
  assert.match(functionBody("refreshCurrentThread"), /const composerRenderMs = postMergeTimings\.composerRenderMs;/);
  assert.match(functionBody("refreshCurrentThread"), /const threadListRenderMs = postMergeTimings\.threadListRenderMs;/);
  assert.match(functionBody("loadThread"), /const firstPaintResponsePlan = threadDetailRenderPlanApi\.planThreadDetailFirstPaintResponseEffects\(\{[\s\S]*source,[\s\S]*\}\);[\s\S]*applyThreadDetailRefreshResponseEffectsPlan\(firstPaintResponsePlan, \{ thread: result\.thread \}\);/);
  assert.match(functionBody("applyThreadDetailRefreshResponseEffect"), /if \(type === "sync-pending-server-requests"\) \{[\s\S]*syncThreadPendingServerRequests\(thread\);/);
  assert.match(functionBody("loadThread"), /const postMergePlan = threadDetailRenderPlanApi\.planThreadDetailRefreshPostMergeEffects\(\);/);
  assert.match(functionBody("loadThread"), /if \(cacheReusePlan\.shouldUseCachedCurrent\) \{[\s\S]*const postMergePlan = threadDetailRenderPlanApi\.planThreadDetailRefreshPostMergeEffects\(\);[\s\S]*applyThreadDetailRefreshPostMergeEffectsGroup\(postMergePlan, "merge"\);[\s\S]*const threadListRenderMs = applyThreadDetailRefreshTimedPostMergeEffectsGroup\(postMergePlan, "thread-list-render"\);/);
  assert.match(functionBody("loadThread"), /const firstPaintPostMergeTimingPlan = threadDetailRenderPlanApi\.planThreadDetailFirstPaintPostMergeTimingEffects\(postMergePlan\);/);
  assert.match(functionBody("loadThread"), /const mergeMs = firstPaintPostMergeTimings\.mergeMs;/);
  assert.match(functionBody("loadThread"), /const composerRenderMs = firstPaintPostMergeTimings\.composerRenderMs;/);
  assert.match(functionBody("loadThread"), /const threadListRenderMs = firstPaintPostMergeTimings\.threadListRenderMs;/);
  assert.match(functionBody("backfillFullThreadDetail"), /const fullBackfillResponsePlan = threadDetailRenderPlanApi\.planThreadDetailFullBackfillResponseEffects\(\{[\s\S]*source: options\.source \|\| "unknown",[\s\S]*\}\);[\s\S]*applyThreadDetailRefreshResponseEffectsPlan\(fullBackfillResponsePlan, \{ thread: result\.thread \}\);/);
  assert.match(functionBody("backfillFullThreadDetail"), /const postMergePlan = threadDetailRenderPlanApi\.planThreadDetailRefreshPostMergeEffects\(\);/);
  assert.match(functionBody("backfillFullThreadDetail"), /const postMergeTimings = applyThreadDetailRefreshTimedPostMergeEffectsPlan\(postMergePlan, \{[\s\S]*mergeStartedAt,[\s\S]*\}\);/);
  assert.match(functionBody("backfillFullThreadDetail"), /const mergeMs = postMergeTimings\.mergeMs;/);
  assert.match(functionBody("backfillFullThreadDetail"), /const composerRenderMs = postMergeTimings\.composerRenderMs;/);
  assert.match(functionBody("backfillFullThreadDetail"), /const threadListRenderMs = postMergeTimings\.threadListRenderMs;/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /let detailRenderMode = renderPlan\.detailRenderMode;/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /mergeThreadIntoThreadList\(state\.currentThread\);\s*const mergeMs/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /renderComposerSettings\(\);\s*syncActiveTurnFromThread\(\);/);
  assert.match(functionBody("refreshCurrentThread"), /const patchSurfaceProbeStage = threadDetailRenderPlanApi\.planThreadDetailRefreshPatchSurfaceProbeStage\(\{/);
  assert.match(functionBody("refreshCurrentThread"), /shouldRenderDetail,[\s\S]*threadTileMode: state\.threadTileMode,[\s\S]*threadTileConversationSurface,[\s\S]*threadId,/);
  assert.match(functionBody("refreshCurrentThread"), /const tilePatchPlan = applyThreadDetailRefreshPatchSurfaceProbeEffectsPlan\([\s\S]*patchSurfaceProbeStage\.patchSurfaceProbeEffectsPlan,[\s\S]*\{ threadId \},[\s\S]*\);/);
  assert.match(appJs, /function applyThreadDetailRefreshPatchSurfaceProbeEffectsPlan\(plan, context = \{\}\)/);
  assert.match(functionBody("applyThreadDetailRefreshPatchSurfaceProbeEffect"), /threadDetailDomPatchSurface\(\{[\s\S]*threadId: String\(item\.threadId \|\| context\.threadId \|\| ""\),[\s\S]*\}\);/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /patchSurfaceProbePlan\.shouldProbeTilePatchSurface[\s\S]*\? threadDetailDomPatchSurface/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /planThreadDetailRefreshPatchSurface\(\{/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /planThreadDetailRefreshPatchSurfaceProbeEffects\(\{/);
  assert.match(functionBody("refreshCurrentThread"), /const patchSurfaceExecutionStage = threadDetailRenderPlanApi\.planThreadDetailRefreshPatchSurfaceExecutionStage\(\{[\s\S]*shouldRenderDetail,[\s\S]*renderPlan,[\s\S]*threadTileMode: state\.threadTileMode,[\s\S]*threadTileConversationSurface,[\s\S]*tilePatchPlan,[\s\S]*\}\);/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /planThreadDetailRefreshPatchSurfaceResultStage\(\{/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /planThreadDetailRefreshPatchExecutionStage\(\{/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /const patchExecutionPlan = patchExecutionStage\.patchExecutionPlan;/);
  assert.match(functionBody("refreshCurrentThread"), /const patchAttemptEffectsPlan = patchSurfaceExecutionStage\.patchAttemptEffectsPlan;/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /canPatch: renderPlan\.canPatch/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /tileSurfaceRefresh: patchSurfacePlan\.tileSurfaceRefresh/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /tilePatchPlan && tilePatchPlan\.surface === "thread-tile-pane"/);
  assert.match(functionBody("refreshCurrentThread"), /const patchAttempt = applyThreadDetailRefreshPatchAttemptEffectsPlan\(patchAttemptEffectsPlan, \{/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /let locallyPatchedDetail = false;/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /let tilePanePatchedDetail = false;/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /tilePanePatchedDetail = patchAttempt\.tilePanePatchedDetail;/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /locallyPatchedDetail = patchAttempt\.locallyPatchedDetail;/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /if \(patchExecutionPlan\.tryTilePanePatch\)/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /if \(shouldRenderDetail && !tilePanePatchedDetail && patchExecutionPlan\.tryLocalPatch\)/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /renderPlan\.canPatch && !tileSurfaceRefresh/);
  assert.match(appJs, /function applyThreadDetailRefreshPatchAttemptEffectsPlan\(plan, context = \{\}\)/);
  assert.match(functionBody("applyThreadDetailRefreshPatchAttemptEffectsPlan"), /let result = threadDetailRenderPlanApi\.emptyThreadDetailRefreshPatchAttempt\(\);/);
  assert.match(functionBody("applyThreadDetailRefreshPatchAttemptEffectsPlan"), /threadDetailRenderPlanApi\.threadDetailRefreshPatchAttemptEffectContext\(context, result\)/);
  assert.match(functionBody("applyThreadDetailRefreshPatchAttemptEffectsPlan"), /threadDetailRenderPlanApi\.reduceThreadDetailRefreshPatchAttempt\(result, attempt\)/);
  assert.doesNotMatch(functionBody("applyThreadDetailRefreshPatchAttemptEffectsPlan"), /tilePanePatchMs \+=/);
  assert.doesNotMatch(functionBody("applyThreadDetailRefreshPatchAttemptEffectsPlan"), /localPatchMs \+=/);
  assert.match(functionBody("applyThreadDetailRefreshPatchAttemptEffect"), /patchCurrentThreadTilePaneFromState\(\{[\s\S]*threadId: context\.threadId,[\s\S]*preserveScroll: item\.preserveScroll !== false,/);
  assert.match(functionBody("applyThreadDetailRefreshPatchAttemptEffect"), /patchCurrentThreadDetailFromRefresh\([\s\S]*context\.previousThread,[\s\S]*state\.currentThread,[\s\S]*context\.previousConversationSignature,/);
  assert.match(functionBody("applyThreadDetailRefreshPatchAttemptEffect"), /const patchResult = patchCurrentThreadDetailFromRefresh\(/);
  assert.match(functionBody("applyThreadDetailRefreshPatchAttemptEffect"), /patchRejectReason: patched \? "" : String\(\(patchResult && patchResult\.reason\) \|\| "unknown"\)/);
  assert.match(functionBody("applyThreadDetailRefreshPatchAttemptEffect"), /item\.skipWhenTilePanePatched && context\.tilePanePatchedDetail/);
  assert.match(functionBody("refreshCurrentThread"), /const patchAttemptResultEvidenceStage = threadDetailRenderPlanApi\.planThreadDetailRefreshPatchAttemptResultEvidenceStage\(\{/);
  assert.match(functionBody("refreshCurrentThread"), /patchAttempt,[\s\S]*renderPlan,[\s\S]*readMode: result\.thread && result\.thread\.mobileReadMode/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /let patchAttemptResultStage = patchAttemptResultEvidenceStage\.patchAttemptResultStage;/);
  assert.match(functionBody("refreshCurrentThread"), /const patchRejectedVisibleShapeEvidence = applyThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffectsPlan\([\s\S]*patchAttemptResultEvidenceStage\.visibleShapeEvidenceEffectsPlan,[\s\S]*previousThread,[\s\S]*nextThread: state\.currentThread,[\s\S]*\);/);
  assert.match(functionBody("refreshCurrentThread"), /const patchAttemptResultResolutionStage = threadDetailRenderPlanApi\.planThreadDetailRefreshPatchAttemptResultEvidenceResolutionStage\(\{/);
  assert.match(functionBody("refreshCurrentThread"), /patchAttemptResultStage: patchAttemptResultEvidenceStage\.patchAttemptResultStage,[\s\S]*visibleShapeEvidence: patchRejectedVisibleShapeEvidence,/);
  assert.match(functionBody("refreshCurrentThread"), /const patchAttemptResultStage = patchAttemptResultResolutionStage\.patchAttemptResultStage;/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /if \(patchRejectedVisibleShapeEvidence\.collected\)/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /planThreadDetailRefreshPatchAttemptResultEvidenceCompletionStage\(\{/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /previousVisibleShape: visibleConversationShape\(previousThread\)/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /nextVisibleShape: visibleConversationShape\(state\.currentThread\)/);
  assert.match(functionBody("refreshCurrentThread"), /const patchAttemptResult = patchAttemptResultStage\.patchAttemptResult;/);
  assert.match(appJs, /function applyThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffectsPlan\(plan, context = \{\}\)/);
  assert.match(functionBody("applyThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffect"), /previousVisibleShape: visibleConversationShape\(context\.previousThread\)/);
  assert.match(functionBody("applyThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffect"), /nextVisibleShape: visibleConversationShape\(context\.nextThread\)/);
  assert.match(functionBody("rejectThreadDetailPatch"), /threadDetailDomPatchApi\.threadDetailPatchResult\(false, reason \|\| "unknown"\)/);
  assert.match(functionBody("acceptThreadDetailPatch"), /threadDetailDomPatchApi\.threadDetailPatchResult\(true, reason \|\| "patched"\)/);
  assert.doesNotMatch(appJs, /threadDetailPatchRejectReason/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /locallyPatchedDetail = patchAttemptResult\.locallyPatchedDetail;/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /tilePanePatchedDetail = patchAttemptResult\.tilePanePatchedDetail;/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /detailPatchMs = patchAttemptResult\.detailPatchMs;/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /patchRejectReason = patchAttemptResult\.patchRejectReason;/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /threadDetailRenderPlanApi\.planThreadDetailRefreshPatchAttemptResultStage\(\{/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /planThreadDetailRefreshPatchAttemptResult\(\{/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /planThreadDetailRefreshPatchRejectedDiagnostic\(\{/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /planThreadDetailRefreshPatchRejectedDiagnosticEffects\(\{/);
  assert.match(functionBody("refreshCurrentThread"), /applyThreadDetailRefreshPatchRejectedDiagnosticEffectsPlan\(patchAttemptResultStage\.patchRejectedDiagnosticEffectsPlan\);/);
  assert.match(appJs, /function applyThreadDetailRefreshPatchRejectedDiagnosticEffectsPlan\(plan\)/);
  assert.match(functionBody("applyThreadDetailRefreshPatchRejectedDiagnosticEffect"), /threadDiagnosticEventsApi\.detailPatchRejectedDiagnosticEvent\(item\.diagnosticInput \|\| \{\}\)/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /if \(patchRejectedDiagnosticPlan\.shouldReport\)/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /let renderOutcome = null;/);
  assert.match(functionBody("refreshCurrentThread"), /const outcomeExecutionStage = threadDetailRenderPlanApi\.planThreadDetailRefreshOutcomeExecutionStage\(\{/);
  assert.match(functionBody("refreshCurrentThread"), /renderPlan,[\s\S]*patchAttemptResult,/);
  assert.match(functionBody("refreshCurrentThread"), /const renderOutcome = outcomeExecutionStage\.renderOutcome;/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /locallyPatchedDetail = renderOutcome\.locallyPatchedDetail;/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /tilePanePatchedDetail = renderOutcome\.tilePanePatchedDetail;/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /finalizeThreadDetailRenderPlan\(renderPlan, patchAttemptResult\.finalizeResult\)/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /refreshRenderAction = renderOutcome\.renderAction;/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /planThreadDetailRefreshOutcomeExecution\(renderOutcome\)/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /planThreadDetailRefreshExecutionEffects\(executionPlan\)/);
  assert.match(functionBody("refreshCurrentThread"), /const executionTimings = applyThreadDetailRefreshExecutionEffectsPlan\(outcomeExecutionStage\.executionEffectsPlan\);/);
  assert.match(functionBody("refreshCurrentThread"), /metadataUpdateMs \+= executionTimings\.metadataUpdateMs;/);
  assert.match(functionBody("refreshCurrentThread"), /conversationRenderMs \+= executionTimings\.conversationRenderMs;/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /for \(const effect of executionEffects\)/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /executionPlan\.executionAction === "metadata-effects"/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /executionPlan\.executionAction === "full-render"/);
  assert.match(appJs, /function applyThreadDetailRefreshExecutionEffectsPlan\(plan\)/);
  assert.match(functionBody("applyThreadDetailRefreshExecutionEffectsPlan"), /for \(const effect of effects\) \{/);
  assert.match(functionBody("applyThreadDetailRefreshExecutionEffectsPlan"), /applyThreadDetailRefreshExecutionEffect\(effect\)/);
  assert.match(appJs, /function applyThreadDetailRefreshExecutionEffect\(effect\)/);
  assert.match(functionBody("applyThreadDetailRefreshExecutionEffect"), /Thread detail refresh metadata effects are empty/);
  assert.match(functionBody("applyThreadDetailRefreshExecutionEffect"), /for \(const metadataEffect of metadataEffects\) applyThreadDetailRefreshMetadataEffect\(metadataEffect\);/);
  assert.match(functionBody("applyThreadDetailRefreshExecutionEffect"), /renderCurrentThread\(\);/);
  assert.match(functionBody("applyThreadDetailRefreshExecutionEffect"), /Unknown thread detail refresh execution action/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /planThreadDetailRefreshConsistencyCheckEffects\(executionPlan\.consistencyCheck \|\| \{\}\)/);
  assert.match(functionBody("refreshCurrentThread"), /applyThreadDetailRefreshConsistencyCheckEffectsPlan\(outcomeExecutionStage\.consistencyCheckEffectsPlan\);/);
  assert.match(functionBody("applyThreadDetailRefreshConsistencyCheckEffect"), /checkConversationProjectionConsistency\(String\(item\.phase \|\| ""\), \{ renderMode: String\(item\.renderMode \|\| ""\) \}\);/);
  assert.match(appJs, /function applyThreadDetailRefreshMetadataEffect\(effect\)/);
  assert.match(functionBody("applyThreadDetailRefreshMetadataEffect"), /updateCurrentThreadHeader\(state\.currentThread\)/);
  assert.match(functionBody("applyThreadDetailRefreshMetadataEffect"), /updateLiveOperationDockHtml\(renderLiveOperationDock\(state\.currentThread, existingConversationRenderKeys\(\)\)\)/);
  assert.match(functionBody("applyThreadDetailRefreshMetadataEffect"), /publishPluginNavigationState\(\)/);
  assert.match(functionBody("applyThreadDetailRefreshMetadataEffect"), /scheduleScrollToBottomButtonUpdate\(\)/);
  assert.match(functionBody("refreshCurrentThread"), /const refreshReportingStage = threadDetailRenderPlanApi\.planThreadDetailRefreshReportingStage\(\{/);
  assert.match(functionBody("refreshCurrentThread"), /shouldRenderDetail,[\s\S]*renderPlan,[\s\S]*renderOutcome,[\s\S]*patchAttemptResult,[\s\S]*timings: \{/);
  assert.match(functionBody("refreshCurrentThread"), /eventName: "thread_refresh_ms",[\s\S]*throttleKey: "thread_refresh_ms",[\s\S]*minIntervalMs: PERF_EVENT_THROTTLE_MS,[\s\S]*action: "thread-detail-refresh",[\s\S]*threadHash: diagnosticThreadHash\(threadId\),/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /planThreadDetailRefreshPerformanceInput\(\{/);
  assert.match(functionBody("refreshCurrentThread"), /const refreshPerformance = threadPerformanceMetrics\.threadDetailRefreshEventFields\([\s\S]*result\.thread,[\s\S]*refreshReportingStage\.performanceInput,[\s\S]*\);/);
  assert.match(functionBody("refreshCurrentThread"), /const refreshReportingEffectsStage = threadDetailRenderPlanApi\.planThreadDetailRefreshReportingEffectsStage\(\{/);
  assert.match(functionBody("refreshCurrentThread"), /performanceEvent: refreshPerformance,[\s\S]*telemetryConfig: refreshReportingStage\.telemetryConfig,[\s\S]*completionConfig: refreshReportingStage\.completionConfig,/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /planThreadDetailRefreshTelemetryEffects\(\{/);
  assert.match(functionBody("refreshCurrentThread"), /applyThreadDetailRefreshTelemetryEffectsPlan\(refreshReportingEffectsStage\.telemetryEffectsPlan, \{ thread: result\.thread \}\);/);
  assert.match(appJs, /function applyThreadDetailRefreshTelemetryEffectsPlan\(plan, context = \{\}\)/);
  assert.match(functionBody("applyThreadDetailRefreshTelemetryEffect"), /postPerformanceEvent\(String\(item\.eventName \|\| ""\), item\.payload \|\| \{\}, item\.options \|\| \{\}\);/);
  assert.match(functionBody("applyThreadDetailRefreshTelemetryEffect"), /recordThreadDetailResponseDiagnostics\(item\.performanceEvent \|\| \{\}, \{[\s\S]*action: String\(eventContext\.action \|\| ""\),[\s\S]*threadId: String\(eventContext\.threadId \|\| ""\),[\s\S]*thread: context\.thread,[\s\S]*\}\);/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /planThreadDetailRefreshCompletionEffects\(\{/);
  assert.match(functionBody("refreshCurrentThread"), /applyThreadDetailRefreshCompletionEffectsPlan\(refreshReportingEffectsStage\.completionEffectsPlan\);/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /for \(const effect of completionPlan\.effects\) applyThreadDetailRefreshCompletionEffect\(effect\);/);
  assert.match(functionBody("loadThread"), /const firstPaintPostRenderPlan = threadDetailRenderPlanApi\.planThreadDetailFirstPaintPostRenderEffects\(\{[\s\S]*threadId,[\s\S]*seq,[\s\S]*source,[\s\S]*\}\);/);
  assert.match(functionBody("loadThread"), /applyThreadDetailPostRenderEffectsPlan\(firstPaintPostRenderPlan, \{ thread: result\.thread \}\);/);
  assert.match(appJs, /function applyThreadDetailPostRenderEffectsPlan\(plan, context = \{\}\)/);
  assert.match(appJs, /function applyThreadDetailRefreshCompletionEffectsPlan\(plan\)/);
  assert.match(functionBody("applyThreadDetailRefreshCompletionEffectsPlan"), /for \(const effect of effects\) applyThreadDetailRefreshCompletionEffect\(effect\);/);
  assert.match(appJs, /function applyThreadDetailRefreshCompletionEffect\(effect\)/);
  assert.match(functionBody("applyThreadDetailRefreshCompletionEffect"), /recordHomeAiDiagnosticSuccess\(item\.payload \|\| \{\}\)/);
  assert.match(functionBody("applyThreadDetailRefreshCompletionEffect"), /scheduleUsageBackfillRefresh\(\)/);
  assert.match(functionBody("applyThreadDetailRefreshCompletionEffect"), /scheduleLivePollIfNeeded\(\)/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /recordHomeAiDiagnosticSuccess\(\{[\s\S]*thread_detail_refresh_failed/);
  assert.doesNotMatch(functionBody("refreshCurrentThread"), /skippedDetailRender: !shouldRenderDetail/);
  assert.match(appJs, /function rejectThreadDetailPatch\(reason\)/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /threadDetailPatchPlanApi\.planThreadDetailRefreshLocalPatchPreflight\(\{[\s\S]*stage: "root"/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /threadDetailPatchPlanApi\.planThreadDetailRefreshLocalPatchPreflight\(\{[\s\S]*singleThreadSurfaceAvailable: canPatchSingleThreadConversationDom/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /if \(!preflightPlan\.canPatch\) return rejectThreadDetailPatch\(preflightPlan\.reason\);/);
  assert.doesNotMatch(functionBody("patchCurrentThreadDetailFromRefresh"), /rejectThreadDetailPatch\("rendered-dom-stale"\)/);
  assert.doesNotMatch(functionBody("patchCurrentThreadDetailFromRefresh"), /rejectThreadDetailPatch\("patch-shell-changed"\)/);
  assert.match(appJs, /function conversationRootSignature\(thread\)/);
  assert.match(appJs, /function conversationPatchShellSignature\(thread\)/);
  assert.match(appJs, /renderedConversationPatchShellSignature: ""/);
  assert.match(functionBody("updateConversationHtml"), /threadDetailDomPatchApi\.planConversationHtmlUpdate\(\{/);
  assert.match(functionBody("updateConversationHtml"), /patchShellSignature: options\.patchShellSignature,/);
  assert.match(functionBody("updateConversationHtml"), /threadDetailDomPatchApi\.planConversationHtmlUpdateEffects\(updatePlan\)/);
  assert.match(functionBody("updateConversationHtml"), /applyConversationHtmlUpdateEffectsPlan\(effectsPlan, \{ root: conversation \}\)/);
  assert.doesNotMatch(functionBody("updateConversationHtml"), /state\.renderedConversationPatchShellSignature = updatePlan\.nextRenderedConversationPatchShellSignature;/);
  assert.match(appJs, /function rolloutWarningSignature\(thread\)/);
  assert.doesNotMatch(functionBody("conversationRootSignature"), /rolloutSizeBytes: rolloutSizeBytes\(thread\)/);
  assert.doesNotMatch(functionBody("conversationRenderSignature"), /rolloutSizeBytes: rolloutSizeBytes\(thread\)/);
  assert.match(functionBody("conversationRootSignature"), /rolloutWarning: rolloutWarningSignature\(thread\)/);
  assert.match(functionBody("conversationPatchShellSignature"), /rolloutWarning: rolloutWarningSignature\(thread\)/);
  assert.doesNotMatch(functionBody("conversationPatchShellSignature"), /projectionRevision/);
  assert.doesNotMatch(functionBody("conversationPatchShellSignature"), /visibleItemKeys/);
  assert.match(functionBody("conversationRenderSignature"), /rolloutWarning: rolloutWarningSignature\(thread\)/);
  assert.match(functionBody("conversationRootSignature"), /visibleTurns: turns\.map\(\(turn\) => turn && \(turn\.id \|\| turn\.startedAt \|\| ""\)\)/);
  assert.match(appJs, /function patchVisibleItemDom\(turn, item\)/);
  assert.match(appJs, /function insertVisibleItemDom\(turn, item\)/);
  assert.match(appJs, /function insertTurnArticleDom\(turn, previousKeys = existingConversationRenderKeys\(\)\)/);
  assert.match(appJs, /function insertTurnArticleElementDom\(turn, source\)/);
  assert.match(appJs, /function patchCurrentThreadDetailFromRefresh\(previousThread, nextThread, previousConversationSignature\)/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /const previousPatchShellSignature = conversationPatchShellSignature\(previousThread\);/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /renderedConversationSignature: state\.renderedConversationSignature/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /previousConversationSignature,/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /nextPatchShellSignature: conversationPatchShellSignature\(nextThread\)/);
  assert.doesNotMatch(functionBody("patchCurrentThreadDetailFromRefresh"), /state\.renderedConversationSignature !== previousConversationSignature/);
  assert.doesNotMatch(functionBody("patchCurrentThreadDetailFromRefresh"), /previousPatchShellSignature !== conversationPatchShellSignature\(nextThread\)/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /threadDetailDomPatchApi\.applyThreadDetailPatchTransaction\(\{/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /applyPatch: \(\) => threadDetailDomPatchApi\.applyThreadTurnRefreshDomPatch\(\{/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /const transactionEffectsPlan = threadDetailDomPatchApi\.planThreadDetailRefreshLocalPatchTransactionEffects\(\{/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /const transactionCallbacks = threadDetailRefreshLocalPatchTransactionCallbacks\(transactionEffectsPlan, \{/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /commitEffects: transactionCallbacks\.commitEffects/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /afterSuccess: transactionCallbacks\.afterSuccess/);
  assert.match(functionBody("threadDetailRefreshLocalPatchTransactionCallback"), /type === "complete-local-conversation-dom-update"/);
  assert.match(functionBody("threadDetailRefreshLocalPatchTransactionCallback"), /type === "update-live-operation-dock"/);
  assert.match(functionBody("threadDetailRefreshLocalPatchTransactionCallback"), /updateLiveOperationDockHtml\(renderLiveOperationDock\(context\.nextThread, context\.previousKeys\)\)/);
  assert.match(functionBody("threadDetailRefreshLocalPatchTransactionCallback"), /type === "bind-current-thread-actions"/);
  assert.doesNotMatch(functionBody("patchCurrentThreadDetailFromRefresh"), /commitEffects: \[[\s\S]*name: "complete-local-conversation-dom-update"/);
  assert.doesNotMatch(functionBody("patchCurrentThreadDetailFromRefresh"), /afterSuccess: \[[\s\S]*name: "update-live-operation-dock"/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /const scrollPlan = conversationScroll\.planLocalPatchScrollCompletion\(\{/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /const completionSnapshot = threadDetailDomPatchApi\.planLocalConversationDomUpdateCompletionSnapshot\(\{/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /scrollAction: scrollPlan\.action/);
  assert.match(functionBody("threadDetailRefreshLocalPatchTransactionCallback"), /completeLocalConversationDomUpdate\([\s\S]*context\.conversation,[\s\S]*context\.wasNearBottom,[\s\S]*context\.userReadingCurrentTurn,[\s\S]*\{ completionSnapshot: item\.completionSnapshot \|\| \{\} \},/);
  assert.doesNotMatch(functionBody("patchCurrentThreadDetailFromRefresh"), /const completionSnapshot = \{/);
  assert.doesNotMatch(functionBody("patchCurrentThreadDetailFromRefresh"), /updateLiveOperationDockHtml\(renderLiveOperationDock\(nextThread, previousKeys\)\);\s*const applyResult = threadDetailDomPatchApi\.applyThreadTurnRefreshDomPatch/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /patchNode\(article, source\);/);
  assert.match(functionBody("insertVisibleItemDom"), /if \(isOperationalItem\(item\)\) return updateLiveOperationDockForLocalPatch\(\);/);
  assert.match(functionBody("insertVisibleItemDom"), /article = insertTurnArticleDom\(turn, previousKeys\);/);
  assert.match(functionBody("insertVisibleItemDom"), /threadDetailDomPatchApi\.insertVisibleItemElement\(\{/);
  assert.doesNotMatch(functionBody("insertVisibleItemDom"), /for \(let index = visibleIndex - 1/);
  assert.match(functionBody("insertTurnArticleElementDom"), /threadDetailDomPatchApi\.insertTurnArticleElement/);
  assert.doesNotMatch(functionBody("insertTurnArticleElementDom"), /for \(let index = turnIndex - 1/);
  assert.match(functionBody("turnArticleNode"), /threadDetailDomPatchApi\.findTurnArticleElement/);
  assert.match(functionBody("turnArticleNode"), /turnKey: key/);
  assert.doesNotMatch(functionBody("turnArticleNode"), /conversation\.querySelector\(`\[data-render-key=/);
  assert.match(functionBody("firstElementFromHtml"), /threadDetailDomPatchApi\.createElementFromHtml/);
  assert.match(functionBody("insertTurnArticleDom"), /threadDetailDomPatchApi\.createTurnArticleElement/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /renderTurnElement: \(turn\) => threadDetailDomPatchApi\.createTurnArticleElement/);
  assert.match(functionBody("hydrateThreadDetailSurface"), /threadDetailDomPatchApi\.hydrateRenderedSurface/);
  assert.match(functionBody("updateConversationHtml"), /applyConversationHtmlUpdateEffectsPlan\(effectsPlan, \{ root: conversation \}\)/);
  assert.match(functionBody("applyThreadDetailDomUpdateEffect"), /hydrateThreadDetailSurface\(context\.root, item\.hydrateOptions \|\| \{\}\)/);
  assert.match(threadTileRuntimeFunctionBody("patchThreadTilePane"), /hydrateThreadDetailSurface\(patchedPane, \{ imageScanDelays: \[0, 180\] \}\)/);
  assert.match(appJs, /function completeLocalConversationDomUpdate\(root, wasNearBottom, userReadingCurrentTurn, options = \{\}\)/);
  assert.match(functionBody("completeLocalConversationDomUpdate"), /threadDetailDomPatchApi\.planLocalConversationDomUpdateCompletionSnapshot\(\{/);
  assert.match(functionBody("completeLocalConversationDomUpdate"), /threadDetailDomPatchApi\.planLocalConversationDomUpdateCompletion\(completionSnapshot\)/);
  assert.match(functionBody("completeLocalConversationDomUpdate"), /const scrollPlan = options && options\.scrollPlan/);
  assert.match(functionBody("completeLocalConversationDomUpdate"), /const effectsPlan = threadDetailDomPatchApi\.planLocalConversationDomUpdateCompletionEffects\(completionPlan\);/);
  assert.match(functionBody("applyThreadDetailDomUpdateEffect"), /hydrateThreadDetailSurface\(context\.root, item\.hydrateOptions \|\| \{\}\);/);
  assert.match(functionBody("upsertItem"), /if \(structureChanged\) scheduleRenderCurrentThread\(\);[\s\S]*else if \(canPatchExistingItem\)[\s\S]*else if \(!insertVisibleItemDom\(turn, nextItem\)\)/);
  assert.match(functionBody("appendToItem"), /if \(isOperationalItem\(item\)\) updateLiveOperationDockForLocalPatch\(\);[\s\S]*else if \(createdItem\) \{/);
  assert.match(stylesCss, /\.live-operation-dock\s*{[\s\S]*min-height:\s*var\(--live-operation-dock-compact-height, 40px\);[\s\S]*contain:\s*layout paint;/);
  assert.match(stylesCss, /\.live-operation-dock:not\(\[data-mode="expanded"\]\)\s*{[\s\S]*height:\s*var\(--live-operation-dock-compact-height, 40px\);/);
  assert.match(stylesCss, /\.live-operation-dock:not\(\[data-mode="expanded"\]\) \.live-operation\s*{[\s\S]*height:\s*32px;[\s\S]*max-height:\s*32px;/);
  assert.match(stylesCss, /@media \(pointer: coarse\)[\s\S]*\.live-operation-dock\s*{[\s\S]*position:\s*fixed;[\s\S]*bottom:\s*calc\(var\(--composer-height, 92px\) \+ 8px\);/);
  assert.match(stylesCss, /@media \(pointer: coarse\)[\s\S]*\.live-operation-dock-desktop\s*{[\s\S]*display:\s*none;/);
  assert.match(stylesCss, /@media \(pointer: coarse\)[\s\S]*\.mobile-operation-stack\s*{[\s\S]*display:\s*grid;/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.live-operation-dock\s*{[\s\S]*position:\s*fixed;[\s\S]*bottom:\s*calc\(var\(--composer-height, 92px\) \+ 8px\);/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.live-operation-dock:not\(\[data-mode="expanded"\]\)\s*{[\s\S]*height:\s*auto;/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.mobile-operation-bubble\s*{[\s\S]*max-width:\s*min\(78vw, 420px\);/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.mobile-operation-sheet\s*{[\s\S]*max-height:\s*min\(42vh, 280px\);/);
  assert.match(functionBody("applyThreadDetailPostRenderEffect"), /if \(shouldBackfillFullThreadDetail\(context\.thread\)\) \{/);
  assert.match(functionBody("applyThreadDetailPostRenderEffect"), /backfillFullThreadDetail\(String\(item\.threadId \|\| ""\), \{[\s\S]*seq: Number\(item\.seq \|\| 0\),[\s\S]*source: String\(item\.source \|\| ""\)\.slice\(0, 40\),[\s\S]*\}\)\.catch\(\(\) => \{\}\)/);
  assert.match(functionBody("backfillFullThreadDetail"), /threadDetailRenderPlanApi\.planThreadDetailFullBackfillReportingStage\(\{[\s\S]*threadId: id,[\s\S]*timings: \{[\s\S]*postRenderMs,[\s\S]*\},[\s\S]*\}\)/);
  assert.match(functionBody("backfillFullThreadDetail"), /threadPerformanceMetrics\.threadDetailFullReadyEventFields\(\s*result\.thread,\s*fullBackfillReportingStage\.performanceInput,\s*\)/);
  assert.match(functionBody("backfillFullThreadDetail"), /threadDetailRenderPlanApi\.planThreadDetailFullBackfillPostRenderEffects\(\)/);
  assert.match(functionBody("backfillFullThreadDetail"), /applyThreadDetailPostRenderEffectsPlan\(fullBackfillPostRenderPlan\)/);
  assert.match(functionBody("backfillFullThreadDetail"), /threadDetailRenderPlanApi\.planThreadDetailFullBackfillTelemetryEffects\(Object\.assign\(\{[\s\S]*performanceEvent: fullReadyPerformance,[\s\S]*\}, fullBackfillReportingStage\.telemetryInput\)\)/);
  assert.match(functionBody("backfillFullThreadDetail"), /applyThreadDetailRefreshTelemetryEffectsPlan\(fullBackfillTelemetryPlan, \{ thread: result\.thread \}\)/);
  assert.doesNotMatch(functionBody("backfillFullThreadDetail"), /postPerformanceEvent\("thread_detail_full_ready", fullReadyPerformance, \{ force: true \}\)/);
  assert.doesNotMatch(functionBody("backfillFullThreadDetail"), /recordThreadDetailResponseDiagnostics\(fullReadyPerformance, \{/);
  assert.match(stylesCss, /\.history-loader\s*{[\s\S]*justify-content:\s*space-between;/);
  assert.match(stylesCss, /\.history-load-button/);
  assert.match(swJs, /shell-asset-manifest\.js/);
  for (const asset of [
    "/api-client.js",
    "/runtime-settings.js",
    "/draft-store.js",
    "/markdown-renderer.js",
    "/viewport-metrics.js",
    "/conversation-scroll.js",
    "/image-compressor.js",
    "/plugin-embed.js",
    "/home-ai-diagnostic-reporting.js",
    "/thread-diagnostic-events.js",
    "/thread-performance-metrics.js",
    "/thread-list-load-policy.js",
    "/thread-list-stable-order.js",
    "/client-render-stability-guard.js",
    "/live-operation-dock-state.js",
    "/thread-detail-state.js",
    "/thread-detail-render-plan.js",
    "/thread-detail-merge-state.js",
    "/thread-detail-patch-plan.js",
    "/thread-detail-dom-patch.js",
    "/thread-detail-actions.js",
    "/thread-tile-actions.js",
    "/thread-tile-state.js",
    "/thread-tile-layout.js",
    "/build-refresh-policy.js",
    "/app-update-runtime.js",
  ]) {
    assert.ok(shellManifest.precacheAssets.includes(asset), `manifest missing ${asset}`);
  }
  assert.match(appJs, /"\/viewport-metrics\.js"/);
  assert.match(appJs, /"\/conversation-scroll\.js"/);
  assert.match(appJs, /"\/image-compressor\.js"/);
  assert.match(appJs, /"\/plugin-embed\.js"/);
  assert.match(appJs, /"\/home-ai-diagnostic-reporting\.js"/);
  assert.match(appJs, /"\/thread-diagnostic-events\.js"/);
  assert.match(appJs, /"\/thread-performance-metrics\.js"/);
  assert.match(appJs, /"\/thread-list-load-policy\.js"/);
  assert.match(appJs, /"\/thread-list-stable-order\.js"/);
  assert.match(appJs, /"\/client-render-stability-guard\.js"/);
  assert.match(appJs, /"\/live-operation-dock-state\.js"/);
  assert.match(appJs, /"\/thread-detail-state\.js"/);
  assert.match(appJs, /"\/thread-detail-render-plan\.js"/);
  assert.match(appJs, /"\/thread-detail-merge-state\.js"/);
  assert.match(appJs, /"\/thread-detail-patch-plan\.js"/);
  assert.match(appJs, /"\/thread-detail-dom-patch\.js"/);
  assert.match(appJs, /"\/thread-detail-actions\.js"/);
  assert.match(appJs, /"\/thread-tile-actions\.js"/);
  assert.match(appJs, /"\/thread-tile-state\.js"/);
  assert.match(appJs, /"\/thread-tile-layout\.js"/);
  assert.match(appJs, /"\/app-update-runtime\.js"/);
  assert.match(indexHtml, /src="\/thread-list-load-policy\.js"/);
  assert.match(indexHtml, /src="\/thread-list-stable-order\.js"/);
  assert.match(indexHtml, /src="\/client-render-stability-guard\.js"/);
  assert.match(appJs, /"\/build-refresh-policy\.js"/);
  assert.match(appJs, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(appJs, /state\.serviceWorkerRegistration\.update\(\)\.catch/);
  assert.match(swJs, /if \(!data\.threadId && payload\.threadId\) data\.threadId = payload\.threadId;/);
  assert.match(swJs, /if \(threadId && !url\.searchParams\.get\("thread"\)\) \{/);
  assert.match(swJs, /url\.searchParams\.set\("thread", threadId\);/);
  assert.match(swJs, /self\.clients\.openWindow\(target\.url\)/);
  assert.match(indexHtml, /id="workspaceTokenUsage"/);
  assert.match(indexHtml, /id="workspaceStatsDialog"/);
  assert.match(appJs, /(?:const|var) threadListLoadPolicy = window\.CodexThreadListLoadPolicy;/);
  assert.match(appJs, /workspaceTokenUsage: null/);
  assert.match(threadListRuntimeJs, /function renderWorkspaceTokenUsage\(\)/);
  assert.match(threadListRuntimeJs, /function renderWorkspaceStatsDialog\(\)/);
  assert.match(threadListRuntimeJs, /data-workspace-token-usage-toggle>统计<\/button>/);
  assert.match(appJs, /function formatTokenMillion\(value\)/);
  assert.match(appJs, /(?:const|var) THREAD_LIST_PAGE_LIMIT = 200;/);
  assert.match(threadListRuntimeJs, /new URLSearchParams\(\{ limit: String\(THREAD_LIST_PAGE_LIMIT\), archived: "false" \}\)/);
  assert.match(threadListRuntimeJs, /function hasThreadDetailRequestInFlight\(\)/);
  assert.match(threadListRuntimeJs, /state\.threadLoadController[\s\S]*state\.refreshThreadController[\s\S]*state\.currentThread && state\.currentThread\.mobileLoading/);
  assert.match(threadListRuntimeJs, /const threadDetailOpening = hasThreadDetailRequestInFlight\(\);/);
  assert.match(threadListRuntimeJs, /const loadPlan = threadListLoadPolicy\.planThreadListLoadRequest\(\{/);
  assert.match(threadListRuntimeJs, /threadListLoadedAtMs: state\.threadListLoadedAtMs/);
  assert.match(threadListRuntimeJs, /if \(loadPlan\.params && loadPlan\.params\.fallback\) \{[\s\S]*params\.set\("fallback", "defer"\);[\s\S]*\}/);
  assert.match(threadListRuntimeJs, /if \(loadPlan\.params && loadPlan\.params\.initial\) \{[\s\S]*params\.set\("initial", "warm-fallback"\);[\s\S]*\}/);
  assert.match(threadListRuntimeJs, /params\.set\("initial", "warm-fallback"\)/);
  assert.match(appJs, /(?:const|var) THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS = 8000;/);
  assert.match(appJs, /(?:const|var) THREAD_LIST_DEFERRED_FALLBACK_RETRY_MS = 2500;/);
  assert.match(appJs, /threadListDeferredFallbackTimer: null/);
  assert.match(threadListRuntimeJs, /function scheduleThreadListDeferredFallback\(delayMs = THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS\)/);
  assert.match(threadListRuntimeJs, /if \(state\.threadListLoadController \|\| hasThreadDetailRequestInFlight\(\) \|\| hasThreadDetailSelectionIntent\(\)\) \{[\s\S]*scheduleThreadListDeferredFallback\(THREAD_LIST_DEFERRED_FALLBACK_RETRY_MS\);[\s\S]*return;/);
  assert.match(threadListRuntimeJs, /if \(options\.deferFallback !== true\) clearThreadListDeferredFallbackTimer\(\);/);
  assert.match(threadListRuntimeJs, /result\.mobileDeferredFallback \|\| result\.mobileDeferredAppServer/);
  assert.match(threadListRuntimeJs, /if \(result && \(result\.mobileDeferredFallback \|\| result\.mobileDeferredAppServer\) && !state\.selectedCwd && !search\) \{[\s\S]*scheduleThreadListDeferredFallback\(\);[\s\S]*\}/);
  assert.match(threadListRuntimeJs, /Uncached \$\{escapeHtml\(formatTokenMillion\(displayInputTokensExcludingCached\(entry\)\)\)\}/);
  assert.match(threadListRuntimeJs, /Cached \$\{escapeHtml\(formatTokenMillion\(entry && entry\.cachedInputTokens\)\)\}/);
  assert.match(threadListRuntimeJs, /Out \$\{escapeHtml\(formatTokenMillion\(entry && entry\.outputTokens\)\)\}/);
  assert.match(threadListRuntimeJs, /Reason \$\{escapeHtml\(formatTokenMillion\(entry && entry\.reasoningOutputTokens\)\)\}/);
  assert.match(stylesCss, /\.workspace-token-usage/);
  assert.match(stylesCss, /\.workspace-token-usage-summary span[\s\S]*color:\s*var\(--danger-text\)/);
  assert.match(stylesCss, /\.workspace-stats-dialog/);
  assert.match(stylesCss, /\.workspace-stats-breakdown/);
});

test("Android back and edge swipe open the mobile navigation menu", () => {
  assert.match(appJs, /(?:const|var) ANDROID_SIDEBAR_EDGE_SWIPE_PX = 44/);
  assert.match(appJs, /(?:const|var) ANDROID_BACK_SIDEBAR_BASE = "base"/);
  assert.match(appJs, /(?:const|var) ANDROID_BACK_SIDEBAR_TOP = "top"/);
  assert.match(appJs, /function sidebarTransformIsNone\(transform\)/);
  assert.match(appJs, /matrix\(1,0,0,1,0,0\)/);
  assert.match(appJs, /matrix3d\(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1\)/);
  assert.match(appJs, /function splitPaneSidebarVisible\(\)/);
  assert.match(appJs, /Number\(rect\.width \|\| 0\) < 80 \|\| Number\(rect\.height \|\| 0\) < 80/);
  assert.match(appJs, /style\.position === "fixed"/);
  assert.match(appJs, /return sidebarTransformIsNone\(style\.transform\)/);
  assert.match(appJs, /(?:const|var) HOST_EMBED_SPLIT_LEFT_MIN_PX = 160/);
  assert.match(appJs, /(?:const|var) HOST_EMBED_SPLIT_VIEWPORT_MIN_PX = 900/);
  assert.match(appJs, /function hostEmbeddedSplitPaneVisible\(\)/);
  assert.match(appJs, /frameLeft >= HOST_EMBED_SPLIT_LEFT_MIN_PX/);
  assert.match(appJs, /frameWidth < hostWidth - 24/);
  assert.match(appJs, /function threadDetailReturnButtonVisible\(\)/);
  assert.match(appJs, /if \(isHermesEmbedMode\(\)\) return hostEmbeddedSplitPaneVisible\(\)/);
  assert.match(appJs, /sidebarLayoutOverlay: false/);
  assert.match(appJs, /(?:const|var) SIDEBAR_LAYOUT_TOGGLE_MIN_WIDTH = 900/);
  assert.match(appJs, /(?:const|var) SIDEBAR_LAYOUT_TOGGLE_MIN_HEIGHT = 600/);
  assert.match(appJs, /function sidebarLayoutToggleSupported\(\)/);
  assert.match(appJs, /width >= SIDEBAR_LAYOUT_TOGGLE_MIN_WIDTH[\s\S]*height >= SIDEBAR_LAYOUT_TOGGLE_MIN_HEIGHT/);
  assert.match(appJs, /function sidebarOverlayModeActive\(\)/);
  assert.match(appJs, /return Boolean\(state\.sidebarLayoutOverlay && sidebarLayoutToggleSupported\(\)\)/);
  assert.match(appJs, /function syncSidebarLayoutOverlayState\(\)/);
  assert.match(appJs, /document\.documentElement\.classList\.toggle\("sidebar-layout-toggle-supported", supported\)/);
  assert.match(appJs, /document\.documentElement\.classList\.toggle\("sidebar-overlay-mode", active\)/);
  assert.match(appJs, /function syncSidebarOpenClass\(\)/);
  assert.match(appJs, /document\.documentElement\.classList\.toggle\("sidebar-open", isSidebarOpen\(\)\)/);
  assert.match(appJs, /function setSidebarLayoutOverlay\(active, options = \{\}\)/);
  assert.match(appJs, /state\.sidebarLayoutOverlay = nextActive/);
  assert.match(appJs, /if \(state\.threadTileMode\) renderCurrentThread\(\);/);
  assert.match(appJs, /function handleSidebarLayoutToggle\(\)/);
  assert.match(appJs, /if \(!sidebarOverlayModeActive\(\)\) \{[\s\S]*setSidebarLayoutOverlay\(true\);[\s\S]*return true;/);
  assert.match(appJs, /function syncThreadDetailLayoutState\(\)/);
  assert.match(appJs, /document\.documentElement\.classList\.toggle\("thread-detail-active", detailActive\)/);
  assert.match(appJs, /(?:const|var) sidebarToggle = sidebarLayoutToggleSupported\(\)/);
  assert.match(appJs, /(?:const|var) sidebarOverlay = syncSidebarLayoutOverlayState\(\)/);
  assert.match(appJs, /(?:const|var) sidebarOpen = isSidebarOpen\(\)/);
  assert.match(appJs, /(?:const|var) sidebarLayoutButton = \$\("sidebarLayoutToggle"\)/);
  assert.match(appJs, /sidebarLayoutButton\.hidden = !showSidebarLayoutButton/);
  assert.match(appJs, /(?:const|var) closeMenuButton = \$\("closeMenu"\)/);
  assert.match(appJs, /(?:const|var) sidebarOverlayClose = Boolean\(sidebarToggle && sidebarOverlay\)/);
  assert.match(appJs, /closeMenuButton\.classList\.toggle\("sidebar-layout-close", sidebarOverlayClose\)/);
  assert.match(appJs, /closeMenuButton\.textContent = sidebarOverlayClose \? "‹" : "×"/);
  assert.match(appJs, /closeMenuButton\.title = sidebarOverlayClose \? "收起 Session List" : "Close menu"/);
  assert.match(appJs, /(?:const|var) splitReturn = !sidebarToggle && threadDetailReturnButtonVisible\(\)/);
  assert.match(appJs, /(?:const|var) sidebarOpenMenu = Boolean\(sidebarToggle && sidebarOverlay && !sidebarOpen\)/);
  assert.match(appJs, /openMenuButton\.classList\.toggle\("split-return-visible", splitReturn\)/);
  assert.match(appJs, /openMenuButton\.classList\.toggle\("sidebar-toggle-visible", sidebarOpenMenu\)/);
  assert.match(appJs, /openMenuButton\.textContent = "☰"/);
  assert.match(appJs, /openMenuButton\.textContent = splitReturn \? "←" : "☰"/);
  assert.match(appJs, /function returnToThreadListFromDetail\(\)/);
  assert.match(appJs, /clearCurrentThreadSelection\(\);[\s\S]*renderThreads\(\);[\s\S]*renderCurrentThread\(\);/);
  assert.match(appJs, /function handleOpenMenuClick\(\)/);
  assert.match(appJs, /if \(handleSidebarLayoutToggle\(\)\) return;/);
  assert.match(appJs, /if \(threadDetailReturnButtonVisible\(\) && returnToThreadListFromDetail\(\)\) return;/);
  assert.match(appJs, /\$\("openMenu"\)\.addEventListener\("click", handleOpenMenuClick\)/);
  assert.match(appJs, /\$\("sidebarLayoutToggle"\)\.addEventListener\("click", \(event\) => \{[\s\S]*handleSidebarLayoutToggle\(\);/);
  assert.match(indexHtml, /id="sidebarLayoutToggle"/);
  assert.doesNotMatch(stylesCss, /html\.thread-detail-active #openMenu\.mobile-only\s*{[\s\S]*display:\s*grid;/);
  assert.match(stylesCss, /#openMenu\.split-return-visible,\s*\n#openMenu\.sidebar-toggle-visible\s*{[\s\S]*display:\s*grid;/);
  assert.match(stylesCss, /\.sidebar-layout-toggle,\s*\n\.sidebar-layout-close\s*{[\s\S]*font-size:\s*28px;/);
  assert.match(stylesCss, /\.sidebar-layout-toggle\[hidden\]\s*{[\s\S]*display:\s*none !important;/);
  assert.match(stylesCss, /html\.sidebar-layout-toggle-supported \.main\.thread-tile-main \.topbar\s*{[\s\S]*position:\s*absolute;[\s\S]*width:\s*40px;[\s\S]*pointer-events:\s*none;/);
  assert.match(stylesCss, /html\.sidebar-layout-toggle-supported \.main\.thread-tile-main\s*{[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\) auto;/);
  assert.match(stylesCss, /html\.sidebar-layout-toggle-supported \.main\.thread-tile-main > \.conversation\s*{[\s\S]*grid-row:\s*1;/);
  assert.match(stylesCss, /html\.sidebar-layout-toggle-supported \.main\.thread-tile-main > \.composer\s*{[\s\S]*grid-row:\s*2;/);
  assert.match(stylesCss, /\.main\.thread-tile-main > \.composer\s*{[\s\S]*width:\s*auto;[\s\S]*margin:\s*0 var\(--thread-tile-edge-gap\) var\(--thread-tile-edge-gap\);/);
  assert.match(stylesCss, /@media \(max-width: 760px\) \{[\s\S]*\.main\.thread-tile-main > \.composer\s*{[\s\S]*width:\s*auto;[\s\S]*padding:\s*7px 12px max\(8px, var\(--host-bottom-safe-area, 0px\)\);/);
  assert.match(stylesCss, /html\.sidebar-layout-toggle-supported \.main\.thread-tile-main \.topbar \.thread-title-wrap,[\s\S]*#interruptTurn\s*{[\s\S]*display:\s*none !important;/);
  assert.match(stylesCss, /html\.sidebar-layout-toggle-supported \.main\.thread-tile-main #openMenu\.sidebar-toggle-visible\s*{[\s\S]*pointer-events:\s*auto;[\s\S]*background:\s*transparent;/);
  assert.match(stylesCss, /html\.sidebar-layout-toggle-supported\.sidebar-open \.main\.thread-tile-main #openMenu\.sidebar-toggle-visible\s*{[\s\S]*display:\s*none;[\s\S]*pointer-events:\s*none;/);
  assert.doesNotMatch(stylesCss, /thread-tile-board-sidebar-toggle/);
  assert.match(stylesCss, /html\.sidebar-layout-toggle-supported\.sidebar-overlay-mode:not\(\.sidebar-open\) \.thread-tile-board \.thread-tile-column:first-child \.thread-tile-pane:first-child \.thread-tile-pane-header\s*{[\s\S]*padding-left:\s*48px;/);
  assert.match(stylesCss, /html:not\(\.embed-hermes\)\.sidebar-overlay-mode \.app\s*{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.match(stylesCss, /html:not\(\.embed-hermes\)\.sidebar-overlay-mode \.sidebar\s*{[\s\S]*position:\s*fixed;[\s\S]*width:\s*min\(420px, 100vw\);[\s\S]*transform:\s*translateX\(-105%\);/);
  assert.match(stylesCss, /html\.embed-hermes #openMenu,[\s\S]*html\.embed-hermes \.main \.version-actions\s*{[\s\S]*display:\s*none !important;/);
  assert.match(stylesCss, /html\.embed-hermes #openMenu\.split-return-visible\s*{[\s\S]*display:\s*grid !important;/);
  assert.doesNotMatch(stylesCss, /html\.embed-hermes\.thread-detail-active #openMenu\.mobile-only/);
  assert.match(appJs, /function isAndroidBrowser\(\)/);
  assert.match(appJs, /function sidebarEdgeSwipeStartLimitPx\(\)/);
  assert.match(appJs, /function pointInComposerGestureZone\(point\)/);
  assert.match(indexHtml, /id="composerTargetIndicator"/);
  assert.match(stylesCss, /\.composer-meta-row\s*{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) max-content;/);
  assert.match(stylesCss, /\.thread-tile-pane,\s*\n\.composer\s*{[\s\S]*--thread-identity-ring:\s*var\(--thread-identity-ring-dark, var\(--composer-target-accent\)\);/);
  assert.match(stylesCss, /:root\[data-theme="light"\] \.thread-tile-pane,[\s\S]*--thread-identity-ring:\s*var\(--thread-identity-ring-light, var\(--composer-target-accent\)\);/);
  assert.match(stylesCss, /:root\[data-theme="system"\] \.thread-tile-pane,[\s\S]*--thread-identity-ring:\s*var\(--thread-identity-ring-light, var\(--composer-target-accent\)\);/);
  assert.match(stylesCss, /\.composer-target-indicator\s*{[\s\S]*background:\s*linear-gradient\(0deg, var\(--thread-identity-tint\), var\(--thread-identity-tint\)\), var\(--control-bg\);[\s\S]*border:\s*1px solid var\(--thread-identity-outline\);/);
  assert.doesNotMatch(stylesCss, /\.composer-target-indicator\s*{[\s\S]*border-left:\s*3px solid var\(--composer-target-accent\);/);
  assert.match(stylesCss, /\.thread-tile-pane\.active\s*{[\s\S]*border-color:\s*var\(--thread-identity-ring-strong\);[\s\S]*box-shadow:\s*0 0 0 1px var\(--thread-identity-ring\)/);
  assert.match(stylesCss, /\.composer\.has-target-indicator\s*{[\s\S]*border-top-color:\s*var\(--thread-identity-ring-strong\);[\s\S]*box-shadow:\s*inset 0 0 0 1px var\(--thread-identity-ring\)/);
  assert.match(appJs, /\.composer-controls/);
  assert.match(appJs, /point\.clientY >= Math\.max\(0, rect\.top - 10\)/);
  assert.match(appJs, /if \(pointInComposerGestureZone\(touch\)\) return;/);
  assert.match(appJs, /touch\.clientX > sidebarEdgeSwipeStartLimitPx\(\)/);
  assert.match(appJs, /ensureAndroidBackToSidebarSentinel\(\);[\s\S]*if \(event\.cancelable !== false\) event\.preventDefault\(\);/);
  assert.match(appJs, /if \(event\.cancelable !== false\) event\.preventDefault\(\);/);
  assert.match(appJs, /addEventListener\("touchstart", beginSidebarEdgeSwipe, \{ passive: false \}\)/);
  assert.match(appJs, /function ensureAndroidBackToSidebarSentinel\(\)/);
  assert.match(appJs, /\$\("app"\)\.classList\.remove\("hidden"\);[\s\S]*ensureAndroidBackToSidebarSentinel\(\);/);
  assert.match(appJs, /window\.history\.replaceState\(Object\.assign\(\{\}, currentState,[\s\S]*ANDROID_BACK_SIDEBAR_BASE/);
  assert.match(appJs, /window\.history\.pushState\(Object\.assign\(\{\}, currentState,[\s\S]*ANDROID_BACK_SIDEBAR_TOP/);
  assert.match(appJs, /function handleAndroidBackToSidebarPopState\(event\)/);
  assert.match(appJs, /&& state\.key/);
  assert.match(appJs, /&& !app\.classList\.contains\("hidden"\)/);
  assert.match(appJs, /if \(!isSidebarOpen\(\)\) openSidebarMenu\(\);/);
  assert.match(appJs, /if \(document\.visibilityState === "visible"\) \{[\s\S]*ensureAndroidBackToSidebarSentinel\(\);/);
  assert.match(appJs, /window\.addEventListener\("pageshow",[\s\S]*ensureAndroidBackToSidebarSentinel\(\);/);
  assert.match(appJs, /window\.addEventListener\("focus",[\s\S]*ensureAndroidBackToSidebarSentinel\(\);/);
  assert.match(appJs, /window\.addEventListener\("popstate", handleAndroidBackToSidebarPopState\)/);
});

test("workspace creation lives at the bottom of the Workspace menu", () => {
  assert.match(indexHtml, /id="workspaceSelectMenu"/);
  assert.match(indexHtml, /id="newThreadButton"/);
  assert.match(indexHtml, /id="createWorkspaceDialog"/);
  assert.match(indexHtml, /id="createWorkspaceForm"/);
  assert.match(indexHtml, /id="createWorkspaceRootSelect"/);
  assert.match(threadListRuntimeJs, /function workspaceSidebarOptionsHtml\(\)/);
  assert.match(threadListRuntimeJs, /data-create-workspace/);
  assert.match(threadListRuntimeJs, /return allOption \+ workspaceOptions \+ createOption;/);
  assert.match(appJs, /openCreateWorkspaceDialog\(\)/);
  assert.match(appJs, /function populateCreateWorkspaceRootSelect\(\)/);
  assert.match(appJs, /body:\s*JSON\.stringify\(\{\s*name,\s*parent:\s*workspaceCreateSelectedRoot\(\)\s*\}\)/);
  assert.match(appJs, /api\("\/api\/workspaces", \{[\s\S]*method: "POST"/);
  assert.match(stylesCss, /\.workspace-create-option/);
  assert.match(stylesCss, /\.create-workspace-root-select/);
  assert.doesNotMatch(indexHtml, /newThreadButton[\s\S]{0,240}createWorkspace/i);
});

test("push notification control stays hidden when the browser cannot enable it", () => {
  assert.doesNotMatch(appJs, /HTTPS required/);
  assert.doesNotMatch(appJs, /Notifications unavailable/);
  assert.doesNotMatch(appJs, /Notifications unsupported/);
  assert.match(appJs, /(?:const|var) hideButton = \(\) => \{/);
  assert.match(appJs, /if \(!window\.isSecureContext\) \{[\s\S]*hideButton\(\);[\s\S]*return;[\s\S]*\}/);
});
