"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");
const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");

test("iPad landscape split layout keeps the composer inside the app viewport", () => {
  const mediaIndex = stylesCss.indexOf("@media (pointer: coarse) and (orientation: landscape) and (min-width: 900px) and (min-height: 600px)");
  assert.ok(mediaIndex > 0, "missing iPad landscape media query");

  const nextMediaIndex = stylesCss.indexOf("@media", mediaIndex + 1);
  const mediaBody = stylesCss.slice(mediaIndex, nextMediaIndex);
  assert.match(mediaBody, /\.app\s*{[\s\S]*grid-template-columns:\s*minmax\(360px,\s*420px\) minmax\(0,\s*1fr\)/);
  assert.match(mediaBody, /\.main,\s*\.sidebar\s*{[\s\S]*min-height:\s*0;[\s\S]*max-height:\s*100%;/);
  assert.doesNotMatch(mediaBody, /composer-keyboard-focus/);
  assert.doesNotMatch(appJs, /updateComposerKeyboardAvoidance/);
});
