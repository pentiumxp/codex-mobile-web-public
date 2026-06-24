"use strict";

function summaryTitle(summary) {
  return summary && (summary.name || summary.preview || "") || "";
}

function summaryStatus(summary) {
  return summary && summary.status ? summary.status.type || summary.status : null;
}

function createThreadDetailSummaryService(options = {}) {
  const readStateDbThread = typeof options.readStateDbThread === "function" ? options.readStateDbThread : () => null;
  const readStartedThread = typeof options.readStartedThread === "function" ? options.readStartedThread : () => null;
  const readRolloutSessionFallbackThread = typeof options.readRolloutSessionFallbackThread === "function"
    ? options.readRolloutSessionFallbackThread
    : () => null;
  const readThreadSummaryFromAppServer = typeof options.readThreadSummaryFromAppServer === "function"
    ? options.readThreadSummaryFromAppServer
    : async () => null;
  const mergeThreadDisplaySummary = typeof options.mergeThreadDisplaySummary === "function"
    ? options.mergeThreadDisplaySummary
    : (base, display) => display || base;
  const applyLocalActiveThreadStatusToSummary = typeof options.applyLocalActiveThreadStatusToSummary === "function"
    ? options.applyLocalActiveThreadStatusToSummary
    : (summary) => summary;
  const threadRolloutSizeBytes = typeof options.threadRolloutSizeBytes === "function"
    ? options.threadRolloutSizeBytes
    : () => null;
  const now = typeof options.now === "function" ? options.now : Date.now;

  async function resolveSummary(codex, threadId, resolveOptions = {}) {
    const threadLog = typeof resolveOptions.threadLog === "function" ? resolveOptions.threadLog : null;
    let summary = readStateDbThread(threadId);
    let source = summary ? "state-db" : "none";
    if (!summary) {
      summary = readStartedThread(threadId);
      source = summary ? "started-cache" : "none";
    }
    if (!summary) {
      summary = readRolloutSessionFallbackThread(threadId);
      source = summary ? "rollout-session" : "none";
    }
    if (!summary) {
      const startedAtMs = now();
      if (threadLog) threadLog("summary_app_server_start");
      try {
        summary = await readThreadSummaryFromAppServer(codex, threadId);
        source = summary ? "app-server" : "none";
        if (threadLog) {
          threadLog("summary_app_server_ok", {
            durationMs: now() - startedAtMs,
            found: Boolean(summary),
          });
        }
      } catch (err) {
        if (threadLog) {
          threadLog("summary_app_server_error", {
            durationMs: now() - startedAtMs,
            error: err.message || String(err),
          });
        }
      }
    } else {
      const startedAtMs = now();
      if (threadLog) threadLog("summary_app_server_refresh_start", { baseSource: source });
      try {
        const appServerSummary = await readThreadSummaryFromAppServer(codex, threadId);
        if (appServerSummary) {
          summary = mergeThreadDisplaySummary(summary, appServerSummary);
          source = `${source}+app-server`;
        }
        if (threadLog) {
          threadLog("summary_app_server_refresh_ok", {
            durationMs: now() - startedAtMs,
            found: Boolean(appServerSummary),
          });
        }
      } catch (err) {
        if (threadLog) {
          threadLog("summary_app_server_refresh_error", {
            durationMs: now() - startedAtMs,
            error: err.message || String(err),
          });
        }
      }
    }
    summary = applyLocalActiveThreadStatusToSummary(summary, { threadId });
    if (threadLog) {
      threadLog("summary_ready", {
        source,
        title: summaryTitle(summary),
        rolloutSizeBytes: summary ? threadRolloutSizeBytes(summary) : null,
        status: summaryStatus(summary),
      });
    }
    return { summary, source };
  }

  return {
    resolveSummary,
  };
}

module.exports = {
  createThreadDetailSummaryService,
  summaryStatus,
  summaryTitle,
};
