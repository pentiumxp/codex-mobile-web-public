"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const {
  createThreadTurnCompactionPolicyService,
  defaultIsLiveTurn,
} = require("../adapters/thread-turn-compaction-policy-service");

function setValues(indexes) {
  return [...indexes].sort((a, b) => a - b);
}

function policy() {
  return createThreadTurnCompactionPolicyService({
    isOperationalItem: (item) => Boolean(item && item.operation),
    isUserQuestionItem: (item) => Boolean(item && item.kind === "user"),
    isAssistantReceiptItem: (item) => Boolean(item && item.kind === "assistant"),
    isVisualReceiptItem: (item) => Boolean(item && item.kind === "visual"),
    isTurnUsageSummaryItem: (item) => Boolean(item && item.kind === "usage"),
    isDiagnosticReceiptItem: (item) => Boolean(item && item.kind === "diagnostic"),
  });
}

function functionBody(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing function ${name}`);
  const signatureEnd = source.indexOf(") {", start);
  assert.notEqual(signatureEnd, -1, `missing function body for ${name}`);
  const brace = signatureEnd + 2;
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated function ${name}`);
}

test("trailingOperationIndexes keeps the latest operation items only when operations are allowed", () => {
  const service = policy();
  const items = [
    { id: "a", operation: true },
    { id: "b" },
    { id: "c", operation: true },
    { id: "d", operation: true },
  ];

  assert.deepEqual(setValues(service.trailingOperationIndexes(items, false, 2)), []);
  assert.deepEqual(setValues(service.trailingOperationIndexes(items, true, 2)), [2, 3]);
  assert.deepEqual(setValues(service.trailingOperationIndexes(items, true, "all")), [0, 2, 3]);
});

test("receiptOnlyItemIndexes preserves user, visual, diagnostic, usage, and the last assistant receipt", () => {
  const service = policy();
  const items = [
    { kind: "user" },
    { kind: "assistant", id: "old" },
    { operation: true },
    { kind: "visual" },
    { kind: "diagnostic" },
    { kind: "assistant", id: "final" },
    { kind: "usage" },
  ];

  assert.deepEqual(setValues(service.receiptOnlyItemIndexes(items)), [0, 3, 4, 5, 6]);
});

test("operationDetailTurnIndexes keeps latest live, previous visible, and previous ended turns", () => {
  const service = policy();
  const turns = [
    { id: "ended-empty", status: "completed", items: [] },
    { id: "visible", status: "completed", items: [{ kind: "assistant" }] },
    { id: "non-ended-visible", status: "idle", items: [{ kind: "user" }] },
    { id: "live", status: "running", items: [{ operation: true }] },
  ];

  assert.deepEqual(setValues(service.operationDetailTurnIndexes(turns)), [1, 2, 3]);
});

test("operationDetailTurnIndexes on resting threads keeps latest visible and latest ended turns", () => {
  const service = policy();
  const turns = [
    { id: "visible-old", status: "completed", items: [{ kind: "assistant" }] },
    { id: "ended-empty", status: "completed", items: [] },
    { id: "visible-new", status: "idle", items: [{ kind: "visual" }] },
  ];

  assert.deepEqual(setValues(service.operationDetailTurnIndexes(turns)), [1, 2]);
});

test("operationDetailTurnIndexes falls back to the latest ended or last available turn", () => {
  const service = policy();

  assert.deepEqual(setValues(service.operationDetailTurnIndexes([])), []);
  assert.deepEqual(setValues(service.operationDetailTurnIndexes([
    { id: "plain", status: "idle", items: [] },
    { id: "ended", status: "completed", items: [] },
    { id: "later-plain", status: "idle", items: [] },
  ])), [1]);
  assert.deepEqual(setValues(service.operationDetailTurnIndexes([
    { id: "plain", status: "idle", items: [] },
    { id: "later-plain", status: "idle", items: [] },
  ])), [1]);
});

test("default live-turn detection preserves interrupted shell behavior", () => {
  assert.equal(defaultIsLiveTurn({ status: "running" }), true);
  assert.equal(defaultIsLiveTurn({ status: "interrupted" }), true);
  assert.equal(defaultIsLiveTurn({ status: "interrupted", durationMs: 1 }), false);
  assert.equal(defaultIsLiveTurn({ status: "completed" }), false);
});

test("server compaction merges rollout operations into operation-detail turns", () => {
  const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
  const compactThreadBody = functionBody(serverJs, "compactThread");
  assert.match(serverJs, /function mergeRecentRawOperationsIntoTurn\(/);
  assert.doesNotMatch(serverJs, /function mergeRecentRawOperationsIntoLiveTurn\(/);
  assert.match(compactThreadBody, /const operationDetailIndexes = operationDetailTurnIndexes\(out\.turns\);/);
  assert.match(compactThreadBody, /for \(const index of operationDetailIndexes\) \{[\s\S]*mergeRecentRawOperationsIntoTurn\(out, out\.turns\[index\], \{ maxOperations: 50 \}\);[\s\S]*\}/);
  assert.ok(
    compactThreadBody.indexOf("mergeRecentRawOperationsIntoTurn(out, out.turns[index]") <
      compactThreadBody.indexOf("out.turns = out.turns.map"),
    "rollout operations must be merged before compactTurn filters operational items",
  );
});
