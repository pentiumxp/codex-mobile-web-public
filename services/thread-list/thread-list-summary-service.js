"use strict";

const THREAD_DETAIL_ONLY_SUMMARY_FIELDS = Object.freeze([
  "turns",
  "runtimeSettings",
  "threadTaskCards",
  "pendingServerRequests",
  "mobileDetailLoaded",
  "mobileLoading",
  "mobileLoadError",
  "mobileReadWarning",
  "mobileReadMode",
  "mobileDiagnostics",
  "mobileProjection",
  "mobileProjectionVersion",
  "mobileProjectionRevision",
  "mobileVisibleItemKeys",
  "mobileOlderTurnsCursor",
  "mobileNewerTurnsCursor",
  "mobileHistoryExpanded",
  "mobileInitialSubmissionId",
  "mobileSubmittedAtMs",
  "mobilePendingSubmission",
  "mobileActiveOverlay",
  "mobileActiveOverlayBackfill",
]);

function stripThreadListDetailFields(thread) {
  if (!thread || typeof thread !== "object") return thread;
  const summary = Object.assign({}, thread);
  for (const field of THREAD_DETAIL_ONLY_SUMMARY_FIELDS) {
    delete summary[field];
  }
  return summary;
}

function stripThreadListResultDetailFields(result) {
  if (!result || typeof result !== "object") return result;
  const next = Object.assign({}, result);
  if (Array.isArray(next.data)) next.data = next.data.map(stripThreadListDetailFields);
  if (Array.isArray(next.threads)) next.threads = next.threads.map(stripThreadListDetailFields);
  return next;
}

module.exports = {
  THREAD_DETAIL_ONLY_SUMMARY_FIELDS,
  stripThreadListDetailFields,
  stripThreadListResultDetailFields,
};
