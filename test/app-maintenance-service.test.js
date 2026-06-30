"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  assertSafeGitBranch,
  createAppMaintenanceService,
  publicRepositoryCommitApiUrl,
  remoteUrlLooksLikeRepository,
  safeAppUpdateError,
  safeRemoteUrl,
} = require("../adapters/app-maintenance-service");

function gitResult(stdout = "") {
  return { stdout, stderr: "", code: 0, signal: null };
}

test("app maintenance helpers reject unsafe refs and mask remote credentials", () => {
  assert.equal(assertSafeGitBranch("release/v1"), "release/v1");
  assert.throws(() => assertSafeGitBranch("../main"), /safe git branch/);
  assert.equal(
    publicRepositoryCommitApiUrl("owner/repo", "release/v1"),
    "https://api.github.com/repos/owner/repo/commits/release%2Fv1",
  );
  assert.equal(safeRemoteUrl("https://token@example.com/owner/repo.git\n"), "https://***@example.com/owner/repo.git");
  assert.equal(safeAppUpdateError(new Error("fetch https://token@example.com/owner/repo.git failed")), "fetch https://***@example.com/owner/repo.git failed");
  assert.equal(remoteUrlLooksLikeRepository("git@github.com:owner/repo.git", "owner/repo"), true);
});

test("app update status is read through the maintenance service with safe public output", async () => {
  const commands = [];
  const service = createAppMaintenanceService({
    appRoot: "/repo/codex-mobile-web",
    appVersion: "0.1.11",
    appUpdateRemote: "origin",
    appUpdateBranch: "main",
    now: () => Date.parse("2026-06-30T00:00:00Z"),
    runGit: async (args) => {
      commands.push(args.join(" "));
      const command = args.join(" ");
      if (command === "rev-parse --is-inside-work-tree") return gitResult("true\n");
      if (command === "branch --show-current") return gitResult("main\n");
      if (command === "remote get-url origin") return gitResult("https://secret@github.com/owner/repo.git\n");
      if (command === "rev-parse HEAD") return gitResult("1111111111111111111111111111111111111111\n");
      if (command === "rev-parse --verify origin/main^{commit}") return gitResult("2222222222222222222222222222222222222222\n");
      if (command === "status --porcelain --untracked-files=all") return gitResult(" M server.js\n");
      if (command === "rev-list --left-right --count HEAD...origin/main") return gitResult("0\t1\n");
      throw new Error(`unexpected git command ${command}`);
    },
  });

  const status = await service.refreshAppUpdateStatus({ force: true });

  assert.equal(status.supported, true);
  assert.equal(status.state, "blocked");
  assert.equal(status.dirty, true);
  assert.equal(status.dirtyCount, 1);
  assert.equal(status.updateAvailable, true);
  assert.equal(status.canFastForward, false);
  assert.equal(status.remoteUrl, "https://***@github.com/owner/repo.git");
  assert.equal(status.localShort, "1111111");
  assert.equal(status.remoteShort, "2222222");
  assert.deepEqual(commands, [
    "rev-parse --is-inside-work-tree",
    "branch --show-current",
    "remote get-url origin",
    "rev-parse HEAD",
    "rev-parse --verify origin/main^{commit}",
    "status --porcelain --untracked-files=all",
    "rev-list --left-right --count HEAD...origin/main",
  ]);
});

test("GitHub preview status uses bounded normalization and an in-flight/cache owner", async () => {
  let fetchCount = 0;
  const service = createAppMaintenanceService({
    appVersion: "0.1.11",
    now: () => Date.parse("2026-06-30T01:00:00Z"),
    fetch: async (url) => {
      fetchCount += 1;
      assert.equal(url, "https://api.github.com/repos/openai/codex");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          full_name: "openai/codex",
          description: "Codex repository",
          html_url: "https://github.com/openai/codex",
          language: "JavaScript",
          stargazers_count: 12,
          forks_count: 3,
          updated_at: "2026-06-30T00:00:00Z",
        }),
      };
    },
  });

  const first = await service.refreshGitHubLinkPreview("https://github.com/openai/codex");
  const second = await service.refreshGitHubLinkPreview("https://github.com/openai/codex");

  assert.equal(fetchCount, 1);
  assert.equal(first.supported, true);
  assert.equal(first.preview.kind, "repository");
  assert.equal(first.preview.title, "openai/codex");
  assert.deepEqual(second, first);
});

test("public release status compares public GitHub ref with the local checkout", async () => {
  let fetchCount = 0;
  const service = createAppMaintenanceService({
    appRoot: "/repo/codex-mobile-web",
    appVersion: "0.1.11",
    appUpdateRemote: "origin",
    publicReleaseRepository: "owner/repo",
    publicReleaseBranch: "main",
    now: () => Date.parse("2026-06-30T02:00:00Z"),
    fetch: async (url) => {
      fetchCount += 1;
      assert.equal(url, "https://api.github.com/repos/owner/repo/commits/main");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          html_url: "https://github.com/owner/repo/commit/bbbbbbb",
          commit: {
            committer: { date: "2026-06-30T01:59:00Z" },
            message: "Public release\n\nBody",
          },
        }),
      };
    },
    runGit: async (args) => {
      const command = args.join(" ");
      if (command === "rev-parse HEAD") return gitResult("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n");
      if (command === "remote get-url origin") return gitResult("https://secret@github.com/owner/repo.git\n");
      throw new Error(`unexpected git command ${command}`);
    },
  });

  const first = await service.refreshPublicReleaseStatus({ force: true });
  const second = await service.refreshPublicReleaseStatus();

  assert.equal(fetchCount, 1);
  assert.equal(first.supported, true);
  assert.equal(first.updateAvailable, true);
  assert.equal(first.currentRemoteUrl, "https://***@github.com/owner/repo.git");
  assert.equal(first.currentCheckoutUsesPublicRelease, true);
  assert.equal(first.canUpdateThroughCurrentCheckout, true);
  assert.equal(first.publicMessage, "Public release");
  assert.deepEqual(second, first);
});
