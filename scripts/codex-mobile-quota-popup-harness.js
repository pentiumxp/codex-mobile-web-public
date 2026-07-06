"use strict";

const fs = require("node:fs");
const path = require("node:path");

function normalizeServerUrl(value) {
  const text = String(value || "").trim() || "http://127.0.0.1:8787";
  return text.replace(/\/+$/, "");
}

function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    server: env.CODEX_MOBILE_HARNESS_SERVER || env.CODEX_MOBILE_SERVER || "http://127.0.0.1:8787",
    threadId: env.CODEX_MOBILE_QUOTA_HARNESS_THREAD_ID || "",
    keyFile: env.CODEX_MOBILE_KEY_FILE || path.join(process.env.HOME || "", ".codex-mobile-web", "access_key"),
    key: env.CODEX_MOBILE_KEY || "",
    entryUrl: "",
    serviceWorkers: "block",
    playwrightModuleDir: env.PLAYWRIGHT_NODE_MODULE_DIR || "",
    timeoutMs: 30_000,
    headful: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "");
    const next = () => String(argv[++index] || "");
    if (arg === "--server") options.server = next();
    else if (arg === "--thread-id") options.threadId = next();
    else if (arg === "--key-file") options.keyFile = next();
    else if (arg === "--key") options.key = next();
    else if (arg === "--entry-url") options.entryUrl = next();
    else if (arg === "--service-workers") options.serviceWorkers = next();
    else if (arg === "--playwright-module-dir") options.playwrightModuleDir = next();
    else if (arg === "--timeout-ms") options.timeoutMs = Math.max(1000, Number(next()) || options.timeoutMs);
    else if (arg === "--headful") options.headful = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`unknown_arg:${arg}`);
  }
  options.server = normalizeServerUrl(options.server);
  options.serviceWorkers = ["block", "allow", "both"].includes(options.serviceWorkers) ? options.serviceWorkers : "block";
  return options;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/codex-mobile-quota-popup-harness.js --thread-id <id> [--server http://127.0.0.1:8787] --json",
    "",
    "Options:",
    "  --thread-id <id>              Target Codex thread id. Recommended for realistic app boot.",
    "  --server <url>                Codex Mobile server. Default: http://127.0.0.1:8787.",
    "  --key-file <path>             Access key file. Default: ~/.codex-mobile-web/access_key.",
    "  --entry-url <url>             Exact browser entry URL for custom embedded/proxy checks.",
    "  --service-workers <block|allow|both>",
    "  --playwright-module-dir <dir> Directory used to resolve the Playwright package.",
    "  --json                        Print metadata-only JSON.",
  ].join("\n");
}

function readAccessKey(options) {
  if (options.key) return String(options.key).trim();
  if (!options.keyFile) return "";
  try {
    return fs.readFileSync(options.keyFile, "utf8").trim();
  } catch (_) {
    return "";
  }
}

function loadPlaywright(options = {}) {
  const candidateDirs = [
    options.playwrightModuleDir,
    process.env.PLAYWRIGHT_NODE_MODULE_DIR,
    path.join(process.cwd(), "node_modules"),
    "/Users/hermes-dev/HermesMobileDev/app/node_modules",
    "/Users/hermes-host/HermesMobile/app/node_modules",
  ].filter(Boolean);
  try {
    return require("playwright");
  } catch (_) {}
  for (const candidate of candidateDirs) {
    try {
      return require(require.resolve("playwright", { paths: [candidate] }));
    } catch (_) {}
  }
  throw new Error("playwright_module_not_found");
}

function entryUrlForScenario(options, runId = Date.now()) {
  if (options.entryUrl) return options.entryUrl;
  const url = new URL(`${options.server}/`);
  if (options.threadId) {
    url.searchParams.set("thread", options.threadId);
    url.searchParams.set("threadId", options.threadId);
  }
  url.searchParams.set("quotaHarness", String(runId));
  return url.href;
}

async function installBrowserSession(page, key, threadId) {
  await page.evaluate(({ accessKey, targetThreadId }) => {
    try {
      if (accessKey) {
        localStorage.setItem("codexMobileKey", accessKey);
        sessionStorage.setItem("codexMobileKey", accessKey);
      }
      if (targetThreadId) {
        localStorage.setItem("codexMobileCurrentThreadId", targetThreadId);
      }
    } catch (_) {}
  }, {
    accessKey: String(key || ""),
    targetThreadId: String(threadId || ""),
  }).catch(() => {});
}

async function closeNativeDialog(page) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await page.keyboard.press("Escape").catch(() => {});
    const closed = await page.evaluate(() => {
      const dialog = document.querySelector("#appNativeDialog");
      if (!dialog || dialog.hidden || getComputedStyle(dialog).display === "none") return true;
      const buttons = Array.from(dialog.querySelectorAll("button, [role=\"button\"]"));
      const close = buttons.find((button) => /^(×|close|ok|确定|取消|继续|知道了|稍后)$/i.test((button.innerText || button.getAttribute("aria-label") || "").trim()))
        || buttons[0];
      if (close && typeof close.click === "function") close.click();
      return false;
    }).catch(() => true);
    if (closed) return;
    await page.waitForTimeout(300);
  }
}

function analyzeQuotaPopupScenario(snapshot = {}) {
  const before = snapshot.before || {};
  const after = snapshot.after || {};
  const issueCodes = [];
  if (before.runtimeToggleType !== "function") issueCodes.push("quota_bridge_toggle_missing");
  if (before.runtimeCloseType !== "function") issueCodes.push("quota_bridge_close_missing");
  if (!before.buttonVisible) issueCodes.push("quota_button_missing");
  if (after.ariaExpanded !== "true") issueCodes.push("quota_button_not_expanded");
  if (after.panelHidden !== false || !after.panelVisible) issueCodes.push("quota_panel_not_open");
  const panelText = String(after.panelText || "");
  if (!panelText.includes("额度") || !panelText.includes("5小时额度") || !panelText.includes("周额度")) {
    issueCodes.push("quota_panel_content_missing");
  }
  const uniqueIssues = Array.from(new Set(issueCodes));
  return {
    ok: uniqueIssues.length === 0,
    issueCodes: uniqueIssues,
    blockingIssueCount: uniqueIssues.length,
  };
}

async function collectQuotaSnapshot(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    };
    let bridgeRuntime = null;
    try {
      const factory = window.CodexComposerBridgeRuntime && window.CodexComposerBridgeRuntime.createComposerBridgeRuntime;
      bridgeRuntime = typeof factory === "function" ? factory() : null;
    } catch (_) {
      bridgeRuntime = null;
    }
    const button = document.querySelector("#quotaUsage");
    const panel = document.querySelector("#quotaDetailPanel");
    const manifest = window.CODEX_MOBILE_SHELL_MANIFEST && typeof window.CODEX_MOBILE_SHELL_MANIFEST === "object"
      ? window.CODEX_MOBILE_SHELL_MANIFEST
      : {};
    return {
      buildText: [manifest.clientBuildId, manifest.shellCacheName].filter(Boolean).join(" | "),
      runtimeToggleType: typeof (bridgeRuntime && bridgeRuntime.toggleQuotaDetails),
      runtimeCloseType: typeof (bridgeRuntime && bridgeRuntime.closeQuotaDetails),
      buttonVisible: visible(button),
      buttonText: button ? String(button.innerText || "") : "",
      ariaExpanded: button ? button.getAttribute("aria-expanded") : null,
      panelHidden: panel ? Boolean(panel.hidden) : null,
      panelVisible: visible(panel),
      panelText: panel ? String(panel.innerText || "") : "",
      serviceWorkerControlled: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
    };
  });
}

async function ensureLoggedIn(page, key) {
  if (!key) return;
  await installBrowserSession(page, key, "");
  if (await page.locator("#loginKey").isVisible().catch(() => false)) {
    await page.fill("#loginKey", key);
    await page.keyboard.press("Enter");
  }
}

async function runScenario(options, serviceWorkers) {
  const key = readAccessKey(options);
  const { chromium } = loadPlaywright(options);
  const browser = await chromium.launch({ headless: !options.headful });
  const context = await browser.newContext({
    serviceWorkers,
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: key ? { Authorization: `Bearer ${key}` } : {},
  });
  const page = await context.newPage();
  const runId = Date.now();
  try {
    await installBrowserSession(page, key, options.threadId);
    await page.goto(entryUrlForScenario(options, runId), { waitUntil: "domcontentloaded", timeout: options.timeoutMs });
    await page.waitForTimeout(500);
    await ensureLoggedIn(page, key);
    await installBrowserSession(page, key, options.threadId);
    await closeNativeDialog(page);
    await page.waitForSelector("#quotaUsage", { state: "visible", timeout: options.timeoutMs });
    await page.waitForFunction(() => {
      const button = document.querySelector("#quotaUsage");
      const state = window.CodexMobileState;
      return Boolean(state && button && /5h|周|额度/.test(String(button.innerText || "")));
    }, null, { timeout: options.timeoutMs }).catch(() => {});
    await page.waitForFunction(() => {
      const factory = window.CodexComposerBridgeRuntime && window.CodexComposerBridgeRuntime.createComposerBridgeRuntime;
      if (typeof factory !== "function") return false;
      const runtime = factory();
      return Boolean(runtime && typeof runtime.toggleQuotaDetails === "function");
    }, null, { timeout: options.timeoutMs }).catch(() => {});
    await page.waitForTimeout(1200);
    await closeNativeDialog(page);
    const before = await collectQuotaSnapshot(page);
    await page.locator("#quotaUsage").click({ force: true });
    await page.waitForTimeout(400);
    const after = await collectQuotaSnapshot(page);
    const analysis = analyzeQuotaPopupScenario({ before, after });
    return {
      ok: analysis.ok,
      serviceWorkers,
      threadId: options.threadId || "",
      before,
      after,
      analysis,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

async function runHarness(options) {
  const modes = options.serviceWorkers === "both" ? ["block", "allow"] : [options.serviceWorkers];
  const scenarios = [];
  for (const mode of modes) {
    scenarios.push(await runScenario(options, mode));
  }
  const issueCodes = Array.from(new Set(scenarios.flatMap((scenario) => scenario.analysis.issueCodes || [])));
  return {
    ok: scenarios.every((scenario) => scenario.ok),
    issueCodes,
    blockingIssueCount: issueCodes.length,
    server: options.server,
    threadId: options.threadId || "",
    scenarios,
  };
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    console.log(usage());
    return;
  }
  try {
    const result = await runHarness(options);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`${result.ok ? "ok" : "failed"} quota-popup harness issueCodes=${result.issueCodes.join(",") || "[]"}`);
    }
    process.exitCode = result.ok ? 0 : 1;
  } catch (err) {
    const payload = { ok: false, error: err && err.message || String(err) };
    if (options.json) console.log(JSON.stringify(payload, null, 2));
    else console.error(payload.error);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeQuotaPopupScenario,
  entryUrlForScenario,
  normalizeServerUrl,
  parseArgs,
  runHarness,
};
