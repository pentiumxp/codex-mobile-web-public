"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const patchPlan = require(path.resolve(__dirname, "..", "public", "thread-detail-patch-plan.js"));

test("visible item patch plan preserves existing order while appending items", () => {
  const plan = patchPlan.planVisibleItemRefreshPatch(
    [
      { key: "user-1", signature: { type: "userMessage", text: "request" } },
      { key: "agent-1", signature: { type: "agentMessage", text: "working" } },
    ],
    [
      { key: "user-1", signature: { type: "userMessage", text: "request" } },
      { key: "agent-1", signature: { type: "agentMessage", text: "working" } },
      { key: "usage-1", signature: { type: "turnUsageSummary", total: 10 } },
    ],
  );

  assert.equal(plan.canPatch, true);
  assert.equal(plan.reason, "shape-preserved");
  assert.deepEqual(plan.operations.map((operation) => operation.type), ["reuse", "reuse", "insert"]);
  assert.deepEqual(plan.operations.map((operation) => operation.key), ["user-1", "agent-1", "usage-1"]);
});

test("visible item patch plan patches changed signatures without changing shape", () => {
  const plan = patchPlan.planVisibleItemRefreshPatch(
    [
      { key: "agent-1", signature: { type: "agentMessage", text: "old" } },
    ],
    [
      { key: "agent-1", signature: { type: "agentMessage", text: "new" } },
    ],
  );

  assert.equal(plan.canPatch, true);
  assert.equal(plan.reason, "shape-preserved");
  assert.deepEqual(plan.operations.map((operation) => operation.type), ["patch"]);
  assert.equal(plan.operations[0].previousEntry.signature.text, "old");
  assert.equal(plan.operations[0].nextEntry.signature.text, "new");
});

test("visible item patch plan rejects reorder, removal, and invalid entries", () => {
  assert.equal(
    patchPlan.visibleItemPatchShapePreservesExisting(
      [{ key: "a", signature: "a" }, { key: "b", signature: "b" }],
      [{ key: "b", signature: "b" }, { key: "a", signature: "a" }],
    ),
    false,
  );
  assert.equal(
    patchPlan.planVisibleItemRefreshPatch(
      [{ key: "a", signature: "a" }, { key: "b", signature: "b" }],
      [{ key: "a", signature: "a" }],
    ).canPatch,
    false,
  );
  assert.deepEqual(
    patchPlan.planVisibleItemRefreshPatch([{ key: "a", signature: "a" }], [{ signature: "a" }]),
    { canPatch: false, reason: "shape-changed", operations: [] },
  );
});
