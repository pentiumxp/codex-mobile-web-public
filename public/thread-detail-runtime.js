"use strict";

(function attachThreadDetailRuntime(root) {
function noopString() { return ""; }
function noopFalse() { return false; }
function identityArray(value) { return Array.isArray(value) ? value : []; }

function createThreadDetailRuntime(deps = {}) {
  const {
    state = {},
    MAX_EXPANDED_VISIBLE_TURNS = 200,
    MAX_RAW_THREAD_VISIBLE_ITEMS_PER_TURN = 24,
    threadDetailStateApi = root.CodexThreadDetailState,
    threadDetailMergeStateApi = root.CodexThreadDetailMergeState,
    threadDetailV4MergeStateApi = root.CodexThreadDetailV4MergeState,
    statusText = noopString,
    normalizeFsPath = (value) => String(value || ""),
    imageUrlValue = noopString,
    isInputTextPart = noopFalse,
    inputTextValue = noopString,
    isInputImagePart = noopFalse,
    splitAttachmentSummaryText = (value) => ({ text: String(value || ""), attachments: [] }),
    canRenderImageAttachment = noopFalse,
    truncateMiddle = (value) => String(value || ""),
    isLiveTurn = noopFalse,
    isLatestTurn = noopFalse,
    latestTurnForThread = (thread) => {
      const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
      return turns.length ? turns[turns.length - 1] : null;
    },
    isLiveTurnForThread = (thread, turn) => isLiveTurn(turn, thread),
    isActiveOperationalItem = noopFalse,
    isReasoningItem = noopFalse,
    isOperationalItem = noopFalse,
    isContextCompactionItem = noopFalse,
    contextCompactionNotice = () => null,
    operationCommandText = noopString,
    operationDetailText = noopString,
    imageViewPath = noopString,
    imageViewContentUrl = noopString,
    imageViewUrl = noopString,
    isTurnComplete = noopFalse,
    isRunningStatus = noopFalse,
    isIncompleteInterruptedTurn = noopFalse,
    turnHasActiveLiveItems = noopFalse,
    isRecentlySubmittedUserMessage = noopFalse,
    sortTurnsForDisplay = identityArray,
    maxVisibleTurnsForThread = () => 10,
    numericTimestampMs = (value) => {
      const numberValue = Number(value);
      return Number.isFinite(numberValue) ? numberValue : 0;
    },
    renderContextThread = (thread = null) => thread || state.currentThread || null,
  } = deps;

  if (!threadDetailStateApi || typeof threadDetailStateApi.createThreadDetailStatePolicy !== "function") {
    throw new Error("CodexThreadDetailState policy script failed to load");
  }
  if (!threadDetailMergeStateApi || typeof threadDetailMergeStateApi.createThreadDetailMergePolicy !== "function") {
    throw new Error("CodexThreadDetailMergeState script failed to load");
  }
  if (!threadDetailV4MergeStateApi || typeof threadDetailV4MergeStateApi.createThreadDetailV4MergePolicy !== "function") {
    throw new Error("CodexThreadDetailV4MergeState script failed to load");
  }

  function liveTurnHasNonUserProgress(turn, thread = null) {
    if (!turn || !isLiveTurn(turn, thread)) return false;
    return (turn.items || []).some((item) => item
      && item.type !== "userMessage"
      && (isReasoningItem(item)
        || isOperationalItem(item)
        || isContextCompactionItem(item)
        || item.type === "agentMessage"
        || item.type === "plan"
        || item.type === "turnDiagnostic"
        || item.type === "turnUsageSummary"));
  }

  function isVisibleNonUserProgressItem(item) {
    return Boolean(item
      && item.type !== "userMessage"
      && (isReasoningItem(item)
        || isOperationalItem(item)
        || isContextCompactionItem(item)
        || item.type === "agentMessage"
        || item.type === "plan"
        || item.type === "turnDiagnostic"
        || item.type === "turnUsageSummary"));
  }

  function liveTurnHasNonUserProgressBefore(turn, index, thread = null) {
    if (!turn || !isLiveTurn(turn, thread)) return false;
    const items = Array.isArray(turn.items) ? turn.items : [];
    for (let pos = 0; pos < Math.min(index, items.length); pos += 1) {
      if (isVisibleNonUserProgressItem(items[pos])) return true;
    }
    return false;
  }

  function liveTurnHasNonUserProgressAfter(turn, index, thread = null) {
    if (!turn || !isLiveTurn(turn, thread)) return false;
    const items = Array.isArray(turn.items) ? turn.items : [];
    for (let pos = Math.max(0, index + 1); pos < items.length; pos += 1) {
      if (isVisibleNonUserProgressItem(items[pos])) return true;
    }
    return false;
  }

  function isUserVisibleTextReplyItem(item) {
    return Boolean(item
      && item.type !== "userMessage"
      && (item.type === "agentMessage"
        || item.type === "plan"
        || item.type === "turnUsageSummary"));
  }

  function liveTurnHasUserVisibleTextReplyAfter(turn, index, thread = null) {
    if (!turn || !isLiveTurn(turn, thread)) return false;
    const items = Array.isArray(turn.items) ? turn.items : [];
    for (let pos = Math.max(0, index + 1); pos < items.length; pos += 1) {
      if (isUserVisibleTextReplyItem(items[pos])) return true;
    }
    return false;
  }

  function userMessageHasVisualAttachment(item) {
    if (!item || item.type !== "userMessage") return false;
    const textValues = [];
    if (typeof item.text === "string") textValues.push(item.text);
    if (typeof item.message === "string") textValues.push(item.message);
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      if (isInputImagePart(part)) return true;
      if (isInputTextPart(part)) textValues.push(inputTextValue(part));
      if (part.path && /\.(?:png|jpe?g|webp|gif)(?:[?#].*)?$/i.test(String(part.path))) return true;
      const url = imageUrlValue(part);
      if (url && /\.(?:png|jpe?g|webp|gif)(?:[?#].*)?$/i.test(String(url))) return true;
    }
    return textValues.some((text) => splitAttachmentSummaryText(text).attachments.some((attachment) => attachment.isImage && canRenderImageAttachment(attachment)));
  }

  function shouldHideDurableLiveUserMessage(turn, item, index = 0, thread = null) {
    void turn;
    void item;
    void index;
    void thread;
    // Durable userMessage rows are user-visible evidence. Suppressing them here
    // hides legitimate just-submitted messages when projection refresh arrives
    // before the assistant reply. Projection noise must be fixed upstream.
    return false;
  }

  function durableUserMessageMatchesOptimisticEcho(durableItem, optimisticItem) {
    if (!durableItem || !optimisticItem) return false;
    if (durableItem.type !== "userMessage" || optimisticItem.type !== "userMessage") return false;
    if (isOptimisticUserMessage(durableItem) || !isOptimisticUserMessage(optimisticItem)) return false;
    return userMessagesShareSubmissionId(durableItem, optimisticItem)
      || userMessagesLikelySame(durableItem, optimisticItem);
  }

  function threadHasDurableUserMessageWithSubmissionId(thread, optimisticItem) {
    const submissionIds = userMessageSubmissionIdCandidates(optimisticItem);
    if (!submissionIds.length || !thread || !Array.isArray(thread.turns)) return false;
    return thread.turns.some((candidateTurn) => (Array.isArray(candidateTurn && candidateTurn.items) ? candidateTurn.items : [])
      .some((candidate) => candidate
        && candidate.type === "userMessage"
        && !isOptimisticUserMessage(candidate)
        && submissionIds.some((submissionId) => userMessageHasSubmissionId(candidate, submissionId))));
  }

  function threadHasDurableUserMessageMatchingOptimisticEcho(thread, optimisticItem) {
    if (!thread || !Array.isArray(thread.turns) || !isOptimisticUserMessage(optimisticItem)) return false;
    return thread.turns.some((candidateTurn) => (Array.isArray(candidateTurn && candidateTurn.items) ? candidateTurn.items : [])
      .some((candidate) => candidate
        && candidate.type === "userMessage"
        && !isOptimisticUserMessage(candidate)
        && optimisticEchoCanMatchEarlierDurable(candidate, optimisticItem)));
  }

  function shouldHideOptimisticUserMessageEcho(turn, item, index = 0, thread = null) {
    if (!item || item.type !== "userMessage" || !isOptimisticUserMessage(item)) return false;
    const items = Array.isArray(turn && turn.items) ? turn.items : [];
    const sameTurnDurableMatch = items.some((candidate, candidateIndex) => (
      candidateIndex !== index && durableUserMessageMatchesOptimisticEcho(candidate, item)
    ));
    if (sameTurnDurableMatch) return true;
    const contextThread = renderContextThread(thread);
    return threadHasDurableUserMessageWithSubmissionId(contextThread, item)
      || threadHasDurableUserMessageMatchingOptimisticEcho(contextThread, item);
  }

  function isSupersededLiveTurn(turn) {
    return Boolean(turn && (turn.mobileSupersededLive || (turn.status && turn.status.mobileSupersededLive)));
  }

  function shouldHideSupersededLiveUserMessage(turn, item) {
    return Boolean(isSupersededLiveTurn(turn) && item && item.type === "userMessage" && !userMessageHasVisualAttachment(item));
  }

  function isRawThreadReadMode(thread) {
    return Boolean(thread && (thread.mobileRawThreadRead || String(thread.mobileReadMode || "") === "thread-read-raw"));
  }

  function shouldPreserveRawThreadVisibleEntry(entry) {
    const item = entry && entry.item;
    if (!item) return false;
    return item.type === "userMessage"
      || item.type === "imageView"
      || item.type === "imageGeneration"
      || item.type === "turnUsageSummary"
      || isContextCompactionItem(item);
  }

  function itemTextValue(value) {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(itemTextValue).join("");
    return "";
  }

  function reasoningItemHasVisibleText(item) {
    return Boolean(
      itemTextValue(item && item.text).trim()
      || itemTextValue(item && item.content).trim()
      || itemTextValue(item && item.summary).trim()
    );
  }

  function isLatestCompletedProcessTurn(turn, thread = null) {
    if (!turn || !isTurnComplete(turn)) return false;
    const contextThread = renderContextThread(thread);
    const turns = Array.isArray(contextThread && contextThread.turns) ? contextThread.turns : [];
    for (let index = turns.length - 1; index >= 0; index -= 1) {
      const candidate = turns[index];
      if (!candidate || isLiveTurn(candidate, contextThread)) continue;
      if (!isTurnComplete(candidate)) continue;
      return candidate === turn;
    }
    return isLatestTurn(turn, contextThread);
  }

  function limitRawThreadVisibleEntries(entries, thread = null) {
    if (!isRawThreadReadMode(renderContextThread(thread))) return entries;
    if (!Array.isArray(entries) || entries.length <= MAX_RAW_THREAD_VISIBLE_ITEMS_PER_TURN) return entries;
    const keep = new Set();
    entries.forEach((entry, index) => {
      if (shouldPreserveRawThreadVisibleEntry(entry)) keep.add(index);
    });
    for (let index = Math.max(0, entries.length - MAX_RAW_THREAD_VISIBLE_ITEMS_PER_TURN); index < entries.length; index += 1) {
      keep.add(index);
    }
    return entries.filter((_, index) => keep.has(index));
  }

  function visibleItemsForTurn(turn, thread = null) {
    const visible = [];
    const contextEntryByKey = new Map();
    const contextThread = renderContextThread(thread);
    (turn.items || []).forEach((item, index) => {
      if (!item) return;
      if (isReasoningItem(item)) {
        return;
      }
      if (shouldHideSupersededLiveUserMessage(turn, item)) return;
      if (shouldHideOptimisticUserMessageEcho(turn, item, index, contextThread)) return;
      if (shouldHideDurableLiveUserMessage(turn, item, index, contextThread)) return;
      if (isContextCompactionItem(item)) {
        const notice = contextCompactionNotice(item, turn, contextThread);
        if (!notice) return;
        const groupKey = "context-compaction";
        const existing = contextEntryByKey.get(groupKey);
        if (existing) visible[existing.visibleIndex] = null;
        contextEntryByKey.set(groupKey, { visibleIndex: visible.length });
        visible.push({ item, sourceIndex: index });
        return;
      }
      if (isOperationalItem(item)) {
        return;
      }
      visible.push({ item, sourceIndex: index });
    });
    const filtered = visible.filter(Boolean);
    const supersededLive = isSupersededLiveTurn(turn);
    if (supersededLive && filtered.length && filtered.every((entry) => isTurnUsageSummaryItem(entry.item))) return [];
    return limitRawThreadVisibleEntries(filtered, thread);
  }

  function currentLiveOperationEntry(thread) {
    if (!thread || !Array.isArray(thread.turns) || !thread.turns.length) return null;
    let turn = null;
    for (let index = thread.turns.length - 1; index >= 0; index -= 1) {
      const candidate = thread.turns[index];
      if (isSupersededLiveTurn(candidate)) continue;
      if (isLiveTurnForThread(thread, candidate)) {
        turn = candidate;
        break;
      }
    }
    if (!turn) return null;
    const items = Array.isArray(turn.items) ? turn.items : [];
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (isActiveOperationalItem(item)) return { turn, item, sourceIndex: index };
    }
    return { turn, item: liveTurnStatusDockItem(turn), sourceIndex: -1 };
  }

  function liveTurnStatusDockItem(turn) {
    return {
      id: `live-turn-status-${turn && (turn.id || turn.startedAt || "active")}`,
      type: "liveTurnStatus",
      status: "",
      title: "Command",
    };
  }

  function visibleItemSignature(item, turn = null, thread = null) {
    if (!item || isReasoningItem(item)) return null;
    const projection = {
      mobileVisibleKey: item.mobileVisibleKey || "",
      mobileVisibleKind: item.mobileVisibleKind || "",
    };
    if (isContextCompactionItem(item)) {
      const notice = contextCompactionNotice(item, turn, thread);
      if (!notice) return null;
      return {
        ...projection,
        id: item.id || "",
        type: item.type || "",
        status: statusText(item.status),
        mobileCompactionStatus: item.mobileCompactionStatus || "",
        mobileNotice: item.mobileNotice || "",
        notice,
      };
    }
    if (isOperationalItem(item)) {
      return {
        ...projection,
        id: item.id || "",
        type: item.type || "",
        status: statusText(item.status),
        startedAtMs: item.startedAtMs || item.startedAt || item.started_at_ms || item.started_at || "",
        completedAtMs: item.completedAtMs || item.completedAt || item.completed_at_ms || item.completed_at || "",
        durationMs: item.durationMs || item.duration_ms || item.elapsedMs || item.elapsed_ms || "",
        command: operationCommandText(item),
        fileNames: Array.isArray(item.fileNames) ? item.fileNames : [],
        tool: item.tool || "",
        server: item.server || "",
        namespace: item.namespace || "",
        detail: operationDetailText(item),
      };
    }
    if (item.type === "turnUsageSummary") {
      return {
        ...projection,
        id: item.id || "",
        type: item.type || "",
        status: statusText(item.status),
        mobileUsageSummary: item.mobileUsageSummary || {},
      };
    }
    if (item.type === "turnDiagnostic") {
      return {
        ...projection,
        id: item.id || "",
        type: item.type || "",
        status: statusText(item.status),
        code: item.code || "",
        severity: item.severity || "",
        title: item.title || "",
        message: item.message || "",
        source: item.source || "",
        mobileRuntimeDiagnostic: Boolean(item.mobileRuntimeDiagnostic),
      };
    }
    if (item.type === "imageView") {
      return {
        ...projection,
        id: item.id || "",
        type: item.type || "",
        status: statusText(item.status),
        path: imageViewPath(item),
        contentUrl: imageSourceSignature(imageViewContentUrl(item)),
        url: imageSourceSignature(imageViewUrl(item)),
      };
    }
    return {
      ...projection,
      id: item.id || "",
      type: item.type || "",
      status: statusText(item.status),
      text: item.text || "",
      content: Array.isArray(item.content) ? inputContentSignature(item.content) : [],
      summary: Array.isArray(item.summary) ? item.summary : [],
      mobileNotice: item.mobileNotice || "",
    };
  }

  function visibleItemBudgetForTurn(turn) {
    if (!turn || typeof turn !== "object") return null;
    const budget = turn.mobileVisibleItemBudget && typeof turn.mobileVisibleItemBudget === "object"
      ? turn.mobileVisibleItemBudget
      : {};
    const omitted = Math.max(0, Math.trunc(Number(turn.mobileOmittedVisibleItemCount || budget.omitted || 0)));
    if (!omitted) return null;
    return {
      omitted,
      retained: Math.max(0, Math.trunc(Number(budget.retained || 0))),
      original: Math.max(0, Math.trunc(Number(budget.original || 0))),
      ceiling: Math.max(0, Math.trunc(Number(budget.ceiling || 0))),
      reason: String(budget.reason || "response-budget"),
    };
  }

  function visibleItemBudgetSignature(turn) {
    const budget = visibleItemBudgetForTurn(turn);
    if (!budget) return null;
    return budget;
  }

  function inputContentSignature(content) {
    return (content || []).map((part) => {
      if (!part || typeof part !== "object") return String(part || "");
      if (isInputTextPart(part)) return { type: "text", text: inputTextValue(part) };
      if (isInputImagePart(part)) {
        return {
          type: part.type || "image",
          path: part.path || "",
          url: imageSourceSignature(imageUrlValue(part)),
        };
      }
      return compactStructuredForSignature(part);
    });
  }

  function imageSourceSignature(value) {
    const text = String(value || "");
    if (/^data:image\//i.test(text)) return `${text.slice(0, 48)}...${text.length}`;
    return text;
  }

  function compactStructuredForSignature(value) {
    try {
      return truncateMiddle(JSON.stringify(value), 600, "payload");
    } catch (_) {
      return String(value || "");
    }
  }

  function itemVisibleWeight(item) {
    const signature = visibleItemSignature(item);
    return signature ? JSON.stringify(signature).length : 0;
  }

  function turnVisibleWeight(turn) {
    const items = turn && Array.isArray(turn.items) ? turn.items : [];
    return items.reduce((total, item) => total + itemVisibleWeight(item), 0);
  }

  function isAssistantReceiptLikeItem(item) {
    return Boolean(item && (item.type === "agentMessage" || item.type === "plan"));
  }

  function completedIncomingTurnHasAuthoritativeReceipt(incomingTurn) {
    return threadDetailStatePolicy.completedIncomingTurnHasAuthoritativeReceipt(incomingTurn);
  }

  function shouldDropLocalOnlyReceiptForIncomingTurn(item, incomingTurn = null) {
    return threadDetailStatePolicy.shouldDropLocalOnlyReceiptForIncomingTurn(item, incomingTurn);
  }

  function shouldPreserveLocalOnlyItem(item, preserveLocalVisible = false, suppressedVisualReceiptKeys = null, incomingTurn = null) {
    return threadDetailStatePolicy.shouldPreserveLocalOnlyItem(
      item,
      preserveLocalVisible,
      suppressedVisualReceiptKeys,
      incomingTurn,
    );
  }

  function isMuxUserMessage(item) {
    return Boolean(item && item.type === "userMessage" && /^mux-user-/.test(String(item.id || "")));
  }

  function isOptimisticUserMessage(item) {
    return Boolean(item && item.type === "userMessage" && (item.mobilePendingSubmission || /^local-user-/.test(String(item.id || "")) || isMuxUserMessage(item)));
  }

  function userMessageSubmissionIdCandidates(item) {
    if (!item || item.type !== "userMessage") return [];
    const values = [];
    const pushCandidate = (value) => {
      const text = String(value || "").trim();
      if (text) values.push(text);
    };
    pushCandidate(item.clientSubmissionId);
    pushCandidate(item.clientId);
    pushCandidate(item.client_id);
    pushCandidate(item.submissionId);
    pushCandidate(item.submission_id);
    pushCandidate(item.mobileSubmissionId);
    pushCandidate(item.mobile_submission_id);
    const local = String(item.id || "").match(/^local-user-(.+)$/);
    if (local && local[1]) pushCandidate(local[1]);
    return [...new Set(values)];
  }

  function userMessageHasSubmissionId(item, submissionId) {
    const value = String(submissionId || "").trim();
    if (!value || !item || item.type !== "userMessage") return false;
    if (userMessageSubmissionIdCandidates(item).includes(value)) return true;
    const id = String(item.id || "");
    return Boolean(id && id.endsWith(`-${value}`));
  }

  function userMessagesShareSubmissionId(left, right) {
    const leftValues = userMessageSubmissionIdCandidates(left);
    const rightValues = userMessageSubmissionIdCandidates(right);
    return leftValues.some((value) => userMessageHasSubmissionId(right, value))
      || rightValues.some((value) => userMessageHasSubmissionId(left, value));
  }

  function isTurnUsageSummaryItem(item) {
    return Boolean(item && item.type === "turnUsageSummary");
  }

  function isTurnDiagnosticItem(item) {
    return Boolean(item && item.type === "turnDiagnostic");
  }

  function dedupeTurnUsageSummaryItems(items) {
    if (!Array.isArray(items)) return [];
    let lastSummaryIndex = -1;
    items.forEach((item, index) => {
      if (isTurnUsageSummaryItem(item)) lastSummaryIndex = index;
    });
    if (lastSummaryIndex < 0) return items;
    return items.filter((item, index) => !isTurnUsageSummaryItem(item) || index === lastSummaryIndex);
  }

  function normalizeComparableText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function userMessageComparableParts(item) {
    const result = { text: "", paths: [] };
    if (!item || item.type !== "userMessage") return result;
    const textParts = [];
    const paths = [];
    if (typeof item.text === "string") textParts.push(item.text);
    if (typeof item.message === "string") textParts.push(item.message);
    const contentParts = Array.isArray(item.content)
      ? item.content
      : (typeof item.content === "string" ? [{ type: "text", text: item.content }] : []);
    for (const part of contentParts) {
      if (!part || typeof part !== "object") continue;
      if (isInputTextPart(part)) {
        const split = splitAttachmentSummaryText(inputTextValue(part));
        if (split.text) textParts.push(split.text);
        for (const attachment of split.attachments) {
          if (attachment.path) paths.push(normalizeFsPath(attachment.path));
        }
        continue;
      }
      if (part.path) paths.push(normalizeFsPath(part.path));
      else if (isInputImagePart(part)) {
        const url = imageUrlValue(part);
        if (url && !/^data:image\//i.test(url)) paths.push(normalizeFsPath(url));
      }
    }
    result.text = normalizeComparableText(textParts.join("\n"));
    result.paths = [...new Set(paths.filter(Boolean))].sort();
    return result;
  }

  function userMessagePathOverlap(left, right) {
    return left.paths.length > 0 && right.paths.length > 0
      && left.paths.some((pathValue) => right.paths.includes(pathValue));
  }

  function comparablePathName(pathValue) {
    const text = String(pathValue || "").split(/[?#]/)[0];
    const parts = normalizeFsPath(text).split("\\").filter(Boolean);
    return parts[parts.length - 1] || "";
  }

  function userMessagePathNameOverlap(left, right) {
    if (!left.paths.length || !right.paths.length) return false;
    const leftNames = new Set(left.paths.map(comparablePathName).filter(Boolean));
    if (!leftNames.size) return false;
    return right.paths.some((pathValue) => {
      const rightName = comparablePathName(pathValue);
      return rightName && Array.from(leftNames).some((leftName) => comparablePathNamesLikelySame(leftName, rightName));
    });
  }

  function comparablePathNamesLikelySame(leftName, rightName) {
    const left = String(leftName || "");
    const right = String(rightName || "");
    if (!left || !right) return false;
    if (left === right) return true;
    return left.endsWith(`-${right}`) || right.endsWith(`-${left}`);
  }

  function isVisualReceiptItem(item) {
    return Boolean(item && (item.type === "imageView" || item.type === "imageGeneration"));
  }

  function visualReceiptComparableNames(item) {
    if (!isVisualReceiptItem(item)) return [];
    const values = [
      imageViewPath(item),
      imageViewContentUrl(item),
      imageViewUrl(item),
      item.fileName,
      item.file_name,
      item.label,
      item.caption,
      item.name,
    ];
    return [...new Set(values.map(comparablePathName).filter(Boolean))];
  }

  function visualReceiptCallId(item) {
    return String(item && (
      item.callId
      || item.call_id
      || item.toolCallId
      || item.tool_call_id
      || item.arguments && (item.arguments.callId || item.arguments.call_id || item.arguments.toolCallId || item.arguments.tool_call_id)
      || item.result && (item.result.callId || item.result.call_id || item.result.toolCallId || item.result.tool_call_id)
    ) || "").trim();
  }

  function visualReceiptSuppressionKeys(item) {
    if (!isVisualReceiptItem(item)) return [];
    const keys = new Set();
    const id = String(item && item.id || "").trim();
    const callId = visualReceiptCallId(item);
    if (id) keys.add(`id:${id}`);
    if (callId) keys.add(`call:${callId}`);
    for (const name of visualReceiptComparableNames(item)) {
      keys.add(`name:${name}`);
    }
    return [...keys];
  }

  function suppressedVisualReceiptKeySet(turn) {
    const values = Array.isArray(turn && turn.mobileSuppressedVisualReceiptKeys)
      ? turn.mobileSuppressedVisualReceiptKeys
      : [];
    return new Set(values.map((entry) => String(entry || "").trim()).filter(Boolean));
  }

  function visualReceiptMatchesSuppressionKeys(item, suppressedVisualReceiptKeys) {
    if (!isVisualReceiptItem(item) || !suppressedVisualReceiptKeys || !suppressedVisualReceiptKeys.size) return false;
    return visualReceiptSuppressionKeys(item).some((key) => suppressedVisualReceiptKeys.has(key));
  }

  function userMessageSpecificity(item) {
    const parts = userMessageComparableParts(item);
    return parts.text.length + (parts.paths.length * 240);
  }

  function userMessagesLikelySame(left, right) {
    if (!left || !right || left.type !== "userMessage" || right.type !== "userMessage") return false;
    const a = userMessageComparableParts(left);
    const b = userMessageComparableParts(right);
    if (a.text && b.text && a.text === b.text) {
      if (isOptimisticUserMessage(left) || isOptimisticUserMessage(right)) return true;
      if (!a.paths.length && !b.paths.length) return true;
      return userMessagePathOverlap(a, b);
    }
    if ((isOptimisticUserMessage(left) || isOptimisticUserMessage(right))
      && userMessagePathNameOverlap(a, b)
      && (!a.text || !b.text || a.text === b.text)) return true;
    return userMessagePathOverlap(a, b) && (!a.text || !b.text || a.text === b.text);
  }

  function userMessagesCanShadow(left, right) {
    if (left && right && left.type === "userMessage" && right.type === "userMessage"
      && userMessagesShareSubmissionId(left, right)) {
      return true;
    }
    const leftSubmittedEcho = Boolean(String(left && left.clientSubmissionId || "").trim() && !(left && left.mobileSendError));
    const rightSubmittedEcho = Boolean(String(right && right.clientSubmissionId || "").trim() && !(right && right.mobileSendError));
    const projectionIndexId = (item) => String(item && (item.id || item.itemId || item.item_id) || "").trim().match(/^item-(\d+)$/i);
    const leftProjectionIndex = Boolean(projectionIndexId(left));
    const rightProjectionIndex = Boolean(projectionIndexId(right));
    const itemTimeMs = (item) => {
      const value = item && (
        item.startedAtMs
        || item.startedAt
        || item.createdAtMs
        || item.createdAt
        || item.timestampMs
        || item.timestamp
        || item.updatedAtMs
        || item.updatedAt
      );
      if (value === null || value === undefined || value === "") return 0;
      const numberValue = Number(value);
      if (Number.isFinite(numberValue) && numberValue > 0) {
        return numberValue > 1_000_000_000_000 ? Math.trunc(numberValue) : Math.trunc(numberValue * 1000);
      }
      const parsed = Date.parse(String(value));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };
    const leftProjectionTime = itemTimeMs(left);
    const rightProjectionTime = itemTimeMs(right);
    const projectionIndexEcho = Boolean(leftProjectionIndex && rightProjectionIndex
      && leftProjectionTime
      && rightProjectionTime
      && Math.abs(leftProjectionTime - rightProjectionTime) <= 5000);
    return Boolean(left && right
      && left.type === "userMessage"
      && right.type === "userMessage"
      && (isOptimisticUserMessage(left) || isOptimisticUserMessage(right) || leftSubmittedEcho || rightSubmittedEcho || projectionIndexEcho)
      && userMessagesLikelySame(left, right));
  }

  function userMessagesAreSameTurnDuplicateEvent(left, right) {
    if (!left || !right || left.type !== "userMessage" || right.type !== "userMessage") return false;
    if (userMessagesCanShadow(left, right)) return true;
    if (!userMessagesLikelySame(left, right)) return false;
    const leftTime = userMessageTimestampMs(left);
    const rightTime = userMessageTimestampMs(right);
    if (!leftTime || !rightTime || Math.abs(leftTime - rightTime) > 5000) return false;
    return true;
  }

  function userMessageTimestampMs(item) {
    const value = item && (
      item.startedAtMs
      || item.startedAt
      || item.createdAtMs
      || item.createdAt
      || item.timestampMs
      || item.timestamp
      || item.updatedAtMs
      || item.updatedAt
      || item.mobileDisplayTimestampMs
    );
    if (value === null || value === undefined || value === "") return 0;
    const numberValue = Number(value);
    if (Number.isFinite(numberValue) && numberValue > 0) {
      return numberValue > 1_000_000_000_000 ? Math.trunc(numberValue) : Math.trunc(numberValue * 1000);
    }
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function userMessagesHaveNearbyTimestamps(left, right, windowMs = 10 * 60 * 1000) {
    const leftMs = userMessageTimestampMs(left);
    const rightMs = userMessageTimestampMs(right);
    return Boolean(leftMs && rightMs && Math.abs(leftMs - rightMs) <= windowMs);
  }

  function isProjectionIndexUserMessage(item) {
    return Boolean(String(item && (item.id || item.itemId || item.item_id) || "").trim().match(/^item-\d+$/i));
  }

  function userMessagesAreSameEventAcrossTurns(left, right) {
    if (!left || !right || left.type !== "userMessage" || right.type !== "userMessage") return false;
    if (!userMessagesLikelySame(left, right)) return false;
    if (userMessagesShareSubmissionId(left, right)) return true;
    if (userMessagesCanShadow(left, right)) return true;
    const leftTime = userMessageTimestampMs(left);
    const rightTime = userMessageTimestampMs(right);
    if (!leftTime || !rightTime || Math.abs(leftTime - rightTime) > 5000) return false;
    return Boolean(
      isOptimisticUserMessage(left)
      || isOptimisticUserMessage(right)
      || isProjectionIndexUserMessage(left)
      || isProjectionIndexUserMessage(right)
    );
  }

  function durableTurnCanReceivePendingEcho(turn) {
    if (!turn) return false;
    const status = turn.status;
    const statusType = status && typeof status === "object"
      ? String(status.type || status.status || status.state || "")
      : String(status || "");
    if (/completed|failed|cancel|error|interrupted/i.test(statusType)) return false;
    if (/running|active|queued|processing|inprogress|in_progress|in-progress|pending|started/i.test(statusType)) return true;
    return Boolean(turn.live || turn.mobileLive || turn.mobileActiveLiveTurn || turn.mobilePendingOverlay);
  }

  function optimisticEchoCanMatchEarlierDurable(durableItem, optimisticItem, durableTurn = null) {
    if (!durableItem || !optimisticItem) return false;
    if (durableItem.type !== "userMessage" || optimisticItem.type !== "userMessage") return false;
    if (isOptimisticUserMessage(durableItem) || !isOptimisticUserMessage(optimisticItem)) return false;
    if (userMessagesShareSubmissionId(durableItem, optimisticItem)) return true;
    const durableTurnSubmissionKey = String(durableTurn && durableTurn.mobileLocalSubmissionRenderKey || "").trim();
    if (durableTurnSubmissionKey) {
      const localSubmissionRenderKey = (clientSubmissionId) => {
        const text = String(clientSubmissionId || "").trim();
        if (!text) return "";
        let hash = 2166136261;
        for (let index = 0; index < text.length; index += 1) {
          hash ^= text.charCodeAt(index);
          hash = Math.imul(hash, 16777619);
        }
        return `submitted:${(hash >>> 0).toString(36)}`;
      };
      if (userMessageSubmissionIdCandidates(optimisticItem)
        .some((submissionId) => durableTurnSubmissionKey === localSubmissionRenderKey(submissionId))) {
        return userMessagesLikelySame(durableItem, optimisticItem);
      }
    }
    const likelySameNearby = userMessagesLikelySame(durableItem, optimisticItem)
      && userMessagesHaveNearbyTimestamps(durableItem, optimisticItem);
    if (optimisticItem.mobileSendError) return likelySameNearby;
    const localPendingEcho = Boolean(
      optimisticItem.mobilePendingSubmission
      && String(optimisticItem.clientSubmissionId || "").trim()
      && /^local-user-/.test(String(optimisticItem.id || "")),
    );
    if (!localPendingEcho || !durableTurnCanReceivePendingEcho(durableTurn)) return false;
    return likelySameNearby;
  }

  function hasMatchingIncomingUserMessage(existingItem, incomingItems) {
    if (!existingItem || existingItem.type !== "userMessage") return false;
    return (incomingItems || []).some((incomingItem) => incomingItem
      && incomingItem.id !== existingItem.id
      && incomingItem.type === "userMessage"
      && userMessagesCanShadow(existingItem, incomingItem));
  }

  function hasMatchingRealUserMessage(item, items) {
    if (!isMuxUserMessage(item)) return false;
    return (items || []).some((candidate) => candidate
      && candidate.id !== item.id
      && candidate.type === "userMessage"
      && !isMuxUserMessage(candidate)
      && userMessagesCanShadow(candidate, item));
  }

  function removeShadowedMuxUserMessages(items) {
    return (items || []).filter((item) => !hasMatchingRealUserMessage(item, items));
  }

  function userMessageShadowPriority(item) {
    if (!item || item.type !== "userMessage") return 0;
    if (/^local-user-/.test(String(item.id || ""))) return 1;
    if (isMuxUserMessage(item) || item.mobilePendingSubmission || String(item.clientSubmissionId || "").trim()) return 2;
    const projectionMatch = String(item.id || item.itemId || item.item_id || "").trim().match(/^item-(\d+)$/i);
    if (projectionMatch) {
      const projectionIndex = Math.max(0, Math.min(999999, Number(projectionMatch[1]) || 0));
      return 2 + (projectionIndex / 1000000);
    }
    return 3;
  }

  function mergeLikelySameUserMessage(existingItem, incomingItem) {
    const existingPriority = userMessageShadowPriority(existingItem);
    const incomingPriority = userMessageShadowPriority(incomingItem);
    const merged = mergeItemPreservingVisibleFields(existingItem, incomingItem);
    const preferred = incomingPriority >= existingPriority ? incomingItem : existingItem;
    if (preferred && preferred.id) merged.id = preferred.id;
    if (preferred && preferred.clientSubmissionId) merged.clientSubmissionId = preferred.clientSubmissionId;
    else if (existingItem && existingItem.clientSubmissionId) merged.clientSubmissionId = existingItem.clientSubmissionId;
    else if (incomingItem && incomingItem.clientSubmissionId) merged.clientSubmissionId = incomingItem.clientSubmissionId;
    if (preferred && preferred.startedAtMs && !merged.startedAtMs) merged.startedAtMs = preferred.startedAtMs;
    if (preferred && !isOptimisticUserMessage(preferred)) {
      delete merged.mobilePendingSubmission;
      delete merged.mobileSendError;
    }
    const durableIncomingReplacesOptimistic = incomingItem
      && !isOptimisticUserMessage(incomingItem)
      && isOptimisticUserMessage(existingItem);
    if (durableIncomingReplacesOptimistic || (incomingPriority > existingPriority && incomingPriority >= 3)) {
      if (Array.isArray(incomingItem.content)) merged.content = incomingItem.content;
      if (typeof incomingItem.text === "string") merged.text = incomingItem.text;
      if (typeof incomingItem.message === "string") merged.message = incomingItem.message;
    }
    return merged;
  }

  function dedupeLikelySameUserMessages(items) {
    const out = [];
    for (const item of items || []) {
      if (item && item.type === "userMessage") {
        const existingIndex = out.findIndex((candidate) => userMessagesAreSameTurnDuplicateEvent(candidate, item));
        if (existingIndex >= 0) {
          out[existingIndex] = mergeLikelySameUserMessage(out[existingIndex], item);
          continue;
        }
      }
      out.push(item);
    }
    return out;
  }

  function normalizeThreadVisibleUserMessages(thread) {
    if (!thread || !Array.isArray(thread.turns)) return thread;
    for (const turn of thread.turns) {
      if (!turn || !Array.isArray(turn.items)) continue;
      turn.items = removeShadowedMuxUserMessages(dedupeLikelySameUserMessages(turn.items));
    }
    const userMessages = threadUserMessageEntries(thread.turns);
    const durableUserMessages = [];
    for (const entry of userMessages) {
      if (entry && entry.item && !isOptimisticUserMessage(entry.item)) durableUserMessages.push(entry);
    }
    if (!durableUserMessages.length && userMessages.length < 2) return thread;
    for (let turnIndex = 0; turnIndex < thread.turns.length; turnIndex += 1) {
      const turn = thread.turns[turnIndex];
      if (!turn || !Array.isArray(turn.items)) continue;
      turn.items = turn.items.filter((item, itemIndex) => !shouldDropOptimisticUserMessageForDurable(item, turnIndex, durableUserMessages)
        && !shouldDropOptimisticUserMessageForHigherPriorityEcho(item, turnIndex, itemIndex, userMessages)
        && !shouldDropDuplicateUserMessageEvent(item, turnIndex, itemIndex, userMessages));
    }
    return thread;
  }

  function threadUserMessageEntries(turns) {
    const entries = [];
    for (let turnIndex = 0; turnIndex < (turns || []).length; turnIndex += 1) {
      const turn = turns[turnIndex];
      const items = Array.isArray(turn && turn.items) ? turn.items : [];
      for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
        const item = items[itemIndex];
        if (item && item.type === "userMessage") entries.push({
          item,
          turn,
          turnIndex,
          itemIndex,
        });
      }
    }
    return entries;
  }

  function shouldDropOptimisticUserMessageForDurable(item, turnIndex, durableUserMessages) {
    if (!isOptimisticUserMessage(item) || !Array.isArray(durableUserMessages)) return false;
    return durableUserMessages.some((real) => {
      if (!real || !real.item || real.item.id === item.id) return false;
      if (userMessagesShareSubmissionId(real.item, item)) return true;
      if (!userMessagesCanShadow(real.item, item)) return false;
      if (real.turnIndex >= turnIndex) return true;
      if (optimisticEchoCanMatchEarlierDurable(real.item, item, real.turn)) return true;
      return userMessageHasVisualAttachment(real.item) && userMessageHasVisualAttachment(item);
    });
  }

  function shouldDropOptimisticUserMessageForHigherPriorityEcho(item, turnIndex, itemIndex, userMessages) {
    if (!isOptimisticUserMessage(item) || item.mobileSendError || !Array.isArray(userMessages)) return false;
    const itemPriority = userMessageShadowPriority(item);
    if (itemPriority <= 0 || itemPriority >= 3) return false;
    return userMessages.some((candidate) => {
      if (!candidate || !candidate.item || candidate.item === item || candidate.item.id === item.id) return false;
      if (userMessageShadowPriority(candidate.item) <= itemPriority) return false;
      const sameSubmission = userMessagesShareSubmissionId(candidate.item, item);
      if (!sameSubmission) {
        if (candidate.turnIndex < turnIndex) return false;
        if (candidate.turnIndex === turnIndex && candidate.itemIndex <= itemIndex) return false;
      }
      return userMessagesCanShadow(candidate.item, item);
    });
  }

  function shouldDropDuplicateUserMessageEvent(item, turnIndex, itemIndex, userMessages) {
    if (!item || item.type !== "userMessage" || !Array.isArray(userMessages)) return false;
    const itemHasVisualAttachment = userMessageHasVisualAttachment(item);
    const itemPriority = userMessageShadowPriority(item);
    return userMessages.some((candidate) => {
      if (!candidate || !candidate.item || candidate.item === item || candidate.item.id === item.id) return false;
      if (candidate.turnIndex < turnIndex) return false;
      if (candidate.turnIndex === turnIndex && candidate.itemIndex <= itemIndex) return false;
      const sameSubmission = userMessagesShareSubmissionId(candidate.item, item);
      if ((itemHasVisualAttachment || userMessageHasVisualAttachment(candidate.item)) && !sameSubmission) return false;
      if (!userMessagesAreSameEventAcrossTurns(candidate.item, item)) return false;
      const candidatePriority = userMessageShadowPriority(candidate.item);
      if (candidatePriority > itemPriority) return true;
      if (candidatePriority === itemPriority) return true;
      return false;
    });
  }

  function threadDurableUserMessages(turns) {
    const messages = [];
    for (const turn of turns || []) {
      const items = Array.isArray(turn && turn.items) ? turn.items : [];
      for (const item of items) {
        if (item && item.type === "userMessage" && !isOptimisticUserMessage(item)) messages.push(item);
      }
    }
    return messages;
  }

  function shouldDropInitialSubmissionEchoTurn(existingTurn, incomingTurns, initialSubmissionId) {
    const submissionId = String(initialSubmissionId || "").trim();
    if (!submissionId || !existingTurn || !Array.isArray(existingTurn.items)) return false;
    const visibleItems = existingTurn.items.filter((item) => item && itemVisibleWeight(item) > 0 && !isReasoningItem(item));
    const submittedEchoes = visibleItems.filter((item) => item
      && item.type === "userMessage"
      && isOptimisticUserMessage(item)
      && String(item.clientSubmissionId || "") === submissionId);
    if (!submittedEchoes.length || submittedEchoes.length !== visibleItems.length) return false;
    const durableMessages = threadDurableUserMessages(incomingTurns);
    return submittedEchoes.every((echo) => durableMessages.some((real) => userMessagesCanShadow(real, echo)));
  }

  function threadHasInitialSubmissionEcho(thread, initialSubmissionId) {
    const submissionId = String(initialSubmissionId || "").trim();
    if (!submissionId || !thread || !Array.isArray(thread.turns)) return false;
    return thread.turns.some((turn) => {
      const items = Array.isArray(turn && turn.items) ? turn.items : [];
      return items.some((item) => item
        && item.type === "userMessage"
        && isOptimisticUserMessage(item)
        && String(item.clientSubmissionId || "") === submissionId);
    });
  }

  function shouldPreserveMissingExistingTurn(existingTurn) {
    if (!existingTurn || isTurnComplete(existingTurn)) return false;
    const visibleItems = (Array.isArray(existingTurn.items) ? existingTurn.items : [])
      .filter((item) => item && itemVisibleWeight(item) > 0 && !isReasoningItem(item));
    return Boolean(visibleItems.length
      && visibleItems.every((item) => item.type === "userMessage" && isOptimisticUserMessage(item)));
  }

  function comparableVisibleTextItem(item) {
    return Boolean(item && (item.type === "agentMessage" || item.type === "plan"));
  }

  function comparableVisibleText(item) {
    if (!comparableVisibleTextItem(item)) return "";
    return normalizeComparableText(item.text || "");
  }

  function visibleTextItemsLikelySame(existingItem, incomingItem) {
    if (!comparableVisibleTextItem(existingItem) || !comparableVisibleTextItem(incomingItem)) return false;
    if (existingItem.type !== incomingItem.type) return false;
    const existingText = comparableVisibleText(existingItem);
    const incomingText = comparableVisibleText(incomingItem);
    if (!existingText || !incomingText) return false;
    return incomingText === existingText
      || (incomingText.length >= existingText.length && incomingText.startsWith(existingText));
  }

  function visibleTextItemsHaveStableSharedPrefix(existingItem, incomingItem) {
    if (!comparableVisibleTextItem(existingItem) || !comparableVisibleTextItem(incomingItem)) return false;
    if (existingItem.type !== incomingItem.type) return false;
    const existingText = comparableVisibleText(existingItem);
    const incomingText = comparableVisibleText(incomingItem);
    if (!existingText || !incomingText) return false;
    if (existingText === incomingText) return true;
    const shorterText = existingText.length <= incomingText.length ? existingText : incomingText;
    const longerText = existingText.length <= incomingText.length ? incomingText : existingText;
    if (shorterText.length < 16) return false;
    if (!longerText.startsWith(shorterText)) return false;
    return shorterText.length / Math.max(1, longerText.length) >= 0.5;
  }

  function completedReceiptItemsLikelySame(existingItem, incomingItem, incomingTurn = null) {
    if (!completedIncomingTurnHasAuthoritativeReceipt(incomingTurn)) return false;
    if (!isAssistantReceiptLikeItem(existingItem) || !isAssistantReceiptLikeItem(incomingItem)) return false;
    return visibleTextItemsLikelySame(existingItem, incomingItem)
      || visibleTextItemsHaveStableSharedPrefix(existingItem, incomingItem);
  }

  function visibleTextItemsCanShareRenderIdentity(existingItem, incomingItem, incomingTurn = null) {
    return threadDetailStatePolicy.visibleTextItemsCanShareRenderIdentity(existingItem, incomingItem, incomingTurn);
  }

  function findUnusedExistingItemIndexForIncoming(incomingItem, existingItems, usedExistingIndexes, incomingTurn = null) {
    if (!incomingItem) return -1;
    const used = usedExistingIndexes || new Set();
    if (incomingItem.id) {
      const index = (existingItems || []).findIndex((existingItem, candidateIndex) => existingItem
        && !used.has(candidateIndex)
        && existingItem.id === incomingItem.id);
      if (index >= 0) return index;
    }
    if (incomingItem.type === "userMessage") {
      const index = (existingItems || []).findIndex((existingItem, candidateIndex) => existingItem
        && !used.has(candidateIndex)
        && existingItem.type === "userMessage"
        && userMessagesCanShadow(existingItem, incomingItem));
      if (index >= 0) return index;
    }
    if (comparableVisibleTextItem(incomingItem)) {
      const index = (existingItems || []).findIndex((existingItem, candidateIndex) => existingItem
        && !used.has(candidateIndex)
        && visibleTextItemsCanShareRenderIdentity(existingItem, incomingItem, incomingTurn));
      if (index >= 0) return index;
    }
    return -1;
  }

  function mergeIncomingOrderedItem(existingItem, incomingItem, incomingTurn = null) {
    if (!existingItem) return incomingItem;
    if (!incomingItem) return existingItem;
    if (incomingItem.type === "userMessage" && existingItem.type === "userMessage") {
      return mergeLikelySameUserMessage(existingItem, incomingItem);
    }
    if (visibleTextItemsCanShareRenderIdentity(existingItem, incomingItem, incomingTurn)) {
      return mergeVisibleTextItemPreservingRenderIdentity(existingItem, incomingItem, incomingTurn);
    }
    return mergeItemPreservingVisibleFields(existingItem, incomingItem);
  }

  function insertLocalOnlyItemByExistingOrder(merged, item, existingIndex, existingIndexToMergedIndex) {
    if (!item) return;
    let insertAt = -1;
    for (let index = existingIndex - 1; index >= 0; index -= 1) {
      if (existingIndexToMergedIndex.has(index)) {
        insertAt = existingIndexToMergedIndex.get(index) + 1;
        break;
      }
    }
    if (insertAt < 0) {
      for (const [index, mergedIndex] of existingIndexToMergedIndex.entries()) {
        if (index > existingIndex && (insertAt < 0 || mergedIndex < insertAt)) {
          insertAt = mergedIndex;
        }
      }
    }
    if (insertAt < 0 || insertAt > merged.length) insertAt = merged.length;
    merged.splice(insertAt, 0, item);
    for (const [index, mergedIndex] of existingIndexToMergedIndex.entries()) {
      if (mergedIndex >= insertAt) existingIndexToMergedIndex.set(index, mergedIndex + 1);
    }
    existingIndexToMergedIndex.set(existingIndex, insertAt);
  }

  function mergeItemPreservingVisibleFields(existingItem, incomingItem) {
    return threadDetailStatePolicy.mergeItemPreservingVisibleFields(existingItem, incomingItem);
  }

  function mergeVisibleTextItemPreservingRenderIdentity(existingItem, incomingItem, incomingTurn = null) {
    return threadDetailStatePolicy.mergeVisibleTextItemPreservingRenderIdentity(existingItem, incomingItem, incomingTurn);
  }

  function mergeItemsPreservingLocalVisible(existingItems, incomingItems, preserveLocalVisible = false, incomingTurn = null) {
    const added = new Set();
    const usedExistingIndexes = new Set();
    const existingIndexToMergedIndex = new Map();
    const merged = [];
    const suppressedVisualReceiptKeys = suppressedVisualReceiptKeySet(incomingTurn);
    for (const incomingItem of incomingItems || []) {
      if (!incomingItem) continue;
      if (incomingItem.id && added.has(incomingItem.id)) continue;
      if (hasMatchingRealUserMessage(incomingItem, merged) || hasMatchingRealUserMessage(incomingItem, incomingItems)) continue;
      const existingIndex = findUnusedExistingItemIndexForIncoming(incomingItem, existingItems || [], usedExistingIndexes, incomingTurn);
      const existingItem = existingIndex >= 0 ? existingItems[existingIndex] : null;
      const mergedItem = mergeIncomingOrderedItem(existingItem, incomingItem, incomingTurn);
      merged.push(mergedItem);
      if (incomingItem.id) added.add(incomingItem.id);
      if (mergedItem && mergedItem.id) added.add(mergedItem.id);
      if (existingItem && existingItem.id) added.add(existingItem.id);
      if (existingIndex >= 0) {
        usedExistingIndexes.add(existingIndex);
        existingIndexToMergedIndex.set(existingIndex, merged.length - 1);
      }
    }
    (existingItems || []).forEach((existingItem, existingIndex) => {
      if (!existingItem || usedExistingIndexes.has(existingIndex)) return;
      if (!shouldPreserveLocalOnlyItem(existingItem, preserveLocalVisible, suppressedVisualReceiptKeys, incomingTurn)) return;
      if (existingItem.id && added.has(existingItem.id)) return;
      insertLocalOnlyItemByExistingOrder(merged, existingItem, existingIndex, existingIndexToMergedIndex);
      if (existingItem.id) added.add(existingItem.id);
    });
    return dedupeTurnUsageSummaryItems(removeShadowedMuxUserMessages(dedupeLikelySameUserMessages(merged)));
  }

  function mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) {
    return threadDetailMergePolicy.mergeTurnPreservingVisibleItems(existingTurn, incomingTurn);
  }

  function shouldPreserveLiveTurnLocalVisibleItems(existingTurn, incomingTurn, existingWeight = null) {
    return threadDetailMergePolicy.shouldPreserveLiveTurnLocalVisibleItems(existingTurn, incomingTurn, existingWeight);
  }

  function mergeThreadPreservingVisibleItems(existingThread, incomingThread) {
    return threadDetailMergePolicy.mergeThreadPreservingVisibleItems(existingThread, incomingThread, {
      activeTurnId: state.activeTurnId,
    });
  }

  function firstTurnTimestampMs(turn, fields = []) {
    for (const field of fields) {
      const timestamp = numericTimestampMs(turn && turn[field]);
      if (timestamp) return timestamp;
    }
    return 0;
  }

  function turnOrderMs(turn) {
    if (!turn) return 0;
    if (isTurnComplete(turn)) {
      return firstTurnTimestampMs(turn, [
        "completedAtMs",
        "completedAt",
        "completed_at_ms",
        "completed_at",
        "updatedAtMs",
        "updatedAt",
        "updated_at_ms",
        "updated_at",
        "startedAtMs",
        "startedAt",
        "started_at_ms",
        "started_at",
        "createdAtMs",
        "createdAt",
        "created_at_ms",
        "created_at",
      ]);
    }
    return firstTurnTimestampMs(turn, [
      "startedAtMs",
      "startedAt",
      "started_at_ms",
      "started_at",
      "createdAtMs",
      "createdAt",
      "created_at_ms",
      "created_at",
      "updatedAtMs",
      "updatedAt",
      "updated_at_ms",
      "updated_at",
      "completedAtMs",
      "completedAt",
      "completed_at_ms",
      "completed_at",
    ]);
  }

  function turnIsSupersededBy(turn, newerTurn) {
    if (!turn || !newerTurn || turn.id === newerTurn.id) return false;
    const left = turnOrderMs(turn);
    const right = turnOrderMs(newerTurn);
    if (left && right) return right > left;
    return isTurnComplete(newerTurn) && !isTurnComplete(turn);
  }


  const threadDetailStatePolicy = threadDetailStateApi.createThreadDetailStatePolicy({
    itemVisibleWeight,
    isContextCompactionItem,
    isOperationalItem,
    isAssistantReceiptLikeItem,
    isTurnComplete,
    isReasoningItem,
    visualReceiptMatchesSuppressionKeys,
    comparableVisibleText,
    visibleTextItemsLikelySame,
    completedReceiptItemsLikelySame,
  });
  const threadListSummaryFromDetailThread = threadDetailStateApi.threadListSummaryFromDetailThread;
  const planThreadOpenCacheReuse = threadDetailStateApi.planThreadOpenCacheReuse;
  const threadHasReusableLoadedDetailState = threadDetailStateApi.threadHasReusableLoadedDetailState;

  const threadDetailV4MergePolicy = threadDetailV4MergeStateApi.createThreadDetailV4MergePolicy({
    normalizeThreadVisibleUserMessages,
    turnVisibleWeight,
    isOptimisticUserMessage,
    isRecentlySubmittedUserMessage,
    isReasoningItem,
    userMessageHasSubmissionId,
    userMessagesCanShadow,
    isTurnComplete,
    isRunningStatus,
    isIncompleteInterruptedTurn,
    turnHasActiveLiveItems,
    turnOrderMs,
    mergeTurnPreservingVisibleItems,
    sortTurnsForDisplay,
    maxVisibleTurnsForThread,
  });
  const threadDetailMergePolicy = threadDetailMergeStateApi.createThreadDetailMergePolicy({
    isV4ProjectionThread: threadDetailV4MergePolicy.isV4ProjectionThread,
    mergeV4ProjectionThread: threadDetailV4MergePolicy.mergeV4ProjectionThread,
    normalizeThreadVisibleUserMessages,
    turnVisibleWeight,
    shouldPreserveExistingTurnVisibleItems: (existingTurn, incomingTurn, existingWeight) => (
      threadDetailStatePolicy.shouldPreserveExistingTurnVisibleItems(existingTurn, incomingTurn, existingWeight)
    ),
    mergeItemsPreservingLocalVisible,
    shouldDropInitialSubmissionEchoTurn,
    shouldPreserveMissingExistingTurn,
    turnIsSupersededBy,
    isTurnComplete,
    sortTurnsForDisplay,
    threadHasInitialSubmissionEcho,
    maxExpandedVisibleTurns: MAX_EXPANDED_VISIBLE_TURNS,
  });

  return {
    threadDetailStatePolicy,
    threadDetailV4MergePolicy,
    threadDetailMergePolicy,
    threadListSummaryFromDetailThread,
    planThreadOpenCacheReuse,
    threadHasReusableLoadedDetailState,
    liveTurnHasNonUserProgress,
    isVisibleNonUserProgressItem,
    liveTurnHasNonUserProgressBefore,
    liveTurnHasNonUserProgressAfter,
    isUserVisibleTextReplyItem,
    liveTurnHasUserVisibleTextReplyAfter,
    userMessageHasVisualAttachment,
    shouldHideDurableLiveUserMessage,
    durableUserMessageMatchesOptimisticEcho,
    threadHasDurableUserMessageWithSubmissionId,
    threadHasDurableUserMessageMatchingOptimisticEcho,
    shouldHideOptimisticUserMessageEcho,
    isSupersededLiveTurn,
    shouldHideSupersededLiveUserMessage,
    isRawThreadReadMode,
    shouldPreserveRawThreadVisibleEntry,
    itemTextValue,
    reasoningItemHasVisibleText,
    isLatestCompletedProcessTurn,
    limitRawThreadVisibleEntries,
    visibleItemsForTurn,
    currentLiveOperationEntry,
    liveTurnStatusDockItem,
    visibleItemSignature,
    visibleItemBudgetForTurn,
    visibleItemBudgetSignature,
    inputContentSignature,
    imageSourceSignature,
    compactStructuredForSignature,
    itemVisibleWeight,
    turnVisibleWeight,
    isAssistantReceiptLikeItem,
    completedIncomingTurnHasAuthoritativeReceipt,
    shouldDropLocalOnlyReceiptForIncomingTurn,
    shouldPreserveLocalOnlyItem,
    isMuxUserMessage,
    isOptimisticUserMessage,
    userMessageSubmissionIdCandidates,
    userMessageHasSubmissionId,
    userMessagesShareSubmissionId,
    isTurnUsageSummaryItem,
    isTurnDiagnosticItem,
    dedupeTurnUsageSummaryItems,
    normalizeComparableText,
    userMessageComparableParts,
    userMessagePathOverlap,
    comparablePathName,
    userMessagePathNameOverlap,
    comparablePathNamesLikelySame,
    isVisualReceiptItem,
    visualReceiptComparableNames,
    visualReceiptCallId,
    visualReceiptSuppressionKeys,
    suppressedVisualReceiptKeySet,
    visualReceiptMatchesSuppressionKeys,
    userMessageSpecificity,
    userMessagesLikelySame,
    userMessagesCanShadow,
    userMessagesAreSameTurnDuplicateEvent,
    userMessageTimestampMs,
    userMessagesHaveNearbyTimestamps,
    isProjectionIndexUserMessage,
    userMessagesAreSameEventAcrossTurns,
    durableTurnCanReceivePendingEcho,
    optimisticEchoCanMatchEarlierDurable,
    hasMatchingIncomingUserMessage,
    hasMatchingRealUserMessage,
    removeShadowedMuxUserMessages,
    userMessageShadowPriority,
    mergeLikelySameUserMessage,
    dedupeLikelySameUserMessages,
    normalizeThreadVisibleUserMessages,
    threadUserMessageEntries,
    shouldDropOptimisticUserMessageForDurable,
    shouldDropOptimisticUserMessageForHigherPriorityEcho,
    shouldDropDuplicateUserMessageEvent,
    threadDurableUserMessages,
    shouldDropInitialSubmissionEchoTurn,
    threadHasInitialSubmissionEcho,
    comparableVisibleTextItem,
    comparableVisibleText,
    visibleTextItemsLikelySame,
    visibleTextItemsHaveStableSharedPrefix,
    completedReceiptItemsLikelySame,
    visibleTextItemsCanShareRenderIdentity,
    findUnusedExistingItemIndexForIncoming,
    mergeIncomingOrderedItem,
    insertLocalOnlyItemByExistingOrder,
    mergeItemPreservingVisibleFields,
    mergeVisibleTextItemPreservingRenderIdentity,
    mergeItemsPreservingLocalVisible,
    mergeTurnPreservingVisibleItems,
    shouldPreserveLiveTurnLocalVisibleItems,
    mergeThreadPreservingVisibleItems,
    turnOrderMs,
    turnIsSupersededBy,
  };
}

root.CodexThreadDetailRuntime = { createThreadDetailRuntime };
if (typeof module !== "undefined" && module.exports) module.exports = { createThreadDetailRuntime };
})(typeof globalThis !== "undefined" ? globalThis : this);
