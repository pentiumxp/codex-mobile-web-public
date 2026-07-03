#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  normalizeSecretRefsFromInput,
  publicSensitiveContext,
} = require("../services/runtime/home-ai-secret-ref-service");

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "codex_mobile";

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    server: process.env.CODEX_MOBILE_BASE_URL || "http://127.0.0.1:8787",
    keyFile: process.env.CODEX_MOBILE_KEY_FILE || path.join(os.homedir(), ".codex-mobile-web", "access_key"),
    selfTestToolsList: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--server") out.server = argv[++index] || "";
    else if (arg === "--key-file") out.keyFile = argv[++index] || "";
    else if (arg === "--self-test-tools-list" || arg === "--list-tools") out.selfTestToolsList = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`codex_mobile_mcp_unknown_arg:${arg}`);
    }
  }
  return out;
}

function printHelp() {
  process.stdout.write([
    "Usage: node scripts/codex-mobile-mcp-server.js [options]",
    "",
    "Options:",
    "  --server <url>             Codex Mobile server. Default: http://127.0.0.1:8787",
    "  --key-file <path>          Access key file. Default: $HOME/.codex-mobile-web/access_key",
    "  --self-test-tools-list     Print bounded tool names and exit.",
  ].join("\n") + "\n");
}

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) throw new Error("codex_mobile_mcp_base_url_required");
  const parsed = new URL(raw);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("codex_mobile_mcp_base_url_invalid");
  }
  return parsed.origin;
}

function readAccessKey(file) {
  const inline = String(process.env.CODEX_MOBILE_KEY || process.env.CODEX_MOBILE_ACCESS_KEY || "").trim();
  if (inline) return inline;
  const key = fs.readFileSync(file, "utf8").trim();
  if (!key) throw new Error("codex_mobile_mcp_key_empty");
  return key;
}

function createContext(args = {}) {
  return {
    server: normalizeBaseUrl(args.server),
    key: readAccessKey(args.keyFile),
  };
}

function textContent(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function tool(name, description, inputSchema, annotations = {}) {
  return { name, description, inputSchema, annotations };
}

function toolsList() {
  return [
    tool(
      "list_threads",
      "List bounded Codex Mobile threads so the model can choose an exact target thread before delegation.",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 80 },
          search: { type: "string", maxLength: 120 },
        },
      },
      { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    ),
    tool(
      "delegate_to_thread",
      "Create a Codex Mobile cross-thread task card. Use this instead of reading, editing, testing, deploying, or otherwise mutating another workspace from the current thread.",
      {
        type: "object",
        additionalProperties: false,
        required: ["sourceThreadId", "title", "bodyMarkdown"],
        properties: {
          sourceThreadId: { type: "string", minLength: 1, maxLength: 120 },
          targetThreadId: { type: "string", maxLength: 220 },
          targetThreadIds: {
            type: "array",
            maxItems: 12,
            items: { type: "string", minLength: 1, maxLength: 220 },
          },
          targetThreadTitle: { type: "string", maxLength: 220 },
          targetThreadTitles: {
            type: "array",
            maxItems: 12,
            items: { type: "string", minLength: 1, maxLength: 220 },
          },
          targetWorkspace: { type: "string", maxLength: 1000 },
          targetCwd: { type: "string", maxLength: 1000 },
          replyToThreadId: { type: "string", maxLength: 220 },
          replyToWorkspaceId: { type: "string", maxLength: 260 },
          replyToThreadTitle: { type: "string", maxLength: 200 },
          replyToCardId: { type: "string", maxLength: 180 },
          title: { type: "string", minLength: 1, maxLength: 120 },
          summary: { type: "string", maxLength: 300 },
          bodyMarkdown: { type: "string", minLength: 1 },
          secretRef: { type: "string", maxLength: 180, description: "Home AI short-lived secretRef. Do not put plaintext secrets in bodyMarkdown." },
          secretRefs: {
            type: "array",
            maxItems: 8,
            items: {
              anyOf: [
                { type: "string", maxLength: 180 },
                { type: "object", additionalProperties: true },
              ],
            },
          },
          requestId: { type: "string", maxLength: 180 },
          idempotencyKey: { type: "string", maxLength: 180 },
          workflowMode: { type: "string", enum: ["manual", "autonomous"] },
          workflowId: { type: "string", maxLength: 180 },
          reasoningEffort: { type: "string", enum: ["low", "medium", "high", "xhigh"] },
          cardKind: { type: "string", maxLength: 80 },
          pluginId: { type: "string", maxLength: 100 },
          category: { type: "string", maxLength: 80 },
        },
      },
      { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
    ),
    tool(
      "return_to_source",
      "Return a received Codex Mobile task card to its source thread. Use this when target work is completed, blocked, redirected, rejected, or partially completed; a local final answer is not a return card.",
      {
        type: "object",
        additionalProperties: false,
        required: ["taskCardId", "threadId", "title", "bodyMarkdown"],
        properties: {
          taskCardId: { type: "string", minLength: 1, maxLength: 120 },
          threadId: { type: "string", minLength: 1, maxLength: 120 },
          status: { type: "string", enum: ["completed", "blocked", "redirected", "rejected", "partially_completed"] },
          title: { type: "string", minLength: 1, maxLength: 120 },
          summary: { type: "string", maxLength: 300 },
          bodyMarkdown: { type: "string", minLength: 1 },
          requestId: { type: "string", maxLength: 180 },
          idempotencyKey: { type: "string", maxLength: 180 },
        },
      },
      { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    ),
  ];
}

function boundedString(value, fieldName, maxLength, required = false) {
  const text = String(value || "").trim();
  if (required && !text) throw new Error(`${fieldName}_required`);
  if (text.length > maxLength) throw new Error(`${fieldName}_too_long`);
  return text;
}

function boundedStringArray(value, fieldName, maxLength = 220) {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const text = boundedString(item, fieldName, maxLength, false);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function stableTextHash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 24);
}

function normalizedReturnStatus(value) {
  const status = boundedString(value, "status", 40, false).toLowerCase();
  if (!status) return "";
  if (!["completed", "blocked", "redirected", "rejected", "partially_completed"].includes(status)) throw new Error("status_invalid");
  return status;
}

async function requestJson(context, method, pathname, body = null) {
  const headers = {
    authorization: `Bearer ${context.key}`,
  };
  const init = { method, headers };
  if (body !== null) {
    headers["content-type"] = "application/json; charset=utf-8";
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${context.server}${pathname}`, init);
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch (_) {
    throw new Error(`codex_mobile_mcp_http_${response.status}`);
  }
  if (!response.ok || payload.ok === false) {
    const err = new Error(String(payload.error || payload.message || `codex_mobile_mcp_http_${response.status}`));
    err.statusCode = response.status;
    err.details = payload.details && typeof payload.details === "object" ? payload.details : undefined;
    throw err;
  }
  return payload;
}

function publicThreadSummary(thread = {}) {
  return {
    id: String(thread.id || thread.threadId || ""),
    title: String(thread.name || thread.title || thread.preview || thread.id || ""),
    cwd: String(thread.cwd || ""),
    status: thread.status && typeof thread.status === "object" ? String(thread.status.type || "") : String(thread.status || ""),
    updatedAt: thread.updatedAt || thread.updated_at || null,
  };
}

async function listThreads(context, args = {}) {
  const limit = Math.max(1, Math.min(80, Number(args.limit || 40)));
  const params = new URLSearchParams({ limit: String(limit) });
  const search = boundedString(args.search, "search", 120, false);
  if (search) params.set("search", search);
  const payload = await requestJson(context, "GET", `/api/threads?${params.toString()}`);
  const rows = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.threads) ? payload.threads : [];
  return {
    ok: true,
    threads: rows.slice(0, limit).map(publicThreadSummary).filter((thread) => thread.id),
  };
}

async function delegateToThread(context, args = {}) {
  const sourceThreadId = boundedString(args.sourceThreadId, "source_thread_id", 120, true);
  const title = boundedString(args.title, "title", 120, true);
  const bodyMarkdown = boundedString(args.bodyMarkdown || args.body, "body_markdown", 50_000, true);
  const sensitiveContext = normalizeSecretRefsFromInput(args, {
    source: "mcp-delegate",
    targetPlugin: "codex",
    sourceThreadId,
  });
  const payload = {
    sourceThreadId,
    title,
    summary: boundedString(args.summary, "summary", 300, false),
    body: bodyMarkdown,
    bodyMarkdown,
    targetThreadId: boundedString(args.targetThreadId, "target_thread_id", 220, false),
    targetThreadIds: boundedStringArray(args.targetThreadIds, "target_thread_ids"),
    targetThreadTitle: boundedString(args.targetThreadTitle, "target_thread_title", 220, false),
    targetThreadTitles: boundedStringArray(args.targetThreadTitles, "target_thread_titles"),
    targetWorkspace: boundedString(args.targetWorkspace, "target_workspace", 1000, false),
    targetCwd: boundedString(args.targetCwd, "target_cwd", 1000, false),
    replyToThreadId: boundedString(args.replyToThreadId || args.reply_to_thread_id || args.returnTargetThreadId || args.return_target_thread_id, "reply_to_thread_id", 220, false),
    replyToWorkspaceId: boundedString(args.replyToWorkspaceId || args.reply_to_workspace_id || args.returnTargetWorkspaceId || args.return_target_workspace_id, "reply_to_workspace_id", 260, false),
    replyToThreadTitle: boundedString(args.replyToThreadTitle || args.reply_to_thread_title || args.returnTargetThreadTitle || args.return_target_thread_title, "reply_to_thread_title", 200, false),
    replyToCardId: boundedString(args.replyToCardId || args.reply_to_card_id || args.originalTaskCardId || args.original_task_card_id, "reply_to_card_id", 180, false),
    requestId: boundedString(args.requestId, "request_id", 180, false),
    idempotencyKey: boundedString(args.idempotencyKey, "idempotency_key", 180, false),
    workflowMode: boundedString(args.workflowMode || "manual", "workflow_mode", 40, false) || "manual",
    workflowId: boundedString(args.workflowId, "workflow_id", 180, false),
    reasoningEffort: boundedString(args.reasoningEffort || args.reasoning_effort || args.effort, "reasoning_effort", 40, false),
    cardKind: boundedString(args.cardKind || args.card_kind || args.taskCardKind || args.task_card_kind, "card_kind", 80, false),
    pluginId: boundedString(args.pluginId || args.plugin_id, "plugin_id", 100, false),
    category: boundedString(args.category, "category", 80, false),
    sensitiveContext,
    direct: true,
    autoApprove: true,
    pending: false,
  };
  const result = await requestJson(context, "POST", `/api/threads/${encodeURIComponent(sourceThreadId)}/task-cards`, payload);
  const cards = Array.isArray(result.cards) ? result.cards : result.card ? [result.card] : [];
  return {
    ok: result.ok !== false,
    sourceThreadId: String(result.sourceThreadId || sourceThreadId),
    direct: Boolean(result.direct || result.autoApprove),
    workspaceDelegationEnabled: Boolean(result.workspaceDelegationEnabled),
    cardCount: cards.length,
    cards: cards.map((card) => ({
      id: String(card.id || ""),
      status: String(card.status || ""),
      targetThreadId: String(card.target && card.target.threadId || card.injectedThreadId || ""),
      replyToThreadId: String(card.replyTo && card.replyTo.threadId || ""),
      injectedTurnId: String(card.injectedTurnId || ""),
      targetApprovalBypassed: Boolean(card.delivery && card.delivery.targetApprovalBypassed),
      reasoningEffort: String(card.delivery && card.delivery.reasoningEffort || card.injectionRuntime && card.injectionRuntime.requestedReasoningEffort || ""),
      runtimeReasoningEffort: String(card.injectionRuntime && card.injectionRuntime.reasoningEffort || ""),
      sensitiveContext: publicSensitiveContext(card.sensitiveContext),
    })),
  };
}

async function returnToSource(context, args = {}) {
  const taskCardId = boundedString(args.taskCardId || args.cardId, "task_card_id", 120, true);
  const threadId = boundedString(args.threadId || args.actorThreadId, "thread_id", 120, true);
  const title = boundedString(args.title, "title", 120, true);
  const bodyMarkdown = boundedString(args.bodyMarkdown || args.body, "body_markdown", 50_000, true);
  const status = normalizedReturnStatus(args.status);
  const workflowId = boundedString(args.workflowId || args.workflow_id, "workflow_id", 220, false);
  const seed = boundedString(args.idempotencyKey, "idempotency_key", 180, false)
    || boundedString(args.requestId, "request_id", 180, false)
    || JSON.stringify({ taskCardId, threadId, workflowId, status, title, body: bodyMarkdown });
  const payload = {
    threadId,
    status,
    workflowId,
    returnToSource: true,
    title: /^Return:/i.test(title) ? title : `Return: ${title}`,
    summary: boundedString(args.summary, "summary", 300, false) || status,
    body: bodyMarkdown,
    bodyMarkdown,
    format: "markdown",
    idempotencyKey: boundedString(
      args.idempotencyKey || `task-card-return:${stableTextHash(`${taskCardId}|${threadId}`)}:${stableTextHash(seed)}`,
      "idempotency_key",
      220,
      true,
    ),
  };
  const result = await requestJson(context, "POST", `/api/thread-task-cards/${encodeURIComponent(taskCardId)}/reply`, payload);
  const replyCard = result.replyCard || {};
  return {
    ok: result.ok !== false,
    taskCardId,
    threadId,
    status: String(result.card && result.card.status || ""),
    requestedActorThreadId: String(result.returnResolution && result.returnResolution.requestedActorThreadId || threadId),
    resolvedActorThreadId: String(result.returnResolution && result.returnResolution.resolvedActorThreadId || threadId),
    returnNoOp: Boolean(result.returnResolution && result.returnResolution.noOp),
    returnNoOpReason: String(result.returnResolution && result.returnResolution.reason || ""),
    workflowRecovered: Boolean(result.returnResolution && result.returnResolution.workflowRecovered),
    actorThreadInferred: Boolean(result.returnResolution && result.returnResolution.actorThreadInferred),
    expectedTargetThreadId: String(result.returnResolution && result.returnResolution.expectedTargetThreadId || ""),
    resolverVersion: String(result.returnResolution && result.returnResolution.resolverVersion || ""),
    replyCard: {
      id: String(replyCard.id || ""),
      status: String(replyCard.status || ""),
      sourceThreadId: String(replyCard.source && replyCard.source.threadId || ""),
      targetThreadId: String(replyCard.target && replyCard.target.threadId || ""),
      injectedTurnId: String(replyCard.injectedTurnId || ""),
      returnToSource: Boolean(replyCard.delivery && replyCard.delivery.returnToSource),
      returnStatus: String(replyCard.delivery && replyCard.delivery.returnStatus || ""),
      terminal: Boolean(replyCard.terminal || replyCard.delivery && replyCard.delivery.terminal),
      requiresReturn: Boolean(replyCard.requiresReturn),
      ackPolicy: String(replyCard.ackPolicy || replyCard.delivery && replyCard.delivery.ackPolicy || ""),
    },
  };
}

async function handleMessage(context, message = {}) {
  const method = String(message.method || "");
  if (method === "initialize") {
    return {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: SERVER_NAME, version: packageVersion() },
      instructions: [
        "Use delegate_to_thread when a user request requires code, files, commands, tests, deployment, or other mutation in another Codex thread/workspace.",
        "Use return_to_source when a received task card is completed, blocked, redirected, rejected, or partially completed; a target-thread final answer is not a source-thread return card.",
        "Do not use multi_agent_v1 tools as a substitute for Codex Mobile cross-thread task cards.",
      ].join("\n"),
    };
  }
  if (method === "notifications/initialized") return undefined;
  if (method === "tools/list") return { tools: toolsList() };
  if (method === "tools/call") {
    const params = message.params && typeof message.params === "object" ? message.params : {};
    const name = String(params.name || "");
    const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
    if (name === "list_threads") return textContent(await listThreads(context, args));
    if (name === "delegate_to_thread") return textContent(await delegateToThread(context, args));
    if (name === "return_to_source") return textContent(await returnToSource(context, args));
    throw new Error("codex_mobile_mcp_unknown_tool");
  }
  if (method === "ping") return {};
  throw new Error("method_not_found");
}

function encodeMessage(payload) {
  return Buffer.from(`${JSON.stringify(payload)}\n`, "utf8");
}

function createMessageParser(onMessage) {
  let buffer = Buffer.alloc(0);
  return (chunk) => {
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    while (buffer.length) {
      if (buffer.subarray(0, 15).toString("ascii").toLowerCase().startsWith("content-length")) {
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) return;
        const header = buffer.subarray(0, headerEnd).toString("ascii");
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          buffer = buffer.subarray(headerEnd + 4);
          continue;
        }
        const length = Number(match[1]);
        const bodyStart = headerEnd + 4;
        const bodyEnd = bodyStart + length;
        if (buffer.length < bodyEnd) return;
        const body = buffer.subarray(bodyStart, bodyEnd).toString("utf8");
        buffer = buffer.subarray(bodyEnd);
        onMessage(JSON.parse(body));
        continue;
      }
      const lineEnd = buffer.indexOf("\n");
      if (lineEnd === -1) return;
      const line = buffer.subarray(0, lineEnd).toString("utf8").trim();
      buffer = buffer.subarray(lineEnd + 1);
      if (line) onMessage(JSON.parse(line));
    }
  };
}

function boundedError(error) {
  const raw = String(error && error.message || error || "codex_mobile_mcp_error");
  if (/token|cookie|secret|password|access.?key|authorization/i.test(raw) && !/^codex_mobile_mcp_key_/.test(raw)) {
    return "codex_mobile_mcp_error";
  }
  return raw.replace(/\s+/g, " ").slice(0, 180) || "codex_mobile_mcp_error";
}

function packageVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version || "0.0.0";
  } catch (_) {
    return "0.0.0";
  }
}

async function runStdio(context) {
  const parse = createMessageParser(async (message) => {
    if (!message || message.id === undefined) return;
    try {
      const result = await handleMessage(context, message);
      if (result === undefined) return;
      process.stdout.write(encodeMessage({ jsonrpc: "2.0", id: message.id, result }));
    } catch (error) {
      process.stdout.write(encodeMessage({
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32000, message: boundedError(error) },
      }));
    }
  });
  process.stdin.on("data", parse);
}

async function main() {
  const args = parseArgs();
  if (args.selfTestToolsList) {
    process.stdout.write(JSON.stringify({ tools: toolsList().map((entry) => entry.name) }) + "\n");
    return;
  }
  await runStdio(createContext(args));
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${boundedError(error)}\n`);
    process.exitCode = 2;
  });
}

module.exports = {
  createMessageParser,
  delegateToThread,
  encodeMessage,
  handleMessage,
  listThreads,
  parseArgs,
  returnToSource,
  toolsList,
};
