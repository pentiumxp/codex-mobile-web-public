"use strict";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeIdentifier(value) {
  return normalizeText(value).toLowerCase();
}

function normalizedUniqueSortedValues(values = []) {
  const raw = Array.isArray(values) ? values : [values];
  return [...new Set(raw.map((value) => normalizeText(value)).filter(Boolean))].sort();
}

function taskCardBodyText(body = {}) {
  return normalizeText(body.body || body.bodyMarkdown || body.message || "");
}

function taskCardKind(body = {}) {
  return normalizeIdentifier(body.cardKind || body.card_kind || body.taskCardKind || body.task_card_kind || body.kind);
}

function taskCardPluginId(body = {}) {
  return normalizeIdentifier(body.pluginId || body.plugin_id || body.plugin);
}

function isSemanticPluginDeployment(body = {}) {
  return taskCardKind(body) === "plugin_deployment" && Boolean(taskCardPluginId(body));
}

function taskCardThreadCallSeedObject(body = {}, targetThreadIds = [], helpers = {}) {
  const normalizeReasoningEffort = typeof helpers.normalizeReasoningEffort === "function"
    ? helpers.normalizeReasoningEffort
    : (value) => normalizeIdentifier(value);
  const normalizeWorkflowMode = typeof helpers.normalizeWorkflowMode === "function"
    ? helpers.normalizeWorkflowMode
    : (value) => normalizeIdentifier(value || "manual");

  return {
    targetThreadIds: normalizedUniqueSortedValues(targetThreadIds),
    cardKind: taskCardKind(body),
    pluginId: taskCardPluginId(body),
    category: normalizeIdentifier(body.category || body.cardCategory || body.card_category),
    title: normalizeText(body.title),
    summary: normalizeText(body.summary),
    body: taskCardBodyText(body),
    reasoningEffort: normalizeReasoningEffort(body.reasoningEffort || body.reasoning_effort || body.effort),
    workflowMode: normalizeWorkflowMode(body.workflowMode),
    workflowId: normalizeText(body.workflowId || body.workflow_id),
    replyToThreadId: normalizeText(body.replyToThreadId || body.reply_to_thread_id || body.returnTargetThreadId || body.return_target_thread_id),
    replyToWorkspaceId: normalizeText(body.replyToWorkspaceId || body.reply_to_workspace_id || body.returnTargetWorkspaceId || body.return_target_workspace_id),
    replyToCardId: normalizeText(body.replyToCardId || body.reply_to_card_id || body.originalTaskCardId || body.original_task_card_id),
  };
}

function threadTaskCardThreadCallIdempotencyKey(sourceThreadId, body = {}, targetThreadIds = [], helpers = {}) {
  const stableTextHash = typeof helpers.stableTextHash === "function"
    ? helpers.stableTextHash
    : (value) => String(value || "").length.toString(36);
  const explicit = normalizeText(body.idempotencyKey || body.idempotency_key);
  if (explicit) return explicit;

  const semanticPluginDeployment = isSemanticPluginDeployment(body);
  const requestId = normalizeText(body.requestId || body.request_id);
  const seed = !semanticPluginDeployment && requestId
    ? requestId
    : JSON.stringify(taskCardThreadCallSeedObject(body, targetThreadIds, helpers));
  return `thread-call:${stableTextHash(sourceThreadId)}:${stableTextHash(seed)}`;
}

module.exports = {
  isSemanticPluginDeployment,
  normalizedUniqueSortedValues,
  taskCardBodyText,
  taskCardKind,
  taskCardPluginId,
  taskCardThreadCallIdempotencyKey: threadTaskCardThreadCallIdempotencyKey,
  taskCardThreadCallSeedObject,
  threadTaskCardThreadCallIdempotencyKey,
};
