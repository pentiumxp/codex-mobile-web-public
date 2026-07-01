"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { readFrontendSources } = require("./frontend-source-helper");

const root = path.resolve(__dirname, "..");
const appJs = readFrontendSources(root);
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const swJs = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
const shellManifest = JSON.parse(fs.readFileSync(path.join(root, "public", "shell-asset-manifest.json"), "utf8"));
const serverRuntimeUtilsJs = fs.readFileSync(path.join(root, "services", "runtime", "server-runtime-utils.js"), "utf8");
const mediaPreviewRuntimeJs = fs.readFileSync(path.join(root, "public", "media-preview-runtime.js"), "utf8");

const { createMediaPreviewRuntime } = require(path.join(root, "public", "media-preview-runtime.js"));

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createElementStub(id = "") {
  return {
    id,
    classList: {
      contains: () => false,
      add() {},
      remove() {},
      toggle() {},
    },
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    setAttribute() {},
    getAttribute: () => "",
    removeAttribute() {},
    textContent: "",
    innerHTML: "",
  };
}

function createRuntimeFixture(overrides = {}) {
  const elements = new Map();
  const document = {
    documentElement: {
      getAttribute: () => "light",
      setAttribute() {},
    },
    head: createElementStub("head"),
    createElement: () => createElementStub(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElementStub(id));
      return elements.get(id);
    },
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const window = {
    location: { origin: "http://127.0.0.1:8787", pathname: "/" },
    CodexMarkdownRenderer: {
      renderMarkdown(value) {
        return `<div class="markdown-body">${escapeHtml(value)}</div>`;
      },
      normalizeMermaidSourceForRender(value) {
        return String(value || "");
      },
    },
    matchMedia: () => ({ matches: true }),
    setTimeout: (callback) => {
      if (typeof callback === "function") callback();
      return 1;
    },
    clearTimeout() {},
  };
  const state = Object.assign({
    key: "session-key",
    currentThreadId: "thread-1",
    currentThread: { mobileReadMode: "recent" },
    filePreviewThreadId: "thread-1",
    imagePreviewScale: 1,
    pluginEmbed: null,
  }, overrides.state || {});
  const runtime = createMediaPreviewRuntime(Object.assign({
    state,
    document,
    window,
    $: (id) => document.getElementById(id),
    api: async () => ({}),
    escapeHtml,
    normalizeFsPath: (value) => String(value || "").replace(/\\/g, "\\").toLowerCase(),
    shortPath: (value) => path.basename(String(value || "").replace(/\\/g, "/")),
    compactStructuredForSignature: (value) => JSON.stringify(value),
    visibleThreadTaskCardCommandText: (value) => String(value || ""),
    rememberCopyText: (value) => `copy:${String(value || "")}`,
    copyButtonHtml: (key) => `<button data-copy-key="${escapeHtml(key)}">复制</button>`,
    stableTextHash: (value) => `hash:${String(value || "").length}`,
    renderContextThreadId: () => "thread-1",
    publishPluginNavigationState() {},
    postPerformanceEvent() {},
    roundedDurationMs: () => 1,
    nowPerfMs: () => 1,
    isHermesEmbedMode: () => false,
    isIosWebKitBrowser: () => false,
    requestHermesPluginRefresh() {},
    primaryTouch: (event) => event && event.touches && event.touches[0] || null,
  }, overrides.deps || {}));
  return { runtime, state, document, window, elements };
}

test("media preview runtime is wired into the static shell", () => {
  assert.match(indexHtml, /<script src="\/side-chat-runtime\.js"><\/script>[\s\S]*<script src="\/media-preview-runtime\.js"><\/script>[\s\S]*<script src="\/app\.js"><\/script>/);
  assert.ok(shellManifest.precacheAssets.includes("/media-preview-runtime.js"));
  assert.equal(shellManifest.shellCacheName, "codex-mobile-shell-v623");
  assert.match(swJs, /shell-asset-manifest\.js/);
  assert.match(appJs, /"\/media-preview-runtime\.js"/);
  assert.equal(shellManifest.clientBuildId, "0.1.11|codex-mobile-shell-v623");
  assert.ok(shellManifest.hashAssets.includes("/media-preview-runtime.js"));
  assert.match(serverRuntimeUtilsJs, /shell-asset-manifest\.json/);
  assert.match(appJs, /(?:const|var) mediaPreviewRuntimeApi = window\.CodexMediaPreviewRuntime/);
  assert.match(appJs, /function requireMediaPreviewRuntime\(\)/);
  assert.match(appJs, /mediaPreviewRuntimeApi\.createMediaPreviewRuntime\(\{/);
  assert.match(mediaPreviewRuntimeJs, /function createMediaPreviewRuntime\(deps = \{\}\)/);
  assert.match(mediaPreviewRuntimeJs, /root\.CodexMediaPreviewRuntime = api/);
});

test("media preview runtime exposes the moved preview APIs", () => {
  const { runtime } = createRuntimeFixture();
  for (const name of [
    "renderMarkdownWithAttachmentSummary",
    "normalizeGithubPreviewUrl",
    "hydrateGitHubLinkCards",
    "mermaidRenderArtifactIds",
    "openImagePreviewFromImage",
    "renderFilePreviewContent",
    "renderImageView",
    "scheduleVisibleImageFailureScan",
  ]) {
    assert.equal(typeof runtime[name], "function", `${name} export`);
  }
});

test("media preview runtime renders attachment summaries and file preview content", () => {
  const { runtime } = createRuntimeFixture();
  const uploadPath = "/Users/xuxin/.codex-mobile-web/uploads/2026-07-01/thread-id/homeai-upload.jpg";
  const split = runtime.splitAttachmentSummaryText(`Body\n\nUploaded attachments:\n- homeai-upload.jpg (image, image/jpeg, 124 KB): ${uploadPath}`);
  assert.equal(split.text, "Body");
  assert.equal(split.attachments.length, 1);
  const markdown = runtime.renderMarkdownWithAttachmentSummary(`Body\n\nUploaded attachments:\n- homeai-upload.jpg (image, image/jpeg, 124 KB): ${uploadPath}`);
  assert.match(markdown, /markdown-body/);
  assert.match(markdown, /input-image/);
  assert.match(markdown, /data-protected-image-src="\/api\/files\/preview\/content\?threadId=thread-1&amp;path=%2FUsers%2Fxuxin%2F\.codex-mobile-web%2Fuploads%2F2026-07-01%2Fthread-id%2Fhomeai-upload\.jpg&amp;key=session-key"/);

  const jsonPreview = runtime.renderFilePreviewContent({ kind: "json", content: "{\"ok\":true}" });
  assert.match(jsonPreview, /file-preview-text/);
  assert.match(jsonPreview, /&quot;ok&quot;: true/);
  const csvPreview = runtime.renderFilePreviewContent({ kind: "csv", content: "a,b\n1,2" });
  assert.match(csvPreview, /file-preview-table/);
  assert.match(csvPreview, /<td>2<\/td>/);
});

test("media preview runtime keeps GitHub, Mermaid, and image view behavior local", () => {
  const { runtime } = createRuntimeFixture();
  assert.equal(runtime.normalizeGithubPreviewUrl("https://github.com/openai/codex/pull/7"), "https://github.com/openai/codex/pull/7");
  assert.equal(runtime.normalizeGithubPreviewUrl("http://github.com/openai/codex"), "");
  assert.deepEqual(runtime.mermaidRenderArtifactIds("codex-mobile-mermaid-7-0"), [
    "codex-mobile-mermaid-7-0",
    "dcodex-mobile-mermaid-7-0",
    "icodex-mobile-mermaid-7-0",
  ]);
  const imageHtml = runtime.renderImageView({
    type: "imageView",
    path: "/Users/xuxin/.codex-mobile-web/uploads/2026-07-01/thread-id/generated.png",
    contentUrl: "/api/uploads/file?id=2026-07-01/thread-id/generated.png",
  });
  assert.match(imageHtml, /class="image-view"/);
  assert.match(imageHtml, /data-protected-image-src="\/api\/uploads\/file\?id=2026-07-01%2Fthread-id%2Fgenerated\.png&amp;key=session-key"/);
  assert.doesNotMatch(mediaPreviewRuntimeJs, /localStorage|sessionStorage|indexedDB|draftStore/);
});
