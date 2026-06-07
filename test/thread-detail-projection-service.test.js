"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createThreadDetailProjectionService,
} = require("../adapters/thread-detail-projection-service");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-thread-projection-"));
}

function signatureInput(overrides = {}) {
  return Object.assign({
    threadId: "thread-1",
    rolloutPath: path.join(os.tmpdir(), "rollout-thread-1.jsonl"),
    rolloutStats: {
      sizeBytes: 1024,
      mtimeMs: 1000,
    },
    maxTurns: 2,
    summaryUpdatedAtMs: 1000,
    summaryStatus: "completed",
  }, overrides);
}

test("thread detail projection persists and restores matching warm cache", () => {
  const dir = tempDir();
  try {
    const service = createThreadDetailProjectionService({
      cacheDir: dir,
      policyVersion: "test-v1",
      maxTurns: 2,
      now: () => 2000,
    });
    const result = {
      thread: {
        id: "thread-1",
        turns: [
          { id: "old", items: [{ id: "u-old", type: "userMessage" }] },
          { id: "new", items: [{ id: "u-new", type: "userMessage" }] },
        ],
      },
    };

    service.seed(signatureInput(), result);

    const restoredService = createThreadDetailProjectionService({
      cacheDir: dir,
      policyVersion: "test-v1",
      maxTurns: 2,
      now: () => 3000,
    });
    const cached = restoredService.get(signatureInput());

    assert.ok(cached);
    assert.equal(cached.dynamic, false);
    assert.deepEqual(cached.result.thread.turns.map((turn) => turn.id), ["old", "new"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("thread detail projection misses when rollout signature changes", () => {
  const dir = tempDir();
  try {
    const service = createThreadDetailProjectionService({
      cacheDir: dir,
      policyVersion: "test-v1",
      maxTurns: 2,
      now: () => 2000,
    });
    service.seed(signatureInput(), {
      thread: {
        id: "thread-1",
        turns: [{ id: "turn-1", items: [] }],
      },
    });

    assert.equal(service.get(signatureInput({ rolloutStats: { sizeBytes: 2048, mtimeMs: 1000 } })), null);
    assert.equal(service.get(signatureInput({ summaryUpdatedAtMs: 3000 })), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("thread detail projection updates live intermediate items from notifications", () => {
  const service = createThreadDetailProjectionService({
    cacheDir: "",
    policyVersion: "test-v1",
    maxTurns: 2,
    now: (() => {
      let current = 5000;
      return () => {
        current += 100;
        return current;
      };
    })(),
  });
  service.seed(signatureInput({ summaryStatus: "active" }), {
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
    item: { id: "cmd-1", type: "commandExecution", command: "npm test", status: "running" },
  });
  service.applyNotification("item/commandExecution/outputDelta", {
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "cmd-1",
    delta: "line one\n",
  });
  service.applyNotification("item/reasoning/textDelta", {
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "reason-1",
    delta: "thinking",
  });
  service.applyNotification("item/agentMessage/delta", {
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "agent-1",
    delta: "partial reply",
  });

  const cached = service.get(signatureInput({
    summaryStatus: "active",
    rolloutStats: { sizeBytes: 4096, mtimeMs: 9000 },
    summaryUpdatedAtMs: 5200,
  }));
  assert.ok(cached);
  assert.equal(cached.dynamic, true);
  const turn = cached.result.thread.turns.find((item) => item.id === "turn-1");
  assert.ok(turn);
  const command = turn.items.find((item) => item.id === "cmd-1");
  const reasoning = turn.items.find((item) => item.id === "reason-1");
  const agent = turn.items.find((item) => item.id === "agent-1");
  assert.equal(command.aggregatedOutput, "line one\n");
  assert.equal(reasoning.text, "thinking");
  assert.equal(agent.text, "partial reply");
});

test("thread detail projection does not return unseeded partial notification windows", () => {
  const service = createThreadDetailProjectionService({
    cacheDir: "",
    policyVersion: "test-v1",
    maxTurns: 2,
    now: () => 1000,
  });
  service.applyNotification("turn/started", {
    threadId: "thread-1",
    turn: { id: "turn-1", status: { type: "active" } },
  });

  assert.equal(service.get(signatureInput({ summaryStatus: "active" })), null);
});
