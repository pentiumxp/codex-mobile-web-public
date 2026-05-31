"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  completedTurnHasNoFinalAgentMessage,
  createThreadDisplaySummaryCache,
  resolveThreadTitleForNotification,
  shouldTrackTurnForWebPush,
} = require("../adapters/push-notification-service");
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

test("web push notification titles prefer explicit nested thread names over stale plugin labels", () => {
  const title = resolveThreadTitleForNotification({
    threadId: "thread-main",
    existingTitle: "Post",
    summary: { preview: "First user message preview" },
    params: {
      turn: {
        thread: {
          id: "thread-main",
          title: "Finance Review",
        },
      },
    },
  });

  assert.equal(title, "Finance Review");
});

test("web push notification titles prefer persisted thread names over preview text", () => {
  const title = resolveThreadTitleForNotification({
    threadId: "thread-main",
    summary: {
      name: "Hermes 05-26",
      preview: "Post",
    },
    params: {
      thread: {
        preview: "Post",
      },
    },
  });

  assert.equal(title, "Hermes 05-26");
});

test("web push notification titles prefer display summary over stale observed titles", () => {
  const title = resolveThreadTitleForNotification({
    threadId: "019e63ea-b64f-7e93-a92f-4c1dd9a79326",
    existingTitle: "# 压缩续接启动上下文",
    summary: {
      name: "Codex Mobile 05-26",
      preview: "# 压缩续接启动上下文",
    },
  });

  assert.equal(title, "Codex Mobile 05-26");
});

test("thread display summary cache stores app-server display names before previews", () => {
  const decorated = [];
  const cache = createThreadDisplaySummaryCache({
    ttlMs: 60_000,
    maxEntries: 10,
    decorateSummary(summary) {
      decorated.push(summary.id);
      return Object.assign({ decorated: true }, summary);
    },
  });

  cache.remember({
    id: "thread-main",
    title: "Codex Mobile 05-26",
    preview: "# 压缩续接启动上下文",
    cwd: "C:\\Users\\xuxin\\Documents\\codex-mobile-web",
  });

  const summary = cache.read("thread-main");
  assert.equal(summary.name, "Codex Mobile 05-26");
  assert.equal(summary.preview, "# 压缩续接启动上下文");
  assert.equal(summary.decorated, true);
  assert.ok(decorated.includes("thread-main"));
});

test("thread display summary cache remembers thread/list result arrays", () => {
  const cache = createThreadDisplaySummaryCache({ ttlMs: 60_000, maxEntries: 10 });
  const result = {
    data: [
      { id: "thread-one", name: "One" },
      { id: "thread-two", thread_name: "Two" },
    ],
  };

  assert.equal(cache.rememberList(result), result);
  assert.equal(cache.read("thread-one").name, "One");
  assert.equal(cache.read("thread-two").name, "Two");
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
  assert.match(serverJs, /resolveThreadTitleForNotification/);
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

test("server caches app-server thread display summaries before sqlite push title fallback", () => {
  const serverJs = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const adapterJs = fs.readFileSync(path.join(__dirname, "..", "adapters", "push-notification-service.js"), "utf8");

  assert.match(adapterJs, /function createThreadDisplaySummaryCache\(options = \{\}\)/);
  assert.match(serverJs, /createThreadDisplaySummaryCache/);
  assert.match(serverJs, /const threadDisplaySummaryCache = createThreadDisplaySummaryCache/);
  assert.match(serverJs, /async function resolveCompletedPushThreadTitle\(meta, params\)/);
  assert.match(serverJs, /threadDisplaySummaryCache\.read\(id\)\s*\|\|\s*readStateDbThread\(id\)\s*\|\|\s*readStartedThread\(id\)/);
  assert.match(serverJs, /await readThreadSummaryFromAppServer\(codex, threadId\)/);
  assert.match(serverJs, /return threadDisplaySummaryCache\.remember\(thread\)\s*\|\|\s*annotateThreadRolloutStats\(thread\)/);
  assert.match(serverJs, /threadDisplaySummaryCache\.rememberList\(result\)/);
  assert.match(serverJs, /threadDisplaySummaryCache\.remember\(result\.thread\)/);
  assert.match(serverJs, /sendTurnCompletedPush\(meta, turnId, completedAt, params\)/);
});

test("sqlite command discovery covers WinGet platform-tools installs", () => {
  const home = path.join("C:", "Users", "example");
  const candidates = sqliteCandidates({
    env: {},
    userHome: home,
  });

  assert.ok(candidates.some((candidate) => /WinGet.+Google\.PlatformTools_.+platform-tools.+sqlite3\.exe/i.test(candidate)));
});
