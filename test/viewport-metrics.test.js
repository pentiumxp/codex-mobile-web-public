"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const viewportMetrics = require("../public/viewport-metrics");

function editableElement(overrides = {}) {
  return Object.assign({
    tagName: "DIV",
    isContentEditable: true,
  }, overrides);
}

test("viewport metrics ignore stale half-height visual viewport without focused input", () => {
  const result = viewportMetrics.measureViewport({
    visualHeight: 520,
    visualOffsetTop: 0,
    innerHeight: 1024,
    clientHeight: 1024,
    activeElement: { tagName: "BODY" },
  });

  assert.equal(result.keyboardCandidate, true);
  assert.equal(result.keyboardShrunk, false);
  assert.equal(result.height, 1024);
});

test("viewport metrics use visual viewport while an editable input owns the keyboard", () => {
  const result = viewportMetrics.measureViewport({
    visualHeight: 520,
    visualOffsetTop: 16,
    innerHeight: 1024,
    clientHeight: 1024,
    activeElement: editableElement(),
  });

  assert.equal(result.keyboardShrunk, true);
  assert.equal(result.height, 520);
  assert.equal(result.top, 16);
});

test("viewport metrics use host keyboard inset as embedded fallback", () => {
  const result = viewportMetrics.measureViewport({
    visualHeight: 714,
    visualOffsetTop: 0,
    innerHeight: 714,
    clientHeight: 714,
    activeElement: editableElement(),
    hostKeyboardVisible: true,
    hostKeyboardBottomInset: 292,
  });

  assert.equal(result.keyboardCandidate, false);
  assert.equal(result.hostKeyboardVisible, true);
  assert.equal(result.keyboardShrunk, true);
  assert.equal(result.height, 422);
});

test("viewport metrics avoid double subtracting host keyboard inset for resized iframes", () => {
  const result = viewportMetrics.measureViewport({
    visualHeight: 422,
    visualOffsetTop: 0,
    innerHeight: 422,
    clientHeight: 422,
    activeElement: editableElement(),
    hostViewportHeight: 422,
    hostKeyboardVisible: true,
    hostKeyboardBottomInset: 292,
  });

  assert.equal(result.keyboardCandidate, false);
  assert.equal(result.hostKeyboardVisible, true);
  assert.equal(result.keyboardShrunk, true);
  assert.equal(result.height, 422);
});

test("viewport metrics preserve host bottom safe area without keyboard shrink", () => {
  const result = viewportMetrics.measureViewport({
    visualHeight: 714,
    visualOffsetTop: 0,
    innerHeight: 714,
    clientHeight: 714,
    activeElement: { tagName: "BODY" },
    hostBottomSafeArea: 18,
  });

  assert.equal(result.keyboardShrunk, false);
  assert.equal(result.height, 714);
  assert.equal(result.hostBottomSafeArea, 18);
});

test("viewport metrics treat iframe scroll or offset as keyboard shift", () => {
  const scrolled = viewportMetrics.measureViewport({
    visualHeight: 714,
    visualOffsetTop: 0,
    scrollTop: 88,
    innerHeight: 714,
    clientHeight: 714,
    activeElement: editableElement(),
  });
  assert.equal(scrolled.keyboardCandidate, false);
  assert.equal(scrolled.keyboardShrunk, true);
  assert.equal(scrolled.top, 88);
  assert.equal(scrolled.height, 714);

  const offset = viewportMetrics.measureViewport({
    visualHeight: 600,
    visualOffsetTop: 72,
    innerHeight: 672,
    clientHeight: 672,
    activeElement: editableElement(),
  });
  assert.equal(offset.keyboardShrunk, true);
  assert.equal(offset.top, 72);
  assert.equal(offset.height, 600);
});

test("regular mobile viewport callers can ignore document scroll while the keyboard is open", () => {
  const result = viewportMetrics.measureViewport({
    visualHeight: 520,
    visualOffsetTop: 0,
    scrollTop: 0,
    innerHeight: 1024,
    clientHeight: 1024,
    activeElement: editableElement(),
  });

  assert.equal(result.keyboardCandidate, true);
  assert.equal(result.keyboardShrunk, true);
  assert.equal(result.top, 0);
  assert.equal(result.height, 520);
});

test("viewport metrics do not treat non-text controls as keyboard owners", () => {
  const result = viewportMetrics.measureViewport({
    visualHeight: 520,
    innerHeight: 1024,
    clientHeight: 1024,
    activeElement: { tagName: "INPUT", type: "checkbox" },
  });

  assert.equal(result.keyboardCandidate, true);
  assert.equal(result.keyboardShrunk, false);
  assert.equal(result.height, 1024);
});

test("viewport metrics accept text inputs and textareas as keyboard owners", () => {
  assert.equal(viewportMetrics.isKeyboardEditable({ tagName: "INPUT", type: "text" }), true);
  assert.equal(viewportMetrics.isKeyboardEditable({ tagName: "INPUT", type: "search" }), true);
  assert.equal(viewportMetrics.isKeyboardEditable({ tagName: "TEXTAREA" }), true);
  assert.equal(viewportMetrics.isKeyboardEditable({ tagName: "INPUT", type: "text", readOnly: true }), false);
  assert.equal(viewportMetrics.isKeyboardEditable({ tagName: "TEXTAREA", disabled: true }), false);
});
