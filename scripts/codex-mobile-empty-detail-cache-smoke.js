"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_DEBUG_URL = "http://127.0.0.1:19073/";
const DEFAULT_THREAD_ID = "019ef42b-2cb8-7332-ab17-033ec5b48947";
const DEFAULT_ARTIFACT_DIR = path.join(process.env.HOME || "/tmp", ".homeai-qa", "artifacts");

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    debugUrl: DEFAULT_DEBUG_URL,
    threadId: DEFAULT_THREAD_ID,
    appUrl: "",
    artifactDir: DEFAULT_ARTIFACT_DIR,
    screenshot: "",
    timeoutMs: 20000,
    waitMs: 1800,
    attempts: 10,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    const next = () => argv[++index] || "";
    if (item === "--debug-url") out.debugUrl = next() || out.debugUrl;
    else if (item === "--thread-id") out.threadId = next() || out.threadId;
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

function printHelp() {
  console.log([
    "Usage: node scripts/codex-mobile-empty-detail-cache-smoke.js [options]",
    "",
    "Uses the Home AI iOS/PWA live debug server to replay the Codex Mobile",
    "empty cached-current detail failure. The plugin iframe seeds an empty",
    "loaded current detail, opens the same thread through the real loadThread",
    "path, and asserts that the DOM reaches nonempty detail instead of staying",
    "on 'No visible turns.'.",
    "",
    "Options:",
    "  --debug-url <url>    Live debug server, default http://127.0.0.1:19073/",
    "  --thread-id <id>     Real nonempty Codex thread id to open.",
    "  --app-url <url>      Optional Home AI PWA URL to open first.",
    "  --screenshot <path>  Screenshot artifact path.",
    "  --json               Print JSON only.",
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
    if (!response.ok) {
      const error = parsed && (parsed.error || parsed.message) || response.statusText || "request_failed";
      throw new Error(`${response.status}:${String(error).slice(0, 300)}`);
    }
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
  const owner = `codex-mobile-empty-detail-cache:${process.pid}`;
  const response = await postJson(options, "/api/lease", {
    owner,
    ttlMs: Math.max(120000, options.timeoutMs * 4 + options.waitMs * options.attempts + 30000),
  });
  if (!response.ok || !response.token) throw new Error(`debug_lane_lease_failed:${response.error || "missing_token"}`);
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
  if (!response.ok) throw new Error(`action_failed:${response.error || "unknown"}`);
  return response.value;
}

function defaultScreenshotPath(options) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
  return path.join(options.artifactDir, `codex-mobile-empty-detail-cache-${stamp}.png`);
}

async function saveScreenshot(options) {
  const screenshotPath = options.screenshot || defaultScreenshotPath(options);
  const url = `${apiUrl(options, "/api/screenshot?force=1")}&leaseToken=${encodeURIComponent(options.leaseToken || "")}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`screenshot_failed:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
  fs.writeFileSync(screenshotPath, bytes);
  return { path: screenshotPath, bytes: bytes.length };
}

const MEASURE_SCRIPT = `
  const threadId = String(arguments[0] || "");
  const frame = document.querySelector("#codexPluginHost .embedded-plugin-frame, .embedded-plugin-frame");
  if (!frame) return { ok: false, error: "plugin_frame_missing", retryAfterMs: 900 };
  const win = frame.contentWindow;
  const doc = frame.contentDocument || (win && win.document);
  if (!win || !doc || doc.readyState === "loading") return { ok: false, error: "plugin_frame_loading", retryAfterMs: 900 };
  const harness = win.__codexMobileVisualHarness;
  if (!harness || typeof harness.simulateEmptyCachedDetailOpen !== "function") {
    return { ok: false, error: "visual_harness_unavailable", retryAfterMs: 900 };
  }
  const key = "__codexMobileEmptyDetailCacheSmoke";
  const existing = win[key];
  if (!existing || existing.threadId !== threadId) {
    win[key] = { threadId, status: "running", startedAt: Date.now(), result: null, error: "" };
    Promise.resolve(harness.simulateEmptyCachedDetailOpen(threadId)).then((result) => {
      win[key] = { threadId, status: "done", startedAt: win[key] && win[key].startedAt || Date.now(), result, error: "" };
    }).catch((err) => {
      win[key] = { threadId, status: "failed", startedAt: win[key] && win[key].startedAt || Date.now(), result: null, error: String(err && err.message || err).slice(0, 160) };
    });
    return { ok: false, error: "smoke_started", retryAfterMs: 1800 };
  }
  if (existing.status === "running") {
    return { ok: false, error: "smoke_running", elapsedMs: Date.now() - Number(existing.startedAt || Date.now()), retryAfterMs: 900 };
  }
  const conversation = doc.getElementById("conversation");
  const emptyState = conversation ? Array.from(conversation.querySelectorAll(".empty-state")).map((node) => String(node.textContent || "").trim()).join(" | ").slice(0, 120) : "";
  const turnCount = conversation ? conversation.querySelectorAll(".turn[data-turn]").length : 0;
  const itemCount = conversation ? conversation.querySelectorAll(".item[data-item]").length : 0;
  const result = existing.result || null;
  return {
    ok: Boolean(result && result.ok && turnCount > 0 && !/No visible turns\\./.test(emptyState)),
    error: existing.status === "failed" ? (existing.error || "smoke_failed") : "",
    clientBuildId: result && result.clientBuildId || "",
    thread_hash: result && result.thread_hash || "",
    before: result && result.before || null,
    after: result && result.after || null,
    dom: {
      turnCount,
      itemCount,
      emptyState,
    },
  };
`;

async function run(options) {
  const report = {
    ok: false,
    debugUrl: options.debugUrl,
    threadId: options.threadId,
    startedAt: new Date().toISOString(),
    recovery: [],
    metrics: null,
    screenshot: null,
    lease: null,
  };
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
      report.recovery.push({ action: "connect", error: String(err.message || err).slice(0, 200) });
      await postAction(options, { type: "connect", resetSession: true });
    }
    for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
      const metrics = await postAction(options, {
        type: "js",
        script: MEASURE_SCRIPT,
        args: [options.threadId],
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
    const report = { ok: false, error: String(err && err.message || err).slice(0, 500) };
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  run,
};
