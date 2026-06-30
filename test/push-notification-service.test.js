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
const { createWebPushRuntimeService } = require("../adapters/web-push-runtime-service");
const { sqliteCandidates } = require("../adapters/sqlite-cli");

const webPushRuntimeServiceJs = fs.readFileSync(path.join(__dirname, "..", "adapters", "web-push-runtime-service.js"), "utf8");

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

test("thread display summary cache can skip repeated read decoration", () => {
  const decorated = [];
  const cache = createThreadDisplaySummaryCache({
    ttlMs: 60_000,
    maxEntries: 10,
    decorateOnRead: false,
    decorateSummary(summary) {
      decorated.push(summary.id);
      return Object.assign({ decorated: true }, summary);
    },
  });

  cache.remember({ id: "thread-main", name: "Thread" });
  const first = cache.read("thread-main");
  const second = cache.read("thread-main");
  first.name = "mutated";

  assert.equal(first.decorated, true);
  assert.equal(second.name, "Thread");
  assert.deepEqual(decorated, ["thread-main"]);
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

test("thread display summary cache can merge stale list rows with existing detail", () => {
  const cache = createThreadDisplaySummaryCache({
    ttlMs: 60_000,
    maxEntries: 10,
    mergeSummary(previous, incoming) {
      return Object.assign({}, incoming, {
        status: incoming.status && incoming.status.type === "notLoaded" ? previous.status : incoming.status,
        preview: incoming.preview || previous.preview,
      });
    },
  });

  cache.remember({
    id: "thread-main",
    name: "Live 2 final",
    preview: "real detail",
    status: { type: "completed" },
  });
  cache.rememberList({
    data: [{
      id: "thread-main",
      name: "Live 2 final",
      preview: "",
      status: { type: "notLoaded" },
    }],
  });

  assert.equal(cache.read("thread-main").status.type, "completed");
  assert.equal(cache.read("thread-main").preview, "real detail");
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

test("web push runtime classifies child threads through injected state db lookup", () => {
  const queries = [];
  const service = createWebPushRuntimeService({
    stateDb: "state.sqlite",
    userHome: "/tmp/user",
    fs: { existsSync: () => true },
    runSqliteJson(db, query, options) {
      queries.push({ db, query, options });
      return { ok: true, rows: [{ known: 1, is_child: 1, has_agent_metadata: 0 }] };
    },
    sqlString: (value) => `'${String(value).replace(/'/g, "''")}'`,
  });

  assert.equal(service.classifyThreadId("thread-child"), "subagent");
  assert.equal(queries.length, 1);
  assert.equal(queries[0].db, "state.sqlite");
  assert.match(queries[0].query, /thread_spawn_edges/);
  assert.match(queries[0].query, /child_thread_id/);
  assert.equal(queries[0].options.userHome, "/tmp/user");
});

test("web push runtime handles VAPID and subscription routes", async () => {
  let subscriptions = [];
  const writes = [];
  const setVapidCalls = [];
  const service = createWebPushRuntimeService({
    vapidFile: "vapid.json",
    subscriptionsFile: "subscriptions.json",
    subject: "mailto:test@example.com",
    subjectConfigured: true,
    readJsonFile(file, fallback) {
      if (file === "subscriptions.json") return subscriptions;
      return fallback;
    },
    writeRuntimeJson(file, value) {
      writes.push({ file, value });
      if (file === "subscriptions.json") subscriptions = value;
    },
    webPush: {
      generateVAPIDKeys: () => ({ publicKey: "public-key", privateKey: "private-key" }),
      setVapidDetails: (...args) => setVapidCalls.push(args),
      sendNotification: async () => {},
    },
  });

  const vapidResponses = [];
  await service.handleRoute({
    url: new URL("http://local/api/push/vapid-public-key"),
    method: "GET",
    sendJson: (status, body) => vapidResponses.push({ status, body }),
  });

  assert.equal(vapidResponses[0].status, 200);
  assert.equal(vapidResponses[0].body.publicKey, "public-key");
  assert.equal(vapidResponses[0].body.subject, "mailto:test@example.com");
  assert.equal(setVapidCalls.length, 1);

  const subscribeResponses = [];
  await service.handleRoute({
    url: new URL("http://local/api/push/subscribe"),
    method: "POST",
    req: { headers: { "user-agent": "test-agent" } },
    readBody: async () => ({
      subscription: {
        endpoint: "https://push.example/sub",
        keys: { p256dh: "p256dh", auth: "auth" },
      },
    }),
    sendJson: (status, body) => subscribeResponses.push({ status, body }),
  });

  assert.equal(subscribeResponses[0].status, 200);
  assert.equal(subscribeResponses[0].body.subscriptionCount, 1);
  assert.equal(subscriptions[0].endpoint, "https://push.example/sub");
  assert.equal(subscriptions[0].userAgent, "test-agent");
  assert.ok(writes.some((entry) => entry.file === "subscriptions.json"));

  const unsubscribeResponses = [];
  await service.handleRoute({
    url: new URL("http://local/api/push/unsubscribe"),
    method: "POST",
    readBody: async () => ({ endpoint: "https://push.example/sub" }),
    sendJson: (status, body) => unsubscribeResponses.push({ status, body }),
  });

  assert.equal(unsubscribeResponses[0].status, 200);
  assert.equal(unsubscribeResponses[0].body.subscriptionCount, 0);
  assert.equal(subscriptions.length, 0);
});

test("web push runtime sends a completed-turn notification once after observed start", async () => {
  const sent = [];
  const service = createWebPushRuntimeService({
    vapidFile: "vapid.json",
    subscriptionsFile: "subscriptions.json",
    readJsonFile(file, fallback) {
      if (file === "vapid.json") return { publicKey: "public-key", privateKey: "private-key", subject: "mailto:test@example.com" };
      if (file === "subscriptions.json") {
        return [{
          endpoint: "https://push.example/sub",
          keys: { p256dh: "p256dh", auth: "auth" },
        }];
      }
      return fallback;
    },
    writeRuntimeJson: () => {},
    webPush: {
      generateVAPIDKeys: () => ({ publicKey: "public-key", privateKey: "private-key" }),
      setVapidDetails: () => {},
      sendNotification: async (subscription, payload, options) => {
        sent.push({ subscription, payload: JSON.parse(payload), options });
      },
    },
    fs: { existsSync: () => false },
    pushTurnId: (params) => params.turnId,
    pushThreadId: (params) => params.threadId,
    shouldTrackTurnForWebPush: () => ({ track: true, reason: "" }),
    completedTurnHasNoFinalAgentMessage: () => false,
    resolveThreadTitleForNotification: () => "Thread Title",
    isOldTurnEvent: () => false,
    turnTimestampMs: (params, field) => Number(params[field] || 0),
    shortIdentifier: (value) => `short-${value}`,
    logger: { log: () => {}, error: () => {} },
  });

  service.maybeSendTurnCompletedPush("turn/started", {
    turnId: "turn-1",
    threadId: "thread-1",
    startedAt: 1,
  });
  service.maybeSendTurnCompletedPush("turn/completed", {
    turnId: "turn-1",
    threadId: "thread-1",
    completedAt: 2,
  });
  service.maybeSendTurnCompletedPush("turn/completed", {
    turnId: "turn-1",
    threadId: "thread-1",
    completedAt: 2,
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(sent.length, 1);
  assert.equal(sent[0].payload.threadId, "thread-1");
  assert.equal(sent[0].payload.turnId, "turn-1");
  assert.equal(sent[0].payload.title, "Thread Title");
  assert.equal(sent[0].payload.data.threadId, "thread-1");
  assert.equal(sent[0].options.TTL, 3600);
});

test("server wires web push filtering to thread spawn edges", () => {
  const serverJs = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const pkg = fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8");

  assert.match(serverJs, /shouldTrackTurnForWebPush/);
  assert.match(serverJs, /resolveThreadTitleForNotification/);
  assert.match(serverJs, /classifyWebPushThreadId/);
  assert.match(serverJs, /webPushRuntimeService\.classifyThreadId\(threadId\)/);
  assert.match(serverJs, /const webPushRuntimeService = createWebPushRuntimeService/);
  assert.match(serverJs, /runSqliteJson,\s*sqlString,/);
  assert.doesNotMatch(serverJs, /spawnSync\("sqlite3"/);
  assert.match(webPushRuntimeServiceJs, /thread_spawn_edges/);
  assert.match(webPushRuntimeServiceJs, /child_thread_id/);
  assert.match(webPushRuntimeServiceJs, /agent_nickname/);
  assert.match(webPushRuntimeServiceJs, /agent_role/);
  assert.match(webPushRuntimeServiceJs, /value = "unknown"/);
  assert.match(webPushRuntimeServiceJs, /allowMissingThreadId:\s*true/);
  assert.match(serverJs, /function threadIdFromRolloutPath/);
  assert.match(serverJs, /params && params\.turn && params\.turn\.thread && params\.turn\.thread\.id/);
  assert.match(pkg, /adapters\/sqlite-cli\.js/);
  assert.match(pkg, /adapters\/web-push-runtime-service\.js/);
});

test("server caches app-server thread display summaries before sqlite push title fallback", () => {
  const serverJs = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const threadListRouteServiceJs = fs.readFileSync(path.join(__dirname, "..", "adapters", "thread-list-route-service.js"), "utf8");
  const threadDetailResponsePreparationServiceJs = fs.readFileSync(path.join(__dirname, "..", "services", "thread-detail", "thread-detail-response-preparation-service.js"), "utf8");
  const adapterJs = fs.readFileSync(path.join(__dirname, "..", "adapters", "push-notification-service.js"), "utf8");

  assert.match(adapterJs, /function createThreadDisplaySummaryCache\(options = \{\}\)/);
  assert.match(serverJs, /createThreadDisplaySummaryCache/);
  assert.match(serverJs, /const threadDisplaySummaryCache = createThreadDisplaySummaryCache/);
  assert.match(webPushRuntimeServiceJs, /async function resolveCompletedPushThreadTitle\(meta, params\)/);
  assert.match(webPushRuntimeServiceJs, /threadDisplaySummaryCache\.read\(id\)\s*\|\|\s*readStateDbThread\(id\)\s*\|\|\s*readStartedThread\(id\)/);
  assert.match(webPushRuntimeServiceJs, /await readThreadSummaryFromAppServer\(threadId\)/);
  assert.match(serverJs, /readThreadSummaryFromAppServer: \(threadId\) => readThreadSummaryFromAppServer\(codex, threadId\)/);
  assert.match(serverJs, /return normalizeStaleContextOnlyActiveThread\(threadDisplaySummaryCache\.remember\(thread\)\s*\|\|\s*annotateThreadRolloutStats\(thread\)\)/);
  assert.match(threadListRouteServiceJs, /threadDisplaySummaryCache\.rememberList\(result\)/);
  assert.match(threadDetailResponsePreparationServiceJs, /threadDisplaySummaryCache\.remember\(result\.thread\)/);
  assert.match(webPushRuntimeServiceJs, /sendTurnCompletedPush\(meta, turnId, completedAt, params\)/);
});

test("completed web push payload carries thread ids for notification click routing", () => {
  const swJs = fs.readFileSync(path.join(__dirname, "..", "public", "sw.js"), "utf8");

  assert.match(webPushRuntimeServiceJs, /const payload = \{\s*threadId: meta\.threadId \|\| "",\s*turnId,/);
  assert.match(webPushRuntimeServiceJs, /url: notificationUrlForThread\(meta\.threadId\),/);
  assert.match(webPushRuntimeServiceJs, /threadId: meta\.threadId \|\| "",/);
  assert.match(swJs, /if \(!data\.threadId && payload\.threadId\) data\.threadId = payload\.threadId;/);
  assert.match(swJs, /url\.searchParams\.set\("thread", threadId\);/);
  assert.match(swJs, /self\.clients\.openWindow\(target\.url\)/);
});

test("sqlite command discovery covers WinGet platform-tools installs", () => {
  const home = path.join("C:", "Users", "example");
  const candidates = sqliteCandidates({
    env: {},
    userHome: home,
  });

  assert.ok(candidates.some((candidate) => /WinGet.+Google\.PlatformTools_.+platform-tools.+sqlite3\.exe/i.test(candidate)));
});
