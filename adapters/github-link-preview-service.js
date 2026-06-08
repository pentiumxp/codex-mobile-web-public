"use strict";

function cleanSegment(value) {
  return String(value || "").trim();
}

function boundedText(value, max = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function parseGitHubUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || ""));
  } catch (_) {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (!["github.com", "www.github.com"].includes(parsed.hostname.toLowerCase())) return null;
  const segments = parsed.pathname.split("/").filter(Boolean).map(cleanSegment);
  if (segments.length < 2) return null;
  const [owner, repo] = segments;
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null;
  const base = {
    owner,
    repo,
    canonicalUrl: `https://github.com/${owner}/${repo}`,
    kind: "repository",
  };
  const resource = String(segments[2] || "").toLowerCase();
  if (!resource) return base;
  if ((resource === "issues" || resource === "pull") && /^\d+$/.test(String(segments[3] || ""))) {
    const number = Number(segments[3]);
    return Object.assign({}, base, {
      kind: resource === "pull" ? "pull" : "issue",
      number,
      canonicalUrl: `https://github.com/${owner}/${repo}/${resource}/${number}`,
    });
  }
  if (resource === "commit" && /^[A-Fa-f0-9]{7,64}$/.test(String(segments[3] || ""))) {
    const sha = String(segments[3]);
    return Object.assign({}, base, {
      kind: "commit",
      sha,
      canonicalUrl: `https://github.com/${owner}/${repo}/commit/${sha}`,
    });
  }
  return null;
}

function githubPreviewApiUrl(target) {
  if (!target || !target.owner || !target.repo) return "";
  const owner = encodeURIComponent(target.owner);
  const repo = encodeURIComponent(target.repo);
  if (target.kind === "issue" && target.number) {
    return `https://api.github.com/repos/${owner}/${repo}/issues/${encodeURIComponent(target.number)}`;
  }
  if (target.kind === "pull" && target.number) {
    return `https://api.github.com/repos/${owner}/${repo}/pulls/${encodeURIComponent(target.number)}`;
  }
  if (target.kind === "commit" && target.sha) {
    return `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(target.sha)}`;
  }
  return `https://api.github.com/repos/${owner}/${repo}`;
}

function loginFromUser(value) {
  return value && typeof value === "object" ? boundedText(value.login || value.name, 80) : "";
}

function normalizeRepositoryPreview(target, payload) {
  return {
    kind: "repository",
    owner: target.owner,
    repo: target.repo,
    title: boundedText(payload.full_name || `${target.owner}/${target.repo}`, 160),
    description: boundedText(payload.description, 300),
    url: payload.html_url || target.canonicalUrl,
    language: boundedText(payload.language, 60),
    stars: Number(payload.stargazers_count) || 0,
    forks: Number(payload.forks_count) || 0,
    updatedAt: payload.updated_at || "",
  };
}

function normalizeIssuePreview(target, payload) {
  return {
    kind: target.kind,
    owner: target.owner,
    repo: target.repo,
    number: Number(target.number) || Number(payload.number) || 0,
    title: boundedText(payload.title, 200),
    description: boundedText(payload.body, 300),
    url: payload.html_url || target.canonicalUrl,
    state: boundedText(payload.state, 40),
    author: loginFromUser(payload.user),
    updatedAt: payload.updated_at || "",
  };
}

function normalizeCommitPreview(target, payload) {
  const commit = payload.commit && typeof payload.commit === "object" ? payload.commit : {};
  return {
    kind: "commit",
    owner: target.owner,
    repo: target.repo,
    sha: boundedText(payload.sha || target.sha, 64),
    title: boundedText(commit.message || payload.message, 200),
    url: payload.html_url || target.canonicalUrl,
    author: loginFromUser(payload.author) || boundedText(commit.author && commit.author.name, 80),
    updatedAt: commit.author && commit.author.date || payload.updated_at || "",
  };
}

function normalizeGitHubPreview(target, payload) {
  if (!target || !payload || typeof payload !== "object") return null;
  if (target.kind === "issue" || target.kind === "pull") return normalizeIssuePreview(target, payload);
  if (target.kind === "commit") return normalizeCommitPreview(target, payload);
  return normalizeRepositoryPreview(target, payload);
}

module.exports = {
  githubPreviewApiUrl,
  normalizeGitHubPreview,
  parseGitHubUrl,
};
