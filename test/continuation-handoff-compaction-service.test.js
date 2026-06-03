"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const {
  compactWorkspaceContext,
  compactWorkspaceHandoff,
  trimToRecentSections,
} = require("../adapters/continuation-handoff-compaction-service");

function makeWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-handoff-"));
  fs.mkdirSync(path.join(root, ".agent-context"), { recursive: true });
  return root;
}

function initIgnoredAgentContext(root) {
  fs.writeFileSync(path.join(root, ".gitignore"), ".agent-context/\n", "utf8");
  const result = spawnSync("git", ["init"], {
    cwd: root,
    encoding: "utf8",
    timeout: 5000,
    windowsHide: true,
  });
  return result.status === 0;
}

test("compacts workspace project context and handoff with full archives and manifest", (t) => {
  const cwd = makeWorkspace();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const gitReady = initIgnoredAgentContext(cwd);

  const projectPath = path.join(cwd, ".agent-context", "PROJECT_CONTEXT.md");
  const handoffPath = path.join(cwd, ".agent-context", "HANDOFF.md");
  const agentsPath = path.join(cwd, "AGENTS.md");
  const projectText = [
    "# PROJECT_CONTEXT",
    "",
    "## Durable Rules",
    "keep repo safety and public sync rules",
    "old project context ".repeat(900),
    "## Current Anchors",
    "latest architecture pointer",
  ].join("\n");
  const handoffText = [
    "# HANDOFF",
    "",
    "## Old Work",
    "old handoff ".repeat(900),
    "## Current State",
    "keep latest validation and runtime state",
  ].join("\n");
  fs.writeFileSync(projectPath, projectText, "utf8");
  fs.writeFileSync(handoffPath, handoffText, "utf8");
  fs.writeFileSync(agentsPath, "# AGENTS\n\nshort routing rules\n", "utf8");

  const result = compactWorkspaceContext({
    cwd,
    thresholdBytes: 200,
    combinedThresholdBytes: 300,
    preserveChars: 1200,
    now: new Date("2026-06-03T08:00:00Z"),
  });

  assert.equal(result.compacted, true);
  assert.equal(result.reason, "compacted");
  assert.ok(result.archiveDir.endsWith(path.join(".agent-context", "archive", "context-compaction-20260603_080000")));
  assert.ok(result.manifestPath.endsWith(path.join(".agent-context", "archive", "context-compaction-20260603_080000", "MANIFEST.json")));
  const projectArchive = path.join(result.archiveDir, "PROJECT_CONTEXT.full-before-context-budget.md");
  const handoffArchive = path.join(result.archiveDir, "HANDOFF.full-before-context-budget.md");
  assert.equal(fs.readFileSync(projectArchive, "utf8"), projectText);
  assert.equal(fs.readFileSync(handoffArchive, "utf8"), handoffText);

  const compactProject = fs.readFileSync(projectPath, "utf8");
  assert.match(compactProject, /automatically compacted before a Codex Mobile continuation/);
  assert.match(compactProject, /Archived full project context:/);
  assert.match(compactProject, /latest architecture pointer/);
  assert.ok(Buffer.byteLength(compactProject, "utf8") < Buffer.byteLength(projectText, "utf8") * 0.5);

  const compactHandoff = fs.readFileSync(handoffPath, "utf8");
  assert.match(compactHandoff, /automatically compacted before a Codex Mobile continuation/);
  assert.match(compactHandoff, /Archived full handoff:/);
  assert.match(compactHandoff, /Before changing any latest-version, backup, deployment, or runtime-state fact/);
  assert.match(compactHandoff, /keep latest validation and runtime state/);
  assert.doesNotMatch(compactHandoff, /old handoff old handoff old handoff/);

  const manifest = JSON.parse(fs.readFileSync(result.manifestPath, "utf8"));
  assert.equal(manifest.kind, "codex-mobile-workspace-context-compaction");
  assert.equal(manifest.files.length, 2);
  assert.equal(result.files.length, 2);
  assert.ok(result.reductionPercent > 0);
  assert.equal(result.agents.exists, true);
  assert.equal(result.agents.bytes, Buffer.byteLength("# AGENTS\n\nshort routing rules\n", "utf8"));
  if (gitReady) {
    assert.equal(result.files[0].git.ignored, true);
    assert.equal(result.files[1].git.ignored, true);
  }
});

test("creates an archive ignore guard before archiving full context in git workspaces", (t) => {
  const cwd = makeWorkspace();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const git = spawnSync("git", ["init"], {
    cwd,
    encoding: "utf8",
    timeout: 5000,
    windowsHide: true,
  });
  if (git.status !== 0) return;

  const projectPath = path.join(cwd, ".agent-context", "PROJECT_CONTEXT.md");
  const handoffPath = path.join(cwd, ".agent-context", "HANDOFF.md");
  fs.writeFileSync(projectPath, "# PROJECT_CONTEXT\n\n" + "project ".repeat(200), "utf8");
  fs.writeFileSync(handoffPath, "# HANDOFF\n\n" + "handoff ".repeat(200), "utf8");

  const result = compactWorkspaceContext({
    cwd,
    thresholdBytes: 200,
    combinedThresholdBytes: 300,
    preserveChars: 1000,
    now: new Date("2026-06-03T08:10:00Z"),
  });

  assert.equal(result.compacted, true);
  assert.equal(result.reason, "compacted");
  assert.equal(result.archiveIgnore.created, true);
  assert.ok(result.archiveIgnore.path.endsWith(path.join(".agent-context", "archive", ".gitignore")));
  assert.equal(fs.readFileSync(result.archiveIgnore.path, "utf8"), "# Archived full workspace context must stay out of commits.\n*\n!.gitignore\n");
  assert.equal(result.archiveGit.ignored, true);
  const ignoredArchive = spawnSync("git", ["check-ignore", "-q", "--", path.relative(cwd, result.archiveDir)], {
    cwd,
    encoding: "utf8",
    timeout: 5000,
    windowsHide: true,
  });
  assert.equal(ignoredArchive.status, 0);
  assert.equal(fs.existsSync(path.join(result.archiveDir, "PROJECT_CONTEXT.full-before-context-budget.md")), true);
  assert.equal(fs.existsSync(path.join(result.archiveDir, "HANDOFF.full-before-context-budget.md")), true);
});

test("compacts oversized workspace handoff and archives the full original", (t) => {
  const cwd = makeWorkspace();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));

  const handoffPath = path.join(cwd, ".agent-context", "HANDOFF.md");
  const oldText = [
    "# HANDOFF",
    "",
    "## Very Old",
    "old line ".repeat(1200),
    "## Recent Important",
    "keep this current deployment note",
    "more recent detail ".repeat(80),
  ].join("\n");
  fs.writeFileSync(handoffPath, oldText, "utf8");

  const result = compactWorkspaceHandoff({
    cwd,
    thresholdBytes: 200,
    preserveChars: 180,
    now: new Date("2026-05-23T14:30:00Z"),
  });

  assert.equal(result.compacted, true);
  assert.equal(result.reason, "compacted");
  assert.ok(result.archivePath.endsWith(path.join(".agent-context", "archive", "context-compaction-20260523_143000", "HANDOFF.full.md")));
  assert.equal(fs.readFileSync(result.archivePath, "utf8"), oldText);

  const compacted = fs.readFileSync(handoffPath, "utf8");
  assert.match(compacted, /automatically compacted before a Codex Mobile continuation/);
  assert.match(compacted, /Archived full handoff:/);
  assert.match(compacted, /Recent Important/);
  assert.match(compacted, /keep this current deployment note/);
  assert.doesNotMatch(compacted, /old line old line old line/);
  assert.ok(Buffer.byteLength(compacted, "utf8") < Buffer.byteLength(oldText, "utf8"));
});

test("single handoff compaction creates archive ignore guard in git workspaces", (t) => {
  const cwd = makeWorkspace();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const git = spawnSync("git", ["init"], {
    cwd,
    encoding: "utf8",
    timeout: 5000,
    windowsHide: true,
  });
  if (git.status !== 0) return;

  const handoffPath = path.join(cwd, ".agent-context", "HANDOFF.md");
  fs.writeFileSync(handoffPath, "# HANDOFF\n\n## Old\n" + "old ".repeat(1000) + "\n## Now\nkeep current\n", "utf8");

  const result = compactWorkspaceHandoff({
    cwd,
    thresholdBytes: 200,
    preserveChars: 200,
    now: new Date("2026-06-03T08:20:00Z"),
  });

  assert.equal(result.compacted, true);
  assert.equal(result.archiveIgnore.created, true);
  assert.equal(result.archiveGit.ignored, true);
  assert.equal(fs.existsSync(result.archivePath), true);
  const ignoredArchive = spawnSync("git", ["check-ignore", "-q", "--", path.relative(cwd, result.archiveDir)], {
    cwd,
    encoding: "utf8",
    timeout: 5000,
    windowsHide: true,
  });
  assert.equal(ignoredArchive.status, 0);
});

test("does not compact handoff below threshold", (t) => {
  const cwd = makeWorkspace();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));

  const handoffPath = path.join(cwd, ".agent-context", "HANDOFF.md");
  fs.writeFileSync(handoffPath, "# HANDOFF\n\nsmall\n", "utf8");

  const result = compactWorkspaceHandoff({
    cwd,
    thresholdBytes: 1024,
    preserveChars: 100,
  });

  assert.equal(result.compacted, false);
  assert.equal(result.reason, "below-threshold");
  assert.equal(fs.readFileSync(handoffPath, "utf8"), "# HANDOFF\n\nsmall\n");
});

test("recent section trimming starts at a heading when possible", () => {
  const text = [
    "# HANDOFF",
    "old ".repeat(200),
    "## Older",
    "older ".repeat(200),
    "## Current",
    "current fact",
  ].join("\n");

  const trimmed = trimToRecentSections(text, 120);

  assert.match(trimmed, /^## Current/);
  assert.match(trimmed, /current fact/);
  assert.doesNotMatch(trimmed, /Older/);
});
