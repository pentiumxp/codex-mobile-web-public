"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  compactWorkspaceHandoff,
  trimToRecentSections,
} = require("../adapters/continuation-handoff-compaction-service");

function makeWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-handoff-"));
  fs.mkdirSync(path.join(root, ".agent-context"), { recursive: true });
  return root;
}

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
