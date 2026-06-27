"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DEFAULT_DEBUG_URL = "http://127.0.0.1:19073/";
const DEFAULT_SERVER_URL = "http://127.0.0.1:8787/";
const DEFAULT_THREAD_ID = "019ea76b-d846-7892-bda0-c0fff9cf7581";
const DEFAULT_ARTIFACT_DIR = path.join(process.env.HOME || "/tmp", ".homeai-qa", "artifacts");

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    debugUrl: DEFAULT_DEBUG_URL,
    serverUrl: DEFAULT_SERVER_URL,
    threadId: DEFAULT_THREAD_ID,
    targetTurnId: "",
    appUrl: "",
    artifactDir: DEFAULT_ARTIFACT_DIR,
    screenshot: "",
    timeoutMs: 18000,
    waitMs: 1600,
    attempts: 8,
    minVisibleTurns: 1,
    requireDetailMatch: true,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    const next = () => argv[++index] || "";
    if (item === "--debug-url") out.debugUrl = next() || out.debugUrl;
    else if (item === "--server-url") out.serverUrl = next() || out.serverUrl;
    else if (item === "--thread-id") out.threadId = next() || out.threadId;
    else if (item === "--target-turn-id") out.targetTurnId = next();
    else if (item === "--app-url") out.appUrl = next();
    else if (item === "--artifact-dir") out.artifactDir = next() || out.artifactDir;
    else if (item === "--screenshot") out.screenshot = next();
    else if (item === "--timeout-ms") out.timeoutMs = readPositiveInt(next(), out.timeoutMs);
    else if (item === "--wait-ms") out.waitMs = readPositiveInt(next(), out.waitMs);
    else if (item === "--attempts") out.attempts = readPositiveInt(next(), out.attempts);
    else if (item === "--min-visible-turns") out.minVisibleTurns = readPositiveInt(next(), out.minVisibleTurns);
    else if (item === "--allow-dom-only") out.requireDetailMatch = false;
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
    threadHash: stableTextHash(options.threadId),
    targetTurnHash: stableTextHash(options.targetTurnId),
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
    "Usage: node scripts/codex-mobile-projection-replay-visual-smoke.js [options]",
    "",
    "Uses the Home AI live debug server to compare Codex Mobile thread-detail",
    "API structure with the embedded conversation DOM. Reports only bounded",
    "counts and hashes, not message text or task-card bodies.",
    "",
    "Options:",
    "  --debug-url <url>       Live debug server, default http://127.0.0.1:19073/",
    "  --server-url <url>      Codex Mobile server, default http://127.0.0.1:8787/",
    "  --thread-id <id>        Real Codex thread id to open.",
    "  --target-turn-id <id>   Optional turn id that must be present.",
    "  --app-url <url>         Optional Home AI PWA URL to open first.",
    "  --min-visible-turns <n> Minimum DOM turn count, default 1.",
    "  --allow-dom-only        Do not fail if detail API comparison is unavailable.",
    "  --screenshot <path>     Screenshot artifact path.",
    "  --json                  Print JSON only.",
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
  const owner = `codex-mobile-projection-replay:${process.pid}`;
  const response = await postJson(options, "/api/lease", {
    owner,
    ttlMs: Math.max(120000, options.timeoutMs * 4 + options.waitMs * options.attempts + 30000),
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
  return path.join(options.artifactDir, `codex-mobile-projection-replay-${stamp}.png`);
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
  const threadId = String(arguments[0] || "");
  const targetTurnId = String(arguments[1] || "");
  const expectedClientBuildId = String(arguments[2] || "");
  const requirements = arguments[3] || {};
  const stableHash = (value) => {
    const text = String(value || "");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  };
  const countBy = (values) => {
    const out = {};
    for (const value of values || []) {
      const key = String(value || "").replace(/[^a-z0-9_.:-]/gi, "_").slice(0, 80) || "empty";
      out[key] = (out[key] || 0) + 1;
    }
    return out;
  };
  const duplicateCount = (values) => Object.values(countBy(values)).reduce((total, count) => total + Math.max(0, Number(count || 0) - 1), 0);
  const visibleItems = (turn) => (Array.isArray(turn && turn.items) ? turn.items : [])
    .filter((item) => item && item.type !== "reasoning");
  const detailThreadFrom = (payload) => {
    if (!payload || typeof payload !== "object") return null;
    if (payload.thread && typeof payload.thread === "object") return payload.thread;
    if (payload.id || Array.isArray(payload.turns)) return payload;
    return null;
  };
  const detailShape = (thread) => {
    const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
    const visibleTurns = turns.filter((turn) => visibleItems(turn).length > 0);
    const itemIds = [];
    const turnRows = visibleTurns.map((turn, index) => {
      const items = visibleItems(turn);
      const itemHashes = items.map((item) => stableHash(item && item.id || ""));
      items.forEach((item) => itemIds.push(String(item && item.id || "")));
      return {
        index,
        turnHash: stableHash(turn && turn.id || ""),
        itemCount: items.length,
        itemHashes: itemHashes.slice(0, 12),
      };
    });
    return {
      detailAvailable: Boolean(thread),
      threadHash: stableHash(thread && thread.id || threadId),
      readMode: String(thread && thread.mobileReadMode || "").replace(/[^a-z0-9_.:-]/gi, "_").slice(0, 80),
      mobileLoading: Boolean(thread && thread.mobileLoading),
      mobileLoadError: Boolean(thread && thread.mobileLoadError),
      visibleTurnCount: visibleTurns.length,
      visibleItemCount: itemIds.length,
      duplicateItemIdCount: duplicateCount(itemIds.filter(Boolean)),
      latestTurnHash: stableHash(visibleTurns[visibleTurns.length - 1] && visibleTurns[visibleTurns.length - 1].id || ""),
      turnRows: turnRows.slice(-12),
    };
  };
  const proxyPrefixFromPath = (pathname) => {
    const match = String(pathname || "").match(/^(\\/api\\/hermes-plugins\\/[^/]+\\/proxy)(?:\\/|$)/);
    return match ? match[1] : "";
  };
  const frame = document.querySelector("#codexPluginHost .embedded-plugin-frame, .embedded-plugin-frame");
  const appWindow = frame && frame.contentWindow ? frame.contentWindow : window;
  const appDocument = frame && frame.contentDocument ? frame.contentDocument : document;
  if (!appWindow || !appDocument || appDocument.readyState === "loading") {
    return { ok: false, error: "app_shell_loading", retryAfterMs: 900 };
  }
  const conversation = appDocument.getElementById("conversation");
  const openThread = () => {
    if (typeof appWindow.openExternalThreadSelection === "function") {
      appWindow.openExternalThreadSelection(threadId, { statusMessage: "Opening projection replay visual thread" }).catch(() => {});
      return "openExternalThreadSelection";
    }
    if (typeof appWindow.loadThread === "function") {
      appWindow.loadThread(threadId, { source: "projection-replay-visual-smoke" }).catch(() => {});
      return "loadThread";
    }
    return "";
  };
  const turnNodes = Array.from(appDocument.querySelectorAll(".turn[data-turn]"));
  const loadedTurnIds = turnNodes.map((node) => node.getAttribute("data-turn") || "");
  const targetPresent = targetTurnId ? loadedTurnIds.includes(targetTurnId) : loadedTurnIds.length > 0;
  if (!targetPresent && threadId) {
    const openedBy = openThread();
    return { ok: false, error: openedBy ? "thread_open_requested" : "thread_open_unavailable", openedBy, loadedTurnHashes: loadedTurnIds.slice(-12).map(stableHash), retryAfterMs: 1800 };
  }
  const clientBuildId = appWindow.__codexMobileVisualHarness && typeof appWindow.__codexMobileVisualHarness.clientBuildId === "function"
    ? String(appWindow.__codexMobileVisualHarness.clientBuildId() || "")
    : String(appWindow.CLIENT_BUILD_ID || "");
  const renderKeyNodes = Array.from(appDocument.querySelectorAll("[data-render-key]"));
  const renderKeys = renderKeyNodes.map((node) => String(node.getAttribute("data-render-key") || ""));
  const itemNodes = Array.from(appDocument.querySelectorAll(".item[data-item]"));
  const itemIds = itemNodes.map((node) => String(node.getAttribute("data-item") || ""));
  const domRows = turnNodes.map((turn, index) => {
    const items = Array.from(turn.querySelectorAll(":scope > .item[data-item]"));
    return {
      index,
      turnHash: stableHash(turn.getAttribute("data-turn") || ""),
      itemCount: items.length,
      itemHashes: items.map((item) => stableHash(item.getAttribute("data-item") || "")).slice(0, 12),
    };
  });
  const domShape = {
    turnCount: turnNodes.length,
    itemCount: itemNodes.length,
    renderKeyCount: renderKeys.length,
    duplicateRenderKeyCount: duplicateCount(renderKeys.filter(Boolean)),
    duplicateItemIdCount: duplicateCount(itemIds.filter(Boolean)),
    latestTurnHash: stableHash(loadedTurnIds[loadedTurnIds.length - 1] || ""),
    emptyStateVisible: Boolean(conversation && conversation.querySelector(".empty-state")),
    turnRows: domRows.slice(-12),
  };
  const prefix = proxyPrefixFromPath(appWindow.location && appWindow.location.pathname);
  const detailPath = (prefix || "") + "/api/threads/" + encodeURIComponent(threadId) + "?mode=recent";
  let detail = null;
  let detailError = "";
  try {
    const response = await appWindow.fetch(detailPath, {
      credentials: "include",
      headers: { "Accept": "application/json" },
    });
    if (!response.ok) {
      detailError = "detail_fetch_http_" + response.status;
    } else {
      const payload = await response.json();
      detail = detailThreadFrom(payload);
    }
  } catch (err) {
    detailError = String(err && err.name || err && err.message || "detail_fetch_failed")
      .replace(/[^a-zA-Z0-9_.:-]+/g, "_")
      .slice(0, 80) || "detail_fetch_failed";
  }
  const expected = detailShape(detail);
  const clientBuildMatches = Boolean(!expectedClientBuildId || clientBuildId === expectedClientBuildId);
  const missingDomTurnCount = Math.max(0, expected.visibleTurnCount - domShape.turnCount);
  const extraDomTurnCount = Math.max(0, domShape.turnCount - expected.visibleTurnCount);
  const missingDomItemCount = Math.max(0, expected.visibleItemCount - domShape.itemCount);
  const extraDomItemCount = Math.max(0, domShape.itemCount - expected.visibleItemCount);
  const latestMismatch = Boolean(expected.latestTurnHash && domShape.latestTurnHash && expected.latestTurnHash !== domShape.latestTurnHash);
  const comparableTurnCount = Math.min(expected.turnRows.length, domShape.turnRows.length);
  let orderMismatchCount = Math.abs(expected.turnRows.length - domShape.turnRows.length);
  for (let index = 0; index < comparableTurnCount; index += 1) {
    if (expected.turnRows[index].turnHash !== domShape.turnRows[index].turnHash) orderMismatchCount += 1;
  }
  const minVisibleTurns = Math.max(1, Number(requirements.minVisibleTurns || 1) || 1);
  const detailComparisonAvailable = Boolean(expected.detailAvailable && !detailError);
  const detailMatches = Boolean(
    !detailComparisonAvailable
    || (
      missingDomTurnCount === 0
      && missingDomItemCount === 0
      && domShape.duplicateRenderKeyCount === 0
      && domShape.duplicateItemIdCount === 0
      && !latestMismatch
      && orderMismatchCount === 0
    )
  );
  const ok = Boolean(
    conversation
    && targetPresent
    && clientBuildMatches
    && domShape.turnCount >= minVisibleTurns
    && !domShape.emptyStateVisible
    && domShape.duplicateRenderKeyCount === 0
    && domShape.duplicateItemIdCount === 0
    && (!requirements.requireDetailMatch || detailComparisonAvailable)
    && detailMatches
  );
  return {
    ok,
    error: "",
    routeKind: frame ? "home-ai-embedded-plugin" : "direct-app",
    clientBuildId,
    clientBuildMatches,
    loadedTurnHashes: loadedTurnIds.slice(-12).map(stableHash),
    targetTurnHash: stableHash(targetTurnId),
    targetPresent,
    detailComparisonAvailable,
    detailError,
    expected,
    domShape,
    mismatchCounts: {
      missingDomTurnCount,
      extraDomTurnCount,
      missingDomItemCount,
      extraDomItemCount,
      latestMismatchCount: latestMismatch ? 1 : 0,
      orderMismatchCount,
    },
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
    const requirements = {
      minVisibleTurns: Number(options.minVisibleTurns || 1),
      requireDetailMatch: Boolean(options.requireDetailMatch),
    };
    for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
      const metrics = await postAction(options, {
        type: "js",
        script: MEASURE_SCRIPT,
        args: [options.threadId, options.targetTurnId, config.clientBuildId, requirements],
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
    const report = { ok: false, errorCode: safeErrorCode(err, "projection_replay_visual_smoke_failed") };
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
