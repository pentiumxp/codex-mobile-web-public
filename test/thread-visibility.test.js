"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  isHiddenThread,
  mergeThreadListFallback,
  readRolloutSessionFallbackThreadFromFile,
  sortTurnsChronologically,
  threadMatchesWorkspaceCwd,
} = require("../server");

function normalizeFsPath(value) {
  return String(value || "")
    .replace(/^\\\\\?\\/, "")
    .replace(/[\\/]+/g, "\\")
    .replace(/\\+$/, "")
    .toLowerCase();
}

function visibilityFor(root) {
  return {
    workspaceKeys: new Set([normalizeFsPath(root)]),
    workspaceNames: new Set([path.basename(path.resolve(root))]),
    projectlessThreadIds: new Set(),
  };
}

test("thread visibility allows Codex worktrees for a visible repository root", () => {
  const repoRoot = path.join(os.homedir(), "hermes-webui");
  const worktreeRoot = path.join(os.homedir(), ".codex", "worktrees", "7ebd", "hermes-webui");
  const visibility = visibilityFor(repoRoot);

  assert.equal(isHiddenThread({ id: "thread-1", cwd: worktreeRoot }, visibility), false);
  assert.equal(threadMatchesWorkspaceCwd(worktreeRoot, repoRoot), true);
});

test("thread visibility still hides unrelated Codex worktrees", () => {
  const repoRoot = path.join(os.homedir(), "hermes-webui");
  const worktreeRoot = path.join(os.homedir(), ".codex", "worktrees", "7ebd", "other-project");
  const visibility = visibilityFor(repoRoot);

  assert.equal(isHiddenThread({ id: "thread-1", cwd: worktreeRoot }, visibility), true);
  assert.equal(threadMatchesWorkspaceCwd(worktreeRoot, repoRoot), false);
});

test("archived Codex worktree threads stay hidden", () => {
  const repoRoot = path.join(os.homedir(), "hermes-webui");
  const worktreeRoot = path.join(os.homedir(), ".codex", "worktrees", "7ebd", "hermes-webui");
  const visibility = visibilityFor(repoRoot);

  assert.equal(isHiddenThread({ id: "thread-1", cwd: worktreeRoot, archived: true }, visibility), true);
});

test("thread list merges local fallback threads when app-server list misses them", () => {
  const result = mergeThreadListFallback({
    data: [
      { id: "thread-1", name: "from app-server", preview: "old preview", updatedAt: 100 },
    ],
  }, [
    { id: "thread-2", name: "from state db" },
    { id: "thread-1", name: "duplicate fallback", preview: "new preview", updatedAt: 200 },
  ], 10);

  assert.deepEqual(result.data.map((thread) => thread.id), ["thread-1", "thread-2"]);
  assert.equal(result.data[0].name, "duplicate fallback");
  assert.equal(result.data[0].preview, "new preview");
  assert.equal(result.data[0].updatedAt, 200);
});

test("thread list keeps app-server time when duplicate fallback is older", () => {
  const result = mergeThreadListFallback({
    data: [
      { id: "thread-1", name: "from app-server", updatedAt: 300 },
    ],
  }, [
    { id: "thread-1", name: "older fallback", updatedAt: 200 },
  ], 10);

  assert.equal(result.data[0].name, "older fallback");
  assert.equal(result.data[0].updatedAt, 300);
});

test("rollout session fallback recovers thread summary without state db text columns", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-rollout-fallback-"));
  const threadId = "019e9000-0000-7000-8000-000000000001";
  const rolloutPath = path.join(dir, `rollout-2026-06-04T10-00-00-${threadId}.jsonl`);
  fs.writeFileSync(rolloutPath, [
    JSON.stringify({
      type: "session_meta",
      payload: {
        id: threadId,
        timestamp: "2026-06-04T10:00:01.000Z",
        cwd: "C:\\Users\\xuxin\\Documents\\Agent",
        model: "gpt-5.5",
      },
    }),
    JSON.stringify({
      type: "turn_context",
      cwd: "C:\\Users\\xuxin\\Documents\\Agent",
    }),
  ].join("\n"), "utf8");

  const summary = readRolloutSessionFallbackThreadFromFile(rolloutPath, {
    id: threadId,
    thread_name: "Recovered Thread",
    updated_at: "2026-06-04T10:01:00.000Z",
  });

  assert.equal(summary.id, threadId);
  assert.equal(summary.name, "Recovered Thread");
  assert.equal(summary.cwd, "C:\\Users\\xuxin\\Documents\\Agent");
  assert.equal(summary.path, rolloutPath);
  assert.equal(summary.mobileFallback, true);
  assert.equal(summary.updatedAt, 1780567260);
});

test("thread list route uses rollout-aware fallback aggregator", () => {
  const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
  const routeIndex = serverJs.indexOf('if (url.pathname === "/api/threads" && req.method === "GET")');
  assert.ok(routeIndex >= 0, "missing thread list route");
  const routeBody = serverJs.slice(routeIndex, serverJs.indexOf('const threadRename = url.pathname.match', routeIndex));

  assert.match(serverJs, /function readRolloutSessionFallback\(/);
  assert.match(serverJs, /function readThreadListFallback\(/);
  assert.match(routeBody, /const fallback = readThreadListFallback\(limit, \{ cwd, searchTerm, globalState \}\);/);
});

test("turn sorting uses item timestamps when turn ids are not chronological", () => {
  const sorted = sortTurnsChronologically([
    {
      id: "zz-old-random-id",
      items: [{ type: "agentMessage", startedAtMs: Date.parse("2026-05-31T15:38:56.000Z") }],
    },
    {
      id: "019e7ed2-da22-79b2-b514-eb8970509954",
      items: [{ type: "agentMessage", startedAtMs: Date.parse("2026-05-31T16:16:59.000Z") }],
    },
  ]);

  assert.deepEqual(sorted.map((turn) => turn.id), [
    "zz-old-random-id",
    "019e7ed2-da22-79b2-b514-eb8970509954",
  ]);
});
