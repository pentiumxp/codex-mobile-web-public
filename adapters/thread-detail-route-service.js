"use strict";

function text(value) {
  return String(value || "").trim();
}

function detailModeFromUrl(url) {
  return text(url && url.searchParams && url.searchParams.get("mode")).toLowerCase();
}

function responseBudgetEvidenceFromUrl(url) {
  const value = text(url && url.searchParams && (
    url.searchParams.get("budget")
    || url.searchParams.get("responseBudget")
    || url.searchParams.get("responseBudgetEvidence")
  )).toLowerCase();
  return value === "full" || value === "verbose" ? "full" : "compact";
}

async function handleThreadDetailReadRoute(input = {}) {
  const threadId = text(input.threadId);
  const url = input.url || null;
  const codex = input.codex || null;
  const readThreadDetail = typeof input.readThreadDetail === "function" ? input.readThreadDetail : null;
  const sendJson = typeof input.sendJson === "function" ? input.sendJson : null;
  const logThreadDetail = typeof input.logThreadDetail === "function" ? input.logThreadDetail : () => {};
  const onThreadDetailReadResult = typeof input.onThreadDetailReadResult === "function" ? input.onThreadDetailReadResult : null;
  const schedulePostReadResult = typeof input.schedulePostReadResult === "function"
    ? input.schedulePostReadResult
    : (callback) => {
        if (typeof setImmediate === "function") return setImmediate(callback);
        return setTimeout(callback, 0);
      };
  const now = typeof input.now === "function" ? input.now : () => Date.now();
  const requestStartedAtMs = Number(input.requestStartedAtMs || now());
  if (!threadId || !readThreadDetail || !sendJson) return { handled: false, reason: "invalid-route-input" };

  const preferRecentTurns = detailModeFromUrl(url) === "recent";
  const responseBudgetEvidence = responseBudgetEvidenceFromUrl(url);
  const threadLog = (event, details = {}) => logThreadDetail(event, Object.assign({
    threadId,
    elapsedMs: Math.max(0, now() - requestStartedAtMs),
  }, details));
  const detailResponse = await readThreadDetail({
    codex,
    threadId,
    preferRecentTurns,
    responseBudgetEvidence,
    threadLog,
  });
  const status = detailResponse && detailResponse.status || 200;
  const body = detailResponse && detailResponse.body || {};
  sendJson(status, body);
  if (onThreadDetailReadResult) {
    schedulePostReadResult(() => {
      Promise.resolve()
        .then(() => onThreadDetailReadResult({
          threadId,
          status,
          body,
          mode: detailResponse && detailResponse.mode || "",
          complete: !detailResponse || detailResponse.complete !== false,
        }))
        .catch((err) => {
          threadLog("post_read_result_sync_failed", {
            error: String(err && err.message || err).slice(0, 160),
          });
        });
    });
  }
  if (!detailResponse || detailResponse.complete !== false) {
    threadLog("complete", {
      status,
      mode: detailResponse && detailResponse.mode || "unknown",
    });
  }
  return {
    handled: true,
    status,
    mode: detailResponse && detailResponse.mode || "",
    complete: !detailResponse || detailResponse.complete !== false,
  };
}

module.exports = {
  handleThreadDetailReadRoute,
};
