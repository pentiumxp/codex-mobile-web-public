"use strict";

const {
  applyActiveThreadPolicyToBoundedReadDecision,
  planActiveThreadDetailReadPolicy,
} = require("./thread-detail-active-read-policy-service");
const {
  mergeProjectionThreadWithActiveOverlay,
  planActiveWindowOverlay,
} = require("./thread-detail-active-window-overlay-policy-service");

function defaultNow() {
  return Date.now();
}

function safeErrorMessage(err) {
  return err && err.message ? err.message : String(err);
}

function createThreadDetailTimer(now = defaultNow) {
  const startedAtMs = now();
  const timings = {};
  function mark(name, phaseStartedAtMs) {
    timings[name] = Math.max(0, now() - Number(phaseStartedAtMs || now()));
    return timings[name];
  }
  function elapsedMs() {
    return Math.max(0, now() - startedAtMs);
  }
  return {
    startedAtMs,
    timings,
    mark,
    elapsedMs,
  };
}

function hiddenResponse() {
  return {
    status: 404,
    body: { error: "Thread is archived, deleted, or outside visible workspaces" },
    mode: "hidden",
  };
}

function nonEmptyText(value) {
  return String(value || "").trim();
}

function isPromiseLike(value) {
  return value && typeof value.then === "function";
}

function safeNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function normalizeBoundedReadDecision(value) {
  if (value && typeof value === "object") {
    return {
      prefer: Boolean(value.prefer || value.enabled || value.useBoundedRead),
      rolloutSizeBytes: safeNonNegativeNumber(value.rolloutSizeBytes),
      thresholdBytes: safeNonNegativeNumber(value.thresholdBytes),
      source: nonEmptyText(value.source),
      reason: nonEmptyText(value.reason),
    };
  }
  return {
    prefer: Boolean(value),
    rolloutSizeBytes: 0,
    thresholdBytes: 0,
    source: "",
    reason: Boolean(value) ? "enabled" : "",
  };
}

function projectionDiagnosticsFromThread(thread) {
  const projection = thread && thread.mobileProjection && typeof thread.mobileProjection === "object"
    ? thread.mobileProjection
    : {};
  return {
    source: nonEmptyText(projection.source),
    version: nonEmptyText(projection.version),
    ageMs: safeNonNegativeNumber(projection.ageMs),
  };
}

function activeOverlayProjectionFieldsFromThread(thread) {
  const projection = thread && thread.mobileProjection && typeof thread.mobileProjection === "object"
    ? thread.mobileProjection
    : {};
  return {
    projectionRevision: safeNonNegativeNumber(projection.revision || thread && thread.mobileProjectionRevision),
    projectionTimestampMs: safeNonNegativeNumber(
      projection.updatedAtMs
        || projection.cachedAtMs
        || thread && thread.mobileProjectionUpdatedAtMs
        || thread && thread.updatedAtMs,
    ),
  };
}

function mergeActiveOverlayProjectionFields(overlayInput, thread) {
  const fields = activeOverlayProjectionFieldsFromThread(thread);
  return Object.assign({}, overlayInput || {}, {
    projectionRevision: safeNonNegativeNumber(overlayInput && overlayInput.projectionRevision)
      || fields.projectionRevision,
    projectionTimestampMs: safeNonNegativeNumber(overlayInput && overlayInput.projectionTimestampMs)
      || fields.projectionTimestampMs,
  });
}

function asActiveOverlayProjectionWindow(result, overlayInput = {}) {
  const thread = result && result.thread && typeof result.thread === "object" ? result.thread : null;
  if (!thread) return null;
  const existingProjection = thread.mobileProjection && typeof thread.mobileProjection === "object"
    ? thread.mobileProjection
    : {};
  const overlayRevision = safeNonNegativeNumber(overlayInput.overlayRevision);
  const overlayTimestampMs = safeNonNegativeNumber(overlayInput.overlayTimestampMs);
  thread.mobileReadMode = "projection-active-window";
  thread.mobileProjection = Object.assign({}, existingProjection, {
    source: "partial",
    version: "active-window",
    partial: true,
    partialKind: "turns-list-active-overlay-window",
    activeOverlayWindow: true,
    revision: overlayRevision || safeNonNegativeNumber(existingProjection.revision),
    updatedAtMs: overlayTimestampMs || safeNonNegativeNumber(existingProjection.updatedAtMs),
    ageMs: 0,
  });
  if (overlayRevision) thread.mobileProjectionRevision = overlayRevision;
  if (overlayTimestampMs) thread.mobileProjectionUpdatedAtMs = overlayTimestampMs;
  return thread;
}

function createThreadDetailReadOrchestrationService(options = {}) {
  const now = typeof options.now === "function" ? options.now : defaultNow;
  const attachDiagnostics = typeof options.attachDiagnostics === "function"
    ? options.attachDiagnostics
    : (result) => result;
  const resolveSummary = typeof options.resolveSummary === "function"
    ? options.resolveSummary
    : async () => ({ summary: null, source: "" });
  const resolveVisibility = typeof options.resolveVisibility === "function"
    ? options.resolveVisibility
    : () => null;
  const threadRuntimeSettings = typeof options.threadRuntimeSettings === "function"
    ? options.threadRuntimeSettings
    : () => null;
  const isHiddenThread = typeof options.isHiddenThread === "function"
    ? options.isHiddenThread
    : () => false;
  const rawAllEnabled = typeof options.rawAllEnabled === "function"
    ? options.rawAllEnabled
    : () => false;
  const readRawThread = typeof options.readRawThread === "function" ? options.readRawThread : async () => ({ thread: null });
  const projectionInput = typeof options.projectionInput === "function" ? options.projectionInput : () => null;
  const projectedThreadResult = typeof options.projectedThreadResult === "function" ? options.projectedThreadResult : () => null;
  const projectedThreadLookup = typeof options.projectedThreadLookup === "function" ? options.projectedThreadLookup : null;
  const activeOverlayProjectionWindowLookup = typeof options.activeOverlayProjectionWindowLookup === "function"
    ? options.activeOverlayProjectionWindowLookup
    : null;
  const resolveActiveWindowOverlay = typeof options.resolveActiveWindowOverlay === "function"
    ? options.resolveActiveWindowOverlay
    : null;
  const rememberThreadSummary = typeof options.rememberThreadSummary === "function" ? options.rememberThreadSummary : () => {};
  const turnsListThreadReadResult = typeof options.turnsListThreadReadResult === "function"
    ? options.turnsListThreadReadResult
    : async () => ({ thread: null });
  const readFullThread = typeof options.readFullThread === "function" ? options.readFullThread : async () => ({ thread: null });
  const seedProjection = typeof options.seedProjection === "function" ? options.seedProjection : () => {};
  const preferBoundedReadBeforeFullRead = typeof options.preferBoundedReadBeforeFullRead === "function"
    ? options.preferBoundedReadBeforeFullRead
    : () => false;
  const prepareResponse = typeof options.prepareResponse === "function" ? options.prepareResponse : async (result) => result;
  const compactActiveOverlayTurn = typeof options.compactActiveOverlayTurn === "function"
    ? options.compactActiveOverlayTurn
    : null;
  const fallbackThreadReadResult = typeof options.fallbackThreadReadResult === "function"
    ? options.fallbackThreadReadResult
    : () => ({ thread: null });
  const isReadTimeoutError = typeof options.isReadTimeoutError === "function" ? options.isReadTimeoutError : () => false;
  const isUnmaterializedThreadError = typeof options.isUnmaterializedThreadError === "function"
    ? options.isUnmaterializedThreadError
    : () => false;
  const threadRolloutSizeBytes = typeof options.threadRolloutSizeBytes === "function" ? options.threadRolloutSizeBytes : () => 0;
  const readTimeoutMs = Number(options.readTimeoutMs || 0);
  const threadDetailRpcTimeoutMs = Number(options.threadDetailRpcTimeoutMs || 0);
  const maxFullThreadTurns = Number(options.maxFullThreadTurns || 0);
  const maxThreadTurns = Number(options.maxThreadTurns || 0);

  function attachDetailDiagnostics(result, context, details = {}) {
    const boundedDecision = context.boundedReadBeforeFullRead || null;
    return attachDiagnostics(result, {
      requestMode: context.preferRecentTurns ? "recent" : "full",
      readDecision: details.readDecision || "",
      readMode: details.readMode || details.source || result && result.thread && result.thread.mobileReadMode || "",
      summarySource: context.summarySource,
      projectionState: context.projectionState || "",
      projectionInputAvailable: context.projectionInputAvailable === true,
      projectionSource: context.projectionSource || "",
      projectionVersion: context.projectionVersion || "",
      projectionAgeMs: context.projectionAgeMs || 0,
      projectionMissReason: context.projectionMissReason || "",
      projectionSeedStatus: context.projectionSeedStatus || "",
      projectionSeedSource: context.projectionSeedSource || "",
      activeFullReadRequired: context.activeFullReadRequired === true,
      activeFullReadReason: context.activeFullReadReason || "",
      activeOverlayAction: context.activeOverlayAction || "",
      activeOverlayReason: context.activeOverlayReason || "",
      activeOverlaySource: context.activeOverlaySource || "",
      activeOverlayItems: context.activeOverlayItems || 0,
      activeOverlayOperationItems: context.activeOverlayOperationItems || 0,
      activeOverlayUploadItems: context.activeOverlayUploadItems || 0,
      activeOverlayAssistantItems: context.activeOverlayAssistantItems || 0,
      activeOverlayReceiptItems: context.activeOverlayReceiptItems || 0,
      activeOverlayWindowFirst: context.activeOverlayWindowFirst === true,
      timings: context.timer.timings,
      totalMs: context.timer.elapsedMs(),
      rolloutSizeBytes: result && result.thread ? threadRolloutSizeBytes(result.thread) : 0,
      largeReadProtected: Boolean(boundedDecision && boundedDecision.prefer),
      largeReadRolloutSizeBytes: boundedDecision ? boundedDecision.rolloutSizeBytes : 0,
      largeReadThresholdBytes: boundedDecision ? boundedDecision.thresholdBytes : 0,
      largeReadSource: boundedDecision ? boundedDecision.source : "",
      largeReadReason: boundedDecision ? boundedDecision.reason : "",
    });
  }

  async function prepareAndAttach(result, context, details = {}) {
    const prepareStartedAtMs = now();
    const prepared = await prepareResponse(result, details);
    context.timer.mark("prepareResponseMs", prepareStartedAtMs);
    return attachDetailDiagnostics(prepared, context, details);
  }

  async function readThreadDetail(input = {}) {
    const threadId = String(input.threadId || "").trim();
    const codex = input.codex || null;
    const threadLog = typeof input.threadLog === "function" ? input.threadLog : () => {};
    const preferRecentTurns = Boolean(input.preferRecentTurns);
    const timer = createThreadDetailTimer(now);
    const context = {
      timer,
      preferRecentTurns,
      summarySource: "",
      projectionState: "",
      projectionInputAvailable: false,
      projectionSource: "",
      projectionVersion: "",
      projectionAgeMs: 0,
      projectionMissReason: "",
      projectionSeedStatus: "",
      projectionSeedSource: "",
      activeOverlayAction: "",
      activeOverlayReason: "",
      activeOverlaySource: "",
      activeOverlayItems: 0,
      activeOverlayOperationItems: 0,
      activeOverlayUploadItems: 0,
      activeOverlayAssistantItems: 0,
      activeOverlayReceiptItems: 0,
      activeOverlayWindowFirst: false,
    };
    threadLog("start", {
      transport: codex && codex.transportKind,
      ready: Boolean(codex && codex.ready),
    });
    const visibility = resolveVisibility();
    const summaryStartedAtMs = now();
    const summaryResult = await resolveSummary(codex, threadId, { threadLog });
    timer.mark("summaryMs", summaryStartedAtMs);
    const summary = summaryResult && summaryResult.summary || null;
    context.summarySource = summaryResult && summaryResult.source || "";
    const activeReadPolicy = planActiveThreadDetailReadPolicy({ summary, preferRecentTurns });
    context.activeFullReadRequired = activeReadPolicy.activeFullReadRequired;
    context.activeFullReadReason = activeReadPolicy.activeFullReadReason || "";
    const runtimeSettings = threadRuntimeSettings(threadId, summary);
    if (summary && isHiddenThread(summary, visibility)) {
      threadLog("hidden", { status: 404 });
      return hiddenResponse();
    }

    if (rawAllEnabled()) {
      const readStartedAtMs = now();
      threadLog("thread_read_raw_start", { timeoutMs: readTimeoutMs });
      try {
        const result = await readRawThread({ codex, threadId, summary, runtimeSettings });
        if (isHiddenThread(result && result.thread, visibility)) {
          threadLog("thread_read_raw_hidden", {
            durationMs: now() - readStartedAtMs,
            status: 404,
          });
          return hiddenResponse();
        }
        threadLog("thread_read_raw_ok", {
          durationMs: now() - readStartedAtMs,
          returnedTurns: result && result.thread && Array.isArray(result.thread.turns) ? result.thread.turns.length : null,
        });
        timer.mark("rawThreadReadMs", readStartedAtMs);
        return {
          status: 200,
          mode: "thread-read-raw",
          body: await prepareAndAttach(result, context, {
            threadId,
            source: "thread-read-raw",
            readDecision: "raw-thread-read",
          }),
        };
      } catch (err) {
        threadLog("thread_read_raw_error", {
          durationMs: now() - readStartedAtMs,
          timeout: isReadTimeoutError(err),
          error: safeErrorMessage(err),
        });
        return {
          status: err && err.statusCode || 500,
          mode: "thread-read-raw-error",
          body: { error: safeErrorMessage(err) },
          complete: false,
        };
      }
    }

    const projection = projectionInput(threadId, summary);
    context.projectionInputAvailable = Boolean(projection);
    context.projectionState = projection ? "input-ready" : "unavailable";
    const projectionStartedAtMs = now();
    const allowPartialProjection = activeReadPolicy.allowPartialProjection;
    const shouldUseActiveOverlayWindowFirst = Boolean(
      activeReadPolicy.activeFullReadRequired
        && resolveActiveWindowOverlay
        && activeOverlayProjectionWindowLookup,
    );
    context.activeOverlayWindowFirst = shouldUseActiveOverlayWindowFirst;
    const projectionLookup = projection && projectedThreadLookup && !shouldUseActiveOverlayWindowFirst
      ? projectedThreadLookup(projection, summary, runtimeSettings, { allowPartial: allowPartialProjection })
      : null;
    const projected = projection
      ? projectionLookup
        ? projectionLookup.result
        : projectedThreadResult(projection, summary, runtimeSettings, { allowPartial: allowPartialProjection })
      : null;
    context.projectionMissReason = projectionLookup && projectionLookup.missReason || "";
    timer.mark("projectionMs", projectionStartedAtMs);
    const projectedThread = projected && projected.thread || null;
    if (projectedThread) {
      context.projectionState = "hit";
      context.projectionMissReason = "";
      const projectionInfo = projectionDiagnosticsFromThread(projectedThread);
      context.projectionSource = projectionInfo.source;
      context.projectionVersion = projectionInfo.version;
      context.projectionAgeMs = projectionInfo.ageMs;
      if (isHiddenThread(projectedThread, visibility)) {
        threadLog("projection_hidden", {
          durationMs: now() - projectionStartedAtMs,
          status: 404,
        });
        return hiddenResponse();
      }
      threadLog(activeReadPolicy.activeFullReadRequired && resolveActiveWindowOverlay
        ? "projection_hit_active_overlay_required"
        : "projection_hit", {
        durationMs: now() - projectionStartedAtMs,
        mode: projectedThread.mobileReadMode,
        returnedTurns: Array.isArray(projectedThread.turns) ? projectedThread.turns.length : null,
        omittedTurns: projectedThread.mobileOmittedTurnCount || 0,
      });
      if (!activeReadPolicy.activeFullReadRequired || !resolveActiveWindowOverlay) {
        rememberThreadSummary(projectedThread);
        return {
          status: 200,
          mode: projectedThread.mobileReadMode || "projection",
          body: await prepareAndAttach(projected, context, {
            threadId,
            source: projectedThread.mobileReadMode || "projection",
            readDecision: projectedThread.mobileProjection && projectedThread.mobileProjection.partial
              ? "projection-partial-hit"
              : "projection-hit",
          }),
        };
      }
    }
    if (projection && !projectedThread) {
      context.projectionState = "miss";
      if (!context.projectionMissReason) context.projectionMissReason = "result-missing";
    }

    if (activeReadPolicy.activeFullReadRequired && projection && resolveActiveWindowOverlay) {
      const activeOverlayStartedAtMs = now();
      let overlayProjectionLookup = projectionLookup;
      let overlayProjected = projected && projected.thread ? projected : null;
      let projectionThread = overlayProjected && overlayProjected.thread || null;
      let overlayInput = null;
      try {
        const activeOverlayResolveStartedAtMs = now();
        const overlayResult = resolveActiveWindowOverlay({
          threadId,
          summary,
          projection,
          runtimeSettings,
          projectionThread,
          projectionLookup: overlayProjectionLookup,
        });
        overlayInput = isPromiseLike(overlayResult) ? await overlayResult : overlayResult;
        timer.mark("activeOverlayResolveMs", activeOverlayResolveStartedAtMs);
      } catch (err) {
        if (!timer.timings.activeOverlayResolveMs) timer.mark("activeOverlayResolveMs", activeOverlayStartedAtMs);
        overlayInput = { reason: "resolver-error", error: safeErrorMessage(err) };
        threadLog("active_overlay_resolve_error", { error: safeErrorMessage(err) });
      }
      const overlayWindowLookup = activeOverlayProjectionWindowLookup || projectedThreadLookup;
      if (!projectionThread && overlayInput && overlayInput.overlayTurn && overlayWindowLookup) {
        const activeOverlayTurnId = nonEmptyText(overlayInput.activeTurnId)
          || nonEmptyText(overlayInput.overlayTurn && (overlayInput.overlayTurn.id || overlayInput.overlayTurn.turnId || overlayInput.overlayTurn.turn_id));
        const activeOverlayProjectionLookupStartedAtMs = now();
        overlayProjectionLookup = overlayWindowLookup(projection, summary, runtimeSettings, {
          allowPartial: true,
          activeOverlay: true,
          omitActiveTurnId: activeOverlayTurnId,
        });
        if (overlayProjectionLookup && overlayProjectionLookup.missReason) {
          context.projectionMissReason = overlayProjectionLookup.missReason;
        }
        timer.mark("activeOverlayProjectionLookupMs", activeOverlayProjectionLookupStartedAtMs);
        overlayProjected = overlayProjectionLookup ? overlayProjectionLookup.result : null;
        projectionThread = overlayProjected && overlayProjected.thread || null;
        if (projectionThread) {
          overlayInput = mergeActiveOverlayProjectionFields(overlayInput, projectionThread);
        }
      }
      let activeOverlayPlanStartedAtMs = now();
      let activeOverlayPlan = planActiveWindowOverlay(Object.assign({}, overlayInput || {}, {
        summary,
        projectionThread,
      }));
      timer.mark("activeOverlayPlanMs", activeOverlayPlanStartedAtMs);
      let activeOverlayProjectionThread = projectionThread;
      let activeOverlayProjectionResult = overlayProjected;
      if (activeOverlayPlan.reason === "missing-projection-window"
        && overlayInput
        && overlayInput.overlayTurn
        && turnsListThreadReadResult) {
        const activeWindowStartedAtMs = now();
        try {
          const activeWindowResult = await turnsListThreadReadResult({
            threadId,
            summary,
            runtimeSettings,
            warning: "",
            mode: "turns-list-active-overlay-window",
            threadLog,
          });
          if (isHiddenThread(activeWindowResult && activeWindowResult.thread, visibility)) {
            threadLog("active_overlay_window_hidden", {
              durationMs: now() - activeWindowStartedAtMs,
              status: 404,
            });
            return hiddenResponse();
          }
          timer.mark("activeOverlayWindowMs", activeWindowStartedAtMs);
          if (projection && activeWindowResult && activeWindowResult.thread) {
            try {
              const seeded = seedProjection(projection, activeWindowResult, {
                partial: true,
                partialKind: "turns-list-active-overlay-window",
                projectionRevision: overlayInput.overlayRevision || overlayInput.projectionRevision,
                projectionTimestampMs: overlayInput.overlayTimestampMs || overlayInput.projectionTimestampMs,
              });
              context.projectionSeedStatus = seeded && seeded.skipped
                ? "skipped"
                : seeded && seeded.partial
                  ? "seeded-partial"
                  : "seeded";
              context.projectionSeedSource = seeded && seeded.reason || "turns-list-active-overlay-window";
            } catch (err) {
              context.projectionSeedStatus = "failed";
              context.projectionSeedSource = "turns-list-active-overlay-window";
              threadLog("projection_seed_error", { error: safeErrorMessage(err) });
            }
          }
          activeOverlayProjectionThread = asActiveOverlayProjectionWindow(activeWindowResult, overlayInput);
          activeOverlayProjectionResult = activeOverlayProjectionThread
            ? Object.assign({}, activeWindowResult || {}, { thread: activeOverlayProjectionThread })
            : activeWindowResult;
          activeOverlayPlanStartedAtMs = now();
          activeOverlayPlan = planActiveWindowOverlay(Object.assign({}, overlayInput || {}, {
            summary,
            projectionThread: activeOverlayProjectionThread,
            projectionRevision: overlayInput.overlayRevision || overlayInput.projectionRevision,
            projectionTimestampMs: overlayInput.overlayTimestampMs || overlayInput.projectionTimestampMs,
          }));
          timer.mark("activeOverlayPlanMs", activeOverlayPlanStartedAtMs);
          threadLog("active_overlay_window", {
            durationMs: now() - activeWindowStartedAtMs,
            action: activeOverlayPlan.action || "require-full-read",
            reason: activeOverlayPlan.reason || "",
          });
        } catch (err) {
          threadLog("active_overlay_window_error", {
            durationMs: now() - activeWindowStartedAtMs,
            timeout: isReadTimeoutError(err),
            error: safeErrorMessage(err),
          });
        }
      }
      timer.mark("activeOverlayMs", activeOverlayStartedAtMs);
      context.activeOverlayAction = activeOverlayPlan.action || "require-full-read";
      context.activeOverlayReason = activeOverlayPlan.reason || "";
      context.activeOverlaySource = activeOverlayPlan.overlaySource || "";
      context.activeOverlayItems = activeOverlayPlan.counts && activeOverlayPlan.counts.items || 0;
      context.activeOverlayOperationItems = activeOverlayPlan.counts && activeOverlayPlan.counts.operationItems || 0;
      context.activeOverlayUploadItems = activeOverlayPlan.counts && activeOverlayPlan.counts.uploadItems || 0;
      context.activeOverlayAssistantItems = activeOverlayPlan.counts && activeOverlayPlan.counts.assistantItems || 0;
      context.activeOverlayReceiptItems = activeOverlayPlan.counts && activeOverlayPlan.counts.receiptItems || 0;
      threadLog("active_overlay_plan", {
        action: context.activeOverlayAction,
        reason: context.activeOverlayReason,
        source: context.activeOverlaySource,
      });
      if (activeOverlayPlan.action === "use-projection-overlay" && activeOverlayProjectionThread) {
        const activeOverlayMergeStartedAtMs = now();
        const mergedThread = mergeProjectionThreadWithActiveOverlay(
          activeOverlayProjectionThread,
          overlayInput && overlayInput.overlayTurn,
          {
            readMode: "projection-active-overlay",
            overlaySource: activeOverlayPlan.overlaySource,
            reason: activeOverlayPlan.reason,
            counts: activeOverlayPlan.counts,
            compactOverlayTurn: compactActiveOverlayTurn
              ? (turn, compactDetails = {}) => compactActiveOverlayTurn(turn, Object.assign({}, compactDetails, {
                threadId,
                summary,
                runtimeSettings,
                projectionThread: activeOverlayProjectionThread,
              }))
            : null,
          },
        );
        timer.mark("activeOverlayMergeMs", activeOverlayMergeStartedAtMs);
        const result = Object.assign({}, activeOverlayProjectionResult || {}, { thread: mergedThread });
        if (isHiddenThread(result && result.thread, visibility)) {
          threadLog("active_overlay_hidden", {
            durationMs: now() - activeOverlayStartedAtMs,
            status: 404,
          });
          return hiddenResponse();
        }
        context.projectionState = "hit";
        context.projectionMissReason = "";
        const projectionInfo = projectionDiagnosticsFromThread(result.thread);
        context.projectionSource = projectionInfo.source || "partial";
        context.projectionVersion = projectionInfo.version;
        context.projectionAgeMs = projectionInfo.ageMs;
        rememberThreadSummary(result.thread);
        return {
          status: 200,
          mode: "projection-active-overlay",
          body: await prepareAndAttach(result, context, {
            threadId,
            source: "projection-active-overlay",
            readDecision: "projection-active-overlay",
          }),
        };
      }
    } else if (activeReadPolicy.activeFullReadRequired) {
      context.activeOverlayAction = "require-full-read";
      context.activeOverlayReason = resolveActiveWindowOverlay ? "projection-input-unavailable" : "overlay-provider-unavailable";
    }

    if (activeReadPolicy.shouldUseInitialTurnsList) {
      const turnsStartedAtMs = now();
      try {
        const result = await turnsListThreadReadResult({
          threadId,
          summary,
          runtimeSettings,
          warning: "",
          mode: "turns-list-initial",
          threadLog,
        });
        if (isHiddenThread(result && result.thread, visibility)) {
          threadLog("turns_list_initial_hidden", {
            durationMs: now() - turnsStartedAtMs,
            status: 404,
          });
          return hiddenResponse();
        }
        timer.mark("turnsListInitialMs", turnsStartedAtMs);
        if (projection && result && result.thread) {
          try {
            const seeded = seedProjection(projection, result, {
              partial: true,
              partialKind: "recent-window",
            });
            context.projectionSeedStatus = seeded && seeded.skipped
              ? "skipped"
              : seeded && seeded.partial
                ? "seeded-partial"
                : "seeded";
            context.projectionSeedSource = seeded && seeded.reason || "turns-list-initial";
          } catch (err) {
            context.projectionSeedStatus = "failed";
            context.projectionSeedSource = "turns-list-initial";
            threadLog("projection_seed_error", { error: safeErrorMessage(err) });
          }
        } else {
          context.projectionSeedStatus = "skipped";
          context.projectionSeedSource = projection ? "turns-list-initial" : "no-projection-input";
        }
        return {
          status: 200,
          mode: "turns-list-initial",
          body: attachDetailDiagnostics(result, context, {
            threadId,
            source: "turns-list-initial",
            readDecision: "initial-turns-list",
          }),
        };
      } catch (err) {
        threadLog("turns_list_initial_error", {
          durationMs: now() - turnsStartedAtMs,
          timeout: isReadTimeoutError(err),
          error: safeErrorMessage(err),
        });
      }
    } else if (activeReadPolicy.initialTurnsListSkipReason) {
      threadLog("turns_list_initial_skipped_active", {
        reason: activeReadPolicy.initialTurnsListSkipReason,
      });
    }

    const rawBoundedReadDecision = normalizeBoundedReadDecision(
      preferBoundedReadBeforeFullRead({ threadId, summary, projection, runtimeSettings }),
    );
    const boundedReadDecision = applyActiveThreadPolicyToBoundedReadDecision(
      rawBoundedReadDecision,
      activeReadPolicy,
    );
    context.boundedReadBeforeFullRead = boundedReadDecision;
    if (boundedReadDecision.prefer) {
      const turnsStartedAtMs = now();
      const mode = "turns-list-large";
      threadLog("turns_list_before_full_start", {
        limit: maxThreadTurns,
        timeoutMs: threadDetailRpcTimeoutMs,
        fallbackFrom: "projection-miss",
        rolloutSizeBytes: boundedReadDecision.rolloutSizeBytes || null,
        thresholdBytes: boundedReadDecision.thresholdBytes || null,
        decisionSource: boundedReadDecision.source || "",
        decisionReason: boundedReadDecision.reason || "",
      });
      try {
        const result = await turnsListThreadReadResult({
          threadId,
          summary,
          runtimeSettings,
          warning: "",
          mode,
          threadLog,
        });
        if (isHiddenThread(result && result.thread, visibility)) {
          threadLog("turns_list_before_full_hidden", {
            durationMs: now() - turnsStartedAtMs,
            status: 404,
          });
          return hiddenResponse();
        }
        timer.mark("turnsListBeforeFullMs", turnsStartedAtMs);
        if (projection && result && result.thread) {
          try {
            seedProjection(projection, result);
            result.thread.mobileProjection = Object.assign({}, result.thread.mobileProjection || {}, { source: "seeded-from-turns-list" });
            context.projectionSeedStatus = "seeded";
            context.projectionSeedSource = "turns-list-large";
          } catch (err) {
            context.projectionSeedStatus = "failed";
            context.projectionSeedSource = "turns-list-large";
            threadLog("projection_seed_error", { error: safeErrorMessage(err) });
          }
        } else {
          context.projectionSeedStatus = "skipped";
          context.projectionSeedSource = projection ? "turns-list-large" : "no-projection-input";
        }
        return {
          status: 200,
          mode,
          body: attachDetailDiagnostics(result, context, {
            threadId,
            source: mode,
            readDecision: "bounded-large-turns-list",
          }),
        };
      } catch (err) {
        threadLog("turns_list_before_full_error", {
          durationMs: now() - turnsStartedAtMs,
          timeout: isReadTimeoutError(err),
          error: safeErrorMessage(err),
        });
      }
    }

    const readStartedAtMs = now();
    threadLog("thread_read_start", {
      timeoutMs: readTimeoutMs,
      maxTurns: maxFullThreadTurns,
    });
    try {
      const result = await readFullThread({ codex, threadId, summary, runtimeSettings });
      if (isHiddenThread(result && result.thread, visibility)) {
        threadLog("thread_read_hidden", {
          durationMs: now() - readStartedAtMs,
          status: 404,
        });
        return hiddenResponse();
      }
      threadLog("thread_read_ok", {
        durationMs: now() - readStartedAtMs,
        returnedTurns: result && result.thread && Array.isArray(result.thread.turns) ? result.thread.turns.length : null,
        omittedTurns: result && result.thread && result.thread.mobileOmittedTurnCount ? result.thread.mobileOmittedTurnCount : 0,
      });
      timer.mark("threadReadMs", readStartedAtMs);
      if (projection && result && result.thread && !activeReadPolicy.activeFullReadRequired) {
        try {
          seedProjection(projection, result);
          result.thread.mobileProjection = Object.assign({}, result.thread.mobileProjection || {}, { source: "seeded" });
          context.projectionSeedStatus = "seeded";
          context.projectionSeedSource = "thread-read";
        } catch (err) {
          context.projectionSeedStatus = "failed";
          context.projectionSeedSource = "thread-read";
          threadLog("projection_seed_error", { error: safeErrorMessage(err) });
        }
      } else if (activeReadPolicy.activeFullReadRequired) {
        context.projectionSeedStatus = "skipped";
        context.projectionSeedSource = "active-thread-read";
      } else {
        context.projectionSeedStatus = "skipped";
        context.projectionSeedSource = "no-projection-input";
      }
      return {
        status: 200,
        mode: "thread-read",
        body: await prepareAndAttach(result, context, {
          threadId,
          source: "thread-read",
          readDecision: "full-thread-read",
        }),
      };
    } catch (readErr) {
      threadLog("thread_read_error", {
        durationMs: now() - readStartedAtMs,
        timeout: isReadTimeoutError(readErr),
        error: safeErrorMessage(readErr),
      });
      const turnsStartedAtMs = now();
      threadLog("turns_list_start", {
        limit: maxThreadTurns,
        timeoutMs: threadDetailRpcTimeoutMs,
        fallbackFrom: "thread-read",
      });
      try {
        const result = await turnsListThreadReadResult({
          threadId,
          summary,
          runtimeSettings,
          warning: `thread/read failed: ${safeErrorMessage(readErr)}`,
          mode: "turns-list",
          threadLog: null,
        });
        if (isHiddenThread(result && result.thread, visibility)) {
          threadLog("turns_list_hidden", {
            durationMs: now() - turnsStartedAtMs,
            status: 404,
          });
          return hiddenResponse();
        }
        threadLog("turns_list_ok", {
          durationMs: now() - turnsStartedAtMs,
          returnedTurns: result && result.thread && Array.isArray(result.thread.turns) ? result.thread.turns.length : null,
          mode: result && result.thread && result.thread.mobileReadMode ? result.thread.mobileReadMode : "turns-list",
        });
        timer.mark("turnsListFallbackMs", turnsStartedAtMs);
        return {
          status: 200,
          mode: "turns-list",
          body: attachDetailDiagnostics(result, context, {
            threadId,
            source: "turns-list",
            readDecision: "fallback-turns-list",
          }),
        };
      } catch (turnsErr) {
        threadLog("turns_list_error", {
          durationMs: now() - turnsStartedAtMs,
          timeout: isReadTimeoutError(turnsErr),
          error: safeErrorMessage(turnsErr),
        });
        if (isUnmaterializedThreadError(turnsErr)) {
          const mode = "unmaterialized";
          return {
            status: 200,
            mode,
            body: attachDetailDiagnostics(fallbackThreadReadResult({
              threadId,
              summary,
              runtimeSettings,
              warning: safeErrorMessage(turnsErr),
              mode,
            }), context, { threadId, source: mode, readDecision: "summary-fallback" }),
          };
        }
        if (isReadTimeoutError(turnsErr)) {
          const mode = "summary-timeout-fallback";
          return {
            status: 200,
            mode,
            body: attachDetailDiagnostics(fallbackThreadReadResult({
              threadId,
              summary,
              runtimeSettings,
              warning: safeErrorMessage(turnsErr),
              mode,
            }), context, { threadId, source: mode, readDecision: "summary-fallback" }),
          };
        }
        const mode = "summary-error-fallback";
        return {
          status: 200,
          mode,
          body: attachDetailDiagnostics(fallbackThreadReadResult({
            threadId,
            summary,
            runtimeSettings,
            warning: `thread/read failed: ${safeErrorMessage(readErr)}; thread/turns/list failed: ${safeErrorMessage(turnsErr)}`,
            mode,
          }), context, { threadId, source: mode, readDecision: "summary-fallback" }),
        };
      }
    }
  }

  return {
    readThreadDetail,
  };
}

module.exports = {
  createThreadDetailReadOrchestrationService,
  createThreadDetailTimer,
};
