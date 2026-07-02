import { i as __toESM, r as __commonJSMin } from "./vite-shell-entry-C_fqZHha.js";
//#region public/media-preview-runtime.js
var require_media_preview_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function attachMediaPreviewRuntime(root) {
		function noop() {}
		function noopFalse() {
			return false;
		}
		function noopString() {
			return "";
		}
		function defaultRequestAnimationFrame(callback) {
			return typeof root.setTimeout === "function" ? root.setTimeout(callback, 16) : 0;
		}
		function defaultEscapeHtml(value) {
			return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
		}
		function createMediaPreviewRuntime(deps = {}) {
			const state = deps.state || {};
			const $ = typeof deps.$ === "function" ? deps.$ : () => null;
			const document = deps.document || root.document || {};
			const window = deps.window || root.window || root;
			const fetch = typeof deps.fetch === "function" ? deps.fetch : typeof root.fetch === "function" ? root.fetch.bind(root) : async () => {
				throw new Error("fetch unavailable");
			};
			const FileReader = deps.FileReader || root.FileReader;
			const requestAnimationFrame = typeof deps.requestAnimationFrame === "function" ? deps.requestAnimationFrame : typeof root.requestAnimationFrame === "function" ? root.requestAnimationFrame.bind(root) : defaultRequestAnimationFrame;
			const CLIENT_BUILD_ID = String(deps.CLIENT_BUILD_ID || "");
			const FILE_PREVIEW_SWIPE_CLOSE_MIN_PX = Number(deps.FILE_PREVIEW_SWIPE_CLOSE_MIN_PX || 62);
			const GITHUB_LINK_PREVIEW_TIMEOUT_MS = Number(deps.GITHUB_LINK_PREVIEW_TIMEOUT_MS || 12e3);
			const IMAGE_DIAGNOSTICS_ENABLED = deps.IMAGE_DIAGNOSTICS_ENABLED === true;
			const IMAGE_PREVIEW_MAX_SCALE = Number(deps.IMAGE_PREVIEW_MAX_SCALE || 4);
			const IMAGE_PREVIEW_MIN_SCALE = Number(deps.IMAGE_PREVIEW_MIN_SCALE || .5);
			const IMAGE_PREVIEW_ZOOM_STEP = Number(deps.IMAGE_PREVIEW_ZOOM_STEP || .25);
			const MERMAID_MAX_SCALE = Number(deps.MERMAID_MAX_SCALE || 3.2);
			const MERMAID_MIN_SCALE = Number(deps.MERMAID_MIN_SCALE || .65);
			const MERMAID_SCRIPT_URL = String(deps.MERMAID_SCRIPT_URL || "/vendor/mermaid.min.js");
			const MERMAID_ZOOM_STEP = Number(deps.MERMAID_ZOOM_STEP || .2);
			const PERF_EVENT_THROTTLE_MS = Number(deps.PERF_EVENT_THROTTLE_MS || 2e3);
			const PROTECTED_IMAGE_PLACEHOLDER_SRC = String(deps.PROTECTED_IMAGE_PLACEHOLDER_SRC || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==");
			const githubLinkPreviewCache = deps.githubLinkPreviewCache || /* @__PURE__ */ new Map();
			const { api = async () => ({}), compactStructuredForSignature = (value) => JSON.stringify(value), copyButtonHtml = noopString, diagnosticItemHash = (value) => String(value || ""), escapeHtml = defaultEscapeHtml, isHermesEmbedMode = noopFalse, isIosWebKitBrowser = noopFalse, normalizeFsPath = (value) => String(value || "").replace(/\\/g, "\\"), nowPerfMs = () => Date.now(), postPerformanceEvent = noop, primaryTouch = (event) => event && event.touches && event.touches[0] || null, publishPluginNavigationState = noop, recordHomeAiDiagnosticFailure = noop, recordHomeAiDiagnosticSuccess = noop, rememberCopyText = (value) => String(value || ""), renderContextThreadId = noopString, requestHermesPluginRefresh = noop, roundedDurationMs = (startedAt) => Math.max(0, Date.now() - Number(startedAt || Date.now())), shortPath = (value) => String(value || ""), stableTextHash = (value) => String(value || ""), truncateSingleLine = (value) => String(value || ""), visibleThreadTaskCardCommandText = (value) => String(value || "") } = deps;
			function imageUrlValue(part) {
				if (!part || typeof part !== "object") return "";
				const raw = part.url || part.image_url || part.imageUrl || "";
				if (raw && typeof raw === "object") return String(raw.url || raw.uri || raw.href || "");
				return String(raw || "");
			}
			function isInputTextPart(part) {
				if (!part || typeof part !== "object") return false;
				const type = String(part.type || "");
				return type === "text" || type === "input_text";
			}
			function inputTextValue(part) {
				if (!part || typeof part !== "object") return "";
				if (typeof part.text === "string") return part.text;
				if (typeof part.input_text === "string") return part.input_text;
				if (part.type === "input_text" && typeof part.content === "string") return part.content;
				return "";
			}
			function isInputImagePart(part) {
				if (!part || typeof part !== "object") return false;
				const type = String(part.type || "");
				const url = imageUrlValue(part);
				if (isTruncatedImagePayloadPart(part)) return true;
				return type === "image" || type === "localImage" || type === "input_image" || type === "image_url" || /^data:image\//i.test(url);
			}
			function isTruncatedImagePayloadPart(part) {
				if (!part || typeof part !== "object" || !part.truncated) return false;
				const preview = String(part.preview || "");
				return /data:image\//i.test(preview) || /"type"\s*:\s*"image"/i.test(preview);
			}
			function attachmentSummaryMarkerMatch(source) {
				return /(^|\r?\n)[ \t]*(?:>[ \t]*)?Uploaded attachments:[ \t]*(?:\r?\n|$)/.exec(source);
			}
			function stripAttachmentSummaryLinePrefix(line) {
				return String(line || "").trim().replace(/^>[ \t]?/, "").trim();
			}
			function splitAttachmentSummaryText(text) {
				const source = String(text || "");
				const markerMatch = attachmentSummaryMarkerMatch(source);
				if (!markerMatch) return {
					text: source,
					attachments: []
				};
				const markerStart = markerMatch.index + (markerMatch[1] || "").length;
				const before = source.slice(0, markerStart).trimEnd();
				const attachments = [];
				const remainder = [];
				let parsingAttachments = true;
				for (const line of source.slice(markerMatch.index + markerMatch[0].length).split(/\r?\n/)) {
					const trimmed = stripAttachmentSummaryLinePrefix(line);
					if (parsingAttachments && !trimmed) continue;
					const attachment = parsingAttachments ? parseAttachmentLine(trimmed) : null;
					if (attachment) {
						attachments.push(attachment);
						continue;
					}
					parsingAttachments = false;
					remainder.push(line);
				}
				const after = remainder.join("\n").trimStart();
				return {
					text: [before, after].filter(Boolean).join(before && after ? "\n\n" : ""),
					attachments
				};
			}
			function parseAttachmentLine(line) {
				const match = /^-\s*(.*?)\s*\((.*?)\):\s*(.+)$/.exec(String(line || ""));
				if (!match) return null;
				const meta = match[2] || "";
				return {
					name: match[1] || "attachment",
					meta,
					path: (match[3] || "").trim(),
					isImage: /\bimage\b/i.test(meta)
				};
			}
			function codexMobileUploadIdForPath(filePath) {
				const text = String(filePath || "").trim().replace(/^\\\\\?\\/, "").replace(/\\/g, "/").replace(/\/+$/, "");
				if (!text) return "";
				const index = text.toLowerCase().indexOf("/.codex-mobile-web/uploads/");
				if (index < 0) return "";
				const id = text.slice(index + 27).replace(/^\/+/, "");
				if (!id || /^[a-zA-Z]:/.test(id) || id.split("/").some((part) => !part || part === "." || part === "..")) return "";
				return id;
			}
			function uploadFileUrl(filePath) {
				const uploadId = codexMobileUploadIdForPath(filePath);
				const params = uploadId ? new URLSearchParams({ id: uploadId }) : new URLSearchParams({ path: filePath });
				if (state.key) params.set("key", state.key);
				return authenticatedApiContentUrl(`/api/uploads/file?${params.toString()}`);
			}
			function isCodexMobileUploadPath(filePath) {
				return normalizeFsPath(filePath).includes("\\.codex-mobile-web\\uploads\\");
			}
			function imageContentUrlForPath(filePath, options = {}) {
				if (!filePath) return "";
				return isCodexMobileUploadPath(filePath) ? uploadFileUrl(filePath) : localFilePreviewContentUrl(filePath, options);
			}
			function localAttachmentPreviewUrl(attachment) {
				const value = String(attachment && (attachment.previewUrl || attachment.objectUrl || attachment.localUrl) || "").trim();
				return /^(blob:|data:image\/)/i.test(value) ? value : "";
			}
			function imageSourceForPart(part, attachment = null) {
				const previewUrl = localAttachmentPreviewUrl(attachment);
				if (previewUrl) return previewUrl;
				if (attachment && attachment.path && isLikelyAbsoluteLocalPath(attachment.path)) return imageContentUrlForPath(attachment.path);
				if (part.path) return imageContentUrlForPath(part.path);
				const url = imageUrlValue(part);
				if (isLikelyAbsoluteLocalPath(url)) return imageContentUrlForPath(url);
				return url || "";
			}
			function isLikelyAbsoluteLocalPath(value) {
				const text = String(value || "").trim();
				return /^[a-zA-Z]:[\\/]/.test(text) || /^\\\\/.test(text) || text.startsWith("/");
			}
			function canRenderImageAttachment(attachment) {
				return Boolean(attachment && attachment.isImage && isLikelyAbsoluteLocalPath(attachment.path));
			}
			function isInjectedThreadTaskCardMessage(text) {
				const value = String(text || "").trimStart();
				return value.startsWith("[Cross-thread task card sent by source thread]") || value.startsWith("[Cross-thread task card approved]") || value.startsWith("[Codex Mobile task-card continuation]") || /^#\s*Continuation Bootstrap Index\b/i.test(value);
			}
			function injectedThreadTaskCardLineValue(lines, label) {
				const pattern = new RegExp(`^\\s*(?:[-*]\\s*)?${label}:\\s*`, "i");
				const line = (Array.isArray(lines) ? lines : []).find((entry) => pattern.test(entry));
				return line ? line.replace(pattern, "").trim() : "";
			}
			function injectedThreadTaskCardPurpose(lines) {
				const firstLine = String(Array.isArray(lines) ? lines[0] || "" : "").trim();
				if (/^#\s*Continuation Bootstrap Index\b/i.test(firstLine)) return "Continuation Bootstrap Index";
				if (/^\[Codex Mobile task-card continuation\]/i.test(firstLine)) return injectedThreadTaskCardLineValue(lines, "Title") || "Task-card continuation";
				const title = injectedThreadTaskCardLineValue(lines, "Title");
				if (title) return title;
				const bodyLine = (Array.isArray(lines) ? lines : []).find((line) => {
					const text = String(line || "").trim();
					return text && !text.startsWith("[Cross-thread task card") && !text.startsWith("[Codex Mobile task-card continuation]") && !/^#\s*Continuation Bootstrap Index\b/i.test(text) && !/^(?:[-*]\s*)?(Source workspace|Source thread|Source thread id|Source thread title|Approval|Workflow mode|Workflow id|Auto-return|Continuation Target|Source Thread|Workspace Context Files):/i.test(text);
				});
				return bodyLine ? bodyLine.replace(/^#+\s*/, "").trim() : "Cross-thread task card";
			}
			function injectedThreadTaskCardMetadata(text) {
				const value = String(text || "").replace(/\r\n?/g, "\n").trim();
				const lines = value.split("\n");
				return {
					value,
					source: injectedThreadTaskCardLineValue(lines, "Source thread") || injectedThreadTaskCardLineValue(lines, "Source thread title") || injectedThreadTaskCardLineValue(lines, "Source thread id") || (/^#\s*Continuation Bootstrap Index\b/i.test(value) ? "Continuation" : "source thread"),
					purpose: injectedThreadTaskCardPurpose(lines),
					charCount: value.length.toLocaleString()
				};
			}
			function injectedThreadTaskCardSummary(text) {
				const metadata = injectedThreadTaskCardMetadata(text);
				return `来源：${truncateSingleLine(metadata.source, 72)} · 目的：${truncateSingleLine(metadata.purpose, 96)}`;
			}
			function injectedThreadTaskCardTextForItem(item) {
				if (!item || item.type !== "userMessage") return "";
				const content = Array.isArray(item.content) ? item.content : [];
				for (const part of content) {
					if (!part) continue;
					const text = isInputTextPart(part) ? inputTextValue(part) : "";
					if (isInjectedThreadTaskCardMessage(text)) return text;
				}
				return "";
			}
			function renderInjectedThreadTaskCardBody(text, metadata = null) {
				const details = metadata || injectedThreadTaskCardMetadata(text);
				if (!isInjectedThreadTaskCardMessage(details.value)) return "";
				return `<details class="thread-task-card-message" data-thread-task-card-message>
    <summary><span>完整任务卡</span><small>${escapeHtml(`${details.charCount} chars`)}</small></summary>
    <pre class="thread-task-card-message-body">${escapeHtml(details.value)}</pre>
  </details>`;
			}
			function renderInjectedThreadTaskCardMessage(text) {
				const metadata = injectedThreadTaskCardMetadata(text);
				if (!isInjectedThreadTaskCardMessage(metadata.value)) return "";
				return `<div class="thread-task-card-message-standalone" data-thread-task-card-standalone>
    <div class="thread-task-card-message-overview">
      <div><span>来源</span><strong>${escapeHtml(metadata.source)}</strong></div>
      <div><span>目的</span><strong>${escapeHtml(metadata.purpose)}</strong></div>
    </div>
    ${renderInjectedThreadTaskCardBody(metadata.value, metadata)}
  </div>`;
			}
			function renderInputText(text) {
				if (!String(text || "").trim()) return "";
				const taskCardMessage = renderInjectedThreadTaskCardMessage(text);
				if (taskCardMessage) return taskCardMessage;
				return `<div class="input-text">${escapeHtml(text)}</div>`;
			}
			function renderInputImage(part, attachment = null, index = 0) {
				const src = imageSourceForPart(part, attachment);
				const label = attachment && attachment.name || shortPath(part.path || imageUrlValue(part) || "") || `Image ${index + 1}`;
				if (!src) return `<div class="input-attachment">${escapeHtml(label)}</div>`;
				const displaySrc = protectedImageDisplaySrc(src);
				return `<figure class="input-image">
    <img src="${escapeHtml(displaySrc)}" alt="Image" loading="${imageLoadingModeForSource(src)}"${protectedImageSourceAttribute(src)}>
  </figure>`;
			}
			function renderInputAttachment(attachment) {
				const label = attachment.name || shortPath(attachment.path) || "attachment";
				const meta = attachment.meta ? ` (${attachment.meta})` : "";
				return `<div class="input-attachment">
    <span>${escapeHtml(label)}</span>
    <span>${escapeHtml(meta)}</span>
    ${attachment.path ? `<code>${escapeHtml(attachment.path)}</code>` : ""}
  </div>`;
			}
			function renderAttachmentSummary(attachments, imageParts = []) {
				const html = [];
				const imageAttachments = (attachments || []).filter((attachment) => attachment.isImage);
				const parts = Array.isArray(imageParts) ? imageParts : [];
				parts.forEach((part, index) => {
					html.push(renderInputImage(part, imageAttachments[index] || null, index));
				});
				const renderedImageAttachments = /* @__PURE__ */ new Set();
				if (!parts.length) imageAttachments.filter(canRenderImageAttachment).forEach((attachment, index) => {
					renderedImageAttachments.add(attachment);
					html.push(renderInputImage({ path: attachment.path }, attachment, index));
				});
				(attachments || []).filter((attachment) => !renderedImageAttachments.has(attachment) && (!attachment.isImage || !parts.length)).forEach((attachment) => html.push(renderInputAttachment(attachment)));
				return html.join("");
			}
			function renderInputContent(content) {
				const parts = content || [];
				const imageParts = parts.filter(isInputImagePart);
				const attachments = [];
				const html = [];
				for (const part of parts) {
					if (!part || isInputImagePart(part)) continue;
					if (isInputTextPart(part)) {
						const split = splitAttachmentSummaryText(visibleThreadTaskCardCommandText(inputTextValue(part)));
						if (split.text) html.push(renderInputText(split.text));
						attachments.push(...split.attachments);
						continue;
					}
					html.push(`<div class="input-text">${escapeHtml(compactStructuredForSignature(part))}</div>`);
				}
				html.push(renderAttachmentSummary(attachments, imageParts));
				return html.join("");
			}
			function renderMarkdown(value, markdownOptions = {}) {
				const renderer = window.CodexMarkdownRenderer;
				if (!renderer || typeof renderer.renderMarkdown !== "function") return `<div class="markdown-body"><p>${escapeHtml(value || "")}</p></div>`;
				return renderer.renderMarkdown(value, {
					rememberCopyText,
					copyButtonHtml,
					...markdownOptions
				});
			}
			function renderMarkdownWithAttachmentSummary(value) {
				const split = splitAttachmentSummaryText(value || "");
				if (!split.attachments.length) return renderMarkdown(value || "", { fencedTableMode: "preview" });
				return [split.text ? renderMarkdown(split.text, { fencedTableMode: "preview" }) : "", renderAttachmentSummary(split.attachments)].filter(Boolean).join("");
			}
			function commandOutputBody(value) {
				const text = String(value || "").replace(/\r\n?/g, "\n").trim();
				if (!text) return "";
				const markerIndex = text.indexOf("\nOutput:\n");
				if (markerIndex < 0) return text;
				return text.slice(markerIndex + 9).trim();
			}
			function stripCommandOutputLineNumbers(value) {
				const text = String(value || "");
				if (!text) return "";
				const lines = text.split("\n");
				const numberedCount = lines.filter((line) => /^\s*\d+\t/.test(line)).length;
				if (numberedCount < 3 || numberedCount < Math.ceil(lines.length * .4)) return text;
				return lines.map((line) => line.replace(/^\s*\d+\t/, "")).join("\n");
			}
			function isMarkdownTableSeparatorLine(line) {
				const cells = String(line || "").trim().replace(/^\||\|$/g, "").split("|");
				return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
			}
			function containsMarkdownTable(value) {
				const lines = String(value || "").split("\n");
				for (let index = 0; index < lines.length - 1; index += 1) {
					if (!lines[index].includes("|")) continue;
					if (isMarkdownTableSeparatorLine(lines[index + 1])) return true;
				}
				return false;
			}
			function commandOutputMarkdownPreview(value, item = {}) {
				if (!value || item.type !== "commandExecution") return "";
				const body = stripCommandOutputLineNumbers(commandOutputBody(value));
				if (!containsMarkdownTable(body)) return "";
				return body;
			}
			function normalizeGitHubLinkPreview(value) {
				if (!value || typeof value !== "object") return null;
				const preview = value.preview && typeof value.preview === "object" ? value.preview : null;
				if (!preview || !value.supported) return null;
				const url = String(preview.url || value.url || "").trim();
				if (!url) return null;
				return {
					provider: "github",
					kind: String(preview.kind || "").trim(),
					kindLabel: String(preview.kindLabel || "GitHub").trim() || "GitHub",
					url,
					title: String(preview.title || "").trim(),
					subtitle: String(preview.subtitle || "").trim(),
					description: String(preview.description || "").trim(),
					meta: String(preview.meta || "").trim(),
					avatarUrl: String(preview.avatarUrl || "").trim(),
					accent: String(preview.accent || "").trim(),
					state: String(preview.state || "").trim(),
					stateLabel: String(preview.stateLabel || "").trim()
				};
			}
			function normalizeGithubPreviewUrl(value) {
				let parsed;
				try {
					parsed = new URL(String(value || "").trim());
				} catch (_) {
					return "";
				}
				const host = String(parsed.hostname || "").toLowerCase();
				if (host !== "github.com" && host !== "www.github.com") return "";
				if (parsed.protocol !== "https:") return "";
				return parsed.toString();
			}
			function gitHubLinkPreviewAccentClass(value) {
				const accent = String(value || "").trim().toLowerCase();
				if (accent === "open" || accent === "closed" || accent === "merged" || accent === "repo" || accent === "commit" || accent === "muted") return accent;
				return "muted";
			}
			function renderGitHubLinkPreviewCard(preview) {
				const accent = gitHubLinkPreviewAccentClass(preview && preview.accent);
				const statePill = preview && preview.stateLabel ? `<span class="github-link-card-state state-${escapeHtml(gitHubLinkPreviewAccentClass(preview.state || accent))}">${escapeHtml(preview.stateLabel)}</span>` : "";
				const avatar = preview && preview.avatarUrl ? `<img class="github-link-card-avatar" src="${escapeHtml(preview.avatarUrl)}" alt="" loading="lazy">` : `<span class="github-link-card-avatar github-link-card-avatar-fallback" aria-hidden="true">GH</span>`;
				const subtitle = preview && preview.subtitle ? `<div class="github-link-card-subtitle">${escapeHtml(preview.subtitle)}</div>` : "";
				const description = preview && preview.description ? `<div class="github-link-card-description">${escapeHtml(preview.description)}</div>` : "";
				const meta = preview && preview.meta ? `<div class="github-link-card-meta">${escapeHtml(preview.meta)}</div>` : "";
				return `<a class="github-link-card github-link-card-${escapeHtml(accent)}" href="${escapeHtml(preview.url)}" target="_blank" rel="noreferrer">
    <div class="github-link-card-head">
      <span class="github-link-card-badge">GitHub</span>
      <span class="github-link-card-kind">${escapeHtml(preview.kindLabel || "GitHub")}</span>
      ${statePill}
    </div>
    <div class="github-link-card-body">
      ${avatar}
      <div class="github-link-card-copy">
        <div class="github-link-card-title">${escapeHtml(preview.title || preview.url)}</div>
        ${subtitle}
        ${description}
        ${meta}
      </div>
    </div>
  </a>`;
			}
			async function fetchGitHubLinkPreview(url) {
				const cacheKey = String(url || "").trim();
				if (!cacheKey) return null;
				const cached = githubLinkPreviewCache.get(cacheKey);
				if (cached && cached.value) return cached.value;
				if (cached && cached.promise) return cached.promise;
				const promise = api(`/api/link-previews/github?url=${encodeURIComponent(cacheKey)}`, { timeoutMs: GITHUB_LINK_PREVIEW_TIMEOUT_MS }).then((value) => {
					const preview = normalizeGitHubLinkPreview(value);
					githubLinkPreviewCache.set(cacheKey, { value: preview });
					return preview;
				}).catch((err) => {
					githubLinkPreviewCache.delete(cacheKey);
					throw err;
				});
				githubLinkPreviewCache.set(cacheKey, { promise });
				return promise;
			}
			function githubLinkPreviewHosts(root = document) {
				if (!root || typeof root.querySelectorAll !== "function") return [];
				const hosts = [];
				const seen = /* @__PURE__ */ new Set();
				const push = (node) => {
					if (!node || seen.has(node)) return;
					seen.add(node);
					hosts.push(node);
				};
				if (typeof root.matches === "function" && root.matches(".item-body, #filePreviewBody")) push(root);
				root.querySelectorAll(".item-body, #filePreviewBody").forEach(push);
				return hosts;
			}
			function gitHubLinkPreviewSummary(url) {
				let parsed;
				try {
					parsed = new URL(String(url || "").trim());
				} catch (_) {
					return {
						repo: "GitHub",
						detail: "链接"
					};
				}
				const parts = parsed.pathname.split("/").filter(Boolean);
				const repo = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : "GitHub";
				let detail = "Repository";
				if (parts[2] === "issues" && parts[3]) detail = parsed.hash.startsWith("#issuecomment-") ? `#${parts[3]} comment` : `Issue #${parts[3]}`;
				else if (parts[2] === "pull" && parts[3]) detail = `PR #${parts[3]}`;
				else if (parts[2] === "commit" && parts[3]) detail = `Commit ${parts[3].slice(0, 7)}`;
				return {
					repo,
					detail
				};
			}
			function gitHubLinkPreviewInlineHost(link) {
				if (!link || typeof link.closest !== "function") return null;
				return link.closest("li, td, th, p");
			}
			function gitHubLinkPreviewInsertContainer(inlineHost) {
				if (!inlineHost) return null;
				if (inlineHost.tagName !== "P") return inlineHost;
				const next = inlineHost.nextElementSibling;
				if (next && next.matches && next.matches("[data-github-link-preview-node=\"true\"]")) return next;
				inlineHost.insertAdjacentHTML("afterend", `<span class="github-link-preview-node" data-github-link-preview-node="true"></span>`);
				return inlineHost.nextElementSibling;
			}
			function renderCollapsedGitHubLinkPreview(url) {
				const summary = gitHubLinkPreviewSummary(url);
				return `<span class="github-link-preview-inline" data-github-link-preview-inline="true">
    <button type="button" class="github-link-card-compact" data-github-link-preview-expand="true" aria-expanded="false" aria-label="预览 GitHub 链接">
      <span class="github-link-card-compact-badge">GitHub</span>
      <span class="github-link-card-compact-title">${escapeHtml(summary.detail)} · ${escapeHtml(summary.repo)}</span>
      <span class="github-link-card-compact-action">预览</span>
    </button>
    <span class="github-link-card-shell github-link-card-shell-deferred" hidden data-github-link-preview-url="${escapeHtml(url)}" data-github-link-preview-deferred="true">
      <span class="github-link-card-placeholder">正在加载 GitHub 预览...</span>
    </span>
  </span>`;
			}
			function ensureInlineGitHubLinkPreviews(root = document) {
				githubLinkPreviewHosts(root).forEach((host) => {
					host.querySelectorAll("a[href]").forEach((link) => {
						if (!link || typeof link.closest !== "function") return;
						if (link.dataset.githubLinkPreviewAttached === "true") return;
						if (link.closest(".github-link-card") || link.closest(".github-link-card-shell") || link.closest("[data-github-link-preview-inline]")) return;
						if (link.closest("pre") || link.closest("code")) return;
						const url = normalizeGithubPreviewUrl(link.getAttribute("href") || link.href || "");
						if (!url) return;
						const inlineHost = gitHubLinkPreviewInlineHost(link);
						if (!inlineHost) return;
						const insertContainer = gitHubLinkPreviewInsertContainer(inlineHost);
						if (!insertContainer) return;
						link.dataset.githubLinkPreviewAttached = "true";
						insertContainer.insertAdjacentHTML("beforeend", renderCollapsedGitHubLinkPreview(url));
					});
				});
			}
			function renderGitHubLinkPreviewUnavailable(url, label = "无法加载 GitHub 预览") {
				const href = normalizeGithubPreviewUrl(url) || String(url || "").trim();
				const link = href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">打开链接</a>` : "";
				return `<span class="github-link-card-unavailable">${escapeHtml(label)}${link ? ` · ${link}` : ""}</span>`;
			}
			function setGitHubPreviewCompactExpanded(button, expanded) {
				if (!button) return;
				button.classList.toggle("expanded", Boolean(expanded));
				button.setAttribute("aria-expanded", expanded ? "true" : "false");
				const action = button.querySelector(".github-link-card-compact-action");
				if (action) action.textContent = expanded ? "收起" : "预览";
			}
			function updateGitHubPreviewCompactTitle(slot, preview) {
				if (!slot || !preview || !preview.title) return;
				const wrapper = slot.closest ? slot.closest("[data-github-link-preview-inline]") : null;
				const title = wrapper ? wrapper.querySelector(".github-link-card-compact-title") : null;
				if (!title) return;
				title.textContent = `${preview.kindLabel ? `${preview.kindLabel} · ` : ""}${preview.title}`;
			}
			function toggleGitHubLinkPreview(button) {
				const wrapper = button && button.closest ? button.closest("[data-github-link-preview-inline]") : null;
				if (!wrapper) return;
				const slot = wrapper.querySelector(".github-link-card-shell[data-github-link-preview-url]");
				if (!slot) return;
				if (wrapper.dataset.githubLinkPreviewExpanded === "true") {
					wrapper.dataset.githubLinkPreviewExpanded = "false";
					setGitHubPreviewCompactExpanded(button, false);
					slot.hidden = true;
					slot.classList.add("github-link-card-shell-deferred");
					slot.dataset.githubLinkPreviewDeferred = "true";
					return;
				}
				wrapper.dataset.githubLinkPreviewExpanded = "true";
				setGitHubPreviewCompactExpanded(button, true);
				slot.hidden = false;
				slot.classList.remove("github-link-card-shell-deferred");
				delete slot.dataset.githubLinkPreviewDeferred;
				hydrateGitHubLinkCard(slot).catch(() => {});
			}
			async function hydrateGitHubLinkCard(slot) {
				if (!slot || !slot.dataset) return;
				if (typeof slot.matches === "function" && !slot.matches(".github-link-card-shell[data-github-link-preview-url]")) return;
				const url = String(slot.dataset.githubLinkPreviewUrl || "").trim();
				if (!url) return;
				if (slot.dataset.githubLinkPreviewState === "done") return;
				if (slot.dataset.githubLinkPreviewState === "loading") return;
				slot.dataset.githubLinkPreviewState = "loading";
				slot.classList.add("loading");
				try {
					const preview = await fetchGitHubLinkPreview(url);
					if (!preview) {
						slot.innerHTML = renderGitHubLinkPreviewUnavailable(url);
						slot.dataset.githubLinkPreviewState = "unsupported";
						slot.classList.remove("loading");
						return;
					}
					slot.innerHTML = renderGitHubLinkPreviewCard(preview);
					updateGitHubPreviewCompactTitle(slot, preview);
					slot.dataset.githubLinkPreviewState = "done";
					slot.classList.remove("loading");
				} catch (_) {
					slot.innerHTML = renderGitHubLinkPreviewUnavailable(url);
					slot.dataset.githubLinkPreviewState = "error";
					slot.classList.remove("loading");
				}
			}
			function hydrateGitHubLinkCards(root = document) {
				if (!root || typeof root.querySelectorAll !== "function") return;
				const startedAt = nowPerfMs();
				ensureInlineGitHubLinkPreviews(root);
				const slots = Array.from(root.querySelectorAll("[data-github-link-preview-url]:not([data-github-link-preview-deferred=\"true\"])"));
				slots.forEach((slot) => {
					hydrateGitHubLinkCard(slot).catch(() => {});
				});
				const inlineCount = root.querySelectorAll("[data-github-link-preview-inline='true']").length;
				if (slots.length || inlineCount) postPerformanceEvent("github_cards_hydrate_ms", {
					hydrateElapsedMs: roundedDurationMs(startedAt),
					queuedCards: slots.length,
					inlineCards: inlineCount,
					rootId: root && root.id || "",
					threadId: state.currentThreadId || ""
				}, {
					key: `github_cards_hydrate_ms|${root && root.id || "root"}`,
					minIntervalMs: PERF_EVENT_THROTTLE_MS
				});
			}
			function mermaidEffectiveTheme() {
				const preferred = String(document.documentElement.getAttribute("data-theme") || "system").trim().toLowerCase();
				if (preferred === "dark" || preferred === "light") return preferred;
				return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
			}
			function mermaidThemeName() {
				return mermaidEffectiveTheme() === "dark" ? "dark" : "default";
			}
			function mermaidConfig() {
				return {
					startOnLoad: false,
					securityLevel: "strict",
					theme: mermaidThemeName(),
					fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
					flowchart: {
						useMaxWidth: false,
						htmlLabels: true
					}
				};
			}
			function mermaidPreviewOpen() {
				const dialog = $("mermaidPreviewDialog");
				return Boolean(dialog && !dialog.classList.contains("hidden"));
			}
			function loadRuntimeScript(src, globalName) {
				const existing = document.querySelector(`script[data-runtime-script="${src}"]`);
				if (existing) {
					if (!globalName || window[globalName]) return Promise.resolve(window[globalName] || true);
					return new Promise((resolve, reject) => {
						existing.addEventListener("load", () => resolve(window[globalName] || true), { once: true });
						existing.addEventListener("error", () => reject(/* @__PURE__ */ new Error(`Failed to load ${src}`)), { once: true });
					});
				}
				return new Promise((resolve, reject) => {
					const script = document.createElement("script");
					script.src = src;
					script.async = true;
					script.dataset.runtimeScript = src;
					script.onload = () => resolve(globalName ? window[globalName] : true);
					script.onerror = () => reject(/* @__PURE__ */ new Error(`Failed to load ${src}`));
					document.head.appendChild(script);
				});
			}
			function configureMermaidApi(mermaidApi, options = {}) {
				if (!mermaidApi || typeof mermaidApi.initialize !== "function") return null;
				const theme = mermaidThemeName();
				if (!options.force && state.mermaidTheme === theme) return mermaidApi;
				mermaidApi.initialize(mermaidConfig());
				state.mermaidTheme = theme;
				return mermaidApi;
			}
			async function ensureMermaidApi() {
				if (window.mermaid && typeof window.mermaid.render === "function") return configureMermaidApi(window.mermaid, { force: !state.mermaidTheme });
				if (state.mermaidLoadPromise) return state.mermaidLoadPromise;
				state.mermaidLoadPromise = loadRuntimeScript(MERMAID_SCRIPT_URL, "mermaid").then((mermaidApi) => {
					if (!mermaidApi || typeof mermaidApi.render !== "function") throw new Error("Mermaid runtime unavailable");
					return configureMermaidApi(mermaidApi, { force: true });
				}).catch((err) => {
					state.mermaidLoadPromise = null;
					throw err;
				});
				return state.mermaidLoadPromise;
			}
			function mermaidCanvas(container) {
				return container ? container.querySelector("[data-mermaid-canvas]") : null;
			}
			function mermaidViewer(container) {
				return container ? container.querySelector("[data-mermaid-viewer]") : null;
			}
			function mermaidSourceFromContainer(container) {
				const source = container && container.querySelector(".markdown-mermaid-source");
				return source ? String(source.textContent || "") : String(container && container.dataset && container.dataset.mermaidSource || "");
			}
			function mermaidResetButton(container) {
				return container ? container.querySelector("[data-mermaid-action='reset']") : null;
			}
			function updateMermaidResetLabel(container, scale) {
				const button = mermaidResetButton(container);
				if (button) button.textContent = `${Math.round(scale * 100)}%`;
			}
			function clampMermaidScale(scale) {
				if (!Number.isFinite(scale)) return 1;
				return Math.min(MERMAID_MAX_SCALE, Math.max(MERMAID_MIN_SCALE, scale));
			}
			function mermaidCurrentScale(container) {
				return clampMermaidScale(Number(container && container.dataset ? container.dataset.mermaidScale || 1 : 1));
			}
			function mermaidSvgSize(svg) {
				if (!svg) return {
					width: 640,
					height: 360
				};
				const viewBox = svg.viewBox && svg.viewBox.baseVal;
				const width = Number(viewBox && viewBox.width || svg.getAttribute("width") || 0);
				const height = Number(viewBox && viewBox.height || svg.getAttribute("height") || 0);
				return {
					width: width > 0 ? width : 640,
					height: height > 0 ? height : 360
				};
			}
			function mermaidInitialScale(container, baseWidth) {
				const viewerEl = mermaidViewer(container);
				const fitWidth = viewerEl ? Math.max(0, viewerEl.clientWidth - 32) : 0;
				if (!fitWidth || !Number.isFinite(baseWidth) || baseWidth <= 0 || baseWidth <= fitWidth) return 1;
				return clampMermaidScale(fitWidth / baseWidth);
			}
			function applyMermaidScale(container, scale, options = {}) {
				const canvas = mermaidCanvas(container);
				const artboard = canvas && canvas.querySelector(".markdown-mermaid-artboard");
				if (!canvas || !artboard) return;
				const previousScale = mermaidCurrentScale(container);
				const nextScale = clampMermaidScale(scale);
				const baseWidth = Number(artboard.dataset.baseWidth || 0) || 640;
				const baseHeight = Number(artboard.dataset.baseHeight || 0) || 360;
				artboard.style.width = `${Math.max(180, Math.round(baseWidth * nextScale))}px`;
				artboard.style.height = `${Math.max(120, Math.round(baseHeight * nextScale))}px`;
				container.dataset.mermaidScale = String(nextScale);
				updateMermaidResetLabel(container, nextScale);
				if (options.viewer && Number.isFinite(options.anchorX) && Number.isFinite(options.anchorY) && Number.isFinite(options.contentX) && Number.isFinite(options.contentY) && previousScale > 0 && nextScale > 0) requestAnimationFrame(() => {
					options.viewer.scrollLeft = Math.max(0, options.contentX * nextScale - options.anchorX);
					options.viewer.scrollTop = Math.max(0, options.contentY * nextScale - options.anchorY);
				});
			}
			function showMermaidLoading(container, message = "正在渲染 Mermaid 图...") {
				const canvas = mermaidCanvas(container);
				if (!canvas) return;
				canvas.innerHTML = `<div class="markdown-mermaid-loading">${escapeHtml(message)}</div>`;
				updateMermaidResetLabel(container, 1);
			}
			function showMermaidError(container, sourceText, err) {
				const canvas = mermaidCanvas(container);
				if (canvas) {
					const message = err && err.message ? err.message : String(err || "Mermaid render failed");
					canvas.innerHTML = `<div class="markdown-mermaid-error">Mermaid 渲染失败<br>${escapeHtml(message)}</div>`;
				}
				const sourceDetails = container && container.querySelector(".markdown-mermaid-source-details");
				if (sourceDetails) sourceDetails.open = true;
				const previewSource = $("mermaidPreviewSource");
				if (previewSource && mermaidPreviewOpen() && container === $("mermaidPreviewDialog")) previewSource.textContent = sourceText || "";
			}
			function isMermaidErrorSvgMarkup(svgMarkup) {
				const text = String(svgMarkup || "");
				return /class=["'][^"']*\berror-icon\b/.test(text) || /class=["'][^"']*\berror-text\b/.test(text) || /Syntax error in text/.test(text);
			}
			function mermaidRenderArtifactIds(renderId) {
				const id = String(renderId || "").trim();
				return id ? [
					id,
					`d${id}`,
					`i${id}`
				] : [];
			}
			function isOwnedMermaidRenderNode(node) {
				return Boolean(node && node.closest && (node.closest("[data-mermaid-block='true']") || node.closest("#mermaidPreviewDialog") || node.closest(".markdown-mermaid-artboard")));
			}
			function removeNodeIfExternalMermaidArtifact(node) {
				if (!node || !node.remove || isOwnedMermaidRenderNode(node)) return false;
				node.remove();
				return true;
			}
			function cleanupMermaidRenderArtifacts(renderId) {
				mermaidRenderArtifactIds(renderId).forEach((id) => {
					removeNodeIfExternalMermaidArtifact(document.getElementById(id));
				});
			}
			function cleanupExternalMermaidErrorArtifacts(root = document) {
				(root && root.querySelectorAll ? root : document).querySelectorAll("svg .error-icon, svg .error-text").forEach((node) => {
					const svg = node.closest && node.closest("svg");
					removeNodeIfExternalMermaidArtifact(svg && svg.parentElement && /^d?codex-mobile-mermaid-/.test(String(svg.parentElement.id || "")) ? svg.parentElement : svg);
				});
			}
			function renderMermaidSvg(container, svgMarkup, options = {}) {
				const canvas = mermaidCanvas(container);
				if (!canvas) return;
				if (isMermaidErrorSvgMarkup(svgMarkup)) throw new Error("Mermaid syntax error");
				const artboard = document.createElement("div");
				artboard.className = "markdown-mermaid-artboard";
				artboard.innerHTML = String(svgMarkup || "");
				const svg = artboard.querySelector("svg");
				if (!svg) throw new Error("Mermaid SVG missing");
				if (svg.querySelector(".error-icon, .error-text")) throw new Error("Mermaid syntax error");
				const size = mermaidSvgSize(svg);
				artboard.dataset.baseWidth = String(size.width);
				artboard.dataset.baseHeight = String(size.height);
				svg.removeAttribute("width");
				svg.removeAttribute("height");
				svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
				canvas.innerHTML = "";
				canvas.appendChild(artboard);
				applyMermaidScale(container, mermaidInitialScale(container, size.width));
				if (options.sourceText) {
					const previewSource = $("mermaidPreviewSource");
					if (previewSource && container === $("mermaidPreviewDialog")) previewSource.textContent = options.sourceText;
				}
			}
			function mermaidRenderCandidates(sourceText) {
				const raw = String(sourceText || "");
				const normalizer = window.CodexMarkdownRenderer && typeof window.CodexMarkdownRenderer.normalizeMermaidSourceForRender === "function" ? window.CodexMarkdownRenderer.normalizeMermaidSourceForRender : null;
				const normalized = normalizer ? String(normalizer(raw) || "") : raw;
				if (!normalized || normalized === raw) return [raw];
				return [raw, normalized];
			}
			async function renderMermaidIntoContainer(container, sourceText, options = {}) {
				if (!container || !String(sourceText || "").trim()) return;
				showMermaidLoading(container, options.loadingMessage || "正在渲染 Mermaid 图...");
				const mermaidApi = await ensureMermaidApi();
				configureMermaidApi(mermaidApi);
				const renderId = `codex-mobile-mermaid-${++state.mermaidRenderSeq}`;
				let lastError = null;
				const candidates = mermaidRenderCandidates(sourceText);
				for (let index = 0; index < candidates.length; index += 1) {
					const candidateRenderId = `${renderId}-${index}`;
					try {
						const result = await mermaidApi.render(candidateRenderId, candidates[index]);
						cleanupMermaidRenderArtifacts(candidateRenderId);
						cleanupExternalMermaidErrorArtifacts();
						renderMermaidSvg(container, result && result.svg ? result.svg : "", { sourceText });
						const canvas = mermaidCanvas(container);
						if (canvas && result && typeof result.bindFunctions === "function") result.bindFunctions(canvas);
						return;
					} catch (err) {
						cleanupMermaidRenderArtifacts(candidateRenderId);
						cleanupExternalMermaidErrorArtifacts();
						lastError = err;
					}
				}
				throw lastError || /* @__PURE__ */ new Error("Mermaid render failed");
			}
			function hydrateMermaidBlock(block) {
				const sourceText = mermaidSourceFromContainer(block).trim();
				if (!block || !sourceText) return;
				const currentTheme = mermaidThemeName();
				if (block.dataset.mermaidRendered === "1" && block.dataset.mermaidTheme === currentTheme) return;
				const startedAt = nowPerfMs();
				renderMermaidIntoContainer(block, sourceText).then(() => {
					if (!block.isConnected) return;
					block.dataset.mermaidRendered = "1";
					block.dataset.mermaidTheme = currentTheme;
					postPerformanceEvent("mermaid_hydrate_ms", {
						hydrateElapsedMs: roundedDurationMs(startedAt),
						sourceChars: sourceText.length,
						theme: currentTheme,
						status: "ok",
						threadId: state.currentThreadId || ""
					}, {
						key: "mermaid_hydrate_ms",
						minIntervalMs: PERF_EVENT_THROTTLE_MS
					});
				}).catch((err) => {
					block.dataset.mermaidRendered = "error";
					showMermaidError(block, sourceText, err);
					postPerformanceEvent("mermaid_hydrate_ms", {
						hydrateElapsedMs: roundedDurationMs(startedAt),
						sourceChars: sourceText.length,
						theme: currentTheme,
						status: "error",
						error: err && err.message ? String(err.message).slice(0, 240) : String(err || "").slice(0, 240),
						threadId: state.currentThreadId || ""
					}, {
						key: "mermaid_hydrate_ms",
						minIntervalMs: PERF_EVENT_THROTTLE_MS,
						force: true
					});
				});
			}
			function hydrateMermaidDiagrams(root = document) {
				if (!root || typeof root.querySelectorAll !== "function") return;
				root.querySelectorAll("[data-mermaid-block='true']").forEach((block) => hydrateMermaidBlock(block));
			}
			function rerenderVisibleMermaidDiagrams() {
				document.querySelectorAll("[data-mermaid-block='true']").forEach((block) => {
					block.dataset.mermaidRendered = "";
					block.dataset.mermaidTheme = "";
					hydrateMermaidBlock(block);
				});
				if (mermaidPreviewOpen()) {
					const dialog = $("mermaidPreviewDialog");
					renderMermaidIntoContainer(dialog, mermaidSourceFromContainer(dialog), { loadingMessage: "正在更新 Mermaid 图..." }).catch((err) => showMermaidError(dialog, mermaidSourceFromContainer(dialog), err));
				}
			}
			function installMermaidThemeObserver() {
				if (state.mermaidThemeObserver || !window.MutationObserver) return;
				const observer = new MutationObserver(() => {
					if (state.mermaidTheme && state.mermaidTheme === mermaidThemeName()) return;
					rerenderVisibleMermaidDiagrams();
				});
				observer.observe(document.documentElement, {
					attributes: true,
					attributeFilter: ["data-theme"]
				});
				state.mermaidThemeObserver = observer;
			}
			function mermaidActionContainer(button) {
				return button.closest("[data-mermaid-block='true']") || button.closest("#mermaidPreviewDialog");
			}
			function mermaidContainerFromViewer(viewer) {
				return viewer ? viewer.closest("[data-mermaid-block='true']") || viewer.closest("#mermaidPreviewDialog") : null;
			}
			function resetMermaidScale(container) {
				const canvas = mermaidCanvas(container);
				const artboard = canvas && canvas.querySelector(".markdown-mermaid-artboard");
				if (!artboard) return;
				applyMermaidScale(container, mermaidInitialScale(container, Number(artboard.dataset.baseWidth || 0) || 640));
			}
			function openMermaidPreview(block) {
				const dialog = $("mermaidPreviewDialog");
				const sourceText = mermaidSourceFromContainer(block).trim();
				if (!dialog || !sourceText) return;
				dialog.dataset.mermaidSource = sourceText;
				const previewSource = $("mermaidPreviewSource");
				if (previewSource) previewSource.textContent = sourceText;
				dialog.classList.remove("hidden");
				publishPluginNavigationState({ force: true });
				renderMermaidIntoContainer(dialog, sourceText, { loadingMessage: "正在渲染 Mermaid 图..." }).catch((err) => showMermaidError(dialog, sourceText, err));
			}
			function closeMermaidPreview() {
				const dialog = $("mermaidPreviewDialog");
				if (!dialog) return;
				dialog.classList.add("hidden");
				dialog.dataset.mermaidSource = "";
				const canvas = mermaidCanvas(dialog);
				if (canvas) canvas.innerHTML = `<div class="markdown-mermaid-loading">正在渲染 Mermaid 图...</div>`;
				const previewSource = $("mermaidPreviewSource");
				if (previewSource) previewSource.textContent = "";
				updateMermaidResetLabel(dialog, 1);
				publishPluginNavigationState();
			}
			function handleMermaidAction(button) {
				const action = String(button && button.dataset ? button.dataset.mermaidAction || "" : "");
				const container = mermaidActionContainer(button);
				if (!action || !container) return false;
				if (action === "expand") {
					openMermaidPreview(container);
					return true;
				}
				if (action === "zoom-in") {
					applyMermaidScale(container, mermaidCurrentScale(container) + MERMAID_ZOOM_STEP);
					return true;
				}
				if (action === "zoom-out") {
					applyMermaidScale(container, mermaidCurrentScale(container) - MERMAID_ZOOM_STEP);
					return true;
				}
				if (action === "reset") {
					resetMermaidScale(container);
					return true;
				}
				return false;
			}
			function imagePreviewOpen() {
				const dialog = $("imagePreviewDialog");
				return Boolean(dialog && !dialog.classList.contains("hidden"));
			}
			function imagePreviewScaleLabel(scale = state.imagePreviewScale) {
				return `${Math.round(Number(scale || 1) * 100)}%`;
			}
			function applyImagePreviewScale(scale, options = {}) {
				const dialog = $("imagePreviewDialog");
				const stage = $("imagePreviewStage");
				if (!dialog || !stage) return;
				const previousScale = Number(state.imagePreviewScale || 1);
				const nextScale = Math.max(IMAGE_PREVIEW_MIN_SCALE, Math.min(IMAGE_PREVIEW_MAX_SCALE, Number(scale) || 1));
				const hasAnchor = Number.isFinite(options.anchorX) && Number.isFinite(options.anchorY) && Number.isFinite(options.contentX) && Number.isFinite(options.contentY);
				const keepCenter = !hasAnchor && options.keepCenter !== false && previousScale > 0 && nextScale > 0;
				const centerX = keepCenter ? (stage.scrollLeft + stage.clientWidth / 2) / previousScale : 0;
				const centerY = keepCenter ? (stage.scrollTop + stage.clientHeight / 2) / previousScale : 0;
				state.imagePreviewScale = nextScale;
				dialog.style.setProperty("--image-preview-scale", String(nextScale));
				const reset = $("imagePreviewZoomReset");
				if (reset) reset.textContent = imagePreviewScaleLabel(nextScale);
				if (hasAnchor && previousScale > 0 && nextScale > 0) requestAnimationFrame(() => {
					stage.scrollLeft = Math.max(0, options.contentX * nextScale - options.anchorX);
					stage.scrollTop = Math.max(0, options.contentY * nextScale - options.anchorY);
				});
				else if (keepCenter) requestAnimationFrame(() => {
					stage.scrollLeft = Math.max(0, centerX * nextScale - stage.clientWidth / 2);
					stage.scrollTop = Math.max(0, centerY * nextScale - stage.clientHeight / 2);
				});
			}
			function imagePreviewTitleForImage(image) {
				if (!image) return "图片预览";
				const figure = image.closest ? image.closest("figure, .file-preview-media, .attachment-chip") : null;
				const caption = figure && figure.querySelector ? figure.querySelector("figcaption") : null;
				return [
					caption && caption.textContent,
					image.getAttribute && image.getAttribute("alt"),
					image.getAttribute && image.getAttribute("title")
				].map((value) => String(value || "").trim()).find(Boolean) || "图片预览";
			}
			function openImagePreviewFromImage(image) {
				if (!image || image.closest && image.closest(".image-load-failed")) return false;
				const src = image.currentSrc || image.src || image.getAttribute("src") || "";
				if (!src) return false;
				const dialog = $("imagePreviewDialog");
				const previewImage = $("imagePreviewImage");
				if (!dialog || !previewImage) return false;
				const title = imagePreviewTitleForImage(image);
				$("imagePreviewTitle").textContent = title;
				const natural = image.naturalWidth && image.naturalHeight ? `${image.naturalWidth} x ${image.naturalHeight}` : "";
				$("imagePreviewMeta").textContent = natural;
				previewImage.src = src;
				previewImage.alt = title;
				dialog.classList.remove("hidden");
				applyImagePreviewScale(1, { keepCenter: false });
				const stage = $("imagePreviewStage");
				if (stage) {
					stage.scrollLeft = 0;
					stage.scrollTop = 0;
				}
				publishPluginNavigationState({ force: true });
				return true;
			}
			function closeImagePreview() {
				const dialog = $("imagePreviewDialog");
				if (!dialog) return;
				dialog.classList.add("hidden");
				const previewImage = $("imagePreviewImage");
				if (previewImage) {
					previewImage.removeAttribute("src");
					previewImage.alt = "";
				}
				$("imagePreviewTitle").textContent = "图片预览";
				$("imagePreviewMeta").textContent = "";
				state.imagePreviewScale = 1;
				dialog.style.removeProperty("--image-preview-scale");
				publishPluginNavigationState();
			}
			function handleImagePreviewAction(button) {
				const action = String(button && button.dataset ? button.dataset.imagePreviewAction || "" : "");
				if (!action) return false;
				if (action === "zoom-in") {
					applyImagePreviewScale(state.imagePreviewScale + IMAGE_PREVIEW_ZOOM_STEP);
					return true;
				}
				if (action === "zoom-out") {
					applyImagePreviewScale(state.imagePreviewScale - IMAGE_PREVIEW_ZOOM_STEP);
					return true;
				}
				if (action === "reset") {
					applyImagePreviewScale(1);
					return true;
				}
				return false;
			}
			function previewableImageFromEvent(event) {
				const image = event && event.target && event.target.closest ? event.target.closest(".input-image img, .image-view img, .markdown-image img, .file-preview-image, .attachment-thumb") : null;
				if (!image) return null;
				if (image.closest && image.closest(".github-link-card")) return null;
				return image;
			}
			function touchDistance(touchA, touchB) {
				if (!touchA || !touchB) return 0;
				return Math.hypot(Number(touchA.clientX || 0) - Number(touchB.clientX || 0), Number(touchA.clientY || 0) - Number(touchB.clientY || 0));
			}
			function touchCenter(touchA, touchB) {
				return {
					x: (Number(touchA && touchA.clientX || 0) + Number(touchB && touchB.clientX || 0)) / 2,
					y: (Number(touchA && touchA.clientY || 0) + Number(touchB && touchB.clientY || 0)) / 2
				};
			}
			function pinchStateFromTouches(event, scroller, scale) {
				if (!event || !event.touches || event.touches.length < 2 || !scroller) return null;
				const touchA = event.touches[0];
				const touchB = event.touches[1];
				const distance = touchDistance(touchA, touchB);
				if (!distance) return null;
				const center = touchCenter(touchA, touchB);
				const rect = scroller.getBoundingClientRect();
				const startScale = Math.max(.01, Number(scale) || 1);
				const anchorX = center.x - rect.left;
				const anchorY = center.y - rect.top;
				return {
					distance,
					scale: startScale,
					scroller,
					contentX: (scroller.scrollLeft + anchorX) / startScale,
					contentY: (scroller.scrollTop + anchorY) / startScale
				};
			}
			function anchorOptionsFromTouches(event, pinch) {
				if (!event || !event.touches || event.touches.length < 2 || !pinch || !pinch.scroller) return null;
				const center = touchCenter(event.touches[0], event.touches[1]);
				const rect = pinch.scroller.getBoundingClientRect();
				return {
					anchorX: center.x - rect.left,
					anchorY: center.y - rect.top,
					contentX: pinch.contentX,
					contentY: pinch.contentY
				};
			}
			function beginImagePreviewPinch(event) {
				const stage = event && event.target && event.target.closest ? event.target.closest("#imagePreviewStage") : null;
				if (!stage || !imagePreviewOpen() || !event.touches || event.touches.length < 2) return;
				const pinch = pinchStateFromTouches(event, stage, state.imagePreviewScale);
				if (!pinch) return;
				state.imagePreviewPinch = pinch;
				event.preventDefault();
				event.stopPropagation();
			}
			function moveImagePreviewPinch(event) {
				const pinch = state.imagePreviewPinch;
				if (!pinch) return;
				if (!event.touches || event.touches.length < 2) {
					state.imagePreviewPinch = null;
					return;
				}
				const distance = touchDistance(event.touches[0], event.touches[1]);
				const anchorOptions = anchorOptionsFromTouches(event, pinch);
				if (!distance || !anchorOptions) return;
				event.preventDefault();
				event.stopPropagation();
				applyImagePreviewScale(pinch.scale * (distance / pinch.distance), anchorOptions);
			}
			function finishImagePreviewPinch() {
				state.imagePreviewPinch = null;
			}
			function beginMermaidPinch(event) {
				const viewer = event && event.target && event.target.closest ? event.target.closest(".markdown-mermaid-viewer") : null;
				const container = mermaidContainerFromViewer(viewer);
				if (!viewer || !container || !event.touches || event.touches.length < 2) return;
				const pinch = pinchStateFromTouches(event, viewer, mermaidCurrentScale(container));
				if (!pinch) return;
				pinch.container = container;
				state.mermaidPinch = pinch;
				event.preventDefault();
				event.stopPropagation();
			}
			function moveMermaidPinch(event) {
				const pinch = state.mermaidPinch;
				if (!pinch || !pinch.container) return;
				if (!event.touches || event.touches.length < 2) {
					state.mermaidPinch = null;
					return;
				}
				const distance = touchDistance(event.touches[0], event.touches[1]);
				const anchorOptions = anchorOptionsFromTouches(event, pinch);
				if (!distance || !anchorOptions) return;
				event.preventDefault();
				event.stopPropagation();
				applyMermaidScale(pinch.container, pinch.scale * (distance / pinch.distance), Object.assign({ viewer: pinch.scroller }, anchorOptions));
			}
			function finishMermaidPinch() {
				state.mermaidPinch = null;
			}
			function renderThreadTaskCardDraftMessage(value, item, turn) {
				const text = String(value || "");
				if (parseThreadTaskCardDraftText(value)) return "";
				if (hasThreadTaskCardDraftTag(text)) return "";
				return "";
			}
			function closeFilePreview() {
				const dialog = $("filePreviewDialog");
				if (!dialog) return;
				state.filePreviewSwipe = null;
				state.filePreviewThreadId = "";
				dialog.classList.add("hidden");
				$("filePreviewBody").innerHTML = "";
				$("filePreviewMeta").textContent = "";
				$("filePreviewPath").textContent = "";
				publishPluginNavigationState();
			}
			function filePreviewOpen() {
				const dialog = $("filePreviewDialog");
				return Boolean(dialog && !dialog.classList.contains("hidden"));
			}
			function beginFilePreviewSwipe(event) {
				if (!filePreviewOpen()) return;
				if (event.touches && event.touches.length > 1) return;
				const touch = primaryTouch(event);
				if (!touch) return;
				event.stopPropagation();
				state.filePreviewSwipe = {
					startX: touch.clientX,
					startY: touch.clientY,
					currentX: touch.clientX,
					currentY: touch.clientY,
					moved: false
				};
			}
			function moveFilePreviewSwipe(event) {
				const swipe = state.filePreviewSwipe;
				if (!swipe) return;
				event.stopPropagation();
				const touch = primaryTouch(event);
				if (!touch) return;
				const dx = touch.clientX - swipe.startX;
				const dy = touch.clientY - swipe.startY;
				if (!swipe.moved) {
					if (Math.abs(dx) < 10 && Math.abs(dy) < 12) return;
					if (dx <= 0 || Math.abs(dy) > Math.abs(dx)) {
						state.filePreviewSwipe = null;
						return;
					}
				}
				swipe.moved = true;
				swipe.currentX = touch.clientX;
				swipe.currentY = touch.clientY;
				if (event.cancelable !== false) event.preventDefault();
			}
			function finishFilePreviewSwipe(event) {
				const swipe = state.filePreviewSwipe;
				state.filePreviewSwipe = null;
				if (!swipe) return;
				if (event && typeof event.stopPropagation === "function") event.stopPropagation();
				if (!swipe.moved) return;
				const dx = Number(swipe.currentX || swipe.startX) - swipe.startX;
				const dy = Number(swipe.currentY || swipe.startY) - swipe.startY;
				if (dx >= FILE_PREVIEW_SWIPE_CLOSE_MIN_PX && Math.abs(dy) <= Math.abs(dx) * .85) closeFilePreview();
			}
			function cancelFilePreviewSwipe(event) {
				state.filePreviewSwipe = null;
				if (event && typeof event.stopPropagation === "function") event.stopPropagation();
			}
			function filePreviewMetaText(file) {
				const parts = [];
				if (file && file.kind) parts.push(String(file.kind).toUpperCase());
				if (file && file.contentType) parts.push(String(file.contentType).split(";")[0]);
				if (file && Number.isFinite(Number(file.sizeBytes))) parts.push(`${Number(file.sizeBytes).toLocaleString()} bytes`);
				if (file && file.truncated) parts.push(`已截断到 ${Number(file.maxBytes || 0).toLocaleString()} bytes`);
				return parts.join(" · ");
			}
			function filePreviewContentUrl(file, options = {}) {
				if (file && file.contentUrl) return authenticatedApiContentUrl(file.contentUrl);
				if (!file || !file.path) return "";
				return localFilePreviewContentUrl(file.path, options);
			}
			function hermesPluginProxyPrefixFromPathname(pathname) {
				const match = String(pathname || "").match(/^(\/api\/hermes-plugins\/[^/]+\/proxy)(?:\/|$)/);
				return match ? match[1] : "";
			}
			function hermesPluginProxyPrefix() {
				if (!isHermesEmbedMode()) return "";
				try {
					return hermesPluginProxyPrefixFromPathname(window.location && window.location.pathname);
				} catch (_) {
					return "";
				}
			}
			function protectedImageUpstreamPathname(pathname) {
				const pathValue = String(pathname || "");
				if (pathValue === "/api/generated-images/file" || pathValue === "/api/uploads/file" || pathValue === "/api/files/preview/content") return pathValue;
				const match = pathValue.match(/^\/api\/hermes-plugins\/[^/]+\/proxy(\/api\/(?:generated-images\/file|uploads\/file|files\/preview\/content))$/);
				return match ? match[1] : "";
			}
			function browserApiContentUrl(value) {
				const raw = String(value || "");
				if (!raw) return "";
				try {
					const origin = typeof window !== "undefined" && window.location && window.location.origin ? window.location.origin : "http://127.0.0.1";
					const parsed = new URL(raw, origin);
					if (parsed.origin !== origin) return raw;
					const pathValue = `${parsed.pathname}${parsed.search}${parsed.hash}`;
					const proxyPrefix = hermesPluginProxyPrefix();
					if (proxyPrefix && parsed.pathname.startsWith("/api/") && !parsed.pathname.startsWith(`${proxyPrefix}/`)) return `${proxyPrefix}${pathValue}`;
					return pathValue;
				} catch (_) {
					return raw;
				}
			}
			function authenticatedApiContentUrl(value) {
				const raw = String(value || "");
				if (!raw) return "";
				try {
					const origin = typeof window !== "undefined" && window.location && window.location.origin ? window.location.origin : "http://127.0.0.1";
					const parsed = new URL(raw, origin);
					if (parsed.origin === origin && parsed.pathname.startsWith("/api/")) {
						if (state.key) parsed.searchParams.set("key", state.key);
						return browserApiContentUrl(`${parsed.pathname}${parsed.search}${parsed.hash}`);
					}
				} catch (_) {}
				return raw;
			}
			function localFilePreviewContentUrl(filePath, options = {}) {
				if (!filePath) return "";
				const threadId = String(options.threadId || renderContextThreadId() || "").trim();
				const params = new URLSearchParams({
					threadId,
					path: String(filePath)
				});
				if (state.key) params.set("key", state.key);
				return browserApiContentUrl(`/api/files/preview/content?${params.toString()}`);
			}
			function renderJsonPreview(content) {
				try {
					return `<pre class="file-preview-text"><code>${escapeHtml(JSON.stringify(JSON.parse(content), null, 2))}</code></pre>`;
				} catch (_) {
					return `<pre class="file-preview-text"><code>${escapeHtml(content)}</code></pre>`;
				}
			}
			function parseCsvPreviewRows(content) {
				const rows = [];
				let row = [];
				let cell = "";
				let quoted = false;
				const source = String(content || "");
				for (let index = 0; index < source.length; index += 1) {
					const ch = source[index];
					const next = source[index + 1];
					if (ch === "\"" && quoted && next === "\"") {
						cell += "\"";
						index += 1;
					} else if (ch === "\"") quoted = !quoted;
					else if (ch === "," && !quoted) {
						row.push(cell);
						cell = "";
					} else if ((ch === "\n" || ch === "\r") && !quoted) {
						if (ch === "\r" && next === "\n") index += 1;
						row.push(cell);
						rows.push(row);
						row = [];
						cell = "";
						if (rows.length >= 50) break;
					} else cell += ch;
				}
				if (rows.length < 50 && (cell || row.length)) {
					row.push(cell);
					rows.push(row);
				}
				return rows.filter((entry) => entry.some((cellValue) => String(cellValue || "").trim()));
			}
			function renderCsvPreview(content) {
				const rows = parseCsvPreviewRows(content);
				if (!rows.length) return `<pre class="file-preview-text"><code>${escapeHtml(content)}</code></pre>`;
				const head = rows[0];
				const bodyRows = rows.slice(1);
				return `<div class="file-preview-table-wrap"><table class="file-preview-table"><thead><tr>${head.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead><tbody>${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
			}
			function renderFilePreviewContent(file, options = {}) {
				const content = String(file && file.content || "");
				if (file && file.kind === "markdown") return renderMarkdown(content, { orderedListMode: "source" });
				if (file && file.kind === "image") {
					const src = filePreviewContentUrl(file, options);
					return `<div class="file-preview-media"><img class="file-preview-image" src="${escapeHtml(src)}" alt="${escapeHtml(file.fileName || "image preview")}"></div>`;
				}
				if (file && file.kind === "pdf") {
					const src = filePreviewContentUrl(file, options);
					return `<div class="file-preview-pdf"><iframe src="${escapeHtml(src)}" title="${escapeHtml(file.fileName || "PDF preview")}"></iframe><a href="${escapeHtml(src)}" target="_blank" rel="noreferrer">打开 PDF 预览</a></div>`;
				}
				if (file && file.kind === "json") return renderJsonPreview(content);
				if (file && file.kind === "csv") return renderCsvPreview(content);
				return `<pre class="file-preview-text"><code>${escapeHtml(content)}</code></pre>`;
			}
			function imageViewPath(item) {
				return String(item && (item.path || item.filePath || item.file_path || item.imagePath || item.image_path || item.savedPath || item.saved_path || item.sourcePath || item.source_path || item.arguments && (item.arguments.path || item.arguments.filePath || item.arguments.imagePath || item.arguments.savedPath) || item.result && (item.result.path || item.result.filePath || item.result.imagePath || item.result.savedPath)) || "");
			}
			function imageViewUrl(item) {
				const raw = item && (item.url || item.imageUrl || item.image_url || item.arguments && (item.arguments.url || item.arguments.imageUrl || item.arguments.image_url) || item.result && (item.result.url || item.result.imageUrl || item.result.image_url));
				const value = raw && typeof raw === "object" ? raw.url || raw.uri || raw.href : raw;
				return String(value || "");
			}
			function imageViewContentUrl(item) {
				return String(item && (item.contentUrl || item.content_url || item.result && (item.result.contentUrl || item.result.content_url)) || "");
			}
			function safeImageViewApiUrl(value) {
				const raw = String(value || "").trim();
				if (!raw) return "";
				try {
					const origin = typeof window !== "undefined" && window.location && window.location.origin ? window.location.origin : "http://127.0.0.1";
					const parsed = new URL(raw, origin);
					if (parsed.origin === origin && protectedImageUpstreamPathname(parsed.pathname)) return authenticatedApiContentUrl(`${parsed.pathname}${parsed.search}${parsed.hash}`);
				} catch (_) {}
				return "";
			}
			function safeImageViewFallbackUrl(value) {
				const raw = String(value || "").trim();
				if (!raw) return "";
				if (/^(?:data:image\/|blob:|file:\/\/)/i.test(raw)) return "";
				if (isLikelyAbsoluteLocalPath(raw)) return "";
				return safeImageViewApiUrl(raw);
			}
			function isImageViewUnavailable(item) {
				return Boolean(item && (item.imageUnavailable || item.unavailable || item.generatedImage && item.generatedImage.unavailable));
			}
			function renderImageView(item) {
				const filePath = imageViewPath(item);
				const contentUrl = imageViewContentUrl(item);
				const url = imageViewUrl(item);
				const src = contentUrl ? safeImageViewApiUrl(contentUrl) : filePath && isLikelyAbsoluteLocalPath(filePath) ? imageContentUrlForPath(filePath, { threadId: renderContextThreadId() }) : safeImageViewFallbackUrl(url);
				shortPath(filePath || item.label || item.fileName || item.file_name || item.caption || url || item.id || "image");
				if (isImageViewUnavailable(item)) return `<figure class="image-view image-load-failed"></figure>`;
				if (!src && (contentUrl || filePath || url)) return `<figure class="image-view image-load-failed" data-image-source-kind="unsafe-source"></figure>`;
				if (!src) return renderStructuredBlock(item, "Image");
				const displaySrc = protectedImageDisplaySrc(src);
				return `<figure class="image-view">
    <img src="${escapeHtml(displaySrc)}" alt="Image" loading="${imageLoadingModeForSource(src)}"${protectedImageSourceAttribute(src)}>
  </figure>`;
			}
			function handleConversationImageError(event) {
				const image = event && event.target && event.target.closest ? event.target.closest("img") : null;
				if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("error", image, {}, { force: true });
				if (handleProtectedAppImageError(image)) return;
				markFailedAppImage(image, { explicit: true });
				if (typeof imageDiagnosticDetails === "function" && typeof recordHomeAiDiagnosticFailure === "function") {
					const details = imageDiagnosticDetails(image, "error");
					recordHomeAiDiagnosticFailure({
						category: "media_render_failed",
						diagnostic_type: "image_render_failed",
						severity_hint: "H3",
						evidence_confidence: .72,
						error_code: "image_render_failed",
						context: {
							surface: "media-render",
							action: "image-load",
							source_kind: details.sourceKind || "",
							item_hash: diagnosticItemHash(details.sourceHash || "")
						},
						counts: {
							recovery_count: details.recoveryCount,
							natural_width: details.naturalWidth,
							natural_height: details.naturalHeight
						},
						breadcrumbs: [{
							kind: "media-render",
							code: "image-load",
							status: "failed",
							fields: {
								source_kind: details.sourceKind || "",
								item_hash: diagnosticItemHash(details.sourceHash || "")
							}
						}]
					});
				}
				if (typeof probeFailedAuthenticatedImage === "function") probeFailedAuthenticatedImage(image);
			}
			function handleConversationImageLoad(event) {
				const image = event && event.target && event.target.closest ? event.target.closest("img") : null;
				if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("load", image);
				if (typeof imageDiagnosticDetails === "function" && typeof recordHomeAiDiagnosticSuccess === "function") {
					const details = imageDiagnosticDetails(image, "load");
					recordHomeAiDiagnosticSuccess({
						category: "media_render_failed",
						diagnostic_type: "image_render_failed",
						error_code: "image_render_failed",
						context: {
							surface: "media-render",
							action: "image-load",
							source_kind: details.sourceKind || "",
							item_hash: diagnosticItemHash(details.sourceHash || "")
						}
					});
				}
				clearFailedAppImage(image);
			}
			function failedAppImageContainer(image) {
				return image && image.closest ? image.closest(".input-image, .image-view, .markdown-image, .attachment-chip, .file-preview-media, figure") : null;
			}
			function setRetryingAppImage(image, active) {
				if (!image) return false;
				const container = failedAppImageContainer(image);
				if (container && container.classList && typeof container.classList.toggle === "function") container.classList.toggle("image-load-retrying", Boolean(active));
				if (image.classList && typeof image.classList.toggle === "function") image.classList.toggle("image-load-retrying", Boolean(active));
				return true;
			}
			function markFailedAppImage(image, options = {}) {
				if (!image) return false;
				if (options.explicit && image.dataset) image.dataset.imageLoadError = "1";
				setRetryingAppImage(image, false);
				const container = failedAppImageContainer(image);
				if (container) container.classList.add("image-load-failed");
				else if (image.classList) image.classList.add("image-load-failed");
				image.setAttribute("aria-hidden", "true");
				return true;
			}
			function clearFailedAppImage(image) {
				if (!image) return false;
				if (image.dataset && image.dataset.imageLoadError) delete image.dataset.imageLoadError;
				if (image.dataset && image.dataset.imageLoadProbe) delete image.dataset.imageLoadProbe;
				setRetryingAppImage(image, false);
				const container = failedAppImageContainer(image);
				if (container && container.classList) container.classList.remove("image-load-failed");
				if (image.classList) image.classList.remove("image-load-failed");
				if (image.getAttribute && image.getAttribute("aria-hidden") === "true") image.removeAttribute("aria-hidden");
				return true;
			}
			function imageHadExplicitLoadError(image) {
				return Boolean(image && image.dataset && image.dataset.imageLoadError === "1");
			}
			function isLazyAppImage(image) {
				if (!image) return false;
				return String(image.getAttribute && image.getAttribute("loading") || image.loading || "").trim().toLowerCase() === "lazy";
			}
			function shouldProactivelyMarkFailedImage(image) {
				if (!image) return false;
				if (protectedAppImageElementSrc(image)) return false;
				if (imageHadExplicitLoadError(image)) return true;
				return !isLazyAppImage(image);
			}
			function protectedGeneratedImageSrc(value) {
				const raw = String(value || "");
				if (!raw) return "";
				try {
					const parsed = new URL(raw, window.location.origin);
					if (parsed.origin === window.location.origin && protectedImageUpstreamPathname(parsed.pathname)) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
				} catch (_) {}
				return "";
			}
			function imageLoadingModeForSource(src) {
				return protectedGeneratedImageSrc(src) ? "eager" : "lazy";
			}
			function shouldRenderProtectedImageDirectly(src) {
				if (!protectedGeneratedImageSrc(src)) return false;
				return isHermesEmbedMode();
			}
			function protectedImageDisplaySrc(src) {
				const protectedSrc = protectedGeneratedImageSrc(src);
				if (!protectedSrc) return src;
				return shouldRenderProtectedImageDirectly(protectedSrc) ? protectedSrc : PROTECTED_IMAGE_PLACEHOLDER_SRC;
			}
			function protectedImageSourceAttribute(src) {
				const protectedSrc = protectedGeneratedImageSrc(src);
				return protectedSrc ? ` data-protected-image-src="${escapeHtml(protectedSrc)}"` : "";
			}
			function protectedAppImageElementSrc(image) {
				const stored = image && image.dataset && image.dataset.protectedImageSrc;
				if (stored) return protectedGeneratedImageSrc(stored);
				return protectedGeneratedImageSrc(image && (image.currentSrc || image.src || image.getAttribute && image.getAttribute("src")));
			}
			function imageDiagnosticSourceKind(src) {
				const raw = String(src || "");
				if (!raw) return "empty";
				if (/^data:image\//i.test(raw)) return "data-image";
				if (/^blob:/i.test(raw)) return "blob";
				try {
					const parsed = new URL(raw, window.location.origin);
					if (parsed.origin !== window.location.origin) return "remote";
					const upstreamPathname = protectedImageUpstreamPathname(parsed.pathname) || parsed.pathname;
					if (upstreamPathname === "/api/uploads/file") return "upload";
					if (upstreamPathname === "/api/generated-images/file") return "generated-image";
					if (upstreamPathname === "/api/files/preview/content") return "file-preview";
					if (parsed.pathname.startsWith("/api/")) return "api";
					return "same-origin";
				} catch (_) {
					return "unknown";
				}
			}
			function imageDiagnosticSourceHash(src) {
				const raw = String(src || "");
				if (!raw) return "";
				if (/^data:image\//i.test(raw)) return stableTextHash(`data:${raw.length}`);
				if (/^blob:/i.test(raw)) return stableTextHash("blob");
				try {
					const parsed = new URL(raw, window.location.origin);
					for (const key of Array.from(parsed.searchParams.keys())) if (/key|token|secret|password|cookie/i.test(key)) parsed.searchParams.set(key, "REDACTED");
					return stableTextHash(`${parsed.origin}${parsed.pathname}?${parsed.searchParams.toString()}`);
				} catch (_) {
					return stableTextHash(raw.slice(0, 200));
				}
			}
			function imageDiagnosticDetails(image, phase, extra = {}) {
				const src = image && (image.currentSrc || image.src || image.getAttribute && image.getAttribute("src") || "");
				const protectedSrc = protectedAppImageElementSrc(image);
				const container = failedAppImageContainer(image);
				return Object.assign({
					phase,
					clientBuildId: CLIENT_BUILD_ID,
					readMode: String(state.currentThread && state.currentThread.mobileReadMode || ""),
					threadIdSuffix: String(state.currentThreadId || "").slice(-8),
					sourceKind: imageDiagnosticSourceKind(src || protectedSrc),
					protectedSourceKind: imageDiagnosticSourceKind(protectedSrc),
					sourceHash: imageDiagnosticSourceHash(src || protectedSrc),
					alt: shortPath(String(image && image.alt || "").trim()).slice(0, 96),
					complete: Boolean(image && image.complete),
					naturalWidth: Number(image && image.naturalWidth || 0),
					naturalHeight: Number(image && image.naturalHeight || 0),
					failedClass: Boolean(container && container.classList && container.classList.contains("image-load-failed")),
					recoveryCount: Number(image && image.dataset && image.dataset.protectedImageRecoveryCount || 0)
				}, extra || {});
			}
			function postImageDiagnosticEvent(phase, image, extra = {}, options = {}) {
				if (!IMAGE_DIAGNOSTICS_ENABLED) return false;
				const details = imageDiagnosticDetails(image, phase, extra);
				const key = [
					"image",
					phase,
					state.currentThreadId || "",
					details.sourceHash || "",
					details.alt || ""
				].join("|");
				postPerformanceEvent(`image_${phase}`, details, {
					key,
					minIntervalMs: Number(options.minIntervalMs || 8e3),
					force: Boolean(options.force)
				});
			}
			function imageStillConnected(image) {
				return Boolean(image && (!("isConnected" in image) || image.isConnected));
			}
			function protectedAppImageUrlApi() {
				if (typeof window !== "undefined" && window.URL) return window.URL;
				if (typeof URL !== "undefined") return URL;
				return null;
			}
			function revokeProtectedAppImageObjectUrl(image) {
				if (!image || !image.dataset) return false;
				const objectUrl = String(image.dataset.protectedImageObjectUrl || "");
				if (!objectUrl) return false;
				const urlApi = protectedAppImageUrlApi();
				if (urlApi && typeof urlApi.revokeObjectURL === "function" && /^blob:/i.test(objectUrl)) try {
					urlApi.revokeObjectURL(objectUrl);
				} catch (_) {}
				delete image.dataset.protectedImageObjectUrl;
				return true;
			}
			function retryProtectedAppImageSource(image, src) {
				if (!image || !src || Number(image.naturalWidth || 0) > 0) return false;
				if (!image.dataset) return false;
				const retryCount = Number(image.dataset.imageLoadRetryCount || 0);
				if (retryCount >= 2) return false;
				image.dataset.imageLoadRetryCount = String(retryCount + 1);
				revokeProtectedAppImageObjectUrl(image);
				try {
					const parsed = new URL(src, window.location.origin);
					parsed.searchParams.set("_imgRetry", `${Date.now()}-${retryCount + 1}`);
					image.src = `${parsed.pathname}${parsed.search}${parsed.hash}`;
					return true;
				} catch (_) {
					image.src = src;
					return true;
				}
			}
			function cacheBustedProtectedImageSrc(src, paramName = "_imgRetry") {
				const source = protectedGeneratedImageSrc(src);
				if (!source) return "";
				try {
					const parsed = new URL(source, window.location.origin);
					parsed.searchParams.set(paramName, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
					return `${parsed.pathname}${parsed.search}${parsed.hash}`;
				} catch (_) {
					return source;
				}
			}
			function shouldRecoverProtectedImageAsDirectUrl() {
				return isHermesEmbedMode() || typeof isIosWebKitBrowser === "function" && isIosWebKitBrowser();
			}
			function blobToDataUrl(blob) {
				if (!blob || typeof FileReader === "undefined") return Promise.resolve("");
				return new Promise((resolve) => {
					const reader = new FileReader();
					reader.onload = () => resolve(/^data:image\//i.test(String(reader.result || "")) ? String(reader.result) : "");
					reader.onerror = () => resolve("");
					try {
						reader.readAsDataURL(blob);
					} catch (_) {
						resolve("");
					}
				});
			}
			async function protectedAppImageRecoveredUrl(response, src = "") {
				if (!response) return {
					url: "",
					objectUrl: false
				};
				if (shouldRecoverProtectedImageAsDirectUrl()) {
					const directUrl = cacheBustedProtectedImageSrc(src, "_imgRecover");
					if (directUrl) return {
						url: directUrl,
						objectUrl: false,
						directUrl: true
					};
				}
				if (typeof response.blob !== "function") return {
					url: "",
					objectUrl: false
				};
				const blob = await response.blob().catch(() => null);
				if (!blob) return {
					url: "",
					objectUrl: false
				};
				const type = String(blob.type || "").trim();
				if (type && !/^image\//i.test(type)) return {
					url: "",
					objectUrl: false
				};
				const size = Number(blob.size || 0);
				if (!size || size <= 8 * 1024 * 1024) {
					const dataUrl = await blobToDataUrl(blob);
					if (dataUrl) return {
						url: dataUrl,
						objectUrl: false
					};
				}
				const urlApi = protectedAppImageUrlApi();
				if (urlApi && typeof urlApi.createObjectURL === "function") {
					const type = String(blob.type || "").trim();
					if (type && !/^image\//i.test(type)) return {
						url: "",
						objectUrl: false
					};
					return {
						url: urlApi.createObjectURL(blob),
						objectUrl: true
					};
				}
				return {
					url: "",
					objectUrl: false
				};
			}
			function applyProtectedAppImageRecoveredUrl(image, recovered) {
				const url = String(recovered && recovered.url || "");
				if (!image || !url) return false;
				revokeProtectedAppImageObjectUrl(image);
				if (image.dataset && recovered && recovered.objectUrl) image.dataset.protectedImageObjectUrl = url;
				image.src = url;
				return true;
			}
			function shouldHydrateProtectedAppImage(image) {
				if (!image || !image.dataset) return false;
				const src = protectedAppImageElementSrc(image);
				if (!src) return false;
				if (shouldRenderProtectedImageDirectly(src)) return false;
				if (image.dataset.protectedImageHydrated === "1" || image.dataset.protectedImageHydrating === "1") return false;
				const current = String(image.currentSrc || image.src || "");
				if (/^(data:image|blob:)/i.test(current) && current !== PROTECTED_IMAGE_PLACEHOLDER_SRC) return false;
				return isIosWebKitBrowser() || imageDiagnosticSourceKind(src) === "upload" || shouldRenderProtectedImageDirectly(src);
			}
			function hydrateProtectedAppImage(image, reason = "scan") {
				const src = protectedAppImageElementSrc(image);
				if (!src || !shouldHydrateProtectedAppImage(image)) return false;
				image.dataset.protectedImageHydrating = "1";
				if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("hydrate_start", image, { reason }, { force: true });
				const headers = state.key ? { "X-Codex-Mobile-Key": state.key } : {};
				fetch(src, {
					method: "GET",
					headers,
					credentials: "same-origin",
					cache: "no-store"
				}).then(async (response) => {
					if (!imageStillConnected(image)) return;
					if (image.dataset) delete image.dataset.protectedImageHydrating;
					if (!response || !response.ok) {
						if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("hydrate_response", image, {
							status: response && response.status || 0,
							ok: false
						}, { force: true });
						return;
					}
					const recovered = await protectedAppImageRecoveredUrl(response, src);
					if (!imageStillConnected(image)) {
						if (recovered && recovered.objectUrl && recovered.url) {
							const urlApi = protectedAppImageUrlApi();
							if (urlApi && typeof urlApi.revokeObjectURL === "function") try {
								urlApi.revokeObjectURL(recovered.url);
							} catch (_) {}
						}
						return;
					}
					if (applyProtectedAppImageRecoveredUrl(image, recovered)) {
						image.dataset.protectedImageHydrated = "1";
						clearFailedAppImage(image);
						if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("hydrate_apply", image, {
							recoveredKind: imageDiagnosticSourceKind(recovered && recovered.url),
							objectUrl: Boolean(recovered && recovered.objectUrl)
						}, { force: true });
					}
				}).catch(() => {
					if (!imageStillConnected(image)) return;
					if (image.dataset) delete image.dataset.protectedImageHydrating;
					if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("hydrate_fetch_error", image, { reason }, { force: true });
				});
				return true;
			}
			function hydrateProtectedAppImages(root, reason = "scan") {
				if (!root || !root.querySelectorAll) return 0;
				let count = 0;
				root.querySelectorAll("img").forEach((image) => {
					if (hydrateProtectedAppImage(image, reason)) count += 1;
				});
				return count;
			}
			function handleProtectedAppImageError(image) {
				const src = protectedAppImageElementSrc(image);
				if (!src || !image || !image.dataset) return false;
				if (image.dataset.imageLoadProbe === "1") return true;
				const recoveryCount = Number(image.dataset.protectedImageRecoveryCount || 0);
				if (recoveryCount >= 2) {
					if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("recovery_limit", image, { recoveryCount }, { force: true });
					markFailedAppImage(image, { explicit: true });
					return true;
				}
				image.dataset.protectedImageRecoveryCount = String(recoveryCount + 1);
				image.dataset.imageLoadProbe = "1";
				setRetryingAppImage(image, true);
				if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("recovery_start", image, { recoveryCount: recoveryCount + 1 }, { force: true });
				const headers = state.key ? { "X-Codex-Mobile-Key": state.key } : {};
				fetch(src, {
					method: "GET",
					headers,
					credentials: "same-origin",
					cache: "no-store"
				}).then(async (response) => {
					if (!imageStillConnected(image)) return;
					if (image.dataset) delete image.dataset.imageLoadProbe;
					if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("recovery_response", image, {
						status: response && response.status || 0,
						ok: Boolean(response && response.ok),
						contentType: response && response.headers && response.headers.get ? String(response.headers.get("content-type") || "").slice(0, 80) : ""
					}, { force: true });
					if (response && (response.status === 401 || response.status === 403)) {
						if (isHermesEmbedMode() && !state.imageAuthRefreshRequested) {
							state.imageAuthRefreshRequested = true;
							requestHermesPluginRefresh("auth_state_changed", { force: true });
						}
						markFailedAppImage(image, { explicit: true });
						return;
					}
					if (response && response.ok) {
						clearFailedAppImage(image);
						const recovered = await protectedAppImageRecoveredUrl(response, src);
						if (!imageStillConnected(image)) {
							if (recovered && recovered.objectUrl && recovered.url) {
								const urlApi = protectedAppImageUrlApi();
								if (urlApi && typeof urlApi.revokeObjectURL === "function") try {
									urlApi.revokeObjectURL(recovered.url);
								} catch (_) {}
							}
							return;
						}
						if (applyProtectedAppImageRecoveredUrl(image, recovered)) {
							if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("recovery_apply", image, {
								recoveredKind: imageDiagnosticSourceKind(recovered && recovered.url),
								objectUrl: Boolean(recovered && recovered.objectUrl)
							}, { force: true });
							return;
						}
						if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("recovery_retry_src", image, {}, { force: true });
						retryProtectedAppImageSource(image, src);
						return;
					}
					markFailedAppImage(image, { explicit: true });
				}).catch(() => {
					if (!imageStillConnected(image)) return;
					if (image.dataset) delete image.dataset.imageLoadProbe;
					if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("recovery_fetch_error", image, {}, { force: true });
					markFailedAppImage(image, { explicit: true });
				});
				return true;
			}
			function probeFailedAuthenticatedImage(image) {
				const src = protectedAppImageElementSrc(image);
				if (!src || !isHermesEmbedMode() || state.imageAuthRefreshRequested) return;
				const headers = state.key ? { "X-Codex-Mobile-Key": state.key } : {};
				fetch(src, {
					method: "GET",
					headers,
					credentials: "same-origin",
					cache: "no-store"
				}).then((response) => {
					if (!response || !(response.status === 401 || response.status === 403)) return;
					state.imageAuthRefreshRequested = true;
					requestHermesPluginRefresh("auth_state_changed", { force: true });
				}).catch(() => {});
			}
			function scanFailedAppImages(root) {
				if (!root || !root.querySelectorAll) return 0;
				let marked = 0;
				root.querySelectorAll("img").forEach((image) => {
					if (image.complete && image.naturalWidth > 0) {
						clearFailedAppImage(image);
						return;
					}
					if (image.complete && image.naturalWidth === 0) {
						if (handleProtectedAppImageError(image)) return;
						if (shouldProactivelyMarkFailedImage(image)) {
							if (markFailedAppImage(image)) marked += 1;
						} else clearFailedAppImage(image);
					}
				});
				return marked;
			}
			function scheduleFailedAppImageScan(root, delays = [
				0,
				180,
				700
			]) {
				if (!root) return;
				delays.forEach((delay) => {
					window.setTimeout(() => {
						hydrateProtectedAppImages(root, "scheduled-scan");
						scanFailedAppImages(root);
					}, delay);
				});
			}
			function scheduleVisibleImageFailureScan(delays = [
				0,
				180,
				700
			]) {
				scheduleFailedAppImageScan($("conversation"), delays);
				scheduleFailedAppImageScan($("attachmentList"), delays);
			}
			function showFilePreviewLoading(label, filePath) {
				const dialog = $("filePreviewDialog");
				if (!dialog) return;
				$("filePreviewTitle").textContent = label || "文件预览";
				$("filePreviewPath").textContent = filePath || "";
				$("filePreviewMeta").textContent = "";
				$("filePreviewBody").textContent = "正在加载文件...";
				const copyButton = $("filePreviewCopyPath");
				if (copyButton) {
					copyButton.dataset.copyKey = rememberCopyText(filePath || "");
					copyButton.textContent = "复制路径";
				}
				dialog.classList.remove("hidden");
				publishPluginNavigationState({ force: true });
			}
			function localFilePreviewThreadIdFromLink(link, options = {}) {
				const explicit = String(options.threadId || link && link.dataset && link.dataset.localFileThreadId || "").trim();
				if (explicit) return explicit;
				const pane = link && typeof link.closest === "function" ? link.closest("[data-thread-tile-pane]") : null;
				const paneThreadId = String(pane && pane.getAttribute && pane.getAttribute("data-thread-tile-pane") || "").trim();
				if (paneThreadId) return paneThreadId;
				return String(state.filePreviewThreadId || renderContextThreadId() || "").trim();
			}
			async function openLocalFilePreview(link, options = {}) {
				const filePath = link && link.dataset ? link.dataset.localFilePath || "" : "";
				if (!filePath) return;
				const threadId = localFilePreviewThreadIdFromLink(link, options);
				state.filePreviewThreadId = threadId;
				const label = link && link.dataset && link.dataset.localFileLabel || (link && link.textContent ? link.textContent.replace(/预览文件\s*$/, "").trim() : "") || "文件预览";
				showFilePreviewLoading(label, filePath);
				try {
					const file = await api(`/api/files/preview?threadId=${encodeURIComponent(threadId)}&path=${encodeURIComponent(filePath)}`, { timeoutMs: 15e3 });
					$("filePreviewTitle").textContent = file.fileName || label;
					$("filePreviewPath").textContent = file.relativePath || file.path || filePath;
					$("filePreviewMeta").textContent = filePreviewMetaText(file);
					$("filePreviewBody").innerHTML = renderFilePreviewContent(file, { threadId });
					hydrateGitHubLinkCards($("filePreviewBody"));
					hydrateMermaidDiagrams($("filePreviewBody"));
					const copyButton = $("filePreviewCopyPath");
					if (copyButton) copyButton.dataset.copyKey = rememberCopyText(file.path || filePath);
				} catch (err) {
					$("filePreviewMeta").textContent = "";
					$("filePreviewBody").innerHTML = `<div class="file-preview-error">${escapeHtml(err && err.message ? err.message : String(err))}</div>`;
				}
			}
			return {
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
				fetchGitHubLinkPreview,
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
				hydrateGitHubLinkCard,
				hydrateGitHubLinkCards,
				mermaidEffectiveTheme,
				mermaidThemeName,
				mermaidConfig,
				mermaidPreviewOpen,
				loadRuntimeScript,
				configureMermaidApi,
				ensureMermaidApi,
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
				renderMermaidIntoContainer,
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
				protectedAppImageRecoveredUrl,
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
				openLocalFilePreview
			};
		}
		const api = { createMediaPreviewRuntime };
		if (typeof module !== "undefined" && module.exports) module.exports = api;
		root.CodexMediaPreviewRuntime = api;
	})(typeof window !== "undefined" ? window : globalThis);
}));
//#endregion
//#region public/composer-bridge-runtime.js
var require_composer_bridge_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function attachComposerBridgeRuntime(root) {
		function updateComposerHeightVar(...args) {
			return composerRuntime.updateComposerHeightVar(...args);
		}
		function showError(err) {
			const raw = err instanceof Error ? err.message : String(err || "");
			const message = normalizeClientErrorMessage(raw, err) || err && err.message || String(err);
			$("connectionState").textContent = message;
			$("connectionState").classList.add("error");
			postClientEvent("client_error", {
				message,
				raw,
				currentThreadId: state.currentThreadId || "",
				composerBusy: state.composerBusy,
				continuationBusy: state.continuationBusy
			});
		}
		function clearSendProgressWatchdog(...args) {
			return composerRuntime.clearSendProgressWatchdog(...args);
		}
		function startSendProgressWatchdog(...args) {
			return composerRuntime.startSendProgressWatchdog(...args);
		}
		function finishSendProgressWatchdog(...args) {
			return composerRuntime.finishSendProgressWatchdog(...args);
		}
		function threadNotificationThrottleKey(method, params) {
			if (!params) return "";
			if (method === "thread/started" && params.thread) return `${method}:${String(params.thread.id || "")}:${String(statusText(params.thread.status) || "")}`;
			if (method === "thread/status/changed") return `${method}:${String(params.threadId || "")}:${String(statusText(params.status) || "")}`;
			if (method === "thread/name/updated") return `${method}:${String(params.threadId || "")}:${String(params.threadName || "")}`;
			if (method === "thread/archived") return `${method}:${String(params.threadId || "")}`;
			return "";
		}
		function shouldThrottleThreadNotification(method, params) {
			const key = threadNotificationThrottleKey(method, params);
			if (!key) return false;
			const now = Date.now();
			if (now - (state.threadNotificationThrottle.get(key) || 0) < 450) return true;
			state.threadNotificationThrottle.set(key, now);
			if (state.threadNotificationThrottle.size > 220) {
				for (const [existingKey, existingAt] of state.threadNotificationThrottle.entries()) if (now - existingAt > 8e3) state.threadNotificationThrottle.delete(existingKey);
				if (state.threadNotificationThrottle.size > 220) for (const existingKey of Array.from(state.threadNotificationThrottle.keys()).slice(0, 120)) state.threadNotificationThrottle.delete(existingKey);
			}
			return false;
		}
		function normalizeClientErrorMessage(...args) {
			return composerRuntime.normalizeClientErrorMessage(...args);
		}
		function rawMessageFallback(...args) {
			return composerRuntime.rawMessageFallback(...args);
		}
		function composerText(...args) {
			return composerRuntime.composerText(...args);
		}
		function setComposerText(...args) {
			return composerRuntime.setComposerText(...args);
		}
		function placeMessageInputCaretAtEnd(...args) {
			return composerRuntime.placeMessageInputCaretAtEnd(...args);
		}
		function focusMessageInput(...args) {
			return composerRuntime.focusMessageInput(...args);
		}
		function messageInputKeyboardVisible(...args) {
			return composerRuntime.messageInputKeyboardVisible(...args);
		}
		function shouldRecoverMessageInputKeyboard(...args) {
			return composerRuntime.shouldRecoverMessageInputKeyboard(...args);
		}
		function recoverMessageInputKeyboardFromGesture(...args) {
			return composerRuntime.recoverMessageInputKeyboardFromGesture(...args);
		}
		function messageInputCanEnableForNativeGesture(...args) {
			return composerRuntime.messageInputCanEnableForNativeGesture(...args);
		}
		function releaseStaleAndroidMessageInputFocusBeforeNativeTap(...args) {
			return composerRuntime.releaseStaleAndroidMessageInputFocusBeforeNativeTap(...args);
		}
		function prepareMessageInputForNativeGesture(...args) {
			return composerRuntime.prepareMessageInputForNativeGesture(...args);
		}
		function normalizedComposerIntentText(...args) {
			return composerRuntime.normalizedComposerIntentText(...args);
		}
		function composerIntentOptions(...args) {
			return composerRuntime.composerIntentOptions(...args);
		}
		function composerIntentOption(...args) {
			return composerRuntime.composerIntentOption(...args);
		}
		function composerIntentDraftKey(...args) {
			return composerRuntime.composerIntentDraftKey(...args);
		}
		function loadComposerIntentDraft(...args) {
			return composerRuntime.loadComposerIntentDraft(...args);
		}
		function saveComposerIntentDraft(...args) {
			return composerRuntime.saveComposerIntentDraft(...args);
		}
		function composerIntentBareTagKind(...args) {
			return composerRuntime.composerIntentBareTagKind(...args);
		}
		function shouldShowComposerIntentMenu(...args) {
			return composerRuntime.shouldShowComposerIntentMenu(...args);
		}
		function closeComposerIntentMenu(...args) {
			return composerRuntime.closeComposerIntentMenu(...args);
		}
		function onComposerIntentOutsidePointer(...args) {
			return composerRuntime.onComposerIntentOutsidePointer(...args);
		}
		function openComposerIntentMenu(...args) {
			return composerRuntime.openComposerIntentMenu(...args);
		}
		function positionComposerIntentMenu(...args) {
			return composerRuntime.positionComposerIntentMenu(...args);
		}
		function updateComposerIntentMenu(...args) {
			return composerRuntime.updateComposerIntentMenu(...args);
		}
		function queueComposerIntentMenuUpdate(...args) {
			return composerRuntime.queueComposerIntentMenuUpdate(...args);
		}
		function selectComposerIntent(...args) {
			return composerRuntime.selectComposerIntent(...args);
		}
		function setComposerIntentDialogStatus(...args) {
			return composerRuntime.setComposerIntentDialogStatus(...args);
		}
		function closeComposerIntentDialog(...args) {
			return composerRuntime.closeComposerIntentDialog(...args);
		}
		function openComposerIntentDialog(...args) {
			return composerRuntime.openComposerIntentDialog(...args);
		}
		async function submitComposerIntentDialog(...args) {
			return composerRuntime.submitComposerIntentDialog(...args);
		}
		function saveComposerIntentDialogDraft(...args) {
			return composerRuntime.saveComposerIntentDialogDraft(...args);
		}
		function shouldKeepAndroidMessageInputEditable(...args) {
			return composerRuntime.shouldKeepAndroidMessageInputEditable(...args);
		}
		function setMessageInputDisabled(...args) {
			return composerRuntime.setMessageInputDisabled(...args);
		}
		function messageInputTextLength(...args) {
			return composerRuntime.messageInputTextLength(...args);
		}
		function messageInputTargetHeight(...args) {
			return composerRuntime.messageInputTargetHeight(...args);
		}
		function currentMessageInputHeight(...args) {
			return composerRuntime.currentMessageInputHeight(...args);
		}
		function updateMessageInputOverflow(...args) {
			return composerRuntime.updateMessageInputOverflow(...args);
		}
		function autoSizeMessageInput(...args) {
			return composerRuntime.autoSizeMessageInput(...args);
		}
		function formatFileSize(...args) {
			return composerRuntime.formatFileSize(...args);
		}
		function appendLocalAttachmentSummary(...args) {
			return composerRuntime.appendLocalAttachmentSummary(...args);
		}
		function localImageInputPartsForAttachments(...args) {
			return composerRuntime.localImageInputPartsForAttachments(...args);
		}
		function localUserMessageItem(...args) {
			return composerRuntime.localUserMessageItem(...args);
		}
		function attachmentId(...args) {
			return composerRuntime.attachmentId(...args);
		}
		function pendingAttachmentBytes(...args) {
			return composerRuntime.pendingAttachmentBytes(...args);
		}
		async function prepareAttachmentFile(...args) {
			return composerRuntime.prepareAttachmentFile(...args);
		}
		async function prepareAttachmentFiles(...args) {
			return composerRuntime.prepareAttachmentFiles(...args);
		}
		async function addAttachmentFiles(...args) {
			return composerRuntime.addAttachmentFiles(...args);
		}
		function removeAttachment(...args) {
			return composerRuntime.removeAttachment(...args);
		}
		function clearPendingAttachments(...args) {
			return composerRuntime.clearPendingAttachments(...args);
		}
		function renderAttachmentList(...args) {
			return composerRuntime.renderAttachmentList(...args);
		}
		function composerHasContent(...args) {
			return composerRuntime.composerHasContent(...args);
		}
		function effectiveDefaultModel(...args) {
			return composerRuntime.effectiveDefaultModel(...args);
		}
		function effectiveDefaultEffort(...args) {
			return composerRuntime.effectiveDefaultEffort(...args);
		}
		function effectiveDefaultPermissionMode(...args) {
			return composerRuntime.effectiveDefaultPermissionMode(...args);
		}
		function selectedComposerModel(...args) {
			return composerRuntime.selectedComposerModel(...args);
		}
		function selectedComposerEffort(...args) {
			return composerRuntime.selectedComposerEffort(...args);
		}
		function selectedComposerPermissionMode(...args) {
			return composerRuntime.selectedComposerPermissionMode(...args);
		}
		function resetComposerRuntimeSelection(...args) {
			return composerRuntime.resetComposerRuntimeSelection(...args);
		}
		function runtimeOptionValues(...args) {
			return composerRuntime.runtimeOptionValues(...args);
		}
		function runtimeOptionLabel(...args) {
			return composerRuntime.runtimeOptionLabel(...args);
		}
		function runtimeSelectedValue(...args) {
			return composerRuntime.runtimeSelectedValue(...args);
		}
		function codexFastCommandEnabled(...args) {
			return composerRuntime.codexFastCommandEnabled(...args);
		}
		function clearLegacyCodexFastModeStorage(...args) {
			return composerRuntime.clearLegacyCodexFastModeStorage(...args);
		}
		function setCodexFastCommandEnabled(...args) {
			return composerRuntime.setCodexFastCommandEnabled(...args);
		}
		function applyRuntimeSelection(...args) {
			return composerRuntime.applyRuntimeSelection(...args);
		}
		function closeComposerRuntimeMenu(...args) {
			return composerRuntime.closeComposerRuntimeMenu(...args);
		}
		function onComposerRuntimeOutsidePointer(...args) {
			return composerRuntime.onComposerRuntimeOutsidePointer(...args);
		}
		function openComposerRuntimeMenu(...args) {
			return composerRuntime.openComposerRuntimeMenu(...args);
		}
		function composerRuntimeMenuDiagnostics(...args) {
			return composerRuntime.composerRuntimeMenuDiagnostics(...args);
		}
		function reportComposerRuntimeMenu(...args) {
			return composerRuntime.reportComposerRuntimeMenu(...args);
		}
		function handleComposerRuntimeControl(...args) {
			return composerRuntime.handleComposerRuntimeControl(...args);
		}
		function fitComposerPopupToAnchor(...args) {
			return composerRuntime.fitComposerPopupToAnchor(...args);
		}
		function closeQuotaDetails(...args) {
			return composerRuntime.closeQuotaDetails(...args);
		}
		function onQuotaOutsidePointer(...args) {
			return composerRuntime.onQuotaOutsidePointer(...args);
		}
		function toggleQuotaDetails(...args) {
			return composerRuntime.toggleQuotaDetails(...args);
		}
		function composerPlaceholderText(...args) {
			return composerRuntime.composerPlaceholderText(...args);
		}
		function composerShowsTargetPlaceholder(...args) {
			return composerRuntime.composerShowsTargetPlaceholder(...args);
		}
		function applyComposerActionControlPlan(...args) {
			return composerRuntime.applyComposerActionControlPlan(...args);
		}
		function renderComposerSettings(...args) {
			return composerRuntime.renderComposerSettings(...args);
		}
		function updateComposerControls(...args) {
			return composerRuntime.updateComposerControls(...args);
		}
		function hasTransferFiles(...args) {
			return composerRuntime.hasTransferFiles(...args);
		}
		function goalDialogFormValues(...args) {
			return composerRuntime.goalDialogFormValues(...args);
		}
		async function submitThreadGoalMessage(...args) {
			return composerRuntime.submitThreadGoalMessage(...args);
		}
		function threadGoalActionStatusText(...args) {
			return composerRuntime.threadGoalActionStatusText(...args);
		}
		function threadGoalActionBusyText(...args) {
			return composerRuntime.threadGoalActionBusyText(...args);
		}
		async function runThreadGoalDialogAction(...args) {
			return composerRuntime.runThreadGoalDialogAction(...args);
		}
		function requestGoalDialogSubmitFromEnter(...args) {
			return composerRuntime.requestGoalDialogSubmitFromEnter(...args);
		}
		function requestGoalDialogSubmitFromButton(...args) {
			return composerRuntime.requestGoalDialogSubmitFromButton(...args);
		}
		function requestGoalDialogSubmit(...args) {
			return composerRuntime.requestGoalDialogSubmit(...args);
		}
		async function sendThreadTaskCardCommand(...args) {
			return composerRuntime.sendThreadTaskCardCommand(...args);
		}
		async function sendMessage(...args) {
			return composerRuntime.sendMessage(...args);
		}
		async function sendNewThreadMessage(...args) {
			return composerRuntime.sendNewThreadMessage(...args);
		}
		function requestComposerSubmitFromButton(...args) {
			return composerRuntime.requestComposerSubmitFromButton(...args);
		}
		function requestAttachmentPickerFromButton(...args) {
			return composerRuntime.requestAttachmentPickerFromButton(...args);
		}
		async function interruptActiveTurn(...args) {
			return composerRuntime.interruptActiveTurn(...args);
		}
		async function answerServerRequest(requestId, payload, options = {}) {
			const key = requestId !== null && requestId !== void 0 ? String(requestId) : "";
			const request = state.pendingApprovals.get(key);
			if (!request || request.status !== "waiting") return;
			const threadId = approvalActionThreadId(request, options.threadId);
			request.status = "responding";
			request.decision = payload && (payload.decision || payload.action) || "submitted";
			markActivity(isUserInputRequest(request) ? "输入发送中" : "批准中");
			scheduleApprovalThreadRender(threadId);
			try {
				const result = await api(`/api/approvals/${encodeURIComponent(key)}`, {
					method: "POST",
					body: JSON.stringify(payload || {}),
					timeoutMs: 2e4
				});
				if (result && result.request) state.pendingApprovals.set(key, serverRequestWithThreadContext(result.request, threadId));
				$("connectionState").classList.remove("error");
				$("connectionState").textContent = isUserInputRequest(request) ? "Response sent" : "Approval sent";
				markActivity(isUserInputRequest(request) ? "输入已发送" : "批准发送");
				scheduleApprovalThreadRender(threadId);
			} catch (err) {
				request.status = "waiting";
				request.decision = null;
				showError(err);
				scheduleApprovalThreadRender(threadId);
			}
		}
		function answerApproval(requestId, decision, options = {}) {
			return answerServerRequest(requestId, { decision }, options);
		}
		function serverRequestPayload(request, responseText, questionId) {
			if (request && request.method === "mcpServer/elicitation/request") return {
				action: "accept",
				responseText
			};
			return {
				responseText,
				questionId
			};
		}
		function declineServerRequest(requestId, options = {}) {
			const key = requestId !== null && requestId !== void 0 ? String(requestId) : "";
			const request = state.pendingApprovals.get(key);
			if (!request) return Promise.resolve();
			if (request.method === "mcpServer/elicitation/request") return answerServerRequest(key, { action: "decline" }, options);
			if (request.method === "item/tool/requestUserInput") return answerServerRequest(key, { answers: {} }, options);
			return answerApproval(key, "deny", options);
		}
		async function mutateThreadTaskCard(cardId, action, body = {}, options = {}) {
			const id = String(cardId || "").trim();
			const threadId = String(options.threadId || body.threadId || state.currentThreadId || "").trim();
			if (!id || !threadId) return;
			$("connectionState").classList.remove("error");
			$("connectionState").textContent = action === "approve" ? "Approving task card" : `${action} task card`;
			try {
				const result = await api(`/api/thread-task-cards/${encodeURIComponent(id)}/${encodeURIComponent(action)}`, {
					method: "POST",
					body: JSON.stringify(Object.assign({}, body, { threadId })),
					timeoutMs: 3e4
				});
				if (action === "approve" && result && result.execution && result.execution.turnId) $("connectionState").textContent = "Task card approved; starting target turn";
				else $("connectionState").textContent = "Task card updated";
				settleThreadTaskCardForThread(threadId, id, action === "approve" ? "approved" : action === "delete" ? "deleted" : action === "revoke" ? "revoked" : "replied", result && result.card ? result.card : null);
				recordHomeAiDiagnosticSuccess({
					category: "task_card_workflow_failed",
					diagnostic_type: action === "reply" ? "task_card_return_failed" : "task_card_action_failed",
					error_code: action === "reply" ? "task_card_return_failed" : "task_card_action_failed",
					context: {
						surface: "task-card",
						action: homeAiDiagnosticReportingApi.boundedToken(action, "mutate", 40),
						thread_hash: diagnosticThreadHash(threadId),
						task_hash: diagnosticTaskHash(id)
					}
				});
				if (action === "approve" && result && result.execution && result.execution.turnId) {
					let injectedVisible = false;
					if (threadId === String(state.currentThreadId || "")) injectedVisible = await waitForCurrentThreadTurn(result.execution.turnId, {
						timeoutMs: 1e4,
						intervalMs: 500
					});
					else scheduleComposerTargetRefresh(threadId, 300, "task-card-approved");
					$("connectionState").textContent = injectedVisible ? "Task card approved and injected" : "Task card approved; waiting for thread refresh";
					loadThreads({ silent: true }).catch(showError);
					return;
				}
				await refreshThreadAfterTaskCard(threadId);
			} catch (err) {
				showError(err);
			}
		}
		async function replyTaskCard(cardId, options = {}) {
			const threadId = String(options.threadId || state.currentThreadId || "").trim();
			const card = findThreadTaskCard(cardId, threadId);
			if (!card) return;
			const body = await requestAppTextInput("输入回复内容。", "", {
				title: "回复任务卡片",
				confirmLabel: "发送回复",
				rows: 6
			}) || "";
			if (!String(body).trim()) return;
			const title = `Reply: ${card.message && card.message.title ? card.message.title : "Task card"}`;
			return mutateThreadTaskCard(card.id, "reply", {
				format: "markdown",
				title,
				summary: summarizeTaskCardText(body),
				body: String(body).trim(),
				idempotencyKey: `task-card-reply:${card.id}:${Date.now()}:${Math.random().toString(16).slice(2, 8)}`
			}, { threadId });
		}
		function findThreadTaskCardDraftByKey(draftKey, thread = renderContextThread()) {
			const key = String(draftKey || "");
			const sourceThread = renderContextThread(thread) || state.currentThread;
			const turns = Array.isArray(sourceThread && sourceThread.turns) ? sourceThread.turns : [];
			for (const turn of turns) {
				const items = Array.isArray(turn && turn.items) ? turn.items : [];
				for (const item of items) {
					if (!item || item.type !== "agentMessage" && item.type !== "plan") continue;
					const draft = parseThreadTaskCardDraftText(item.text || "");
					if (!draft) continue;
					const itemKey = threadTaskCardDraftKeyForDraft(turn, draft, item);
					const legacyItemKey = threadTaskCardDraftKey(turn.id, item.id || "");
					if (itemKey !== key && legacyItemKey !== key) continue;
					return {
						key,
						draft,
						turn,
						item,
						sourceThread
					};
				}
			}
			return null;
		}
		function scheduleThreadTaskCardDraftStateRender(threadId = "") {
			const id = String(threadId || state.currentThreadId || "").trim();
			if (!id || id === String(state.currentThreadId || "")) {
				renderCurrentThread();
				return true;
			}
			if (state.threadTileMode && threadTilePaneIsVisible(id)) {
				if (!scheduleRenderThreadTilePane(id, { preserveScroll: true })) renderCurrentThread();
				return true;
			}
			return false;
		}
		function setThreadTaskCardDraftState(draftKey, nextState, options = {}) {
			const key = String(draftKey || "");
			if (!key) return;
			state.threadTaskCardDraftStates.set(key, Object.assign({}, threadTaskCardDraftState(key), nextState || {}, { updatedAtMs: Date.now() }));
			saveThreadTaskCardDraftStates();
			const threadId = String(options.threadId || options.thread && options.thread.id || "").trim();
			if (options.render !== false) scheduleThreadTaskCardDraftStateRender(threadId);
		}
		function dismissThreadTaskCardDraft(draftKey, options = {}) {
			setThreadTaskCardDraftState(draftKey, {
				status: "dismissed",
				error: ""
			}, options);
		}
		function queueThreadTaskCardDraftCreation(draftKey, thread = renderContextThread()) {
			const key = String(draftKey || "");
			if (!key || state.scheduledThreadTaskCardDraftCreations.has(key) || state.activeThreadTaskCardDraftCreations.has(key)) return;
			const sourceThreadId = renderContextThreadId(thread);
			state.scheduledThreadTaskCardDraftCreations.add(key);
			const current = threadTaskCardDraftState(key);
			setThreadTaskCardDraftState(key, {
				status: "creating",
				error: "",
				attempts: Math.max(0, Number(current.attempts || 0)) + 1
			}, { render: false });
			window.setTimeout(() => {
				state.scheduledThreadTaskCardDraftCreations.delete(key);
				createThreadTaskCardDraft(key, { threadId: sourceThreadId }).catch(showError);
			}, 0);
		}
		async function createThreadTaskCardDraft(draftKey, options = {}) {
			const activeKey = String(draftKey || "");
			if (!activeKey || state.activeThreadTaskCardDraftCreations.has(activeKey)) return;
			state.activeThreadTaskCardDraftCreations.add(activeKey);
			const requestedThreadId = String(options.threadId || "").trim();
			try {
				const requestedThread = taskCardActionThread(requestedThreadId);
				const resolved = findThreadTaskCardDraftByKey(draftKey, requestedThread);
				const sourceThread = resolved && (resolved.sourceThread || requestedThread || state.currentThread);
				const sourceThreadId = String(sourceThread && sourceThread.id || requestedThreadId || "").trim();
				if (!resolved || !sourceThreadId || !sourceThread) {
					setThreadTaskCardDraftState(draftKey, {
						status: "pending",
						error: ""
					}, { render: false });
					return;
				}
				const { draft, turn } = resolved;
				const targetRefs = threadTaskCardDraftTargetThreads(draft);
				const targetThreadIds = threadTaskCardDraftTargetIds(draft);
				if (!targetThreadIds.length) {
					setThreadTaskCardDraftState(draftKey, {
						status: "failed",
						error: draft.error || "Draft did not include a target thread id"
					}, { threadId: sourceThreadId });
					return;
				}
				if (!draft.title || !draft.body) {
					setThreadTaskCardDraftState(draftKey, {
						status: "failed",
						error: draft.error || "Draft is incomplete"
					}, { threadId: sourceThreadId });
					return;
				}
				setThreadTaskCardDraftState(draftKey, {
					status: "creating",
					error: ""
				}, { threadId: sourceThreadId });
				$("connectionState").classList.remove("error");
				$("connectionState").textContent = "Creating task card";
				const body = truncateThreadTaskCardBody(draft.body);
				const targetWorkspaceIds = {};
				for (const entry of targetRefs) if (entry.thread) targetWorkspaceIds[entry.threadId] = String(entry.thread.cwd || "");
				const result = await api("/api/thread-task-cards", {
					method: "POST",
					body: JSON.stringify({
						sourceWorkspaceId: sourceThread.cwd || state.selectedCwd || "",
						sourceThreadId,
						sourceTurnId: String(turn && turn.id || ""),
						sourceThreadTitle: threadTitleForDisplay(sourceThread) || sourceThreadId,
						targetThreadIds,
						targetWorkspaceIds,
						idempotencyKey: `task-card-draft:${sourceThreadId}:${draftKey}`,
						format: "markdown",
						title: draft.title,
						summary: draft.summary || summarizeTaskCardText(body),
						body,
						workflowMode: draft.workflowMode || "manual",
						workflowId: draft.workflowId || ""
					}),
					timeoutMs: 3e4
				});
				const createdCards = Array.isArray(result && result.cards) ? result.cards.filter(Boolean) : result && result.card ? [result.card] : [];
				if (!createdCards.length) throw new Error("Task card creation returned no cards");
				for (const createdCard of createdCards) {
					const pending = String(createdCard && createdCard.status || "pending") === "pending";
					upsertThreadTaskCardOnThread(sourceThread, createdCard);
					if (pending) {
						incrementPendingOutgoingTaskCardCount(sourceThreadId, 1);
						incrementPendingIncomingTaskCardCount(createdCard && createdCard.target && createdCard.target.threadId, 1);
					}
				}
				if (state.threadTileDetails.has(sourceThreadId)) state.threadTileDetails.set(sourceThreadId, sourceThread);
				setThreadTaskCardDraftState(draftKey, {
					status: "created",
					error: "",
					cardId: String(createdCards[0] && createdCards[0].id || ""),
					cardIds: createdCards.map((card) => String(card && card.id || "")).filter(Boolean)
				}, { threadId: sourceThreadId });
				$("connectionState").classList.remove("error");
				$("connectionState").textContent = createdCards.length === 1 ? "Task card created; opening target thread" : `Task cards created: ${createdCards.length}`;
				state.pendingPluginRouteHint = createdCards.length === 1 ? normalizePluginRouteHint({
					pluginId: "codex-mobile",
					route: "thread-task-card",
					threadId: createdCards[0].target && createdCards[0].target.threadId || targetThreadIds[0],
					taskId: createdCards[0].id
				}) : null;
				recordHomeAiDiagnosticSuccess({
					category: "task_card_workflow_failed",
					diagnostic_type: "task_card_draft_materialize_failed",
					error_code: "task_card_draft_materialize_failed",
					context: {
						surface: "task-card",
						action: "draft-materialize",
						thread_hash: diagnosticThreadHash(sourceThreadId),
						item_hash: diagnosticItemHash(draftKey)
					}
				});
				renderThreads();
				loadThreads({ silent: true }).catch(showError);
				if (createdCards.length === 1) await loadThread(createdCards[0].target && createdCards[0].target.threadId || targetThreadIds[0], { source: "task-card-created" });
				else if (sourceThreadId === String(state.currentThreadId || "")) renderCurrentThread();
				else if (state.threadTileMode && threadTilePaneIsVisible(sourceThreadId)) scheduleRenderThreadTilePane(sourceThreadId, { preserveScroll: true });
				else renderCurrentThread();
			} catch (err) {
				const diagnosticThreadId = String(options.threadId || state.currentThreadId || "").trim();
				setThreadTaskCardDraftState(draftKey, {
					status: "failed",
					error: normalizeClientErrorMessage(err && err.message ? err.message : String(err)) || "Task card creation failed"
				}, { threadId: diagnosticThreadId });
				recordHomeAiDiagnosticFailure({
					category: "task_card_workflow_failed",
					diagnostic_type: "task_card_draft_materialize_failed",
					severity_hint: "H2",
					evidence_confidence: .78,
					error_code: diagnosticErrorCode(err, "task_card_draft_materialize_failed"),
					context: {
						surface: "task-card",
						action: "draft-materialize",
						thread_hash: diagnosticThreadHash(diagnosticThreadId),
						item_hash: diagnosticItemHash(draftKey)
					},
					counts: { status_code: diagnosticErrorStatus(err) },
					breadcrumbs: [{
						kind: "task-card",
						code: "draft-materialize",
						status: "failed",
						fields: {
							status_code: diagnosticErrorStatus(err),
							item_hash: diagnosticItemHash(draftKey)
						}
					}]
				});
				throw err;
			} finally {
				state.activeThreadTaskCardDraftCreations.delete(activeKey);
			}
		}
		function createComposerBridgeRuntime() {
			return {
				sendMessage: typeof sendMessage === "function" ? sendMessage : null,
				sendNewThreadMessage: typeof sendNewThreadMessage === "function" ? sendNewThreadMessage : null,
				answerServerRequest: typeof answerServerRequest === "function" ? answerServerRequest : null,
				answerApproval: typeof answerApproval === "function" ? answerApproval : null,
				declineServerRequest: typeof declineServerRequest === "function" ? declineServerRequest : null,
				mutateThreadTaskCard: typeof mutateThreadTaskCard === "function" ? mutateThreadTaskCard : null,
				replyTaskCard: typeof replyTaskCard === "function" ? replyTaskCard : null,
				queueThreadTaskCardDraftCreation: typeof queueThreadTaskCardDraftCreation === "function" ? queueThreadTaskCardDraftCreation : null,
				createThreadTaskCardDraft: typeof createThreadTaskCardDraft === "function" ? createThreadTaskCardDraft : null
			};
		}
		const legacyGlobals = {
			updateComposerHeightVar,
			showError,
			clearSendProgressWatchdog,
			startSendProgressWatchdog,
			finishSendProgressWatchdog,
			threadNotificationThrottleKey,
			shouldThrottleThreadNotification,
			normalizeClientErrorMessage,
			rawMessageFallback,
			composerText,
			setComposerText,
			placeMessageInputCaretAtEnd,
			focusMessageInput,
			messageInputKeyboardVisible,
			shouldRecoverMessageInputKeyboard,
			recoverMessageInputKeyboardFromGesture,
			messageInputCanEnableForNativeGesture,
			releaseStaleAndroidMessageInputFocusBeforeNativeTap,
			prepareMessageInputForNativeGesture,
			normalizedComposerIntentText,
			composerIntentOptions,
			composerIntentOption,
			composerIntentDraftKey,
			loadComposerIntentDraft,
			saveComposerIntentDraft,
			composerIntentBareTagKind,
			shouldShowComposerIntentMenu,
			closeComposerIntentMenu,
			onComposerIntentOutsidePointer,
			openComposerIntentMenu,
			positionComposerIntentMenu,
			updateComposerIntentMenu,
			queueComposerIntentMenuUpdate,
			selectComposerIntent,
			setComposerIntentDialogStatus,
			closeComposerIntentDialog,
			openComposerIntentDialog,
			submitComposerIntentDialog,
			saveComposerIntentDialogDraft,
			shouldKeepAndroidMessageInputEditable,
			setMessageInputDisabled,
			messageInputTextLength,
			messageInputTargetHeight,
			currentMessageInputHeight,
			updateMessageInputOverflow,
			autoSizeMessageInput,
			formatFileSize,
			appendLocalAttachmentSummary,
			localImageInputPartsForAttachments,
			localUserMessageItem,
			attachmentId,
			pendingAttachmentBytes,
			prepareAttachmentFile,
			prepareAttachmentFiles,
			addAttachmentFiles,
			removeAttachment,
			clearPendingAttachments,
			renderAttachmentList,
			composerHasContent,
			effectiveDefaultModel,
			effectiveDefaultEffort,
			effectiveDefaultPermissionMode,
			selectedComposerModel,
			selectedComposerEffort,
			selectedComposerPermissionMode,
			resetComposerRuntimeSelection,
			runtimeOptionValues,
			runtimeOptionLabel,
			runtimeSelectedValue,
			codexFastCommandEnabled,
			clearLegacyCodexFastModeStorage,
			setCodexFastCommandEnabled,
			applyRuntimeSelection,
			closeComposerRuntimeMenu,
			onComposerRuntimeOutsidePointer,
			openComposerRuntimeMenu,
			composerRuntimeMenuDiagnostics,
			reportComposerRuntimeMenu,
			handleComposerRuntimeControl,
			fitComposerPopupToAnchor,
			closeQuotaDetails,
			onQuotaOutsidePointer,
			toggleQuotaDetails,
			composerPlaceholderText,
			composerShowsTargetPlaceholder,
			applyComposerActionControlPlan,
			renderComposerSettings,
			updateComposerControls,
			hasTransferFiles,
			goalDialogFormValues,
			submitThreadGoalMessage,
			threadGoalActionStatusText,
			threadGoalActionBusyText,
			runThreadGoalDialogAction,
			requestGoalDialogSubmitFromEnter,
			requestGoalDialogSubmitFromButton,
			requestGoalDialogSubmit,
			sendThreadTaskCardCommand,
			sendMessage,
			sendNewThreadMessage,
			requestComposerSubmitFromButton,
			requestAttachmentPickerFromButton,
			interruptActiveTurn,
			answerServerRequest,
			answerApproval,
			serverRequestPayload,
			declineServerRequest,
			mutateThreadTaskCard,
			replyTaskCard,
			findThreadTaskCardDraftByKey,
			scheduleThreadTaskCardDraftStateRender,
			setThreadTaskCardDraftState,
			dismissThreadTaskCardDraft,
			queueThreadTaskCardDraftCreation,
			createThreadTaskCardDraft
		};
		const api = { createComposerBridgeRuntime };
		if (typeof module === "object" && module.exports) module.exports = api;
		for (const [name, value] of Object.entries(legacyGlobals)) if (typeof value === "function") root[name] = value;
		root.CodexComposerBridgeRuntime = api;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
//#region public/api-client-runtime.js
var require_api_client_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function attachApiClientRuntime(root) {
		async function api(path, options = {}) {
			return apiClient.request(path, options);
		}
		function postClientEvent(event, details = {}) {
			if (!state.key) return;
			const payload = JSON.stringify({
				event,
				threadId: state.currentThreadId || "",
				path: location.pathname || "/",
				details
			});
			const url = `/api/client-events?key=${encodeURIComponent(state.key)}`;
			fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: payload,
				keepalive: true
			}).catch(() => {
				try {
					if (navigator.sendBeacon) {
						const blob = new Blob([payload], { type: "application/json" });
						navigator.sendBeacon(url, blob);
					}
				} catch (_) {}
			});
		}
		function nowPerfMs() {
			return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
		}
		function roundedDurationMs(startedAt) {
			return Math.max(0, Math.round(nowPerfMs() - Number(startedAt || 0)));
		}
		function postPerformanceEvent(event, details = {}, options = {}) {
			const now = Date.now();
			const key = String(options.key || event || "");
			const minIntervalMs = Math.max(0, Number(options.minIntervalMs || 0));
			if (key && minIntervalMs > 0) {
				const last = Number(state.perfEventLastReportedAt[key] || 0);
				if (!options.force && last && now - last < minIntervalMs) return false;
				state.perfEventLastReportedAt[key] = now;
			}
			postClientEvent(event, Object.assign({
				pwa: isPwaMode(),
				embedded: isHermesEmbedMode(),
				visibility: document.visibilityState || "",
				clientBuildId: CLIENT_BUILD_ID
			}, details || {}));
			return true;
		}
		function diagnosticHash(value) {
			return homeAiDiagnosticReportingApi.hashIdentifier(String(value || ""), "h");
		}
		function diagnosticThreadHash(threadId = state.currentThreadId) {
			const id = String(threadId || "").trim();
			return id ? diagnosticHash(`thread:${id}`) : "";
		}
		function diagnosticTurnHash(turnId) {
			const id = String(turnId || "").trim();
			return id ? diagnosticHash(`turn:${id}`) : "";
		}
		function diagnosticTaskHash(taskId) {
			const id = String(taskId || "").trim();
			return id ? diagnosticHash(`task:${id}`) : "";
		}
		function diagnosticItemHash(itemId) {
			const id = String(itemId || "").trim();
			return id ? diagnosticHash(`item:${id}`) : "";
		}
		function clientSubmissionDiagnosticHash(clientSubmissionId) {
			const id = String(clientSubmissionId || "").trim();
			return id ? diagnosticHash(`submission:${id}`) : "";
		}
		function clientSubmissionDataAttr(item) {
			const hash = clientSubmissionDiagnosticHash(item && item.clientSubmissionId);
			return hash ? ` data-client-submission-hash="${escapeHtml(hash)}"` : "";
		}
		function diagnosticRouteKind() {
			if (state.newThreadDraft) return "new-thread";
			if (isHermesEmbedMode() && isHermesPluginPrimaryPage()) return "embedded-primary";
			if (state.threadTileMode) return "thread-tile";
			if (state.currentThreadId) return "thread-detail";
			return isHermesEmbedMode() ? "embedded-root" : "standalone-root";
		}
		function diagnosticErrorStatus(err) {
			let status = Number(err && (err.status || err.statusCode) || 0);
			if ((!Number.isFinite(status) || status <= 0) && err && /^\d+$/.test(String(err.code || ""))) status = Number(err.code);
			return Number.isFinite(status) && status > 0 ? status : 0;
		}
		function diagnosticErrorCode(err, fallback = "runtime_failed") {
			const explicit = String(err && err.code || "").trim();
			if (explicit && !/^\d+$/.test(explicit)) return homeAiDiagnosticReportingApi.boundedToken(explicit, fallback, 100);
			const status = diagnosticErrorStatus(err);
			if (status) return `http_${status}`;
			const message = String(err && err.message || err || "").toLowerCase();
			if (message.includes("request timed out")) return "request_timeout";
			if (message.includes("request cancelled")) return "request_cancelled";
			if (message.includes("failed to fetch")) return "network_fetch_failed";
			if (message.includes("not visible")) return "target_thread_not_visible";
			if (message.includes("terminal") && message.includes("return")) return "terminal_card_no_return_required";
			return fallback;
		}
		function diagnosticDurationBucket(ms) {
			return homeAiDiagnosticReportingApi.durationBucket(ms);
		}
		function currentHomeAiDiagnosticContext(extra = {}) {
			const context = Object.assign({
				surface: "runtime",
				action: "unknown",
				route_kind: diagnosticRouteKind(),
				build_id: CLIENT_BUILD_ID,
				shell_cache: CLIENT_BUILD_ID.split("|").pop() || "",
				thread_hash: diagnosticThreadHash(),
				embedded: isHermesEmbedMode(),
				pwa: isPwaMode(),
				client_visibility: document.visibilityState || ""
			}, extra || {});
			if (!context.thread_hash) delete context.thread_hash;
			return context;
		}
		function postHomeAiDiagnosticReport(report, meta = {}) {
			const targetOrigin = normalizePluginParentOrigin(state.pluginParentOrigin);
			if (targetOrigin) state.pluginParentOrigin = targetOrigin;
			const result = homeAiDiagnosticReportingApi.postReportToHomeAi({
				report,
				embedded: isHermesEmbedMode(),
				parentWindow: window.parent,
				selfWindow: window,
				targetOrigin: targetOrigin || "*"
			});
			postClientEvent("home_ai_diagnostic_report_post", {
				ok: Boolean(result.ok),
				reason: result.reason || "",
				category: report && report.category || "",
				diagnostic_type: report && report.diagnostic_type || "",
				error_code: report && report.error_code || "",
				signature: meta.signature || "",
				repeatedFailures: Number(meta.repeatedFailures || 0)
			});
			return result;
		}
		function recordHomeAiDiagnosticFailure(input = {}) {
			const result = state.homeAiDiagnosticReporter.recordFailure(Object.assign({}, input, { context: currentHomeAiDiagnosticContext(input.context || {}) }));
			postClientEvent("home_ai_diagnostic_failure_recorded", {
				category: input.category || "",
				diagnostic_type: input.diagnostic_type || input.diagnosticType || "",
				error_code: input.error_code || input.errorCode || "",
				eligible: Boolean(result.eligible),
				repeatedFailures: Number(result.repeatedFailures || 0),
				threshold: Number(result.threshold || 0),
				signature: result.signature || "",
				observeOnly: Boolean(result.observeOnly),
				reason: result.reason || ""
			});
			if (result.report) postHomeAiDiagnosticReport(result.report, result);
			return result;
		}
		function recordHomeAiDiagnosticSuccess(input = {}) {
			return state.homeAiDiagnosticReporter.recordSuccess(Object.assign({}, input, { context: currentHomeAiDiagnosticContext(input.context || {}) }));
		}
		function applyFrontendRuntimeHealthEffect(effect) {
			const item = effect && typeof effect === "object" ? effect : {};
			if (!item.type) return;
			if (item.type === "diagnostic-failure") {
				recordHomeAiDiagnosticFailure(item.diagnostic || {});
				return;
			}
			if (item.type === "diagnostic-success") {
				recordHomeAiDiagnosticSuccess(item.diagnostic || {});
				return;
			}
			throw new Error(`Unknown frontend runtime health effect: ${item.type}`);
		}
		function applyFrontendRuntimeHealthEffectsPlan(plan) {
			const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
			for (const effect of effects) applyFrontendRuntimeHealthEffect(effect);
		}
		function threadListRuntimeMetrics() {
			const list = $("threadList");
			if (!list || typeof list.getBoundingClientRect !== "function") return {
				present: false,
				visible: false,
				threadListCount: 0,
				scrollTop: 0,
				scrollHeight: 0
			};
			const rect = list.getBoundingClientRect();
			const viewportWidth = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
			const viewportHeight = Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
			return {
				present: true,
				visible: document.visibilityState !== "hidden" && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth,
				threadListCount: list.querySelectorAll("[data-thread]").length,
				scrollTop: Math.max(0, Math.round(Number(list.scrollTop || 0))),
				scrollHeight: Math.max(0, Math.round(Number(list.scrollHeight || 0)))
			};
		}
		function recordThreadListRuntimeStall(input = {}) {
			const now = Date.now();
			if (now - Number(state.threadListRuntimeLastReportAt || 0) < THREAD_LIST_RUNTIME_STALL_REPORT_INTERVAL_MS) return false;
			const metrics = threadListRuntimeMetrics();
			const routeKind = diagnosticRouteKind();
			const threadListMonitorable = metrics.visible || metrics.present && document.visibilityState !== "hidden" && (routeKind === "embedded-primary" || routeKind === "standalone-root");
			const plan = frontendRuntimeHealthApi.threadListInteractionStallEffects(Object.assign({
				threadListVisible: metrics.visible,
				threadListMonitorable,
				routeKind,
				minDelayMs: THREAD_LIST_RUNTIME_STALL_MIN_MS,
				h2ThresholdMs: THREAD_LIST_RUNTIME_STALL_H2_MS,
				threadListCount: metrics.threadListCount,
				scrollTop: metrics.scrollTop,
				scrollHeight: metrics.scrollHeight
			}, input || {}));
			if (!plan.effects || !plan.effects.length) return false;
			state.threadListRuntimeLastReportAt = now;
			applyFrontendRuntimeHealthEffectsPlan(plan);
			postPerformanceEvent("thread_list_runtime_stall", {
				action: input.action || "thread-list-runtime",
				routeKind,
				maxRafDelayMs: Math.max(0, Math.round(Number(input.maxRafDelayMs || 0))),
				maxScrollApplyMs: Math.max(0, Math.round(Number(input.maxScrollApplyMs || 0))),
				maxLongTaskMs: Math.max(0, Math.round(Number(input.maxLongTaskMs || 0))),
				longTaskCount: Math.max(0, Math.round(Number(input.longTaskCount || 0))),
				threadListCount: metrics.threadListCount,
				threadListVisible: Boolean(metrics.visible),
				threadListMonitorable: Boolean(threadListMonitorable)
			}, {
				key: "thread-list-runtime-stall",
				minIntervalMs: THREAD_LIST_RUNTIME_STALL_REPORT_INTERVAL_MS
			});
			return true;
		}
		function sampleThreadListInputDelay(action = "thread-list-input") {
			if (!threadListRuntimeMetrics().visible) return;
			const list = $("threadList");
			const startedAt = nowPerfMs();
			const startScrollTop = list ? Number(list.scrollTop || 0) : 0;
			requestAnimationFrame(() => {
				const rafDelayMs = roundedDurationMs(startedAt);
				requestAnimationFrame(() => {
					const elapsedMs = roundedDurationMs(startedAt);
					const scrollApplyMs = (list ? Number(list.scrollTop || 0) : startScrollTop) !== startScrollTop ? elapsedMs : rafDelayMs;
					recordThreadListRuntimeStall({
						action,
						maxRafDelayMs: rafDelayMs,
						maxScrollApplyMs: scrollApplyMs,
						elapsedMs
					});
				});
			});
		}
		function startThreadListRuntimeHeartbeat() {
			if (state.threadListRuntimeHeartbeatFrame) return;
			const tick = (timestamp) => {
				const previous = Number(state.threadListRuntimeLastFrameAt || 0);
				if (previous > 0) {
					const delayMs = Math.max(0, Math.round(Number(timestamp || 0) - previous));
					if (delayMs >= THREAD_LIST_RUNTIME_STALL_MIN_MS) recordThreadListRuntimeStall({
						action: "thread-list-heartbeat",
						maxRafDelayMs: delayMs,
						elapsedMs: delayMs
					});
				}
				state.threadListRuntimeLastFrameAt = Number(timestamp || nowPerfMs());
				state.threadListRuntimeHeartbeatFrame = requestAnimationFrame(tick);
			};
			state.threadListRuntimeHeartbeatFrame = requestAnimationFrame(tick);
		}
		function startThreadListRuntimeLongTaskObserver() {
			if (state.threadListRuntimeLongTaskObserver || typeof PerformanceObserver !== "function") return;
			try {
				const observer = new PerformanceObserver((list) => {
					let maxLongTaskMs = 0;
					let longTaskCount = 0;
					for (const entry of list.getEntries()) {
						const duration = Math.max(0, Math.round(Number(entry && entry.duration || 0)));
						if (duration < THREAD_LIST_RUNTIME_STALL_MIN_MS) continue;
						maxLongTaskMs = Math.max(maxLongTaskMs, duration);
						longTaskCount += 1;
					}
					if (maxLongTaskMs > 0) recordThreadListRuntimeStall({
						action: "thread-list-longtask",
						maxLongTaskMs,
						longTaskCount,
						elapsedMs: maxLongTaskMs
					});
				});
				observer.observe({
					type: "longtask",
					buffered: true
				});
				state.threadListRuntimeLongTaskObserver = observer;
			} catch (_) {
				state.threadListRuntimeLongTaskObserver = null;
			}
		}
		function startThreadListRuntimeStallMonitoring() {
			const list = $("threadList");
			if (list) [
				"pointerdown",
				"touchstart",
				"wheel",
				"scroll"
			].forEach((eventName) => {
				list.addEventListener(eventName, () => sampleThreadListInputDelay(`thread-list-${eventName}`), { passive: true });
			});
			document.addEventListener("visibilitychange", () => {
				if (document.visibilityState === "hidden") state.threadListRuntimeLastFrameAt = 0;
			});
			startThreadListRuntimeHeartbeat();
			startThreadListRuntimeLongTaskObserver();
		}
		function conversationHasClientSubmissionHash(submissionHash) {
			const hash = String(submissionHash || "").trim();
			const conversation = $("conversation");
			if (!hash || !conversation) return false;
			return Array.from(conversation.querySelectorAll("[data-client-submission-hash]")).some((node) => String(node && node.getAttribute && node.getAttribute("data-client-submission-hash") || "") === hash);
		}
		function frontendHealthThreadForSubmission(threadId) {
			const id = String(threadId || "").trim();
			if (!id) return null;
			if (state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
			return state.threadTileDetails && state.threadTileDetails.get(id) || null;
		}
		function probeSubmittedMessageDom(threadId, clientSubmissionId, action = "message-submit", startedAtMs = Date.now()) {
			const id = String(threadId || "").trim();
			const submissionId = String(clientSubmissionId || "").trim();
			const submissionHash = clientSubmissionDiagnosticHash(submissionId);
			if (!id || !submissionId || !submissionHash) return;
			const thread = frontendHealthThreadForSubmission(id);
			const domShape = conversationDomShape();
			const visibleShape = thread ? visibleConversationShape(thread) : { visibleItemCount: 0 };
			applyFrontendRuntimeHealthEffectsPlan(frontendRuntimeHealthApi.submittedMessageDomProbeEffects({
				elapsedMs: Date.now() - Number(startedAtMs || Date.now()),
				action,
				routeKind: diagnosticRouteKind(),
				threadHash: diagnosticThreadHash(id),
				itemHash: submissionHash,
				currentThreadMatch: !state.threadTileMode && String(state.currentThreadId || "") === id,
				hasThreadSubmission: threadHasClientSubmission(thread, submissionId),
				domHasSubmission: conversationHasClientSubmissionHash(submissionHash),
				visibleCount: visibleShape.visibleItemCount,
				domCount: domShape.itemCount,
				composerBusy: state.composerBusy
			}));
		}
		function scheduleSubmittedMessageDomProbe(threadId, clientSubmissionId, action = "message-submit") {
			const id = String(threadId || "").trim();
			const submissionId = String(clientSubmissionId || "").trim();
			if (!id || !submissionId) return;
			const startedAtMs = Date.now();
			[
				350,
				1200,
				2800
			].forEach((delayMs) => {
				setTimeout(() => probeSubmittedMessageDom(id, submissionId, action, startedAtMs), delayMs);
			});
		}
		function applyThreadDetailResponseDiagnosticEffect(effect) {
			const item = effect && typeof effect === "object" ? effect : {};
			if (!item.type) return;
			if (item.type === "diagnostic-failure") {
				recordHomeAiDiagnosticFailure(item.diagnostic || {});
				return;
			}
			if (item.type === "diagnostic-success") {
				recordHomeAiDiagnosticSuccess(item.diagnostic || {});
				return;
			}
			throw new Error(`Unknown thread detail response diagnostic effect: ${item.type}`);
		}
		function applyThreadDetailResponseDiagnosticEffectsPlan(plan) {
			const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
			for (const effect of effects) applyThreadDetailResponseDiagnosticEffect(effect);
		}
		function recordThreadDetailResponseDiagnostics(performanceEvent = {}, input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const threadHash = diagnosticThreadHash(String(source.threadId || state.currentThreadId || ""));
			const action = String(source.action || "thread-detail").slice(0, 80);
			const durationBucket = source.durationBucket || diagnosticDurationBucket(Number(performanceEvent && performanceEvent.elapsedMs || 0));
			const slowPlan = threadPerformanceMetrics.planThreadDetailSlowPathDiagnostic(performanceEvent, {
				action,
				threadHash,
				durationBucket
			});
			const contractPlan = threadPerformanceMetrics.planThreadDetailResponseContractDiagnostic(performanceEvent, {
				action,
				threadHash,
				durationBucket,
				thread: source.thread,
				expectedActiveFullRead: source.expectedActiveFullRead
			});
			applyThreadDetailResponseDiagnosticEffectsPlan(threadDiagnosticEventsApi.threadDetailResponseDiagnosticEffects({
				slowPlan,
				slowSuccessInput: {
					action,
					threadHash,
					readMode: performanceEvent && performanceEvent.readMode || "",
					renderMode: performanceEvent && performanceEvent.clientTimings && performanceEvent.clientTimings.detailRenderMode || ""
				},
				contractPlan
			}));
		}
		function conversationDomShape() {
			const conversation = $("conversation");
			if (!conversation) return {
				renderKeyCount: 0,
				duplicateRenderKeyCount: 0,
				duplicateUserMessageCount: 0,
				turnCount: 0,
				itemCount: 0
			};
			const seen = /* @__PURE__ */ new Set();
			let duplicateRenderKeyCount = 0;
			for (const node of Array.from(conversation.querySelectorAll("[data-render-key]"))) {
				const key = String(node && node.getAttribute && node.getAttribute("data-render-key") || "");
				if (!key) continue;
				if (seen.has(key)) duplicateRenderKeyCount += 1;
				else seen.add(key);
			}
			let duplicateUserMessageCount = 0;
			const userMessageNodes = [];
			for (const turnNode of Array.from(conversation.querySelectorAll("article.turn[data-turn], article.thread-tile-turn[data-thread-tile-turn]"))) for (const node of Array.from(turnNode.querySelectorAll(".item.userMessage"))) userMessageNodes.push({
				turnNode,
				node
			});
			duplicateUserMessageCount = duplicateUserMessageSignatureCount(userMessageNodes, (entry) => domUserMessageEventDuplicateSignature(entry.turnNode, entry.node));
			return {
				renderKeyCount: seen.size,
				duplicateRenderKeyCount,
				duplicateUserMessageCount,
				turnCount: conversation.querySelectorAll("article.turn[data-turn], article.thread-tile-turn[data-thread-tile-turn]").length,
				itemCount: conversation.querySelectorAll("[data-item]").length
			};
		}
		function duplicateUserMessageSignatureCount(entries, signatureForEntry) {
			const seen = /* @__PURE__ */ new Set();
			let duplicates = 0;
			for (const entry of Array.isArray(entries) ? entries : []) {
				const signature = String(signatureForEntry(entry) || "").trim();
				if (!signature) continue;
				if (seen.has(signature)) duplicates += 1;
				else seen.add(signature);
			}
			return duplicates;
		}
		function domUserMessageDuplicateSignature(turnNode, node) {
			if (!node || !node.getAttribute) return "";
			const turnId = String(turnNode && turnNode.getAttribute && (turnNode.getAttribute("data-turn") || turnNode.getAttribute("data-thread-tile-turn")) || "").trim();
			const submissionHash = String(node.getAttribute("data-client-submission-hash") || "").trim();
			if (submissionHash) return `submission:${turnId}:${submissionHash}`;
			const body = node.querySelector && node.querySelector(".item-body");
			const text = String((body || node).textContent || "").replace(/\s+/g, " ").trim();
			return text ? `text:${turnId}:${stableTextHash(text)}` : "";
		}
		function domUserMessageEventDuplicateSignature(turnNode, node) {
			if (!node || !node.getAttribute) return "";
			const submissionHash = String(node.getAttribute("data-client-submission-hash") || "").trim();
			if (submissionHash) return `submission:${submissionHash}`;
			const body = node.querySelector && node.querySelector(".item-body");
			const text = String((body || node).textContent || "").replace(/\s+/g, " ").trim();
			if (!text) return "";
			const timestamp = node.querySelector && node.querySelector(".item-timestamp");
			const datetime = String(timestamp && timestamp.getAttribute && timestamp.getAttribute("datetime") || "").trim();
			const timestampMs = datetime ? Date.parse(datetime) : 0;
			if (Number.isFinite(timestampMs) && timestampMs > 0) return `text-time:${Math.floor(timestampMs / 5e3)}:${stableTextHash(text)}`;
			return domUserMessageDuplicateSignature(turnNode, node);
		}
		function visibleUserMessageDuplicateSignature(turn, item) {
			if (!item || item.type !== "userMessage") return "";
			const turnId = String(turn && turn.id || turn && turn.mobileVisibleKey || "").trim();
			const submissionHash = clientSubmissionDiagnosticHash(item && item.clientSubmissionId);
			if (submissionHash) return `submission:${turnId}:${submissionHash}`;
			const comparable = userMessageComparableParts(item);
			const text = String(comparable.text || itemTextValue(item && item.text) || itemTextValue(item && item.message) || itemTextValue(item && item.content) || "").replace(/\s+/g, " ").trim();
			return text ? `text:${turnId}:${stableTextHash(text)}` : "";
		}
		function visibleUserMessageEventDuplicateSignature(turn, item) {
			if (!item || item.type !== "userMessage") return "";
			const submissionHash = clientSubmissionDiagnosticHash(item && item.clientSubmissionId);
			if (submissionHash) return `submission:${submissionHash}`;
			const comparable = userMessageComparableParts(item);
			const text = String(comparable.text || itemTextValue(item && item.text) || itemTextValue(item && item.message) || itemTextValue(item && item.content) || "").replace(/\s+/g, " ").trim();
			if (!text) return "";
			const timestampMs = userMessageTimestampMs(item) || turnStartedAtMs(turn);
			if (timestampMs) return `text-time:${Math.floor(timestampMs / 5e3)}:${stableTextHash(text)}`;
			return visibleUserMessageDuplicateSignature(turn, item);
		}
		function turnRendersConversationArticle(turn, thread) {
			if (!turn || !turn.id) return false;
			if (visibleItemsForTurn(turn, thread).length > 0) return true;
			if (typeof visibleItemBudgetSignature === "function" && visibleItemBudgetSignature(turn)) return true;
			const threadId = typeof renderContextThreadId === "function" ? renderContextThreadId(thread) : String(thread && thread.id || state.currentThreadId || "");
			if (typeof approvalsForTurn === "function" && approvalsForTurn(threadId, turn.id).length > 0) return true;
			if (typeof turnHasThreadTaskCardDraftResponse === "function" && turnHasThreadTaskCardDraftResponse(turn)) return true;
			return Boolean(typeof turnHasThreadTaskCardRequest === "function" && typeof isLatestTurn === "function" && typeof isLiveTurn === "function" && isLatestTurn(turn, thread) && isLiveTurn(turn, thread) && turnHasThreadTaskCardRequest(turn));
		}
		function visibleRenderableTurnsForConversation(thread) {
			return visibleTurnsForConversation(thread).filter((turn) => turnRendersConversationArticle(turn, thread));
		}
		function visibleConversationShape(thread) {
			const turns = visibleRenderableTurnsForConversation(thread);
			let visibleItemCount = 0;
			const userMessages = [];
			for (const turn of turns) {
				const visibleItems = visibleItemsForTurn(turn, thread);
				visibleItemCount += visibleItems.length;
				for (const entry of visibleItems) {
					const item = entry && entry.item;
					if (item && item.type === "userMessage") userMessages.push({
						turn,
						item
					});
				}
			}
			const duplicateUserMessageCount = duplicateUserMessageSignatureCount(userMessages, (entry) => visibleUserMessageEventDuplicateSignature(entry.turn, entry.item));
			return {
				visibleTurnCount: turns.length,
				visibleItemCount,
				duplicateUserMessageCount
			};
		}
		function rememberThreadDetailRenderEvidence(thread, source = "unknown") {
			if (!thread || thread.mobileLoading || thread.mobileLoadError) return null;
			const threadId = String(thread.id || state.currentThreadId || "").trim();
			if (!threadId) return null;
			const shape = visibleConversationShape(thread);
			if (!shape.visibleTurnCount && !shape.visibleItemCount) return null;
			const itemCount = (Array.isArray(thread.turns) ? thread.turns : []).reduce((total, turn) => total + (Array.isArray(turn && turn.items) ? turn.items.length : 0), 0);
			const evidence = threadDetailStateApi.buildThreadDetailRenderEvidence({
				atMs: Date.now(),
				threadId,
				threadHash: diagnosticThreadHash(threadId),
				readMode: thread.mobileReadMode || "",
				sourceKind: homeAiDiagnosticReportingApi.boundedToken(source, "unknown", 80),
				turnCount: shape.visibleTurnCount,
				visibleItemCount: shape.visibleItemCount,
				itemCount
			});
			if (!evidence) return null;
			state.lastThreadDetailRenderEvidence = evidence;
			return evidence;
		}
		function clearThreadDetailRenderEvidence(reason = "") {
			if (!state.lastThreadDetailRenderEvidence) return;
			state.lastThreadDetailRenderEvidence = null;
			postClientEvent("thread_detail_render_evidence_cleared", { reason: String(reason || "").slice(0, 80) });
		}
		function recentThreadDetailRenderEvidence() {
			return threadDetailStateApi.recentThreadDetailRenderEvidence({
				evidence: state.lastThreadDetailRenderEvidence,
				nowMs: Date.now(),
				maxAgeMs: PRIMARY_SHELL_CONFLICT_EVIDENCE_MS
			});
		}
		function primaryShellSelectionConflictInput(reason, details = {}) {
			const evidence = recentThreadDetailRenderEvidence() || {};
			const thread = state.currentThread || null;
			const shape = thread ? visibleConversationShape(thread) : null;
			return {
				reason,
				action: "primary-shell-selection",
				routeKind: "embedded-primary",
				sourceKind: details.source || evidence.sourceKind || "",
				threadHash: evidence.threadHash || diagnosticThreadHash(state.currentThreadId || thread && thread.id || ""),
				readMode: evidence.readMode || thread && thread.mobileReadMode || "",
				renderMode: details.renderMode || "",
				turns: evidence.turnCount || shape && shape.visibleTurnCount || 0,
				visibleItems: evidence.visibleItemCount || shape && shape.visibleItemCount || 0,
				items: evidence.itemCount || 0,
				domCount: details.domCount,
				previousCount: details.previousCount,
				recentDetailAgeMs: evidence.ageMs || 0,
				hasCurrentThread: Boolean(state.currentThread),
				hasCurrentThreadId: Boolean(state.currentThreadId),
				hasThreadLoadController: Boolean(state.threadLoadController),
				startupThreadOpenPending: Boolean(state.startupThreadOpenPending),
				mobileLoading: Boolean(state.currentThread && state.currentThread.mobileLoading)
			};
		}
		function recordPrimaryShellSelectionConflict(reason, details = {}) {
			return recordHomeAiDiagnosticFailure(threadDiagnosticEventsApi.primaryShellSelectionConflictDiagnosticEvent(primaryShellSelectionConflictInput(reason, details)));
		}
		function recordPrimaryShellSelectionHealthy(source, thread = state.currentThread) {
			const evidence = rememberThreadDetailRenderEvidence(thread, source);
			if (!evidence) return null;
			return recordHomeAiDiagnosticSuccess(threadDiagnosticEventsApi.primaryShellSelectionConflictDiagnosticSuccess({
				action: "primary-shell-selection",
				routeKind: "embedded-primary",
				sourceKind: source,
				threadHash: evidence.threadHash,
				readMode: evidence.readMode
			}));
		}
		function emptyVisibleDetailMismatchInput(reason, thread = state.currentThread, details = {}) {
			const threadId = String(thread && thread.id || state.currentThreadId || "").trim();
			const evidence = recentThreadDetailRenderEvidence();
			const sameThreadEvidence = threadDetailStateApi.sameThreadDetailRenderEvidence({
				evidence,
				threadId
			});
			const shape = thread ? visibleConversationShape(thread) : {
				visibleTurnCount: 0,
				visibleItemCount: 0
			};
			return {
				reason,
				action: details.action || "single-thread-empty-state",
				routeKind: details.routeKind || "single-thread",
				sourceKind: details.source || sameThreadEvidence && sameThreadEvidence.sourceKind || "",
				threadHash: details.threadHash || sameThreadEvidence && sameThreadEvidence.threadHash || diagnosticThreadHash(threadId),
				readMode: sameThreadEvidence && sameThreadEvidence.readMode || thread && thread.mobileReadMode || "",
				renderMode: details.renderMode || "",
				turns: Object.prototype.hasOwnProperty.call(details, "turns") ? details.turns : sameThreadEvidence && sameThreadEvidence.turnCount || 0,
				visibleItems: Object.prototype.hasOwnProperty.call(details, "visibleItems") ? details.visibleItems : sameThreadEvidence && sameThreadEvidence.visibleItemCount || 0,
				items: Object.prototype.hasOwnProperty.call(details, "items") ? details.items : sameThreadEvidence && sameThreadEvidence.itemCount || 0,
				currentTurns: Object.prototype.hasOwnProperty.call(details, "currentTurns") ? details.currentTurns : shape.visibleTurnCount,
				currentVisibleItems: Object.prototype.hasOwnProperty.call(details, "currentVisibleItems") ? details.currentVisibleItems : shape.visibleItemCount,
				domCount: details.domCount,
				previousCount: details.previousCount,
				detailLoaded: Boolean(thread && thread.mobileDetailLoaded),
				mobileLoading: Boolean(thread && thread.mobileLoading),
				recentDetailAgeMs: sameThreadEvidence && sameThreadEvidence.ageMs || 0
			};
		}
		function recordEmptyVisibleDetailMismatch(reason, thread = state.currentThread, details = {}) {
			return recordHomeAiDiagnosticFailure(threadDiagnosticEventsApi.emptyVisibleDetailMismatchDiagnosticEvent(emptyVisibleDetailMismatchInput(reason, thread, details)));
		}
		function recordEmptyVisibleDetailHealthy(source, thread = state.currentThread) {
			if (!thread || thread.mobileLoading || thread.mobileLoadError) return null;
			const threadId = String(thread.id || state.currentThreadId || "").trim();
			if (!threadId) return null;
			const shape = visibleConversationShape(thread);
			if (!shape.visibleTurnCount && !shape.visibleItemCount) return null;
			return recordHomeAiDiagnosticSuccess(threadDiagnosticEventsApi.emptyVisibleDetailMismatchDiagnosticSuccess({
				action: "single-thread-empty-state",
				routeKind: "single-thread",
				sourceKind: source,
				threadHash: diagnosticThreadHash(threadId),
				readMode: thread.mobileReadMode || ""
			}));
		}
		function maybeRecoverEmptyDetailWithHistoryEvidence(thread, details = {}) {
			const now = Date.now();
			const basePlan = threadDetailStateApi.planEmptyDetailHistoryRecovery({
				thread,
				currentThreadId: state.currentThreadId,
				details,
				nowMs: now,
				cooldownMs: 0
			});
			if (!basePlan.shouldRecover || !basePlan.recoveryKey) return false;
			const plan = threadDetailStateApi.planEmptyDetailHistoryRecovery({
				thread,
				currentThreadId: state.currentThreadId,
				details,
				nowMs: now,
				lastRecoveredAtMs: state.emptyDetailHistoryRecoveryAtByKey.get(basePlan.recoveryKey),
				cooldownMs: EMPTY_DETAIL_HISTORY_RECOVERY_COOLDOWN_MS
			});
			if (!plan.shouldRecover || !plan.recoveryKey) return false;
			state.emptyDetailHistoryRecoveryAtByKey.set(plan.recoveryKey, plan.nowMs || now);
			recordEmptyVisibleDetailMismatch(plan.diagnosticReason || "empty_render_with_history_evidence", thread, details);
			if (!hasThreadDetailRequestInFlight()) scheduleCurrentThreadRefresh(0, "empty-detail-history-evidence");
			postClientEvent("empty_detail_history_recovery", plan.event || {});
			return true;
		}
		function emptyCachedDetailReuseInput(reason, thread = state.currentThread, details = {}) {
			const threadId = String(thread && thread.id || state.currentThreadId || "").trim();
			const shape = thread ? visibleConversationShape(thread) : {
				visibleTurnCount: 0,
				visibleItemCount: 0
			};
			const itemCount = (Array.isArray(thread && thread.turns) ? thread.turns : []).reduce((total, turn) => total + (Array.isArray(turn && turn.items) ? turn.items.length : 0), 0);
			return {
				reason,
				action: "thread-open-cache-reuse",
				routeKind: "single-thread",
				sourceKind: details.source || "",
				threadHash: diagnosticThreadHash(threadId),
				readMode: thread && thread.mobileReadMode || "",
				currentTurns: shape.visibleTurnCount,
				currentVisibleItems: shape.visibleItemCount,
				items: itemCount,
				detailLoaded: Boolean(thread && thread.mobileDetailLoaded),
				reusableDetail: Boolean(details.reusableDetail),
				mobileLoading: Boolean(thread && thread.mobileLoading),
				threadTaskCardCount: Array.isArray(thread && thread.threadTaskCards) ? thread.threadTaskCards.length : 0
			};
		}
		function recordEmptyCachedDetailReuseBlocked(reason, thread = state.currentThread, details = {}) {
			return recordHomeAiDiagnosticFailure(threadDiagnosticEventsApi.emptyCachedDetailReuseBlockedDiagnosticEvent(emptyCachedDetailReuseInput(reason, thread, details)));
		}
		function recordEmptyCachedDetailReuseHealthy(source, thread = state.currentThread) {
			const threadId = String(thread && thread.id || state.currentThreadId || "").trim();
			if (!threadId) return null;
			return recordHomeAiDiagnosticSuccess(threadDiagnosticEventsApi.emptyCachedDetailReuseDiagnosticSuccess({
				action: "thread-open-cache-reuse",
				routeKind: "single-thread",
				sourceKind: source,
				threadHash: diagnosticThreadHash(threadId),
				readMode: thread && thread.mobileReadMode || ""
			}));
		}
		function checkEmptyVisibleDetailMismatchAfterRender(thread, shellPlan = {}, metrics = {}) {
			if (!thread || thread.mobileLoading || thread.mobileLoadError) return;
			if (shellPlan.hasPrimaryContent || shellPlan.emptyMessage !== "No visible turns.") return;
			const threadId = String(thread.id || state.currentThreadId || "").trim();
			const evidence = recentThreadDetailRenderEvidence();
			const details = {
				source: metrics.source || "single-thread-render",
				renderMode: metrics.renderMode || "full-render",
				domCount: metrics.domCount,
				previousCount: metrics.previousCount
			};
			if (threadDetailStateApi.hasNonemptyThreadDetailRenderEvidence(threadDetailStateApi.sameThreadDetailRenderEvidence({
				evidence,
				threadId
			}))) {
				recordEmptyVisibleDetailMismatch("empty_render_after_nonempty_detail", thread, details);
				return;
			}
			maybeRecoverEmptyDetailWithHistoryEvidence(thread, details);
		}
		function visibleRenderableTurnIds(thread) {
			return visibleRenderableTurnsForConversation(thread).map((turn) => String(turn.id));
		}
		function conversationDomTurnIds(conversation = $("conversation")) {
			if (!conversation) return [];
			return Array.from(conversation.querySelectorAll("article.turn[data-turn]")).map((node) => String(node && node.getAttribute && node.getAttribute("data-turn") || "")).filter(Boolean);
		}
		function threadTileVisibleShape(ids = state.threadTileActiveIds) {
			return (Array.isArray(ids) ? ids : []).reduce((shape, id) => {
				const thread = threadTileDisplayThread(id);
				visibleTurnsForConversation(thread).forEach((turn) => {
					const visibleItems = visibleItemsForTurn(turn, thread);
					const itemCount = visibleItems.length;
					if (itemCount > 0) {
						shape.turnCount += 1;
						shape.visibleItemCount += itemCount;
						const userMessages = visibleItems.map((entry) => entry && entry.item).filter((item) => item && item.type === "userMessage");
						shape.duplicateUserMessageCount += duplicateUserMessageSignatureCount(userMessages, (item) => visibleUserMessageDuplicateSignature(turn, item));
					}
				});
				return shape;
			}, {
				turnCount: 0,
				visibleItemCount: 0,
				duplicateUserMessageCount: 0
			});
		}
		function threadTileVisibleTurnCount(ids = state.threadTileActiveIds) {
			return threadTileVisibleShape(ids).turnCount;
		}
		function threadTileDomTurnCount(conversation = $("conversation")) {
			if (!conversation) return 0;
			return conversation.querySelectorAll("article.thread-tile-turn[data-thread-tile-turn]").length;
		}
		function conversationTurnOrderDiagnosticSnapshot(source, extra = {}, deps = {}) {
			const conversation = deps.conversation || $("conversation");
			const thread = deps.thread || state.currentThread;
			if (!conversation || !thread) return null;
			const tileMode = Object.prototype.hasOwnProperty.call(deps, "threadTileMode") ? deps.threadTileMode === true : state.threadTileMode === true;
			const tileDomActive = Object.prototype.hasOwnProperty.call(deps, "tileDomActive") ? deps.tileDomActive === true : Boolean(conversation.classList && conversation.classList.contains("thread-tile-mode"));
			if (tileMode || tileDomActive) return null;
			const expectedIds = Array.isArray(deps.expectedTurnIds) ? deps.expectedTurnIds.map(String).filter(Boolean) : visibleRenderableTurnIds(thread);
			const domIds = Array.isArray(deps.domTurnIds) ? deps.domTurnIds.map(String).filter(Boolean) : conversationDomTurnIds(conversation);
			const expectedLatestId = expectedIds[expectedIds.length - 1] || "";
			return threadDiagnosticEventsApi.turnOrderDiagnosticSnapshot({
				source,
				readMode: thread.mobileReadMode || "",
				renderMode: extra.renderMode || "",
				threadHash: diagnosticThreadHash(thread.id || state.currentThreadId),
				turnHash: diagnosticTurnHash(expectedLatestId),
				expectedTurnIds: expectedIds,
				domTurnIds: domIds
			});
		}
		function conversationProjectionDiagnosticSnapshot(source, extra = {}, deps = {}) {
			const conversation = deps.conversation || $("conversation");
			if (!conversation) return null;
			const renderedSignature = Object.prototype.hasOwnProperty.call(deps, "renderedConversationSignature") ? String(deps.renderedConversationSignature || "") : String(state.renderedConversationSignature || "");
			const domShape = deps.domShape || conversationDomShape();
			const tileMode = Object.prototype.hasOwnProperty.call(deps, "threadTileMode") ? deps.threadTileMode === true : state.threadTileMode === true;
			const tileDomActive = Object.prototype.hasOwnProperty.call(deps, "tileDomActive") ? deps.tileDomActive === true : Boolean(conversation.classList && conversation.classList.contains("thread-tile-mode"));
			return threadDiagnosticEventsApi.conversationProjectionDiagnosticSnapshot({
				source,
				renderMode: extra.renderMode,
				renderedSignature,
				domShape,
				threadTileMode: tileMode,
				tileDomActive,
				tileLayout: deps.tileLayout,
				tileIds: deps.tileIds,
				tileDisplayLayout: deps.tileDisplayLayout,
				tileSignature: deps.tileSignature,
				currentSignature: deps.currentSignature,
				thread: deps.thread || state.currentThread
			}, {
				singleSignature: conversationRenderSignature,
				tileLayout: threadTileLayout,
				tileCandidateIds: threadTileCandidateIds,
				tileDisplayLayout: threadTileDisplayLayout,
				tileRenderSignature: threadTileRenderSignature,
				tileThreadForId: typeof deps.tileThreadForId === "function" ? deps.tileThreadForId : threadTileDisplayThread,
				visibleShape: visibleConversationShape
			});
		}
		function applyConversationProjectionConsistencyEffect(effect) {
			const item = effect && typeof effect === "object" ? effect : {};
			if (!item.type) return;
			if (item.type === "diagnostic-failure") {
				recordHomeAiDiagnosticFailure(item.diagnostic || {});
				return;
			}
			if (item.type === "diagnostic-success") {
				recordHomeAiDiagnosticSuccess(item.diagnostic || {});
				return;
			}
			throw new Error(`Unknown conversation projection consistency effect: ${item.type}`);
		}
		function applyConversationProjectionConsistencyEffectsPlan(plan) {
			const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
			for (const effect of effects) applyConversationProjectionConsistencyEffect(effect);
		}
		function checkConversationProjectionConsistency(source, extra = {}) {
			if (!state.currentThread || state.currentThread.mobileLoading || state.currentThread.mobileLoadError) return;
			recordPrimaryShellSelectionHealthy(source, state.currentThread);
			recordEmptyVisibleDetailHealthy(source, state.currentThread);
			const snapshot = conversationProjectionDiagnosticSnapshot(source, extra);
			if (!snapshot) return;
			const orderSnapshot = conversationTurnOrderDiagnosticSnapshot(source, extra);
			applyConversationProjectionConsistencyEffectsPlan(threadDiagnosticEventsApi.conversationProjectionConsistencyEffects({
				snapshot,
				orderSnapshot
			}));
		}
		function startUiWatchdog() {
			if (state.uiWatchdogTimer) return;
			state.lastUiWatchdogTickAt = Date.now();
			state.uiWatchdogTimer = setInterval(() => {
				const now = Date.now();
				const lagMs = now - state.lastUiWatchdogTickAt - 1e3;
				state.lastUiWatchdogTickAt = now;
				if (document.visibilityState === "hidden" || lagMs < 2500) return;
				if (now - state.lastUiStallReportedAt < 15e3) return;
				state.lastUiStallReportedAt = now;
				postClientEvent("ui_stall", {
					lagMs: Math.round(lagMs),
					composerBusy: state.composerBusy,
					activeTurnId: state.activeTurnId || "",
					hasContent: composerHasContent()
				});
			}, 1e3);
		}
		function updatePushButton() {
			const button = $("pushNotifications");
			if (!button) return;
			button.classList.remove("hidden", "ready", "error");
			const hideButton = () => {
				button.textContent = "";
				button.disabled = true;
				button.classList.add("hidden");
			};
			if (state.pushBusy) {
				button.textContent = "Working...";
				button.disabled = true;
				return;
			}
			if (!state.pushServerSupported) {
				hideButton();
				return;
			}
			if (!window.isSecureContext) {
				hideButton();
				return;
			}
			if (!pushBrowserAvailable()) {
				hideButton();
				return;
			}
			if (Notification.permission === "denied") {
				button.textContent = "Notifications blocked";
				button.disabled = true;
				button.classList.add("error");
				return;
			}
			if (state.pushSubscribed) {
				button.textContent = "Send test notification";
				button.disabled = false;
				button.classList.add("ready");
				return;
			}
			button.textContent = "Enable notifications";
			button.disabled = false;
			if (state.pushError) button.classList.add("error");
		}
		async function registerPushServiceWorker() {
			if (state.serviceWorkerRegistration) return state.serviceWorkerRegistration;
			state.serviceWorkerRegistration = await navigator.serviceWorker.register("/sw.js");
			if (state.serviceWorkerRegistration && state.serviceWorkerRegistration.update) state.serviceWorkerRegistration.update().catch(() => {});
			return state.serviceWorkerRegistration;
		}
		async function syncExistingPushSubscription() {
			if (!state.key || !pushBrowserAvailable()) return;
			const subscription = await (await registerPushServiceWorker()).pushManager.getSubscription();
			state.pushSubscribed = Boolean(subscription);
			if (subscription) await api("/api/push/subscribe", {
				method: "POST",
				body: JSON.stringify({ subscription: pushSubscriptionToJson(subscription) })
			});
		}
		async function initializePushControls() {
			state.pushError = "";
			updatePushButton();
			if (!pushBrowserAvailable() || !state.key) return;
			try {
				await syncExistingPushSubscription();
			} catch (err) {
				state.pushError = err.message || String(err);
			} finally {
				updatePushButton();
			}
		}
		async function enablePushNotifications() {
			if (!pushBrowserAvailable()) return;
			const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
			if (permission !== "granted") {
				state.pushSubscribed = false;
				state.pushError = permission === "denied" ? "Notifications blocked" : "Notification permission not granted";
				updatePushButton();
				return;
			}
			const registration = await registerPushServiceWorker();
			let subscription = await registration.pushManager.getSubscription();
			if (!subscription) {
				const key = await api("/api/push/vapid-public-key");
				subscription = await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: base64UrlToUint8Array(key.publicKey)
				});
			}
			await api("/api/push/subscribe", {
				method: "POST",
				body: JSON.stringify({ subscription: pushSubscriptionToJson(subscription) })
			});
			state.pushSubscribed = true;
			state.pushError = "";
			$("connectionState").classList.remove("error");
			$("connectionState").textContent = "Notifications enabled";
		}
		async function sendTestPushNotification() {
			const result = await api("/api/push/test", {
				method: "POST",
				body: "{}"
			});
			$("connectionState").classList.remove("error");
			if (result.sent) {
				$("connectionState").textContent = "Test notification sent";
				return;
			}
			if (result.failed) {
				const detail = result.lastError && (result.lastError.reason || result.lastError.statusCode) ? `${result.lastError.statusCode || ""} ${result.lastError.reason || ""}`.trim() : "delivery failed";
				throw new Error(`Test notification failed: ${detail}`);
			}
			$("connectionState").textContent = "No push subscription";
		}
		async function handlePushButtonClick() {
			if (state.pushBusy) return;
			state.pushBusy = true;
			updatePushButton();
			try {
				if (state.pushSubscribed) await sendTestPushNotification();
				else await enablePushNotifications();
			} catch (err) {
				state.pushError = err.message || String(err);
				showError(err);
			} finally {
				state.pushBusy = false;
				updatePushButton();
			}
		}
		const legacyGlobals = {
			api,
			postClientEvent,
			nowPerfMs,
			roundedDurationMs,
			postPerformanceEvent,
			diagnosticHash,
			diagnosticThreadHash,
			diagnosticTurnHash,
			diagnosticTaskHash,
			diagnosticItemHash,
			clientSubmissionDiagnosticHash,
			clientSubmissionDataAttr,
			diagnosticRouteKind,
			diagnosticErrorStatus,
			diagnosticErrorCode,
			diagnosticDurationBucket,
			currentHomeAiDiagnosticContext,
			postHomeAiDiagnosticReport,
			recordHomeAiDiagnosticFailure,
			recordHomeAiDiagnosticSuccess,
			applyFrontendRuntimeHealthEffect,
			applyFrontendRuntimeHealthEffectsPlan,
			threadListRuntimeMetrics,
			recordThreadListRuntimeStall,
			sampleThreadListInputDelay,
			startThreadListRuntimeHeartbeat,
			startThreadListRuntimeLongTaskObserver,
			startThreadListRuntimeStallMonitoring,
			conversationHasClientSubmissionHash,
			frontendHealthThreadForSubmission,
			probeSubmittedMessageDom,
			scheduleSubmittedMessageDomProbe,
			applyThreadDetailResponseDiagnosticEffect,
			applyThreadDetailResponseDiagnosticEffectsPlan,
			recordThreadDetailResponseDiagnostics,
			conversationDomShape,
			duplicateUserMessageSignatureCount,
			domUserMessageDuplicateSignature,
			domUserMessageEventDuplicateSignature,
			visibleUserMessageDuplicateSignature,
			visibleUserMessageEventDuplicateSignature,
			turnRendersConversationArticle,
			visibleRenderableTurnsForConversation,
			visibleConversationShape,
			rememberThreadDetailRenderEvidence,
			clearThreadDetailRenderEvidence,
			recentThreadDetailRenderEvidence,
			primaryShellSelectionConflictInput,
			recordPrimaryShellSelectionConflict,
			recordPrimaryShellSelectionHealthy,
			emptyVisibleDetailMismatchInput,
			recordEmptyVisibleDetailMismatch,
			recordEmptyVisibleDetailHealthy,
			maybeRecoverEmptyDetailWithHistoryEvidence,
			emptyCachedDetailReuseInput,
			recordEmptyCachedDetailReuseBlocked,
			recordEmptyCachedDetailReuseHealthy,
			checkEmptyVisibleDetailMismatchAfterRender,
			visibleRenderableTurnIds,
			conversationDomTurnIds,
			threadTileVisibleShape,
			threadTileVisibleTurnCount,
			threadTileDomTurnCount,
			conversationTurnOrderDiagnosticSnapshot,
			conversationProjectionDiagnosticSnapshot,
			applyConversationProjectionConsistencyEffect,
			applyConversationProjectionConsistencyEffectsPlan,
			checkConversationProjectionConsistency,
			startUiWatchdog,
			updatePushButton,
			registerPushServiceWorker,
			syncExistingPushSubscription,
			initializePushControls,
			enablePushNotifications,
			sendTestPushNotification,
			handlePushButtonClick
		};
		function createApiClientRuntime() {
			return Object.assign({}, legacyGlobals);
		}
		const apiClientRuntimeApi = { createApiClientRuntime };
		if (typeof module === "object" && module.exports) module.exports = apiClientRuntimeApi;
		for (const [name, value] of Object.entries(legacyGlobals)) if (typeof value === "function") root[name] = value;
		root.CodexApiClientRuntime = apiClientRuntimeApi;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
//#region public/thread-list-load-policy.js
var require_thread_list_load_policy = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadListLoadPolicy = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function bool(value) {
			return value === true;
		}
		function text(value) {
			return String(value || "").trim();
		}
		function planThreadListLoadRequest(input = {}) {
			const silent = bool(input.silent);
			const selectedCwd = text(input.selectedCwd);
			const search = text(input.search);
			const threadDetailOpening = bool(input.threadDetailOpening);
			const documentHidden = bool(input.documentHidden);
			const allowDuringDetail = bool(input.allowDuringDetail);
			const allowHidden = bool(input.allowHidden);
			const hasLoadedList = Number(input.threadListLoadedAtMs || 0) > 0;
			const deferFallback = input.deferFallback;
			const suppressHiddenSilent = silent && documentHidden && !allowHidden;
			const suppressDetailSilent = silent && threadDetailOpening && !allowDuringDetail;
			const allowWarmFallbackInitial = deferFallback !== false && !selectedCwd && !search;
			const shouldDeferFallback = deferFallback === true || silent && deferFallback !== false && threadDetailOpening && !selectedCwd && !search;
			const shouldUseWarmFallbackInitial = allowWarmFallbackInitial && (shouldDeferFallback || !hasLoadedList);
			return {
				action: "thread-list-load-request",
				selectedCwd,
				search,
				silent,
				threadDetailOpening,
				documentHidden,
				shouldLoad: !suppressHiddenSilent && !suppressDetailSilent,
				skipReason: suppressHiddenSilent ? "hidden-silent" : suppressDetailSilent ? "detail-in-flight" : "",
				retryDelayMs: suppressDetailSilent ? 700 : 0,
				shouldDeferFallback,
				shouldUseWarmFallbackInitial,
				params: {
					fallback: shouldDeferFallback ? "defer" : "",
					initial: shouldUseWarmFallbackInitial ? "warm-fallback" : ""
				}
			};
		}
		return { planThreadListLoadRequest };
	});
}));
//#endregion
//#region public/thread-list-stable-order.js
var require_thread_list_stable_order = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadListStableOrder = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_HOLD_MS = 45e3;
		function text(value) {
			return String(value || "").trim();
		}
		function boundedHoldMs(value) {
			const number = Math.trunc(Number(value) || 0);
			if (number <= 0) return DEFAULT_HOLD_MS;
			return Math.min(3e5, Math.max(5e3, number));
		}
		function threadId(thread) {
			return text(thread && thread.id);
		}
		function threadListOrderScopeKey(input = {}) {
			const cwd = text(input.selectedCwd);
			const search = text(input.search).toLowerCase();
			return JSON.stringify({
				cwd,
				search
			});
		}
		function orderedThreadsById(threads, ids) {
			const byId = /* @__PURE__ */ new Map();
			for (const thread of threads || []) {
				const id = threadId(thread);
				if (id && !byId.has(id)) byId.set(id, thread);
			}
			return (ids || []).map((id) => byId.get(id)).filter(Boolean);
		}
		function mergeHeldOrder(previousOrder, incomingIds) {
			const incomingSet = new Set(incomingIds);
			const rank = new Map(incomingIds.map((id, index) => [id, index]));
			const ordered = (previousOrder || []).filter((id) => incomingSet.has(id));
			const orderedSet = new Set(ordered);
			const additions = incomingIds.filter((id) => !orderedSet.has(id));
			for (const id of additions) {
				const idRank = rank.get(id);
				let insertAt = ordered.length;
				for (let index = 0; index < ordered.length; index += 1) if ((rank.get(ordered[index]) ?? Number.MAX_SAFE_INTEGER) > idRank) {
					insertAt = index;
					break;
				}
				ordered.splice(insertAt, 0, id);
				orderedSet.add(id);
			}
			return ordered;
		}
		function planThreadListStableOrder(input = {}) {
			const threads = Array.isArray(input.threads) ? input.threads : [];
			const incomingIds = threads.map(threadId).filter(Boolean);
			const previous = input.previousState && typeof input.previousState === "object" ? input.previousState : {};
			const previousOrder = Array.isArray(previous.order) ? previous.order.map(text).filter(Boolean) : [];
			const scopeKey = text(input.scopeKey) || threadListOrderScopeKey(input);
			const nowMs = Math.max(0, Math.trunc(Number(input.nowMs) || Date.now()));
			const holdMs = boundedHoldMs(input.holdMs);
			const previousHoldUntilMs = Math.max(0, Math.trunc(Number(previous.holdUntilMs) || 0));
			const sameScope = text(previous.scopeKey) === scopeKey;
			const canHold = !input.forceServerOrder && sameScope && previousOrder.length > 0 && previousHoldUntilMs > nowMs;
			const order = canHold ? mergeHeldOrder(previousOrder, incomingIds) : incomingIds;
			const holdUntilMs = canHold ? previousHoldUntilMs : nowMs + holdMs;
			return {
				action: "thread-list-stable-order",
				held: canHold,
				scopeKey,
				holdUntilMs,
				order,
				threads: orderedThreadsById(threads, order),
				state: {
					scopeKey,
					holdUntilMs,
					order
				}
			};
		}
		return {
			DEFAULT_HOLD_MS,
			threadListOrderScopeKey,
			planThreadListStableOrder
		};
	});
}));
//#endregion
//#region public/thread-status-hints.js
var require_thread_status_hints = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadStatusHints = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_RUNNING_HINT_STALE_MS = 1200 * 1e3;
		const DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS = 60 * 1e3;
		const DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS = 1e3;
		function timestampMs(value) {
			if (value === null || value === void 0 || value === "") return 0;
			if (typeof value === "number") {
				if (!Number.isFinite(value) || value <= 0) return 0;
				return value > 0xe8d4a51000 ? Math.trunc(value) : Math.trunc(value * 1e3);
			}
			if (/^\d+(?:\.\d+)?$/.test(String(value))) {
				const numeric = Number(value);
				if (Number.isFinite(numeric) && numeric > 0) return numeric > 0xe8d4a51000 ? Math.trunc(numeric) : Math.trunc(numeric * 1e3);
			}
			const parsed = Date.parse(String(value));
			return Number.isFinite(parsed) ? parsed : 0;
		}
		function statusText(status) {
			if (!status) return "";
			if (typeof status === "string") return status;
			if (status && typeof status === "object" && status.type) return String(status.type);
			try {
				return JSON.stringify(status);
			} catch (_) {
				return String(status);
			}
		}
		function isStaleActiveStatus(status, thread) {
			return Boolean(status && typeof status === "object" && (status.mobileStaleActiveTurn || status.staleActiveTurn || status.reason === "context-only-active-turn") || thread && thread.mobileStaleActiveTurn);
		}
		function isRunningStatus(status) {
			return /active|running|queued|processing|inprogress|in_progress|in-progress|pending|started/.test(statusText(status).toLowerCase());
		}
		function isSettledStatus(status) {
			return /^(idle|notloaded|not_loaded|not-loaded|completed|complete|done|failed|failure|cancelled|canceled|cancel|error|interrupted|stopped|stop)$/.test(statusText(status).toLowerCase());
		}
		function isIdleStatus(status) {
			return /^(idle|notloaded|not_loaded|not-loaded)$/.test(statusText(status).toLowerCase());
		}
		function isTerminalStatus(status) {
			return /^(completed|complete|done|failed|failure|cancelled|canceled|cancel|error|interrupted|stopped|stop)$/.test(statusText(status).toLowerCase());
		}
		function threadUpdatedAtMs(thread) {
			return timestampMs(thread && (thread.updatedAtMs || thread.updatedAt || thread.updated_at_ms || thread.updated_at));
		}
		function terminalTurnAtMs(turn) {
			return timestampMs(turn && turn.completedAtMs) || timestampMs(turn && turn.completedAt) || timestampMs(turn && turn.completed_at_ms) || timestampMs(turn && turn.completed_at) || timestampMs(turn && turn.finishedAt) || timestampMs(turn && turn.finished_at) || timestampMs(turn && turn.updatedAtMs) || timestampMs(turn && turn.updatedAt) || timestampMs(turn && turn.updated_at_ms) || timestampMs(turn && turn.updated_at) || timestampMs(turn && turn.startedAtMs) || timestampMs(turn && turn.startedAt) || timestampMs(turn && turn.started_at_ms) || timestampMs(turn && turn.started_at) || timestampMs(turn && turn.createdAtMs) || timestampMs(turn && turn.createdAt) || timestampMs(turn && turn.created_at_ms) || timestampMs(turn && turn.created_at);
		}
		function notificationDurableEventAtMs(params = {}) {
			return timestampMs(params.eventAtMs) || timestampMs(params.eventAt) || terminalTurnAtMs(params.turn) || timestampMs(params.receivedAtMs) || timestampMs(params.timestampMs) || timestampMs(params.timestamp);
		}
		function notificationEventAtMs(params = {}, fallbackMs = 0, options = {}) {
			const durableAt = notificationDurableEventAtMs(params);
			if (durableAt) return durableAt;
			if (options.allowReplayReceivedAt !== false) {
				const replayAt = timestampMs(params.mobileReplayReceivedAtMs);
				if (replayAt) return replayAt;
			}
			return timestampMs(params.receivedAtMs) || timestampMs(params.timestampMs) || timestampMs(params.timestamp) || timestampMs(fallbackMs);
		}
		function latestTerminalTurn(thread) {
			const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
			const latest = turns.length ? turns[turns.length - 1] : null;
			if (!latest) return null;
			return isTerminalStatus(latest.status) ? latest : null;
		}
		function latestTerminalTurnAtMs(thread) {
			const turn = latestTerminalTurn(thread);
			return turn ? terminalTurnAtMs(turn) : 0;
		}
		function hasFreshSubmittedProcessingHint(submittedProcessingHintedAtMs, nowMs, staleMs = DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS) {
			const hintedAt = timestampMs(submittedProcessingHintedAtMs);
			const now = timestampMs(nowMs) || Date.now();
			return Boolean(hintedAt > 0 && now - hintedAt <= Math.max(0, Number(staleMs) || DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS));
		}
		function statusFreshnessAtMs(thread, eventAtMs) {
			return Math.max(threadUpdatedAtMs(thread) || 0, timestampMs(eventAtMs) || 0);
		}
		function settledStatusFreshEnoughForRunningHint(input = {}) {
			const hintedAt = timestampMs(input.runningHintedAtMs);
			if (!hintedAt) return true;
			const statusAt = statusFreshnessAtMs(input.thread, input.eventAtMs);
			if (!statusAt) return false;
			if (input.mobileReplay) return statusAt >= hintedAt;
			return statusAt + Math.max(0, Number(input.freshnessToleranceMs) || DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS) >= hintedAt;
		}
		function shouldKeepRunningHintForSettledStatus(input = {}) {
			const threadId = String(input.threadId || "");
			if (!threadId || !input.isRunningHinted) return false;
			const status = input.status || input.thread && input.thread.status;
			if (isStaleActiveStatus(status, input.thread)) return false;
			if (!isSettledStatus(status)) return false;
			if (isIdleStatus(status) && !latestTerminalTurn(input.thread) && !input.eventIsTerminal) return true;
			if (input.allowLocalProcessing !== false && isIdleStatus(status) && !latestTerminalTurn(input.thread) && hasFreshSubmittedProcessingHint(input.submittedProcessingHintedAtMs, input.nowMs, input.submittedProcessingHintStaleMs)) return true;
			if (input.currentThreadId && threadId === String(input.currentThreadId) && input.currentThreadSettled) return false;
			if (input.currentThreadHasLiveTurn) return true;
			if (!input.mobileReplay && (isTerminalStatus(status) || latestTerminalTurn(input.thread) || input.eventIsTerminal)) return false;
			return !settledStatusFreshEnoughForRunningHint(input);
		}
		function threadUnreadTerminalAtMs(thread, eventAtMs = 0, options = {}) {
			const eventAt = options.eventIsTerminal ? timestampMs(eventAtMs) : 0;
			return Math.max(latestTerminalTurnAtMs(thread) || 0, eventAt || 0);
		}
		function shouldMarkThreadUnread(input = {}) {
			const threadId = String(input.threadId || "");
			if (!threadId || threadId === String(input.currentThreadId || "")) return false;
			const status = input.status || input.thread && input.thread.status;
			if (isStaleActiveStatus(status, input.thread)) return false;
			if (!isSettledStatus(status)) return false;
			if (isIdleStatus(status) && !latestTerminalTurn(input.thread) && !input.eventIsTerminal) return false;
			const terminalAt = threadUnreadTerminalAtMs(input.thread, input.eventAtMs, { eventIsTerminal: Boolean(input.eventIsTerminal) });
			const viewedAt = timestampMs(input.viewedAtMs);
			if (viewedAt > 0) return terminalAt > viewedAt;
			const updateAt = terminalAt || (input.wasRunning ? statusFreshnessAtMs(input.thread, input.eventAtMs) : 0);
			if (input.mobileReplay && !updateAt) return false;
			const hintedAt = timestampMs(input.runningHintedAtMs);
			if (!input.wasRunning || hintedAt <= 0) return false;
			if (!updateAt) return !input.mobileReplay;
			return updateAt + (input.mobileReplay ? 0 : Math.max(0, Number(input.freshnessToleranceMs) || DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS)) >= hintedAt;
		}
		function runningHintAgeMs(input = {}) {
			const hintedAt = timestampMs(input.runningHintedAtMs);
			const now = timestampMs(input.nowMs) || Date.now();
			if (hintedAt > 0) return now - hintedAt;
			const updatedAt = threadUpdatedAtMs(input.thread);
			if (updatedAt > 0) return now - updatedAt;
			return (Number(input.runningHintStaleMs) || DEFAULT_RUNNING_HINT_STALE_MS) + 1;
		}
		function shouldExpireRunningThreadHint(input = {}) {
			if (!input.threadId || !input.isRunningHinted) return false;
			const status = input.status || input.thread && input.thread.status;
			if (isStaleActiveStatus(status, input.thread)) return true;
			if (isRunningStatus(status)) return false;
			if (isSettledStatus(status) && !shouldKeepRunningHintForSettledStatus(input)) return false;
			if (input.currentThreadHasLiveTurn) return false;
			return runningHintAgeMs(input) > (Number(input.runningHintStaleMs) || DEFAULT_RUNNING_HINT_STALE_MS);
		}
		return {
			DEFAULT_RUNNING_HINT_STALE_MS,
			DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS,
			DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS,
			hasFreshSubmittedProcessingHint,
			isIdleStatus,
			isRunningStatus,
			isSettledStatus,
			isStaleActiveStatus,
			isTerminalStatus,
			latestTerminalTurnAtMs,
			notificationDurableEventAtMs,
			notificationEventAtMs,
			runningHintAgeMs,
			shouldExpireRunningThreadHint,
			shouldKeepRunningHintForSettledStatus,
			shouldMarkThreadUnread,
			statusFreshnessAtMs,
			statusText,
			terminalTurnAtMs,
			threadUpdatedAtMs,
			timestampMs
		};
	});
}));
//#endregion
//#region public/thread-detail-patch-plan.js
var require_thread_detail_patch_plan = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadDetailPatchPlan = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function normalizePatchEntry(entry) {
			if (!entry || typeof entry !== "object") return null;
			const key = String(entry.key || "");
			if (!key) return null;
			return Object.assign({}, entry, { key });
		}
		function normalizeRefreshTurnPatchEntry(entry) {
			if (!entry || typeof entry !== "object") return null;
			const key = String(entry.key || "");
			if (!key) return null;
			return {
				key,
				hasPreviousTurn: Boolean(entry.hasPreviousTurn),
				itemPatchable: Boolean(entry.itemPatchable),
				articlePresent: Boolean(entry.articlePresent)
			};
		}
		function normalizedStringList(value) {
			return Array.isArray(value) ? value.map((entry) => String(entry || "")).filter(Boolean) : [];
		}
		function signatureText(signature) {
			if (signature == null) return "";
			if (typeof signature === "string") return signature;
			try {
				return JSON.stringify(signature);
			} catch (_) {
				return "";
			}
		}
		function planThreadDetailDomPatchSurface(input = {}) {
			const threadId = String(input.threadId || "").trim();
			const threadTileMode = Boolean(input.threadTileMode);
			const threadTileSurface = Boolean(input.threadTileSurface);
			const tilePaneVisible = Boolean(input.tilePaneVisible);
			const conversationPresent = Boolean(input.conversationPresent);
			if (threadTileMode || threadTileSurface) {
				if (!threadTileMode) return {
					canPatch: false,
					surface: "blocked",
					reason: "tile-surface-without-tile-mode",
					threadId
				};
				if (!threadTileSurface) return {
					canPatch: false,
					surface: "blocked",
					reason: "tile-mode-surface-mismatch",
					threadId
				};
				if (!threadId) return {
					canPatch: false,
					surface: "thread-tile-pane",
					reason: "missing-thread-id",
					threadId: ""
				};
				if (!tilePaneVisible) return {
					canPatch: false,
					surface: "thread-tile-pane",
					reason: "tile-pane-not-visible",
					threadId
				};
				return {
					canPatch: true,
					surface: "thread-tile-pane",
					reason: "tile-pane-visible",
					threadId
				};
			}
			if (!conversationPresent) return {
				canPatch: false,
				surface: "single-thread",
				reason: "missing-conversation",
				threadId
			};
			return {
				canPatch: true,
				surface: "single-thread",
				reason: "single-thread-surface",
				threadId
			};
		}
		function planThreadDetailRefreshLocalPatchPreflight(input = {}) {
			const conversationPresent = Boolean(input.conversationPresent);
			const previousThreadPresent = Boolean(input.previousThreadPresent);
			const nextThreadPresent = Boolean(input.nextThreadPresent);
			if (!conversationPresent) return {
				canPatch: false,
				terminal: false,
				reason: "missing-conversation-root"
			};
			if (!previousThreadPresent || !nextThreadPresent) return {
				canPatch: false,
				terminal: false,
				reason: "missing-thread"
			};
			if (String(input.stage || "complete") === "root") return {
				canPatch: true,
				terminal: false,
				reason: "root-ready"
			};
			if (input.tilePanePatched) return {
				canPatch: true,
				terminal: true,
				reason: "tile-pane-patched"
			};
			if (!input.singleThreadSurfaceAvailable) return {
				canPatch: false,
				terminal: false,
				reason: "single-thread-surface-unavailable"
			};
			if (input.previousLoadingOrError || input.nextLoadingOrError) return {
				canPatch: false,
				terminal: false,
				reason: "loading-or-error-state"
			};
			const renderedConversationSignature = signatureText(input.renderedConversationSignature);
			const previousConversationSignature = signatureText(input.previousConversationSignature);
			const renderedPatchShellSignature = signatureText(input.renderedPatchShellSignature);
			const previousPatchShellSignature = signatureText(input.previousPatchShellSignature);
			const nextPatchShellSignature = signatureText(input.nextPatchShellSignature);
			if (renderedConversationSignature !== previousConversationSignature && (!renderedPatchShellSignature || renderedPatchShellSignature !== previousPatchShellSignature)) return {
				canPatch: false,
				terminal: false,
				reason: "rendered-dom-stale"
			};
			if (previousPatchShellSignature !== nextPatchShellSignature) return {
				canPatch: false,
				terminal: false,
				reason: "patch-shell-changed"
			};
			return {
				canPatch: true,
				terminal: false,
				reason: "preflight-passed"
			};
		}
		function visibleItemPatchShapePreservesExisting(previousEntries, nextEntries) {
			if (!Array.isArray(previousEntries) || !Array.isArray(nextEntries)) return false;
			const previous = previousEntries.map(normalizePatchEntry).filter(Boolean);
			const next = nextEntries.map(normalizePatchEntry).filter(Boolean);
			if (previous.length !== previousEntries.length || next.length !== nextEntries.length) return false;
			if (previous.length > next.length) return false;
			let previousIndex = 0;
			for (const nextEntry of next) {
				const previousEntry = previous[previousIndex];
				if (previousEntry && previousEntry.key === nextEntry.key) previousIndex += 1;
			}
			return previousIndex === previous.length;
		}
		function planVisibleItemRefreshPatch(previousEntries, nextEntries) {
			if (!visibleItemPatchShapePreservesExisting(previousEntries, nextEntries)) return {
				canPatch: false,
				reason: "shape-changed",
				operations: []
			};
			const previousByKey = new Map(previousEntries.map(normalizePatchEntry).filter(Boolean).map((entry) => [entry.key, entry]));
			const operations = [];
			for (const rawNextEntry of nextEntries) {
				const nextEntry = normalizePatchEntry(rawNextEntry);
				if (!nextEntry) return {
					canPatch: false,
					reason: "invalid-entry",
					operations: []
				};
				const previousEntry = previousByKey.get(nextEntry.key);
				if (!previousEntry) {
					operations.push({
						type: "insert",
						key: nextEntry.key,
						nextEntry
					});
					continue;
				}
				const previousSignature = signatureText(previousEntry.signature);
				const nextSignature = signatureText(nextEntry.signature);
				operations.push({
					type: previousSignature === nextSignature ? "reuse" : "patch",
					key: nextEntry.key,
					previousEntry,
					nextEntry
				});
			}
			return {
				canPatch: true,
				reason: "shape-preserved",
				operations
			};
		}
		function planThreadDetailRefreshDomPatch(entries, options = {}) {
			if (!Array.isArray(entries)) return {
				canPatch: false,
				reason: "invalid-turn-entries",
				operations: []
			};
			const operations = [];
			const nextKeys = /* @__PURE__ */ new Set();
			for (const rawEntry of entries) {
				const entry = normalizeRefreshTurnPatchEntry(rawEntry);
				if (!entry) return {
					canPatch: false,
					reason: "invalid-turn-entry",
					operations: []
				};
				nextKeys.add(entry.key);
				if (entry.hasPreviousTurn && entry.itemPatchable && entry.articlePresent) {
					operations.push({
						type: "item-patch",
						key: entry.key,
						entry
					});
					continue;
				}
				operations.push({
					type: entry.articlePresent ? "replace-turn" : "insert-turn",
					key: entry.key,
					entry
				});
			}
			const previousTurnKeys = normalizedStringList(options.previousTurnKeys || options.previousKeys);
			for (const previousKey of previousTurnKeys) {
				if (nextKeys.has(previousKey)) continue;
				operations.push({
					type: "remove-turn",
					key: previousKey,
					entry: {
						key: previousKey,
						stale: true
					}
				});
			}
			return {
				canPatch: true,
				reason: "planned",
				operations
			};
		}
		return {
			normalizePatchEntry,
			normalizeRefreshTurnPatchEntry,
			planThreadDetailRefreshDomPatch,
			planThreadDetailRefreshLocalPatchPreflight,
			planVisibleItemRefreshPatch,
			planThreadDetailDomPatchSurface,
			visibleItemPatchShapePreservesExisting
		};
	});
}));
//#endregion
//#region public/thread-detail-actions.js
var require_thread_detail_actions = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadDetailActions = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
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
		function action(type, target, fields = {}) {
			return Object.assign({
				action: String(type || "none"),
				target: target || null,
				preventDefault: false,
				stopPropagation: false
			}, fields);
		}
		function dataValue(node, key) {
			return String(node && node.dataset && node.dataset[key] || "");
		}
		function contextThreadIdFromNode(node, explicitDatasetKey = "") {
			if (!node) return "";
			const explicit = explicitDatasetKey ? dataValue(node, explicitDatasetKey) : "";
			if (explicit) return explicit;
			if (typeof node.closest !== "function") return "";
			return dataValue(node.closest("[data-thread-tile-pane]"), "threadTilePane");
		}
		function previewableImageFromTarget(target, root = null) {
			const image = closestWithin(target, ".input-image img, .image-view img, .markdown-image img, .file-preview-image, .attachment-thumb", root);
			if (!image) return null;
			if (image.closest && image.closest(".github-link-card")) return null;
			return image;
		}
		function resolveRichContentClickAction(input = {}) {
			const target = input.target || null;
			const root = input.root || null;
			let node = closestWithin(target, "[data-copy-key]", root);
			if (node) return action("copy", node, {
				button: node,
				preventDefault: true,
				stopPropagation: true
			});
			node = closestWithin(target, "[data-local-file-path]", root);
			if (node) return action("local-file-preview", node, {
				link: node,
				threadId: contextThreadIdFromNode(node, "localFileThreadId"),
				preventDefault: true,
				stopPropagation: true
			});
			node = closestWithin(target, "[data-mermaid-action]", root);
			if (node) return action("mermaid", node, {
				button: node,
				preventDefault: true,
				stopPropagation: true
			});
			node = closestWithin(target, "[data-github-link-preview-expand]", root);
			if (node) return action("github-preview-toggle", node, {
				button: node,
				preventDefault: true,
				stopPropagation: true
			});
			return action("none", null, { reason: "no-match" });
		}
		function resolveThreadDetailClickAction(input = {}) {
			const target = input.target || null;
			const root = input.root || null;
			const rich = resolveRichContentClickAction({
				target,
				root
			});
			if (rich.action !== "none") return rich;
			let node = closestWithin(target, "[data-approval-action]", root);
			if (node) return action("approval-answer", node, {
				button: node,
				approvalId: dataValue(node, "approvalId"),
				approvalAction: dataValue(node, "approvalAction"),
				threadId: dataValue(node, "approvalThreadId")
			});
			node = closestWithin(target, "[data-task-card-action]", root);
			if (node) {
				const taskCardAction = dataValue(node, "taskCardAction");
				const cardId = dataValue(node, "taskCardId");
				const threadId = dataValue(node, "taskCardThreadId");
				if (taskCardAction === "reply") return action("task-card-reply", node, {
					button: node,
					cardId,
					taskCardAction,
					threadId
				});
				if (taskCardAction === "approve" || taskCardAction === "delete" || taskCardAction === "revoke") return action("task-card-mutate", node, {
					button: node,
					cardId,
					taskCardAction,
					threadId
				});
				return action("task-card-unknown", node, {
					button: node,
					cardId,
					taskCardAction,
					threadId
				});
			}
			node = closestWithin(target, "[data-task-card-draft-action]", root);
			if (node) return action("task-card-draft", node, {
				button: node,
				draftAction: dataValue(node, "taskCardDraftAction"),
				draftKey: dataValue(node, "taskCardDraftKey"),
				threadId: dataValue(node, "taskCardDraftThreadId")
			});
			node = closestWithin(target, "[data-server-response-text]", root);
			if (node) return action("server-response", node, {
				option: node,
				requestId: dataValue(node, "serverRequestId"),
				threadId: dataValue(node, "serverRequestThreadId"),
				responseText: dataValue(node, "serverResponseText"),
				questionId: dataValue(node, "serverQuestionId") || "answer"
			});
			node = closestWithin(target, "[data-server-request-decline]", root);
			if (node) return action("server-request-decline", node, {
				button: node,
				requestId: dataValue(node, "serverRequestId"),
				threadId: dataValue(node, "serverRequestThreadId")
			});
			return action("none", null, { reason: "no-match" });
		}
		return {
			closestWithin,
			previewableImageFromTarget,
			resolveRichContentClickAction,
			resolveThreadDetailClickAction,
			contextThreadIdFromNode
		};
	});
}));
//#endregion
//#region public/thread-detail-merge-state.js
var require_thread_detail_merge_state = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadDetailMergeState = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function defaultNormalizeThread(thread) {
			return thread;
		}
		function defaultSortTurns(turns) {
			return Array.isArray(turns) ? turns.slice() : [];
		}
		function createThreadDetailMergePolicy(options = {}) {
			const isV4ProjectionThread = typeof options.isV4ProjectionThread === "function" ? options.isV4ProjectionThread : () => false;
			const mergeV4ProjectionThread = typeof options.mergeV4ProjectionThread === "function" ? options.mergeV4ProjectionThread : (existingThread, incomingThread) => incomingThread || existingThread || null;
			const normalizeThreadVisibleUserMessages = typeof options.normalizeThreadVisibleUserMessages === "function" ? options.normalizeThreadVisibleUserMessages : defaultNormalizeThread;
			const turnVisibleWeight = typeof options.turnVisibleWeight === "function" ? options.turnVisibleWeight : () => 0;
			const shouldPreserveExistingTurnVisibleItems = typeof options.shouldPreserveExistingTurnVisibleItems === "function" ? options.shouldPreserveExistingTurnVisibleItems : () => false;
			const mergeItemsPreservingLocalVisible = typeof options.mergeItemsPreservingLocalVisible === "function" ? options.mergeItemsPreservingLocalVisible : (existingItems, incomingItems) => Array.isArray(incomingItems) ? incomingItems : existingItems;
			const shouldDropInitialSubmissionEchoTurn = typeof options.shouldDropInitialSubmissionEchoTurn === "function" ? options.shouldDropInitialSubmissionEchoTurn : () => false;
			const turnIsSupersededBy = typeof options.turnIsSupersededBy === "function" ? options.turnIsSupersededBy : () => false;
			const isTurnComplete = typeof options.isTurnComplete === "function" ? options.isTurnComplete : () => false;
			const shouldPreserveMissingExistingTurn = typeof options.shouldPreserveMissingExistingTurn === "function" ? options.shouldPreserveMissingExistingTurn : () => false;
			const sortTurnsForDisplay = typeof options.sortTurnsForDisplay === "function" ? options.sortTurnsForDisplay : defaultSortTurns;
			const threadHasInitialSubmissionEcho = typeof options.threadHasInitialSubmissionEcho === "function" ? options.threadHasInitialSubmissionEcho : () => false;
			const maxExpandedVisibleTurns = Math.max(1, Number(options.maxExpandedVisibleTurns || 200) || 200);
			function normalizeMergedThread(thread, limit = 0) {
				const normalized = normalizeThreadVisibleUserMessages(thread);
				if (normalized && Array.isArray(normalized.turns)) {
					const sorted = sortTurnsForDisplay(normalized.turns);
					normalized.turns = limit > 0 ? sorted.slice(-limit) : sorted;
				}
				return normalized;
			}
			function shouldPreserveLiveTurnLocalVisibleItems(existingTurn, incomingTurn, existingWeight = null) {
				return shouldPreserveExistingTurnVisibleItems(existingTurn, incomingTurn, existingWeight);
			}
			function mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) {
				if (!existingTurn) return incomingTurn;
				if (!incomingTurn) return existingTurn;
				const existingItems = Array.isArray(existingTurn.items) ? existingTurn.items : [];
				const incomingHasItems = Array.isArray(incomingTurn.items);
				const merged = Object.assign({}, existingTurn, incomingTurn);
				if (!incomingHasItems) {
					merged.items = existingItems;
					return merged;
				}
				const incomingWeight = turnVisibleWeight(Object.assign({}, incomingTurn, { items: incomingTurn.items || [] }));
				const existingWeight = turnVisibleWeight(existingTurn);
				const preserveLocalVisible = incomingWeight < existingWeight || shouldPreserveLiveTurnLocalVisibleItems(existingTurn, incomingTurn, existingWeight);
				merged.items = mergeItemsPreservingLocalVisible(existingItems, incomingTurn.items || [], preserveLocalVisible, incomingTurn);
				return merged;
			}
			function mergeThreadPreservingVisibleItems(existingThread, incomingThread, runtime = {}) {
				if (isV4ProjectionThread(incomingThread)) return mergeV4ProjectionThread(existingThread, incomingThread);
				if (!existingThread || !incomingThread || existingThread.id !== incomingThread.id) return normalizeMergedThread(incomingThread);
				const existingTurns = Array.isArray(existingThread.turns) ? existingThread.turns : [];
				const incomingTurns = Array.isArray(incomingThread.turns) ? incomingThread.turns : null;
				const existingById = new Map(existingTurns.map((turn) => [turn && turn.id, turn]).filter(([id]) => id));
				const initialSubmissionId = String(existingThread.mobileInitialSubmissionId || "");
				const merged = Object.assign({}, existingThread, incomingThread);
				if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoading")) delete merged.mobileLoading;
				if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoadError")) delete merged.mobileLoadError;
				if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileReadWarning")) delete merged.mobileReadWarning;
				if (!incomingTurns) return normalizeMergedThread(merged);
				const existingVisibleWeight = existingTurns.reduce((total, turn) => total + turnVisibleWeight(turn), 0);
				const incomingVisibleWeight = incomingTurns.reduce((total, turn) => total + turnVisibleWeight(turn), 0);
				const incomingHasAuthoritativeVisibleWindow = incomingTurns.length > 0 && incomingVisibleWeight > 0;
				if (!incomingTurns.length && existingTurns.length && existingVisibleWeight > 0 && incomingVisibleWeight === 0) {
					merged.turns = existingTurns;
					return normalizeMergedThread(merged);
				}
				merged.turns = incomingTurns.map((incomingTurn) => {
					const existingTurn = existingById.get(incomingTurn && incomingTurn.id);
					return existingTurn ? mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) : incomingTurn;
				});
				merged.turns = sortTurnsForDisplay(merged.turns);
				const incomingIds = new Set(merged.turns.map((turn) => turn && turn.id).filter(Boolean));
				const latestIncoming = merged.turns.length ? merged.turns[merged.turns.length - 1] : null;
				const preserveExpandedHistory = Boolean(existingThread.mobileHistoryExpanded) && (/turns-list/i.test(String(incomingThread.mobileReadMode || "")) || Boolean(incomingThread.mobileOlderTurnsCursor) || Number(incomingThread.mobileOmittedTurnCount || 0) > 0);
				let preservedExpandedTurnCount = 0;
				const activeTurnId = String(runtime.activeTurnId || "");
				for (const existingTurn of existingTurns) {
					if (!existingTurn || incomingIds.has(existingTurn.id)) continue;
					if (shouldDropInitialSubmissionEchoTurn(existingTurn, merged.turns, initialSubmissionId)) continue;
					if (preserveExpandedHistory) {
						merged.turns.push(existingTurn);
						preservedExpandedTurnCount += 1;
						continue;
					}
					if (incomingHasAuthoritativeVisibleWindow && !shouldPreserveMissingExistingTurn(existingTurn, merged, runtime)) continue;
					if (turnIsSupersededBy(existingTurn, latestIncoming)) continue;
					if (String(existingTurn.id || "") === activeTurnId || !isTurnComplete(existingTurn) && turnVisibleWeight(existingTurn) > 0) merged.turns.push(existingTurn);
				}
				if (preserveExpandedHistory) {
					merged.mobileHistoryExpanded = true;
					if (preservedExpandedTurnCount > 0) merged.mobileOmittedTurnCount = Math.max(0, Number(merged.mobileOmittedTurnCount || 0) - preservedExpandedTurnCount);
				}
				const normalized = normalizeMergedThread(merged, preserveExpandedHistory ? maxExpandedVisibleTurns : 0);
				if (!threadHasInitialSubmissionEcho(normalized, initialSubmissionId)) delete normalized.mobileInitialSubmissionId;
				return normalized;
			}
			return {
				mergeThreadPreservingVisibleItems,
				mergeTurnPreservingVisibleItems,
				shouldPreserveLiveTurnLocalVisibleItems
			};
		}
		return { createThreadDetailMergePolicy };
	});
}));
//#endregion
//#region \0virtual:codex-mobile-esm-compatibility/shard/shard-05
var import_media_preview_runtime = /* @__PURE__ */ __toESM(require_media_preview_runtime());
var import_composer_bridge_runtime = /* @__PURE__ */ __toESM(require_composer_bridge_runtime());
var import_api_client_runtime = /* @__PURE__ */ __toESM(require_api_client_runtime());
var import_thread_list_load_policy = /* @__PURE__ */ __toESM(require_thread_list_load_policy());
var import_thread_list_stable_order = /* @__PURE__ */ __toESM(require_thread_list_stable_order());
var import_thread_status_hints = /* @__PURE__ */ __toESM(require_thread_status_hints());
var import_thread_detail_patch_plan = /* @__PURE__ */ __toESM(require_thread_detail_patch_plan());
var import_thread_detail_actions = /* @__PURE__ */ __toESM(require_thread_detail_actions());
var import_thread_detail_merge_state = /* @__PURE__ */ __toESM(require_thread_detail_merge_state());
var moduleDefinitions = [
	{
		"id": "media-preview-runtime",
		"source": "public/media-preview-runtime.js",
		"globalName": "CodexMediaPreviewRuntime",
		"expectedFunctions": ["createMediaPreviewRuntime"],
		"assetPath": "/media-preview-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 95096
	},
	{
		"id": "composer-bridge-runtime",
		"source": "public/composer-bridge-runtime.js",
		"globalName": "CodexComposerBridgeRuntime",
		"expectedFunctions": ["createComposerBridgeRuntime"],
		"assetPath": "/composer-bridge-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 32086
	},
	{
		"id": "api-client-runtime",
		"source": "public/api-client-runtime.js",
		"globalName": "CodexApiClientRuntime",
		"expectedFunctions": ["createApiClientRuntime"],
		"assetPath": "/api-client-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 49014
	},
	{
		"id": "thread-list-load-policy",
		"source": "public/thread-list-load-policy.js",
		"globalName": "CodexThreadListLoadPolicy",
		"expectedFunctions": ["planThreadListLoadRequest"],
		"assetPath": "/thread-list-load-policy.js",
		"classicLoaderExcluded": true,
		"bytes": 2160
	},
	{
		"id": "thread-list-stable-order",
		"source": "public/thread-list-stable-order.js",
		"globalName": "CodexThreadListStableOrder",
		"expectedFunctions": ["threadListOrderScopeKey", "planThreadListStableOrder"],
		"assetPath": "/thread-list-stable-order.js",
		"classicLoaderExcluded": true,
		"bytes": 3327
	},
	{
		"id": "thread-status-hints",
		"source": "public/thread-status-hints.js",
		"globalName": "CodexThreadStatusHints",
		"expectedFunctions": [
			"isRunningStatus",
			"shouldExpireRunningThreadHint",
			"shouldMarkThreadUnread"
		],
		"assetPath": "/thread-status-hints.js",
		"classicLoaderExcluded": true,
		"bytes": 9883
	},
	{
		"id": "thread-detail-patch-plan",
		"source": "public/thread-detail-patch-plan.js",
		"globalName": "CodexThreadDetailPatchPlan",
		"expectedFunctions": [
			"planThreadDetailDomPatchSurface",
			"planThreadDetailRefreshDomPatch",
			"planVisibleItemRefreshPatch"
		],
		"assetPath": "/thread-detail-patch-plan.js",
		"classicLoaderExcluded": true,
		"bytes": 8310
	},
	{
		"id": "thread-detail-actions",
		"source": "public/thread-detail-actions.js",
		"globalName": "CodexThreadDetailActions",
		"expectedFunctions": [
			"closestWithin",
			"contextThreadIdFromNode",
			"previewableImageFromTarget",
			"resolveRichContentClickAction",
			"resolveThreadDetailClickAction"
		],
		"assetPath": "/thread-detail-actions.js",
		"classicLoaderExcluded": true,
		"bytes": 5362
	},
	{
		"id": "thread-detail-merge-state",
		"source": "public/thread-detail-merge-state.js",
		"globalName": "CodexThreadDetailMergeState",
		"expectedFunctions": ["createThreadDetailMergePolicy"],
		"assetPath": "/thread-detail-merge-state.js",
		"classicLoaderExcluded": true,
		"bytes": 8461
	}
];
var moduleApis = {
	"media-preview-runtime": import_media_preview_runtime.default,
	"composer-bridge-runtime": import_composer_bridge_runtime.default,
	"api-client-runtime": import_api_client_runtime.default,
	"thread-list-load-policy": import_thread_list_load_policy.default,
	"thread-list-stable-order": import_thread_list_stable_order.default,
	"thread-status-hints": import_thread_status_hints.default,
	"thread-detail-patch-plan": import_thread_detail_patch_plan.default,
	"thread-detail-actions": import_thread_detail_actions.default,
	"thread-detail-merge-state": import_thread_detail_merge_state.default
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
