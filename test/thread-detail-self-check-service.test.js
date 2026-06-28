"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  analyzeThreadDetail,
  analyzeThreadList,
  combineSelfCheck,
  compareDetailReadbacks,
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

test("thread list repeat order change is warning-only", () => {
  const report = compareThreadListReadbacks(
    { data: [{ id: "thread-a", updatedAt: 2000 }, { id: "thread-b", updatedAt: 1000 }] },
    { data: [{ id: "thread-b", updatedAt: 1000 }, { id: "thread-a", updatedAt: 2000 }] },
  );

  assert.equal(report.ok, true);
  assert.equal(report.issues[0].code, "thread_list_updated_order_mismatch");
  assert.equal(report.issues.at(-1).code, "thread_list_repeat_order_changed");
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
