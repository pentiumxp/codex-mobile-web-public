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
    "  --rounds <n>               Thread switch rounds. Default: 3.",
    "  --sample-delays-ms <csv>   Delays after each switch. Default: 350,1200,2800.",
    "  --thread-list-stress-rounds <n> Thread-list open/scroll/click stress rounds. Default: 2.",
    "  --exercise-submit          Send one short UI message through Composer in the target test thread.",
    "  --submit-thread-id <id>    Dedicated thread id for --exercise-submit. Defaults to first selected thread.",
    "  --submit-message <text>    Test message. Default asks for a one-token OK reply.",
    "  --submit-sample-delays-ms <csv> Delays after submit. Default: 100,350,900,1600,2800,6000.",
    "  --viewport <WxH>           Browser viewport. Default: 390x844.",
    "  --chrome-path <path>       Chrome executable. Default: macOS Google Chrome.",
    "  --headed                   Run visible Chrome instead of headless.",
    "  --timeout-ms <n>           Request/browser timeout. Default: 20000.",
    "  --min-settled-delay-ms <n> Sparse-after-nonempty H2 threshold. Default: 1000.",
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

function parseDelayList(value, fallback = [350, 1200, 2800]) {
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
    rounds: readPositiveInt(env.CODEX_MOBILE_BROWSER_SELF_CHECK_ROUNDS || "3", 3, 20),
    sampleDelaysMs: parseDelayList(env.CODEX_MOBILE_BROWSER_SELF_CHECK_SAMPLE_DELAYS_MS || ""),
    threadListStressRounds: readNonNegativeInt(env.CODEX_MOBILE_BROWSER_SELF_CHECK_THREAD_LIST_STRESS_ROUNDS || "2", 2, 20),
    exerciseSubmit: /^(1|true|yes)$/i.test(String(env.CODEX_MOBILE_BROWSER_SELF_CHECK_EXERCISE_SUBMIT || "")),
    submitThreadId: String(env.CODEX_MOBILE_BROWSER_SELF_CHECK_SUBMIT_THREAD_ID || "").trim(),
    submitMessage: String(env.CODEX_MOBILE_BROWSER_SELF_CHECK_SUBMIT_MESSAGE || "Codex Mobile self-check test. Reply exactly: OK").slice(0, 500),
    submitSampleDelaysMs: parseDelayList(env.CODEX_MOBILE_BROWSER_SELF_CHECK_SUBMIT_SAMPLE_DELAYS_MS || "100,350,900,1600,2800,6000", [100, 350, 900, 1600, 2800, 6000]),
    viewport: parseViewport(env.CODEX_MOBILE_BROWSER_SELF_CHECK_VIEWPORT || DEFAULT_VIEWPORT),
    headed: false,
    timeoutMs: readPositiveInt(env.CODEX_MOBILE_BROWSER_SELF_CHECK_TIMEOUT_MS || "20000", 20000, 120000),
    minSettledDelayMs: readPositiveInt(env.CODEX_MOBILE_BROWSER_SELF_CHECK_MIN_SETTLED_DELAY_MS || "1000", 1000, 10000),
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
    else if (arg === "--rounds") options.rounds = readPositiveInt(next(), options.rounds, 20);
    else if (arg === "--sample-delays-ms") options.sampleDelaysMs = parseDelayList(next(), options.sampleDelaysMs);
    else if (arg === "--thread-list-stress-rounds") options.threadListStressRounds = readNonNegativeInt(next(), options.threadListStressRounds, 20);
    else if (arg === "--exercise-submit") options.exerciseSubmit = true;
    else if (arg === "--submit-thread-id") options.submitThreadId = next();
    else if (arg === "--submit-message") options.submitMessage = next().slice(0, 500);
    else if (arg === "--submit-sample-delays-ms") options.submitSampleDelaysMs = parseDelayList(next(), options.submitSampleDelaysMs);
    else if (arg === "--viewport") options.viewport = parseViewport(next());
    else if (arg === "--headed") options.headed = true;
    else if (arg === "--timeout-ms") options.timeoutMs = readPositiveInt(next(), options.timeoutMs, 120000);
    else if (arg === "--min-settled-delay-ms") options.minSettledDelayMs = readPositiveInt(next(), options.minSettledDelayMs, 10000);
    else if (arg === "--json") options.json = true;
    else throw new Error(`unknown option: ${arg}`);
  }
  options.server = normalizeBaseUrl(options.server);
  options.threadIds = options.threadIds.map((id) => String(id || "").trim()).filter(Boolean);
  options.submitThreadId = String(options.submitThreadId || "").trim();
  options.submitMessage = String(options.submitMessage || "Codex Mobile self-check test. Reply exactly: OK").slice(0, 500);
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

async function fetchJson(url, options = {}, key = "") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const headers = {};
    if (key) headers.Authorization = `Bearer ${key}`;
    const response = await fetch(url, { headers, signal: controller.signal });
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

function visibleTurnIds(detail = {}) {
  const thread = detail && (detail.thread || detail.data || detail);
  const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
  return turns.map((turn) => String(turn && turn.id || "")).filter(Boolean);
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
  const thread = detail && (detail.thread || detail.data || detail);
  const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
  const latest = turns.length ? turns[turns.length - 1] : null;
  const items = Array.isArray(latest && latest.items) ? latest.items : [];
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
    expectedLatestUserMessageDuplicateCount: duplicateLatestUserMessageEventCount(ordinaryUserItems),
    expectedLatestTaskCardUserMessageCount: injectedTaskCardUserItems.length,
    expectedLatestOperationItemCount: itemTypes.filter((type) => /^(commandExecution|fileChange|dynamicToolCall|mcpToolCall|collabAgentToolCall)$/i.test(type)).length,
    expectedLatestReasoningItemCount: itemTypes.filter((type) => /^reasoning$/i.test(type)).length,
    expectedLatestTimestampItemCount: itemTypes.filter((type) => /^(userMessage|agentMessage|plan|turnDiagnostic)$/i.test(type)).length,
  };
}

function turnShapeExpectation(detail = {}) {
  const thread = detail && (detail.thread || detail.data || detail);
  const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
  return turns.slice(-20).map((turn, index) => {
    const items = Array.isArray(turn && turn.items) ? turn.items : [];
    const userItems = items.filter((item) => item && /^userMessage$/i.test(String(item.type || "")));
    const injectedTaskCardUserItems = userItems.filter(isInjectedThreadTaskCardItem);
    const itemTypes = items.map((item) => String(item && item.type || "unknown").trim() || "unknown");
    return {
      index,
      turnHash: browserStableHash(turn && turn.id || ""),
      completed: completedStatus(turn && turn.status),
      expectedItemCount: items.length,
      expectedUserMessageCount: Math.max(0, userItems.length - injectedTaskCardUserItems.length),
      expectedTaskCardUserMessageCount: injectedTaskCardUserItems.length,
      expectedAssistantMessageCount: itemTypes.filter((type) => /^(agentMessage|plan)$/i.test(type)).length,
      expectedUsageRequired: Boolean(completedStatus(turn && turn.status) && itemTypes.includes("turnUsageSummary")),
      expectedTimestampItemCount: itemTypes.filter((type) => /^(userMessage|agentMessage|plan|turnDiagnostic)$/i.test(type)).length,
    };
  });
}

function safeThreadPlan(ids = []) {
  return ids.map((id) => ({
    threadHash: shortHash(id),
    expectedTurnHashCount: 0,
    expectedLatestTurnHash: "",
  }));
}

async function loadThreadPlan(options, key, ids) {
  const plan = [];
  for (const id of ids) {
    let expectedTurnHashes = [];
    let expectation = latestTurnExpectation();
    let expectedTurnShapes = [];
    try {
      const detail = await fetchJson(requestUrl(options, `/api/threads/${encodeURIComponent(id)}`, {
        mode: "recent",
        budget: "full",
      }), options, key);
      expectedTurnHashes = visibleTurnIds(detail).map(browserStableHash);
      expectation = latestTurnExpectation(detail);
      expectedTurnShapes = turnShapeExpectation(detail);
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
      expectedLatestUserMessageDuplicateCount: expectation.expectedLatestUserMessageDuplicateCount,
      expectedLatestTaskCardUserMessageCount: expectation.expectedLatestTaskCardUserMessageCount,
      expectedLatestOperationItemCount: expectation.expectedLatestOperationItemCount,
      expectedLatestReasoningItemCount: expectation.expectedLatestReasoningItemCount,
      expectedLatestTimestampItemCount: expectation.expectedLatestTimestampItemCount,
      expectedTurnShapes,
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
    expectedLatestUserMessageCount: entry.expectedLatestUserMessageCount,
    expectedLatestUserMessageDuplicateCount: entry.expectedLatestUserMessageDuplicateCount,
    expectedLatestTaskCardUserMessageCount: entry.expectedLatestTaskCardUserMessageCount,
    expectedTurnShapes: entry.expectedTurnShapes,
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
  if (text.includes("uncaught")) return "uncaught";
  if (text.includes("error")) return "console_error";
  if (text.includes("warning")) return "console_warning";
  return "console_event";
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
  return `
    (() => {
      const visible = (node) => {
        if (!node || typeof node.getBoundingClientRect !== "function") return false;
        const style = typeof getComputedStyle === "function" ? getComputedStyle(node) : {};
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.height > 0 && rect.width > 0;
      };
      let clientBuildId = "";
      try {
        clientBuildId = typeof CLIENT_BUILD_ID === "string" ? CLIENT_BUILD_ID : "";
      } catch (_) {}
      const app = document.getElementById("app");
      const login = document.getElementById("loginPanel");
      const bootRecovery = document.getElementById("bootRecovery");
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
        composerRuntimeReady: Boolean(window.CodexComposerRuntime && typeof window.CodexComposerRuntime.createComposerRuntime === "function"),
        threadListRuntimeReady: Boolean(window.CodexThreadListRuntime && typeof window.CodexThreadListRuntime.createThreadListRuntime === "function"),
        threadTileRuntimeReady: Boolean(window.CodexThreadTileRuntime && typeof window.CodexThreadTileRuntime.createThreadTileRuntime === "function"),
        loadThreadReady: typeof window.loadThread === "function",
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
      const entryGroupImportOwner = window.__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_OWNER__
        || (marker ? String(marker.dataset.entryGroupImportOwner || "") : "");
      const requiredStartupGlobals = Array.isArray(compatibility.requiredStartupGlobals)
        ? compatibility.requiredStartupGlobals
        : [];
      const classicGlobalExports = Array.isArray(compatibility.classicGlobalExports)
        ? compatibility.classicGlobalExports
        : [];
      const classicGlobalNames = new Set();
      for (const entry of classicGlobalExports) {
        for (const name of Array.isArray(entry && entry.globals) ? entry.globals : []) {
          classicGlobalNames.add(String(name || ""));
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
      let entryGroupClassicCoverageOk = expectedEntryGroupIds.length > 0;
      for (const group of entryGroups) {
        const groupId = String(group && group.id || "");
        if (!groupId) continue;
        const expectedCoverage = coverageForGroup(group);
        const actual = entryGroupRegistry[groupId] || {};
        const groupOk = Number(actual.assetCount) === expectedCoverage.assetCount
          && Number(actual.classicGlobalExportAssetCount) === expectedCoverage.classicGlobalExportAssetCount
          && Number(actual.classicGlobalExportCount) === expectedCoverage.classicGlobalExportCount;
        if (!groupOk) entryGroupClassicCoverageOk = false;
        registryCoverage.push({
          groupId,
          ok: groupOk,
          assetCount: Number(actual.assetCount) || 0,
          expectedAssetCount: expectedCoverage.assetCount,
          classicGlobalExportAssetCount: Number(actual.classicGlobalExportAssetCount) || 0,
          expectedClassicGlobalExportAssetCount: expectedCoverage.classicGlobalExportAssetCount,
          classicGlobalExportCount: Number(actual.classicGlobalExportCount) || 0,
          expectedClassicGlobalExportCount: expectedCoverage.classicGlobalExportCount,
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
        moduleScriptMatchesPreview: moduleScripts.some((scriptPath) => /^\\/vite-shell\\/assets\\/vite-shell-entry-/.test(scriptPath)),
        moduleEntryLoaded: window.__CODEX_MOBILE_VITE_SHELL_BUILD_STAGE__ === "entry-topology-v1",
        entryTopologyReady: Array.isArray(topology.startupGroups) && Array.isArray(topology.deferredGroups),
        entryGroupImportOwner,
        entryGroupImportOwnerOk: entryGroupImportOwner === "vite-shell-entry",
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
        entryGroupClassicCoverageGlobalCount: registryCoverage.reduce((total, entry) => (
          total + (Number(entry && entry.classicGlobalExportCount) || 0)
        ), 0),
        classicCompatibilityReady: Array.isArray(compatibility.classicGlobalExports) && classicGlobalExports.length > 0,
        classicCompatibilityAssetCount: classicGlobalExports.length,
        classicCompatibilityGlobalCount: classicGlobalNames.size,
        classicCompatibilityStartupGlobalsReady: requiredStartupGlobals.every((name) => classicGlobalNames.has(name)),
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
  if (sample && sample.productionExecution !== "classic-script-fallback") append("vite_preview_execution_mode_mismatch");
  if (sample && sample.clientBuildMatches !== true) append("vite_preview_client_build_mismatch");
  if (sample && sample.shellCacheMatches !== true) append("vite_preview_shell_cache_mismatch");
  if (sample && sample.moduleScriptMatchesPreview !== true) append("vite_preview_module_entry_missing");
  if (sample && sample.moduleEntryLoaded !== true) append("vite_preview_module_entry_not_loaded");
  if (sample && sample.entryTopologyReady !== true) append("vite_preview_entry_topology_missing");
  if (sample && sample.entryGroupImportOwnerOk !== true) append("vite_preview_entry_group_import_owner_mismatch");
  if (sample && sample.startupCriticalPreloadsMatch !== true) append("vite_preview_startup_preload_mismatch");
  if (sample && sample.startupCriticalAssetStatusOk !== true) append("vite_preview_startup_asset_fetch_failed");
  if (sample && sample.entryGroupChunkPreloadsMatch !== true) append("vite_preview_entry_group_chunk_preload_mismatch");
  if (sample && sample.entryGroupChunkStatusOk !== true) append("vite_preview_entry_group_chunk_fetch_failed");
  if (sample && sample.entryGroupChunkExecutionOk !== true) append("vite_preview_entry_group_chunk_not_executed");
  if (sample && sample.entryGroupClassicCoverageOk !== true) append("vite_preview_entry_group_classic_coverage_mismatch");
  if (sample && sample.classicCompatibilityReady !== true) append("vite_preview_classic_compatibility_missing");
  if (sample && sample.classicCompatibilityStartupGlobalsReady !== true) append("vite_preview_classic_startup_globals_missing");
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

function openThreadExpression(threadId) {
  return `
    (async () => {
      const id = ${JSON.stringify(threadId)};
      try { localStorage.setItem("codexMobileCurrentThreadId", id); } catch (_) {}
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const clickCard = () => {
        const button = Array.from(document.querySelectorAll("[data-thread]"))
          .find((entry) => String(entry.getAttribute("data-thread") || "") === id);
        if (button) {
          button.click();
          return true;
        }
        return false;
      };
      if (clickCard()) return { ok: true, method: "thread-card" };
      if (typeof window.loadThread === "function") {
        window.loadThread(id, { source: "browser-runtime-self-check" }).catch(() => {});
        return { ok: true, method: "loadThread" };
      }
      for (let index = 0; index < 20; index += 1) {
        await wait(100);
        if (clickCard()) return { ok: true, method: "thread-card-delayed" };
      }
      return { ok: false, method: "unavailable" };
    })();
  `;
}

function snapshotExpression(input = {}) {
  const threadId = String(input.threadId || "");
  const threadHash = String(input.threadHash || "");
  const expectedTurnHashes = Array.isArray(input.expectedTurnHashes) ? input.expectedTurnHashes : [];
  const expectedLatestTurnHash = String(input.expectedLatestTurnHash || "");
  const expectedLatestUsageRequired = Boolean(input.expectedLatestUsageRequired);
  const expectedLatestUserMessageCount = Math.max(0, Number(input.expectedLatestUserMessageCount || 0) || 0);
  const expectedLatestUserMessageDuplicateCount = Math.max(0, Number(input.expectedLatestUserMessageDuplicateCount || 0) || 0);
  const expectedLatestTaskCardUserMessageCount = Math.max(0, Number(input.expectedLatestTaskCardUserMessageCount || 0) || 0);
  const expectedTurnShapes = Array.isArray(input.expectedTurnShapes) ? input.expectedTurnShapes.slice(-20) : [];
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
      const expectedLatestUserMessageCount = ${JSON.stringify(expectedLatestUserMessageCount)};
      const expectedLatestUserMessageDuplicateCount = ${JSON.stringify(expectedLatestUserMessageDuplicateCount)};
      const expectedLatestTaskCardUserMessageCount = ${JSON.stringify(expectedLatestTaskCardUserMessageCount)};
      const expectedTurnShapes = ${JSON.stringify(expectedTurnShapes)};
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
          if (submissionHash) return "submission:" + submissionHash;
          const body = node.querySelector(".item-body") || node;
          const text = String(body.textContent || "").replace(/\\s+/g, " ").trim();
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
      const domTurnShapes = turnNodes.slice(-20).map((turnNode, index) => {
        const nodes = itemNodesForTurn(turnNode);
        const usageIndexes = [];
        const userIndexes = [];
        let assistantMessageCount = 0;
        let taskCardUserMessageCount = 0;
        let timestampExpectedItems = 0;
        let timestampMissingItems = 0;
        const timestampMissingKindCounts = {};
        nodes.forEach((node, itemIndex) => {
          const className = String(node.className || "");
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
          itemCount: nodes.length,
          userMessageCount: userIndexes.length,
          taskCardUserMessageCount,
          assistantMessageCount,
          usageCount: usageIndexes.length,
          timestampExpectedItems,
          timestampMissingItems,
          timestampMissingKindCounts,
          userAfterUsageCount: lastUsageIndex >= 0 ? userIndexes.filter((itemIndex) => itemIndex > lastUsageIndex).length : 0,
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
        expectedLatestUsageRequired,
        expectedLatestUserMessageCount,
        expectedLatestUserMessageDuplicateCount,
        expectedLatestTaskCardUserMessageCount,
        dynamicThreadPlan,
        expectedTurnShapes,
        domTurnShapes,
        latestTurnHash,
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

function appendBrowserIssue(report, item) {
  if (!report || !report.browserReport || !item) return;
  const issues = Array.isArray(report.browserReport.issues) ? report.browserReport.issues : [];
  issues.push(item);
  report.browserReport.issues = issues;
  report.browserReport.issueCount = issues.length;
  report.browserReport.blockingIssueCount = issues.filter((issueItem) => issueItem && /^(H1|H2)$/i.test(issueItem.severity || "")).length;
  report.browserReport.ok = report.browserReport.blockingIssueCount === 0;
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
}

async function run(options = parseArgs(), deps = {}) {
  const key = deps.key !== undefined ? deps.key : readAccessKey(options);
  const startedAt = new Date().toISOString();
  const config = await fetchJson(requestUrl(options, "/api/public-config"), options, key);
  const staticShell = await readStaticShellReadback(options, config);
  const list = (options.startupOnly || options.vitePreviewOnly)
    ? { data: [] }
    : await fetchJson(requestUrl(options, "/api/threads", { limit: options.listLimit }), options, key);
  const rows = threadRows(list);
  const ids = options.threadIds.length
    ? options.threadIds
    : rows.map(threadId).filter(Boolean).slice(0, options.sampleThreads);
  if (options.exerciseSubmit && options.submitThreadId && !ids.includes(options.submitThreadId)) {
    ids.unshift(options.submitThreadId);
  }
  const threadPlan = (options.startupOnly || options.vitePreviewOnly) ? [] : await loadThreadPlan(options, key, ids);
  const report = {
    ok: false,
    startedAt,
    mode: options.vitePreviewOnly ? "vite-preview" : options.startupOnly ? "startup-only" : "full",
    endpoint: endpointKind(options.server),
    browser: { engine: "chrome-cdp", headed: Boolean(options.headed), viewport: options.viewport },
    publicConfig: {
      version: String(config && config.version || "").slice(0, 40),
      clientBuildId: String(config && config.clientBuildId || "").slice(0, 120),
      shellCacheName: String(config && config.shellCacheName || "").slice(0, 120),
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
      expectedLatestUserMessageDuplicateCount: entry.expectedLatestUserMessageDuplicateCount,
      expectedLatestTaskCardUserMessageCount: entry.expectedLatestTaskCardUserMessageCount,
      expectedLatestOperationItemCount: entry.expectedLatestOperationItemCount,
      expectedLatestReasoningItemCount: entry.expectedLatestReasoningItemCount,
      expectedLatestTimestampItemCount: entry.expectedLatestTimestampItemCount,
    })),
    browserReport: null,
    vitePreview: null,
    submitExercise: (!options.startupOnly && options.exerciseSubmit) ? {
      attempted: true,
      ok: false,
      targetThreadHash: "",
      messageHash: shortHash(options.submitMessage),
      code: "not_run",
    } : null,
  };
  if (!options.startupOnly && !options.vitePreviewOnly && !threadPlan.length) {
    report.browserReport = analyzeBrowserRuntimeSamples({ samples: [] });
    report.error = "no_threads_selected";
    return report;
  }

  const networkEvents = [];
  const consoleEvents = [];
  const exceptions = [];
  const samples = [];
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
        exceptions.push({
          code: safeConsoleText(message.params && message.params.exceptionDetails && message.params.exceptionDetails.text || "exception"),
        });
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
    await cdp.send("Page.navigate", {
      url: options.vitePreviewOnly ? requestUrl(options, "/vite-shell/preview.html") : options.server,
    });
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
    const startupSample = options.vitePreviewOnly ? null : await evaluate(cdp, startupProbeExpression(report.publicConfig), options.timeoutMs).catch((err) => ({
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
    if (options.startupOnly) {
      report.startup = {
        appVisible: startupSample.appVisible === true,
        loginVisible: startupSample.loginVisible === true,
        clientBuildMatches: startupSample.clientBuildMatches === true,
        runtimeReady: startupSample.composerRuntimeReady === true
          && startupSample.threadListRuntimeReady === true
          && startupSample.threadTileRuntimeReady === true,
        loadThreadReady: startupSample.loadThreadReady === true,
      };
    }
    if (!options.startupOnly && !options.vitePreviewOnly) {
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
      }

      for (let round = 0; round < options.rounds; round += 1) {
        for (const entry of threadPlan) {
          await evaluate(cdp, openThreadExpression(entry.id), options.timeoutMs).catch(() => null);
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

    if (!options.startupOnly && !options.vitePreviewOnly && options.exerciseSubmit) {
      const submitTarget = (options.submitThreadId
        ? threadPlan.find((entry) => entry.id === options.submitThreadId)
        : null) || threadPlan[0];
      if (submitTarget) {
        report.submitExercise.targetThreadHash = submitTarget.threadHash;
        await evaluate(cdp, openThreadExpression(submitTarget.id), options.timeoutMs).catch(() => null);
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
        const submitResult = await evaluate(cdp, submitComposerExpression(options.submitMessage), options.timeoutMs).catch((err) => ({
          ok: false,
          code: boundedToken(err && err.message, "submit_failed"),
        }));
        report.submitExercise.ok = Boolean(submitResult && submitResult.ok);
        report.submitExercise.code = boundedToken(submitResult && submitResult.code, report.submitExercise.ok ? "submitted" : "submit_failed");
        report.submitExercise.disabledBeforeSubmit = Boolean(submitResult && submitResult.disabledBeforeSubmit);
        for (const delayMs of options.submitSampleDelaysMs) {
          await sleep(delayMs);
          const phase = `post-${delayMs}`;
          const submitPostPlan = await refreshThreadPlanEntry(options, key, submitTarget);
          samples.push(await evaluate(cdp, snapshotExpression(snapshotInputForPlanEntry(submitPostPlan, {
            label: `submit-${phase}`,
            delayMs,
            exerciseSubmit: true,
            submitPhase: phase,
            submitOk: Boolean(submitResult && submitResult.ok),
          })), options.timeoutMs).catch((err) => ({
            label: `submit-${phase}`,
            threadHash: submitTarget.threadHash,
            delayMs,
            exerciseSubmit: true,
            submitPhase: phase,
            submitOk: Boolean(submitResult && submitResult.ok),
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

  report.browserReport = analyzeBrowserRuntimeSamples({
    samples,
    networkEvents,
    consoleEvents,
    exceptions,
    minSettledDelayMs: options.minSettledDelayMs,
  });
  applyStartupGateIssues(report, samples.find((sample) => sample && sample.probeKind === "startup") || {}, staticShell);
  if (!options.startupOnly && options.exerciseSubmit && report.submitExercise && !report.submitExercise.ok) {
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
  report.ok = report.browserReport.ok && (options.startupOnly || !options.exerciseSubmit || Boolean(report.submitExercise && report.submitExercise.ok));
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
  browserStableHash,
  analyzeVitePreviewProbe,
  parseArgs,
  parseDelayList,
  parseViewport,
  readStaticShellReadback,
  routeKind,
  run,
  safeConsoleText,
  snapshotInputForPlanEntry,
  snapshotExpression,
  startupProbeExpression,
  submitComposerExpression,
  threadListInteractionProbeExpression,
  threadListStressProbeExpression,
  usage,
  vitePreviewProbeExpression,
};
