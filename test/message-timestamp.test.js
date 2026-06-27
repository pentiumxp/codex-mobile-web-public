"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const stylesCss = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

function functionSourceFrom(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const bodyStart = source.indexOf(") {", start) + 2;
  assert.notEqual(bodyStart, 1, `missing function body ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`could not parse function ${name}`);
}

test("conversation cards render compact timestamps in the item header", () => {
  assert.match(appJs, /function renderItemTimestampHtml\(item,\s*turn = null,\s*thread = null\)/);
  assert.match(appJs, /<time class="item-timestamp"/);
  assert.match(appJs, /const timestampHtml = renderItemTimestampHtml\(item,\s*turn,\s*contextThread\)/);
  assert.match(appJs, /<span class="item-head-actions">\$\{timestampHtml\}/);
  assert.match(stylesCss, /\.item-timestamp\s*{[\s\S]*font-variant-numeric:\s*tabular-nums;/);
});

test("card timestamps fall back from item time to turn time", () => {
  assert.match(appJs, /function itemTimestampMs\(item,\s*turn = null,\s*thread = null\)/);
  assert.match(appJs, /numericTimestampMs\(item\.startedAtMs\)/);
  assert.match(appJs, /const contextThread = renderContextThread\(thread\);/);
  assert.match(appJs, /turnCompletedAtMs\(turn,\s*contextThread\)/);
  assert.match(appJs, /function turnStartedAtMs\(turn\)/);
});

test("running turn timestamps do not fall back to stale thread updated time", () => {
  assert.match(appJs, /function turnCompletedAtMs\(turn,\s*thread = null\)/);
  assert.match(appJs, /if \(!isTurnComplete\(turn\)\) return 0;/);
  assert.match(appJs, /const startedAt = turnStartedAtMs\(turn\);/);
  assert.match(appJs, /if \(!fallback \|\| \(startedAt && fallback < startedAt\)\) return 0;/);
});

test("live agent message timestamps do not pretend turn start is item time", () => {
  const body = appJs.slice(appJs.indexOf("function itemTimestampMs"), appJs.indexOf("function turnStartedAtMs"));
  assert.match(body, /isLiveTurn\(turn, contextThread\) \? 0 : turnStartedAtMs\(turn\)/);
  assert.match(body, /if \(isLiveTurn\(turn, contextThread\) && isOperationalItem\(item\)\) return 0;/);
});

test("item timestamp fallback uses explicit render context thread", () => {
  const sources = [
    "renderContextThread",
    "itemTimestampMs",
  ].map((name) => functionSourceFrom(appJs, name));
  const result = Function(`
const targetThread = { id: "target-thread" };
const currentThread = { id: "current-thread" };
const state = { currentThread, renderContextThread: null };
function numericTimestampMs(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}
function turnCompletedAtMs(turn, thread) {
  if (thread && thread.id === "target-thread") return 5000;
  if (thread && thread.id === "current-thread") return 1000;
  return 0;
}
function isLiveTurn() { return false; }
function turnStartedAtMs() { return 3000; }
function isOperationalItem() { return false; }
${sources.join("\n")}
const item = { type: "agentMessage" };
const turn = { id: "turn" };
return {
  current: itemTimestampMs(item, turn),
  explicit: itemTimestampMs(item, turn, targetThread),
};
`)();

  assert.deepEqual(result, { current: 1000, explicit: 5000 });
});

test("locally created visible messages receive a timestamp immediately", () => {
  assert.match(appJs, /item = \{ id: itemId,\s*type: itemType,\s*startedAtMs: Date\.now\(\) \}/);
  assert.match(appJs, /startedAtMs: Date\.now\(\),\r?\n\s*content,\r?\n/);
});
