"use strict";

function renderLiveOperationDock(thread, previousKeys = new Set()) {
  const entry = currentLiveOperationEntry(thread);
  if (!entry) return "";
  const mode = normalizeLiveOperationDockMode(state.liveOperationDockMode);
  const expanded = mode === "expanded";
  const mobileOperation = entry.item && entry.item.type !== "liveTurnStatus"
    ? renderMobileOperationStack(entry.item, entry.turn, previousKeys, entry.sourceIndex, expanded)
    : "";
  return `<div class="live-operation-dock-inner">
    ${mobileOperation}
    <div class="live-operation-dock-desktop">
      <div class="live-operation-dock-controls">
        <button type="button" data-live-operation-dock-toggle aria-expanded="${String(expanded)}" title="${expanded ? "收起 Command 框" : "展开 Command 框"}" aria-label="${expanded ? "收起 Command 框" : "展开 Command 框"}">${expanded ? "↓" : "↑"}</button>
      </div>
      ${renderLiveOperation(entry.item, entry.turn, previousKeys, entry.sourceIndex)}
    </div>
  </div>`;
}

function renderTurnVisibleItemBudgetNotice(turn, previousKeys = new Set()) {
  const budget = visibleItemBudgetForTurn(turn);
  if (!budget) return "";
  const key = stableTurnKey(turn, "visible-budget");
  const label = budget.omitted === 1
    ? "已折叠 1 条首屏操作细节"
    : `已折叠 ${budget.omitted} 条首屏操作细节`;
  const detailParts = [];
  if (budget.retained) detailParts.push(`保留 ${budget.retained}`);
  if (budget.original) detailParts.push(`原始 ${budget.original}`);
  if (budget.ceiling) detailParts.push(`上限 ${budget.ceiling}`);
  const detail = detailParts.join(" / ");
  return `<div class="turn-visible-budget-note${entryAnimationClass(key, previousKeys)}" data-render-key="${escapeHtml(key)}" data-visible-item-budget="${escapeHtml(String(budget.omitted))}">
    <span>${escapeHtml(label)}</span>
    ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
  </div>`;
}

function renderTurn(turn, previousKeys = new Set()) {
  const thread = renderContextThread();
  const visibleEntries = visibleItemsForTurn(turn, thread);
  const renderedItems = visibleEntries.map((entry, index) => {
    const item = entry.item;
    const sourceIndex = Number.isInteger(entry.sourceIndex) && entry.sourceIndex >= 0 ? entry.sourceIndex : index;
    let html = "";
    html = renderVisibleItemPatchHtml(turn, item, previousKeys, sourceIndex, thread);
    return { html, sourceIndex, order: 1 };
  }).filter((entry) => entry && entry.html);
  const budgetNoticeHtml = renderTurnVisibleItemBudgetNotice(turn, previousKeys);
  const items = renderedItems
    .sort((a, b) => (a.sourceIndex - b.sourceIndex) || (a.order - b.order))
    .map((entry) => entry.html)
    .join("");
  const threadId = renderContextThreadId();
  const turnApprovals = approvalsForTurn(threadId, turn.id);
  const approvalsHtml = turnApprovals.length
    ? `<div class="approval-stack in-turn">${turnApprovals.map((request) => renderApprovalRequest(request, previousKeys, threadId)).join("")}</div>`
    : "";
  const draftHtml = renderTurnThreadTaskCardDraft(turn, previousKeys, thread);
  const pendingDraftHtml = !draftHtml && !turnHasThreadTaskCardDraftResponse(turn) && isLatestTurn(turn, thread) && isLiveTurn(turn, thread) && turnHasThreadTaskCardRequest(turn)
    ? renderPendingThreadTaskCardDraft("Generating cross-thread task card draft...", "Generating")
    : "";
  if (!budgetNoticeHtml.trim() && !items.trim() && !approvalsHtml.trim() && !draftHtml.trim() && !pendingDraftHtml.trim()) return "";
  const turnKey = stableTurnKey(turn);
  const statusKey = stableTurnKey(turn, "status");
  const duration = turn.durationMs ? ` | ${formatElapsedTime(Math.round(turn.durationMs / 1000))}` : "";
  const timerShowsStatus = isLatestTurn(turn, thread) && (isLiveTurn(turn, thread) || turnFinalSeconds(turn) != null);
  const showStatusLine = !timerShowsStatus;
  return `<article class="turn" data-turn="${escapeHtml(turn.id)}" data-render-key="${escapeHtml(turnKey)}">
    ${budgetNoticeHtml}${items}${approvalsHtml}
    ${showStatusLine ? `<div class="turn-status${entryAnimationClass(statusKey, previousKeys)}" data-render-key="${escapeHtml(statusKey)}">${escapeHtml(displayTurnStatus(turn))}${duration}</div>` : ""}
    ${draftHtml}${pendingDraftHtml}
  </article>`;
}

function renderLiveOperation(item, turn, previousKeys = new Set(), index = 0) {
  const status = item && item.type === "liveTurnStatus"
    ? ""
    : statusText(item.status) || (item.completedAtMs ? "completed" : "running");
  const key = stableOperationRenderKey(turn, item, index);
  return renderOperationCard(item, key, { status });
}

function renderOperationCard(item, key, options = {}) {
  const status = options.status || statusText(item.status) || (item.completedAtMs ? "completed" : "running");
  const type = options.type || item.type || "item";
  const title = operationTitle(item);
  const detail = operationDetailText(item);
  const durationData = operationDurationData(item, status);
  return liveOperationDockPolicy.operationCardHtml({
    itemId: item && item.id || "",
    type,
    status,
    title,
    detail,
    durationText: durationData && durationData.text || "",
    durationAttrs: durationData ? operationDurationAttrs(durationData) : "",
    extraClass: options.extraClass || "",
    renderKey: key,
    escapeHtml,
  });
}

function operationDurationHtml(item, status = "", className = "operation-duration") {
  const durationData = operationDurationData(item, status);
  return durationData
    ? `<time class="${escapeHtml(className)}" ${operationDurationAttrs(durationData)} title="${escapeHtml(`Elapsed ${durationData.text}`)}">${escapeHtml(durationData.text)}</time>`
    : "";
}

function operationBubbleSummary(item) {
  return truncateSingleLine(operationSummaryLines(item).filter(Boolean).join(" | "), 52);
}

function renderMobileOperationStack(item, turn, previousKeys = new Set(), index = 0, expanded = false, options = {}) {
  const status = statusText(item.status) || (item.completedAtMs ? "completed" : "running");
  const key = stableOperationRenderKey(turn, item, index);
  const title = operationTitle(item);
  const summary = operationBubbleSummary(item);
  const duration = operationDurationHtml(item, status, "operation-duration mobile-operation-bubble-duration");
  const toggleName = String(options.toggleAttribute || "data-live-operation-dock-toggle").trim();
  const toggleValue = String(options.toggleValue || "");
  const toggleAttr = toggleName
    ? `${escapeHtml(toggleName)}${toggleValue ? `="${escapeHtml(toggleValue)}"` : ""}`
    : "data-live-operation-dock-toggle";
  return `<div class="mobile-operation-stack">
    <div class="mobile-operation-sheet" role="region" aria-label="Command 详情">
      ${renderOperationCard(item, key, { status, extraClass: "mobile-operation-sheet-card" })}
    </div>
    <button class="mobile-operation-bubble" type="button" ${toggleAttr} aria-expanded="${String(expanded)}" title="${expanded ? "收起 Command 框" : "展开 Command 框"}" aria-label="${expanded ? "收起 Command 框" : "展开 Command 框"}">
      <span class="mobile-operation-bubble-title">${escapeHtml(title)}</span>
      ${summary ? `<span class="mobile-operation-bubble-summary">${escapeHtml(summary)}</span>` : ""}
      ${duration}
    </button>
  </div>`;
}

function operationTitle(item) {
  if (item && item.title) return item.title;
  return labelForItem(item);
}

function operationDetailText(item) {
  return operationSummaryLines(item).filter(Boolean).join(" | ");
}

function truncateSingleLine(value, maxChars = 96) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1))}...`;
}

function normalizeOperationIdentityValue(value) {
  return String(value || "").replace(/\\/g, "/").replace(/\s+/g, " ").trim().toLowerCase();
}

function stripMatchingOuterQuotes(value) {
  const text = String(value || "").trim();
  if (text.length >= 2) {
    const first = text[0];
    const last = text[text.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) return text.slice(1, -1).trim();
  }
  return text;
}

function operationArgumentsObject(item) {
  const value = item && item.arguments;
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function operationCommandText(item) {
  const direct = Array.isArray(item && item.command)
    ? item.command.join(" ")
    : String(item && item.command || "");
  if (direct.trim()) return direct;
  const args = operationArgumentsObject(item);
  return String(args && (args.command || args.cmd || args.shellCommand || args.shell_command) || "");
}

function operationCommandSummary(item) {
  const raw = operationCommandText(item).replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const commandMatch = raw.match(/(?:^|\s)-(?:Command|c)\s+([\s\S]+)$/i);
  if (commandMatch && /(?:powershell|pwsh)(?:\.exe)?/i.test(raw.slice(0, commandMatch.index + commandMatch[0].length))) {
    const script = stripMatchingOuterQuotes(commandMatch[1]);
    if (script) return truncateSingleLine(script, 180);
  }
  if (/(?:^|\s)-(?:EncodedCommand|enc|e)\b/i.test(raw) && /(?:powershell|pwsh)(?:\.exe)?/i.test(raw)) {
    return "PowerShell -EncodedCommand";
  }
  return truncateSingleLine(raw, 180);
}

function operationCommandName(item) {
  const raw = operationCommandText(item).trim();
  if (!raw) return "";
  const quoted = raw.match(/^["']([^"']+)["']/);
  const token = quoted ? quoted[1] : raw.split(/\s+/, 1)[0];
  const name = shortPath(stripMatchingOuterQuotes(token));
  return name || stripMatchingOuterQuotes(token);
}

function operationCommandGroupText(item) {
  return operationCommandName(item);
}

function operationRawFileNames(item) {
  const values = Array.isArray(item.fileNames) && item.fileNames.length
    ? item.fileNames
    : collectFileNames(item.changes || item.arguments || item.result || item.contentItems);
  return [...new Set(values.map((name) => String(name || "").trim()).filter(Boolean))].slice(0, 5);
}

function operationFileNames(item) {
  return operationRawFileNames(item)
    .map((name) => truncateSingleLine(shortPath(name), 72))
    .filter(Boolean);
}

function operationGroupKey(item) {
  if (!item || !isOperationalItem(item)) return "";
  const type = isWebSearchLikeItem(item) ? "webSearch" : (item.type || "item");
  const fileNames = operationRawFileNames(item)
    .map(normalizeOperationIdentityValue)
    .filter(Boolean)
    .sort();
  if (fileNames.length) return `${type}:files:${stableTextHash(fileNames.join("|"))}`;
  if (operationCommandText(item)) return `${type}:command:${stableTextHash(normalizeOperationIdentityValue(operationCommandGroupText(item)))}`;
  const searchSummary = isWebSearchLikeItem(item) ? operationSearchSummary(item) : "";
  if (searchSummary) return `${type}:search:${stableTextHash(normalizeOperationIdentityValue(searchSummary))}`;
  const toolParts = [item.server, item.namespace, item.tool].map(normalizeOperationIdentityValue).filter(Boolean);
  if (toolParts.length) return `${type}:tool:${stableTextHash(toolParts.join("|"))}`;
  const detail = operationDetailText(item);
  if (detail) return `${type}:detail:${stableTextHash(normalizeOperationIdentityValue(detail))}`;
  return item.id ? `${type}:item:${item.id}` : "";
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

function operationSearchSummary(item) {
  return [...new Set(collectSearchSummaries(item && (item.action || item.arguments || item.result || item.contentItems || item)))]
    .slice(0, 3)
    .join(" | ");
}

function operationSummaryLines(item) {
  if (item.type === "liveTurnStatus") return item.detail ? [item.detail] : [];
  if (item.type === "fileChange") {
    const names = operationFileNames(item);
    return names.length ? [names.join(", ")] : [];
  }
  if (operationCommandText(item)) return [operationCommandSummary(item)];
  const searchSummary = isWebSearchLikeItem(item) ? operationSearchSummary(item) : "";
  if (searchSummary) return [truncateMiddle(searchSummary, 180, "search")];
  const names = operationFileNames(item);
  if (names.length) return [names.join(", ")];
  if (item.tool) return [item.tool];
  return [];
}

function displayTurnStatus(turn) {
  if (isIncompleteInterruptedTurn(turn)) return "syncing";
  return statusText(turn.status);
}

function renderContextCompaction(item, turn = null, previousKeys = new Set(), index = 0, thread = null) {
  const notice = contextCompactionNotice(item, turn, thread);
  if (!notice) return "";
  const key = stableItemKey(turn, item, index, "context");
  return `<div class="context-compaction-note${entryAnimationClass(key, previousKeys)}" data-item="${escapeHtml(item.id || "")}" data-render-key="${escapeHtml(key)}">${escapeHtml(notice)}</div>`;
}

function renderItem(item, turn = null, previousKeys = new Set(), index = 0, thread = null) {
  const contextThread = renderContextThread(thread);
  if (isContextCompactionItem(item)) return renderContextCompaction(item, turn, previousKeys, index, contextThread);
  if (isLiveReasoning(item, turn, contextThread)) return "";
  const type = item.type || "item";
  const key = stableItemKey(turn, item, index);
  if (item.type === "turnUsageSummary") {
    return `<section class="item${entryAnimationClass(key, previousKeys)} turnUsageSummary" data-item="${escapeHtml(item.id || "")}" data-render-key="${escapeHtml(key)}"${clientSubmissionDataAttr(item)}>
      <div class="item-body">${renderTurnUsageSummary(item)}</div>
    </section>`;
  }
  const injectedTaskCardText = injectedThreadTaskCardTextForItem(item);
  if (injectedTaskCardText) return renderInjectedThreadTaskCardItem(item, turn, previousKeys, index, injectedTaskCardText, contextThread);
  const itemCopyKey = rememberCopyText(copyTextForItem(item));
  const itemCopyButton = copyButtonHtml(itemCopyKey, "复制全文", "item-copy-button");
  const timestampHtml = renderItemTimestampHtml(item, turn, contextThread);
  return `<section class="item${entryAnimationClass(key, previousKeys)} ${escapeHtml(type)}" data-item="${escapeHtml(item.id || "")}" data-render-key="${escapeHtml(key)}"${clientSubmissionDataAttr(item)}>
    <div class="item-head">
      <span>${escapeHtml(labelForItem(item))}</span>
      <span class="item-head-actions">${timestampHtml}<span>${escapeHtml(item.status ? statusText(item.status) : "")}</span>${itemCopyButton}</span>
    </div>
    <div class="item-body">${renderItemBody(item, turn)}</div>
  </section>`;
}

function renderInjectedThreadTaskCardItem(item, turn = null, previousKeys = new Set(), index = 0, text = "", thread = null) {
  const key = stableItemKey(turn, item, index);
  const metadata = injectedThreadTaskCardMetadata(text);
  const itemCopyKey = rememberCopyText(copyTextForItem(item));
  const itemCopyButton = copyButtonHtml(itemCopyKey, "复制全文", "item-copy-button");
  const timestampHtml = renderItemTimestampHtml(item, turn, thread);
  return `<section class="item${entryAnimationClass(key, previousKeys)} thread-task-card-injected" data-item="${escapeHtml(item.id || "")}" data-render-key="${escapeHtml(key)}" data-thread-task-card-item>
    <div class="item-head thread-task-card-message-head">
      <span class="thread-task-card-message-heading">
        <span class="thread-task-card-message-source">来源：${escapeHtml(metadata.source)}</span>
        <span class="thread-task-card-message-purpose">目的：${escapeHtml(metadata.purpose)}</span>
      </span>
      <span class="item-head-actions">${timestampHtml}${itemCopyButton}</span>
    </div>
    <div class="item-body">${renderInjectedThreadTaskCardBody(text, metadata)}</div>
  </section>`;
}

function renderItemTimestampHtml(item, turn = null, thread = null) {
  const timestampMs = itemTimestampMs(item, turn, thread);
  if (!timestampMs) return "";
  const label = formatCardTimestamp(timestampMs, state.nowMs);
  if (!label) return "";
  const title = new Date(timestampMs).toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `<time class="item-timestamp" datetime="${escapeHtml(new Date(timestampMs).toISOString())}" title="${escapeHtml(title)}">${escapeHtml(label)}</time>`;
}

function itemTimestampMs(item, turn = null, thread = null) {
  if (!item) return 0;
  const contextThread = renderContextThread(thread);
  const itemStarted = numericTimestampMs(item.createdAtMs)
    || numericTimestampMs(item.createdAt)
    || numericTimestampMs(item.created_at_ms)
    || numericTimestampMs(item.created_at)
    || numericTimestampMs(item.startedAtMs)
    || numericTimestampMs(item.startedAt)
    || numericTimestampMs(item.started_at_ms)
    || numericTimestampMs(item.started_at)
    || numericTimestampMs(item.updatedAtMs)
    || numericTimestampMs(item.updatedAt)
    || numericTimestampMs(item.updated_at_ms)
    || numericTimestampMs(item.updated_at)
    || numericTimestampMs(item.timestampMs)
    || numericTimestampMs(item.timestamp)
    || numericTimestampMs(item.mobileDisplayTimestampMs)
    || numericTimestampMs(item.mobileDisplayTimestamp);
  if (itemStarted) return itemStarted;
  if (item.type === "agentMessage" || item.type === "plan") {
    return numericTimestampMs(item.completedAtMs)
      || numericTimestampMs(item.completedAt)
      || numericTimestampMs(item.completed_at_ms)
      || numericTimestampMs(item.completed_at)
      || turnCompletedAtMs(turn, contextThread)
      || (isLiveTurn(turn, contextThread) ? 0 : turnStartedAtMs(turn))
      || 0;
  }
  if (isLiveTurn(turn, contextThread) && isOperationalItem(item)) return turnStartedAtMs(turn) || 0;
  return turnStartedAtMs(turn) || turnCompletedAtMs(turn, contextThread);
}

function turnStartedAtMs(turn) {
  if (!turn) return 0;
  return numericTimestampMs(turn.startedAtMs)
    || numericTimestampMs(turn.startedAt)
    || numericTimestampMs(turn.started_at_ms)
    || numericTimestampMs(turn.started_at)
    || numericTimestampMs(turn.createdAtMs)
    || numericTimestampMs(turn.createdAt)
    || numericTimestampMs(turn.created_at_ms)
    || numericTimestampMs(turn.created_at)
    || turnIdentityTimestampMs(turn);
}

function renderLiveReasoning(item, turn) {
  const elapsed = liveReasoningElapsed(item, turn);
  return `<section class="item live-reasoning reasoning" data-item="${escapeHtml(item.id || "")}">
    <div class="item-head"><span>Reasoning</span><span>${elapsed}s</span></div>
  </section>`;
}

function labelForItem(item) {
  if (isWebSearchLikeItem(item)) return "Web Search";
  const map = {
    userMessage: "You",
    agentMessage: "Codex",
    reasoning: "Reasoning",
    commandExecution: "Command",
    fileChange: "File Change",
    collabAgentToolCall: "协作 Agent",
    turnDiagnostic: "Diagnostic",
    imageView: "Image",
    imageGeneration: "Image",
    mcpToolCall: `MCP ${item.server || ""}.${item.tool || ""}`,
    dynamicToolCall: `${item.namespace ? item.namespace + "." : ""}${item.tool || "Tool"}`,
    plan: "Plan",
    contextCompaction: "Context",
    turnUsageSummary: "Usage",
  };
  return map[item.type] || item.type || "Item";
}

function copyTextForItem(item) {
  if (!item) return "";
  if (item.type === "agentMessage") return item.text || "";
  if (item.type === "turnDiagnostic") return [item.title, item.message].filter(Boolean).join("\n");
  return "";
}

var mediaPreviewRuntime = null;
function requireMediaPreviewRuntime() {
  if (!mediaPreviewRuntime) {
    mediaPreviewRuntime = mediaPreviewRuntimeApi.createMediaPreviewRuntime({
      state,
      $,
      document,
      window,
      fetch: window.fetch ? window.fetch.bind(window) : fetch,
      FileReader: window.FileReader,
      requestAnimationFrame: typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback) => window.setTimeout(callback, 16),
      CLIENT_BUILD_ID,
      FILE_PREVIEW_SWIPE_CLOSE_MIN_PX,
      GITHUB_LINK_PREVIEW_TIMEOUT_MS,
      IMAGE_DIAGNOSTICS_ENABLED,
      IMAGE_PREVIEW_MAX_SCALE,
      IMAGE_PREVIEW_MIN_SCALE,
      IMAGE_PREVIEW_ZOOM_STEP,
      MERMAID_MAX_SCALE,
      MERMAID_MIN_SCALE,
      MERMAID_SCRIPT_URL,
      MERMAID_ZOOM_STEP,
      PERF_EVENT_THROTTLE_MS,
      PROTECTED_IMAGE_PLACEHOLDER_SRC,
      api,
      compactStructuredForSignature,
      copyButtonHtml,
      diagnosticItemHash,
      escapeHtml,
      isHermesEmbedMode,
      isIosWebKitBrowser,
      normalizeFsPath,
      nowPerfMs,
      postPerformanceEvent,
      primaryTouch,
      publishPluginNavigationState,
      recordHomeAiDiagnosticFailure,
      recordHomeAiDiagnosticSuccess,
      rememberCopyText,
      renderContextThreadId,
      requestHermesPluginRefresh,
      roundedDurationMs,
      shortPath,
      stableTextHash,
      truncateSingleLine,
      visibleThreadTaskCardCommandText,
    });
  }
  return mediaPreviewRuntime;
}

function imageUrlValue(...args) {
  return requireMediaPreviewRuntime().imageUrlValue(...args);
}

function isInputTextPart(...args) {
  return requireMediaPreviewRuntime().isInputTextPart(...args);
}

function inputTextValue(...args) {
  return requireMediaPreviewRuntime().inputTextValue(...args);
}

function isInputImagePart(...args) {
  return requireMediaPreviewRuntime().isInputImagePart(...args);
}

function isTruncatedImagePayloadPart(...args) {
  return requireMediaPreviewRuntime().isTruncatedImagePayloadPart(...args);
}

function attachmentSummaryMarkerMatch(...args) {
  return requireMediaPreviewRuntime().attachmentSummaryMarkerMatch(...args);
}

function stripAttachmentSummaryLinePrefix(...args) {
  return requireMediaPreviewRuntime().stripAttachmentSummaryLinePrefix(...args);
}

function splitAttachmentSummaryText(...args) {
  return requireMediaPreviewRuntime().splitAttachmentSummaryText(...args);
}

function parseAttachmentLine(...args) {
  return requireMediaPreviewRuntime().parseAttachmentLine(...args);
}

function codexMobileUploadIdForPath(...args) {
  return requireMediaPreviewRuntime().codexMobileUploadIdForPath(...args);
}

function uploadFileUrl(...args) {
  return requireMediaPreviewRuntime().uploadFileUrl(...args);
}

function isCodexMobileUploadPath(...args) {
  return requireMediaPreviewRuntime().isCodexMobileUploadPath(...args);
}

function imageContentUrlForPath(...args) {
  return requireMediaPreviewRuntime().imageContentUrlForPath(...args);
}

function localAttachmentPreviewUrl(...args) {
  return requireMediaPreviewRuntime().localAttachmentPreviewUrl(...args);
}

function imageSourceForPart(...args) {
  return requireMediaPreviewRuntime().imageSourceForPart(...args);
}

function isLikelyAbsoluteLocalPath(...args) {
  return requireMediaPreviewRuntime().isLikelyAbsoluteLocalPath(...args);
}

function canRenderImageAttachment(...args) {
  return requireMediaPreviewRuntime().canRenderImageAttachment(...args);
}

function isInjectedThreadTaskCardMessage(...args) {
  return requireMediaPreviewRuntime().isInjectedThreadTaskCardMessage(...args);
}

function injectedThreadTaskCardLineValue(...args) {
  return requireMediaPreviewRuntime().injectedThreadTaskCardLineValue(...args);
}

function injectedThreadTaskCardPurpose(...args) {
  return requireMediaPreviewRuntime().injectedThreadTaskCardPurpose(...args);
}

function injectedThreadTaskCardMetadata(...args) {
  return requireMediaPreviewRuntime().injectedThreadTaskCardMetadata(...args);
}

function injectedThreadTaskCardSummary(...args) {
  return requireMediaPreviewRuntime().injectedThreadTaskCardSummary(...args);
}

function injectedThreadTaskCardTextForItem(...args) {
  return requireMediaPreviewRuntime().injectedThreadTaskCardTextForItem(...args);
}

function renderInjectedThreadTaskCardBody(...args) {
  return requireMediaPreviewRuntime().renderInjectedThreadTaskCardBody(...args);
}

function renderInjectedThreadTaskCardMessage(...args) {
  return requireMediaPreviewRuntime().renderInjectedThreadTaskCardMessage(...args);
}

function renderInputText(...args) {
  return requireMediaPreviewRuntime().renderInputText(...args);
}

function renderInputImage(...args) {
  return requireMediaPreviewRuntime().renderInputImage(...args);
}

function renderInputAttachment(...args) {
  return requireMediaPreviewRuntime().renderInputAttachment(...args);
}

function renderAttachmentSummary(...args) {
  return requireMediaPreviewRuntime().renderAttachmentSummary(...args);
}

function renderInputContent(...args) {
  return requireMediaPreviewRuntime().renderInputContent(...args);
}

function renderMarkdown(...args) {
  return requireMediaPreviewRuntime().renderMarkdown(...args);
}

function renderMarkdownWithAttachmentSummary(...args) {
  return requireMediaPreviewRuntime().renderMarkdownWithAttachmentSummary(...args);
}

function commandOutputBody(...args) {
  return requireMediaPreviewRuntime().commandOutputBody(...args);
}

function stripCommandOutputLineNumbers(...args) {
  return requireMediaPreviewRuntime().stripCommandOutputLineNumbers(...args);
}

function isMarkdownTableSeparatorLine(...args) {
  return requireMediaPreviewRuntime().isMarkdownTableSeparatorLine(...args);
}

function containsMarkdownTable(...args) {
  return requireMediaPreviewRuntime().containsMarkdownTable(...args);
}

function commandOutputMarkdownPreview(...args) {
  return requireMediaPreviewRuntime().commandOutputMarkdownPreview(...args);
}

function normalizeGitHubLinkPreview(...args) {
  return requireMediaPreviewRuntime().normalizeGitHubLinkPreview(...args);
}

function normalizeGithubPreviewUrl(...args) {
  return requireMediaPreviewRuntime().normalizeGithubPreviewUrl(...args);
}

function gitHubLinkPreviewAccentClass(...args) {
  return requireMediaPreviewRuntime().gitHubLinkPreviewAccentClass(...args);
}

function renderGitHubLinkPreviewCard(...args) {
  return requireMediaPreviewRuntime().renderGitHubLinkPreviewCard(...args);
}

async function fetchGitHubLinkPreview(...args) {
  return requireMediaPreviewRuntime().fetchGitHubLinkPreview(...args);
}

function githubLinkPreviewHosts(...args) {
  return requireMediaPreviewRuntime().githubLinkPreviewHosts(...args);
}

function gitHubLinkPreviewSummary(...args) {
  return requireMediaPreviewRuntime().gitHubLinkPreviewSummary(...args);
}

function gitHubLinkPreviewInlineHost(...args) {
  return requireMediaPreviewRuntime().gitHubLinkPreviewInlineHost(...args);
}

function gitHubLinkPreviewInsertContainer(...args) {
  return requireMediaPreviewRuntime().gitHubLinkPreviewInsertContainer(...args);
}

function renderCollapsedGitHubLinkPreview(...args) {
  return requireMediaPreviewRuntime().renderCollapsedGitHubLinkPreview(...args);
}

function ensureInlineGitHubLinkPreviews(...args) {
  return requireMediaPreviewRuntime().ensureInlineGitHubLinkPreviews(...args);
}

function renderGitHubLinkPreviewUnavailable(...args) {
  return requireMediaPreviewRuntime().renderGitHubLinkPreviewUnavailable(...args);
}

function setGitHubPreviewCompactExpanded(...args) {
  return requireMediaPreviewRuntime().setGitHubPreviewCompactExpanded(...args);
}

function updateGitHubPreviewCompactTitle(...args) {
  return requireMediaPreviewRuntime().updateGitHubPreviewCompactTitle(...args);
}

function toggleGitHubLinkPreview(...args) {
  return requireMediaPreviewRuntime().toggleGitHubLinkPreview(...args);
}

async function hydrateGitHubLinkCard(...args) {
  return requireMediaPreviewRuntime().hydrateGitHubLinkCard(...args);
}

function hydrateGitHubLinkCards(...args) {
  return requireMediaPreviewRuntime().hydrateGitHubLinkCards(...args);
}

function mermaidEffectiveTheme(...args) {
  return requireMediaPreviewRuntime().mermaidEffectiveTheme(...args);
}

function mermaidThemeName(...args) {
  return requireMediaPreviewRuntime().mermaidThemeName(...args);
}

function mermaidConfig(...args) {
  return requireMediaPreviewRuntime().mermaidConfig(...args);
}

function mermaidPreviewOpen(...args) {
  return requireMediaPreviewRuntime().mermaidPreviewOpen(...args);
}

function loadRuntimeScript(...args) {
  return requireMediaPreviewRuntime().loadRuntimeScript(...args);
}

function configureMermaidApi(...args) {
  return requireMediaPreviewRuntime().configureMermaidApi(...args);
}

async function ensureMermaidApi(...args) {
  return requireMediaPreviewRuntime().ensureMermaidApi(...args);
}

function mermaidCanvas(...args) {
  return requireMediaPreviewRuntime().mermaidCanvas(...args);
}

function mermaidViewer(...args) {
  return requireMediaPreviewRuntime().mermaidViewer(...args);
}

function mermaidSourceFromContainer(...args) {
  return requireMediaPreviewRuntime().mermaidSourceFromContainer(...args);
}

function mermaidResetButton(...args) {
  return requireMediaPreviewRuntime().mermaidResetButton(...args);
}

function updateMermaidResetLabel(...args) {
  return requireMediaPreviewRuntime().updateMermaidResetLabel(...args);
}

function clampMermaidScale(...args) {
  return requireMediaPreviewRuntime().clampMermaidScale(...args);
}

function mermaidCurrentScale(...args) {
  return requireMediaPreviewRuntime().mermaidCurrentScale(...args);
}

function mermaidSvgSize(...args) {
  return requireMediaPreviewRuntime().mermaidSvgSize(...args);
}

function mermaidInitialScale(...args) {
  return requireMediaPreviewRuntime().mermaidInitialScale(...args);
}

function applyMermaidScale(...args) {
  return requireMediaPreviewRuntime().applyMermaidScale(...args);
}

function showMermaidLoading(...args) {
  return requireMediaPreviewRuntime().showMermaidLoading(...args);
}

function showMermaidError(...args) {
  return requireMediaPreviewRuntime().showMermaidError(...args);
}

function isMermaidErrorSvgMarkup(...args) {
  return requireMediaPreviewRuntime().isMermaidErrorSvgMarkup(...args);
}

function mermaidRenderArtifactIds(...args) {
  return requireMediaPreviewRuntime().mermaidRenderArtifactIds(...args);
}

function isOwnedMermaidRenderNode(...args) {
  return requireMediaPreviewRuntime().isOwnedMermaidRenderNode(...args);
}

function removeNodeIfExternalMermaidArtifact(...args) {
  return requireMediaPreviewRuntime().removeNodeIfExternalMermaidArtifact(...args);
}

function cleanupMermaidRenderArtifacts(...args) {
  return requireMediaPreviewRuntime().cleanupMermaidRenderArtifacts(...args);
}

function cleanupExternalMermaidErrorArtifacts(...args) {
  return requireMediaPreviewRuntime().cleanupExternalMermaidErrorArtifacts(...args);
}

function renderMermaidSvg(...args) {
  return requireMediaPreviewRuntime().renderMermaidSvg(...args);
}

function mermaidRenderCandidates(...args) {
  return requireMediaPreviewRuntime().mermaidRenderCandidates(...args);
}

async function renderMermaidIntoContainer(...args) {
  return requireMediaPreviewRuntime().renderMermaidIntoContainer(...args);
}

function hydrateMermaidBlock(...args) {
  return requireMediaPreviewRuntime().hydrateMermaidBlock(...args);
}

function hydrateMermaidDiagrams(...args) {
  return requireMediaPreviewRuntime().hydrateMermaidDiagrams(...args);
}

function rerenderVisibleMermaidDiagrams(...args) {
  return requireMediaPreviewRuntime().rerenderVisibleMermaidDiagrams(...args);
}

function installMermaidThemeObserver(...args) {
  return requireMediaPreviewRuntime().installMermaidThemeObserver(...args);
}

function mermaidActionContainer(...args) {
  return requireMediaPreviewRuntime().mermaidActionContainer(...args);
}

function mermaidContainerFromViewer(...args) {
  return requireMediaPreviewRuntime().mermaidContainerFromViewer(...args);
}

function resetMermaidScale(...args) {
  return requireMediaPreviewRuntime().resetMermaidScale(...args);
}

function openMermaidPreview(...args) {
  return requireMediaPreviewRuntime().openMermaidPreview(...args);
}

function closeMermaidPreview(...args) {
  return requireMediaPreviewRuntime().closeMermaidPreview(...args);
}

function handleMermaidAction(...args) {
  return requireMediaPreviewRuntime().handleMermaidAction(...args);
}

function imagePreviewOpen(...args) {
  return requireMediaPreviewRuntime().imagePreviewOpen(...args);
}

function imagePreviewScaleLabel(...args) {
  return requireMediaPreviewRuntime().imagePreviewScaleLabel(...args);
}

function applyImagePreviewScale(...args) {
  return requireMediaPreviewRuntime().applyImagePreviewScale(...args);
}

function imagePreviewTitleForImage(...args) {
  return requireMediaPreviewRuntime().imagePreviewTitleForImage(...args);
}

function openImagePreviewFromImage(...args) {
  return requireMediaPreviewRuntime().openImagePreviewFromImage(...args);
}

function closeImagePreview(...args) {
  return requireMediaPreviewRuntime().closeImagePreview(...args);
}

function handleImagePreviewAction(...args) {
  return requireMediaPreviewRuntime().handleImagePreviewAction(...args);
}

function previewableImageFromEvent(...args) {
  return requireMediaPreviewRuntime().previewableImageFromEvent(...args);
}

function touchDistance(...args) {
  return requireMediaPreviewRuntime().touchDistance(...args);
}

function touchCenter(...args) {
  return requireMediaPreviewRuntime().touchCenter(...args);
}

function pinchStateFromTouches(...args) {
  return requireMediaPreviewRuntime().pinchStateFromTouches(...args);
}

function anchorOptionsFromTouches(...args) {
  return requireMediaPreviewRuntime().anchorOptionsFromTouches(...args);
}

function beginImagePreviewPinch(...args) {
  return requireMediaPreviewRuntime().beginImagePreviewPinch(...args);
}

function moveImagePreviewPinch(...args) {
  return requireMediaPreviewRuntime().moveImagePreviewPinch(...args);
}

function finishImagePreviewPinch(...args) {
  return requireMediaPreviewRuntime().finishImagePreviewPinch(...args);
}

function beginMermaidPinch(...args) {
  return requireMediaPreviewRuntime().beginMermaidPinch(...args);
}

function moveMermaidPinch(...args) {
  return requireMediaPreviewRuntime().moveMermaidPinch(...args);
}

function finishMermaidPinch(...args) {
  return requireMediaPreviewRuntime().finishMermaidPinch(...args);
}

function renderThreadTaskCardDraftMessage(...args) {
  return requireMediaPreviewRuntime().renderThreadTaskCardDraftMessage(...args);
}

function closeFilePreview(...args) {
  return requireMediaPreviewRuntime().closeFilePreview(...args);
}

function filePreviewOpen(...args) {
  return requireMediaPreviewRuntime().filePreviewOpen(...args);
}

function beginFilePreviewSwipe(...args) {
  return requireMediaPreviewRuntime().beginFilePreviewSwipe(...args);
}

function moveFilePreviewSwipe(...args) {
  return requireMediaPreviewRuntime().moveFilePreviewSwipe(...args);
}

function finishFilePreviewSwipe(...args) {
  return requireMediaPreviewRuntime().finishFilePreviewSwipe(...args);
}

function cancelFilePreviewSwipe(...args) {
  return requireMediaPreviewRuntime().cancelFilePreviewSwipe(...args);
}

function filePreviewMetaText(...args) {
  return requireMediaPreviewRuntime().filePreviewMetaText(...args);
}

function filePreviewContentUrl(...args) {
  return requireMediaPreviewRuntime().filePreviewContentUrl(...args);
}

function hermesPluginProxyPrefixFromPathname(...args) {
  return requireMediaPreviewRuntime().hermesPluginProxyPrefixFromPathname(...args);
}

function hermesPluginProxyPrefix(...args) {
  return requireMediaPreviewRuntime().hermesPluginProxyPrefix(...args);
}

function protectedImageUpstreamPathname(...args) {
  return requireMediaPreviewRuntime().protectedImageUpstreamPathname(...args);
}

function browserApiContentUrl(...args) {
  return requireMediaPreviewRuntime().browserApiContentUrl(...args);
}

function authenticatedApiContentUrl(...args) {
  return requireMediaPreviewRuntime().authenticatedApiContentUrl(...args);
}

function localFilePreviewContentUrl(...args) {
  return requireMediaPreviewRuntime().localFilePreviewContentUrl(...args);
}

function renderJsonPreview(...args) {
  return requireMediaPreviewRuntime().renderJsonPreview(...args);
}

function parseCsvPreviewRows(...args) {
  return requireMediaPreviewRuntime().parseCsvPreviewRows(...args);
}

function renderCsvPreview(...args) {
  return requireMediaPreviewRuntime().renderCsvPreview(...args);
}

function renderFilePreviewContent(...args) {
  return requireMediaPreviewRuntime().renderFilePreviewContent(...args);
}

function imageViewPath(...args) {
  return requireMediaPreviewRuntime().imageViewPath(...args);
}

function imageViewUrl(...args) {
  return requireMediaPreviewRuntime().imageViewUrl(...args);
}

function imageViewContentUrl(...args) {
  return requireMediaPreviewRuntime().imageViewContentUrl(...args);
}

function safeImageViewApiUrl(...args) {
  return requireMediaPreviewRuntime().safeImageViewApiUrl(...args);
}

function safeImageViewFallbackUrl(...args) {
  return requireMediaPreviewRuntime().safeImageViewFallbackUrl(...args);
}

function isImageViewUnavailable(...args) {
  return requireMediaPreviewRuntime().isImageViewUnavailable(...args);
}

function renderImageView(...args) {
  return requireMediaPreviewRuntime().renderImageView(...args);
}

function handleConversationImageError(...args) {
  return requireMediaPreviewRuntime().handleConversationImageError(...args);
}

function handleConversationImageLoad(...args) {
  return requireMediaPreviewRuntime().handleConversationImageLoad(...args);
}

function failedAppImageContainer(...args) {
  return requireMediaPreviewRuntime().failedAppImageContainer(...args);
}

function setRetryingAppImage(...args) {
  return requireMediaPreviewRuntime().setRetryingAppImage(...args);
}

function markFailedAppImage(...args) {
  return requireMediaPreviewRuntime().markFailedAppImage(...args);
}

function clearFailedAppImage(...args) {
  return requireMediaPreviewRuntime().clearFailedAppImage(...args);
}

function imageHadExplicitLoadError(...args) {
  return requireMediaPreviewRuntime().imageHadExplicitLoadError(...args);
}

function isLazyAppImage(...args) {
  return requireMediaPreviewRuntime().isLazyAppImage(...args);
}

function shouldProactivelyMarkFailedImage(...args) {
  return requireMediaPreviewRuntime().shouldProactivelyMarkFailedImage(...args);
}

function protectedGeneratedImageSrc(...args) {
  return requireMediaPreviewRuntime().protectedGeneratedImageSrc(...args);
}

function imageLoadingModeForSource(...args) {
  return requireMediaPreviewRuntime().imageLoadingModeForSource(...args);
}

function shouldRenderProtectedImageDirectly(...args) {
  return requireMediaPreviewRuntime().shouldRenderProtectedImageDirectly(...args);
}

function protectedImageDisplaySrc(...args) {
  return requireMediaPreviewRuntime().protectedImageDisplaySrc(...args);
}

function protectedImageSourceAttribute(...args) {
  return requireMediaPreviewRuntime().protectedImageSourceAttribute(...args);
}

function protectedAppImageElementSrc(...args) {
  return requireMediaPreviewRuntime().protectedAppImageElementSrc(...args);
}

function imageDiagnosticSourceKind(...args) {
  return requireMediaPreviewRuntime().imageDiagnosticSourceKind(...args);
}

function imageDiagnosticSourceHash(...args) {
  return requireMediaPreviewRuntime().imageDiagnosticSourceHash(...args);
}

function imageDiagnosticDetails(...args) {
  return requireMediaPreviewRuntime().imageDiagnosticDetails(...args);
}

function postImageDiagnosticEvent(...args) {
  return requireMediaPreviewRuntime().postImageDiagnosticEvent(...args);
}

function imageStillConnected(...args) {
  return requireMediaPreviewRuntime().imageStillConnected(...args);
}

function protectedAppImageUrlApi(...args) {
  return requireMediaPreviewRuntime().protectedAppImageUrlApi(...args);
}

function revokeProtectedAppImageObjectUrl(...args) {
  return requireMediaPreviewRuntime().revokeProtectedAppImageObjectUrl(...args);
}

function retryProtectedAppImageSource(...args) {
  return requireMediaPreviewRuntime().retryProtectedAppImageSource(...args);
}

function cacheBustedProtectedImageSrc(...args) {
  return requireMediaPreviewRuntime().cacheBustedProtectedImageSrc(...args);
}

function shouldRecoverProtectedImageAsDirectUrl(...args) {
  return requireMediaPreviewRuntime().shouldRecoverProtectedImageAsDirectUrl(...args);
}

function blobToDataUrl(...args) {
  return requireMediaPreviewRuntime().blobToDataUrl(...args);
}

async function protectedAppImageRecoveredUrl(...args) {
  return requireMediaPreviewRuntime().protectedAppImageRecoveredUrl(...args);
}

function applyProtectedAppImageRecoveredUrl(...args) {
  return requireMediaPreviewRuntime().applyProtectedAppImageRecoveredUrl(...args);
}

function shouldHydrateProtectedAppImage(...args) {
  return requireMediaPreviewRuntime().shouldHydrateProtectedAppImage(...args);
}

function hydrateProtectedAppImage(...args) {
  return requireMediaPreviewRuntime().hydrateProtectedAppImage(...args);
}

function hydrateProtectedAppImages(...args) {
  return requireMediaPreviewRuntime().hydrateProtectedAppImages(...args);
}

function handleProtectedAppImageError(...args) {
  return requireMediaPreviewRuntime().handleProtectedAppImageError(...args);
}

function probeFailedAuthenticatedImage(...args) {
  return requireMediaPreviewRuntime().probeFailedAuthenticatedImage(...args);
}

function scanFailedAppImages(...args) {
  return requireMediaPreviewRuntime().scanFailedAppImages(...args);
}

function scheduleFailedAppImageScan(...args) {
  return requireMediaPreviewRuntime().scheduleFailedAppImageScan(...args);
}

function scheduleVisibleImageFailureScan(...args) {
  return requireMediaPreviewRuntime().scheduleVisibleImageFailureScan(...args);
}

function showFilePreviewLoading(...args) {
  return requireMediaPreviewRuntime().showFilePreviewLoading(...args);
}

function localFilePreviewThreadIdFromLink(...args) {
  return requireMediaPreviewRuntime().localFilePreviewThreadIdFromLink(...args);
}

async function openLocalFilePreview(...args) {
  return requireMediaPreviewRuntime().openLocalFilePreview(...args);
}

function nestedStringValue(value, keys, depth = 0, seen = new Set()) {
  if (!value || typeof value !== "object" || depth > 3 || seen.has(value)) return "";
  seen.add(value);
  const wanted = new Set(keys.map((key) => String(key).toLowerCase()));
  for (const [key, entry] of Object.entries(value)) {
    if (wanted.has(String(key).toLowerCase()) && typeof entry === "string" && entry.trim()) return entry;
  }
  for (const entry of Object.values(value)) {
    const found = nestedStringValue(entry, keys, depth + 1, seen);
    if (found) return found;
  }
  return "";
}

function collabAgentTaskText(item) {
  return nestedStringValue(item, ["task", "message", "prompt", "description", "instructions"]);
}

function collabAgentThreadText(item) {
  return nestedStringValue(item, ["targetThread", "targetThreadId", "threadId", "agentThreadId", "modelThread"]);
}

function collabAgentNameText(item) {
  return nestedStringValue(item, ["name", "agentName", "nickname", "role", "agentType", "agent_type"]);
}

function collabAgentMetaPill(label, value) {
  if (!value) return "";
  return `<span class="collab-agent-pill"><span>${escapeHtml(label)}</span>${escapeHtml(value)}</span>`;
}

function renderCollabAgentToolCall(item) {
  const tool = item.tool || item.name || "collabAgentToolCall";
  const status = statusText(item.status);
  const thread = collabAgentThreadText(item);
  const agentName = collabAgentNameText(item);
  const task = collabAgentTaskText(item);
  const raw = JSON.stringify(item, null, 2);
  const rawCopyButton = copyButtonHtml(rememberCopyText(raw), "复制", "output-copy-button");
  const pills = [
    collabAgentMetaPill("工具", tool),
    collabAgentMetaPill("状态", status),
    collabAgentMetaPill("Agent", agentName),
    collabAgentMetaPill("线程", thread),
  ].filter(Boolean).join("");
  return `<div class="collab-agent-card">
    <div class="collab-agent-title">${escapeHtml(tool === "spawnAgent" ? "协作 Agent 已启动" : "协作 Agent 调用")}</div>
    ${pills ? `<div class="collab-agent-meta">${pills}</div>` : ""}
    ${task ? `<div class="collab-agent-task">${escapeHtml(truncateMiddle(task, 260, "task"))}</div>` : ""}
    <details class="output-details collab-agent-raw">
      <summary><span>${escapeHtml(`原始 JSON: ${raw.length.toLocaleString()} chars`)}</span>${rawCopyButton}</summary>
      <pre>${escapeHtml(raw)}</pre>
    </details>
  </div>`;
}

function formatTokenCount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : "--";
}

function formatCompactTokenCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  const absolute = Math.abs(number);
  if (absolute >= 1000000) {
    const value = number / 1000000;
    const scaledAbsolute = absolute / 1000000;
    return `${scaledAbsolute >= 10 ? value.toFixed(1) : value.toFixed(2)}M`;
  }
  if (absolute >= 1000) {
    const value = number / 1000;
    const scaledAbsolute = absolute / 1000;
    return `${scaledAbsolute >= 100 ? Math.round(value) : value.toFixed(1)}K`;
  }
  return `${Math.round(number)}`;
}

function displayInputTokensExcludingCached(usage) {
  const input = Number(usage && usage.inputTokens);
  if (!Number.isFinite(input)) return usage && usage.inputTokens;
  const cached = Number(usage && usage.cachedInputTokens);
  if (!Number.isFinite(cached)) return input;
  return Math.max(0, input - cached);
}

function formatUsagePercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  if (number < 10) return `${number.toFixed(1)}%`;
  return `${Math.round(number)}%`;
}

function tokenUsageSummaryText(usage) {
  const value = usage && typeof usage === "object" ? usage : {};
  const parts = [
    `in ${formatCompactTokenCount(value.inputTokens)}`,
    `out ${formatCompactTokenCount(value.outputTokens)}`,
    `total ${formatCompactTokenCount(value.totalTokens)}`,
    value.cachedInputTokens !== undefined ? `cached ${formatCompactTokenCount(value.cachedInputTokens)} in input` : "",
    value.reasoningOutputTokens !== undefined ? `reasoning ${formatCompactTokenCount(value.reasoningOutputTokens)} in output` : "",
  ].filter(Boolean);
  return parts.join(" / ");
}

function tokenUsageAdditiveDetail(usage) {
  const value = usage && typeof usage === "object" ? usage : {};
  const parts = [
    `input ${formatCompactTokenCount(value.inputTokens)}`,
    `output ${formatCompactTokenCount(value.outputTokens)}`,
  ].filter((part) => !part.endsWith(" --"));
  return parts.join(" + ");
}

function tokenUsageIncludedDetail(usage) {
  const value = usage && typeof usage === "object" ? usage : {};
  return [
    value.cachedInputTokens !== undefined ? `cached ${formatCompactTokenCount(value.cachedInputTokens)} in input` : "",
    value.reasoningOutputTokens !== undefined ? `reasoning ${formatCompactTokenCount(value.reasoningOutputTokens)} in output` : "",
  ].filter(Boolean).join(" / ");
}

function contextRiskLabel(level) {
  const map = {
    normal: "normal",
    warn: "watch",
    high: "high",
    critical: "critical",
    unknown: "unknown",
  };
  return map[level] || "unknown";
}

function renderUsageMetric(label, value, detail = "") {
  return `<div class="turn-usage-metric">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
    ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
  </div>`;
}

function renderUsageBarPill(kind, label, value) {
  return `<span class="turn-usage-pill ${escapeHtml(kind)}">
    <span class="turn-usage-pill-dot"></span>
    <span>${escapeHtml([value, label].filter(Boolean).join(" "))}</span>
  </span>`;
}

function renderUsageTokenCell(kind, label, value, detail = "") {
  return `<div class="turn-usage-token-cell">
    <span><span class="turn-usage-token-dot ${escapeHtml(kind)}"></span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
    ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
  </div>`;
}

function renderUsageProgress(percent, label) {
  const value = clampPercent(percent);
  return `<div class="turn-usage-progress" style="--usage-progress:${value.toFixed(2)}%">
    <div class="turn-usage-progress-track"><span></span></div>
    <small>${escapeHtml(label)}</small>
  </div>`;
}

function renderUsageCompactMetric(label, value, detail = "", extraClass = "") {
  const className = ["turn-usage-compact-metric", extraClass].filter(Boolean).join(" ");
  return `<div class="${escapeHtml(className)}">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
    ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
  </div>`;
}

function renderTurnUsageSummary(item) {
  const summary = item && item.mobileUsageSummary && typeof item.mobileUsageSummary === "object"
    ? item.mobileUsageSummary
    : {};
  const contextTokens = Number(summary.contextWindowUsedTokens);
  const contextWindow = Number(summary.modelContextWindow);
  const contextDetail = Number.isFinite(contextTokens) && Number.isFinite(contextWindow) && contextWindow > 0
    ? `${formatCompactTokenCount(contextTokens)} / ${formatCompactTokenCount(contextWindow)}`
    : "";
  const totalTokenUsage = summary.totalTokenUsage || {};
  const totalUsageDetail = [
    tokenUsageAdditiveDetail(totalTokenUsage),
    tokenUsageIncludedDetail(totalTokenUsage),
  ].filter(Boolean).join(" / ");
  const rolloutSize = Number(summary.rolloutSizeBytes);
  const rolloutThreshold = Number(summary.rolloutWarningThresholdBytes);
  const projectContextSize = Number(summary.projectContextSizeBytes);
  const handoffSize = Number(summary.handoffSizeBytes);
  const pairSize = Number(summary.workspaceContextPairSizeBytes);
  const fileThreshold = Number(summary.workspaceContextFileThresholdBytes);
  const handoffThreshold = Number(summary.workspaceHandoffPromptThresholdBytes || summary.workspaceContextFileThresholdBytes);
  const pairThreshold = Number(summary.workspaceContextPairThresholdBytes);
  const contextRisk = (Number.isFinite(pairSize) && Number.isFinite(pairThreshold) && pairThreshold > 0 && pairSize >= pairThreshold)
    || (Number.isFinite(projectContextSize) && Number.isFinite(fileThreshold) && fileThreshold > 0 && projectContextSize >= fileThreshold)
    || (Number.isFinite(handoffSize) && Number.isFinite(handoffThreshold) && handoffThreshold > 0 && handoffSize >= handoffThreshold);
  const rolloutRisk = Boolean(summary.rolloutOverWarningThreshold)
    || (Number.isFinite(rolloutSize) && Number.isFinite(rolloutThreshold) && rolloutThreshold > 0 && rolloutSize >= rolloutThreshold);
  const contextDetailFiles = [];
  if (Number.isFinite(pairSize) && pairSize > 0) contextDetailFiles.push(`pair ${formatFileSize(pairSize)}`);
  if (Number.isFinite(fileThreshold) && fileThreshold > 0) contextDetailFiles.push(`warn ${formatFileSize(fileThreshold)}`);
  const handoffDetail = Number.isFinite(handoffThreshold) && handoffThreshold > 0
    ? `warn ${formatFileSize(handoffThreshold)}`
    : "";
  const compactButton = (contextRisk || rolloutRisk)
    ? `<button class="turn-usage-new-thread" type="button" data-new-thread-from-current>压缩续接</button>`
    : "";
  const risk = contextRiskLabel(summary.contextRiskLevel || "unknown");
  const contextPercent = clampPercent(summary.contextWindowUsedPercent);
  const ringOffset = (100 - contextPercent).toFixed(2);
  const lastTurnUsage = summary.lastTokenUsage || {};
  const lastInputDetail = lastTurnUsage.cachedInputTokens !== undefined
    ? `cached ${formatCompactTokenCount(lastTurnUsage.cachedInputTokens)} included`
    : "";
  const lastOutputDetail = lastTurnUsage.reasoningOutputTokens !== undefined
    ? `reasoning ${formatCompactTokenCount(lastTurnUsage.reasoningOutputTokens)} included`
    : "";
  const projectContextMetric = renderUsageCompactMetric(
    "project ctx file",
    Number.isFinite(projectContextSize) && projectContextSize > 0 ? formatFileSize(projectContextSize) : "--",
    contextDetailFiles.join(" | "),
  );
  const handoffMetric = renderUsageCompactMetric(
    "handoff file",
    Number.isFinite(handoffSize) && handoffSize > 0 ? formatFileSize(handoffSize) : "--",
    handoffDetail,
  );
  const rolloutPercent = Number.isFinite(rolloutSize) && Number.isFinite(rolloutThreshold) && rolloutThreshold > 0
    ? clampPercent((rolloutSize / rolloutThreshold) * 100)
    : 0;
  return `<details class="turn-usage-summary risk-${escapeHtml(risk)}">
    <summary class="turn-usage-bar">
      <span class="turn-usage-pills">
        ${renderUsageBarPill(risk === "normal" || risk === "unknown" ? "context" : "warn", "ctx", formatUsagePercent(summary.contextWindowUsedPercent))}
        ${renderUsageBarPill("thread", "thr", formatCompactTokenCount(totalTokenUsage.totalTokens))}
        ${renderUsageBarPill("rollout", "", Number.isFinite(rolloutSize) ? formatFileSize(rolloutSize) : "--")}
        ${renderUsageBarPill(`status status-${risk}`, "", risk)}
      </span>
    </summary>
    <div class="turn-usage-expanded">
      <div class="turn-usage-top-grid">
        <div class="turn-usage-context-card">
          <div class="turn-usage-ring" style="--usage-ring-offset:${ringOffset}">
            <svg viewBox="0 0 72 72" aria-hidden="true">
              <circle class="turn-usage-ring-bg" cx="36" cy="36" r="28" pathLength="100"></circle>
              <circle class="turn-usage-ring-fill" cx="36" cy="36" r="28" pathLength="100"></circle>
            </svg>
            <div>
              <strong>${escapeHtml(formatUsagePercent(summary.contextWindowUsedPercent))}</strong>
            </div>
          </div>
          <div>
            <span>Context Window</span>
            <strong>${escapeHtml(formatCompactTokenCount(contextTokens))}</strong>
            <small>${contextDetail ? escapeHtml(contextDetail) : "window usage unavailable"}</small>
          </div>
        </div>
        <div class="turn-usage-rollout-card">
          <div>
            <span>Rollout</span>
            <strong>${escapeHtml(Number.isFinite(rolloutSize) ? formatFileSize(rolloutSize) : "--")}</strong>
          </div>
          ${renderUsageProgress(rolloutPercent, Number.isFinite(rolloutThreshold) && rolloutThreshold > 0 ? `of ${formatFileSize(rolloutThreshold)}` : "threshold unavailable")}
        </div>
      </div>
      <div class="turn-usage-token-grid">
        ${renderUsageTokenCell("input", "Input", formatCompactTokenCount(lastTurnUsage.inputTokens), lastInputDetail)}
        ${renderUsageTokenCell("output", "Output", formatCompactTokenCount(lastTurnUsage.outputTokens), lastOutputDetail)}
      </div>
      <div class="turn-usage-grid">
        ${renderUsageCompactMetric("thread total", formatCompactTokenCount(totalTokenUsage.totalTokens), totalUsageDetail, "is-thread-total")}
        ${projectContextMetric}
        ${handoffMetric}
      </div>
      ${compactButton ? `<div class="turn-usage-actions">${compactButton}</div>` : ""}
    </div>
  </details>`;
}

function renderItemBody(item, turn = null) {
  if (isContextCompactionItem(item)) return escapeHtml(contextCompactionNotice(item, turn));
  if (item.type === "turnUsageSummary") return renderTurnUsageSummary(item);
  if (item.type === "userMessage") return renderUserMessageBody(item);
  if (item.type === "agentMessage") {
    return renderThreadTaskCardDraftMessage(item.text || "", item, turn) || renderMarkdownWithAttachmentSummary(item.text || "");
  }
  if (isTurnDiagnosticItem(item)) return renderTurnDiagnostic(item);
  if (item.type === "reasoning") {
    const summary = (item.summary || []).join("\n");
    const content = (item.content || []).join("\n");
    return escapeHtml([summary, content].filter(Boolean).join("\n\n"));
  }
  if (item.type === "plan") return renderThreadTaskCardDraftMessage(item.text || "", item, turn) || renderMarkdownWithAttachmentSummary(item.text || "");
  if (item.type === "imageView") return renderImageView(item);
  if (item.type === "imageGeneration") return renderImageView(item);
  if (item.type === "commandExecution") {
    return `<div class="mono">${escapeHtml(item.command || "")}</div>${renderOutputBlock(item.aggregatedOutput, item)}`;
  }
  if (item.type === "fileChange") {
    return renderStructuredBlock(item.changes || [], `${Array.isArray(item.changes) ? item.changes.length : 0} change(s)`);
  }
  if (item.type === "collabAgentToolCall") return renderCollabAgentToolCall(item);
  if (item.type === "dynamicToolCall" || item.type === "mcpToolCall") {
    return `<div class="mono">${escapeHtml(JSON.stringify(item.arguments || {}, null, 2))}</div>${renderStructuredBlock(item.result || item.contentItems, "Tool result")}`;
  }
  return escapeHtml(JSON.stringify(item, null, 2));
}

function renderUserMessageBody(item) {
  const body = renderInputContent(item && item.content);
  const errorMessage = String(item && item.mobileSendError && item.mobileSendError.message || "").trim();
  if (!errorMessage) return body;
  return `${body}<div class="send-error-receipt" role="status">${escapeHtml(`发送失败：${errorMessage}`)}</div>`;
}

function renderTurnDiagnostic(item) {
  const title = String(item && item.title || "Codex runtime diagnostic");
  const message = String(item && item.message || "Codex runtime ended this turn without visible response content.");
  const code = String(item && item.code || "");
  const severity = String(item && item.severity || "warning");
  return `<div class="turn-diagnostic-body ${escapeHtml(severity)}">
    <div class="turn-diagnostic-title">${escapeHtml(title)}</div>
    <div class="turn-diagnostic-message">${escapeHtml(message)}</div>
    ${code ? `<div class="turn-diagnostic-code">${escapeHtml(code)}</div>` : ""}
  </div>`;
}

function renderOutputBlock(output, item = {}) {
  if (!output && item.outputOmitted) {
    const total = item.outputTotalChars || 0;
    const omittedText = "This command output is still in the Codex session history. It is omitted here to keep the mobile client responsive.";
    return `<details class="output-details">
      <summary><span>${escapeHtml(`Output omitted from mobile view: ${Number(total).toLocaleString()} chars`)}</span>${copyButtonHtml(rememberCopyText(omittedText), "复制", "output-copy-button")}</summary>
      <pre>${escapeHtml(omittedText)}</pre>
    </details>`;
  }
  if (!output) return "";
  const outputText = String(output);
  const markdownPreview = commandOutputMarkdownPreview(outputText, item);
  const total = item.outputTotalChars || String(output).length;
  const truncated = item.outputTruncated || total > outputText.length;
  const summary = truncated
    ? `Output preview: ${total.toLocaleString()} chars total, showing latest ${outputText.length.toLocaleString()}`
    : `Output: ${outputText.length.toLocaleString()} chars`;
  return `${markdownPreview ? `<div class="command-output-markdown-preview">${renderMarkdown(markdownPreview, { orderedListMode: "source" })}</div>` : ""}<details class="output-details">
    <summary><span>${escapeHtml(summary)}</span>${copyButtonHtml(rememberCopyText(outputText), "复制", "output-copy-button")}</summary>
    <pre>${escapeHtml(outputText)}</pre>
  </details>`;
}

function renderStructuredBlock(value, label) {
  if (!value) return "";
  if (value.truncated && value.preview) {
    const preview = String(value.preview || "");
    return `<details class="output-details">
      <summary><span>${escapeHtml(`${label}: ${Number(value.totalChars || 0).toLocaleString()} chars total, preview`)}</span>${copyButtonHtml(rememberCopyText(preview), "复制", "output-copy-button")}</summary>
      <pre>${escapeHtml(preview)}</pre>
    </details>`;
  }
  const raw = JSON.stringify(value, null, 2);
  if (!raw || raw === "null") return "";
  return `<details class="output-details">
    <summary><span>${escapeHtml(`${label}: ${raw.length.toLocaleString()} chars`)}</span>${copyButtonHtml(rememberCopyText(raw), "复制", "output-copy-button")}</summary>
    <pre>${escapeHtml(raw)}</pre>
  </details>`;
}

function ensureTurn(turnId) {
  const thread = state.currentThread;
  if (!thread) return null;
  thread.turns = thread.turns || [];
  let turn = thread.turns.find((x) => x.id === turnId);
  if (!turn) {
    turn = { id: turnId, items: [], status: { type: "running" }, error: null, startedAt: Math.floor(Date.now() / 1000), completedAt: null, durationMs: null };
    thread.turns.push(turn);
  }
  return turn;
}

function shouldDeferLiveFinalReceipt(turn, itemType) {
  // Live assistant text must remain visible even while command/file operation
  // bubbles are active; receipt stabilization is handled by merge/patch policy.
  return false;
}

function createConversationRenderRuntime() {
  return {
    renderLiveOperationDock: typeof renderLiveOperationDock === "function" ? renderLiveOperationDock : null,
    renderTurnVisibleItemBudgetNotice: typeof renderTurnVisibleItemBudgetNotice === "function" ? renderTurnVisibleItemBudgetNotice : null,
    renderTurn: typeof renderTurn === "function" ? renderTurn : null,
    renderMobileOperationStack: typeof renderMobileOperationStack === "function" ? renderMobileOperationStack : null,
    renderItem: typeof renderItem === "function" ? renderItem : null,
    renderItemBody: typeof renderItemBody === "function" ? renderItemBody : null,
    renderUserMessageBody: typeof renderUserMessageBody === "function" ? renderUserMessageBody : null,
    renderTurnUsageSummary: typeof renderTurnUsageSummary === "function" ? renderTurnUsageSummary : null,
    ensureTurn: typeof ensureTurn === "function" ? ensureTurn : null,
    shouldDeferLiveFinalReceipt: typeof shouldDeferLiveFinalReceipt === "function" ? shouldDeferLiveFinalReceipt : null,
  };
}

(function exposeCodexConversationRenderRuntime(root) {
  const conversationRenderRuntimeApi = { createConversationRenderRuntime };
  const legacyGlobals = {
    renderLiveOperationDock,
    renderTurnVisibleItemBudgetNotice,
    renderTurn,
    renderLiveOperation,
    renderOperationCard,
    operationDurationHtml,
    operationBubbleSummary,
    renderMobileOperationStack,
    operationTitle,
    operationDetailText,
    truncateSingleLine,
    normalizeOperationIdentityValue,
    stripMatchingOuterQuotes,
    operationArgumentsObject,
    operationCommandText,
    operationCommandSummary,
    operationCommandName,
    operationCommandGroupText,
    operationRawFileNames,
    operationFileNames,
    operationGroupKey,
    collectSearchSummaries,
    operationSearchSummary,
    operationSummaryLines,
    displayTurnStatus,
    renderContextCompaction,
    renderItem,
    renderInjectedThreadTaskCardItem,
    renderItemTimestampHtml,
    itemTimestampMs,
    turnStartedAtMs,
    renderLiveReasoning,
    labelForItem,
    copyTextForItem,
    requireMediaPreviewRuntime,
    imageUrlValue,
    isInputTextPart,
    inputTextValue,
    isInputImagePart,
    isTruncatedImagePayloadPart,
    attachmentSummaryMarkerMatch,
    stripAttachmentSummaryLinePrefix,
    splitAttachmentSummaryText,
    parseAttachmentLine,
    codexMobileUploadIdForPath,
    uploadFileUrl,
    isCodexMobileUploadPath,
    imageContentUrlForPath,
    localAttachmentPreviewUrl,
    imageSourceForPart,
    isLikelyAbsoluteLocalPath,
    canRenderImageAttachment,
    isInjectedThreadTaskCardMessage,
    injectedThreadTaskCardLineValue,
    injectedThreadTaskCardPurpose,
    injectedThreadTaskCardMetadata,
    injectedThreadTaskCardSummary,
    injectedThreadTaskCardTextForItem,
    renderInjectedThreadTaskCardBody,
    renderInjectedThreadTaskCardMessage,
    renderInputText,
    renderInputImage,
    renderInputAttachment,
    renderAttachmentSummary,
    renderInputContent,
    renderMarkdown,
    renderMarkdownWithAttachmentSummary,
    commandOutputBody,
    stripCommandOutputLineNumbers,
    isMarkdownTableSeparatorLine,
    containsMarkdownTable,
    commandOutputMarkdownPreview,
    normalizeGitHubLinkPreview,
    normalizeGithubPreviewUrl,
    gitHubLinkPreviewAccentClass,
    renderGitHubLinkPreviewCard,
    githubLinkPreviewHosts,
    gitHubLinkPreviewSummary,
    gitHubLinkPreviewInlineHost,
    gitHubLinkPreviewInsertContainer,
    renderCollapsedGitHubLinkPreview,
    ensureInlineGitHubLinkPreviews,
    renderGitHubLinkPreviewUnavailable,
    setGitHubPreviewCompactExpanded,
    updateGitHubPreviewCompactTitle,
    toggleGitHubLinkPreview,
    hydrateGitHubLinkCards,
    mermaidEffectiveTheme,
    mermaidThemeName,
    mermaidConfig,
    mermaidPreviewOpen,
    loadRuntimeScript,
    configureMermaidApi,
    mermaidCanvas,
    mermaidViewer,
    mermaidSourceFromContainer,
    mermaidResetButton,
    updateMermaidResetLabel,
    clampMermaidScale,
    mermaidCurrentScale,
    mermaidSvgSize,
    mermaidInitialScale,
    applyMermaidScale,
    showMermaidLoading,
    showMermaidError,
    isMermaidErrorSvgMarkup,
    mermaidRenderArtifactIds,
    isOwnedMermaidRenderNode,
    removeNodeIfExternalMermaidArtifact,
    cleanupMermaidRenderArtifacts,
    cleanupExternalMermaidErrorArtifacts,
    renderMermaidSvg,
    mermaidRenderCandidates,
    hydrateMermaidBlock,
    hydrateMermaidDiagrams,
    rerenderVisibleMermaidDiagrams,
    installMermaidThemeObserver,
    mermaidActionContainer,
    mermaidContainerFromViewer,
    resetMermaidScale,
    openMermaidPreview,
    closeMermaidPreview,
    handleMermaidAction,
    imagePreviewOpen,
    imagePreviewScaleLabel,
    applyImagePreviewScale,
    imagePreviewTitleForImage,
    openImagePreviewFromImage,
    closeImagePreview,
    handleImagePreviewAction,
    previewableImageFromEvent,
    touchDistance,
    touchCenter,
    pinchStateFromTouches,
    anchorOptionsFromTouches,
    beginImagePreviewPinch,
    moveImagePreviewPinch,
    finishImagePreviewPinch,
    beginMermaidPinch,
    moveMermaidPinch,
    finishMermaidPinch,
    renderThreadTaskCardDraftMessage,
    closeFilePreview,
    filePreviewOpen,
    beginFilePreviewSwipe,
    moveFilePreviewSwipe,
    finishFilePreviewSwipe,
    cancelFilePreviewSwipe,
    filePreviewMetaText,
    filePreviewContentUrl,
    hermesPluginProxyPrefixFromPathname,
    hermesPluginProxyPrefix,
    protectedImageUpstreamPathname,
    browserApiContentUrl,
    authenticatedApiContentUrl,
    localFilePreviewContentUrl,
    renderJsonPreview,
    parseCsvPreviewRows,
    renderCsvPreview,
    renderFilePreviewContent,
    imageViewPath,
    imageViewUrl,
    imageViewContentUrl,
    safeImageViewApiUrl,
    safeImageViewFallbackUrl,
    isImageViewUnavailable,
    renderImageView,
    handleConversationImageError,
    handleConversationImageLoad,
    failedAppImageContainer,
    setRetryingAppImage,
    markFailedAppImage,
    clearFailedAppImage,
    imageHadExplicitLoadError,
    isLazyAppImage,
    shouldProactivelyMarkFailedImage,
    protectedGeneratedImageSrc,
    imageLoadingModeForSource,
    shouldRenderProtectedImageDirectly,
    protectedImageDisplaySrc,
    protectedImageSourceAttribute,
    protectedAppImageElementSrc,
    imageDiagnosticSourceKind,
    imageDiagnosticSourceHash,
    imageDiagnosticDetails,
    postImageDiagnosticEvent,
    imageStillConnected,
    protectedAppImageUrlApi,
    revokeProtectedAppImageObjectUrl,
    retryProtectedAppImageSource,
    cacheBustedProtectedImageSrc,
    shouldRecoverProtectedImageAsDirectUrl,
    blobToDataUrl,
    applyProtectedAppImageRecoveredUrl,
    shouldHydrateProtectedAppImage,
    hydrateProtectedAppImage,
    hydrateProtectedAppImages,
    handleProtectedAppImageError,
    probeFailedAuthenticatedImage,
    scanFailedAppImages,
    scheduleFailedAppImageScan,
    scheduleVisibleImageFailureScan,
    showFilePreviewLoading,
    localFilePreviewThreadIdFromLink,
    nestedStringValue,
    collabAgentTaskText,
    collabAgentThreadText,
    collabAgentNameText,
    collabAgentMetaPill,
    renderCollabAgentToolCall,
    formatTokenCount,
    formatCompactTokenCount,
    displayInputTokensExcludingCached,
    formatUsagePercent,
    tokenUsageSummaryText,
    tokenUsageAdditiveDetail,
    tokenUsageIncludedDetail,
    contextRiskLabel,
    renderUsageMetric,
    renderUsageBarPill,
    renderUsageTokenCell,
    renderUsageProgress,
    renderUsageCompactMetric,
    renderTurnUsageSummary,
    renderItemBody,
    renderUserMessageBody,
    renderTurnDiagnostic,
    renderOutputBlock,
    renderStructuredBlock,
    ensureTurn,
    shouldDeferLiveFinalReceipt,
    createConversationRenderRuntime,
  };
  if (typeof module === "object" && module.exports) {
    module.exports = conversationRenderRuntimeApi;
  }
  Object.assign(root, legacyGlobals);
  root.CodexConversationRenderRuntime = conversationRenderRuntimeApi;
})(typeof globalThis !== "undefined" ? globalThis : window);
