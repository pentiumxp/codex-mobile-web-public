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
    timeoutMs: 15000,
    waitMs: 1600,
    attempts: 8,
    requireUpload: false,
    requireGenerated: false,
    requireProxySafe: true,
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
    else if (item === "--require-upload") out.requireUpload = true;
    else if (item === "--require-generated") out.requireGenerated = true;
    else if (item === "--allow-direct-api-in-proxy-embed") out.requireProxySafe = false;
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

function imageRouteKind(value) {
  const text = String(value || "").trim();
  if (!text) return "empty";
  if (/^(?:[a-zA-Z]:[\\/]|\\\\|\/Users\/|\/private\/|\/Volumes\/)/.test(text)) return "local-path-leak";
  if (/(?:%2FUsers%2F|\/Users\/|\.codex-mobile-web|[?&]path=)/i.test(text)) return "local-path-leak";
  if (/^data:image\/gif;base64,R0lGODlhAQABAIAAAAAAAP\/\/\/ywAAAAAAQABAAACAUwAOw==/i.test(text)) return "protected-placeholder";
  if (/^data:image\//i.test(text)) return "data-image";
  if (/^blob:/i.test(text)) return "blob";
  let parsed = null;
  try {
    parsed = new URL(text, "http://127.0.0.1");
  } catch (_) {
    parsed = null;
  }
  const pathname = parsed ? parsed.pathname : text.split("?")[0];
  if (/\/api\/hermes-plugins\/[^/]+\/proxy\/api\/generated-images\/file$/.test(pathname)) return "hermes-proxy-generated-image";
  if (/\/api\/hermes-plugins\/[^/]+\/proxy\/api\/uploads\/file$/.test(pathname)) return "hermes-proxy-upload";
  if (/\/api\/hermes-plugins\/[^/]+\/proxy\/api\/files\/preview\/content$/.test(pathname)) return "hermes-proxy-file-preview";
  if (pathname === "/api/generated-images/file") return "generated-image";
  if (pathname === "/api/uploads/file") return "upload";
  if (pathname === "/api/files/preview/content") return "file-preview";
  return "other";
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
    "Usage: node scripts/codex-mobile-media-render-visual-smoke.js [options]",
    "",
    "Uses the Home AI live debug server to open Codex Mobile and inspect embedded",
    "image rendering surfaces without exposing raw image URLs, paths, or text.",
    "",
    "Options:",
    "  --debug-url <url>       Live debug server, default http://127.0.0.1:19073/",
    "  --server-url <url>      Codex Mobile server, default http://127.0.0.1:8787/",
    "  --thread-id <id>        Real Codex thread id to open.",
    "  --target-turn-id <id>   Optional turn id that must be present.",
    "  --app-url <url>         Optional Home AI PWA URL to open first.",
    "  --require-upload        Require at least one upload image surface.",
    "  --require-generated     Require at least one generated-image surface.",
    "  --allow-direct-api-in-proxy-embed  Do not fail direct /api media in proxy embed.",
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
  const owner = `codex-mobile-media-render:${process.pid}`;
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
  return path.join(options.artifactDir, `codex-mobile-media-render-${stamp}.png`);
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
  const routeKind = (value) => {
    const text = String(value || "").trim();
    if (!text) return "empty";
    if (/^(?:[a-zA-Z]:[\\\\/]|\\\\\\\\|\\/Users\\/|\\/private\\/|\\/Volumes\\/)/.test(text)) return "local-path-leak";
    if (/(?:%2FUsers%2F|\\/Users\\/|\\.codex-mobile-web|[?&]path=)/i.test(text)) return "local-path-leak";
    if (/^data:image\\/gif;base64,R0lGODlhAQABAIAAAAAAAP\\/\\/\\/ywAAAAAAQABAAACAUwAOw==/i.test(text)) return "protected-placeholder";
    if (/^data:image\\//i.test(text)) return "data-image";
    if (/^blob:/i.test(text)) return "blob";
    let parsed = null;
    try { parsed = new URL(text, "http://127.0.0.1"); } catch (_) { parsed = null; }
    const pathname = parsed ? parsed.pathname : text.split("?")[0];
    if (/\\/api\\/hermes-plugins\\/[^/]+\\/proxy\\/api\\/generated-images\\/file$/.test(pathname)) return "hermes-proxy-generated-image";
    if (/\\/api\\/hermes-plugins\\/[^/]+\\/proxy\\/api\\/uploads\\/file$/.test(pathname)) return "hermes-proxy-upload";
    if (/\\/api\\/hermes-plugins\\/[^/]+\\/proxy\\/api\\/files\\/preview\\/content$/.test(pathname)) return "hermes-proxy-file-preview";
    if (pathname === "/api/generated-images/file") return "generated-image";
    if (pathname === "/api/uploads/file") return "upload";
    if (pathname === "/api/files/preview/content") return "file-preview";
    return "other";
  };
  const addCount = (map, key) => {
    const safeKey = String(key || "empty").replace(/[^a-z0-9_-]/gi, "_").slice(0, 80) || "empty";
    map[safeKey] = (map[safeKey] || 0) + 1;
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
      appWindow.openExternalThreadSelection(threadId, { statusMessage: "Opening media render visual thread" }).catch(() => {});
      return "openExternalThreadSelection";
    }
    if (typeof appWindow.loadThread === "function") {
      appWindow.loadThread(threadId, { source: "media-render-visual-smoke" }).catch(() => {});
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
  const rect = (node) => {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) };
  };
  const isProxyEmbed = Boolean(appWindow.location && /\\/api\\/hermes-plugins\\/[^/]+\\/proxy\\//.test(String(appWindow.location.pathname || "")));
  const clientBuildId = appWindow.__codexMobileVisualHarness && typeof appWindow.__codexMobileVisualHarness.clientBuildId === "function"
    ? String(appWindow.__codexMobileVisualHarness.clientBuildId() || "")
    : String(appWindow.CLIENT_BUILD_ID || "");
  const figureNodes = Array.from(appDocument.querySelectorAll(".input-image, .image-view, .markdown-image, .file-preview-media"));
  const routeCounts = {};
  const rows = figureNodes.map((figure, index) => {
    const image = figure.querySelector("img");
    const turn = figure.closest(".turn[data-turn]");
    const item = figure.closest(".item[data-item]");
    const className = String(figure.className || "")
      .split(/\\s+/)
      .filter(Boolean)
      .slice(0, 8)
      .join(" ");
    const kind = figure.classList.contains("input-image")
      ? "input-image"
      : figure.classList.contains("image-view")
        ? "image-view"
        : figure.classList.contains("markdown-image")
          ? "markdown-image"
          : figure.classList.contains("file-preview-media")
            ? "file-preview-media"
            : "unknown";
    const displayValue = image ? String(image.currentSrc || image.getAttribute("src") || "") : "";
    const protectedValue = image && image.dataset ? String(image.dataset.protectedImageSrc || "") : "";
    const displayRouteKind = routeKind(displayValue);
    const protectedRouteKind = routeKind(protectedValue);
    addCount(routeCounts, displayRouteKind);
    if (protectedRouteKind && protectedRouteKind !== "empty") addCount(routeCounts, protectedRouteKind);
    const figureRect = rect(figure);
    const imageRect = rect(image);
    const failed = figure.classList.contains("image-load-failed") || Boolean(image && image.classList && image.classList.contains("image-load-failed"));
    const retrying = figure.classList.contains("image-load-retrying") || Boolean(image && image.classList && image.classList.contains("image-load-retrying"));
    const naturalWidth = image ? Number(image.naturalWidth || 0) : 0;
    const naturalHeight = image ? Number(image.naturalHeight || 0) : 0;
    const loaded = Boolean(image && image.complete && naturalWidth > 1 && naturalHeight > 1 && !failed && image.getAttribute("aria-hidden") !== "true");
    const visible = Boolean(figureRect && figureRect.width > 1 && figureRect.height > 1);
    const localPathLeak = displayRouteKind === "local-path-leak" || protectedRouteKind === "local-path-leak";
    const directApiInProxyEmbed = isProxyEmbed && (
      displayRouteKind === "generated-image"
      || displayRouteKind === "upload"
      || displayRouteKind === "file-preview"
      || protectedRouteKind === "generated-image"
      || protectedRouteKind === "upload"
      || protectedRouteKind === "file-preview"
    );
    return {
      index,
      turnHash: stableHash(turn && turn.getAttribute("data-turn") || ""),
      itemHash: stableHash(item && item.getAttribute("data-item") || ""),
      sourceHash: stableHash([displayValue, protectedValue].filter(Boolean).join("|")),
      kind,
      className,
      displayRouteKind,
      protectedRouteKind,
      visible,
      loaded,
      failed,
      retrying,
      hasImage: Boolean(image),
      hasProtectedSource: Boolean(protectedValue),
      naturalWidth,
      naturalHeight,
      complete: Boolean(image && image.complete),
      localPathLeak,
      directApiInProxyEmbed,
      rect: figureRect,
      imageRect,
    };
  });
  const uploadCount = rows.filter((row) => ["upload", "hermes-proxy-upload", "data-image", "blob"].includes(row.displayRouteKind) || ["upload", "hermes-proxy-upload"].includes(row.protectedRouteKind)).length;
  const generatedCount = rows.filter((row) => ["generated-image", "hermes-proxy-generated-image"].includes(row.displayRouteKind) || ["generated-image", "hermes-proxy-generated-image"].includes(row.protectedRouteKind)).length;
  const failedCount = rows.filter((row) => row.failed).length;
  const loadedCount = rows.filter((row) => row.loaded).length;
  const visibleCount = rows.filter((row) => row.visible).length;
  const localPathLeakCount = rows.filter((row) => row.localPathLeak).length;
  const proxyUnsafeCount = rows.filter((row) => row.directApiInProxyEmbed).length;
  const missingImageCount = rows.filter((row) => !row.hasImage && !row.failed).length;
  const clientBuildMatches = Boolean(!expectedClientBuildId || clientBuildId === expectedClientBuildId);
  const ok = Boolean(
    conversation
    && targetPresent
    && clientBuildMatches
    && rows.length > 0
    && visibleCount > 0
    && loadedCount > 0
    && failedCount === 0
    && missingImageCount === 0
    && localPathLeakCount === 0
    && (!requirements.requireProxySafe || proxyUnsafeCount === 0)
    && (!requirements.requireUpload || uploadCount > 0)
    && (!requirements.requireGenerated || generatedCount > 0)
  );
  return {
    ok,
    error: "",
    routeKind: frame ? "home-ai-embedded-plugin" : "direct-app",
    isProxyEmbed,
    clientBuildId,
    clientBuildMatches,
    loadedTurnHashes: loadedTurnIds.slice(-12).map(stableHash),
    targetTurnHash: stableHash(targetTurnId),
    targetPresent,
    turnCount: turnNodes.length,
    imageSurfaceCount: rows.length,
    uploadCount,
    generatedCount,
    loadedCount,
    visibleCount,
    failedCount,
    retryingCount: rows.filter((row) => row.retrying).length,
    missingImageCount,
    localPathLeakCount,
    proxyUnsafeCount,
    routeCounts,
    sampleRows: rows.slice(-12),
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
      requireUpload: Boolean(options.requireUpload),
      requireGenerated: Boolean(options.requireGenerated),
      requireProxySafe: Boolean(options.requireProxySafe),
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
    const report = { ok: false, errorCode: safeErrorCode(err, "media_render_visual_smoke_failed") };
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  run,
  createInitialReport,
  endpointKind,
  imageRouteKind,
  safeErrorCode,
  safeScreenshotResult,
  stableTextHash,
  MEASURE_SCRIPT,
};
