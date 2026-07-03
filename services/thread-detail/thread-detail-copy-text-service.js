"use strict";

function defaultVisibleItemId(item) {
  return String((item && (item.id || item.itemId || item.item_id)) || "").trim();
}

function createThreadDetailCopyTextService(dependencies = {}) {
  const codex = dependencies.codex || null;
  const appendRolloutFinalReceiptsToThread = typeof dependencies.appendRolloutFinalReceiptsToThread === "function"
    ? dependencies.appendRolloutFinalReceiptsToThread
    : () => {};
  const visibleItemId = typeof dependencies.visibleItemId === "function"
    ? dependencies.visibleItemId
    : defaultVisibleItemId;
  const readRpcTimeoutMs = Math.max(1000, Number(dependencies.readRpcTimeoutMs || 12000));

  function textValueForUserMessagePart(part) {
    if (typeof part === "string") return part;
    if (!part || typeof part !== "object") return "";
    if (typeof part.text === "string") return part.text;
    if (typeof part.input_text === "string") return part.input_text;
    if (part.type === "input_text" && typeof part.content === "string") return part.content;
    if (typeof part.input === "string") return part.input;
    return "";
  }

  function userMessageContentParts(item) {
    return Array.isArray(item && item.content) ? item.content : [];
  }

  function copyTextFromUserMessageItem(item) {
    const values = [];
    const add = (value) => {
      const text = String(value || "").trim();
      if (text && !values.includes(text)) values.push(text);
    };
    add(item && item.text);
    add(item && item.message);
    add(item && item.input);
    add(item && item.input_text);
    if (typeof (item && item.content) === "string") add(item.content);
    for (const part of userMessageContentParts(item)) {
      add(textValueForUserMessagePart(part));
    }
    return values.join("\n\n");
  }

  function assistantReceiptText(item) {
    if (!item || typeof item !== "object") return "";
    if (typeof item.text === "string") return item.text;
    if (typeof item.message === "string") return item.message;
    if (typeof item.content === "string") return item.content;
    if (Array.isArray(item.content)) {
      return item.content
        .map((part) => {
          if (typeof part === "string") return part;
          if (!part || typeof part !== "object") return "";
          if (typeof part.text === "string") return part.text;
          if (typeof part.content === "string") return part.content;
          if (typeof part.input_text === "string") return part.input_text;
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }
    return "";
  }

  function copyTextFromThreadItem(item) {
    if (!item || typeof item !== "object") return "";
    if (item.type === "userMessage") return copyTextFromUserMessageItem(item);
    if (item.type === "agentMessage" || item.type === "plan") return assistantReceiptText(item);
    if (item.type === "turnDiagnostic") return [item.title, item.message].filter(Boolean).join("\n");
    return "";
  }

  function turnIdentifier(turn) {
    return String((turn && (turn.id || turn.turnId || turn.turn_id)) || "").trim();
  }

  function findThreadCopyText(thread, input = {}) {
    const itemId = String(input.itemId || "").trim();
    const wantedTurnId = String(input.turnId || "").trim();
    if (!thread || !Array.isArray(thread.turns) || !itemId) return null;
    for (const turn of thread.turns) {
      if (!turn || !Array.isArray(turn.items)) continue;
      const currentTurnId = turnIdentifier(turn);
      if (wantedTurnId && currentTurnId && currentTurnId !== wantedTurnId) continue;
      for (const item of turn.items) {
        if (!item || visibleItemId(item) !== itemId) continue;
        const text = copyTextFromThreadItem(item);
        if (!text) return null;
        return {
          text,
          itemId,
          turnId: currentTurnId || wantedTurnId || "",
          itemType: String(item.type || ""),
        };
      }
    }
    return null;
  }

  async function readThreadItemCopyText(threadId, input = {}) {
    if (!codex || typeof codex.request !== "function") {
      throw new Error("thread_detail_copy_text_codex_unavailable");
    }
    const result = await codex.request("thread/read", { threadId, includeTurns: true }, {
      timeoutMs: readRpcTimeoutMs,
      retry: false,
      resetOnTimeout: false,
    });
    const thread = result && result.thread;
    if (thread) appendRolloutFinalReceiptsToThread(thread);
    return findThreadCopyText(thread, input);
  }

  return {
    assistantReceiptText,
    copyTextFromThreadItem,
    copyTextFromUserMessageItem,
    findThreadCopyText,
    readThreadItemCopyText,
    textValueForUserMessagePart,
    userMessageContentParts,
  };
}

module.exports = {
  createThreadDetailCopyTextService,
};
