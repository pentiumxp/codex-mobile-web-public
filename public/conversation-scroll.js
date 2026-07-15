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
  const DEFAULT_SUBMIT_FOLLOW_MS = 1800;
  const DEFAULT_VIEWPORT_FOLLOW_MS = 3200;
  const DEFAULT_RECENT_BOTTOM_MS = 120000;
  const DEFAULT_BOTTOM_FOLLOW_DELAYS_MS = Object.freeze([0, 80, 240, 600, 1200]);

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

  function planBottomFollowLeaseEvaluation(options = {}) {
    if (options.userReadingCurrentTurn) {
      return {
        shouldFollow: false,
        clearLease: true,
        reason: "user-reading-current-turn",
      };
    }
    if (options.leaseActive) {
      return {
        shouldFollow: true,
        clearLease: false,
        reason: "lease-active",
      };
    }
    if (options.hasLease) {
      return {
        shouldFollow: false,
        clearLease: true,
        reason: "lease-inactive",
      };
    }
    return {
      shouldFollow: false,
      clearLease: false,
      reason: "no-lease",
    };
  }

  function planBottomFollowScrollSchedule() {
    return {
      clearExistingTimers: true,
      delaysMs: DEFAULT_BOTTOM_FOLLOW_DELAYS_MS.slice(),
      reason: "bottom-follow-retry",
    };
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

  function planUserReadingCurrentTurn(options = {}) {
    if (options.nearBottom) {
      return {
        userReadingCurrentTurn: false,
        reason: "near-bottom",
      };
    }
    if (options.autoScrollHold) {
      return {
        userReadingCurrentTurn: true,
        reason: "auto-scroll-hold",
      };
    }
    if (!options.recentScrollIntent) {
      return {
        userReadingCurrentTurn: false,
        reason: "no-recent-scroll-intent",
      };
    }
    if (options.hasCurrentTurn) {
      return {
        userReadingCurrentTurn: true,
        reason: "current-turn-candidate",
      };
    }
    return {
      userReadingCurrentTurn: false,
      reason: "no-current-turn",
    };
  }

  function planConversationAutoScrollHoldFromScroll(options = {}) {
    if (options.nearBottom) {
      return {
        action: "clear-hold",
        reason: "near-bottom",
      };
    }
    if (!options.recentScrollIntent) {
      return {
        action: "none",
        reason: "no-recent-scroll-intent",
      };
    }
    if (options.hasCurrentTurn) {
      return {
        action: "remember-hold",
        reason: "current-turn-candidate",
      };
    }
    return {
      action: "none",
      reason: "no-current-turn",
    };
  }

  function planReadingViewportPreservation(options = {}) {
    if (options.nearBottom) {
      return {
        preserve: false,
        reason: "near-bottom",
      };
    }
    if (options.userReadingCurrentTurn) {
      return {
        preserve: true,
        reason: "user-reading-current-turn",
      };
    }
    if (options.autoScrollHold) {
      return {
        preserve: true,
        reason: "auto-scroll-hold",
      };
    }
    if (options.userReadingAwayFromBottom) {
      return {
        preserve: true,
        reason: "user-reading-away-from-bottom",
      };
    }
    if (options.recentScrollIntent) {
      return {
        preserve: true,
        reason: "recent-scroll-intent",
      };
    }
    return {
      preserve: false,
      reason: "no-user-scroll-protection",
    };
  }

  function planAutomaticConversationRefresh(options = {}) {
    if (options.userInitiated) {
      return {
        allowRefresh: true,
        cancelScheduled: false,
        reason: "user-initiated",
      };
    }
    if (!options.hasThread) {
      return {
        allowRefresh: true,
        cancelScheduled: false,
        reason: "no-current-thread",
      };
    }
    if (options.nearBottom) {
      return {
        allowRefresh: true,
        cancelScheduled: false,
        reason: "near-bottom",
      };
    }
    if (options.userReadingCurrentTurn) {
      return {
        allowRefresh: false,
        cancelScheduled: true,
        reason: "user-reading-current-turn",
      };
    }
    if (options.autoScrollHold) {
      return {
        allowRefresh: false,
        cancelScheduled: true,
        reason: "auto-scroll-hold",
      };
    }
    if (options.userReadingAwayFromBottom) {
      return {
        allowRefresh: false,
        cancelScheduled: true,
        reason: "user-reading-away-from-bottom",
      };
    }
    if (options.recentScrollIntent) {
      return {
        allowRefresh: false,
        cancelScheduled: true,
        reason: "recent-scroll-intent",
      };
    }
    return {
      allowRefresh: true,
      cancelScheduled: false,
      reason: "no-user-scroll-protection",
    };
  }

  function planFullRenderScroll(options = {}) {
    const explicitNoStickToBottom = options.stickToBottom === false || Boolean(options.scrollToTurnReceiptStart);
    if (explicitNoStickToBottom) {
      return {
        stickToBottom: false,
        explicitNoStickToBottom: true,
        shouldFollowBottom: false,
        reason: "explicit-no-stick",
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
    const shouldFollowBottom = Boolean(options.submittedMessageFollow || options.viewportFollow);
    if (shouldFollowBottom) {
      return {
        stickToBottom: true,
        explicitNoStickToBottom: false,
        shouldFollowBottom: true,
        reason: options.submittedMessageFollow ? "submitted-message-follow" : "viewport-follow",
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
    DEFAULT_BOTTOM_FOLLOW_DELAYS_MS,
    createSubmittedMessageFollow,
    createViewportFollow,
    isNearBottom,
    planBottomFollowLeaseEvaluation,
    planBottomFollowScrollSchedule,
    planConversationAutoScrollHoldFromScroll,
    planAutomaticConversationRefresh,
    planConversationJumpButtons,
    planFullRenderScroll,
    planLocalPatchScrollCompletion,
    planReadingViewportPreservation,
    planUserReadingCurrentTurn,
    shouldFollowViewport,
    shouldFollowSubmittedMessage,
    shouldStartViewportFollow,
  };
}));
