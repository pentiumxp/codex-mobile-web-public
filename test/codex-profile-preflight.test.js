"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

process.env.CODEX_MOBILE_DISABLE_AUTH = "1";

const {
  profileSwitchPreflightError,
} = require("../server");

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
