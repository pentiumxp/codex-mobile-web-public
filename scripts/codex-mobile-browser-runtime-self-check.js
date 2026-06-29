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
} = require("../adapters/browser-runtime-self-check-service");

const DEFAULT_SERVER = "http://127.0.0.1:8787";
const DEFAULT_CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DEFAULT_VIEWPORT = "390x844";

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
    "  --rounds <n>               Thread switch rounds. Default: 3.",
    "  --sample-delays-ms <csv>   Delays after each switch. Default: 350,1200,2800.",
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
    rounds: readPositiveInt(env.CODEX_MOBILE_BROWSER_SELF_CHECK_ROUNDS || "3", 3, 20),
    sampleDelaysMs: parseDelayList(env.CODEX_MOBILE_BROWSER_SELF_CHECK_SAMPLE_DELAYS_MS || ""),
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
    else if (arg === "--rounds") options.rounds = readPositiveInt(next(), options.rounds, 20);
    else if (arg === "--sample-delays-ms") options.sampleDelaysMs = parseDelayList(next(), options.sampleDelaysMs);
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
    try {
      const detail = await fetchJson(requestUrl(options, `/api/threads/${encodeURIComponent(id)}`, { mode: "recent" }), options, key);
      expectedTurnHashes = visibleTurnIds(detail).map(browserStableHash);
      expectation = latestTurnExpectation(detail);
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
    });
  }
  return plan;
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
    detached: false,
  });
  const close = async () => {
    try {
      if (!child.killed) child.kill("SIGTERM");
    } catch (_) {}
    await sleep(250);
    try {
      if (!child.killed) child.kill("SIGKILL");
    } catch (_) {}
    fs.rmSync(userDataDir, { recursive: true, force: true });
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
        latestTurnAssistantTextDuplicateCount: duplicateCount(latestAssistantTextHashes),
        latestTurnUsageCount: latestUsageCount,
        latestTimestampExpectedItems: timestampExpectedNodes.length,
        latestTimestampMissingItems: timestampMissingNodes.length,
        imageCount: imageNodes.length,
        imageFigureCount: imageFigures.length,
        imageFailedFigureCount: failedFigures.length,
        brokenCompleteImageCount: brokenCompleteImages.length,
        imageFailureCount: failedFigures.length + brokenCompleteImages.length,
        imageFailureKindCounts,
        imageFailureDetails: failedImageDetails,
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

async function run(options = parseArgs(), deps = {}) {
  const key = deps.key !== undefined ? deps.key : readAccessKey(options);
  const startedAt = new Date().toISOString();
  const config = await fetchJson(requestUrl(options, "/api/public-config"), options, key);
  const list = await fetchJson(requestUrl(options, "/api/threads", { limit: options.listLimit }), options, key);
  const rows = threadRows(list);
  const ids = options.threadIds.length
    ? options.threadIds
    : rows.map(threadId).filter(Boolean).slice(0, options.sampleThreads);
  if (options.exerciseSubmit && options.submitThreadId && !ids.includes(options.submitThreadId)) {
    ids.unshift(options.submitThreadId);
  }
  const threadPlan = await loadThreadPlan(options, key, ids);
  const report = {
    ok: false,
    startedAt,
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
    submitExercise: options.exerciseSubmit ? {
      attempted: true,
      ok: false,
      targetThreadHash: "",
      messageHash: shortHash(options.submitMessage),
      code: "not_run",
    } : null,
  };
  if (!threadPlan.length) {
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
      source: browserInitScript(key, threadPlan[0].id),
    });
    await cdp.send("Page.navigate", { url: options.server });
    await waitForLoad(cdp, options.timeoutMs);
    await sleep(900);

    for (let round = 0; round < options.rounds; round += 1) {
      for (const entry of threadPlan) {
        await evaluate(cdp, openThreadExpression(entry.id), options.timeoutMs).catch(() => null);
        for (const delayMs of options.sampleDelaysMs) {
          await sleep(delayMs);
          const sample = await evaluate(cdp, snapshotExpression({
            threadId: entry.id,
            threadHash: entry.threadHash,
            expectedTurnHashes: entry.expectedTurnHashes,
            expectedLatestTurnHash: entry.expectedLatestTurnHash,
            expectedLatestUsageRequired: entry.expectedLatestUsageRequired,
            expectedLatestUserMessageCount: entry.expectedLatestUserMessageCount,
            expectedLatestUserMessageDuplicateCount: entry.expectedLatestUserMessageDuplicateCount,
            expectedLatestTaskCardUserMessageCount: entry.expectedLatestTaskCardUserMessageCount,
            label: `round-${round + 1}-delay-${delayMs}`,
            delayMs,
          }), options.timeoutMs).catch((err) => ({
            label: `round-${round + 1}-delay-${delayMs}`,
            threadHash: entry.threadHash,
            delayMs,
            appVisible: false,
            errorCode: boundedToken(err && err.message, "snapshot_failed"),
          }));
          samples.push(sample);
        }
      }
    }

    if (options.exerciseSubmit) {
      const submitTarget = (options.submitThreadId
        ? threadPlan.find((entry) => entry.id === options.submitThreadId)
        : null) || threadPlan[0];
      if (submitTarget) {
        report.submitExercise.targetThreadHash = submitTarget.threadHash;
        await evaluate(cdp, openThreadExpression(submitTarget.id), options.timeoutMs).catch(() => null);
        await sleep(500);
        samples.push(await evaluate(cdp, snapshotExpression({
          threadId: submitTarget.id,
          threadHash: submitTarget.threadHash,
          expectedTurnHashes: submitTarget.expectedTurnHashes,
          expectedLatestTurnHash: submitTarget.expectedLatestTurnHash,
          expectedLatestUsageRequired: submitTarget.expectedLatestUsageRequired,
          expectedLatestUserMessageCount: submitTarget.expectedLatestUserMessageCount,
          expectedLatestUserMessageDuplicateCount: submitTarget.expectedLatestUserMessageDuplicateCount,
          expectedLatestTaskCardUserMessageCount: submitTarget.expectedLatestTaskCardUserMessageCount,
          label: "submit-pre",
          delayMs: 0,
          exerciseSubmit: true,
          submitPhase: "pre",
          submitOk: false,
        }), options.timeoutMs).catch((err) => ({
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
          samples.push(await evaluate(cdp, snapshotExpression({
            threadId: submitTarget.id,
            threadHash: submitTarget.threadHash,
            expectedTurnHashes: submitTarget.expectedTurnHashes,
            expectedLatestTurnHash: submitTarget.expectedLatestTurnHash,
            expectedLatestUsageRequired: submitTarget.expectedLatestUsageRequired,
            expectedLatestUserMessageCount: submitTarget.expectedLatestUserMessageCount,
            expectedLatestUserMessageDuplicateCount: submitTarget.expectedLatestUserMessageDuplicateCount,
            expectedLatestTaskCardUserMessageCount: submitTarget.expectedLatestTaskCardUserMessageCount,
            label: `submit-${phase}`,
            delayMs,
            exerciseSubmit: true,
            submitPhase: phase,
            submitOk: Boolean(submitResult && submitResult.ok),
          }), options.timeoutMs).catch((err) => ({
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

  report.browserReport = analyzeBrowserRuntimeSamples({
    samples,
    networkEvents,
    consoleEvents,
    exceptions,
    minSettledDelayMs: options.minSettledDelayMs,
  });
  if (options.exerciseSubmit && report.submitExercise && !report.submitExercise.ok) {
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
  report.ok = report.browserReport.ok && (!options.exerciseSubmit || Boolean(report.submitExercise && report.submitExercise.ok));
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
  parseArgs,
  parseDelayList,
  parseViewport,
  routeKind,
  run,
  safeConsoleText,
  snapshotExpression,
  submitComposerExpression,
  usage,
};
