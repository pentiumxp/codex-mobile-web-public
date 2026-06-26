"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  countThreadListRows,
  planThreadListAppServerFetch,
  threadListAppServerLatencyTimingFields,
  threadListAppServerFetchTimingFields,
} = require("../adapters/thread-list-app-server-fetch-policy-service");

test("thread-list app-server fetch policy bounds default list overfetch", () => {
  assert.deepEqual(planThreadListAppServerFetch({ limit: 40 }), {
    requestedLimit: 40,
    appServerLimit: 80,
    reason: "default-bounded-overfetch",
    overfetchFactor: 2,
    cursor: false,
    archived: false,
    hasWorkspace: false,
    hasSearch: false,
  });

  assert.deepEqual(planThreadListAppServerFetch({ limit: 80 }), {
    requestedLimit: 80,
    appServerLimit: 160,
    reason: "default-bounded-overfetch",
    overfetchFactor: 2,
    cursor: false,
    archived: false,
    hasWorkspace: false,
    hasSearch: false,
  });
});

test("thread-list app-server fetch policy keeps cursor pages exact", () => {
  assert.deepEqual(planThreadListAppServerFetch({
    limit: 80,
    cursor: "opaque-cursor",
  }), {
    requestedLimit: 80,
    appServerLimit: 80,
    reason: "cursor-page",
    overfetchFactor: 1,
    cursor: true,
    archived: false,
    hasWorkspace: false,
    hasSearch: false,
  });
});

test("thread-list app-server fetch policy preserves workspace and archived overfetch windows", () => {
  const workspacePlan = planThreadListAppServerFetch({
    limit: 40,
    cwd: "/private/workspace",
  });
  assert.equal(workspacePlan.appServerLimit, 500);
  assert.equal(workspacePlan.reason, "workspace-filter-preserve-overfetch");
  assert.equal(workspacePlan.hasWorkspace, true);

  const archivedPlan = planThreadListAppServerFetch({
    limit: 40,
    archived: true,
  });
  assert.equal(archivedPlan.appServerLimit, 500);
  assert.equal(archivedPlan.reason, "archived-preserve-overfetch");
  assert.equal(archivedPlan.archived, true);
});

test("thread-list app-server fetch policy bounds search without copying the query", () => {
  const plan = planThreadListAppServerFetch({
    limit: 30,
    searchTerm: "private query text should not be copied",
  });

  assert.equal(plan.requestedLimit, 30);
  assert.equal(plan.appServerLimit, 80);
  assert.equal(plan.reason, "search-bounded-overfetch");
  assert.equal(plan.hasSearch, true);
  assert.doesNotMatch(JSON.stringify(plan), /private query/);
});

test("thread-list app-server fetch policy normalizes limits and timing fields", () => {
  const plan = planThreadListAppServerFetch({ limit: 999 });
  assert.equal(plan.requestedLimit, 200);
  assert.equal(plan.appServerLimit, 400);

  assert.deepEqual(threadListAppServerFetchTimingFields(plan), {
    appServerRequestedLimit: 200,
    appServerRequestLimit: 400,
    appServerRequestReason: "default-bounded-overfetch",
    appServerOverfetchFactor: 2,
  });

  assert.deepEqual(threadListAppServerFetchTimingFields({
    requestedLimit: "not-a-number",
    appServerLimit: 10000,
    reason: `long-${"x".repeat(200)}`,
    overfetchFactor: 10000,
  }), {
    appServerRequestedLimit: 80,
    appServerRequestLimit: 500,
    appServerRequestReason: `long-${"x".repeat(75)}`,
    appServerOverfetchFactor: 500,
  });
});

test("thread-list app-server latency fields split rpc and local post-processing", () => {
  const fields = threadListAppServerLatencyTimingFields({
    rawResult: { data: [{ id: "private-1" }, { id: "private-2" }, { id: "private-3" }] },
    visibleResult: { data: [{ id: "private-1" }, { id: "private-2" }] },
    filteredResult: { data: [{ id: "private-1" }] },
    rpcMs: 1234,
    visibleFilterMs: 5,
    workspaceFilterMs: 7,
    privatePrompt: "do not copy",
  });

  assert.deepEqual(fields, {
    appServerRpcMs: 1234,
    appServerVisibleFilterMs: 5,
    appServerWorkspaceFilterMs: 7,
    appServerPostProcessMs: 12,
    appServerRawCount: 3,
    appServerVisibleCount: 2,
    appServerFilteredCount: 1,
  });
  assert.doesNotMatch(JSON.stringify(fields), /private|prompt/);
});

test("thread-list app-server latency fields are bounded and count data or threads arrays", () => {
  assert.equal(countThreadListRows({ data: [{}, {}] }), 2);
  assert.equal(countThreadListRows({ threads: [{}, {}, {}] }), 3);
  assert.equal(countThreadListRows([{}, {}, {}, {}]), 4);

  assert.deepEqual(threadListAppServerLatencyTimingFields({
    rawCount: 9999999,
    visibleCount: -1,
    filteredCount: "bad",
    rpcMs: 999999999,
    visibleFilterMs: -5,
    workspaceFilterMs: "bad",
  }), {
    appServerRpcMs: 600000,
    appServerVisibleFilterMs: 0,
    appServerWorkspaceFilterMs: 0,
    appServerPostProcessMs: 0,
    appServerRawCount: 100000,
    appServerVisibleCount: 0,
    appServerFilteredCount: 0,
  });
});
