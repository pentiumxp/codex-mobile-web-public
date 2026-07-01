"use strict";

const { createWebPushRuntimeService } = require("../../adapters/web-push-runtime-service");
const { createRuntimeTurnEventPipelineService } = require("./runtime-turn-event-pipeline-service");

function createNotificationRuntimeService(dependencies = {}) {
  const env = dependencies.env || process.env;
  const path = dependencies.path || require("node:path");
  const runtimeRoot = String(dependencies.runtimeRoot || "");
  const logger = dependencies.logger || console;
  const webPushRuntimeServiceFactory = dependencies.webPushRuntimeServiceFactory || createWebPushRuntimeService;
  const runtimeTurnEventPipelineServiceFactory = dependencies.runtimeTurnEventPipelineServiceFactory || createRuntimeTurnEventPipelineService;

  const webPushRuntimeService = webPushRuntimeServiceFactory({
    fs: dependencies.fs,
    readJsonFile: dependencies.readJsonFile,
    writeRuntimeJson: dependencies.writeRuntimeJson,
    vapidFile: env.CODEX_MOBILE_PUSH_VAPID_FILE || path.join(runtimeRoot, "web-push-vapid.json"),
    subscriptionsFile: env.CODEX_MOBILE_PUSH_SUBSCRIPTIONS_FILE || path.join(runtimeRoot, "web-push-subscriptions.json"),
    defaultSubject: "mailto:codex-mobile-web@example.com",
    subject: env.CODEX_MOBILE_PUSH_SUBJECT || "",
    subjectConfigured: Boolean(env.CODEX_MOBILE_PUSH_SUBJECT),
    ttlSeconds: env.CODEX_MOBILE_PUSH_TTL_SECONDS || "3600",
    stateDb: dependencies.stateDb,
    userHome: dependencies.userHome,
    runSqliteJson: dependencies.runSqliteJson,
    sqlString: dependencies.sqlString,
    isSidecarThreadId: (threadId) => dependencies.threadSideChatService.isSidecarThreadId(threadId),
    shouldTrackTurnForWebPush: dependencies.shouldTrackTurnForWebPush,
    completedTurnHasNoFinalAgentMessage: dependencies.completedTurnHasNoFinalAgentMessage,
    resolveThreadTitleForNotification: dependencies.resolveThreadTitleForNotification,
    threadDisplaySummaryCache: dependencies.threadDisplaySummaryCache,
    readStateDbThread: dependencies.readStateDbThread,
    readStartedThread: dependencies.readStartedThread,
    readThreadSummaryFromAppServer: (threadId) => dependencies.readThreadSummaryFromAppServer(threadId),
    buildTurnCompletionDetailMessage: dependencies.buildTurnCompletionDetailMessage,
    turnCompletionUsageSummary: dependencies.turnCompletionUsageSummary,
    hermesNotificationDelegateService: dependencies.hermesNotificationDelegateService,
    pushTurnId: dependencies.pushTurnId,
    pushThreadId: dependencies.pushThreadId,
    isOldTurnEvent: dependencies.isOldPushTurnEvent,
    turnTimestampMs: dependencies.turnTimestampMs,
    shortIdentifier: dependencies.shortIdentifier,
    logger,
  });

  const runtimeTurnEventPipelineService = runtimeTurnEventPipelineServiceFactory({
    latestThreadIdByTurnId: dependencies.latestThreadIdByTurnId,
    runtimeContextCacheMax: dependencies.runtimeContextCacheMax,
    processStartedAtMs: dependencies.processStartedAtMs,
    timestampToMs: dependencies.timestampToMs,
    getCodex: dependencies.getCodex,
    threadDisplaySummaryCache: dependencies.threadDisplaySummaryCache,
    readStateDbThread: dependencies.readStateDbThread,
    readStartedThread: dependencies.readStartedThread,
    turnCompletionUsageSummary: dependencies.turnCompletionUsageSummary,
    tokenUsageStatsService: dependencies.tokenUsageStatsService,
    tokenUsageWorkspaceCwds: dependencies.tokenUsageWorkspaceCwds,
    threadTaskCardService: dependencies.threadTaskCardService,
    finalReceiptTextFromParams: dependencies.finalReceiptTextFromParams,
    threadSideChatOrchestrationService: {
      maybeApplyQueuedThreadSideChat: (...args) => dependencies.threadSideChatOrchestrationService.maybeApplyQueuedThreadSideChat(...args),
    },
    webPushRuntimeService,
    threadFromTurnsList: dependencies.threadFromTurnsList,
    materializeThreadTaskCardDraftsForThread: dependencies.materializeThreadTaskCardDraftsForThread,
    threadTaskCardDraftTurnLookback: dependencies.threadTaskCardDraftTurnLookback,
    threadDetailRpcTimeoutMs: dependencies.threadDetailRpcTimeoutMs,
    shortIdentifier: dependencies.shortIdentifier,
    logger,
  });

  return {
    webPushRuntimeService,
    runtimeTurnEventPipelineService,
    pushSubscriptionPublicStatus: () => webPushRuntimeService.publicStatus(),
    classifyWebPushThreadId: (threadId) => webPushRuntimeService.classifyThreadId(threadId),
  };
}

module.exports = {
  createNotificationRuntimeService,
};
