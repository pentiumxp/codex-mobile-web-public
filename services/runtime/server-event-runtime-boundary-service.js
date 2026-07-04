"use strict";

function requiredService(getService, serviceName) {
  const service = typeof getService === "function" ? getService() : null;
  if (!service || typeof service !== "object") {
    throw new Error(`server_event_runtime_${serviceName}_unavailable`);
  }
  return service;
}

function createLazyDelegates(target, serviceName, getService, methodNames = []) {
  for (const methodName of methodNames) {
    target[methodName] = function lazyRuntimeDelegate(...args) {
      const service = requiredService(getService, serviceName);
      const fn = service[methodName];
      if (typeof fn !== "function") {
        throw new Error(`server_event_runtime_${serviceName}_${methodName}_unavailable`);
      }
      return Reflect.apply(fn, service, args);
    };
  }
}

function createServerEventRuntimeBoundaryService(options = {}) {
  const api = {};
  createLazyDelegates(api, "notification", options.getThreadEventNotificationService, [
    "broadcast",
    "broadcastThreadStatusChanged",
    "compactNotification",
    "notificationThreadId",
    "notifyLocalTurnStarted",
    "removeEventClient",
    "scheduleActiveWindowPrewarm",
    "scheduleActiveWindowPrewarmFromNotification",
    "scheduleActiveWindowPrewarmFromThreadListResult",
    "scheduleThreadDetailFirstPaintPrewarm",
    "shouldSendEventToClient",
    "threadStatusChangedPayload",
    "threadStatusChangedPayloadFromTurnNotification",
    "updateLocalActiveThreadStatusFromNotification",
  ]);
  createLazyDelegates(api, "turn_pipeline", options.getRuntimeTurnEventPipelineService, [
    "isOldPushTurnEvent",
    "maybeApplyQueuedThreadSideChat",
    "maybeAutoReplyThreadTaskCard",
    "maybeMaterializeThreadTaskCardDrafts",
    "maybeRecordTurnTokenUsage",
    "maybeSendTurnCompletedPush",
    "pushThreadId",
    "pushThreadSummary",
    "pushTurnId",
    "rememberThreadIdForTurnId",
    "rememberThreadIdForTurnParams",
    "threadIdFromRolloutPath",
    "turnTimestampMs",
  ]);
  return api;
}

module.exports = {
  createServerEventRuntimeBoundaryService,
};
