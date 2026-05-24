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

test("live operation cards stay compact, three-line, and expose only the newest operation", () => {
  assert.match(functionBody("renderLiveOperation"), /renderOperationCard\(item, key, \{ status \}\)/);
  assert.match(functionBody("renderLiveOperation"), /stableOperationRenderKey\(turn, item, index\)/);
  assert.match(functionBody("renderOperationCard"), /operation-meta-line/);
  assert.match(functionBody("renderOperationCard"), /operation-detail-line/);
  assert.match(functionBody("renderOperationCard"), /operation-title[\s\S]*operation-status/);
  assert.match(functionBody("operationDetailText"), /join\(" \\| "\)/);
  assert.match(functionBody("visibleItemsForTurn"), /const showOperations = isLatestTurn\(turn\)/);
  assert.match(functionBody("visibleItemsForTurn"), /let latestOperationEntry = null/);
  assert.match(functionBody("visibleItemsForTurn"), /if \(latestOperationEntry\) visible\[latestOperationEntry\.visibleIndex\] = null/);
  assert.match(functionBody("visibleItemsForTurn"), /latestOperationEntry = \{ visibleIndex: visible\.length, sourceIndex: index \}/);
  assert.match(functionBody("visibleItemsForTurn"), /return visible\.filter\(Boolean\)/);
  assert.doesNotMatch(functionBody("visibleItemsForTurn"), /operationEntryByKey = new Map/);
  assert.doesNotMatch(functionBody("visibleItemsForTurn"), /lastOperationEntry/);
  assert.doesNotMatch(appJs, /function trimTrailingOperationCards\(/);
  assert.match(functionBody("stableOperationRenderKey"), /operationGroupKey\(item\)/);
  assert.match(functionBody("operationGroupKey"), /item\.command/);
  assert.match(functionBody("operationGroupKey"), /operationCommandGroupText\(item\)/);
  assert.match(functionBody("operationCommandGroupText"), /operationCommandName\(item\)/);
  assert.match(functionBody("operationCommandName"), /shortPath\(stripMatchingOuterQuotes\(token\)\)/);
  assert.match(functionBody("operationSummaryLines"), /operationCommandSummary\(item\)/);
  assert.match(functionBody("operationGroupKey"), /operationRawFileNames\(item\)/);
  assert.match(functionBody("visibleItemsForTurn"), /if \(!showOperations\) return/);
  assert.doesNotMatch(appJs, /function latestVisibleOperationItem\(/);
  assert.doesNotMatch(appJs, /function removeOperationalItemsFromTurn\(/);
  assert.match(stylesCss, /\.operation-meta-line\s*{[\s\S]*display:\s*flex;/);
  assert.match(stylesCss, /\.operation-meta-line\s*{[\s\S]*justify-content:\s*flex-start;/);
  assert.match(stylesCss, /\.operation-title\s*{[\s\S]*font-size:\s*calc\(var\(--content-small-font-size\) \* 0\.92\);/);
  assert.match(stylesCss, /\.operation-status\s*{[\s\S]*font-size:\s*calc\(var\(--content-small-font-size\) \* 0\.92\);/);
  const operationDetailCss = cssRuleBody(".operation-detail");
  assert.match(operationDetailCss, /font-size:\s*calc\(var\(--content-code-font-size\) \* 1\.06\);/);
  assert.match(operationDetailCss, /-webkit-line-clamp:\s*2;/);
  assert.match(operationDetailCss, /max-height:\s*calc\(1\.26em \* 2\);/);
  assert.match(operationDetailCss, /white-space:\s*normal;/);
  assert.doesNotMatch(operationDetailCss, /white-space:\s*nowrap;/);
});

test("current-turn subagent panel opens from a left swipe without a topbar button", () => {
  assert.match(indexHtml, /id="subagentPanel"/);
  assert.doesNotMatch(indexHtml, /id="subagentStatusButton"/);
  assert.match(appJs, /subagentSwipe:\s*null/);
  assert.match(appJs, /function currentSubagentItems\(/);
  assert.match(appJs, /function turnSubagentItems\(/);
  assert.match(appJs, /function beginSubagentSwipe\(/);
  assert.match(appJs, /function handleSubagentWheelSwipe\(/);
  assert.match(appJs, /addEventListener\("touchstart", beginSubagentSwipe/);
  assert.match(appJs, /addEventListener\("wheel", handleSubagentWheelSwipe/);
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
  assert.match(functionBody("renderSubagentPanel"), /subagent-status-window/);
  assert.match(functionBody("renderSubagentPanel"), /subagent-empty/);
  assert.match(functionBody("renderSubagentPanel"), /当前进行中/);
  assert.match(stylesCss, /\.subagent-panel\s*{[\s\S]*position:\s*absolute;/);
  assert.match(stylesCss, /\.subagent-empty/);
  assert.match(stylesCss, /\.subagent-status-row/);
});
