"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  analyzeThreadDetail,
  analyzeThreadList,
  combineSelfCheck,
  compareDetailReadbacks,
  compareThreadListRowToDetail,
  compareThreadListReadbacks,
  itemTimestampMs,
  selfCheckDiagnosticCandidate,
} = require("../adapters/thread-detail-self-check-service");

const TURN_ID = "019f0ca6-a9c9-7753-8224-416f754b6c03";

function healthyDetail() {
  return {
    thread: {
      id: "thread-1",
      updatedAt: 1782624000000,
      mobileReadMode: "projection-v4-dynamic",
      mobileVisibleItemKeys: ["u1", "a1", "p1", "usage1"],
      mobileDetailResponseBudget: {
        latestCompletedReplayTurnCount: 1,
        latestCompletedReplayOperationItems: 0,
        latestCompletedReplayReasoningItems: 0,
        latestCompletedReplayAssistantItems: 2,
        latestCompletedReplayOmittedAssistantItems: 0,
      },
      turns: [
        {
          id: TURN_ID,
          status: "completed",
          items: [
            { id: "u1", type: "userMessage" },
            { id: "a1", type: "agentMessage" },
            { id: "p1", type: "plan" },
            { id: "usage1", type: "turnUsageSummary" },
          ],
        },
      ],
    },
  };
}

test("thread detail self check accepts healthy latest completed replay", () => {
  const report = analyzeThreadDetail(healthyDetail());

  assert.equal(report.ok, true);
  assert.equal(report.issues.length, 0);
  assert.deepEqual(report.latestCompleted.counts, {
    userMessage: 1,
    agentMessage: 1,
    plan: 1,
    turnUsageSummary: 1,
  });
  assert.equal(report.latestCompleted.usageItems, 1);
  assert.equal(report.budget.latestCompletedReplayOperationItems, 0);
  assert.equal(report.budget.latestCompletedReplayReasoningItems, 0);
  assert.equal(report.budget.latestCompletedReplayOmittedAssistantItems, 0);
});

test("thread detail self check accepts repeated operation groups with unique client render keys", () => {
  const detail = healthyDetail();
  detail.thread.activeTurnId = "turn-active";
  detail.thread.turns.push({
    id: "turn-active",
    status: "inProgress",
    items: [
      { id: "cmd-a", type: "commandExecution", groupKey: "same-command" },
      { id: "cmd-b", type: "commandExecution", groupKey: "same-command" },
    ],
  });

  const report = analyzeThreadDetail(detail);
  const codes = report.issues.map((issue) => issue.code);

  assert.equal(report.ok, true);
  assert.ok(!codes.includes("duplicate_client_render_keys"));
});

test("thread detail self check detects duplicate client render keys", () => {
  const detail = healthyDetail();
  detail.thread.activeTurnId = "turn-active";
  detail.thread.turns.push({
    id: "turn-active",
    status: "inProgress",
    items: [
      { id: "agent-a", type: "agentMessage", renderKey: "same-render-key" },
      { id: "agent-b", type: "plan", renderKey: "same-render-key" },
    ],
  });

  const report = analyzeThreadDetail(detail);
  const issue = report.issues.find((entry) => entry.code === "duplicate_client_render_keys");

  assert.equal(report.ok, false);
  assert.equal(issue.severity, "H2");
  assert.equal(issue.surface, "thread-detail");
  assert.equal(issue.threadHash, "4b0a5fefc328e6b9");
});

test("thread detail self check detects duplicate user message events in one turn", () => {
  const detail = healthyDetail();
  detail.thread.activeTurnId = "turn-active";
  detail.thread.turns.push({
    id: "turn-active",
    status: "inProgress",
    items: [
      { id: "item-1", type: "userMessage", startedAtMs: 1782710145041, text: "same user request" },
      { id: "item-10114", type: "userMessage", startedAt: "2026-06-29T05:15:45.041Z", text: "same   user request" },
      { id: "agent-live", type: "agentMessage", text: "working" },
    ],
  });

  const report = analyzeThreadDetail(detail);
  const issue = report.issues.find((entry) => entry.code === "duplicate_user_message_events");

  assert.equal(report.ok, false);
  assert.equal(issue.severity, "H2");
  assert.equal(issue.count, 1);
});

test("thread detail self check detects visible item timestamp order mismatch", () => {
  const detail = healthyDetail();
  detail.thread.activeTurnId = "turn-active";
  detail.thread.turns.push({
    id: "turn-active",
    status: "inProgress",
    items: [
      { id: "agent-late", type: "agentMessage", text: "late", startedAt: "2026-06-29T11:20:00.000Z" },
      { id: "agent-early", type: "agentMessage", text: "early", startedAt: "2026-06-29T11:03:00.000Z" },
      { id: "agent-mid", type: "agentMessage", text: "middle", startedAtMs: Date.parse("2026-06-29T11:15:00.000Z") },
    ],
  });

  const report = analyzeThreadDetail(detail);
  const issue = report.issues.find((entry) => entry.code === "visible_item_timestamp_order_mismatch");

  assert.equal(report.ok, false);
  assert.equal(issue.severity, "H2");
  assert.equal(issue.surface, "thread-detail");
  assert.equal(issue.count, 1);
});

test("thread detail self check accepts inferred user display timestamps", () => {
  const detail = healthyDetail();
  detail.thread.turns[0] = {
    id: "turn-display-timestamp",
    status: "completed",
    startedAt: "2026-06-29T10:26:59.000Z",
    completedAt: "2026-06-29T11:28:55.000Z",
    items: [
      {
        id: "context-known",
        type: "contextCompaction",
        startedAtMs: Date.parse("2026-06-29T10:49:44.058Z"),
      },
      {
        id: "user-inferred",
        type: "userMessage",
        mobileDisplayTimestampMs: Date.parse("2026-06-29T10:49:44.058Z") + 1,
        mobileDisplayTimestampInferred: true,
      },
      {
        id: "user-known",
        type: "userMessage",
        startedAtMs: Date.parse("2026-06-29T11:01:31.746Z"),
      },
      {
        id: "assistant-final",
        type: "agentMessage",
        startedAtMs: Date.parse("2026-06-29T11:28:55.447Z"),
      },
      {
        id: "usage",
        type: "turnUsageSummary",
        startedAtMs: Date.parse("2026-06-29T11:28:55.482Z"),
      },
    ],
  };

  const report = analyzeThreadDetail(detail);
  const codes = report.issues.map((entry) => entry.code);

  assert.equal(itemTimestampMs(detail.thread.turns[0].items[1], detail.thread.turns[0], detail.thread), Date.parse("2026-06-29T10:49:44.058Z") + 1);
  assert.equal(codes.includes("visible_item_timestamp_order_mismatch"), false);
  assert.equal(codes.includes("visible_item_timestamp_missing"), false);
});

test("thread detail self check accepts naturally short completed replay receipts", () => {
  const detail = healthyDetail();
  detail.thread.mobileVisibleItemKeys = ["u1", "a1", "usage1"];
  detail.thread.mobileDetailResponseBudget.latestCompletedReplayAssistantItems = 1;
  detail.thread.mobileDetailResponseBudget.latestCompletedReplayOmittedAssistantItems = 0;
  detail.thread.turns[0].items = [
    { id: "u1", type: "userMessage" },
    { id: "a1", type: "agentMessage" },
    { id: "usage1", type: "turnUsageSummary" },
  ];

  const report = analyzeThreadDetail(detail);

  assert.equal(report.ok, true);
  assert.ok(!report.issues.some((issue) => issue.code === "latest_completed_replay_receipt_only"));
});

test("thread detail self check detects list active status when detail is already settled", () => {
  const detail = healthyDetail();
  detail.thread.status = { type: "completed" };
  const report = compareThreadListRowToDetail({
    id: "thread-1",
    status: { type: "active" },
    activeTurnId: "turn-stale",
  }, detail);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "thread_list_active_detail_settled_mismatch"));
});

test("thread detail self check detects terminal list rows that still carry active turn markers", () => {
  const report = compareThreadListRowToDetail({
    id: "thread-1",
    status: { type: "completed" },
    activeTurnId: "turn-stale",
  }, healthyDetail());

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "thread_list_rest_status_has_active_turn"));
});

test("thread detail self check warns when latest completed replay assistant progress was budgeted away", () => {
  const detail = healthyDetail();
  detail.thread.mobileVisibleItemKeys = ["u1", "a1", "usage1"];
  detail.thread.mobileDetailResponseBudget.latestCompletedReplayAssistantItems = 1;
  detail.thread.mobileDetailResponseBudget.latestCompletedReplayOmittedAssistantItems = 2;
  detail.thread.turns[0].items = [
    { id: "u1", type: "userMessage" },
    { id: "a1", type: "agentMessage" },
    { id: "usage1", type: "turnUsageSummary" },
  ];

  const report = analyzeThreadDetail(detail);
  const issue = report.issues.find((entry) => entry.code === "latest_completed_replay_receipt_only");

  assert.equal(report.ok, true);
  assert.equal(issue.severity, "H3");
  assert.equal(issue.omittedAssistantItems, 2);
});

test("thread detail self check fails when active turn visible items were budgeted away", () => {
  const detail = healthyDetail();
  detail.thread.activeTurnId = "turn-active";
  detail.thread.turns.push({
    id: "turn-active",
    status: "inProgress",
    mobileVisibleItemBudget: {
      reason: "progressive-active-first-paint-byte-ceiling",
      omitted: 6,
      retained: 1,
      original: 7,
    },
    items: [
      { id: "a-live", type: "agentMessage" },
    ],
  });
  detail.thread.mobileDetailResponseBudget.activeTurnCount = 1;
  detail.thread.mobileDetailResponseBudget.omittedVisibleItems = 6;
  detail.thread.mobileDetailResponseBudget.progressiveActiveFirstPaintOmittedVisibleItems = 6;

  const report = analyzeThreadDetail(detail);
  const issue = report.issues.find((entry) => entry.code === "active_turn_visible_item_budget");

  assert.equal(report.ok, false);
  assert.equal(report.activeTurn.itemCount, 1);
  assert.equal(report.budget.progressiveActiveFirstPaintOmittedVisibleItems, 6);
  assert.equal(issue.severity, "H2");
  assert.equal(issue.omittedVisibleItems, 6);
});

test("thread detail self check fails when active assistant items were budgeted away", () => {
  const detail = healthyDetail();
  detail.thread.activeTurnId = "turn-active";
  detail.thread.mobileActiveOverlay = {
    reason: "overlay-evidence-complete",
    source: "projection-live",
    counts: {
      items: 4,
      assistantItems: 3,
      operationItems: 0,
      uploadItems: 0,
      receiptItems: 0,
      otherItems: 1,
      unknownItems: 0,
    },
  };
  detail.thread.turns.push({
    id: "turn-active",
    status: "inProgress",
    items: [
      { id: "u-live", type: "userMessage" },
      { id: "a-live-3", type: "agentMessage" },
    ],
  });
  detail.thread.mobileDetailResponseBudget.activeTurnCount = 1;
  detail.thread.mobileDetailResponseBudget.activeAssistantItemsBefore = 3;
  detail.thread.mobileDetailResponseBudget.activeAssistantItemsAfter = 1;
  detail.thread.mobileDetailResponseBudget.activeOmittedAssistantItems = 2;

  const report = analyzeThreadDetail(detail);
  const codes = report.issues.map((issue) => issue.code);

  assert.equal(report.ok, false);
  assert.equal(report.budget.activeOmittedAssistantItems, 2);
  assert.equal(report.budget.activeAssistantItemsBefore, 3);
  assert.equal(report.budget.activeAssistantItemsAfter, 1);
  assert.ok(codes.includes("active_turn_assistant_budget"));
  assert.ok(codes.includes("active_overlay_assistant_projection_gap"));
});

test("thread detail self check accepts active assistant gap explained by progressive replay budget", () => {
  const detail = healthyDetail();
  detail.thread.activeTurnId = "turn-active";
  detail.thread.mobileActiveOverlay = {
    reason: "overlay-evidence-complete",
    source: "projection-live",
    counts: {
      items: 89,
      assistantItems: 88,
      operationItems: 0,
      uploadItems: 0,
      receiptItems: 0,
      otherItems: 1,
      unknownItems: 0,
    },
  };
  detail.thread.turns.push({
    id: "turn-active",
    status: "inProgress",
    items: [
      { id: "u-live", type: "userMessage" },
      ...Array.from({ length: 8 }, (_, index) => ({
        id: `a-live-${index}`,
        type: "agentMessage",
      })),
    ],
  });
  detail.thread.mobileDetailResponseBudget.activeTurnCount = 1;
  detail.thread.mobileDetailResponseBudget.activeAssistantItemsBefore = 88;
  detail.thread.mobileDetailResponseBudget.activeAssistantItemsAfter = 8;
  detail.thread.mobileDetailResponseBudget.activeOmittedAssistantItems = 80;
  detail.thread.mobileDetailResponseBudget.progressiveActiveBudgetApplied = true;
  detail.thread.mobileDetailResponseBudget.progressiveReplayAssistantItems = 8;
  detail.thread.mobileDetailResponseBudget.limitedReplayAssistantItems = 80;

  const report = analyzeThreadDetail(detail);
  const codes = report.issues.map((issue) => issue.code);

  assert.equal(report.ok, true);
  assert.equal(report.budget.progressiveActiveBudgetApplied, true);
  assert.equal(report.budget.progressiveReplayAssistantItems, 8);
  assert.equal(report.budget.limitedReplayAssistantItems, 80);
  assert.ok(!codes.includes("active_turn_assistant_budget"));
  assert.ok(!codes.includes("active_overlay_assistant_projection_gap"));
});

test("thread detail self check accepts active assistant overlay explained by synthetic dedupe", () => {
  const detail = healthyDetail();
  detail.thread.activeTurnId = "turn-active";
  detail.thread.mobileSyntheticActiveAssistantDeduped = 2;
  detail.thread.mobileActiveOverlay = {
    reason: "overlay-evidence-complete",
    source: "projection-live",
    counts: {
      items: 6,
      assistantItems: 4,
      operationItems: 0,
      uploadItems: 0,
      receiptItems: 0,
      otherItems: 2,
      unknownItems: 0,
    },
  };
  detail.thread.turns.push({
    id: "turn-active",
    status: "inProgress",
    mobileSyntheticActiveAssistantDeduped: 2,
    items: [
      { id: "u-live", type: "userMessage" },
      { id: "a-live-1", type: "agentMessage" },
      { id: "a-live-2", type: "agentMessage" },
    ],
  });
  detail.thread.mobileDetailResponseBudget.activeTurnCount = 1;

  const report = analyzeThreadDetail(detail);
  const codes = report.issues.map((issue) => issue.code);

  assert.equal(report.ok, true);
  assert.equal(report.budget.syntheticActiveAssistantDeduped, 2);
  assert.ok(!codes.includes("active_overlay_assistant_projection_gap"));
});

test("thread detail self check ignores stale active completion shell as latest completed replay", () => {
  const detail = healthyDetail();
  detail.thread.turns.push({
    id: "stale-active-shell",
    status: {
      type: "completed",
      mobileStaleActiveTurn: true,
      previousType: "active",
    },
    items: [
      { id: "u-stale", type: "userMessage" },
      { id: "cmd-stale", type: "commandExecution" },
      { id: "a-stale", type: "agentMessage" },
    ],
  });

  const report = analyzeThreadDetail(detail);
  const codes = report.issues.map((issue) => issue.code);

  assert.equal(report.ok, true);
  assert.deepEqual(report.latestCompleted.counts, {
    userMessage: 1,
    agentMessage: 1,
    plan: 1,
    turnUsageSummary: 1,
  });
  assert.ok(!codes.includes("latest_completed_replay_has_operation_items"));
  assert.ok(!codes.includes("latest_completed_usage_missing"));
});

test("thread detail self check detects missing usage and timestamp", () => {
  const detail = healthyDetail();
  detail.thread.turns[0].id = "not-a-v7-id";
  detail.thread.turns[0].items = [
    { id: "u1", type: "userMessage" },
    { id: "a1", type: "agentMessage" },
  ];
  delete detail.thread.updatedAt;

  const report = analyzeThreadDetail(detail);
  const codes = report.issues.map((issue) => issue.code);

  assert.equal(report.ok, false);
  assert.ok(codes.includes("latest_completed_usage_missing"));
  assert.ok(codes.includes("visible_item_timestamp_missing"));
});

test("thread detail self check detects missing assistant behind usage", () => {
  const detail = healthyDetail();
  detail.thread.turns[0].items = [
    { id: "u1", type: "userMessage" },
    { id: "usage1", type: "turnUsageSummary" },
  ];

  const report = analyzeThreadDetail(detail);
  const codes = report.issues.map((issue) => issue.code);

  assert.equal(report.ok, false);
  assert.ok(codes.includes("latest_completed_assistant_missing"));
});

test("thread detail self check warns when completed replay loses user input", () => {
  const detail = healthyDetail();
  detail.thread.turns[0].items = [
    { id: "a1", type: "agentMessage" },
    { id: "usage1", type: "turnUsageSummary" },
  ];

  const report = analyzeThreadDetail(detail);
  const codes = report.issues.map((issue) => issue.code);

  assert.equal(report.ok, true);
  assert.ok(codes.includes("latest_completed_user_input_missing"));
});

test("thread detail self check accepts synthetic rollout completion turns without user input", () => {
  const detail = healthyDetail();
  detail.thread.turns[0].mobileSyntheticCompletionTurn = true;
  detail.thread.turns[0].source = "rollout_task_complete";
  detail.thread.turns[0].items = [
    { id: "a1", type: "agentMessage" },
    { id: "usage1", type: "turnUsageSummary" },
  ];

  const report = analyzeThreadDetail(detail);
  const codes = report.issues.map((issue) => issue.code);

  assert.equal(report.ok, true);
  assert.equal(report.latestCompleted.syntheticCompletionTurn, true);
  assert.ok(!codes.includes("latest_completed_user_input_missing"));
});

test("thread detail self check detects operation and reasoning rows in latest completed replay", () => {
  const detail = healthyDetail();
  detail.thread.turns[0].items.push(
    { id: "cmd1", type: "commandExecution" },
    { id: "reason1", type: "reasoning" },
  );

  const report = analyzeThreadDetail(detail);
  const codes = report.issues.map((issue) => issue.code);

  assert.equal(report.ok, false);
  assert.ok(codes.includes("latest_completed_replay_has_operation_items"));
  assert.ok(codes.includes("latest_completed_replay_has_reasoning_items"));
});

test("thread detail self check detects refresh downgrade", () => {
  const first = healthyDetail();
  const second = healthyDetail();
  second.thread.turns[0].items = [
    { id: "u1", type: "userMessage" },
    { id: "a1", type: "agentMessage" },
  ];

  const report = compareDetailReadbacks(first, second);
  const codes = report.issues.map((issue) => issue.code);

  assert.equal(report.ok, false);
  assert.ok(codes.includes("thread_detail_refresh_item_downgrade"));
  assert.ok(codes.includes("thread_detail_refresh_lost_usage"));
});

test("thread detail self check names user and assistant refresh downgrades", () => {
  const first = healthyDetail();
  first.thread.turns[0].items = [
    { id: "u1", type: "userMessage" },
    { id: "a1", type: "agentMessage" },
    { id: "a2", type: "agentMessage" },
    { id: "usage1", type: "turnUsageSummary" },
  ];
  const second = healthyDetail();
  second.thread.turns[0].items = [
    { id: "a1", type: "agentMessage" },
    { id: "usage1", type: "turnUsageSummary" },
  ];

  const report = compareDetailReadbacks(first, second);
  const codes = report.issues.map((issue) => issue.code);

  assert.equal(report.ok, false);
  assert.ok(codes.includes("thread_detail_refresh_lost_user_input"));
  assert.ok(codes.includes("thread_detail_refresh_lost_assistant_items"));
});

test("thread list self check detects duplicate ids and order mismatch", () => {
  const report = analyzeThreadList({
    data: [
      { id: "thread-a", updatedAt: 1000 },
      { id: "thread-a", updatedAt: 900 },
      { id: "thread-b", updatedAt: 2000 },
    ],
  });
  const codes = report.issues.map((issue) => issue.code);

  assert.equal(report.ok, false);
  assert.ok(codes.includes("thread_list_duplicate_ids"));
  assert.ok(codes.includes("thread_list_updated_order_mismatch"));
});

test("thread list self check detects unmaterialized id-title placeholders", () => {
  const report = analyzeThreadList({
    data: [{
      id: "019f0abc-def0-7123-9abc-abcdef123456",
      name: "019f0abc-def0-7123-9abc-abcdef123456",
      preview: "019f0abc-def0-7123-9abc-abcdef123456",
      status: { type: "notLoaded" },
      updatedAt: 1782729717,
    }],
  });
  const issue = report.issues.find((entry) => entry.code === "thread_list_unmaterialized_placeholder");

  assert.equal(report.ok, false);
  assert.equal(issue.severity, "H2");
  assert.equal(issue.surface, "thread-list");
  assert.equal(issue.status, "notLoaded");
});

test("thread list repeat detects lost rows and timestamp downgrade", () => {
  const report = compareThreadListReadbacks(
    { data: [{ id: "thread-a", updatedAt: 2000 }, { id: "thread-b", updatedAt: 1500 }] },
    { data: [{ id: "thread-a", updatedAt: 1000 }] },
  );
  const codes = report.issues.map((issue) => issue.code);

  assert.equal(report.ok, false);
  assert.ok(codes.includes("thread_list_repeat_lost_thread_ids"));
  assert.ok(codes.includes("thread_list_repeat_row_count_downgrade"));
  assert.ok(codes.includes("thread_list_repeat_updated_at_downgrade"));
});

test("thread list repeat raw order change stays metadata-only", () => {
  const report = compareThreadListReadbacks(
    { data: [{ id: "thread-a", name: "Thread A", updatedAt: 2000 }, { id: "thread-b", name: "Thread B", updatedAt: 1000 }] },
    { data: [{ id: "thread-b", name: "Thread B", updatedAt: 1000 }, { id: "thread-a", name: "Thread A", updatedAt: 2000 }] },
  );

  assert.equal(report.ok, true);
  assert.equal(report.rawOrderChanged, true);
  assert.equal(report.issues[0].code, "thread_list_updated_order_mismatch");
  assert.equal(report.issues.some((issue) => issue.code === "thread_list_repeat_order_changed"), false);
});

test("self check summary fails only on H1/H2 issues", () => {
  const warningOnly = combineSelfCheck({
    list: {
      issues: [{ code: "thread_list_repeat_order_changed", severity: "H3", surface: "thread-list" }],
    },
  });
  const blocking = combineSelfCheck({
    detail: {
      issues: [{ code: "latest_completed_usage_missing", severity: "H2", surface: "thread-detail" }],
    },
  });

  assert.equal(warningOnly.ok, true);
  assert.equal(warningOnly.blockingIssueCount, 0);
  assert.equal(warningOnly.diagnosticCandidateCount, 0);
  assert.equal(blocking.ok, false);
  assert.equal(blocking.blockingIssueCount, 1);
  assert.equal(blocking.diagnosticCandidateCount, 1);
  assert.equal(blocking.diagnosticCandidates[0].diagnostic_type, "thread_detail_response_contract_mismatch");
});

test("self check summary deduplicates repeated issue metadata and keeps occurrence counts", () => {
  const issue = {
    code: "latest_completed_replay_receipt_only",
    severity: "H3",
    surface: "thread-detail",
    threadHash: "thread-hash",
    turnHash: "turn-hash",
  };
  const summary = combineSelfCheck({
    first: { issues: [issue] },
    second: { issues: [Object.assign({}, issue)] },
  });

  assert.equal(summary.issueCount, 1);
  assert.equal(summary.blockingIssueCount, 0);
  assert.equal(summary.issues[0].occurrenceCount, 2);
  assert.equal(summary.diagnosticCandidateCount, 1);
  assert.equal(summary.diagnosticCandidates[0].category, "conversation_projection_mismatch");
  assert.equal(summary.diagnosticCandidates[0].diagnostic_type, "thread_detail_response_contract_mismatch");
  assert.equal(summary.diagnosticCandidates[0].error_code, "latest_completed_replay_receipt_only");
  assert.equal(summary.diagnosticCandidates[0].counts.repeated_failures, 2);
  assert.equal(summary.diagnosticCandidates[0].context.thread_hash, "thread-hash");
  assert.equal(summary.diagnosticCandidates[0].context.turn_hash, "turn-hash");
  assert.deepEqual(Object.keys(summary.diagnosticCandidates[0]).sort(), [
    "breadcrumbs",
    "category",
    "context",
    "counts",
    "diagnostic_type",
    "error_code",
    "evidence_confidence",
    "severity_hint",
  ]);
});

test("self check diagnostic candidate is metadata-only and skips one-off warnings", () => {
  const oneOffWarning = selfCheckDiagnosticCandidate({
    code: "thread_list_repeat_order_changed",
    severity: "H3",
    surface: "thread-list-refresh",
    threadHash: "thread-hash",
    occurrenceCount: 1,
  });
  const blocking = selfCheckDiagnosticCandidate({
    code: "thread_detail_refresh_lost_usage",
    severity: "H2",
    surface: "thread-detail-refresh",
    threadHash: "thread-hash",
    turnHash: "turn-hash",
    title: "private title must not appear",
    message: "private body must not appear",
  });

  assert.equal(oneOffWarning, null);
  assert.equal(blocking.category, "conversation_projection_mismatch");
  assert.equal(blocking.diagnostic_type, "thread_detail_response_contract_mismatch");
  assert.equal(blocking.severity_hint, "H2");
  const serialized = JSON.stringify(blocking);
  assert.doesNotMatch(serialized, /private title|private body|message|title/i);
});

test("timestamp self check uses UUIDv7 turn fallback", () => {
  const timestamp = itemTimestampMs(
    { id: "a1", type: "agentMessage" },
    { id: TURN_ID, status: "completed" },
    {},
  );

  assert.equal(timestamp, 1782623676873);
});
