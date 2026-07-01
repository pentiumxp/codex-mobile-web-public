"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createChatGptProRouteService,
} = require("../server-routes/chatgpt-pro-route-service");
const {
  createEventStreamRouteService,
} = require("../server-routes/event-stream-route-service");
const {
  createThreadContinuationRouteService,
} = require("../server-routes/thread-continuation-route-service");
const {
  createThreadManagementRouteService,
} = require("../server-routes/thread-management-route-service");
const {
  createWorkspaceRouteService,
} = require("../server-routes/workspace-route-service");

function routeUrl(path) {
  return new URL(path, "http://127.0.0.1:8787");
}

test("api boundary adapters re-export canonical route services", () => {
  assert.equal(
    require("../adapters/workspace-route-service").createWorkspaceRouteService,
    require("../server-routes/workspace-route-service").createWorkspaceRouteService,
  );
  assert.equal(
    require("../adapters/thread-continuation-route-service").createThreadContinuationRouteService,
    require("../server-routes/thread-continuation-route-service").createThreadContinuationRouteService,
  );
  assert.equal(
    require("../adapters/chatgpt-pro-route-service").createChatGptProRouteService,
    require("../server-routes/chatgpt-pro-route-service").createChatGptProRouteService,
  );
  assert.equal(
    require("../adapters/thread-management-route-service").createThreadManagementRouteService,
    require("../server-routes/thread-management-route-service").createThreadManagementRouteService,
  );
  assert.equal(
    require("../adapters/event-stream-route-service").createEventStreamRouteService,
    require("../server-routes/event-stream-route-service").createEventStreamRouteService,
  );
});

test("workspace route keeps list/register behavior and trust sync", async () => {
  const calls = [];
  const sent = [];
  const service = createWorkspaceRouteService({
    CODEX_HOME: "/tmp/codex-home",
    listWorkspaces: async () => [{ cwd: "/repo" }],
    workspaceRegistryService: {
      create() {
        throw new Error("create should not be called for existing workspace");
      },
      registerExisting(body) {
        calls.push(["registerExisting", body.cwd]);
        return { ok: true, cwd: body.cwd };
      },
    },
    syncRegisteredWorkspaceTrust(codexHome) {
      calls.push(["trust", codexHome]);
    },
    syncKnownCodexMobileMcpToolsets() {
      calls.push(["mcp"]);
    },
  });

  assert.deepEqual(await service.handleRoute({
    url: routeUrl("/api/workspaces"),
    method: "GET",
    sendJson: (status, body) => sent.push({ status, body }),
  }), { handled: true, status: 200, body: { data: [{ cwd: "/repo" }] } });

  await service.handleRoute({
    url: routeUrl("/api/workspaces"),
    method: "POST",
    readBody: async () => ({ cwd: "/repo" }),
    sendJson: (status, body) => sent.push({ status, body }),
  });

  assert.deepEqual(calls, [
    ["registerExisting", "/repo"],
    ["trust", "/tmp/codex-home"],
    ["mcp"],
  ]);
  assert.deepEqual(sent.at(-1), { status: 200, body: { ok: true, cwd: "/repo" } });
});

test("continuation route creates and reads public jobs", async () => {
  const service = createThreadContinuationRouteService({
    createContinuationJob: (body) => ({ id: "job-1", body }),
    publicContinuationJob: (job) => ({ id: job.id, public: true }),
    pruneContinuationJobs: () => {},
    getContinuationJob: (id) => id === "job-1" ? { id } : null,
  });
  const sent = [];

  await service.handleRoute({
    url: routeUrl("/api/thread-continuations"),
    method: "POST",
    readBody: async () => ({ threadId: "t1" }),
    sendJson: (status, body) => sent.push({ status, body }),
  });
  await service.handleRoute({
    url: routeUrl("/api/thread-continuations/job-1"),
    method: "GET",
    sendJson: (status, body) => sent.push({ status, body }),
  });
  await service.handleRoute({
    url: routeUrl("/api/thread-continuations/missing"),
    method: "GET",
    sendJson: (status, body) => sent.push({ status, body }),
  });

  assert.deepEqual(sent, [
    { status: 202, body: { id: "job-1", public: true } },
    { status: 200, body: { id: "job-1", public: true } },
    { status: 404, body: { error: "Continuation job not found" } },
  ]);
});

test("chatgpt pro route preserves planner and generate response shapes", async () => {
  const service = createChatGptProRouteService({
    chatGptProBridgeService: {
      status: () => ({ running: false }),
      isRequestText: (text) => text.startsWith("@ChatGPT Pro"),
      start: async (body) => ({ ok: true, prompt: body.prompt, sourceSummary: body.sourceSummary }),
    },
    chatGptProPlannerService: {
      status: () => ({ ok: true }),
      listPlannerArtifacts: (input) => ({ ok: true, input }),
      createPlannerArtifact: (body) => ({ id: "artifact-1", body }),
      readPlannerArtifact: ({ id }) => ({ id }),
    },
    chatGptProMcpService: {
      status: () => ({ configured: true }),
    },
    chatGptProSourceSummary: async () => ({ kind: "test" }),
  });
  const sent = [];

  await service.handleRoute({
    url: routeUrl("/api/chatgpt-pro/generate"),
    method: "POST",
    readBody: async () => ({ prompt: "plain" }),
    sendJson: (status, body) => sent.push({ status, body }),
  });
  await service.handleRoute({
    url: routeUrl("/api/chatgpt-pro/generate"),
    method: "POST",
    readBody: async () => ({ prompt: "@ChatGPT Pro plan" }),
    sendJson: (status, body) => sent.push({ status, body }),
  });
  await service.handleRoute({
    url: routeUrl("/api/chatgpt-pro/planner/artifacts/a%2Fb"),
    method: "GET",
    sendJson: (status, body) => sent.push({ status, body }),
  });

  assert.deepEqual(sent, [
    { status: 400, body: { ok: false, error: "Use @ChatGPT Pro to start a ChatGPT Pro bridge request." } },
    { status: 202, body: { ok: true, prompt: "@ChatGPT Pro plan", sourceSummary: { kind: "test" } } },
    { status: 200, body: { id: "a/b" } },
  ]);
});

test("thread management route preserves rename fallback and turns list behavior", async () => {
  const remembered = [];
  const service = createThreadManagementRouteService({
    MAX_THREAD_TURNS: 25,
    READ_RPC_TIMEOUT_MS: 1234,
    archiveThreadId: async () => ({ archived: true }),
    visibilityFromGlobalState: () => ({ archived: [] }),
    setThreadGoal: async (threadId, body) => ({ ok: true, threadId, body }),
    runThreadGoalAction: async (threadId, body) => ({ ok: true, threadId, action: body.action }),
    tryUpdateThreadTitle: async () => {
      const err = new Error("temporary title failure");
      err.statusCode = 503;
      throw err;
    },
    isRecoverableThreadTitleUpdateError: () => true,
    persistThreadTitleToSessionIndex: () => true,
    readStartedThread: () => null,
    readRolloutSessionFallbackThread: () => ({ id: "thread-1", status: { type: "done" } }),
    rememberStartedThread: (thread) => remembered.push(thread),
    readStateDbThread: () => ({ id: "thread-1", name: "Old" }),
    parseThreadTurnsCursor: (value) => value ? { token: value } : null,
    compactTurnsListResult: (result, context) => ({ ok: true, result, context }),
    codex: {
      request: async (method, params, options) => ({ method, params, options }),
    },
  });
  const sent = [];

  await service.handleRoute({
    url: routeUrl("/api/threads/thread-1/name"),
    method: "PATCH",
    readBody: async () => ({ name: "New title" }),
    sendJson: (status, body) => sent.push({ status, body }),
  });
  await service.handleRoute({
    url: routeUrl("/api/threads/thread-1/turns?limit=200&cursor=abc&sortDirection=desc"),
    method: "GET",
    sendJson: (status, body) => sent.push({ status, body }),
  });

  assert.equal(remembered.length, 1);
  assert.equal(remembered[0].name, "New title");
  assert.deepEqual(sent[0], {
    status: 200,
    body: {
      ok: true,
      threadId: "thread-1",
      name: "New title",
      titleUpdated: false,
      titleIndexed: true,
      warning: "Thread rename was stored in the Mobile fallback index; app-server title update is temporarily unavailable.",
    },
  });
  assert.equal(sent[1].status, 200);
  assert.equal(sent[1].body.result.method, "thread/turns/list");
  assert.deepEqual(sent[1].body.result.params, {
    threadId: "thread-1",
    limit: 100,
    sortDirection: "desc",
    cursor: { token: "abc" },
  });
  assert.deepEqual(sent[1].body.result.options, { timeoutMs: 1234, retry: false, resetOnTimeout: false });
});

test("event stream route keeps unauthorized response bounded", () => {
  let sent = null;
  const service = createEventStreamRouteService({
    isAuthorized: () => false,
    sendJson: (_res, status, body) => {
      sent = { status, body };
    },
  });

  service.handleEvents({}, {});

  assert.deepEqual(sent, { status: 401, body: { error: "Unauthorized" } });
});
