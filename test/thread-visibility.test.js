"use strict";

const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  isHiddenThread,
  mergeThreadListFallback,
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
      { id: "thread-1", name: "from app-server" },
    ],
  }, [
    { id: "thread-2", name: "from state db" },
    { id: "thread-1", name: "duplicate fallback" },
  ], 10);

  assert.deepEqual(result.data.map((thread) => thread.id), ["thread-1", "thread-2"]);
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
