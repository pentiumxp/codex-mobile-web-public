"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { test } = require("node:test");

const {
  isSemanticPluginDeployment,
  taskCardThreadCallIdempotencyKey,
  taskCardThreadCallSeedObject,
} = require("../services/task-cards/task-card-idempotency-service");

function stableTextHash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}

const helpers = {
  stableTextHash,
  normalizeReasoningEffort: (value) => String(value || "").trim().toLowerCase(),
  normalizeWorkflowMode: (value) => {
    const mode = String(value || "").trim().toLowerCase();
    return mode === "autonomous" ? "autonomous" : "manual";
  },
};

test("explicit task-card idempotency key wins", () => {
  const key = taskCardThreadCallIdempotencyKey("source-a", {
    idempotencyKey: "explicit-key",
    requestId: "request-a",
    cardKind: "plugin_deployment",
    pluginId: "codex-mobile-web",
    title: "Deploy",
    body: "Deploy ref abc",
  }, ["deploy-lane"], helpers);

  assert.equal(key, "explicit-key");
});

test("ordinary thread-call request ids remain independent idempotency seeds", () => {
  const base = {
    title: "Repair Music",
    body: "Repair source permissions",
    workflowMode: "autonomous",
  };

  const first = taskCardThreadCallIdempotencyKey("source-a", Object.assign({}, base, { requestId: "request-a" }), ["target-a"], helpers);
  const second = taskCardThreadCallIdempotencyKey("source-a", Object.assign({}, base, { requestId: "request-b" }), ["target-a"], helpers);

  assert.notEqual(first, second);
});

test("routine plugin deployment idempotency ignores caller request id", () => {
  const base = {
    cardKind: "plugin_deployment",
    pluginId: "codex-mobile-web",
    title: "Deploy Codex Mobile",
    body: "Deploy source ref fd39e541 for reason runtime-boundary-fix",
    workflowMode: "autonomous",
  };

  const dynamicToolKey = taskCardThreadCallIdempotencyKey("source-a", Object.assign({}, base, { requestId: "dynamic-tool-call" }), ["deploy-lane"], helpers);
  const fallbackScriptKey = taskCardThreadCallIdempotencyKey("source-a", Object.assign({}, base, { requestId: "fallback-script-retry" }), ["deploy-lane"], helpers);

  assert.equal(dynamicToolKey, fallbackScriptKey);
  assert.ok(isSemanticPluginDeployment(base));
});

test("routine plugin deployment idempotency still changes across deployment intent", () => {
  const base = {
    cardKind: "plugin_deployment",
    pluginId: "codex-mobile-web",
    title: "Deploy Codex Mobile",
    workflowMode: "autonomous",
    requestId: "operator-retry",
  };

  const first = taskCardThreadCallIdempotencyKey("source-a", Object.assign({}, base, {
    body: "Deploy source ref fd39e541 for reason runtime-boundary-fix",
  }), ["deploy-lane"], helpers);
  const second = taskCardThreadCallIdempotencyKey("source-a", Object.assign({}, base, {
    body: "Deploy source ref a458aa3d for reason task-card-store-serialization",
  }), ["deploy-lane"], helpers);
  const otherPlugin = taskCardThreadCallIdempotencyKey("source-a", Object.assign({}, base, {
    pluginId: "movie",
    body: "Deploy source ref fd39e541 for reason runtime-boundary-fix",
  }), ["deploy-lane"], helpers);

  assert.notEqual(first, second);
  assert.notEqual(first, otherPlugin);
});

test("task-card thread-call seed normalizes target set for semantic retries", () => {
  const body = {
    cardKind: "plugin_deployment",
    pluginId: "movie",
    title: "Deploy Movie",
    body: "Deploy source ref e2bd4b2",
  };

  assert.deepEqual(
    taskCardThreadCallSeedObject(body, ["lane-b", "lane-a", "lane-b"], helpers).targetThreadIds,
    ["lane-a", "lane-b"],
  );
});
