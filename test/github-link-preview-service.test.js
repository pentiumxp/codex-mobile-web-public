"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  githubPreviewApiUrl,
  normalizeGitHubPreview,
  parseGitHubUrl,
} = require("../adapters/github-link-preview-service");

test("parses supported GitHub URLs into canonical preview targets", () => {
  assert.deepEqual(parseGitHubUrl("https://github.com/pentiumxp/codex-mobile-web-public"), {
    provider: "github",
    kind: "repo",
    owner: "pentiumxp",
    repo: "codex-mobile-web-public",
    repository: "pentiumxp/codex-mobile-web-public",
    canonicalUrl: "https://github.com/pentiumxp/codex-mobile-web-public",
  });
  assert.equal(parseGitHubUrl("https://github.com/pentiumxp/codex-mobile-web-public/issues/49").kind, "issue");
  assert.equal(parseGitHubUrl("https://github.com/pentiumxp/codex-mobile-web-public/pull/49/files").kind, "pull");
  assert.equal(parseGitHubUrl("https://github.com/pentiumxp/codex-mobile-web-public/commit/d6f97258bbb60c391bfa522937fe2b4c07e3a0d8").kind, "commit");
  assert.equal(parseGitHubUrl("https://example.com/pentiumxp/codex-mobile-web-public"), null);
});

test("builds GitHub REST API URLs for preview targets", () => {
  assert.equal(
    githubPreviewApiUrl(parseGitHubUrl("https://github.com/pentiumxp/codex-mobile-web-public")),
    "https://api.github.com/repos/pentiumxp/codex-mobile-web-public",
  );
  assert.equal(
    githubPreviewApiUrl(parseGitHubUrl("https://github.com/pentiumxp/codex-mobile-web-public/pull/49")),
    "https://api.github.com/repos/pentiumxp/codex-mobile-web-public/pulls/49",
  );
});

test("normalizes GitHub repo preview payloads for client cards", () => {
  const preview = normalizeGitHubPreview(
    parseGitHubUrl("https://github.com/pentiumxp/codex-mobile-web-public"),
    {
      full_name: "pentiumxp/codex-mobile-web-public",
      description: "Mobile client for Codex app-server",
      private: false,
      fork: false,
      language: "JavaScript",
      stargazers_count: 42,
      open_issues_count: 3,
      owner: { avatar_url: "https://avatars.example/repo.png" },
    },
  );

  assert.equal(preview.kind, "repo");
  assert.equal(preview.title, "pentiumxp/codex-mobile-web-public");
  assert.equal(preview.subtitle, "Mobile client for Codex app-server");
  assert.equal(preview.description, "Public | JavaScript");
  assert.equal(preview.meta, "42 stars | 3 open issues");
});

test("normalizes GitHub pull request previews with merged state", () => {
  const preview = normalizeGitHubPreview(
    parseGitHubUrl("https://github.com/pentiumxp/codex-mobile-web-public/pull/49"),
    {
      title: "修复 Mermaid 预览渲染边界",
      body: "Fix Mermaid preview rendering edges.",
      state: "closed",
      merged_at: "2026-06-08T09:47:56Z",
      draft: false,
      user: {
        login: "franksong2702",
        avatar_url: "https://avatars.example/pr.png",
      },
    },
  );

  assert.equal(preview.kind, "pull");
  assert.equal(preview.state, "merged");
  assert.equal(preview.stateLabel, "Merged");
  assert.match(preview.subtitle, /pentiumxp\/codex-mobile-web-public #49/);
  assert.equal(preview.meta, "by franksong2702");
});
