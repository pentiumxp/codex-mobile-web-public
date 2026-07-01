"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { readFrontendSources } = require("./frontend-source-helper");

const appJs = readFrontendSources(path.resolve(__dirname, ".."));
const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");
const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const apiDispatchRouteServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "server-routes", "api-dispatch-route-service.js"), "utf8");
const threadManagementRouteServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "server-routes", "thread-management-route-service.js"), "utf8");
const threadVisibilityServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-visibility-service.js"), "utf8");
const threadListFallbackSourceServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "services", "thread-list", "thread-list-fallback-source-service.js"), "utf8");

function appFunctionBody(name) {
  const patterns = [
    `function ${name}(`,
    `async function ${name}(`,
  ];
  let start = -1;
  for (const pattern of patterns) {
    start = appJs.indexOf(pattern);
    if (start >= 0) break;
  }
  assert.notEqual(start, -1, `missing function ${name}`);
  const bodyStart = appJs.indexOf(") {", start) + 2;
  assert.notEqual(bodyStart, 1, `missing function body ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < appJs.length; index += 1) {
    const char = appJs[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return appJs.slice(bodyStart + 1, index);
  }
  throw new Error(`could not parse function ${name}`);
}

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

test("thread archive uses in-app confirmation in Hermes embed mode", () => {
  assert.match(indexHtml, /id="threadArchiveConfirmDialog"/);
  assert.match(stylesCss, /\.thread-archive-confirm-dialog/);
  assert.match(appJs, /function requestThreadArchiveConfirmation\(threadId, title\)/);
  assert.match(appJs, /threadArchiveConfirmProceed/);
  assert.match(appJs, /isHermesEmbedMode\(\)/);
  assert.match(appJs, /state\.threads = state\.threads\.filter\(\(entry\) => entry\.id !== thread\.id\)/);
  const archiveBody = appFunctionBody("archiveThread");
  assert.match(archiveBody, /await requestThreadArchiveConfirmation\(thread\.id, title\)/);
  assert.doesNotMatch(archiveBody, /window\.confirm/);
});

test("thread long-press action sheet can copy session id", () => {
  assert.match(indexHtml, /data-thread-action="copy-id"/);
  assert.match(indexHtml, /复制 Session ID/);
  assert.match(appJs, /async function copyThreadIdFromActionSheet\(threadId\)/);
  assert.match(appJs, /action === "copy-id"/);
  assert.match(appJs, /copyTextToClipboard\(id\)/);
});

test("archive state merge keeps backup and archived-session filters active", () => {
  const matches = threadVisibilityServiceJs.match(/function mergeThreadStateFromStateDb\(/g) || [];
  assert.equal(matches.length, 1);
  assert.match(serverJs, /MOBILE_ARCHIVED_THREAD_IDS_FILE/);
  assert.match(serverJs, /createMobileArchiveIndexService/);
  assert.match(threadVisibilityServiceJs, /function isBackupRolloutPath\(/);
  assert.match(threadVisibilityServiceJs, /archivedSessionThreadIds\(\)/);
  assert.match(threadVisibilityServiceJs, /mobileArchiveIndexService\.threadIds\(\)/);
  assert.match(threadVisibilityServiceJs, /threadHasArchiveSignal\(thread, archivedIds\)/);
  assert.match(threadVisibilityServiceJs, /isBackupRolloutPath\(row\.rollout_path\)/);
  assert.ok(apiDispatchRouteServiceJs.includes("threadManagementRouteService.handleRoute"));
  assert.ok(threadManagementRouteServiceJs.includes("pathname.match(/^\\/api\\/threads\\/([^/]+)\\/archive$/)"));
});

test("archive route remembers ids in Mobile local archive index", () => {
  assert.match(threadVisibilityServiceJs, /function rememberMobileArchivedThreadId\(/);
  assert.match(threadVisibilityServiceJs, /function archivedResultWithMobileIndex\(/);
  assert.match(threadVisibilityServiceJs, /function alreadyArchivedResult\(/);
  assert.match(threadVisibilityServiceJs, /function isThreadIdArchivedLocally\(/);
  assert.match(threadVisibilityServiceJs, /if \(isThreadIdArchivedLocally\(threadId\)\) return alreadyArchivedResult\("mobile-index", threadId, false\);/);
  assert.match(threadVisibilityServiceJs, /return archivedResultWithMobileIndex\(result, threadId\);/);
  assert.match(threadVisibilityServiceJs, /return alreadyArchivedResult\("state-db", threadId\);/);
  assert.match(threadVisibilityServiceJs, /return alreadyArchivedResult\("", threadId\);/);
});

test("projectless session-index fallback skips archived sessions", () => {
  assert.match(threadListFallbackSourceServiceJs, /function readSessionIndexFallback\(/);
  const start = threadListFallbackSourceServiceJs.indexOf("function readSessionIndexFallback(");
  const end = threadListFallbackSourceServiceJs.indexOf("\n  function ", start + 1);
  const body = threadListFallbackSourceServiceJs.slice(start, end);
  assert.match(body, /const archivedIds = filters\.archivedIds && typeof filters\.archivedIds\.has === "function"/);
  assert.match(body, /: archivedSessionThreadIds\(\);/);
  assert.match(body, /if \(!entry\.id \|\| !projectlessThreadIds\.has\(entry\.id\)\) continue;/);
  assert.match(body, /if \(archivedIds\.has\(entry\.id\)\) continue;/);
  assert.ok(
    body.indexOf("if (!entry.id || !projectlessThreadIds.has(entry.id)) continue;")
      < body.indexOf("if (archivedIds.has(entry.id)) continue;"),
  );
});

test("thread list hides subagent child threads", () => {
  assert.match(threadVisibilityServiceJs, /function isSubagentThreadSummary\(/);
  assert.match(threadVisibilityServiceJs, /agentNickname/);
  assert.match(threadVisibilityServiceJs, /agentRole/);
  assert.match(threadVisibilityServiceJs, /isSpawnedChildThread/);
  assert.match(threadVisibilityServiceJs, /exists\(select 1 from thread_spawn_edges where child_thread_id=threads\.id\) as is_spawned_child/);
  assert.match(threadVisibilityServiceJs, /if \(isSubagentThreadSummary\(thread\)\) return true;/);
});
