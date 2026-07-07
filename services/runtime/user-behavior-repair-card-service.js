"use strict";

const DEFAULT_TARGET_ROLE = "plugin_worker";
const DEFAULT_DEDUPE_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_MISSING_AFTER_MS = 600;

const DIAGNOSTIC_ISSUES = Object.freeze({
  submitted_message_dom_duplicate: {
    issueCode: "visible_user_card_duplicate",
    title: "Repair Codex Mobile submitted user duplicate",
    summary: "Live client diagnostics observed duplicate submitted user-message DOM.",
  },
  submitted_message_dom_missing: {
    issueCode: "visible_user_card_missing_after_settle",
    title: "Repair Codex Mobile submitted user disappearance",
    summary: "Live client diagnostics observed a submitted user message missing from DOM after settle.",
  },
});

function stringValue(value, max = 200) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

function boolValue(value) {
  return value === true || value === 1 || /^(1|true|yes|on)$/i.test(String(value || ""));
}

function disabledValue(value) {
  return value === true || value === 1 || /^(1|true|yes|on)$/i.test(String(value || ""));
}

function boundedCount(value) {
  const number = Math.trunc(Number(value || 0));
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(number, 1_000_000);
}

function boundedMs(value, fallback, min, max) {
  const number = Math.trunc(Number(value || 0));
  if (!Number.isFinite(number) || number < min) return fallback;
  return Math.min(number, max);
}

function detailField(details = {}, key = "", fallback = "") {
  if (details && Object.prototype.hasOwnProperty.call(details, key)) return details[key];
  const snake = key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
  if (details && Object.prototype.hasOwnProperty.call(details, snake)) return details[snake];
  return fallback;
}

function dedupeWindowIso(nowMs, windowMs) {
  const timestamp = Math.max(0, Math.trunc(Number(nowMs || Date.now()) || Date.now()));
  const windowSize = Math.max(60_000, Math.trunc(Number(windowMs || DEFAULT_DEDUPE_WINDOW_MS)) || DEFAULT_DEDUPE_WINDOW_MS);
  return new Date(Math.floor(timestamp / windowSize) * windowSize).toISOString();
}

function publicBuildHash(clientBuildId = "") {
  const text = stringValue(clientBuildId, 160);
  const match = text.match(/v\d+-([a-f0-9]{8,16})/i);
  return match ? match[1].slice(0, 12) : "";
}

function classifyHomeAiDiagnosticFailure(event, envelope = {}) {
  if (event !== "home_ai_diagnostic_failure_recorded") return null;
  const details = envelope.details || {};
  if (details.observeOnly === true || details.observe_only === true) return null;
  const diagnosticType = stringValue(details.diagnostic_type || details.diagnosticType, 120);
  const errorCode = stringValue(details.error_code || details.errorCode || diagnosticType, 120);
  const issueKey = DIAGNOSTIC_ISSUES[diagnosticType] ? diagnosticType : errorCode;
  const definition = DIAGNOSTIC_ISSUES[issueKey];
  if (!definition) return null;
  return {
    source: "home_ai_diagnostic_failure_recorded",
    diagnosticType: diagnosticType || issueKey,
    errorCode: errorCode || issueKey,
    signature: stringValue(details.signature, 160),
    repeatedFailures: boundedCount(details.repeatedFailures || details.repeated_failures),
    eligible: details.eligible !== false,
    observeOnly: false,
    issueCode: definition.issueCode,
    title: definition.title,
    summary: definition.summary,
    counts: {},
  };
}

function classifyFrontendDiagnosticLog(event, envelope = {}, options = {}) {
  if (event !== "frontend_diagnostic_log") return null;
  const entry = envelope.details && typeof envelope.details === "object" ? envelope.details : {};
  if (stringValue(entry.event, 120) !== "submitted_echo_lifecycle") return null;
  const details = entry.details && typeof entry.details === "object" ? entry.details : {};
  if (stringValue(details.stage, 80) !== "dom-probe") return null;
  const elapsedMs = boundedCount(detailField(details, "elapsedMs"));
  const duplicateUserMessageCount = boundedCount(detailField(details, "duplicateUserMessageCount"));
  const expectedDuplicateUserMessageCount = boundedCount(detailField(details, "expectedDuplicateUserMessageCount"));
  const hasThreadSubmission = detailField(details, "hasThreadSubmission") === true;
  const domHasSubmission = detailField(details, "domHasSubmission") === true;
  if (duplicateUserMessageCount > expectedDuplicateUserMessageCount) {
    const definition = DIAGNOSTIC_ISSUES.submitted_message_dom_duplicate;
    return {
      source: "frontend_diagnostic_log",
      diagnosticType: "submitted_message_dom_duplicate",
      errorCode: "submitted_message_dom_duplicate",
      signature: stringValue(details.submissionHash || entry.threadHash, 160),
      issueCode: definition.issueCode,
      title: definition.title,
      summary: definition.summary,
      counts: {
        elapsed_ms: elapsedMs,
        duplicate_user_message_count: duplicateUserMessageCount,
        expected_duplicate_user_message_count: expectedDuplicateUserMessageCount,
        visible_count: boundedCount(detailField(details, "visibleCount")),
        dom_count: boundedCount(detailField(details, "domCount")),
      },
    };
  }
  const missingAfterMs = boundedMs(
    options.missingAfterMs || DEFAULT_MISSING_AFTER_MS,
    DEFAULT_MISSING_AFTER_MS,
    100,
    60 * 1000,
  );
  if (elapsedMs >= missingAfterMs && hasThreadSubmission && !domHasSubmission) {
    const definition = DIAGNOSTIC_ISSUES.submitted_message_dom_missing;
    return {
      source: "frontend_diagnostic_log",
      diagnosticType: "submitted_message_dom_missing",
      errorCode: "submitted_message_dom_missing",
      signature: stringValue(details.submissionHash || entry.threadHash, 160),
      issueCode: definition.issueCode,
      title: definition.title,
      summary: definition.summary,
      counts: {
        elapsed_ms: elapsedMs,
        has_thread_submission: 1,
        dom_has_submission: 0,
        visible_count: boundedCount(detailField(details, "visibleCount")),
        dom_count: boundedCount(detailField(details, "domCount")),
      },
    };
  }
  return null;
}

function classifyUserBehaviorIncident(event, envelope = {}, options = {}) {
  return classifyHomeAiDiagnosticFailure(event, envelope, options)
    || classifyFrontendDiagnosticLog(event, envelope, options);
}

function threadIdForEnvelope(envelope = {}) {
  const details = envelope.details && typeof envelope.details === "object" ? envelope.details : {};
  const nested = details.details && typeof details.details === "object" ? details.details : {};
  return stringValue(envelope.threadId || details.threadId || nested.threadId, 220);
}

function clientBuildIdForEnvelope(envelope = {}) {
  const details = envelope.details && typeof envelope.details === "object" ? envelope.details : {};
  const nested = details.details && typeof details.details === "object" ? details.details : {};
  return stringValue(details.clientBuildId || nested.clientBuildId || details.context && details.context.build_id, 160);
}

function surfaceFacts(envelope = {}) {
  const details = envelope.details && typeof envelope.details === "object" ? envelope.details : {};
  const nested = details.details && typeof details.details === "object" ? details.details : {};
  return {
    path: stringValue(envelope.path, 160),
    routeKind: stringValue(details.routeKind || nested.routeKind || details.context && details.context.route_kind, 80),
    embedded: boolValue(details.embedded || nested.embedded || details.context && details.context.embedded),
    pwa: boolValue(details.pwa || nested.pwa || details.context && details.context.pwa),
    visibility: stringValue(details.visibility || nested.visibility || details.context && details.context.client_visibility, 40),
  };
}

function formatCounts(counts = {}) {
  const entries = Object.entries(counts || {})
    .filter(([, value]) => value !== "" && value !== null && value !== undefined)
    .map(([key, value]) => `- ${key}: ${boundedCount(value)}`);
  return entries.length ? entries.join("\n") : "- none";
}

function cardBodyForIncident(issue, envelope = {}, options = {}) {
  const threadId = threadIdForEnvelope(envelope);
  const clientBuildId = clientBuildIdForEnvelope(envelope);
  const facts = surfaceFacts(envelope);
  const buildHash = publicBuildHash(clientBuildId);
  const dedupeWindow = dedupeWindowIso(options.nowMs ? options.nowMs() : Date.now(), options.dedupeWindowMs);
  const harnessBuildArg = buildHash ? ` --expect-build-hash ${buildHash}` : "";
  return [
    "# Codex Mobile Submitted-User Incident",
    "",
    "A live client session reported a submitted-user-message UI regression. This card is created from bounded runtime metadata because the issue is intermittent and may not reproduce in a later visual smoke.",
    "",
    "## Bounded Evidence",
    "",
    `- issueCode: ${issue.issueCode}`,
    `- diagnosticType: ${issue.diagnosticType}`,
    `- errorCode: ${issue.errorCode}`,
    `- sourceEvent: ${issue.source}`,
    `- sourceThreadId: ${threadId}`,
    `- clientBuildId: ${clientBuildId || "unknown"}`,
    `- routeKind: ${facts.routeKind || "unknown"}`,
    `- embedded: ${facts.embedded ? "true" : "false"}`,
    `- pwa: ${facts.pwa ? "true" : "false"}`,
    `- visibility: ${facts.visibility || "unknown"}`,
    `- incidentDedupeWindow: ${dedupeWindow}`,
    `- signature: ${issue.signature || "none"}`,
    "",
    "## Counts",
    "",
    formatCounts(issue.counts),
    "",
    "## Required Work",
    "",
    "1. Treat this as a user-visible submitted-message state synchronization incident.",
    "2. Reproduce with the submitted-message Harness on the exact source thread and owning entry surface before code-level closure.",
    "3. If the Harness cannot reproduce, use the bounded event metadata and nearby runtime logs only as hypothesis evidence; do not mark completed without a passing Harness or an explicit partial/blocked classification.",
    "4. Fix the owning client projection/cache/DOM reconciliation layer, not a silent fallback.",
    "5. Return a bounded task card with tests, Harness evidence, deployment/readback if runtime behavior changed, and privacy confirmation.",
    "",
    "## Required Harness",
    "",
    "```sh",
    `node scripts/codex-mobile-submitted-message-harness.js --thread-id ${threadId} --service-workers both --entry-surface app-preview${harnessBuildArg} --json`,
    "```",
    "",
    "## Privacy",
    "",
    "Metadata only. Do not include raw user message text, endpoint bodies, screenshots, cookies, launch tokens, raw cache JSON, private thread bodies, provider payloads, database rows, or long logs.",
  ].join("\n");
}

function createUserBehaviorRepairCardService(dependencies = {}) {
  const createThreadTaskCardsFromSourceThread = dependencies.createThreadTaskCardsFromSourceThread;
  const logger = dependencies.logger || console;
  const enabled = dependencies.enabled !== false && !disabledValue(dependencies.disabled);
  const defaultTargetThreadId = stringValue(dependencies.targetThreadId, 220);
  const defaultTargetRole = stringValue(dependencies.targetRole || DEFAULT_TARGET_ROLE, 80);
  const defaultTargetWorkspace = stringValue(dependencies.targetWorkspace || dependencies.targetCwd, 320);
  const defaultReasoningEffort = stringValue(dependencies.reasoningEffort || "high", 40);
  const dedupeWindowMs = boundedMs(
    dependencies.dedupeWindowMs || DEFAULT_DEDUPE_WINDOW_MS,
    DEFAULT_DEDUPE_WINDOW_MS,
    60 * 1000,
    24 * 60 * 60 * 1000,
  );
  const missingAfterMs = boundedMs(
    dependencies.missingAfterMs || DEFAULT_MISSING_AFTER_MS,
    DEFAULT_MISSING_AFTER_MS,
    100,
    60 * 1000,
  );
  const nowMs = typeof dependencies.nowMs === "function" ? dependencies.nowMs : () => Date.now();
  const recentDispatches = new Map();

  function dispatchDedupeKey(issue, envelope) {
    return [
      threadIdForEnvelope(envelope),
      issue.issueCode,
      clientBuildIdForEnvelope(envelope) || "unknown-build",
      dedupeWindowIso(nowMs(), dedupeWindowMs),
    ].join("|");
  }

  async function handleClientEvent(event, envelope = {}) {
    if (!enabled) return { ok: true, created: false, reason: "disabled" };
    if (typeof createThreadTaskCardsFromSourceThread !== "function") {
      return { ok: true, created: false, reason: "task_card_dispatch_unavailable" };
    }
    const issue = classifyUserBehaviorIncident(event, envelope, { missingAfterMs });
    if (!issue) return { ok: true, created: false, reason: "not_user_behavior_incident" };
    const sourceThreadId = threadIdForEnvelope(envelope);
    if (!sourceThreadId) return { ok: true, created: false, reason: "source_thread_missing", issueCode: issue.issueCode };
    const target = {};
    if (defaultTargetThreadId) target.targetThreadId = defaultTargetThreadId;
    else if (defaultTargetRole) target.targetRole = defaultTargetRole;
    else if (defaultTargetWorkspace) target.targetWorkspace = defaultTargetWorkspace;
    if (!target.targetThreadId && !target.targetRole && !target.targetWorkspace) {
      return { ok: true, created: false, reason: "target_missing", issueCode: issue.issueCode };
    }
    const dedupeKey = dispatchDedupeKey(issue, envelope);
    const previous = recentDispatches.get(dedupeKey);
    if (previous) {
      return {
        ok: true,
        created: false,
        reason: "deduped_recent_incident",
        issueCode: issue.issueCode,
        cardId: previous.cardId || "",
      };
    }
    const body = cardBodyForIncident(issue, envelope, { dedupeWindowMs, nowMs });
    const payload = Object.assign({}, target, {
      title: issue.title,
      summary: issue.summary,
      body,
      workflowMode: "autonomous",
      routeKind: "repair",
      cardKind: "user_behavior_incident",
      category: "submitted_user_message",
      pluginId: "codex-mobile-web",
      sourceRole: "codex_mobile_user_behavior_incident",
      reasoningEffort: defaultReasoningEffort,
      autoApprove: true,
    });
    try {
      const result = await createThreadTaskCardsFromSourceThread(sourceThreadId, payload);
      const cardId = result && result.card && result.card.id || "";
      recentDispatches.set(dedupeKey, { cardId, createdAtMs: nowMs() });
      return {
        ok: true,
        created: true,
        issueCode: issue.issueCode,
        cardId,
        cardCount: Array.isArray(result && result.cards) ? result.cards.length : 0,
        direct: Boolean(result && result.direct),
        autoApprove: Boolean(result && result.autoApprove),
      };
    } catch (err) {
      if (logger && typeof logger.warn === "function") {
        logger.warn(`[user-behavior-repair-card] dispatch failed: ${err && err.message ? err.message : err}`);
      }
      return {
        ok: false,
        created: false,
        issueCode: issue.issueCode,
        reason: "task_card_dispatch_failed",
        error: stringValue(err && err.message ? err.message : err, 160),
      };
    }
  }

  return {
    handleClientEvent,
    classifyUserBehaviorIncident: (event, envelope) => classifyUserBehaviorIncident(event, envelope, { missingAfterMs }),
    cardBodyForIncident: (issue, envelope) => cardBodyForIncident(issue, envelope, { dedupeWindowMs, nowMs }),
  };
}

module.exports = {
  createUserBehaviorRepairCardService,
  classifyUserBehaviorIncident,
  cardBodyForIncident,
};
