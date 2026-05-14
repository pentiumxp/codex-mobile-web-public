"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");

test("recent completed turn can jump back to the latest assistant reply", () => {
  assert.match(indexHtml, /id="scrollToTurnReply"/);
  assert.match(stylesCss, /\.scroll-turn-reply-button/);
  assert.match(appJs, /const TURN_REPLY_JUMP_WINDOW_MS = 10 \* 60 \* 1000;/);
  assert.match(appJs, /function rememberRecentCompletedTurnReply\(turnId\)/);
  assert.match(appJs, /rememberRecentCompletedTurnReply\(params\.turn\.id\)/);
  assert.match(appJs, /function latestTurnReplyNode\(/);
  assert.match(appJs, /querySelectorAll\("\.item\.agentMessage"\)/);
  assert.match(appJs, /scrollToTurnReply"\)\)\s*\$\("scrollToTurnReply"\)\.addEventListener\("click", scrollConversationToTurnReply\)/);
});

test("manual conversation scroll pauses live auto-stick until the user returns to bottom", () => {
  assert.match(appJs, /autoScrollHold: null/);
  assert.match(appJs, /function rememberConversationScrollIntent\(\)/);
  assert.match(appJs, /function updateConversationAutoScrollHoldFromScroll\(\)/);
  assert.match(appJs, /if \(currentLiveTurn\(\)\) rememberConversationAutoScrollHold\(\);/);
  assert.match(appJs, /const shouldStickToBottom = !shouldHoldAutoScrollForCurrentTurn\(\)/);
  assert.match(appJs, /addEventListener\("touchstart", rememberConversationScrollIntent/);
  assert.match(appJs, /addEventListener\("wheel", rememberConversationScrollIntent/);
  assert.match(appJs, /clearConversationAutoScrollHold\(\);\s*scrollConversationToBottom\(\);/);
});
