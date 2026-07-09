#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const {
  analyzeBrowserRuntimeSamples,
  safeThreadRows,
  stableTextHash,
} = require("../services/runtime/browser-runtime-self-check-service");

const DEFAULT_SERVER = "http://127.0.0.1:8787";
const DEFAULT_CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DEFAULT_VIEWPORT = "390x844";
const activeChromeCleanups = new Set();
let chromeCleanupHandlersInstalled = false;

function cleanupChromeChild(child, userDataDir, signal = "SIGTERM") {
  if (child && child.pid) {
    try {
      process.kill(-child.pid, signal);
    } catch (_) {
      try {
        child.kill(signal);
      } catch (_) {}
    }
  }
  if (userDataDir) {
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

function installChromeCleanupHandlers() {
  if (chromeCleanupHandlersInstalled) return;
  chromeCleanupHandlersInstalled = true;
  const cleanupAll = (signal = "SIGTERM") => {
    for (const cleanup of Array.from(activeChromeCleanups)) {
      try {
        cleanup(signal);
      } catch (_) {}
    }
  };
  process.once("exit", () => cleanupAll("SIGKILL"));
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.once(signal, () => {
      cleanupAll("SIGTERM");
      setTimeout(() => {
        cleanupAll("SIGKILL");
        process.exit(128 + (signal === "SIGINT" ? 2 : signal === "SIGTERM" ? 15 : 1));
      }, 250).unref();
    });
  }
  process.once("uncaughtException", (err) => {
    cleanupAll("SIGKILL");
    throw err;
  });
  process.once("unhandledRejection", (err) => {
    cleanupAll("SIGKILL");
    throw err;
  });
}

function usage() {
  return [
    "Usage:",
    "  node scripts/codex-mobile-browser-runtime-self-check.js [options]",
    "",
    "Runs a metadata-only real-browser Codex Mobile runtime self-check.",
    "It launches an isolated Chrome profile, opens the local Codex Mobile shell,",
    "switches through recent threads, and compares browser DOM health with bounded",
    "network/runtime evidence. It does not print raw thread ids, titles, message",
    "text, task-card bodies, uploads, cookies, access keys, URLs with query strings,",
    "or long logs.",
    "",
    "Options:",
    "  --server <url>             Codex Mobile server. Default: http://127.0.0.1:8787",
    "  --key-file <path>          Access key file. Default: $HOME/.codex-mobile-web/access_key",
    "  --thread-id <id>           Thread id to open. Repeatable.",
    "  --sample-threads <n>       Thread-list rows to sample when no id is passed. Default: 3.",
    "  --list-limit <n>           Thread-list limit. Default: 10.",
    "  --startup-only             Check listener/static shell/browser startup only; skip thread sampling.",
    "  --vite-preview-only        Check /vite-shell/preview.html Vite module artifact only.",
    "  --vite-app-preview-only    Check /vite-shell/app-preview.html Vite-owned app startup only.",
    "  --vite-app-preview-runtime Check /vite-shell/app-preview.html with full read-only thread UX sampling.",
    "  --vite-app-preview-root    Serve app-preview through /?codexViteShell=app-preview and verify root-path startup.",
    "  --vite-app-preview-default-root",
    "                             Serve app-preview through plain / and verify the default-root startup contract.",
    "  --vite-app-preview-embed   Add ?embed=hermes to app-preview checks and verify embed bootstrap invariants.",
    "  --vite-app-preview-launch-session",
    "                             Create a short Hermes launch and verify app-preview session exchange.",
    "  --rounds <n>               Thread switch rounds. Default: 3.",
    "  --sample-delays-ms <csv>   Delays after each switch. Default: 100,350,700,900,1200,1600,2800,6000.",
    "  --thread-list-stress-rounds <n> Thread-list open/scroll/click stress rounds. Default: 2.",
    "  --exercise-submit          Send one short UI message through Composer in the target test thread.",
    "  --submit-thread-id <id>    Dedicated thread id for --exercise-submit. Defaults to first selected thread.",
    "  --submit-message <text>    Test message. Default asks for a one-token OK reply.",
    "  --submit-repeat <n>        Number of submit messages for interruption/echo checks. Default: 1.",
    "  --submit-interval-ms <n>   Delay between repeated submit messages. Default: 120.",
    "  --submit-sample-delays-ms <csv> Delays after submit. Default: 100,350,900,1600,2800,6000.",
    "  --viewport <WxH>           Browser viewport. Default: 390x844.",
    "  --chrome-path <path>       Chrome executable. Default: macOS Google Chrome.",
    "  --headed                   Run visible Chrome instead of headless.",
    "  --timeout-ms <n>           Request/browser timeout. Default: 20000.",
    "  --min-settled-delay-ms <n> Sparse-after-nonempty H2 threshold. Default: 1000.",
    "  --diagnostic-samples       Include bounded metadata-only DOM/API sample shapes.",
    "  --json                     Print JSON only.",
    "  --help                     Show this help.",
  ].join("\n");
}

function readPositiveInt(value, fallback, max = 100000) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(max, Math.trunc(number));
}

function readNonNegativeInt(value, fallback, max = 100000) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.min(max, Math.trunc(number));
}

function parseDelayList(value, fallback = [100, 350, 700, 900, 1200, 1600, 2800, 6000]) {
  const parsed = String(value || "")
    .split(",")
    .map((entry) => readPositiveInt(entry.trim(), 0, 30000))
    .filter((entry) => entry > 0);
  return parsed.length ? parsed : fallback;
}

function parseViewport(value) {
  const match = String(value || DEFAULT_VIEWPORT).trim().match(/^(\d{2,5})x(\d{2,5})$/i);
  if (!match) return { width: 390, height: 844 };
  return {
    width: readPositiveInt(match[1], 390, 10000),
    height: readPositiveInt(match[2], 844, 10000),
  };
}

function normalizeBaseUrl(value) {
  const url = new URL(value || DEFAULT_SERVER);
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.toString();
}

function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    server: env.CODEX_MOBILE_BASE_URL || DEFAULT_SERVER,
    keyFile: env.CODEX_MOBILE_KEY_FILE || path.join(os.homedir(), ".codex-mobile-web", "access_key"),
    chromePath: env.CHROME_PATH || DEFAULT_CHROME_PATH,
    threadIds: [],
    sampleThreads: readPositiveInt(env.CODEX_MOBILE_BROWSER_SELF_CHECK_SAMPLE_THREADS || "3", 3, 20),
    listLimit: readPositiveInt(env.CODEX_MOBILE_BROWSER_SELF_CHECK_LIST_LIMIT || "10", 10, 100),
    startupOnly: /^(1|true|yes)$/i.test(String(env.CODEX_MOBILE_BROWSER_SELF_CHECK_STARTUP_ONLY || "")),
    vitePreviewOnly: /^(1|true|yes)$/i.test(String(env.CODEX_MOBILE_BROWSER_SELF_CHECK_VITE_PREVIEW_ONLY || "")),
    viteAppPreviewOnly: /^(1|true|yes)$/i.test(String(env.CODEX_MOBILE_BROWSER_SELF_CHECK_VITE_APP_PREVIEW_ONLY || "")),
    viteAppPreviewRuntime: /^(1|true|yes)$/i.test(String(env.CODEX_MOBILE_BROWSER_SELF_CHECK_VITE_APP_PREVIEW_RUNTIME || "")),
    viteAppPreviewRoot: /^(1|true|yes)$/i.test(String(env.CODEX_MOBILE_BROWSER_SELF_CHECK_VITE_APP_PREVIEW_ROOT || "")),
    viteAppPreviewDefaultRoot: /^(1|true|yes)$/i.test(String(env.CODEX_MOBILE_BROWSER_SELF_CHECK_VITE_APP_PREVIEW_DEFAULT_ROOT || "")),
    viteAppPreviewEmbed: /^(1|true|yes)$/i.test(String(env.CODEX_MOBILE_BROWSER_SELF_CHECK_VITE_APP_PREVIEW_EMBED || "")),
    viteAppPreviewLaunchSession: /^(1|true|yes)$/i.test(String(env.CODEX_MOBILE_BROWSER_SELF_CHECK_VITE_APP_PREVIEW_LAUNCH_SESSION || "")),
    rounds: readPositiveInt(env.CODEX_MOBILE_BROWSER_SELF_CHECK_ROUNDS || "3", 3, 20),
    sampleDelaysMs: parseDelayList(env.CODEX_MOBILE_BROWSER_SELF_CHECK_SAMPLE_DELAYS_MS || ""),
    threadListStressRounds: readNonNegativeInt(env.CODEX_MOBILE_BROWSER_SELF_CHECK_THREAD_LIST_STRESS_ROUNDS || "2", 2, 20),
    exerciseSubmit: /^(1|true|yes)$/i.test(String(env.CODEX_MOBILE_BROWSER_SELF_CHECK_EXERCISE_SUBMIT || "")),
    submitThreadId: String(env.CODEX_MOBILE_BROWSER_SELF_CHECK_SUBMIT_THREAD_ID || "").trim(),
    submitMessage: String(env.CODEX_MOBILE_BROWSER_SELF_CHECK_SUBMIT_MESSAGE || "Codex Mobile self-check test. Reply exactly: OK").slice(0, 500),
    submitRepeat: readPositiveInt(env.CODEX_MOBILE_BROWSER_SELF_CHECK_SUBMIT_REPEAT || "1", 1, 5),
    submitIntervalMs: readNonNegativeInt(env.CODEX_MOBILE_BROWSER_SELF_CHECK_SUBMIT_INTERVAL_MS || "120", 120, 5000),
    submitSampleDelaysMs: parseDelayList(env.CODEX_MOBILE_BROWSER_SELF_CHECK_SUBMIT_SAMPLE_DELAYS_MS || "100,350,900,1600,2800,6000", [100, 350, 900, 1600, 2800, 6000]),
    viewport: parseViewport(env.CODEX_MOBILE_BROWSER_SELF_CHECK_VIEWPORT || DEFAULT_VIEWPORT),
    headed: false,
    timeoutMs: readPositiveInt(env.CODEX_MOBILE_BROWSER_SELF_CHECK_TIMEOUT_MS || "20000", 20000, 120000),
    minSettledDelayMs: readPositiveInt(env.CODEX_MOBILE_BROWSER_SELF_CHECK_MIN_SETTLED_DELAY_MS || "1000", 1000, 10000),
    diagnosticSamples: /^(1|true|yes)$/i.test(String(env.CODEX_MOBILE_BROWSER_SELF_CHECK_DIAGNOSTIC_SAMPLES || "")),
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
    else if (arg === "--chrome-path") options.chromePath = next();
    else if (arg === "--thread-id") options.threadIds.push(next());
    else if (arg === "--sample-threads") options.sampleThreads = readPositiveInt(next(), options.sampleThreads, 20);
    else if (arg === "--list-limit") options.listLimit = readPositiveInt(next(), options.listLimit, 100);
    else if (arg === "--startup-only") options.startupOnly = true;
    else if (arg === "--vite-preview-only") options.vitePreviewOnly = true;
    else if (arg === "--vite-app-preview-only") options.viteAppPreviewOnly = true;
    else if (arg === "--vite-app-preview-runtime") options.viteAppPreviewRuntime = true;
    else if (arg === "--vite-app-preview-root") options.viteAppPreviewRoot = true;
    else if (arg === "--vite-app-preview-default-root") options.viteAppPreviewDefaultRoot = true;
    else if (arg === "--vite-app-preview-embed") options.viteAppPreviewEmbed = true;
    else if (arg === "--vite-app-preview-launch-session") options.viteAppPreviewLaunchSession = true;
    else if (arg === "--rounds") options.rounds = readPositiveInt(next(), options.rounds, 20);
    else if (arg === "--sample-delays-ms") options.sampleDelaysMs = parseDelayList(next(), options.sampleDelaysMs);
    else if (arg === "--thread-list-stress-rounds") options.threadListStressRounds = readNonNegativeInt(next(), options.threadListStressRounds, 20);
    else if (arg === "--exercise-submit") options.exerciseSubmit = true;
    else if (arg === "--submit-thread-id") options.submitThreadId = next();
    else if (arg === "--submit-message") options.submitMessage = next().slice(0, 500);
    else if (arg === "--submit-repeat") options.submitRepeat = readPositiveInt(next(), options.submitRepeat, 5);
    else if (arg === "--submit-interval-ms") options.submitIntervalMs = readNonNegativeInt(next(), options.submitIntervalMs, 5000);
    else if (arg === "--submit-sample-delays-ms") options.submitSampleDelaysMs = parseDelayList(next(), options.submitSampleDelaysMs);
    else if (arg === "--viewport") options.viewport = parseViewport(next());
    else if (arg === "--headed") options.headed = true;
    else if (arg === "--timeout-ms") options.timeoutMs = readPositiveInt(next(), options.timeoutMs, 120000);
    else if (arg === "--min-settled-delay-ms") options.minSettledDelayMs = readPositiveInt(next(), options.minSettledDelayMs, 10000);
    else if (arg === "--diagnostic-samples") options.diagnosticSamples = true;
    else if (arg === "--json") options.json = true;
    else throw new Error(`unknown option: ${arg}`);
  }
  options.server = normalizeBaseUrl(options.server);
  options.threadIds = options.threadIds.map((id) => String(id || "").trim()).filter(Boolean);
  options.submitThreadId = String(options.submitThreadId || "").trim();
  options.submitMessage = String(options.submitMessage || "Codex Mobile self-check test. Reply exactly: OK").slice(0, 500);
  options.submitRepeat = readPositiveInt(options.submitRepeat, 1, 5);
  options.submitIntervalMs = readNonNegativeInt(options.submitIntervalMs, 120, 5000);
  return options;
}

function readAccessKey(options = {}, env = process.env) {
  const inline = String(env.CODEX_MOBILE_KEY || env.CODEX_MOBILE_ACCESS_KEY || "").trim();
  if (inline) return inline;
  const key = fs.readFileSync(options.keyFile, "utf8").trim();
  if (!key) throw new Error("access key file is empty");
  return key;
}

function requestUrl(options, pathname, params = {}) {
  const url = new URL(pathname.replace(/^\//, ""), options.server);
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function fetchJson(url, options = {}, key = "", requestOptions = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const headers = Object.assign({}, requestOptions.headers || {});
    if (key) headers.Authorization = `Bearer ${key}`;
    if (requestOptions.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    const response = await fetch(url, {
      method: requestOptions.method || "GET",
      headers,
      body: requestOptions.body,
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch (_) {
      parsed = {};
    }
    if (!response.ok) {
      const err = new Error(`http_${response.status}`);
      err.status = response.status;
      throw err;
    }
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

async function createHermesAppPreviewLaunch(options = {}, key = "") {
  const evidence = {
    attempted: true,
    ok: false,
    entryPathReceived: false,
    tokenParamPresent: false,
    workspaceIdPresent: false,
    expiresIn: 0,
    appPreviewPath: "/vite-shell/app-preview.html",
    errorCode: "",
  };
  try {
    const launch = await fetchJson(requestUrl(options, "/api/v1/hermes/plugin/launch"), options, key, {
      method: "POST",
      body: JSON.stringify({ workspace_id: "owner" }),
    });
    const entryPath = String(launch && launch.entry_path || "");
    evidence.entryPathReceived = Boolean(entryPath);
    evidence.expiresIn = Math.max(0, Math.trunc(Number(launch && launch.expires_in || 0)));
    const entryUrl = new URL(entryPath || "/", options.server);
    const launchToken = String(entryUrl.searchParams.get("codexPluginLaunch") || entryUrl.searchParams.get("pluginLaunch") || "").trim();
    evidence.tokenParamPresent = Boolean(launchToken);
    evidence.workspaceIdPresent = Boolean(String(entryUrl.searchParams.get("workspaceId") || "").trim());
    const params = {
      embed: "hermes",
      codexPluginLaunch: launchToken,
      workspaceId: entryUrl.searchParams.get("workspaceId") || "owner",
      pluginTheme: entryUrl.searchParams.get("pluginTheme") || "",
      pluginFontSize: entryUrl.searchParams.get("pluginFontSize") || "",
    };
    evidence.ok = Boolean(launch && launch.ok !== false && launchToken);
    return {
      evidence,
      url: evidence.ok ? requestUrl(options, "/vite-shell/app-preview.html", params) : "",
    };
  } catch (err) {
    evidence.errorCode = boundedToken(err && err.message, "plugin_launch_create_failed");
    return { evidence, url: "" };
  }
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    return {
      ok: response.ok,
      status: Math.max(0, Math.trunc(Number(response.status || 0))),
      text,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function readStaticShellReadback(options = {}, config = {}) {
  const assets = [];
  const readAsset = async (pathname) => {
    try {
      const result = await fetchText(requestUrl(options, pathname), options);
      assets.push({
        path: pathname,
        status: result.status,
        bytes: Buffer.byteLength(String(result.text || ""), "utf8"),
      });
      return result;
    } catch (err) {
      assets.push({
        path: pathname,
        status: 0,
        bytes: 0,
        errorCode: boundedToken(err && err.message, "asset_fetch_failed"),
      });
      return { ok: false, status: 0, text: "" };
    }
  };
  const app = await readAsset("/app.js");
  const appBootstrap = await readAsset("/app-bootstrap.js");
  const shellManifestJs = await readAsset("/shell-asset-manifest.js");
  const shellManifestJson = await readAsset("/shell-asset-manifest.json");
  const sw = await readAsset("/sw.js");
  const runtimeAssets = await Promise.all([
    readAsset("/composer-runtime.js"),
    readAsset("/thread-list-runtime.js"),
    readAsset("/thread-tile-runtime.js"),
  ]);
  const clientBuildId = String(config && config.clientBuildId || "").trim();
  const shellCacheName = String(config && config.shellCacheName || "").trim();
  const clientBuildMatches = clientBuildId
    ? String(`${shellManifestJs.text || ""}\n${shellManifestJson.text || ""}\n${appBootstrap.text || ""}\n${app.text || ""}`)
      .includes(JSON.stringify(clientBuildId))
    : false;
  const shellCacheMatches = shellCacheName
    ? String(`${shellManifestJs.text || ""}\n${shellManifestJson.text || ""}\n${sw.text || ""}`)
      .includes(JSON.stringify(shellCacheName))
    : false;
  const assetStatusOk = assets.every((asset) => asset.status >= 200 && asset.status < 300);
  const runtimeAssetCount = runtimeAssets.filter((asset) => asset && asset.ok).length;
  return {
    ok: assetStatusOk && clientBuildMatches && shellCacheMatches && runtimeAssetCount === 3,
    assetStatusOk,
    clientBuildMatches,
    shellCacheMatches,
    runtimeAssetCount,
    assets,
  };
}

function shortHash(value) {
  return stableTextHash(value);
}

function browserStableHash(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function threadRows(listResult = {}) {
  const candidates = [
    listResult.data,
    listResult.threads,
    listResult.items,
    listResult && listResult.result && listResult.result.threads,
  ];
  for (const value of candidates) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function threadId(row = {}) {
  return String(row && (row.id || row.threadId || row.thread_id) || "").trim();
}

function isActiveThreadRow(row = {}) {
  const status = statusText(
    row.status
    || row.threadStatus
    || row.thread_status
    || row.state
    || row.lifecycle
    || row.runtimeStatus
  );
  if (!status || completedStatus(status)) return false;
  return /active|running|in[_-]?progress|working|queued|pending/i.test(status);
}

function uniqueThreadIds(rows = []) {
  const ids = [];
  const seen = new Set();
  for (const row of rows || []) {
    const id = threadId(row);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function selectThreadIdsForSampling(rows = [], sampleThreads = 3) {
  const limit = readPositiveInt(sampleThreads, 3, 20);
  const activeIds = uniqueThreadIds((rows || []).filter(isActiveThreadRow));
  const allIds = uniqueThreadIds(rows || []);
  return uniqueThreadIds([
    ...activeIds.map((id) => ({ id })),
    ...allIds.map((id) => ({ id })),
  ]).slice(0, limit);
}

function detailThread(detail = {}) {
  const thread = detail && (detail.thread || detail.data || detail);
  return thread && typeof thread === "object" ? thread : {};
}

function expectedMaxVisibleTurnsForThread(thread = {}) {
  if ((thread.mobileRawThreadRead || String(thread.mobileReadMode || "") === "thread-read-raw") && !thread.mobileHistoryExpanded) {
    return 4;
  }
  return thread.mobileHistoryExpanded ? 200 : 10;
}

function visibleTurnsForExpectation(thread = {}) {
  const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
  return turns.slice(-expectedMaxVisibleTurnsForThread(thread));
}

function expectedItemType(item = {}) {
  return String(item && item.type || "").trim();
}

function expectedIsReasoningItem(item = {}) {
  return expectedItemType(item) === "reasoning";
}

function expectedIsWebSearchLikeItem(item = {}) {
  if (!item) return false;
  return /web[_-]?search|websearch|search_query|image_query/i.test([
    item.type,
    item.tool,
    item.name,
    item.namespace,
    item.server,
  ].filter(Boolean).join(" "));
}

function expectedIsOperationalItem(item = {}) {
  return /^(commandExecution|fileChange|dynamicToolCall|mcpToolCall|collabAgentToolCall)$/i.test(expectedItemType(item))
    || expectedIsWebSearchLikeItem(item);
}

function expectedIsTurnUsageSummaryItem(item = {}) {
  return expectedItemType(item) === "turnUsageSummary";
}

function expectedIsContextCompactionType(type) {
  return /context.*compaction|context.*compression|context_compaction|context_compression/i.test(String(type || ""));
}

function expectedIsContextCompactionItem(item = {}) {
  return Boolean(item && (expectedIsContextCompactionType(item.type)
    || item.mobileNotice === "Context compaction complete"
    || item.mobileNotice === "Context compaction pending"
    || item.mobileCompactionStatus));
}

function expectedContextCompactionStatusKind(value) {
  const text = statusText(value).toLowerCase();
  if (!text) return "";
  if (/completed|failed|cancel|error|interrupted/.test(text)) return "complete";
  if (/running|active|queued|processing|inprogress|in_progress|in-progress|pending|started/.test(text)) return "pending";
  return "";
}

function expectedCanShowPendingContextCompaction(turn = {}, thread = {}) {
  return !turn || (expectedIsLatestTurn(turn, thread) && expectedIsLiveTurn(turn, thread));
}

function expectedContextCompactionState(item = {}, turn = {}, thread = {}) {
  if (!item) return "";
  const itemKind = expectedContextCompactionStatusKind(item.status);
  const mobileKind = expectedContextCompactionStatusKind(item.mobileCompactionStatus);
  if (itemKind === "complete" || mobileKind === "complete" || item.mobileNotice === "Context compaction complete") {
    return "complete";
  }
  if (itemKind === "pending" || mobileKind === "pending" || item.mobileNotice === "Context compaction pending") {
    return expectedCanShowPendingContextCompaction(turn, thread) ? "pending" : "";
  }
  return "";
}

function expectedContextCompactionNotice(item = {}, turn = {}, thread = {}) {
  const stateText = expectedContextCompactionState(item, turn, thread);
  if (stateText === "pending") return "Context compaction pending";
  if (stateText === "complete") return "Context compaction complete";
  return "";
}

function expectedUserMessageHasVisualAttachment(item = {}) {
  const parts = Array.isArray(item && item.content) ? item.content : [];
  return parts.some((part) => {
    const type = String(part && part.type || "").toLowerCase();
    return /image|file|attachment/.test(type) || Boolean(part && (part.image_url || part.image || part.path || part.url));
  });
}

function expectedIsSupersededLiveTurn(turn = {}) {
  return Boolean(turn && (turn.mobileSupersededLive || (turn.status && turn.status.mobileSupersededLive)));
}

function expectedVisibleItemsForTurn(turn = {}, thread = {}) {
  const visible = [];
  const contextEntryByKey = new Map();
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  items.forEach((item, index) => {
    if (!item) return;
    if (expectedIsReasoningItem(item)) return;
    if (expectedIsSupersededLiveTurn(turn)
      && expectedItemType(item) === "userMessage"
      && !expectedUserMessageHasVisualAttachment(item)) return;
    if (expectedIsContextCompactionItem(item)) {
      const notice = expectedContextCompactionNotice(item, turn, thread);
      if (!notice) return;
      const groupKey = "context-compaction";
      const existing = contextEntryByKey.get(groupKey);
      if (existing) visible[existing.visibleIndex] = null;
      contextEntryByKey.set(groupKey, { visibleIndex: visible.length });
      visible.push({ item, sourceIndex: index });
      return;
    }
    if (expectedIsOperationalItem(item)) return;
    visible.push({ item, sourceIndex: index });
  });
  const filteredVisible = visible.filter(Boolean);
  if (expectedIsSupersededLiveTurn(turn)
    && filteredVisible.length
    && filteredVisible.every((entry) => expectedIsTurnUsageSummaryItem(entry && entry.item))) {
    return [];
  }
  if ((thread.mobileRawThreadRead || String(thread.mobileReadMode || "") === "thread-read-raw")
    && Array.isArray(filteredVisible)
    && filteredVisible.length > 20) {
    return filteredVisible.slice(-20);
  }
  return filteredVisible;
}

function expectedVisibleItemBudgetForTurn(turn = {}) {
  const budget = turn && turn.mobileVisibleItemBudget && typeof turn.mobileVisibleItemBudget === "object"
    ? turn.mobileVisibleItemBudget
    : {};
  const omitted = Math.max(0, Math.trunc(Number(turn && (turn.mobileOmittedVisibleItemCount || budget.omitted) || 0)));
  return omitted > 0 ? { omitted } : null;
}

function expectedTurnHasThreadTaskCardRequest(turn = {}) {
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  return items.some((item) => {
    if (!item || item.type !== "userMessage") return false;
    const parts = Array.isArray(item.content) ? item.content : [];
    return parts.some((part) => /<thread_task_card_request>|Task card id:|Source workspace:/i.test(inputTextValue(part)));
  });
}

function expectedTurnHasThreadTaskCardDraftResponse(turn = {}) {
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  return items.some((item) => item
    && /^(agentMessage|plan)$/i.test(String(item.type || ""))
    && String(item.text || "").includes("<thread_task_card_draft>"));
}

function expectedTurnComplete(turn = {}) {
  return Boolean(turn && (turn.completedAt || turn.durationMs || completedStatus(turn.status)));
}

function expectedRunningStatus(value) {
  const text = statusText(value).toLowerCase();
  return /(running|active|queued|processing|inprogress|in_progress|in-progress)/.test(text)
    && !/(completed|failed|cancel|error|interrupted)/.test(text);
}

function latestExpectedDisplayTurn(thread = {}) {
  const turns = visibleTurnsForExpectation(thread);
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn && Array.isArray(turn.items) && turn.items.some(Boolean)) return turn;
  }
  return turns.length ? turns[turns.length - 1] : null;
}

function expectedIsLatestTurn(turn = {}, thread = {}) {
  return Boolean(turn && latestExpectedDisplayTurn(thread) === turn);
}

function expectedIsLiveTurn(turn = {}, thread = {}) {
  if (!turn || expectedTurnComplete(turn)) return false;
  return expectedRunningStatus(turn.status)
    || (expectedIsLatestTurn(turn, thread) && expectedRunningStatus(thread.status));
}

function expectedTurnRendersConversationArticle(turn = {}, thread = {}) {
  if (!turn || !turn.id) return false;
  if (expectedVisibleItemsForTurn(turn, thread).length > 0) return true;
  if (expectedVisibleItemBudgetForTurn(turn)) return true;
  return Boolean(
    expectedIsLatestTurn(turn, thread)
    && expectedIsLiveTurn(turn, thread)
    && expectedTurnHasThreadTaskCardRequest(turn)
    && !expectedTurnHasThreadTaskCardDraftResponse(turn)
  );
}

function renderableTurnsForExpectation(thread = {}) {
  return visibleTurnsForExpectation(thread)
    .filter((turn) => expectedTurnRendersConversationArticle(turn, thread));
}

function visibleTurnIds(detail = {}) {
  const thread = detailThread(detail);
  return renderableTurnsForExpectation(thread).map((turn) => String(turn && turn.id || "")).filter(Boolean);
}

function statusText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && value.type) return String(value.type || "");
  return String(value || "");
}

function completedStatus(value) {
  return /completed|failed|cancel|error|interrupted/i.test(statusText(value));
}

function staleActiveStatus(value) {
  return Boolean(value && typeof value === "object" && value.mobileStaleActiveTurn === true);
}

function staleActiveTurn(turn = {}) {
  return Boolean(turn && (turn.mobileStaleActiveTurn === true || staleActiveStatus(turn.status)));
}

function inputTextValue(part = {}) {
  if (!part || typeof part !== "object") return "";
  return String(part.text || part.input_text || part.value || part.content || "");
}

function isInjectedThreadTaskCardText(value) {
  const text = String(value || "").replace(/\r\n?/g, "\n").trim();
  return text.startsWith("[Cross-thread task card sent by source thread]")
    || text.startsWith("[Cross-thread task card approved]");
}

function isInjectedThreadTaskCardItem(item = {}) {
  if (!item || item.type !== "userMessage") return false;
  const parts = Array.isArray(item.content) ? item.content : [];
  return parts.some((part) => isInjectedThreadTaskCardText(inputTextValue(part)));
}

function userMessageComparableText(item = {}) {
  const parts = Array.isArray(item.content) ? item.content : [];
  const values = [];
  for (const part of parts) {
    const value = inputTextValue(part);
    if (value) values.push(value);
  }
  if (typeof item.text === "string") values.push(item.text);
  if (typeof item.message === "string") values.push(item.message);
  return values.join("\n").replace(/\s+/g, " ").trim();
}

function timestampMs(value) {
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) {
    return number > 1_000_000_000_000 ? Math.trunc(number) : Math.trunc(number * 1000);
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function itemTimestampMs(item = {}) {
  return timestampMs(
    item.startedAtMs
    || item.startedAt
    || item.createdAtMs
    || item.createdAt
    || item.timestampMs
    || item.timestamp
    || item.mobileDisplayTimestampMs
    || item.mobileDisplayTimestamp,
  );
}

function turnItemTimestampRange(items = []) {
  const values = (Array.isArray(items) ? items : [])
    .map(itemTimestampMs)
    .filter((value) => Number.isFinite(value) && value > 0);
  return {
    firstTimestampMs: values.length ? Math.min(...values) : 0,
    lastTimestampMs: values.length ? Math.max(...values) : 0,
  };
}

function expectedItemKind(item = {}) {
  const type = String(item && item.type || "").trim();
  if (!type) return "unknown";
  if (/^agentMessage$/i.test(type)) return "agentMessage";
  if (/^userMessage$/i.test(type)) return isInjectedThreadTaskCardItem(item) ? "threadTaskCard" : "userMessage";
  if (/^plan$/i.test(type)) return "plan";
  if (/^turnUsageSummary$/i.test(type)) return "turnUsageSummary";
  if (/^reasoning$/i.test(type)) return "reasoning";
  if (/^(commandExecution|fileChange|dynamicToolCall|mcpToolCall|collabAgentToolCall)$/i.test(type)) return "operation";
  if (/^contextCompaction$/i.test(type)) return "contextCompaction";
  if (/^turnDiagnostic$/i.test(type)) return "turnDiagnostic";
  return "other";
}

function itemOrderShape(items = []) {
  const kinds = (Array.isArray(items) ? items : []).map(expectedItemKind);
  let assistantLikeSeen = false;
  let userAfterAssistantLikeCount = 0;
  for (const kind of kinds) {
    if (kind === "userMessage") {
      if (assistantLikeSeen) userAfterAssistantLikeCount += 1;
      continue;
    }
    if (["agentMessage", "plan", "operation", "reasoning", "contextCompaction", "turnUsageSummary"].includes(kind)) {
      assistantLikeSeen = true;
    }
  }
  return {
    itemKindSequence: kinds.slice(0, 60),
    userAfterAssistantLikeCount,
    userAtTail: kinds.length ? kinds[kinds.length - 1] === "userMessage" : false,
  };
}

function duplicateLatestUserMessageEventCount(userItems = []) {
  const seen = new Set();
  let duplicates = 0;
  for (const item of userItems) {
    const textHash = shortHash(userMessageComparableText(item));
    const time = itemTimestampMs(item);
    if (!textHash || !time) continue;
    const key = `${textHash}:${time}`;
    if (seen.has(key)) duplicates += 1;
    else seen.add(key);
  }
  return duplicates;
}

function latestTurnExpectation(detail = {}) {
  const thread = detailThread(detail);
  const renderableTurns = renderableTurnsForExpectation(thread);
  const latest = renderableTurns.length ? renderableTurns[renderableTurns.length - 1] : null;
  const visibleEntries = expectedVisibleItemsForTurn(latest, thread);
  const items = visibleEntries.map((entry) => entry && entry.item).filter(Boolean);
  const userItems = items.filter((item) => item && /^userMessage$/i.test(String(item.type || "")));
  const injectedTaskCardUserItems = userItems.filter(isInjectedThreadTaskCardItem);
  const ordinaryUserItems = userItems.filter((item) => !isInjectedThreadTaskCardItem(item));
  const itemTypes = items
    .map((item) => String(item && item.type || "unknown").trim() || "unknown")
    .slice(0, 80);
  return {
    expectedLatestUsageRequired: Boolean(latest && completedStatus(latest.status) && itemTypes.includes("turnUsageSummary")),
    expectedLatestItemCount: items.length,
    expectedLatestUserMessageCount: Math.max(0, userItems.length - injectedTaskCardUserItems.length),
    expectedLatestAssistantMessageCount: itemTypes.filter((type) => /^(agentMessage|plan)$/i.test(type)).length,
    expectedLatestUserMessageDuplicateCount: duplicateLatestUserMessageEventCount(ordinaryUserItems),
    expectedLatestTaskCardUserMessageCount: injectedTaskCardUserItems.length,
    expectedLatestOperationItemCount: itemTypes.filter((type) => /^(commandExecution|fileChange|dynamicToolCall|mcpToolCall|collabAgentToolCall)$/i.test(type)).length,
    expectedLatestReasoningItemCount: itemTypes.filter((type) => /^reasoning$/i.test(type)).length,
    expectedLatestTimestampItemCount: itemTypes.filter((type) => /^(userMessage|agentMessage|plan|turnDiagnostic)$/i.test(type)).length,
  };
}

function turnShapeExpectation(detail = {}) {
  const thread = detailThread(detail);
  const turns = renderableTurnsForExpectation(thread);
  return turns.slice(-20).map((turn, index) => {
    const items = expectedVisibleItemsForTurn(turn, thread).map((entry) => entry && entry.item).filter(Boolean);
    const userItems = items.filter((item) => item && /^userMessage$/i.test(String(item.type || "")));
    const injectedTaskCardUserItems = userItems.filter(isInjectedThreadTaskCardItem);
    const itemTypes = items.map((item) => String(item && item.type || "unknown").trim() || "unknown");
    const timestampRange = turnItemTimestampRange(items);
    const orderShape = itemOrderShape(items);
    return {
      index,
      turnHash: browserStableHash(turn && turn.id || ""),
      completed: completedStatus(turn && turn.status),
      staleActive: staleActiveTurn(turn),
      expectedFirstTimestampMs: timestampRange.firstTimestampMs,
      expectedLastTimestampMs: timestampRange.lastTimestampMs,
      expectedItemCount: items.length,
      expectedUserMessageCount: Math.max(0, userItems.length - injectedTaskCardUserItems.length),
      expectedTaskCardUserMessageCount: injectedTaskCardUserItems.length,
      expectedAssistantMessageCount: itemTypes.filter((type) => /^(agentMessage|plan)$/i.test(type)).length,
      expectedUsageRequired: Boolean(completedStatus(turn && turn.status) && itemTypes.includes("turnUsageSummary")),
      expectedTimestampItemCount: itemTypes.filter((type) => /^(userMessage|agentMessage|plan|turnDiagnostic)$/i.test(type)).length,
      expectedItemKindSequence: orderShape.itemKindSequence,
      expectedUserAfterAssistantLikeCount: orderShape.userAfterAssistantLikeCount,
      expectedUserAtTail: orderShape.userAtTail,
    };
  });
}

function diagnosticTurnShape(row = {}) {
  const source = row && typeof row === "object" ? row : {};
  return {
    index: Math.max(0, Math.trunc(Number(source.index || 0))),
    turnHash: String(source.turnHash || "").slice(0, 32),
    completed: source.completed === true,
    expectedItemCount: Math.max(0, Math.trunc(Number(source.expectedItemCount || 0))),
    itemCount: Math.max(0, Math.trunc(Number(source.itemCount || 0))),
    expectedUserMessageCount: Math.max(0, Math.trunc(Number(source.expectedUserMessageCount || 0))),
    userMessageCount: Math.max(0, Math.trunc(Number(source.userMessageCount || 0))),
    expectedAssistantMessageCount: Math.max(0, Math.trunc(Number(source.expectedAssistantMessageCount || 0))),
    assistantMessageCount: Math.max(0, Math.trunc(Number(source.assistantMessageCount || 0))),
    expectedUserAfterAssistantLikeCount: Math.max(0, Math.trunc(Number(source.expectedUserAfterAssistantLikeCount || 0))),
    userAfterAssistantLikeCount: Math.max(0, Math.trunc(Number(source.userAfterAssistantLikeCount || 0))),
    expectedUserAtTail: source.expectedUserAtTail === true,
    userAtTail: source.userAtTail === true,
    expectedItemKindSequence: Array.isArray(source.expectedItemKindSequence) ? source.expectedItemKindSequence.slice(0, 40) : [],
    itemKindSequence: Array.isArray(source.itemKindSequence) ? source.itemKindSequence.slice(0, 40) : [],
  };
}

function boundedDiagnosticSamples(samples = []) {
  return (Array.isArray(samples) ? samples : [])
    .filter((sample) => sample && typeof sample === "object" && sample.probeKind !== "thread-list-interaction")
    .slice(-12)
    .map((sample) => ({
      label: String(sample.label || "").slice(0, 80),
      threadHash: String(sample.threadHash || "").slice(0, 32),
      delayMs: Math.max(0, Math.trunc(Number(sample.delayMs || 0))),
      latestTurnHash: String(sample.latestTurnHash || "").slice(0, 32),
      latestTurnMatchesTarget: sample.latestTurnMatchesTarget === true,
      latestTurnAtDomBottom: sample.latestTurnAtDomBottom === true,
      expectedLatestItemCount: Math.max(0, Math.trunc(Number(sample.expectedLatestItemCount || 0))),
      latestTurnItemCount: Math.max(0, Math.trunc(Number(sample.latestTurnItemCount || 0))),
      expectedLatestUserMessageCount: Math.max(0, Math.trunc(Number(sample.expectedLatestUserMessageCount || 0))),
      latestTurnUserMessageCount: Math.max(0, Math.trunc(Number(sample.latestTurnUserMessageCount || 0))),
      expectedLatestAssistantMessageCount: Math.max(0, Math.trunc(Number(sample.expectedLatestAssistantMessageCount || 0))),
      latestTurnAssistantMessageCount: Math.max(0, Math.trunc(Number(sample.latestTurnAssistantMessageCount || 0))),
      expectedReadMode: boundedToken(sample.expectedReadMode || sample.readMode || "", "", 80),
      expectedReadDecision: boundedToken(sample.expectedReadDecision || sample.readDecision || "", "", 80),
      expectedPerformancePhase: boundedToken(sample.expectedPerformancePhase || sample.performancePhase || "", "", 80),
      latestTurnOperationItemCount: Math.max(0, Math.trunc(Number(sample.latestTurnOperationItemCount || 0))),
      latestTurnReasoningItemCount: Math.max(0, Math.trunc(Number(sample.latestTurnReasoningItemCount || 0))),
      clientSubmissionCount: Math.max(0, Math.trunc(Number(sample.clientSubmissionCount || 0))),
      returnLedgerCount: Math.max(0, Math.trunc(Number(sample.returnLedgerCount || 0))),
      returnLedgerVisibleCount: Math.max(0, Math.trunc(Number(sample.returnLedgerVisibleCount || 0))),
      returnLedgerProjectionFailedCount: Math.max(0, Math.trunc(Number(sample.returnLedgerProjectionFailedCount || 0))),
      returnLedgerDeliveryFailedCount: Math.max(0, Math.trunc(Number(sample.returnLedgerDeliveryFailedCount || 0))),
      returnLedgerIssueCodes: Array.isArray(sample.returnLedgerIssueCodes) ? sample.returnLedgerIssueCodes.slice(0, 8) : [],
      returnReceiptVisibleCount: Math.max(0, Math.trunc(Number(sample.returnReceiptVisibleCount || 0))),
      returnReceiptTurnVisibleCount: Math.max(0, Math.trunc(Number(sample.returnReceiptTurnVisibleCount || 0))),
      returnReceiptTurnAtDomBottom: sample.returnReceiptTurnAtDomBottom === true,
      returnFollowUpTaskCardCount: Math.max(0, Math.trunc(Number(sample.returnFollowUpTaskCardCount || 0))),
      returnFollowUpBadgeVisibleCount: Math.max(0, Math.trunc(Number(sample.returnFollowUpBadgeVisibleCount || 0))),
      latestTurnUserTextDuplicateCount: Math.max(0, Math.trunc(Number(sample.latestTurnUserTextDuplicateCount || 0))),
      allUserEventDuplicateCount: Math.max(0, Math.trunc(Number(sample.allUserEventDuplicateCount || 0))),
      pluginRefreshBannerSeededForThreadEntry: sample.pluginRefreshBannerSeededForThreadEntry === true,
      pluginRefreshBannerVisibleAfterThreadEntry: sample.pluginRefreshBannerVisibleAfterThreadEntry === true,
      latestTurnUserNodeDetails: Array.isArray(sample.latestTurnUserNodeDetails) ? sample.latestTurnUserNodeDetails.slice(0, 6) : [],
      expectedTurnShapes: (Array.isArray(sample.expectedTurnShapes) ? sample.expectedTurnShapes : []).slice(-3).map(diagnosticTurnShape),
      domTurnShapes: (Array.isArray(sample.domTurnShapes) ? sample.domTurnShapes : []).slice(-3).map(diagnosticTurnShape),
    }));
}

function safeThreadPlan(ids = []) {
  return ids.map((id) => ({
    threadHash: shortHash(id),
    expectedTurnHashCount: 0,
    expectedLatestTurnHash: "",
    returnLedgerCount: 0,
    returnLedgerVisibleCount: 0,
    returnLedgerProjectionFailedCount: 0,
    returnLedgerDeliveryFailedCount: 0,
    returnLedgerIssueCodes: [],
  }));
}

async function loadThreadPlan(options, key, ids) {
  const plan = [];
  for (const id of ids) {
    let expectedTurnHashes = [];
    let expectation = latestTurnExpectation();
    let expectedTurnShapes = [];
    let expectedReadMode = "";
    let expectedReadDecision = "";
    let expectedPerformancePhase = "";
    let returnLedgerCount = 0;
    let returnLedgerVisibleCount = 0;
    let returnLedgerProjectionFailedCount = 0;
    let returnLedgerDeliveryFailedCount = 0;
    let returnLedgerIssueCodes = [];
    let returnFollowUpTaskCardCount = 0;
    try {
      const detail = await fetchJson(requestUrl(options, `/api/threads/${encodeURIComponent(id)}`, {
        mode: "recent",
        budget: "full",
      }), options, key);
      expectedTurnHashes = visibleTurnIds(detail).map(browserStableHash);
      expectation = latestTurnExpectation(detail);
      expectedTurnShapes = turnShapeExpectation(detail);
      const thread = detailThread(detail);
      const timings = thread
        && thread.mobileDiagnostics
        && thread.mobileDiagnostics.threadDetailTimings
        && typeof thread.mobileDiagnostics.threadDetailTimings === "object"
        ? thread.mobileDiagnostics.threadDetailTimings
        : {};
      expectedReadMode = boundedToken(thread && thread.mobileReadMode || "", "", 80);
      expectedReadDecision = boundedToken(timings.readDecision || "", "", 80);
      expectedPerformancePhase = boundedToken(timings.performancePhase || "", "", 80);
      returnFollowUpTaskCardCount = Math.max(0, Number(thread && thread.returnFollowUpTaskCardCount || 0) || 0);
      const returnLedger = Array.isArray(thread && thread.taskCardReturnLedger)
        ? thread.taskCardReturnLedger
        : [];
      const ledgerStatusCounts = thread
        && thread.taskCardReturnLedgerStatusCounts
        && typeof thread.taskCardReturnLedgerStatusCounts === "object"
        ? thread.taskCardReturnLedgerStatusCounts
        : {};
      const ledgerIssueSet = new Set(Array.isArray(thread && thread.taskCardReturnLedgerIssueCodes)
        ? thread.taskCardReturnLedgerIssueCodes
        : []);
      returnLedgerCount = returnLedger.length;
      returnLedgerVisibleCount = Math.max(0, Number(ledgerStatusCounts.return_visible || 0) || 0);
      returnLedgerProjectionFailedCount = Math.max(0, Number(ledgerStatusCounts.return_projection_failed || 0) || 0);
      returnLedgerDeliveryFailedCount = Math.max(0, Number(ledgerStatusCounts.return_delivery_failed || 0) || 0);
      for (const entry of returnLedger) {
        const status = boundedToken(entry && entry.status || "", "", 80);
        if (status === "return_visible") returnLedgerVisibleCount += ledgerStatusCounts.return_visible ? 0 : 1;
        if (status === "return_projection_failed") returnLedgerProjectionFailedCount += ledgerStatusCounts.return_projection_failed ? 0 : 1;
        if (status === "return_delivery_failed") returnLedgerDeliveryFailedCount += ledgerStatusCounts.return_delivery_failed ? 0 : 1;
        for (const code of Array.isArray(entry && entry.issueCodes) ? entry.issueCodes : []) {
          const issueCode = boundedToken(code, "", 120);
          if (issueCode) ledgerIssueSet.add(issueCode);
        }
      }
      returnLedgerIssueCodes = Array.from(ledgerIssueSet).slice(0, 12);
    } catch (_) {
      expectedTurnHashes = [];
    }
    plan.push({
      id,
      threadHash: shortHash(id),
      expectedTurnHashes,
      expectedLatestTurnHash: expectedTurnHashes[expectedTurnHashes.length - 1] || "",
      expectedTurnHashCount: expectedTurnHashes.length,
      expectedLatestUsageRequired: expectation.expectedLatestUsageRequired,
      expectedLatestItemCount: expectation.expectedLatestItemCount,
      expectedLatestUserMessageCount: expectation.expectedLatestUserMessageCount,
      expectedLatestAssistantMessageCount: expectation.expectedLatestAssistantMessageCount,
      expectedLatestUserMessageDuplicateCount: expectation.expectedLatestUserMessageDuplicateCount,
      expectedLatestTaskCardUserMessageCount: expectation.expectedLatestTaskCardUserMessageCount,
      expectedLatestOperationItemCount: expectation.expectedLatestOperationItemCount,
      expectedLatestReasoningItemCount: expectation.expectedLatestReasoningItemCount,
      expectedLatestTimestampItemCount: expectation.expectedLatestTimestampItemCount,
      expectedTurnShapes,
      expectedReadMode,
      expectedReadDecision,
      expectedPerformancePhase,
      returnLedgerCount,
      returnLedgerVisibleCount,
      returnLedgerProjectionFailedCount,
      returnLedgerDeliveryFailedCount,
      returnLedgerIssueCodes,
      returnFollowUpTaskCardCount,
    });
  }
  return plan;
}

async function refreshThreadPlanEntry(options, key, entry) {
  if (!entry || !entry.id) return entry;
  try {
    const plan = await loadThreadPlan(options, key, [entry.id]);
    return plan[0] || entry;
  } catch (_) {
    return entry;
  }
}

function snapshotInputForPlanEntry(entry, extra = {}) {
  return Object.assign({
    threadId: entry.id,
    threadHash: entry.threadHash,
    dynamicThreadPlan: true,
    expectedTurnHashes: entry.expectedTurnHashes,
    expectedLatestTurnHash: entry.expectedLatestTurnHash,
    expectedLatestUsageRequired: entry.expectedLatestUsageRequired,
    expectedLatestItemCount: entry.expectedLatestItemCount,
    expectedLatestUserMessageCount: entry.expectedLatestUserMessageCount,
    expectedLatestAssistantMessageCount: entry.expectedLatestAssistantMessageCount,
    expectedLatestUserMessageDuplicateCount: entry.expectedLatestUserMessageDuplicateCount,
    expectedLatestTaskCardUserMessageCount: entry.expectedLatestTaskCardUserMessageCount,
    expectedTurnShapes: entry.expectedTurnShapes,
    expectedReadMode: entry.expectedReadMode,
    expectedReadDecision: entry.expectedReadDecision,
    expectedPerformancePhase: entry.expectedPerformancePhase,
    returnLedgerCount: entry.returnLedgerCount,
    returnLedgerVisibleCount: entry.returnLedgerVisibleCount,
    returnLedgerProjectionFailedCount: entry.returnLedgerProjectionFailedCount,
    returnLedgerDeliveryFailedCount: entry.returnLedgerDeliveryFailedCount,
    returnLedgerIssueCodes: entry.returnLedgerIssueCodes,
  }, extra);
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && address.port;
      server.close(() => resolve(port));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function endpointKind(value) {
  try {
    const url = new URL(value || DEFAULT_SERVER);
    const host = String(url.hostname || "").toLowerCase();
    if (host === "127.0.0.1" || host === "localhost" || host === "::1") return "local";
    return "remote";
  } catch (_) {
    return "unknown";
  }
}

function boundedToken(value, fallback = "unknown", max = 80) {
  return String(value || fallback)
    .replace(/[^a-z0-9_.:-]+/gi, "_")
    .slice(0, max) || fallback;
}

function routeKind(rawUrl = "") {
  try {
    const parsed = new URL(rawUrl);
    const pathname = parsed.pathname || "/";
    if (pathname === "/api/public-config") return "public_config";
    if (pathname === "/api/client-events") return "client_events";
    if (pathname === "/api/threads") return "thread_list";
    if (/^\/api\/threads\/[^/]+$/.test(pathname)) return "thread_detail";
    if (/^\/api\/events/.test(pathname)) return "event_stream";
    if (/\/api\/uploads\/file$/.test(pathname)) return "upload_file";
    if (/\/api\/generated-images\/file$/.test(pathname)) return "generated_image";
    if (pathname.endsWith(".js")) return "static_js";
    if (pathname.endsWith(".css")) return "static_css";
    return "other";
  } catch (_) {
    return "unknown";
  }
}

function safeConsoleText(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("not allowed to load local resource")) return "local_resource_blocked";
  if (text.includes("failed to load resource")) return "resource_load_failed";
  if (text.includes("typeerror") || text.includes("cannot read properties")) return "type_error";
  if (text.includes("referenceerror") || text.includes("is not defined")) return "reference_error";
  if (text.includes("syntaxerror")) return "syntax_error";
  if (text.includes("rangeerror")) return "range_error";
  if (text.includes("uncaught")) return "uncaught";
  if (text.includes("error")) return "console_error";
  if (text.includes("warning")) return "console_warning";
  return "console_event";
}

function boundedException(details = {}) {
  const exception = details && details.exception && typeof details.exception === "object"
    ? details.exception
    : {};
  const raw = [
    details && details.text,
    exception.className,
    exception.description,
  ].filter(Boolean).join(" | ");
  return {
    code: safeConsoleText(raw || "exception"),
    label: boundedToken(raw || "exception", "exception", 80),
    detailHash: shortHash(raw || "exception"),
  };
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = [];
    this.socket = null;
  }

  async connect(timeoutMs = 10000) {
    if (typeof WebSocket !== "function") throw new Error("node_websocket_unavailable");
    this.socket = new WebSocket(this.webSocketUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("cdp_connect_timeout")), timeoutMs);
      this.socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("cdp_connect_failed"));
      }, { once: true });
    });
    this.socket.addEventListener("message", (event) => this.handleMessage(event));
    this.socket.addEventListener("close", () => {
      for (const entry of this.pending.values()) entry.reject(new Error("cdp_closed"));
      this.pending.clear();
    });
  }

  handleMessage(event) {
    let message = null;
    try {
      message = JSON.parse(String(event.data || ""));
    } catch (_) {
      return;
    }
    if (message.id && this.pending.has(message.id)) {
      const entry = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) entry.reject(new Error(boundedToken(message.error.message, "cdp_error")));
      else entry.resolve(message.result || {});
      return;
    }
    for (const handler of this.handlers) handler(message);
  }

  onEvent(handler) {
    this.handlers.push(handler);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(payload);
    });
  }

  close() {
    try {
      if (this.socket) this.socket.close();
    } catch (_) {}
  }
}

async function waitForJson(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`http_${response.status}`);
    } catch (err) {
      lastError = err;
    }
    await sleep(120);
  }
  throw lastError || new Error("json_endpoint_timeout");
}

async function launchChrome(options) {
  if (!fs.existsSync(options.chromePath)) throw new Error("chrome_not_found");
  installChromeCleanupHandlers();
  const port = await getFreePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-browser-self-check-"));
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-sync",
    "--disable-features=Translate,MediaRouter",
    "--window-size=" + options.viewport.width + "," + options.viewport.height,
  ];
  if (!options.headed) args.push("--headless=new", "--disable-gpu");
  args.push("about:blank");
  const child = childProcess.spawn(options.chromePath, args, {
    stdio: ["ignore", "ignore", "ignore"],
    detached: true,
  });
  const cleanup = (signal = "SIGTERM") => cleanupChromeChild(child, userDataDir, signal);
  activeChromeCleanups.add(cleanup);
  const close = async () => {
    cleanup("SIGTERM");
    await sleep(250);
    cleanup("SIGKILL");
    activeChromeCleanups.delete(cleanup);
  };
  const listUrl = `http://127.0.0.1:${port}/json/list`;
  const pages = await waitForJson(listUrl, options.timeoutMs);
  const page = Array.isArray(pages) ? pages.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl) : null;
  if (!page) {
    await close();
    throw new Error("chrome_page_unavailable");
  }
  return {
    port,
    userDataDir,
    webSocketUrl: page.webSocketDebuggerUrl,
    close,
  };
}

function runtimeValue(result = {}) {
  const value = result && result.result;
  if (!value) return null;
  if (Object.prototype.hasOwnProperty.call(value, "value")) return value.value;
  if (value.unserializableValue) return value.unserializableValue;
  return null;
}

async function evaluate(cdp, expression, timeoutMs = 10000) {
  const timer = setTimeout(() => {}, timeoutMs);
  try {
    const result = await cdp.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      timeout: timeoutMs,
    });
    if (result && result.exceptionDetails) {
      const details = result.exceptionDetails || {};
      const description = details.exception && (details.exception.description || details.exception.value);
      throw new Error(description || details.text || "runtime_evaluate_exception");
    }
    return runtimeValue(result);
  } finally {
    clearTimeout(timer);
  }
}

async function waitForLoad(cdp, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await evaluate(cdp, "document.readyState", 2000).catch(() => "");
    if (ready === "complete" || ready === "interactive") return true;
    await sleep(100);
  }
  return false;
}

function browserInitScript(key, initialThreadId = "") {
  return `
    (() => {
      try {
        localStorage.setItem("codexMobileKey", ${JSON.stringify(key)});
        if (${JSON.stringify(initialThreadId)}) {
          localStorage.setItem("codexMobileCurrentThreadId", ${JSON.stringify(initialThreadId)});
        }
        localStorage.setItem("codexMobileThreadDisplayMode", "single");
      } catch (_) {}
      try {
        window.__codexSelfCheckLongTasks = [];
        if ("PerformanceObserver" in window) {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              window.__codexSelfCheckLongTasks.push({
                startTime: Math.max(0, Math.round(Number(entry.startTime || 0))),
                duration: Math.max(0, Math.round(Number(entry.duration || 0))),
              });
            }
            if (window.__codexSelfCheckLongTasks.length > 80) {
              window.__codexSelfCheckLongTasks = window.__codexSelfCheckLongTasks.slice(-80);
            }
          });
          observer.observe({ entryTypes: ["longtask"] });
        }
      } catch (_) {}
    })();
  `;
}

function startupProbeExpression(input = {}) {
  const expectedClientBuildId = String(input.clientBuildId || "").slice(0, 120);
  const expectedShellCacheName = String(input.shellCacheName || "").slice(0, 120);
  const expectedClassicShellCacheName = String(input.classicShellCacheName || "").slice(0, 120);
  return `
    (async () => {
      const visible = (node) => {
        if (!node || typeof node.getBoundingClientRect !== "function") return false;
        const style = typeof getComputedStyle === "function" ? getComputedStyle(node) : {};
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.height > 0 && rect.width > 0;
      };
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
      let clientBuildId = "";
      try {
        clientBuildId = typeof CLIENT_BUILD_ID === "string" ? CLIENT_BUILD_ID : "";
      } catch (_) {}
      const shellManifest = window.CODEX_MOBILE_SHELL_MANIFEST || {};
      const appPreviewStatus = window.__CODEX_MOBILE_VITE_APP_PREVIEW__ || {};
      const runtimeClientBuildUsesClassicCache = Boolean(${JSON.stringify(expectedClassicShellCacheName)} && clientBuildId.includes(${JSON.stringify(expectedClassicShellCacheName)}));
      let updateStatusCurrentBuildIdentityPresent = false;
      let updateStatusCurrentBuildIssueCodes = [];
      let updateStatusCurrentClientBuildMatches = false;
      let updateStatusCurrentShellCacheMatches = false;
      let updateFullClientVersionPresent = false;
      let updateFullClientVersionMatches = false;
      let updateFullClientVersionUsesClassicCache = false;
      let updateFullClientVersionErrorCode = "";
      try {
        const settingsRuntime = (() => {
          const candidate = window.CodexSettingsRuntime || null;
          if (candidate && typeof candidate.refreshAppUpdateStatus === "function") return candidate;
          if (typeof window.refreshAppUpdateStatus === "function" || typeof window.renderUpdatePanel === "function") {
            return {
              refreshAppUpdateStatus: window.refreshAppUpdateStatus,
              renderUpdatePanel: window.renderUpdatePanel,
            };
          }
          return candidate;
        })();
        if (settingsRuntime && typeof settingsRuntime.refreshAppUpdateStatus === "function") {
          const status = await settingsRuntime.refreshAppUpdateStatus({ force: true, silent: true });
          const currentBuild = status && status.currentBuild && typeof status.currentBuild === "object"
            ? status.currentBuild
            : {};
          const statusClientBuildId = String(currentBuild.clientBuildId || status && status.clientBuildId || "");
          const statusShellCacheName = String(currentBuild.shellCacheName || status && status.shellCacheName || "");
          const classicShellCacheName = String(currentBuild.classicShellCacheName || status && status.classicShellCacheName || "");
          const statusIssueCodes = new Set();
          for (const values of [currentBuild.issueCodes, status && status.currentBuildIssueCodes, status && status.issueCodes]) {
            if (!Array.isArray(values)) continue;
            values.forEach((value) => {
              const code = String(value || "").replace(/[^a-z0-9_.:-]+/gi, "_").slice(0, 80);
              if (code) statusIssueCodes.add(code);
            });
          }
          updateStatusCurrentBuildIdentityPresent = Boolean(statusClientBuildId && statusShellCacheName);
          updateStatusCurrentBuildIssueCodes = Array.from(statusIssueCodes).slice(0, 8);
          updateStatusCurrentClientBuildMatches = ${JSON.stringify(expectedClientBuildId)}
            ? statusClientBuildId === ${JSON.stringify(expectedClientBuildId)}
            : Boolean(statusClientBuildId);
          updateStatusCurrentShellCacheMatches = ${JSON.stringify(expectedShellCacheName)}
            ? statusShellCacheName === ${JSON.stringify(expectedShellCacheName)}
            : Boolean(statusShellCacheName);
          if (window.state && typeof window.state === "object") window.state.updatePanelOpen = true;
          if (typeof settingsRuntime.renderUpdatePanel === "function") settingsRuntime.renderUpdatePanel();
          await wait(0);
          const versionNode = document.querySelector(".update-version-card .update-row-meta");
          const versionText = String(versionNode && versionNode.textContent || "");
          updateFullClientVersionPresent = Boolean(versionText);
          updateFullClientVersionMatches = ${JSON.stringify(expectedClientBuildId)}
            ? versionText.includes(${JSON.stringify(expectedClientBuildId)})
            : Boolean(versionText);
          updateFullClientVersionUsesClassicCache = Boolean((classicShellCacheName || ${JSON.stringify(expectedClassicShellCacheName)}) && versionText.includes(classicShellCacheName || ${JSON.stringify(expectedClassicShellCacheName)}));
          if (window.state && typeof window.state === "object") window.state.updatePanelOpen = false;
          if (typeof settingsRuntime.renderUpdatePanel === "function") settingsRuntime.renderUpdatePanel();
        } else {
          updateFullClientVersionErrorCode = "settings_runtime_unavailable";
        }
      } catch (err) {
        updateFullClientVersionErrorCode = String(err && err.message || "update_version_probe_failed").slice(0, 160);
      }
      if (!updateStatusCurrentBuildIdentityPresent) {
        try {
          const selfCheckKey = String(localStorage.getItem("codexMobileKey") || "");
          if (selfCheckKey) {
            const response = await fetch("/api/app-update/status?force=1", {
              headers: { Authorization: "Bearer " + selfCheckKey },
            });
            if (response.ok) {
              const status = await response.json();
              const currentBuild = status && status.currentBuild && typeof status.currentBuild === "object"
                ? status.currentBuild
                : {};
              const statusClientBuildId = String(currentBuild.clientBuildId || status && status.clientBuildId || "");
              const statusShellCacheName = String(currentBuild.shellCacheName || status && status.shellCacheName || "");
              const statusIssueCodes = new Set();
              for (const values of [currentBuild.issueCodes, status && status.currentBuildIssueCodes, status && status.issueCodes]) {
                if (!Array.isArray(values)) continue;
                values.forEach((value) => {
                  const code = String(value || "").replace(/[^a-z0-9_.:-]+/gi, "_").slice(0, 80);
                  if (code) statusIssueCodes.add(code);
                });
              }
              updateStatusCurrentBuildIdentityPresent = Boolean(statusClientBuildId && statusShellCacheName);
              updateStatusCurrentBuildIssueCodes = Array.from(statusIssueCodes).slice(0, 8);
              updateStatusCurrentClientBuildMatches = ${JSON.stringify(expectedClientBuildId)}
                ? statusClientBuildId === ${JSON.stringify(expectedClientBuildId)}
                : Boolean(statusClientBuildId);
              updateStatusCurrentShellCacheMatches = ${JSON.stringify(expectedShellCacheName)}
                ? statusShellCacheName === ${JSON.stringify(expectedShellCacheName)}
                : Boolean(statusShellCacheName);
              if (updateStatusCurrentBuildIdentityPresent) updateFullClientVersionErrorCode = "";
            } else {
              updateFullClientVersionErrorCode = "app_update_status_http_" + String(response.status || 0);
            }
          }
        } catch (err) {
          updateFullClientVersionErrorCode = String(err && err.message || "app_update_status_probe_failed").slice(0, 160);
        }
      }
      const app = document.getElementById("app");
      const login = document.getElementById("loginPanel");
      const bootRecovery = document.getElementById("bootRecovery");
      const hardRefreshButton = document.getElementById("hardRefreshButton");
      const pageRefreshPrompt = document.getElementById("pageRefreshPrompt");
      const pluginRefreshPending = document.querySelector(".plugin-refresh-pending");
      const connectionStateText = String(document.getElementById("connectionState") && document.getElementById("connectionState").textContent || "");
      const pluginRefreshBannerVisibleAfterBuildSettled = Boolean(
        ${JSON.stringify(expectedClientBuildId)}
        && clientBuildId === ${JSON.stringify(expectedClientBuildId)}
        && updateStatusCurrentClientBuildMatches
        && updateStatusCurrentShellCacheMatches
        && (visible(pluginRefreshPending) || /Refreshing plugin page/i.test(connectionStateText))
      );
      const refreshFunctions = {
        refreshPageForNewBuild: typeof window.refreshPageForNewBuild === "function",
        clearAllShellCaches: typeof window.clearAllShellCaches === "function",
        resetPageShellServiceWorker: typeof window.resetPageShellServiceWorker === "function",
      };
      const shellRefreshContractReady = Boolean(
        hardRefreshButton
        && pageRefreshPrompt
        && refreshFunctions.refreshPageForNewBuild
        && refreshFunctions.clearAllShellCaches
        && refreshFunctions.resetPageShellServiceWorker
        && window.navigator
        && window.navigator.serviceWorker
        && window.caches
      );
      let settingsMobileViewportExpected = false;
      let settingsPanelPresent = false;
      let settingsPanelOverflowScrollable = false;
      let settingsPanelTouchScrollReady = false;
      let settingsPanelScrollable = false;
      let settingsPanelScrollMoved = false;
      let settingsRmwSectionPresent = false;
      let settingsRmwFieldCount = 0;
      let settingsRmwActionCount = 0;
      let settingsRmwVisibleFieldCount = 0;
      let settingsRmwVisibleActionCount = 0;
      let settingsRmwReachableFieldCount = 0;
      let settingsRmwReachableActionCount = 0;
      let settingsRmwWorkspaceRowCount = 0;
      let settingsRmwVisibleWorkspaceRowCount = 0;
      let settingsRmwReachableWorkspaceRowCount = 0;
      let settingsRmwPanelReachableOnMobile = true;
      let settingsPanelVisualReadyOnMobile = true;
      let settingsPanelVisibleHeight = 0;
      let settingsPanelVisibleWidth = 0;
      let settingsPanelRectHeight = 0;
      let settingsPanelRectWidth = 0;
      let settingsPanelLeft = 0;
      let settingsPanelRight = 0;
      let settingsInitialVisibleTitleCount = 0;
      let settingsPrimarySiblingVisibleCount = 0;
      let settingsPanelScrollHeight = 0;
      let settingsPanelClientHeight = 0;
      let settingsPanelVisualProbeWaitMs = 0;
      try {
        const settingsPanel = document.getElementById("themeSettingsPanel");
        const settingsButton = document.getElementById("themeSettingsToggle");
        const sidebar = document.getElementById("sidebar");
        const openMenuButton = document.getElementById("openMenu");
        settingsMobileViewportExpected = Boolean(
          (window.matchMedia && (window.matchMedia("(max-width: 760px)").matches || window.matchMedia("(pointer: coarse)").matches))
          || /Android/i.test(String(navigator && navigator.userAgent || ""))
        );
        settingsPanelPresent = Boolean(settingsPanel);
        if (settingsPanel) {
          const embeddedPrimaryBeforeOpen = document.documentElement.classList.contains("embed-hermes-primary");
          const originalSidebarOpen = Boolean(sidebar && sidebar.classList.contains("open"));
          const originalSidebarEdgeDragging = Boolean(sidebar && sidebar.classList.contains("edge-dragging"));
          const originalSidebarTransform = sidebar && sidebar.style ? sidebar.style.transform || "" : "";
          let openedSidebarForSettings = false;
          if (settingsMobileViewportExpected && !embeddedPrimaryBeforeOpen && sidebar) {
            if (!sidebar.classList.contains("open") && openMenuButton) openMenuButton.click();
            openedSidebarForSettings = true;
            await wait(0);
            if (!sidebar.classList.contains("open")) sidebar.classList.add("open");
            if (sidebar.style) sidebar.style.setProperty("transform", "translateX(0px)", "important");
          }
          const wasHidden = settingsPanel.classList.contains("hidden");
          const originalTop = settingsPanel.scrollTop || 0;
          const originalExpanded = settingsButton ? settingsButton.getAttribute("aria-expanded") : null;
          const ensureSettingsPanelProbeOpen = () => {
            settingsPanel.classList.remove("hidden");
            if (settingsButton) settingsButton.setAttribute("aria-expanded", "true");
            if (!openedSidebarForSettings || !sidebar) return;
            sidebar.classList.add("open");
            sidebar.classList.remove("edge-dragging");
            if (sidebar.style) sidebar.style.setProperty("transform", "translateX(0px)", "important");
          };
          settingsPanel.scrollTop = 0;
          ensureSettingsPanelProbeOpen();
          await wait(0);
          ensureSettingsPanelProbeOpen();
          const style = typeof getComputedStyle === "function" ? getComputedStyle(settingsPanel) : {};
          const titleNodes = Array.from(settingsPanel.querySelectorAll(".theme-settings-title"));
          const rmwTitle = titleNodes
            .find((node) => /Remote Managed Workspace/i.test(String(node && node.textContent || "")));
          const rmwSettings = document.getElementById("remoteManagedWorkspaceSettings");
          const rmwAnchor = rmwTitle || rmwSettings;
          settingsRmwSectionPresent = Boolean(rmwAnchor);
          const rmwFields = Array.from(settingsPanel.querySelectorAll("[data-rmw-field]"));
          const rmwActions = Array.from(settingsPanel.querySelectorAll("[data-rmw-action]"));
          const currentRmwWorkspaceRows = () => Array.from(settingsPanel.querySelectorAll(".remote-managed-workspace-item"))
            .filter((node) => node && node.isConnected !== false);
          let rmwWorkspaceRows = currentRmwWorkspaceRows();
          settingsRmwFieldCount = rmwFields.length;
          settingsRmwActionCount = rmwActions.length;
          settingsRmwWorkspaceRowCount = rmwWorkspaceRows.length;
          settingsPanelScrollHeight = Math.trunc(Number(settingsPanel.scrollHeight || 0));
          settingsPanelClientHeight = Math.trunc(Number(settingsPanel.clientHeight || 0));
          settingsPanelScrollable = settingsPanelScrollHeight > settingsPanelClientHeight + 4;
          settingsPanelOverflowScrollable = /auto|scroll/i.test(String(style.overflowY || style.overflow || ""));
          settingsPanelTouchScrollReady = /pan-y|auto|manipulation/i.test(String(style.touchAction || ""));
          const viewportWidth = Math.max(0, Math.trunc(Number(window.innerWidth || document.documentElement.clientWidth || 0)));
          const viewportHeight = Math.max(0, Math.trunc(Number(window.innerHeight || document.documentElement.clientHeight || 0)));
          const minimumUsefulVisibleWidth = Math.min(280, Math.max(180, Math.round(viewportWidth * 0.58)));
          const visibleWidthForRect = (rect) => Math.max(0, Math.trunc(
            Math.min(Number(rect && rect.right || 0), viewportWidth)
            - Math.max(Number(rect && rect.left || 0), 0)
          ));
          const visibleWithinViewport = (node) => {
            if (!node || typeof node.getBoundingClientRect !== "function") return false;
            const rect = node.getBoundingClientRect();
            return rect.bottom > 0 && rect.top < viewportHeight && rect.right > 0 && rect.left < viewportWidth && rect.width > 0 && rect.height > 0;
          };
          if (settingsMobileViewportExpected && !embeddedPrimaryBeforeOpen) {
            const startedAt = Date.now();
            for (let attempt = 0; attempt < 8; attempt += 1) {
              ensureSettingsPanelProbeOpen();
              const rect = settingsPanel.getBoundingClientRect();
              if (visibleWidthForRect(rect) >= minimumUsefulVisibleWidth) break;
              await wait(40);
            }
            ensureSettingsPanelProbeOpen();
            settingsPanelVisualProbeWaitMs = Math.max(0, Math.round(Date.now() - startedAt));
          }
          const initialPanelRect = settingsPanel.getBoundingClientRect();
          settingsPanelRectHeight = Math.max(0, Math.trunc(Number(initialPanelRect.height || 0)));
          settingsPanelRectWidth = Math.max(0, Math.trunc(Number(initialPanelRect.width || 0)));
          settingsPanelLeft = Math.trunc(Number(initialPanelRect.left || 0));
          settingsPanelRight = Math.trunc(Number(initialPanelRect.right || 0));
          settingsPanelVisibleHeight = Math.max(0, Math.trunc(
            Math.min(Number(initialPanelRect.bottom || 0), viewportHeight)
            - Math.max(Number(initialPanelRect.top || 0), 0)
          ));
          settingsPanelVisibleWidth = Math.max(0, Math.trunc(
            Math.min(Number(initialPanelRect.right || 0), viewportWidth)
            - Math.max(Number(initialPanelRect.left || 0), 0)
          ));
          settingsInitialVisibleTitleCount = titleNodes.filter(visibleWithinViewport).length;
          const embeddedPrimary = document.documentElement.classList.contains("embed-hermes-primary");
          if (embeddedPrimary && settingsPanel.parentElement) {
            const siblings = Array.from(settingsPanel.parentElement.children || []);
            const startIndex = siblings.indexOf(settingsPanel);
            settingsPrimarySiblingVisibleCount = siblings
              .slice(Math.max(0, startIndex + 1))
              .filter((node) => {
                if (!node || node.hidden || node.classList && node.classList.contains("hidden")) return false;
                const siblingStyle = typeof getComputedStyle === "function" ? getComputedStyle(node) : {};
                if (siblingStyle.display === "none" || siblingStyle.visibility === "hidden") return false;
                return visibleWithinViewport(node);
              }).length;
          }
          const maxTop = Math.max(0, settingsPanel.scrollHeight - settingsPanel.clientHeight);
          const anchorTop = rmwAnchor && Number.isFinite(Number(rmwAnchor.offsetTop)) ? Number(rmwAnchor.offsetTop) : maxTop;
          const targetTop = Math.max(0, Math.min(maxTop, anchorTop - 12));
          settingsPanel.scrollTop = targetTop;
          await wait(0);
          settingsPanelScrollMoved = maxTop <= 2 || Math.abs(Number(settingsPanel.scrollTop || 0) - targetTop) <= 2;
          const visibleWithinPanel = (node, panelRect) => {
            if (!node || typeof node.getBoundingClientRect !== "function") return false;
            const rect = node.getBoundingClientRect();
            return rect.bottom <= panelRect.bottom + 2 && rect.top >= panelRect.top - 2 && rect.width > 0 && rect.height > 0;
          };
          const scrollNodeIntoPanel = async (node, alignFraction = 0.18) => {
            if (!node || typeof node.getBoundingClientRect !== "function") return false;
            const beforePanelRect = settingsPanel.getBoundingClientRect();
            const beforeRect = node.getBoundingClientRect();
            const relativeTop = beforeRect.top - beforePanelRect.top + Number(settingsPanel.scrollTop || 0);
            const target = Math.max(0, Math.min(maxTop, relativeTop - Math.round(settingsPanel.clientHeight * alignFraction)));
            settingsPanel.scrollTop = target;
            await wait(0);
            const afterPanelRect = settingsPanel.getBoundingClientRect();
            return visibleWithinPanel(node, afterPanelRect);
          };
          const panelRect = settingsPanel.getBoundingClientRect();
          settingsRmwVisibleFieldCount = rmwFields.filter((node) => visibleWithinPanel(node, panelRect)).length;
          settingsRmwVisibleActionCount = rmwActions.filter((node) => visibleWithinPanel(node, panelRect)).length;
          rmwWorkspaceRows = currentRmwWorkspaceRows();
          settingsRmwWorkspaceRowCount = rmwWorkspaceRows.length;
          settingsRmwVisibleWorkspaceRowCount = rmwWorkspaceRows.filter((node) => visibleWithinPanel(node, panelRect)).length;
          for (const field of rmwFields) {
            if (await scrollNodeIntoPanel(field, 0.18)) settingsRmwReachableFieldCount += 1;
          }
          for (const action of rmwActions) {
            if (await scrollNodeIntoPanel(action, 0.72)) settingsRmwReachableActionCount += 1;
          }
          rmwWorkspaceRows = currentRmwWorkspaceRows();
          settingsRmwWorkspaceRowCount = Math.max(settingsRmwWorkspaceRowCount, rmwWorkspaceRows.length);
          for (const row of rmwWorkspaceRows) {
            if (await scrollNodeIntoPanel(row, 0.28)) settingsRmwReachableWorkspaceRowCount += 1;
          }
          if (settingsMobileViewportExpected) {
            settingsRmwPanelReachableOnMobile = Boolean(
              rmwAnchor
              && settingsPanelOverflowScrollable
              && settingsPanelTouchScrollReady
              && settingsPanelScrollMoved
              && settingsRmwReachableFieldCount >= 1
              && settingsRmwReachableActionCount >= 3
              && (settingsRmwWorkspaceRowCount === 0
                || settingsRmwVisibleWorkspaceRowCount >= 1
                || settingsRmwReachableWorkspaceRowCount >= 1)
            );
          }
          if (settingsMobileViewportExpected) {
            const minimumUsefulVisibleHeight = Math.min(480, Math.max(280, Math.round(viewportHeight * 0.62)));
            settingsPanelVisualReadyOnMobile = Boolean(
              settingsPanelVisibleHeight >= minimumUsefulVisibleHeight
              && settingsPanelVisibleWidth >= minimumUsefulVisibleWidth
              && settingsInitialVisibleTitleCount >= 2
              && settingsPrimarySiblingVisibleCount === 0
            );
          }
          settingsPanel.scrollTop = originalTop;
          if (wasHidden) settingsPanel.classList.add("hidden");
          if (settingsButton) {
            if (originalExpanded === null) settingsButton.removeAttribute("aria-expanded");
            else settingsButton.setAttribute("aria-expanded", originalExpanded);
          }
          if (openedSidebarForSettings && sidebar) {
            sidebar.classList.toggle("open", originalSidebarOpen);
            sidebar.classList.toggle("edge-dragging", originalSidebarEdgeDragging);
            if (sidebar.style) {
              if (originalSidebarTransform) sidebar.style.setProperty("transform", originalSidebarTransform);
              else sidebar.style.removeProperty("transform");
            }
          }
        } else if (settingsMobileViewportExpected) {
          settingsRmwPanelReachableOnMobile = false;
          settingsPanelVisualReadyOnMobile = false;
        }
      } catch (_) {
        if (settingsMobileViewportExpected) {
          settingsRmwPanelReachableOnMobile = false;
          settingsPanelVisualReadyOnMobile = false;
        }
      }
      return {
        label: "startup",
        probeKind: "startup",
        appVisible: visible(app),
        loginVisible: visible(login),
        bootRecoveryVisible: visible(bootRecovery),
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 0,
        items: 0,
        renderKeys: 0,
        clientBuildPresent: Boolean(clientBuildId),
        clientBuildMatches: ${JSON.stringify(expectedClientBuildId)} ? clientBuildId === ${JSON.stringify(expectedClientBuildId)} : Boolean(clientBuildId),
        shellCacheMatches: ${JSON.stringify(expectedShellCacheName)} ? String(shellManifest.shellCacheName || "") === ${JSON.stringify(expectedShellCacheName)} : Boolean(shellManifest.shellCacheName),
        appStartPending: appPreviewStatus.appStartPending === true,
        runtimeClientBuildUsesClassicCache,
        composerRuntimeReady: Boolean(window.CodexComposerRuntime && typeof window.CodexComposerRuntime.createComposerRuntime === "function"),
        threadListRuntimeReady: Boolean(window.CodexThreadListRuntime && typeof window.CodexThreadListRuntime.createThreadListRuntime === "function"),
        threadTileRuntimeReady: Boolean(window.CodexThreadTileRuntime && typeof window.CodexThreadTileRuntime.createThreadTileRuntime === "function"),
        loadThreadReady: typeof window.loadThread === "function",
        shellRefreshContractReady,
        shellRefreshHardRefreshPresent: Boolean(hardRefreshButton),
        shellRefreshPromptPresent: Boolean(pageRefreshPrompt),
        shellRefreshPromptHidden: Boolean(!pageRefreshPrompt || pageRefreshPrompt.classList.contains("hidden")),
        shellRefreshRefreshPageReady: refreshFunctions.refreshPageForNewBuild,
        shellRefreshClearCachesReady: refreshFunctions.clearAllShellCaches,
        shellRefreshResetServiceWorkerReady: refreshFunctions.resetPageShellServiceWorker,
        shellRefreshServiceWorkerCapable: Boolean(window.navigator && window.navigator.serviceWorker),
        shellRefreshCachesCapable: Boolean(window.caches),
        updateStatusCurrentBuildIdentityPresent,
        updateStatusCurrentBuildIssueCodes,
        updateStatusCurrentClientBuildMatches,
        updateStatusCurrentShellCacheMatches,
        updateFullClientVersionPresent,
        updateFullClientVersionMatches,
        updateFullClientVersionUsesClassicCache,
        updateFullClientVersionErrorCode,
        pluginRefreshBannerVisibleAfterBuildSettled,
        settingsMobileViewportExpected,
        settingsPanelPresent,
        settingsPanelOverflowScrollable,
        settingsPanelTouchScrollReady,
        settingsPanelScrollable,
        settingsPanelScrollMoved,
        settingsRmwSectionPresent,
        settingsRmwFieldCount,
        settingsRmwActionCount,
        settingsRmwVisibleFieldCount,
        settingsRmwVisibleActionCount,
        settingsRmwReachableFieldCount,
        settingsRmwReachableActionCount,
        settingsRmwWorkspaceRowCount,
        settingsRmwVisibleWorkspaceRowCount,
        settingsRmwReachableWorkspaceRowCount,
        settingsRmwPanelReachableOnMobile,
        settingsPanelVisualReadyOnMobile,
        settingsPanelVisibleHeight,
        settingsPanelVisibleWidth,
        settingsPanelRectHeight,
        settingsPanelRectWidth,
        settingsPanelLeft,
        settingsPanelRight,
        settingsPanelVisualProbeWaitMs,
        settingsInitialVisibleTitleCount,
        settingsPrimarySiblingVisibleCount,
        settingsPanelScrollHeight,
        settingsPanelClientHeight,
      };
    })();
  `;
}

function vitePreviewProbeExpression(input = {}) {
  const expectedClientBuildId = String(input.clientBuildId || "");
  const expectedShellCacheName = String(input.shellCacheName || "");
  return `
    (async () => {
      const marker = document.getElementById("codex-vite-shell-preview");
      const moduleScripts = Array.from(document.querySelectorAll("script[type='module']"))
        .map((script) => {
          try {
            return new URL(script.getAttribute("src") || "", window.location.href).pathname;
          } catch (_) {
            return "";
          }
        })
        .filter(Boolean);
      const startupPreloads = Array.from(document.querySelectorAll("link[rel='preload'][as='script'][data-codex-vite-startup-asset]"))
        .map((link) => {
          try {
            return new URL(link.getAttribute("href") || "", window.location.href).pathname;
          } catch (_) {
            return "";
          }
        })
        .filter(Boolean);
      const entryGroupPreloads = Array.from(document.querySelectorAll("link[rel='modulepreload'][data-codex-vite-entry-group-chunk]"))
        .map((link) => {
          try {
            return new URL(link.getAttribute("href") || "", window.location.href).pathname;
          } catch (_) {
            return "";
          }
        })
        .filter(Boolean);
      const topology = window.__CODEX_MOBILE_VITE_SHELL_ENTRY_TOPOLOGY__ || {};
      const entryGroups = [
        ...(Array.isArray(topology.startupGroups) ? topology.startupGroups : []),
        ...(Array.isArray(topology.deferredGroups) ? topology.deferredGroups : []),
      ];
      const startupCriticalAssets = Array.isArray(topology.startupGroups)
        ? topology.startupGroups.flatMap((group) => Array.isArray(group && group.assets) ? group.assets : [])
        : [];
      const compatibility = window.__CODEX_MOBILE_VITE_CLASSIC_COMPATIBILITY__ || {};
      try {
        await Promise.race([
          window.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY_PROMISE__,
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
      } catch (_) {
        // The readiness fields below report the compatibility failure without
        // leaking private browser state or long exception text.
      }
      const esmCompatibility = window.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY__ || {};
      const esmCompatibilityModules = Array.isArray(esmCompatibility.modules)
        ? esmCompatibility.modules
        : [];
      const declaredEsmCompatibilityIds = esmCompatibilityModules
        .map((entry) => String(entry && entry.id || ""))
        .filter(Boolean);
      const expectedEsmCompatibilityIds = declaredEsmCompatibilityIds;
      const expectedEsmCompatibilityCount = Math.max(
        marker ? Number(marker.dataset.esmCompatibilityModuleCount) || 0 : 0,
        Number(esmCompatibility.moduleCount) || 0,
        expectedEsmCompatibilityIds.length
      );
      const expectedEsmCompatibilityIdSet = new Set(expectedEsmCompatibilityIds);
      const esmCompatibilityIdsComplete = expectedEsmCompatibilityCount > 0
        && expectedEsmCompatibilityIds.length === expectedEsmCompatibilityCount
        && expectedEsmCompatibilityIdSet.size === expectedEsmCompatibilityCount;
      const readyEsmCompatibilityIds = new Set(esmCompatibilityModules
        .filter((entry) => entry && entry.ready === true)
        .map((entry) => String(entry.id || "")));
      const esmCompatibilityGlobalsPublished = esmCompatibilityModules.every((entry) => (
        entry && entry.classicLoaderExcluded === true ? entry.globalPublished === true : true
      ));
      const entryGroupImportOwner = window.__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_OWNER__
        || (marker ? String(marker.dataset.entryGroupImportOwner || "") : "");
      const entryDynamicImportGraph = window.__CODEX_MOBILE_VITE_ENTRY_DYNAMIC_IMPORT_GRAPH__ || {};
      const entryDynamicImportDeferredSources = Array.isArray(entryDynamicImportGraph.deferredSources)
        ? entryDynamicImportGraph.deferredSources
        : [];
      const entryDynamicImportEntryGroupSources = Array.isArray(entryDynamicImportGraph.entryGroupSources)
        ? entryDynamicImportGraph.entryGroupSources
        : [];
      const requiredStartupGlobals = Array.isArray(compatibility.requiredStartupGlobals)
        ? compatibility.requiredStartupGlobals
        : [];
      const requiredStartupContracts = Array.isArray(compatibility.startupGlobalContracts)
        ? compatibility.startupGlobalContracts
        : [];
      const classicGlobalExports = Array.isArray(compatibility.classicGlobalExports)
        ? compatibility.classicGlobalExports
        : [];
      const classicGlobalNames = new Set();
      const classicAssetByGlobal = {};
      for (const entry of classicGlobalExports) {
        for (const name of Array.isArray(entry && entry.globals) ? entry.globals : []) {
          const globalName = String(name || "");
          classicGlobalNames.add(globalName);
          classicAssetByGlobal[globalName] = String(entry && entry.asset || "");
        }
      }
      let deferredLoaded = false;
      let deferredGroupCount = 0;
      try {
        const deferred = await Promise.race([
          window.__CODEX_MOBILE_VITE_DEFERRED_ENTRY_TOPOLOGY__,
          new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
        deferredLoaded = Boolean(deferred);
        deferredGroupCount = Array.isArray(deferred && deferred.codexMobileDeferredEntryGroups)
          ? deferred.codexMobileDeferredEntryGroups.length
          : 0;
      } catch (_) {
        deferredLoaded = false;
      }
      const startupAssetStatuses = [];
      for (const assetPath of startupCriticalAssets) {
        const path = String(assetPath || "");
        if (!path || !path.startsWith("/")) continue;
        try {
          const response = await fetch(path, { cache: "no-store" });
          startupAssetStatuses.push({ path, status: response.status, ok: response.ok });
        } catch (_) {
          startupAssetStatuses.push({ path, status: 0, ok: false });
        }
      }
      const entryGroupChunkStatuses = [];
      for (const chunkPath of entryGroupPreloads) {
        const path = String(chunkPath || "");
        if (!path || !path.startsWith("/")) continue;
        try {
          const response = await fetch(path, { cache: "no-store" });
          entryGroupChunkStatuses.push({ path, status: response.status, ok: response.ok });
        } catch (_) {
          entryGroupChunkStatuses.push({ path, status: 0, ok: false });
        }
      }
      let entryGroupImportStatus = null;
      try {
        entryGroupImportStatus = await Promise.race([
          window.__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_PROMISE__,
          new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
      } catch (_) {
        entryGroupImportStatus = null;
      }
      const entryGroupRegistry = window.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};
      const entryGroupRegistryIds = Object.keys(entryGroupRegistry).sort();
      const expectedEntryGroupIds = entryGroups
        .map((group) => String(group && group.id || ""))
        .filter(Boolean)
        .sort();
      const coverageForGroup = (group) => {
        const assets = Array.isArray(group && group.assets) ? group.assets.map((asset) => String(asset || "")) : [];
        const assetSet = new Set(assets);
        const exportEntries = classicGlobalExports.filter((entry) => assetSet.has(String(entry && entry.asset || "")));
        return {
          assetCount: assets.length,
          classicGlobalExportAssetCount: exportEntries.length,
          classicGlobalExportCount: exportEntries.reduce((total, entry) => (
            total + (Array.isArray(entry && entry.globals) ? entry.globals.length : 0)
          ), 0),
        };
      };
      const registryCoverage = [];
      const startupGlobalContractCoverage = [];
      let entryGroupClassicCoverageOk = expectedEntryGroupIds.length > 0;
      for (const group of entryGroups) {
        const groupId = String(group && group.id || "");
        if (!groupId) continue;
        const expectedCoverage = coverageForGroup(group);
        const actual = entryGroupRegistry[groupId] || {};
        const groupOk = Number(actual.assetCount) === expectedCoverage.assetCount
          && Number(actual.classicAssetHashCount) === expectedCoverage.assetCount
          && Number(actual.classicAssetBytes) > 0
          && Number(actual.classicGlobalExportAssetCount) === expectedCoverage.classicGlobalExportAssetCount
          && Number(actual.classicGlobalExportCount) === expectedCoverage.classicGlobalExportCount;
        if (!groupOk) entryGroupClassicCoverageOk = false;
        registryCoverage.push({
          groupId,
          ok: groupOk,
          assetCount: Number(actual.assetCount) || 0,
          expectedAssetCount: expectedCoverage.assetCount,
          classicAssetHashCount: Number(actual.classicAssetHashCount) || 0,
          classicAssetBytes: Number(actual.classicAssetBytes) || 0,
          classicGlobalExportAssetCount: Number(actual.classicGlobalExportAssetCount) || 0,
          expectedClassicGlobalExportAssetCount: expectedCoverage.classicGlobalExportAssetCount,
          classicGlobalExportCount: Number(actual.classicGlobalExportCount) || 0,
          expectedClassicGlobalExportCount: expectedCoverage.classicGlobalExportCount,
        });
      }
      for (const contract of requiredStartupContracts) {
        const name = String(contract && contract.name || "");
        const asset = String(contract && contract.asset || "");
        const groupId = String(contract && contract.groupId || "");
        const registryContracts = Array.isArray(entryGroupRegistry[groupId] && entryGroupRegistry[groupId].startupGlobalContracts)
          ? entryGroupRegistry[groupId].startupGlobalContracts
          : [];
        const registryMatch = registryContracts.some((entry) => (
          String(entry && entry.name || "") === name
            && String(entry && entry.asset || "") === asset
            && String(entry && entry.groupId || "") === groupId
        ));
        startupGlobalContractCoverage.push({
          name,
          asset,
          groupId,
          ok: Boolean(name && asset && groupId && classicGlobalNames.has(name)
            && classicAssetByGlobal[name] === asset
            && registryMatch),
        });
      }
      return {
        label: "vite-preview",
        probeKind: "vite-preview",
        path: window.location.pathname,
        markerVisible: Boolean(marker),
        stage: marker ? String(marker.dataset.stage || "") : "",
        sourceBuildStage: marker ? String(marker.dataset.sourceBuildStage || "") : "",
        productionExecution: marker ? String(marker.dataset.productionExecution || "") : "",
        clientBuildMatches: marker ? String(marker.dataset.clientBuildId || "") === ${JSON.stringify(expectedClientBuildId)} : false,
        shellCacheMatches: marker ? String(marker.dataset.shellCacheName || "") === ${JSON.stringify(expectedShellCacheName)} : false,
        moduleScriptCount: moduleScripts.length,
        moduleScriptMatchesPreview: moduleScripts.some((scriptPath) => scriptPath === "/vite-shell/app-preview-entry.js" || /^\\/vite-shell\\/assets\\/vite-shell-entry-/.test(scriptPath)),
        moduleEntryLoaded: window.__CODEX_MOBILE_VITE_SHELL_BUILD_STAGE__ === "entry-topology-v1",
        entryTopologyReady: Array.isArray(topology.startupGroups) && Array.isArray(topology.deferredGroups),
        entryGroupImportOwner,
        entryGroupImportOwnerOk: entryGroupImportOwner === "vite-shell-entry",
        classicShellScriptBlockCount: marker ? Number(marker.dataset.classicShellScriptCount) || 0 : 0,
        classicShellScriptBlockHashPresent: marker ? Boolean(String(marker.dataset.classicShellScriptBlockSha256 || "")) : false,
        startupGlobalContractMarkerCount: marker ? Number(marker.dataset.startupGlobalContractCount) || 0 : 0,
        entryDynamicImportOwner: String(entryDynamicImportGraph.owner || ""),
        entryDynamicImportOwnerOk: String(entryDynamicImportGraph.owner || "") === "vite-shell-entry",
        entryDynamicImportExpectedCount: Number(entryDynamicImportGraph.expectedImportCount) || 0,
        entryDynamicImportDeferredSourceCount: entryDynamicImportDeferredSources.length,
        entryDynamicImportEntryGroupSourceCount: entryDynamicImportEntryGroupSources.length,
        entryDynamicImportEntryGroupCountMatches: entryDynamicImportEntryGroupSources.length === entryGroups.length,
        startupGroupCount: Array.isArray(topology.startupGroups) ? topology.startupGroups.length : 0,
        startupCriticalAssetCount: startupCriticalAssets.length,
        startupCriticalPreloadCount: startupPreloads.length,
        startupCriticalPreloadsMatch: JSON.stringify(startupPreloads) === JSON.stringify(startupCriticalAssets),
        startupCriticalAssetStatusOk: startupAssetStatuses.length === startupCriticalAssets.length
          && startupAssetStatuses.every((entry) => entry && entry.ok),
        entryGroupCount: entryGroups.length,
        entryGroupChunkPreloadCount: entryGroupPreloads.length,
        entryGroupChunkPreloadsMatch: entryGroupPreloads.length === entryGroups.length,
        entryGroupChunkStatusOk: entryGroupChunkStatuses.length === entryGroups.length
          && entryGroupChunkStatuses.every((entry) => entry && entry.ok),
        entryGroupChunkImportReady: Boolean(entryGroupImportStatus),
        entryGroupChunkImportCount: entryGroupImportStatus && Array.isArray(entryGroupImportStatus.imported)
          ? entryGroupImportStatus.imported.length
          : 0,
        entryGroupChunkImportFailureCount: entryGroupImportStatus && Array.isArray(entryGroupImportStatus.failed)
          ? entryGroupImportStatus.failed.length
          : 0,
        entryGroupChunkRegistryCount: entryGroupRegistryIds.length,
        entryGroupChunkRegistryMatches: JSON.stringify(entryGroupRegistryIds) === JSON.stringify(expectedEntryGroupIds),
        entryGroupChunkExecutionOk: Boolean(entryGroupImportStatus && entryGroupImportStatus.ok)
          && JSON.stringify(entryGroupRegistryIds) === JSON.stringify(expectedEntryGroupIds),
        entryGroupClassicCoverageOk,
        entryGroupClassicCoverageGroupCount: registryCoverage.length,
        entryGroupClassicCoverageMismatchCount: registryCoverage.filter((entry) => entry && entry.ok !== true).length,
        entryGroupClassicAssetHashCount: registryCoverage.reduce((total, entry) => (
          total + (Number(entry && entry.classicAssetHashCount) || 0)
        ), 0),
        entryGroupClassicAssetBytes: registryCoverage.reduce((total, entry) => (
          total + (Number(entry && entry.classicAssetBytes) || 0)
        ), 0),
        entryGroupClassicCoverageGlobalCount: registryCoverage.reduce((total, entry) => (
          total + (Number(entry && entry.classicGlobalExportCount) || 0)
        ), 0),
        classicCompatibilityReady: Array.isArray(compatibility.classicGlobalExports) && classicGlobalExports.length > 0,
        classicCompatibilityAssetCount: classicGlobalExports.length,
        classicCompatibilityGlobalCount: classicGlobalNames.size,
        classicCompatibilityStartupGlobalsReady: requiredStartupGlobals.every((name) => classicGlobalNames.has(name)),
        classicCompatibilityStartupGlobalContractCount: requiredStartupContracts.length,
        classicCompatibilityStartupGlobalContractAssetCount: new Set(requiredStartupContracts.map((entry) => String(entry && entry.asset || "")).filter(Boolean)).size,
        classicCompatibilityStartupGlobalContractReady: startupGlobalContractCoverage.length > 0
          && startupGlobalContractCoverage.every((entry) => entry && entry.ok === true)
          && (marker ? Number(marker.dataset.startupGlobalContractCount) === startupGlobalContractCoverage.length : false),
        classicCompatibilityStartupGlobalContractMismatchCount: startupGlobalContractCoverage.filter((entry) => entry && entry.ok !== true).length,
        esmCompatibilityReady: String(esmCompatibility.owner || "") === "vite-shell-entry"
          && Number(esmCompatibility.moduleCount) === expectedEsmCompatibilityCount
          && Number(esmCompatibility.readyCount) === expectedEsmCompatibilityCount
          && esmCompatibilityIdsComplete === true
          && expectedEsmCompatibilityIds.every((id) => readyEsmCompatibilityIds.has(id))
          && esmCompatibilityGlobalsPublished === true,
        esmCompatibilityOwner: String(esmCompatibility.owner || ""),
        esmCompatibilityModuleCount: Number(esmCompatibility.moduleCount) || esmCompatibilityModules.length,
        esmCompatibilityReadyCount: Number(esmCompatibility.readyCount) || esmCompatibilityModules.filter((entry) => entry && entry.ready === true).length,
        esmCompatibilityExpectedCount: expectedEsmCompatibilityCount,
        esmCompatibilityGlobalsPublished,
        esmCompatibilityNotReadyModuleIds: esmCompatibilityModules
          .filter((entry) => entry && entry.ready !== true)
          .map((entry) => String(entry && entry.id || ""))
          .filter(Boolean)
          .slice(0, 20),
        esmCompatibilityNotReadyModules: esmCompatibilityModules
          .filter((entry) => entry && entry.ready !== true)
          .map((entry) => ({
            id: String(entry && entry.id || ""),
            expectedFunctionCount: Array.isArray(entry && entry.expectedFunctions) ? entry.expectedFunctions.length : 0,
            exportedFunctionCount: Array.isArray(entry && entry.exportedFunctions) ? entry.exportedFunctions.length : 0,
            globalPublished: entry && entry.globalPublished === true,
            sample: entry && entry.sample && typeof entry.sample === "object" ? entry.sample : null,
          }))
          .filter((entry) => entry.id)
          .slice(0, 8),
        deferredGroupCount,
        deferredLoaded,
      };
    })()
  `;
}

function analyzeVitePreviewProbe(sample = {}, runtimeSignals = {}) {
  const issues = [];
  const append = (code, severity = "H2", extra = {}) => {
    issues.push(Object.assign({
      severity,
      code,
      surface: "browser-runtime",
    }, extra));
  };
  if (!sample || sample.markerVisible !== true) append("vite_preview_marker_missing");
  if (sample && sample.stage !== "vite-shell-preview-html-v1") append("vite_preview_stage_mismatch");
  if (sample && sample.sourceBuildStage !== "vite-shell-artifact-contract-v1") append("vite_preview_source_build_stage_mismatch");
  if (sample && sample.productionExecution !== "vite-app-preview-native-esm") append("vite_preview_execution_mode_mismatch");
  if (sample && sample.clientBuildMatches !== true) append("vite_preview_client_build_mismatch");
  if (sample && sample.shellCacheMatches !== true) append("vite_preview_shell_cache_mismatch");
  if (sample && sample.moduleScriptMatchesPreview !== true) append("vite_preview_module_entry_missing");
  if (sample && sample.moduleEntryLoaded !== true) append("vite_preview_module_entry_not_loaded");
  if (sample && sample.entryTopologyReady !== true) append("vite_preview_entry_topology_missing");
  if (sample && sample.entryGroupImportOwnerOk !== true) append("vite_preview_entry_group_import_owner_mismatch");
  if (sample && (Number(sample.classicShellScriptBlockCount) < 1
    || sample.classicShellScriptBlockHashPresent !== true)) {
    append("vite_preview_classic_script_block_contract_missing");
  }
  if (sample && (sample.entryDynamicImportOwnerOk !== true
    || Number(sample.entryDynamicImportDeferredSourceCount) < 1
    || sample.entryDynamicImportEntryGroupCountMatches !== true)) {
    append("vite_preview_entry_dynamic_import_graph_mismatch");
  }
  if (sample && sample.startupCriticalPreloadsMatch !== true) append("vite_preview_startup_preload_mismatch");
  if (sample && sample.startupCriticalAssetStatusOk !== true) append("vite_preview_startup_asset_fetch_failed");
  if (sample && sample.entryGroupChunkPreloadsMatch !== true) append("vite_preview_entry_group_chunk_preload_mismatch");
  if (sample && sample.entryGroupChunkStatusOk !== true) append("vite_preview_entry_group_chunk_fetch_failed");
  if (sample && sample.entryGroupChunkExecutionOk !== true) append("vite_preview_entry_group_chunk_not_executed");
  if (sample && sample.entryGroupClassicCoverageOk !== true) append("vite_preview_entry_group_classic_coverage_mismatch");
  if (sample && sample.classicCompatibilityReady !== true) append("vite_preview_classic_compatibility_missing");
  if (sample && sample.classicCompatibilityStartupGlobalsReady !== true) append("vite_preview_classic_startup_globals_missing");
  if (sample && sample.classicCompatibilityStartupGlobalContractReady !== true) {
    append("vite_preview_classic_startup_global_contract_mismatch");
  }
  if (sample && sample.esmCompatibilityReady !== true) {
    append("vite_preview_esm_compatibility_missing", "H2", {
      owner: sample.esmCompatibilityOwner || "",
      moduleCount: Number(sample.esmCompatibilityModuleCount) || 0,
      readyCount: Number(sample.esmCompatibilityReadyCount) || 0,
      notReadyModuleIds: Array.isArray(sample.esmCompatibilityNotReadyModuleIds)
        ? sample.esmCompatibilityNotReadyModuleIds.slice(0, 20)
        : [],
      notReadyModules: Array.isArray(sample.esmCompatibilityNotReadyModules)
        ? sample.esmCompatibilityNotReadyModules.slice(0, 8)
        : [],
    });
  }
  if (sample && sample.deferredLoaded !== true) append("vite_preview_deferred_not_loaded");
  if ((runtimeSignals.exceptions || []).length) append("vite_preview_browser_exception");
  if ((runtimeSignals.consoleEvents || []).some((entry) => entry && entry.type === "error")) {
    append("vite_preview_console_error");
  }
  const blockingIssueCount = issues.filter((issue) => /^(H1|H2)$/i.test(issue.severity || "")).length;
  return {
    ok: blockingIssueCount === 0,
    issueCount: issues.length,
    blockingIssueCount,
    issues,
  };
}

function clientVersionSwitchConfirmed(sample = {}) {
  return Boolean(
    sample
    && (clientVersionSwitchProbeDeferred(sample) || (
      sample.updateStatusCurrentBuildIdentityPresent !== false
      && sample.updateStatusCurrentClientBuildMatches === true
      && sample.updateStatusCurrentShellCacheMatches === true
      && sample.updateFullClientVersionPresent === true
      && sample.updateFullClientVersionMatches === true
      && sample.updateFullClientVersionUsesClassicCache !== true
      && sample.runtimeClientBuildUsesClassicCache !== true
      && sample.pluginRefreshBannerVisibleAfterBuildSettled !== true
    ))
  );
}

function clientVersionSwitchProbeDeferred(sample = {}) {
  return Boolean(
    sample
    && sample.updateFullClientVersionErrorCode === "settings_runtime_unavailable"
    && sample.appStartPending === true
    && sample.clientBuildMatches === true
    && sample.shellCacheMatches === true
    && sample.runtimeClientBuildUsesClassicCache !== true
    && sample.pluginRefreshBannerVisibleAfterBuildSettled !== true
  );
}

function hasClientVersionSwitchProbe(sample = {}) {
  return Boolean(sample && (
    Object.prototype.hasOwnProperty.call(sample, "updateStatusCurrentBuildIdentityPresent")
    || Object.prototype.hasOwnProperty.call(sample, "updateStatusCurrentBuildIssueCodes")
    || Object.prototype.hasOwnProperty.call(sample, "updateStatusCurrentClientBuildMatches")
    || Object.prototype.hasOwnProperty.call(sample, "updateStatusCurrentShellCacheMatches")
    || Object.prototype.hasOwnProperty.call(sample, "updateFullClientVersionPresent")
    || Object.prototype.hasOwnProperty.call(sample, "updateFullClientVersionMatches")
    || Object.prototype.hasOwnProperty.call(sample, "updateFullClientVersionUsesClassicCache")
    || Object.prototype.hasOwnProperty.call(sample, "updateFullClientVersionErrorCode")
    || Object.prototype.hasOwnProperty.call(sample, "runtimeClientBuildUsesClassicCache")
    || Object.prototype.hasOwnProperty.call(sample, "pluginRefreshBannerVisibleAfterBuildSettled")
  ));
}

function clientVersionSwitchIssueDescriptors(sample = {}) {
  const issues = [];
  const issueCodes = Array.isArray(sample && sample.updateStatusCurrentBuildIssueCodes)
    ? sample.updateStatusCurrentBuildIssueCodes
    : [];
  const reason = boundedToken(issueCodes[0] || sample.updateFullClientVersionErrorCode || "", "");
  if (sample && sample.updateStatusCurrentBuildIdentityPresent === false && !clientVersionSwitchProbeDeferred(sample)) {
    issues.push({
      severity: "H2",
      code: "app_update_current_build_identity_empty",
      statusClientBuildMatches: sample.updateStatusCurrentClientBuildMatches === true,
      statusShellCacheMatches: sample.updateStatusCurrentShellCacheMatches === true,
      reason,
    });
  }
  if (sample && sample.runtimeClientBuildUsesClassicCache === true) {
    issues.push({
      severity: "H2",
      code: "client_runtime_stuck_on_classic_cache_identity",
    });
  }
  if (sample && sample.pluginRefreshBannerVisibleAfterBuildSettled === true) {
    issues.push({
      severity: "H2",
      code: "plugin_refresh_banner_stuck_after_build_settled",
    });
  }
  return issues;
}

function viteAppPreviewProbeExpression(input = {}) {
  const expectedClientBuildId = String(input.clientBuildId || "");
  const expectedShellCacheName = String(input.shellCacheName || "");
  const expectedClassicShellCacheName = String(input.classicShellCacheName || "");
  const expectEmbed = input.expectEmbed === true;
  const expectPluginSession = input.expectPluginSession === true;
  const expectRoot = input.expectRoot === true;
  const expectDefaultRoot = input.expectDefaultRoot === true;
  return `
    (async () => {
      let appPreviewResult = null;
      try {
        appPreviewResult = await Promise.race([
          window.__CODEX_MOBILE_VITE_APP_PREVIEW_PROMISE__,
          new Promise((resolve) => setTimeout(() => resolve({ ok: false, timeout: true }), 6000)),
        ]);
      } catch (error) {
        appPreviewResult = { ok: false, errorCode: String(error && error.message || error || "vite_app_preview_failed").slice(0, 120) };
      }
      try {
        await Promise.race([
          window.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY_PROMISE__,
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
      } catch (_) {
        // Keep this probe fail-closed through esmCompatibilityReady below.
      }
      const visible = (element) => Boolean(element
        && element.getBoundingClientRect
        && element.getBoundingClientRect().height > 0
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden");
      const waitForAppVisible = async (timeoutMs, requirePluginStartupCleared) => {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          const appNode = document.getElementById("app");
          const currentState = window.state || {};
          const startupCleared = requirePluginStartupCleared
            ? currentState.pluginStartupLoading === false
            : true;
          if (startupCleared && visible(appNode)) break;
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
      };
      if (${expectPluginSession ? "true" : "false"}) {
        const sessionDeadline = Date.now() + 7000;
        while (Date.now() < sessionDeadline) {
          const currentState = window.state || {};
          const currentUrl = new URL(window.location.href);
          if (currentState.pluginSessionActive === true
            && currentState.pluginLaunchSession === false
            && currentState.key
            && !currentUrl.searchParams.has("codexPluginLaunch")
            && !currentUrl.searchParams.has("pluginLaunch")) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
        await waitForAppVisible(9000, true);
      } else if (${expectEmbed ? "true" : "false"}) {
        await waitForAppVisible(9000, true);
      } else {
        await waitForAppVisible(9000, false);
      }
      await new Promise((resolve) => setTimeout(resolve, 600));
      const app = document.getElementById("app");
      const login = document.getElementById("login");
      const bootRecovery = document.getElementById("bootRecovery");
      const html = document.documentElement;
      const status = window.__CODEX_MOBILE_VITE_APP_PREVIEW__ || {};
      const esmCompatibility = window.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY__ || {};
      const esmCompatibilityModules = Array.isArray(esmCompatibility.modules)
        ? esmCompatibility.modules
        : [];
      const declaredEsmCompatibilityIds = esmCompatibilityModules
        .map((entry) => String(entry && entry.id || ""))
        .filter(Boolean);
      const readyEsmCompatibilityIds = new Set(esmCompatibilityModules
        .filter((entry) => entry && entry.ready === true)
        .map((entry) => String(entry.id || "")));
      const locationUrl = new URL(window.location.href);
      const initialPluginEmbed = window.INITIAL_PLUGIN_EMBED || {};
      const state = window.state || {};
      const localStorageKey = String(localStorage.getItem("codexMobileKey") || "");
      const moduleScripts = Array.from(document.querySelectorAll("script[type='module']"))
        .map((script) => {
          try {
            return new URL(script.getAttribute("src") || "", window.location.href).pathname;
          } catch (_) {
            return "";
          }
        })
        .filter(Boolean);
      const classicScripts = Array.from(document.querySelectorAll("script[data-codex-vite-app-preview-classic-script]"))
        .map((script) => {
          try {
            return new URL(script.getAttribute("src") || "", window.location.href).pathname;
          } catch (_) {
            return "";
          }
        })
        .filter(Boolean);
      const shellManifest = window.CODEX_MOBILE_SHELL_MANIFEST || {};
      const shellScripts = Array.isArray(shellManifest.indexScriptAssets)
        ? shellManifest.indexScriptAssets
        : (Array.isArray(shellManifest.scriptAssets) ? shellManifest.scriptAssets : []);
      const loaderPlanNode = document.getElementById("codex-vite-app-preview-loader-plan");
      let loaderPlan = null;
      try {
        loaderPlan = loaderPlanNode ? JSON.parse(loaderPlanNode.textContent || "{}") : null;
      } catch (_) {
        loaderPlan = null;
      }
      const loaderPlanScripts = loaderPlan && Array.isArray(loaderPlan.scripts)
        ? loaderPlan.scripts.map((entry) => String(entry && entry.path || "")).filter(Boolean)
        : [];
      const loaderPlanExcludedEsmScripts = loaderPlan && Array.isArray(loaderPlan.excludedEsmScripts)
        ? loaderPlan.excludedEsmScripts.map((entry) => ({
          path: String(entry && entry.path || ""),
          esmModuleId: String(entry && entry.esmModuleId || ""),
          globalName: String(entry && entry.globalName || ""),
        })).filter((entry) => entry.path)
        : [];
      const loaderPlanExcludedEsmPaths = loaderPlanExcludedEsmScripts.map((entry) => entry.path);
      const loaderPlanExcludedEsmIds = loaderPlanExcludedEsmScripts
        .map((entry) => String(entry && entry.esmModuleId || ""))
        .filter(Boolean);
      const loaderPlanExcludedViteOwnedScripts = loaderPlan && Array.isArray(loaderPlan.excludedViteOwnedScripts)
        ? loaderPlan.excludedViteOwnedScripts.map((entry) => ({
          path: String(entry && entry.path || ""),
          ownerId: String(entry && entry.ownerId || ""),
          globalName: String(entry && entry.globalName || ""),
        })).filter((entry) => entry.path)
        : [];
      const loaderPlanExcludedViteOwnedPaths = loaderPlanExcludedViteOwnedScripts.map((entry) => entry.path);
      const expectedEsmCompatibilityIds = loaderPlanExcludedEsmIds.length
        ? loaderPlanExcludedEsmIds
        : declaredEsmCompatibilityIds;
      const expectedEsmCompatibilityCount = Math.max(
        Number(loaderPlan && loaderPlan.excludedEsmScriptCount || 0) || 0,
        Number(esmCompatibility.moduleCount) || 0,
        expectedEsmCompatibilityIds.length
      );
      const expectedEsmCompatibilityIdSet = new Set(expectedEsmCompatibilityIds);
      const declaredEsmCompatibilityIdSet = new Set(declaredEsmCompatibilityIds);
      const esmCompatibilityIdsComplete = expectedEsmCompatibilityCount > 0
        && expectedEsmCompatibilityIds.length === expectedEsmCompatibilityCount
        && expectedEsmCompatibilityIdSet.size === expectedEsmCompatibilityCount
        && declaredEsmCompatibilityIds.length === expectedEsmCompatibilityCount
        && declaredEsmCompatibilityIdSet.size === expectedEsmCompatibilityCount
        && expectedEsmCompatibilityIds.every((id) => declaredEsmCompatibilityIdSet.has(id));
      const loaderPlanCoveredShellScriptSet = new Set([
        ...loaderPlanScripts,
        ...loaderPlanExcludedEsmPaths,
        ...loaderPlanExcludedViteOwnedPaths,
      ]);
      const loaderPlanCoveredShellScripts = shellScripts.filter((path) => loaderPlanCoveredShellScriptSet.has(path));
      const expectedInjectedScripts = loaderPlan ? loaderPlanScripts : shellScripts;
      const excludedEsmGlobalsReady = loaderPlanExcludedEsmScripts.every((entry) => (
        entry.globalName && Boolean(window[entry.globalName])
      ));
      const excludedViteOwnedGlobalsReady = loaderPlanExcludedViteOwnedScripts.every((entry) => (
        entry.globalName && Boolean(window[entry.globalName])
      ));
      const esmCompatibilityGlobalsPublished = esmCompatibilityModules.every((entry) => (
        entry && entry.classicLoaderExcluded === true ? entry.globalPublished === true : true
      ));
      const statusLoaded = Array.isArray(status.loaded)
        ? status.loaded.map((entry) => String(entry || "")).filter(Boolean)
        : [];
      const statusFailed = Array.isArray(status.failed)
        ? status.failed.map((entry) => String(entry || "")).filter(Boolean)
        : [];
      const loaderStatusCompleted = Number(status.completedAt || 0) > 0;
      const loaderStatusOk = status.ok === true
        && loaderStatusCompleted
        && statusFailed.length === 0
        && JSON.stringify(statusLoaded) === JSON.stringify(loaderPlanScripts);
      const loaderPromiseOk = Boolean(appPreviewResult && appPreviewResult.ok);
      const loaderPromiseTimedOut = Boolean(appPreviewResult && appPreviewResult.timeout);
      const classicBindingProbe = (() => {
        const result = {
          bareStateType: "",
          stateMatchesGlobal: false,
          bareEmbedFunctionType: "",
          globalEmbedFunctionType: typeof window.isHermesEmbedMode,
          bareEmbedResult: null,
          globalEmbedResult: null,
          bareExchangeFunctionType: "",
          globalExchangeFunctionType: typeof window.exchangePluginLaunchSession,
          exchangeMatchesGlobal: false,
        };
        try {
          result.bareStateType = typeof state;
          result.stateMatchesGlobal = state === window.state;
        } catch (_) {}
        try {
          result.bareEmbedFunctionType = typeof isHermesEmbedMode;
          result.bareEmbedResult = typeof isHermesEmbedMode === "function" ? isHermesEmbedMode() === true : null;
          result.globalEmbedResult = typeof window.isHermesEmbedMode === "function" ? window.isHermesEmbedMode() === true : null;
        } catch (_) {}
        try {
          result.bareExchangeFunctionType = typeof exchangePluginLaunchSession;
          result.exchangeMatchesGlobal = typeof exchangePluginLaunchSession === "function"
            && exchangePluginLaunchSession === window.exchangePluginLaunchSession;
        } catch (_) {}
        return result;
      })();
      const currentClientBuildId = String(window.CLIENT_BUILD_ID || "");
      const runtimeClientBuildUsesClassicCache = Boolean(${JSON.stringify(expectedClassicShellCacheName)} && currentClientBuildId.includes(${JSON.stringify(expectedClassicShellCacheName)}));
      let updateStatusCurrentBuildIdentityPresent = false;
      let updateStatusCurrentBuildIssueCodes = [];
      let updateStatusCurrentClientBuildMatches = false;
      let updateStatusCurrentShellCacheMatches = false;
      let updateFullClientVersionPresent = false;
      let updateFullClientVersionMatches = false;
      let updateFullClientVersionUsesClassicCache = false;
      let updateFullClientVersionErrorCode = "";
      try {
        const settingsRuntime = (() => {
          const candidate = window.CodexSettingsRuntime || null;
          if (candidate && typeof candidate.refreshAppUpdateStatus === "function") return candidate;
          if (typeof window.refreshAppUpdateStatus === "function" || typeof window.renderUpdatePanel === "function") {
            return {
              refreshAppUpdateStatus: window.refreshAppUpdateStatus,
              renderUpdatePanel: window.renderUpdatePanel,
            };
          }
          return candidate;
        })();
        if (settingsRuntime && typeof settingsRuntime.refreshAppUpdateStatus === "function") {
          const appUpdateStatus = await settingsRuntime.refreshAppUpdateStatus({ force: true, silent: true });
          const currentBuild = appUpdateStatus && appUpdateStatus.currentBuild && typeof appUpdateStatus.currentBuild === "object"
            ? appUpdateStatus.currentBuild
            : {};
          const statusClientBuildId = String(currentBuild.clientBuildId || appUpdateStatus && appUpdateStatus.clientBuildId || "");
          const statusShellCacheName = String(currentBuild.shellCacheName || appUpdateStatus && appUpdateStatus.shellCacheName || "");
          const classicShellCacheName = String(currentBuild.classicShellCacheName || appUpdateStatus && appUpdateStatus.classicShellCacheName || "");
          const statusIssueCodes = new Set();
          for (const values of [currentBuild.issueCodes, appUpdateStatus && appUpdateStatus.currentBuildIssueCodes, appUpdateStatus && appUpdateStatus.issueCodes]) {
            if (!Array.isArray(values)) continue;
            values.forEach((value) => {
              const code = String(value || "").replace(/[^a-z0-9_.:-]+/gi, "_").slice(0, 80);
              if (code) statusIssueCodes.add(code);
            });
          }
          updateStatusCurrentBuildIdentityPresent = Boolean(statusClientBuildId && statusShellCacheName);
          updateStatusCurrentBuildIssueCodes = Array.from(statusIssueCodes).slice(0, 8);
          updateStatusCurrentClientBuildMatches = ${JSON.stringify(expectedClientBuildId)}
            ? statusClientBuildId === ${JSON.stringify(expectedClientBuildId)}
            : Boolean(statusClientBuildId);
          updateStatusCurrentShellCacheMatches = ${JSON.stringify(expectedShellCacheName)}
            ? statusShellCacheName === ${JSON.stringify(expectedShellCacheName)}
            : Boolean(statusShellCacheName);
          if (window.state && typeof window.state === "object") window.state.updatePanelOpen = true;
          if (typeof settingsRuntime.renderUpdatePanel === "function") settingsRuntime.renderUpdatePanel();
          await new Promise((resolve) => setTimeout(resolve, 0));
          const versionNode = document.querySelector(".update-version-card .update-row-meta");
          const versionText = String(versionNode && versionNode.textContent || "");
          updateFullClientVersionPresent = Boolean(versionText);
          updateFullClientVersionMatches = ${JSON.stringify(expectedClientBuildId)}
            ? versionText.includes(${JSON.stringify(expectedClientBuildId)})
            : Boolean(versionText);
          updateFullClientVersionUsesClassicCache = Boolean((classicShellCacheName || ${JSON.stringify(expectedClassicShellCacheName)}) && versionText.includes(classicShellCacheName || ${JSON.stringify(expectedClassicShellCacheName)}));
          if (window.state && typeof window.state === "object") window.state.updatePanelOpen = false;
          if (typeof settingsRuntime.renderUpdatePanel === "function") settingsRuntime.renderUpdatePanel();
        } else {
          updateFullClientVersionErrorCode = "settings_runtime_unavailable";
        }
      } catch (err) {
        updateFullClientVersionErrorCode = String(err && err.message || "update_version_probe_failed").slice(0, 160);
      }
      if (!updateStatusCurrentBuildIdentityPresent) {
        try {
          if (localStorageKey) {
            const response = await fetch("/api/app-update/status?force=1", {
              headers: { Authorization: "Bearer " + localStorageKey },
            });
            if (response.ok) {
              const appUpdateStatus = await response.json();
              const currentBuild = appUpdateStatus && appUpdateStatus.currentBuild && typeof appUpdateStatus.currentBuild === "object"
                ? appUpdateStatus.currentBuild
                : {};
              const statusClientBuildId = String(currentBuild.clientBuildId || appUpdateStatus && appUpdateStatus.clientBuildId || "");
              const statusShellCacheName = String(currentBuild.shellCacheName || appUpdateStatus && appUpdateStatus.shellCacheName || "");
              const statusIssueCodes = new Set();
              for (const values of [currentBuild.issueCodes, appUpdateStatus && appUpdateStatus.currentBuildIssueCodes, appUpdateStatus && appUpdateStatus.issueCodes]) {
                if (!Array.isArray(values)) continue;
                values.forEach((value) => {
                  const code = String(value || "").replace(/[^a-z0-9_.:-]+/gi, "_").slice(0, 80);
                  if (code) statusIssueCodes.add(code);
                });
              }
              updateStatusCurrentBuildIdentityPresent = Boolean(statusClientBuildId && statusShellCacheName);
              updateStatusCurrentBuildIssueCodes = Array.from(statusIssueCodes).slice(0, 8);
              updateStatusCurrentClientBuildMatches = ${JSON.stringify(expectedClientBuildId)}
                ? statusClientBuildId === ${JSON.stringify(expectedClientBuildId)}
                : Boolean(statusClientBuildId);
              updateStatusCurrentShellCacheMatches = ${JSON.stringify(expectedShellCacheName)}
                ? statusShellCacheName === ${JSON.stringify(expectedShellCacheName)}
                : Boolean(statusShellCacheName);
              if (updateStatusCurrentBuildIdentityPresent) updateFullClientVersionErrorCode = "";
            } else {
              updateFullClientVersionErrorCode = "app_update_status_http_" + String(response.status || 0);
            }
          }
        } catch (err) {
          updateFullClientVersionErrorCode = String(err && err.message || "app_update_status_probe_failed").slice(0, 160);
        }
      }
      const pluginRefreshPending = document.querySelector(".plugin-refresh-pending");
      const connectionStateText = String(document.getElementById("connectionState") && document.getElementById("connectionState").textContent || "");
      const pluginRefreshBannerVisibleAfterBuildSettled = Boolean(
        ${JSON.stringify(expectedClientBuildId)}
        && currentClientBuildId === ${JSON.stringify(expectedClientBuildId)}
        && updateStatusCurrentClientBuildMatches
        && updateStatusCurrentShellCacheMatches
        && (visible(pluginRefreshPending) || /Refreshing plugin page/i.test(connectionStateText))
      );
      return {
        label: "vite-app-preview",
        probeKind: "vite-app-preview",
        path: window.location.pathname,
        markerPresent: Boolean(html && html.dataset && html.dataset.codexViteAppPreview === "true"),
        metaPresent: Boolean(document.querySelector("meta[name='codex-vite-app-preview']")),
        moduleScriptCount: moduleScripts.length,
        moduleScriptMatchesPreview: moduleScripts.some((scriptPath) => scriptPath === "/vite-shell/app-preview-entry.js" || /^\\/vite-shell\\/assets\\/vite-shell-entry-/.test(scriptPath)),
        classicScriptCount: classicScripts.length,
        shellScriptCount: shellScripts.length,
        expectedClassicScriptCount: expectedInjectedScripts.length,
        classicScriptOrderMatches: JSON.stringify(classicScripts) === JSON.stringify(expectedInjectedScripts),
        loaderPlanPresent: Boolean(loaderPlanNode && loaderPlan),
        loaderPlanOwner: String(loaderPlan && loaderPlan.owner || ""),
        loaderPlanOwnerOk: String(loaderPlan && loaderPlan.owner || "") === "vite-shell-entry",
        loaderPlanSourceScriptCount: Number(loaderPlan && loaderPlan.sourceScriptCount || 0) || 0,
        loaderPlanScriptCount: Number(loaderPlan && loaderPlan.scriptCount || 0) || 0,
        loaderPlanHashCount: Number(loaderPlan && loaderPlan.hashCount || 0) || 0,
        loaderPlanExcludedEsmScriptCount: Number(loaderPlan && loaderPlan.excludedEsmScriptCount || 0) || 0,
        loaderPlanExcludedEsmHashCount: Number(loaderPlan && loaderPlan.excludedEsmHashCount || 0) || 0,
        loaderPlanExcludedEsmGlobalsReady: excludedEsmGlobalsReady,
        loaderPlanExcludedViteOwnedScriptCount: Number(loaderPlan && loaderPlan.excludedViteOwnedScriptCount || 0) || 0,
        loaderPlanExcludedViteOwnedHashCount: Number(loaderPlan && loaderPlan.excludedViteOwnedHashCount || 0) || 0,
        loaderPlanExcludedViteOwnedGlobalsReady: excludedViteOwnedGlobalsReady,
        loaderPlanHashPresent: Boolean(loaderPlan && loaderPlan.sha256),
        loaderPlanMatchesShellScripts: JSON.stringify(loaderPlanCoveredShellScripts) === JSON.stringify(shellScripts)
          && loaderPlanCoveredShellScriptSet.size === shellScripts.length,
        loaderPlanMatchesInjectedScripts: JSON.stringify(loaderPlanScripts) === JSON.stringify(classicScripts),
        loaderPlanLoadedMatches: JSON.stringify(statusLoaded) === JSON.stringify(loaderPlanScripts),
        esmCompatibilityReady: String(esmCompatibility.owner || "") === "vite-shell-entry"
          && Number(esmCompatibility.moduleCount) === expectedEsmCompatibilityCount
          && Number(esmCompatibility.readyCount) === expectedEsmCompatibilityCount
          && esmCompatibilityIdsComplete === true
          && expectedEsmCompatibilityIds.every((id) => readyEsmCompatibilityIds.has(id)),
        esmCompatibilityOwner: String(esmCompatibility.owner || ""),
        esmCompatibilityModuleCount: Number(esmCompatibility.moduleCount) || esmCompatibilityModules.length,
        esmCompatibilityReadyCount: Number(esmCompatibility.readyCount) || esmCompatibilityModules.filter((entry) => entry && entry.ready === true).length,
        esmCompatibilityExpectedCount: expectedEsmCompatibilityCount,
        esmCompatibilityGlobalsPublished,
        esmCompatibilityNotReadyModuleIds: esmCompatibilityModules
          .filter((entry) => entry && entry.ready !== true)
          .map((entry) => String(entry && entry.id || ""))
          .filter(Boolean)
          .slice(0, 20),
        esmCompatibilityNotReadyModules: esmCompatibilityModules
          .filter((entry) => entry && entry.ready !== true)
          .map((entry) => ({
            id: String(entry && entry.id || ""),
            expectedFunctionCount: Array.isArray(entry && entry.expectedFunctions) ? entry.expectedFunctions.length : 0,
            exportedFunctionCount: Array.isArray(entry && entry.exportedFunctions) ? entry.exportedFunctions.length : 0,
            globalPublished: entry && entry.globalPublished === true,
            sample: entry && entry.sample && typeof entry.sample === "object" ? entry.sample : null,
          }))
          .filter((entry) => entry.id)
          .slice(0, 8),
        loaderOk: loaderPromiseOk || loaderStatusOk,
        loaderTimedOut: loaderPromiseTimedOut && !loaderStatusOk,
        loaderPromiseOk,
        loaderPromiseTimedOut,
        loaderStatusOk,
        loaderStatusCompleted,
        loaderLoadedCount: Number(appPreviewResult && appPreviewResult.loadedCount || status.loaded && status.loaded.length || 0) || 0,
        loaderFailedCount: Number(appPreviewResult && appPreviewResult.failedCount || status.failed && status.failed.length || 0) || 0,
        loaderErrorCode: String(appPreviewResult && appPreviewResult.errorCode || status.failed && status.failed[0] || "").slice(0, 120),
        appStartAttempted: status.appStartAttempted === true,
        appStartPending: status.appStartPending === true,
        appStartOk: status.appStartOk === true,
        appStartCompleted: Number(status.appStartCompletedAt || 0) > 0,
        appStartErrorCode: String(status.appStartErrorCode || "").slice(0, 160),
        appStartPromisePresent: Boolean(window.__CODEX_MOBILE_VITE_APP_PREVIEW_APP_START_PROMISE__
          && typeof window.__CODEX_MOBILE_VITE_APP_PREVIEW_APP_START_PROMISE__.then === "function"),
        embedExpected: ${expectEmbed ? "true" : "false"},
        pluginSessionExpected: ${expectPluginSession ? "true" : "false"},
        rootPreviewExpected: ${expectRoot ? "true" : "false"},
        defaultRootPreviewExpected: ${expectDefaultRoot ? "true" : "false"},
        rootPathPreserved: window.location.pathname === "/",
        rootViteShellParamPresent: locationUrl.searchParams.get("codexViteShell") === "app-preview",
        rootViteShellParamAbsent: !locationUrl.searchParams.has("codexViteShell"),
        embedQueryPresent: locationUrl.searchParams.get("embed") === "hermes",
        embedHtmlClassPresent: Boolean(html && html.classList && html.classList.contains("embed-hermes")),
        embedPrimaryClassPresent: Boolean(html && html.classList && html.classList.contains("embed-hermes-primary")),
        pluginEmbedApiReady: Boolean(window.CodexPluginEmbed && typeof window.CodexPluginEmbed.detect === "function"),
        initialPluginEmbedEmbedded: Boolean(initialPluginEmbed && initialPluginEmbed.embedded === true),
        initialPluginLaunchKeyPresent: Boolean(window.INITIAL_PLUGIN_LAUNCH_KEY),
        classicBindingProbe,
        pluginLaunchExchangeGate: state.pluginLaunchExchangeGate && typeof state.pluginLaunchExchangeGate === "object"
          ? {
            embed: state.pluginLaunchExchangeGate.embed === true,
            launchSession: state.pluginLaunchExchangeGate.launchSession === true,
            hasKey: state.pluginLaunchExchangeGate.hasKey === true,
          }
          : null,
        pluginLaunchExchangeAttempted: state.pluginLaunchExchangeAttempted === true,
        pluginLaunchExchangeCompleted: state.pluginLaunchExchangeCompleted === true,
        pluginLaunchExchangeFailed: state.pluginLaunchExchangeFailed === true,
        pluginLaunchExchangeErrorCode: String(state.pluginLaunchExchangeErrorCode || "").slice(0, 160),
        appShellStartupRecoveryErrorCode: String(state.appShellStartupRecoveryErrorCode || "").slice(0, 160),
        appShellStartAttempted: state.appShellStartAttempted === true,
        appShellPublicConfigLoaded: state.appShellPublicConfigLoaded === true,
        appShellPublicConfigFailed: state.appShellPublicConfigFailed === true,
        appShellPublicConfigErrorCode: String(state.appShellPublicConfigErrorCode || "").slice(0, 160),
        startupInProgress: state.startupInProgress === true,
        pluginModeLocalKeySuppressed: Boolean(window.state && !state.key),
        pluginLaunchUrlScrubbed: !locationUrl.searchParams.has("codexPluginLaunch") && !locationUrl.searchParams.has("pluginLaunch"),
        pluginLaunchSessionCleared: state.pluginLaunchSession === false,
        pluginSessionActive: state.pluginSessionActive === true,
        pluginSessionKeyPresent: Boolean(state.key),
        pluginSessionKeyDiffersFromLocalStorage: Boolean(state.key && state.key !== localStorageKey),
        pluginAppPreviewPathPreserved: window.location.pathname === "/vite-shell/app-preview.html",
        pluginStartupLoadingCleared: state.pluginStartupLoading === false,
        clientBuildPresent: Boolean(window.CLIENT_BUILD_ID),
        clientBuildMatches: ${JSON.stringify(expectedClientBuildId)} ? currentClientBuildId === ${JSON.stringify(expectedClientBuildId)} : Boolean(currentClientBuildId),
        runtimeClientBuildUsesClassicCache,
        shellCacheMatches: ${JSON.stringify(expectedShellCacheName)} ? String(shellManifest.shellCacheName || "") === ${JSON.stringify(expectedShellCacheName)} : Boolean(shellManifest.shellCacheName),
        updateStatusCurrentBuildIdentityPresent,
        updateStatusCurrentBuildIssueCodes,
        updateStatusCurrentClientBuildMatches,
        updateStatusCurrentShellCacheMatches,
        updateFullClientVersionPresent,
        updateFullClientVersionMatches,
        updateFullClientVersionUsesClassicCache,
        updateFullClientVersionErrorCode,
        pluginRefreshBannerVisibleAfterBuildSettled,
        appVisible: visible(app),
        loginVisible: visible(login),
        bootRecoveryVisible: visible(bootRecovery),
        composerRuntimeReady: Boolean(window.CodexComposerRuntime && typeof window.CodexComposerRuntime.createComposerRuntime === "function"),
        threadListRuntimeReady: Boolean(window.CodexThreadListRuntime && typeof window.CodexThreadListRuntime.createThreadListRuntime === "function"),
        threadTileRuntimeReady: Boolean(window.CodexThreadTileRuntime && typeof window.CodexThreadTileRuntime.createThreadTileRuntime === "function"),
        loadThreadReady: typeof window.loadThread === "function",
      };
    })()
  `;
}

function analyzeViteAppPreviewProbe(sample = {}, runtimeSignals = {}, options = {}) {
  const issues = [];
  const append = (code, severity = "H2", extra = {}) => {
    issues.push(Object.assign({
      severity,
      code,
      surface: "browser-runtime",
    }, extra));
  };
  if (!sample || sample.markerPresent !== true || sample.metaPresent !== true) append("vite_app_preview_marker_missing");
  if (sample && sample.moduleScriptMatchesPreview !== true) append("vite_app_preview_module_entry_missing");
  if (sample && (sample.loaderPlanPresent !== true
    || sample.loaderPlanOwnerOk !== true
    || sample.loaderPlanHashPresent !== true)) {
    append("vite_app_preview_classic_loader_plan_missing", "H2", {
      owner: sample.loaderPlanOwner || "",
    });
  }
  const loaderPlanScriptCount = Number(sample && sample.loaderPlanScriptCount || 0) || 0;
  const loaderPlanExcludedEsmScriptCount = Number(sample && sample.loaderPlanExcludedEsmScriptCount || 0) || 0;
  const loaderPlanExcludedViteOwnedScriptCount = Number(sample && sample.loaderPlanExcludedViteOwnedScriptCount || 0) || 0;
  const loaderPlanCoveredScriptCount = loaderPlanScriptCount
    + loaderPlanExcludedEsmScriptCount
    + loaderPlanExcludedViteOwnedScriptCount;
  const loaderPlanSourceScriptCount = Number(sample && sample.loaderPlanSourceScriptCount || 0) || 0;
  const shellScriptCount = Number(sample && sample.shellScriptCount || sample && sample.expectedClassicScriptCount || 0) || 0;
  if (sample && (Number(sample.loaderPlanHashCount) !== loaderPlanScriptCount
    || (Number(sample.loaderPlanSourceScriptCount) > 0
      && loaderPlanSourceScriptCount !== shellScriptCount)
    || (loaderPlanSourceScriptCount > 0 && loaderPlanCoveredScriptCount !== loaderPlanSourceScriptCount)
    || loaderPlanExcludedEsmScriptCount !== Number(sample.loaderPlanExcludedEsmHashCount || 0)
    || loaderPlanExcludedViteOwnedScriptCount !== Number(sample.loaderPlanExcludedViteOwnedHashCount || 0)
    || sample.loaderPlanMatchesShellScripts !== true)) {
    append("vite_app_preview_classic_loader_plan_mismatch", "H2", {
      loaderPlanScriptCount: Number(sample.loaderPlanScriptCount) || 0,
      expectedClassicScriptCount: Number(sample.expectedClassicScriptCount) || 0,
    });
  }
  if (sample && (sample.esmCompatibilityReady !== true || sample.esmCompatibilityGlobalsPublished === false)) {
    append("vite_app_preview_esm_compatibility_missing", "H2", {
      owner: sample.esmCompatibilityOwner || "",
      moduleCount: Number(sample.esmCompatibilityModuleCount) || 0,
      readyCount: Number(sample.esmCompatibilityReadyCount) || 0,
      notReadyModuleIds: Array.isArray(sample.esmCompatibilityNotReadyModuleIds)
        ? sample.esmCompatibilityNotReadyModuleIds.slice(0, 20)
        : [],
      notReadyModules: Array.isArray(sample.esmCompatibilityNotReadyModules)
        ? sample.esmCompatibilityNotReadyModules.slice(0, 8)
        : [],
    });
  }
  if (sample && Number(sample.loaderPlanExcludedEsmScriptCount || 0) > 0
    && sample.loaderPlanExcludedEsmGlobalsReady !== true) {
    append("vite_app_preview_esm_loader_exclusion_global_missing", "H2", {
      excludedCount: Number(sample.loaderPlanExcludedEsmScriptCount) || 0,
    });
  }
  if (sample && Number(sample.loaderPlanExcludedViteOwnedScriptCount || 0) > 0
    && sample.loaderPlanExcludedViteOwnedGlobalsReady !== true) {
    append("vite_app_preview_vite_owned_loader_exclusion_global_missing", "H2", {
      excludedCount: Number(sample.loaderPlanExcludedViteOwnedScriptCount) || 0,
    });
  }
  if (sample && sample.loaderOk !== true) append("vite_app_preview_loader_failed", "H2", {
    errorCode: sample.loaderErrorCode || "",
    timedOut: sample.loaderTimedOut === true,
  });
  if (sample && sample.appStartErrorCode) append("vite_app_preview_app_start_failed", "H2", {
    errorCode: sample.appStartErrorCode || "",
  });
  if (sample && sample.appShellStartupRecoveryErrorCode) append("vite_app_preview_app_start_recovery_error", "H2", {
    errorCode: sample.appShellStartupRecoveryErrorCode || "",
  });
  if (sample && (Number(sample.classicScriptCount) !== loaderPlanScriptCount
    || sample.classicScriptOrderMatches !== true
    || sample.loaderPlanMatchesInjectedScripts !== true
    || sample.loaderPlanLoadedMatches !== true)) {
    append("vite_app_preview_classic_script_order_mismatch", "H2", {
      classicScriptCount: Number(sample.classicScriptCount) || 0,
      expectedClassicScriptCount: Number(sample.expectedClassicScriptCount) || 0,
    });
  }
  if (sample && sample.clientBuildMatches !== true) append("vite_app_preview_client_build_mismatch");
  if (sample && sample.shellCacheMatches !== true) append("vite_app_preview_shell_cache_mismatch");
  for (const issue of clientVersionSwitchIssueDescriptors(sample)) {
    const { code, severity, ...extra } = issue;
    append(code, severity, extra);
  }
  if (sample && hasClientVersionSwitchProbe(sample) && !clientVersionSwitchConfirmed(sample)) append("client_version_switch_not_confirmed", "H2", {
    statusIdentityPresent: sample.updateStatusCurrentBuildIdentityPresent === true,
    statusClientBuildMatches: sample.updateStatusCurrentClientBuildMatches === true,
    statusShellCacheMatches: sample.updateStatusCurrentShellCacheMatches === true,
    fullVersionPresent: sample.updateFullClientVersionPresent === true,
    fullVersionMatches: sample.updateFullClientVersionMatches === true,
    fullVersionUsesClassicCache: sample.updateFullClientVersionUsesClassicCache === true,
    runtimeUsesClassicCache: sample.runtimeClientBuildUsesClassicCache === true,
    refreshBannerStuck: sample.pluginRefreshBannerVisibleAfterBuildSettled === true,
    reason: boundedToken(sample.updateFullClientVersionErrorCode, ""),
  });
  const expectEmbed = options.expectEmbed === true || (sample && sample.embedExpected === true);
  const expectPluginSession = options.expectPluginSession === true || (sample && sample.pluginSessionExpected === true);
  const expectRoot = options.expectRoot === true || (sample && sample.rootPreviewExpected === true);
  const expectDefaultRoot = options.expectDefaultRoot === true || (sample && sample.defaultRootPreviewExpected === true);
  if (expectRoot) {
    if (!sample || sample.rootPathPreserved !== true) append("vite_app_preview_root_path_changed");
    if (expectDefaultRoot) {
      if (!sample || sample.rootViteShellParamAbsent !== true) append("vite_app_preview_default_root_opt_in_present");
    } else if (!sample || sample.rootViteShellParamPresent !== true) {
      append("vite_app_preview_root_opt_in_missing");
    }
  }
  if (expectEmbed) {
    if (!sample || sample.embedQueryPresent !== true) append("vite_app_preview_embed_query_missing");
    if (!sample || sample.embedHtmlClassPresent !== true) append("vite_app_preview_embed_class_missing");
    if (!sample || sample.pluginEmbedApiReady !== true) append("vite_app_preview_plugin_embed_api_missing");
    if (!sample || sample.initialPluginEmbedEmbedded !== true) append("vite_app_preview_initial_plugin_embed_missing");
    if (expectPluginSession) {
      if (!sample || sample.initialPluginLaunchKeyPresent !== true) append("vite_app_preview_plugin_launch_key_missing");
      if (!sample || sample.pluginLaunchUrlScrubbed !== true) append("vite_app_preview_plugin_launch_url_not_scrubbed");
      if (!sample || sample.pluginLaunchSessionCleared !== true) append("vite_app_preview_plugin_launch_session_not_cleared");
      if (!sample || sample.pluginSessionActive !== true) append("vite_app_preview_plugin_session_inactive");
      if (!sample || sample.pluginSessionKeyPresent !== true) append("vite_app_preview_plugin_session_key_missing");
      if (!sample || sample.pluginSessionKeyDiffersFromLocalStorage !== true) append("vite_app_preview_plugin_session_uses_local_key");
      if (!sample || sample.pluginAppPreviewPathPreserved !== true) append("vite_app_preview_plugin_session_path_changed");
      if (!sample || sample.pluginStartupLoadingCleared !== true) append("vite_app_preview_plugin_startup_loading_stuck");
    } else if (!sample || sample.pluginModeLocalKeySuppressed !== true) {
      append("vite_app_preview_plugin_local_key_present");
    }
  }
  if (sample && sample.appVisible !== true) append("vite_app_preview_app_not_visible");
  if (sample && sample.bootRecoveryVisible === true) append("vite_app_preview_boot_recovery_visible");
  const runtimeReady = sample
    && sample.composerRuntimeReady === true
    && sample.threadListRuntimeReady === true
    && sample.threadTileRuntimeReady === true
    && sample.loadThreadReady === true;
  if (sample && runtimeReady !== true) {
    append("vite_app_preview_runtime_missing", "H2", {
      composerRuntimeReady: sample.composerRuntimeReady === true,
      threadListRuntimeReady: sample.threadListRuntimeReady === true,
      threadTileRuntimeReady: sample.threadTileRuntimeReady === true,
      loadThreadReady: sample.loadThreadReady === true,
    });
  }
  if ((runtimeSignals.exceptions || []).length) append("vite_app_preview_browser_exception");
  if ((runtimeSignals.consoleEvents || []).some((entry) => entry && entry.type === "error")) {
    append("vite_app_preview_console_error");
  }
  const blockingIssueCount = issues.filter((issue) => /^(H1|H2)$/i.test(issue.severity || "")).length;
  return {
    ok: blockingIssueCount === 0,
    issueCount: issues.length,
    blockingIssueCount,
    issues,
  };
}

function threadListInteractionProbeExpression(label = "thread-list-probe") {
  return `
    (async () => {
      const stableHash = (value) => {
        const text = String(value || "");
        let hash = 2166136261;
        for (let index = 0; index < text.length; index += 1) {
          hash ^= text.charCodeAt(index);
          hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, "0");
      };
      const raf = () => new Promise((resolve) => {
        const startedAt = performance.now();
        const done = () => resolve(Math.max(0, Math.round(performance.now() - startedAt)));
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(done);
        else setTimeout(done, 16);
      });
      const list = document.getElementById("threadList");
      const app = document.getElementById("app");
      const longTasks = Array.isArray(window.__codexSelfCheckLongTasks) ? window.__codexSelfCheckLongTasks.slice(-40) : [];
      const longTaskDurations = longTasks.map((entry) => Math.max(0, Math.round(Number(entry && entry.duration || 0))));
      const result = {
        label: ${JSON.stringify(String(label || "thread-list-probe").slice(0, 80))},
        probeKind: "thread-list-interaction",
        threadHash: stableHash("thread-list-interaction"),
        appVisible: Boolean(app && app.getBoundingClientRect && app.getBoundingClientRect().height > 0),
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 0,
        items: 0,
        renderKeys: 0,
        threadListAvailable: Boolean(list),
        threadListCardCount: list ? list.querySelectorAll("[data-thread]").length : 0,
        threadListScrollable: Boolean(list && list.scrollHeight > list.clientHeight + 4),
        threadListScrollHeight: list ? Math.trunc(list.scrollHeight || 0) : 0,
        threadListClientHeight: list ? Math.trunc(list.clientHeight || 0) : 0,
        threadListProbeElapsedMs: 0,
        threadListMaxRafDelayMs: 0,
        threadListMaxScrollApplyMs: 0,
        threadListScrollMovedCount: 0,
        longTaskCount: longTaskDurations.length,
        longTaskMaxDurationMs: longTaskDurations.length ? Math.max(...longTaskDurations) : 0,
        longTaskTotalDurationMs: longTaskDurations.reduce((total, value) => total + value, 0),
      };
      if (!list) return result;
      const startedAt = performance.now();
      const originalTop = list.scrollTop || 0;
      const maxTop = Math.max(0, list.scrollHeight - list.clientHeight);
      const targets = [
        Math.min(maxTop, originalTop + 96),
        Math.max(0, originalTop - 48),
        originalTop,
      ];
      for (const target of targets) {
        const before = performance.now();
        list.scrollTop = target;
        const rafDelay = await raf();
        const elapsed = Math.max(0, Math.round(performance.now() - before));
        result.threadListMaxRafDelayMs = Math.max(result.threadListMaxRafDelayMs, rafDelay);
        result.threadListMaxScrollApplyMs = Math.max(result.threadListMaxScrollApplyMs, elapsed);
        if (Math.abs(Number(list.scrollTop || 0) - target) <= 2) result.threadListScrollMovedCount += 1;
      }
      result.threadListProbeElapsedMs = Math.max(0, Math.round(performance.now() - startedAt));
      list.scrollTop = originalTop;
      return result;
    })();
  `;
}

function threadListStressProbeExpression(label = "thread-list-stress", rounds = 2) {
  return `
    (async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const boundedRounds = Math.max(0, Math.min(20, Math.trunc(Number(${JSON.stringify(rounds)} || 0))));
      const probe = async () => await ${threadListInteractionProbeExpression("__stress_inner__")};
      const openList = async () => {
        const button = document.getElementById("openMenu");
        if (button && typeof button.click === "function") {
          button.click();
          await wait(180);
        }
      };
      const stableHash = (value) => {
        const text = String(value || "");
        let hash = 2166136261;
        for (let index = 0; index < text.length; index += 1) {
          hash ^= text.charCodeAt(index);
          hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, "0");
      };
      const startedAt = performance.now();
      const results = [];
      for (let index = 0; index < boundedRounds; index += 1) {
        await openList();
        results.push(await probe());
        const buttons = Array.from(document.querySelectorAll("[data-thread]"));
        const target = buttons[index % Math.max(1, buttons.length)];
        if (target && typeof target.click === "function") {
          target.click();
          await wait(260);
        }
      }
      await openList();
      results.push(await probe());
      const maxOf = (key) => results.reduce((max, row) => Math.max(max, Math.max(0, Math.round(Number(row && row[key] || 0)))), 0);
      const list = document.getElementById("threadList");
      return {
        label: ${JSON.stringify(String(label || "thread-list-stress").slice(0, 80))},
        probeKind: "thread-list-interaction",
        stressProbe: true,
        threadHash: stableHash("thread-list-interaction"),
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 0,
        items: 0,
        renderKeys: 0,
        threadListAvailable: Boolean(list),
        threadListCardCount: list ? list.querySelectorAll("[data-thread]").length : 0,
        threadListScrollable: Boolean(list && list.scrollHeight > list.clientHeight + 4),
        threadListProbeElapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
        threadListMaxRafDelayMs: maxOf("threadListMaxRafDelayMs"),
        threadListMaxScrollApplyMs: maxOf("threadListMaxScrollApplyMs"),
        threadListScrollMovedCount: maxOf("threadListScrollMovedCount"),
        longTaskCount: maxOf("longTaskCount"),
        longTaskMaxDurationMs: maxOf("longTaskMaxDurationMs"),
        longTaskTotalDurationMs: maxOf("longTaskTotalDurationMs"),
      };
    })();
  `;
}

function openThreadExpression(threadId, input = {}) {
  const expectedClientBuildId = String(input.clientBuildId || "");
  return `
    (async () => {
      const id = ${JSON.stringify(threadId)};
      try { localStorage.setItem("codexMobileCurrentThreadId", id); } catch (_) {}
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const visible = (node) => {
        if (!node || typeof node.getBoundingClientRect !== "function") return false;
        const style = typeof getComputedStyle === "function" ? getComputedStyle(node) : {};
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.height > 0 && rect.width > 0;
      };
      const refreshBannerVisible = () => {
        const pluginRefreshPending = document.querySelector(".plugin-refresh-pending");
        const connectionText = String(document.getElementById("connectionState") && document.getElementById("connectionState").textContent || "");
        return Boolean(visible(pluginRefreshPending) || /Refreshing plugin page/i.test(connectionText));
      };
      const seedRefreshNotice = () => {
        const expectedBuild = ${JSON.stringify(expectedClientBuildId)};
        const currentBuild = String(window.CLIENT_BUILD_ID || "");
        if (!expectedBuild || currentBuild !== expectedBuild) return false;
        const sourceState = typeof state !== "undefined" ? state : window.state;
        if (!sourceState || typeof sourceState !== "object") return false;
        sourceState.pluginRefreshPendingReason = "server_build_changed";
        sourceState.pluginRefreshPendingNotice = "Refreshing plugin page for a new Mobile Web build...";
        sourceState.pluginRefreshRequestReason = "server_build_changed";
        sourceState.pluginRefreshRequestSignature = "self-check-thread-entry-seed";
        return true;
      };
      const seededThreadEntryRefreshBanner = seedRefreshNotice();
      const confirmedOpen = () => {
        try {
          const sourceState = typeof state !== "undefined" ? state : window.state;
          if (sourceState && String(sourceState.currentThreadId || "") === id) return true;
        } catch (_) {}
        const activeButton = document.querySelector("[data-thread].active");
        return Boolean(activeButton && String(activeButton.getAttribute("data-thread") || "") === id);
      };
      const waitForConfirmedOpen = async () => {
        for (let index = 0; index < 12; index += 1) {
          if (confirmedOpen()) return true;
          await wait(100);
        }
        return false;
      };
      const clickCard = () => {
        const button = Array.from(document.querySelectorAll("[data-thread]"))
          .find((entry) => String(entry.getAttribute("data-thread") || "") === id);
        if (button) {
          button.click();
          return true;
        }
        return false;
      };
      const finish = async (ok, method) => {
        await wait(0);
        window.__codexSelfCheckThreadEntryRefreshBanner = {
          seeded: seededThreadEntryRefreshBanner,
          visibleAfterOpen: Boolean(seededThreadEntryRefreshBanner && refreshBannerVisible()),
        };
        return { ok, method };
      };
      if (clickCard() && await waitForConfirmedOpen()) return finish(true, "thread-card");
      if (typeof window.loadThread === "function") {
        try {
          await window.loadThread(id, { source: "browser-runtime-self-check" });
          return finish(true, "loadThread");
        } catch (_) {
          return finish(false, "loadThread-failed");
        }
      }
      for (let index = 0; index < 20; index += 1) {
        await wait(100);
        if (clickCard() && await waitForConfirmedOpen()) return finish(true, "thread-card-delayed");
      }
      return finish(false, "unavailable");
    })();
  `;
}

function snapshotExpression(input = {}) {
  const threadId = String(input.threadId || "");
  const threadHash = String(input.threadHash || "");
  const expectedTurnHashes = Array.isArray(input.expectedTurnHashes) ? input.expectedTurnHashes : [];
  const expectedLatestTurnHash = String(input.expectedLatestTurnHash || "");
  const expectedLatestUsageRequired = Boolean(input.expectedLatestUsageRequired);
  const expectedLatestItemCount = Math.max(0, Number(input.expectedLatestItemCount || 0) || 0);
  const expectedLatestUserMessageCount = Math.max(0, Number(input.expectedLatestUserMessageCount || 0) || 0);
  const expectedLatestAssistantMessageCount = Math.max(0, Number(input.expectedLatestAssistantMessageCount || 0) || 0);
  const expectedLatestUserMessageDuplicateCount = Math.max(0, Number(input.expectedLatestUserMessageDuplicateCount || 0) || 0);
  const expectedLatestTaskCardUserMessageCount = Math.max(0, Number(input.expectedLatestTaskCardUserMessageCount || 0) || 0);
  const expectedTurnShapes = Array.isArray(input.expectedTurnShapes) ? input.expectedTurnShapes.slice(-20) : [];
  const expectedReadMode = boundedToken(input.expectedReadMode || "", "", 80);
  const expectedReadDecision = boundedToken(input.expectedReadDecision || "", "", 80);
  const expectedPerformancePhase = boundedToken(input.expectedPerformancePhase || "", "", 80);
  const returnLedgerCount = Math.max(0, Number(input.returnLedgerCount || 0) || 0);
  const returnLedgerVisibleCount = Math.max(0, Number(input.returnLedgerVisibleCount || 0) || 0);
  const returnLedgerProjectionFailedCount = Math.max(0, Number(input.returnLedgerProjectionFailedCount || 0) || 0);
  const returnLedgerDeliveryFailedCount = Math.max(0, Number(input.returnLedgerDeliveryFailedCount || 0) || 0);
  const returnLedgerIssueCodes = Array.isArray(input.returnLedgerIssueCodes) ? input.returnLedgerIssueCodes.slice(0, 12) : [];
  const dynamicThreadPlan = input.dynamicThreadPlan === true;
  const label = String(input.label || "");
  const delayMs = Math.max(0, Number(input.delayMs || 0) || 0);
  const exerciseSubmit = Boolean(input.exerciseSubmit);
  const submitPhase = String(input.submitPhase || "");
  const submitOk = input.submitOk === true;
  return `
    (() => {
      const threadId = ${JSON.stringify(threadId)};
      const threadHash = ${JSON.stringify(threadHash)};
      const expectedTurnHashes = new Set(${JSON.stringify(expectedTurnHashes)});
      const expectedLatestTurnHash = ${JSON.stringify(expectedLatestTurnHash)};
      const expectedLatestUsageRequired = ${JSON.stringify(expectedLatestUsageRequired)};
      const expectedLatestItemCount = ${JSON.stringify(expectedLatestItemCount)};
      const expectedLatestUserMessageCount = ${JSON.stringify(expectedLatestUserMessageCount)};
      const expectedLatestAssistantMessageCount = ${JSON.stringify(expectedLatestAssistantMessageCount)};
      const expectedLatestUserMessageDuplicateCount = ${JSON.stringify(expectedLatestUserMessageDuplicateCount)};
      const expectedLatestTaskCardUserMessageCount = ${JSON.stringify(expectedLatestTaskCardUserMessageCount)};
      const expectedTurnShapes = ${JSON.stringify(expectedTurnShapes)};
      const expectedReadMode = ${JSON.stringify(expectedReadMode)};
      const expectedReadDecision = ${JSON.stringify(expectedReadDecision)};
      const expectedPerformancePhase = ${JSON.stringify(expectedPerformancePhase)};
      const returnLedgerCount = ${JSON.stringify(returnLedgerCount)};
      const returnLedgerVisibleCount = ${JSON.stringify(returnLedgerVisibleCount)};
      const returnLedgerProjectionFailedCount = ${JSON.stringify(returnLedgerProjectionFailedCount)};
      const returnLedgerDeliveryFailedCount = ${JSON.stringify(returnLedgerDeliveryFailedCount)};
      const returnLedgerIssueCodes = ${JSON.stringify(returnLedgerIssueCodes)};
      const dynamicThreadPlan = ${JSON.stringify(dynamicThreadPlan)};
      const label = ${JSON.stringify(label)};
      const delayMs = ${JSON.stringify(delayMs)};
      const exerciseSubmit = ${JSON.stringify(exerciseSubmit)};
      const submitPhase = ${JSON.stringify(submitPhase)};
      const submitOk = ${JSON.stringify(submitOk)};
      const stableHash = (value) => {
        const text = String(value || "");
        let hash = 2166136261;
        for (let index = 0; index < text.length; index += 1) {
          hash ^= text.charCodeAt(index);
          hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, "0");
      };
      const duplicateCount = (rows) => {
        const seen = new Set();
        let duplicates = 0;
        for (const row of rows) {
          if (!row) continue;
          if (seen.has(row)) duplicates += 1;
          else seen.add(row);
        }
        return duplicates;
      };
      const imageSourceKind = (value) => {
        const text = String(value || "").trim();
        if (!text) return "empty";
        if (/^(?:[a-zA-Z]:[\\\\/]|\\\\\\\\|\\/Users\\/|\\/private\\/|\\/Volumes\\/)/.test(text)) return "local-path-leak";
        if (/(?:%2FUsers%2F|\\/Users\\/|\\.codex-mobile-web|[?&]path=)/i.test(text)) return "local-path-leak";
        if (/^data:image\\/gif;base64,R0lGODlhAQABAIAAAAAAAP\\/\\/\\/ywAAAAAAQABAAACAUwAOw==/i.test(text)) return "protected-placeholder";
        if (/^data:image\\//i.test(text)) return "data-image";
        if (/^blob:/i.test(text)) return "blob";
        if (/^file:\\/\\//i.test(text)) return "file-url";
        try {
          const parsed = new URL(text, window.location.origin);
          const pathname = parsed.pathname || "";
          if (parsed.origin !== window.location.origin) return "remote";
          if (/\\/api\\/hermes-plugins\\/[^/]+\\/proxy\\/api\\/generated-images\\/file$/.test(pathname)) return "hermes-proxy-generated-image";
          if (/\\/api\\/hermes-plugins\\/[^/]+\\/proxy\\/api\\/uploads\\/file$/.test(pathname)) return "hermes-proxy-upload";
          if (/\\/api\\/hermes-plugins\\/[^/]+\\/proxy\\/api\\/files\\/preview\\/content$/.test(pathname)) return "hermes-proxy-file-preview";
          if (pathname === "/api/generated-images/file") return "generated-image";
          if (pathname === "/api/uploads/file") return "upload";
          if (pathname === "/api/files/preview/content") return "file-preview";
          if (pathname.startsWith("/api/")) return "api";
          return "same-origin";
        } catch (_) {
          return "unknown";
        }
      };
      const addKindCount = (map, key) => {
        const safeKey = String(key || "unknown").replace(/[^a-z0-9_.:-]+/gi, "_").slice(0, 80) || "unknown";
        map[safeKey] = (map[safeKey] || 0) + 1;
      };
      const visible = (node) => {
        if (!node) return false;
        const style = window.getComputedStyle(node);
        if (!style || style.display === "none" || style.visibility === "hidden") return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const app = document.getElementById("app");
      const login = document.getElementById("login");
      const conversation = document.getElementById("conversation");
      const renderRoot = conversation || document;
      const activeButton = document.querySelector("[data-thread].active");
      const turnNodes = Array.from(renderRoot.querySelectorAll("article.turn[data-turn], article.thread-tile-turn[data-thread-tile-turn]"));
      const itemNodes = Array.from(renderRoot.querySelectorAll("[data-item]"));
      const renderKeyNodes = Array.from(renderRoot.querySelectorAll("[data-render-key]"));
      const renderKeys = renderKeyNodes.map((node) => String(node.getAttribute("data-render-key") || ""));
      const itemIds = itemNodes.map((node) => String(node.getAttribute("data-item") || ""));
      const turnHashes = turnNodes.map((node) => stableHash(node.getAttribute("data-turn") || node.getAttribute("data-thread-tile-turn") || ""));
      const expectedMatches = turnHashes.filter((hash) => expectedTurnHashes.has(hash)).length;
      const latestMatches = Boolean(expectedLatestTurnHash && turnHashes.includes(expectedLatestTurnHash));
      const latestTurnIndex = latestMatches ? turnHashes.indexOf(expectedLatestTurnHash) : turnNodes.length - 1;
      const latestTurnNode = latestTurnIndex >= 0 ? turnNodes[latestTurnIndex] : null;
      const latestTurnHash = latestTurnIndex >= 0 ? String(turnHashes[latestTurnIndex] || "") : "";
      const actualLatestTurnNode = turnNodes.length ? turnNodes[turnNodes.length - 1] : null;
      const actualLatestTurnIsReturnReceipt = Boolean(actualLatestTurnNode && actualLatestTurnNode.matches && actualLatestTurnNode.matches("article.turn[data-task-card-return-turn]"));
      const actualLatestUserNodes = actualLatestTurnNode ? Array.from(actualLatestTurnNode.querySelectorAll(".item.userMessage")) : [];
      const actualLatestTaskCardNodes = actualLatestTurnNode ? Array.from(actualLatestTurnNode.querySelectorAll(".item.thread-task-card-injected[data-thread-task-card-item]")) : [];
      const actualLatestAssistantNodes = actualLatestTurnNode ? Array.from(actualLatestTurnNode.querySelectorAll(".item.agentMessage, .item.plan")) : [];
      const timestampExpectedSelector = ".item.userMessage, .item.agentMessage, .item.plan, .item.turnDiagnostic, .item.thread-task-card-injected";
      const timestampExpectedNodes = latestTurnNode ? Array.from(latestTurnNode.querySelectorAll(timestampExpectedSelector)) : [];
      const timestampMissingNodes = timestampExpectedNodes.filter((node) => !node.querySelector(".item-timestamp"));
      const timestampMissingKind = (node) => {
        const className = String(node && node.className || "");
        if (className.includes("thread-task-card-injected")) return "threadTaskCard";
        if (className.includes("userMessage")) return "userMessage";
        if (className.includes("agentMessage")) return "agentMessage";
        if (className.includes("plan")) return "plan";
        if (className.includes("turnDiagnostic")) return "turnDiagnostic";
        return "unknown";
      };
      const countTimestampMissingKinds = (nodes) => {
        const counts = {};
        nodes.forEach((node) => {
          const kind = timestampMissingKind(node);
          counts[kind] = (counts[kind] || 0) + 1;
        });
        return counts;
      };
      const nodeTimestampMs = (node) => {
        if (!node || !node.querySelector) return 0;
        const timestamp = node.querySelector(".item-timestamp");
        const datetime = String(timestamp && timestamp.getAttribute("datetime") || "").trim();
        const parsed = datetime ? Date.parse(datetime) : 0;
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      };
      const timestampRangeForNodes = (nodes) => {
        const values = nodes.map(nodeTimestampMs).filter((value) => Number.isFinite(value) && value > 0);
        return {
          firstTimestampMs: values.length ? Math.min(...values) : 0,
          lastTimestampMs: values.length ? Math.max(...values) : 0,
        };
      };
      const safeStatusKind = (value) => {
        const text = String(value || "").replace(/\\s+/g, " ").trim().toLowerCase();
        if (!text) return "";
        if (text === "refreshing thread" || text === "刷新线程") return "refreshing-thread";
        if (text === "loading thread" || text === "加载线程") return "loading-thread";
        if (/connected|shared|已连接/.test(text)) return "connected";
        if (/starting|启动|加载/.test(text)) return "starting";
        if (/sync|同步/.test(text)) return "sync";
        if (/running|运行/.test(text)) return "running";
        if (/思考|输出|计划/.test(text)) return "live-output";
        return "other";
      };
      const latestUsageCount = latestTurnNode ? latestTurnNode.querySelectorAll(".item.turnUsageSummary").length : 0;
      const latestItemNodes = latestTurnNode ? Array.from(latestTurnNode.querySelectorAll("[data-item]")) : [];
      const latestUserNodes = latestTurnNode ? Array.from(latestTurnNode.querySelectorAll(".item.userMessage")) : [];
      const latestTaskCardNodes = latestTurnNode ? Array.from(latestTurnNode.querySelectorAll(".item.thread-task-card-injected[data-thread-task-card-item]")) : [];
      const latestAssistantNodes = latestTurnNode ? Array.from(latestTurnNode.querySelectorAll(".item.agentMessage, .item.plan")) : [];
      const latestOperationNodes = latestTurnNode ? Array.from(latestTurnNode.querySelectorAll(".item.commandExecution, .item.fileChange, .item.dynamicToolCall, .item.mcpToolCall, .item.collabAgentToolCall")) : [];
      const latestReasoningNodes = latestTurnNode ? Array.from(latestTurnNode.querySelectorAll(".item.reasoning")) : [];
      const latestAssistantTextHashes = latestAssistantNodes
        .map((node) => {
          const body = node.querySelector(".item-body") || node;
          return String(body.textContent || "").replace(/\\s+/g, " ").trim();
        })
        .filter(Boolean)
        .map(stableHash);
      const latestUserTextHashes = latestUserNodes
        .map((node) => {
          const body = node.querySelector(".item-body") || node;
          return String(body.textContent || "").replace(/\\s+/g, " ").trim();
        })
        .filter(Boolean)
        .map(stableHash);
      const allUserEventHashes = Array.from(renderRoot.querySelectorAll(".item.userMessage"))
        .map((node) => {
          const submissionHash = String(node.getAttribute("data-client-submission-hash") || "").trim();
          const body = node.querySelector(".item-body") || node;
          const text = String(body.textContent || "").replace(/\\s+/g, " ").trim();
          const textHash = text ? stableHash(text) : "";
          if (submissionHash && textHash) return "submission-text:" + submissionHash + ":" + textHash;
          if (submissionHash) return "submission:" + submissionHash;
          if (!text) return "";
          const timestamp = node.querySelector(".item-timestamp");
          const datetime = String(timestamp && timestamp.getAttribute("datetime") || "").trim();
          const timestampMs = datetime ? Date.parse(datetime) : 0;
          return Number.isFinite(timestampMs) && timestampMs > 0 ? "text-time:" + Math.floor(timestampMs / 5000) + ":" + stableHash(text) : "";
        })
        .filter(Boolean);
      const latestUserNodeDetails = latestUserNodes.slice(0, 6).map((node, index) => {
        const body = node.querySelector(".item-body") || node;
        const text = String(body.textContent || "").replace(/\\s+/g, " ").trim();
        const className = String(node.className || "");
        return {
          index,
          textHash: stableHash(text),
          dataItemHash: stableHash(node.getAttribute("data-item") || ""),
          renderKeyHash: stableHash(node.getAttribute("data-render-key") || ""),
          clientSubmissionHash: stableHash(node.getAttribute("data-client-submission-hash") || ""),
          hasTimestamp: Boolean(node.querySelector(".item-timestamp")),
          classKind: className.includes("local-pending")
            ? "local-pending"
            : (className.includes("failed") ? "failed" : "durable"),
        };
      });
      const itemNodesForTurn = (turnNode) => Array.from(turnNode.querySelectorAll("[data-item]"))
        .filter((node) => {
          const closestTurn = node.closest("article.turn[data-turn], article.thread-tile-turn[data-thread-tile-turn]");
          return closestTurn === turnNode;
        });
      const domItemKind = (node) => {
        const className = String(node && node.className || "");
        if (className.includes("userMessage")) return "userMessage";
        if (className.includes("agentMessage")) return "agentMessage";
        if (className.includes("plan")) return "plan";
        if (className.includes("turnUsageSummary")) return "turnUsageSummary";
        if (className.includes("reasoning")) return "reasoning";
        if (className.includes("thread-task-card-injected")) return "threadTaskCard";
        if (className.includes("commandExecution")
          || className.includes("fileChange")
          || className.includes("dynamicToolCall")
          || className.includes("mcpToolCall")
          || className.includes("collabAgentToolCall")) return "operation";
        if (className.includes("contextCompaction")) return "contextCompaction";
        if (className.includes("turnDiagnostic")) return "turnDiagnostic";
        return "other";
      };
      const domTurnShapes = turnNodes.slice(-20).map((turnNode, index) => {
        const nodes = itemNodesForTurn(turnNode);
        const timestampRange = timestampRangeForNodes(nodes);
        const usageIndexes = [];
        const userIndexes = [];
        const itemKindSequence = [];
        let assistantLikeSeen = false;
        let userAfterAssistantLikeCount = 0;
        let assistantMessageCount = 0;
        let taskCardUserMessageCount = 0;
        let timestampExpectedItems = 0;
        let timestampMissingItems = 0;
        const timestampMissingKindCounts = {};
        nodes.forEach((node, itemIndex) => {
          const className = String(node.className || "");
          const kind = domItemKind(node);
          itemKindSequence.push(kind);
          if (kind === "userMessage") {
            if (assistantLikeSeen) userAfterAssistantLikeCount += 1;
          } else if (["agentMessage", "plan", "operation", "reasoning", "contextCompaction", "turnUsageSummary"].includes(kind)) {
            assistantLikeSeen = true;
          }
          if (className.includes("turnUsageSummary")) usageIndexes.push(itemIndex);
          if (className.includes("userMessage")) userIndexes.push(itemIndex);
          if (className.includes("thread-task-card-injected")) taskCardUserMessageCount += 1;
          if (className.includes("agentMessage") || className.includes("plan")) assistantMessageCount += 1;
          if (className.includes("userMessage")
            || className.includes("agentMessage")
            || className.includes("plan")
            || className.includes("turnDiagnostic")
            || className.includes("thread-task-card-injected")) {
            timestampExpectedItems += 1;
            if (!node.querySelector(".item-timestamp")) {
              timestampMissingItems += 1;
              const kind = timestampMissingKind(node);
              timestampMissingKindCounts[kind] = (timestampMissingKindCounts[kind] || 0) + 1;
            }
          }
        });
        const lastUsageIndex = usageIndexes.length ? Math.max(...usageIndexes) : -1;
        return {
          index,
          turnHash: stableHash(turnNode.getAttribute("data-turn") || turnNode.getAttribute("data-thread-tile-turn") || ""),
          firstTimestampMs: timestampRange.firstTimestampMs,
          lastTimestampMs: timestampRange.lastTimestampMs,
          itemCount: nodes.length,
          userMessageCount: userIndexes.length,
          taskCardUserMessageCount,
          assistantMessageCount,
          usageCount: usageIndexes.length,
          timestampExpectedItems,
          timestampMissingItems,
          timestampMissingKindCounts,
          userAfterUsageCount: lastUsageIndex >= 0 ? userIndexes.filter((itemIndex) => itemIndex > lastUsageIndex).length : 0,
          userAfterAssistantLikeCount,
          userAtTail: itemKindSequence.length ? itemKindSequence[itemKindSequence.length - 1] === "userMessage" : false,
          itemKindSequence: itemKindSequence.slice(0, 60),
        };
      });
      const imageFigures = Array.from(renderRoot.querySelectorAll(".input-image, .image-view, .markdown-image"));
      const imageNodes = Array.from(renderRoot.querySelectorAll(".input-image img, .image-view img, .markdown-image img"));
      const failedFigures = Array.from(renderRoot.querySelectorAll(".input-image.image-load-failed, .image-view.image-load-failed, .markdown-image.image-load-failed"));
      const brokenCompleteImages = imageNodes.filter((image) => {
        if (!image || image.loading === "lazy" && !image.complete) return false;
        return image.complete && Number(image.naturalWidth || 0) === 0 && Number(image.naturalHeight || 0) === 0;
      });
      const failedImageDetails = [];
      const imageFailureKindCounts = {};
      const collectFailedImage = (figure, reason) => {
        if (!figure || failedImageDetails.length >= 8) return;
        const image = figure.querySelector("img");
        const displayValue = image ? String(image.currentSrc || image.src || image.getAttribute("src") || "") : "";
        const protectedValue = image && image.dataset ? String(image.dataset.protectedImageSrc || "") : "";
        const displaySourceKind = imageSourceKind(displayValue);
        const protectedSourceKind = imageSourceKind(protectedValue);
        addKindCount(imageFailureKindCounts, reason);
        addKindCount(imageFailureKindCounts, displaySourceKind);
        if (protectedSourceKind !== "empty") addKindCount(imageFailureKindCounts, protectedSourceKind);
        failedImageDetails.push({
          reason,
          figureKind: figure.classList && figure.classList.contains("input-image")
            ? "input-image"
            : (figure.classList && figure.classList.contains("image-view")
              ? "image-view"
              : (figure.classList && figure.classList.contains("markdown-image") ? "markdown-image" : "unknown")),
          displaySourceKind,
          protectedSourceKind,
          sourceHash: stableHash([displaySourceKind, protectedSourceKind, displayValue ? displayValue.length : 0].join("|")),
          missingSrc: !displayValue && !protectedValue,
          hasImage: Boolean(image),
          complete: Boolean(image && image.complete),
          naturalWidth: image ? Number(image.naturalWidth || 0) : 0,
          naturalHeight: image ? Number(image.naturalHeight || 0) : 0,
          failedClass: true,
          hydrating: Boolean(image && image.dataset && image.dataset.protectedImageHydrating === "1"),
          hydrated: Boolean(image && image.dataset && image.dataset.protectedImageHydrated === "1"),
          recoveryCount: Number(image && image.dataset && image.dataset.protectedImageRecoveryCount || 0),
          unsafeSourceKind: String(figure.getAttribute("data-image-source-kind") || ""),
        });
      };
      const failedFigureSet = new Set(failedFigures);
      imageFigures.forEach((figure) => {
        if (failedFigureSet.has(figure)) collectFailedImage(figure, "failed-class");
      });
      brokenCompleteImages.forEach((image) => {
        const figure = image && image.closest ? image.closest(".input-image, .image-view, .markdown-image") : null;
        if (figure && !failedFigureSet.has(figure)) collectFailedImage(figure, "broken-complete");
      });
      const longTasks = Array.isArray(window.__codexSelfCheckLongTasks) ? window.__codexSelfCheckLongTasks.slice(-40) : [];
      const longTaskDurations = longTasks.map((entry) => Math.max(0, Math.round(Number(entry && entry.duration || 0))));
      const storageMatchesTarget = (() => {
        try { return localStorage.getItem("codexMobileCurrentThreadId") === threadId; } catch (_) { return false; }
      })();
      const activeButtonMatchesTarget = Boolean(activeButton && activeButton.getAttribute("data-thread") === threadId);
      const loadingNote = Boolean(conversation && conversation.querySelector('[data-render-key^="loading-visible|"]'));
      const emptyState = Boolean(conversation && conversation.querySelector(".empty-state"));
      const connectionState = document.getElementById("connectionState");
      const turnTimer = document.getElementById("turnTimer");
      const turnTimerDetail = turnTimer ? turnTimer.querySelector(".turn-timer-detail") : null;
      const connectionStateKind = safeStatusKind(connectionState && connectionState.textContent);
      const turnTimerDetailKind = safeStatusKind(turnTimerDetail && turnTimerDetail.textContent);
      const threadEntryRefreshBanner = window.__codexSelfCheckThreadEntryRefreshBanner
        && typeof window.__codexSelfCheckThreadEntryRefreshBanner === "object"
        ? window.__codexSelfCheckThreadEntryRefreshBanner
        : {};
      const currentLiveTurnValue = (() => {
        try {
          if (typeof currentLiveTurn === "function") return currentLiveTurn();
          if (typeof window.currentLiveTurn === "function") return window.currentLiveTurn();
        } catch (_) {}
        return null;
      })();
      const currentLiveTurnHash = currentLiveTurnValue && currentLiveTurnValue.id
        ? stableHash(currentLiveTurnValue.id)
        : "";
      const stateActiveTurnHash = (() => {
        try {
          const sourceState = typeof state !== "undefined" ? state : window.state;
          const activeTurnId = sourceState && sourceState.activeTurnId;
          return activeTurnId ? stableHash(activeTurnId) : "";
        } catch (_) {
          return "";
        }
      })();
      const appRect = app ? app.getBoundingClientRect() : { width: 0, height: 0 };
      const conversationRect = conversation ? conversation.getBoundingClientRect() : { top: 0, bottom: 0, height: 0 };
      const visualTop = Math.max(0, conversationRect.top || 0);
      const visualBottom = Math.min(window.innerHeight || 0, conversationRect.bottom || 0);
      const visualCandidates = renderKeyNodes
        .map((node, index) => {
          const rect = node.getBoundingClientRect();
          return {
            node,
            index,
            key: String(node.getAttribute("data-render-key") || ""),
            rect,
          };
        })
        .filter((entry) => entry.key
          && entry.rect
          && entry.rect.width > 0
          && entry.rect.height > 0
          && entry.rect.bottom > visualTop + 4
          && entry.rect.top < visualBottom - 4)
        .sort((a, b) => Math.abs(a.rect.top - visualTop - 8) - Math.abs(b.rect.top - visualTop - 8));
      const visualAnchor = visualCandidates[0] || null;
      const submittedNode = renderRoot.querySelector("[data-client-submission-hash]");
      const submittedRect = submittedNode ? submittedNode.getBoundingClientRect() : { top: 0, height: 0 };
      const submittedKey = submittedNode
        ? String(submittedNode.getAttribute("data-client-submission-hash") || "") + "|" + String(submittedNode.getAttribute("data-render-key") || "")
        : "";
      const bottomThreadTaskCardNodes = latestTurnNode
        ? Array.from(renderRoot.querySelectorAll(".thread-task-card-stack .thread-task-card[data-task-card]"))
          .filter((node) => Boolean(latestTurnNode.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING))
        : [];
      const bottomThreadTaskCardReturnNodes = bottomThreadTaskCardNodes.filter((node) => {
        const method = node.querySelector(".approval-method");
        const text = String(method && method.textContent || "").replace(/\\s+/g, " ").trim();
        return !node.classList.contains("pending") && /^Return:/i.test(text);
      });
      return {
        label,
        threadHash,
        delayMs,
        exerciseSubmit,
        submitPhase,
        submitOk,
        appVisible: visible(app),
        loginVisible: visible(login),
        targetConfirmed: Boolean(storageMatchesTarget || activeButtonMatchesTarget || loadingNote || emptyState),
        contentConfirmed: expectedTurnHashes.size ? Boolean(expectedMatches || latestMatches) : true,
        storageMatchesTarget,
        activeButtonMatchesTarget,
        expectedTurnMatchCount: expectedMatches,
        expectedTurnHashCount: expectedTurnHashes.size,
        latestTurnMatchesTarget: latestMatches,
        expectedLatestTurnHash,
        connectionStateKind,
        pluginRefreshBannerSeededForThreadEntry: threadEntryRefreshBanner.seeded === true,
        pluginRefreshBannerVisibleAfterThreadEntry: threadEntryRefreshBanner.visibleAfterOpen === true,
        turnTimerVisible: Boolean(turnTimer && turnTimer.classList && turnTimer.classList.contains("visible")),
        turnTimerActive: Boolean(turnTimer && turnTimer.classList && turnTimer.classList.contains("active")),
        turnTimerSettled: Boolean(turnTimer && turnTimer.classList && turnTimer.classList.contains("settled")),
        turnTimerDetailKind,
        currentLiveTurnHash,
        stateActiveTurnHash,
        currentLiveTurnMatchesExpectedLatest: Boolean(currentLiveTurnHash && expectedLatestTurnHash && currentLiveTurnHash === expectedLatestTurnHash),
        stateActiveTurnMatchesExpectedLatest: Boolean(stateActiveTurnHash && expectedLatestTurnHash && stateActiveTurnHash === expectedLatestTurnHash),
        expectedLatestUsageRequired,
        expectedLatestItemCount,
        expectedLatestUserMessageCount,
        expectedLatestAssistantMessageCount,
        expectedLatestUserMessageDuplicateCount,
        expectedLatestTaskCardUserMessageCount,
        expectedReadMode,
        expectedReadDecision,
        expectedPerformancePhase,
        returnLedgerCount,
        returnLedgerVisibleCount,
        returnLedgerProjectionFailedCount,
        returnLedgerDeliveryFailedCount,
        returnLedgerIssueCodes,
        returnReceiptVisibleCount: document.querySelectorAll("[data-task-card-return-receipt]").length,
        returnReceiptTurnVisibleCount: document.querySelectorAll("article.turn[data-task-card-return-turn] [data-task-card-return-receipt]").length,
        returnReceiptTurnAtDomBottom: actualLatestTurnIsReturnReceipt,
        returnFollowUpBadgeVisibleCount: document.querySelectorAll(".thread-card-return-badge.follow-up").length,
        dynamicThreadPlan,
        expectedTurnShapes,
        domTurnShapes,
        latestTurnHash,
        latestTurnDomIndex: latestTurnIndex,
        latestTurnAtDomBottom: Boolean(latestMatches && latestTurnIndex === turnNodes.length - 1),
        latestTurnItemCount: latestItemNodes.length,
        latestTurnUserMessageCount: latestUserNodes.length,
        latestTurnTaskCardItemCount: latestTaskCardNodes.length,
        latestTurnAssistantMessageCount: latestAssistantNodes.length,
        actualLatestTurnHash: turnHashes.length ? String(turnHashes[turnHashes.length - 1] || "") : "",
        actualLatestTurnUserMessageCount: actualLatestUserNodes.length,
        actualLatestTurnTaskCardItemCount: actualLatestTaskCardNodes.length,
        actualLatestTurnAssistantMessageCount: actualLatestAssistantNodes.length,
        latestTurnOperationItemCount: latestOperationNodes.length,
        latestTurnReasoningItemCount: latestReasoningNodes.length,
        latestTurnUserTextDuplicateCount: duplicateCount(latestUserTextHashes),
        allUserEventDuplicateCount: duplicateCount(allUserEventHashes),
        latestTurnUserNodeDetails: latestUserNodeDetails,
        latestTurnAssistantTextDuplicateCount: duplicateCount(latestAssistantTextHashes),
        latestTurnUsageCount: latestUsageCount,
        bottomThreadTaskCardCount: bottomThreadTaskCardNodes.length,
        bottomThreadTaskCardReturnCount: bottomThreadTaskCardReturnNodes.length,
        latestTimestampExpectedItems: timestampExpectedNodes.length,
        latestTimestampMissingItems: timestampMissingNodes.length,
        latestTimestampMissingKindCounts: countTimestampMissingKinds(timestampMissingNodes),
        imageCount: imageNodes.length,
        imageFigureCount: imageFigures.length,
        imageFailedFigureCount: failedFigures.length,
        brokenCompleteImageCount: brokenCompleteImages.length,
        imageFailureCount: failedFigures.length + brokenCompleteImages.length,
        imageFailureKindCounts,
        imageFailureDetails: failedImageDetails,
        longTaskCount: longTaskDurations.length,
        longTaskMaxDurationMs: longTaskDurations.length ? Math.max(...longTaskDurations) : 0,
        longTaskTotalDurationMs: longTaskDurations.reduce((total, value) => total + value, 0),
        threadCards: document.querySelectorAll("[data-thread]").length,
        turns: turnNodes.length,
        items: itemNodes.length,
        renderKeys: renderKeys.filter(Boolean).length,
        duplicateRenderKeys: duplicateCount(renderKeys),
        duplicateItemIds: duplicateCount(itemIds),
        loadingNote,
        emptyState,
        clientSubmissionCount: document.querySelectorAll("[data-client-submission-id], [data-client-submission], [data-client-submission-hash]").length,
        visualAnchorKeyHash: visualAnchor ? stableHash(visualAnchor.key) : "",
        visualFrameHash: stableHash(renderKeys.filter(Boolean).join("|")),
        visualAnchorTopPx: visualAnchor ? Math.round(visualAnchor.rect.top || 0) : 0,
        visualAnchorHeightPx: visualAnchor ? Math.round(visualAnchor.rect.height || 0) : 0,
        visualAnchorIndex: visualAnchor ? visualAnchor.index : -1,
        conversationTopPx: Math.round(conversationRect.top || 0),
        conversationHeightPx: Math.round(conversationRect.height || 0),
        submittedMessageKeyHash: submittedKey ? stableHash(submittedKey) : "",
        submittedMessageTopPx: submittedNode ? Math.round(submittedRect.top || 0) : 0,
        submittedMessageHeightPx: submittedNode ? Math.round(submittedRect.height || 0) : 0,
        scrollHeight: conversation ? Math.trunc(conversation.scrollHeight || 0) : 0,
        clientHeight: conversation ? Math.trunc(conversation.clientHeight || 0) : 0,
        scrollTop: conversation ? Math.trunc(conversation.scrollTop || 0) : 0,
        appHeight: Math.trunc(appRect.height || 0),
      };
    })();
  `;
}

function submitComposerExpression(message) {
  return `
    (async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const input = document.getElementById("messageInput");
      const form = document.getElementById("composer");
      const button = document.getElementById("sendMessage");
      if (!input || !form || !button) return { ok: false, code: "composer_unavailable" };
      if (input.getAttribute("contenteditable") === "false" || input.getAttribute("aria-disabled") === "true") {
        return { ok: false, code: "composer_disabled" };
      }
      const message = ${JSON.stringify(String(message || "").slice(0, 500))};
      input.focus({ preventScroll: true });
      input.textContent = message;
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: message }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(80);
      const disabledBeforeSubmit = Boolean(button.disabled);
      if (typeof form.requestSubmit === "function") form.requestSubmit(button);
      else form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      return {
        ok: true,
        code: "submitted",
        disabledBeforeSubmit,
      };
    })();
  `;
}

function threadRefreshStatusHintProbeExpression() {
  return `
    (async () => {
      try {
        const probe = typeof window.threadRefreshStatusHintSelfCheck === "function"
          ? window.threadRefreshStatusHintSelfCheck
          : null;
        if (!probe) {
          return {
            label: "thread-refresh-status-hint",
            probeKind: "thread-refresh-status-hint",
            ok: false,
            skipped: false,
            errorCode: "thread_refresh_status_hint_probe_unavailable",
            threadHash: "",
          };
        }
        const runProbe = () => Object.assign({
          label: "thread-refresh-status-hint",
          probeKind: "thread-refresh-status-hint",
          ok: false,
          skipped: false,
          errorCode: "",
          threadHash: "",
          iconKind: "",
          iconPresent: false,
          hinted: false,
        }, probe() || {});
        let result = runProbe();
        if (result && result.errorCode === "missing_thread_id" && typeof window.loadThreads === "function") {
          try {
            await window.loadThreads({ silent: true, allowDuringDetail: true, allowHidden: true });
            await new Promise((resolve) => setTimeout(resolve, 120));
            result = runProbe();
          } catch (_) {}
        }
        for (let index = 0; result && result.errorCode === "detail_request_already_in_flight" && index < 6; index += 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          result = runProbe();
        }
        if (result && result.errorCode === "missing_thread_id") {
          result.ok = true;
          result.skipped = true;
        }
        return Object.assign({
          label: "thread-refresh-status-hint",
          probeKind: "thread-refresh-status-hint",
          ok: false,
          skipped: false,
          errorCode: "",
          threadHash: "",
          iconKind: "",
          iconPresent: false,
          hinted: false,
        }, result && typeof result === "object" ? result : {});
      } catch (err) {
        return {
          label: "thread-refresh-status-hint",
          probeKind: "thread-refresh-status-hint",
          ok: false,
          skipped: false,
          errorCode: String(err && err.message || "thread_refresh_status_hint_probe_failed").slice(0, 160),
          threadHash: "",
        };
      }
    })();
  `;
}

function appendBrowserIssue(report, item) {
  if (!report || !report.browserReport || !item) return;
  const issues = Array.isArray(report.browserReport.issues) ? report.browserReport.issues : [];
  issues.push(item);
  report.browserReport.issues = issues;
  report.browserReport.issueCount = issues.length;
  report.browserReport.blockingIssueCount = issues.filter((issueItem) => issueItem && /^(H1|H2)$/i.test(issueItem.severity || "")).length;
  report.browserReport.ok = report.browserReport.blockingIssueCount === 0;
}

function applyThreadRefreshStatusHintGateIssue(report) {
  const sample = report && report.threadRefreshStatusHint;
  if (!sample || sample.skipped === true || sample.ok === true) return;
  appendBrowserIssue(report, {
    severity: "H2",
    code: "browser_thread_refresh_status_hint_dropped",
    surface: "browser-runtime",
    threadHash: String(sample.threadHash || "").slice(0, 32),
    iconKind: String(sample.iconKind || "").slice(0, 40),
    iconPresent: sample.iconPresent === true,
    hinted: sample.hinted === true,
    reason: boundedToken(sample.errorCode, "thread_refresh_status_hint_failed"),
  });
}

function applyStartupGateIssues(report, startupSample = {}, staticShell = {}) {
  if (staticShell && staticShell.ok === false) {
    appendBrowserIssue(report, {
      severity: "H2",
      code: "browser_static_shell_readback_failed",
      surface: "browser-runtime",
      assetStatusOk: staticShell.assetStatusOk === true,
      clientBuildMatches: staticShell.clientBuildMatches === true,
      shellCacheMatches: staticShell.shellCacheMatches === true,
      runtimeAssetCount: Math.max(0, Math.trunc(Number(staticShell.runtimeAssetCount || 0))),
    });
  }
  if (startupSample && startupSample.clientBuildMatches === false) {
    appendBrowserIssue(report, {
      severity: "H2",
      code: "browser_startup_client_build_mismatch",
      surface: "browser-runtime",
    });
  }
  for (const issue of clientVersionSwitchIssueDescriptors(startupSample)) {
    appendBrowserIssue(report, {
      surface: "browser-runtime",
      ...issue,
    });
  }
  if (startupSample && hasClientVersionSwitchProbe(startupSample) && !clientVersionSwitchConfirmed(startupSample)) {
    appendBrowserIssue(report, {
      severity: "H2",
      code: "client_version_switch_not_confirmed",
      surface: "browser-runtime",
      statusIdentityPresent: startupSample.updateStatusCurrentBuildIdentityPresent === true,
      statusClientBuildMatches: startupSample.updateStatusCurrentClientBuildMatches === true,
      statusShellCacheMatches: startupSample.updateStatusCurrentShellCacheMatches === true,
      fullVersionPresent: startupSample.updateFullClientVersionPresent === true,
      fullVersionMatches: startupSample.updateFullClientVersionMatches === true,
      fullVersionUsesClassicCache: startupSample.updateFullClientVersionUsesClassicCache === true,
      runtimeUsesClassicCache: startupSample.runtimeClientBuildUsesClassicCache === true,
      refreshBannerStuck: startupSample.pluginRefreshBannerVisibleAfterBuildSettled === true,
      reason: boundedToken(startupSample.updateFullClientVersionErrorCode, ""),
    });
  }
  const runtimeReady = startupSample
    && startupSample.composerRuntimeReady === true
    && startupSample.threadListRuntimeReady === true
    && startupSample.threadTileRuntimeReady === true;
  if (startupSample && runtimeReady === false) {
    appendBrowserIssue(report, {
      severity: "H2",
      code: "browser_startup_runtime_missing",
      surface: "browser-runtime",
      composerRuntimeReady: startupSample.composerRuntimeReady === true,
      threadListRuntimeReady: startupSample.threadListRuntimeReady === true,
      threadTileRuntimeReady: startupSample.threadTileRuntimeReady === true,
    });
  }
  if (startupSample && startupSample.bootRecoveryVisible === true) {
    appendBrowserIssue(report, {
      severity: "H2",
      code: "browser_startup_boot_recovery_visible",
      surface: "browser-runtime",
    });
  }
  if (startupSample && startupSample.shellRefreshContractReady === false) {
    appendBrowserIssue(report, {
      severity: "H2",
      code: "browser_startup_shell_refresh_contract_missing",
      surface: "browser-runtime",
      hardRefreshPresent: startupSample.shellRefreshHardRefreshPresent === true,
      refreshPromptPresent: startupSample.shellRefreshPromptPresent === true,
      refreshPageReady: startupSample.shellRefreshRefreshPageReady === true,
      clearCachesReady: startupSample.shellRefreshClearCachesReady === true,
      resetServiceWorkerReady: startupSample.shellRefreshResetServiceWorkerReady === true,
      serviceWorkerCapable: startupSample.shellRefreshServiceWorkerCapable === true,
      cachesCapable: startupSample.shellRefreshCachesCapable === true,
    });
  }
}

async function run(options = parseArgs(), deps = {}) {
  const key = deps.key !== undefined ? deps.key : readAccessKey(options);
  const appPreviewLaunchSession = options.viteAppPreviewLaunchSession === true;
  const appPreviewDefaultRoot = options.viteAppPreviewDefaultRoot === true && !appPreviewLaunchSession;
  const appPreviewRoot = (options.viteAppPreviewRoot === true || appPreviewDefaultRoot) && !appPreviewLaunchSession;
  const appPreviewOptInRoot = appPreviewRoot && !appPreviewDefaultRoot;
  const appPreviewOnly = options.viteAppPreviewOnly === true || appPreviewLaunchSession;
  const appPreviewRuntime = options.viteAppPreviewRuntime === true && !appPreviewOnly;
  const appPreviewEmbed = (options.viteAppPreviewEmbed === true || appPreviewLaunchSession) && (appPreviewOnly || appPreviewRuntime);
  const browserOnly = options.startupOnly || options.vitePreviewOnly || appPreviewOnly;
  const submitAllowed = !browserOnly && !appPreviewRuntime && options.exerciseSubmit === true;
  const startedAt = new Date().toISOString();
  const config = await fetchJson(requestUrl(options, "/api/public-config"), options, key);
  const staticShell = await readStaticShellReadback(options, config);
  const list = browserOnly
    ? { data: [] }
    : await fetchJson(requestUrl(options, "/api/threads", { limit: options.listLimit }), options, key);
  const rows = threadRows(list);
  const ids = options.threadIds.length
    ? options.threadIds
    : selectThreadIdsForSampling(rows, options.sampleThreads);
  if (submitAllowed && options.submitThreadId && !ids.includes(options.submitThreadId)) {
    ids.unshift(options.submitThreadId);
  }
  const threadPlan = browserOnly ? [] : await loadThreadPlan(options, key, ids);
  const report = {
    ok: false,
    startedAt,
    mode: appPreviewOnly
      ? (appPreviewLaunchSession ? "vite-app-preview-launch-session" : appPreviewEmbed ? "vite-app-preview-embed" : appPreviewDefaultRoot ? "vite-app-preview-default-root" : appPreviewRoot ? "vite-app-preview-root" : "vite-app-preview")
      : appPreviewRuntime
        ? (appPreviewEmbed ? "vite-app-preview-embed-runtime" : appPreviewDefaultRoot ? "vite-app-preview-default-root-runtime" : appPreviewRoot ? "vite-app-preview-root-runtime" : "vite-app-preview-runtime")
        : options.vitePreviewOnly ? "vite-preview" : options.startupOnly ? "startup-only" : "full",
    endpoint: endpointKind(options.server),
    browser: { engine: "chrome-cdp", headed: Boolean(options.headed), viewport: options.viewport },
    publicConfig: {
      version: String(config && config.version || "").slice(0, 40),
      clientBuildId: String(config && config.clientBuildId || "").slice(0, 120),
      shellCacheName: String(config && config.shellCacheName || "").slice(0, 120),
      classicShellCacheName: String(config && config.classicShellCacheName || "").slice(0, 120),
      defaultShellMode: String(config && config.defaultShellMode || "").slice(0, 40),
      authRequired: config && config.authRequired === true,
    },
    selectedThreads: safeThreadRows(ids.map((id) => ({ id })), options.sampleThreads),
    listedThreads: safeThreadRows(rows, Math.min(options.listLimit, 8)),
    staticShell,
    threadPlan: threadPlan.map((entry) => ({
      threadHash: entry.threadHash,
      expectedTurnHashCount: entry.expectedTurnHashCount,
      expectedLatestTurnHash: entry.expectedLatestTurnHash,
      expectedLatestUsageRequired: Boolean(entry.expectedLatestUsageRequired),
      expectedLatestItemCount: entry.expectedLatestItemCount,
      expectedLatestUserMessageCount: entry.expectedLatestUserMessageCount,
      expectedLatestAssistantMessageCount: entry.expectedLatestAssistantMessageCount,
      expectedLatestUserMessageDuplicateCount: entry.expectedLatestUserMessageDuplicateCount,
      expectedLatestTaskCardUserMessageCount: entry.expectedLatestTaskCardUserMessageCount,
      expectedLatestOperationItemCount: entry.expectedLatestOperationItemCount,
      expectedLatestReasoningItemCount: entry.expectedLatestReasoningItemCount,
      expectedLatestTimestampItemCount: entry.expectedLatestTimestampItemCount,
      returnLedgerCount: entry.returnLedgerCount,
      returnLedgerVisibleCount: entry.returnLedgerVisibleCount,
      returnLedgerProjectionFailedCount: entry.returnLedgerProjectionFailedCount,
      returnLedgerDeliveryFailedCount: entry.returnLedgerDeliveryFailedCount,
      returnLedgerIssueCodes: Array.isArray(entry.returnLedgerIssueCodes) ? entry.returnLedgerIssueCodes.slice(0, 8) : [],
      returnReceiptVisibleCount: entry.returnReceiptVisibleCount,
      returnReceiptTurnVisibleCount: entry.returnReceiptTurnVisibleCount,
      returnReceiptTurnAtDomBottom: entry.returnReceiptTurnAtDomBottom === true,
      returnFollowUpTaskCardCount: entry.returnFollowUpTaskCardCount,
      returnFollowUpBadgeVisibleCount: entry.returnFollowUpBadgeVisibleCount,
    })),
    browserReport: null,
    vitePreview: null,
    viteAppPreview: null,
    viteAppPreviewLaunch: null,
    viteAppPreviewReport: null,
    threadRefreshStatusHint: null,
    submitExercise: submitAllowed ? {
      attempted: true,
      ok: false,
      targetThreadHash: "",
      messageHash: shortHash(options.submitMessage),
      requestedCount: options.submitRepeat,
      successCount: 0,
      code: "not_run",
    } : null,
  };
  if (!browserOnly && !threadPlan.length) {
    report.browserReport = analyzeBrowserRuntimeSamples({ samples: [] });
    report.error = "no_threads_selected";
    return report;
  }

  const networkEvents = [];
  const consoleEvents = [];
  const exceptions = [];
  const samples = [];
  let appPreviewLaunch = { evidence: null, url: "" };
  if (appPreviewLaunchSession) {
    appPreviewLaunch = await createHermesAppPreviewLaunch(options, key);
    report.viteAppPreviewLaunch = appPreviewLaunch.evidence;
  }
  let chrome = null;
  let cdp = null;
  try {
    chrome = await launchChrome(options);
    cdp = new CdpClient(chrome.webSocketUrl);
    await cdp.connect(options.timeoutMs);
    const requestStarts = new Map();
    cdp.onEvent((message) => {
      if (!message || !message.method) return;
      if (message.method === "Network.requestWillBeSent") {
        const params = message.params || {};
        requestStarts.set(params.requestId, {
          route: routeKind(params.request && params.request.url),
          timestamp: Number(params.timestamp || 0),
        });
      } else if (message.method === "Network.responseReceived") {
        const params = message.params || {};
        const started = requestStarts.get(params.requestId) || {};
        const response = params.response || {};
        const route = started.route || routeKind(response.url);
        if (route === "other" || route === "static_js" || route === "static_css") return;
        const elapsedMs = started.timestamp && params.timestamp
          ? Math.max(0, Math.round((Number(params.timestamp) - Number(started.timestamp)) * 1000))
          : 0;
        networkEvents.push({
          route,
          status: Math.max(0, Math.trunc(Number(response.status || 0))),
          elapsedMs,
        });
      } else if (message.method === "Runtime.consoleAPICalled") {
        const params = message.params || {};
        const type = String(params.type || "");
        if (type === "error" || type === "warning") {
          const firstArg = Array.isArray(params.args) && params.args[0] ? params.args[0] : {};
          consoleEvents.push({
            type,
            code: safeConsoleText(firstArg.value || firstArg.description || type),
          });
        }
      } else if (message.method === "Runtime.exceptionThrown") {
        exceptions.push(boundedException(message.params && message.params.exceptionDetails || {}));
      }
    });
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: options.viewport.width,
      height: options.viewport.height,
      deviceScaleFactor: 2,
      mobile: options.viewport.width <= 600,
    });
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: browserInitScript(key, threadPlan[0] && threadPlan[0].id || ""),
    });
    const appPreviewParams = Object.assign(
      appPreviewOptInRoot ? { codexViteShell: "app-preview" } : {},
      appPreviewEmbed ? { embed: "hermes" } : {},
    );
    const navigateUrl = appPreviewLaunchSession && appPreviewLaunch.url
      ? appPreviewLaunch.url
      : (appPreviewOnly || appPreviewRuntime)
        ? requestUrl(options, appPreviewRoot ? "/" : "/vite-shell/app-preview.html", appPreviewParams)
      : options.vitePreviewOnly ? requestUrl(options, "/vite-shell/preview.html") : options.server;
    await cdp.send("Page.navigate", { url: navigateUrl });
    await waitForLoad(cdp, options.timeoutMs);
    await sleep(900);
    if (options.vitePreviewOnly) {
      report.vitePreview = await evaluate(cdp, vitePreviewProbeExpression(report.publicConfig), options.timeoutMs).catch((err) => ({
        label: "vite-preview",
        probeKind: "vite-preview",
        markerVisible: false,
        errorCode: boundedToken(err && err.message, "vite_preview_probe_failed"),
      }));
      samples.push(report.vitePreview);
    }
    if (appPreviewOnly || appPreviewRuntime) {
      report.viteAppPreview = await evaluate(cdp, viteAppPreviewProbeExpression({
        ...report.publicConfig,
        expectEmbed: appPreviewEmbed,
        expectPluginSession: appPreviewLaunchSession,
        expectRoot: appPreviewRoot,
        expectDefaultRoot: appPreviewDefaultRoot,
      }), options.timeoutMs).catch((err) => ({
        label: "vite-app-preview",
        probeKind: "vite-app-preview",
        markerPresent: false,
        metaPresent: false,
        embedExpected: appPreviewEmbed,
        rootPreviewExpected: appPreviewRoot,
        defaultRootPreviewExpected: appPreviewDefaultRoot,
        loaderOk: false,
        errorCode: boundedToken(err && err.message, "vite_app_preview_probe_failed"),
      }));
      if (appPreviewOnly) samples.push(report.viteAppPreview);
    }
    const shouldRunStartupProbe = !options.vitePreviewOnly && (!appPreviewOnly || options.startupOnly);
    const startupSample = !shouldRunStartupProbe ? null : await evaluate(cdp, startupProbeExpression(report.publicConfig), options.timeoutMs).catch((err) => ({
      label: "startup",
      probeKind: "startup",
      appVisible: false,
      targetConfirmed: true,
      contentConfirmed: true,
      turns: 0,
      items: 0,
      renderKeys: 0,
      errorCode: boundedToken(err && err.message, "startup_probe_failed"),
    }));
    if (startupSample) samples.push(startupSample);
    if (!options.vitePreviewOnly && !appPreviewOnly) {
      const refreshStatusHintSample = await evaluate(cdp, threadRefreshStatusHintProbeExpression(), options.timeoutMs).catch((err) => ({
        label: "thread-refresh-status-hint",
        probeKind: "thread-refresh-status-hint",
        ok: false,
        skipped: false,
        errorCode: boundedToken(err && err.message, "thread_refresh_status_hint_probe_failed"),
        threadHash: "",
      }));
      report.threadRefreshStatusHint = {
        ok: refreshStatusHintSample && refreshStatusHintSample.ok === true,
        skipped: refreshStatusHintSample && refreshStatusHintSample.skipped === true,
        threadHash: String(refreshStatusHintSample && refreshStatusHintSample.threadHash || "").slice(0, 32),
        iconKind: String(refreshStatusHintSample && refreshStatusHintSample.iconKind || "").slice(0, 40),
        iconPresent: refreshStatusHintSample && refreshStatusHintSample.iconPresent === true,
        hinted: refreshStatusHintSample && refreshStatusHintSample.hinted === true,
        errorCode: boundedToken(refreshStatusHintSample && refreshStatusHintSample.errorCode, ""),
      };
    }
    if (options.startupOnly) {
      report.startup = {
        appVisible: startupSample.appVisible === true,
        loginVisible: startupSample.loginVisible === true,
        clientBuildMatches: startupSample.clientBuildMatches === true,
        runtimeReady: startupSample.composerRuntimeReady === true
          && startupSample.threadListRuntimeReady === true
          && startupSample.threadTileRuntimeReady === true,
        loadThreadReady: startupSample.loadThreadReady === true,
        shellRefreshReady: startupSample.shellRefreshContractReady === true,
        settingsPanelVisualReadyOnMobile: startupSample.settingsPanelVisualReadyOnMobile === true,
        settingsRmwPanelReachableOnMobile: startupSample.settingsRmwPanelReachableOnMobile === true,
        settingsPanelVisibleHeight: Math.max(0, Math.trunc(Number(startupSample.settingsPanelVisibleHeight || 0))),
        settingsPanelVisibleWidth: Math.max(0, Math.trunc(Number(startupSample.settingsPanelVisibleWidth || 0))),
        settingsPanelLeft: Math.trunc(Number(startupSample.settingsPanelLeft || 0)),
        settingsPanelRight: Math.trunc(Number(startupSample.settingsPanelRight || 0)),
        settingsPanelClientHeight: Math.max(0, Math.trunc(Number(startupSample.settingsPanelClientHeight || 0))),
        settingsPanelScrollHeight: Math.max(0, Math.trunc(Number(startupSample.settingsPanelScrollHeight || 0))),
        settingsInitialVisibleTitleCount: Math.max(0, Math.trunc(Number(startupSample.settingsInitialVisibleTitleCount || 0))),
        settingsPrimarySiblingVisibleCount: Math.max(0, Math.trunc(Number(startupSample.settingsPrimarySiblingVisibleCount || 0))),
        settingsRmwReachableFieldCount: Math.max(0, Math.trunc(Number(startupSample.settingsRmwReachableFieldCount || 0))),
        settingsRmwReachableActionCount: Math.max(0, Math.trunc(Number(startupSample.settingsRmwReachableActionCount || 0))),
        settingsRmwWorkspaceRowCount: Math.max(0, Math.trunc(Number(startupSample.settingsRmwWorkspaceRowCount || 0))),
        settingsRmwReachableWorkspaceRowCount: Math.max(0, Math.trunc(Number(startupSample.settingsRmwReachableWorkspaceRowCount || 0))),
      };
    }
    if (!browserOnly) {
      samples.push(await evaluate(cdp, threadListInteractionProbeExpression("thread-list-initial"), options.timeoutMs).catch((err) => ({
        label: "thread-list-initial",
        probeKind: "thread-list-interaction",
        appVisible: false,
        targetConfirmed: true,
        contentConfirmed: true,
        errorCode: boundedToken(err && err.message, "thread_list_probe_failed"),
      })));
      if (options.threadListStressRounds > 0) {
        samples.push(await evaluate(cdp, threadListStressProbeExpression("thread-list-stress", options.threadListStressRounds), options.timeoutMs).catch((err) => ({
          label: "thread-list-stress",
          probeKind: "thread-list-interaction",
          stressProbe: true,
          appVisible: false,
          targetConfirmed: true,
          contentConfirmed: true,
          errorCode: boundedToken(err && err.message, "thread_list_stress_probe_failed"),
        })));
        await sleep(Math.min(1500, Math.max(900, options.minSettledDelayMs)));
      }

      for (let round = 0; round < options.rounds; round += 1) {
        for (const entry of threadPlan) {
          await evaluate(cdp, openThreadExpression(entry.id, report.publicConfig), options.timeoutMs).catch(() => null);
          let snapshotPlan = await refreshThreadPlanEntry(options, key, entry);
          for (const delayMs of options.sampleDelaysMs) {
            await sleep(delayMs);
            if (delayMs >= options.minSettledDelayMs) {
              snapshotPlan = await refreshThreadPlanEntry(options, key, snapshotPlan);
            }
            const sample = await evaluate(cdp, snapshotExpression(snapshotInputForPlanEntry(snapshotPlan, {
              label: `round-${round + 1}-delay-${delayMs}`,
              delayMs,
            })), options.timeoutMs).catch((err) => ({
              label: `round-${round + 1}-delay-${delayMs}`,
              threadHash: entry.threadHash,
              delayMs,
              appVisible: false,
              errorCode: boundedToken(err && err.message, "snapshot_failed"),
            }));
            samples.push(sample);
          }
        }
        samples.push(await evaluate(cdp, threadListInteractionProbeExpression(`thread-list-round-${round + 1}`), options.timeoutMs).catch((err) => ({
          label: `thread-list-round-${round + 1}`,
          probeKind: "thread-list-interaction",
          appVisible: false,
          targetConfirmed: true,
          contentConfirmed: true,
          errorCode: boundedToken(err && err.message, "thread_list_probe_failed"),
        })));
      }
    }

    if (submitAllowed) {
      const submitTarget = (options.submitThreadId
        ? threadPlan.find((entry) => entry.id === options.submitThreadId)
        : null) || threadPlan[0];
      if (submitTarget) {
        report.submitExercise.targetThreadHash = submitTarget.threadHash;
        await evaluate(cdp, openThreadExpression(submitTarget.id, report.publicConfig), options.timeoutMs).catch(() => null);
        await sleep(500);
        const submitPrePlan = await refreshThreadPlanEntry(options, key, submitTarget);
        samples.push(await evaluate(cdp, snapshotExpression(snapshotInputForPlanEntry(submitPrePlan, {
          label: "submit-pre",
          delayMs: 0,
          exerciseSubmit: true,
          submitPhase: "pre",
          submitOk: false,
        })), options.timeoutMs).catch((err) => ({
          label: "submit-pre",
          threadHash: submitTarget.threadHash,
          delayMs: 0,
          exerciseSubmit: true,
          submitPhase: "pre",
          submitOk: false,
          appVisible: false,
          errorCode: boundedToken(err && err.message, "snapshot_failed"),
        })));
        const submitResults = [];
        for (let submitIndex = 0; submitIndex < options.submitRepeat; submitIndex += 1) {
          const submitMessage = options.submitRepeat > 1
            ? `${options.submitMessage} [${submitIndex + 1}/${options.submitRepeat}]`.slice(0, 500)
            : options.submitMessage;
          const submitResult = await evaluate(cdp, submitComposerExpression(submitMessage), options.timeoutMs).catch((err) => ({
            ok: false,
            code: boundedToken(err && err.message, "submit_failed"),
          }));
          submitResults.push(submitResult);
          const attemptPhase = `after-${submitIndex + 1}`;
          const submitAttemptPlan = await refreshThreadPlanEntry(options, key, submitTarget);
          samples.push(await evaluate(cdp, snapshotExpression(snapshotInputForPlanEntry(submitAttemptPlan, {
            label: `submit-${attemptPhase}`,
            delayMs: 0,
            exerciseSubmit: true,
            submitPhase: attemptPhase,
            submitOk: Boolean(submitResult && submitResult.ok),
          })), options.timeoutMs).catch((err) => ({
            label: `submit-${attemptPhase}`,
            threadHash: submitTarget.threadHash,
            delayMs: 0,
            exerciseSubmit: true,
            submitPhase: attemptPhase,
            submitOk: Boolean(submitResult && submitResult.ok),
            appVisible: false,
            errorCode: boundedToken(err && err.message, "snapshot_failed"),
          })));
          if (submitIndex + 1 < options.submitRepeat && options.submitIntervalMs > 0) {
            await sleep(options.submitIntervalMs);
          }
        }
        report.submitExercise.successCount = submitResults.filter((entry) => entry && entry.ok).length;
        report.submitExercise.ok = report.submitExercise.successCount === options.submitRepeat;
        report.submitExercise.code = report.submitExercise.ok
          ? "submitted"
          : boundedToken(submitResults.find((entry) => entry && !entry.ok) && submitResults.find((entry) => entry && !entry.ok).code, "submit_failed");
        report.submitExercise.disabledBeforeSubmit = submitResults.some((entry) => entry && entry.disabledBeforeSubmit);
        for (const delayMs of options.submitSampleDelaysMs) {
          await sleep(delayMs);
          const phase = `post-${delayMs}`;
          const submitPostPlan = await refreshThreadPlanEntry(options, key, submitTarget);
          samples.push(await evaluate(cdp, snapshotExpression(snapshotInputForPlanEntry(submitPostPlan, {
            label: `submit-${phase}`,
            delayMs,
            exerciseSubmit: true,
            submitPhase: phase,
            submitOk: report.submitExercise.ok,
          })), options.timeoutMs).catch((err) => ({
            label: `submit-${phase}`,
            threadHash: submitTarget.threadHash,
            delayMs,
            exerciseSubmit: true,
            submitPhase: phase,
            submitOk: report.submitExercise.ok,
            appVisible: false,
            errorCode: boundedToken(err && err.message, "snapshot_failed"),
          })));
        }
      }
    }
  } finally {
    if (cdp) cdp.close();
    if (chrome) await chrome.close();
  }

  if (options.vitePreviewOnly) {
    report.browserReport = analyzeVitePreviewProbe(report.vitePreview, {
      consoleEvents,
      exceptions,
    });
    report.ok = report.browserReport.ok;
    return report;
  }
  if (appPreviewOnly) {
    report.browserReport = analyzeViteAppPreviewProbe(report.viteAppPreview, {
      consoleEvents,
      exceptions,
    }, {
      expectEmbed: appPreviewEmbed,
      expectPluginSession: appPreviewLaunchSession,
      expectRoot: appPreviewRoot,
      expectDefaultRoot: appPreviewDefaultRoot,
    });
    if (appPreviewLaunchSession && (!report.viteAppPreviewLaunch || report.viteAppPreviewLaunch.ok !== true)) {
      const issues = Array.isArray(report.browserReport.issues) ? report.browserReport.issues : [];
      issues.push({
        severity: "H2",
        code: "vite_app_preview_plugin_launch_create_failed",
        surface: "browser-runtime",
        errorCode: report.viteAppPreviewLaunch && report.viteAppPreviewLaunch.errorCode || "",
      });
      report.browserReport.issues = issues;
      report.browserReport.issueCount = issues.length;
      report.browserReport.blockingIssueCount = issues.filter((item) => item && /^(H1|H2)$/i.test(item.severity || "")).length;
      report.browserReport.ok = report.browserReport.blockingIssueCount === 0;
    }
    report.ok = report.browserReport.ok;
    return report;
  }

  report.browserReport = analyzeBrowserRuntimeSamples({
    samples,
    networkEvents,
    consoleEvents,
    exceptions,
    minSettledDelayMs: options.minSettledDelayMs,
  });
  if (options.diagnosticSamples) {
    report.browserDiagnostics = {
      sampleCount: samples.length,
      samples: boundedDiagnosticSamples(samples),
    };
  }
  applyStartupGateIssues(report, samples.find((sample) => sample && sample.probeKind === "startup") || {}, staticShell);
  applyThreadRefreshStatusHintGateIssue(report);
  if (appPreviewRuntime) {
    report.viteAppPreviewReport = analyzeViteAppPreviewProbe(report.viteAppPreview, {
      consoleEvents,
      exceptions,
    }, {
      expectEmbed: appPreviewEmbed,
      expectPluginSession: appPreviewLaunchSession,
      expectRoot: appPreviewRoot,
      expectDefaultRoot: appPreviewDefaultRoot,
    });
    if (!report.viteAppPreviewReport.ok) {
      const issues = Array.isArray(report.browserReport.issues) ? report.browserReport.issues.slice() : [];
      issues.push(...(Array.isArray(report.viteAppPreviewReport.issues) ? report.viteAppPreviewReport.issues : []));
      report.browserReport.issues = issues;
      report.browserReport.issueCount = issues.length;
      report.browserReport.blockingIssueCount = issues.filter((item) => item && /^(H1|H2)$/i.test(item.severity || "")).length;
      report.browserReport.ok = report.browserReport.blockingIssueCount === 0;
    }
  }
  if (submitAllowed && report.submitExercise && !report.submitExercise.ok) {
    const issues = Array.isArray(report.browserReport.issues) ? report.browserReport.issues : [];
    issues.push({
      severity: "H2",
      code: "browser_submit_exercise_failed",
      surface: "browser-runtime",
      threadHash: String(report.submitExercise.targetThreadHash || "").slice(0, 32),
      reason: boundedToken(report.submitExercise.code, "submit_failed"),
    });
    report.browserReport.issues = issues;
    report.browserReport.issueCount = issues.length;
    report.browserReport.blockingIssueCount = issues.filter((item) => item && /^(H1|H2)$/i.test(item.severity || "")).length;
    report.browserReport.ok = false;
  }
  report.ok = report.browserReport.ok && (!submitAllowed || Boolean(report.submitExercise && report.submitExercise.ok));
  return report;
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const report = await run(options);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`${boundedToken(err && err.message, "browser_self_check_failed")}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  analyzeViteAppPreviewProbe,
  applyStartupGateIssues,
  browserStableHash,
  analyzeVitePreviewProbe,
  parseArgs,
  parseDelayList,
  parseViewport,
  readStaticShellReadback,
  routeKind,
  run,
  safeConsoleText,
  selectThreadIdsForSampling,
  turnShapeExpectation,
  snapshotInputForPlanEntry,
  snapshotExpression,
  startupProbeExpression,
  openThreadExpression,
  submitComposerExpression,
  threadListInteractionProbeExpression,
  threadListStressProbeExpression,
  usage,
  visibleTurnIds,
  viteAppPreviewProbeExpression,
  vitePreviewProbeExpression,
};
