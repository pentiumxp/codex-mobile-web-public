#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const {
  DEFAULT_PRIVATE_REPOSITORY,
  DEFAULT_PUBLIC_REPOSITORY,
  defaultStateFile,
  mergeAutomationState,
  planPrAutomationRun,
} = require("../services/runtime/pr-automation-service");

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    fixture: "",
    json: false,
    privateRepo: process.env.CODEX_MOBILE_PRIVATE_REPOSITORY || DEFAULT_PRIVATE_REPOSITORY,
    publicRepo: process.env.CODEX_MOBILE_PUBLIC_REPOSITORY || DEFAULT_PUBLIC_REPOSITORY,
    stateFile: process.env.CODEX_MOBILE_PR_AUTOMATION_STATE || defaultStateFile(process.cwd()),
    writeState: false,
    workspaceCwd: process.cwd(),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--help" || item === "-h") {
      args.help = true;
    } else if (item === "--json") {
      args.json = true;
    } else if (item === "--write-state") {
      args.writeState = true;
    } else if (item === "--fixture") {
      args.fixture = String(argv[++index] || "");
    } else if (item === "--private-repo") {
      args.privateRepo = String(argv[++index] || "");
    } else if (item === "--public-repo") {
      args.publicRepo = String(argv[++index] || "");
    } else if (item === "--state-file") {
      args.stateFile = String(argv[++index] || "");
    } else if (item === "--workspace-cwd") {
      args.workspaceCwd = String(argv[++index] || "");
    } else {
      throw new Error(`Unknown argument: ${item}`);
    }
  }
  return args;
}

function printHelp() {
  process.stdout.write([
    "Usage: node scripts/codex-mobile-pr-automation.js [--json] [--fixture FILE] [--write-state]",
    "",
    "Runs one bounded PR automation planning pass.",
    "The script does not merge, deploy, push public, or close PRs directly.",
    "",
  ].join("\n"));
}

function readJsonFile(filePath, fallback = null) {
  if (!filePath) return fallback;
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    const wrapped = new Error(`failed_to_read_json:${path.basename(filePath)}`);
    wrapped.cause = err;
    throw wrapped;
  }
}

function writeJsonFile(filePath, value) {
  if (!filePath) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function execText(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: options.timeoutMs || 30000,
  });
}

function commandAvailable(command) {
  try {
    execText(command, ["--version"], { timeoutMs: 5000 });
    return true;
  } catch (_) {
    return false;
  }
}

function githubCredentialsAvailable() {
  if (!commandAvailable("gh")) {
    return { available: false, issueCode: "github_cli_missing" };
  }
  try {
    execText("gh", ["auth", "status", "--hostname", "github.com"], { timeoutMs: 15000 });
    return { available: true };
  } catch (_) {
    return { available: false, issueCode: "github_credentials_missing" };
  }
}

function parseJsonCommand(command, args, options = {}) {
  const output = execText(command, args, options);
  return JSON.parse(output || "null");
}

function readPullRequestFiles(repository, number) {
  try {
    const view = parseJsonCommand("gh", [
      "pr",
      "view",
      String(number),
      "--repo",
      repository,
      "--json",
      "files",
    ], { timeoutMs: 30000 });
    return Array.isArray(view && view.files) ? view.files : [];
  } catch (_) {
    return [];
  }
}

function readOpenPullRequests(repository, repoKind) {
  const fields = [
    "number",
    "title",
    "url",
    "headRefName",
    "headRefOid",
    "baseRefName",
    "baseRefOid",
    "author",
    "isDraft",
    "mergeStateStatus",
    "createdAt",
    "updatedAt",
    "labels",
  ].join(",");
  const list = parseJsonCommand("gh", [
    "pr",
    "list",
    "--repo",
    repository,
    "--state",
    "open",
    "--limit",
    "20",
    "--json",
    fields,
  ], { timeoutMs: 30000 });
  return (Array.isArray(list) ? list : []).map((pr) => Object.assign({}, pr, {
    repoKind,
    repository,
    files: readPullRequestFiles(repository, pr.number),
  }));
}

function readWorktreeStatus(cwd) {
  try {
    const output = execText("git", ["status", "--porcelain"], { cwd, timeoutMs: 15000 });
    return {
      cwd,
      dirty: output.trim().length > 0,
      cleanWorktreeAvailable: true,
    };
  } catch (_) {
    return {
      cwd,
      dirty: false,
      cleanWorktreeAvailable: true,
    };
  }
}

function createRunOptions(args) {
  const existingState = readJsonFile(args.stateFile, { records: [] }) || { records: [] };
  if (args.fixture) {
    const fixture = readJsonFile(args.fixture, {});
    return Object.assign({}, fixture, {
      records: [...(Array.isArray(existingState.records) ? existingState.records : []), ...(Array.isArray(fixture.records) ? fixture.records : [])],
      stateRecords: [...(Array.isArray(existingState.records) ? existingState.records : []), ...(Array.isArray(fixture.stateRecords) ? fixture.stateRecords : [])],
      workspaceCwd: fixture.workspaceCwd || args.workspaceCwd,
    });
  }

  const githubCredentials = githubCredentialsAvailable();
  if (!githubCredentials.available) {
    return {
      githubCredentials,
      privateRepository: args.privateRepo,
      publicRepository: args.publicRepo,
      records: existingState.records || [],
      workspaceCwd: args.workspaceCwd,
      worktree: readWorktreeStatus(args.workspaceCwd),
    };
  }

  return {
    githubCredentials,
    privateRepository: args.privateRepo,
    publicRepository: args.publicRepo,
    privateOpenPullRequests: readOpenPullRequests(args.privateRepo, "private"),
    publicOpenPullRequests: readOpenPullRequests(args.publicRepo, "public"),
    records: existingState.records || [],
    workspaceCwd: args.workspaceCwd,
    worktree: readWorktreeStatus(args.workspaceCwd),
  };
}

function printHuman(run) {
  const selected = run.selectedPullRequest || {};
  process.stdout.write([
    `state=${run.state}`,
    `issueCode=${run.issueCode || ""}`,
    `openPrivate=${run.openPullRequestSummary.privateCount}`,
    `openPublic=${run.openPullRequestSummary.publicCount}`,
    selected.identity ? `selected=${selected.identity}` : "selected=",
    `taskCardRequests=${Array.isArray(run.taskCardRequests) ? run.taskCardRequests.length : 0}`,
    "",
  ].join("\n"));
}

function main() {
  const args = parseArgs();
  if (args.help) {
    printHelp();
    return;
  }
  const runOptions = createRunOptions(args);
  const run = planPrAutomationRun(runOptions);
  if (args.writeState) {
    const existing = readJsonFile(args.stateFile, { records: [] }) || { records: [] };
    writeJsonFile(args.stateFile, mergeAutomationState(existing, run));
  }
  if (args.json) {
    process.stdout.write(`${JSON.stringify(run, null, 2)}\n`);
  } else {
    printHuman(run);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`${String(err && err.message || err).slice(0, 240)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  createRunOptions,
  parseArgs,
};
