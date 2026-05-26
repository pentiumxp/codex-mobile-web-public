"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { completedTurnHasNoFinalAgentMessage, shouldTrackTurnForWebPush } = require("../adapters/push-notification-service");
const { sqliteCandidates } = require("../adapters/sqlite-cli");

test("web push tracks normal thread turn completions", () => {
  const decision = shouldTrackTurnForWebPush({
    turnId: "turn-main",
    threadId: "thread-main",
  }, {
    classifyThread: (threadId) => threadId === "thread-main" ? "main" : "unknown",
  });

  assert.deepEqual(decision, { track: true, reason: "" });
});

test("web push skips spawned subagent child threads", () => {
  const decision = shouldTrackTurnForWebPush({
    turnId: "turn-child",
    threadId: "thread-child",
  }, {
    classifyThread: (threadId) => threadId === "thread-child" ? "subagent" : "main",
  });

  assert.deepEqual(decision, { track: false, reason: "subagent-thread" });
});

test("web push skips unknown thread ids instead of sending UUID-title notifications", () => {
  const decision = shouldTrackTurnForWebPush({
    turnId: "turn-child",
    threadId: "019e2df9-d887-7960-bc3f-5bf7a0920d4e",
  }, {
    classifyThread: () => "unknown",
  });

  assert.deepEqual(decision, { track: false, reason: "unknown-thread" });
});

test("web push skips agent metadata threads even without a thread id", () => {
  const decision = shouldTrackTurnForWebPush({
    turnId: "turn-child",
    agentNickname: "Avicenna",
    agentRole: "explorer",
  }, {
    isSubagentThread: () => false,
  });

  assert.deepEqual(decision, { track: false, reason: "subagent-thread-metadata" });
});

test("web push skips completed events when no thread id can be resolved", () => {
  const decision = shouldTrackTurnForWebPush({
    turnId: "turn-without-thread",
  }, {
    isSubagentThread: () => false,
  });

  assert.deepEqual(decision, { track: false, reason: "missing-thread-id" });
});

test("web push recognizes completed turns with explicit missing final agent message", () => {
  assert.equal(completedTurnHasNoFinalAgentMessage({
    turn: {
      id: "turn-without-final",
      last_agent_message: null,
    },
  }), true);
  assert.equal(completedTurnHasNoFinalAgentMessage({
    lastAgentMessage: "",
  }), true);
  assert.equal(completedTurnHasNoFinalAgentMessage({
    turn: {
      id: "turn-with-final",
      lastAgentMessage: { type: "message", role: "assistant" },
    },
  }), false);
  assert.equal(completedTurnHasNoFinalAgentMessage({
    turn: {
      id: "turn-without-explicit-final-field",
    },
  }), false);
});

test("web push may temporarily observe started events before thread id is known", () => {
  const decision = shouldTrackTurnForWebPush({
    turnId: "turn-pending-thread",
  }, {
    allowMissingThreadId: true,
    isSubagentThread: () => false,
  });

  assert.deepEqual(decision, { track: true, reason: "pending-thread-id" });
});

test("web push fails closed when thread classification lookup is unavailable", () => {
  const decision = shouldTrackTurnForWebPush({
    turnId: "turn-main",
    threadId: "thread-main",
  }, {
    classifyThread: () => {
      throw new Error("sqlite unavailable");
    },
  });

  assert.deepEqual(decision, { track: false, reason: "thread-lookup-failed" });
});

test("server wires web push filtering to thread spawn edges", () => {
  const serverJs = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const pkg = fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8");

  assert.match(serverJs, /shouldTrackTurnForWebPush/);
  assert.match(serverJs, /classifyWebPushThreadId/);
  assert.match(serverJs, /classifyThread:\s*classifyWebPushThreadId/);
  assert.match(serverJs, /runSqliteJson/);
  assert.doesNotMatch(serverJs, /spawnSync\("sqlite3"/);
  assert.match(serverJs, /thread_spawn_edges/);
  assert.match(serverJs, /child_thread_id/);
  assert.match(serverJs, /agent_nickname/);
  assert.match(serverJs, /agent_role/);
  assert.match(serverJs, /value = "unknown"/);
  assert.match(serverJs, /allowMissingThreadId:\s*true/);
  assert.match(serverJs, /function threadIdFromRolloutPath/);
  assert.match(serverJs, /params && params\.turn && params\.turn\.thread && params\.turn\.thread\.id/);
  assert.match(pkg, /adapters\/sqlite-cli\.js/);
});

test("sqlite command discovery covers WinGet platform-tools installs", () => {
  const home = path.join("C:", "Users", "example");
  const candidates = sqliteCandidates({
    env: {},
    userHome: home,
  });

  assert.ok(candidates.some((candidate) => /WinGet.+Google\.PlatformTools_.+platform-tools.+sqlite3\.exe/i.test(candidate)));
});
