#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const path = require("node:path");

const DEFAULT_SERVER = "http://127.0.0.1:8787";
const DEFAULT_SERVICE_WORKERS = "both";
const DEFAULT_QUOTA_CLICK_INTERVAL_MS = 80;
const DEFAULT_TIMEOUT_MS = 420000;

function usage() {
  return [
    "Usage:",
    "  node scripts/codex-mobile-user-behavior-check.js --submitted-thread-id <id> --quota-thread-id <id> [options]",
    "",
    "Runs the required real-browser user-behavior Harness bundle for submitted-message, quota popup, and runtime gate checks.",
    "",
    "Options:",
    "  --server <url>                  Codex Mobile server. Default: http://127.0.0.1:8787.",
    "  --submitted-thread-id <id>      Required submitted-message target. Repeatable. Accepts label:id.",
    "  --thread-id <id>                Alias for --submitted-thread-id.",
    "  --quota-thread-id <id>          Required quota popup target. Defaults to CODEX_MOBILE_USER_BEHAVIOR_QUOTA_THREAD_ID.",
    "  --runtime-submit-thread-id <id> Runtime submit-exercise target. Defaults to first submitted target.",
    "  --expect-build-hash <hash>      Require visible/config build hash in submitted-message Harness.",
    "  --service-workers <block|allow|both> Default: both.",
    "  --playwright-module-dir <dir>   Directory used to resolve Playwright for child Harnesses.",
    "  --key-file <path>               Access key file passed to browser Harnesses.",
    "  --skip-submitted / --skip-quota / --skip-runtime",
    "  --plan-only                     Print bounded command plan without running child Harnesses.",
    "  --json                          Print JSON.",
  ].join("\n");
}

function boolEnv(value) {
  return /^(1|true|yes)$/i.test(String(value || ""));
}

function normalizeServerUrl(value) {
  const text = String(value || DEFAULT_SERVER).trim() || DEFAULT_SERVER;
  return text.replace(/\/+$/, "");
}

function normalizeMode(value, allowed, fallback) {
  const text = String(value || "").trim().toLowerCase();
  return allowed.includes(text) ? text : fallback;
}

function boundedLabel(value, fallback) {
  return String(value || fallback || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || fallback;
}

function parseThreadToken(value, index = 0) {
  const text = String(value || "").trim();
  if (!text) return null;
  const separator = text.includes("=") ? "=" : (text.includes(":") ? ":" : "");
  if (!separator) return { label: `thread-${index + 1}`, id: text };
  const [rawLabel, ...rest] = text.split(separator);
  const id = rest.join(separator).trim();
  if (!id) return { label: `thread-${index + 1}`, id: text };
  return { label: boundedLabel(rawLabel, `thread-${index + 1}`), id };
}

function parseThreadList(value) {
  return String(value || "")
    .split(",")
    .map((item, index) => parseThreadToken(item, index))
    .filter(Boolean);
}

function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    server: normalizeServerUrl(env.CODEX_MOBILE_USER_BEHAVIOR_SERVER || env.CODEX_MOBILE_BASE_URL || DEFAULT_SERVER),
    submittedThreads: parseThreadList(env.CODEX_MOBILE_USER_BEHAVIOR_SUBMITTED_THREADS || env.CODEX_MOBILE_SUBMITTED_HARNESS_THREAD_ID || ""),
    quotaThreadId: String(env.CODEX_MOBILE_USER_BEHAVIOR_QUOTA_THREAD_ID || "").trim(),
    runtimeSubmitThreadId: String(env.CODEX_MOBILE_USER_BEHAVIOR_RUNTIME_SUBMIT_THREAD_ID || env.CODEX_MOBILE_RUNTIME_BROWSER_SUBMIT_THREAD_ID || "").trim(),
    expectBuildHash: String(env.CODEX_MOBILE_USER_BEHAVIOR_EXPECT_BUILD_HASH || "").trim(),
    serviceWorkers: normalizeMode(env.CODEX_MOBILE_USER_BEHAVIOR_SERVICE_WORKERS || DEFAULT_SERVICE_WORKERS, ["block", "allow", "both"], DEFAULT_SERVICE_WORKERS),
    playwrightModuleDir: String(env.CODEX_MOBILE_USER_BEHAVIOR_PLAYWRIGHT_MODULE_DIR || "").trim(),
    keyFile: String(env.CODEX_MOBILE_USER_BEHAVIOR_KEY_FILE || "").trim(),
    skipSubmitted: boolEnv(env.CODEX_MOBILE_USER_BEHAVIOR_SKIP_SUBMITTED),
    skipQuota: boolEnv(env.CODEX_MOBILE_USER_BEHAVIOR_SKIP_QUOTA),
    skipRuntime: boolEnv(env.CODEX_MOBILE_USER_BEHAVIOR_SKIP_RUNTIME),
    planOnly: boolEnv(env.CODEX_MOBILE_USER_BEHAVIOR_PLAN_ONLY),
    timeoutMs: DEFAULT_TIMEOUT_MS,
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
    if (arg === "--server") options.server = normalizeServerUrl(next());
    else if (arg === "--submitted-thread-id" || arg === "--thread-id") {
      const parsed = parseThreadToken(next(), options.submittedThreads.length);
      if (parsed) options.submittedThreads.push(parsed);
    } else if (arg === "--quota-thread-id") options.quotaThreadId = next().trim();
    else if (arg === "--runtime-submit-thread-id") options.runtimeSubmitThreadId = next().trim();
    else if (arg === "--expect-build-hash") options.expectBuildHash = next().trim();
    else if (arg === "--service-workers") options.serviceWorkers = normalizeMode(next(), ["block", "allow", "both"], options.serviceWorkers);
    else if (arg === "--playwright-module-dir") options.playwrightModuleDir = next().trim();
    else if (arg === "--key-file") options.keyFile = next().trim();
    else if (arg === "--timeout-ms") options.timeoutMs = Math.max(1000, Number(next()) || options.timeoutMs);
    else if (arg === "--skip-submitted") options.skipSubmitted = true;
    else if (arg === "--skip-quota") options.skipQuota = true;
    else if (arg === "--skip-runtime") options.skipRuntime = true;
    else if (arg === "--plan-only") options.planOnly = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`unknown_arg:${arg}`);
  }
  if (!options.quotaThreadId && options.submittedThreads.length) {
    options.quotaThreadId = options.submittedThreads[0].id;
  }
  if (!options.runtimeSubmitThreadId && options.submittedThreads.length) {
    options.runtimeSubmitThreadId = options.submittedThreads[0].id;
  }
  return options;
}

function commandPreview(command = {}) {
  return [command.executable || "node"].concat(command.args || []).map((item) => {
    const text = String(item || "");
    if (/access[_-]?key|auth|token/i.test(text)) return "<redacted>";
    return text;
  });
}

function buildSubmittedCommand(options, thread) {
  const args = [
    path.join("scripts", "codex-mobile-submitted-message-harness.js"),
    "--server", options.server,
    "--thread-id", thread.id,
    "--entry-surface", "app-preview",
    "--service-workers", options.serviceWorkers,
    "--submit-method", "button",
    "--message-prefix", `CM_USER_BEHAVIOR_${boundedLabel(thread.label, "thread")}`,
    "--json",
  ];
  if (options.expectBuildHash) args.push("--expect-build-hash", options.expectBuildHash);
  if (options.playwrightModuleDir) args.push("--playwright-module-dir", options.playwrightModuleDir);
  if (options.keyFile) args.push("--key-file", options.keyFile);
  return {
    name: `submitted-message:${thread.label}`,
    symptomClass: "submitted-message",
    executable: process.execPath,
    args,
    threadId: thread.id,
  };
}

function buildQuotaCommand(options) {
  const args = [
    path.join("scripts", "codex-mobile-quota-popup-harness.js"),
    "--server", options.server,
    "--thread-id", options.quotaThreadId,
    "--entry-surface", "app-preview",
    "--service-workers", options.serviceWorkers,
    "--click-count", "2",
    "--click-interval-ms", String(DEFAULT_QUOTA_CLICK_INTERVAL_MS),
    "--json",
  ];
  if (options.playwrightModuleDir) args.push("--playwright-module-dir", options.playwrightModuleDir);
  if (options.keyFile) args.push("--key-file", options.keyFile);
  return {
    name: "quota-popup:rapid-click",
    symptomClass: "quota-popup",
    executable: process.execPath,
    args,
    threadId: options.quotaThreadId,
  };
}

function buildRuntimeCommand(options) {
  const args = [
    path.join("scripts", "codex-mobile-runtime-self-check-loop.js"),
    "--server", options.server,
    "--gate-mode", "deploy",
    "--browser-mode", "full",
    "--iterations", "1",
    "--json",
  ];
  for (const thread of options.submittedThreads) {
    args.push("--thread-id", thread.id);
  }
  if (options.runtimeSubmitThreadId) {
    args.push("--browser-exercise-submit", "--browser-submit-thread-id", options.runtimeSubmitThreadId);
  }
  return {
    name: "runtime-full-behavior-gate",
    symptomClass: "runtime-gate",
    executable: process.execPath,
    args,
    threadId: options.runtimeSubmitThreadId || "",
  };
}

function buildPlan(options) {
  const issues = [];
  const commands = [];
  if (!options.skipSubmitted) {
    if (!options.submittedThreads.length) {
      issues.push({ code: "missing_submitted_harness_target", requiredEnv: "CODEX_MOBILE_USER_BEHAVIOR_SUBMITTED_THREADS" });
    } else {
      for (const thread of options.submittedThreads) commands.push(buildSubmittedCommand(options, thread));
    }
  }
  if (!options.skipQuota) {
    if (!options.quotaThreadId) issues.push({ code: "missing_quota_harness_target", requiredEnv: "CODEX_MOBILE_USER_BEHAVIOR_QUOTA_THREAD_ID" });
    else commands.push(buildQuotaCommand(options));
  }
  if (!options.skipRuntime) {
    if (!options.runtimeSubmitThreadId) issues.push({ code: "missing_runtime_submit_target", requiredEnv: "CODEX_MOBILE_USER_BEHAVIOR_RUNTIME_SUBMIT_THREAD_ID" });
    else commands.push(buildRuntimeCommand(options));
  }
  return {
    ok: issues.length === 0,
    status: issues.length ? "blocked_missing_user_behavior_targets" : "ready",
    server: options.server,
    serviceWorkers: options.serviceWorkers,
    commandCount: commands.length,
    commands,
    issues,
  };
}

function extractJsonObject(text) {
  const input = String(text || "").trim();
  if (!input) return null;
  const first = input.indexOf("{");
  const last = input.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  try {
    return JSON.parse(input.slice(first, last + 1));
  } catch (_) {
    return null;
  }
}

function collectCodes(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return Array.from(new Set(items.map((item) => String(item && (item.code || item.name) || item || "").slice(0, 120)).filter(Boolean))).slice(0, 20);
}

function summarizeChildPayload(payload = {}) {
  const issueCodes = collectCodes(payload.issueCodes || payload.issues || payload.gate?.actionableIssueCodes || payload.gate?.reportableIssueCodes);
  return {
    ok: payload.ok === true || payload.gate?.deployPass === true,
    status: String(payload.status || payload.gate?.status || "").slice(0, 120),
    issueCodes,
    blockingIssueCount: Number.isFinite(Number(payload.blockingIssueCount)) ? Number(payload.blockingIssueCount) : Number(payload.gate?.blockingIssueCount || 0),
    scenarioCount: Array.isArray(payload.scenarios) ? payload.scenarios.length : 0,
    commandCount: Array.isArray(payload.checks) ? payload.checks.length : 0,
    entrySurface: String(payload.entrySurface || "").slice(0, 80),
  };
}

function runCommand(command, options, deps = {}) {
  const spawn = deps.spawnSync || childProcess.spawnSync;
  const result = spawn(command.executable || process.execPath, command.args || [], {
    cwd: deps.cwd || path.resolve(__dirname, ".."),
    encoding: "utf8",
    timeout: options.timeoutMs,
    maxBuffer: 1024 * 1024,
    env: process.env,
  });
  const payload = extractJsonObject(result.stdout) || extractJsonObject(result.stderr) || null;
  const summary = payload ? summarizeChildPayload(payload) : { ok: false, status: "child_json_missing", issueCodes: ["child_json_missing"], blockingIssueCount: 1 };
  return {
    name: command.name,
    symptomClass: command.symptomClass,
    threadId: command.threadId || "",
    ok: result.status === 0 && summary.ok !== false,
    exitCode: typeof result.status === "number" ? result.status : null,
    signal: result.signal || "",
    stdoutBytes: Buffer.byteLength(String(result.stdout || ""), "utf8"),
    stderrBytes: Buffer.byteLength(String(result.stderr || ""), "utf8"),
    summary,
    errorCode: result.error ? String(result.error.code || result.error.message || "spawn_error").slice(0, 120) : "",
  };
}

function runUserBehaviorCheck(options, deps = {}) {
  const plan = buildPlan(options);
  if (!plan.ok || options.planOnly) {
    return {
      ok: plan.ok && options.planOnly,
      status: plan.status,
      planOnly: options.planOnly,
      server: plan.server,
      serviceWorkers: plan.serviceWorkers,
      commandCount: plan.commandCount,
      commandPreview: plan.commands.map(commandPreview),
      issues: plan.issues,
      results: [],
    };
  }
  const results = plan.commands.map((command) => runCommand(command, options, deps));
  const issueCodes = Array.from(new Set(results.flatMap((item) => item.summary?.issueCodes || []).concat(results.filter((item) => !item.ok).map((item) => `${item.name}_failed`)))).slice(0, 40);
  return {
    ok: results.every((item) => item.ok),
    status: results.every((item) => item.ok) ? "passed" : "failed",
    server: plan.server,
    serviceWorkers: plan.serviceWorkers,
    commandCount: plan.commandCount,
    issueCodes,
    results,
  };
}

function main() {
  const options = parseArgs();
  if (options.help) {
    console.log(usage());
    return;
  }
  const result = runUserBehaviorCheck(options);
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else console.log(`${result.ok ? "ok" : "failed"} user-behavior check issueCodes=${(result.issueCodes || result.issues || []).map((item) => item.code || item).join(",") || "[]"}`);
  if (!result.ok) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(JSON.stringify({ ok: false, status: "failed", error: String(err && err.message || err).slice(0, 300) }, null, 2));
    process.exitCode = 1;
  }
}

module.exports = {
  parseArgs,
  parseThreadList,
  buildPlan,
  buildSubmittedCommand,
  buildQuotaCommand,
  buildRuntimeCommand,
  runUserBehaviorCheck,
  summarizeChildPayload,
};
