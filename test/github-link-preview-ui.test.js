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
  assert.match(appJs, /const GITHUB_LINK_PREVIEW_LIMIT = 3;/);
  assert.match(appJs, /const githubLinkPreviewCache = new Map\(\);/);
  assert.match(appJs, /function normalizeGithubPreviewUrl\(/);
  assert.match(appJs, /function normalizeGitHubLinkPreview\(/);
  assert.match(appJs, /function fetchGitHubLinkPreview\(/);
  assert.match(appJs, /function collectGitHubPreviewUrls\(/);
  assert.match(appJs, /function ensureGitHubLinkPreviewGroups\(/);
  assert.match(appJs, /data-github-link-preview-group="auto"/);
  assert.match(appJs, /\/api\/link-previews\/github\?url=/);
  assert.match(appJs, /function hydrateGitHubLinkCards\(/);
  assert.match(appJs, /ensureGitHubLinkPreviewGroups\(root\);/);
  assert.match(appJs, /hydrateGitHubLinkCards\(conversation\);/);
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
  assert.match(stylesCss, /\.github-link-card-group/);
  assert.match(stylesCss, /\.github-link-card-shell/);
  assert.match(stylesCss, /\.github-link-card\s*{/);
  assert.match(stylesCss, /\.github-link-card-head/);
  assert.match(stylesCss, /\.github-link-card-state\.state-merged/);
  assert.match(stylesCss, /\.github-link-card-avatar/);
});
