"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const service = require("../services/runtime/client-event-stall-self-check-service");
const adapter = require("../adapters/client-event-stall-self-check-service");
const {
  parseClientEventLine,
  runtimeCheckFromClientEventSummary,
  summarizeClientEventLog,
  summarizeClientEventText,
} = service;

test("client-event stall adapter re-exports canonical runtime service", () => {
  assert.equal(adapter.parseClientEventLine, service.parseClientEventLine);
  assert.equal(adapter.summarizeClientEventText, service.summarizeClientEventText);
});

test("client-event stall self-check parses bounded client-event lines", () => {
  const line = '[client-event] thread_list_runtime_stall {"ts":"2026-06-29T17:40:00.000Z","threadId":"private-thread","path":"/private/path","details":{"maxRafDelayMs":3200,"maxScrollApplyMs":8,"maxLongTaskMs":0,"threadListCount":22},"userAgent":"private UA"}';
  const parsed = parseClientEventLine(line);

  assert.equal(parsed.event, "thread_list_runtime_stall");
  assert.equal(parsed.ts, "2026-06-29T17:40:00.000Z");
  assert.equal(parsed.details.maxRafDelayMs, 3200);
  assert.doesNotMatch(JSON.stringify(runtimeCheckFromClientEventSummary(summarizeClientEventText(line, {
    nowMs: Date.parse("2026-06-29T17:40:10.000Z"),
  }))), /private-thread|private UA|private\/path/);
});

test("client-event stall self-check reports H2 for recent severe thread-list stalls", () => {
  const text = [
    '[client-event] shell_loaded {"details":{"clientBuildId":"0.1.11|private"}}',
    '[client-event] thread_list_runtime_stall {"ts":"2026-06-29T17:40:00.000Z","threadId":"thread-secret","details":{"maxRafDelayMs":3400,"maxScrollApplyMs":140,"maxLongTaskMs":0,"longTaskCount":0,"threadListCount":18}}',
  ].join("\n");

  const summary = summarizeClientEventText(text, {
    minStallMs: 1000,
    h2ThresholdMs: 3000,
    nowMs: Date.parse("2026-06-29T17:40:10.000Z"),
    windowMs: 30 * 60 * 1000,
  });

  assert.equal(summary.ok, false);
  assert.equal(summary.issueCount, 1);
  assert.equal(summary.blockingIssueCount, 1);
  assert.equal(summary.issues[0].severity, "H2");
  assert.equal(summary.issues[0].code, "browser_thread_list_interaction_blocked");
  assert.equal(summary.sampleSummary.maxRafDelayMs, 3400);
  assert.doesNotMatch(JSON.stringify(summary), /thread-secret|private/);
});

test("client-event stall self-check keeps sub-H2 stalls advisory", () => {
  const text = '[client-event] thread_list_runtime_stall {"ts":"2026-06-29T17:40:00.000Z","details":{"maxRafDelayMs":1200,"maxScrollApplyMs":1100,"maxLongTaskMs":0,"threadListCount":5}}';
  const summary = summarizeClientEventText(text, {
    minStallMs: 1000,
    h2ThresholdMs: 3000,
    nowMs: Date.parse("2026-06-29T17:40:10.000Z"),
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.issueCount, 1);
  assert.equal(summary.blockingIssueCount, 0);
  assert.equal(summary.issues[0].severity, "H3");
});

test("client-event stall self-check ignores stale or untimed severe stalls for blocking gates", () => {
  const text = [
    '[client-event] thread_list_runtime_stall {"ts":"2026-06-29T16:00:00.000Z","details":{"maxRafDelayMs":5000}}',
    '[client-event] thread_list_runtime_stall {"details":{"maxRafDelayMs":6000}}',
    '[client-event] thread_list_runtime_stall {"ts":"2026-06-29T17:39:30.000Z","details":{"maxRafDelayMs":2800}}',
  ].join("\n");

  const summary = summarizeClientEventText(text, {
    nowMs: Date.parse("2026-06-29T17:40:00.000Z"),
    windowMs: 30 * 60 * 1000,
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.blockingIssueCount, 0);
  assert.equal(summary.issueCount, 1);
  assert.equal(summary.sampleSummary.stallEventCount, 1);
  assert.equal(summary.sampleSummary.outOfWindowStallEventCount, 1);
  assert.equal(summary.sampleSummary.untimedStallEventCount, 1);
});

test("client-event stall self-check reads only configured log tail", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-client-events-"));
  const logPath = path.join(dir, "events.log");
  fs.writeFileSync(logPath, [
    '[client-event] thread_list_runtime_stall {"ts":"2026-06-29T17:40:00.000Z","details":{"maxRafDelayMs":4000}}',
    '[client-event] thread_list_runtime_stall {"ts":"2026-06-29T17:40:01.000Z","details":{"maxLongTaskMs":4100,"longTaskCount":1}}',
  ].join("\n"), "utf8");

  const summary = summarizeClientEventLog({
    logCandidates: [logPath],
    tailBytes: 1024,
    maxLines: 10,
    nowMs: Date.parse("2026-06-29T17:40:10.000Z"),
  });

  assert.equal(summary.logAvailable, true);
  assert.equal(summary.issueCount, 2);
  assert.equal(summary.blockingIssueCount, 2);
  assert.equal(summary.sampleSummary.maxLongTaskMs, 4100);
  assert.match(summary.logPathHash, /^[a-f0-9]{16}$/);
  assert.doesNotMatch(JSON.stringify(summary), new RegExp(dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("client-event stall self-check treats missing logs as advisory coverage gap", () => {
  const summary = summarizeClientEventLog({
    logCandidates: [path.join(os.tmpdir(), "definitely-missing-client-event-log")],
  });
  const check = runtimeCheckFromClientEventSummary(summary);

  assert.equal(check.ok, true);
  assert.equal(check.issueCount, 1);
  assert.equal(check.blockingIssueCount, 0);
  assert.equal(check.issues[0].code, "client_event_log_unavailable");
});
