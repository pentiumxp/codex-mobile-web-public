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

test("collab agent tool calls render as compact summary cards", () => {
  assert.match(appJs, /collabAgentToolCall:\s*"协作 Agent"/);
  assert.match(appJs, /function renderCollabAgentToolCall\(/);
  assert.match(functionBody("renderItemBody"), /renderCollabAgentToolCall\(item\)/);
  assert.match(functionBody("renderCollabAgentToolCall"), /collab-agent-card/);
  assert.match(functionBody("renderCollabAgentToolCall"), /collab-agent-raw/);
  assert.match(stylesCss, /\.item\.collabAgentToolCall/);
  assert.match(stylesCss, /\.collab-agent-card/);
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
  assert.match(functionBody("currentSubagentTurn"), /turns\.length - 1/);
  assert.match(functionBody("subagentSwipeAvailable"), /Boolean\(state\.currentThread\)/);
  assert.match(functionBody("renderSubagentPanel"), /subagent-status-window/);
  assert.match(functionBody("renderSubagentPanel"), /subagent-empty/);
  assert.match(stylesCss, /\.subagent-panel\s*{[\s\S]*position:\s*absolute;/);
  assert.match(stylesCss, /\.subagent-empty/);
  assert.match(stylesCss, /\.subagent-status-row/);
});
