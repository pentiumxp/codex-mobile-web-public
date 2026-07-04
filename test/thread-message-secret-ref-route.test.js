"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createThreadMessageRouteService,
  turnStartRequiresThreadResume,
} = require("../server-routes/thread-message-route-service");

function createRouteHarness(overrides = {}) {
  const requests = [];
  const route = createThreadMessageRouteService(Object.assign({
    codex: {
      request: async (method, params) => {
        requests.push({ method, params });
        if (method === "turn/start") return { turnId: "turn-1" };
        return { ok: true };
      },
      notifyMuxUserMessage: () => {},
    },
    modelOptions: [],
    reasoningEffortOptions: [],
    mutationRpcTimeoutMs: 1000,
    readMessageBody: async () => ({ fields: {}, uploads: [] }),
    buildTurnInput: (text) => String(text || "").trim() ? [{ type: "text", text: String(text || "").trim() }] : [],
    persistExtendedHistoryForUploads: () => false,
    requestedCodexFastMode: () => false,
    truncateSingleLine: (value) => String(value || "").trim(),
    readGlobalState: () => ({}),
    visibilityFromGlobalState: () => ({ workspaceKeys: new Set() }),
    normalizeFsPath: (value) => String(value || ""),
    messageSubmissionKeys: () => ["submission-key"],
    runMessageSubmissionOnce: async (_keys, _uploads, fn) => fn(),
    applyPermissionModeOverride: (settings) => settings,
    readStartThreadDeveloperInstructions: () => "",
    applyStartThreadRuntimeSettings: (params) => params,
    applyTurnRuntimeSettings: (params) => params,
    applyResumeRuntimeSettings: (params) => params,
    applyCodexFastServiceTier: (params) => params,
    threadIdFromStartResult: () => "thread-new",
    rememberProjectlessThreadId: () => false,
    persistThreadTitleToSessionIndex: () => false,
    tryUpdateThreadTitle: async () => false,
    notifyLocalTurnStarted: (_threadId, result) => result.turnId || "turn-1",
    rememberThreadIdForTurnId: () => {},
    rememberStartedThread: (thread) => thread,
    resolveThreadRuntimeSettings: async () => ({}),
    isCodexAccountAuthError: () => false,
    codexAccountAuthErrorPayload: () => ({}),
    logMessageSubmit: () => {},
    staleActiveTurnPreflight: async () => ({ stale: false }),
    pendingSteerEchoStore: { remember: () => "", forget: () => {} },
    isTurnSteerUnsupportedError: () => false,
    isStaleActiveTurnError: () => false,
    autoRecoverThreadTurn: async () => ({}),
  }, overrides));
  return { route, requests };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

test("thread message route accepts secretRef-only metadata as a safe current-task receipt", async () => {
  const { route, requests } = createRouteHarness();
  let response = null;
  const handled = await route.handleRoute({
    url: new URL("http://127.0.0.1/api/threads/thread-1/messages"),
    method: "POST",
    readMessageBody: async () => ({
      fields: {
        secretRef: "sec_message1234567890",
      },
      uploads: [],
    }),
    sendJson: (status, body) => {
      response = { status, body };
    },
  });

  assert.equal(handled.handled, true);
  assert.equal(response.status, 200);
  const turnStart = requests.find((entry) => entry.method === "turn/start");
  assert.ok(turnStart);
  assert.match(turnStart.params.input[0].text, /已收到安全凭据 sec_mess\.\.\.7890，10 分钟内可用于当前任务。/);
  assert.doesNotMatch(turnStart.params.input[0].text, /sec_message1234567890|REAL_PASSWORD_SHOULD_NOT_LEAK/);
  assert.equal(response.body.sensitiveContext.secretRefs[0].id, "sec_mess...7890");
  assert.doesNotMatch(JSON.stringify(response.body), /sec_message1234567890|REAL_PASSWORD_SHOULD_NOT_LEAK/);
});

test("thread message route accepts secretRef attachment metadata without treating it as upload content", async () => {
  const { route, requests } = createRouteHarness();
  let response = null;
  await route.handleRoute({
    url: new URL("http://127.0.0.1/api/threads/thread-1/messages"),
    method: "POST",
    readMessageBody: async () => ({
      fields: {
        text: "Use provided credential.",
        attachments: [
          { type: "secretRef", secretRef: "sec_attach1234567890", targetPlugin: "codex" },
        ],
      },
      uploads: [],
    }),
    sendJson: (status, body) => {
      response = { status, body };
    },
  });

  assert.equal(response.status, 200);
  const turnStart = requests.find((entry) => entry.method === "turn/start");
  assert.match(turnStart.params.input[0].text, /Use provided credential\./);
  assert.match(turnStart.params.input[0].text, /sec_atta\.\.\.7890/);
  assert.doesNotMatch(turnStart.params.input[0].text, /sec_attach1234567890/);
  assert.equal(response.body.sensitiveContext.secretRefs[0].id, "sec_atta...7890");
});

test("thread message route reuses duplicate submissions without resolving runtime settings again", async () => {
  let runtimeResolveCount = 0;
  const { route, requests } = createRouteHarness({
    runMessageSubmissionOnce: async () => ({ turnId: "existing-turn" }),
    resolveThreadRuntimeSettings: async () => {
      runtimeResolveCount += 1;
      throw new Error("runtime settings should not resolve for duplicate submission reuse");
    },
  });
  let response = null;
  await route.handleRoute({
    url: new URL("http://127.0.0.1/api/threads/thread-1/messages"),
    method: "POST",
    readMessageBody: async () => ({
      fields: {
        text: "repeat",
        clientSubmissionId: "client-repeat",
      },
      uploads: [],
    }),
    sendJson: (status, body) => {
      response = { status, body };
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.turnId, "existing-turn");
  assert.equal(runtimeResolveCount, 0);
  assert.deepEqual(requests, []);
});

test("thread message route starts ordinary text turns without blocking on thread resume", async () => {
  const { route, requests } = createRouteHarness();
  let response = null;
  await route.handleRoute({
    url: new URL("http://127.0.0.1/api/threads/thread-1/messages"),
    method: "POST",
    readMessageBody: async () => ({
      fields: {
        text: "hello",
        clientSubmissionId: "client-fast",
      },
      uploads: [],
    }),
    sendJson: (status, body) => {
      response = { status, body };
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(requests.map((entry) => entry.method), ["turn/start"]);
});

test("thread message route resumes and retries once when turn start requires a loaded thread", async () => {
  const requests = [];
  const { route } = createRouteHarness({
    codex: {
      request: async (method, params) => {
        requests.push({ method, params });
        if (method === "turn/start" && requests.filter((entry) => entry.method === "turn/start").length === 1) {
          const err = new Error("thread not loaded; resume thread before starting a turn");
          err.code = "thread_not_loaded";
          throw err;
        }
        if (method === "turn/start") return { turnId: "turn-retry" };
        return { ok: true };
      },
      notifyMuxUserMessage: () => {},
    },
  });
  let response = null;
  await route.handleRoute({
    url: new URL("http://127.0.0.1/api/threads/thread-1/messages"),
    method: "POST",
    readMessageBody: async () => ({
      fields: {
        text: "hello",
        clientSubmissionId: "client-retry",
      },
      uploads: [],
    }),
    sendJson: (status, body) => {
      response = { status, body };
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(requests.map((entry) => entry.method), [
    "turn/start",
    "thread/resume",
    "turn/start",
  ]);
  assert.equal(response.body.turnId, "turn-retry");
});

test("thread message route keeps upload extended-history sends on pre-resume path", async () => {
  const { route, requests } = createRouteHarness({
    persistExtendedHistoryForUploads: (uploads) => uploads.length > 0,
  });
  let response = null;
  await route.handleRoute({
    url: new URL("http://127.0.0.1/api/threads/thread-1/messages"),
    method: "POST",
    readMessageBody: async () => ({
      fields: {
        text: "inspect this",
        clientSubmissionId: "client-upload",
      },
      uploads: [{ id: "upload-1" }],
    }),
    sendJson: (status, body) => {
      response = { status, body };
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(requests.map((entry) => entry.method), ["thread/resume", "turn/start"]);
  assert.equal(requests[0].params.persistExtendedHistory, true);
});

test("thread message route does not classify generic turn-start errors as resume-needed", () => {
  assert.equal(turnStartRequiresThreadResume(new Error("turn rejected because model is unavailable")), false);
  const loaded = new Error("thread already loaded");
  loaded.code = "already_loaded";
  assert.equal(turnStartRequiresThreadResume(loaded), false);
  const unloaded = new Error("thread not loaded");
  unloaded.code = "thread_not_loaded";
  assert.equal(turnStartRequiresThreadResume(unloaded), true);
});

test("thread message route logs bounded phase timings for message submission", async () => {
  const events = [];
  const { route, requests } = createRouteHarness({
    logMessageSubmit: (event, details) => events.push({ event, details }),
  });
  let response = null;
  await route.handleRoute({
    url: new URL("http://127.0.0.1/api/threads/thread-1/messages"),
    method: "POST",
    readMessageBody: async () => ({
      fields: {
        text: "hello",
        clientSubmissionId: "client-timed",
      },
      uploads: [],
    }),
    sendJson: (status, body) => {
      response = { status, body };
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(requests.map((entry) => entry.method), ["turn/start"]);
  const done = events.find((entry) => entry.event === "done");
  assert.ok(done);
  assert.equal(done.details.threadId, "thread-1");
  assert.equal(done.details.clientSubmissionId, "client-timed");
  for (const key of [
    "readMessageMs",
    "bodyReadMs",
    "inputBuildMs",
    "submissionKeyMs",
    "runtimeSettingsMs",
    "threadResumeMs",
    "resumeMs",
    "turnStartInitialMs",
    "turnStartMs",
    "notifyLocalTurnStartedMs",
    "notifyMs",
    "sendJsonMs",
    "dedupeWaitMs",
    "totalMs",
  ]) {
    assert.equal(typeof done.details.timings[key], "number", `missing timing ${key}`);
  }
  assert.equal(done.details.timings.threadResumeMode, "optimistic-turn-start");
  assert.equal(done.details.timings.threadResumeSkipped, true);
});

test("thread message route queues local turn-start notification after replacement turn starts", async () => {
  const backgroundTasks = [];
  const events = [];
  const notified = [];
  const remembered = [];
  const { route, requests } = createRouteHarness({
    scheduleBackgroundTask: (task) => {
      backgroundTasks.push(task);
    },
    logMessageSubmit: (event, details) => events.push({ event, details }),
    notifyLocalTurnStarted: (threadId, result, meta) => {
      notified.push({ threadId, result, meta });
      return result.turnId || "turn-queued";
    },
    rememberThreadIdForTurnId: (threadId, turnId) => remembered.push({ threadId, turnId }),
    codex: {
      request: async (method, params) => {
        requests.push({ method, params });
        if (method === "turn/start") return { turnId: "turn-queued" };
        return { ok: true };
      },
      notifyMuxUserMessage: () => {},
    },
  });
  let response = null;
  await route.handleRoute({
    url: new URL("http://127.0.0.1/api/threads/thread-1/messages"),
    method: "POST",
    readMessageBody: async () => ({
      fields: {
        text: "hello",
        clientSubmissionId: "client-queued-notify",
      },
      uploads: [],
    }),
    sendJson: (status, body) => {
      response = { status, body };
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(requests.map((entry) => entry.method), ["turn/start"]);
  assert.deepEqual(notified, []);
  assert.deepEqual(remembered, [{ threadId: "thread-1", turnId: "turn-queued" }]);
  assert.equal(backgroundTasks.length, 1);
  const done = events.find((entry) => entry.event === "done");
  assert.ok(done);
  assert.equal(done.details.timings.notifyLocalTurnStartedQueued, true);
  assert.equal(typeof done.details.timings.notifyLocalTurnStartedMs, "number");

  await backgroundTasks[0]();
  assert.equal(notified.length, 1);
  assert.deepEqual(notified[0].meta, { source: "message-submit" });
  assert.equal(remembered.length, 2);
  assert.ok(events.find((entry) => entry.event === "notify-done"));
});

test("thread message route default background notification yields until after response", async () => {
  const events = [];
  const notified = [];
  const { route } = createRouteHarness({
    logMessageSubmit: (event, details) => events.push({ event, details }),
    notifyLocalTurnStarted: (threadId, result, meta) => {
      notified.push({ threadId, result, meta });
      return result.turnId || "turn-detached";
    },
    codex: {
      request: async (method) => {
        if (method === "turn/start") return { turnId: "turn-detached" };
        return { ok: true };
      },
      notifyMuxUserMessage: () => {},
    },
  });
  let response = null;
  await route.handleRoute({
    url: new URL("http://127.0.0.1/api/threads/thread-1/messages"),
    method: "POST",
    readMessageBody: async () => ({
      fields: {
        text: "hello",
        clientSubmissionId: "client-detached-notify",
      },
      uploads: [],
    }),
    sendJson: (status, body) => {
      response = { status, body, notifiedBeforeSend: notified.length };
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.notifiedBeforeSend, 0);
  assert.deepEqual(notified, []);
  const done = events.find((entry) => entry.event === "done");
  assert.ok(done);
  assert.equal(done.details.timings.notifyLocalTurnStartedQueued, true);

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(notified.length, 1);
  assert.ok(events.find((entry) => entry.event === "notify-done"));
});

test("thread message route queues slow active-turn steering before turn steer resolves", async () => {
  const steer = deferred();
  const backgroundTasks = [];
  const events = [];
  const remembered = [];
  const notified = [];
  const { route, requests } = createRouteHarness({
    activeTurnSteerFastAcceptMs: 0,
    scheduleBackgroundTask: (task) => {
      backgroundTasks.push(Promise.resolve().then(task));
    },
    codex: {
      request: async (method, params) => {
        requests.push({ method, params });
        if (method === "turn/steer") return steer.promise;
        if (method === "turn/start") return { turnId: "turn-new" };
        return { ok: true };
      },
      notifyMuxUserMessage: (message) => notified.push(message),
    },
    pendingSteerEchoStore: {
      remember: (params) => {
        remembered.push(params);
        return "pending-steer-echo";
      },
      forget: () => {
        throw new Error("pending steer echo should stay until a durable user message appears");
      },
    },
    logMessageSubmit: (event, details) => events.push({ event, details }),
  });

  let response = null;
  await route.handleRoute({
    url: new URL("http://127.0.0.1/api/threads/thread-1/messages"),
    method: "POST",
    readMessageBody: async () => ({
      fields: {
        text: "continue here",
        activeTurnId: "active-turn-1",
        clientSubmissionId: "client-steer-slow",
      },
      uploads: [],
    }),
    sendJson: (status, body) => {
      response = { status, body };
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.steeringQueued, true);
  assert.equal(response.body.turnId, "active-turn-1");
  assert.deepEqual(requests.map((entry) => entry.method), ["turn/steer"]);
  assert.equal(remembered.length, 1);
  assert.equal(notified.length, 0);
  assert.ok(events.some((entry) => entry.event === "steer-queued"));

  steer.resolve({ turnId: "active-turn-1" });
  await Promise.all(backgroundTasks);

  assert.equal(notified.length, 1);
  assert.equal(notified[0].threadId, "thread-1");
  assert.equal(notified[0].turnId, "active-turn-1");
  assert.ok(events.some((entry) => entry.event === "steer-background-done"));
});

test("thread message route defaults active-turn steering to a short fast-accept window", async () => {
  const steer = deferred();
  const events = [];
  const { route } = createRouteHarness({
    codex: {
      request: async (method) => {
        if (method === "turn/steer") return steer.promise;
        if (method === "turn/start") return { turnId: "replacement-turn" };
        return { ok: true };
      },
      notifyMuxUserMessage: () => {},
    },
    pendingSteerEchoStore: {
      remember: () => "pending-steer-echo",
      forget: () => {},
    },
    logMessageSubmit: (event, details) => events.push({ event, details }),
  });
  let response = null;
  const started = Date.now();
  await route.handleRoute({
    url: new URL("http://127.0.0.1/api/threads/thread-1/messages"),
    method: "POST",
    readMessageBody: async () => ({
      fields: {
        text: "follow active",
        activeTurnId: "active-turn-1",
        clientSubmissionId: "client-steer-default",
      },
      uploads: [],
    }),
    sendJson: (status, body) => {
      response = { status, body };
    },
  });
  const elapsedMs = Date.now() - started;

  assert.equal(response.status, 200);
  assert.equal(response.body.steeringQueued, true);
  assert.equal(response.body.turnId, "active-turn-1");
  assert.ok(elapsedMs < 300, `default queued steer should return quickly, elapsed=${elapsedMs}`);
  assert.ok(events.some((entry) => entry.event === "steer-queued"));

  steer.resolve({ turnId: "active-turn-1" });
  await new Promise((resolve) => setImmediate(resolve));
});

test("thread message route does not block active-turn send on slow stale preflight", async () => {
  const preflight = deferred();
  const steer = deferred();
  const backgroundTasks = [];
  const events = [];
  const { route, requests } = createRouteHarness({
    activeTurnPreflightFastAcceptMs: 0,
    activeTurnSteerFastAcceptMs: 0,
    scheduleBackgroundTask: (task) => {
      backgroundTasks.push(task);
    },
    staleActiveTurnPreflight: async () => preflight.promise,
    codex: {
      request: async (method, params) => {
        requests.push({ method, params });
        if (method === "turn/steer") return steer.promise;
        if (method === "turn/start") return { turnId: "turn-new" };
        return { ok: true };
      },
      notifyMuxUserMessage: () => {},
    },
    pendingSteerEchoStore: {
      remember: () => "pending-steer-echo",
      forget: () => {},
    },
    logMessageSubmit: (event, details) => events.push({ event, details }),
  });

  let response = null;
  await route.handleRoute({
    url: new URL("http://127.0.0.1/api/threads/thread-1/messages"),
    method: "POST",
    readMessageBody: async () => ({
      fields: {
        text: "continue while preflight is slow",
        activeTurnId: "active-turn-1",
        clientSubmissionId: "client-preflight-slow",
      },
      uploads: [],
    }),
    sendJson: (status, body) => {
      response = { status, body };
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.steeringQueued, true);
  assert.equal(response.body.turnId, "active-turn-1");
  assert.deepEqual(requests.map((entry) => entry.method), ["turn/steer"]);
  assert.ok(events.some((entry) => entry.event === "active-turn-stale-preflight-queued"));
  assert.ok(events.some((entry) => entry.event === "steer-queued"));
  assert.equal(backgroundTasks.length, 2);
});

test("thread message route starts a replacement turn when queued active-turn steering becomes stale", async () => {
  const steer = deferred();
  const backgroundTasks = [];
  const events = [];
  const notifiedTurns = [];
  const { route, requests } = createRouteHarness({
    activeTurnSteerFastAcceptMs: 0,
    scheduleBackgroundTask: (task) => {
      backgroundTasks.push(Promise.resolve().then(task));
    },
    codex: {
      request: async (method, params) => {
        requests.push({ method, params });
        if (method === "turn/steer") return steer.promise;
        if (method === "turn/start") return { turnId: "turn-replacement" };
        return { ok: true };
      },
      notifyMuxUserMessage: () => {
        throw new Error("stale steering fallback should not notify the stale active turn");
      },
    },
    notifyLocalTurnStarted: (_threadId, result) => {
      notifiedTurns.push(result.turnId);
      return result.turnId;
    },
    pendingSteerEchoStore: {
      remember: () => "pending-steer-echo",
      forget: () => {
        throw new Error("pending steer echo should stay during successful stale fallback");
      },
    },
    isStaleActiveTurnError: (err) => Boolean(err && err.code === "stale_active_turn"),
    logMessageSubmit: (event, details) => events.push({ event, details }),
  });

  let response = null;
  await route.handleRoute({
    url: new URL("http://127.0.0.1/api/threads/thread-1/messages"),
    method: "POST",
    readMessageBody: async () => ({
      fields: {
        text: "continue in a new turn",
        activeTurnId: "active-turn-stale",
        clientSubmissionId: "client-steer-stale",
      },
      uploads: [],
    }),
    sendJson: (status, body) => {
      response = { status, body };
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.steeringQueued, true);
  assert.deepEqual(requests.map((entry) => entry.method), ["turn/steer"]);

  const staleError = new Error("expected active turn no longer active");
  staleError.code = "stale_active_turn";
  steer.reject(staleError);
  await Promise.all(backgroundTasks);

  assert.deepEqual(requests.map((entry) => entry.method), ["turn/steer", "turn/start"]);
  assert.deepEqual(notifiedTurns, ["turn-replacement"]);
  const fallbackDone = events.find((entry) => entry.event === "steer-background-stale-fallback-done");
  assert.ok(fallbackDone);
  assert.equal(fallbackDone.details.resultTurnId, "turn-replacement");
});
