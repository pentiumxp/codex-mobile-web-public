"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_TAIL_BYTES = 512 * 1024;
const DEFAULT_MAX_LINES = 5000;
const DEFAULT_MIN_STALL_MS = 1000;
const DEFAULT_H2_STALL_MS = 3000;
const DEFAULT_WINDOW_MS = 30 * 60 * 1000;
const DEFAULT_ACTIVE_DETAIL_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_ACTIVE_DETAIL_FULL_RENDER_H2_COUNT = 2;
const STALL_EVENT_NAMES = new Set([
  "thread_list_runtime_stall",
  "thread_list_interaction_stall",
]);
const THREAD_REFRESH_EVENT_NAME = "thread_refresh_ms";
const CONVERSATION_RENDER_EVENT_NAME = "conversation_render_ms";
const CONVERSATION_PATCH_FALLBACK_EVENT_NAME = "conversation_patch_html_fallback";

function safeLabel(value, fallback = "unknown", maxChars = 120) {
  const text = String(value || "").trim();
  return text.replace(/[^a-z0-9_.:-]+/gi, "_").slice(0, maxChars) || fallback;
}

function boundedCount(value, max = 1000000) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(max, Math.trunc(number));
}

function defaultLogCandidates(env = process.env, homeDir = os.homedir()) {
  const candidates = [
    env.CODEX_MOBILE_CLIENT_EVENT_LOG,
    env.CODEX_MOBILE_WEB_LOG_FILE,
    path.join(homeDir, ".codex-mobile-web", "logs", "codex-mobile-web.out.log"),
    path.join(homeDir, ".codex-mobile-web", "logs", "mobile-web.log"),
  ].map((entry) => String(entry || "").trim()).filter(Boolean);
  return [...new Set(candidates)];
}

function firstReadableFile(candidates = []) {
  for (const filePath of candidates) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.isFile()) return filePath;
    } catch (_) {}
  }
  return "";
}

function readTailText(filePath, bytes = DEFAULT_TAIL_BYTES) {
  const stat = fs.statSync(filePath);
  const length = Math.max(0, Math.min(boundedCount(bytes, 64 * 1024 * 1024), stat.size));
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const offset = stat.size - length;
    const bytesRead = fs.readSync(fd, buffer, 0, length, offset);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

function parseClientEventLine(line = "") {
  const match = String(line).match(/^\[client-event\]\s+([^\s]+)\s+(\{.*\})\s*$/);
  if (!match) return null;
  let payload = null;
  try {
    payload = JSON.parse(match[2]);
  } catch (_) {
    return null;
  }
  const details = payload && payload.details && typeof payload.details === "object" ? payload.details : {};
  return {
    event: safeLabel(match[1], "event", 120),
    ts: String(payload.ts || payload.time || payload.createdAt || "").slice(0, 80),
    details,
  };
}

function eventTimestampMs(entry = {}) {
  const ts = String(entry.ts || "").trim();
  if (!ts) return 0;
  const value = Date.parse(ts);
  return Number.isFinite(value) ? value : 0;
}

function isEntryInWindow(entry = {}, options = {}) {
  const timestampMs = eventTimestampMs(entry);
  if (!timestampMs) return false;
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const windowMs = boundedCount(options.windowMs || DEFAULT_WINDOW_MS, 30 * 24 * 60 * 60 * 1000) || DEFAULT_WINDOW_MS;
  return timestampMs <= nowMs + 60_000 && nowMs - timestampMs <= windowMs;
}

function isEntryInActiveDetailWindow(entry = {}, options = {}) {
  const windowMs = boundedCount(
    options.activeDetailWindowMs || DEFAULT_ACTIVE_DETAIL_WINDOW_MS,
    30 * 24 * 60 * 60 * 1000,
  ) || DEFAULT_ACTIVE_DETAIL_WINDOW_MS;
  return isEntryInWindow(entry, Object.assign({}, options, { windowMs }));
}

function maxDelayForDetails(details = {}) {
  return Math.max(
    boundedCount(details.maxRafDelayMs || details.max_raf_delay_ms),
    boundedCount(details.maxScrollApplyMs || details.max_scroll_apply_ms),
    boundedCount(details.maxLongTaskMs || details.max_long_task_ms),
    boundedCount(details.elapsedMs || details.elapsed_ms),
  );
}

function stallIssueFromEvent(entry = {}, options = {}) {
  const details = entry.details || {};
  const maxDelayMs = maxDelayForDetails(details);
  const h2ThresholdMs = boundedCount(options.h2ThresholdMs || DEFAULT_H2_STALL_MS) || DEFAULT_H2_STALL_MS;
  const severity = maxDelayMs >= h2ThresholdMs ? "H2" : "H3";
  const longTaskMs = boundedCount(details.maxLongTaskMs || details.max_long_task_ms);
  const rafDelayMs = boundedCount(details.maxRafDelayMs || details.max_raf_delay_ms);
  const scrollApplyMs = boundedCount(details.maxScrollApplyMs || details.max_scroll_apply_ms);
  const code = longTaskMs >= Math.max(rafDelayMs, scrollApplyMs)
    ? "browser_main_thread_long_task"
    : "browser_thread_list_interaction_blocked";
  return {
    severity,
    code,
    surface: "client-events",
    category: "thread_list_interaction_stall",
    diagnostic_type: "thread_list_interaction_stall",
    error_code: code,
    count: 1,
    counts: {
      max_delay_ms: maxDelayMs,
      raf_delay_ms: rafDelayMs,
      scroll_apply_ms: scrollApplyMs,
      long_task_ms: longTaskMs,
      long_task_count: boundedCount(details.longTaskCount || details.long_task_count),
      thread_list_count: boundedCount(details.threadListCount || details.thread_list_count),
    },
  };
}

function eventString(details = {}, key = "", fallback = "") {
  const value = details && Object.prototype.hasOwnProperty.call(details, key) ? details[key] : fallback;
  return safeLabel(value, "", 120);
}

function clientTimingsForDetails(details = {}) {
  const value = details && details.clientTimings && typeof details.clientTimings === "object"
    ? details.clientTimings
    : details && details.client_timings && typeof details.client_timings === "object"
      ? details.client_timings
      : {};
  return value && typeof value === "object" ? value : {};
}

function fieldFromDetailsOrTimings(details = {}, key = "") {
  const timings = clientTimingsForDetails(details);
  if (details && Object.prototype.hasOwnProperty.call(details, key)) return details[key];
  if (timings && Object.prototype.hasOwnProperty.call(timings, key)) return timings[key];
  return "";
}

function isActiveThreadDetailRefresh(entry = {}) {
  if (entry.event !== THREAD_REFRESH_EVENT_NAME) return false;
  const details = entry.details || {};
  const status = eventString(details, "status", "");
  const readMode = eventString(details, "readMode", "");
  return status === "active" || readMode === "projection-active-overlay";
}

function isActiveThreadFullRender(entry = {}) {
  if (!isActiveThreadDetailRefresh(entry)) return false;
  const details = entry.details || {};
  const action = safeLabel(fieldFromDetailsOrTimings(details, "refreshRenderAction"), "", 120);
  const reason = safeLabel(fieldFromDetailsOrTimings(details, "renderPlanReason"), "", 120);
  return action === "full-render" && (reason === "signature-changed" || !reason);
}

function isConversationPatchFallback(entry = {}) {
  if (entry.event === CONVERSATION_PATCH_FALLBACK_EVENT_NAME) return true;
  if (entry.event !== CONVERSATION_RENDER_EVENT_NAME) return false;
  const details = entry.details || {};
  const action = safeLabel(details.domUpdateAction || details.dom_update_action, "", 120);
  return details.patchFallbackApplied === true
    || details.patch_fallback_applied === true
    || action === "set-inner-html";
}

function activeThreadFullRenderIssue(entries = [], options = {}) {
  const count = boundedCount(entries.length);
  if (!count) return null;
  const h2CountThreshold = boundedCount(
    options.activeDetailFullRenderH2Count || DEFAULT_ACTIVE_DETAIL_FULL_RENDER_H2_COUNT,
    1000,
  ) || DEFAULT_ACTIVE_DETAIL_FULL_RENDER_H2_COUNT;
  const severity = count >= h2CountThreshold ? "H2" : "H3";
  const maxRenderElapsedMs = entries.reduce((max, entry) => {
    const details = entry.details || {};
    const timings = clientTimingsForDetails(details);
    return Math.max(max, boundedCount(timings.renderElapsedMs || details.renderElapsedMs || details.render_elapsed_ms));
  }, 0);
  return {
    severity,
    code: "browser_active_thread_detail_full_render",
    surface: "client-events",
    category: "thread_detail_refresh",
    diagnostic_type: "thread_detail_refresh",
    error_code: "browser_active_thread_detail_full_render",
    count,
    counts: {
      active_detail_full_render_count: count,
      max_render_elapsed_ms: maxRenderElapsedMs,
    },
  };
}

function conversationPatchFallbackIssue(entries = []) {
  const count = boundedCount(entries.length);
  if (!count) return null;
  return {
    severity: "H2",
    code: "browser_conversation_patch_fallback",
    surface: "client-events",
    category: "thread_detail_refresh",
    diagnostic_type: "thread_detail_refresh",
    error_code: "browser_conversation_patch_fallback",
    count,
    counts: {
      conversation_patch_fallback_count: count,
    },
  };
}

function summarizeClientEventText(text = "", options = {}) {
  const maxLines = boundedCount(options.maxLines || DEFAULT_MAX_LINES, 100000) || DEFAULT_MAX_LINES;
  const minStallMs = boundedCount(options.minStallMs || DEFAULT_MIN_STALL_MS) || DEFAULT_MIN_STALL_MS;
  const lines = String(text || "").split(/\r?\n/).filter(Boolean).slice(-maxLines);
  const parsed = [];
  const stalls = [];
  const activeDetailFullRenders = [];
  const conversationPatchFallbacks = [];
  let untimedStallEventCount = 0;
  let outOfWindowStallEventCount = 0;
  let outOfWindowActiveDetailFullRenderEventCount = 0;
  let outOfWindowConversationPatchFallbackEventCount = 0;
  for (const line of lines) {
    const entry = parseClientEventLine(line);
    if (!entry) continue;
    parsed.push(entry);
    const inActiveDetailWindow = eventTimestampMs(entry) && isEntryInActiveDetailWindow(entry, options);
    if (isActiveThreadFullRender(entry)) {
      if (inActiveDetailWindow) activeDetailFullRenders.push(entry);
      else outOfWindowActiveDetailFullRenderEventCount += 1;
    }
    if (isConversationPatchFallback(entry)) {
      if (inActiveDetailWindow) conversationPatchFallbacks.push(entry);
      else outOfWindowConversationPatchFallbackEventCount += 1;
    }
    if (!STALL_EVENT_NAMES.has(entry.event)) continue;
    if (maxDelayForDetails(entry.details) < minStallMs) continue;
    if (!eventTimestampMs(entry)) {
      untimedStallEventCount += 1;
      continue;
    }
    if (!isEntryInWindow(entry, options)) {
      outOfWindowStallEventCount += 1;
      continue;
    }
    stalls.push(entry);
  }
  const issues = stalls.map((entry) => stallIssueFromEvent(entry, options));
  const activeFullRenderIssue = activeThreadFullRenderIssue(activeDetailFullRenders, options);
  if (activeFullRenderIssue) issues.push(activeFullRenderIssue);
  const patchFallbackIssue = conversationPatchFallbackIssue(conversationPatchFallbacks);
  if (patchFallbackIssue) issues.push(patchFallbackIssue);
  const h2Count = issues.filter((issue) => issue.severity === "H2").length;
  const maxDelayMs = issues.reduce((max, issue) => Math.max(max, boundedCount(issue.counts && issue.counts.max_delay_ms)), 0);
  const maxRafDelayMs = issues.reduce((max, issue) => Math.max(max, boundedCount(issue.counts && issue.counts.raf_delay_ms)), 0);
  const maxScrollApplyMs = issues.reduce((max, issue) => Math.max(max, boundedCount(issue.counts && issue.counts.scroll_apply_ms)), 0);
  const maxLongTaskMs = issues.reduce((max, issue) => Math.max(max, boundedCount(issue.counts && issue.counts.long_task_ms)), 0);
  return {
    ok: h2Count === 0,
    issueCount: boundedCount(issues.length),
    blockingIssueCount: boundedCount(h2Count),
    issues: issues.slice(0, 50),
    sampleSummary: {
      scannedLineCount: boundedCount(lines.length),
      parsedClientEventCount: boundedCount(parsed.length),
      stallEventCount: boundedCount(stalls.length),
      activeDetailFullRenderEventCount: boundedCount(activeDetailFullRenders.length),
      conversationPatchFallbackEventCount: boundedCount(conversationPatchFallbacks.length),
      untimedStallEventCount: boundedCount(untimedStallEventCount),
      outOfWindowStallEventCount: boundedCount(outOfWindowStallEventCount),
      outOfWindowActiveDetailFullRenderEventCount: boundedCount(outOfWindowActiveDetailFullRenderEventCount),
      outOfWindowConversationPatchFallbackEventCount: boundedCount(outOfWindowConversationPatchFallbackEventCount),
      h2StallEventCount: boundedCount(h2Count),
      maxDelayMs,
      maxRafDelayMs,
      maxScrollApplyMs,
      maxLongTaskMs,
    },
  };
}

function summarizeClientEventLog(options = {}) {
  const candidates = Array.isArray(options.logCandidates) && options.logCandidates.length
    ? options.logCandidates
    : defaultLogCandidates(options.env || process.env, options.homeDir || os.homedir());
  const logPath = firstReadableFile(candidates);
  if (!logPath) {
    return {
      ok: true,
      issueCount: 1,
      blockingIssueCount: 0,
      issues: [{
        severity: "H3",
        code: "client_event_log_unavailable",
        surface: "client-events",
        category: "runtime_self_check_coverage",
        diagnostic_type: "client_event_log_unavailable",
        error_code: "client_event_log_unavailable",
        count: 1,
      }],
      sampleSummary: {
        scannedLineCount: 0,
        parsedClientEventCount: 0,
        stallEventCount: 0,
        activeDetailFullRenderEventCount: 0,
        conversationPatchFallbackEventCount: 0,
        untimedStallEventCount: 0,
        outOfWindowStallEventCount: 0,
        outOfWindowActiveDetailFullRenderEventCount: 0,
        outOfWindowConversationPatchFallbackEventCount: 0,
        h2StallEventCount: 0,
        maxDelayMs: 0,
        maxRafDelayMs: 0,
        maxScrollApplyMs: 0,
        maxLongTaskMs: 0,
      },
      logAvailable: false,
    };
  }
  const text = readTailText(logPath, options.tailBytes || DEFAULT_TAIL_BYTES);
  const summary = summarizeClientEventText(text, options);
  summary.logAvailable = true;
  summary.logPathHash = safeLabel(require("node:crypto").createHash("sha256").update(logPath).digest("hex").slice(0, 16), "", 16);
  return summary;
}

function runtimeCheckFromClientEventSummary(summary = {}) {
  return {
    name: "client-events",
    ok: Boolean(summary.ok),
    issueCount: boundedCount(summary.issueCount),
    blockingIssueCount: boundedCount(summary.blockingIssueCount),
    diagnosticCandidateCount: 0,
    clientBuildId: "",
    shellCacheName: "",
    errorCode: "",
    issues: Array.isArray(summary.issues) ? summary.issues.slice(0, 50) : [],
    diagnosticCandidates: [],
    sampleSummary: summary.sampleSummary || {},
    logAvailable: Boolean(summary.logAvailable),
    logPathHash: summary.logPathHash || "",
  };
}

module.exports = {
  DEFAULT_ACTIVE_DETAIL_WINDOW_MS,
  DEFAULT_H2_STALL_MS,
  DEFAULT_MAX_LINES,
  DEFAULT_MIN_STALL_MS,
  DEFAULT_TAIL_BYTES,
  DEFAULT_WINDOW_MS,
  defaultLogCandidates,
  eventTimestampMs,
  isEntryInWindow,
  parseClientEventLine,
  runtimeCheckFromClientEventSummary,
  summarizeClientEventLog,
  summarizeClientEventText,
};
