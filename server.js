"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const net = require("node:net");
const webPush = require("web-push");

const APP_ROOT = __dirname;
const PUBLIC_ROOT = path.join(APP_ROOT, "public");
const USER_HOME = process.env.USERPROFILE || process.env.HOME || process.cwd();
const RUNTIME_ROOT = process.env.CODEX_MOBILE_RUNTIME_DIR || path.join(USER_HOME, ".codex-mobile-web");
const CODEX_HOME = process.env.CODEX_HOME || path.join(USER_HOME, ".codex");
const STATE_DB = path.join(CODEX_HOME, "state_5.sqlite");
const CODEX_EXE = process.env.CODEX_MOBILE_CODEX_EXE || "codex";
const MUX_ENDPOINT_FILE = process.env.CODEX_MOBILE_MUX_ENDPOINT_FILE || path.join(CODEX_HOME, "app-server-mux", "endpoint.json");
const EXTERNAL_APP_SERVER_WS = process.env.CODEX_MOBILE_APP_SERVER_WS || "";
const EXTERNAL_APP_SERVER_TCP = process.env.CODEX_MOBILE_APP_SERVER_TCP || "";
const REQUIRE_SHARED_APP_SERVER = /^(1|true|yes|on)$/i.test(process.env.CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER || "");
const HOST = process.env.CODEX_MOBILE_HOST || "0.0.0.0";
const PORT = Number(process.env.CODEX_MOBILE_PORT || "8787");
const DISABLE_AUTH = /^(1|true|yes|on)$/i.test(process.env.CODEX_MOBILE_DISABLE_AUTH || "");
const AUTH_KEY_FILE = process.env.CODEX_MOBILE_KEY_FILE || path.join(RUNTIME_ROOT, "access_key");
const AUTH_KEY = DISABLE_AUTH ? "" : loadAuthKey();
const PUSH_VAPID_FILE = process.env.CODEX_MOBILE_PUSH_VAPID_FILE || path.join(RUNTIME_ROOT, "web-push-vapid.json");
const PUSH_SUBSCRIPTIONS_FILE = process.env.CODEX_MOBILE_PUSH_SUBSCRIPTIONS_FILE || path.join(RUNTIME_ROOT, "web-push-subscriptions.json");
const DEFAULT_PUSH_SUBJECT = "mailto:codex-mobile-web@example.com";
const PUSH_SUBJECT = normalizePushSubject(process.env.CODEX_MOBILE_PUSH_SUBJECT || DEFAULT_PUSH_SUBJECT);
const PUSH_TTL_SECONDS = Math.max(30, Number(process.env.CODEX_MOBILE_PUSH_TTL_SECONDS || "3600"));
const MAX_TEXT_CHARS = 60000;
const MAX_JSON_BODY_BYTES = 2_000_000;
const MAX_UPLOAD_BYTES = Math.max(1, Number(process.env.CODEX_MOBILE_MAX_UPLOAD_BYTES || String(64 * 1024 * 1024)));
const MAX_UPLOAD_FILES = Math.max(1, Math.min(50, Number(process.env.CODEX_MOBILE_MAX_UPLOAD_FILES || "12")));
const UPLOAD_ROOT = process.env.CODEX_MOBILE_UPLOAD_DIR || path.join(RUNTIME_ROOT, "uploads");
const MAX_COMMAND_OUTPUT_CHARS = 8000;
const MAX_COMMAND_OUTPUT_CHARS_PER_TURN = 48000;
const MAX_STRUCTURED_CHARS = 24000;
const MAX_DELTA_CHARS = 12000;
const MAX_THREAD_TURNS = Math.max(1, Math.min(100, Number(process.env.CODEX_MOBILE_THREAD_TURNS || "12")));
const OPERATIONAL_ITEM_TYPES = new Set(["commandExecution", "fileChange", "dynamicToolCall", "mcpToolCall"]);
const MODEL_OPTIONS = optionListFromEnv("CODEX_MOBILE_MODEL_OPTIONS", [
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
  "gpt-5.3-codex-spark",
  "gpt-5.2",
]);
const REASONING_EFFORT_OPTIONS = optionListFromEnv("CODEX_MOBILE_REASONING_EFFORT_OPTIONS", [
  "low",
  "medium",
  "high",
  "xhigh",
]);
const DEFAULT_RPC_TIMEOUT_MS = 30000;
const READ_RPC_TIMEOUT_MS = 12000;
const THREAD_DETAIL_RPC_TIMEOUT_MS = Math.min(6000, READ_RPC_TIMEOUT_MS);
const MUTATION_RPC_TIMEOUT_MS = 120000;
const MESSAGE_DEDUPE_WINDOW_MS = Math.max(5_000, Number(process.env.CODEX_MOBILE_MESSAGE_DEDUPE_WINDOW_MS || "90000"));
const MESSAGE_DEDUPE_MAX = Math.max(20, Number(process.env.CODEX_MOBILE_MESSAGE_DEDUPE_MAX || "300"));
const MAX_ROLLOUT_CONTEXT_BYTES = Math.max(256 * 1024, Number(process.env.CODEX_MOBILE_ROLLOUT_CONTEXT_BYTES || String(4 * 1024 * 1024)));
const SAFE_RETRY_METHODS = new Set(["initialize", "thread/list", "thread/read", "thread/turns/list"]);
const IMAGE_EXTENSIONS = new Set([".avif", ".bmp", ".gif", ".heic", ".heif", ".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"]);
const CODEX_CONFIG_DEFAULTS = readCodexConfigDefaults();
const PROCESS_STARTED_AT_MS = Date.now();

let clients = new Set();
let clientHeartbeats = new WeakMap();
let latestRateLimits = null;
let pushVapidKeys = null;
let pushSubscriptionsCache = null;
const recentMessageSubmissions = new Map();
const pushObservedTurns = new Set();
const pushSentTurns = new Map();
const SERVER_REQUEST_METHODS = new Set([
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "item/permissions/requestApproval",
  "item/tool/requestUserInput",
  "mcpServer/elicitation/request",
  "item/tool/call",
  "account/chatgptAuthTokens/refresh",
  "execCommandApproval",
  "applyPatchApproval",
]);
const ACTIONABLE_APPROVAL_METHODS = new Set([
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "item/permissions/requestApproval",
  "execCommandApproval",
  "applyPatchApproval",
]);
const ACTIONABLE_USER_INPUT_METHODS = new Set([
  "item/tool/requestUserInput",
  "mcpServer/elicitation/request",
]);
const ACTIONABLE_SERVER_REQUEST_METHODS = new Set([
  ...ACTIONABLE_APPROVAL_METHODS,
  ...ACTIONABLE_USER_INPUT_METHODS,
]);

function optionListFromEnv(name, fallback) {
  const values = String(process.env[name] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(values.length ? values : fallback)];
}

function readCodexConfigDefaults() {
  const configPath = path.join(CODEX_HOME, "config.toml");
  try {
    const text = fs.readFileSync(configPath, "utf8");
    const model = /^\s*model\s*=\s*"([^"]+)"/m.exec(text);
    const effort = /^\s*model_reasoning_effort\s*=\s*"([^"]+)"/m.exec(text);
    const summary = /^\s*model_reasoning_summary\s*=\s*"([^"]+)"/m.exec(text);
    const verbosity = /^\s*model_verbosity\s*=\s*"([^"]+)"/m.exec(text);
    return {
      model: model ? model[1] : "",
      reasoningEffort: effort ? effort[1] : "",
      reasoningSummary: summary ? summary[1] : "",
      modelVerbosity: verbosity ? verbosity[1] : "",
    };
  } catch (_) {
    return { model: "", reasoningEffort: "", reasoningSummary: "", modelVerbosity: "" };
  }
}

function commandNeedsFilesystemCheck(command) {
  const value = String(command || "");
  return path.isAbsolute(value) || value.includes("/") || value.includes("\\");
}

function assertCommandAvailable(command, label) {
  const value = String(command || "").trim();
  if (!value) throw new Error(`${label} is not configured`);
  if (commandNeedsFilesystemCheck(value) && !fs.existsSync(value)) {
    throw new Error(`${label} not found: ${value}`);
  }
}

function loadAuthKey() {
  if (process.env.CODEX_MOBILE_KEY && process.env.CODEX_MOBILE_KEY.trim()) {
    return process.env.CODEX_MOBILE_KEY.trim();
  }
  try {
    const value = fs.readFileSync(AUTH_KEY_FILE, "utf8").trim();
    if (value) return value;
  } catch (_) {
    // Create a durable local key so reloads and server restarts do not invalidate phone sessions.
  }
  const key = crypto.randomBytes(18).toString("base64url");
  fs.mkdirSync(path.dirname(AUTH_KEY_FILE), { recursive: true });
  fs.writeFileSync(AUTH_KEY_FILE, `${key}\n`, { encoding: "utf8", mode: 0o600 });
  return key;
}

function readJsonFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return fallback;
  }
}

function writeRuntimeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function normalizePushSubject(value) {
  const subject = String(value || "").trim();
  return subject || DEFAULT_PUSH_SUBJECT;
}

function isLocalhostPushSubject(value) {
  const subject = String(value || "");
  if (/\blocalhost\b|127\.0\.0\.1|\[::1\]/i.test(subject)) return true;
  try {
    const url = new URL(subject);
    return url.hostname === "localhost"
      || url.hostname === "127.0.0.1"
      || url.hostname === "::1"
      || url.hostname.endsWith(".localhost");
  } catch (_) {
    return false;
  }
}

function storedPushSubject(existingSubject) {
  const existing = normalizePushSubject(existingSubject);
  if (process.env.CODEX_MOBILE_PUSH_SUBJECT) return PUSH_SUBJECT;
  return isLocalhostPushSubject(existing) ? PUSH_SUBJECT : existing;
}

function loadPushVapidKeys() {
  if (pushVapidKeys) return pushVapidKeys;
  const existing = readJsonFile(PUSH_VAPID_FILE, null);
  if (existing && existing.publicKey && existing.privateKey) {
    const subject = storedPushSubject(existing.subject);
    pushVapidKeys = {
      publicKey: String(existing.publicKey),
      privateKey: String(existing.privateKey),
      subject,
    };
    if (subject !== existing.subject) {
      writeRuntimeJson(PUSH_VAPID_FILE, Object.assign({}, existing, {
        subject,
        updatedAt: new Date().toISOString(),
      }));
    }
  } else {
    const generated = webPush.generateVAPIDKeys();
    pushVapidKeys = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      subject: PUSH_SUBJECT,
      createdAt: new Date().toISOString(),
    };
    writeRuntimeJson(PUSH_VAPID_FILE, pushVapidKeys);
  }
  webPush.setVapidDetails(pushVapidKeys.subject || PUSH_SUBJECT, pushVapidKeys.publicKey, pushVapidKeys.privateKey);
  return pushVapidKeys;
}

function loadPushSubscriptions() {
  if (pushSubscriptionsCache) return pushSubscriptionsCache;
  const raw = readJsonFile(PUSH_SUBSCRIPTIONS_FILE, []);
  pushSubscriptionsCache = Array.isArray(raw) ? raw.filter((entry) => entry && entry.endpoint) : [];
  return pushSubscriptionsCache;
}

function savePushSubscriptions(subscriptions = loadPushSubscriptions()) {
  pushSubscriptionsCache = subscriptions.filter((entry) => entry && entry.endpoint);
  writeRuntimeJson(PUSH_SUBSCRIPTIONS_FILE, pushSubscriptionsCache);
}

function normalizePushSubscription(value) {
  const sub = value && value.subscription ? value.subscription : value;
  if (!sub || typeof sub !== "object") throw new Error("Push subscription is required");
  if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    throw new Error("Push subscription is incomplete");
  }
  return {
    endpoint: String(sub.endpoint),
    expirationTime: sub.expirationTime || null,
    keys: {
      p256dh: String(sub.keys.p256dh),
      auth: String(sub.keys.auth),
    },
  };
}

function pushSubscriptionPublicStatus() {
  return {
    supported: true,
    subscriptionCount: loadPushSubscriptions().length,
  };
}

function prunePushSentTurns(now = Date.now()) {
  const maxAgeMs = 24 * 60 * 60 * 1000;
  for (const [key, sentAt] of pushSentTurns) {
    if (now - sentAt > maxAgeMs) pushSentTurns.delete(key);
  }
}

function pushTurnId(params) {
  return String((params && params.turn && params.turn.id) || (params && params.turnId) || "");
}

function timestampToMs(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }
  if (/^\d+(?:\.\d+)?$/.test(String(value))) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function turnTimestampMs(params, field) {
  return timestampToMs((params && params.turn && params.turn[field]) || (params && params[field]));
}

function isOldPushTurnEvent(params, fields) {
  for (const field of fields) {
    const timestamp = turnTimestampMs(params, field);
    if (timestamp) return timestamp < PROCESS_STARTED_AT_MS - 120000;
  }
  return false;
}

function notificationUrlForThread(threadId) {
  const id = String(threadId || "");
  return id ? `/?thread=${encodeURIComponent(id)}` : "/";
}

function compactOneLine(value, maxChars = 80) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 3))}...`;
}

function shortIdentifier(value) {
  const text = String(value || "").trim();
  if (text.length <= 16) return text;
  return `${text.slice(0, 8)}...${text.slice(-4)}`;
}

function pushTimestamp(ms = Date.now()) {
  const time = Number.isFinite(ms) && ms > 0 ? ms : Date.now();
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(time)).replace(/\//g, "-");
  } catch (_) {
    return new Date(time).toISOString();
  }
}

function pushThreadTitle(params) {
  const candidates = [
    params && params.threadName,
    params && params.thread && params.thread.name,
    params && params.thread && params.thread.title,
    params && params.thread && params.thread.preview,
  ];
  for (const candidate of candidates) {
    const text = compactOneLine(candidate);
    if (text) return text;
  }
  const summary = readStateDbThread(params && params.threadId);
  return compactOneLine((summary && (summary.name || summary.preview)) || shortIdentifier(params && params.threadId) || "Codex Mobile Web");
}

function webPushFailureDetails(err) {
  const statusCode = Number(err && err.statusCode) || null;
  const body = String((err && err.body) || "").trim();
  let reason = "";
  if (body) {
    try {
      const parsed = JSON.parse(body);
      reason = String(parsed.reason || parsed.error || parsed.message || "").trim();
    } catch (_) {
      reason = body.slice(0, 160);
    }
  }
  return {
    statusCode,
    reason: reason || String((err && err.message) || err || "Web Push send failed"),
  };
}

async function sendWebPushToAll(payload) {
  loadPushVapidKeys();
  const subscriptions = loadPushSubscriptions();
  if (!subscriptions.length) return { sent: 0, failed: 0, removed: 0 };
  let sent = 0;
  let failed = 0;
  let lastError = null;
  const dead = new Set();
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webPush.sendNotification(subscription, JSON.stringify(payload), {
        TTL: PUSH_TTL_SECONDS,
        urgency: "normal",
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      lastError = webPushFailureDetails(err);
      const statusCode = Number(err && err.statusCode);
      if (statusCode === 404 || statusCode === 410) dead.add(subscription.endpoint);
      else console.error(`[web push] send failed: ${lastError.statusCode || ""} ${lastError.reason}`);
    }
  }));
  if (dead.size) {
    const kept = subscriptions.filter((subscription) => !dead.has(subscription.endpoint));
    savePushSubscriptions(kept);
  }
  return Object.assign({ sent, failed, removed: dead.size }, lastError ? { lastError } : {});
}

function maybeSendTurnCompletedPush(method, params) {
  if (method === "turn/started") {
    const id = pushTurnId(params);
    if (isOldPushTurnEvent(params, ["startedAt", "createdAt"])) return;
    if (id) pushObservedTurns.add(id);
    return;
  }
  if (method !== "turn/completed") return;
  const turnId = pushTurnId(params);
  if (!turnId || !pushObservedTurns.has(turnId)) return;
  if (isOldPushTurnEvent(params, ["completedAt", "updatedAt"])) return;
  pushObservedTurns.delete(turnId);
  prunePushSentTurns();
  const key = `${params.threadId || ""}:${turnId}`;
  if (pushSentTurns.has(key)) return;
  pushSentTurns.set(key, Date.now());
  const completedAt = turnTimestampMs(params, "completedAt") || Date.now();
  const threadTitle = pushThreadTitle(params);
  const threadMark = shortIdentifier(params.threadId || turnId);
  const payload = {
    title: "Codex Mobile Web",
    body: `${threadTitle || threadMark} · This turn 已结束 · ${pushTimestamp(completedAt)}`,
    tag: `codex-turn-${params.threadId || turnId}`,
    data: {
      url: notificationUrlForThread(params.threadId),
      threadId: params.threadId || "",
      turnId,
      threadTitle,
      completedAt,
    },
  };
  sendWebPushToAll(payload).catch((err) => {
    console.error(`[web push] turn completed notification failed: ${err.message || String(err)}`);
  });
}

function timingSafeEquals(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function getUrl(req) {
  return new URL(req.url, `http://${req.headers.host || "localhost"}`);
}

function isAuthorized(req) {
  if (DISABLE_AUTH) return true;
  const url = getUrl(req);
  const key = req.headers["x-codex-mobile-key"]
    || url.searchParams.get("key")
    || parseCookies(req.headers.cookie).codex_mobile_key;
  return timingSafeEquals(key, AUTH_KEY);
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function truncateMiddle(value, maxChars, label) {
  const text = String(value ?? "");
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.42);
  const tail = maxChars - head;
  return `${text.slice(0, head)}\n\n[${label} truncated: ${text.length} chars total, showing first ${head} and last ${tail}]\n\n${text.slice(-tail)}`;
}

function truncateTail(value, maxChars, label) {
  const text = String(value ?? "");
  if (text.length <= maxChars) return text;
  return `[${label} truncated: ${text.length} chars total, showing last ${maxChars}]\n\n${text.slice(-maxChars)}`;
}

function compactStructured(value) {
  if (value == null) return value;
  let raw;
  try {
    raw = JSON.stringify(value);
  } catch (_) {
    raw = String(value);
  }
  if (raw.length <= MAX_STRUCTURED_CHARS) return value;
  return {
    truncated: true,
    totalChars: raw.length,
    preview: truncateMiddle(raw, MAX_STRUCTURED_CHARS, "structured payload"),
  };
}

function compactStringArray(values, maxChars, label) {
  if (!Array.isArray(values)) return values;
  return values.map((value) => typeof value === "string" ? truncateMiddle(value, maxChars, label) : compactStructured(value));
}

function statusText(status) {
  if (!status) return "";
  if (typeof status === "string") return status;
  return status.type || JSON.stringify(status);
}

function normalizeFsPath(value) {
  return String(value || "")
    .replace(/^\\\\\?\\/, "")
    .replace(/[\\/]+/g, "\\")
    .replace(/\\+$/, "")
    .toLowerCase();
}

function visibleWorkspaceRoots(globalState = readGlobalState()) {
  const roots = new Set();
  for (const key of ["active-workspace-roots", "electron-saved-workspace-roots", "project-order"]) {
    const values = globalState[key];
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      if (typeof value === "string" && value.trim()) roots.add(value);
    }
  }
  return roots;
}

function visibleWorkspaceKeys(globalState = readGlobalState()) {
  return new Set([...visibleWorkspaceRoots(globalState)].map(normalizeFsPath).filter(Boolean));
}

function visibleProjectlessThreadIds(globalState = readGlobalState()) {
  const ids = globalState["projectless-thread-ids"];
  return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string" && id) : []);
}

function visibilityFromGlobalState(globalState = readGlobalState()) {
  return {
    workspaceKeys: visibleWorkspaceKeys(globalState),
    projectlessThreadIds: visibleProjectlessThreadIds(globalState),
  };
}

function isHiddenThread(thread, visibility = null) {
  if (!thread || typeof thread !== "object") return true;
  const view = visibility || visibilityFromGlobalState();
  const status = statusText(thread.status).toLowerCase();
  const location = String(thread.path || thread.rolloutPath || thread.rollout_path || "").toLowerCase();
  if (thread.archived || thread.archivedAt || thread.archived_at || thread.isArchived) return true;
  if (thread.deleted || thread.deletedAt || thread.deleted_at || thread.isDeleted || thread.removed || thread.removedAt) return true;
  if (/archived|deleted|removed/.test(status)) return true;
  if (/[/\\](archived|deleted|trash|removed)[_-]?sessions[/\\]/.test(location)) return true;
  if (view.workspaceKeys && view.workspaceKeys.size > 0) {
    const cwd = normalizeFsPath(thread.cwd);
    if (cwd) return !view.workspaceKeys.has(cwd);
    return !view.projectlessThreadIds.has(thread.id);
  }
  return false;
}

function filterVisibleThreads(result, globalState = readGlobalState()) {
  const visibility = visibilityFromGlobalState(globalState);
  if (!result || typeof result !== "object") return result;
  const out = Object.assign({}, result);
  if (Array.isArray(out.data)) out.data = out.data.filter((thread) => !isHiddenThread(thread, visibility));
  if (Array.isArray(out.threads)) out.threads = out.threads.filter((thread) => !isHiddenThread(thread, visibility));
  return out;
}

function isCompletedStatus(status) {
  return /completed|failed|cancel|error|interrupted/i.test(statusText(status));
}

function isLiveTurn(turn) {
  const text = statusText(turn && turn.status).toLowerCase();
  return /(running|active|queued|processing|inprogress|in_progress|in-progress)/.test(text)
    || (text === "interrupted" && turn && !turn.completedAt && !turn.durationMs);
}

function isContextCompactionType(type) {
  return /context.*compaction|context.*compression|context_compaction|context_compression/i.test(String(type || ""));
}

function isPathLikeValue(value) {
  const text = String(value || "");
  if (!text || text.includes("\n") || text.includes("\r")) return false;
  return /^[A-Za-z]:[\\/]/.test(text)
    || /^\\\\\?\\/.test(text)
    || /^[/\\][^/\\]+/.test(text)
    || /[\\/][^/\\]+\.[A-Za-z0-9]{1,12}$/.test(text);
}

function isFileNameLikeValue(value) {
  const text = String(value || "");
  return Boolean(text && !text.includes("\n") && !text.includes("\r") && /^[^\\/]+\.[A-Za-z0-9]{1,12}$/.test(text));
}

function collectFileNames(value, out = [], keyHint = "") {
  if (out.length >= 5 || value == null) return out;
  if (typeof value === "string") {
    const keyLooksPath = /^(path|file|filepath|filename|name|target|source|uri)$/i.test(keyHint);
    if (isPathLikeValue(value) || (keyLooksPath && isFileNameLikeValue(value))) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectFileNames(entry, out, keyHint);
    return out;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (/^(path|file|filePath|filename|name|target|source|uri)$/i.test(key) && typeof entry === "string"
        && (isPathLikeValue(entry) || isFileNameLikeValue(entry))) {
        out.push(entry);
        if (out.length >= 5) return out;
        continue;
      }
      collectFileNames(entry, out, key);
      if (out.length >= 5) return out;
    }
  }
  return out;
}

function isWebSearchLikeItem(item) {
  if (!item || typeof item !== "object") return false;
  return /web[_-]?search|websearch|search_query|image_query/i.test([
    item.type,
    item.tool,
    item.name,
    item.namespace,
    item.server,
  ].filter(Boolean).join(" "));
}

function isOperationalItem(item) {
  return item && (OPERATIONAL_ITEM_TYPES.has(item.type) || isWebSearchLikeItem(item));
}

function collectSearchSummaries(value, out = [], keyHint = "") {
  if (out.length >= 3 || value == null) return out;
  const keyLooksSearch = /^(q|query|searchQuery|url|pattern)$/i.test(keyHint);
  const keyLooksQueryList = /^queries$/i.test(keyHint);
  if (typeof value === "string") {
    const text = value.replace(/\s+/g, " ").trim();
    if ((keyLooksSearch || keyLooksQueryList) && text) out.push(text);
    return out;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectSearchSummaries(entry, out, keyLooksQueryList ? "query" : keyHint);
      if (out.length >= 3) return out;
    }
    return out;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      collectSearchSummaries(entry, out, key);
      if (out.length >= 3) return out;
    }
  }
  return out;
}

function searchSummaryFromOperation(item) {
  const summaries = collectSearchSummaries(item && (item.action || item.arguments || item.result || item.contentItems || item));
  return [...new Set(summaries)].slice(0, 3).join(" | ");
}

function compactOperationalItem(out) {
  const isWebSearch = isWebSearchLikeItem(out);
  const command = typeof out.command === "string"
    ? out.command
    : (isWebSearch ? searchSummaryFromOperation(out) : undefined);
  const compact = {
    id: out.id,
    type: isWebSearch ? "dynamicToolCall" : out.type,
    status: out.status,
    server: out.server,
    namespace: out.namespace,
    tool: isWebSearch ? "Web Search" : out.tool,
    command: typeof command === "string" ? truncateMiddle(command, 180, "command") : undefined,
    fileNames: [...new Set(Array.isArray(out.fileNames) && out.fileNames.length
      ? out.fileNames
      : collectFileNames(out.changes || out.arguments || out.result || out.contentItems))].slice(0, 5),
    mobileLiveOperation: true,
  };
  return Object.fromEntries(Object.entries(compact).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined;
  }));
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch (_) {
    return null;
  }
}

function parseJsonObject(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    return null;
  }
}

function lastString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeEnumValue(value, allowed) {
  const text = String(value || "").trim();
  return allowed.has(text) ? text : "";
}

function normalizeSandboxPolicyType(type) {
  const text = String(type || "").trim();
  return {
    "danger-full-access": "dangerFullAccess",
    dangerFullAccess: "dangerFullAccess",
    "read-only": "readOnly",
    readOnly: "readOnly",
    "workspace-write": "workspaceWrite",
    workspaceWrite: "workspaceWrite",
    "external-sandbox": "externalSandbox",
    externalSandbox: "externalSandbox",
  }[text] || "";
}

function sandboxModeFromPolicy(policy) {
  const type = normalizeSandboxPolicyType(policy && policy.type);
  return {
    dangerFullAccess: "danger-full-access",
    readOnly: "read-only",
    workspaceWrite: "workspace-write",
  }[type] || "";
}

function normalizeSandboxPolicy(value) {
  const policy = parseJsonObject(value);
  if (!policy) return null;
  const type = normalizeSandboxPolicyType(policy.type);
  if (type === "dangerFullAccess") return { type };
  if (type === "readOnly") {
    return {
      type,
      networkAccess: Boolean(policy.networkAccess ?? policy.network_access),
    };
  }
  if (type === "externalSandbox") {
    return {
      type,
      networkAccess: policy.networkAccess || policy.network_access || "restricted",
    };
  }
  if (type === "workspaceWrite") {
    return {
      type,
      writableRoots: Array.isArray(policy.writableRoots) ? policy.writableRoots : (Array.isArray(policy.writable_roots) ? policy.writable_roots : []),
      networkAccess: Boolean(policy.networkAccess ?? policy.network_access),
      excludeTmpdirEnvVar: Boolean(policy.excludeTmpdirEnvVar ?? policy.exclude_tmpdir_env_var),
      excludeSlashTmp: Boolean(policy.excludeSlashTmp ?? policy.exclude_slash_tmp),
    };
  }
  return null;
}

function normalizePermissionProfile(value) {
  const profile = parseJsonObject(value);
  if (!profile) return null;
  const fileSystem = profile.fileSystem || profile.file_system || null;
  return {
    network: profile.network || null,
    fileSystem: fileSystem ? {
      entries: Array.isArray(fileSystem.entries) ? fileSystem.entries : [],
      ...(fileSystem.globScanMaxDepth || fileSystem.glob_scan_max_depth
        ? { globScanMaxDepth: fileSystem.globScanMaxDepth || fileSystem.glob_scan_max_depth }
        : {}),
    } : null,
  };
}

function isRootWritePermissionProfile(profile) {
  const entries = profile
    && profile.fileSystem
    && Array.isArray(profile.fileSystem.entries)
    ? profile.fileSystem.entries
    : [];
  return entries.some((entry) => {
    const pathValue = entry && entry.path;
    return entry
      && entry.access === "write"
      && pathValue
      && pathValue.type === "special"
      && pathValue.value
      && pathValue.value.kind === "root";
  });
}

function isFullAccessRuntime(sandboxPolicy, permissionProfile) {
  return normalizeSandboxPolicyType(sandboxPolicy && sandboxPolicy.type) === "dangerFullAccess"
    || isRootWritePermissionProfile(permissionProfile);
}

function readRolloutTail(rolloutPath) {
  if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) return "";
  let fd = null;
  try {
    const stat = fs.statSync(rolloutPath);
    const start = Math.max(0, stat.size - MAX_ROLLOUT_CONTEXT_BYTES);
    const length = stat.size - start;
    const buffer = Buffer.alloc(length);
    fd = fs.openSync(rolloutPath, "r");
    fs.readSync(fd, buffer, 0, length, start);
    return buffer.toString("utf8");
  } catch (_) {
    return "";
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (_) {}
    }
  }
}

function readLatestTurnContext(thread) {
  const rolloutPath = thread && (thread.path || thread.rolloutPath || thread.rollout_path);
  const text = readRolloutTail(rolloutPath);
  if (!text) return null;
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const entry = parseJsonLine(lines[index]);
    if (entry && entry.type === "turn_context" && entry.payload && typeof entry.payload === "object") {
      return entry.payload;
    }
  }
  return null;
}

function threadRuntimeSettings(threadId) {
  const thread = readStateDbThread(threadId);
  const context = readLatestTurnContext(thread) || {};
  const sandboxPolicy = normalizeSandboxPolicy(context.sandbox_policy || (thread && thread.sandboxPolicy));
  const permissionProfile = normalizePermissionProfile(context.permission_profile || (thread && thread.permissionProfile));
  let approvalPolicy = normalizeEnumValue(
    lastString(context.approval_policy, thread && thread.approvalPolicy),
    new Set(["untrusted", "on-request", "on-failure", "never"]),
  );
  if (isFullAccessRuntime(sandboxPolicy, permissionProfile) && (!approvalPolicy || approvalPolicy === "on-request")) {
    approvalPolicy = "never";
  }
  const reasoningSummary = normalizeEnumValue(
    lastString(context.summary, context.reasoning_summary, context.model_reasoning_summary, CODEX_CONFIG_DEFAULTS.reasoningSummary),
    new Set(["auto", "concise", "detailed", "none"]),
  );
  const modelVerbosity = normalizeEnumValue(
    lastString(context.model_verbosity, CODEX_CONFIG_DEFAULTS.modelVerbosity),
    new Set(["low", "medium", "high"]),
  );
  return {
    approvalPolicy,
    sandboxPolicy,
    sandboxMode: sandboxModeFromPolicy(sandboxPolicy),
    permissionProfile,
    reasoningSummary,
    modelVerbosity,
  };
}

function applyResumeRuntimeSettings(params, settings) {
  if (!settings) return params;
  if (settings.approvalPolicy) params.approvalPolicy = settings.approvalPolicy;
  if (settings.permissionProfile) params.permissionProfile = settings.permissionProfile;
  else if (settings.sandboxMode) params.sandbox = settings.sandboxMode;
  const config = {};
  if (settings.reasoningSummary) config.model_reasoning_summary = settings.reasoningSummary;
  if (settings.modelVerbosity) config.model_verbosity = settings.modelVerbosity;
  if (Object.keys(config).length) params.config = Object.assign({}, params.config || {}, config);
  return params;
}

function applyTurnRuntimeSettings(params, settings) {
  if (!settings) return params;
  if (settings.approvalPolicy) params.approvalPolicy = settings.approvalPolicy;
  if (settings.sandboxPolicy) params.sandboxPolicy = settings.sandboxPolicy;
  else if (settings.permissionProfile) params.permissionProfile = settings.permissionProfile;
  if (settings.reasoningSummary) params.summary = settings.reasoningSummary;
  return params;
}

function statusFromRawOperation(payload) {
  const status = String(payload.status || "").toLowerCase();
  if (status) return status;
  if (typeof payload.success === "boolean") return payload.success ? "completed" : "failed";
  if (typeof payload.exit_code === "number") return payload.exit_code === 0 ? "completed" : "failed";
  return "running";
}

function commandFromRawPayload(payload) {
  if (Array.isArray(payload.parsed_cmd) && payload.parsed_cmd[0] && payload.parsed_cmd[0].cmd) {
    return String(payload.parsed_cmd[0].cmd);
  }
  if (Array.isArray(payload.command)) return payload.command.join(" ");
  if (typeof payload.arguments === "string") {
    const parsed = parseJsonLine(payload.arguments);
    if (parsed && parsed.command) return String(parsed.command);
  }
  return "";
}

function fileNamesFromPatchInput(input) {
  const names = [];
  for (const line of String(input || "").split(/\r?\n/)) {
    const match = /^(?:\*\*\* (?:Add|Update|Delete) File:|\*\*\* Move to:)\s+(.+)$/.exec(line.trim());
    if (match) names.push(match[1].trim());
  }
  return [...new Set(names)].slice(0, 5);
}

function rawOperationFromEntry(entry) {
  if (!entry || !entry.payload) return null;
  const payload = entry.payload;
  if (entry.type === "event_msg" && payload.type === "web_search_end") {
    return compactOperationalItem({
      id: `raw-${payload.call_id || entry.timestamp || "web-search"}`,
      type: "web_search_call",
      status: statusFromRawOperation(payload),
      tool: "Web Search",
      command: searchSummaryFromOperation(payload),
      action: payload.action,
    });
  }
  if (entry.type === "event_msg" && payload.type === "exec_command_end") {
    return compactOperationalItem({
      id: `raw-${payload.call_id || entry.timestamp || "command"}`,
      type: "commandExecution",
      status: statusFromRawOperation(payload),
      command: commandFromRawPayload(payload),
    });
  }
  if (entry.type === "event_msg" && payload.type === "patch_apply_end") {
    return compactOperationalItem({
      id: `raw-${payload.call_id || entry.timestamp || "patch"}`,
      type: "fileChange",
      status: statusFromRawOperation(payload),
      fileNames: Object.keys(payload.changes || {}).slice(0, 5),
    });
  }
  if (entry.type === "response_item" && payload.type === "function_call") {
    return compactOperationalItem({
      id: `raw-${payload.call_id || entry.timestamp || "function"}`,
      type: "commandExecution",
      status: statusFromRawOperation(payload),
      command: commandFromRawPayload(payload),
    });
  }
  if (entry.type === "response_item" && payload.type === "web_search_call") {
    return compactOperationalItem({
      id: `raw-${payload.call_id || entry.timestamp || "web-search"}`,
      type: "web_search_call",
      status: statusFromRawOperation(payload),
      tool: "Web Search",
      command: searchSummaryFromOperation(payload),
      action: payload.action,
    });
  }
  if (entry.type === "response_item" && payload.type === "custom_tool_call") {
    const fileNames = payload.name === "apply_patch" ? fileNamesFromPatchInput(payload.input) : [];
    return compactOperationalItem({
      id: `raw-${payload.call_id || entry.timestamp || "tool"}`,
      type: fileNames.length ? "fileChange" : "dynamicToolCall",
      status: statusFromRawOperation(payload),
      tool: payload.name,
      fileNames,
    });
  }
  return null;
}

function readLatestRawOperation(thread) {
  const rolloutPath = thread && (thread.path || thread.rolloutPath || thread.rollout_path);
  if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) return null;
  try {
    const lines = fs.readFileSync(rolloutPath, "utf8").split(/\r?\n/).filter(Boolean).slice(-800);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const operation = rawOperationFromEntry(parseJsonLine(lines[index]));
      if (operation) return operation;
    }
  } catch (_) {
    return null;
  }
  return null;
}

function compactItem(item) {
  if (!item || typeof item !== "object") return item;
  const out = Object.assign({}, item);
  if (isContextCompactionType(out.type)) {
    return {
      id: out.id,
      type: out.type,
      mobileNotice: "历史上下文已压缩",
    };
  }
  if (isOperationalItem(out)) {
    return compactOperationalItem(out);
  }
  if (typeof out.text === "string") out.text = truncateMiddle(out.text, MAX_TEXT_CHARS, "text");
  if (Array.isArray(out.content)) out.content = compactStringArray(out.content, MAX_TEXT_CHARS, "content");
  if (Array.isArray(out.summary)) out.summary = compactStringArray(out.summary, MAX_TEXT_CHARS, "summary");
  if (out.type === "commandExecution" && typeof out.aggregatedOutput === "string") {
    out.outputTotalChars = out.outputTotalChars || out.aggregatedOutput.length;
    out.outputTruncated = out.aggregatedOutput.length > MAX_COMMAND_OUTPUT_CHARS || Boolean(out.outputTruncated);
    out.aggregatedOutput = truncateTail(out.aggregatedOutput, MAX_COMMAND_OUTPUT_CHARS, "command output");
  }
  if (out.result) out.result = compactStructured(out.result);
  if (out.contentItems) out.contentItems = compactStructured(out.contentItems);
  if (out.changes) out.changes = compactStructured(out.changes);
  return out;
}

function trailingOperationIndex(items, allowLiveOperation) {
  if (!allowLiveOperation || !Array.isArray(items)) return -1;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (isOperationalItem(items[index])) return index;
  }
  return -1;
}

function compactTurn(turn, options = {}) {
  if (!turn || typeof turn !== "object") return turn;
  const out = Object.assign({}, turn);
  if (Array.isArray(out.items)) {
    const lastLiveOperationIndex = trailingOperationIndex(out.items, Boolean(options.allowLiveOperation) && isLiveTurn(out));
    out.items = out.items.map(compactItem).filter((item, index) => {
      if (!isOperationalItem(item)) return true;
      return index === lastLiveOperationIndex;
    });
    let remainingOutputBudget = MAX_COMMAND_OUTPUT_CHARS_PER_TURN;
    for (let i = out.items.length - 1; i >= 0; i--) {
      const item = out.items[i];
      if (!item || item.type !== "commandExecution" || typeof item.aggregatedOutput !== "string") continue;
      const output = item.aggregatedOutput;
      if (remainingOutputBudget <= 0) {
        item.outputOmitted = true;
        item.outputTruncated = true;
        item.outputTotalChars = item.outputTotalChars || output.length;
        item.aggregatedOutput = "";
        continue;
      }
      if (output.length > remainingOutputBudget) {
        item.outputTruncated = true;
        item.outputTotalChars = item.outputTotalChars || output.length;
        item.aggregatedOutput = truncateTail(output, remainingOutputBudget, "turn command output");
        remainingOutputBudget = 0;
        continue;
      }
      remainingOutputBudget -= output.length;
    }
  }
  return out;
}

function compactThread(thread) {
  if (!thread || typeof thread !== "object") return thread;
  const out = Object.assign({}, thread);
  if (Array.isArray(out.turns)) {
    const omitted = Math.max(0, out.turns.length - MAX_THREAD_TURNS);
    if (omitted > 0) {
      out.mobileOmittedTurnCount = omitted;
      out.turns = out.turns.slice(-MAX_THREAD_TURNS);
    }
    const latestIndex = out.turns.length - 1;
    out.turns = out.turns.map((turn, index) => compactTurn(turn, { allowLiveOperation: index === latestIndex }));
    const latest = out.turns[latestIndex];
    if (latest && isLiveTurn(latest) && Array.isArray(latest.items)
      && !latest.items.some((item) => isOperationalItem(item))) {
      const rawOperation = readLatestRawOperation(out);
      if (rawOperation) latest.items.push(rawOperation);
    }
  }
  return out;
}

function compactThreadReadResult(result) {
  if (!result || typeof result !== "object") return result;
  const out = Object.assign({}, result);
  if (out.thread) out.thread = compactThread(out.thread);
  return out;
}

function compactTurnsListResult(result) {
  if (!result || typeof result !== "object") return result;
  const out = Object.assign({}, result);
  if (Array.isArray(out.data)) out.data = out.data.map((turn) => compactTurn(turn));
  if (Array.isArray(out.turns)) out.turns = out.turns.map((turn) => compactTurn(turn));
  return out;
}

function compactNotification(payload) {
  if (!payload || payload.type !== "notification" || !payload.params) return payload;
  if (payload.method === "item/commandExecution/outputDelta" || payload.method === "item/fileChange/outputDelta") {
    return null;
  }
  if (payload.method === "item/reasoning/textDelta" || payload.method === "item/reasoning/summaryTextDelta") {
    return null;
  }
  const out = {
    type: payload.type,
    method: payload.method,
    params: Object.assign({}, payload.params),
  };
  if (out.params.item) out.params.item = compactItem(out.params.item);
  if (out.params.turn) out.params.turn = compactTurn(out.params.turn, { allowLiveOperation: true });
  if (payload.method === "account/rateLimits/updated" && out.params.rateLimits) {
    out.params.rateLimits = compactRateLimits(out.params.rateLimits);
  }
  if (payload.method === "item/commandExecution/outputDelta" && typeof out.params.delta === "string") {
    out.params.originalDeltaChars = out.params.delta.length;
    out.params.deltaTruncated = out.params.delta.length > MAX_DELTA_CHARS;
    out.params.delta = truncateTail(out.params.delta, MAX_DELTA_CHARS, "command output delta");
  }
  if ((payload.method === "item/agentMessage/delta" || payload.method === "item/reasoning/textDelta" || payload.method === "item/reasoning/summaryTextDelta") && typeof out.params.delta === "string") {
    out.params.originalDeltaChars = out.params.delta.length;
    out.params.deltaTruncated = out.params.delta.length > MAX_DELTA_CHARS;
    out.params.delta = truncateMiddle(out.params.delta, MAX_DELTA_CHARS, "text delta");
  }
  return out;
}

function compactRateLimitWindow(value) {
  if (!value || typeof value !== "object") return null;
  return Object.fromEntries(Object.entries({
    usedPercent: typeof value.usedPercent === "number" ? value.usedPercent : undefined,
    windowDurationMins: typeof value.windowDurationMins === "number" ? value.windowDurationMins : undefined,
    resetsAt: typeof value.resetsAt === "number" ? value.resetsAt : undefined,
  }).filter(([, entry]) => entry !== undefined));
}

function compactRateLimits(value) {
  if (!value || typeof value !== "object") return null;
  return Object.fromEntries(Object.entries({
    limitId: value.limitId || undefined,
    limitName: value.limitName || undefined,
    primary: compactRateLimitWindow(value.primary),
    secondary: compactRateLimitWindow(value.secondary),
    credits: value.credits || null,
    planType: value.planType || undefined,
    rateLimitReachedType: value.rateLimitReachedType || null,
  }).filter(([, entry]) => entry !== undefined));
}

function compactApprovalText(value, maxChars = 1200) {
  return truncateMiddle(String(value ?? ""), maxChars, "approval text");
}

function commandTextFromApproval(method, params = {}) {
  if (method === "execCommandApproval" && Array.isArray(params.command)) return params.command.join(" ");
  if (typeof params.command === "string") return params.command;
  if (Array.isArray(params.commandActions) && params.commandActions.length) {
    return params.commandActions.map((action) => action && action.command).filter(Boolean).join(" && ");
  }
  return "";
}

function fileNamesFromApproval(method, params = {}) {
  if (method === "applyPatchApproval" && params.fileChanges && typeof params.fileChanges === "object") {
    return Object.keys(params.fileChanges).slice(0, 12);
  }
  return [];
}

function compactUserInputQuestions(params = {}) {
  if (!Array.isArray(params.questions)) return [];
  return params.questions.slice(0, 8).map((question) => {
    const options = Array.isArray(question && question.options)
      ? question.options.slice(0, 12).map((option) => Object.fromEntries(Object.entries({
        label: option && option.label ? compactApprovalText(option.label, 240) : "",
        description: option && option.description ? compactApprovalText(option.description, 500) : "",
      }).filter(([, value]) => value !== "")))
      : [];
    return Object.fromEntries(Object.entries({
      id: question && question.id ? String(question.id) : "",
      header: question && question.header ? compactApprovalText(question.header, 240) : "",
      question: question && question.question ? compactApprovalText(question.question, 1200) : "",
      isOther: Boolean(question && question.isOther),
      options,
    }).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== "" && value !== false;
    }));
  });
}

function compactApprovalParams(method, params = {}) {
  return Object.fromEntries(Object.entries({
    threadId: params.threadId || params.conversationId || null,
    turnId: params.turnId || null,
    itemId: params.itemId || params.callId || null,
    approvalId: params.approvalId || null,
    reason: params.reason ? compactApprovalText(params.reason, 900) : null,
    command: commandTextFromApproval(method, params) ? compactApprovalText(commandTextFromApproval(method, params), 1800) : null,
    cwd: params.cwd || null,
    grantRoot: params.grantRoot || null,
    fileNames: fileNamesFromApproval(method, params),
    permissions: method === "item/permissions/requestApproval" ? compactStructured(params.permissions || {}) : null,
    networkApprovalContext: params.networkApprovalContext || null,
    questions: method === "item/tool/requestUserInput" ? compactUserInputQuestions(params) : [],
    elicitationId: method === "mcpServer/elicitation/request" ? params.elicitationId || null : null,
    title: method === "mcpServer/elicitation/request" && params.title ? compactApprovalText(params.title, 240) : null,
    message: method === "mcpServer/elicitation/request" && params.message ? compactApprovalText(params.message, 1200) : null,
    schema: method === "mcpServer/elicitation/request" && params.schema ? compactStructured(params.schema) : null,
    elicitation: method === "mcpServer/elicitation/request" && params.elicitation ? compactStructured(params.elicitation) : null,
  }).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== "";
  }));
}

function publicServerRequest(request) {
  return {
    id: String(request.id),
    method: request.method,
    status: request.status || "waiting",
    decision: request.decision || null,
    receivedAt: request.receivedAt || null,
    respondedAt: request.respondedAt || null,
    actionable: ACTIONABLE_SERVER_REQUEST_METHODS.has(request.method),
    params: compactApprovalParams(request.method, request.params || {}),
  };
}

function grantedPermissionsFromRequest(params = {}) {
  const permissions = params.permissions || {};
  const granted = {};
  if (permissions.network) granted.network = permissions.network;
  if (permissions.fileSystem) granted.fileSystem = permissions.fileSystem;
  return granted;
}

function approvalResponsePayload(request, decision) {
  const method = request && request.method;
  const params = (request && request.params) || {};
  if (!["allow_once", "allow_session", "deny"].includes(decision)) {
    throw new Error("Invalid approval decision");
  }
  if (method === "item/commandExecution/requestApproval") {
    return {
      result: {
        decision: decision === "allow_once" ? "accept" : decision === "allow_session" ? "acceptForSession" : "decline",
      },
    };
  }
  if (method === "item/fileChange/requestApproval") {
    return {
      result: {
        decision: decision === "allow_once" ? "accept" : decision === "allow_session" ? "acceptForSession" : "decline",
      },
    };
  }
  if (method === "execCommandApproval" || method === "applyPatchApproval") {
    return {
      result: {
        decision: decision === "allow_once" ? "approved" : decision === "allow_session" ? "approved_for_session" : "denied",
      },
    };
  }
  if (method === "item/permissions/requestApproval") {
    if (decision === "deny") {
      return { error: { code: -32001, message: "Permission request denied" } };
    }
    return {
      result: {
        permissions: grantedPermissionsFromRequest(params),
        scope: decision === "allow_session" ? "session" : "turn",
        strictAutoReview: false,
      },
    };
  }
  throw new Error(`Unsupported server request method: ${method || "unknown"}`);
}

function userInputResponsePayload(request, body = {}) {
  const params = (request && request.params) || {};
  const questions = Array.isArray(params.questions) ? params.questions : [];
  if (body.answers && typeof body.answers === "object") {
    return { result: { answers: body.answers } };
  }
  const responseText = String(body.responseText || body.text || "").trim();
  const questionId = String(body.questionId || (questions[0] && questions[0].id) || "answer");
  return {
    result: {
      answers: responseText ? { [questionId]: { answers: [responseText] } } : {},
    },
  };
}

function mcpElicitationResponsePayload(body = {}) {
  const action = body.action === "decline" || body.decision === "deny" ? "decline" : "accept";
  if (action === "decline") return { result: { action, content: null } };
  const responseText = String(body.responseText || body.text || "").trim();
  const result = { action, content: {} };
  if (body.content && typeof body.content === "object") result.content = body.content;
  else if (responseText) result.content = { response: responseText };
  return { result };
}

function serverRequestResponsePayload(request, body = {}) {
  const method = request && request.method;
  if (ACTIONABLE_APPROVAL_METHODS.has(method)) {
    return approvalResponsePayload(request, String(body.decision || ""));
  }
  if (method === "item/tool/requestUserInput") return userInputResponsePayload(request, body);
  if (method === "mcpServer/elicitation/request") return mcpElicitationResponsePayload(body);
  throw new Error(`Unsupported server request method: ${method || "unknown"}`);
}

function readRawBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_JSON_BODY_BYTES) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function multipartBoundary(contentType) {
  const match = /(?:^|;\s*)boundary=(?:"([^"]+)"|([^;]+))/i.exec(String(contentType || ""));
  return match ? String(match[1] || match[2] || "").trim() : "";
}

function parsePartHeaders(raw) {
  const headers = {};
  for (const line of String(raw || "").split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return headers;
}

function dispositionParam(disposition, name) {
  const quoted = new RegExp(`(?:^|;\\s*)${name}="([^"]*)"`, "i").exec(String(disposition || ""));
  if (quoted) return quoted[1];
  const bare = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`, "i").exec(String(disposition || ""));
  return bare ? bare[1].trim() : "";
}

function parseMultipartBody(buffer, contentType) {
  const boundary = multipartBoundary(contentType);
  if (!boundary) throw new Error("multipart boundary is missing");
  const boundaryBuffer = Buffer.from(`--${boundary}`, "utf8");
  const separator = Buffer.from("\r\n\r\n", "utf8");
  const fields = {};
  const files = [];
  let pos = buffer.indexOf(boundaryBuffer);
  while (pos >= 0) {
    pos += boundaryBuffer.length;
    if (buffer.slice(pos, pos + 2).toString("utf8") === "--") break;
    if (buffer.slice(pos, pos + 2).toString("utf8") === "\r\n") pos += 2;
    const next = buffer.indexOf(boundaryBuffer, pos);
    if (next < 0) break;
    let end = next;
    if (end >= 2 && buffer[end - 2] === 13 && buffer[end - 1] === 10) end -= 2;
    const part = buffer.slice(pos, end);
    const headerEnd = part.indexOf(separator);
    if (headerEnd >= 0) {
      const headers = parsePartHeaders(part.slice(0, headerEnd).toString("utf8"));
      const disposition = headers["content-disposition"] || "";
      const fieldName = dispositionParam(disposition, "name");
      const filename = dispositionParam(disposition, "filename");
      const content = part.slice(headerEnd + separator.length);
      if (fieldName) {
        if (filename) {
          files.push({
            fieldName,
            originalName: filename,
            mimeType: headers["content-type"] || "",
            buffer: content,
          });
        } else {
          fields[fieldName] = content.toString("utf8");
        }
      }
    }
    pos = next;
  }
  return { fields, files };
}

function sanitizeUploadName(name) {
  const base = path.basename(String(name || "upload").replace(/\\/g, "/"));
  const cleaned = base
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "upload").slice(0, 160);
}

function isImageUpload(file) {
  const mime = String(file.mimeType || "").toLowerCase();
  const ext = path.extname(file.originalName || "").toLowerCase();
  return mime.startsWith("image/") || IMAGE_EXTENSIONS.has(ext);
}

function saveUploadedFiles(threadId, files) {
  if (!files.length) return [];
  if (files.length > MAX_UPLOAD_FILES) throw new Error(`Too many attachments; max ${MAX_UPLOAD_FILES}`);
  const total = files.reduce((sum, file) => sum + file.buffer.length, 0);
  if (total > MAX_UPLOAD_BYTES) throw new Error(`Attachments are too large; max ${MAX_UPLOAD_BYTES} bytes`);
  const day = new Date().toISOString().slice(0, 10);
  const safeThreadId = sanitizeUploadName(threadId).slice(0, 72);
  const dir = path.join(UPLOAD_ROOT, day, safeThreadId || "thread");
  fs.mkdirSync(dir, { recursive: true });
  return files.map((file) => {
    const originalName = sanitizeUploadName(file.originalName);
    const diskName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${originalName}`;
    const diskPath = path.join(dir, diskName);
    fs.writeFileSync(diskPath, file.buffer, { mode: 0o600 });
    return {
      originalName,
      mimeType: file.mimeType || "application/octet-stream",
      size: file.buffer.length,
      path: diskPath,
      isImage: isImageUpload(file),
    };
  });
}

function formatUploadSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function appendAttachmentSummary(text, uploads) {
  if (!uploads.length) return text;
  const lines = uploads.map((file) => {
    const kind = file.isImage ? "image" : "file";
    return `- ${file.originalName} (${kind}, ${file.mimeType}, ${formatUploadSize(file.size)}): ${file.path}`;
  });
  return `${text ? `${text}\n\n` : ""}Uploaded attachments:\n${lines.join("\n")}`;
}

async function readMessageBody(req, threadId) {
  const contentType = String(req.headers["content-type"] || "");
  if (!/^multipart\/form-data\b/i.test(contentType)) {
    return { fields: await readBody(req), uploads: [] };
  }
  const raw = await readRawBody(req, MAX_UPLOAD_BYTES + 256 * 1024);
  const parsed = parseMultipartBody(raw, contentType);
  const uploads = saveUploadedFiles(threadId, parsed.files);
  return { fields: parsed.fields, uploads };
}

function buildTurnInput(text, uploads) {
  const input = [];
  const messageText = appendAttachmentSummary(text, uploads).trim();
  if (messageText) input.push({ type: "text", text: messageText, text_elements: [] });
  for (const file of uploads) {
    if (file.isImage) input.push({ type: "localImage", path: file.path });
  }
  return input;
}

function uploadDedupeFingerprint(file) {
  return {
    name: file.originalName || "",
    mimeType: file.mimeType || "",
    size: Number(file.size || 0),
    isImage: Boolean(file.isImage),
  };
}

function messageSubmissionKeys(threadId, body, text, uploads) {
  const explicit = String(body.clientSubmissionId || "").trim();
  const payload = {
    threadId,
    activeTurnId: String(body.activeTurnId || ""),
    cwd: String(body.cwd || ""),
    model: String(body.model || ""),
    effort: String(body.effort || ""),
    text: String(text || ""),
    uploads: uploads.map(uploadDedupeFingerprint),
  };
  const contentKey = `content:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
  return explicit ? [`client:${threadId}:${explicit}`] : [contentKey];
}

function pruneMessageSubmissions(now = Date.now()) {
  for (const [key, entry] of recentMessageSubmissions) {
    if (now - entry.startedAt > MESSAGE_DEDUPE_WINDOW_MS) recentMessageSubmissions.delete(key);
  }
  while (recentMessageSubmissions.size > MESSAGE_DEDUPE_MAX) {
    const firstKey = recentMessageSubmissions.keys().next().value;
    if (!firstKey) break;
    recentMessageSubmissions.delete(firstKey);
  }
}

function cleanupDuplicateUploads(uploads) {
  const root = path.resolve(UPLOAD_ROOT);
  for (const file of uploads || []) {
    try {
      const filePath = path.resolve(file.path || "");
      if (!filePath.startsWith(`${root}${path.sep}`)) continue;
      fs.unlinkSync(filePath);
    } catch (_) {}
  }
}

async function runMessageSubmissionOnce(keys, duplicateUploads, fn) {
  const now = Date.now();
  const keyList = Array.isArray(keys) ? keys.filter(Boolean) : [keys].filter(Boolean);
  pruneMessageSubmissions(now);
  for (const key of keyList) {
    const existing = recentMessageSubmissions.get(key);
    if (existing && now - existing.startedAt <= MESSAGE_DEDUPE_WINDOW_MS) {
      cleanupDuplicateUploads(duplicateUploads);
      return existing.promise;
    }
  }
  const entry = { startedAt: now, promise: null };
  entry.promise = Promise.resolve()
    .then(fn)
    .catch((err) => {
      for (const key of keyList) {
        if (recentMessageSubmissions.get(key) === entry) recentMessageSubmissions.delete(key);
      }
      throw err;
    });
  for (const key of keyList) recentMessageSubmissions.set(key, entry);
  try {
    return await entry.promise;
  } finally {
    pruneMessageSubmissions();
  }
}

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
  }[ext] || "application/octet-stream";
}

function isPathInside(parent, child) {
  const parentPath = path.resolve(parent);
  const childPath = path.resolve(child);
  return childPath === parentPath || childPath.startsWith(parentPath + path.sep);
}

function serveUploadedFile(req, res) {
  const url = getUrl(req);
  const rawPath = url.searchParams.get("path") || "";
  const target = path.resolve(rawPath);
  if (!rawPath || !isPathInside(UPLOAD_ROOT, target)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.stat(target, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": mimeFor(target),
      "Cache-Control": "private, max-age=300",
      "Content-Length": stat.size,
      "Content-Disposition": `inline; filename="${path.basename(target).replace(/"/g, "_")}"`,
    });
    fs.createReadStream(target).pipe(res);
  });
}

function serveStatic(req, res) {
  const url = getUrl(req);
  const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const target = path.normalize(path.join(PUBLIC_ROOT, rel));
  if (!target.startsWith(PUBLIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": mimeFor(target),
      "Cache-Control": "no-cache",
    });
    res.end(data);
  });
}

function broadcast(payload) {
  const compacted = compactNotification(payload);
  if (!compacted) return;
  const body = `data: ${JSON.stringify(compacted)}\n\n`;
  for (const res of [...clients]) {
    try {
      if (res.destroyed || res.writableEnded || !res.write(body)) {
        removeEventClient(res);
      }
    } catch (_) {
      removeEventClient(res);
    }
  }
}

function removeEventClient(res) {
  const heartbeat = clientHeartbeats.get(res);
  if (heartbeat) clearInterval(heartbeat);
  clientHeartbeats.delete(res);
  clients.delete(res);
  try {
    if (!res.destroyed && !res.writableEnded) res.end();
  } catch (_) {}
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

class JsonLineConnection {
  constructor(socket) {
    this.socket = socket;
    this.readyState = 1;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.buffer = "";

    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      this.buffer += chunk;
      let index;
      while ((index = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, index).trim();
        this.buffer = this.buffer.slice(index + 1);
        if (line && this.onmessage) this.onmessage({ data: line });
      }
    });
    socket.on("error", (err) => {
      this.readyState = 3;
      if (this.onerror) this.onerror(err);
    });
    socket.on("close", () => {
      this.readyState = 3;
      if (this.onclose) this.onclose();
    });
  }

  send(data) {
    if (this.readyState !== 1) throw new Error("jsonl tcp connection is not open");
    this.socket.write(`${data}\n`);
  }

  close() {
    this.readyState = 3;
    this.socket.end();
  }
}

function parseTcpEndpoint(value, source) {
  if (!value) return null;
  let host = "127.0.0.1";
  let portText = value;
  if (value.includes(":")) {
    const parts = value.split(":");
    portText = parts.pop();
    host = parts.join(":") || host;
  }
  const port = Number(portText);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid ${source} tcp endpoint: ${value}`);
  }
  return { protocol: "jsonl-tcp", host, port, source, required: true };
}

function resolveExternalEndpoint() {
  if (EXTERNAL_APP_SERVER_WS) {
    return { protocol: "ws", url: EXTERNAL_APP_SERVER_WS, source: "CODEX_MOBILE_APP_SERVER_WS", required: true };
  }
  if (EXTERNAL_APP_SERVER_TCP) {
    return parseTcpEndpoint(EXTERNAL_APP_SERVER_TCP, "CODEX_MOBILE_APP_SERVER_TCP");
  }
  try {
    const raw = fs.readFileSync(MUX_ENDPOINT_FILE, "utf8");
    const endpoint = JSON.parse(raw);
    if (endpoint && endpoint.protocol === "jsonl-tcp" && endpoint.host && endpoint.port) {
      return {
        protocol: "jsonl-tcp",
        host: endpoint.host,
        port: Number(endpoint.port),
        source: MUX_ENDPOINT_FILE,
        capabilities: endpoint.capabilities || null,
        required: true,
      };
    }
    if (endpoint && endpoint.protocol === "ws" && endpoint.url) {
      return { protocol: "ws", url: endpoint.url, source: MUX_ENDPOINT_FILE, required: true };
    }
  } catch (_) {
    return null;
  }
  return null;
}

class CodexAppServerClient {
  constructor() {
    this.child = null;
    this.ws = null;
    this.port = 0;
    this.endpoint = null;
    this.transportKind = "none";
    this.nextId = 1;
    this.pending = new Map();
    this.serverRequests = new Map();
    this.connecting = null;
    this.info = null;
    this.ready = false;
    this.lastError = null;
    this.resetting = false;
    this.requireSharedAppServer = REQUIRE_SHARED_APP_SERVER;
  }

  async ensure() {
    if (this.ready && this.isTransportOpen()) return;
    if (this.connecting) return this.connecting;
    this.connecting = this.startAndConnect().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  isTransportOpen() {
    return this.ws && this.ws.readyState === 1;
  }

  async startAndConnect() {
    this.closeTransportOnly();
    const externalEndpoint = resolveExternalEndpoint();
    if (externalEndpoint) {
      this.requireSharedAppServer = true;
      try {
        await this.connectEndpoint(externalEndpoint);
        await this.initialize({ allowAlreadyInitialized: true });
        return;
      } catch (err) {
        this.closeTransportOnly();
        this.lastError = `shared app-server endpoint unavailable (${err.message})`;
        console.error(`[codex app-server] ${this.lastError}`);
        throw new Error(this.lastError);
      }
    }

    if (this.requireSharedAppServer) {
      this.lastError = `shared app-server endpoint unavailable (${MUX_ENDPOINT_FILE} not found)`;
      console.error(`[codex app-server] ${this.lastError}`);
      throw new Error(this.lastError);
    }

    await this.startManagedChild();
    await this.connectEndpoint({ protocol: "ws", url: `ws://127.0.0.1:${this.port}`, source: "managed child", required: true });
    await this.initialize();
  }

  async startManagedChild() {
    assertCommandAvailable(CODEX_EXE, "Codex executable");
    if (!this.child || this.child.exitCode !== null || this.child.signalCode !== null) {
      this.port = await getFreePort();
      const child = spawn(CODEX_EXE, ["app-server", "--listen", `ws://127.0.0.1:${this.port}`], {
        cwd: APP_ROOT,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.child = child;
      const started = new Promise((resolve, reject) => {
        const onError = (err) => {
          child.off("spawn", onSpawn);
          if (this.child === child) this.child = null;
          this.ready = false;
          this.lastError = `failed to start codex app-server (${err.message})`;
          broadcast({ type: "status", status: this.status() });
          reject(new Error(this.lastError));
        };
        const onSpawn = () => {
          child.off("error", onError);
          resolve();
        };
        child.once("error", onError);
        child.once("spawn", onSpawn);
      });
      child.stderr.on("data", (chunk) => this.handleAppServerLog(chunk));
      child.stdout.on("data", (chunk) => this.handleAppServerLog(chunk));
      child.on("exit", (code, signal) => {
        if (this.child !== child) return;
        this.ready = false;
        this.lastError = `codex app-server exited (${code ?? signal ?? "unknown"})`;
        broadcast({ type: "status", status: this.status() });
      });
      await started;
    }
  }

  async initialize(options = {}) {
    try {
      this.info = await this.sendRpc("initialize", {
        clientInfo: { name: "codex-mobile-web", title: "Codex Mobile Web", version: "0.1.0" },
        capabilities: { experimentalApi: true },
      }, READ_RPC_TIMEOUT_MS);
    } catch (err) {
      if (!options.allowAlreadyInitialized || !/already initialized/i.test(err.message || "")) {
        throw err;
      }
      this.info = { userAgent: "shared app-server (already initialized)" };
    }
    this.ready = true;
    this.lastError = null;
    broadcast({ type: "status", status: this.status() });
  }

  closeTransportOnly() {
    if (!this.ws) return;
    try {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
    } catch (_) {}
    this.ws = null;
  }

  handleAppServerLog(chunk) {
    const text = String(chunk || "").trim();
    if (!text) return;
    if (/listening on:|readyz:|healthz:/.test(text)) return;
    console.error(`[codex app-server] ${text.slice(0, 1200)}`);
  }

  async connectEndpoint(endpoint) {
    const deadline = Date.now() + 15000;
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        if (endpoint.protocol === "jsonl-tcp") return await this.connectJsonLineTcpOnce(endpoint);
        if (endpoint.protocol === "ws") return await this.connectWebSocketOnce(endpoint.url);
        throw new Error(`unsupported app-server endpoint protocol: ${endpoint.protocol}`);
      } catch (err) {
        lastError = err;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    throw lastError || new Error("failed to connect to codex app-server endpoint");
  }

  connectWebSocketOnce(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => reject(new Error("codex app-server websocket timeout")), 2500);
      ws.onopen = () => {
        clearTimeout(timer);
        this.ws = ws;
        this.endpoint = { protocol: "ws", url };
        this.transportKind = url.includes(`127.0.0.1:${this.port}`) ? "managed-ws-child" : "external-ws";
        ws.onmessage = (event) => this.handleMessage(event.data);
        ws.onclose = () => {
          const wasShared = this.transportKind === "external-ws";
          this.ready = false;
          this.lastError = wasShared ? "shared app-server connection closed" : "codex app-server connection closed";
          this.failPending(new Error(this.lastError));
          broadcast({ type: "status", status: this.status() });
        };
        ws.onerror = () => {
          this.ready = false;
        };
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error("failed to connect to codex app-server websocket"));
      };
    });
  }

  connectJsonLineTcpOnce(endpoint) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: endpoint.host, port: endpoint.port });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error("codex app-server jsonl tcp timeout"));
      }, 2500);
      socket.once("connect", () => {
        clearTimeout(timer);
        const connection = new JsonLineConnection(socket);
        this.ws = connection;
        this.endpoint = endpoint;
        this.transportKind = "external-jsonl-tcp";
        this.requireSharedAppServer = true;
        connection.onmessage = (event) => this.handleMessage(event.data);
        connection.onclose = () => {
          this.ready = false;
          this.lastError = "shared app-server connection closed";
          this.failPending(new Error(this.lastError));
          broadcast({ type: "status", status: this.status() });
        };
        connection.onerror = () => {
          this.ready = false;
        };
        resolve();
      });
      socket.once("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  handleMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch (_) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(msg, "id") && msg.method) {
      this.handleServerRequest(msg);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(msg, "id") && this.pending.has(msg.id)) {
      const { resolve, reject, timer } = this.pending.get(msg.id);
      clearTimeout(timer);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    if (msg.method) {
      if (msg.method === "account/rateLimits/updated" && msg.params && msg.params.rateLimits) {
        latestRateLimits = compactRateLimits(msg.params.rateLimits);
      }
      if (msg.method === "serverRequest/resolved" && msg.params && msg.params.requestId != null) {
        this.markServerRequestResolved(msg.params.requestId, "resolved");
      }
      maybeSendTurnCompletedPush(msg.method, msg.params || null);
      broadcast({ type: "notification", method: msg.method, params: msg.params || null });
    }
  }

  handleServerRequest(msg) {
    if (!SERVER_REQUEST_METHODS.has(msg.method)) {
      broadcast({ type: "notification", method: msg.method, params: msg.params || null });
      return;
    }
    const key = String(msg.id);
    const request = {
      id: msg.id,
      method: msg.method,
      params: msg.params || {},
      status: "waiting",
      receivedAt: Date.now(),
      decision: null,
      respondedAt: null,
    };
    this.serverRequests.set(key, request);
    broadcast({ type: "serverRequest", request: publicServerRequest(request) });
  }

  markServerRequestResolved(requestId, status = "resolved") {
    const key = String(requestId);
    const request = this.serverRequests.get(key);
    if (request) {
      request.status = status;
      request.respondedAt = request.respondedAt || Date.now();
      broadcast({ type: "serverRequestResolved", requestId: key, request: publicServerRequest(request) });
      setTimeout(() => this.serverRequests.delete(key), 15000).unref();
      return;
    }
    broadcast({ type: "serverRequestResolved", requestId: key, status });
  }

  pendingServerRequests() {
    return [...this.serverRequests.values()].map(publicServerRequest);
  }

  sendServerRequestResponse(request, payload) {
    if (!this.isTransportOpen()) {
      throw new Error("codex app-server connection is not open");
    }
    const message = Object.assign({ jsonrpc: "2.0", id: request.id }, payload);
    this.ws.send(JSON.stringify(message));
  }

  answerServerRequest(requestId, responseBody = {}) {
    const key = String(requestId);
    const request = this.serverRequests.get(key);
    if (!request) throw new Error("Approval request is no longer pending");
    if (request.status !== "waiting") throw new Error("Approval request has already been answered");
    const body = responseBody && typeof responseBody === "object" ? responseBody : { decision: String(responseBody || "") };
    const payload = serverRequestResponsePayload(request, body);
    this.sendServerRequestResponse(request, payload);
    request.status = "responded";
    request.decision = body.decision || body.action || "submitted";
    request.respondedAt = Date.now();
    broadcast({ type: "serverRequestResolved", requestId: key, request: publicServerRequest(request) });
    setTimeout(() => this.serverRequests.delete(key), 15000).unref();
    return publicServerRequest(request);
  }

  failPending(err) {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(err);
    }
    this.pending.clear();
    for (const request of this.serverRequests.values()) {
      request.status = "connectionClosed";
      request.respondedAt = Date.now();
      broadcast({ type: "serverRequestResolved", requestId: String(request.id), request: publicServerRequest(request) });
    }
    this.serverRequests.clear();
  }

  resetConnection(reason) {
    if (this.resetting) return;
    this.resetting = true;
    this.ready = false;
    this.lastError = reason;
    console.error(`[codex app-server] resetting connection: ${reason}`);
    this.closeTransportOnly();
    if (this.transportKind === "managed-ws-child" || this.child) {
      const child = this.child;
      this.child = null;
      this.port = 0;
      try {
        if (child && child.exitCode === null && child.signalCode === null) child.kill();
      } catch (_) {}
    }
    this.info = null;
    this.failPending(new Error(reason));
    broadcast({ type: "status", status: this.status() });
    setTimeout(() => {
      this.resetting = false;
    }, 250).unref();
  }

  sendRpc(method, params, timeoutMs = DEFAULT_RPC_TIMEOUT_MS) {
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    if (!this.isTransportOpen()) {
      return Promise.reject(new Error("codex app-server connection is not open"));
    }
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        const err = new Error(`Codex request timed out: ${method}`);
        err.code = "RPC_TIMEOUT";
        reject(err);
        this.resetConnection(err.message);
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
  }

  sendNotification(method, params) {
    if (!this.isTransportOpen()) return false;
    this.ws.send(JSON.stringify({ jsonrpc: "2.0", method, params }));
    return true;
  }

  isMuxEndpoint() {
    return this.transportKind === "external-jsonl-tcp"
      && this.endpoint
      && normalizeFsPath(this.endpoint.source) === normalizeFsPath(MUX_ENDPOINT_FILE);
  }

  supportsMuxUserMessageEcho() {
    return this.isMuxEndpoint()
      && this.endpoint.capabilities
      && this.endpoint.capabilities.mobileUserMessageEcho === true;
  }

  notifyMuxUserMessage(params) {
    if (!this.supportsMuxUserMessageEcho()) return false;
    return this.sendNotification("mux/userMessage", params);
  }

  async request(method, params, options = {}) {
    const timeoutMs = options.timeoutMs || (SAFE_RETRY_METHODS.has(method) ? READ_RPC_TIMEOUT_MS : DEFAULT_RPC_TIMEOUT_MS);
    const retry = options.retry !== false && SAFE_RETRY_METHODS.has(method);
    await this.ensure();
    try {
      return await this.sendRpc(method, params, timeoutMs);
    } catch (err) {
      const recoverable = /timed out|connection is not open|connection closed/i.test(err.message || "");
      if (!retry || !recoverable) throw err;
      await this.ensure();
      return this.sendRpc(method, params, timeoutMs);
    }
  }

  status() {
    return {
      ready: this.ready,
      port: this.port || null,
      transport: this.transportKind,
      endpoint: this.endpoint ? {
        protocol: this.endpoint.protocol,
        source: this.endpoint.source || null,
        host: this.endpoint.host || null,
        port: this.endpoint.port || null,
        url: this.endpoint.url || null,
        capabilities: this.endpoint.capabilities || null,
      } : null,
      muxEndpointFile: MUX_ENDPOINT_FILE,
      codexExe: CODEX_EXE,
      codexHome: CODEX_HOME,
      runtimeRoot: RUNTIME_ROOT,
      userAgent: this.info ? this.info.userAgent : null,
      lastError: this.lastError,
      sharedRequired: this.requireSharedAppServer,
      rateLimits: latestRateLimits,
    };
  }
}

const codex = new CodexAppServerClient();

function readGlobalState() {
  const p = path.join(CODEX_HOME, ".codex-global-state.json");
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (_) {
    return {};
  }
}

function rowToFallbackThread(row) {
  const updatedAt = Number(row.updated_at || row.updatedAt || 0);
  const name = row.title || row.thread_name || null;
  const preview = row.first_user_message || row.preview || name || row.id;
  return {
    id: row.id,
    name,
    preview,
    cwd: typeof row.cwd === "string" ? row.cwd.replace(/^\\\\\?\\/, "") : null,
    path: row.path || row.rollout_path || row.rolloutPath || null,
    updatedAt,
    archived: Boolean(Number(row.archived || 0)),
    archivedAt: row.archived_at || null,
    status: { type: "notLoaded" },
    model: row.model || null,
    effort: row.reasoning_effort || null,
    sandboxPolicy: row.sandbox_policy || null,
    approvalPolicy: row.approval_mode || null,
    mobileFallback: true,
  };
}

function sqlString(value) {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}

function readStateDbThread(threadId) {
  if (!fs.existsSync(STATE_DB) || !threadId) return null;
  const query = [
    "select id,title,first_user_message,cwd,rollout_path,archived,archived_at,updated_at,model,reasoning_effort,sandbox_policy,approval_mode",
    "from threads",
    `where id=${sqlString(threadId)}`,
    "limit 1;",
  ].join(" ");
  try {
    const result = spawnSync("sqlite3", ["-json", STATE_DB, query], {
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    if (result.error || result.status !== 0) return null;
    const rows = JSON.parse(result.stdout || "[]");
    return rows[0] ? rowToFallbackThread(rows[0]) : null;
  } catch (_) {
    return null;
  }
}

function sortTurnsChronologically(turns) {
  return (turns || []).slice().sort((a, b) => {
    const left = Date.parse(a && (a.startedAt || a.completedAt || ""));
    const right = Date.parse(b && (b.startedAt || b.completedAt || ""));
    if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right;
    return String((a && a.id) || "").localeCompare(String((b && b.id) || ""));
  });
}

function threadFromTurnsList(threadId, summary, turnsResult) {
  const data = Array.isArray(turnsResult && turnsResult.data)
    ? turnsResult.data
    : Array.isArray(turnsResult && turnsResult.turns)
      ? turnsResult.turns
      : [];
  const turns = sortTurnsChronologically(data).slice(-MAX_THREAD_TURNS);
  const latest = turns[turns.length - 1];
  const status = latest && isLiveTurn(latest) ? { type: "active" } : (summary && summary.status) || { type: "notLoaded" };
  return Object.assign({
    id: threadId,
    name: null,
    preview: threadId,
    cwd: null,
    path: null,
    updatedAt: 0,
    status,
    turns,
    mobileReadMode: "turns-list",
  }, summary || {}, { id: threadId, status, turns, mobileReadMode: "turns-list" });
}

function filterFallbackThreads(threads, filters = {}) {
  const globalState = filters.globalState || readGlobalState();
  const visibility = visibilityFromGlobalState(globalState);
  const cwdKey = normalizeFsPath(filters.cwd);
  const search = String(filters.searchTerm || "").trim().toLowerCase();
  return threads
    .filter((thread) => !isHiddenThread(thread, visibility))
    .filter((thread) => !cwdKey || normalizeFsPath(thread.cwd) === cwdKey)
    .filter((thread) => {
      if (!search) return true;
      return [thread.name, thread.preview, thread.cwd, thread.id]
        .some((value) => String(value || "").toLowerCase().includes(search));
    });
}

function readStateDbFallback(limit = 80, filters = {}) {
  if (!fs.existsSync(STATE_DB)) return [];
  const rowLimit = Math.max(limit * 5, 200);
  const query = [
    "select id,title,cwd,archived,archived_at,updated_at,model,reasoning_effort",
    "from threads",
    "order by updated_at desc",
    `limit ${Math.min(1000, rowLimit)};`,
  ].join(" ");
  try {
    const result = spawnSync("sqlite3", ["-json", STATE_DB, query], {
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true,
      maxBuffer: 5 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) return [];
    const rows = JSON.parse(result.stdout || "[]");
    return filterFallbackThreads(rows.map(rowToFallbackThread), filters).slice(0, limit);
  } catch (_) {
    return [];
  }
}

function readSessionIndexFallback(limit = 80, filters = {}) {
  const p = path.join(CODEX_HOME, "session_index.jsonl");
  try {
    const globalState = filters.globalState || readGlobalState();
    const projectlessThreadIds = visibleProjectlessThreadIds(globalState);
    if (filters.cwd || projectlessThreadIds.size === 0) return [];
    const lines = fs.readFileSync(p, "utf8").split(/\r?\n/).filter(Boolean).slice(-1000);
    const byId = new Map();
    for (const line of lines) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch (_) {
        continue;
      }
      if (!entry.id) continue;
      if (!projectlessThreadIds.has(entry.id)) continue;
      const updatedAt = entry.updated_at ? Math.floor(Date.parse(entry.updated_at) / 1000) : 0;
      byId.set(entry.id, rowToFallbackThread({
        id: entry.id,
        thread_name: entry.thread_name || null,
        updatedAt,
      }));
    }
    return [...byId.values()]
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .filter((thread) => {
        const search = String(filters.searchTerm || "").trim().toLowerCase();
        if (!search) return true;
        return [thread.name, thread.preview, thread.id]
          .some((value) => String(value || "").toLowerCase().includes(search));
      })
      .slice(0, limit);
  } catch (_) {
    return [];
  }
}

async function listWorkspaces() {
  const globalState = readGlobalState();
  const roots = visibleWorkspaceRoots(globalState);
  const visibility = visibilityFromGlobalState(globalState);
  let recentThreads = [];
  try {
    const result = await codex.request("thread/list", {
      limit: 500,
      sortKey: "updated_at",
      sortDirection: "desc",
      archived: false,
      useStateDbOnly: true,
      sourceKinds: [],
    }, { timeoutMs: READ_RPC_TIMEOUT_MS });
    recentThreads = (result.data || []).filter((thread) => !isHiddenThread(thread, visibility));
  } catch (_) {
    // Workspace list can still be useful from global state while app-server is recovering.
  }
  const active = Array.isArray(globalState["active-workspace-roots"])
    ? globalState["active-workspace-roots"]
    : [];
  const counts = new Map();
  for (const thread of recentThreads) {
    if (!thread.cwd) continue;
    const key = normalizeFsPath(thread.cwd);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...roots].map((cwd) => ({
    cwd,
    label: path.basename(cwd.replace(/^\\\\\?\\/, "")) || cwd,
    active: active.includes(cwd),
    recentThreadCount: counts.get(normalizeFsPath(cwd)) || 0,
  })).sort((a, b) => Number(b.active) - Number(a.active) || a.label.localeCompare(b.label));
}

async function handleApi(req, res) {
  const url = getUrl(req);
  if (url.pathname === "/api/public-config") {
    sendJson(res, 200, {
      authRequired: !DISABLE_AUTH,
      title: "Codex Mobile Web",
      maxUploadBytes: MAX_UPLOAD_BYTES,
      maxUploadFiles: MAX_UPLOAD_FILES,
      modelOptions: MODEL_OPTIONS,
      reasoningEffortOptions: REASONING_EFFORT_OPTIONS,
      defaultModel: CODEX_CONFIG_DEFAULTS.model,
      defaultReasoningEffort: CODEX_CONFIG_DEFAULTS.reasoningEffort,
      rateLimits: latestRateLimits,
      push: pushSubscriptionPublicStatus(),
    });
    return;
  }
  if (url.pathname === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    if (!DISABLE_AUTH && !timingSafeEquals(body.key, AUTH_KEY)) {
      sendJson(res, 401, { error: "Invalid key" });
      return;
    }
    res.writeHead(204, {
      "Set-Cookie": `codex_mobile_key=${encodeURIComponent(body.key || "")}; Path=/; Max-Age=31536000; SameSite=Lax`,
      "Cache-Control": "no-store",
    });
    res.end();
    return;
  }
  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }
  if (url.pathname === "/api/push/vapid-public-key" && req.method === "GET") {
    const keys = loadPushVapidKeys();
    sendJson(res, 200, { publicKey: keys.publicKey, subject: keys.subject || PUSH_SUBJECT });
    return;
  }
  if (url.pathname === "/api/push/subscribe" && req.method === "POST") {
    const body = await readBody(req);
    const subscription = normalizePushSubscription(body);
    const subscriptions = loadPushSubscriptions();
    const existing = subscriptions.find((entry) => entry.endpoint === subscription.endpoint);
    const next = subscriptions.filter((entry) => entry.endpoint !== subscription.endpoint);
    next.push(Object.assign({}, subscription, {
      createdAt: existing && existing.createdAt ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userAgent: String(req.headers["user-agent"] || ""),
    }));
    savePushSubscriptions(next);
    sendJson(res, 200, { ok: true, subscriptionCount: next.length });
    return;
  }
  if (url.pathname === "/api/push/unsubscribe" && req.method === "POST") {
    const body = await readBody(req);
    const endpoint = String(body.endpoint || (body.subscription && body.subscription.endpoint) || "");
    if (!endpoint) {
      sendJson(res, 400, { error: "Push subscription endpoint is required" });
      return;
    }
    const next = loadPushSubscriptions().filter((entry) => entry.endpoint !== endpoint);
    savePushSubscriptions(next);
    sendJson(res, 200, { ok: true, subscriptionCount: next.length });
    return;
  }
  if (url.pathname === "/api/push/test" && req.method === "POST") {
    const result = await sendWebPushToAll({
      title: "Codex Mobile Web",
      body: "Test notification",
      data: { url: "/" },
    });
    sendJson(res, 200, Object.assign({ ok: true }, result));
    return;
  }
  if (url.pathname === "/api/status") {
    await codex.ensure().catch((err) => {
      codex.lastError = err.message;
    });
    sendJson(res, 200, codex.status());
    return;
  }
  if (url.pathname === "/api/uploads/file" && req.method === "GET") {
    serveUploadedFile(req, res);
    return;
  }
  if (url.pathname === "/api/app-server/reconnect" && req.method === "POST") {
    codex.resetConnection("manual app-server reconnect requested");
    await new Promise((resolve) => setTimeout(resolve, 350));
    await codex.ensure().catch((err) => {
      codex.lastError = err.message;
    });
    sendJson(res, 200, codex.status());
    return;
  }
  if (url.pathname === "/api/approvals" && req.method === "GET") {
    sendJson(res, 200, { data: codex.pendingServerRequests() });
    return;
  }
  const approvalResponse = url.pathname.match(/^\/api\/approvals\/([^/]+)$/);
  if (approvalResponse && req.method === "POST") {
    const requestId = decodeURIComponent(approvalResponse[1]);
    const body = await readBody(req);
    const request = codex.answerServerRequest(requestId, body);
    sendJson(res, 200, { ok: true, request });
    return;
  }
  if (url.pathname === "/api/workspaces" && req.method === "GET") {
    sendJson(res, 200, { data: await listWorkspaces() });
    return;
  }
  if (url.pathname === "/api/threads" && req.method === "GET") {
    const globalState = readGlobalState();
    const visibility = visibilityFromGlobalState(globalState);
    const cwd = url.searchParams.get("cwd") || null;
    const archivedParam = url.searchParams.get("archived");
    const archived = archivedParam === "true";
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || "80")));
    const cursor = url.searchParams.get("cursor") || null;
    const searchTerm = url.searchParams.get("search") || null;
    if (cwd && !visibility.workspaceKeys.has(normalizeFsPath(cwd))) {
      sendJson(res, 200, { data: [] });
      return;
    }
    const params = {
      cursor,
      limit: cursor ? limit : Math.max(limit, 500),
      sortKey: "updated_at",
      sortDirection: "desc",
      archived,
      useStateDbOnly: true,
      sourceKinds: [],
    };
    if (cwd) params.cwd = cwd;
    if (searchTerm) params.searchTerm = searchTerm;
    try {
      const result = filterVisibleThreads(await codex.request("thread/list", params, { timeoutMs: READ_RPC_TIMEOUT_MS }), globalState);
      if (Array.isArray(result.data)) result.data = result.data.slice(0, limit);
      if (Array.isArray(result.threads)) result.threads = result.threads.slice(0, limit);
      sendJson(res, 200, result);
    } catch (err) {
      const fallback = [
        ...readStateDbFallback(limit, { cwd, searchTerm, globalState }),
        ...readSessionIndexFallback(limit, { cwd, searchTerm, globalState }),
      ].slice(0, limit);
      if (fallback.length) {
        sendJson(res, 200, {
          data: fallback,
          mobileFallback: true,
          warning: err.message || String(err),
        });
        return;
      }
      throw err;
    }
    return;
  }
  const threadRead = url.pathname.match(/^\/api\/threads\/([^/]+)$/);
  if (threadRead && req.method === "GET") {
    const threadId = decodeURIComponent(threadRead[1]);
    const globalState = readGlobalState();
    const visibility = visibilityFromGlobalState(globalState);
    const summary = readStateDbThread(threadId);
    if (summary && isHiddenThread(summary, visibility)) {
      sendJson(res, 404, { error: "Thread is archived, deleted, or outside visible workspaces" });
      return;
    }
    try {
      const turnsResult = await codex.request("thread/turns/list", {
        threadId,
        limit: MAX_THREAD_TURNS,
        sortDirection: "desc",
      }, { timeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS });
      const result = compactThreadReadResult({ thread: threadFromTurnsList(threadId, summary, turnsResult) });
      if (isHiddenThread(result.thread, visibility)) {
        sendJson(res, 404, { error: "Thread is archived, deleted, or outside visible workspaces" });
        return;
      }
      sendJson(res, 200, result);
    } catch (turnsErr) {
      const result = compactThreadReadResult(await codex.request("thread/read", { threadId, includeTurns: true }, { timeoutMs: READ_RPC_TIMEOUT_MS }));
      if (isHiddenThread(result.thread, visibility)) {
        sendJson(res, 404, { error: "Thread is archived, deleted, or outside visible workspaces" });
        return;
      }
      result.mobileReadWarning = turnsErr.message || String(turnsErr);
      sendJson(res, 200, result);
    }
    return;
  }
  const threadTurns = url.pathname.match(/^\/api\/threads\/([^/]+)\/turns$/);
  if (threadTurns && req.method === "GET") {
    const threadId = decodeURIComponent(threadTurns[1]);
    const cursor = url.searchParams.get("cursor") || null;
    sendJson(res, 200, compactTurnsListResult(await codex.request("thread/turns/list", {
      threadId,
      cursor,
      limit: Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || String(MAX_THREAD_TURNS)))),
      sortDirection: url.searchParams.get("sortDirection") || "asc",
    }, { timeoutMs: READ_RPC_TIMEOUT_MS })));
    return;
  }
  const resume = url.pathname.match(/^\/api\/threads\/([^/]+)\/resume$/);
  if (resume && req.method === "POST") {
    const threadId = decodeURIComponent(resume[1]);
    const body = await readBody(req);
    const runtimeSettings = threadRuntimeSettings(threadId);
    sendJson(res, 200, await codex.request("thread/resume", applyResumeRuntimeSettings({
      threadId,
      cwd: body.cwd || null,
      model: body.model || null,
      persistExtendedHistory: true,
    }, runtimeSettings), { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false }));
    return;
  }
  const messages = url.pathname.match(/^\/api\/threads\/([^/]+)\/messages$/);
  if (messages && req.method === "POST") {
    const threadId = decodeURIComponent(messages[1]);
    const { fields: body, uploads } = await readMessageBody(req, threadId);
    const text = String(body.text || "").trim();
    const input = buildTurnInput(text, uploads);
    if (!input.length) {
      sendJson(res, 400, { error: "Message text or attachment is required" });
      return;
    }
    const submissionKeys = messageSubmissionKeys(threadId, body, text, uploads);
    const runtimeSettings = threadRuntimeSettings(threadId);
    const result = await runMessageSubmissionOnce(submissionKeys, uploads, async () => {
      if (body.activeTurnId) {
        try {
          const result = await codex.request("turn/steer", {
            threadId,
            input,
            expectedTurnId: String(body.activeTurnId),
          }, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
          codex.notifyMuxUserMessage({
            threadId,
            turnId: String(body.activeTurnId),
            input,
            clientSubmissionId: body.clientSubmissionId,
          });
          return result;
        } catch (err) {
          if (!/method not found|unknown method|not found/i.test(err.message || "")) throw err;
          codex.notifyMuxUserMessage({
            threadId,
            turnId: String(body.activeTurnId),
            input,
            clientSubmissionId: body.clientSubmissionId,
          });
          return {};
        }
      }
      try {
        await codex.request("thread/resume", applyResumeRuntimeSettings({
          threadId,
          cwd: body.cwd || null,
          model: body.model || null,
          persistExtendedHistory: true,
        }, runtimeSettings), { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
      } catch (err) {
        if (!/already|loaded|active/i.test(err.message || "")) throw err;
      }
      const params = applyTurnRuntimeSettings({
        threadId,
        input,
      }, runtimeSettings);
      if (body.cwd) params.cwd = body.cwd;
      if (body.model) params.model = body.model;
      if (body.effort) params.effort = body.effort;
      return await codex.request("turn/start", params, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
    });
    sendJson(res, 200, result);
    return;
  }
  const interrupt = url.pathname.match(/^\/api\/threads\/([^/]+)\/turns\/([^/]+)\/interrupt$/);
  if (interrupt && req.method === "POST") {
    sendJson(res, 200, await codex.request("turn/interrupt", {
      threadId: decodeURIComponent(interrupt[1]),
      turnId: decodeURIComponent(interrupt[2]),
    }, { timeoutMs: 20000, retry: false }));
    return;
  }
  sendJson(res, 404, { error: "Not found" });
}

function handleEvents(req, res) {
  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`data: ${JSON.stringify({ type: "status", status: codex.status() })}\n\n`);
  for (const request of codex.pendingServerRequests()) {
    res.write(`data: ${JSON.stringify({ type: "serverRequest", request })}\n\n`);
  }
  clients.add(res);
  const heartbeat = setInterval(() => {
    try {
      if (res.destroyed || res.writableEnded || !res.write(": keepalive\n\n")) {
        removeEventClient(res);
      }
    } catch (_) {
      removeEventClient(res);
    }
  }, 25000);
  clientHeartbeats.set(res, heartbeat);
  req.on("close", () => {
    removeEventClient(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = getUrl(req);
    if (url.pathname === "/api/events") {
      handleEvents(req, res);
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }
    serveStatic(req, res);
  } catch (err) {
    sendJson(res, 500, { error: err.message || String(err) });
  }
});

function shutdown() {
  try {
    if (codex.ws) codex.ws.close();
  } catch (_) {}
  try {
    if (codex.child && codex.child.exitCode === null) codex.child.kill();
  } catch (_) {}
  process.exit(0);
}

if (require.main === module) {
  process.on("SIGINT", () => shutdown());
  process.on("SIGTERM", () => shutdown());

  server.listen(PORT, HOST, () => {
    console.log(`Codex Mobile Web listening on http://${HOST}:${PORT}`);
    console.log(`Codex app-server will be managed on 127.0.0.1 when first used.`);
    console.log(DISABLE_AUTH ? "Authentication disabled by CODEX_MOBILE_DISABLE_AUTH." : `Authentication enabled; key source is env CODEX_MOBILE_KEY or ${AUTH_KEY_FILE}.`);
  });
}

module.exports = {
  approvalResponsePayload,
  compactApprovalParams,
  publicServerRequest,
};
