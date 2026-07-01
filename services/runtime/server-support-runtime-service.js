"use strict";

const { createAppMaintenanceService } = require("../../adapters/app-maintenance-service");

function timestampToMs(value) {
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

function compactOneLine(value, maxChars = 80) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 3))}...`;
}

function shortIdentifier(value) {
  const text = String(value || "").trim();
  if (text.length <= 16) return text;
  return `${text.slice(0, 8)}...${text.slice(-4)}`;
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch (_) {
    return null;
  }
}

function clonePlainJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function turnListFromResult(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result && result.data)) return result.data;
  if (Array.isArray(result && result.turns)) return result.turns;
  return [];
}

function lastString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function incrementBoundedDiagnosticCounter(diagnostics, key, amount = 1) {
  if (!diagnostics || typeof diagnostics !== "object") return;
  if (!/^[a-z][a-zA-Z0-9]{0,80}$/.test(String(key || ""))) return;
  const current = Number(diagnostics[key] || 0);
  const delta = Number(amount || 0);
  if (!Number.isFinite(delta) || delta <= 0) return;
  const next = (Number.isFinite(current) && current > 0 ? current : 0) + delta;
  diagnostics[key] = Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(next));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpStatusError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function httpStatusErrorWithDetails(statusCode, code, message, details = {}) {
  const err = httpStatusError(statusCode, message || code);
  err.code = code;
  err.details = details && typeof details === "object" ? details : {};
  return err;
}

function isUnmaterializedThreadError(err) {
  return /not materialized yet|includeTurns is unavailable before first user message/i.test(err && err.message || String(err || ""));
}

function createServerSupportRuntimeService(dependencies = {}) {
  const appMaintenanceFactory = dependencies.appMaintenanceServiceFactory || createAppMaintenanceService;
  const appMaintenanceService = appMaintenanceFactory({
    appRoot: dependencies.appRoot,
    appVersion: dependencies.appVersion,
    appUpdateRemote: dependencies.appUpdateRemote,
    appUpdateBranch: dependencies.appUpdateBranch,
    appUpdateDisabled: dependencies.appUpdateDisabled,
    appUpdateCheckTimeoutMs: dependencies.appUpdateCheckTimeoutMs,
    appUpdateApplyTimeoutMs: dependencies.appUpdateApplyTimeoutMs,
    appUpdateRestartDelayMs: dependencies.appUpdateRestartDelayMs,
    appUpdateCacheMs: dependencies.appUpdateCacheMs,
    publicPrCheckDisabled: dependencies.publicPrCheckDisabled,
    publicPrRepository: dependencies.publicPrRepository,
    publicPrCheckTimeoutMs: dependencies.publicPrCheckTimeoutMs,
    publicPrCheckCacheMs: dependencies.publicPrCheckCacheMs,
    githubLinkPreviewTimeoutMs: dependencies.githubLinkPreviewTimeoutMs,
    githubLinkPreviewCacheMs: dependencies.githubLinkPreviewCacheMs,
    publicReleaseCheckDisabled: dependencies.publicReleaseCheckDisabled,
    publicReleaseRepository: dependencies.publicReleaseRepository,
    publicReleaseBranch: dependencies.publicReleaseBranch,
    publicReleaseCheckCacheMs: dependencies.publicReleaseCheckCacheMs,
    shutdown: dependencies.shutdown,
  });

  return Object.assign({
    appMaintenanceService,
    clonePlainJson,
    compactOneLine,
    httpStatusError,
    httpStatusErrorWithDetails,
    incrementBoundedDiagnosticCounter,
    isUnmaterializedThreadError,
    lastString,
    parseJsonLine,
    shortIdentifier,
    sleep,
    timestampToMs,
    turnListFromResult,
  }, appMaintenanceService);
}

module.exports = {
  clonePlainJson,
  compactOneLine,
  createServerSupportRuntimeService,
  httpStatusError,
  httpStatusErrorWithDetails,
  incrementBoundedDiagnosticCounter,
  isUnmaterializedThreadError,
  lastString,
  parseJsonLine,
  shortIdentifier,
  sleep,
  timestampToMs,
  turnListFromResult,
};
