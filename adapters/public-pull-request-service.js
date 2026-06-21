"use strict";

function normalizeRepositorySlug(value, fallback = "pentiumxp/codex-mobile-web-public") {
  const text = String(value || "").trim() || fallback;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(text)) {
    throw new Error("Public PR repository must be in owner/repo form");
  }
  return text;
}

function publicPullRequestApiUrl(repository) {
  const slug = normalizeRepositorySlug(repository);
  return `https://api.github.com/repos/${slug}/pulls?state=open&per_page=5`;
}

function isDraftPullRequest(value) {
  if (!value || typeof value !== "object") return false;
  return value.draft === true || value.isDraft === true;
}

function normalizePullRequest(value) {
  if (!value || typeof value !== "object") return null;
  if (isDraftPullRequest(value)) return null;
  const number = Number(value.number);
  if (!Number.isFinite(number) || number <= 0) return null;
  return {
    number,
    title: String(value.title || "").slice(0, 240),
    htmlUrl: String(value.html_url || value.htmlUrl || ""),
    user: value.user && typeof value.user === "object" ? String(value.user.login || "") : "",
    updatedAt: String(value.updated_at || value.updatedAt || ""),
  };
}

function buildPublicPullRequestStatus(options = {}) {
  const repository = normalizeRepositorySlug(options.repository);
  const pullRequests = (Array.isArray(options.pullRequests) ? options.pullRequests : [])
    .map(normalizePullRequest)
    .filter(Boolean);
  return {
    supported: options.supported !== false,
    enabled: options.enabled !== false,
    repository,
    checkedAt: options.checkedAt || new Date().toISOString(),
    openPullRequestCount: pullRequests.length,
    hasOpenPullRequests: pullRequests.length > 0,
    pullRequests,
    error: options.error ? String(options.error) : "",
  };
}

module.exports = {
  buildPublicPullRequestStatus,
  isDraftPullRequest,
  normalizePullRequest,
  normalizeRepositorySlug,
  publicPullRequestApiUrl,
};
