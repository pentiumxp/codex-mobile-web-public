"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");

test("upward user scroll can jump back to the current answer start", () => {
  assert.match(indexHtml, /id="scrollToTurnReply"/);
  assert.match(stylesCss, /\.scroll-turn-reply-button/);
  assert.match(stylesCss, /\.scroll-turn-reply-button\s*\{\s*right: 74px;/);
  assert.match(appJs, /const TURN_REPLY_JUMP_WINDOW_MS = 10 \* 60 \* 1000;/);
  assert.match(appJs, /function rememberRecentCompletedTurnReply\(turnId\)/);
  assert.match(appJs, /rememberRecentCompletedTurnReply\(params\.turn\.id\)/);
  assert.match(appJs, /conversationLastScrollTop: 0/);
  assert.match(appJs, /function turnCompletedAtMs\(turn, thread = null\)/);
  assert.match(appJs, /function isRecentReplyJumpTurn\(turn\)/);
  assert.match(appJs, /function updateRecentCompletedReplyAnchorFromScroll\(\)/);
  assert.match(appJs, /if \(delta < -2\) \{\s*activateRecentCompletedReplyAnchorFromUserScroll\(\);/);
  assert.match(appJs, /activatedByUserScroll: true/);
  assert.match(appJs, /function turnReplyStartNode\(/);
  assert.match(appJs, /if \(replies\.length\) return replies\[0\];/);
  assert.match(appJs, /querySelectorAll\("\.item\.agentMessage"\)/);
  assert.match(appJs, /scrollToTurnReply"\)\)\s*\$\("scrollToTurnReply"\)\.addEventListener\("click", scrollConversationToTurnReply\)/);
});

test("manual conversation scroll pauses live auto-stick until the user returns to bottom", () => {
  assert.match(appJs, /autoScrollHold: null/);
  assert.match(appJs, /submittedMessageBottomFollow: null/);
  assert.match(appJs, /viewportBottomFollow: null/);
  assert.match(appJs, /function rememberConversationScrollIntent\(\)/);
  assert.match(appJs, /clearSubmittedMessageBottomFollow\(\);\s*clearViewportBottomFollow\(\);\s*syncConversationScrollPosition\(\);/);
  assert.match(appJs, /function updateConversationAutoScrollHoldFromScroll\(\)/);
  assert.match(appJs, /if \(currentLiveTurn\(\)\) rememberConversationAutoScrollHold\(\);/);
  assert.match(appJs, /const shouldFollowBottom = shouldFollowSubmittedMessageToBottom\(\) \|\| shouldFollowViewportChangeToBottom\(\);/);
  assert.match(appJs, /const shouldStickToBottom = shouldFollowBottom/);
  assert.match(appJs, /addEventListener\("touchstart", rememberConversationScrollIntent/);
  assert.match(appJs, /addEventListener\("wheel", rememberConversationScrollIntent/);
  assert.match(appJs, /clearConversationAutoScrollHold\(\);\s*clearRecentCompletedReplyAnchor\(\);\s*clearSubmittedMessageBottomFollow\(\);\s*clearViewportBottomFollow\(\);\s*scrollConversationToBottom\(\);/);
});

test("orientation and viewport resize preserve bottom position when already near bottom", () => {
  assert.match(appJs, /conversationNearBottomAtMs: 0/);
  assert.match(appJs, /conversationNearBottomThreadId: ""/);
  assert.match(appJs, /function clearConversationNearBottomState\(\)/);
  assert.match(appJs, /function followViewportChangeToBottom\(reason = "viewport"\)/);
  assert.match(appJs, /const lastNearBottomAtMs = state\.conversationNearBottomThreadId === threadId/);
  assert.match(appJs, /conversationScroll\.shouldStartViewportFollow\(\{/);
  assert.match(appJs, /conversationScroll\.createViewportFollow\(threadId/);
  assert.match(appJs, /function scheduleViewportBottomFollowScroll\(\)/);
  assert.match(appJs, /scheduleBottomFollowScroll\(shouldFollowViewportChangeToBottom\);/);
  assert.match(appJs, /if \(shouldFollow\(\)\) scrollConversationToBottom\(\);/);
  assert.match(appJs, /window\.addEventListener\("orientationchange", \(\) => \{\s*followViewportChangeToBottom\("orientation"\);/);
  assert.match(appJs, /window\.addEventListener\("resize", \(\) => \{\s*followViewportChangeToBottom\("resize"\);/);
  assert.match(appJs, /window\.visualViewport\.addEventListener\("resize", \(\) => \{\s*followViewportChangeToBottom\("visual-viewport-resize"\);/);
  assert.match(appJs, /noteConversationBottomState\(\{ userIntent: Date\.now\(\) - Number\(state\.conversationScrollIntentAtMs \|\| 0\) <= 1200 \}\);/);
});

test("successful message submit follows the new turn to the bottom", () => {
  assert.match(appJs, /const conversationScroll = window\.CodexConversationScroll/);
  assert.match(appJs, /function followSubmittedMessageToBottom\(threadId, clientSubmissionId = ""\)/);
  assert.match(appJs, /conversationScroll\.createSubmittedMessageFollow\(threadId/);
  assert.match(appJs, /function scheduleSubmittedMessageBottomFollowScroll\(\)/);
  assert.match(appJs, /scheduleBottomFollowScroll\(shouldFollowSubmittedMessageToBottom\);/);
  assert.match(appJs, /if \(shouldFollow\(\)\) scrollConversationToBottom\(\);/);
  assert.match(appJs, /followSubmittedMessageToBottom\(state\.currentThreadId, clientSubmissionId\);[\s\S]*await api\(`\/api\/threads\/\$\{encodeURIComponent\(state\.currentThreadId\)\}\/messages`/);
  assert.match(appJs, /clearSubmittedMessageBottomFollow\(\);[\s\S]*const message = normalizeClientErrorMessage/);
  assert.match(appJs, /conversationScroll\.isNearBottom\(\{/);
});
