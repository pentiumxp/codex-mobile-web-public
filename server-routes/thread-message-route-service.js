"use strict";

const path = require("node:path");
const {
  appendSecretRefReceiptText,
  normalizeSecretRefsFromInput,
  publicSensitiveContext,
} = require("../services/runtime/home-ai-secret-ref-service");

const DEFAULT_ACTIVE_TURN_STEER_FAST_ACCEPT_MS = 120;
const DEFAULT_ACTIVE_TURN_PREFLIGHT_FAST_ACCEPT_MS = 120;

function scheduleDetachedTask(task) {
  Promise.resolve()
    .then(task)
    .catch(() => {});
}

function resolveAfter(ms, value) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), Math.max(0, Number(ms) || 0));
  });
}

function markSubmitTiming(timings, name, startedAtMs) {
  if (!timings || !name) return 0;
  const elapsed = Math.max(0, Date.now() - Number(startedAtMs || Date.now()));
  timings[name] = elapsed;
  return elapsed;
}

function markSubmitTimingAliases(timings, names, startedAtMs) {
  const list = Array.isArray(names) ? names.filter(Boolean) : [names].filter(Boolean);
  if (!list.length) return 0;
  const elapsed = Math.max(0, Date.now() - Number(startedAtMs || Date.now()));
  for (const name of list) timings[name] = elapsed;
  return elapsed;
}

function compactErrorText(err) {
  if (!err) return "";
  const parts = [
    err.code,
    err.errorCode,
    err.name,
    err.message,
    err.reason,
  ].filter(Boolean);
  return parts.map((part) => String(part || "").trim()).filter(Boolean).join(" ").toLowerCase();
}

function turnStartRequiresThreadResume(err) {
  const text = compactErrorText(err);
  if (!text) return false;
  if (/\bthread[_ -]?not[_ -]?loaded\b/.test(text)) return true;
  if (/\bthread\b.{0,80}\bnot\s+loaded\b/.test(text)) return true;
  if (/\bthread[_ -]?unloaded\b/.test(text)) return true;
  if (/\bunloaded\s+thread\b/.test(text)) return true;
  if (/\bthread[_ -]?unmaterialized\b/.test(text)) return true;
  if (/\bunmaterialized\s+thread\b/.test(text)) return true;
  if (/\bthread\b.{0,80}\b(?:must|needs|requires)\b.{0,80}\bresume\b/.test(text)) return true;
  if (/\bresume\b.{0,40}\bthread\b.{0,40}\bbefore\b/.test(text)) return true;
  if (/\b(?:conversation|session)\b.{0,80}\b(?:not\s+loaded|unloaded)\b/.test(text)) return true;
  return false;
}

function isThreadResumeAlreadyLoadedError(err) {
  const text = compactErrorText(err);
  if (!text) return false;
  return /\balready\b.{0,80}\b(?:loaded|active|running|resumed)\b/.test(text);
}

function createThreadMessageRouteService(dependencies = {}) {
  const {
    codex,
    modelOptions = [],
    reasoningEffortOptions = [],
    mutationRpcTimeoutMs = 120000,
    startThreadFromRequestBody,
    readMessageBody,
    buildTurnInput,
    persistExtendedHistoryForUploads,
    requestedCodexFastMode,
    truncateSingleLine,
    readGlobalState,
    visibilityFromGlobalState,
    normalizeFsPath,
    messageSubmissionKeys,
    runMessageSubmissionOnce,
    applyPermissionModeOverride,
    readStartThreadDeveloperInstructions,
    applyStartThreadRuntimeSettings,
    applyTurnRuntimeSettings,
    applyResumeRuntimeSettings,
    applyCodexFastServiceTier,
    threadIdFromStartResult,
    rememberProjectlessThreadId,
    persistThreadTitleToSessionIndex,
    tryUpdateThreadTitle,
    notifyLocalTurnStarted,
    rememberThreadIdForTurnId,
    rememberStartedThread,
    resolveThreadRuntimeSettings,
    isCodexAccountAuthError,
    codexAccountAuthErrorPayload,
    logMessageSubmit,
    staleActiveTurnPreflight,
    pendingSteerEchoStore,
    isTurnSteerUnsupportedError,
    isStaleActiveTurnError,
    autoRecoverThreadTurn,
    activeTurnSteerFastAcceptMs = DEFAULT_ACTIVE_TURN_STEER_FAST_ACCEPT_MS,
    activeTurnPreflightFastAcceptMs = DEFAULT_ACTIVE_TURN_PREFLIGHT_FAST_ACCEPT_MS,
    scheduleBackgroundTask = scheduleDetachedTask,
  } = dependencies;

  async function handleRoute(options = {}) {
    const url = options.url;
    const method = String(options.method || "").toUpperCase();
    const readBody = typeof options.readBody === "function" ? options.readBody : async () => ({});
    const sendJson = typeof options.sendJson === "function" ? options.sendJson : () => {};
    const readMessage = typeof options.readMessageBody === "function" ? options.readMessageBody : readMessageBody;
    if (!url || typeof url.pathname !== "string") return { handled: false };

    if (url.pathname === "/api/threads" && method === "POST") {
      const body = await readBody();
      try {
        sendJson(200, await startThreadFromRequestBody(body));
      } catch (err) {
        sendJson(err.statusCode || 500, { error: err.message || String(err) });
      }
      return { handled: true };
    }

    if (url.pathname === "/api/threads/new-message" && method === "POST") {
      const { fields: body, uploads } = await readMessage("new-thread");
      const cwd = String(body.cwd || "").trim();
      const text = String(body.text || "").trim();
      const secretContext = normalizeSecretRefsFromInput(body, {
        source: "message",
        targetPlugin: "codex",
        workspaceCwd: cwd,
      });
      const textForInput = appendSecretRefReceiptText(text, secretContext).trim();
      const requestedModel = modelOptions.includes(String(body.model || "").trim())
        ? String(body.model || "").trim()
        : "";
      const requestedEffort = reasoningEffortOptions.includes(String(body.effort || "").trim())
        ? String(body.effort || "").trim()
        : "";
      const requestedFastMode = requestedCodexFastMode(body.fastMode);
      const requestedTitle = truncateSingleLine(String(body.title || body.name || "").trim(), 120);
      const input = buildTurnInput(textForInput, uploads);
      const persistExtendedHistory = persistExtendedHistoryForUploads(uploads);
      if (!input.length) {
        sendJson(400, { error: "Message text or attachment is required" });
        return { handled: true };
      }
      const globalState = readGlobalState();
      const visibility = visibilityFromGlobalState(globalState);
      if (cwd && visibility.workspaceKeys.size > 0 && !visibility.workspaceKeys.has(normalizeFsPath(cwd))) {
        sendJson(403, { error: "Workspace is not visible in Codex Desktop" });
        return { handled: true };
      }
      const submissionKeys = messageSubmissionKeys("new-thread", body, textForInput, uploads);
      try {
        const result = await runMessageSubmissionOnce(submissionKeys, uploads, async () => {
          const runtimeSettings = applyPermissionModeOverride({}, body.permissionMode, cwd);
          const startParamsBase = {
            modelProvider: null,
            config: {},
            developerInstructions: readStartThreadDeveloperInstructions(cwd) || "",
            personality: null,
            ephemeral: null,
            dynamicTools: null,
            mockExperimentalField: null,
            experimentalRawEvents: false,
            persistExtendedHistory,
          };
          if (cwd) startParamsBase.cwd = cwd;
          const startParams = applyStartThreadRuntimeSettings(startParamsBase, runtimeSettings);
          if (requestedModel) startParams.model = requestedModel;
          const startResult = await codex.request("thread/start", startParams, {
            timeoutMs: mutationRpcTimeoutMs,
            retry: false,
          });
          const threadId = threadIdFromStartResult(startResult);
          if (!threadId) throw new Error("New thread creation failed: app-server did not return threadId");
          const projectlessThreadRegistered = cwd ? false : rememberProjectlessThreadId(threadId);
          let titleUpdated = false;
          let titleIndexed = false;
          let titleWarning = "";
          if (requestedTitle) {
            titleIndexed = persistThreadTitleToSessionIndex(threadId, requestedTitle);
            try {
              titleUpdated = await tryUpdateThreadTitle(threadId, requestedTitle);
            } catch (err) {
              titleWarning = `Thread title update failed: ${String(err && err.message || err).slice(0, 240)}`;
            }
          }
          const turnParams = applyCodexFastServiceTier(applyTurnRuntimeSettings({
            threadId,
            input,
            ...(cwd ? { cwd } : {}),
          }, runtimeSettings), requestedFastMode);
          if (requestedModel) turnParams.model = requestedModel;
          if (requestedEffort) turnParams.effort = requestedEffort;
          const turnResult = await codex.request("turn/start", turnParams, {
            timeoutMs: mutationRpcTimeoutMs,
            retry: false,
          });
          const turnId = notifyLocalTurnStarted(threadId, turnResult, { source: "new-thread-message" });
          rememberThreadIdForTurnId(threadId, turnId);
          const startedThread = (startResult && startResult.thread) || (startResult && startResult.data && startResult.data.thread) || {};
          const thread = rememberStartedThread(Object.assign(
            {},
            startedThread,
            {
              id: threadId,
              name: requestedTitle || undefined,
              preview: requestedTitle || text || (cwd ? path.basename(cwd) : "") || "新建对话",
              cwd: cwd || startedThread.cwd || "",
              status: { type: "active" },
              turns: [],
            },
          ));
          return {
            ok: true,
            threadId,
            thread,
            title: requestedTitle,
            titleUpdated,
            titleIndexed,
            titleWarning,
            projectlessThreadRegistered,
            turnId: (turnResult && (turnResult.turnId || turnResult.id || turnResult.turn && turnResult.turn.id)) || "",
            result: turnResult,
            startResult,
            sensitiveContext: publicSensitiveContext(secretContext),
          };
        });
        sendJson(200, result);
      } catch (err) {
        if (isCodexAccountAuthError(err)) {
          sendJson(409, codexAccountAuthErrorPayload(err));
          return { handled: true };
        }
        sendJson(err.statusCode || 500, { error: err.message || String(err) });
      }
      return { handled: true };
    }

    const resume = url.pathname.match(/^\/api\/threads\/([^/]+)\/resume$/);
    if (resume && method === "POST") {
      const threadId = decodeURIComponent(resume[1]);
      const body = await readBody();
      const runtimeSettings = applyPermissionModeOverride(await resolveThreadRuntimeSettings(threadId), body.permissionMode, body.cwd || null);
      sendJson(200, await codex.request("thread/resume", applyResumeRuntimeSettings({
        threadId,
        cwd: body.cwd || null,
        persistExtendedHistory: true,
      }, runtimeSettings), { timeoutMs: mutationRpcTimeoutMs, retry: false }));
      return { handled: true };
    }

    const autoRecover = url.pathname.match(/^\/api\/threads\/([^/]+)\/auto-recover$/);
    if (autoRecover && method === "POST") {
      const threadId = decodeURIComponent(autoRecover[1]);
      const body = await readBody();
      const result = await autoRecoverThreadTurn(threadId, {
        activeTurnId: body.activeTurnId || "",
        wasRunning: body.wasRunning,
        cwd: body.cwd || null,
        permissionMode: body.permissionMode || "",
        reason: body.reason || "",
      });
      sendJson(200, result);
      return { handled: true };
    }

    const messages = url.pathname.match(/^\/api\/threads\/([^/]+)\/messages$/);
    if (messages && method === "POST") {
      const routeStartedAtMs = Date.now();
      const timings = {};
      const timedSendJson = (status, body) => {
        const sendJsonStartedAtMs = Date.now();
        const response = sendJson(status, body);
        markSubmitTiming(timings, "sendJsonMs", sendJsonStartedAtMs);
        return response;
      };
      const threadId = decodeURIComponent(messages[1]);
      const bodyReadStartedAtMs = Date.now();
      const { fields: body, uploads } = await readMessage(threadId);
      markSubmitTimingAliases(timings, ["readMessageMs", "bodyReadMs"], bodyReadStartedAtMs);
      const inputStartedAtMs = Date.now();
      const text = String(body.text || "").trim();
      const secretContext = normalizeSecretRefsFromInput(body, {
        source: "message",
        targetPlugin: "codex",
        threadId,
        workspaceCwd: body.cwd || "",
      });
      const textForInput = appendSecretRefReceiptText(text, secretContext).trim();
      const input = buildTurnInput(textForInput, uploads);
      const persistExtendedHistory = persistExtendedHistoryForUploads(uploads);
      markSubmitTiming(timings, "inputBuildMs", inputStartedAtMs);
      if (!input.length) {
        timings.totalMs = Math.max(0, Date.now() - routeStartedAtMs);
        timedSendJson(400, { error: "Message text or attachment is required" });
        logMessageSubmit("empty", {
          threadId,
          clientSubmissionId: body.clientSubmissionId,
          uploads: uploads.length,
          timings,
        });
        return { handled: true };
      }
      logMessageSubmit("received", {
        threadId,
        textChars: textForInput.length,
        uploads: uploads.length,
        activeTurnId: body.activeTurnId || "",
        clientSubmissionId: body.clientSubmissionId,
      });
      const submissionKeyStartedAtMs = Date.now();
      const submissionKeys = messageSubmissionKeys(threadId, body, textForInput, uploads);
      markSubmitTiming(timings, "submissionKeyMs", submissionKeyStartedAtMs);
      const requestedModel = modelOptions.includes(String(body.model || "").trim())
        ? String(body.model || "").trim()
        : "";
      const requestedEffort = reasoningEffortOptions.includes(String(body.effort || "").trim())
        ? String(body.effort || "").trim()
        : "";
      const requestedFastMode = requestedCodexFastMode(body.fastMode);
      let result;
      try {
        const dedupeStartedAtMs = Date.now();
        result = await runMessageSubmissionOnce(submissionKeys, uploads, async () => {
          const runtimeStartedAtMs = Date.now();
          const runtimeSettings = applyPermissionModeOverride(await resolveThreadRuntimeSettings(threadId), body.permissionMode, body.cwd || null);
          markSubmitTiming(timings, "runtimeSettingsMs", runtimeStartedAtMs);
          let skipTurnSteer = false;
          if (body.activeTurnId) {
            const preflightStartedAtMs = Date.now();
            const preflightPromise = Promise.resolve()
              .then(() => staleActiveTurnPreflight(codex, threadId, String(body.activeTurnId)))
              .then(
                (result) => ({ ok: true, result }),
                (err) => ({ ok: false, error: err }),
              );
            const preflightFastAcceptMs = Math.max(0, Number(activeTurnPreflightFastAcceptMs) || 0);
            const preflightOutcome = await Promise.race([
              preflightPromise,
              resolveAfter(preflightFastAcceptMs, { pending: true }),
            ]);
            markSubmitTiming(timings, "stalePreflightMs", preflightStartedAtMs);
            if (preflightOutcome && preflightOutcome.pending) {
              timings.stalePreflightQueued = true;
              timings.stalePreflightFastAcceptMs = preflightFastAcceptMs;
              scheduleBackgroundTask(async () => {
                const backgroundStartedAtMs = Date.now();
                const backgroundOutcome = await preflightPromise;
                logMessageSubmit(backgroundOutcome && backgroundOutcome.ok
                  ? "active-turn-stale-preflight-background-done"
                  : "active-turn-stale-preflight-background-error", {
                  threadId,
                  turnId: String(body.activeTurnId),
                  clientSubmissionId: body.clientSubmissionId,
                  stale: Boolean(backgroundOutcome && backgroundOutcome.ok && backgroundOutcome.result && backgroundOutcome.result.stale),
                  reason: backgroundOutcome && backgroundOutcome.ok && backgroundOutcome.result && backgroundOutcome.result.reason || "",
                  error: backgroundOutcome && !backgroundOutcome.ok && backgroundOutcome.error
                    ? backgroundOutcome.error.message || String(backgroundOutcome.error)
                    : "",
                  timings: {
                    stalePreflightBackgroundMs: Math.max(0, Date.now() - backgroundStartedAtMs),
                  },
                });
              });
              logMessageSubmit("active-turn-stale-preflight-queued", {
                threadId,
                turnId: String(body.activeTurnId),
                clientSubmissionId: body.clientSubmissionId,
                timings,
              });
            } else if (preflightOutcome && !preflightOutcome.ok) {
              throw preflightOutcome.error;
            }
            const stalePreflight = preflightOutcome && preflightOutcome.ok
              ? preflightOutcome.result
              : { stale: false, reason: "preflight-queued" };
            if (stalePreflight.stale) {
              skipTurnSteer = true;
              logMessageSubmit("active-turn-stale-preflight", {
                threadId,
                turnId: String(body.activeTurnId),
                clientSubmissionId: body.clientSubmissionId,
                reason: stalePreflight.reason,
                quietMs: stalePreflight.quietMs,
              });
              let interruptStartedAtMs = Date.now();
              try {
                await codex.request("turn/interrupt", {
                  threadId,
                  turnId: String(body.activeTurnId),
                }, { timeoutMs: 20000, retry: false });
                markSubmitTiming(timings, "interruptMs", interruptStartedAtMs);
                await new Promise((resolve) => setTimeout(resolve, 250));
                timings.interruptSettleMs = 250;
              } catch (err) {
                markSubmitTiming(timings, "interruptMs", interruptStartedAtMs);
                logMessageSubmit("active-turn-stale-interrupt-failed", {
                  threadId,
                  turnId: String(body.activeTurnId),
                  clientSubmissionId: body.clientSubmissionId,
                  error: err.message || String(err),
                });
              }
            }
          }
          const resumeThreadBeforeTurnStart = async (targetTimings = timings) => {
            const resumeStartedAtMs = Date.now();
            try {
              await codex.request("thread/resume", applyResumeRuntimeSettings({
                threadId,
                cwd: body.cwd || null,
                persistExtendedHistory,
              }, runtimeSettings), { timeoutMs: mutationRpcTimeoutMs, retry: false });
              markSubmitTimingAliases(targetTimings, ["threadResumeMs", "resumeMs"], resumeStartedAtMs);
            } catch (err) {
              markSubmitTimingAliases(targetTimings, ["threadResumeMs", "resumeMs"], resumeStartedAtMs);
              if (!isThreadResumeAlreadyLoadedError(err)) throw err;
              targetTimings.resumeAlreadyLoaded = true;
            }
          };
          const params = applyCodexFastServiceTier(applyTurnRuntimeSettings({
            threadId,
            input,
          }, runtimeSettings), requestedFastMode);
          if (body.cwd) params.cwd = body.cwd;
          if (requestedModel) params.model = requestedModel;
          if (requestedEffort) params.effort = requestedEffort;
          const startTurn = async (timingNames, targetTimings = timings) => {
            const turnStartStartedAtMs = Date.now();
            try {
              return await codex.request("turn/start", params, { timeoutMs: mutationRpcTimeoutMs, retry: false });
            } finally {
              markSubmitTimingAliases(targetTimings, timingNames, turnStartStartedAtMs);
            }
          };
          const startReplacementTurn = async (targetTimings = timings) => {
            let turnResult;
            const turnStartTotalStartedAtMs = Date.now();
            if (persistExtendedHistory) {
              targetTimings.threadResumeMode = "pre-turn-start";
              await resumeThreadBeforeTurnStart(targetTimings);
              turnResult = await startTurn(["turnStartInitialMs", "turnStartMs"], targetTimings);
            } else {
              targetTimings.threadResumeMode = "optimistic-turn-start";
              targetTimings.threadResumeSkipped = true;
              targetTimings.threadResumeMs = 0;
              targetTimings.resumeMs = 0;
              try {
                turnResult = await startTurn(["turnStartInitialMs", "turnStartMs"], targetTimings);
              } catch (err) {
                if (!turnStartRequiresThreadResume(err)) {
                  targetTimings.turnStartMs = Math.max(0, Date.now() - turnStartTotalStartedAtMs);
                  throw err;
                }
                targetTimings.turnStartResumeFallback = true;
                targetTimings.turnStartResumeFallbackReason = "thread-resume-required";
                targetTimings.threadResumeSkipped = false;
                await resumeThreadBeforeTurnStart(targetTimings);
                turnResult = await startTurn("turnStartRetryMs", targetTimings);
                targetTimings.turnStartMs = Math.max(0, Date.now() - turnStartTotalStartedAtMs);
              }
            }
            const notifyStartedAtMs = Date.now();
            rememberThreadIdForTurnId(threadId, notifyLocalTurnStarted(threadId, turnResult, { source: "message-submit" }));
            markSubmitTimingAliases(targetTimings, ["notifyLocalTurnStartedMs", "notifyMs"], notifyStartedAtMs);
            return turnResult;
          };
          if (body.activeTurnId && !skipTurnSteer) {
            let pendingSteerEchoKey = "";
            const activeTurnId = String(body.activeTurnId);
            const rememberPendingSteerEcho = () => {
              if (pendingSteerEchoKey) return pendingSteerEchoKey;
              pendingSteerEchoKey = pendingSteerEchoStore.remember({
                threadId,
                turnId: activeTurnId,
                input,
                clientSubmissionId: body.clientSubmissionId,
              });
              return pendingSteerEchoKey;
            };
            const notifySteeredUserMessage = () => {
              codex.notifyMuxUserMessage({
                threadId,
                turnId: activeTurnId,
                input,
                clientSubmissionId: body.clientSubmissionId,
              });
            };
            const startSteerRequest = () => {
              rememberPendingSteerEcho();
              const steerStartedAtMs = Date.now();
              return codex.request("turn/steer", {
                threadId,
                input,
                expectedTurnId: activeTurnId,
              }, { timeoutMs: mutationRpcTimeoutMs, retry: false })
                .then((steerResult) => ({
                  ok: true,
                  result: steerResult,
                  elapsedMs: Math.max(0, Date.now() - steerStartedAtMs),
                }))
                .catch((err) => ({
                  ok: false,
                  error: err,
                  elapsedMs: Math.max(0, Date.now() - steerStartedAtMs),
                }));
            };
            const handleSteerOutcome = async (outcome, options = {}) => {
              const background = options.background === true;
              const targetTimings = options.timings || timings;
              targetTimings.steerMs = Math.max(0, Number(outcome && outcome.elapsedMs) || 0);
              if (outcome && outcome.ok) {
                notifySteeredUserMessage();
                if (background) {
                  targetTimings.totalMs = targetTimings.steerMs;
                  logMessageSubmit("steer-background-done", {
                    threadId,
                    turnId: activeTurnId,
                    clientSubmissionId: body.clientSubmissionId,
                    timings: targetTimings,
                  });
                }
                return { handled: true, result: outcome.result || {} };
              }
              const err = outcome && outcome.error;
              if (isTurnSteerUnsupportedError(err)) {
                notifySteeredUserMessage();
                if (background) {
                  logMessageSubmit("steer-background-unsupported", {
                    threadId,
                    turnId: activeTurnId,
                    clientSubmissionId: body.clientSubmissionId,
                    timings: targetTimings,
                  });
                }
                return { handled: true, result: {} };
              }
              if (!isStaleActiveTurnError(err)) throw err;
              if (!background && pendingSteerEchoKey) pendingSteerEchoStore.forget(pendingSteerEchoKey);
              logMessageSubmit(background ? "active-turn-stale-background" : "active-turn-stale", {
                threadId,
                turnId: activeTurnId,
                clientSubmissionId: body.clientSubmissionId,
                error: err.message || String(err),
                timings: targetTimings,
              });
              return { handled: false, error: err };
            };
            const steerPromise = startSteerRequest();
            const fastAcceptMs = Math.max(0, Number(activeTurnSteerFastAcceptMs) || 0);
            const firstSteerOutcome = await Promise.race([
              steerPromise,
              resolveAfter(fastAcceptMs, { pending: true }),
            ]);
            if (firstSteerOutcome && firstSteerOutcome.pending) {
              timings.steerQueued = true;
              timings.steerFastAcceptMs = Math.max(0, Date.now() - routeStartedAtMs);
              timings.steerMs = Math.max(0, Number(fastAcceptMs) || 0);
              scheduleBackgroundTask(async () => {
                const backgroundTimings = {};
                try {
                  const backgroundOutcome = await steerPromise;
                  const handled = await handleSteerOutcome(backgroundOutcome, {
                    background: true,
                    timings: backgroundTimings,
                  });
                  if (!handled.handled) {
                    backgroundTimings.staleFallback = true;
                    const fallbackStartedAtMs = Date.now();
                    const fallbackResult = await startReplacementTurn(backgroundTimings);
                    backgroundTimings.staleFallbackMs = Math.max(0, Date.now() - fallbackStartedAtMs);
                    backgroundTimings.totalMs = Number(backgroundTimings.steerMs || 0)
                      + Number(backgroundTimings.staleFallbackMs || 0);
                    logMessageSubmit("steer-background-stale-fallback-done", {
                      threadId,
                      staleTurnId: activeTurnId,
                      clientSubmissionId: body.clientSubmissionId,
                      resultTurnId: fallbackResult && (fallbackResult.turnId || fallbackResult.id || fallbackResult.turn && fallbackResult.turn.id || ""),
                      timings: backgroundTimings,
                    });
                  }
                } catch (err) {
                  if (pendingSteerEchoKey) pendingSteerEchoStore.forget(pendingSteerEchoKey);
                  logMessageSubmit("steer-background-failed", {
                    threadId,
                    turnId: activeTurnId,
                    clientSubmissionId: body.clientSubmissionId,
                    error: err.message || String(err),
                    timings: backgroundTimings,
                  });
                }
              });
              logMessageSubmit("steer-queued", {
                threadId,
                turnId: activeTurnId,
                clientSubmissionId: body.clientSubmissionId,
                timings,
              });
              return {
                ok: true,
                turnId: activeTurnId,
                activeTurnId,
                steeringQueued: true,
              };
            }
            const handledSteer = await handleSteerOutcome(firstSteerOutcome);
            if (handledSteer.handled) {
              return handledSteer.result;
            }
          }
          return await startReplacementTurn(timings);
        });
        markSubmitTiming(timings, "dedupeWaitMs", dedupeStartedAtMs);
        timings.totalMs = Math.max(0, Date.now() - routeStartedAtMs);
        if (secretContext) {
          result = Object.assign({}, result || {}, {
            sensitiveContext: publicSensitiveContext(secretContext),
          });
        }
        timedSendJson(200, result);
        logMessageSubmit("done", {
          threadId,
          clientSubmissionId: body.clientSubmissionId,
          resultTurnId: result && (result.turnId || result.id || result.turn && result.turn.id || ""),
          timings,
        });
      } catch (err) {
        timings.totalMs = Math.max(0, Date.now() - routeStartedAtMs);
        logMessageSubmit("failed", {
          threadId,
          clientSubmissionId: body.clientSubmissionId,
          error: err.message || String(err),
          timings,
        });
        if (isCodexAccountAuthError(err)) {
          timedSendJson(409, codexAccountAuthErrorPayload(err));
          return { handled: true };
        }
        throw err;
      }
      return { handled: true };
    }

    const interrupt = url.pathname.match(/^\/api\/threads\/([^/]+)\/turns\/([^/]+)\/interrupt$/);
    if (interrupt && method === "POST") {
      sendJson(200, await codex.request("turn/interrupt", {
        threadId: decodeURIComponent(interrupt[1]),
        turnId: decodeURIComponent(interrupt[2]),
      }, { timeoutMs: 20000, retry: false }));
      return { handled: true };
    }

    return { handled: false };
  }

  return { handleRoute };
}

module.exports = {
  createThreadMessageRouteService,
  isThreadResumeAlreadyLoadedError,
  turnStartRequiresThreadResume,
};
