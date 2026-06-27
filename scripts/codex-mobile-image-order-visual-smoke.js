"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DEFAULT_DEBUG_URL = "http://127.0.0.1:19073/";
const DEFAULT_THREAD_ID = "019ea76b-d846-7892-bda0-c0fff9cf7581";
const DEFAULT_TARGET_TURN_ID = "019eaac3-0282-75d3-83cc-5d78cea5ee7e";
const DEFAULT_ARTIFACT_DIR = path.join(process.env.HOME || "/tmp", ".homeai-qa", "artifacts");

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    debugUrl: DEFAULT_DEBUG_URL,
    threadId: DEFAULT_THREAD_ID,
    targetTurnId: DEFAULT_TARGET_TURN_ID,
    appUrl: "",
    artifactDir: DEFAULT_ARTIFACT_DIR,
    screenshot: "",
    timeoutMs: 15000,
    waitMs: 1800,
    attempts: 8,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    const next = () => argv[++index] || "";
    if (item === "--debug-url") out.debugUrl = next() || out.debugUrl;
    else if (item === "--thread-id") out.threadId = next() || out.threadId;
    else if (item === "--target-turn-id") out.targetTurnId = next();
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
  out.debugUrl = normalizeBaseUrl(out.debugUrl);
  return out;
}

function readPositiveInt(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.floor(number);
}

function normalizeBaseUrl(value) {
  const url = new URL(value || DEFAULT_DEBUG_URL);
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.toString();
}

function apiUrl(options, pathname) {
  return new URL(pathname.replace(/^\//, ""), options.debugUrl).toString();
}

function stableTextHash(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function debugEndpointKind(value) {
  try {
    const url = new URL(value || DEFAULT_DEBUG_URL);
    const host = String(url.hostname || "").toLowerCase();
    if (host === "127.0.0.1" || host === "localhost" || host === "::1") return "local-debug";
    return "remote-debug";
  } catch (_) {
    return "unknown-debug";
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

function createInitialReport(options) {
  return {
    ok: false,
    debugEndpoint: debugEndpointKind(options.debugUrl),
    threadHash: stableTextHash(options.threadId),
    targetTurnHash: stableTextHash(options.targetTurnId),
    startedAt: new Date().toISOString(),
    recovery: [],
    metrics: null,
    screenshot: null,
    lease: null,
  };
}

function printHelp() {
  console.log([
    "Usage: node scripts/codex-mobile-image-order-visual-smoke.js [options]",
    "",
    "Uses the Home AI iOS PWA live debug server to open Codex Mobile and assert",
    "that thread-detail image cards are in DOM timestamp order.",
    "",
    "Options:",
    "  --debug-url <url>       Live debug server, default http://127.0.0.1:19073/",
    "  --thread-id <id>        Real Codex thread id to open.",
    "  --target-turn-id <id>   Optional turn id that must be present.",
    "  --app-url <url>         Optional Home AI PWA URL to open first.",
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
      parsed = { raw: text.slice(0, 1000) };
    }
    if (!response.ok) throw new Error(`http_${response.status}`);
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

async function postJson(options, pathname, body) {
  return fetchJson(apiUrl(options, pathname), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  }, options.timeoutMs);
}

async function acquireLease(options) {
  const owner = `codex-mobile-image-order:${process.pid}`;
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
  return path.join(options.artifactDir, `codex-mobile-image-order-${stamp}.png`);
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
  const stableHash = (value) => {
    const text = String(value || "");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  };
  const boundedClassName = (value) => String(value || "")
    .split(/\\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(" ");
  const frame = document.querySelector("#codexPluginHost .embedded-plugin-frame, .embedded-plugin-frame");
  if (!frame) return { ok: false, error: "plugin_frame_missing", retryAfterMs: 900 };
  const win = frame.contentWindow;
  const doc = frame.contentDocument || (win && win.document);
  if (!win || !doc || doc.readyState === "loading") return { ok: false, error: "plugin_frame_loading", retryAfterMs: 900 };
  const conversation = doc.getElementById("conversation");
  const openThread = () => {
    if (typeof win.openExternalThreadSelection === "function") {
      win.openExternalThreadSelection(threadId, { statusMessage: "Opening image order visual thread" }).catch(() => {});
      return "openExternalThreadSelection";
    }
    if (typeof win.loadThread === "function") {
      win.loadThread(threadId, { source: "image-order-visual-smoke" }).catch(() => {});
      return "loadThread";
    }
    return "";
  };
  const turnNodes = Array.from(doc.querySelectorAll(".turn[data-turn]"));
  const loadedTurnIds = turnNodes.map((node) => node.getAttribute("data-turn") || "");
  const targetPresent = targetTurnId ? loadedTurnIds.includes(targetTurnId) : loadedTurnIds.length > 0;
  if (!targetPresent && threadId) {
    const openedBy = openThread();
    return { ok: false, error: openedBy ? "thread_open_requested" : "thread_open_unavailable", openedBy, loadedTurnHashes: loadedTurnIds.slice(-12).map(stableHash), retryAfterMs: 1800 };
  }
  const rect = (node) => {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) };
  };
  const itemRows = [];
  const orderProblems = [];
  const turns = turnNodes
    .map((turn) => {
      const turnId = turn.getAttribute("data-turn") || "";
      const items = Array.from(turn.querySelectorAll(":scope > .item[data-item]")).map((item, index) => {
        const time = item.querySelector("time.item-timestamp");
        const datetime = time ? String(time.getAttribute("datetime") || "") : "";
        const timestampMs = Date.parse(datetime);
        const isImage = item.classList.contains("imageView") || Boolean(item.querySelector(".image-view, .input-image"));
        const row = {
          turnHash: stableHash(turnId),
          index,
          itemHash: stableHash(item.getAttribute("data-item") || ""),
          className: boundedClassName(item.className),
          isImage,
          datetime,
          timestampMs: Number.isFinite(timestampMs) ? timestampMs : null,
          rect: rect(item),
        };
        itemRows.push(row);
        return row;
      });
      let previous = -Infinity;
      let previousItemHash = "";
      for (const item of items) {
        if (Number.isFinite(item.timestampMs)) {
          if (item.timestampMs < previous) {
            orderProblems.push({
              turnHash: item.turnHash,
              itemHash: item.itemHash,
              className: item.className,
              datetime: item.datetime,
              previousItemHash,
              previous,
            });
          }
          if (item.timestampMs >= previous) {
            previous = item.timestampMs;
            previousItemHash = item.itemHash;
          }
        }
      }
      return { turnHash: stableHash(turnId), itemCount: items.length, imageCount: items.filter((item) => item.isImage).length };
    });
  const targetTurnHash = stableHash(targetTurnId);
  const targetItems = targetTurnId ? itemRows.filter((item) => item.turnHash === targetTurnHash) : itemRows;
  return {
    ok: Boolean(conversation) && targetPresent && orderProblems.length === 0 && itemRows.some((item) => item.isImage),
    error: "",
    routeKind: location.pathname ? "home-ai-debug-page" : "unknown",
    hostClientVersion: document.documentElement.getAttribute("data-client-version") || "",
    pluginClientBuildId: win.CLIENT_BUILD_ID || "",
    frame: rect(frame),
    conversation: rect(conversation),
    loadedTurnHashes: loadedTurnIds.slice(-12).map(stableHash),
    targetTurnHash,
    targetPresent,
    turnCount: turns.length,
    imageCount: itemRows.filter((item) => item.isImage).length,
    orderProblems,
    targetItems: targetItems.map((item) => ({
      index: item.index,
      itemHash: item.itemHash,
      className: item.className,
      isImage: item.isImage,
      datetime: item.datetime,
      rect: item.rect,
    })),
  };
`;

async function run(options) {
  const report = createInitialReport(options);
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
        args: [options.threadId, options.targetTurnId],
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
    const output = JSON.stringify(report, null, 2);
    console.log(output);
    if (!report.ok) process.exitCode = 1;
  }).catch((err) => {
    const report = { ok: false, errorCode: safeErrorCode(err, "image_order_visual_smoke_failed") };
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  run,
  createInitialReport,
  debugEndpointKind,
  safeErrorCode,
  safeScreenshotResult,
  stableTextHash,
  MEASURE_SCRIPT,
};
