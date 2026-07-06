"use strict";

const fs = require("node:fs");
const path = require("node:path");

const THREAD_DISPLAY_MAX_PANES = 12;
const FRONTEND_DIAGNOSTIC_LOG_DEFAULT_SCOPES = Object.freeze(["submitted_echo"]);

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function defaultTimestampToMs(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }
  if (/^\d+(?:\.\d+)?$/.test(String(value))) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeThreadDisplayThreadId(value) {
  const text = String(value || "").trim();
  if (!text || text.length > 220) return "";
  return text;
}

function normalizeThreadDisplayPaneCount(value, fallback = 0) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(THREAD_DISPLAY_MAX_PANES, parsed));
}

function normalizeThreadDisplaySplitPairs(values = [], paneThreadIds = []) {
  const idSet = new Set((paneThreadIds || []).map(normalizeThreadDisplayThreadId).filter(Boolean));
  const used = new Set();
  const pairs = [];
  for (const value of Array.isArray(values) ? values : []) {
    const anchorId = normalizeThreadDisplayThreadId(Array.isArray(value) ? value[0] : value && (value.anchorId || value.topId || value.primaryId));
    const childId = normalizeThreadDisplayThreadId(Array.isArray(value) ? value[1] : value && (value.childId || value.bottomId || value.secondaryId));
    if (!anchorId || !childId || anchorId === childId) continue;
    if (idSet.size && (!idSet.has(anchorId) || !idSet.has(childId))) continue;
    if (used.has(anchorId) || used.has(childId)) continue;
    used.add(anchorId);
    used.add(childId);
    pairs.push({ anchorId, childId });
    if (pairs.length >= Math.floor(THREAD_DISPLAY_MAX_PANES / 2)) break;
  }
  return pairs;
}

function normalizeThreadDisplayMode(value, fallback = "single") {
  const text = String(value || "").trim().toLowerCase();
  if (text === "tile" || text === "tiles" || text === "tiled") return "tile";
  if (text === "single" || text === "normal") return "single";
  return fallback === "tile" ? "tile" : "single";
}

function normalizeFrontendDiagnosticLogScopes(value) {
  const raw = Array.isArray(value) ? value.join(",") : String(value || "");
  const scopes = raw
    .split(/[,\s]+/g)
    .map((item) => item.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_"))
    .filter(Boolean);
  const uniqueScopes = uniqueStrings(scopes).slice(0, 24);
  return uniqueScopes.length
    ? uniqueScopes
    : FRONTEND_DIAGNOSTIC_LOG_DEFAULT_SCOPES.slice();
}

function normalizeFrontendDiagnosticLogMaxEntries(value, fallback = 400) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(25, Math.min(2000, parsed));
}

function normalizeFrontendDiagnosticLogSettings(raw = {}, options = {}) {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    enabled: Boolean(input.enabled),
    upload: input.upload === false ? false : true,
    scopes: normalizeFrontendDiagnosticLogScopes(input.scopes),
    maxEntries: normalizeFrontendDiagnosticLogMaxEntries(input.maxEntries),
    updatedAt: String(input.updatedAt || ""),
    source: options.source || "runtime",
  };
}

function normalizeThreadDisplaySettings(raw = {}, options = {}) {
  const timestampToMs = typeof options.timestampToMs === "function" ? options.timestampToMs : defaultTimestampToMs;
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const hasExplicitMode = Object.prototype.hasOwnProperty.call(input, "displayMode")
    || Object.prototype.hasOwnProperty.call(input, "mode");
  let displayMode = normalizeThreadDisplayMode(input.displayMode || input.mode, "single");
  if (!hasExplicitMode && input.threadTileMode === true) displayMode = "tile";
  if (!hasExplicitMode && input.threadTileMode === false) displayMode = "single";
  const rawPaneIds = Array.isArray(input.paneThreadIds)
    ? input.paneThreadIds
    : Array.isArray(input.threadTilePinnedIds)
      ? input.threadTilePinnedIds
      : Array.isArray(input.threadIds)
        ? input.threadIds
        : [];
  const paneThreadIds = uniqueStrings(rawPaneIds)
    .map(normalizeThreadDisplayThreadId)
    .filter(Boolean)
    .slice(0, THREAD_DISPLAY_MAX_PANES);
  const selectedThreadId = normalizeThreadDisplayThreadId(input.selectedThreadId);
  const paneCount = normalizeThreadDisplayPaneCount(
    Object.prototype.hasOwnProperty.call(input, "paneCount")
      ? input.paneCount
      : Object.prototype.hasOwnProperty.call(input, "threadTilePaneCount")
        ? input.threadTilePaneCount
        : input.tilePaneCount,
    0,
  );
  const paneSplitPairs = normalizeThreadDisplaySplitPairs(
    input.paneSplitPairs || input.threadTileSplitPairs || input.splitPairs,
    paneThreadIds,
  );
  const updatedAt = String(input.updatedAt || "").trim();
  const updatedAtMs = timestampToMs(input.updatedAtMs || updatedAt);
  return {
    displayMode,
    threadTileMode: displayMode === "tile",
    paneThreadIds,
    paneCount,
    paneSplitPairs,
    selectedThreadId,
    updatedAt,
    updatedAtMs,
    source: options.source || "runtime",
  };
}

function createRuntimeSettingsService(options = {}) {
  const runtimeSettingsFile = String(options.runtimeSettingsFile || "");
  const timestampToMs = typeof options.timestampToMs === "function" ? options.timestampToMs : defaultTimestampToMs;
  const workspaceDelegationEnvDefault = Boolean(options.workspaceDelegationEnvDefault);
  const workspaceDelegationToolFullName = String(options.workspaceDelegationToolFullName || "");

  function readJsonFile(file, fallback) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (_) {
      return fallback;
    }
  }

  function writeRuntimeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  }

  function readRuntimeSettings() {
    const value = readJsonFile(runtimeSettingsFile, {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function writeRuntimeSettings(patch = {}) {
    const current = readRuntimeSettings();
    const next = Object.assign({}, current, patch, {
      version: 1,
      updatedAt: new Date().toISOString(),
    });
    writeRuntimeJson(runtimeSettingsFile, next);
    return next;
  }

  function threadDisplayPublicSettings(settings = readRuntimeSettings()) {
    const raw = settings && settings.threadDisplay && typeof settings.threadDisplay === "object" && !Array.isArray(settings.threadDisplay)
      ? settings.threadDisplay
      : null;
    return normalizeThreadDisplaySettings(raw || {}, {
      source: raw ? "runtime" : "default",
      timestampToMs,
    });
  }

  function setThreadDisplaySettings(patch = {}) {
    const input = patch && patch.threadDisplay && typeof patch.threadDisplay === "object" && !Array.isArray(patch.threadDisplay)
      ? patch.threadDisplay
      : patch;
    const current = threadDisplayPublicSettings();
    const now = new Date();
    const next = normalizeThreadDisplaySettings(Object.assign({}, current, input || {}, {
      updatedAt: now.toISOString(),
      updatedAtMs: now.getTime(),
    }), { source: "runtime", timestampToMs });
    writeRuntimeSettings({
      threadDisplay: {
        displayMode: next.displayMode,
        paneThreadIds: next.paneThreadIds,
        paneCount: next.paneCount,
        paneSplitPairs: next.paneSplitPairs,
        selectedThreadId: next.selectedThreadId,
        updatedAt: next.updatedAt,
        updatedAtMs: next.updatedAtMs,
      },
    });
    return threadDisplayPublicSettings(readRuntimeSettings());
  }

  function workspaceDelegationPublicSettings(settings = readRuntimeSettings()) {
    const raw = settings && settings.workspaceDelegation && typeof settings.workspaceDelegation === "object"
      ? settings.workspaceDelegation
      : {};
    const hasRuntimeValue = typeof raw.enabled === "boolean";
    const enabled = hasRuntimeValue ? raw.enabled : workspaceDelegationEnvDefault;
    return {
      enabled,
      mode: enabled ? "model_driven_explicit_task_card_with_source_write_guard" : "off",
      directTaskCardAutoApproval: enabled,
      dynamicTool: enabled ? workspaceDelegationToolFullName : "",
      dynamicToolEnabled: enabled,
      ordinarySendPreflight: false,
      localHeuristics: false,
      failureRecovery: enabled ? "source_model_tool_call_with_dynamic_source_write_guard" : "off",
      serverAutoTaskCardFromFailures: false,
      source: hasRuntimeValue ? "runtime" : workspaceDelegationEnvDefault ? "environment" : "default",
      updatedAt: String(raw.updatedAt || ""),
    };
  }

  function setWorkspaceDelegationEnabled(enabled) {
    const nextEnabled = Boolean(enabled);
    const current = readRuntimeSettings();
    const workspaceDelegation = Object.assign({}, current.workspaceDelegation || {}, {
      enabled: nextEnabled,
      updatedAt: new Date().toISOString(),
    });
    writeRuntimeSettings({ workspaceDelegation });
    return workspaceDelegationPublicSettings(readRuntimeSettings());
  }

  function frontendDiagnosticLogPublicSettings(settings = readRuntimeSettings()) {
    const raw = settings && settings.frontendDiagnosticLog && typeof settings.frontendDiagnosticLog === "object" && !Array.isArray(settings.frontendDiagnosticLog)
      ? settings.frontendDiagnosticLog
      : null;
    return normalizeFrontendDiagnosticLogSettings(raw || {}, {
      source: raw ? "runtime" : "default",
    });
  }

  function setFrontendDiagnosticLogSettings(patch = {}) {
    const input = patch && patch.frontendDiagnosticLog && typeof patch.frontendDiagnosticLog === "object" && !Array.isArray(patch.frontendDiagnosticLog)
      ? patch.frontendDiagnosticLog
      : patch;
    const current = frontendDiagnosticLogPublicSettings();
    const next = normalizeFrontendDiagnosticLogSettings(Object.assign({}, current, input || {}, {
      updatedAt: new Date().toISOString(),
    }), { source: "runtime" });
    writeRuntimeSettings({
      frontendDiagnosticLog: {
        enabled: next.enabled,
        upload: next.upload,
        scopes: next.scopes,
        maxEntries: next.maxEntries,
        updatedAt: next.updatedAt,
      },
    });
    return frontendDiagnosticLogPublicSettings(readRuntimeSettings());
  }

  return {
    frontendDiagnosticLogPublicSettings,
    readJsonFile,
    readRuntimeSettings,
    setFrontendDiagnosticLogSettings,
    setThreadDisplaySettings,
    setWorkspaceDelegationEnabled,
    threadDisplayPublicSettings,
    writeRuntimeJson,
    writeRuntimeSettings,
    workspaceDelegationPublicSettings,
  };
}

module.exports = {
  createRuntimeSettingsService,
  normalizeFrontendDiagnosticLogMaxEntries,
  normalizeFrontendDiagnosticLogScopes,
  normalizeFrontendDiagnosticLogSettings,
  normalizeThreadDisplayMode,
  normalizeThreadDisplayPaneCount,
  normalizeThreadDisplaySettings,
  normalizeThreadDisplaySplitPairs,
  normalizeThreadDisplayThreadId,
};
