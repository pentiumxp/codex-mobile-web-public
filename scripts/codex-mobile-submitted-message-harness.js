"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_SAMPLE_DELAYS_MS = [100, 350, 900, 1600, 2800, 6000];
const DEFAULT_MISSING_AFTER_MS = 900;

function parseCsvNumbers(value, fallback = []) {
  const text = String(value || "").trim();
  if (!text) return fallback.slice();
  const numbers = text
    .split(",")
    .map((part) => Number(String(part).trim()))
    .filter((number) => Number.isFinite(number) && number >= 0);
  return numbers.length ? numbers : fallback.slice();
}

function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    server: env.CODEX_MOBILE_HARNESS_SERVER || env.CODEX_MOBILE_SERVER || "http://127.0.0.1:8787",
    threadId: env.CODEX_MOBILE_SUBMITTED_HARNESS_THREAD_ID || "",
    keyFile: env.CODEX_MOBILE_KEY_FILE || path.join(process.env.HOME || "", ".codex-mobile-web", "access_key"),
    key: env.CODEX_MOBILE_KEY || "",
    entryUrl: "",
    entrySurface: "direct",
    serviceWorkers: "block",
    sampleDelaysMs: DEFAULT_SAMPLE_DELAYS_MS.slice(),
    missingAfterMs: DEFAULT_MISSING_AFTER_MS,
    repeat: 1,
    submitIntervalMs: 75,
    submitMethod: env.CODEX_MOBILE_SUBMITTED_HARNESS_SUBMIT_METHOD || "button",
    message: "",
    messagePrefix: "CM_SUBMITTED_HARNESS",
    expectBuildHash: "",
    playwrightModuleDir: env.PLAYWRIGHT_NODE_MODULE_DIR || "",
    headful: false,
    json: false,
    timeoutMs: 45_000,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "");
    const next = () => String(argv[++index] || "");
    if (arg === "--server") options.server = next();
    else if (arg === "--thread-id") options.threadId = next();
    else if (arg === "--key-file") options.keyFile = next();
    else if (arg === "--key") options.key = next();
    else if (arg === "--entry-url") options.entryUrl = next();
    else if (arg === "--entry-surface") options.entrySurface = next();
    else if (arg === "--service-workers") options.serviceWorkers = next();
    else if (arg === "--sample-delays-ms") options.sampleDelaysMs = parseCsvNumbers(next(), DEFAULT_SAMPLE_DELAYS_MS);
    else if (arg === "--missing-after-ms") options.missingAfterMs = Math.max(0, Number(next()) || DEFAULT_MISSING_AFTER_MS);
    else if (arg === "--repeat") options.repeat = Math.max(1, Math.min(5, Number(next()) || 1));
    else if (arg === "--submit-interval-ms") options.submitIntervalMs = Math.max(0, Number(next()) || 0);
    else if (arg === "--submit-method") options.submitMethod = next();
    else if (arg === "--message") options.message = next();
    else if (arg === "--message-prefix") options.messagePrefix = next();
    else if (arg === "--expect-build-hash") options.expectBuildHash = next();
    else if (arg === "--playwright-module-dir") options.playwrightModuleDir = next();
    else if (arg === "--timeout-ms") options.timeoutMs = Math.max(1000, Number(next()) || options.timeoutMs);
    else if (arg === "--headful") options.headful = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`unknown_arg:${arg}`);
  }
  options.server = normalizeServerUrl(options.server);
  options.entrySurface = ["direct", "custom"].includes(options.entrySurface) ? options.entrySurface : "direct";
  options.serviceWorkers = ["block", "allow", "both"].includes(options.serviceWorkers) ? options.serviceWorkers : "block";
  options.submitMethod = ["button", "enter", "auto"].includes(options.submitMethod) ? options.submitMethod : "button";
  options.sampleDelaysMs = Array.from(new Set(options.sampleDelaysMs)).sort((a, b) => a - b);
  return options;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/codex-mobile-submitted-message-harness.js --thread-id <id> [--server http://127.0.0.1:8787] --json",
    "",
    "Options:",
    "  --thread-id <id>              Target Codex thread id. Required unless CODEX_MOBILE_SUBMITTED_HARNESS_THREAD_ID is set.",
    "  --server <url>                Codex Mobile server. Default: http://127.0.0.1:8787.",
    "  --key-file <path>             Access key file. Default: ~/.codex-mobile-web/access_key.",
    "  --entry-url <url>             Exact browser entry URL for custom embedded/proxy checks.",
    "  --entry-surface <direct|custom>",
    "  --service-workers <block|allow|both>",
    "  --sample-delays-ms <csv>      Default: 100,350,900,1600,2800,6000.",
    "  --repeat <n>                  Submit 1-5 unique markers. Default: 1.",
    "  --submit-method <button|enter|auto> Default: button.",
    "  --expect-build-hash <hash>    Fails if the visible build label/config does not contain this hash.",
    "  --playwright-module-dir <dir> Directory used to resolve the Playwright package.",
    "  --json                        Print metadata-only JSON.",
  ].join("\n");
}

function normalizeServerUrl(value) {
  const text = String(value || "").trim() || "http://127.0.0.1:8787";
  return text.replace(/\/+$/, "");
}

function markerHash(marker) {
  return crypto.createHash("sha256").update(String(marker || "")).digest("hex").slice(0, 12);
}

function buildMarkers(options, runId = Date.now()) {
  const markers = [];
  const prefix = String(options.messagePrefix || "CM_SUBMITTED_HARNESS").replace(/\s+/g, "_").slice(0, 80);
  for (let index = 0; index < options.repeat; index += 1) {
    const marker = options.message
      ? String(options.message)
      : `${prefix}_${runId}_${index + 1} diagnostic marker`;
    markers.push({
      index: index + 1,
      marker,
      hash: markerHash(marker),
    });
  }
  return markers;
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

function safeText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(safeText).join("\n");
  if (typeof value === "object") {
    return [
      value.text,
      value.input_text,
      value.output_text,
      value.content,
      value.message,
      value.body,
    ].map(safeText).filter(Boolean).join("\n");
  }
  return "";
}

function itemLooksLikeUserMessage(item = {}) {
  const type = String(item.type || item.kind || "").toLowerCase();
  const role = String(item.role || item.author || item.source || "").toLowerCase();
  return type.includes("user") || role === "user" || role === "you";
}

function extractThreadMarkerEvidence(threadPayload, markerEntries = []) {
  const thread = threadPayload && (threadPayload.thread || threadPayload);
  const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
  const byMarker = {};
  for (const entry of markerEntries) {
    byMarker[entry.hash] = {
      markerHash: entry.hash,
      durableUserItemCount: 0,
      markerTurnCount: 0,
      userMessageAfterUsageCount: 0,
    };
  }
  for (const turn of turns) {
    const items = Array.isArray(turn && turn.items) ? turn.items : [];
    for (const entry of markerEntries) {
      const marker = entry.marker;
      const markerIndexes = [];
      const usageIndexes = [];
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index] || {};
        const text = safeText(item);
        const type = String(item.type || item.kind || "").toLowerCase();
        if (type.includes("usage")) usageIndexes.push(index);
        if (text.includes(marker) && itemLooksLikeUserMessage(item)) markerIndexes.push(index);
      }
      if (!markerIndexes.length) continue;
      byMarker[entry.hash].markerTurnCount += 1;
      byMarker[entry.hash].durableUserItemCount += markerIndexes.length;
      const firstUsage = usageIndexes.length ? Math.min(...usageIndexes) : -1;
      if (firstUsage >= 0) {
        byMarker[entry.hash].userMessageAfterUsageCount += markerIndexes.filter((index) => index > firstUsage).length;
      }
    }
  }
  return { turnCount: turns.length, byMarker };
}

function analyzeSubmittedMessageScenario(input = {}) {
  const markers = Array.isArray(input.markers) ? input.markers : [];
  const samples = Array.isArray(input.samples) ? input.samples : [];
  const reopenSamples = Array.isArray(input.reopenSamples) ? input.reopenSamples : [];
  const apiEvidence = input.apiEvidence || { byMarker: {} };
  const postCount = Number(input.postCount || 0);
  const expectedPosts = Number(input.expectedPosts || markers.length || 1);
  const missingAfterMs = Number(input.missingAfterMs || DEFAULT_MISSING_AFTER_MS);
  const expectBuildHash = String(input.expectBuildHash || "").trim();
  const buildText = String(input.buildText || "");
  const submitAttempts = Array.isArray(input.submitAttempts) ? input.submitAttempts : [];
  const issueCodes = [];
  const observations = [];

  if (postCount !== expectedPosts) issueCodes.push("message_post_count_mismatch");
  if (submitAttempts.some((attempt) => attempt && attempt.ok === false)) issueCodes.push("submit_attempt_no_post");
  if (submitAttempts.some((attempt) => attempt && attempt.composerHasMarker === false && attempt.ok === false)) {
    issueCodes.push("composer_cleared_without_post");
  }
  if (expectBuildHash && !buildText.includes(expectBuildHash)) issueCodes.push("stale_client_build");

  for (const marker of markers) {
    const hash = marker.hash || markerHash(marker.marker);
    const markerSamples = samples.map((sample) => {
      const markerSample = sample.markers && sample.markers[hash] || {};
      return Object.assign({ t: sample.t }, markerSample);
    });
    if (markerSamples.some((sample) => Number(sample.visibleUserArticleCount || 0) > 1 || Number(sample.visibleUserNodeCount || 0) > 1)) {
      issueCodes.push("visible_user_card_duplicate");
      const reopenedMarkerSamples = reopenSamples.map((sample) => {
        const markerSample = sample.markers && sample.markers[hash] || {};
        return Object.assign({ t: sample.t }, markerSample);
      });
      if (reopenedMarkerSamples.length
        && reopenedMarkerSamples.every((sample) => Number(sample.visibleUserArticleCount || 0) <= 1 && Number(sample.visibleUserNodeCount || 0) <= 1)) {
        issueCodes.push("transient_visible_user_duplicate_clears_after_reopen");
      }
    }
    if (markerSamples.some((sample) => Number(sample.dataItemCount || 0) > 1)) {
      issueCodes.push("visible_user_data_item_duplicate");
    }
    if (markerSamples.some((sample) => Number(sample.t || 0) >= missingAfterMs && Number(sample.visibleUserArticleCount || 0) < 1)) {
      issueCodes.push("visible_user_card_missing_after_settle");
    }
    if (markerSamples.some((sample) => Number(sample.composerResidualCount || 0) > 0)) {
      observations.push("composer_residual_observed");
    }
    const api = apiEvidence.byMarker && apiEvidence.byMarker[hash] || {};
    if (Number(api.durableUserItemCount || 0) > 1) issueCodes.push("durable_user_item_duplicate");
    if (Number(api.durableUserItemCount || 0) < 1) issueCodes.push("durable_user_item_missing");
    if (Number(api.userMessageAfterUsageCount || 0) > 0) issueCodes.push("durable_user_message_after_usage");
  }

  const uniqueIssues = Array.from(new Set(issueCodes));
  return {
    ok: uniqueIssues.length === 0,
    issueCodes: uniqueIssues,
    blockingIssueCount: uniqueIssues.length,
    observations: Array.from(new Set(observations)),
  };
}

async function fetchThreadDetail(options, key) {
  if (!options.threadId) return null;
  const response = await fetch(`${options.server}/api/threads/${encodeURIComponent(options.threadId)}`, {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
  });
  if (!response.ok) {
    return { ok: false, status: response.status };
  }
  return response.json();
}

function entryUrlForScenario(options, runId) {
  if (options.entryUrl) return options.entryUrl;
  const url = new URL(`${options.server}/`);
  url.searchParams.set("thread", options.threadId);
  url.searchParams.set("threadId", options.threadId);
  url.searchParams.set("submittedHarness", String(runId));
  return url.href;
}

async function sampleMarkers(page, markers, sampleDelaysMs) {
  const samples = [];
  let lastDelay = 0;
  for (const delay of sampleDelaysMs) {
    await page.waitForTimeout(Math.max(0, delay - lastDelay));
    lastDelay = delay;
    const snapshot = await collectDomSnapshot(page, markers);
    samples.push(Object.assign({ t: delay }, snapshot));
  }
  return samples;
}

async function closeNativeDialog(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.evaluate(() => {
    const dialog = document.querySelector("#appNativeDialog");
    if (!dialog || getComputedStyle(dialog).display === "none") return;
    const buttons = Array.from(dialog.querySelectorAll("button, [role=\"button\"]"));
    const close = buttons.find((button) => /^(×|close|ok|确定|取消)$/i.test((button.innerText || button.getAttribute("aria-label") || "").trim()))
      || buttons[0];
    if (close && typeof close.click === "function") close.click();
  }).catch(() => {});
}

async function installBrowserSessionKey(page, key) {
  if (!key) return;
  await page.evaluate((value) => {
    try {
      localStorage.setItem("codexMobileKey", value);
      sessionStorage.setItem("codexMobileKey", value);
    } catch (_) {}
  }, key).catch(() => {});
}

async function installBrowserThreadTarget(page, threadId) {
  const id = String(threadId || "").trim();
  if (!id) return;
  await page.evaluate((value) => {
    try {
      localStorage.setItem("codexMobileCurrentThreadId", value);
    } catch (_) {}
  }, id).catch(() => {});
}

async function ensureLoggedIn(page, key) {
  if (!key) return;
  await installBrowserSessionKey(page, key);
  if (await page.locator("#loginKey").isVisible().catch(() => false)) {
    await page.fill("#loginKey", key);
    await page.keyboard.press("Enter");
  }
}

async function waitForComposer(page, timeoutMs) {
  const composer = page.locator("#messageInput");
  await composer.waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForFunction(() => {
    const el = document.querySelector("#messageInput");
    if (!el) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || style.display === "none" || style.visibility === "hidden") return false;
    if (el.getAttribute("aria-disabled") === "true" || el.getAttribute("disabled") != null) return false;
    if (el.isContentEditable) return true;
    return String(el.getAttribute("contenteditable") || "").toLowerCase() === "true";
  }, null, { timeout: timeoutMs });
  return composer;
}

async function waitForExistingThreadPaint(page, timeoutMs) {
  await page.waitForFunction(() => Array.from(document.querySelectorAll("article")).some((el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }), null, { timeout: Math.min(Math.max(5000, timeoutMs), 20000) }).catch(() => {});
}

async function submitMarker(page, marker, options) {
  const composer = await waitForComposer(page, 15_000);
  await closeNativeDialog(page);
  await composer.click({ force: true });
  await page.keyboard.insertText(marker);
  await page.waitForFunction((expected) => {
    const el = document.querySelector("#messageInput");
    return Boolean(el && ((el.value || el.innerText || el.textContent || "").includes(expected)));
  }, marker, { timeout: 5000 });
  const waitForMessagePost = (timeout) => page.waitForRequest((request) => {
    try {
      const url = new URL(request.url());
      return request.method() === "POST" && url.pathname.endsWith(`/api/threads/${options.threadId}/messages`);
    } catch (_) {
      return false;
    }
  }, { timeout });
  const composerState = async () => page.evaluate((expected) => {
    const el = document.querySelector("#messageInput");
    const button = document.querySelector("#sendMessage");
    const state = window.CodexMobileState || {};
    const value = el ? String(el.value || el.innerText || el.textContent || "") : "";
    return {
      composerHasMarker: Boolean(value.includes(expected)),
      composerTextLength: value.length,
      composerBusy: Boolean(state.composerBusy),
      lastSendSubmitStarted: Number(state.lastSendSubmitStartedAt || 0) > 0,
      sendButtonDisabled: Boolean(button && button.disabled),
      serviceWorkerControlled: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
    };
  }, marker).catch(() => false);

  const waitPostAfter = async (action, timeoutMs) => {
    const pending = waitForMessagePost(timeoutMs).then((request) => ({
      ok: true,
      method: action,
      url: request.url(),
    })).catch((err) => ({
      ok: false,
      method: action,
      error: err && err.message ? String(err.message) : String(err || "post_not_observed"),
    }));
    if (action === "enter") {
      await page.keyboard.press("Enter");
    } else {
      const button = page.locator("#sendMessage");
      if (await button.isVisible().catch(() => false)) {
        await button.click({ force: true });
      } else {
        await page.keyboard.press("Enter");
      }
    }
    return pending;
  };

  const attempts = [];
  const firstMethod = options.submitMethod === "enter" ? "enter" : "button";
  const first = await waitPostAfter(firstMethod, 3500);
  attempts.push(Object.assign(first, await composerState()));
  if (first.ok || options.submitMethod !== "auto") {
    return {
      ok: Boolean(first.ok),
      attempts,
    };
  }
  const current = await composerState();
  if (!current.composerHasMarker) {
    attempts.push(Object.assign({
      ok: false,
      method: "fallback_skipped",
      reason: "composer_cleared_without_post",
    }, current));
    return { ok: false, attempts };
  }
  const fallbackMethod = firstMethod === "button" ? "enter" : "button";
  const fallback = await waitPostAfter(fallbackMethod, 15000);
  attempts.push(Object.assign(fallback, await composerState()));
  return {
    ok: attempts.some((attempt) => attempt.ok),
    attempts,
  };
}

async function collectDomSnapshot(page, markerEntries) {
  return page.evaluate((entries) => {
    const markerEntriesInner = entries || [];
    const escapeRe = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const visible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    };
    const visibleEditable = Array.from(document.querySelectorAll("textarea, [contenteditable=\"true\"], input"))
      .filter((el) => visible(el));
    const allArticles = Array.from(document.querySelectorAll("article")).filter((el) => visible(el));
    const manifest = window.CODEX_MOBILE_SHELL_MANIFEST && typeof window.CODEX_MOBILE_SHELL_MANIFEST === "object"
      ? window.CODEX_MOBILE_SHELL_MANIFEST
      : {};
    const buildTextParts = [
      manifest.clientBuildId,
      manifest.shellCacheName,
      ...Array.from(document.body.innerText.matchAll(/客户端 v[0-9]+(?: · [a-f0-9]+)?/g)).map((match) => match[0]).slice(0, 4),
    ].filter(Boolean);
    const result = {
      buildText: buildTextParts.join(" | "),
      articleCount: allArticles.length,
      serviceWorkerControlled: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
      markers: {},
    };
    for (const entry of markerEntriesInner) {
      const marker = entry.marker;
      const hash = entry.hash;
      const composerResidualCount = visibleEditable.filter((el) => (el.value || el.innerText || "").includes(marker)).length;
      const dataItemNodes = Array.from(document.querySelectorAll("[data-item-id]"))
        .filter((el) => visible(el) && (el.innerText || "").includes(marker));
      const markerArticles = allArticles.filter((el) => (el.innerText || "").includes(marker));
      const userNodes = Array.from(document.querySelectorAll(".userMessage, [data-author=\"user\"], [data-role=\"user\"], article.userMessage, section.userMessage"))
        .filter((el) => visible(el) && (el.innerText || "").includes(marker));
      const articleIndexes = markerArticles.map((article) => allArticles.indexOf(article)).filter((index) => index >= 0);
      const markerIndex = articleIndexes.length ? Math.min(...articleIndexes) : -1;
      const usageLikeBeforeMarker = markerIndex > 0
        ? allArticles.slice(0, markerIndex).some((article) => /usage|token|context|用量|上下文|turnUsage/i.test(`${article.className || ""}\n${article.innerText || ""}`))
        : false;
      result.markers[hash] = {
        composerResidualCount,
        dataItemCount: dataItemNodes.length,
        visibleUserArticleCount: markerArticles.length,
        visibleUserNodeCount: userNodes.length,
        markerArticleIndexes: articleIndexes.slice(0, 5),
        usageLikeBeforeMarker,
      };
    }
    return result;
  }, markerEntries.map((entry) => ({ marker: entry.marker, hash: entry.hash })));
}

async function runScenario(options, serviceWorkers) {
  if (!options.threadId) throw new Error("thread_id_required");
  const key = readAccessKey(options);
  const { chromium } = loadPlaywright(options);
  const runId = Date.now();
  const markers = buildMarkers(options, runId);
  const browser = await chromium.launch({ headless: !options.headful });
  const context = await browser.newContext({
    serviceWorkers,
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: key ? { Authorization: `Bearer ${key}` } : {},
  });
  const page = await context.newPage();
  const requestRows = [];
  page.on("request", (request) => {
    try {
      const url = new URL(request.url());
      if (url.pathname.endsWith(`/api/threads/${options.threadId}/messages`) || url.pathname.endsWith("/api/client-events")) {
        requestRows.push({ method: request.method(), path: url.pathname });
      }
    } catch (_) {}
  });
  try {
    await installBrowserThreadTarget(page, options.threadId);
    await page.goto(entryUrlForScenario(options, runId), { waitUntil: "domcontentloaded", timeout: options.timeoutMs });
    await page.waitForTimeout(500);
    await ensureLoggedIn(page, key);
    await installBrowserThreadTarget(page, options.threadId);
    await page.waitForTimeout(3000);
    await closeNativeDialog(page);
    await waitForComposer(page, options.timeoutMs);
    await waitForExistingThreadPaint(page, options.timeoutMs);
    const submitAttempts = [];
    for (let index = 0; index < markers.length; index += 1) {
      const submitResult = await submitMarker(page, markers[index].marker, options);
      submitAttempts.push({
        markerHash: markers[index].hash,
        ok: Boolean(submitResult && submitResult.ok),
        attempts: submitResult && Array.isArray(submitResult.attempts) ? submitResult.attempts : [],
      });
      if (index < markers.length - 1) await page.waitForTimeout(options.submitIntervalMs);
    }
    const samples = await sampleMarkers(page, markers, options.sampleDelaysMs);
    const reopenUrl = entryUrlForScenario(options, `${runId}-reopen`);
    await page.goto(`${reopenUrl}${reopenUrl.includes("?") ? "&" : "?"}submittedHarnessPhase=reopen`, {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs,
    });
    await page.waitForTimeout(2500);
    await ensureLoggedIn(page, key);
    await waitForExistingThreadPaint(page, options.timeoutMs);
    const reopenSamples = await sampleMarkers(page, markers, [900, 2800]);
    const detail = await fetchThreadDetail(options, key);
    const apiEvidence = detail && detail.ok === false
      ? { error: "thread_detail_read_failed", status: detail.status, byMarker: {} }
      : extractThreadMarkerEvidence(detail, markers);
    const postCount = requestRows.filter((row) => row.method === "POST" && row.path.endsWith(`/api/threads/${options.threadId}/messages`)).length;
    const buildText = samples.map((sample) => sample.buildText).filter(Boolean).join(" | ");
    const analysis = analyzeSubmittedMessageScenario({
      markers,
      samples,
      apiEvidence,
      postCount,
      expectedPosts: markers.length,
      missingAfterMs: options.missingAfterMs,
      expectBuildHash: options.expectBuildHash,
      buildText,
      reopenSamples,
      submitAttempts: submitAttempts.flatMap((entry) => entry.attempts || []),
    });
    return {
      ok: analysis.ok,
      surface: options.entrySurface,
      serviceWorkers,
      threadId: options.threadId,
      markerHashes: markers.map((entry) => entry.hash),
      submitMethod: options.submitMethod,
      submitAttempts,
      postCount,
      expectedPosts: markers.length,
      sampleDelaysMs: options.sampleDelaysMs.slice(),
      samples: samples.map((sample) => ({
        t: sample.t,
        buildText: sample.buildText,
        articleCount: sample.articleCount,
        serviceWorkerControlled: sample.serviceWorkerControlled,
        markers: Object.fromEntries(Object.entries(sample.markers || {}).map(([hash, value]) => [hash, value])),
      })),
      reopenSamples: reopenSamples.map((sample) => ({
        t: sample.t,
        buildText: sample.buildText,
        articleCount: sample.articleCount,
        serviceWorkerControlled: sample.serviceWorkerControlled,
        markers: Object.fromEntries(Object.entries(sample.markers || {}).map(([hash, value]) => [hash, value])),
      })),
      apiEvidence,
      analysis,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

async function runHarness(options) {
  const serviceWorkerModes = options.serviceWorkers === "both" ? ["block", "allow"] : [options.serviceWorkers];
  const scenarios = [];
  for (const mode of serviceWorkerModes) {
    scenarios.push(await runScenario(options, mode));
  }
  const issueCodes = Array.from(new Set(scenarios.flatMap((scenario) => scenario.analysis.issueCodes || [])));
  return {
    ok: scenarios.every((scenario) => scenario.ok),
    issueCodes,
    blockingIssueCount: issueCodes.length,
    server: options.server,
    entrySurface: options.entrySurface,
    threadId: options.threadId,
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
      console.log(`${result.ok ? "ok" : "failed"} submitted-message harness issueCodes=${result.issueCodes.join(",") || "[]"}`);
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
  DEFAULT_SAMPLE_DELAYS_MS,
  analyzeSubmittedMessageScenario,
  buildMarkers,
  entryUrlForScenario,
  extractThreadMarkerEvidence,
  installBrowserSessionKey,
  installBrowserThreadTarget,
  markerHash,
  parseArgs,
  runHarness,
};
