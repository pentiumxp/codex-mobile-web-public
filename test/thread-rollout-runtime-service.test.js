"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createThreadRolloutRuntimeService } = require("../services/runtime/thread-rollout-runtime-service");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-rollout-runtime-"));
}

test("thread rollout runtime reads rollout aliases and bounded file stats", () => {
  const root = tempDir();
  const rolloutPath = path.join(root, "thread.jsonl");
  fs.writeFileSync(rolloutPath, "abcde");

  const service = createThreadRolloutRuntimeService({
    fs,
    path,
    rolloutWarningBytes: 5,
  });

  assert.equal(service.rolloutPathForThread({ path: "/a" }), "/a");
  assert.equal(service.rolloutPathForThread({ rolloutPath: "/b" }), "/b");
  assert.equal(service.rolloutPathForThread({ rollout_path: "/c" }), "/c");
  assert.equal(service.rolloutPathForThread(null), "");

  const stats = service.rolloutStatsForPath(rolloutPath);
  assert.equal(stats.sizeBytes, 5);
  assert.equal(stats.warningThresholdBytes, 5);
  assert.equal(stats.overWarningThreshold, true);
  assert.equal(Number.isFinite(stats.mtimeMs), true);
  assert.equal(service.rolloutStatsForPath(path.join(root, "missing.jsonl")), null);
});

test("thread rollout runtime annotates rollout stats without mutating input", () => {
  const service = createThreadRolloutRuntimeService({
    rolloutWarningBytes: 100,
  });
  const input = { id: "thread-a", path: "/tmp/thread-a.jsonl" };
  const output = service.annotateThreadRolloutStats(input, {
    rolloutStatsForPath: () => ({ sizeBytes: 150, mtimeMs: 1234, overWarningThreshold: true }),
  });

  assert.notEqual(output, input);
  assert.equal(input.rolloutSizeBytes, undefined);
  assert.equal(output.rolloutWarningThresholdBytes, 100);
  assert.equal(output.rolloutSizeBytes, 150);
  assert.equal(output.rolloutSizeUpdatedAtMs, 1234);
  assert.equal(output.rolloutOverWarningThreshold, true);

  const existing = service.annotateThreadRolloutStats({
    rolloutSizeBytes: 10,
    rolloutSizeUpdatedAtMs: 99,
  }, { preferExistingRolloutStats: true });
  assert.equal(existing.rolloutSizeBytes, 10);
  assert.equal(existing.rolloutOverWarningThreshold, false);
});

test("thread rollout runtime reports workspace context file sizes", () => {
  const root = tempDir();
  fs.mkdirSync(path.join(root, ".agent-context"));
  fs.writeFileSync(path.join(root, ".agent-context", "PROJECT_CONTEXT.md"), "project");
  fs.writeFileSync(path.join(root, ".agent-context", "HANDOFF.md"), "handoff!");
  fs.writeFileSync(path.join(root, "AGENTS.md"), "agents");

  const service = createThreadRolloutRuntimeService({
    fs,
    path,
    continuationContextFileCompactBytes: 10,
    continuationContextHandoffPromptBytes: 11,
    continuationContextPairCompactBytes: 12,
  });

  assert.deepEqual(service.workspaceContextStatsForCwd(root), {
    projectContextSizeBytes: 7,
    handoffSizeBytes: 8,
    agentsSizeBytes: 6,
    workspaceContextPairSizeBytes: 15,
    fileThresholdBytes: 10,
    handoffPromptThresholdBytes: 11,
    pairThresholdBytes: 12,
  });
  assert.equal(service.workspaceContextStatsForCwd("").workspaceContextPairSizeBytes, 0);
});

test("thread rollout runtime stale preflight inspects durable recent turns", async () => {
  const root = tempDir();
  const rolloutPath = path.join(root, "thread.jsonl");
  fs.writeFileSync(rolloutPath, "{}\n");
  const stat = fs.statSync(rolloutPath);
  let requested = null;
  let detected = null;
  const service = createThreadRolloutRuntimeService({
    fs,
    path,
    staleActiveTurnMs: 180_000,
    terminalIdleActiveTurnMs: 45_000,
    threadDetailRpcTimeoutMs: 12_345,
    nowMs: () => Math.trunc(stat.mtimeMs) + 60_000,
    readStateDbThread: (threadId) => ({ id: threadId, path: rolloutPath }),
    detectStaleActiveTurnForSubmission: (input) => {
      detected = input;
      return { stale: true, reason: "active-turn-superseded" };
    },
  });

  const result = await service.staleActiveTurnPreflight({
    async request(method, params, options) {
      requested = { method, params, options };
      return { turns: [{ id: "turn-new" }, { id: "turn-old" }] };
    },
    pendingServerRequests() {
      return [{ threadId: "thread-a", turnId: "turn-old" }];
    },
  }, "thread-a", "turn-old");

  assert.deepEqual(result, { stale: true, reason: "active-turn-superseded" });
  assert.equal(requested.method, "thread/turns/list");
  assert.deepEqual(requested.params, { threadId: "thread-a", limit: 20, sortDirection: "desc" });
  assert.deepEqual(requested.options, { timeoutMs: 12345, retry: false, resetOnTimeout: false });
  assert.equal(detected.activeTurnId, "turn-old");
  assert.equal(detected.threadId, "thread-a");
  assert.equal(detected.staleMs, 180000);
  assert.equal(detected.terminalIdleMs, 45000);
  assert.equal(detected.rolloutStats.sizeBytes, 3);
  assert.deepEqual(detected.pendingServerRequests, [{ threadId: "thread-a", turnId: "turn-old" }]);
});

test("thread rollout runtime stale preflight stays bounded on missing or recent rollout evidence", async () => {
  const service = createThreadRolloutRuntimeService({
    terminalIdleActiveTurnMs: 45_000,
    nowMs: () => 1000,
  });

  assert.deepEqual(await service.staleActiveTurnPreflight({}, "thread-a", ""), {
    stale: false,
    reason: "no-active-turn",
  });
  assert.deepEqual(await service.staleActiveTurnPreflight({}, "thread-a", "turn-a"), {
    stale: false,
    reason: "no-rollout-stats",
  });
});
