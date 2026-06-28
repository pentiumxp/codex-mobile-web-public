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
    "  --prewarm-settle-ms <n>     Wait for startup prewarm to finish before list read. Default: 4000.",
    "  --prewarm-poll-ms <n>       Prewarm settle polling interval. Default: 250.",
    "  --no-wait-prewarm          Do not wait for startup prewarm to settle.",
    "  --require-active-overlay    Fail unless detail readback is projection-active-overlay.",
    "  --no-verify-deferred-fallback",
    "                              Do not run follow-up list reads after fallback is deferred.",
    "  --no-verify-thread-list-warm-check",
    "                              Do not run a same-key warm check after cold fallback rebuilds.",
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
    prewarmSettleMs: readPositiveInt(env.CODEX_MOBILE_PHASE_B_PREWARM_SETTLE_MS || "4000", 4000),
    prewarmPollMs: readPositiveInt(env.CODEX_MOBILE_PHASE_B_PREWARM_POLL_MS || "250", 250),
    requireActiveOverlay: false,
    requireThreadListColdPath: true,
    verifyDeferredFallback: true,
    verifyThreadListWarmCheck: true,
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
    else if (arg === "--prewarm-settle-ms") options.prewarmSettleMs = readPositiveInt(next(), options.prewarmSettleMs);
    else if (arg === "--prewarm-poll-ms") options.prewarmPollMs = readPositiveInt(next(), options.prewarmPollMs);
    else if (arg === "--no-wait-prewarm") options.prewarmSettleMs = 0;
    else if (arg === "--require-active-overlay") options.requireActiveOverlay = true;
    else if (arg === "--no-verify-deferred-fallback") options.verifyDeferredFallback = false;
    else if (arg === "--no-verify-thread-list-warm-check") options.verifyThreadListWarmCheck = false;
    else if (arg === "--skip-detail") options.skipDetail = true;
    else if (arg === "--allow-missing-cold-path") options.requireThreadListColdPath = false;
    else if (arg === "--no-auth") options.noAuth = true;
    else if (arg === "--json") options.json = true;
    else throw new Error(`unknown option: ${arg}`);
  }
  options.server = normalizeBaseUrl(options.server);
  options.listLimit = Math.max(1, Math.min(200, options.listLimit));
  options.prewarmSettleMs = Math.max(0, Math.min(60 * 1000, options.prewarmSettleMs));
  options.prewarmPollMs = Math.max(50, Math.min(10 * 1000, options.prewarmPollMs));
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

function boundedBytes(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(100 * 1024 * 1024, Math.round(number));
}

function boundedCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(100000, Math.trunc(number));
}

function lowerLabel(value, maxLength = 100) {
  return compactLabel(value, maxLength).toLowerCase();
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function threadRows(result) {
  if (Array.isArray(result && result.data)) return result.data;
  if (Array.isArray(result && result.threads)) return result.threads;
  return [];
}

function summarizePublicConfig(config = {}) {
  const prewarm = objectOrNull(config.threadListFallbackPrewarm) || {};
  return {
    version: compactLabel(config.version, 40),
    clientBuildId: compactLabel(config.clientBuildId, 120),
    shellCacheName: compactLabel(config.shellCacheName, 120),
    authRequired: config.authRequired === true,
    threadListFallbackPrewarm: {
      enabled: prewarm.enabled === true,
      scheduled: prewarm.scheduled === true,
      running: prewarm.running === true,
      completed: prewarm.completed === true,
      deferralCount: boundedCount(prewarm.deferralCount),
      delayMs: boundedNumber(prewarm.delayMs),
      retryDelayMs: boundedNumber(prewarm.retryDelayMs),
      maxDeferrals: boundedCount(prewarm.maxDeferrals),
      limit: boundedCount(prewarm.limit),
      sourceSnapshotLimit: boundedCount(prewarm.sourceSnapshotLimit),
      lastStatus: compactLabel(prewarm.lastStatus, 40),
      lastErrorCode: compactLabel(prewarm.lastErrorCode, 80),
      lastCacheDecision: compactLabel(prewarm.lastCacheDecision, 80),
      lastCacheHit: prewarm.lastCacheHit === true,
      lastSourceSnapshotHit: prewarm.lastSourceSnapshotHit === true,
      lastSourceSnapshotLimit: boundedCount(prewarm.lastSourceSnapshotLimit),
      lastResultCount: boundedCount(prewarm.lastResultCount),
      lastElapsedMs: boundedNumber(prewarm.lastElapsedMs),
      lastSourceSnapshotBuildCount: boundedCount(prewarm.lastSourceSnapshotBuildCount),
      lastSourceSnapshotRawCount: boundedCount(prewarm.lastSourceSnapshotRawCount),
      lastBaselineSourceCount: boundedCount(prewarm.lastBaselineSourceCount),
      lastBaselineResultCount: boundedCount(prewarm.lastBaselineResultCount),
    },
  };
}

function prewarmSettleReason(publicConfig = {}) {
  const prewarm = objectOrNull(publicConfig.threadListFallbackPrewarm);
  if (!prewarm) return "prewarm-missing";
  if (prewarm.enabled !== true) return "prewarm-disabled";
  if (prewarm.completed === true) return "prewarm-completed";
  const lastStatus = lowerLabel(prewarm.lastStatus, 40);
  if (lastStatus === "failed") return "prewarm-failed";
  if (prewarm.running === true) return "prewarm-running";
  if (prewarm.scheduled === true) return "prewarm-scheduled";
  if (lastStatus === "deferred") return "prewarm-deferred";
  return "prewarm-not-completed";
}

function shouldWaitForPrewarm(publicConfig = {}, options = {}) {
  if (!options || Number(options.prewarmSettleMs || 0) <= 0) return false;
  const reason = prewarmSettleReason(publicConfig);
  return reason === "prewarm-running"
    || reason === "prewarm-scheduled"
    || reason === "prewarm-deferred"
    || reason === "prewarm-not-completed";
}

function summarizePrewarmSettle({ attempted, settled, reason, sampleCount, elapsedMs }) {
  return {
    attempted: attempted === true,
    settled: settled === true,
    reason: compactLabel(reason, 80),
    sampleCount: boundedCount(sampleCount),
    elapsedMs: boundedNumber(elapsedMs),
  };
}

async function settlePublicConfigPrewarm(initialPublicConfig, options = {}, key = "") {
  const startedAt = Date.now();
  let current = initialPublicConfig;
  let currentSummary = summarizePublicConfig(current);
  let sampleCount = 1;
  if (!shouldWaitForPrewarm(currentSummary, options)) {
    return {
      publicConfig: currentSummary,
      settle: summarizePrewarmSettle({
        attempted: false,
        settled: true,
        reason: prewarmSettleReason(currentSummary),
        sampleCount,
        elapsedMs: 0,
      }),
    };
  }
  const sleep = typeof options.sleep === "function" ? options.sleep : defaultSleep;
  const maxWaitMs = Number(options.prewarmSettleMs || 0);
  const pollMs = Number(options.prewarmPollMs || 250);
  const maxPolls = Math.max(1, Math.ceil(maxWaitMs / Math.max(1, pollMs)));
  for (let pollIndex = 0; pollIndex < maxPolls; pollIndex += 1) {
    await sleep(pollMs);
    current = await fetchJson(requestUrl(options, "/api/public-config"), options, key);
    currentSummary = summarizePublicConfig(current);
    sampleCount += 1;
    const reason = prewarmSettleReason(currentSummary);
    if (!shouldWaitForPrewarm(currentSummary, options)) {
      return {
        publicConfig: currentSummary,
        settle: summarizePrewarmSettle({
          attempted: true,
          settled: true,
          reason,
          sampleCount,
          elapsedMs: Date.now() - startedAt,
        }),
      };
    }
  }
  return {
    publicConfig: currentSummary,
    settle: summarizePrewarmSettle({
      attempted: true,
      settled: false,
      reason: "prewarm-settle-timeout",
      sampleCount,
      elapsedMs: Date.now() - startedAt,
    }),
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
    fallbackCacheHit: timings && timings.fallbackCacheHit === true,
    fallbackCachePersistentRestored: timings && timings.fallbackCachePersistentRestored === true,
    fallbackCompatibleCacheHit: timings && timings.fallbackCompatibleCacheHit === true,
    fallbackCompatibleCacheLimit: boundedCount(timings && timings.fallbackCompatibleCacheLimit),
    fallbackDeferred: timings && timings.fallbackDeferred === true,
    fallbackDeferredReason: compactLabel(timings && timings.fallbackDeferredReason, 80),
    fallbackBaselineSourceCount: boundedCount(timings && timings.fallbackBaselineSourceCount),
    fallbackBaselineResultCount: boundedCount(timings && timings.fallbackBaselineResultCount),
    fallbackBaselineFinalFilterPassCount: boundedCount(timings && timings.fallbackBaselineFinalFilterPassCount),
    fallbackBaselineFinalFilterInputCount: boundedCount(timings && timings.fallbackBaselineFinalFilterInputCount),
    fallbackBaselineFinalFilterOutputCount: boundedCount(timings && timings.fallbackBaselineFinalFilterOutputCount),
    fallbackBaselineMergeInputCount: boundedCount(timings && timings.fallbackBaselineMergeInputCount),
    fallbackBaselineMergeOutputCount: boundedCount(timings && timings.fallbackBaselineMergeOutputCount),
    fallbackBaselineMergeDuplicateCount: boundedCount(timings && timings.fallbackBaselineMergeDuplicateCount),
    fallbackBaselineLimitDropCount: boundedCount(timings && timings.fallbackBaselineLimitDropCount),
    routeMergeAppServerInputCount: boundedCount(timings && timings.routeMergeAppServerInputCount),
    routeMergeFallbackInputCount: boundedCount(timings && timings.routeMergeFallbackInputCount),
    routeMergeInputCount: boundedCount(timings && timings.routeMergeInputCount),
    routeMergeUniqueInputCount: boundedCount(timings && timings.routeMergeUniqueInputCount),
    routeMergeDuplicateCount: boundedCount(timings && timings.routeMergeDuplicateCount),
    routeMergeMergedCount: boundedCount(timings && timings.routeMergeMergedCount),
    routeMergeOutputCount: boundedCount(timings && timings.routeMergeOutputCount),
    routeMergeLimitDropCount: boundedCount(timings && timings.routeMergeLimitDropCount),
    requestContextArchivedIdsReadCount: boundedCount(timings && timings.requestContextArchivedIdsReadCount),
    requestContextSessionIndexReadCount: boundedCount(timings && timings.requestContextSessionIndexReadCount),
    requestContextCachedDisplayReadCount: boundedCount(timings && timings.requestContextCachedDisplayReadCount),
    requestContextRolloutStatReadCount: boundedCount(timings && timings.requestContextRolloutStatReadCount),
    summaryMergeInputCount: boundedCount(timings && timings.summaryMergeInputCount),
    summaryMergeInvalidCount: boundedCount(timings && timings.summaryMergeInvalidCount),
    summaryMergeArchivedIdSkipCount: boundedCount(timings && timings.summaryMergeArchivedIdSkipCount),
    summaryMergeDuplicateIdCount: boundedCount(timings && timings.summaryMergeDuplicateIdCount),
    summaryMergeArchivedSignalDropCount: boundedCount(timings && timings.summaryMergeArchivedSignalDropCount),
    summaryMergeSubagentDropCount: boundedCount(timings && timings.summaryMergeSubagentDropCount),
    summaryMergeByIdCount: boundedCount(timings && timings.summaryMergeByIdCount),
    summaryMergeHydratedCount: boundedCount(timings && timings.summaryMergeHydratedCount),
    summaryMergeVisibleCount: boundedCount(timings && timings.summaryMergeVisibleCount),
    summaryMergeOutputCount: boundedCount(timings && timings.summaryMergeOutputCount),
    summaryMergeCachedDisplayMs: boundedNumber(timings && timings.summaryMergeCachedDisplayMs),
    summaryMergeNormalizeMs: boundedNumber(timings && timings.summaryMergeNormalizeMs),
    summaryMergeDisplayMergeMs: boundedNumber(timings && timings.summaryMergeDisplayMergeMs),
    summaryMergeHydrateTitleMs: boundedNumber(timings && timings.summaryMergeHydrateTitleMs),
    summaryMergeFinalFilterMs: boundedNumber(timings && timings.summaryMergeFinalFilterMs),
    summaryMergeSortMs: boundedNumber(timings && timings.summaryMergeSortMs),
    summaryMergeTotalMs: boundedNumber(timings && timings.summaryMergeTotalMs),
    summaryMergeDominantStage: compactLabel(timings && timings.summaryMergeDominantStage, 80),
    fallbackSourceSnapshotHit: timings && timings.fallbackSourceSnapshotHit === true,
    fallbackSourceSnapshotAgeMs: boundedNumber(timings && timings.fallbackSourceSnapshotAgeMs),
    fallbackSourceSnapshotLimit: boundedCount(timings && timings.fallbackSourceSnapshotLimit),
    fallbackSourceSnapshotBuildCount: boundedCount(timings && timings.fallbackSourceSnapshotBuildCount),
    fallbackSourceSnapshotBuildNumber: boundedCount(timings && timings.fallbackSourceSnapshotBuildNumber),
    fallbackSourceSnapshotRawCount: boundedCount(timings && timings.fallbackSourceSnapshotRawCount),
    fallbackRolloutDirectoryReadCount: boundedCount(timings && timings.fallbackRolloutDirectoryReadCount),
    fallbackRolloutFileStatCount: boundedCount(timings && timings.fallbackRolloutFileStatCount),
    fallbackRolloutFileCollectedCount: boundedCount(timings && timings.fallbackRolloutFileCollectedCount),
    fallbackRolloutFileSortedCount: boundedCount(timings && timings.fallbackRolloutFileSortedCount),
    fallbackRolloutCandidateFileCount: boundedCount(timings && timings.fallbackRolloutCandidateFileCount),
    fallbackRolloutCandidateScannedCount: boundedCount(timings && timings.fallbackRolloutCandidateScannedCount),
    fallbackRolloutHeadReadCount: boundedCount(timings && timings.fallbackRolloutHeadReadCount),
    fallbackRolloutHeadBytes: boundedNumber(timings && timings.fallbackRolloutHeadBytes),
    fallbackRolloutSummaryReadCount: boundedCount(timings && timings.fallbackRolloutSummaryReadCount),
    fallbackRolloutStatusAttachCount: boundedCount(timings && timings.fallbackRolloutStatusAttachCount),
    fallbackRolloutStatusStatReadCount: boundedCount(timings && timings.fallbackRolloutStatusStatReadCount),
    fallbackRolloutStatusStatReuseCount: boundedCount(timings && timings.fallbackRolloutStatusStatReuseCount),
    fallbackRolloutStatusTailReadCount: boundedCount(timings && timings.fallbackRolloutStatusTailReadCount),
    fallbackRolloutStatusTailBytes: boundedNumber(timings && timings.fallbackRolloutStatusTailBytes),
    fallbackSessionIndexReadCount: boundedCount(timings && timings.fallbackSessionIndexReadCount),
    fallbackSessionIndexReuseCount: boundedCount(timings && timings.fallbackSessionIndexReuseCount),
    fallbackSessionIndexLineCount: boundedCount(timings && timings.fallbackSessionIndexLineCount),
    fallbackSessionIndexEntryCount: boundedCount(timings && timings.fallbackSessionIndexEntryCount),
    appServerRequestedLimit: boundedCount(timings && timings.appServerRequestedLimit),
    appServerRequestLimit: boundedCount(timings && timings.appServerRequestLimit),
    appServerRequestReason: compactLabel(timings && timings.appServerRequestReason, 80),
    appServerOverfetchFactor: boundedNumber(timings && timings.appServerOverfetchFactor),
    totalMs: boundedNumber(timings && timings.totalMs),
    appServerMs: boundedNumber(timings && timings.appServerMs),
    appServerRpcMs: boundedNumber(timings && timings.appServerRpcMs),
    appServerVisibleFilterMs: boundedNumber(timings && timings.appServerVisibleFilterMs),
    appServerWorkspaceFilterMs: boundedNumber(timings && timings.appServerWorkspaceFilterMs),
    appServerPostProcessMs: boundedNumber(timings && timings.appServerPostProcessMs),
    appServerMeasuredMs: boundedNumber(timings && timings.appServerMeasuredMs),
    appServerUnattributedMs: boundedNumber(timings && timings.appServerUnattributedMs),
    appServerRawCount: boundedCount(timings && timings.appServerRawCount),
    appServerVisibleCount: boundedCount(timings && timings.appServerVisibleCount),
    appServerFilteredCount: boundedCount(timings && timings.appServerFilteredCount),
    appServerTransportKind: compactLabel(timings && timings.appServerTransportKind, 80),
    appServerEndpointKind: compactLabel(timings && timings.appServerEndpointKind, 80),
    appServerEndpointProtocol: compactLabel(timings && timings.appServerEndpointProtocol, 40),
    appServerRpcAttemptCount: boundedCount(timings && timings.appServerRpcAttemptCount),
    appServerRpcTimeoutMs: boundedNumber(timings && timings.appServerRpcTimeoutMs),
    appServerRpcRetryEnabled: timings && timings.appServerRpcRetryEnabled === true,
    appServerRpcTimedOut: timings && timings.appServerRpcTimedOut === true,
    appServerRpcErrorCode: compactLabel(timings && timings.appServerRpcErrorCode, 80),
    appServerRequestPayloadBytes: boundedBytes(timings && timings.appServerRequestPayloadBytes),
    appServerRequestParamBytes: boundedBytes(timings && timings.appServerRequestParamBytes),
    appServerResponsePayloadBytes: boundedBytes(timings && timings.appServerResponsePayloadBytes),
    fallbackMs: boundedNumber(timings && timings.fallbackMs),
    mergeMs: boundedNumber(timings && timings.mergeMs),
  };
}

function summarizeMuxMetric(metric = {}) {
  const source = objectOrNull(metric) || {};
  return {
    method: compactLabel(source.method, 100),
    count: boundedCount(source.count),
    errorCount: boundedCount(source.errorCount),
    totalMs: boundedNumber(source.totalMs),
    avgMs: boundedNumber(source.avgMs),
    lastMs: boundedNumber(source.lastMs),
    maxMs: boundedNumber(source.maxMs),
    lastRequestBytes: boundedBytes(source.lastRequestBytes),
    lastResponseBytes: boundedBytes(source.lastResponseBytes),
    lastAgeMs: boundedNumber(source.lastAgeMs),
  };
}

function summarizeMuxRuntime(status = {}) {
  const endpoint = objectOrNull(status && status.endpoint) || {};
  const capabilities = objectOrNull(endpoint.capabilities) || {};
  const endpointKind = compactLabel(endpoint.kind, 80);
  return {
    transport: compactLabel(status && status.transport, 80),
    endpointKind,
    endpointProtocol: compactLabel(endpoint.protocol, 40),
    isProfileMuxEndpoint: endpointKind === "profile-mux-file",
    sharedRequired: status && status.sharedRequired === true,
    persistentOwnedMux: status && status.persistentOwnedMux === true,
    mobileOwnedMuxRunning: Boolean(status && status.mobileOwnedMux && status.mobileOwnedMux.running === true),
    mobileEcho: capabilities.mobileUserMessageEcho === true,
    notificationReplay: capabilities.notificationReplay === true,
    serverRequestProxy: capabilities.serverRequestProxy === true,
    threadGoalRpc: capabilities.threadGoalRpc === true,
    muxMetricsRpc: capabilities.muxMetricsRpc === true,
  };
}

function summarizeMuxMetrics(status = {}) {
  const metrics = objectOrNull(status && status.muxMetrics);
  const methods = objectOrNull(metrics && metrics.methods) || {};
  return {
    supported: metrics && metrics.supported === true,
    ok: metrics && metrics.ok === true,
    reason: compactLabel(metrics && metrics.reason, 80),
    uptimeMs: boundedNumber(metrics && metrics.uptimeMs),
    pendingCount: boundedCount(metrics && metrics.pendingCount),
    serverRequestCount: boundedCount(metrics && metrics.serverRequestCount),
    trackedMethodCount: boundedCount(metrics && metrics.trackedMethodCount),
    threadList: summarizeMuxMetric(methods["thread/list"]),
  };
}

function detailTurns(thread) {
  return Array.isArray(thread && thread.turns) ? thread.turns : [];
}

function summarizeDetailResponseBudget(budget = {}) {
  const source = objectOrNull(budget) || {};
  return {
    responseBudgetVersion: compactLabel(source.version, 80),
    responseBudgetApplied: source.applied === true,
    responseBudgetProgressiveActiveApplied: source.progressiveActiveBudgetApplied === true,
    responseBudgetProgressiveActiveReason: compactLabel(source.progressiveActiveBudgetReason, 100),
    responseBudgetOriginalItemCount: boundedCount(source.originalItemCount),
    responseBudgetRetainedItemCount: boundedCount(source.retainedItemCount),
    responseBudgetOmittedOperationItems: boundedCount(source.omittedOperationItems),
    responseBudgetOmittedReasoningItems: boundedCount(source.omittedReasoningItems),
    responseBudgetOmittedAssistantItems: boundedCount(source.omittedAssistantItems),
    responseBudgetOmittedVisibleItems: boundedCount(source.omittedVisibleItems),
    responseBudgetActiveTurnCount: boundedCount(source.activeTurnCount),
    responseBudgetStaleActiveTurnCount: boundedCount(source.staleActiveTurnCount),
    responseBudgetActiveOperationItems: boundedCount(source.activeOperationItems),
    responseBudgetActiveReasoningItems: boundedCount(source.activeReasoningItems),
    responseBudgetActiveAssistantItems: boundedCount(source.activeAssistantItems),
    responseBudgetConfiguredActiveOperationItems: boundedCount(source.configuredActiveOperationItems),
    responseBudgetConfiguredActiveReasoningItems: boundedCount(source.configuredActiveReasoningItems),
    responseBudgetConfiguredActiveAssistantItems: boundedCount(source.configuredActiveAssistantItems),
    responseBudgetProgressiveActiveOriginalBytes: boundedBytes(source.progressiveActiveOriginalBytes),
    responseBudgetProgressiveActiveTurnOriginalBytes: boundedBytes(source.progressiveActiveTurnOriginalBytes),
    responseBudgetProgressiveActiveOriginalItemCount: boundedCount(source.progressiveActiveOriginalItemCount),
    responseBudgetProgressiveActiveTurnOriginalItemCount: boundedCount(source.progressiveActiveTurnOriginalItemCount),
    responseBudgetActiveProgressiveItemThreshold: boundedCount(source.activeProgressiveItemThreshold),
    responseBudgetActiveProgressiveByteThreshold: boundedBytes(source.activeProgressiveByteThreshold),
    responseBudgetActiveProgressiveThreadByteThreshold: boundedBytes(source.activeProgressiveThreadByteThreshold),
    responseBudgetProgressiveActiveUserTextChars: boundedCount(source.progressiveActiveUserTextChars),
    responseBudgetTruncatedActiveUserInputItems: boundedCount(source.truncatedActiveUserMessageItems),
    responseBudgetActiveUserInputOriginalChars: boundedCount(source.activeUserInputOriginalChars),
    responseBudgetActiveUserInputRetainedChars: boundedCount(source.activeUserInputRetainedChars),
    responseBudgetOmittedActiveUserInputChars: boundedCount(source.omittedActiveUserInputChars),
    responseBudgetProgressiveActiveTextChars: boundedCount(source.progressiveActiveTextChars),
    responseBudgetTruncatedActiveTextItems: boundedCount(source.truncatedActiveTextItems),
    responseBudgetActiveTextOriginalChars: boundedCount(source.activeTextOriginalChars),
    responseBudgetActiveTextRetainedChars: boundedCount(source.activeTextRetainedChars),
    responseBudgetOmittedActiveTextChars: boundedCount(source.omittedActiveTextChars),
    responseBudgetProgressiveActiveOperationPayloadChars: boundedCount(source.progressiveActiveOperationPayloadChars),
    responseBudgetTruncatedActiveOperationPayloadItems: boundedCount(source.truncatedActiveOperationPayloadItems),
    responseBudgetActiveOperationPayloadOriginalChars: boundedCount(source.activeOperationPayloadOriginalChars),
    responseBudgetActiveOperationPayloadRetainedChars: boundedCount(source.activeOperationPayloadRetainedChars),
    responseBudgetOmittedActiveOperationPayloadChars: boundedCount(source.omittedActiveOperationPayloadChars),
    responseBudgetProgressiveVisibleItemBudgetApplied: source.progressiveVisibleItemBudgetApplied === true,
    responseBudgetProgressiveVisibleItemBudgetReason: compactLabel(source.progressiveVisibleItemBudgetReason, 100),
    responseBudgetProgressiveVisibleItemCeiling: boundedCount(source.progressiveVisibleItemCeiling),
    responseBudgetProgressiveVisibleItemOriginalCount: boundedCount(source.progressiveVisibleItemOriginalCount),
    responseBudgetProgressiveVisibleItemRetainedCount: boundedCount(source.progressiveVisibleItemRetainedCount),
    responseBudgetProgressiveCompletedTextBudgetApplied: source.progressiveCompletedTextBudgetApplied === true,
    responseBudgetProgressiveCompletedTextBudgetReason: compactLabel(source.progressiveCompletedTextBudgetReason, 100),
    responseBudgetProgressiveCompletedTextBudgetScope: compactLabel(source.progressiveCompletedTextBudgetScope, 80),
    responseBudgetProgressiveCompletedTextBudgetProtectedLatestTurn: source.progressiveCompletedTextBudgetProtectedLatestTurn === true,
    responseBudgetProgressiveCompletedTextBudgetSkippedLatestTurnCount: boundedCount(source.progressiveCompletedTextBudgetSkippedLatestTurnCount),
    responseBudgetProgressiveCompletedTextChars: boundedCount(source.progressiveCompletedTextChars),
    responseBudgetCompletedTextOriginalChars: boundedCount(source.completedTextOriginalChars),
    responseBudgetCompletedTextRetainedChars: boundedCount(source.completedTextRetainedChars),
    responseBudgetOmittedCompletedTextChars: boundedCount(source.omittedCompletedTextChars),
    responseBudgetProgressiveFirstPaintThreadByteCeiling: boundedBytes(source.progressiveFirstPaintThreadByteCeiling),
    responseBudgetProgressiveFirstPaintBytesBeforeTextBudget: boundedBytes(source.progressiveFirstPaintBytesBeforeTextBudget),
    responseBudgetProgressiveFirstPaintBytesAfterTextBudget: boundedBytes(source.progressiveFirstPaintBytesAfterTextBudget),
  };
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
  const responseBudget = summarizeDetailResponseBudget(thread.mobileDetailResponseBudget);
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
    activeOverlayWindowFirst: timings && timings.activeOverlayWindowFirst === true,
    totalMs: boundedNumber(timings && timings.totalMs),
    summaryMs: boundedNumber(timings && timings.summaryMs),
    projectionMs: boundedNumber(timings && timings.projectionMs),
    activeOverlayMs: boundedNumber(timings && timings.activeOverlayMs),
    activeOverlayResolveMs: boundedNumber(timings && timings.activeOverlayResolveMs),
    activeOverlayProjectionLookupMs: boundedNumber(timings && timings.activeOverlayProjectionLookupMs),
    activeOverlayPlanMs: boundedNumber(timings && timings.activeOverlayPlanMs),
    activeOverlayWindowMs: boundedNumber(timings && timings.activeOverlayWindowMs),
    activeOverlayMergeMs: boundedNumber(timings && timings.activeOverlayMergeMs),
    prepareResponseMs: boundedNumber(timings && timings.prepareResponseMs),
    threadReadMs: boundedNumber(timings && timings.threadReadMs),
    turnsListInitialMs: boundedNumber(timings && timings.turnsListInitialMs),
    turnCount: boundedCount(detailTurns(thread).length),
    omittedTurns: boundedCount(thread.mobileOmittedTurnCount),
    ...responseBudget,
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

function shouldWarmCheckThreadList(summary = {}) {
  if (!summary || typeof summary !== "object") return false;
  if (summary.fallbackDeferred) return false;
  if (summary.fallbackSourceSnapshotHit === true) return false;
  const decision = lowerLabel(summary.fallbackCacheDecision, 80);
  const owner = lowerLabel(summary.coldPathOwner, 80);
  if (owner === "fallback-source-snapshot") return false;
  return decision === "miss-rebuild"
    || decision === "expired-rebuild"
    || owner === "fallback-baseline"
    || owner === "fallback-cache-policy";
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
    publicConfigInitial: null,
    publicConfig: null,
    threadListPrewarmSettle: null,
    threadList: null,
    threadListAfterDeferred: null,
    threadListWarmCheck: null,
    muxRuntime: null,
    muxMetrics: null,
    detail: null,
    decision: null,
    checks: {},
    failure: "",
  };
  const publicConfig = await fetchJson(requestUrl(options, "/api/public-config"), options, key);
  report.publicConfigInitial = summarizePublicConfig(publicConfig);
  const settledPublicConfig = await settlePublicConfigPrewarm(publicConfig, options, key);
  report.publicConfig = settledPublicConfig.publicConfig;
  report.threadListPrewarmSettle = settledPublicConfig.settle;

  const listResult = await fetchJson(requestUrl(options, "/api/threads", { limit: options.listLimit }), options, key);
  report.threadList = summarizeThreadList(listResult);
  const statusResult = await fetchJson(requestUrl(options, "/api/status", { muxMetrics: 1 }), options, key);
  report.muxRuntime = summarizeMuxRuntime(statusResult);
  report.muxMetrics = summarizeMuxMetrics(statusResult);

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

  if (options.verifyDeferredFallback && report.threadList && report.threadList.fallbackDeferred) {
    const deferredFollowupResult = await fetchJson(requestUrl(options, "/api/threads", { limit: options.listLimit }), options, key);
    report.threadListAfterDeferred = summarizeThreadList(deferredFollowupResult);
    if (options.verifyThreadListWarmCheck && shouldWarmCheckThreadList(report.threadListAfterDeferred)) {
      const warmCheckResult = await fetchJson(requestUrl(options, "/api/threads", { limit: options.listLimit }), options, key);
      report.threadListWarmCheck = summarizeThreadList(warmCheckResult);
    }
  } else if (options.verifyThreadListWarmCheck && shouldWarmCheckThreadList(report.threadList)) {
      const warmCheckResult = await fetchJson(requestUrl(options, "/api/threads", { limit: options.listLimit }), options, key);
      report.threadListWarmCheck = summarizeThreadList(warmCheckResult);
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
  settlePublicConfigPrewarm,
  summarizeMuxRuntime,
  summarizeThreadDetail,
  summarizeThreadList,
  summarizePublicConfig,
};
