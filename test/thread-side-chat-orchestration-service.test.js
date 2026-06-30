"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createThreadSideChatService,
} = require("../adapters/thread-side-chat-service");
const {
  createThreadSideChatOrchestrationService,
} = require("../adapters/thread-side-chat-orchestration-service");

function tempFile(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-side-chat-orchestration-"));
  return path.join(dir, name);
}

test("side chat orchestration owns hidden read-only sidecar reply flow", async () => {
  const calls = [];
  const rememberedThreads = [];
  const threadSideChatService = createThreadSideChatService({
    storageFile: tempFile("side-chats.json"),
    scopeId: "profile-a",
    idGenerator: (() => {
      let count = 0;
      return (prefix) => `${prefix}_${++count}`;
    })(),
  });
  const user = await threadSideChatService.addMessage("parent-1", {
    role: "user",
    text: "Summarize the risky part.",
  });
  const codex = {
    async request(method, params) {
      calls.push({ method, params });
      if (method === "thread/start") return { threadId: "sidecar-1" };
      if (method === "thread/resume") return { ok: true };
      if (method === "turn/start") return { turnId: "turn-1" };
      if (method === "thread/turns/list" && params.threadId === "parent-1") {
        return {
          data: [{
            id: "parent-turn",
            items: [
              { type: "userMessage", text: "Original question" },
              { type: "assistant", text: "Current implementation status" },
            ],
          }],
        };
      }
      if (method === "thread/turns/list" && params.threadId === "sidecar-1") {
        return {
          data: [{
            id: "turn-1",
            status: { type: "completed" },
            items: [{ type: "assistant", text: "The risky part is server.js ownership." }],
          }],
        };
      }
      throw new Error(`unexpected method ${method}`);
    },
  };
  const service = createThreadSideChatOrchestrationService({
    threadSideChatService,
    codex,
    replyTimeoutMs: 1000,
    threadDetailRpcTimeoutMs: 1000,
    mutationRpcTimeoutMs: 1000,
    readThreadSummary: () => ({ id: "parent-1", cwd: "/workspace/app", name: "Parent thread", model: "gpt-test" }),
    resolveThreadRuntimeSettings: async () => ({
      approvalPolicy: "never",
      permissionProfile: "full",
      sandboxPolicy: { mode: "workspace-write" },
    }),
    readOnlySandboxPolicy: () => ({ mode: "read-only" }),
    applyStartThreadRuntimeSettings: (params, settings) => Object.assign({}, params, { runtimeApprovalPolicy: settings.approvalPolicy }),
    applyResumeRuntimeSettings: (params, settings) => Object.assign({}, params, { runtimeSandboxMode: settings.sandboxMode }),
    applyTurnRuntimeSettings: (params, settings) => Object.assign({}, params, { runtimeSandboxMode: settings.sandboxMode }),
    readStartThreadDeveloperInstructions: () => "Parent developer instructions",
    threadIdFromStartResult: (result) => result.threadId,
    rememberStartedThread: (thread) => rememberedThreads.push(thread),
    itemText: (item) => item.text || "",
    isAssistantReceiptItem: (item) => item && item.type === "assistant",
    isCompletedStatus: (status) => status && status.type === "completed",
    logger: { error() {} },
  });

  const promise = service.startAssistantReply("parent-1", user.message);
  assert.ok(promise);
  await promise;

  const state = threadSideChatService.get("parent-1");
  assert.equal(state.sidecar.status, "idle");
  assert.equal(threadSideChatService.sidecarThreadIdForThread("parent-1"), "sidecar-1");
  assert.equal(state.messages.length, 2);
  assert.equal(state.messages[1].role, "assistant");
  assert.equal(state.messages[1].text, "The risky part is server.js ownership.");
  assert.equal(rememberedThreads.length, 1);
  assert.equal(rememberedThreads[0].agentRole, "side_chat");

  const startCall = calls.find((call) => call.method === "thread/start");
  assert.equal(startCall.params.cwd, "/workspace/app");
  assert.equal(startCall.params.sandbox, "read-only");
  assert.equal(startCall.params.permissionProfile, undefined);
  assert.match(startCall.params.developerInstructions, /Parent developer instructions/);
  assert.match(startCall.params.developerInstructions, /private side chat/);

  const turnStart = calls.find((call) => call.method === "turn/start");
  assert.equal(turnStart.params.threadId, "sidecar-1");
  assert.equal(turnStart.params.cwd, "/workspace/app");
  assert.deepEqual(turnStart.params.sandboxPolicy, { mode: "read-only" });
  assert.match(turnStart.params.input[0].text, /Original question/);
  assert.match(turnStart.params.input[0].text, /Summarize the risky part/);
  assert.equal(calls.some((call) => call.method === "turn/steer"), false);
});

test("side chat orchestration handles queued candidate apply on fresh completion events", () => {
  const applied = [];
  const errors = [];
  const service = createThreadSideChatOrchestrationService({
    threadSideChatService: {
      maybeApplyQueuedCandidate(threadId) {
        applied.push(threadId);
        return Promise.resolve({ ok: true });
      },
    },
    codex: { request: async () => ({}) },
    eventTurnId: (params) => params && params.turnId,
    eventThreadId: (params) => params && params.threadId,
    isOldTurnEvent: (params) => Boolean(params && params.old),
    logger: { error: (message) => errors.push(message) },
  });

  assert.equal(service.maybeApplyQueuedThreadSideChat("turn/started", { threadId: "thread-1", turnId: "turn-1" }), false);
  assert.equal(service.maybeApplyQueuedThreadSideChat("turn/completed", { threadId: "thread-1", turnId: "turn-1", old: true }), false);
  assert.equal(service.maybeApplyQueuedThreadSideChat("turn/completed", { threadId: "thread-1", turnId: "turn-1" }), true);
  assert.deepEqual(applied, ["thread-1"]);
  assert.deepEqual(errors, []);
});
