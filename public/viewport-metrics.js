"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexViewportMetrics = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  const DEFAULT_KEYBOARD_SHRINK_PX = 120;
  const DEFAULT_MIN_HEIGHT = 320;
  const NON_TEXT_INPUT_TYPES = new Set([
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
  ]);

  function positiveNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  }

  function isKeyboardEditable(element) {
    if (!element) return false;
    if (element.isContentEditable) return true;
    const tag = String(element.tagName || "").toLowerCase();
    if (tag === "textarea") return !element.disabled && !element.readOnly;
    if (tag !== "input") return false;
    const type = String(element.type || "text").toLowerCase();
    return !element.disabled && !element.readOnly && !NON_TEXT_INPUT_TYPES.has(type);
  }

  function measureViewport(input = {}) {
    const threshold = positiveNumber(input.keyboardShrinkPx) || DEFAULT_KEYBOARD_SHRINK_PX;
    const minHeight = positiveNumber(input.minHeight) || DEFAULT_MIN_HEIGHT;
    const visual = positiveNumber(input.visualHeight);
    const visualOffsetTop = Math.max(0, Number(input.visualOffsetTop) || 0);
    const scrollTop = Math.max(0, Number(input.scrollTop) || 0);
    const localVisibleTop = Math.max(visualOffsetTop, scrollTop);
    const visualBottom = visual ? visual + visualOffsetTop : 0;
    const layout = Math.max(positiveNumber(input.innerHeight), positiveNumber(input.clientHeight));
    const hostKeyboardBottomInset = Math.max(0, Number(input.hostKeyboardBottomInset) || 0);
    const hostBottomSafeArea = Math.max(0, Number(input.hostBottomSafeArea) || 0);
    const hostKeyboardVisible = Boolean(input.hostKeyboardVisible && hostKeyboardBottomInset > threshold);
    const keyboardCandidate = Boolean(visualBottom && layout && visualBottom < layout - threshold);
    const keyboardInputActive = Boolean(input.keyboardInputActive || isKeyboardEditable(input.activeElement));
    const offsetKeyboardShifted = Boolean(keyboardInputActive && visualOffsetTop > 40);
    const scrollKeyboardShifted = Boolean(keyboardInputActive && scrollTop > 40);
    const keyboardShrunk = Boolean(keyboardInputActive && (keyboardCandidate || offsetKeyboardShifted || scrollKeyboardShifted || hostKeyboardVisible));
    const hostKeyboardHeight = hostKeyboardVisible && layout ? Math.max(minHeight, layout - hostKeyboardBottomInset) : 0;
    const localVisualHeight = visual || (visualBottom ? Math.max(0, visualBottom - visualOffsetTop) : 0);
    const height = keyboardShrunk
      ? (hostKeyboardHeight || localVisualHeight || visualBottom || layout || 0)
      : Math.max(visualBottom || 0, layout || 0);
    const top = keyboardShrunk ? localVisibleTop : 0;
    return {
      height: Math.max(minHeight, Math.round(height)),
      top: Math.round(top),
      keyboardShrunk,
      keyboardCandidate,
      visualBottom: Math.round(visualBottom),
      layout: Math.round(layout),
      hostKeyboardVisible,
      hostKeyboardBottomInset: Math.round(hostKeyboardBottomInset),
      hostBottomSafeArea: Math.round(hostBottomSafeArea),
    };
  }

  return {
    isKeyboardEditable,
    measureViewport,
  };
}));
