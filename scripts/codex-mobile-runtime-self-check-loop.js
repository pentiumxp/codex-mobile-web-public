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
const HTTP_FETCH_TIMEOUT_MS = 15000;

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
    "  --key-file <path>       Access key file. Default: $HOME/.codex-mobile-web/access_key",
    "  --thread-id <id>        Thread id to target. Repeatable.",
    "  --sample-threads <n>    Browser sample thread count when no id is passed. Default: 3.",
    "  --browser-rounds <n>    Browser switch/sample rounds. Default: 2.",
    "  --browser-sample-delays-ms <csv> Browser delays after each switch. Default: 100,350,700,900,1200,1600,2800,6000.",
    "  --browser-min-settled-delay-ms <n> Browser downgrade H2 threshold. Default: 1000.",
    "  --browser-startup-only Run only listener/static shell/browser startup smoke for browser job.",
    "                         Deploy gates also run Vite preview artifact, app-preview, root app-preview, app-preview embed, and app-preview launch/session smokes as separate browser jobs.",
    "                         Without this flag, the app-preview and root app-preview jobs run full read-only thread UX sampling.",
    "  --browser-vite-app-preview-default-root",
    "                         Add an explicit Vite app-preview check for plain / on a server started with CODEX_MOBILE_DEFAULT_SHELL=vite-app-preview.",
    "  --skip-vite-default-root-rehearsal",
    "                         Skip the deploy-mode temporary Vite default-root rehearsal server check.",
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
    keyFile: env.CODEX_MOBILE_KEY_FILE || path.join(os.homedir(), ".codex-mobile-web", "access_key"),
    threadIds: [],
    sampleThreads: positiveInt(env.CODEX_MOBILE_RUNTIME_SELF_CHECK_SAMPLE_THREADS || "3", 3, 20),
    browserRounds: positiveInt(env.CODEX_MOBILE_RUNTIME_BROWSER_ROUNDS || "2", 2, 20),
    browserSampleDelaysMs: String(env.CODEX_MOBILE_RUNTIME_BROWSER_SAMPLE_DELAYS_MS || "100,350,700,900,1200,1600,2800,6000"),
    browserMinSettledDelayMs: positiveInt(env.CODEX_MOBILE_RUNTIME_BROWSER_MIN_SETTLED_DELAY_MS || "1000", 1000, 10000),
    browserStartupOnly: /^(1|true|yes)$/i.test(String(env.CODEX_MOBILE_RUNTIME_BROWSER_STARTUP_ONLY || "")),
    browserViteAppPreviewDefaultRoot: /^(1|true|yes)$/i.test(String(env.CODEX_MOBILE_RUNTIME_BROWSER_VITE_APP_PREVIEW_DEFAULT_ROOT || "")),
    skipViteDefaultRootRehearsal: /^(1|true|yes)$/i.test(String(env.CODEX_MOBILE_RUNTIME_SKIP_VITE_DEFAULT_ROOT_REHEARSAL || "")),
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
    else if (arg === "--key-file") options.keyFile = next();
    else if (arg === "--thread-id") options.threadIds.push(next());
    else if (arg === "--sample-threads") options.sampleThreads = positiveInt(next(), options.sampleThreads, 20);
    else if (arg === "--browser-rounds") options.browserRounds = positiveInt(next(), options.browserRounds, 20);
    else if (arg === "--browser-sample-delays-ms") options.browserSampleDelaysMs = next();
    else if (arg === "--browser-min-settled-delay-ms") options.browserMinSettledDelayMs = positiveInt(next(), options.browserMinSettledDelayMs, 10000);
    else if (arg === "--browser-startup-only") options.browserStartupOnly = true;
    else if (arg === "--browser-vite-app-preview-default-root") options.browserViteAppPreviewDefaultRoot = true;
    else if (arg === "--skip-vite-default-root-rehearsal") options.skipViteDefaultRootRehearsal = true;
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

function serverUrlForPath(server, pathname) {
  const base = new URL(String(server || DEFAULT_SERVER));
  base.pathname = pathname;
  base.search = "";
  base.hash = "";
  return base.toString();
}

async function fetchRuntimeJson(url, deps = {}) {
  const headers = { Accept: "application/json" };
  const accessKey = String(deps.accessKey || "").trim();
  if (accessKey) headers.Authorization = `Bearer ${accessKey}`;
  if (typeof deps.fetchJson === "function") return deps.fetchJson(url, { headers });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (_) {
      body = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function readAccessKey(options = {}, env = process.env, deps = {}) {
  const inline = String(env.CODEX_MOBILE_KEY || env.CODEX_MOBILE_ACCESS_KEY || "").trim();
  if (inline) return inline;
  const keyFile = String(options.keyFile || "").trim();
  if (!keyFile) return "";
  const readFile = typeof deps.readFileSync === "function" ? deps.readFileSync : fs.readFileSync;
  try {
    return String(readFile(keyFile, "utf8") || "").trim();
  } catch (_) {
    return "";
  }
}

function checkIssue(code, extra = {}) {
  return {
    severity: "H2",
    category: "runtime_self_check",
    diagnostic_type: code,
    code,
    ...extra,
  };
}

function queryParamFromUrl(url, key) {
  try {
    const parsed = new URL(String(url || ""), DEFAULT_SERVER);
    return parsed.searchParams.get(key) || "";
  } catch (_) {
    return "";
  }
}

function boolRefreshFlag(value) {
  return Boolean(
    value && (
      value.refreshOnVersionChange
      || value.refresh_on_version_change
    )
  );
}

function buildIdentityFromPublicConfig(publicConfig = {}) {
  const buildId = String(publicConfig.buildId || "").trim();
  const clientBuildId = String(publicConfig.clientBuildId || "").trim();
  const shellCacheName = String(publicConfig.shellCacheName || "").trim();
  const classicShellCacheName = String(publicConfig.classicShellCacheName || "").trim();
  return {
    buildId,
    clientBuildId,
    shellCacheName,
    classicShellCacheName,
    identity: clientBuildId || shellCacheName || buildId,
  };
}

function compactIssueCodeList(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => boundedErrorCode(value))
    .filter(Boolean)))
    .slice(0, 20);
}

function currentBuildIdentityFromAppUpdateStatus(status = {}) {
  const currentBuild = status && status.currentBuild && typeof status.currentBuild === "object"
    ? status.currentBuild
    : {};
  const issueCodes = compactIssueCodeList([
    ...(Array.isArray(currentBuild.issueCodes) ? currentBuild.issueCodes : []),
    ...(Array.isArray(status.currentBuildIssueCodes) ? status.currentBuildIssueCodes : []),
    ...(Array.isArray(status.issueCodes) ? status.issueCodes : []),
  ]);
  const clientBuildId = String(currentBuild.clientBuildId || status.clientBuildId || "").trim();
  const shellCacheName = String(currentBuild.shellCacheName || status.shellCacheName || "").trim();
  const classicShellCacheName = String(currentBuild.classicShellCacheName || status.classicShellCacheName || "").trim();
  const buildId = String(currentBuild.buildId || status.buildId || "").trim();
  return {
    buildId,
    clientBuildId,
    shellCacheName,
    classicShellCacheName,
    identity: clientBuildId || shellCacheName || buildId,
    issueCodes,
  };
}

function runtimeCheckFromAppUpdateStatus(publicConfig = {}, status = {}) {
  const expected = buildIdentityFromPublicConfig(publicConfig);
  const actual = currentBuildIdentityFromAppUpdateStatus(status);
  const issues = [];
  const actualIssueCodeSet = new Set(actual.issueCodes);
  for (const code of actualIssueCodeSet) {
    if (/^app_update_current_build_/.test(code)) issues.push(checkIssue(code));
  }
  if ((expected.clientBuildId || expected.shellCacheName) && (!actual.clientBuildId || !actual.shellCacheName)) {
    if (!actualIssueCodeSet.has("app_update_current_build_identity_empty")) {
      issues.push(checkIssue("app_update_current_build_identity_empty"));
    }
  } else {
    if (expected.clientBuildId && actual.clientBuildId && actual.clientBuildId !== expected.clientBuildId) {
      issues.push(checkIssue("app_update_current_build_client_mismatch"));
    }
    if (expected.shellCacheName && actual.shellCacheName && actual.shellCacheName !== expected.shellCacheName) {
      issues.push(checkIssue("app_update_current_build_shell_cache_mismatch"));
    }
  }
  if (
    expected.classicShellCacheName
    && (actual.clientBuildId === expected.classicShellCacheName
      || actual.shellCacheName === expected.classicShellCacheName
      || (actual.clientBuildId && actual.clientBuildId.includes(expected.classicShellCacheName)))
  ) {
    issues.push(checkIssue("app_update_current_build_uses_classic_cache_identity"));
  }
  return {
    name: "app-update-current-build",
    ok: issues.length === 0,
    issueCount: issues.length,
    blockingIssueCount: issues.length,
    diagnosticCandidateCount: 0,
    clientBuildId: expected.clientBuildId.slice(0, 120),
    shellCacheName: expected.shellCacheName.slice(0, 120),
    errorCode: "",
    issues,
    diagnosticCandidates: [],
    buildId: expected.buildId.slice(0, 120),
    appUpdateClientBuildId: actual.clientBuildId.slice(0, 120),
    appUpdateShellCacheName: actual.shellCacheName.slice(0, 120),
    appUpdateCurrentBuildIssueCodes: actual.issueCodes,
  };
}

function runtimeCheckFromHermesManifest(publicConfig = {}, manifest = {}) {
  const identity = buildIdentityFromPublicConfig(publicConfig);
  const manifestBuild = manifest && typeof manifest.build === "object" ? manifest.build : {};
  const entry = manifest && typeof manifest.entry === "object" ? manifest.entry : {};
  const requiredQuery = entry && typeof entry.required_query === "object" ? entry.required_query : {};
  const embedding = manifest && typeof manifest.embedding === "object" ? manifest.embedding : {};
  const embed = manifest && typeof manifest.embed === "object" ? manifest.embed : {};
  const entryBuildParam = queryParamFromUrl(entry.url, "codexMobileBuild");
  const issues = [];
  if (!identity.buildId) issues.push(checkIssue("hermes_manifest_public_build_id_missing"));
  if (!identity.clientBuildId) issues.push(checkIssue("hermes_manifest_public_client_build_missing"));
  if (!identity.shellCacheName) issues.push(checkIssue("hermes_manifest_public_shell_cache_missing"));
  if (!identity.identity) issues.push(checkIssue("hermes_manifest_public_build_identity_missing"));
  if (identity.buildId && String(manifest.buildId || "") !== identity.buildId) {
    issues.push(checkIssue("hermes_manifest_build_id_mismatch"));
  }
  if (identity.clientBuildId && String(manifest.clientBuildId || "") !== identity.clientBuildId) {
    issues.push(checkIssue("hermes_manifest_client_build_mismatch"));
  }
  if (identity.shellCacheName && String(manifest.shellCacheName || "") !== identity.shellCacheName) {
    issues.push(checkIssue("hermes_manifest_shell_cache_mismatch"));
  }
  if (identity.identity && String(manifestBuild.identity || "") !== identity.identity) {
    issues.push(checkIssue("hermes_manifest_build_identity_mismatch"));
  }
  if (!boolRefreshFlag(embedding)) issues.push(checkIssue("hermes_manifest_embedding_refresh_missing"));
  if (!boolRefreshFlag(embed)) issues.push(checkIssue("hermes_manifest_embed_refresh_missing"));
  if (identity.identity && String(embedding.version || "") !== identity.identity) {
    issues.push(checkIssue("hermes_manifest_embedding_version_mismatch"));
  }
  if (identity.identity && String(embed.version || "") !== identity.identity) {
    issues.push(checkIssue("hermes_manifest_embed_version_mismatch"));
  }
  if (identity.identity && entryBuildParam !== identity.identity) {
    issues.push(checkIssue("hermes_manifest_entry_build_param_mismatch"));
  }
  if (identity.identity && String(requiredQuery.codexMobileBuild || "") !== identity.identity) {
    issues.push(checkIssue("hermes_manifest_required_query_build_mismatch"));
  }
  return {
    name: "hermes-manifest",
    ok: issues.length === 0,
    issueCount: issues.length,
    blockingIssueCount: issues.length,
    diagnosticCandidateCount: 0,
    clientBuildId: identity.clientBuildId.slice(0, 120),
    shellCacheName: identity.shellCacheName.slice(0, 120),
    errorCode: "",
    issues,
    diagnosticCandidates: [],
    buildId: identity.buildId.slice(0, 120),
    manifestBuildId: String(manifest.buildId || "").slice(0, 120),
    manifestEntryBuildParam: entryBuildParam.slice(0, 120),
    refreshOnVersionChange: boolRefreshFlag(embedding) && boolRefreshFlag(embed),
  };
}

async function checkHermesManifestBuildRefresh(options = {}, deps = {}) {
  const publicConfigUrl = serverUrlForPath(options.server || DEFAULT_SERVER, "/api/public-config");
  const manifestUrl = serverUrlForPath(options.server || DEFAULT_SERVER, "/api/v1/hermes/plugin/manifest");
  const appUpdateStatusUrl = new URL(serverUrlForPath(options.server || DEFAULT_SERVER, "/api/app-update/status"));
  appUpdateStatusUrl.searchParams.set("force", "1");
  const accessKey = deps.accessKey !== undefined
    ? String(deps.accessKey || "").trim()
    : readAccessKey(options, deps.env || process.env, deps);
  let publicConfigResult = null;
  let manifestResult = null;
  let appUpdateStatusResult = null;
  try {
    publicConfigResult = await fetchRuntimeJson(publicConfigUrl, deps);
  } catch (error) {
    publicConfigResult = {
      ok: false,
      status: 0,
      body: {},
      errorCode: boundedErrorCode(error && error.message),
    };
  }
  try {
    manifestResult = await fetchRuntimeJson(manifestUrl, deps);
  } catch (error) {
    manifestResult = {
      ok: false,
      status: 0,
      body: {},
      errorCode: boundedErrorCode(error && error.message),
    };
  }
  try {
    appUpdateStatusResult = await fetchRuntimeJson(appUpdateStatusUrl.toString(), { ...deps, accessKey });
  } catch (error) {
    appUpdateStatusResult = {
      ok: false,
      status: 0,
      body: {},
      errorCode: boundedErrorCode(error && error.message),
    };
  }
  const publicConfig = publicConfigResult && publicConfigResult.body && typeof publicConfigResult.body === "object"
    ? publicConfigResult.body
    : {};
  const manifest = manifestResult && manifestResult.body && typeof manifestResult.body === "object"
    ? manifestResult.body
    : {};
  const appUpdateStatus = appUpdateStatusResult && appUpdateStatusResult.body && typeof appUpdateStatusResult.body === "object"
    ? appUpdateStatusResult.body
    : {};
  const check = runtimeCheckFromHermesManifest(publicConfig, manifest);
  let appUpdateCheck = null;
  if (appUpdateStatusResult && appUpdateStatusResult.ok) {
    appUpdateCheck = runtimeCheckFromAppUpdateStatus(publicConfig, appUpdateStatus);
    if (appUpdateCheck.issues.length) {
      check.issues = check.issues.concat(appUpdateCheck.issues);
      check.issueCount = check.issues.length;
      check.blockingIssueCount = check.issues.length;
      check.ok = false;
    }
  }
  check.appUpdateClientBuildId = appUpdateCheck ? appUpdateCheck.appUpdateClientBuildId : "";
  check.appUpdateShellCacheName = appUpdateCheck ? appUpdateCheck.appUpdateShellCacheName : "";
  check.appUpdateCurrentBuildIssueCodes = appUpdateCheck ? appUpdateCheck.appUpdateCurrentBuildIssueCodes : [];
  const transportIssues = [];
  if (!publicConfigResult || !publicConfigResult.ok) {
    transportIssues.push(checkIssue("hermes_manifest_public_config_unavailable", {
      status: Number(publicConfigResult && publicConfigResult.status || 0) || 0,
    }));
  }
  if (!manifestResult || !manifestResult.ok) {
    transportIssues.push(checkIssue("hermes_manifest_unavailable", {
      status: Number(manifestResult && manifestResult.status || 0) || 0,
    }));
  }
  if (!appUpdateStatusResult || !appUpdateStatusResult.ok) {
    const status = Number(appUpdateStatusResult && appUpdateStatusResult.status || 0) || 0;
    const code = status === 401 || status === 403
      ? "post_deploy_harness_app_update_status_auth_gap"
      : "app_update_status_unavailable";
    transportIssues.push(checkIssue(code, {
      status,
    }));
  }
  if (transportIssues.length) {
    check.issues = transportIssues.concat(check.issues);
    check.issueCount = check.issues.length;
    check.blockingIssueCount = check.issues.length;
    check.ok = false;
  }
  return check;
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

function defaultShellModeFromPublicConfig(config = {}) {
  const value = String(config && config.defaultShellMode || "").trim().toLowerCase();
  if (value === "vite-app-preview" || value === "app-preview") return "vite-app-preview";
  if (value === "classic" || value === "classic-script" || value === "classic-script-fallback") return "classic";
  return "";
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

function runtimeCheckFromProcessPressure(processPressure = {}) {
  const issues = Array.isArray(processPressure.issues) ? processPressure.issues : [];
  const blockingIssues = issues.filter((issue) => {
    const severity = String(issue && issue.severity || "").toUpperCase();
    return severity === "H1" || severity === "H2";
  });
  return {
    name: "process-pressure",
    ok: blockingIssues.length === 0,
    issueCount: issues.length,
    blockingIssueCount: blockingIssues.length,
    diagnosticCandidateCount: 0,
    clientBuildId: "",
    shellCacheName: "",
    errorCode: "",
    issues,
    diagnosticCandidates: [],
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
  if (options.keyFile) args.push("--key-file", options.keyFile);
  for (const id of options.threadIds || []) args.push("--thread-id", id);
  return args;
}

function browserRuntimeSamplingArgs(options = {}) {
  return [
    "--sample-threads",
    String(positiveInt(options.sampleThreads, 3, 20)),
    "--rounds",
    String(positiveInt(options.browserRounds, 2, 20)),
    "--sample-delays-ms",
    String(options.browserSampleDelaysMs || "100,350,700,900,1200,1600,2800,6000"),
    "--min-settled-delay-ms",
    String(positiveInt(options.browserMinSettledDelayMs, 1000, 10000)),
  ];
}

async function runOnce(options = {}, deps = {}) {
  const startedAt = new Date(Date.now()).toISOString();
  const checks = [];
  let planOptions = { ...options };
  if (planOptions.browserViteAppPreviewDefaultRoot) {
    planOptions.skipViteDefaultRootRehearsal = true;
  }
  let jobPlan = resolveRuntimeSelfCheckPlan(planOptions);
  let observedDefaultShellMode = "";
  const root = path.resolve(__dirname, "..");
  const hermesManifestJob = runtimeSelfCheckJob(jobPlan, "hermes-manifest");
  if (hermesManifestJob && hermesManifestJob.enabled) {
    checks.push(await checkHermesManifestBuildRefresh(options, deps));
  }
  const apiJob = runtimeSelfCheckJob(jobPlan, "api-thread");
  if (apiJob && apiJob.enabled) {
    const result = await runNodeScript(path.join(root, "scripts", "codex-mobile-thread-self-check.js"), baseArgs(options), deps, apiJob);
    checks.push(summarizeCheck("api-thread", result));
  }
  const browserJob = runtimeSelfCheckJob(jobPlan, "browser-runtime");
  let processPressure = null;
  if (
    String(options.gateMode || "").toLowerCase() === "deploy"
    && !options.skipBrowser
    && browserJob
    && browserJob.enabled
  ) {
    processPressure = collectRuntimeProcessPressure({ topLimit: 12 }, deps);
    const processPressureCheck = runtimeCheckFromProcessPressure(processPressure);
    checks.push({
      ...processPressureCheck,
      name: "process-pressure-preflight",
    });
    if (!processPressureCheck.ok) {
      const event = {
        privacy: "metadata_only",
        startedAt,
        completedAt: new Date().toISOString(),
        profile: {
          browserMode: jobPlan.profile.browserMode,
          scheduler: "runtime-job-scheduler-service",
          defaultShellMode: observedDefaultShellMode,
          viteAppPreviewDefaultRootGate: "skipped-process-pressure-preflight",
        },
        runtimeJobs: jobPlan.jobs,
        processPressure,
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
  }
  const browserScript = path.join(root, "scripts", "codex-mobile-browser-runtime-self-check.js");
  if (browserJob && browserJob.enabled) {
    const browserArgs = baseArgs(options).concat(browserRuntimeSamplingArgs(options));
    if (options.browserStartupOnly) browserArgs.push("--startup-only");
    if (!options.browserStartupOnly && options.browserExerciseSubmit) browserArgs.push("--exercise-submit");
    if (!options.browserStartupOnly && options.browserSubmitThreadId) browserArgs.push("--submit-thread-id", options.browserSubmitThreadId);
    if (!options.browserStartupOnly && options.browserSubmitMessage) browserArgs.push("--submit-message", options.browserSubmitMessage);
    if (!options.browserStartupOnly && options.browserSubmitSampleDelaysMs) browserArgs.push("--submit-sample-delays-ms", options.browserSubmitSampleDelaysMs);
    const result = await runNodeScript(browserScript, browserArgs, deps, browserJob);
    observedDefaultShellMode = defaultShellModeFromPublicConfig(publicConfigFromReport(result.report || {}));
    if (observedDefaultShellMode === "vite-app-preview"
      && (!planOptions.browserViteAppPreviewDefaultRoot || !planOptions.skipViteDefaultRootRehearsal)) {
      planOptions = {
        ...planOptions,
        browserViteAppPreviewDefaultRoot: true,
        skipViteDefaultRootRehearsal: true,
      };
      jobPlan = resolveRuntimeSelfCheckPlan(planOptions);
    }
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
    const viteAppPreviewArgs = [
      "--server",
      options.server || DEFAULT_SERVER,
      "--json",
      "--vite-app-preview-only",
    ];
    const result = await runNodeScript(browserScript, viteAppPreviewArgs, deps, browserViteAppPreviewJob);
    checks.push(summarizeCheck("browser-vite-app-preview", result));
  }
  const browserViteAppPreviewRootJob = runtimeSelfCheckJob(jobPlan, "browser-vite-app-preview-root");
  if (browserViteAppPreviewRootJob && browserViteAppPreviewRootJob.enabled) {
    const viteAppPreviewRootArgs = [
      "--server",
      options.server || DEFAULT_SERVER,
      "--json",
      "--vite-app-preview-only",
      "--vite-app-preview-root",
    ];
    const result = await runNodeScript(browserScript, viteAppPreviewRootArgs, deps, browserViteAppPreviewRootJob);
    checks.push(summarizeCheck("browser-vite-app-preview-root", result));
  }
  const shouldRunViteAppPreviewDefaultRoot = options.browserViteAppPreviewDefaultRoot
    || observedDefaultShellMode === "vite-app-preview";
  if (shouldRunViteAppPreviewDefaultRoot) {
    const browserViteAppPreviewDefaultRootJob = runtimeSelfCheckJob(jobPlan, "browser-vite-app-preview-default-root");
    if (browserViteAppPreviewDefaultRootJob && browserViteAppPreviewDefaultRootJob.enabled) {
      const viteAppPreviewDefaultRootArgs = [
        "--server",
        options.server || DEFAULT_SERVER,
        "--json",
        "--vite-app-preview-only",
        "--vite-app-preview-default-root",
      ];
      const result = await runNodeScript(browserScript, viteAppPreviewDefaultRootArgs, deps, browserViteAppPreviewDefaultRootJob);
      checks.push(summarizeCheck("browser-vite-app-preview-default-root", result));
    }
  }
  const browserViteAppPreviewDefaultRootRehearsalJob = runtimeSelfCheckJob(jobPlan, "browser-vite-app-preview-default-root-rehearsal");
  if (browserViteAppPreviewDefaultRootRehearsalJob
    && browserViteAppPreviewDefaultRootRehearsalJob.enabled
    && !options.skipViteDefaultRootRehearsal
    && observedDefaultShellMode !== "vite-app-preview") {
    const rehearsalArgs = [
      "--json",
      "--browser-timeout-ms",
      String(positiveInt(options.browserMinSettledDelayMs, 1000, 10000) + 19000),
    ];
    const result = await runNodeScript(
      path.join(root, "scripts", "codex-mobile-vite-default-root-rehearsal.js"),
      rehearsalArgs,
      deps,
      browserViteAppPreviewDefaultRootRehearsalJob,
    );
    checks.push(summarizeCheck("browser-vite-app-preview-default-root-rehearsal", result));
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
  const browserViteAppPreviewSessionJob = runtimeSelfCheckJob(jobPlan, "browser-vite-app-preview-session");
  if (browserViteAppPreviewSessionJob && browserViteAppPreviewSessionJob.enabled) {
    const viteAppPreviewSessionArgs = [
      "--server",
      options.server || DEFAULT_SERVER,
      "--json",
      "--vite-app-preview-only",
      "--vite-app-preview-launch-session",
    ];
    const result = await runNodeScript(browserScript, viteAppPreviewSessionArgs, deps, browserViteAppPreviewSessionJob);
    checks.push(summarizeCheck("browser-vite-app-preview-session", result));
  }
  const clientEventsJob = runtimeSelfCheckJob(jobPlan, "client-events");
  if (clientEventsJob && clientEventsJob.enabled) {
    const clientEventNotBeforeMs = String(options.gateMode || "").trim() === "deploy"
      ? Date.parse(startedAt)
      : 0;
    const clientEventSummary = summarizeClientEventLog({
      logCandidates: options.clientEventLog ? [options.clientEventLog] : null,
      tailBytes: options.clientEventTailBytes,
      maxLines: options.clientEventMaxLines,
      windowMs: options.clientEventWindowMs,
      notBeforeMs: Number.isFinite(clientEventNotBeforeMs) ? clientEventNotBeforeMs : 0,
    });
    checks.push(runtimeCheckFromClientEventSummary(clientEventSummary));
  }
  processPressure = collectRuntimeProcessPressure({ topLimit: 12 }, deps);
  checks.push(runtimeCheckFromProcessPressure(processPressure));
  const event = {
    privacy: "metadata_only",
    startedAt,
    completedAt: new Date().toISOString(),
    profile: {
      browserMode: jobPlan.profile.browserMode,
      scheduler: "runtime-job-scheduler-service",
      defaultShellMode: observedDefaultShellMode,
      viteAppPreviewDefaultRootGate: shouldRunViteAppPreviewDefaultRoot
        ? (options.browserViteAppPreviewDefaultRoot ? "explicit" : "auto")
        : "off",
    },
    runtimeJobs: jobPlan.jobs,
    processPressure,
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
  readAccessKey,
  runLoop,
  runOnce,
  checkHermesManifestBuildRefresh,
  runtimeCheckFromAppUpdateStatus,
  runtimeCheckFromHermesManifest,
  summarizeCheck,
  collectRuntimeProcessPressure,
  usage,
  runtimeCheckFromProcessPressure,
};
