"use strict";

const {
  activeReasonRequiresFullThreadRead,
  applyActiveThreadPolicyToBoundedReadDecision,
  planActiveThreadDetailReadPolicy,
} = require("./thread-detail-active-read-policy-service");
const {
  mergeActiveOverlayTurnWithWindowBackfill,
  mergeProjectionThreadWithActiveOverlay,
  planActiveWindowOverlay,
  summarizeActiveOverlayTurnEvidence,
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

function threadHasTurn(thread, expectedTurnId) {
  const id = nonEmptyText(expectedTurnId);
  if (!id || !thread || typeof thread !== "object" || !Array.isArray(thread.turns)) return false;
  return thread.turns.some((turn) => nonEmptyText(turn && (turn.id || turn.turnId || turn.turn_id)) === id);
}

function activeTurnIdFromThread(thread) {
  const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (!isActiveTurn(turn)) continue;
    const id = nonEmptyText(turn && (turn.id || turn.turnId || turn.turn_id));
    if (id) return id;
  }
  return "";
}

function activeTurnIdFromOverlayInput(input) {
  return nonEmptyText(input && input.activeTurnId)
    || nonEmptyText(input && input.turnId)
    || nonEmptyText(input && input.overlayTurn && (
      input.overlayTurn.id
      || input.overlayTurn.turnId
      || input.overlayTurn.turn_id
    ));
}

function projectionThreadIsPartial(thread) {
  if (!thread || typeof thread !== "object") return false;
  const projection = thread.mobileProjection && typeof thread.mobileProjection === "object"
    ? thread.mobileProjection
    : {};
  const mode = nonEmptyText(thread.mobileReadMode).toLowerCase();
  const source = nonEmptyText(projection.source || thread.mobileProjectionSource).toLowerCase();
  return projection.partial === true
    || projection.activeOverlayWindow === true
    || /partial|active-window/.test(mode)
    || source === "partial";
}

function overlaySource(input) {
  return nonEmptyText(input && (input.overlaySource || input.source)).toLowerCase();
}

function overlayCompletenessAllowsCachedActiveWindow(input) {
  const completeness = nonEmptyText(input && (
    input.overlayCompleteness
    || input.activeOverlayCompleteness
    || input.snapshotCompleteness
  )).toLowerCase();
  if (
    completeness !== "full"
    && completeness !== "complete"
    && completeness !== "backfilled"
    && completeness !== "preserved"
  ) {
    return false;
  }
  if (input && input.overlayPartial === true) return false;
  const partialKind = nonEmptyText(input && (input.overlayPartialKind || input.partialKind)).toLowerCase();
  if (partialKind === "notification-shell") return false;
  if (input && input.overlaySignatureHashPresent === false) return false;
  return true;
}

function overlayRequiresFreshActiveWindow(input) {
  return overlaySource(input) === "projection-live" && !overlayCompletenessAllowsCachedActiveWindow(input);
}

function promoteActiveReadPolicy(policy, reason) {
  return Object.assign({}, policy || {}, {
    activeFullReadRequired: true,
    activeFullReadReason: nonEmptyText(reason) || "active-window-detected",
    allowPartialProjection: false,
    shouldUseInitialTurnsList: false,
    initialTurnsListSkipReason: "active-thread-requires-full-read",
  });
}

function activeFullReadCanCloseWithOverlay(policy) {
  if (!policy || policy.activeFullReadRequired !== true) return false;
  return activeReasonRequiresFullThreadRead(policy.activeFullReadReason);
}

function activePolicyRequiresFullThreadRead(policy) {
  return Boolean(policy
    && policy.activeFullReadRequired === true
    && activeReasonRequiresFullThreadRead(policy.activeFullReadReason));
}

function applyActivePolicyContext(context, policy) {
  context.activeFullReadRequired = policy && policy.activeFullReadRequired === true;
  context.activeFullReadReason = policy && policy.activeFullReadReason || "";
}

function itemType(item) {
  return String(item && (item.type || item.itemType || item.kind) || "").toLowerCase();
}

function itemRole(item) {
  return String(item && (item.role || item.author || item.authorRole) || "").toLowerCase();
}

function statusText(status) {
  if (!status) return "";
  if (typeof status === "string") return status;
  return String(status.type || status.status || status.state || "");
}

function isCompletedTurn(turn) {
  return /completed|failed|cancel|error|interrupted/i.test(statusText(turn && turn.status));
}

function isActiveTurn(turn) {
  return /running|active|queued|processing|inprogress|in_progress|in-progress/i.test(statusText(turn && turn.status));
}

function isUserVisibleInputItem(item) {
  const type = itemType(item);
  if (type === "usermessage") return true;
  if (type === "message" && itemRole(item) === "user") return true;
  return /context.*compaction|context.*compression|context_compaction|context_compression/.test(type);
}

function isAssistantOrUsageItem(item) {
  const type = itemType(item);
  if (type === "agentmessage" || type === "plan" || type === "turnusagesummary") return true;
  return type === "message" && itemRole(item) === "assistant";
}

function latestCompletedTurn(thread) {
  const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (!turn || isActiveTurn(turn) || !isCompletedTurn(turn)) continue;
    return turn;
  }
  return null;
}

function latestCompletedReplayInputGap(thread) {
  const turn = latestCompletedTurn(thread);
  if (turn && turn.mobileSyntheticCompletionTurn === true) return false;
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  if (!items.length) return false;
  const hasUsage = items.some((item) => itemType(item) === "turnusagesummary");
  if (!hasUsage) return false;
  if (!items.some(isAssistantOrUsageItem)) return false;
  return !items.some(isUserVisibleInputItem);
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
  const scheduleProjectionRefresh = typeof options.scheduleProjectionRefresh === "function"
    ? options.scheduleProjectionRefresh
    : null;
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
      activeOverlayCompleteness: context.activeOverlayCompleteness || "",
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
    const prepared = await prepareResponse(result, Object.assign({
      responseBudgetEvidence: context.responseBudgetEvidence || "",
    }, details));
    context.timer.mark("prepareResponseMs", prepareStartedAtMs);
    return attachDetailDiagnostics(prepared, context, details);
  }

  async function readThreadDetail(input = {}) {
    const threadId = String(input.threadId || "").trim();
    const codex = input.codex || null;
    const threadLog = typeof input.threadLog === "function" ? input.threadLog : () => {};
    const preferRecentTurns = Boolean(input.preferRecentTurns);
    const responseBudgetEvidence = nonEmptyText(input.responseBudgetEvidence);
    const timer = createThreadDetailTimer(now);
    const context = {
      timer,
      preferRecentTurns,
      responseBudgetEvidence,
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
      activeOverlayCompleteness: "",
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
    let activeReadPolicy = planActiveThreadDetailReadPolicy({ summary, preferRecentTurns });
    applyActivePolicyContext(context, activeReadPolicy);
    const runtimeSettings = threadRuntimeSettings(threadId, summary);
    if (summary && isHiddenThread(summary, visibility)) {
      threadLog("hidden", { status: 404 });
      return hiddenResponse();
    }

    async function tryActiveOverlayFromInitialWindow(activeWindowResult, options = {}) {
      if (!projection || !activeWindowResult || !activeWindowResult.thread) return null;
      const sourceLabel = nonEmptyText(options.source) || "turns-list-initial-active-window";
      const shouldSeed = options.seed !== false;
      const activeOverlayStartedAtMs = now();
      let activeOverlayProjectionThread = asActiveOverlayProjectionWindow(activeWindowResult, {});
      if (!activeOverlayProjectionThread) return null;
      let activeOverlayProjectionResult = Object.assign({}, activeWindowResult || {}, {
        thread: activeOverlayProjectionThread,
      });
      if (shouldSeed && projection && activeOverlayProjectionThread) {
        if (latestCompletedReplayInputGap(activeOverlayProjectionThread)) {
          context.projectionSeedStatus = "skipped";
          context.projectionSeedSource = `${sourceLabel}-input-gap`;
          threadLog("projection_seed_skipped", { reason: "initial_active_window_input_gap" });
        } else {
          try {
            const seeded = seedProjection(projection, activeOverlayProjectionResult, {
              partial: true,
              partialKind: "turns-list-active-overlay-window",
            });
            context.projectionSeedStatus = seeded && seeded.skipped
              ? "skipped"
              : seeded && seeded.partial
                ? "seeded-partial"
                : "seeded";
            context.projectionSeedSource = seeded && seeded.reason || sourceLabel;
          } catch (err) {
            context.projectionSeedStatus = "failed";
            context.projectionSeedSource = sourceLabel;
            threadLog("projection_seed_error", { error: safeErrorMessage(err) });
          }
        }
      }
      if (!resolveActiveWindowOverlay && !options.overlayInput) {
        context.activeOverlayAction = "require-full-read";
        context.activeOverlayReason = "overlay-provider-unavailable";
        context.activeOverlaySource = "";
        context.activeOverlayCompleteness = "";
        threadLog("active_overlay_initial_window_plan", {
          action: context.activeOverlayAction,
          reason: context.activeOverlayReason,
          source: context.activeOverlaySource,
          completeness: context.activeOverlayCompleteness,
        });
        return null;
      }

      let overlayInput = options.overlayInput && typeof options.overlayInput === "object"
        ? options.overlayInput
        : null;
      if (!overlayInput) try {
        const activeOverlayResolveStartedAtMs = now();
        const overlayResult = resolveActiveWindowOverlay({
          threadId,
          summary,
          projection,
          runtimeSettings,
          projectionThread: activeOverlayProjectionThread,
          projectionLookup: null,
        });
        overlayInput = isPromiseLike(overlayResult) ? await overlayResult : overlayResult;
        timer.mark("activeOverlayResolveMs", activeOverlayResolveStartedAtMs);
      } catch (err) {
        if (!timer.timings.activeOverlayResolveMs) timer.mark("activeOverlayResolveMs", activeOverlayStartedAtMs);
        overlayInput = { reason: "resolver-error", error: safeErrorMessage(err) };
        threadLog("active_overlay_resolve_error", { error: safeErrorMessage(err) });
      }
      overlayInput = mergeActiveOverlayProjectionFields(overlayInput, activeOverlayProjectionThread);
      if (sourceLabel === "active-overlay-projection-window"
        && overlayRequiresFreshActiveWindow(overlayInput)) {
        threadLog("active_overlay_projection_live_requires_fresh_window", {
          source: overlaySource(overlayInput),
        });
        return null;
      }
      let activeOverlayPlanStartedAtMs = now();
      let activeOverlayPlan = planActiveWindowOverlay(Object.assign({}, overlayInput || {}, {
        summary,
        projectionThread: activeOverlayProjectionThread,
      }));
      timer.mark("activeOverlayPlanMs", activeOverlayPlanStartedAtMs);

      if ((activeOverlayPlan.action === "use-projection-overlay"
        || activeOverlayPlan.reason === "active-overlay-turn-incomplete")
        && overlayInput
        && overlayInput.overlayTurn) {
        const backfillStartedAtMs = now();
        const mergedOverlayTurn = mergeActiveOverlayTurnWithWindowBackfill(
          overlayInput.overlayTurn,
          activeOverlayProjectionThread,
        );
        if (mergedOverlayTurn && mergedOverlayTurn !== overlayInput.overlayTurn) {
          overlayInput = Object.assign({}, overlayInput, {
            overlayTurn: mergedOverlayTurn,
            overlayEvidence: summarizeActiveOverlayTurnEvidence(mergedOverlayTurn),
            overlayCompleteness: "backfilled",
            overlayPartial: false,
            overlayBackfillSource: sourceLabel,
          });
          activeOverlayPlanStartedAtMs = now();
          activeOverlayPlan = planActiveWindowOverlay(Object.assign({}, overlayInput, {
            summary,
            projectionThread: activeOverlayProjectionThread,
          }));
          timer.mark("activeOverlayPlanMs", activeOverlayPlanStartedAtMs);
          threadLog("active_overlay_backfilled", {
            source: sourceLabel,
            assistantItems: activeOverlayPlan.counts && activeOverlayPlan.counts.assistantItems || 0,
          });
        }
        timer.mark("activeOverlayBackfillWindowMs", backfillStartedAtMs);
      }

      timer.mark("activeOverlayMs", activeOverlayStartedAtMs);
      context.activeOverlayAction = activeOverlayPlan.action || "require-full-read";
      context.activeOverlayReason = activeOverlayPlan.reason || "";
      context.activeOverlaySource = activeOverlayPlan.overlaySource || "";
      context.activeOverlayCompleteness = activeOverlayPlan.overlayCompleteness || "";
      context.activeOverlayItems = activeOverlayPlan.counts && activeOverlayPlan.counts.items || 0;
      context.activeOverlayOperationItems = activeOverlayPlan.counts && activeOverlayPlan.counts.operationItems || 0;
      context.activeOverlayUploadItems = activeOverlayPlan.counts && activeOverlayPlan.counts.uploadItems || 0;
      context.activeOverlayAssistantItems = activeOverlayPlan.counts && activeOverlayPlan.counts.assistantItems || 0;
      context.activeOverlayReceiptItems = activeOverlayPlan.counts && activeOverlayPlan.counts.receiptItems || 0;
      threadLog("active_overlay_initial_window_plan", {
        action: context.activeOverlayAction,
        reason: context.activeOverlayReason,
        source: context.activeOverlaySource,
        completeness: context.activeOverlayCompleteness,
      });
      if (sourceLabel === "active-overlay-projection-window"
        && activeOverlayPlan.action === "use-projection-overlay"
        && activeOverlayPlan.overlayCompleteness !== "backfilled") {
        threadLog("active_overlay_projection_window_requires_backfill", {
          source: context.activeOverlaySource,
          completeness: context.activeOverlayCompleteness,
        });
        return null;
      }
      if (activeOverlayPlan.action !== "use-projection-overlay" || !overlayInput || !overlayInput.overlayTurn) {
        return null;
      }

      const activeOverlayMergeStartedAtMs = now();
      const mergedThread = mergeProjectionThreadWithActiveOverlay(
        activeOverlayProjectionThread,
        overlayInput.overlayTurn,
        {
          readMode: "projection-active-overlay",
          overlaySource: activeOverlayPlan.overlaySource,
          reason: activeOverlayPlan.reason,
          completeness: activeOverlayPlan.overlayCompleteness,
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
        threadLog("active_overlay_initial_window_hidden", {
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
        && activeFullReadCanCloseWithOverlay(activeReadPolicy)
        && resolveActiveWindowOverlay
        && activeOverlayProjectionWindowLookup,
    );
    context.activeOverlayWindowFirst = shouldUseActiveOverlayWindowFirst;
    const projectionLookup = projection && projectedThreadLookup && !shouldUseActiveOverlayWindowFirst
      ? projectedThreadLookup(projection, summary, runtimeSettings, {
        allowPartial: allowPartialProjection,
        allowStalePartial: allowPartialProjection,
      })
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
      const stalePartialHit = Boolean(projectionLookup && projectionLookup.stalePartial);
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
      const projectedActiveTurnId = activeTurnIdFromThread(projectedThread);
      const projectedThreadIsPartial = projectionThreadIsPartial(projectedThread);
      if (projectedActiveTurnId && projectedThreadIsPartial && !activeReadPolicy.activeFullReadRequired) {
        activeReadPolicy = promoteActiveReadPolicy(activeReadPolicy, "projection-window-active-turn");
        applyActivePolicyContext(context, activeReadPolicy);
        threadLog("projection_active_turn_detected", {
          action: "require-full-read",
          source: "projection-window",
        });
      }
      const canReturnProjectedThread = !activePolicyRequiresFullThreadRead(activeReadPolicy)
        && (!projectedThreadIsPartial || activeReadPolicy.allowPartialProjection === true);
      if (canReturnProjectedThread) {
        if (stalePartialHit && scheduleProjectionRefresh) {
          try {
            scheduleProjectionRefresh({
              threadId,
              summary,
              projection,
              runtimeSettings,
              reason: projectionLookup.staleReason || "stale-partial",
              threadLog,
            });
          } catch (err) {
            threadLog("projection_refresh_schedule_error", { error: safeErrorMessage(err) });
          }
        }
        rememberThreadSummary(projectedThread);
        return {
          status: 200,
          mode: projectedThread.mobileReadMode || "projection",
          body: await prepareAndAttach(projected, context, {
            threadId,
            source: projectedThread.mobileReadMode || "projection",
            readDecision: stalePartialHit
              ? "projection-stale-partial-hit"
              : projectedThread.mobileProjection && projectedThread.mobileProjection.partial
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

    if (activeReadPolicy.activeFullReadRequired
      && activeFullReadCanCloseWithOverlay(activeReadPolicy)
      && projection
      && resolveActiveWindowOverlay) {
      const activeOverlayStartedAtMs = now();
      let overlayProjectionLookup = projectionLookup;
      let overlayProjected = projected && projected.thread ? projected : null;
      let projectionThread = overlayProjected && overlayProjected.thread || null;
      let overlayInput = null;
      let activeOverlayProjectionWindowLookupAttempted = false;
      let activeOverlayHistoryWindowWithoutActiveTurn = false;
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
        const activeOverlayProjectionLookupStartedAtMs = now();
        activeOverlayProjectionWindowLookupAttempted = true;
        const overlayTurnId = activeTurnIdFromOverlayInput(overlayInput);
        overlayProjectionLookup = overlayWindowLookup(projection, summary, runtimeSettings, {
          allowPartial: true,
          activeOverlay: true,
        });
        if (activeOverlayProjectionWindowLookup
          && (!overlayProjectionLookup || !overlayProjectionLookup.result)
          && overlayTurnId) {
          const retriedOverlayProjectionLookup = overlayWindowLookup(projection, summary, runtimeSettings, {
            allowPartial: true,
            activeOverlay: true,
            activeOverlayStatusProven: true,
            omitActiveTurnId: overlayTurnId,
          });
          if (retriedOverlayProjectionLookup && retriedOverlayProjectionLookup.result) {
            overlayProjectionLookup = retriedOverlayProjectionLookup;
            activeOverlayHistoryWindowWithoutActiveTurn = true;
            threadLog("active_overlay_projection_window_retry", {
              reason: "history-window-without-active-turn",
            });
          } else if (!overlayProjectionLookup && retriedOverlayProjectionLookup) {
            overlayProjectionLookup = retriedOverlayProjectionLookup;
          }
        }
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
      let activeOverlayWindowReadAttempted = false;
      let activeOverlayFreshWindowRead = false;
      const activeOverlayWindowHasInputGap = Boolean(activeOverlayProjectionThread
        && latestCompletedReplayInputGap(activeOverlayProjectionThread));
      const activeOverlayWindowRebuildReason = activeOverlayPlan.reason === "missing-projection-window"
        ? "missing-projection-window"
        : activeOverlayPlan.action === "use-projection-overlay" && activeOverlayWindowHasInputGap
          ? "latest-completed-input-missing"
          : "";
      if (activeOverlayWindowRebuildReason
        && overlayInput
        && overlayInput.overlayTurn
        && turnsListThreadReadResult) {
        if (activeOverlayWindowRebuildReason === "latest-completed-input-missing") {
          threadLog("active_overlay_window_input_gap", { action: "rebuild-window" });
        }
        const activeWindowStartedAtMs = now();
        activeOverlayWindowReadAttempted = true;
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
          activeOverlayProjectionThread = asActiveOverlayProjectionWindow(activeWindowResult, overlayInput);
          activeOverlayFreshWindowRead = Boolean(activeOverlayProjectionThread);
          activeOverlayProjectionResult = activeOverlayProjectionThread
            ? Object.assign({}, activeWindowResult || {}, { thread: activeOverlayProjectionThread })
            : activeWindowResult;
          if (projection && activeOverlayProjectionThread) {
            if (latestCompletedReplayInputGap(activeOverlayProjectionThread)) {
              context.projectionSeedStatus = "skipped";
              context.projectionSeedSource = "active-overlay-window-input-gap";
              threadLog("projection_seed_skipped", { reason: "active_overlay_window_input_gap" });
            } else {
              try {
                const seeded = seedProjection(projection, activeOverlayProjectionResult, {
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
          }
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
      if (activeOverlayPlan.action === "use-projection-overlay"
        && activeOverlayProjectionThread
        && latestCompletedReplayInputGap(activeOverlayProjectionThread)) {
        threadLog("active_overlay_window_input_gap", { action: "try-full-projection" });
        const fullProjectionStartedAtMs = now();
        const fullProjection = projectedThreadResult
          ? projectedThreadResult(projection, summary, runtimeSettings, {
            activeOverlay: true,
            allowPartial: false,
          })
          : null;
        timer.mark("activeOverlayFullProjectionMs", fullProjectionStartedAtMs);
        if (fullProjection && fullProjection.thread && !latestCompletedReplayInputGap(fullProjection.thread)) {
          activeOverlayProjectionThread = fullProjection.thread;
          activeOverlayProjectionResult = fullProjection;
          overlayInput = mergeActiveOverlayProjectionFields(overlayInput, activeOverlayProjectionThread);
          activeOverlayPlanStartedAtMs = now();
          activeOverlayPlan = planActiveWindowOverlay(Object.assign({}, overlayInput || {}, {
            summary,
            projectionThread: activeOverlayProjectionThread,
          }));
          timer.mark("activeOverlayPlanMs", activeOverlayPlanStartedAtMs);
          threadLog("active_overlay_window_input_gap_repaired", { source: "full-projection" });
        } else {
          activeOverlayPlan = Object.assign({}, activeOverlayPlan, {
            action: "require-full-read",
            reason: "latest-completed-input-missing",
          });
          threadLog("active_overlay_window_input_gap_unresolved", { action: "require-full-read" });
        }
      }
      if ((activeOverlayPlan.action === "use-projection-overlay"
        || activeOverlayPlan.reason === "active-overlay-turn-incomplete")
        && overlayInput
        && overlayInput.overlayTurn) {
        const backfillStartedAtMs = now();
        const backfillActiveTurnId = nonEmptyText(overlayInput.activeTurnId)
          || nonEmptyText(overlayInput.overlayTurn && (overlayInput.overlayTurn.id || overlayInput.overlayTurn.turnId || overlayInput.overlayTurn.turn_id));
        let backfillThread = null;
        let backfillSource = "";
        const requiresFreshActiveWindow = overlayRequiresFreshActiveWindow(overlayInput);
        const projectionMeta = activeOverlayProjectionThread
          && activeOverlayProjectionThread.mobileProjection
          && typeof activeOverlayProjectionThread.mobileProjection === "object"
          ? activeOverlayProjectionThread.mobileProjection
          : {};
        if ((activeOverlayFreshWindowRead || !requiresFreshActiveWindow)
          && threadHasTurn(activeOverlayProjectionThread, backfillActiveTurnId)) {
          backfillThread = activeOverlayProjectionThread;
          backfillSource = activeOverlayFreshWindowRead
            ? "turns-list-active-overlay-window"
            : projectionMeta.activeOverlayWindow === true
              || nonEmptyText(projectionMeta.partialKind).toLowerCase() === "turns-list-active-overlay-window"
            ? "active-window-projection"
            : "projection-thread";
        }
        if (!backfillThread
          && !requiresFreshActiveWindow
          && activeOverlayProjectionWindowLookup
          && !activeOverlayProjectionWindowLookupAttempted) {
          const cachedWindow = activeOverlayProjectionWindowLookup(projection, summary, runtimeSettings, {
            allowPartial: true,
            activeOverlay: true,
          });
          const resolvedCachedWindow = isPromiseLike(cachedWindow) ? await cachedWindow : cachedWindow;
          const cachedThread = resolvedCachedWindow
            && resolvedCachedWindow.result
            && resolvedCachedWindow.result.thread;
          if (cachedThread && typeof cachedThread === "object" && threadHasTurn(cachedThread, backfillActiveTurnId)) {
            backfillThread = cachedThread;
            backfillSource = "cached-active-window";
          }
        }
        const canUseHistoryWindowWithoutBackfill = activeOverlayHistoryWindowWithoutActiveTurn
          && overlayCompletenessAllowsCachedActiveWindow(overlayInput);
        if (!backfillThread
          && turnsListThreadReadResult
          && !activeOverlayWindowReadAttempted
          && !canUseHistoryWindowWithoutBackfill) {
          const activeWindowStartedAtMs = now();
          try {
            activeOverlayWindowReadAttempted = true;
            const activeWindowResult = await turnsListThreadReadResult({
              threadId,
              summary,
              runtimeSettings,
              warning: "",
              mode: "turns-list-active-overlay-window",
              threadLog,
            });
            if (isHiddenThread(activeWindowResult && activeWindowResult.thread, visibility)) {
              threadLog("active_overlay_backfill_window_hidden", {
                durationMs: now() - backfillStartedAtMs,
                status: 404,
              });
              return hiddenResponse();
            }
            timer.mark("activeOverlayWindowMs", activeWindowStartedAtMs);
            backfillThread = asActiveOverlayProjectionWindow(activeWindowResult, overlayInput);
            activeOverlayFreshWindowRead = Boolean(backfillThread);
            backfillSource = "turns-list-active-overlay-window";
            if (projection && backfillThread && !latestCompletedReplayInputGap(backfillThread)) {
              try {
                const seeded = seedProjection(projection, Object.assign({}, activeWindowResult || {}, { thread: backfillThread }), {
                  partial: true,
                  partialKind: "turns-list-active-overlay-window",
                  projectionRevision: overlayInput.overlayRevision || overlayInput.projectionRevision,
                  projectionTimestampMs: overlayInput.overlayTimestampMs || overlayInput.projectionTimestampMs,
                });
                context.projectionSeedStatus = context.projectionSeedStatus || (seeded && seeded.skipped
                  ? "skipped"
                  : seeded && seeded.partial
                    ? "seeded-partial"
                    : "seeded");
                context.projectionSeedSource = context.projectionSeedSource || seeded && seeded.reason || "turns-list-active-overlay-window";
              } catch (err) {
                context.projectionSeedStatus = context.projectionSeedStatus || "failed";
                context.projectionSeedSource = context.projectionSeedSource || "turns-list-active-overlay-window";
                threadLog("projection_seed_error", { error: safeErrorMessage(err) });
              }
            }
          } catch (err) {
            threadLog("active_overlay_backfill_window_error", {
              durationMs: now() - backfillStartedAtMs,
              timeout: isReadTimeoutError(err),
              error: safeErrorMessage(err),
            });
          }
        }
        if (backfillThread) {
          const mergedOverlayTurn = mergeActiveOverlayTurnWithWindowBackfill(overlayInput.overlayTurn, backfillThread);
          if (mergedOverlayTurn && mergedOverlayTurn !== overlayInput.overlayTurn) {
            overlayInput = Object.assign({}, overlayInput, {
              overlayTurn: mergedOverlayTurn,
              overlayEvidence: summarizeActiveOverlayTurnEvidence(mergedOverlayTurn),
              overlayCompleteness: "backfilled",
              overlayPartial: false,
              overlayBackfillSource: backfillSource,
            });
            activeOverlayPlanStartedAtMs = now();
            activeOverlayPlan = planActiveWindowOverlay(Object.assign({}, overlayInput, {
              summary,
              projectionThread: activeOverlayProjectionThread,
            }));
            timer.mark("activeOverlayPlanMs", activeOverlayPlanStartedAtMs);
            threadLog("active_overlay_backfilled", {
              source: backfillSource,
              assistantItems: activeOverlayPlan.counts && activeOverlayPlan.counts.assistantItems || 0,
            });
          }
        }
        if (activeOverlayProjectionThread
          && projectionThreadIsPartial(activeOverlayProjectionThread)
          && projectedThreadResult) {
          const historyBaselineStartedAtMs = now();
          const historyBaseline = projectedThreadResult(projection, summary, runtimeSettings, {
            activeOverlay: true,
            allowPartial: false,
          });
          timer.mark("activeOverlayHistoryBaselineMs", historyBaselineStartedAtMs);
          if (historyBaseline && historyBaseline.thread) {
            activeOverlayProjectionThread = historyBaseline.thread;
            activeOverlayProjectionResult = historyBaseline;
            overlayInput = mergeActiveOverlayProjectionFields(overlayInput, activeOverlayProjectionThread);
            activeOverlayPlanStartedAtMs = now();
            activeOverlayPlan = planActiveWindowOverlay(Object.assign({}, overlayInput, {
              summary,
              projectionThread: activeOverlayProjectionThread,
            }));
            timer.mark("activeOverlayPlanMs", activeOverlayPlanStartedAtMs);
            threadLog("active_overlay_history_baseline_repaired", {
              source: "full-projection",
              action: activeOverlayPlan.action || "require-full-read",
            });
          }
        }
        timer.mark("activeOverlayBackfillWindowMs", backfillStartedAtMs);
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
      context.activeOverlayCompleteness = activeOverlayPlan.overlayCompleteness || "";
      threadLog("active_overlay_plan", {
        action: context.activeOverlayAction,
        reason: context.activeOverlayReason,
        source: context.activeOverlaySource,
        completeness: context.activeOverlayCompleteness,
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
            completeness: activeOverlayPlan.overlayCompleteness,
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
      context.activeOverlayReason = activeFullReadCanCloseWithOverlay(activeReadPolicy)
        ? resolveActiveWindowOverlay ? "projection-input-unavailable" : "overlay-provider-unavailable"
        : "active-full-read-not-overlay-closable";
    }

    if (!activeReadPolicy.activeFullReadRequired
      && preferRecentTurns
      && projection
      && resolveActiveWindowOverlay
      && activeOverlayProjectionWindowLookup) {
      let overlayInput = null;
      try {
        const activeOverlayResolveStartedAtMs = now();
        const overlayResult = resolveActiveWindowOverlay({
          threadId,
          summary,
          projection,
          runtimeSettings,
          projectionThread: null,
          projectionLookup: null,
        });
        overlayInput = isPromiseLike(overlayResult) ? await overlayResult : overlayResult;
        timer.mark("activeOverlayResolveMs", activeOverlayResolveStartedAtMs);
      } catch (err) {
        overlayInput = { reason: "resolver-error", error: safeErrorMessage(err) };
        threadLog("active_overlay_resolve_error", { error: safeErrorMessage(err) });
      }
      const overlayTurnId = nonEmptyText(overlayInput && overlayInput.activeTurnId)
        || nonEmptyText(overlayInput && overlayInput.overlayTurn && (
          overlayInput.overlayTurn.id
          || overlayInput.overlayTurn.turnId
          || overlayInput.overlayTurn.turn_id
        ));
      if (overlayInput && overlayInput.overlayTurn && overlayTurnId) {
        const activeOverlayProjectionLookupStartedAtMs = now();
        const overlayProjectionLookup = activeOverlayProjectionWindowLookup(projection, summary, runtimeSettings, {
          allowPartial: true,
          allowStalePartial: true,
          activeOverlay: true,
          activeOverlayStatusProven: true,
          omitActiveTurnId: overlayTurnId,
        });
        const resolvedOverlayProjectionLookup = isPromiseLike(overlayProjectionLookup)
          ? await overlayProjectionLookup
          : overlayProjectionLookup;
        timer.mark("activeOverlayProjectionLookupMs", activeOverlayProjectionLookupStartedAtMs);
        if (resolvedOverlayProjectionLookup && resolvedOverlayProjectionLookup.missReason) {
          context.projectionMissReason = resolvedOverlayProjectionLookup.missReason;
        }
        const overlayProjectionResult = resolvedOverlayProjectionLookup
          && resolvedOverlayProjectionLookup.result
          && resolvedOverlayProjectionLookup.result.thread
          ? resolvedOverlayProjectionLookup.result
          : null;
        const previousActiveReadPolicy = activeReadPolicy;
        const previousActiveOverlayAction = context.activeOverlayAction;
        const previousActiveOverlayReason = context.activeOverlayReason;
        const previousActiveOverlaySource = context.activeOverlaySource;
        const previousActiveOverlayCompleteness = context.activeOverlayCompleteness;
        if (overlayProjectionResult) {
          activeReadPolicy = promoteActiveReadPolicy(activeReadPolicy, "projection-live-active-turn");
          applyActivePolicyContext(context, activeReadPolicy);
          threadLog("projection_live_active_turn_detected", {
            action: "try-active-overlay",
          });
          const overlayResponse = await tryActiveOverlayFromInitialWindow(overlayProjectionResult, {
            source: "active-overlay-projection-window",
            seed: false,
            overlayInput,
          });
          if (overlayResponse) return overlayResponse;
          activeReadPolicy = previousActiveReadPolicy;
          applyActivePolicyContext(context, activeReadPolicy);
          context.activeOverlayAction = previousActiveOverlayAction;
          context.activeOverlayReason = previousActiveOverlayReason;
          context.activeOverlaySource = previousActiveOverlaySource;
          context.activeOverlayCompleteness = previousActiveOverlayCompleteness;
        }
        if (turnsListThreadReadResult) {
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
              threadLog("active_overlay_preprobe_window_hidden", {
                durationMs: now() - activeWindowStartedAtMs,
                status: 404,
              });
              return hiddenResponse();
            }
            timer.mark("activeOverlayWindowMs", activeWindowStartedAtMs);
            activeReadPolicy = promoteActiveReadPolicy(activeReadPolicy, "projection-live-active-turn");
            applyActivePolicyContext(context, activeReadPolicy);
            context.activeOverlayWindowFirst = true;
            threadLog("projection_live_active_turn_detected", {
              action: "try-active-overlay-window",
            });
            const overlayResponse = await tryActiveOverlayFromInitialWindow(activeWindowResult, {
              source: "active-overlay-projection-window",
              seed: true,
              overlayInput,
            });
            if (overlayResponse) return overlayResponse;
          } catch (err) {
            threadLog("active_overlay_preprobe_window_error", {
              durationMs: now() - activeWindowStartedAtMs,
              timeout: isReadTimeoutError(err),
              error: safeErrorMessage(err),
            });
          }
          activeReadPolicy = previousActiveReadPolicy;
          applyActivePolicyContext(context, activeReadPolicy);
          context.activeOverlayAction = previousActiveOverlayAction;
          context.activeOverlayReason = previousActiveOverlayReason;
          context.activeOverlaySource = previousActiveOverlaySource;
          context.activeOverlayCompleteness = previousActiveOverlayCompleteness;
          context.activeOverlayWindowFirst = false;
        }
      }
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
        const initialActiveTurnId = activeTurnIdFromThread(result && result.thread);
        if (initialActiveTurnId && !activeReadPolicy.activeFullReadRequired) {
          activeReadPolicy = promoteActiveReadPolicy(activeReadPolicy, "initial-window-active-turn");
          applyActivePolicyContext(context, activeReadPolicy);
          context.activeOverlayWindowFirst = true;
          context.projectionSeedStatus = "skipped";
          context.projectionSeedSource = "initial-active-window";
          threadLog("turns_list_initial_active_turn_detected", {
            action: "require-full-read",
          });
          threadLog("turns_list_initial_active_window_full_read_required", {
            reason: "initial-window-active-turn",
            projectionSeedStatus: context.projectionSeedStatus || "",
            projectionSeedSource: context.projectionSeedSource || "",
          });
        } else if (projection && result && result.thread) {
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
        if (!activeReadPolicy.activeFullReadRequired) {
          return {
            status: 200,
            mode: "turns-list-initial",
            body: attachDetailDiagnostics(result, context, {
              threadId,
              source: "turns-list-initial",
              readDecision: "initial-turns-list",
            }),
          };
        }
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
      if (projection && result && result.thread) {
        try {
          seedProjection(projection, result);
          result.thread.mobileProjection = Object.assign({}, result.thread.mobileProjection || {}, {
            source: activeReadPolicy.activeFullReadRequired ? "active-thread-read" : "seeded",
          });
          context.projectionSeedStatus = "seeded";
          context.projectionSeedSource = activeReadPolicy.activeFullReadRequired ? "active-thread-read" : "thread-read";
        } catch (err) {
          context.projectionSeedStatus = "failed";
          context.projectionSeedSource = activeReadPolicy.activeFullReadRequired ? "active-thread-read" : "thread-read";
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
          responseBudgetEvidence,
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
