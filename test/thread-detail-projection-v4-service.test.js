"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createThreadDetailProjectionV4Service,
} = require("../adapters/thread-detail-projection-v4-service");
const {
  CONTEXT_COMPACTION_COMPLETE_NOTICE,
  CONTEXT_COMPACTION_PENDING_NOTICE,
} = require("../adapters/thread-visible-item-normalizer");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-thread-projection-v4-"));
}

function signatureInput(overrides = {}) {
  return Object.assign({
    threadId: "thread-1",
    rolloutPath: path.join(os.tmpdir(), "rollout-thread-1.jsonl"),
    rolloutStats: {
      sizeBytes: 1024,
      mtimeMs: 1000,
    },
    maxTurns: 3,
    summaryUpdatedAtMs: 1000,
    summaryStatus: "active",
  }, overrides);
}

test("v4 projection service returns versioned visible keys from warm cache", () => {
  const dir = tempDir();
  try {
    const service = createThreadDetailProjectionV4Service({
      cacheDir: dir,
      policyVersion: "test-v4",
      maxTurns: 3,
      now: () => 2000,
    });
    service.seed(signatureInput(), {
      thread: {
        id: "thread-1",
        turns: [{
          id: "turn-1",
          items: [{ id: "user-1", type: "userMessage" }],
        }],
      },
    });

    const cached = service.get(signatureInput());

    assert.ok(cached);
    assert.equal(cached.version, "v4");
    assert.equal(cached.result.thread.mobileProjectionVersion, "v4");
    assert.equal(cached.result.thread.mobileProjectionRevision, 1);
    assert.deepEqual(cached.result.thread.mobileVisibleItemKeys, ["turn-1:user:user-1"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("v4 projection service preserves partial recent-window opt-in semantics", () => {
  const dir = tempDir();
  try {
    const service = createThreadDetailProjectionV4Service({
      cacheDir: dir,
      policyVersion: "test-v4",
      maxTurns: 3,
      now: () => 2000,
    });
    const seeded = service.seed(signatureInput(), {
      thread: {
        id: "thread-1",
        turns: [{
          id: "turn-recent",
          items: [{ id: "user-1", type: "userMessage" }],
        }],
      },
    }, {
      partial: true,
      partialKind: "recent-window",
    });

    assert.equal(seeded.partial, true);
    assert.equal(seeded.partialKind, "recent-window");
    assert.equal(seeded.version, "v4");
    assert.equal(service.get(signatureInput()), null);
    assert.equal(service.lookup(signatureInput()).missReason, "partial-not-allowed");

    const cached = service.get(signatureInput(), { allowPartial: true });
    assert.ok(cached);
    assert.equal(cached.version, "v4");
    assert.equal(cached.partial, true);
    assert.equal(cached.partialKind, "recent-window");
    assert.equal(cached.result.thread.mobileProjectionVersion, "v4");
    assert.equal(cached.result.thread.mobileProjectionRevision, 1);
    assert.deepEqual(cached.result.thread.mobileVisibleItemKeys, ["turn-recent:user:user-1"]);

    const lightweight = service.lookup(signatureInput(), {
      allowPartial: true,
      activeOverlay: true,
      skipNormalizeResult: true,
    });
    assert.ok(lightweight.cached);
    assert.equal(lightweight.cached.version, "v4");
    assert.equal(lightweight.cached.result.thread.mobileReadMode, "projection-v4-partial");
    assert.equal(lightweight.cached.result.thread.mobileProjection.version, "v4");
    assert.equal(lightweight.cached.result.thread.mobileProjection.source, "partial");
    assert.equal(lightweight.cached.result.thread.mobileProjection.revision, 1);
    assert.deepEqual(lightweight.cached.result.thread.mobileVisibleItemKeys, ["turn-recent:user:user-1"]);

    const restoredService = createThreadDetailProjectionV4Service({
      cacheDir: dir,
      policyVersion: "test-v4",
      maxTurns: 3,
      now: () => 3000,
    });
    assert.equal(restoredService.get(signatureInput(), { allowPartial: true }), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("v4 projection service marks cursor-backed turns-list windows as partial", () => {
  const service = createThreadDetailProjectionV4Service({
    cacheDir: "",
    policyVersion: "test-v4",
    maxTurns: 3,
    now: () => 2000,
  });
  const seeded = service.seed(signatureInput(), {
    thread: {
      id: "thread-1",
      mobileReadMode: "turns-list-large",
      mobileOlderTurnsCursor: "older-cursor",
      mobileNewerTurnsCursor: "newer-cursor",
      turns: [{
        id: "turn-window",
        items: [{ id: "user-1", type: "userMessage" }],
      }],
    },
  });

  assert.equal(seeded.partial, true);
  assert.equal(seeded.partialKind, "turns-list-window");
  assert.equal(service.get(signatureInput()), null);
  assert.equal(service.lookup(signatureInput()).missReason, "partial-not-allowed");

  const cached = service.get(signatureInput(), { allowPartial: true });
  assert.ok(cached);
  assert.equal(cached.version, "v4");
  assert.equal(cached.partial, true);
  assert.equal(cached.partialKind, "turns-list-window");
  assert.equal(cached.result.thread.mobileProjectionVersion, "v4");
  assert.equal(cached.result.thread.turns[0].items[0].mobileProjectionSource, "partial");
  assert.deepEqual(cached.result.thread.mobileVisibleItemKeys, ["turn-window:user:user-1"]);
});

test("v4 projection service exposes bounded lookup miss reasons", () => {
  const service = createThreadDetailProjectionV4Service({
    cacheDir: "",
    policyVersion: "test-v4",
    maxTurns: 3,
    now: () => 2000,
  });
  service.seed(signatureInput(), {
    thread: {
      id: "thread-1",
      turns: [{
        id: "turn-full",
        items: [{ id: "user-full", type: "userMessage" }],
      }],
    },
  });

  const changedSignature = signatureInput({
    rolloutStats: { sizeBytes: 4096, mtimeMs: 3000 },
    summaryUpdatedAtMs: 3000,
  });
  const lookedUp = service.lookup(changedSignature);
  assert.equal(lookedUp.cached, null);
  assert.equal(lookedUp.missReason, "static-signature-mismatch");
});

test("v4 projection service lets partial recent windows replace stale full cache", () => {
  const service = createThreadDetailProjectionV4Service({
    cacheDir: "",
    policyVersion: "test-v4",
    maxTurns: 3,
    now: () => 2000,
  });
  service.seed(signatureInput(), {
    thread: {
      id: "thread-1",
      turns: [{
        id: "turn-full",
        items: [{ id: "user-full", type: "userMessage" }],
      }],
    },
  });

  const changedSignature = signatureInput({
    rolloutStats: { sizeBytes: 4096, mtimeMs: 3000 },
    summaryUpdatedAtMs: 3000,
  });
  assert.equal(service.get(changedSignature), null);

  const seeded = service.seed(changedSignature, {
    thread: {
      id: "thread-1",
      turns: [{
        id: "turn-partial",
        items: [{ id: "user-partial", type: "userMessage" }],
      }],
    },
  }, {
    partial: true,
    partialKind: "recent-window",
  });

  assert.equal(seeded.partial, true);
  assert.equal(seeded.version, "v4");
  const cached = service.get(changedSignature, { allowPartial: true });
  assert.ok(cached);
  assert.equal(cached.partial, true);
  assert.deepEqual(cached.result.thread.mobileVisibleItemKeys, ["turn-partial:user:user-partial"]);
});

test("v4 projection service preserves context compaction notices across dynamic refreshes", () => {
  const service = createThreadDetailProjectionV4Service({
    cacheDir: "",
    policyVersion: "test-v4",
    maxTurns: 3,
    now: (() => {
      let current = 5000;
      return () => {
        current += 100;
        return current;
      };
    })(),
  });
  service.seed(signatureInput(), {
    thread: {
      id: "thread-1",
      turns: [{ id: "turn-0", status: { type: "completed" }, items: [] }],
    },
  });

  service.applyNotification("turn/started", {
    threadId: "thread-1",
    turn: { id: "turn-1", status: { type: "active" }, items: [] },
  });
  service.applyNotification("item/started", {
    threadId: "thread-1",
    turnId: "turn-1",
    item: { id: "ctx-1", type: "contextCompaction" },
  });

  let cached = service.get(signatureInput({
    rolloutStats: { sizeBytes: 4096, mtimeMs: 9000 },
    summaryUpdatedAtMs: 5100,
  }));

  let turn = cached.result.thread.turns.find((entry) => entry.id === "turn-1");
  let context = turn.items.find((item) => item.id === "ctx-1");
  assert.equal(cached.dynamic, true);
  assert.equal(context.mobileVisibleKey, "turn-1:contextCompaction");
  assert.equal(context.mobileCompactionStatus, "running");
  assert.equal(context.mobileNotice, CONTEXT_COMPACTION_PENDING_NOTICE);

  service.applyNotification("item/completed", {
    threadId: "thread-1",
    turnId: "turn-1",
    item: { id: "ctx-1", type: "contextCompaction" },
  });
  cached = service.get(signatureInput({
    rolloutStats: { sizeBytes: 4096, mtimeMs: 9000 },
    summaryUpdatedAtMs: 5300,
  }));
  turn = cached.result.thread.turns.find((entry) => entry.id === "turn-1");
  context = turn.items.find((item) => item.id === "ctx-1");
  assert.equal(context.mobileCompactionStatus, "completed");
  assert.equal(context.mobileNotice, CONTEXT_COMPACTION_COMPLETE_NOTICE);
});

test("v4 projection service exposes active overlay snapshot with monotonic revision", () => {
  const service = createThreadDetailProjectionV4Service({
    cacheDir: "",
    policyVersion: "test-v4",
    maxTurns: 3,
    now: () => 6000,
  });

  service.applyNotification("turn/started", {
    threadId: "thread-1",
    turn: { id: "turn-1", status: { type: "active" }, items: [] },
  });
  const first = service.activeOverlaySnapshot({
    threadId: "thread-1",
    activeTurnId: "turn-1",
  });
  assert.equal(first.found, true);
  assert.equal(first.version, "v4");
  assert.equal(first.overlayRevision, 1);
  assert.equal(first.overlayCacheHit, false);

  const warm = service.activeOverlaySnapshot({
    threadId: "thread-1",
    activeTurnId: "turn-1",
  });
  assert.equal(warm.overlayRevision, 1);
  assert.equal(warm.overlayCacheHit, true);
  warm.overlayTurn.items.push({ id: "mutated", type: "agentMessage" });

  const warmAfterMutation = service.activeOverlaySnapshot({
    threadId: "thread-1",
    activeTurnId: "turn-1",
  });
  assert.equal(warmAfterMutation.overlayCacheHit, true);
  assert.deepEqual(warmAfterMutation.overlayTurn.items.map((item) => item.id), []);

  service.applyNotification("item/agentMessage/delta", {
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "agent-1",
    delta: "partial reply",
  });
  const second = service.activeOverlaySnapshot({
    threadId: "thread-1",
    activeTurnId: "turn-1",
  });
  assert.equal(second.overlayRevision, 2);
  assert.equal(second.overlayCacheHit, false);
  assert.equal(second.overlayTurn.items[0].mobileProjectionVersion, "v4");

  const secondWarm = service.activeOverlaySnapshot({
    threadId: "thread-1",
    activeTurnId: "turn-1",
  });
  assert.equal(secondWarm.overlayRevision, 2);
  assert.equal(secondWarm.overlayCacheHit, true);
  assert.equal(secondWarm.overlayTurn.items[0].mobileProjectionVersion, "v4");

  const rawReadOnly = service.activeOverlaySnapshot({
    threadId: "thread-1",
    activeTurnId: "turn-1",
    cloneOverlayTurn: false,
    normalizeOverlayTurn: false,
  });
  assert.equal(rawReadOnly.overlayRevision, 2);
  assert.equal(rawReadOnly.overlayCacheHit, false);
  assert.equal(rawReadOnly.overlayNormalized, false);
  assert.equal(rawReadOnly.overlayTurn, service.activeOverlaySnapshot({
    threadId: "thread-1",
    activeTurnId: "turn-1",
    cloneOverlayTurn: false,
    normalizeOverlayTurn: false,
  }).overlayTurn);
  assert.equal(rawReadOnly.overlayTurn.items[0].mobileProjectionVersion, undefined);

  const readOnlyWarm = service.activeOverlaySnapshot({
    threadId: "thread-1",
    activeTurnId: "turn-1",
    cloneOverlayTurn: false,
  });
  assert.equal(readOnlyWarm.overlayCacheHit, true);
  assert.equal(readOnlyWarm.overlayTurn, service.activeOverlaySnapshot({
    threadId: "thread-1",
    activeTurnId: "turn-1",
    cloneOverlayTurn: false,
  }).overlayTurn);
  assert.notEqual(readOnlyWarm.overlayTurn, service.activeOverlaySnapshot({
    threadId: "thread-1",
    activeTurnId: "turn-1",
  }).overlayTurn);
});

test("v4 projection service treats turn completion as an item-preserving patch", () => {
  const service = createThreadDetailProjectionV4Service({
    cacheDir: "",
    policyVersion: "test-v4",
    maxTurns: 3,
    now: () => 7000,
  });
  service.seed(signatureInput(), {
    thread: {
      id: "thread-1",
      turns: [{
        id: "turn-1",
        status: { type: "active" },
        items: [
          { id: "user-1", type: "userMessage", content: [{ type: "text", text: "continue" }] },
          { id: "agent-1", type: "agentMessage", text: "partial reply" },
          { id: "usage-1", type: "turnUsageSummary", mobileUsageSummary: { totalTokenUsage: { totalTokens: 12 } } },
        ],
      }],
    },
  });

  service.applyNotification("turn/completed", {
    threadId: "thread-1",
    turn: {
      id: "turn-1",
      status: { type: "completed" },
      items: [],
    },
  });

  const cached = service.get(signatureInput({ summaryStatus: "completed", summaryUpdatedAtMs: 7000 }));
  const turn = cached.result.thread.turns.find((entry) => entry.id === "turn-1");
  assert.deepEqual(turn.items.map((item) => item.id), ["user-1", "agent-1", "usage-1"]);
  assert.deepEqual(turn.items.map((item) => item.mobileVisibleKey), [
    "turn-1:user:user-1",
    "turn-1:receipt:agent-1",
    "turn-1:turnUsageSummary",
  ]);
});
