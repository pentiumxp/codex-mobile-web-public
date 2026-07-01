"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildThreadListWorkspaceRows,
  filterSupersededInactiveDuplicateWorkspaces,
} = require("../services/thread-list/thread-list-workspace-merge-service");

test("workspace merge hides inactive empty duplicate when active same-label workspace exists", () => {
  const rows = buildThreadListWorkspaceRows({
    roots: [
      "/Users/hermes-dev/HermesMobileDev/plugins/music",
      "/Users/xuxin/Documents/Music",
    ],
    registeredWorkspaces: [
      { cwd: "/Users/hermes-dev/HermesMobileDev/plugins/music", label: "Music" },
      { cwd: "/Users/xuxin/Documents/Music", label: "Music" },
    ],
    activeWorkspaceRoots: ["/Users/hermes-dev/HermesMobileDev/plugins/music"],
    recentThreads: [],
  });

  assert.deepEqual(rows, [{
    cwd: "/Users/hermes-dev/HermesMobileDev/plugins/music",
    label: "Music",
    active: true,
    recentThreadCount: 0,
    source: "mobile",
  }]);
});

test("workspace merge keeps inactive duplicate when it still owns recent threads", () => {
  const rows = buildThreadListWorkspaceRows({
    roots: [
      "/Users/hermes-dev/HermesMobileDev/plugins/music",
      "/Users/xuxin/Documents/Music",
    ],
    registeredWorkspaces: [
      { cwd: "/Users/hermes-dev/HermesMobileDev/plugins/music", label: "Music" },
      { cwd: "/Users/xuxin/Documents/Music", label: "Music" },
    ],
    activeWorkspaceRoots: ["/Users/hermes-dev/HermesMobileDev/plugins/music"],
    recentThreads: [
      { id: "old-music-thread", cwd: "/Users/xuxin/Documents/Music" },
    ],
  });

  assert.deepEqual(rows.map((row) => [row.cwd, row.active, row.recentThreadCount]), [
    ["/Users/hermes-dev/HermesMobileDev/plugins/music", true, 0],
    ["/Users/xuxin/Documents/Music", false, 1],
  ]);
});

test("workspace merge keeps inactive duplicate when no same-label workspace is active", () => {
  const rows = filterSupersededInactiveDuplicateWorkspaces([
    { cwd: "/old/Music", label: "Music", active: false, recentThreadCount: 0 },
    { cwd: "/new/Music", label: "Music", active: false, recentThreadCount: 0 },
  ]);

  assert.equal(rows.length, 2);
});

test("workspace merge preserves active-first label sort for distinct workspaces", () => {
  const rows = buildThreadListWorkspaceRows({
    roots: ["/work/Notes", "/work/Music", "/work/Alpha"],
    registeredWorkspaces: [
      { cwd: "/work/Notes", label: "Notes" },
      { cwd: "/work/Music", label: "Music" },
      { cwd: "/work/Alpha", label: "Alpha" },
    ],
    activeWorkspaceRoots: ["/work/Music"],
    recentThreads: [],
  });

  assert.deepEqual(rows.map((row) => row.label), ["Music", "Alpha", "Notes"]);
});
