"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const {
  normalizeSecretRefsFromInput,
  publicSensitiveContext,
  scopeSecretRefs,
  secretRefReceiptText,
} = require("../runtime/home-ai-secret-ref-service");

const MAX_TITLE_CHARS = 120;
const MAX_SUMMARY_CHARS = 300;
const MAX_BODY_CHARS = 8_000;
const AUTO_REPLY_BODY_CHARS = 6_000;
const DEFAULT_RECENT_LIMIT = 24;
const MAX_BATCH_TARGETS = 12;
const SETTLED_STATUSES = new Set(["approved", "deleted", "revoked", "replied"]);
const RETURN_STATUSES = new Set(["completed", "blocked", "redirected", "rejected", "partially_completed"]);
const WORKFLOW_MODE_MANUAL = "manual";
const WORKFLOW_MODE_AUTONOMOUS = "autonomous";
const REASONING_EFFORT_VALUES = new Set(["low", "medium", "high", "xhigh"]);
const AUTO_RETURN_TITLE_PREFIX = "Auto return:";
const EXECUTION_LEASE_ACTIVE = "active";
const EXECUTION_LEASE_RESUMING = "resuming";
const EXECUTION_LEASE_PAUSED = "paused";
const EXECUTION_LEASE_CANCELLED = "cancelled";
const EXECUTION_LEASE_COMPLETED = "completed";
const EXECUTION_LEASE_BLOCKED = "blocked";
const MAX_LEASE_TURN_IDS = 24;
const DEFAULT_EXECUTION_WATCHDOG_STALE_MS = 30 * 60 * 1000;
const MAX_EXECUTION_WATCHDOG_BATCH = 8;
const DEFAULT_EXECUTION_WATCHDOG_MAX_RESUME_COUNT = 1;
const STORE_LOCK_TIMEOUT_MS = 10_000;
const STORE_LOCK_STALE_MS = 30_000;
const STORE_LOCK_POLL_MS = 25;
const TASK_CARD_RESOLVER_VERSION = "task-card-exact-routing-v1";
const TASK_CARD_RETURN_TOOL_HINT = "`mcp__codex_mobile.return_to_source` after Codex Mobile MCP/tool discovery when needed; non-MCP namespace variants are unsupported";

function nowIso(nowFn) {
  const value = typeof nowFn === "function" ? nowFn() : Date.now();
  const millis = Number(value);
  return new Date(Number.isFinite(millis) ? millis : Date.now()).toISOString();
}

function stringValue(value) {
  return String(value || "").trim();
}

function errorWithStatus(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function boundedString(value, fieldName, maxLength, required = true) {
  const text = stringValue(value);
  if (required && !text) throw errorWithStatus(`${fieldName}_required`);
  if (text.length > maxLength) throw errorWithStatus(`${fieldName}_too_long`);
  return text;
}

function boundedMetadataString(value, maxLength) {
  const text = stringValue(value);
  if (!text) return "";
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizedRoleLabel(value) {
  return boundedMetadataString(
    stringValue(value).toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, ""),
    80,
  );
}

function normalizedRouteKind(value) {
  return boundedMetadataString(
    stringValue(value || "implementation").toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "implementation",
    80,
  );
}

function boundedErrorMessage(value) {
  const text = stringValue(value && value.message ? value.message : value);
  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine ? boundedMetadataString(singleLine, 500) : "approval_execution_failed";
}

function boundedVisibleText(value, maxLength) {
  const text = String(value || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  const suffix = "\n\n...(truncated)";
  return `${text.slice(0, Math.max(0, maxLength - suffix.length)).trimEnd()}${suffix}`;
}

function autoReturnTitleForCard(card) {
  const rawTitle = stringValue(card && card.message && card.message.title) || "Task card";
  const baseTitle = rawTitle.replace(/^(?:Auto return:\s*)+/i, "").trim() || "Task card";
  return boundedVisibleText(`${AUTO_RETURN_TITLE_PREFIX} ${baseTitle}`, MAX_TITLE_CHARS);
}

function hasLikelyQuestionMarkReplacementDamage(text) {
  const questionCount = (text.match(/\?/g) || []).length;
  if (questionCount < 6 || !/\?{2,}/.test(text)) return false;
  const hasRepeatedClusters = /\?{4,}/.test(text) || /\?{2,}[\s\S]{0,40}\?{2,}/.test(text);
  if (!hasRepeatedClusters) return false;
  const ratio = questionCount / Math.max(1, text.length);
  return ratio >= 0.12 || questionCount >= 16;
}

function hasLikelyEncodingDamage(text) {
  if (!text) return false;
  if (/[\uFFFD\u0080-\u009F]/.test(text)) return true;
  if (/[ÃÂ]/.test(text)) return true;
  if (/â[€™€œ€]/.test(text)) return true;
  return hasLikelyQuestionMarkReplacementDamage(text);
}

function readableCardText(value, fieldName, maxLength, required = true) {
  const text = boundedString(value, fieldName, maxLength, required);
  if (text && hasLikelyEncodingDamage(text)) {
    throw errorWithStatus(`task_card_text_encoding_damaged:${fieldName}`);
  }
  return text;
}

function normalizedFormat(value) {
  const format = boundedString(value || "markdown", "format", 40);
  if (format !== "markdown" && format !== "text") throw errorWithStatus("format_invalid");
  return format;
}

function normalizedWorkflowMode(value) {
  const mode = stringValue(value || WORKFLOW_MODE_MANUAL).toLowerCase();
  if (!mode || mode === WORKFLOW_MODE_MANUAL) return WORKFLOW_MODE_MANUAL;
  if (mode === WORKFLOW_MODE_AUTONOMOUS || mode === "auto" || mode === "automatic") return WORKFLOW_MODE_AUTONOMOUS;
  throw errorWithStatus("workflow_mode_invalid");
}

function normalizedReturnStatus(value) {
  const status = stringValue(value).toLowerCase();
  if (!status) return "";
  if (RETURN_STATUSES.has(status)) return status;
  throw errorWithStatus("return_status_invalid");
}

function normalizedReasoningEffort(value) {
  const effort = stringValue(value).toLowerCase();
  if (!effort) return "";
  if (REASONING_EFFORT_VALUES.has(effort)) return effort;
  throw errorWithStatus("reasoning_effort_invalid");
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultStore() {
  return { cards: [], workflows: [] };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function storeError(message, details = {}, statusCode = 503) {
  const err = errorWithStatus(message, statusCode);
  err.code = message;
  err.details = Object.fromEntries(Object.entries(details || {}).filter(([, value]) => value !== undefined && value !== ""));
  return err;
}

function loadStore(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return defaultStore();
    throw storeError("task_card_store_unreadable", {
      reason: err && err.code ? err.code : "read_failed",
    });
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    throw storeError("task_card_store_malformed_json", {
      bytes: Buffer.byteLength(String(raw || ""), "utf8"),
    });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Array.isArray(parsed.cards)) {
    throw storeError("task_card_store_invalid_shape", {
      hasObject: Boolean(parsed && typeof parsed === "object" && !Array.isArray(parsed)),
      cardsType: Array.isArray(parsed && parsed.cards) ? "array" : typeof (parsed && parsed.cards),
    });
  }
  if (parsed.workflows !== undefined && !Array.isArray(parsed.workflows)) {
    throw storeError("task_card_store_invalid_shape", {
      hasObject: true,
      workflowsType: typeof parsed.workflows,
    });
  }
  return {
    cards: parsed.cards,
    workflows: Array.isArray(parsed.workflows) ? parsed.workflows : [],
  };
}

function saveStore(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tempFile = `${file}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  try {
    fs.writeFileSync(tempFile, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(tempFile, file);
  } catch (err) {
    try {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    } catch (_) {
      // Best-effort cleanup; preserve the original persistence failure.
    }
    throw err;
  }
}

function storeFileSignature(file) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return null;
    return {
      mtimeMs: Number(stat.mtimeMs || 0),
      size: Number(stat.size || 0),
    };
  } catch (err) {
    if (err && err.code === "ENOENT") return { missing: true, mtimeMs: 0, size: 0 };
    return null;
  }
}

function sameStoreFileSignature(left, right) {
  if (!left || !right) return false;
  return Boolean(left.missing) === Boolean(right.missing)
    && Number(left.mtimeMs || 0) === Number(right.mtimeMs || 0)
    && Number(left.size || 0) === Number(right.size || 0);
}

async function acquireStoreLock(file) {
  const lockDir = `${file}.lock`;
  const startedAt = Date.now();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (;;) {
    try {
      fs.mkdirSync(lockDir, { mode: 0o700 });
      fs.writeFileSync(path.join(lockDir, "owner.json"), `${JSON.stringify({
        pid: process.pid,
        acquiredAt: new Date().toISOString(),
      })}\n`, { encoding: "utf8", mode: 0o600 });
      return () => {
        try {
          fs.rmSync(lockDir, { recursive: true, force: true });
        } catch (_) {
          // Best-effort cleanup; the next writer can reap a stale lock.
        }
      };
    } catch (err) {
      if (!err || err.code !== "EEXIST") {
        throw storeError("task_card_store_lock_failed", {
          reason: err && err.code ? err.code : "lock_failed",
        });
      }
      let ageMs = 0;
      try {
        const stat = fs.statSync(lockDir);
        ageMs = Math.max(0, Date.now() - Math.trunc(Number(stat.mtimeMs) || 0));
      } catch (_) {
        ageMs = 0;
      }
      if (ageMs > STORE_LOCK_STALE_MS) {
        try {
          fs.rmSync(lockDir, { recursive: true, force: true });
          continue;
        } catch (_) {
          // Another writer may be cleaning it up. Fall through to wait.
        }
      }
      if (Date.now() - startedAt > STORE_LOCK_TIMEOUT_MS) {
        throw storeError("task_card_store_lock_timeout", {
          lockAgeMs: ageMs,
        });
      }
      await delay(STORE_LOCK_POLL_MS);
    }
  }
}

function cardForThread(card, threadId) {
  const id = stringValue(threadId);
  if (!id) return null;
  if (stringValue(card && card.source && card.source.threadId) === id) return "source";
  if (stringValue(card && card.target && card.target.threadId) === id) return "target";
  return null;
}

function sortCards(cards) {
  return safeArray(cards).slice().sort((left, right) => {
    const leftTime = Date.parse(left && (left.updatedAt || left.createdAt || "")) || 0;
    const rightTime = Date.parse(right && (right.updatedAt || right.createdAt || "")) || 0;
    return rightTime - leftTime;
  });
}

function legacyTerminalAckLikeCard(card) {
  if (!card || typeof card !== "object") return false;
  const delivery = card.delivery && typeof card.delivery === "object" ? card.delivery : {};
  const audit = card.audit && typeof card.audit === "object" ? card.audit : {};
  if (delivery.terminal !== undefined || delivery.requiresReturn !== undefined || delivery.ackPolicy) return false;
  if (delivery.returnToSource === true || audit.returnToSource === true) return true;
  if (!audit.replyToCardId && !audit.autoReturnToCardId) return false;
  const title = stringValue(card.message && card.message.title);
  return /^(?:Auto return:|Return:|Ack:|Acknowledg(?:e)?ment:|No-op:|Terminal:)/i.test(title);
}

function cardIsTerminal(card) {
  if (!card || typeof card !== "object") return false;
  const delivery = card.delivery && typeof card.delivery === "object" ? card.delivery : {};
  const audit = card.audit && typeof card.audit === "object" ? card.audit : {};
  return delivery.terminal === true
    || audit.terminal === true
    || delivery.ackPolicy === "none"
    || audit.ackPolicy === "none"
    || delivery.returnToSource === true
    || audit.returnToSource === true
    || legacyTerminalAckLikeCard(card);
}

function cardAckPolicy(card) {
  const delivery = card && card.delivery && typeof card.delivery === "object" ? card.delivery : {};
  const audit = card && card.audit && typeof card.audit === "object" ? card.audit : {};
  if (cardIsTerminal(card)) return "none";
  return stringValue(delivery.ackPolicy || audit.ackPolicy || (delivery.autoReturnOnCompletion ? "auto_return" : "return_required"));
}

function cardRequiresReturn(card) {
  if (!card || typeof card !== "object") return false;
  if (cardIsTerminal(card)) return false;
  const delivery = card.delivery && typeof card.delivery === "object" ? card.delivery : {};
  if (delivery.requiresReturn === false) return false;
  return true;
}

function terminalReturnDeliveryFields(returnStatus = "") {
  return {
    allowReply: false,
    allowRevoke: false,
    autoRunAfterFirstApproval: false,
    autoReturnOnCompletion: false,
    returnToSource: true,
    returnStatus,
    requiresReturn: false,
    terminal: true,
    ackPolicy: "none",
  };
}

function optionalBoundedInput(input = {}, keys = [], fieldName = "value", maxLength = 220) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return boundedString(input[key], fieldName, maxLength, false);
    }
  }
  return "";
}

function normalizeReplyToRef(input = {}) {
  const cardId = optionalBoundedInput(input, [
    "replyToCardId",
    "reply_to_card_id",
    "originalTaskCardId",
    "original_task_card_id",
  ], "reply_to_card_id", 180);
  const threadId = optionalBoundedInput(input, [
    "replyToThreadId",
    "reply_to_thread_id",
    "returnTargetThreadId",
    "return_target_thread_id",
    "returnThreadId",
    "return_thread_id",
  ], "reply_to_thread_id", 220);
  if (!threadId && !cardId) return null;
  return {
    workspaceId: optionalBoundedInput(input, [
      "replyToWorkspaceId",
      "reply_to_workspace_id",
      "returnTargetWorkspaceId",
      "return_target_workspace_id",
      "returnWorkspaceId",
      "return_workspace_id",
    ], "reply_to_workspace_id", 260),
    threadId,
    title: optionalBoundedInput(input, [
      "replyToThreadTitle",
      "reply_to_thread_title",
      "returnTargetThreadTitle",
      "return_target_thread_title",
    ], "reply_to_thread_title", 200),
    cardId,
  };
}

function normalizeRouteResolution(value = {}, request = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const inputReferenceKinds = safeArray(source.inputReferenceKinds || source.input_reference_kinds)
    .map((entry) => boundedMetadataString(entry, 80))
    .filter(Boolean)
    .slice(0, MAX_BATCH_TARGETS);
  const matchedThreadIds = safeArray(source.matchedThreadIds || source.matched_thread_ids)
    .map((entry) => boundedMetadataString(entry, 220))
    .filter(Boolean)
    .slice(0, MAX_BATCH_TARGETS);
  const out = {
    resolverVersion: boundedMetadataString(
      source.resolverVersion || source.resolver_version || request.resolverVersion || request.resolver_version || TASK_CARD_RESOLVER_VERSION,
      120,
    ),
    routeKind: normalizedRouteKind(source.routeKind || source.route_kind || request.routeKind || request.route_kind),
    inputReferenceKind: boundedMetadataString(source.inputReferenceKind || source.input_reference_kind, 80),
    inputReferenceKinds,
    inputReferenceCount: Math.max(0, Math.trunc(Number(source.inputReferenceCount || source.input_reference_count || inputReferenceKinds.length || 0)) || 0),
    sourceThreadId: boundedMetadataString(source.sourceThreadId || source.source_thread_id || request.sourceThreadId, 220),
    targetThreadId: boundedMetadataString(source.targetThreadId || source.target_thread_id || request.targetThreadId, 220),
    matchedThreadId: boundedMetadataString(source.matchedThreadId || source.matched_thread_id || request.targetThreadId, 220),
    matchedThreadIds,
    sourceRole: normalizedRoleLabel(source.sourceRole || source.source_role || request.sourceRole || request.source_role),
    targetRole: normalizedRoleLabel(source.targetRole || source.target_role || request.targetRole || request.target_role),
    code: boundedMetadataString(source.code || source.ambiguityCode || source.noOpCode || source.no_op_code, 120),
  };
  for (const key of Object.keys(out)) {
    if (out[key] == null || out[key] === "" || out[key] === false) delete out[key];
    if (Array.isArray(out[key]) && out[key].length === 0) delete out[key];
  }
  return out;
}

function sourceThreadRefForCard(card) {
  const source = card && card.source && typeof card.source === "object" ? card.source : {};
  return {
    workspaceId: stringValue(source.workspaceId),
    threadId: stringValue(source.threadId),
    title: stringValue(source.title) || stringValue(source.threadId),
  };
}

function replyToRefForCard(card) {
  const replyTo = card && card.replyTo && typeof card.replyTo === "object" ? card.replyTo : null;
  const threadId = stringValue(replyTo && replyTo.threadId);
  if (!threadId) return null;
  return {
    workspaceId: stringValue(replyTo.workspaceId),
    threadId,
    title: stringValue(replyTo.title) || threadId,
    cardId: stringValue(replyTo.cardId),
  };
}

function returnTargetRefForCard(card) {
  const source = sourceThreadRefForCard(card);
  const replyTo = replyToRefForCard(card);
  if (!replyTo) return source;
  return {
    workspaceId: replyTo.workspaceId || source.workspaceId,
    threadId: replyTo.threadId,
    title: replyTo.title || source.title || replyTo.threadId,
    cardId: replyTo.cardId,
  };
}

function returnTargetUsesReplyTo(card) {
  const replyTo = replyToRefForCard(card);
  if (!replyTo) return false;
  return replyTo.threadId !== sourceThreadRefForCard(card).threadId;
}

function resolveReplyToRefForRequest(request, store) {
  const replyTo = request && request.replyTo && typeof request.replyTo === "object" ? request.replyTo : null;
  if (!replyTo) return null;
  if (stringValue(replyTo.threadId)) return replyTo;
  const cardId = stringValue(replyTo.cardId);
  if (!cardId) return null;
  const original = safeArray(store && store.cards).find((entry) => stringValue(entry && entry.id) === cardId);
  if (!original) return replyTo;
  const target = returnTargetRefForCard(original);
  if (!target.threadId) return replyTo;
  return {
    workspaceId: target.workspaceId,
    threadId: target.threadId,
    title: target.title,
    cardId,
  };
}

function terminalReturnStatusForCard(card) {
  const delivery = card && card.delivery && typeof card.delivery === "object" ? card.delivery : {};
  const audit = card && card.audit && typeof card.audit === "object" ? card.audit : {};
  const status = stringValue(delivery.returnStatus || audit.returnStatus || "completed").toLowerCase();
  return RETURN_STATUSES.has(status) ? status : "completed";
}

function terminalReturnEventForCards(originalCard, returnCard) {
  if (!originalCard || !returnCard) return null;
  if (cardIsTerminal(originalCard)) return null;
  if (!cardIsTerminal(returnCard)) return null;
  const delivery = returnCard.delivery && typeof returnCard.delivery === "object" ? returnCard.delivery : {};
  const audit = returnCard.audit && typeof returnCard.audit === "object" ? returnCard.audit : {};
  if (delivery.returnToSource !== true && audit.returnToSource !== true) return null;
  const title = boundedVisibleText(returnCard.message && returnCard.message.title || "Return card", MAX_TITLE_CHARS);
  const summary = boundedVisibleText(
    returnCard.message && returnCard.message.summary || terminalReturnStatusForCard(returnCard),
    MAX_SUMMARY_CHARS,
  );
  const returnBody = boundedVisibleText(returnCard.message && returnCard.message.body || "", AUTO_REPLY_BODY_CHARS);
  const returnTarget = returnTargetRefForCard(originalCard);
  const metadata = {
    sourceThreadId: boundedMetadataString(originalCard.source && originalCard.source.threadId, 180),
    targetThreadId: boundedMetadataString(originalCard.target && originalCard.target.threadId, 180),
    workflowId: boundedMetadataString(
      originalCard.workflow && originalCard.workflow.id
        || returnCard.workflow && returnCard.workflow.id
        || "",
      180,
    ),
    terminal: true,
    ackPolicy: "none",
  };
  if (returnTarget.threadId && returnTarget.threadId !== stringValue(originalCard.source && originalCard.source.threadId)) {
    metadata.returnTargetThreadId = boundedMetadataString(returnCard.target && returnCard.target.threadId, 180);
    metadata.replyToThreadId = boundedMetadataString(returnTarget.threadId, 180);
  }
  return {
    taskCardId: boundedMetadataString(originalCard.id, 180),
    returnCardId: boundedMetadataString(returnCard.id, 180),
    status: terminalReturnStatusForCard(returnCard),
    title,
    summary,
    returnBody,
    metadata,
  };
}

function timestampMs(value) {
  return Date.parse(stringValue(value) || "") || 0;
}

function timestampAgeMs(value, nowMs = Date.now()) {
  const ms = timestampMs(value);
  if (!ms) return 0;
  return Math.max(0, Math.trunc(nowMs - ms));
}

function publicExecutionLease(lease) {
  if (!lease || typeof lease !== "object") return null;
  const nowMs = Date.now();
  const staleAfterMs = Math.max(0, Math.trunc(Number(lease.watchdogStaleAfterMs || 0)) || 0);
  const heartbeatAgeMs = timestampAgeMs(lease.lastHeartbeatAt || lease.lastProgressAt, nowMs);
  const watchdogAttemptAgeMs = timestampAgeMs(lease.lastWatchdogAttemptAt || lease.watchdogResumeRequestedAt, nowMs);
  return {
    cardId: boundedMetadataString(lease.cardId, 80),
    sourceThreadId: boundedMetadataString(lease.sourceThreadId, 80),
    targetThreadId: boundedMetadataString(lease.targetThreadId, 80),
    workflowId: boundedMetadataString(lease.workflowId, 120),
    workflowMode: boundedMetadataString(lease.workflowMode, 40),
    status: boundedMetadataString(lease.status, 40),
    resumeRequired: lease.resumeRequired === true,
    startedAt: boundedMetadataString(lease.startedAt, 80),
    lastProgressAt: boundedMetadataString(lease.lastProgressAt, 80),
    lastHeartbeatAt: boundedMetadataString(lease.lastHeartbeatAt, 80),
    lastHeartbeatSource: boundedMetadataString(lease.lastHeartbeatSource, 80),
    lastHeartbeatStatus: boundedMetadataString(lease.lastHeartbeatStatus, 80),
    lastHeartbeatTurnId: boundedMetadataString(lease.lastHeartbeatTurnId, 120),
    heartbeatCount: Math.max(0, Math.trunc(Number(lease.heartbeatCount || 0)) || 0),
    heartbeatAgeMs,
    watchdogStaleAfterMs: staleAfterMs,
    resumeRequiredByWatchdog: staleAfterMs > 0 && heartbeatAgeMs >= staleAfterMs,
    pausedAt: boundedMetadataString(lease.pausedAt, 80),
    cancelledAt: boundedMetadataString(lease.cancelledAt, 80),
    completedAt: boundedMetadataString(lease.completedAt, 80),
    blockedAt: boundedMetadataString(lease.blockedAt, 80),
    blockedReason: boundedMetadataString(lease.blockedReason, 120),
    injectedTurnId: boundedMetadataString(lease.injectedTurnId, 120),
    currentTurnId: boundedMetadataString(lease.currentTurnId, 120),
    lastInterruptedTurnId: boundedMetadataString(lease.lastInterruptedTurnId, 120),
    lastContinuationTurnId: boundedMetadataString(lease.lastContinuationTurnId, 120),
    resumeCount: Math.max(0, Math.trunc(Number(lease.resumeCount || 0)) || 0),
    resumeForTurnId: boundedMetadataString(lease.resumeForTurnId, 120),
    watchdogResumeRequestedAt: boundedMetadataString(lease.watchdogResumeRequestedAt, 80),
    lastWatchdogAttemptAt: boundedMetadataString(lease.lastWatchdogAttemptAt, 80),
    lastWatchdogAttemptAgeMs: watchdogAttemptAgeMs,
    lastWatchdogResumeReason: boundedMetadataString(lease.lastWatchdogResumeReason, 120),
    watchdogAutoResumePausedAt: boundedMetadataString(lease.watchdogAutoResumePausedAt, 80),
    watchdogAutoResumePausedReason: boundedMetadataString(lease.watchdogAutoResumePausedReason, 120),
    lastResumeFailedAt: boundedMetadataString(lease.lastResumeFailedAt, 80),
    lastResumeError: boundedMetadataString(lease.lastResumeError, 200),
  };
}

function cardCanOwnExecutionLease(card) {
  return Boolean(card && card.status === "approved" && !cardIsTerminal(card) && cardRequiresReturn(card));
}

function executionTurnIds(lease) {
  const ids = [
    stringValue(lease && lease.injectedTurnId),
    stringValue(lease && lease.currentTurnId),
    stringValue(lease && lease.lastContinuationTurnId),
    ...safeArray(lease && lease.continuationTurnIds).map(stringValue),
  ].filter(Boolean);
  return Array.from(new Set(ids));
}

function leaseIsActive(lease) {
  const status = stringValue(lease && lease.status);
  return status === EXECUTION_LEASE_ACTIVE || status === EXECUTION_LEASE_RESUMING;
}

function leaseForApprovedCard(card, execution = {}, timestamp = "") {
  const existing = card && card.executionLease && typeof card.executionLease === "object" ? card.executionLease : {};
  const turnId = stringValue(execution && execution.turnId) || stringValue(existing.currentTurnId) || stringValue(existing.injectedTurnId);
  return Object.assign({}, existing, {
    cardId: stringValue(card && card.id),
    sourceThreadId: stringValue(card && card.source && card.source.threadId),
    targetThreadId: stringValue(card && card.target && card.target.threadId),
    workflowId: stringValue(card && card.workflow && card.workflow.id),
    workflowMode: stringValue(card && card.workflow && card.workflow.mode) || WORKFLOW_MODE_MANUAL,
    status: EXECUTION_LEASE_ACTIVE,
    resumeRequired: true,
    startedAt: stringValue(existing.startedAt) || timestamp,
    lastProgressAt: timestamp,
    lastHeartbeatAt: timestamp,
    lastHeartbeatSource: "approval-injection",
    lastHeartbeatStatus: "started",
    lastHeartbeatTurnId: turnId,
    heartbeatCount: Math.max(0, Math.trunc(Number(existing.heartbeatCount || 0)) || 0),
    injectedTurnId: stringValue(existing.injectedTurnId) || turnId,
    currentTurnId: turnId,
    resumeCount: Math.max(0, Math.trunc(Number(existing.resumeCount || 0)) || 0),
    continuationTurnIds: safeArray(existing.continuationTurnIds).map(stringValue).filter(Boolean).slice(-MAX_LEASE_TURN_IDS),
    lastResumeError: "",
    resumeForTurnId: "",
  });
}

function markLeaseCompleted(card, timestamp, fields = {}) {
  if (!card || !card.executionLease) return;
  card.executionLease = Object.assign({}, card.executionLease, fields, {
    status: EXECUTION_LEASE_COMPLETED,
    resumeRequired: false,
    completedAt: timestamp,
    lastProgressAt: timestamp,
    resumeForTurnId: "",
  });
}

function taskCardExecutionContinuationText(card, completed = {}, returnScriptPath = "scripts/return-thread-task-card.js") {
  const turnId = boundedMetadataString(completed && completed.turnId, 120);
  const lines = [
    "[Codex Mobile task-card continuation]",
    "",
    `Task card id: ${card.id}`,
    `Source thread id: ${card.source && card.source.threadId || ""}`,
    card.workflow && card.workflow.id ? `Workflow id: ${card.workflow.id}` : "",
    turnId ? `Interrupted ordinary turn completed: ${turnId}` : "",
    "",
    "An active non-terminal task card for this thread is still open. The previous turn appears to have answered an ordinary user interruption; that interruption does not pause, cancel, or complete the task card.",
    `Continue the original task-card work from the earlier injected task-card message in this thread. Do not request acknowledgement for terminal receipts, and close the original task card only through ${TASK_CARD_RETURN_TOOL_HINT}, or ${returnScriptPath} when the MCP tool surface is not callable, when the work is completed, blocked, redirected, or partially completed.`,
    "",
    card.message && card.message.title ? `Title: ${card.message.title}` : "",
    card.message && card.message.summary ? `Summary: ${card.message.summary}` : "",
  ].filter((line, index, all) => line !== "" || (index > 0 && all[index - 1] !== ""));
  return lines.join("\n");
}

function taskCardExecutionWatchdogText(card, returnScriptPath = "scripts/return-thread-task-card.js") {
  const lines = [
    "[Codex Mobile task-card watchdog continuation]",
    "",
    `Task card id: ${card.id}`,
    `Source thread id: ${card.source && card.source.threadId || ""}`,
    card.workflow && card.workflow.id ? `Workflow id: ${card.workflow.id}` : "",
    "",
    "This task card is approved and still has an active execution lease, but no terminal return or fresh bounded heartbeat has been recorded after the watchdog window.",
    `Continue the original task-card work from the earlier injected task-card message in this thread. Do not request acknowledgement for terminal receipts, and close the original task card only through ${TASK_CARD_RETURN_TOOL_HINT}, or ${returnScriptPath} when the MCP tool surface is not callable, when the work is completed, blocked, redirected, or partially completed.`,
    "",
    card.message && card.message.title ? `Title: ${card.message.title}` : "",
    card.message && card.message.summary ? `Summary: ${card.message.summary}` : "",
  ].filter((line, index, all) => line !== "" || (index > 0 && all[index - 1] !== ""));
  return lines.join("\n");
}

function publicCard(card, threadId) {
  const role = cardForThread(card, threadId) || "";
  const out = clone(card);
  out.sensitiveContext = publicSensitiveContext(out.sensitiveContext);
  if (!out.sensitiveContext) delete out.sensitiveContext;
  out.terminal = cardIsTerminal(out);
  out.requiresReturn = cardRequiresReturn(out);
  out.ackPolicy = cardAckPolicy(out);
  out.threadRole = role;
  out.canApprove = role === "target" && !out.terminal && out.status === "pending";
  out.canDelete = role === "target" && !out.terminal && out.status === "pending";
  out.canReply = role === "target" && !out.terminal && (out.status === "pending" || out.status === "approved");
  out.canRevoke = role === "source" && !out.terminal && out.status === "pending";
  out.executionLease = publicExecutionLease(out.executionLease);
  return out;
}

function omitEmptyObject(value) {
  if (!value || typeof value !== "object") return null;
  for (const key of Object.keys(value)) {
    if (value[key] == null || value[key] === "" || value[key] === false) delete value[key];
  }
  return Object.keys(value).length ? value : null;
}

function summarizePublicCardThreadRef(ref = {}, includeTurnId = false) {
  const out = {
    workspaceId: boundedMetadataString(ref.workspaceId, 260),
    threadId: boundedMetadataString(ref.threadId, 220),
    title: boundedMetadataString(ref.title, 200),
    role: boundedMetadataString(ref.role, 80),
  };
  if (includeTurnId) out.turnId = boundedMetadataString(ref.turnId, 220);
  return omitEmptyObject(out);
}

function summarizePublicCardMessage(message = {}) {
  const out = {
    format: boundedMetadataString(message.format || "markdown", 40),
    title: boundedVisibleText(message.title, MAX_TITLE_CHARS),
    summary: boundedVisibleText(message.summary, MAX_SUMMARY_CHARS),
  };
  if (typeof message.body === "string" && message.body) {
    out.bodyOmitted = true;
    out.bodyChars = message.body.length;
  } else if (message.bodyOmitted) {
    out.bodyOmitted = true;
    out.bodyChars = Math.max(0, Math.trunc(Number(message.bodyChars || 0)) || 0);
  }
  return omitEmptyObject(out);
}

function summarizePublicCardWorkflow(workflow = {}) {
  if (!workflow || typeof workflow !== "object") return null;
  return omitEmptyObject({
    mode: boundedMetadataString(workflow.mode, 40),
    id: boundedMetadataString(workflow.id, 220),
    originalTaskCardId: boundedMetadataString(workflow.originalTaskCardId, 180),
    sourceThreadId: boundedMetadataString(workflow.sourceThreadId, 220),
    targetThreadId: boundedMetadataString(workflow.targetThreadId, 220),
    expectedActorThreadId: boundedMetadataString(workflow.expectedActorThreadId, 220),
    sourceRole: boundedMetadataString(workflow.sourceRole, 80),
    targetRole: boundedMetadataString(workflow.targetRole, 80),
    routeKind: boundedMetadataString(workflow.routeKind, 80),
    requestId: boundedMetadataString(workflow.requestId, 220),
    resolverVersion: boundedMetadataString(workflow.resolverVersion, 120),
    authorized: workflow.authorized === true,
    authorizedAt: boundedMetadataString(workflow.authorizedAt, 80),
    authorizedByThreadId: boundedMetadataString(workflow.authorizedByThreadId, 220),
  });
}

function summarizePublicRouteResolution(routeResolution = {}) {
  if (!routeResolution || typeof routeResolution !== "object") return null;
  return omitEmptyObject({
    resolverVersion: boundedMetadataString(routeResolution.resolverVersion, 120),
    routeKind: boundedMetadataString(routeResolution.routeKind, 80),
    inputReferenceKind: boundedMetadataString(routeResolution.inputReferenceKind, 80),
    inputReferenceKinds: safeArray(routeResolution.inputReferenceKinds).map((entry) => boundedMetadataString(entry, 80)).filter(Boolean).slice(0, MAX_BATCH_TARGETS),
    inputReferenceCount: Math.max(0, Math.trunc(Number(routeResolution.inputReferenceCount || 0)) || 0),
    sourceThreadId: boundedMetadataString(routeResolution.sourceThreadId, 220),
    targetThreadId: boundedMetadataString(routeResolution.targetThreadId, 220),
    matchedThreadId: boundedMetadataString(routeResolution.matchedThreadId, 220),
    matchedThreadIds: safeArray(routeResolution.matchedThreadIds).map((entry) => boundedMetadataString(entry, 220)).filter(Boolean).slice(0, MAX_BATCH_TARGETS),
    sourceRole: boundedMetadataString(routeResolution.sourceRole, 80),
    targetRole: boundedMetadataString(routeResolution.targetRole, 80),
    code: boundedMetadataString(routeResolution.code, 120),
  });
}

function summarizePublicCardReplyTo(replyTo = {}) {
  if (!replyTo || typeof replyTo !== "object") return null;
  return omitEmptyObject({
    workspaceId: boundedMetadataString(replyTo.workspaceId, 260),
    threadId: boundedMetadataString(replyTo.threadId, 220),
    title: boundedMetadataString(replyTo.title, 200),
    cardId: boundedMetadataString(replyTo.cardId, 180),
  });
}

function summarizePublicCardDelivery(delivery = {}) {
  if (!delivery || typeof delivery !== "object") return null;
  return omitEmptyObject({
    approvalMode: boundedMetadataString(delivery.approvalMode, 80),
    targetApprovalBypassed: delivery.targetApprovalBypassed === true,
    reasoningEffort: boundedMetadataString(delivery.reasoningEffort, 40),
    returnStatus: boundedMetadataString(delivery.returnStatus, 40),
    returnToSource: delivery.returnToSource === true,
    autoReturnOnCompletion: delivery.autoReturnOnCompletion === true,
    requiresReturn: delivery.requiresReturn === false ? false : delivery.requiresReturn === true ? true : undefined,
    terminal: delivery.terminal === true,
    ackPolicy: boundedMetadataString(delivery.ackPolicy, 40),
  });
}

function summarizePublicCardAudit(audit = {}) {
  if (!audit || typeof audit !== "object") return null;
  return omitEmptyObject({
    replyToCardId: boundedMetadataString(audit.replyToCardId, 180),
    returnToSource: audit.returnToSource === true,
    returnStatus: boundedMetadataString(audit.returnStatus, 40),
    terminal: audit.terminal === true,
    ackPolicy: boundedMetadataString(audit.ackPolicy, 40),
    homeAiDeliveryReturnEventStatus: boundedMetadataString(audit.homeAiDeliveryReturnEventStatus, 80),
    homeAiDeliveryReturnEventHttpStatus: Math.max(0, Math.trunc(Number(audit.homeAiDeliveryReturnEventHttpStatus || 0)) || 0),
  });
}

function summarizePublicCardExecutionLease(lease = {}) {
  if (!lease || typeof lease !== "object") return null;
  return omitEmptyObject({
    cardId: boundedMetadataString(lease.cardId, 80),
    sourceThreadId: boundedMetadataString(lease.sourceThreadId, 80),
    targetThreadId: boundedMetadataString(lease.targetThreadId, 80),
    workflowId: boundedMetadataString(lease.workflowId, 120),
    workflowMode: boundedMetadataString(lease.workflowMode, 40),
    status: boundedMetadataString(lease.status, 40),
    resumeRequired: lease.resumeRequired === true,
    lastProgressAt: boundedMetadataString(lease.lastProgressAt, 80),
    lastHeartbeatAt: boundedMetadataString(lease.lastHeartbeatAt, 80),
    lastHeartbeatSource: boundedMetadataString(lease.lastHeartbeatSource, 80),
    lastHeartbeatStatus: boundedMetadataString(lease.lastHeartbeatStatus, 80),
    heartbeatAgeMs: Math.max(0, Math.trunc(Number(lease.heartbeatAgeMs || 0)) || 0),
    watchdogStaleAfterMs: Math.max(0, Math.trunc(Number(lease.watchdogStaleAfterMs || 0)) || 0),
    resumeRequiredByWatchdog: lease.resumeRequiredByWatchdog === true,
    lastWatchdogAttemptAt: boundedMetadataString(lease.lastWatchdogAttemptAt, 80),
    lastWatchdogAttemptAgeMs: Math.max(0, Math.trunc(Number(lease.lastWatchdogAttemptAgeMs || 0)) || 0),
    blockedReason: boundedMetadataString(lease.blockedReason, 120),
    currentTurnId: boundedMetadataString(lease.currentTurnId, 120),
    lastInterruptedTurnId: boundedMetadataString(lease.lastInterruptedTurnId, 120),
    lastContinuationTurnId: boundedMetadataString(lease.lastContinuationTurnId, 120),
    resumeCount: Math.max(0, Math.trunc(Number(lease.resumeCount || 0)) || 0),
    resumeForTurnId: boundedMetadataString(lease.resumeForTurnId, 120),
  });
}

function summarizePublicCard(card) {
  const out = {
    id: boundedMetadataString(card && card.id, 180),
    status: boundedMetadataString(card && card.status, 40),
    createdAt: boundedMetadataString(card && card.createdAt, 80),
    updatedAt: boundedMetadataString(card && card.updatedAt, 80),
    source: summarizePublicCardThreadRef(card && card.source, true),
    target: summarizePublicCardThreadRef(card && card.target, false),
    replyTo: summarizePublicCardReplyTo(card && card.replyTo),
    message: summarizePublicCardMessage(card && card.message),
    delivery: summarizePublicCardDelivery(card && card.delivery),
    workflow: summarizePublicCardWorkflow(card && card.workflow),
    routeResolution: summarizePublicRouteResolution(card && card.routeResolution),
    sensitiveContext: publicSensitiveContext(card && card.sensitiveContext),
    audit: summarizePublicCardAudit(card && card.audit),
    executionLease: summarizePublicCardExecutionLease(card && card.executionLease),
    injectionRuntime: omitEmptyObject({
      reasoningEffort: boundedMetadataString(card && card.injectionRuntime && card.injectionRuntime.reasoningEffort, 40),
      requestedReasoningEffort: boundedMetadataString(card && card.injectionRuntime && card.injectionRuntime.requestedReasoningEffort, 40),
      approvalPolicy: boundedMetadataString(card && card.injectionRuntime && card.injectionRuntime.approvalPolicy, 40),
      sandboxPolicyType: boundedMetadataString(card && card.injectionRuntime && card.injectionRuntime.sandboxPolicyType, 80),
      deployLaneNoApproval: card && card.injectionRuntime && card.injectionRuntime.deployLaneNoApproval === true,
      mainSourceReasoningFloor: boundedMetadataString(card && card.injectionRuntime && card.injectionRuntime.mainSourceReasoningFloor, 40),
    }),
    injectedTurnId: boundedMetadataString(card && card.injectedTurnId, 120),
    injectedThreadId: boundedMetadataString(card && card.injectedThreadId, 120),
    lastContinuationTurnId: boundedMetadataString(card && card.lastContinuationTurnId, 120),
    replyCardId: boundedMetadataString(card && card.replyCardId, 180),
    terminal: card && card.terminal === true,
    requiresReturn: card && card.requiresReturn === true,
    ackPolicy: boundedMetadataString(card && card.ackPolicy, 40),
    threadRole: boundedMetadataString(card && card.threadRole, 40),
    canApprove: card && card.canApprove === true,
    canDelete: card && card.canDelete === true,
    canReply: card && card.canReply === true,
    canRevoke: card && card.canRevoke === true,
  };
  for (const key of Object.keys(out)) {
    if (out[key] == null || out[key] === "" || out[key] === false) delete out[key];
  }
  return out;
}

function countsForThreadFromStore(store, threadId) {
  const id = stringValue(threadId);
  const counts = {
    pendingTotal: 0,
    pendingIncoming: 0,
    pendingOutgoing: 0,
  };
  if (!id) return counts;
  for (const card of safeArray(store && store.cards)) {
    if (!card || card.status !== "pending") continue;
    if (cardIsTerminal(card)) continue;
    const role = cardForThread(card, id);
    if (!role) continue;
    counts.pendingTotal += 1;
    if (role === "target") counts.pendingIncoming += 1;
    if (role === "source") counts.pendingOutgoing += 1;
  }
  return counts;
}

function normalizeCreateRequest(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw errorWithStatus("task_card_body_must_be_object");
  return {
    sourceWorkspaceId: boundedString(input.sourceWorkspaceId, "source_workspace_id", 260),
    sourceThreadId: boundedString(input.sourceThreadId, "source_thread_id", 220),
    sourceTurnId: boundedString(input.sourceTurnId, "source_turn_id", 220, false),
    sourceThreadTitle: boundedMetadataString(input.sourceThreadTitle, 200),
    sourceRole: normalizedRoleLabel(input.sourceRole || input.source_role),
    targetWorkspaceId: boundedString(input.targetWorkspaceId, "target_workspace_id", 260),
    targetThreadId: boundedString(input.targetThreadId, "target_thread_id", 220),
    targetRole: normalizedRoleLabel(input.targetRole || input.target_role),
    routeKind: normalizedRouteKind(input.routeKind || input.route_kind),
    requestId: boundedString(input.requestId || input.request_id, "request_id", 220, false),
    resolverVersion: boundedMetadataString(input.resolverVersion || input.resolver_version || TASK_CARD_RESOLVER_VERSION, 120),
    routeResolution: normalizeRouteResolution(input.routeResolution || input.route_resolution, input),
    idempotencyKey: boundedString(input.idempotencyKey, "idempotency_key", 220),
    format: normalizedFormat(input.format),
    title: readableCardText(input.title, "title", MAX_TITLE_CHARS),
    summary: readableCardText(input.summary, "summary", MAX_SUMMARY_CHARS),
    body: readableCardText(input.body, "body", MAX_BODY_CHARS),
    reasoningEffort: normalizedReasoningEffort(input.reasoningEffort || input.reasoning_effort || input.effort),
    workflowMode: normalizedWorkflowMode(input.workflowMode),
    workflowId: boundedString(input.workflowId, "workflow_id", 220, false),
    replyTo: normalizeReplyToRef(input),
    sensitiveContext: normalizeSecretRefsFromInput(input, {
      source: "task-card",
      targetPlugin: "codex",
      sourceThreadId: input.sourceThreadId,
      targetThreadId: input.targetThreadId,
      workspaceId: input.targetWorkspaceId || input.targetWorkspace,
    }),
  };
}

function normalizeTargetThreadIds(input = {}) {
  const raw = Array.isArray(input.targetThreadIds) && input.targetThreadIds.length
    ? input.targetThreadIds
    : [input.targetThreadId];
  const seen = new Set();
  const ids = [];
  for (const value of raw) {
    const id = boundedString(value, "target_thread_id", 220, false);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  if (!ids.length) throw errorWithStatus("target_thread_id_required");
  if (ids.length > MAX_BATCH_TARGETS) throw errorWithStatus("target_thread_ids_too_many");
  return ids;
}

function idempotencyKeyForTarget(baseKey, targetThreadId, index, total) {
  const base = boundedString(baseKey, "idempotency_key", 180);
  if (total <= 1) return base;
  return boundedString(`${base}:${index + 1}:${targetThreadId}`, "idempotency_key", 220);
}

function targetWorkspaceIdForInput(input, targetThreadId) {
  const map = input && input.targetWorkspaceIds && typeof input.targetWorkspaceIds === "object"
    ? input.targetWorkspaceIds
    : null;
  if (map && Object.prototype.hasOwnProperty.call(map, targetThreadId)) {
    return map[targetThreadId];
  }
  return input.targetWorkspaceId || input.targetWorkspace;
}

function normalizeCreateRequests(input = {}) {
  const targetThreadIds = normalizeTargetThreadIds(input);
  return targetThreadIds.map((targetThreadId, index) => normalizeCreateRequest(Object.assign({}, input, {
    targetThreadId,
    targetWorkspaceId: targetWorkspaceIdForInput(input, targetThreadId),
    idempotencyKey: idempotencyKeyForTarget(input.idempotencyKey, targetThreadId, index, targetThreadIds.length),
  })));
}

function normalizeReplyRequest(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw errorWithStatus("reply_body_must_be_object");
  const status = normalizedReturnStatus(input.status);
  return {
    sourceWorkspaceId: boundedString(input.sourceWorkspaceId, "source_workspace_id", 260, false),
    sourceThreadId: boundedString(input.sourceThreadId, "source_thread_id", 220, false),
    sourceThreadTitle: boundedMetadataString(input.sourceThreadTitle, 200),
    idempotencyKey: boundedString(input.idempotencyKey, "idempotency_key", 220),
    format: normalizedFormat(input.format || "markdown"),
    title: readableCardText(input.title, "title", MAX_TITLE_CHARS),
    summary: readableCardText(input.summary, "summary", MAX_SUMMARY_CHARS),
    body: readableCardText(input.body, "body", MAX_BODY_CHARS),
    status,
    returnToSource: input.returnToSource === true || input.return_to_source === true || Boolean(status),
    workflowMode: normalizedWorkflowMode(input.workflowMode),
    workflowModeExplicit: stringValue(input.workflowMode) !== "",
    workflowId: boundedString(input.workflowId, "workflow_id", 220, false),
  };
}

function isAutonomousWorkflow(workflow) {
  return Boolean(workflow && workflow.mode === WORKFLOW_MODE_AUTONOMOUS && stringValue(workflow.id));
}

function workflowIdForRequest(request) {
  if (!request || request.workflowMode !== WORKFLOW_MODE_AUTONOMOUS) return "";
  if (request.workflowId) return request.workflowId;
  const hash = crypto.createHash("sha256")
    .update([
      request.sourceThreadId,
      request.targetThreadId,
      request.idempotencyKey,
    ].map(stringValue).join("|"))
    .digest("hex")
    .slice(0, 24);
  return `twf_${hash}`;
}

function workflowForRequest(request, originalTaskCardId = "", timestamp = "") {
  if (!request || request.workflowMode !== WORKFLOW_MODE_AUTONOMOUS) return null;
  return {
    mode: WORKFLOW_MODE_AUTONOMOUS,
    id: workflowIdForRequest(request),
    authorized: false,
    originalTaskCardId: boundedMetadataString(originalTaskCardId, 180),
    sourceThreadId: request.sourceThreadId,
    sourceWorkspaceId: request.sourceWorkspaceId,
    sourceRole: request.sourceRole,
    targetThreadId: request.targetThreadId,
    targetWorkspaceId: request.targetWorkspaceId,
    targetRole: request.targetRole,
    expectedActorThreadId: request.targetThreadId,
    routeKind: request.routeKind,
    requestId: request.requestId,
    resolverVersion: request.resolverVersion || TASK_CARD_RESOLVER_VERSION,
    createdAt: timestamp,
    routeResolution: request.routeResolution,
  };
}

function workflowThreadIdsForCard(card) {
  const ids = [
    stringValue(card && card.source && card.source.threadId),
    stringValue(card && card.target && card.target.threadId),
  ].filter(Boolean).sort();
  return ids.length === 2 ? ids : [];
}

function sameWorkflowThreadIds(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === 2
    && right.length === 2
    && left[0] === right[0]
    && left[1] === right[1];
}

function activeWorkflowForCard(store, card) {
  if (!isAutonomousWorkflow(card && card.workflow)) return null;
  const threadIds = workflowThreadIdsForCard(card);
  if (threadIds.length !== 2) return null;
  return safeArray(store && store.workflows).find((workflow) => workflow
    && workflow.status === "active"
    && workflow.mode === WORKFLOW_MODE_AUTONOMOUS
    && stringValue(workflow.id) === stringValue(card.workflow.id)
    && sameWorkflowThreadIds(safeArray(workflow.threadIds).map(stringValue).sort(), threadIds)) || null;
}

function markCardWorkflowAuthorized(card, workflow) {
  if (!card || !isAutonomousWorkflow(card.workflow) || !workflow) return;
  card.workflow = Object.assign({}, card.workflow, {
    authorized: true,
    authorizedAt: workflow.approvedAt || workflow.updatedAt || "",
    authorizedByThreadId: workflow.approvedByThreadId || "",
  });
}

function activateWorkflowForCard(store, card, actorThreadId, timestamp) {
  if (!isAutonomousWorkflow(card && card.workflow)) return null;
  const threadIds = workflowThreadIdsForCard(card);
  if (threadIds.length !== 2) return null;
  store.workflows = safeArray(store.workflows);
  let workflow = activeWorkflowForCard(store, card);
  if (!workflow) {
    workflow = {
      id: card.workflow.id,
      mode: WORKFLOW_MODE_AUTONOMOUS,
      status: "active",
      threadIds,
      rootCardId: card.id,
      originalTaskCardId: stringValue(card.workflow.originalTaskCardId) || card.id,
      sourceThreadId: stringValue(card.workflow.sourceThreadId) || stringValue(card.source && card.source.threadId),
      sourceWorkspaceId: stringValue(card.workflow.sourceWorkspaceId) || stringValue(card.source && card.source.workspaceId),
      sourceRole: stringValue(card.workflow.sourceRole) || stringValue(card.source && card.source.role),
      targetThreadId: stringValue(card.workflow.targetThreadId) || stringValue(card.target && card.target.threadId),
      targetWorkspaceId: stringValue(card.workflow.targetWorkspaceId) || stringValue(card.target && card.target.workspaceId),
      targetRole: stringValue(card.workflow.targetRole) || stringValue(card.target && card.target.role),
      expectedActorThreadId: stringValue(card.workflow.expectedActorThreadId) || stringValue(card.target && card.target.threadId),
      routeKind: stringValue(card.workflow.routeKind),
      requestId: stringValue(card.workflow.requestId),
      resolverVersion: stringValue(card.workflow.resolverVersion) || TASK_CARD_RESOLVER_VERSION,
      routeResolution: normalizeRouteResolution(card.workflow.routeResolution || card.routeResolution, card.workflow),
      approvedByThreadId: stringValue(actorThreadId),
      approvedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    store.workflows.push(workflow);
  } else {
    workflow.updatedAt = timestamp;
  }
  markCardWorkflowAuthorized(card, workflow);
  return workflow;
}

function injectedMessageText(card, returnScriptPath = "scripts/return-thread-task-card.js") {
  const autonomous = isAutonomousWorkflow(card.workflow);
  const terminal = cardIsTerminal(card);
  const requiresReturn = cardRequiresReturn(card);
  const returnTarget = returnTargetRefForCard(card);
  const returnTargetDiffers = returnTargetUsesReplyTo(card);
  const autoReturnOnCompletion = autonomous
    && !terminal
    && card.delivery
    && card.delivery.autoReturnOnCompletion === true;
  const sourceDirect = card.delivery
    && card.delivery.approvalMode === "source_thread_direct";
  const secretReceipt = secretRefReceiptText(card.sensitiveContext);
  const lines = [
    sourceDirect ? "[Cross-thread task card sent by source thread]" : "[Cross-thread task card approved]",
    "",
    `Source workspace: ${card.source.workspaceId}`,
    `Source thread: ${card.source.title || card.source.threadId}`,
    `Source thread id: ${card.source.threadId}`,
    `Target workspace: ${card.target.workspaceId}`,
    `Current target thread: ${card.target.title || card.target.threadId}`,
    `Current target thread id: ${card.target.threadId}`,
    returnTargetDiffers ? `Return target thread: ${returnTarget.title || returnTarget.threadId}` : "",
    returnTargetDiffers ? `Return target thread id: ${returnTarget.threadId}` : "",
    `Task card id: ${card.id}`,
    card.message && card.message.title ? `Title: ${card.message.title}` : "",
    card.delivery && card.delivery.reasoningEffort ? `Requested reasoning effort: ${card.delivery.reasoningEffort}` : "",
    sourceDirect ? "Approval: target approval bypassed by the thread-callable interface." : "",
    autonomous ? `Workflow mode: ${card.workflow.mode}` : "",
    autonomous ? `Workflow id: ${card.workflow.id}` : "",
    autoReturnOnCompletion ? "Auto-return: when this injected turn completes, Codex Mobile Web will send a return task card back to the source thread in this workflow." : "",
    terminal ? "Return policy: terminal receipt; do not send an acknowledgement return unless this card explicitly creates new work." : "",
    !terminal && !autoReturnOnCompletion && requiresReturn ? `Return required: local final text in this target thread is not a source-thread return card. When this work is completed, blocked, or redirected, return a task card to the source with taskCardId ${card.id} through ${TASK_CARD_RETURN_TOOL_HINT}, or ${returnScriptPath} when the MCP tool surface is not callable.` : "",
    secretReceipt ? "Sensitive context: use the secure secretRef consumption path only for action-specific needs; do not ask the user to paste or reveal the plaintext credential in chat." : "",
    secretReceipt,
    "",
    stringValue(card.message && card.message.body),
  ].filter((line, index, all) => line !== "" || (index > 0 && all[index - 1] !== ""));
  return lines.join("\n");
}

function autoReplyBodyForCompletedTurn(card, completed = {}) {
  const finalReceipt = boundedVisibleText(completed.finalReceiptText, AUTO_REPLY_BODY_CHARS);
  const lines = [
    "## Automatic workflow return",
    "",
    `Completed target thread: ${card.target.threadId}`,
    completed.turnId ? `Completed turn: ${completed.turnId}` : "",
    completed.completedAt ? `Completed at: ${completed.completedAt}` : "",
    card.workflow && card.workflow.id ? `Workflow id: ${card.workflow.id}` : "",
    "",
    finalReceipt ? "## Target result" : "",
    finalReceipt,
  ].filter((line, index, all) => line !== "" || (index > 0 && all[index - 1] !== ""));
  return boundedVisibleText(lines.join("\n"), MAX_BODY_CHARS);
}

function markReturnToSourceMetadata(replyCard, replyRequest = {}) {
  if (!replyCard || replyRequest.returnToSource !== true) return;
  const returnStatus = replyRequest.status
    || (replyCard.delivery && replyCard.delivery.returnStatus)
    || (replyCard.audit && replyCard.audit.returnStatus)
    || "";
  replyCard.delivery = Object.assign({}, replyCard.delivery || {}, terminalReturnDeliveryFields(returnStatus));
  replyCard.audit = Object.assign({}, replyCard.audit || {}, {
    returnToSource: true,
    returnStatus,
    requiresReturn: false,
    terminal: true,
    ackPolicy: "none",
  });
}

function transitionAllowed(card, action, actorThreadId) {
  const actorThread = stringValue(actorThreadId);
  if (!actorThread) throw errorWithStatus("actor_thread_id_required");
  if (!card) throw errorWithStatus("task_card_not_found", 404);
  if (action === "reply") {
    if (stringValue(card.target && card.target.threadId) !== actorThread) {
      throw errorWithStatus("reply_requires_target_thread", 403);
    }
    if (cardIsTerminal(card)) {
      throw errorWithStatus("task_card_terminal_no_return_required", 409);
    }
    if (card.status !== "pending" && card.status !== "approved" && card.status !== "approving") {
      throw errorWithStatus(`task_card_not_returnable:${card.status}`, 409);
    }
    return;
  }
  if (card.status !== "pending") throw errorWithStatus(`task_card_not_pending:${card.status}`, 409);
  if (action === "approve" || action === "delete") {
    if (stringValue(card.target && card.target.threadId) !== actorThread) {
      throw errorWithStatus(`${action}_requires_target_thread`, 403);
    }
    return;
  }
  if (action === "revoke") {
    if (stringValue(card.source && card.source.threadId) !== actorThread) {
      throw errorWithStatus("revoke_requires_source_thread", 403);
    }
    return;
  }
  throw errorWithStatus(`unknown_action:${action}`);
}

function cardIsReturnableByThread(card, actorThreadId) {
  const actorThread = stringValue(actorThreadId);
  if (!card || !actorThread) return false;
  if (stringValue(card.target && card.target.threadId) !== actorThread) return false;
  if (cardIsTerminal(card)) return false;
  return card.status === "pending" || card.status === "approved" || card.status === "approving";
}

function cardIsReturnableByAnyTarget(card) {
  if (!card || !stringValue(card.target && card.target.threadId)) return false;
  if (cardIsTerminal(card)) return false;
  return card.status === "pending" || card.status === "approved" || card.status === "approving";
}

function createThreadTaskCardService(options = {}) {
  const storageFile = boundedString(options.storageFile, "storage_file", 1024);
  const recentLimit = Math.max(1, Number(options.recentLimit || DEFAULT_RECENT_LIMIT));
  const returnThreadTaskCardScriptPath = stringValue(options.returnThreadTaskCardScriptPath)
    || "scripts/return-thread-task-card.js";
  const executeApprovedCard = typeof options.executeApprovedCard === "function"
    ? options.executeApprovedCard
    : async () => ({});
  const onTerminalReturnCard = typeof options.onTerminalReturnCard === "function"
    ? options.onTerminalReturnCard
    : null;
  const onExecutionLeaseStarted = typeof options.onExecutionLeaseStarted === "function"
    ? options.onExecutionLeaseStarted
    : null;
  const onExecutionHeartbeat = typeof options.onExecutionHeartbeat === "function"
    ? options.onExecutionHeartbeat
    : null;
  const onExecutionLeaseCompleted = typeof options.onExecutionLeaseCompleted === "function"
    ? options.onExecutionLeaseCompleted
    : null;
  const idGenerator = typeof options.idGenerator === "function"
    ? options.idGenerator
    : () => `ttc_${crypto.randomBytes(9).toString("hex")}`;
  let writeQueue = Promise.resolve();
  let cachedStore = null;
  let cachedStoreSignature = null;

  function refreshCachedStore(store) {
    cachedStore = store;
    cachedStoreSignature = storeFileSignature(storageFile);
  }

  function readStore() {
    const signature = storeFileSignature(storageFile);
    if (cachedStore && sameStoreFileSignature(signature, cachedStoreSignature)) return cachedStore;
    const store = loadStore(storageFile);
    cachedStore = store;
    cachedStoreSignature = signature || storeFileSignature(storageFile);
    return store;
  }

  async function withStore(mutator) {
    let release;
    const next = new Promise((resolve) => { release = resolve; });
    const previous = writeQueue;
    writeQueue = previous.finally(() => next);
    await previous;
    let releaseStoreLock = null;
    try {
      releaseStoreLock = await acquireStoreLock(storageFile);
      const store = loadStore(storageFile);
      const result = await mutator(store);
      saveStore(storageFile, store);
      refreshCachedStore(store);
      return result;
    } finally {
      if (releaseStoreLock) releaseStoreLock();
      release();
    }
  }

  async function recordTerminalReturnEventResult(originalCardId, returnCardId, result = {}) {
    const sourceId = stringValue(originalCardId);
    const replyId = stringValue(returnCardId);
    if (!sourceId || !replyId) return null;
    return withStore(async (store) => {
      const replyCard = findById(store, replyId);
      if (!replyCard) return null;
      const timestamp = nowIso(options.now);
      const audit = Object.assign({}, replyCard.audit || {});
      audit.homeAiDeliveryReturnEventForCardId = sourceId;
      audit.homeAiDeliveryReturnEventAt = timestamp;
      audit.homeAiDeliveryReturnEventStatus = boundedMetadataString(result.status || "", 80);
      audit.homeAiDeliveryReturnEventHttpStatus = Math.max(0, Math.trunc(Number(result.httpStatus || 0)) || 0);
      audit.homeAiDeliveryReturnEventError = boundedMetadataString(result.error || "", 160);
      audit.homeAiDeliveryReturnEventId = boundedMetadataString(result.eventId || "", 160);
      audit.homeAiDeliveryReturnEventDeduped = result.deduped === true;
      replyCard.audit = audit;
      replyCard.updatedAt = timestamp;
      return publicCard(replyCard, replyCard.target && replyCard.target.threadId || "");
    });
  }

  async function notifyTerminalReturnCard(originalCardId, returnCardId) {
    if (!onTerminalReturnCard) return null;
    const sourceId = stringValue(originalCardId);
    const replyId = stringValue(returnCardId);
    if (!sourceId || !replyId) return null;
    const prepared = await withStore(async (store) => {
      const originalCard = findById(store, sourceId);
      const returnCard = findById(store, replyId);
      if (!originalCard || !returnCard) return null;
      const audit = returnCard.audit && typeof returnCard.audit === "object" ? returnCard.audit : {};
      if (audit.homeAiDeliveryReturnEventStatus === "sent"
        && stringValue(audit.homeAiDeliveryReturnEventForCardId) === sourceId) {
        return { skipped: true, reason: "already_sent" };
      }
      if (audit.homeAiDeliveryReturnEventStatus === "sending"
        && stringValue(audit.homeAiDeliveryReturnEventForCardId) === sourceId) {
        return { skipped: true, reason: "already_sending" };
      }
      const event = terminalReturnEventForCards(originalCard, returnCard);
      if (!event) return null;
      const timestamp = nowIso(options.now);
      returnCard.audit = Object.assign({}, audit, {
        homeAiDeliveryReturnEventForCardId: sourceId,
        homeAiDeliveryReturnEventAttemptedAt: timestamp,
        homeAiDeliveryReturnEventStatus: "sending",
        homeAiDeliveryReturnEventError: "",
      });
      returnCard.updatedAt = timestamp;
      return { event };
    });
    if (!prepared || prepared.skipped || !prepared.event) return prepared;
    try {
      const sent = await onTerminalReturnCard(prepared.event);
      return recordTerminalReturnEventResult(sourceId, replyId, {
        status: "sent",
        httpStatus: sent && sent.status,
        eventId: sent && sent.eventId,
        deduped: sent && sent.deduped,
      });
    } catch (err) {
      const httpStatus = Math.max(0, Math.trunc(Number(err && (err.responseStatus || err.statusCode) || 0)) || 0);
      const eventStatus = httpStatus === 404 ? "unknown_task_card" : "failed";
      return recordTerminalReturnEventResult(sourceId, replyId, {
        status: eventStatus,
        httpStatus,
        error: err && err.message ? err.message : String(err || "home_ai_return_event_failed"),
      });
    }
  }

  async function notifyExecutionLifecycle(callback, event = {}) {
    if (!callback) return null;
    const taskCardId = stringValue(event.taskCardId || event.card && event.card.id);
    const phase = boundedMetadataString(event.phase || event.heartbeat && event.heartbeat.status || "execution_lifecycle", 80);
    let result = null;
    try {
      result = await callback(event);
    } catch (err) {
      result = {
        ok: false,
        error: boundedErrorMessage(err),
      };
    }
    if (result && result.ok === false && taskCardId) {
      await withStore(async (store) => {
        const card = findById(store, taskCardId);
        if (!card) return null;
        const timestamp = nowIso(options.now);
        card.audit = Object.assign({}, card.audit || {}, {
          executionLifecycleSyncFailedAt: timestamp,
          executionLifecycleSyncPhase: phase,
          executionLifecycleSyncError: boundedMetadataString(result.error || "execution_lifecycle_sync_failed", 160),
        });
        card.updatedAt = timestamp;
        return null;
      });
    }
    return result;
  }

  function findByIdempotency(store, key) {
    return safeArray(store.cards).find((card) => stringValue(card.idempotencyKey) === stringValue(key)) || null;
  }

  function findById(store, id) {
    return safeArray(store.cards).find((entry) => stringValue(entry.id) === stringValue(id)) || null;
  }

  function findReturnCardByWorkflow(store, workflowId, actorThreadId, existingReplyCard = null) {
    const workflow = stringValue(workflowId);
    const actorThread = stringValue(actorThreadId);
    if (!workflow) return null;
    const existingReplyCardId = stringValue(existingReplyCard && existingReplyCard.id);
    const workflowCards = safeArray(store.cards)
      .filter((card) => stringValue(card && card.workflow && card.workflow.id) === workflow);
    const workflowReturnCards = workflowCards.filter((card) => {
      if (cardIsReturnableByAnyTarget(card)) return true;
      return existingReplyCardId
        && card && card.status === "replied"
        && stringValue(card.replyCardId) === existingReplyCardId;
    });
    const actorCandidates = actorThread
      ? workflowReturnCards.filter((card) => stringValue(card && card.target && card.target.threadId) === actorThread)
      : [];
    if (workflowReturnCards.length && actorThread && !actorCandidates.length) {
      const expectedActorThreadIds = Array.from(new Set(workflowReturnCards
        .map((card) => stringValue(card && card.workflow && card.workflow.expectedActorThreadId)
          || stringValue(card && card.target && card.target.threadId))
        .filter(Boolean)))
        .sort();
      const err = errorWithStatus("workflow_actor_mismatch", 403);
      err.details = {
        workflowId: workflow,
        requestedActorThreadId: actorThread,
        expectedActorThreadIds,
      };
      throw err;
    }
    const candidates = (actorCandidates.length ? actorCandidates : workflowReturnCards)
      .filter((card) => {
        if (cardIsReturnableByAnyTarget(card)) return true;
        return existingReplyCardId
          && card && card.status === "replied"
          && stringValue(card.replyCardId) === existingReplyCardId;
      })
      .sort((left, right) => {
        const leftTime = Date.parse(left.updatedAt || left.createdAt || "") || 0;
        const rightTime = Date.parse(right.updatedAt || right.createdAt || "") || 0;
        return rightTime - leftTime || stringValue(left.id).localeCompare(stringValue(right.id));
      });
    if (candidates.length > 1) throw errorWithStatus("task_card_workflow_return_ambiguous", 409);
    return candidates[0] || null;
  }

  function createCardFromRequest(request, store) {
    if (request.sourceThreadId === request.targetThreadId) throw errorWithStatus("target_thread_must_differ_from_source_thread");
    const existing = findByIdempotency(store, request.idempotencyKey);
    if (existing) return publicCard(existing, request.sourceThreadId);
    const timestamp = nowIso(options.now);
    const cardId = idGenerator();
    const card = {
      id: cardId,
      status: "pending",
      idempotencyKey: request.idempotencyKey,
      createdAt: timestamp,
      updatedAt: timestamp,
      source: {
        workspaceId: request.sourceWorkspaceId,
        threadId: request.sourceThreadId,
        turnId: request.sourceTurnId || "",
        title: request.sourceThreadTitle || request.sourceThreadId,
        role: request.sourceRole || "",
      },
      target: {
        workspaceId: request.targetWorkspaceId,
        threadId: request.targetThreadId,
        role: request.targetRole || "",
      },
      routeResolution: normalizeRouteResolution(request.routeResolution, request),
      message: {
        format: request.format,
        title: request.title,
        summary: request.summary,
        body: request.body,
      },
      delivery: {
        injectOnApprove: true,
        allowReply: true,
        allowRevoke: true,
        reasoningEffort: request.reasoningEffort || "",
        autoRunAfterFirstApproval: request.workflowMode === WORKFLOW_MODE_AUTONOMOUS,
        autoReturnOnCompletion: request.workflowMode === WORKFLOW_MODE_AUTONOMOUS,
        requiresReturn: true,
        terminal: false,
        ackPolicy: request.workflowMode === WORKFLOW_MODE_AUTONOMOUS ? "auto_return" : "return_required",
      },
      workflow: workflowForRequest(request, cardId, timestamp),
      audit: {
        createdAt: timestamp,
      },
    };
    const sensitiveContext = scopeSecretRefs(request.sensitiveContext, {
      sourceThreadId: request.sourceThreadId,
      targetThreadId: request.targetThreadId,
      threadId: request.targetThreadId,
      taskCardId: cardId,
      workspaceId: request.targetWorkspaceId,
      workspaceCwd: request.targetWorkspaceId,
    });
    if (sensitiveContext) card.sensitiveContext = sensitiveContext;
    const replyTo = resolveReplyToRefForRequest(request, store);
    if (replyTo) card.replyTo = replyTo;
    store.cards.push(card);
    return publicCard(card, request.sourceThreadId);
  }

  async function executeCardApproval(cardId, actorThreadId, approvalOptions = {}) {
    const id = stringValue(cardId);
    const automatic = approvalOptions.automatic === true;
    const sourceDirect = approvalOptions.sourceDirect === true;
    const actorThread = stringValue(actorThreadId);
    const publicThreadId = stringValue(approvalOptions.publicThreadId || actorThread);
    const prepared = await withStore(async (store) => {
      const card = findById(store, id);
      let workflow = null;
      if (automatic) {
        if (!card) throw errorWithStatus("task_card_not_found", 404);
        if (card.status === "approving") return { approvalInFlight: true, card: clone(card) };
        if (card.status !== "pending") return null;
        workflow = activeWorkflowForCard(store, card);
        if (!workflow) return null;
        markCardWorkflowAuthorized(card, workflow);
      } else if (sourceDirect) {
        if (!actorThread) throw errorWithStatus("actor_thread_id_required");
        if (!card) throw errorWithStatus("task_card_not_found", 404);
        if (card.status === "approved") return { alreadyApproved: true, card: clone(card) };
        if (card.status === "approving") {
          if (stringValue(card.source && card.source.threadId) !== actorThread) {
            throw errorWithStatus("direct_approval_requires_source_thread", 403);
          }
          return { approvalInFlight: true, card: clone(card) };
        }
        if (card.status !== "pending") throw errorWithStatus(`task_card_not_pending:${card.status}`, 409);
        if (stringValue(card.source && card.source.threadId) !== actorThread) {
          throw errorWithStatus("direct_approval_requires_source_thread", 403);
        }
      } else {
        if (!card) throw errorWithStatus("task_card_not_found", 404);
        if (card.status === "approving") {
          if (stringValue(card.target && card.target.threadId) !== actorThread) {
            throw errorWithStatus("approve_requires_target_thread", 403);
          }
          return { approvalInFlight: true, card: clone(card) };
        }
        transitionAllowed(card, "approve", actorThreadId);
      }
      const timestamp = nowIso(options.now);
      card.status = "approving";
      card.updatedAt = timestamp;
      if (sourceDirect) {
        card.delivery = Object.assign({}, card.delivery || {}, {
          approvalMode: "source_thread_direct",
          targetApprovalBypassed: true,
        });
      }
      card.audit = Object.assign({}, card.audit || {}, automatic ? {
        autoApprovingAt: timestamp,
        autoApprovedByWorkflowId: card.workflow.id,
      } : sourceDirect ? {
        directApprovingAt: timestamp,
        directApprovedByThreadId: actorThread,
        targetApprovalBypassed: true,
      } : {
        approvingAt: timestamp,
        approvingByThreadId: actorThread,
      });
      return { card: clone(card) };
    });
    if (!prepared) return null;
    if (prepared.approvalInFlight) {
      return {
        card: publicCard(prepared.card, publicThreadId || actorThread || prepared.card.target.threadId),
        execution: null,
        approvalInFlight: true,
      };
    }
    if (prepared.alreadyApproved) {
      return {
        card: publicCard(prepared.card, publicThreadId || actorThread || prepared.card.target.threadId),
        execution: null,
        alreadyApproved: true,
      };
    }
    const preparedCard = prepared.card;

    let execution;
    try {
      execution = await executeApprovedCard(clone(preparedCard), {
        text: injectedMessageText(preparedCard, returnThreadTaskCardScriptPath),
      });
    } catch (err) {
      await withStore(async (store) => {
        const card = findById(store, id);
        if (card && card.status === "approving") {
          const timestamp = nowIso(options.now);
          card.status = "pending";
          card.updatedAt = timestamp;
          card.audit = Object.assign({}, card.audit || {}, {
            approvalFailedAt: timestamp,
            approvalError: boundedErrorMessage(err),
          }, automatic && preparedCard.workflow ? {
            autoApprovalFailedAt: timestamp,
            autoApprovedByWorkflowId: preparedCard.workflow.id,
          } : sourceDirect ? {
            directApprovalFailedAt: timestamp,
            directApprovedByThreadId: actorThread,
          } : {});
        }
        return null;
      });
      throw err;
    }

    const approvedResult = await withStore(async (store) => {
      const card = findById(store, id);
      if (!card) throw errorWithStatus("task_card_not_found", 404);
      const timestamp = nowIso(options.now);
      card.status = "approved";
      card.updatedAt = timestamp;
      const workflow = automatic
        ? activeWorkflowForCard(store, card)
        : sourceDirect
          ? null
        : activateWorkflowForCard(store, card, actorThread, timestamp);
      if (workflow) markCardWorkflowAuthorized(card, workflow);
      card.audit = Object.assign({}, card.audit || {}, automatic && card.workflow ? {
        approvedAt: timestamp,
        approvedByThreadId: card.target && card.target.threadId || "",
        autoApprovedAt: timestamp,
        autoApprovedByWorkflowId: card.workflow.id,
      } : sourceDirect ? {
        approvedAt: timestamp,
        approvedByThreadId: actorThread,
        directApprovedAt: timestamp,
        directApprovedByThreadId: actorThread,
        targetApprovalBypassed: true,
      } : {
        approvedAt: timestamp,
        approvedByThreadId: actorThread,
      });
      if (execution && execution.turnId) card.injectedTurnId = String(execution.turnId);
      if (execution && execution.threadId) card.injectedThreadId = String(execution.threadId);
      if (execution && execution.result) card.injectionResult = execution.result;
      if (execution && execution.runtime && typeof execution.runtime === "object") {
        card.injectionRuntime = {
          reasoningEffort: boundedMetadataString(execution.runtime.reasoningEffort, 40),
          requestedReasoningEffort: boundedMetadataString(execution.runtime.requestedReasoningEffort, 40),
          approvalPolicy: boundedMetadataString(execution.runtime.approvalPolicy, 40),
          sandboxPolicyType: boundedMetadataString(execution.runtime.sandboxPolicyType, 80),
          deployLaneNoApproval: execution.runtime.deployLaneNoApproval === true,
          mainSourceReasoningFloor: boundedMetadataString(execution.runtime.mainSourceReasoningFloor, 40),
        };
      }
      if (cardCanOwnExecutionLease(card)) {
        card.executionLease = leaseForApprovedCard(card, execution, timestamp);
      }
      return {
        card: publicCard(card, publicThreadId || actorThread || card.target.threadId),
        execution,
      };
    });
    if (approvedResult.card && approvedResult.card.executionLease) {
      await notifyExecutionLifecycle(onExecutionLeaseStarted, {
        phase: "started",
        taskCardId: approvedResult.card.id || id,
        targetThreadId: approvedResult.card.target && approvedResult.card.target.threadId || "",
        card: approvedResult.card,
        execution: approvedResult.execution,
        heartbeat: {
          taskCardId: approvedResult.card.id || id,
          targetThreadId: approvedResult.card.target && approvedResult.card.target.threadId || "",
          source: "approval-injection",
          status: "started",
          turnId: approvedResult.execution && approvedResult.execution.turnId || approvedResult.card.executionLease.currentTurnId || "",
        },
      });
    }
    return approvedResult;
  }

  async function maybeAutoApprovePublicCard(card, publicThreadId) {
    if (!card || !isAutonomousWorkflow(card.workflow) || card.status !== "pending") return card;
    try {
      const result = await executeCardApproval(card.id, "", {
        automatic: true,
        publicThreadId,
      });
      return result && result.card ? result.card : card;
    } catch (_) {
      try {
        return get(card.id, publicThreadId);
      } catch (err) {
        return card;
      }
    }
  }

  async function create(input) {
    const request = normalizeCreateRequest(input);
    const card = await withStore(async (store) => createCardFromRequest(request, store));
    return maybeAutoApprovePublicCard(card, request.sourceThreadId);
  }

  async function createMany(input) {
    const requests = normalizeCreateRequests(input);
    const cards = await withStore(async (store) => requests.map((request) => createCardFromRequest(request, store)));
    const results = [];
    for (const card of cards) {
      results.push(await maybeAutoApprovePublicCard(card, card && card.source && card.source.threadId));
    }
    return results;
  }

  function listForThread(threadId) {
    const id = stringValue(threadId);
    if (!id) return [];
    const store = readStore();
    return sortCards(store.cards)
      .filter((card) => Boolean(cardForThread(card, id)))
      .slice(0, recentLimit)
      .map((card) => summarizePublicCard(publicCard(card, id)));
  }

  function summaryForThread(threadId) {
    const id = stringValue(threadId);
    if (!id) {
      return {
        cards: [],
        counts: countsForThreadFromStore(defaultStore(), ""),
      };
    }
    const store = readStore();
    return {
      cards: sortCards(store.cards)
        .filter((card) => Boolean(cardForThread(card, id)))
        .slice(0, recentLimit)
        .map((card) => summarizePublicCard(publicCard(card, id))),
      counts: countsForThreadFromStore(store, id),
    };
  }

  function get(cardId, threadId = "") {
    const id = stringValue(cardId);
    if (!id) throw errorWithStatus("task_card_id_required");
    const store = readStore();
    const card = findById(store, id);
    if (!card) throw errorWithStatus("task_card_not_found", 404);
    return publicCard(card, threadId || card.source.threadId || card.target.threadId || "");
  }

  async function approve(cardId, actorThreadId) {
    return executeCardApproval(cardId, actorThreadId);
  }

  async function approveFromSource(cardId, actorThreadId) {
    return executeCardApproval(cardId, actorThreadId, {
      sourceDirect: true,
      publicThreadId: actorThreadId,
    });
  }

  async function deleteCard(cardId, actorThreadId) {
    const id = stringValue(cardId);
    return withStore(async (store) => {
      const card = safeArray(store.cards).find((entry) => stringValue(entry.id) === id);
      transitionAllowed(card, "delete", actorThreadId);
      const timestamp = nowIso(options.now);
      card.status = "deleted";
      card.updatedAt = timestamp;
      card.audit = Object.assign({}, card.audit || {}, {
        deletedAt: timestamp,
        deletedByThreadId: stringValue(actorThreadId),
      });
      return publicCard(card, actorThreadId);
    });
  }

  async function revoke(cardId, actorThreadId) {
    const id = stringValue(cardId);
    return withStore(async (store) => {
      const card = safeArray(store.cards).find((entry) => stringValue(entry.id) === id);
      transitionAllowed(card, "revoke", actorThreadId);
      const timestamp = nowIso(options.now);
      card.status = "revoked";
      card.updatedAt = timestamp;
      card.audit = Object.assign({}, card.audit || {}, {
        revokedAt: timestamp,
        revokedByThreadId: stringValue(actorThreadId),
      });
      return publicCard(card, actorThreadId);
    });
  }

  async function reply(cardId, actorThreadId, payload) {
    const id = stringValue(cardId);
    const replyRequest = normalizeReplyRequest(payload);
    const result = await withStore(async (store) => {
      const existing = findByIdempotency(store, replyRequest.idempotencyKey);
      const requestedActorThreadId = stringValue(actorThreadId);
      let resolvedActorThreadId = requestedActorThreadId;
      let workflowRecovered = false;
      let actorThreadInferred = false;
      const directCard = findById(store, id);
      const card = directCard || (replyRequest.returnToSource === true
        ? findReturnCardByWorkflow(store, replyRequest.workflowId, requestedActorThreadId, existing)
        : null);
      if (!directCard && card) workflowRecovered = true;
      if (!card && replyRequest.returnToSource === true) {
        return {
          noOp: true,
          card: null,
          replyCard: null,
          returnResolution: {
            noOp: true,
            reason: "task_card_not_found",
            taskCardId: id,
            workflowId: replyRequest.workflowId || "",
            requestedActorThreadId,
            resolvedActorThreadId: "",
            workflowRecovered: false,
            actorThreadInferred: false,
            resolverVersion: TASK_CARD_RESOLVER_VERSION,
          },
        };
      }
      if (card && replyRequest.returnToSource === true) {
        const expectedTargetThreadId = stringValue(card.workflow && card.workflow.expectedActorThreadId)
          || stringValue(card.target && card.target.threadId);
        if (!resolvedActorThreadId && expectedTargetThreadId) {
          resolvedActorThreadId = expectedTargetThreadId;
          actorThreadInferred = true;
        }
        const workflowMatches = replyRequest.workflowId
          && stringValue(card.workflow && card.workflow.id) === replyRequest.workflowId;
        if (expectedTargetThreadId
          && requestedActorThreadId
          && requestedActorThreadId !== expectedTargetThreadId
          && workflowMatches) {
          const err = errorWithStatus("workflow_actor_mismatch", 403);
          err.details = {
            workflowId: replyRequest.workflowId,
            taskCardId: card.id,
            requestedActorThreadId,
            expectedActorThreadId: expectedTargetThreadId,
            resolverVersion: stringValue(card.workflow && card.workflow.resolverVersion) || TASK_CARD_RESOLVER_VERSION,
          };
          throw err;
        }
      }
      if (card && card.status === "replied" && existing && stringValue(card.replyCardId) === stringValue(existing.id)) {
        markReturnToSourceMetadata(existing, replyRequest);
        return {
          card: publicCard(card, resolvedActorThreadId),
          replyCard: publicCard(existing, existing.target && existing.target.threadId || ""),
          returnResolution: {
            noOp: false,
            reason: "",
            taskCardId: card.id,
            workflowId: replyRequest.workflowId || stringValue(card.workflow && card.workflow.id),
            requestedActorThreadId,
            resolvedActorThreadId,
            expectedTargetThreadId: stringValue(card.workflow && card.workflow.expectedActorThreadId) || stringValue(card.target && card.target.threadId),
            workflowRecovered,
            actorThreadInferred,
            resolverVersion: stringValue(card.workflow && card.workflow.resolverVersion) || TASK_CARD_RESOLVER_VERSION,
          },
        };
      }
      if (card && replyRequest.returnToSource === true && cardIsTerminal(card)) {
        const replyCard = stringValue(card.replyCardId) ? findById(store, card.replyCardId) : null;
        return {
          noOp: true,
          card: publicCard(card, resolvedActorThreadId),
          replyCard: replyCard ? publicCard(replyCard, replyCard.target && replyCard.target.threadId || "") : null,
          returnResolution: {
            noOp: true,
            reason: "already_closed",
            taskCardId: card.id,
            workflowId: replyRequest.workflowId || stringValue(card.workflow && card.workflow.id),
            requestedActorThreadId,
            resolvedActorThreadId,
            expectedTargetThreadId: stringValue(card.workflow && card.workflow.expectedActorThreadId) || stringValue(card.target && card.target.threadId),
            workflowRecovered,
            actorThreadInferred,
            resolverVersion: stringValue(card.workflow && card.workflow.resolverVersion) || TASK_CARD_RESOLVER_VERSION,
          },
        };
      }
      transitionAllowed(card, "reply", resolvedActorThreadId);
      const timestamp = nowIso(options.now);
      const replyWorkflowMode = replyRequest.workflowModeExplicit
        ? replyRequest.workflowMode
        : (isAutonomousWorkflow(card.workflow) ? WORKFLOW_MODE_AUTONOMOUS : WORKFLOW_MODE_MANUAL);
      const replySourceThreadId = replyRequest.sourceThreadId || card.target.threadId;
      const replyTarget = replyRequest.returnToSource === true
        ? returnTargetRefForCard(card)
        : sourceThreadRefForCard(card);
      const replyTargetThreadId = replyTarget.threadId;
      const replyWorkflowId = replyRequest.workflowId
        || (replyWorkflowMode === WORKFLOW_MODE_AUTONOMOUS && card.workflow ? card.workflow.id : "")
        || workflowIdForRequest({
          workflowMode: replyWorkflowMode,
          sourceThreadId: replySourceThreadId,
          targetThreadId: replyTargetThreadId,
          idempotencyKey: replyRequest.idempotencyKey,
        });
      card.status = "replied";
      card.updatedAt = timestamp;
      card.audit = Object.assign({}, card.audit || {}, {
        repliedAt: timestamp,
        repliedByThreadId: resolvedActorThreadId,
      });
      let replyCard = existing;
      if (!replyCard) {
        replyCard = {
          id: idGenerator(),
          status: "pending",
          idempotencyKey: replyRequest.idempotencyKey,
          createdAt: timestamp,
          updatedAt: timestamp,
          source: {
            workspaceId: replyRequest.sourceWorkspaceId || card.target.workspaceId,
            threadId: replySourceThreadId,
            turnId: "",
            title: replyRequest.sourceThreadTitle || card.target.threadId,
            role: stringValue(card.target && card.target.role),
          },
          target: {
            workspaceId: replyTarget.workspaceId,
            threadId: replyTargetThreadId,
            role: stringValue(card.source && card.source.role),
          },
          routeResolution: normalizeRouteResolution({
            resolverVersion: stringValue(card.workflow && card.workflow.resolverVersion) || TASK_CARD_RESOLVER_VERSION,
            routeKind: "return",
            inputReferenceKind: "workflow",
            inputReferenceKinds: ["workflow"],
            inputReferenceCount: 1,
            sourceThreadId: replySourceThreadId,
            targetThreadId: replyTargetThreadId,
            matchedThreadId: replyTargetThreadId,
            matchedThreadIds: [replyTargetThreadId],
            sourceRole: stringValue(card.target && card.target.role),
            targetRole: stringValue(card.source && card.source.role),
            code: "return_to_source",
          }),
          message: {
            format: replyRequest.format,
            title: replyRequest.title,
            summary: replyRequest.summary,
            body: replyRequest.body,
          },
          delivery: {
            injectOnApprove: true,
            allowReply: replyRequest.returnToSource !== true,
            allowRevoke: replyRequest.returnToSource !== true,
            autoRunAfterFirstApproval: replyRequest.returnToSource === true ? false : replyWorkflowMode === WORKFLOW_MODE_AUTONOMOUS,
            autoReturnOnCompletion: false,
            returnToSource: replyRequest.returnToSource === true,
            returnStatus: replyRequest.status || "",
            requiresReturn: replyRequest.returnToSource !== true,
            terminal: replyRequest.returnToSource === true,
            ackPolicy: replyRequest.returnToSource === true ? "none" : "return_required",
          },
          workflow: replyWorkflowMode === WORKFLOW_MODE_AUTONOMOUS ? {
            mode: WORKFLOW_MODE_AUTONOMOUS,
            id: replyWorkflowId,
            authorized: false,
            originalTaskCardId: stringValue(card.workflow && card.workflow.originalTaskCardId) || card.id,
            sourceThreadId: replySourceThreadId,
            sourceWorkspaceId: replyRequest.sourceWorkspaceId || card.target.workspaceId,
            sourceRole: stringValue(card.target && card.target.role),
            targetThreadId: replyTargetThreadId,
            targetWorkspaceId: replyTarget.workspaceId,
            targetRole: stringValue(card.source && card.source.role),
            expectedActorThreadId: replyTargetThreadId,
            routeKind: "return",
            requestId: replyRequest.idempotencyKey,
            resolverVersion: stringValue(card.workflow && card.workflow.resolverVersion) || TASK_CARD_RESOLVER_VERSION,
          } : null,
          audit: {
            createdAt: timestamp,
            replyToCardId: card.id,
            originalSourceThreadId: card.source && card.source.threadId || "",
            returnTargetThreadId: replyTargetThreadId,
            returnTargetWorkspaceId: replyTarget.workspaceId || "",
            returnRoutedByReplyTo: replyRequest.returnToSource === true && returnTargetUsesReplyTo(card),
            returnToSource: replyRequest.returnToSource === true,
            returnStatus: replyRequest.status || "",
            requiresReturn: replyRequest.returnToSource !== true,
            terminal: replyRequest.returnToSource === true,
            ackPolicy: replyRequest.returnToSource === true ? "none" : "return_required",
          },
        };
        store.cards.push(replyCard);
      } else if (replyRequest.returnToSource === true) {
        markReturnToSourceMetadata(replyCard, replyRequest);
      }
      card.replyCardId = replyCard.id;
      markLeaseCompleted(card, timestamp, {
        completedByReplyCardId: replyCard.id,
        returnToSource: replyRequest.returnToSource === true,
        returnStatus: replyRequest.status || "",
      });
      return {
        card: publicCard(card, resolvedActorThreadId),
        replyCard: publicCard(replyCard, replyCard.target && replyCard.target.threadId || replyTargetThreadId),
        returnResolution: {
          noOp: false,
          reason: "",
          taskCardId: card.id,
          workflowId: replyWorkflowId || stringValue(card.workflow && card.workflow.id),
          requestedActorThreadId,
          resolvedActorThreadId,
          expectedTargetThreadId: stringValue(card.workflow && card.workflow.expectedActorThreadId) || stringValue(card.target && card.target.threadId),
          workflowRecovered,
          actorThreadInferred,
          resolverVersion: stringValue(card.workflow && card.workflow.resolverVersion) || TASK_CARD_RESOLVER_VERSION,
        },
      };
    });
    if (result && result.noOp) return result;
    await notifyExecutionLifecycle(onExecutionLeaseCompleted, {
      phase: "completed",
      taskCardId: result.card && result.card.id || id,
      targetThreadId: result.card && result.card.target && result.card.target.threadId || "",
      card: result.card,
      returnStatus: replyRequest.status || "completed",
      replyCardId: result.replyCard && result.replyCard.id || "",
      heartbeat: {
        taskCardId: result.card && result.card.id || id,
        targetThreadId: result.card && result.card.target && result.card.target.threadId || "",
        source: "terminal-return",
        status: "completed",
        summary: replyRequest.status || "completed",
        turnId: result.card && result.card.executionLease && result.card.executionLease.currentTurnId || "",
      },
    });
    if (replyRequest.returnToSource === true) {
      const approved = await executeCardApproval(result.replyCard.id, result.returnResolution && result.returnResolution.resolvedActorThreadId || actorThreadId, {
        sourceDirect: true,
        publicThreadId: result.replyCard && result.replyCard.target && result.replyCard.target.threadId || "",
      });
      if (approved && approved.card) result.replyCard = approved.card;
      await notifyTerminalReturnCard(
        result.returnResolution && result.returnResolution.taskCardId || id,
        result.replyCard && result.replyCard.id,
      );
    } else {
      result.replyCard = await maybeAutoApprovePublicCard(result.replyCard, result.replyCard && result.replyCard.target && result.replyCard.target.threadId);
    }
    return result;
  }

  function nextInterruptedExecutionCard(store, threadId, turnId) {
    const id = stringValue(threadId);
    const completedTurnId = stringValue(turnId);
    if (!id || !completedTurnId) return null;
    const candidates = safeArray(store && store.cards)
      .filter((card) => {
        if (!cardCanOwnExecutionLease(card)) return false;
        if (stringValue(card.target && card.target.threadId) !== id) return false;
        if (stringValue(card.replyCardId) || stringValue(card.autoReplyCardId)) return false;
        const lease = card.executionLease && typeof card.executionLease === "object" ? card.executionLease : null;
        if (!lease || !lease.resumeRequired || !leaseIsActive(lease)) return false;
        if (stringValue(lease.lastInterruptedTurnId) === completedTurnId) return false;
        if (stringValue(lease.resumeForTurnId) === completedTurnId) return false;
        if (executionTurnIds(lease).includes(completedTurnId)) return false;
        return true;
      })
      .sort((left, right) => {
        const leftTime = Date.parse(left.executionLease && left.executionLease.startedAt || left.createdAt || "") || 0;
        const rightTime = Date.parse(right.executionLease && right.executionLease.startedAt || right.createdAt || "") || 0;
        return leftTime - rightTime || stringValue(left.id).localeCompare(stringValue(right.id));
      });
    return candidates[0] || null;
  }

  function normalizedExecutionWatchdogLimit(value) {
    const parsed = Math.trunc(Number(value));
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(1, Math.min(MAX_EXECUTION_WATCHDOG_BATCH, parsed));
  }

  function normalizedExecutionWatchdogStaleMs(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_EXECUTION_WATCHDOG_STALE_MS;
    return Math.max(0, parsed);
  }

  function normalizedExecutionWatchdogMaxResumeCount(value) {
    const parsed = Math.trunc(Number(value));
    if (!Number.isFinite(parsed)) return DEFAULT_EXECUTION_WATCHDOG_MAX_RESUME_COUNT;
    return Math.max(0, parsed);
  }

  function executionLeaseReferenceTimeMs(card) {
    const lease = card && card.executionLease && typeof card.executionLease === "object" ? card.executionLease : {};
    return timestampMs(
      stringValue(lease.lastHeartbeatAt)
      || stringValue(lease.lastProgressAt)
      || stringValue(lease.startedAt)
      || stringValue(card && card.updatedAt)
      || stringValue(card && card.createdAt)
      || "",
    );
  }

  function executionLeaseRecentWatchdogAttemptMs(card) {
    const lease = card && card.executionLease && typeof card.executionLease === "object" ? card.executionLease : {};
    return timestampMs(
      stringValue(lease.lastWatchdogAttemptAt)
      || stringValue(lease.watchdogResumeRequestedAt)
      || stringValue(lease.resumingAt)
      || "",
    );
  }

  function nextStaleExecutionLeaseCard(store, selection = {}) {
    const nowMs = Number.isFinite(Number(selection.nowMs)) ? Number(selection.nowMs) : Date.now();
    const staleAfterMs = normalizedExecutionWatchdogStaleMs(selection.staleAfterMs);
    const maxResumeCount = normalizedExecutionWatchdogMaxResumeCount(selection.maxResumeCount);
    const cardId = stringValue(selection.cardId);
    const targetThreadId = stringValue(selection.targetThreadId);
    const candidates = safeArray(store && store.cards)
      .filter((card) => {
        if (!cardCanOwnExecutionLease(card)) return false;
        if (cardId && stringValue(card.id) !== cardId) return false;
        if (targetThreadId && stringValue(card.target && card.target.threadId) !== targetThreadId) return false;
        if (stringValue(card.replyCardId) || stringValue(card.autoReplyCardId)) return false;
        const lease = card.executionLease && typeof card.executionLease === "object" ? card.executionLease : null;
        if (!lease || lease.resumeRequired !== true) return false;
        if (stringValue(lease.status) !== EXECUTION_LEASE_ACTIVE) return false;
        if (stringValue(lease.watchdogAutoResumePausedAt)) return false;
        if (maxResumeCount > 0 && Math.max(0, Math.trunc(Number(lease.resumeCount || 0)) || 0) >= maxResumeCount) return false;
        const attemptMs = executionLeaseRecentWatchdogAttemptMs(card);
        if (attemptMs && nowMs - attemptMs < staleAfterMs) return false;
        const referenceMs = executionLeaseReferenceTimeMs(card);
        if (!referenceMs) return false;
        if (nowMs - referenceMs < staleAfterMs) return false;
        return true;
      })
      .sort((left, right) => {
        const leftTime = executionLeaseReferenceTimeMs(left);
        const rightTime = executionLeaseReferenceTimeMs(right);
        return leftTime - rightTime || stringValue(left.id).localeCompare(stringValue(right.id));
      });
    return candidates[0] || null;
  }

  async function maybeResumeInterruptedTaskCard(completed = {}) {
    const turnId = stringValue(completed.turnId);
    const threadId = stringValue(completed.threadId);
    if (!turnId || !threadId) return null;
    const prepared = await withStore(async (store) => {
      const card = nextInterruptedExecutionCard(store, threadId, turnId);
      if (!card) return null;
      const timestamp = nowIso(options.now);
      card.executionLease = Object.assign({}, card.executionLease || {}, {
        status: EXECUTION_LEASE_RESUMING,
        resumeRequired: true,
        resumeForTurnId: turnId,
        lastInterruptedTurnId: turnId,
        lastProgressAt: timestamp,
        resumingAt: timestamp,
      });
      card.updatedAt = timestamp;
      return {
        card: clone(card),
        completed: {
          threadId,
          turnId,
          completedAt: stringValue(completed.completedAt),
        },
      };
    });
    if (!prepared) return null;

    let execution;
    try {
      execution = await executeApprovedCard(clone(prepared.card), {
        text: taskCardExecutionContinuationText(prepared.card, prepared.completed, returnThreadTaskCardScriptPath),
      });
    } catch (err) {
      await withStore(async (store) => {
        const card = findById(store, prepared.card.id);
        if (card && card.executionLease && stringValue(card.executionLease.resumeForTurnId) === turnId) {
          const timestamp = nowIso(options.now);
          card.executionLease = Object.assign({}, card.executionLease, {
            status: EXECUTION_LEASE_ACTIVE,
            resumeRequired: true,
            lastResumeFailedAt: timestamp,
            lastResumeError: boundedErrorMessage(err),
            resumeForTurnId: "",
          });
          card.updatedAt = timestamp;
        }
        return null;
      });
      throw err;
    }

    return withStore(async (store) => {
      const card = findById(store, prepared.card.id);
      if (!card) throw errorWithStatus("task_card_not_found", 404);
      const timestamp = nowIso(options.now);
      const nextTurnId = stringValue(execution && execution.turnId);
      const continuationTurnIds = safeArray(card.executionLease && card.executionLease.continuationTurnIds)
        .map(stringValue)
        .filter(Boolean);
      if (nextTurnId && !continuationTurnIds.includes(nextTurnId)) continuationTurnIds.push(nextTurnId);
      card.executionLease = Object.assign({}, card.executionLease || {}, {
        status: EXECUTION_LEASE_ACTIVE,
        resumeRequired: true,
        currentTurnId: nextTurnId || stringValue(card.executionLease && card.executionLease.currentTurnId),
        lastContinuationTurnId: nextTurnId || stringValue(card.executionLease && card.executionLease.lastContinuationTurnId),
        continuationTurnIds: continuationTurnIds.slice(-MAX_LEASE_TURN_IDS),
        resumeCount: Math.max(0, Math.trunc(Number(card.executionLease && card.executionLease.resumeCount || 0)) || 0) + 1,
        resumedAt: timestamp,
        lastProgressAt: timestamp,
        resumeForTurnId: "",
        lastResumeError: "",
      });
      card.updatedAt = timestamp;
      if (nextTurnId) card.lastContinuationTurnId = nextTurnId;
      if (execution && execution.result) card.lastContinuationResult = execution.result;
      return {
        card: publicCard(card, card.target && card.target.threadId || ""),
        execution,
      };
    });
  }

  async function heartbeatExecution(cardId, actorThreadId, payload = {}) {
    const id = stringValue(cardId);
    const actorThread = stringValue(actorThreadId || payload.threadId || payload.actorThreadId);
    if (!id) throw errorWithStatus("task_card_id_required");
    if (!actorThread) throw errorWithStatus("actor_thread_id_required");
    const result = await withStore(async (store) => {
      const card = findById(store, id);
      if (!card) throw errorWithStatus("task_card_not_found", 404);
      if (!cardCanOwnExecutionLease(card)) throw errorWithStatus(`task_card_execution_not_active:${card && card.status}`, 409);
      if (stringValue(card.target && card.target.threadId) !== actorThread) {
        throw errorWithStatus("task_card_execution_heartbeat_forbidden", 403);
      }
      const lease = card.executionLease && typeof card.executionLease === "object"
        ? card.executionLease
        : leaseForApprovedCard(card, {}, nowIso(options.now));
      const status = stringValue(lease.status);
      if (status !== EXECUTION_LEASE_ACTIVE && status !== EXECUTION_LEASE_RESUMING) {
        throw errorWithStatus(`task_card_execution_heartbeat_not_active:${status || "unknown"}`, 409);
      }
      const timestamp = nowIso(options.now);
      const heartbeatSource = boundedMetadataString(payload.source || payload.heartbeatSource || "target-thread", 80);
      const heartbeatStatus = boundedMetadataString(payload.status || payload.progressStatus || payload.state || "working", 80);
      const heartbeatTurnId = boundedMetadataString(
        payload.turnId || payload.turn_id || lease.currentTurnId || lease.lastContinuationTurnId || lease.injectedTurnId,
        120,
      );
      card.executionLease = Object.assign({}, lease, {
        lastHeartbeatAt: timestamp,
        lastHeartbeatSource: heartbeatSource || "target-thread",
        lastHeartbeatStatus: heartbeatStatus || "working",
        lastHeartbeatTurnId: heartbeatTurnId,
        heartbeatCount: Math.max(0, Math.trunc(Number(lease.heartbeatCount || 0)) || 0) + 1,
        lastProgressAt: timestamp,
        watchdogStaleAfterMs: Math.max(0, Math.trunc(Number(payload.watchdogStaleAfterMs || lease.watchdogStaleAfterMs || 0)) || 0),
      });
      card.updatedAt = timestamp;
      card.audit = Object.assign({}, card.audit || {}, {
        executionHeartbeatAt: timestamp,
        executionHeartbeatSource: heartbeatSource || "target-thread",
        executionHeartbeatStatus: heartbeatStatus || "working",
      });
      return {
        ok: true,
        card: publicCard(card, actorThread),
        heartbeat: {
          taskCardId: card.id,
          targetThreadId: actorThread,
          at: timestamp,
          source: heartbeatSource || "target-thread",
          status: heartbeatStatus || "working",
          turnId: heartbeatTurnId,
        },
      };
    });
    await notifyExecutionLifecycle(onExecutionHeartbeat, {
      phase: "heartbeat",
      taskCardId: result.heartbeat && result.heartbeat.taskCardId || id,
      targetThreadId: result.heartbeat && result.heartbeat.targetThreadId || actorThread,
      card: result.card,
      heartbeat: result.heartbeat,
    });
    return result;
  }

  async function resumeStaleExecutionLeases(resumeOptions = {}) {
    const limit = normalizedExecutionWatchdogLimit(resumeOptions.limit);
    const results = [];
    for (let index = 0; index < limit; index += 1) {
      const prepared = await withStore(async (store) => {
        const timestamp = nowIso(options.now);
        const nowMs = Date.parse(timestamp) || Date.now();
        const staleAfterMs = normalizedExecutionWatchdogStaleMs(resumeOptions.staleAfterMs);
        const card = nextStaleExecutionLeaseCard(store, {
          cardId: resumeOptions.cardId,
          targetThreadId: resumeOptions.targetThreadId,
          staleAfterMs,
          maxResumeCount: resumeOptions.maxResumeCount,
          nowMs,
        });
        if (!card) return null;
        const resumeMarker = boundedMetadataString(`watchdog:${card.id}:${nowMs}`, 120);
        card.executionLease = Object.assign({}, card.executionLease || {}, {
          status: EXECUTION_LEASE_RESUMING,
          resumeRequired: true,
          resumeForTurnId: resumeMarker,
          watchdogResumeRequestedAt: timestamp,
          lastWatchdogAttemptAt: timestamp,
          lastWatchdogResumeReason: "stale_heartbeat",
          watchdogStaleAfterMs: staleAfterMs,
          resumingAt: timestamp,
          lastResumeError: "",
        });
        card.audit = Object.assign({}, card.audit || {}, {
          executionWatchdogResumeRequestedAt: timestamp,
          executionWatchdogReason: "stale_resume_required",
        });
        card.updatedAt = timestamp;
        return {
          card: clone(card),
          resumeMarker,
        };
      });
      if (!prepared) break;

      let execution = null;
      try {
        execution = await executeApprovedCard(clone(prepared.card), {
          text: taskCardExecutionWatchdogText(prepared.card, returnThreadTaskCardScriptPath),
        });
      } catch (err) {
        const blocked = await withStore(async (store) => {
          const card = findById(store, prepared.card.id);
          if (!card || !card.executionLease || stringValue(card.executionLease.resumeForTurnId) !== prepared.resumeMarker) {
            return null;
          }
          const timestamp = nowIso(options.now);
          card.executionLease = Object.assign({}, card.executionLease, {
            status: EXECUTION_LEASE_BLOCKED,
            resumeRequired: false,
            blockedAt: timestamp,
            blockedReason: "task_card_execution_watchdog_resume_failed",
            lastResumeFailedAt: timestamp,
            lastResumeError: boundedErrorMessage(err),
            resumeForTurnId: "",
            watchdogStaleAfterMs: normalizedExecutionWatchdogStaleMs(resumeOptions.staleAfterMs),
          });
          card.audit = Object.assign({}, card.audit || {}, {
            executionWatchdogBlockedAt: timestamp,
            executionWatchdogBlockedReason: "task_card_execution_watchdog_resume_failed",
            executionWatchdogError: boundedErrorMessage(err),
          });
          card.updatedAt = timestamp;
          return publicCard(card, card.target && card.target.threadId || "");
        });
        results.push({
          cardId: prepared.card.id,
          targetThreadId: prepared.card.target && prepared.card.target.threadId || "",
          status: "blocked",
          error: boundedErrorMessage(err),
          card: blocked,
        });
        continue;
      }

      const resumed = await withStore(async (store) => {
        const card = findById(store, prepared.card.id);
        if (!card || !card.executionLease || stringValue(card.executionLease.resumeForTurnId) !== prepared.resumeMarker) {
          return null;
        }
        const timestamp = nowIso(options.now);
        const nextTurnId = stringValue(execution && execution.turnId);
        const continuationTurnIds = safeArray(card.executionLease && card.executionLease.continuationTurnIds)
          .map(stringValue)
          .filter(Boolean);
        if (nextTurnId && !continuationTurnIds.includes(nextTurnId)) continuationTurnIds.push(nextTurnId);
        card.executionLease = Object.assign({}, card.executionLease || {}, {
          status: EXECUTION_LEASE_ACTIVE,
          resumeRequired: true,
          currentTurnId: nextTurnId || stringValue(card.executionLease && card.executionLease.currentTurnId),
          lastContinuationTurnId: nextTurnId || stringValue(card.executionLease && card.executionLease.lastContinuationTurnId),
          continuationTurnIds: continuationTurnIds.slice(-MAX_LEASE_TURN_IDS),
          resumeCount: Math.max(0, Math.trunc(Number(card.executionLease && card.executionLease.resumeCount || 0)) || 0) + 1,
          resumedAt: timestamp,
          watchdogStaleAfterMs: normalizedExecutionWatchdogStaleMs(resumeOptions.staleAfterMs),
          watchdogAutoResumePausedAt: timestamp,
          watchdogAutoResumePausedReason: "watchdog_resume_attempted",
          resumeForTurnId: "",
          lastResumeError: "",
        });
        card.audit = Object.assign({}, card.audit || {}, {
          executionWatchdogResumedAt: timestamp,
          executionWatchdogLastTurnId: nextTurnId,
          executionWatchdogAutoResumePausedAt: timestamp,
          executionWatchdogAutoResumePausedReason: "watchdog_resume_attempted",
        });
        card.updatedAt = timestamp;
        if (nextTurnId) card.lastContinuationTurnId = nextTurnId;
        if (execution && execution.result) card.lastContinuationResult = execution.result;
        return publicCard(card, card.target && card.target.threadId || "");
      });
      results.push({
        cardId: prepared.card.id,
        targetThreadId: prepared.card.target && prepared.card.target.threadId || "",
        status: resumed ? "resumed" : "skipped",
        card: resumed,
        execution: {
          threadId: boundedMetadataString(execution && execution.threadId, 120),
          turnId: boundedMetadataString(execution && execution.turnId, 120),
        },
      });
    }
    return {
      ok: true,
      inspected: results.length,
      resumed: results.filter((result) => result.status === "resumed").length,
      blocked: results.filter((result) => result.status === "blocked").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      results,
    };
  }

  async function pauseExecution(cardId, actorThreadId) {
    const id = stringValue(cardId);
    const actorThread = stringValue(actorThreadId);
    return withStore(async (store) => {
      const card = findById(store, id);
      if (!card) throw errorWithStatus("task_card_not_found", 404);
      if (!cardCanOwnExecutionLease(card)) throw errorWithStatus(`task_card_execution_not_active:${card && card.status}`, 409);
      if (stringValue(card.target && card.target.threadId) !== actorThread && stringValue(card.source && card.source.threadId) !== actorThread) {
        throw errorWithStatus("task_card_execution_action_forbidden", 403);
      }
      const timestamp = nowIso(options.now);
      card.executionLease = Object.assign({}, card.executionLease || leaseForApprovedCard(card, {}, timestamp), {
        status: EXECUTION_LEASE_PAUSED,
        resumeRequired: false,
        pausedAt: timestamp,
        pausedByThreadId: actorThread,
        lastProgressAt: timestamp,
        resumeForTurnId: "",
      });
      card.updatedAt = timestamp;
      card.audit = Object.assign({}, card.audit || {}, {
        executionPausedAt: timestamp,
        executionPausedByThreadId: actorThread,
      });
      return publicCard(card, actorThread);
    });
  }

  async function cancelExecution(cardId, actorThreadId) {
    const id = stringValue(cardId);
    const actorThread = stringValue(actorThreadId);
    return withStore(async (store) => {
      const card = findById(store, id);
      if (!card) throw errorWithStatus("task_card_not_found", 404);
      if (!cardCanOwnExecutionLease(card)) throw errorWithStatus(`task_card_execution_not_active:${card && card.status}`, 409);
      if (stringValue(card.target && card.target.threadId) !== actorThread && stringValue(card.source && card.source.threadId) !== actorThread) {
        throw errorWithStatus("task_card_execution_action_forbidden", 403);
      }
      const timestamp = nowIso(options.now);
      card.executionLease = Object.assign({}, card.executionLease || leaseForApprovedCard(card, {}, timestamp), {
        status: EXECUTION_LEASE_CANCELLED,
        resumeRequired: false,
        cancelledAt: timestamp,
        cancelledByThreadId: actorThread,
        lastProgressAt: timestamp,
        resumeForTurnId: "",
      });
      card.updatedAt = timestamp;
      card.audit = Object.assign({}, card.audit || {}, {
        executionCancelledAt: timestamp,
        executionCancelledByThreadId: actorThread,
      });
      return publicCard(card, actorThread);
    });
  }

  async function maybeAutoReplyCompletedTurn(completed = {}) {
    const turnId = stringValue(completed.turnId);
    const threadId = stringValue(completed.threadId);
    if (!turnId || !threadId) return null;
    const prepared = await withStore(async (store) => {
      const card = safeArray(store.cards).find((entry) => entry
        && entry.status === "approved"
        && isAutonomousWorkflow(entry.workflow)
        && !cardIsTerminal(entry)
        && cardRequiresReturn(entry)
        && entry.delivery
        && entry.delivery.autoReturnOnCompletion === true
        && !(entry.audit && stringValue(entry.audit.autoReturnToCardId))
        && stringValue(entry.injectedTurnId) === turnId
        && (stringValue(entry.injectedThreadId || (entry.target && entry.target.threadId)) === threadId)
        && !stringValue(entry.autoReplyCardId)) || null;
      if (!card) return null;
      const workflow = activeWorkflowForCard(store, card);
      if (!workflow) return null;
      const timestamp = nowIso(options.now);
      const idempotencyKey = boundedString(`auto-return:${card.id}:${turnId}`, "idempotency_key", 220);
      const returnTarget = returnTargetRefForCard(card);
      let replyCard = findByIdempotency(store, idempotencyKey);
      if (!replyCard) {
        replyCard = {
          id: idGenerator(),
          status: "pending",
          idempotencyKey,
          createdAt: timestamp,
          updatedAt: timestamp,
          source: {
            workspaceId: card.target && card.target.workspaceId || "",
            threadId: card.target && card.target.threadId || "",
            turnId,
            title: card.target && card.target.threadId || "",
          },
          target: {
            workspaceId: returnTarget.workspaceId || "",
            threadId: returnTarget.threadId || "",
          },
          message: {
            format: "markdown",
            title: autoReturnTitleForCard(card),
            summary: boundedVisibleText(completed.summary || "Target thread completed and returned the result automatically.", MAX_SUMMARY_CHARS),
            body: autoReplyBodyForCompletedTurn(card, completed),
          },
          delivery: {
            injectOnApprove: true,
            reasoningEffort: card.delivery && card.delivery.reasoningEffort || "",
            autoRunAfterFirstApproval: true,
            autoReturnOnCompletion: false,
            returnToSource: true,
            returnStatus: "completed",
            ...terminalReturnDeliveryFields("completed"),
          },
          workflow: {
            mode: WORKFLOW_MODE_AUTONOMOUS,
            id: card.workflow.id,
            authorized: false,
          },
          audit: {
            createdAt: timestamp,
            autoReturnToCardId: card.id,
            autoReturnForTurnId: turnId,
            originalSourceThreadId: card.source && card.source.threadId || "",
            returnTargetThreadId: returnTarget.threadId || "",
            returnTargetWorkspaceId: returnTarget.workspaceId || "",
            returnRoutedByReplyTo: returnTargetUsesReplyTo(card),
            returnToSource: true,
            returnStatus: "completed",
            requiresReturn: false,
            terminal: true,
            ackPolicy: "none",
          },
        };
        store.cards.push(replyCard);
      }
      card.autoReplyCardId = replyCard.id;
      card.updatedAt = timestamp;
      card.audit = Object.assign({}, card.audit || {}, {
        autoReturnCreatedAt: timestamp,
        autoReturnCardId: replyCard.id,
        autoReturnForTurnId: turnId,
      });
      return publicCard(replyCard, replyCard.target.threadId);
    });
    if (!prepared) return null;
    const routedByReplyTo = prepared && prepared.audit && prepared.audit.returnRoutedByReplyTo === true;
    const approved = routedByReplyTo
      ? await executeCardApproval(prepared.id, prepared.source && prepared.source.threadId || "", {
        sourceDirect: true,
        publicThreadId: prepared && prepared.target && prepared.target.threadId || "",
      })
      : null;
    const replyCard = routedByReplyTo
      ? approved && approved.card || prepared
      : await maybeAutoApprovePublicCard(prepared, prepared && prepared.target && prepared.target.threadId);
    await notifyTerminalReturnCard(prepared.audit && prepared.audit.autoReturnToCardId, replyCard && replyCard.id || prepared.id);
    return replyCard ? { card: replyCard } : null;
  }

  function pendingCountForThread(threadId) {
    const store = readStore();
    return countsForThreadFromStore(store, threadId).pendingTotal;
  }

  function pendingCountsForThread(threadId) {
    const store = readStore();
    return countsForThreadFromStore(store, threadId);
  }

  function pendingCountsForThreads(threadIds = []) {
    const ids = [...new Set(safeArray(threadIds).map(stringValue).filter(Boolean))];
    const counts = new Map();
    if (!ids.length) return counts;
    const store = readStore();
    for (const id of ids) counts.set(id, countsForThreadFromStore(store, id));
    return counts;
  }

  return {
    approve,
    approveFromSource,
    cancelExecution,
    create,
    createMany,
    deleteCard,
    get,
    heartbeatExecution,
    injectedMessageText,
    listForThread,
    maybeAutoReplyCompletedTurn,
    maybeResumeInterruptedTaskCard,
    pendingCountForThread,
    pendingCountsForThread,
    pendingCountsForThreads,
    pauseExecution,
    reply,
    resumeStaleExecutionLeases,
    revoke,
    summaryForThread,
  };
}

module.exports = {
  createThreadTaskCardService,
  injectedMessageText,
  hasLikelyEncodingDamage,
  normalizeCreateRequests,
  normalizeCreateRequest,
  normalizeReplyRequest,
  publicCard,
  SETTLED_STATUSES,
};
