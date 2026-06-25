"use strict";

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
      projectionSeedStatus: context.projectionSeedStatus || "",
      projectionSeedSource: context.projectionSeedSource || "",
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
      projectionSeedStatus: "",
      projectionSeedSource: "",
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
    const projected = projection ? projectedThreadResult(projection, summary, runtimeSettings) : null;
    timer.mark("projectionMs", projectionStartedAtMs);
    if (projected && projected.thread) {
      context.projectionState = "hit";
      const projectionInfo = projectionDiagnosticsFromThread(projected.thread);
      context.projectionSource = projectionInfo.source;
      context.projectionVersion = projectionInfo.version;
      context.projectionAgeMs = projectionInfo.ageMs;
      if (isHiddenThread(projected.thread, visibility)) {
        threadLog("projection_hidden", {
          durationMs: now() - projectionStartedAtMs,
          status: 404,
        });
        return hiddenResponse();
      }
      rememberThreadSummary(projected.thread);
      threadLog("projection_hit", {
        durationMs: now() - projectionStartedAtMs,
        mode: projected.thread.mobileReadMode,
        returnedTurns: Array.isArray(projected.thread.turns) ? projected.thread.turns.length : null,
        omittedTurns: projected.thread.mobileOmittedTurnCount || 0,
      });
      return {
        status: 200,
        mode: projected.thread.mobileReadMode || "projection",
        body: await prepareAndAttach(projected, context, {
          threadId,
          source: projected.thread.mobileReadMode || "projection",
          readDecision: "projection-hit",
        }),
      };
    }
    if (projection) {
      context.projectionState = "miss";
    }

    if (preferRecentTurns) {
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
    }

    const boundedReadDecision = normalizeBoundedReadDecision(
      preferBoundedReadBeforeFullRead({ threadId, summary, projection, runtimeSettings }),
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
          result.thread.mobileProjection = Object.assign({}, result.thread.mobileProjection || {}, { source: "seeded" });
          context.projectionSeedStatus = "seeded";
          context.projectionSeedSource = "thread-read";
        } catch (err) {
          context.projectionSeedStatus = "failed";
          context.projectionSeedSource = "thread-read";
          threadLog("projection_seed_error", { error: safeErrorMessage(err) });
        }
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
