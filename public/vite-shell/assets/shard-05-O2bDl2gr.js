import { n as __toESM, t as __commonJSMin } from "./rolldown-runtime-FDOR9p9I.js";
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
//#region public/composer-runtime.js
var require_composer_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function attachComposerRuntime(root) {
		function createComposerRuntime(deps = {}) {
			const { $, COMPOSER_INTENT_BODY_MAX_CHARS, MESSAGE_INPUT_MAX_HEIGHT_PX, MESSAGE_INPUT_MIN_HEIGHT_PX, STORAGE_CODEX_FAST_MODE, STORAGE_COMPOSER_INTENT_DRAFTS, THREAD_GOAL_MENTION_PATTERN, THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN, THREAD_TASK_CARD_MENTION_PATTERN, api, clearDraftForKey, clearSubmittedMessageBottomFollow, closeThreadGoalDialog, commitPluginVoiceInputSessionsAfterSend, composerTargetThread = () => null, connectEvents, composerTargetActiveTurnId, createSubmissionId, currentComposerThreadId, currentDraftKey, defaultNewThreadEffort, defaultNewThreadModel, defaultNewThreadPermissionMode, deleteDraftAttachments, diagnosticErrorCode, diagnosticErrorStatus, diagnosticTaskHash, diagnosticThreadHash, document, draftKeyForThread, effectiveComposerPermissionMode, escapeHtml, followSubmittedMessageToBottom, homeAiDiagnosticReportingApi, imageCompressor, insertLocalSubmittedUserMessage, isAndroidBrowser, isChatGptProCommandText, isHermesEmbedMode, isKeyboardEditableElement, isThreadGoalCommandText, isThreadTaskCardCommandText, isThreadTileComposerContext, labelForEffort, labelForModel, labelForPermissionMode, loadJsonStorage, loadThread, loadThreads, localAttachmentPreviewUrl, localStorage, markActivity, markSubmittedUserMessageFailed, markThreadOptimisticallyActive, mergeItemsPreservingLocalVisible, newThreadSelectedEffort, newThreadSelectedModel, newThreadSelectedPermissionMode, normalizeOptionList, normalizeThreadGoal, openThreadGoalDialog, postClientEvent, publishPluginVoiceInputCapability, reconcileSubmittedUserMessageTurn, recordHomeAiDiagnosticFailure, renderCurrentThread, renderQuotaUsage, renderThreads, replacePendingAttachments, restoreThreadStatusSnapshot, saveCurrentDraftNow, saveDraftAttachmentFiles, scheduleComposerTargetRefresh, scheduleCurrentDraftSave, scheduleCurrentThreadRefresh, scheduleLivePollIfNeeded, scheduleScrollToBottomButtonUpdate, scheduleSubmittedMessageDomProbe, selectedQuotaModel, setComposerActionButtonLabel, setSteerFeedback, setThreadGoalDialogBusy, showComposerFastHint, showError, snapshotThreadStatus, startedTurnId, state, submitChatGptProRequest, submittedThreadGoal, threadDisplayName, threadTaskCardCommandText, threadTileStatePolicy, updateThreadGoalState, viewportMetrics, viewportState, window, writeCurrentDraftToKey } = deps;
			function updateComposerHeightVar(options = {}) {
				const composer = $("composer");
				if (!composer) return false;
				const nextPx = viewportMetrics.cssPixel(composer.getBoundingClientRect().height);
				if (!nextPx) return false;
				const previousPx = viewportMetrics.cssPixel(state.composerHeightPx);
				if (!options.force && !viewportMetrics.stablePixelChanged(previousPx, nextPx)) return false;
				state.composerHeightPx = nextPx;
				document.documentElement.style.setProperty("--composer-height", `${nextPx}px`);
				scheduleScrollToBottomButtonUpdate();
				return true;
			}
			function clearSendProgressWatchdog() {
				if (state.sendProgressWatchdog) {
					clearTimeout(state.sendProgressWatchdog);
					state.sendProgressWatchdog = null;
				}
			}
			function startSendProgressWatchdog(threadId) {
				clearSendProgressWatchdog();
				state.sendProgressStartAt = Date.now();
				state.sendProgressWarned = false;
				const targetThreadId = String(threadId || "");
				state.sendProgressWatchdog = setTimeout(() => {
					if (!state.composerBusy || currentComposerThreadId() !== targetThreadId) return;
					state.sendProgressWarned = true;
					const steering = state.steerFeedback && state.steerFeedback.status === "sending";
					$("connectionState").textContent = steering ? "引导较慢，稍等一下，避免重复提交" : "发送较慢，检查网络后稍等，避免重复提交";
					$("connectionState").classList.add("error");
					postClientEvent("message_send_stall", {
						threadId: targetThreadId,
						elapsedMs: Date.now() - state.sendProgressStartAt,
						composerBusy: state.composerBusy,
						hasContent: composerHasContent()
					});
				}, 9500);
			}
			function finishSendProgressWatchdog() {
				clearSendProgressWatchdog();
				state.sendProgressStartAt = 0;
				state.sendProgressWarned = false;
			}
			function normalizeClientErrorMessage(message, err = null) {
				if (String(err && err.code || "").trim() === "codex_account_auth_invalid") return "Codex 账号登录已失效，请重新登录该账号，或切换到可用账号后重试。";
				const text = String(message || "").toLowerCase();
				if (/token_expired|refresh_token_reused|refresh token|access token/.test(text)) return "Codex 账号登录已失效，请重新登录该账号，或切换到可用账号后重试。";
				if (text.includes("failed to fetch")) return "网络异常，发送失败：请求未发出，请检查网络后重试";
				if (/(rate\s*limit|usage\s*limit|quota|limit reached|exhausted|insufficient credits?)/i.test(String(message || ""))) {
					const model = selectedQuotaModel();
					return model ? `${labelForModel(model)} 额度不足，请切换模型后重试` : "模型额度不足，请切换模型后重试";
				}
				if (text.includes("request timed out")) return "请求超时，服务响应较慢，请稍后再试";
				if (text.includes("request cancelled")) return "请求被取消，稍后可重试";
				if (/\bunauthorized\b/.test(text)) return "登录已失效，请重新登录";
				if (/\brpc timeout\b/.test(text)) return "请求服务端超时，请稍后重试";
				return rawMessageFallback(message);
			}
			function rawMessageFallback(message) {
				return String(message || "").trim() || "操作失败，请重试";
			}
			function composerText() {
				const el = $("messageInput");
				return (el ? el.innerText : "").replace(/\u00a0/g, " ").replace(/\n+$/g, "").trim();
			}
			function setComposerText(value) {
				const el = $("messageInput");
				if (!el) return;
				el.textContent = String(value || "");
				if (!value) el.innerHTML = "";
				autoSizeMessageInput(el, { force: true });
			}
			function placeMessageInputCaretAtEnd(input) {
				if (!input || !window.getSelection || !document.createRange) return false;
				try {
					const range = document.createRange();
					range.selectNodeContents(input);
					range.collapse(false);
					const selection = window.getSelection();
					if (!selection) return false;
					selection.removeAllRanges();
					selection.addRange(range);
					return true;
				} catch (_) {
					return false;
				}
			}
			function focusMessageInput(options = {}) {
				const input = $("messageInput");
				if (!input) return false;
				if (options.ensureEnabled !== false && (input.contentEditable === "false" || input.getAttribute("aria-disabled") === "true")) setMessageInputDisabled(false);
				if (input.contentEditable === "false" || input.getAttribute("aria-disabled") === "true") return false;
				if (options.resetActiveFocus && document.activeElement === input && (!isAndroidBrowser() || options.allowAndroidActiveFocusReset)) try {
					input.blur();
				} catch (_) {}
				try {
					input.focus({ preventScroll: true });
				} catch (_) {
					try {
						input.focus();
					} catch (err) {
						return false;
					}
				}
				if (options.moveCaretToEnd) placeMessageInputCaretAtEnd(input);
				if (options.retry && document.activeElement !== input) window.setTimeout(() => focusMessageInput(Object.assign({}, options, { retry: false })), 30);
				return true;
			}
			function messageInputKeyboardVisible() {
				if (!isKeyboardEditableElement(document.activeElement)) return false;
				const viewport = viewportState();
				return Boolean(viewport && (viewport.keyboardShrunk || viewport.hostKeyboardVisible));
			}
			function shouldRecoverMessageInputKeyboard() {
				const input = $("messageInput");
				if (!input || document.activeElement !== input) return false;
				if (!isAndroidBrowser() && !isHermesEmbedMode()) return false;
				if (state.composerBusy || state.composerComposing) return false;
				if (messageInputKeyboardVisible()) return false;
				return Date.now() - Number(state.messageInputKeyboardRecoveryAt || 0) > 450;
			}
			function recoverMessageInputKeyboardFromGesture() {
				const wasFocused = Boolean(state.messageInputPointerWasFocused);
				state.messageInputPointerWasFocused = false;
				if (!wasFocused) return false;
				if (!shouldRecoverMessageInputKeyboard()) return false;
				state.messageInputKeyboardRecoveryAt = Date.now();
				return focusMessageInput(isAndroidBrowser() ? {
					moveCaretToEnd: false,
					retry: true
				} : {
					moveCaretToEnd: false,
					resetActiveFocus: true,
					allowAndroidActiveFocusReset: true,
					retry: true
				});
			}
			function messageInputCanEnableForNativeGesture() {
				if (state.composerBusy || state.attachmentProcessingCount > 0) return false;
				if (state.newThreadDraft) return true;
				return Boolean(state.currentThreadId && state.currentThread && !state.currentThread.mobileLoading && !state.currentThread.mobileLoadError);
			}
			function releaseStaleAndroidMessageInputFocusBeforeNativeTap(input) {
				if (!input || !isAndroidBrowser()) return false;
				if (!state.messageInputPointerWasFocused) return false;
				if (document.activeElement === input) return false;
				if (!messageInputCanEnableForNativeGesture()) return false;
				if (state.composerComposing || messageInputKeyboardVisible()) return false;
				const now = Date.now();
				if (now - Number(state.messageInputKeyboardRecoveryAt || 0) <= 450) return false;
				state.messageInputKeyboardRecoveryAt = now;
				try {
					input.blur();
					return true;
				} catch (_) {
					return false;
				}
			}
			function prepareMessageInputForNativeGesture() {
				const input = $("messageInput");
				state.messageInputPointerWasFocused = document.activeElement === input;
				if (!input || !isAndroidBrowser()) return;
				if (!messageInputCanEnableForNativeGesture()) return;
				if (input.contentEditable === "false" || input.getAttribute("aria-disabled") === "true") setMessageInputDisabled(false);
				releaseStaleAndroidMessageInputFocusBeforeNativeTap(input);
			}
			function normalizedComposerIntentText(value) {
				return String(value || "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\u00a0/g, " ").trim();
			}
			function composerIntentOptions() {
				return [
					{
						kind: "goal",
						tag: "@目标任务",
						label: "目标任务",
						detail: "设置当前线程目标、预算和状态",
						title: "目标任务",
						subtitle: "打开目标设置框，内容不会作为普通消息发送。",
						placeholder: "",
						submitLabel: "打开目标"
					},
					{
						kind: "task-card",
						tag: "@任务卡片",
						label: "任务卡片",
						detail: "发给其他线程，目标侧审批后执行",
						title: "任务卡片",
						subtitle: "输入要交给其他线程处理的完整需求；提交后会先生成待审批任务卡片。",
						placeholder: "写清目标线程、任务背景、期望输出和约束。",
						submitLabel: "创建任务卡片"
					},
					{
						kind: "task-card-auto",
						tag: "@自由协作",
						label: "自由协作",
						detail: "任务卡片自动回传后续结果",
						title: "自由协作",
						subtitle: "输入跨线程协作需求；目标线程首次审批后，后续同源回传可自动继续。",
						placeholder: "写清协作对象、需要对方完成的步骤，以及完成后回传什么。",
						submitLabel: "创建协作卡片"
					},
					{
						kind: "chatgpt-pro",
						tag: "@ChatGPT Pro",
						label: "ChatGPT Pro",
						detail: "用专用 Pro 线程生成分析文档",
						title: "ChatGPT Pro 分析",
						subtitle: "输入要交给 ChatGPT Pro 分析的问题；内容不会进入当前工作线程。",
						placeholder: "写清要分析的代码、方案、风险或决策问题。",
						submitLabel: "提交 Pro 分析"
					}
				];
			}
			function composerIntentOption(kind) {
				return composerIntentOptions().find((item) => item.kind === kind) || null;
			}
			function composerIntentDraftKey(kind) {
				return `${currentDraftKey() || (state.currentThreadId ? `thread:${state.currentThreadId}` : "new-thread")}::${String(kind || "").trim()}`;
			}
			function loadComposerIntentDraft(kind) {
				const drafts = loadJsonStorage(STORAGE_COMPOSER_INTENT_DRAFTS, {});
				const key = composerIntentDraftKey(kind);
				return String(drafts && drafts[key] || "");
			}
			function saveComposerIntentDraft(kind, value) {
				const key = composerIntentDraftKey(kind);
				if (!key) return;
				const drafts = loadJsonStorage(STORAGE_COMPOSER_INTENT_DRAFTS, {});
				const text = String(value || "").slice(0, COMPOSER_INTENT_BODY_MAX_CHARS);
				if (text.trim()) drafts[key] = text;
				else delete drafts[key];
				try {
					localStorage.setItem(STORAGE_COMPOSER_INTENT_DRAFTS, JSON.stringify(drafts));
				} catch (err) {
					recordHomeAiDiagnosticFailure({
						category: "task_card_workflow_failed",
						diagnostic_type: action === "reply" ? "task_card_return_failed" : "task_card_action_failed",
						severity_hint: "H2",
						evidence_confidence: .78,
						error_code: diagnosticErrorCode(err, action === "reply" ? "task_card_return_failed" : "task_card_action_failed"),
						context: {
							surface: "task-card",
							action: homeAiDiagnosticReportingApi.boundedToken(action, "mutate", 40),
							thread_hash: diagnosticThreadHash(state.currentThreadId),
							task_hash: diagnosticTaskHash(id)
						},
						counts: { status_code: diagnosticErrorStatus(err) },
						breadcrumbs: [{
							kind: "task-card",
							code: homeAiDiagnosticReportingApi.boundedToken(action, "mutate", 40),
							status: "failed",
							fields: {
								status_code: diagnosticErrorStatus(err),
								task_hash: diagnosticTaskHash(id)
							}
						}]
					});
					showError(err);
				}
			}
			function composerIntentBareTagKind(value) {
				const text = normalizedComposerIntentText(value);
				if (!text || text === "@") return "";
				if (THREAD_GOAL_MENTION_PATTERN.test(text)) return "goal";
				if (/^@(?:ChatGPT\s+Pro|ChatGPTPro|GPT\s+Pro)$/i.test(text)) return "chatgpt-pro";
				if (THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN.test(text) && !threadTaskCardCommandText(text)) return "task-card-auto";
				if (THREAD_TASK_CARD_MENTION_PATTERN.test(text) && !threadTaskCardCommandText(text)) return "task-card";
				return "";
			}
			function shouldShowComposerIntentMenu() {
				return normalizedComposerIntentText(composerText()) === "@";
			}
			function closeComposerIntentMenu() {
				const menu = $("composerIntentMenu");
				if (menu) {
					menu.hidden = true;
					menu.innerHTML = "";
				}
				state.composerIntentMenuOpen = false;
				document.removeEventListener("pointerdown", onComposerIntentOutsidePointer);
			}
			function onComposerIntentOutsidePointer(event) {
				const menu = $("composerIntentMenu");
				const target = event.target;
				if (!state.composerIntentMenuOpen || !menu || menu.hidden) return;
				if (menu.contains(target)) return;
				if (target && target.closest && target.closest("#messageInput")) return;
				closeComposerIntentMenu();
			}
			function openComposerIntentMenu() {
				const menu = $("composerIntentMenu");
				if (!menu) return;
				closeComposerRuntimeMenu();
				closeQuotaDetails();
				menu.innerHTML = composerIntentOptions().map((item) => `
    <button type="button" class="composer-intent-option" role="option" data-composer-intent="${escapeHtml(item.kind)}">
      <span class="composer-intent-label">${escapeHtml(item.label)}</span>
      <span class="composer-intent-tag">${escapeHtml(item.tag)}</span>
      <span class="composer-intent-detail">${escapeHtml(item.detail)}</span>
    </button>
  `).join("");
				menu.hidden = false;
				state.composerIntentMenuOpen = true;
				positionComposerIntentMenu();
				document.addEventListener("pointerdown", onComposerIntentOutsidePointer);
			}
			function positionComposerIntentMenu() {
				const menu = $("composerIntentMenu");
				const anchor = $("messageInput") || $("composer");
				if (!menu || menu.hidden || !anchor) return;
				fitComposerPopupToAnchor(menu, anchor, {
					minWidth: 280,
					maxWidth: 420
				});
			}
			function updateComposerIntentMenu() {
				if (shouldShowComposerIntentMenu()) if (!state.composerIntentMenuOpen) openComposerIntentMenu();
				else positionComposerIntentMenu();
				else closeComposerIntentMenu();
			}
			function queueComposerIntentMenuUpdate() {
				window.setTimeout(updateComposerIntentMenu, 0);
			}
			function selectComposerIntent(kind) {
				const option = composerIntentOption(kind);
				if (!option) return;
				setComposerText(option.tag);
				closeComposerIntentMenu();
				updateComposerControls();
				scheduleCurrentDraftSave();
				const input = $("messageInput");
				if (input) input.focus();
			}
			function setComposerIntentDialogStatus(message, isError = false) {
				const status = $("composerIntentDialogStatus");
				if (!status) return;
				const text = String(message || "").trim();
				status.textContent = text;
				status.classList.toggle("hidden", !text);
				status.classList.toggle("error", Boolean(isError));
			}
			function closeComposerIntentDialog(clearState = true) {
				const dialog = $("composerIntentDialog");
				if (dialog) dialog.classList.add("hidden");
				if (clearState) {
					state.composerIntentDialogKind = "";
					state.composerIntentDialogBusy = false;
				}
				setComposerIntentDialogStatus("");
				updateComposerControls();
			}
			function openComposerIntentDialog(kind, options = {}) {
				const option = composerIntentOption(kind);
				if (!option) return false;
				if (kind !== "chatgpt-pro" && state.newThreadDraft) {
					showError(/* @__PURE__ */ new Error(`${option.label} is only available in an existing thread`));
					return false;
				}
				if (state.pendingAttachments.length) {
					showError(/* @__PURE__ */ new Error(`${option.tag} does not support attachments in this entry point`));
					return false;
				}
				state.composerIntentDialogKind = kind;
				state.composerIntentDialogBusy = false;
				const title = $("composerIntentDialogTitle");
				const subtitle = $("composerIntentDialogSubtitle");
				const label = $("composerIntentBodyLabel");
				const input = $("composerIntentBodyInput");
				const submit = $("composerIntentSubmitButton");
				if (title) title.textContent = option.title;
				if (subtitle) subtitle.textContent = option.subtitle;
				if (label) label.textContent = option.label;
				if (submit) submit.textContent = option.submitLabel;
				if (input) {
					input.placeholder = option.placeholder;
					input.maxLength = COMPOSER_INTENT_BODY_MAX_CHARS;
					input.value = String(options.initialBody || loadComposerIntentDraft(kind) || "").slice(0, COMPOSER_INTENT_BODY_MAX_CHARS);
				}
				setComposerIntentDialogStatus("");
				const dialog = $("composerIntentDialog");
				if (dialog) dialog.classList.remove("hidden");
				window.setTimeout(() => {
					if (input) input.focus();
				}, 30);
				return true;
			}
			async function submitComposerIntentDialog(event) {
				if (event && typeof event.preventDefault === "function") event.preventDefault();
				if (state.composerIntentDialogBusy || state.composerBusy) return;
				const kind = state.composerIntentDialogKind;
				const option = composerIntentOption(kind);
				if (!option) return;
				const input = $("composerIntentBodyInput");
				const body = String(input && input.value || "").trim();
				if (!body) {
					setComposerIntentDialogStatus("请输入内容。", true);
					return;
				}
				state.composerIntentDialogBusy = true;
				setComposerIntentDialogStatus("提交中…");
				updateComposerControls();
				try {
					if (kind === "chatgpt-pro") await submitChatGptProRequest(`${option.tag} ${body}`, { rethrow: true });
					else if (kind === "task-card" || kind === "task-card-auto") await sendThreadTaskCardCommand(`${option.tag} ${body}`, { rethrow: true });
					saveComposerIntentDraft(kind, "");
					setComposerText("");
					scheduleCurrentDraftSave();
					closeComposerIntentDialog();
				} catch (err) {
					setComposerIntentDialogStatus(normalizeClientErrorMessage(err && err.message ? err.message : String(err), err), true);
					showError(err);
				} finally {
					state.composerIntentDialogBusy = false;
					updateComposerControls();
				}
			}
			function saveComposerIntentDialogDraft() {
				const kind = state.composerIntentDialogKind;
				if (!composerIntentOption(kind)) return;
				const input = $("composerIntentBodyInput");
				saveComposerIntentDraft(kind, input ? input.value : "");
				setComposerIntentDialogStatus("草稿已保存。");
			}
			function shouldKeepAndroidMessageInputEditable(disabled, el) {
				if (!disabled || !isAndroidBrowser()) return false;
				if (!el) return false;
				if (!messageInputCanEnableForNativeGesture()) return false;
				return Boolean(state.composerComposing || document.activeElement === el);
			}
			function setMessageInputDisabled(disabled) {
				const el = $("messageInput");
				if (!el) return;
				const keepAndroidEditorConnection = shouldKeepAndroidMessageInputEditable(disabled, el);
				const nextContentEditable = disabled && !keepAndroidEditorConnection ? "false" : "true";
				const nextAriaDisabled = disabled ? "true" : "false";
				const nextTabIndex = disabled ? -1 : 0;
				const currentContentEditable = String(el.getAttribute("contenteditable") || el.contentEditable || "").toLowerCase();
				const currentAriaDisabled = String(el.getAttribute("aria-disabled") || "").toLowerCase();
				const currentClassDisabled = el.classList.contains("disabled");
				if (currentContentEditable === nextContentEditable && currentAriaDisabled === nextAriaDisabled && el.tabIndex === nextTabIndex && currentClassDisabled === disabled) return;
				if (!((state.composerComposing || keepAndroidEditorConnection) && currentContentEditable === "true") && currentContentEditable !== nextContentEditable) el.contentEditable = nextContentEditable;
				if (currentAriaDisabled !== nextAriaDisabled) el.setAttribute("aria-disabled", nextAriaDisabled);
				if (el.tabIndex !== nextTabIndex) el.tabIndex = nextTabIndex;
				if (currentClassDisabled !== disabled) el.classList.toggle("disabled", disabled);
			}
			function messageInputTextLength(el) {
				return String(el && (el.textContent || el.innerText) || "").length;
			}
			function messageInputTargetHeight(el) {
				const scrollHeight = viewportMetrics.cssPixel(el && el.scrollHeight);
				return Math.min(MESSAGE_INPUT_MAX_HEIGHT_PX, Math.max(MESSAGE_INPUT_MIN_HEIGHT_PX, scrollHeight));
			}
			function currentMessageInputHeight(el) {
				const inlineHeight = Number.parseFloat(el && el.style && el.style.height || "");
				return viewportMetrics.cssPixel(inlineHeight || el && el.getBoundingClientRect && el.getBoundingClientRect().height || 0);
			}
			function updateMessageInputOverflow(el, heightPx) {
				if (!el || !el.style) return;
				el.style.overflowY = el.scrollHeight > heightPx + 1 ? "auto" : "hidden";
			}
			function autoSizeMessageInput(el, options = {}) {
				if (!el) return false;
				const force = options.force === true;
				const previousTextLength = Number(state.messageInputTextLength || 0);
				const nextTextLength = messageInputTextLength(el);
				const currentHeight = currentMessageInputHeight(el);
				let nextHeight = messageInputTargetHeight(el);
				if (force || nextTextLength < previousTextLength) {
					const previousInlineHeight = el.style.height;
					el.style.height = "auto";
					nextHeight = messageInputTargetHeight(el);
					if (!force && currentHeight && !viewportMetrics.stablePixelChanged(currentHeight, nextHeight)) {
						el.style.height = previousInlineHeight;
						state.messageInputTextLength = nextTextLength;
						updateMessageInputOverflow(el, currentHeight);
						return false;
					}
				}
				state.messageInputTextLength = nextTextLength;
				if (!force && currentHeight && !viewportMetrics.stablePixelChanged(currentHeight, nextHeight)) {
					updateMessageInputOverflow(el, currentHeight);
					return false;
				}
				state.messageInputHeightPx = nextHeight;
				el.style.height = `${nextHeight}px`;
				updateMessageInputOverflow(el, nextHeight);
				updateComposerHeightVar();
				return true;
			}
			function formatFileSize(bytes) {
				if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
				if (bytes < 1024) return `${bytes} B`;
				if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
				return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
			}
			function appendLocalAttachmentSummary(text, attachments) {
				if (!attachments.length) return text;
				const lines = attachments.map((item) => {
					const file = item.file;
					const kind = file.type && file.type.startsWith("image/") ? "image" : "file";
					return `- ${file.name || "upload"} (${kind}, ${file.type || "file"}, ${formatFileSize(file.size || 0)}): ${file.name || "upload"}`;
				});
				return `${text ? `${text}\n\n` : ""}Uploaded attachments:\n${lines.join("\n")}`;
			}
			function localImageInputPartsForAttachments(attachments) {
				return (attachments || []).map((item) => {
					const file = item && item.file;
					if (!file) return null;
					const previewUrl = localAttachmentPreviewUrl(item);
					if (!previewUrl) return null;
					const name = String(file.name || "upload");
					if (!(String(file.type || "").toLowerCase().startsWith("image/") || /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)$/i.test(name))) return null;
					return {
						type: "input_image",
						image_url: { url: previewUrl },
						fileName: name
					};
				}).filter(Boolean);
			}
			function localUserMessageItem(text, attachments, clientSubmissionId) {
				const content = [{
					type: "text",
					text: appendLocalAttachmentSummary(text, attachments),
					text_elements: []
				}];
				content.push(...localImageInputPartsForAttachments(attachments));
				return {
					id: `local-user-${clientSubmissionId || Date.now()}`,
					type: "userMessage",
					mobilePendingSubmission: true,
					clientSubmissionId: clientSubmissionId || "",
					startedAtMs: Date.now(),
					content
				};
			}
			function attachmentId() {
				if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
				return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
			}
			function pendingAttachmentBytes(extra = []) {
				return state.pendingAttachments.reduce((total, item) => total + item.file.size, 0) + extra.reduce((total, file) => total + file.size, 0);
			}
			async function prepareAttachmentFile(file) {
				if (!imageCompressor || typeof imageCompressor.compressImageFile !== "function") return file;
				try {
					return await imageCompressor.compressImageFile(file);
				} catch (err) {
					postClientEvent("attachment_image_compression_failed", {
						name: file && file.name ? String(file.name).slice(0, 120) : "",
						type: file && file.type ? String(file.type).slice(0, 80) : "",
						size: file && Number.isFinite(file.size) ? Number(file.size) : 0,
						message: err && err.message ? err.message : String(err)
					});
					return file;
				}
			}
			async function prepareAttachmentFiles(files) {
				const prepared = [];
				for (const file of files) prepared.push(await prepareAttachmentFile(file));
				return prepared;
			}
			async function addAttachmentFiles(fileList) {
				const files = Array.from(fileList || []).filter(Boolean);
				if (!files.length) return;
				state.attachmentProcessingCount += 1;
				updateComposerControls();
				let preparedFiles = files;
				try {
					preparedFiles = await prepareAttachmentFiles(files);
				} finally {
					state.attachmentProcessingCount = Math.max(0, state.attachmentProcessingCount - 1);
					updateComposerControls();
				}
				const draftKey = currentDraftKey();
				const startIndex = state.pendingAttachments.length;
				const accepted = [];
				for (const file of preparedFiles) {
					if (state.pendingAttachments.length + accepted.length >= state.maxUploadFiles) {
						showError(/* @__PURE__ */ new Error(`Too many attachments; max ${state.maxUploadFiles}`));
						break;
					}
					if (pendingAttachmentBytes(accepted.concat(file)) > state.maxUploadBytes) {
						showError(/* @__PURE__ */ new Error(`Attachments are too large; max ${formatFileSize(state.maxUploadBytes)}`));
						break;
					}
					accepted.push(file);
				}
				for (const file of accepted) {
					const previewUrl = file.type && file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
					state.pendingAttachments.push({
						id: attachmentId(),
						file,
						previewUrl
					});
				}
				renderAttachmentList();
				const addedItems = state.pendingAttachments.slice(startIndex);
				if (draftKey) saveDraftAttachmentFiles(draftKey, addedItems);
				scheduleCurrentDraftSave();
			}
			function removeAttachment(id) {
				const draftKey = currentDraftKey();
				const index = state.pendingAttachments.findIndex((item) => item.id === id);
				if (index < 0) return;
				const [item] = state.pendingAttachments.splice(index, 1);
				if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
				renderAttachmentList();
				if (draftKey) deleteDraftAttachments(draftKey, [id]).catch((err) => {
					postClientEvent("draft_attachment_remove_failed", { message: err.message || String(err) });
				});
				scheduleCurrentDraftSave();
			}
			function clearPendingAttachments(options = {}) {
				const draftKey = currentDraftKey();
				const attachmentsToReleaseLater = options.revokePreviewUrls === false ? state.pendingAttachments.slice() : [];
				replacePendingAttachments([], {
					saveDraft: false,
					revokePreviewUrls: options.revokePreviewUrls
				});
				if (attachmentsToReleaseLater.length) scheduleAttachmentPreviewUrlRevoke(attachmentsToReleaseLater);
				if (options.deleteDraft !== false && draftKey) deleteDraftAttachments(draftKey).catch((err) => {
					postClientEvent("draft_attachment_clear_failed", { message: err.message || String(err) });
				});
			}
			function renderAttachmentList() {
				const list = $("attachmentList");
				if (!state.pendingAttachments.length) {
					list.classList.add("hidden");
					list.innerHTML = "";
					updateComposerControls();
					updateComposerHeightVar();
					return;
				}
				list.classList.remove("hidden");
				list.innerHTML = state.pendingAttachments.map((item) => {
					const file = item.file;
					const thumb = item.previewUrl ? `<img class="attachment-thumb" src="${escapeHtml(item.previewUrl)}" alt="">` : `<div class="attachment-file-icon" aria-hidden="true"></div>`;
					return `<div class="attachment-chip" data-attachment="${escapeHtml(item.id)}">
      ${thumb}
      <div class="attachment-meta">
        <div class="attachment-name">${escapeHtml(file.name || "upload")}</div>
        <div class="attachment-size">${escapeHtml(`${file.type || "file"} - ${formatFileSize(file.size)}`)}</div>
      </div>
      <button class="attachment-remove" type="button" title="Remove attachment" data-remove-attachment="${escapeHtml(item.id)}">x</button>
    </div>`;
				}).join("");
				updateComposerControls();
				updateComposerHeightVar();
			}
			function composerHasContent() {
				return Boolean(composerText() || state.pendingAttachments.length);
			}
			function effectiveDefaultModel(thread = composerTargetThread()) {
				return thread && thread.model || state.defaultModel || "";
			}
			function effectiveDefaultEffort(thread = composerTargetThread()) {
				return thread && thread.effort || state.defaultReasoningEffort || "";
			}
			function effectiveDefaultPermissionMode(thread = composerTargetThread()) {
				const settings = thread && thread.runtimeSettings;
				if (String(settings && settings.sandboxPolicyType || "").replace(/[-_]/g, "").toLowerCase() === "dangerfullaccess") return "full";
				return effectiveComposerPermissionMode(settings && settings.permissionMode || "");
			}
			function selectedComposerModel() {
				if (state.newThreadDraft) return newThreadSelectedModel();
				return state.composerModel || effectiveDefaultModel();
			}
			function selectedComposerEffort() {
				if (state.newThreadDraft) return newThreadSelectedEffort();
				return state.composerEffort || effectiveDefaultEffort();
			}
			function selectedComposerPermissionMode() {
				if (state.newThreadDraft) return newThreadSelectedPermissionMode();
				return effectiveComposerPermissionMode(state.composerPermissionMode || effectiveDefaultPermissionMode()) || defaultNewThreadPermissionMode();
			}
			function resetComposerRuntimeSelection() {
				state.composerModel = "";
				state.composerEffort = "";
				state.composerPermissionMode = "";
				state.codexFastMode = false;
				closeComposerRuntimeMenu();
				closeComposerIntentMenu();
				state.quotaDetailsOpen = false;
			}
			function runtimeOptionValues(kind) {
				if (kind === "model") return normalizeOptionList([
					selectedComposerModel(),
					state.defaultModel,
					...state.modelOptions
				]);
				if (kind === "effort") return normalizeOptionList([
					selectedComposerEffort(),
					state.defaultReasoningEffort,
					...state.reasoningEffortOptions
				]);
				if (kind === "permission") return normalizeOptionList([
					selectedComposerPermissionMode(),
					defaultNewThreadPermissionMode(),
					...state.permissionModeOptions
				]);
				return [];
			}
			function runtimeOptionLabel(kind, value) {
				if (kind === "model") return labelForModel(value);
				if (kind === "effort") return labelForEffort(value);
				if (kind === "permission") return labelForPermissionMode(value);
				return value;
			}
			function runtimeSelectedValue(kind) {
				if (kind === "model") return selectedComposerModel();
				if (kind === "effort") return selectedComposerEffort();
				if (kind === "permission") return selectedComposerPermissionMode();
				return "";
			}
			function codexFastCommandEnabled() {
				return Boolean(state.codexFastMode);
			}
			function clearLegacyCodexFastModeStorage() {
				try {
					localStorage.removeItem(STORAGE_CODEX_FAST_MODE);
				} catch (_) {}
			}
			function setCodexFastCommandEnabled(enabled) {
				state.codexFastMode = Boolean(enabled);
				clearLegacyCodexFastModeStorage();
				renderComposerSettings();
				updateComposerControls();
				saveCurrentDraftNow();
				showComposerFastHint(state.codexFastMode);
			}
			function applyRuntimeSelection(kind, value) {
				const selected = String(value || "").trim();
				if (!selected) return;
				if (state.newThreadDraft) {
					if (kind === "model") state.newThreadModel = selected;
					if (kind === "effort") state.newThreadEffort = selected;
					if (kind === "permission") state.newThreadPermissionMode = effectiveComposerPermissionMode(selected) || defaultNewThreadPermissionMode();
				} else {
					if (kind === "model") state.composerModel = selected;
					if (kind === "effort") state.composerEffort = selected;
					if (kind === "permission") state.composerPermissionMode = effectiveComposerPermissionMode(selected) || defaultNewThreadPermissionMode();
				}
				closeComposerRuntimeMenu();
				renderComposerSettings();
				updateComposerControls();
				saveCurrentDraftNow();
			}
			function closeComposerRuntimeMenu() {
				const menu = $("composerRuntimeMenu");
				if (menu) {
					menu.hidden = true;
					menu.innerHTML = "";
				}
				for (const id of [
					"composerModelControl",
					"composerEffortControl",
					"composerPermissionControl"
				]) {
					const button = $(id);
					if (button) button.setAttribute("aria-expanded", "false");
				}
				state.composerMenuKind = "";
				document.removeEventListener("pointerdown", onComposerRuntimeOutsidePointer);
			}
			function onComposerRuntimeOutsidePointer(event) {
				const menu = $("composerRuntimeMenu");
				const target = event.target;
				if (!menu || menu.hidden) return;
				if (menu.contains(target)) return;
				if (target && target.closest && target.closest("[data-composer-runtime]")) return;
				closeComposerRuntimeMenu();
			}
			function openComposerRuntimeMenu(kind, anchor) {
				const menu = $("composerRuntimeMenu");
				if (!menu || !anchor) return;
				closeComposerIntentMenu();
				state.quotaDetailsOpen = false;
				const selected = runtimeSelectedValue(kind);
				menu.innerHTML = runtimeOptionValues(kind).map((value) => {
					return `<button type="button" class="composer-runtime-option${value === selected ? " is-selected" : ""}" role="option" aria-selected="${value === selected ? "true" : "false"}" data-runtime-kind="${escapeHtml(kind)}" data-runtime-value="${escapeHtml(value)}">${escapeHtml(runtimeOptionLabel(kind, value))}</button>`;
				}).join("");
				menu.hidden = false;
				state.composerMenuKind = kind;
				for (const id of [
					"composerModelControl",
					"composerEffortControl",
					"composerPermissionControl"
				]) {
					const button = $(id);
					if (button) button.setAttribute("aria-expanded", button === anchor ? "true" : "false");
				}
				fitComposerPopupToAnchor(menu, anchor);
				document.addEventListener("pointerdown", onComposerRuntimeOutsidePointer);
			}
			function composerRuntimeMenuDiagnostics(kind, triggerType) {
				const menu = $("composerRuntimeMenu");
				const rect = menu && !menu.hidden ? menu.getBoundingClientRect() : null;
				const visualViewport = window.visualViewport;
				const viewportWidth = Math.round(visualViewport && visualViewport.width || window.innerWidth || 0);
				const viewportHeight = Math.round(visualViewport && visualViewport.height || window.innerHeight || 0);
				return {
					kind,
					triggerType,
					menuHidden: !menu || menu.hidden,
					optionCount: menu ? menu.querySelectorAll("[data-runtime-kind][data-runtime-value]").length : 0,
					top: rect ? Math.round(rect.top) : null,
					bottom: rect ? Math.round(rect.bottom) : null,
					left: rect ? Math.round(rect.left) : null,
					right: rect ? Math.round(rect.right) : null,
					viewportWidth,
					viewportHeight,
					visible: Boolean(rect && rect.bottom > 0 && rect.top < viewportHeight && rect.right > 0 && rect.left < viewportWidth)
				};
			}
			function reportComposerRuntimeMenu(kind, triggerType) {
				(typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame.bind(window) : (callback) => window.setTimeout(callback, 0))(() => postClientEvent("composer_runtime_menu_opened", composerRuntimeMenuDiagnostics(kind, triggerType)));
			}
			function handleComposerRuntimeControl(event, kind, button) {
				event.preventDefault();
				event.stopPropagation();
				if (button.disabled) {
					postClientEvent("composer_runtime_control_ignored", {
						kind,
						triggerType: event.type,
						reason: "disabled"
					});
					return;
				}
				if (state.composerMenuKind === kind) {
					closeComposerRuntimeMenu();
					postClientEvent("composer_runtime_menu_closed", {
						kind,
						triggerType: event.type
					});
				} else {
					openComposerRuntimeMenu(kind, button);
					reportComposerRuntimeMenu(kind, event.type);
				}
			}
			function fitComposerPopupToAnchor(panel, anchor, options = {}) {
				const rect = anchor.getBoundingClientRect();
				const minWidth = Number(options.minWidth || 180);
				const maxWidth = Number(options.maxWidth || 280);
				const visualViewport = window.visualViewport;
				const viewportLeft = visualViewport ? Number(visualViewport.offsetLeft || 0) : 0;
				const viewportTop = visualViewport ? Number(visualViewport.offsetTop || 0) : 0;
				const viewportWidth = Math.max(1, Math.floor(visualViewport && visualViewport.width || window.innerWidth || document.documentElement.clientWidth || maxWidth));
				const viewportHeight = Math.max(1, Math.floor(visualViewport && visualViewport.height || window.innerHeight || document.documentElement.clientHeight || 360));
				const width = Math.max(minWidth, Math.min(maxWidth, viewportWidth - 16, Math.max(rect.width, minWidth)));
				const left = Math.max(viewportLeft + 8, Math.min(viewportLeft + viewportWidth - width - 8, rect.left));
				const anchorTop = Math.max(viewportTop + 8, Math.min(viewportTop + viewportHeight - 8, rect.top));
				const availableAbove = Math.max(96, anchorTop - viewportTop - 12);
				const bottom = Math.max(8, viewportTop + viewportHeight - anchorTop + 6);
				panel.style.setProperty("--composer-popup-left", `${Math.round(left)}px`);
				panel.style.setProperty("--composer-popup-bottom", `${Math.round(bottom)}px`);
				panel.style.setProperty("--composer-popup-width", `${Math.round(width)}px`);
				panel.style.setProperty("--composer-popup-max-height", `${Math.round(Math.min(360, availableAbove))}px`);
			}
			function closeQuotaDetails() {
				state.quotaDetailsOpen = false;
				const panel = $("quotaDetailPanel");
				if (panel) {
					panel.hidden = true;
					panel.innerHTML = "";
				}
				const quota = $("quotaUsage");
				if (quota) quota.setAttribute("aria-expanded", "false");
				document.removeEventListener("pointerdown", onQuotaOutsidePointer);
			}
			function onQuotaOutsidePointer(event) {
				const panel = $("quotaDetailPanel");
				const quota = $("quotaUsage");
				const target = event.target;
				if (!state.quotaDetailsOpen) return;
				if (panel && panel.contains(target) || quota && quota.contains(target)) return;
				closeQuotaDetails();
			}
			function toggleQuotaDetails(anchor) {
				closeComposerRuntimeMenu();
				state.quotaDetailsOpen = !state.quotaDetailsOpen;
				renderQuotaUsage();
				const panel = $("quotaDetailPanel");
				if (state.quotaDetailsOpen && panel && anchor) {
					fitComposerPopupToAnchor(panel, anchor, {
						minWidth: 320,
						maxWidth: 390
					});
					document.addEventListener("pointerdown", onQuotaOutsidePointer);
				} else document.removeEventListener("pointerdown", onQuotaOutsidePointer);
			}
			function composerPlaceholderText() {
				const targetThreadId = currentComposerThreadId();
				const targetThread = composerTargetThread();
				return threadTileStatePolicy.composerTargetPlaceholderPlan({
					newThreadDraft: state.newThreadDraft,
					tileContext: isThreadTileComposerContext(),
					targetThreadId,
					hasTargetThread: Boolean(targetThread),
					targetTitle: targetThread ? threadDisplayName(targetThread) : "",
					newThreadPlaceholder: "输入第一条消息",
					defaultPlaceholder: "Message Codex"
				}).text;
			}
			function composerShowsTargetPlaceholder() {
				const targetThreadId = currentComposerThreadId();
				const targetThread = composerTargetThread();
				return threadTileStatePolicy.composerTargetPlaceholderPlan({
					newThreadDraft: state.newThreadDraft,
					tileContext: isThreadTileComposerContext(),
					targetThreadId,
					hasTargetThread: Boolean(targetThread)
				}).showTargetPlaceholder === true;
			}
			function applyComposerActionControlPlan(sendButton, plan) {
				if (!sendButton || !plan) return;
				setComposerActionButtonLabel(sendButton, plan.label || "Send", { proxy: plan.labelProxy === true });
				sendButton.title = plan.title || "";
				const classState = plan.classState || {};
				sendButton.classList.toggle("interrupt-mode", classState.interruptMode === true);
				sendButton.classList.toggle("sending", classState.sending === true);
				sendButton.classList.toggle("send-failed", classState.sendFailed === true);
				sendButton.classList.toggle("steer-mode", classState.steerMode === true);
				sendButton.classList.toggle("plugin-voice-input-gesture", classState.pluginVoiceInputGesture === true);
				if (plan.ariaLabel) sendButton.setAttribute("aria-label", plan.ariaLabel);
				else sendButton.removeAttribute("aria-label");
				sendButton.disabled = plan.sendButtonDisabled === true;
			}
			function renderComposerSettings() {
				const commandControl = $("composerCommandControl");
				const modelControl = $("composerModelControl");
				const effortControl = $("composerEffortControl");
				const permissionControl = $("composerPermissionControl");
				if (!commandControl || !modelControl || !effortControl || !permissionControl) return;
				const selectedModel = selectedComposerModel();
				const selectedEffort = selectedComposerEffort();
				const selectedPermission = selectedComposerPermissionMode();
				const fastEnabled = codexFastCommandEnabled();
				const fastScopeLabel = state.newThreadDraft ? "this new thread" : "this thread";
				commandControl.classList.toggle("is-fast", fastEnabled);
				commandControl.setAttribute("aria-pressed", fastEnabled ? "true" : "false");
				commandControl.title = fastEnabled ? `Fast tag on for ${fastScopeLabel}` : `Fast tag off for ${fastScopeLabel}`;
				commandControl.setAttribute("aria-label", fastEnabled ? `Fast tag on for ${fastScopeLabel}` : `Fast tag off for ${fastScopeLabel}`);
				commandControl.disabled = state.composerBusy;
				const controls = [
					[
						modelControl,
						selectedModel ? labelForModel(selectedModel) : "--",
						state.newThreadDraft || state.composerModel ? "下一轮使用" : "当前记录"
					],
					[
						effortControl,
						selectedEffort ? labelForEffort(selectedEffort) : "--",
						state.newThreadDraft || state.composerEffort ? "下一轮使用" : "当前记录"
					],
					[
						permissionControl,
						selectedPermission ? labelForPermissionMode(selectedPermission).replace(/权限$/, "") : "--",
						state.newThreadDraft || state.composerPermissionMode ? "下一轮使用" : "当前记录"
					]
				];
				for (const [button, value, mode] of controls) {
					const valueEl = button.querySelector(".composer-chip-value");
					if (valueEl) valueEl.textContent = value;
					button.title = `${button.querySelector(".composer-chip-label")?.textContent || ""}：${value}（${mode}）`;
					button.classList.toggle("has-pending-value", mode === "下一轮使用");
					button.disabled = state.composerBusy;
				}
				renderQuotaUsage();
			}
			function updateComposerControls() {
				const targetThreadId = currentComposerThreadId();
				const targetThread = composerTargetThread();
				const targetActiveTurnId = composerTargetActiveTurnId();
				const hasThread = Boolean(targetThreadId && targetThread && !targetThread.mobileLoading && !targetThread.mobileLoadError);
				const hasNewThreadDraft = Boolean(state.newThreadDraft);
				const hasContent = composerHasContent();
				const bareIntentKind = composerIntentBareTagKind(composerText());
				const goalCommandMode = Boolean(!hasNewThreadDraft && isThreadGoalCommandText(composerText()));
				const commandMode = Boolean(!hasNewThreadDraft && isThreadTaskCardCommandText(composerText()));
				const voiceGestureAvailable = pluginVoiceInputGestureAvailable();
				const bareIntentOption = bareIntentKind ? composerIntentOption(bareIntentKind) : null;
				const composerActionPlan = threadTileStatePolicy.composerActionControlPlan({
					hasThread,
					hasNewThreadDraft,
					composerBusy: state.composerBusy,
					attachmentProcessingCount: state.attachmentProcessingCount,
					hasContent,
					targetActiveTurnId,
					bareIntentKind,
					bareIntentTitle: bareIntentOption ? `Open ${bareIntentOption.label}` : "Open composer action",
					goalCommandMode,
					commandMode,
					sendButtonHint: state.sendButtonHint,
					steeringBusy: Boolean(state.steerFeedback && state.steerFeedback.status === "sending"),
					voiceGestureAvailable,
					hermesEmbedMode: isHermesEmbedMode()
				});
				const disabled = composerActionPlan.disabled === true;
				const sendButton = $("sendMessage");
				const attachButton = $("attachFiles");
				const messageInput = $("messageInput");
				for (const id of [
					"composerIntentBodyInput",
					"composerIntentSubmitButton",
					"composerIntentSaveButton"
				]) {
					const el = $(id);
					if (el) el.disabled = state.composerIntentDialogBusy || state.composerBusy;
				}
				if (messageInput) {
					messageInput.dataset.placeholder = composerPlaceholderText();
					messageInput.classList.toggle("has-target-placeholder", composerShowsTargetPlaceholder());
				}
				setMessageInputDisabled(disabled);
				$("fileInput").disabled = disabled;
				attachButton.disabled = disabled;
				attachButton.classList.toggle("disabled", disabled);
				attachButton.setAttribute("aria-disabled", disabled ? "true" : "false");
				attachButton.tabIndex = disabled ? -1 : 0;
				for (const id of [
					"composerCommandControl",
					"composerModelControl",
					"composerEffortControl",
					"composerPermissionControl",
					"quotaUsage"
				]) {
					const button = $(id);
					if (button) button.disabled = disabled;
				}
				applyComposerActionControlPlan(sendButton, composerActionPlan);
				publishPluginVoiceInputCapability();
			}
			function hasTransferFiles(event) {
				return Array.from(event.dataTransfer && event.dataTransfer.types || []).includes("Files");
			}
			function goalDialogFormValues(options = {}) {
				const requireObjective = options.requireObjective !== false;
				const thread = currentGoalDialogThread();
				const threadId = String(thread && thread.id || state.goalDialogThreadId || "").trim();
				const objectiveInput = $("goalObjectiveInput");
				const budgetInput = $("goalTokenBudgetInput");
				const objective = String(objectiveInput && objectiveInput.value || "").trim();
				const rawBudget = String(budgetInput && budgetInput.value || "").trim();
				if (!threadId) {
					showError(/* @__PURE__ */ new Error("No thread is selected"));
					return null;
				}
				if (requireObjective && !objective) {
					showError(/* @__PURE__ */ new Error("Goal objective is required"));
					if (objectiveInput) objectiveInput.focus();
					return null;
				}
				let tokenBudget = 0;
				if (rawBudget) {
					tokenBudget = Number(rawBudget);
					if (!Number.isFinite(tokenBudget) || tokenBudget <= 0) {
						showError(/* @__PURE__ */ new Error("Token budget must be a positive number"));
						if (budgetInput) budgetInput.focus();
						return null;
					}
					tokenBudget = Math.trunc(tokenBudget);
				}
				return {
					thread,
					threadId,
					objective,
					tokenBudget: tokenBudget > 0 ? tokenBudget : null
				};
			}
			async function submitThreadGoalMessage(event) {
				if (event && typeof event.preventDefault === "function") event.preventDefault();
				if (state.goalSubmitBusy || state.composerBusy) {
					if (state.composerBusy) showError(/* @__PURE__ */ new Error("A message is already sending"));
					return;
				}
				const values = goalDialogFormValues();
				if (!values) return;
				const { threadId, objective, tokenBudget } = values;
				state.composerBusy = true;
				state.sendButtonHint = "";
				setThreadGoalDialogBusy(true, "Saving...");
				markActivity("Goal set");
				updateComposerControls();
				try {
					postClientEvent("goal_request_start", { threadId });
					const result = await api(`/api/threads/${encodeURIComponent(threadId)}/goal`, {
						method: "POST",
						body: JSON.stringify({
							objective,
							tokenBudget
						}),
						timeoutMs: 3e4
					});
					const responseGoal = normalizeThreadGoal(result && result.goal, threadId);
					const visibleGoal = responseGoal || submittedThreadGoal(threadId, objective, tokenBudget);
					if (visibleGoal) updateThreadGoalState(threadId, visibleGoal);
					closeThreadGoalDialog(true);
					$("connectionState").classList.remove("error");
					$("connectionState").textContent = "Goal set";
					markActivity("Goal set");
					postClientEvent("goal_request_success", {
						threadId,
						hasResponseGoal: Boolean(responseGoal)
					});
					if (threadId === state.currentThreadId) scheduleCurrentThreadRefresh(600);
					loadThreads({ silent: true }).catch(showError);
				} catch (err) {
					const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err)) || "Goal set failed";
					$("connectionState").classList.add("error");
					$("connectionState").textContent = message;
					postClientEvent("goal_request_failure", {
						threadId,
						message
					});
					showError(new Error(message));
				} finally {
					state.composerBusy = false;
					setThreadGoalDialogBusy(false);
					updateComposerControls();
				}
			}
			function threadGoalActionStatusText(action) {
				if (action === "continue") return "Goal continued";
				if (action === "pause") return "Goal paused";
				if (action === "cancel") return "Goal cancelled";
				return "Goal updated";
			}
			function threadGoalActionBusyText(action) {
				if (action === "continue") return "Continuing...";
				if (action === "pause") return "Pausing...";
				if (action === "cancel") return "Cancelling...";
				return "Sending...";
			}
			async function runThreadGoalDialogAction(action, event) {
				if (event && typeof event.preventDefault === "function") event.preventDefault();
				if (event && typeof event.stopPropagation === "function") event.stopPropagation();
				if (state.goalSubmitBusy || state.composerBusy) {
					if (state.composerBusy) showError(/* @__PURE__ */ new Error("A message is already sending"));
					return;
				}
				const normalizedAction = String(action || "").trim().toLowerCase();
				const values = goalDialogFormValues({ requireObjective: normalizedAction !== "cancel" });
				if (!values) return;
				const { threadId, objective, tokenBudget } = values;
				state.composerBusy = true;
				state.sendButtonHint = "";
				setThreadGoalDialogBusy(true, threadGoalActionBusyText(normalizedAction));
				markActivity("Goal action");
				updateComposerControls();
				try {
					postClientEvent("goal_action_start", {
						threadId,
						action: normalizedAction
					});
					const result = await api(`/api/threads/${encodeURIComponent(threadId)}/goal/actions`, {
						method: "POST",
						body: JSON.stringify({
							action: normalizedAction,
							objective: objective || void 0,
							tokenBudget
						}),
						timeoutMs: 3e4
					});
					const responseGoal = normalizeThreadGoal(result && result.goal, threadId);
					if (normalizedAction === "cancel") updateThreadGoalState(threadId, null);
					else if (responseGoal) updateThreadGoalState(threadId, responseGoal);
					else if (objective) updateThreadGoalState(threadId, submittedThreadGoal(threadId, objective, tokenBudget));
					closeThreadGoalDialog(true);
					$("connectionState").classList.remove("error");
					$("connectionState").textContent = threadGoalActionStatusText(normalizedAction);
					markActivity(threadGoalActionStatusText(normalizedAction));
					postClientEvent("goal_action_success", {
						threadId,
						action: normalizedAction,
						hasResponseGoal: Boolean(responseGoal)
					});
					if (threadId === state.currentThreadId) scheduleCurrentThreadRefresh(600);
					loadThreads({ silent: true }).catch(showError);
				} catch (err) {
					const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err)) || "Goal action failed";
					$("connectionState").classList.add("error");
					$("connectionState").textContent = message;
					postClientEvent("goal_action_failure", {
						threadId,
						action: normalizedAction,
						message
					});
					showError(new Error(message));
				} finally {
					state.composerBusy = false;
					setThreadGoalDialogBusy(false);
					updateComposerControls();
				}
			}
			function requestGoalDialogSubmitFromEnter(event) {
				if (!event || event.key !== "Enter" || event.shiftKey || event.isComposing) return;
				if (state.goalSubmitBusy || state.composerBusy) return;
				event.preventDefault();
				event.stopPropagation();
				requestGoalDialogSubmit();
			}
			function requestGoalDialogSubmitFromButton(event) {
				if (event && typeof event.preventDefault === "function") event.preventDefault();
				if (event && typeof event.stopPropagation === "function") event.stopPropagation();
				const now = Date.now();
				if (now - state.lastGoalButtonSubmitAt < 650) return;
				state.lastGoalButtonSubmitAt = now;
				const button = $("goalSubmitButton");
				if (button && button.disabled) return;
				postClientEvent("goal_button_pressed", {
					threadId: state.goalDialogThreadId || state.currentThreadId || "",
					eventType: event && event.type || ""
				});
				requestGoalDialogSubmit();
			}
			function requestGoalDialogSubmit() {
				const form = $("goalForm");
				if (form && typeof form.requestSubmit === "function") form.requestSubmit();
				else submitThreadGoalMessage().catch(showError);
			}
			async function sendThreadTaskCardCommand(commandText, options = {}) {
				const text = String(commandText || "").trim();
				const targetThreadId = currentComposerThreadId();
				const targetThread = composerTargetThread();
				if (!text || !targetThreadId) return false;
				if (state.pendingAttachments.length) {
					const err = /* @__PURE__ */ new Error("Task-card commands do not support attachments yet");
					showError(err);
					if (options.rethrow) throw err;
					return false;
				}
				const submittedDraftKey = currentDraftKey();
				const clientSubmissionId = createSubmissionId();
				const outboundText = buildThreadTaskCardDraftRequestText(text, targetThread);
				state.composerBusy = true;
				state.sendButtonHint = "";
				startSendProgressWatchdog(targetThreadId);
				markActivity("任务卡片");
				updateComposerControls();
				if (state.sendProgressWarned) {
					$("connectionState").textContent = "Task card draft request";
					$("connectionState").classList.remove("error");
				}
				try {
					const body = new FormData();
					body.append("clientSubmissionId", clientSubmissionId);
					body.append("text", outboundText);
					if (targetThread && targetThread.cwd) body.append("cwd", targetThread.cwd);
					body.append("model", selectedComposerModel());
					body.append("effort", selectedComposerEffort());
					body.append("permissionMode", selectedComposerPermissionMode());
					if (codexFastCommandEnabled()) body.append("fastMode", "1");
					registerSubmittedUserMessage(targetThreadId, outboundText, [], clientSubmissionId);
					const insertedLocalMessage = insertLocalSubmittedUserMessage(targetThreadId, outboundText, [], clientSubmissionId);
					markThreadOptimisticallyActive(targetThreadId);
					renderThreads();
					if (insertedLocalMessage) renderCurrentThread({ stickToBottom: true });
					scheduleSubmittedMessageDomProbe(targetThreadId, clientSubmissionId, "task-card-submit");
					followSubmittedMessageToBottom(targetThreadId, clientSubmissionId);
					const result = await api(`/api/threads/${encodeURIComponent(targetThreadId)}/messages`, {
						method: "POST",
						body,
						timeoutMs: 18e4
					});
					const serverTurnId = startedTurnId(result);
					if (serverTurnId && reconcileSubmittedUserMessageTurn(targetThreadId, clientSubmissionId, serverTurnId)) renderCurrentThread({ stickToBottom: true });
					commitPluginVoiceInputSessionsAfterSend(submittedDraftKey, text, {
						threadId: targetThreadId,
						messageId: clientSubmissionId,
						composerId: "thread-composer"
					});
					setComposerText("");
					writeCurrentDraftToKey(submittedDraftKey);
					$("connectionState").classList.remove("error");
					$("connectionState").textContent = "Task card draft requested";
					markActivity("草案已请求");
					recordHomeAiDiagnosticSuccess({
						category: "task_card_workflow_failed",
						diagnostic_type: "task_card_draft_request_failed",
						error_code: "task_card_draft_request_failed",
						context: {
							surface: "task-card",
							action: "draft-request",
							thread_hash: diagnosticThreadHash(targetThreadId)
						}
					});
					scheduleComposerTargetRefresh(targetThreadId, 600, "task-card-submit");
					scheduleLivePollIfNeeded(1200);
					loadThreads({ silent: true }).catch(showError);
					return true;
				} catch (err) {
					clearSubmittedMessageBottomFollow();
					const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err), err) || "任务卡片提交失败，请重试";
					state.sendButtonHint = "重试";
					markSubmittedUserMessageFailed(targetThreadId, outboundText, [], clientSubmissionId, message);
					$("connectionState").classList.remove("error");
					$("connectionState").textContent = "发送失败，详情见消息回执";
					postClientEvent("send_failure", {
						threadId: targetThreadId || "",
						message,
						steering: false,
						taskCardCommand: true
					});
					recordHomeAiDiagnosticFailure({
						category: "task_card_workflow_failed",
						diagnostic_type: "task_card_draft_request_failed",
						severity_hint: "H2",
						evidence_confidence: .76,
						error_code: diagnosticErrorCode(err, "task_card_draft_request_failed"),
						context: {
							surface: "task-card",
							action: "draft-request",
							thread_hash: diagnosticThreadHash(targetThreadId)
						},
						counts: { status_code: diagnosticErrorStatus(err) },
						breadcrumbs: [{
							kind: "task-card",
							code: "draft-request",
							status: "failed",
							fields: {
								status_code: diagnosticErrorStatus(err),
								thread_hash: diagnosticThreadHash(targetThreadId)
							}
						}]
					});
					if (options.rethrow) throw new Error(message);
					return false;
				} finally {
					finishSendProgressWatchdog();
					state.composerBusy = false;
					updateComposerControls();
				}
			}
			async function sendMessage(event) {
				if (event && typeof event.preventDefault === "function") event.preventDefault();
				if (state.composerBusy) return;
				state.lastSendSubmitStartedAt = Date.now();
				const input = $("messageInput");
				const text = composerText();
				const normalizedIntentText = normalizedComposerIntentText(text);
				const hasContent = Boolean(text || state.pendingAttachments.length);
				const targetThreadId = currentComposerThreadId();
				const targetThread = composerTargetThread();
				const targetActiveTurnId = composerTargetActiveTurnId();
				if (normalizedIntentText === "@") {
					openComposerIntentMenu();
					return;
				}
				const bareIntentKind = composerIntentBareTagKind(text);
				if (bareIntentKind && bareIntentKind !== "goal") {
					openComposerIntentDialog(bareIntentKind);
					return;
				}
				if (isThreadGoalCommandText(text)) {
					if (state.newThreadDraft) {
						showError(/* @__PURE__ */ new Error("Goal is only available in an existing thread"));
						return;
					}
					if (state.pendingAttachments.length) {
						showError(/* @__PURE__ */ new Error("Goal commands do not support attachments"));
						return;
					}
					if (!targetThreadId) return;
					setComposerText("");
					scheduleCurrentDraftSave();
					openThreadGoalDialog(targetThreadId);
					return;
				}
				if (isChatGptProCommandText(text)) {
					await submitChatGptProRequest(text);
					return;
				}
				if (state.newThreadDraft) {
					await sendNewThreadMessage(text, hasContent, input);
					return;
				}
				if (targetActiveTurnId && !hasContent) {
					await interruptActiveTurn(targetThreadId, targetActiveTurnId);
					return;
				}
				if (!text && !state.pendingAttachments.length || !targetThreadId) return;
				const threadTaskCardCommand = isThreadTaskCardCommandText(text);
				if (threadTaskCardCommand && state.pendingAttachments.length) {
					showError(/* @__PURE__ */ new Error("# task-card commands do not support attachments yet"));
					return;
				}
				if (threadTaskCardCommand) {
					await sendThreadTaskCardCommand(text);
					return;
				}
				const outboundText = text;
				const steering = Boolean(targetActiveTurnId && hasContent);
				const steerTurnId = steering ? String(targetActiveTurnId) : "";
				const submittedDraftKey = currentDraftKey();
				const clientSubmissionId = createSubmissionId();
				const submittedAttachments = state.pendingAttachments.slice();
				const previousThreadStatus = snapshotThreadStatus(targetThreadId);
				state.composerBusy = true;
				state.sendButtonHint = "";
				startSendProgressWatchdog(targetThreadId);
				if (steering) setSteerFeedback("sending", {
					threadId: targetThreadId,
					turnId: steerTurnId,
					clientSubmissionId
				});
				else markActivity("发送");
				updateComposerControls();
				if (state.sendProgressWarned) {
					$("connectionState").textContent = steering ? "引导中…" : "发送中…";
					$("connectionState").classList.remove("error");
				}
				try {
					const body = new FormData();
					body.append("clientSubmissionId", clientSubmissionId);
					body.append("text", outboundText);
					if (targetThread && targetThread.cwd) body.append("cwd", targetThread.cwd);
					if (steerTurnId) body.append("activeTurnId", steerTurnId);
					body.append("model", selectedComposerModel());
					body.append("effort", selectedComposerEffort());
					body.append("permissionMode", selectedComposerPermissionMode());
					if (codexFastCommandEnabled()) body.append("fastMode", "1");
					for (const item of state.pendingAttachments) body.append("attachments", item.file, item.file.name || "upload");
					registerSubmittedUserMessage(targetThreadId, outboundText, submittedAttachments, clientSubmissionId);
					const insertedLocalMessage = insertLocalSubmittedUserMessage(targetThreadId, outboundText, submittedAttachments, clientSubmissionId, { turnId: steering ? steerTurnId : "" });
					if (!steering) {
						markThreadOptimisticallyActive(targetThreadId);
						renderThreads();
					}
					if (insertedLocalMessage) renderCurrentThread({ stickToBottom: true });
					scheduleSubmittedMessageDomProbe(targetThreadId, clientSubmissionId, steering ? "message-steer" : "message-submit");
					followSubmittedMessageToBottom(targetThreadId, clientSubmissionId);
					const result = await api(`/api/threads/${encodeURIComponent(targetThreadId)}/messages`, {
						method: "POST",
						body,
						timeoutMs: 18e4
					});
					const serverTurnId = startedTurnId(result);
					if (!steering && serverTurnId && reconcileSubmittedUserMessageTurn(targetThreadId, clientSubmissionId, serverTurnId)) renderCurrentThread({ stickToBottom: true });
					commitPluginVoiceInputSessionsAfterSend(submittedDraftKey, text, {
						threadId: targetThreadId,
						messageId: clientSubmissionId,
						composerId: "thread-composer"
					});
					setComposerText("");
					clearPendingAttachments({ revokePreviewUrls: false });
					writeCurrentDraftToKey(submittedDraftKey);
					if (!steering) renderComposerSettings();
					input.blur();
					$("connectionState").classList.remove("error");
					if (steering) setSteerFeedback("delivered", {
						threadId: targetThreadId,
						turnId: steerTurnId,
						clientSubmissionId
					});
					else {
						$("connectionState").textContent = "Sent";
						markActivity("已发送");
					}
					scheduleComposerTargetRefresh(targetThreadId, 600, "message-submit");
					scheduleLivePollIfNeeded(1200);
					loadThreads({ silent: true }).catch(showError);
				} catch (err) {
					clearSubmittedMessageBottomFollow();
					if (!steering) {
						restoreThreadStatusSnapshot(previousThreadStatus);
						renderThreads();
					}
					const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err), err) || "发送失败，请重试";
					state.sendButtonHint = "重试";
					markSubmittedUserMessageFailed(targetThreadId, outboundText, submittedAttachments, clientSubmissionId, message);
					if (steering) setSteerFeedback("failed", {
						threadId: targetThreadId,
						turnId: steerTurnId,
						clientSubmissionId
					});
					else {
						$("connectionState").classList.remove("error");
						$("connectionState").textContent = "发送失败，详情见消息回执";
					}
					postClientEvent("send_failure", {
						threadId: targetThreadId || "",
						message,
						steering
					});
				} finally {
					finishSendProgressWatchdog();
					state.composerBusy = false;
					updateComposerControls();
				}
			}
			async function sendNewThreadMessage(text, hasContent, input) {
				if (!hasContent) return;
				const submittedDraftKey = currentDraftKey();
				const clientSubmissionId = createSubmissionId();
				const submittedModel = newThreadSelectedModel();
				const submittedEffort = newThreadSelectedEffort();
				const submittedPermissionMode = newThreadSelectedPermissionMode();
				const submittedTitle = String(state.newThreadTitle || "").trim();
				state.composerBusy = true;
				state.sendButtonHint = "";
				$("connectionState").classList.remove("error");
				$("connectionState").textContent = "正在创建新对话";
				markActivity("创建新对话");
				updateComposerControls();
				try {
					const submittedAttachments = state.pendingAttachments.slice();
					const body = new FormData();
					body.append("clientSubmissionId", clientSubmissionId);
					body.append("text", text);
					if (state.selectedCwd) body.append("cwd", state.selectedCwd);
					body.append("model", submittedModel);
					body.append("effort", submittedEffort);
					body.append("permissionMode", submittedPermissionMode);
					if (submittedTitle) body.append("title", submittedTitle);
					if (codexFastCommandEnabled()) body.append("fastMode", "1");
					for (const item of state.pendingAttachments) body.append("attachments", item.file, item.file.name || "upload");
					const result = await api("/api/threads/new-message", {
						method: "POST",
						body,
						timeoutMs: 18e4
					});
					const threadId = String(result && result.threadId || result && result.thread && result.thread.id || "");
					if (!threadId) throw new Error("新对话创建失败：未返回 threadId");
					commitPluginVoiceInputSessionsAfterSend(submittedDraftKey, text, {
						threadId,
						messageId: clientSubmissionId,
						composerId: "new-thread-composer"
					});
					registerSubmittedUserMessage(threadId, text, submittedAttachments, clientSubmissionId);
					const turnId = startedTurnId(result);
					const userItem = localUserMessageItem(text, submittedAttachments, clientSubmissionId);
					const thread = Object.assign({
						id: threadId,
						name: submittedTitle || "",
						preview: submittedTitle || text || "新建对话",
						cwd: result && result.thread && result.thread.cwd || state.selectedCwd || "",
						status: { type: "active" },
						turns: [],
						mobileInitialSubmissionId: clientSubmissionId
					}, result.thread || {});
					if (submittedTitle) {
						thread.name = submittedTitle;
						thread.preview = submittedTitle;
					}
					if (!thread.model && submittedModel) thread.model = submittedModel;
					if (!thread.effort && submittedEffort) thread.effort = submittedEffort;
					if (turnId) {
						const existingTurn = (thread.turns || []).find((turn) => turn && turn.id === turnId);
						if (existingTurn) existingTurn.items = mergeItemsPreservingLocalVisible([userItem], existingTurn.items || [], true);
						else thread.turns = (thread.turns || []).concat([{
							id: turnId,
							status: { type: "active" },
							startedAt: Math.floor(Date.now() / 1e3),
							completedAt: null,
							durationMs: null,
							items: [userItem]
						}]);
					}
					state.threads = [thread, ...state.threads.filter((entry) => entry.id !== threadId)];
					state.newThreadDraft = false;
					state.newThreadTitle = "";
					state.currentThreadId = threadId;
					state.currentThread = thread;
					state.activeTurnId = turnId || state.activeTurnId;
					state.composerModel = submittedModel || "";
					state.composerEffort = submittedEffort || "";
					state.composerPermissionMode = submittedPermissionMode || "";
					if (state.events) connectEvents();
					setComposerText("");
					clearPendingAttachments({ revokePreviewUrls: false });
					clearDraftForKey(submittedDraftKey);
					writeCurrentDraftToKey(draftKeyForThread(threadId));
					if (input) input.blur();
					renderComposerSettings();
					renderThreads();
					renderCurrentThread({ stickToBottom: true });
					scheduleSubmittedMessageDomProbe(threadId, clientSubmissionId, "new-thread-submit");
					try {
						await loadThread(threadId, { source: "new-thread" });
					} catch (err) {
						showError(err);
						renderThreads();
						renderCurrentThread({ stickToBottom: true });
					}
					$("connectionState").textContent = "新对话已创建";
					markActivity("新对话已创建");
					renderComposerSettings();
					updateComposerControls();
					scheduleCurrentThreadRefresh(900);
					scheduleLivePollIfNeeded(1200);
					loadThreads({ silent: true }).catch(showError);
				} catch (err) {
					const message = normalizeClientErrorMessage(err && err.message ? err.message : String(err), err) || "新对话创建失败，请重试";
					state.sendButtonHint = "重试";
					$("connectionState").classList.add("error");
					$("connectionState").textContent = message;
					postClientEvent("new_thread_send_failure", {
						cwd: state.selectedCwd || "",
						message
					});
				} finally {
					state.composerBusy = false;
					updateComposerControls();
				}
			}
			function requestComposerSubmitFromButton(event) {
				event.preventDefault();
				event.stopPropagation();
				const now = Date.now();
				if (now - state.lastSendButtonSubmitAt < 650) return;
				state.lastSendButtonSubmitAt = now;
				const button = $("sendMessage");
				if (!button || button.disabled || state.composerBusy) return;
				const composerForm = $("composer");
				try {
					if (composerForm && typeof composerForm.requestSubmit === "function") composerForm.requestSubmit();
					else sendMessage(event);
				} catch (err) {
					postClientEvent("send_button_submit_exception", {
						activeElement: document.activeElement ? document.activeElement.id || document.activeElement.tagName || "" : "",
						hasContent: composerHasContent(),
						buttonDisabled: button.disabled,
						error: String(err && err.message || "")
					});
					showError(/* @__PURE__ */ new Error("发送按钮点击异常，请改用回车发送"));
				}
				setTimeout(() => {
					if (state.lastSendSubmitStartedAt >= now) return;
					postClientEvent("send_button_no_submit", {
						activeElement: document.activeElement ? document.activeElement.id || document.activeElement.tagName || "" : "",
						hasContent: composerHasContent(),
						buttonDisabled: button.disabled,
						composerBusy: state.composerBusy
					});
					if (composerHasContent()) showError(/* @__PURE__ */ new Error("发送没触发，建议重试或按回车发送"));
				}, 1200);
			}
			function requestAttachmentPickerFromButton(event) {
				if (event && typeof event.preventDefault === "function") event.preventDefault();
				if (event && typeof event.stopPropagation === "function") event.stopPropagation();
				const now = Date.now();
				if (now - Number(state.lastAttachmentPickerAt || 0) < 650) return;
				const button = $("attachFiles");
				const input = $("fileInput");
				if (!button || !input || button.disabled || input.disabled || state.composerBusy) return;
				state.lastAttachmentPickerAt = now;
				try {
					if (!isAndroidBrowser() && typeof input.showPicker === "function") input.showPicker();
					else input.click();
				} catch (err) {
					postClientEvent("attachment_picker_click_exception", {
						activeElement: document.activeElement ? document.activeElement.id || document.activeElement.tagName || "" : "",
						buttonDisabled: Boolean(button.disabled),
						inputDisabled: Boolean(input.disabled),
						error: String(err && err.message || "")
					});
					showError(/* @__PURE__ */ new Error("附件选择器打开失败，请重试"));
				}
			}
			async function interruptActiveTurn(threadId = currentComposerThreadId(), activeTurnId = composerTargetActiveTurnId()) {
				const targetThreadId = String(threadId || "").trim();
				const targetActiveTurnId = String(activeTurnId || "").trim();
				if (!targetThreadId || !targetActiveTurnId) return;
				$("connectionState").classList.remove("error");
				$("connectionState").textContent = "Interrupt requested";
				markActivity("中断");
				await api(`/api/threads/${encodeURIComponent(targetThreadId)}/turns/${encodeURIComponent(targetActiveTurnId)}/interrupt`, { method: "POST" }).then(() => scheduleComposerTargetRefresh(targetThreadId, 900)).catch(showError);
			}
			return {
				updateComposerHeightVar,
				clearSendProgressWatchdog,
				startSendProgressWatchdog,
				finishSendProgressWatchdog,
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
				interruptActiveTurn
			};
		}
		const api = { createComposerRuntime };
		if (typeof module === "object" && module.exports) module.exports = api;
		root.CodexComposerRuntime = api;
	})(typeof globalThis !== "undefined" ? globalThis : window);
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
//#region \0virtual:codex-mobile-esm-compatibility/shard/shard-05
var import_media_preview_runtime = /* @__PURE__ */ __toESM(require_media_preview_runtime());
var import_composer_runtime = /* @__PURE__ */ __toESM(require_composer_runtime());
var import_composer_bridge_runtime = /* @__PURE__ */ __toESM(require_composer_bridge_runtime());
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
		"id": "composer-runtime",
		"source": "public/composer-runtime.js",
		"globalName": "CodexComposerRuntime",
		"expectedFunctions": ["createComposerRuntime"],
		"assetPath": "/composer-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 78244
	},
	{
		"id": "composer-bridge-runtime",
		"source": "public/composer-bridge-runtime.js",
		"globalName": "CodexComposerBridgeRuntime",
		"expectedFunctions": ["createComposerBridgeRuntime"],
		"assetPath": "/composer-bridge-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 32086
	}
];
var moduleApis = {
	"media-preview-runtime": import_media_preview_runtime.default,
	"composer-runtime": import_composer_runtime.default,
	"composer-bridge-runtime": import_composer_bridge_runtime.default
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
