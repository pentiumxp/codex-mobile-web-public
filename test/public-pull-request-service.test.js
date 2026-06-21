"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  buildPublicPullRequestStatus,
  isDraftPullRequest,
  normalizePullRequest,
  normalizeRepositorySlug,
  publicPullRequestApiUrl,
} = require("../adapters/public-pull-request-service");

test("normalizes owner/repo public repository slugs", () => {
  assert.equal(normalizeRepositorySlug(" pentiumxp/codex-mobile-web-public "), "pentiumxp/codex-mobile-web-public");
  assert.equal(normalizeRepositorySlug("", "owner/repo"), "owner/repo");
  assert.throws(() => normalizeRepositorySlug("not-a-slug"), /owner\/repo/);
});

test("builds the GitHub open pull request API URL", () => {
  assert.equal(
    publicPullRequestApiUrl("pentiumxp/codex-mobile-web-public"),
    "https://api.github.com/repos/pentiumxp/codex-mobile-web-public/pulls?state=open&per_page=5",
  );
});

test("normalizes GitHub pull request response objects", () => {
  const pullRequest = normalizePullRequest({
    number: 12,
    title: "Update README",
    html_url: "https://github.com/pentiumxp/codex-mobile-web-public/pull/12",
    user: { login: "alice" },
    updated_at: "2026-05-27T00:00:00Z",
  });

  assert.deepEqual(pullRequest, {
    number: 12,
    title: "Update README",
    htmlUrl: "https://github.com/pentiumxp/codex-mobile-web-public/pull/12",
    user: "alice",
    updatedAt: "2026-05-27T00:00:00Z",
  });
  assert.equal(normalizePullRequest({ number: 0 }), null);
});

test("ignores draft public pull requests", () => {
  assert.equal(isDraftPullRequest({ draft: true }), true);
  assert.equal(isDraftPullRequest({ isDraft: true }), true);
  assert.equal(normalizePullRequest({ number: 11, title: "Draft", draft: true }), null);

  const status = buildPublicPullRequestStatus({
    repository: "pentiumxp/codex-mobile-web-public",
    openPullRequestCount: 2,
    pullRequests: [
      { number: 3, title: "Draft release", draft: true },
      { number: 4, title: "Ready release", draft: false },
    ],
    checkedAt: "2026-05-27T01:00:00Z",
  });

  assert.equal(status.hasOpenPullRequests, true);
  assert.equal(status.openPullRequestCount, 1);
  assert.deepEqual(status.pullRequests.map((pr) => pr.number), [4]);
});

test("builds client-safe public pull request status", () => {
  const status = buildPublicPullRequestStatus({
    repository: "pentiumxp/codex-mobile-web-public",
    pullRequests: [{ number: 3, title: "Release notes" }],
    checkedAt: "2026-05-27T01:00:00Z",
  });

  assert.equal(status.supported, true);
  assert.equal(status.enabled, true);
  assert.equal(status.hasOpenPullRequests, true);
  assert.equal(status.openPullRequestCount, 1);
  assert.equal(status.pullRequests[0].number, 3);
});
