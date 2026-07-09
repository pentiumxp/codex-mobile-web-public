"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const taskCardRuntimeJs = fs.readFileSync(path.join(root, "public", "task-card-runtime.js"), "utf8");
const stylesCss = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const taskCardRuntime = require(path.join(root, "public", "task-card-runtime.js"));

test("task card runtime preserves CommonJS and legacy global entry points", () => {
  assert.equal(typeof taskCardRuntime.createTaskCardRuntime, "function");
  const runtime = taskCardRuntime.createTaskCardRuntime();
  for (const name of [
    "renderThreadTaskCard",
    "renderThreadTaskCards",
    "renderThreadTaskCardReturnReceipt",
    "renderThreadTaskCardReturnReceiptTurn",
    "renderThreadTaskCardReturnReceipts",
    "renderThreadConversationFlowWithReturnReceipts",
    "taskCardReturnReceiptTurnId",
    "threadTaskCardReturnReceiptFlowEntries",
    "threadTaskCardReturnReceiptFlowTurnIds",
    "threadTaskCardReturnReceiptTurnIds",
    "createThreadTaskCardFromCurrent",
    "renderApprovalRequest",
  ]) {
    assert.equal(typeof runtime[name], "function", `${name} should be exported`);
  }
  for (const name of [
    "threadTaskCardCommandText",
    "parseThreadTaskCardDraftText",
    "renderThreadTaskCard",
    "renderThreadTaskCards",
    "renderThreadTaskCardReturnReceipt",
    "renderThreadTaskCardReturnReceiptTurn",
    "renderThreadTaskCardReturnReceipts",
    "renderThreadConversationFlowWithReturnReceipts",
    "taskCardReturnReceiptTurnId",
    "threadTaskCardReturnReceiptFlowEntries",
    "threadTaskCardReturnReceiptFlowTurnIds",
    "threadTaskCardReturnReceiptTurnIds",
    "renderApprovalRequest",
    "createThreadTaskCardFromCurrent",
    "refreshCurrentThreadAfterTaskCard",
    "waitForContinuationJob",
  ]) {
    assert.equal(typeof globalThis[name], "function", `${name} should remain a legacy global`);
  }
  assert.equal(globalThis.CodexTaskCardRuntime, taskCardRuntime);
  assert.match(taskCardRuntimeJs, /module\.exports = taskCardRuntimeApi/);
  assert.match(taskCardRuntimeJs, /root\.CodexTaskCardRuntime = taskCardRuntimeApi/);
});

test("task card runtime renders terminal returns as bounded source conversation turns outside the task-card stack", () => {
  globalThis.escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  globalThis.entryAnimationClass = () => "";
  globalThis.truncateSingleLine = (value, maxChars = 96) => String(value || "").slice(0, maxChars);
  globalThis.threadTaskCardReturnReceiptsForThread = () => [{
    id: "ttc_return",
    status: "approved",
    threadRole: "target",
    terminal: true,
    ackPolicy: "none",
    source: { threadId: "worker-thread" },
    delivery: { returnStatus: "completed" },
    message: {
      title: "Return: Worker completed",
      summary: "completed with a bounded summary that can wrap on narrow mobile screens without overflowing the turn card",
      bodyOmitted: true,
      bodyChars: 120,
    },
  }];

  const runtime = taskCardRuntime.createTaskCardRuntime();
  const html = runtime.renderThreadTaskCardReturnReceipts({ id: "source-thread" }, new Set());

  assert.match(html, /thread-task-card-return-receipt-stack/);
  assert.match(html, /article class="turn thread-task-card-return-turn/);
  assert.match(html, /section class="item thread-task-card-return-receipt/);
  assert.match(html, /thread-task-card-return-heading/);
  assert.match(html, /thread-task-card-return-title/);
  assert.match(html, /data-turn="task-card-return-receipt\|ttc_return"/);
  assert.match(html, /data-task-card-return-turn="ttc_return"/);
  assert.match(html, /data-task-card-return-receipt="ttc_return"/);
  assert.match(html, /Return: Worker completed/);
  assert.match(html, /Completed/);
  assert.match(html, /data-task-card-body-placeholder/);
  assert.doesNotMatch(html, /history-note thread-task-card-return-receipt/);
  assert.doesNotMatch(html, /Task card from worker-thread/);
  assert.doesNotMatch(html, /thread-task-card-stack/);
  assert.deepEqual(runtime.threadTaskCardReturnReceiptTurnIds({ id: "source-thread" }), ["task-card-return-receipt|ttc_return"]);
});

test("task card runtime inserts return receipts into conversation flow by return time", () => {
  globalThis.escapeHtml = (value) => String(value || "");
  globalThis.entryAnimationClass = () => "";
  globalThis.truncateSingleLine = (value) => String(value || "");
  globalThis.threadTaskCardReturnReceiptsForThread = () => [{
    id: "ttc_return",
    status: "approved",
    terminal: true,
    ackPolicy: "none",
    delivery: {
      returnToSource: true,
      terminal: true,
      returnedAt: "2026-07-09T08:05:00.000Z",
      returnStatus: "completed",
    },
    message: { title: "Return: Worker completed", summary: "done" },
    updatedAt: "2026-07-09T09:30:00.000Z",
  }];

  const runtime = taskCardRuntime.createTaskCardRuntime();
  const thread = { id: "source-thread" };
  const turns = [
    { id: "turn-before", completedAt: "2026-07-09T08:00:00.000Z", items: [{ id: "a" }] },
    { id: "turn-after", completedAt: "2026-07-09T08:10:00.000Z", items: [{ id: "b" }] },
  ];
  const ids = runtime.threadTaskCardReturnReceiptFlowTurnIds(thread, turns);
  const html = runtime.renderThreadConversationFlowWithReturnReceipts(
    thread,
    turns,
    new Set(),
    (turn) => `<article class="turn" data-turn="${turn.id}">${turn.id}</article>`,
  );

  assert.deepEqual(ids, ["turn-before", "task-card-return-receipt|ttc_return", "turn-after"]);
  assert.ok(html.indexOf("data-turn=\"turn-before\"") < html.indexOf("data-task-card-return-turn=\"ttc_return\""));
  assert.ok(html.indexOf("data-task-card-return-turn=\"ttc_return\"") < html.indexOf("data-turn=\"turn-after\""));
});

test("task card return receipt turn has bounded mobile wrapping styles", () => {
  assert.match(stylesCss, /\.thread-task-card-return-receipt-stack[^{]*{[^}]*width:\s*100%;[^}]*max-width:\s*980px;/s);
  assert.match(stylesCss, /\.thread-task-card-return-receipt[^{]*{[^}]*background:\s*var\(--approval-resolved-bg\);/s);
  assert.match(stylesCss, /\.thread-task-card-return-title[^{]*{[^}]*overflow-wrap:\s*anywhere;[^}]*word-break:\s*break-word;/s);
  assert.match(stylesCss, /\.thread-task-card-return-receipt \.approval-summary-line[^{]*{[^}]*white-space:\s*normal;/s);
});
