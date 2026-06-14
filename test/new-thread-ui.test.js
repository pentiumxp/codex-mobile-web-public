"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");

function functionBody(name) {
  let start = appJs.indexOf(`function ${name}(`);
  if (start < 0) start = appJs.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const bodyStart = appJs.indexOf(") {", start) + 2;
  assert.notEqual(bodyStart, 1, `missing function body ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < appJs.length; index += 1) {
    const char = appJs[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return appJs.slice(bodyStart + 1, index);
  }
  throw new Error(`could not parse function ${name}`);
}

test("new-thread draft renders model, reasoning, and permission controls", () => {
  assert.match(appJs, /id="composerModelControl"|composerModelControl/, "composer should include a model control");
  assert.match(appJs, /id="composerEffortControl"|composerEffortControl/, "composer should include a reasoning control");
  assert.match(appJs, /id="composerPermissionControl"|composerPermissionControl/, "composer should include a permission control");

  const body = functionBody("renderNewThreadDraft");
  assert.doesNotMatch(body, /new-thread-settings/, "new-thread page should not duplicate runtime settings in the page body");
  assert.match(body, /不指定 Workspace/);
  assert.match(body, /将按 Codex App 的项目外聊天方式创建/);
  assert.match(functionBody("newThreadWorkspaceOptionsHtml"), /data-new-thread-workspace=""/);
  assert.match(functionBody("newThreadWorkspaceOptionsHtml"), /projectless-thread|项目外聊天/);
});

test("new-thread draft can send without selecting a workspace", () => {
  const body = functionBody("updateComposerControls");

  assert.match(body, /const canComposeNewThread = Boolean\(hasNewThreadDraft\);/);
  assert.doesNotMatch(body, /hasNewThreadDraft && state\.selectedCwd/);
});

test("new-thread message submission includes selected runtime settings", () => {
  const body = functionBody("sendNewThreadMessage");

  assert.match(body, /const submittedModel = newThreadSelectedModel\(\)/);
  assert.match(body, /const submittedEffort = newThreadSelectedEffort\(\)/);
  assert.match(body, /const submittedPermissionMode = newThreadSelectedPermissionMode\(\)/);
  assert.match(body, /body\.append\("model",\s*submittedModel\)/);
  assert.match(body, /body\.append\("effort",\s*submittedEffort\)/);
  assert.match(body, /body\.append\("permissionMode",\s*submittedPermissionMode\)/);
  assert.match(body, /state\.composerEffort = submittedEffort \|\| "";/);
  assert.match(body, /writeCurrentDraftToKey\(draftKeyForThread\(threadId\)\)/);
});

test("existing-thread message submission includes selected runtime settings", () => {
  const body = functionBody("sendMessage");

  assert.match(body, /body\.append\("model",\s*selectedComposerModel\(\)\)/);
  assert.match(body, /body\.append\("effort",\s*selectedComposerEffort\(\)\)/);
  assert.match(body, /body\.append\("permissionMode",\s*selectedComposerPermissionMode\(\)\)/);
});

test("quota display falls back only to a compatible account quota group", () => {
  const body = functionBody("rateLimitsForQuota");

  assert.match(body, /state\.rateLimitsByModel\[modelKey\]/, "quota should prefer exact model cache first");
  assert.match(body, /isRateLimitCompatibleWithModel\(state\.rateLimits,\s*modelKey\)/, "quota should fall back only within the same quota group");
});

test("quota UI ignores source-less rate-limit notifications", () => {
  const body = functionBody("applyNotification");

  assert.match(body, /method === "account\/rateLimits\/updated"/);
  assert.doesNotMatch(body, /rememberRateLimits\(params\.rateLimits/, "source-less quota notifications should not overwrite composer quota");
});

test("quota UI clears stale cache when config has no valid quota snapshot", () => {
  const body = functionBody("rememberRateLimitsFromConfig");

  assert.match(body, /hasRateLimitSnapshot\(config\.rateLimits \|\| null,\s*config\.rateLimitsByModel \|\| null\)/);
  assert.match(appJs, /function shouldKeepStoredRateLimitsOnEmptyConfig\(\)[\s\S]*isHermesEmbedMode\(\)[\s\S]*hasRateLimitSnapshot\(state\.rateLimits,\s*state\.rateLimitsByModel\)/);
  assert.match(body, /else if \(shouldKeepStoredRateLimitsOnEmptyConfig\(\)\)[\s\S]*renderQuotaUsage\(\)/);
  assert.match(body, /clearStoredRateLimits\(\)/);
});

test("quota grouping treats Spark as independent and other Codex models as shared", () => {
  const body = functionBody("rateLimitModelKeys");

  assert.match(body, /limitId === "codex-bengalfox"[\s\S]*gpt-5\.3-codex-spark/, "Spark quota should map to the Spark model");
  assert.match(body, /limitId === "codex"[\s\S]*!isSparkModelKey\(modelKey\)/, "Codex quota should map to non-Spark models");
});
