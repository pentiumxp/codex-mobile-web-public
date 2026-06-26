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

    const changedRollout = signatureInput({ rolloutStats: { sizeBytes: 2048, mtimeMs: 1000 } });
    assert.equal(service.get(changedRollout), null);
    assert.equal(service.lookup(changedRollout).missReason, "static-signature-mismatch");
    const changedSummary = signatureInput({ summaryUpdatedAtMs: 3000 });
    assert.equal(service.get(changedSummary), null);
    assert.equal(service.lookup(changedSummary).missReason, "static-signature-mismatch");
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

test("thread detail projection exposes memory-only active overlay snapshot without promoting notification shell", () => {
  const service = createThreadDetailProjectionService({
    cacheDir: "",
    policyVersion: "test-v1",
    maxTurns: 3,
    now: () => 8000,
  });

  service.applyNotification("turn/started", {
    threadId: "thread-1",
    turn: { id: "turn-1", status: { type: "active" }, items: [] },
  });
  service.applyNotification("item/started", {
    threadId: "thread-1",
    turnId: "turn-1",
    item: { id: "cmd-1", type: "commandExecution", command: "npm test" },
  });

  const lookup = service.lookup(signatureInput({ summaryStatus: "active" }), { allowPartial: true });
  assert.equal(lookup.cached, null);
  assert.equal(lookup.missReason, "partial-not-seeded");

  const snapshot = service.activeOverlaySnapshot({
    threadId: "thread-1",
  });
  assert.equal(snapshot.found, true);
  assert.equal(snapshot.activeTurnId, "turn-1");
  assert.equal(snapshot.overlaySource, "projection-live");
  assert.equal(snapshot.partial, true);
  assert.equal(snapshot.partialKind, "notification-shell");
  assert.deepEqual(snapshot.overlayTurn.items.map((item) => item.id), ["cmd-1"]);

  snapshot.overlayTurn.items.push({ id: "mutated", type: "agentMessage" });
  const secondSnapshot = service.activeOverlaySnapshot({
    threadId: "thread-1",
  });
  assert.deepEqual(secondSnapshot.overlayTurn.items.map((item) => item.id), ["cmd-1"]);
});

test("thread detail projection clears inferred active overlay turn after completion", () => {
  const service = createThreadDetailProjectionService({
    cacheDir: "",
    policyVersion: "test-v1",
    maxTurns: 3,
    now: () => 8500,
  });

  service.applyNotification("turn/started", {
    threadId: "thread-1",
    turn: { id: "turn-1", status: { type: "active" }, items: [] },
  });
  service.applyNotification("turn/completed", {
    threadId: "thread-1",
    turn: { id: "turn-1", status: { type: "completed" }, items: [] },
  });

  assert.deepEqual(service.activeOverlaySnapshot({ threadId: "thread-1" }), {
    found: false,
    reason: "missing-active-turn-id",
  });
});

test("thread detail projection active overlay snapshot rejects non-dynamic static cache", () => {
  const service = createThreadDetailProjectionService({
    cacheDir: "",
    policyVersion: "test-v1",
    maxTurns: 2,
    now: () => 9000,
  });
  service.seed(signatureInput(), {
    thread: {
      id: "thread-1",
      turns: [{ id: "turn-1", status: { type: "active" }, items: [] }],
    },
  });

  assert.deepEqual(service.activeOverlaySnapshot({
    threadId: "thread-1",
    activeTurnId: "turn-1",
  }), {
    found: false,
    reason: "entry-not-dynamic",
  });
});

test("thread detail projection soft-expires completed dynamic cache when rollout signature changes", () => {
  let current = 10000;
  const service = createThreadDetailProjectionService({
    cacheDir: "",
    policyVersion: "test-v1",
    maxTurns: 2,
    now: () => current,
  });
  service.seed(signatureInput({ summaryStatus: "active" }), {
    thread: {
      id: "thread-1",
      turns: [{ id: "turn-1", status: { type: "active" }, items: [] }],
    },
  });
  service.applyNotification("turn/completed", {
    threadId: "thread-1",
    turn: { id: "turn-1", status: { type: "completed" }, items: [] },
  });

  current = 10100;
  assert.equal(service.get(signatureInput({
    summaryStatus: "completed",
    rolloutStats: { sizeBytes: 4096, mtimeMs: 9000 },
    summaryUpdatedAtMs: 1000,
  })), null);
});

test("thread detail projection persists full dynamic cache with refreshed rollout signature", () => {
  const dir = tempDir();
  const rolloutPath = path.join(dir, "rollout-thread-1.jsonl");
  try {
    fs.writeFileSync(rolloutPath, "{\"type\":\"session_meta\"}\n", "utf8");
    fs.utimesSync(rolloutPath, new Date(1), new Date(1));
    const firstStats = fs.statSync(rolloutPath);
    let current = 10000;
    const service = createThreadDetailProjectionService({
      cacheDir: dir,
      policyVersion: "test-v1",
      maxTurns: 2,
      dynamicPersistMinIntervalMs: 0,
      now: () => current,
    });
    service.seed(signatureInput({
      rolloutPath,
      rolloutStats: { sizeBytes: firstStats.size, mtimeMs: Math.trunc(firstStats.mtimeMs) },
      summaryStatus: "active",
      summaryUpdatedAtMs: Math.trunc(firstStats.mtimeMs),
    }), {
      thread: {
        id: "thread-1",
        path: rolloutPath,
        turns: [{ id: "turn-1", status: { type: "active" }, items: [] }],
      },
    });

    fs.appendFileSync(rolloutPath, "{\"type\":\"turn_complete\"}\n", "utf8");
    fs.utimesSync(rolloutPath, new Date(2), new Date(2));
    const secondStats = fs.statSync(rolloutPath);
    current = 11000;
    service.applyNotification("item/completed", {
      threadId: "thread-1",
      turnId: "turn-1",
      item: { id: "agent-1", type: "agentMessage", text: "done" },
    });
    service.applyNotification("turn/completed", {
      threadId: "thread-1",
      turn: { id: "turn-1", status: { type: "completed" }, items: [] },
    });

    current = 12000;
    const restoredService = createThreadDetailProjectionService({
      cacheDir: dir,
      policyVersion: "test-v1",
      maxTurns: 2,
      now: () => current,
    });
    const cached = restoredService.get(signatureInput({
      rolloutPath,
      rolloutStats: { sizeBytes: secondStats.size, mtimeMs: Math.trunc(secondStats.mtimeMs) },
      summaryStatus: "completed",
      summaryUpdatedAtMs: Math.trunc(secondStats.mtimeMs),
    }));

    assert.ok(cached);
    assert.equal(cached.dynamic, true);
    assert.equal(cached.result.thread.turns.length, 1);
    const turn = cached.result.thread.turns[0];
    assert.equal(turn.status.type, "completed");
    assert.ok(turn.items.some((item) => item.id === "agent-1" && item.text === "done"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("thread detail projection soft-expires old active dynamic cache when rollout signature changes", () => {
  let current = 20000;
  const service = createThreadDetailProjectionService({
    cacheDir: "",
    policyVersion: "test-v1",
    maxTurns: 2,
    dynamicSignatureMismatchMaxAgeMs: 1000,
    now: () => current,
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

  current = 20500;
  assert.ok(service.get(signatureInput({
    summaryStatus: "active",
    rolloutStats: { sizeBytes: 4096, mtimeMs: 9000 },
    summaryUpdatedAtMs: 1000,
  })));

  current = 22000;
  assert.equal(service.get(signatureInput({
    summaryStatus: "active",
    rolloutStats: { sizeBytes: 4096, mtimeMs: 9000 },
    summaryUpdatedAtMs: 1000,
  })), null);
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
    summaryUpdatedAtMs: 7000,
  }));
  assert.ok(cached);
  const turn = cached.result.thread.turns.find((item) => item.id === "turn-1");
  assert.equal(turn.items.filter((item) => item.type === "agentMessage").length, 1);
  assert.equal(turn.items.find((item) => item.type === "agentMessage").text, "partial reply completed");
  assert.equal(turn.items.filter((item) => item.type === "turnUsageSummary").length, 1);
  assert.equal(turn.items.find((item) => item.type === "turnUsageSummary").id, "usage-new");
});

test("thread detail projection prunes user-only superseded live shells before trimming", () => {
  const service = createThreadDetailProjectionService({
    cacheDir: "",
    policyVersion: "test-v1",
    maxTurns: 3,
    now: () => 7200,
  });
  service.seed(signatureInput({ summaryStatus: "active", maxTurns: 3 }), {
    thread: {
      id: "thread-1",
      turns: [
        {
          id: "useful-old",
          status: { type: "completed" },
          items: [{ id: "agent-old", type: "agentMessage", text: "older useful receipt" }],
        },
        {
          id: "stale-user-shell-1",
          mobileSupersededLive: true,
          status: { type: "completed", mobileSupersededLive: true, previousType: "inProgress" },
          items: [{ id: "old-user-1", type: "userMessage", text: "old prompt 1" }],
        },
        {
          id: "stale-user-shell-2",
          mobileSupersededLive: true,
          status: { type: "completed", mobileSupersededLive: true, previousType: "inProgress" },
          items: [
            { id: "old-user-2", type: "userMessage", text: "old prompt 2" },
            { id: "reason-old", type: "reasoning", text: "hidden" },
            { id: "usage-old", type: "turnUsageSummary", mobileUsageSummary: { totalTokenUsage: { totalTokens: 1 } } },
          ],
        },
        {
          id: "receipt-superseded",
          mobileSupersededLive: true,
          status: { type: "completed", mobileSupersededLive: true, previousType: "inProgress" },
          items: [
            { id: "old-user-3", type: "userMessage", text: "old prompt 3" },
            { id: "agent-receipt", type: "agentMessage", text: "latest useful receipt" },
            { id: "usage-receipt", type: "turnUsageSummary", mobileUsageSummary: { totalTokenUsage: { totalTokens: 2 } } },
          ],
        },
        {
          id: "latest-live",
          status: { type: "active" },
          items: [{ id: "cmd-live", type: "commandExecution", command: "npm test" }],
        },
      ],
    },
  });

  const cached = service.get(signatureInput({
    summaryStatus: "active",
    maxTurns: 3,
  }));
  assert.ok(cached);
  assert.deepEqual(cached.result.thread.turns.map((turn) => turn.id), [
    "useful-old",
    "receipt-superseded",
    "latest-live",
  ]);
  const superseded = cached.result.thread.turns.find((turn) => turn.id === "receipt-superseded");
  assert.deepEqual(superseded.items.map((item) => item.id), ["agent-receipt", "usage-receipt"]);
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
  assert.equal(service.get(signatureInput({ summaryStatus: "active" }), { allowPartial: true }), null);
  assert.equal(service.lookup(signatureInput({ summaryStatus: "active" }), { allowPartial: true }).missReason, "partial-not-seeded");
});

test("thread detail projection returns partial seed only when explicitly allowed", () => {
  const service = createThreadDetailProjectionService({
    cacheDir: "",
    policyVersion: "test-v1",
    maxTurns: 2,
    now: () => 1000,
  });
  const seeded = service.seed(signatureInput(), {
    thread: {
      id: "thread-1",
      turns: [{ id: "turn-recent", items: [] }],
    },
  }, {
    partial: true,
    partialKind: "recent-window",
  });

  assert.equal(seeded.partial, true);
  assert.equal(seeded.partialKind, "recent-window");
  assert.equal(service.get(signatureInput()), null);
  assert.equal(service.lookup(signatureInput()).missReason, "partial-not-allowed");

  const cached = service.get(signatureInput(), { allowPartial: true });
  assert.ok(cached);
  assert.equal(cached.partial, true);
  assert.equal(cached.partialKind, "recent-window");
  assert.deepEqual(cached.result.thread.turns.map((turn) => turn.id), ["turn-recent"]);
});

test("thread detail projection reports bounded lookup miss reasons", () => {
  const service = createThreadDetailProjectionService({
    cacheDir: "",
    policyVersion: "test-v1",
    maxTurns: 2,
    now: () => 1000,
  });

  assert.deepEqual(service.lookup({}), { cached: null, missReason: "missing-thread-id" });
  assert.equal(service.lookup(signatureInput()).missReason, "entry-missing");
});

test("thread detail projection keeps partial recent windows memory-only", () => {
  const dir = tempDir();
  try {
    const service = createThreadDetailProjectionService({
      cacheDir: dir,
      policyVersion: "test-v1",
      maxTurns: 2,
      now: () => 1000,
    });
    service.seed(signatureInput(), {
      thread: {
        id: "thread-1",
        turns: [{ id: "turn-recent", items: [] }],
      },
    }, {
      partial: true,
      partialKind: "recent-window",
    });

    assert.ok(service.get(signatureInput(), { allowPartial: true }));

    const restoredService = createThreadDetailProjectionService({
      cacheDir: dir,
      policyVersion: "test-v1",
      maxTurns: 2,
      now: () => 2000,
    });
    assert.equal(restoredService.get(signatureInput(), { allowPartial: true }), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("thread detail projection treats cursor-backed turns-list seed as partial", () => {
  const dir = tempDir();
  try {
    const service = createThreadDetailProjectionService({
      cacheDir: dir,
      policyVersion: "test-v1",
      maxTurns: 2,
      now: () => 1000,
    });

    const seeded = service.seed(signatureInput(), {
      thread: {
        id: "thread-1",
        mobileReadMode: "turns-list-large",
        mobileOlderTurnsCursor: "older-cursor",
        mobileNewerTurnsCursor: "newer-cursor",
        turns: [{ id: "turn-window", items: [] }],
      },
    });

    assert.equal(seeded.partial, true);
    assert.equal(seeded.partialKind, "turns-list-window");
    assert.equal(service.get(signatureInput()), null);
    assert.equal(service.lookup(signatureInput()).missReason, "partial-not-allowed");

    const cached = service.get(signatureInput(), { allowPartial: true });
    assert.ok(cached);
    assert.equal(cached.partial, true);
    assert.equal(cached.partialKind, "turns-list-window");
    assert.deepEqual(cached.result.thread.turns.map((turn) => turn.id), ["turn-window"]);

    const restoredService = createThreadDetailProjectionService({
      cacheDir: dir,
      policyVersion: "test-v1",
      maxTurns: 2,
      now: () => 2000,
    });
    assert.equal(restoredService.get(signatureInput(), { allowPartial: true }), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("thread detail projection drops legacy disk cache that persisted a turns-list window as full", () => {
  const dir = tempDir();
  try {
    const service = createThreadDetailProjectionService({
      cacheDir: dir,
      policyVersion: "test-v1",
      maxTurns: 2,
      now: () => 1000,
    });
    service.seed(signatureInput(), {
      thread: {
        id: "thread-1",
        turns: [{ id: "turn-full", items: [] }],
      },
    });

    const files = fs.readdirSync(dir).filter((name) => name.endsWith(".json"));
    assert.equal(files.length, 1);
    const filePath = path.join(dir, files[0]);
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    raw.dynamic = true;
    raw.result.thread.mobileReadMode = "turns-list-large";
    raw.result.thread.mobileOlderTurnsCursor = "older-cursor";
    raw.result.thread.mobileNewerTurnsCursor = "newer-cursor";
    fs.writeFileSync(filePath, `${JSON.stringify(raw)}\n`, "utf8");

    const restoredService = createThreadDetailProjectionService({
      cacheDir: dir,
      policyVersion: "test-v1",
      maxTurns: 2,
      now: () => 2000,
    });

    assert.equal(restoredService.lookup(signatureInput(), { allowPartial: true }).missReason, "entry-missing");
    assert.equal(fs.existsSync(filePath), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("thread detail projection partial seed cannot replace an existing full cache", () => {
  const service = createThreadDetailProjectionService({
    cacheDir: "",
    policyVersion: "test-v1",
    maxTurns: 2,
    now: () => 1000,
  });
  service.seed(signatureInput(), {
    thread: {
      id: "thread-1",
      turns: [{ id: "turn-full", items: [] }],
    },
  });

  const seeded = service.seed(signatureInput(), {
    thread: {
      id: "thread-1",
      turns: [{ id: "turn-partial", items: [] }],
    },
  }, {
    partial: true,
    partialKind: "recent-window",
  });

  assert.equal(seeded.skipped, true);
  assert.equal(seeded.reason, "full-cache-exists");
  assert.equal(seeded.partial, false);

  const cached = service.get(signatureInput(), { allowPartial: true });
  assert.ok(cached);
  assert.equal(cached.partial, false);
  assert.deepEqual(cached.result.thread.turns.map((turn) => turn.id), ["turn-full"]);
});

test("thread detail projection partial seed can replace an unusable stale full cache", () => {
  const service = createThreadDetailProjectionService({
    cacheDir: "",
    policyVersion: "test-v1",
    maxTurns: 2,
    now: () => 1000,
  });
  service.seed(signatureInput(), {
    thread: {
      id: "thread-1",
      turns: [{ id: "turn-stale-full", items: [] }],
    },
  });

  const changedSignature = signatureInput({
    rolloutStats: {
      sizeBytes: 2048,
      mtimeMs: 2000,
    },
    summaryUpdatedAtMs: 2000,
  });
  assert.equal(service.get(changedSignature), null);

  const seeded = service.seed(changedSignature, {
    thread: {
      id: "thread-1",
      turns: [{ id: "turn-partial", items: [] }],
    },
  }, {
    partial: true,
    partialKind: "recent-window",
  });

  assert.equal(seeded.skipped, undefined);
  assert.equal(seeded.partial, true);
  assert.equal(service.get(changedSignature), null);

  const cached = service.get(changedSignature, { allowPartial: true });
  assert.ok(cached);
  assert.equal(cached.partial, true);
  assert.deepEqual(cached.result.thread.turns.map((turn) => turn.id), ["turn-partial"]);
});

test("thread detail projection partial seed deletes unusable stale full cache from disk", () => {
  const dir = tempDir();
  try {
    const service = createThreadDetailProjectionService({
      cacheDir: dir,
      policyVersion: "test-v1",
      maxTurns: 2,
      now: () => 1000,
    });
    service.seed(signatureInput(), {
      thread: {
        id: "thread-1",
        turns: [{ id: "turn-stale-full", items: [] }],
      },
    });

    const changedSignature = signatureInput({
      rolloutStats: {
        sizeBytes: 2048,
        mtimeMs: 2000,
      },
      summaryUpdatedAtMs: 2000,
    });
    assert.equal(service.lookup(changedSignature).missReason, "static-signature-mismatch");

    const seeded = service.seed(changedSignature, {
      thread: {
        id: "thread-1",
        turns: [{ id: "turn-partial", items: [] }],
      },
    }, {
      partial: true,
      partialKind: "recent-window",
    });

    assert.equal(seeded.partial, true);
    assert.equal(seeded.replacedStaleFull, true);
    assert.equal(seeded.staleFullReason, "static-signature-mismatch");
    assert.ok(service.get(changedSignature, { allowPartial: true }));

    const restoredService = createThreadDetailProjectionService({
      cacheDir: dir,
      policyVersion: "test-v1",
      maxTurns: 2,
      now: () => 2000,
    });
    assert.equal(restoredService.get(signatureInput()), null);
    assert.equal(restoredService.get(changedSignature, { allowPartial: true }), null);
    assert.equal(restoredService.lookup(signatureInput()).missReason, "entry-missing");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("thread detail projection partial seed deletes dynamic summary-stale full cache from disk", () => {
  const dir = tempDir();
  try {
    let current = 1000;
    const service = createThreadDetailProjectionService({
      cacheDir: dir,
      policyVersion: "test-v1",
      maxTurns: 2,
      dynamicPersistMinIntervalMs: 0,
      now: () => current,
    });
    service.seed(signatureInput({ summaryStatus: "active", summaryUpdatedAtMs: 1000 }), {
      thread: {
        id: "thread-1",
        turns: [{ id: "turn-dynamic-full", items: [] }],
      },
    });
    current = 1200;
    service.applyNotification("item/completed", {
      threadId: "thread-1",
      turnId: "turn-dynamic-full",
      item: { id: "agent-1", type: "agentMessage", text: "done" },
    });

    const staleInput = signatureInput({
      summaryStatus: "active",
      summaryUpdatedAtMs: 4000,
    });
    assert.equal(service.lookup(staleInput).missReason, "dynamic-summary-stale");

    const seeded = service.seed(staleInput, {
      thread: {
        id: "thread-1",
        turns: [{ id: "turn-partial", items: [] }],
      },
    }, {
      partial: true,
      partialKind: "recent-window",
    });

    assert.equal(seeded.partial, true);
    assert.equal(seeded.replacedStaleFull, true);
    assert.equal(seeded.staleFullReason, "dynamic-summary-stale");
    assert.ok(service.get(staleInput, { allowPartial: true }));

    const restoredService = createThreadDetailProjectionService({
      cacheDir: dir,
      policyVersion: "test-v1",
      maxTurns: 2,
      now: () => 2000,
    });
    assert.equal(restoredService.lookup(staleInput).missReason, "entry-missing");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
