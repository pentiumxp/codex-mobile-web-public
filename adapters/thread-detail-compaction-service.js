"use strict";

const { createThreadTurnCompactionPolicyService } = require("./thread-turn-compaction-policy-service");

function createThreadDetailCompactionService(deps = {}) {
  const fs = deps.fs || require("node:fs");
  const path = deps.path || require("node:path");
  const OPERATIONAL_ITEM_TYPES = deps.operationalItemTypes || new Set();
  const MAX_TEXT_CHARS = deps.maxTextChars || 60000;
  const MAX_COMMAND_OUTPUT_CHARS = deps.maxCommandOutputChars || 8000;
  const MAX_COMMAND_OUTPUT_CHARS_PER_TURN = deps.maxCommandOutputCharsPerTurn || 48000;
  const MAX_LIVE_OPERATION_ITEMS = Math.max(1, Math.min(50, Number(deps.maxLiveOperationItems || 12)));
  const MAX_THREAD_TURNS = Math.max(1, Math.min(200, Number(deps.maxThreadTurns || 40)));
  const pendingSteerEchoStore = deps.pendingSteerEchoStore || { injectIntoThread() {} };
  const {
    appendMissingRolloutCompletionTurnsToThread,
    appendRolloutEmptyCompletionDiagnosticsToThread,
    appendRolloutFinalReceiptsToThread,
    appendRolloutToolOutputImagesToThread,
    attachGeneratedImageContent,
    attachTurnUsageSummaries,
    compactStringArray,
    compactStructured,
    dedupeUserMessageEchoesInThread,
    enrichThreadItemTimestampsFromRollout,
    imageViewSourcePath,
    inferTurnItemDisplayTimestamps,
    isCodexMobileUploadFilePath,
    isCompletedStatus,
    isLiveTurn,
    normalizeFsPath,
    normalizeStaleContextOnlyActiveThread,
    orderTurnItemsByDisplayTimestamp,
    parseJsonLine,
    pruneSupersededLiveShellTurns,
    readRolloutTail,
    readRolloutToolOutputImageItems,
    readRolloutTurnUsageSummaries,
    reconcileThreadActiveTurnWithRolloutEvidence,
    rolloutEntryTurnId,
    rolloutPathForThread,
    rolloutStatsForPath,
    rolloutTimestampFields,
    statusText,
    truncateMiddle,
    truncateTail,
    workspaceContextStatsForCwd,
    normalizeSupersededLiveTurns,
    annotateThreadRolloutStats,
  } = deps;

  const optional = (fn, fallback) => (typeof fn === "function" ? fn : fallback);
  const normalizeStatsForCwd = optional(workspaceContextStatsForCwd, () => null);
  const enrichTimestamps = optional(enrichThreadItemTimestampsFromRollout, () => {});
  const inferDisplayTimestamps = optional(inferTurnItemDisplayTimestamps, (turn) => turn);
  const orderByDisplayTimestamp = optional(orderTurnItemsByDisplayTimestamp, (turn) => turn);
  const normalizeStaleActiveThread = optional(normalizeStaleContextOnlyActiveThread, (thread) => thread);
  const annotateStats = optional(annotateThreadRolloutStats, (thread) => thread);
  const rolloutStats = optional(rolloutStatsForPath, () => null);
  const rolloutPath = optional(rolloutPathForThread, (thread) => thread && (thread.path || thread.rolloutPath || thread.rollout_path) || "");
  const compactStrings = optional(compactStringArray, (values) => values);
  const compactValue = optional(compactStructured, (value) => value);
  const truncateMid = optional(truncateMiddle, (value) => value);
  const truncateEnd = optional(truncateTail, (value) => value);
  const itemTimestamps = optional(rolloutTimestampFields, () => ({}));
  const entryTurnId = optional(rolloutEntryTurnId, () => "");
  const readTail = optional(readRolloutTail, () => "");
  const parseLine = optional(parseJsonLine, (line) => { try { return JSON.parse(line); } catch (_) { return null; } });
  const statusOf = optional(statusText, (value) => String(value || ""));
  const completed = optional(isCompletedStatus, () => false);
  const liveTurn = optional(isLiveTurn, () => false);
  const normalizePath = optional(normalizeFsPath, (value) => String(value || ""));
  const uploadPathAllowed = optional(isCodexMobileUploadFilePath, () => false);
  const sourcePathForImageView = optional(imageViewSourcePath, () => "");
  const attachImageContent = optional(attachGeneratedImageContent, () => {});
  const reconcileActiveTurn = optional(reconcileThreadActiveTurnWithRolloutEvidence, () => {});
  const normalizeSupersededTurns = optional(normalizeSupersededLiveTurns, () => {});
  const pruneSupersededTurns = optional(pruneSupersededLiveShellTurns, () => {});
  const appendMissingCompletionTurns = optional(appendMissingRolloutCompletionTurnsToThread, () => {});
  const readToolOutputImages = optional(readRolloutToolOutputImageItems, () => ({ suppressedUploadViewImageCallIdsByTurn: new Map() }));
  const appendToolOutputImages = optional(appendRolloutToolOutputImagesToThread, () => {});
  const appendFinalReceipts = optional(appendRolloutFinalReceiptsToThread, () => {});
  const appendEmptyDiagnostics = optional(appendRolloutEmptyCompletionDiagnosticsToThread, () => {});
  const attachUsageSummaries = optional(attachTurnUsageSummaries, () => {});
  const readUsageSummaries = optional(readRolloutTurnUsageSummaries, () => []);
  const dedupeUserEchoes = optional(dedupeUserMessageEchoesInThread, () => {});
  function isContextCompactionType(type) {
    return /context.*compaction|context.*compression|context_compaction|context_compression/i.test(String(type || ""));
  }

  function contextCompactionNotice(pending) {
    return pending ? "历史上下文正在压缩" : "历史上下文已压缩";
  }

  function contextCompactionMobileState(item, options = {}) {
    if (options.contextCompactionPending === true) return "pending";
    if (options.contextCompactionPending === false) return "complete";
    const text = statusText(item && item.status).toLowerCase();
    if (!text) return "";
    if (isCompletedStatus(text)) return "complete";
    if (/(running|active|queued|processing|inprogress|in_progress|in-progress|pending|started)/.test(text)) {
      return "pending";
    }
    return "";
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

  function compactItemTimestampFields(item) {
    const fields = {};
    for (const key of [
      "createdAtMs",
      "createdAt",
      "created_at_ms",
      "created_at",
      "startedAtMs",
      "startedAt",
      "started_at_ms",
      "started_at",
      "timestampMs",
      "timestamp",
      "completedAtMs",
      "completedAt",
      "completed_at_ms",
      "completed_at",
      "mobileDisplayTimestampMs",
      "mobileDisplayTimestamp",
    ]) {
      if (item && item[key] !== undefined) fields[key] = item[key];
    }
    if (item && item.mobileDisplayTimestampInferred !== undefined) {
      fields.mobileDisplayTimestampInferred = item.mobileDisplayTimestampInferred === true;
    }
    return fields;
  }

  function compactOperationalItem(out) {
    const isWebSearch = isWebSearchLikeItem(out);
    const command = typeof out.command === "string"
      ? out.command
      : (isWebSearch ? searchSummaryFromOperation(out) : undefined);
    const compact = {
      id: out.id,
      type: isWebSearch ? "dynamicToolCall" : out.type,
      ...compactItemTimestampFields(out),
      status: out.status,
      server: out.server,
      namespace: out.namespace,
      tool: isWebSearch ? "Web Search" : out.tool,
      callId: out.callId || out.call_id,
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
    if (payload.arguments && typeof payload.arguments === "object" && !Array.isArray(payload.arguments)) {
      return String(payload.arguments.command
        || payload.arguments.cmd
        || payload.arguments.shellCommand
        || payload.arguments.shell_command
        || "");
    }
    if (typeof payload.arguments === "string") {
      const parsed = parseJsonLine(payload.arguments);
      if (parsed) {
        return String(parsed.command
          || parsed.cmd
          || parsed.shellCommand
          || parsed.shell_command
          || "");
      }
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
        callId: payload.call_id,
        ...rolloutTimestampFields(entry),
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
        callId: payload.call_id,
        ...rolloutTimestampFields(entry),
        status: statusFromRawOperation(payload),
        command: commandFromRawPayload(payload),
      });
    }
    if (entry.type === "event_msg" && payload.type === "patch_apply_end") {
      return compactOperationalItem({
        id: `raw-${payload.call_id || entry.timestamp || "patch"}`,
        type: "fileChange",
        callId: payload.call_id,
        ...rolloutTimestampFields(entry),
        status: statusFromRawOperation(payload),
        fileNames: Object.keys(payload.changes || {}).slice(0, 5),
      });
    }
    if (entry.type === "response_item" && payload.type === "function_call") {
      return compactOperationalItem({
        id: `raw-${payload.call_id || entry.timestamp || "function"}`,
        type: "commandExecution",
        callId: payload.call_id,
        ...rolloutTimestampFields(entry),
        status: statusFromRawOperation(payload),
        command: commandFromRawPayload(payload),
      });
    }
    if (entry.type === "response_item" && payload.type === "web_search_call") {
      return compactOperationalItem({
        id: `raw-${payload.call_id || entry.timestamp || "web-search"}`,
        type: "web_search_call",
        callId: payload.call_id,
        ...rolloutTimestampFields(entry),
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
        callId: payload.call_id,
        ...rolloutTimestampFields(entry),
        status: statusFromRawOperation(payload),
        tool: payload.name,
        fileNames,
      });
    }
    return null;
  }

  function rawOperationOutputCallId(entry) {
    if (!entry || !entry.payload) return "";
    const payload = entry.payload;
    if (entry.type === "response_item" && /^(function_call_output|custom_tool_call_output)$/.test(String(payload.type || ""))) {
      return String(payload.call_id || "");
    }
    if (entry.type === "event_msg" && /^(exec_command_end|patch_apply_end|web_search_end)$/.test(String(payload.type || ""))) {
      return String(payload.call_id || "");
    }
    return "";
  }

  function statusFromRawOperationOutput(payload) {
    const status = statusFromRawOperation(payload || {});
    return status === "running" ? "completed" : status;
  }

  function operationKey(item) {
    if (!item || typeof item !== "object") return "";
    const callId = String(item.callId || item.call_id || "");
    if (callId) return `${item.type || "operation"}:${callId}`;
    if (item.id) return `id:${item.id}`;
    return "";
  }

  function operationSignature(item) {
    if (!item || typeof item !== "object") return "";
    if (item.type === "commandExecution" && item.command) return `command:${String(item.command)}`;
    if (item.type === "fileChange" && Array.isArray(item.fileNames) && item.fileNames.length > 0) {
      return `file:${String(item.tool || "")}:${item.fileNames.join("|")}`;
    }
    if ((item.type === "dynamicToolCall" || item.type === "mcpToolCall") && item.tool) {
      return `tool:${String(item.tool)}:${String(item.action || "")}`;
    }
    if (isWebSearchLikeItem(item) && (item.command || item.action)) {
      return `web:${String(item.command || "")}:${String(item.action || "")}`;
    }
    return "";
  }

  function readRecentRawOperations(thread, turnId = "", options = {}) {
    const rolloutPath = thread && (thread.path || thread.rolloutPath || thread.rollout_path);
    if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) return [];
    try {
      const lines = readRolloutTail(rolloutPath).split(/\r?\n/).filter(Boolean).slice(-800);
      const operations = [];
      const completedCallIds = new Set();
      const completedCallStatuses = new Map();
      let currentTurnId = "";
      for (const line of lines) {
        const entry = parseJsonLine(line);
        if (!entry || !entry.payload) continue;
        const payload = entry.payload || {};
        const explicitTurnId = rolloutEntryTurnId(entry);
        if (entry.type === "turn_context" && explicitTurnId) currentTurnId = explicitTurnId;
        if (entry.type === "event_msg" && payload.type === "task_started" && explicitTurnId) {
          currentTurnId = explicitTurnId;
        }
        const outputCallId = rawOperationOutputCallId(entry);
        if (outputCallId) {
          const outputStatus = statusFromRawOperationOutput(payload);
          completedCallIds.add(outputCallId);
          completedCallStatuses.set(outputCallId, outputStatus);
          for (const operation of operations) {
            if (operation && operation.callId === outputCallId && !isCompletedStatus(operation.status)) {
              operation.status = outputStatus;
            }
          }
        }
        const operation = rawOperationFromEntry(entry);
        if (!operation) continue;
        operation.rolloutTurnId = explicitTurnId || currentTurnId || "";
        if (operation.callId && completedCallIds.has(operation.callId)) {
          operation.status = completedCallStatuses.get(operation.callId) || "completed";
        }
        operations.push(operation);
      }
      const targetTurnId = String(turnId || "");
      const includeCompleted = Boolean(options.includeCompleted);
      const maxOperations = Math.max(1, Math.min(50, Number(options.maxOperations || MAX_LIVE_OPERATION_ITEMS)));
      const selected = [];
      const seenOperationKeys = new Set();
      for (let index = operations.length - 1; index >= 0; index -= 1) {
        const operation = operations[index];
        const operationTurnId = String(operation.rolloutTurnId || "");
        const operationCompleted = isCompletedStatus(operation.status)
          || (operation.callId && completedCallIds.has(operation.callId));
        if (targetTurnId && operationTurnId && operationTurnId !== targetTurnId) continue;
        if (operationCompleted && !includeCompleted) continue;
        if (targetTurnId && operationCompleted && operationTurnId !== targetTurnId) continue;
        const key = operationKey(operation) || `${operation.type || "operation"}:${operation.id || index}`;
        if (seenOperationKeys.has(key)) continue;
        seenOperationKeys.add(key);
        selected.push(operation);
        if (selected.length >= maxOperations) break;
      }
      return selected.reverse();
    } catch (_) {
      return [];
    }
    return [];
  }

  function readLatestRawOperation(thread, turnId = "", options = {}) {
    const operations = readRecentRawOperations(thread, turnId, {
      ...options,
      maxOperations: 1,
    });
    return operations[0] || null;
  }

  function mergeRawOperationIntoItem(existing, rawOperation) {
    if (!existing || !rawOperation) return;
    if (rawOperation.status && (!existing.status || isCompletedStatus(rawOperation.status))) {
      existing.status = rawOperation.status;
    }
    for (const field of ["startedAt", "startedAtMs", "updatedAt", "updatedAtMs", "completedAt", "completedAtMs", "command", "tool", "action"]) {
      if (existing[field] === undefined && rawOperation[field] !== undefined) existing[field] = rawOperation[field];
    }
    if ((!Array.isArray(existing.fileNames) || existing.fileNames.length === 0)
      && Array.isArray(rawOperation.fileNames) && rawOperation.fileNames.length > 0) {
      existing.fileNames = rawOperation.fileNames;
    }
  }

  function mergeRecentRawOperationsIntoTurn(thread, turn, options = {}) {
    if (!turn || !Array.isArray(turn.items)) return;
    const rawOperations = readRecentRawOperations(thread, turn.id, {
      includeCompleted: true,
      maxOperations: options.maxOperations || MAX_LIVE_OPERATION_ITEMS,
    });
    if (rawOperations.length === 0) return;
    const allowNewRawOperations = isLiveTurn(turn) || options.allowNewOperations === true;

    const existingByKey = new Map();
    const existingBySignature = new Map();
    for (const item of turn.items) {
      if (!isOperationalItem(item)) continue;
      const key = operationKey(item);
      if (key) existingByKey.set(key, item);
      const signature = operationSignature(item);
      if (signature) existingBySignature.set(signature, item);
    }

    for (const rawOperation of rawOperations) {
      const key = operationKey(rawOperation);
      const signature = operationSignature(rawOperation);
      const existing = (key ? existingByKey.get(key) : null)
        || (signature ? existingBySignature.get(signature) : null);
      if (existing) {
        mergeRawOperationIntoItem(existing, rawOperation);
        continue;
      }
      if (!allowNewRawOperations) continue;
      turn.items.push(rawOperation);
      if (key) existingByKey.set(key, rawOperation);
      if (signature) existingBySignature.set(signature, rawOperation);
    }
  }

  function turnHasSyntheticProgressMessages(turn) {
    return Array.isArray(turn && turn.items)
      && turn.items.some((item) => item && item.mobileSyntheticProgressMessage === true);
  }

  function compactItem(item, options = {}) {
    if (!item || typeof item !== "object") return item;
    const out = Object.assign({}, item);
    if (isContextCompactionType(out.type)) {
      const compactionState = contextCompactionMobileState(out, options);
      const compacted = {
        id: out.id,
        type: out.type,
        ...compactItemTimestampFields(out),
        status: out.status,
      };
      if (!compactionState) return compacted;
      const pending = compactionState === "pending";
      return {
        ...compacted,
        mobileCompactionStatus: pending ? "running" : "completed",
        mobileNotice: contextCompactionNotice(pending),
      };
    }
    if (isOperationalItem(out)) {
      return compactOperationalItem(out);
    }
    if (out.type === "imageView" || out.type === "imageGeneration") attachGeneratedImageContent(out, options);
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

  const threadTurnCompactionPolicyService = createThreadTurnCompactionPolicyService({
    isLiveTurn,
    isCompletedStatus,
    isOperationalItem,
    isUserQuestionItem,
    isUserVisibleInputItem,
    isAssistantReceiptItem,
    isVisualReceiptItem,
    isTurnUsageSummaryItem,
    isDiagnosticReceiptItem: isTurnDiagnosticItem,
  });

  function trailingOperationIndexes(items, allowLiveOperation, maxOperations = 1) {
    return threadTurnCompactionPolicyService.trailingOperationIndexes(items, allowLiveOperation, maxOperations);
  }

  function isUserQuestionItem(item) {
    if (!item || typeof item !== "object") return false;
    const type = String(item.type || "").toLowerCase();
    if (type === "usermessage") return true;
    if (type === "message") {
      const role = String(item.role || item.author || "").toLowerCase();
      return role === "user";
    }
    return false;
  }

  function isUserVisibleInputItem(item) {
    if (isUserQuestionItem(item)) return true;
    return isContextCompactionType(item && item.type);
  }

  function userMessageContentParts(item) {
    return Array.isArray(item && item.content) ? item.content : [];
  }

  function imageUrlValueForUserMessagePart(part) {
    if (!part || typeof part !== "object") return "";
    const raw = part.url || part.image_url || part.imageUrl || "";
    if (raw && typeof raw === "object") return String(raw.url || raw.uri || raw.href || "");
    return String(raw || "");
  }

  function textValueForUserMessagePart(part) {
    if (!part || typeof part !== "object") return "";
    if (typeof part.text === "string") return part.text;
    if (typeof part.input_text === "string") return part.input_text;
    if (part.type === "input_text" && typeof part.content === "string") return part.content;
    return "";
  }

  function isImageUserMessagePart(part) {
    if (!part || typeof part !== "object") return false;
    const type = String(part.type || "");
    const url = imageUrlValueForUserMessagePart(part);
    return type === "image"
      || type === "localImage"
      || type === "input_image"
      || type === "image_url"
      || /^data:image\//i.test(url)
      || /\.(?:png|jpe?g|webp|gif)(?:[?#].*)?$/i.test(String(part.path || url || ""));
  }

  function textContainsRenderableUploadSummary(text) {
    const value = String(text || "");
    return /(^|\n)[ \t]*(?:>[ \t]*)?Uploaded attachments:[\s\S]*-\s+.+\(\s*image\b[\s\S]*\.codex-mobile-web[\\/]+uploads[\\/][\s\S]*\.(?:png|jpe?g|webp|gif)\b/i.test(value);
  }

  function normalizedCodexMobileUploadPath(filePath) {
    const text = String(filePath || "").trim();
    if (!text) return "";
    try {
      const resolved = path.resolve(text);
      return isCodexMobileUploadFilePath(resolved) ? normalizeFsPath(resolved) : "";
    } catch (_) {
      return "";
    }
  }

  function uploadedImagePathsFromText(text) {
    const paths = [];
    for (const line of String(text || "").split(/\r?\n/)) {
      if (!/\bimage\b/i.test(line)) continue;
      const match = /:\s*(.+?)\s*$/.exec(line);
      const normalized = normalizedCodexMobileUploadPath(match && match[1]);
      if (normalized) paths.push(normalized);
    }
    return paths;
  }

  function userMessageUploadedImagePaths(item) {
    const paths = [
      ...uploadedImagePathsFromText(item && item.text),
      ...uploadedImagePathsFromText(item && item.message),
    ];
    for (const part of userMessageContentParts(item)) {
      paths.push(...uploadedImagePathsFromText(textValueForUserMessagePart(part)));
      const imagePath = part && (part.path || imageUrlValueForUserMessagePart(part));
      const normalized = normalizedCodexMobileUploadPath(imagePath);
      if (normalized) paths.push(normalized);
    }
    return paths;
  }

  function userMessageHasVisualAttachment(item) {
    if (!isUserQuestionItem(item)) return false;
    if (textContainsRenderableUploadSummary(item.text) || textContainsRenderableUploadSummary(item.message)) return true;
    return userMessageContentParts(item).some((part) => {
      if (isImageUserMessagePart(part)) return true;
      return textContainsRenderableUploadSummary(textValueForUserMessagePart(part));
    });
  }

  function isAssistantReceiptItem(item) {
    if (!item || typeof item !== "object") return false;
    const type = String(item.type || "").toLowerCase();
    if (type === "agentmessage" || type === "plan") return true;
    if (type === "message") {
      const role = String(item.role || item.author || "").toLowerCase();
      return role === "assistant";
    }
    return false;
  }

  function isTurnUsageSummaryItem(item) {
    return Boolean(item && typeof item === "object" && item.type === "turnUsageSummary");
  }

  function isTurnDiagnosticItem(item) {
    return Boolean(item && typeof item === "object" && item.type === "turnDiagnostic");
  }

  function isVisualReceiptItem(item) {
    return Boolean(item && typeof item === "object" && (item.type === "imageView" || item.type === "imageGeneration"));
  }

  function imageViewUploadSourcePath(item) {
    if (!isVisualReceiptItem(item)) return "";
    return normalizedCodexMobileUploadPath(imageViewSourcePath(item));
  }

  function imageViewCallId(item) {
    return String(item && (
      item.callId
      || item.call_id
      || item.toolCallId
      || item.tool_call_id
      || item.arguments && (item.arguments.callId || item.arguments.call_id || item.arguments.toolCallId || item.arguments.tool_call_id)
      || item.result && (item.result.callId || item.result.call_id || item.result.toolCallId || item.result.tool_call_id)
    ) || "").trim();
  }

  function fsPathDisplayBasename(value) {
    const normalized = String(value || "").trim().replace(/\\/g, "/").replace(/\/+$/, "");
    return normalized ? normalized.split("/").pop().toLowerCase() : "";
  }

  function imageViewDisplayBasename(item) {
    const source = imageViewSourcePath(item)
      || item && (item.fileName || item.file_name || item.label || item.caption || item.name || item.id);
    return fsPathDisplayBasename(source);
  }

  function visualReceiptSuppressionKeys(item) {
    if (!isVisualReceiptItem(item)) return [];
    const keys = new Set();
    const id = String(item && item.id || "").trim();
    const callId = imageViewCallId(item);
    const displayBasename = imageViewDisplayBasename(item);
    if (id) keys.add(`id:${id}`);
    if (callId) keys.add(`call:${callId}`);
    if (displayBasename) keys.add(`name:${displayBasename}`);
    return [...keys];
  }

  function suppressedUploadViewImageCallIdSet(options = {}) {
    const value = options.suppressedUploadViewImageCallIds;
    if (value instanceof Set) return value;
    if (Array.isArray(value)) return new Set(value.map((entry) => String(entry || "").trim()).filter(Boolean));
    return new Set();
  }

  function isUploadImageEchoReceipt(item, uploadBasenames, suppressedCallIds) {
    if (!isVisualReceiptItem(item)) return false;
    const callId = imageViewCallId(item);
    if (callId && suppressedCallIds.has(callId)) return true;
    const displayBasename = imageViewDisplayBasename(item);
    return Boolean(displayBasename && uploadBasenames.has(displayBasename));
  }

  function uploadImageEchoContextForTurnItems(items, options = {}) {
    const userUploadPaths = new Set();
    const uploadBasenames = new Set();
    for (const item of items) {
      if (!isUserQuestionItem(item)) continue;
      for (const uploadPath of userMessageUploadedImagePaths(item)) {
        userUploadPaths.add(uploadPath);
        const basename = fsPathDisplayBasename(uploadPath);
        if (basename) uploadBasenames.add(basename);
      }
    }
    return {
      userUploadPaths,
      uploadBasenames,
      suppressedCallIds: suppressedUploadViewImageCallIdSet(options),
    };
  }

  function shouldSuppressUploadImageEchoItem(item, context) {
    if (!context || !context.userUploadPaths || !context.userUploadPaths.size) return false;
    const imagePath = imageViewUploadSourcePath(item);
    if (imagePath && context.userUploadPaths.has(imagePath)) return true;
    return isUploadImageEchoReceipt(item, context.uploadBasenames, context.suppressedCallIds);
  }

  function uploadImageEchoSuppressionKeysForTurnItems(items, options = {}) {
    if (!Array.isArray(items)) return [];
    const context = uploadImageEchoContextForTurnItems(items, options);
    if (!context.userUploadPaths.size) return [];
    const keys = new Set();
    for (const callId of context.suppressedCallIds) {
      if (callId) keys.add(`call:${callId}`);
    }
    for (const item of items) {
      if (!shouldSuppressUploadImageEchoItem(item, context)) continue;
      visualReceiptSuppressionKeys(item).forEach((key) => keys.add(key));
    }
    return [...keys].sort();
  }

  function filterDuplicateUploadImageViewsInTurnItems(items, options = {}) {
    if (!Array.isArray(items) || items.length < 2) return items;
    const context = uploadImageEchoContextForTurnItems(items, options);
    if (!context.userUploadPaths.size) return items;
    return items.filter((item) => {
      return !shouldSuppressUploadImageEchoItem(item, context);
    });
  }

  function receiptOnlyItemIndexes(items) {
    return threadTurnCompactionPolicyService.receiptOnlyItemIndexes(items);
  }

  function isEndedTurn(turn) {
    return threadTurnCompactionPolicyService.isEndedTurn(turn);
  }

  function findPreviousEndedTurnIndex(turns, startIndex) {
    return threadTurnCompactionPolicyService.findPreviousEndedTurnIndex(turns, startIndex);
  }

  function turnHasVisibleDetailItems(turn) {
    return threadTurnCompactionPolicyService.turnHasVisibleDetailItems(turn);
  }

  function findPreviousVisibleNonLiveTurnIndex(turns, startIndex) {
    return threadTurnCompactionPolicyService.findPreviousVisibleNonLiveTurnIndex(turns, startIndex);
  }

  function operationDetailTurnIndexes(turns) {
    return threadTurnCompactionPolicyService.operationDetailTurnIndexes(turns);
  }

  function compactTurn(turn, options = {}) {
    if (!turn || typeof turn !== "object") return turn;
    const out = Object.assign({}, turn);
    if (Array.isArray(out.items)) {
      const suppressedVisualReceiptKeys = uploadImageEchoSuppressionKeysForTurnItems(out.items, options);
      if (suppressedVisualReceiptKeys.length) out.mobileSuppressedVisualReceiptKeys = suppressedVisualReceiptKeys;
      else delete out.mobileSuppressedVisualReceiptKeys;
      const sourceItems = filterDuplicateUploadImageViewsInTurnItems(out.items, options);
      const allowOperation = Boolean(options.allowOperations)
        || (Boolean(options.allowLiveOperation) && isLiveTurn(out));
      const operationIndexes = trailingOperationIndexes(
        sourceItems,
        allowOperation,
        options.maxOperationItems || MAX_LIVE_OPERATION_ITEMS,
      );
      const receiptIndexes = options.receiptOnly ? receiptOnlyItemIndexes(sourceItems) : null;
      out.items = sourceItems.map((item) => compactItem(item, options)).filter((item, index) => {
        if (receiptIndexes) return receiptIndexes.has(index);
        if (!isOperationalItem(item)) return true;
        return operationIndexes.has(index);
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

  function compactThread(thread, options = {}) {
    if (!thread || typeof thread !== "object") return thread;
    const out = Object.assign({}, thread);
    const rolloutPath = rolloutPathForThread(out);
    const rolloutStats = rolloutStatsForPath(rolloutPath);
    const maxTurns = Math.max(1, Math.min(200, Number(options.maxTurns || MAX_THREAD_TURNS)));
    if (Array.isArray(out.turns)) {
      pendingSteerEchoStore.injectIntoThread(out);
      reconcileThreadActiveTurnWithRolloutEvidence(out, options);
      normalizeSupersededLiveTurns(out);
      pruneSupersededLiveShellTurns(out);
      appendMissingRolloutCompletionTurnsToThread(out);
      const omitted = Math.max(0, out.turns.length - maxTurns);
      if (omitted > 0) {
        out.mobileOmittedTurnCount = omitted;
        out.turns = out.turns.slice(-maxTurns);
        out.mobileOlderTurnsCursor = olderTurnsCursorBeforeTurn(out.turns[0]);
      }
      enrichThreadItemTimestampsFromRollout(out);
      const toolOutputImagePayload = readRolloutToolOutputImageItems(rolloutPath, {
        threadId: out.id || out.threadId || "",
      });
      appendRolloutToolOutputImagesToThread(out, toolOutputImagePayload);
      appendRolloutFinalReceiptsToThread(out);
      appendRolloutEmptyCompletionDiagnosticsToThread(out);
      attachTurnUsageSummaries(out, readRolloutTurnUsageSummaries(rolloutPath, {
        targetTurnIds: out.turns.map((turn) => turn && turn.id).filter(Boolean),
      }), {
        rolloutStats,
        workspaceContextStats: workspaceContextStatsForCwd(out.cwd),
      });
      const operationDetailIndexes = operationDetailTurnIndexes(out.turns);
      for (const index of operationDetailIndexes) {
        mergeRecentRawOperationsIntoTurn(out, out.turns[index], { maxOperations: 50, allowNewOperations: true });
      }
      const latestIndex = out.turns.length - 1;
      out.turns = out.turns.map((turn, index) => compactTurn(turn, {
        allowOperations: operationDetailIndexes.has(index) && !turnHasSyntheticProgressMessages(turn),
        maxOperationItems: operationDetailIndexes.has(index) && !turnHasSyntheticProgressMessages(turn) ? "all" : MAX_LIVE_OPERATION_ITEMS,
        receiptOnly: !operationDetailIndexes.has(index),
        threadId: out.id || out.threadId || "",
        suppressedUploadViewImageCallIds: toolOutputImagePayload.suppressedUploadViewImageCallIdsByTurn instanceof Map
          ? toolOutputImagePayload.suppressedUploadViewImageCallIdsByTurn.get(String(turn && turn.id || "")) || new Set()
          : new Set(),
      })).map(inferTurnItemDisplayTimestamps).map(orderTurnItemsByDisplayTimestamp);
      const latest = out.turns[latestIndex];
      if (latest && isLiveTurn(latest) && Array.isArray(latest.items)
        && !latest.items.some((item) => isOperationalItem(item))) {
        const rawOperation = readLatestRawOperation(out, latest.id, { includeCompleted: true });
        if (rawOperation) latest.items.push(rawOperation);
      }
      dedupeUserMessageEchoesInThread(out);
    }
    return normalizeStaleContextOnlyActiveThread(annotateThreadRolloutStats(out), options);
  }

  function compactThreadReadResult(result, options = {}) {
    if (!result || typeof result !== "object") return result;
    const out = Object.assign({}, result);
    if (out.thread) out.thread = compactThread(out.thread, options);
    return out;
  }

  function compactTurnsListResult(result, options = {}) {
    if (!result || typeof result !== "object") return result;
    const out = Object.assign({}, result);
    const enrich = (turns) => {
      const threadId = String(options.threadId || "").trim();
      const summary = options.summary && typeof options.summary === "object" ? options.summary : {};
      const thread = Object.assign({}, summary, { id: threadId || summary.id || summary.threadId || "", turns });
      appendRolloutFinalReceiptsToThread(thread);
      return Array.isArray(thread.turns) ? thread.turns : turns;
    };
    if (Array.isArray(out.data)) out.data = enrich(out.data).map((turn) => compactTurn(turn, { receiptOnly: true }));
    if (Array.isArray(out.turns)) out.turns = enrich(out.turns).map((turn) => compactTurn(turn, { receiptOnly: true }));
    return out;
  }

  function olderTurnsCursorBeforeTurn(turn) {
    const turnId = String(turn && turn.id || turn && turn.turnId || "").trim();
    if (!turnId) return null;
    return JSON.stringify({ turnId, includeAnchor: false });
  }

  return {
    collectFileNames,
    compactItem,
    compactItemTimestampFields,
    compactOperationalItem,
    compactThread,
    compactThreadReadResult,
    compactTurn,
    compactTurnsListResult,
    contextCompactionMobileState,
    contextCompactionNotice,
    filterDuplicateUploadImageViewsInTurnItems,
    findPreviousEndedTurnIndex,
    findPreviousVisibleNonLiveTurnIndex,
    imageViewCallId,
    imageViewDisplayBasename,
    imageViewUploadSourcePath,
    isAssistantReceiptItem,
    isContextCompactionType,
    isEndedTurn,
    isImageUserMessagePart,
    isOperationalItem,
    isTurnDiagnosticItem,
    isTurnUsageSummaryItem,
    isUploadImageEchoReceipt,
    isUserQuestionItem,
    isUserVisibleInputItem,
    isVisualReceiptItem,
    isWebSearchLikeItem,
    olderTurnsCursorBeforeTurn,
    operationDetailTurnIndexes,
    receiptOnlyItemIndexes,
    readLatestRawOperation,
    readRecentRawOperations,
    shouldSuppressUploadImageEchoItem,
    trailingOperationIndexes,
    uploadImageEchoSuppressionKeysForTurnItems,
    userMessageHasVisualAttachment,
    userMessageUploadedImagePaths,
    visualReceiptSuppressionKeys,
  };
}

module.exports = {
  createThreadDetailCompactionService,
};
