"use strict";

function stringValue(value) {
  return String(value || "").trim();
}

function defaultShortIdentifier(value) {
  const text = stringValue(value);
  if (text.length <= 12) return text;
  return `${text.slice(0, 8)}...${text.slice(-4)}`;
}

function defaultTruncateTail(value, maxChars) {
  const text = String(value || "");
  if (!maxChars || text.length <= maxChars) return text;
  return text.slice(Math.max(0, text.length - maxChars));
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms || 0))));
}

function defaultTurnIdFromStartResult(result) {
  return stringValue(
    (result && result.turnId)
      || (result && result.id)
      || (result && result.turn && result.turn.id),
  );
}

function defaultTextFromItem(item) {
  if (!item || typeof item !== "object") return "";
  return stringValue(item.text || item.message || item.content || item.summary || item.output);
}

function defaultCompletedStatus(status) {
  const text = typeof status === "string"
    ? status
    : stringValue(status && (status.type || status.status || status.state));
  return /^(completed|succeeded|success|done)$/i.test(text);
}

function createThreadSideChatOrchestrationService(options = {}) {
  const threadSideChatService = options.threadSideChatService || null;
  const codex = options.codex || null;
  const inflight = options.inflight || new Map();
  const logger = options.logger || console;
  const replyTimeoutMs = Math.max(1000, Number(options.replyTimeoutMs || 180_000));
  const threadDetailRpcTimeoutMs = Math.max(1000, Number(options.threadDetailRpcTimeoutMs || 6000));
  const mutationRpcTimeoutMs = Math.max(1000, Number(options.mutationRpcTimeoutMs || 120_000));
  const sleep = typeof options.sleep === "function" ? options.sleep : defaultSleep;
  const truncateTail = typeof options.truncateTail === "function" ? options.truncateTail : defaultTruncateTail;
  const shortIdentifier = typeof options.shortIdentifier === "function" ? options.shortIdentifier : defaultShortIdentifier;
  const readOnlySandboxPolicy = typeof options.readOnlySandboxPolicy === "function"
    ? options.readOnlySandboxPolicy
    : (value) => value || null;
  const applyStartThreadRuntimeSettings = typeof options.applyStartThreadRuntimeSettings === "function"
    ? options.applyStartThreadRuntimeSettings
    : (params) => Object.assign({}, params);
  const applyResumeRuntimeSettings = typeof options.applyResumeRuntimeSettings === "function"
    ? options.applyResumeRuntimeSettings
    : (params) => Object.assign({}, params);
  const applyTurnRuntimeSettings = typeof options.applyTurnRuntimeSettings === "function"
    ? options.applyTurnRuntimeSettings
    : (params) => Object.assign({}, params);
  const resolveThreadRuntimeSettings = typeof options.resolveThreadRuntimeSettings === "function"
    ? options.resolveThreadRuntimeSettings
    : async () => ({});
  const readStartThreadDeveloperInstructions = typeof options.readStartThreadDeveloperInstructions === "function"
    ? options.readStartThreadDeveloperInstructions
    : () => "";
  const readThreadSummary = typeof options.readThreadSummary === "function"
    ? options.readThreadSummary
    : (threadId) => ({ id: threadId });
  const threadIdFromStartResult = typeof options.threadIdFromStartResult === "function"
    ? options.threadIdFromStartResult
    : (result) => stringValue(result && (result.threadId || result.id || result.thread && result.thread.id));
  const turnIdFromStartResult = typeof options.turnIdFromStartResult === "function"
    ? options.turnIdFromStartResult
    : defaultTurnIdFromStartResult;
  const rememberStartedThread = typeof options.rememberStartedThread === "function"
    ? options.rememberStartedThread
    : () => {};
  const itemText = typeof options.itemText === "function" ? options.itemText : defaultTextFromItem;
  const isAssistantReceiptItem = typeof options.isAssistantReceiptItem === "function"
    ? options.isAssistantReceiptItem
    : (item) => Boolean(item && /assistant|agent|plan/i.test(String(item.type || item.role || "")));
  const isCompletedStatus = typeof options.isCompletedStatus === "function"
    ? options.isCompletedStatus
    : defaultCompletedStatus;
  const eventThreadId = typeof options.eventThreadId === "function" ? options.eventThreadId : () => "";
  const eventTurnId = typeof options.eventTurnId === "function" ? options.eventTurnId : () => "";
  const isOldTurnEvent = typeof options.isOldTurnEvent === "function" ? options.isOldTurnEvent : () => false;

  function assertConfigured() {
    if (!threadSideChatService) throw new Error("thread_side_chat_service_missing");
    if (!codex || typeof codex.request !== "function") throw new Error("codex_client_missing");
  }

  function sideChatReadOnlyRuntimeSettings(runtimeSettings) {
    const next = Object.assign({}, runtimeSettings || {});
    next.approvalPolicy = "on-request";
    next.permissionProfile = null;
    next.sandboxPolicy = readOnlySandboxPolicy(next.sandboxPolicy);
    next.sandboxMode = "read-only";
    return next;
  }

  function sideChatParentSummary(threadId) {
    return readThreadSummary(threadId) || { id: threadId };
  }

  function boundedSideChatTranscript(sideChat, maxChars = 12_000) {
    const messages = Array.isArray(sideChat && sideChat.messages) ? sideChat.messages.slice(-24) : [];
    const lines = messages.map((message) => {
      const role = String(message && message.role || "user") === "assistant" ? "Assistant" : "User";
      return `${role}: ${String(message && message.text || "").trim()}`;
    }).filter((line) => line.trim());
    return truncateTail(lines.join("\n\n"), maxChars, "side-chat transcript");
  }

  function parentTurnVisibleText(turn) {
    const items = Array.isArray(turn && turn.items) ? turn.items : [];
    return items.map((item) => {
      if (!item || typeof item !== "object") return "";
      const type = String(item.type || "").toLowerCase();
      const role = type === "usermessage" || (type === "message" && String(item.role || "").toLowerCase() === "user")
        ? "User"
        : isAssistantReceiptItem(item)
          ? "Assistant"
          : "";
      if (!role) return "";
      const text = itemText(item);
      return text ? `${role}: ${text}` : "";
    }).filter(Boolean).join("\n");
  }

  async function parentThreadSideChatContext(parentThreadId) {
    assertConfigured();
    try {
      const turnsResult = await codex.request("thread/turns/list", {
        threadId: parentThreadId,
        limit: 6,
        sortDirection: "desc",
      }, { timeoutMs: threadDetailRpcTimeoutMs, retry: false, resetOnTimeout: false });
      const turns = Array.isArray(turnsResult && turnsResult.data)
        ? turnsResult.data
        : Array.isArray(turnsResult && turnsResult.turns)
          ? turnsResult.turns
          : [];
      const lines = turns.slice().reverse().map(parentTurnVisibleText).filter(Boolean);
      return truncateTail(lines.join("\n\n"), 16_000, "parent thread context");
    } catch (err) {
      return `Parent thread context unavailable: ${String(err && err.message || err).slice(0, 300)}`;
    }
  }

  function sideChatDeveloperInstructions(parentThreadId) {
    return [
      "You are the private side chat for a Codex Mobile thread.",
      "Answer the user's planning, status, explanation, and option-comparison questions using the current repository context and tools when useful.",
      "Do not edit files, apply patches, commit, deploy, restart services, or mutate external state from this side chat.",
      "If the user asks for an implementation instruction, produce a concise candidate instruction they can explicitly send to the main thread.",
      "Do not claim that your answer has been injected into the main thread.",
      `Parent thread id: ${parentThreadId}`,
    ].join("\n");
  }

  function sideChatPrompt({ parentThreadId, parentSummary, parentContext, sideChat, userMessage }) {
    const title = stringValue(parentSummary && (parentSummary.name || parentSummary.title || parentSummary.preview) || parentThreadId);
    const cwd = stringValue(parentSummary && parentSummary.cwd);
    const model = stringValue(parentSummary && (parentSummary.model || parentSummary.modelName));
    const transcript = boundedSideChatTranscript(sideChat);
    return [
      "Side chat request.",
      "",
      "Parent thread context:",
      `- thread_id: ${parentThreadId}`,
      title ? `- title: ${title}` : "",
      cwd ? `- cwd: ${cwd}` : "",
      model ? `- model: ${model}` : "",
      "",
      parentContext ? `Recent parent-thread context:\n${parentContext}` : "Recent parent-thread context: (empty or unavailable)",
      "",
      transcript ? `Recent side-chat transcript:\n${transcript}` : "Recent side-chat transcript: (empty)",
      "",
      "Current user side-chat message:",
      stringValue(userMessage && userMessage.text),
      "",
      "Reply only in the side chat. Keep code-changing actions as recommendations unless the user later applies a candidate to the main thread.",
    ].filter((line) => line !== "").join("\n");
  }

  async function ensureSideChatSidecarThread(parentThreadId, runtimeSettings, parentSummary) {
    assertConfigured();
    const existing = threadSideChatService.sidecarThreadIdForThread(parentThreadId);
    if (existing) return existing;
    const cwd = stringValue(parentSummary && parentSummary.cwd);
    if (!cwd) throw new Error("side_chat_parent_workspace_missing");
    const settings = sideChatReadOnlyRuntimeSettings(runtimeSettings);
    const startParams = applyStartThreadRuntimeSettings({
      cwd,
      modelProvider: null,
      config: {},
      developerInstructions: [
        readStartThreadDeveloperInstructions(cwd) || "",
        sideChatDeveloperInstructions(parentThreadId),
      ].filter(Boolean).join("\n\n"),
      personality: null,
      ephemeral: null,
      dynamicTools: null,
      mockExperimentalField: null,
      experimentalRawEvents: false,
      persistExtendedHistory: false,
    }, settings);
    startParams.sandbox = "read-only";
    delete startParams.permissionProfile;
    const startResult = await codex.request("thread/start", startParams, {
      timeoutMs: mutationRpcTimeoutMs,
      retry: false,
    });
    const sidecarThreadId = threadIdFromStartResult(startResult);
    if (!sidecarThreadId) throw new Error("side_chat_sidecar_thread_start_failed");
    await threadSideChatService.setSidecarThreadId(parentThreadId, sidecarThreadId);
    rememberStartedThread({
      id: sidecarThreadId,
      name: `Side chat for ${shortIdentifier(parentThreadId)}`,
      preview: "Codex Mobile side chat",
      cwd,
      status: { type: "notLoaded" },
      agentRole: "side_chat",
      agentNickname: "Side chat",
    });
    return sidecarThreadId;
  }

  function textFromAssistantItem(item) {
    if (!isAssistantReceiptItem(item)) return "";
    const value = item && (item.text || item.message || item.content || item.summary || item.output || "");
    if (Array.isArray(value)) {
      return value.map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object") return String(entry.text || entry.content || entry.value || "");
        return "";
      }).filter(Boolean).join("\n").trim();
    }
    return String(value || "").trim();
  }

  async function assistantTextForTurn(threadId, turnId) {
    assertConfigured();
    const result = await codex.request("thread/turns/list", {
      threadId,
      limit: 6,
      sortDirection: "desc",
    }, { timeoutMs: threadDetailRpcTimeoutMs, retry: false, resetOnTimeout: false });
    const turns = Array.isArray(result && result.data)
      ? result.data
      : Array.isArray(result && result.turns)
        ? result.turns
        : [];
    const turn = turns.find((entry) => entry && String(entry.id || "") === String(turnId || "")) || turns[0];
    const items = Array.isArray(turn && turn.items) ? turn.items : [];
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const text = textFromAssistantItem(items[index]);
      if (text) return text;
    }
    return "";
  }

  async function waitForSideChatReply(threadId, turnId) {
    const deadline = Date.now() + replyTimeoutMs;
    const id = stringValue(turnId);
    let lastError = "";
    while (Date.now() < deadline) {
      try {
        const result = await codex.request("thread/turns/list", {
          threadId,
          limit: 6,
          sortDirection: "desc",
        }, { timeoutMs: threadDetailRpcTimeoutMs, retry: false, resetOnTimeout: false });
        const turns = Array.isArray(result && result.data)
          ? result.data
          : Array.isArray(result && result.turns)
            ? result.turns
            : [];
        const turn = turns.find((entry) => entry && String(entry.id || "") === id);
        if (turn && isCompletedStatus(turn.status)) {
          const text = await assistantTextForTurn(threadId, turnId);
          if (text) return text;
        }
      } catch (err) {
        lastError = err.message || String(err);
        if (/no rollout found|not found|not materialized|unmaterialized/i.test(lastError)) {
          await sleep(1000);
          continue;
        }
      }
      await sleep(1000);
    }
    throw new Error(lastError || "side_chat_reply_timeout");
  }

  function startAssistantReply(parentThreadId, userMessage) {
    const userMessageId = stringValue(userMessage && userMessage.id);
    if (!parentThreadId || !userMessageId) return null;
    const key = `${parentThreadId}:${userMessageId}`;
    if (inflight.has(key)) return inflight.get(key);
    const promise = (async () => {
      try {
        assertConfigured();
        const parentSummary = sideChatParentSummary(parentThreadId);
        const runtimeSettings = await resolveThreadRuntimeSettings(parentThreadId);
        const sidecarThreadId = await ensureSideChatSidecarThread(parentThreadId, runtimeSettings, parentSummary);
        await threadSideChatService.markAssistantPending(parentThreadId, userMessageId, { sidecarThreadId });
        const settings = sideChatReadOnlyRuntimeSettings(runtimeSettings);
        try {
          await codex.request("thread/resume", applyResumeRuntimeSettings({
            threadId: sidecarThreadId,
            cwd: parentSummary && parentSummary.cwd || null,
            persistExtendedHistory: false,
          }, settings), { timeoutMs: mutationRpcTimeoutMs, retry: false });
        } catch (err) {
          if (!/already|loaded|active|no rollout found|not found|not materialized|unmaterialized/i.test(err.message || "")) throw err;
        }
        const sideChat = threadSideChatService.get(parentThreadId);
        const parentContext = await parentThreadSideChatContext(parentThreadId);
        const turnParams = applyTurnRuntimeSettings({
          threadId: sidecarThreadId,
          input: [{ type: "text", text: sideChatPrompt({ parentThreadId, parentSummary, parentContext, sideChat, userMessage }) }],
          cwd: parentSummary && parentSummary.cwd || undefined,
        }, settings);
        turnParams.sandboxPolicy = readOnlySandboxPolicy(settings.sandboxPolicy);
        const turnResult = await codex.request("turn/start", turnParams, { timeoutMs: mutationRpcTimeoutMs, retry: false });
        const turnId = turnIdFromStartResult(turnResult);
        const replyText = await waitForSideChatReply(sidecarThreadId, turnId);
        await threadSideChatService.markAssistantCompleted(parentThreadId, userMessageId, {
          text: replyText || "我没有拿到完整回复，请重试。",
        });
      } catch (err) {
        await threadSideChatService.markAssistantFailed(parentThreadId, userMessageId, err).catch(() => {});
        logger.error(`[thread side chat] reply failed thread=${shortIdentifier(parentThreadId)} message=${shortIdentifier(userMessageId)}: ${err.message || String(err)}`);
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, promise);
    return promise;
  }

  function maybeApplyQueuedThreadSideChat(method, params) {
    if (method !== "turn/completed") return false;
    const turnId = eventTurnId(params);
    if (!turnId || isOldTurnEvent(params, ["completedAt", "updatedAt"])) return false;
    const threadId = eventThreadId(params);
    if (!threadId || !threadSideChatService) return false;
    threadSideChatService.maybeApplyQueuedCandidate(threadId).catch((err) => {
      logger.error(`[thread side chat] queued apply failed thread=${shortIdentifier(threadId)} turn=${shortIdentifier(turnId)}: ${err.message || String(err)}`);
    });
    return true;
  }

  return {
    sideChatReadOnlyRuntimeSettings,
    sideChatParentSummary,
    boundedSideChatTranscript,
    parentTurnVisibleText,
    parentThreadSideChatContext,
    sideChatDeveloperInstructions,
    sideChatPrompt,
    ensureSideChatSidecarThread,
    assistantTextForTurn,
    waitForSideChatReply,
    startAssistantReply,
    maybeApplyQueuedThreadSideChat,
  };
}

module.exports = {
  createThreadSideChatOrchestrationService,
};
