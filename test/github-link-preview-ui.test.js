"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const mediaPreviewRuntimeJs = fs.readFileSync(path.join(root, "public", "media-preview-runtime.js"), "utf8");
const appAndMediaJs = `${mediaPreviewRuntimeJs}\n${appJs}`;
const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");
const serverSupportRuntimeServiceJs = fs.readFileSync(path.join(root, "services", "runtime", "server-support-runtime-service.js"), "utf8");
const coreApiRouteServiceJs = fs.readFileSync(path.join(root, "server-routes", "core-api-route-service.js"), "utf8");
const appMaintenanceServiceJs = fs.readFileSync(path.join(root, "adapters", "app-maintenance-service.js"), "utf8");
const stylesCss = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

test("client hydrates GitHub preview card shells from a server endpoint", () => {
  assert.match(appJs, /const GITHUB_LINK_PREVIEW_TIMEOUT_MS = 12000;/);
  assert.match(mediaPreviewRuntimeJs, /const githubLinkPreviewCache = deps\.githubLinkPreviewCache \|\| new Map\(\);/);
  assert.match(appAndMediaJs, /function normalizeGithubPreviewUrl\(/);
  assert.match(appAndMediaJs, /function normalizeGitHubLinkPreview\(/);
  assert.match(appAndMediaJs, /function fetchGitHubLinkPreview\(/);
  assert.match(appAndMediaJs, /function ensureInlineGitHubLinkPreviews\(/);
  assert.match(appAndMediaJs, /function renderCollapsedGitHubLinkPreview\(/);
  assert.match(appAndMediaJs, /function gitHubLinkPreviewInsertContainer\(/);
  assert.match(appAndMediaJs, /function toggleGitHubLinkPreview\(/);
  assert.match(appAndMediaJs, /function setGitHubPreviewCompactExpanded\(/);
  assert.match(appAndMediaJs, /function updateGitHubPreviewCompactTitle\(/);
  assert.match(appAndMediaJs, /function renderGitHubLinkPreviewUnavailable\(/);
  assert.match(appAndMediaJs, /data-github-link-preview-node="true"/);
  assert.match(appAndMediaJs, /data-github-link-preview-inline="true"/);
  assert.match(appAndMediaJs, /data-github-link-preview-expand="true"/);
  assert.match(appAndMediaJs, /正在加载 GitHub 预览/);
  assert.match(appAndMediaJs, /无法加载 GitHub 预览/);
  assert.match(appAndMediaJs, /action\.textContent = expanded \? "收起" : "预览"/);
  assert.match(appAndMediaJs, /aria-label="预览 GitHub 链接"/);
  assert.match(appAndMediaJs, /\$\{escapeHtml\(summary\.detail\)\} · \$\{escapeHtml\(summary\.repo\)\}/);
  assert.match(appAndMediaJs, /updateGitHubPreviewCompactTitle\(slot, preview\);/);
  assert.match(appAndMediaJs, /class="github-link-card-compact"/);
  assert.ok(appAndMediaJs.includes('!slot.matches(".github-link-card-shell[data-github-link-preview-url]")'));
  assert.doesNotMatch(appAndMediaJs, /class="github-link-card-compact"[^>]*data-github-link-preview-url/);
  assert.match(appAndMediaJs, /class="github-link-card-shell github-link-card-shell-deferred" hidden data-github-link-preview-url=/);
  assert.match(appAndMediaJs, /\/api\/link-previews\/github\?url=/);
  assert.match(appAndMediaJs, /function hydrateGitHubLinkCards\(/);
  assert.match(appAndMediaJs, /ensureInlineGitHubLinkPreviews\(root\);/);
  assert.ok(appAndMediaJs.includes("root.querySelectorAll('[data-github-link-preview-url]:not([data-github-link-preview-deferred=\"true\"])')"));
  assert.match(appJs, /function hydrateThreadDetailSurface\(/);
  assert.match(appJs, /hydrateGitHubLinks:\s*options\.skipRichHydration \? null : hydrateGitHubLinkCards/);
  assert.match(appJs, /threadDetailDomPatchApi\.planConversationHtmlUpdateEffects\(updatePlan\)/);
  assert.match(appJs, /applyConversationHtmlUpdateEffectsPlan\(effectsPlan, \{ root: conversation \}\)/);
  assert.match(appJs, /hydrateThreadDetailSurface\(context\.root, item\.hydrateOptions \|\| \{\}\)/);
  assert.match(mediaPreviewRuntimeJs, /hydrateGitHubLinkCards\(\$\("filePreviewBody"\)\);/);
});

test("server exposes a GitHub link preview route", () => {
  assert.match(serverJs, /createServerSupportRuntimeService/);
  assert.match(serverSupportRuntimeServiceJs, /createAppMaintenanceService/);
  assert.match(serverJs, /refreshGitHubLinkPreview/);
  assert.match(appMaintenanceServiceJs, /parseGitHubUrl/);
  assert.match(appMaintenanceServiceJs, /normalizeGitHubPreview/);
  assert.match(appMaintenanceServiceJs, /const githubLinkPreviewCache = new Map\(\);/);
  assert.match(appMaintenanceServiceJs, /async function refreshGitHubLinkPreview\(/);
  assert.match(coreApiRouteServiceJs, /url\.pathname === "\/api\/link-previews\/github"/);
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
