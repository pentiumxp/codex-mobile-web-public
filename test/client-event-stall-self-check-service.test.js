"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const service = require("../services/runtime/client-event-stall-self-check-service");
const adapter = require("../adapters/client-event-stall-self-check-service");
const {
  defaultLogCandidates,
  parseClientEventLine,
  runtimeCheckFromClientEventSummary,
  summarizeClientEventLog,
  summarizeClientEventText,
} = service;

test("client-event stall adapter re-exports canonical runtime service", () => {
  assert.equal(adapter.parseClientEventLine, service.parseClientEventLine);
  assert.equal(adapter.summarizeClientEventText, service.summarizeClientEventText);
});

test("client-event stall self-check prefers bounded mobile log before launchd stdout fallback", () => {
  const candidates = defaultLogCandidates({}, "/tmp/codex-home");

  assert.ok(candidates.indexOf("/tmp/codex-home/.codex-mobile-web/logs/mobile-web.log")
    < candidates.indexOf("/tmp/codex-home/.codex-mobile-web/logs/codex-mobile-web.out.log"));
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

test("client-event stall self-check keeps passive heartbeat rAF pauses advisory", () => {
  const text = [
    '[client-event] thread_list_runtime_stall {"ts":"2026-06-29T17:40:00.000Z","details":{"action":"thread-list-heartbeat","maxRafDelayMs":11155,"maxScrollApplyMs":0,"maxLongTaskMs":0,"longTaskCount":0,"threadListCount":49,"threadListVisible":true,"threadListMonitorable":true}}',
    '[client-event] thread_list_runtime_stall {"ts":"2026-06-29T17:40:15.000Z","details":{"action":"thread-list-heartbeat","recentThreadListInput":true,"recentInputAgeMs":450,"maxRafDelayMs":3400,"maxScrollApplyMs":0,"maxLongTaskMs":0,"threadListCount":49}}',
  ].join("\n");

  const summary = summarizeClientEventText(text, {
    minStallMs: 1000,
    h2ThresholdMs: 3000,
    nowMs: Date.parse("2026-06-29T17:40:20.000Z"),
    windowMs: 30 * 60 * 1000,
  });

  assert.equal(summary.ok, false);
  assert.equal(summary.issueCount, 2);
  assert.equal(summary.blockingIssueCount, 1);
  assert.equal(summary.issues[0].severity, "H3");
  assert.equal(summary.issues[0].code, "browser_thread_list_runtime_heartbeat_delayed");
  assert.equal(summary.issues[0].counts.passive_heartbeat, 1);
  assert.equal(summary.issues[1].severity, "H2");
  assert.equal(summary.issues[1].code, "browser_thread_list_interaction_blocked");
  assert.equal(summary.issues[1].counts.recent_thread_list_input, 1);
  assert.equal(summary.sampleSummary.h2StallEventCount, 1);
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

test("client-event stall self-check blocks repeated active thread detail full renders", () => {
  const text = [
    '[client-event] thread_refresh_ms {"ts":"2026-07-02T01:29:00.000Z","threadId":"private-thread","details":{"status":"active","readMode":"projection-active-overlay","clientTimings":{"refreshRenderAction":"full-render","renderPlanReason":"signature-changed","renderElapsedMs":14}}}',
    '[client-event] thread_refresh_ms {"ts":"2026-07-02T01:29:04.000Z","threadId":"private-thread","details":{"status":"active","readMode":"projection-active-overlay","clientTimings":{"refreshRenderAction":"full-render","renderPlanReason":"signature-changed","renderElapsedMs":18}}}',
  ].join("\n");

  const summary = summarizeClientEventText(text, {
    nowMs: Date.parse("2026-07-02T01:29:10.000Z"),
    windowMs: 30 * 60 * 1000,
  });

  assert.equal(summary.ok, false);
  assert.equal(summary.blockingIssueCount, 1);
  assert.equal(summary.sampleSummary.activeDetailFullRenderEventCount, 2);
  assert.equal(summary.issues[0].severity, "H2");
  assert.equal(summary.issues[0].code, "browser_active_thread_detail_full_render");
  assert.equal(summary.issues[0].counts.max_render_elapsed_ms, 18);
  assert.doesNotMatch(JSON.stringify(summary), /private-thread/);
});

test("client-event stall self-check keeps one active thread detail full render advisory", () => {
  const text = '[client-event] thread_refresh_ms {"ts":"2026-07-02T01:29:00.000Z","details":{"status":"active","readMode":"projection-active-overlay","clientTimings":{"refreshRenderAction":"full-render","renderPlanReason":"signature-changed"}}}';
  const summary = summarizeClientEventText(text, {
    nowMs: Date.parse("2026-07-02T01:29:10.000Z"),
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.issueCount, 1);
  assert.equal(summary.blockingIssueCount, 0);
  assert.equal(summary.issues[0].severity, "H3");
});

test("client-event stall self-check does not classify shell patch renders as full renders", () => {
  const text = [
    '[client-event] thread_refresh_ms {"ts":"2026-07-02T01:29:00.000Z","details":{"status":"active","readMode":"projection-active-overlay","clientTimings":{"refreshRenderAction":"shell-patch-render","renderPlanReason":"signature-changed","renderElapsedMs":14}}}',
    '[client-event] thread_refresh_ms {"ts":"2026-07-02T01:29:04.000Z","details":{"status":"active","readMode":"projection-active-overlay","clientTimings":{"refreshRenderAction":"shell-patch-render","renderPlanReason":"signature-changed","renderElapsedMs":18}}}',
  ].join("\n");
  const summary = summarizeClientEventText(text, {
    nowMs: Date.parse("2026-07-02T01:29:10.000Z"),
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.issueCount, 0);
  assert.equal(summary.sampleSummary.activeDetailFullRenderEventCount, 0);
});

test("client-event stall self-check uses a short default active detail window", () => {
  const text = [
    '[client-event] thread_refresh_ms {"ts":"2026-07-02T01:29:00.000Z","details":{"status":"active","readMode":"projection-active-overlay","clientTimings":{"refreshRenderAction":"full-render","renderPlanReason":"signature-changed"}}}',
    '[client-event] thread_refresh_ms {"ts":"2026-07-02T01:29:04.000Z","details":{"status":"active","readMode":"projection-active-overlay","clientTimings":{"refreshRenderAction":"full-render","renderPlanReason":"signature-changed"}}}',
  ].join("\n");
  const summary = summarizeClientEventText(text, {
    nowMs: Date.parse("2026-07-02T01:35:00.000Z"),
    windowMs: 30 * 60 * 1000,
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.issueCount, 0);
  assert.equal(summary.sampleSummary.activeDetailFullRenderEventCount, 0);
  assert.equal(summary.sampleSummary.outOfWindowActiveDetailFullRenderEventCount, 2);
});

test("client-event stall self-check blocks conversation patch fallbacks", () => {
  const text = [
    '[client-event] conversation_render_ms {"ts":"2026-07-02T01:29:00.000Z","details":{"clientBuildId":"0.1.11|build-a","domUpdateAction":"set-inner-html","patchFallbackApplied":true,"patchRejectReason":"post-apply-duplicate-user-messages","updateReason":"signature-changed"}}',
  ].join("\n");

  const summary = summarizeClientEventText(text, {
    nowMs: Date.parse("2026-07-02T01:29:10.000Z"),
  });

  assert.equal(summary.ok, false);
  assert.equal(summary.blockingIssueCount, 1);
  assert.equal(summary.sampleSummary.conversationPatchFallbackEventCount, 1);
  assert.equal(summary.issues[0].code, "browser_conversation_patch_fallback");
  assert.equal(summary.issues[0].reason, "post-apply-duplicate-user-messages");
  assert.equal(summary.issues[0].updateReason, "signature-changed");
  assert.equal(summary.issues[0].clientBuildId, "0.1.11_build-a");
});

test("client-event deploy self-check ignores conversation patch fallbacks before gate start", () => {
  const text = [
    '[client-event] conversation_patch_html_fallback {"ts":"2026-07-02T01:28:59.900Z","details":{"clientBuildId":"0.1.11|old-build","reason":"post-apply-duplicate-user-messages","updateReason":"signature-changed"}}',
    '[client-event] conversation_render_ms {"ts":"2026-07-02T01:29:00.200Z","details":{"clientBuildId":"0.1.11|new-build","domUpdateAction":"patch-html","patchFallbackApplied":false}}',
  ].join("\n");

  const summary = summarizeClientEventText(text, {
    nowMs: Date.parse("2026-07-02T01:29:10.000Z"),
    notBeforeMs: Date.parse("2026-07-02T01:29:00.000Z"),
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.blockingIssueCount, 0);
  assert.equal(summary.sampleSummary.conversationPatchFallbackEventCount, 0);
  assert.equal(summary.sampleSummary.outOfWindowConversationPatchFallbackEventCount, 1);
  assert.equal(summary.sampleSummary.notBeforeMs, Date.parse("2026-07-02T01:29:00.000Z"));
});

test("client-event deploy self-check still blocks conversation patch fallbacks after gate start", () => {
  const text = [
    '[client-event] conversation_patch_html_fallback {"ts":"2026-07-02T01:29:00.200Z","details":{"clientBuildId":"0.1.11|new-build","reason":"patch-html-failed","updateReason":"signature-changed"}}',
  ].join("\n");

  const summary = summarizeClientEventText(text, {
    nowMs: Date.parse("2026-07-02T01:29:10.000Z"),
    notBeforeMs: Date.parse("2026-07-02T01:29:00.000Z"),
  });

  assert.equal(summary.ok, false);
  assert.equal(summary.blockingIssueCount, 1);
  assert.equal(summary.sampleSummary.conversationPatchFallbackEventCount, 1);
  assert.equal(summary.issues[0].code, "browser_conversation_patch_fallback");
  assert.equal(summary.issues[0].clientBuildId, "0.1.11_new-build");
});

test("client-event stall self-check blocks early shell DOM drops after nonempty render", () => {
  const text = [
    '[client-event] conversation_render_ms {"ts":"2026-07-02T01:29:00.000Z","details":{"source":"single-thread-early-shell","domUpdateAction":"set-inner-html","updateReason":"signature-changed","previousChildCount":12,"childCount":1,"htmlChars":150,"sameThreadRender":true,"threadHash":"h_thread","previousRenderedThreadHash":"h_thread"}}',
  ].join("\n");

  const summary = summarizeClientEventText(text, {
    nowMs: Date.parse("2026-07-02T01:29:10.000Z"),
  });

  assert.equal(summary.ok, false);
  assert.equal(summary.blockingIssueCount, 1);
  assert.equal(summary.sampleSummary.conversationDomDropEventCount, 1);
  assert.equal(summary.issues.some((issue) => issue.code === "browser_conversation_render_dom_drop"), true);
  const issue = summary.issues.find((item) => item.code === "browser_conversation_render_dom_drop");
  assert.equal(issue.severity, "H2");
  assert.equal(issue.counts.previous_child_count, 12);
  assert.equal(issue.counts.child_count, 1);
  assert.doesNotMatch(JSON.stringify(summary), /thread-secret|private/);
});

test("client-event stall self-check ignores cross-thread early shell DOM drops", () => {
  const text = [
    '[client-event] conversation_render_ms {"ts":"2026-07-02T01:29:00.000Z","details":{"source":"single-thread-early-shell","domUpdateAction":"set-inner-html","updateReason":"signature-changed","previousChildCount":12,"childCount":1,"htmlChars":150,"sameThreadRender":false,"threadHash":"h_next","previousRenderedThreadHash":"h_previous"}}',
  ].join("\n");

  const summary = summarizeClientEventText(text, {
    nowMs: Date.parse("2026-07-02T01:29:10.000Z"),
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.blockingIssueCount, 0);
  assert.equal(summary.sampleSummary.conversationDomDropEventCount, 0);
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
