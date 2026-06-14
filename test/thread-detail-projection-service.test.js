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

test("thread detail projection collapses synthetic mobile user echoes", () => {
  const service = createThreadDetailProjectionService({
    cacheDir: "",
    policyVersion: "test-v1",
    maxTurns: 2,
    now: (() => {
      let current = 5400;
      return () => {
        current += 100;
        return current;
      };
    })(),
  });
  service.seed(signatureInput({ summaryStatus: "active" }), {
    thread: {
      id: "thread-1",
      turns: [],
    },
  });

  service.applyNotification("turn/started", {
    threadId: "thread-1",
    turn: { id: "turn-1", status: { type: "active" }, items: [] },
  });
  service.applyNotification("item/completed", {
    threadId: "thread-1",
    turnId: "turn-1",
    item: {
      id: "mux-user-thread-1-turn-1-submission-1",
      type: "userMessage",
      mobilePendingSubmission: true,
      content: [{ type: "text", text: "same message" }],
    },
  });
  service.applyNotification("item/completed", {
    threadId: "thread-1",
    turnId: "turn-1",
    item: {
      id: "real-user-1",
      type: "userMessage",
      content: [{ type: "input_text", text: "same   message" }],
    },
  });

  const cached = service.get(signatureInput({
    summaryStatus: "active",
    rolloutStats: { sizeBytes: 4096, mtimeMs: 9000 },
    summaryUpdatedAtMs: 5700,
  }));
  assert.ok(cached);
  const turn = cached.result.thread.turns.find((item) => item.id === "turn-1");
  const userMessages = turn.items.filter((item) => item.type === "userMessage");
  assert.equal(userMessages.length, 1);
  assert.equal(userMessages[0].id, "real-user-1");
  assert.equal(userMessages[0].mobilePendingSubmission, undefined);
});

test("thread detail projection removes synthetic user echoes shadowed in another turn", () => {
  const service = createThreadDetailProjectionService({
    cacheDir: "",
    policyVersion: "test-v1",
    maxTurns: 3,
    now: (() => {
      let current = 5800;
      return () => {
        current += 100;
        return current;
      };
    })(),
  });
  service.seed(signatureInput({ summaryStatus: "active", maxTurns: 3 }), {
    thread: {
      id: "thread-1",
      turns: [],
    },
  });

  service.applyNotification("turn/started", {
    threadId: "thread-1",
    turn: { id: "turn-1", status: { type: "active" }, items: [] },
  });
  service.applyNotification("item/completed", {
    threadId: "thread-1",
    turnId: "turn-1",
    item: {
      id: "mux-user-thread-1-turn-1-submission-1",
      type: "userMessage",
      mobilePendingSubmission: true,
      content: [{ type: "text", text: "same message" }],
    },
  });
  service.applyNotification("turn/started", {
    threadId: "thread-1",
    turn: {
      id: "turn-2",
      status: { type: "active" },
      items: [{
        id: "real-user-2",
        type: "userMessage",
        content: [{ type: "input_text", text: "same   message" }],
      }],
    },
  });

  const cached = service.get(signatureInput({
    summaryStatus: "active",
    maxTurns: 3,
    rolloutStats: { sizeBytes: 4096, mtimeMs: 9000 },
    summaryUpdatedAtMs: 6100,
  }));
  assert.ok(cached);
  const turn1 = cached.result.thread.turns.find((item) => item.id === "turn-1");
  const turn2 = cached.result.thread.turns.find((item) => item.id === "turn-2");
  assert.deepEqual(turn1.items.filter((item) => item.type === "userMessage"), []);
  assert.equal(turn2.items.filter((item) => item.type === "userMessage").length, 1);
  assert.equal(turn2.items.find((item) => item.type === "userMessage").id, "real-user-2");
});

test("thread detail projection keeps synthetic repeat when matching durable message is earlier", () => {
  const service = createThreadDetailProjectionService({
    cacheDir: "",
    policyVersion: "test-v1",
    maxTurns: 3,
    now: (() => {
      let current = 6800;
      return () => {
        current += 100;
        return current;
      };
    })(),
  });
  service.seed(signatureInput({ summaryStatus: "active", maxTurns: 3 }), {
    thread: {
      id: "thread-1",
      turns: [{
        id: "turn-1",
        status: { type: "completed" },
        items: [{
          id: "real-user-1",
          type: "userMessage",
          content: [{ type: "input_text", text: "repeat   message" }],
        }],
      }],
    },
  });

  service.applyNotification("turn/started", {
    threadId: "thread-1",
    turn: { id: "turn-2", status: { type: "active" }, items: [] },
  });
  service.applyNotification("item/completed", {
    threadId: "thread-1",
    turnId: "turn-2",
    item: {
      id: "mux-user-thread-1-turn-2-submission-2",
      type: "userMessage",
      mobilePendingSubmission: true,
      content: [{ type: "text", text: "repeat message" }],
    },
  });

  const cached = service.get(signatureInput({
    summaryStatus: "active",
    maxTurns: 3,
    rolloutStats: { sizeBytes: 4096, mtimeMs: 9000 },
    summaryUpdatedAtMs: 7100,
  }));
  assert.ok(cached);
  const turn1 = cached.result.thread.turns.find((item) => item.id === "turn-1");
  const turn2 = cached.result.thread.turns.find((item) => item.id === "turn-2");
  assert.equal(turn1.items.filter((item) => item.type === "userMessage").length, 1);
  assert.equal(turn2.items.filter((item) => item.type === "userMessage").length, 1);
  assert.equal(turn2.items.find((item) => item.type === "userMessage").id, "mux-user-thread-1-turn-2-submission-2");
});

test("thread detail projection keeps streamed receipt when completed turn patch is shorter", () => {
  const service = createThreadDetailProjectionService({
    cacheDir: "",
    policyVersion: "test-v1",
    maxTurns: 2,
    now: (() => {
      let current = 6000;
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
  service.applyNotification("item/agentMessage/delta", {
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "agent-1",
    delta: "final receipt text",
  });
  service.applyNotification("turn/completed", {
    threadId: "thread-1",
    turn: {
      id: "turn-1",
      status: { type: "completed" },
      items: [{ id: "user-1", type: "userMessage", text: "question" }],
    },
  });

  const cached = service.get(signatureInput({
    summaryStatus: "completed",
    rolloutStats: { sizeBytes: 4096, mtimeMs: 9000 },
    summaryUpdatedAtMs: 6200,
  }));
  assert.ok(cached);
  const turn = cached.result.thread.turns.find((item) => item.id === "turn-1");
  assert.equal(turn.status.type, "completed");
  assert.equal(turn.items.some((item) => item.id === "agent-1" && item.text === "final receipt text"), true);
});

test("thread detail projection merges replacement receipts and keeps one usage summary", () => {
  const service = createThreadDetailProjectionService({
    cacheDir: "",
    policyVersion: "test-v1",
    maxTurns: 2,
    now: () => 7000,
  });
  service.seed(signatureInput({ summaryStatus: "active" }), {
    thread: {
      id: "thread-1",
      turns: [{
        id: "turn-1",
        status: { type: "active" },
        items: [
          { id: "agent-stream", type: "agentMessage", text: "partial reply" },
          { id: "usage-old", type: "turnUsageSummary", mobileUsageSummary: { totalTokenUsage: { totalTokens: 10 } } },
        ],
      }],
    },
  });

  service.applyNotification("turn/completed", {
    threadId: "thread-1",
    turn: {
      id: "turn-1",
      status: { type: "completed" },
      items: [
        { id: "agent-final", type: "agentMessage", text: "partial reply completed" },
        { id: "usage-new", type: "turnUsageSummary", mobileUsageSummary: { totalTokenUsage: { totalTokens: 20 } } },
      ],
    },
  });

  const cached = service.get(signatureInput({
    summaryStatus: "completed",
    rolloutStats: { sizeBytes: 4096, mtimeMs: 9000 },
    summaryUpdatedAtMs: 7000,
  }));
  assert.ok(cached);
  const turn = cached.result.thread.turns.find((item) => item.id === "turn-1");
  assert.equal(turn.items.filter((item) => item.type === "agentMessage").length, 1);
  assert.equal(turn.items.find((item) => item.type === "agentMessage").text, "partial reply completed");
  assert.equal(turn.items.filter((item) => item.type === "turnUsageSummary").length, 1);
  assert.equal(turn.items.find((item) => item.type === "turnUsageSummary").id, "usage-new");
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
