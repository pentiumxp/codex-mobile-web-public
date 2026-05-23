"use strict";

const fs = require("node:fs");
const path = require("node:path");

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

function nextAvailableArchiveDir(root, stamp) {
  const base = path.join(root, `.agent-context`, "archive", `context-compaction-${stamp}`);
  if (!fs.existsSync(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not allocate handoff archive directory under ${path.dirname(base)}`);
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

module.exports = {
  buildCompactedHandoff,
  compactWorkspaceHandoff,
  safeStamp,
  trimToRecentSections,
};
