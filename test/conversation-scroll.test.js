"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const conversationScroll = require("../public/conversation-scroll");

test("conversation scroll metrics detect near-bottom state", () => {
  assert.equal(conversationScroll.isNearBottom({
    scrollHeight: 1800,
    scrollTop: 725,
    clientHeight: 980,
  }), true);
  assert.equal(conversationScroll.isNearBottom({
    scrollHeight: 1800,
    scrollTop: 640,
    clientHeight: 980,
  }), false);
});

test("submitted-message follow stays scoped to one thread and expires", () => {
  const follow = conversationScroll.createSubmittedMessageFollow("thread-a", {
    clientSubmissionId: "submit-1",
    nowMs: 1000,
    ttlMs: 5000,
  });

  assert.deepEqual(follow, {
    threadId: "thread-a",
    clientSubmissionId: "submit-1",
    untilMs: 6000,
  });
  assert.equal(conversationScroll.shouldFollowSubmittedMessage(follow, {
    threadId: "thread-a",
    nowMs: 5999,
  }), true);
  assert.equal(conversationScroll.shouldFollowSubmittedMessage(follow, {
    threadId: "thread-b",
    nowMs: 2000,
  }), false);
  assert.equal(conversationScroll.shouldFollowSubmittedMessage(follow, {
    threadId: "thread-a",
    nowMs: 6001,
  }), false);
});

test("submitted-message follow ignores empty thread ids", () => {
  assert.equal(conversationScroll.createSubmittedMessageFollow(""), null);
  assert.equal(conversationScroll.shouldFollowSubmittedMessage(null, { threadId: "thread-a" }), false);
});

test("submitted-message follow extends while a live reply continues streaming", () => {
  const follow = conversationScroll.createSubmittedMessageFollow("thread-a", {
    clientSubmissionId: "submit-1",
    nowMs: 1000,
    ttlMs: 5000,
  });
  const extended = conversationScroll.extendSubmittedMessageFollow(follow, {
    nowMs: 4500,
    ttlMs: 5000,
  });

  assert.deepEqual(extended, {
    threadId: "thread-a",
    clientSubmissionId: "submit-1",
    untilMs: 9500,
  });
  assert.equal(conversationScroll.shouldFollowSubmittedMessage(extended, {
    threadId: "thread-a",
    nowMs: 9000,
  }), true);
});

test("viewport follow starts only from current or recently bottomed conversations", () => {
  assert.equal(conversationScroll.shouldStartViewportFollow({
    nearBottom: true,
    nowMs: 10000,
    lastNearBottomAtMs: 0,
  }), true);
  assert.equal(conversationScroll.shouldStartViewportFollow({
    nearBottom: false,
    nowMs: 10000,
    lastNearBottomAtMs: 7000,
    recentBottomMs: 5000,
  }), true);
  assert.equal(conversationScroll.shouldStartViewportFollow({
    nearBottom: false,
    nowMs: 10000,
    lastNearBottomAtMs: 4000,
    recentBottomMs: 5000,
  }), false);
});

test("viewport follow stays scoped to one thread and expires", () => {
  const follow = conversationScroll.createViewportFollow("thread-a", {
    reason: "orientation",
    nowMs: 1000,
    ttlMs: 3000,
  });

  assert.deepEqual(follow, {
    threadId: "thread-a",
    reason: "orientation",
    untilMs: 4000,
  });
  assert.equal(conversationScroll.shouldFollowViewport(follow, {
    threadId: "thread-a",
    nowMs: 3999,
  }), true);
  assert.equal(conversationScroll.shouldFollowViewport(follow, {
    threadId: "thread-b",
    nowMs: 2000,
  }), false);
  assert.equal(conversationScroll.shouldFollowViewport(follow, {
    threadId: "thread-a",
    nowMs: 4001,
  }), false);
});

test("bottom-follow lease planning owns user-reading and inactive cleanup", () => {
  assert.deepEqual(conversationScroll.planBottomFollowLeaseEvaluation({
    userReadingCurrentTurn: true,
    leaseActive: true,
    hasLease: true,
  }), {
    shouldFollow: false,
    clearLease: true,
    reason: "user-reading-current-turn",
  });

  assert.deepEqual(conversationScroll.planBottomFollowLeaseEvaluation({
    leaseActive: true,
    hasLease: true,
  }), {
    shouldFollow: true,
    clearLease: false,
    reason: "lease-active",
  });

  assert.deepEqual(conversationScroll.planBottomFollowLeaseEvaluation({
    leaseActive: false,
    hasLease: true,
  }), {
    shouldFollow: false,
    clearLease: true,
    reason: "lease-inactive",
  });

  assert.deepEqual(conversationScroll.planBottomFollowLeaseEvaluation({
    leaseActive: false,
    hasLease: false,
  }), {
    shouldFollow: false,
    clearLease: false,
    reason: "no-lease",
  });
});

test("bottom-follow scroll schedule owns retry delays", () => {
  const firstPlan = conversationScroll.planBottomFollowScrollSchedule();
  assert.deepEqual(firstPlan, {
    clearExistingTimers: true,
    delaysMs: [0, 80, 240, 600, 1200],
    reason: "bottom-follow-retry",
  });

  firstPlan.delaysMs.push(9999);
  assert.deepEqual(conversationScroll.planBottomFollowScrollSchedule(), {
    clearExistingTimers: true,
    delaysMs: [0, 80, 240, 600, 1200],
    reason: "bottom-follow-retry",
  });
});

test("local patch scroll completion follows bottom only when policy allows", () => {
  assert.deepEqual(conversationScroll.planLocalPatchScrollCompletion({
    nearBottom: true,
  }), {
    action: "scroll-to-bottom",
    reason: "near-bottom",
  });

  assert.deepEqual(conversationScroll.planLocalPatchScrollCompletion({
    submittedMessageFollow: true,
  }), {
    action: "scroll-to-bottom",
    reason: "submitted-message-follow",
  });

  assert.deepEqual(conversationScroll.planLocalPatchScrollCompletion({
    viewportFollow: true,
  }), {
    action: "scroll-to-bottom",
    reason: "viewport-follow",
  });

  assert.deepEqual(conversationScroll.planLocalPatchScrollCompletion({
    userReadingCurrentTurn: true,
    nearBottom: true,
  }), {
    action: "update-button",
    reason: "user-reading-current-turn",
  });

  assert.deepEqual(conversationScroll.planLocalPatchScrollCompletion({
    autoScrollHold: true,
    submittedMessageFollow: true,
  }), {
    action: "update-button",
    reason: "auto-scroll-hold",
  });

  assert.deepEqual(conversationScroll.planLocalPatchScrollCompletion({}), {
    action: "update-button",
    reason: "not-following-bottom",
  });
});

test("conversation jump button planning keeps bottom and reply jumps mutually exclusive", () => {
  assert.deepEqual(conversationScroll.planConversationJumpButtons({
    hasThread: true,
    isScrollable: true,
    nearBottom: false,
    hasReplyTarget: true,
    replyTargetAbove: true,
  }), {
    showBottom: true,
    showReply: false,
    reason: "bottom-available",
  });

  assert.deepEqual(conversationScroll.planConversationJumpButtons({
    hasThread: true,
    isScrollable: true,
    nearBottom: true,
    hasReplyTarget: true,
    replyTargetAbove: true,
  }), {
    showBottom: false,
    showReply: true,
    reason: "reply-available",
  });

  assert.deepEqual(conversationScroll.planConversationJumpButtons({
    hasThread: true,
    isScrollable: true,
    nearBottom: true,
    hasReplyTarget: false,
    replyTargetAbove: true,
  }), {
    showBottom: false,
    showReply: false,
    reason: "hidden",
  });

  assert.deepEqual(conversationScroll.planConversationJumpButtons({
    hasThread: true,
    loading: true,
    isScrollable: true,
    nearBottom: false,
  }), {
    showBottom: false,
    showReply: false,
    reason: "not-available",
  });
});

test("user-reading-current-turn planning keeps manual reading hold explicit", () => {
  assert.deepEqual(conversationScroll.planUserReadingCurrentTurn({
    nearBottom: true,
    autoScrollHold: true,
    recentScrollIntent: true,
    hasCurrentTurn: true,
  }), {
    userReadingCurrentTurn: false,
    reason: "near-bottom",
  });

  assert.deepEqual(conversationScroll.planUserReadingCurrentTurn({
    nearBottom: false,
    autoScrollHold: true,
  }), {
    userReadingCurrentTurn: true,
    reason: "auto-scroll-hold",
  });

  assert.deepEqual(conversationScroll.planUserReadingCurrentTurn({
    nearBottom: false,
    recentScrollIntent: false,
    hasCurrentTurn: true,
  }), {
    userReadingCurrentTurn: false,
    reason: "no-recent-scroll-intent",
  });

  assert.deepEqual(conversationScroll.planUserReadingCurrentTurn({
    nearBottom: false,
    recentScrollIntent: true,
    hasCurrentTurn: true,
  }), {
    userReadingCurrentTurn: true,
    reason: "current-turn-candidate",
  });

  assert.deepEqual(conversationScroll.planUserReadingCurrentTurn({
    nearBottom: false,
    recentScrollIntent: true,
    hasCurrentTurn: false,
  }), {
    userReadingCurrentTurn: false,
    reason: "no-current-turn",
  });
});

test("auto-scroll hold planning reacts only to explicit scroll facts", () => {
  assert.deepEqual(conversationScroll.planConversationAutoScrollHoldFromScroll({
    nearBottom: true,
    recentScrollIntent: true,
    hasCurrentTurn: true,
  }), {
    action: "clear-hold",
    reason: "near-bottom",
  });

  assert.deepEqual(conversationScroll.planConversationAutoScrollHoldFromScroll({
    nearBottom: false,
    recentScrollIntent: false,
    hasCurrentTurn: true,
  }), {
    action: "none",
    reason: "no-recent-scroll-intent",
  });

  assert.deepEqual(conversationScroll.planConversationAutoScrollHoldFromScroll({
    nearBottom: false,
    recentScrollIntent: true,
    hasCurrentTurn: true,
  }), {
    action: "remember-hold",
    reason: "current-turn-candidate",
  });

  assert.deepEqual(conversationScroll.planConversationAutoScrollHoldFromScroll({
    nearBottom: false,
    recentScrollIntent: true,
    hasCurrentTurn: false,
  }), {
    action: "none",
    reason: "no-current-turn",
  });
});

test("full render scroll planning protects user scroll before bottom follow", () => {
  assert.deepEqual(conversationScroll.planFullRenderScroll({
    stickToBottom: false,
    nearBottom: true,
    submittedMessageFollow: true,
  }), {
    stickToBottom: false,
    explicitNoStickToBottom: true,
    shouldFollowBottom: false,
    reason: "explicit-no-stick",
  });

  assert.deepEqual(conversationScroll.planFullRenderScroll({
    sustainedSubmittedFollow: true,
    userReadingCurrentTurn: true,
  }), {
    stickToBottom: false,
    explicitNoStickToBottom: false,
    shouldFollowBottom: false,
    reason: "user-reading-current-turn",
  });

  assert.deepEqual(conversationScroll.planFullRenderScroll({
    submittedMessageFollow: true,
    autoScrollHold: true,
  }), {
    stickToBottom: false,
    explicitNoStickToBottom: false,
    shouldFollowBottom: false,
    reason: "auto-scroll-hold",
  });

  assert.deepEqual(conversationScroll.planFullRenderScroll({
    submittedMessageFollow: true,
    userReadingCurrentTurn: true,
  }), {
    stickToBottom: false,
    explicitNoStickToBottom: false,
    shouldFollowBottom: false,
    reason: "user-reading-current-turn",
  });

  assert.deepEqual(conversationScroll.planFullRenderScroll({
    viewportFollow: true,
  }), {
    stickToBottom: true,
    explicitNoStickToBottom: false,
    shouldFollowBottom: true,
    reason: "viewport-follow",
  });

  assert.deepEqual(conversationScroll.planFullRenderScroll({
    stickToBottom: true,
    autoScrollHold: true,
  }), {
    stickToBottom: false,
    explicitNoStickToBottom: false,
    shouldFollowBottom: false,
    reason: "auto-scroll-hold",
  });

  assert.deepEqual(conversationScroll.planFullRenderScroll({
    stickToBottom: true,
  }), {
    stickToBottom: true,
    explicitNoStickToBottom: false,
    shouldFollowBottom: false,
    reason: "requested-stick",
  });

  assert.deepEqual(conversationScroll.planFullRenderScroll({
    nearBottom: true,
  }), {
    stickToBottom: true,
    explicitNoStickToBottom: false,
    shouldFollowBottom: false,
    reason: "near-bottom",
  });

  assert.deepEqual(conversationScroll.planFullRenderScroll({}), {
    stickToBottom: false,
    explicitNoStickToBottom: false,
    shouldFollowBottom: false,
    reason: "not-following-bottom",
  });
});
