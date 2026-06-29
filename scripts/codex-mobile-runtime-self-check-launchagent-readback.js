#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  DEFAULT_INTERVAL_SECONDS,
  DEFAULT_LABEL,
  DEFAULT_MAX_EVENT_AGE_MS,
  classifyRuntimeSelfCheckLaunchAgent,
  parseLaunchctlPrint,
  parseLatestRuntimeSelfCheckEvent,
  summarizeLatestEvent,
  summarizeLaunchAgentPlist,
} = require("../adapters/runtime-self-check-launchagent-service");

function usage() {
  return [
    "Usage:",
    "  node scripts/codex-mobile-runtime-self-check-launchagent-readback.js [options]",
    "",
    "Reads metadata-only macOS LaunchAgent state for Codex Mobile runtime self-checks.",
    "It does not install, unload, kickstart, or mutate launchd state.",
    "",
    "Options:",
    "  --label <label>             LaunchAgent label. Default: com.hermesmobile.codex-mobile-runtime-self-check",
    "  --plist <path>              LaunchAgent plist path. Default: ~/Library/LaunchAgents/<label>.plist",
    "  --log <path>                Runtime self-check JSONL path. Default: ~/.codex-mobile-web/logs/runtime-self-check.jsonl",
    "  --script <path>             Expected runtime self-check loop script path. Default: production plugin script path.",
    "  --output <path>             Expected JSONL output path inside plist. Default: same as --log.",
    "  --server <url>              Expected server arg. Default: http://127.0.0.1:8787",
    "  --interval-seconds <n>      Expected StartInterval. Default: 600.",
    "  --max-age-ms <n>            Latest event age threshold. Default: 1200000.",
    "  --domain <domain>           launchctl domain. Default: gui/<uid>.",
    "  --json                      Print JSON only.",
    "  --help                      Show this help.",
  ].join("\n");
}

function positiveInt(value, fallback, max = 2147483647) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(max, Math.trunc(number));
}

function defaultProductionRoot() {
  return "/Users/hermes-host/HermesMobile/plugins/codex-mobile-web";
}

function defaultLogPath() {
  return path.join(os.homedir(), ".codex-mobile-web", "logs", "runtime-self-check.jsonl");
}

function defaultPlistPath(label = DEFAULT_LABEL) {
  return path.join(os.homedir(), "Library", "LaunchAgents", `${label}.plist`);
}

function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const label = env.CODEX_MOBILE_RUNTIME_SELF_CHECK_LAUNCHAGENT_LABEL || DEFAULT_LABEL;
  const logPath = env.CODEX_MOBILE_RUNTIME_SELF_CHECK_LOG || defaultLogPath();
  const options = {
    label,
    plistPath: env.CODEX_MOBILE_RUNTIME_SELF_CHECK_LAUNCHAGENT_PLIST || defaultPlistPath(label),
    logPath,
    expectedOutputPath: env.CODEX_MOBILE_RUNTIME_SELF_CHECK_LAUNCHAGENT_OUTPUT || logPath,
    scriptPath: env.CODEX_MOBILE_RUNTIME_SELF_CHECK_SCRIPT
      || path.join(defaultProductionRoot(), "scripts", "codex-mobile-runtime-self-check-loop.js"),
    server: env.CODEX_MOBILE_BASE_URL || "http://127.0.0.1:8787",
    intervalSeconds: positiveInt(env.CODEX_MOBILE_RUNTIME_SELF_CHECK_INTERVAL_SECONDS || String(DEFAULT_INTERVAL_SECONDS), DEFAULT_INTERVAL_SECONDS, 86400),
    maxAgeMs: positiveInt(env.CODEX_MOBILE_RUNTIME_SELF_CHECK_MAX_AGE_MS || String(DEFAULT_MAX_EVENT_AGE_MS), DEFAULT_MAX_EVENT_AGE_MS, 24 * 60 * 60 * 1000),
    domain: env.CODEX_MOBILE_RUNTIME_SELF_CHECK_LAUNCHD_DOMAIN || `gui/${process.getuid ? process.getuid() : ""}`,
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
    else if (arg === "--label") {
      options.label = next();
      if (!argv.includes("--plist")) options.plistPath = defaultPlistPath(options.label);
    } else if (arg === "--plist") options.plistPath = next();
    else if (arg === "--log") {
      options.logPath = next();
      if (!argv.includes("--output")) options.expectedOutputPath = options.logPath;
    } else if (arg === "--script") options.scriptPath = next();
    else if (arg === "--output") options.expectedOutputPath = next();
    else if (arg === "--server") options.server = next();
    else if (arg === "--interval-seconds") options.intervalSeconds = positiveInt(next(), options.intervalSeconds, 86400);
    else if (arg === "--max-age-ms") options.maxAgeMs = positiveInt(next(), options.maxAgeMs, 24 * 60 * 60 * 1000);
    else if (arg === "--domain") options.domain = next();
    else if (arg === "--json") options.json = true;
    else throw new Error(`unknown option: ${arg}`);
  }
  return options;
}

function boundedErrorCode(value) {
  return String(value || "readback_failed")
    .replace(/[^a-z0-9_.:-]+/gi, "_")
    .slice(0, 100) || "readback_failed";
}

function readPlist(plistPath, deps = {}) {
  const existsSync = deps.existsSync || fs.existsSync;
  if (!plistPath || !existsSync(plistPath)) return {};
  const execFileSync = deps.execFileSync || childProcess.execFileSync;
  const text = execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", plistPath], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  return JSON.parse(text || "{}");
}

function readLaunchctl(domain, label, deps = {}) {
  const execFileSync = deps.execFileSync || childProcess.execFileSync;
  try {
    return execFileSync("/bin/launchctl", ["print", `${domain}/${label}`], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (_) {
    return "";
  }
}

function readTailText(filePath, maxBytes = 1024 * 1024) {
  if (!filePath || !fs.existsSync(filePath)) return "";
  const stat = fs.statSync(filePath);
  const size = Math.max(0, Number(stat.size || 0));
  const length = Math.min(size, maxBytes);
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, buffer, 0, length, Math.max(0, size - length));
  } finally {
    fs.closeSync(fd);
  }
  return buffer.toString("utf8");
}

function buildReadback(options = {}, deps = {}) {
  const plistRaw = readPlist(options.plistPath, deps);
  const launchctlRaw = readLaunchctl(options.domain, options.label, deps);
  const logTail = deps.readTailText ? deps.readTailText(options.logPath) : readTailText(options.logPath);
  const latestRaw = parseLatestRuntimeSelfCheckEvent(logTail);
  const expected = {
    label: options.label,
    scriptPath: options.scriptPath,
    outputPath: options.expectedOutputPath,
    server: options.server,
    intervalSeconds: options.intervalSeconds,
    maxEventAgeMs: options.maxAgeMs,
  };
  const plist = summarizeLaunchAgentPlist(plistRaw, expected);
  const launchctl = parseLaunchctlPrint(launchctlRaw);
  const latestEvent = summarizeLatestEvent(latestRaw, deps.nowMs || Date.now());
  const gate = classifyRuntimeSelfCheckLaunchAgent({ plist, launchctl, latestEvent, expected });
  return {
    privacy: "metadata_only",
    ok: gate.ok,
    label: options.label,
    plist,
    launchctl,
    latestEvent,
    gate,
  };
}

function main() {
  const options = parseArgs();
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const result = buildReadback(options);
  if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else process.stdout.write(`${result.ok ? "ok" : "failed"}\n`);
  if (!result.ok) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${boundedErrorCode(error && error.message)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildReadback,
  parseArgs,
  readTailText,
};
