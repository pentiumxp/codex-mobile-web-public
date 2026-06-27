"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DEFAULT_DEBUG_URL = "http://127.0.0.1:19073/";
const DEFAULT_SERVER_URL = "http://127.0.0.1:8787/";
const DEFAULT_ARTIFACT_DIR = path.join(process.env.HOME || "/tmp", ".homeai-qa", "artifacts");

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    debugUrl: DEFAULT_DEBUG_URL,
    serverUrl: DEFAULT_SERVER_URL,
    appUrl: "",
    artifactDir: DEFAULT_ARTIFACT_DIR,
    screenshot: "",
    timeoutMs: 15000,
    waitMs: 1200,
    attempts: 8,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    const next = () => argv[++index] || "";
    if (item === "--debug-url") out.debugUrl = next() || out.debugUrl;
    else if (item === "--server-url") out.serverUrl = next() || out.serverUrl;
    else if (item === "--app-url") out.appUrl = next();
    else if (item === "--artifact-dir") out.artifactDir = next() || out.artifactDir;
    else if (item === "--screenshot") out.screenshot = next();
    else if (item === "--timeout-ms") out.timeoutMs = readPositiveInt(next(), out.timeoutMs);
    else if (item === "--wait-ms") out.waitMs = readPositiveInt(next(), out.waitMs);
    else if (item === "--attempts") out.attempts = readPositiveInt(next(), out.attempts);
    else if (item === "--json") out.json = true;
    else if (item === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`unknown_argument:${item}`);
    }
  }
  out.debugUrl = normalizeBaseUrl(out.debugUrl, DEFAULT_DEBUG_URL);
  out.serverUrl = normalizeBaseUrl(out.serverUrl, DEFAULT_SERVER_URL);
  return out;
}

function readPositiveInt(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.floor(number);
}

function normalizeBaseUrl(value, fallback) {
  const url = new URL(value || fallback || DEFAULT_DEBUG_URL);
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.toString();
}

function apiUrl(options, pathname) {
  return new URL(pathname.replace(/^\//, ""), options.debugUrl).toString();
}

function serverApiUrl(options, pathname) {
  return new URL(pathname.replace(/^\//, ""), options.serverUrl).toString();
}

function stableTextHash(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function endpointKind(value, fallback = DEFAULT_DEBUG_URL) {
  try {
    const url = new URL(value || fallback);
    const host = String(url.hostname || "").toLowerCase();
    if (host === "127.0.0.1" || host === "localhost" || host === "::1") return "local";
    return "remote";
  } catch (_) {
    return "unknown";
  }
}

function safeErrorCode(error, fallback = "error") {
  const text = String(error && error.message || error || "").toLowerCase();
  const status = text.match(/\b([1-5]\d\d)\b/);
  if (status) return `http_${status[1]}`;
  if (text.includes("abort") || text.includes("timeout")) return "request_timeout";
  if (text.includes("lease")) return "debug_lane_lease_failed";
  if (text.includes("screenshot")) return "screenshot_failed";
  if (text.includes("action")) return "action_failed";
  const token = text.match(/\b[a-z][a-z0-9_:-]{2,80}\b/);
  return String(token && token[0] || fallback)
    .replace(/[^a-z0-9_:-]/g, "_")
    .slice(0, 80) || fallback;
}

function safeScreenshotResult(screenshotPath, bytes) {
  return {
    pathHash: stableTextHash(screenshotPath),
    bytes: Number(bytes || 0),
  };
}

function createInitialReport(options, config = {}) {
  return {
    ok: false,
    debugEndpoint: endpointKind(options.debugUrl, DEFAULT_DEBUG_URL),
    serverEndpoint: endpointKind(options.serverUrl, DEFAULT_SERVER_URL),
    expectedClientBuildId: String(config.clientBuildId || ""),
    expectedShellCacheName: String(config.shellCacheName || ""),
    startedAt: new Date().toISOString(),
    recovery: [],
    metrics: null,
    screenshot: null,
    lease: null,
  };
}

function printHelp() {
  console.log([
    "Usage: node scripts/codex-mobile-pwa-shell-refresh-smoke.js [options]",
    "",
    "Uses the Home AI iOS/PWA live debug server to inspect the embedded Codex",
    "Mobile PWA shell refresh contract without triggering a reload by default.",
    "",
    "Options:",
    "  --debug-url <url>     Live debug server, default http://127.0.0.1:19073/",
    "  --server-url <url>    Codex Mobile server, default http://127.0.0.1:8787/",
    "  --app-url <url>       Optional Home AI PWA URL to open first.",
    "  --screenshot <path>   Screenshot artifact path.",
    "  --json                Print JSON only.",
  ].join("\n"));
}

async function fetchJson(url, init = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, Object.assign({}, init, { signal: controller.signal }));
    const text = await response.text();
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch (_) {
      parsed = {};
    }
    if (!response.ok) throw new Error(`http_${response.status}`);
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPublicConfig(options) {
  const config = await fetchJson(serverApiUrl(options, "/api/public-config"), {}, options.timeoutMs);
  return {
    clientBuildId: String(config && config.clientBuildId || ""),
    shellCacheName: String(config && config.shellCacheName || ""),
    buildId: String(config && config.buildId || ""),
  };
}

async function postJson(options, pathname, body) {
  return fetchJson(apiUrl(options, pathname), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  }, options.timeoutMs);
}

async function acquireLease(options) {
  const owner = `codex-mobile-pwa-shell-refresh:${process.pid}`;
  const response = await postJson(options, "/api/lease", {
    owner,
    ttlMs: Math.max(90000, options.timeoutMs * 3 + options.waitMs * options.attempts + 30000),
  });
  if (!response.ok || !response.token) throw new Error("debug_lane_lease_failed");
  options.leaseToken = response.token;
  return response;
}

async function releaseLease(options) {
  if (!options.leaseToken) return;
  const token = options.leaseToken;
  options.leaseToken = "";
  await postJson(options, "/api/lease/release", { leaseToken: token }).catch(() => null);
}

async function postAction(options, body) {
  const response = await postJson(options, "/api/action", Object.assign({}, body, {
    leaseToken: options.leaseToken,
  }));
  if (!response.ok) throw new Error(`action_failed:${safeErrorCode(response.error, "unknown")}`);
  return response.value;
}

function defaultScreenshotPath(options) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
  return path.join(options.artifactDir, `codex-mobile-pwa-shell-refresh-${stamp}.png`);
}

async function saveScreenshot(options) {
  const screenshotPath = options.screenshot || defaultScreenshotPath(options);
  const url = `${apiUrl(options, "/api/screenshot?force=1")}&leaseToken=${encodeURIComponent(options.leaseToken || "")}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`screenshot_failed:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
  fs.writeFileSync(screenshotPath, bytes);
  return safeScreenshotResult(screenshotPath, bytes.length);
}

const MEASURE_SCRIPT = `
  const expectedClientBuildId = String(arguments[0] || "");
  const frame = document.querySelector("#codexPluginHost .embedded-plugin-frame, .embedded-plugin-frame");
  const appWindow = frame && frame.contentWindow ? frame.contentWindow : window;
  const appDocument = frame && frame.contentDocument ? frame.contentDocument : document;
  if (!appWindow || !appDocument || appDocument.readyState === "loading") {
    return { ok: false, error: "app_shell_loading", retryAfterMs: 900 };
  }
  const harness = appWindow.__codexMobileVisualHarness || null;
  const clientBuildId = harness && typeof harness.clientBuildId === "function"
    ? String(harness.clientBuildId() || "")
    : "";
  const app = appDocument.getElementById("app");
  const bootRecovery = appDocument.getElementById("bootRecovery");
  const hardRefreshButton = appDocument.getElementById("hardRefreshButton");
  const pageRefreshPrompt = appDocument.getElementById("pageRefreshPrompt");
  const appVisible = Boolean(app && !app.classList.contains("hidden"));
  const bootRecoveryHidden = !bootRecovery || Boolean(bootRecovery.hidden);
  const hardRefreshPresent = Boolean(hardRefreshButton);
  const pageRefreshPromptPresent = Boolean(pageRefreshPrompt);
  const pageRefreshPromptHidden = !pageRefreshPrompt || pageRefreshPrompt.classList.contains("hidden");
  const refreshFunctions = {
    refreshPageForNewBuild: typeof appWindow.refreshPageForNewBuild === "function",
    clearAllShellCaches: typeof appWindow.clearAllShellCaches === "function",
    resetPageShellServiceWorker: typeof appWindow.resetPageShellServiceWorker === "function",
  };
  const capabilities = {
    serviceWorker: Boolean(appWindow.navigator && appWindow.navigator.serviceWorker),
    caches: Boolean(appWindow.caches),
  };
  const clientBuildMatches = Boolean(!expectedClientBuildId || clientBuildId === expectedClientBuildId);
  return {
    ok: Boolean(clientBuildId && clientBuildMatches && appVisible && bootRecoveryHidden && hardRefreshPresent && pageRefreshPromptPresent && refreshFunctions.refreshPageForNewBuild && refreshFunctions.clearAllShellCaches && refreshFunctions.resetPageShellServiceWorker),
    error: "",
    routeKind: frame ? "home-ai-embedded-plugin" : "direct-app",
    clientBuildId,
    clientBuildMatches,
    appVisible,
    bootRecoveryHidden,
    hardRefreshPresent,
    pageRefreshPromptPresent,
    pageRefreshPromptHidden,
    refreshFunctions,
    capabilities,
  };
`;

async function run(options) {
  const config = await fetchPublicConfig(options);
  const report = createInitialReport(options, config);
  await acquireLease(options);
  report.lease = { acquired: true };
  try {
    if (options.appUrl) {
      await postAction(options, { type: "open", url: options.appUrl });
      await sleep(options.waitMs);
    } else {
      await postAction(options, { type: "launchPwa" });
      await sleep(Math.min(2500, options.waitMs));
    }
    try {
      await postAction(options, { type: "connect", resetSession: false });
    } catch (err) {
      report.recovery.push({ action: "connect", errorCode: safeErrorCode(err, "connect_failed") });
      await postAction(options, { type: "connect", resetSession: true });
    }
    for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
      const metrics = await postAction(options, {
        type: "js",
        script: MEASURE_SCRIPT,
        args: [config.clientBuildId],
      });
      report.metrics = metrics;
      if (metrics && metrics.ok) break;
      if (attempt < options.attempts) await sleep(Number(metrics && metrics.retryAfterMs) || options.waitMs);
    }
    report.screenshot = await saveScreenshot(options);
    report.ok = Boolean(report.metrics && report.metrics.ok && report.screenshot && report.screenshot.bytes >= 4096);
    return report;
  } finally {
    await releaseLease(options);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (require.main === module) {
  const options = parseArgs();
  run(options).then((report) => {
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  }).catch((err) => {
    const report = { ok: false, errorCode: safeErrorCode(err, "pwa_shell_refresh_smoke_failed") };
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  run,
  createInitialReport,
  endpointKind,
  safeErrorCode,
  safeScreenshotResult,
  stableTextHash,
  MEASURE_SCRIPT,
};
