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

    const cached = service.get(signatureInput(), { allowPartial: true });
    assert.ok(cached);
    assert.equal(cached.version, "v4");
    assert.equal(cached.partial, true);
    assert.equal(cached.partialKind, "recent-window");
    assert.equal(cached.result.thread.mobileProjectionVersion, "v4");
    assert.equal(cached.result.thread.mobileProjectionRevision, 1);
    assert.deepEqual(cached.result.thread.mobileVisibleItemKeys, ["turn-recent:user:user-1"]);

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
