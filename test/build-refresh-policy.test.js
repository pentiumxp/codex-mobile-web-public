"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const policy = require(path.resolve(__dirname, "..", "public", "build-refresh-policy.js"));

test("build refresh policy extracts shell cache sequence from full build ids", () => {
  assert.equal(policy.shellSequenceFromBuildId("0.1.11|codex-mobile-shell-v205"), 205);
  assert.equal(policy.shellSequenceFromBuildId("codex-mobile-shell-v7"), 7);
  assert.equal(policy.shellSequenceFromBuildId("0.1.11|static-hash"), null);
});

test("build refresh policy prompts only when the server shell is newer", () => {
  assert.equal(
    policy.classifyServerBuildChange("0.1.11|codex-mobile-shell-v205", "0.1.11|codex-mobile-shell-v204"),
    "server-newer",
  );
  assert.equal(
    policy.shouldPromptForServerBuildChange("0.1.11|codex-mobile-shell-v205", "0.1.11|codex-mobile-shell-v204"),
    true,
  );
});

test("build refresh policy suppresses impossible refresh loops when the loaded client is newer", () => {
  assert.equal(
    policy.classifyServerBuildChange("0.1.11|codex-mobile-shell-v201", "0.1.11|codex-mobile-shell-v205"),
    "client-newer",
  );
  assert.equal(
    policy.shouldPromptForServerBuildChange("0.1.11|codex-mobile-shell-v201", "0.1.11|codex-mobile-shell-v205"),
    false,
  );
});

test("build refresh policy preserves conservative prompting for non-comparable build ids", () => {
  assert.equal(policy.classifyServerBuildChange("server-hash-b", "server-hash-a"), "changed");
  assert.equal(policy.shouldPromptForServerBuildChange("server-hash-b", "server-hash-a"), true);
  assert.equal(policy.shouldPromptForServerBuildChange("server-hash-b", "server-hash-b"), false);
});
