"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");
const stylesCss = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

test("client hydrates GitHub preview card shells from a server endpoint", () => {
  assert.match(appJs, /const GITHUB_LINK_PREVIEW_TIMEOUT_MS = 12000;/);
  assert.match(appJs, /const githubLinkPreviewCache = new Map\(\);/);
  assert.match(appJs, /function normalizeGithubPreviewUrl\(/);
  assert.match(appJs, /function normalizeGitHubLinkPreview\(/);
  assert.match(appJs, /function fetchGitHubLinkPreview\(/);
  assert.match(appJs, /function ensureInlineGitHubLinkPreviews\(/);
  assert.match(appJs, /function renderCollapsedGitHubLinkPreview\(/);
  assert.match(appJs, /function gitHubLinkPreviewInsertContainer\(/);
  assert.match(appJs, /function toggleGitHubLinkPreview\(/);
  assert.match(appJs, /function setGitHubPreviewCompactExpanded\(/);
  assert.match(appJs, /function updateGitHubPreviewCompactTitle\(/);
  assert.match(appJs, /function renderGitHubLinkPreviewUnavailable\(/);
  assert.match(appJs, /data-github-link-preview-node="true"/);
  assert.match(appJs, /data-github-link-preview-inline="true"/);
  assert.match(appJs, /data-github-link-preview-expand="true"/);
  assert.match(appJs, /正在加载 GitHub 预览/);
  assert.match(appJs, /无法加载 GitHub 预览/);
  assert.match(appJs, /action\.textContent = expanded \? "收起" : "预览"/);
  assert.match(appJs, /aria-label="预览 GitHub 链接"/);
  assert.match(appJs, /\$\{escapeHtml\(summary\.detail\)\} · \$\{escapeHtml\(summary\.repo\)\}/);
  assert.match(appJs, /updateGitHubPreviewCompactTitle\(slot, preview\);/);
  assert.match(appJs, /class="github-link-card-compact"/);
  assert.ok(appJs.includes('!slot.matches(".github-link-card-shell[data-github-link-preview-url]")'));
  assert.doesNotMatch(appJs, /class="github-link-card-compact"[^>]*data-github-link-preview-url/);
  assert.match(appJs, /class="github-link-card-shell github-link-card-shell-deferred" hidden data-github-link-preview-url=/);
  assert.match(appJs, /\/api\/link-previews\/github\?url=/);
  assert.match(appJs, /function hydrateGitHubLinkCards\(/);
  assert.match(appJs, /ensureInlineGitHubLinkPreviews\(root\);/);
  assert.ok(appJs.includes("root.querySelectorAll('[data-github-link-preview-url]:not([data-github-link-preview-deferred=\"true\"])')"));
  assert.match(appJs, /function hydrateThreadDetailSurface\(/);
  assert.match(appJs, /hydrateGitHubLinks:\s*options\.skipRichHydration \? null : hydrateGitHubLinkCards/);
  assert.match(appJs, /hydrateThreadDetailSurface\(conversation\)/);
  assert.match(appJs, /hydrateGitHubLinkCards\(\$\("filePreviewBody"\)\);/);
});

test("server exposes a GitHub link preview route", () => {
  assert.match(serverJs, /parseGitHubUrl/);
  assert.match(serverJs, /normalizeGitHubPreview/);
  assert.match(serverJs, /const githubLinkPreviewCache = new Map\(\);/);
  assert.match(serverJs, /function refreshGitHubLinkPreview\(/);
  assert.match(serverJs, /url\.pathname === "\/api\/link-previews\/github"/);
});

test("styles define a GitHub link card treatment", () => {
  assert.match(stylesCss, /\.github-link-preview-node/);
  assert.match(stylesCss, /\.github-link-preview-inline/);
  assert.match(stylesCss, /\.github-link-card-shell/);
  assert.match(stylesCss, /\.github-link-card-shell-deferred/);
  assert.match(stylesCss, /\.github-link-card-compact/);
  assert.match(stylesCss, /\.github-link-card-compact\.expanded/);
  assert.match(stylesCss, /\.github-link-card-compact-title/);
  assert.match(stylesCss, /\.github-link-card-placeholder/);
  assert.match(stylesCss, /\.github-link-card-unavailable/);
  assert.match(stylesCss, /\.github-link-card\s*{/);
  assert.match(stylesCss, /\.github-link-card-head/);
  assert.match(stylesCss, /\.github-link-card-state\.state-merged/);
  assert.match(stylesCss, /\.github-link-card-avatar/);
});
