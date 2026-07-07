"use strict";

(function attachApiClientRuntime(root) {
const FRONTEND_DIAGNOSTIC_LOG_VERSION = "20260706-v1";
const STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENABLED = "codexMobileFrontendDiagnosticLogEnabled";
const STORAGE_FRONTEND_DIAGNOSTIC_LOG_UPLOAD = "codexMobileFrontendDiagnosticLogUpload";
const STORAGE_FRONTEND_DIAGNOSTIC_LOG_SCOPES = "codexMobileFrontendDiagnosticLogScopes";
const STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENTRIES = "codexMobileFrontendDiagnosticLogEntries";
const STORAGE_FRONTEND_DIAGNOSTIC_LOG_MAX_ENTRIES = "codexMobileFrontendDiagnosticLogMaxEntries";
const STORAGE_FRONTEND_DIAGNOSTIC_LOG_SERVER_ENABLED = "codexMobileFrontendDiagnosticLogServerEnabled";
const THREAD_LIST_RUNTIME_RECENT_INPUT_MS = 10000;
let frontendDiagnosticLogUrlParamsApplied = false;

async function api(path, options = {}) {
  return apiClient.request(path, options);
}

function postClientEvent(event, details = {}) {
  if (!state.key) return;
  const payload = JSON.stringify({
    event,
    threadId: state.currentThreadId || "",
    path: location.pathname || "/",
    details,
  });
  const url = `/api/client-events?key=${encodeURIComponent(state.key)}`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      }
    } catch (_) {}
  });
}

function nowPerfMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function roundedDurationMs(startedAt) {
  return Math.max(0, Math.round(nowPerfMs() - Number(startedAt || 0)));
}

function postPerformanceEvent(event, details = {}, options = {}) {
  const now = Date.now();
  const key = String(options.key || event || "");
  const minIntervalMs = Math.max(0, Number(options.minIntervalMs || 0));
  if (key && minIntervalMs > 0) {
    const last = Number(state.perfEventLastReportedAt[key] || 0);
    if (!options.force && last && now - last < minIntervalMs) return false;
    state.perfEventLastReportedAt[key] = now;
  }
  postClientEvent(event, Object.assign({
    pwa: isPwaMode(),
    embedded: isHermesEmbedMode(),
    visibility: document.visibilityState || "",
    clientBuildId: CLIENT_BUILD_ID,
  }, details || {}));
  return true;
}

function diagnosticHash(value) {
  return homeAiDiagnosticReportingApi.hashIdentifier(String(value || ""), "h");
}

function diagnosticThreadHash(threadId = state.currentThreadId) {
  const id = String(threadId || "").trim();
  return id ? diagnosticHash(`thread:${id}`) : "";
}

function diagnosticTurnHash(turnId) {
  const id = String(turnId || "").trim();
  return id ? diagnosticHash(`turn:${id}`) : "";
}

function diagnosticTaskHash(taskId) {
  const id = String(taskId || "").trim();
  return id ? diagnosticHash(`task:${id}`) : "";
}

function diagnosticItemHash(itemId) {
  const id = String(itemId || "").trim();
  return id ? diagnosticHash(`item:${id}`) : "";
}

function clientSubmissionDiagnosticHash(clientSubmissionId) {
  const id = String(clientSubmissionId || "").trim();
  return id ? diagnosticHash(`submission:${id}`) : "";
}

function clientSubmissionDataAttr(item) {
  const hash = clientSubmissionDiagnosticHash(item && item.clientSubmissionId);
  return hash ? ` data-client-submission-hash="${escapeHtml(hash)}"` : "";
}

function frontendDiagnosticLogStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return "";
  }
}

function frontendDiagnosticLogStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (_) {
    return false;
  }
}

function frontendDiagnosticLogStorageRemove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (_) {
    return false;
  }
}

function truthyFrontendDiagnosticLogValue(value) {
  return /^(1|true|yes|on|enable|enabled)$/i.test(String(value || "").trim());
}

function falseyFrontendDiagnosticLogValue(value) {
  return /^(0|false|no|off|disable|disabled)$/i.test(String(value || "").trim());
}

function normalizeFrontendDiagnosticLogScopes(value) {
  const raw = Array.isArray(value) ? value.join(",") : String(value || "");
  const scopes = raw
    .split(/[,\s]+/g)
    .map((item) => item.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_"))
    .filter(Boolean)
    .slice(0, 24);
  return scopes.length ? Array.from(new Set(scopes)) : ["submitted_echo"];
}

function boundedFrontendDiagnosticLogMaxEntries(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 400;
  return Math.max(25, Math.min(2000, Math.trunc(number)));
}

function applyFrontendDiagnosticLogUrlParams() {
  if (frontendDiagnosticLogUrlParamsApplied) return;
  frontendDiagnosticLogUrlParamsApplied = true;
  let params = null;
  try {
    params = new URL(window.location.href).searchParams;
  } catch (_) {
    return;
  }
  const enabledValue = params.get("codexFrontendLog") || params.get("codexMobileFrontendLog") || params.get("clientLog");
  if (truthyFrontendDiagnosticLogValue(enabledValue)) {
    frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENABLED, "1");
  } else if (falseyFrontendDiagnosticLogValue(enabledValue)) {
    frontendDiagnosticLogStorageRemove(STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENABLED);
  }
  const uploadValue = params.get("codexFrontendLogUpload") || params.get("clientLogUpload");
  if (truthyFrontendDiagnosticLogValue(uploadValue)) {
    frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_UPLOAD, "1");
  } else if (falseyFrontendDiagnosticLogValue(uploadValue)) {
    frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_UPLOAD, "0");
  }
  const scopesValue = params.get("codexFrontendLogScopes") || params.get("clientLogScopes");
  if (String(scopesValue || "").trim()) {
    frontendDiagnosticLogStorageSet(
      STORAGE_FRONTEND_DIAGNOSTIC_LOG_SCOPES,
      normalizeFrontendDiagnosticLogScopes(scopesValue).join(","),
    );
  }
}

function frontendDiagnosticLogSettings() {
  applyFrontendDiagnosticLogUrlParams();
  const enabled = truthyFrontendDiagnosticLogValue(
    frontendDiagnosticLogStorageGet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENABLED),
  );
  const uploadRaw = frontendDiagnosticLogStorageGet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_UPLOAD);
  const upload = !falseyFrontendDiagnosticLogValue(uploadRaw);
  const scopes = normalizeFrontendDiagnosticLogScopes(
    frontendDiagnosticLogStorageGet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_SCOPES) || "submitted_echo",
  );
  const maxEntries = boundedFrontendDiagnosticLogMaxEntries(
    frontendDiagnosticLogStorageGet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_MAX_ENTRIES),
  );
  return { enabled, upload, scopes, maxEntries, version: FRONTEND_DIAGNOSTIC_LOG_VERSION };
}

function frontendDiagnosticLogScopeEnabled(scope, settings = frontendDiagnosticLogSettings()) {
  if (!settings.enabled) return false;
  const normalized = normalizeFrontendDiagnosticLogScopes(scope || "general")[0] || "general";
  return settings.scopes.includes("all") || settings.scopes.includes(normalized);
}

function readFrontendDiagnosticLog() {
  try {
    const entries = JSON.parse(frontendDiagnosticLogStorageGet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENTRIES) || "[]");
    return Array.isArray(entries) ? entries : [];
  } catch (_) {
    return [];
  }
}

function writeFrontendDiagnosticLog(entries, maxEntries = 400) {
  const boundedEntries = (Array.isArray(entries) ? entries : []).slice(-boundedFrontendDiagnosticLogMaxEntries(maxEntries));
  return frontendDiagnosticLogStorageSet(
    STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENTRIES,
    JSON.stringify(boundedEntries),
  );
}

function clearFrontendDiagnosticLog() {
  return frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENTRIES, "[]");
}

function frontendDiagnosticLogStatus() {
  const settings = frontendDiagnosticLogSettings();
  return Object.assign({}, settings, {
    count: readFrontendDiagnosticLog().length,
    storageKey: STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENTRIES,
  });
}

function setFrontendDiagnosticLogEnabled(enabled, options = {}) {
  if (enabled) frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENABLED, "1");
  else frontendDiagnosticLogStorageRemove(STORAGE_FRONTEND_DIAGNOSTIC_LOG_ENABLED);
  if (Object.prototype.hasOwnProperty.call(options, "upload")) {
    frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_UPLOAD, options.upload === false ? "0" : "1");
  }
  if (options.scopes) {
    frontendDiagnosticLogStorageSet(
      STORAGE_FRONTEND_DIAGNOSTIC_LOG_SCOPES,
      normalizeFrontendDiagnosticLogScopes(options.scopes).join(","),
    );
  }
  if (options.maxEntries) {
    frontendDiagnosticLogStorageSet(
      STORAGE_FRONTEND_DIAGNOSTIC_LOG_MAX_ENTRIES,
      String(boundedFrontendDiagnosticLogMaxEntries(options.maxEntries)),
    );
  }
  return frontendDiagnosticLogStatus();
}

function configureFrontendDiagnosticLog(options = {}) {
  const hasEnabled = Object.prototype.hasOwnProperty.call(options, "enabled");
  if (hasEnabled) return setFrontendDiagnosticLogEnabled(Boolean(options.enabled), options);
  if (Object.prototype.hasOwnProperty.call(options, "upload")) {
    frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_UPLOAD, options.upload === false ? "0" : "1");
  }
  if (options.scopes) {
    frontendDiagnosticLogStorageSet(
      STORAGE_FRONTEND_DIAGNOSTIC_LOG_SCOPES,
      normalizeFrontendDiagnosticLogScopes(options.scopes).join(","),
    );
  }
  if (options.maxEntries) {
    frontendDiagnosticLogStorageSet(
      STORAGE_FRONTEND_DIAGNOSTIC_LOG_MAX_ENTRIES,
      String(boundedFrontendDiagnosticLogMaxEntries(options.maxEntries)),
    );
  }
  return frontendDiagnosticLogStatus();
}

function applyFrontendDiagnosticLogPublicConfig(config = {}) {
  const raw = config && config.frontendDiagnosticLog && typeof config.frontendDiagnosticLog === "object"
    ? config.frontendDiagnosticLog
    : null;
  if (!raw || typeof raw.enabled !== "boolean") return frontendDiagnosticLogStatus();
  if (raw.enabled) {
    frontendDiagnosticLogStorageSet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_SERVER_ENABLED, "1");
    return setFrontendDiagnosticLogEnabled(true, {
      upload: raw.upload !== false,
      scopes: raw.scopes || "submitted_echo",
      maxEntries: raw.maxEntries || 400,
    });
  }
  if (truthyFrontendDiagnosticLogValue(frontendDiagnosticLogStorageGet(STORAGE_FRONTEND_DIAGNOSTIC_LOG_SERVER_ENABLED))) {
    frontendDiagnosticLogStorageRemove(STORAGE_FRONTEND_DIAGNOSTIC_LOG_SERVER_ENABLED);
    return setFrontendDiagnosticLogEnabled(false);
  }
  return frontendDiagnosticLogStatus();
}

function exportFrontendDiagnosticLog() {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    status: frontendDiagnosticLogStatus(),
    entries: readFrontendDiagnosticLog(),
  });
}

function frontendDiagnosticLogSensitiveKey(key) {
  return /(text|content|body|message|prompt|html|markdown|secret|token|cookie|authorization|password|access|launchkey|path|url|filename|file)/i
    .test(String(key || ""));
}

function sanitizeFrontendDiagnosticLogValue(value, key = "", depth = 0) {
  if (value == null) return value;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    const raw = String(value || "");
    if (frontendDiagnosticLogSensitiveKey(key)) {
      return raw ? { hash: diagnosticHash(`${key}:${raw}`), length: raw.length } : "";
    }
    return raw.length > 160 ? `${raw.slice(0, 157)}...` : raw;
  }
  if (Array.isArray(value)) {
    if (depth >= 3) return { arrayLength: value.length };
    return value.slice(0, 20).map((item) => sanitizeFrontendDiagnosticLogValue(item, key, depth + 1));
  }
  if (typeof value === "object") {
    if (depth >= 3) return { objectKeys: Object.keys(value).slice(0, 20) };
    const out = {};
    for (const [entryKey, entryValue] of Object.entries(value).slice(0, 50)) {
      out[entryKey] = sanitizeFrontendDiagnosticLogValue(entryValue, entryKey, depth + 1);
    }
    return out;
  }
  return String(value).slice(0, 120);
}

function frontendDiagnosticLogThreadForId(threadId) {
  const id = String(threadId || "").trim();
  if (!id) return null;
  if (state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
  if (state.threadTileDetails && typeof state.threadTileDetails.get === "function") return state.threadTileDetails.get(id) || null;
  return null;
}

function submittedEchoItemSource(item) {
  if (!item || item.type !== "userMessage") return "";
  if (typeof isOptimisticUserMessage === "function" && isOptimisticUserMessage(item)) return "optimistic";
  if (item.mobilePendingSubmission) return "pending";
  if (item.clientSubmissionId) return "client-submission";
  if (item.id) return "durable";
  return "unknown";
}

function submittedEchoItemTextHash(item) {
  const text = typeof itemTextValue === "function"
    ? itemTextValue(item && (item.text || item.message || item.content || item.summary || item.input))
    : "";
  return text ? stableTextHash(text) : "";
}

function submittedEchoThreadSnapshot(thread, clientSubmissionId = "") {
  const submissionId = String(clientSubmissionId || "").trim();
  const submissionHash = clientSubmissionDiagnosticHash(submissionId);
  const entries = [];
  let userMessageCount = 0;
  let matchingSubmissionCount = 0;
  let optimisticCount = 0;
  let durableCount = 0;
  let localTurnCount = 0;
  const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
  turns.forEach((turn, turnIndex) => {
    const turnId = String(turn && turn.id || "");
    if (/^local-turn-/.test(turnId)) localTurnCount += 1;
    const items = Array.isArray(turn && turn.items) ? turn.items : [];
    items.forEach((item, itemIndex) => {
      if (!item || item.type !== "userMessage") return;
      userMessageCount += 1;
      const source = submittedEchoItemSource(item);
      if (source === "optimistic" || source === "pending") optimisticCount += 1;
      else durableCount += 1;
      const matchesSubmission = Boolean(submissionId && String(item.clientSubmissionId || "") === submissionId);
      if (matchesSubmission) matchingSubmissionCount += 1;
      if (matchesSubmission || entries.length < 8) {
        entries.push({
          turnIndex,
          itemIndex,
          turnHash: diagnosticTurnHash(turnId),
          itemHash: diagnosticItemHash(item.id || `${turnId}:${itemIndex}`),
          renderKeyHash: diagnosticItemHash(item.mobileRenderKey || item.id || `${turnId}:${itemIndex}`),
          source,
          matchesSubmission,
          clientSubmissionHash: clientSubmissionDiagnosticHash(item.clientSubmissionId || ""),
          textHash: submittedEchoItemTextHash(item),
          turnStatus: statusText(turn && turn.status),
        });
      }
    });
  });
  return {
    threadHash: diagnosticThreadHash(thread && thread.id || ""),
    submissionHash,
    status: statusText(thread && thread.status),
    turnCount: turns.length,
    localTurnCount,
    userMessageCount,
    matchingSubmissionCount,
    optimisticCount,
    durableCount,
    entries: entries.slice(0, 12),
  };
}

function submittedEchoDomSnapshot(clientSubmissionId = "") {
  const submissionHash = clientSubmissionDiagnosticHash(clientSubmissionId);
  const conversation = $("conversation");
  if (!conversation) {
    return {
      submissionHash,
      available: false,
      itemCount: 0,
      userMessageCount: 0,
      matchingSubmissionCount: 0,
      duplicateUserMessageCount: 0,
      duplicateRenderKeyCount: 0,
      entries: [],
    };
  }
  const shape = conversationDomShape();
  const userNodes = Array.from(conversation.querySelectorAll(".item.userMessage"));
  const entries = [];
  let matchingSubmissionCount = 0;
  userNodes.forEach((node, index) => {
    const nodeSubmissionHash = String(node.getAttribute("data-client-submission-hash") || "");
    const matchesSubmission = Boolean(submissionHash && nodeSubmissionHash === submissionHash);
    if (matchesSubmission) matchingSubmissionCount += 1;
    if (matchesSubmission || entries.length < 8) {
      const turnNode = node.closest("article.turn[data-turn], article.thread-tile-turn[data-thread-tile-turn]");
      entries.push({
        index,
        fromTail: userNodes.length - index - 1,
        matchesSubmission,
        clientSubmissionHash: nodeSubmissionHash,
        turnHash: diagnosticTurnHash(
          turnNode && (turnNode.getAttribute("data-turn") || turnNode.getAttribute("data-thread-tile-turn")) || "",
        ),
        itemHash: diagnosticItemHash(node.getAttribute("data-item") || ""),
        renderKeyHash: diagnosticItemHash(node.getAttribute("data-render-key") || ""),
        textHash: stableTextHash(String(node.textContent || "")),
      });
    }
  });
  return {
    submissionHash,
    available: true,
    itemCount: shape.itemCount,
    turnCount: shape.turnCount,
    userMessageCount: userNodes.length,
    matchingSubmissionCount,
    duplicateUserMessageCount: shape.duplicateUserMessageCount,
    duplicateRenderKeyCount: shape.duplicateRenderKeyCount,
    entries: entries.slice(0, 12),
  };
}

function submittedEchoDiagnosticSnapshot(input = {}) {
  const threadId = String(input.threadId || state.currentThreadId || "").trim();
  const clientSubmissionId = String(input.clientSubmissionId || "").trim();
  const thread = input.thread || frontendDiagnosticLogThreadForId(threadId);
  return {
    threadId,
    threadHash: diagnosticThreadHash(threadId),
    submissionHash: clientSubmissionDiagnosticHash(clientSubmissionId),
    routeKind: diagnosticRouteKind(),
    currentThreadMatch: Boolean(threadId && String(state.currentThreadId || "") === threadId),
    thread: submittedEchoThreadSnapshot(thread, clientSubmissionId),
    dom: submittedEchoDomSnapshot(clientSubmissionId),
  };
}

function recordFrontendDiagnosticLog(event, details = {}, options = {}) {
  const scope = normalizeFrontendDiagnosticLogScopes(options.scope || details.scope || event || "general")[0] || "general";
  const settings = frontendDiagnosticLogSettings();
  if (!options.force && !frontendDiagnosticLogScopeEnabled(scope, settings)) return false;
  const threadId = String(details.threadId || state.currentThreadId || "").trim();
  state.frontendDiagnosticLogSeq = Number(state.frontendDiagnosticLogSeq || 0) + 1;
  const entry = {
    version: FRONTEND_DIAGNOSTIC_LOG_VERSION,
    seq: state.frontendDiagnosticLogSeq,
    at: new Date().toISOString(),
    event: String(event || "frontend_diagnostic").slice(0, 100),
    scope,
    threadId,
    threadHash: diagnosticThreadHash(threadId),
    routeKind: diagnosticRouteKind(),
    visibility: document.visibilityState || "",
    clientBuildId: CLIENT_BUILD_ID,
    details: sanitizeFrontendDiagnosticLogValue(details || {}),
  };
  const entries = readFrontendDiagnosticLog();
  entries.push(entry);
  writeFrontendDiagnosticLog(entries, settings.maxEntries);
  if (settings.upload && state.key) {
    postClientEvent("frontend_diagnostic_log", entry);
  }
  return entry;
}

function recordSubmittedEchoDiagnosticLog(stage, details = {}, options = {}) {
  const payload = Object.assign({
    stage: String(stage || "unknown").slice(0, 80),
  }, details || {});
  const snapshot = submittedEchoDiagnosticSnapshot(payload);
  payload.threadHash = snapshot.threadHash;
  payload.submissionHash = snapshot.submissionHash;
  payload.snapshot = snapshot;
  return recordFrontendDiagnosticLog("submitted_echo_lifecycle", payload, Object.assign({ scope: "submitted_echo" }, options || {}));
}

function recordRecentSubmittedEchoDiagnosticLogs(stage, details = {}, options = {}) {
  const records = state.recentSubmittedUserMessages;
  if (!records || typeof records.entries !== "function") return 0;
  const threadId = String(details.threadId || state.currentThreadId || "").trim();
  let count = 0;
  for (const [clientSubmissionId, record] of Array.from(records.entries()).slice(-20)) {
    if (threadId && String(record && record.threadId || "") !== threadId) continue;
    if (recordSubmittedEchoDiagnosticLog(stage, Object.assign({}, details, {
      clientSubmissionId,
      threadId: String(record && record.threadId || threadId || ""),
    }), options)) count += 1;
  }
  return count;
}

const frontendDiagnosticLogApi = Object.freeze({
  enable: (options = {}) => setFrontendDiagnosticLogEnabled(true, options),
  disable: () => setFrontendDiagnosticLogEnabled(false),
  configure: configureFrontendDiagnosticLog,
  applyPublicConfig: applyFrontendDiagnosticLogPublicConfig,
  status: frontendDiagnosticLogStatus,
  read: readFrontendDiagnosticLog,
  export: exportFrontendDiagnosticLog,
  clear: clearFrontendDiagnosticLog,
  record: recordFrontendDiagnosticLog,
  recordSubmittedEcho: recordSubmittedEchoDiagnosticLog,
  snapshotSubmittedEcho: submittedEchoDiagnosticSnapshot,
});

function diagnosticRouteKind() {
  if (state.newThreadDraft) return "new-thread";
  if (isHermesEmbedMode() && isHermesPluginPrimaryPage()) return "embedded-primary";
  if (state.threadTileMode) return "thread-tile";
  if (state.currentThreadId) return "thread-detail";
  return isHermesEmbedMode() ? "embedded-root" : "standalone-root";
}

function diagnosticErrorStatus(err) {
  let status = Number(err && (err.status || err.statusCode) || 0);
  if ((!Number.isFinite(status) || status <= 0) && err && /^\d+$/.test(String(err.code || ""))) {
    status = Number(err.code);
  }
  return Number.isFinite(status) && status > 0 ? status : 0;
}

function diagnosticErrorCode(err, fallback = "runtime_failed") {
  const explicit = String(err && err.code || "").trim();
  if (explicit && !/^\d+$/.test(explicit)) return homeAiDiagnosticReportingApi.boundedToken(explicit, fallback, 100);
  const status = diagnosticErrorStatus(err);
  if (status) return `http_${status}`;
  const message = String(err && err.message || err || "").toLowerCase();
  if (message.includes("request timed out")) return "request_timeout";
  if (message.includes("request cancelled")) return "request_cancelled";
  if (message.includes("failed to fetch")) return "network_fetch_failed";
  if (message.includes("not visible")) return "target_thread_not_visible";
  if (message.includes("terminal") && message.includes("return")) return "terminal_card_no_return_required";
  return fallback;
}

function diagnosticDurationBucket(ms) {
  return homeAiDiagnosticReportingApi.durationBucket(ms);
}

function currentHomeAiDiagnosticContext(extra = {}) {
  const context = Object.assign({
    surface: "runtime",
    action: "unknown",
    route_kind: diagnosticRouteKind(),
    build_id: CLIENT_BUILD_ID,
    shell_cache: CLIENT_BUILD_ID.split("|").pop() || "",
    thread_hash: diagnosticThreadHash(),
    embedded: isHermesEmbedMode(),
    pwa: isPwaMode(),
    client_visibility: document.visibilityState || "",
  }, extra || {});
  if (!context.thread_hash) delete context.thread_hash;
  return context;
}

function postHomeAiDiagnosticReport(report, meta = {}) {
  const targetOrigin = normalizePluginParentOrigin(state.pluginParentOrigin);
  if (targetOrigin) state.pluginParentOrigin = targetOrigin;
  const result = homeAiDiagnosticReportingApi.postReportToHomeAi({
    report,
    embedded: isHermesEmbedMode(),
    parentWindow: window.parent,
    selfWindow: window,
    targetOrigin: targetOrigin || "*",
  });
  postClientEvent("home_ai_diagnostic_report_post", {
    ok: Boolean(result.ok),
    reason: result.reason || "",
    category: report && report.category || "",
    diagnostic_type: report && report.diagnostic_type || "",
    error_code: report && report.error_code || "",
    signature: meta.signature || "",
    repeatedFailures: Number(meta.repeatedFailures || 0),
  });
  return result;
}

function recordHomeAiDiagnosticFailure(input = {}) {
  const result = state.homeAiDiagnosticReporter.recordFailure(Object.assign({}, input, {
    context: currentHomeAiDiagnosticContext(input.context || {}),
  }));
  postClientEvent("home_ai_diagnostic_failure_recorded", {
    category: input.category || "",
    diagnostic_type: input.diagnostic_type || input.diagnosticType || "",
    error_code: input.error_code || input.errorCode || "",
    eligible: Boolean(result.eligible),
    repeatedFailures: Number(result.repeatedFailures || 0),
    threshold: Number(result.threshold || 0),
    signature: result.signature || "",
    observeOnly: Boolean(result.observeOnly),
    reason: result.reason || "",
  });
  if (result.report) postHomeAiDiagnosticReport(result.report, result);
  return result;
}

function recordHomeAiDiagnosticSuccess(input = {}) {
  return state.homeAiDiagnosticReporter.recordSuccess(Object.assign({}, input, {
    context: currentHomeAiDiagnosticContext(input.context || {}),
  }));
}

function applyFrontendRuntimeHealthEffect(effect) {
  const item = effect && typeof effect === "object" ? effect : {};
  if (!item.type) return;
  if (item.type === "diagnostic-failure") {
    recordHomeAiDiagnosticFailure(item.diagnostic || {});
    return;
  }
  if (item.type === "diagnostic-success") {
    recordHomeAiDiagnosticSuccess(item.diagnostic || {});
    return;
  }
  if (item.type === "render-current-thread") {
    const renderer = typeof root.renderCurrentThread === "function" ? root.renderCurrentThread : null;
    if (renderer) {
      renderer({
        stickToBottom: item.stickToBottom !== false,
        source: item.reason || "frontend-runtime-health",
      });
    }
    return;
  }
  throw new Error(`Unknown frontend runtime health effect: ${item.type}`);
}

function applyFrontendRuntimeHealthEffectsPlan(plan) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  for (const effect of effects) applyFrontendRuntimeHealthEffect(effect);
}

function threadListRuntimeMetrics() {
  const list = $("threadList");
  if (!list || typeof list.getBoundingClientRect !== "function") {
    return {
      present: false,
      visible: false,
      threadListCount: 0,
      scrollTop: 0,
      scrollHeight: 0,
    };
  }
  const rect = list.getBoundingClientRect();
  const viewportWidth = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
  const viewportHeight = Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
  const visible = document.visibilityState !== "hidden"
    && rect.width > 0
    && rect.height > 0
    && rect.bottom > 0
    && rect.right > 0
    && rect.top < viewportHeight
    && rect.left < viewportWidth;
  return {
    present: true,
    visible,
    threadListCount: list.querySelectorAll("[data-thread]").length,
    scrollTop: Math.max(0, Math.round(Number(list.scrollTop || 0))),
    scrollHeight: Math.max(0, Math.round(Number(list.scrollHeight || 0))),
  };
}

function recordThreadListRuntimeStall(input = {}) {
  const now = Date.now();
  if (now - Number(state.threadListRuntimeLastReportAt || 0) < THREAD_LIST_RUNTIME_STALL_REPORT_INTERVAL_MS) return false;
  const metrics = threadListRuntimeMetrics();
  const routeKind = diagnosticRouteKind();
  const threadListMonitorable = metrics.visible
    || (metrics.present && document.visibilityState !== "hidden" && (
      routeKind === "embedded-primary" || routeKind === "standalone-root"
    ));
  const lastInputAt = Number(state.threadListRuntimeLastInputAt || 0);
  const recentInputAgeMs = lastInputAt > 0 ? Math.max(0, now - lastInputAt) : 0;
  const recentThreadListInput = lastInputAt > 0 && recentInputAgeMs <= THREAD_LIST_RUNTIME_RECENT_INPUT_MS;
  const plan = frontendRuntimeHealthApi.threadListInteractionStallEffects(Object.assign({
    threadListVisible: metrics.visible,
    threadListMonitorable,
    routeKind,
    minDelayMs: THREAD_LIST_RUNTIME_STALL_MIN_MS,
    h2ThresholdMs: THREAD_LIST_RUNTIME_STALL_H2_MS,
    recentThreadListInput,
    recentInputAgeMs,
    threadListCount: metrics.threadListCount,
    scrollTop: metrics.scrollTop,
    scrollHeight: metrics.scrollHeight,
  }, input || {}));
  if (!plan.effects || !plan.effects.length) return false;
  state.threadListRuntimeLastReportAt = now;
  applyFrontendRuntimeHealthEffectsPlan(plan);
  postPerformanceEvent("thread_list_runtime_stall", {
    action: input.action || "thread-list-runtime",
    routeKind,
    maxRafDelayMs: Math.max(0, Math.round(Number(input.maxRafDelayMs || 0))),
    maxScrollApplyMs: Math.max(0, Math.round(Number(input.maxScrollApplyMs || 0))),
    maxLongTaskMs: Math.max(0, Math.round(Number(input.maxLongTaskMs || 0))),
    longTaskCount: Math.max(0, Math.round(Number(input.longTaskCount || 0))),
    recentThreadListInput,
    recentInputAgeMs,
    threadListCount: metrics.threadListCount,
    threadListVisible: Boolean(metrics.visible),
    threadListMonitorable: Boolean(threadListMonitorable),
  }, { key: "thread-list-runtime-stall", minIntervalMs: THREAD_LIST_RUNTIME_STALL_REPORT_INTERVAL_MS });
  return true;
}

function sampleThreadListInputDelay(action = "thread-list-input") {
  const metrics = threadListRuntimeMetrics();
  if (!metrics.visible) return;
  state.threadListRuntimeLastInputAt = Date.now();
  const list = $("threadList");
  const startedAt = nowPerfMs();
  const startScrollTop = list ? Number(list.scrollTop || 0) : 0;
  requestAnimationFrame(() => {
    const rafDelayMs = roundedDurationMs(startedAt);
    requestAnimationFrame(() => {
      const elapsedMs = roundedDurationMs(startedAt);
      const nextScrollTop = list ? Number(list.scrollTop || 0) : startScrollTop;
      const scrollApplyMs = nextScrollTop !== startScrollTop ? elapsedMs : rafDelayMs;
      recordThreadListRuntimeStall({
        action,
        maxRafDelayMs: rafDelayMs,
        maxScrollApplyMs: scrollApplyMs,
        elapsedMs,
      });
    });
  });
}

function startThreadListRuntimeHeartbeat() {
  if (state.threadListRuntimeHeartbeatFrame) return;
  const tick = (timestamp) => {
    const previous = Number(state.threadListRuntimeLastFrameAt || 0);
    if (previous > 0) {
      const delayMs = Math.max(0, Math.round(Number(timestamp || 0) - previous));
      if (delayMs >= THREAD_LIST_RUNTIME_STALL_MIN_MS) {
        recordThreadListRuntimeStall({
          action: "thread-list-heartbeat",
          maxRafDelayMs: delayMs,
          elapsedMs: delayMs,
        });
      }
    }
    state.threadListRuntimeLastFrameAt = Number(timestamp || nowPerfMs());
    state.threadListRuntimeHeartbeatFrame = requestAnimationFrame(tick);
  };
  state.threadListRuntimeHeartbeatFrame = requestAnimationFrame(tick);
}

function startThreadListRuntimeLongTaskObserver() {
  if (state.threadListRuntimeLongTaskObserver || typeof PerformanceObserver !== "function") return;
  try {
    const observer = new PerformanceObserver((list) => {
      let maxLongTaskMs = 0;
      let longTaskCount = 0;
      for (const entry of list.getEntries()) {
        const duration = Math.max(0, Math.round(Number(entry && entry.duration || 0)));
        if (duration < THREAD_LIST_RUNTIME_STALL_MIN_MS) continue;
        maxLongTaskMs = Math.max(maxLongTaskMs, duration);
        longTaskCount += 1;
      }
      if (maxLongTaskMs > 0) {
        recordThreadListRuntimeStall({
          action: "thread-list-longtask",
          maxLongTaskMs,
          longTaskCount,
          elapsedMs: maxLongTaskMs,
        });
      }
    });
    observer.observe({ type: "longtask", buffered: true });
    state.threadListRuntimeLongTaskObserver = observer;
  } catch (_) {
    state.threadListRuntimeLongTaskObserver = null;
  }
}

function startThreadListRuntimeStallMonitoring() {
  const list = $("threadList");
  if (list) {
    ["pointerdown", "touchstart", "wheel", "scroll"].forEach((eventName) => {
      list.addEventListener(eventName, () => sampleThreadListInputDelay(`thread-list-${eventName}`), { passive: true });
    });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") state.threadListRuntimeLastFrameAt = 0;
  });
  startThreadListRuntimeHeartbeat();
  startThreadListRuntimeLongTaskObserver();
}

function conversationHasClientSubmissionHash(submissionHash) {
  const hash = String(submissionHash || "").trim();
  const conversation = $("conversation");
  if (!hash || !conversation) return false;
  return Array.from(conversation.querySelectorAll("[data-client-submission-hash]"))
    .some((node) => String(node && node.getAttribute && node.getAttribute("data-client-submission-hash") || "") === hash);
}

function frontendHealthThreadForSubmission(threadId) {
  const id = String(threadId || "").trim();
  if (!id) return null;
  if (state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
  return state.threadTileDetails && state.threadTileDetails.get(id) || null;
}

function probeSubmittedMessageDom(threadId, clientSubmissionId, action = "message-submit", startedAtMs = Date.now()) {
  const id = String(threadId || "").trim();
  const submissionId = String(clientSubmissionId || "").trim();
  const submissionHash = clientSubmissionDiagnosticHash(submissionId);
  if (!id || !submissionId || !submissionHash) return;
  const elapsedMs = Date.now() - Number(startedAtMs || Date.now());
  const thread = frontendHealthThreadForSubmission(id);
  const domShape = conversationDomShape();
  const visibleShape = thread ? visibleConversationShape(thread) : { visibleItemCount: 0 };
  recordSubmittedEchoDiagnosticLog("dom-probe", {
    threadId: id,
    clientSubmissionId: submissionId,
    action,
    elapsedMs,
    domHasSubmission: conversationHasClientSubmissionHash(submissionHash),
    hasThreadSubmission: threadHasClientSubmission(thread, submissionId),
    visibleCount: visibleShape.visibleItemCount,
    domCount: domShape.itemCount,
    duplicateUserMessageCount: domShape.duplicateUserMessageCount,
    expectedDuplicateUserMessageCount: visibleShape.duplicateUserMessageCount || 0,
    composerBusy: state.composerBusy,
  });
  const plan = frontendRuntimeHealthApi.submittedMessageDomProbeEffects({
    elapsedMs,
    action,
    routeKind: diagnosticRouteKind(),
    threadHash: diagnosticThreadHash(id),
    itemHash: submissionHash,
    currentThreadMatch: !state.threadTileMode && String(state.currentThreadId || "") === id,
    hasThreadSubmission: threadHasClientSubmission(thread, submissionId),
    domHasSubmission: conversationHasClientSubmissionHash(submissionHash),
    visibleCount: visibleShape.visibleItemCount,
    domCount: domShape.itemCount,
    duplicateUserMessageCount: domShape.duplicateUserMessageCount,
    expectedDuplicateUserMessageCount: visibleShape.duplicateUserMessageCount || 0,
    composerBusy: state.composerBusy,
  });
  applyFrontendRuntimeHealthEffectsPlan(plan);
}

function scheduleSubmittedMessageDomProbe(threadId, clientSubmissionId, action = "message-submit") {
  const id = String(threadId || "").trim();
  const submissionId = String(clientSubmissionId || "").trim();
  if (!id || !submissionId) return;
  const startedAtMs = Date.now();
  [350, 1200, 2800].forEach((delayMs) => {
    setTimeout(() => probeSubmittedMessageDom(id, submissionId, action, startedAtMs), delayMs);
  });
}

function applyThreadDetailResponseDiagnosticEffect(effect) {
  const item = effect && typeof effect === "object" ? effect : {};
  if (!item.type) return;
  if (item.type === "diagnostic-failure") {
    recordHomeAiDiagnosticFailure(item.diagnostic || {});
    return;
  }
  if (item.type === "diagnostic-success") {
    recordHomeAiDiagnosticSuccess(item.diagnostic || {});
    return;
  }
  throw new Error(`Unknown thread detail response diagnostic effect: ${item.type}`);
}

function applyThreadDetailResponseDiagnosticEffectsPlan(plan) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  for (const effect of effects) applyThreadDetailResponseDiagnosticEffect(effect);
}

function recordThreadDetailResponseDiagnostics(performanceEvent = {}, input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const threadId = String(source.threadId || state.currentThreadId || "");
  const threadHash = diagnosticThreadHash(threadId);
  const action = String(source.action || "thread-detail").slice(0, 80);
  const durationBucket = source.durationBucket
    || diagnosticDurationBucket(Number(performanceEvent && performanceEvent.elapsedMs || 0));
  const slowPlan = threadPerformanceMetrics.planThreadDetailSlowPathDiagnostic(performanceEvent, {
    action,
    threadHash,
    durationBucket,
  });
  const contractPlan = threadPerformanceMetrics.planThreadDetailResponseContractDiagnostic(performanceEvent, {
    action,
    threadHash,
    durationBucket,
    thread: source.thread,
    expectedActiveFullRead: source.expectedActiveFullRead,
  });
  const effectsPlan = threadDiagnosticEventsApi.threadDetailResponseDiagnosticEffects({
    slowPlan,
    slowSuccessInput: {
      action,
      threadHash,
      readMode: performanceEvent && performanceEvent.readMode || "",
      renderMode: performanceEvent && performanceEvent.clientTimings && performanceEvent.clientTimings.detailRenderMode || "",
    },
    contractPlan,
  });
  applyThreadDetailResponseDiagnosticEffectsPlan(effectsPlan);
}

function conversationDomShape() {
  const conversation = $("conversation");
  if (!conversation) {
    return {
      renderKeyCount: 0,
      duplicateRenderKeyCount: 0,
      duplicateUserMessageCount: 0,
      turnCount: 0,
      itemCount: 0,
    };
  }
  const seen = new Set();
  let duplicateRenderKeyCount = 0;
  for (const node of Array.from(conversation.querySelectorAll("[data-render-key]"))) {
    const key = String(node && node.getAttribute && node.getAttribute("data-render-key") || "");
    if (!key) continue;
    if (seen.has(key)) duplicateRenderKeyCount += 1;
    else seen.add(key);
  }
  let duplicateUserMessageCount = 0;
  const userMessageNodes = [];
  for (const turnNode of Array.from(conversation.querySelectorAll("article.turn[data-turn], article.thread-tile-turn[data-thread-tile-turn]"))) {
    for (const node of Array.from(turnNode.querySelectorAll(".item.userMessage"))) {
      userMessageNodes.push({ turnNode, node });
    }
  }
  const eventDuplicateUserMessageCount = duplicateUserMessageSignatureCount(
    userMessageNodes,
    (entry) => domUserMessageEventDuplicateSignature(entry.turnNode, entry.node),
  );
  const turnDuplicateUserMessageCount = duplicateUserMessageSignatureCount(
    userMessageNodes,
    (entry) => domUserMessageDuplicateSignature(entry.turnNode, entry.node),
  );
  duplicateUserMessageCount = Math.max(eventDuplicateUserMessageCount, turnDuplicateUserMessageCount);
  return {
    renderKeyCount: seen.size,
    duplicateRenderKeyCount,
    duplicateUserMessageCount,
    turnCount: conversation.querySelectorAll("article.turn[data-turn], article.thread-tile-turn[data-thread-tile-turn]").length,
    itemCount: conversation.querySelectorAll("[data-item]").length,
  };
}

function duplicateUserMessageSignatureCount(entries, signatureForEntry) {
  const seen = new Set();
  let duplicates = 0;
  for (const entry of Array.isArray(entries) ? entries : []) {
    const signature = String(signatureForEntry(entry) || "").trim();
    if (!signature) continue;
    if (seen.has(signature)) duplicates += 1;
    else seen.add(signature);
  }
  return duplicates;
}

function domUserMessageDuplicateSignature(turnNode, node) {
  if (!node || !node.getAttribute) return "";
  const turnId = String(
    turnNode && turnNode.getAttribute && (turnNode.getAttribute("data-turn") || turnNode.getAttribute("data-thread-tile-turn")) || "",
  ).trim();
  const submissionHash = String(node.getAttribute("data-client-submission-hash") || "").trim();
  const body = node.querySelector && node.querySelector(".item-body");
  const text = String((body || node).textContent || "").replace(/\s+/g, " ").trim();
  if (submissionHash && text) return `submission-text:${turnId}:${submissionHash}:${stableTextHash(text)}`;
  if (submissionHash) return `submission:${turnId}:${submissionHash}`;
  return text ? `text:${turnId}:${stableTextHash(text)}` : "";
}

function domUserMessageEventDuplicateSignature(turnNode, node) {
  if (!node || !node.getAttribute) return "";
  const submissionHash = String(node.getAttribute("data-client-submission-hash") || "").trim();
  const body = node.querySelector && node.querySelector(".item-body");
  const text = String((body || node).textContent || "").replace(/\s+/g, " ").trim();
  const textHash = text ? stableTextHash(text) : "";
  if (submissionHash && textHash) return `submission-text:${submissionHash}:${textHash}`;
  if (submissionHash) return `submission:${submissionHash}`;
  if (!text) return "";
  const timestamp = node.querySelector && node.querySelector(".item-timestamp");
  const datetime = String(timestamp && timestamp.getAttribute && timestamp.getAttribute("datetime") || "").trim();
  const timestampMs = datetime ? Date.parse(datetime) : 0;
  if (Number.isFinite(timestampMs) && timestampMs > 0) return `text-time:${Math.floor(timestampMs / 5000)}:${stableTextHash(text)}`;
  return domUserMessageDuplicateSignature(turnNode, node);
}

function visibleUserMessageDuplicateSignature(turn, item) {
  if (!item || item.type !== "userMessage") return "";
  const turnId = String(turn && turn.id || turn && turn.mobileVisibleKey || "").trim();
  const submissionHash = clientSubmissionDiagnosticHash(item && item.clientSubmissionId);
  const comparable = userMessageComparableParts(item);
  const text = String(
    comparable.text
    || itemTextValue(item && item.text)
    || itemTextValue(item && item.message)
    || itemTextValue(item && item.content)
    || "",
  ).replace(/\s+/g, " ").trim();
  if (submissionHash && text) return `submission-text:${turnId}:${submissionHash}:${stableTextHash(text)}`;
  if (submissionHash) return `submission:${turnId}:${submissionHash}`;
  return text ? `text:${turnId}:${stableTextHash(text)}` : "";
}

function visibleUserMessageEventDuplicateSignature(turn, item) {
  if (!item || item.type !== "userMessage") return "";
  const submissionHash = clientSubmissionDiagnosticHash(item && item.clientSubmissionId);
  const comparable = userMessageComparableParts(item);
  const text = String(
    comparable.text
    || itemTextValue(item && item.text)
    || itemTextValue(item && item.message)
    || itemTextValue(item && item.content)
    || "",
  ).replace(/\s+/g, " ").trim();
  const textHash = text ? stableTextHash(text) : "";
  if (submissionHash && textHash) return `submission-text:${submissionHash}:${textHash}`;
  if (submissionHash) return `submission:${submissionHash}`;
  if (!text) return "";
  const timestampMs = userMessageTimestampMs(item) || turnStartedAtMs(turn);
  if (timestampMs) return `text-time:${Math.floor(timestampMs / 5000)}:${stableTextHash(text)}`;
  return visibleUserMessageDuplicateSignature(turn, item);
}

function turnRendersConversationArticle(turn, thread) {
  if (!turn || !turn.id) return false;
  if (visibleItemsForTurn(turn, thread).length > 0) return true;
  if (typeof visibleItemBudgetSignature === "function" && visibleItemBudgetSignature(turn)) return true;
  const threadId = typeof renderContextThreadId === "function"
    ? renderContextThreadId(thread)
    : String((thread && thread.id) || state.currentThreadId || "");
  if (typeof approvalsForTurn === "function" && approvalsForTurn(threadId, turn.id).length > 0) return true;
  const hasDraftResponse = typeof turnHasThreadTaskCardDraftResponse === "function"
    && turnHasThreadTaskCardDraftResponse(turn);
  if (hasDraftResponse) return true;
  return Boolean(
    typeof turnHasThreadTaskCardRequest === "function"
    && typeof isLatestTurn === "function"
    && typeof isLiveTurn === "function"
    && isLatestTurn(turn, thread)
    && isLiveTurn(turn, thread)
    && turnHasThreadTaskCardRequest(turn)
  );
}

function visibleRenderableTurnsForConversation(thread) {
  return visibleTurnsForConversation(thread)
    .filter((turn) => turnRendersConversationArticle(turn, thread));
}

function visibleConversationShape(thread) {
  const turns = visibleRenderableTurnsForConversation(thread);
  let visibleItemCount = 0;
  const userMessages = [];
  for (const turn of turns) {
    const visibleItems = visibleItemsForTurn(turn, thread);
    visibleItemCount += visibleItems.length;
    for (const entry of visibleItems) {
      const item = entry && entry.item;
      if (item && item.type === "userMessage") userMessages.push({ turn, item });
    }
  }
  const eventDuplicateUserMessageCount = duplicateUserMessageSignatureCount(
    userMessages,
    (entry) => visibleUserMessageEventDuplicateSignature(entry.turn, entry.item),
  );
  const turnDuplicateUserMessageCount = duplicateUserMessageSignatureCount(
    userMessages,
    (entry) => visibleUserMessageDuplicateSignature(entry.turn, entry.item),
  );
  const duplicateUserMessageCount = Math.max(eventDuplicateUserMessageCount, turnDuplicateUserMessageCount);
  return {
    visibleTurnCount: turns.length,
    visibleItemCount,
    duplicateUserMessageCount,
  };
}

function rememberThreadDetailRenderEvidence(thread, source = "unknown") {
  if (!thread || thread.mobileLoading || thread.mobileLoadError) return null;
  const threadId = String(thread.id || state.currentThreadId || "").trim();
  if (!threadId) return null;
  const shape = visibleConversationShape(thread);
  if (!shape.visibleTurnCount && !shape.visibleItemCount) return null;
  const turns = Array.isArray(thread.turns) ? thread.turns : [];
  const itemCount = turns.reduce((total, turn) => total + (Array.isArray(turn && turn.items) ? turn.items.length : 0), 0);
  const evidence = threadDetailStateApi.buildThreadDetailRenderEvidence({
    atMs: Date.now(),
    threadId,
    threadHash: diagnosticThreadHash(threadId),
    readMode: thread.mobileReadMode || "",
    sourceKind: homeAiDiagnosticReportingApi.boundedToken(source, "unknown", 80),
    turnCount: shape.visibleTurnCount,
    visibleItemCount: shape.visibleItemCount,
    itemCount,
  });
  if (!evidence) return null;
  state.lastThreadDetailRenderEvidence = evidence;
  return evidence;
}

function clearThreadDetailRenderEvidence(reason = "") {
  if (!state.lastThreadDetailRenderEvidence) return;
  state.lastThreadDetailRenderEvidence = null;
  postClientEvent("thread_detail_render_evidence_cleared", {
    reason: String(reason || "").slice(0, 80),
  });
}

function recentThreadDetailRenderEvidence() {
  return threadDetailStateApi.recentThreadDetailRenderEvidence({
    evidence: state.lastThreadDetailRenderEvidence,
    nowMs: Date.now(),
    maxAgeMs: PRIMARY_SHELL_CONFLICT_EVIDENCE_MS,
  });
}

function primaryShellSelectionConflictInput(reason, details = {}) {
  const evidence = recentThreadDetailRenderEvidence() || {};
  const thread = state.currentThread || null;
  const shape = thread ? visibleConversationShape(thread) : null;
  return {
    reason,
    action: "primary-shell-selection",
    routeKind: "embedded-primary",
    sourceKind: details.source || evidence.sourceKind || "",
    threadHash: evidence.threadHash || diagnosticThreadHash(state.currentThreadId || (thread && thread.id) || ""),
    readMode: evidence.readMode || (thread && thread.mobileReadMode) || "",
    renderMode: details.renderMode || "",
    turns: evidence.turnCount || (shape && shape.visibleTurnCount) || 0,
    visibleItems: evidence.visibleItemCount || (shape && shape.visibleItemCount) || 0,
    items: evidence.itemCount || 0,
    domCount: details.domCount,
    previousCount: details.previousCount,
    recentDetailAgeMs: evidence.ageMs || 0,
    hasCurrentThread: Boolean(state.currentThread),
    hasCurrentThreadId: Boolean(state.currentThreadId),
    hasThreadLoadController: Boolean(state.threadLoadController),
    startupThreadOpenPending: Boolean(state.startupThreadOpenPending),
    mobileLoading: Boolean(state.currentThread && state.currentThread.mobileLoading),
  };
}

function recordPrimaryShellSelectionConflict(reason, details = {}) {
  return recordHomeAiDiagnosticFailure(
    threadDiagnosticEventsApi.primaryShellSelectionConflictDiagnosticEvent(
      primaryShellSelectionConflictInput(reason, details),
    ),
  );
}

function recordPrimaryShellSelectionHealthy(source, thread = state.currentThread) {
  const evidence = rememberThreadDetailRenderEvidence(thread, source);
  if (!evidence) return null;
  return recordHomeAiDiagnosticSuccess(threadDiagnosticEventsApi.primaryShellSelectionConflictDiagnosticSuccess({
    action: "primary-shell-selection",
    routeKind: "embedded-primary",
    sourceKind: source,
    threadHash: evidence.threadHash,
    readMode: evidence.readMode,
  }));
}

function emptyVisibleDetailMismatchInput(reason, thread = state.currentThread, details = {}) {
  const threadId = String((thread && thread.id) || state.currentThreadId || "").trim();
  const evidence = recentThreadDetailRenderEvidence();
  const sameThreadEvidence = threadDetailStateApi.sameThreadDetailRenderEvidence({ evidence, threadId });
  const shape = thread ? visibleConversationShape(thread) : { visibleTurnCount: 0, visibleItemCount: 0 };
  return {
    reason,
    action: details.action || "single-thread-empty-state",
    routeKind: details.routeKind || "single-thread",
    sourceKind: details.source || (sameThreadEvidence && sameThreadEvidence.sourceKind) || "",
    threadHash: details.threadHash || (sameThreadEvidence && sameThreadEvidence.threadHash) || diagnosticThreadHash(threadId),
    readMode: (sameThreadEvidence && sameThreadEvidence.readMode) || (thread && thread.mobileReadMode) || "",
    renderMode: details.renderMode || "",
    turns: Object.prototype.hasOwnProperty.call(details, "turns") ? details.turns : sameThreadEvidence && sameThreadEvidence.turnCount || 0,
    visibleItems: Object.prototype.hasOwnProperty.call(details, "visibleItems") ? details.visibleItems : sameThreadEvidence && sameThreadEvidence.visibleItemCount || 0,
    items: Object.prototype.hasOwnProperty.call(details, "items") ? details.items : sameThreadEvidence && sameThreadEvidence.itemCount || 0,
    currentTurns: Object.prototype.hasOwnProperty.call(details, "currentTurns") ? details.currentTurns : shape.visibleTurnCount,
    currentVisibleItems: Object.prototype.hasOwnProperty.call(details, "currentVisibleItems") ? details.currentVisibleItems : shape.visibleItemCount,
    domCount: details.domCount,
    previousCount: details.previousCount,
    detailLoaded: Boolean(thread && thread.mobileDetailLoaded),
    mobileLoading: Boolean(thread && thread.mobileLoading),
    recentDetailAgeMs: sameThreadEvidence && sameThreadEvidence.ageMs || 0,
  };
}

function recordEmptyVisibleDetailMismatch(reason, thread = state.currentThread, details = {}) {
  return recordHomeAiDiagnosticFailure(
    threadDiagnosticEventsApi.emptyVisibleDetailMismatchDiagnosticEvent(
      emptyVisibleDetailMismatchInput(reason, thread, details),
    ),
  );
}

function recordEmptyVisibleDetailHealthy(source, thread = state.currentThread, details = {}) {
  if (!thread || thread.mobileLoading || thread.mobileLoadError) return null;
  const threadId = String(thread.id || state.currentThreadId || "").trim();
  if (!threadId) return null;
  const shape = visibleConversationShape(thread);
  if (!shape.visibleTurnCount && !shape.visibleItemCount) return null;
  return recordHomeAiDiagnosticSuccess(threadDiagnosticEventsApi.emptyVisibleDetailMismatchDiagnosticSuccess({
    action: details.action || "single-thread-empty-state",
    routeKind: details.routeKind || "single-thread",
    sourceKind: source,
    threadHash: details.threadHash || diagnosticThreadHash(threadId),
    readMode: thread.mobileReadMode || "",
    renderMode: details.renderMode || "",
  }));
}

function maybeRecoverEmptyDetailWithHistoryEvidence(thread, details = {}) {
  const now = Date.now();
  const basePlan = threadDetailStateApi.planEmptyDetailHistoryRecovery({
    thread,
    currentThreadId: state.currentThreadId,
    details,
    nowMs: now,
    cooldownMs: 0,
  });
  if (!basePlan.shouldRecover || !basePlan.recoveryKey) return false;
  const plan = threadDetailStateApi.planEmptyDetailHistoryRecovery({
    thread,
    currentThreadId: state.currentThreadId,
    details,
    nowMs: now,
    lastRecoveredAtMs: state.emptyDetailHistoryRecoveryAtByKey.get(basePlan.recoveryKey),
    cooldownMs: EMPTY_DETAIL_HISTORY_RECOVERY_COOLDOWN_MS,
  });
  if (!plan.shouldRecover || !plan.recoveryKey) return false;
  state.emptyDetailHistoryRecoveryAtByKey.set(plan.recoveryKey, plan.nowMs || now);
  recordEmptyVisibleDetailMismatch(plan.diagnosticReason || "empty_render_with_history_evidence", thread, details);
  if (!hasThreadDetailRequestInFlight()) {
    scheduleCurrentThreadRefresh(0, "empty-detail-history-evidence");
  }
  postClientEvent("empty_detail_history_recovery", plan.event || {});
  return true;
}

function emptyCachedDetailReuseInput(reason, thread = state.currentThread, details = {}) {
  const threadId = String((thread && thread.id) || state.currentThreadId || "").trim();
  const shape = thread ? visibleConversationShape(thread) : { visibleTurnCount: 0, visibleItemCount: 0 };
  const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
  const itemCount = turns.reduce((total, turn) => total + (Array.isArray(turn && turn.items) ? turn.items.length : 0), 0);
  return {
    reason,
    action: "thread-open-cache-reuse",
    routeKind: "single-thread",
    sourceKind: details.source || "",
    threadHash: diagnosticThreadHash(threadId),
    readMode: thread && thread.mobileReadMode || "",
    currentTurns: shape.visibleTurnCount,
    currentVisibleItems: shape.visibleItemCount,
    items: itemCount,
    detailLoaded: Boolean(thread && thread.mobileDetailLoaded),
    reusableDetail: Boolean(details.reusableDetail),
    mobileLoading: Boolean(thread && thread.mobileLoading),
    threadTaskCardCount: Array.isArray(thread && thread.threadTaskCards) ? thread.threadTaskCards.length : 0,
  };
}

function recordEmptyCachedDetailReuseBlocked(reason, thread = state.currentThread, details = {}) {
  return recordHomeAiDiagnosticFailure(
    threadDiagnosticEventsApi.emptyCachedDetailReuseBlockedDiagnosticEvent(
      emptyCachedDetailReuseInput(reason, thread, details),
    ),
  );
}

function recordEmptyCachedDetailReuseHealthy(source, thread = state.currentThread) {
  const threadId = String((thread && thread.id) || state.currentThreadId || "").trim();
  if (!threadId) return null;
  return recordHomeAiDiagnosticSuccess(threadDiagnosticEventsApi.emptyCachedDetailReuseDiagnosticSuccess({
    action: "thread-open-cache-reuse",
    routeKind: "single-thread",
    sourceKind: source,
    threadHash: diagnosticThreadHash(threadId),
    readMode: thread && thread.mobileReadMode || "",
  }));
}

function checkEmptyVisibleDetailMismatchAfterRender(thread, shellPlan = {}, metrics = {}) {
  if (!thread || thread.mobileLoading || thread.mobileLoadError) return;
  if (shellPlan.hasPrimaryContent || shellPlan.emptyMessage !== "No visible turns.") return;
  const threadId = String(thread.id || state.currentThreadId || "").trim();
  const evidence = recentThreadDetailRenderEvidence();
  const details = {
    source: metrics.source || "single-thread-render",
    renderMode: metrics.renderMode || "full-render",
    domCount: metrics.domCount,
    previousCount: metrics.previousCount,
  };
  if (threadDetailStateApi.hasNonemptyThreadDetailRenderEvidence(
    threadDetailStateApi.sameThreadDetailRenderEvidence({ evidence, threadId }),
  )) {
    recordEmptyVisibleDetailMismatch("empty_render_after_nonempty_detail", thread, details);
    return;
  }
  maybeRecoverEmptyDetailWithHistoryEvidence(thread, details);
}

function visibleRenderableTurnIds(thread) {
  return visibleRenderableTurnsForConversation(thread).map((turn) => String(turn.id));
}

function conversationDomTurnIds(conversation = $("conversation")) {
  if (!conversation) return [];
  return Array.from(conversation.querySelectorAll("article.turn[data-turn]"))
    .map((node) => String(node && node.getAttribute && node.getAttribute("data-turn") || ""))
    .filter(Boolean);
}

function threadTileVisibleShape(ids = state.threadTileActiveIds) {
  return (Array.isArray(ids) ? ids : []).reduce((shape, id) => {
    const thread = threadTileDisplayThread(id);
    visibleTurnsForConversation(thread).forEach((turn) => {
      const visibleItems = visibleItemsForTurn(turn, thread);
      const itemCount = visibleItems.length;
      if (itemCount > 0) {
        shape.turnCount += 1;
        shape.visibleItemCount += itemCount;
        const userMessages = visibleItems
          .map((entry) => entry && entry.item)
          .filter((item) => item && item.type === "userMessage");
        shape.duplicateUserMessageCount += duplicateUserMessageSignatureCount(
          userMessages,
          (item) => visibleUserMessageDuplicateSignature(turn, item),
        );
      }
    });
    return shape;
  }, { turnCount: 0, visibleItemCount: 0, duplicateUserMessageCount: 0 });
}

function threadTileVisibleTurnCount(ids = state.threadTileActiveIds) {
  return threadTileVisibleShape(ids).turnCount;
}

function threadTileDomTurnCount(conversation = $("conversation")) {
  if (!conversation) return 0;
  return conversation.querySelectorAll("article.thread-tile-turn[data-thread-tile-turn]").length;
}

function conversationTurnOrderDiagnosticSnapshot(source, extra = {}, deps = {}) {
  const conversation = deps.conversation || $("conversation");
  const thread = deps.thread || state.currentThread;
  if (!conversation || !thread) return null;
  const tileMode = Object.prototype.hasOwnProperty.call(deps, "threadTileMode")
    ? deps.threadTileMode === true
    : state.threadTileMode === true;
  const tileDomActive = Object.prototype.hasOwnProperty.call(deps, "tileDomActive")
    ? deps.tileDomActive === true
    : Boolean(conversation.classList && conversation.classList.contains("thread-tile-mode"));
  if (tileMode || tileDomActive) return null;
  const expectedIds = Array.isArray(deps.expectedTurnIds) ? deps.expectedTurnIds.map(String).filter(Boolean) : visibleRenderableTurnIds(thread);
  const domIds = Array.isArray(deps.domTurnIds) ? deps.domTurnIds.map(String).filter(Boolean) : conversationDomTurnIds(conversation);
  const expectedLatestId = expectedIds[expectedIds.length - 1] || "";
  return threadDiagnosticEventsApi.turnOrderDiagnosticSnapshot({
    source,
    readMode: thread.mobileReadMode || "",
    renderMode: extra.renderMode || "",
    threadHash: diagnosticThreadHash(thread.id || state.currentThreadId),
    turnHash: diagnosticTurnHash(expectedLatestId),
    expectedTurnIds: expectedIds,
    domTurnIds: domIds,
  });
}

function conversationProjectionDiagnosticSnapshot(source, extra = {}, deps = {}) {
  const conversation = deps.conversation || $("conversation");
  if (!conversation) return null;
  const renderedSignature = Object.prototype.hasOwnProperty.call(deps, "renderedConversationSignature")
    ? String(deps.renderedConversationSignature || "")
    : String(state.renderedConversationSignature || "");
  const domShape = deps.domShape || conversationDomShape();
  const tileMode = Object.prototype.hasOwnProperty.call(deps, "threadTileMode")
    ? deps.threadTileMode === true
    : state.threadTileMode === true;
  const tileDomActive = Object.prototype.hasOwnProperty.call(deps, "tileDomActive")
    ? deps.tileDomActive === true
    : Boolean(conversation.classList && conversation.classList.contains("thread-tile-mode"));
  return threadDiagnosticEventsApi.conversationProjectionDiagnosticSnapshot({
    source,
    renderMode: extra.renderMode,
    renderedSignature,
    domShape,
    threadTileMode: tileMode,
    tileDomActive,
    tileLayout: deps.tileLayout,
    tileIds: deps.tileIds,
    tileDisplayLayout: deps.tileDisplayLayout,
    tileSignature: deps.tileSignature,
    currentSignature: deps.currentSignature,
    thread: deps.thread || state.currentThread,
  }, {
    singleSignature: conversationRenderSignature,
    tileLayout: threadTileLayout,
    tileCandidateIds: threadTileCandidateIds,
    tileDisplayLayout: threadTileDisplayLayout,
    tileRenderSignature: threadTileRenderSignature,
    tileThreadForId: typeof deps.tileThreadForId === "function" ? deps.tileThreadForId : threadTileDisplayThread,
    visibleShape: visibleConversationShape,
  });
}

function applyConversationProjectionConsistencyEffect(effect) {
  const item = effect && typeof effect === "object" ? effect : {};
  if (!item.type) return;
  if (item.type === "diagnostic-failure") {
    recordHomeAiDiagnosticFailure(item.diagnostic || {});
    return;
  }
  if (item.type === "diagnostic-success") {
    recordHomeAiDiagnosticSuccess(item.diagnostic || {});
    return;
  }
  throw new Error(`Unknown conversation projection consistency effect: ${item.type}`);
}

function applyConversationProjectionConsistencyEffectsPlan(plan) {
  const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
  for (const effect of effects) applyConversationProjectionConsistencyEffect(effect);
}

function checkConversationProjectionConsistency(source, extra = {}) {
  if (!state.currentThread || state.currentThread.mobileLoading || state.currentThread.mobileLoadError) return;
  recordPrimaryShellSelectionHealthy(source, state.currentThread);
  recordEmptyVisibleDetailHealthy(source, state.currentThread, extra);
  const snapshot = conversationProjectionDiagnosticSnapshot(source, extra);
  if (!snapshot) return;
  const orderSnapshot = conversationTurnOrderDiagnosticSnapshot(source, extra);
  const effectsPlan = threadDiagnosticEventsApi.conversationProjectionConsistencyEffects({ snapshot, orderSnapshot });
  applyConversationProjectionConsistencyEffectsPlan(effectsPlan);
}

function startUiWatchdog() {
  if (state.uiWatchdogTimer) return;
  state.lastUiWatchdogTickAt = Date.now();
  state.uiWatchdogTimer = setInterval(() => {
    const now = Date.now();
    const lagMs = now - state.lastUiWatchdogTickAt - 1000;
    state.lastUiWatchdogTickAt = now;
    if (document.visibilityState === "hidden" || lagMs < 2500) return;
    if (now - state.lastUiStallReportedAt < 15000) return;
    state.lastUiStallReportedAt = now;
    postClientEvent("ui_stall", {
      lagMs: Math.round(lagMs),
      composerBusy: state.composerBusy,
      activeTurnId: state.activeTurnId || "",
      hasContent: composerHasContent(),
    });
  }, 1000);
}

function updatePushButton() {
  const button = $("pushNotifications");
  if (!button) return;
  button.classList.remove("hidden", "ready", "error");
  const hideButton = () => {
    button.textContent = "";
    button.disabled = true;
    button.classList.add("hidden");
  };
  if (state.pushBusy) {
    button.textContent = "Working...";
    button.disabled = true;
    return;
  }
  if (!state.pushServerSupported) {
    hideButton();
    return;
  }
  if (!window.isSecureContext) {
    hideButton();
    return;
  }
  if (!pushBrowserAvailable()) {
    hideButton();
    return;
  }
  if (Notification.permission === "denied") {
    button.textContent = "Notifications blocked";
    button.disabled = true;
    button.classList.add("error");
    return;
  }
  if (state.pushSubscribed) {
    button.textContent = "Send test notification";
    button.disabled = false;
    button.classList.add("ready");
    return;
  }
  button.textContent = "Enable notifications";
  button.disabled = false;
  if (state.pushError) button.classList.add("error");
}

async function registerPushServiceWorker() {
  if (state.serviceWorkerRegistration) return state.serviceWorkerRegistration;
  state.serviceWorkerRegistration = await navigator.serviceWorker.register("/sw.js");
  if (state.serviceWorkerRegistration && state.serviceWorkerRegistration.update) {
    state.serviceWorkerRegistration.update().catch(() => {});
  }
  return state.serviceWorkerRegistration;
}

async function syncExistingPushSubscription() {
  if (!state.key || !pushBrowserAvailable()) return;
  const registration = await registerPushServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  state.pushSubscribed = Boolean(subscription);
  if (subscription) {
    await api("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription: pushSubscriptionToJson(subscription) }),
    });
  }
}

async function initializePushControls() {
  state.pushError = "";
  updatePushButton();
  if (!pushBrowserAvailable() || !state.key) return;
  try {
    await syncExistingPushSubscription();
  } catch (err) {
    state.pushError = err.message || String(err);
  } finally {
    updatePushButton();
  }
}

async function enablePushNotifications() {
  if (!pushBrowserAvailable()) return;
  const permission = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== "granted") {
    state.pushSubscribed = false;
    state.pushError = permission === "denied" ? "Notifications blocked" : "Notification permission not granted";
    updatePushButton();
    return;
  }
  const registration = await registerPushServiceWorker();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const key = await api("/api/push/vapid-public-key");
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(key.publicKey),
    });
  }
  await api("/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify({ subscription: pushSubscriptionToJson(subscription) }),
  });
  state.pushSubscribed = true;
  state.pushError = "";
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "Notifications enabled";
}

async function sendTestPushNotification() {
  const result = await api("/api/push/test", { method: "POST", body: "{}" });
  $("connectionState").classList.remove("error");
  if (result.sent) {
    $("connectionState").textContent = "Test notification sent";
    return;
  }
  if (result.failed) {
    const detail = result.lastError && (result.lastError.reason || result.lastError.statusCode)
      ? `${result.lastError.statusCode || ""} ${result.lastError.reason || ""}`.trim()
      : "delivery failed";
    throw new Error(`Test notification failed: ${detail}`);
  }
  $("connectionState").textContent = "No push subscription";
}

async function handlePushButtonClick() {
  if (state.pushBusy) return;
  state.pushBusy = true;
  updatePushButton();
  try {
    if (state.pushSubscribed) await sendTestPushNotification();
    else await enablePushNotifications();
  } catch (err) {
    state.pushError = err.message || String(err);
    showError(err);
  } finally {
    state.pushBusy = false;
    updatePushButton();
  }
}

const legacyGlobals = {
  api,
  postClientEvent,
  nowPerfMs,
  roundedDurationMs,
  postPerformanceEvent,
  diagnosticHash,
  diagnosticThreadHash,
  diagnosticTurnHash,
  diagnosticTaskHash,
  diagnosticItemHash,
  clientSubmissionDiagnosticHash,
  clientSubmissionDataAttr,
  frontendDiagnosticLogSettings,
  frontendDiagnosticLogStatus,
  applyFrontendDiagnosticLogPublicConfig,
  setFrontendDiagnosticLogEnabled,
  configureFrontendDiagnosticLog,
  readFrontendDiagnosticLog,
  clearFrontendDiagnosticLog,
  exportFrontendDiagnosticLog,
  recordFrontendDiagnosticLog,
  submittedEchoDiagnosticSnapshot,
  recordSubmittedEchoDiagnosticLog,
  recordRecentSubmittedEchoDiagnosticLogs,
  diagnosticRouteKind,
  diagnosticErrorStatus,
  diagnosticErrorCode,
  diagnosticDurationBucket,
  currentHomeAiDiagnosticContext,
  postHomeAiDiagnosticReport,
  recordHomeAiDiagnosticFailure,
  recordHomeAiDiagnosticSuccess,
  applyFrontendRuntimeHealthEffect,
  applyFrontendRuntimeHealthEffectsPlan,
  threadListRuntimeMetrics,
  recordThreadListRuntimeStall,
  sampleThreadListInputDelay,
  startThreadListRuntimeHeartbeat,
  startThreadListRuntimeLongTaskObserver,
  startThreadListRuntimeStallMonitoring,
  conversationHasClientSubmissionHash,
  frontendHealthThreadForSubmission,
  probeSubmittedMessageDom,
  scheduleSubmittedMessageDomProbe,
  applyThreadDetailResponseDiagnosticEffect,
  applyThreadDetailResponseDiagnosticEffectsPlan,
  recordThreadDetailResponseDiagnostics,
  conversationDomShape,
  duplicateUserMessageSignatureCount,
  domUserMessageDuplicateSignature,
  domUserMessageEventDuplicateSignature,
  visibleUserMessageDuplicateSignature,
  visibleUserMessageEventDuplicateSignature,
  turnRendersConversationArticle,
  visibleRenderableTurnsForConversation,
  visibleConversationShape,
  rememberThreadDetailRenderEvidence,
  clearThreadDetailRenderEvidence,
  recentThreadDetailRenderEvidence,
  primaryShellSelectionConflictInput,
  recordPrimaryShellSelectionConflict,
  recordPrimaryShellSelectionHealthy,
  emptyVisibleDetailMismatchInput,
  recordEmptyVisibleDetailMismatch,
  recordEmptyVisibleDetailHealthy,
  maybeRecoverEmptyDetailWithHistoryEvidence,
  emptyCachedDetailReuseInput,
  recordEmptyCachedDetailReuseBlocked,
  recordEmptyCachedDetailReuseHealthy,
  checkEmptyVisibleDetailMismatchAfterRender,
  visibleRenderableTurnIds,
  conversationDomTurnIds,
  threadTileVisibleShape,
  threadTileVisibleTurnCount,
  threadTileDomTurnCount,
  conversationTurnOrderDiagnosticSnapshot,
  conversationProjectionDiagnosticSnapshot,
  applyConversationProjectionConsistencyEffect,
  applyConversationProjectionConsistencyEffectsPlan,
  checkConversationProjectionConsistency,
  startUiWatchdog,
  updatePushButton,
  registerPushServiceWorker,
  syncExistingPushSubscription,
  initializePushControls,
  enablePushNotifications,
  sendTestPushNotification,
  handlePushButtonClick,
};
root.CodexFrontendLog = frontendDiagnosticLogApi;

function createApiClientRuntime() {
  return Object.assign({}, legacyGlobals);
}

const apiClientRuntimeApi = { createApiClientRuntime };
if (typeof module === "object" && module.exports) module.exports = apiClientRuntimeApi;
for (const [name, value] of Object.entries(legacyGlobals)) {
  if (typeof value === "function") root[name] = value;
}
root.CodexApiClientRuntime = apiClientRuntimeApi;
})(typeof globalThis !== "undefined" ? globalThis : window);
