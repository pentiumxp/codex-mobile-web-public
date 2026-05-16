"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");
const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");

test("thread list swipe action archives instead of starting continuation", () => {
  assert.match(appJs, /data-thread-archive/);
  assert.match(appJs, /function archiveThreadFromList\(/);
  assert.doesNotMatch(appJs, /function startNewThreadFromList\(/);
  assert.doesNotMatch(appJs, /data-new-thread-from-thread/);
});

test("archive state merge keeps backup and archived-session filters active", () => {
  const matches = serverJs.match(/function mergeThreadStateFromStateDb\(/g) || [];
  assert.equal(matches.length, 1);
  assert.match(serverJs, /function isBackupRolloutPath\(/);
  assert.match(serverJs, /archivedSessionThreadIds\(\)/);
  assert.match(serverJs, /isBackupRolloutPath\(row\.rollout_path\)/);
  assert.ok(serverJs.includes("url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/archive$/)"));
});

test("thread list hides subagent child threads", () => {
  assert.match(serverJs, /function isSubagentThreadSummary\(/);
  assert.match(serverJs, /agentNickname/);
  assert.match(serverJs, /agentRole/);
  assert.match(serverJs, /isSpawnedChildThread/);
  assert.match(serverJs, /exists\(select 1 from thread_spawn_edges where child_thread_id=threads\.id\) as is_spawned_child/);
  assert.match(serverJs, /if \(isSubagentThreadSummary\(thread\)\) return true;/);
});
