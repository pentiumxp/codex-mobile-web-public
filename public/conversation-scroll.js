"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexConversationScroll = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  const DEFAULT_NEAR_BOTTOM_PX = 96;
  const DEFAULT_SUBMIT_FOLLOW_MS = 15000;
  const DEFAULT_VIEWPORT_FOLLOW_MS = 3200;
  const DEFAULT_RECENT_BOTTOM_MS = 120000;

  function numberOrZero(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function isNearBottom(metrics = {}, thresholdPx = DEFAULT_NEAR_BOTTOM_PX) {
    const scrollHeight = numberOrZero(metrics.scrollHeight);
    const scrollTop = numberOrZero(metrics.scrollTop);
    const clientHeight = numberOrZero(metrics.clientHeight);
    const threshold = Math.max(0, numberOrZero(thresholdPx));
    return scrollHeight - scrollTop - clientHeight < threshold;
  }

  function createSubmittedMessageFollow(threadId, options = {}) {
    const id = String(threadId || "").trim();
    if (!id) return null;
    const nowMs = numberOrZero(options.nowMs) || Date.now();
    const ttlMs = Math.max(1000, numberOrZero(options.ttlMs) || DEFAULT_SUBMIT_FOLLOW_MS);
    return {
      threadId: id,
      clientSubmissionId: String(options.clientSubmissionId || ""),
      untilMs: nowMs + ttlMs,
    };
  }

  function shouldFollowSubmittedMessage(follow, options = {}) {
    if (!follow || !follow.threadId) return false;
    const threadId = String(options.threadId || "").trim();
    if (!threadId || String(follow.threadId) !== threadId) return false;
    const nowMs = numberOrZero(options.nowMs) || Date.now();
    return nowMs <= numberOrZero(follow.untilMs);
  }

  function extendSubmittedMessageFollow(follow, options = {}) {
    if (!follow || !follow.threadId) return null;
    const nowMs = numberOrZero(options.nowMs) || Date.now();
    const ttlMs = Math.max(1000, numberOrZero(options.ttlMs) || DEFAULT_SUBMIT_FOLLOW_MS);
    return {
      ...follow,
      untilMs: nowMs + ttlMs,
    };
  }

  function shouldStartViewportFollow(options = {}) {
    if (options.nearBottom) return true;
    const nowMs = numberOrZero(options.nowMs) || Date.now();
    const recentBottomMs = Math.max(0, numberOrZero(options.recentBottomMs) || DEFAULT_RECENT_BOTTOM_MS);
    const lastNearBottomAtMs = numberOrZero(options.lastNearBottomAtMs);
    return Boolean(lastNearBottomAtMs && nowMs - lastNearBottomAtMs <= recentBottomMs);
  }

  function createViewportFollow(threadId, options = {}) {
    const id = String(threadId || "").trim();
    if (!id) return null;
    const nowMs = numberOrZero(options.nowMs) || Date.now();
    const ttlMs = Math.max(500, numberOrZero(options.ttlMs) || DEFAULT_VIEWPORT_FOLLOW_MS);
    return {
      threadId: id,
      reason: String(options.reason || "viewport"),
      untilMs: nowMs + ttlMs,
    };
  }

  function shouldFollowViewport(follow, options = {}) {
    if (!follow || !follow.threadId) return false;
    const threadId = String(options.threadId || "").trim();
    if (!threadId || String(follow.threadId) !== threadId) return false;
    const nowMs = numberOrZero(options.nowMs) || Date.now();
    return nowMs <= numberOrZero(follow.untilMs);
  }

  function planLocalPatchScrollCompletion(options = {}) {
    if (options.userReadingCurrentTurn) {
      return {
        action: "update-button",
        reason: "user-reading-current-turn",
      };
    }
    if (options.autoScrollHold) {
      return {
        action: "update-button",
        reason: "auto-scroll-hold",
      };
    }
    if (options.nearBottom) {
      return {
        action: "scroll-to-bottom",
        reason: "near-bottom",
      };
    }
    if (options.submittedMessageFollow) {
      return {
        action: "scroll-to-bottom",
        reason: "submitted-message-follow",
      };
    }
    if (options.viewportFollow) {
      return {
        action: "scroll-to-bottom",
        reason: "viewport-follow",
      };
    }
    return {
      action: "update-button",
      reason: "not-following-bottom",
    };
  }

  function planConversationJumpButtons(options = {}) {
    const canShow = Boolean(
      options.hasThread
        && !options.loading
        && !options.loadError
        && options.isScrollable,
    );
    const showBottom = Boolean(canShow && !options.nearBottom);
    const showReply = Boolean(
      canShow
        && !showBottom
        && options.hasReplyTarget
        && options.replyTargetAbove,
    );
    return {
      showBottom,
      showReply,
      reason: !canShow
        ? "not-available"
        : showBottom
          ? "bottom-available"
          : showReply
            ? "reply-available"
            : "hidden",
    };
  }

  function planFullRenderScroll(options = {}) {
    const explicitNoStickToBottom = options.stickToBottom === false || Boolean(options.scrollToTurnReceiptStart);
    const shouldFollowBottom = !explicitNoStickToBottom
      && Boolean(options.sustainedSubmittedFollow || options.submittedMessageFollow || options.viewportFollow);
    if (explicitNoStickToBottom) {
      return {
        stickToBottom: false,
        explicitNoStickToBottom: true,
        shouldFollowBottom: false,
        reason: "explicit-no-stick",
      };
    }
    if (shouldFollowBottom) {
      return {
        stickToBottom: true,
        explicitNoStickToBottom: false,
        shouldFollowBottom: true,
        reason: options.sustainedSubmittedFollow
          ? "sustained-submitted-message-follow"
          : options.submittedMessageFollow
            ? "submitted-message-follow"
            : "viewport-follow",
      };
    }
    if (options.userReadingCurrentTurn) {
      return {
        stickToBottom: false,
        explicitNoStickToBottom: false,
        shouldFollowBottom: false,
        reason: "user-reading-current-turn",
      };
    }
    if (options.autoScrollHold) {
      return {
        stickToBottom: false,
        explicitNoStickToBottom: false,
        shouldFollowBottom: false,
        reason: "auto-scroll-hold",
      };
    }
    if (options.stickToBottom === true) {
      return {
        stickToBottom: true,
        explicitNoStickToBottom: false,
        shouldFollowBottom: false,
        reason: "requested-stick",
      };
    }
    if (options.nearBottom) {
      return {
        stickToBottom: true,
        explicitNoStickToBottom: false,
        shouldFollowBottom: false,
        reason: "near-bottom",
      };
    }
    return {
      stickToBottom: false,
      explicitNoStickToBottom: false,
      shouldFollowBottom: false,
      reason: "not-following-bottom",
    };
  }

  return {
    DEFAULT_NEAR_BOTTOM_PX,
    DEFAULT_SUBMIT_FOLLOW_MS,
    DEFAULT_VIEWPORT_FOLLOW_MS,
    DEFAULT_RECENT_BOTTOM_MS,
    createSubmittedMessageFollow,
    extendSubmittedMessageFollow,
    createViewportFollow,
    isNearBottom,
    planConversationJumpButtons,
    planFullRenderScroll,
    planLocalPatchScrollCompletion,
    shouldFollowViewport,
    shouldFollowSubmittedMessage,
    shouldStartViewportFollow,
  };
}));
