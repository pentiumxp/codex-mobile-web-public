#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  classifyPhaseBReadback,
} = require("../adapters/phase-b-readback-decision-service");

function usage() {
  return [
    "Usage:",
    "  node scripts/codex-mobile-phase-b-readback-smoke.js [options]",
    "",
    "Reads bounded Codex Mobile Phase B diagnostics from a running server.",
    "It verifies thread-list cold-path attribution and thread-detail timing",
    "diagnostics without printing thread text, titles, upload data, card bodies,",
    "keys, cookies, or logs.",
    "",
    "Options:",
    "  --server <url>              Codex Mobile server. Default: http://127.0.0.1:8787",
    "  --key-file <path>           Access key file. Default: $HOME/.codex-mobile-web/access_key",
    "  --thread-id <id>            Thread id for detail readback. Defaults to first list row.",
    "  --list-limit <n>            Thread-list limit. Default: 20.",
    "  --timeout-ms <n>            Request timeout. Default: 15000.",
    "  --require-active-overlay    Fail unless detail readback is projection-active-overlay.",
    "  --skip-detail               Only validate public-config and thread-list diagnostics.",
    "  --allow-missing-cold-path   Do not fail if old production lacks coldPathOwner fields.",
    "  --no-auth                   Do not send an auth key.",
    "  --json                      Print JSON only.",
    "  --help                      Show this help.",
  ].join("\n");
}

function readPositiveInt(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.floor(number);
}

function normalizeBaseUrl(value) {
  const url = new URL(value || "http://127.0.0.1:8787");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.toString();
}

function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    server: env.CODEX_MOBILE_BASE_URL || "http://127.0.0.1:8787",
    keyFile: env.CODEX_MOBILE_KEY_FILE || path.join(os.homedir(), ".codex-mobile-web", "access_key"),
    threadId: "",
    listLimit: 20,
    timeoutMs: 15000,
    requireActiveOverlay: false,
    requireThreadListColdPath: true,
    skipDetail: false,
    noAuth: false,
    json: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`missing value for ${arg}`);
      return argv[index];
    };
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--server") options.server = next();
    else if (arg === "--key-file") options.keyFile = next();
    else if (arg === "--thread-id") options.threadId = next();
    else if (arg === "--list-limit") options.listLimit = readPositiveInt(next(), options.listLimit);
    else if (arg === "--timeout-ms") options.timeoutMs = readPositiveInt(next(), options.timeoutMs);
    else if (arg === "--require-active-overlay") options.requireActiveOverlay = true;
    else if (arg === "--skip-detail") options.skipDetail = true;
    else if (arg === "--allow-missing-cold-path") options.requireThreadListColdPath = false;
    else if (arg === "--no-auth") options.noAuth = true;
    else if (arg === "--json") options.json = true;
    else throw new Error(`unknown option: ${arg}`);
  }
  options.server = normalizeBaseUrl(options.server);
  options.listLimit = Math.max(1, Math.min(200, options.listLimit));
  return options;
}

function readAccessKey(options = {}, env = process.env) {
  if (options.noAuth) return "";
  const inline = String(env.CODEX_MOBILE_KEY || env.CODEX_MOBILE_ACCESS_KEY || "").trim();
  if (inline) return inline;
  const key = fs.readFileSync(options.keyFile, "utf8").trim();
  if (!key) throw new Error("access key file is empty");
  return key;
}

function requestUrl(options, pathname, params = {}) {
  const url = new URL(pathname.replace(/^\//, ""), options.server);
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function fetchJson(url, options = {}, key = "") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const headers = {};
    if (key) headers.Authorization = `Bearer ${key}`;
    const response = await fetch(url, { headers, signal: controller.signal });
    const text = await response.text();
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch (_) {
      parsed = { raw: text.slice(0, 300) };
    }
    if (!response.ok) {
      const error = parsed && (parsed.error || parsed.message) || response.statusText || "request_failed";
      const err = new Error(`${response.status}:${String(error).slice(0, 160)}`);
      err.status = response.status;
      err.payload = parsed;
      throw err;
    }
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

function shortHash(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function objectOrNull(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function compactLabel(value, maxLength = 100) {
  return String(value || "").trim().slice(0, maxLength);
}

function boundedNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(10 * 60 * 1000, Math.round(number));
}

function boundedCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(100000, Math.trunc(number));
}

function lowerLabel(value, maxLength = 100) {
  return compactLabel(value, maxLength).toLowerCase();
}

function threadRows(result) {
  if (Array.isArray(result && result.data)) return result.data;
  if (Array.isArray(result && result.threads)) return result.threads;
  return [];
}

function summarizePublicConfig(config = {}) {
  return {
    version: compactLabel(config.version, 40),
    clientBuildId: compactLabel(config.clientBuildId, 120),
    shellCacheName: compactLabel(config.shellCacheName, 120),
    authRequired: config.authRequired === true,
  };
}

function summarizeThreadList(result = {}) {
  const timings = objectOrNull(result.mobileDiagnostics && result.mobileDiagnostics.threadListTimings);
  const rows = threadRows(result);
  return {
    resultCount: boundedCount(rows.length),
    firstThreadHash: shortHash(rows[0] && rows[0].id),
    timingsPresent: Boolean(timings),
    coldPathOwner: compactLabel(timings && timings.coldPathOwner, 80),
    coldPathReason: compactLabel(timings && timings.coldPathReason, 80),
    fallbackCacheDecision: compactLabel(timings && timings.fallbackCacheDecision, 80),
    fallbackDeferred: timings && timings.fallbackDeferred === true,
    fallbackDeferredReason: compactLabel(timings && timings.fallbackDeferredReason, 80),
    fallbackBaselineSourceCount: boundedCount(timings && timings.fallbackBaselineSourceCount),
    fallbackBaselineResultCount: boundedCount(timings && timings.fallbackBaselineResultCount),
    fallbackSourceSnapshotHit: timings && timings.fallbackSourceSnapshotHit === true,
    fallbackSourceSnapshotAgeMs: boundedNumber(timings && timings.fallbackSourceSnapshotAgeMs),
    fallbackSourceSnapshotLimit: boundedCount(timings && timings.fallbackSourceSnapshotLimit),
    fallbackSourceSnapshotBuildCount: boundedCount(timings && timings.fallbackSourceSnapshotBuildCount),
    fallbackSourceSnapshotBuildNumber: boundedCount(timings && timings.fallbackSourceSnapshotBuildNumber),
    fallbackSourceSnapshotRawCount: boundedCount(timings && timings.fallbackSourceSnapshotRawCount),
    totalMs: boundedNumber(timings && timings.totalMs),
    appServerMs: boundedNumber(timings && timings.appServerMs),
    fallbackMs: boundedNumber(timings && timings.fallbackMs),
    mergeMs: boundedNumber(timings && timings.mergeMs),
  };
}

function detailTurns(thread) {
  return Array.isArray(thread && thread.turns) ? thread.turns : [];
}

function activeOverlayNextAction(reason) {
  const normalized = lowerLabel(reason, 100);
  if (!normalized) return "observe-active-overlay-readback";
  if (normalized === "overlay-evidence-complete") return "observe-active-overlay-readback";
  if (normalized === "missing-active-turn-id") return "retain-active-turn-id";
  if (normalized === "dynamic-summary-stale" || normalized === "projection-dynamic-summary-stale") {
    return "allow-active-overlay-stale-window";
  }
  if (
    normalized === "missing-projection-window"
    || normalized === "empty-projection-window"
    || normalized === "not-projection-window"
  ) {
    return "repair-active-overlay-projection-window";
  }
  if (
    normalized === "overlay-provider-unavailable"
    || normalized === "snapshot-api-unavailable"
    || normalized === "projection-input-unavailable"
  ) {
    return "wire-active-overlay-provider";
  }
  if (
    normalized === "entry-missing"
    || normalized === "snapshot-missing"
    || normalized === "active-turn-missing"
    || normalized === "missing-active-overlay-turn"
    || normalized === "empty-active-overlay-turn"
  ) {
    return "repair-live-overlay-snapshot";
  }
  if (normalized === "assistant-delta-unknown" || normalized === "assistant-delta-stale") {
    return "repair-assistant-delta-freshness";
  }
  if (normalized === "receipt-evidence-unknown") return "repair-overlay-receipt-coverage";
  if (normalized === "operation-evidence-unknown") return "repair-overlay-operation-coverage";
  if (normalized === "upload-evidence-unknown") return "repair-overlay-upload-coverage";
  if (normalized === "unknown-overlay-item-kind") return "normalize-overlay-item-kind";
  if (normalized === "non-authoritative-overlay-source") return "repair-overlay-source-authority";
  return "complete-active-window-overlay-coverage";
}

function classifyActiveOverlayGate(detail = {}) {
  const readMode = lowerLabel(detail.readMode, 100);
  const readDecision = lowerLabel(detail.readDecision, 100);
  const action = lowerLabel(detail.activeOverlayAction, 80);
  const reason = compactLabel(detail.activeOverlayReason, 80);
  const projectionMissReason = compactLabel(detail.projectionMissReason, 80);
  if (
    readMode === "projection-active-overlay"
    || readDecision === "projection-active-overlay"
    || action === "use-projection-overlay"
  ) {
    const readyReason = reason || "overlay-evidence-complete";
    return {
      status: "ready",
      reason: readyReason,
      nextAction: activeOverlayNextAction(readyReason),
    };
  }
  if (detail.activeFullReadRequired !== true && !action && !reason) {
    return {
      status: "not-active",
      reason: "active-full-read-not-required",
      nextAction: "observe-active-overlay-readback",
    };
  }
  let gateReason = reason;
  if (!gateReason && projectionMissReason) gateReason = `projection-${projectionMissReason}`.slice(0, 80);
  if (!gateReason && action === "require-full-read") gateReason = "active-overlay-require-full-read";
  if (!gateReason) gateReason = "missing-active-overlay-diagnostics";
  return {
    status: "needs_repair",
    reason: gateReason,
    nextAction: activeOverlayNextAction(gateReason),
  };
}

function summarizeThreadDetail(result = {}, requestedThreadId = "") {
  const thread = objectOrNull(result.thread) || {};
  const timings = objectOrNull(thread.mobileDiagnostics && thread.mobileDiagnostics.threadDetailTimings);
  const detail = {
    requestedThreadHash: shortHash(requestedThreadId),
    responseThreadHash: shortHash(thread.id),
    timingsPresent: Boolean(timings),
    readMode: compactLabel(thread.mobileReadMode, 100),
    readDecision: compactLabel(timings && timings.readDecision, 100),
    coldPathOwner: compactLabel(timings && timings.coldPathOwner, 80),
    coldPathReason: compactLabel(timings && timings.coldPathReason, 80),
    projectionState: compactLabel(timings && timings.projectionState, 80),
    projectionMissReason: compactLabel(timings && timings.projectionMissReason, 80),
    activeFullReadRequired: timings && timings.activeFullReadRequired === true,
    activeFullReadReason: compactLabel(timings && timings.activeFullReadReason, 80),
    activeOverlayAction: compactLabel(timings && timings.activeOverlayAction, 80),
    activeOverlayReason: compactLabel(timings && timings.activeOverlayReason, 80),
    activeOverlaySource: compactLabel(timings && timings.activeOverlaySource, 80),
    activeOverlayItems: boundedCount(timings && timings.activeOverlayItems),
    activeOverlayOperationItems: boundedCount(timings && timings.activeOverlayOperationItems),
    activeOverlayUploadItems: boundedCount(timings && timings.activeOverlayUploadItems),
    activeOverlayAssistantItems: boundedCount(timings && timings.activeOverlayAssistantItems),
    activeOverlayReceiptItems: boundedCount(timings && timings.activeOverlayReceiptItems),
    turnCount: boundedCount(detailTurns(thread).length),
    omittedTurns: boundedCount(thread.mobileOmittedTurnCount),
  };
  const gate = classifyActiveOverlayGate(detail);
  return Object.assign(detail, {
    activeOverlayGate: gate.status,
    activeOverlayGateReason: gate.reason,
    activeOverlayNextAction: gate.nextAction,
  });
}

function evaluateChecks(report, options = {}) {
  const checks = {
    publicConfig: Boolean(report.publicConfig && report.publicConfig.clientBuildId),
    threadListTimings: Boolean(report.threadList && report.threadList.timingsPresent),
    threadListColdPath: Boolean(report.threadList && report.threadList.coldPathOwner && report.threadList.coldPathReason),
    detailTimings: options.skipDetail ? true : Boolean(report.detail && report.detail.timingsPresent),
    activeOverlay: !options.requireActiveOverlay || Boolean(report.detail && (
      report.detail.readMode === "projection-active-overlay"
      || report.detail.readDecision === "projection-active-overlay"
    )),
  };
  if (!options.requireThreadListColdPath) checks.threadListColdPath = true;
  return checks;
}

function firstFailure(checks = {}) {
  for (const [key, value] of Object.entries(checks)) {
    if (!value) return key;
  }
  return "";
}

async function run(options = {}, env = process.env) {
  const key = readAccessKey(options, env);
  const report = {
    ok: false,
    server: options.server,
    privacy: "metadata_only",
    publicConfig: null,
    threadList: null,
    detail: null,
    decision: null,
    checks: {},
    failure: "",
  };
  const publicConfig = await fetchJson(requestUrl(options, "/api/public-config"), options, key);
  report.publicConfig = summarizePublicConfig(publicConfig);

  const listResult = await fetchJson(requestUrl(options, "/api/threads", { limit: options.listLimit }), options, key);
  report.threadList = summarizeThreadList(listResult);

  let threadId = String(options.threadId || "").trim();
  if (!threadId) {
    const first = threadRows(listResult)[0] || {};
    threadId = String(first.id || "").trim();
  }
  if (!options.skipDetail && threadId) {
    const detailResult = await fetchJson(requestUrl(options, `/api/threads/${encodeURIComponent(threadId)}`, {
      mode: "recent",
    }), options, key);
    report.detail = summarizeThreadDetail(detailResult, threadId);
  }

  report.checks = evaluateChecks(report, options);
  report.failure = firstFailure(report.checks);
  report.ok = !report.failure;
  report.decision = classifyPhaseBReadback(report, {
    allowMissingColdPath: !options.requireThreadListColdPath,
  });
  return report;
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const report = await run(options);
  const text = JSON.stringify(report, null, 2);
  if (options.json) {
    process.stdout.write(`${text}\n`);
  } else {
    process.stdout.write(`${text}\n`);
  }
  if (!report.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err) => {
    const message = err && err.message ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  classifyActiveOverlayGate,
  evaluateChecks,
  parseArgs,
  run,
  summarizeThreadDetail,
  summarizeThreadList,
};
