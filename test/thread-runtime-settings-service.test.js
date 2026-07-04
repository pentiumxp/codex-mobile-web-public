"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { createThreadRuntimeSettingsService } = require("../services/runtime/thread-runtime-settings-service");
const {
  isFullAccessRuntime,
  normalizeEnumValue,
  normalizePermissionProfile,
  normalizeSandboxPolicy,
  sandboxModeFromPolicy,
} = require("../services/runtime/runtime-permission-policy-service");

function makeService(options = {}) {
  return createThreadRuntimeSettingsService(Object.assign({
    fs,
    modelOptions: ["gpt-5.5", "gpt-5-codex"],
    reasoningEffortOptions: ["low", "medium", "high", "xhigh"],
    codexConfigDefaults: {
      model: "gpt-5.5",
      reasoningEffort: "medium",
      reasoningSummary: "auto",
      modelVerbosity: "medium",
    },
    normalizeEnumValue,
    normalizeSandboxPolicy,
    normalizePermissionProfile,
    isFullAccessRuntime,
    sandboxModeFromPolicy,
  }, options));
}

test("thread runtime settings inherit model and effort from latest rollout context", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-runtime-settings-"));
  const rolloutPath = path.join(tempDir, "rollout.jsonl");
  fs.writeFileSync(
    rolloutPath,
    [
      JSON.stringify({ type: "turn_context", payload: { model: "gpt-5.5", effort: "low" } }),
      JSON.stringify({ type: "turn_context", payload: { model: "gpt-5-codex", reasoning_effort: "high", sandbox_policy: { type: "readOnly" } } }),
      "",
    ].join("\n"),
  );

  const service = makeService({
    readStateDbThread: () => ({ id: "thread-1", path: rolloutPath, model: "gpt-5.5", effort: "medium" }),
  });

  assert.deepEqual(service.readLatestTurnContext({ path: rolloutPath }), {
    model: "gpt-5-codex",
    reasoning_effort: "high",
    sandbox_policy: { type: "readOnly" },
  });
  const settings = service.threadRuntimeSettings("thread-1");
  assert.equal(settings.model, "gpt-5-codex");
  assert.equal(settings.reasoningEffort, "high");
  assert.equal(settings.sandboxMode, "read-only");
});

test("thread runtime settings reuse recent rollout context across active rollout writes", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-runtime-settings-"));
  const rolloutPath = path.join(tempDir, "rollout.jsonl");
  fs.writeFileSync(
    rolloutPath,
    [
      JSON.stringify({ type: "turn_context", payload: { model: "gpt-5-codex", reasoning_effort: "high" } }),
      "",
    ].join("\n"),
  );
  let parseCalls = 0;
  const service = makeService({
    readStateDbThread: () => ({ id: "thread-1", path: rolloutPath, model: "gpt-5.5", effort: "medium" }),
    parseJsonLine: (line) => {
      parseCalls += 1;
      return JSON.parse(line);
    },
  });

  assert.equal(service.threadRuntimeSettings("thread-1").model, "gpt-5-codex");
  assert.equal(parseCalls, 1);

  fs.appendFileSync(rolloutPath, `${JSON.stringify({ type: "event_msg", payload: { message: "stream update" } })}\n`);
  assert.equal(service.threadRuntimeSettings("thread-1").model, "gpt-5-codex");
  assert.equal(parseCalls, 1);
});

test("thread runtime settings fall back through state, app-server, and config defaults", async () => {
  let appServerReads = 0;
  const service = makeService({
    readStateDbThread: (threadId) => (threadId === "state-thread"
      ? { id: threadId, model: "gpt-5-codex", effort: "xhigh" }
      : null),
    readThreadSummaryFromAppServer: async (threadId) => {
      appServerReads += 1;
      return { id: threadId, model: "gpt-5-codex", effort: "low" };
    },
  });

  const stateSettings = await service.resolveThreadRuntimeSettings("state-thread");
  assert.equal(stateSettings.model, "gpt-5-codex");
  assert.equal(stateSettings.reasoningEffort, "xhigh");
  assert.equal(appServerReads, 0);

  const fallbackSettings = await service.resolveThreadRuntimeSettings("remote-thread");
  assert.equal(fallbackSettings.model, "gpt-5-codex");
  assert.equal(fallbackSettings.reasoningEffort, "low");
  assert.equal(appServerReads, 1);

  const defaultSettings = makeService().threadRuntimeSettings("missing-thread");
  assert.equal(defaultSettings.model, "gpt-5.5");
  assert.equal(defaultSettings.reasoningEffort, "medium");
});

test("thread runtime settings convert full access on-request approval to never", () => {
  const service = makeService({
    readStateDbThread: () => ({
      id: "thread-1",
      sandboxPolicy: { type: "dangerFullAccess" },
      permissionProfile: { type: "fullAccess" },
      approvalPolicy: "on-request",
    }),
  });

  const settings = service.threadRuntimeSettings("thread-1");
  assert.equal(settings.approvalPolicy, "never");
});
