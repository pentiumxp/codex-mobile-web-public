"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createAutoTurnRecoveryService,
  turnStartResultTurnId,
} = require("../adapters/auto-turn-recovery-service");

function statusError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function baseDeps(overrides = {}) {
  return Object.assign({
    applyPermissionModeOverride: (settings) => settings,
    applyResumeRuntimeSettings: (params) => params,
    applyTurnRuntimeSettings: (params) => params,
    cooldownMs: 30000,
    httpStatusError: statusError,
    isLiveTurn: (turn) => turn && turn.status && turn.status.type === "active",
    isStaleActiveTurnError: (err) => err && err.code === "stale_active_turn",
    isTurnSteerUnsupportedError: (err) => err && err.code === "turn_steer_unsupported",
    mutationRpcTimeoutMs: 120000,
    notifyLocalTurnStarted: () => "",
    now: () => 1000,
    prompt: "继续当前任务。",
    readRpcTimeoutMs: 12000,
    resolveThreadRuntimeSettings: async () => ({ model: "gpt-5.5" }),
    turnIdentifier: (turn) => String(turn && (turn.id || turn.turnId) || ""),
    turnListFromResult: (result) => result.data || [],
  }, overrides);
}

test("turnStartResultTurnId accepts known app-server result shapes", () => {
  assert.equal(turnStartResultTurnId({ turnId: "a" }), "a");
  assert.equal(turnStartResultTurnId({ id: "b" }), "b");
  assert.equal(turnStartResultTurnId({ turn: { id: "c" } }), "c");
  assert.equal(turnStartResultTurnId(null), "");
});

test("auto recovery steers a live turn and cooldowns repeated recovery", async () => {
  const calls = [];
  const muxMessages = [];
  const service = createAutoTurnRecoveryService(baseDeps({
    codex: {
      async request(method, params, options) {
        calls.push({ method, params, options });
        if (method === "thread/turns/list") {
          return { data: [{ id: "turn-live", status: { type: "active" } }] };
        }
        if (method === "turn/steer") return { ok: true };
        throw new Error(`unexpected ${method}`);
      },
      notifyMuxUserMessage(message) {
        muxMessages.push(message);
      },
    },
  }));

  const result = await service.autoRecoverThreadTurn("thread-1", { wasRunning: true });
  assert.deepEqual(result, { recovered: true, action: "steered", threadId: "thread-1", turnId: "turn-live" });
  assert.deepEqual(calls.map((call) => call.method), ["thread/turns/list", "turn/steer"]);
  assert.equal(muxMessages.length, 1);
  assert.equal(muxMessages[0].turnId, "turn-live");

  const cooldown = await service.autoRecoverThreadTurn("thread-1", { wasRunning: true });
  assert.deepEqual(cooldown, {
    skipped: true,
    reason: "cooldown",
    threadId: "thread-1",
    action: "steered",
    turnId: "turn-live",
  });
  assert.deepEqual(calls.map((call) => call.method), ["thread/turns/list", "turn/steer"]);
});

test("auto recovery resumes and starts a replacement turn when steering is stale", async () => {
  const calls = [];
  const service = createAutoTurnRecoveryService(baseDeps({
    codex: {
      async request(method, params, options) {
        calls.push({ method, params, options });
        if (method === "thread/turns/list") {
          return { data: [{ id: "turn-stale", status: { type: "active" } }] };
        }
        if (method === "turn/steer") {
          const err = new Error("stale active turn");
          err.code = "stale_active_turn";
          throw err;
        }
        if (method === "thread/resume") return { ok: true };
        if (method === "turn/start") return { turnId: "turn-new" };
        throw new Error(`unexpected ${method}`);
      },
      notifyMuxUserMessage() {},
    },
    notifyLocalTurnStarted(threadId, result, meta) {
      assert.equal(threadId, "thread-2");
      assert.equal(result.turnId, "turn-new");
      assert.equal(meta.source, "auto-turn-recovery");
      return "turn-new";
    },
  }));

  const result = await service.autoRecoverThreadTurn("thread-2", { activeTurnId: "turn-stale", cwd: "/repo" });
  assert.deepEqual(result, { recovered: true, action: "started", threadId: "thread-2", turnId: "turn-new" });
  assert.deepEqual(calls.map((call) => call.method), [
    "thread/turns/list",
    "turn/steer",
    "thread/resume",
    "turn/start",
  ]);
  assert.equal(calls[2].params.cwd, "/repo");
  assert.equal(calls[3].params.cwd, "/repo");
});
