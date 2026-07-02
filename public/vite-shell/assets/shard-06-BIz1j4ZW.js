import { i as __toESM, r as __commonJSMin } from "./vite-shell-entry-CVPJRGZ_.js";
//#region public/conversation-render-runtime.js
var require_conversation_render_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function renderLiveOperationDock(thread, previousKeys = /* @__PURE__ */ new Set()) {
		const entry = currentLiveOperationEntry(thread);
		if (!entry) return "";
		const expanded = normalizeLiveOperationDockMode(state.liveOperationDockMode) === "expanded";
		return `<div class="live-operation-dock-inner">
    ${entry.item && entry.item.type !== "liveTurnStatus" ? renderMobileOperationStack(entry.item, entry.turn, previousKeys, entry.sourceIndex, expanded) : ""}
    <div class="live-operation-dock-desktop">
      <div class="live-operation-dock-controls">
        <button type="button" data-live-operation-dock-toggle aria-expanded="${String(expanded)}" title="${expanded ? "收起 Command 框" : "展开 Command 框"}" aria-label="${expanded ? "收起 Command 框" : "展开 Command 框"}">${expanded ? "↓" : "↑"}</button>
      </div>
      ${renderLiveOperation(entry.item, entry.turn, previousKeys, entry.sourceIndex)}
    </div>
  </div>`;
	}
	function renderTurnVisibleItemBudgetNotice(turn, previousKeys = /* @__PURE__ */ new Set()) {
		const budget = visibleItemBudgetForTurn(turn);
		if (!budget) return "";
		const key = stableTurnKey(turn, "visible-budget");
		const label = budget.omitted === 1 ? "已折叠 1 条首屏操作细节" : `已折叠 ${budget.omitted} 条首屏操作细节`;
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
	function renderTurn(turn, previousKeys = /* @__PURE__ */ new Set()) {
		const thread = renderContextThread();
		const renderedItems = visibleItemsForTurn(turn, thread).map((entry, index) => {
			const item = entry.item;
			const sourceIndex = Number.isInteger(entry.sourceIndex) && entry.sourceIndex >= 0 ? entry.sourceIndex : index;
			let html = "";
			html = renderVisibleItemPatchHtml(turn, item, previousKeys, sourceIndex, thread);
			return {
				html,
				sourceIndex,
				order: 1
			};
		}).filter((entry) => entry && entry.html);
		const budgetNoticeHtml = renderTurnVisibleItemBudgetNotice(turn, previousKeys);
		const items = renderedItems.sort((a, b) => a.sourceIndex - b.sourceIndex || a.order - b.order).map((entry) => entry.html).join("");
		const threadId = renderContextThreadId();
		const turnApprovals = approvalsForTurn(threadId, turn.id);
		const approvalsHtml = turnApprovals.length ? `<div class="approval-stack in-turn">${turnApprovals.map((request) => renderApprovalRequest(request, previousKeys, threadId)).join("")}</div>` : "";
		const draftHtml = renderTurnThreadTaskCardDraft(turn, previousKeys, thread);
		const pendingDraftHtml = !draftHtml && !turnHasThreadTaskCardDraftResponse(turn) && isLatestTurn(turn, thread) && isLiveTurn(turn, thread) && turnHasThreadTaskCardRequest(turn) ? renderPendingThreadTaskCardDraft("Generating cross-thread task card draft...", "Generating") : "";
		if (!budgetNoticeHtml.trim() && !items.trim() && !approvalsHtml.trim() && !draftHtml.trim() && !pendingDraftHtml.trim()) return "";
		const turnKey = stableTurnKey(turn);
		const statusKey = stableTurnKey(turn, "status");
		const duration = turn.durationMs ? ` | ${formatElapsedTime(Math.round(turn.durationMs / 1e3))}` : "";
		const showStatusLine = !(isLatestTurn(turn, thread) && (isLiveTurn(turn, thread) || turnFinalSeconds(turn) != null));
		return `<article class="turn" data-turn="${escapeHtml(turn.id)}" data-render-key="${escapeHtml(turnKey)}">
    ${budgetNoticeHtml}${items}${approvalsHtml}
    ${showStatusLine ? `<div class="turn-status${entryAnimationClass(statusKey, previousKeys)}" data-render-key="${escapeHtml(statusKey)}">${escapeHtml(displayTurnStatus(turn))}${duration}</div>` : ""}
    ${draftHtml}${pendingDraftHtml}
  </article>`;
	}
	function renderLiveOperation(item, turn, previousKeys = /* @__PURE__ */ new Set(), index = 0) {
		const status = item && item.type === "liveTurnStatus" ? "" : statusText(item.status) || (item.completedAtMs ? "completed" : "running");
		return renderOperationCard(item, stableOperationRenderKey(turn, item, index), { status });
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
			escapeHtml
		});
	}
	function operationDurationHtml(item, status = "", className = "operation-duration") {
		const durationData = operationDurationData(item, status);
		return durationData ? `<time class="${escapeHtml(className)}" ${operationDurationAttrs(durationData)} title="${escapeHtml(`Elapsed ${durationData.text}`)}">${escapeHtml(durationData.text)}</time>` : "";
	}
	function operationBubbleSummary(item) {
		return truncateSingleLine(operationSummaryLines(item).filter(Boolean).join(" | "), 52);
	}
	function renderMobileOperationStack(item, turn, previousKeys = /* @__PURE__ */ new Set(), index = 0, expanded = false, options = {}) {
		const status = statusText(item.status) || (item.completedAtMs ? "completed" : "running");
		const key = stableOperationRenderKey(turn, item, index);
		const title = operationTitle(item);
		const summary = operationBubbleSummary(item);
		const duration = operationDurationHtml(item, status, "operation-duration mobile-operation-bubble-duration");
		const toggleName = String(options.toggleAttribute || "data-live-operation-dock-toggle").trim();
		const toggleValue = String(options.toggleValue || "");
		const toggleAttr = toggleName ? `${escapeHtml(toggleName)}${toggleValue ? `="${escapeHtml(toggleValue)}"` : ""}` : "data-live-operation-dock-toggle";
		return `<div class="mobile-operation-stack">
    <div class="mobile-operation-sheet" role="region" aria-label="Command 详情">
      ${renderOperationCard(item, key, {
			status,
			extraClass: "mobile-operation-sheet-card"
		})}
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
			if (first === "\"" && last === "\"" || first === "'" && last === "'") return text.slice(1, -1).trim();
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
		const direct = Array.isArray(item && item.command) ? item.command.join(" ") : String(item && item.command || "");
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
		if (/(?:^|\s)-(?:EncodedCommand|enc|e)\b/i.test(raw) && /(?:powershell|pwsh)(?:\.exe)?/i.test(raw)) return "PowerShell -EncodedCommand";
		return truncateSingleLine(raw, 180);
	}
	function operationCommandName(item) {
		const raw = operationCommandText(item).trim();
		if (!raw) return "";
		const quoted = raw.match(/^["']([^"']+)["']/);
		const token = quoted ? quoted[1] : raw.split(/\s+/, 1)[0];
		return shortPath(stripMatchingOuterQuotes(token)) || stripMatchingOuterQuotes(token);
	}
	function operationCommandGroupText(item) {
		return operationCommandName(item);
	}
	function operationRawFileNames(item) {
		const values = Array.isArray(item.fileNames) && item.fileNames.length ? item.fileNames : collectFileNames(item.changes || item.arguments || item.result || item.contentItems);
		return [...new Set(values.map((name) => String(name || "").trim()).filter(Boolean))].slice(0, 5);
	}
	function operationFileNames(item) {
		return operationRawFileNames(item).map((name) => truncateSingleLine(shortPath(name), 72)).filter(Boolean);
	}
	function operationGroupKey(item) {
		if (!item || !isOperationalItem(item)) return "";
		const type = isWebSearchLikeItem(item) ? "webSearch" : item.type || "item";
		const fileNames = operationRawFileNames(item).map(normalizeOperationIdentityValue).filter(Boolean).sort();
		if (fileNames.length) return `${type}:files:${stableTextHash(fileNames.join("|"))}`;
		if (operationCommandText(item)) return `${type}:command:${stableTextHash(normalizeOperationIdentityValue(operationCommandGroupText(item)))}`;
		const searchSummary = isWebSearchLikeItem(item) ? operationSearchSummary(item) : "";
		if (searchSummary) return `${type}:search:${stableTextHash(normalizeOperationIdentityValue(searchSummary))}`;
		const toolParts = [
			item.server,
			item.namespace,
			item.tool
		].map(normalizeOperationIdentityValue).filter(Boolean);
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
		if (typeof value === "object") for (const [key, entry] of Object.entries(value)) {
			collectSearchSummaries(entry, out, key);
			if (out.length >= 3) return out;
		}
		return out;
	}
	function operationSearchSummary(item) {
		return [...new Set(collectSearchSummaries(item && (item.action || item.arguments || item.result || item.contentItems || item)))].slice(0, 3).join(" | ");
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
	function renderContextCompaction(item, turn = null, previousKeys = /* @__PURE__ */ new Set(), index = 0, thread = null) {
		const notice = contextCompactionNotice(item, turn, thread);
		if (!notice) return "";
		const key = stableItemKey(turn, item, index, "context");
		return `<div class="context-compaction-note${entryAnimationClass(key, previousKeys)}" data-item="${escapeHtml(item.id || "")}" data-render-key="${escapeHtml(key)}">${escapeHtml(notice)}</div>`;
	}
	function renderItem(item, turn = null, previousKeys = /* @__PURE__ */ new Set(), index = 0, thread = null) {
		const contextThread = renderContextThread(thread);
		if (isContextCompactionItem(item)) return renderContextCompaction(item, turn, previousKeys, index, contextThread);
		if (isLiveReasoning(item, turn, contextThread)) return "";
		const type = item.type || "item";
		const key = stableItemKey(turn, item, index);
		if (item.type === "turnUsageSummary") return `<section class="item${entryAnimationClass(key, previousKeys)} turnUsageSummary" data-item="${escapeHtml(item.id || "")}" data-render-key="${escapeHtml(key)}"${clientSubmissionDataAttr(item)}>
      <div class="item-body">${renderTurnUsageSummary(item)}</div>
    </section>`;
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
	function renderInjectedThreadTaskCardItem(item, turn = null, previousKeys = /* @__PURE__ */ new Set(), index = 0, text = "", thread = null) {
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
			minute: "2-digit"
		});
		return `<time class="item-timestamp" datetime="${escapeHtml(new Date(timestampMs).toISOString())}" title="${escapeHtml(title)}">${escapeHtml(label)}</time>`;
	}
	function itemTimestampMs(item, turn = null, thread = null) {
		if (!item) return 0;
		const contextThread = renderContextThread(thread);
		const itemStarted = numericTimestampMs(item.createdAtMs) || numericTimestampMs(item.createdAt) || numericTimestampMs(item.created_at_ms) || numericTimestampMs(item.created_at) || numericTimestampMs(item.startedAtMs) || numericTimestampMs(item.startedAt) || numericTimestampMs(item.started_at_ms) || numericTimestampMs(item.started_at) || numericTimestampMs(item.updatedAtMs) || numericTimestampMs(item.updatedAt) || numericTimestampMs(item.updated_at_ms) || numericTimestampMs(item.updated_at) || numericTimestampMs(item.timestampMs) || numericTimestampMs(item.timestamp) || numericTimestampMs(item.mobileDisplayTimestampMs) || numericTimestampMs(item.mobileDisplayTimestamp);
		if (itemStarted) return itemStarted;
		if (item.type === "agentMessage" || item.type === "plan") return numericTimestampMs(item.completedAtMs) || numericTimestampMs(item.completedAt) || numericTimestampMs(item.completed_at_ms) || numericTimestampMs(item.completed_at) || turnCompletedAtMs(turn, contextThread) || (isLiveTurn(turn, contextThread) ? 0 : turnStartedAtMs(turn)) || 0;
		if (isLiveTurn(turn, contextThread) && isOperationalItem(item)) return turnStartedAtMs(turn) || 0;
		return turnStartedAtMs(turn) || turnCompletedAtMs(turn, contextThread);
	}
	function turnStartedAtMs(turn) {
		if (!turn) return 0;
		return numericTimestampMs(turn.startedAtMs) || numericTimestampMs(turn.startedAt) || numericTimestampMs(turn.started_at_ms) || numericTimestampMs(turn.started_at) || numericTimestampMs(turn.createdAtMs) || numericTimestampMs(turn.createdAt) || numericTimestampMs(turn.created_at_ms) || numericTimestampMs(turn.created_at) || turnIdentityTimestampMs(turn);
	}
	function renderLiveReasoning(item, turn) {
		const elapsed = liveReasoningElapsed(item, turn);
		return `<section class="item live-reasoning reasoning" data-item="${escapeHtml(item.id || "")}">
    <div class="item-head"><span>Reasoning</span><span>${elapsed}s</span></div>
  </section>`;
	}
	function labelForItem(item) {
		if (isWebSearchLikeItem(item)) return "Web Search";
		return {
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
			turnUsageSummary: "Usage"
		}[item.type] || item.type || "Item";
	}
	function copyTextForItem(item) {
		if (!item) return "";
		if (item.type === "agentMessage") return item.text || "";
		if (item.type === "turnDiagnostic") return [item.title, item.message].filter(Boolean).join("\n");
		return "";
	}
	var mediaPreviewRuntime = null;
	function requireMediaPreviewRuntime() {
		if (!mediaPreviewRuntime) mediaPreviewRuntime = mediaPreviewRuntimeApi.createMediaPreviewRuntime({
			state,
			$,
			document,
			window,
			fetch: window.fetch ? window.fetch.bind(window) : fetch,
			FileReader: window.FileReader,
			requestAnimationFrame: typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame.bind(window) : (callback) => window.setTimeout(callback, 16),
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
			visibleThreadTaskCardCommandText
		});
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
	function nestedStringValue(value, keys, depth = 0, seen = /* @__PURE__ */ new Set()) {
		if (!value || typeof value !== "object" || depth > 3 || seen.has(value)) return "";
		seen.add(value);
		const wanted = new Set(keys.map((key) => String(key).toLowerCase()));
		for (const [key, entry] of Object.entries(value)) if (wanted.has(String(key).toLowerCase()) && typeof entry === "string" && entry.trim()) return entry;
		for (const entry of Object.values(value)) {
			const found = nestedStringValue(entry, keys, depth + 1, seen);
			if (found) return found;
		}
		return "";
	}
	function collabAgentTaskText(item) {
		return nestedStringValue(item, [
			"task",
			"message",
			"prompt",
			"description",
			"instructions"
		]);
	}
	function collabAgentThreadText(item) {
		return nestedStringValue(item, [
			"targetThread",
			"targetThreadId",
			"threadId",
			"agentThreadId",
			"modelThread"
		]);
	}
	function collabAgentNameText(item) {
		return nestedStringValue(item, [
			"name",
			"agentName",
			"nickname",
			"role",
			"agentType",
			"agent_type"
		]);
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
			collabAgentMetaPill("线程", thread)
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
		if (absolute >= 1e6) {
			const value = number / 1e6;
			return `${absolute / 1e6 >= 10 ? value.toFixed(1) : value.toFixed(2)}M`;
		}
		if (absolute >= 1e3) {
			const value = number / 1e3;
			return `${absolute / 1e3 >= 100 ? Math.round(value) : value.toFixed(1)}K`;
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
		return [
			`in ${formatCompactTokenCount(value.inputTokens)}`,
			`out ${formatCompactTokenCount(value.outputTokens)}`,
			`total ${formatCompactTokenCount(value.totalTokens)}`,
			value.cachedInputTokens !== void 0 ? `cached ${formatCompactTokenCount(value.cachedInputTokens)} in input` : "",
			value.reasoningOutputTokens !== void 0 ? `reasoning ${formatCompactTokenCount(value.reasoningOutputTokens)} in output` : ""
		].filter(Boolean).join(" / ");
	}
	function tokenUsageAdditiveDetail(usage) {
		const value = usage && typeof usage === "object" ? usage : {};
		return [`input ${formatCompactTokenCount(value.inputTokens)}`, `output ${formatCompactTokenCount(value.outputTokens)}`].filter((part) => !part.endsWith(" --")).join(" + ");
	}
	function tokenUsageIncludedDetail(usage) {
		const value = usage && typeof usage === "object" ? usage : {};
		return [value.cachedInputTokens !== void 0 ? `cached ${formatCompactTokenCount(value.cachedInputTokens)} in input` : "", value.reasoningOutputTokens !== void 0 ? `reasoning ${formatCompactTokenCount(value.reasoningOutputTokens)} in output` : ""].filter(Boolean).join(" / ");
	}
	function contextRiskLabel(level) {
		return {
			normal: "normal",
			warn: "watch",
			high: "high",
			critical: "critical",
			unknown: "unknown"
		}[level] || "unknown";
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
		return `<div class="turn-usage-progress" style="--usage-progress:${clampPercent(percent).toFixed(2)}%">
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
		const summary = item && item.mobileUsageSummary && typeof item.mobileUsageSummary === "object" ? item.mobileUsageSummary : {};
		const contextTokens = Number(summary.contextWindowUsedTokens);
		const contextWindow = Number(summary.modelContextWindow);
		const contextDetail = Number.isFinite(contextTokens) && Number.isFinite(contextWindow) && contextWindow > 0 ? `${formatCompactTokenCount(contextTokens)} / ${formatCompactTokenCount(contextWindow)}` : "";
		const totalTokenUsage = summary.totalTokenUsage || {};
		const totalUsageDetail = [tokenUsageAdditiveDetail(totalTokenUsage), tokenUsageIncludedDetail(totalTokenUsage)].filter(Boolean).join(" / ");
		const rolloutSize = Number(summary.rolloutSizeBytes);
		const rolloutThreshold = Number(summary.rolloutWarningThresholdBytes);
		const projectContextSize = Number(summary.projectContextSizeBytes);
		const handoffSize = Number(summary.handoffSizeBytes);
		const pairSize = Number(summary.workspaceContextPairSizeBytes);
		const fileThreshold = Number(summary.workspaceContextFileThresholdBytes);
		const handoffThreshold = Number(summary.workspaceHandoffPromptThresholdBytes || summary.workspaceContextFileThresholdBytes);
		const pairThreshold = Number(summary.workspaceContextPairThresholdBytes);
		const contextRisk = Number.isFinite(pairSize) && Number.isFinite(pairThreshold) && pairThreshold > 0 && pairSize >= pairThreshold || Number.isFinite(projectContextSize) && Number.isFinite(fileThreshold) && fileThreshold > 0 && projectContextSize >= fileThreshold || Number.isFinite(handoffSize) && Number.isFinite(handoffThreshold) && handoffThreshold > 0 && handoffSize >= handoffThreshold;
		const rolloutRisk = Boolean(summary.rolloutOverWarningThreshold) || Number.isFinite(rolloutSize) && Number.isFinite(rolloutThreshold) && rolloutThreshold > 0 && rolloutSize >= rolloutThreshold;
		const contextDetailFiles = [];
		if (Number.isFinite(pairSize) && pairSize > 0) contextDetailFiles.push(`pair ${formatFileSize(pairSize)}`);
		if (Number.isFinite(fileThreshold) && fileThreshold > 0) contextDetailFiles.push(`warn ${formatFileSize(fileThreshold)}`);
		const handoffDetail = Number.isFinite(handoffThreshold) && handoffThreshold > 0 ? `warn ${formatFileSize(handoffThreshold)}` : "";
		const compactButton = contextRisk || rolloutRisk ? `<button class="turn-usage-new-thread" type="button" data-new-thread-from-current>压缩续接</button>` : "";
		const risk = contextRiskLabel(summary.contextRiskLevel || "unknown");
		const ringOffset = (100 - clampPercent(summary.contextWindowUsedPercent)).toFixed(2);
		const lastTurnUsage = summary.lastTokenUsage || {};
		const lastInputDetail = lastTurnUsage.cachedInputTokens !== void 0 ? `cached ${formatCompactTokenCount(lastTurnUsage.cachedInputTokens)} included` : "";
		const lastOutputDetail = lastTurnUsage.reasoningOutputTokens !== void 0 ? `reasoning ${formatCompactTokenCount(lastTurnUsage.reasoningOutputTokens)} included` : "";
		const projectContextMetric = renderUsageCompactMetric("project ctx file", Number.isFinite(projectContextSize) && projectContextSize > 0 ? formatFileSize(projectContextSize) : "--", contextDetailFiles.join(" | "));
		const handoffMetric = renderUsageCompactMetric("handoff file", Number.isFinite(handoffSize) && handoffSize > 0 ? formatFileSize(handoffSize) : "--", handoffDetail);
		const rolloutPercent = Number.isFinite(rolloutSize) && Number.isFinite(rolloutThreshold) && rolloutThreshold > 0 ? clampPercent(rolloutSize / rolloutThreshold * 100) : 0;
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
		if (item.type === "agentMessage") return renderThreadTaskCardDraftMessage(item.text || "", item, turn) || renderMarkdownWithAttachmentSummary(item.text || "");
		if (isTurnDiagnosticItem(item)) return renderTurnDiagnostic(item);
		if (item.type === "reasoning") {
			const summary = (item.summary || []).join("\n");
			const content = (item.content || []).join("\n");
			return escapeHtml([summary, content].filter(Boolean).join("\n\n"));
		}
		if (item.type === "plan") return renderThreadTaskCardDraftMessage(item.text || "", item, turn) || renderMarkdownWithAttachmentSummary(item.text || "");
		if (item.type === "imageView") return renderImageView(item);
		if (item.type === "imageGeneration") return renderImageView(item);
		if (item.type === "commandExecution") return `<div class="mono">${escapeHtml(item.command || "")}</div>${renderOutputBlock(item.aggregatedOutput, item)}`;
		if (item.type === "fileChange") return renderStructuredBlock(item.changes || [], `${Array.isArray(item.changes) ? item.changes.length : 0} change(s)`);
		if (item.type === "collabAgentToolCall") return renderCollabAgentToolCall(item);
		if (item.type === "dynamicToolCall" || item.type === "mcpToolCall") return `<div class="mono">${escapeHtml(JSON.stringify(item.arguments || {}, null, 2))}</div>${renderStructuredBlock(item.result || item.contentItems, "Tool result")}`;
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
		const summary = item.outputTruncated || total > outputText.length ? `Output preview: ${total.toLocaleString()} chars total, showing latest ${outputText.length.toLocaleString()}` : `Output: ${outputText.length.toLocaleString()} chars`;
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
			turn = {
				id: turnId,
				items: [],
				status: { type: "running" },
				error: null,
				startedAt: Math.floor(Date.now() / 1e3),
				completedAt: null,
				durationMs: null
			};
			thread.turns.push(turn);
		}
		return turn;
	}
	function shouldDeferLiveFinalReceipt(turn, itemType) {
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
			shouldDeferLiveFinalReceipt: typeof shouldDeferLiveFinalReceipt === "function" ? shouldDeferLiveFinalReceipt : null
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
			createConversationRenderRuntime
		};
		if (typeof module === "object" && module.exports) module.exports = conversationRenderRuntimeApi;
		Object.assign(root, legacyGlobals);
		root.CodexConversationRenderRuntime = conversationRenderRuntimeApi;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
//#region public/event-stream-runtime.js
var require_event_stream_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function shouldRenderAfterUpsert(turn, item) {
		return !shouldDeferLiveFinalReceipt(turn, item && item.type);
	}
	function upsertItem(turnId, item) {
		const turn = ensureTurn(turnId);
		if (!turn || !item || !item.id) return;
		markActivity(activityLabelForItem(item));
		if (isReasoningItem(item)) {
			updateTickTimer();
			return;
		}
		turn.items = turn.items || [];
		let structureChanged = false;
		if (item.type === "userMessage") {
			const matchingExistingIndex = turn.items.findIndex((existing) => existing && existing.id !== item.id && existing.type === "userMessage" && userMessagesCanShadow(existing, item));
			if (matchingExistingIndex >= 0) {
				const mergedUserMessage = mergeLikelySameUserMessage(turn.items[matchingExistingIndex], item);
				turn.items[matchingExistingIndex] = mergedUserMessage;
				normalizeThreadVisibleUserMessages(state.currentThread);
				if (shouldRenderAfterUpsert(turn, mergedUserMessage)) scheduleRenderCurrentThread();
				return;
			}
		}
		if (item.type === "agentMessage" || item.type === "plan") {
			const beforeLength = turn.items.length;
			turn.items = turn.items.filter((existing) => existing.id === item.id || !visibleTextItemsLikelySame(existing, item));
			structureChanged = structureChanged || turn.items.length !== beforeLength;
		}
		if (isTurnUsageSummaryItem(item)) {
			const beforeLength = turn.items.length;
			turn.items = turn.items.filter((existing) => existing.id === item.id || !isTurnUsageSummaryItem(existing));
			structureChanged = structureChanged || turn.items.length !== beforeLength;
		}
		const index = turn.items.findIndex((x) => x.id === item.id);
		const canPatchExistingItem = index >= 0;
		let nextItem = item;
		if (index >= 0 && !item.startedAtMs && turn.items[index].startedAtMs) item.startedAtMs = turn.items[index].startedAtMs;
		if (item.type === "reasoning" && !item.startedAtMs) item.startedAtMs = Date.now();
		if (isOperationalItem(item) && isCompletedStatus(item.status) && !item.completedAtMs) item.completedAtMs = Date.now();
		if (index >= 0) {
			turn.items[index] = mergeItemPreservingVisibleFields(turn.items[index], item);
			nextItem = turn.items[index];
		} else turn.items.push(item);
		normalizeThreadVisibleUserMessages(state.currentThread);
		if (shouldRenderAfterUpsert(turn, nextItem)) {
			if (structureChanged) scheduleRenderCurrentThread();
			else if (canPatchExistingItem) {
				if (!patchVisibleItemDom(turn, nextItem)) scheduleRenderCurrentThread();
			} else if (!insertVisibleItemDom(turn, nextItem)) scheduleRenderCurrentThread();
		}
	}
	function removeItem(turnId, itemId) {
		const turn = ensureTurn(turnId);
		if (!turn || !itemId) return;
		turn.items = (turn.items || []).filter((item) => item.id !== itemId);
		scheduleRenderCurrentThread();
	}
	function ensureTimerItem(turnId, itemId, itemType) {
		const turn = ensureTurn(turnId);
		if (!turn || !itemId) return;
		if (itemType === "reasoning") {
			markActivity("思考");
			updateTickTimer();
			return;
		}
		turn.items = turn.items || [];
		let item = turn.items.find((x) => x.id === itemId);
		let createdItem = false;
		if (!item) {
			item = {
				id: itemId,
				type: itemType,
				startedAtMs: Date.now()
			};
			turn.items.push(item);
			createdItem = true;
		}
		if (!item.startedAtMs) item.startedAtMs = Date.now();
		if (createdItem) {
			if (!insertVisibleItemDom(turn, item)) scheduleRenderCurrentThread();
		} else if (!patchVisibleItemDom(turn, item)) scheduleRenderCurrentThread();
	}
	function shouldRenderAfterAppend(turn, itemType, field, previousValue, nextValue, options = {}) {
		if (options.render === false) return false;
		return true;
	}
	function appendToItem(turnId, itemId, itemType, field, delta, index = 0, options = {}) {
		const turn = ensureTurn(turnId);
		if (!turn) return;
		if (itemType === "reasoning") {
			markActivity("思考");
			updateTickTimer();
			return;
		}
		markActivity(activityLabelForItem({ type: itemType }));
		let item = (turn.items || []).find((x) => x.id === itemId);
		let createdItem = false;
		if (!item) {
			item = {
				id: itemId,
				type: itemType,
				startedAtMs: Date.now()
			};
			turn.items.push(item);
			createdItem = true;
		}
		if (!item.startedAtMs) item.startedAtMs = Date.now();
		const previousValue = Array.isArray(item[field]) ? item[field][index] : item[field];
		let nextValue = previousValue;
		if (field === "aggregatedOutput") {
			appendCommandOutput(item, delta);
			nextValue = item[field];
		} else if (Array.isArray(item[field])) {
			item[field][index] = (item[field][index] || "") + delta;
			nextValue = item[field][index];
		} else {
			item[field] = compactLiveText((item[field] || "") + delta);
			nextValue = item[field];
		}
		sustainSubmittedMessageBottomFollow(turn, itemType, field);
		if (shouldRenderAfterAppend(turn, itemType, field, previousValue, nextValue, options)) {
			if (isOperationalItem(item)) updateLiveOperationDockForLocalPatch();
			else if (createdItem) {
				if (!insertVisibleItemDom(turn, item)) scheduleRenderCurrentThread();
			} else if (!patchLiveTextItemDom(turn, item)) scheduleRenderCurrentThread();
		}
	}
	function scheduleRenderCurrentThread() {
		if (state.renderFrame || state.renderScheduled) return;
		state.renderScheduled = true;
		const render = () => {
			state.renderFrame = null;
			state.renderScheduled = false;
			renderCurrentThread();
		};
		if (window.requestAnimationFrame) state.renderFrame = window.requestAnimationFrame(render);
		else state.renderFrame = setTimeout(render, 33);
	}
	function scheduleRenderThreads(...args) {
		return threadListRuntime.scheduleRenderThreads(...args);
	}
	function upsertServerRequest(request, fallbackThreadId = "") {
		if (!request || request.id === null || request.id === void 0) return;
		const key = String(request.id);
		const existing = state.pendingApprovals.get(key);
		const threadId = approvalActionThreadId(existing, fallbackThreadId);
		if (!shouldShowApprovalRequest(request)) {
			state.pendingApprovals.delete(key);
			scheduleApprovalThreadRender(approvalActionThreadId(request, threadId));
			return;
		}
		markActivity(isUserInputRequest(request) ? "等待输入" : "等待批准");
		const next = serverRequestWithThreadContext(Object.assign({}, existing || {}, request), threadId);
		state.pendingApprovals.set(key, next);
		scheduleApprovalThreadRender(approvalActionThreadId(next));
	}
	function scheduleApprovalRemoval(requestId, delayMs = 6e3) {
		const key = requestId !== null && requestId !== void 0 ? String(requestId) : "";
		if (!key) return;
		setTimeout(() => {
			const existing = state.pendingApprovals.get(key);
			if (!existing || !isApprovalSettled(existing)) return;
			const threadId = approvalActionThreadId(existing);
			state.pendingApprovals.delete(key);
			scheduleApprovalThreadRender(threadId);
		}, delayMs);
	}
	function resolveServerRequest(payload) {
		const requestId = payload && payload.requestId !== null && payload.requestId !== void 0 ? String(payload.requestId) : "";
		if (!requestId) return;
		const existing = state.pendingApprovals.get(requestId);
		let next = existing || null;
		if (payload.request) {
			next = serverRequestWithThreadContext(Object.assign({}, existing || {}, payload.request), approvalActionThreadId(existing));
			state.pendingApprovals.set(requestId, next);
		} else if (existing) {
			existing.status = payload.status || "resolved";
			next = existing;
		}
		if (next) scheduleApprovalThreadRender(approvalActionThreadId(next));
		if (next) markActivity(isUserInputRequest(next) ? "输入完成" : "批准完成");
		scheduleApprovalRemoval(requestId);
	}
	function serverRequestWithThreadContext(request, threadId) {
		const id = String(threadId || "").trim();
		if (!request || !id || approvalThreadId(request)) return request;
		return Object.assign({}, request, { params: Object.assign({}, request.params || {}, { threadId: id }) });
	}
	function syncThreadPendingServerRequests(thread) {
		const threadId = String(thread && (thread.id || state.currentThreadId) || "").trim();
		const requests = Array.isArray(thread && thread.pendingServerRequests) ? thread.pendingServerRequests : [];
		if (!threadId || !requests.length) return;
		for (const request of requests) {
			if (!request || request.id === null || request.id === void 0) continue;
			if (!requestBelongsToThread(request, threadId)) continue;
			upsertServerRequest(request, threadId);
		}
	}
	function applyThreadGoalToThread(thread, normalizedGoal) {
		if (!thread) return false;
		if (normalizedGoal) thread.goal = normalizedGoal;
		else delete thread.goal;
		return true;
	}
	function scheduleThreadGoalDetailRender(threadId = "") {
		const id = String(threadId || state.currentThreadId || "").trim();
		if (!id) return false;
		if (state.currentThread && String(state.currentThread.id || "") === id) {
			scheduleRenderCurrentThread();
			return true;
		}
		if (state.threadTileMode && threadTilePaneIsVisible(id)) {
			if (!scheduleRenderThreadTilePane(id, { preserveScroll: true })) scheduleRenderCurrentThread();
			return true;
		}
		return false;
	}
	function updateThreadGoalState(...args) {
		return threadListRuntime.updateThreadGoalState(...args);
	}
	function applyNotification(method, params) {
		if (!params) return;
		if (method === "account/rateLimits/updated") return;
		if (shouldThrottleThreadNotification(method, params)) return;
		if ((method === "turn/started" || method === "turn/completed") && params.threadId) clearThreadTileOperationBubble(params.threadId);
		if (method === "thread/started" && params.thread) {
			if (isHiddenThread(params.thread)) {
				state.threads = state.threads.filter((thread) => thread.id !== params.thread.id);
				scheduleRenderThreads();
				return;
			}
			const index = state.threads.findIndex((x) => x.id === params.thread.id);
			updateThreadStatusHints(params.thread.id, index >= 0 ? state.threads[index].status : null, params.thread.status, {
				thread: params.thread,
				threadName: threadDisplayName(params.thread),
				notify: true
			});
			if (index >= 0) state.threads[index] = Object.assign({}, state.threads[index], params.thread);
			else state.threads.unshift(params.thread);
			scheduleRenderThreads();
			return;
		}
		if (method === "thread/status/changed") {
			const replayed = Boolean(params.mobileReplay);
			const runningNotification = isRunningStatus(params.status);
			const eventAtMs = threadStatusNotificationEventAtMs(params, runningNotification ? Date.now() : 0, { allowReplayReceivedAt: !replayed || runningNotification });
			const thread = localThreadForStatusContext(params.threadId);
			const previousStatus = thread ? thread.status : null;
			updateThreadStatusHints(params.threadId, previousStatus, params.status, {
				thread,
				notify: true,
				threadName: threadDisplayName(thread),
				eventAtMs,
				mobileReplay: replayed
			});
			updateThreadListStatus(params.threadId, params.status);
			pruneHiddenThreads();
			if (state.currentThread && state.currentThread.id === params.threadId) {
				markThreadViewed(params.threadId, state.currentThread, eventAtMs);
				renderCurrentThread();
				scheduleLivePollIfNeeded(1400);
			} else if (state.threadTileMode && threadTilePaneIsVisible(params.threadId)) {
				scheduleThreadStatusDetailRender(params.threadId);
				loadThreadTileDetail(params.threadId, {
					force: true,
					background: true,
					source: "tile-status"
				}).catch(showError);
			}
			scheduleRenderThreads();
			return;
		}
		if (method === "thread/name/updated") {
			updateThreadNameLocally(params.threadId, params.threadName);
			pruneHiddenThreads();
			if (!(state.currentThread && state.currentThread.id === params.threadId) && state.threadTileMode && threadTilePaneIsVisible(params.threadId)) loadThreadTileDetail(params.threadId, {
				force: true,
				background: true,
				source: "tile-name"
			}).catch(showError);
			return;
		}
		if (method === "thread/goal/updated") {
			updateThreadGoalState(params.threadId, params.goal);
			return;
		}
		if (method === "thread/goal/cleared") {
			updateThreadGoalState(params.threadId, null);
			return;
		}
		if (method === "thread/archived") {
			state.threads = state.threads.filter((thread) => thread.id !== params.threadId);
			if (state.currentThread && state.currentThread.id === params.threadId) if (state.continuationSourceThreadId === params.threadId) state.currentThread = Object.assign({}, state.currentThread, {
				archived: true,
				status: params.status || { type: "archived" }
			});
			else clearCurrentThreadSelection();
			scheduleRenderThreads();
			renderCurrentThread();
			return;
		}
		if (!state.currentThread || params.threadId !== state.currentThread.id) {
			if (state.threadTileMode && params.threadId && threadTilePaneIsVisible(params.threadId)) loadThreadTileDetail(params.threadId, {
				force: true,
				background: true,
				source: `tile-${method}`
			}).catch(showError);
			return;
		}
		if (method === "turn/started") {
			const replayed = Boolean(params.mobileReplay);
			const eventAtMs = threadStatusNotificationEventAtMs(params, Date.now(), { allowReplayReceivedAt: true });
			const runningStatus = { type: "active" };
			state.activeTurnId = params.turn.id;
			updateThreadStatusHints(params.threadId, state.currentThread.status, runningStatus, {
				thread: state.currentThread,
				threadName: threadDisplayName(state.currentThread),
				notify: false,
				eventAtMs,
				mobileReplay: replayed
			});
			updateThreadListStatus(params.threadId, runningStatus);
			clearRecentCompletedReplyAnchor();
			clearConversationAutoScrollHold();
			clearLiveOperationDockRuntimeState();
			markActivity("开始");
			$("interruptTurn").disabled = false;
			updateComposerControls();
			ensureTurn(params.turn.id);
			renderCurrentThread();
			scheduleRenderThreads();
			scheduleCurrentThreadRefresh(500);
			scheduleLivePollIfNeeded(1200);
			return;
		}
		if (method === "turn/completed") {
			const replayed = Boolean(params.mobileReplay);
			const eventAtMs = threadStatusNotificationEventAtMs(params, Date.now(), { allowReplayReceivedAt: !replayed });
			const completedStatus = params.turn && params.turn.status || { type: "completed" };
			const turn = ensureTurn(params.turn.id);
			Object.assign(turn, mergeTurnPreservingVisibleItems(turn, params.turn));
			rememberRecentCompletedTurnReply(params.turn.id);
			const completedPendingSteer = isPendingSteerForTurn(params.turn.id);
			updateThreadStatusHints(params.threadId, state.currentThread.status, completedStatus, {
				thread: state.currentThread,
				threadName: threadDisplayName(state.currentThread),
				notify: true,
				eventAtMs,
				mobileReplay: replayed
			});
			updateThreadListStatus(params.threadId, completedStatus);
			state.activeTurnId = "";
			clearLiveOperationDockRuntimeState();
			markActivity("完成");
			if (completedPendingSteer) setSteerFeedback("completed", { turnId: String(params.turn.id) });
			$("interruptTurn").disabled = true;
			updateComposerControls();
			const suppressAutomaticRefresh = shouldSuppressAutomaticCurrentThreadRefresh("post-completion", { threadId: params.threadId });
			renderCurrentThread({ stickToBottom: !suppressAutomaticRefresh });
			scheduleRenderThreads();
			if (!suppressAutomaticRefresh) schedulePostCompletionThreadRefreshes(params.threadId, [700, 2400]);
			setTimeout(() => {
				if (state.currentThreadId === params.threadId) loadSideChat(params.threadId, { silent: true }).catch(showError);
			}, 900);
			if (!suppressAutomaticRefresh) {
				scheduleUsageBackfillRefresh(1400);
				scheduleLivePollIfNeeded(1400);
			}
			return;
		}
		if (method === "item/started" || method === "item/completed") {
			upsertItem(params.turnId, params.item);
			markSteerAppliedIfNeeded(params.turnId, params.item);
			scheduleLivePollIfNeeded(2200);
			return;
		}
		if (method === "item/agentMessage/delta") {
			markActivity("输出");
			appendToItem(params.turnId, params.itemId, "agentMessage", "text", params.delta || "", 0);
			markSteerAppliedIfNeeded(params.turnId, { type: "agentMessage" });
			return;
		}
		if (method === "item/commandExecution/outputDelta") return;
		if (method === "item/fileChange/outputDelta") return;
		if (method === "item/reasoning/textDelta") {
			markActivity("思考");
			ensureTimerItem(params.turnId, params.itemId, "reasoning");
			markSteerAppliedIfNeeded(params.turnId, { type: "reasoning" });
			return;
		}
		if (method === "item/reasoning/summaryTextDelta") {
			markActivity("思考");
			ensureTimerItem(params.turnId, params.itemId, "reasoning");
			markSteerAppliedIfNeeded(params.turnId, { type: "reasoning" });
		}
	}
	function resetEventFallbackState() {
		clearTimeout(state.eventRetryTimer);
		clearTimeout(state.eventFallbackPollTimer);
		state.eventRetryTimer = null;
		state.eventFallbackPollTimer = null;
		state.eventReconnectFailures = 0;
		state.eventReconnectDelayMs = 5e3;
		state.eventFallbackMode = false;
	}
	function scheduleEventReconnectRetry() {
		clearTimeout(state.eventRetryTimer);
		if (!state.key || !state.events || state.events.readyState === EventSource.OPEN) return;
		const delay = Math.min(Math.max(Number(state.eventReconnectDelayMs) || 5e3, 5e3), 45e3);
		state.eventReconnectDelayMs = Math.min(delay * 2, 45e3);
		state.eventRetryTimer = setTimeout(() => {
			state.eventRetryTimer = null;
			if (!state.key || document.visibilityState === "hidden") return;
			if (state.events && state.events.readyState === EventSource.OPEN) return;
			connectEvents();
		}, delay);
	}
	function shouldRefreshThreadListDuringEventRecovery(options = {}) {
		return Boolean(options.force) || !isHermesEmbedMode() || !state.threads.length;
	}
	async function refreshThreadListDuringEventRecovery(options = {}) {
		if (!shouldRefreshThreadListDuringEventRecovery(options)) return false;
		await loadThreads({ silent: isHermesEmbedMode() || Boolean(state.threads.length) });
		return true;
	}
	function scheduleEventFallbackPoll(delayMs = 8e3) {
		clearTimeout(state.eventFallbackPollTimer);
		if (!isHermesEmbedMode()) return;
		if (state.events && state.events.readyState === EventSource.OPEN) return;
		state.eventFallbackMode = true;
		state.eventFallbackPollTimer = setTimeout(async () => {
			state.eventFallbackPollTimer = null;
			if (!state.key || document.visibilityState === "hidden") return;
			if (state.events && state.events.readyState === EventSource.OPEN) return;
			try {
				const status = await api("/api/status");
				updateConnectionState(status);
				clearReconnectRefreshPrompt();
				rememberRateLimitsFromConfig(status);
				if (status.codexProfiles) rememberCodexProfiles(status.codexProfiles);
				await refreshThreadListDuringEventRecovery();
				if (state.currentThreadId) await refreshCurrentThread({ source: "event-fallback-poll" });
				scheduleEventFallbackPoll();
			} catch (err) {
				showReconnectRefreshPrompt("reconnect");
				if (!isHermesEmbedMode()) showError(err);
			}
		}, delayMs);
	}
	async function recoverEventStreamWithApiFallback(options = {}) {
		const wasUnavailable = state.appServerWasUnavailable || Boolean(state.connectionStatus && !state.connectionStatus.ready);
		const status = await api("/api/status");
		updateConnectionState(status);
		const recovered = (wasUnavailable || Boolean(options.afterEventReconnect)) && status && status.ready;
		state.appServerWasUnavailable = Boolean(status && !status.ready);
		clearReconnectRefreshPrompt();
		rememberRateLimitsFromConfig(status);
		if (status.codexProfiles) rememberCodexProfiles(status.codexProfiles);
		await refreshThreadListDuringEventRecovery({ force: Boolean(options.afterEventReconnect) });
		if (state.currentThreadId) await refreshCurrentThread({ source: "event-recovery" });
		if (recovered) await maybeAutoRecoverTurnAfterReconnect(status, "event-fallback-reconnect");
		if (isHermesEmbedMode()) {
			state.eventFallbackMode = true;
			scheduleEventFallbackPoll();
			scheduleEventReconnectRetry();
		} else ensureEventConnection();
	}
	function connectEvents() {
		clearReconnectTimers();
		if (state.events) {
			state.events.onmessage = null;
			state.events.onerror = null;
			state.events.onopen = null;
			state.events.close();
		}
		const params = new URLSearchParams({ key: state.key });
		if (state.currentThreadId) params.set("threadId", state.currentThreadId);
		state.events = new EventSource(`/api/events?${params.toString()}`);
		state.events.onopen = () => {
			const hadReconnectFailure = state.eventReconnectFailures > 0 || state.eventFallbackMode;
			clearReconnectTimers();
			resetEventFallbackState();
			clearReconnectRefreshPrompt();
			if (state.connectionStatus) restoreConnectionState();
			scheduleVisiblePageRefreshCheck(200, { force: true });
			if (hadReconnectFailure) recoverEventStreamWithApiFallback({ afterEventReconnect: true }).catch((err) => {
				state.appServerWasUnavailable = true;
				showReconnectRefreshPrompt("reconnect");
				if (!isHermesEmbedMode()) showError(err);
			});
		};
		state.events.onmessage = (event) => {
			const payload = JSON.parse(event.data);
			if (payload.type === "status") {
				clearReconnectTimers();
				const wasUnavailable = state.appServerWasUnavailable || Boolean(state.connectionStatus && !state.connectionStatus.ready);
				updateConnectionState(payload.status);
				const recovered = wasUnavailable && payload.status && payload.status.ready;
				state.appServerWasUnavailable = Boolean(payload.status && !payload.status.ready);
				rememberRateLimitsFromConfig(payload.status);
				if (payload.status.codexProfiles) rememberCodexProfiles(payload.status.codexProfiles);
				scheduleVisiblePageRefreshCheck(1200);
				if (recovered) maybeAutoRecoverTurnAfterReconnect(payload.status, "app-server-reconnect").catch(() => {});
				return;
			}
			if (payload.type === "notification") applyNotification(payload.method, payload.params);
			if (payload.type === "serverRequest") upsertServerRequest(payload.request);
			if (payload.type === "serverRequestResolved") resolveServerRequest(payload);
		};
		state.events.onerror = () => {
			if (document.visibilityState === "hidden") return;
			state.eventReconnectFailures += 1;
			clearTimeout(state.reconnectNoticeTimer);
			state.reconnectNoticeTimer = setTimeout(() => {
				if (state.events && state.events.readyState !== EventSource.OPEN && document.visibilityState !== "hidden") {
					if (!isHermesEmbedMode()) {
						markActivity("重连");
						updateConnectionState(null, "Reconnecting");
					}
				}
			}, 3e3);
			clearTimeout(state.recoveryTimer);
			state.recoveryTimer = setTimeout(async () => {
				if (!state.events || state.events.readyState === EventSource.OPEN || document.visibilityState === "hidden") return;
				try {
					await recoverEventStreamWithApiFallback();
				} catch (err) {
					state.appServerWasUnavailable = true;
					showReconnectRefreshPrompt("reconnect");
					if (!isHermesEmbedMode()) showError(err);
				}
			}, 8e3);
		};
	}
	function ensureEventConnection() {
		if (!state.key) return;
		if (!state.events || state.events.readyState === EventSource.CLOSED) connectEvents();
	}
	function clearResumeVisualTimers() {
		for (const timer of state.resumeVisualTimers) clearTimeout(timer);
		state.resumeVisualTimers = [];
	}
	function clearVisualRecoveryTimers() {
		for (const timer of state.visualRecoveryTimers) clearTimeout(timer);
		state.visualRecoveryTimers = [];
	}
	function visualRecoveryReasonAllowsHeavy(reason = "") {
		return !/^(focus|focusin|focusout|resize|visual-viewport|visual-viewport-scroll|window-blur)$/.test(String(reason || ""));
	}
	function shouldRunHeavyVisualRecovery(reason = "resume") {
		if (!visualRecoveryReasonAllowsHeavy(reason)) return false;
		const now = Date.now();
		if (now - state.lastHeavyVisualRecoveryAt < HEAVY_VISUAL_RECOVERY_MIN_INTERVAL_MS) return false;
		state.lastHeavyVisualRecoveryAt = now;
		return true;
	}
	function forceVisualRecovery(reason = "resume", options = {}) {
		updateViewportVars();
		if (!state.key) return;
		const app = $("app");
		const login = $("login");
		if (!app || !login) return;
		const root = document.documentElement;
		const body = document.body;
		const heavy = options.heavy !== false && shouldRunHeavyVisualRecovery(reason);
		login.classList.add("hidden");
		app.classList.remove("hidden");
		if (heavy) {
			root.classList.add("visual-recovering");
			if (body) body.classList.add("visual-recovering");
			app.classList.add("resume-repaint");
		}
		app.dataset.resumeReason = reason;
		if (heavy) {
			app.style.transform = "translateY(var(--app-top, 0px)) translateZ(0)";
			app.style.webkitTransform = "translateY(var(--app-top, 0px)) translateZ(0)";
		}
		app.getBoundingClientRect();
		if (options.render !== false && (state.currentThread || state.threads.length)) renderCurrentThread();
		updateComposerHeightVar();
		window.requestAnimationFrame(() => {
			app.getBoundingClientRect();
			window.requestAnimationFrame(() => {
				if (heavy) {
					app.classList.remove("resume-repaint");
					root.classList.remove("visual-recovering");
					if (body) body.classList.remove("visual-recovering");
				}
				app.style.removeProperty("transform");
				app.style.removeProperty("-webkit-transform");
				delete app.dataset.resumeReason;
			});
		});
	}
	function scheduleVisualRecovery(reason = "visual", delay = 0, options = {}) {
		if (document.visibilityState === "hidden") return;
		const seq = ++state.visualRecoverySeq;
		clearVisualRecoveryTimers();
		const delays = options.delays || [
			delay,
			delay + 80,
			delay + 240,
			delay + 700,
			delay + 1600,
			delay + 3200
		];
		for (const visualDelay of delays) state.visualRecoveryTimers.push(setTimeout(() => {
			if (seq === state.visualRecoverySeq && document.visibilityState !== "hidden") forceVisualRecovery(reason, {
				render: options.render !== false,
				heavy: options.heavy !== false
			});
		}, Math.max(0, visualDelay)));
	}
	function scheduleMobileResume(reason = "resume", delay = 80) {
		if (document.visibilityState === "hidden") return;
		clearTimeout(state.resumeRetryTimer);
		state.resumeRetryTimer = null;
		if (state.startupInProgress) {
			forceVisualRecovery(reason);
			postClientEvent("mobile_resume_skipped_startup", {
				reason,
				currentThreadId: state.currentThreadId || "",
				hasThreadOpenIntent: Boolean(state.startupThreadOpenPending)
			});
			return;
		}
		const seq = ++state.resumeSeq;
		clearTimeout(state.resumeTimer);
		clearResumeVisualTimers();
		const allowHeavyRecovery = visualRecoveryReasonAllowsHeavy(reason);
		for (const [index, visualDelay] of [
			0,
			delay,
			delay + 220,
			delay + 900
		].entries()) state.resumeVisualTimers.push(setTimeout(() => {
			if (seq === state.resumeSeq && document.visibilityState !== "hidden") forceVisualRecovery(reason, { heavy: index === 0 && allowHeavyRecovery });
		}, visualDelay));
		state.resumeTimer = setTimeout(() => {
			if (seq === state.resumeSeq) resumeMobileSession(reason).catch(showError);
		}, delay);
	}
	function isTransientResumeError(err) {
		const message = String(err && err.message || err || "");
		return /load failed|failed to fetch|networkerror|network request failed|request timed out|cancelled/i.test(message);
	}
	function scheduleTransientResumeRetry(reason, delay = 1200) {
		clearTimeout(state.resumeRetryTimer);
		state.resumeRetryTimer = setTimeout(() => {
			state.resumeRetryTimer = null;
			if (document.visibilityState === "hidden" || state.startupInProgress || !state.key) return;
			scheduleMobileResume(`${reason}-retry`, 120);
		}, delay);
	}
	async function resumeMobileSession(reason = "resume") {
		if (document.visibilityState === "hidden" || !state.key) return;
		const startedAt = nowPerfMs();
		try {
			forceVisualRecovery(reason, { heavy: false });
			updateComposerHeightVar();
			renderComposerSettings();
			updateComposerControls();
			if (state.currentThread || state.threads.length) renderCurrentThread();
			ensureEventConnection();
			state.pollStableCount = 0;
			const wasUnavailable = state.appServerWasUnavailable || Boolean(state.connectionStatus && !state.connectionStatus.ready);
			const status = await api("/api/status");
			updateConnectionState(status);
			const recovered = wasUnavailable && status && status.ready;
			state.appServerWasUnavailable = Boolean(status && !status.ready);
			rememberRateLimitsFromConfig(status);
			if (status.codexProfiles) rememberCodexProfiles(status.codexProfiles);
			await loadThreads({ silent: Boolean(state.threads.length) });
			if (state.currentThreadId && state.currentThread && !state.currentThread.mobileLoading && !state.currentThread.mobileLoadError) {
				const foregroundRefresh = currentThreadNeedsForegroundRefresh();
				postClientEvent("mobile_resume_thread_refresh_scheduled", {
					reason,
					currentThreadId: state.currentThreadId || "",
					status: statusText(state.currentThread && state.currentThread.status),
					activeTurnId: state.activeTurnId || "",
					foregroundRefresh
				});
				if (foregroundRefresh) scheduleCurrentThreadRefresh(250, "resume");
				else await refreshCurrentThread({ source: "resume" });
			} else if (state.currentThreadId) await refreshCurrentThread({ source: "resume" });
			else await restoreThreadSelection();
			if (recovered) await maybeAutoRecoverTurnAfterReconnect(status, reason);
			scheduleLivePollIfNeeded(1200);
			const elapsedMs = roundedDurationMs(startedAt);
			if (elapsedMs > 1200) postClientEvent("mobile_resume_slow", {
				reason,
				elapsedMs,
				currentThreadId: state.currentThreadId || "",
				hadThreads: Boolean(state.threads.length)
			});
		} catch (err) {
			if (isTransientResumeError(err)) state.appServerWasUnavailable = true;
			postClientEvent("mobile_resume_error", {
				reason,
				elapsedMs: roundedDurationMs(startedAt),
				error: err.message || String(err),
				transient: isTransientResumeError(err)
			});
			forceVisualRecovery(reason, { heavy: false });
			if (isTransientResumeError(err)) {
				scheduleTransientResumeRetry(reason);
				return;
			}
			showError(err);
		}
	}
	function scrollConversationToBottom() {
		const el = $("conversation");
		if (!el) return;
		const target = Math.max(0, el.scrollHeight - el.clientHeight);
		if (Math.abs(el.scrollTop - target) < 2) {
			scheduleScrollToBottomButtonUpdate();
			return;
		}
		markProgrammaticConversationScroll();
		el.scrollTop = target;
		syncConversationScrollPosition();
		scheduleScrollToBottomButtonUpdate();
	}
	function planConversationViewportPreservation(options = {}) {
		const nearBottom = Object.prototype.hasOwnProperty.call(options, "nearBottom") ? Boolean(options.nearBottom) : isConversationNearBottom();
		return conversationScroll.planReadingViewportPreservation({
			nearBottom,
			userReadingCurrentTurn: Boolean(options.userReadingCurrentTurn),
			autoScrollHold: shouldHoldAutoScrollForCurrentTurn(),
			userReadingAwayFromBottom: isUserReadingAwayFromConversationBottom({ nearBottom }),
			recentScrollIntent: hasRecentConversationScrollIntent()
		});
	}
	function captureConversationViewportAnchor(options = {}) {
		const conversation = $("conversation");
		if (!conversation) return null;
		const plan = planConversationViewportPreservation(options);
		if (!plan.preserve) return null;
		const viewport = conversation.getBoundingClientRect();
		const nodes = Array.from(conversation.querySelectorAll("[data-render-key]"));
		for (const node of nodes) {
			if (!node || typeof node.getBoundingClientRect !== "function") continue;
			const key = String(node.getAttribute && node.getAttribute("data-render-key") || "");
			if (!key) continue;
			const rect = node.getBoundingClientRect();
			if (rect.bottom <= viewport.top + 1 || rect.top >= viewport.bottom - 1) continue;
			return {
				threadId: state.currentThreadId || state.currentThread && state.currentThread.id || "",
				renderKey: key,
				topOffset: rect.top - viewport.top,
				scrollTop: conversation.scrollTop,
				reason: plan.reason
			};
		}
		return {
			threadId: state.currentThreadId || state.currentThread && state.currentThread.id || "",
			renderKey: "",
			topOffset: 0,
			scrollTop: conversation.scrollTop,
			reason: plan.reason
		};
	}
	function restoreConversationViewportAnchor(anchor) {
		if (!anchor) return false;
		const conversation = $("conversation");
		if (!conversation) return false;
		const threadId = state.currentThreadId || state.currentThread && state.currentThread.id || "";
		if (String(anchor.threadId || "") !== String(threadId || "")) return false;
		let nextScrollTop = Number(anchor.scrollTop || 0);
		if (anchor.renderKey) {
			const target = conversation.querySelector(`[data-render-key="${escapeSelectorAttr(anchor.renderKey)}"]`);
			if (target && typeof target.getBoundingClientRect === "function") {
				const viewport = conversation.getBoundingClientRect();
				const rect = target.getBoundingClientRect();
				nextScrollTop = conversation.scrollTop + (rect.top - viewport.top - Number(anchor.topOffset || 0));
			}
		}
		const maxScrollTop = Math.max(0, conversation.scrollHeight - conversation.clientHeight);
		nextScrollTop = Math.max(0, Math.min(maxScrollTop, nextScrollTop));
		if (Math.abs(conversation.scrollTop - nextScrollTop) < 1) {
			scheduleScrollToBottomButtonUpdate();
			return false;
		}
		markProgrammaticConversationScroll();
		conversation.scrollTop = nextScrollTop;
		syncConversationScrollPosition();
		scheduleScrollToBottomButtonUpdate();
		return true;
	}
	function scheduleConversationToBottom() {
		scrollConversationToBottom();
		if (state.bottomScrollFrame) return;
		const scroll = () => {
			state.bottomScrollFrame = null;
			scrollConversationToBottom();
		};
		if (window.requestAnimationFrame) state.bottomScrollFrame = window.requestAnimationFrame(scroll);
		else state.bottomScrollFrame = setTimeout(scroll, 33);
	}
	function clearBottomFollowTimers() {
		state.bottomFollowTimers.forEach((timer) => clearTimeout(timer));
		state.bottomFollowTimers = [];
	}
	function clearSubmittedMessageBottomFollow() {
		state.submittedMessageBottomFollow = null;
	}
	function clearViewportBottomFollow() {
		state.viewportBottomFollow = null;
	}
	function shouldFollowSubmittedMessageToBottom() {
		const userReadingCurrentTurn = isUserReadingCurrentTurn();
		let leaseActive = false;
		if (!userReadingCurrentTurn) {
			const threadId = state.currentThreadId || state.currentThread && state.currentThread.id || "";
			leaseActive = conversationScroll.shouldFollowSubmittedMessage(state.submittedMessageBottomFollow, {
				threadId,
				nowMs: Date.now()
			});
		}
		const plan = conversationScroll.planBottomFollowLeaseEvaluation({
			userReadingCurrentTurn,
			leaseActive,
			hasLease: Boolean(state.submittedMessageBottomFollow)
		});
		if (plan.clearLease) clearSubmittedMessageBottomFollow();
		return Boolean(plan.shouldFollow);
	}
	function shouldFollowViewportChangeToBottom() {
		const userReadingCurrentTurn = isUserReadingCurrentTurn();
		let leaseActive = false;
		if (!userReadingCurrentTurn) {
			const threadId = state.currentThreadId || state.currentThread && state.currentThread.id || "";
			leaseActive = conversationScroll.shouldFollowViewport(state.viewportBottomFollow, {
				threadId,
				nowMs: Date.now()
			});
		}
		const plan = conversationScroll.planBottomFollowLeaseEvaluation({
			userReadingCurrentTurn,
			leaseActive,
			hasLease: Boolean(state.viewportBottomFollow)
		});
		if (plan.clearLease) clearViewportBottomFollow();
		return Boolean(plan.shouldFollow);
	}
	function scheduleBottomFollowScroll(shouldFollow) {
		const plan = conversationScroll.planBottomFollowScrollSchedule();
		if (plan.clearExistingTimers) clearBottomFollowTimers();
		plan.delaysMs.forEach((delay) => {
			const timer = window.setTimeout(() => {
				state.bottomFollowTimers = state.bottomFollowTimers.filter((entry) => entry !== timer);
				if (shouldFollow()) scheduleConversationToBottom();
			}, delay);
			state.bottomFollowTimers.push(timer);
		});
	}
	function scheduleSubmittedMessageBottomFollowScroll() {
		scheduleBottomFollowScroll(shouldFollowSubmittedMessageToBottom);
	}
	function scheduleViewportBottomFollowScroll() {
		scheduleBottomFollowScroll(shouldFollowViewportChangeToBottom);
	}
	function followSubmittedMessageToBottom(threadId, clientSubmissionId = "") {
		state.submittedMessageBottomFollow = conversationScroll.createSubmittedMessageFollow(threadId, {
			clientSubmissionId,
			nowMs: Date.now()
		});
		if (!state.submittedMessageBottomFollow) return;
		clearConversationAutoScrollHold();
		clearRecentCompletedReplyAnchor();
		scheduleSubmittedMessageBottomFollowScroll();
	}
	function sustainSubmittedMessageBottomFollow(turn, itemType, field) {
		if (itemType !== "agentMessage" || field !== "text") return;
		if (!turn || !isLatestTurn(turn) || !isLiveTurn(turn)) return;
		const follow = state.submittedMessageBottomFollow;
		const threadId = state.currentThreadId || state.currentThread && state.currentThread.id || "";
		if (!threadId || !follow || String(follow.threadId || "") !== String(threadId)) return;
		if (!conversationScroll.shouldFollowSubmittedMessage(follow, {
			threadId,
			nowMs: Date.now()
		})) return;
		state.submittedMessageBottomFollow = conversationScroll.extendSubmittedMessageFollow(follow, { nowMs: Date.now() });
		scheduleSubmittedMessageBottomFollowScroll();
	}
	function sustainSubmittedMessageBottomFollowFromThread(thread) {
		const follow = state.submittedMessageBottomFollow;
		const threadId = state.currentThreadId || thread && thread.id || "";
		if (!threadId || !follow || String(follow.threadId || "") !== String(threadId)) return false;
		if (!conversationScroll.shouldFollowSubmittedMessage(follow, {
			threadId,
			nowMs: Date.now()
		})) return false;
		const liveTurn = latestLiveTurnForThread(thread);
		if (!liveTurn) return false;
		if (!visibleItemsForTurn(liveTurn, thread).some((entry) => entry && entry.item && entry.item.type !== "userMessage")) return false;
		state.submittedMessageBottomFollow = conversationScroll.extendSubmittedMessageFollow(follow, { nowMs: Date.now() });
		return true;
	}
	function followThreadOpenToBottom(threadId, ttlMs = 8e3) {
		const id = String(threadId || "").trim();
		if (!id) return;
		state.viewportBottomFollow = conversationScroll.createViewportFollow(id, {
			reason: "thread-open",
			nowMs: Date.now(),
			ttlMs
		});
		clearConversationAutoScrollHold();
		clearRecentCompletedReplyAnchor();
		scheduleViewportBottomFollowScroll();
	}
	function followViewportChangeToBottom(reason = "viewport") {
		const threadId = state.currentThreadId || state.currentThread && state.currentThread.id || "";
		if (!threadId || !state.currentThread) return;
		const nowMs = Date.now();
		const alreadyFollowing = shouldFollowViewportChangeToBottom();
		const lastNearBottomAtMs = state.conversationNearBottomThreadId === threadId ? state.conversationNearBottomAtMs : 0;
		if (!(alreadyFollowing || conversationScroll.shouldStartViewportFollow({
			nearBottom: isConversationNearBottom(),
			lastNearBottomAtMs,
			nowMs
		}))) return;
		if (!alreadyFollowing) state.viewportBottomFollow = conversationScroll.createViewportFollow(threadId, {
			reason,
			nowMs
		});
		scheduleViewportBottomFollowScroll();
	}
	function markProgrammaticConversationScroll() {
		state.programmaticScrollUntilMs = Date.now() + 500;
	}
	function clearConversationNearBottomState() {
		state.conversationNearBottomAtMs = 0;
		state.conversationNearBottomThreadId = "";
	}
	function clearConversationUserScrollAwayState() {
		state.conversationUserScrollAwayThreadId = "";
	}
	function rememberConversationUserScrollAwayState() {
		const threadId = state.currentThreadId || state.currentThread && state.currentThread.id || "";
		state.conversationUserScrollAwayThreadId = threadId ? String(threadId) : "";
	}
	function noteConversationBottomState(options = {}) {
		const nearBottom = isConversationNearBottom();
		if (nearBottom) {
			state.conversationNearBottomAtMs = Date.now();
			state.conversationNearBottomThreadId = state.currentThreadId || state.currentThread && state.currentThread.id || "";
			clearConversationUserScrollAwayState();
		} else if (options.userIntent) {
			clearConversationNearBottomState();
			rememberConversationUserScrollAwayState();
		}
		return nearBottom;
	}
	function syncConversationScrollPosition(options = {}) {
		const el = $("conversation");
		if (el) state.conversationLastScrollTop = el.scrollTop;
		noteConversationBottomState(options);
	}
	function hasRecentConversationScrollIntent(nowMs = Date.now()) {
		return nowMs - Number(state.conversationScrollIntentAtMs || 0) <= CONVERSATION_SCROLL_INTENT_MS;
	}
	function isUserReadingAwayFromConversationBottom(options = {}) {
		const threadId = String(options.threadId || state.currentThreadId || state.currentThread && state.currentThread.id || "").trim();
		if (!threadId || state.conversationUserScrollAwayThreadId !== threadId) return false;
		return !(Object.prototype.hasOwnProperty.call(options, "nearBottom") ? Boolean(options.nearBottom) : isConversationNearBottom());
	}
	function rememberConversationScrollIntent() {
		state.conversationScrollIntentAtMs = Date.now();
		clearSubmittedMessageBottomFollow();
		clearViewportBottomFollow();
		syncConversationScrollPosition();
		cancelAutomaticConversationRefreshesIfReading();
	}
	function clearConversationAutoScrollHold() {
		state.autoScrollHold = null;
	}
	function rememberConversationAutoScrollHold() {
		const turn = turnForConversationAutoScrollHold();
		const threadId = state.currentThreadId || state.currentThread && state.currentThread.id || "";
		if (!threadId || !turn || !turn.id) return;
		state.autoScrollHold = {
			threadId: String(threadId),
			turnId: String(turn.id)
		};
	}
	function shouldHoldAutoScrollForCurrentTurn() {
		const hold = state.autoScrollHold;
		if (!hold) return false;
		const threadId = state.currentThreadId || state.currentThread && state.currentThread.id || "";
		const turn = latestTurn();
		return Boolean(threadId && turn && hold.threadId === String(threadId) && hold.turnId === String(turn.id || ""));
	}
	function turnForConversationAutoScrollHold() {
		const live = currentLiveTurn();
		if (live) return live;
		const turn = latestTurn();
		return isRecentReplyJumpTurn(turn) ? turn : null;
	}
	function isUserReadingCurrentTurn(options = {}) {
		const nearBottom = Object.prototype.hasOwnProperty.call(options, "nearBottom") ? Boolean(options.nearBottom) : isConversationNearBottom();
		const planInput = { nearBottom };
		if (!nearBottom) {
			planInput.autoScrollHold = shouldHoldAutoScrollForCurrentTurn();
			if (!planInput.autoScrollHold) {
				planInput.recentScrollIntent = hasRecentConversationScrollIntent();
				if (planInput.recentScrollIntent) planInput.hasCurrentTurn = Boolean(turnForConversationAutoScrollHold());
			}
		}
		const plan = conversationScroll.planUserReadingCurrentTurn(planInput);
		return Boolean(plan.userReadingCurrentTurn);
	}
	function isAutomaticConversationRefreshSource(source) {
		return AUTOMATIC_CONVERSATION_REFRESH_SOURCES.has(String(source || "").trim());
	}
	function automaticConversationRefreshPlan(options = {}) {
		const threadId = String(options.threadId || state.currentThreadId || "").trim();
		const currentThreadId = String(state.currentThreadId || state.currentThread && state.currentThread.id || "").trim();
		const nearBottom = Object.prototype.hasOwnProperty.call(options, "nearBottom") ? Boolean(options.nearBottom) : isConversationNearBottom();
		const hasThread = Boolean(threadId && currentThreadId && threadId === currentThreadId && state.currentThread && String(state.currentThread.id || currentThreadId) === currentThreadId);
		return conversationScroll.planAutomaticConversationRefresh({
			hasThread,
			nearBottom,
			userReadingCurrentTurn: !nearBottom && isUserReadingCurrentTurn({ nearBottom }),
			autoScrollHold: !nearBottom && shouldHoldAutoScrollForCurrentTurn(),
			userReadingAwayFromBottom: !nearBottom && isUserReadingAwayFromConversationBottom({
				threadId,
				nearBottom
			}),
			recentScrollIntent: !nearBottom && hasRecentConversationScrollIntent(),
			userInitiated: options.userInitiated === true
		});
	}
	function shouldSuppressAutomaticCurrentThreadRefresh(source, options = {}) {
		if (!isAutomaticConversationRefreshSource(source)) return false;
		return !automaticConversationRefreshPlan(options).allowRefresh;
	}
	function clearAutomaticConversationRefreshTimersForUserReading() {
		clearTimeout(state.refreshTimer);
		state.refreshTimer = null;
		state.postCompletionRefreshTimers.forEach((timer) => clearTimeout(timer));
		state.postCompletionRefreshTimers = [];
		clearUsageBackfillRefresh();
		clearTimeout(state.pollTimer);
		state.pollTimer = null;
	}
	function cancelAutomaticConversationRefreshesIfReading() {
		if (!automaticConversationRefreshPlan().cancelScheduled) return false;
		clearAutomaticConversationRefreshTimersForUserReading();
		return true;
	}
	function updateConversationAutoScrollHoldFromScroll() {
		const nearBottom = isConversationNearBottom();
		const planInput = { nearBottom };
		if (!nearBottom) {
			planInput.recentScrollIntent = hasRecentConversationScrollIntent();
			if (planInput.recentScrollIntent) planInput.hasCurrentTurn = Boolean(turnForConversationAutoScrollHold());
		}
		const plan = conversationScroll.planConversationAutoScrollHoldFromScroll(planInput);
		if (plan.action === "clear-hold") {
			clearConversationAutoScrollHold();
			return;
		}
		if (plan.action === "remember-hold") rememberConversationAutoScrollHold();
		cancelAutomaticConversationRefreshesIfReading();
	}
	function clearRecentCompletedReplyAnchor() {
		state.recentCompletedReplyAnchor = null;
	}
	function rememberRecentCompletedTurnReply(turnId) {
		const threadId = state.currentThreadId || state.currentThread && state.currentThread.id || "";
		if (!threadId || !turnId) return;
		const normalizedThreadId = String(threadId);
		const normalizedTurnId = String(turnId);
		const previousAnchor = state.recentCompletedReplyAnchor;
		const keepActivatedByUserScroll = Boolean(previousAnchor && previousAnchor.threadId === normalizedThreadId && previousAnchor.turnId === normalizedTurnId && previousAnchor.activatedByUserScroll);
		state.recentCompletedReplyAnchor = {
			threadId: normalizedThreadId,
			turnId: normalizedTurnId,
			completedAtMs: Date.now(),
			activatedByCompletion: true,
			activatedByUserScroll: keepActivatedByUserScroll,
			receiptStartLocated: false
		};
	}
	function numericTimestampMs(value) {
		if (!value) return 0;
		const number = Number(value);
		if (!Number.isFinite(number) || number <= 0) {
			if (typeof value !== "string") return 0;
			const parsed = Date.parse(value);
			return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
		}
		return number > 1e11 ? number : number * 1e3;
	}
	function uuidV7TimestampMs(value) {
		const text = String(value || "").trim();
		if (!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) return 0;
		const timestampMs = Number.parseInt(text.replace(/-/g, "").slice(0, 12), 16);
		if (!Number.isFinite(timestampMs)) return 0;
		if (timestampMs < 9466848e5 || timestampMs > 41024448e5) return 0;
		return timestampMs;
	}
	function turnIdentityTimestampMs(turn) {
		return uuidV7TimestampMs(turn && (turn.id || turn.turnId || turn.turn_id));
	}
	function turnCompletedAtMs(turn, thread = null) {
		if (!turn) return 0;
		const explicitCompletedAt = numericTimestampMs(turn.completedAtMs) || numericTimestampMs(turn.completedAt) || numericTimestampMs(turn.completed_at_ms) || numericTimestampMs(turn.completed_at) || numericTimestampMs(turn.finishedAt) || numericTimestampMs(turn.finished_at);
		if (explicitCompletedAt) return explicitCompletedAt;
		if (!isTurnComplete(turn)) return 0;
		const startedAt = turnStartedAtMs(turn);
		const fallback = numericTimestampMs(turn.updatedAt) || numericTimestampMs(turn.updated_at) || (turnIdentityTimestampMs(turn) ? 0 : numericTimestampMs(thread && (thread.updatedAt || thread.updated_at)));
		if (!fallback || startedAt && fallback < startedAt) return 0;
		return fallback;
	}
	function isRecentReplyJumpTurn(turn) {
		if (!turn) return false;
		if (isLiveTurn(turn)) return true;
		return isTurnComplete(turn);
	}
	function activateRecentCompletedReplyAnchorFromUserScroll() {
		const turn = currentLiveTurn() || latestTurn();
		const threadId = state.currentThreadId || state.currentThread && state.currentThread.id || "";
		if (!threadId || !turn || !turn.id) return false;
		if (!isRecentReplyJumpTurn(turn)) return false;
		state.recentCompletedReplyAnchor = {
			threadId: String(threadId),
			turnId: String(turn.id),
			completedAtMs: Date.now(),
			activatedByCompletion: false,
			activatedByUserScroll: true,
			receiptStartLocated: false
		};
		return true;
	}
	function updateRecentCompletedReplyAnchorFromScroll() {
		const el = $("conversation");
		if (!el) return;
		const currentTop = el.scrollTop;
		const delta = currentTop - Number(state.conversationLastScrollTop || 0);
		state.conversationLastScrollTop = currentTop;
		noteConversationBottomState({ userIntent: hasRecentConversationScrollIntent() });
		if (Date.now() < state.programmaticScrollUntilMs) return;
		if (!hasRecentConversationScrollIntent()) return;
		if (delta < -2) activateRecentCompletedReplyAnchorFromUserScroll();
		else if (delta > 2 && !(state.recentCompletedReplyAnchor && state.recentCompletedReplyAnchor.activatedByCompletion)) clearRecentCompletedReplyAnchor();
	}
	function currentRecentCompletedReplyAnchor() {
		const anchor = state.recentCompletedReplyAnchor;
		if (!anchor) return null;
		const threadId = state.currentThreadId || state.currentThread && state.currentThread.id || "";
		if (!threadId || anchor.threadId !== String(threadId)) return null;
		if (!anchor.activatedByUserScroll && !anchor.activatedByCompletion) return null;
		const turn = latestTurn();
		if (!turn || String(turn.id || "") !== anchor.turnId || !isTurnComplete(turn) && !isLiveTurn(turn)) return null;
		return anchor;
	}
	function turnNodeForId(turnId) {
		const conversation = $("conversation");
		if (!conversation || !turnId) return null;
		return Array.from(conversation.querySelectorAll(".turn")).find((node) => node.dataset.turn === String(turnId)) || null;
	}
	function turnFinalReceiptNode(anchor = currentRecentCompletedReplyAnchor()) {
		if (!anchor) return null;
		const turnNode = turnNodeForId(anchor.turnId);
		if (!turnNode) return null;
		const finalReceipts = Array.from(turnNode.querySelectorAll(".item.agentMessage, .item.plan"));
		if (finalReceipts.length) return finalReceipts[finalReceipts.length - 1];
		const fallbackItems = Array.from(turnNode.querySelectorAll(".item:not(.userMessage):not(.live-operation):not(.turnUsageSummary)"));
		if (fallbackItems.length) return fallbackItems[fallbackItems.length - 1];
		return turnNode;
	}
	function finalReceiptItemForTurn(turn) {
		const items = Array.isArray(turn && turn.items) ? turn.items : [];
		for (let i = items.length - 1; i >= 0; i -= 1) {
			const item = items[i];
			if (item && (item.type === "agentMessage" || item.type === "plan")) return item;
		}
		return null;
	}
	function finalReceiptTextForTurn(turn) {
		const item = finalReceiptItemForTurn(turn);
		return String(item && item.text || "").trim();
	}
	function shouldScrollToLongReceiptStart(turn) {
		return Boolean(turn && isTurnComplete(turn) && finalReceiptTextForTurn(turn).length >= LONG_RECEIPT_SCROLL_CHARS);
	}
	function pendingCompletedReceiptStartTurnId() {
		const anchor = currentRecentCompletedReplyAnchor();
		if (!anchor || !anchor.activatedByCompletion || anchor.receiptStartLocated) return "";
		if (!shouldScrollToLongReceiptStart(turnById(anchor.turnId))) return "";
		return String(anchor.turnId || "");
	}
	function scrollConversationToTurnReceiptStart(turnId) {
		if (!turnId) return;
		const target = turnFinalReceiptNode({ turnId });
		if (!target) return;
		clearSubmittedMessageBottomFollow();
		clearViewportBottomFollow();
		clearConversationNearBottomState();
		scrollNodeIntoConversationView(target);
		if (state.recentCompletedReplyAnchor && state.recentCompletedReplyAnchor.turnId === String(turnId)) state.recentCompletedReplyAnchor.receiptStartLocated = true;
		scheduleScrollToBottomButtonUpdate();
	}
	function scrollNodeIntoConversationView(node, margin = 12) {
		const el = $("conversation");
		if (!el || !node) return;
		const viewport = el.getBoundingClientRect();
		const rect = node.getBoundingClientRect();
		const target = el.scrollTop + rect.top - viewport.top - margin;
		markProgrammaticConversationScroll();
		el.scrollTop = Math.max(0, Math.min(target, Math.max(0, el.scrollHeight - el.clientHeight)));
		syncConversationScrollPosition();
	}
	function ensureUsageSummaryExpandedVisible(summary) {
		const el = $("conversation");
		if (!el || !summary || !summary.open) return;
		const adjust = () => {
			if (!summary.open || !summary.isConnected) return;
			const viewport = el.getBoundingClientRect();
			const rect = summary.getBoundingClientRect();
			const margin = 14;
			const availableHeight = Math.max(0, viewport.height - margin * 2);
			const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
			let nextScrollTop = el.scrollTop;
			if (rect.height > availableHeight && rect.top < viewport.top + margin) nextScrollTop += rect.top - viewport.top - margin;
			else if (rect.bottom > viewport.bottom - margin) nextScrollTop += rect.bottom - viewport.bottom + margin;
			nextScrollTop = Math.max(0, Math.min(nextScrollTop, maxScrollTop));
			if (Math.abs(nextScrollTop - el.scrollTop) < 2) return;
			markProgrammaticConversationScroll();
			el.scrollTop = nextScrollTop;
			syncConversationScrollPosition();
			scheduleScrollToBottomButtonUpdate();
		};
		if (window.requestAnimationFrame) window.requestAnimationFrame(adjust);
		else window.setTimeout(adjust, 0);
		window.setTimeout(adjust, 160);
	}
	function handleUsageSummaryToggle(event) {
		const summary = event && event.target && event.target.closest ? event.target.closest(".turn-usage-summary") : null;
		if (!summary || !summary.open) return;
		ensureUsageSummaryExpandedVisible(summary);
	}
	function scrollConversationToTurnReply() {
		const target = turnFinalReceiptNode();
		if (!target) return;
		clearSubmittedMessageBottomFollow();
		clearViewportBottomFollow();
		clearConversationNearBottomState();
		scrollNodeIntoConversationView(target);
		clearRecentCompletedReplyAnchor();
		scheduleScrollToBottomButtonUpdate();
	}
	function isConversationNearBottom() {
		const el = $("conversation");
		if (!el) return true;
		return conversationScroll.isNearBottom({
			scrollHeight: el.scrollHeight,
			scrollTop: el.scrollTop,
			clientHeight: el.clientHeight
		});
	}
	function updateScrollToBottomButton() {
		const button = $("scrollToBottom");
		const replyButton = $("scrollToTurnReply");
		const el = $("conversation");
		if (!button || !el) return;
		const isScrollable = el.scrollHeight - el.clientHeight > 128;
		const replyAnchor = replyButton ? currentRecentCompletedReplyAnchor() : null;
		const replyNode = replyButton ? turnFinalReceiptNode(replyAnchor) : null;
		const jumpPlan = conversationScroll.planConversationJumpButtons({
			hasThread: Boolean(state.currentThread),
			loading: Boolean(state.currentThread && state.currentThread.mobileLoading),
			loadError: Boolean(state.currentThread && state.currentThread.mobileLoadError),
			isScrollable,
			nearBottom: isConversationNearBottom(),
			hasReplyTarget: Boolean(replyNode),
			replyTargetAbove: Boolean(replyNode && isNodeStartAboveConversationViewport(replyNode))
		});
		const shouldShow = Boolean(jumpPlan.showBottom);
		button.classList.toggle("hidden", !shouldShow);
		button.setAttribute("aria-hidden", shouldShow ? "false" : "true");
		button.tabIndex = shouldShow ? 0 : -1;
		if (!replyButton) return;
		const shouldShowReply = Boolean(jumpPlan.showReply);
		replyButton.classList.toggle("hidden", !shouldShowReply);
		replyButton.setAttribute("aria-hidden", shouldShowReply ? "false" : "true");
		replyButton.tabIndex = shouldShowReply ? 0 : -1;
	}
	function scheduleScrollToBottomButtonUpdate() {
		if (state.scrollToBottomFrame) return;
		const update = () => {
			state.scrollToBottomFrame = null;
			updateScrollToBottomButton();
		};
		if (window.requestAnimationFrame) state.scrollToBottomFrame = window.requestAnimationFrame(update);
		else state.scrollToBottomFrame = setTimeout(update, 33);
	}
	function createEventStreamRuntime() {
		return {
			connectEvents: typeof connectEvents === "function" ? connectEvents : null,
			applyNotification: typeof applyNotification === "function" ? applyNotification : null,
			resumeMobileSession: typeof resumeMobileSession === "function" ? resumeMobileSession : null,
			scrollConversationToBottom: typeof scrollConversationToBottom === "function" ? scrollConversationToBottom : null,
			updateScrollToBottomButton: typeof updateScrollToBottomButton === "function" ? updateScrollToBottomButton : null
		};
	}
	(function exposeCodexEventStreamRuntime(root) {
		const eventStreamRuntimeApi = { createEventStreamRuntime };
		const legacyGlobals = {
			shouldRenderAfterUpsert,
			upsertItem,
			removeItem,
			ensureTimerItem,
			shouldRenderAfterAppend,
			appendToItem,
			scheduleRenderCurrentThread,
			scheduleRenderThreads,
			upsertServerRequest,
			scheduleApprovalRemoval,
			resolveServerRequest,
			serverRequestWithThreadContext,
			syncThreadPendingServerRequests,
			applyThreadGoalToThread,
			scheduleThreadGoalDetailRender,
			updateThreadGoalState,
			applyNotification,
			resetEventFallbackState,
			scheduleEventReconnectRetry,
			shouldRefreshThreadListDuringEventRecovery,
			refreshThreadListDuringEventRecovery,
			scheduleEventFallbackPoll,
			recoverEventStreamWithApiFallback,
			connectEvents,
			ensureEventConnection,
			clearResumeVisualTimers,
			clearVisualRecoveryTimers,
			visualRecoveryReasonAllowsHeavy,
			shouldRunHeavyVisualRecovery,
			forceVisualRecovery,
			scheduleVisualRecovery,
			scheduleMobileResume,
			isTransientResumeError,
			scheduleTransientResumeRetry,
			resumeMobileSession,
			scrollConversationToBottom,
			planConversationViewportPreservation,
			captureConversationViewportAnchor,
			restoreConversationViewportAnchor,
			scheduleConversationToBottom,
			clearBottomFollowTimers,
			clearSubmittedMessageBottomFollow,
			clearViewportBottomFollow,
			shouldFollowSubmittedMessageToBottom,
			shouldFollowViewportChangeToBottom,
			scheduleBottomFollowScroll,
			scheduleSubmittedMessageBottomFollowScroll,
			scheduleViewportBottomFollowScroll,
			followSubmittedMessageToBottom,
			sustainSubmittedMessageBottomFollow,
			sustainSubmittedMessageBottomFollowFromThread,
			followThreadOpenToBottom,
			followViewportChangeToBottom,
			markProgrammaticConversationScroll,
			clearConversationNearBottomState,
			clearConversationUserScrollAwayState,
			rememberConversationUserScrollAwayState,
			noteConversationBottomState,
			syncConversationScrollPosition,
			hasRecentConversationScrollIntent,
			isUserReadingAwayFromConversationBottom,
			rememberConversationScrollIntent,
			clearConversationAutoScrollHold,
			rememberConversationAutoScrollHold,
			shouldHoldAutoScrollForCurrentTurn,
			turnForConversationAutoScrollHold,
			isUserReadingCurrentTurn,
			isAutomaticConversationRefreshSource,
			automaticConversationRefreshPlan,
			shouldSuppressAutomaticCurrentThreadRefresh,
			clearAutomaticConversationRefreshTimersForUserReading,
			cancelAutomaticConversationRefreshesIfReading,
			updateConversationAutoScrollHoldFromScroll,
			clearRecentCompletedReplyAnchor,
			rememberRecentCompletedTurnReply,
			numericTimestampMs,
			uuidV7TimestampMs,
			turnIdentityTimestampMs,
			turnCompletedAtMs,
			isRecentReplyJumpTurn,
			activateRecentCompletedReplyAnchorFromUserScroll,
			updateRecentCompletedReplyAnchorFromScroll,
			currentRecentCompletedReplyAnchor,
			turnNodeForId,
			turnFinalReceiptNode,
			finalReceiptItemForTurn,
			finalReceiptTextForTurn,
			shouldScrollToLongReceiptStart,
			pendingCompletedReceiptStartTurnId,
			scrollConversationToTurnReceiptStart,
			scrollNodeIntoConversationView,
			ensureUsageSummaryExpandedVisible,
			handleUsageSummaryToggle,
			scrollConversationToTurnReply,
			isConversationNearBottom,
			updateScrollToBottomButton,
			scheduleScrollToBottomButtonUpdate
		};
		if (typeof module === "object" && module.exports) module.exports = eventStreamRuntimeApi;
		Object.assign(root, legacyGlobals);
		root.CodexEventStreamRuntime = eventStreamRuntimeApi;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
//#region public/client-render-stability-guard.js
var require_client_render_stability_guard = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function initClientRenderStabilityGuard(globalScope) {
		function stringValue(value) {
			return String(value || "").trim();
		}
		function shortHash(value) {
			const text = stringValue(value);
			let hash = 2166136261;
			for (let index = 0; index < text.length; index += 1) {
				hash ^= text.charCodeAt(index);
				hash = Math.imul(hash, 16777619);
			}
			return (hash >>> 0).toString(36);
		}
		function submittedUserItemClientSubmissionId(item) {
			if (!item || item.type !== "userMessage") return "";
			return stringValue(item.clientSubmissionId);
		}
		function firstSubmittedUserMessageClientSubmissionId(turn) {
			const items = Array.isArray(turn && turn.items) ? turn.items : [];
			for (const item of items) {
				const submissionId = submittedUserItemClientSubmissionId(item);
				if (submissionId) return submissionId;
			}
			return "";
		}
		function localSubmissionRenderKey(clientSubmissionId) {
			const submissionId = stringValue(clientSubmissionId);
			return submissionId ? `submitted:${shortHash(submissionId)}` : "";
		}
		function submittedTurnRenderKey(turn) {
			const explicit = stringValue(turn && turn.mobileLocalSubmissionRenderKey);
			if (explicit) return explicit;
			return localSubmissionRenderKey(firstSubmittedUserMessageClientSubmissionId(turn));
		}
		function stableTurnIdentity(turn) {
			return submittedTurnRenderKey(turn) || stringValue(turn && (turn.id || turn.startedAt)) || "turn";
		}
		function markSubmittedTurn(turn, clientSubmissionId) {
			if (!turn || typeof turn !== "object") return "";
			const key = localSubmissionRenderKey(clientSubmissionId);
			if (key) turn.mobileLocalSubmissionRenderKey = key;
			return key;
		}
		function transferSubmittedTurnIdentity(sourceTurn, targetTurn, clientSubmissionId) {
			if (!targetTurn || typeof targetTurn !== "object") return "";
			const key = submittedTurnRenderKey(sourceTurn) || submittedTurnRenderKey(targetTurn) || localSubmissionRenderKey(clientSubmissionId);
			if (key) targetTurn.mobileLocalSubmissionRenderKey = key;
			return key;
		}
		const api = {
			firstSubmittedUserMessageClientSubmissionId,
			localSubmissionRenderKey,
			markSubmittedTurn,
			shortHash,
			stableTurnIdentity,
			submittedTurnRenderKey,
			transferSubmittedTurnIdentity
		};
		if (typeof module !== "undefined" && module.exports) module.exports = api;
		globalScope.CodexClientRenderStabilityGuard = api;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
//#region public/live-operation-dock-state.js
var require_live_operation_dock_state = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexLiveOperationDockState = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_MIN_VISIBLE_MS = 500;
		function normalizeMode(mode) {
			return String(mode || "") === "expanded" ? "expanded" : "compact";
		}
		function text(value) {
			return String(value || "");
		}
		function isCompletedStatusText(value) {
			return /completed|failed|cancel|error|interrupted/i.test(text(value));
		}
		function nowValue(value) {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : Date.now();
		}
		function containsBubble(html) {
			return text(html).includes("mobile-operation-bubble");
		}
		function containsSheet(html) {
			return text(html).includes("mobile-operation-sheet");
		}
		function rememberCompactBubble(input = {}) {
			const nowMs = nowValue(input.nowMs);
			const minVisibleMs = Math.max(0, Number(input.minVisibleMs || DEFAULT_MIN_VISIBLE_MS));
			const existingUntilMs = Number(input.existingVisibleUntilMs || 0);
			const html = text(input.html);
			const threadId = text(input.threadId);
			return {
				visibleUntilMs: Math.max(existingUntilMs, nowMs + minVisibleMs),
				html,
				threadId,
				recallHtml: html,
				recallThreadId: threadId,
				recallAtMs: nowMs
			};
		}
		function compactBubblePreservation(input = {}) {
			if (containsBubble(input.nextHtml)) return { preserve: false };
			if (input.liveTurnActive === false) return { preserve: false };
			const remainingMs = Number(input.visibleUntilMs || 0) - nowValue(input.nowMs);
			if (remainingMs <= 0) return { preserve: false };
			const savedThreadId = text(input.savedThreadId);
			if (!savedThreadId || savedThreadId !== text(input.currentThreadId)) return { preserve: false };
			const savedHtml = text(input.savedHtml);
			const dockHasBubble = Boolean(input.dockHasBubble);
			if (!dockHasBubble && !containsBubble(savedHtml)) return { preserve: false };
			return {
				preserve: true,
				remainingMs,
				patchSavedHtml: Boolean(savedHtml && !dockHasBubble),
				savedHtml
			};
		}
		function shouldPreservePinned(input = {}) {
			return Boolean(input.pinned && normalizeMode(input.mode) === "expanded" && text(input.pinnedThreadId) === text(input.currentThreadId) && input.dockHasSheet && input.liveTurnActive !== false && !containsBubble(input.nextHtml));
		}
		function shouldShowRecall(input = {}) {
			const recallThreadId = text(input.recallThreadId);
			return Boolean(input.isMobile && input.hasCurrentThread && !input.newThreadDraft && input.liveTurnActive !== false && recallThreadId && recallThreadId === text(input.currentThreadId) && containsSheet(input.recallHtml));
		}
		function operationCardContentPlan(input = {}) {
			const status = text(input.status || (input.completed ? "completed" : "running")).trim();
			const type = text(input.type || input.itemType || "item").trim() || "item";
			const title = text(input.title || type).trim() || type;
			const detail = text(input.detail).replace(/\s+/g, " ").trim();
			const durationText = text(input.durationText).trim();
			const extraClass = text(input.extraClass).trim();
			const completed = Boolean(input.completed || isCompletedStatusText(status));
			return {
				itemId: text(input.itemId).trim(),
				type,
				status,
				title,
				detail,
				detailEmpty: !detail,
				statusVisible: Boolean(status),
				durationVisible: Boolean(durationText),
				durationText,
				durationTitle: durationText ? `Elapsed ${durationText}` : "",
				durationAttrs: text(input.durationAttrs).trim(),
				classTokens: [
					"item",
					"live-operation",
					extraClass,
					completed ? "completed" : "",
					type
				].filter(Boolean)
			};
		}
		function htmlEscaper(input = {}) {
			return typeof input.escapeHtml === "function" ? input.escapeHtml : (value) => text(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
		}
		function durationAttributeHtml(value, escape) {
			const attrs = [];
			const input = text(value);
			const attrPattern = /\b(data-(?:started|completed|duration)-ms)="([^"]*)"/g;
			let match;
			while (match = attrPattern.exec(input)) attrs.push(`${match[1]}="${escape(match[2])}"`);
			return attrs.join(" ");
		}
		function operationCardHtml(input = {}) {
			const escape = htmlEscaper(input);
			const plan = input.plan || operationCardContentPlan(input);
			const renderKey = text(input.renderKey || input.key).trim();
			const durationAttrs = durationAttributeHtml(plan.durationAttrs, escape);
			const duration = plan.durationVisible ? `<time class="operation-duration" ${durationAttrs} title="${escape(plan.durationTitle)}">${escape(plan.durationText)}</time>` : "";
			const classes = (Array.isArray(plan.classTokens) ? plan.classTokens : []).map(escape).join(" ");
			const detailValue = plan.detail ? escape(plan.detail) : "&nbsp;";
			const body = `<div class="operation-detail-line${plan.detailEmpty ? " empty" : ""}"><span class="operation-detail">${detailValue}</span></div>`;
			const statusHtml = plan.statusVisible ? `<span class="operation-status">${escape(plan.status)}</span>` : "";
			return `<section class="${classes}" data-item="${escape(plan.itemId)}" data-render-key="${escape(renderKey)}">
    <div class="operation-meta-line"><span class="operation-meta-main"><span class="operation-title">${escape(plan.title)}</span>${statusHtml}</span>${duration}</div>
    ${body}
  </section>`;
		}
		return {
			DEFAULT_MIN_VISIBLE_MS,
			compactBubblePreservation,
			containsBubble,
			containsSheet,
			normalizeMode,
			operationCardContentPlan,
			operationCardHtml,
			rememberCompactBubble,
			shouldPreservePinned,
			shouldShowRecall
		};
	});
}));
//#endregion
//#region \0virtual:codex-mobile-esm-compatibility/shard/shard-06
var import_conversation_render_runtime = /* @__PURE__ */ __toESM(require_conversation_render_runtime());
var import_event_stream_runtime = /* @__PURE__ */ __toESM(require_event_stream_runtime());
var import_client_render_stability_guard = /* @__PURE__ */ __toESM(require_client_render_stability_guard());
var import_live_operation_dock_state = /* @__PURE__ */ __toESM(require_live_operation_dock_state());
var moduleDefinitions = [
	{
		"id": "conversation-render-runtime",
		"source": "public/conversation-render-runtime.js",
		"globalName": "CodexConversationRenderRuntime",
		"expectedFunctions": ["createConversationRenderRuntime"],
		"assetPath": "/conversation-render-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 69696
	},
	{
		"id": "event-stream-runtime",
		"source": "public/event-stream-runtime.js",
		"globalName": "CodexEventStreamRuntime",
		"expectedFunctions": ["createEventStreamRuntime"],
		"assetPath": "/event-stream-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 62586
	},
	{
		"id": "client-render-stability-guard",
		"source": "public/client-render-stability-guard.js",
		"globalName": "CodexClientRenderStabilityGuard",
		"expectedFunctions": [
			"firstSubmittedUserMessageClientSubmissionId",
			"localSubmissionRenderKey",
			"markSubmittedTurn",
			"shortHash",
			"stableTurnIdentity",
			"submittedTurnRenderKey",
			"transferSubmittedTurnIdentity"
		],
		"assetPath": "/client-render-stability-guard.js",
		"classicLoaderExcluded": true,
		"bytes": 2528
	},
	{
		"id": "live-operation-dock-state",
		"source": "public/live-operation-dock-state.js",
		"globalName": "CodexLiveOperationDockState",
		"expectedFunctions": [
			"compactBubblePreservation",
			"operationCardContentPlan",
			"shouldShowRecall"
		],
		"assetPath": "/live-operation-dock-state.js",
		"classicLoaderExcluded": true,
		"bytes": 6190
	}
];
var moduleApis = {
	"conversation-render-runtime": import_conversation_render_runtime.default,
	"event-stream-runtime": import_event_stream_runtime.default,
	"client-render-stability-guard": import_client_render_stability_guard.default,
	"live-operation-dock-state": import_live_operation_dock_state.default
};
function functionReady(api, name) {
	return Boolean(api && typeof api[name] === "function");
}
function publishClassicGlobal(definition, api) {
	const globalName = String(definition && definition.globalName || "");
	if (!globalName || !api || typeof api !== "object" || typeof globalThis === "undefined") return false;
	globalThis[globalName] = api;
	return globalThis[globalName] === api;
}
function sampleModule(id, api) {
	if (id === "build-refresh-policy") {
		const classification = functionReady(api, "classifyServerBuildChange") ? api.classifyServerBuildChange("0.1.11|codex-mobile-shell-v626", "0.1.11|codex-mobile-shell-v625") : "";
		const prompt = functionReady(api, "shouldPromptForServerBuildChange") ? api.shouldPromptForServerBuildChange("0.1.11|codex-mobile-shell-v626", "0.1.11|codex-mobile-shell-v625") : false;
		return {
			ok: classification === "server-newer" && prompt === true,
			classification,
			prompt
		};
	}
	if (id === "runtime-settings") {
		const normalizedOptions = functionReady(api, "normalizeOptionList") ? api.normalizeOptionList([
			"",
			"gpt-5.5",
			" gpt-5.5 ",
			"gpt-5.4"
		]) : [];
		const modelLabel = functionReady(api, "labelForModel") ? api.labelForModel("gpt-5.3-codex-spark") : "";
		const compactModelLabel = functionReady(api, "compactLabelForModel") ? api.compactLabelForModel("gpt-5.3-codex-spark") : "";
		const effortLabel = functionReady(api, "labelForEffort") ? api.labelForEffort("xhigh") : "";
		const permissionLabel = functionReady(api, "labelForPermissionMode") ? api.labelForPermissionMode("full") : "";
		const permissionTitle = functionReady(api, "titleForPermissionMode") ? api.titleForPermissionMode("custom") : "";
		const permissionAlias = functionReady(api, "normalizePermissionModeValue") ? api.normalizePermissionModeValue("full-access") : "";
		const selectedModel = functionReady(api, "selectedNewThreadModel") ? api.selectedNewThreadModel({
			selected: "",
			defaultValue: "gpt-5.5",
			options: ["gpt-5.4"]
		}) : "";
		const selectedEffort = functionReady(api, "selectedNewThreadEffort") ? api.selectedNewThreadEffort({
			selected: " high ",
			defaultValue: "medium",
			options: ["low"]
		}) : "";
		const selectedPermission = functionReady(api, "selectedNewThreadPermission") ? api.selectedNewThreadPermission({
			selected: "workspace-write",
			defaultValue: "full",
			options: ["auto"]
		}) : "";
		return {
			ok: Array.isArray(normalizedOptions) && normalizedOptions.join(",") === "gpt-5.5,gpt-5.4" && modelLabel === "GPT-5.3 Codex Spark" && compactModelLabel === "5.3 Spark" && effortLabel === "XHigh" && permissionLabel === "完全访问权限" && permissionTitle === "自定义 (config.toml)" && permissionAlias === "full" && selectedModel === "gpt-5.5" && selectedEffort === "high" && selectedPermission === "auto",
			normalizedOptions,
			modelLabel,
			compactModelLabel,
			effortLabel,
			permissionLabel,
			permissionTitle,
			permissionAlias,
			selectedModel,
			selectedEffort,
			selectedPermission
		};
	}
	if (id === "viewport-metrics") {
		const editable = functionReady(api, "isKeyboardEditable") ? api.isKeyboardEditable({
			tagName: "INPUT",
			type: "text"
		}) : false;
		const checkboxEditable = functionReady(api, "isKeyboardEditable") ? api.isKeyboardEditable({
			tagName: "INPUT",
			type: "checkbox"
		}) : true;
		const measurement = functionReady(api, "measureViewport") ? api.measureViewport({
			visualHeight: 520,
			visualOffsetTop: 16,
			innerHeight: 1024,
			clientHeight: 1024,
			activeElement: { tagName: "TEXTAREA" }
		}) : {};
		const stableChanged = functionReady(api, "stablePixelChanged") ? api.stablePixelChanged(92, 94) : false;
		const stableNoise = functionReady(api, "stablePixelChanged") ? api.stablePixelChanged(92, 93) : true;
		const cssPixel = functionReady(api, "cssPixel") ? api.cssPixel(92.6) : 0;
		return {
			ok: editable === true && checkboxEditable === false && measurement.keyboardShrunk === true && measurement.height === 520 && measurement.top === 16 && stableChanged === true && stableNoise === false && cssPixel === 93,
			editable,
			checkboxEditable,
			keyboardShrunk: Boolean(measurement.keyboardShrunk),
			height: Number(measurement.height) || 0,
			top: Number(measurement.top) || 0,
			stableChanged,
			stableNoise,
			cssPixel
		};
	}
	if (id === "conversation-scroll") {
		const nearBottom = functionReady(api, "isNearBottom") ? api.isNearBottom({
			scrollHeight: 1800,
			scrollTop: 725,
			clientHeight: 980
		}) : false;
		const notNearBottom = functionReady(api, "isNearBottom") ? api.isNearBottom({
			scrollHeight: 1800,
			scrollTop: 640,
			clientHeight: 980
		}) : true;
		const submittedFollow = functionReady(api, "createSubmittedMessageFollow") ? api.createSubmittedMessageFollow("thread-a", {
			clientSubmissionId: "submit-1",
			nowMs: 1e3,
			ttlMs: 5e3
		}) : null;
		const submittedActive = functionReady(api, "shouldFollowSubmittedMessage") ? api.shouldFollowSubmittedMessage(submittedFollow, {
			threadId: "thread-a",
			nowMs: 5999
		}) : false;
		const submittedWrongThread = functionReady(api, "shouldFollowSubmittedMessage") ? api.shouldFollowSubmittedMessage(submittedFollow, {
			threadId: "thread-b",
			nowMs: 2e3
		}) : true;
		const viewportFollow = functionReady(api, "createViewportFollow") ? api.createViewportFollow("thread-a", {
			reason: "orientation",
			nowMs: 1e3,
			ttlMs: 3e3
		}) : null;
		const viewportActive = functionReady(api, "shouldFollowViewport") ? api.shouldFollowViewport(viewportFollow, {
			threadId: "thread-a",
			nowMs: 3999
		}) : false;
		const lease = functionReady(api, "planBottomFollowLeaseEvaluation") ? api.planBottomFollowLeaseEvaluation({
			leaseActive: true,
			hasLease: true
		}) : {};
		const schedule = functionReady(api, "planBottomFollowScrollSchedule") ? api.planBottomFollowScrollSchedule() : {};
		const refresh = functionReady(api, "planAutomaticConversationRefresh") ? api.planAutomaticConversationRefresh({
			hasThread: true,
			nearBottom: false,
			userReadingCurrentTurn: true
		}) : {};
		const fullRender = functionReady(api, "planFullRenderScroll") ? api.planFullRenderScroll({ submittedMessageFollow: true }) : {};
		return {
			ok: nearBottom === true && notNearBottom === false && submittedFollow && submittedFollow.untilMs === 6e3 && submittedActive === true && submittedWrongThread === false && viewportFollow && viewportFollow.untilMs === 4e3 && viewportActive === true && lease.reason === "lease-active" && Array.isArray(schedule.delaysMs) && schedule.delaysMs.join(",") === "0,80,240,600,1200" && refresh.allowRefresh === false && refresh.reason === "user-reading-current-turn" && fullRender.stickToBottom === true && fullRender.reason === "submitted-message-follow",
			nearBottom,
			submittedActive,
			viewportActive,
			leaseReason: String(lease.reason || ""),
			scheduleDelays: Array.isArray(schedule.delaysMs) ? schedule.delaysMs : [],
			refreshReason: String(refresh.reason || ""),
			fullRenderReason: String(fullRender.reason || "")
		};
	}
	if (id === "thread-performance-metrics") {
		const listPhase = functionReady(api, "classifyThreadListPhase") ? api.classifyThreadListPhase({
			fallbackCacheDecision: "expired-rebuild",
			fallbackMs: 25
		}) : "";
		const detailPhase = functionReady(api, "classifyThreadDetailPhase") ? api.classifyThreadDetailPhase({
			readDecision: "projection-hit",
			projectionSource: "dynamic"
		}) : "";
		const clientTimings = functionReady(api, "threadDetailClientTimings") ? api.threadDetailClientTimings({
			elapsedMs: 26.4,
			renderElapsedMs: 7.2,
			detailRenderMode: "patch"
		}) : {};
		const detailFields = functionReady(api, "threadDetailEventFields") ? api.threadDetailEventFields({
			mobileDiagnostics: { threadDetailTimings: {
				phase: "warm-projection-cache",
				totalMs: 8
			} },
			turns: [{
				status: "completed",
				items: [{
					type: "userMessage",
					text: "prompt"
				}]
			}]
		}) : {};
		const shape = functionReady(api, "threadDetailShape") ? api.threadDetailShape({
			mobileOmittedTurnCount: 2,
			turns: [{
				status: "completed",
				items: [{
					type: "userMessage",
					text: "prompt"
				}]
			}, {
				status: "running",
				items: [{
					type: "agentMessage",
					text: "reply"
				}]
			}]
		}) : {};
		const slow = functionReady(api, "planThreadDetailSlowPathDiagnostic") ? api.planThreadDetailSlowPathDiagnostic({
			elapsedMs: 1600,
			apiElapsedMs: 1550,
			renderElapsedMs: 20,
			performancePhase: "cold-turns-list-initial"
		}, {
			action: "thread-detail-load",
			threadHash: "thread_hash",
			durationBucket: "1_3s"
		}) : {};
		return {
			ok: listPhase === "cold-fallback-expired-rebuild" && detailPhase === "warm-projection-dynamic" && clientTimings.elapsedMs === 26 && clientTimings.renderElapsedMs === 7 && clientTimings.detailRenderMode === "patch" && detailFields.performancePhase === "warm-projection-cache" && shape.turns === 2 && shape.visibleItems === 2 && shape.omittedTurns === 2 && shape.completedTurns === 1 && shape.activeTurns === 1 && slow.shouldReport === true && slow.reason === "api-slow",
			listPhase,
			detailPhase,
			elapsedMs: Number(clientTimings.elapsedMs) || 0,
			detailPerformancePhase: String(detailFields.performancePhase || ""),
			visibleItems: Number(shape.visibleItems) || 0,
			slowReason: String(slow.reason || "")
		};
	}
	if (id === "thread-detail-state") {
		const loadedThread = {
			id: "thread-a",
			title: "Thread A",
			status: "completed",
			mobileDetailLoaded: true,
			mobileLoading: false,
			turns: [{
				id: "turn-a",
				status: "completed",
				items: [{
					type: "userMessage",
					text: "hello"
				}]
			}],
			mobileProjection: { source: "sample" }
		};
		const summary = functionReady(api, "threadListSummaryFromDetailThread") ? api.threadListSummaryFromDetailThread(loadedThread) : {};
		const loaded = functionReady(api, "threadHasLoadedDetailState") ? api.threadHasLoadedDetailState(loadedThread) : false;
		const reusable = functionReady(api, "threadHasReusableLoadedDetailState") ? api.threadHasReusableLoadedDetailState(loadedThread) : false;
		const visualBaseline = functionReady(api, "threadHasVisualBaselineLoadedDetailState") ? api.threadHasVisualBaselineLoadedDetailState(Object.assign({}, loadedThread, { status: "active" })) : false;
		const cacheReuse = functionReady(api, "planThreadOpenCacheReuse") ? api.planThreadOpenCacheReuse({
			currentThread: loadedThread,
			threadId: "thread-a"
		}) : {};
		return {
			ok: summary && summary.id === "thread-a" && !Object.prototype.hasOwnProperty.call(summary, "turns") && !Object.prototype.hasOwnProperty.call(summary, "mobileProjection") && loaded === true && reusable === true && visualBaseline === true && cacheReuse && typeof cacheReuse === "object",
			summaryId: String(summary && summary.id || ""),
			summaryHasTurns: Object.prototype.hasOwnProperty.call(summary || {}, "turns"),
			loaded,
			reusable,
			visualBaseline,
			cacheReuseReason: String(cacheReuse.reason || "")
		};
	}
	if (id === "thread-detail-render-plan") {
		const backfill = functionReady(api, "planThreadDetailHistoryAutoBackfill") ? api.planThreadDetailHistoryAutoBackfill({
			hasOlder: true,
			thread: {
				mobileOlderTurnsCursor: "cursor-a",
				turns: [{ items: [{
					type: "assistantMessage",
					text: "[Cross-thread task card sent by source thread]"
				}] }]
			}
		}) : {};
		const request = functionReady(api, "planThreadDetailRefreshRequest") ? api.planThreadDetailRefreshRequest({
			threadId: "thread-a",
			threadLoadSeq: 7,
			options: { source: "auto-refresh" }
		}) : {};
		const postUpdate = functionReady(api, "planSingleThreadShellPostUpdateEffects") ? api.planSingleThreadShellPostUpdateEffects({
			bindCurrentThreadActions: true,
			updateTickTimer: true,
			publishPluginNavigationState: true,
			reason: "sample"
		}) : {};
		const normalizedSignature = functionReady(api, "normalizeSignature") ? api.normalizeSignature(42) : "";
		const effects = Array.isArray(postUpdate.effects) ? postUpdate.effects : [];
		return {
			ok: normalizedSignature === "42" && backfill.shouldLoad === true && backfill.reason === "sparse-conversation-context" && request.shouldRefresh === true && request.threadId === "thread-a" && request.requestedMode === "recent" && request.query && request.query.mode === "recent" && effects.map((entry) => String(entry && entry.type || "")).join(",") === "bind-current-thread-actions,update-tick-timer,publish-plugin-navigation-state",
			normalizedSignature,
			backfillReason: String(backfill.reason || ""),
			refreshReason: String(request.reason || ""),
			effectTypes: effects.map((entry) => String(entry && entry.type || ""))
		};
	}
	if (id === "thread-detail-dom-patch") {
		const patch = functionReady(api, "threadDetailPatchResult") ? api.threadDetailPatchResult(true, "patched", { patched: 2 }) : {};
		const mismatch = functionReady(api, "visibleTurnOrderMismatch") ? api.visibleTurnOrderMismatch({
			expectedTurnIds: ["a", "b"],
			renderedDomTurnIds: ["a", "c"]
		}) : false;
		const match = functionReady(api, "visibleTurnOrderMismatch") ? api.visibleTurnOrderMismatch({
			expectedTurnIds: ["a", "b"],
			renderedDomTurnIds: ["a", "b"]
		}) : true;
		const operation = functionReady(api, "normalizeOperation") ? api.normalizeOperation({
			type: "insert",
			key: "turn-a",
			nextEntry: {
				key: "turn-a",
				html: "<article></article>"
			}
		}) : null;
		const htmlUpdate = functionReady(api, "planConversationHtmlUpdate") ? api.planConversationHtmlUpdate({
			html: "<article data-turn-id=\"a\"></article>",
			previousHtml: "<article data-turn-id=\"a\"></article>",
			conversationSignature: "sig-a",
			previousConversationSignature: "sig-a"
		}) : {};
		return {
			ok: patch.ok === true && patch.reason === "patched" && patch.patched === 2 && mismatch === true && match === false && operation && operation.key === "turn-a" && htmlUpdate.action === "hydrate-existing" && htmlUpdate.reason === "signature-stable",
			patchReason: String(patch.reason || ""),
			patched: Number(patch.patched) || 0,
			mismatch,
			match,
			operationKey: String(operation && operation.key || ""),
			htmlAction: String(htmlUpdate.action || "")
		};
	}
	if (id === "draft-store") {
		const memory = /* @__PURE__ */ new Map();
		const store = functionReady(api, "createDraftStore") ? api.createDraftStore({
			storage: {
				getItem(key) {
					return memory.has(key) ? memory.get(key) : null;
				},
				setItem(key, value) {
					memory.set(key, String(value));
				},
				removeItem(key) {
					memory.delete(key);
				}
			},
			maxDrafts: 2
		}) : null;
		if (store && typeof store.writeMap === "function") {
			store.writeMap({
				old: {
					text: "old",
					updatedAt: 1
				},
				newest: {
					text: "newest",
					updatedAt: 3
				},
				middle: {
					text: "middle",
					updatedAt: 2
				}
			});
			store.setTargetKey("new:/repo");
		}
		const draftKeys = store && typeof store.readMap === "function" ? Object.keys(store.readMap()) : [];
		const threadKey = store && typeof store.keyForThread === "function" ? store.keyForThread(" abc ") : "";
		const newThreadKey = store && typeof store.keyForNewThread === "function" ? store.keyForNewThread("C:/Users/xuefu/project/") : "";
		const targetKey = store && typeof store.getTargetKey === "function" ? store.getTargetKey() : "";
		const parsed = functionReady(api, "parseDraftMap") ? api.parseDraftMap("{\"a\":{\"text\":\"draft\"}}") : {};
		const hasContent = functionReady(api, "draftHasContent") ? api.draftHasContent({ permissionMode: "full" }) : false;
		const meta = functionReady(api, "normalizeAttachmentMeta") ? api.normalizeAttachmentMeta({
			id: 7,
			file: {
				name: "screenshot.png",
				type: "image/png",
				size: 42,
				lastModified: 123
			}
		}) : null;
		const attachmentKey = functionReady(api, "attachmentStorageKey") ? api.attachmentStorageKey("new:/a b", "x/y") : "";
		const normalizedPath = functionReady(api, "defaultNormalizeFsPath") ? api.defaultNormalizeFsPath("C:/Users/xuefu/project/") : "";
		return {
			ok: threadKey === "thread:abc" && newThreadKey === "new:c:\\users\\xuefu\\project" && targetKey === "new:/repo" && draftKeys.join(",") === "newest,middle" && parsed && parsed.a && parsed.a.text === "draft" && hasContent === true && meta && meta.id === "7" && meta.size === 42 && attachmentKey === "new%3A%2Fa%20b|x%2Fy" && normalizedPath === "c:\\users\\xuefu\\project",
			threadKey,
			newThreadKey,
			targetKey,
			draftKeys,
			hasContent,
			attachmentKey,
			normalizedPath
		};
	}
	if (id === "image-compressor") {
		const compressible = functionReady(api, "isCompressibleImageFile") ? api.isCompressibleImageFile({
			type: "image/png",
			size: 300 * 1024
		}) : false;
		const smallImage = functionReady(api, "isCompressibleImageFile") ? api.isCompressibleImageFile({
			type: "image/png",
			size: 12 * 1024
		}) : true;
		const dims = functionReady(api, "targetDimensions") ? api.targetDimensions(3e3, 1500, 1200) : {};
		const name = functionReady(api, "compressedImageName") ? api.compressedImageName("folder/screen.png", "image/webp") : "";
		const useful = functionReady(api, "shouldUseCompressedBlob") ? api.shouldUseCompressedBlob({ size: 1e3 }, { size: 800 }) : false;
		const marginal = functionReady(api, "shouldUseCompressedBlob") ? api.shouldUseCompressedBlob({ size: 1e3 }, { size: 930 }) : true;
		return {
			ok: compressible === true && smallImage === false && dims.width === 1200 && dims.height === 600 && dims.scaled === true && name === "folder_screen.webp" && useful === true && marginal === false,
			compressible,
			smallImage,
			width: Number(dims.width) || 0,
			height: Number(dims.height) || 0,
			scaled: Boolean(dims.scaled),
			name,
			useful,
			marginal
		};
	}
	if (id === "plugin-voice-input") {
		const capability = functionReady(api, "capabilityStateMessage") ? api.capabilityStateMessage({
			writable: true,
			threadId: "thread-a",
			draftId: "draft-a",
			actions: [
				"append",
				"replace",
				"submit"
			],
			maxChars: 100
		}) : {};
		const start = functionReady(api, "startRequestMessage") ? api.startRequestMessage({
			requestId: "req-1",
			voiceSessionId: "voice-1",
			capability
		}) : {};
		const insert = functionReady(api, "insertResultMessage") ? api.insertResultMessage({
			ok: false,
			action: "append_text",
			code: "composer_not_writable",
			composerId: "thread-composer"
		}) : {};
		const error = functionReady(api, "errorMessage") ? api.errorMessage({
			code: "voice_error",
			error: "Voice failed"
		}) : {};
		const action = functionReady(api, "normalizeAction") ? api.normalizeAction("append") : "";
		const actionFromType = functionReady(api, "actionFromMessageType") ? api.actionFromMessageType("voice_input.replace_draft") : "";
		const text = functionReady(api, "textFromMessage") ? api.textFromMessage({ text: "  hello\xA0world  " }, 20) : "";
		const voiceMessage = functionReady(api, "isVoiceInputMessage") ? api.isVoiceInputMessage({ type: "voice_input.append_text" }) : false;
		return {
			ok: capability.type === "voice_input.capability_state" && capability.writable === true && Array.isArray(capability.actions) && capability.actions.join(",") === "append_text,replace_draft" && start.type === "voice_input.start_request" && start.requestId === "req-1" && insert.ok === false && insert.code === "composer_not_writable" && error.code === "voice_error" && action === "append_text" && actionFromType === "replace_draft" && text === "hello world" && voiceMessage === true,
			capabilityType: String(capability.type || ""),
			actions: Array.isArray(capability.actions) ? capability.actions : [],
			startType: String(start.type || ""),
			insertCode: String(insert.code || ""),
			errorCode: String(error.code || ""),
			action,
			actionFromType,
			text,
			voiceMessage
		};
	}
	if (id === "api-client") {
		function FakeFormData() {}
		const formData = new FakeFormData();
		const isFormData = functionReady(api, "isFormDataBody") ? api.isFormDataBody(formData, FakeFormData) : false;
		const jsonBody = functionReady(api, "isFormDataBody") ? api.isFormDataBody({ ok: true }, FakeFormData) : true;
		const client = functionReady(api, "createApiClient") ? api.createApiClient({
			fetch: () => Promise.resolve({
				ok: true,
				status: 204
			}),
			AbortControllerCtor: AbortController,
			FormDataCtor: FakeFormData,
			getKey: () => ""
		}) : null;
		return {
			ok: isFormData === true && jsonBody === false && client && typeof client.request === "function",
			isFormData,
			jsonBody,
			requestReady: Boolean(client && typeof client.request === "function")
		};
	}
	if (id === "markdown-renderer") {
		const escaped = functionReady(api, "escapeHtml") ? api.escapeHtml("<tag>&\"") : "";
		const safeUrl = functionReady(api, "safeMarkdownUrl") ? api.safeMarkdownUrl("https://example.com") : "";
		const unsafeUrl = functionReady(api, "safeMarkdownUrl") ? api.safeMarkdownUrl("javascript:alert(1)") : "unsafe";
		const inline = functionReady(api, "renderInlineMarkdown") ? api.renderInlineMarkdown("**bold** <https://example.com>, `code`") : "";
		const block = functionReady(api, "renderMarkdown") ? api.renderMarkdown("# Title\n\n- item\n- **bold**") : "";
		const tableSeparator = functionReady(api, "isMarkdownTableSeparator") ? api.isMarkdownTableSeparator("|---|:---:|") : false;
		const row = functionReady(api, "splitMarkdownTableRow") ? api.splitMarkdownTableRow("| A | B |") : [];
		const list = functionReady(api, "renderMarkdownList") ? api.renderMarkdownList(["1. one", "2. two"], true) : "";
		const table = functionReady(api, "renderMarkdownTable") ? api.renderMarkdownTable([
			"A | B",
			"---|---",
			"1 | 2"
		]) : "";
		return {
			ok: escaped === "&lt;tag&gt;&amp;&quot;" && safeUrl === "https://example.com" && unsafeUrl === "" && inline.includes("<strong>bold</strong>") && inline.includes("<code>code</code>") && block.includes("<h2>Title</h2>") && tableSeparator === true && Array.isArray(row) && row.join(",") === "A,B" && list.includes("<ol>") && table.includes("<table>"),
			escaped,
			safeUrl,
			unsafeUrl,
			row,
			inlineHasStrong: inline.includes("<strong>bold</strong>"),
			blockHasHeading: block.includes("<h2>Title</h2>"),
			listHasOl: list.includes("<ol>"),
			tableHasTable: table.includes("<table>")
		};
	}
	if (id === "plugin-embed") {
		const detected = functionReady(api, "detect") ? api.detect("http://127.0.0.1/?embed=hermes&pluginId=codex-mobile&pluginRoute=thread&pluginThreadId=t1&pluginTheme=dark&pluginFontSize=large") : {};
		const navigation = functionReady(api, "navigationMessage") ? api.navigationMessage({ currentThreadId: "t1" }, {}) : {};
		const openPlan = functionReady(api, "routeHintOpenPlan") ? api.routeHintOpenPlan({
			pluginId: "codex-mobile",
			threadId: "t1",
			itemId: "i1"
		}) : {};
		const selectors = functionReady(api, "routeHintTargetSelectors") ? api.routeHintTargetSelectors({ itemId: "i1" }) : [];
		const scrubbed = functionReady(api, "scrubRouteHintPath") ? api.scrubRouteHintPath("http://127.0.0.1/thread?pluginId=codex-mobile&pluginThreadId=t1", {
			workspaceId: "ws1",
			appearance: { theme: "dark" }
		}) : "";
		const external = functionReady(api, "externalLinkMessage") ? api.externalLinkMessage({ href: "https://example.com/a" }) : {};
		const refresh = functionReady(api, "refreshRequiredMessage") ? api.refreshRequiredMessage({
			reason: "version_changed",
			route: {
				kind: "thread",
				threadId: "t1"
			},
			appearance: { theme: "light" }
		}) : {};
		return {
			ok: detected.embedded === true && detected.routeHint && detected.routeHint.threadId === "t1" && detected.appearance && detected.appearance.theme === "dark" && navigation.type === "codex-mobile.plugin.navigation" && navigation.canGoBack === true && openPlan.action === "openThread" && Array.isArray(selectors) && selectors[0] === "[data-approval-card=\"i1\"]" && scrubbed === "/thread?embed=hermes&workspaceId=ws1&pluginTheme=dark" && external.type === "codex-mobile.plugin.external_link" && refresh.type === "codex-mobile.plugin.refresh_required",
			embedded: Boolean(detected.embedded),
			routeThreadId: String(detected.routeHint && detected.routeHint.threadId || ""),
			navigationType: String(navigation.type || ""),
			canGoBack: Boolean(navigation.canGoBack),
			openAction: String(openPlan.action || ""),
			firstSelector: String(selectors[0] || ""),
			scrubbed,
			externalType: String(external.type || ""),
			refreshType: String(refresh.type || "")
		};
	}
	if (id === "frontend-runtime-health") {
		const token = functionReady(api, "compactToken") ? api.compactToken(" Home AI / Thread Detail ", "fallback", 20) : "";
		const missingEffects = functionReady(api, "submittedMessageDomProbeEffects") ? api.submittedMessageDomProbeEffects({
			elapsedMs: 300,
			currentThreadMatch: true,
			hasThreadSubmission: true,
			domHasSubmission: false,
			threadHash: "abc"
		}) : {};
		const stallEffects = functionReady(api, "threadListInteractionStallEffects") ? api.threadListInteractionStallEffects({
			threadListVisible: true,
			threadListMonitorable: true,
			maxRafDelayMs: 640,
			minDelayMs: 500
		}) : {};
		const monitor = functionReady(api, "createMonitor") ? api.createMonitor({ now: () => 1e3 }) : null;
		const monitorResult = monitor && typeof monitor.recordRender === "function" ? monitor.recordRender({
			fullRender: false,
			fallbackApplied: false,
			previousCount: 2,
			domCount: 2,
			visibleCount: 2,
			duplicateCount: 0
		}) : {};
		const dropEvent = functionReady(api, "domDropEvent") ? api.domDropEvent({
			previousCount: 3,
			domCount: 1,
			visibleCount: 3
		}) : {};
		const success = functionReady(api, "runtimeSuccess") ? api.runtimeSuccess({
			diagnosticType: "render_dom_drop",
			errorCode: "render_dom_drop"
		}) : {};
		return {
			ok: token === "Home_AI_Thread_Detai" && missingEffects.reason === "submitted-message-dom-missing" && Array.isArray(missingEffects.effects) && missingEffects.effects[0] && missingEffects.effects[0].type === "diagnostic-failure" && stallEffects.reason === "thread-list-interaction-stall" && monitorResult.renderCount === 1 && Array.isArray(monitorResult.effects) && monitorResult.effects.length === 2 && dropEvent.diagnostic_type === "render_dom_drop" && success.error_code === "render_dom_drop",
			token,
			missingReason: String(missingEffects.reason || ""),
			stallReason: String(stallEffects.reason || ""),
			monitorRenderCount: Number(monitorResult.renderCount) || 0,
			dropDiagnosticType: String(dropEvent.diagnostic_type || ""),
			successErrorCode: String(success.error_code || "")
		};
	}
	if (id === "home-ai-diagnostic-reporting") {
		const token = functionReady(api, "boundedToken") ? api.boundedToken(" Home AI / Codex Mobile ", "fallback", 16) : "";
		const duration = functionReady(api, "durationBucket") ? api.durationBucket(4200) : "";
		const hash = functionReady(api, "hashIdentifier") ? api.hashIdentifier("thread-title", "t") : "";
		const sanitized = functionReady(api, "sanitizeInput") ? api.sanitizeInput({
			diagnostic_type: "render_lag",
			error_code: "lag",
			counts: {
				ok_count: 3,
				raw_body: 4
			},
			context: {
				thread_hash: "abc",
				title: "unsafe"
			}
		}) : {};
		const reporter = functionReady(api, "createDiagnosticReporter") ? api.createDiagnosticReporter({
			threshold: 2,
			throttleMs: 0,
			now: () => 1e3
		}) : null;
		const first = reporter && typeof reporter.recordFailure === "function" ? reporter.recordFailure({
			diagnostic_type: "render_lag",
			error_code: "lag"
		}) : {};
		const second = reporter && typeof reporter.recordFailure === "function" ? reporter.recordFailure({
			diagnostic_type: "render_lag",
			error_code: "lag"
		}) : {};
		const post = functionReady(api, "postReportToHomeAi") ? api.postReportToHomeAi({
			embedded: false,
			report: second.report
		}) : {};
		const textHash = functionReady(api, "stableTextHash") ? api.stableTextHash("diagnostic") : "";
		return {
			ok: token === "Home_AI_Codex_Mo" && duration === "3_10s" && /^t_/.test(hash) && sanitized.category === "codex_runtime_failure" && sanitized.counts && sanitized.counts.ok_count === 3 && !Object.prototype.hasOwnProperty.call(sanitized.counts || {}, "raw_body") && first.eligible === false && second.eligible === true && post.reason === "not_embedded" && textHash.length > 0,
			token,
			duration,
			hashPrefix: String(hash || "").slice(0, 2),
			sanitizedCategory: String(sanitized.category || ""),
			secondEligible: Boolean(second.eligible),
			postReason: String(post.reason || ""),
			textHash
		};
	}
	if (id === "thread-diagnostic-events") {
		const snapshot = functionReady(api, "conversationProjectionDiagnosticSnapshot") ? api.conversationProjectionDiagnosticSnapshot({
			renderedConversationSignature: "old",
			currentSignature: "new",
			domShape: {
				renderKeyCount: 1,
				duplicateRenderKeyCount: 1
			},
			thread: { mobileReadMode: "thread-read" }
		}, { visibleShape: () => ({
			visibleTurnCount: 2,
			visibleItemCount: 3
		}) }) : {};
		const order = functionReady(api, "turnOrderDiagnosticSnapshot") ? api.turnOrderDiagnosticSnapshot({
			expectedTurnIds: ["a", "b"],
			domTurnIds: ["a"],
			threadHash: "thread"
		}) : {};
		const effects = functionReady(api, "conversationProjectionConsistencyEffects") ? api.conversationProjectionConsistencyEffects({
			snapshot,
			orderSnapshot: order
		}) : {};
		const renderEvent = functionReady(api, "renderSignatureMismatchDiagnosticEvent") ? api.renderSignatureMismatchDiagnosticEvent(snapshot) : {};
		const responseEffects = functionReady(api, "threadDetailResponseDiagnosticEffects") ? api.threadDetailResponseDiagnosticEffects({ contractPlan: {
			shouldReport: true,
			reason: "contract",
			turns: 2,
			items: 3,
			visibleItems: 3,
			readMode: "thread-read"
		} }) : {};
		const normalized = functionReady(api, "projectionDiagnosticSnapshot") ? api.projectionDiagnosticSnapshot(snapshot) : {};
		const count = functionReady(api, "boundedCount") ? api.boundedCount(100001) : 0;
		const token = functionReady(api, "compactToken") ? api.compactToken(" Detail / Render ", "fallback", 20) : "";
		return {
			ok: snapshot.renderedSignature === "old" && normalized.counts && normalized.counts.visible_count === 3 && order.counts && order.counts.latest_mismatch_count === 1 && Array.isArray(effects.effects) && effects.effects.length === 3 && renderEvent.diagnostic_type === "render_signature_mismatch" && Array.isArray(responseEffects.effects) && responseEffects.effects[0] && responseEffects.effects[0].type === "diagnostic-failure" && count === 1e5 && token === "Detail_Render",
			renderedSignature: String(snapshot.renderedSignature || ""),
			visibleCount: Number(normalized.counts && normalized.counts.visible_count) || 0,
			latestMismatch: Number(order.counts && order.counts.latest_mismatch_count) || 0,
			effectCount: Array.isArray(effects.effects) ? effects.effects.length : 0,
			renderDiagnosticType: String(renderEvent.diagnostic_type || ""),
			responseEffectCount: Array.isArray(responseEffects.effects) ? responseEffects.effects.length : 0,
			count,
			token
		};
	}
	if (id === "thread-tile-layout") {
		const layout = functionReady(api, "layoutForViewport") ? api.layoutForViewport({
			enabled: true,
			viewportWidth: 1500,
			viewportHeight: 900,
			sidebarWidth: 0,
			coarsePointer: true,
			orientation: "landscape",
			menuOverlay: true
		}) : null;
		const ids = functionReady(api, "selectThreadTileIds") ? api.selectThreadTileIds({
			currentThreadId: "thread-2",
			pinnedThreadIds: ["thread-3", "thread-2"],
			threadIds: [
				"thread-1",
				"thread-3",
				"thread-4"
			],
			maxPanes: 3
		}) : [];
		const pinnedIds = functionReady(api, "selectPinnedThreadTileIds") ? api.selectPinnedThreadTileIds({
			currentThreadId: "thread-current",
			pinnedThreadIds: [
				"thread-1",
				"thread-2",
				"thread-3"
			],
			threadIds: ["thread-current", "thread-4"],
			maxPanes: 3
		}) : [];
		const pairs = functionReady(api, "normalizeSplitPairs") ? api.normalizeSplitPairs([{
			anchorId: "b",
			childId: "e"
		}, {
			anchorId: "b",
			childId: "c"
		}], [
			"a",
			"b",
			"c",
			"d",
			"e"
		]) : [];
		const groups = functionReady(api, "threadTileColumnGroups") ? api.threadTileColumnGroups({
			ids: [
				"a",
				"b",
				"c",
				"d",
				"e"
			],
			columns: 4,
			splitPairs: [{
				anchorId: "b",
				childId: "e"
			}]
		}) : [];
		return {
			ok: !!layout && layout.enabled === true && layout.columns === 4 && ids.join(",") === "thread-2,thread-3,thread-1" && pinnedIds.join(",") === "thread-1,thread-2,thread-current" && pairs.length === 1 && pairs[0].anchorId === "b" && pairs[0].childId === "e" && JSON.stringify(groups) === JSON.stringify([
				["a"],
				["b", "e"],
				["c"],
				["d"]
			]),
			layout,
			ids,
			pinnedIds,
			pairs,
			groups
		};
	}
	if (id === "thread-tile-actions") {
		const paneA = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-pane" ? "thread-a" : "";
			},
			closest() {
				return null;
			}
		};
		const paneB = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-pane" ? "thread-b" : "";
			},
			closest() {
				return null;
			}
		};
		const title = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-title" ? "thread-a" : "";
			},
			closest(selector) {
				return selector === "[data-thread-tile-pane]" ? paneA : null;
			}
		};
		const handle = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-drag-handle" ? "thread-a" : "";
			},
			closest(selector) {
				return selector === "[data-thread-tile-pane]" ? paneA : null;
			}
		};
		const bottom = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-bottom" ? "thread-a" : "";
			},
			closest() {
				return null;
			}
		};
		const root = { contains(node) {
			return node === paneA || node === paneB || node === title || node === handle || node === bottom;
		} };
		const titleTarget = { closest(selector) {
			return selector === "[data-thread-tile-title]" ? title : selector === "[data-thread-tile-pane]" ? paneA : null;
		} };
		const bottomTarget = { closest(selector) {
			return selector === "[data-thread-tile-bottom]" ? bottom : null;
		} };
		const handleTarget = { closest(selector) {
			return selector === "[data-thread-tile-drag-handle]" ? handle : null;
		} };
		const paneBTarget = { closest(selector) {
			return selector === "[data-thread-tile-pane]" ? paneB : null;
		} };
		const pointer = functionReady(api, "resolveThreadTilePointerAction") ? api.resolveThreadTilePointerAction({
			root,
			target: titleTarget
		}) : {};
		const click = functionReady(api, "resolveThreadTileClickAction") ? api.resolveThreadTileClickAction({
			root,
			target: bottomTarget
		}) : {};
		const dragStart = functionReady(api, "resolveThreadTileDragStartAction") ? api.resolveThreadTileDragStartAction({
			root,
			target: handleTarget
		}) : {};
		const drop = functionReady(api, "resolveThreadTileDropAction") ? api.resolveThreadTileDropAction({
			root,
			target: paneBTarget,
			draggingId: "thread-a"
		}) : {};
		return {
			ok: pointer.action === "select-pane" && pointer.paneId === "thread-a" && click.action === "scroll-pane-bottom" && click.preventDefault === true && dragStart.action === "drag-start" && dragStart.paneId === "thread-a" && drop.action === "drop-pane" && drop.draggingId === "thread-a" && drop.targetId === "thread-b",
			pointerAction: String(pointer.action || ""),
			clickAction: String(click.action || ""),
			dragStartAction: String(dragStart.action || ""),
			dropAction: String(drop.action || "")
		};
	}
	if (id === "thread-tile-state") {
		const candidate = functionReady(api, "candidatePaneIdsPlan") ? api.candidatePaneIdsPlan({
			defaultIds: ["thread-a", "thread-b"],
			visibleIds: ["thread-a", "thread-b"],
			pinnedIds: ["thread-b"],
			currentThreadId: "thread-a",
			maxPanes: 2
		}) : {};
		const paneCount = functionReady(api, "normalizePaneCount") ? api.normalizePaneCount("3", { maxPanes: 12 }) : 0;
		const refreshDelay = functionReady(api, "refreshDelayMs") ? api.refreshDelayMs({
			visible: true,
			active: true
		}) : 0;
		const loadSuccess = functionReady(api, "detailLoadSuccessEffectsPlan") ? api.detailLoadSuccessEffectsPlan({
			threadId: "thread-a",
			hasThread: true,
			nowMs: 1234
		}) : {};
		const selected = functionReady(api, "effectiveSelectedThreadId") ? api.effectiveSelectedThreadId({
			ids: ["thread-a", "thread-b"],
			selectedThreadId: "thread-a",
			currentThreadId: "thread-b"
		}) : "";
		return {
			ok: candidate.action === "candidate-pane-ids" && candidate.ids && candidate.ids.join(",") === "thread-b,thread-a" && paneCount === 3 && refreshDelay === 500 && loadSuccess.reason === "thread-loaded" && loadSuccess.loadedAtMs === 1234 && selected === "thread-a",
			candidateIds: Array.isArray(candidate.ids) ? candidate.ids : [],
			paneCount,
			refreshDelay,
			loadSuccessReason: String(loadSuccess.reason || ""),
			selected
		};
	}
	if (id === "thread-tile-runtime") {
		const statePolicy = globalThis.CodexThreadTileState || {};
		const layoutPolicy = globalThis.CodexThreadTileLayout || {};
		const actionsApi = globalThis.CodexThreadTileActions || {};
		const runtime = functionReady(api, "createThreadTileRuntime") ? api.createThreadTileRuntime({
			state: {
				threadTileMode: true,
				threadTilePaneCount: "3",
				threadTilePinnedThreadIds: [
					"thread-b",
					"thread-a",
					"thread-b"
				],
				threadTileSplitPairs: [{
					anchorId: "thread-a",
					childId: "thread-c"
				}],
				threads: [
					{
						id: "thread-a",
						status: "running"
					},
					{
						id: "thread-b",
						status: "idle"
					},
					{
						id: "thread-c",
						status: "idle"
					}
				],
				currentThreadId: "thread-b",
				threadDisplaySettingsLoaded: true,
				threadTileViewportBaseline: null,
				threadTileComposerHeightBaselinePx: 0,
				composerHeightPx: 0
			},
			document: {
				documentElement: {
					clientWidth: 1400,
					clientHeight: 900
				},
				activeElement: null
			},
			window: {
				innerWidth: 1400,
				innerHeight: 900,
				visualViewport: {
					width: 1320,
					height: 820
				},
				matchMedia: () => ({ matches: false })
			},
			threadTileStatePolicy: statePolicy,
			threadTileLayoutPolicy: layoutPolicy,
			threadTileActionsApi: actionsApi,
			THREAD_TILE_USER_MAX_PANES: 6,
			THREAD_TILE_REFRESH_INTERVAL_MS: 5e3,
			THREAD_TILE_REFRESH_MIN_INTERVAL_MS: 500,
			STORAGE_THREAD_DISPLAY_MODE: "codex.threadDisplayMode",
			STORAGE_LEGACY_THREAD_TILE_MODE: "codex.legacyThreadTileMode",
			$: () => null,
			isKeyboardEditableElement: () => false,
			splitPaneSidebarVisible: () => false,
			isMenuOverlayMode: () => false,
			visibleThreads: (threads) => Array.isArray(threads) ? threads : [],
			isRunningStatus: (status) => status === "running" || status === "in_progress"
		}) : {};
		const viewport = runtime && typeof runtime.viewportPixelSize === "function" ? runtime.viewportPixelSize({ preferLayoutViewport: true }) : {};
		const paneCount = runtime && typeof runtime.normalizeThreadTilePaneCount === "function" ? runtime.normalizeThreadTilePaneCount("3", 1) : 0;
		const pinnedIds = runtime && typeof runtime.normalizeThreadTilePinnedIds === "function" ? runtime.normalizeThreadTilePinnedIds([
			"thread-b",
			"thread-a",
			"thread-b"
		]) : [];
		const idsEqual = runtime && typeof runtime.threadTileIdsEqual === "function" ? runtime.threadTileIdsEqual(["thread-a", "thread-b"], ["thread-a", "thread-b"]) : false;
		const payload = runtime && typeof runtime.threadDisplaySettingsPayload === "function" ? runtime.threadDisplaySettingsPayload() : {};
		const layout = runtime && typeof runtime.threadTileLayout === "function" ? runtime.threadTileLayout({ enabled: true }) : {};
		const status = runtime && typeof runtime.threadTileLayoutStatusText === "function" ? runtime.threadTileLayoutStatusText(layout) : "";
		return {
			ok: runtime && typeof runtime === "object" && viewport.width === 1400 && viewport.height === 900 && paneCount === 3 && pinnedIds.join(",") === "thread-b,thread-a" && idsEqual === true && payload.displayMode === "tile" && payload.paneCount === 3 && layout.enabled === true && status === "当前视口：平铺 3/3 窗",
			factoryType: typeof api.createThreadTileRuntime,
			viewportWidth: Number(viewport.width) || 0,
			viewportHeight: Number(viewport.height) || 0,
			paneCount,
			pinnedIds,
			idsEqual,
			displayMode: String(payload.displayMode || ""),
			layoutColumns: Number(layout.columns) || 0,
			status
		};
	}
	if (id === "app-update-runtime") {
		const runtime = functionReady(api, "createAppUpdateRuntime") ? api.createAppUpdateRuntime({
			CLIENT_BUILD_ID: "0.1.11|codex-mobile-shell-v625-a5a3d596240d",
			state: {
				appVersion: "0.1.11",
				publicReleaseEnabled: true
			},
			PAGE_SHELL_ASSETS: ["/app.js", "/sw.js"],
			escapeHtml: (value) => String(value == null ? "" : value),
			buildRefreshPolicy: { shouldPromptForServerBuildChange: () => true }
		}) : null;
		const client = runtime && typeof runtime.clientBuildVersionText === "function" ? runtime.clientBuildVersionText() : "";
		const version = runtime && typeof runtime.appVersionText === "function" ? runtime.appVersionText({ version: "0.1.11" }) : "";
		const updateLine = runtime && typeof runtime.updateStatusLine === "function" ? runtime.updateStatusLine({
			updateAvailable: true,
			canFastForward: true,
			remoteShort: "abc123"
		}) : "";
		const publicLine = runtime && typeof runtime.publicReleaseStatusLine === "function" ? runtime.publicReleaseStatusLine({
			updateAvailable: true,
			publicShort: "def456"
		}) : "";
		const serverBuild = runtime && typeof runtime.serverBuildIdFromConfig === "function" ? runtime.serverBuildIdFromConfig({
			clientBuildId: "client-a",
			shellCacheName: "cache-a"
		}) : "";
		return {
			ok: runtime && typeof runtime.refreshPageForNewBuild === "function" && client === "客户端 v625" && version === "v0.1.11 · 客户端 v625" && updateLine === "Update available: abc123" && publicLine === "Public latest: def456" && serverBuild === "client-a",
			client,
			version,
			updateLine,
			publicLine,
			serverBuild,
			refreshReady: Boolean(runtime && typeof runtime.refreshPageForNewBuild === "function")
		};
	}
	if (id === "modal-runtime") {
		const runtime = functionReady(api, "createModalRuntime") ? api.createModalRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.requestAppNativeDialog === "function" && typeof runtime.requestAppAlert === "function" && typeof runtime.requestAppConfirmation === "function" && typeof runtime.requestAppTextInput === "function" && typeof runtime.requestCodexProfileSwitchConfirmation === "function" && typeof globalThis.handleAppNativeDialogKeydown === "function" && typeof globalThis.closeAppNativeDialog === "function" && typeof globalThis.performCodexProfileSwitch === "function",
			factoryType: typeof api.createModalRuntime,
			nativeDialogType: typeof (runtime && runtime.requestAppNativeDialog),
			alertType: typeof (runtime && runtime.requestAppAlert),
			confirmationType: typeof (runtime && runtime.requestAppConfirmation),
			textInputType: typeof (runtime && runtime.requestAppTextInput),
			profileSwitchType: typeof (runtime && runtime.requestCodexProfileSwitchConfirmation),
			keydownType: typeof globalThis.handleAppNativeDialogKeydown,
			closeType: typeof globalThis.closeAppNativeDialog,
			switchType: typeof globalThis.performCodexProfileSwitch
		};
	}
	if (id === "navigation-runtime") {
		const runtime = functionReady(api, "createNavigationRuntime") ? api.createNavigationRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.updateConnectionState === "function" && typeof runtime.restoreConnectionState === "function" && typeof runtime.markActivity === "function" && typeof runtime.composerTargetPlan === "function" && typeof runtime.visibleTurnsForConversation === "function" && typeof runtime.conversationRenderSignature === "function" && typeof runtime.updateTurnTimer === "function" && typeof globalThis.updateConnectionState === "function" && typeof globalThis.composerTargetPlan === "function" && typeof globalThis.visibleTurnsForConversation === "function",
			factoryType: typeof api.createNavigationRuntime,
			updateType: typeof (runtime && runtime.updateConnectionState),
			restoreType: typeof (runtime && runtime.restoreConnectionState),
			activityType: typeof (runtime && runtime.markActivity),
			composerPlanType: typeof (runtime && runtime.composerTargetPlan),
			visibleTurnsType: typeof (runtime && runtime.visibleTurnsForConversation),
			signatureType: typeof (runtime && runtime.conversationRenderSignature),
			timerType: typeof (runtime && runtime.updateTurnTimer),
			globalUpdateType: typeof globalThis.updateConnectionState,
			globalComposerPlanType: typeof globalThis.composerTargetPlan,
			globalVisibleTurnsType: typeof globalThis.visibleTurnsForConversation
		};
	}
	if (id === "runtime-wiring-runtime") {
		const runtime = functionReady(api, "createRuntimeWiringRuntime") ? api.createRuntimeWiringRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.initialize === "function",
			factoryType: typeof api.createRuntimeWiringRuntime,
			initializeType: typeof (runtime && runtime.initialize),
			globalType: typeof globalThis.CodexRuntimeWiringRuntime
		};
	}
	if (id === "app-shell-runtime") {
		const runtime = functionReady(api, "createAppShellRuntime") ? api.createAppShellRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.wireUi === "function" && typeof runtime.start === "function" && typeof runtime.startCodexMobileAppWithRecovery === "function",
			factoryType: typeof api.createAppShellRuntime,
			wireUiType: typeof (runtime && runtime.wireUi),
			startType: typeof (runtime && runtime.start),
			recoveryType: typeof (runtime && runtime.startCodexMobileAppWithRecovery),
			globalType: typeof globalThis.CodexAppShellRuntime
		};
	}
	if (id === "pane-layout-runtime") {
		const runtime = functionReady(api, "createPaneLayoutRuntime") ? api.createPaneLayoutRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderCurrentThread === "function" && typeof runtime.updateConversationHtml === "function" && typeof runtime.patchCurrentThreadDetailFromRefresh === "function" && typeof runtime.syncThreadTileToggle === "function" && typeof runtime.setThreadTileMode === "function" && typeof runtime.renderHome === "function" && typeof runtime.loadThread === "function" && typeof runtime.loadThreads === "function" && typeof runtime.enterNewThreadDraft === "function" && typeof runtime.handleThreadCardClick === "function" && typeof runtime.showHermesPluginPrimaryPage === "function" && typeof runtime.returnToThreadListFromDetail === "function" && typeof globalThis.loadThread === "function" && typeof globalThis.loadThreads === "function" && typeof globalThis.renderCurrentThread === "function",
			factoryType: typeof api.createPaneLayoutRuntime,
			renderType: typeof (runtime && runtime.renderCurrentThread),
			updateHtmlType: typeof (runtime && runtime.updateConversationHtml),
			patchType: typeof (runtime && runtime.patchCurrentThreadDetailFromRefresh),
			tileToggleType: typeof (runtime && runtime.syncThreadTileToggle),
			tileModeType: typeof (runtime && runtime.setThreadTileMode),
			homeType: typeof (runtime && runtime.renderHome),
			loadThreadType: typeof (runtime && runtime.loadThread),
			loadThreadsType: typeof (runtime && runtime.loadThreads),
			newThreadType: typeof (runtime && runtime.enterNewThreadDraft),
			cardClickType: typeof (runtime && runtime.handleThreadCardClick),
			pluginPrimaryType: typeof (runtime && runtime.showHermesPluginPrimaryPage),
			returnType: typeof (runtime && runtime.returnToThreadListFromDetail),
			globalLoadThreadType: typeof globalThis.loadThread,
			globalLoadThreadsType: typeof globalThis.loadThreads,
			globalRenderType: typeof globalThis.renderCurrentThread
		};
	}
	if (id === "thread-list-runtime") {
		const runtime = functionReady(api, "createThreadListRuntime") ? api.createThreadListRuntime({}) : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderThreads === "function" && typeof runtime.loadThreads === "function",
			factoryType: typeof api.createThreadListRuntime,
			renderThreadsType: typeof (runtime && runtime.renderThreads),
			loadThreadsType: typeof (runtime && runtime.loadThreads)
		};
	}
	if (id === "side-chat-runtime") {
		const state = {
			currentThreadId: "thread-a",
			currentThread: { id: "thread-a" },
			threadSideChats: /* @__PURE__ */ new Map(),
			nowMs: Date.parse("2026-07-02T00:00:00Z")
		};
		const runtime = functionReady(api, "createSideChatRuntime") ? api.createSideChatRuntime({
			state,
			api: async () => ({ sideChat: null }),
			escapeHtml: (value) => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
			statusText: (status) => String(status || ""),
			formatTime: () => "now",
			truncateMiddle: (value) => String(value || "")
		}) : {};
		const normalized = runtime && typeof runtime.normalizeSideChatState === "function" ? runtime.normalizeSideChatState({
			messages: [{
				role: "assistant",
				text: "hi"
			}],
			sidecar: { status: "pending" }
		}, "thread-a") : {};
		if (runtime && typeof runtime.setSideChatState === "function") runtime.setSideChatState("thread-a", normalized);
		const path = runtime && typeof runtime.sideChatApiPath === "function" ? runtime.sideChatApiPath("thread-a", "/draft") : "";
		const status = runtime && typeof runtime.sideChatStatusLabel === "function" ? runtime.sideChatStatusLabel("queued") : "";
		const queue = runtime && typeof runtime.sideChatQueueSummary === "function" ? runtime.sideChatQueueSummary({
			status: "queued",
			mode: "autoSendWhenIdle"
		}) : "";
		const pending = runtime && typeof runtime.sideChatReplyPending === "function" ? runtime.sideChatReplyPending("thread-a") : false;
		const subagentKind = runtime && typeof runtime.subagentStatusKind === "function" ? runtime.subagentStatusKind("running") : "";
		const subagentLabel = runtime && typeof runtime.subagentStatusLabel === "function" ? runtime.subagentStatusLabel("running") : "";
		const panel = runtime && typeof runtime.renderSideChatPanel === "function" ? runtime.renderSideChatPanel() : "";
		return {
			ok: runtime && typeof runtime === "object" && normalized.threadId === "thread-a" && Array.isArray(normalized.messages) && normalized.messages.length === 1 && path === "/api/threads/thread-a/side-chat/draft" && status === "已排队" && queue === "已排队 · 完成后自动发送" && pending === true && subagentKind === "running" && subagentLabel === "运行中" && String(panel || "").includes("side-chat-section"),
			factoryType: typeof api.createSideChatRuntime,
			normalizedThreadId: String(normalized.threadId || ""),
			messageCount: Array.isArray(normalized.messages) ? normalized.messages.length : 0,
			path,
			status,
			queue,
			pending,
			subagentKind,
			subagentLabel,
			panelReady: String(panel || "").includes("side-chat-section")
		};
	}
	if (id === "media-preview-runtime") {
		const element = {
			classList: {
				contains: () => false,
				add: () => {},
				remove: () => {},
				toggle: () => {}
			},
			dataset: {},
			style: {
				setProperty: () => {},
				removeProperty: () => {}
			},
			querySelector: () => null,
			querySelectorAll: () => [],
			closest: () => null,
			addEventListener: () => {},
			removeEventListener: () => {},
			appendChild: () => {},
			setAttribute: () => {},
			getAttribute: () => "",
			removeAttribute: () => {},
			textContent: "",
			innerText: id === "messageInput" ? "hello" : "",
			innerHTML: ""
		};
		const document = {
			documentElement: {
				getAttribute: () => "light",
				setAttribute: () => {}
			},
			head: element,
			createElement: () => Object.assign({}, element),
			getElementById: () => Object.assign({}, element),
			querySelector: () => null,
			querySelectorAll: () => []
		};
		const runtime = functionReady(api, "createMediaPreviewRuntime") ? api.createMediaPreviewRuntime({
			state: {
				key: "sample-key",
				currentThreadId: "thread-a",
				currentThread: { id: "thread-a" }
			},
			document,
			window: {
				location: {
					origin: "http://127.0.0.1:8787",
					pathname: "/"
				},
				CodexMarkdownRenderer: {
					renderMarkdown: (value) => `<p>${String(value == null ? "" : value)}</p>`,
					normalizeMermaidSourceForRender: (value) => String(value || "")
				},
				matchMedia: () => ({ matches: true }),
				setTimeout: (callback) => {
					if (typeof callback === "function") callback();
					return 1;
				},
				clearTimeout: () => {}
			},
			$: () => Object.assign({}, element),
			api: async () => ({}),
			escapeHtml: (value) => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
			normalizeFsPath: (value) => String(value || ""),
			shortPath: (value) => String(value || "").split("/").pop() || "",
			compactStructuredForSignature: (value) => JSON.stringify(value),
			visibleThreadTaskCardCommandText: (value) => String(value || ""),
			rememberCopyText: (value) => String(value || ""),
			copyButtonHtml: () => "<button></button>",
			stableTextHash: (value) => `hash:${String(value || "").length}`,
			renderContextThreadId: () => "thread-a",
			publishPluginNavigationState: () => {},
			postPerformanceEvent: () => {},
			roundedDurationMs: () => 1,
			nowPerfMs: () => 1,
			isHermesEmbedMode: () => false,
			isIosWebKitBrowser: () => false,
			requestHermesPluginRefresh: () => {},
			primaryTouch: (event) => event && event.touches && event.touches[0] || null
		}) : {};
		const githubUrl = runtime && typeof runtime.normalizeGithubPreviewUrl === "function" ? runtime.normalizeGithubPreviewUrl("https://github.com/openai/codex/pull/7") : "";
		const jsonPreview = runtime && typeof runtime.renderFilePreviewContent === "function" ? runtime.renderFilePreviewContent({
			kind: "json",
			content: "{\"ok\":true}"
		}) : "";
		return {
			ok: runtime && typeof runtime === "object" && githubUrl === "https://github.com/openai/codex/pull/7" && String(jsonPreview || "").includes("file-preview-text") && typeof runtime.renderMarkdownWithAttachmentSummary === "function" && typeof runtime.openImagePreviewFromImage === "function" && typeof runtime.renderImageView === "function" && typeof runtime.scheduleVisibleImageFailureScan === "function",
			factoryType: typeof api.createMediaPreviewRuntime,
			githubUrl,
			jsonPreviewReady: String(jsonPreview || "").includes("file-preview-text"),
			markdownType: typeof (runtime && runtime.renderMarkdownWithAttachmentSummary),
			imagePreviewType: typeof (runtime && runtime.openImagePreviewFromImage),
			imageViewType: typeof (runtime && runtime.renderImageView),
			scanType: typeof (runtime && runtime.scheduleVisibleImageFailureScan)
		};
	}
	if (id === "composer-runtime") {
		const elements = /* @__PURE__ */ new Map();
		const element = (id = "") => ({
			id,
			value: id === "messageInput" ? "hello" : "",
			files: [],
			classList: {
				contains: () => false,
				add: () => {},
				remove: () => {},
				toggle: () => {}
			},
			dataset: {},
			style: {
				setProperty: () => {},
				removeProperty: () => {}
			},
			getBoundingClientRect: () => ({
				width: 120,
				height: 32,
				left: 0,
				top: 0,
				right: 120,
				bottom: 32
			}),
			focus: () => {},
			blur: () => {},
			select: () => {},
			setSelectionRange: () => {},
			querySelector: () => null,
			querySelectorAll: () => [],
			closest: () => null,
			addEventListener: () => {},
			removeEventListener: () => {},
			appendChild: () => {},
			setAttribute: () => {},
			getAttribute: () => "",
			removeAttribute: () => {},
			textContent: "",
			innerHTML: ""
		});
		function getElement(id) {
			if (!elements.has(id)) elements.set(id, element(id));
			return elements.get(id);
		}
		const runtime = functionReady(api, "createComposerRuntime") ? api.createComposerRuntime({
			state: {
				threads: [],
				pendingAttachments: [],
				composerRuntimeSelection: {},
				codexProfiles: [],
				currentThreadId: "thread-a",
				currentThread: { id: "thread-a" },
				newThreadDraft: false
			},
			document: {
				documentElement: { style: {
					setProperty: () => {},
					removeProperty: () => {}
				} },
				activeElement: null,
				addEventListener: () => {},
				removeEventListener: () => {},
				createElement: () => element(),
				getElementById: getElement,
				querySelector: () => null,
				querySelectorAll: () => []
			},
			window: {
				setTimeout: (callback) => {
					if (typeof callback === "function") callback();
					return 1;
				},
				clearTimeout: () => {},
				requestAnimationFrame: (callback) => {
					if (typeof callback === "function") callback();
					return 1;
				},
				crypto: { randomUUID: () => "sample-uuid" },
				visualViewport: {
					width: 390,
					height: 700
				},
				innerWidth: 390,
				innerHeight: 700
			},
			$: getElement,
			api: async () => ({}),
			escapeHtml: (value) => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
			viewportMetrics: {
				cssPixel: (value) => Math.round(Number(value) || 0),
				stablePixelChanged: (left, right) => Math.abs((Number(left) || 0) - (Number(right) || 0)) >= 2
			},
			normalizeOptionList: (values) => Array.isArray(values) ? values.filter(Boolean).map((value) => String(value).trim()) : [],
			labelForModel: (value) => `Model ${String(value || "")}`.trim(),
			labelForEffort: (value) => `Effort ${String(value || "")}`.trim(),
			labelForPermissionMode: (value) => `Permission ${String(value || "")}`.trim(),
			defaultNewThreadModel: () => "gpt-5.5",
			defaultNewThreadEffort: () => "medium",
			defaultNewThreadPermissionMode: () => "auto",
			effectiveComposerPermissionMode: (value) => String(value || "").trim() || "auto",
			newThreadSelectedModel: () => "",
			newThreadSelectedEffort: () => "",
			newThreadSelectedPermissionMode: () => "",
			currentComposerThreadId: () => "thread-a",
			composerTargetThread: () => ({
				id: "thread-a",
				model: "gpt-5.5",
				effort: "medium",
				runtimeSettings: { permissionMode: "auto" }
			}),
			selectedQuotaModel: () => "gpt-5.5",
			threadDisplayName: () => "Thread A",
			isThreadTileComposerContext: () => false,
			isAndroidBrowser: () => false,
			isHermesEmbedMode: () => false,
			isKeyboardEditableElement: () => false,
			threadTileStatePolicy: { composerTargetPlaceholderPlan: () => ({ text: "Send to Thread A" }) },
			imageCompressor: {},
			homeAiDiagnosticReportingApi: {}
		}) : {};
		const model = runtime && typeof runtime.effectiveDefaultModel === "function" ? runtime.effectiveDefaultModel() : "";
		const effort = runtime && typeof runtime.effectiveDefaultEffort === "function" ? runtime.effectiveDefaultEffort() : "";
		const permission = runtime && typeof runtime.effectiveDefaultPermissionMode === "function" ? runtime.effectiveDefaultPermissionMode() : "";
		const label = runtime && typeof runtime.runtimeOptionLabel === "function" ? runtime.runtimeOptionLabel("model", "gpt-5.5") : "";
		const placeholder = runtime && typeof runtime.composerPlaceholderText === "function" ? runtime.composerPlaceholderText() : "";
		return {
			ok: runtime && typeof runtime === "object" && model === "gpt-5.5" && effort === "medium" && permission === "auto" && label === "Model gpt-5.5" && placeholder === "Send to Thread A" && typeof runtime.sendMessage === "function" && typeof runtime.sendNewThreadMessage === "function" && typeof runtime.interruptActiveTurn === "function",
			factoryType: typeof api.createComposerRuntime,
			model,
			effort,
			permission,
			label,
			placeholder,
			sendType: typeof (runtime && runtime.sendMessage),
			newThreadType: typeof (runtime && runtime.sendNewThreadMessage),
			interruptType: typeof (runtime && runtime.interruptActiveTurn)
		};
	}
	if (id === "composer-bridge-runtime") {
		const runtime = functionReady(api, "createComposerBridgeRuntime") ? api.createComposerBridgeRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.sendMessage === "function" && typeof runtime.sendNewThreadMessage === "function" && typeof runtime.answerServerRequest === "function" && typeof runtime.answerApproval === "function" && typeof runtime.declineServerRequest === "function" && typeof runtime.mutateThreadTaskCard === "function" && typeof runtime.replyTaskCard === "function" && typeof runtime.queueThreadTaskCardDraftCreation === "function" && typeof runtime.createThreadTaskCardDraft === "function" && typeof globalThis.sendMessage === "function" && typeof globalThis.answerApproval === "function" && typeof globalThis.mutateThreadTaskCard === "function" && typeof globalThis.queueThreadTaskCardDraftCreation === "function",
			factoryType: typeof api.createComposerBridgeRuntime,
			sendType: typeof (runtime && runtime.sendMessage),
			answerType: typeof (runtime && runtime.answerServerRequest),
			approvalType: typeof (runtime && runtime.answerApproval),
			mutateType: typeof (runtime && runtime.mutateThreadTaskCard),
			replyType: typeof (runtime && runtime.replyTaskCard),
			draftType: typeof (runtime && runtime.createThreadTaskCardDraft),
			globalSendType: typeof globalThis.sendMessage,
			globalApprovalType: typeof globalThis.answerApproval,
			globalMutateType: typeof globalThis.mutateThreadTaskCard,
			globalDraftQueueType: typeof globalThis.queueThreadTaskCardDraftCreation
		};
	}
	if (id === "api-client-runtime") {
		const runtime = functionReady(api, "createApiClientRuntime") ? api.createApiClientRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.api === "function" && typeof runtime.postClientEvent === "function" && typeof runtime.postPerformanceEvent === "function" && typeof runtime.recordHomeAiDiagnosticFailure === "function" && typeof runtime.recordHomeAiDiagnosticSuccess === "function" && typeof runtime.scheduleSubmittedMessageDomProbe === "function" && typeof runtime.checkConversationProjectionConsistency === "function" && typeof runtime.handlePushButtonClick === "function" && typeof globalThis.api === "function" && typeof globalThis.postClientEvent === "function" && typeof globalThis.diagnosticThreadHash === "function" && typeof globalThis.recordHomeAiDiagnosticFailure === "function" && typeof globalThis.scheduleSubmittedMessageDomProbe === "function" && typeof globalThis.checkConversationProjectionConsistency === "function" && typeof globalThis.handlePushButtonClick === "function",
			factoryType: typeof api.createApiClientRuntime,
			apiType: typeof (runtime && runtime.api),
			clientEventType: typeof (runtime && runtime.postClientEvent),
			performanceType: typeof (runtime && runtime.postPerformanceEvent),
			diagnosticFailureType: typeof (runtime && runtime.recordHomeAiDiagnosticFailure),
			diagnosticSuccessType: typeof (runtime && runtime.recordHomeAiDiagnosticSuccess),
			submittedProbeType: typeof (runtime && runtime.scheduleSubmittedMessageDomProbe),
			projectionCheckType: typeof (runtime && runtime.checkConversationProjectionConsistency),
			pushType: typeof (runtime && runtime.handlePushButtonClick),
			globalApiType: typeof globalThis.api,
			globalClientEventType: typeof globalThis.postClientEvent,
			globalThreadHashType: typeof globalThis.diagnosticThreadHash,
			globalSubmittedProbeType: typeof globalThis.scheduleSubmittedMessageDomProbe,
			globalProjectionCheckType: typeof globalThis.checkConversationProjectionConsistency,
			globalPushType: typeof globalThis.handlePushButtonClick
		};
	}
	if (id === "thread-list-load-policy") {
		const plan = functionReady(api, "planThreadListLoadRequest") ? api.planThreadListLoadRequest({
			silent: true,
			threadDetailOpening: true,
			deferFallback: true
		}) : {};
		return {
			ok: plan && plan.action === "thread-list-load-request" && plan.shouldLoad === false && plan.skipReason === "detail-in-flight" && plan.retryDelayMs === 700,
			action: String(plan && plan.action || ""),
			shouldLoad: Boolean(plan && plan.shouldLoad),
			skipReason: String(plan && plan.skipReason || ""),
			retryDelayMs: Number(plan && plan.retryDelayMs) || 0
		};
	}
	if (id === "thread-list-stable-order") {
		const scopeKey = functionReady(api, "threadListOrderScopeKey") ? api.threadListOrderScopeKey({
			selectedCwd: "/tmp/project",
			search: "Home"
		}) : "";
		const plan = functionReady(api, "planThreadListStableOrder") ? api.planThreadListStableOrder({
			threads: [
				{ id: "b" },
				{ id: "a" },
				{ id: "c" }
			],
			previousState: {
				scopeKey,
				holdUntilMs: 2e3,
				order: ["a", "b"]
			},
			scopeKey,
			nowMs: 1e3,
			holdMs: 5e3
		}) : {};
		const order = Array.isArray(plan.order) ? plan.order : [];
		return {
			ok: scopeKey === JSON.stringify({
				cwd: "/tmp/project",
				search: "home"
			}) && plan.held === true && order.join(",") === "a,b,c",
			scopeKey,
			held: Boolean(plan.held),
			order
		};
	}
	if (id === "thread-status-hints") {
		const running = functionReady(api, "isRunningStatus") ? api.isRunningStatus("in_progress") : false;
		const unread = functionReady(api, "shouldMarkThreadUnread") ? api.shouldMarkThreadUnread({
			threadId: "target-thread",
			currentThreadId: "other-thread",
			status: "completed",
			thread: { turns: [{
				status: "completed",
				completedAtMs: 2e3
			}] },
			viewedAtMs: 1e3
		}) : false;
		const expire = functionReady(api, "shouldExpireRunningThreadHint") ? api.shouldExpireRunningThreadHint({
			threadId: "target-thread",
			isRunningHinted: true,
			status: "idle",
			runningHintedAtMs: 0,
			runningHintStaleMs: 1e3,
			nowMs: 5e3,
			thread: {}
		}) : false;
		return {
			ok: running === true && unread === true && expire === true,
			running,
			unread,
			expire
		};
	}
	if (id === "thread-detail-patch-plan") {
		const surface = functionReady(api, "planThreadDetailDomPatchSurface") ? api.planThreadDetailDomPatchSurface({
			threadId: "thread-a",
			conversationPresent: true
		}) : {};
		const visiblePatch = functionReady(api, "planVisibleItemRefreshPatch") ? api.planVisibleItemRefreshPatch([{
			key: "a",
			signature: "1"
		}], [{
			key: "a",
			signature: "1"
		}, {
			key: "b",
			signature: "2"
		}]) : {};
		const turnPatch = functionReady(api, "planThreadDetailRefreshDomPatch") ? api.planThreadDetailRefreshDomPatch([{
			key: "turn-a",
			hasPreviousTurn: true,
			itemPatchable: true,
			articlePresent: true
		}]) : {};
		const visibleOperations = Array.isArray(visiblePatch.operations) ? visiblePatch.operations : [];
		const turnOperations = Array.isArray(turnPatch.operations) ? turnPatch.operations : [];
		return {
			ok: surface.canPatch === true && surface.reason === "single-thread-surface" && visiblePatch.canPatch === true && visibleOperations.map((entry) => entry.type).join(",") === "reuse,insert" && turnPatch.canPatch === true && turnOperations.length === 1 && turnOperations[0].type === "item-patch",
			surfaceReason: String(surface.reason || ""),
			visibleOperationCount: visibleOperations.length,
			turnOperationType: String(turnOperations[0] && turnOperations[0].type || "")
		};
	}
	if (id === "thread-detail-actions") {
		const node = (dataset) => ({
			dataset,
			closest(selector) {
				if (selector === "[data-thread-tile-pane]") return { dataset: { threadTilePane: "thread-pane" } };
				return null;
			}
		});
		const copyNode = node({ copyKey: "copy-1" });
		const approvalNode = node({
			approvalId: "ap-1",
			approvalThreadId: "thread-ap",
			approvalAction: "allow_once"
		});
		const responseNode = node({
			serverRequestId: "req-1",
			serverRequestThreadId: "thread-req",
			serverResponseText: "yes",
			serverQuestionId: "answer"
		});
		const rich = functionReady(api, "resolveRichContentClickAction") ? api.resolveRichContentClickAction({ target: { closest(selector) {
			return selector === "[data-copy-key]" ? copyNode : null;
		} } }) : {};
		const approval = functionReady(api, "resolveThreadDetailClickAction") ? api.resolveThreadDetailClickAction({ target: { closest(selector) {
			return selector === "[data-approval-action]" ? approvalNode : null;
		} } }) : {};
		const response = functionReady(api, "resolveThreadDetailClickAction") ? api.resolveThreadDetailClickAction({ target: { closest(selector) {
			return selector === "[data-server-response-text]" ? responseNode : null;
		} } }) : {};
		const contextThreadId = functionReady(api, "contextThreadIdFromNode") ? api.contextThreadIdFromNode(copyNode) : "";
		return {
			ok: rich.action === "copy" && rich.preventDefault === true && rich.stopPropagation === true && approval.action === "approval-answer" && approval.approvalAction === "allow_once" && approval.threadId === "thread-ap" && response.action === "server-response" && response.responseText === "yes" && contextThreadId === "thread-pane",
			richAction: String(rich.action || ""),
			approvalAction: String(approval.action || ""),
			approvalValue: String(approval.approvalAction || ""),
			responseAction: String(response.action || ""),
			contextThreadId
		};
	}
	if (id === "thread-detail-merge-state") {
		const policy = functionReady(api, "createThreadDetailMergePolicy") ? api.createThreadDetailMergePolicy({
			sortTurnsForDisplay: (turns) => Array.isArray(turns) ? turns.slice().sort((left, right) => String(left && left.id || "").localeCompare(String(right && right.id || ""))) : [],
			turnVisibleWeight: (turn) => JSON.stringify(turn && turn.items || []).length,
			mergeItemsPreservingLocalVisible: (existingItems, incomingItems, preserveLocalVisible) => preserveLocalVisible ? existingItems : incomingItems
		}) : {};
		const merged = policy && typeof policy.mergeThreadPreservingVisibleItems === "function" ? policy.mergeThreadPreservingVisibleItems({
			id: "thread-a",
			turns: [{
				id: "b",
				items: [{
					type: "assistantMessage",
					text: "full receipt"
				}]
			}]
		}, {
			id: "thread-a",
			turns: [{
				id: "b",
				items: []
			}, {
				id: "a",
				items: [{
					type: "userMessage",
					text: "hello"
				}]
			}]
		}) : {};
		const turns = Array.isArray(merged && merged.turns) ? merged.turns : [];
		const preserved = turns.find((turn) => turn && turn.id === "b");
		return {
			ok: turns.map((turn) => String(turn && turn.id || "")).join(",") === "a,b" && Array.isArray(preserved && preserved.items) && preserved.items.length === 1 && preserved.items[0].text === "full receipt",
			turnOrder: turns.map((turn) => String(turn && turn.id || "")),
			preservedItemCount: Array.isArray(preserved && preserved.items) ? preserved.items.length : 0
		};
	}
	if (id === "thread-detail-v4-merge-state") {
		const policy = functionReady(api, "createThreadDetailV4MergePolicy") ? api.createThreadDetailV4MergePolicy({
			normalizeThreadVisibleUserMessages: (thread) => thread,
			turnVisibleWeight: (turn) => Array.isArray(turn && turn.items) ? turn.items.length : 0,
			isOptimisticUserMessage: (item) => Boolean(item && item.mobilePendingSubmission),
			isRecentlySubmittedUserMessage: (item) => Boolean(item && item.mobilePendingSubmission),
			isReasoningItem: (item) => String(item && item.type || "") === "reasoning",
			userMessagesCanShadow: () => false,
			isTurnComplete: (turn) => /completed|failed|cancel|interrupted/i.test(String(turn && (turn.status && turn.status.type || turn.status) || "")),
			isRunningStatus: (status) => /running|active|inprogress|in_progress/i.test(String(status && status.type || status || "")),
			isIncompleteInterruptedTurn: () => false,
			turnHasActiveLiveItems: () => false,
			turnOrderMs: (turn) => Number(turn && turn.startedAtMs) || 0,
			sortTurnsForDisplay: (turns) => Array.isArray(turns) ? turns.slice().sort((left, right) => (Number(left && left.startedAtMs) || 0) - (Number(right && right.startedAtMs) || 0)) : [],
			maxVisibleTurnsForThread: () => 5
		}) : {};
		const merged = policy && typeof policy.mergeV4ProjectionThread === "function" ? policy.mergeV4ProjectionThread({
			id: "thread-a",
			mobileProjectionRevision: 3,
			turns: [{
				id: "active",
				startedAtMs: 100,
				status: "running",
				items: [{
					type: "agentMessage",
					text: "streaming"
				}]
			}]
		}, {
			id: "thread-a",
			mobileProjectionRevision: 2,
			turns: [{
				id: "new",
				startedAtMs: 50,
				status: "completed",
				items: [{
					type: "userMessage",
					text: "prompt"
				}]
			}]
		}) : {};
		const turns = Array.isArray(merged && merged.turns) ? merged.turns : [];
		return {
			ok: typeof policy.mergeV4ProjectionThread === "function" && typeof policy.v4ProjectionRevisionValue === "function" && policy.v4ProjectionRevisionValue(merged) === 3 && turns.map((turn) => String(turn && turn.id || "")).join(",") === "new,active",
			revision: policy && typeof policy.v4ProjectionRevisionValue === "function" ? policy.v4ProjectionRevisionValue(merged) : 0,
			turnOrder: turns.map((turn) => String(turn && turn.id || ""))
		};
	}
	if (id === "thread-detail-runtime") {
		const statePolicy = {
			completedIncomingTurnHasAuthoritativeReceipt: () => false,
			shouldDropLocalOnlyReceiptForIncomingTurn: () => false,
			shouldPreserveLocalOnlyItem: () => false,
			shouldPreserveExistingTurnVisibleItems: () => false
		};
		const runtime = functionReady(api, "createThreadDetailRuntime") ? api.createThreadDetailRuntime({
			threadDetailStateApi: {
				createThreadDetailStatePolicy: () => statePolicy,
				threadListSummaryFromDetailThread: () => ({}),
				planThreadOpenCacheReuse: () => ({ action: "skip" }),
				threadHasReusableLoadedDetailState: () => false
			},
			threadDetailMergeStateApi: { createThreadDetailMergePolicy: () => ({ mergeThreadPreservingVisibleItems: (existingThread, incomingThread) => incomingThread || existingThread }) },
			threadDetailV4MergeStateApi: { createThreadDetailV4MergePolicy: () => ({
				isV4ProjectionThread: () => false,
				mergeV4ProjectionThread: (existingThread, incomingThread) => incomingThread || existingThread
			}) },
			statusText: (status) => String(status && status.type || status || ""),
			isLiveTurn: (turn) => /active|running/i.test(String(turn && (turn.status && turn.status.type || turn.status) || "")),
			isLatestTurn: (turn, thread) => Array.isArray(thread && thread.turns) && thread.turns.at(-1) === turn,
			isReasoningItem: (item) => String(item && item.type || "") === "reasoning",
			isOperationalItem: (item) => String(item && item.type || "") === "commandExecution",
			isContextCompactionItem: () => false,
			isTurnComplete: (turn) => /completed|failed|cancel|interrupted/i.test(String(turn && (turn.status && turn.status.type || turn.status) || "")),
			isRunningStatus: (status) => /active|running|queued|processing/i.test(String(status && status.type || status || "")),
			sortTurnsForDisplay: (turns) => Array.isArray(turns) ? turns : []
		}) : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.visibleItemsForTurn === "function" && typeof runtime.mergeThreadPreservingVisibleItems === "function" && typeof runtime.normalizeThreadVisibleUserMessages === "function" && typeof runtime.threadUserMessageEntries === "function" && typeof runtime.turnOrderMs === "function" && typeof runtime.turnIsSupersededBy === "function" && typeof globalThis.CodexThreadDetailRuntime === "object" && typeof globalThis.CodexThreadDetailRuntime.createThreadDetailRuntime === "function",
			factoryType: typeof api.createThreadDetailRuntime,
			visibleItemsType: typeof (runtime && runtime.visibleItemsForTurn),
			mergeType: typeof (runtime && runtime.mergeThreadPreservingVisibleItems),
			normalizeType: typeof (runtime && runtime.normalizeThreadVisibleUserMessages),
			turnOrderType: typeof (runtime && runtime.turnOrderMs),
			globalFactoryType: typeof (globalThis.CodexThreadDetailRuntime && globalThis.CodexThreadDetailRuntime.createThreadDetailRuntime)
		};
	}
	if (id === "task-card-runtime") {
		const runtime = functionReady(api, "createTaskCardRuntime") ? api.createTaskCardRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderThreadTaskCard === "function" && typeof runtime.renderThreadTaskCards === "function" && typeof runtime.createThreadTaskCardFromCurrent === "function" && typeof runtime.renderApprovalRequest === "function" && typeof globalThis.CodexTaskCardRuntime === "object" && typeof globalThis.CodexTaskCardRuntime.createTaskCardRuntime === "function" && typeof globalThis.threadTaskCardCommandText === "function" && typeof globalThis.renderThreadTaskCards === "function" && typeof globalThis.renderApprovalRequest === "function",
			factoryType: typeof api.createTaskCardRuntime,
			renderType: typeof (runtime && runtime.renderThreadTaskCard),
			renderListType: typeof (runtime && runtime.renderThreadTaskCards),
			createType: typeof (runtime && runtime.createThreadTaskCardFromCurrent),
			approvalType: typeof (runtime && runtime.renderApprovalRequest),
			globalCommandType: typeof globalThis.threadTaskCardCommandText,
			globalRenderType: typeof globalThis.renderThreadTaskCards
		};
	}
	if (id === "settings-runtime") {
		const runtime = functionReady(api, "createSettingsRuntime") ? api.createSettingsRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderFontSizeControl === "function" && typeof runtime.renderQuotaUsage === "function" && typeof runtime.renderCodexProfileSettings === "function" && typeof runtime.renderWorkspaceDelegationSettings === "function" && typeof runtime.rememberRateLimitsFromConfig === "function" && typeof runtime.rememberCodexProfiles === "function" && typeof globalThis.CodexSettingsRuntime === "object" && typeof globalThis.CodexSettingsRuntime.createSettingsRuntime === "function",
			factoryType: typeof api.createSettingsRuntime,
			fontSizeType: typeof (runtime && runtime.renderFontSizeControl),
			quotaType: typeof (runtime && runtime.renderQuotaUsage),
			profileType: typeof (runtime && runtime.renderCodexProfileSettings),
			workspaceDelegationType: typeof (runtime && runtime.renderWorkspaceDelegationSettings),
			rateLimitsType: typeof (runtime && runtime.rememberRateLimitsFromConfig),
			profilesType: typeof (runtime && runtime.rememberCodexProfiles),
			globalFactoryType: typeof (globalThis.CodexSettingsRuntime && globalThis.CodexSettingsRuntime.createSettingsRuntime)
		};
	}
	if (id === "app-entry") {
		const runtime = functionReady(api, "createCodexMobileAppEntry") ? api.createCodexMobileAppEntry() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.startCodexMobileApp === "function" && typeof api.startCodexMobileApp === "function" && typeof globalThis.CodexMobileAppEntry === "object" && typeof globalThis.CodexMobileAppEntry.createCodexMobileAppEntry === "function" && typeof globalThis.CodexMobileAppEntry.startCodexMobileApp === "function",
			factoryType: typeof api.createCodexMobileAppEntry,
			startType: typeof api.startCodexMobileApp,
			runtimeStartType: typeof (runtime && runtime.startCodexMobileApp),
			globalFactoryType: typeof (globalThis.CodexMobileAppEntry && globalThis.CodexMobileAppEntry.createCodexMobileAppEntry),
			globalStartType: typeof (globalThis.CodexMobileAppEntry && globalThis.CodexMobileAppEntry.startCodexMobileApp)
		};
	}
	if (id === "notification-ui-runtime") {
		const runtime = functionReady(api, "createNotificationUiRuntime") ? api.createNotificationUiRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.showApp === "function" && typeof runtime.showLogin === "function" && typeof runtime.bootstrap === "function" && typeof runtime.requestHermesPluginRefresh === "function" && typeof runtime.handlePluginVoiceInputMessage === "function" && typeof globalThis.CodexNotificationUiRuntime === "object" && typeof globalThis.CodexNotificationUiRuntime.createNotificationUiRuntime === "function" && typeof globalThis.showApp === "function" && typeof globalThis.showLogin === "function" && typeof globalThis.bootstrap === "function" && typeof globalThis.sortTurnsForDisplay === "function",
			factoryType: typeof api.createNotificationUiRuntime,
			showAppType: typeof (runtime && runtime.showApp),
			showLoginType: typeof (runtime && runtime.showLogin),
			bootstrapType: typeof (runtime && runtime.bootstrap),
			refreshType: typeof (runtime && runtime.requestHermesPluginRefresh),
			globalBootstrapType: typeof globalThis.bootstrap,
			globalSortType: typeof globalThis.sortTurnsForDisplay
		};
	}
	if (id === "conversation-render-runtime") {
		const runtime = functionReady(api, "createConversationRenderRuntime") ? api.createConversationRenderRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderTurn === "function" && typeof runtime.renderItem === "function" && typeof runtime.renderItemBody === "function" && typeof runtime.renderUserMessageBody === "function" && typeof runtime.renderLiveOperationDock === "function" && typeof runtime.ensureTurn === "function" && typeof runtime.shouldDeferLiveFinalReceipt === "function" && typeof globalThis.CodexConversationRenderRuntime === "object" && typeof globalThis.CodexConversationRenderRuntime.createConversationRenderRuntime === "function" && typeof globalThis.renderTurn === "function" && typeof globalThis.renderItem === "function" && typeof globalThis.renderLiveOperationDock === "function" && typeof globalThis.ensureTurn === "function" && typeof globalThis.shouldDeferLiveFinalReceipt === "function" && typeof globalThis.imageUrlValue === "function" && typeof globalThis.renderMarkdownWithAttachmentSummary === "function" && typeof globalThis.renderFilePreviewContent === "function" && typeof globalThis.closeImagePreview === "function",
			factoryType: typeof api.createConversationRenderRuntime,
			renderTurnType: typeof (runtime && runtime.renderTurn),
			renderItemType: typeof (runtime && runtime.renderItem),
			liveDockType: typeof (runtime && runtime.renderLiveOperationDock),
			ensureTurnType: typeof (runtime && runtime.ensureTurn),
			globalRenderType: typeof globalThis.renderTurn,
			globalEnsureTurnType: typeof globalThis.ensureTurn,
			globalImageUrlType: typeof globalThis.imageUrlValue
		};
	}
	if (id === "event-stream-runtime") {
		const runtime = functionReady(api, "createEventStreamRuntime") ? api.createEventStreamRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.connectEvents === "function" && typeof runtime.applyNotification === "function" && typeof runtime.resumeMobileSession === "function" && typeof runtime.scrollConversationToBottom === "function" && typeof runtime.updateScrollToBottomButton === "function" && typeof globalThis.CodexEventStreamRuntime === "object" && typeof globalThis.CodexEventStreamRuntime.createEventStreamRuntime === "function" && typeof globalThis.upsertItem === "function" && typeof globalThis.connectEvents === "function" && typeof globalThis.ensureEventConnection === "function" && typeof globalThis.resumeMobileSession === "function" && typeof globalThis.followThreadOpenToBottom === "function" && typeof globalThis.scheduleBottomFollowScroll === "function" && typeof globalThis.updateScrollToBottomButton === "function",
			factoryType: typeof api.createEventStreamRuntime,
			connectType: typeof (runtime && runtime.connectEvents),
			notificationType: typeof (runtime && runtime.applyNotification),
			resumeType: typeof (runtime && runtime.resumeMobileSession),
			scrollType: typeof (runtime && runtime.scrollConversationToBottom),
			globalConnectType: typeof globalThis.connectEvents,
			globalFollowType: typeof globalThis.followThreadOpenToBottom
		};
	}
	if (id === "client-render-stability-guard") {
		const sourceTurn = {
			id: "local-turn-secret",
			items: [{
				type: "userMessage",
				clientSubmissionId: "submission-secret",
				mobilePendingSubmission: true
			}]
		};
		const targetTurn = {
			id: "server-turn-a",
			items: [{
				type: "userMessage",
				clientSubmissionId: "submission-secret"
			}]
		};
		const sourceKey = functionReady(api, "markSubmittedTurn") ? api.markSubmittedTurn(sourceTurn, "submission-secret") : "";
		const transferredKey = functionReady(api, "transferSubmittedTurnIdentity") ? api.transferSubmittedTurnIdentity(sourceTurn, targetTurn, "submission-secret") : "";
		const sourceIdentity = functionReady(api, "stableTurnIdentity") ? api.stableTurnIdentity(sourceTurn) : "";
		const targetIdentity = functionReady(api, "stableTurnIdentity") ? api.stableTurnIdentity(targetTurn) : "";
		return {
			ok: Boolean(sourceKey) && sourceKey === transferredKey && sourceIdentity === sourceKey && targetIdentity === sourceKey && !String(sourceKey).includes("submission-secret"),
			sourceKey: String(sourceKey || ""),
			transferredKey: String(transferredKey || ""),
			sourceIdentity: String(sourceIdentity || ""),
			targetIdentity: String(targetIdentity || "")
		};
	}
	if (id === "live-operation-dock-state") {
		const card = functionReady(api, "operationCardContentPlan") ? api.operationCardContentPlan({
			itemId: "op-a",
			type: "tool",
			status: "running",
			title: "Run",
			detail: "working",
			durationText: "1s"
		}) : {};
		const preserve = functionReady(api, "compactBubblePreservation") ? api.compactBubblePreservation({
			nextHtml: "",
			liveTurnActive: true,
			visibleUntilMs: 2e3,
			nowMs: 1e3,
			savedThreadId: "thread-a",
			currentThreadId: "thread-a",
			savedHtml: "<div class=\"mobile-operation-bubble\"></div>",
			dockHasBubble: false
		}) : {};
		const recall = functionReady(api, "shouldShowRecall") ? api.shouldShowRecall({
			isMobile: true,
			hasCurrentThread: true,
			newThreadDraft: false,
			liveTurnActive: true,
			recallThreadId: "thread-a",
			currentThreadId: "thread-a",
			recallHtml: "<div class=\"mobile-operation-sheet\"></div>"
		}) : false;
		const classTokens = Array.isArray(card.classTokens) ? card.classTokens : [];
		return {
			ok: card.detail === "working" && classTokens.includes("live-operation") && preserve.preserve === true && preserve.patchSavedHtml === true && recall === true,
			detail: String(card.detail || ""),
			preserve: Boolean(preserve.preserve),
			recall
		};
	}
	return { ok: false };
}
function codexMobileViteEsmCompatibility() {
	const modules = moduleDefinitions.map((definition) => {
		const api = moduleApis[definition.id] && typeof moduleApis[definition.id] === "object" ? moduleApis[definition.id] : {};
		const expectedFunctions = Array.isArray(definition.expectedFunctions) ? definition.expectedFunctions : [];
		const exportedFunctions = expectedFunctions.filter((name) => functionReady(api, name));
		const sample = sampleModule(definition.id, api);
		const globalPublished = publishClassicGlobal(definition, api);
		return {
			id: definition.id,
			source: definition.source,
			assetPath: definition.assetPath,
			globalName: definition.globalName,
			classicLoaderExcluded: definition.classicLoaderExcluded === true,
			expectedFunctions: expectedFunctions.slice(),
			exportedFunctions,
			sample,
			globalPublished,
			ready: exportedFunctions.length === expectedFunctions.length && sample.ok === true && (definition.classicLoaderExcluded !== true || globalPublished === true)
		};
	});
	return {
		schemaVersion: 1,
		owner: "vite-shell-entry",
		moduleCount: modules.length,
		readyCount: modules.filter((entry) => entry.ready === true).length,
		modules
	};
}
var codexMobileViteEsmCompatibilityModules = moduleDefinitions;
//#endregion
export { codexMobileViteEsmCompatibility, codexMobileViteEsmCompatibility as default, codexMobileViteEsmCompatibilityModules };
