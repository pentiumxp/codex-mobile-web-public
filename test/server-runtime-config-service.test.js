"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const crypto = require("node:crypto");
const { createServerRuntimeConfigService } = require("../services/runtime/server-runtime-config-service");

function createConfig(overrides = {}) {
  const env = Object.assign({}, overrides.env || {});
  const appRoot = overrides.appRoot || "/repo/codex-mobile-web";
  const userHome = overrides.userHome || "/home/tester";
  const serverRuntimeUtils = {
    readPackageVersion: () => overrides.appVersion || "9.8.7",
    resolveDefaultCodexExecutable: () => overrides.codexExe || "/bin/codex",
    resolveMuxEndpointFile: (_env, codexHome) => path.join(codexHome, "mux", "endpoint.json"),
    optionListFromEnv: (name, fallback) => String(env[name] || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .reduce((values, value) => (values.includes(value) ? values : values.concat(value)), [])
      .concat(String(env[name] || "").trim() ? [] : fallback),
    uniqueStrings: (values) => [...new Set((values || []).filter(Boolean))],
    detectDevelopmentWorkspaceRoot: () => "/repo",
  };
  return createServerRuntimeConfigService({
    path,
    crypto,
    env,
    appRoot,
    publicRoot: path.join(appRoot, "public"),
    userHome,
    serverRuntimeUtils,
    resolveActiveCodexHomeFromStore: () => overrides.bootstrap || { activeProfileId: overrides.profileId || "" },
    resolveEffectiveCodexHome: ({ defaultCodexHome, bootstrap }) => ({
      codexHome: overrides.codexHome || defaultCodexHome,
      activeProfileId: bootstrap && bootstrap.activeProfileId || "",
    }),
    normalizeRepositorySlug: (value) => String(value || "fallback/repo").trim().toLowerCase(),
  }).resolve();
}

test("server runtime config resolves default runtime paths and bounded ids", () => {
  const config = createConfig({ profileId: "profile-main" });

  assert.equal(config.APP_ROOT, "/repo/codex-mobile-web");
  assert.equal(config.PUBLIC_ROOT, "/repo/codex-mobile-web/public");
  assert.equal(config.RUNTIME_ROOT, "/home/tester/.codex-mobile-web");
  assert.equal(config.CODEX_HOME, "/home/tester/.codex");
  assert.equal(config.STATE_DB, "/home/tester/.codex/state_5.sqlite");
  assert.equal(config.MUX_ENDPOINT_FILE, "/home/tester/.codex/mux/endpoint.json");
  assert.equal(config.APP_VERSION, "9.8.7");
  assert.equal(config.THREAD_SIDE_CHAT_SCOPE_ID, "profile-main");
  assert.equal(config.WORKSPACE_DELEGATION_TOOL_FULL_NAME, "mcp__codex_mobile.delegate_to_thread");
  assert.equal(config.TASK_CARD_RETURN_TOOL_FULL_NAME, "mcp__codex_mobile.return_to_source");
  assert.equal(config.HOME_AI_SECRET_REF_CONSUME_PATH, "/api/secret-refs/consume");
  assert.equal(config.HOME_AI_SECRET_REF_TIMEOUT_MS, 12000);
  assert.equal(config.THREAD_TASK_CARD_EXECUTION_WATCHDOG_INTERVAL_MS, 60000);
  assert.equal(config.THREAD_TASK_CARD_EXECUTION_WATCHDOG_STALE_MS, 30 * 60 * 1000);
  assert.equal(config.THREAD_TASK_CARD_EXECUTION_WATCHDOG_LIMIT, 2);
  assert.equal(config.MOBILE_WEB_LOG_MAX_BYTES, 512 * 1024);
  assert.equal(config.MOBILE_WEB_LOG_KEEP_BYTES, 128 * 1024);
  assert.equal(config.MOBILE_WEB_LOG_EVENT_MIN_INTERVAL_MS, 30000);
  assert.equal(config.USER_BEHAVIOR_REPAIR_CARDS_DISABLED, false);
  assert.equal(config.USER_BEHAVIOR_REPAIR_TARGET_THREAD_ID, "");
  assert.equal(config.USER_BEHAVIOR_REPAIR_TARGET_ROLE, "plugin_worker");
  assert.equal(config.USER_BEHAVIOR_REPAIR_TARGET_WORKSPACE, "");
  assert.equal(config.USER_BEHAVIOR_REPAIR_DEDUPE_WINDOW_MS, 60 * 60 * 1000);
});

test("server runtime config applies env overrides and clamps hot-path limits", () => {
  const config = createConfig({
    env: {
      CODEX_MOBILE_RUNTIME_DIR: "/runtime/mobile",
      CODEX_MOBILE_HOST: "127.0.0.1",
      CODEX_MOBILE_PORT: "9999",
      CODEX_MOBILE_ALLOW_WORKSPACE_DELEGATION: "1",
      CODEX_MOBILE_WORKSPACE_DELEGATION_WRITE_GUARD: "0",
      CODEX_MOBILE_THREAD_TURNS: "500",
      CODEX_MOBILE_FULL_THREAD_TURNS: "1",
      CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_LIMIT: "500",
      CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_SOURCE_SNAPSHOT_LIMIT: "50",
      CODEX_MOBILE_MODEL_OPTIONS: "model-a, model-b, model-a",
      CODEX_MOBILE_PUBLIC_PR_REPOSITORY: "Owner/Repo",
      CODEX_MOBILE_HOME_AI_SECRET_REF_BASE_URL: "https://home-ai.example.test",
      CODEX_MOBILE_HOME_AI_SECRET_REF_KEY_FILE: "/runtime/secret-ref-key",
      CODEX_MOBILE_HOME_AI_SECRET_REF_CONSUME_PATH: "/api/native/secret-ref/consume",
      CODEX_MOBILE_HOME_AI_SECRET_REF_TIMEOUT_MS: "2500",
      CODEX_MOBILE_TASK_CARD_EXECUTION_WATCHDOG_INTERVAL_MS: "0",
      CODEX_MOBILE_TASK_CARD_EXECUTION_WATCHDOG_STALE_MS: "10000",
      CODEX_MOBILE_TASK_CARD_EXECUTION_WATCHDOG_LIMIT: "99",
      CODEX_MOBILE_WEB_LOG_MAX_BYTES: "32768",
      CODEX_MOBILE_WEB_LOG_KEEP_BYTES: "8192",
      CODEX_MOBILE_WEB_LOG_EVENT_MIN_INTERVAL_MS: "90000",
      CODEX_MOBILE_USER_BEHAVIOR_REPAIR_CARDS: "off",
      CODEX_MOBILE_USER_BEHAVIOR_REPAIR_TARGET_THREAD_ID: "019f3181-4f2f-7aa3-8ae8-d12f6e23e7a5",
      CODEX_MOBILE_USER_BEHAVIOR_REPAIR_TARGET_ROLE: "plugin_worker",
      CODEX_MOBILE_USER_BEHAVIOR_REPAIR_TARGET_WORKSPACE: "/repo/codex-mobile-web",
      CODEX_MOBILE_USER_BEHAVIOR_REPAIR_DEDUPE_WINDOW_MS: "120000",
    },
    codexHome: "/codex/home",
  });

  assert.equal(config.RUNTIME_ROOT, "/runtime/mobile");
  assert.equal(config.HOST, "127.0.0.1");
  assert.equal(config.PORT, 9999);
  assert.equal(config.WORKSPACE_DELEGATION_ENV_DEFAULT, true);
  assert.equal(config.WORKSPACE_DELEGATION_WRITE_GUARD_DISABLED, true);
  assert.equal(config.MAX_THREAD_TURNS, 100);
  assert.equal(config.MAX_FULL_THREAD_TURNS, 100);
  assert.equal(config.THREAD_LIST_FALLBACK_PREWARM_LIMIT, 200);
  assert.equal(config.THREAD_LIST_FALLBACK_PREWARM_SOURCE_SNAPSHOT_LIMIT, 200);
  assert.deepEqual(config.MODEL_OPTIONS, ["model-a", "model-b"]);
  assert.equal(config.DEFAULT_MODEL, "model-a");
  assert.equal(config.PUBLIC_PR_REPOSITORY, "owner/repo");
  assert.equal(config.HOME_AI_SECRET_REF_BASE_URL, "https://home-ai.example.test");
  assert.equal(config.HOME_AI_SECRET_REF_KEY_FILE, "/runtime/secret-ref-key");
  assert.equal(config.HOME_AI_SECRET_REF_CONSUME_PATH, "/api/native/secret-ref/consume");
  assert.equal(config.HOME_AI_SECRET_REF_TIMEOUT_MS, 2500);
  assert.equal(config.THREAD_TASK_CARD_EXECUTION_WATCHDOG_INTERVAL_MS, 0);
  assert.equal(config.THREAD_TASK_CARD_EXECUTION_WATCHDOG_STALE_MS, 30000);
  assert.equal(config.THREAD_TASK_CARD_EXECUTION_WATCHDOG_LIMIT, 8);
  assert.equal(config.MOBILE_WEB_LOG_MAX_BYTES, 64 * 1024);
  assert.equal(config.MOBILE_WEB_LOG_KEEP_BYTES, 16 * 1024);
  assert.equal(config.MOBILE_WEB_LOG_EVENT_MIN_INTERVAL_MS, 60 * 1000);
  assert.equal(config.USER_BEHAVIOR_REPAIR_CARDS_DISABLED, true);
  assert.equal(config.USER_BEHAVIOR_REPAIR_TARGET_THREAD_ID, "019f3181-4f2f-7aa3-8ae8-d12f6e23e7a5");
  assert.equal(config.USER_BEHAVIOR_REPAIR_TARGET_ROLE, "plugin_worker");
  assert.equal(config.USER_BEHAVIOR_REPAIR_TARGET_WORKSPACE, "/repo/codex-mobile-web");
  assert.equal(config.USER_BEHAVIOR_REPAIR_DEDUPE_WINDOW_MS, 120000);
});

test("server runtime config keeps duplicate desktop global state files unique", () => {
  const config = createConfig({
    env: {
      CODEX_MOBILE_SYNC_DESKTOP_WORKSPACES: "true",
      CODEX_MOBILE_DESKTOP_GLOBAL_STATE_FILE: "/home/tester/.codex/.codex-global-state.json",
    },
    codexHome: "/home/tester/.codex",
  });

  assert.deepEqual(config.DESKTOP_GLOBAL_STATE_FILES, [
    "/home/tester/.codex/.codex-global-state.json",
  ]);
});
