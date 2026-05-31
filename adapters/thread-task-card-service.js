"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const MAX_TITLE_CHARS = 120;
const MAX_SUMMARY_CHARS = 300;
const MAX_BODY_CHARS = 8_000;
const DEFAULT_RECENT_LIMIT = 24;
const MAX_BATCH_TARGETS = 12;
const SETTLED_STATUSES = new Set(["approved", "deleted", "revoked", "replied"]);

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

function boundedErrorMessage(value) {
  const text = stringValue(value && value.message ? value.message : value);
  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine ? boundedMetadataString(singleLine, 500) : "approval_execution_failed";
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

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultStore() {
  return { cards: [] };
}

function loadStore(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.cards)) return defaultStore();
    return { cards: parsed.cards };
  } catch (_) {
    return defaultStore();
  }
}

function saveStore(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tempFile = `${file}.tmp`;
  fs.writeFileSync(tempFile, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tempFile, file);
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

function publicCard(card, threadId) {
  const role = cardForThread(card, threadId) || "";
  const out = clone(card);
  out.threadRole = role;
  out.canApprove = role === "target" && out.status === "pending";
  out.canDelete = role === "target" && out.status === "pending";
  out.canReply = role === "target" && out.status === "pending";
  out.canRevoke = role === "source" && out.status === "pending";
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
    targetWorkspaceId: boundedString(input.targetWorkspaceId, "target_workspace_id", 260),
    targetThreadId: boundedString(input.targetThreadId, "target_thread_id", 220),
    idempotencyKey: boundedString(input.idempotencyKey, "idempotency_key", 220),
    format: normalizedFormat(input.format),
    title: readableCardText(input.title, "title", MAX_TITLE_CHARS),
    summary: readableCardText(input.summary, "summary", MAX_SUMMARY_CHARS),
    body: readableCardText(input.body, "body", MAX_BODY_CHARS),
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
  return {
    sourceWorkspaceId: boundedString(input.sourceWorkspaceId, "source_workspace_id", 260, false),
    sourceThreadId: boundedString(input.sourceThreadId, "source_thread_id", 220, false),
    sourceThreadTitle: boundedMetadataString(input.sourceThreadTitle, 200),
    idempotencyKey: boundedString(input.idempotencyKey, "idempotency_key", 220),
    format: normalizedFormat(input.format || "markdown"),
    title: readableCardText(input.title, "title", MAX_TITLE_CHARS),
    summary: readableCardText(input.summary, "summary", MAX_SUMMARY_CHARS),
    body: readableCardText(input.body, "body", MAX_BODY_CHARS),
  };
}

function injectedMessageText(card) {
  const lines = [
    "[Cross-thread task card approved]",
    "",
    `Source workspace: ${card.source.workspaceId}`,
    `Source thread: ${card.source.title || card.source.threadId}`,
    card.message && card.message.title ? `Title: ${card.message.title}` : "",
    "",
    stringValue(card.message && card.message.body),
  ].filter((line, index, all) => line !== "" || (index > 0 && all[index - 1] !== ""));
  return lines.join("\n");
}

function transitionAllowed(card, action, actorThreadId) {
  const actorThread = stringValue(actorThreadId);
  if (!actorThread) throw errorWithStatus("actor_thread_id_required");
  if (!card) throw errorWithStatus("task_card_not_found", 404);
  if (card.status !== "pending") throw errorWithStatus(`task_card_not_pending:${card.status}`, 409);
  if (action === "approve" || action === "delete" || action === "reply") {
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

function createThreadTaskCardService(options = {}) {
  const storageFile = boundedString(options.storageFile, "storage_file", 1024);
  const recentLimit = Math.max(1, Number(options.recentLimit || DEFAULT_RECENT_LIMIT));
  const executeApprovedCard = typeof options.executeApprovedCard === "function"
    ? options.executeApprovedCard
    : async () => ({});
  const idGenerator = typeof options.idGenerator === "function"
    ? options.idGenerator
    : () => `ttc_${crypto.randomBytes(9).toString("hex")}`;
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

  function findByIdempotency(store, key) {
    return safeArray(store.cards).find((card) => stringValue(card.idempotencyKey) === stringValue(key)) || null;
  }

  function findById(store, id) {
    return safeArray(store.cards).find((entry) => stringValue(entry.id) === stringValue(id)) || null;
  }

  function createCardFromRequest(request, store) {
    if (request.sourceThreadId === request.targetThreadId) throw errorWithStatus("target_thread_must_differ_from_source_thread");
    const existing = findByIdempotency(store, request.idempotencyKey);
    if (existing) return publicCard(existing, request.sourceThreadId);
    const timestamp = nowIso(options.now);
    const card = {
      id: idGenerator(),
      status: "pending",
      idempotencyKey: request.idempotencyKey,
      createdAt: timestamp,
      updatedAt: timestamp,
      source: {
        workspaceId: request.sourceWorkspaceId,
        threadId: request.sourceThreadId,
        turnId: request.sourceTurnId || "",
        title: request.sourceThreadTitle || request.sourceThreadId,
      },
      target: {
        workspaceId: request.targetWorkspaceId,
        threadId: request.targetThreadId,
      },
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
      },
      audit: {
        createdAt: timestamp,
      },
    };
    store.cards.push(card);
    return publicCard(card, request.sourceThreadId);
  }

  async function create(input) {
    const request = normalizeCreateRequest(input);
    return withStore(async (store) => createCardFromRequest(request, store));
  }

  async function createMany(input) {
    const requests = normalizeCreateRequests(input);
    return withStore(async (store) => requests.map((request) => createCardFromRequest(request, store)));
  }

  function listForThread(threadId) {
    const id = stringValue(threadId);
    if (!id) return [];
    const store = loadStore(storageFile);
    return sortCards(store.cards)
      .filter((card) => Boolean(cardForThread(card, id)))
      .slice(0, recentLimit)
      .map((card) => publicCard(card, id));
  }

  function get(cardId, threadId = "") {
    const id = stringValue(cardId);
    if (!id) throw errorWithStatus("task_card_id_required");
    const store = loadStore(storageFile);
    const card = findById(store, id);
    if (!card) throw errorWithStatus("task_card_not_found", 404);
    return publicCard(card, threadId || card.source.threadId || card.target.threadId || "");
  }

  async function approve(cardId, actorThreadId) {
    const id = stringValue(cardId);
    const actorThread = stringValue(actorThreadId);
    const prepared = await withStore(async (store) => {
      const card = findById(store, id);
      transitionAllowed(card, "approve", actorThreadId);
      const timestamp = nowIso(options.now);
      card.status = "approving";
      card.updatedAt = timestamp;
      card.audit = Object.assign({}, card.audit || {}, {
        approvingAt: timestamp,
        approvingByThreadId: actorThread,
      });
      return clone(card);
    });

    let execution;
    try {
      execution = await executeApprovedCard(clone(prepared), {
        text: injectedMessageText(prepared),
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
          });
        }
        return null;
      });
      throw err;
    }

    return withStore(async (store) => {
      const card = findById(store, id);
      if (!card) throw errorWithStatus("task_card_not_found", 404);
      const timestamp = nowIso(options.now);
      card.status = "approved";
      card.updatedAt = timestamp;
      card.audit = Object.assign({}, card.audit || {}, {
        approvedAt: timestamp,
        approvedByThreadId: actorThread,
      });
      if (execution && execution.turnId) card.injectedTurnId = String(execution.turnId);
      if (execution && execution.threadId) card.injectedThreadId = String(execution.threadId);
      if (execution && execution.result) card.injectionResult = execution.result;
      return {
        card: publicCard(card, actorThread),
        execution,
      };
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
    return withStore(async (store) => {
      const card = safeArray(store.cards).find((entry) => stringValue(entry.id) === id);
      transitionAllowed(card, "reply", actorThreadId);
      const existing = findByIdempotency(store, replyRequest.idempotencyKey);
      const timestamp = nowIso(options.now);
      card.status = "replied";
      card.updatedAt = timestamp;
      card.audit = Object.assign({}, card.audit || {}, {
        repliedAt: timestamp,
        repliedByThreadId: stringValue(actorThreadId),
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
            threadId: replyRequest.sourceThreadId || card.target.threadId,
            turnId: "",
            title: replyRequest.sourceThreadTitle || card.target.threadId,
          },
          target: {
            workspaceId: card.source.workspaceId,
            threadId: card.source.threadId,
          },
          message: {
            format: replyRequest.format,
            title: replyRequest.title,
            summary: replyRequest.summary,
            body: replyRequest.body,
          },
          delivery: {
            injectOnApprove: true,
            allowReply: true,
            allowRevoke: true,
          },
          audit: {
            createdAt: timestamp,
            replyToCardId: card.id,
          },
        };
        store.cards.push(replyCard);
      }
      card.replyCardId = replyCard.id;
      return {
        card: publicCard(card, actorThreadId),
        replyCard: publicCard(replyCard, card.source.threadId),
      };
    });
  }

  function pendingCountForThread(threadId) {
    const store = loadStore(storageFile);
    return countsForThreadFromStore(store, threadId).pendingTotal;
  }

  function pendingCountsForThread(threadId) {
    const store = loadStore(storageFile);
    return countsForThreadFromStore(store, threadId);
  }

  return {
    approve,
    create,
    createMany,
    deleteCard,
    get,
    injectedMessageText,
    listForThread,
    pendingCountForThread,
    pendingCountsForThread,
    reply,
    revoke,
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
