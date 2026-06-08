"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  githubPreviewApiUrl,
  normalizeGitHubPreview,
  parseGitHubUrl,
} = require("../adapters/github-link-preview-service");

test("parses supported GitHub preview URLs and rejects unsafe targets", () => {
  assert.deepEqual(parseGitHubUrl("https://github.com/openai/codex"), {
    owner: "openai",
    repo: "codex",
    canonicalUrl: "https://github.com/openai/codex",
    kind: "repository",
  });
  assert.deepEqual(parseGitHubUrl("https://www.github.com/openai/codex/pull/42?diff=split"), {
    owner: "openai",
    repo: "codex",
    canonicalUrl: "https://github.com/openai/codex/pull/42",
    kind: "pull",
    number: 42,
  });
  assert.deepEqual(parseGitHubUrl("https://github.com/openai/codex/commit/abcdef1"), {
    owner: "openai",
    repo: "codex",
    canonicalUrl: "https://github.com/openai/codex/commit/abcdef1",
    kind: "commit",
    sha: "abcdef1",
  });
  assert.equal(parseGitHubUrl("http://github.com/openai/codex"), null);
  assert.equal(parseGitHubUrl("https://example.com/openai/codex"), null);
  assert.equal(parseGitHubUrl("https://github.com/openai/codex/releases/tag/v1"), null);
});

test("builds GitHub API URLs only from parsed preview targets", () => {
  assert.equal(
    githubPreviewApiUrl(parseGitHubUrl("https://github.com/openai/codex")),
    "https://api.github.com/repos/openai/codex",
  );
  assert.equal(
    githubPreviewApiUrl(parseGitHubUrl("https://github.com/openai/codex/issues/7")),
    "https://api.github.com/repos/openai/codex/issues/7",
  );
  assert.equal(
    githubPreviewApiUrl(parseGitHubUrl("https://github.com/openai/codex/pull/8")),
    "https://api.github.com/repos/openai/codex/pulls/8",
  );
  assert.equal(
    githubPreviewApiUrl(parseGitHubUrl("https://github.com/openai/codex/commit/abcdef1")),
    "https://api.github.com/repos/openai/codex/commits/abcdef1",
  );
});

test("normalizes bounded GitHub preview payloads", () => {
  const repoTarget = parseGitHubUrl("https://github.com/openai/codex");
  const repoPreview = normalizeGitHubPreview(repoTarget, {
    full_name: "openai/codex",
    description: "A ".repeat(400),
    html_url: "https://github.com/openai/codex",
    language: "JavaScript",
    stargazers_count: 12,
    forks_count: 3,
    updated_at: "2026-06-09T00:00:00Z",
  });
  assert.equal(repoPreview.kind, "repository");
  assert.equal(repoPreview.title, "openai/codex");
  assert.equal(repoPreview.description.length, 300);
  assert.equal(repoPreview.stars, 12);

  const issuePreview = normalizeGitHubPreview(parseGitHubUrl("https://github.com/openai/codex/issues/5"), {
    number: 5,
    title: "Broken rendering",
    body: "Steps to reproduce",
    html_url: "https://github.com/openai/codex/issues/5",
    state: "open",
    user: { login: "alice" },
    updated_at: "2026-06-09T01:00:00Z",
  });
  assert.equal(issuePreview.kind, "issue");
  assert.equal(issuePreview.number, 5);
  assert.equal(issuePreview.author, "alice");
});
