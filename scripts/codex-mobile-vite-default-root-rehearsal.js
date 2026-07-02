#!/usr/bin/env node
"use strict";

const http = require("node:http");
const path = require("node:path");

const {
  createStaticFileService,
  DEFAULT_SHELL_MODE_VITE_APP_PREVIEW,
} = require("../adapters/static-file-service");
const { createServerRuntimeUtils } = require("../services/runtime/server-runtime-utils");
const browserSelfCheck = require("./codex-mobile-browser-runtime-self-check");

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_BROWSER_TIMEOUT_MS = 20000;

function usage() {
  return [
    "Usage:",
    "  node scripts/codex-mobile-vite-default-root-rehearsal.js [options]",
    "",
    "Starts a temporary static/API rehearsal server with",
    "CODEX_MOBILE_DEFAULT_SHELL=vite-app-preview semantics, then runs the",
    "existing browser default-root app-preview startup probe against plain /.",
    "",
    "Options:",
    "  --host <host>              Rehearsal host. Default: 127.0.0.1",
    "  --port <n>                 Rehearsal port. Default: 0 (random)",
    "  --app-root <path>          App root. Default: repository root",
    "  --browser-timeout-ms <n>   Browser probe timeout. Default: 20000",
    "  --skip-browser             Start/read back the rehearsal server only",
    "  --json                     Print JSON result",
    "  --help                     Show this help.",
  ].join("\n");
}

function positiveInt(value, fallback, max = 2147483647) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.min(max, Math.trunc(number));
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    host: DEFAULT_HOST,
    port: 0,
    appRoot: path.resolve(__dirname, ".."),
    browserTimeoutMs: DEFAULT_BROWSER_TIMEOUT_MS,
    skipBrowser: false,
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
    else if (arg === "--host") options.host = String(next() || DEFAULT_HOST).trim() || DEFAULT_HOST;
    else if (arg === "--port") options.port = positiveInt(next(), options.port, 65535);
    else if (arg === "--app-root") options.appRoot = path.resolve(next());
    else if (arg === "--browser-timeout-ms") options.browserTimeoutMs = positiveInt(next(), options.browserTimeoutMs, 120000);
    else if (arg === "--skip-browser") options.skipBrowser = true;
    else if (arg === "--json") options.json = true;
    else throw new Error(`unknown option: ${arg}`);
  }
  return options;
}

function readPackageVersion(appRoot) {
  try {
    const pkg = require(path.join(appRoot, "package.json"));
    return String(pkg.version || "0.0.0");
  } catch (_) {
    return "0.0.0";
  }
}

function mimeFor(filePath) {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json" || ext === ".webmanifest") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".ico") return "image/x-icon";
  return "application/octet-stream";
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    "Cache-Control": "no-store",
  });
  res.end(text);
}

function createViteDefaultRootRehearsalService(options = {}) {
  const appRoot = path.resolve(options.appRoot || path.join(__dirname, ".."));
  const publicRoot = path.join(appRoot, "public");
  const version = readPackageVersion(appRoot);
  const runtimeUtils = createServerRuntimeUtils({
    appRoot,
    publicRoot,
    getAppVersion: () => version,
  });
  const buildConfig = runtimeUtils.currentPublicBuildConfig();
  const publicConfig = Object.freeze({
    version,
    buildId: buildConfig.buildId,
    clientBuildId: buildConfig.clientBuildId,
    shellCacheName: buildConfig.shellCacheName,
    defaultShellMode: DEFAULT_SHELL_MODE_VITE_APP_PREVIEW,
    authRequired: false,
  });
  const staticFileService = createStaticFileService({
    publicRoot,
    mimeFor,
    defaultShellMode: DEFAULT_SHELL_MODE_VITE_APP_PREVIEW,
    frameAncestorsHeader: () => "'self'",
  });
  const eventClients = new Set();

  function handleEvents(_req, res) {
    eventClients.add(res);
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("event: ready\ndata: {}\n\n");
    res.on("close", () => eventClients.delete(res));
  }

  function closeEventClients() {
    for (const res of Array.from(eventClients)) {
      eventClients.delete(res);
      try {
        res.end();
      } catch (_) {}
    }
  }

  function handleRequest(req, res) {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && url.pathname === "/api/public-config") {
      sendJson(res, 200, publicConfig);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/status") {
      sendJson(res, 200, { ok: true, ready: true, defaultShellMode: publicConfig.defaultShellMode });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/threads") {
      sendJson(res, 200, { ok: true, data: [] });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/events") {
      handleEvents(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/client-events") {
      req.resume();
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.method === "GET" || req.method === "HEAD") {
      staticFileService.serveStatic(req, res);
      return;
    }
    sendJson(res, 405, { ok: false, error: "method_not_allowed" });
  }

  return {
    closeEventClients,
    handleRequest,
    publicConfig,
  };
}

function listen(server, host, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      const address = server.address();
      resolve({
        host: address && address.address || host,
        port: address && address.port || port,
      });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    try {
      server.close(() => resolve());
    } catch (_) {
      resolve();
    }
  });
}

function issueCodes(report = {}) {
  const browserReport = report.browserReport || {};
  const issues = Array.isArray(browserReport.issues) ? browserReport.issues : [];
  return issues
    .map((issue) => String(issue && issue.code || "").slice(0, 120))
    .filter(Boolean);
}

function boundedBrowserSummary(report = {}) {
  const browserReport = report.browserReport || {};
  const appPreview = report.viteAppPreview || {};
  return {
    ok: report.ok === true,
    mode: String(report.mode || "").slice(0, 80),
    issueCount: Number(browserReport.issueCount || 0) || 0,
    blockingIssueCount: Number(browserReport.blockingIssueCount || 0) || 0,
    issueCodes: issueCodes(report),
    path: String(appPreview.path || "").slice(0, 80),
    rootPathPreserved: appPreview.rootPathPreserved === true,
    rootViteShellParamAbsent: appPreview.rootViteShellParamAbsent === true,
    loaderPlanPresent: appPreview.loaderPlanPresent === true,
    loaderPlanOwner: String(appPreview.loaderPlanOwner || "").slice(0, 80),
    loaderPlanMatchesShellScripts: appPreview.loaderPlanMatchesShellScripts === true,
    loaderLoadedCount: Number(appPreview.loaderLoadedCount || 0) || 0,
    loaderFailedCount: Number(appPreview.loaderFailedCount || 0) || 0,
    appVisible: appPreview.appVisible === true,
    runtimeReady: appPreview.composerRuntimeReady === true
      && appPreview.threadListRuntimeReady === true
      && appPreview.threadTileRuntimeReady === true
      && appPreview.loadThreadReady === true,
  };
}

async function runRehearsal(options = {}, deps = {}) {
  const startedAt = new Date().toISOString();
  const service = createViteDefaultRootRehearsalService(options);
  const server = http.createServer(service.handleRequest);
  let address = null;
  let browserReport = null;
  try {
    address = await listen(server, options.host || DEFAULT_HOST, positiveInt(options.port, 0, 65535));
    const baseUrl = `http://${address.host}:${address.port}/`;
    if (!options.skipBrowser) {
      const runBrowser = deps.runBrowserSelfCheck || browserSelfCheck.run;
      const browserOptions = browserSelfCheck.parseArgs([
        "--server",
        baseUrl,
        "--vite-app-preview-only",
        "--vite-app-preview-default-root",
        "--timeout-ms",
        String(positiveInt(options.browserTimeoutMs, DEFAULT_BROWSER_TIMEOUT_MS, 120000)),
        "--json",
      ]);
      browserReport = await runBrowser(browserOptions, { key: "" });
    }
    const browser = browserReport ? boundedBrowserSummary(browserReport) : null;
    const summary = browser ? {
      issueCount: browser.issueCount,
      blockingIssueCount: browser.blockingIssueCount,
      issues: browser.issueCodes.map((code) => ({
        severity: "H2",
        code,
        surface: "browser-runtime",
      })),
    } : {
      issueCount: 0,
      blockingIssueCount: 0,
      issues: [],
    };
    return {
      ok: options.skipBrowser ? true : Boolean(browser && browser.ok),
      mode: "vite-default-root-rehearsal",
      privacy: "metadata_only",
      startedAt,
      completedAt: new Date().toISOString(),
      server: {
        host: address.host,
        port: address.port,
        defaultShellMode: service.publicConfig.defaultShellMode,
      },
      publicConfig: service.publicConfig,
      summary,
      browser,
    };
  } finally {
    service.closeEventClients();
    await closeServer(server);
  }
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const result = await runRehearsal(options);
  if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else process.stdout.write(`${result.ok ? "ok" : "failed"}\n`);
  if (!result.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${String(error && error.message || "vite_default_root_rehearsal_failed").slice(0, 200)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  createViteDefaultRootRehearsalService,
  parseArgs,
  runRehearsal,
  usage,
};
