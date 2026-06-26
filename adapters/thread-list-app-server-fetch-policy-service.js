"use strict";

function boundedLimit(value, fallback = 80) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.min(200, Math.trunc(number)));
}

function compactLabel(value, fallback = "", maxLength = 80) {
  return String(value || fallback || "").trim().slice(0, maxLength);
}

function booleanFlag(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  const text = String(value).trim();
  if (!text || /^(0|false|no|off)$/i.test(text)) return false;
  return true;
}

function boundedOverfetchLimit(requestedLimit, multiplier = 2, floor = 80, ceiling = 500) {
  const limit = boundedLimit(requestedLimit);
  const raw = Math.max(limit * multiplier, floor);
  return Math.max(limit, Math.min(ceiling, Math.trunc(raw)));
}

function planThreadListAppServerFetch(input = {}) {
  const requestedLimit = boundedLimit(input.limit);
  const hasCursor = booleanFlag(input.cursor);
  const hasWorkspace = booleanFlag(input.cwd || input.workspace || input.hasWorkspace);
  const hasSearch = booleanFlag(input.searchTerm || input.search || input.hasSearch);
  const archived = input.archived === true;

  if (hasCursor) {
    return {
      requestedLimit,
      appServerLimit: requestedLimit,
      reason: "cursor-page",
      overfetchFactor: 1,
      cursor: true,
      archived,
      hasWorkspace,
      hasSearch,
    };
  }

  if (hasWorkspace) {
    const appServerLimit = Math.max(requestedLimit, 500);
    return {
      requestedLimit,
      appServerLimit,
      reason: "workspace-filter-preserve-overfetch",
      overfetchFactor: appServerLimit / requestedLimit,
      cursor: false,
      archived,
      hasWorkspace,
      hasSearch,
    };
  }

  if (archived) {
    const appServerLimit = Math.max(requestedLimit, 500);
    return {
      requestedLimit,
      appServerLimit,
      reason: "archived-preserve-overfetch",
      overfetchFactor: appServerLimit / requestedLimit,
      cursor: false,
      archived,
      hasWorkspace,
      hasSearch,
    };
  }

  if (hasSearch) {
    const appServerLimit = boundedOverfetchLimit(requestedLimit, 2, 80, 500);
    return {
      requestedLimit,
      appServerLimit,
      reason: "search-bounded-overfetch",
      overfetchFactor: appServerLimit / requestedLimit,
      cursor: false,
      archived,
      hasWorkspace,
      hasSearch,
    };
  }

  const appServerLimit = boundedOverfetchLimit(requestedLimit, 2, 80, 500);
  return {
    requestedLimit,
    appServerLimit,
    reason: "default-bounded-overfetch",
    overfetchFactor: appServerLimit / requestedLimit,
    cursor: false,
    archived,
    hasWorkspace,
    hasSearch,
  };
}

function threadListAppServerFetchTimingFields(plan = {}) {
  const safePlan = plan && typeof plan === "object" ? plan : {};
  return {
    appServerRequestedLimit: boundedLimit(safePlan.requestedLimit),
    appServerRequestLimit: Math.max(1, Math.min(500, Math.trunc(Number(safePlan.appServerLimit || 0) || 0))),
    appServerRequestReason: compactLabel(safePlan.reason, "unknown", 80),
    appServerOverfetchFactor: Number.isFinite(Number(safePlan.overfetchFactor))
      ? Math.max(1, Math.min(500, Number(safePlan.overfetchFactor)))
      : 1,
  };
}

module.exports = {
  planThreadListAppServerFetch,
  threadListAppServerFetchTimingFields,
};
