"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { readFrontendSources } = require("./frontend-source-helper");

const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");
const appJs = readFrontendSources(path.resolve(__dirname, ".."));

test("iPad landscape split layout keeps the composer inside the app viewport", () => {
  const mediaIndex = stylesCss.indexOf("@media (pointer: coarse) and (orientation: landscape) and (min-width: 900px) and (min-height: 600px)");
  assert.ok(mediaIndex > 0, "missing iPad landscape media query");

  const nextMediaIndex = stylesCss.indexOf("@media", mediaIndex + 1);
  const mediaBody = stylesCss.slice(mediaIndex, nextMediaIndex);
  assert.match(mediaBody, /\.app\s*{[\s\S]*grid-template-columns:\s*clamp\(340px,\s*36vw,\s*400px\) minmax\(0,\s*1fr\)/);
  assert.match(mediaBody, /\.main,\s*\.sidebar\s*{[\s\S]*min-height:\s*0;[\s\S]*max-height:\s*100%;/);
  assert.match(mediaBody, /\.composer-controls\s*{[\s\S]*grid-template-columns:\s*42px minmax\(0,\s*0\.96fr\) minmax\(0,\s*0\.78fr\) minmax\(0,\s*0\.84fr\) minmax\(0,\s*1\.06fr\);/);
  assert.doesNotMatch(mediaBody, /composer-keyboard-focus/);
  assert.doesNotMatch(appJs, /updateComposerKeyboardAvoidance/);
});
