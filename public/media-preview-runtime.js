"use strict";

(function attachMediaPreviewRuntime(root) {
function noop() {}
function noopFalse() { return false; }
function noopString() { return ""; }
function identity(value) { return value; }
function defaultRequestAnimationFrame(callback) {
  return typeof root.setTimeout === "function" ? root.setTimeout(callback, 16) : 0;
}
function defaultEscapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createMediaPreviewRuntime(deps = {}) {
  const state = deps.state || {};
  const $ = typeof deps.$ === "function" ? deps.$ : () => null;
  const document = deps.document || root.document || {};
  const window = deps.window || root.window || root;
  const fetch = typeof deps.fetch === "function"
    ? deps.fetch
    : (typeof root.fetch === "function" ? root.fetch.bind(root) : async () => { throw new Error("fetch unavailable"); });
  const FileReader = deps.FileReader || root.FileReader;
  const requestAnimationFrame = typeof deps.requestAnimationFrame === "function"
    ? deps.requestAnimationFrame
    : (typeof root.requestAnimationFrame === "function" ? root.requestAnimationFrame.bind(root) : defaultRequestAnimationFrame);
  const CLIENT_BUILD_ID = String(deps.CLIENT_BUILD_ID || "");
  const FILE_PREVIEW_SWIPE_CLOSE_MIN_PX = Number(deps.FILE_PREVIEW_SWIPE_CLOSE_MIN_PX || 62);
  const GITHUB_LINK_PREVIEW_TIMEOUT_MS = Number(deps.GITHUB_LINK_PREVIEW_TIMEOUT_MS || 12000);
  const IMAGE_DIAGNOSTICS_ENABLED = deps.IMAGE_DIAGNOSTICS_ENABLED === true;
  const IMAGE_PREVIEW_MAX_SCALE = Number(deps.IMAGE_PREVIEW_MAX_SCALE || 4);
  const IMAGE_PREVIEW_MIN_SCALE = Number(deps.IMAGE_PREVIEW_MIN_SCALE || 0.5);
  const IMAGE_PREVIEW_ZOOM_STEP = Number(deps.IMAGE_PREVIEW_ZOOM_STEP || 0.25);
  const MERMAID_MAX_SCALE = Number(deps.MERMAID_MAX_SCALE || 3.2);
  const MERMAID_MIN_SCALE = Number(deps.MERMAID_MIN_SCALE || 0.65);
  const MERMAID_SCRIPT_URL = String(deps.MERMAID_SCRIPT_URL || "/vendor/mermaid.min.js");
  const MERMAID_ZOOM_STEP = Number(deps.MERMAID_ZOOM_STEP || 0.2);
  const PERF_EVENT_THROTTLE_MS = Number(deps.PERF_EVENT_THROTTLE_MS || 2000);
  const PROTECTED_IMAGE_PLACEHOLDER_SRC = String(deps.PROTECTED_IMAGE_PLACEHOLDER_SRC || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==");
  const githubLinkPreviewCache = deps.githubLinkPreviewCache || new Map();
  const {
    api = async () => ({}),
    compactStructuredForSignature = (value) => JSON.stringify(value),
    copyButtonHtml = noopString,
    diagnosticItemHash = (value) => String(value || ""),
    escapeHtml = defaultEscapeHtml,
    isHermesEmbedMode = noopFalse,
    isIosWebKitBrowser = noopFalse,
    normalizeFsPath = (value) => String(value || "").replace(/\\/g, "\\"),
    nowPerfMs = () => Date.now(),
    postPerformanceEvent = noop,
    primaryTouch = (event) => event && event.touches && event.touches[0] || null,
    publishPluginNavigationState = noop,
    recordHomeAiDiagnosticFailure = noop,
    recordHomeAiDiagnosticSuccess = noop,
    rememberCopyText = (value) => String(value || ""),
    renderContextThreadId = noopString,
    requestHermesPluginRefresh = noop,
    roundedDurationMs = (startedAt) => Math.max(0, Date.now() - Number(startedAt || Date.now())),
    shortPath = (value) => String(value || ""),
    stableTextHash = (value) => String(value || ""),
    truncateSingleLine = (value) => String(value || ""),
    visibleThreadTaskCardCommandText = (value) => String(value || ""),
  } = deps;

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
  if (!markerMatch) return { text: source, attachments: [] };
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
  const visibleText = [before, after].filter(Boolean).join(before && after ? "\n\n" : "");
  return { text: visibleText, attachments };
}

function parseAttachmentLine(line) {
  const match = /^-\s*(.*?)\s*\((.*?)\):\s*(.+)$/.exec(String(line || ""));
  if (!match) return null;
  const meta = match[2] || "";
  return {
    name: match[1] || "attachment",
    meta,
    path: (match[3] || "").trim(),
    isImage: /\bimage\b/i.test(meta),
  };
}

function codexMobileUploadIdForPath(filePath) {
  const text = String(filePath || "")
    .trim()
    .replace(/^\\\\\?\\/, "")
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");
  if (!text) return "";
  const marker = "/.codex-mobile-web/uploads/";
  const index = text.toLowerCase().indexOf(marker);
  if (index < 0) return "";
  const id = text.slice(index + marker.length).replace(/^\/+/, "");
  if (!id || /^[a-zA-Z]:/.test(id) || id.split("/").some((part) => !part || part === "." || part === "..")) return "";
  return id;
}

function uploadFileUrl(filePath) {
  const uploadId = codexMobileUploadIdForPath(filePath);
  const params = uploadId
    ? new URLSearchParams({ id: uploadId })
    : new URLSearchParams({ path: filePath });
  if (state.key) params.set("key", state.key);
  return authenticatedApiContentUrl(`/api/uploads/file?${params.toString()}`);
}

function isCodexMobileUploadPath(filePath) {
  const normalized = normalizeFsPath(filePath);
  return normalized.includes("\\.codex-mobile-web\\uploads\\");
}

function imageContentUrlForPath(filePath, options = {}) {
  if (!filePath) return "";
  return isCodexMobileUploadPath(filePath) ? uploadFileUrl(filePath) : localFilePreviewContentUrl(filePath, options);
}

function localAttachmentPreviewUrl(attachment) {
  const value = String((attachment && (attachment.previewUrl || attachment.objectUrl || attachment.localUrl)) || "").trim();
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
  return value.startsWith("[Cross-thread task card sent by source thread]")
    || value.startsWith("[Cross-thread task card approved]")
    || value.startsWith("[Codex Mobile task-card continuation]")
    || /^#\s*Continuation Bootstrap Index\b/i.test(value);
}

function injectedThreadTaskCardLineValue(lines, label) {
  const pattern = new RegExp(`^\\s*(?:[-*]\\s*)?${label}:\\s*`, "i");
  const line = (Array.isArray(lines) ? lines : []).find((entry) => pattern.test(entry));
  return line ? line.replace(pattern, "").trim() : "";
}

function injectedThreadTaskCardPurpose(lines) {
  const firstLine = String(Array.isArray(lines) ? lines[0] || "" : "").trim();
  if (/^#\s*Continuation Bootstrap Index\b/i.test(firstLine)) return "Continuation Bootstrap Index";
  if (/^\[Codex Mobile task-card continuation\]/i.test(firstLine)) {
    const title = injectedThreadTaskCardLineValue(lines, "Title");
    return title || "Task-card continuation";
  }
  const title = injectedThreadTaskCardLineValue(lines, "Title");
  if (title) return title;
  const bodyLine = (Array.isArray(lines) ? lines : []).find((line) => {
    const text = String(line || "").trim();
    return text
      && !text.startsWith("[Cross-thread task card")
      && !text.startsWith("[Codex Mobile task-card continuation]")
      && !/^#\s*Continuation Bootstrap Index\b/i.test(text)
      && !/^(?:[-*]\s*)?(Source workspace|Source thread|Source thread id|Source thread title|Approval|Workflow mode|Workflow id|Auto-return|Continuation Target|Source Thread|Workspace Context Files):/i.test(text);
  });
  return bodyLine ? bodyLine.replace(/^#+\s*/, "").trim() : "Cross-thread task card";
}

function injectedThreadTaskCardMetadata(text) {
  const value = String(text || "").replace(/\r\n?/g, "\n").trim();
  const lines = value.split("\n");
  const source = injectedThreadTaskCardLineValue(lines, "Source thread")
    || injectedThreadTaskCardLineValue(lines, "Source thread title")
    || injectedThreadTaskCardLineValue(lines, "Source thread id")
    || (/^#\s*Continuation Bootstrap Index\b/i.test(value) ? "Continuation" : "source thread");
  return {
    value,
    source,
    purpose: injectedThreadTaskCardPurpose(lines),
    charCount: value.length.toLocaleString(),
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
  const label = (attachment && attachment.name) || shortPath(part.path || imageUrlValue(part) || "") || `Image ${index + 1}`;
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
  const renderedImageAttachments = new Set();
  if (!parts.length) {
    imageAttachments
      .filter(canRenderImageAttachment)
      .forEach((attachment, index) => {
        renderedImageAttachments.add(attachment);
        html.push(renderInputImage({ path: attachment.path }, attachment, index));
      });
  }
  (attachments || [])
    .filter((attachment) => !renderedImageAttachments.has(attachment) && (!attachment.isImage || !parts.length))
    .forEach((attachment) => html.push(renderInputAttachment(attachment)));
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
  if (!renderer || typeof renderer.renderMarkdown !== "function") {
    return `<div class="markdown-body"><p>${escapeHtml(value || "")}</p></div>`;
  }
  return renderer.renderMarkdown(value, {
    rememberCopyText,
    copyButtonHtml,
    ...markdownOptions,
  });
}

function renderMarkdownWithAttachmentSummary(value) {
  const split = splitAttachmentSummaryText(value || "");
  if (!split.attachments.length) return renderMarkdown(value || "", { fencedTableMode: "preview" });
  return [
    split.text ? renderMarkdown(split.text, { fencedTableMode: "preview" }) : "",
    renderAttachmentSummary(split.attachments),
  ].filter(Boolean).join("");
}

function commandOutputBody(value) {
  const text = String(value || "").replace(/\r\n?/g, "\n").trim();
  if (!text) return "";
  const marker = "\nOutput:\n";
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return text;
  return text.slice(markerIndex + marker.length).trim();
}

function stripCommandOutputLineNumbers(value) {
  const text = String(value || "");
  if (!text) return "";
  const lines = text.split("\n");
  const numberedCount = lines.filter((line) => /^\s*\d+\t/.test(line)).length;
  if (numberedCount < 3 || numberedCount < Math.ceil(lines.length * 0.4)) return text;
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
    stateLabel: String(preview.stateLabel || "").trim(),
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
  if (accent === "open" || accent === "closed" || accent === "merged" || accent === "repo" || accent === "commit" || accent === "muted") {
    return accent;
  }
  return "muted";
}

function renderGitHubLinkPreviewCard(preview) {
  const accent = gitHubLinkPreviewAccentClass(preview && preview.accent);
  const statePill = preview && preview.stateLabel
    ? `<span class="github-link-card-state state-${escapeHtml(gitHubLinkPreviewAccentClass(preview.state || accent))}">${escapeHtml(preview.stateLabel)}</span>`
    : "";
  const avatar = preview && preview.avatarUrl
    ? `<img class="github-link-card-avatar" src="${escapeHtml(preview.avatarUrl)}" alt="" loading="lazy">`
    : `<span class="github-link-card-avatar github-link-card-avatar-fallback" aria-hidden="true">GH</span>`;
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
  const promise = api(`/api/link-previews/github?url=${encodeURIComponent(cacheKey)}`, {
    timeoutMs: GITHUB_LINK_PREVIEW_TIMEOUT_MS,
  })
    .then((value) => {
      const preview = normalizeGitHubLinkPreview(value);
      githubLinkPreviewCache.set(cacheKey, { value: preview });
      return preview;
    })
    .catch((err) => {
      githubLinkPreviewCache.delete(cacheKey);
      throw err;
    });
  githubLinkPreviewCache.set(cacheKey, { promise });
  return promise;
}

function githubLinkPreviewHosts(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") return [];
  const hosts = [];
  const seen = new Set();
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
    return { repo: "GitHub", detail: "链接" };
  }
  const parts = parsed.pathname.split("/").filter(Boolean);
  const repo = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : "GitHub";
  let detail = "Repository";
  if (parts[2] === "issues" && parts[3]) detail = parsed.hash.startsWith("#issuecomment-") ? `#${parts[3]} comment` : `Issue #${parts[3]}`;
  else if (parts[2] === "pull" && parts[3]) detail = `PR #${parts[3]}`;
  else if (parts[2] === "commit" && parts[3]) detail = `Commit ${parts[3].slice(0, 7)}`;
  return { repo, detail };
}

function gitHubLinkPreviewInlineHost(link) {
  if (!link || typeof link.closest !== "function") return null;
  return link.closest("li, td, th, p");
}

function gitHubLinkPreviewInsertContainer(inlineHost) {
  if (!inlineHost) return null;
  if (inlineHost.tagName !== "P") return inlineHost;
  const next = inlineHost.nextElementSibling;
  if (next && next.matches && next.matches('[data-github-link-preview-node="true"]')) return next;
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
  const safeUrl = normalizeGithubPreviewUrl(url);
  const href = safeUrl || String(url || "").trim();
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
  const kind = preview.kindLabel ? `${preview.kindLabel} · ` : "";
  title.textContent = `${kind}${preview.title}`;
}

function toggleGitHubLinkPreview(button) {
  const wrapper = button && button.closest ? button.closest("[data-github-link-preview-inline]") : null;
  if (!wrapper) return;
  const slot = wrapper.querySelector(".github-link-card-shell[data-github-link-preview-url]");
  if (!slot) return;
  const expanded = wrapper.dataset.githubLinkPreviewExpanded === "true";
  if (expanded) {
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
  const slots = Array.from(root.querySelectorAll('[data-github-link-preview-url]:not([data-github-link-preview-deferred="true"])'));
  slots.forEach((slot) => {
    hydrateGitHubLinkCard(slot).catch(() => {});
  });
  const inlineCount = root.querySelectorAll("[data-github-link-preview-inline='true']").length;
  if (slots.length || inlineCount) {
    postPerformanceEvent("github_cards_hydrate_ms", {
      hydrateElapsedMs: roundedDurationMs(startedAt),
      queuedCards: slots.length,
      inlineCards: inlineCount,
      rootId: root && root.id || "",
      threadId: state.currentThreadId || "",
    }, {
      key: `github_cards_hydrate_ms|${root && root.id || "root"}`,
      minIntervalMs: PERF_EVENT_THROTTLE_MS,
    });
  }
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
      htmlLabels: true,
    },
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
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.runtimeScript = src;
    script.onload = () => resolve(globalName ? window[globalName] : true);
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
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
  if (window.mermaid && typeof window.mermaid.render === "function") {
    return configureMermaidApi(window.mermaid, { force: !state.mermaidTheme });
  }
  if (state.mermaidLoadPromise) return state.mermaidLoadPromise;
  state.mermaidLoadPromise = loadRuntimeScript(MERMAID_SCRIPT_URL, "mermaid")
    .then((mermaidApi) => {
      if (!mermaidApi || typeof mermaidApi.render !== "function") {
        throw new Error("Mermaid runtime unavailable");
      }
      return configureMermaidApi(mermaidApi, { force: true });
    })
    .catch((err) => {
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
  if (!svg) return { width: 640, height: 360 };
  const viewBox = svg.viewBox && svg.viewBox.baseVal;
  const width = Number((viewBox && viewBox.width) || svg.getAttribute("width") || 0);
  const height = Number((viewBox && viewBox.height) || svg.getAttribute("height") || 0);
  return {
    width: width > 0 ? width : 640,
    height: height > 0 ? height : 360,
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
  const hasAnchor = options.viewer
    && Number.isFinite(options.anchorX)
    && Number.isFinite(options.anchorY)
    && Number.isFinite(options.contentX)
    && Number.isFinite(options.contentY);
  if (hasAnchor && previousScale > 0 && nextScale > 0) {
    requestAnimationFrame(() => {
      options.viewer.scrollLeft = Math.max(0, options.contentX * nextScale - options.anchorX);
      options.viewer.scrollTop = Math.max(0, options.contentY * nextScale - options.anchorY);
    });
  }
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
  if (previewSource && mermaidPreviewOpen() && container === $("mermaidPreviewDialog")) {
    previewSource.textContent = sourceText || "";
  }
}

function isMermaidErrorSvgMarkup(svgMarkup) {
  const text = String(svgMarkup || "");
  return /class=["'][^"']*\berror-icon\b/.test(text)
    || /class=["'][^"']*\berror-text\b/.test(text)
    || /Syntax error in text/.test(text);
}

function mermaidRenderArtifactIds(renderId) {
  const id = String(renderId || "").trim();
  return id ? [id, `d${id}`, `i${id}`] : [];
}

function isOwnedMermaidRenderNode(node) {
  return Boolean(node && node.closest && (
    node.closest("[data-mermaid-block='true']")
    || node.closest("#mermaidPreviewDialog")
    || node.closest(".markdown-mermaid-artboard")
  ));
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
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll("svg .error-icon, svg .error-text").forEach((node) => {
    const svg = node.closest && node.closest("svg");
    const container = svg && svg.parentElement && /^d?codex-mobile-mermaid-/.test(String(svg.parentElement.id || ""))
      ? svg.parentElement
      : svg;
    removeNodeIfExternalMermaidArtifact(container);
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
    if (previewSource && container === $("mermaidPreviewDialog")) {
      previewSource.textContent = options.sourceText;
    }
  }
}

function mermaidRenderCandidates(sourceText) {
  const raw = String(sourceText || "");
  const normalizer = window.CodexMarkdownRenderer && typeof window.CodexMarkdownRenderer.normalizeMermaidSourceForRender === "function"
    ? window.CodexMarkdownRenderer.normalizeMermaidSourceForRender
    : null;
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
  throw lastError || new Error("Mermaid render failed");
}

function hydrateMermaidBlock(block) {
  const sourceText = mermaidSourceFromContainer(block).trim();
  if (!block || !sourceText) return;
  const currentTheme = mermaidThemeName();
  if (block.dataset.mermaidRendered === "1" && block.dataset.mermaidTheme === currentTheme) return;
  const startedAt = nowPerfMs();
  renderMermaidIntoContainer(block, sourceText)
    .then(() => {
      if (!block.isConnected) return;
      block.dataset.mermaidRendered = "1";
      block.dataset.mermaidTheme = currentTheme;
      postPerformanceEvent("mermaid_hydrate_ms", {
        hydrateElapsedMs: roundedDurationMs(startedAt),
        sourceChars: sourceText.length,
        theme: currentTheme,
        status: "ok",
        threadId: state.currentThreadId || "",
      }, {
        key: "mermaid_hydrate_ms",
        minIntervalMs: PERF_EVENT_THROTTLE_MS,
      });
    })
    .catch((err) => {
      block.dataset.mermaidRendered = "error";
      showMermaidError(block, sourceText, err);
      postPerformanceEvent("mermaid_hydrate_ms", {
        hydrateElapsedMs: roundedDurationMs(startedAt),
        sourceChars: sourceText.length,
        theme: currentTheme,
        status: "error",
        error: err && err.message ? String(err.message).slice(0, 240) : String(err || "").slice(0, 240),
        threadId: state.currentThreadId || "",
      }, {
        key: "mermaid_hydrate_ms",
        minIntervalMs: PERF_EVENT_THROTTLE_MS,
        force: true,
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
    renderMermaidIntoContainer(dialog, mermaidSourceFromContainer(dialog), { loadingMessage: "正在更新 Mermaid 图..." })
      .catch((err) => showMermaidError(dialog, mermaidSourceFromContainer(dialog), err));
  }
}

function installMermaidThemeObserver() {
  if (state.mermaidThemeObserver || !window.MutationObserver) return;
  const observer = new MutationObserver(() => {
    if (state.mermaidTheme && state.mermaidTheme === mermaidThemeName()) return;
    rerenderVisibleMermaidDiagrams();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
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
  const baseWidth = Number(artboard.dataset.baseWidth || 0) || 640;
  applyMermaidScale(container, mermaidInitialScale(container, baseWidth));
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
  renderMermaidIntoContainer(dialog, sourceText, { loadingMessage: "正在渲染 Mermaid 图..." })
    .catch((err) => showMermaidError(dialog, sourceText, err));
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
  const hasAnchor = Number.isFinite(options.anchorX) && Number.isFinite(options.anchorY)
    && Number.isFinite(options.contentX) && Number.isFinite(options.contentY);
  const keepCenter = !hasAnchor && options.keepCenter !== false && previousScale > 0 && nextScale > 0;
  const centerX = keepCenter ? (stage.scrollLeft + stage.clientWidth / 2) / previousScale : 0;
  const centerY = keepCenter ? (stage.scrollTop + stage.clientHeight / 2) / previousScale : 0;
  state.imagePreviewScale = nextScale;
  dialog.style.setProperty("--image-preview-scale", String(nextScale));
  const reset = $("imagePreviewZoomReset");
  if (reset) reset.textContent = imagePreviewScaleLabel(nextScale);
  if (hasAnchor && previousScale > 0 && nextScale > 0) {
    requestAnimationFrame(() => {
      stage.scrollLeft = Math.max(0, options.contentX * nextScale - options.anchorX);
      stage.scrollTop = Math.max(0, options.contentY * nextScale - options.anchorY);
    });
  } else if (keepCenter) {
    requestAnimationFrame(() => {
      stage.scrollLeft = Math.max(0, centerX * nextScale - stage.clientWidth / 2);
      stage.scrollTop = Math.max(0, centerY * nextScale - stage.clientHeight / 2);
    });
  }
}

function imagePreviewTitleForImage(image) {
  if (!image) return "图片预览";
  const figure = image.closest ? image.closest("figure, .file-preview-media, .attachment-chip") : null;
  const caption = figure && figure.querySelector ? figure.querySelector("figcaption") : null;
  const text = [
    caption && caption.textContent,
    image.getAttribute && image.getAttribute("alt"),
    image.getAttribute && image.getAttribute("title"),
  ].map((value) => String(value || "").trim()).find(Boolean);
  return text || "图片预览";
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
  const image = event && event.target && event.target.closest
    ? event.target.closest(".input-image img, .image-view img, .markdown-image img, .file-preview-image, .attachment-thumb")
    : null;
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
    y: (Number(touchA && touchA.clientY || 0) + Number(touchB && touchB.clientY || 0)) / 2,
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
  const startScale = Math.max(0.01, Number(scale) || 1);
  const anchorX = center.x - rect.left;
  const anchorY = center.y - rect.top;
  return {
    distance,
    scale: startScale,
    scroller,
    contentX: (scroller.scrollLeft + anchorX) / startScale,
    contentY: (scroller.scrollTop + anchorY) / startScale,
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
    contentY: pinch.contentY,
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
  closeFilePreviewHtmlFullscreen();
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
    moved: false,
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
  if (dx >= FILE_PREVIEW_SWIPE_CLOSE_MIN_PX && Math.abs(dy) <= Math.abs(dx) * 0.85) closeFilePreview();
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
  const pathValue = String(pathname || "");
  const match = pathValue.match(/^(\/api\/hermes-plugins\/[^/]+\/proxy)(?:\/|$)/);
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
  if (
    pathValue === "/api/generated-images/file"
    || pathValue === "/api/uploads/file"
    || pathValue === "/api/files/preview/content"
  ) {
    return pathValue;
  }
  const match = pathValue.match(/^\/api\/hermes-plugins\/[^/]+\/proxy(\/api\/(?:generated-images\/file|uploads\/file|files\/preview\/content))$/);
  return match ? match[1] : "";
}

function browserApiContentUrl(value) {
  const raw = String(value || "");
  if (!raw) return "";
  try {
    const origin = typeof window !== "undefined" && window.location && window.location.origin
      ? window.location.origin
      : "http://127.0.0.1";
    const parsed = new URL(raw, origin);
    if (parsed.origin !== origin) return raw;
    const pathValue = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    const proxyPrefix = hermesPluginProxyPrefix();
    if (
      proxyPrefix
      && parsed.pathname.startsWith("/api/")
      && !parsed.pathname.startsWith(`${proxyPrefix}/`)
    ) {
      return `${proxyPrefix}${pathValue}`;
    }
    return pathValue;
  } catch (_) {
    return raw;
  }
}

function authenticatedApiContentUrl(value) {
  const raw = String(value || "");
  if (!raw) return "";
  try {
    const origin = typeof window !== "undefined" && window.location && window.location.origin
      ? window.location.origin
      : "http://127.0.0.1";
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
    path: String(filePath),
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
    if (ch === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      if (rows.length >= 50) break;
    } else {
      cell += ch;
    }
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
  const headHtml = head.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("");
  const bodyHtml = bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  return `<div class="file-preview-table-wrap"><table class="file-preview-table"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
}

function renderFilePreviewSource(content) {
  return `<pre class="file-preview-text"><code>${escapeHtml(content)}</code></pre>`;
}

function renderHtmlFilePreview(file, options = {}) {
  const content = String((file && file.content) || "");
  const src = filePreviewContentUrl(file, options);
  const title = file && file.fileName ? file.fileName : "HTML preview";
  return `<div class="file-preview-html" data-file-preview-html>
    <div class="file-preview-html-toolbar" role="group" aria-label="HTML 预览模式">
      <button class="file-preview-html-tab is-active" type="button" data-file-preview-html-view="render" aria-pressed="true">页面</button>
      <button class="file-preview-html-tab" type="button" data-file-preview-html-view="source" aria-pressed="false">源码</button>
      <span class="file-preview-html-toolbar-spacer" aria-hidden="true"></span>
      <button class="file-preview-html-tool" type="button" data-file-preview-html-fullscreen aria-label="全屏预览 HTML" title="全屏预览">全屏</button>
    </div>
    <div class="file-preview-html-pane" data-file-preview-html-pane="render">
      <iframe class="file-preview-html-frame" sandbox="allow-scripts" referrerpolicy="no-referrer" src="${escapeHtml(src)}" title="${escapeHtml(title)}"></iframe>
    </div>
    <div class="file-preview-html-pane" data-file-preview-html-pane="source" hidden>${renderFilePreviewSource(content)}</div>
  </div>`;
}

function setFilePreviewHtmlView(root, view, activeButton = null) {
  if (!root || view !== "render" && view !== "source") return false;
  root.querySelectorAll("[data-file-preview-html-view]").forEach((entry) => {
    const selected = activeButton ? entry === activeButton : entry.getAttribute("data-file-preview-html-view") === view;
    entry.classList.toggle("is-active", selected);
    entry.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  root.querySelectorAll("[data-file-preview-html-pane]").forEach((pane) => {
    pane.hidden = pane.getAttribute("data-file-preview-html-pane") !== view;
  });
  return true;
}

function handleFilePreviewHtmlViewClick(button) {
  const view = button && button.dataset ? String(button.dataset.filePreviewHtmlView || "") : "";
  const root = button && typeof button.closest === "function" ? button.closest("[data-file-preview-html]") : null;
  return setFilePreviewHtmlView(root, view, button);
}

function setFilePreviewHtmlFullscreen(root, fullscreen) {
  if (!root || !root.classList) return false;
  root.classList.toggle("is-fullscreen", fullscreen);
  const documentElement = document && document.documentElement;
  if (documentElement && documentElement.classList) {
    documentElement.classList.toggle("file-preview-html-fullscreen-open", fullscreen);
  }
  const button = typeof root.querySelector === "function" ? root.querySelector("[data-file-preview-html-fullscreen]") : null;
  if (button) {
    button.textContent = fullscreen ? "退出全屏" : "全屏";
    button.setAttribute("aria-label", fullscreen ? "退出 HTML 全屏预览" : "全屏预览 HTML");
    button.setAttribute("title", fullscreen ? "退出全屏" : "全屏预览");
  }
  if (fullscreen) {
    const renderButton = typeof root.querySelector === "function" ? root.querySelector("[data-file-preview-html-view=\"render\"]") : null;
    setFilePreviewHtmlView(root, "render", renderButton);
  }
  return true;
}

function handleFilePreviewHtmlFullscreenClick(button) {
  const root = button && typeof button.closest === "function" ? button.closest("[data-file-preview-html]") : null;
  if (!root || !root.classList) return false;
  return setFilePreviewHtmlFullscreen(root, !root.classList.contains("is-fullscreen"));
}

function closeFilePreviewHtmlFullscreen() {
  const root = document && typeof document.querySelector === "function"
    ? document.querySelector("[data-file-preview-html].is-fullscreen")
    : null;
  if (!root) return false;
  return setFilePreviewHtmlFullscreen(root, false);
}

function renderFilePreviewContent(file, options = {}) {
  const content = String((file && file.content) || "");
  if (file && file.kind === "markdown") return renderMarkdown(content, { orderedListMode: "source" });
  if (file && file.kind === "html") return renderHtmlFilePreview(file, options);
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
  return renderFilePreviewSource(content);
}

function imageViewPath(item) {
  return String((item && (
    item.path
    || item.filePath
    || item.file_path
    || item.imagePath
    || item.image_path
    || item.savedPath
    || item.saved_path
    || item.sourcePath
    || item.source_path
    || item.arguments && (item.arguments.path || item.arguments.filePath || item.arguments.imagePath || item.arguments.savedPath)
    || item.result && (item.result.path || item.result.filePath || item.result.imagePath || item.result.savedPath)
  )) || "");
}

function imageViewUrl(item) {
  const raw = item && (
    item.url
    || item.imageUrl
    || item.image_url
    || item.arguments && (item.arguments.url || item.arguments.imageUrl || item.arguments.image_url)
    || item.result && (item.result.url || item.result.imageUrl || item.result.image_url)
  );
  const value = raw && typeof raw === "object" ? raw.url || raw.uri || raw.href : raw;
  return String(value || "");
}

function imageViewContentUrl(item) {
  return String((item && (
    item.contentUrl
    || item.content_url
    || item.result && (item.result.contentUrl || item.result.content_url)
  )) || "");
}

function safeImageViewApiUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const origin = typeof window !== "undefined" && window.location && window.location.origin
      ? window.location.origin
      : "http://127.0.0.1";
    const parsed = new URL(raw, origin);
    if (parsed.origin === origin && protectedImageUpstreamPathname(parsed.pathname)) {
      return authenticatedApiContentUrl(`${parsed.pathname}${parsed.search}${parsed.hash}`);
    }
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
  return Boolean(item && (
    item.imageUnavailable
    || item.unavailable
    || item.generatedImage && item.generatedImage.unavailable
  ));
}

function renderImageView(item) {
  const filePath = imageViewPath(item);
  const contentUrl = imageViewContentUrl(item);
  const url = imageViewUrl(item);
  const src = contentUrl
    ? safeImageViewApiUrl(contentUrl)
    : (filePath && isLikelyAbsoluteLocalPath(filePath)
      ? imageContentUrlForPath(filePath, { threadId: renderContextThreadId() })
      : safeImageViewFallbackUrl(url));
  const label = shortPath(filePath || item.label || item.fileName || item.file_name || item.caption || url || item.id || "image");
  if (isImageViewUnavailable(item)) {
    return `<figure class="image-view image-load-failed"></figure>`;
  }
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
      evidence_confidence: 0.72,
      error_code: "image_render_failed",
      context: {
        surface: "media-render",
        action: "image-load",
        source_kind: details.sourceKind || "",
        item_hash: diagnosticItemHash(details.sourceHash || ""),
      },
      counts: {
        recovery_count: details.recoveryCount,
        natural_width: details.naturalWidth,
        natural_height: details.naturalHeight,
      },
      breadcrumbs: [{
        kind: "media-render",
        code: "image-load",
        status: "failed",
        fields: {
          source_kind: details.sourceKind || "",
          item_hash: diagnosticItemHash(details.sourceHash || ""),
        },
      }],
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
        item_hash: diagnosticItemHash(details.sourceHash || ""),
      },
    });
  }
  clearFailedAppImage(image);
}

function failedAppImageContainer(image) {
  return image && image.closest
    ? image.closest(".input-image, .image-view, .markdown-image, .attachment-chip, .file-preview-media, figure")
    : null;
}

function setRetryingAppImage(image, active) {
  if (!image) return false;
  const container = failedAppImageContainer(image);
  if (container && container.classList && typeof container.classList.toggle === "function") {
    container.classList.toggle("image-load-retrying", Boolean(active));
  }
  if (image.classList && typeof image.classList.toggle === "function") {
    image.classList.toggle("image-load-retrying", Boolean(active));
  }
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
  if (image.getAttribute && image.getAttribute("aria-hidden") === "true") {
    image.removeAttribute("aria-hidden");
  }
  return true;
}

function imageHadExplicitLoadError(image) {
  return Boolean(image && image.dataset && image.dataset.imageLoadError === "1");
}

function isLazyAppImage(image) {
  if (!image) return false;
  const value = String((image.getAttribute && image.getAttribute("loading")) || image.loading || "").trim().toLowerCase();
  return value === "lazy";
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
    if (parsed.origin === window.location.origin && protectedImageUpstreamPathname(parsed.pathname)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch (_) {}
  return "";
}

function imageLoadingModeForSource(src) {
  return protectedGeneratedImageSrc(src) ? "eager" : "lazy";
}

function shouldRenderProtectedImageDirectly(src) {
  const protectedSrc = protectedGeneratedImageSrc(src);
  if (!protectedSrc) return false;
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
  return protectedGeneratedImageSrc(image && (
    image.currentSrc
    || image.src
    || (image.getAttribute && image.getAttribute("src"))
  ));
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
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (/key|token|secret|password|cookie/i.test(key)) parsed.searchParams.set(key, "REDACTED");
    }
    return stableTextHash(`${parsed.origin}${parsed.pathname}?${parsed.searchParams.toString()}`);
  } catch (_) {
    return stableTextHash(raw.slice(0, 200));
  }
}

function imageDiagnosticDetails(image, phase, extra = {}) {
  const src = image && (
    (image.currentSrc || "")
    || (image.src || "")
    || (image.getAttribute && image.getAttribute("src"))
    || ""
  );
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
    alt: shortPath(String((image && image.alt) || "").trim()).slice(0, 96),
    complete: Boolean(image && image.complete),
    naturalWidth: Number(image && image.naturalWidth || 0),
    naturalHeight: Number(image && image.naturalHeight || 0),
    failedClass: Boolean(container && container.classList && container.classList.contains("image-load-failed")),
    recoveryCount: Number(image && image.dataset && image.dataset.protectedImageRecoveryCount || 0),
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
    details.alt || "",
  ].join("|");
  postPerformanceEvent(`image_${phase}`, details, {
    key,
    minIntervalMs: Number(options.minIntervalMs || 8000),
    force: Boolean(options.force),
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
  if (urlApi && typeof urlApi.revokeObjectURL === "function" && /^blob:/i.test(objectUrl)) {
    try {
      urlApi.revokeObjectURL(objectUrl);
    } catch (_) {}
  }
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
  return isHermesEmbedMode() || (typeof isIosWebKitBrowser === "function" && isIosWebKitBrowser());
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
  if (!response) return { url: "", objectUrl: false };
  if (shouldRecoverProtectedImageAsDirectUrl()) {
    const directUrl = cacheBustedProtectedImageSrc(src, "_imgRecover");
    if (directUrl) return { url: directUrl, objectUrl: false, directUrl: true };
  }
  if (typeof response.blob !== "function") return { url: "", objectUrl: false };
  const blob = await response.blob().catch(() => null);
  if (!blob) return { url: "", objectUrl: false };
  const type = String(blob.type || "").trim();
  if (type && !/^image\//i.test(type)) return { url: "", objectUrl: false };
  const size = Number(blob.size || 0);
  if (!size || size <= 8 * 1024 * 1024) {
    const dataUrl = await blobToDataUrl(blob);
    if (dataUrl) return { url: dataUrl, objectUrl: false };
  }
  const urlApi = protectedAppImageUrlApi();
  if (urlApi && typeof urlApi.createObjectURL === "function") {
    const type = String(blob.type || "").trim();
    if (type && !/^image\//i.test(type)) return { url: "", objectUrl: false };
    return { url: urlApi.createObjectURL(blob), objectUrl: true };
  }
  return { url: "", objectUrl: false };
}

function applyProtectedAppImageRecoveredUrl(image, recovered) {
  const url = String((recovered && recovered.url) || "");
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
    cache: "no-store",
  }).then(async (response) => {
    if (!imageStillConnected(image)) return;
    if (image.dataset) delete image.dataset.protectedImageHydrating;
    if (!response || !response.ok) {
      if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("hydrate_response", image, {
        status: response && response.status || 0,
        ok: false,
      }, { force: true });
      return;
    }
    const recovered = await protectedAppImageRecoveredUrl(response, src);
    if (!imageStillConnected(image)) {
      if (recovered && recovered.objectUrl && recovered.url) {
        const urlApi = protectedAppImageUrlApi();
        if (urlApi && typeof urlApi.revokeObjectURL === "function") {
          try {
            urlApi.revokeObjectURL(recovered.url);
          } catch (_) {}
        }
      }
      return;
    }
    if (applyProtectedAppImageRecoveredUrl(image, recovered)) {
      image.dataset.protectedImageHydrated = "1";
      clearFailedAppImage(image);
      if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("hydrate_apply", image, {
        recoveredKind: imageDiagnosticSourceKind(recovered && recovered.url),
        objectUrl: Boolean(recovered && recovered.objectUrl),
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
    cache: "no-store",
  }).then(async (response) => {
    if (!imageStillConnected(image)) return;
    if (image.dataset) delete image.dataset.imageLoadProbe;
    if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("recovery_response", image, {
      status: response && response.status || 0,
      ok: Boolean(response && response.ok),
      contentType: response && response.headers && response.headers.get ? String(response.headers.get("content-type") || "").slice(0, 80) : "",
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
          if (urlApi && typeof urlApi.revokeObjectURL === "function") {
            try {
              urlApi.revokeObjectURL(recovered.url);
            } catch (_) {}
          }
        }
        return;
      }
      if (applyProtectedAppImageRecoveredUrl(image, recovered)) {
        if (typeof postImageDiagnosticEvent === "function") postImageDiagnosticEvent("recovery_apply", image, {
          recoveredKind: imageDiagnosticSourceKind(recovered && recovered.url),
          objectUrl: Boolean(recovered && recovered.objectUrl),
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
    cache: "no-store",
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
      } else {
        clearFailedAppImage(image);
      }
    }
  });
  return marked;
}

function scheduleFailedAppImageScan(root, delays = [0, 180, 700]) {
  if (!root) return;
  delays.forEach((delay) => {
    window.setTimeout(() => {
      hydrateProtectedAppImages(root, "scheduled-scan");
      scanFailedAppImages(root);
    }, delay);
  });
}

function scheduleVisibleImageFailureScan(delays = [0, 180, 700]) {
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
  const label = (link && link.dataset && link.dataset.localFileLabel) || (link && link.textContent ? link.textContent.replace(/预览文件\s*$/, "").trim() : "") || "文件预览";
  showFilePreviewLoading(label, filePath);
  try {
    const file = await api(`/api/files/preview?threadId=${encodeURIComponent(threadId)}&path=${encodeURIComponent(filePath)}`, {
      timeoutMs: 15000,
    });
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
    renderFilePreviewSource,
    renderHtmlFilePreview,
    setFilePreviewHtmlView,
    handleFilePreviewHtmlViewClick,
    setFilePreviewHtmlFullscreen,
    handleFilePreviewHtmlFullscreenClick,
    closeFilePreviewHtmlFullscreen,
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
    openLocalFilePreview,
  };
}

const api = { createMediaPreviewRuntime };
if (typeof module !== "undefined" && module.exports) module.exports = api;
root.CodexMediaPreviewRuntime = api;
}(typeof window !== "undefined" ? window : globalThis));
