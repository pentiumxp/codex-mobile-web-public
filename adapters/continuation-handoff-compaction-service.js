"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function safeStamp(date = new Date()) {
  const value = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  return value.toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "")
    .replace("T", "_");
}

function byteLength(text) {
  return Buffer.byteLength(String(text || ""), "utf8");
}

function lineCount(text) {
  const value = String(text || "");
  if (!value) return 0;
  const lines = value.split(/\r?\n/).length;
  return value.endsWith("\n") ? lines - 1 : lines;
}

function trimToRecentSections(text, maxChars) {
  const value = String(text || "");
  const limit = Math.max(1000, Number(maxChars || 0));
  if (value.length <= limit) return value.trim();

  const hardStart = Math.max(0, value.length - limit);
  const tail = value.slice(hardStart);
  const sectionMatch = tail.match(/\n#{1,3}\s+[^\n]+/);
  if (sectionMatch && sectionMatch.index > 0) {
    return value.slice(hardStart + sectionMatch.index + 1).trim();
  }
  const previousHeadingStart = value.lastIndexOf("\n##", hardStart);
  const start = previousHeadingStart >= 0 && value.length - previousHeadingStart <= limit * 3
    ? previousHeadingStart + 1
    : hardStart;
  return value.slice(start).trim();
}

function trimHeadAndTail(text, maxChars) {
  const value = String(text || "").trim();
  const limit = Math.max(1000, Number(maxChars || 0));
  if (value.length <= limit) return value;
  const headChars = Math.min(500, Math.max(200, Math.floor(limit * 0.25)));
  const tailChars = Math.max(500, limit - headChars);
  const head = value.slice(0, headChars).trimEnd();
  const tail = trimToRecentSections(value, tailChars);
  return [
    head,
    "",
    "...(archived middle omitted; read the archive path above when older details are needed)...",
    "",
    tail,
  ].join("\n").trim();
}

function nextAvailableArchiveDir(root, stamp) {
  const base = path.join(root, `.agent-context`, "archive", `context-compaction-${stamp}`);
  if (!fs.existsSync(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not allocate handoff archive directory under ${path.dirname(base)}`);
}

function assertInside(parent, child) {
  const parentResolved = path.resolve(parent);
  const childResolved = path.resolve(child);
  if (childResolved === parentResolved || childResolved.startsWith(`${parentResolved}${path.sep}`)) return;
  throw new Error(`Refusing to write outside ${parentResolved}: ${childResolved}`);
}

function gitPathState(cwd, targetPath) {
  const relativePath = path.relative(cwd, targetPath);
  const state = {
    relativePath,
    ignored: false,
    tracked: false,
    gitAvailable: false,
    error: "",
  };
  try {
    const gitDir = spawnSync("git", ["rev-parse", "--git-dir"], {
      cwd,
      encoding: "utf8",
      timeout: 3000,
      windowsHide: true,
    });
    if (gitDir.status !== 0) {
      state.error = "not-git-worktree";
      return state;
    }
    state.gitAvailable = true;
    const ignored = spawnSync("git", ["check-ignore", "-q", "--", relativePath], {
      cwd,
      encoding: "utf8",
      timeout: 3000,
      windowsHide: true,
    });
    state.ignored = ignored.status === 0;
    const tracked = spawnSync("git", ["ls-files", "--error-unmatch", "--", relativePath], {
      cwd,
      encoding: "utf8",
      timeout: 3000,
      windowsHide: true,
    });
    state.tracked = tracked.status === 0;
  } catch (err) {
    state.error = err && err.message ? err.message : String(err);
  }
  return state;
}

function fileReport(cwd, filePath, stat = null, text = "") {
  const git = gitPathState(cwd, filePath);
  return {
    path: filePath,
    relativePath: path.relative(cwd, filePath),
    exists: Boolean(stat),
    bytes: stat ? stat.size : 0,
    lines: stat ? lineCount(text) : 0,
    git,
  };
}

function buildCompactedHandoff({ cwd, originalText, originalBytes, archivePath, preservedText, date }) {
  const stamp = (date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()).toISOString();
  return [
    "# HANDOFF",
    "",
    `Last compacted: ${stamp}`,
    "",
    "This active handoff was automatically compacted before a Codex Mobile continuation.",
    "The previous full handoff was archived and should be opened only when old provenance is explicitly needed.",
    "",
    "## Compaction Summary",
    "",
    `- Workspace: \`${cwd}\``,
    `- Original active handoff bytes: \`${originalBytes}\``,
    `- Archived full handoff: \`${archivePath}\``,
    `- Preserved recent active context chars: \`${String(preservedText || "").length}\``,
    "",
    "## Startup Guidance",
    "",
    "- Read `.agent-context/PROJECT_CONTEXT.md` first.",
    "- Read this compact `.agent-context/HANDOFF.md` for current status.",
    "- Do not load the archived full handoff unless the user asks for old provenance or the compact handoff is insufficient.",
    "- Keep future handoff updates concise: current state, changed files, validation, risks, and next steps.",
    "- Do not store raw secrets, tokens, one-time approvals, hidden UI state, long logs, or bulky generated output.",
    "",
    "## Preserved Recent Handoff Tail",
    "",
    preservedText || "(no recent handoff text preserved)",
    "",
  ].join("\n");
}

function buildCompactedProjectContext({ cwd, originalBytes, archivePath, preservedText, date }) {
  const stamp = (date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()).toISOString();
  return [
    "# PROJECT_CONTEXT",
    "",
    `Last compacted: ${stamp}`,
    "",
    "This live project context was automatically compacted before a Codex Mobile continuation.",
    "The full previous context was archived and should be read only when this routing index is insufficient.",
    "",
    "## Compaction Summary",
    "",
    `- Workspace: \`${cwd}\``,
    `- Original project context bytes: \`${originalBytes}\``,
    `- Archived full project context: \`${archivePath}\``,
    `- Preserved live excerpt chars: \`${String(preservedText || "").length}\``,
    "",
    "## Source Of Truth",
    "",
    "1. Current repository files and runtime checks.",
    "2. Latest source-thread handoff under `.agent-context/thread-handoffs/` for explicit continuation threads.",
    "3. This compact `.agent-context/PROJECT_CONTEXT.md` and `.agent-context/HANDOFF.md`.",
    "4. Focused docs under `docs/`.",
    "5. Archived full context only when old provenance is explicitly needed.",
    "",
    "## Startup Guidance",
    "",
    "- Read `.agent-context/HANDOFF.md` after this file.",
    "- Read `docs/README.md`, then the smallest relevant focused doc.",
    "- Keep raw secrets, tokens, one-time approvals, upload contents, full rollout logs, and `.codex` runtime state out of shared context and Git.",
    "- Do not load the archived full project context by default. Load it only when the user asks about older provenance, a missing rule, or a historical decision not present in live docs.",
    "",
    "## Preserved Project Context Excerpt",
    "",
    preservedText || "(no project context excerpt preserved)",
    "",
  ].join("\n");
}

function buildWorkspaceContextManifest({ cwd, date, thresholdBytes, combinedThresholdBytes, preserveChars, files }) {
  const stamp = (date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()).toISOString();
  return JSON.stringify({
    kind: "codex-mobile-workspace-context-compaction",
    version: 1,
    createdAt: stamp,
    workspace: cwd,
    thresholdBytes,
    combinedThresholdBytes,
    preserveChars,
    files,
  }, null, 2);
}

function compactWorkspaceHandoff(options = {}) {
  const cwd = String(options.cwd || "").trim();
  if (!cwd) return { checked: false, compacted: false, reason: "missing-cwd" };

  const thresholdBytes = Math.max(1, Number(options.thresholdBytes || 0));
  const preserveChars = Math.max(1000, Number(options.preserveChars || 0));
  const now = typeof options.now === "function" ? options.now() : (options.now || new Date());
  const handoffPath = path.join(cwd, ".agent-context", "HANDOFF.md");

  let stat;
  try {
    stat = fs.statSync(handoffPath);
  } catch (err) {
    return {
      checked: true,
      compacted: false,
      reason: err && err.code === "ENOENT" ? "missing" : "stat-failed",
      handoffPath,
      error: err && err.code === "ENOENT" ? "" : (err.message || String(err)),
    };
  }

  if (!stat.isFile()) {
    return { checked: true, compacted: false, reason: "not-file", handoffPath };
  }
  if (stat.size <= thresholdBytes) {
    return {
      checked: true,
      compacted: false,
      reason: "below-threshold",
      handoffPath,
      originalBytes: stat.size,
      thresholdBytes,
    };
  }

  const originalText = fs.readFileSync(handoffPath, "utf8");
  const stamp = safeStamp(now);
  const archiveDir = nextAvailableArchiveDir(cwd, stamp);
  const archivePath = path.join(archiveDir, "HANDOFF.full.md");
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.copyFileSync(handoffPath, archivePath);

  const preservedText = trimToRecentSections(originalText, preserveChars);
  const compactedText = buildCompactedHandoff({
    cwd,
    originalText,
    originalBytes: stat.size,
    archivePath,
    preservedText,
    date: now,
  });
  fs.writeFileSync(handoffPath, compactedText, "utf8");

  return {
    checked: true,
    compacted: true,
    reason: "compacted",
    handoffPath,
    archivePath,
    originalBytes: stat.size,
    compactedBytes: byteLength(compactedText),
    thresholdBytes,
    preservedChars: preservedText.length,
  };
}

function compactWorkspaceContext(options = {}) {
  const cwd = String(options.cwd || "").trim();
  if (!cwd) return { checked: false, compacted: false, reason: "missing-cwd" };

  const agentContextDir = path.join(cwd, ".agent-context");
  if (!fs.existsSync(agentContextDir)) {
    return { checked: true, compacted: false, reason: "missing-agent-context", agentContextDir };
  }

  const thresholdBytes = Math.max(1, Number(options.thresholdBytes || 0));
  const combinedThresholdBytes = Math.max(thresholdBytes, Number(options.combinedThresholdBytes || thresholdBytes));
  const preserveChars = Math.max(1000, Number(options.preserveChars || 0));
  const now = typeof options.now === "function" ? options.now() : (options.now || new Date());
  const projectPath = path.join(agentContextDir, "PROJECT_CONTEXT.md");
  const handoffPath = path.join(agentContextDir, "HANDOFF.md");
  const agentsPath = path.join(cwd, "AGENTS.md");
  const paths = [
    { key: "projectContext", path: projectPath, archiveName: "PROJECT_CONTEXT.full-before-context-budget.md" },
    { key: "handoff", path: handoffPath, archiveName: "HANDOFF.full-before-context-budget.md" },
  ];

  const files = [];
  for (const entry of paths) {
    let stat = null;
    let text = "";
    try {
      stat = fs.statSync(entry.path);
      if (!stat.isFile()) stat = null;
      if (stat) text = fs.readFileSync(entry.path, "utf8");
    } catch (_) {
      stat = null;
    }
    files.push(Object.assign({}, entry, {
      stat,
      text,
      before: fileReport(cwd, entry.path, stat, text),
    }));
  }

  let agentsStat = null;
  let agentsText = "";
  try {
    agentsStat = fs.statSync(agentsPath);
    if (!agentsStat.isFile()) agentsStat = null;
    if (agentsStat) agentsText = fs.readFileSync(agentsPath, "utf8");
  } catch (_) {
    agentsStat = null;
  }
  const agents = fileReport(cwd, agentsPath, agentsStat, agentsText);

  const existing = files.filter((entry) => entry.stat);
  if (!existing.length) {
    return {
      checked: true,
      compacted: false,
      reason: "missing-context-files",
      files: files.map((entry) => entry.before),
      agents,
    };
  }

  const combinedBytes = existing.reduce((sum, entry) => sum + entry.stat.size, 0);
  const overIndividualThreshold = existing.some((entry) => entry.stat.size > thresholdBytes);
  const overCombinedThreshold = combinedBytes > combinedThresholdBytes;
  if (!overIndividualThreshold && !overCombinedThreshold) {
    return {
      checked: true,
      compacted: false,
      reason: "below-threshold",
      thresholdBytes,
      combinedThresholdBytes,
      combinedBytes,
      files: files.map((entry) => entry.before),
      agents,
    };
  }

  const stamp = safeStamp(now);
  const archiveDir = nextAvailableArchiveDir(cwd, stamp);
  assertInside(agentContextDir, archiveDir);
  const archiveGit = gitPathState(cwd, archiveDir);
  if (archiveGit.gitAvailable && !archiveGit.ignored) {
    return {
      checked: true,
      compacted: false,
      reason: "archive-not-ignored",
      archiveDir,
      archiveGit,
      thresholdBytes,
      combinedThresholdBytes,
      combinedBytes,
      files: files.map((entry) => entry.before),
      agents,
    };
  }
  fs.mkdirSync(archiveDir, { recursive: true });

  const archiveReports = [];
  for (const entry of existing) {
    const archivePath = path.join(archiveDir, entry.archiveName);
    assertInside(archiveDir, archivePath);
    fs.copyFileSync(entry.path, archivePath);
    archiveReports.push({
      key: entry.key,
      sourcePath: entry.path,
      archivePath,
      archiveRelativePath: path.relative(cwd, archivePath),
      originalBytes: entry.stat.size,
      originalLines: lineCount(entry.text),
    });
  }

  const project = files.find((entry) => entry.key === "projectContext");
  if (project && project.stat) {
    const archive = archiveReports.find((entry) => entry.key === "projectContext");
    const compactedText = buildCompactedProjectContext({
      cwd,
      originalBytes: project.stat.size,
      archivePath: archive.archivePath,
      preservedText: trimHeadAndTail(project.text, preserveChars),
      date: now,
    });
    fs.writeFileSync(project.path, compactedText, "utf8");
  }

  const handoff = files.find((entry) => entry.key === "handoff");
  if (handoff && handoff.stat) {
    const archive = archiveReports.find((entry) => entry.key === "handoff");
    const preservedText = trimToRecentSections(handoff.text, preserveChars);
    const compactedText = buildCompactedHandoff({
      cwd,
      originalText: handoff.text,
      originalBytes: handoff.stat.size,
      archivePath: archive.archivePath,
      preservedText,
      date: now,
    });
    fs.writeFileSync(handoff.path, compactedText, "utf8");
  }

  const afterFiles = files.map((entry) => {
    let stat = null;
    let text = "";
    try {
      stat = fs.statSync(entry.path);
      if (!stat.isFile()) stat = null;
      if (stat) text = fs.readFileSync(entry.path, "utf8");
    } catch (_) {
      stat = null;
    }
    return Object.assign({}, entry.before, {
      afterBytes: stat ? stat.size : 0,
      afterLines: stat ? lineCount(text) : 0,
      compacted: Boolean(entry.stat && stat),
      archivePath: (archiveReports.find((archive) => archive.key === entry.key) || {}).archivePath || "",
    });
  });
  const afterBytes = afterFiles.reduce((sum, entry) => sum + Number(entry.afterBytes || 0), 0);
  const manifestPath = path.join(archiveDir, "MANIFEST.json");
  const manifestFiles = afterFiles.map((entry) => ({
    relativePath: entry.relativePath,
    beforeBytes: entry.bytes,
    beforeLines: entry.lines,
    afterBytes: entry.afterBytes,
    afterLines: entry.afterLines,
    archivePath: entry.archivePath ? path.relative(cwd, entry.archivePath) : "",
    git: entry.git,
  }));
  fs.writeFileSync(manifestPath, buildWorkspaceContextManifest({
    cwd,
    date: now,
    thresholdBytes,
    combinedThresholdBytes,
    preserveChars,
    files: manifestFiles,
  }), "utf8");

  return {
    checked: true,
    compacted: true,
    reason: "compacted",
    archiveDir,
    manifestPath,
    archiveGit,
    thresholdBytes,
    combinedThresholdBytes,
    combinedBytes,
    originalBytes: combinedBytes,
    compactedBytes: afterBytes,
    reductionPercent: combinedBytes > 0 ? Math.round((1 - (afterBytes / combinedBytes)) * 1000) / 10 : 0,
    files: afterFiles,
    archives: archiveReports,
    agents,
  };
}

module.exports = {
  buildCompactedHandoff,
  buildCompactedProjectContext,
  compactWorkspaceContext,
  compactWorkspaceHandoff,
  safeStamp,
  trimHeadAndTail,
  trimToRecentSections,
};
