"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const { createCodexProfileSwitchService } = require("../adapters/codex-profile-switch-service");

const {
  profileSwitchPreflightError,
  profileSwitchRateLimitsWarningForError,
} = createCodexProfileSwitchService();

test("profile switch preflight classifies expired target auth before switching", () => {
  const result = profileSwitchPreflightError(new Error(
    "failed to fetch codex rate limits: GET https://chatgpt.com/backend-api/wham/usage failed: 401 Unauthorized; code=token_expired refresh_token_reused",
  ));

  assert.equal(result.code, "target_profile_auth_invalid");
  assert.match(result.message, /目标 Codex 账号登录已失效/);
});

test("profile switch preflight classifies app-server startup failures", () => {
  const result = profileSwitchPreflightError(new Error("spawn ENOENT"));

  assert.equal(result.code, "target_profile_app_server_unavailable");
  assert.match(result.message, /app-server 无法启动/);
});

test("profile switch preflight downgrades transient rate-limit read failures to warnings", () => {
  const warning = profileSwitchRateLimitsWarningForError(new Error(
    "failed to fetch codex rate limits: error sending request for url (https://chatgpt.com/backend-api/wham/usage)",
  ));

  assert.ok(warning, "expected transient rate-limit read failure to produce a warning");
  assert.equal(warning.code, "target_profile_rate_limits_unavailable");
  assert.match(warning.message, /额度暂时读取失败/);
  assert.match(warning.detail, /failed to fetch codex rate limits/);
});

test("profile switch preflight does not downgrade target auth failures", () => {
  const warning = profileSwitchRateLimitsWarningForError(new Error(
    "failed to fetch codex rate limits: GET https://chatgpt.com/backend-api/wham/usage failed: 401 Unauthorized; code=token_expired",
  ));

  assert.equal(warning, null);
});
