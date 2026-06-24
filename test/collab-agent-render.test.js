"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

function functionBody(name) {
  const start = appJs.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const bodyStart = appJs.indexOf(") {", start) + 2;
  assert.notEqual(bodyStart, 1, `missing function body ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < appJs.length; index += 1) {
    const char = appJs[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return appJs.slice(bodyStart + 1, index);
  }
  throw new Error(`could not parse function ${name}`);
}

function functionSource(name) {
  const start = appJs.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const open = appJs.indexOf(") {", start) + 2;
  assert.notEqual(open, 1, `missing function body ${name}`);
  return `${appJs.slice(start, open + 1)}${functionBody(name)}}`;
}

function cssRuleBody(selector) {
  const start = stylesCss.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `missing css rule ${selector}`);
  const bodyStart = stylesCss.indexOf("{", start);
  const bodyEnd = stylesCss.indexOf("}", bodyStart);
  assert.notEqual(bodyEnd, -1, `missing css rule end ${selector}`);
  return stylesCss.slice(bodyStart + 1, bodyEnd);
}

test("collab agent tool calls render as compact summary cards", () => {
  assert.match(appJs, /collabAgentToolCall:\s*"协作 Agent"/);
  assert.match(appJs, /function renderCollabAgentToolCall\(/);
  assert.match(functionBody("renderItemBody"), /renderCollabAgentToolCall\(item\)/);
  assert.match(functionBody("renderCollabAgentToolCall"), /collab-agent-card/);
  assert.match(functionBody("renderCollabAgentToolCall"), /collab-agent-raw/);
  assert.match(stylesCss, /\.item\.collabAgentToolCall/);
  assert.match(stylesCss, /\.collab-agent-card/);
});

test("live operation cards dock on wide screens and become a mobile bubble", () => {
  assert.match(appJs, /function currentLiveOperationEntry\(thread\)/);
  assert.match(functionBody("currentLiveOperationEntry"), /const turn = thread\.turns\[thread\.turns\.length - 1\]/);
  assert.match(functionBody("currentLiveOperationEntry"), /if \(!turn \|\| !isLatestTurn\(turn\) \|\| !isLiveTurn\(turn\)\) return null;/);
  assert.match(appJs, /function isActiveOperationalItem\(item\)/);
  assert.match(functionBody("currentLiveOperationEntry"), /if \(isActiveOperationalItem\(item\)\) return \{ turn, item, sourceIndex: index \};/);
  assert.match(functionBody("currentLiveOperationEntry"), /return \{ turn, item: liveTurnStatusDockItem\(turn\), sourceIndex: -1 \};/);
  assert.match(appJs, /function renderLiveOperationDock\(thread, previousKeys = new Set\(\)\)/);
  assert.match(functionBody("renderLiveOperationDock"), /currentLiveOperationEntry\(thread\)/);
  assert.match(functionBody("renderLiveOperationDock"), /live-operation-dock-inner/);
  assert.match(functionBody("renderLiveOperationDock"), /entry\.item && entry\.item\.type !== "liveTurnStatus"/);
  assert.match(functionBody("renderLiveOperationDock"), /renderMobileOperationStack\(entry\.item, entry\.turn, previousKeys, entry\.sourceIndex, expanded\)/);
  assert.match(functionBody("renderLiveOperationDock"), /live-operation-dock-desktop/);
  assert.match(functionBody("renderLiveOperationDock"), /data-live-operation-dock-toggle/);
  assert.match(functionBody("renderLiveOperationDock"), /\? "↓" : "↑"/);
  assert.match(appJs, /function renderMobileOperationStack\(/);
  assert.match(functionBody("renderMobileOperationStack"), /mobile-operation-bubble/);
  assert.match(functionBody("renderMobileOperationStack"), /mobile-operation-sheet/);
  assert.match(functionBody("renderMobileOperationStack"), /operation-duration mobile-operation-bubble-duration/);
  assert.match(functionBody("renderMobileOperationStack"), /renderOperationCard\(item, key, \{ status, extraClass: "mobile-operation-sheet-card" \}\)/);
  assert.match(appJs, /function operationBubbleSummary\(/);
  assert.match(functionBody("operationBubbleSummary"), /truncateSingleLine\(operationSummaryLines\(item\)\.filter\(Boolean\)\.join\(" \\| "\), 52\)/);
  assert.doesNotMatch(functionBody("renderLiveOperationDock"), />1行</);
  assert.doesNotMatch(functionBody("renderLiveOperationDock"), />3行</);
  assert.doesNotMatch(functionBody("renderLiveOperationDock"), />展开</);
  assert.match(functionBody("renderCurrentThread"), /const liveOperationDock = renderLiveOperationDock\(thread, previousKeys\);/);
  assert.match(indexHtml, /id="liveOperationDock" class="live-operation-dock"/);
  assert.match(functionBody("renderCurrentThread"), /updateLiveOperationDockHtml\(liveOperationDock\);/);
  assert.doesNotMatch(functionBody("renderCurrentThread"), /taskCardsHtml\}\$\{liveOperationDock\}/);
  assert.match(appJs, /liveOperationDockMode:\s*"compact"/);
  assert.match(appJs, /liveOperationDockPinned:\s*false/);
  assert.match(appJs, /liveOperationDockPinnedThreadId:\s*""/);
  assert.match(appJs, /const liveOperationDockPolicy = window\.CodexLiveOperationDockState/);
  assert.match(appJs, /const LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS = liveOperationDockPolicy\.DEFAULT_MIN_VISIBLE_MS;/);
  assert.match(appJs, /liveOperationDockCompactVisibleUntilMs:\s*0/);
  assert.match(appJs, /liveOperationDockCompactHtml:\s*""/);
  assert.match(appJs, /liveOperationDockCompactThreadId:\s*""/);
  assert.match(appJs, /liveOperationDockCompactTimer:\s*null/);
  assert.match(appJs, /liveOperationDockRecallHtml:\s*""/);
  assert.match(appJs, /liveOperationDockRecallThreadId:\s*""/);
  assert.match(appJs, /liveOperationDockRecallAtMs:\s*0/);
  assert.match(appJs, /function setLiveOperationDockMode\(/);
  assert.match(appJs, /function shouldPreservePinnedLiveOperationDock\(/);
  assert.match(appJs, /function preservePinnedLiveOperationDock\(/);
  assert.match(appJs, /function rememberCompactLiveOperationBubbleHtml\(/);
  assert.match(appJs, /function renderLiveOperationRecallDockHtml\(/);
  assert.match(appJs, /function clearCompactLiveOperationBubbleState\(/);
  assert.match(appJs, /function renderLiveOperationDockOnly\(/);
  assert.match(appJs, /function scheduleLiveOperationDockCompactMinimumRefresh\(/);
  assert.match(appJs, /function shouldPreserveCompactLiveOperationBubble\(/);
  assert.match(functionBody("updateLiveOperationDockHtml"), /shouldPreservePinnedLiveOperationDock\(dock, next\)/);
  assert.match(functionBody("rememberCompactLiveOperationBubbleHtml"), /liveOperationDockPolicy\.rememberCompactBubble/);
  assert.match(functionBody("rememberCompactLiveOperationBubbleHtml"), /minVisibleMs:\s*LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS/);
  assert.match(functionBody("rememberCompactLiveOperationBubbleHtml"), /state\.liveOperationDockCompactHtml = next\.html/);
  assert.match(functionBody("rememberCompactLiveOperationBubbleHtml"), /state\.liveOperationDockCompactThreadId = next\.threadId/);
  assert.match(functionBody("rememberCompactLiveOperationBubbleHtml"), /state\.liveOperationDockRecallHtml = next\.recallHtml/);
  assert.match(functionBody("rememberCompactLiveOperationBubbleHtml"), /state\.liveOperationDockRecallThreadId = next\.recallThreadId/);
  assert.match(functionBody("renderLiveOperationRecallDockHtml"), /liveOperationDockPolicy\.shouldShowRecall/);
  assert.match(functionBody("renderLiveOperationRecallDockHtml"), /querySelectorAll\("\.mobile-operation-bubble, \.mobile-operation-recall"\)/);
  assert.match(functionBody("renderLiveOperationRecallDockHtml"), /button\.className = "mobile-operation-recall"/);
  assert.match(functionBody("renderLiveOperationRecallDockHtml"), /button\.dataset\.liveOperationDockToggle = ""/);
  assert.match(functionBody("updateLiveOperationDockHtml"), /shouldPreserveCompactLiveOperationBubble\(dock, next\)/);
  assert.match(functionBody("updateLiveOperationDockHtml"), /rememberCompactLiveOperationBubbleHtml\(next\)/);
  assert.match(functionBody("updateLiveOperationDockHtml"), /const recall = !next \? renderLiveOperationRecallDockHtml\(\) : ""/);
  assert.match(functionBody("updateLiveOperationDockHtml"), /dock\.dataset\.recallVisible = "true"/);
  assert.match(functionBody("updateLiveOperationDockHtml"), /!next\.includes\("mobile-operation-bubble"\)[\s\S]*state\.liveOperationDockPinned = false/);
  assert.match(functionBody("updateLiveOperationDockHtml"), /state\.liveOperationDockPinnedThreadId = ""/);
  assert.match(functionBody("updateLiveOperationDockHtml"), /state\.liveOperationDockMode = "compact"/);
  assert.match(functionBody("clearCompactLiveOperationBubbleState"), /state\.liveOperationDockCompactVisibleUntilMs = 0/);
  assert.match(functionBody("clearCompactLiveOperationBubbleState"), /state\.liveOperationDockCompactHtml = ""/);
  assert.match(functionBody("clearCompactLiveOperationBubbleState"), /state\.liveOperationDockCompactThreadId = ""/);
  assert.match(functionBody("scheduleLiveOperationDockCompactMinimumRefresh"), /setTimeout\(\(\) => \{[\s\S]*renderLiveOperationDockOnly\(\);[\s\S]*\}, delay \+ 16\)/);
  assert.match(functionBody("shouldPreserveCompactLiveOperationBubble"), /querySelector\("\.mobile-operation-bubble"\)/);
  assert.match(functionBody("shouldPreserveCompactLiveOperationBubble"), /liveOperationDockPolicy\.compactBubblePreservation/);
  assert.match(functionBody("shouldPreserveCompactLiveOperationBubble"), /if \(!preservation\.preserve\) return false;/);
  assert.match(functionBody("shouldPreserveCompactLiveOperationBubble"), /patchHtml\(dock, preservation\.savedHtml\)/);
  assert.match(functionBody("shouldPreserveCompactLiveOperationBubble"), /scheduleLiveOperationDockCompactMinimumRefresh\(preservation\.remainingMs\)/);
  assert.doesNotMatch(functionBody("scheduleLiveOperationDockCompactMinimumRefresh"), /renderCurrentThread\(\)/);
  assert.match(functionBody("setLiveOperationDockMode"), /state\.liveOperationDockPinned = next === "expanded"/);
  assert.match(functionBody("setLiveOperationDockMode"), /state\.liveOperationDockPinnedThreadId = state\.liveOperationDockPinned \? String\(state\.currentThreadId \|\| ""\) : ""/);
  assert.match(functionBody("shouldPreservePinnedLiveOperationDock"), /liveOperationDockPolicy\.shouldPreservePinned/);
  assert.match(functionBody("shouldPreservePinnedLiveOperationDock"), /dock\.querySelector\("\.mobile-operation-sheet"\)/);
  assert.match(functionBody("setLiveOperationDockMode"), /querySelectorAll\("\[data-live-operation-dock-toggle\]"\)/);
  assert.match(functionBody("setLiveOperationDockMode"), /!button\.classList\.contains\("mobile-operation-bubble"\)/);
  assert.match(functionBody("setLiveOperationDockMode"), /!button\.classList\.contains\("mobile-operation-recall"\)/);
  assert.match(functionBody("updateLiveOperationDockHtml"), /dock\.dataset\.mobileVisible = next\.includes\("mobile-operation-bubble"\) \? "true" : "false"/);
  assert.match(appJs, /function beginLiveOperationDockGesture\(/);
  assert.match(appJs, /function finishLiveOperationDockGesture\(/);
  assert.match(functionBody("renderLiveOperation"), /renderOperationCard\(item, key, \{ status \}\)/);
  assert.match(functionBody("renderLiveOperation"), /stableOperationRenderKey\(turn, item, index\)/);
  assert.match(functionBody("renderOperationCard"), /operation-meta-line/);
  assert.match(functionBody("renderOperationCard"), /operation-detail-line/);
  assert.match(functionBody("renderOperationCard"), /operation-detail-line\$\{detail \? "" : " empty"\}/);
  assert.match(functionBody("renderOperationCard"), /detail \? escapeHtml\(detail\) : "&nbsp;"/);
  assert.match(functionBody("renderOperationCard"), /const statusHtml = String\(status \|\| ""\)\.trim\(\)/);
  assert.match(functionBody("renderOperationCard"), /operation-title[\s\S]*\$\{statusHtml\}/);
  assert.match(functionBody("renderOperationCard"), /operation-duration/);
  assert.match(functionBody("renderOperationCard"), /operationDurationData\(item, status\)/);
  assert.match(functionBody("updateTurnTimer"), /updateOperationDurationBadges\(\)/);
  assert.match(functionBody("operationDurationData"), /operationStartedAtMs\(item\)/);
  assert.match(functionBody("operationDurationData"), /operationCompletedAtMs\(item\)/);
  assert.match(functionBody("updateOperationDurationBadges"), /querySelectorAll\("\.operation-duration"\)/);
  assert.match(functionBody("operationDetailText"), /join\(" \\| "\)/);
  assert.match(functionBody("visibleItemsForTurn"), /if \(isOperationalItem\(item\)\) \{[\s\S]*return;/);
  assert.match(functionBody("visibleItemsForTurn"), /const filtered = visible\.filter\(Boolean\)/);
  assert.match(functionBody("isSupersededLiveTurn"), /mobileSupersededLive/);
  assert.match(functionBody("visibleItemsForTurn"), /filtered\.every\(\(entry\) => isTurnUsageSummaryItem\(entry\.item\)\)/);
  assert.match(functionBody("visibleItemsForTurn"), /return limitRawThreadVisibleEntries\(filtered\)/);
  assert.doesNotMatch(functionBody("visibleItemsForTurn"), /const showOperations/);
  assert.doesNotMatch(functionBody("visibleItemsForTurn"), /latestOperationEntry/);
  assert.doesNotMatch(functionBody("visibleItemsForTurn"), /operationEntryByKey = new Map/);
  assert.doesNotMatch(functionBody("visibleItemsForTurn"), /lastOperationEntry/);
  assert.doesNotMatch(appJs, /function trimTrailingOperationCards\(/);
  assert.match(functionBody("stableOperationRenderKey"), /operationGroupKey\(item\)/);
  assert.match(functionBody("operationGroupKey"), /operationCommandText\(item\)/);
  assert.match(functionBody("operationGroupKey"), /operationCommandGroupText\(item\)/);
  assert.match(functionBody("operationCommandGroupText"), /operationCommandName\(item\)/);
  assert.match(functionBody("operationCommandName"), /shortPath\(stripMatchingOuterQuotes\(token\)\)/);
  assert.match(functionBody("operationSummaryLines"), /operationCommandSummary\(item\)/);
  assert.match(functionBody("operationGroupKey"), /operationRawFileNames\(item\)/);
  assert.doesNotMatch(appJs, /function latestVisibleOperationItem\(/);
  assert.doesNotMatch(appJs, /function removeOperationalItemsFromTurn\(/);
  assert.match(stylesCss, /\.main\s*{[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto auto;/);
  assert.match(stylesCss, /\.live-operation-dock\s*{[\s\S]*background:\s*var\(--bg\);/);
  assert.doesNotMatch(cssRuleBody(".live-operation-dock"), /position:\s*fixed;/);
  assert.match(stylesCss, /\.mobile-operation-stack\s*{[\s\S]*display:\s*none;/);
  assert.match(stylesCss, /\.live-operation-dock-controls\s*{[\s\S]*position:\s*absolute;/);
  assert.match(stylesCss, /\.live-operation-dock-controls button\s*{[\s\S]*width:\s*28px;/);
  assert.match(stylesCss, /\.live-operation-dock-controls button\[aria-expanded="true"\]\s*{[\s\S]*background:\s*var\(--control-muted-bg\);/);
  assert.match(stylesCss, /\.live-operation-dock \.operation-detail-line\s*{[\s\S]*display:\s*none;/);
  assert.match(stylesCss, /\.live-operation-dock\[data-mode="expanded"\] \.operation-detail-line\s*{[\s\S]*height:\s*min\(168px, 28vh\);/);
  assert.match(stylesCss, /\.live-operation-dock\[data-mode="expanded"\] \.operation-detail\s*{[\s\S]*-webkit-line-clamp:\s*unset;/);
  assert.match(stylesCss, /\.live-operation-dock \.live-operation\s*{[\s\S]*pointer-events:\s*auto;/);
  assert.match(stylesCss, /\.operation-meta-line\s*{[\s\S]*display:\s*flex;/);
  assert.match(stylesCss, /\.operation-meta-line\s*{[\s\S]*justify-content:\s*space-between;/);
  assert.match(stylesCss, /\.operation-meta-main\s*{[\s\S]*flex:\s*1 1 auto;/);
  assert.match(stylesCss, /\.operation-title\s*{[\s\S]*font-size:\s*calc\(var\(--content-small-font-size\) \* 0\.92\);/);
  assert.match(stylesCss, /\.operation-status\s*{[\s\S]*font-size:\s*calc\(var\(--content-small-font-size\) \* 0\.92\);/);
  assert.match(stylesCss, /\.operation-duration\s*{[\s\S]*font-variant-numeric:\s*tabular-nums;/);
  assert.match(stylesCss, /\.item\.live-operation\.entry-animate\s*{[\s\S]*animation:\s*none;/);
  assert.match(stylesCss, /\.operation-detail-line\s*{[\s\S]*overflow:\s*hidden;/);
  assert.match(stylesCss, /\.live-operation-dock \.operation-detail-line\s*{[\s\S]*display:\s*none;/);
  assert.match(stylesCss, /\.operation-detail\s*{[\s\S]*font-size:\s*calc\(var\(--content-code-font-size\) \* 1\.06\);/);
  assert.match(stylesCss, /\.operation-detail\s*{[\s\S]*height:\s*100%;/);
  assert.match(stylesCss, /\.operation-detail\s*{[\s\S]*max-height:\s*100%;/);
  assert.match(stylesCss, /\.operation-detail\s*{[\s\S]*white-space:\s*normal;/);
  assert.match(stylesCss, /\.live-operation-dock \.operation-detail\s*{[\s\S]*-webkit-line-clamp:\s*2;/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.main\s*{[\s\S]*--mobile-floating-control-size:\s*36px;[\s\S]*--mobile-floating-control-right:\s*max\(14px, env\(safe-area-inset-right, 0px\)\);[\s\S]*--mobile-floating-control-gap:\s*6px;/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.live-operation-dock\s*{[\s\S]*position:\s*fixed;/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.live-operation-dock\[data-mobile-visible="false"\]\s*{[\s\S]*display:\s*none;/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.live-operation-dock\[data-recall-visible="true"\]:not\(\[data-mode="expanded"\]\)\s*{[\s\S]*right:\s*var\(--mobile-floating-control-right\);[\s\S]*bottom:\s*calc\(var\(--composer-height, 92px\) \+ 8px\);/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.live-operation-dock-desktop\s*{[\s\S]*display:\s*none;/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.mobile-operation-bubble\s*{[\s\S]*display:\s*inline-flex;/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.mobile-operation-bubble-summary\s*{[\s\S]*max-width:\s*34vw;/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.mobile-operation-bubble-duration\s*{[\s\S]*color:\s*var\(--accent-strong\);/);
  assert.match(stylesCss, /\.mobile-operation-recall\s*{[\s\S]*display:\s*none;/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.mobile-operation-recall\s*{[\s\S]*display:\s*grid;[\s\S]*width:\s*var\(--mobile-floating-control-size\);[\s\S]*height:\s*var\(--mobile-floating-control-size\);/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.mobile-operation-recall-dot\s*{[\s\S]*width:\s*7px;[\s\S]*height:\s*7px;/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.scroll-bottom-button\s*{[\s\S]*right:\s*var\(--mobile-floating-control-right\);[\s\S]*bottom:\s*calc\(var\(--composer-height, 92px\) \+ 8px \+ var\(--mobile-floating-control-size\) \+ var\(--mobile-floating-control-gap\)\);[\s\S]*width:\s*var\(--mobile-floating-control-size\);[\s\S]*height:\s*var\(--mobile-floating-control-size\);/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.scroll-turn-reply-button\s*{[\s\S]*right:\s*calc\(var\(--mobile-floating-control-right\) \+ var\(--mobile-floating-control-size\) \+ 8px\);/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.mobile-operation-sheet\s*{[\s\S]*background:\s*var\(--panel\);[\s\S]*border:\s*1px solid var\(--line\);/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.mobile-operation-sheet\s*{[\s\S]*isolation:\s*isolate;/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.live-operation-dock\[data-mode="expanded"\] \.mobile-operation-sheet\s*{[\s\S]*display:\s*block;/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.mobile-operation-sheet \.live-operation\s*{[\s\S]*background:\s*var\(--panel\);/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.mobile-operation-sheet \.operation-meta-line\s*{[\s\S]*padding-right:\s*0;/);
});

test("live operation dock ignores completed operations but keeps active status row", () => {
  const currentLiveOperationEntry = Function(`
const state = { currentThread: null, nowMs: 2000, activityAtMs: 0 };
function statusText(status) {
  if (!status) return "";
  if (typeof status === "string") return status;
  return status.type || status.state || "";
}
function isCompletedStatus(status) {
  return /completed|failed|cancel|error|interrupted/i.test(statusText(status));
}
function isRunningStatus(status) {
  const text = statusText(status).toLowerCase();
  return /(running|active|queued|processing|inprogress|in_progress|in-progress)/.test(text)
    && !/(completed|failed|cancel|error|interrupted)/.test(text);
}
function isTurnComplete(turn) {
  return Boolean(turn && (turn.completedAt || turn.durationMs || isCompletedStatus(turn.status)));
}
function isOperationalItem(item) {
  return item && ["commandExecution", "fileChange", "dynamicToolCall", "mcpToolCall"].includes(item.type);
}
function isLatestTurn(turn) {
  const turns = state.currentThread && Array.isArray(state.currentThread.turns) ? state.currentThread.turns : [];
  return Boolean(turn && turns[turns.length - 1] === turn);
}
function isLiveTurn(turn) {
  return Boolean(turn && !isTurnComplete(turn) && isRunningStatus(turn.status));
}
function turnStartedAtMs() { return 0; }
${functionSource("isActiveOperationalItem")}
${functionSource("liveTurnStatusDockItem")}
${functionSource("currentLiveOperationEntry")}
return (thread) => {
  state.currentThread = thread;
  return currentLiveOperationEntry(thread);
};
`)();
  const thread = {
    turns: [{
      id: "music-live",
      status: { type: "active" },
      items: [
        { id: "running-cmd", type: "commandExecution", status: "running", command: "npm test" },
        { id: "completed-file", type: "fileChange", status: "completed" },
      ],
    }],
  };

  assert.equal(currentLiveOperationEntry(thread).item.id, "running-cmd");

  thread.turns[0].items = [
    { id: "completed-cmd", type: "commandExecution", status: "completed", command: "npm test" },
    { id: "completed-file", type: "fileChange", status: "completed" },
  ];

  const fallbackEntry = currentLiveOperationEntry(thread);
  assert.equal(fallbackEntry.sourceIndex, -1);
  assert.equal(fallbackEntry.item.type, "liveTurnStatus");
  assert.equal(fallbackEntry.item.title, "Command");
  assert.equal(fallbackEntry.item.status, "");
});

test("current-turn subagent panel opens from a left swipe without a topbar button", () => {
  assert.match(indexHtml, /id="subagentPanel"/);
  assert.doesNotMatch(indexHtml, /id="subagentStatusButton"/);
  assert.match(appJs, /subagentSwipe:\s*null/);
  assert.match(appJs, /const SUBAGENT_EDGE_SWIPE_PX = 56/);
  assert.match(appJs, /const SUBAGENT_EDGE_SWIPE_MAX_PX = 88/);
  assert.match(appJs, /function subagentSwipeStartsNearEdge\(/);
  assert.match(appJs, /function currentSubagentItems\(/);
  assert.match(appJs, /function turnSubagentItems\(/);
  assert.match(appJs, /function beginSubagentSwipe\(/);
  assert.match(appJs, /function handleSubagentWheelSwipe\(/);
  assert.match(appJs, /addEventListener\("touchstart", beginSubagentSwipe/);
  assert.match(appJs, /addEventListener\("wheel", handleSubagentWheelSwipe/);
  assert.match(appJs, /function isHorizontalScrollableGestureTarget\(/);
  assert.match(functionBody("isHorizontalScrollableGestureTarget"), /markdown-mermaid-viewer/);
  assert.match(functionBody("isHorizontalScrollableGestureTarget"), /markdown-table-wrap/);
  assert.match(functionBody("isHorizontalScrollableGestureTarget"), /markdown-code-table-preview/);
  assert.match(functionBody("beginSubagentSwipe"), /isHorizontalScrollableGestureTarget\(event\.target\)/);
  assert.match(functionBody("beginSubagentSwipe"), /subagentSwipeStartsNearEdge\(touch\.clientX\)/);
  assert.match(functionBody("handleSubagentWheelSwipe"), /isHorizontalScrollableGestureTarget\(event\.target\)/);
  assert.match(functionBody("handleSubagentWheelSwipe"), /subagentSwipeStartsNearEdge\(event\.clientX\)/);
  assert.match(functionBody("isSubagentItem"), /collabAgentToolCall/);
  assert.match(appJs, /function activeSubagentItems\(/);
  assert.match(appJs, /function isActiveSubagentItem\(/);
  assert.match(functionBody("currentSubagentItems"), /currentLiveTurn\(\) === turn/);
  assert.match(functionBody("currentSubagentItems"), /turnSubagentItems\(turn\)/);
  assert.match(functionBody("currentSubagentItems"), /activeSubagentItems\(turn\)/);
  assert.match(functionBody("currentSubagentTurn"), /currentLiveTurn\(\)/);
  assert.match(functionBody("currentSubagentTurn"), /turnSubagentItems\(live\)\.length/);
  assert.doesNotMatch(functionBody("currentSubagentTurn"), /turns\.length - 1/);
  assert.match(functionBody("isActiveSubagentItem"), /kind === "running" \|\| kind === "queued"/);
  assert.match(appJs, /function currentSubagentStatusKind\(/);
  assert.match(functionBody("currentSubagentStatusKind"), /currentLiveTurn\(\) === turn/);
  assert.match(functionBody("currentSubagentStatusKind"), /kind === "completed" \|\| kind === "unknown"/);
  assert.match(functionBody("subagentSwipeAvailable"), /Boolean\(state\.currentThread\)/);
  assert.match(functionBody("renderSubagentPanel"), /thread-side-panel/);
  assert.match(functionBody("renderSubagentPanel"), /no-subagents/);
  assert.match(functionBody("renderSubagentPanel"), /renderSubagentStatusWindow\(\)/);
  assert.match(functionBody("renderSubagentPanel"), /renderSideChatPanel\(\)/);
  assert.match(functionBody("renderSubagentStatusWindow"), /subagent-status-window/);
  assert.match(functionBody("renderSubagentStatusWindow"), /if \(!items\.length\) return "";/);
  assert.doesNotMatch(functionBody("renderSubagentStatusWindow"), /subagent-empty/);
  assert.match(functionBody("renderSubagentStatusWindow"), /当前进行中/);
  assert.match(appJs, /function renderSideChatPanel\(/);
  assert.match(functionBody("renderSideChatPanel"), /side-chat-section/);
  assert.match(functionBody("renderSideChatPanel"), /data-side-chat-draft/);
  assert.match(functionBody("renderSideChatPanel"), /data-subagent-panel-close/);
  assert.match(functionBody("renderSideChatPanel"), /服务器保存/);
  assert.match(functionBody("renderSideChatPanel"), /side-chat-composer-row/);
  assert.match(functionBody("renderSideChatPanel"), /data-side-chat-action="tools"/);
  assert.match(functionBody("renderSideChatPanel"), /data-side-chat-action="clear"/);
  assert.match(functionBody("renderSideChatPanel"), /side-chat-clear/);
  assert.match(functionBody("renderSideChatPanel"), /renderSideChatNotice\(threadId\)/);
  assert.match(functionBody("renderSideChatPanel"), />Send</);
  assert.doesNotMatch(functionBody("renderSideChatPanel"), /side-chat-empty compact/);
  assert.match(functionBody("renderSideChatMessage"), /side-chat-message-actions/);
  assert.match(functionBody("renderSideChatMessage"), /data-side-chat-action="message-apply"/);
  assert.match(appJs, /function scheduleSideChatToBottom\(/);
  assert.match(functionBody("updateSubagentPanelUi"), /options\.scrollSideChatToBottom/);
  assert.match(functionBody("openSubagentPanelFromGesture"), /scrollSideChatToBottom: true/);
  assert.match(appJs, /function setSideChatNotice\(/);
  assert.match(appJs, /function renderSideChatNotice\(/);
  assert.match(functionBody("queueSideChatCandidate"), /setSideChatNotice\("success"/);
  assert.match(functionBody("createSideChatCandidateFromText"), /setSideChatNotice\("success"/);
  assert.match(functionBody("handleSideChatActionClick"), /openSideChatCandidate\(candidateId\)/);
  assert.match(appJs, /function loadSideChat\(/);
  assert.match(appJs, /function saveSideChatDraft\(/);
  assert.match(appJs, /function applySideChatCandidate\(/);
  assert.match(appJs, /function queueSideChatCandidate\(/);
  assert.match(appJs, /function createSideChatCandidateFromMessage\(/);
  assert.match(functionBody("scheduleSideChatDraftSave"), /saveSideChatDraft/);
  assert.doesNotMatch(functionBody("scheduleSideChatDraftSave"), /localStorage|sessionStorage|indexedDB|draftStore/);
  assert.match(stylesCss, /\.subagent-panel\s*{[\s\S]*position:\s*fixed;/);
  assert.match(stylesCss, /\.subagent-panel\s*{[\s\S]*height:\s*var\(--app-height, 100dvh\);/);
  assert.match(stylesCss, /\.subagent-panel\s*{[\s\S]*font-size:\s*var\(--content-font-size\);/);
  assert.match(stylesCss, /\.thread-side-panel/);
  assert.match(stylesCss, /\.thread-side-panel\.no-subagents\s*{[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\);/);
  assert.match(stylesCss, /\.side-chat-section/);
  assert.match(stylesCss, /\.side-chat-section\s*{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/);
  assert.match(stylesCss, /\.side-chat-scroll\s*{[\s\S]*flex:\s*1 1 auto;/);
  assert.match(stylesCss, /\.side-chat-form\s*{[\s\S]*flex:\s*0 0 auto;/);
  assert.match(stylesCss, /\.side-chat-form textarea/);
  assert.match(stylesCss, /\.side-chat-message-text,\s*\n\.side-chat-candidate-body\s*{[\s\S]*font-size:\s*var\(--content-font-size\);/);
  assert.match(stylesCss, /\.side-chat-composer-row\s*{[\s\S]*grid-template-columns:\s*44px minmax\(0, 1fr\) max-content;/);
  assert.match(stylesCss, /\.side-chat-tool-button,\s*\n\.side-chat-send\s*{[\s\S]*min-height:\s*44px;/);
  assert.match(stylesCss, /\.side-chat-notice\s*{[\s\S]*display:\s*flex;/);
  assert.match(stylesCss, /\.side-chat-form textarea\s*{[\s\S]*font-size:\s*var\(--composer-input-font-size\);/);
  assert.match(stylesCss, /\.subagent-status-row/);
});
