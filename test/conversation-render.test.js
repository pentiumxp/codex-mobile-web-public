"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

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

test("context compaction notices update status and collapse repeated turn notices", () => {
  assert.match(functionBody("visibleItemsForTurn"), /const contextEntryByKey = new Map\(\)/);
  assert.match(functionBody("visibleItemsForTurn"), /isContextCompactionItem\(item\)/);
  assert.match(functionBody("visibleItemsForTurn"), /visible\[existing\.visibleIndex\] = null/);
  assert.match(functionBody("visibleItemsForTurn"), /return visible\.filter\(Boolean\)/);
  assert.match(functionBody("visibleItemSignature"), /isContextCompactionItem\(item\)/);
  assert.match(functionBody("visibleItemSignature"), /mobileCompactionStatus: item\.mobileCompactionStatus/);
  assert.match(functionBody("visibleItemSignature"), /notice: contextCompactionNotice\(item, turn\)/);
  assert.match(functionBody("conversationRenderSignature"), /visibleItemSignature\(entry\.item, turn\)/);
});

test("long agent messages keep a stable render path when a turn completes", () => {
  assert.match(functionBody("renderItemBody"), /if \(item\.type === "agentMessage"\) \{[\s\S]*return renderMarkdown\(item\.text \|\| ""\);/);
  assert.doesNotMatch(functionBody("renderItemBody"), /isLiveTurn\(turn\) \? escapeHtml/);
  assert.match(appJs, /function mergeVisibleTextItemPreservingRenderIdentity\(/);
  assert.match(functionBody("mergeVisibleTextItemPreservingRenderIdentity"), /merged\.id = existingItem\.id/);
  assert.match(functionBody("mergeItemsPreservingLocalVisible"), /mergeVisibleTextItemPreservingRenderIdentity\(existingItem, incomingTextMatch\)/);
  assert.match(functionBody("mergeItemsPreservingLocalVisible"), /const addedIncomingItems = new Set\(\)/);
  assert.match(functionBody("mergeItemsPreservingLocalVisible"), /if \(addedIncomingItems\.has\(incomingItem\)\) continue/);
});

test("matching user messages keep their original turn position after final refresh", () => {
  const body = functionBody("mergeItemsPreservingLocalVisible");
  assert.match(body, /const incomingUserMatch = \(incomingItems \|\| \[\]\)\.find/);
  assert.match(body, /existingItem\.type === "userMessage"/);
  assert.match(body, /userMessagesLikelySame\(existingItem, incomingItem\)/);
  assert.match(body, /merged\.push\(mergeItemPreservingVisibleFields\(existingItem, incomingUserMatch\)\)/);
  assert.match(body, /addedIncomingItems\.add\(incomingUserMatch\)/);
  assert.match(body, /const incomingTextMatch = incomingUserMatch[\s\S]*visibleTextItemsLikelySame\(existingItem, incomingItem\)/);
});
