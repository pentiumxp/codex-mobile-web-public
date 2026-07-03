"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const { createThreadMessageRouteService } = require("../server-routes/thread-message-route-service");

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
