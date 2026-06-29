"use strict";

const crypto = require("node:crypto");

const DEFAULT_LABEL = "com.hermesmobile.codex-mobile-runtime-self-check";
const DEFAULT_INTERVAL_SECONDS = 600;
const DEFAULT_MAX_EVENT_AGE_MS = 20 * 60 * 1000;

function safeToken(value, fallback = "", maxLength = 120) {
  const text = String(value || "").trim();
  const safe = text.replace(/[^a-z0-9_.:-]+/gi, "_").slice(0, maxLength);
  return safe || fallback;
}

function boundedCount(value, max = 100000) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(max, Math.trunc(number));
}

function boundedMs(value, max = 24 * 60 * 60 * 1000) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(max, Math.trunc(number));
}

function shortHash(value) {
  const text = String(value || "");
  if (!text) return "";
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function pathHash(value) {
  return shortHash(String(value || "").trim());
}

function normalizeArgs(args) {
  return Array.isArray(args) ? args.map((arg) => String(arg || "")) : [];
}

function summarizeLaunchAgentPlist(plist = {}, expected = {}) {
  const args = normalizeArgs(plist.ProgramArguments);
  const scriptPath = expected.scriptPath || "";
  const outputPath = expected.outputPath || "";
  const server = expected.server || "http://127.0.0.1:8787";
  const intervalSeconds = boundedCount(expected.intervalSeconds || DEFAULT_INTERVAL_SECONDS, 86400) || DEFAULT_INTERVAL_SECONDS;
  return {
    present: Boolean(plist && typeof plist === "object" && Object.keys(plist).length),
    label: safeToken(plist.Label || "", "", 120),
    labelMatches: !expected.label || plist.Label === expected.label,
    startInterval: boundedCount(plist.StartInterval, 86400),
    startIntervalMatches: boundedCount(plist.StartInterval, 86400) === intervalSeconds,
    runAtLoad: plist.RunAtLoad === true,
    workingDirectoryHash: pathHash(plist.WorkingDirectory),
    programHash: pathHash(args[0]),
    scriptHash: pathHash(args[1]),
    scriptMatches: !scriptPath || args[1] === scriptPath,
    hasServerArg: args.includes("--server") && args.includes(server),
    hasOutputArg: args.includes("--output") && args.includes(outputPath),
    hasJsonArg: args.includes("--json"),
    hasLoopArg: args.includes("--loop"),
    argumentCount: boundedCount(args.length, 100),
  };
}

function parseLaunchctlPrint(text = "") {
  const source = String(text || "");
  const state = (source.match(/^\s*state = ([^\n]+)/m) || [])[1] || "";
  const runs = (source.match(/^\s*runs = ([0-9]+)/m) || [])[1] || "";
  const lastExitCode = (source.match(/^\s*last exit code = (-?[0-9]+)/m) || [])[1] || "";
  const runInterval = (source.match(/^\s*run interval = ([0-9]+) seconds/m) || [])[1] || "";
  const type = (source.match(/^\s*type = ([^\n]+)/m) || [])[1] || "";
  return {
    loaded: source.trim().length > 0,
    state: safeToken(state, "unknown", 40),
    type: safeToken(type, "", 40),
    runs: boundedCount(runs, 1000000),
    lastExitCode: Number.isFinite(Number(lastExitCode)) ? Number(lastExitCode) : null,
    runIntervalSeconds: boundedCount(runInterval, 86400),
  };
}

function parseLatestRuntimeSelfCheckEvent(logText = "") {
  const lines = String(logText || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(lines[index]);
      if (parsed && typeof parsed === "object") return parsed;
    } catch (_) {
      // Keep walking backward; old log fragments can contain partial lines.
    }
  }
  return null;
}

function summarizeLatestEvent(event = null, nowMs = Date.now()) {
  if (!event || typeof event !== "object") {
    return {
      present: false,
      ok: false,
      hasGate: false,
      ageMs: 0,
      issueCount: 0,
      blockingIssueCount: 0,
      reportableIssueCount: 0,
      observeOnlyIssueCount: 0,
      advisoryIssueCount: 0,
      executionFailureCount: 0,
      gateMode: "",
      deployPass: false,
      periodicHealthy: false,
      checkNames: [],
      errorCodes: [],
    };
  }
  const gate = event.gate && typeof event.gate === "object" ? event.gate : {};
  const completedAt = Date.parse(event.completedAt || event.startedAt || "");
  const ageMs = Number.isFinite(completedAt) ? Math.max(0, nowMs - completedAt) : 0;
  const checks = Array.isArray(event.checks) ? event.checks : [];
  return {
    present: true,
    ok: event.ok === true,
    hasGate: Boolean(event.gate && typeof event.gate === "object"),
    ageMs: boundedMs(ageMs),
    issueCount: boundedCount(gate.issueCount || event.issueCount),
    blockingIssueCount: boundedCount(gate.blockingIssueCount || event.blockingIssueCount),
    reportableIssueCount: boundedCount(gate.reportableIssueCount),
    observeOnlyIssueCount: boundedCount(gate.observeOnlyIssueCount),
    advisoryIssueCount: boundedCount(gate.advisoryIssueCount),
    executionFailureCount: boundedCount(gate.executionFailureCount),
    gateMode: safeToken(gate.mode || "", "", 40),
    deployPass: gate.deployPass === true,
    periodicHealthy: gate.periodicHealthy === true,
    checkNames: Array.isArray(gate.checkNames)
      ? gate.checkNames.map((name) => safeToken(name, "self-check", 80)).slice(0, 10)
      : checks.map((check) => safeToken(check && check.name, "self-check", 80)).slice(0, 10),
    errorCodes: checks.map((check) => safeToken(check && check.errorCode, "", 100)).filter(Boolean).slice(0, 10),
  };
}

function issue(code, severity = "H2") {
  return { code, severity };
}

function classifyRuntimeSelfCheckLaunchAgent(input = {}) {
  const expected = input.expected || {};
  const plist = input.plist || {};
  const launchctl = input.launchctl || {};
  const latestEvent = input.latestEvent || {};
  const maxEventAgeMs = boundedMs(expected.maxEventAgeMs || DEFAULT_MAX_EVENT_AGE_MS, 24 * 60 * 60 * 1000)
    || DEFAULT_MAX_EVENT_AGE_MS;
  const issues = [];
  const latestEventFresh = Boolean(latestEvent.present && latestEvent.ageMs <= maxEventAgeMs);
  const latestEventHealthy = Boolean(latestEventFresh
    && latestEvent.ok
    && latestEvent.hasGate
    && latestEvent.periodicHealthy
    && latestEvent.blockingIssueCount === 0
    && latestEvent.executionFailureCount === 0);

  if (!plist.present) issues.push(issue("launchagent_plist_missing"));
  if (plist.present && !plist.labelMatches) issues.push(issue("launchagent_label_mismatch"));
  if (plist.present && !plist.startIntervalMatches) issues.push(issue("launchagent_interval_mismatch", "H3"));
  if (plist.present && !plist.runAtLoad) issues.push(issue("launchagent_runatload_disabled", "H3"));
  if (plist.present && !plist.scriptMatches) issues.push(issue("launchagent_script_mismatch"));
  if (plist.present && !plist.hasOutputArg) issues.push(issue("launchagent_output_arg_missing", "H3"));
  if (plist.present && !plist.hasJsonArg) issues.push(issue("launchagent_json_arg_missing", "H3"));
  if (!launchctl.loaded) issues.push(issue("launchagent_not_loaded"));
  if (launchctl.loaded && launchctl.state !== "running" && launchctl.lastExitCode !== null && launchctl.lastExitCode !== 0) {
    issues.push(issue(
      latestEventHealthy ? "launchagent_previous_exit_nonzero_recovered" : "launchagent_last_exit_nonzero",
      latestEventHealthy ? "H3" : "H2",
    ));
  }
  if (launchctl.loaded && launchctl.state === "running" && launchctl.lastExitCode !== null && launchctl.lastExitCode !== 0) {
    issues.push(issue("launchagent_running_after_previous_failure", "H3"));
  }
  if (!latestEvent.present) issues.push(issue("runtime_self_check_latest_event_missing"));
  if (latestEvent.present && !latestEvent.hasGate) issues.push(issue("runtime_self_check_latest_event_no_gate"));
  if (latestEvent.present && latestEvent.ageMs > maxEventAgeMs) issues.push(issue("runtime_self_check_latest_event_stale"));
  if (latestEvent.present && latestEvent.hasGate && !latestEvent.periodicHealthy) {
    issues.push(issue("runtime_self_check_gate_not_healthy"));
  }

  const blockingIssues = issues.filter((entry) => entry.severity === "H1" || entry.severity === "H2");
  return {
    privacy: "metadata_only",
    ok: blockingIssues.length === 0,
    issueCount: boundedCount(issues.length),
    blockingIssueCount: boundedCount(blockingIssues.length),
    issues,
    latestEventMaxAgeMs: maxEventAgeMs,
  };
}

module.exports = {
  DEFAULT_INTERVAL_SECONDS,
  DEFAULT_LABEL,
  DEFAULT_MAX_EVENT_AGE_MS,
  classifyRuntimeSelfCheckLaunchAgent,
  parseLaunchctlPrint,
  parseLatestRuntimeSelfCheckEvent,
  summarizeLatestEvent,
  summarizeLaunchAgentPlist,
};
