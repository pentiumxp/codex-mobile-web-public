import { n as __toESM, t as __commonJSMin } from "./rolldown-runtime-FDOR9p9I.js";
//#region public/plugin-voice-input.js
var require_plugin_voice_input = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory(root || {});
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexPluginVoiceInput = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function(root) {
		const PLUGIN_ID = "codex-mobile";
		const VERSION = 1;
		const MAX_TEXT_CHARS = 12e3;
		const TYPES = Object.freeze({
			CAPABILITY_QUERY: "voice_input.capability_query",
			CAPABILITY_STATE: "voice_input.capability_state",
			INSERT_TEXT: "voice_input.insert_text",
			APPEND_TEXT: "voice_input.append_text",
			REPLACE_DRAFT: "voice_input.replace_draft",
			PROVISIONAL_TEXT: "voice_input.provisional_text",
			SUBMIT: "voice_input.submit",
			START_REQUEST: "voice_input.start_request",
			STOP_REQUEST: "voice_input.stop_request",
			CANCEL_REQUEST: "voice_input.cancel_request",
			INSERT_RESULT: "voice_input.insert_result",
			COMMIT_RESULT: "voice_input.commit_result",
			ERROR: "voice_input.error"
		});
		const ACTION_TYPES = Object.freeze({
			insert_text: TYPES.INSERT_TEXT,
			append_text: TYPES.APPEND_TEXT,
			replace_draft: TYPES.REPLACE_DRAFT,
			provisional_text: TYPES.PROVISIONAL_TEXT,
			submit: TYPES.SUBMIT
		});
		const ACTIONS_BY_TYPE = Object.freeze(Object.fromEntries(Object.entries(ACTION_TYPES).map(([action, type]) => [type, action])));
		function stringValue(value) {
			return String(value || "").trim();
		}
		function boundedString(value, maxLength) {
			const text = stringValue(value);
			const limit = Math.max(0, Number(maxLength) || 0);
			return text ? text.slice(0, limit) : "";
		}
		function boundedText(value, maxLength = MAX_TEXT_CHARS) {
			const text = String(value || "").replace(/\u00a0/g, " ");
			const limit = Math.max(1, Number(maxLength) || MAX_TEXT_CHARS);
			return text.slice(0, limit);
		}
		function normalizeAction(action) {
			const value = stringValue(action).toLowerCase();
			if (value === "append") return "append_text";
			if (value === "insert") return "insert_text";
			if (value === "replace") return "replace_draft";
			if (value === "provisional") return "provisional_text";
			return ACTION_TYPES[value] ? value : "";
		}
		function normalizeActions(actions) {
			const normalized = (Array.isArray(actions) ? actions : actions && typeof actions === "object" ? Object.keys(actions).filter((key) => actions[key]) : []).map(normalizeAction).filter(Boolean);
			return [...new Set(normalized)];
		}
		function requestIdFrom(payload = {}) {
			return boundedString(payload.requestId || payload.request_id, 160);
		}
		function voiceSessionIdFrom(payload = {}) {
			return boundedString(payload.voiceSessionId || payload.voice_session_id, 160);
		}
		function pluginIdFrom(payload = {}) {
			return boundedString(payload.pluginId || payload.plugin_id || PLUGIN_ID, 80) || PLUGIN_ID;
		}
		function baseMessage(type, input = {}) {
			const message = {
				type,
				version: VERSION,
				pluginId: pluginIdFrom(input)
			};
			const requestId = requestIdFrom(input);
			const voiceSessionId = voiceSessionIdFrom(input);
			if (requestId) message.requestId = requestId;
			if (voiceSessionId) message.voiceSessionId = voiceSessionId;
			return message;
		}
		function capabilityStateMessage(input = {}) {
			const actions = normalizeActions(input.actions).filter((action) => action !== "submit");
			const composerId = boundedString(input.composerId || input.composer_id || "thread-composer", 120) || "thread-composer";
			const threadId = boundedString(input.threadId || input.thread_id, 160);
			const draftId = boundedString(input.draftId || input.draft_id, 220);
			const maxChars = Math.max(1, Math.min(Number(input.maxChars || input.max_chars || MAX_TEXT_CHARS) || MAX_TEXT_CHARS, MAX_TEXT_CHARS));
			const message = Object.assign(baseMessage(TYPES.CAPABILITY_STATE, input), {
				writable: Boolean(input.writable || input.composerWritable),
				composerId,
				threadId,
				draftId,
				maxChars,
				actions: actions.length ? actions : ["append_text", "replace_draft"]
			});
			message.composer = {
				writable: message.writable,
				composerId,
				threadId,
				draftId,
				maxChars
			};
			return message;
		}
		function startRequestMessage(input = {}) {
			const capability = capabilityStateMessage(input.capability || input);
			return Object.assign(baseMessage(TYPES.START_REQUEST, input), {
				composerId: capability.composerId,
				threadId: capability.threadId,
				draftId: capability.draftId,
				writable: capability.writable,
				maxChars: capability.maxChars,
				actions: capability.actions,
				capability
			});
		}
		function stopRequestMessage(input = {}) {
			return Object.assign(baseMessage(TYPES.STOP_REQUEST, input), {
				composerId: boundedString(input.composerId || input.composer_id || "thread-composer", 120) || "thread-composer",
				threadId: boundedString(input.threadId || input.thread_id, 160)
			});
		}
		function cancelRequestMessage(input = {}) {
			return Object.assign(baseMessage(TYPES.CANCEL_REQUEST, input), {
				composerId: boundedString(input.composerId || input.composer_id || "thread-composer", 120) || "thread-composer",
				threadId: boundedString(input.threadId || input.thread_id, 160)
			});
		}
		function insertResultMessage(input = {}) {
			return Object.assign(baseMessage(TYPES.INSERT_RESULT, input), {
				ok: input.ok !== false,
				action: boundedString(input.action || input.insertAction || input.insert_action, 40),
				code: input.ok === false ? boundedString(input.code || input.errorCode || input.error_code, 80) : "",
				composerId: boundedString(input.composerId || input.composer_id || "thread-composer", 120) || "thread-composer",
				draftId: boundedString(input.draftId || input.draft_id, 220),
				error: input.ok === false ? boundedString(input.error || input.message, 240) : ""
			});
		}
		function commitResultMessage(input = {}) {
			return Object.assign(baseMessage(TYPES.COMMIT_RESULT, input), {
				ok: input.ok !== false,
				action: boundedString(input.action || "submitted", 40) || "submitted",
				composerId: boundedString(input.composerId || input.composer_id || "thread-composer", 120) || "thread-composer",
				threadId: boundedString(input.threadId || input.thread_id, 160),
				messageId: boundedString(input.messageId || input.message_id, 180),
				finalText: boundedText(input.finalText || input.final_text || input.text, input.maxChars || MAX_TEXT_CHARS).trim()
			});
		}
		function errorMessage(input = {}) {
			return Object.assign(baseMessage(TYPES.ERROR, input), {
				code: boundedString(input.code || "plugin_voice_input_error", 80) || "plugin_voice_input_error",
				error: boundedString(input.error || input.message || "Plugin voice input error", 240),
				composerId: boundedString(input.composerId || input.composer_id || "thread-composer", 120) || "thread-composer"
			});
		}
		function isVoiceInputMessage(value) {
			return Boolean(value && typeof value === "object" && stringValue(value.type).startsWith("voice_input."));
		}
		function actionFromMessageType(type) {
			return ACTIONS_BY_TYPE[stringValue(type)] || "";
		}
		function textFromMessage(payload = {}, maxChars = MAX_TEXT_CHARS) {
			return boundedText(payload.text || payload.finalText || payload.final_text, maxChars).trim();
		}
		function postToParent(parentWindow, message, targetOrigin) {
			if (!parentWindow || parentWindow === root || !message) return false;
			parentWindow.postMessage(message, targetOrigin || "*");
			return true;
		}
		return {
			ACTION_TYPES,
			MAX_TEXT_CHARS,
			PLUGIN_ID,
			TYPES,
			VERSION,
			actionFromMessageType,
			boundedString,
			boundedText,
			cancelRequestMessage,
			capabilityStateMessage,
			commitResultMessage,
			errorMessage,
			insertResultMessage,
			isVoiceInputMessage,
			normalizeAction,
			normalizeActions,
			pluginIdFrom,
			postToParent,
			requestIdFrom,
			startRequestMessage,
			stopRequestMessage,
			textFromMessage,
			voiceSessionIdFrom
		};
	});
}));
//#endregion
//#region public/api-client.js
var require_api_client = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexApiClient = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function isFormDataBody(body, FormDataCtor) {
			return typeof FormDataCtor === "function" && body instanceof FormDataCtor;
		}
		function createApiClient(options = {}) {
			const fetchRef = options.fetch || (typeof fetch === "function" ? fetch : null);
			const AbortControllerCtor = options.AbortControllerCtor || (typeof AbortController === "function" ? AbortController : null);
			const FormDataCtor = options.FormDataCtor || (typeof FormData === "function" ? FormData : null);
			const getKey = typeof options.getKey === "function" ? options.getKey : () => "";
			const onUnauthorized = typeof options.onUnauthorized === "function" ? options.onUnauthorized : () => {};
			const onResponseError = typeof options.onResponseError === "function" ? options.onResponseError : () => {};
			async function request(path, requestOptions = {}) {
				if (!fetchRef) throw new Error("Fetch is unavailable");
				if (!AbortControllerCtor) throw new Error("AbortController is unavailable");
				const headers = Object.assign({}, requestOptions.headers || {});
				const timeoutMs = requestOptions.timeoutMs || 3e4;
				const controller = new AbortControllerCtor();
				let timedOut = false;
				const timer = setTimeout(() => {
					timedOut = true;
					controller.abort();
				}, timeoutMs);
				const externalSignal = requestOptions.signal;
				const abortFromExternal = () => controller.abort();
				if (externalSignal) if (externalSignal.aborted) controller.abort();
				else externalSignal.addEventListener("abort", abortFromExternal, { once: true });
				const fetchOptions = Object.assign({}, requestOptions, {
					headers,
					signal: controller.signal
				});
				delete fetchOptions.timeoutMs;
				const key = getKey();
				if (key) headers["X-Codex-Mobile-Key"] = key;
				if (requestOptions.body && !isFormDataBody(requestOptions.body, FormDataCtor) && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
				try {
					const res = await fetchRef(path, fetchOptions);
					if (!res.ok) {
						let message = `${res.status} ${res.statusText}`;
						let code = "";
						let detail = "";
						let requestId = "";
						let progress = null;
						let responseBody = null;
						try {
							const body = await res.json();
							responseBody = body;
							if (body.error) message = body.error;
							if (body.code) code = String(body.code);
							if (body.detail) detail = String(body.detail);
							if (body.requestId) requestId = String(body.requestId);
							if (body.progress && typeof body.progress === "object") progress = body.progress;
						} catch (_) {}
						onResponseError({
							status: res.status,
							message,
							code,
							detail,
							requestId,
							path
						});
						if (res.status === 401) onUnauthorized();
						const err = new Error(message);
						err.status = res.status;
						err.code = code;
						err.detail = detail;
						err.requestId = requestId;
						err.progress = progress;
						err.responseBody = responseBody;
						throw err;
					}
					if (res.status === 204) return null;
					return res.json();
				} catch (err) {
					if (err && err.name === "AbortError") {
						if (timedOut) throw new Error(`Request timed out: ${path}`);
						throw new Error(`Request cancelled: ${path}`);
					}
					throw err;
				} finally {
					clearTimeout(timer);
					if (externalSignal) externalSignal.removeEventListener("abort", abortFromExternal);
				}
			}
			return { request };
		}
		return {
			createApiClient,
			isFormDataBody
		};
	});
}));
//#endregion
//#region public/markdown-renderer.js
var require_markdown_renderer = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexMarkdownRenderer = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function escapeHtml(value) {
			return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				"\"": "&quot;",
				"'": "&#39;"
			})[ch]);
		}
		function isMarkdownTableSeparator(line) {
			const cells = String(line || "").trim().replace(/^\||\|$/g, "").split("|");
			return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
		}
		function splitMarkdownTableRow(line) {
			return String(line || "").trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
		}
		function isMarkdownBlockStart(line, nextLine = "") {
			return /^```/.test(line) || /^(#{1,6})\s+\S/.test(line) || /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line) || /^>\s?/.test(line) || /^\s*[-*+]\s+\S/.test(line) || /^\s*\d+[.)]\s+\S/.test(line) || line.includes("|") && isMarkdownTableSeparator(nextLine);
		}
		function safeMarkdownUrl(value) {
			const url = String(value || "").trim();
			if (/^(https?:|mailto:)/i.test(url)) return url;
			return "";
		}
		function safeMarkdownImageUrl(value) {
			const url = String(value || "").trim();
			if (/^https?:/i.test(url)) return url;
			return safeMarkdownDataImageUrl(url);
		}
		function safeMarkdownDataImageUrl(value) {
			const url = String(value || "").trim();
			if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(url)) return url.replace(/\s+/g, "");
			return "";
		}
		function stripMarkdownLinkTarget(value) {
			const target = String(value || "").trim();
			if (target.startsWith("<") && target.endsWith(">")) return target.slice(1, -1).trim();
			return target;
		}
		function decodeMarkdownLinkTarget(value) {
			const target = stripMarkdownLinkTarget(value);
			if (/^file:\/\//i.test(target)) try {
				return decodeURIComponent(new URL(target).pathname);
			} catch (_) {
				return target.replace(/^file:\/\//i, "");
			}
			try {
				return decodeURIComponent(target);
			} catch (_) {
				return target;
			}
		}
		function isLocalFileTarget(value) {
			const target = stripMarkdownLinkTarget(value);
			return target.startsWith("/") || /^file:\/\//i.test(target) || /^[A-Za-z]:[\\/]/.test(target) || /^\\\\/.test(target);
		}
		function autolinkUrlParts(rawUrl) {
			let href = String(rawUrl || "");
			let suffix = "";
			while (/[.,;:!?]$/.test(href)) {
				suffix = href.slice(-1) + suffix;
				href = href.slice(0, -1);
			}
			while (href.endsWith(")") && href.split("(").length <= href.split(")").length) {
				suffix = ")" + suffix;
				href = href.slice(0, -1);
			}
			return {
				href,
				suffix
			};
		}
		function renderMarkdownLink(rawLabel, rawUrl) {
			const label = escapeHtml(rawLabel);
			const target = stripMarkdownLinkTarget(rawUrl);
			if (isLocalFileTarget(target)) return `<button class="local-file-preview-link" type="button" data-local-file-path="${escapeHtml(decodeMarkdownLinkTarget(target))}" data-local-file-label="${escapeHtml(rawLabel)}" title="预览查看这个文件">${label}</button>`;
			const safeUrl = safeMarkdownUrl(String(target || "").replaceAll("&amp;", "&"));
			if (!safeUrl) return null;
			return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${label}</a>`;
		}
		function renderMarkdownImage(rawLabel, rawUrl) {
			const target = stripMarkdownLinkTarget(rawUrl);
			const safeUrl = safeMarkdownImageUrl(String(target || "").replaceAll("&amp;", "&"));
			if (!safeUrl) return null;
			return `<figure class="markdown-image"><img src="${escapeHtml(safeUrl)}" alt="Image" loading="lazy"></figure>`;
		}
		function renderAutolinkUrl(rawUrl) {
			const parts = autolinkUrlParts(rawUrl);
			const safeUrl = safeMarkdownUrl((parts.href.startsWith("www.") ? `https://${parts.href}` : parts.href).replaceAll("&amp;", "&"));
			if (!safeUrl) return rawUrl;
			return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${parts.href}</a>${parts.suffix}`;
		}
		function renderAngleAutolink(rawUrl) {
			const safeUrl = safeMarkdownUrl(String(rawUrl || "").replaceAll("&amp;", "&"));
			if (!safeUrl) return null;
			return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${escapeHtml(rawUrl)}</a>`;
		}
		function renderInlineMarkdown(value) {
			const placeholders = [];
			const tokenPrefix = "MDTOKEN";
			let text = String(value || "").replace(/`([^`\n]+)`/g, (_match, code) => {
				const token = `${tokenPrefix}${placeholders.length}END`;
				placeholders.push(`<code>${escapeHtml(code)}</code>`);
				return token;
			});
			text = text.replace(/!\[([^\]\n]*)\]\((<[^>\n]+>|[^)\s]+)\)/g, (match, label, url) => {
				const rendered = renderMarkdownImage(label, url);
				if (!rendered) return match;
				const token = `${tokenPrefix}${placeholders.length}END`;
				placeholders.push(rendered);
				return token;
			});
			text = text.replace(/\[([^\]\n]+)\]\((<[^>\n]+>|[^)\s]+)\)/g, (match, label, url) => {
				const rendered = renderMarkdownLink(label, url);
				if (!rendered) return match;
				const token = `${tokenPrefix}${placeholders.length}END`;
				placeholders.push(rendered);
				return token;
			});
			text = text.replace(/<((?:https?:\/\/|mailto:)[^<>\s]+)>/gi, (match, url) => {
				const rendered = renderAngleAutolink(url);
				if (!rendered) return match;
				const token = `${tokenPrefix}${placeholders.length}END`;
				placeholders.push(rendered);
				return token;
			});
			text = escapeHtml(text);
			text = text.replace(/(^|[\s([{"'“‘:：])((?:https?:\/\/|www\.)[^\s<]+)/gi, (_match, prefix, url) => `${prefix}${renderAutolinkUrl(url)}`);
			text = text.replace(/\*\*([^*\n][^*\n]*?)\*\*/g, "<strong>$1</strong>").replace(/__([^_\n][^_\n]*?)__/g, "<strong>$1</strong>").replace(/(^|[\s(])\*([^*\n][^*\n]*?)\*/g, "$1<em>$2</em>").replace(/(^|[\s(])_([^_\n][^_\n]*?)_/g, "$1<em>$2</em>");
			placeholders.forEach((html, index) => {
				text = text.replaceAll(`${tokenPrefix}${index}END`, html);
			});
			return text;
		}
		function renderMarkdownTable(lines) {
			const header = splitMarkdownTableRow(lines[0]);
			const rows = lines.slice(2).map(splitMarkdownTableRow);
			return `<div class="markdown-table-wrap"><table>
    <thead><tr>${header.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${header.map((_cell, index) => `<td>${renderInlineMarkdown(row[index] || "")}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
		}
		function orderedListStart(lines, options) {
			const first = lines.map((line) => /^\s*(\d+)[.)]\s+/.exec(line)).filter(Boolean).map((match) => Number(match[1]) || 1)[0] || 1;
			if (options && options.orderedListMode === "source") return first;
			return lines.length <= 1 ? first : 1;
		}
		function renderMarkdownList(lines, ordered, options) {
			const tag = ordered ? "ol" : "ul";
			const itemPattern = ordered ? /^\s*(\d+)[.)]\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/;
			const start = ordered ? orderedListStart(lines, options) : 1;
			const items = lines.map((line) => {
				const match = itemPattern.exec(line);
				return `<li>${renderInlineMarkdown(match ? match[ordered ? 2 : 1] : line.trim())}</li>`;
			});
			return `<${tag}${ordered && start > 1 ? ` start="${start}"` : ""}>${items.join("")}</${tag}>`;
		}
		function codeBlockTableLines(codeText) {
			const lines = String(codeText || "").replace(/\r\n?/g, "\n").split("\n");
			for (let index = 0; index < lines.length - 1; index += 1) {
				if (!lines[index].includes("|") || !isMarkdownTableSeparator(lines[index + 1])) continue;
				const tableLines = [lines[index], lines[index + 1]];
				index += 2;
				while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
					tableLines.push(lines[index]);
					index += 1;
				}
				return tableLines.length >= 3 ? tableLines : [];
			}
			return [];
		}
		function renderCodeBlock(codeText, lang, options) {
			const langLabel = `<span class="markdown-code-lang">${escapeHtml(lang || "代码")}</span>`;
			let copyButton = "";
			if (options && typeof options.rememberCopyText === "function" && typeof options.copyButtonHtml === "function") copyButton = options.copyButtonHtml(options.rememberCopyText(codeText), options.copyLabel || "复制", "markdown-copy-button");
			const normalizedLang = String(lang || "").trim().toLowerCase();
			const tableLines = Boolean(options && options.fencedTableMode === "preview") && (!normalizedLang || normalizedLang === "text" || normalizedLang === "txt" || normalizedLang === "plain" || normalizedLang === "plaintext") ? codeBlockTableLines(codeText) : [];
			if (tableLines.length) return `<div class="markdown-code-table-preview">${renderMarkdownTable(tableLines)}</div>
      <details class="markdown-code-table-source-details">
        <summary>查看源码表格</summary>
        <div class="markdown-code-block"><div class="markdown-code-head">${langLabel}${copyButton}</div><pre><code>${escapeHtml(codeText)}</code></pre></div>
      </details>`;
			return `<div class="markdown-code-block"><div class="markdown-code-head">${langLabel}${copyButton}</div><pre><code>${escapeHtml(codeText)}</code></pre></div>`;
		}
		function escapeMermaidQuotedLabel(value) {
			return String(value || "").trim().replace(/"/g, "&quot;");
		}
		function mermaidGeneratedSubgraphId(index) {
			return `codex_mobile_subgraph_${index + 1}`;
		}
		function normalizeMermaidSubgraphLine(line, index) {
			const match = /^(\s*)subgraph\s+(.+?)\s*$/i.exec(String(line || ""));
			if (!match) return line;
			const indent = match[1] || "";
			const body = String(match[2] || "").trim();
			if (!body || /^end$/i.test(body)) return line;
			const bracketMatch = /^([A-Za-z][\w-]*)\s*\[(.*)\]$/.exec(body);
			if (bracketMatch) {
				const label = String(bracketMatch[2] || "").trim();
				if (!label || /^".*"$/.test(label)) return line;
				return `${indent}subgraph ${bracketMatch[1]}["${escapeMermaidQuotedLabel(label)}"]`;
			}
			const idTitleMatch = /^([A-Za-z][\w-]*)\s+(.+)$/.exec(body);
			if (idTitleMatch) {
				const title = String(idTitleMatch[2] || "").trim();
				if (!title || /^".*"$/.test(title)) return line;
				return `${indent}subgraph ${idTitleMatch[1]}["${escapeMermaidQuotedLabel(title)}"]`;
			}
			if (/^[A-Za-z][\w-]*$/.test(body) || /^".*"$/.test(body)) return line;
			return `${indent}subgraph ${mermaidGeneratedSubgraphId(index)}["${escapeMermaidQuotedLabel(body)}"]`;
		}
		function normalizeMermaidDetachedSoftBreakLabels(source) {
			return String(source || "").replace(/(^|[\s;])([A-Za-z][\w-]*)\[([^\]\n]+)\]<br\/>\(([^()\n]+)\)/gm, (match, prefix, nodeId, label, continuation) => {
				return `${prefix}${nodeId}["${escapeMermaidQuotedLabel(`${String(label || "").trim()}<br/>(${String(continuation || "").trim()})`)}"]`;
			});
		}
		function normalizeMermaidSourceForRender(value) {
			const withSoftBreaks = String(value || "").replace(/\\n/g, "<br/>");
			const firstLine = withSoftBreaks.split(/\r?\n/, 1)[0].trim();
			if (!/^(?:flowchart|graph)\b/i.test(firstLine)) return withSoftBreaks;
			return normalizeMermaidDetachedSoftBreakLabels(withSoftBreaks.split(/\r?\n/).map((line, index) => normalizeMermaidSubgraphLine(line, index)).join("\n")).replace(/(^|[\s;])([A-Za-z][\w-]*)\[([^\]\n]*)\]/gm, (match, prefix, nodeId, label) => {
				const trimmed = String(label || "").trim();
				if (!trimmed || /^".*"$/.test(trimmed)) return match;
				if (!/[()（）]|<br\/>/.test(trimmed)) return match;
				return `${prefix}${nodeId}["${trimmed.replace(/"/g, "&quot;")}"]`;
			}).replace(/\|([^|\n]*[()]+[^|\n]*)\|/g, (match, label) => {
				return `|${String(label || "").replace(/\(/g, "（").replace(/\)/g, "）")}|`;
			});
		}
		function renderMermaidBlock(codeText) {
			return `<div class="markdown-mermaid-block" data-mermaid-block="true">
      <div class="markdown-mermaid-head">
        <span class="markdown-mermaid-label">Mermaid</span>
        <div class="markdown-mermaid-toolbar">
          <button class="markdown-mermaid-tool" type="button" data-mermaid-action="zoom-out" aria-label="缩小 Mermaid 图" title="缩小">-</button>
          <button class="markdown-mermaid-tool markdown-mermaid-tool-reset" type="button" data-mermaid-action="reset" aria-label="重置 Mermaid 图缩放" title="重置">100%</button>
          <button class="markdown-mermaid-tool" type="button" data-mermaid-action="zoom-in" aria-label="放大 Mermaid 图" title="放大">+</button>
          <button class="markdown-mermaid-tool" type="button" data-mermaid-action="expand" aria-label="放大查看 Mermaid 图" title="放大查看">展开</button>
        </div>
      </div>
      <div class="markdown-mermaid-viewer" data-mermaid-viewer="inline">
        <div class="markdown-mermaid-canvas" data-mermaid-canvas>
          <div class="markdown-mermaid-loading">正在渲染 Mermaid 图...</div>
        </div>
      </div>
      <details class="markdown-mermaid-source-details">
        <summary>查看 Mermaid 源码</summary>
        <pre><code class="language-mermaid">${escapeHtml(codeText)}</code></pre>
      </details>
      <pre class="markdown-mermaid-source" hidden>${escapeHtml(codeText)}</pre>
    </div>`;
		}
		function renderBareDataImage(value) {
			const safeUrl = safeMarkdownDataImageUrl(value);
			if (!safeUrl) return "";
			return `<figure class="markdown-image"><img src="${escapeHtml(safeUrl)}" alt="Image" loading="lazy"></figure>`;
		}
		function renderMarkdown(value, options = {}) {
			const source = String(value || "");
			if (!source.trim()) return "";
			const lines = source.replace(/\r\n?/g, "\n").split("\n");
			const blocks = [];
			let i = 0;
			while (i < lines.length) {
				const line = lines[i];
				if (!line.trim()) {
					i += 1;
					continue;
				}
				const bareDataImage = renderBareDataImage(line.trim());
				if (bareDataImage) {
					blocks.push(bareDataImage);
					i += 1;
					continue;
				}
				const fence = /^```([A-Za-z0-9_.+-]*)\s*$/.exec(line);
				if (fence) {
					const lang = fence[1] || "";
					const code = [];
					i += 1;
					while (i < lines.length && !/^```\s*$/.test(lines[i])) {
						code.push(lines[i]);
						i += 1;
					}
					if (i < lines.length) i += 1;
					const codeText = code.join("\n");
					blocks.push(/^mermaid$/i.test(lang) ? renderMermaidBlock(codeText) : renderCodeBlock(codeText, lang, options));
					continue;
				}
				const heading = /^(#{1,6})\s+(.+)$/.exec(line);
				if (heading) {
					const level = Math.min(6, heading[1].length + 1);
					blocks.push(`<h${level}>${renderInlineMarkdown(heading[2].trim())}</h${level}>`);
					i += 1;
					continue;
				}
				if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
					blocks.push("<hr>");
					i += 1;
					continue;
				}
				if (/^>\s?/.test(line)) {
					const quote = [];
					while (i < lines.length && /^>\s?/.test(lines[i])) {
						quote.push(lines[i].replace(/^>\s?/, ""));
						i += 1;
					}
					blocks.push(`<blockquote>${renderMarkdown(quote.join("\n"), options)}</blockquote>`);
					continue;
				}
				if (line.includes("|") && isMarkdownTableSeparator(lines[i + 1])) {
					const tableLines = [line, lines[i + 1]];
					i += 2;
					while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
						tableLines.push(lines[i]);
						i += 1;
					}
					blocks.push(renderMarkdownTable(tableLines));
					continue;
				}
				if (/^\s*[-*+]\s+\S/.test(line)) {
					const list = [];
					while (i < lines.length && /^\s*[-*+]\s+\S/.test(lines[i])) {
						list.push(lines[i]);
						i += 1;
					}
					blocks.push(renderMarkdownList(list, false, options));
					continue;
				}
				if (/^\s*\d+[.)]\s+\S/.test(line)) {
					const list = [];
					while (i < lines.length && /^\s*\d+[.)]\s+\S/.test(lines[i])) {
						list.push(lines[i]);
						i += 1;
					}
					blocks.push(renderMarkdownList(list, true, options));
					continue;
				}
				const paragraph = [line.trim()];
				i += 1;
				while (i < lines.length && lines[i].trim() && !isMarkdownBlockStart(lines[i], lines[i + 1] || "")) {
					paragraph.push(lines[i].trim());
					i += 1;
				}
				blocks.push(`<p>${paragraph.map(renderInlineMarkdown).join("<br>")}</p>`);
			}
			return `<div class="markdown-body">${blocks.join("")}</div>`;
		}
		return {
			escapeHtml,
			safeMarkdownUrl,
			autolinkUrlParts,
			renderMarkdownLink,
			renderMarkdownImage,
			renderAutolinkUrl,
			renderInlineMarkdown,
			safeMarkdownImageUrl,
			normalizeMermaidSourceForRender,
			isMarkdownTableSeparator,
			splitMarkdownTableRow,
			isMarkdownBlockStart,
			renderMarkdownTable,
			renderMarkdownList,
			renderMarkdown
		};
	});
}));
//#endregion
//#region public/plugin-embed.js
var require_plugin_embed = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory(root || {});
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexPluginEmbed = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function(root) {
		const NAVIGATION_TYPE = "codex-mobile.plugin.navigation";
		const BACK_RESULT_TYPE = "codex-mobile.plugin.back_result";
		const REFRESH_REQUIRED_TYPE = "codex-mobile.plugin.refresh_required";
		const EXTERNAL_LINK_TYPE = "codex-mobile.plugin.external_link";
		const BACK_TYPE = "hermes.plugin.back";
		const THEME_VALUES = /* @__PURE__ */ new Set([
			"system",
			"dark",
			"light"
		]);
		const FONT_SIZE_VALUES = /* @__PURE__ */ new Set([
			"small",
			"default",
			"large",
			"xlarge",
			"xxlarge"
		]);
		function stringValue(value) {
			return String(value || "").trim();
		}
		function boundedString(value, maxLength) {
			const text = stringValue(value);
			return text ? text.slice(0, Math.max(0, Number(maxLength) || 0)) : "";
		}
		function normalizedEnum(value, allowedValues) {
			const text = stringValue(value).toLowerCase();
			return allowedValues.has(text) ? text : "";
		}
		function urlFrom(value) {
			try {
				const location = root.location || {};
				return new URL(value || location.href || "/", location.origin || "http://127.0.0.1");
			} catch (_) {
				return null;
			}
		}
		function detect(value) {
			const url = urlFrom(value);
			const params = url ? url.searchParams : new URLSearchParams();
			const routeHint = normalizeRouteHint({
				pluginId: boundedString(params.get("pluginId"), 80),
				route: boundedString(params.get("pluginRoute"), 80),
				itemId: boundedString(params.get("pluginItemId"), 160),
				threadId: boundedString(params.get("pluginThreadId"), 160),
				taskId: boundedString(params.get("pluginTaskId"), 160)
			}) || {
				pluginId: "",
				route: "",
				itemId: "",
				threadId: "",
				taskId: ""
			};
			const appearance = {};
			const theme = normalizedEnum(params.get("pluginTheme") || params.get("theme"), THEME_VALUES);
			const fontSize = normalizedEnum(params.get("pluginFontSize") || params.get("fontSize"), FONT_SIZE_VALUES);
			if (theme) appearance.theme = theme;
			if (fontSize) appearance.fontSize = fontSize;
			return {
				embedded: params.get("embed") === "hermes",
				launchKey: stringValue(params.get("codexPluginLaunch") || params.get("pluginLaunch")),
				workspaceId: stringValue(params.get("workspaceId") || params.get("workspace_id")),
				routeHint,
				appearance
			};
		}
		function normalizeRouteHint(value) {
			if (!value || typeof value !== "object") return null;
			const pluginId = boundedString(value.pluginId, 80);
			const route = boundedString(value.route, 80);
			const itemId = boundedString(value.itemId, 160);
			const threadId = boundedString(value.threadId, 160);
			const taskId = boundedString(value.taskId, 160);
			if (!(pluginId || route || itemId || threadId || taskId)) return null;
			return {
				pluginId,
				route,
				itemId,
				threadId,
				taskId
			};
		}
		function routeHintFromUrl(value) {
			return normalizeRouteHint(detect(value).routeHint);
		}
		function routeHintTargetId(hint) {
			const normalized = normalizeRouteHint(hint);
			return normalized ? stringValue(normalized.taskId || normalized.itemId) : "";
		}
		function routeHintOpenPlan(hint) {
			const normalized = normalizeRouteHint(hint);
			if (!normalized || normalized.pluginId !== "codex-mobile") return { action: "ignore" };
			const threadId = stringValue(normalized.threadId);
			const targetId = routeHintTargetId(normalized);
			if (!threadId && !targetId) return {
				action: "primary",
				diagnostic: normalized.route && normalized.route !== "root" ? {
					message: "Notification target is unavailable",
					error: true
				} : null
			};
			if (!threadId) return {
				action: "primary",
				diagnostic: {
					message: "Notification thread is unavailable",
					error: true
				}
			};
			return {
				action: "openThread",
				hint: normalized,
				threadId,
				targetId,
				pendingHint: targetId ? normalized : null,
				statusMessage: targetId ? "Opening notification target" : "Opening notification thread"
			};
		}
		function routeHintFocusPlan(hint, state = {}) {
			const normalized = normalizeRouteHint(hint);
			if (!normalized) return { action: "ignore" };
			const currentThreadId = stringValue(state.currentThreadId);
			if (!currentThreadId || normalized.threadId !== currentThreadId) return { action: "wait" };
			if (!routeHintTargetId(normalized)) return { action: "clear" };
			if (state.targetFound === true) return {
				action: "focused",
				diagnostic: {
					message: "Opened notification target",
					error: false
				}
			};
			return {
				action: "primary",
				diagnostic: {
					message: "Notification target is no longer available",
					error: true
				}
			};
		}
		function routeHintTargetSelectors(hint, options = {}) {
			const targetId = routeHintTargetId(hint);
			if (!targetId) return [];
			const escaped = (typeof options.escapeSelector === "function" ? options.escapeSelector : (value) => stringValue(value).replace(/["\\]/g, "\\$&"))(targetId);
			return [
				`[data-approval-card="${escaped}"]`,
				`[data-task-card="${escaped}"]`,
				`[data-turn="${escaped}"]`,
				`[data-item="${escaped}"]`
			];
		}
		function findRouteHintTargetNode(rootNode, hint, options = {}) {
			if (!rootNode || typeof rootNode.querySelector !== "function") return null;
			for (const selector of routeHintTargetSelectors(hint, options)) {
				const node = rootNode.querySelector(selector);
				if (node) return node;
			}
			return null;
		}
		function scrubRouteHintPath(value, options = {}) {
			const url = urlFrom(value);
			if (!url) return "";
			url.search = "";
			url.searchParams.set("embed", "hermes");
			const workspaceId = boundedString(options.workspaceId, 120);
			if (workspaceId) url.searchParams.set("workspaceId", workspaceId);
			const appearance = appearanceFromState(options.appearance || {});
			if (appearance.theme) url.searchParams.set("pluginTheme", appearance.theme);
			if (appearance.fontSize) url.searchParams.set("pluginFontSize", appearance.fontSize);
			return `${url.pathname || "/"}?${url.searchParams.toString()}${url.hash || ""}`;
		}
		function parentOriginFromReferrer(referrer) {
			try {
				return referrer ? new URL(referrer).origin : "";
			} catch (_) {
				return "";
			}
		}
		function routeFromState(state = {}, ui = {}) {
			if (ui.imagePreviewOpen) return {
				kind: "modal",
				modal: "imagePreview",
				threadId: stringValue(state.currentThreadId)
			};
			if (ui.mermaidPreviewOpen) return {
				kind: "modal",
				modal: "mermaidPreview",
				threadId: stringValue(state.currentThreadId)
			};
			if (ui.filePreviewOpen) return {
				kind: "modal",
				modal: "filePreview",
				threadId: stringValue(state.currentThreadId)
			};
			if (state.renameThreadId) return {
				kind: "modal",
				modal: "renameThread",
				threadId: stringValue(state.renameThreadId)
			};
			if (state.threadActionMenuId) return {
				kind: "modal",
				modal: "threadActions",
				threadId: stringValue(state.threadActionMenuId)
			};
			if (state.subagentPanelOpen) return {
				kind: "panel",
				panel: "subagent",
				threadId: stringValue(state.currentThreadId)
			};
			if (ui.primaryPage) return {
				kind: "root",
				workspace: stringValue(state.selectedCwd),
				settingsOpen: Boolean(ui.settingsOpen)
			};
			if (ui.settingsOpen) return {
				kind: "panel",
				panel: "settings",
				threadId: stringValue(state.currentThreadId)
			};
			if (ui.sidebarOpen) return {
				kind: "drawer",
				drawer: "threadList",
				threadId: stringValue(state.currentThreadId)
			};
			if (state.newThreadDraft) return {
				kind: "new_thread",
				workspace: stringValue(state.selectedCwd)
			};
			if (state.currentThreadId) return {
				kind: "thread",
				threadId: stringValue(state.currentThreadId)
			};
			if (state.selectedCwd) return {
				kind: "workspace",
				workspace: stringValue(state.selectedCwd)
			};
			return { kind: "root" };
		}
		function canGoBack(state = {}, ui = {}) {
			if (ui.primaryPage) return false;
			return Boolean(ui.imagePreviewOpen || ui.mermaidPreviewOpen || ui.filePreviewOpen || ui.createWorkspaceOpen || ui.updatePanelOpen || ui.settingsOpen || ui.sidebarOpen || state.renameThreadId || state.threadActionMenuId || state.subagentPanelOpen || state.newThreadDraft || state.currentThreadId);
		}
		function appearanceFromState(state = {}) {
			const source = state.pluginAppearance && typeof state.pluginAppearance === "object" ? state.pluginAppearance : {};
			const appearance = {};
			const theme = normalizedEnum(source.theme || state.theme, THEME_VALUES);
			const fontSize = normalizedEnum(state.fontSize || source.fontSize || source.pluginFontSize, FONT_SIZE_VALUES);
			if (theme) appearance.theme = theme;
			if (fontSize) appearance.fontSize = fontSize;
			return appearance;
		}
		function navigationMessage(state = {}, ui = {}) {
			const message = {
				type: NAVIGATION_TYPE,
				version: 1,
				canGoBack: canGoBack(state, ui),
				route: routeFromState(state, ui)
			};
			const appearance = appearanceFromState(state);
			if (Object.keys(appearance).length > 0) message.appearance = appearance;
			return message;
		}
		function postNavigation(parentWindow, state = {}, options = {}) {
			if (!parentWindow || parentWindow === root) return null;
			const message = navigationMessage(state, options.ui || {});
			parentWindow.postMessage(message, options.targetOrigin || "*");
			return message;
		}
		function backResultMessage(state = {}, options = {}) {
			const message = {
				type: BACK_RESULT_TYPE,
				version: 1,
				handled: Boolean(options.handled),
				route: routeFromState(state, options.ui || {})
			};
			const reason = stringValue(options.reason);
			if (reason) message.reason = reason;
			return message;
		}
		function postBackResult(parentWindow, state = {}, options = {}) {
			if (!parentWindow || parentWindow === root) return null;
			const message = backResultMessage(state, options);
			parentWindow.postMessage(message, options.targetOrigin || "*");
			return message;
		}
		function refreshRequiredRoute(route = {}) {
			const next = {};
			const name = boundedString(route.name || route.kind || "", 48);
			const threadId = boundedString(route.threadId || "", 160);
			const itemId = boundedString(route.itemId || "", 160);
			const pluginRoute = boundedString(route.pluginRoute || route.route || "", 80);
			const pluginThreadId = boundedString(route.pluginThreadId || threadId || "", 160);
			const pluginTaskId = boundedString(route.pluginTaskId || route.taskId || "", 160);
			const pluginItemId = boundedString(route.pluginItemId || itemId || "", 160);
			if (name) next.name = name;
			if (threadId) next.threadId = threadId;
			if (itemId) next.itemId = itemId;
			if (pluginRoute) next.pluginRoute = pluginRoute;
			if (pluginThreadId) next.pluginThreadId = pluginThreadId;
			if (pluginTaskId) next.pluginTaskId = pluginTaskId;
			if (pluginItemId) next.pluginItemId = pluginItemId;
			return next;
		}
		function refreshRequiredMessage(input = {}) {
			const message = {
				type: REFRESH_REQUIRED_TYPE,
				version: 1,
				reason: boundedString(input.reason || "refresh_required", 80) || "refresh_required"
			};
			const route = refreshRequiredRoute(input.route || {});
			if (Object.keys(route).length > 0) message.route = route;
			const appearance = appearanceFromState(input.appearance || {});
			if (Object.keys(appearance).length > 0) message.appearance = appearance;
			return message;
		}
		function postRefreshRequired(parentWindow, input = {}, options = {}) {
			if (!parentWindow || parentWindow === root) return null;
			const message = refreshRequiredMessage(input);
			parentWindow.postMessage(message, options.targetOrigin || "*");
			return message;
		}
		function externalBrowserUrl(value, origin) {
			const text = stringValue(value);
			if (!text) return "";
			if (!/^(https?:|mailto:)/i.test(text)) return "";
			try {
				const baseOrigin = origin || root.location && root.location.origin || "http://127.0.0.1";
				const url = new URL(text, baseOrigin);
				if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") return url.toString();
			} catch (_) {}
			return "";
		}
		function externalLinkMessage(input = {}) {
			const href = externalBrowserUrl(input.href || input.url || "", input.origin || "");
			if (!href) return null;
			return {
				type: EXTERNAL_LINK_TYPE,
				version: 1,
				href: boundedString(href, 2e3),
				source: boundedString(input.source || "receipt-link", 80) || "receipt-link"
			};
		}
		function postExternalLink(parentWindow, input = {}, options = {}) {
			if (!parentWindow || parentWindow === root) return null;
			const message = externalLinkMessage(input);
			if (!message) return null;
			parentWindow.postMessage(message, options.targetOrigin || "*");
			return message;
		}
		function isBackMessage(event) {
			const data = event && event.data;
			return Boolean(data && data.type === BACK_TYPE && data.version === 1);
		}
		function isInternalUrl(value, origin) {
			const text = stringValue(value);
			if (text.startsWith("/") && !text.startsWith("//")) return true;
			try {
				const baseOrigin = origin || root.location && root.location.origin || "";
				const url = new URL(text, baseOrigin || "http://127.0.0.1");
				return !baseOrigin || url.origin === baseOrigin;
			} catch (_) {
				return false;
			}
		}
		return {
			BACK_TYPE,
			BACK_RESULT_TYPE,
			EXTERNAL_LINK_TYPE,
			REFRESH_REQUIRED_TYPE,
			NAVIGATION_TYPE,
			appearanceFromState,
			backResultMessage,
			canGoBack,
			detect,
			externalBrowserUrl,
			externalLinkMessage,
			findRouteHintTargetNode,
			isBackMessage,
			isInternalUrl,
			navigationMessage,
			normalizeRouteHint,
			parentOriginFromReferrer,
			postBackResult,
			postExternalLink,
			postRefreshRequired,
			postNavigation,
			refreshRequiredMessage,
			routeHintFocusPlan,
			routeHintFromUrl,
			routeHintOpenPlan,
			routeHintTargetId,
			routeHintTargetSelectors,
			routeFromState,
			scrubRouteHintPath
		};
	});
}));
//#endregion
//#region public/frontend-runtime-health.js
var require_frontend_runtime_health = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexFrontendRuntimeHealth = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_WINDOW_MS = 5e3;
		const DEFAULT_SUBMISSION_PROBE_MIN_MS = 250;
		const MAX_COUNT = 1e5;
		function compactToken(value, fallback = "", maxLength = 80) {
			return String(value || "").trim().replace(/[^a-zA-Z0-9_.:-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, maxLength) || fallback;
		}
		function boundedCount(value) {
			const number = Number(value);
			if (!Number.isFinite(number) || number < 0) return 0;
			return Math.min(MAX_COUNT, Math.trunc(number));
		}
		function boolCount(value) {
			return value ? 1 : 0;
		}
		function boundedConfidence(value, fallback = .74) {
			const number = Number(value);
			if (!Number.isFinite(number)) return fallback;
			return Math.max(0, Math.min(1, number));
		}
		function baseContext(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = {
				surface: compactToken(source.surface, "frontend-runtime", 80),
				action: compactToken(source.action, "render", 80)
			};
			const routeKind = compactToken(source.routeKind || source.route_kind, "", 80);
			const readMode = compactToken(source.readMode || source.read_mode, "", 80);
			const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
			const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
			const itemHash = compactToken(source.itemHash || source.item_hash, "", 80);
			const renderPlanReason = compactToken(source.renderPlanReason || source.render_plan_reason, "", 80);
			const patchRejectReason = compactToken(source.patchRejectReason || source.patch_reject_reason, "", 80);
			if (routeKind) context.route_kind = routeKind;
			if (readMode) context.read_mode = readMode;
			if (renderMode) context.render_mode = renderMode;
			if (threadHash) context.thread_hash = threadHash;
			if (itemHash) context.item_hash = itemHash;
			if (renderPlanReason) context.render_plan_reason = renderPlanReason;
			if (patchRejectReason) context.patch_reject_reason = patchRejectReason;
			return context;
		}
		function runtimeEvent(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			return {
				category: "frontend_runtime_mismatch",
				diagnostic_type: compactToken(source.diagnosticType || source.diagnostic_type, "frontend_runtime_mismatch", 80),
				severity_hint: compactToken(source.severityHint || source.severity_hint, "H2", 8),
				evidence_confidence: boundedConfidence(source.evidenceConfidence || source.evidence_confidence, .74),
				error_code: compactToken(source.errorCode || source.error_code, "frontend_runtime_mismatch", 100),
				context: baseContext(source.context || source),
				counts: source.counts && typeof source.counts === "object" ? source.counts : {},
				breadcrumbs: Array.isArray(source.breadcrumbs) ? source.breadcrumbs.slice(0, 6) : []
			};
		}
		function runtimeSuccess(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			return {
				category: "frontend_runtime_mismatch",
				diagnostic_type: compactToken(source.diagnosticType || source.diagnostic_type, "frontend_runtime_mismatch", 80),
				error_code: compactToken(source.errorCode || source.error_code || source.diagnosticType || source.diagnostic_type, "frontend_runtime_mismatch", 100),
				context: baseContext(source.context || source)
			};
		}
		function submittedMessageDomMissingEvent(input = {}) {
			const elapsedMs = boundedCount(input.elapsedMs || input.elapsed_ms);
			const domCount = boundedCount(input.domCount || input.dom_count);
			const visibleCount = boundedCount(input.visibleCount || input.visible_count);
			const context = baseContext(Object.assign({}, input, {
				surface: "user-operation",
				action: input.action || "message-submit"
			}));
			return runtimeEvent({
				diagnosticType: "submitted_message_dom_missing",
				severityHint: "H2",
				evidenceConfidence: .82,
				errorCode: "submitted_message_dom_missing",
				context,
				counts: {
					elapsed_ms: elapsedMs,
					dom_count: domCount,
					visible_count: visibleCount,
					current_thread_match: boolCount(input.currentThreadMatch),
					has_thread_submission: boolCount(input.hasThreadSubmission),
					dom_has_submission: boolCount(input.domHasSubmission),
					composer_busy: boolCount(input.composerBusy)
				},
				breadcrumbs: [{
					kind: "user-operation",
					code: "submitted-message-dom-probe",
					status: "failed",
					fields: {
						elapsed_ms: elapsedMs,
						dom_count: domCount,
						visible_count: visibleCount,
						thread_hash: context.thread_hash || "",
						item_hash: context.item_hash || ""
					}
				}]
			});
		}
		function submittedMessageDomSuccess(input = {}) {
			return runtimeSuccess(Object.assign({}, input, {
				diagnosticType: "submitted_message_dom_missing",
				errorCode: "submitted_message_dom_missing",
				surface: "user-operation",
				action: input.action || "message-submit"
			}));
		}
		function submittedMessageDomProbeEffects(input = {}) {
			if (boundedCount(input.elapsedMs || input.elapsed_ms) < boundedCount(input.minElapsedMs || input.min_elapsed_ms || DEFAULT_SUBMISSION_PROBE_MIN_MS)) return {
				effects: [],
				reason: "too-early"
			};
			if (!input.currentThreadMatch) return {
				effects: [],
				reason: "different-thread"
			};
			if (!input.hasThreadSubmission) return {
				effects: [],
				reason: "no-thread-submission"
			};
			const missing = !input.domHasSubmission;
			return {
				effects: [{
					type: missing ? "diagnostic-failure" : "diagnostic-success",
					diagnostic: missing ? submittedMessageDomMissingEvent(input) : submittedMessageDomSuccess(input),
					diagnosticType: "submitted_message_dom_missing",
					reason: missing ? "submitted-message-dom-missing" : "submitted-message-dom-present"
				}],
				reason: missing ? "submitted-message-dom-missing" : "submitted-message-dom-present"
			};
		}
		function renderChurnEvent(input = {}) {
			const context = baseContext(Object.assign({}, input, {
				surface: "conversation-render",
				action: input.action || "render"
			}));
			const fullRenderCount = boundedCount(input.fullRenderCount || input.full_render_count);
			const fallbackCount = boundedCount(input.fallbackCount || input.fallback_count);
			const renderCount = boundedCount(input.renderCount || input.render_count);
			const domCount = boundedCount(input.domCount || input.dom_count);
			const visibleCount = boundedCount(input.visibleCount || input.visible_count);
			const previousCount = boundedCount(input.previousCount || input.previous_count);
			return runtimeEvent({
				diagnosticType: "render_churn",
				severityHint: "H3",
				evidenceConfidence: .72,
				errorCode: fallbackCount ? "render_patch_fallback_churn" : "render_full_render_churn",
				context,
				counts: {
					render_count: renderCount,
					full_render_count: fullRenderCount,
					fallback_count: fallbackCount,
					previous_count: previousCount,
					dom_count: domCount,
					visible_count: visibleCount,
					render_elapsed_ms: boundedCount(input.renderElapsedMs || input.render_elapsed_ms),
					duplicate_count: boundedCount(input.duplicateCount || input.duplicate_count)
				},
				breadcrumbs: [{
					kind: "conversation-render",
					code: fallbackCount ? "patch-fallback-churn" : "full-render-churn",
					status: "unstable",
					fields: {
						render_mode: context.render_mode || "",
						render_plan_reason: context.render_plan_reason || "",
						patch_reject_reason: context.patch_reject_reason || "",
						previous_count: previousCount,
						dom_count: domCount,
						visible_count: visibleCount
					}
				}]
			});
		}
		function domDropEvent(input = {}) {
			const context = baseContext(Object.assign({}, input, {
				surface: "conversation-render",
				action: input.action || "render"
			}));
			return runtimeEvent({
				diagnosticType: "render_dom_drop",
				severityHint: "H2",
				evidenceConfidence: .8,
				errorCode: "render_dom_drop",
				context,
				counts: {
					previous_count: boundedCount(input.previousCount || input.previous_count),
					dom_count: boundedCount(input.domCount || input.dom_count),
					visible_count: boundedCount(input.visibleCount || input.visible_count),
					duplicate_count: boundedCount(input.duplicateCount || input.duplicate_count),
					render_elapsed_ms: boundedCount(input.renderElapsedMs || input.render_elapsed_ms)
				},
				breadcrumbs: [{
					kind: "conversation-render",
					code: "dom-drop",
					status: "failed",
					fields: {
						previous_count: boundedCount(input.previousCount || input.previous_count),
						dom_count: boundedCount(input.domCount || input.dom_count),
						visible_count: boundedCount(input.visibleCount || input.visible_count),
						render_mode: context.render_mode || ""
					}
				}]
			});
		}
		function renderSuccess(input = {}, diagnosticType = "render_churn") {
			return runtimeSuccess(Object.assign({}, input, {
				diagnosticType,
				errorCode: diagnosticType,
				surface: "conversation-render",
				action: input.action || "render"
			}));
		}
		function threadListInteractionStallEvent(input = {}) {
			const maxRafDelayMs = boundedCount(input.maxRafDelayMs || input.max_raf_delay_ms);
			const maxScrollApplyMs = boundedCount(input.maxScrollApplyMs || input.max_scroll_apply_ms);
			const maxLongTaskMs = boundedCount(input.maxLongTaskMs || input.max_long_task_ms);
			const elapsedMs = boundedCount(input.elapsedMs || input.elapsed_ms);
			const maxDelayMs = Math.max(maxRafDelayMs, maxScrollApplyMs, maxLongTaskMs, elapsedMs);
			const context = baseContext(Object.assign({}, input, {
				surface: "thread-list-runtime",
				action: input.action || "thread-list-interaction"
			}));
			const errorCode = maxLongTaskMs >= Math.max(maxRafDelayMs, maxScrollApplyMs) ? "browser_main_thread_long_task" : "browser_thread_list_interaction_blocked";
			return runtimeEvent({
				diagnosticType: "thread_list_interaction_stall",
				severityHint: maxDelayMs >= boundedCount(input.h2ThresholdMs || input.h2_threshold_ms || 3e3) ? "H2" : "H3",
				evidenceConfidence: maxDelayMs >= 3e3 ? .86 : .74,
				errorCode,
				context,
				counts: {
					elapsed_ms: elapsedMs,
					raf_delay_ms: maxRafDelayMs,
					scroll_apply_ms: maxScrollApplyMs,
					long_task_ms: maxLongTaskMs,
					long_task_count: boundedCount(input.longTaskCount || input.long_task_count),
					thread_list_count: boundedCount(input.threadListCount || input.thread_list_count),
					thread_list_visible: boolCount(input.threadListVisible || input.thread_list_visible),
					thread_list_monitorable: boolCount(input.threadListMonitorable || input.thread_list_monitorable),
					scroll_top: boundedCount(input.scrollTop || input.scroll_top),
					scroll_height: boundedCount(input.scrollHeight || input.scroll_height)
				},
				breadcrumbs: [{
					kind: "thread-list-runtime",
					code: errorCode,
					status: "blocked",
					fields: {
						elapsed_ms: elapsedMs,
						raf_delay_ms: maxRafDelayMs,
						scroll_apply_ms: maxScrollApplyMs,
						long_task_ms: maxLongTaskMs,
						long_task_count: boundedCount(input.longTaskCount || input.long_task_count),
						thread_list_count: boundedCount(input.threadListCount || input.thread_list_count)
					}
				}]
			});
		}
		function threadListInteractionStallEffects(input = {}) {
			const minDelayMs = boundedCount(input.minDelayMs || input.min_delay_ms || 1e3) || 1e3;
			const maxDelayMs = Math.max(boundedCount(input.maxRafDelayMs || input.max_raf_delay_ms), boundedCount(input.maxScrollApplyMs || input.max_scroll_apply_ms), boundedCount(input.maxLongTaskMs || input.max_long_task_ms), boundedCount(input.elapsedMs || input.elapsed_ms));
			if (!input.threadListVisible && !input.threadListMonitorable) return {
				effects: [],
				reason: "thread-list-not-visible"
			};
			if (maxDelayMs < minDelayMs) return {
				effects: [],
				reason: "below-threshold"
			};
			return {
				effects: [{
					type: "diagnostic-failure",
					diagnostic: threadListInteractionStallEvent(input),
					diagnosticType: "thread_list_interaction_stall",
					reason: "thread-list-interaction-stall"
				}],
				reason: "thread-list-interaction-stall"
			};
		}
		function createMonitor(options = {}) {
			const now = typeof options.now === "function" ? options.now : () => Date.now();
			const windowMs = boundedCount(options.windowMs || DEFAULT_WINDOW_MS) || DEFAULT_WINDOW_MS;
			const fullRenderThreshold = boundedCount(options.fullRenderThreshold || 3) || 3;
			const fallbackThreshold = boundedCount(options.fallbackThreshold || 2) || 2;
			let samples = [];
			function trim(currentTime) {
				samples = samples.filter((entry) => currentTime - entry.at <= windowMs);
				return samples;
			}
			function recordRender(input = {}) {
				const currentTime = now();
				const source = input && typeof input === "object" ? input : {};
				const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
				const finalAction = compactToken(source.finalAction || source.final_action || renderMode, "", 80);
				const sample = {
					at: currentTime,
					fullRender: Boolean(source.fullRender || finalAction === "set-inner-html" || finalAction === "full-render"),
					fallbackApplied: Boolean(source.fallbackApplied || source.fallback_applied)
				};
				samples.push(sample);
				trim(currentTime);
				const renderCount = samples.length;
				const fullRenderCount = samples.filter((entry) => entry.fullRender).length;
				const fallbackCount = samples.filter((entry) => entry.fallbackApplied).length;
				const previousCount = boundedCount(source.previousCount || source.previous_count);
				const domCount = boundedCount(source.domCount || source.dom_count);
				const visibleCount = boundedCount(source.visibleCount || source.visible_count);
				const duplicateCount = boundedCount(source.duplicateCount || source.duplicate_count);
				const effects = [];
				if (previousCount >= 2 && visibleCount >= 2 && domCount <= 1 && domCount < previousCount) effects.push({
					type: "diagnostic-failure",
					diagnostic: domDropEvent(Object.assign({}, source, {
						renderCount,
						fullRenderCount,
						fallbackCount
					})),
					diagnosticType: "render_dom_drop",
					reason: "render-dom-drop"
				});
				else if (domCount >= Math.min(visibleCount || domCount, 2)) effects.push({
					type: "diagnostic-success",
					diagnostic: renderSuccess(source, "render_dom_drop"),
					diagnosticType: "render_dom_drop",
					reason: "render-dom-stable"
				});
				if (fullRenderCount >= fullRenderThreshold || fallbackCount >= fallbackThreshold) effects.push({
					type: "diagnostic-failure",
					diagnostic: renderChurnEvent(Object.assign({}, source, {
						renderCount,
						fullRenderCount,
						fallbackCount,
						previousCount,
						domCount,
						visibleCount,
						duplicateCount
					})),
					diagnosticType: "render_churn",
					reason: "render-churn"
				});
				else if (!sample.fullRender && !sample.fallbackApplied && duplicateCount === 0) effects.push({
					type: "diagnostic-success",
					diagnostic: renderSuccess(source, "render_churn"),
					diagnosticType: "render_churn",
					reason: "render-churn-stable"
				});
				return {
					effects,
					reason: effects.length ? "frontend-render-health-effects" : "render-observed",
					renderCount,
					fullRenderCount,
					fallbackCount
				};
			}
			function reset() {
				samples = [];
			}
			return {
				recordRender,
				reset,
				windowMs
			};
		}
		return {
			compactToken,
			createMonitor,
			submittedMessageDomMissingEvent,
			submittedMessageDomProbeEffects,
			submittedMessageDomSuccess,
			threadListInteractionStallEvent,
			threadListInteractionStallEffects,
			renderChurnEvent,
			domDropEvent,
			runtimeSuccess
		};
	});
}));
//#endregion
//#region public/home-ai-diagnostic-reporting.js
var require_home_ai_diagnostic_reporting = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexHomeAiDiagnosticReporting = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_THRESHOLD = 3;
		const DEFAULT_THROTTLE_MS = 300 * 1e3;
		const DEFAULT_SLOW_PATH_REPORT_MODE = "observe";
		const MAX_BREADCRUMBS = 6;
		const PLUGIN_ID = "codex-mobile";
		const SAFE_CONTEXT_KEYS = /* @__PURE__ */ new Set([
			"action",
			"app_server_deferred_reason",
			"app_server_request_reason",
			"build_id",
			"cache_id",
			"client_visibility",
			"cold_path_owner",
			"cold_path_reason",
			"diagnostic_source",
			"embedded",
			"fallback_cache_decision",
			"fallback_deferred_reason",
			"item_hash",
			"pluginId",
			"pwa",
			"read_mode",
			"render_mode",
			"render_plan_reason",
			"route_kind",
			"shell_cache",
			"sourceSurface",
			"source_kind",
			"patch_reject_reason",
			"performance_phase",
			"projection_partial_kind",
			"projection_source",
			"surface",
			"task_hash",
			"thread_hash",
			"turn_hash",
			"workspaceId"
		]);
		const SAFE_FIELD_KEYS = /* @__PURE__ */ new Set([
			"action",
			"app_server_deferred_reason",
			"app_server_request_reason",
			"api_status",
			"cold_path_owner",
			"cold_path_reason",
			"dom_count",
			"duplicate_count",
			"elapsed_ms",
			"api_elapsed_ms",
			"active_turn_count",
			"completed_turn_count",
			"raf_delay_ms",
			"item_hash",
			"item_kind",
			"item_count",
			"latest_mismatch_count",
			"long_task_count",
			"long_task_ms",
			"missing_count",
			"order_mismatch_count",
			"patch_reject_reason",
			"previous_count",
			"projection_partial",
			"projection_partial_kind",
			"projection_source",
			"read_mode",
			"render_elapsed_ms",
			"render_mode",
			"render_plan_reason",
			"fallback_cache_decision",
			"fallback_deferred_reason",
			"repeated_failures",
			"route_kind",
			"server_count",
			"source_kind",
			"status_code",
			"scroll_apply_ms",
			"scroll_height",
			"scroll_top",
			"task_hash",
			"threshold_ms",
			"thread_list_count",
			"thread_hash",
			"turn_count",
			"turn_hash",
			"older_cursor",
			"newer_cursor",
			"omitted_turns",
			"visible_count"
		]);
		const SAFE_PATH_LABEL_KEYS = /* @__PURE__ */ new Set(["cold_path_owner", "cold_path_reason"]);
		const UNSAFE_KEY_PATTERN = /(body|content|cookie|file|href|key|launch|log|message|path|payload|prompt|raw|secret|text|title|token|url)/i;
		function stableTextHash(value) {
			const text = String(value || "");
			let hash = 2166136261;
			for (let index = 0; index < text.length; index += 1) {
				hash ^= text.charCodeAt(index);
				hash = Math.imul(hash, 16777619);
			}
			return (hash >>> 0).toString(36);
		}
		function hashIdentifier(value, prefix = "h") {
			const text = String(value || "").trim();
			return text ? `${prefix}_${stableTextHash(text)}` : "";
		}
		function boundedToken(value, fallback = "unknown", maxLength = 80) {
			return String(value || "").trim().replace(/[^a-zA-Z0-9_.:-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, maxLength) || fallback;
		}
		function boundedNumber(value, fallback = 0) {
			const number = Number(value);
			if (!Number.isFinite(number)) return fallback;
			return Math.max(0, Math.round(number));
		}
		function durationBucket(value) {
			const ms = Number(value || 0);
			if (!Number.isFinite(ms) || ms <= 0) return "";
			if (ms < 1e3) return "lt_1s";
			if (ms < 3e3) return "1_3s";
			if (ms < 1e4) return "3_10s";
			if (ms < 3e4) return "10_30s";
			return "30s_plus";
		}
		function safeCounts(counts) {
			const out = {};
			if (!counts || typeof counts !== "object" || Array.isArray(counts)) return out;
			for (const [key, value] of Object.entries(counts)) {
				if (UNSAFE_KEY_PATTERN.test(key)) continue;
				const safeKey = boundedToken(key, "", 60);
				if (!safeKey) continue;
				if (typeof value === "boolean") out[safeKey] = value ? 1 : 0;
				else if (Number.isFinite(Number(value))) out[safeKey] = boundedNumber(value);
			}
			return out;
		}
		function safeFields(fields, allowedKeys = SAFE_FIELD_KEYS) {
			const out = {};
			if (!fields || typeof fields !== "object" || Array.isArray(fields)) return out;
			for (const [key, value] of Object.entries(fields)) {
				if (!allowedKeys.has(key) || UNSAFE_KEY_PATTERN.test(key) && !SAFE_PATH_LABEL_KEYS.has(key)) continue;
				if (typeof value === "boolean") out[key] = value;
				else if (Number.isFinite(Number(value)) && !/_hash$/.test(key)) out[key] = boundedNumber(value);
				else {
					const safe = boundedToken(value, "", 120);
					if (safe) out[key] = safe;
				}
			}
			return out;
		}
		function safeContext(context) {
			const out = Object.assign({}, {
				pluginId: PLUGIN_ID,
				sourceSurface: "embedded-plugin"
			});
			const input = context && typeof context === "object" && !Array.isArray(context) ? context : {};
			for (const [key, value] of Object.entries(input)) {
				if (!SAFE_CONTEXT_KEYS.has(key) || UNSAFE_KEY_PATTERN.test(key) && !SAFE_PATH_LABEL_KEYS.has(key)) continue;
				if (typeof value === "boolean") out[key] = value;
				else if (Number.isFinite(Number(value)) && !/_hash$/.test(key)) out[key] = boundedNumber(value);
				else {
					const safe = boundedToken(value, "", 160);
					if (safe) out[key] = safe;
				}
			}
			out.pluginId = PLUGIN_ID;
			out.sourceSurface = "embedded-plugin";
			return out;
		}
		function safeBreadcrumbs(breadcrumbs) {
			if (!Array.isArray(breadcrumbs)) return [];
			return breadcrumbs.slice(0, MAX_BREADCRUMBS).map((entry) => {
				const input = entry && typeof entry === "object" ? entry : {};
				const out = {
					kind: boundedToken(input.kind, "runtime", 80),
					code: boundedToken(input.code, "unknown", 80),
					status: boundedToken(input.status, "failed", 40)
				};
				const bucket = boundedToken(input.duration_bucket || input.durationBucket || "", "", 40);
				if (bucket) out.duration_bucket = bucket;
				const fields = safeFields(input.fields || {});
				if (Object.keys(fields).length) out.fields = fields;
				return out;
			});
		}
		function safeSeverity(value) {
			const text = String(value || "").trim().toUpperCase();
			return text === "H1" || text === "H2" || text === "H3" ? text : "H2";
		}
		function safeConfidence(value) {
			const number = Number(value);
			if (!Number.isFinite(number)) return .7;
			return Math.max(0, Math.min(1, Math.round(number * 100) / 100));
		}
		function sanitizeInput(input = {}) {
			const category = boundedToken(input.category, "codex_runtime_failure", 80);
			const diagnosticType = boundedToken(input.diagnostic_type || input.diagnosticType, category, 80);
			const errorCode = boundedToken(input.error_code || input.errorCode, `${diagnosticType}_failed`, 100);
			const context = safeContext(input.context || {});
			const counts = safeCounts(input.counts || {});
			const breadcrumbs = safeBreadcrumbs(input.breadcrumbs || []);
			const bucket = boundedToken(input.duration_bucket || input.durationBucket || durationBucket(input.durationMs), "", 40);
			return {
				category,
				diagnostic_type: diagnosticType,
				severity_hint: safeSeverity(input.severity_hint || input.severityHint),
				evidence_confidence: safeConfidence(input.evidence_confidence || input.evidenceConfidence),
				error_code: errorCode,
				duration_bucket: bucket,
				counts,
				context,
				breadcrumbs
			};
		}
		function isSlowPathEvent(event) {
			return event && event.category === "thread_session_slow_path" && /_slow_path$/.test(event.diagnostic_type || "");
		}
		function clearKeyFor(event) {
			if (isSlowPathEvent(event)) return [
				event.category,
				event.diagnostic_type,
				event.context.surface || "",
				event.context.route_kind || ""
			].join("|");
			return [
				event.category,
				event.diagnostic_type,
				event.context.surface || "",
				event.context.action || "",
				event.context.route_kind || "",
				event.context.thread_hash || "",
				event.context.task_hash || "",
				event.context.item_hash || ""
			].join("|");
		}
		function signatureFor(event) {
			if (isSlowPathEvent(event)) return [clearKeyFor(event), event.error_code].join("|");
			return [
				clearKeyFor(event),
				event.error_code,
				event.context.build_id || "",
				event.context.read_mode || "",
				event.context.render_mode || "",
				event.context.source_kind || ""
			].join("|");
		}
		function reportFor(event, repeatedFailures) {
			const counts = Object.assign({}, event.counts, { repeated_failures: boundedNumber(repeatedFailures, 1) });
			const breadcrumbs = event.breadcrumbs.length ? event.breadcrumbs : [{
				kind: event.context.surface || event.category,
				code: event.error_code,
				status: "failed",
				fields: safeFields({
					repeated_failures: repeatedFailures,
					thread_hash: event.context.thread_hash || "",
					task_hash: event.context.task_hash || "",
					item_hash: event.context.item_hash || ""
				})
			}];
			return {
				type: "homeai.diagnostic.report",
				version: 1,
				pluginId: PLUGIN_ID,
				category: event.category,
				diagnostic_type: event.diagnostic_type,
				severity_hint: event.severity_hint,
				evidence_confidence: event.evidence_confidence,
				error_code: event.error_code,
				duration_bucket: event.duration_bucket || void 0,
				counts,
				context: event.context,
				breadcrumbs
			};
		}
		function normalizeSlowPathReportMode(options = {}) {
			const mode = String(options.slowPathReportMode || "").trim().toLowerCase();
			if (mode === "report" || mode === "post") return "report";
			if (mode === "observe" || mode === "local" || mode === "off") return "observe";
			if (options.reportSlowPath === true || options.allowSlowPathReports === true) return "report";
			return DEFAULT_SLOW_PATH_REPORT_MODE;
		}
		function createDiagnosticReporter(options = {}) {
			const threshold = Math.max(1, Number(options.threshold || DEFAULT_THRESHOLD) || DEFAULT_THRESHOLD);
			const throttleMs = Math.max(0, Number(options.throttleMs || DEFAULT_THROTTLE_MS) || DEFAULT_THROTTLE_MS);
			const slowPathReportMode = normalizeSlowPathReportMode(options);
			const now = typeof options.now === "function" ? options.now : () => Date.now();
			const failures = /* @__PURE__ */ new Map();
			const lastReportedAt = /* @__PURE__ */ new Map();
			function recordFailure(input) {
				const event = sanitizeInput(input || {});
				const signature = signatureFor(event);
				const clearKey = clearKeyFor(event);
				const previous = failures.get(signature);
				const count = (previous && previous.count ? previous.count : 0) + 1;
				failures.set(signature, {
					count,
					clearKey,
					lastAt: now()
				});
				if (isSlowPathEvent(event) && slowPathReportMode !== "report") return {
					eligible: false,
					report: null,
					repeatedFailures: count,
					signature,
					clearKey,
					threshold,
					observeOnly: true,
					reason: "slow_path_observe_only"
				};
				const lastReportAt = Number(lastReportedAt.get(signature) || 0);
				if (!(count >= threshold && (!lastReportAt || now() - lastReportAt >= throttleMs))) return {
					eligible: false,
					report: null,
					repeatedFailures: count,
					signature,
					clearKey,
					threshold,
					observeOnly: false,
					reason: "below_threshold_or_throttled"
				};
				lastReportedAt.set(signature, now());
				return {
					eligible: true,
					report: reportFor(event, count),
					repeatedFailures: count,
					signature,
					clearKey,
					threshold,
					observeOnly: false,
					reason: "eligible"
				};
			}
			function recordSuccess(input) {
				const event = sanitizeInput(input || {});
				if (isSlowPathEvent(event)) return {
					cleared: 0,
					clearKey: clearKeyFor(event),
					reason: "slow-path-rolling-window"
				};
				const clearKey = clearKeyFor(event);
				let cleared = 0;
				for (const [signature, entry] of failures.entries()) if (entry && entry.clearKey === clearKey) {
					failures.delete(signature);
					cleared += 1;
				}
				return {
					cleared,
					clearKey
				};
			}
			function failureCount(input) {
				const signature = signatureFor(sanitizeInput(input || {}));
				const entry = failures.get(signature);
				return entry ? entry.count : 0;
			}
			return {
				failureCount,
				recordFailure,
				recordSuccess,
				threshold,
				throttleMs,
				slowPathReportMode
			};
		}
		function postReportToHomeAi(options = {}) {
			const report = options.report;
			const parentWindow = options.parentWindow;
			const selfWindow = options.selfWindow || null;
			if (!options.embedded) return {
				ok: false,
				reason: "not_embedded"
			};
			if (!report || report.type !== "homeai.diagnostic.report") return {
				ok: false,
				reason: "invalid_report"
			};
			if (!parentWindow || selfWindow && parentWindow === selfWindow) return {
				ok: false,
				reason: "missing_parent"
			};
			try {
				parentWindow.postMessage(report, options.targetOrigin || "*");
				return {
					ok: true,
					reason: "posted"
				};
			} catch (_) {
				return {
					ok: false,
					reason: "post_failed"
				};
			}
		}
		return {
			DEFAULT_THRESHOLD,
			DEFAULT_THROTTLE_MS,
			DEFAULT_SLOW_PATH_REPORT_MODE,
			boundedToken,
			createDiagnosticReporter,
			durationBucket,
			hashIdentifier,
			postReportToHomeAi,
			sanitizeInput,
			stableTextHash
		};
	});
}));
//#endregion
//#region public/thread-diagnostic-events.js
var require_thread_diagnostic_events = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadDiagnosticEvents = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const MAX_COUNT = 1e5;
		function compactToken(value, fallback = "", maxLength = 80) {
			return String(value || "").trim().replace(/[^a-zA-Z0-9_.:-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, maxLength) || fallback;
		}
		function boundedCount(value) {
			const number = Number(value);
			if (!Number.isFinite(number) || number < 0) return 0;
			return Math.min(MAX_COUNT, Math.trunc(number));
		}
		function boundedRolloutMb(value) {
			const number = Number(value);
			if (!Number.isFinite(number) || number <= 0) return 0;
			return boundedCount(Math.ceil(number / (1024 * 1024)));
		}
		function boundedPayloadKb(value) {
			const number = Number(value);
			if (!Number.isFinite(number) || number <= 0) return 0;
			return boundedCount(Math.ceil(number / 1024));
		}
		function projectionDiagnosticContext(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const out = {
				surface: compactToken(source.surface, "conversation-render", 80),
				action: compactToken(source.action, "render", 80)
			};
			const routeKind = compactToken(source.route_kind || source.routeKind, "", 80);
			const readMode = compactToken(source.read_mode || source.readMode, "", 80);
			const renderMode = compactToken(source.render_mode || source.renderMode, "", 80);
			const threadHash = compactToken(source.thread_hash || source.threadHash, "", 80);
			const turnHash = compactToken(source.turn_hash || source.turnHash, "", 80);
			if (routeKind) out.route_kind = routeKind;
			if (readMode) out.read_mode = readMode;
			if (renderMode) out.render_mode = renderMode;
			if (threadHash) out.thread_hash = threadHash;
			if (turnHash) out.turn_hash = turnHash;
			return out;
		}
		function projectionDiagnosticCounts(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const out = {
				dom_count: boundedCount(source.dom_count || source.domCount),
				duplicate_count: boundedCount(source.duplicate_count || source.duplicateCount),
				visible_count: boundedCount(source.visible_count || source.visibleCount),
				turn_count: boundedCount(source.turn_count || source.turnCount)
			};
			const paneCount = boundedCount(source.pane_count || source.paneCount);
			if (paneCount) out.pane_count = paneCount;
			const orderMismatchCount = boundedCount(source.order_mismatch_count || source.orderMismatchCount);
			if (orderMismatchCount) out.order_mismatch_count = orderMismatchCount;
			const latestMismatchCount = boundedCount(source.latest_mismatch_count || source.latestMismatchCount);
			if (latestMismatchCount) out.latest_mismatch_count = latestMismatchCount;
			const missingDomTurnCount = boundedCount(source.missing_dom_turn_count || source.missingDomTurnCount);
			if (missingDomTurnCount) out.missing_dom_turn_count = missingDomTurnCount;
			return out;
		}
		function projectionDiagnosticSnapshot(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			return {
				renderedSignature: String(source.renderedSignature || ""),
				currentSignature: String(source.currentSignature || ""),
				context: projectionDiagnosticContext(source.context || {}),
				counts: projectionDiagnosticCounts(source.counts || {})
			};
		}
		function visibleShapeFrom(deps, thread) {
			if (typeof deps.visibleShape === "function") {
				const shape = deps.visibleShape(thread);
				if (shape && typeof shape === "object") return shape;
			}
			return {
				visibleTurnCount: 0,
				visibleItemCount: 0
			};
		}
		function domCountsFromShape(domShape = {}) {
			return {
				dom_count: domShape.renderKeyCount || domShape.dom_count || domShape.domCount,
				duplicate_count: domShape.duplicateRenderKeyCount || domShape.duplicate_count || domShape.duplicateCount
			};
		}
		function conversationProjectionDiagnosticSnapshot(input = {}, deps = {}) {
			const source = input && typeof input === "object" ? input : {};
			const action = compactToken(source.source || source.action, "render", 80);
			const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
			const renderedSignature = String(source.renderedConversationSignature || source.renderedSignature || "");
			const baseCounts = domCountsFromShape(source.domShape && typeof source.domShape === "object" ? source.domShape : {});
			const tileMode = source.threadTileMode === true;
			const tileDomActive = source.tileDomActive === true;
			if (tileMode) {
				if (!tileDomActive) return null;
				const layout = source.tileLayout || (typeof deps.tileLayout === "function" ? deps.tileLayout() : null);
				if (!layout || !layout.enabled) return null;
				const ids = Array.isArray(source.tileIds) ? source.tileIds : typeof deps.tileCandidateIds === "function" ? deps.tileCandidateIds(layout) : [];
				if (!ids.length) return null;
				const displayLayout = source.tileDisplayLayout || (typeof deps.tileDisplayLayout === "function" ? deps.tileDisplayLayout(layout, ids) : layout);
				const currentSignature = source.tileSignature || source.currentSignature || (typeof deps.tileRenderSignature === "function" ? deps.tileRenderSignature(displayLayout, ids) : "");
				const visibleShape = ids.reduce((acc, id) => {
					const shape = visibleShapeFrom(deps, typeof deps.tileThreadForId === "function" ? deps.tileThreadForId(id) : null);
					acc.visibleTurnCount += boundedCount(shape.visibleTurnCount);
					acc.visibleItemCount += boundedCount(shape.visibleItemCount);
					return acc;
				}, {
					visibleTurnCount: 0,
					visibleItemCount: 0
				});
				return projectionDiagnosticSnapshot({
					renderedSignature,
					currentSignature,
					context: {
						surface: "conversation-render",
						action,
						route_kind: "thread-tile",
						read_mode: "mixed",
						render_mode: renderMode
					},
					counts: Object.assign({}, baseCounts, {
						visible_count: visibleShape.visibleItemCount,
						turn_count: visibleShape.visibleTurnCount,
						pane_count: ids.length
					})
				});
			}
			if (tileDomActive) return null;
			const thread = source.thread || null;
			const visibleShape = visibleShapeFrom(deps, thread);
			return projectionDiagnosticSnapshot({
				renderedSignature,
				currentSignature: source.currentSignature || (typeof deps.singleSignature === "function" ? deps.singleSignature(thread) : ""),
				context: {
					surface: "conversation-render",
					action,
					read_mode: thread && thread.mobileReadMode || "",
					render_mode: renderMode
				},
				counts: Object.assign({}, baseCounts, {
					visible_count: visibleShape.visibleItemCount,
					turn_count: visibleShape.visibleTurnCount
				})
			});
		}
		function turnOrderDiagnosticSnapshot(input = {}, deps = {}) {
			const source = input && typeof input === "object" ? input : {};
			const expectedIds = Array.isArray(source.expectedTurnIds) ? source.expectedTurnIds.map((id) => String(id || "")).filter(Boolean) : [];
			const domIds = Array.isArray(source.domTurnIds) ? source.domTurnIds.map((id) => String(id || "")).filter(Boolean) : [];
			if (!expectedIds.length) return null;
			const comparableCount = Math.min(expectedIds.length, domIds.length);
			let orderMismatchCount = Math.abs(expectedIds.length - domIds.length);
			for (let index = 0; index < comparableCount; index += 1) if (expectedIds[index] !== domIds[index]) orderMismatchCount += 1;
			const expectedLatestId = expectedIds[expectedIds.length - 1] || "";
			const domLatestId = domIds[domIds.length - 1] || "";
			const latestMismatch = Boolean(expectedLatestId && (!domLatestId || expectedLatestId !== domLatestId));
			const turnHash = compactToken(source.turnHash || (typeof deps.turnHash === "function" ? deps.turnHash(expectedLatestId) : ""), "", 80);
			return projectionDiagnosticSnapshot({
				context: {
					surface: "conversation-render",
					action: source.source || source.action,
					read_mode: source.readMode || source.read_mode,
					render_mode: source.renderMode || source.render_mode,
					thread_hash: source.threadHash || source.thread_hash,
					turn_hash: turnHash
				},
				counts: {
					dom_count: domIds.length,
					visible_count: expectedIds.length,
					turn_count: expectedIds.length,
					order_mismatch_count: orderMismatchCount,
					latest_mismatch_count: latestMismatch ? 1 : 0,
					missing_dom_turn_count: !domIds.length ? expectedIds.length : 0
				}
			});
		}
		function hasRenderSignatureMismatch(snapshot) {
			const normalized = projectionDiagnosticSnapshot(snapshot);
			return Boolean(normalized.renderedSignature && normalized.renderedSignature !== normalized.currentSignature);
		}
		function hasDuplicateRenderKeys(snapshot) {
			return projectionDiagnosticSnapshot(snapshot).counts.duplicate_count > 0;
		}
		function hasTurnOrderMismatch(snapshot) {
			const counts = projectionDiagnosticSnapshot(snapshot).counts;
			return counts.order_mismatch_count > 0 || counts.latest_mismatch_count > 0 || counts.missing_dom_turn_count > 0;
		}
		function renderSignatureMismatchDiagnosticEvent(snapshot = {}) {
			const normalized = projectionDiagnosticSnapshot(snapshot);
			const context = normalized.context;
			const counts = normalized.counts;
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "render_signature_mismatch",
				severity_hint: "H2",
				evidence_confidence: .74,
				error_code: "render_signature_mismatch",
				context,
				counts,
				breadcrumbs: [{
					kind: "conversation-render",
					code: "signature-check",
					status: "failed",
					fields: {
						read_mode: context.read_mode || "",
						render_mode: context.render_mode || "",
						dom_count: counts.dom_count,
						visible_count: counts.visible_count
					}
				}]
			};
		}
		function renderSignatureMismatchDiagnosticSuccess(snapshot = {}) {
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "render_signature_mismatch",
				error_code: "render_signature_mismatch",
				context: projectionDiagnosticSnapshot(snapshot).context
			};
		}
		function duplicateRenderKeysDiagnosticEvent(snapshot = {}) {
			const normalized = projectionDiagnosticSnapshot(snapshot);
			const counts = normalized.counts;
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "duplicate_render_keys",
				severity_hint: "H2",
				evidence_confidence: .78,
				error_code: "duplicate_render_keys",
				context: normalized.context,
				counts,
				breadcrumbs: [{
					kind: "conversation-render",
					code: "render-key-check",
					status: "failed",
					fields: {
						duplicate_count: counts.duplicate_count,
						dom_count: counts.dom_count,
						visible_count: counts.visible_count
					}
				}]
			};
		}
		function duplicateRenderKeysDiagnosticSuccess(snapshot = {}) {
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "duplicate_render_keys",
				error_code: "duplicate_render_keys",
				context: projectionDiagnosticSnapshot(snapshot).context
			};
		}
		function turnOrderMismatchDiagnosticEvent(snapshot = {}) {
			const normalized = projectionDiagnosticSnapshot(snapshot);
			const counts = normalized.counts;
			const context = normalized.context;
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "turn_order_mismatch",
				severity_hint: "H2",
				evidence_confidence: .82,
				error_code: "turn_order_mismatch",
				context,
				counts,
				breadcrumbs: [{
					kind: "conversation-render",
					code: "turn-order-check",
					status: "failed",
					fields: {
						read_mode: context.read_mode || "",
						render_mode: context.render_mode || "",
						dom_count: counts.dom_count,
						visible_count: counts.visible_count,
						turn_hash: context.turn_hash || "",
						order_mismatch_count: counts.order_mismatch_count || 0,
						latest_mismatch_count: counts.latest_mismatch_count || 0,
						missing_dom_turn_count: counts.missing_dom_turn_count || 0
					}
				}]
			};
		}
		function turnOrderMismatchDiagnosticSuccess(snapshot = {}) {
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "turn_order_mismatch",
				error_code: "turn_order_mismatch",
				context: projectionDiagnosticSnapshot(snapshot).context
			};
		}
		function conversationProjectionConsistencyEffects(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const snapshot = source.snapshot || null;
			const orderSnapshot = source.orderSnapshot || null;
			const effects = [];
			if (snapshot) {
				const normalized = projectionDiagnosticSnapshot(snapshot);
				const signatureMismatch = hasRenderSignatureMismatch(normalized);
				effects.push({
					type: signatureMismatch ? "diagnostic-failure" : "diagnostic-success",
					diagnostic: signatureMismatch ? renderSignatureMismatchDiagnosticEvent(normalized) : renderSignatureMismatchDiagnosticSuccess(normalized),
					diagnosticType: "render_signature_mismatch",
					reason: signatureMismatch ? "render-signature-mismatch" : "render-signature-match"
				});
				const duplicateKeys = hasDuplicateRenderKeys(normalized);
				effects.push({
					type: duplicateKeys ? "diagnostic-failure" : "diagnostic-success",
					diagnostic: duplicateKeys ? duplicateRenderKeysDiagnosticEvent(normalized) : duplicateRenderKeysDiagnosticSuccess(normalized),
					diagnosticType: "duplicate_render_keys",
					reason: duplicateKeys ? "duplicate-render-keys" : "no-duplicate-render-keys"
				});
			}
			if (orderSnapshot) {
				const normalizedOrder = projectionDiagnosticSnapshot(orderSnapshot);
				const turnOrderMismatch = hasTurnOrderMismatch(normalizedOrder);
				effects.push({
					type: turnOrderMismatch ? "diagnostic-failure" : "diagnostic-success",
					diagnostic: turnOrderMismatch ? turnOrderMismatchDiagnosticEvent(normalizedOrder) : turnOrderMismatchDiagnosticSuccess(normalizedOrder),
					diagnosticType: "turn_order_mismatch",
					reason: turnOrderMismatch ? "turn-order-mismatch" : "turn-order-match"
				});
			}
			return {
				effects,
				reason: effects.length ? "projection-consistency-effects" : "no-snapshot"
			};
		}
		function primaryShellSelectionConflictContext(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = {
				surface: "conversation-render",
				action: compactToken(source.action, "primary-shell-selection", 80),
				route_kind: compactToken(source.routeKind || source.route_kind, "embedded-primary", 80)
			};
			const readMode = compactToken(source.readMode || source.read_mode, "", 80);
			const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
			const sourceKind = compactToken(source.sourceKind || source.source_kind, "", 80);
			const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
			if (readMode) context.read_mode = readMode;
			if (renderMode) context.render_mode = renderMode;
			if (sourceKind) context.source_kind = sourceKind;
			if (threadHash) context.thread_hash = threadHash;
			return context;
		}
		function primaryShellSelectionConflictCounts(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			return {
				visible_count: boundedCount(source.visibleItems || source.visible_count),
				turn_count: boundedCount(source.turns || source.turn_count),
				item_count: boundedCount(source.items || source.item_count),
				dom_count: boundedCount(source.domCount || source.dom_count),
				previous_count: boundedCount(source.previousCount || source.previous_count),
				has_current_thread: source.hasCurrentThread || source.has_current_thread ? 1 : 0,
				has_current_thread_id: source.hasCurrentThreadId || source.has_current_thread_id ? 1 : 0,
				has_thread_load_controller: source.hasThreadLoadController || source.has_thread_load_controller ? 1 : 0,
				startup_thread_open_pending: source.startupThreadOpenPending || source.startup_thread_open_pending ? 1 : 0,
				mobile_loading: source.mobileLoading || source.mobile_loading ? 1 : 0,
				recent_detail_age_ms: boundedCount(source.recentDetailAgeMs || source.recent_detail_age_ms)
			};
		}
		function primaryShellSelectionConflictDiagnosticEvent(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = primaryShellSelectionConflictContext(source);
			const counts = primaryShellSelectionConflictCounts(source);
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "primary_shell_selection_conflict",
				severity_hint: "H2",
				evidence_confidence: .82,
				error_code: compactToken(source.reason, "primary_shell_selection_conflict", 80),
				context,
				counts,
				breadcrumbs: [{
					kind: "conversation-render",
					code: "primary-shell-selection",
					status: "failed",
					fields: {
						read_mode: context.read_mode || "",
						render_mode: context.render_mode || "",
						source_kind: context.source_kind || "",
						thread_hash: context.thread_hash || "",
						dom_count: counts.dom_count,
						visible_count: counts.visible_count,
						turn_count: counts.turn_count,
						item_count: counts.item_count,
						previous_count: counts.previous_count
					}
				}]
			};
		}
		function primaryShellSelectionConflictDiagnosticSuccess(input = {}) {
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "primary_shell_selection_conflict",
				error_code: "primary_shell_selection_conflict",
				context: primaryShellSelectionConflictContext(input)
			};
		}
		function emptyVisibleDetailMismatchContext(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = {
				surface: "conversation-render",
				action: compactToken(source.action, "single-thread-empty-state", 80),
				route_kind: compactToken(source.routeKind || source.route_kind, "single-thread", 80)
			};
			const readMode = compactToken(source.readMode || source.read_mode, "", 80);
			const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
			const sourceKind = compactToken(source.sourceKind || source.source_kind, "", 80);
			const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
			if (readMode) context.read_mode = readMode;
			if (renderMode) context.render_mode = renderMode;
			if (sourceKind) context.source_kind = sourceKind;
			if (threadHash) context.thread_hash = threadHash;
			return context;
		}
		function emptyVisibleDetailMismatchCounts(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			return {
				visible_count: boundedCount(source.visibleItems || source.visible_count),
				turn_count: boundedCount(source.turns || source.turn_count),
				item_count: boundedCount(source.items || source.item_count),
				current_visible_count: boundedCount(source.currentVisibleItems || source.current_visible_count),
				current_turn_count: boundedCount(source.currentTurns || source.current_turn_count),
				dom_count: boundedCount(source.domCount || source.dom_count),
				previous_count: boundedCount(source.previousCount || source.previous_count),
				detail_loaded: source.detailLoaded || source.detail_loaded ? 1 : 0,
				mobile_loading: source.mobileLoading || source.mobile_loading ? 1 : 0,
				recent_detail_age_ms: boundedCount(source.recentDetailAgeMs || source.recent_detail_age_ms)
			};
		}
		function emptyVisibleDetailMismatchDiagnosticEvent(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = emptyVisibleDetailMismatchContext(source);
			const counts = emptyVisibleDetailMismatchCounts(source);
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "empty_visible_detail_mismatch",
				severity_hint: "H2",
				evidence_confidence: .84,
				error_code: compactToken(source.reason, "empty_visible_detail_mismatch", 80),
				context,
				counts,
				breadcrumbs: [{
					kind: "conversation-render",
					code: "empty-state-contract",
					status: "failed",
					fields: {
						read_mode: context.read_mode || "",
						render_mode: context.render_mode || "",
						source_kind: context.source_kind || "",
						thread_hash: context.thread_hash || "",
						visible_count: counts.visible_count,
						turn_count: counts.turn_count,
						item_count: counts.item_count,
						dom_count: counts.dom_count,
						previous_count: counts.previous_count
					}
				}]
			};
		}
		function emptyVisibleDetailMismatchDiagnosticSuccess(input = {}) {
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "empty_visible_detail_mismatch",
				error_code: "empty_visible_detail_mismatch",
				context: emptyVisibleDetailMismatchContext(input)
			};
		}
		function emptyCachedDetailReuseContext(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = {
				surface: "thread-session",
				action: compactToken(source.action, "thread-open-cache-reuse", 80),
				route_kind: compactToken(source.routeKind || source.route_kind, "single-thread", 80)
			};
			const readMode = compactToken(source.readMode || source.read_mode, "", 80);
			const sourceKind = compactToken(source.sourceKind || source.source_kind, "", 80);
			const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
			if (readMode) context.read_mode = readMode;
			if (sourceKind) context.source_kind = sourceKind;
			if (threadHash) context.thread_hash = threadHash;
			return context;
		}
		function emptyCachedDetailReuseCounts(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			return {
				current_turn_count: boundedCount(source.currentTurns || source.current_turn_count),
				current_visible_count: boundedCount(source.currentVisibleItems || source.current_visible_count),
				item_count: boundedCount(source.items || source.item_count),
				detail_loaded: source.detailLoaded || source.detail_loaded ? 1 : 0,
				reusable_detail: source.reusableDetail || source.reusable_detail ? 1 : 0,
				mobile_loading: source.mobileLoading || source.mobile_loading ? 1 : 0,
				thread_task_card_count: boundedCount(source.threadTaskCardCount || source.thread_task_card_count)
			};
		}
		function emptyCachedDetailReuseBlockedDiagnosticEvent(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = emptyCachedDetailReuseContext(source);
			const counts = emptyCachedDetailReuseCounts(source);
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "empty_cached_detail_reuse_blocked",
				severity_hint: "H2",
				evidence_confidence: .8,
				error_code: compactToken(source.reason, "empty_cached_detail_reuse_blocked", 80),
				context,
				counts,
				breadcrumbs: [{
					kind: "thread-session",
					code: "thread-open-cache-reuse",
					status: "blocked",
					fields: {
						read_mode: context.read_mode || "",
						source_kind: context.source_kind || "",
						thread_hash: context.thread_hash || "",
						current_turn_count: counts.current_turn_count,
						current_visible_count: counts.current_visible_count,
						item_count: counts.item_count,
						detail_loaded: counts.detail_loaded,
						reusable_detail: counts.reusable_detail
					}
				}]
			};
		}
		function emptyCachedDetailReuseDiagnosticSuccess(input = {}) {
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "empty_cached_detail_reuse_blocked",
				error_code: "empty_cached_detail_reuse_blocked",
				context: emptyCachedDetailReuseContext(input)
			};
		}
		function detailPatchRejectedDiagnosticEvent(input = {}) {
			const readMode = compactToken(input.readMode, "", 80);
			const renderMode = compactToken(input.renderMode, "", 80);
			const renderPlanReason = compactToken(input.renderPlanReason, "", 80);
			const patchRejectReason = compactToken(input.patchRejectReason, "unknown", 80);
			const previousCount = boundedCount(input.previousVisibleItemCount);
			const visibleCount = boundedCount(input.visibleItemCount);
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "detail_patch_rejected",
				severity_hint: "H3",
				evidence_confidence: .7,
				error_code: "detail_patch_rejected",
				context: {
					surface: "conversation-render",
					action: "thread-detail-refresh",
					read_mode: readMode,
					render_mode: renderMode,
					render_plan_reason: renderPlanReason,
					patch_reject_reason: patchRejectReason
				},
				counts: {
					previous_count: previousCount,
					visible_count: visibleCount
				},
				breadcrumbs: [{
					kind: "conversation-render",
					code: "detail-patch",
					status: "rejected",
					fields: {
						read_mode: readMode,
						render_mode: renderMode,
						render_plan_reason: renderPlanReason,
						patch_reject_reason: patchRejectReason,
						visible_count: visibleCount
					}
				}]
			};
		}
		function threadDetailRefreshFailedDiagnosticEvent(input = {}) {
			const threadHash = compactToken(input.threadHash, "", 80);
			const errorCode = compactToken(input.errorCode, "thread_detail_refresh_failed", 80);
			const durationBucket = compactToken(input.durationBucket, "", 80);
			const statusCode = boundedCount(input.statusCode);
			return {
				category: "thread_session_load_failed",
				diagnostic_type: "thread_detail_refresh_failed",
				severity_hint: "H2",
				evidence_confidence: .74,
				error_code: errorCode,
				duration_bucket: durationBucket,
				context: {
					surface: "thread-session",
					action: "thread-detail-refresh",
					thread_hash: threadHash
				},
				counts: { status_code: statusCode },
				breadcrumbs: [{
					kind: "thread-session",
					code: "thread-detail-refresh",
					status: "failed",
					duration_bucket: durationBucket,
					fields: {
						status_code: statusCode,
						thread_hash: threadHash
					}
				}]
			};
		}
		function threadDetailLoadFailedDiagnosticEvent(input = {}) {
			const threadHash = compactToken(input.threadHash, "", 80);
			const errorCode = compactToken(input.errorCode, "thread_detail_load_failed", 80);
			const durationBucket = compactToken(input.durationBucket, "", 80);
			const statusCode = boundedCount(input.statusCode);
			return {
				category: "thread_session_load_failed",
				diagnostic_type: "thread_detail_load_failed",
				severity_hint: "H2",
				evidence_confidence: .76,
				error_code: errorCode,
				duration_bucket: durationBucket,
				context: {
					surface: "thread-session",
					action: "thread-detail-load",
					thread_hash: threadHash
				},
				counts: { status_code: statusCode },
				breadcrumbs: [{
					kind: "thread-session",
					code: "thread-detail-load",
					status: "failed",
					duration_bucket: durationBucket,
					fields: {
						status_code: statusCode,
						thread_hash: threadHash
					}
				}]
			};
		}
		function threadDetailSlowPathDiagnosticEvent(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const action = compactToken(source.action, "thread-detail", 80);
			const reason = compactToken(source.reason, "elapsed-slow", 80);
			const readMode = compactToken(source.readMode || source.read_mode, "", 80);
			const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
			const performancePhase = compactToken(source.performancePhase || source.performance_phase, "", 80);
			const coldPathOwner = compactToken(source.coldPathOwner || source.cold_path_owner, "", 80);
			const coldPathReason = compactToken(source.coldPathReason || source.cold_path_reason, "", 80);
			const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
			const durationBucket = compactToken(source.durationBucket || source.duration_bucket, "", 80);
			const counts = {
				elapsed_ms: boundedCount(source.elapsedMs || source.elapsed_ms),
				api_elapsed_ms: boundedCount(source.apiElapsedMs || source.api_elapsed_ms),
				render_elapsed_ms: boundedCount(source.renderElapsedMs || source.render_elapsed_ms),
				threshold_ms: boundedCount(source.thresholdMs || source.threshold_ms),
				turn_count: boundedCount(source.turns || source.turn_count),
				visible_count: boundedCount(source.visibleItems || source.visible_count),
				omitted_turns: boundedCount(source.omittedTurns || source.omitted_turns)
			};
			const rolloutMb = boundedRolloutMb(source.rolloutSizeBytes || source.rollout_size_bytes);
			if (rolloutMb) counts.rollout_mb = rolloutMb;
			const context = {
				surface: "thread-session",
				action
			};
			if (threadHash) context.thread_hash = threadHash;
			if (readMode) context.read_mode = readMode;
			if (renderMode) context.render_mode = renderMode;
			if (performancePhase) context.performance_phase = performancePhase;
			if (coldPathOwner) context.cold_path_owner = coldPathOwner;
			if (coldPathReason) context.cold_path_reason = coldPathReason;
			return {
				category: "thread_session_slow_path",
				diagnostic_type: "thread_detail_slow_path",
				severity_hint: compactToken(source.severityHint || source.severity_hint, "H3", 8),
				evidence_confidence: .7,
				error_code: reason,
				duration_bucket: durationBucket,
				context,
				counts,
				breadcrumbs: [{
					kind: "thread-session",
					code: "thread-detail-slow-path",
					status: "slow",
					duration_bucket: durationBucket,
					fields: {
						read_mode: readMode,
						render_mode: renderMode,
						performance_phase: performancePhase,
						cold_path_owner: coldPathOwner,
						cold_path_reason: coldPathReason,
						elapsed_ms: counts.elapsed_ms,
						api_elapsed_ms: counts.api_elapsed_ms,
						render_elapsed_ms: counts.render_elapsed_ms,
						threshold_ms: counts.threshold_ms,
						thread_hash: threadHash
					}
				}]
			};
		}
		function threadDetailSlowPathDiagnosticSuccess(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = {
				surface: "thread-session",
				action: compactToken(source.action, "thread-detail", 80)
			};
			const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
			if (threadHash) context.thread_hash = threadHash;
			const readMode = compactToken(source.readMode || source.read_mode, "", 80);
			if (readMode) context.read_mode = readMode;
			const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
			if (renderMode) context.render_mode = renderMode;
			return {
				category: "thread_session_slow_path",
				diagnostic_type: "thread_detail_slow_path",
				error_code: "thread_detail_slow_path",
				context
			};
		}
		function threadListSlowPathDiagnosticEvent(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const action = compactToken(source.action, "thread-list-load", 80);
			const reason = compactToken(source.reason, "elapsed-slow", 80);
			const performancePhase = compactToken(source.performancePhase || source.performance_phase, "", 80);
			const coldPathOwner = compactToken(source.coldPathOwner || source.cold_path_owner, "", 80);
			const coldPathReason = compactToken(source.coldPathReason || source.cold_path_reason, "", 80);
			const fallbackCacheDecision = compactToken(source.fallbackCacheDecision || source.fallback_cache_decision, "", 80);
			const fallbackDeferredReason = compactToken(source.fallbackDeferredReason || source.fallback_deferred_reason, "", 80);
			const appServerDeferredReason = compactToken(source.appServerDeferredReason || source.app_server_deferred_reason, "", 80);
			const appServerRequestReason = compactToken(source.appServerRequestReason || source.app_server_request_reason, "", 80);
			const durationBucket = compactToken(source.durationBucket || source.duration_bucket, "", 80);
			const counts = {
				elapsed_ms: boundedCount(source.elapsedMs || source.elapsed_ms),
				api_elapsed_ms: boundedCount(source.apiElapsedMs || source.api_elapsed_ms),
				render_elapsed_ms: boundedCount(source.renderElapsedMs || source.render_elapsed_ms),
				threshold_ms: boundedCount(source.thresholdMs || source.threshold_ms),
				result_count: boundedCount(source.count || source.result_count),
				server_total_ms: boundedCount(source.totalMs || source.total_ms),
				app_server_ms: boundedCount(source.appServerMs || source.app_server_ms),
				app_server_rpc_ms: boundedCount(source.appServerRpcMs || source.app_server_rpc_ms),
				app_server_unattributed_ms: boundedCount(source.appServerUnattributedMs || source.app_server_unattributed_ms),
				fallback_ms: boundedCount(source.fallbackMs || source.fallback_ms),
				merge_ms: boundedCount(source.mergeMs || source.merge_ms),
				summary_merge_ms: boundedCount(source.summaryMergeTotalMs || source.summary_merge_ms),
				fallback_snapshot_age_ms: boundedCount(source.fallbackSourceSnapshotAgeMs || source.fallback_snapshot_age_ms),
				fallback_rollout_stat_count: boundedCount(source.fallbackRolloutFileStatCount || source.fallback_rollout_stat_count),
				fallback_rollout_head_read_count: boundedCount(source.fallbackRolloutHeadReadCount || source.fallback_rollout_head_read_count),
				fallback_rollout_summary_read_count: boundedCount(source.fallbackRolloutSummaryReadCount || source.fallback_rollout_summary_read_count),
				app_server_request_limit: boundedCount(source.appServerRequestLimit || source.app_server_request_limit),
				app_server_response_kb: boundedCount(source.appServerResponsePayloadKb || source.app_server_response_kb) || boundedPayloadKb(source.appServerResponsePayloadBytes || source.app_server_response_bytes),
				silent: source.silent || source.is_silent ? 1 : 0,
				has_search: source.hasSearch || source.has_search ? 1 : 0,
				has_workspace: source.hasWorkspace || source.has_workspace ? 1 : 0,
				mobile_fallback: source.mobileFallback || source.mobile_fallback ? 1 : 0
			};
			const context = {
				surface: "thread-session",
				action
			};
			if (performancePhase) context.performance_phase = performancePhase;
			if (coldPathOwner) context.cold_path_owner = coldPathOwner;
			if (coldPathReason) context.cold_path_reason = coldPathReason;
			if (fallbackCacheDecision) context.fallback_cache_decision = fallbackCacheDecision;
			if (fallbackDeferredReason) context.fallback_deferred_reason = fallbackDeferredReason;
			if (appServerDeferredReason) context.app_server_deferred_reason = appServerDeferredReason;
			if (appServerRequestReason) context.app_server_request_reason = appServerRequestReason;
			return {
				category: "thread_session_slow_path",
				diagnostic_type: "thread_list_slow_path",
				severity_hint: compactToken(source.severityHint || source.severity_hint, "H3", 8),
				evidence_confidence: .7,
				error_code: reason,
				duration_bucket: durationBucket,
				context,
				counts,
				breadcrumbs: [{
					kind: "thread-session",
					code: "thread-list-slow-path",
					status: "slow",
					duration_bucket: durationBucket,
					fields: {
						performance_phase: performancePhase,
						cold_path_owner: coldPathOwner,
						cold_path_reason: coldPathReason,
						fallback_cache_decision: fallbackCacheDecision,
						app_server_request_reason: appServerRequestReason,
						elapsed_ms: counts.elapsed_ms,
						api_elapsed_ms: counts.api_elapsed_ms,
						render_elapsed_ms: counts.render_elapsed_ms,
						threshold_ms: counts.threshold_ms,
						result_count: counts.result_count
					}
				}]
			};
		}
		function threadListSlowPathDiagnosticSuccess(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = {
				surface: "thread-session",
				action: compactToken(source.action, "thread-list-load", 80)
			};
			const performancePhase = compactToken(source.performancePhase || source.performance_phase, "", 80);
			if (performancePhase) context.performance_phase = performancePhase;
			return {
				category: "thread_session_slow_path",
				diagnostic_type: "thread_list_slow_path",
				error_code: "thread_list_slow_path",
				context
			};
		}
		function threadDetailResponseContractDiagnosticContext(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = {
				surface: "thread-session",
				action: compactToken(source.action, "thread-detail", 80)
			};
			const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
			const readMode = compactToken(source.readMode || source.read_mode, "", 80);
			const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
			const performancePhase = compactToken(source.performancePhase || source.performance_phase, "", 80);
			const projectionSource = compactToken(source.projectionSource || source.projection_source, "", 80);
			const projectionPartialKind = compactToken(source.projectionPartialKind || source.projection_partial_kind, "", 80);
			if (threadHash) context.thread_hash = threadHash;
			if (readMode) context.read_mode = readMode;
			if (renderMode) context.render_mode = renderMode;
			if (performancePhase) context.performance_phase = performancePhase;
			if (projectionSource) context.projection_source = projectionSource;
			if (projectionPartialKind) context.projection_partial_kind = projectionPartialKind;
			return context;
		}
		function threadDetailResponseContractCounts(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const out = {
				turn_count: boundedCount(source.turns || source.turn_count),
				item_count: boundedCount(source.items || source.item_count),
				visible_count: boundedCount(source.visibleItems || source.visible_count),
				active_turn_count: boundedCount(source.activeTurns || source.active_turn_count),
				completed_turn_count: boundedCount(source.completedTurns || source.completed_turn_count),
				omitted_turns: boundedCount(source.omittedTurns || source.omitted_turns),
				older_cursor: source.olderCursor || source.older_cursor ? 1 : 0,
				newer_cursor: source.newerCursor || source.newer_cursor ? 1 : 0,
				projection_partial: source.projectionPartial || source.projection_partial ? 1 : 0,
				response_budget_applied: source.responseBudgetApplied || source.response_budget_applied ? 1 : 0,
				response_budget_progressive_active: source.responseBudgetProgressiveActiveApplied || source.response_budget_progressive_active ? 1 : 0,
				response_budget_active_turn_count: boundedCount(source.responseBudgetActiveTurnCount || source.response_budget_active_turn_count),
				response_budget_retained_item_count: boundedCount(source.responseBudgetRetainedItemCount || source.response_budget_retained_item_count)
			};
			const rolloutMb = boundedRolloutMb(source.rolloutSizeBytes || source.rollout_size_bytes);
			if (rolloutMb) out.rollout_mb = rolloutMb;
			return out;
		}
		function threadDetailResponseContractDiagnosticEvent(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const reason = compactToken(source.reason, "thread-detail-response-contract", 80);
			const context = threadDetailResponseContractDiagnosticContext(source);
			const counts = threadDetailResponseContractCounts(source);
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "thread_detail_response_contract_mismatch",
				severity_hint: compactToken(source.severityHint || source.severity_hint, "H2", 8),
				evidence_confidence: .82,
				error_code: reason,
				duration_bucket: compactToken(source.durationBucket || source.duration_bucket, "", 80),
				context,
				counts,
				breadcrumbs: [{
					kind: "thread-session",
					code: "thread-detail-response-contract",
					status: "failed",
					fields: {
						read_mode: context.read_mode || "",
						render_mode: context.render_mode || "",
						performance_phase: context.performance_phase || "",
						projection_source: context.projection_source || "",
						projection_partial_kind: context.projection_partial_kind || "",
						turn_count: counts.turn_count,
						item_count: counts.item_count,
						visible_count: counts.visible_count,
						active_turn_count: counts.active_turn_count,
						older_cursor: counts.older_cursor,
						newer_cursor: counts.newer_cursor,
						projection_partial: counts.projection_partial,
						response_budget_applied: counts.response_budget_applied,
						response_budget_progressive_active: counts.response_budget_progressive_active,
						response_budget_active_turn_count: counts.response_budget_active_turn_count,
						response_budget_retained_item_count: counts.response_budget_retained_item_count,
						thread_hash: context.thread_hash || ""
					}
				}]
			};
		}
		function threadDetailResponseContractDiagnosticSuccess(input = {}) {
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "thread_detail_response_contract_mismatch",
				error_code: "thread_detail_response_contract_mismatch",
				context: threadDetailResponseContractDiagnosticContext(input)
			};
		}
		function threadDetailResponseDiagnosticEffects(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const effects = [];
			const slowPlan = source.slowPlan && typeof source.slowPlan === "object" ? source.slowPlan : null;
			if (slowPlan) {
				const shouldReport = slowPlan.shouldReport === true;
				effects.push({
					type: shouldReport ? "diagnostic-failure" : "diagnostic-success",
					diagnostic: shouldReport ? threadDetailSlowPathDiagnosticEvent(slowPlan) : threadDetailSlowPathDiagnosticSuccess(source.slowSuccessInput || {}),
					diagnosticType: "thread_detail_slow_path",
					reason: shouldReport ? compactToken(slowPlan.reason, "thread-detail-slow-path", 80) : "thread-detail-slow-path-ok"
				});
			}
			const contractPlan = source.contractPlan && typeof source.contractPlan === "object" ? source.contractPlan : null;
			if (contractPlan) {
				const shouldReport = contractPlan.shouldReport === true;
				effects.push({
					type: shouldReport ? "diagnostic-failure" : "diagnostic-success",
					diagnostic: shouldReport ? threadDetailResponseContractDiagnosticEvent(contractPlan) : threadDetailResponseContractDiagnosticSuccess(contractPlan),
					diagnosticType: "thread_detail_response_contract_mismatch",
					reason: shouldReport ? compactToken(contractPlan.reason, "thread-detail-response-contract", 80) : "thread-detail-response-contract-ok"
				});
			}
			return {
				effects,
				reason: effects.length ? "thread-detail-response-diagnostic-effects" : "no-diagnostic-plans"
			};
		}
		return {
			boundedCount,
			compactToken,
			detailPatchRejectedDiagnosticEvent,
			duplicateRenderKeysDiagnosticEvent,
			duplicateRenderKeysDiagnosticSuccess,
			emptyCachedDetailReuseBlockedDiagnosticEvent,
			emptyCachedDetailReuseDiagnosticSuccess,
			emptyVisibleDetailMismatchDiagnosticEvent,
			emptyVisibleDetailMismatchDiagnosticSuccess,
			hasDuplicateRenderKeys,
			hasRenderSignatureMismatch,
			hasTurnOrderMismatch,
			conversationProjectionDiagnosticSnapshot,
			conversationProjectionConsistencyEffects,
			primaryShellSelectionConflictDiagnosticEvent,
			primaryShellSelectionConflictDiagnosticSuccess,
			projectionDiagnosticContext,
			projectionDiagnosticCounts,
			projectionDiagnosticSnapshot,
			renderSignatureMismatchDiagnosticEvent,
			renderSignatureMismatchDiagnosticSuccess,
			threadDetailResponseContractDiagnosticEvent,
			threadDetailResponseDiagnosticEffects,
			threadDetailResponseContractDiagnosticSuccess,
			threadDetailLoadFailedDiagnosticEvent,
			threadDetailSlowPathDiagnosticEvent,
			threadDetailSlowPathDiagnosticSuccess,
			threadListSlowPathDiagnosticEvent,
			threadListSlowPathDiagnosticSuccess,
			turnOrderDiagnosticSnapshot,
			threadDetailRefreshFailedDiagnosticEvent,
			turnOrderMismatchDiagnosticEvent,
			turnOrderMismatchDiagnosticSuccess
		};
	});
}));
//#endregion
//#region public/thread-tile-layout.js
var require_thread_tile_layout = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadTileLayout = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_MIN_DESKTOP_PANE_WIDTH = 420;
		const DEFAULT_MIN_DESKTOP_MANUAL_PANE_WIDTH = 300;
		const DEFAULT_MIN_TABLET_PANE_WIDTH = 260;
		const DEFAULT_MIN_LANDSCAPE_VIEWPORT_WIDTH = 760;
		const DEFAULT_MIN_PANE_HEIGHT = 360;
		const DEFAULT_MIN_LANDSCAPE_VIEWPORT_HEIGHT = 480;
		const DEFAULT_MAX_PANES = 6;
		const DEFAULT_USER_MAX_PANES = 12;
		function positiveNumber(value, fallback = 0) {
			const parsed = Number(value);
			return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
		}
		function clampInteger(value, min, max) {
			const parsed = Math.floor(positiveNumber(value, min));
			return Math.max(min, Math.min(max, parsed));
		}
		function viewportOrientation(width, height) {
			return positiveNumber(width) >= positiveNumber(height) ? "landscape" : "portrait";
		}
		function layoutForViewport(input = {}) {
			const enabled = input.enabled === true;
			const viewportWidth = positiveNumber(input.viewportWidth);
			const viewportHeight = positiveNumber(input.viewportHeight);
			const sidebarWidth = Math.max(0, Number(input.sidebarWidth || 0) || 0);
			const coarsePointer = input.coarsePointer === true;
			const orientation = String(input.orientation || viewportOrientation(viewportWidth, viewportHeight));
			const minLandscapeViewportWidth = positiveNumber(input.minLandscapeViewportWidth, DEFAULT_MIN_LANDSCAPE_VIEWPORT_WIDTH);
			const minLandscapeViewportHeight = positiveNumber(input.minLandscapeViewportHeight, DEFAULT_MIN_LANDSCAPE_VIEWPORT_HEIGHT);
			const landscapeTile = orientation === "landscape" && viewportWidth >= minLandscapeViewportWidth && viewportHeight >= minLandscapeViewportHeight;
			const menuOverlay = input.menuOverlay === true;
			const tabletLandscape = landscapeTile && (coarsePointer || menuOverlay);
			const maxPanes = clampInteger(input.maxPanes || DEFAULT_MAX_PANES, 1, DEFAULT_USER_MAX_PANES);
			const recommendedMaxPanes = clampInteger(input.recommendedMaxPanes || DEFAULT_MAX_PANES, 1, maxPanes);
			const desiredPaneCount = Math.max(0, Math.min(maxPanes, Math.floor(Number(input.desiredPaneCount || 0)) || 0));
			if (!enabled || viewportWidth <= 0 || viewportHeight <= 0) return {
				enabled: false,
				reason: "disabled",
				columns: 1,
				rows: 1,
				maxPanes: 1,
				recommendedMaxPanes: 1
			};
			if (coarsePointer && orientation !== "landscape") return {
				enabled: false,
				reason: "tablet-portrait",
				columns: 1,
				rows: 1,
				maxPanes: 1,
				recommendedMaxPanes: 1
			};
			if (menuOverlay && !tabletLandscape) return {
				enabled: false,
				reason: "narrow",
				columns: 1,
				rows: 1,
				maxPanes: 1,
				recommendedMaxPanes: 1
			};
			const availableWidth = Math.max(0, viewportWidth - (menuOverlay ? 0 : sidebarWidth));
			const availableHeight = Math.max(0, viewportHeight - Math.max(0, Number(input.verticalChromePx || 0) || 0));
			const manualTargetWidth = desiredPaneCount > 0 && availableWidth > 0 ? Math.floor(availableWidth / desiredPaneCount) : 0;
			const defaultMinPaneWidth = tabletLandscape ? DEFAULT_MIN_TABLET_PANE_WIDTH : desiredPaneCount > 0 ? Math.min(DEFAULT_MIN_DESKTOP_PANE_WIDTH, Math.max(DEFAULT_MIN_DESKTOP_MANUAL_PANE_WIDTH, manualTargetWidth)) : DEFAULT_MIN_DESKTOP_PANE_WIDTH;
			const minPaneWidth = positiveNumber(input.minPaneWidth, defaultMinPaneWidth);
			const minPaneHeight = positiveNumber(input.minPaneHeight, DEFAULT_MIN_PANE_HEIGHT);
			const rawColumns = Math.floor(availableWidth / minPaneWidth);
			const rawRows = Math.floor(availableHeight / minPaneHeight);
			const minimumColumns = tabletLandscape ? 2 : 2;
			const columns = Math.max(minimumColumns, Math.min(tabletLandscape ? Math.min(4, maxPanes) : maxPanes, rawColumns || 0));
			if (columns < minimumColumns || availableWidth < minPaneWidth * minimumColumns * .86) return {
				enabled: false,
				reason: "insufficient-width",
				columns: 1,
				rows: 1,
				maxPanes: 1,
				recommendedMaxPanes: 1,
				availableWidth,
				availableHeight
			};
			const rows = Math.max(1, Math.min(tabletLandscape ? 1 : 2, rawRows || 1));
			return {
				enabled: true,
				reason: tabletLandscape ? "tablet-landscape" : "wide",
				columns,
				rows,
				maxPanes: Math.max(1, Math.min(maxPanes, columns * rows)),
				recommendedMaxPanes: Math.max(1, Math.min(recommendedMaxPanes, columns * rows)),
				availableWidth,
				availableHeight,
				minPaneWidth,
				minPaneHeight
			};
		}
		function uniqueThreadIds(values = []) {
			const seen = /* @__PURE__ */ new Set();
			const ids = [];
			for (const value of values || []) {
				const id = String(value || "").trim();
				if (!id || seen.has(id)) continue;
				seen.add(id);
				ids.push(id);
			}
			return ids;
		}
		function selectThreadTileIds(input = {}) {
			const maxPanes = clampInteger(input.maxPanes || 1, 1, 12);
			return uniqueThreadIds([
				input.currentThreadId,
				...Array.isArray(input.pinnedThreadIds) ? input.pinnedThreadIds : [],
				...Array.isArray(input.threadIds) ? input.threadIds : []
			]).slice(0, maxPanes);
		}
		function selectPinnedThreadTileIds(input = {}) {
			const maxPanes = clampInteger(input.maxPanes || 1, 1, 12);
			const currentThreadId = String(input.currentThreadId || "").trim();
			const ids = uniqueThreadIds([...Array.isArray(input.pinnedThreadIds) ? input.pinnedThreadIds : [], ...Array.isArray(input.threadIds) ? input.threadIds : []]).slice(0, maxPanes);
			if (!currentThreadId || ids.includes(currentThreadId)) return ids;
			if (ids.length >= maxPanes) ids[Math.max(0, maxPanes - 1)] = currentThreadId;
			else ids.push(currentThreadId);
			return uniqueThreadIds(ids).slice(0, maxPanes);
		}
		function normalizeSplitPairs(values = [], ids = []) {
			const idSet = new Set(uniqueThreadIds(ids));
			const used = /* @__PURE__ */ new Set();
			const pairs = [];
			for (const value of Array.isArray(values) ? values : []) {
				const anchorId = String(Array.isArray(value) ? value[0] : value && (value.anchorId || value.topId || value.primaryId) || "").trim();
				const childId = String(Array.isArray(value) ? value[1] : value && (value.childId || value.bottomId || value.secondaryId) || "").trim();
				if (!anchorId || !childId || anchorId === childId) continue;
				if (idSet.size && (!idSet.has(anchorId) || !idSet.has(childId))) continue;
				if (used.has(anchorId) || used.has(childId)) continue;
				used.add(anchorId);
				used.add(childId);
				pairs.push({
					anchorId,
					childId
				});
			}
			return pairs;
		}
		function threadTileColumnGroups(input = {}) {
			const ids = uniqueThreadIds(input.ids || input.threadIds || []);
			const columns = clampInteger(input.columns || 1, 1, DEFAULT_USER_MAX_PANES);
			if (!ids.length) return [];
			const pairs = normalizeSplitPairs(input.splitPairs || input.paneSplitPairs || [], ids);
			const pairByAnchor = new Map(pairs.map((pair) => [pair.anchorId, pair.childId]));
			const childIds = new Set(pairs.map((pair) => pair.childId));
			const atomicGroups = [];
			for (const id of ids) {
				if (childIds.has(id)) continue;
				const childId = pairByAnchor.get(id);
				atomicGroups.push(childId ? [id, childId] : [id]);
			}
			const targetColumns = Math.max(1, Math.min(columns, atomicGroups.length));
			const groups = atomicGroups.slice(0, targetColumns).map((group) => group.slice());
			atomicGroups.slice(targetColumns).forEach((group, index) => {
				const targetIndex = Math.max(0, targetColumns - 1 - index % targetColumns);
				groups[targetIndex].push(...group);
			});
			return groups.filter((group) => group.length);
		}
		return {
			DEFAULT_MAX_PANES,
			DEFAULT_USER_MAX_PANES,
			DEFAULT_MIN_DESKTOP_MANUAL_PANE_WIDTH,
			DEFAULT_MIN_DESKTOP_PANE_WIDTH,
			DEFAULT_MIN_LANDSCAPE_VIEWPORT_WIDTH,
			DEFAULT_MIN_LANDSCAPE_VIEWPORT_HEIGHT,
			DEFAULT_MIN_PANE_HEIGHT,
			DEFAULT_MIN_TABLET_PANE_WIDTH,
			layoutForViewport,
			normalizeSplitPairs,
			selectPinnedThreadTileIds,
			selectThreadTileIds,
			threadTileColumnGroups
		};
	});
}));
//#endregion
//#region public/thread-tile-actions.js
var require_thread_tile_actions = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadTileActions = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const TILE_CONTROL_SELECTOR = [
			"[data-thread-tile-switch-target]",
			".thread-tile-switch-menu",
			"[data-thread-tile-bottom]",
			"[data-thread-tile-operation-toggle]",
			"[data-thread-tile-pane-count]",
			"[data-thread-tile-close-pane]"
		].join(", ");
		function withinRoot(root, node) {
			if (!root || !node || typeof root.contains !== "function") return true;
			return root.contains(node);
		}
		function closestWithin(target, selector, root = null) {
			if (!target || typeof target.closest !== "function") return null;
			const node = target.closest(selector);
			if (!node || !withinRoot(root, node)) return null;
			return node;
		}
		function attr(node, name) {
			if (!node || typeof node.getAttribute !== "function") return "";
			return String(node.getAttribute(name) || "");
		}
		function paneFor(node, root = null) {
			return closestWithin(node, "[data-thread-tile-pane]", root);
		}
		function paneIdFor(node, root = null) {
			return attr(paneFor(node, root), "data-thread-tile-pane");
		}
		function action(type, target, fields = {}) {
			return Object.assign({
				action: String(type || "none"),
				target: target || null,
				preventDefault: false,
				stopPropagation: false
			}, fields);
		}
		function resolveThreadTilePointerAction(input = {}) {
			const target = input.target || null;
			const root = input.root || null;
			const title = closestWithin(target, "[data-thread-tile-title]", root);
			if (title) return action("select-pane", title, {
				paneId: paneIdFor(title, root),
				source: "title"
			});
			const control = closestWithin(target, TILE_CONTROL_SELECTOR, root);
			if (control) return action("stop-control", control, { stopPropagation: true });
			const pane = closestWithin(target, "[data-thread-tile-pane]", root);
			if (pane) return action("select-pane", pane, {
				paneId: attr(pane, "data-thread-tile-pane"),
				source: "pane"
			});
			return action("none", null, { reason: "no-match" });
		}
		function resolveThreadTileFocusAction(input = {}) {
			const target = input.target || null;
			const root = input.root || null;
			const ignored = closestWithin(target, "[data-thread-tile-title], [data-thread-tile-switch-target], .thread-tile-switch-menu", root);
			if (ignored) return action("none", ignored, { reason: "ignored-control" });
			const pane = closestWithin(target, "[data-thread-tile-pane]", root);
			if (pane) return action("select-pane", pane, {
				paneId: attr(pane, "data-thread-tile-pane"),
				source: "focus"
			});
			return action("none", null, { reason: "no-match" });
		}
		function resolveThreadTileClickAction(input = {}) {
			const target = input.target || null;
			const root = input.root || null;
			let node = closestWithin(target, "[data-thread-tile-title]", root);
			if (node) return action("toggle-switch-menu", node, {
				paneId: attr(node, "data-thread-tile-title"),
				preventDefault: true,
				stopPropagation: true
			});
			node = closestWithin(target, "[data-thread-tile-switch-target]", root);
			if (node) return action("switch-pane-thread", node, {
				fromId: paneIdFor(node, root),
				toId: attr(node, "data-thread-tile-switch-target"),
				preventDefault: true,
				stopPropagation: true
			});
			node = closestWithin(target, "[data-thread-tile-pane-count]", root);
			if (node) return action("change-pane-count", node, {
				delta: Number(attr(node, "data-thread-tile-pane-count") || 0),
				disabled: Boolean(node.disabled),
				preventDefault: true,
				stopPropagation: true
			});
			node = closestWithin(target, "[data-thread-tile-close-pane]", root);
			if (node) return action("close-pane", node, {
				paneId: attr(node, "data-thread-tile-close-pane"),
				disabled: Boolean(node.disabled),
				preventDefault: true,
				stopPropagation: true
			});
			node = closestWithin(target, "[data-thread-tile-bottom]", root);
			if (node) return action("scroll-pane-bottom", node, {
				paneId: attr(node, "data-thread-tile-bottom"),
				preventDefault: true
			});
			node = closestWithin(target, "[data-thread-tile-operation-toggle]", root);
			if (node) return action("toggle-operation", node, {
				paneId: attr(node, "data-thread-tile-operation-toggle"),
				preventDefault: true,
				stopPropagation: true
			});
			return action("none", null, { reason: "no-match" });
		}
		function resolveThreadTileScrollAction(input = {}) {
			const body = closestWithin(input.target || null, ".thread-tile-pane-body", input.root || null);
			if (body) return action("pane-scroll", body, { body });
			return action("none", null, { reason: "no-match" });
		}
		function resolveThreadTileDragStartAction(input = {}) {
			const handle = closestWithin(input.target || null, "[data-thread-tile-drag-handle]", input.root || null);
			if (!handle) return action("none", null, { reason: "no-handle" });
			const paneId = attr(handle, "data-thread-tile-drag-handle");
			if (!paneId) return action("none", handle, { reason: "missing-pane-id" });
			return action("drag-start", handle, {
				handle,
				paneId,
				pane: paneFor(handle, input.root || null)
			});
		}
		function resolveThreadTileDragOverAction(input = {}) {
			const root = input.root || null;
			const pane = closestWithin(input.target || null, "[data-thread-tile-pane]", root);
			const dragging = String(input.draggingId || "");
			const targetId = attr(pane, "data-thread-tile-pane");
			if (!dragging || !targetId || dragging === targetId || !pane) return action("none", pane, { reason: "invalid-drag-target" });
			return action("drag-over", pane, {
				pane,
				targetId,
				preventDefault: true
			});
		}
		function resolveThreadTileDragLeaveAction(input = {}) {
			const pane = closestWithin(input.target || null, "[data-thread-tile-pane]", input.root || null);
			if (pane) return action("drag-leave", pane, { pane });
			return action("none", null, { reason: "no-match" });
		}
		function resolveThreadTileDropAction(input = {}) {
			const root = input.root || null;
			const pane = closestWithin(input.target || null, "[data-thread-tile-pane]", root);
			const dragging = String(input.draggingId || input.transferId || "");
			const targetId = attr(pane, "data-thread-tile-pane");
			if (!dragging || !targetId || dragging === targetId || !pane) return action("none", pane, { reason: "invalid-drop-target" });
			return action("drop-pane", pane, {
				pane,
				draggingId: dragging,
				targetId,
				preventDefault: true,
				stopPropagation: true
			});
		}
		return {
			closestWithin,
			resolveThreadTilePointerAction,
			resolveThreadTileFocusAction,
			resolveThreadTileClickAction,
			resolveThreadTileScrollAction,
			resolveThreadTileDragStartAction,
			resolveThreadTileDragOverAction,
			resolveThreadTileDragLeaveAction,
			resolveThreadTileDropAction
		};
	});
}));
//#endregion
//#region public/thread-tile-state.js
var require_thread_tile_state = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadTileState = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_USER_MAX_PANES = 12;
		const DEFAULT_DETAIL_LOAD_MAX_CONCURRENT = 4;
		const DEFAULT_OPERATION_BUBBLE_MIN_VISIBLE_MS = 500;
		const DEFAULT_PANE_NEAR_BOTTOM_PX = 48;
		const DEFAULT_PANE_SCROLLABLE_DELTA_PX = 96;
		function text(value) {
			return String(value || "");
		}
		function nowValue(value) {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : Date.now();
		}
		function nonNegativeNumber(value, fallback = 0) {
			const parsed = Number(value);
			return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
		}
		function maxPaneLimit(maxPanes = DEFAULT_USER_MAX_PANES) {
			const parsed = Math.floor(Number(maxPanes));
			return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USER_MAX_PANES;
		}
		function normalizePaneCount(value, options = {}) {
			const fallback = Number.isFinite(Number(options.fallback)) ? Math.floor(Number(options.fallback)) : 0;
			const parsed = Math.floor(Number(value));
			if (!Number.isFinite(parsed)) return fallback;
			return Math.max(0, Math.min(maxPaneLimit(options.maxPanes), parsed));
		}
		function normalizePinnedIds(values = [], options = {}) {
			const seen = /* @__PURE__ */ new Set();
			const ids = [];
			const limit = Math.max(1, maxPaneLimit(options.maxPanes) * Math.max(1, Number(options.overflowMultiplier || 2) || 2));
			for (const value of Array.isArray(values) ? values : []) {
				const id = String(value || "").trim();
				if (!id || seen.has(id)) continue;
				seen.add(id);
				ids.push(id);
				if (ids.length >= limit) break;
			}
			return ids;
		}
		function uniqueIds(values = []) {
			const seen = /* @__PURE__ */ new Set();
			const ids = [];
			for (const value of Array.isArray(values) ? values : []) {
				const id = text(value).trim();
				if (!id || seen.has(id)) continue;
				seen.add(id);
				ids.push(id);
			}
			return ids;
		}
		function idsEqual(a = [], b = []) {
			if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
			return a.every((id, index) => String(id || "") === String(b[index] || ""));
		}
		function candidatePaneIdsPlan(input = {}, options = {}) {
			const maxPanes = Math.max(1, normalizePaneCount(input.maxPanes, {
				fallback: 1,
				maxPanes: options.maxPanes || DEFAULT_USER_MAX_PANES
			}) || 1);
			const defaultIds = uniqueIds(input.defaultIds || input.threadIds || []).slice(0, maxPanes);
			const visibleIds = new Set(uniqueIds(input.visibleIds || []));
			const pinnedIds = normalizePinnedIds(input.pinnedIds || input.threadTilePinnedIds || [], { maxPanes: options.maxPanes || DEFAULT_USER_MAX_PANES }).filter((id) => visibleIds.has(id));
			const currentThreadId = text(input.currentThreadId).trim();
			if (!pinnedIds.length) return {
				action: "candidate-pane-ids",
				reason: "defaults",
				ids: defaultIds,
				pinnedIds,
				defaultIds,
				maxPanes
			};
			if (typeof options.selectPinnedThreadTileIds === "function") return {
				action: "candidate-pane-ids",
				reason: "selector",
				ids: uniqueIds(options.selectPinnedThreadTileIds({
					currentThreadId,
					pinnedThreadIds: pinnedIds,
					threadIds: defaultIds,
					maxPanes
				})).slice(0, maxPanes),
				pinnedIds,
				defaultIds,
				maxPanes
			};
			const ids = uniqueIds([...pinnedIds, ...defaultIds]).slice(0, maxPanes);
			if (currentThreadId && !ids.includes(currentThreadId)) ids[Math.max(0, ids.length - 1)] = currentThreadId;
			return {
				action: "candidate-pane-ids",
				reason: "fallback",
				ids: uniqueIds(ids).slice(0, maxPanes),
				pinnedIds,
				defaultIds,
				maxPanes
			};
		}
		function paneCountStatePlan(input = {}, options = {}) {
			const maxPanes = maxPaneLimit(options.maxPanes || input.maxPanes || DEFAULT_USER_MAX_PANES);
			const capacity = Math.max(1, normalizePaneCount(input.capacity || input.layoutCapacity, {
				fallback: 1,
				maxPanes
			}) || 1);
			const candidateIds = uniqueIds(input.candidateIds || input.defaultIds || []).slice(0, capacity);
			const candidateCount = candidateIds.length;
			const maxCandidateIds = uniqueIds(input.maxCandidateIds || input.maximumCandidateIds || input.allCandidateIds || candidateIds);
			const maxCandidateCount = Math.max(1, Math.min(maxPanes, maxCandidateIds.length || candidateCount || 1));
			const runningSet = new Set(uniqueIds(input.runningIds || []));
			const currentThreadId = text(input.currentThreadId).trim();
			if (currentThreadId) runningSet.add(currentThreadId);
			const runningCount = runningSet.size;
			const explicitPaneCount = normalizePaneCount(Object.prototype.hasOwnProperty.call(input, "explicitPaneCount") ? input.explicitPaneCount : Object.prototype.hasOwnProperty.call(input, "paneCount") ? input.paneCount : input.threadTilePaneCount, {
				fallback: 0,
				maxPanes
			});
			let autoPaneCount = 1;
			if (candidateCount > 0) autoPaneCount = Math.max(1, Math.min(capacity, candidateCount, Math.max(capacity > 1 ? Math.min(2, candidateCount, capacity) : 1, runningCount)));
			return {
				action: "pane-count-state",
				reason: explicitPaneCount > 0 ? "explicit" : "auto",
				capacity,
				candidateIds,
				candidateCount,
				maxCandidateIds,
				maxCandidateCount,
				runningCount,
				explicitPaneCount,
				autoPaneCount,
				effectivePaneCount: explicitPaneCount > 0 ? Math.max(1, Math.min(maxCandidateCount, explicitPaneCount)) : Math.max(1, Math.min(capacity, candidateCount || 1, autoPaneCount)),
				minPaneCount: Math.min(capacity, candidateCount || 1) >= 2 ? 2 : 1,
				maxPaneCount: maxCandidateCount
			};
		}
		function layoutCapacity(input = {}, options = {}) {
			const maxPanes = maxPaneLimit(options.capacityMaxPanes || options.maxPanes || DEFAULT_USER_MAX_PANES);
			const value = Object.prototype.hasOwnProperty.call(input, "recommendedMaxPanes") ? input.recommendedMaxPanes : input.maxPanes;
			const parsed = Math.floor(Number(value || 1));
			return Math.max(1, Math.min(maxPanes, Number.isFinite(parsed) && parsed > 0 ? parsed : 1));
		}
		function viewportSize(value = {}) {
			return {
				width: Math.round(nonNegativeNumber(value && value.width, 0)),
				height: Math.round(nonNegativeNumber(value && value.height, 0))
			};
		}
		function threadTileViewportBaselinePlan(input = {}) {
			const layoutViewport = viewportSize(input.layoutViewport || input.viewport || {});
			const baseline = viewportSize(input.baseline || input.previousBaseline || {});
			const keyboardActive = input.keyboardActive === true;
			const hasBaseline = baseline.width > 0 && baseline.height > 0;
			if (!keyboardActive) return {
				action: "thread-tile-viewport-baseline",
				reason: "layout-viewport",
				keyboardActive,
				viewport: layoutViewport,
				nextBaseline: layoutViewport,
				updateBaseline: true
			};
			return {
				action: "thread-tile-viewport-baseline",
				reason: hasBaseline ? "keyboard-baseline" : "keyboard-layout-viewport",
				keyboardActive,
				viewport: hasBaseline ? baseline : layoutViewport,
				nextBaseline: hasBaseline ? baseline : layoutViewport,
				updateBaseline: false
			};
		}
		function threadTileVerticalChromePlan(input = {}, options = {}) {
			const keyboardActive = input.keyboardActive === true;
			const composerHeightPx = nonNegativeNumber(input.composerHeightPx, 0);
			const baselineComposerHeightPx = nonNegativeNumber(input.baselineComposerHeightPx, 0);
			const minChromePx = nonNegativeNumber(Object.prototype.hasOwnProperty.call(options, "minChromePx") ? options.minChromePx : input.minChromePx, 120);
			const extraChromePx = nonNegativeNumber(Object.prototype.hasOwnProperty.call(options, "extraChromePx") ? options.extraChromePx : input.extraChromePx, 64);
			const effectiveComposerHeightPx = keyboardActive && baselineComposerHeightPx ? baselineComposerHeightPx : composerHeightPx;
			return {
				action: "thread-tile-vertical-chrome",
				reason: keyboardActive ? baselineComposerHeightPx ? "keyboard-baseline" : "keyboard-composer" : "composer-baseline",
				keyboardActive,
				composerHeightPx: effectiveComposerHeightPx,
				nextComposerHeightBaselinePx: keyboardActive ? baselineComposerHeightPx : composerHeightPx || baselineComposerHeightPx || 0,
				updateBaseline: !keyboardActive,
				verticalChromePx: Math.max(minChromePx, effectiveComposerHeightPx + extraChromePx)
			};
		}
		function normalizeColumnGroups(values = []) {
			return (Array.isArray(values) ? values : []).map((group) => uniqueIds(Array.isArray(group) ? group : [])).filter((group) => group.length);
		}
		function paneDisplayLayoutPlan(input = {}, options = {}) {
			const layout = input.layout && typeof input.layout === "object" ? input.layout : input;
			const ids = uniqueIds(input.ids || input.threadIds || []);
			const effectivePaneCount = normalizePaneCount(Object.prototype.hasOwnProperty.call(input, "effectivePaneCount") ? input.effectivePaneCount : input.count, {
				fallback: 0,
				maxPanes: options.maxPanes
			});
			const count = Math.max(1, ids.length ? ids.length : effectivePaneCount || 1);
			const capacityColumns = Math.max(1, Math.floor(Number(layout && layout.columns || 1)) || 1);
			const columns = Math.max(1, Math.min(capacityColumns, count));
			const splitPairs = Array.isArray(input.splitPairs || input.paneSplitPairs) ? input.splitPairs || input.paneSplitPairs : [];
			const groupFn = typeof options.threadTileColumnGroups === "function" ? options.threadTileColumnGroups : null;
			const columnGroups = normalizeColumnGroups(groupFn ? groupFn({
				ids,
				columns,
				splitPairs
			}) : ids.slice(0, count).map((id) => [id]));
			const rows = Math.max(1, ...columnGroups.map((group) => group.length || 1));
			const displayLayout = Object.assign({}, layout, {
				capacityPanes: layoutCapacity(layout, options),
				visiblePanes: count,
				columns: Math.max(1, columnGroups.length || columns),
				rows,
				columnGroups
			});
			return {
				action: "pane-display-layout",
				reason: ids.length ? "thread-ids" : "count-only",
				count,
				capacityColumns,
				columns,
				rows,
				columnGroups,
				displayLayout
			};
		}
		function normalizeIdValuePairs(values = [], ids = []) {
			const idSet = new Set(uniqueIds(ids));
			return (Array.isArray(values) ? values : []).map((entry) => {
				if (Array.isArray(entry)) return [text(entry[0]).trim(), entry.length > 1 ? entry[1] : ""];
				if (entry && typeof entry === "object") return [text(entry.id || entry.threadId || entry.paneId).trim(), Object.prototype.hasOwnProperty.call(entry, "value") ? entry.value : Object.prototype.hasOwnProperty.call(entry, "signature") ? entry.signature : Object.prototype.hasOwnProperty.call(entry, "error") ? entry.error : ""];
				return ["", ""];
			}).filter((entry) => entry[0] && (!idSet.size || idSet.has(entry[0])));
		}
		function paneRenderSignaturePlan(input = {}, options = {}) {
			const layout = input.layout && typeof input.layout === "object" ? input.layout : {};
			const ids = uniqueIds(input.ids || input.threadIds || []);
			const idSet = new Set(ids);
			const signatureObject = {
				view: "thread-tiles",
				columns: layout.columns,
				rows: layout.rows,
				visiblePanes: layout.visiblePanes || ids.length,
				capacityPanes: layout.capacityPanes || layout.maxPanes,
				desiredPaneCount: normalizePaneCount(Object.prototype.hasOwnProperty.call(input, "desiredPaneCount") ? input.desiredPaneCount : input.paneCount, {
					fallback: 0,
					maxPanes: options.maxPanes
				}),
				columnGroups: normalizeColumnGroups(input.columnGroups || layout.columnGroups || []),
				splitPairs: Array.isArray(input.splitPairs || input.paneSplitPairs) ? input.splitPairs || input.paneSplitPairs : [],
				ids,
				selected: text(input.selectedThreadId || input.selected).trim(),
				loading: uniqueIds(input.loadingIds || input.loading || []).filter((id) => !idSet.size || idSet.has(id)),
				switchMenuPaneId: text(input.switchMenuPaneId).trim(),
				errors: normalizeIdValuePairs(input.errors || input.errorPairs || [], ids),
				operations: normalizeIdValuePairs(input.operations || input.operationSignatures || [], ids),
				threads: (Array.isArray(input.threadSignatures || input.threads) ? input.threadSignatures || input.threads : []).map((value) => String(value || ""))
			};
			return {
				action: "pane-render-signature",
				reason: ids.length ? "thread-ids" : "empty",
				ids,
				signatureObject,
				signature: JSON.stringify(signatureObject)
			};
		}
		function paneScrollMetrics(input = {}, options = {}) {
			const scrollHeight = nonNegativeNumber(input.scrollHeight);
			const clientHeight = nonNegativeNumber(input.clientHeight);
			const scrollTop = nonNegativeNumber(input.scrollTop);
			const nearBottomPx = nonNegativeNumber(options.nearBottomPx || input.nearBottomPx, DEFAULT_PANE_NEAR_BOTTOM_PX);
			const distanceFromBottom = Math.max(0, scrollHeight - clientHeight - scrollTop);
			return {
				action: "pane-scroll-metrics",
				distanceFromBottom,
				nearBottom: distanceFromBottom <= nearBottomPx,
				hold: input.hold === true,
				scrollHeight,
				clientHeight,
				scrollTop,
				nearBottomPx
			};
		}
		function paneScrollHoldPlan(input = {}, options = {}) {
			const metrics = input.action === "pane-scroll-metrics" ? input : paneScrollMetrics(input, options);
			return {
				action: "pane-scroll-hold",
				reason: metrics.nearBottom ? "near-bottom" : "away-from-bottom",
				rememberHold: metrics.nearBottom !== true,
				clearHold: metrics.nearBottom === true,
				metrics
			};
		}
		function paneBottomButtonPlan(input = {}, options = {}) {
			const metrics = input.metrics && input.metrics.action === "pane-scroll-metrics" ? input.metrics : paneScrollMetrics(input, options);
			const scrollableDeltaPx = nonNegativeNumber(options.scrollableDeltaPx || input.scrollableDeltaPx, DEFAULT_PANE_SCROLLABLE_DELTA_PX);
			const scrollable = Math.max(0, metrics.scrollHeight - metrics.clientHeight) > scrollableDeltaPx;
			const shouldShow = Boolean(scrollable && !metrics.nearBottom);
			return {
				action: "pane-bottom-button",
				reason: shouldShow ? "show" : scrollable ? "near-bottom" : "not-scrollable",
				shouldShow,
				scrollable,
				scrollableDeltaPx,
				metrics
			};
		}
		function paneScrollRestorePlan(input = {}, options = {}) {
			const previous = input.previous && typeof input.previous === "object" ? input.previous : null;
			const rememberedHold = input.rememberedHold === true;
			const hold = Boolean(previous && previous.hold === true) || rememberedHold;
			const scrollHeight = nonNegativeNumber(input.scrollHeight);
			const clientHeight = nonNegativeNumber(input.clientHeight);
			const distanceFromBottom = nonNegativeNumber(previous && previous.distanceFromBottom);
			if (input.stickToBottom === true || !previous || !hold || previous.nearBottom === true) return {
				action: "pane-scroll-restore",
				reason: input.stickToBottom === true ? "stick-to-bottom" : !previous ? "missing-previous" : !hold ? "no-hold" : "previous-near-bottom",
				mode: "bottom",
				top: Math.max(0, scrollHeight),
				hold
			};
			return {
				action: "pane-scroll-restore",
				reason: "restore-distance",
				mode: "restore-distance",
				top: Math.max(0, scrollHeight - clientHeight - distanceFromBottom),
				hold
			};
		}
		function switchMenuOptionsPlan(input = {}) {
			return uniqueIds([
				text(input.currentId || input.currentThreadId || input.threadId).trim(),
				...Array.isArray(input.activeIds) ? input.activeIds : [],
				...Array.isArray(input.runningIds) ? input.runningIds : [],
				...Array.isArray(input.visibleIds) ? input.visibleIds : []
			]);
		}
		function switchMenuPlan(input = {}) {
			const currentId = text(input.currentId || input.threadId).trim();
			const switchMenuPaneId = text(input.switchMenuPaneId || input.openPaneId).trim();
			const options = uniqueIds(input.options || switchMenuOptionsPlan(input));
			const activeIds = uniqueIds(input.activeIds || []);
			const countInput = Number(input.count);
			const count = Math.max(0, Math.floor(Number.isFinite(countInput) ? countInput : activeIds.length));
			const minCount = Math.max(0, Math.floor(Number(input.minCount || 0)) || 0);
			const maxCount = Math.max(minCount, Math.floor(Number(input.maxCount || 0)) || 0);
			if (!currentId) return {
				action: "skip",
				reason: "missing-id",
				currentId,
				options,
				activeIds,
				count,
				minCount,
				maxCount,
				canClose: false,
				canAdd: false
			};
			if (switchMenuPaneId !== currentId) return {
				action: "skip",
				reason: "closed",
				currentId,
				options,
				activeIds,
				count,
				minCount,
				maxCount,
				canClose: false,
				canAdd: false
			};
			if (!options.length) return {
				action: "skip",
				reason: "no-options",
				currentId,
				options,
				activeIds,
				count,
				minCount,
				maxCount,
				canClose: false,
				canAdd: false
			};
			return {
				action: "render-switch-menu",
				reason: "open",
				currentId,
				options,
				activeIds,
				count,
				minCount,
				maxCount,
				canClose: activeIds.includes(currentId) && count > minCount,
				canAdd: count < maxCount
			};
		}
		function normalizeSplitPairs(values = [], ids = [], options = {}) {
			const visibleIds = normalizePinnedIds(ids, { maxPanes: options.maxPanes });
			const normalize = typeof options.normalizeSplitPairs === "function" ? options.normalizeSplitPairs : null;
			return (normalize ? normalize(values, visibleIds) : []).map((pair) => ({
				anchorId: String(pair && pair.anchorId || ""),
				childId: String(pair && pair.childId || "")
			})).filter((pair) => pair.anchorId && pair.childId);
		}
		function removeSplitPairsForIds(splitPairs = [], ids = []) {
			const remove = new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean));
			if (!remove.size) return {
				changed: false,
				splitPairs: Array.isArray(splitPairs) ? splitPairs : []
			};
			const current = Array.isArray(splitPairs) ? splitPairs : [];
			const next = current.filter((pair) => pair && !remove.has(String(pair.anchorId || "")) && !remove.has(String(pair.childId || "")));
			return {
				changed: JSON.stringify(next) !== JSON.stringify(current),
				splitPairs: next
			};
		}
		function prependSplitPair(splitPairs = [], anchorId, childId, options = {}) {
			const anchor = String(anchorId || "").trim();
			const child = String(childId || "").trim();
			if (!anchor || !child || anchor === child) return {
				changed: false,
				splitPairs: Array.isArray(splitPairs) ? splitPairs : []
			};
			const next = (Array.isArray(splitPairs) ? splitPairs : []).filter((pair) => pair && ![anchor, child].includes(String(pair.anchorId || "")) && ![anchor, child].includes(String(pair.childId || "")));
			next.unshift({
				anchorId: anchor,
				childId: child
			});
			return {
				changed: true,
				splitPairs: normalizeSplitPairs(next, options.ids || [], options)
			};
		}
		function paneSlotBase(input = {}, options = {}) {
			return {
				ids: uniqueIds(input.ids || input.activeIds || []),
				pinnedIds: normalizePinnedIds(input.pinnedIds || input.threadTilePinnedIds || [], options),
				splitPairs: Array.isArray(input.splitPairs || input.threadTileSplitPairs) ? input.splitPairs || input.threadTileSplitPairs : []
			};
		}
		function fillPaneSlotIds(pinnedIds = [], ids = []) {
			const nextIds = Array.isArray(pinnedIds) && pinnedIds.length ? pinnedIds.slice() : (ids || []).slice();
			while (nextIds.length < ids.length) {
				const fillId = ids[nextIds.length];
				if (!fillId) break;
				nextIds.push(fillId);
			}
			return nextIds;
		}
		function skipPaneSlot(reason, extra = {}) {
			return Object.assign({
				action: "skip",
				reason
			}, extra);
		}
		function replacePaneThreadPlan(input = {}, options = {}) {
			const from = text(input.fromThreadId || input.fromId).trim();
			const to = text(input.toThreadId || input.toId || input.threadId).trim();
			const { ids, pinnedIds } = paneSlotBase(input, options);
			if (input.enabled !== true) return skipPaneSlot("disabled", {
				from,
				to,
				ids
			});
			if (!from || !to) return skipPaneSlot("missing-id", {
				from,
				to,
				ids
			});
			const index = ids.indexOf(from);
			if (index < 0) return skipPaneSlot("source-not-visible", {
				from,
				to,
				ids
			});
			if (from === to) return {
				action: "select",
				reason: "same-thread",
				from,
				to,
				index,
				duplicateIndex: index,
				paneThreadIds: pinnedIds.length ? pinnedIds : ids,
				selectedThreadId: to,
				switchMenuPaneId: "",
				scrollResetIds: [],
				renderMode: "patch",
				loadThreadId: ""
			};
			const nextIds = fillPaneSlotIds(pinnedIds, ids);
			const duplicateIndex = nextIds.indexOf(to);
			if (duplicateIndex >= 0 && duplicateIndex !== index) nextIds[duplicateIndex] = from;
			nextIds[index] = to;
			return {
				action: "replace",
				reason: "replace-pane-thread",
				from,
				to,
				index,
				duplicateIndex,
				paneThreadIds: normalizePinnedIds(nextIds, options),
				selectedThreadId: to,
				switchMenuPaneId: "",
				scrollResetIds: [from, to],
				renderMode: duplicateIndex >= 0 && duplicateIndex !== index ? "full" : "patch-source-pane",
				loadThreadId: to
			};
		}
		function movePaneRelativePlan(input = {}, options = {}) {
			const from = text(input.fromThreadId || input.fromId).trim();
			const to = text(input.toThreadId || input.toId).trim();
			const placement = text(input.placement) === "before" ? "before" : "after";
			const { ids, splitPairs } = paneSlotBase(input, options);
			if (input.enabled !== true) return skipPaneSlot("disabled", {
				from,
				to,
				ids,
				placement
			});
			if (!from || !to) return skipPaneSlot("missing-id", {
				from,
				to,
				ids,
				placement
			});
			if (from === to) return skipPaneSlot("same-thread", {
				from,
				to,
				ids,
				placement
			});
			if (!ids.includes(from) || !ids.includes(to)) return skipPaneSlot("pane-not-visible", {
				from,
				to,
				ids,
				placement
			});
			const withoutFrom = ids.filter((id) => id !== from);
			const targetIndex = withoutFrom.indexOf(to);
			if (targetIndex < 0) return skipPaneSlot("target-not-visible", {
				from,
				to,
				ids,
				placement
			});
			withoutFrom.splice(placement === "before" ? targetIndex : targetIndex + 1, 0, from);
			const paneThreadIds = normalizePinnedIds(withoutFrom, options);
			const withoutSplit = removeSplitPairsForIds(splitPairs, [from]).splitPairs;
			return {
				action: "move",
				reason: "move-pane",
				from,
				to,
				placement,
				paneThreadIds,
				paneSplitPairs: normalizeSplitPairs(withoutSplit, paneThreadIds, options),
				selectedThreadId: from,
				switchMenuPaneId: ""
			};
		}
		function splitPaneWithTargetPlan(input = {}, options = {}) {
			const from = text(input.fromThreadId || input.fromId).trim();
			const to = text(input.toThreadId || input.toId).trim();
			const placement = text(input.placement) === "above" ? "above" : "below";
			const { ids, splitPairs } = paneSlotBase(input, options);
			if (input.enabled !== true) return skipPaneSlot("disabled", {
				from,
				to,
				ids,
				placement
			});
			if (!from || !to) return skipPaneSlot("missing-id", {
				from,
				to,
				ids,
				placement
			});
			if (from === to) return skipPaneSlot("same-thread", {
				from,
				to,
				ids,
				placement
			});
			if (!ids.includes(from) || !ids.includes(to)) return skipPaneSlot("pane-not-visible", {
				from,
				to,
				ids,
				placement
			});
			const targetIndex = ids.indexOf(to);
			const nextIds = ids.filter((id) => id !== from && id !== to);
			nextIds.splice(Math.max(0, targetIndex), 0, ...placement === "above" ? [from, to] : [to, from]);
			const paneThreadIds = normalizePinnedIds(nextIds, options);
			const pair = placement === "above" ? {
				anchorId: from,
				childId: to
			} : {
				anchorId: to,
				childId: from
			};
			return {
				action: "split",
				reason: "split-pane",
				from,
				to,
				placement,
				paneThreadIds,
				paneSplitPairs: prependSplitPair(splitPairs, pair.anchorId, pair.childId, Object.assign({}, options, { ids: paneThreadIds })).splitPairs,
				selectedThreadId: from,
				switchMenuPaneId: ""
			};
		}
		function replaceLastPaneForThreadListOpenPlan(input = {}, options = {}) {
			const id = text(input.threadId || input.toThreadId || input.toId).trim();
			const source = text(input.source).trim();
			const { ids, pinnedIds } = paneSlotBase(input, options);
			if (input.enabled !== true) return skipPaneSlot("disabled", {
				id,
				ids,
				source
			});
			if (source !== "thread-list") return skipPaneSlot("unsupported-source", {
				id,
				ids,
				source
			});
			if (!id) return skipPaneSlot("missing-id", {
				id,
				ids,
				source
			});
			if (!ids.length) return skipPaneSlot("no-panes", {
				id,
				ids,
				source
			});
			if (ids.includes(id)) return skipPaneSlot("already-visible", {
				id,
				ids,
				source
			});
			const index = ids.length - 1;
			const from = ids[index] || "";
			if (!from || from === id) return skipPaneSlot("missing-source-pane", {
				id,
				ids,
				source
			});
			const nextIds = fillPaneSlotIds(pinnedIds, ids);
			const duplicateIndex = nextIds.indexOf(id);
			if (duplicateIndex >= 0 && duplicateIndex !== index) nextIds[duplicateIndex] = from;
			nextIds[index] = id;
			const paneThreadIds = normalizePinnedIds(nextIds, options);
			if (idsEqual(pinnedIds, paneThreadIds)) return skipPaneSlot("unchanged", {
				id,
				ids,
				source
			});
			return {
				action: "replace-last",
				reason: "thread-list-open",
				from,
				to: id,
				index,
				duplicateIndex,
				paneThreadIds,
				selectedThreadId: id,
				switchMenuPaneId: "",
				scrollResetIds: [from, id]
			};
		}
		function paneSlotMutationEffectsPlan(plan = {}, options = {}) {
			const sourceAction = text(plan.action).trim();
			if (!sourceAction || sourceAction === "skip") return skipPaneSlot("no-mutation-plan", { sourceAction });
			const paneThreadIds = Array.isArray(plan.paneThreadIds) ? normalizePinnedIds(plan.paneThreadIds, options) : null;
			const base = {
				action: "pane-slot-effects",
				reason: text(plan.reason || sourceAction).trim() || sourceAction,
				sourceAction,
				paneThreadIds,
				paneSplitPairs: Array.isArray(plan.paneSplitPairs) ? plan.paneSplitPairs : null,
				paneCount: Number.isFinite(Number(plan.paneCount)) ? Math.max(0, Math.floor(Number(plan.paneCount))) : null,
				selectedThreadId: text(plan.selectedThreadId).trim(),
				switchMenuPaneId: text(plan.switchMenuPaneId).trim(),
				scrollResetIds: uniqueIds(plan.scrollResetIds || []),
				saveDraft: false,
				restoreDraft: false,
				updateComposer: false,
				scheduleSettingsSave: true,
				refreshActiveIds: false,
				selectionPolicy: "none",
				selectionEmptyFallback: false,
				loadThreadId: text(plan.loadThreadId).trim(),
				loadSource: "tile-switch",
				renderMode: "none",
				renderStickToBottom: false,
				patchThreadId: "",
				patchSourceThreadId: "",
				patchStickToBottom: false,
				scheduleFullRenderOnPatchMiss: false
			};
			if (sourceAction === "select" || sourceAction === "replace") return Object.assign(base, {
				saveDraft: true,
				restoreDraft: true,
				updateComposer: true,
				refreshActiveIds: true,
				renderMode: text(plan.renderMode) === "full" ? "schedule-full" : "patch-pane",
				patchThreadId: text(plan.to || plan.threadId).trim(),
				patchSourceThreadId: text(plan.from || plan.threadId).trim(),
				patchStickToBottom: true,
				scheduleFullRenderOnPatchMiss: true
			});
			if (sourceAction === "move" || sourceAction === "split") return Object.assign(base, {
				saveDraft: true,
				restoreDraft: true,
				updateComposer: true,
				renderMode: "full",
				renderStickToBottom: true
			});
			if (sourceAction === "replace-last") return Object.assign(base, { refreshActiveIds: true });
			if (sourceAction === "set-pane-count") return Object.assign(base, {
				selectionPolicy: "pane-selection",
				selectionEmptyFallback: false,
				renderMode: options.render === false ? "none" : "full",
				renderStickToBottom: options.render !== false
			});
			if (sourceAction === "close-pane") return Object.assign(base, {
				saveDraft: true,
				restoreDraft: true,
				updateComposer: true,
				selectionPolicy: "pane-selection",
				selectionEmptyFallback: true,
				renderMode: "full",
				renderStickToBottom: true
			});
			return skipPaneSlot("unsupported-mutation-plan", { sourceAction });
		}
		function dropPaneIntent(input = {}, options = {}) {
			const from = text(input.fromThreadId || input.fromId || input.draggingId).trim();
			const to = text(input.toThreadId || input.toId || input.targetId).trim();
			if (!from || !to) return skipPaneSlot("missing-id", {
				from,
				to
			});
			if (from === to) return skipPaneSlot("same-thread", {
				from,
				to
			});
			const left = Number(input.left || 0);
			const top = Number(input.top || 0);
			const width = Math.max(1, Number(input.width || 1));
			const height = Math.max(1, Number(input.height || 1));
			const x = (Number(input.clientX || 0) - left) / width;
			const y = (Number(input.clientY || 0) - top) / height;
			const beforeThreshold = Number.isFinite(Number(options.beforeThreshold)) ? Number(options.beforeThreshold) : .24;
			const afterThreshold = Number.isFinite(Number(options.afterThreshold)) ? Number(options.afterThreshold) : .76;
			return x < beforeThreshold ? {
				action: "move-relative",
				from,
				to,
				placement: "before",
				x,
				y
			} : x > afterThreshold ? {
				action: "move-relative",
				from,
				to,
				placement: "after",
				x,
				y
			} : {
				action: "split-with-target",
				from,
				to,
				placement: y < .5 ? "above" : "below",
				x,
				y
			};
		}
		function paneSelectionPlan(input = {}) {
			const ids = uniqueIds(input.ids || input.activeIds || []);
			const selectedThreadId = text(input.selectedThreadId).trim();
			if (selectedThreadId && ids.includes(selectedThreadId)) return {
				selectedThreadId,
				changed: false,
				reason: "selected-visible"
			};
			if (!selectedThreadId && input.emptyFallback !== true) return {
				selectedThreadId: "",
				changed: false,
				reason: "empty-selection"
			};
			return {
				selectedThreadId: ids[0] || "",
				changed: selectedThreadId !== (ids[0] || ""),
				reason: selectedThreadId ? "selected-missing" : "empty-fallback"
			};
		}
		function selectPanePlan(input = {}) {
			const id = text(input.threadId || input.paneId).trim();
			const activeIds = uniqueIds(input.activeIds || input.ids || []);
			const selectedThreadId = text(input.selectedThreadId).trim();
			if (input.enabled !== true) return skipPaneSlot("disabled", {
				id,
				activeIds
			});
			if (!id) return skipPaneSlot("missing-id", {
				id,
				activeIds
			});
			if (!activeIds.includes(id)) return skipPaneSlot("pane-not-active", {
				id,
				activeIds
			});
			if (selectedThreadId === id) return skipPaneSlot("unchanged", {
				id,
				activeIds,
				selectedThreadId
			});
			return {
				action: "select-pane",
				reason: "select-pane",
				threadId: id,
				previousThreadId: selectedThreadId,
				selectedThreadId: id,
				patchThreadIds: uniqueIds([id, selectedThreadId])
			};
		}
		function selectedPaneEffectsPlan(plan = {}, options = {}) {
			const sourceAction = text(plan.action).trim();
			if (sourceAction !== "select-pane") return skipPaneSlot("unsupported-select-pane-plan", { sourceAction });
			const selectedThreadId = text(plan.selectedThreadId || plan.threadId).trim();
			if (!selectedThreadId) return skipPaneSlot("missing-id", { selectedThreadId });
			return {
				action: "selected-pane-effects",
				reason: text(plan.reason || sourceAction).trim() || sourceAction,
				sourceAction,
				selectedThreadId,
				patchThreadIds: uniqueIds(plan.patchThreadIds || [selectedThreadId]),
				saveDraft: true,
				restoreDraft: true,
				updateComposer: true,
				renderMode: options.render === false ? "none" : "patch-panes",
				patchPreserveScroll: true,
				scheduleFullRenderOnPatchMiss: true
			};
		}
		function paneCountChangePlan(input = {}, options = {}) {
			if (input.enabled !== true) return skipPaneSlot("disabled");
			if (input.layoutEnabled !== true) return skipPaneSlot("layout-disabled");
			const minCount = Math.max(1, Math.floor(Number(input.minCount || 1)) || 1);
			const maxCount = Math.max(minCount, Math.floor(Number(input.maxCount || minCount)) || minCount);
			const currentCount = Math.max(minCount, Math.floor(Number(input.currentCount || minCount)) || minCount);
			const storedPaneCount = normalizePaneCount(input.storedPaneCount, {
				fallback: 0,
				maxPanes: options.maxPanes
			});
			const requested = normalizePaneCount(input.nextCount, {
				fallback: currentCount,
				maxPanes: options.maxPanes
			});
			const paneCount = Math.max(minCount, Math.min(maxCount, requested));
			if (paneCount === currentCount && storedPaneCount === paneCount) return skipPaneSlot("unchanged", {
				paneCount,
				currentCount,
				minCount,
				maxCount
			});
			return {
				action: "set-pane-count",
				reason: "set-pane-count",
				paneCount,
				currentCount,
				minCount,
				maxCount,
				switchMenuPaneId: ""
			};
		}
		function closePanePlan(input = {}, options = {}) {
			const id = text(input.threadId || input.paneId).trim();
			const ids = uniqueIds(input.ids || input.activeIds || []);
			if (input.enabled !== true) return skipPaneSlot("disabled", {
				id,
				ids
			});
			if (input.layoutEnabled !== true) return skipPaneSlot("layout-disabled", {
				id,
				ids
			});
			if (!id) return skipPaneSlot("missing-id", {
				id,
				ids
			});
			if (!ids.includes(id)) return skipPaneSlot("pane-not-visible", {
				id,
				ids
			});
			const minCount = Math.max(1, Math.floor(Number(input.minCount || 1)) || 1);
			if (ids.length <= minCount) return skipPaneSlot("min-pane-count", {
				id,
				ids,
				minCount
			});
			const nextCount = Math.max(minCount, ids.length - 1);
			const pinnedIds = normalizePinnedIds(input.pinnedIds || [], options);
			const sourceIds = pinnedIds.length ? pinnedIds : ids;
			const defaultIds = uniqueIds(input.defaultIds || input.fillIds || []);
			const remaining = sourceIds.filter((candidateId) => candidateId !== id);
			const fillIds = defaultIds.filter((candidateId) => candidateId !== id);
			return {
				action: "close-pane",
				reason: "close-pane",
				threadId: id,
				paneCount: nextCount,
				paneThreadIds: normalizePinnedIds([...remaining, ...fillIds], options),
				switchMenuPaneId: "",
				scrollResetIds: [id]
			};
		}
		function effectiveSelectedThreadId(input = {}) {
			const activeIds = normalizePinnedIds(input.activeIds || input.ids || [], { maxPanes: input.maxPanes });
			if (input.enabled === false || !activeIds.length) return "";
			const selected = String(input.selectedThreadId || "").trim();
			if (selected && activeIds.includes(selected)) return selected;
			const current = String(input.currentThreadId || "").trim();
			if (current && activeIds.includes(current)) return current;
			return activeIds[0] || "";
		}
		function composerTargetPlan(input = {}, options = {}) {
			const newThreadDraft = input.newThreadDraft === true;
			const activeIds = normalizePinnedIds(input.activeIds || input.ids || [], { maxPanes: options.maxPanes || input.maxPanes });
			const tileContext = Boolean(input.threadTileMode === true && input.tileSurfaceActive === true && activeIds.length);
			const selectedThreadId = effectiveSelectedThreadId({
				enabled: input.threadTileMode === true,
				activeIds,
				selectedThreadId: input.selectedThreadId,
				currentThreadId: input.currentThreadId,
				maxPanes: options.maxPanes || input.maxPanes
			});
			const currentThreadId = text(input.currentThreadId).trim();
			return {
				action: "composer-target",
				reason: newThreadDraft ? "new-thread" : selectedThreadId ? "selected-pane" : currentThreadId ? "current-thread" : "missing-thread",
				mode: newThreadDraft ? "new-thread" : "thread",
				newThreadDraft,
				tileContext,
				activeIds,
				selectedThreadId,
				currentThreadId,
				targetThreadId: newThreadDraft ? "" : selectedThreadId || currentThreadId || ""
			};
		}
		function composerTargetPlaceholderPlan(input = {}) {
			if (input.newThreadDraft === true || String(input.mode || "") === "new-thread") return {
				action: "composer-target-placeholder",
				reason: "new-thread",
				showTargetPlaceholder: false,
				text: text(input.newThreadPlaceholder || "输入第一条消息")
			};
			const targetThreadId = text(input.targetThreadId).trim();
			const targetTitle = text(input.targetTitle || targetThreadId).trim();
			const showTargetPlaceholder = Boolean(input.tileContext === true && targetThreadId && input.hasTargetThread === true);
			return {
				action: "composer-target-placeholder",
				reason: showTargetPlaceholder ? "tile-target" : "default",
				showTargetPlaceholder,
				text: showTargetPlaceholder ? `发送到：${targetTitle || targetThreadId}` : text(input.defaultPlaceholder || "Message Codex")
			};
		}
		function composerActionControlPlan(input = {}) {
			const newThreadDraft = input.newThreadDraft === true || input.hasNewThreadDraft === true;
			const hasThread = input.hasThread === true;
			const composerBusy = input.composerBusy === true;
			const attachmentProcessingCount = Math.max(0, Math.floor(Number(input.attachmentProcessingCount || 0)) || 0);
			const hasContent = input.hasContent === true;
			const hasActiveTurn = Boolean(!newThreadDraft && text(input.targetActiveTurnId || input.activeTurnId).trim());
			const disabled = !(hasThread || newThreadDraft) || composerBusy || attachmentProcessingCount > 0;
			const interruptMode = hasActiveTurn && !hasContent;
			const steerMode = hasActiveTurn && hasContent;
			const retryMode = Boolean(text(input.sendButtonHint).trim() || input.showRetryHint === true);
			const goalCommandMode = input.goalCommandMode === true;
			const bareIntentKind = text(input.bareIntentKind).trim();
			const commandMode = input.commandMode === true;
			const steeringBusy = Boolean(input.steeringBusy === true || input.steering === true);
			const voiceGestureAvailable = input.voiceGestureAvailable === true;
			const hermesEmbedMode = input.hermesEmbedMode === true;
			const bareIntentTitle = text(input.bareIntentTitle || input.intentTitle).trim();
			let mode = "send";
			let reason = "send";
			let label = "Send";
			let title = newThreadDraft ? "Create new chat" : "Send message";
			let labelProxy = false;
			if (interruptMode) {
				mode = "interrupt";
				reason = "active-turn-interrupt";
				label = "Stop";
				title = "Interrupt current turn";
				labelProxy = hermesEmbedMode;
			} else if (composerBusy) {
				mode = "busy";
				reason = steeringBusy ? "steering-sending" : "message-sending";
				label = steeringBusy ? "引导中…" : "发送中…";
				title = steeringBusy ? "Steering current turn" : "Message is sending";
			} else if (retryMode) {
				mode = "retry";
				reason = "retry";
				label = "重试";
				title = "Retry sending message";
			} else if (goalCommandMode) {
				mode = "goal";
				reason = "goal-command";
				label = "Goal";
				title = "Open goal dialog";
			} else if (bareIntentKind) {
				mode = "intent";
				reason = "bare-intent";
				label = "Open";
				title = bareIntentTitle || "Open composer action";
			} else if (commandMode) {
				mode = "task-card";
				reason = "task-card-command";
				label = "Task card";
				title = "Ask Codex to draft a cross-thread task card";
			} else if (steerMode) {
				mode = "steer";
				reason = "active-turn-steer";
				label = "引导";
				title = "Guide the current running turn";
			}
			if (voiceGestureAvailable && !composerBusy && !interruptMode) title = `${title || "Send"}；按住录音，松开转写`;
			const ariaLabel = voiceGestureAvailable && !composerBusy && !interruptMode ? `${label || "Send"}。按住可语音输入` : interruptMode && hermesEmbedMode ? "Stop。按住可语音输入，轻点可中断当前任务" : "";
			return {
				action: "composer-action-control",
				reason,
				mode,
				disabled,
				sendButtonDisabled: disabled || !interruptMode && !hasContent && !voiceGestureAvailable,
				interruptMode,
				steerMode,
				hasContent,
				voiceGestureAvailable,
				label,
				labelProxy,
				title,
				ariaLabel,
				classState: {
					interruptMode,
					sending: mode === "busy",
					sendFailed: mode === "retry",
					steerMode: mode === "steer" || mode === "busy" && steeringBusy,
					pluginVoiceInputGesture: voiceGestureAvailable
				}
			};
		}
		function composerDraftRuntimeSelectionPlan(input = {}) {
			const draft = input.draft && typeof input.draft === "object" ? input.draft : null;
			const hasDraft = Boolean(draft);
			const newThreadDraft = input.newThreadDraft === true;
			const model = text(draft && draft.model).trim();
			const effort = text(draft && draft.effort).trim();
			const permissionMode = text(input.effectivePermissionMode || input.permissionMode).trim();
			const modelOptions = new Set((Array.isArray(input.modelOptions) ? input.modelOptions : []).map((value) => text(value).trim()).filter(Boolean));
			const effortOptions = new Set((Array.isArray(input.reasoningEffortOptions || input.effortOptions) ? input.reasoningEffortOptions || input.effortOptions : []).map((value) => text(value).trim()).filter(Boolean));
			const permissionOptions = new Set((Array.isArray(input.permissionModeOptions) ? input.permissionModeOptions : []).map((value) => text(value).trim()).filter(Boolean));
			const resetRuntimeWhenMissingDraft = input.resetRuntimeWhenMissingDraft === true;
			const defaultNewThreadModel = text(input.defaultNewThreadModel).trim();
			const defaultNewThreadEffort = text(input.defaultNewThreadEffort).trim();
			const defaultNewThreadPermissionMode = text(input.defaultNewThreadPermissionMode).trim();
			const plan = {
				action: "composer-draft-runtime-selection",
				reason: newThreadDraft ? hasDraft ? "new-thread-draft" : "new-thread-defaults" : hasDraft ? "thread-draft" : resetRuntimeWhenMissingDraft ? "missing-draft-reset" : "missing-draft-keep",
				mode: newThreadDraft ? "new-thread" : "thread",
				hasDraft,
				newThreadDraft,
				fastMode: Boolean(draft && draft.fastMode === true),
				clearNewThreadTitle: !newThreadDraft,
				setNewThreadRuntime: newThreadDraft,
				setThreadRuntime: !newThreadDraft && (hasDraft || resetRuntimeWhenMissingDraft),
				newThreadTitle: "",
				newThreadModel: "",
				newThreadEffort: "",
				newThreadPermissionMode: "",
				composerModel: "",
				composerEffort: "",
				composerPermissionMode: ""
			};
			if (newThreadDraft) {
				plan.newThreadTitle = text(draft && draft.threadTitle).trim();
				plan.newThreadModel = model && modelOptions.has(model) ? model : defaultNewThreadModel;
				plan.newThreadEffort = effort && effortOptions.has(effort) ? effort : defaultNewThreadEffort;
				plan.newThreadPermissionMode = permissionMode || defaultNewThreadPermissionMode;
				return plan;
			}
			if (!hasDraft && !resetRuntimeWhenMissingDraft) return plan;
			plan.composerModel = model && modelOptions.has(model) ? model : "";
			plan.composerEffort = effort && effortOptions.has(effort) ? effort : "";
			plan.composerPermissionMode = permissionMode && permissionOptions.has(permissionMode) ? permissionMode : "";
			return plan;
		}
		function displaySettingsPayload(input = {}, options = {}) {
			const paneThreadIds = normalizePinnedIds(input.paneThreadIds || input.threadTilePinnedIds || [], options);
			const paneCountInput = Object.prototype.hasOwnProperty.call(input, "paneCount") ? input.paneCount : input.threadTilePaneCount;
			return {
				displayMode: Boolean(input.threadTileMode) || String(input.displayMode || "").toLowerCase() === "tile" ? "tile" : "single",
				paneThreadIds,
				paneCount: normalizePaneCount(paneCountInput, {
					fallback: 0,
					maxPanes: options.maxPanes
				}),
				paneSplitPairs: normalizeSplitPairs(input.paneSplitPairs || input.threadTileSplitPairs || [], paneThreadIds, options),
				selectedThreadId: String(input.selectedThreadId || input.threadTileSelectedThreadId || "")
			};
		}
		function normalizeDisplaySettings(settings = {}, options = {}) {
			const displayMode = String(settings.displayMode || (settings.threadTileMode ? "tile" : "single")).toLowerCase() === "tile" ? "tile" : "single";
			const paneThreadIds = normalizePinnedIds(settings.paneThreadIds || settings.threadTilePinnedIds || [], options);
			const paneSplitPairs = normalizeSplitPairs(settings.paneSplitPairs || settings.threadTileSplitPairs || settings.splitPairs || [], paneThreadIds, options);
			const paneCountInput = Object.prototype.hasOwnProperty.call(settings, "paneCount") ? settings.paneCount : Object.prototype.hasOwnProperty.call(settings, "threadTilePaneCount") ? settings.threadTilePaneCount : settings.tilePaneCount;
			const selected = String(settings.selectedThreadId || "").trim();
			return {
				displayMode,
				threadTileMode: displayMode === "tile",
				paneThreadIds,
				paneSplitPairs,
				paneCount: normalizePaneCount(paneCountInput, {
					fallback: 0,
					maxPanes: options.maxPanes
				}),
				selectedThreadId: selected && paneThreadIds.includes(selected) ? selected : ""
			};
		}
		function displaySettingsLoadPlan(input = {}) {
			const localDisplayMode = text(input.localDisplayMode).trim().toLowerCase() === "tile" ? "tile" : "single";
			const settings = input.settings && typeof input.settings === "object" ? input.settings : {};
			if (input.loadFailed === true) return {
				action: localDisplayMode === "tile" ? "apply-display-settings" : "skip",
				reason: localDisplayMode === "tile" ? "load-error-local-tile" : "load-error-no-local-tile",
				settings: localDisplayMode === "tile" ? { displayMode: "tile" } : null,
				saveAfterApply: false,
				rethrow: true
			};
			const source = text(settings.source || input.source).trim();
			if (source !== "runtime" && localDisplayMode === "tile") return {
				action: "apply-display-settings",
				reason: "legacy-local-tile-migration",
				settings: {
					displayMode: "tile",
					paneThreadIds: [],
					selectedThreadId: ""
				},
				saveAfterApply: true,
				rethrow: false
			};
			return {
				action: "apply-display-settings",
				reason: source === "runtime" ? "runtime-settings" : "default-settings",
				settings,
				saveAfterApply: false,
				rethrow: false
			};
		}
		function syncPinnedIdsFromActiveIds(input = {}, options = {}) {
			const activeIds = normalizePinnedIds(input.activeIds || [], options);
			const currentPinnedIds = normalizePinnedIds(input.pinnedIds || input.threadTilePinnedIds || [], options);
			if (input.enabled === false || !activeIds.length) return {
				changed: false,
				paneThreadIds: currentPinnedIds,
				paneSplitPairs: input.splitPairs || []
			};
			const visibleIds = new Set((input.visibleIds || []).map((id) => String(id || "").trim()).filter(Boolean));
			if (idsEqual(currentPinnedIds.filter((id) => visibleIds.has(id)).slice(0, activeIds.length), activeIds)) return {
				changed: false,
				paneThreadIds: currentPinnedIds,
				paneSplitPairs: input.splitPairs || []
			};
			const remaining = currentPinnedIds.filter((id) => !activeIds.includes(id));
			const paneThreadIds = normalizePinnedIds([...activeIds, ...remaining], options);
			return {
				changed: true,
				paneThreadIds,
				paneSplitPairs: normalizeSplitPairs(input.splitPairs || [], paneThreadIds, options)
			};
		}
		function activePaneSyncPlan(input = {}, options = {}) {
			const activeIds = normalizePinnedIds(input.activeIds || [], options);
			const selectedThreadId = text(input.selectedThreadId).trim();
			const currentPinnedIds = normalizePinnedIds(input.pinnedIds || input.threadTilePinnedIds || [], options);
			const splitPairs = Array.isArray(input.splitPairs || input.threadTileSplitPairs) ? input.splitPairs || input.threadTileSplitPairs : [];
			if (input.enabled !== true || !activeIds.length) return {
				action: "sync-active-panes",
				reason: input.enabled === true ? "no-active-panes" : "disabled",
				changed: Boolean(selectedThreadId),
				settingsChanged: false,
				pinnedChanged: false,
				selectedChanged: Boolean(selectedThreadId),
				activeIds,
				paneThreadIds: currentPinnedIds,
				paneSplitPairs: splitPairs,
				selectedThreadId: ""
			};
			const pinned = syncPinnedIdsFromActiveIds({
				enabled: true,
				activeIds,
				pinnedIds: currentPinnedIds,
				visibleIds: input.visibleIds,
				splitPairs
			}, options);
			const nextSelectedThreadId = effectiveSelectedThreadId({
				enabled: true,
				activeIds,
				selectedThreadId,
				currentThreadId: input.currentThreadId,
				maxPanes: options.maxPanes
			});
			const selectedChanged = selectedThreadId !== nextSelectedThreadId;
			return {
				action: "sync-active-panes",
				reason: pinned.changed || selectedChanged ? "sync" : "unchanged",
				changed: pinned.changed || selectedChanged,
				settingsChanged: pinned.changed,
				pinnedChanged: pinned.changed,
				selectedChanged,
				activeIds,
				paneThreadIds: pinned.paneThreadIds,
				paneSplitPairs: pinned.paneSplitPairs,
				selectedThreadId: nextSelectedThreadId
			};
		}
		function normalizeOperationMode(mode) {
			return text(mode) === "expanded" ? "expanded" : "compact";
		}
		function toggleOperationMode(mode) {
			return normalizeOperationMode(mode) === "expanded" ? "compact" : "expanded";
		}
		function operationModeTogglePlan(input = {}) {
			const id = text(input.threadId || input.paneId).trim();
			if (input.enabled !== true) return skipPaneSlot("disabled", { id });
			if (!id) return skipPaneSlot("missing-id", { id });
			const previousMode = normalizeOperationMode(input.mode || input.currentMode);
			return {
				action: "operation-mode-toggle-effects",
				reason: "toggle-operation-mode",
				id,
				previousMode,
				mode: toggleOperationMode(previousMode),
				selectPane: true,
				selectPaneRender: false,
				patchThreadId: id,
				patchPreserveScroll: true,
				scheduleFullRenderOnPatchMiss: true
			};
		}
		function operationBubbleRecord(input = {}) {
			const id = text(input.threadId).trim();
			const html = text(input.html);
			const marker = text(input.bubbleMarker || "mobile-operation-bubble");
			if (!id || !html || !html.includes(marker)) return null;
			const minVisibleMs = Math.max(0, Number(input.minVisibleMs || DEFAULT_OPERATION_BUBBLE_MIN_VISIBLE_MS));
			return {
				html,
				visibleUntilMs: nowValue(input.nowMs) + minVisibleMs
			};
		}
		function operationBubbleSnapshot(record, input = {}) {
			if (!record) return {
				visible: false,
				html: "",
				remainingMs: 0,
				expired: false
			};
			const remainingMs = Number(record.visibleUntilMs || 0) - nowValue(input.nowMs);
			if (remainingMs <= 0) return {
				visible: false,
				html: "",
				remainingMs: 0,
				expired: true
			};
			return {
				visible: true,
				html: text(record.html),
				remainingMs,
				expired: false
			};
		}
		function operationDockPlan(input = {}) {
			const id = text(input.threadId || input.id).trim();
			const mode = normalizeOperationMode(input.mode);
			const expanded = mode === "expanded";
			if (!id) return {
				action: "none",
				reason: "missing-id",
				id: "",
				mode,
				expanded
			};
			const entryType = text(input.entryType || input.operationType);
			if (input.hasOperation === true || Boolean(entryType && entryType !== "liveTurnStatus")) return {
				action: "render-live-operation",
				reason: "active-operation",
				id,
				mode,
				expanded,
				remember: true
			};
			if (input.hasLiveTurn !== true) return {
				action: "none",
				reason: "no-live-turn",
				id,
				mode,
				expanded
			};
			const remembered = operationBubbleSnapshot(input.remembered, { nowMs: input.nowMs });
			if (remembered.visible) return {
				action: "render-remembered-operation",
				reason: "remembered-visible",
				id,
				mode,
				expanded,
				html: remembered.html,
				remainingMs: remembered.remainingMs,
				scheduleMinimumRefresh: true
			};
			if (remembered.expired) return {
				action: "clear-remembered-operation",
				reason: "remembered-expired",
				id,
				mode,
				expanded,
				clearRemembered: true
			};
			return {
				action: "none",
				reason: "no-remembered-operation",
				id,
				mode,
				expanded
			};
		}
		function operationSignature(input = {}) {
			const remembered = operationBubbleSnapshot(input.remembered, { nowMs: input.nowMs });
			return {
				mode: normalizeOperationMode(input.mode),
				rememberedVisible: remembered.visible,
				entry: input.entrySignature || null
			};
		}
		function operationMinimumRefreshPlan(input = {}) {
			const activeIds = uniqueIds(input.activeIds || input.ids || []);
			if (input.enabled !== true) return {
				action: "operation-minimum-refresh",
				reason: "disabled",
				patchThreadIds: [],
				fullRenderOnPatchMiss: false
			};
			return {
				action: "operation-minimum-refresh",
				reason: activeIds.length ? "patch-active-panes" : "no-active-panes",
				patchThreadIds: activeIds,
				fullRenderOnPatchMiss: true
			};
		}
		function paneRenderFramePlan(input = {}) {
			const id = text(input.threadId || input.paneId).trim();
			if (!id) return {
				action: "skip",
				reason: "missing-id",
				id: "",
				scheduleFrame: false,
				returnValue: false,
				fullRenderOnPatchMiss: false
			};
			if (input.enabled !== true) return {
				action: "skip",
				reason: "disabled",
				id,
				scheduleFrame: false,
				returnValue: false,
				fullRenderOnPatchMiss: false
			};
			if (input.visible !== true) return {
				action: "skip",
				reason: "pane-not-visible",
				id,
				scheduleFrame: false,
				returnValue: false,
				fullRenderOnPatchMiss: false
			};
			if (input.hasFrame === true) return {
				action: "already-scheduled",
				reason: "frame-active",
				id,
				scheduleFrame: false,
				returnValue: true,
				fullRenderOnPatchMiss: false
			};
			return {
				action: "schedule-pane-render",
				reason: "ready",
				id,
				scheduleFrame: true,
				returnValue: true,
				fullRenderOnPatchMiss: input.fullRenderOnPatchMiss !== false
			};
		}
		function booleanFact(input = {}, key) {
			return Object.prototype.hasOwnProperty.call(input, key) ? input[key] === true : null;
		}
		function panePatchPreflightSkip(reason, details = {}) {
			return Object.assign({
				action: "skip",
				reason,
				canPatch: false,
				shouldContinue: false,
				id: "",
				ids: []
			}, details);
		}
		function panePatchPreflightPlan(input = {}) {
			const id = text(input.threadId || input.paneId).trim();
			const hasIds = Array.isArray(input.ids || input.activeIds);
			const ids = uniqueIds(input.ids || input.activeIds || []);
			if (!id) return panePatchPreflightSkip("missing-id", {
				id: "",
				ids
			});
			if (input.enabled !== true) return panePatchPreflightSkip("disabled", {
				id,
				ids
			});
			if (input.visible !== true) return panePatchPreflightSkip("pane-not-visible", {
				id,
				ids
			});
			const conversationPresent = booleanFact(input, "conversationPresent");
			if (conversationPresent === false) return panePatchPreflightSkip("missing-conversation", {
				id,
				ids
			});
			const tileSurface = booleanFact(input, "tileSurface");
			if (tileSurface === false) return panePatchPreflightSkip("not-tile-surface", {
				id,
				ids
			});
			const boardPresent = booleanFact(input, "boardPresent");
			if (boardPresent === false) return panePatchPreflightSkip("missing-board", {
				id,
				ids
			});
			const layoutEnabled = booleanFact(input, "layoutEnabled");
			if (layoutEnabled === false) return panePatchPreflightSkip("layout-disabled", {
				id,
				ids
			});
			if (hasIds && !ids.includes(id)) return panePatchPreflightSkip("pane-not-candidate", {
				id,
				ids
			});
			const panePresent = booleanFact(input, "panePresent");
			if (panePresent === false) return panePatchPreflightSkip("missing-pane", {
				id,
				ids
			});
			const factsComplete = conversationPresent === true && tileSurface === true && boardPresent === true && layoutEnabled === true && panePresent === true && hasIds;
			return {
				action: factsComplete ? "patch-pane" : "continue",
				reason: factsComplete ? "ready" : "pending-facts",
				canPatch: factsComplete,
				shouldContinue: true,
				id,
				ids
			};
		}
		function panePatchCompletionSkip(reason, details = {}) {
			return Object.assign({
				action: "skip",
				reason,
				id: "",
				returnValue: false,
				hydrate: false,
				restoreScroll: false,
				updateBottomButton: false,
				updateBottomButtonMode: "none",
				writeRenderSignature: false,
				clearPatchShellSignature: false,
				bindActions: false
			}, details);
		}
		function panePatchCompletionPlan(input = {}) {
			const id = text(input.threadId || input.paneId).trim();
			if (!id) return panePatchCompletionSkip("missing-id");
			if (input.sourcePanePresent !== true) return panePatchCompletionSkip("missing-source-pane", { id });
			if (!Object.prototype.hasOwnProperty.call(input, "patchedPanePresent")) return Object.assign(panePatchCompletionSkip("source-pane-ready", { id }), {
				action: "continue",
				returnValue: true
			});
			if (input.patchedPanePresent === false) return panePatchCompletionSkip("missing-patched-pane", { id });
			return {
				action: "complete-pane-patch",
				reason: "ready",
				id,
				returnValue: true,
				hydrate: true,
				restoreScroll: true,
				updateBottomButton: true,
				updateBottomButtonMode: input.requestAnimationFrameAvailable === true ? "animation-frame" : "sync",
				writeRenderSignature: true,
				clearPatchShellSignature: true,
				bindActions: true
			};
		}
		function refreshDelayMs(value, options = {}) {
			const defaultDelayMs = Math.max(0, Number(options.defaultDelayMs || 0));
			const minDelayMs = Math.max(0, Number(options.minDelayMs || 500));
			const parsed = Number(value);
			return Math.max(minDelayMs, Number.isFinite(parsed) ? parsed : defaultDelayMs);
		}
		function refreshSchedulePlan(input = {}, options = {}) {
			const activeIds = uniqueIds(input.activeIds || []);
			const hiddenValue = text(options.hiddenVisibilityState || "hidden");
			if (input.enabled !== true) return {
				schedule: false,
				clearTimer: true,
				reason: "disabled",
				activeIds,
				delayMs: 0
			};
			if (text(input.visibilityState) === hiddenValue) return {
				schedule: false,
				clearTimer: true,
				reason: "hidden",
				activeIds,
				delayMs: 0
			};
			if (!activeIds.length) return {
				schedule: false,
				clearTimer: false,
				reason: "no-active-panes",
				activeIds,
				delayMs: 0
			};
			if (input.hasTimer === true) return {
				schedule: false,
				clearTimer: false,
				reason: "timer-active",
				activeIds,
				delayMs: 0
			};
			return {
				schedule: true,
				clearTimer: false,
				reason: "schedule",
				activeIds,
				delayMs: refreshDelayMs(input.delayMs, options)
			};
		}
		function refreshTargetIds(input = {}) {
			if (input.enabled !== true) return [];
			const ids = uniqueIds(input.ids || input.activeIds || []);
			const visibleInput = input.visibleIds;
			const visibleIds = Array.isArray(visibleInput) ? new Set(uniqueIds(visibleInput)) : null;
			const currentThreadId = text(input.currentThreadId).trim();
			return ids.filter((id) => {
				if (visibleIds && !visibleIds.has(id)) return false;
				return !currentThreadId || id !== currentThreadId;
			});
		}
		function detailLoadQueuePlan(input = {}) {
			const activeIds = uniqueIds(input.activeIds || input.ids || []);
			const controllerIds = uniqueIds(input.controllerIds || []);
			const loadingIds = uniqueIds(input.loadingIds || []);
			const readyIds = uniqueIds(input.readyIds || []);
			if (input.enabled !== true) return {
				action: "skip",
				reason: "disabled",
				activeIds,
				controllerIds,
				loadingIds,
				readyIds,
				abortIds: [],
				loadIds: [],
				deferredIds: [],
				busyIds: [],
				maxConcurrentLoads: 0,
				availableSlots: 0,
				scheduleDrainAfterLoad: false
			};
			const activeSet = new Set(activeIds);
			const controllerSet = new Set(controllerIds);
			const loadingSet = new Set(loadingIds);
			const readySet = new Set(readyIds);
			const abortIds = controllerIds.filter((id) => !activeSet.has(id));
			const busyIds = uniqueIds([...controllerIds.filter((id) => activeSet.has(id)), ...loadingIds.filter((id) => activeSet.has(id))]);
			const parsedMax = Math.floor(Number(input.maxConcurrentLoads));
			const maxConcurrentLoads = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : Math.max(1, activeIds.length || DEFAULT_USER_MAX_PANES);
			const availableSlots = Math.max(0, maxConcurrentLoads - busyIds.length);
			const candidates = activeIds.filter((id) => !controllerSet.has(id) && !loadingSet.has(id) && !readySet.has(id));
			const loadIds = candidates.slice(0, availableSlots);
			const deferredIds = candidates.slice(availableSlots);
			const scheduleDrainAfterLoad = deferredIds.length > 0 && loadIds.length > 0;
			return {
				action: "detail-load-queue",
				reason: !activeIds.length ? "no-active-panes" : deferredIds.length ? "max-concurrency" : "queue",
				activeIds,
				controllerIds,
				loadingIds,
				readyIds,
				abortIds,
				loadIds,
				deferredIds,
				busyIds,
				maxConcurrentLoads,
				availableSlots,
				scheduleDrainAfterLoad
			};
		}
		function detailLoadConcurrencyPlan(input = {}, options = {}) {
			const activeIds = uniqueIds(input.activeIds || input.ids || []);
			const maxPanes = maxPaneLimit(input.maxPanes || options.maxPanes || DEFAULT_USER_MAX_PANES);
			const configuredInput = Object.prototype.hasOwnProperty.call(input, "maxConcurrentLoads") ? input.maxConcurrentLoads : Object.prototype.hasOwnProperty.call(input, "configuredMaxConcurrentLoads") ? input.configuredMaxConcurrentLoads : options.defaultMaxConcurrentLoads;
			const parsed = Math.floor(Number(configuredInput));
			const boundedConfiguredMax = Math.max(1, Math.min(maxPanes, Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DETAIL_LOAD_MAX_CONCURRENT));
			const maxConcurrentLoads = activeIds.length ? Math.max(1, Math.min(activeIds.length, boundedConfiguredMax)) : boundedConfiguredMax;
			return {
				action: "detail-load-concurrency",
				reason: activeIds.length ? "active-panes" : "no-active-panes",
				activeIds,
				activeCount: activeIds.length,
				configuredMaxConcurrentLoads: boundedConfiguredMax,
				maxConcurrentLoads
			};
		}
		function detailLoadQueueDrainPlan(input = {}, options = {}) {
			const activeIds = uniqueIds(input.activeIds || input.ids || []);
			const delayMs = Math.max(0, Number(input.delayMs || options.defaultDelayMs || 0));
			if (input.enabled !== true) return {
				schedule: false,
				clearTimer: true,
				reason: "disabled",
				activeIds,
				delayMs: 0
			};
			if (!activeIds.length) return {
				schedule: false,
				clearTimer: true,
				reason: "no-active-panes",
				activeIds,
				delayMs: 0
			};
			if (input.hasTimer === true) return {
				schedule: false,
				clearTimer: false,
				reason: "timer-active",
				activeIds,
				delayMs: 0
			};
			if (input.pending !== true && input.force !== true) return {
				schedule: false,
				clearTimer: false,
				reason: "no-pending-loads",
				activeIds,
				delayMs: 0
			};
			return {
				schedule: true,
				clearTimer: false,
				reason: input.force === true ? "load-settled" : "deferred-loads",
				activeIds,
				delayMs
			};
		}
		function detailLoadPlan(input = {}) {
			const id = text(input.threadId).trim();
			if (!id) return {
				action: "skip",
				reason: "missing-id",
				id: ""
			};
			if (text(input.currentThreadId).trim() === id && input.currentThreadLoaded === true) return {
				action: "skip",
				reason: "current-thread-loaded",
				id
			};
			if (input.controllerActive === true) return {
				action: "skip",
				reason: "controller-active",
				id
			};
			if (input.loadingActive === true) return {
				action: "skip",
				reason: "loading-active",
				id
			};
			const cachedReady = input.cachedReady === true;
			const force = input.force === true;
			const nowMs = nowValue(input.nowMs);
			const lastLoadedAt = Number(input.lastLoadedAt || 0);
			const minIntervalMs = Math.max(0, Number(input.minIntervalMs || 0));
			if (!force && cachedReady) return {
				action: "skip",
				reason: "cached-ready",
				id
			};
			if (force && lastLoadedAt && nowMs - lastLoadedAt < minIntervalMs) return {
				action: "skip",
				reason: "min-refresh-interval",
				id
			};
			const background = Boolean(input.backgroundRequested === true && cachedReady);
			return {
				action: "load",
				reason: background ? "background-refresh" : "load",
				id,
				background,
				markLoading: !background,
				clearError: !background
			};
		}
		function detailLoadStartEffectsPlan(plan = {}) {
			const sourceAction = text(plan.action).trim();
			const id = text(plan.id || plan.threadId).trim();
			if (sourceAction !== "load") return skipPaneSlot("unsupported-detail-load-plan", {
				sourceAction,
				id
			});
			if (!id) return skipPaneSlot("missing-id", { id });
			return {
				action: "detail-load-start-effects",
				reason: text(plan.reason || sourceAction).trim() || sourceAction,
				id,
				background: plan.background === true,
				setController: true,
				markLoading: plan.markLoading === true,
				clearError: plan.clearError === true,
				renderPane: plan.markLoading === true,
				preserveScroll: true
			};
		}
		function detailLoadSuccessEffectsPlan(input = {}) {
			const id = text(input.id || input.threadId).trim();
			if (!id) return skipPaneSlot("missing-id", { id });
			if (input.hasThread !== true) return skipPaneSlot("missing-thread", { id });
			return {
				action: "detail-load-success-effects",
				reason: "thread-loaded",
				id,
				setDetail: true,
				setLoadedAt: true,
				loadedAtMs: nowValue(input.nowMs),
				clearError: true,
				mergeThread: true
			};
		}
		function detailLoadErrorEffectsPlan(input = {}) {
			const id = text(input.id || input.threadId).trim();
			if (!id) return skipPaneSlot("missing-id", { id });
			if (input.aborted === true) return skipPaneSlot("aborted", { id });
			if (input.background === true) return skipPaneSlot("background-refresh", { id });
			return {
				action: "detail-load-error-effects",
				reason: "foreground-error",
				id,
				errorMessage: text(input.errorMessage || input.message || input.error).trim()
			};
		}
		function detailLoadFinallyEffectsPlan(input = {}) {
			const id = text(input.id || input.threadId).trim();
			if (!id) return skipPaneSlot("missing-id", { id });
			return {
				action: "detail-load-finally-effects",
				reason: "settle",
				id,
				clearController: input.controllerMatches === true,
				clearLoading: true,
				renderPane: input.visible === true,
				preserveScroll: true,
				scheduleQueueDrain: true
			};
		}
		return {
			DEFAULT_DETAIL_LOAD_MAX_CONCURRENT,
			DEFAULT_OPERATION_BUBBLE_MIN_VISIBLE_MS,
			DEFAULT_USER_MAX_PANES,
			activePaneSyncPlan,
			candidatePaneIdsPlan,
			closePanePlan,
			composerActionControlPlan,
			composerDraftRuntimeSelectionPlan,
			composerTargetPlaceholderPlan,
			composerTargetPlan,
			displaySettingsPayload,
			displaySettingsLoadPlan,
			dropPaneIntent,
			effectiveSelectedThreadId,
			idsEqual,
			layoutCapacity,
			normalizeDisplaySettings,
			normalizeOperationMode,
			normalizePaneCount,
			normalizePinnedIds,
			normalizeSplitPairs,
			operationModeTogglePlan,
			operationBubbleRecord,
			operationBubbleSnapshot,
			operationDockPlan,
			operationMinimumRefreshPlan,
			operationSignature,
			paneBottomButtonPlan,
			paneCountChangePlan,
			paneCountStatePlan,
			paneDisplayLayoutPlan,
			panePatchCompletionPlan,
			panePatchPreflightPlan,
			paneRenderFramePlan,
			paneRenderSignaturePlan,
			paneSelectionPlan,
			paneSlotMutationEffectsPlan,
			paneScrollHoldPlan,
			paneScrollMetrics,
			paneScrollRestorePlan,
			prependSplitPair,
			detailLoadPlan,
			detailLoadErrorEffectsPlan,
			detailLoadFinallyEffectsPlan,
			detailLoadConcurrencyPlan,
			detailLoadQueueDrainPlan,
			detailLoadQueuePlan,
			detailLoadStartEffectsPlan,
			detailLoadSuccessEffectsPlan,
			refreshDelayMs,
			refreshSchedulePlan,
			refreshTargetIds,
			replaceLastPaneForThreadListOpenPlan,
			replacePaneThreadPlan,
			removeSplitPairsForIds,
			movePaneRelativePlan,
			selectPanePlan,
			selectedPaneEffectsPlan,
			splitPaneWithTargetPlan,
			switchMenuOptionsPlan,
			switchMenuPlan,
			syncPinnedIdsFromActiveIds,
			threadTileVerticalChromePlan,
			threadTileViewportBaselinePlan,
			toggleOperationMode,
			uniqueIds
		};
	});
}));
//#endregion
//#region \0virtual:codex-mobile-esm-compatibility/shard/shard-02
var import_plugin_voice_input = /* @__PURE__ */ __toESM(require_plugin_voice_input());
var import_api_client = /* @__PURE__ */ __toESM(require_api_client());
var import_markdown_renderer = /* @__PURE__ */ __toESM(require_markdown_renderer());
var import_plugin_embed = /* @__PURE__ */ __toESM(require_plugin_embed());
var import_frontend_runtime_health = /* @__PURE__ */ __toESM(require_frontend_runtime_health());
var import_home_ai_diagnostic_reporting = /* @__PURE__ */ __toESM(require_home_ai_diagnostic_reporting());
var import_thread_diagnostic_events = /* @__PURE__ */ __toESM(require_thread_diagnostic_events());
var import_thread_tile_layout = /* @__PURE__ */ __toESM(require_thread_tile_layout());
var import_thread_tile_actions = /* @__PURE__ */ __toESM(require_thread_tile_actions());
var import_thread_tile_state = /* @__PURE__ */ __toESM(require_thread_tile_state());
var moduleDefinitions = [
	{
		"id": "plugin-voice-input",
		"source": "public/plugin-voice-input.js",
		"globalName": "CodexPluginVoiceInput",
		"expectedFunctions": [
			"actionFromMessageType",
			"capabilityStateMessage",
			"errorMessage",
			"insertResultMessage",
			"isVoiceInputMessage",
			"normalizeAction",
			"startRequestMessage",
			"textFromMessage"
		],
		"assetPath": "/plugin-voice-input.js",
		"classicLoaderExcluded": true,
		"bytes": 8247
	},
	{
		"id": "api-client",
		"source": "public/api-client.js",
		"globalName": "CodexApiClient",
		"expectedFunctions": ["createApiClient", "isFormDataBody"],
		"assetPath": "/api-client.js",
		"classicLoaderExcluded": true,
		"bytes": 4099
	},
	{
		"id": "markdown-renderer",
		"source": "public/markdown-renderer.js",
		"globalName": "CodexMarkdownRenderer",
		"expectedFunctions": [
			"escapeHtml",
			"safeMarkdownUrl",
			"renderInlineMarkdown",
			"renderMarkdown",
			"renderMarkdownList",
			"renderMarkdownTable",
			"splitMarkdownTableRow",
			"isMarkdownTableSeparator"
		],
		"assetPath": "/markdown-renderer.js",
		"classicLoaderExcluded": true,
		"bytes": 18044
	},
	{
		"id": "plugin-embed",
		"source": "public/plugin-embed.js",
		"globalName": "CodexPluginEmbed",
		"expectedFunctions": [
			"detect",
			"navigationMessage",
			"routeHintOpenPlan",
			"routeHintTargetSelectors",
			"scrubRouteHintPath",
			"externalLinkMessage",
			"refreshRequiredMessage"
		],
		"assetPath": "/plugin-embed.js",
		"classicLoaderExcluded": true,
		"bytes": 14761
	},
	{
		"id": "frontend-runtime-health",
		"source": "public/frontend-runtime-health.js",
		"globalName": "CodexFrontendRuntimeHealth",
		"expectedFunctions": [
			"compactToken",
			"createMonitor",
			"submittedMessageDomProbeEffects",
			"threadListInteractionStallEffects",
			"renderChurnEvent",
			"domDropEvent",
			"runtimeSuccess"
		],
		"assetPath": "/frontend-runtime-health.js",
		"classicLoaderExcluded": true,
		"bytes": 17014
	},
	{
		"id": "home-ai-diagnostic-reporting",
		"source": "public/home-ai-diagnostic-reporting.js",
		"globalName": "CodexHomeAiDiagnosticReporting",
		"expectedFunctions": [
			"boundedToken",
			"createDiagnosticReporter",
			"durationBucket",
			"hashIdentifier",
			"postReportToHomeAi",
			"sanitizeInput",
			"stableTextHash"
		],
		"assetPath": "/home-ai-diagnostic-reporting.js",
		"classicLoaderExcluded": true,
		"bytes": 14358
	},
	{
		"id": "thread-diagnostic-events",
		"source": "public/thread-diagnostic-events.js",
		"globalName": "CodexThreadDiagnosticEvents",
		"expectedFunctions": [
			"boundedCount",
			"compactToken",
			"conversationProjectionDiagnosticSnapshot",
			"conversationProjectionConsistencyEffects",
			"projectionDiagnosticSnapshot",
			"renderSignatureMismatchDiagnosticEvent",
			"threadDetailResponseDiagnosticEffects",
			"turnOrderDiagnosticSnapshot"
		],
		"assetPath": "/thread-diagnostic-events.js",
		"classicLoaderExcluded": true,
		"bytes": 46238
	},
	{
		"id": "thread-tile-layout",
		"source": "public/thread-tile-layout.js",
		"globalName": "CodexThreadTileLayout",
		"expectedFunctions": [
			"layoutForViewport",
			"normalizeSplitPairs",
			"selectPinnedThreadTileIds",
			"selectThreadTileIds",
			"threadTileColumnGroups"
		],
		"assetPath": "/thread-tile-layout.js",
		"classicLoaderExcluded": true,
		"bytes": 8454
	},
	{
		"id": "thread-tile-actions",
		"source": "public/thread-tile-actions.js",
		"globalName": "CodexThreadTileActions",
		"expectedFunctions": [
			"closestWithin",
			"resolveThreadTilePointerAction",
			"resolveThreadTileFocusAction",
			"resolveThreadTileClickAction",
			"resolveThreadTileScrollAction",
			"resolveThreadTileDragStartAction",
			"resolveThreadTileDragOverAction",
			"resolveThreadTileDragLeaveAction",
			"resolveThreadTileDropAction"
		],
		"assetPath": "/thread-tile-actions.js",
		"classicLoaderExcluded": true,
		"bytes": 7380
	},
	{
		"id": "thread-tile-state",
		"source": "public/thread-tile-state.js",
		"globalName": "CodexThreadTileState",
		"expectedFunctions": [
			"activePaneSyncPlan",
			"candidatePaneIdsPlan",
			"closePanePlan",
			"composerActionControlPlan",
			"composerDraftRuntimeSelectionPlan",
			"composerTargetPlaceholderPlan",
			"composerTargetPlan",
			"displaySettingsPayload",
			"displaySettingsLoadPlan",
			"dropPaneIntent",
			"effectiveSelectedThreadId",
			"idsEqual",
			"layoutCapacity",
			"normalizeDisplaySettings",
			"normalizeOperationMode",
			"normalizePaneCount",
			"normalizePinnedIds",
			"normalizeSplitPairs",
			"operationModeTogglePlan",
			"operationBubbleRecord",
			"operationBubbleSnapshot",
			"operationDockPlan",
			"operationMinimumRefreshPlan",
			"operationSignature",
			"paneBottomButtonPlan",
			"paneCountChangePlan",
			"paneCountStatePlan",
			"paneDisplayLayoutPlan",
			"panePatchCompletionPlan",
			"panePatchPreflightPlan",
			"paneRenderFramePlan",
			"paneRenderSignaturePlan",
			"paneSelectionPlan",
			"paneSlotMutationEffectsPlan",
			"paneScrollHoldPlan",
			"paneScrollMetrics",
			"paneScrollRestorePlan",
			"prependSplitPair",
			"detailLoadPlan",
			"detailLoadErrorEffectsPlan",
			"detailLoadFinallyEffectsPlan",
			"detailLoadConcurrencyPlan",
			"detailLoadQueueDrainPlan",
			"detailLoadQueuePlan",
			"detailLoadStartEffectsPlan",
			"detailLoadSuccessEffectsPlan",
			"refreshDelayMs",
			"refreshSchedulePlan",
			"refreshTargetIds",
			"replaceLastPaneForThreadListOpenPlan",
			"replacePaneThreadPlan",
			"removeSplitPairsForIds",
			"movePaneRelativePlan",
			"selectPanePlan",
			"selectedPaneEffectsPlan",
			"splitPaneWithTargetPlan",
			"switchMenuOptionsPlan",
			"switchMenuPlan",
			"syncPinnedIdsFromActiveIds",
			"threadTileVerticalChromePlan",
			"threadTileViewportBaselinePlan",
			"toggleOperationMode",
			"uniqueIds"
		],
		"assetPath": "/thread-tile-state.js",
		"classicLoaderExcluded": true,
		"bytes": 71980
	}
];
var moduleApis = {
	"plugin-voice-input": import_plugin_voice_input.default,
	"api-client": import_api_client.default,
	"markdown-renderer": import_markdown_renderer.default,
	"plugin-embed": import_plugin_embed.default,
	"frontend-runtime-health": import_frontend_runtime_health.default,
	"home-ai-diagnostic-reporting": import_home_ai_diagnostic_reporting.default,
	"thread-diagnostic-events": import_thread_diagnostic_events.default,
	"thread-tile-layout": import_thread_tile_layout.default,
	"thread-tile-actions": import_thread_tile_actions.default,
	"thread-tile-state": import_thread_tile_state.default
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
