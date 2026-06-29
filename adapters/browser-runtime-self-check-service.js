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
  const imageFailureCounts = normalized.map((sample) => toNumber(sample.imageFailureCount));
  const timestampMissingCounts = normalized.map((sample) => toNumber(sample.latestTimestampMissingItems));
  const latestTurnItemCounts = normalized.map((sample) => toNumber(sample.latestTurnItemCount));
  const latestTurnUserMessageCounts = normalized.map((sample) => toNumber(sample.latestTurnUserMessageCount));
  const latestTurnTaskCardItemCounts = normalized.map((sample) => toNumber(sample.latestTurnTaskCardItemCount));
  const latestTurnAssistantMessageCounts = normalized.map((sample) => toNumber(sample.latestTurnAssistantMessageCount));
  const actualLatestTurnUserMessageCounts = normalized.map((sample) => toNumber(sample.actualLatestTurnUserMessageCount));
  const actualLatestTurnTaskCardItemCounts = normalized.map((sample) => toNumber(sample.actualLatestTurnTaskCardItemCount));
  const actualLatestTurnAssistantMessageCounts = normalized.map((sample) => toNumber(sample.actualLatestTurnAssistantMessageCount));
  const latestTurnOperationItemCounts = normalized.map((sample) => toNumber(sample.latestTurnOperationItemCount));
  const latestTurnReasoningItemCounts = normalized.map((sample) => toNumber(sample.latestTurnReasoningItemCount));
  const latestTurnAssistantTextDuplicateCounts = normalized.map((sample) => toNumber(sample.latestTurnAssistantTextDuplicateCount));
  const clientSubmissionCounts = normalized.map((sample) => toNumber(sample.clientSubmissionCount));
  const visualAnchorShiftCounts = normalized.map((sample) => toNumber(sample.visualAnchorSmallJitterCount));
  const visualAnchorShiftPixels = normalized.map((sample) => toNumber(sample.visualAnchorShiftPx));
  const submittedMessageShiftCounts = normalized.map((sample) => toNumber(sample.submittedMessageSmallJitterCount));
  const submittedMessageShiftPixels = normalized.map((sample) => toNumber(sample.submittedMessageShiftPx));
  return {
    sampleCount: normalized.length,
    minTurns: normalized.length ? Math.min(...turnCounts) : 0,
    maxTurns: normalized.length ? Math.max(...turnCounts) : 0,
    minItems: normalized.length ? Math.min(...itemCounts) : 0,
    maxItems: normalized.length ? Math.max(...itemCounts) : 0,
    maxRenderKeys: normalized.length ? Math.max(...renderKeyCounts) : 0,
    maxImageFailures: normalized.length ? Math.max(...imageFailureCounts) : 0,
    maxLatestTimestampMissingItems: normalized.length ? Math.max(...timestampMissingCounts) : 0,
    maxLatestTurnItems: normalized.length ? Math.max(...latestTurnItemCounts) : 0,
    maxLatestTurnUserMessages: normalized.length ? Math.max(...latestTurnUserMessageCounts) : 0,
    maxLatestTurnTaskCardItems: normalized.length ? Math.max(...latestTurnTaskCardItemCounts) : 0,
    maxLatestTurnAssistantMessages: normalized.length ? Math.max(...latestTurnAssistantMessageCounts) : 0,
    maxActualLatestTurnUserMessages: normalized.length ? Math.max(...actualLatestTurnUserMessageCounts) : 0,
    maxActualLatestTurnTaskCardItems: normalized.length ? Math.max(...actualLatestTurnTaskCardItemCounts) : 0,
    maxActualLatestTurnAssistantMessages: normalized.length ? Math.max(...actualLatestTurnAssistantMessageCounts) : 0,
    maxLatestTurnOperationItems: normalized.length ? Math.max(...latestTurnOperationItemCounts) : 0,
    maxLatestTurnReasoningItems: normalized.length ? Math.max(...latestTurnReasoningItemCounts) : 0,
    maxLatestTurnAssistantTextDuplicates: normalized.length ? Math.max(...latestTurnAssistantTextDuplicateCounts) : 0,
    maxClientSubmissions: normalized.length ? Math.max(...clientSubmissionCounts) : 0,
    maxVisualAnchorSmallJitterCount: normalized.length ? Math.max(...visualAnchorShiftCounts) : 0,
    maxVisualAnchorShiftPx: normalized.length ? Math.max(...visualAnchorShiftPixels) : 0,
    maxSubmittedMessageSmallJitterCount: normalized.length ? Math.max(...submittedMessageShiftCounts) : 0,
    maxSubmittedMessageShiftPx: normalized.length ? Math.max(...submittedMessageShiftPixels) : 0,
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
    if (sampleIsConfirmed(sample) && toNumber(sample.imageFailureCount) > 0) {
      issues.push(issue("H2", "browser_image_render_failed", sample, {
        imageCount: toNumber(sample.imageCount),
        imageFailureCount: toNumber(sample.imageFailureCount),
        failedFigureCount: toNumber(sample.imageFailedFigureCount),
        brokenCompleteImageCount: toNumber(sample.brokenCompleteImageCount),
      }));
    }
    if (sampleIsConfirmed(sample)
      && sample.latestTurnMatchesTarget
      && toNumber(sample.latestTimestampMissingItems) > 0) {
      issues.push(issue("H2", "browser_latest_turn_timestamp_missing", sample, {
        latestTimestampExpectedItems: toNumber(sample.latestTimestampExpectedItems),
        latestTimestampMissingItems: toNumber(sample.latestTimestampMissingItems),
      }));
    }
    if (sampleIsConfirmed(sample)
      && sample.latestTurnMatchesTarget
      && toNumber(sample.latestTurnAssistantTextDuplicateCount) > 0) {
      issues.push(issue("H2", "browser_latest_turn_assistant_text_duplicate", sample, {
        latestTurnAssistantMessageCount: toNumber(sample.latestTurnAssistantMessageCount),
        latestTurnAssistantTextDuplicateCount: toNumber(sample.latestTurnAssistantTextDuplicateCount),
      }));
    }
    if (sampleIsConfirmed(sample)
      && sample.latestTurnMatchesTarget
      && toNumber(sample.latestTurnOperationItemCount) > 0) {
      issues.push(issue("H2", "browser_latest_turn_operation_items_visible", sample, {
        latestTurnOperationItemCount: toNumber(sample.latestTurnOperationItemCount),
      }));
    }
    if (sampleIsConfirmed(sample)
      && sample.latestTurnMatchesTarget
      && toNumber(sample.latestTurnReasoningItemCount) > 0) {
      issues.push(issue("H2", "browser_latest_turn_reasoning_items_visible", sample, {
        latestTurnReasoningItemCount: toNumber(sample.latestTurnReasoningItemCount),
      }));
    }
    if (sampleIsConfirmed(sample)
      && sample.latestTurnMatchesTarget
      && toNumber(sample.expectedLatestUserMessageCount) > 0
      && toNumber(sample.latestTurnUserMessageCount) < toNumber(sample.expectedLatestUserMessageCount)) {
      issues.push(issue("H2", "browser_latest_turn_user_message_below_api_expectation", sample, {
        expectedLatestUserMessageCount: toNumber(sample.expectedLatestUserMessageCount),
        latestTurnUserMessageCount: toNumber(sample.latestTurnUserMessageCount),
      }));
    }
    if (sampleIsConfirmed(sample)
      && sample.latestTurnMatchesTarget
      && toNumber(sample.expectedLatestTaskCardUserMessageCount) > 0
      && toNumber(sample.latestTurnTaskCardItemCount) < toNumber(sample.expectedLatestTaskCardUserMessageCount)) {
      issues.push(issue("H2", "browser_latest_turn_task_card_below_api_expectation", sample, {
        expectedLatestTaskCardUserMessageCount: toNumber(sample.expectedLatestTaskCardUserMessageCount),
        latestTurnTaskCardItemCount: toNumber(sample.latestTurnTaskCardItemCount),
      }));
    }
    if (sampleIsConfirmed(sample)
      && sample.expectedLatestUsageRequired
      && sample.latestTurnMatchesTarget
      && toNumber(sample.latestTurnUsageCount) <= 0) {
      issues.push(issue("H2", "browser_latest_turn_usage_missing", sample, {
        expectedLatestUsageRequired: true,
        latestTurnUsageCount: toNumber(sample.latestTurnUsageCount),
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
    let maxClientSubmissions = 0;
    let maxLatestTurnUserMessages = 0;
    const latestTurnWindows = new Map();
    let previousVisualAnchor = null;
    let visualAnchorSmallJitterCount = 0;
    let visualAnchorMaxShiftPx = 0;
    let visualAnchorIssueSample = null;
    let previousSubmittedMessage = null;
    let submittedMessageSmallJitterCount = 0;
    let submittedMessageMaxShiftPx = 0;
    let submittedMessageIssueSample = null;
    for (const sample of rows) {
      const turns = toNumber(sample.turns);
      const items = toNumber(sample.items);
      const settled = toNumber(sample.delayMs) >= minSettledDelayMs;
      const latestTurnHash = String(sample.latestTurnHash || "").slice(0, 32);
      maxTurns = Math.max(maxTurns, turns);
      maxItems = Math.max(maxItems, items);
      maxClientSubmissions = Math.max(maxClientSubmissions, toNumber(sample.clientSubmissionCount));
      maxLatestTurnUserMessages = Math.max(maxLatestTurnUserMessages, toNumber(sample.latestTurnUserMessageCount));
      const visualAnchorKey = String(sample.visualAnchorKeyHash || "").slice(0, 32);
      const visualFrameHash = String(sample.visualFrameHash || "").slice(0, 32);
      const visualAnchorTopPx = toNumber(sample.visualAnchorTopPx, Number.NaN);
      const scrollHeight = toNumber(sample.scrollHeight);
      const visualAnchorComparable = sampleIsConfirmed(sample)
        && sample.contentConfirmed !== false
        && visualAnchorKey
        && Number.isFinite(visualAnchorTopPx);
      if (visualAnchorComparable && previousVisualAnchor
        && previousVisualAnchor.key === visualAnchorKey
        && previousVisualAnchor.frameHash === visualFrameHash
        && previousVisualAnchor.turns === turns
        && previousVisualAnchor.items === items
        && Math.abs(previousVisualAnchor.scrollHeight - scrollHeight) <= 1) {
        const shiftPx = Math.abs(visualAnchorTopPx - previousVisualAnchor.topPx);
        if (shiftPx >= 2 && shiftPx <= 32) {
          visualAnchorSmallJitterCount += 1;
          visualAnchorMaxShiftPx = Math.max(visualAnchorMaxShiftPx, shiftPx);
          visualAnchorIssueSample = sample;
          sample.visualAnchorSmallJitterCount = visualAnchorSmallJitterCount;
          sample.visualAnchorShiftPx = visualAnchorMaxShiftPx;
        }
      }
      if (visualAnchorComparable) {
        previousVisualAnchor = {
          key: visualAnchorKey,
          frameHash: visualFrameHash,
          topPx: visualAnchorTopPx,
          turns,
          items,
          scrollHeight,
        };
      }
      const submittedKey = String(sample.submittedMessageKeyHash || "").slice(0, 32);
      const submittedTopPx = toNumber(sample.submittedMessageTopPx, Number.NaN);
      if (sampleIsConfirmed(sample)
        && submittedKey
        && Number.isFinite(submittedTopPx)) {
        if (previousSubmittedMessage && previousSubmittedMessage.key === submittedKey) {
          const shiftPx = Math.abs(submittedTopPx - previousSubmittedMessage.topPx);
          if (shiftPx >= 2 && shiftPx <= 32) {
            submittedMessageSmallJitterCount += 1;
            submittedMessageMaxShiftPx = Math.max(submittedMessageMaxShiftPx, shiftPx);
            submittedMessageIssueSample = sample;
            sample.submittedMessageSmallJitterCount = submittedMessageSmallJitterCount;
            sample.submittedMessageShiftPx = submittedMessageMaxShiftPx;
          }
        }
        previousSubmittedMessage = {
          key: submittedKey,
          topPx: submittedTopPx,
        };
      }
      if (isNonEmptySample(sample)) {
        if (sample.contentConfirmed !== false) {
          seenNonEmpty = true;
          maxConfirmedTurns = Math.max(maxConfirmedTurns, turns);
          maxConfirmedItems = Math.max(maxConfirmedItems, items);
        }
      }
      else if (seenNonEmpty && isSparseSample(sample)) {
        issues.push(issue(settled ? "H2" : "H3", "browser_dom_sparse_after_nonempty", sample, {
          threadHash,
          previousMaxTurns: maxConfirmedTurns,
          previousMaxItems: maxConfirmedItems,
          loadingNote: Boolean(sample.loadingNote),
          emptyState: Boolean(sample.emptyState),
          settled,
        }));
      }
      if (seenNonEmpty && settled && items > 0 && maxConfirmedItems > 0 && items < Math.max(3, Math.floor(maxConfirmedItems * 0.55))) {
        issues.push(issue("H2", "browser_dom_visible_items_downgraded_after_nonempty", sample, {
          threadHash,
          previousMaxItems: maxConfirmedItems,
          currentItems: items,
          previousMaxTurns: maxConfirmedTurns,
          currentTurns: turns,
          contentConfirmed: sample.contentConfirmed !== false,
        }));
      }
      if (sampleIsConfirmed(sample) && settled && sample.latestTurnMatchesTarget && latestTurnHash) {
        const previous = latestTurnWindows.get(latestTurnHash) || {
          itemCount: 0,
          userMessageCount: 0,
          assistantMessageCount: 0,
        };
        const currentItems = toNumber(sample.latestTurnItemCount);
        const currentUsers = toNumber(sample.latestTurnUserMessageCount);
        const currentAssistants = toNumber(sample.latestTurnAssistantMessageCount);
        if (previous.itemCount > 0 && currentItems > 0 && currentItems < previous.itemCount) {
          issues.push(issue("H2", "browser_latest_turn_item_count_downgraded", sample, {
            threadHash,
            latestTurnHash,
            previousLatestTurnItemCount: previous.itemCount,
            currentLatestTurnItemCount: currentItems,
          }));
        }
        if (previous.userMessageCount > 0 && currentUsers < previous.userMessageCount) {
          issues.push(issue("H2", "browser_latest_turn_user_message_downgraded", sample, {
            threadHash,
            latestTurnHash,
            previousLatestTurnUserMessageCount: previous.userMessageCount,
            currentLatestTurnUserMessageCount: currentUsers,
          }));
        }
        if (previous.assistantMessageCount > 0 && currentAssistants < previous.assistantMessageCount) {
          issues.push(issue("H2", "browser_latest_turn_assistant_message_downgraded", sample, {
            threadHash,
            latestTurnHash,
            previousLatestTurnAssistantMessageCount: previous.assistantMessageCount,
            currentLatestTurnAssistantMessageCount: currentAssistants,
          }));
        }
        latestTurnWindows.set(latestTurnHash, {
          itemCount: Math.max(previous.itemCount, currentItems),
          userMessageCount: Math.max(previous.userMessageCount, currentUsers),
          assistantMessageCount: Math.max(previous.assistantMessageCount, currentAssistants),
        });
      }
      if (sampleIsConfirmed(sample)
        && settled
        && maxClientSubmissions > 0
        && toNumber(sample.clientSubmissionCount) === 0
        && toNumber(sample.latestTurnUserMessageCount) < maxLatestTurnUserMessages) {
        issues.push(issue("H2", "browser_pending_user_message_disappeared", sample, {
          threadHash,
          previousMaxClientSubmissions: maxClientSubmissions,
          currentClientSubmissions: toNumber(sample.clientSubmissionCount),
          previousMaxLatestTurnUserMessages: maxLatestTurnUserMessages,
          currentLatestTurnUserMessages: toNumber(sample.latestTurnUserMessageCount),
        }));
      }
      if (sampleIsConfirmed(sample)
        && settled
        && sample.exerciseSubmit
        && sample.submitOk
        && sample.submitPhase !== "pre"
        && toNumber(sample.clientSubmissionCount) === 0
        && toNumber(sample.latestTurnUserMessageCount) === 0
        && toNumber(sample.actualLatestTurnUserMessageCount) === 0) {
        issues.push(issue("H2", "browser_submit_user_message_not_visible", sample, {
          threadHash,
          submitPhase: safeLabel(sample.submitPhase || "post"),
          currentClientSubmissions: toNumber(sample.clientSubmissionCount),
          currentLatestTurnUserMessages: toNumber(sample.latestTurnUserMessageCount),
          currentActualLatestTurnUserMessages: toNumber(sample.actualLatestTurnUserMessageCount),
        }));
      }
    }
    if (visualAnchorSmallJitterCount >= 2 && visualAnchorIssueSample) {
      issues.push(issue("H3", "browser_visual_anchor_jitter", visualAnchorIssueSample, {
        threadHash,
        jitterCount: visualAnchorSmallJitterCount,
        maxShiftPx: visualAnchorMaxShiftPx,
      }));
    }
    if (submittedMessageSmallJitterCount >= 1 && submittedMessageIssueSample) {
      issues.push(issue("H3", "browser_submitted_message_card_jitter", submittedMessageIssueSample, {
        threadHash,
        jitterCount: submittedMessageSmallJitterCount,
        maxShiftPx: submittedMessageMaxShiftPx,
      }));
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
