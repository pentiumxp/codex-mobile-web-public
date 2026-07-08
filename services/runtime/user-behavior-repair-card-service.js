"use strict";

const DEFAULT_TARGET_ROLE = "plugin_worker";
const DEFAULT_DEDUPE_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_MISSING_AFTER_MS = 600;
const DEFAULT_INCIDENT_THRESHOLD = 2;

const DIAGNOSTIC_ISSUES = Object.freeze({
  submitted_message_dom_duplicate: {
    issueCode: "visible_user_card_duplicate",
    title: "Repair Codex Mobile submitted user duplicate",
    summary: "Live client diagnostics observed duplicate submitted user-message DOM.",
    category: "submitted_user_message",
  },
  submitted_message_dom_missing: {
    issueCode: "visible_user_card_missing_after_settle",
    title: "Repair Codex Mobile submitted user disappearance",
    summary: "Live client diagnostics observed a submitted user message missing from DOM after settle.",
    category: "submitted_user_message",
  },
  active_thread_window_downgrade: {
    issueCode: "active_thread_window_downgrade",
    title: "Repair Codex Mobile active-window projection downgrade",
    summary: "Live client diagnostics repeatedly observed active-window projection downgrade.",
    category: "conversation_projection_mismatch",
  },
  empty_render_with_history_evidence: {
    issueCode: "empty_render_with_history_evidence",
    title: "Repair Codex Mobile empty render with history evidence",
    summary: "Live client diagnostics repeatedly observed empty render despite history evidence.",
    category: "conversation_projection_mismatch",
  },
  empty_render_after_nonempty_detail: {
    issueCode: "empty_render_after_nonempty_detail",
    title: "Repair Codex Mobile empty render after nonempty detail",
    summary: "Live client diagnostics repeatedly observed empty render after nonempty detail.",
    category: "conversation_projection_mismatch",
  },
  empty_projection_shell: {
    issueCode: "empty_projection_shell",
    title: "Repair Codex Mobile empty projection shell",
    summary: "Live client diagnostics repeatedly observed empty projection shell detail.",
    category: "conversation_projection_mismatch",
  },
  duplicate_render_keys: {
    issueCode: "duplicate_render_keys",
    title: "Repair Codex Mobile duplicate render keys",
    summary: "Live client diagnostics repeatedly observed duplicate render keys.",
    category: "conversation_projection_mismatch",
  },
  render_signature_mismatch: {
    issueCode: "render_signature_mismatch",
    title: "Repair Codex Mobile render signature mismatch",
    summary: "Live client diagnostics repeatedly observed render signature mismatch.",
    category: "conversation_projection_mismatch",
  },
  turn_order_mismatch: {
    issueCode: "turn_order_mismatch",
    title: "Repair Codex Mobile turn order mismatch",
    summary: "Live client diagnostics repeatedly observed turn ordering mismatch.",
    category: "conversation_projection_mismatch",
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

function stableTextHash(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function issueKeyFor(value = "") {
  return stringValue(value, 140).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
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

function detailsForEnvelope(envelope = {}) {
  const details = envelope.details && typeof envelope.details === "object" ? envelope.details : {};
  const nested = details.details && typeof details.details === "object" ? details.details : {};
  const context = details.context && typeof details.context === "object" ? details.context : {};
  return { details, nested, context };
}

function diagnosticDefinitionFor(diagnosticType, errorCode) {
  return DIAGNOSTIC_ISSUES[issueKeyFor(errorCode)]
    || DIAGNOSTIC_ISSUES[issueKeyFor(diagnosticType)]
    || null;
}

function classifyHomeAiDiagnosticFailure(event, envelope = {}) {
  if (event !== "home_ai_diagnostic_failure_recorded") return null;
  const details = envelope.details || {};
  if (details.observeOnly === true || details.observe_only === true) return null;
  const diagnosticType = stringValue(details.diagnostic_type || details.diagnosticType, 120);
  const errorCode = stringValue(details.error_code || details.errorCode || diagnosticType, 120);
  const definition = diagnosticDefinitionFor(diagnosticType, errorCode);
  if (!definition) return null;
  return {
    source: "home_ai_diagnostic_failure_recorded",
    diagnosticType: diagnosticType || errorCode,
    errorCode: errorCode || diagnosticType,
    signature: stringValue(details.signature, 160),
    repeatedFailures: boundedCount(details.repeatedFailures || details.repeated_failures),
    eligible: details.eligible !== false,
    observeOnly: false,
    issueCode: definition.issueCode,
    title: definition.title,
    summary: definition.summary,
    category: definition.category || "codex_mobile_diagnostic",
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
      category: definition.category || "submitted_user_message",
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
      category: definition.category || "submitted_user_message",
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
  const { details, nested } = detailsForEnvelope(envelope);
  return stringValue(envelope.threadId || details.threadId || nested.threadId, 220);
}

function clientBuildIdForEnvelope(envelope = {}) {
  const { details, nested, context } = detailsForEnvelope(envelope);
  return stringValue(details.clientBuildId || nested.clientBuildId || context.build_id, 160);
}

function shellCacheNameForEnvelope(envelope = {}) {
  const { details, nested, context } = detailsForEnvelope(envelope);
  return stringValue(
    details.shellCacheName
      || details.shell_cache
      || nested.shellCacheName
      || nested.shell_cache
      || context.shell_cache
      || context.shellCacheName,
    160,
  );
}

function surfaceFacts(envelope = {}) {
  const { details, nested, context } = detailsForEnvelope(envelope);
  const path = stringValue(envelope.path || details.path || nested.path, 320);
  return {
    path,
    pathHash: path ? `h_${stableTextHash(path)}` : "",
    routeKind: stringValue(details.routeKind || nested.routeKind || context.route_kind, 80),
    embedded: boolValue(details.embedded || nested.embedded || context.embedded),
    pwa: boolValue(details.pwa || nested.pwa || context.pwa),
    visibility: stringValue(details.visibility || nested.visibility || context.client_visibility, 40),
  };
}

function diagnosticWindowForEnvelope(issue, envelope = {}) {
  const { details, nested, context } = detailsForEnvelope(envelope);
  return stringValue(
    issue.signature
      || details.windowHash
      || details.window_hash
      || nested.windowHash
      || nested.window_hash
      || context.thread_hash
      || context.turn_hash
      || context.item_hash
      || threadIdForEnvelope(envelope),
    180,
  );
}

function transitionReasonForEnvelope(envelope = {}) {
  const { details, nested, context } = detailsForEnvelope(envelope);
  const flags = [
    details.transition,
    details.deployTransition,
    details.deploy_transition,
    details.cacheTransition,
    details.cache_transition,
    details.artifactMismatch,
    details.artifact_mismatch,
    nested.transition,
    nested.deployTransition,
    nested.cacheTransition,
    context.deploy_transition,
    context.cache_transition,
    context.artifact_mismatch,
  ];
  if (flags.some((value) => value === true || value === 1 || /^(1|true|yes|on)$/i.test(String(value || "")))) {
    return "transition_flag_present";
  }
  const clientBuildId = clientBuildIdForEnvelope(envelope);
  const shellCacheName = shellCacheNameForEnvelope(envelope);
  const expectedBuild = stringValue(details.expectedClientBuildId || details.expected_client_build_id || context.expected_build_id, 160);
  const expectedShell = stringValue(details.expectedShellCacheName || details.expected_shell_cache_name || context.expected_shell_cache, 160);
  if (expectedBuild && clientBuildId && expectedBuild !== clientBuildId) return "client_build_transition";
  if (expectedShell && shellCacheName && expectedShell !== shellCacheName) return "shell_cache_transition";
  if (clientBuildId && shellCacheName && !clientBuildId.includes(shellCacheName)) return "client_shell_cache_mismatch";
  return "";
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
  const shellCacheName = shellCacheNameForEnvelope(envelope);
  const facts = surfaceFacts(envelope);
  const buildHash = publicBuildHash(clientBuildId);
  const dedupeWindow = dedupeWindowIso(options.nowMs ? options.nowMs() : Date.now(), options.dedupeWindowMs);
  const harnessBuildArg = buildHash ? ` --expect-build-hash ${buildHash}` : "";
  const occurrenceCount = boundedCount(options.occurrenceCount);
  const threshold = boundedCount(options.threshold);
  const commonEvidence = [
    `- issueCode: ${issue.issueCode}`,
    `- diagnosticType: ${issue.diagnosticType}`,
    `- errorCode: ${issue.errorCode}`,
    `- sourceEvent: ${issue.source}`,
    `- sourceThreadId: ${threadId}`,
    `- clientBuildId: ${clientBuildId || "unknown"}`,
    `- shellCacheName: ${shellCacheName || "unknown"}`,
    `- routeKind: ${facts.routeKind || "unknown"}`,
    `- routeHash: ${facts.pathHash || "none"}`,
    `- embedded: ${facts.embedded ? "true" : "false"}`,
    `- pwa: ${facts.pwa ? "true" : "false"}`,
    `- visibility: ${facts.visibility || "unknown"}`,
    `- incidentDedupeWindow: ${dedupeWindow}`,
    `- incidentOccurrences: ${occurrenceCount || "unknown"}`,
    `- incidentThreshold: ${threshold || "unknown"}`,
    `- signature: ${issue.signature || "none"}`,
  ];
  if (issue.category !== "submitted_user_message") {
    return [
      "# Codex Mobile Diagnostic Incident",
      "",
      "A live client session repeatedly reported the same bounded diagnostic identity. This card is created only after aggregation at the repair-card dispatch boundary.",
      "",
      "## Bounded Evidence",
      "",
      commonEvidence.join("\n"),
      "",
      "## Counts",
      "",
      formatCounts(issue.counts),
      "",
      "## Required Work",
      "",
      "1. Treat this as a repeated client projection/cache/render contract incident, not a single transient sample.",
      "2. Reproduce through the owning entry surface and verify whether deploy/cache transition or artifact mismatch is involved before code-level closure.",
      "3. If the Harness cannot reproduce, use the bounded event metadata and nearby runtime status only as hypothesis evidence; do not mark completed without passing validation or an explicit partial/blocked classification.",
      "4. Fix the owning projection, cache, response, or DOM reconciliation boundary, not a silent fallback.",
      "5. Return a bounded task card with tests, Harness/readback evidence if runtime behavior changed, and privacy confirmation.",
      "",
      "## Privacy",
      "",
      "Metadata only. Do not include raw user message text, endpoint bodies, screenshots, cookies, launch tokens, raw cache JSON, private thread bodies, provider payloads, database rows, or long logs.",
    ].join("\n");
  }
  return [
    "# Codex Mobile Submitted-User Incident",
    "",
    "A live client session repeatedly reported a submitted-user-message UI regression. This card is created from bounded runtime metadata because the issue is intermittent and may not reproduce in a later visual smoke.",
    "",
    "## Bounded Evidence",
    "",
    commonEvidence.join("\n"),
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
  const incidentThreshold = Math.max(1, boundedCount(dependencies.incidentThreshold || DEFAULT_INCIDENT_THRESHOLD));
  const missingAfterMs = boundedMs(
    dependencies.missingAfterMs || DEFAULT_MISSING_AFTER_MS,
    DEFAULT_MISSING_AFTER_MS,
    100,
    60 * 1000,
  );
  const nowMs = typeof dependencies.nowMs === "function" ? dependencies.nowMs : () => Date.now();
  const recentDispatches = new Map();
  const incidentWindows = new Map();

  function incidentWindowKey(issue, envelope) {
    const facts = surfaceFacts(envelope);
    return [
      issue.issueCode,
      issue.errorCode,
      facts.routeKind || "unknown-route",
      facts.pathHash || "unknown-path",
      clientBuildIdForEnvelope(envelope) || "unknown-build",
      shellCacheNameForEnvelope(envelope) || "unknown-cache",
      threadIdForEnvelope(envelope) || "unknown-thread",
      diagnosticWindowForEnvelope(issue, envelope) || "unknown-window",
      dedupeWindowIso(nowMs(), dedupeWindowMs),
    ].join("|");
  }

  function dispatchDedupeKey(issue, envelope) {
    return [
      incidentWindowKey(issue, envelope),
      dedupeWindowIso(nowMs(), dedupeWindowMs),
    ].join("|");
  }

  function idempotencyKeyForIncident(issue, dedupeKey) {
    return `user-behavior:${issue.issueCode}:${stableTextHash(dedupeKey)}`;
  }

  async function handleClientEvent(event, envelope = {}) {
    if (!enabled) return { ok: true, created: false, reason: "disabled" };
    if (typeof createThreadTaskCardsFromSourceThread !== "function") {
      return { ok: true, created: false, reason: "task_card_dispatch_unavailable" };
    }
    const issue = classifyUserBehaviorIncident(event, envelope, { missingAfterMs });
    if (!issue) return { ok: true, created: false, reason: "not_user_behavior_incident" };
    const transitionReason = transitionReasonForEnvelope(envelope);
    if (transitionReason) {
      return {
        ok: true,
        created: false,
        reason: "transient_transition",
        transitionReason,
        issueCode: issue.issueCode,
      };
    }
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
    const windowKey = incidentWindowKey(issue, envelope);
    const current = incidentWindows.get(windowKey) || { count: 0, firstAtMs: nowMs(), lastAtMs: 0 };
    current.count += 1;
    current.lastAtMs = nowMs();
    incidentWindows.set(windowKey, current);
    const threshold = incidentThreshold;
    if (current.count < threshold) {
      return {
        ok: true,
        created: false,
        reason: "below_incident_threshold",
        issueCode: issue.issueCode,
        occurrenceCount: current.count,
        threshold,
      };
    }
    const body = cardBodyForIncident(issue, envelope, {
      dedupeWindowMs,
      nowMs,
      occurrenceCount: current.count,
      threshold,
    });
    const payload = Object.assign({}, target, {
      title: issue.title,
      summary: issue.summary,
      body,
      workflowMode: "autonomous",
      routeKind: "repair",
      cardKind: "user_behavior_incident",
      category: issue.category || "codex_mobile_diagnostic",
      pluginId: "codex-mobile-web",
      sourceRole: "codex_mobile_user_behavior_incident",
      reasoningEffort: defaultReasoningEffort,
      autoApprove: true,
      idempotencyKey: idempotencyKeyForIncident(issue, dedupeKey),
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
