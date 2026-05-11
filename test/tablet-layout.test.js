"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");
const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");

test("iPad landscape split layout gives composer a narrow-column grid", () => {
  const mediaIndex = stylesCss.indexOf("@media (pointer: coarse) and (orientation: landscape) and (min-width: 900px) and (min-height: 600px)");
  assert.ok(mediaIndex > 0, "missing iPad landscape media query");

  const nextMediaIndex = stylesCss.indexOf("@media", mediaIndex + 1);
  const mediaBody = stylesCss.slice(mediaIndex, nextMediaIndex);
  assert.match(mediaBody, /\.composer\s*{/);
  assert.match(mediaBody, /grid-template-areas:\s*"controls controls controls"\s*"attachments attachments attachments"\s*"attach input send"/);
  assert.match(mediaBody, /\.composer-body\s*{\s*display:\s*contents;/);
  assert.match(mediaBody, /\.message-input\s*{[\s\S]*grid-area:\s*input;/);
  assert.match(mediaBody, /\.app\.composer-keyboard-focus \.composer/);
  assert.match(mediaBody, /--composer-keyboard-lift/);
  assert.match(appJs, /function scheduleConversationKeyboardAvoidanceScroll\(/);
  assert.match(appJs, /scrollConversationToBottom\(\)/);
});
