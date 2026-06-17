"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");

const {
  anyThreadMatchesVisibleWorkspace,
  filterFallbackThreads,
  hydrateThreadListTitlesFromSessionIndex,
  isHiddenThread,
  mergeThreadListFallback,
  parseThreadTurnsCursor,
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

function globalStateForRoots(roots) {
  return {
    "active-workspace-roots": roots,
    "electron-saved-workspace-roots": roots,
    "project-order": roots,
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

test("projectless visible thread ids stay open even when app-server reports a temporary cwd", () => {
  const visibleRoot = path.join(os.homedir(), "hermes-webui");
  const temporaryCwd = path.join(os.homedir(), "Documents", "Codex", "2099-01-01", "temporary-plugin-workspace");
  const visibility = visibilityFor(visibleRoot);
  visibility.projectlessThreadIds.add("thread-projectless");

  assert.equal(isHiddenThread({ id: "thread-projectless", cwd: temporaryCwd }, visibility), false);
  assert.equal(isHiddenThread({ id: "thread-other", cwd: temporaryCwd }, visibility), true);
  assert.equal(isHiddenThread({ id: "thread-projectless", cwd: temporaryCwd, archived: true }, visibility), true);

  const filtered = filterFallbackThreads([
    { id: "thread-projectless", cwd: temporaryCwd, name: "Projectless temporary cwd", updatedAt: 300 },
    { id: "thread-other", cwd: temporaryCwd, name: "Hidden temporary cwd", updatedAt: 400 },
  ], {
    globalState: Object.assign(globalStateForRoots([visibleRoot]), {
      "projectless-thread-ids": ["thread-projectless"],
    }),
  });

  assert.deepEqual(filtered.map((thread) => thread.id), ["thread-projectless"]);
});

test("thread turns cursor accepts app-server JSON cursor objects from query strings", () => {
  assert.equal(parseThreadTurnsCursor('{"turnId":"turn-1","includeAnchor":false}'), '{"turnId":"turn-1","includeAnchor":false}');
  assert.equal(parseThreadTurnsCursor('"{\\"turnId\\":\\"turn-2\\",\\"includeAnchor\\":false}"'), '{"turnId":"turn-2","includeAnchor":false}');
  assert.equal(parseThreadTurnsCursor({ turnId: "turn-3", includeAnchor: false }), '{"turnId":"turn-3","includeAnchor":false}');
  assert.equal(parseThreadTurnsCursor("opaque-cursor"), "opaque-cursor");
  assert.equal(parseThreadTurnsCursor(""), null);
});

test("thread detail uses full thread/read before bounded turns/list fallback", () => {
  assert.doesNotMatch(serverJs, /CODEX_MOBILE_THREAD_DETAIL_ROLLOUT_MAX_BYTES/);
  assert.doesNotMatch(serverJs, /THREAD_DETAIL_ROLLOUT_MAX_BYTES/);
  assert.doesNotMatch(serverJs, /shouldSkipThreadDetailRpc/);
  assert.doesNotMatch(serverJs, /large-rollout-turns-list/);
  assert.doesNotMatch(serverJs, /skip_detail_rpc/);
  const routeStart = serverJs.indexOf("const threadRead = url.pathname.match");
  const threadReadIndex = serverJs.indexOf('codex.request("thread/read", { threadId, includeTurns: true }', routeStart);
  const turnsListIndex = serverJs.indexOf('turnsListThreadReadResult(', threadReadIndex);
  assert.ok(threadReadIndex > routeStart, "thread detail route should call full thread/read");
  assert.ok(turnsListIndex > threadReadIndex, "bounded turns/list should stay a fallback after thread/read");
  assert.match(serverJs, /result\.thread\.mobileReadMode = "thread-read";/);
});

test("thread detail defaults to ten turns and exposes an older cursor when compacted", () => {
  assert.match(serverJs, /CODEX_MOBILE_THREAD_TURNS \|\| "10"/);
  assert.match(serverJs, /CODEX_MOBILE_FULL_THREAD_TURNS \|\| "10"/);
  assert.match(serverJs, /function olderTurnsCursorBeforeTurn\(turn\)/);
  assert.match(serverJs, /return JSON\.stringify\(\{ turnId, includeAnchor: false \}\);/);
  assert.match(serverJs, /out\.mobileOlderTurnsCursor = olderTurnsCursorBeforeTurn\(out\.turns\[0\]\);/);
  assert.match(serverJs, /const preferRecentTurns = detailMode === "recent";/);
  assert.match(serverJs, /if \(preferRecentTurns\) \{/);
  assert.match(serverJs, /"turns-list-initial"/);
  assert.match(serverJs, /limit: Math\.max\(1, Math\.min\(100, Number\(url\.searchParams\.get\("limit"\) \|\| String\(MAX_THREAD_TURNS\)\)\)\)/);
});

test("fallback thread list keeps migrated Windows cwd rows when no visible workspace matches", () => {
  const macWorkspace = "/Users/xuxin/HermesMobile";
  const windowsCwd = "C:\\Users\\xuxin\\Documents\\Agent";
  const visibility = visibilityFor(macWorkspace);

  assert.equal(anyThreadMatchesVisibleWorkspace([{ id: "thread-1", cwd: windowsCwd }], visibility), false);

  const filtered = filterFallbackThreads([
    { id: "thread-1", cwd: windowsCwd, name: "Windows history", updatedAt: 300 },
    { id: "thread-archived", cwd: windowsCwd, name: "Archived", archived: true, updatedAt: 400 },
    { id: "thread-subagent", cwd: windowsCwd, name: "Subagent", agent_role: "subagent", updatedAt: 500 },
  ], {
    globalState: globalStateForRoots([macWorkspace]),
  });

  assert.deepEqual(filtered.map((thread) => thread.id), ["thread-1"]);
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

test("thread list sorts fallback threads before older app-server rows before applying limit", () => {
  const result = mergeThreadListFallback({
    data: [
      { id: "thread-1", name: "old app-server row", updatedAt: 100 },
      { id: "thread-2", name: "older app-server row", updatedAt: 90 },
    ],
  }, [
    { id: "thread-3", name: "recent rollout fallback", updatedAt: 300 },
  ], 2);

  assert.deepEqual(result.data.map((thread) => thread.id), ["thread-3", "thread-1"]);
});

test("thread list hydrates display titles from the Mobile session index", () => {
  const threadId = "019e936c-d163-75b3-adf4-d5ae69e46936";
  const hydrated = hydrateThreadListTitlesFromSessionIndex([
    { id: threadId, name: threadId, preview: threadId, updatedAt: 100 },
    { id: "thread-2", name: "Existing title", preview: "Existing title", updatedAt: 200 },
    {
      id: "thread-3",
      name: "帮我看一下这个软件，它是一个已经停更的软件。只有支持 Java 的 PC 版...",
      preview: "帮我看一下这个软件，它是一个已经停更的软件。只有支持 Java 的 PC 版...",
      updatedAt: 1780600000,
    },
  ], new Map([
    [threadId, {
      id: threadId,
      thread_name: "记账 06-05",
      updated_at: "2026-06-04T16:51:13.524Z",
    }],
    ["thread-2", {
      id: "thread-2",
      thread_name: "Session Indexed Title",
      updated_at: "2026-06-05T00:00:00.000Z",
    }],
    ["thread-3", {
      id: "thread-3",
      thread_name: "星盘",
      updated_at: "2026-06-04T16:51:13.524Z",
    }],
  ]));

  assert.equal(hydrated[0].name, "记账 06-05");
  assert.equal(hydrated[0].preview, "记账 06-05");
  assert.equal(hydrated[0].updatedAt, 1780591873);
  assert.equal(hydrated[1].name, "Session Indexed Title");
  assert.equal(hydrated[2].name, "星盘");
  assert.equal(hydrated[2].preview, "星盘");
  assert.equal(hydrated[2].updatedAt, 1780600000);
});

test("thread list hydrates continuation bootstrap titles from the Mobile session index", () => {
  const threadId = "019e9566-c222-7560-af45-2b3665862188";
  const hydrated = hydrateThreadListTitlesFromSessionIndex([
    {
      id: threadId,
      name: "# Continuation Bootstrap Index\n\nThis thread is a same-workspace continuation created by Codex Mobile Web.",
      preview: "# Continuation Bootstrap Index",
      updatedAt: 100,
    },
  ], new Map([
    [threadId, {
      id: threadId,
      thread_name: "Hermes 06-05",
      updated_at: "2026-06-05T01:30:00.113Z",
    }],
  ]));

  assert.equal(hydrated[0].name, "Hermes 06-05");
  assert.equal(hydrated[0].preview, "Hermes 06-05");
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
  fs.utimesSync(
    rolloutPath,
    new Date("2026-06-04T10:00:30.000Z"),
    new Date("2026-06-04T10:00:30.000Z"),
  );

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

test("rollout session fallback uses rollout mtime when it is newer than session index", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-rollout-mtime-"));
  const threadId = "019e9000-0000-7000-8000-000000000002";
  const rolloutPath = path.join(dir, `rollout-2026-06-04T10-00-00-${threadId}.jsonl`);
  fs.writeFileSync(rolloutPath, [
    JSON.stringify({
      type: "session_meta",
      payload: {
        id: threadId,
        timestamp: "2026-06-04T10:00:01.000Z",
        cwd: "C:\\Users\\xuxin\\Documents\\Agent",
      },
    }),
  ].join("\n"), "utf8");
  fs.utimesSync(
    rolloutPath,
    new Date("2026-06-04T10:05:30.000Z"),
    new Date("2026-06-04T10:05:30.000Z"),
  );

  const summary = readRolloutSessionFallbackThreadFromFile(rolloutPath, {
    id: threadId,
    thread_name: "Recovered Thread",
    updated_at: "2026-06-04T10:01:00.000Z",
  });

  assert.equal(summary.updatedAt, 1780567530);
});

test("rollout session fallback infers active and completed status from rollout tail", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-rollout-status-"));
  const activeThreadId = "019e9000-0000-7000-8000-000000000003";
  const completedThreadId = "019e9000-0000-7000-8000-000000000004";
  const touchedThreadId = "019e9000-0000-7000-8000-000000000005";
  const now = new Date();
  const earlier = new Date(now.getTime() - 1000);
  const activePath = path.join(dir, `rollout-2026-06-04T10-00-00-${activeThreadId}.jsonl`);
  const completedPath = path.join(dir, `rollout-2026-06-04T10-00-00-${completedThreadId}.jsonl`);
  const touchedPath = path.join(dir, `rollout-2026-06-04T10-00-00-${touchedThreadId}.jsonl`);
  fs.writeFileSync(activePath, [
    JSON.stringify({
      type: "session_meta",
      payload: {
        id: activeThreadId,
        timestamp: earlier.toISOString(),
        cwd: "C:\\Users\\xuxin\\Documents\\Agent",
      },
    }),
    JSON.stringify({
      timestamp: earlier.toISOString(),
      type: "event_msg",
      payload: {
        type: "task_started",
        turn_id: "turn-active",
      },
    }),
    JSON.stringify({
      timestamp: now.toISOString(),
      type: "response_item",
      payload: {
        type: "function_call",
      },
    }),
  ].join("\n"), "utf8");
  fs.utimesSync(activePath, now, now);

  fs.writeFileSync(completedPath, [
    JSON.stringify({
      type: "session_meta",
      payload: {
        id: completedThreadId,
        timestamp: earlier.toISOString(),
        cwd: "C:\\Users\\xuxin\\Documents\\Agent",
      },
    }),
    JSON.stringify({
      timestamp: earlier.toISOString(),
      type: "event_msg",
      payload: {
        type: "task_started",
        turn_id: "turn-completed",
      },
    }),
    JSON.stringify({
      timestamp: now.toISOString(),
      type: "event_msg",
      payload: {
        type: "task_complete",
        turn_id: "turn-completed",
      },
    }),
  ].join("\n"), "utf8");
  fs.utimesSync(completedPath, now, now);

  fs.writeFileSync(touchedPath, [
    JSON.stringify({
      type: "session_meta",
      payload: {
        id: touchedThreadId,
        timestamp: earlier.toISOString(),
        cwd: "C:\\Users\\xuxin\\Documents\\Agent",
      },
    }),
  ].join("\n"), "utf8");
  fs.utimesSync(touchedPath, now, now);

  const active = readRolloutSessionFallbackThreadFromFile(activePath, { id: activeThreadId });
  const completed = readRolloutSessionFallbackThreadFromFile(completedPath, { id: completedThreadId });
  const touched = readRolloutSessionFallbackThreadFromFile(touchedPath, { id: touchedThreadId });

  assert.equal(active.status.type, "active");
  assert.equal(completed.status.type, "completed");
  assert.equal(touched.status.type, "notLoaded");
});

test("rollout session fallback carries agent metadata so subagent rows stay hidden", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-rollout-agent-"));
  const threadId = "019e9000-0000-7000-8000-000000000008";
  const rolloutPath = path.join(dir, `rollout-2026-06-04T10-00-00-${threadId}.jsonl`);
  fs.writeFileSync(rolloutPath, [
    JSON.stringify({
      type: "session_meta",
      payload: {
        id: threadId,
        timestamp: "2026-06-04T10:00:01.000Z",
        cwd: "C:\\Users\\xuxin\\Documents\\Agent",
        agent_nickname: "Agent",
        agent_role: "subagent",
      },
    }),
    JSON.stringify({
      timestamp: "2026-06-04T10:00:02.000Z",
      type: "event_msg",
      payload: {
        type: "task_complete",
        turn_id: "turn-agent",
      },
    }),
  ].join("\n"), "utf8");

  const summary = readRolloutSessionFallbackThreadFromFile(rolloutPath, { id: threadId });
  assert.equal(summary.agentNickname, "Agent");
  assert.equal(summary.agentRole, "subagent");
  assert.deepEqual(filterFallbackThreads([summary], {
    globalState: globalStateForRoots(["C:\\Users\\xuxin\\Documents\\Agent"]),
  }), []);
});

test("thread list route uses rollout-aware fallback aggregator", () => {
  const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
  const routeIndex = serverJs.indexOf('if (url.pathname === "/api/threads" && req.method === "GET")');
  assert.ok(routeIndex >= 0, "missing thread list route");
  const routeBody = serverJs.slice(routeIndex, serverJs.indexOf('const threadRename = url.pathname.match', routeIndex));

  assert.match(serverJs, /function readRolloutSessionFallback\(/);
  assert.match(serverJs, /function readThreadListFallback\(/);
  assert.match(serverJs, /function logThreadList\(event, details = \{\}\)/);
  assert.match(serverJs, /const THREAD_LIST_FALLBACK_CACHE_TTL_MS/);
  assert.match(serverJs, /const threadListFallbackCache = new Map\(\);/);
  assert.match(serverJs, /function clearThreadListFallbackCache\(\)/);
  assert.match(serverJs, /function threadListFallbackCacheKey\(limit, filters = \{\}\)/);
  assert.match(serverJs, /function readThreadListFallbackCache\(key\)/);
  assert.match(serverJs, /diagnostics\.cacheHit = true/);
  assert.match(routeBody, /mobileDiagnostics[\s\S]*threadListTimings/);
  assert.match(routeBody, /fallbackCacheHit: Boolean\(fallbackDiagnostics\.cacheHit\)/);
  assert.match(routeBody, /appServerMs/);
  assert.match(routeBody, /fallbackMs/);
  assert.match(routeBody, /mergeMs/);
  assert.match(routeBody, /decorateMs/);
  assert.match(routeBody, /fallbackStateDbMs/);
  assert.match(routeBody, /fallbackRolloutMs/);
  assert.match(routeBody, /fallbackSessionIndexMs/);
  assert.match(routeBody, /const fallbackMode = String\(url\.searchParams\.get\("fallback"\) \|\| ""\)/);
  assert.match(routeBody, /const deferFallback = fallbackMode === "defer" && !cursor && !archived && !searchTerm/);
  assert.match(routeBody, /fallbackDeferred: true/);
  assert.match(routeBody, /decorated\.mobileDeferredFallback = true/);
  assert.match(routeBody, /logThreadList\("deferred_complete"/);
  assert.match(routeBody, /logThreadList\("complete"/);
  assert.match(routeBody, /const fallback = readThreadListFallback\(limit, \{ cwd, searchTerm, globalState, diagnostics: fallbackDiagnostics \}\);/);
});

test("thread list merge keeps app-server idle over stale rollout active", () => {
  const threadId = "019e9000-0000-7000-8000-000000000006";
  const result = mergeThreadListFallback({
    data: [{
      id: threadId,
      name: "Hermes",
      updatedAt: 1780722169,
      status: { type: "idle" },
    }],
  }, [{
    id: threadId,
    name: "Hermes",
    updatedAt: 1780722169,
    rolloutSizeUpdatedAtMs: 1780722169000,
    status: { type: "active" },
  }], 10);

  assert.equal(result.data[0].status.type, "idle");
});

test("thread list merge still accepts newer rollout active over old completed summary", () => {
  const threadId = "019e9000-0000-7000-8000-000000000007";
  const result = mergeThreadListFallback({
    data: [{
      id: threadId,
      name: "Hermes",
      updatedAt: 1780720000,
      status: { type: "completed" },
    }],
  }, [{
    id: threadId,
    name: "Hermes",
    updatedAt: 1780720100,
    status: { type: "active" },
  }], 10);

  assert.equal(result.data[0].status.type, "active");
});

test("thread list merge removes completed bare-id mobile fallback residues", () => {
  const residualThreadId = "019e9000-0000-7000-8000-000000000009";
  const result = mergeThreadListFallback({
    data: [{
      id: "main-thread",
      name: "Main Thread",
      updatedAt: 1780720000,
      status: { type: "completed" },
    }],
  }, [{
    id: residualThreadId,
    name: null,
    preview: residualThreadId,
    cwd: "C:\\Users\\xuxin\\Documents\\Agent",
    updatedAt: 1780720100,
    status: { type: "completed" },
    mobileFallback: true,
  }], 10);

  assert.deepEqual(result.data.map((thread) => thread.id), ["main-thread"]);
});

test("thread list merge removes rows when duplicate fallback reveals agent metadata", () => {
  const threadId = "019e9000-0000-7000-8000-000000000010";
  const result = mergeThreadListFallback({
    data: [{
      id: threadId,
      name: null,
      preview: threadId,
      updatedAt: 1780720000,
      status: { type: "completed" },
    }],
  }, [{
    id: threadId,
    name: null,
    preview: threadId,
    updatedAt: 1780720100,
    agentRole: "subagent",
    mobileFallback: true,
    status: { type: "completed" },
  }], 10);

  assert.deepEqual(result.data, []);
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
