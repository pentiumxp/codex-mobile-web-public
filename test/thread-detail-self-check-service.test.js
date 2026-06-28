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
  assert.equal(blocking.ok, false);
  assert.equal(blocking.blockingIssueCount, 1);
});

test("self check summary deduplicates repeated issue metadata", () => {
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
});

test("timestamp self check uses UUIDv7 turn fallback", () => {
  const timestamp = itemTimestampMs(
    { id: "a1", type: "agentMessage" },
    { id: TURN_ID, status: "completed" },
    {},
  );

  assert.equal(timestamp, 1782623676873);
});
