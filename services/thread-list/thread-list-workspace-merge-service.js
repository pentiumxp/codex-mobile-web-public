"use strict";

const path = require("node:path");

function defaultNormalizeFsPath(value) {
  return String(value || "")
    .replace(/^\\\\\?\\/, "")
    .replace(/[\\/]+/g, "\\")
    .replace(/\\+$/, "")
    .toLowerCase();
}

function labelKey(value) {
  return String(value || "").trim().toLowerCase();
}

function workspaceLabelForCwd(cwd, registryEntry) {
  if (registryEntry && registryEntry.label) return registryEntry.label;
  return path.basename(String(cwd || "").replace(/^\\\\\?\\/, "")) || cwd;
}

function mapRegisteredWorkspaces(workspaces = [], normalizeFsPath = defaultNormalizeFsPath) {
  const out = new Map();
  for (const workspace of Array.isArray(workspaces) ? workspaces : []) {
    if (!workspace || !workspace.cwd) continue;
    out.set(normalizeFsPath(workspace.cwd), workspace);
  }
  return out;
}

function countRecentThreadsByWorkspace(recentThreads = [], normalizeFsPath = defaultNormalizeFsPath) {
  const counts = new Map();
  for (const thread of Array.isArray(recentThreads) ? recentThreads : []) {
    if (!thread || !thread.cwd) continue;
    const key = normalizeFsPath(thread.cwd);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function filterSupersededInactiveDuplicateWorkspaces(rows = []) {
  const activeLabels = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || row.active !== true) continue;
    const key = labelKey(row.label);
    if (key) activeLabels.add(key);
  }
  if (!activeLabels.size) return Array.isArray(rows) ? rows.slice() : [];

  return rows.filter((row) => {
    if (!row || row.active === true) return true;
    if (Number(row.recentThreadCount || 0) > 0) return true;
    const key = labelKey(row.label);
    return !key || !activeLabels.has(key);
  });
}

function sortWorkspaceRows(rows = []) {
  return rows.slice().sort((a, b) => Number(b.active) - Number(a.active) || a.label.localeCompare(b.label));
}

function buildThreadListWorkspaceRows(input = {}) {
  const normalizeFsPath = typeof input.normalizeFsPath === "function"
    ? input.normalizeFsPath
    : defaultNormalizeFsPath;
  const roots = input.roots instanceof Set ? [...input.roots] : Array.isArray(input.roots) ? input.roots : [];
  const registered = input.registered instanceof Map
    ? input.registered
    : mapRegisteredWorkspaces(input.registeredWorkspaces, normalizeFsPath);
  const counts = input.recentThreadCounts instanceof Map
    ? input.recentThreadCounts
    : countRecentThreadsByWorkspace(input.recentThreads, normalizeFsPath);
  const activeRoots = Array.isArray(input.activeWorkspaceRoots) ? input.activeWorkspaceRoots : [];
  const activeKeys = new Set(activeRoots.map(normalizeFsPath).filter(Boolean));

  const rows = roots.map((cwd) => {
    const key = normalizeFsPath(cwd);
    const registryEntry = registered.get(key);
    return {
      cwd,
      label: workspaceLabelForCwd(cwd, registryEntry),
      active: activeRoots.includes(cwd) || activeKeys.has(key),
      recentThreadCount: counts.get(key) || 0,
      source: registryEntry ? "mobile" : "codex",
    };
  });

  return sortWorkspaceRows(filterSupersededInactiveDuplicateWorkspaces(rows));
}

module.exports = {
  buildThreadListWorkspaceRows,
  countRecentThreadsByWorkspace,
  defaultNormalizeFsPath,
  filterSupersededInactiveDuplicateWorkspaces,
  mapRegisteredWorkspaces,
  sortWorkspaceRows,
};
