#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  classifyRuntimeSelfCheckGate,
} = require("../services/runtime/runtime-self-check-gate-service");
const {
  defaultBrowserModeForGate,
  normalizeBrowserMode,
  resolveRuntimeSelfCheckPlan,
  runtimeSelfCheckJob,
} = require("../services/runtime/runtime-job-scheduler-service");
const {
  runtimeCheckFromClientEventSummary,
  summarizeClientEventLog,
} = require("../services/runtime/client-event-stall-self-check-service");
const {
  collectRuntimeProcessPressure,
} = require("../services/runtime/runtime-process-pressure-service");

const DEFAULT_SERVER = "http://127.0.0.1:8787";
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;
const CHILD_SELF_CHECK_TIMEOUT_MS = 300000;

function usage() {
  return [
    "Usage:",
    "  node scripts/codex-mobile-runtime-self-check-loop.js [options]",
    "",
    "Runs metadata-only Codex Mobile runtime self-checks. Default is one pass.",
    "Periodic mode defaults to process pressure plus client-event checks only",
    "so the resident LaunchAgent does not create recurring API/browser load.",
    "",
    "Options:",
    "  --server <url>          Codex Mobile server. Default: http://127.0.0.1:8787",
    "  --thread-id <id>        Thread id to target. Repeatable.",
    "  --sample-threads <n>    Browser sample thread count when no id is passed. Default: 3.",
    "  --browser-rounds <n>    Browser switch/sample rounds. Default: 5.",
    "  --browser-sample-delays-ms <csv> Browser delays after each switch. Default: 100,350,1200,2800,6000.",
    "  --browser-min-settled-delay-ms <n> Browser downgrade H2 threshold. Default: 1000.",
    "  --browser-startup-only Run only listener/static shell/browser startup smoke for browser job.",
    "                         Deploy gates also run Vite preview artifact, app-preview, and app-preview embed startup smokes as separate browser jobs.",
    "                         Without this flag, the app-preview job runs full read-only thread UX sampling.",
    "  --browser-exercise-submit Enable browser Composer submit exercise with a short OK-only prompt.",
    "  --browser-submit-thread-id <id> Optional target thread for submit exercise. Defaults to first selected thread.",
    "  --browser-submit-message <text> Submit exercise message. Default asks for OK only.",
    "  --browser-submit-sample-delays-ms <csv> Submit exercise sample delays. Default: 100,350,900,1600,2800,6000.",
    "  --browser-mode <off|full> Browser check mode. Default: off for periodic, full for deploy.",
    "  --gate-mode <mode>     Gate mode label for output. Default: periodic.",
    "  --interval-ms <n>       Loop interval. Default: 600000.",
    "  --iterations <n>        Maximum loop iterations. Default: unlimited with --loop, 1 otherwise.",
    "  --loop                  Continue periodically instead of running once.",
    "  --skip-api              Skip API/thread detail self-check.",
    "  --skip-browser          Skip real-browser DOM self-check.",
    "  --skip-client-events    Skip recent client-event stall log self-check.",
    "  --client-event-log <path> Client-event log path. Default: known runtime log candidates.",
    "  --client-event-tail-bytes <n> Bytes to read from the end of the client-event log. Default: 524288.",
    "  --client-event-max-lines <n> Max client-event log lines to inspect. Default: 5000.",
    "  --client-event-window-ms <n> Max age for timestamped client-event stalls. Default: 1800000.",
    "  --output <path>         JSONL output path. Default: ~/.codex-mobile-web/logs/runtime-self-check.jsonl",
    "  --json                  Print the final/latest event as JSON.",
    "  --help                  Show this help.",
  ].join("\n");
}

function positiveInt(value, fallback, max = 2147483647) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(max, Math.trunc(number));
}

function defaultOutputPath() {
  return path.join(os.homedir(), ".codex-mobile-web", "logs", "runtime-self-check.jsonl");
}

function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    server: env.CODEX_MOBILE_BASE_URL || DEFAULT_SERVER,
    threadIds: [],
    sampleThreads: positiveInt(env.CODEX_MOBILE_RUNTIME_SELF_CHECK_SAMPLE_THREADS || "3", 3, 20),
    browserRounds: positiveInt(env.CODEX_MOBILE_RUNTIME_BROWSER_ROUNDS || "5", 5, 20),
    browserSampleDelaysMs: String(env.CODEX_MOBILE_RUNTIME_BROWSER_SAMPLE_DELAYS_MS || "100,350,1200,2800,6000"),
    browserMinSettledDelayMs: positiveInt(env.CODEX_MOBILE_RUNTIME_BROWSER_MIN_SETTLED_DELAY_MS || "1000", 1000, 10000),
    browserStartupOnly: /^(1|true|yes)$/i.test(String(env.CODEX_MOBILE_RUNTIME_BROWSER_STARTUP_ONLY || "")),
    browserExerciseSubmit: /^(1|true|yes)$/i.test(String(env.CODEX_MOBILE_RUNTIME_BROWSER_EXERCISE_SUBMIT || "")),
    browserSubmitThreadId: String(env.CODEX_MOBILE_RUNTIME_BROWSER_SUBMIT_THREAD_ID || "").trim(),
    browserSubmitMessage: String(env.CODEX_MOBILE_RUNTIME_BROWSER_SUBMIT_MESSAGE || "").slice(0, 500),
    browserSubmitSampleDelaysMs: String(env.CODEX_MOBILE_RUNTIME_BROWSER_SUBMIT_SAMPLE_DELAYS_MS || "100,350,900,1600,2800,6000"),
    browserMode: normalizeBrowserMode(env.CODEX_MOBILE_RUNTIME_SELF_CHECK_BROWSER_MODE || ""),
    gateMode: String(env.CODEX_MOBILE_RUNTIME_SELF_CHECK_GATE_MODE || "periodic").trim() || "periodic",
    intervalMs: positiveInt(env.CODEX_MOBILE_RUNTIME_SELF_CHECK_INTERVAL_MS || String(DEFAULT_INTERVAL_MS), DEFAULT_INTERVAL_MS),
    iterations: 1,
    loop: false,
    skipApi: false,
    skipBrowser: false,
    skipClientEvents: /^(1|true|yes)$/i.test(String(env.CODEX_MOBILE_RUNTIME_SELF_CHECK_SKIP_CLIENT_EVENTS || "")),
    clientEventLog: String(env.CODEX_MOBILE_CLIENT_EVENT_LOG || "").trim(),
    clientEventTailBytes: positiveInt(env.CODEX_MOBILE_CLIENT_EVENT_TAIL_BYTES || "524288", 512 * 1024, 64 * 1024 * 1024),
    clientEventMaxLines: positiveInt(env.CODEX_MOBILE_CLIENT_EVENT_MAX_LINES || "5000", 5000, 100000),
    clientEventWindowMs: positiveInt(env.CODEX_MOBILE_CLIENT_EVENT_WINDOW_MS || "1800000", 30 * 60 * 1000, 30 * 24 * 60 * 60 * 1000),
    output: env.CODEX_MOBILE_RUNTIME_SELF_CHECK_LOG || defaultOutputPath(),
    json: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`missing value for ${arg}`);
      return argv[index];
    };
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--server") options.server = next();
    else if (arg === "--thread-id") options.threadIds.push(next());
    else if (arg === "--sample-threads") options.sampleThreads = positiveInt(next(), options.sampleThreads, 20);
    else if (arg === "--browser-rounds") options.browserRounds = positiveInt(next(), options.browserRounds, 20);
    else if (arg === "--browser-sample-delays-ms") options.browserSampleDelaysMs = next();
    else if (arg === "--browser-min-settled-delay-ms") options.browserMinSettledDelayMs = positiveInt(next(), options.browserMinSettledDelayMs, 10000);
    else if (arg === "--browser-startup-only") options.browserStartupOnly = true;
    else if (arg === "--browser-exercise-submit") options.browserExerciseSubmit = true;
    else if (arg === "--browser-submit-thread-id") options.browserSubmitThreadId = next();
    else if (arg === "--browser-submit-message") options.browserSubmitMessage = next().slice(0, 500);
    else if (arg === "--browser-submit-sample-delays-ms") options.browserSubmitSampleDelaysMs = next();
    else if (arg === "--browser-mode") options.browserMode = normalizeBrowserMode(next(), "full");
    else if (arg === "--gate-mode") options.gateMode = next();
    else if (arg === "--interval-ms") options.intervalMs = positiveInt(next(), options.intervalMs);
    else if (arg === "--iterations") options.iterations = positiveInt(next(), options.iterations, 1000000);
    else if (arg === "--loop") options.loop = true;
    else if (arg === "--skip-api") options.skipApi = true;
    else if (arg === "--skip-browser") options.skipBrowser = true;
    else if (arg === "--skip-client-events") options.skipClientEvents = true;
    else if (arg === "--client-event-log") options.clientEventLog = next();
    else if (arg === "--client-event-tail-bytes") options.clientEventTailBytes = positiveInt(next(), options.clientEventTailBytes, 64 * 1024 * 1024);
    else if (arg === "--client-event-max-lines") options.clientEventMaxLines = positiveInt(next(), options.clientEventMaxLines, 100000);
    else if (arg === "--client-event-window-ms") options.clientEventWindowMs = positiveInt(next(), options.clientEventWindowMs, 30 * 24 * 60 * 60 * 1000);
    else if (arg === "--output") options.output = next();
    else if (arg === "--json") options.json = true;
    else throw new Error(`unknown option: ${arg}`);
  }
  options.threadIds = options.threadIds.map((id) => String(id || "").trim()).filter(Boolean);
  if (options.loop && !argv.includes("--iterations")) options.iterations = 0;
  options.browserMode = defaultBrowserModeForGate(options.gateMode, options.browserMode);
  return options;
}

function boundedErrorCode(value) {
  return String(value || "self_check_failed")
    .replace(/[^a-z0-9_.:-]+/gi, "_")
    .slice(0, 80) || "self_check_failed";
}

function runNodeScript(scriptPath, args = [], deps = {}, job = {}) {
  const runner = deps.execFile || childProcess.execFile;
  const timeout = positiveInt(job.timeoutMs, CHILD_SELF_CHECK_TIMEOUT_MS);
  return new Promise((resolve) => {
    runner(process.execPath, [scriptPath, ...args], {
      cwd: path.resolve(__dirname, ".."),
      timeout,
      maxBuffer: 16 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      let parsed = null;
      const stdoutText = String(stdout || "").trim();
      try {
        parsed = stdoutText ? JSON.parse(stdoutText) : null;
      } catch (_) {
        parsed = null;
      }
      const hasReport = Boolean(parsed && typeof parsed === "object");
      resolve({
        ok: hasReport && parsed.ok !== false,
        errorCode: error && !hasReport ? boundedErrorCode(error.message || stderr) : "",
        report: parsed,
      });
    });
  });
}

function publicConfigFromReport(report = {}) {
  return report.publicConfig || report.config || {};
}

function summarizeCheck(name, result = {}) {
  const report = result.report || {};
  const browserReport = report.browserReport || {};
  const summary = report.summary || browserReport || {};
  const config = publicConfigFromReport(report);
  const issues = Array.isArray(summary.issues)
    ? summary.issues
    : (Array.isArray(browserReport.issues) ? browserReport.issues : []);
  const diagnosticCandidates = Array.isArray(summary.diagnosticCandidates)
    ? summary.diagnosticCandidates
    : [];
  return {
    name,
    ok: Boolean(result.ok),
    issueCount: Number(summary.issueCount || browserReport.issueCount || 0) || 0,
    blockingIssueCount: Number(summary.blockingIssueCount || browserReport.blockingIssueCount || 0) || 0,
    diagnosticCandidateCount: Number(summary.diagnosticCandidateCount || 0) || 0,
    clientBuildId: String(config.clientBuildId || "").slice(0, 120),
    shellCacheName: String(config.shellCacheName || "").slice(0, 120),
    errorCode: result.errorCode || "",
    issues: issues.slice(0, 50),
    diagnosticCandidates: diagnosticCandidates.slice(0, 50),
  };
}

function appendJsonLine(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function baseArgs(options = {}) {
  const args = ["--server", options.server || DEFAULT_SERVER, "--json"];
  for (const id of options.threadIds || []) args.push("--thread-id", id);
  return args;
}

async function runOnce(options = {}, deps = {}) {
  const startedAt = new Date().toISOString();
  const checks = [];
  const jobPlan = resolveRuntimeSelfCheckPlan(options);
  const root = path.resolve(__dirname, "..");
  const apiJob = runtimeSelfCheckJob(jobPlan, "api-thread");
  if (apiJob && apiJob.enabled) {
    const result = await runNodeScript(path.join(root, "scripts", "codex-mobile-thread-self-check.js"), baseArgs(options), deps, apiJob);
    checks.push(summarizeCheck("api-thread", result));
  }
  const browserJob = runtimeSelfCheckJob(jobPlan, "browser-runtime");
  const browserScript = path.join(root, "scripts", "codex-mobile-browser-runtime-self-check.js");
  if (browserJob && browserJob.enabled) {
    const browserArgs = baseArgs(options).concat([
      "--sample-threads",
      String(positiveInt(options.sampleThreads, 3, 20)),
      "--rounds",
      String(positiveInt(options.browserRounds, 5, 20)),
      "--sample-delays-ms",
      String(options.browserSampleDelaysMs || "100,350,1200,2800,6000"),
      "--min-settled-delay-ms",
      String(positiveInt(options.browserMinSettledDelayMs, 1000, 10000)),
    ]);
    if (options.browserStartupOnly) browserArgs.push("--startup-only");
    if (!options.browserStartupOnly && options.browserExerciseSubmit) browserArgs.push("--exercise-submit");
    if (!options.browserStartupOnly && options.browserSubmitThreadId) browserArgs.push("--submit-thread-id", options.browserSubmitThreadId);
    if (!options.browserStartupOnly && options.browserSubmitMessage) browserArgs.push("--submit-message", options.browserSubmitMessage);
    if (!options.browserStartupOnly && options.browserSubmitSampleDelaysMs) browserArgs.push("--submit-sample-delays-ms", options.browserSubmitSampleDelaysMs);
    const result = await runNodeScript(browserScript, browserArgs, deps, browserJob);
    checks.push(summarizeCheck("browser-runtime", result));
  }
  const browserVitePreviewJob = runtimeSelfCheckJob(jobPlan, "browser-vite-preview");
  if (browserVitePreviewJob && browserVitePreviewJob.enabled) {
    const vitePreviewArgs = [
      "--server",
      options.server || DEFAULT_SERVER,
      "--json",
      "--vite-preview-only",
    ];
    const result = await runNodeScript(browserScript, vitePreviewArgs, deps, browserVitePreviewJob);
    checks.push(summarizeCheck("browser-vite-preview", result));
  }
  const browserViteAppPreviewJob = runtimeSelfCheckJob(jobPlan, "browser-vite-app-preview");
  if (browserViteAppPreviewJob && browserViteAppPreviewJob.enabled) {
    const viteAppPreviewArgs = baseArgs(options);
    if (options.browserStartupOnly) {
      viteAppPreviewArgs.push("--vite-app-preview-only");
    } else {
      viteAppPreviewArgs.push(
        "--sample-threads",
        String(positiveInt(options.sampleThreads, 3, 20)),
        "--rounds",
        String(positiveInt(options.browserRounds, 5, 20)),
        "--sample-delays-ms",
        String(options.browserSampleDelaysMs || "100,350,1200,2800,6000"),
        "--min-settled-delay-ms",
        String(positiveInt(options.browserMinSettledDelayMs, 1000, 10000)),
        "--vite-app-preview-runtime",
      );
    }
    const result = await runNodeScript(browserScript, viteAppPreviewArgs, deps, browserViteAppPreviewJob);
    checks.push(summarizeCheck("browser-vite-app-preview", result));
  }
  const browserViteAppPreviewEmbedJob = runtimeSelfCheckJob(jobPlan, "browser-vite-app-preview-embed");
  if (browserViteAppPreviewEmbedJob && browserViteAppPreviewEmbedJob.enabled) {
    const viteAppPreviewEmbedArgs = [
      "--server",
      options.server || DEFAULT_SERVER,
      "--json",
      "--vite-app-preview-only",
      "--vite-app-preview-embed",
    ];
    const result = await runNodeScript(browserScript, viteAppPreviewEmbedArgs, deps, browserViteAppPreviewEmbedJob);
    checks.push(summarizeCheck("browser-vite-app-preview-embed", result));
  }
  const clientEventsJob = runtimeSelfCheckJob(jobPlan, "client-events");
  if (clientEventsJob && clientEventsJob.enabled) {
    const clientEventSummary = summarizeClientEventLog({
      logCandidates: options.clientEventLog ? [options.clientEventLog] : null,
      tailBytes: options.clientEventTailBytes,
      maxLines: options.clientEventMaxLines,
      windowMs: options.clientEventWindowMs,
    });
    checks.push(runtimeCheckFromClientEventSummary(clientEventSummary));
  }
  const event = {
    privacy: "metadata_only",
    startedAt,
    completedAt: new Date().toISOString(),
    profile: {
      browserMode: jobPlan.profile.browserMode,
      scheduler: "runtime-job-scheduler-service",
    },
    runtimeJobs: jobPlan.jobs,
    processPressure: collectRuntimeProcessPressure({ topLimit: 12 }, deps),
    checks,
  };
  event.issueCount = checks.reduce((total, check) => total + check.issueCount, 0);
  event.blockingIssueCount = checks.reduce((total, check) => total + check.blockingIssueCount, 0);
  event.diagnosticCandidateCount = checks.reduce((total, check) => total + check.diagnosticCandidateCount, 0);
  event.gate = classifyRuntimeSelfCheckGate({ checks, mode: options.gateMode });
  event.ok = event.gate.ok;
  if (options.output) appendJsonLine(options.output, event);
  return event;
}

async function runLoop(options = parseArgs(), deps = {}) {
  const events = [];
  const limit = options.loop ? Number(options.iterations || 0) : 1;
  let count = 0;
  do {
    const event = await runOnce(options, deps);
    events.push(event);
    count += 1;
    if (!options.loop) break;
    if (limit && count >= limit) break;
    await sleep(options.intervalMs);
  } while (true);
  return events[events.length - 1] || null;
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const result = await runLoop(options);
  if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else process.stdout.write(`${result && result.ok ? "ok" : "failed"}\n`);
  if (!result || !result.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${boundedErrorCode(error && error.message)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_INTERVAL_MS,
  normalizeBrowserMode,
  parseArgs,
  runLoop,
  runOnce,
  summarizeCheck,
  collectRuntimeProcessPressure,
  usage,
};
