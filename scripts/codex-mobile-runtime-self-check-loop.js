#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_SERVER = "http://127.0.0.1:8787";
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

function usage() {
  return [
    "Usage:",
    "  node scripts/codex-mobile-runtime-self-check-loop.js [options]",
    "",
    "Runs metadata-only Codex Mobile runtime self-checks. Default is one pass.",
    "Use --loop for periodic checks, for example every 10 minutes.",
    "",
    "Options:",
    "  --server <url>          Codex Mobile server. Default: http://127.0.0.1:8787",
    "  --thread-id <id>        Thread id to target. Repeatable.",
    "  --sample-threads <n>    Browser sample thread count when no id is passed. Default: 3.",
    "  --browser-rounds <n>    Browser switch/sample rounds. Default: 5.",
    "  --browser-sample-delays-ms <csv> Browser delays after each switch. Default: 100,350,1200,2800,6000.",
    "  --browser-min-settled-delay-ms <n> Browser downgrade H2 threshold. Default: 1000.",
    "  --interval-ms <n>       Loop interval. Default: 600000.",
    "  --iterations <n>        Maximum loop iterations. Default: unlimited with --loop, 1 otherwise.",
    "  --loop                  Continue periodically instead of running once.",
    "  --skip-api              Skip API/thread detail self-check.",
    "  --skip-browser          Skip real-browser DOM self-check.",
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
    intervalMs: positiveInt(env.CODEX_MOBILE_RUNTIME_SELF_CHECK_INTERVAL_MS || String(DEFAULT_INTERVAL_MS), DEFAULT_INTERVAL_MS),
    iterations: 1,
    loop: false,
    skipApi: false,
    skipBrowser: false,
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
    else if (arg === "--interval-ms") options.intervalMs = positiveInt(next(), options.intervalMs);
    else if (arg === "--iterations") options.iterations = positiveInt(next(), options.iterations, 1000000);
    else if (arg === "--loop") options.loop = true;
    else if (arg === "--skip-api") options.skipApi = true;
    else if (arg === "--skip-browser") options.skipBrowser = true;
    else if (arg === "--output") options.output = next();
    else if (arg === "--json") options.json = true;
    else throw new Error(`unknown option: ${arg}`);
  }
  options.threadIds = options.threadIds.map((id) => String(id || "").trim()).filter(Boolean);
  if (options.loop && !argv.includes("--iterations")) options.iterations = 0;
  return options;
}

function boundedErrorCode(value) {
  return String(value || "self_check_failed")
    .replace(/[^a-z0-9_.:-]+/gi, "_")
    .slice(0, 80) || "self_check_failed";
}

function runNodeScript(scriptPath, args = [], deps = {}) {
  const runner = deps.execFile || childProcess.execFile;
  return new Promise((resolve) => {
    runner(process.execPath, [scriptPath, ...args], {
      cwd: path.resolve(__dirname, ".."),
      timeout: 180000,
      maxBuffer: 16 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      let parsed = null;
      try {
        parsed = JSON.parse(String(stdout || "{}"));
      } catch (_) {
        parsed = null;
      }
      resolve({
        ok: !error && parsed && parsed.ok !== false,
        errorCode: error ? boundedErrorCode(error.message || stderr) : "",
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
  return {
    name,
    ok: Boolean(result.ok),
    issueCount: Number(summary.issueCount || browserReport.issueCount || 0) || 0,
    blockingIssueCount: Number(summary.blockingIssueCount || browserReport.blockingIssueCount || 0) || 0,
    diagnosticCandidateCount: Number(summary.diagnosticCandidateCount || 0) || 0,
    clientBuildId: String(config.clientBuildId || "").slice(0, 120),
    shellCacheName: String(config.shellCacheName || "").slice(0, 120),
    errorCode: result.errorCode || "",
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
  const root = path.resolve(__dirname, "..");
  if (!options.skipApi) {
    const result = await runNodeScript(path.join(root, "scripts", "codex-mobile-thread-self-check.js"), baseArgs(options), deps);
    checks.push(summarizeCheck("api-thread", result));
  }
  if (!options.skipBrowser) {
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
    const result = await runNodeScript(path.join(root, "scripts", "codex-mobile-browser-runtime-self-check.js"), browserArgs, deps);
    checks.push(summarizeCheck("browser-runtime", result));
  }
  const event = {
    ok: checks.every((check) => check.ok && check.blockingIssueCount === 0),
    privacy: "metadata_only",
    startedAt,
    completedAt: new Date().toISOString(),
    checks,
  };
  event.issueCount = checks.reduce((total, check) => total + check.issueCount, 0);
  event.blockingIssueCount = checks.reduce((total, check) => total + check.blockingIssueCount, 0);
  event.diagnosticCandidateCount = checks.reduce((total, check) => total + check.diagnosticCandidateCount, 0);
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
  parseArgs,
  runLoop,
  runOnce,
  summarizeCheck,
  usage,
};
