"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");
const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");
const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");
const swJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "sw.js"), "utf8");

test("mobile viewport and early guards disable page zoom", () => {
  assert.match(indexHtml, /name="viewport" content="[^"]*maximum-scale=1/);
  assert.match(indexHtml, /name="viewport" content="[^"]*minimum-scale=1/);
  assert.match(indexHtml, /name="viewport" content="[^"]*user-scalable=no/);
  assert.match(indexHtml, /addEventListener\("gesturestart", preventZoom, \{ passive: false \}\)/);
  assert.match(indexHtml, /addEventListener\("gesturechange", preventZoom, \{ passive: false \}\)/);
  assert.match(indexHtml, /addEventListener\("dblclick", preventZoom, \{ passive: false \}\)/);
  assert.match(indexHtml, /lastTouchEndAt < 320/);
  assert.match(stylesCss, /html,\s*\nbody\s*{[\s\S]*touch-action:\s*pan-x pan-y;/);
});

test("public app shell cache advances after viewport change", () => {
  assert.match(swJs, /codex-mobile-shell-v36/);
  assert.match(appJs, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(appJs, /state\.serviceWorkerRegistration\.update\(\)\.catch/);
});
