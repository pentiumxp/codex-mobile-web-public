"use strict";

function summaryTitle(summary) {
  return summary && (summary.name || summary.preview || "") || "";
}

function summaryStatus(summary) {
  return summary && summary.status ? summary.status.type || summary.status : null;
}

function boundedRefreshTtlMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(60 * 60 * 1000, Math.trunc(number)));
}

function createThreadDetailSummaryService(options = {}) {
  const readStateDbThread = typeof options.readStateDbThread === "function" ? options.readStateDbThread : () => null;
  const readStartedThread = typeof options.readStartedThread === "function" ? options.readStartedThread : () => null;
  const readRolloutSessionFallbackThread = typeof options.readRolloutSessionFallbackThread === "function"
    ? options.readRolloutSessionFallbackThread
    : () => null;
  const readDisplaySummaryThread = typeof options.readDisplaySummaryThread === "function"
    ? options.readDisplaySummaryThread
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
  const appServerRefreshTtlMs = boundedRefreshTtlMs(options.appServerRefreshTtlMs);
  const skipAppServerRefreshWhenDisplayCachePresent = options.skipAppServerRefreshWhenDisplayCachePresent === true;
  const refreshStateByThreadId = new Map();

  function recordAppServerRefresh(threadId, status, refreshedAtMs = now()) {
    const id = String(threadId || "").trim();
    if (!id) return;
    refreshStateByThreadId.set(id, {
      refreshedAtMs,
      status: String(status || "unknown"),
    });
    if (refreshStateByThreadId.size > 1000) {
      const oldestKey = refreshStateByThreadId.keys().next().value;
      if (oldestKey) refreshStateByThreadId.delete(oldestKey);
    }
  }

  function appServerRefreshAgeMs(threadId, nowMs = now()) {
    const state = refreshStateByThreadId.get(String(threadId || "").trim());
    const refreshedAtMs = Number(state && state.refreshedAtMs || 0);
    return refreshedAtMs ? Math.max(0, nowMs - refreshedAtMs) : Number.POSITIVE_INFINITY;
  }

  function shouldSkipExistingSummaryRefresh(threadId, details = {}) {
    if (!threadId || !details.summary) return { skip: false, reason: "" };
    if (details.hadDisplayCache && skipAppServerRefreshWhenDisplayCachePresent) {
      return { skip: true, reason: "display-cache" };
    }
    if (appServerRefreshTtlMs > 0) {
      const ageMs = appServerRefreshAgeMs(threadId, details.nowMs);
      if (Number.isFinite(ageMs) && ageMs <= appServerRefreshTtlMs) {
        return { skip: true, reason: "recent-app-server-refresh", ageMs };
      }
    }
    return { skip: false, reason: "" };
  }

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
    const displaySummary = readDisplaySummaryThread(threadId);
    const hadDisplayCache = Boolean(displaySummary);
    if (!summary && displaySummary) {
      summary = displaySummary;
      source = "display-cache";
      if (threadLog) threadLog("summary_display_cache_hit", { found: true });
    } else if (summary && displaySummary) {
      const merged = mergeThreadDisplaySummary(summary, displaySummary);
      if (merged) {
        summary = merged;
        source = `${source}+display-cache`;
      }
      if (threadLog) threadLog("summary_display_cache_merge", { found: true });
    }
    if (!summary) {
      const startedAtMs = now();
      if (threadLog) threadLog("summary_app_server_start");
      try {
        summary = await readThreadSummaryFromAppServer(codex, threadId);
        source = summary ? "app-server" : "none";
        recordAppServerRefresh(threadId, summary ? "found" : "missing");
        if (threadLog) {
          threadLog("summary_app_server_ok", {
            durationMs: now() - startedAtMs,
            found: Boolean(summary),
          });
        }
      } catch (err) {
        recordAppServerRefresh(threadId, "error");
        if (threadLog) {
          threadLog("summary_app_server_error", {
            durationMs: now() - startedAtMs,
            error: err.message || String(err),
          });
        }
      }
    } else {
      const refreshDecision = shouldSkipExistingSummaryRefresh(threadId, {
        summary,
        hadDisplayCache,
        nowMs: now(),
      });
      if (refreshDecision.skip) {
        if (threadLog) {
          threadLog("summary_app_server_refresh_skipped", {
            reason: refreshDecision.reason,
            baseSource: source,
            ageMs: Number.isFinite(refreshDecision.ageMs) ? refreshDecision.ageMs : 0,
          });
        }
      } else {
        const startedAtMs = now();
        if (threadLog) threadLog("summary_app_server_refresh_start", { baseSource: source });
        try {
          const appServerSummary = await readThreadSummaryFromAppServer(codex, threadId);
          recordAppServerRefresh(threadId, appServerSummary ? "found" : "missing");
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
          recordAppServerRefresh(threadId, "error");
          if (threadLog) {
            threadLog("summary_app_server_refresh_error", {
              durationMs: now() - startedAtMs,
              error: err.message || String(err),
            });
          }
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
  boundedRefreshTtlMs,
  createThreadDetailSummaryService,
  summaryStatus,
  summaryTitle,
};
