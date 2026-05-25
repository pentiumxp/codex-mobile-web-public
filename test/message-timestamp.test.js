"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const stylesCss = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

test("conversation cards render compact timestamps in the item header", () => {
  assert.match(appJs, /function renderItemTimestampHtml\(item,\s*turn = null\)/);
  assert.match(appJs, /<time class="item-timestamp"/);
  assert.match(appJs, /const timestampHtml = renderItemTimestampHtml\(item,\s*turn\)/);
  assert.match(appJs, /<span class="item-head-actions">\$\{timestampHtml\}/);
  assert.match(stylesCss, /\.item-timestamp\s*{[\s\S]*font-variant-numeric:\s*tabular-nums;/);
});

test("card timestamps fall back from item time to turn time", () => {
  assert.match(appJs, /function itemTimestampMs\(item,\s*turn = null\)/);
  assert.match(appJs, /numericTimestampMs\(item\.startedAtMs\)/);
  assert.match(appJs, /turnCompletedAtMs\(turn,\s*state\.currentThread\)/);
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
  assert.match(body, /isLiveTurn\(turn\) \? 0 : turnStartedAtMs\(turn\)/);
  assert.match(body, /if \(isLiveTurn\(turn\) && isOperationalItem\(item\)\) return 0;/);
});

test("locally created visible messages receive a timestamp immediately", () => {
  assert.match(appJs, /item = \{ id: itemId,\s*type: itemType,\s*startedAtMs: Date\.now\(\) \}/);
  assert.match(appJs, /startedAtMs: Date\.now\(\),\r?\n\s*content:/);
});
