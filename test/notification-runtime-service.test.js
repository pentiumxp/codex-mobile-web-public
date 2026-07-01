"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const canonical = require("../services/runtime/notification-runtime-service");
const adapter = require("../adapters/notification-runtime-service");

function createService(overrides = {}) {
  const calls = [];
  const service = canonical.createNotificationRuntimeService(Object.assign({
    env: {
      CODEX_MOBILE_PUSH_VAPID_FILE: "/runtime/custom-vapid.json",
      CODEX_MOBILE_PUSH_TTL_SECONDS: "45",
      CODEX_MOBILE_PUSH_SUBJECT: "mailto:test@example.com",
    },
    path,
    runtimeRoot: "/runtime",
    stateDb: "/runtime/state.sqlite",
    userHome: "/home/test",
    runSqliteJson: () => ({ ok: true, rows: [] }),
    sqlString: (value) => `'${String(value).replace(/'/g, "''")}'`,
    readJsonFile: () => null,
    writeRuntimeJson: () => {},
    threadSideChatService: { isSidecarThreadId: (threadId) => threadId === "sidecar" },
    shouldTrackTurnForWebPush: () => ({ track: true }),
    completedTurnHasNoFinalAgentMessage: () => false,
    resolveThreadTitleForNotification: () => "Thread",
    threadDisplaySummaryCache: { read: () => null },
    readStateDbThread: () => null,
    readStartedThread: () => null,
    readThreadSummaryFromAppServer: () => null,
    buildTurnCompletionDetailMessage: () => "",
    turnCompletionUsageSummary: () => null,
    hermesNotificationDelegateService: { isConfiguredForWorkspace: () => false, send: async () => null },
    pushTurnId: () => "turn-1",
    pushThreadId: () => "thread-1",
    isOldPushTurnEvent: () => false,
    turnTimestampMs: () => 0,
    shortIdentifier: (value) => String(value || "").slice(0, 8),
    latestThreadIdByTurnId: new Map(),
    runtimeContextCacheMax: 100,
    processStartedAtMs: 1,
    timestampToMs: () => 0,
    getCodex: () => ({ request: async () => null }),
    tokenUsageStatsService: {},
    tokenUsageWorkspaceCwds: () => ["/workspace"],
    threadTaskCardService: {},
    finalReceiptTextFromParams: () => "",
    threadSideChatOrchestrationService: { maybeApplyQueuedThreadSideChat: () => false },
    threadFromTurnsList: () => null,
    materializeThreadTaskCardDraftsForThread: () => null,
    threadTaskCardDraftTurnLookback: 5,
    threadDetailRpcTimeoutMs: 1000,
    logger: { log: () => {}, error: () => {} },
    webPushRuntimeServiceFactory(options) {
      calls.push(["webPush", options]);
      return {
        publicStatus: () => ({ supported: true, subscriptionCount: 2 }),
        classifyThreadId: (threadId) => `class:${threadId}`,
      };
    },
    runtimeTurnEventPipelineServiceFactory(options) {
      calls.push(["pipeline", options]);
      return {
        rememberThreadIdForTurnParams: () => {},
      };
    },
  }, overrides));
  return { service, calls };
}

test("adapter re-exports canonical notification runtime service", () => {
  assert.equal(adapter.createNotificationRuntimeService, canonical.createNotificationRuntimeService);
});

test("notification runtime composes web push and turn-event pipeline dependencies", () => {
  const { service, calls } = createService();
  assert.deepEqual(service.pushSubscriptionPublicStatus(), { supported: true, subscriptionCount: 2 });
  assert.equal(service.classifyWebPushThreadId("thread-1"), "class:thread-1");

  const webPushOptions = calls.find(([name]) => name === "webPush")[1];
  assert.equal(webPushOptions.vapidFile, "/runtime/custom-vapid.json");
  assert.equal(webPushOptions.subscriptionsFile, "/runtime/web-push-subscriptions.json");
  assert.equal(webPushOptions.ttlSeconds, "45");
  assert.equal(webPushOptions.subject, "mailto:test@example.com");
  assert.equal(webPushOptions.isSidecarThreadId("sidecar"), true);

  const pipelineOptions = calls.find(([name]) => name === "pipeline")[1];
  assert.equal(pipelineOptions.webPushRuntimeService, service.webPushRuntimeService);
  assert.equal(pipelineOptions.threadTaskCardDraftTurnLookback, 5);
  assert.equal(pipelineOptions.threadDetailRpcTimeoutMs, 1000);
});
