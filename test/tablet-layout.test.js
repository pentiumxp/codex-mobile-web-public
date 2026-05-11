"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");

test("touch tablet layouts give composer a narrow-column grid", () => {
  const splitMediaIndex = stylesCss.indexOf("@media (pointer: coarse) and (orientation: landscape) and (min-width: 900px) and (min-height: 600px)");
  assert.ok(splitMediaIndex > 0, "missing iPad landscape split media query");
  const composerMediaIndex = stylesCss.indexOf("@media (pointer: coarse) and (max-width: 1400px)");
  assert.ok(composerMediaIndex > splitMediaIndex, "missing broad touch composer media query");

  const nextMediaIndex = stylesCss.indexOf("@media", composerMediaIndex + 1);
  const mediaBody = stylesCss.slice(composerMediaIndex, nextMediaIndex);
  assert.match(mediaBody, /\.composer\s*{/);
  assert.match(mediaBody, /grid-template-areas:\s*"controls controls controls"\s*"attachments attachments attachments"\s*"attach input send"/);
  assert.match(mediaBody, /\.composer-body\s*{\s*display:\s*contents;/);
  assert.match(mediaBody, /\.message-input\s*{[\s\S]*grid-area:\s*input;/);
});
