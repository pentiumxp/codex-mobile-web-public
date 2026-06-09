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
