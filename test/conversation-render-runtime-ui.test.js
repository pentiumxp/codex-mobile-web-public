"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const runtimePath = path.join(root, "public", "conversation-render-runtime.js");
const runtimeSource = fs.readFileSync(runtimePath, "utf8");
const conversationRenderRuntime = require(runtimePath);

test("conversation render runtime exposes CommonJS and classic globals", () => {
  assert.equal(typeof conversationRenderRuntime.createConversationRenderRuntime, "function");
  const runtime = conversationRenderRuntime.createConversationRenderRuntime();
  [
    "renderLiveOperationDock",
    "renderTurnVisibleItemBudgetNotice",
    "renderTurn",
    "renderMobileOperationStack",
    "renderItem",
    "renderItemBody",
    "renderUserMessageBody",
    "renderTurnUsageSummary",
    "ensureTurn",
    "shouldDeferLiveFinalReceipt",
    "imageUrlValue",
    "renderMarkdownWithAttachmentSummary",
    "renderFilePreviewContent",
    "closeImagePreview",
  ].forEach((name) => {
    assert.equal(typeof globalThis[name], "function", `${name} legacy global`);
  });
  [
    "renderLiveOperationDock",
    "renderTurnVisibleItemBudgetNotice",
    "renderTurn",
    "renderMobileOperationStack",
    "renderItem",
    "renderItemBody",
    "renderUserMessageBody",
    "renderTurnUsageSummary",
    "ensureTurn",
    "shouldDeferLiveFinalReceipt",
  ].forEach((name) => {
    assert.equal(typeof runtime[name], "function", `${name} factory export`);
  });
  assert.equal(globalThis.CodexConversationRenderRuntime, conversationRenderRuntime);
  assert.match(runtimeSource, /module\.exports = conversationRenderRuntimeApi/);
  assert.match(runtimeSource, /root\.CodexConversationRenderRuntime = conversationRenderRuntimeApi/);
});
