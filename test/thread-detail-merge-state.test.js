"use strict";

const assert = require("assert");
const path = require("path");
const test = require("node:test");

const mergeState = require(path.resolve(__dirname, "..", "public", "thread-detail-merge-state.js"));

function sortPhase(turn) {
  const status = String(turn && turn.status || "").toLowerCase();
  if (/running|active|pending|processing|in[_-]?progress/.test(status)) return 2;
  if (/completed|failed|cancel/.test(status)) return 1;
  return 0;
}

function orderMs(turn) {
  return Number(turn && (turn.completedAtMs || turn.startedAtMs || 0)) || 0;
}

function itemOrderMs(item) {
  return Number(item && (
    item.createdAtMs
    || item.startedAtMs
    || item.updatedAtMs
    || item.timestampMs
    || item.mobileDisplayTimestampMs
    || item.completedAtMs
    || 0
  )) || 0;
}

function itemOrderRange(turn) {
  const timestamps = (Array.isArray(turn && turn.items) ? turn.items : [])
    .map(itemOrderMs)
    .filter((timestamp) => timestamp > 0);
  return {
    first: timestamps.length ? Math.min(...timestamps) : 0,
    last: timestamps.length ? Math.max(...timestamps) : 0,
  };
}

function sortTurnsForDisplay(turns) {
  return (turns || []).slice().sort((left, right) => {
    const leftPhase = sortPhase(left);
    const rightPhase = sortPhase(right);
    if (leftPhase !== rightPhase) return leftPhase - rightPhase;
    const leftMs = orderMs(left);
    const rightMs = orderMs(right);
    if (leftMs !== rightMs) return leftMs - rightMs;
    const leftRange = itemOrderRange(left);
    const rightRange = itemOrderRange(right);
    if (leftRange.first !== rightRange.first) return leftRange.first - rightRange.first;
    if (leftRange.last !== rightRange.last) return leftRange.last - rightRange.last;
    return String(left && left.id || "").localeCompare(String(right && right.id || ""));
  });
}

function createPolicy(overrides = {}) {
  return mergeState.createThreadDetailMergePolicy(Object.assign({
    normalizeThreadVisibleUserMessages: (thread) => thread,
    turnVisibleWeight: (turn) => (Array.isArray(turn && turn.items) ? turn.items.length : 0),
    mergeItemsPreservingLocalVisible(existingItems, incomingItems, preserveLocalVisible) {
      if (!preserveLocalVisible) return incomingItems;
      return incomingItems.concat(existingItems.filter((item) => item && item.localOnly));
    },
    isTurnComplete: (turn) => String(turn && turn.status || "") === "completed",
    sortTurnsForDisplay,
    threadHasInitialSubmissionEcho: (thread, initialSubmissionId) => (
      !initialSubmissionId
      || (thread.turns || []).some((turn) => String(turn.id || "") === initialSubmissionId)
    ),
  }, overrides));
}

test("mergeTurnPreservingVisibleItems keeps existing items when incoming has no item list", () => {
  const policy = createPolicy();
  const merged = policy.mergeTurnPreservingVisibleItems(
    { id: "t1", status: "running", items: [{ id: "a" }] },
    { id: "t1", status: "completed" }
  );

  assert.equal(merged.status, "completed");
  assert.deepEqual(merged.items, [{ id: "a" }]);
});

test("mergeTurnPreservingVisibleItems preserves local visible items when incoming weight shrinks", () => {
  const policy = createPolicy();
  const merged = policy.mergeTurnPreservingVisibleItems(
    { id: "t1", items: [{ id: "a" }, { id: "local", localOnly: true }] },
    { id: "t1", items: [{ id: "a" }] }
  );

  assert.deepEqual(merged.items, [{ id: "a" }, { id: "local", localOnly: true }]);
});

test("mergeTurnPreservingVisibleItems delegates live-to-completed preservation decision", () => {
  let observedWeight = null;
  const policy = createPolicy({
    shouldPreserveExistingTurnVisibleItems(existingTurn, incomingTurn, existingWeight) {
      observedWeight = existingWeight;
      return existingTurn.status === "running" && incomingTurn.status === "completed";
    },
  });

  const merged = policy.mergeTurnPreservingVisibleItems(
    { id: "t1", status: "running", items: [{ id: "a" }, { id: "local", localOnly: true }] },
    { id: "t1", status: "completed", items: [{ id: "a" }, { id: "b" }] }
  );

  assert.equal(observedWeight, 2);
  assert.deepEqual(merged.items, [{ id: "a" }, { id: "b" }, { id: "local", localOnly: true }]);
});

test("mergeThreadPreservingVisibleItems clears stale mobile load flags absent from incoming", () => {
  const policy = createPolicy();
  const merged = policy.mergeThreadPreservingVisibleItems(
    {
      id: "thread-1",
      mobileLoading: true,
      mobileLoadError: "old",
      mobileReadWarning: "stale",
      turns: [{ id: "t1", items: [{ id: "a" }] }],
    },
    { id: "thread-1", turns: [{ id: "t1", items: [{ id: "a" }] }] }
  );

  assert.equal(Object.prototype.hasOwnProperty.call(merged, "mobileLoading"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(merged, "mobileLoadError"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(merged, "mobileReadWarning"), false);
});

test("mergeThreadPreservingVisibleItems normalizes incoming turn display order", () => {
  const policy = createPolicy();
  const merged = policy.mergeThreadPreservingVisibleItems(
    null,
    {
      id: "thread-1",
      turns: [
        { id: "newer", status: "completed", completedAtMs: 3000, items: [{ id: "new" }] },
        { id: "older", status: "completed", completedAtMs: 1000, items: [{ id: "old" }] },
      ],
    }
  );

  assert.deepEqual(merged.turns.map((turn) => turn.id), ["older", "newer"]);
});

test("mergeThreadPreservingVisibleItems repairs stale cached turn display order", () => {
  const policy = createPolicy();
  const merged = policy.mergeThreadPreservingVisibleItems(
    {
      id: "thread-1",
      turns: [
        { id: "newer", status: "completed", completedAtMs: 3000, items: [{ id: "new-cached" }] },
        { id: "older", status: "completed", completedAtMs: 1000, items: [{ id: "old-cached" }] },
      ],
    },
    {
      id: "thread-1",
      turns: [
        { id: "newer", status: "completed", completedAtMs: 3000, items: [{ id: "new" }] },
        { id: "older", status: "completed", completedAtMs: 1000, items: [{ id: "old" }] },
      ],
    }
  );

  assert.deepEqual(merged.turns.map((turn) => turn.id), ["older", "newer"]);
});

test("mergeThreadPreservingVisibleItems uses item timestamps when turn timestamps tie", () => {
  const policy = createPolicy();
  const merged = policy.mergeThreadPreservingVisibleItems(
    {
      id: "thread-1",
      turns: [
        { id: "b-later-item", status: "completed", completedAtMs: 2000, items: [{ id: "late", createdAtMs: 2300 }] },
        { id: "z-earlier-item", status: "completed", completedAtMs: 2000, items: [{ id: "early", createdAtMs: 2100 }] },
      ],
    },
    {
      id: "thread-1",
      turns: [
        { id: "b-later-item", status: "completed", completedAtMs: 2000, items: [{ id: "late", createdAtMs: 2300 }] },
        { id: "z-earlier-item", status: "completed", completedAtMs: 2000, items: [{ id: "early", createdAtMs: 2100 }] },
      ],
    }
  );

  assert.deepEqual(merged.turns.map((turn) => turn.id), ["z-earlier-item", "b-later-item"]);
});

test("mergeThreadPreservingVisibleItems repairs retained detail order when empty refresh is weaker", () => {
  const policy = createPolicy();
  const merged = policy.mergeThreadPreservingVisibleItems(
    {
      id: "thread-1",
      turns: [
        { id: "newer", status: "completed", completedAtMs: 3000, items: [{ id: "new" }] },
        { id: "older", status: "completed", completedAtMs: 1000, items: [{ id: "old" }] },
      ],
    },
    { id: "thread-1", turns: [] }
  );

  assert.deepEqual(merged.turns.map((turn) => turn.id), ["older", "newer"]);
});

test("mergeThreadPreservingVisibleItems retains active local turn missing from incoming", () => {
  const policy = createPolicy();
  const merged = policy.mergeThreadPreservingVisibleItems(
    {
      id: "thread-1",
      turns: [
        { id: "active", status: "running", items: [{ id: "local" }] },
        { id: "old", status: "completed", items: [{ id: "old" }] },
      ],
    },
    { id: "thread-1", turns: [{ id: "incoming", status: "completed", items: [{ id: "incoming" }] }] },
    { activeTurnId: "active" }
  );

  assert.deepEqual(merged.turns.map((turn) => turn.id), ["incoming", "active"]);
});

test("mergeThreadPreservingVisibleItems refuses empty incoming detail over stronger visible detail", () => {
  const policy = createPolicy();
  const merged = policy.mergeThreadPreservingVisibleItems(
    {
      id: "thread-1",
      turns: [
        { id: "existing-1", status: "completed", items: [{ id: "a" }, { id: "b" }] },
        { id: "existing-2", status: "completed", items: [{ id: "c" }] },
      ],
      mobileProjectionVersion: "v4",
    },
    {
      id: "thread-1",
      turns: [],
      mobileReadMode: "projection-cache",
      mobileProjectionVersion: "v4",
    }
  );

  assert.deepEqual(merged.turns.map((turn) => turn.id), ["existing-1", "existing-2"]);
  assert.equal(merged.mobileReadMode, "projection-cache");
  assert.equal(merged.mobileProjectionVersion, "v4");
});

test("mergeThreadPreservingVisibleItems preserves expanded history and decrements omitted count", () => {
  const policy = createPolicy({ maxExpandedVisibleTurns: 10 });
  const merged = policy.mergeThreadPreservingVisibleItems(
    {
      id: "thread-1",
      mobileHistoryExpanded: true,
      turns: [
        { id: "001", status: "completed", items: [{ id: "a" }] },
        { id: "002", status: "completed", items: [{ id: "b" }] },
      ],
    },
    {
      id: "thread-1",
      mobileReadMode: "turns-list",
      mobileOmittedTurnCount: 3,
      turns: [{ id: "002", status: "completed", items: [{ id: "b2" }] }],
    }
  );

  assert.equal(merged.mobileHistoryExpanded, true);
  assert.equal(merged.mobileOmittedTurnCount, 2);
  assert.deepEqual(merged.turns.map((turn) => turn.id), ["001", "002"]);
});

test("mergeThreadPreservingVisibleItems removes stale initial submission id after echo disappears", () => {
  const policy = createPolicy({
    threadHasInitialSubmissionEcho: () => false,
  });
  const merged = policy.mergeThreadPreservingVisibleItems(
    { id: "thread-1", mobileInitialSubmissionId: "submitted", turns: [{ id: "submitted", items: [] }] },
    { id: "thread-1", turns: [{ id: "server", items: [] }] }
  );

  assert.equal(Object.prototype.hasOwnProperty.call(merged, "mobileInitialSubmissionId"), false);
});

test("mergeThreadPreservingVisibleItems delegates v4 projection threads", () => {
  const policy = createPolicy({
    isV4ProjectionThread: (thread) => Boolean(thread && thread.mobileProjectionVersion === 4),
    mergeV4ProjectionThread(existingThread, incomingThread) {
      return { delegated: true, existing: existingThread.id, incoming: incomingThread.id };
    },
  });

  assert.deepEqual(
    policy.mergeThreadPreservingVisibleItems(
      { id: "thread-1" },
      { id: "thread-1", mobileProjectionVersion: 4 }
    ),
    { delegated: true, existing: "thread-1", incoming: "thread-1" }
  );
});
