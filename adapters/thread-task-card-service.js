"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const MAX_TITLE_CHARS = 120;
const MAX_SUMMARY_CHARS = 300;
const MAX_BODY_CHARS = 8_000;
const AUTO_REPLY_BODY_CHARS = 6_000;
const DEFAULT_RECENT_LIMIT = 24;
const MAX_BATCH_TARGETS = 12;
const SETTLED_STATUSES = new Set(["approved", "deleted", "revoked", "replied"]);
const WORKFLOW_MODE_MANUAL = "manual";
const WORKFLOW_MODE_AUTONOMOUS = "autonomous";
const AUTO_RETURN_TITLE_PREFIX = "Auto return:";

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

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultStore() {
  return { cards: [], workflows: [] };
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
    workflowMode: normalizedWorkflowMode(input.workflowMode),
    workflowId: boundedString(input.workflowId, "workflow_id", 220, false),
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

function workflowForRequest(request) {
  if (!request || request.workflowMode !== WORKFLOW_MODE_AUTONOMOUS) return null;
  return {
    mode: WORKFLOW_MODE_AUTONOMOUS,
    id: workflowIdForRequest(request),
    authorized: false,
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

function injectedMessageText(card) {
  const autonomous = isAutonomousWorkflow(card.workflow);
  const autoReturnOnCompletion = autonomous
    && card.delivery
    && card.delivery.autoReturnOnCompletion === true;
  const sourceDirect = card.delivery
    && card.delivery.approvalMode === "source_thread_direct";
  const lines = [
    sourceDirect ? "[Cross-thread task card sent by source thread]" : "[Cross-thread task card approved]",
    "",
    `Source workspace: ${card.source.workspaceId}`,
    `Source thread: ${card.source.title || card.source.threadId}`,
    `Source thread id: ${card.source.threadId}`,
    card.message && card.message.title ? `Title: ${card.message.title}` : "",
    sourceDirect ? "Approval: target approval bypassed by the thread-callable interface." : "",
    autonomous ? `Workflow mode: ${card.workflow.mode}` : "",
    autonomous ? `Workflow id: ${card.workflow.id}` : "",
    autoReturnOnCompletion ? "Auto-return: when this injected turn completes, Codex Mobile Web will send a return task card back to the source thread in this workflow." : "",
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
        autoRunAfterFirstApproval: request.workflowMode === WORKFLOW_MODE_AUTONOMOUS,
        autoReturnOnCompletion: request.workflowMode === WORKFLOW_MODE_AUTONOMOUS,
      },
      workflow: workflowForRequest(request),
      audit: {
        createdAt: timestamp,
      },
    };
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
        if (card.status !== "pending") return null;
        workflow = activeWorkflowForCard(store, card);
        if (!workflow) return null;
        markCardWorkflowAuthorized(card, workflow);
      } else if (sourceDirect) {
        if (!actorThread) throw errorWithStatus("actor_thread_id_required");
        if (!card) throw errorWithStatus("task_card_not_found", 404);
        if (card.status === "approved") return { alreadyApproved: true, card: clone(card) };
        if (card.status !== "pending") throw errorWithStatus(`task_card_not_pending:${card.status}`, 409);
        if (stringValue(card.source && card.source.threadId) !== actorThread) {
          throw errorWithStatus("direct_approval_requires_source_thread", 403);
        }
      } else {
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
        text: injectedMessageText(preparedCard),
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

    return withStore(async (store) => {
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
      return {
        card: publicCard(card, publicThreadId || actorThread || card.target.threadId),
        execution,
      };
    });
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
      const card = safeArray(store.cards).find((entry) => stringValue(entry.id) === id);
      transitionAllowed(card, "reply", actorThreadId);
      const existing = findByIdempotency(store, replyRequest.idempotencyKey);
      const timestamp = nowIso(options.now);
      const replyWorkflowMode = replyRequest.workflowModeExplicit
        ? replyRequest.workflowMode
        : (isAutonomousWorkflow(card.workflow) ? WORKFLOW_MODE_AUTONOMOUS : WORKFLOW_MODE_MANUAL);
      const replySourceThreadId = replyRequest.sourceThreadId || card.target.threadId;
      const replyTargetThreadId = card.source.threadId;
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
            threadId: replySourceThreadId,
            turnId: "",
            title: replyRequest.sourceThreadTitle || card.target.threadId,
          },
          target: {
            workspaceId: card.source.workspaceId,
            threadId: replyTargetThreadId,
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
            autoRunAfterFirstApproval: replyWorkflowMode === WORKFLOW_MODE_AUTONOMOUS,
          },
          workflow: replyWorkflowMode === WORKFLOW_MODE_AUTONOMOUS ? {
            mode: WORKFLOW_MODE_AUTONOMOUS,
            id: replyWorkflowId,
            authorized: false,
          } : null,
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
    result.replyCard = await maybeAutoApprovePublicCard(result.replyCard, result.replyCard && result.replyCard.target && result.replyCard.target.threadId);
    return result;
  }

  async function maybeAutoReplyCompletedTurn(completed = {}) {
    const turnId = stringValue(completed.turnId);
    const threadId = stringValue(completed.threadId);
    if (!turnId || !threadId) return null;
    const prepared = await withStore(async (store) => {
      const card = safeArray(store.cards).find((entry) => entry
        && entry.status === "approved"
        && isAutonomousWorkflow(entry.workflow)
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
            workspaceId: card.source && card.source.workspaceId || "",
            threadId: card.source && card.source.threadId || "",
          },
          message: {
            format: "markdown",
            title: autoReturnTitleForCard(card),
            summary: boundedVisibleText(completed.summary || "Target thread completed and returned the result automatically.", MAX_SUMMARY_CHARS),
            body: autoReplyBodyForCompletedTurn(card, completed),
          },
          delivery: {
            injectOnApprove: true,
            allowReply: true,
            allowRevoke: true,
            autoRunAfterFirstApproval: true,
            autoReturnOnCompletion: false,
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
    const replyCard = await maybeAutoApprovePublicCard(prepared, prepared && prepared.target && prepared.target.threadId);
    return replyCard ? { card: replyCard } : null;
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
    approveFromSource,
    create,
    createMany,
    deleteCard,
    get,
    injectedMessageText,
    listForThread,
    maybeAutoReplyCompletedTurn,
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
