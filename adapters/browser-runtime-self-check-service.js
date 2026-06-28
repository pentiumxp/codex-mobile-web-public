"use strict";

const crypto = require("node:crypto");

function stableTextHash(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function safeLabel(value, fallback = "unknown") {
  const text = String(value || "").trim();
  return text.replace(/[^a-z0-9_.:-]+/gi, "_").slice(0, 80) || fallback;
}

function safeRouteLabel(value, fallback = "route") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  try {
    const parsed = new URL(text, "http://local.invalid");
    return safeLabel(parsed.pathname || fallback, fallback);
  } catch (_) {
    return safeLabel(text.split("?")[0].split("#")[0], fallback);
  }
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isSparseSample(sample = {}) {
  return toNumber(sample.turns) <= 1 && toNumber(sample.items) <= 3;
}

function isNonEmptySample(sample = {}) {
  return toNumber(sample.turns) > 1 || toNumber(sample.items) > 3;
}

function sampleIsConfirmed(sample = {}) {
  if (sample.confirmed === false || sample.targetConfirmed === false) return false;
  return true;
}

function summarizeSamples(samples = []) {
  const normalized = toArray(samples);
  const turnCounts = normalized.map((sample) => toNumber(sample.turns));
  const itemCounts = normalized.map((sample) => toNumber(sample.items));
  const renderKeyCounts = normalized.map((sample) => toNumber(sample.renderKeys));
  return {
    sampleCount: normalized.length,
    minTurns: normalized.length ? Math.min(...turnCounts) : 0,
    maxTurns: normalized.length ? Math.max(...turnCounts) : 0,
    minItems: normalized.length ? Math.min(...itemCounts) : 0,
    maxItems: normalized.length ? Math.max(...itemCounts) : 0,
    maxRenderKeys: normalized.length ? Math.max(...renderKeyCounts) : 0,
    sparseSampleCount: normalized.filter(isSparseSample).length,
    nonEmptySampleCount: normalized.filter(isNonEmptySample).length,
  };
}

function sampleThreadHash(sample = {}) {
  return String(sample.threadHash || "").slice(0, 32);
}

function issue(severity, code, sample = {}, details = {}) {
  const item = Object.assign({
    severity,
    code,
    surface: "browser-runtime",
  }, details);
  if (sample.label) item.sample = safeLabel(sample.label);
  if (sample.threadHash) item.threadHash = sampleThreadHash(sample);
  if (sample.delayMs !== undefined) item.delayMs = Math.max(0, Math.trunc(toNumber(sample.delayMs)));
  return item;
}

function analyzeBrowserRuntimeSamples(input = {}) {
  const samples = toArray(input.samples);
  const networkEvents = toArray(input.networkEvents);
  const consoleEvents = toArray(input.consoleEvents);
  const exceptions = toArray(input.exceptions);
  const minSettledDelayMs = Math.max(0, Math.trunc(toNumber(input.minSettledDelayMs, 1000)));
  const issues = [];
  const samplesByThread = new Map();

  for (const sample of samples) {
    if (!sample || typeof sample !== "object") continue;
    if (!sample.appVisible) issues.push(issue("H2", "browser_app_not_visible", sample));
    if (sample.loginVisible) issues.push(issue("H2", "browser_login_visible", sample));
    if (toNumber(sample.duplicateRenderKeys) > 0) {
      issues.push(issue("H2", "browser_duplicate_render_keys", sample, {
        duplicateRenderKeys: toNumber(sample.duplicateRenderKeys),
      }));
    }
    if (toNumber(sample.duplicateItemIds) > 0) {
      issues.push(issue("H2", "browser_duplicate_item_ids", sample, {
        duplicateItemIds: toNumber(sample.duplicateItemIds),
      }));
    }
    const hash = sampleThreadHash(sample);
    if (!hash || !sampleIsConfirmed(sample)) continue;
    if (!samplesByThread.has(hash)) samplesByThread.set(hash, []);
    samplesByThread.get(hash).push(sample);
  }

  for (const [threadHash, rows] of samplesByThread.entries()) {
    let seenNonEmpty = false;
    let maxItems = 0;
    let maxTurns = 0;
    let maxConfirmedItems = 0;
    let maxConfirmedTurns = 0;
    for (const sample of rows) {
      const turns = toNumber(sample.turns);
      const items = toNumber(sample.items);
      maxTurns = Math.max(maxTurns, turns);
      maxItems = Math.max(maxItems, items);
      if (isNonEmptySample(sample)) {
        if (sample.contentConfirmed !== false) {
          seenNonEmpty = true;
          maxConfirmedTurns = Math.max(maxConfirmedTurns, turns);
          maxConfirmedItems = Math.max(maxConfirmedItems, items);
        }
      }
      else if (seenNonEmpty && isSparseSample(sample)) {
        const settled = toNumber(sample.delayMs) >= minSettledDelayMs;
        issues.push(issue(settled ? "H2" : "H3", "browser_dom_sparse_after_nonempty", sample, {
          threadHash,
          previousMaxTurns: maxConfirmedTurns,
          previousMaxItems: maxConfirmedItems,
          loadingNote: Boolean(sample.loadingNote),
          emptyState: Boolean(sample.emptyState),
          settled,
        }));
      }
    }
    const final = rows[rows.length - 1];
    if (final && seenNonEmpty && isSparseSample(final) && maxConfirmedItems > 3 && toNumber(final.delayMs) >= minSettledDelayMs) {
      issues.push(issue("H2", "browser_dom_final_sparse_after_nonempty", final, {
        threadHash,
        previousMaxTurns: maxConfirmedTurns,
        previousMaxItems: maxConfirmedItems,
        loadingNote: Boolean(final.loadingNote),
        emptyState: Boolean(final.emptyState),
      }));
    }
  }

  if (exceptions.length) {
    issues.push({
      severity: "H2",
      code: "browser_runtime_exception",
      surface: "browser-runtime",
      count: exceptions.length,
    });
  }
  if (consoleEvents.filter((entry) => entry && entry.type === "error").length) {
    issues.push({
      severity: "H3",
      code: "browser_console_error",
      surface: "browser-runtime",
      count: consoleEvents.filter((entry) => entry && entry.type === "error").length,
    });
  }

  const routeStatusCounts = {};
  for (const event of networkEvents) {
    const route = safeRouteLabel(event && event.route, "route");
    const status = Math.max(0, Math.trunc(toNumber(event && event.status)));
    const key = `${route}:${status}`;
    routeStatusCounts[key] = (routeStatusCounts[key] || 0) + 1;
  }

  const summary = summarizeSamples(samples);
  const blockingIssueCount = issues.filter((item) => item && /^(H1|H2)$/i.test(item.severity || "")).length;
  return {
    ok: blockingIssueCount === 0,
    issueCount: issues.length,
    blockingIssueCount,
    issues,
    sampleSummary: summary,
    routeStatusCounts,
    networkEventCount: networkEvents.length,
    consoleWarningOrErrorCount: consoleEvents.length,
    exceptionCount: exceptions.length,
  };
}

function safeThreadRows(rows = [], limit = 3) {
  return toArray(rows)
    .map((row) => {
      const id = String(row && (row.id || row.threadId || row.thread_id) || "").trim();
      return id ? { threadHash: stableTextHash(id) } : null;
    })
    .filter(Boolean)
    .slice(0, Math.max(1, Math.trunc(toNumber(limit, 3))));
}

module.exports = {
  analyzeBrowserRuntimeSamples,
  isNonEmptySample,
  isSparseSample,
  safeLabel,
  safeThreadRows,
  stableTextHash,
  summarizeSamples,
};
