"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const MAX_THREAD_ID_CHARS = 220;
const MAX_SCOPE_ID_CHARS = 160;
const MAX_DRAFT_CHARS = 8_000;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_CANDIDATE_TITLE_CHARS = 120;
const MAX_CANDIDATE_BODY_CHARS = 8_000;
const MAX_MESSAGES = 100;
const MAX_TRANSCRIPT_CHARS = 128_000;
const MAX_IDEMPOTENCY_KEY_CHARS = 240;
const QUEUE_MODES = new Set(["confirmWhenIdle", "autoSendWhenIdle"]);

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

function boundedOptionalText(value, maxLength) {
  const text = String(value || "").replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
  if (!text || text.length <= maxLength) return text;
  const suffix = "\n\n...(truncated)";
  return `${text.slice(0, Math.max(0, maxLength - suffix.length)).trimEnd()}${suffix}`;
}

function normalizeThreadId(value) {
  return boundedString(value, "thread_id", MAX_THREAD_ID_CHARS);
}

function normalizeScopeId(value) {
  return boundedString(value || "default", "scope_id", MAX_SCOPE_ID_CHARS);
}

function normalizeRole(value) {
  const role = stringValue(value || "user").toLowerCase();
  if (["user", "assistant", "system"].includes(role)) return role;
  throw errorWithStatus("side_chat_role_invalid");
}

function normalizeQueueMode(value) {
  const mode = stringValue(value || "confirmWhenIdle");
  if (QUEUE_MODES.has(mode)) return mode;
  throw errorWithStatus("side_chat_queue_mode_invalid");
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultStore() {
  return { version: 1, sideChats: [] };
}

function readJsonFile(filePath, fallback) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, filePath);
}

function normalizeStore(raw) {
  const candidates = raw && typeof raw === "object" ? safeArray(raw.sideChats) : [];
  return {
    version: 1,
    sideChats: candidates.filter((entry) => entry && typeof entry === "object"),
  };
}

function loadStore(filePath) {
  return normalizeStore(readJsonFile(filePath, defaultStore()));
}

function saveStore(filePath, store) {
  writeJsonFile(filePath, normalizeStore(store));
}

function stateKey(scopeId, threadId) {
  return `${scopeId}:${threadId}`;
}

function baseState(scopeId, threadId, timestamp) {
  return {
    key: stateKey(scopeId, threadId),
    scopeId,
    threadId,
    version: 0,
    messages: [],
    draft: { text: "", updatedAt: "" },
    candidates: [],
    queue: null,
    audit: {
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

function publicMessage(message) {
  return {
    id: stringValue(message && message.id),
    role: normalizeRole(message && message.role),
    text: boundedOptionalText(message && message.text, MAX_MESSAGE_CHARS),
    createdAt: stringValue(message && message.createdAt),
    idempotencyKey: stringValue(message && message.idempotencyKey),
  };
}

function publicCandidate(candidate) {
  return {
    id: stringValue(candidate && candidate.id),
    title: boundedOptionalText(candidate && candidate.title, MAX_CANDIDATE_TITLE_CHARS),
    body: boundedOptionalText(candidate && candidate.body, MAX_CANDIDATE_BODY_CHARS),
    status: normalizeCandidateStatus(candidate && candidate.status),
    createdFromMessageId: stringValue(candidate && candidate.createdFromMessageId),
    idempotencyKey: stringValue(candidate && candidate.idempotencyKey),
    createdAt: stringValue(candidate && candidate.createdAt),
    updatedAt: stringValue(candidate && candidate.updatedAt),
    queuedAt: stringValue(candidate && candidate.queuedAt),
    appliedAt: stringValue(candidate && candidate.appliedAt),
    appliedTurnId: stringValue(candidate && candidate.appliedTurnId),
    cancelledAt: stringValue(candidate && candidate.cancelledAt),
  };
}

function publicQueue(queue) {
  if (!queue || typeof queue !== "object") return null;
  return {
    candidateId: stringValue(queue.candidateId),
    mode: normalizeQueueMode(queue.mode),
    status: normalizeQueueStatus(queue.status),
    idempotencyKey: stringValue(queue.idempotencyKey),
    queuedAt: stringValue(queue.queuedAt),
    updatedAt: stringValue(queue.updatedAt),
    error: boundedOptionalText(queue.error, 500),
  };
}

function normalizeCandidateStatus(value) {
  const status = stringValue(value || "draft").toLowerCase();
  if (["draft", "queued", "applied", "cancelled"].includes(status)) return status;
  return "draft";
}

function normalizeQueueStatus(value) {
  const status = stringValue(value || "queued").toLowerCase();
  if (["queued", "sending", "sent", "cancelled", "failed"].includes(status)) return status;
  return "queued";
}

function publicState(state) {
  const normalized = normalizeState(state);
  return {
    threadId: normalized.threadId,
    version: normalized.version,
    messages: normalized.messages.map(publicMessage),
    draft: {
      text: boundedOptionalText(normalized.draft && normalized.draft.text, MAX_DRAFT_CHARS),
      updatedAt: stringValue(normalized.draft && normalized.draft.updatedAt),
    },
    candidates: normalized.candidates.map(publicCandidate),
    queue: publicQueue(normalized.queue),
    audit: {
      createdAt: stringValue(normalized.audit && normalized.audit.createdAt),
      updatedAt: stringValue(normalized.audit && normalized.audit.updatedAt),
    },
    persistence: "server",
  };
}

function normalizeState(state) {
  const timestamp = new Date(0).toISOString();
  const threadId = normalizeThreadId(state && state.threadId);
  const scopeId = normalizeScopeId(state && state.scopeId);
  return {
    key: stateKey(scopeId, threadId),
    scopeId,
    threadId,
    version: Math.max(0, Number(state && state.version) || 0),
    messages: safeArray(state && state.messages)
      .filter((message) => message && typeof message === "object")
      .map(publicMessage)
      .filter((message) => message.id && message.text),
    draft: {
      text: boundedOptionalText(state && state.draft && state.draft.text, MAX_DRAFT_CHARS),
      updatedAt: stringValue(state && state.draft && state.draft.updatedAt),
    },
    candidates: safeArray(state && state.candidates)
      .filter((candidate) => candidate && typeof candidate === "object")
      .map(publicCandidate)
      .filter((candidate) => candidate.id && candidate.body),
    queue: publicQueue(state && state.queue),
    audit: {
      createdAt: stringValue(state && state.audit && state.audit.createdAt) || timestamp,
      updatedAt: stringValue(state && state.audit && state.audit.updatedAt) || timestamp,
    },
  };
}

function trimMessages(messages) {
  const kept = safeArray(messages).slice(-MAX_MESSAGES);
  let total = 0;
  const result = [];
  for (let index = kept.length - 1; index >= 0; index -= 1) {
    const message = kept[index];
    total += String(message && message.text || "").length;
    if (total > MAX_TRANSCRIPT_CHARS) break;
    result.unshift(message);
  }
  return result;
}

function normalizeIdempotencyKey(value) {
  return boundedString(value, "idempotency_key", MAX_IDEMPOTENCY_KEY_CHARS, false);
}

function defaultCandidateTitle(body) {
  const first = String(body || "").split(/\n/).map((line) => line.trim()).find(Boolean) || "Side chat candidate";
  return boundedOptionalText(first, MAX_CANDIDATE_TITLE_CHARS) || "Side chat candidate";
}

function publicExecutionResult(value) {
  if (!value || typeof value !== "object") return null;
  return {
    threadId: stringValue(value.threadId),
    turnId: stringValue(value.turnId),
  };
}

function createThreadSideChatService(options = {}) {
  const storageFile = boundedString(options.storageFile, "storage_file", 1024);
  const scopeId = normalizeScopeId(options.scopeId || "default");
  const idGenerator = typeof options.idGenerator === "function"
    ? options.idGenerator
    : (prefix) => `${prefix}_${crypto.randomBytes(9).toString("hex")}`;
  const executeCandidate = typeof options.executeCandidate === "function"
    ? options.executeCandidate
    : null;
  let writeQueue = Promise.resolve();

  async function withStore(mutator) {
    let release;
    const next = new Promise((resolve) => { release = resolve; });
    const previous = writeQueue;
    writeQueue = previous.finally(() => next);
    await previous;
    try {
      const store = loadStore(storageFile);
      const result = await mutator(store);
      saveStore(storageFile, store);
      return result;
    } finally {
      release();
    }
  }

  function findState(store, threadId, create = false) {
    const id = normalizeThreadId(threadId);
    const key = stateKey(scopeId, id);
    const index = safeArray(store.sideChats).findIndex((entry) => entry && entry.key === key);
    if (index >= 0) {
      const normalized = normalizeState(store.sideChats[index]);
      store.sideChats[index] = normalized;
      return normalized;
    }
    if (!create) return baseState(scopeId, id, "");
    const timestamp = nowIso(options.now);
    const state = baseState(scopeId, id, timestamp);
    store.sideChats.push(state);
    return state;
  }

  function touch(state) {
    const timestamp = nowIso(options.now);
    state.version = Math.max(0, Number(state.version) || 0) + 1;
    state.audit = Object.assign({}, state.audit || {}, {
      createdAt: state.audit && state.audit.createdAt || timestamp,
      updatedAt: timestamp,
    });
    return timestamp;
  }

  function get(threadId) {
    const store = loadStore(storageFile);
    return publicState(findState(store, threadId, false));
  }

  async function updateDraft(threadId, input = {}) {
    const text = boundedOptionalText(input.text, MAX_DRAFT_CHARS);
    return withStore(async (store) => {
      const state = findState(store, threadId, true);
      const timestamp = touch(state);
      state.draft = { text, updatedAt: timestamp };
      return publicState(state);
    });
  }

  async function addMessage(threadId, input = {}) {
    const role = normalizeRole(input.role);
    const text = boundedOptionalText(input.text || input.body || input.message, MAX_MESSAGE_CHARS);
    if (!text) throw errorWithStatus("side_chat_message_text_required");
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
    return withStore(async (store) => {
      const state = findState(store, threadId, true);
      if (idempotencyKey) {
        const existing = state.messages.find((message) => message.idempotencyKey === idempotencyKey);
        if (existing) return { state: publicState(state), message: publicMessage(existing) };
      }
      const timestamp = touch(state);
      const message = {
        id: stringValue(input.id) || idGenerator("scm"),
        role,
        text,
        idempotencyKey,
        createdAt: timestamp,
      };
      state.messages.push(message);
      state.messages = trimMessages(state.messages);
      state.draft = { text: "", updatedAt: timestamp };
      return { state: publicState(state), message: publicMessage(message) };
    });
  }

  async function createCandidate(threadId, input = {}) {
    const body = boundedOptionalText(input.body || input.text, MAX_CANDIDATE_BODY_CHARS);
    if (!body) throw errorWithStatus("side_chat_candidate_body_required");
    const title = boundedOptionalText(input.title, MAX_CANDIDATE_TITLE_CHARS) || defaultCandidateTitle(body);
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
    const createdFromMessageId = boundedString(input.createdFromMessageId, "created_from_message_id", 220, false);
    return withStore(async (store) => {
      const state = findState(store, threadId, true);
      if (idempotencyKey) {
        const existing = state.candidates.find((candidate) => candidate.idempotencyKey === idempotencyKey);
        if (existing) return { state: publicState(state), candidate: publicCandidate(existing) };
      }
      const timestamp = touch(state);
      const candidate = {
        id: stringValue(input.id) || idGenerator("scc"),
        title,
        body,
        status: "draft",
        createdFromMessageId,
        idempotencyKey,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      state.candidates.push(candidate);
      return { state: publicState(state), candidate: publicCandidate(candidate) };
    });
  }

  async function queueCandidate(threadId, candidateId, input = {}) {
    const id = boundedString(candidateId, "candidate_id", 220);
    const mode = normalizeQueueMode(input.mode);
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey)
      || `sidechat:${normalizeThreadId(threadId)}:${id}`;
    return withStore(async (store) => {
      const state = findState(store, threadId, true);
      const candidate = state.candidates.find((entry) => entry.id === id);
      if (!candidate) throw errorWithStatus("side_chat_candidate_not_found", 404);
      if (state.queue && state.queue.candidateId === id && normalizeQueueStatus(state.queue.status) === "sending") {
        throw errorWithStatus("side_chat_candidate_sending", 409);
      }
      if (candidate.status === "applied") throw errorWithStatus("side_chat_candidate_already_applied");
      if (candidate.status === "cancelled") throw errorWithStatus("side_chat_candidate_cancelled");
      if (state.queue && state.queue.idempotencyKey === idempotencyKey) {
        return { state: publicState(state), candidate: publicCandidate(candidate), queue: publicQueue(state.queue) };
      }
      const timestamp = touch(state);
      candidate.status = "queued";
      candidate.queuedAt = candidate.queuedAt || timestamp;
      candidate.updatedAt = timestamp;
      state.queue = {
        candidateId: id,
        mode,
        status: "queued",
        idempotencyKey,
        queuedAt: timestamp,
        updatedAt: timestamp,
      };
      return { state: publicState(state), candidate: publicCandidate(candidate), queue: publicQueue(state.queue) };
    });
  }

  async function cancelCandidate(threadId, candidateId) {
    const id = boundedString(candidateId, "candidate_id", 220);
    return withStore(async (store) => {
      const state = findState(store, threadId, true);
      const candidate = state.candidates.find((entry) => entry.id === id);
      if (!candidate) throw errorWithStatus("side_chat_candidate_not_found", 404);
      if (candidate.status === "applied") throw errorWithStatus("side_chat_candidate_already_applied");
      if (state.queue && state.queue.candidateId === id && normalizeQueueStatus(state.queue.status) === "sending") {
        throw errorWithStatus("side_chat_candidate_sending", 409);
      }
      const timestamp = touch(state);
      candidate.status = "cancelled";
      candidate.cancelledAt = candidate.cancelledAt || timestamp;
      candidate.updatedAt = timestamp;
      if (state.queue && state.queue.candidateId === id) {
        state.queue.status = "cancelled";
        state.queue.updatedAt = timestamp;
      }
      return { state: publicState(state), candidate: publicCandidate(candidate), queue: publicQueue(state.queue) };
    });
  }

  async function markCandidateSending(threadId, candidateId, input = {}) {
    const normalizedThreadId = normalizeThreadId(threadId);
    const id = boundedString(candidateId, "candidate_id", 220);
    return withStore(async (store) => {
      const state = findState(store, normalizedThreadId, true);
      const candidate = state.candidates.find((entry) => entry.id === id);
      if (!candidate) throw errorWithStatus("side_chat_candidate_not_found", 404);
      if (candidate.status === "applied") {
        return {
          skip: true,
          state: publicState(state),
          candidate: publicCandidate(candidate),
          queue: publicQueue(state.queue),
          execution: publicExecutionResult({ threadId: normalizedThreadId, turnId: candidate.appliedTurnId }),
        };
      }
      if (candidate.status === "cancelled") throw errorWithStatus("side_chat_candidate_cancelled");
      if (state.queue && state.queue.candidateId === id && normalizeQueueStatus(state.queue.status) === "sending") {
        return {
          skip: true,
          state: publicState(state),
          candidate: publicCandidate(candidate),
          queue: publicQueue(state.queue),
          execution: null,
        };
      }
      const mode = normalizeQueueMode(input.mode || state.queue && state.queue.candidateId === id && state.queue.mode || "confirmWhenIdle");
      const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey)
        || (state.queue && state.queue.candidateId === id && stringValue(state.queue.idempotencyKey))
        || `sidechat:${normalizedThreadId}:${id}:apply`;
      const timestamp = touch(state);
      candidate.status = "queued";
      candidate.queuedAt = candidate.queuedAt || timestamp;
      candidate.updatedAt = timestamp;
      state.queue = {
        candidateId: id,
        mode,
        status: "sending",
        idempotencyKey,
        queuedAt: state.queue && state.queue.candidateId === id && state.queue.queuedAt || timestamp,
        updatedAt: timestamp,
        error: "",
      };
      return {
        skip: false,
        candidateBody: candidate.body,
        state: publicState(state),
        candidate: publicCandidate(candidate),
        queue: publicQueue(state.queue),
      };
    });
  }

  async function markCandidateApplied(threadId, candidateId, execution) {
    const normalizedThreadId = normalizeThreadId(threadId);
    const id = boundedString(candidateId, "candidate_id", 220);
    const publicExecution = publicExecutionResult(Object.assign({ threadId: normalizedThreadId }, execution || {}));
    return withStore(async (store) => {
      const state = findState(store, normalizedThreadId, true);
      const candidate = state.candidates.find((entry) => entry.id === id);
      if (!candidate) throw errorWithStatus("side_chat_candidate_not_found", 404);
      const timestamp = touch(state);
      candidate.status = "applied";
      candidate.appliedAt = candidate.appliedAt || timestamp;
      candidate.appliedTurnId = publicExecution && publicExecution.turnId || candidate.appliedTurnId || "";
      candidate.updatedAt = timestamp;
      state.queue = {
        candidateId: id,
        mode: state.queue && state.queue.candidateId === id ? state.queue.mode : "confirmWhenIdle",
        status: "sent",
        idempotencyKey: state.queue && state.queue.candidateId === id ? state.queue.idempotencyKey : "",
        queuedAt: state.queue && state.queue.candidateId === id ? state.queue.queuedAt : "",
        updatedAt: timestamp,
        error: "",
      };
      return {
        state: publicState(state),
        candidate: publicCandidate(candidate),
        queue: publicQueue(state.queue),
        execution: publicExecution,
      };
    });
  }

  async function markCandidateFailed(threadId, candidateId, err) {
    const normalizedThreadId = normalizeThreadId(threadId);
    const id = boundedString(candidateId, "candidate_id", 220);
    const message = boundedOptionalText(err && err.message || String(err || "side_chat_candidate_apply_failed"), 500)
      || "side_chat_candidate_apply_failed";
    return withStore(async (store) => {
      const state = findState(store, normalizedThreadId, true);
      const candidate = state.candidates.find((entry) => entry.id === id);
      if (!candidate) throw errorWithStatus("side_chat_candidate_not_found", 404);
      const timestamp = touch(state);
      candidate.status = "draft";
      candidate.updatedAt = timestamp;
      state.queue = {
        candidateId: id,
        mode: state.queue && state.queue.candidateId === id ? state.queue.mode : "confirmWhenIdle",
        status: "failed",
        idempotencyKey: state.queue && state.queue.candidateId === id ? state.queue.idempotencyKey : "",
        queuedAt: state.queue && state.queue.candidateId === id ? state.queue.queuedAt : "",
        updatedAt: timestamp,
        error: message,
      };
      return { state: publicState(state), candidate: publicCandidate(candidate), queue: publicQueue(state.queue) };
    });
  }

  async function applyCandidate(threadId, candidateId, input = {}) {
    if (!executeCandidate) throw errorWithStatus("side_chat_apply_unavailable", 501);
    const sending = await markCandidateSending(threadId, candidateId, input);
    if (sending.skip) return {
      state: sending.state,
      candidate: sending.candidate,
      queue: sending.queue,
      execution: sending.execution,
    };
    try {
      const execution = await executeCandidate({
        threadId: normalizeThreadId(threadId),
        candidateId: boundedString(candidateId, "candidate_id", 220),
        body: sending.candidateBody,
        idempotencyKey: sending.queue && sending.queue.idempotencyKey || "",
      });
      return markCandidateApplied(threadId, candidateId, execution);
    } catch (err) {
      await markCandidateFailed(threadId, candidateId, err);
      throw err;
    }
  }

  async function maybeApplyQueuedCandidate(threadId) {
    const state = get(threadId);
    if (!state.queue
      || state.queue.status !== "queued"
      || state.queue.mode !== "autoSendWhenIdle"
      || !state.queue.candidateId) {
      return { skipped: true, reason: "no_auto_send_queue", state };
    }
    return Object.assign({ skipped: false }, await applyCandidate(threadId, state.queue.candidateId, {
      mode: state.queue.mode,
      idempotencyKey: state.queue.idempotencyKey,
    }));
  }

  async function clear(threadId) {
    return withStore(async (store) => {
      const state = findState(store, threadId, true);
      const timestamp = touch(state);
      state.messages = [];
      state.draft = { text: "", updatedAt: timestamp };
      state.candidates = [];
      state.queue = null;
      return publicState(state);
    });
  }

  return {
    get,
    updateDraft,
    addMessage,
    createCandidate,
    queueCandidate,
    cancelCandidate,
    applyCandidate,
    maybeApplyQueuedCandidate,
    clear,
  };
}

module.exports = {
  createThreadSideChatService,
  normalizeQueueMode,
};
