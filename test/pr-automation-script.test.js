"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { test } = require("node:test");

const scriptPath = path.resolve(__dirname, "../scripts/codex-mobile-pr-automation.js");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-pr-auto-test-"));
}

function writeFixture(dir, value) {
  const filePath = path.join(dir, "fixture.json");
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function runScript(args, cwd) {
  return execFileSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

test("PR automation script plans from local fixtures without GitHub credentials", () => {
  const dir = tempDir();
  const fixture = writeFixture(dir, {
    publicOpenPullRequests: [{
      repoKind: "public",
      repository: "pentiumxp/codex-mobile-web-public",
      number: 90,
      title: "Fixture PR",
      headRefOid: "cccccccccccccccccccccccccccccccccccccccc",
      updatedAt: "2026-07-08T08:00:00Z",
      files: [{ path: "public/vite-shell/entry.js" }],
    }],
  });

  const output = runScript(["--fixture", fixture, "--json"], dir);
  const run = JSON.parse(output);

  assert.equal(run.privacy, "metadata_only");
  assert.equal(run.state, "absorption_dispatched");
  assert.equal(run.issueCode, "generated_artifacts_rebuild_required");
  assert.equal(run.taskCardRequests[0].purpose, "pr_absorption");
  assert.equal(JSON.stringify(run).includes("token"), false);
});

test("PR automation script writes bounded idempotency state only when requested", () => {
  const dir = tempDir();
  const stateFile = path.join(dir, "state", "pr-automation-state.json");
  const fixture = writeFixture(dir, {
    publicOpenPullRequests: [{
      repoKind: "public",
      repository: "pentiumxp/codex-mobile-web-public",
      number: 92,
      title: "State fixture",
      headRefOid: "dddddddddddddddddddddddddddddddddddddddd",
      updatedAt: "2026-07-08T10:00:00Z",
      files: [{ path: "adapters/message-input-service.js" }],
    }],
  });

  const output = runScript(["--fixture", fixture, "--state-file", stateFile, "--write-state", "--json"], dir);
  const run = JSON.parse(output);
  const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));

  assert.equal(run.state, "absorption_dispatched");
  assert.equal(state.records.length, 1);
  assert.equal(state.records[0].identity, "github-pr:pentiumxp/codex-mobile-web-public:92");
  assert.equal(state.records[0].state, "absorption_dispatched");
  assert.equal(state.records[0].selectedHeadShort, "dddddddd");
  assert.equal(state.records[0].title, undefined);
});

test("PR automation script supports human one-shot output", () => {
  const dir = tempDir();
  const fixture = writeFixture(dir, {
    githubCredentials: {
      available: false,
      issueCode: "github_credentials_missing",
    },
  });

  const output = runScript(["--fixture", fixture], dir);

  assert.match(output, /state=blocked/);
  assert.match(output, /issueCode=github_credentials_missing/);
});
