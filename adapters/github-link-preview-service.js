"use strict";

function safeSegment(value) {
  const text = String(value || "").trim();
  return /^[A-Za-z0-9_.-]+$/.test(text) ? text : "";
}

function safePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function safeCommitSha(value) {
  const text = String(value || "").trim();
  return /^[a-f0-9]{7,64}$/i.test(text) ? text.toLowerCase() : "";
}

function compactText(value, maxLength = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function trimBodyPreview(value, maxLength = 220) {
  const text = compactText(value, maxLength + 32);
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}...` : text;
}

function formatCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number.toLocaleString() : "";
}

function githubKindLabel(kind) {
  const text = String(kind || "");
  if (text === "repo") return "Repository";
  if (text === "issue") return "Issue";
  if (text === "pull") return "Pull request";
  if (text === "commit") return "Commit";
  return "GitHub";
}

function parseGitHubUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch (_) {
    return null;
  }
  const host = String(parsed.hostname || "").toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") return null;
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = safeSegment(parts[0]);
  const repo = safeSegment(parts[1]);
  if (!owner || !repo) return null;
  const repository = `${owner}/${repo}`;
  if (parts.length === 2) {
    return {
      provider: "github",
      kind: "repo",
      owner,
      repo,
      repository,
      canonicalUrl: `https://github.com/${repository}`,
    };
  }
  if (parts[2] === "issues") {
    const number = safePositiveInteger(parts[3]);
    if (number) {
      return {
        provider: "github",
        kind: "issue",
        owner,
        repo,
        repository,
        number,
        canonicalUrl: `https://github.com/${repository}/issues/${number}`,
      };
    }
  }
  if (parts[2] === "pull") {
    const number = safePositiveInteger(parts[3]);
    if (number) {
      return {
        provider: "github",
        kind: "pull",
        owner,
        repo,
        repository,
        number,
        canonicalUrl: `https://github.com/${repository}/pull/${number}`,
      };
    }
  }
  if (parts[2] === "commit") {
    const sha = safeCommitSha(parts[3]);
    if (sha) {
      return {
        provider: "github",
        kind: "commit",
        owner,
        repo,
        repository,
        sha,
        canonicalUrl: `https://github.com/${repository}/commit/${sha}`,
      };
    }
  }
  return null;
}

function githubPreviewApiUrl(target) {
  if (!target || typeof target !== "object") throw new Error("GitHub preview target is required");
  if (target.kind === "repo") return `https://api.github.com/repos/${target.repository}`;
  if (target.kind === "issue") return `https://api.github.com/repos/${target.repository}/issues/${target.number}`;
  if (target.kind === "pull") return `https://api.github.com/repos/${target.repository}/pulls/${target.number}`;
  if (target.kind === "commit") return `https://api.github.com/repos/${target.repository}/commits/${target.sha}`;
  throw new Error(`Unsupported GitHub preview kind: ${target.kind}`);
}

function normalizeGitHubPreview(target, payload) {
  if (!target || typeof target !== "object" || !payload || typeof payload !== "object") return null;
  if (target.kind === "repo") {
    const fullName = compactText(payload.full_name || target.repository, 120) || target.repository;
    return {
      provider: "github",
      kind: target.kind,
      kindLabel: githubKindLabel(target.kind),
      url: target.canonicalUrl,
      title: fullName,
      subtitle: compactText(payload.description || "", 220),
      description: [
        payload.private ? "Private" : "Public",
        payload.fork ? "Fork" : "",
        compactText(payload.language || "", 32),
      ].filter(Boolean).join(" | "),
      meta: [
        formatCount(payload.stargazers_count) ? `${formatCount(payload.stargazers_count)} stars` : "",
        formatCount(payload.open_issues_count) ? `${formatCount(payload.open_issues_count)} open issues` : "",
      ].filter(Boolean).join(" | "),
      avatarUrl: payload.owner && payload.owner.avatar_url ? String(payload.owner.avatar_url) : "",
      accent: payload.private ? "muted" : "repo",
      state: payload.archived ? "archived" : "",
      stateLabel: payload.archived ? "Archived" : "",
    };
  }
  if (target.kind === "issue") {
    const repoName = compactText(target.repository, 120);
    const state = payload.state === "closed" ? "closed" : "open";
    return {
      provider: "github",
      kind: target.kind,
      kindLabel: githubKindLabel(target.kind),
      url: target.canonicalUrl,
      title: compactText(payload.title || `${repoName} #${target.number}`, 220),
      subtitle: `${repoName} #${target.number}`,
      description: trimBodyPreview(payload.body || ""),
      meta: compactText(payload.user && payload.user.login ? `by ${payload.user.login}` : "", 80),
      avatarUrl: payload.user && payload.user.avatar_url ? String(payload.user.avatar_url) : "",
      accent: state,
      state,
      stateLabel: state === "closed" ? "Closed" : "Open",
    };
  }
  if (target.kind === "pull") {
    const repoName = compactText(target.repository, 120);
    const state = payload.merged_at ? "merged" : (payload.state === "closed" ? "closed" : "open");
    return {
      provider: "github",
      kind: target.kind,
      kindLabel: githubKindLabel(target.kind),
      url: target.canonicalUrl,
      title: compactText(payload.title || `${repoName} #${target.number}`, 220),
      subtitle: `${repoName} #${target.number}`,
      description: trimBodyPreview(payload.body || ""),
      meta: [
        payload.user && payload.user.login ? `by ${payload.user.login}` : "",
        payload.draft ? "Draft" : "",
      ].filter(Boolean).join(" | "),
      avatarUrl: payload.user && payload.user.avatar_url ? String(payload.user.avatar_url) : "",
      accent: state,
      state,
      stateLabel: state === "merged" ? "Merged" : (state === "closed" ? "Closed" : "Open"),
    };
  }
  if (target.kind === "commit") {
    const message = compactText(payload.commit && payload.commit.message ? String(payload.commit.message).split(/\r?\n/, 1)[0] : "", 220);
    const repoName = compactText(target.repository, 120);
    return {
      provider: "github",
      kind: target.kind,
      kindLabel: githubKindLabel(target.kind),
      url: target.canonicalUrl,
      title: message || `${repoName} @ ${target.sha.slice(0, 7)}`,
      subtitle: `${repoName} @ ${target.sha.slice(0, 7)}`,
      description: compactText(payload.commit && payload.commit.author && payload.commit.author.name ? `by ${payload.commit.author.name}` : "", 120),
      meta: formatCount(payload.stats && payload.stats.total) ? `${formatCount(payload.stats.total)} changes` : "",
      avatarUrl: payload.author && payload.author.avatar_url ? String(payload.author.avatar_url) : "",
      accent: "commit",
      state: "",
      stateLabel: "",
    };
  }
  return null;
}

module.exports = {
  githubKindLabel,
  githubPreviewApiUrl,
  normalizeGitHubPreview,
  parseGitHubUrl,
};
