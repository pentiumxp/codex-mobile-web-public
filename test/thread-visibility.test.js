"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const threadDetailReadOrchestrationServiceJs = fs.readFileSync(
  path.resolve(__dirname, "..", "adapters", "thread-detail-read-orchestration-service.js"),
  "utf8",
);
const threadDetailRouteServiceJs = fs.readFileSync(
  path.resolve(__dirname, "..", "adapters", "thread-detail-route-service.js"),
  "utf8",
);
const threadListSummaryServiceJs = fs.readFileSync(
  path.resolve(__dirname, "..", "adapters", "thread-list-summary-service.js"),
  "utf8",
);
process.env.CODEX_MOBILE_SETTINGS_FILE = path.join(os.tmpdir(), `codex-mobile-thread-visibility-settings-${process.pid}.json`);
try {
  fs.rmSync(process.env.CODEX_MOBILE_SETTINGS_FILE, { force: true });
} catch (_) {}

const {
  anyThreadMatchesVisibleWorkspace,
  applyLocalActiveThreadStatusToSummary,
  attachRolloutFallbackStatus,
  clearLocalActiveThreadStatus,
  collectRecentRolloutFiles,
  compactThread,
  filterFallbackThreads,
  hydrateThreadListResultTitlesFromSessionIndex,
  hydrateThreadListTitlesFromSessionIndex,
  isHiddenThread,
  mergeThreadListFallback,
  normalizeStaleContextOnlyActiveThread,
  parseThreadTurnsCursor,
  readRolloutSessionFallbackThreadFromFile,
  rememberLocalActiveThreadStatus,
  sortTurnsChronologically,
  stripThreadListDetailFields,
  stripThreadListResultDetailFields,
  taskCardSourceThreadTitle,
  threadDisplayPublicSettings,
  threadDisplayTitle,
  threadMatchesWorkspaceCwd,
  threadStatusChangedPayloadFromTurnNotification,
  setThreadDisplaySettings,
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

function functionBody(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing function ${name}`);
  const open = source.indexOf("{", start);
  assert.notEqual(open, -1, `missing function body ${name}`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, index + 1);
    }
  }
  throw new Error(`unterminated function ${name}`);
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

test("turn completion status broadcasts carry fresh event time for thread-list hints", () => {
  const payload = threadStatusChangedPayloadFromTurnNotification({
    type: "notification",
    method: "turn/completed",
    params: {
      threadId: "thread-status-a",
      turn: {
        id: "turn-status-a",
        status: { type: "completed" },
        completedAtMs: 1_782_300_000_123,
      },
    },
  });

  assert.equal(payload.method, "thread/status/changed");
  assert.equal(payload.params.threadId, "thread-status-a");
  assert.deepEqual(payload.params.status, { type: "completed" });
  assert.equal(payload.params.source, "turn/completed");
  assert.equal(payload.params.turnId, "turn-status-a");
  assert.equal(payload.params.eventAtMs, 1_782_300_000_123);
});

test("replayed turn completion status does not invent a fresh event time", () => {
  const payload = threadStatusChangedPayloadFromTurnNotification({
    type: "notification",
    method: "turn/completed",
    params: {
      threadId: "thread-status-a",
      mobileReplay: true,
      turn: {
        id: "turn-status-a",
        status: { type: "completed" },
      },
    },
  });

  assert.equal(payload.method, "thread/status/changed");
  assert.equal(payload.params.mobileReplay, true);
  assert.equal(Object.prototype.hasOwnProperty.call(payload.params, "eventAtMs"), false);
});

test("thread display settings normalize tile mode and stable pane slots", () => {
  const settings = setThreadDisplaySettings({
    displayMode: "tile",
    paneThreadIds: ["thread-a", "thread-b", "thread-a", "", "thread-c"],
    paneCount: 4.8,
    paneSplitPairs: [
      { anchorId: "thread-a", childId: "thread-c" },
      { anchorId: "thread-a", childId: "thread-b" },
      { anchorId: "missing", childId: "thread-b" },
    ],
    selectedThreadId: "thread-b",
  });

  assert.equal(settings.displayMode, "tile");
  assert.equal(settings.threadTileMode, true);
  assert.deepEqual(settings.paneThreadIds.slice(0, 3), ["thread-a", "thread-b", "thread-c"]);
  assert.equal(settings.paneCount, 4);
  assert.deepEqual(settings.paneSplitPairs, [{ anchorId: "thread-a", childId: "thread-c" }]);
  assert.equal(settings.selectedThreadId, "thread-b");
  assert.equal(threadDisplayPublicSettings().source, "runtime");
  assert.equal(threadDisplayPublicSettings().paneCount, 4);
});

test("thread display pane count is bounded and allows automatic zero", () => {
  assert.equal(setThreadDisplaySettings({ displayMode: "tile", paneCount: 0 }).paneCount, 0);
  assert.equal(setThreadDisplaySettings({ displayMode: "tile", paneCount: 99 }).paneCount, 12);
});

test("thread detail uses full thread/read before bounded turns/list fallback", () => {
  assert.doesNotMatch(serverJs, /CODEX_MOBILE_THREAD_DETAIL_ROLLOUT_MAX_BYTES/);
  assert.doesNotMatch(serverJs, /THREAD_DETAIL_ROLLOUT_MAX_BYTES/);
  assert.doesNotMatch(serverJs, /shouldSkipThreadDetailRpc/);
  assert.doesNotMatch(serverJs, /large-rollout-turns-list/);
  assert.doesNotMatch(serverJs, /skip_detail_rpc/);
  const routeStart = serverJs.indexOf("const threadRead = url.pathname.match");
  assert.ok(serverJs.indexOf("threadDetailReadOrchestrationService.readThreadDetail", routeStart) > routeStart);
  const threadReadIndex = threadDetailReadOrchestrationServiceJs.indexOf("await readFullThread(");
  const turnsListIndex = threadDetailReadOrchestrationServiceJs.indexOf("await turnsListThreadReadResult(", threadReadIndex);
  assert.ok(threadReadIndex > 0, "thread detail orchestration should call full thread/read");
  assert.ok(turnsListIndex > threadReadIndex, "bounded turns/list should stay a fallback after thread/read");
  assert.match(serverJs, /result\.thread\.mobileReadMode = "thread-read";/);
  assert.match(serverJs, /compactActiveOverlayTurn: \(turn, details = \{\}\) => compactTurn\(turn, \{/);
  assert.match(serverJs, /maxOperationItems: MAX_LIVE_OPERATION_ITEMS/);
  assert.match(threadDetailReadOrchestrationServiceJs, /compactOverlayTurn: compactActiveOverlayTurn/);
});

test("thread detail defaults to ten turns and exposes an older cursor when compacted", () => {
  assert.match(serverJs, /CODEX_MOBILE_THREAD_TURNS \|\| "10"/);
  assert.match(serverJs, /CODEX_MOBILE_FULL_THREAD_TURNS \|\| "10"/);
  assert.match(serverJs, /function olderTurnsCursorBeforeTurn\(turn\)/);
  assert.match(serverJs, /return JSON\.stringify\(\{ turnId, includeAnchor: false \}\);/);
  assert.match(serverJs, /out\.mobileOlderTurnsCursor = olderTurnsCursorBeforeTurn\(out\.turns\[0\]\);/);
  assert.match(serverJs, /handleThreadDetailReadRoute\(\{/);
  assert.match(threadDetailRouteServiceJs, /const preferRecentTurns = detailModeFromUrl\(url\) === "recent";/);
  assert.match(threadDetailReadOrchestrationServiceJs, /planActiveThreadDetailReadPolicy\(\{ summary, preferRecentTurns \}\)/);
  assert.match(threadDetailReadOrchestrationServiceJs, /if \(activeReadPolicy\.shouldUseInitialTurnsList\) \{/);
  assert.match(threadDetailReadOrchestrationServiceJs, /"turns-list-initial"/);
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

test("fallback filtering reuses injected archived ids for a whole pass", () => {
  const visibleRoot = "C:\\Users\\xuxin\\Documents\\Agent";
  const archivedId = "019e9000-0000-7000-8000-000000000016";
  const liveId = "019e9000-0000-7000-8000-000000000017";
  const filtered = filterFallbackThreads([
    { id: archivedId, cwd: visibleRoot, status: { type: "active" } },
    { id: liveId, cwd: visibleRoot, status: { type: "active" } },
  ], {
    archivedIds: new Set([archivedId]),
    globalState: globalStateForRoots([visibleRoot]),
  });

  assert.deepEqual(filtered.map((thread) => thread.id), [liveId]);
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

test("deferred thread list result hydrates display titles before first paint", () => {
  const threadId = "019e9566-c222-7560-af45-2b3665862188";
  const result = hydrateThreadListResultTitlesFromSessionIndex({
    data: [
      {
        id: threadId,
        name: "# Continuation Bootstrap Index\n\nThis thread is a same-workspace continuation created by Codex Mobile Web.",
        preview: "# Continuation Bootstrap Index",
        updatedAt: 100,
      },
    ],
  }, new Map([
    [threadId, {
      id: threadId,
      thread_name: "Home AI 06-18",
      updated_at: "2026-06-18T01:30:00.113Z",
    }],
  ]));

  assert.equal(result.data[0].name, "Home AI 06-18");
  assert.equal(result.data[0].preview, "Home AI 06-18");
});

test("task-card source titles skip continuation bootstrap text", () => {
  const threadId = "019ef506-cac2-76f2-a1df-46ed6de1e7eb";
  const bootstrapTitle = "# Continuation Bootstrap Index\n\nThis thread is a same-workspace continuation created by Codex Mobile Web.";

  assert.equal(threadDisplayTitle({
    id: threadId,
    name: bootstrapTitle,
    preview: "# Continuation Bootstrap Index",
    displayTitle: "Plugin Workspace Audit",
  }), "Plugin Workspace Audit");

  assert.equal(taskCardSourceThreadTitle(threadId, bootstrapTitle, {
    id: threadId,
    name: bootstrapTitle,
    preview: "# Continuation Bootstrap Index",
    thread_name: "Plugin Workspace Audit",
  }), "Plugin Workspace Audit");
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
  assert.equal(active.status.turnId, "turn-active");
  assert.equal(active.activeTurnId, "turn-active");
  assert.equal(completed.status.type, "completed");
  assert.equal(touched.status.type, "notLoaded");
});

test("rollout session list fallback can defer status until final candidates", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-rollout-deferred-status-"));
  const threadId = "019e9000-0000-7000-8000-000000000015";
  const now = new Date();
  const earlier = new Date(now.getTime() - 1000);
  const rolloutPath = path.join(dir, `rollout-2026-06-04T10-00-00-${threadId}.jsonl`);
  fs.writeFileSync(rolloutPath, [
    JSON.stringify({
      type: "session_meta",
      payload: {
        id: threadId,
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
  fs.utimesSync(rolloutPath, now, now);

  const diagnostics = {};
  const candidate = readRolloutSessionFallbackThreadFromFile(
    rolloutPath,
    { id: threadId },
    { includeStatus: false, diagnostics },
  );
  assert.equal(candidate.status.type, "notLoaded");
  assert.equal(diagnostics.rolloutHeadReadCount, 1);
  assert.equal(diagnostics.rolloutSummaryReadCount, 1);
  assert.equal(diagnostics.rolloutStatusTailReadCount, undefined);

  const finalCandidate = attachRolloutFallbackStatus(candidate, { nowMs: now.getTime(), diagnostics });
  assert.equal(finalCandidate.status.type, "active");
  assert.equal(finalCandidate.status.turnId, "turn-active");
  assert.equal(finalCandidate.activeTurnId, "turn-active");
  assert.equal(diagnostics.rolloutStatusAttachCount, 1);
  assert.equal(diagnostics.rolloutStatusStatReadCount, undefined);
  assert.equal(diagnostics.rolloutStatusStatReuseCount, 1);
  assert.equal(diagnostics.rolloutStatusTailReadCount, 1);
  assert.ok(diagnostics.rolloutStatusTailBytes > 0);
});

test("rollout status attach still stats threads without summary metadata", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-rollout-status-stat-"));
  const threadId = "019e9000-0000-7000-8000-000000000099";
  const rolloutPath = path.join(dir, `rollout-2026-06-04T10-00-00-${threadId}.jsonl`);
  const now = new Date("2026-06-04T10:00:00.000Z");
  fs.writeFileSync(rolloutPath, [
    JSON.stringify({
      timestamp: now.toISOString(),
      type: "event_msg",
      payload: {
        type: "task_started",
        turn_id: "turn-manual",
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
  fs.utimesSync(rolloutPath, now, now);

  const diagnostics = {};
  const result = attachRolloutFallbackStatus({
    id: threadId,
    path: rolloutPath,
    status: { type: "notLoaded" },
  }, {
    nowMs: now.getTime(),
    diagnostics,
  });

  assert.equal(result.status.type, "active");
  assert.equal(result.activeTurnId, "turn-manual");
  assert.equal(diagnostics.rolloutStatusStatReadCount, 1);
  assert.equal(diagnostics.rolloutStatusStatReuseCount, undefined);
  assert.equal(diagnostics.rolloutStatusTailReadCount, 1);
});

test("context-only stale active rollout turn is normalized to idle", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-context-only-stale-"));
  const threadId = "019e9000-0000-7000-8000-000000000013";
  const turnId = "019e9000-0000-7000-8000-00000000turn";
  const rolloutPath = path.join(dir, `rollout-2026-06-04T10-00-00-${threadId}.jsonl`);
  const old = new Date("2026-06-04T10:00:00.000Z");
  const nowMs = Date.parse("2026-06-04T10:10:00.000Z");
  fs.writeFileSync(rolloutPath, [
    JSON.stringify({
      type: "session_meta",
      payload: {
        id: threadId,
        timestamp: old.toISOString(),
        cwd: "/tmp/project",
      },
    }),
    JSON.stringify({
      timestamp: old.toISOString(),
      type: "event_msg",
      payload: {
        type: "task_started",
        turn_id: turnId,
      },
    }),
    JSON.stringify({
      timestamp: old.toISOString(),
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [{
          type: "input_text",
          text: "<environment_context>\n  <current_date>2026-06-20</current_date>\n</environment_context>",
        }],
      },
    }),
    JSON.stringify({
      timestamp: old.toISOString(),
      type: "turn_context",
      payload: {
        turn_id: turnId,
      },
    }),
  ].join("\n"), "utf8");
  fs.utimesSync(rolloutPath, old, old);

  const normalized = normalizeStaleContextOnlyActiveThread({
    id: threadId,
    path: rolloutPath,
    status: { type: "active" },
    turns: [{
      id: turnId,
      status: { type: "inProgress" },
      items: [],
    }],
  }, { nowMs });

  assert.equal(normalized.status.type, "idle");
  assert.equal(normalized.status.mobileStaleActiveTurn, true);
  assert.equal(normalized.status.reason, "context-only-active-turn");
  assert.equal(normalized.mobileStaleActiveTurn.turnId, turnId);
  assert.deepEqual(normalized.turns, []);
});

test("rollout session fallback marks stale context-only active summary idle", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-rollout-stale-summary-"));
  const threadId = "019e9000-0000-7000-8000-000000000018";
  const turnId = "019e9000-0000-7000-8000-00000000stale";
  const rolloutPath = path.join(dir, `rollout-2026-06-04T10-00-00-${threadId}.jsonl`);
  const old = new Date("2026-06-04T10:00:00.000Z");
  fs.writeFileSync(rolloutPath, [
    JSON.stringify({
      type: "session_meta",
      payload: {
        id: threadId,
        timestamp: old.toISOString(),
        cwd: "/tmp/project",
      },
    }),
    JSON.stringify({
      timestamp: old.toISOString(),
      type: "event_msg",
      payload: {
        type: "task_started",
        turn_id: turnId,
      },
    }),
    JSON.stringify({
      timestamp: old.toISOString(),
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [{
          type: "input_text",
          text: "<environment_context>\n  <current_date>2026-06-20</current_date>\n</environment_context>",
        }],
      },
    }),
  ].join("\n"), "utf8");
  fs.utimesSync(rolloutPath, old, old);

  const summary = readRolloutSessionFallbackThreadFromFile(rolloutPath, { id: threadId });

  assert.equal(summary.status.type, "idle");
  assert.equal(summary.status.reason, "context-only-active-turn");
  assert.equal(summary.status.mobileStaleActiveTurn, true);
});

test("stale active rollout turn with real user text stays active", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-real-user-active-"));
  const threadId = "019e9000-0000-7000-8000-000000000014";
  const turnId = "019e9000-0000-7000-8000-00000000real";
  const rolloutPath = path.join(dir, `rollout-2026-06-04T10-00-00-${threadId}.jsonl`);
  const old = new Date("2026-06-04T10:00:00.000Z");
  const nowMs = Date.parse("2026-06-04T10:10:00.000Z");
  fs.writeFileSync(rolloutPath, [
    JSON.stringify({
      type: "session_meta",
      payload: {
        id: threadId,
        timestamp: old.toISOString(),
        cwd: "/tmp/project",
      },
    }),
    JSON.stringify({
      timestamp: old.toISOString(),
      type: "event_msg",
      payload: {
        type: "task_started",
        turn_id: turnId,
      },
    }),
    JSON.stringify({
      timestamp: old.toISOString(),
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [{
          type: "input_text",
          text: "真实用户问题",
        }],
      },
    }),
  ].join("\n"), "utf8");
  fs.utimesSync(rolloutPath, old, old);

  const normalized = normalizeStaleContextOnlyActiveThread({
    id: threadId,
    path: rolloutPath,
    status: { type: "active" },
    turns: [{
      id: turnId,
      status: { type: "inProgress" },
      items: [],
    }],
  }, { nowMs });

  assert.equal(normalized.status.type, "active");
  assert.equal(normalized.mobileStaleActiveTurn, undefined);
  assert.equal(normalized.turns.length, 1);
});

test("stale active rollout turn with image-only user input stays active", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-image-user-active-"));
  const threadId = "019e9000-0000-7000-8000-000000000015";
  const turnId = "019e9000-0000-7000-8000-0000000image";
  const rolloutPath = path.join(dir, `rollout-2026-06-04T10-00-00-${threadId}.jsonl`);
  const old = new Date("2026-06-04T10:00:00.000Z");
  const nowMs = Date.parse("2026-06-04T10:10:00.000Z");
  fs.writeFileSync(rolloutPath, [
    JSON.stringify({
      type: "session_meta",
      payload: {
        id: threadId,
        timestamp: old.toISOString(),
        cwd: "/tmp/project",
      },
    }),
    JSON.stringify({
      timestamp: old.toISOString(),
      type: "event_msg",
      payload: {
        type: "task_started",
        turn_id: turnId,
      },
    }),
    JSON.stringify({
      timestamp: old.toISOString(),
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [{
          type: "input_image",
          image_url: { url: "file:///tmp/upload.png" },
        }],
      },
    }),
  ].join("\n"), "utf8");
  fs.utimesSync(rolloutPath, old, old);

  const normalized = normalizeStaleContextOnlyActiveThread({
    id: threadId,
    path: rolloutPath,
    status: { type: "active" },
    turns: [{
      id: turnId,
      status: { type: "inProgress" },
      items: [],
    }],
  }, { nowMs });

  assert.equal(normalized.status.type, "active");
  assert.equal(normalized.mobileStaleActiveTurn, undefined);
  assert.equal(normalized.turns.length, 1);
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

test("rollout discovery visits newest session directories before the candidate cap", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-rollout-discovery-"));
  const oldDir = path.join(root, "2024", "01", "01");
  const newDir = path.join(root, "2026", "06", "26");
  fs.mkdirSync(oldDir, { recursive: true });
  fs.mkdirSync(newDir, { recursive: true });
  const oldTime = new Date("2024-01-01T00:00:00.000Z");
  const newTime = new Date("2026-06-26T00:00:00.000Z");
  for (let index = 0; index < 6; index += 1) {
    const oldPath = path.join(oldDir, `rollout-2024-01-01T00-00-0${index}-019e9000-0000-7000-8000-old00000000${index}.jsonl`);
    fs.writeFileSync(oldPath, "{}\n", "utf8");
    fs.utimesSync(oldPath, oldTime, oldTime);
  }
  for (let index = 0; index < 4; index += 1) {
    const newPath = path.join(newDir, `rollout-2026-06-26T00-00-0${index}-019e9000-0000-7000-8000-new00000000${index}.jsonl`);
    fs.writeFileSync(newPath, "{}\n", "utf8");
    fs.utimesSync(newPath, newTime, newTime);
  }

  const files = collectRecentRolloutFiles(root, { maxFiles: 1, maxDepth: 6 });

  assert.equal(files.length, 1);
  assert.match(files[0].path, /2026/);
});

test("thread list route uses rollout-aware fallback aggregator", () => {
  const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
  const baselineServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-list-fallback-baseline-service.js"), "utf8");
  const cacheServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-list-fallback-cache-service.js"), "utf8");
  const prewarmServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-list-fallback-prewarm-service.js"), "utf8");
  const appServerFetchPolicyJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-list-app-server-fetch-policy-service.js"), "utf8");
  const coldPathDiagnosisServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-list-cold-path-diagnosis-service.js"), "utf8");
  const routeMergeServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-list-route-merge-service.js"), "utf8");
  const summaryMergeServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-list-summary-merge-service.js"), "utf8");
  const requestContextServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-list-request-context-service.js"), "utf8");
  const responseCoalescerServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-list-response-coalescer-service.js"), "utf8");
  const routeIndex = serverJs.indexOf('if (url.pathname === "/api/threads" && req.method === "GET")');
  assert.ok(routeIndex >= 0, "missing thread list route");
  const routeBody = serverJs.slice(routeIndex, serverJs.indexOf('const threadRename = url.pathname.match', routeIndex));

  assert.match(serverJs, /function readRolloutSessionFallback\(/);
  assert.match(serverJs, /function compareRecentRolloutDirents\(left, right\)/);
  assert.match(serverJs, /entries\.sort\(compareRecentRolloutDirents\)/);
  assert.match(serverJs, /function readSessionIndexEntriesForFallback\(maxLines = 2000, options = \{\}\)/);
  assert.match(serverJs, /const sourceContext = options\.sourceContext && typeof options\.sourceContext === "object"/);
  assert.match(serverJs, /incrementBoundedDiagnosticCounter\(diagnostics, "sessionIndexReuseCount"\)/);
  assert.match(serverJs, /function readRolloutSessionFallback\(limit = 80, filters = \{\}\) \{[\s\S]*readSessionIndexEntriesForFallback\(Math\.max\(rowLimit \* 2, 2000\), \{[\s\S]*diagnostics,[\s\S]*sourceContext: filters\.sourceContext,[\s\S]*\}\)/);
  assert.match(serverJs, /function readSessionIndexFallback\(limit = 80, filters = \{\}\) \{[\s\S]*readSessionIndexEntriesForFallback\(1000, \{[\s\S]*diagnostics,[\s\S]*sourceContext: filters\.sourceContext,[\s\S]*\}\)/);
  assert.match(serverJs, /readRolloutSessionFallbackThreadFromFile\(file, indexEntries\.get\(id\) \|\| \{ id \}, \{[\s\S]*includeStatus: false,[\s\S]*diagnostics,[\s\S]*\}\)/);
  assert.match(serverJs, /filterFallbackThreads\(threads, Object\.assign\(\{\}, filters, \{ archivedIds \}\)\)[\s\S]*\.slice\(0, limit\)[\s\S]*\.map\(\(thread\) => attachRolloutFallbackStatus\(thread, \{ diagnostics \}\)\)/);
  assert.match(serverJs, /function filterFallbackThreads\(threads, filters = \{\}\) \{[\s\S]*const archivedIds = filters\.archivedIds[\s\S]*archivedSessionThreadIds\(\)/);
  assert.match(serverJs, /function filterFallbackThreads\(threads, filters = \{\}\) \{[\s\S]*threadHasArchiveSignal\(thread, archivedIds\)/);
  assert.match(serverJs, /function rolloutLatestTurnEvidence\(rolloutPath, stat = null, options = \{\}\) \{[\s\S]*const tail = typeof options\.tail === "string" \? options\.tail : readRolloutTail\(rolloutPath\)/);
  assert.match(serverJs, /function inferRolloutFallbackStatus\(rolloutPath, stat = null, nowMs = Date\.now\(\), options = \{\}\) \{[\s\S]*counterPrefix: "rolloutStatusTail"[\s\S]*staleContextOnlyActiveEvidenceForRollout\(rolloutPath, \{ stat, nowMs, tail \}\)/);
  assert.match(serverJs, /function readThreadListFallback\(/);
  assert.match(serverJs, /function logThreadList\(event, details = \{\}\)/);
  assert.match(serverJs, /const THREAD_LIST_FALLBACK_CACHE_TTL_MS[\s\S]*\|\| "0"/);
  assert.match(serverJs, /createThreadListFallbackCacheService/);
  assert.match(baselineServiceJs, /createThreadListFallbackBaselineService/);
  assert.match(cacheServiceJs, /createThreadListFallbackBaselineService/);
  assert.match(prewarmServiceJs, /createThreadListFallbackPrewarmService/);
  assert.match(appServerFetchPolicyJs, /planThreadListAppServerFetch/);
  assert.match(appServerFetchPolicyJs, /threadListAppServerFetchTimingFields/);
  assert.match(appServerFetchPolicyJs, /threadListAppServerLatencyTimingFields/);
  assert.match(coldPathDiagnosisServiceJs, /diagnoseThreadListColdPath/);
  assert.match(routeMergeServiceJs, /mergeThreadListRouteResult/);
  assert.match(routeMergeServiceJs, /routeMergeDuplicateCount/);
  assert.match(routeMergeServiceJs, /routeMergeLimitDropCount/);
  assert.match(summaryMergeServiceJs, /createThreadListSummaryMergeService/);
  assert.match(summaryMergeServiceJs, /summaryMergeDominantStage/);
  assert.match(summaryMergeServiceJs, /mergeOptions && typeof mergeOptions\.mergeThreadDisplaySummary === "function"/);
  assert.match(requestContextServiceJs, /createThreadListRequestContext/);
  assert.match(requestContextServiceJs, /requestContextArchivedIdsReadCount/);
  assert.match(requestContextServiceJs, /requestContextRolloutStatReadCount/);
  assert.match(requestContextServiceJs, /rolloutStatsForPathForRequest/);
  assert.match(responseCoalescerServiceJs, /createThreadListResponseCoalescer/);
  assert.match(responseCoalescerServiceJs, /defaultThreadListCoalescingKey/);
  assert.match(responseCoalescerServiceJs, /threadListCoalescedRequest/);
  assert.match(routeBody, /rolloutStatsForPath,/);
  assert.match(routeBody, /rolloutStatsForPath: getThreadListRequestContext\(\)\.rolloutStatsForPath/);
  assert.match(routeBody, /mergeThreadDisplaySummary: \(base, display\) => mergeThreadDisplaySummary\(base, display, \{/);
  assert.match(routeBody, /preferExistingRolloutStats: true/);
  assert.match(routeBody, /filterVisibleThreads\(appServerRawResult, globalState, \{[\s\S]*rolloutStatsForPath: getThreadListRequestContext\(\)\.rolloutStatsForPath/);
  assert.match(serverJs, /planThreadListAppServerFetch/);
  assert.match(serverJs, /threadListAppServerFetchTimingFields/);
  assert.match(serverJs, /threadListAppServerLatencyTimingFields/);
  assert.match(serverJs, /mergeThreadListRouteResult/);
  assert.match(serverJs, /diagnoseThreadListColdPath/);
  assert.match(serverJs, /stripThreadListDetailFields/);
  assert.match(serverJs, /stripThreadListResultDetailFields/);
  assert.match(threadListSummaryServiceJs, /THREAD_DETAIL_ONLY_SUMMARY_FIELDS/);
  assert.match(threadListSummaryServiceJs, /"turns"/);
  assert.match(threadListSummaryServiceJs, /"mobileDetailLoaded"/);
  assert.match(serverJs, /const threadListFallbackCacheService = createThreadListFallbackCacheService\(\{\s*ttlMs: THREAD_LIST_FALLBACK_CACHE_TTL_MS,/);
  assert.match(serverJs, /const THREAD_LIST_FALLBACK_PREWARM_ENABLED = !\/\^\(0\|false\|no\|off\)\$\/i\.test\(process\.env\.CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM \|\| "1"\)/);
  assert.match(serverJs, /const THREAD_LIST_FALLBACK_PREWARM_RETRY_MS = Math\.max\([\s\S]*process\.env\.CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_RETRY_MS \|\| "2500"/);
  assert.match(serverJs, /const THREAD_LIST_FALLBACK_PREWARM_MAX_DEFERRALS = Math\.max\([\s\S]*process\.env\.CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_MAX_DEFERRALS \|\| "5"/);
  assert.match(serverJs, /const THREAD_LIST_FALLBACK_PREWARM_LIMIT = Math\.max\([\s\S]*process\.env\.CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_LIMIT \|\| "40"/);
  assert.match(serverJs, /summarizePrewarmStatus/);
  assert.match(serverJs, /const threadListFallbackPrewarmService = createThreadListFallbackPrewarmService\(\{[\s\S]*readFallback: readThreadListFallback,[\s\S]*readGlobalState,[\s\S]*shouldRun: \(\) => \(activeThreadDetailRequestCount > 0[\s\S]*active-detail-in-flight[\s\S]*logger: console,[\s\S]*\}\);/);
  assert.match(serverJs, /function threadListFallbackPrewarmConfig\(\) \{[\s\S]*enabled: THREAD_LIST_FALLBACK_PREWARM_ENABLED,[\s\S]*delayMs: THREAD_LIST_FALLBACK_PREWARM_DELAY_MS,[\s\S]*retryDelayMs: THREAD_LIST_FALLBACK_PREWARM_RETRY_MS,[\s\S]*maxDeferrals: THREAD_LIST_FALLBACK_PREWARM_MAX_DEFERRALS,[\s\S]*limit: THREAD_LIST_FALLBACK_PREWARM_LIMIT,[\s\S]*\}/);
  assert.match(serverJs, /function threadListFallbackPrewarmPublicStatus\(\) \{[\s\S]*summarizePrewarmStatus\([\s\S]*threadListFallbackPrewarmService\.status\(\),[\s\S]*threadListFallbackPrewarmConfig\(\),[\s\S]*\)/);
  assert.match(serverJs, /threadListFallbackPrewarm:\s*threadListFallbackPrewarmPublicStatus\(\)/);
  assert.match(serverJs, /function scheduleThreadListFallbackPrewarm\(\) \{[\s\S]*threadListFallbackPrewarmService\.schedule\(threadListFallbackPrewarmConfig\(\)\);[\s\S]*\}/);
  assert.match(functionBody(serverJs, "startServer"), /scheduleThreadListFallbackPrewarm\(\);/);
  assert.match(serverJs, /function clearThreadListFallbackCache\(\)/);
  assert.match(serverJs, /function upsertThreadListFallbackCacheThread\(thread, options = \{\}\)/);
  assert.match(serverJs, /function removeThreadFromThreadListFallbackCache\(threadId\)/);
  assert.match(serverJs, /function updateThreadListFallbackCacheStatus\(threadId, status, meta = \{\}\)/);
  assert.match(serverJs, /let activeThreadDetailRequestCount = 0;/);
  assert.match(serverJs, /function trackThreadDetailRequestLifecycle\(res\)/);
  assert.match(serverJs, /function shouldDeferThreadListFallbackForActiveDetail\(\{ deferFallback, cursor, archived, searchTerm, cwd \} = \{\}\)/);
  assert.match(serverJs, /function threadListFallbackCacheKey\(limit, filters = \{\}\)/);
  assert.match(serverJs, /function readThreadListFallbackCache\(key\)/);
  assert.match(serverJs, /function threadListFallbackCacheKey\(limit, filters = \{\}\) \{\s*return threadListFallbackCacheService\.cacheKey\(limit, filters\);\s*\}/);
  assert.match(functionBody(serverJs, "readThreadListFallbackCache"), /threadListFallbackCacheService\.read\(key\)/);
  assert.match(serverJs, /function readThreadListCachedFallback\(limit = 80, filters = \{\}\) \{[\s\S]*return threadListFallbackCacheService\.readCachedFallback\(limit, filters\);[\s\S]*\}/);
  assert.doesNotMatch(cacheServiceJs, /fileFingerprint/);
  assert.match(cacheServiceJs, /ttlMs > 0/);
  assert.match(cacheServiceJs, /diagnostics\.cacheHit = true/);
  assert.match(cacheServiceJs, /diagnostics\.cacheDecision = cached\.compatible \? "compatible-hit" : "hit"/);
  assert.match(cacheServiceJs, /compatibleCacheLimit/);
  assert.match(cacheServiceJs, /diagnostics\.cacheBuildReason = missDecision/);
  assert.match(cacheServiceJs, /diagnostics\.cacheIncrementalUpdates = cached\.incrementalUpdates/);
  assert.match(routeBody, /mobileDiagnostics[\s\S]*threadListTimings/);
  assert.match(routeBody, /const coldPathDiagnosis = diagnoseThreadListColdPath\(threadListTimings\)/);
  assert.match(routeBody, /threadListTimings\.coldPathOwner = coldPathDiagnosis\.owner/);
  assert.match(routeBody, /threadListTimings\.coldPathReason = coldPathDiagnosis\.reason/);
  assert.match(routeBody, /fallbackCacheHit: Boolean\(fallbackDiagnostics\.cacheHit\)/);
  assert.match(routeBody, /fallbackCacheDecision: String\(fallbackDiagnostics\.cacheDecision \|\| ""\)/);
  assert.match(routeBody, /fallbackCacheKeyHash: String\(fallbackDiagnostics\.cacheKeyHash \|\| ""\)/);
  assert.match(routeBody, /fallbackCacheBuildCount: Number\(fallbackDiagnostics\.cacheBuildCount \|\| 0\)/);
  assert.match(routeBody, /appServerMs/);
  assert.match(routeBody, /fallbackMs/);
  assert.match(routeBody, /mergeMs/);
  assert.match(routeBody, /decorateMs/);
  assert.match(routeBody, /fallbackStateDbMs/);
  assert.match(routeBody, /fallbackRolloutMs/);
  assert.match(routeBody, /fallbackSessionIndexMs/);
  assert.match(routeBody, /fallbackStateDbCount: Number\(fallbackDiagnostics\.stateDbCount \|\| 0\)/);
  assert.match(routeBody, /fallbackRolloutCount: Number\(fallbackDiagnostics\.rolloutCount \|\| 0\)/);
  assert.match(routeBody, /fallbackSessionIndexCount: Number\(fallbackDiagnostics\.sessionIndexCount \|\| 0\)/);
  assert.match(routeBody, /fallbackBaselineSourceCount: Number\(fallbackDiagnostics\.baselineSourceCount \|\| 0\)/);
  assert.match(routeBody, /fallbackBaselineResultCount: Number\(fallbackDiagnostics\.baselineResultCount \|\| 0\)/);
  assert.match(routeBody, /threadListFallbackBaselineWorkTimingFields\(fallbackDiagnostics\)/);
  assert.match(serverJs, /function threadListFallbackBaselineWorkTimingFields\(diagnostics = \{\}\)/);
  assert.match(serverJs, /fallbackBaselineFinalFilterInputCount: Number\(diagnostics\.baselineFinalFilterInputCount \|\| 0\)/);
  assert.match(serverJs, /fallbackBaselineMergeInputCount: Number\(diagnostics\.baselineMergeInputCount \|\| 0\)/);
  assert.match(serverJs, /fallbackBaselineMergeDuplicateCount: Number\(diagnostics\.baselineMergeDuplicateCount \|\| 0\)/);
  assert.match(routeBody, /threadListFallbackSourceDiagnosticTimingFields\(fallbackDiagnostics\)/);
  assert.match(serverJs, /function threadListFallbackSourceDiagnosticTimingFields\(diagnostics = \{\}\)/);
  assert.match(serverJs, /fallbackRolloutFileStatCount: Number\(diagnostics\.rolloutFileStatCount \|\| 0\)/);
  assert.match(serverJs, /fallbackRolloutStatusStatReadCount: Number\(diagnostics\.rolloutStatusStatReadCount \|\| 0\)/);
  assert.match(serverJs, /fallbackRolloutStatusStatReuseCount: Number\(diagnostics\.rolloutStatusStatReuseCount \|\| 0\)/);
  assert.match(serverJs, /fallbackRolloutStatusTailBytes: Number\(diagnostics\.rolloutStatusTailBytes \|\| 0\)/);
  assert.match(serverJs, /const ROLLOUT_STAT_METADATA = Symbol\("codexMobileRolloutStat"\)/);
  assert.match(serverJs, /return attachRolloutStatMetadata\(rowToFallbackThread\(\{/);
  assert.match(serverJs, /rolloutStatMetadataForThread\(thread\)/);
  assert.match(serverJs, /fallbackSessionIndexReadCount: Number\(diagnostics\.sessionIndexReadCount \|\| 0\)/);
  assert.match(serverJs, /fallbackSessionIndexReuseCount: Number\(diagnostics\.sessionIndexReuseCount \|\| 0\)/);
  assert.match(routeBody, /const fallbackMode = String\(url\.searchParams\.get\("fallback"\) \|\| ""\)/);
  assert.match(routeBody, /const deferFallback = fallbackMode === "defer" && !cursor && !archived && !searchTerm/);
  assert.match(routeBody, /const initialMode = String\(url\.searchParams\.get\("initial"\) \|\| ""\)/);
  assert.match(routeBody, /const allowWarmFallbackInitial = initialMode === "warm-fallback" && !cursor && !archived && !searchTerm && !cwd/);
  assert.match(routeBody, /const appServerFetchPlan = planThreadListAppServerFetch\(\{[\s\S]*limit,[\s\S]*cursor,[\s\S]*archived,[\s\S]*cwd,[\s\S]*searchTerm,[\s\S]*\}\);/);
  assert.match(routeBody, /Object\.assign\(timings, threadListAppServerFetchTimingFields\(appServerFetchPlan\)\)/);
  assert.match(routeBody, /limit: appServerFetchPlan\.appServerLimit/);
  assert.match(routeBody, /const appServerRpcDiagnostics = \{\}/);
  assert.match(routeBody, /const appServerRawResult = await codex\.request\("thread\/list", params, \{[\s\S]*timeoutMs: READ_RPC_TIMEOUT_MS,[\s\S]*diagnostics: appServerRpcDiagnostics,[\s\S]*\}\)/);
  assert.match(routeBody, /const appServerVisibleResult = filterVisibleThreads\(appServerRawResult, globalState, \{[\s\S]*archivedIds: getRequestArchivedIds\(\),[\s\S]*rolloutStatsForPath: getThreadListRequestContext\(\)\.rolloutStatsForPath,[\s\S]*\}\)/);
  assert.match(routeBody, /const appServerResult = filterThreadListByCwd\(appServerVisibleResult, cwd\)/);
  assert.match(routeBody, /Object\.assign\(timings, threadListAppServerLatencyTimingFields\(\{[\s\S]*rawResult: appServerRawResult,[\s\S]*visibleResult: appServerVisibleResult,[\s\S]*filteredResult: appServerResult,[\s\S]*totalMs: appServerElapsedMs,[\s\S]*rpcDiagnostics: appServerRpcDiagnostics,[\s\S]*\}\)\)/);
  assert.match(appServerFetchPolicyJs, /appServerRequestLimit/);
  assert.match(appServerFetchPolicyJs, /appServerRequestReason/);
  assert.match(appServerFetchPolicyJs, /appServerRpcMs/);
  assert.match(appServerFetchPolicyJs, /appServerUnattributedMs/);
  assert.match(appServerFetchPolicyJs, /appServerRawCount/);
  assert.match(appServerFetchPolicyJs, /appServerResponsePayloadBytes/);
  assert.match(routeBody, /readThreadListCachedFallback\(limit, \{ cwd, searchTerm, globalState, diagnostics: fallbackDiagnostics \}\)/);
  assert.match(routeBody, /decorated\.mobileDeferredAppServer = true/);
  assert.match(routeBody, /decorated\.mobileInitialSource = "warm-fallback-cache"/);
  assert.match(routeBody, /sendThreadListResult\("warm_fallback_initial"/);
  assert.match(routeBody, /const threadListCoalescing = threadListResponseCoalescer\.begin\(\{/);
  assert.match(routeBody, /await threadListCoalescing\.result\(\)/);
  assert.match(routeBody, /threadListCoalescing\.complete\(result\)/);
  assert.match(routeBody, /threadListCoalescing\.fail\(err\)/);
  assert.match(routeBody, /const shouldDeferFallback = shouldDeferThreadListFallbackForActiveDetail\(\{[\s\S]*deferFallback,[\s\S]*cursor,[\s\S]*archived,[\s\S]*searchTerm,[\s\S]*cwd,[\s\S]*\}\);/);
  assert.match(routeBody, /fallbackDeferred: true/);
  assert.match(routeBody, /fallbackDeferredReason: deferFallback \? "client" : "active-thread-detail"/);
  assert.match(routeBody, /const deferredMergeOptions = getMergeThreadSummaryListOptions\(\)/);
  assert.match(routeBody, /const indexedResult = normalizeThreadListResultStatuses\(hydrateThreadListResultTitlesFromSessionIndex\([\s\S]*appServerResult,[\s\S]*deferredMergeOptions\.sessionIndexEntries,[\s\S]*\)\)/);
  assert.match(routeBody, /attachThreadListStateToResult\(indexedResult\)/);
  assert.match(routeBody, /decorated\.mobileDeferredFallback = true/);
  assert.match(routeBody, /sendThreadListResult\("deferred_complete"/);
  assert.match(routeBody, /sendThreadListResult\("complete"/);
  assert.match(routeBody, /const fullMergeOptions = getMergeThreadSummaryListOptions\(\)/);
  assert.match(routeBody, /const fallback = readThreadListFallback\(limit, \{[\s\S]*cwd,[\s\S]*searchTerm,[\s\S]*globalState,[\s\S]*diagnostics: fallbackDiagnostics,[\s\S]*archivedIds: fullMergeOptions\.archivedIds,[\s\S]*mergeThreadSummaryListOptions: fullMergeOptions,[\s\S]*\}\);/);
  assert.match(routeBody, /const routeMerge = mergeThreadListRouteResult\(\{[\s\S]*result: appServerResult,[\s\S]*fallbackThreads: fallback,[\s\S]*limit,[\s\S]*mergeThreadSummaryList: mergeThreadSummaryListWithDiagnostics,[\s\S]*mergeThreadSummaryListOptions: fullMergeOptions,[\s\S]*\}\);/);
  assert.match(routeBody, /dropDuplicateFallbackThreads: true/);
  assert.match(routeBody, /Object\.assign\(timings, routeMerge\.diagnostics\)/);
  assert.match(routeBody, /normalizeThreadListResultStatuses\(routeMerge\.result\)/);
  assert.match(routeBody, /normalizeThreadSummaryLiveStatus\(attachThreadTaskCardCountsToSummary\(thread\)\)/);
  const threadReadIndex = serverJs.indexOf('const threadRead = url.pathname.match(/^\\/api\\/threads\\/([^/]+)$/);');
  const threadReadBody = serverJs.slice(threadReadIndex, serverJs.indexOf('const threadTurns = url.pathname.match', threadReadIndex));
  assert.match(threadReadBody, /trackThreadDetailRequestLifecycle\(res\);/);
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

test("local turn-start overlay keeps summaries active over immediate idle rows", () => {
  const threadId = "019e9000-0000-7000-8000-localactive1";
  rememberLocalActiveThreadStatus(threadId, "turn-local-active", { source: "test" });
  try {
    const result = mergeThreadListFallback({
      data: [{
        id: threadId,
        name: "Home AI",
        updatedAt: 1780722169,
        status: { type: "idle" },
      }],
    }, [], 10);

    assert.equal(result.data[0].status.type, "active");
    assert.equal(result.data[0].activeTurnId, "turn-local-active");
    assert.equal(result.data[0].mobileLocalActiveStatus.source, "test");
  } finally {
    clearLocalActiveThreadStatus(threadId);
  }
});

test("local turn-start overlay clears when rollout tail has a later terminal event", () => {
  const threadId = "019e9000-0000-7000-8000-localactive2";
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-local-active-"));
  const rolloutPath = path.join(tempDir, `rollout-2099-01-01T00-00-00-${threadId}.jsonl`);
  rememberLocalActiveThreadStatus(threadId, "turn-local-active", { source: "test" });
  try {
    fs.writeFileSync(rolloutPath, JSON.stringify({
      type: "event_msg",
      timestamp: new Date(Date.now() + 1000).toISOString(),
      payload: {
        type: "task_complete",
        turn_id: "turn-local-active",
      },
    }), "utf8");

    const summary = applyLocalActiveThreadStatusToSummary({
      id: threadId,
      name: "Home AI",
      path: rolloutPath,
      updatedAt: 1780722169,
      status: { type: "idle" },
    });

    assert.equal(summary.status.type, "idle");
    assert.equal(summary.activeTurnId, undefined);
  } finally {
    clearLocalActiveThreadStatus(threadId);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("local turn-start overlay yields to a different materialized rollout active turn", () => {
  const threadId = "019e9000-0000-7000-8000-localactive3";
  const localTurnId = "turn-local-active";
  const materializedTurnId = "turn-rollout-active";
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-local-active-materialized-"));
  const rolloutPath = path.join(tempDir, `rollout-2099-01-01T00-00-00-${threadId}.jsonl`);
  rememberLocalActiveThreadStatus(threadId, localTurnId, { source: "test" });
  try {
    const timestamp = new Date(Date.now() + 1000).toISOString();
    fs.writeFileSync(rolloutPath, [
      JSON.stringify({
        type: "event_msg",
        timestamp,
        payload: {
          type: "task_started",
          turn_id: materializedTurnId,
        },
      }),
      JSON.stringify({
        type: "event_msg",
        timestamp,
        payload: {
          type: "agent_message",
          turn_id: materializedTurnId,
          message: "working",
        },
      }),
    ].join("\n") + "\n", "utf8");

    const summary = applyLocalActiveThreadStatusToSummary({
      id: threadId,
      name: "Music",
      path: rolloutPath,
      updatedAt: 1780722169,
      status: { type: "active" },
    });

    assert.equal(summary.status.type, "active");
    assert.equal(summary.activeTurnId, undefined);
    assert.equal(summary.mobileLocalActiveStatus, undefined);
  } finally {
    clearLocalActiveThreadStatus(threadId);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("thread detail compaction drops empty local active shell when rollout has a materialized active turn", () => {
  const threadId = "019e9000-0000-7000-8000-localactive4";
  const localTurnId = "turn-local-active";
  const materializedTurnId = "turn-rollout-active";
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-active-shell-"));
  const rolloutPath = path.join(tempDir, `rollout-2099-01-01T00-00-00-${threadId}.jsonl`);
  try {
    const timestamp = new Date(Date.now() - 1000).toISOString();
    fs.writeFileSync(rolloutPath, [
      JSON.stringify({
        type: "event_msg",
        timestamp,
        payload: {
          type: "task_started",
          turn_id: materializedTurnId,
        },
      }),
      JSON.stringify({
        type: "event_msg",
        timestamp,
        payload: {
          type: "agent_message",
          turn_id: materializedTurnId,
          message: "working",
        },
      }),
    ].join("\n") + "\n", "utf8");

    const compacted = compactThread({
      id: threadId,
      name: "Music",
      path: rolloutPath,
      updatedAt: 1780722169,
      status: { type: "active" },
      activeTurnId: localTurnId,
      turns: [{
        id: materializedTurnId,
        status: null,
        items: [{ id: "agent-1", type: "agentMessage", text: "working" }],
      }, {
        id: localTurnId,
        status: { type: "inProgress" },
        items: [],
      }],
    }, { nowMs: Date.now() });

    assert.equal(compacted.activeTurnId, materializedTurnId);
    assert.equal(compacted.status.type, "active");
    assert.equal(compacted.turns.length, 1);
    assert.equal(compacted.turns[0].id, materializedTurnId);
    assert.equal(compacted.turns[0].status.type, "active");
    assert.ok(compacted.turns[0].startedAt);
    assert.equal(compacted.mobileDroppedUnmaterializedLocalActiveTurn, localTurnId);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("thread detail compaction drops empty live shell from resting thread projection", () => {
  const compacted = compactThread({
    id: "019e9000-0000-7000-8000-localactive5",
    name: "Music",
    updatedAt: 1780722169,
    status: { type: "idle" },
    activeTurnId: "turn-local-active",
    turns: [{
      id: "turn-completed",
      status: { type: "completed" },
      startedAt: 1780722100,
      completedAt: 1780722169,
      items: [{ id: "agent-1", type: "agentMessage", text: "done" }],
    }, {
      id: "turn-local-active",
      status: { type: "inProgress" },
      items: [],
    }],
  });

  assert.equal(compacted.status.type, "idle");
  assert.equal(compacted.activeTurnId, undefined);
  assert.equal(compacted.turns.length, 1);
  assert.equal(compacted.turns[0].id, "turn-completed");
  assert.equal(compacted.mobileDroppedUnmaterializedRestingActiveTurn, "turn-local-active");
});

test("thread detail compaction appends latest rollout completion when turns-list omits it", () => {
  const threadId = "019e9000-0000-7000-8000-rolloutdone1";
  const latestTurnId = "turn-rollout-completed";
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-rollout-completion-"));
  const rolloutPath = path.join(tempDir, `rollout-2099-01-01T00-00-00-${threadId}.jsonl`);
  try {
    const completedAt = new Date(Date.now() - 1000);
    fs.writeFileSync(rolloutPath, [
      JSON.stringify({
        type: "event_msg",
        timestamp: new Date(completedAt.getTime() - 120000).toISOString(),
        payload: {
          type: "task_started",
          turn_id: latestTurnId,
        },
      }),
      JSON.stringify({
        type: "event_msg",
        timestamp: completedAt.toISOString(),
        payload: {
          type: "task_complete",
          turn_id: latestTurnId,
          completed_at: completedAt.toISOString(),
          duration_ms: 120000,
          last_agent_message: "latest completed receipt",
        },
      }),
    ].join("\n") + "\n", "utf8");

    const compacted = compactThread({
      id: threadId,
      name: "Music",
      path: rolloutPath,
      updatedAt: Math.floor(completedAt.getTime() / 1000),
      status: { type: "idle" },
      turns: [{
        id: "older-turn",
        status: { type: "completed" },
        startedAt: Math.floor((completedAt.getTime() - 500000) / 1000),
        completedAt: Math.floor((completedAt.getTime() - 450000) / 1000),
        items: [{ id: "older-agent", type: "agentMessage", text: "older" }],
      }],
    });

    const latest = compacted.turns.find((turn) => turn.id === latestTurnId);
    assert.ok(latest);
    assert.equal(latest.status, "completed");
    assert.equal(latest.mobileSyntheticCompletionTurn, true);
    assert.equal(latest.durationMs, 120000);
    assert.equal(latest.items.length, 1);
    assert.equal(latest.items[0].type, "agentMessage");
    assert.equal(latest.items[0].text, "latest completed receipt");
    assert.equal(compacted.mobileAppendedRolloutCompletionTurn, latestTurnId);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("thread detail compaction appends latest rollout completion from final jsonl line without newline", () => {
  const threadId = "019e9000-0000-7000-8000-rolloutdone2";
  const latestTurnId = "turn-rollout-completed-eof";
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-rollout-completion-eof-"));
  const rolloutPath = path.join(tempDir, `rollout-2099-01-01T00-00-00-${threadId}.jsonl`);
  try {
    const completedAt = new Date(Date.now() - 1000);
    fs.writeFileSync(rolloutPath, [
      JSON.stringify({
        type: "event_msg",
        timestamp: new Date(completedAt.getTime() - 60000).toISOString(),
        payload: {
          type: "task_started",
          turn_id: latestTurnId,
        },
      }),
      JSON.stringify({
        type: "event_msg",
        timestamp: completedAt.toISOString(),
        payload: {
          type: "task_complete",
          turn_id: latestTurnId,
          completed_at: completedAt.toISOString(),
          duration_ms: 60000,
          last_agent_message: "latest completed receipt without newline",
        },
      }),
    ].join("\n"), "utf8");

    const compacted = compactThread({
      id: threadId,
      name: "Music",
      path: rolloutPath,
      updatedAt: Math.floor(completedAt.getTime() / 1000),
      status: { type: "completed" },
      turns: [{
        id: "older-turn",
        status: { type: "completed" },
        startedAt: Math.floor((completedAt.getTime() - 500000) / 1000),
        completedAt: Math.floor((completedAt.getTime() - 450000) / 1000),
        items: [{ id: "older-agent", type: "agentMessage", text: "older" }],
      }],
    });

    const latest = compacted.turns.find((turn) => turn.id === latestTurnId);
    assert.ok(latest);
    assert.equal(latest.mobileSyntheticCompletionTurn, true);
    assert.equal(latest.items[0].text, "latest completed receipt without newline");
    assert.equal(compacted.mobileAppendedRolloutCompletionTurn, latestTurnId);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("thread list merge does not let notLoaded rows erase settled status", () => {
  const threadId = "019e9000-0000-7000-8000-000000000011";
  const result = mergeThreadListFallback({
    data: [{
      id: threadId,
      name: "Live 2 final",
      updatedAt: 1780722169,
      status: { type: "completed" },
    }],
  }, [{
    id: threadId,
    name: "Live 2 final",
    updatedAt: 1780722170,
    status: { type: "notLoaded" },
    mobileFallback: true,
  }], 10);

  assert.equal(result.data[0].status.type, "completed");
});

test("thread list summaries strip detail-only fields from app-server and fallback rows", () => {
  const dirtySummary = {
    id: "019e9000-0000-7000-8000-000000000099",
    name: "Music",
    preview: "Music",
    updatedAt: 1782446410,
    status: { type: "idle" },
    turns: [],
    runtimeSettings: { permissionMode: "custom" },
    threadTaskCards: [{ id: "ttc-private" }],
    pendingServerRequests: [{ id: "request-private" }],
    mobileDetailLoaded: true,
    mobileLoading: false,
    mobileLoadError: "",
    mobileReadMode: "projection-v4-dynamic",
    mobileDiagnostics: { privateShape: true },
    mobileProjectionVersion: "v4",
    mobileVisibleItemKeys: ["private-visible-key"],
    mobileOlderTurnsCursor: "private-cursor",
    pendingTaskCardCount: 2,
  };

  const stripped = stripThreadListDetailFields(dirtySummary);
  for (const field of [
    "turns",
    "runtimeSettings",
    "threadTaskCards",
    "pendingServerRequests",
    "mobileDetailLoaded",
    "mobileLoading",
    "mobileLoadError",
    "mobileReadMode",
    "mobileDiagnostics",
    "mobileProjectionVersion",
    "mobileVisibleItemKeys",
    "mobileOlderTurnsCursor",
  ]) {
    assert.equal(Object.prototype.hasOwnProperty.call(stripped, field), false, `${field} should not be a list field`);
  }
  assert.equal(stripped.id, dirtySummary.id);
  assert.equal(stripped.name, "Music");
  assert.equal(stripped.pendingTaskCardCount, 2);

  const strippedResult = stripThreadListResultDetailFields({ data: [dirtySummary], threads: [dirtySummary] });
  assert.equal(Object.prototype.hasOwnProperty.call(strippedResult.data[0], "turns"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(strippedResult.threads[0], "mobileDetailLoaded"), false);
});

test("thread list merge strips empty detail authority from app-server list rows", () => {
  const threadId = "019e9000-0000-7000-8000-000000000098";
  const result = mergeThreadListFallback({
    data: [{
      id: threadId,
      name: "Music",
      preview: "Music",
      updatedAt: 1782446410,
      status: { type: "idle" },
      turns: [],
      mobileDetailLoaded: true,
      mobileReadMode: "projection-v4-dynamic",
      mobileProjectionVersion: "v4",
      mobileVisibleItemKeys: ["stale-key"],
      threadTaskCards: [{ id: "stale-card" }],
    }],
  }, [{
    id: threadId,
    name: "Music",
    updatedAt: 1782446411,
    status: { type: "idle" },
    mobileFallback: true,
    turns: [{ id: "fallback-detail-should-not-leak" }],
    mobileDiagnostics: { stale: true },
  }], 10);

  assert.equal(result.data[0].id, threadId);
  assert.equal(result.data[0].mobileFallback, true);
  for (const field of ["turns", "mobileDetailLoaded", "mobileReadMode", "mobileProjectionVersion", "mobileVisibleItemKeys", "threadTaskCards", "mobileDiagnostics"]) {
    assert.equal(Object.prototype.hasOwnProperty.call(result.data[0], field), false, `${field} should be stripped from merged list row`);
  }
});

test("thread list merge upgrades notLoaded rows from fallback settled status", () => {
  const threadId = "019e9000-0000-7000-8000-000000000012";
  const result = mergeThreadListFallback({
    data: [{
      id: threadId,
      name: "Live 2 final",
      updatedAt: 1780722169,
      status: { type: "notLoaded" },
    }],
  }, [{
    id: threadId,
    name: "Live 2 final",
    updatedAt: 1780722160,
    status: { type: "completed" },
    mobileFallback: true,
  }], 10);

  assert.equal(result.data[0].status.type, "completed");
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

test("turn sorting keeps timestamped completions after unknown fallback rows", () => {
  const sorted = sortTurnsChronologically([
    {
      id: "019ef3e3-5671-73a0-b10e-6fa6bd84b08e",
      status: { type: "completed" },
      completedAt: 1782208276,
      items: [{ type: "agentMessage", text: "latest" }],
    },
    {
      id: "rollout-94836",
      status: { type: "completed" },
      items: [{ type: "agentMessage", text: "older fallback without timestamp" }],
    },
  ]);

  assert.deepEqual(sorted.map((turn) => turn.id), [
    "rollout-94836",
    "019ef3e3-5671-73a0-b10e-6fa6bd84b08e",
  ]);
});

test("turn sorting keeps timestamp-less live turns after completed history", () => {
  const sorted = sortTurnsChronologically([
    {
      id: "live-shell",
      status: { type: "inProgress" },
      items: [],
    },
    {
      id: "completed-turn",
      status: { type: "completed" },
      completedAt: 1782208276,
      items: [{ type: "agentMessage", text: "done" }],
    },
  ]);

  assert.deepEqual(sorted.map((turn) => turn.id), [
    "completed-turn",
    "live-shell",
  ]);
});
