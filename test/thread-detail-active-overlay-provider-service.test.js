"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadDetailActiveOverlayProviderService,
} = require("../adapters/thread-detail-active-overlay-provider-service");
const {
  planActiveWindowOverlay,
} = require("../adapters/thread-detail-active-window-overlay-policy-service");
const {
  createThreadDetailProjectionV4Service,
} = require("../adapters/thread-detail-projection-v4-service");

function projectionThread(overrides = {}) {
  return Object.assign({
    id: "thread-1",
    turns: [{ id: "older-turn", items: [{ id: "agent-old", type: "agentMessage" }] }],
    mobileReadMode: "projection-v4-partial",
    mobileProjectionRevision: 1,
    mobileProjection: {
      source: "partial",
      version: "v4",
      partial: true,
      revision: 1,
    },
  }, overrides);
}

function activeSummary(overrides = {}) {
  return Object.assign({
    id: "thread-1",
    status: { type: "active" },
    activeTurnId: "turn-1",
  }, overrides);
}

test("active overlay provider converts live projection snapshot into complete policy evidence", () => {
  const projectionService = createThreadDetailProjectionV4Service({
    cacheDir: "",
    policyVersion: "test-v4",
    maxTurns: 3,
    now: (() => {
      let current = 10000;
      return () => {
        current += 100;
        return current;
      };
    })(),
  });
  projectionService.applyNotification("turn/started", {
    threadId: "thread-1",
    turn: { id: "turn-1", status: { type: "active" }, items: [] },
  });
  projectionService.applyNotification("item/started", {
    threadId: "thread-1",
    turnId: "turn-1",
    item: { id: "cmd-1", type: "commandExecution", status: "running" },
  });
  projectionService.applyNotification("item/agentMessage/delta", {
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "agent-1",
    delta: "partial reply",
  });
  projectionService.applyNotification("item/completed", {
    threadId: "thread-1",
    turnId: "turn-1",
    item: { id: "usage-1", type: "turnUsageSummary" },
  });

  const provider = createThreadDetailActiveOverlayProviderService({ projectionService });
  const input = provider.resolveActiveWindowOverlay({
    threadId: "thread-1",
    summary: activeSummary(),
    projectionThread: projectionThread(),
  });

  assert.equal(input.overlaySource, "projection-live");
  assert.equal(input.operationCoverage, "present");
  assert.equal(input.uploadCoverage, "none");
  assert.equal(input.receiptCoverage, "present");
  assert.equal(input.projectionRevision, 1);
  assert.equal(input.overlayRevision, 4);
  assert.deepEqual(input.overlayEvidence, {
    turnId: "turn-1",
    latestItemTimestampMs: 0,
    items: 3,
    operationItems: 1,
    uploadItems: 0,
    assistantItems: 1,
    receiptItems: 1,
    otherItems: 0,
    unknownItems: 0,
  });

  const plan = planActiveWindowOverlay(Object.assign({}, input, {
    summary: activeSummary(),
    projectionThread: projectionThread(),
  }));
  assert.equal(plan.action, "use-projection-overlay");
  assert.equal(plan.reason, "overlay-evidence-complete");
});

test("active overlay provider requests clone-free snapshots for read-only proof", () => {
  let seenInput = null;
  const projectionService = {
    activeOverlaySnapshot(input) {
      seenInput = input;
      return {
        found: false,
        reason: "entry-missing",
      };
    },
  };
  const provider = createThreadDetailActiveOverlayProviderService({ projectionService });
  provider.resolveActiveWindowOverlay({
    threadId: "thread-1",
    summary: activeSummary(),
    projectionThread: projectionThread(),
  });

  assert.equal(seenInput.threadId, "thread-1");
  assert.equal(seenInput.activeTurnId, "turn-1");
  assert.equal(seenInput.cloneOverlayTurn, false);
});

test("active overlay provider derives active turn from live projection when summary only says active", () => {
  const projectionService = createThreadDetailProjectionV4Service({
    cacheDir: "",
    policyVersion: "test-v4",
    maxTurns: 3,
    now: (() => {
      let current = 20000;
      return () => {
        current += 100;
        return current;
      };
    })(),
  });
  projectionService.applyNotification("turn/started", {
    threadId: "thread-1",
    turn: { id: "turn-1", status: { type: "active" }, items: [] },
  });
  projectionService.applyNotification("item/started", {
    threadId: "thread-1",
    turnId: "turn-1",
    item: { id: "cmd-1", type: "commandExecution", status: "running" },
  });
  projectionService.applyNotification("item/agentMessage/delta", {
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "agent-1",
    delta: "partial reply",
  });
  projectionService.applyNotification("item/completed", {
    threadId: "thread-1",
    turnId: "turn-1",
    item: { id: "usage-1", type: "turnUsageSummary" },
  });

  const provider = createThreadDetailActiveOverlayProviderService({ projectionService });
  const input = provider.resolveActiveWindowOverlay({
    threadId: "thread-1",
    summary: activeSummary({ activeTurnId: "" }),
    projectionThread: projectionThread(),
  });

  assert.equal(input.activeTurnId, "turn-1");
  assert.equal(input.overlaySource, "projection-live");
  assert.equal(input.operationCoverage, "present");
  assert.equal(input.uploadCoverage, "none");
  assert.equal(input.receiptCoverage, "present");

  const plan = planActiveWindowOverlay(Object.assign({}, input, {
    summary: activeSummary({ activeTurnId: "" }),
    projectionThread: projectionThread(),
  }));
  assert.equal(plan.action, "use-projection-overlay");
  assert.equal(plan.reason, "overlay-evidence-complete");
});

test("active overlay provider fails closed when live snapshot is missing", () => {
  const projectionService = createThreadDetailProjectionV4Service({
    cacheDir: "",
    policyVersion: "test-v4",
    maxTurns: 3,
    now: () => 12000,
  });
  const provider = createThreadDetailActiveOverlayProviderService({ projectionService });
  const input = provider.resolveActiveWindowOverlay({
    threadId: "thread-1",
    summary: activeSummary(),
    projectionThread: projectionThread(),
  });
  const plan = planActiveWindowOverlay(Object.assign({}, input, {
    summary: activeSummary(),
    projectionThread: projectionThread(),
  }));

  assert.equal(input.overlayUnavailableReason, "entry-missing");
  assert.equal(plan.action, "require-full-read");
  assert.equal(plan.reason, "entry-missing");
});

test("active overlay provider cannot prove assistant freshness without v4 revision evidence", () => {
  const projectionService = {
    activeOverlaySnapshot() {
      return {
        found: true,
        overlaySource: "projection-live",
        updatedAtMs: 13000,
        overlayTurn: {
          id: "turn-1",
          items: [{ id: "agent-1", type: "agentMessage" }],
        },
      };
    },
  };
  const provider = createThreadDetailActiveOverlayProviderService({ projectionService });
  const input = provider.resolveActiveWindowOverlay({
    threadId: "thread-1",
    summary: activeSummary(),
    projectionThread: projectionThread({ mobileProjectionRevision: 0, mobileProjection: { partial: true } }),
  });
  const plan = planActiveWindowOverlay(Object.assign({}, input, {
    summary: activeSummary(),
    projectionThread: projectionThread(),
  }));

  assert.equal(input.overlayRevision, 0);
  assert.equal(plan.action, "require-full-read");
  assert.equal(plan.reason, "assistant-delta-unknown");
});
