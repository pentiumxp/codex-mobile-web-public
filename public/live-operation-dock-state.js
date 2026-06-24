"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexLiveOperationDockState = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  const DEFAULT_MIN_VISIBLE_MS = 500;

  function normalizeMode(mode) {
    return String(mode || "") === "expanded" ? "expanded" : "compact";
  }

  function text(value) {
    return String(value || "");
  }

  function nowValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  function containsBubble(html) {
    return text(html).includes("mobile-operation-bubble");
  }

  function containsSheet(html) {
    return text(html).includes("mobile-operation-sheet");
  }

  function rememberCompactBubble(input = {}) {
    const nowMs = nowValue(input.nowMs);
    const minVisibleMs = Math.max(0, Number(input.minVisibleMs || DEFAULT_MIN_VISIBLE_MS));
    const existingUntilMs = Number(input.existingVisibleUntilMs || 0);
    const html = text(input.html);
    const threadId = text(input.threadId);
    return {
      visibleUntilMs: Math.max(existingUntilMs, nowMs + minVisibleMs),
      html,
      threadId,
      recallHtml: html,
      recallThreadId: threadId,
      recallAtMs: nowMs,
    };
  }

  function compactBubblePreservation(input = {}) {
    if (containsBubble(input.nextHtml)) return { preserve: false };
    const remainingMs = Number(input.visibleUntilMs || 0) - nowValue(input.nowMs);
    if (remainingMs <= 0) return { preserve: false };
    const savedThreadId = text(input.savedThreadId);
    if (!savedThreadId || savedThreadId !== text(input.currentThreadId)) return { preserve: false };
    const savedHtml = text(input.savedHtml);
    const dockHasBubble = Boolean(input.dockHasBubble);
    if (!dockHasBubble && !containsBubble(savedHtml)) return { preserve: false };
    return {
      preserve: true,
      remainingMs,
      patchSavedHtml: Boolean(savedHtml && !dockHasBubble),
      savedHtml,
    };
  }

  function shouldPreservePinned(input = {}) {
    return Boolean(input.pinned
      && normalizeMode(input.mode) === "expanded"
      && text(input.pinnedThreadId) === text(input.currentThreadId)
      && input.dockHasSheet
      && !containsBubble(input.nextHtml));
  }

  function shouldShowRecall(input = {}) {
    const recallThreadId = text(input.recallThreadId);
    return Boolean(input.isMobile
      && input.hasCurrentThread
      && !input.newThreadDraft
      && recallThreadId
      && recallThreadId === text(input.currentThreadId)
      && containsSheet(input.recallHtml));
  }

  return {
    DEFAULT_MIN_VISIBLE_MS,
    compactBubblePreservation,
    containsBubble,
    containsSheet,
    normalizeMode,
    rememberCompactBubble,
    shouldPreservePinned,
    shouldShowRecall,
  };
}));
