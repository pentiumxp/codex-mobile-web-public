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

function visibleUserInputCount(row = {}) {
  return toNumber(row.userMessageCount || row.latestTurnUserMessageCount)
    + toNumber(row.taskCardUserMessageCount || row.latestTurnTaskCardItemCount);
}

function safeItemKindSequence(value = []) {
  const allowed = new Set([
    "userMessage",
    "agentMessage",
    "plan",
    "operation",
    "reasoning",
    "contextCompaction",
    "turnUsageSummary",
    "threadTaskCard",
    "turnDiagnostic",
    "other",
    "unknown",
  ]);
  return toArray(value)
    .slice(0, 60)
    .map((entry) => safeLabel(entry, "unknown"))
    .map((entry) => (allowed.has(entry) ? entry : "other"));
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

function sampleReadMode(sample = {}) {
  return safeLabel(sample.expectedReadMode || sample.readMode || sample.apiReadMode, "");
}

function sampleReadDecision(sample = {}) {
  return safeLabel(sample.expectedReadDecision || sample.readDecision || sample.apiReadDecision, "");
}

function samplePerformancePhase(sample = {}) {
  return safeLabel(sample.expectedPerformancePhase || sample.performancePhase || sample.apiPerformancePhase, "");
}

function sampleUsesPartialProjectionFirstPaint(sample = {}) {
  return /projection-v?\d*-partial|projection-partial/i.test(sampleReadMode(sample))
    || /projection-stale-partial-hit|projection-partial-hit/i.test(sampleReadDecision(sample))
    || /warm-projection-partial/i.test(samplePerformancePhase(sample));
}

function summarizeSamples(samples = []) {
  const normalized = toArray(samples).filter((sample) => sample && typeof sample === "object");
  const turnCounts = normalized.map((sample) => toNumber(sample.turns));
  const itemCounts = normalized.map((sample) => toNumber(sample.items));
  const renderKeyCounts = normalized.map((sample) => toNumber(sample.renderKeys));
  const imageFailureCounts = normalized.map((sample) => toNumber(sample.imageFailureCount));
  const imageFigureCounts = normalized.map((sample) => toNumber(sample.imageFigureCount));
  const timestampMissingCounts = normalized.map((sample) => toNumber(sample.latestTimestampMissingItems));
  const expectedLatestItemCounts = normalized.map((sample) => toNumber(sample.expectedLatestItemCount));
  const latestTurnItemCounts = normalized.map((sample) => toNumber(sample.latestTurnItemCount));
  const latestTurnUserMessageCounts = normalized.map((sample) => toNumber(sample.latestTurnUserMessageCount));
  const latestTurnTaskCardItemCounts = normalized.map((sample) => toNumber(sample.latestTurnTaskCardItemCount));
  const latestTurnAssistantMessageCounts = normalized.map((sample) => toNumber(sample.latestTurnAssistantMessageCount));
  const latestTurnUserTextDuplicateCounts = normalized.map((sample) => toNumber(sample.latestTurnUserTextDuplicateCount));
  const expectedLatestUserMessageDuplicateCounts = normalized.map((sample) => toNumber(sample.expectedLatestUserMessageDuplicateCount));
  const actualLatestTurnUserMessageCounts = normalized.map((sample) => toNumber(sample.actualLatestTurnUserMessageCount));
  const actualLatestTurnTaskCardItemCounts = normalized.map((sample) => toNumber(sample.actualLatestTurnTaskCardItemCount));
  const actualLatestTurnAssistantMessageCounts = normalized.map((sample) => toNumber(sample.actualLatestTurnAssistantMessageCount));
  const latestTurnOperationItemCounts = normalized.map((sample) => toNumber(sample.latestTurnOperationItemCount));
  const latestTurnReasoningItemCounts = normalized.map((sample) => toNumber(sample.latestTurnReasoningItemCount));
  const latestTurnAssistantTextDuplicateCounts = normalized.map((sample) => toNumber(sample.latestTurnAssistantTextDuplicateCount));
  const allUserEventDuplicateCounts = normalized.map((sample) => toNumber(sample.allUserEventDuplicateCount));
  const clientSubmissionCounts = normalized.map((sample) => toNumber(sample.clientSubmissionCount));
  const visualAnchorShiftCounts = normalized.map((sample) => toNumber(sample.visualAnchorSmallJitterCount));
  const visualAnchorShiftPixels = normalized.map((sample) => toNumber(sample.visualAnchorShiftPx));
  const submittedMessageShiftCounts = normalized.map((sample) => toNumber(sample.submittedMessageSmallJitterCount));
  const submittedMessageShiftPixels = normalized.map((sample) => toNumber(sample.submittedMessageShiftPx));
  const bottomFollowJitterCounts = normalized.map((sample) => toNumber(sample.bottomFollowJitterCount));
  const bottomFollowDistancePixels = normalized.map((sample) => toNumber(sample.bottomDistancePx));
  const longTaskCounts = normalized.map((sample) => toNumber(sample.longTaskCount));
  const longTaskMaxDurations = normalized.map((sample) => toNumber(sample.longTaskMaxDurationMs));
  const longTaskTotalDurations = normalized.map((sample) => toNumber(sample.longTaskTotalDurationMs));
  const threadListProbeElapsedMs = normalized.map((sample) => toNumber(sample.threadListProbeElapsedMs));
  const threadListMaxRafDelayMs = normalized.map((sample) => toNumber(sample.threadListMaxRafDelayMs));
  const threadListMaxScrollApplyMs = normalized.map((sample) => toNumber(sample.threadListMaxScrollApplyMs));
  return {
    sampleCount: normalized.length,
    minTurns: normalized.length ? Math.min(...turnCounts) : 0,
    maxTurns: normalized.length ? Math.max(...turnCounts) : 0,
    minItems: normalized.length ? Math.min(...itemCounts) : 0,
    maxItems: normalized.length ? Math.max(...itemCounts) : 0,
    maxRenderKeys: normalized.length ? Math.max(...renderKeyCounts) : 0,
    maxImageFailures: normalized.length ? Math.max(...imageFailureCounts) : 0,
    maxImageFigures: normalized.length ? Math.max(...imageFigureCounts) : 0,
    maxLatestTimestampMissingItems: normalized.length ? Math.max(...timestampMissingCounts) : 0,
    maxExpectedLatestItems: normalized.length ? Math.max(...expectedLatestItemCounts) : 0,
    maxLatestTurnItems: normalized.length ? Math.max(...latestTurnItemCounts) : 0,
    maxLatestTurnUserMessages: normalized.length ? Math.max(...latestTurnUserMessageCounts) : 0,
    maxLatestTurnTaskCardItems: normalized.length ? Math.max(...latestTurnTaskCardItemCounts) : 0,
    maxLatestTurnAssistantMessages: normalized.length ? Math.max(...latestTurnAssistantMessageCounts) : 0,
    maxLatestTurnUserTextDuplicates: normalized.length ? Math.max(...latestTurnUserTextDuplicateCounts) : 0,
    maxExpectedLatestUserMessageDuplicates: normalized.length ? Math.max(...expectedLatestUserMessageDuplicateCounts) : 0,
    maxActualLatestTurnUserMessages: normalized.length ? Math.max(...actualLatestTurnUserMessageCounts) : 0,
    maxActualLatestTurnTaskCardItems: normalized.length ? Math.max(...actualLatestTurnTaskCardItemCounts) : 0,
    maxActualLatestTurnAssistantMessages: normalized.length ? Math.max(...actualLatestTurnAssistantMessageCounts) : 0,
    maxLatestTurnOperationItems: normalized.length ? Math.max(...latestTurnOperationItemCounts) : 0,
    maxLatestTurnReasoningItems: normalized.length ? Math.max(...latestTurnReasoningItemCounts) : 0,
    maxLatestTurnAssistantTextDuplicates: normalized.length ? Math.max(...latestTurnAssistantTextDuplicateCounts) : 0,
    maxAllUserEventDuplicates: normalized.length ? Math.max(...allUserEventDuplicateCounts) : 0,
    maxClientSubmissions: normalized.length ? Math.max(...clientSubmissionCounts) : 0,
    maxVisualAnchorSmallJitterCount: normalized.length ? Math.max(...visualAnchorShiftCounts) : 0,
    maxVisualAnchorShiftPx: normalized.length ? Math.max(...visualAnchorShiftPixels) : 0,
    maxSubmittedMessageSmallJitterCount: normalized.length ? Math.max(...submittedMessageShiftCounts) : 0,
    maxSubmittedMessageShiftPx: normalized.length ? Math.max(...submittedMessageShiftPixels) : 0,
    maxBottomFollowJitterCount: normalized.length ? Math.max(...bottomFollowJitterCounts) : 0,
    maxBottomDistancePx: normalized.length ? Math.max(...bottomFollowDistancePixels) : 0,
    maxLongTaskCount: normalized.length ? Math.max(...longTaskCounts) : 0,
    maxLongTaskDurationMs: normalized.length ? Math.max(...longTaskMaxDurations) : 0,
    maxLongTaskTotalDurationMs: normalized.length ? Math.max(...longTaskTotalDurations) : 0,
    maxThreadListProbeElapsedMs: normalized.length ? Math.max(...threadListProbeElapsedMs) : 0,
    maxThreadListRafDelayMs: normalized.length ? Math.max(...threadListMaxRafDelayMs) : 0,
    maxThreadListScrollApplyMs: normalized.length ? Math.max(...threadListMaxScrollApplyMs) : 0,
    sparseSampleCount: normalized.filter(isSparseSample).length,
    nonEmptySampleCount: normalized.filter(isNonEmptySample).length,
  };
}

function sampleThreadHash(sample = {}) {
  return String(sample.threadHash || "").slice(0, 32);
}

function safeLatestUserNodeDetails(value) {
  return toArray(value).slice(0, 6).map((entry, index) => {
    const row = entry && typeof entry === "object" ? entry : {};
    return {
      index: Math.max(0, Math.trunc(toNumber(row.index, index))),
      textHash: safeLabel(row.textHash, ""),
      dataItemHash: safeLabel(row.dataItemHash, ""),
      renderKeyHash: safeLabel(row.renderKeyHash, ""),
      clientSubmissionHash: safeLabel(row.clientSubmissionHash, ""),
      hasTimestamp: row.hasTimestamp === true,
      classKind: safeLabel(row.classKind, "unknown"),
    };
  });
}

function safeTurnShape(value = {}) {
  const row = value && typeof value === "object" ? value : {};
  return {
    index: Math.max(0, Math.trunc(toNumber(row.index))),
    turnHash: safeLabel(row.turnHash, ""),
    completed: row.completed === true,
    staleActive: row.staleActive === true,
    firstTimestampMs: Math.max(0, Math.trunc(toNumber(row.firstTimestampMs || row.expectedFirstTimestampMs))),
    lastTimestampMs: Math.max(0, Math.trunc(toNumber(row.lastTimestampMs || row.expectedLastTimestampMs))),
    expectedItemCount: toNumber(row.expectedItemCount),
    actualItemCount: Math.max(toNumber(row.itemCount), toNumber(row.actualItemCount)),
    expectedUserMessageCount: toNumber(row.expectedUserMessageCount),
    actualUserMessageCount: toNumber(row.userMessageCount),
    actualVisibleUserInputCount: visibleUserInputCount(row),
    expectedAssistantMessageCount: toNumber(row.expectedAssistantMessageCount),
    actualAssistantMessageCount: toNumber(row.assistantMessageCount),
    expectedTaskCardUserMessageCount: toNumber(row.expectedTaskCardUserMessageCount),
    actualTaskCardUserMessageCount: toNumber(row.taskCardUserMessageCount),
    expectedUsageRequired: row.expectedUsageRequired === true,
    actualUsageCount: toNumber(row.usageCount),
    timestampMissingItems: toNumber(row.timestampMissingItems),
    timestampMissingKindCounts: safeTimestampKindCounts(row.timestampMissingKindCounts),
    userAfterUsageCount: toNumber(row.userAfterUsageCount),
    expectedUserAfterAssistantLikeCount: toNumber(row.expectedUserAfterAssistantLikeCount),
    actualUserAfterAssistantLikeCount: toNumber(row.userAfterAssistantLikeCount),
    expectedUserAtTail: row.expectedUserAtTail === true,
    actualUserAtTail: row.userAtTail === true,
    expectedItemKindSequence: safeItemKindSequence(row.expectedItemKindSequence),
    actualItemKindSequence: safeItemKindSequence(row.itemKindSequence),
  };
}

function hasOwn(value = {}, key = "") {
  return Boolean(value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key));
}

function turnTimestampComparable(value = {}) {
  const row = value && typeof value === "object" ? value : {};
  if (hasOwn(row, "itemCount") && toNumber(row.itemCount) <= 0) return false;
  return Math.max(
    toNumber(row.itemCount),
    toNumber(row.actualItemCount),
    toNumber(row.expectedItemCount),
    toNumber(row.timestampExpectedItems),
    toNumber(row.expectedTimestampItemCount),
  ) > 0;
}

function turnTimestampOrderIssue(rows = []) {
  const normalized = toArray(rows)
    .filter(turnTimestampComparable)
    .map((row) => safeTurnShape(row))
    .filter((row) => row.turnHash
      && Math.max(toNumber(row.actualItemCount), toNumber(row.expectedItemCount)) > 0
      && row.firstTimestampMs > 0
      && row.lastTimestampMs > 0);
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    if (current.firstTimestampMs + 1000 < previous.firstTimestampMs) {
      return { previous, current, order: "first-timestamp-regressed" };
    }
  }
  return null;
}

function safeTimestampKindCounts(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const result = {};
  for (const kind of ["agentMessage", "plan", "userMessage", "threadTaskCard", "turnDiagnostic", "unknown"]) {
    const count = toNumber(source[kind]);
    if (count > 0) result[kind] = count;
  }
  return result;
}

function hasTimestampKindCounts(value = {}) {
  return Object.keys(safeTimestampKindCounts(value)).length > 0;
}

function activeProgressiveTurnShape(value = {}) {
  const row = value && typeof value === "object" ? value : {};
  const kindCounts = safeTimestampKindCounts(row.timestampMissingKindCounts);
  const hasKinds = hasTimestampKindCounts(kindCounts);
  const assistantTimestampGap = toNumber(kindCounts.agentMessage) + toNumber(kindCounts.plan);
  const nonAssistantTimestampGap = toNumber(kindCounts.userMessage)
    + toNumber(kindCounts.threadTaskCard)
    + toNumber(kindCounts.turnDiagnostic)
    + toNumber(kindCounts.unknown);
  const activeAssistantTimestampGap = row.completed !== true
    && hasKinds
    && assistantTimestampGap > 0
    && nonAssistantTimestampGap <= 0
    && row.expectedUsageRequired !== true
    && toNumber(row.expectedAssistantMessageCount) > 0
    && toNumber(row.assistantMessageCount) >= toNumber(row.expectedAssistantMessageCount);
  const activeBudgetedProgress = row.completed !== true
    && toNumber(row.expectedAssistantMessageCount) > 0
    && toNumber(row.assistantMessageCount) > toNumber(row.expectedAssistantMessageCount)
    && toNumber(row.expectedItemCount) > 0
    && toNumber(row.itemCount) < toNumber(row.expectedItemCount);
  return activeAssistantTimestampGap || activeBudgetedProgress;
}

function activeDynamicTurnShape(value = {}) {
  const row = value && typeof value === "object" ? value : {};
  return Boolean(row.completed !== true && safeLabel(row.turnHash, ""));
}

function matchedTurnShapes(sample = {}) {
  const domByHash = new Map();
  for (const row of toArray(sample.domTurnShapes)) {
    const turnHash = safeLabel(row && row.turnHash, "");
    if (turnHash) domByHash.set(turnHash, row);
  }
  const rows = [];
  for (const expected of toArray(sample.expectedTurnShapes)) {
    const turnHash = safeLabel(expected && expected.turnHash, "");
    if (!turnHash || !domByHash.has(turnHash)) continue;
    rows.push(Object.assign({}, expected, domByHash.get(turnHash), { turnHash }));
  }
  return rows;
}

function matchedLatestTurnShape(sample = {}) {
  const latestHash = safeLabel(sample.latestTurnHash, "");
  const rows = matchedTurnShapes(sample);
  if (latestHash) {
    const exact = rows.find((row) => safeLabel(row && row.turnHash, "") === latestHash);
    if (exact) return exact;
  }
  return rows.length ? rows[rows.length - 1] : null;
}

function latestTurnShapeForIssue(sample = {}) {
  return matchedLatestTurnShape(sample) || {
    turnHash: safeLabel(sample.latestTurnHash, ""),
    completed: false,
    expectedItemCount: toNumber(sample.expectedLatestItemCount),
    expectedUserMessageCount: toNumber(sample.expectedLatestUserMessageCount),
    expectedTaskCardUserMessageCount: toNumber(sample.expectedLatestTaskCardUserMessageCount),
    expectedAssistantMessageCount: toNumber(sample.expectedLatestAssistantMessageCount),
    expectedUsageRequired: sample.expectedLatestUsageRequired === true,
  };
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
  if (sample.errorCode) item.errorCode = safeLabel(sample.errorCode, "sample_error");
  return item;
}

function turnShapeIssueKey(code, sample = {}, turnShape = {}) {
  return [
    safeLabel(code, "unknown"),
    sampleThreadHash(sample),
    safeLabel(turnShape.turnHash, ""),
    turnShape.completed === true ? "completed" : "active",
    toNumber(turnShape.expectedItemCount),
    toNumber(turnShape.expectedUserMessageCount),
    toNumber(turnShape.expectedTaskCardUserMessageCount),
    toNumber(turnShape.expectedAssistantMessageCount),
    turnShape.expectedUsageRequired === true ? "usage" : "no-usage",
    toNumber(turnShape.expectedTimestampItemCount),
  ].join("|");
}

function turnShapeOrderMismatchDetails(sample = {}, turnShape = {}) {
  return {
    turnShape: safeTurnShape(turnShape),
    dynamicThreadPlan: sample && sample.dynamicThreadPlan === true ? true : undefined,
  };
}

function sequenceHasOnlyExtraTailUsers(expectedSequence = [], actualSequence = []) {
  const expected = safeItemKindSequence(expectedSequence);
  const actual = safeItemKindSequence(actualSequence);
  if (!expected.length || actual.length <= expected.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    if (actual[index] !== expected[index]) return false;
  }
  return actual.slice(expected.length).every((kind) => kind === "userMessage");
}

function submitLocalTailExplainsOrderMismatch(sample = {}, turnShape = {}) {
  if (!sample || sample.dynamicThreadPlan !== true) return false;
  if (!/^submit-post-/i.test(String(sample.label || ""))) return false;
  if (toNumber(sample.clientSubmissionCount) <= 0) return false;
  if (toNumber(turnShape.userMessageCount) <= toNumber(turnShape.expectedUserMessageCount)) return false;
  return sequenceHasOnlyExtraTailUsers(turnShape.expectedItemKindSequence, turnShape.itemKindSequence);
}

function incrementMapCount(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function analyzeBrowserRuntimeSamples(input = {}) {
  const samples = toArray(input.samples);
  const networkEvents = toArray(input.networkEvents);
  const consoleEvents = toArray(input.consoleEvents);
  const exceptions = toArray(input.exceptions);
  const minSettledDelayMs = Math.max(0, Math.trunc(toNumber(input.minSettledDelayMs, 1000)));
  const issues = [];
  const samplesByThread = new Map();
  const turnShapeMismatchCounts = new Map();

  for (const sample of samples) {
    if (!sample || typeof sample !== "object" || !sampleIsConfirmed(sample)) continue;
    for (const turnShape of matchedTurnShapes(sample)) {
      if (toNumber(turnShape.expectedUserMessageCount) > 0
        && visibleUserInputCount(turnShape) < toNumber(turnShape.expectedUserMessageCount)) {
        incrementMapCount(turnShapeMismatchCounts, turnShapeIssueKey("browser_turn_user_message_below_api_expectation", sample, turnShape));
      }
      if (toNumber(turnShape.expectedTaskCardUserMessageCount) > 0
        && toNumber(turnShape.taskCardUserMessageCount) < toNumber(turnShape.expectedTaskCardUserMessageCount)) {
        incrementMapCount(turnShapeMismatchCounts, turnShapeIssueKey("browser_turn_task_card_below_api_expectation", sample, turnShape));
      }
      if (toNumber(turnShape.expectedAssistantMessageCount) > 0
        && toNumber(turnShape.assistantMessageCount) <= 0) {
        incrementMapCount(turnShapeMismatchCounts, turnShapeIssueKey("browser_turn_assistant_missing", sample, turnShape));
      }
      if (turnShape.expectedUsageRequired === true && toNumber(turnShape.usageCount) <= 0) {
        incrementMapCount(turnShapeMismatchCounts, turnShapeIssueKey("browser_turn_usage_missing", sample, turnShape));
      }
      if (toNumber(turnShape.userAfterUsageCount) > 0) {
        incrementMapCount(turnShapeMismatchCounts, turnShapeIssueKey("browser_turn_user_message_after_usage", sample, turnShape));
      }
      if (toNumber(turnShape.expectedTimestampItemCount) > 0 && toNumber(turnShape.timestampMissingItems) > 0) {
        incrementMapCount(turnShapeMismatchCounts, turnShapeIssueKey("browser_turn_timestamp_missing", sample, turnShape));
      }
      if (turnShape.staleActive === true) {
        incrementMapCount(turnShapeMismatchCounts, turnShapeIssueKey("browser_api_stale_active_turn_downgraded", sample, turnShape));
      }
    }
    if (sample.latestTurnMatchesTarget
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && toNumber(sample.expectedLatestItemCount) > 0
      && toNumber(sample.latestTurnItemCount) < toNumber(sample.expectedLatestItemCount)) {
      incrementMapCount(
        turnShapeMismatchCounts,
        turnShapeIssueKey("browser_latest_turn_item_below_api_expectation", sample, latestTurnShapeForIssue(sample)),
      );
    }
    if (sample.latestTurnMatchesTarget
      && toNumber(sample.expectedLatestUserMessageCount) > 0
      && visibleUserInputCount(sample) < toNumber(sample.expectedLatestUserMessageCount)) {
      incrementMapCount(
        turnShapeMismatchCounts,
        turnShapeIssueKey("browser_latest_turn_user_message_below_api_expectation", sample, latestTurnShapeForIssue(sample)),
      );
    }
    if (sample.latestTurnMatchesTarget
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && toNumber(sample.expectedLatestAssistantMessageCount) > 0
      && toNumber(sample.latestTurnAssistantMessageCount) < toNumber(sample.expectedLatestAssistantMessageCount)) {
      incrementMapCount(
        turnShapeMismatchCounts,
        turnShapeIssueKey("browser_latest_turn_assistant_below_api_expectation", sample, latestTurnShapeForIssue(sample)),
      );
    }
    if (sample.latestTurnMatchesTarget
      && sample.expectedLatestUsageRequired === true
      && toNumber(sample.latestTurnUsageCount) <= 0) {
      incrementMapCount(
        turnShapeMismatchCounts,
        turnShapeIssueKey("browser_latest_turn_usage_missing", sample, latestTurnShapeForIssue(sample)),
      );
    }
  }

  function turnShapeMismatchSeverity(code, sample, turnShape) {
    const key = turnShapeIssueKey(code, sample, turnShape);
    const observationCount = turnShapeMismatchCounts.get(key) || 0;
    if (sample && sample.dynamicThreadPlan === true && observationCount < 2) return "H3";
    return "H2";
  }

  function latestTurnMismatchSeverity(code, sample, turnShape) {
    const key = turnShapeIssueKey(code, sample, turnShape);
    const observationCount = turnShapeMismatchCounts.get(key) || 0;
    if (sample && sample.dynamicThreadPlan === true && observationCount < 2) return "H3";
    return "H2";
  }

  function turnShapeMismatchDetails(code, sample, turnShape) {
    const key = turnShapeIssueKey(code, sample, turnShape);
    return {
      turnShape: safeTurnShape(turnShape),
      dynamicThreadPlan: sample && sample.dynamicThreadPlan === true ? true : undefined,
      observationCount: turnShapeMismatchCounts.get(key) || 0,
    };
  }

  function latestTurnMismatchDetails(code, sample, turnShape, details = {}) {
    const key = turnShapeIssueKey(code, sample, turnShape);
    const dynamicThreadPlan = sample && sample.dynamicThreadPlan === true;
    return Object.assign({}, details, {
      turnShape: activeDynamicTurnShape(turnShape) || dynamicThreadPlan ? safeTurnShape(turnShape) : undefined,
      dynamicThreadPlan: dynamicThreadPlan ? true : undefined,
      observationCount: turnShapeMismatchCounts.get(key) || 0,
    });
  }

  function activeLatestProgressWindow(sample = {}, latestShape = {}, previous = {}) {
    if (activeProgressiveTurnShape(latestShape)) return true;
    if (!sample || sample.dynamicThreadPlan !== true || !activeDynamicTurnShape(latestShape)) return false;
    const currentUsers = toNumber(sample.latestTurnUserMessageCount);
    const currentAssistants = toNumber(sample.latestTurnAssistantMessageCount);
    return currentAssistants > 0 && currentUsers >= toNumber(previous.userMessageCount);
  }

  for (const sample of samples) {
    if (!sample || typeof sample !== "object") continue;
    if (!sample.appVisible) issues.push(issue("H2", "browser_app_not_visible", sample));
    if (sample.loginVisible) issues.push(issue("H2", "browser_login_visible", sample));
    if (sample.probeKind === "startup"
      && sample.settingsMobileViewportExpected === true
      && sample.settingsPanelVisualReadyOnMobile !== true) {
      issues.push(issue("H2", "settings_panel_clipped_on_mobile", sample, {
        settingsPanelPresent: sample.settingsPanelPresent === true,
        settingsPanelVisibleHeight: toNumber(sample.settingsPanelVisibleHeight),
        settingsPanelVisibleWidth: toNumber(sample.settingsPanelVisibleWidth),
        settingsPanelRectHeight: toNumber(sample.settingsPanelRectHeight),
        settingsPanelRectWidth: toNumber(sample.settingsPanelRectWidth),
        settingsPanelLeft: toNumber(sample.settingsPanelLeft),
        settingsPanelRight: toNumber(sample.settingsPanelRight),
        settingsPanelVisualProbeWaitMs: toNumber(sample.settingsPanelVisualProbeWaitMs),
        settingsPanelClientHeight: toNumber(sample.settingsPanelClientHeight),
        settingsPanelScrollHeight: toNumber(sample.settingsPanelScrollHeight),
        settingsInitialVisibleTitleCount: toNumber(sample.settingsInitialVisibleTitleCount),
        settingsPrimarySiblingVisibleCount: toNumber(sample.settingsPrimarySiblingVisibleCount),
      }));
    }
    if (sample.probeKind === "startup"
      && sample.settingsMobileViewportExpected === true
      && sample.settingsRmwPanelReachableOnMobile !== true) {
      issues.push(issue("H2", "settings_rmw_panel_unreachable_on_mobile", sample, {
        settingsPanelPresent: sample.settingsPanelPresent === true,
        settingsPanelOverflowScrollable: sample.settingsPanelOverflowScrollable === true,
        settingsPanelTouchScrollReady: sample.settingsPanelTouchScrollReady === true,
        settingsPanelScrollable: sample.settingsPanelScrollable === true,
        settingsPanelScrollMoved: sample.settingsPanelScrollMoved === true,
        settingsRmwSectionPresent: sample.settingsRmwSectionPresent === true,
        settingsRmwFieldCount: toNumber(sample.settingsRmwFieldCount),
        settingsRmwActionCount: toNumber(sample.settingsRmwActionCount),
        settingsRmwVisibleFieldCount: toNumber(sample.settingsRmwVisibleFieldCount),
        settingsRmwVisibleActionCount: toNumber(sample.settingsRmwVisibleActionCount),
        settingsRmwReachableFieldCount: toNumber(sample.settingsRmwReachableFieldCount),
        settingsRmwReachableActionCount: toNumber(sample.settingsRmwReachableActionCount),
        settingsRmwWorkspaceRowCount: toNumber(sample.settingsRmwWorkspaceRowCount),
        settingsRmwVisibleWorkspaceRowCount: toNumber(sample.settingsRmwVisibleWorkspaceRowCount),
        settingsRmwReachableWorkspaceRowCount: toNumber(sample.settingsRmwReachableWorkspaceRowCount),
        settingsPanelScrollHeight: toNumber(sample.settingsPanelScrollHeight),
        settingsPanelClientHeight: toNumber(sample.settingsPanelClientHeight),
      }));
    }
    if (toNumber(sample.longTaskMaxDurationMs) >= 1000) {
      issues.push(issue("H2", "browser_main_thread_long_task", sample, {
        longTaskCount: toNumber(sample.longTaskCount),
        longTaskMaxDurationMs: toNumber(sample.longTaskMaxDurationMs),
        longTaskTotalDurationMs: toNumber(sample.longTaskTotalDurationMs),
      }));
    }
    if (String(sample.probeKind || "") === "thread-list-interaction") {
      const threadListProbeElapsedMs = toNumber(sample.threadListProbeElapsedMs);
      const threadListMaxRafDelayMs = toNumber(sample.threadListMaxRafDelayMs);
      const threadListMaxScrollApplyMs = toNumber(sample.threadListMaxScrollApplyMs);
      const stressProbe = sample.stressProbe === true;
      const elapsedBlocked = !stressProbe && threadListProbeElapsedMs >= 1500;
      if (elapsedBlocked || threadListMaxRafDelayMs >= 750 || threadListMaxScrollApplyMs >= 750) {
        issues.push(issue("H2", "browser_thread_list_interaction_blocked", sample, {
          threadListAvailable: sample.threadListAvailable === true,
          threadListCardCount: toNumber(sample.threadListCardCount),
          threadListScrollable: sample.threadListScrollable === true,
          stressProbe,
          threadListProbeElapsedMs,
          threadListMaxRafDelayMs,
          threadListMaxScrollApplyMs,
          longTaskCount: toNumber(sample.longTaskCount),
          longTaskMaxDurationMs: toNumber(sample.longTaskMaxDurationMs),
        }));
      }
    }
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
    if (sampleIsConfirmed(sample)
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && !sample.loadingNote
      && sample.pluginRefreshBannerSeededForThreadEntry === true
      && sample.pluginRefreshBannerVisibleAfterThreadEntry === true) {
      issues.push(issue("H2", "plugin_refresh_banner_stuck_after_thread_entry", sample, {
        connectionStateKind: safeLabel(sample.connectionStateKind, ""),
        domTurnCount: toNumber(sample.turns),
        expectedTurnHashCount: toNumber(sample.expectedTurnHashCount),
      }));
    }
    if (sampleIsConfirmed(sample)
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && !sample.loadingNote
      && toNumber(sample.expectedTurnHashCount) > 0
      && toNumber(sample.turns) > 0
      && sample.latestTurnMatchesTarget === false
      && sample.expectedLatestTurnHash
      && sample.actualLatestTurnHash) {
      issues.push(issue("H2", "browser_latest_turn_missing_from_dom", sample, {
        expectedLatestTurnHash: safeLabel(sample.expectedLatestTurnHash, ""),
        actualLatestTurnHash: safeLabel(sample.actualLatestTurnHash, ""),
        expectedTurnHashCount: toNumber(sample.expectedTurnHashCount),
        expectedTurnMatchCount: toNumber(sample.expectedTurnMatchCount),
        domTurnCount: toNumber(sample.turns),
      }));
    }
    if (sampleIsConfirmed(sample)
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && !sample.loadingNote
      && sample.latestTurnMatchesTarget === true
      && sampleUsesPartialProjectionFirstPaint(sample)
      && toNumber(sample.clientSubmissionCount) <= 0) {
      const latestShape = latestTurnShapeForIssue(sample);
      const completedLatest = latestShape && latestShape.completed === true;
      const expectedAssistants = Math.max(
        toNumber(sample.expectedLatestAssistantMessageCount),
        toNumber(latestShape && latestShape.expectedAssistantMessageCount),
      );
      const actualAssistants = Math.max(
        toNumber(sample.latestTurnAssistantMessageCount),
        toNumber(latestShape && latestShape.assistantMessageCount),
      );
      const expectedItems = Math.max(
        toNumber(sample.expectedLatestItemCount),
        toNumber(latestShape && latestShape.expectedItemCount),
      );
      const actualItems = Math.max(
        toNumber(sample.latestTurnItemCount),
        toNumber(latestShape && latestShape.itemCount),
        toNumber(latestShape && latestShape.actualItemCount),
      );
      if (completedLatest && expectedAssistants > 0 && actualAssistants < expectedAssistants) {
        issues.push(issue("H2", "thread_detail_reentry_partial_projection_missing_completed_assistant", sample, {
          readMode: sampleReadMode(sample),
          readDecision: sampleReadDecision(sample),
          performancePhase: samplePerformancePhase(sample),
          expectedLatestAssistantMessageCount: expectedAssistants,
          currentLatestAssistantMessageCount: actualAssistants,
          expectedLatestItemCount: expectedItems,
          currentLatestItemCount: actualItems,
          latestTurnHash: safeLabel(sample.latestTurnHash, ""),
          turnShape: safeTurnShape(latestShape),
        }));
      }
    }
    if (sampleIsConfirmed(sample)
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && !sample.loadingNote
      && toNumber(sample.returnLedgerDeliveryFailedCount) > 0) {
      issues.push(issue("H2", "task_card_return_delivery_failed", sample, {
        returnLedgerCount: toNumber(sample.returnLedgerCount),
        returnLedgerDeliveryFailedCount: toNumber(sample.returnLedgerDeliveryFailedCount),
        returnLedgerIssueCodes: toArray(sample.returnLedgerIssueCodes).map((entry) => safeLabel(entry, "")).filter(Boolean).slice(0, 12),
      }));
    }
    if (sampleIsConfirmed(sample)
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && !sample.loadingNote
      && toNumber(sample.returnLedgerProjectionFailedCount) > 0) {
      issues.push(issue("H2", "task_card_return_projection_failed", sample, {
        returnLedgerCount: toNumber(sample.returnLedgerCount),
        returnLedgerProjectionFailedCount: toNumber(sample.returnLedgerProjectionFailedCount),
        returnLedgerVisibleCount: toNumber(sample.returnLedgerVisibleCount),
        returnLedgerIssueCodes: toArray(sample.returnLedgerIssueCodes).map((entry) => safeLabel(entry, "")).filter(Boolean).slice(0, 12),
      }));
    }
    if (sampleIsConfirmed(sample)
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && !sample.loadingNote
      && toNumber(sample.returnLedgerVisibleCount) > 0
      && toNumber(sample.returnReceiptVisibleCount) <= 0) {
      issues.push(issue("H2", "task_card_return_receipt_ui_missing", sample, {
        returnLedgerCount: toNumber(sample.returnLedgerCount),
        returnLedgerVisibleCount: toNumber(sample.returnLedgerVisibleCount),
        returnReceiptVisibleCount: toNumber(sample.returnReceiptVisibleCount),
      }));
    }
    if (sampleIsConfirmed(sample)
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && !sample.loadingNote
      && toNumber(sample.returnLedgerVisibleCount) > 0
      && toNumber(sample.returnReceiptVisibleCount) > 0
      && toNumber(sample.returnReceiptTurnVisibleCount) <= 0) {
      issues.push(issue("H2", "task_card_return_receipt_turn_missing", sample, {
        returnLedgerCount: toNumber(sample.returnLedgerCount),
        returnLedgerVisibleCount: toNumber(sample.returnLedgerVisibleCount),
        returnReceiptVisibleCount: toNumber(sample.returnReceiptVisibleCount),
        returnReceiptTurnVisibleCount: toNumber(sample.returnReceiptTurnVisibleCount),
      }));
    }
    if (sampleIsConfirmed(sample)
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && !sample.loadingNote
      && toNumber(sample.returnFollowUpTaskCardCount) > 0
      && toNumber(sample.returnFollowUpBadgeVisibleCount) <= 0) {
      issues.push(issue("H2", "task_card_return_followup_badge_missing", sample, {
        returnFollowUpTaskCardCount: toNumber(sample.returnFollowUpTaskCardCount),
        returnFollowUpBadgeVisibleCount: toNumber(sample.returnFollowUpBadgeVisibleCount),
      }));
    }
    if (sampleIsConfirmed(sample)
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && !sample.loadingNote
      && sample.latestTurnMatchesTarget
      && toNumber(sample.bottomThreadTaskCardReturnCount) > 0) {
      issues.push(issue("H2", "task_card_return_cards_pollute_thread_bottom", sample, {
        bottomThreadTaskCardReturnCount: toNumber(sample.bottomThreadTaskCardReturnCount),
        bottomThreadTaskCardCount: toNumber(sample.bottomThreadTaskCardCount),
        expectedLatestTurnHash: safeLabel(sample.latestTurnHash || sample.expectedLatestTurnHash, ""),
        domTurnCount: toNumber(sample.turns),
      }));
    }
    if (sampleIsConfirmed(sample)
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && !sample.loadingNote
      && sample.latestTurnMatchesTarget
      && sample.latestTurnAtDomBottom === false
      && !(sample.returnReceiptTurnAtDomBottom === true && toNumber(sample.returnLedgerVisibleCount) > 0)
      && sample.latestTurnHash
      && sample.actualLatestTurnHash
      && String(sample.latestTurnHash || "") !== String(sample.actualLatestTurnHash || "")) {
      issues.push(issue("H2", "browser_latest_turn_not_at_dom_bottom", sample, {
        expectedLatestTurnHash: safeLabel(sample.latestTurnHash, ""),
        actualLatestTurnHash: safeLabel(sample.actualLatestTurnHash, ""),
        latestTurnDomIndex: Math.max(-1, Math.trunc(toNumber(sample.latestTurnDomIndex, -1))),
        domTurnCount: toNumber(sample.turns),
      }));
    }
    if (sampleIsConfirmed(sample)
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && !sample.loadingNote
      && sample.latestTurnMatchesTarget
      && sample.latestTurnAtDomBottom === true
      && sample.turnTimerVisible === true
      && sample.turnTimerActive === true
      && /^(refreshing-thread|loading-thread)$/i.test(String(sample.turnTimerDetailKind || ""))) {
      issues.push(issue("H2", "browser_thread_detail_activity_status_stuck", sample, {
        turnTimerDetailKind: safeLabel(sample.turnTimerDetailKind, ""),
        connectionStateKind: safeLabel(sample.connectionStateKind, ""),
        domTurnCount: toNumber(sample.turns),
        expectedTurnHashCount: toNumber(sample.expectedTurnHashCount),
      }));
    }
    if (sampleIsConfirmed(sample)
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && !sample.loadingNote
      && sample.latestTurnMatchesTarget
      && sample.latestTurnAtDomBottom === true
      && sample.turnTimerVisible === true
      && sample.turnTimerActive === true
      && sample.expectedLatestTurnHash
      && sample.currentLiveTurnHash
      && String(sample.currentLiveTurnHash || "") !== String(sample.expectedLatestTurnHash || "")) {
      issues.push(issue("H2", "browser_turn_timer_bound_to_stale_live_turn", sample, {
        expectedLatestTurnHash: safeLabel(sample.expectedLatestTurnHash, ""),
        currentLiveTurnHash: safeLabel(sample.currentLiveTurnHash, ""),
        stateActiveTurnHash: safeLabel(sample.stateActiveTurnHash, ""),
        turnTimerDetailKind: safeLabel(sample.turnTimerDetailKind, ""),
        domTurnCount: toNumber(sample.turns),
      }));
    }
    if (sampleIsConfirmed(sample)
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && sample.loadingNote
      && sample.latestTurnMatchesTarget
      && sample.latestTurnAtDomBottom === true
      && toNumber(sample.expectedTurnHashCount) > 0
      && toNumber(sample.turns) > 0) {
      issues.push(issue("H2", "browser_thread_detail_loading_note_stuck", sample, {
        expectedLatestTurnHash: safeLabel(sample.expectedLatestTurnHash || sample.latestTurnHash, ""),
        actualLatestTurnHash: safeLabel(sample.actualLatestTurnHash, ""),
        connectionStateKind: safeLabel(sample.connectionStateKind, ""),
        domTurnCount: toNumber(sample.turns),
        expectedTurnHashCount: toNumber(sample.expectedTurnHashCount),
      }));
    }
    const apiTimestampOrderIssue = turnTimestampOrderIssue(sample.expectedTurnShapes);
    if (sampleIsConfirmed(sample)
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && apiTimestampOrderIssue) {
      issues.push(issue("H2", "browser_api_turn_timestamp_order_mismatch", sample, {
        order: safeLabel(apiTimestampOrderIssue.order, ""),
        previousTurn: safeTurnShape(apiTimestampOrderIssue.previous),
        currentTurn: safeTurnShape(apiTimestampOrderIssue.current),
      }));
    }
    const domTimestampOrderIssue = turnTimestampOrderIssue(sample.domTurnShapes);
    if (sampleIsConfirmed(sample)
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && !sample.loadingNote
      && domTimestampOrderIssue) {
      issues.push(issue("H2", "browser_dom_turn_timestamp_order_mismatch", sample, {
        order: safeLabel(domTimestampOrderIssue.order, ""),
        previousTurn: safeTurnShape(domTimestampOrderIssue.previous),
        currentTurn: safeTurnShape(domTimestampOrderIssue.current),
      }));
    }
    if (sampleIsConfirmed(sample) && toNumber(sample.imageFailureCount) > 0) {
      const imageFailureDetails = toArray(sample.imageFailureDetails).slice(0, 4);
      const imageFailureKindCounts = sample.imageFailureKindCounts && typeof sample.imageFailureKindCounts === "object"
        ? Object.fromEntries(Object.entries(sample.imageFailureKindCounts).slice(0, 12).map(([key, value]) => [
          safeLabel(key, "kind"),
          toNumber(value),
        ]))
        : {};
      issues.push(issue("H2", "browser_image_render_failed", sample, {
        imageCount: toNumber(sample.imageCount),
        imageFigureCount: toNumber(sample.imageFigureCount),
        imageFailureCount: toNumber(sample.imageFailureCount),
        failedFigureCount: toNumber(sample.imageFailedFigureCount),
        brokenCompleteImageCount: toNumber(sample.brokenCompleteImageCount),
        imageFailureKindCounts,
        firstImageFailure: imageFailureDetails[0] || null,
      }));
    }
    if (sampleIsConfirmed(sample)
      && sample.latestTurnMatchesTarget
      && toNumber(sample.latestTimestampMissingItems) > 0) {
      const latestShape = matchedLatestTurnShape(sample);
      const activeProgressive = activeProgressiveTurnShape(latestShape);
      issues.push(issue(activeProgressive ? "H3" : "H2", "browser_latest_turn_timestamp_missing", sample, {
        latestTimestampExpectedItems: toNumber(sample.latestTimestampExpectedItems),
        latestTimestampMissingItems: toNumber(sample.latestTimestampMissingItems),
        latestTimestampMissingKindCounts: safeTimestampKindCounts(sample.latestTimestampMissingKindCounts),
        activeProgressive,
        turnShape: activeProgressive ? safeTurnShape(latestShape) : undefined,
      }));
    }
    if (sampleIsConfirmed(sample)
      && sample.latestTurnMatchesTarget
      && toNumber(sample.latestTurnAssistantTextDuplicateCount) > 0) {
      const latestTurnAssistantMessageCount = toNumber(sample.latestTurnAssistantMessageCount);
      const latestShape = matchedLatestTurnShape(sample);
      const activeProgressive = activeProgressiveTurnShape(latestShape);
      const severity = activeProgressive || latestTurnAssistantMessageCount > 8 ? "H3" : "H2";
      issues.push(issue(severity, "browser_latest_turn_assistant_text_duplicate", sample, {
        latestTurnAssistantMessageCount,
        latestTurnAssistantTextDuplicateCount: toNumber(sample.latestTurnAssistantTextDuplicateCount),
        activeProgressive,
        turnShape: activeProgressive ? safeTurnShape(latestShape) : undefined,
      }));
    }
    if (sampleIsConfirmed(sample)
      && sample.latestTurnMatchesTarget
      && toNumber(sample.expectedLatestUserMessageDuplicateCount) > 0) {
      issues.push(issue("H2", "browser_api_latest_turn_user_message_duplicate", sample, {
        expectedLatestUserMessageCount: toNumber(sample.expectedLatestUserMessageCount),
        expectedLatestUserMessageDuplicateCount: toNumber(sample.expectedLatestUserMessageDuplicateCount),
      }));
    }
    if (sampleIsConfirmed(sample)
      && sample.latestTurnMatchesTarget
      && toNumber(sample.latestTurnUserTextDuplicateCount) > 0) {
      issues.push(issue("H2", "browser_latest_turn_user_message_duplicate", sample, {
        latestTurnUserMessageCount: toNumber(sample.latestTurnUserMessageCount),
        latestTurnUserTextDuplicateCount: toNumber(sample.latestTurnUserTextDuplicateCount),
        latestTurnUserNodeDetails: safeLatestUserNodeDetails(sample.latestTurnUserNodeDetails),
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
    for (const turnShape of matchedTurnShapes(sample)) {
      if (toNumber(turnShape.expectedUserMessageCount) > 0
        && visibleUserInputCount(turnShape) < toNumber(turnShape.expectedUserMessageCount)) {
        const code = "browser_turn_user_message_below_api_expectation";
        issues.push(issue(turnShapeMismatchSeverity(code, sample, turnShape), code, sample, turnShapeMismatchDetails(code, sample, turnShape)));
      }
      if (toNumber(turnShape.expectedTaskCardUserMessageCount) > 0
        && toNumber(turnShape.taskCardUserMessageCount) < toNumber(turnShape.expectedTaskCardUserMessageCount)) {
        const code = "browser_turn_task_card_below_api_expectation";
        issues.push(issue(turnShapeMismatchSeverity(code, sample, turnShape), code, sample, turnShapeMismatchDetails(code, sample, turnShape)));
      }
      if (toNumber(turnShape.expectedAssistantMessageCount) > 0
        && toNumber(turnShape.assistantMessageCount) <= 0) {
        const code = "browser_turn_assistant_missing";
        issues.push(issue(turnShapeMismatchSeverity(code, sample, turnShape), code, sample, turnShapeMismatchDetails(code, sample, turnShape)));
      }
      if (turnShape.expectedUsageRequired === true && toNumber(turnShape.usageCount) <= 0) {
        const code = "browser_turn_usage_missing";
        issues.push(issue(turnShapeMismatchSeverity(code, sample, turnShape), code, sample, turnShapeMismatchDetails(code, sample, turnShape)));
      }
      if (toNumber(turnShape.userAfterUsageCount) > 0) {
        const code = "browser_turn_user_message_after_usage";
        issues.push(issue(turnShapeMismatchSeverity(code, sample, turnShape), code, sample, turnShapeMismatchDetails(code, sample, turnShape)));
      }
      const expectedUserAfterAssistantLikeCount = toNumber(turnShape.expectedUserAfterAssistantLikeCount);
      const actualUserAfterAssistantLikeCount = toNumber(turnShape.userAfterAssistantLikeCount);
      const orderSampleIsObservable = toNumber(sample.delayMs) > 0;
      if (orderSampleIsObservable
        && (expectedUserAfterAssistantLikeCount > 0 || actualUserAfterAssistantLikeCount > 0)
        && actualUserAfterAssistantLikeCount !== expectedUserAfterAssistantLikeCount
        && !submitLocalTailExplainsOrderMismatch(sample, turnShape)) {
        const code = "browser_turn_user_message_order_mismatch";
        issues.push(issue("H2", code, sample, turnShapeOrderMismatchDetails(sample, turnShape)));
      }
      if (toNumber(turnShape.expectedTimestampItemCount) > 0 && toNumber(turnShape.timestampMissingItems) > 0) {
        const activeProgressive = activeProgressiveTurnShape(turnShape);
        const code = "browser_turn_timestamp_missing";
        const severity = activeProgressive ? "H3" : turnShapeMismatchSeverity(code, sample, turnShape);
        issues.push(issue(severity, code, sample, {
          activeProgressive,
          turnShape: safeTurnShape(turnShape),
          dynamicThreadPlan: sample && sample.dynamicThreadPlan === true ? true : undefined,
          observationCount: turnShapeMismatchCounts.get(turnShapeIssueKey(code, sample, turnShape)) || 0,
        }));
      }
      if (turnShape.staleActive === true) {
        const code = "browser_api_stale_active_turn_downgraded";
        issues.push(issue(turnShapeMismatchSeverity(code, sample, turnShape), code, sample, turnShapeMismatchDetails(code, sample, turnShape)));
      }
    }
    if (sampleIsConfirmed(sample)
      && sample.latestTurnMatchesTarget
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && toNumber(sample.expectedLatestItemCount) > 0
      && toNumber(sample.latestTurnItemCount) < toNumber(sample.expectedLatestItemCount)) {
      const code = "browser_latest_turn_item_below_api_expectation";
      const latestShape = latestTurnShapeForIssue(sample);
      issues.push(issue(latestTurnMismatchSeverity(code, sample, latestShape), code, sample, latestTurnMismatchDetails(code, sample, latestShape, {
        expectedLatestItemCount: toNumber(sample.expectedLatestItemCount),
        latestTurnItemCount: toNumber(sample.latestTurnItemCount),
      })));
    }
    if (sampleIsConfirmed(sample)
      && sample.latestTurnMatchesTarget
      && toNumber(sample.expectedLatestUserMessageCount) > 0
      && visibleUserInputCount(sample) < toNumber(sample.expectedLatestUserMessageCount)) {
      const code = "browser_latest_turn_user_message_below_api_expectation";
      const latestShape = latestTurnShapeForIssue(sample);
      issues.push(issue(latestTurnMismatchSeverity(code, sample, latestShape), code, sample, latestTurnMismatchDetails(code, sample, latestShape, {
        expectedLatestUserMessageCount: toNumber(sample.expectedLatestUserMessageCount),
        latestTurnUserMessageCount: toNumber(sample.latestTurnUserMessageCount),
        latestTurnTaskCardItemCount: toNumber(sample.latestTurnTaskCardItemCount),
      })));
    }
    if (sampleIsConfirmed(sample)
      && sample.latestTurnMatchesTarget
      && toNumber(sample.delayMs) >= minSettledDelayMs
      && toNumber(sample.expectedLatestAssistantMessageCount) > 0
      && toNumber(sample.latestTurnAssistantMessageCount) < toNumber(sample.expectedLatestAssistantMessageCount)) {
      const code = "browser_latest_turn_assistant_below_api_expectation";
      const latestShape = latestTurnShapeForIssue(sample);
      issues.push(issue(latestTurnMismatchSeverity(code, sample, latestShape), code, sample, latestTurnMismatchDetails(code, sample, latestShape, {
        expectedLatestAssistantMessageCount: toNumber(sample.expectedLatestAssistantMessageCount),
        latestTurnAssistantMessageCount: toNumber(sample.latestTurnAssistantMessageCount),
      })));
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
      const code = "browser_latest_turn_usage_missing";
      const latestShape = latestTurnShapeForIssue(sample);
      issues.push(issue(latestTurnMismatchSeverity(code, sample, latestShape), code, sample, latestTurnMismatchDetails(code, sample, latestShape, {
        expectedLatestUsageRequired: true,
        latestTurnUsageCount: toNumber(sample.latestTurnUsageCount),
      })));
    }
    const hash = sampleThreadHash(sample);
    const targetComparable = sampleIsConfirmed(sample) || toNumber(sample.expectedTurnHashCount) > 0;
    if (!hash || !targetComparable) continue;
    if (!samplesByThread.has(hash)) samplesByThread.set(hash, []);
    samplesByThread.get(hash).push(sample);
  }

  for (const [threadHash, rows] of samplesByThread.entries()) {
    let seenNonEmpty = false;
    let initialSparseIssueSample = null;
    let maxItems = 0;
    let maxTurns = 0;
    let maxConfirmedItems = 0;
    let maxConfirmedTurns = 0;
    let maxClientSubmissions = 0;
    let maxLatestTurnUserMessages = 0;
    let firstConfirmedTargetContentSample = null;
    const latestTurnWindows = new Map();
    let previousVisualAnchor = null;
    let visualAnchorSmallJitterCount = 0;
    let visualAnchorMaxShiftPx = 0;
    let visualAnchorIssueSample = null;
    let previousSubmittedMessage = null;
    let submittedMessageSmallJitterCount = 0;
    let submittedMessageMaxShiftPx = 0;
    let submittedMessageIssueSample = null;
    let previousBottomFollow = null;
    let bottomFollowJitterCount = 0;
    let bottomFollowMaxDistancePx = 0;
    let bottomFollowIssueSample = null;
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
      const clientHeight = toNumber(sample.clientHeight);
      const scrollTop = toNumber(sample.scrollTop);
      const bottomDistancePx = Math.max(0, Math.round(scrollHeight - scrollTop - clientHeight));
      sample.bottomDistancePx = bottomDistancePx;
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
      const bottomFollowComparable = sampleIsConfirmed(sample)
        && sample.contentConfirmed !== false
        && turns > 0
        && items > 0
        && scrollHeight > 0
        && clientHeight > 0;
      if (bottomFollowComparable) {
        if (previousBottomFollow
          && previousBottomFollow.turns <= turns
          && previousBottomFollow.items <= items
          && scrollHeight >= previousBottomFollow.scrollHeight
          && previousBottomFollow.distancePx <= 24
          && bottomDistancePx >= 48) {
          bottomFollowJitterCount += 1;
          bottomFollowMaxDistancePx = Math.max(bottomFollowMaxDistancePx, bottomDistancePx);
          bottomFollowIssueSample = sample;
          sample.bottomFollowJitterCount = bottomFollowJitterCount;
          sample.bottomFollowMaxDistancePx = bottomFollowMaxDistancePx;
        }
        previousBottomFollow = {
          turns,
          items,
          scrollHeight,
          distancePx: bottomDistancePx,
        };
      }
      const expectedTargetContent = toNumber(sample.expectedTurnHashCount) > 0;
      const confirmedTargetContent = sampleIsConfirmed(sample)
        && sample.contentConfirmed !== false
        && expectedTargetContent
        && isNonEmptySample(sample);
      if (!firstConfirmedTargetContentSample && confirmedTargetContent) {
        firstConfirmedTargetContentSample = sample;
      }
      if (!seenNonEmpty
        && sampleIsConfirmed(sample)
        && settled
        && expectedTargetContent
        && sample.contentConfirmed === false
        && isNonEmptySample(sample)
        && !sample.loadingNote) {
        issues.push(issue("H2", "browser_dom_stale_before_target_content", sample, {
          threadHash,
          expectedTurnHashCount: toNumber(sample.expectedTurnHashCount),
          expectedTurnMatchCount: toNumber(sample.expectedTurnMatchCount),
          domTurnCount: turns,
          domItemCount: items,
          actualLatestTurnHash: safeLabel(sample.actualLatestTurnHash, ""),
        }));
      }
      if (isNonEmptySample(sample)) {
        if (!seenNonEmpty && initialSparseIssueSample) {
          issues.push(issue("H2", "browser_dom_initial_sparse_before_nonempty", initialSparseIssueSample, {
            threadHash,
            laterTurns: turns,
            laterItems: items,
            loadingNote: Boolean(initialSparseIssueSample.loadingNote),
            emptyState: Boolean(initialSparseIssueSample.emptyState),
          }));
          initialSparseIssueSample = null;
        }
        if (sample.contentConfirmed !== false) {
          seenNonEmpty = true;
          maxConfirmedTurns = Math.max(maxConfirmedTurns, turns);
          maxConfirmedItems = Math.max(maxConfirmedItems, items);
        }
      }
      else if (!seenNonEmpty
        && settled
        && isSparseSample(sample)
        && toNumber(sample.expectedTurnHashCount) > 0) {
        initialSparseIssueSample = initialSparseIssueSample || sample;
      }
      else if (seenNonEmpty && isSparseSample(sample)) {
        const unmarkedEmptyState = Boolean(sample.emptyState) && !sample.loadingNote;
        issues.push(issue((settled || unmarkedEmptyState) ? "H2" : "H3", "browser_dom_sparse_after_nonempty", sample, {
          threadHash,
          previousMaxTurns: maxConfirmedTurns,
          previousMaxItems: maxConfirmedItems,
          loadingNote: Boolean(sample.loadingNote),
          emptyState: Boolean(sample.emptyState),
          settled,
          unmarkedEmptyState,
        }));
      }
      const loadingPreviewSample = Boolean(sample.loadingNote) && !sample.emptyState;
      if (!loadingPreviewSample
        && seenNonEmpty
        && settled
        && items > 0
        && maxConfirmedItems > 0
        && items < Math.max(3, Math.floor(maxConfirmedItems * 0.55))) {
        issues.push(issue("H2", "browser_dom_visible_items_downgraded_after_nonempty", sample, {
          threadHash,
          previousMaxItems: maxConfirmedItems,
          currentItems: items,
          previousMaxTurns: maxConfirmedTurns,
          currentTurns: turns,
          contentConfirmed: sample.contentConfirmed !== false,
        }));
      }
      if (!loadingPreviewSample && sampleIsConfirmed(sample) && settled && sample.latestTurnMatchesTarget && latestTurnHash) {
        const previous = latestTurnWindows.get(latestTurnHash) || {
          itemCount: 0,
          userMessageCount: 0,
          assistantMessageCount: 0,
          activeProgressiveEver: false,
        };
        const latestShape = matchedLatestTurnShape(sample);
        const activeProgressive = activeLatestProgressWindow(sample, latestShape, previous);
        const progressiveWindow = Boolean(activeProgressive || previous.activeProgressiveEver);
        const currentItems = toNumber(sample.latestTurnItemCount);
        const currentUsers = toNumber(sample.latestTurnUserMessageCount);
        const currentAssistants = toNumber(sample.latestTurnAssistantMessageCount);
        if (previous.itemCount > 0 && currentItems > 0 && currentItems < previous.itemCount) {
          const severity = progressiveWindow && currentAssistants > 0 && currentUsers >= previous.userMessageCount ? "H3" : "H2";
          issues.push(issue(severity, "browser_latest_turn_item_count_downgraded", sample, {
            threadHash,
            latestTurnHash,
            previousLatestTurnItemCount: previous.itemCount,
            currentLatestTurnItemCount: currentItems,
            activeProgressive: progressiveWindow,
            dynamicThreadPlan: sample && sample.dynamicThreadPlan === true ? true : undefined,
            turnShape: activeProgressive ? safeTurnShape(latestShape) : undefined,
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
          const severity = progressiveWindow && currentAssistants > 0 ? "H3" : "H2";
          issues.push(issue(severity, "browser_latest_turn_assistant_message_downgraded", sample, {
            threadHash,
            latestTurnHash,
            previousLatestTurnAssistantMessageCount: previous.assistantMessageCount,
            currentLatestTurnAssistantMessageCount: currentAssistants,
            activeProgressive: progressiveWindow,
            dynamicThreadPlan: sample && sample.dynamicThreadPlan === true ? true : undefined,
            turnShape: activeProgressive ? safeTurnShape(latestShape) : undefined,
          }));
        }
        latestTurnWindows.set(latestTurnHash, {
          itemCount: Math.max(previous.itemCount, currentItems),
          userMessageCount: Math.max(previous.userMessageCount, currentUsers),
          assistantMessageCount: Math.max(previous.assistantMessageCount, currentAssistants),
          activeProgressiveEver: progressiveWindow,
        });
      }
      if (sampleIsConfirmed(sample)
        && settled
        && !loadingPreviewSample
        && toNumber(sample.allUserEventDuplicateCount) > 0) {
        issues.push(issue("H2", "browser_user_message_event_duplicate", sample, {
          threadHash,
          duplicateCount: toNumber(sample.allUserEventDuplicateCount),
          latestTurnDuplicateCount: toNumber(sample.latestTurnUserTextDuplicateCount),
        }));
      }
      if (sampleIsConfirmed(sample)
        && settled
        && !loadingPreviewSample
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
    if (bottomFollowJitterCount >= 1 && bottomFollowIssueSample) {
      issues.push(issue("H3", "browser_bottom_follow_jitter", bottomFollowIssueSample, {
        threadHash,
        jitterCount: bottomFollowJitterCount,
        maxDistancePx: bottomFollowMaxDistancePx,
      }));
    }
    if (firstConfirmedTargetContentSample) {
      const firstContentDelayMs = toNumber(firstConfirmedTargetContentSample.delayMs);
      const h2DelayMs = minSettledDelayMs;
      if (firstContentDelayMs > minSettledDelayMs) {
        issues.push(issue("H2", "browser_target_content_first_paint_delayed", firstConfirmedTargetContentSample, {
          threadHash,
          firstContentDelayMs,
          h2DelayMs,
          domTurnCount: toNumber(firstConfirmedTargetContentSample.turns),
          domItemCount: toNumber(firstConfirmedTargetContentSample.items),
          expectedTurnHashCount: toNumber(firstConfirmedTargetContentSample.expectedTurnHashCount),
          expectedTurnMatchCount: toNumber(firstConfirmedTargetContentSample.expectedTurnMatchCount),
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
    if (!seenNonEmpty && initialSparseIssueSample) {
      issues.push(issue("H2", "browser_dom_never_loaded_target_content", initialSparseIssueSample, {
        threadHash,
        expectedTurnHashCount: toNumber(initialSparseIssueSample.expectedTurnHashCount),
        expectedTurnMatchCount: toNumber(initialSparseIssueSample.expectedTurnMatchCount),
        domTurnCount: toNumber(initialSparseIssueSample.turns),
        domItemCount: toNumber(initialSparseIssueSample.items),
        loadingNote: Boolean(initialSparseIssueSample.loadingNote),
        emptyState: Boolean(initialSparseIssueSample.emptyState),
      }));
    }
  }

  if (exceptions.length) {
    const exceptionCodes = Array.from(new Set(exceptions
      .map((entry) => safeLabel(entry && entry.code, "runtime_exception"))
      .filter(Boolean))).slice(0, 8);
    const exceptionHashes = Array.from(new Set(exceptions
      .map((entry) => safeLabel(entry && entry.detailHash, ""))
      .filter(Boolean))).slice(0, 8);
    const exceptionLabels = Array.from(new Set(exceptions
      .map((entry) => safeLabel(entry && entry.label, ""))
      .filter(Boolean))).slice(0, 8);
    issues.push({
      severity: "H2",
      code: "browser_runtime_exception",
      surface: "browser-runtime",
      count: exceptions.length,
      exceptionCodes,
      exceptionHashes,
      exceptionLabels,
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
    analysisContractVersion: "renderable-turn-v2",
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
