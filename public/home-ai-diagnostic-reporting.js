"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexHomeAiDiagnosticReporting = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  const DEFAULT_THRESHOLD = 3;
  const DEFAULT_THROTTLE_MS = 5 * 60 * 1000;
  const MAX_BREADCRUMBS = 6;
  const PLUGIN_ID = "codex-mobile";
  const SAFE_CONTEXT_KEYS = new Set([
    "action",
    "build_id",
    "cache_id",
    "client_visibility",
    "diagnostic_source",
    "embedded",
    "item_hash",
    "pluginId",
    "pwa",
    "read_mode",
    "render_mode",
    "render_plan_reason",
    "route_kind",
    "shell_cache",
    "sourceSurface",
    "source_kind",
    "patch_reject_reason",
    "surface",
    "task_hash",
    "thread_hash",
    "turn_hash",
    "workspaceId",
  ]);
  const SAFE_FIELD_KEYS = new Set([
    "action",
    "api_status",
    "dom_count",
    "duplicate_count",
    "item_hash",
    "item_kind",
    "latest_mismatch_count",
    "missing_count",
    "order_mismatch_count",
    "patch_reject_reason",
    "previous_count",
    "read_mode",
    "render_mode",
    "render_plan_reason",
    "repeated_failures",
    "route_kind",
    "server_count",
    "source_kind",
    "status_code",
    "task_hash",
    "thread_hash",
    "turn_hash",
    "visible_count",
  ]);
  const UNSAFE_KEY_PATTERN = /(body|content|cookie|file|href|key|launch|log|message|path|payload|prompt|raw|secret|text|title|token|url)/i;

  function stableTextHash(value) {
    const text = String(value || "");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function hashIdentifier(value, prefix = "h") {
    const text = String(value || "").trim();
    return text ? `${prefix}_${stableTextHash(text)}` : "";
  }

  function boundedToken(value, fallback = "unknown", maxLength = 80) {
    const raw = String(value || "").trim();
    const safe = raw
      .replace(/[^a-zA-Z0-9_.:-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, maxLength);
    return safe || fallback;
  }

  function boundedString(value, maxLength = 120) {
    return String(value || "").trim().slice(0, maxLength);
  }

  function boundedNumber(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.round(number));
  }

  function durationBucket(value) {
    const ms = Number(value || 0);
    if (!Number.isFinite(ms) || ms <= 0) return "";
    if (ms < 1000) return "lt_1s";
    if (ms < 3000) return "1_3s";
    if (ms < 10000) return "3_10s";
    if (ms < 30000) return "10_30s";
    return "30s_plus";
  }

  function safeCounts(counts) {
    const out = {};
    if (!counts || typeof counts !== "object" || Array.isArray(counts)) return out;
    for (const [key, value] of Object.entries(counts)) {
      if (UNSAFE_KEY_PATTERN.test(key)) continue;
      const safeKey = boundedToken(key, "", 60);
      if (!safeKey) continue;
      if (typeof value === "boolean") out[safeKey] = value ? 1 : 0;
      else if (Number.isFinite(Number(value))) out[safeKey] = boundedNumber(value);
    }
    return out;
  }

  function safeFields(fields, allowedKeys = SAFE_FIELD_KEYS) {
    const out = {};
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) return out;
    for (const [key, value] of Object.entries(fields)) {
      if (!allowedKeys.has(key) || UNSAFE_KEY_PATTERN.test(key)) continue;
      if (typeof value === "boolean") {
        out[key] = value;
      } else if (Number.isFinite(Number(value)) && !/_hash$/.test(key)) {
        out[key] = boundedNumber(value);
      } else {
        const safe = boundedToken(value, "", 120);
        if (safe) out[key] = safe;
      }
    }
    return out;
  }

  function safeContext(context) {
    const base = {
      pluginId: PLUGIN_ID,
      sourceSurface: "embedded-plugin",
    };
    const out = Object.assign({}, base);
    const input = context && typeof context === "object" && !Array.isArray(context) ? context : {};
    for (const [key, value] of Object.entries(input)) {
      if (!SAFE_CONTEXT_KEYS.has(key) || UNSAFE_KEY_PATTERN.test(key)) continue;
      if (typeof value === "boolean") {
        out[key] = value;
      } else if (Number.isFinite(Number(value)) && !/_hash$/.test(key)) {
        out[key] = boundedNumber(value);
      } else {
        const safe = boundedToken(value, "", 160);
        if (safe) out[key] = safe;
      }
    }
    out.pluginId = PLUGIN_ID;
    out.sourceSurface = "embedded-plugin";
    return out;
  }

  function safeBreadcrumbs(breadcrumbs) {
    if (!Array.isArray(breadcrumbs)) return [];
    return breadcrumbs.slice(0, MAX_BREADCRUMBS).map((entry) => {
      const input = entry && typeof entry === "object" ? entry : {};
      const out = {
        kind: boundedToken(input.kind, "runtime", 80),
        code: boundedToken(input.code, "unknown", 80),
        status: boundedToken(input.status, "failed", 40),
      };
      const bucket = boundedToken(input.duration_bucket || input.durationBucket || "", "", 40);
      if (bucket) out.duration_bucket = bucket;
      const fields = safeFields(input.fields || {});
      if (Object.keys(fields).length) out.fields = fields;
      return out;
    });
  }

  function safeSeverity(value) {
    const text = String(value || "").trim().toUpperCase();
    return text === "H1" || text === "H2" || text === "H3" ? text : "H2";
  }

  function safeConfidence(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0.7;
    return Math.max(0, Math.min(1, Math.round(number * 100) / 100));
  }

  function sanitizeInput(input = {}) {
    const category = boundedToken(input.category, "codex_runtime_failure", 80);
    const diagnosticType = boundedToken(input.diagnostic_type || input.diagnosticType, category, 80);
    const errorCode = boundedToken(input.error_code || input.errorCode, `${diagnosticType}_failed`, 100);
    const context = safeContext(input.context || {});
    const counts = safeCounts(input.counts || {});
    const breadcrumbs = safeBreadcrumbs(input.breadcrumbs || []);
    const bucket = boundedToken(input.duration_bucket || input.durationBucket || durationBucket(input.durationMs), "", 40);
    return {
      category,
      diagnostic_type: diagnosticType,
      severity_hint: safeSeverity(input.severity_hint || input.severityHint),
      evidence_confidence: safeConfidence(input.evidence_confidence || input.evidenceConfidence),
      error_code: errorCode,
      duration_bucket: bucket,
      counts,
      context,
      breadcrumbs,
    };
  }

  function clearKeyFor(event) {
    return [
      event.category,
      event.diagnostic_type,
      event.context.surface || "",
      event.context.action || "",
      event.context.route_kind || "",
      event.context.thread_hash || "",
      event.context.task_hash || "",
      event.context.item_hash || "",
    ].join("|");
  }

  function signatureFor(event) {
    return [
      clearKeyFor(event),
      event.error_code,
      event.context.build_id || "",
      event.context.read_mode || "",
      event.context.render_mode || "",
      event.context.source_kind || "",
    ].join("|");
  }

  function reportFor(event, repeatedFailures) {
    const counts = Object.assign({}, event.counts, {
      repeated_failures: boundedNumber(repeatedFailures, 1),
    });
    const breadcrumbs = event.breadcrumbs.length
      ? event.breadcrumbs
      : [{
        kind: event.context.surface || event.category,
        code: event.error_code,
        status: "failed",
        fields: safeFields({
          repeated_failures: repeatedFailures,
          thread_hash: event.context.thread_hash || "",
          task_hash: event.context.task_hash || "",
          item_hash: event.context.item_hash || "",
        }),
      }];
    return {
      type: "homeai.diagnostic.report",
      version: 1,
      pluginId: PLUGIN_ID,
      category: event.category,
      diagnostic_type: event.diagnostic_type,
      severity_hint: event.severity_hint,
      evidence_confidence: event.evidence_confidence,
      error_code: event.error_code,
      duration_bucket: event.duration_bucket || undefined,
      counts,
      context: event.context,
      breadcrumbs,
    };
  }

  function createDiagnosticReporter(options = {}) {
    const threshold = Math.max(1, Number(options.threshold || DEFAULT_THRESHOLD) || DEFAULT_THRESHOLD);
    const throttleMs = Math.max(0, Number(options.throttleMs || DEFAULT_THROTTLE_MS) || DEFAULT_THROTTLE_MS);
    const now = typeof options.now === "function" ? options.now : () => Date.now();
    const failures = new Map();
    const lastReportedAt = new Map();

    function recordFailure(input) {
      const event = sanitizeInput(input || {});
      const signature = signatureFor(event);
      const clearKey = clearKeyFor(event);
      const previous = failures.get(signature);
      const count = (previous && previous.count ? previous.count : 0) + 1;
      failures.set(signature, { count, clearKey, lastAt: now() });
      const lastReportAt = Number(lastReportedAt.get(signature) || 0);
      const eligible = count >= threshold && (!lastReportAt || now() - lastReportAt >= throttleMs);
      if (!eligible) {
        return {
          eligible: false,
          report: null,
          repeatedFailures: count,
          signature,
          clearKey,
          threshold,
        };
      }
      lastReportedAt.set(signature, now());
      return {
        eligible: true,
        report: reportFor(event, count),
        repeatedFailures: count,
        signature,
        clearKey,
        threshold,
      };
    }

    function recordSuccess(input) {
      const event = sanitizeInput(input || {});
      const clearKey = clearKeyFor(event);
      let cleared = 0;
      for (const [signature, entry] of failures.entries()) {
        if (entry && entry.clearKey === clearKey) {
          failures.delete(signature);
          cleared += 1;
        }
      }
      return { cleared, clearKey };
    }

    function failureCount(input) {
      const event = sanitizeInput(input || {});
      const signature = signatureFor(event);
      const entry = failures.get(signature);
      return entry ? entry.count : 0;
    }

    return {
      failureCount,
      recordFailure,
      recordSuccess,
      threshold,
      throttleMs,
    };
  }

  function postReportToHomeAi(options = {}) {
    const report = options.report;
    const parentWindow = options.parentWindow;
    const selfWindow = options.selfWindow || null;
    if (!options.embedded) return { ok: false, reason: "not_embedded" };
    if (!report || report.type !== "homeai.diagnostic.report") return { ok: false, reason: "invalid_report" };
    if (!parentWindow || (selfWindow && parentWindow === selfWindow)) return { ok: false, reason: "missing_parent" };
    try {
      parentWindow.postMessage(report, options.targetOrigin || "*");
      return { ok: true, reason: "posted" };
    } catch (_) {
      return { ok: false, reason: "post_failed" };
    }
  }

  return {
    DEFAULT_THRESHOLD,
    DEFAULT_THROTTLE_MS,
    boundedToken,
    createDiagnosticReporter,
    durationBucket,
    hashIdentifier,
    postReportToHomeAi,
    sanitizeInput,
    stableTextHash,
  };
}));
