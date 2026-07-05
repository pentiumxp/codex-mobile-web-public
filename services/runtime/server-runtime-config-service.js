"use strict";

function boolFlag(value) {
  return /^(1|true|yes|on)$/i.test(String(value || ""));
}

function offFlag(value) {
  return /^(0|false|no|off)$/i.test(String(value || ""));
}

function boundedNumber(value, fallback, min = -Infinity, max = Infinity) {
  const parsed = Number(value);
  const number = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(min, Math.min(max, number));
}

function createServerRuntimeConfigService(dependencies = {}) {
  const path = dependencies.path || require("node:path");
  const crypto = dependencies.crypto || require("node:crypto");
  const env = dependencies.env || process.env;
  const appRoot = dependencies.appRoot || process.cwd();
  const publicRoot = dependencies.publicRoot || path.join(appRoot, "public");
  const userHome = dependencies.userHome || env.USERPROFILE || env.HOME || process.cwd();
  const serverRuntimeUtils = dependencies.serverRuntimeUtils || {};
  const readPackageVersion = typeof serverRuntimeUtils.readPackageVersion === "function"
    ? serverRuntimeUtils.readPackageVersion
    : () => "0.0.0";
  const resolveDefaultCodexExecutable = typeof serverRuntimeUtils.resolveDefaultCodexExecutable === "function"
    ? serverRuntimeUtils.resolveDefaultCodexExecutable
    : () => "codex";
  const resolveMuxEndpointFile = typeof serverRuntimeUtils.resolveMuxEndpointFile === "function"
    ? serverRuntimeUtils.resolveMuxEndpointFile
    : (_env, codexHome) => path.join(codexHome || "", "app-server-mux", "endpoint.json");
  const optionListFromEnv = typeof serverRuntimeUtils.optionListFromEnv === "function"
    ? serverRuntimeUtils.optionListFromEnv
    : (name, fallback) => String(env[name] || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .reduce((values, value) => (values.includes(value) ? values : values.concat(value)), [])
      .concat(String(env[name] || "").trim() ? [] : fallback || []);
  const uniqueStrings = typeof serverRuntimeUtils.uniqueStrings === "function"
    ? serverRuntimeUtils.uniqueStrings
    : (values) => [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
  const detectDevelopmentWorkspaceRoot = typeof serverRuntimeUtils.detectDevelopmentWorkspaceRoot === "function"
    ? serverRuntimeUtils.detectDevelopmentWorkspaceRoot
    : () => "";
  const resolveActiveCodexHomeFromStore = typeof dependencies.resolveActiveCodexHomeFromStore === "function"
    ? dependencies.resolveActiveCodexHomeFromStore
    : () => ({});
  const resolveEffectiveCodexHome = typeof dependencies.resolveEffectiveCodexHome === "function"
    ? dependencies.resolveEffectiveCodexHome
    : ({ defaultCodexHome }) => ({ codexHome: defaultCodexHome || "" });
  const normalizeRepositorySlug = typeof dependencies.normalizeRepositorySlug === "function"
    ? dependencies.normalizeRepositorySlug
    : (value, fallback = "pentiumxp/codex-mobile-web-public") => String(value || fallback || "").trim();

  function resolve() {
    const RUNTIME_ROOT = env.CODEX_MOBILE_RUNTIME_DIR || path.join(userHome, ".codex-mobile-web");
    const CODEX_PROFILE_BOOTSTRAP = resolveActiveCodexHomeFromStore({
      userHome,
      runtimeRoot: RUNTIME_ROOT,
      env,
    });
    const DEFAULT_CODEX_HOME = path.join(userHome, ".codex");
    const CODEX_HOME_RESOLUTION = resolveEffectiveCodexHome({
      userHome,
      runtimeRoot: RUNTIME_ROOT,
      env,
      defaultCodexHome: DEFAULT_CODEX_HOME,
      bootstrap: CODEX_PROFILE_BOOTSTRAP,
    });
    const CODEX_HOME = CODEX_HOME_RESOLUTION.codexHome;
    const APP_VERSION = readPackageVersion();
    const PUBLIC_PR_REPOSITORY = normalizeRepositorySlug(
      env.CODEX_MOBILE_PUBLIC_PR_REPOSITORY || "pentiumxp/codex-mobile-web-public",
    );
    const THREAD_SIDE_CHAT_SCOPE_ID = CODEX_HOME_RESOLUTION.activeProfileId
      || `codex-home-${crypto.createHash("sha256").update(CODEX_HOME).digest("hex").slice(0, 16)}`;
    const MODEL_OPTIONS = optionListFromEnv("CODEX_MOBILE_MODEL_OPTIONS", [
      "gpt-5.5",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.3-codex",
      "gpt-5.3-codex-spark",
      "gpt-5.2",
    ]);
    const DEFAULT_MODEL = MODEL_OPTIONS[0] || "gpt-5.5";
    const REASONING_EFFORT_OPTIONS = optionListFromEnv("CODEX_MOBILE_REASONING_EFFORT_OPTIONS", [
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    const PERMISSION_MODE_OPTIONS = optionListFromEnv("CODEX_MOBILE_PERMISSION_MODE_OPTIONS", [
      "default",
      "auto",
      "full",
      "custom",
    ]);
    const MAX_THREAD_TURNS = boundedNumber(env.CODEX_MOBILE_THREAD_TURNS || "10", 10, 1, 100);
    const MAX_FULL_THREAD_TURNS = Math.max(
      MAX_THREAD_TURNS,
      boundedNumber(env.CODEX_MOBILE_FULL_THREAD_TURNS || "10", 10, -Infinity, 200),
    );
    const MOBILE_WEB_LOG_MAX_BYTES = boundedNumber(
      env.CODEX_MOBILE_WEB_LOG_MAX_BYTES || String(512 * 1024),
      512 * 1024,
      64 * 1024,
      50 * 1024 * 1024,
    );
    const MOBILE_WEB_LOG_EVENT_MIN_INTERVAL_MS = boundedNumber(
      env.CODEX_MOBILE_WEB_LOG_EVENT_MIN_INTERVAL_MS || "30000",
      30000,
      0,
      60 * 1000,
    );
    const THREAD_LIST_FALLBACK_PREWARM_LIMIT = boundedNumber(
      env.CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_LIMIT || "40",
      40,
      1,
      200,
    );
    const THREAD_LIST_FALLBACK_PREWARM_SOURCE_SNAPSHOT_LIMIT_RAW = Number(
      env.CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_SOURCE_SNAPSHOT_LIMIT || "1000",
    );
    const THREAD_LIST_FALLBACK_PREWARM_SOURCE_SNAPSHOT_LIMIT = Math.max(
      Math.max(200, THREAD_LIST_FALLBACK_PREWARM_LIMIT),
      Math.min(1000, Number.isFinite(THREAD_LIST_FALLBACK_PREWARM_SOURCE_SNAPSHOT_LIMIT_RAW)
        ? THREAD_LIST_FALLBACK_PREWARM_SOURCE_SNAPSHOT_LIMIT_RAW
        : 1000),
    );
    const MAX_ROLLOUT_CONTEXT_BYTES = Math.max(
      256 * 1024,
      Number(env.CODEX_MOBILE_ROLLOUT_CONTEXT_BYTES || String(4 * 1024 * 1024)),
    );
    const CONTINUATION_CONTEXT_FILE_COMPACT_BYTES = Math.max(
      50 * 1024,
      Number(env.CODEX_MOBILE_CONTINUATION_CONTEXT_FILE_COMPACT_BYTES || String(100 * 1024)),
    );

    return {
      APP_ROOT: appRoot,
      PUBLIC_ROOT: publicRoot,
      USER_HOME: userHome,
      RUNTIME_ROOT,
      CODEX_PROFILE_BOOTSTRAP,
      DEFAULT_CODEX_HOME,
      CODEX_HOME_RESOLUTION,
      CODEX_HOME,
      STATE_DB: path.join(CODEX_HOME, "state_5.sqlite"),
      GOALS_DB: path.join(CODEX_HOME, "goals_1.sqlite"),
      SESSIONS_DIR: path.join(CODEX_HOME, "sessions"),
      ARCHIVED_SESSIONS_DIR: path.join(CODEX_HOME, "archived_sessions"),
      MOBILE_ARCHIVED_THREAD_IDS_FILE: env.CODEX_MOBILE_ARCHIVED_THREAD_IDS_FILE
        || path.join(RUNTIME_ROOT, "archived-thread-ids.json"),
      CODEX_EXE: resolveDefaultCodexExecutable(),
      MUX_ENDPOINT_FILE: resolveMuxEndpointFile(env, CODEX_HOME, CODEX_HOME_RESOLUTION),
      EXTERNAL_APP_SERVER_WS: env.CODEX_MOBILE_APP_SERVER_WS || "",
      EXTERNAL_APP_SERVER_TCP: env.CODEX_MOBILE_APP_SERVER_TCP || "",
      REQUIRE_SHARED_APP_SERVER: boolFlag(env.CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER),
      DISABLE_MOBILE_OWNED_MUX: boolFlag(env.CODEX_MOBILE_DISABLE_OWNED_MUX),
      PERSIST_MOBILE_OWNED_MUX: boolFlag(env.CODEX_MOBILE_PERSIST_OWNED_MUX),
      MAX_APP_SERVER_INBOUND_MESSAGE_BYTES: boundedNumber(
        env.CODEX_MOBILE_APP_SERVER_MAX_MESSAGE_BYTES || String(64 * 1024 * 1024),
        64 * 1024 * 1024,
        1024 * 1024,
        512 * 1024 * 1024,
      ),
      HOST: env.CODEX_MOBILE_HOST || "0.0.0.0",
      PORT: Number(env.CODEX_MOBILE_PORT || "8787"),
      APP_VERSION,
      APP_UPDATE_REMOTE: env.CODEX_MOBILE_UPDATE_REMOTE || "origin",
      APP_UPDATE_BRANCH: env.CODEX_MOBILE_UPDATE_BRANCH || "main",
      APP_UPDATE_DISABLED: boolFlag(env.CODEX_MOBILE_DISABLE_UPDATE_CHECK),
      APP_UPDATE_CHECK_TIMEOUT_MS: Math.max(1000, Number(env.CODEX_MOBILE_UPDATE_CHECK_TIMEOUT_MS || "15000")),
      APP_UPDATE_APPLY_TIMEOUT_MS: Math.max(5000, Number(env.CODEX_MOBILE_UPDATE_APPLY_TIMEOUT_MS || "120000")),
      APP_UPDATE_RESTART_DELAY_MS: Math.max(500, Number(env.CODEX_MOBILE_UPDATE_RESTART_DELAY_MS || "1200")),
      APP_UPDATE_CACHE_MS: Math.max(30_000, Number(env.CODEX_MOBILE_UPDATE_CACHE_MS || "900000")),
      PUBLIC_PR_CHECK_DISABLED: boolFlag(env.CODEX_MOBILE_DISABLE_PUBLIC_PR_CHECK),
      PUBLIC_PR_REPOSITORY,
      PUBLIC_PR_CHECK_TIMEOUT_MS: Math.max(1000, Number(env.CODEX_MOBILE_PUBLIC_PR_CHECK_TIMEOUT_MS || "12000")),
      PUBLIC_PR_CHECK_CACHE_MS: Math.max(30_000, Number(env.CODEX_MOBILE_PUBLIC_PR_CHECK_CACHE_MS || "900000")),
      GITHUB_LINK_PREVIEW_TIMEOUT_MS: Math.max(1000, Number(env.CODEX_MOBILE_GITHUB_LINK_PREVIEW_TIMEOUT_MS || "12000")),
      GITHUB_LINK_PREVIEW_CACHE_MS: Math.max(30_000, Number(env.CODEX_MOBILE_GITHUB_LINK_PREVIEW_CACHE_MS || "900000")),
      AUTO_TURN_RECOVERY_COOLDOWN_MS: Math.max(30_000, Number(env.CODEX_MOBILE_AUTO_TURN_RECOVERY_COOLDOWN_MS || "120000")),
      AUTO_TURN_RECOVERY_PROMPT: String(env.CODEX_MOBILE_AUTO_TURN_RECOVERY_PROMPT || "继续当前任务。上一轮可能因为 Codex Mobile Listener 或 app-server 重启而断开；请基于当前线程上下文继续未完成的工作，不要重复已经完成的内容。").trim(),
      PUBLIC_RELEASE_CHECK_DISABLED: boolFlag(env.CODEX_MOBILE_DISABLE_PUBLIC_RELEASE_CHECK),
      PUBLIC_RELEASE_REPOSITORY: normalizeRepositorySlug(env.CODEX_MOBILE_PUBLIC_RELEASE_REPOSITORY || PUBLIC_PR_REPOSITORY),
      PUBLIC_RELEASE_BRANCH: env.CODEX_MOBILE_PUBLIC_RELEASE_BRANCH || "main",
      PUBLIC_RELEASE_CHECK_CACHE_MS: Math.max(30_000, Number(env.CODEX_MOBILE_PUBLIC_RELEASE_CHECK_CACHE_MS || "900000")),
      SHARED_CHAIN_RESTART_TASK_NAME: env.CODEX_MOBILE_RESTART_TASK_NAME || "Codex Mobile Web",
      SHARED_CHAIN_RESTART_DELAY_MS: Math.max(500, Number(env.CODEX_MOBILE_SHARED_CHAIN_RESTART_DELAY_MS || "900")),
      DISABLE_AUTH: boolFlag(env.CODEX_MOBILE_DISABLE_AUTH),
      AUTH_KEY_FILE: env.CODEX_MOBILE_KEY_FILE || path.join(RUNTIME_ROOT, "access_key"),
      HERMES_PLUGIN_REGISTRATION_FILE: env.CODEX_MOBILE_HERMES_PLUGIN_REGISTRATION_FILE
        || path.join(RUNTIME_ROOT, "hermes-plugin-registration.json"),
      HERMES_PLUGIN_BASE_URL: env.CODEX_MOBILE_HERMES_PLUGIN_BASE_URL
        || env.CODEX_MOBILE_PUBLIC_BASE_URL
        || "",
      HERMES_PLUGIN_LAUNCH_TOKEN_TTL_MS: Math.max(
        30_000,
        Number(env.CODEX_MOBILE_HERMES_PLUGIN_LAUNCH_TOKEN_TTL_MS || String(5 * 60 * 1000)),
      ),
      HERMES_PLUGIN_SESSION_TTL_MS: Math.max(
        5 * 60_000,
        Number(env.CODEX_MOBILE_HERMES_PLUGIN_SESSION_TTL_MS || String(12 * 60 * 60 * 1000)),
      ),
      HERMES_PLUGIN_FRAME_ORIGINS: env.CODEX_MOBILE_HERMES_PLUGIN_FRAME_ORIGINS || "",
      HERMES_PLUGIN_NOTIFICATION_BASE_URL: env.CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_BASE_URL || "",
      HERMES_PLUGIN_NOTIFICATION_KEY: env.CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY
        || env.CODEX_MOBILE_HERMES_WEB_KEY
        || "",
      HERMES_PLUGIN_NOTIFICATION_KEY_FILE: env.CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY_FILE
        || env.CODEX_MOBILE_HERMES_WEB_KEY_FILE
        || "",
      HOME_AI_SECRET_REF_BASE_URL: env.CODEX_MOBILE_HOME_AI_SECRET_REF_BASE_URL
        || env.CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_BASE_URL
        || "",
      HOME_AI_SECRET_REF_KEY: env.CODEX_MOBILE_HOME_AI_SECRET_REF_KEY
        || env.CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY
        || env.CODEX_MOBILE_HERMES_WEB_KEY
        || "",
      HOME_AI_SECRET_REF_KEY_FILE: env.CODEX_MOBILE_HOME_AI_SECRET_REF_KEY_FILE
        || env.CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY_FILE
        || env.CODEX_MOBILE_HERMES_WEB_KEY_FILE
        || "",
      HOME_AI_SECRET_REF_CONSUME_PATH: env.CODEX_MOBILE_HOME_AI_SECRET_REF_CONSUME_PATH
        || "/api/secret-refs/consume",
      HOME_AI_SECRET_REF_TIMEOUT_MS: Math.max(1000, Number(env.CODEX_MOBILE_HOME_AI_SECRET_REF_TIMEOUT_MS || "12000")),
      THREAD_TASK_CARD_FILE: env.CODEX_MOBILE_THREAD_TASK_CARD_FILE
        || path.join(RUNTIME_ROOT, "thread-task-cards.json"),
      AT_LOOP_STATE_FILE: env.CODEX_MOBILE_AT_LOOP_STATE_FILE
        || path.join(RUNTIME_ROOT, "at-loop-state.json"),
      RUNTIME_SETTINGS_FILE: env.CODEX_MOBILE_SETTINGS_FILE
        || path.join(RUNTIME_ROOT, "settings.json"),
      THREAD_SIDE_CHAT_FILE: env.CODEX_MOBILE_THREAD_SIDE_CHAT_FILE
        || path.join(RUNTIME_ROOT, "thread-side-chats.json"),
      CHATGPT_PRO_BRIDGE_FILE: env.CODEX_MOBILE_CHATGPT_PRO_BRIDGE_FILE
        || path.join(RUNTIME_ROOT, "chatgpt-pro-bridge-state.json"),
      CHATGPT_PRO_OUTPUT_DIR: env.CODEX_MOBILE_CHATGPT_PRO_OUTPUT_DIR
        || path.join(RUNTIME_ROOT, "outputs", "chatgpt-pro"),
      CHATGPT_PRO_BRIDGE_ENABLED: !boolFlag(env.CODEX_MOBILE_DISABLE_CHATGPT_PRO_BRIDGE),
      CHATGPT_PRO_PLANNER_DIR: env.CODEX_MOBILE_CHATGPT_PRO_PLANNER_DIR
        || path.join(RUNTIME_ROOT, "chatgpt-pro-planner"),
      CHATGPT_PRO_MCP_TOKEN: env.CODEX_MOBILE_CHATGPT_PRO_MCP_TOKEN || "",
      CHATGPT_PRO_MCP_TOKEN_FILE: env.CODEX_MOBILE_CHATGPT_PRO_MCP_TOKEN_FILE || "",
      CHATGPT_PRO_MCP_ALLOW_DIRECT_TASK_CARDS: boolFlag(env.CODEX_MOBILE_CHATGPT_PRO_MCP_ALLOW_DIRECT_TASK_CARDS),
      WORKSPACE_DELEGATION_ENV_DEFAULT: boolFlag(
        env.CODEX_MOBILE_ALLOW_WORKSPACE_DELEGATION
          || env.CODEX_MOBILE_WORKSPACE_DELEGATION_ENABLED,
      ),
      WORKSPACE_DELEGATION_WRITE_GUARD_DISABLED: offFlag(env.CODEX_MOBILE_WORKSPACE_DELEGATION_WRITE_GUARD)
        || boolFlag(env.CODEX_MOBILE_WORKSPACE_DELEGATION_DISABLE_WRITE_GUARD),
      WORKSPACE_DELEGATION_ENFORCE_SANDBOX_GUARD: boolFlag(env.CODEX_MOBILE_WORKSPACE_DELEGATION_ENFORCE_SANDBOX_GUARD),
      WORKSPACE_DELEGATION_APPROVAL_PROXY_ONLY: boolFlag(env.CODEX_MOBILE_WORKSPACE_DELEGATION_APPROVAL_PROXY_ONLY),
      WORKSPACE_DELEGATION_GUARD_EXEMPT_CWDS: env.CODEX_MOBILE_WORKSPACE_DELEGATION_GUARD_EXEMPT_CWDS || "",
      WORKSPACE_DELEGATION_GUARD_SELF_EXEMPTION_DISABLED: boolFlag(env.CODEX_MOBILE_WORKSPACE_DELEGATION_GUARD_DISABLE_SELF_EXEMPTION),
      WORKSPACE_DELEGATION_GUARD_PLATFORM_EXEMPTION_DISABLED: boolFlag(env.CODEX_MOBILE_WORKSPACE_DELEGATION_GUARD_DISABLE_PLATFORM_EXEMPTION),
      WORKSPACE_DELEGATION_TOOL_NAMESPACE: "codex_mobile",
      WORKSPACE_DELEGATION_TOOL_NAME: "delegate_to_thread",
      WORKSPACE_DELEGATION_TOOL_FULL_NAME: "codex_mobile.delegate_to_thread",
      TASK_CARD_RETURN_TOOL_NAME: "return_to_source",
      TASK_CARD_RETURN_TOOL_FULL_NAME: "codex_mobile.return_to_source",
      THREAD_SIDE_CHAT_SCOPE_ID,
      THREAD_SIDE_CHAT_REPLY_TIMEOUT_MS: Math.max(
        15_000,
        Number(env.CODEX_MOBILE_THREAD_SIDE_CHAT_REPLY_TIMEOUT_MS || String(3 * 60 * 1000)),
      ),
      THREAD_TASK_CARD_DRAFT_TAG: "codex-mobile-thread-task-card-draft",
      THREAD_TASK_CARD_BODY_MAX_CHARS: 8_000,
      THREAD_TASK_CARD_DRAFT_TURN_LOOKBACK: 4,
      THREAD_TASK_CARD_EXECUTION_WATCHDOG_INTERVAL_MS: boundedNumber(
        env.CODEX_MOBILE_TASK_CARD_EXECUTION_WATCHDOG_INTERVAL_MS || "60000",
        60000,
        0,
        60 * 60 * 1000,
      ),
      THREAD_TASK_CARD_EXECUTION_WATCHDOG_STALE_MS: boundedNumber(
        env.CODEX_MOBILE_TASK_CARD_EXECUTION_WATCHDOG_STALE_MS || String(30 * 60 * 1000),
        30 * 60 * 1000,
        30 * 1000,
        24 * 60 * 60 * 1000,
      ),
      THREAD_TASK_CARD_EXECUTION_WATCHDOG_LIMIT: boundedNumber(
        env.CODEX_MOBILE_TASK_CARD_EXECUTION_WATCHDOG_LIMIT || "2",
        2,
        1,
        8,
      ),
      WORKSPACE_REGISTRY_FILE: env.CODEX_MOBILE_WORKSPACE_REGISTRY_FILE
        || path.join(RUNTIME_ROOT, "workspace-registry.json"),
      TOKEN_USAGE_STATS_DB: env.CODEX_MOBILE_TOKEN_USAGE_DB
        || path.join(RUNTIME_ROOT, "token-usage-stats.sqlite"),
      TOKEN_USAGE_QUERY_CACHE_TTL_MS: boundedNumber(
        env.CODEX_MOBILE_TOKEN_USAGE_QUERY_CACHE_TTL_MS || "3000",
        3000,
        0,
        60_000,
      ),
      THREAD_DETAIL_PROJECTION_CACHE_DIR: env.CODEX_MOBILE_THREAD_DETAIL_PROJECTION_CACHE_DIR
        || path.join(RUNTIME_ROOT, "thread-detail-projections"),
      THREAD_DETAIL_PROJECTION_POLICY_VERSION: "state-relevant-receipt-v3",
      THREAD_DETAIL_PROJECTION_V4_ENABLED: !offFlag(env.CODEX_MOBILE_THREAD_DETAIL_PROJECTION_V4 || "1"),
      THREAD_DETAIL_RAW_ALL_ENABLED: boolFlag(env.CODEX_MOBILE_THREAD_DETAIL_RAW_ALL),
      WORKSPACE_CREATE_ROOTS: env.CODEX_MOBILE_WORKSPACE_CREATE_ROOTS || "",
      WORKSPACE_DEFAULT_CREATE_ROOT: env.CODEX_MOBILE_WORKSPACE_DEFAULT_CREATE_ROOT
        || detectDevelopmentWorkspaceRoot(appRoot),
      SYNC_DESKTOP_WORKSPACES: boolFlag(env.CODEX_MOBILE_SYNC_DESKTOP_WORKSPACES),
      DESKTOP_GLOBAL_STATE_FILES: boolFlag(env.CODEX_MOBILE_SYNC_DESKTOP_WORKSPACES)
        ? uniqueStrings([
          env.CODEX_MOBILE_DESKTOP_GLOBAL_STATE_FILE || "",
          path.join(DEFAULT_CODEX_HOME, ".codex-global-state.json"),
          path.join(CODEX_HOME, ".codex-global-state.json"),
        ])
        : [],
      MOBILE_WEB_LOG_FILE: env.CODEX_MOBILE_WEB_LOG_FILE || path.join(RUNTIME_ROOT, "logs", "mobile-web.log"),
      MOBILE_WEB_LOG_MAX_BYTES,
      MOBILE_WEB_LOG_KEEP_BYTES: boundedNumber(
        env.CODEX_MOBILE_WEB_LOG_KEEP_BYTES || String(128 * 1024),
        128 * 1024,
        16 * 1024,
        MOBILE_WEB_LOG_MAX_BYTES,
      ),
      MOBILE_WEB_LOG_EVENT_MIN_INTERVAL_MS,
      MAX_TEXT_CHARS: 60000,
      MAX_JSON_BODY_BYTES: 2_000_000,
      MAX_START_THREAD_DEVELOPER_INSTRUCTIONS_CHARS: 120000,
      MAX_COMMAND_OUTPUT_CHARS: 8000,
      MAX_COMMAND_OUTPUT_CHARS_PER_TURN: 48000,
      MAX_STRUCTURED_CHARS: 24000,
      MAX_DELTA_CHARS: 12000,
      MAX_THREAD_TURNS,
      MAX_FULL_THREAD_TURNS,
      THREAD_DETAIL_TURNS_LIST_FIRST_BYTES: Math.max(
        0,
        Number(env.CODEX_MOBILE_THREAD_DETAIL_TURNS_LIST_FIRST_BYTES || String(8 * 1024 * 1024)),
      ),
      MAX_LIVE_OPERATION_ITEMS: boundedNumber(env.CODEX_MOBILE_LIVE_OPERATION_ITEMS || "12", 12, 1, 30),
      THREAD_DETAIL_COMPLETED_OPERATION_ITEMS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_COMPLETED_OPERATION_ITEMS || "4", 4, 0, 30),
      THREAD_DETAIL_ACTIVE_REASONING_ITEMS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_ACTIVE_REASONING_ITEMS || "2", 2, 0, 20),
      THREAD_DETAIL_COMPLETED_REASONING_ITEMS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_COMPLETED_REASONING_ITEMS || "0", 0, 0, 20),
      THREAD_DETAIL_ACTIVE_ASSISTANT_ITEMS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_ACTIVE_ASSISTANT_ITEMS || "8", 8, 1, 50),
      THREAD_DETAIL_COMPLETED_ASSISTANT_ITEMS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_COMPLETED_ASSISTANT_ITEMS || "1", 1, 1, 20),
      THREAD_DETAIL_COMPLETED_PROGRESS_MESSAGES: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_COMPLETED_PROGRESS_MESSAGES || "8", 8, 0, 20),
      THREAD_DETAIL_ACTIVE_PROGRESSIVE_ITEM_THRESHOLD: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_ACTIVE_PROGRESSIVE_ITEM_THRESHOLD || "50", 50, 0, 10000),
      THREAD_DETAIL_ACTIVE_PROGRESSIVE_BYTES: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_ACTIVE_PROGRESSIVE_BYTES || String(48 * 1024), 48 * 1024, 0, 10 * 1024 * 1024),
      THREAD_DETAIL_ACTIVE_PROGRESSIVE_THREAD_BYTES: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_ACTIVE_PROGRESSIVE_THREAD_BYTES || String(160 * 1024), 160 * 1024, 0, 50 * 1024 * 1024),
      THREAD_DETAIL_PROGRESSIVE_ACTIVE_OPERATION_ITEMS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_ACTIVE_OPERATION_ITEMS || "6", 6, 0, 30),
      THREAD_DETAIL_PROGRESSIVE_ACTIVE_REASONING_ITEMS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_ACTIVE_REASONING_ITEMS || "1", 1, 0, 20),
      THREAD_DETAIL_PROGRESSIVE_ACTIVE_ASSISTANT_ITEMS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_ACTIVE_ASSISTANT_ITEMS || "4", 4, 1, 50),
      THREAD_DETAIL_PROGRESSIVE_REPLAY_ASSISTANT_ITEMS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_REPLAY_ASSISTANT_ITEMS || "8", 8, 1, 500),
      THREAD_DETAIL_PROGRESSIVE_COMPLETED_REPLAY_ASSISTANT_ITEMS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_COMPLETED_REPLAY_ASSISTANT_ITEMS || "12", 12, 1, 500),
      THREAD_DETAIL_PROGRESSIVE_ACTIVE_TEXT_CHARS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_ACTIVE_TEXT_CHARS || String(12 * 1024), 12 * 1024, 0, 200 * 1024),
      THREAD_DETAIL_PROGRESSIVE_ACTIVE_OPERATION_PAYLOAD_CHARS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_ACTIVE_OPERATION_PAYLOAD_CHARS || String(6 * 1024), 6 * 1024, 0, 200 * 1024),
      THREAD_DETAIL_PROGRESSIVE_ACTIVE_USER_TEXT_CHARS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_ACTIVE_USER_TEXT_CHARS || String(10 * 1024), 10 * 1024, 0, 200 * 1024),
      THREAD_DETAIL_PROGRESSIVE_VISIBLE_ITEM_CEILING: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_VISIBLE_ITEM_CEILING || "48", 48, 0, 10000),
      THREAD_DETAIL_PROGRESSIVE_FIRST_PAINT_THREAD_BYTES: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_FIRST_PAINT_THREAD_BYTES || String(160 * 1024), 160 * 1024, 0, 50 * 1024 * 1024),
      THREAD_DETAIL_PROGRESSIVE_COMPLETED_TEXT_CHARS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_COMPLETED_TEXT_CHARS || String(8 * 1024), 8 * 1024, 0, 200 * 1024),
      THREAD_DETAIL_PROGRESSIVE_COMPLETED_USER_TEXT_CHARS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_COMPLETED_USER_TEXT_CHARS || "1024", 1024, 0, 200 * 1024),
      THREAD_DETAIL_SUMMARY_APP_SERVER_REFRESH_TTL_MS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_SUMMARY_APP_SERVER_REFRESH_TTL_MS || String(30 * 1000), 30 * 1000, 0, 60 * 60 * 1000),
      THREAD_DETAIL_DEFERRED_INITIAL_SEED_DELAY_MS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_DEFERRED_INITIAL_SEED_DELAY_MS || "3000", 3000, 0, 60 * 1000),
      THREAD_DETAIL_FIRST_PAINT_PREWARM_ENABLED: !offFlag(env.CODEX_MOBILE_THREAD_DETAIL_FIRST_PAINT_PREWARM || "1"),
      THREAD_DETAIL_FIRST_PAINT_PREWARM_DELAY_MS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_FIRST_PAINT_PREWARM_DELAY_MS || "75", 75, 0, 60 * 1000),
      THREAD_DETAIL_FIRST_PAINT_PREWARM_MIN_INTERVAL_MS: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_FIRST_PAINT_PREWARM_MIN_INTERVAL_MS || "15000", 15000, 0, 10 * 60 * 1000),
      THREAD_DETAIL_FIRST_PAINT_PREWARM_MIN_BYTES: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_FIRST_PAINT_PREWARM_MIN_BYTES || String(8 * 1024 * 1024), 8 * 1024 * 1024, 0, 1024 * 1024 * 1024),
      THREAD_DETAIL_FIRST_PAINT_PREWARM_MAX_PENDING: boundedNumber(env.CODEX_MOBILE_THREAD_DETAIL_FIRST_PAINT_PREWARM_MAX_PENDING || "2", 2, 1, 20),
      OPERATIONAL_ITEM_TYPES: new Set(["commandExecution", "collabAgentToolCall", "fileChange", "dynamicToolCall", "mcpToolCall"]),
      THREAD_LIST_FALLBACK_CACHE_TTL_MS: Math.max(0, Number(env.CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_TTL_MS || "0")),
      THREAD_LIST_FALLBACK_CACHE_FILE: env.CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_FILE
        || path.join(RUNTIME_ROOT, "thread-list-fallback-cache.json"),
      THREAD_LIST_FALLBACK_CACHE_PERSIST_MAX_AGE_MS: boundedNumber(
        env.CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_PERSIST_MAX_AGE_MS || String(7 * 24 * 60 * 60 * 1000),
        7 * 24 * 60 * 60 * 1000,
        0,
        30 * 24 * 60 * 60 * 1000,
      ),
      THREAD_LIST_DEFAULT_WARM_FALLBACK_ENABLED: !offFlag(env.CODEX_MOBILE_THREAD_LIST_DEFAULT_WARM_FALLBACK || "1"),
      THREAD_LIST_FALLBACK_PREWARM_ENABLED: !offFlag(env.CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM || "1"),
      THREAD_LIST_FALLBACK_PREWARM_DELAY_MS: boundedNumber(env.CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_DELAY_MS || "0", 0, 0, 10 * 60 * 1000),
      THREAD_LIST_FALLBACK_PREWARM_RETRY_MS: boundedNumber(env.CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_RETRY_MS || "2500", 2500, 100, 10 * 60 * 1000),
      THREAD_LIST_FALLBACK_PREWARM_MAX_DEFERRALS: boundedNumber(env.CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_MAX_DEFERRALS || "5", 5, 0, 100),
      THREAD_LIST_FALLBACK_PREWARM_LIMIT,
      THREAD_LIST_FALLBACK_PREWARM_SOURCE_SNAPSHOT_LIMIT_RAW,
      THREAD_LIST_FALLBACK_PREWARM_SOURCE_SNAPSHOT_LIMIT,
      MODEL_OPTIONS,
      DEFAULT_MODEL,
      REASONING_EFFORT_OPTIONS,
      PERMISSION_MODE_OPTIONS,
      DEFAULT_RPC_TIMEOUT_MS: 30000,
      READ_RPC_TIMEOUT_MS: 12000,
      THREAD_DETAIL_RPC_TIMEOUT_MS: 6000,
      PROFILE_SWITCH_PREFLIGHT_TIMEOUT_MS: Math.max(4000, Number(env.CODEX_MOBILE_PROFILE_SWITCH_PREFLIGHT_TIMEOUT_MS || "12000")),
      PROFILE_SWITCH_PROGRESS_TTL_MS: Math.max(60_000, Number(env.CODEX_MOBILE_PROFILE_SWITCH_PROGRESS_TTL_MS || "300000")),
      MUTATION_RPC_TIMEOUT_MS: 120000,
      STALE_ACTIVE_TURN_MS: Math.max(30_000, Number(env.CODEX_MOBILE_STALE_ACTIVE_TURN_MS || "180000")),
      TERMINAL_IDLE_ACTIVE_TURN_MS: Math.max(10_000, Number(env.CODEX_MOBILE_TERMINAL_IDLE_ACTIVE_TURN_MS || "45000")),
      STARTED_THREAD_CACHE_TTL_MS: Math.max(60_000, Number(env.CODEX_MOBILE_STARTED_THREAD_CACHE_TTL_MS || "900000")),
      STARTED_THREAD_CACHE_MAX: Math.max(10, Number(env.CODEX_MOBILE_STARTED_THREAD_CACHE_MAX || "80")),
      THREAD_DISPLAY_SUMMARY_CACHE_TTL_MS: Math.max(60_000, Number(env.CODEX_MOBILE_THREAD_DISPLAY_SUMMARY_CACHE_TTL_MS || "7200000")),
      THREAD_DISPLAY_SUMMARY_CACHE_MAX: Math.max(20, Number(env.CODEX_MOBILE_THREAD_DISPLAY_SUMMARY_CACHE_MAX || "500")),
      MAX_ROLLOUT_CONTEXT_BYTES,
      MAX_RUNTIME_CONTEXT_SCAN_BYTES: Math.max(
        MAX_ROLLOUT_CONTEXT_BYTES,
        Number(env.CODEX_MOBILE_RUNTIME_CONTEXT_SCAN_BYTES || String(32 * 1024 * 1024)),
      ),
      MAX_ROLLOUT_ENRICHMENT_CONTEXT_BYTES: Math.max(
        MAX_ROLLOUT_CONTEXT_BYTES,
        Number(env.CODEX_MOBILE_ROLLOUT_ENRICHMENT_CONTEXT_BYTES || String(32 * 1024 * 1024)),
      ),
      ROLLOUT_WARNING_BYTES: Math.max(1 * 1024 * 1024, Number(env.CODEX_MOBILE_ROLLOUT_WARNING_BYTES || String(200 * 1024 * 1024))),
      ROLLOUT_ACTIVE_STATUS_WINDOW_MS: Math.max(60_000, Number(env.CODEX_MOBILE_ROLLOUT_ACTIVE_STATUS_WINDOW_MS || String(30 * 60 * 1000))),
      LOCAL_ACTIVE_THREAD_STATUS_TTL_MS: Math.max(60_000, Number(env.CODEX_MOBILE_LOCAL_ACTIVE_THREAD_STATUS_TTL_MS || String(30 * 60 * 1000))),
      STALE_CONTEXT_ONLY_ACTIVE_TURN_MS: Math.max(30_000, Number(env.CODEX_MOBILE_CONTEXT_ONLY_ACTIVE_STALE_MS || "90000")),
      CONTINUATION_CONTEXT_HANDOFF_COMPACT_BYTES: Math.max(64 * 1024, Number(env.CODEX_MOBILE_CONTINUATION_CONTEXT_HANDOFF_COMPACT_BYTES || String(300 * 1024))),
      CONTINUATION_CONTEXT_HANDOFF_PRESERVE_CHARS: Math.max(8_000, Number(env.CODEX_MOBILE_CONTINUATION_CONTEXT_HANDOFF_PRESERVE_CHARS || "60000")),
      CONTINUATION_CONTEXT_FILE_COMPACT_BYTES,
      CONTINUATION_CONTEXT_PAIR_COMPACT_BYTES: Math.max(CONTINUATION_CONTEXT_FILE_COMPACT_BYTES, Number(env.CODEX_MOBILE_CONTINUATION_CONTEXT_PAIR_COMPACT_BYTES || String(200 * 1024))),
      CONTINUATION_CONTEXT_HANDOFF_PROMPT_BYTES: Math.max(CONTINUATION_CONTEXT_FILE_COMPACT_BYTES, Number(env.CODEX_MOBILE_CONTINUATION_CONTEXT_HANDOFF_PROMPT_BYTES || String(200 * 1024))),
      CONTINUATION_CONTEXT_COMPACT_PRESERVE_CHARS: Math.max(6_000, Number(env.CODEX_MOBILE_CONTINUATION_CONTEXT_COMPACT_PRESERVE_CHARS || "18000")),
      RUNTIME_CONTEXT_CACHE_TTL_MS: Math.max(1000, Number(env.CODEX_MOBILE_RUNTIME_CONTEXT_CACHE_TTL_MS || "30000")),
      RUNTIME_CONTEXT_CACHE_MAX: Math.max(20, Number(env.CODEX_MOBILE_RUNTIME_CONTEXT_CACHE_MAX || "200")),
      MUX_REPLAY_NOTIFICATION_LIMIT: Math.max(0, Number(env.CODEX_MOBILE_MUX_REPLAY_NOTIFICATION_LIMIT || "200")),
      SAFE_RETRY_METHODS: new Set(["initialize", "thread/list", "thread/read", "thread/turns/list"]),
    };
  }

  return {
    resolve,
  };
}

function resolveServerRuntimeConfig(dependencies = {}) {
  return createServerRuntimeConfigService(dependencies).resolve();
}

module.exports = {
  createServerRuntimeConfigService,
  resolveServerRuntimeConfig,
};
