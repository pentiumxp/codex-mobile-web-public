"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createThreadDetailRuntimeService,
} = require("../services/thread-detail/thread-detail-runtime-service");
const adapter = require("../adapters/thread-detail-runtime-service");

function timestampToMs(value) {
  if (!value) return 0;
  if (typeof value === "number") return value > 1_000_000_000_000 ? value : value * 1000;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function createRuntimeService(overrides = {}) {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-thread-detail-runtime-"));
  const service = createThreadDetailRuntimeService(Object.assign({
    fs,
    path,
    crypto,
    config: {
      threadDetailProjectionV4Enabled: true,
      threadDetailProjectionCacheDir: cacheDir,
      threadDetailProjectionPolicyVersion: "test-policy",
      threadDetailRawAllEnabled: false,
      threadDetailTurnsListFirstBytes: 1024,
      threadDetailCompletedProgressMessages: 3,
      threadDetailProgressiveActiveUserTextChars: 1024,
      threadDetailSummaryAppServerRefreshTtlMs: 0,
      maxTextChars: 1000,
      maxCommandOutputChars: 1000,
      maxCommandOutputCharsPerTurn: 1000,
      maxLiveOperationItems: 5,
      maxThreadTurns: 10,
      maxFullThreadTurns: 20,
      operationalItemTypes: new Set(["command", "tool_call"]),
      maxRolloutContextBytes: 1024,
      maxRuntimeContextScanBytes: 1024,
      maxRolloutEnrichmentContextBytes: 1024,
      runtimeContextCacheTtlMs: 1000,
      runtimeContextCacheMax: 10,
      rolloutActiveStatusWindowMs: 1000,
      readRpcTimeoutMs: 1000,
      threadDetailRpcTimeoutMs: 1000,
    },
    threadDisplaySummaryCache: {
      read: () => null,
      remember: (thread) => thread,
    },
    pendingSteerEchoStore: {},
    statusText: (status) => String(status && status.type || status || ""),
    truncateMiddle: (value) => String(value || ""),
    truncateTail: (value) => String(value || ""),
    compactStringArray: (value) => value,
    compactStructured: (value) => value,
    attachGeneratedImageContent: (thread) => thread,
    isCodexMobileUploadFilePath: () => false,
    normalizeFsPath: (value) => String(value || ""),
    imageViewSourcePath: (value) => String(value || ""),
    parseJsonLine: (line) => JSON.parse(line),
    timestampToMs,
    rolloutPathForThread: (thread) => String(thread && thread.rolloutPath || ""),
    rolloutStatsForPath: () => ({ sizeBytes: 0, mtimeMs: 0 }),
    workspaceContextStatsForCwd: () => ({}),
    dedupeUserMessageEchoesInThread: (thread) => thread,
    normalizeStaleContextOnlyActiveThread: (thread) => thread,
    annotateThreadRolloutStats: (thread) => thread,
    readStateDbThread: () => null,
    readStartedThread: () => null,
    rolloutLatestTurnEvidence: () => null,
    isThreadListLiveStatus: (status) => status && status.type === "active",
    isThreadListRestStatus: (status) => status && status.type === "idle",
    isHiddenThread: () => false,
    threadRuntimeSettings: () => ({}),
    visibilityFromGlobalState: () => ({}),
    readGlobalState: () => ({}),
    readRolloutSessionFallbackThread: () => null,
    readThreadSummaryFromAppServer: async () => null,
    mergeThreadDisplaySummary: (base, display) => Object.assign({}, base || {}, display || {}),
    applySessionIndexTitleToThread: (thread) => thread,
    readSessionIndexEntries: () => new Map(),
    mergeThreadRuntimeFromStateDb: (thread) => thread,
    normalizeThreadSummaryLiveStatus: (thread) => thread,
    publicRuntimeSettings: (settings) => settings || {},
    applyLocalActiveThreadStatusToSummary: (thread) => thread,
    isPathInside: () => true,
    uploadRoot: cacheDir,
    stableTextHash: (value) => String(value || "").length.toString(36),
    finalReceiptTextFromParams: () => "",
    clonePlainJson: (value) => JSON.parse(JSON.stringify(value)),
    redactInlineImageDataUrls: (value) => value,
    scheduleRecentWindowProjectionRefresh: () => {},
    logThreadDetail: () => {},
    isUnmaterializedThreadError: () => false,
  }, overrides));
  return { service, cacheDir };
}

test("thread-detail runtime adapter re-exports canonical composition service", () => {
  assert.equal(adapter.createThreadDetailRuntimeService, createThreadDetailRuntimeService);
});

test("thread-detail runtime service exposes composition surface and late-bound response preparation", async () => {
  const { service, cacheDir } = createRuntimeService();
  try {
    assert.equal(typeof service.threadDetailProjectionInput, "function");
    assert.equal(typeof service.threadDetailReadOrchestrationService.readThreadDetail, "function");
    assert.equal(typeof service.threadDetailActiveWindowPrewarmService.prewarmNow, "function");
    assert.equal(service.parseThreadTurnsCursor('"cursor-1"'), "cursor-1");

    const responsePreparation = service.createResponsePreparationService({
      codex: {
        request: async () => ({ data: [] }),
      },
      responseBudgetOptions: () => ({}),
      applyLocalActiveThreadStatusToResult: (result) => result,
      prepareThreadTaskCardsToResult: async (result) => result,
      attachPendingServerRequestsToResult: (result) => result,
      attachThreadTaskCardsToResult: (result) => result,
    });

    assert.equal(typeof responsePreparation.prepareThreadDetailResponseResult, "function");
    const fallback = service.fallbackThreadReadResult("thread-1", {
      id: "thread-1",
      rolloutPath: path.join(cacheDir, "missing.jsonl"),
      status: { type: "idle" },
    }, { model: "gpt-5" }, "warning", "summary-fallback");
    assert.equal(fallback.thread.id, "thread-1");
    assert.equal(fallback.thread.mobileReadMode, "summary-fallback");
    assert.equal(fallback.thread.runtimeSettings.model, "gpt-5");
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});
