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
  assert.equal(result.height, 536);
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
