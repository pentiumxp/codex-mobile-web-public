"use strict";

const fs = require("fs");
const path = require("path");

function createRateLimitRuntimeService(options = {}) {
  const {
    archivedSessionsDir,
    codexHome,
    incrementBoundedDiagnosticCounter = () => {},
    isRateLimitRolloutSourceAccountScoped = () => false,
    modelOptions = [],
    sessionsDir,
  } = options;
  const codexHomeProvider = typeof codexHome === "function" ? codexHome : () => codexHome;
  const archivedSessionsDirProvider = typeof archivedSessionsDir === "function" ? archivedSessionsDir : () => archivedSessionsDir;
  const sessionsDirProvider = typeof sessionsDir === "function" ? sessionsDir : () => sessionsDir;
  const MODEL_OPTIONS = Array.isArray(modelOptions) ? modelOptions : [];
  let latestLiveRateLimits = null;
  let latestLiveRateLimitsSource = null;
  let latestSnapshotRateLimits = null;
  const latestLiveRateLimitsByModel = new Map();
  const latestSnapshotRateLimitsByModel = new Map();
  let lastRolloutRateLimitScanAt = 0;
  let activeCodexHomeKey = null;

  function currentCodexHome() {
    return String(codexHomeProvider() || "");
  }

  function currentSessionsDir() {
    return sessionsDirProvider() || path.join(currentCodexHome(), "sessions");
  }

  function currentArchivedSessionsDir() {
    return archivedSessionsDirProvider() || path.join(currentCodexHome(), "archived_sessions");
  }

  function codexHomeKey() {
    const home = currentCodexHome();
    return home ? path.resolve(home).toLowerCase() : "";
  }

  function resetRateLimitSnapshots() {
    latestLiveRateLimits = null;
    latestLiveRateLimitsSource = null;
    latestSnapshotRateLimits = null;
    latestLiveRateLimitsByModel.clear();
    latestSnapshotRateLimitsByModel.clear();
    lastRolloutRateLimitScanAt = 0;
  }

  function resetIfActiveCodexHomeChanged() {
    const key = codexHomeKey();
    if (activeCodexHomeKey === null) {
      activeCodexHomeKey = key;
      return false;
    }
    if (key === activeCodexHomeKey) return false;
    activeCodexHomeKey = key;
    resetRateLimitSnapshots();
    return true;
  }

  function compactRateLimitWindow(value) {
    if (!value || typeof value !== "object") return null;
    const usedPercent = value.usedPercent ?? value.used_percent;
    const windowDurationMins = value.windowDurationMins ?? value.window_minutes;
    const resetsAt = value.resetsAt ?? value.resets_at;
    return Object.fromEntries(Object.entries({
      usedPercent: Number.isFinite(Number(usedPercent)) ? Number(usedPercent) : undefined,
      windowDurationMins: Number.isFinite(Number(windowDurationMins)) ? Number(windowDurationMins) : undefined,
      resetsAt: Number.isFinite(Number(resetsAt)) ? Number(resetsAt) : undefined,
    }).filter(([, entry]) => entry !== undefined));
  }

  function compactRateLimits(value) {
    if (!value || typeof value !== "object") return null;
    const compacted = Object.fromEntries(Object.entries({
      limitId: value.limitId || value.limit_id || undefined,
      limitName: value.limitName || value.limit_name || undefined,
      model: value.model || undefined,
      primary: compactRateLimitWindow(value.primary),
      secondary: compactRateLimitWindow(value.secondary),
      credits: value.credits || null,
      planType: value.planType || value.plan_type || undefined,
      rateLimitReachedType: value.rateLimitReachedType || value.rate_limit_reached_type || null,
    }).filter(([, entry]) => entry !== undefined));
    const modelKeys = rateLimitModelKeys(compacted);
    if (modelKeys.length) compacted.modelKeys = modelKeys;
    return compacted;
  }

  function normalizeModelKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-")
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function addRateLimitModelKey(keys, value) {
    const key = normalizeModelKey(value);
    if (key) keys.add(key);
  }

  function isSparkModelKey(key) {
    return /\bspark\b/.test(normalizeModelKey(key));
  }

  function rateLimitModelKeys(rateLimits) {
    if (!rateLimits || typeof rateLimits !== "object") return [];
    const keys = new Set();
    if (Array.isArray(rateLimits.modelKeys)) {
      for (const value of rateLimits.modelKeys) addRateLimitModelKey(keys, value);
    }
    addRateLimitModelKey(keys, rateLimits.model);
    addRateLimitModelKey(keys, rateLimits.limitName);
    const limitNameKey = normalizeModelKey(rateLimits.limitName);
    for (const model of MODEL_OPTIONS) {
      const modelKey = normalizeModelKey(model);
      if (modelKey && limitNameKey === modelKey) keys.add(modelKey);
    }
    const limitId = normalizeModelKey(rateLimits.limitId);
    if (limitId === "codex-bengalfox") keys.add("gpt-5.3-codex-spark");
    else if (limitId === "codex") {
      for (const model of MODEL_OPTIONS) {
        const modelKey = normalizeModelKey(model);
        if (modelKey && !isSparkModelKey(modelKey)) keys.add(modelKey);
      }
    }
    return [...keys];
  }

  function rateLimitWindows(rateLimits) {
    return [rateLimits && rateLimits.primary, rateLimits && rateLimits.secondary]
      .filter((windowInfo) => windowInfo && Number.isFinite(Number(windowInfo.usedPercent)));
  }

  function hasCurrentRateLimitWindow(rateLimits) {
    const nowSeconds = Date.now() / 1000;
    return rateLimitWindows(rateLimits).some((windowInfo) => {
      const resetsAt = Number(windowInfo.resetsAt || 0);
      return !resetsAt || resetsAt > nowSeconds;
    });
  }

  function isTrustedLiveRateLimitSource(source) {
    return source === "managed-child-live" || source === "profile-mux-live";
  }

  function storeRateLimits(compacted, byModel) {
    for (const key of compacted.modelKeys || rateLimitModelKeys(compacted)) {
      byModel.set(normalizeModelKey(key), compacted);
    }
    return compacted;
  }

  function recordRateLimits(value, options = {}) {
    resetIfActiveCodexHomeChanged();
    const compacted = compactRateLimits(value);
    if (!compacted || !hasCurrentRateLimitWindow(compacted)) return null;
    const source = String(options.source || "live");
    if (options.source === "rollout") {
      latestSnapshotRateLimits = compacted;
      return storeRateLimits(compacted, latestSnapshotRateLimitsByModel);
    }
    if (!isRateLimitRolloutSourceAccountScoped(currentCodexHome()) && !isTrustedLiveRateLimitSource(source)) {
      latestLiveRateLimits = null;
      latestLiveRateLimitsSource = null;
      latestLiveRateLimitsByModel.clear();
      return null;
    }
    latestLiveRateLimits = compacted;
    latestLiveRateLimitsSource = source;
    return storeRateLimits(compacted, latestLiveRateLimitsByModel);
  }

  function recordRateLimitReadResult(value, options = {}) {
    resetIfActiveCodexHomeChanged();
    if (!value || typeof value !== "object") return null;
    const source = String(options.source || "live");
    if (source !== "rollout" && !isRateLimitRolloutSourceAccountScoped(currentCodexHome()) && !isTrustedLiveRateLimitSource(source)) {
      latestLiveRateLimits = null;
      latestLiveRateLimitsSource = null;
      latestLiveRateLimitsByModel.clear();
      return null;
    }

    const snapshots = [];
    const addSnapshot = (raw, fallbackLimitId = "") => {
      if (!raw || typeof raw !== "object") return;
      const candidate = fallbackLimitId && !raw.limitId
        ? Object.assign({ limitId: fallbackLimitId }, raw)
        : raw;
      const compacted = compactRateLimits(candidate);
      if (!compacted || !hasCurrentRateLimitWindow(compacted)) return;
      snapshots.push(compacted);
    };

    addSnapshot(value.rateLimits);
    if (value.rateLimitsByLimitId && typeof value.rateLimitsByLimitId === "object") {
      for (const [limitId, snapshot] of Object.entries(value.rateLimitsByLimitId)) {
        addSnapshot(snapshot, limitId);
      }
    }

    if (snapshots.length === 0) return null;
    const targetMap = source === "rollout" ? latestSnapshotRateLimitsByModel : latestLiveRateLimitsByModel;
    for (const snapshot of snapshots) storeRateLimits(snapshot, targetMap);
    const preferred = snapshots.find((snapshot) => normalizeModelKey(snapshot.limitId) === "codex") || snapshots[0];
    if (source === "rollout") {
      latestSnapshotRateLimits = preferred;
    } else {
      latestLiveRateLimits = preferred;
      latestLiveRateLimitsSource = source;
    }
    return preferred;
  }

  function canExposeRateLimitsForActiveHome() {
    resetIfActiveCodexHomeChanged();
    return isRateLimitRolloutSourceAccountScoped(currentCodexHome()) || isTrustedLiveRateLimitSource(latestLiveRateLimitsSource);
  }

  function activeRateLimits() {
    if (!canExposeRateLimitsForActiveHome()) return null;
    return latestLiveRateLimits || latestSnapshotRateLimits;
  }

  function activeRateLimitsByModelMap() {
    if (!canExposeRateLimitsForActiveHome()) return new Map();
    return latestLiveRateLimitsByModel.size ? latestLiveRateLimitsByModel : latestSnapshotRateLimitsByModel;
  }

  function liveQuotaSnapshotForProfiles() {
    if (!canExposeRateLimitsForActiveHome()) {
      return { rateLimits: null, rateLimitsByModel: {}, source: null };
    }
    return {
      rateLimits: latestLiveRateLimits,
      rateLimitsByModel: Object.fromEntries([...latestLiveRateLimitsByModel.entries()]),
      source: latestLiveRateLimits ? (latestLiveRateLimitsSource || "active-live") : null,
    };
  }

  function compareRecentRolloutDirents(left, right) {
    const leftIsDir = Boolean(left && typeof left.isDirectory === "function" && left.isDirectory());
    const rightIsDir = Boolean(right && typeof right.isDirectory === "function" && right.isDirectory());
    if (leftIsDir !== rightIsDir) return leftIsDir ? -1 : 1;
    const leftName = String(left && left.name || "");
    const rightName = String(right && right.name || "");
    if (leftName === rightName) return 0;
    return leftName < rightName ? 1 : -1;
  }

  function collectRecentRolloutFiles(root, options = {}) {
    const maxFiles = Number(options.maxFiles || 160);
    const maxDepth = Number(options.maxDepth || 6);
    const diagnostics = options.diagnostics && typeof options.diagnostics === "object" ? options.diagnostics : null;
    const out = [];
    const visit = (dir, depth) => {
      if (out.length >= maxFiles * 4 || depth > maxDepth) return;
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
        incrementBoundedDiagnosticCounter(diagnostics, "rolloutDirectoryReadCount");
      } catch (_) {
        return;
      }
      for (const entry of entries.sort(compareRecentRolloutDirents)) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          visit(fullPath, depth + 1);
          continue;
        }
        if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
        try {
          incrementBoundedDiagnosticCounter(diagnostics, "rolloutFileStatCount");
          const stat = fs.statSync(fullPath);
          out.push({ path: fullPath, mtimeMs: Number(stat.mtimeMs || 0), size: Number(stat.size || 0) });
          incrementBoundedDiagnosticCounter(diagnostics, "rolloutFileCollectedCount");
        } catch (_) {
          // A rollout may disappear while the app rotates files.
        }
      }
    };
    visit(root, 0);
    incrementBoundedDiagnosticCounter(diagnostics, "rolloutFileSortedCount", out.length);
    return out
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, maxFiles);
  }

  function readRolloutTailForRateLimits(filePath, maxBytes = 2 * 1024 * 1024) {
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || stat.size <= 0) return "";
      const bytesToRead = Math.min(maxBytes, stat.size);
      const fd = fs.openSync(filePath, "r");
      try {
        const buffer = Buffer.alloc(bytesToRead);
        fs.readSync(fd, buffer, 0, bytesToRead, stat.size - bytesToRead);
        return buffer.toString("utf8");
      } finally {
        fs.closeSync(fd);
      }
    } catch (_) {
      return "";
    }
  }

  function loadRecentRateLimitsFromRollouts(options = {}) {
    resetIfActiveCodexHomeChanged();
    const now = Date.now();
    const force = options.force === true;
    if (!force && now - lastRolloutRateLimitScanAt < 60000) return;
    lastRolloutRateLimitScanAt = now;
    if (!isRateLimitRolloutSourceAccountScoped(currentCodexHome())) return;
    const files = [
      ...collectRecentRolloutFiles(currentSessionsDir(), { maxFiles: 140 }),
      ...collectRecentRolloutFiles(currentArchivedSessionsDir(), { maxFiles: 60, maxDepth: 1 }),
    ].sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 180);
    const latestByGroup = new Map();
    for (const file of files) {
      const tail = readRolloutTailForRateLimits(file.path);
      if (!tail.includes("rate_limits")) continue;
      const lines = tail.split(/\r?\n/).filter(Boolean).reverse();
      for (const line of lines) {
        let entry;
        try {
          entry = JSON.parse(line);
        } catch (_) {
          continue;
        }
        const rateLimits = entry && entry.payload && entry.payload.rate_limits;
        const compacted = compactRateLimits(rateLimits);
        if (!compacted || !hasCurrentRateLimitWindow(compacted)) continue;
        const group = normalizeModelKey(compacted.limitId);
        if (!group) continue;
        const eventMs = Date.parse(entry.timestamp || "") || file.mtimeMs || 0;
        const existing = latestByGroup.get(group);
        if (!existing || eventMs > existing.eventMs) {
          latestByGroup.set(group, { eventMs, rateLimits: compacted });
        }
      }
    }
    for (const entry of [...latestByGroup.values()].sort((a, b) => a.eventMs - b.eventMs)) {
      recordRateLimits(entry.rateLimits, { source: "rollout" });
    }
  }

  function rateLimitsByModelObject() {
    return Object.fromEntries([...activeRateLimitsByModelMap().entries()]);
  }


  return {
    compactRateLimitWindow,
    compactRateLimits,
    normalizeModelKey,
    addRateLimitModelKey,
    isSparkModelKey,
    rateLimitModelKeys,
    rateLimitWindows,
    hasCurrentRateLimitWindow,
    isTrustedLiveRateLimitSource,
    storeRateLimits,
    recordRateLimits,
    recordRateLimitReadResult,
    canExposeRateLimitsForActiveHome,
    activeRateLimits,
    activeRateLimitsByModelMap,
    liveQuotaSnapshotForProfiles,
    compareRecentRolloutDirents,
    collectRecentRolloutFiles,
    readRolloutTailForRateLimits,
    resetRateLimitSnapshots,
    loadRecentRateLimitsFromRollouts,
    rateLimitsByModelObject,
    latestLiveRateLimits: () => {
      resetIfActiveCodexHomeChanged();
      return latestLiveRateLimits;
    },
  };
}

module.exports = {
  createRateLimitRuntimeService,
};
