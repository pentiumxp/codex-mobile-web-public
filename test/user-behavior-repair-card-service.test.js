"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createUserBehaviorRepairCardService,
  classifyUserBehaviorIncident,
  cardBodyForIncident,
} = require("../services/runtime/user-behavior-repair-card-service");

function diagnosticEnvelope(overrides = {}) {
  return Object.assign({
    threadId: "019f316b-27cd-7622-9944-0b909fec3c70",
    path: "/thread/019f316b-27cd-7622-9944-0b909fec3c70",
    details: {
      diagnostic_type: "submitted_message_dom_duplicate",
      error_code: "submitted_message_dom_duplicate",
      clientBuildId: "0.1.11|codex-mobile-shell-v625-503cbb124641",
      routeKind: "thread-detail",
      embedded: true,
      visibility: "visible",
      signature: "sig-test",
    },
  }, overrides);
}

test("classifies submitted-message duplicate and missing client incidents", () => {
  const duplicate = classifyUserBehaviorIncident(
    "home_ai_diagnostic_failure_recorded",
    diagnosticEnvelope(),
  );
  assert.equal(duplicate.issueCode, "visible_user_card_duplicate");
  assert.equal(duplicate.diagnosticType, "submitted_message_dom_duplicate");

  const missing = classifyUserBehaviorIncident("frontend_diagnostic_log", {
    threadId: "thread-1",
    details: {
      event: "submitted_echo_lifecycle",
      threadHash: "thread-hash",
      details: {
        stage: "dom-probe",
        elapsedMs: 1200,
        hasThreadSubmission: true,
        domHasSubmission: false,
        visibleCount: 0,
        domCount: 0,
      },
    },
  });
  assert.equal(missing.issueCode, "visible_user_card_missing_after_settle");
  assert.equal(missing.counts.elapsed_ms, 1200);

  const frontendDuplicate = classifyUserBehaviorIncident("frontend_diagnostic_log", {
    threadId: "thread-1",
    details: {
      event: "submitted_echo_lifecycle",
      details: {
        stage: "dom-probe",
        elapsedMs: 2800,
        duplicateUserMessageCount: 2,
        expectedDuplicateUserMessageCount: 1,
        visibleCount: 2,
      },
    },
  });
  assert.equal(frontendDuplicate.issueCode, "visible_user_card_duplicate");
  assert.equal(frontendDuplicate.counts.duplicate_user_message_count, 2);
});

test("ignores observe-only and unrelated client events", () => {
  assert.equal(classifyUserBehaviorIncident("thread_refresh_ms", diagnosticEnvelope()), null);
  assert.equal(classifyUserBehaviorIncident("home_ai_diagnostic_failure_recorded", diagnosticEnvelope({
    details: {
      diagnostic_type: "submitted_message_dom_duplicate",
      observeOnly: true,
    },
  })), null);
  assert.equal(classifyUserBehaviorIncident("frontend_diagnostic_log", {
    details: { event: "submitted_echo_lifecycle", details: { stage: "local-insert" } },
  }), null);
});

test("creates bounded repair task card to plugin worker and dedupes within window", async () => {
  const calls = [];
  const service = createUserBehaviorRepairCardService({
    targetRole: "plugin_worker",
    nowMs: () => Date.parse("2026-07-07T08:00:00.000Z"),
    createThreadTaskCardsFromSourceThread: async (sourceThreadId, payload) => {
      calls.push({ sourceThreadId, payload });
      return { card: { id: "ttc_user_behavior_test" }, cards: [{ id: "ttc_user_behavior_test" }], direct: true, autoApprove: true };
    },
  });

  const result = await service.handleClientEvent("home_ai_diagnostic_failure_recorded", diagnosticEnvelope());

  assert.equal(result.ok, true);
  assert.equal(result.created, true);
  assert.equal(result.issueCode, "visible_user_card_duplicate");
  assert.equal(result.cardId, "ttc_user_behavior_test");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sourceThreadId, "019f316b-27cd-7622-9944-0b909fec3c70");
  assert.equal(calls[0].payload.targetRole, "plugin_worker");
  assert.equal(calls[0].payload.workflowMode, "autonomous");
  assert.equal(calls[0].payload.routeKind, "repair");
  assert.equal(calls[0].payload.cardKind, "user_behavior_incident");
  assert.equal(calls[0].payload.category, "submitted_user_message");
  assert.equal(calls[0].payload.reasoningEffort, "high");
  assert.match(calls[0].payload.body, /codex-mobile-submitted-message-harness\.js/);
  assert.match(calls[0].payload.body, /--thread-id 019f316b-27cd-7622-9944-0b909fec3c70/);
  assert.match(calls[0].payload.body, /--expect-build-hash 503cbb124641/);
  assert.match(calls[0].payload.body, /Do not include raw user message text/);
  assert.doesNotMatch(calls[0].payload.body, /secret visible message body/i);

  const deduped = await service.handleClientEvent("home_ai_diagnostic_failure_recorded", diagnosticEnvelope());
  assert.equal(deduped.created, false);
  assert.equal(deduped.reason, "deduped_recent_incident");
  assert.equal(calls.length, 1);
});

test("supports exact target override and disabled mode", async () => {
  const exactCalls = [];
  const exact = createUserBehaviorRepairCardService({
    targetThreadId: "019f3181-4f2f-7aa3-8ae8-d12f6e23e7a5",
    targetRole: "plugin_worker",
    createThreadTaskCardsFromSourceThread: async (_sourceThreadId, payload) => {
      exactCalls.push(payload);
      return { card: { id: "ttc_exact" }, direct: true };
    },
  });
  const exactResult = await exact.handleClientEvent("home_ai_diagnostic_failure_recorded", diagnosticEnvelope());
  assert.equal(exactResult.created, true);
  assert.equal(exactCalls[0].targetThreadId, "019f3181-4f2f-7aa3-8ae8-d12f6e23e7a5");
  assert.equal(exactCalls[0].targetRole, undefined);

  const disabled = createUserBehaviorRepairCardService({
    disabled: true,
    createThreadTaskCardsFromSourceThread: async () => {
      throw new Error("disabled service should not dispatch");
    },
  });
  const disabledResult = await disabled.handleClientEvent("home_ai_diagnostic_failure_recorded", diagnosticEnvelope());
  assert.equal(disabledResult.created, false);
  assert.equal(disabledResult.reason, "disabled");
});

test("card body is metadata-only and contains required harness command", () => {
  const issue = classifyUserBehaviorIncident("home_ai_diagnostic_failure_recorded", diagnosticEnvelope());
  const body = cardBodyForIncident(issue, diagnosticEnvelope(), {
    nowMs: () => Date.parse("2026-07-07T08:20:00.000Z"),
    dedupeWindowMs: 60 * 60 * 1000,
  });
  assert.match(body, /sourceThreadId: 019f316b-27cd-7622-9944-0b909fec3c70/);
  assert.match(body, /incidentDedupeWindow: 2026-07-07T08:00:00.000Z/);
  assert.match(body, /--service-workers both --entry-surface app-preview/);
  assert.match(body, /Do not include raw user message text/);
});
