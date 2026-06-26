"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");

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

function assertInOrder(text, patterns) {
  let offset = 0;
  for (const pattern of patterns) {
    const slice = text.slice(offset);
    const match = pattern instanceof RegExp ? pattern.exec(slice) : null;
    assert.ok(match, `missing ordered pattern ${pattern}`);
    offset += match.index + match[0].length;
  }
}

test("current-turn reply jump shares one floating slot with the bottom jump", () => {
  assert.match(indexHtml, /id="scrollToTurnReply"/);
  assert.match(indexHtml, /title="&#22238;&#21040;&#26412;&#36718;&#24635;&#32467;"/);
  assert.match(stylesCss, /\.scroll-turn-reply-button/);
  assert.doesNotMatch(stylesCss, /\.scroll-turn-reply-button\s*\{[^}]*right:\s*74px;/);
  assert.doesNotMatch(stylesCss, /\.scroll-turn-reply-button\s*\{[^}]*right:\s*calc\(var\(--mobile-floating-control-right\) \+ var\(--mobile-floating-control-size\) \+ 8px\)/);
  assert.match(appJs, /const TURN_REPLY_JUMP_WINDOW_MS = 10 \* 60 \* 1000;/);
  assert.match(appJs, /function rememberRecentCompletedTurnReply\(turnId\)/);
  assert.match(appJs, /rememberRecentCompletedTurnReply\(params\.turn\.id\)/);
  assert.match(appJs, /postCompletionRefreshTimers: \[\]/);
  assert.match(appJs, /function schedulePostCompletionThreadRefreshes\(threadId, delays = \[700, 2400\]\)/);
  assert.match(appJs, /schedulePostCompletionThreadRefreshes\(params\.threadId, \[700, 2400\]\)/);
  assert.match(appJs, /refreshCurrentThread\(\{\s*source: "post-completion",\s*full: true,\s*\}\)\.catch\(showError\);/);
  assert.match(appJs, /function latestSuccessfulCompletedTurnMissingUsage\(\)/);
  assert.match(appJs, /function scheduleUsageBackfillRefresh\(delay = 1200\)/);
  assert.match(functionBody("loadThread"), /renderCurrentThread\(\{ stickToBottom: true \}\);[\s\S]*scheduleUsageBackfillRefresh\(\);[\s\S]*postPerformanceEvent\("thread_detail_first_paint"/);
  assert.match(appJs, /scheduleUsageBackfillRefresh\(1400\)/);
  assert.match(appJs, /refreshCurrentThread\(\{ source: "usage-backfill" \}\)\.catch\(showError\);/);
  assert.match(appJs, /state\.usageBackfillAttempts >= 6/);
  assert.match(appJs, /state\.postCompletionRefreshTimers\.forEach\(\(timer\) => clearTimeout\(timer\)\);/);
  assert.match(appJs, /clearUsageBackfillRefresh\(\);/);
  assert.match(appJs, /const previousAnchor = state\.recentCompletedReplyAnchor;/);
  assert.match(appJs, /const keepActivatedByUserScroll = Boolean\(/);
  assert.match(appJs, /activatedByCompletion: true/);
  assert.match(appJs, /activatedByUserScroll: keepActivatedByUserScroll/);
  assert.match(appJs, /receiptStartLocated: false/);
  assert.match(appJs, /conversationLastScrollTop: 0/);
  assert.match(appJs, /function turnCompletedAtMs\(turn, thread = null\)/);
  assert.match(appJs, /function isRecentReplyJumpTurn\(turn\)/);
  assert.match(appJs, /function updateRecentCompletedReplyAnchorFromScroll\(\)/);
  assert.match(appJs, /if \(delta < -2\) \{\s*activateRecentCompletedReplyAnchorFromUserScroll\(\);/);
  assert.match(appJs, /delta > 2 && !\(state\.recentCompletedReplyAnchor && state\.recentCompletedReplyAnchor\.activatedByCompletion\)/);
  assert.match(appJs, /activatedByUserScroll: true/);
  assert.match(appJs, /if \(!anchor\.activatedByUserScroll && !anchor\.activatedByCompletion\) return null;/);
  assert.match(appJs, /function turnFinalReceiptNode\(/);
  assert.match(appJs, /querySelectorAll\("\.item\.agentMessage, \.item\.plan"\)/);
  assert.match(appJs, /return finalReceipts\[finalReceipts\.length - 1\];/);
  assert.match(appJs, /return fallbackItems\[fallbackItems\.length - 1\];/);
  assert.match(appJs, /function scrollConversationToTurnReceiptStart\(turnId\)/);
  assert.match(appJs, /const target = turnFinalReceiptNode\(\{ turnId \}\);/);
  assert.match(appJs, /scrollNodeIntoConversationView\(target\);/);
  assert.match(appJs, /state\.recentCompletedReplyAnchor\.receiptStartLocated = true;/);
  assert.match(appJs, /function pendingCompletedReceiptStartTurnId\(\)/);
  assert.doesNotMatch(appJs, /const receiptStartTurnId = pendingCompletedReceiptStartTurnId\(\);/);
  assert.doesNotMatch(appJs, /renderCurrentThread\(receiptStartTurnId \? \{ scrollToTurnReceiptStart: receiptStartTurnId \} : \{\}\);/);
  assert.match(functionBody("applyNotification"), /renderCurrentThread\(\{ stickToBottom: true \}\);/);
  assert.match(appJs, /scrollToTurnReceiptStart/);
  assert.match(appJs, /const explicitNoStickToBottom = options\.stickToBottom === false \|\| Boolean\(options\.scrollToTurnReceiptStart\);/);
  assert.doesNotMatch(appJs, /return replies\[0\];/);
  assert.match(appJs, /function isNodeStartAboveConversationViewport\(node\)/);
  assert.match(appJs, /return rect\.top < viewport\.top \+ 24;/);
  assert.match(appJs, /isNodeStartAboveConversationViewport\(replyNode\)/);
  assert.match(functionBody("updateScrollToBottomButton"), /const shouldShowReply = Boolean\(\s*!shouldShow/);
  assert.match(appJs, /scrollToTurnReply"\)\)\s*\$\("scrollToTurnReply"\)\.addEventListener\("click", scrollConversationToTurnReply\)/);
  assert.match(appJs, /function ensureUsageSummaryExpandedVisible\(summary\)/);
  assert.match(appJs, /function handleUsageSummaryToggle\(event\)/);
  assert.match(appJs, /addEventListener\("toggle", handleUsageSummaryToggle, true\)/);
});

test("manual conversation scroll pauses live auto-stick until the user returns to bottom", () => {
  assert.match(appJs, /autoScrollHold: null/);
  assert.match(appJs, /submittedMessageBottomFollow: null/);
  assert.match(appJs, /viewportBottomFollow: null/);
  assert.match(appJs, /function rememberConversationScrollIntent\(\)/);
  assert.match(appJs, /clearSubmittedMessageBottomFollow\(\);\s*clearViewportBottomFollow\(\);\s*syncConversationScrollPosition\(\);/);
  assert.match(appJs, /const CONVERSATION_SCROLL_INTENT_MS = 1200;/);
  assert.match(appJs, /function hasRecentConversationScrollIntent\(nowMs = Date\.now\(\)\)/);
  assert.match(appJs, /const userReadingCurrentTurn = isUserReadingCurrentTurn\(\{ nearBottom \}\);/);
  assert.match(appJs, /const sustainedSubmittedFollow = !explicitNoStickToBottom[\s\S]*sustainSubmittedMessageBottomFollowFromThread\(thread\);/);
  assert.match(appJs, /const fullRenderScrollPlan = conversationScroll\.planFullRenderScroll\(\{/);
  assert.match(appJs, /submittedMessageFollow: shouldFollowSubmittedMessageToBottom\(\),/);
  assert.match(appJs, /viewportFollow: shouldFollowViewportChangeToBottom\(\),/);
  assert.match(appJs, /const shouldStickToBottom = Boolean\(fullRenderScrollPlan\.stickToBottom\);/);
  assert.match(appJs, /if \(isUserReadingCurrentTurn\(\)\) \{\s*clearSubmittedMessageBottomFollow\(\);\s*return false;\s*\}/);
  assert.match(appJs, /if \(isUserReadingCurrentTurn\(\)\) \{\s*clearViewportBottomFollow\(\);\s*return false;\s*\}/);
  assert.match(appJs, /function updateConversationAutoScrollHoldFromScroll\(\)/);
  assert.match(appJs, /function turnForConversationAutoScrollHold\(\)/);
  assert.match(appJs, /const turn = turnForConversationAutoScrollHold\(\);/);
  assert.match(appJs, /if \(!hasRecentConversationScrollIntent\(\)\) return;/);
  assert.match(appJs, /if \(turnForConversationAutoScrollHold\(\)\) rememberConversationAutoScrollHold\(\);/);
  assert.doesNotMatch(appJs, /if \(Date\.now\(\) < state\.programmaticScrollUntilMs\) return;\s*if \(isConversationNearBottom\(\)\)/);
  assert.doesNotMatch(appJs, /const shouldFollowBottom = shouldFollowSubmittedMessageToBottom\(\) \|\| shouldFollowViewportChangeToBottom\(\);/);
  assert.doesNotMatch(appJs, /const shouldStickToBottom = shouldFollowBottom/);
  assert.match(appJs, /addEventListener\("touchstart", rememberConversationScrollIntent/);
  assert.match(appJs, /addEventListener\("wheel", rememberConversationScrollIntent/);
  assert.match(appJs, /clearConversationAutoScrollHold\(\);\s*clearSubmittedMessageBottomFollow\(\);\s*clearViewportBottomFollow\(\);\s*scrollConversationToBottom\(\);/);
  assert.doesNotMatch(appJs, /scrollToBottom"\)\)\.addEventListener\("click", \(\) => \{[\s\S]*clearRecentCompletedReplyAnchor\(\);[\s\S]*scrollConversationToBottom\(\);/);
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
  assert.match(appJs, /if \(shouldFollow\(\)\) scheduleConversationToBottom\(\);/);
  assert.match(appJs, /window\.addEventListener\("orientationchange", \(\) => \{\s*followViewportChangeToBottom\("orientation"\);/);
  assert.match(appJs, /window\.addEventListener\("resize", \(\) => \{[\s\S]*if \(!isHermesKeyboardInputActive\(\)\) \{[\s\S]*followViewportChangeToBottom\("resize"\);/);
  assert.match(appJs, /window\.visualViewport\.addEventListener\("resize", \(\) => \{[\s\S]*if \(!isHermesKeyboardInputActive\(\)\) \{[\s\S]*followViewportChangeToBottom\("visual-viewport-resize"\);/);
  assert.match(appJs, /window\.visualViewport\.addEventListener\("scroll", \(\) => \{[\s\S]*if \(!isHermesKeyboardInputActive\(\)\) \{[\s\S]*followViewportChangeToBottom\("visual-viewport-scroll"\);/);
  assert.match(appJs, /noteConversationBottomState\(\{ userIntent: hasRecentConversationScrollIntent\(\) \}\);/);
});

test("successful message submit follows the new turn to the bottom", () => {
  assert.match(appJs, /const conversationScroll = window\.CodexConversationScroll/);
  assert.match(appJs, /function followSubmittedMessageToBottom\(threadId, clientSubmissionId = ""\)/);
  assert.match(appJs, /conversationScroll\.createSubmittedMessageFollow\(threadId/);
  assert.match(appJs, /function sustainSubmittedMessageBottomFollow\(turn, itemType, field\)/);
  assert.match(appJs, /conversationScroll\.extendSubmittedMessageFollow\(follow, \{/);
  assert.match(appJs, /function sustainSubmittedMessageBottomFollowFromThread\(thread\)/);
  assert.match(appJs, /latestLiveTurnForThread\(thread\)/);
  assert.match(appJs, /visibleItemsForTurn\(liveTurn\)[\s\S]*item\.type !== "userMessage"/);
  assert.match(appJs, /const sustainedSubmittedFollow = !explicitNoStickToBottom[\s\S]*sustainSubmittedMessageBottomFollowFromThread\(thread\)/);
  assert.match(appJs, /sustainedSubmittedFollow,/);
  assert.match(appJs, /submittedMessageFollow: shouldFollowSubmittedMessageToBottom\(\),/);
  assert.match(appJs, /viewportFollow: shouldFollowViewportChangeToBottom\(\),/);
  assert.match(appJs, /function scheduleSubmittedMessageBottomFollowScroll\(\)/);
  assert.match(appJs, /scheduleBottomFollowScroll\(shouldFollowSubmittedMessageToBottom\);/);
  assert.match(appJs, /if \(shouldFollow\(\)\) scheduleConversationToBottom\(\);/);
  assert.match(appJs, /followSubmittedMessageToBottom\(targetThreadId, clientSubmissionId\);[\s\S]*await api\(`\/api\/threads\/\$\{encodeURIComponent\(targetThreadId\)\}\/messages`/);
  assert.match(appJs, /sustainSubmittedMessageBottomFollow\(turn, itemType, field\);/);
  assert.match(appJs, /clearSubmittedMessageBottomFollow\(\);[\s\S]*const message = normalizeClientErrorMessage/);
  assert.match(appJs, /conversationScroll\.isNearBottom\(\{/);
  assert.doesNotMatch(functionBody("renderCurrentThread"), /const shouldFollowBottom = !userReadingCurrentTurn/);
  assert.match(appJs, /bottomScrollFrame: null/);
  assert.match(appJs, /bottomFollowTimers: \[\]/);
  assert.match(appJs, /function scheduleConversationToBottom\(\)/);
  assert.match(functionBody("scheduleConversationToBottom"), /if \(state\.bottomScrollFrame\) return/);
  assert.match(functionBody("scheduleConversationToBottom"), /scrollConversationToBottom\(\)/);
  assert.match(functionBody("scheduleBottomFollowScroll"), /clearBottomFollowTimers\(\);/);
  assert.match(functionBody("scheduleBottomFollowScroll"), /state\.bottomFollowTimers\.push\(timer\);/);
});

test("live and final message renders stay anchored when the user is at bottom", () => {
  const renderBody = functionBody("renderCurrentThread");
  assertInOrder(renderBody, [
    /const nearBottom = isConversationNearBottom\(\);/,
    /const userReadingCurrentTurn = isUserReadingCurrentTurn\(\{ nearBottom \}\);/,
    /const sustainedSubmittedFollow = !explicitNoStickToBottom[\s\S]*sustainSubmittedMessageBottomFollowFromThread\(thread\);/,
    /const fullRenderScrollPlan = conversationScroll\.planFullRenderScroll\(\{/,
    /autoScrollHold: shouldHoldAutoScrollForCurrentTurn\(\),/,
    /viewportFollow: shouldFollowViewportChangeToBottom\(\),/,
    /const shouldStickToBottom = Boolean\(fullRenderScrollPlan\.stickToBottom\);/,
    /const shellUpdatePlan = threadDetailRenderPlanApi\.planSingleThreadShellConversationUpdate\(\{[\s\S]*?patchShellSignature: conversationPatchShellSignature\(thread\),[\s\S]*?stickToBottom: shouldStickToBottom,[\s\S]*?\}\);/,
    /updateConversationHtml\(shellUpdatePlan\.html, shellUpdatePlan\.conversationSignature, shellUpdatePlan\.options\);/,
    /const postUpdateEffectsPlan = threadDetailRenderPlanApi\.planSingleThreadShellPostUpdateEffects\(\{[\s\S]*?scrollToTurnReceiptStart: options\.scrollToTurnReceiptStart,[\s\S]*?\}\);/,
    /applySingleThreadShellPostUpdateEffectsPlan\(postUpdateEffectsPlan,/,
  ]);

  const updateBody = functionBody("updateConversationHtml");
  assert.match(updateBody, /threadDetailDomPatchApi\.planConversationHtmlUpdate\(\{/);
  assert.match(updateBody, /renderedConversationSignature: state\.renderedConversationSignature,/);
  assert.match(updateBody, /renderedConversationPatchShellSignature: state\.renderedConversationPatchShellSignature,/);
  assert.match(updateBody, /const effectsPlan = threadDetailDomPatchApi\.planConversationHtmlUpdateEffects\(updatePlan\);/);
  assert.match(updateBody, /if \(updatePlan\.action === "hydrate-existing"\) \{/);
  assert.match(updateBody, /applyConversationHtmlUpdateEffectsPlan\(effectsPlan, \{ root: conversation \}\);/);
  assert.doesNotMatch(updateBody, /updatePlan\.scrollAction === "scroll-to-bottom"/);
  assert.doesNotMatch(updateBody, /state\.renderedConversationSignature = updatePlan\.nextRenderedConversationSignature;/);
  assert.doesNotMatch(updateBody, /state\.renderedConversationPatchShellSignature = updatePlan\.nextRenderedConversationPatchShellSignature;/);

  const appendBody = functionBody("appendToItem");
  assertInOrder(appendBody, [
    /sustainSubmittedMessageBottomFollow\(turn, itemType, field\);/,
    /if \(shouldRenderAfterAppend\(turn, itemType, field, previousValue, nextValue, options\)\) \{/,
    /if \(!patchLiveTextItemDom\(turn, item\)\) scheduleRenderCurrentThread\(\);/,
  ]);
  assert.match(appJs, /function patchLiveTextItemDom\(turn, item\)/);
  assert.match(functionBody("patchLiveTextItemDom"), /threadDetailDomPatchApi\.applyLiveTextItemDomPatch\(\{/);
  assert.match(functionBody("patchLiveTextItemDom"), /renderHtml: \(\) => renderItem\(item, turn, previousKeys, index\)/);
  assert.match(functionBody("patchLiveTextItemDom"), /patchElement: \(target, source\) => \{[\s\S]*patchNode\(target, source\);[\s\S]*return target;/);
  assert.match(functionBody("patchLiveTextItemDom"), /completeLocalConversationDomUpdate\(patchResult\.target, wasNearBottom, userReadingCurrentTurn\)/);
  assert.match(functionBody("completeLocalConversationDomUpdate"), /threadDetailDomPatchApi\.planLocalConversationDomUpdateCompletion\(\{/);
  assert.match(functionBody("completeLocalConversationDomUpdate"), /threadDetailDomPatchApi\.planLocalConversationDomUpdateCompletionEffects\(completionPlan\)/);
  assert.match(functionBody("completeLocalConversationDomUpdate"), /applyLocalConversationDomUpdateCompletionEffectsPlan\(effectsPlan, \{ root \}\)/);
  assert.match(functionBody("applyThreadDetailDomUpdateEffect"), /state\.renderedConversationSignature = String\(item\.value \|\| ""\);/);
  assert.match(functionBody("completeLocalConversationDomUpdate"), /conversationScroll\.planLocalPatchScrollCompletion\(\{/);
  assert.match(functionBody("completeLocalConversationDomUpdate"), /autoScrollHold: shouldHoldAutoScrollForCurrentTurn\(\),/);
  assert.match(functionBody("completeLocalConversationDomUpdate"), /submittedMessageFollow: shouldFollowSubmittedMessageToBottom\(\),/);
  assert.match(functionBody("completeLocalConversationDomUpdate"), /viewportFollow: shouldFollowViewportChangeToBottom\(\),/);
  assert.doesNotMatch(functionBody("completeLocalConversationDomUpdate"), /completionPlan\.scrollAction === "scroll-to-bottom"/);
  assert.match(functionBody("applyThreadDetailDomUpdateEffect"), /if \(type === "schedule-conversation-to-bottom"\) \{/);
  assert.doesNotMatch(functionBody("completeLocalConversationDomUpdate"), /!userReadingCurrentTurn && !shouldHoldAutoScrollForCurrentTurn\(\) && \(wasNearBottom/);

  const sustainBody = functionBody("sustainSubmittedMessageBottomFollow");
  assert.match(sustainBody, /if \(itemType !== "agentMessage" \|\| field !== "text"\) return;/);
  assert.match(sustainBody, /if \(!turn \|\| !isLatestTurn\(turn\) \|\| !isLiveTurn\(turn\)\) return;/);
  assert.match(sustainBody, /state\.submittedMessageBottomFollow = conversationScroll\.extendSubmittedMessageFollow\(follow, \{/);
  assert.match(sustainBody, /scheduleSubmittedMessageBottomFollowScroll\(\);/);

  const notificationBody = functionBody("applyNotification");
  assert.match(notificationBody, /method === "item\/agentMessage\/delta"[\s\S]*appendToItem\(params\.turnId, params\.itemId, "agentMessage", "text", params\.delta \|\| "", 0\)/);
  assert.doesNotMatch(notificationBody, /defer-final-receipt/);
  assert.match(notificationBody, /method === "turn\/completed"[\s\S]*renderCurrentThread\(\{ stickToBottom: true \}\);/);
});

test("thread opens and same-signature renders still land on the latest message", () => {
  assert.match(appJs, /function followThreadOpenToBottom\(threadId, ttlMs = 8000\)/);
  assert.match(appJs, /conversationScroll\.createViewportFollow\(id, \{/);
  assert.match(appJs, /reason: "thread-open"/);
  assert.match(functionBody("updateConversationHtml"), /threadDetailDomPatchApi\.planConversationHtmlUpdate\(\{[\s\S]*stickToBottom: options\.stickToBottom,/);
  assert.match(functionBody("updateConversationHtml"), /const effectsPlan = threadDetailDomPatchApi\.planConversationHtmlUpdateEffects\(updatePlan\);[\s\S]*if \(updatePlan\.action === "hydrate-existing"\) \{[\s\S]*applyConversationHtmlUpdateEffectsPlan\(effectsPlan, \{ root: conversation \}\);/);
  assert.match(appJs, /followThreadOpenToBottom\(threadId\);[\s\S]*renderThreads\(\);[\s\S]*renderCurrentThread\(\{ stickToBottom: true \}\);/);
});
