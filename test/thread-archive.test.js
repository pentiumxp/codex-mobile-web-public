"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");
const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");

test("thread long-press action sheet archives instead of using left swipe", () => {
  assert.match(indexHtml, /data-thread-action="archive"/);
  assert.match(appJs, /async function archiveThread\(/);
  assert.match(appJs, /action === "archive"/);
  assert.doesNotMatch(appJs, /data-thread-archive/);
  assert.doesNotMatch(appJs, /beginThreadSwipe/);
  assert.doesNotMatch(appJs, /thread-row-actions/);
  assert.doesNotMatch(appJs, /function startNewThreadFromList\(/);
  assert.doesNotMatch(appJs, /data-new-thread-from-thread/);
});

test("thread long-press action sheet can copy session id", () => {
  assert.match(indexHtml, /data-thread-action="copy-id"/);
  assert.match(indexHtml, /复制 Session ID/);
  assert.match(appJs, /async function copyThreadIdFromActionSheet\(threadId\)/);
  assert.match(appJs, /action === "copy-id"/);
  assert.match(appJs, /copyTextToClipboard\(id\)/);
});

test("archive state merge keeps backup and archived-session filters active", () => {
  const matches = serverJs.match(/function mergeThreadStateFromStateDb\(/g) || [];
  assert.equal(matches.length, 1);
  assert.match(serverJs, /MOBILE_ARCHIVED_THREAD_IDS_FILE/);
  assert.match(serverJs, /createMobileArchiveIndexService/);
  assert.match(serverJs, /function isBackupRolloutPath\(/);
  assert.match(serverJs, /archivedSessionThreadIds\(\)/);
  assert.match(serverJs, /mobileArchiveIndexService\.threadIds\(\)/);
  assert.match(serverJs, /threadHasArchiveSignal\(thread\)/);
  assert.match(serverJs, /isBackupRolloutPath\(row\.rollout_path\)/);
  assert.ok(serverJs.includes("url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/archive$/)"));
});

test("archive route remembers ids in Mobile local archive index", () => {
  assert.match(serverJs, /function rememberMobileArchivedThreadId\(/);
  assert.match(serverJs, /function archivedResultWithMobileIndex\(/);
  assert.match(serverJs, /function alreadyArchivedResult\(/);
  assert.match(serverJs, /function isThreadIdArchivedLocally\(/);
  assert.match(serverJs, /if \(isThreadIdArchivedLocally\(threadId\)\) return alreadyArchivedResult\("mobile-index", threadId, false\);/);
  assert.match(serverJs, /return archivedResultWithMobileIndex\(result, threadId\);/);
  assert.match(serverJs, /return alreadyArchivedResult\("state-db", threadId\);/);
  assert.match(serverJs, /return alreadyArchivedResult\("", threadId\);/);
});

test("projectless session-index fallback skips archived sessions", () => {
  assert.match(serverJs, /function readSessionIndexFallback\(/);
  const start = serverJs.indexOf("function readSessionIndexFallback(");
  const end = serverJs.indexOf("\nfunction ", start + 1);
  const body = serverJs.slice(start, end);
  assert.match(body, /const archivedIds = archivedSessionThreadIds\(\);/);
  assert.match(body, /if \(!entry\.id \|\| !projectlessThreadIds\.has\(entry\.id\)\) continue;/);
  assert.match(body, /if \(archivedIds\.has\(entry\.id\)\) continue;/);
  assert.ok(
    body.indexOf("if (!entry.id || !projectlessThreadIds.has(entry.id)) continue;")
      < body.indexOf("if (archivedIds.has(entry.id)) continue;"),
  );
});

test("thread list hides subagent child threads", () => {
  assert.match(serverJs, /function isSubagentThreadSummary\(/);
  assert.match(serverJs, /agentNickname/);
  assert.match(serverJs, /agentRole/);
  assert.match(serverJs, /isSpawnedChildThread/);
  assert.match(serverJs, /exists\(select 1 from thread_spawn_edges where child_thread_id=threads\.id\) as is_spawned_child/);
  assert.match(serverJs, /if \(isSubagentThreadSummary\(thread\)\) return true;/);
});
