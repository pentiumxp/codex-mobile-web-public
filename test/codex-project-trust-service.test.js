"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  ensureTrustedProjectsInConfig,
  projectPathsFromConfig,
} = require("../adapters/codex-project-trust-service");

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "codex-project-trust-"));
}

test("trusted project service appends missing project entries idempotently", () => {
  const root = tempRoot();
  const configPath = path.join(root, "config.toml");
  const workspace = path.join(root, "Music");
  fs.mkdirSync(workspace);
  const canonicalWorkspace = fs.realpathSync(workspace);
  fs.writeFileSync(configPath, 'model = "gpt-5.5"\n\n[projects."/tmp/existing"]\ntrust_level = "trusted"\n', "utf8");

  const first = ensureTrustedProjectsInConfig(configPath, [workspace, workspace]);
  const second = ensureTrustedProjectsInConfig(configPath, [workspace]);
  const text = fs.readFileSync(configPath, "utf8");

  assert.equal(first.changed, true);
  assert.deepEqual(first.added, [canonicalWorkspace]);
  assert.equal(second.changed, false);
  assert.equal((text.match(/\[projects\./g) || []).length, 2);
  assert.ok(projectPathsFromConfig(text).includes(canonicalWorkspace));
  assert.match(text, new RegExp(`\\[projects\\.${JSON.stringify(canonicalWorkspace).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`));
});

test("trusted project parser recognizes basic and literal project headers", () => {
  const text = [
    '[projects."/Users/xuxin/Documents/Music"]',
    'trust_level = "trusted"',
    "",
    "[projects.'/Users/xuxin/Documents/Home AI']",
    'trust_level = "trusted"',
    "",
  ].join("\n");

  assert.deepEqual(projectPathsFromConfig(text), [
    "/Users/xuxin/Documents/Music",
    "/Users/xuxin/Documents/Home AI",
  ]);
});
