"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const net = require("node:net");
const webPush = require("web-push");
const {
  completedTurnHasNoFinalAgentMessage,
  createThreadDisplaySummaryCache,
  resolveThreadTitleForNotification,
  shouldTrackTurnForWebPush,
} = require("./adapters/push-notification-service");
const { createSharedChainRestartService } = require("./adapters/shared-chain-restart-service");
const { createHermesNotificationDelegateService } = require("./adapters/hermes-notification-delegate-service");
const { runSqliteJson } = require("./adapters/sqlite-cli");
const { compactWorkspaceHandoff } = require("./adapters/continuation-handoff-compaction-service");
const {
  localImageUploadsForContext,
  parseImageContextPolicyEnv,
  parsePersistExtendedHistoryEnv,
  shouldPersistExtendedHistoryForUploads,
} = require("./adapters/message-input-service");
const { createPendingSteerEchoStore } = require("./adapters/message-pending-echo-service");
const {
  detectStaleActiveTurnForSubmission,
} = require("./adapters/active-turn-staleness-service");
const {
  attachTurnUsageSummaries,
  collectTurnUsageSummariesFromRolloutText,
} = require("./adapters/turn-usage-summary-service");
const { createTokenUsageStatsService } = require("./adapters/token-usage-stats-service");
const {
  buildTurnCompletionDetailMessage,
  finalReceiptTextFromParams,
} = require("./adapters/turn-completion-receipt-service");
const {
  buildPublicPullRequestStatus,
  normalizeRepositorySlug,
  publicPullRequestApiUrl,
} = require("./adapters/public-pull-request-service");
const {
  cacheGeneratedImageForItem,
  generatedImagePathForId,
  imageContentTypeForPath,
} = require("./adapters/generated-image-cache-service");
const { createHermesPluginService } = require("./adapters/hermes-plugin-service");
const { createThreadTaskCardService } = require("./adapters/thread-task-card-service");
const { createWorkspaceRegistryService } = require("./adapters/workspace-registry-service");
const {
  createCodexProfileService,
  resolveActiveCodexHomeFromStore,
} = require("./adapters/codex-profile-service");

const APP_ROOT = __dirname;
const PUBLIC_ROOT = path.join(APP_ROOT, "public");
const USER_HOME = process.env.USERPROFILE || process.env.HOME || process.cwd();
const RUNTIME_ROOT = process.env.CODEX_MOBILE_RUNTIME_DIR || path.join(USER_HOME, ".codex-mobile-web");
const CODEX_PROFILE_BOOTSTRAP = resolveActiveCodexHomeFromStore({
  userHome: USER_HOME,
  runtimeRoot: RUNTIME_ROOT,
  env: process.env,
});
const DEFAULT_CODEX_HOME = path.join(USER_HOME, ".codex");
const CODEX_HOME = process.env.CODEX_HOME || CODEX_PROFILE_BOOTSTRAP.codexHome || DEFAULT_CODEX_HOME;
const STATE_DB = path.join(CODEX_HOME, "state_5.sqlite");
const SESSIONS_DIR = path.join(CODEX_HOME, "sessions");
const ARCHIVED_SESSIONS_DIR = path.join(CODEX_HOME, "archived_sessions");
const CODEX_EXE = process.env.CODEX_MOBILE_CODEX_EXE || "codex";
const MUX_ENDPOINT_FILE = process.env.CODEX_MOBILE_MUX_ENDPOINT_FILE || path.join(CODEX_HOME, "app-server-mux", "endpoint.json");
const EXTERNAL_APP_SERVER_WS = process.env.CODEX_MOBILE_APP_SERVER_WS || "";
const EXTERNAL_APP_SERVER_TCP = process.env.CODEX_MOBILE_APP_SERVER_TCP || "";
const REQUIRE_SHARED_APP_SERVER = /^(1|true|yes|on)$/i.test(process.env.CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER || "");
const HOST = process.env.CODEX_MOBILE_HOST || "0.0.0.0";
const PORT = Number(process.env.CODEX_MOBILE_PORT || "8787");
const APP_VERSION = readPackageVersion();
const APP_UPDATE_REMOTE = process.env.CODEX_MOBILE_UPDATE_REMOTE || "origin";
const APP_UPDATE_BRANCH = process.env.CODEX_MOBILE_UPDATE_BRANCH || "main";
const APP_UPDATE_DISABLED = /^(1|true|yes|on)$/i.test(process.env.CODEX_MOBILE_DISABLE_UPDATE_CHECK || "");
const APP_UPDATE_CHECK_TIMEOUT_MS = Math.max(1000, Number(process.env.CODEX_MOBILE_UPDATE_CHECK_TIMEOUT_MS || "15000"));
const APP_UPDATE_APPLY_TIMEOUT_MS = Math.max(5000, Number(process.env.CODEX_MOBILE_UPDATE_APPLY_TIMEOUT_MS || "120000"));
const APP_UPDATE_RESTART_DELAY_MS = Math.max(500, Number(process.env.CODEX_MOBILE_UPDATE_RESTART_DELAY_MS || "1200"));
const APP_UPDATE_CACHE_MS = Math.max(30_000, Number(process.env.CODEX_MOBILE_UPDATE_CACHE_MS || "900000"));
const PUBLIC_PR_CHECK_DISABLED = /^(1|true|yes|on)$/i.test(process.env.CODEX_MOBILE_DISABLE_PUBLIC_PR_CHECK || "");
const PUBLIC_PR_REPOSITORY = normalizeRepositorySlug(process.env.CODEX_MOBILE_PUBLIC_PR_REPOSITORY || "pentiumxp/codex-mobile-web-public");
const PUBLIC_PR_CHECK_TIMEOUT_MS = Math.max(1000, Number(process.env.CODEX_MOBILE_PUBLIC_PR_CHECK_TIMEOUT_MS || "12000"));
const PUBLIC_PR_CHECK_CACHE_MS = Math.max(30_000, Number(process.env.CODEX_MOBILE_PUBLIC_PR_CHECK_CACHE_MS || "900000"));
const PUBLIC_RELEASE_CHECK_DISABLED = /^(1|true|yes|on)$/i.test(process.env.CODEX_MOBILE_DISABLE_PUBLIC_RELEASE_CHECK || "");
const PUBLIC_RELEASE_REPOSITORY = normalizeRepositorySlug(process.env.CODEX_MOBILE_PUBLIC_RELEASE_REPOSITORY || PUBLIC_PR_REPOSITORY);
const PUBLIC_RELEASE_BRANCH = process.env.CODEX_MOBILE_PUBLIC_RELEASE_BRANCH || "main";
const PUBLIC_RELEASE_CHECK_CACHE_MS = Math.max(30_000, Number(process.env.CODEX_MOBILE_PUBLIC_RELEASE_CHECK_CACHE_MS || "900000"));
const SHARED_CHAIN_RESTART_TASK_NAME = process.env.CODEX_MOBILE_RESTART_TASK_NAME || "Codex Mobile Web";
const SHARED_CHAIN_RESTART_DELAY_MS = Math.max(500, Number(process.env.CODEX_MOBILE_SHARED_CHAIN_RESTART_DELAY_MS || "900"));
const DISABLE_AUTH = /^(1|true|yes|on)$/i.test(process.env.CODEX_MOBILE_DISABLE_AUTH || "");
const AUTH_KEY_FILE = process.env.CODEX_MOBILE_KEY_FILE || path.join(RUNTIME_ROOT, "access_key");
const AUTH_KEY = DISABLE_AUTH ? "" : loadAuthKey();
const HERMES_PLUGIN_REGISTRATION_FILE = process.env.CODEX_MOBILE_HERMES_PLUGIN_REGISTRATION_FILE
  || path.join(RUNTIME_ROOT, "hermes-plugin-registration.json");
const HERMES_PLUGIN_BASE_URL = process.env.CODEX_MOBILE_HERMES_PLUGIN_BASE_URL
  || process.env.CODEX_MOBILE_PUBLIC_BASE_URL
  || "";
const HERMES_PLUGIN_LAUNCH_TOKEN_TTL_MS = Math.max(
  30_000,
  Number(process.env.CODEX_MOBILE_HERMES_PLUGIN_LAUNCH_TOKEN_TTL_MS || String(5 * 60 * 1000)),
);
const HERMES_PLUGIN_SESSION_TTL_MS = Math.max(
  5 * 60_000,
  Number(process.env.CODEX_MOBILE_HERMES_PLUGIN_SESSION_TTL_MS || String(12 * 60 * 60 * 1000)),
);
const HERMES_PLUGIN_FRAME_ORIGINS = process.env.CODEX_MOBILE_HERMES_PLUGIN_FRAME_ORIGINS || "";
const HERMES_PLUGIN_NOTIFICATION_BASE_URL = process.env.CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_BASE_URL || "";
const HERMES_PLUGIN_NOTIFICATION_KEY = process.env.CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY
  || process.env.CODEX_MOBILE_HERMES_WEB_KEY
  || "";
const HERMES_PLUGIN_NOTIFICATION_KEY_FILE = process.env.CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY_FILE
  || process.env.CODEX_MOBILE_HERMES_WEB_KEY_FILE
  || "";
const THREAD_TASK_CARD_FILE = process.env.CODEX_MOBILE_THREAD_TASK_CARD_FILE
  || path.join(RUNTIME_ROOT, "thread-task-cards.json");
const THREAD_TASK_CARD_DRAFT_TAG = "codex-mobile-thread-task-card-draft";
const THREAD_TASK_CARD_BODY_MAX_CHARS = 8_000;
const THREAD_TASK_CARD_DRAFT_TURN_LOOKBACK = 4;
const WORKSPACE_REGISTRY_FILE = process.env.CODEX_MOBILE_WORKSPACE_REGISTRY_FILE
  || path.join(RUNTIME_ROOT, "workspace-registry.json");
const TOKEN_USAGE_STATS_DB = process.env.CODEX_MOBILE_TOKEN_USAGE_DB
  || path.join(RUNTIME_ROOT, "token-usage-stats.sqlite");
const WORKSPACE_CREATE_ROOTS = process.env.CODEX_MOBILE_WORKSPACE_CREATE_ROOTS || "";
const hermesPluginService = createHermesPluginService({
  registrationFile: HERMES_PLUGIN_REGISTRATION_FILE,
  launchTokenTtlMs: HERMES_PLUGIN_LAUNCH_TOKEN_TTL_MS,
  pluginSessionTtlMs: HERMES_PLUGIN_SESSION_TTL_MS,
  hermesOrigins: HERMES_PLUGIN_FRAME_ORIGINS,
  version: APP_VERSION,
  baseUrl: HERMES_PLUGIN_BASE_URL,
});
const hermesNotificationDelegateService = createHermesNotificationDelegateService({
  pluginId: "codex-mobile",
  baseUrl: HERMES_PLUGIN_NOTIFICATION_BASE_URL,
  webKey: HERMES_PLUGIN_NOTIFICATION_KEY,
  webKeyFile: HERMES_PLUGIN_NOTIFICATION_KEY_FILE,
  registrationForWorkspace: (workspaceId) => hermesPluginService.registration({ workspaceId }),
});
const sharedChainRestartService = createSharedChainRestartService({
  workspacePath: APP_ROOT,
  userProfilePath: USER_HOME,
  taskName: SHARED_CHAIN_RESTART_TASK_NAME,
  port: PORT,
});
const pendingSteerEchoStore = createPendingSteerEchoStore();
const workspaceRegistryService = createWorkspaceRegistryService({
  storageFile: WORKSPACE_REGISTRY_FILE,
  homeDir: USER_HOME,
  createRoots: WORKSPACE_CREATE_ROOTS,
});
const codexProfileService = createCodexProfileService({
  userHome: USER_HOME,
  runtimeRoot: RUNTIME_ROOT,
  activeCodexHome: CODEX_HOME,
});

function activeProfileRestartOptions(profile = null) {
  const selected = profile || codexProfileService.profiles().profiles.find((item) => item.active) || null;
  if (!selected || !selected.id || !selected.codexHome) return {};
  return {
    profileId: selected.id,
    codexHome: selected.codexHome,
  };
}

const tokenUsageStatsService = createTokenUsageStatsService({
  dbPath: TOKEN_USAGE_STATS_DB,
});
const threadTaskCardService = createThreadTaskCardService({
  storageFile: THREAD_TASK_CARD_FILE,
  executeApprovedCard: async (card, message) => {
    const runtimeSettings = await resolveThreadRuntimeSettings(card.target.threadId);
    try {
      await codex.request("thread/resume", applyResumeRuntimeSettings({
        threadId: card.target.threadId,
        cwd: null,
        persistExtendedHistory: true,
      }, runtimeSettings), { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
    } catch (err) {
      if (!/already|loaded|active/i.test(err.message || "")) throw err;
    }
    const turnParams = applyTurnRuntimeSettings({
      threadId: card.target.threadId,
      input: [{ type: "text", text: message.text }],
    }, runtimeSettings);
    const result = await codex.request("turn/start", turnParams, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
    return {
      threadId: String(card.target.threadId || ""),
      turnId: String((result && result.turnId) || (result && result.turn && result.turn.id) || ""),
      result,
    };
  },
});
const PUSH_VAPID_FILE = process.env.CODEX_MOBILE_PUSH_VAPID_FILE || path.join(RUNTIME_ROOT, "web-push-vapid.json");
const PUSH_SUBSCRIPTIONS_FILE = process.env.CODEX_MOBILE_PUSH_SUBSCRIPTIONS_FILE || path.join(RUNTIME_ROOT, "web-push-subscriptions.json");
const DEFAULT_PUSH_SUBJECT = "mailto:codex-mobile-web@example.com";
const PUSH_SUBJECT = normalizePushSubject(process.env.CODEX_MOBILE_PUSH_SUBJECT || DEFAULT_PUSH_SUBJECT);
const PUSH_TTL_SECONDS = Math.max(30, Number(process.env.CODEX_MOBILE_PUSH_TTL_SECONDS || "3600"));
const MOBILE_WEB_LOG_FILE = process.env.CODEX_MOBILE_WEB_LOG_FILE || path.join(RUNTIME_ROOT, "logs", "mobile-web.log");
const MOBILE_WEB_LOG_MAX_BYTES = Math.max(
  1024 * 1024,
  Number(process.env.CODEX_MOBILE_WEB_LOG_MAX_BYTES || String(20 * 1024 * 1024)),
);
const MOBILE_WEB_LOG_KEEP_BYTES = Math.max(
  256 * 1024,
  Math.min(
    MOBILE_WEB_LOG_MAX_BYTES,
    Number(process.env.CODEX_MOBILE_WEB_LOG_KEEP_BYTES || String(5 * 1024 * 1024)),
  ),
);
const MAX_TEXT_CHARS = 60000;
const MAX_JSON_BODY_BYTES = 2_000_000;
const MAX_START_THREAD_DEVELOPER_INSTRUCTIONS_CHARS = 120000;
const MAX_UPLOAD_BYTES = Math.max(1, Number(process.env.CODEX_MOBILE_MAX_UPLOAD_BYTES || String(64 * 1024 * 1024)));
const MAX_UPLOAD_FILES = Math.max(1, Math.min(50, Number(process.env.CODEX_MOBILE_MAX_UPLOAD_FILES || "12")));
const UPLOAD_ROOT = process.env.CODEX_MOBILE_UPLOAD_DIR || path.join(RUNTIME_ROOT, "uploads");
const GENERATED_IMAGE_ROOT = process.env.CODEX_MOBILE_GENERATED_IMAGE_CACHE_DIR || path.join(RUNTIME_ROOT, "generated-images");
const IMAGE_CONTEXT_POLICY = parseImageContextPolicyEnv(process.env);
const PERSIST_EXTENDED_HISTORY_POLICY = parsePersistExtendedHistoryEnv(process.env);
const FILE_PREVIEW_MAX_BYTES = Math.max(1024, Number(process.env.CODEX_MOBILE_FILE_PREVIEW_MAX_BYTES || String(512 * 1024)));
const FILE_PREVIEW_MEDIA_MAX_BYTES = Math.max(1024 * 1024, Number(process.env.CODEX_MOBILE_FILE_PREVIEW_MEDIA_MAX_BYTES || String(24 * 1024 * 1024)));
const MAX_COMMAND_OUTPUT_CHARS = 8000;
const MAX_COMMAND_OUTPUT_CHARS_PER_TURN = 48000;
const MAX_STRUCTURED_CHARS = 24000;
const MAX_DELTA_CHARS = 12000;
const MAX_THREAD_TURNS = Math.max(1, Math.min(100, Number(process.env.CODEX_MOBILE_THREAD_TURNS || "8")));
const MAX_FULL_THREAD_TURNS = Math.max(MAX_THREAD_TURNS, Math.min(200, Number(process.env.CODEX_MOBILE_FULL_THREAD_TURNS || "80")));
const OPERATIONAL_ITEM_TYPES = new Set(["commandExecution", "fileChange", "dynamicToolCall", "mcpToolCall"]);
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
const DEFAULT_RPC_TIMEOUT_MS = 30000;
const READ_RPC_TIMEOUT_MS = 12000;
const THREAD_DETAIL_RPC_TIMEOUT_MS = Math.min(6000, READ_RPC_TIMEOUT_MS);
const MUTATION_RPC_TIMEOUT_MS = 120000;
const MESSAGE_DEDUPE_WINDOW_MS = Math.max(5_000, Number(process.env.CODEX_MOBILE_MESSAGE_DEDUPE_WINDOW_MS || "90000"));
const MESSAGE_DEDUPE_MAX = Math.max(20, Number(process.env.CODEX_MOBILE_MESSAGE_DEDUPE_MAX || "300"));
const STALE_ACTIVE_TURN_MS = Math.max(30_000, Number(process.env.CODEX_MOBILE_STALE_ACTIVE_TURN_MS || "180000"));
const TERMINAL_IDLE_ACTIVE_TURN_MS = Math.max(10_000, Number(process.env.CODEX_MOBILE_TERMINAL_IDLE_ACTIVE_TURN_MS || "45000"));
const STARTED_THREAD_CACHE_TTL_MS = Math.max(60_000, Number(process.env.CODEX_MOBILE_STARTED_THREAD_CACHE_TTL_MS || "900000"));
const STARTED_THREAD_CACHE_MAX = Math.max(10, Number(process.env.CODEX_MOBILE_STARTED_THREAD_CACHE_MAX || "80"));
const THREAD_DISPLAY_SUMMARY_CACHE_TTL_MS = Math.max(60_000, Number(process.env.CODEX_MOBILE_THREAD_DISPLAY_SUMMARY_CACHE_TTL_MS || "7200000"));
const THREAD_DISPLAY_SUMMARY_CACHE_MAX = Math.max(20, Number(process.env.CODEX_MOBILE_THREAD_DISPLAY_SUMMARY_CACHE_MAX || "500"));
const MAX_ROLLOUT_CONTEXT_BYTES = Math.max(256 * 1024, Number(process.env.CODEX_MOBILE_ROLLOUT_CONTEXT_BYTES || String(4 * 1024 * 1024)));
const MAX_RUNTIME_CONTEXT_SCAN_BYTES = Math.max(MAX_ROLLOUT_CONTEXT_BYTES, Number(process.env.CODEX_MOBILE_RUNTIME_CONTEXT_SCAN_BYTES || String(512 * 1024 * 1024)));
const ROLLOUT_WARNING_BYTES = Math.max(1 * 1024 * 1024, Number(process.env.CODEX_MOBILE_ROLLOUT_WARNING_BYTES || String(200 * 1024 * 1024)));
const DEFAULT_THREAD_DETAIL_ROLLOUT_MAX_BYTES = 32 * 1024 * 1024;
const THREAD_DETAIL_ROLLOUT_MAX_BYTES = Math.max(
  1 * 1024 * 1024,
  Number(process.env.CODEX_MOBILE_THREAD_DETAIL_ROLLOUT_MAX_BYTES || String(DEFAULT_THREAD_DETAIL_ROLLOUT_MAX_BYTES)),
);
const MAX_CONTINUATION_BOOTSTRAP_CHARS = Math.max(20_000, Number(process.env.CODEX_MOBILE_CONTINUATION_BOOTSTRAP_CHARS || "52000"));
const CONTINUATION_SOURCE_HANDOFF_EXCERPT_CHARS = Math.max(2_000, Number(process.env.CODEX_MOBILE_CONTINUATION_SOURCE_HANDOFF_EXCERPT_CHARS || "12000"));
const CONTINUATION_SOURCE_HANDOFF_STORED_CHARS = Math.max(CONTINUATION_SOURCE_HANDOFF_EXCERPT_CHARS, Number(process.env.CODEX_MOBILE_CONTINUATION_SOURCE_HANDOFF_STORED_CHARS || "18000"));
const CONTINUATION_WORKSPACE_PROJECT_CONTEXT_CHARS = Math.max(4_000, Number(process.env.CODEX_MOBILE_CONTINUATION_WORKSPACE_PROJECT_CONTEXT_CHARS || "18000"));
const CONTINUATION_WORKSPACE_HANDOFF_TAIL_CHARS = Math.max(4_000, Number(process.env.CODEX_MOBILE_CONTINUATION_WORKSPACE_HANDOFF_TAIL_CHARS || "18000"));
const CONTINUATION_ITEM_SUMMARY_CHARS = Math.max(300, Number(process.env.CODEX_MOBILE_CONTINUATION_ITEM_SUMMARY_CHARS || "1200"));
const CONTINUATION_TURN_SUMMARY_ITEMS = Math.max(1, Math.min(8, Number(process.env.CODEX_MOBILE_CONTINUATION_TURN_SUMMARY_ITEMS || "4")));
const CONTINUATION_RECENT_TURNS = Math.max(1, Math.min(30, Number(process.env.CODEX_MOBILE_CONTINUATION_RECENT_TURNS || "12")));
const CONTINUATION_HANDOFF_TIMEOUT_MS = Math.max(30_000, Number(process.env.CODEX_MOBILE_CONTINUATION_HANDOFF_TIMEOUT_MS || "240000"));
const CONTINUATION_LATE_HANDOFF_TIMEOUT_MS = Math.max(30_000, Number(process.env.CODEX_MOBILE_CONTINUATION_LATE_HANDOFF_TIMEOUT_MS || "600000"));
const CONTINUATION_REUSE_HANDOFF_MS = Math.max(0, Number(process.env.CODEX_MOBILE_CONTINUATION_REUSE_HANDOFF_MS || "1800000"));
const CONTINUATION_HANDOFF_MIN_CHARS = Math.max(120, Number(process.env.CODEX_MOBILE_CONTINUATION_HANDOFF_MIN_CHARS || "400"));
const CONTINUATION_HANDOFF_TURN_COMPLETION_TIMEOUT_MS = Math.max(5_000, Number(process.env.CODEX_MOBILE_CONTINUATION_HANDOFF_TURN_COMPLETION_TIMEOUT_MS || "60000"));
const CONTINUATION_JOB_TTL_MS = Math.max(60_000, Number(process.env.CODEX_MOBILE_CONTINUATION_JOB_TTL_MS || "1800000"));
const CONTINUATION_JOB_MAX = Math.max(10, Number(process.env.CODEX_MOBILE_CONTINUATION_JOB_MAX || "50"));
const CONTINUATION_LINEAGE_MAX_DEPTH = Math.max(0, Math.min(5, Number(process.env.CODEX_MOBILE_CONTINUATION_LINEAGE_MAX_DEPTH || "2")));
const CONTINUATION_LINEAGE_MAX_CHARS = Math.max(2_000, Number(process.env.CODEX_MOBILE_CONTINUATION_LINEAGE_MAX_CHARS || "12000"));
const CONTINUATION_CONTEXT_HANDOFF_COMPACT_BYTES = Math.max(64 * 1024, Number(process.env.CODEX_MOBILE_CONTINUATION_CONTEXT_HANDOFF_COMPACT_BYTES || String(300 * 1024)));
const CONTINUATION_CONTEXT_HANDOFF_PRESERVE_CHARS = Math.max(8_000, Number(process.env.CODEX_MOBILE_CONTINUATION_CONTEXT_HANDOFF_PRESERVE_CHARS || "60000"));
const RUNTIME_CONTEXT_CACHE_TTL_MS = Math.max(1000, Number(process.env.CODEX_MOBILE_RUNTIME_CONTEXT_CACHE_TTL_MS || "30000"));
const RUNTIME_CONTEXT_CACHE_MAX = Math.max(20, Number(process.env.CODEX_MOBILE_RUNTIME_CONTEXT_CACHE_MAX || "200"));
const MUX_REPLAY_NOTIFICATION_LIMIT = Math.max(0, Number(process.env.CODEX_MOBILE_MUX_REPLAY_NOTIFICATION_LIMIT || "200"));
const SAFE_RETRY_METHODS = new Set(["initialize", "thread/list", "thread/read", "thread/turns/list"]);
const IMAGE_EXTENSIONS = new Set([".avif", ".bmp", ".gif", ".heic", ".heif", ".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"]);
const FILE_PREVIEW_TEXT_EXTENSIONS = new Set([
  ".conf",
  ".csv",
  ".css",
  ".diff",
  ".env.example",
  ".htm",
  ".html",
  ".ini",
  ".js",
  ".jsx",
  ".json",
  ".jsonl",
  ".log",
  ".md",
  ".markdown",
  ".patch",
  ".plist",
  ".properties",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);
const FILE_PREVIEW_DOCUMENT_EXTENSIONS = new Set([".pdf"]);
const FILE_PREVIEW_IMAGE_CONTENT_TYPES = new Map([
  [".avif", "image/avif"],
  [".bmp", "image/bmp"],
  [".gif", "image/gif"],
  [".heic", "image/heic"],
  [".heif", "image/heif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".tif", "image/tiff"],
  [".tiff", "image/tiff"],
  [".webp", "image/webp"],
]);
const FILE_PREVIEW_TEXT_CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".csv", "text/csv; charset=utf-8"],
  [".htm", "text/html; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".jsonl", "application/x-ndjson; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".markdown", "text/markdown; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
  [".yaml", "application/yaml; charset=utf-8"],
  [".yml", "application/yaml; charset=utf-8"],
]);
const FILE_PREVIEW_DENIED_BASENAMES = new Set([
  ".env",
  ".npmrc",
  ".netrc",
  "access_key",
  "auth.json",
  "credentials",
  "credentials.json",
  "id_ed25519",
  "id_rsa",
  "known_hosts",
  "secret.json",
  "secrets.json",
  "service-account.json",
  "service_account.json",
  "token.json",
  "tokens.json",
]);
const FILE_PREVIEW_DENIED_DIRS = new Set([
  ".aws",
  ".gnupg",
  ".ssh",
  "keychain",
]);
const CODEX_CONFIG_DEFAULTS = readCodexConfigDefaults();
const PROCESS_STARTED_AT_MS = Date.now();

let appUpdateStatus = null;
let appUpdateCheckInFlight = null;
let appUpdateApplying = false;
let appUpdateRestartScheduled = false;
let publicPullRequestStatus = null;
let publicPullRequestCheckInFlight = null;
let publicReleaseStatus = null;
let publicReleaseCheckInFlight = null;
let clients = new Map();
let clientHeartbeats = new WeakMap();
let latestLiveRateLimits = null;
let latestSnapshotRateLimits = null;
const latestLiveRateLimitsByModel = new Map();
const latestSnapshotRateLimitsByModel = new Map();
let lastRolloutRateLimitScanAt = 0;
const latestRuntimeContextByPath = new Map();
const latestItemTimestampsByPath = new Map();
const latestTurnUsageSummariesByPath = new Map();
const recentStartedThreads = new Map();
const threadDisplaySummaryCache = createThreadDisplaySummaryCache({
  ttlMs: THREAD_DISPLAY_SUMMARY_CACHE_TTL_MS,
  maxEntries: THREAD_DISPLAY_SUMMARY_CACHE_MAX,
  decorateSummary: annotateThreadRolloutStats,
});
const continuationJobs = new Map();
const activeContinuationJobsBySource = new Map();
let pushVapidKeys = null;
let pushSubscriptionsCache = null;
const recentMessageSubmissions = new Map();
const pushObservedTurns = new Map();
const pushSentTurns = new Map();
const pushThreadClassCache = new Map();
const SERVER_REQUEST_METHODS = new Set([
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "item/permissions/requestApproval",
  "item/tool/requestUserInput",
  "mcpServer/elicitation/request",
  "account/chatgptAuthTokens/refresh",
  "execCommandApproval",
  "applyPatchApproval",
]);
const ACTIONABLE_APPROVAL_METHODS = new Set([
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "item/permissions/requestApproval",
  "execCommandApproval",
  "applyPatchApproval",
]);
const ACTIONABLE_USER_INPUT_METHODS = new Set([
  "item/tool/requestUserInput",
  "mcpServer/elicitation/request",
]);
const ACTIONABLE_SERVER_REQUEST_METHODS = new Set([
  ...ACTIONABLE_APPROVAL_METHODS,
  ...ACTIONABLE_USER_INPUT_METHODS,
]);

function optionListFromEnv(name, fallback) {
  const values = String(process.env[name] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(values.length ? values : fallback)];
}

function readPackageVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(APP_ROOT, "package.json"), "utf8"));
    return String(pkg.version || "0.0.0");
  } catch (_) {
    return "0.0.0";
  }
}

function readServiceWorkerCacheName() {
  try {
    const source = fs.readFileSync(path.join(PUBLIC_ROOT, "sw.js"), "utf8");
    const match = source.match(/CACHE_NAME\s*=\s*["']([^"']+)["']/);
    return match ? String(match[1] || "") : "";
  } catch (_) {
    return "";
  }
}

let STARTUP_SHELL_CACHE_NAME = "";
let STARTUP_APP_SHELL_BUILD_ID = "";

function appShellBuildId(cacheName = readServiceWorkerCacheName()) {
  const parts = [`app=${APP_VERSION}`, `sw=${cacheName}`];
  for (const file of [
    "index.html",
    "styles.css",
    "api-client.js",
    "runtime-settings.js",
    "draft-store.js",
    "markdown-renderer.js",
    "viewport-metrics.js",
    "conversation-scroll.js",
    "image-compressor.js",
    "app.js",
    "sw.js",
    "manifest.json",
  ]) {
    try {
      const stat = fs.statSync(path.join(PUBLIC_ROOT, file));
      parts.push(`${file}:${stat.size}:${Math.trunc(stat.mtimeMs)}`);
    } catch (_) {
      parts.push(`${file}:missing`);
    }
  }
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

function clientBuildId() {
  const cacheName = STARTUP_SHELL_CACHE_NAME || readServiceWorkerCacheName();
  return `${APP_VERSION}|${cacheName || STARTUP_APP_SHELL_BUILD_ID || appShellBuildId(cacheName)}`;
}

STARTUP_SHELL_CACHE_NAME = readServiceWorkerCacheName();
STARTUP_APP_SHELL_BUILD_ID = appShellBuildId(STARTUP_SHELL_CACHE_NAME);

function readCodexConfigDefaults() {
  const configPath = path.join(CODEX_HOME, "config.toml");
  try {
    const text = fs.readFileSync(configPath, "utf8");
    const model = /^\s*model\s*=\s*"([^"]+)"/m.exec(text);
    const effort = /^\s*model_reasoning_effort\s*=\s*"([^"]+)"/m.exec(text);
    const summary = /^\s*model_reasoning_summary\s*=\s*"([^"]+)"/m.exec(text);
    const verbosity = /^\s*model_verbosity\s*=\s*"([^"]+)"/m.exec(text);
    const sandboxMode = /^\s*sandbox_mode\s*=\s*"([^"]+)"/m.exec(text);
    const approvalPolicy = /^\s*(approval_policy|approval_mode)\s*=\s*"([^"]+)"/m.exec(text);
    return {
      model: model ? model[1] : "",
      reasoningEffort: effort ? effort[1] : "",
      reasoningSummary: summary ? summary[1] : "",
      modelVerbosity: verbosity ? verbosity[1] : "",
      sandboxMode: sandboxMode ? sandboxMode[1] : "",
      approvalPolicy: approvalPolicy ? approvalPolicy[2] : "",
    };
  } catch (_) {
    return { model: "", reasoningEffort: "", reasoningSummary: "", modelVerbosity: "", sandboxMode: "", approvalPolicy: "" };
  }
}

function commandNeedsFilesystemCheck(command) {
  const value = String(command || "");
  return path.isAbsolute(value) || value.includes("/") || value.includes("\\");
}

function assertCommandAvailable(command, label) {
  const value = String(command || "").trim();
  if (!value) throw new Error(`${label} is not configured`);
  if (commandNeedsFilesystemCheck(value) && !fs.existsSync(value)) {
    throw new Error(`${label} not found: ${value}`);
  }
}

function loadAuthKey() {
  if (process.env.CODEX_MOBILE_KEY && process.env.CODEX_MOBILE_KEY.trim()) {
    return process.env.CODEX_MOBILE_KEY.trim();
  }
  try {
    const value = fs.readFileSync(AUTH_KEY_FILE, "utf8").trim();
    if (value) return value;
  } catch (_) {
    // Create a durable local key so reloads and server restarts do not invalidate phone sessions.
  }
  const key = crypto.randomBytes(18).toString("base64url");
  fs.mkdirSync(path.dirname(AUTH_KEY_FILE), { recursive: true });
  fs.writeFileSync(AUTH_KEY_FILE, `${key}\n`, { encoding: "utf8", mode: 0o600 });
  return key;
}

function timingSafeEquals(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function getUrl(req) {
  return new URL(req.url, `http://${req.headers.host || "localhost"}`);
}

function bearerTokenFromRequest(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || "").trim();
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function requestAuthToken(req) {
  const url = getUrl(req);
  return req.headers["x-codex-mobile-key"]
    || bearerTokenFromRequest(req)
    || url.searchParams.get("key")
    || url.searchParams.get("codexPluginLaunch")
    || parseCookies(req.headers.cookie).codex_mobile_key;
}

function isAccessKeyAuthorized(req) {
  if (DISABLE_AUTH) return true;
  return timingSafeEquals(requestAuthToken(req), AUTH_KEY);
}

function isAuthorized(req) {
  if (isAccessKeyAuthorized(req)) return true;
  if (hermesPluginService.isSessionAuthorized(requestAuthToken(req))) return true;
  return hermesPluginService.isLaunchTokenAuthorized(requestAuthToken(req));
}

function sendJson(res, status, data) {
  if (!res || res.destroyed || res.writableEnded) return;
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function hermesOriginFromRequest(req, url) {
  return String(
    (url && (url.searchParams.get("hermesOrigin") || url.searchParams.get("hermes_origin") || url.searchParams.get("appOrigin") || url.searchParams.get("origin")))
    || req.headers["x-hermes-origin"]
    || req.headers.origin
    || "",
  ).trim();
}

function requestBaseUrl(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const proto = forwardedProto === "https" ? "https" : "http";
  const host = forwardedHost || String(req.headers.host || "").trim();
  return host ? `${proto}://${host}` : "";
}

let lastLogTrimAt = 0;

function trimLogFile(filePath, maxBytes, keepBytes) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size <= maxBytes) return false;
    const bytesToKeep = Math.max(0, Math.min(keepBytes, stat.size));
    const fd = fs.openSync(filePath, "r");
    try {
      const buffer = Buffer.alloc(bytesToKeep);
      const offset = stat.size - bytesToKeep;
      const bytesRead = fs.readSync(fd, buffer, 0, bytesToKeep, offset);
      fs.writeFileSync(filePath, buffer.subarray(0, bytesRead));
    } finally {
      fs.closeSync(fd);
    }
    return true;
  } catch (_) {
    return false;
  }
}

function trimRuntimeLogs(options = {}) {
  const now = Date.now();
  if (!options.force && now - lastLogTrimAt < 60_000) return;
  lastLogTrimAt = now;
  trimLogFile(MOBILE_WEB_LOG_FILE, MOBILE_WEB_LOG_MAX_BYTES, MOBILE_WEB_LOG_KEEP_BYTES);
}

function safeAppUpdateError(err) {
  return maskRemoteCredentials(String(err && err.message ? err.message : err || "unknown error")).slice(0, 1600);
}

function maskRemoteCredentials(value) {
  return String(value || "").replace(/([a-z][a-z0-9+.-]*:\/\/)([^/@\s]+)@/gi, "$1***@");
}

function safeRemoteUrl(value) {
  return maskRemoteCredentials(String(value || "").trim());
}

function compactProcessOutput(value, maxChars = 2400) {
  const text = maskRemoteCredentials(String(value || "").trim());
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.65);
  const tail = maxChars - head - 18;
  return `${text.slice(0, head)}...<truncated>...${text.slice(-tail)}`;
}

function assertSafeGitValue(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is empty`);
  if (text.startsWith("-") || /[\0\r\n]/.test(text)) throw new Error(`${label} is not a safe git ref value`);
  return text;
}

function assertSafeGitRemote(value, label = "update remote") {
  const text = assertSafeGitValue(value, label);
  if (!/^[A-Za-z0-9._-]+$/.test(text)) throw new Error(`${label} is not a safe git remote name`);
  return text;
}

function assertSafeGitBranch(value, label = "update branch") {
  const text = assertSafeGitValue(value, label);
  if (
    text.includes("..")
    || text.includes("@{")
    || text.includes("\\")
    || text.includes("//")
    || text.startsWith("/")
    || text.endsWith("/")
    || text.endsWith(".lock")
    || /[~^:?*[\]\s]/.test(text)
    || /(^|\/)\.(\.?)(\/|$)/.test(text)
  ) {
    throw new Error(`${label} is not a safe git branch name`);
  }
  return text;
}

function appUpdateRemoteRef(remote = APP_UPDATE_REMOTE, branch = APP_UPDATE_BRANCH) {
  return `${assertSafeGitRemote(remote)}/${assertSafeGitBranch(branch)}`;
}

function appUpdateTrackingRef(remote = APP_UPDATE_REMOTE, branch = APP_UPDATE_BRANCH) {
  return `refs/remotes/${assertSafeGitRemote(remote)}/${assertSafeGitBranch(branch)}`;
}

function appUpdateFetchRefspec(remote = APP_UPDATE_REMOTE, branch = APP_UPDATE_BRANCH) {
  return `+refs/heads/${assertSafeGitBranch(branch)}:${appUpdateTrackingRef(remote, branch)}`;
}

function shortCommit(value) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 7) : "";
}

function publicRepositoryCommitApiUrl(repository = PUBLIC_RELEASE_REPOSITORY, branch = PUBLIC_RELEASE_BRANCH) {
  const slug = normalizeRepositorySlug(repository);
  const ref = encodeURIComponent(assertSafeGitBranch(branch, "public release branch"));
  return `https://api.github.com/repos/${slug}/commits/${ref}`;
}

function remoteUrlLooksLikeRepository(remoteUrl, repository) {
  const slug = normalizeRepositorySlug(repository).toLowerCase();
  const text = safeRemoteUrl(remoteUrl).toLowerCase().replace(/\.git(?:[#?].*)?$/i, "");
  if (!text) return false;
  return text.includes(`github.com/${slug}`) || text.endsWith(`/${slug}`) || text.endsWith(`:${slug}`);
}

function makeStatusError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function runGit(args, options = {}) {
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || APP_UPDATE_CHECK_TIMEOUT_MS));
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: APP_ROOT,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    const append = (current, chunk) => {
      const next = current + String(chunk || "");
      return next.length > 256000 ? next.slice(0, 256000) : next;
    };
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill();
      } catch (_) {}
    }, timeoutMs);
    if (typeof timer.unref === "function") timer.unref();
    child.stdout.on("data", (chunk) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = append(stderr, chunk);
    });
    child.on("error", (err) => {
      finish(reject, err);
    });
    child.on("close", (code, signal) => {
      if (code === 0 && !timedOut) {
        finish(resolve, {
          stdout,
          stderr,
          code,
          signal,
        });
        return;
      }
      const command = ["git", ...args].join(" ");
      const details = compactProcessOutput(stderr || stdout || signal || "");
      const err = new Error(timedOut
        ? `${command} timed out after ${timeoutMs}ms`
        : `${command} failed with exit code ${code ?? signal}${details ? `: ${details}` : ""}`);
      err.code = code;
      err.signal = signal;
      err.stdout = stdout;
      err.stderr = stderr;
      err.timedOut = timedOut;
      finish(reject, err);
    });
  });
}

async function tryGit(args, options = {}) {
  try {
    return await runGit(args, options);
  } catch (err) {
    return { error: err, stdout: err.stdout || "", stderr: err.stderr || "", code: err.code };
  }
}

function unsupportedAppUpdateStatus(reason, extra = {}) {
  return Object.assign({
    supported: false,
    enabled: !APP_UPDATE_DISABLED,
    version: APP_VERSION,
    checking: false,
    applying: appUpdateApplying,
    updateAvailable: false,
    canFastForward: false,
    checkedAt: new Date().toISOString(),
    reason,
  }, extra);
}

function publicAppUpdateStatus(status, overrides = {}) {
  const value = status || unsupportedAppUpdateStatus("not checked");
  const publicValue = Object.assign({}, value);
  delete publicValue.checkedAtMs;
  return Object.assign({}, publicValue, {
    version: APP_VERSION,
    checking: Boolean(appUpdateCheckInFlight),
    applying: appUpdateApplying,
    restartScheduled: appUpdateRestartScheduled,
  }, overrides);
}

async function readAppUpdateStatus(options = {}) {
  const checkedAt = new Date().toISOString();
  if (APP_UPDATE_DISABLED) {
    return unsupportedAppUpdateStatus("disabled", { checkedAt });
  }
  let remote;
  let branch;
  try {
    remote = assertSafeGitRemote(APP_UPDATE_REMOTE);
    branch = assertSafeGitBranch(APP_UPDATE_BRANCH);
  } catch (err) {
    return unsupportedAppUpdateStatus(err.message, { checkedAt, error: safeAppUpdateError(err) });
  }

  const inside = await tryGit(["rev-parse", "--is-inside-work-tree"], { timeoutMs: APP_UPDATE_CHECK_TIMEOUT_MS });
  if (inside.error || inside.stdout.trim() !== "true") {
    return unsupportedAppUpdateStatus("not a git worktree", {
      checkedAt,
      error: inside.error ? safeAppUpdateError(inside.error) : "",
    });
  }

  const base = {
    supported: true,
    enabled: true,
    version: APP_VERSION,
    repository: APP_ROOT,
    remote,
    branch,
    checkedAt,
    checking: false,
    applying: appUpdateApplying,
  };

  try {
    const currentBranch = (await runGit(["branch", "--show-current"], { timeoutMs: APP_UPDATE_CHECK_TIMEOUT_MS })).stdout.trim();
    const remoteUrl = await tryGit(["remote", "get-url", remote], { timeoutMs: APP_UPDATE_CHECK_TIMEOUT_MS });
    if (remoteUrl.error) {
      return Object.assign(base, {
        supported: false,
        reason: `remote ${remote} not configured`,
        error: safeAppUpdateError(remoteUrl.error),
        updateAvailable: false,
        canFastForward: false,
      });
    }

    if (options.fetch) {
      await runGit(["fetch", "--quiet", "--prune", remote, appUpdateFetchRefspec(remote, branch)], { timeoutMs: APP_UPDATE_CHECK_TIMEOUT_MS });
    }

    const remoteRef = appUpdateRemoteRef(remote, branch);
    const localCommit = (await runGit(["rev-parse", "HEAD"], { timeoutMs: APP_UPDATE_CHECK_TIMEOUT_MS })).stdout.trim();
    const remoteCommit = (await runGit(["rev-parse", "--verify", `${remoteRef}^{commit}`], { timeoutMs: APP_UPDATE_CHECK_TIMEOUT_MS })).stdout.trim();
    const dirtyOutput = (await runGit(["status", "--porcelain", "--untracked-files=all"], { timeoutMs: APP_UPDATE_CHECK_TIMEOUT_MS })).stdout.trim();
    const counts = (await runGit(["rev-list", "--left-right", "--count", `HEAD...${remoteRef}`], { timeoutMs: APP_UPDATE_CHECK_TIMEOUT_MS }))
      .stdout
      .trim()
      .split(/\s+/)
      .map((part) => Number(part));
    const ahead = Number.isFinite(counts[0]) ? counts[0] : 0;
    const behind = Number.isFinite(counts[1]) ? counts[1] : 0;
    const dirty = Boolean(dirtyOutput);
    const branchMismatch = currentBranch !== branch;
    const diverged = ahead > 0 && behind > 0;
    const updateAvailable = behind > 0;
    const canFastForward = updateAvailable && !dirty && !diverged && ahead === 0 && !branchMismatch;
    let state = "up-to-date";
    let reason = "";
    if (branchMismatch) {
      state = "blocked";
      reason = currentBranch
        ? `current branch is ${currentBranch}, expected ${branch}`
        : `current checkout is detached, expected branch ${branch}`;
    } else if (dirty) {
      state = "blocked";
      reason = "working tree has local changes";
    } else if (diverged || ahead > 0) {
      state = "blocked";
      reason = "local branch has commits that are not on the remote branch";
    } else if (updateAvailable) {
      state = "update-available";
      reason = "remote branch is ahead";
    }

    return Object.assign(base, {
      state,
      reason,
      currentBranch,
      remoteUrl: safeRemoteUrl(remoteUrl.stdout),
      remoteRef,
      localCommit,
      remoteCommit,
      localShort: shortCommit(localCommit),
      remoteShort: shortCommit(remoteCommit),
      ahead,
      behind,
      dirty,
      dirtyCount: dirtyOutput ? dirtyOutput.split(/\r?\n/).filter(Boolean).length : 0,
      branchMismatch,
      diverged,
      updateAvailable,
      canFastForward,
    });
  } catch (err) {
    return Object.assign(base, {
      state: "error",
      error: safeAppUpdateError(err),
      updateAvailable: false,
      canFastForward: false,
    });
  }
}

async function refreshAppUpdateStatus(options = {}) {
  const now = Date.now();
  if (!options.force && !options.fetch && appUpdateStatus && appUpdateStatus.checkedAtMs && now - appUpdateStatus.checkedAtMs < APP_UPDATE_CACHE_MS) {
    return publicAppUpdateStatus(appUpdateStatus);
  }
  if (appUpdateCheckInFlight) return appUpdateCheckInFlight;
  appUpdateCheckInFlight = readAppUpdateStatus(options)
    .then((status) => {
      appUpdateStatus = Object.assign({}, status, { checkedAtMs: Date.now() });
      return publicAppUpdateStatus(appUpdateStatus, { checking: false });
    })
    .finally(() => {
      appUpdateCheckInFlight = null;
    });
  return appUpdateCheckInFlight;
}

function publicPullRequestError(err) {
  return String(err && err.message || err || "").replace(/\s+/g, " ").slice(0, 240);
}

async function fetchJsonWithTimeout(url, options = {}) {
  if (typeof fetch !== "function") throw new Error("fetch is unavailable in this Node runtime");
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || PUBLIC_PR_CHECK_TIMEOUT_MS));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof timer.unref === "function") timer.unref();
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "codex-mobile-web",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`GitHub PR check failed with HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function unsupportedPublicPullRequestStatus(reason, extra = {}) {
  return Object.assign({
    supported: false,
    enabled: !PUBLIC_PR_CHECK_DISABLED,
    repository: PUBLIC_PR_REPOSITORY,
    checkedAt: new Date().toISOString(),
    openPullRequestCount: 0,
    hasOpenPullRequests: false,
    pullRequests: [],
    reason,
  }, extra);
}

function unsupportedPublicReleaseStatus(reason, extra = {}) {
  return Object.assign({
    supported: false,
    enabled: !PUBLIC_RELEASE_CHECK_DISABLED,
    repository: PUBLIC_RELEASE_REPOSITORY,
    branch: PUBLIC_RELEASE_BRANCH,
    checkedAt: new Date().toISOString(),
    updateAvailable: false,
    canUpdateThroughCurrentCheckout: false,
    currentCheckoutUsesPublicRelease: false,
    reason,
  }, extra);
}

function publicPullRequestStatusForClient(status, overrides = {}) {
  const value = status || unsupportedPublicPullRequestStatus("not checked");
  const publicValue = Object.assign({}, value);
  delete publicValue.checkedAtMs;
  return Object.assign({}, publicValue, {
    checking: Boolean(publicPullRequestCheckInFlight),
  }, overrides);
}

async function readPublicPullRequestStatus() {
  if (PUBLIC_PR_CHECK_DISABLED) {
    return unsupportedPublicPullRequestStatus("disabled");
  }
  try {
    const pullRequests = await fetchJsonWithTimeout(publicPullRequestApiUrl(PUBLIC_PR_REPOSITORY), {
      timeoutMs: PUBLIC_PR_CHECK_TIMEOUT_MS,
    });
    return buildPublicPullRequestStatus({
      repository: PUBLIC_PR_REPOSITORY,
      pullRequests,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return unsupportedPublicPullRequestStatus(publicPullRequestError(err), {
      supported: true,
      error: publicPullRequestError(err),
    });
  }
}

async function refreshPublicPullRequestStatus(options = {}) {
  const now = Date.now();
  if (!options.force && publicPullRequestStatus && publicPullRequestStatus.checkedAtMs
    && now - publicPullRequestStatus.checkedAtMs < PUBLIC_PR_CHECK_CACHE_MS) {
    return publicPullRequestStatusForClient(publicPullRequestStatus);
  }
  if (publicPullRequestCheckInFlight) return publicPullRequestCheckInFlight;
  publicPullRequestCheckInFlight = readPublicPullRequestStatus()
    .then((status) => {
      publicPullRequestStatus = Object.assign({}, status, { checkedAtMs: Date.now() });
      return publicPullRequestStatusForClient(publicPullRequestStatus, { checking: false });
    })
    .finally(() => {
      publicPullRequestCheckInFlight = null;
    });
  return publicPullRequestCheckInFlight;
}

function publicReleaseStatusForClient(status, overrides = {}) {
  const value = status || unsupportedPublicReleaseStatus("not checked");
  const publicValue = Object.assign({}, value);
  delete publicValue.checkedAtMs;
  return Object.assign({}, publicValue, {
    checking: Boolean(publicReleaseCheckInFlight),
  }, overrides);
}

async function refreshPublicReleaseStatus(options = {}) {
  const now = Date.now();
  if (!options.force && publicReleaseStatus && publicReleaseStatus.checkedAtMs
    && now - publicReleaseStatus.checkedAtMs < PUBLIC_RELEASE_CHECK_CACHE_MS) {
    return publicReleaseStatusForClient(publicReleaseStatus);
  }
  if (publicReleaseCheckInFlight) return publicReleaseCheckInFlight;
  publicReleaseCheckInFlight = readPublicReleaseStatus()
    .then((status) => {
      publicReleaseStatus = Object.assign({}, status, { checkedAtMs: Date.now() });
      return publicReleaseStatusForClient(publicReleaseStatus, { checking: false });
    })
    .finally(() => {
      publicReleaseCheckInFlight = null;
    });
  return publicReleaseCheckInFlight;
}

async function applyAppUpdate() {
  if (appUpdateApplying) throw makeStatusError(409, "App update is already in progress");
  appUpdateApplying = true;
  try {
    const before = await refreshAppUpdateStatus({ fetch: true, force: true });
    if (!before.supported) throw makeStatusError(400, before.reason || before.error || "App update is not supported for this checkout");
    if (before.error) throw makeStatusError(502, before.error);
    if (before.branchMismatch) throw makeStatusError(409, before.reason || "Current branch does not match update branch");
    if (before.dirty) throw makeStatusError(409, "Working tree has local changes; commit or discard them before updating");
    if (before.diverged || Number(before.ahead || 0) > 0) {
      throw makeStatusError(409, "Local branch is ahead or diverged; automatic fast-forward update was refused");
    }
    if (!before.updateAvailable) {
      return { ok: true, updated: false, status: before };
    }
    if (!before.canFastForward) {
      throw makeStatusError(409, before.reason || "Remote update cannot be applied as a clean fast-forward");
    }
    await runGit(["merge", "--ff-only", before.remoteRef || appUpdateRemoteRef(before.remote, before.branch)], { timeoutMs: APP_UPDATE_APPLY_TIMEOUT_MS });
    const after = await refreshAppUpdateStatus({ force: true });
    return {
      ok: true,
      updated: true,
      restartInMs: APP_UPDATE_RESTART_DELAY_MS,
      before,
      after,
    };
  } finally {
    appUpdateApplying = false;
  }
}

function scheduleAppRestart(reason) {
  if (appUpdateRestartScheduled) return;
  appUpdateRestartScheduled = true;
  console.log(`[app-update] restart scheduled: ${reason || "update applied"}`);
  const timer = setTimeout(() => {
    shutdown();
  }, APP_UPDATE_RESTART_DELAY_MS);
  if (typeof timer.unref === "function") timer.unref();
}

function scheduleStartupAppUpdateCheck() {
  if (APP_UPDATE_DISABLED) return;
  const timer = setTimeout(() => {
    refreshAppUpdateStatus({ fetch: true, force: true }).catch((err) => {
      console.error(`[app-update] startup check failed: ${safeAppUpdateError(err)}`);
    });
  }, 1500);
  if (typeof timer.unref === "function") timer.unref();
}

function logThreadDetail(event, details = {}) {
  trimRuntimeLogs();
  const safeDetails = {};
  for (const [key, value] of Object.entries(details || {})) {
    if (value === undefined) continue;
    if (value instanceof Error) {
      safeDetails[key] = value.message || String(value);
    } else if (typeof value === "string") {
      safeDetails[key] = value.length > 600 ? `${value.slice(0, 600)}...` : value;
    } else {
      safeDetails[key] = value;
    }
  }
  console.log(`[thread-detail] ${event} ${JSON.stringify(safeDetails)}`);
}

function safeLogDetails(details = {}) {
  const safeDetails = {};
  for (const [key, value] of Object.entries(details || {})) {
    if (value === undefined) continue;
    if (value instanceof Error) {
      safeDetails[key] = value.message || String(value);
    } else if (typeof value === "string") {
      safeDetails[key] = value.length > 600 ? `${value.slice(0, 600)}...` : value;
    } else {
      safeDetails[key] = value;
    }
  }
  return safeDetails;
}

function logContinuation(event, details = {}) {
  trimRuntimeLogs();
  console.log(`[continuation] ${event} ${JSON.stringify(safeLogDetails(details))}`);
}

function logMessageSubmit(event, details = {}) {
  trimRuntimeLogs();
  console.log(`[message-submit] ${event} ${JSON.stringify(safeLogDetails(details))}`);
}

function isTurnSteerUnsupportedError(err) {
  const message = String((err && err.message) || err || "").toLowerCase();
  return /method not found|unknown method/.test(message);
}

function isStaleActiveTurnError(err) {
  const message = String((err && err.message) || err || "").toLowerCase();
  return /not found|not active|inactive|completed|interrupted|expected turn|turn.*not.*running|turn.*not.*active/.test(message);
}

async function staleActiveTurnPreflight(codexClient, threadId, activeTurnId) {
  if (!activeTurnId) return { stale: false, reason: "no-active-turn" };
  const summary = readStateDbThread(threadId) || readStartedThread(threadId);
  const rolloutStats = summary ? rolloutStatsForPath(rolloutPathForThread(summary)) : null;
  if (!rolloutStats) return { stale: false, reason: "no-rollout-stats" };
  if (Date.now() - rolloutStats.mtimeMs < TERMINAL_IDLE_ACTIVE_TURN_MS) {
    return { stale: false, reason: "rollout-recent" };
  }
  let turnsResult = null;
  try {
    turnsResult = await codexClient.request("thread/turns/list", {
      threadId,
      limit: 20,
      sortDirection: "desc",
    }, { timeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS, retry: false, resetOnTimeout: false });
  } catch (err) {
    return {
      stale: false,
      reason: "turns-list-error",
      error: err.message || String(err),
    };
  }
  return detectStaleActiveTurnForSubmission({
    activeTurnId,
    threadId,
    turnsResult,
    rolloutStats,
    pendingServerRequests: codexClient.pendingServerRequests(),
    nowMs: Date.now(),
    staleMs: STALE_ACTIVE_TURN_MS,
    terminalIdleMs: TERMINAL_IDLE_ACTIVE_TURN_MS,
  });
}

function logClientEvent(event, details = {}) {
  trimRuntimeLogs();
  console.log(`[client-event] ${event} ${JSON.stringify(safeLogDetails(details))}`);
}

function truncateMiddle(value, maxChars, label) {
  const text = String(value ?? "");
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.42);
  const tail = maxChars - head;
  return `${text.slice(0, head)}\n\n[${label} truncated: ${text.length} chars total, showing first ${head} and last ${tail}]\n\n${text.slice(-tail)}`;
}

function truncateTail(value, maxChars, label) {
  const text = String(value ?? "");
  if (text.length <= maxChars) return text;
  return `[${label} truncated: ${text.length} chars total, showing last ${maxChars}]\n\n${text.slice(-maxChars)}`;
}

function compactStructured(value) {
  if (value == null) return value;
  let raw;
  try {
    raw = JSON.stringify(value);
  } catch (_) {
    raw = String(value);
  }
  if (raw.length <= MAX_STRUCTURED_CHARS) return value;
  return {
    truncated: true,
    totalChars: raw.length,
    preview: truncateMiddle(raw, MAX_STRUCTURED_CHARS, "structured payload"),
  };
}

function compactStringArray(values, maxChars, label) {
  if (!Array.isArray(values)) return values;
  return values.map((value) => typeof value === "string" ? truncateMiddle(value, maxChars, label) : compactStructured(value));
}

function statusText(status) {
  if (!status) return "";
  if (typeof status === "string") return status;
  return status.type || JSON.stringify(status);
}

function normalizeFsPath(value) {
  return String(value || "")
    .replace(/^\\\\\?\\/, "")
    .replace(/[\\/]+/g, "\\")
    .replace(/\\+$/, "")
    .toLowerCase();
}

function visibleWorkspaceRoots(globalState = readGlobalState()) {
  const roots = new Set();
  for (const key of ["active-workspace-roots", "electron-saved-workspace-roots", "project-order"]) {
    const values = globalState[key];
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      if (typeof value === "string" && value.trim()) roots.add(value);
    }
  }
  for (const workspace of workspaceRegistryService.list()) {
    if (workspace && workspace.cwd) roots.add(workspace.cwd);
  }
  return roots;
}

function visibleWorkspaceKeys(globalState = readGlobalState()) {
  return new Set([...visibleWorkspaceRoots(globalState)].map(normalizeFsPath).filter(Boolean));
}

function visibleWorkspaceNames(globalState = readGlobalState()) {
  return new Set([...visibleWorkspaceRoots(globalState)]
    .map((root) => path.basename(path.resolve(root)))
    .filter(Boolean));
}

function visibleProjectlessThreadIds(globalState = readGlobalState()) {
  const ids = globalState["projectless-thread-ids"];
  return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string" && id) : []);
}

function visibilityFromGlobalState(globalState = readGlobalState()) {
  return {
    workspaceKeys: visibleWorkspaceKeys(globalState),
    workspaceNames: visibleWorkspaceNames(globalState),
    projectlessThreadIds: visibleProjectlessThreadIds(globalState),
  };
}

function codexWorktreeRepoName(cwd) {
  const value = String(cwd || "").trim();
  if (!value) return "";
  const homes = [CODEX_HOME, DEFAULT_CODEX_HOME].filter(Boolean);
  for (const home of homes) {
    const relative = path.relative(path.join(home, "worktrees"), path.resolve(value));
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) continue;
    const parts = relative.split(path.sep).filter(Boolean);
    if (parts.length >= 2) return parts[1];
  }
  return "";
}

function threadWorkspaceVisible(cwd, visibility = null) {
  const view = visibility || visibilityFromGlobalState();
  const cwdKey = normalizeFsPath(cwd);
  if (cwdKey && view.workspaceKeys && view.workspaceKeys.has(cwdKey)) return true;
  const worktreeRepo = codexWorktreeRepoName(cwd);
  return Boolean(worktreeRepo && view.workspaceNames && view.workspaceNames.has(worktreeRepo));
}

function threadMatchesWorkspaceCwd(threadCwd, selectedCwd) {
  const selected = String(selectedCwd || "").trim();
  if (!selected) return true;
  if (normalizeFsPath(threadCwd) === normalizeFsPath(selected)) return true;
  const worktreeRepo = codexWorktreeRepoName(threadCwd);
  return Boolean(worktreeRepo && worktreeRepo === path.basename(path.resolve(selected)));
}

function filePreviewEnvRoots() {
  return String(process.env.CODEX_MOBILE_FILE_PREVIEW_ROOTS || "")
    .split(path.delimiter)
    .map((value) => value.trim())
    .filter(Boolean);
}

function nearestAncestorWithChild(startPath, childName) {
  let current = path.resolve(String(startPath || ""));
  for (let depth = 0; depth < 12; depth += 1) {
    if (!current || current === path.dirname(current)) break;
    try {
      if (fs.existsSync(path.join(current, childName))) return current;
    } catch (_) {}
    current = path.dirname(current);
  }
  return "";
}

function safeRealpath(value) {
  try {
    return fs.realpathSync.native ? fs.realpathSync.native(value) : fs.realpathSync(value);
  } catch (_) {
    return "";
  }
}

function isPathInsideRoot(targetPath, rootPath) {
  const target = safeRealpath(targetPath);
  const root = safeRealpath(rootPath);
  if (!target || !root) return false;
  const relative = path.relative(root, target);
  return relative === "" || (relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function previewRootsForThread(threadId, globalState = readGlobalState(), options = {}) {
  const roots = new Map(filePreviewEnvRoots().map((root) => [root, "env"]));
  const visibleRoots = visibleWorkspaceRoots(globalState);
  for (const root of visibleRoots) roots.set(root, "workspace");
  const summary = options.threadSummary || readStateDbThread(threadId) || readStartedThread(threadId);
  const cwd = summary && typeof summary.cwd === "string" ? summary.cwd : "";
  const obsidianRoot = cwd ? nearestAncestorWithChild(cwd, ".obsidian") : "";
  if (cwd) {
    roots.set(cwd, "thread");
    if (obsidianRoot) roots.set(obsidianRoot, "obsidian");
  }
  const visible = new Set([...visibleRoots].map(normalizeFsPath).filter(Boolean));
  return [...roots.entries()]
    .map(([root, source]) => ({ root: path.resolve(root), source }))
    .filter((entry) => entry.root && fs.existsSync(entry.root))
    .filter((entry) => entry.source === "env"
      || entry.source === "workspace"
      || entry.source === "thread"
      || !visible.size
      || visible.has(normalizeFsPath(entry.root))
      || entry.root === obsidianRoot)
    .map((entry) => entry.root);
}

function stripMarkdownFileTarget(value) {
  let target = String(value || "").trim();
  if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1).trim();
  const stripLocationSuffix = (entry) => String(entry || "")
    .replace(/#L\d+(?:-L?\d+)?$/i, "")
    .replace(/#line-\d+$/i, "")
    .replace(/^(.+\.[^\\/:]+):\d+(?::\d+)?$/i, "$1");
  if (/^file:\/\//i.test(target)) {
    try {
      return stripLocationSuffix(decodeURIComponent(new URL(target).pathname));
    } catch (_) {
      return stripLocationSuffix(target.replace(/^file:\/\//i, ""));
    }
  }
  try {
    return stripLocationSuffix(decodeURIComponent(target));
  } catch (_) {
    return stripLocationSuffix(target);
  }
}

function hasDeniedPreviewPathSegment(filePath) {
  const parts = path.resolve(filePath).split(path.sep).filter(Boolean);
  return parts.some((part, index) => {
    const lower = part.toLowerCase();
    if (FILE_PREVIEW_DENIED_BASENAMES.has(lower)) return true;
    return index < parts.length - 1 && FILE_PREVIEW_DENIED_DIRS.has(lower);
  });
}

function filePreviewExtension(filePath) {
  const basename = path.basename(filePath).toLowerCase();
  if (basename.endsWith(".env.example")) return ".env.example";
  return path.extname(filePath).toLowerCase();
}

function allowedFilePreviewExtension(filePath) {
  const ext = filePreviewExtension(filePath);
  return FILE_PREVIEW_TEXT_EXTENSIONS.has(ext)
    || IMAGE_EXTENSIONS.has(ext)
    || FILE_PREVIEW_DOCUMENT_EXTENSIONS.has(ext);
}

function filePreviewContentType(filePath) {
  const ext = filePreviewExtension(filePath);
  if (FILE_PREVIEW_IMAGE_CONTENT_TYPES.has(ext)) return FILE_PREVIEW_IMAGE_CONTENT_TYPES.get(ext);
  if (ext === ".pdf") return "application/pdf";
  return FILE_PREVIEW_TEXT_CONTENT_TYPES.get(ext) || "text/plain; charset=utf-8";
}

function isTextFilePreview(filePath) {
  return FILE_PREVIEW_TEXT_EXTENSIONS.has(filePreviewExtension(filePath));
}

function isMediaFilePreview(filePath) {
  const ext = filePreviewExtension(filePath);
  return IMAGE_EXTENSIONS.has(ext) || FILE_PREVIEW_DOCUMENT_EXTENSIONS.has(ext);
}

function resolveFilePreviewPath(requestedPath, allowedRoots) {
  const target = stripMarkdownFileTarget(requestedPath);
  if (!target || !path.isAbsolute(target)) {
    const err = new Error("Only absolute local file paths can be previewed");
    err.statusCode = 400;
    throw err;
  }
  const resolved = path.resolve(target);
  if (hasDeniedPreviewPathSegment(resolved)) {
    const err = new Error("This file is not allowed for mobile preview");
    err.statusCode = 403;
    throw err;
  }
  if (!allowedFilePreviewExtension(resolved)) {
    const err = new Error("This file type is not supported for mobile preview");
    err.statusCode = 415;
    throw err;
  }
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch (_) {
    const err = new Error("File was not found");
    err.statusCode = 404;
    throw err;
  }
  if (!stat.isFile()) {
    const err = new Error("Only files can be previewed");
    err.statusCode = 400;
    throw err;
  }
  const matchingRoots = (allowedRoots || [])
    .map((root) => path.resolve(String(root || "")))
    .filter(Boolean)
    .filter((root) => isPathInsideRoot(resolved, root))
    .sort((a, b) => b.length - a.length);
  if (!matchingRoots.length) {
    const err = new Error("File is outside the allowed preview roots");
    err.statusCode = 403;
    throw err;
  }
  return {
    path: safeRealpath(resolved) || resolved,
    root: safeRealpath(matchingRoots[0]) || matchingRoots[0],
    stat,
  };
}

function previewKindForPath(filePath) {
  const ext = filePreviewExtension(filePath);
  if (ext === ".md" || ext === ".markdown") return "markdown";
  if (ext === ".json" || ext === ".jsonl") return "json";
  if (ext === ".yaml" || ext === ".yml") return "yaml";
  if (ext === ".csv") return "csv";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  return "text";
}

function filePreviewPublicFields(resolved, requestedPath = "", threadId = "") {
  const kind = previewKindForPath(resolved.path);
  const contentUrl = `/api/files/preview/content?threadId=${encodeURIComponent(threadId || "")}&path=${encodeURIComponent(resolved.path)}`;
  return {
    path: resolved.path,
    fileName: path.basename(resolved.path),
    relativePath: path.relative(resolved.root, resolved.path) || path.basename(resolved.path),
    kind,
    contentType: filePreviewContentType(resolved.path),
    sizeBytes: resolved.stat.size,
    sourcePath: stripMarkdownFileTarget(requestedPath || resolved.path),
    contentUrl,
  };
}

function readFilePreview(requestedPath, allowedRoots, options = {}) {
  const resolved = resolveFilePreviewPath(requestedPath, allowedRoots);
  const base = filePreviewPublicFields(resolved, requestedPath, options.threadId || "");
  if (isMediaFilePreview(resolved.path)) {
    if (resolved.stat.size > FILE_PREVIEW_MEDIA_MAX_BYTES) {
      const err = new Error(`File is too large for mobile preview (${Math.round(FILE_PREVIEW_MEDIA_MAX_BYTES / 1024 / 1024)} MB limit)`);
      err.statusCode = 413;
      throw err;
    }
    return Object.assign(base, {
      truncated: false,
      maxBytes: FILE_PREVIEW_MEDIA_MAX_BYTES,
    });
  }

  const limit = FILE_PREVIEW_MAX_BYTES;
  const fd = fs.openSync(resolved.path, "r");
  try {
    const bytesToRead = Math.min(resolved.stat.size, limit + 1);
    const buffer = Buffer.alloc(bytesToRead);
    const bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, 0);
    const truncated = bytesRead > limit || resolved.stat.size > limit;
    const content = buffer.subarray(0, Math.min(bytesRead, limit)).toString("utf8");
    return Object.assign(base, {
      truncated,
      maxBytes: limit,
      content,
    });
  } finally {
    fs.closeSync(fd);
  }
}

function filePreviewContentDisposition(filePath) {
  const basename = path.basename(filePath);
  const asciiName = basename.replace(/[^\x20-\x7E]+/g, "_").replaceAll('"', "");
  return `inline; filename="${asciiName || "preview"}"; filename*=UTF-8''${encodeURIComponent(basename)}`;
}

function serveFilePreviewContent(req, res, requestedPath, allowedRoots) {
  const resolved = resolveFilePreviewPath(requestedPath, allowedRoots);
  if (!isMediaFilePreview(resolved.path) && !isTextFilePreview(resolved.path)) {
    sendJson(res, 415, { error: "This file type is not supported for mobile preview" });
    return;
  }
  const limit = isMediaFilePreview(resolved.path) ? FILE_PREVIEW_MEDIA_MAX_BYTES : FILE_PREVIEW_MAX_BYTES;
  if (resolved.stat.size > limit) {
    sendJson(res, 413, { error: `File is too large for mobile preview (${Math.round(limit / 1024 / 1024)} MB limit)` });
    return;
  }
  res.writeHead(200, {
    "Content-Type": filePreviewContentType(resolved.path),
    "Content-Length": resolved.stat.size,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": filePreviewContentDisposition(resolved.path),
  });
  fs.createReadStream(resolved.path).pipe(res);
}

function generatedImageContentUrl(cacheId) {
  return `/api/generated-images/file?id=${encodeURIComponent(cacheId || "")}`;
}

function attachGeneratedImageContent(item, options = {}) {
  if (!item || (item.type !== "imageView" && item.type !== "imageGeneration")) return item;
  if (item.contentUrl || item.content_url) return item;
  const cached = cacheGeneratedImageForItem(item, {
    cacheRoot: GENERATED_IMAGE_ROOT,
    threadId: options.threadId || "",
    maxBytes: FILE_PREVIEW_MEDIA_MAX_BYTES,
    contentTypes: FILE_PREVIEW_IMAGE_CONTENT_TYPES,
    isDeniedPath: hasDeniedPreviewPathSegment,
  });
  if (!cached) return item;
  item.contentUrl = generatedImageContentUrl(cached.cacheId);
  item.generatedImage = {
    fileName: cached.fileName,
    contentType: cached.contentType,
    sizeBytes: cached.sizeBytes,
  };
  return item;
}

function isBackupRolloutPath(value) {
  return /\.jsonl\.(bak|backup|old)(?:\b|[-_.])/i.test(String(value || ""));
}

function isSubagentThreadSummary(thread) {
  return Boolean(thread && (
    thread.isSpawnedChildThread
    || String(thread.agentNickname || thread.agent_nickname || "").trim()
    || String(thread.agentRole || thread.agent_role || "").trim()
  ));
}

function archivedSessionThreadIds() {
  try {
    return new Set(fs.readdirSync(ARCHIVED_SESSIONS_DIR)
      .map((name) => String(name || "").match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i))
      .filter(Boolean)
      .map((match) => match[1]));
  } catch (_) {
    return new Set();
  }
}

function isHiddenThread(thread, visibility = null) {
  if (!thread || typeof thread !== "object") return true;
  const view = visibility || visibilityFromGlobalState();
  const status = statusText(thread.status).toLowerCase();
  const location = String(thread.path || thread.rolloutPath || thread.rollout_path || "").toLowerCase();
  if (thread.archived || thread.archivedAt || thread.archived_at || thread.isArchived) return true;
  if (thread.deleted || thread.deletedAt || thread.deleted_at || thread.isDeleted || thread.removed || thread.removedAt) return true;
  if (isSubagentThreadSummary(thread)) return true;
  if (/archived|deleted|removed/.test(status)) return true;
  if (/[/\\](archived|deleted|trash|removed)[_-]?sessions[/\\]/.test(location)) return true;
  if (isBackupRolloutPath(location)) return true;
  if (view.workspaceKeys && view.workspaceKeys.size > 0) {
    const cwd = String(thread.cwd || "").trim();
    if (cwd) return !threadWorkspaceVisible(cwd, view);
    return !view.projectlessThreadIds.has(thread.id);
  }
  return false;
}

function filterThreadListByCwd(result, cwd) {
  if (!cwd || !result || typeof result !== "object") return result;
  const out = Object.assign({}, result);
  if (Array.isArray(out.data)) out.data = out.data.filter((thread) => threadMatchesWorkspaceCwd(thread && thread.cwd, cwd));
  if (Array.isArray(out.threads)) out.threads = out.threads.filter((thread) => threadMatchesWorkspaceCwd(thread && thread.cwd, cwd));
  return out;
}

function mergeThreadListFallback(result, fallbackThreads = [], limit = 80) {
  const out = result && typeof result === "object" ? Object.assign({}, result) : {};
  const existing = Array.isArray(out.data)
    ? out.data
    : (Array.isArray(out.threads) ? out.threads : []);
  const merged = [];
  const seen = new Set();
  const addThread = (thread) => {
    if (!thread || !thread.id || seen.has(thread.id)) return;
    seen.add(thread.id);
    merged.push(thread);
  };
  existing.forEach(addThread);
  fallbackThreads.forEach(addThread);
  const capped = merged.slice(0, Math.max(1, limit));
  if (Array.isArray(out.data) || !Array.isArray(out.threads)) out.data = capped;
  if (Array.isArray(out.threads)) out.threads = capped;
  return out;
}

function filterVisibleThreads(result, globalState = readGlobalState()) {
  const visibility = visibilityFromGlobalState(globalState);
  if (!result || typeof result !== "object") return result;
  const out = Object.assign({}, result);
  if (Array.isArray(out.data)) out.data = mergeThreadStateFromStateDb(out.data)
    .filter((thread) => !isHiddenThread(thread, visibility))
    .map(annotateThreadRolloutStats);
  if (Array.isArray(out.threads)) out.threads = mergeThreadStateFromStateDb(out.threads)
    .filter((thread) => !isHiddenThread(thread, visibility))
    .map(annotateThreadRolloutStats);
  return out;
}

function mergeThreadStateFromStateDb(threads) {
  if (!Array.isArray(threads) || !threads.length || !fs.existsSync(STATE_DB)) return threads;
  const ids = Array.from(new Set(threads.map((thread) => String(thread && thread.id || "").trim()).filter(Boolean)));
  if (!ids.length) return threads;
  const inClause = ids.map((id) => sqlString(id)).join(", ");
  const query = [
    "select id,archived,archived_at,rollout_path,model,reasoning_effort,agent_nickname,agent_role,",
    "exists(select 1 from thread_spawn_edges where child_thread_id=threads.id) as is_spawned_child",
    "from threads",
    `where id in (${inClause});`,
  ].join(" ");
  try {
    const result = runSqliteJson(STATE_DB, query, { timeoutMs: 5000, maxBuffer: 1024 * 1024, userHome: USER_HOME });
    if (!result.ok) return threads;
    const rows = result.rows;
    if (!Array.isArray(rows) || !rows.length) return threads;
    const stateById = new Map();
    const archivedIds = archivedSessionThreadIds();
    for (const row of rows) {
      const id = String(row && row.id || "").trim();
      if (!id) continue;
      stateById.set(id, {
        archived: Boolean(Number(row.archived || 0))
          || archivedIds.has(id)
          || /[/\\]archived_sessions[/\\]/i.test(String(row.rollout_path || ""))
          || isBackupRolloutPath(row.rollout_path),
        archivedAt: row.archived_at || null,
        model: row.model || null,
        effort: row.reasoning_effort || null,
        agentNickname: row.agent_nickname || null,
        agentRole: row.agent_role || null,
        isSpawnedChildThread: Boolean(Number(row.is_spawned_child || 0)),
      });
    }
    return threads.map((thread) => {
      if (!thread || typeof thread !== "object") return thread;
      const state = stateById.get(String(thread.id || "").trim());
      if (!state) return thread;
      const next = Object.assign({}, thread);
      if (state.model) next.model = state.model;
      if (state.effort) next.effort = state.effort;
      if (state.agentNickname) next.agentNickname = state.agentNickname;
      if (state.agentRole) next.agentRole = state.agentRole;
      if (state.isSpawnedChildThread) next.isSpawnedChildThread = true;
      if (state.archived) {
        next.archived = true;
        next.archivedAt = state.archivedAt || thread.archivedAt || thread.archived_at || null;
      }
      return next;
    });
  } catch (_) {
    return threads;
  }
}

function isCompletedStatus(status) {
  return /completed|failed|cancel|error|interrupted/i.test(statusText(status));
}

function isLiveTurn(turn) {
  const text = statusText(turn && turn.status).toLowerCase();
  return /(running|active|queued|processing|inprogress|in_progress|in-progress)/.test(text)
    || (text === "interrupted" && turn && !turn.completedAt && !turn.durationMs);
}

function isContextCompactionType(type) {
  return /context.*compaction|context.*compression|context_compaction|context_compression/i.test(String(type || ""));
}

function contextCompactionNotice(pending) {
  return pending ? "历史上下文正在压缩" : "历史上下文已压缩";
}

function contextCompactionMobileState(item, options = {}) {
  if (options.contextCompactionPending === true) return "pending";
  if (options.contextCompactionPending === false) return "complete";
  const text = statusText(item && item.status).toLowerCase();
  if (!text) return "";
  if (isCompletedStatus(text)) return "complete";
  if (/(running|active|queued|processing|inprogress|in_progress|in-progress|pending|started)/.test(text)) {
    return "pending";
  }
  return "";
}

function isPathLikeValue(value) {
  const text = String(value || "");
  if (!text || text.includes("\n") || text.includes("\r")) return false;
  return /^[A-Za-z]:[\\/]/.test(text)
    || /^\\\\\?\\/.test(text)
    || /^[/\\][^/\\]+/.test(text)
    || /[\\/][^/\\]+\.[A-Za-z0-9]{1,12}$/.test(text);
}

function isFileNameLikeValue(value) {
  const text = String(value || "");
  return Boolean(text && !text.includes("\n") && !text.includes("\r") && /^[^\\/]+\.[A-Za-z0-9]{1,12}$/.test(text));
}

function collectFileNames(value, out = [], keyHint = "") {
  if (out.length >= 5 || value == null) return out;
  if (typeof value === "string") {
    const keyLooksPath = /^(path|file|filepath|filename|name|target|source|uri)$/i.test(keyHint);
    if (isPathLikeValue(value) || (keyLooksPath && isFileNameLikeValue(value))) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectFileNames(entry, out, keyHint);
    return out;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (/^(path|file|filePath|filename|name|target|source|uri)$/i.test(key) && typeof entry === "string"
        && (isPathLikeValue(entry) || isFileNameLikeValue(entry))) {
        out.push(entry);
        if (out.length >= 5) return out;
        continue;
      }
      collectFileNames(entry, out, key);
      if (out.length >= 5) return out;
    }
  }
  return out;
}

function isWebSearchLikeItem(item) {
  if (!item || typeof item !== "object") return false;
  return /web[_-]?search|websearch|search_query|image_query/i.test([
    item.type,
    item.tool,
    item.name,
    item.namespace,
    item.server,
  ].filter(Boolean).join(" "));
}

function isOperationalItem(item) {
  return item && (OPERATIONAL_ITEM_TYPES.has(item.type) || isWebSearchLikeItem(item));
}

function collectSearchSummaries(value, out = [], keyHint = "") {
  if (out.length >= 3 || value == null) return out;
  const keyLooksSearch = /^(q|query|searchQuery|url|pattern)$/i.test(keyHint);
  const keyLooksQueryList = /^queries$/i.test(keyHint);
  if (typeof value === "string") {
    const text = value.replace(/\s+/g, " ").trim();
    if ((keyLooksSearch || keyLooksQueryList) && text) out.push(text);
    return out;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectSearchSummaries(entry, out, keyLooksQueryList ? "query" : keyHint);
      if (out.length >= 3) return out;
    }
    return out;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      collectSearchSummaries(entry, out, key);
      if (out.length >= 3) return out;
    }
  }
  return out;
}

function searchSummaryFromOperation(item) {
  const summaries = collectSearchSummaries(item && (item.action || item.arguments || item.result || item.contentItems || item));
  return [...new Set(summaries)].slice(0, 3).join(" | ");
}

function compactItemTimestampFields(item) {
  const fields = {};
  for (const key of [
    "createdAtMs",
    "createdAt",
    "created_at_ms",
    "created_at",
    "startedAtMs",
    "startedAt",
    "started_at_ms",
    "started_at",
    "timestampMs",
    "timestamp",
    "completedAtMs",
    "completedAt",
    "completed_at_ms",
    "completed_at",
  ]) {
    if (item && item[key] !== undefined) fields[key] = item[key];
  }
  return fields;
}

function compactOperationalItem(out) {
  const isWebSearch = isWebSearchLikeItem(out);
  const command = typeof out.command === "string"
    ? out.command
    : (isWebSearch ? searchSummaryFromOperation(out) : undefined);
  const compact = {
    id: out.id,
    type: isWebSearch ? "dynamicToolCall" : out.type,
    ...compactItemTimestampFields(out),
    status: out.status,
    server: out.server,
    namespace: out.namespace,
    tool: isWebSearch ? "Web Search" : out.tool,
    callId: out.callId || out.call_id,
    command: typeof command === "string" ? truncateMiddle(command, 180, "command") : undefined,
    fileNames: [...new Set(Array.isArray(out.fileNames) && out.fileNames.length
      ? out.fileNames
      : collectFileNames(out.changes || out.arguments || out.result || out.contentItems))].slice(0, 5),
    mobileLiveOperation: true,
  };
  return Object.fromEntries(Object.entries(compact).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined;
  }));
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch (_) {
    return null;
  }
}

function parseJsonObject(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    return null;
  }
}

function lastString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeEnumValue(value, allowed) {
  const text = String(value || "").trim();
  return allowed.has(text) ? text : "";
}

function normalizePermissionModeValue(value) {
  const text = String(value || "").trim().toLowerCase();
  const aliases = {
    "full-access": "full",
    "workspace-write": "auto",
    "read-only": "auto",
    "auto-review": "auto",
    "auto-reviewing": "auto",
    config: "custom",
    "config.toml": "custom",
    "custom-config": "custom",
  };
  const normalized = aliases[text] || text;
  return PERMISSION_MODE_OPTIONS.includes(normalized) ? normalized : "";
}

function normalizeSandboxPolicyType(type) {
  const text = String(type || "").trim();
  return {
    "danger-full-access": "dangerFullAccess",
    dangerFullAccess: "dangerFullAccess",
    "read-only": "readOnly",
    readOnly: "readOnly",
    "workspace-write": "workspaceWrite",
    workspaceWrite: "workspaceWrite",
    "external-sandbox": "externalSandbox",
    externalSandbox: "externalSandbox",
  }[text] || "";
}

function sandboxModeFromPolicy(policy) {
  const type = normalizeSandboxPolicyType(policy && policy.type);
  return {
    dangerFullAccess: "danger-full-access",
    readOnly: "read-only",
    workspaceWrite: "workspace-write",
  }[type] || "";
}

function normalizeSandboxPolicy(value) {
  const policy = parseJsonObject(value);
  if (!policy) return null;
  const type = normalizeSandboxPolicyType(policy.type);
  if (type === "dangerFullAccess") return { type };
  if (type === "readOnly") {
    return {
      type,
      networkAccess: Boolean(policy.networkAccess ?? policy.network_access),
    };
  }
  if (type === "externalSandbox") {
    return {
      type,
      networkAccess: policy.networkAccess || policy.network_access || "restricted",
    };
  }
  if (type === "workspaceWrite") {
    return {
      type,
      writableRoots: Array.isArray(policy.writableRoots) ? policy.writableRoots : (Array.isArray(policy.writable_roots) ? policy.writable_roots : []),
      networkAccess: Boolean(policy.networkAccess ?? policy.network_access),
      excludeTmpdirEnvVar: Boolean(policy.excludeTmpdirEnvVar ?? policy.exclude_tmpdir_env_var),
      excludeSlashTmp: Boolean(policy.excludeSlashTmp ?? policy.exclude_slash_tmp),
    };
  }
  return null;
}

function normalizePermissionProfile(value) {
  const profile = parseJsonObject(value);
  if (!profile) return null;
  const fileSystem = profile.fileSystem || profile.file_system || null;
  return {
    network: profile.network || null,
    fileSystem: fileSystem ? {
      entries: Array.isArray(fileSystem.entries) ? fileSystem.entries : [],
      ...(fileSystem.globScanMaxDepth || fileSystem.glob_scan_max_depth
        ? { globScanMaxDepth: fileSystem.globScanMaxDepth || fileSystem.glob_scan_max_depth }
        : {}),
    } : null,
  };
}

function isRootWritePermissionProfile(profile) {
  const entries = profile
    && profile.fileSystem
    && Array.isArray(profile.fileSystem.entries)
    ? profile.fileSystem.entries
    : [];
  return entries.some((entry) => {
    const pathValue = entry && entry.path;
    return entry
      && entry.access === "write"
      && pathValue
      && pathValue.type === "special"
      && pathValue.value
      && pathValue.value.kind === "root";
  });
}

function isFullAccessRuntime(sandboxPolicy, permissionProfile) {
  return normalizeSandboxPolicyType(sandboxPolicy && sandboxPolicy.type) === "dangerFullAccess"
    || isRootWritePermissionProfile(permissionProfile);
}

function permissionModeFromRuntimeSettings(settings) {
  if (!settings) return "";
  const sandboxType = normalizeSandboxPolicyType(settings.sandboxPolicy && settings.sandboxPolicy.type);
  if (sandboxType === "dangerFullAccess" || isRootWritePermissionProfile(settings.permissionProfile)) return "full";
  if (sandboxType === "externalSandbox" || settings.permissionProfile) return "custom";
  if (sandboxType === "workspaceWrite" || sandboxType === "readOnly") return "auto";
  return "default";
}

function publicRuntimeSettings(settings) {
  if (!settings) return null;
  const sandboxType = normalizeSandboxPolicyType(settings.sandboxPolicy && settings.sandboxPolicy.type);
  return Object.fromEntries(Object.entries({
    permissionMode: permissionModeFromRuntimeSettings(settings),
    approvalPolicy: settings.approvalPolicy || null,
    sandboxPolicyType: sandboxType || null,
    reasoningSummary: settings.reasoningSummary || null,
    modelVerbosity: settings.modelVerbosity || null,
  }).filter(([, value]) => value != null && value !== ""));
}

function workspaceWriteSandboxPolicy(cwd, inheritedPolicy) {
  const inherited = normalizeSandboxPolicyType(inheritedPolicy && inheritedPolicy.type) === "workspaceWrite"
    ? inheritedPolicy
    : {};
  const writableRoots = Array.isArray(inherited.writableRoots) && inherited.writableRoots.length
    ? inherited.writableRoots
    : (cwd ? [cwd] : []);
  return {
    type: "workspaceWrite",
    writableRoots,
    networkAccess: Boolean(inherited.networkAccess),
    excludeTmpdirEnvVar: Boolean(inherited.excludeTmpdirEnvVar),
    excludeSlashTmp: Boolean(inherited.excludeSlashTmp),
  };
}

function readOnlySandboxPolicy(inheritedPolicy) {
  const inherited = normalizeSandboxPolicyType(inheritedPolicy && inheritedPolicy.type) === "readOnly"
    ? inheritedPolicy
    : {};
  return {
    type: "readOnly",
    networkAccess: Boolean(inherited.networkAccess),
  };
}

function applyPermissionModeOverride(settings, mode, cwd) {
  const normalized = normalizePermissionModeValue(mode);
  if (!normalized) return settings;
  const next = Object.assign({}, settings || {});
  if (normalized === "default") {
    next.approvalPolicy = "on-request";
    next.sandboxPolicy = workspaceWriteSandboxPolicy(cwd, next.sandboxPolicy);
    next.sandboxMode = "workspace-write";
    next.permissionProfile = null;
    return next;
  }
  if (normalized === "auto") {
    next.approvalPolicy = "on-request";
    next.sandboxPolicy = workspaceWriteSandboxPolicy(cwd, next.sandboxPolicy);
    next.sandboxMode = "workspace-write";
    next.permissionProfile = null;
    return next;
  }
  if (normalized === "full") {
    next.approvalPolicy = "never";
    next.sandboxPolicy = { type: "dangerFullAccess" };
    next.sandboxMode = "danger-full-access";
    next.permissionProfile = null;
    return next;
  }
  if (normalized === "custom") {
    const sandboxType = normalizeSandboxPolicyType(CODEX_CONFIG_DEFAULTS.sandboxMode);
    const approvalPolicy = normalizeEnumValue(
      CODEX_CONFIG_DEFAULTS.approvalPolicy,
      new Set(["untrusted", "on-request", "on-failure", "never"]),
    );
    if (sandboxType === "dangerFullAccess") {
      next.approvalPolicy = approvalPolicy || "never";
      next.sandboxPolicy = { type: "dangerFullAccess" };
      next.sandboxMode = "danger-full-access";
      next.permissionProfile = null;
    } else if (sandboxType === "readOnly") {
      next.approvalPolicy = approvalPolicy || "on-request";
      next.sandboxPolicy = readOnlySandboxPolicy(next.sandboxPolicy);
      next.sandboxMode = "read-only";
      next.permissionProfile = null;
    } else if (sandboxType === "workspaceWrite") {
      next.approvalPolicy = approvalPolicy || "on-request";
      next.sandboxPolicy = workspaceWriteSandboxPolicy(cwd, next.sandboxPolicy);
      next.sandboxMode = "workspace-write";
      next.permissionProfile = null;
    }
    return next;
  }
  return settings;
}

function readRolloutTail(rolloutPath) {
  if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) return "";
  let fd = null;
  try {
    const stat = fs.statSync(rolloutPath);
    const start = Math.max(0, stat.size - MAX_ROLLOUT_CONTEXT_BYTES);
    const length = stat.size - start;
    const buffer = Buffer.alloc(length);
    fd = fs.openSync(rolloutPath, "r");
    fs.readSync(fd, buffer, 0, length, start);
    return buffer.toString("utf8");
  } catch (_) {
    return "";
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (_) {}
    }
  }
}

function rememberItemTimestampCandidates(key, payload) {
  latestItemTimestampsByPath.set(key, {
    cachedAt: Date.now(),
    payload: payload || null,
  });
  while (latestItemTimestampsByPath.size > RUNTIME_CONTEXT_CACHE_MAX) {
    const firstKey = latestItemTimestampsByPath.keys().next().value;
    latestItemTimestampsByPath.delete(firstKey);
  }
}

function rememberTurnUsageSummaries(key, payload) {
  latestTurnUsageSummariesByPath.set(key, {
    cachedAt: Date.now(),
    payload: payload || null,
  });
  while (latestTurnUsageSummariesByPath.size > RUNTIME_CONTEXT_CACHE_MAX) {
    const firstKey = latestTurnUsageSummariesByPath.keys().next().value;
    latestTurnUsageSummariesByPath.delete(firstKey);
  }
}

function rolloutEntryTurnId(entry) {
  const payload = entry && entry.payload;
  return String((payload && (
    payload.turn_id
    || payload.turnId
    || (payload.turn && payload.turn.id)
    || (payload.turn && payload.turn.turn_id)
  )) || entry.turn_id || entry.turnId || "");
}

function rolloutItemTimestampCandidateType(entry) {
  if (!entry || !entry.payload) return "";
  const payload = entry.payload;
  if (entry.type === "event_msg") {
    if (payload.type === "user_message") return "userMessage";
    if (payload.type === "agent_message") return "agentMessage";
    if (payload.type === "agent_reasoning") return "reasoning";
    if (payload.type === "exec_command_end") return "commandExecution";
    if (payload.type === "patch_apply_end") return "fileChange";
    if (payload.type === "web_search_end") return "dynamicToolCall";
    if (payload.type === "context_compacted" || isContextCompactionType(payload.type)) return "contextCompaction";
    return "";
  }
  if (entry.type !== "response_item") return "";
  if (payload.type === "message") {
    if (payload.role === "user") return "userMessage";
    if (payload.role === "assistant") return "agentMessage";
    return "";
  }
  if (payload.type === "reasoning") return "reasoning";
  if (payload.type === "function_call") return "commandExecution";
  if (payload.type === "web_search_call") return "dynamicToolCall";
  if (payload.type === "custom_tool_call") return payload.name === "apply_patch" ? "fileChange" : "dynamicToolCall";
  return "";
}

function normalizeTimestampMatchText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (typeof entry === "string") return entry;
      if (!entry || typeof entry !== "object") return "";
      return entry.text || entry.message || entry.content || "";
    }).join(" ").replace(/\s+/g, " ").trim();
  }
  if (typeof value === "object") {
    return normalizeTimestampMatchText(value.text || value.message || value.content || value.summary || "");
  }
  return String(value || "").replace(/\s+/g, " ").trim();
}

function rolloutItemTimestampCandidateText(entry) {
  const payload = entry && entry.payload;
  if (!payload || typeof payload !== "object") return "";
  return normalizeTimestampMatchText(
    payload.message
    || payload.text
    || payload.content
    || payload.summary
    || payload.output,
  );
}

function rolloutItemTimestampCandidateId(entry) {
  const payload = entry && entry.payload;
  return String((payload && (payload.id || payload.call_id || payload.item_id || payload.itemId)) || "");
}

function itemTimestampCandidateId(item) {
  return String((item && (item.id || item.call_id || item.callId || item.item_id || item.itemId)) || "");
}

function itemTimestampMatchText(item) {
  if (!item || typeof item !== "object") return "";
  return normalizeTimestampMatchText(
    item.text
    || item.message
    || item.content
    || item.summary
    || item.output,
  );
}

function timestampTextsMatch(left, right) {
  const a = normalizeTimestampMatchText(left);
  const b = normalizeTimestampMatchText(right);
  if (!a || !b) return false;
  const shortA = a.slice(0, 240);
  const shortB = b.slice(0, 240);
  return shortA === shortB || shortA.startsWith(shortB) || shortB.startsWith(shortA);
}

const DEDUPED_ROLLOUT_TIMESTAMP_TYPES = new Set(["userMessage", "agentMessage", "reasoning"]);

function appendRolloutItemTimestampCandidate(list, candidate) {
  if (!candidate || !candidate.itemType || !candidate.timestampMs) return;
  const last = list.length ? list[list.length - 1] : null;
  if (last
    && DEDUPED_ROLLOUT_TIMESTAMP_TYPES.has(candidate.itemType)
    && last.itemType === candidate.itemType
    && Math.abs(last.timestampMs - candidate.timestampMs) <= 50) {
    if (!last.text && candidate.text) last.text = candidate.text;
    return;
  }
  list.push(candidate);
}

function rolloutTimestampFields(entry) {
  const timestampMs = timestampToMs(entry && entry.timestamp);
  if (!timestampMs) return {};
  return {
    startedAtMs: timestampMs,
    startedAt: new Date(timestampMs).toISOString(),
  };
}

function readRolloutItemTimestampCandidates(rolloutPath) {
  if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) {
    return { byTurn: new Map(), unscoped: [], scopedCount: 0 };
  }
  let cacheKey = "";
  try {
    const stat = fs.statSync(rolloutPath);
    cacheKey = runtimeContextCacheKey(rolloutPath, stat);
    const cached = latestItemTimestampsByPath.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt <= RUNTIME_CONTEXT_CACHE_TTL_MS) {
      return cached.payload || { byTurn: new Map(), unscoped: [], scopedCount: 0 };
    }
  } catch (_) {
    return { byTurn: new Map(), unscoped: [], scopedCount: 0 };
  }
  const byTurn = new Map();
  const unscoped = [];
  let scopedCount = 0;
  let currentTurnId = "";
  const tail = readRolloutTail(rolloutPath);
  for (const line of tail.split(/\r?\n/)) {
    if (!line || !line.trim()) continue;
    const entry = parseJsonLine(line);
    if (!entry || !entry.type) continue;
    const payload = entry.payload || {};
    const explicitTurnId = rolloutEntryTurnId(entry);
    if (entry.type === "turn_context" && explicitTurnId) currentTurnId = explicitTurnId;
    if (entry.type === "event_msg" && payload.type === "task_started" && explicitTurnId) {
      currentTurnId = explicitTurnId;
    }
    const itemType = rolloutItemTimestampCandidateType(entry);
    const timestampMs = timestampToMs(entry.timestamp);
    if (!itemType || !timestampMs) continue;
    const turnId = explicitTurnId || currentTurnId;
    const candidate = {
      turnId,
      itemType,
      timestampMs,
      timestamp: new Date(timestampMs).toISOString(),
      entryId: rolloutItemTimestampCandidateId(entry),
      text: rolloutItemTimestampCandidateText(entry),
    };
    if (turnId) {
      if (!byTurn.has(turnId)) byTurn.set(turnId, []);
      appendRolloutItemTimestampCandidate(byTurn.get(turnId), candidate);
      scopedCount += 1;
    } else {
      appendRolloutItemTimestampCandidate(unscoped, candidate);
    }
  }
  const payload = { byTurn, unscoped, scopedCount };
  if (cacheKey) rememberItemTimestampCandidates(cacheKey, payload);
  return payload;
}

function readRolloutTurnUsageSummaries(rolloutPath) {
  if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) {
    return { byTurnId: new Map(), unscoped: [] };
  }
  let cacheKey = "";
  try {
    const stat = fs.statSync(rolloutPath);
    cacheKey = runtimeContextCacheKey(rolloutPath, stat);
    const cached = latestTurnUsageSummariesByPath.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt <= RUNTIME_CONTEXT_CACHE_TTL_MS) {
      return cached.payload || { byTurnId: new Map(), unscoped: [] };
    }
  } catch (_) {
    return { byTurnId: new Map(), unscoped: [] };
  }
  const payload = collectTurnUsageSummariesFromRolloutText(readRolloutTail(rolloutPath));
  if (cacheKey) rememberTurnUsageSummaries(cacheKey, payload);
  return payload;
}

function turnCompletionUsageSummary(threadId, turnId) {
  const summary = readStateDbThread(threadId) || readStartedThread(threadId);
  const rolloutPath = rolloutPathForThread(summary);
  if (!rolloutPath) return null;
  const summaries = readRolloutTurnUsageSummaries(rolloutPath);
  const turnSummary = turnId && summaries.byTurnId instanceof Map
    ? summaries.byTurnId.get(String(turnId))
    : null;
  const unscoped = Array.isArray(summaries.unscoped) && summaries.unscoped.length
    ? summaries.unscoped[summaries.unscoped.length - 1]
    : null;
  const usageSummary = turnSummary || unscoped;
  if (!usageSummary) return null;
  const stats = rolloutStatsForPath(rolloutPath);
  return Object.assign({}, usageSummary, {
    rolloutSizeBytes: Number(stats.sizeBytes) || undefined,
    rolloutWarningThresholdBytes: Number(stats.warningThresholdBytes) || undefined,
    rolloutOverWarningThreshold: Boolean(stats.overWarningThreshold),
  });
}

function itemDisplayTimestampMs(item) {
  for (const key of [
    "createdAtMs",
    "createdAt",
    "created_at_ms",
    "created_at",
    "startedAtMs",
    "startedAt",
    "started_at_ms",
    "started_at",
    "timestampMs",
    "timestamp",
  ]) {
    const timestamp = timestampToMs(item && item[key]);
    if (timestamp) return timestamp;
  }
  return 0;
}

function timestampCandidateTypesForItem(item) {
  if (!item || typeof item !== "object") return [];
  const type = String(item.type || "");
  if (!type) return [];
  const aliases = [type];
  if (isContextCompactionType(type)) aliases.push("contextCompaction");
  if (isWebSearchLikeItem(item)) aliases.push("dynamicToolCall");
  if (isOperationalItem(item)) {
    if (type === "commandExecution") aliases.push("commandExecution");
    else if (type === "fileChange") aliases.push("fileChange");
    else aliases.push("dynamicToolCall");
  }
  return [...new Set(aliases.filter(Boolean))];
}

function takeNextTimestampCandidate(candidates, aliases) {
  if (!Array.isArray(candidates) || !candidates.length || !Array.isArray(aliases) || !aliases.length) return null;
  for (const candidate of candidates) {
    if (!candidate || candidate.used) continue;
    if (!aliases.includes(candidate.itemType)) continue;
    candidate.used = true;
    return candidate;
  }
  return null;
}

function takeTimestampCandidateForItem(candidates, item, aliases) {
  if (!Array.isArray(candidates) || !candidates.length || !item || !Array.isArray(aliases) || !aliases.length) return null;
  const itemId = itemTimestampCandidateId(item);
  if (itemId) {
    for (const candidate of candidates) {
      if (!candidate || candidate.used) continue;
      if (!aliases.includes(candidate.itemType)) continue;
      if (candidate.entryId !== itemId) continue;
      candidate.used = true;
      return candidate;
    }
  }
  const itemType = String(item.type || "");
  const itemText = itemTimestampMatchText(item);
  if ((itemType === "agentMessage" || itemType === "userMessage" || itemType === "plan") && itemText) {
    for (const candidate of candidates) {
      if (!candidate || candidate.used) continue;
      if (!aliases.includes(candidate.itemType)) continue;
      if (!timestampTextsMatch(candidate.text, itemText)) continue;
      candidate.used = true;
      return candidate;
    }
    return null;
  }
  return takeNextTimestampCandidate(candidates, aliases);
}

function applyRolloutItemTimestamp(item, candidate) {
  if (!item || !candidate || !candidate.timestampMs || itemDisplayTimestampMs(item)) return;
  item.startedAtMs = candidate.timestampMs;
  item.startedAt = candidate.timestamp || new Date(candidate.timestampMs).toISOString();
}

function enrichTurnItemTimestampsFromCandidates(turn, candidates) {
  if (!turn || !Array.isArray(turn.items) || !Array.isArray(candidates) || !candidates.length) return turn;
  const orderedCandidates = candidates.map((candidate) => Object.assign({}, candidate, { used: false }));
  for (const item of turn.items) {
    if (!item || itemDisplayTimestampMs(item)) continue;
    const candidate = takeTimestampCandidateForItem(orderedCandidates, item, timestampCandidateTypesForItem(item));
    if (candidate) applyRolloutItemTimestamp(item, candidate);
  }
  return turn;
}

function enrichThreadItemTimestampsFromRollout(thread) {
  if (!thread || typeof thread !== "object" || !Array.isArray(thread.turns) || !thread.turns.length) return thread;
  const rolloutPath = rolloutPathForThread(thread);
  if (!rolloutPath) return thread;
  const candidates = readRolloutItemTimestampCandidates(rolloutPath);
  if (!candidates) return thread;
  const latestIndex = thread.turns.length - 1;
  thread.turns.forEach((turn, index) => {
    const turnId = String((turn && turn.id) || "");
    let turnCandidates = turnId && candidates.byTurn ? candidates.byTurn.get(turnId) : null;
    if ((!turnCandidates || !turnCandidates.length)
      && index === latestIndex
      && candidates.scopedCount === 0
      && Array.isArray(candidates.unscoped)
      && candidates.unscoped.length) {
      turnCandidates = candidates.unscoped;
    }
    enrichTurnItemTimestampsFromCandidates(turn, turnCandidates || []);
  });
  return thread;
}

function rolloutPathForThread(thread) {
  return thread && (thread.path || thread.rolloutPath || thread.rollout_path) || "";
}

function rolloutStatsForPath(rolloutPath) {
  if (!rolloutPath || typeof rolloutPath !== "string") return null;
  try {
    const stat = fs.statSync(rolloutPath);
    if (!stat.isFile()) return null;
    return {
      sizeBytes: stat.size,
      mtimeMs: Math.trunc(Number(stat.mtimeMs || 0)),
      warningThresholdBytes: ROLLOUT_WARNING_BYTES,
      overWarningThreshold: stat.size >= ROLLOUT_WARNING_BYTES,
    };
  } catch (_) {
    return null;
  }
}

function annotateThreadRolloutStats(thread) {
  if (!thread || typeof thread !== "object") return thread;
  const out = Object.assign({}, thread);
  const stats = rolloutStatsForPath(rolloutPathForThread(out));
  out.rolloutWarningThresholdBytes = ROLLOUT_WARNING_BYTES;
  if (!stats) return out;
  out.rolloutSizeBytes = stats.sizeBytes;
  out.rolloutSizeUpdatedAtMs = stats.mtimeMs;
  out.rolloutOverWarningThreshold = stats.overWarningThreshold;
  return out;
}

function runtimeContextCacheKey(rolloutPath, stat) {
  return `${normalizeFsPath(rolloutPath)}:${stat.size}:${Math.trunc(Number(stat.mtimeMs || 0))}`;
}

function rememberRuntimeContext(key, payload) {
  latestRuntimeContextByPath.set(key, {
    cachedAt: Date.now(),
    payload: payload || null,
  });
  while (latestRuntimeContextByPath.size > RUNTIME_CONTEXT_CACHE_MAX) {
    const firstKey = latestRuntimeContextByPath.keys().next().value;
    latestRuntimeContextByPath.delete(firstKey);
  }
}

function readLatestTurnContext(thread) {
  const rolloutPath = thread && (thread.path || thread.rolloutPath || thread.rollout_path);
  if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) return null;
  let fd = null;
  try {
    const stat = fs.statSync(rolloutPath);
    const cacheKey = runtimeContextCacheKey(rolloutPath, stat);
    const cached = latestRuntimeContextByPath.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt <= RUNTIME_CONTEXT_CACHE_TTL_MS) {
      return cached.payload;
    }
    fd = fs.openSync(rolloutPath, "r");
    const chunkSize = 1024 * 1024;
    let position = stat.size;
    let scanned = 0;
    let carry = "";
    while (position > 0 && scanned < MAX_RUNTIME_CONTEXT_SCAN_BYTES) {
      const length = Math.min(chunkSize, position, MAX_RUNTIME_CONTEXT_SCAN_BYTES - scanned);
      position -= length;
      scanned += length;
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, position);
      const text = buffer.toString("utf8") + carry;
      const lines = text.split(/\r?\n/);
      carry = lines.shift() || "";
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        const line = lines[index];
        if (!line || !line.includes('"type":"turn_context"')) continue;
        const entry = parseJsonLine(line);
        if (entry && entry.type === "turn_context" && entry.payload && typeof entry.payload === "object") {
          rememberRuntimeContext(cacheKey, entry.payload);
          return entry.payload;
        }
      }
    }
    if (carry && carry.includes('"type":"turn_context"')) {
      const entry = parseJsonLine(carry);
      if (entry && entry.type === "turn_context" && entry.payload && typeof entry.payload === "object") {
        rememberRuntimeContext(cacheKey, entry.payload);
        return entry.payload;
      }
    }
  } catch (_) {
    return null;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (_) {}
    }
  }
  try {
    const stat = fs.statSync(rolloutPath);
    rememberRuntimeContext(runtimeContextCacheKey(rolloutPath, stat), null);
  } catch (_) {}
  return null;
}

function threadRuntimeSettings(threadId, fallbackThread = null) {
  const thread = readStateDbThread(threadId) || fallbackThread;
  const context = readLatestTurnContext(thread) || {};
  const sandboxPolicy = normalizeSandboxPolicy(context.sandbox_policy || (thread && thread.sandboxPolicy));
  const permissionProfile = normalizePermissionProfile(context.permission_profile || (thread && thread.permissionProfile));
  let approvalPolicy = normalizeEnumValue(
    lastString(context.approval_policy, thread && thread.approvalPolicy),
    new Set(["untrusted", "on-request", "on-failure", "never"]),
  );
  if (isFullAccessRuntime(sandboxPolicy, permissionProfile) && (!approvalPolicy || approvalPolicy === "on-request")) {
    approvalPolicy = "never";
  }
  const reasoningSummary = normalizeEnumValue(
    lastString(context.summary, context.reasoning_summary, context.model_reasoning_summary, CODEX_CONFIG_DEFAULTS.reasoningSummary),
    new Set(["auto", "concise", "detailed", "none"]),
  );
  const modelVerbosity = normalizeEnumValue(
    lastString(context.model_verbosity, CODEX_CONFIG_DEFAULTS.modelVerbosity),
    new Set(["low", "medium", "high"]),
  );
  return {
    approvalPolicy,
    sandboxPolicy,
    sandboxMode: sandboxModeFromPolicy(sandboxPolicy),
    permissionProfile,
    reasoningSummary,
    modelVerbosity,
  };
}

async function resolveThreadRuntimeSettings(threadId) {
  if (readStateDbThread(threadId)) return threadRuntimeSettings(threadId);
  let fallbackThread = null;
  try {
    fallbackThread = await readThreadSummaryFromAppServer(codex, threadId);
  } catch (_) {
    fallbackThread = null;
  }
  return threadRuntimeSettings(threadId, fallbackThread);
}

function applyResumeRuntimeSettings(params, settings) {
  if (!settings) return params;
  if (settings.approvalPolicy) params.approvalPolicy = settings.approvalPolicy;
  if (settings.permissionProfile) params.permissionProfile = settings.permissionProfile;
  else if (settings.sandboxMode) params.sandbox = settings.sandboxMode;
  const config = {};
  if (settings.reasoningSummary) config.model_reasoning_summary = settings.reasoningSummary;
  if (settings.modelVerbosity) config.model_verbosity = settings.modelVerbosity;
  if (Object.keys(config).length) params.config = Object.assign({}, params.config || {}, config);
  return params;
}

function applyStartThreadRuntimeSettings(params, settings) {
  if (!settings) return params;
  if (settings.approvalPolicy) params.approvalPolicy = settings.approvalPolicy;
  if (settings.permissionProfile) params.permissionProfile = settings.permissionProfile;
  else if (settings.sandboxMode) params.sandbox = settings.sandboxMode;
  const config = {};
  if (settings.reasoningSummary) config.model_reasoning_summary = settings.reasoningSummary;
  if (settings.modelVerbosity) config.model_verbosity = settings.modelVerbosity;
  if (Object.keys(config).length) params.config = Object.assign({}, params.config || {}, config);
  return params;
}

function applyTurnRuntimeSettings(params, settings) {
  if (!settings) return params;
  if (settings.approvalPolicy) params.approvalPolicy = settings.approvalPolicy;
  if (settings.sandboxPolicy) params.sandboxPolicy = settings.sandboxPolicy;
  else if (settings.permissionProfile) params.permissionProfile = settings.permissionProfile;
  if (settings.reasoningSummary) params.summary = settings.reasoningSummary;
  return params;
}

function requestedCodexFastMode(value) {
  return /^(1|true|on|yes|fast|priority)$/i.test(String(value || "").trim());
}

function applyCodexFastServiceTier(params, enabled) {
  if (enabled) params.serviceTier = "priority";
  return params;
}

function statusFromRawOperation(payload) {
  const status = String(payload.status || "").toLowerCase();
  if (status) return status;
  if (typeof payload.success === "boolean") return payload.success ? "completed" : "failed";
  if (typeof payload.exit_code === "number") return payload.exit_code === 0 ? "completed" : "failed";
  return "running";
}

function commandFromRawPayload(payload) {
  if (Array.isArray(payload.parsed_cmd) && payload.parsed_cmd[0] && payload.parsed_cmd[0].cmd) {
    return String(payload.parsed_cmd[0].cmd);
  }
  if (Array.isArray(payload.command)) return payload.command.join(" ");
  if (typeof payload.arguments === "string") {
    const parsed = parseJsonLine(payload.arguments);
    if (parsed && parsed.command) return String(parsed.command);
  }
  return "";
}

function fileNamesFromPatchInput(input) {
  const names = [];
  for (const line of String(input || "").split(/\r?\n/)) {
    const match = /^(?:\*\*\* (?:Add|Update|Delete) File:|\*\*\* Move to:)\s+(.+)$/.exec(line.trim());
    if (match) names.push(match[1].trim());
  }
  return [...new Set(names)].slice(0, 5);
}

function rawOperationFromEntry(entry) {
  if (!entry || !entry.payload) return null;
  const payload = entry.payload;
  if (entry.type === "event_msg" && payload.type === "web_search_end") {
    return compactOperationalItem({
      id: `raw-${payload.call_id || entry.timestamp || "web-search"}`,
      type: "web_search_call",
      callId: payload.call_id,
      ...rolloutTimestampFields(entry),
      status: statusFromRawOperation(payload),
      tool: "Web Search",
      command: searchSummaryFromOperation(payload),
      action: payload.action,
    });
  }
  if (entry.type === "event_msg" && payload.type === "exec_command_end") {
    return compactOperationalItem({
      id: `raw-${payload.call_id || entry.timestamp || "command"}`,
      type: "commandExecution",
      callId: payload.call_id,
      ...rolloutTimestampFields(entry),
      status: statusFromRawOperation(payload),
      command: commandFromRawPayload(payload),
    });
  }
  if (entry.type === "event_msg" && payload.type === "patch_apply_end") {
    return compactOperationalItem({
      id: `raw-${payload.call_id || entry.timestamp || "patch"}`,
      type: "fileChange",
      callId: payload.call_id,
      ...rolloutTimestampFields(entry),
      status: statusFromRawOperation(payload),
      fileNames: Object.keys(payload.changes || {}).slice(0, 5),
    });
  }
  if (entry.type === "response_item" && payload.type === "function_call") {
    return compactOperationalItem({
      id: `raw-${payload.call_id || entry.timestamp || "function"}`,
      type: "commandExecution",
      callId: payload.call_id,
      ...rolloutTimestampFields(entry),
      status: statusFromRawOperation(payload),
      command: commandFromRawPayload(payload),
    });
  }
  if (entry.type === "response_item" && payload.type === "web_search_call") {
    return compactOperationalItem({
      id: `raw-${payload.call_id || entry.timestamp || "web-search"}`,
      type: "web_search_call",
      callId: payload.call_id,
      ...rolloutTimestampFields(entry),
      status: statusFromRawOperation(payload),
      tool: "Web Search",
      command: searchSummaryFromOperation(payload),
      action: payload.action,
    });
  }
  if (entry.type === "response_item" && payload.type === "custom_tool_call") {
    const fileNames = payload.name === "apply_patch" ? fileNamesFromPatchInput(payload.input) : [];
    return compactOperationalItem({
      id: `raw-${payload.call_id || entry.timestamp || "tool"}`,
      type: fileNames.length ? "fileChange" : "dynamicToolCall",
      callId: payload.call_id,
      ...rolloutTimestampFields(entry),
      status: statusFromRawOperation(payload),
      tool: payload.name,
      fileNames,
    });
  }
  return null;
}

function rawOperationOutputCallId(entry) {
  if (!entry || !entry.payload) return "";
  const payload = entry.payload;
  if (entry.type === "response_item" && /^(function_call_output|custom_tool_call_output)$/.test(String(payload.type || ""))) {
    return String(payload.call_id || "");
  }
  if (entry.type === "event_msg" && /^(exec_command_end|patch_apply_end|web_search_end)$/.test(String(payload.type || ""))) {
    return String(payload.call_id || "");
  }
  return "";
}

function statusFromRawOperationOutput(payload) {
  const status = statusFromRawOperation(payload || {});
  return status === "running" ? "completed" : status;
}

function readLatestRawOperation(thread, turnId = "", options = {}) {
  const rolloutPath = thread && (thread.path || thread.rolloutPath || thread.rollout_path);
  if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) return null;
  try {
    const lines = fs.readFileSync(rolloutPath, "utf8").split(/\r?\n/).filter(Boolean).slice(-800);
    const operations = [];
    const completedCallIds = new Set();
    const completedCallStatuses = new Map();
    let currentTurnId = "";
    for (const line of lines) {
      const entry = parseJsonLine(line);
      if (!entry || !entry.payload) continue;
      const payload = entry.payload || {};
      const explicitTurnId = rolloutEntryTurnId(entry);
      if (entry.type === "turn_context" && explicitTurnId) currentTurnId = explicitTurnId;
      if (entry.type === "event_msg" && payload.type === "task_started" && explicitTurnId) {
        currentTurnId = explicitTurnId;
      }
      const outputCallId = rawOperationOutputCallId(entry);
      if (outputCallId) {
        const outputStatus = statusFromRawOperationOutput(payload);
        completedCallIds.add(outputCallId);
        completedCallStatuses.set(outputCallId, outputStatus);
        for (const operation of operations) {
          if (operation && operation.callId === outputCallId && !isCompletedStatus(operation.status)) {
            operation.status = outputStatus;
          }
        }
      }
      const operation = rawOperationFromEntry(entry);
      if (!operation) continue;
      operation.rolloutTurnId = explicitTurnId || currentTurnId || "";
      if (operation.callId && completedCallIds.has(operation.callId)) {
        operation.status = completedCallStatuses.get(operation.callId) || "completed";
      }
      operations.push(operation);
    }
    const targetTurnId = String(turnId || "");
    const includeCompleted = Boolean(options.includeCompleted);
    for (let index = operations.length - 1; index >= 0; index -= 1) {
      const operation = operations[index];
      const operationTurnId = String(operation.rolloutTurnId || "");
      const operationCompleted = isCompletedStatus(operation.status)
        || (operation.callId && completedCallIds.has(operation.callId));
      if (targetTurnId && operationTurnId && operationTurnId !== targetTurnId) continue;
      if (operationCompleted && !includeCompleted) continue;
      if (targetTurnId && operationCompleted && operationTurnId !== targetTurnId) continue;
      return operation;
    }
  } catch (_) {
    return null;
  }
  return null;
}

function compactItem(item, options = {}) {
  if (!item || typeof item !== "object") return item;
  const out = Object.assign({}, item);
  if (isContextCompactionType(out.type)) {
    const compactionState = contextCompactionMobileState(out, options);
    const compacted = {
      id: out.id,
      type: out.type,
      ...compactItemTimestampFields(out),
      status: out.status,
    };
    if (!compactionState) return compacted;
    const pending = compactionState === "pending";
    return {
      ...compacted,
      mobileCompactionStatus: pending ? "running" : "completed",
      mobileNotice: contextCompactionNotice(pending),
    };
  }
  if (isOperationalItem(out)) {
    return compactOperationalItem(out);
  }
  if (out.type === "imageView" || out.type === "imageGeneration") attachGeneratedImageContent(out, options);
  if (typeof out.text === "string") out.text = truncateMiddle(out.text, MAX_TEXT_CHARS, "text");
  if (Array.isArray(out.content)) out.content = compactStringArray(out.content, MAX_TEXT_CHARS, "content");
  if (Array.isArray(out.summary)) out.summary = compactStringArray(out.summary, MAX_TEXT_CHARS, "summary");
  if (out.type === "commandExecution" && typeof out.aggregatedOutput === "string") {
    out.outputTotalChars = out.outputTotalChars || out.aggregatedOutput.length;
    out.outputTruncated = out.aggregatedOutput.length > MAX_COMMAND_OUTPUT_CHARS || Boolean(out.outputTruncated);
    out.aggregatedOutput = truncateTail(out.aggregatedOutput, MAX_COMMAND_OUTPUT_CHARS, "command output");
  }
  if (out.result) out.result = compactStructured(out.result);
  if (out.contentItems) out.contentItems = compactStructured(out.contentItems);
  if (out.changes) out.changes = compactStructured(out.changes);
  return out;
}

function trailingOperationIndex(items, allowLiveOperation) {
  if (!allowLiveOperation || !Array.isArray(items)) return -1;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (isOperationalItem(items[index])) return index;
  }
  return -1;
}

function compactTurn(turn, options = {}) {
  if (!turn || typeof turn !== "object") return turn;
  const out = Object.assign({}, turn);
  if (Array.isArray(out.items)) {
    const allowOperation = Boolean(options.allowLiveOperation) && isLiveTurn(out);
    const lastOperationIndex = trailingOperationIndex(out.items, allowOperation);
    out.items = out.items.map((item) => compactItem(item, options)).filter((item, index) => {
      if (!isOperationalItem(item)) return true;
      return index === lastOperationIndex;
    });
    let remainingOutputBudget = MAX_COMMAND_OUTPUT_CHARS_PER_TURN;
    for (let i = out.items.length - 1; i >= 0; i--) {
      const item = out.items[i];
      if (!item || item.type !== "commandExecution" || typeof item.aggregatedOutput !== "string") continue;
      const output = item.aggregatedOutput;
      if (remainingOutputBudget <= 0) {
        item.outputOmitted = true;
        item.outputTruncated = true;
        item.outputTotalChars = item.outputTotalChars || output.length;
        item.aggregatedOutput = "";
        continue;
      }
      if (output.length > remainingOutputBudget) {
        item.outputTruncated = true;
        item.outputTotalChars = item.outputTotalChars || output.length;
        item.aggregatedOutput = truncateTail(output, remainingOutputBudget, "turn command output");
        remainingOutputBudget = 0;
        continue;
      }
      remainingOutputBudget -= output.length;
    }
  }
  return out;
}

function compactThread(thread, options = {}) {
  if (!thread || typeof thread !== "object") return thread;
  const out = Object.assign({}, thread);
  const rolloutPath = rolloutPathForThread(out);
  const rolloutStats = rolloutStatsForPath(rolloutPath);
  const maxTurns = Math.max(1, Math.min(200, Number(options.maxTurns || MAX_THREAD_TURNS)));
  if (Array.isArray(out.turns)) {
    const omitted = Math.max(0, out.turns.length - maxTurns);
    if (omitted > 0) {
      out.mobileOmittedTurnCount = omitted;
      out.turns = out.turns.slice(-maxTurns);
    }
    pendingSteerEchoStore.injectIntoThread(out);
    enrichThreadItemTimestampsFromRollout(out);
    attachTurnUsageSummaries(out, readRolloutTurnUsageSummaries(rolloutPath), { rolloutStats });
    const latestIndex = out.turns.length - 1;
    out.turns = out.turns.map((turn, index) => compactTurn(turn, {
      allowLiveOperation: index === latestIndex,
      threadId: out.id || out.threadId || "",
    }));
    const latest = out.turns[latestIndex];
    if (latest && isLiveTurn(latest) && Array.isArray(latest.items)
      && !latest.items.some((item) => isOperationalItem(item))) {
      const rawOperation = readLatestRawOperation(out, latest.id, { includeCompleted: true });
      if (rawOperation) latest.items.push(rawOperation);
    }
  }
  return annotateThreadRolloutStats(out);
}

function compactThreadReadResult(result, options = {}) {
  if (!result || typeof result !== "object") return result;
  const out = Object.assign({}, result);
  if (out.thread) out.thread = compactThread(out.thread, options);
  return out;
}

function compactTurnsListResult(result) {
  if (!result || typeof result !== "object") return result;
  const out = Object.assign({}, result);
  if (Array.isArray(out.data)) out.data = out.data.map((turn) => compactTurn(turn));
  if (Array.isArray(out.turns)) out.turns = out.turns.map((turn) => compactTurn(turn));
  return out;
}

function compactNotification(payload) {
  if (!payload || payload.type !== "notification" || !payload.params) return payload;
  if (String(payload.method || "").startsWith("turn/diff/")) {
    return null;
  }
  if (payload.method === "item/commandExecution/outputDelta" || payload.method === "item/fileChange/outputDelta") {
    return null;
  }
  if (payload.method === "item/reasoning/textDelta" || payload.method === "item/reasoning/summaryTextDelta") {
    return null;
  }
  const out = {
    type: payload.type,
    method: payload.method,
    params: Object.assign({}, payload.params),
  };
  const threadId = notificationThreadId(payload);
  if (out.params.item) {
    out.params.item = compactItem(out.params.item, {
      threadId,
      contextCompactionPending: payload.method === "item/started"
        ? true
        : payload.method === "item/completed"
          ? false
          : undefined,
    });
  }
  if (out.params.turn) out.params.turn = compactTurn(out.params.turn, { allowLiveOperation: true, threadId });
  if (payload.method === "account/rateLimits/updated" && out.params.rateLimits) {
    out.params.rateLimits = compactRateLimits(out.params.rateLimits);
  }
  if (payload.method === "item/commandExecution/outputDelta" && typeof out.params.delta === "string") {
    out.params.originalDeltaChars = out.params.delta.length;
    out.params.deltaTruncated = out.params.delta.length > MAX_DELTA_CHARS;
    out.params.delta = truncateTail(out.params.delta, MAX_DELTA_CHARS, "command output delta");
  }
  if ((payload.method === "item/agentMessage/delta" || payload.method === "item/reasoning/textDelta" || payload.method === "item/reasoning/summaryTextDelta") && typeof out.params.delta === "string") {
    out.params.originalDeltaChars = out.params.delta.length;
    out.params.deltaTruncated = out.params.delta.length > MAX_DELTA_CHARS;
    out.params.delta = truncateMiddle(out.params.delta, MAX_DELTA_CHARS, "text delta");
  }
  return out;
}

function compactRateLimitWindow(value) {
  if (!value || typeof value !== "object") return null;
  const usedPercent = value.usedPercent ?? value.used_percent;
  const windowDurationMins = value.windowDurationMins ?? value.window_minutes;
  const resetsAt = value.resetsAt ?? value.resets_at;
  return Object.fromEntries(Object.entries({
    usedPercent: Number.isFinite(Number(usedPercent)) ? Number(usedPercent) : undefined,
    windowDurationMins: Number.isFinite(Number(windowDurationMins)) ? Number(windowDurationMins) : undefined,
    resetsAt: Number.isFinite(Number(resetsAt)) ? Number(resetsAt) : undefined,
  }).filter(([, entry]) => entry !== undefined));
}

function compactRateLimits(value) {
  if (!value || typeof value !== "object") return null;
  const compacted = Object.fromEntries(Object.entries({
    limitId: value.limitId || value.limit_id || undefined,
    limitName: value.limitName || value.limit_name || undefined,
    model: value.model || undefined,
    primary: compactRateLimitWindow(value.primary),
    secondary: compactRateLimitWindow(value.secondary),
    credits: value.credits || null,
    planType: value.planType || value.plan_type || undefined,
    rateLimitReachedType: value.rateLimitReachedType || value.rate_limit_reached_type || null,
  }).filter(([, entry]) => entry !== undefined));
  const modelKeys = rateLimitModelKeys(compacted);
  if (modelKeys.length) compacted.modelKeys = modelKeys;
  return compacted;
}

function normalizeModelKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function addRateLimitModelKey(keys, value) {
  const key = normalizeModelKey(value);
  if (key) keys.add(key);
}

function isSparkModelKey(key) {
  return /\bspark\b/.test(normalizeModelKey(key));
}

function rateLimitModelKeys(rateLimits) {
  if (!rateLimits || typeof rateLimits !== "object") return [];
  const keys = new Set();
  if (Array.isArray(rateLimits.modelKeys)) {
    for (const value of rateLimits.modelKeys) addRateLimitModelKey(keys, value);
  }
  addRateLimitModelKey(keys, rateLimits.model);
  addRateLimitModelKey(keys, rateLimits.limitName);
  const limitNameKey = normalizeModelKey(rateLimits.limitName);
  for (const model of MODEL_OPTIONS) {
    const modelKey = normalizeModelKey(model);
    if (modelKey && limitNameKey === modelKey) keys.add(modelKey);
  }
  const limitId = normalizeModelKey(rateLimits.limitId);
  if (limitId === "codex-bengalfox") keys.add("gpt-5.3-codex-spark");
  else if (limitId === "codex") {
    for (const model of MODEL_OPTIONS) {
      const modelKey = normalizeModelKey(model);
      if (modelKey && !isSparkModelKey(modelKey)) keys.add(modelKey);
    }
  }
  return [...keys];
}

function rateLimitWindows(rateLimits) {
  return [rateLimits && rateLimits.primary, rateLimits && rateLimits.secondary]
    .filter((windowInfo) => windowInfo && Number.isFinite(Number(windowInfo.usedPercent)));
}

function hasCurrentRateLimitWindow(rateLimits) {
  const nowSeconds = Date.now() / 1000;
  return rateLimitWindows(rateLimits).some((windowInfo) => {
    const resetsAt = Number(windowInfo.resetsAt || 0);
    return !resetsAt || resetsAt > nowSeconds;
  });
}

function storeRateLimits(compacted, byModel) {
  for (const key of compacted.modelKeys || rateLimitModelKeys(compacted)) {
    byModel.set(normalizeModelKey(key), compacted);
  }
  return compacted;
}

function recordRateLimits(value, options = {}) {
  const compacted = compactRateLimits(value);
  if (!compacted || !hasCurrentRateLimitWindow(compacted)) return null;
  if (options.source === "rollout") {
    latestSnapshotRateLimits = compacted;
    return storeRateLimits(compacted, latestSnapshotRateLimitsByModel);
  }
  latestLiveRateLimits = compacted;
  return storeRateLimits(compacted, latestLiveRateLimitsByModel);
}

function activeRateLimits() {
  return latestLiveRateLimits || latestSnapshotRateLimits;
}

function activeRateLimitsByModelMap() {
  return latestLiveRateLimitsByModel.size ? latestLiveRateLimitsByModel : latestSnapshotRateLimitsByModel;
}

function collectRecentRolloutFiles(root, options = {}) {
  const maxFiles = Number(options.maxFiles || 160);
  const maxDepth = Number(options.maxDepth || 6);
  const out = [];
  const visit = (dir, depth) => {
    if (out.length >= maxFiles * 4 || depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath, depth + 1);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
      try {
        const stat = fs.statSync(fullPath);
        out.push({ path: fullPath, mtimeMs: Number(stat.mtimeMs || 0), size: Number(stat.size || 0) });
      } catch (_) {
        // A rollout may disappear while the app rotates files.
      }
    }
  };
  visit(root, 0);
  return out
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, maxFiles);
}

function readRolloutTailForRateLimits(filePath, maxBytes = 2 * 1024 * 1024) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size <= 0) return "";
    const bytesToRead = Math.min(maxBytes, stat.size);
    const fd = fs.openSync(filePath, "r");
    try {
      const buffer = Buffer.alloc(bytesToRead);
      fs.readSync(fd, buffer, 0, bytesToRead, stat.size - bytesToRead);
      return buffer.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch (_) {
    return "";
  }
}

function loadRecentRateLimitsFromRollouts(options = {}) {
  const now = Date.now();
  const force = options.force === true;
  if (!force && now - lastRolloutRateLimitScanAt < 60000) return;
  lastRolloutRateLimitScanAt = now;
  const files = [
    ...collectRecentRolloutFiles(SESSIONS_DIR, { maxFiles: 140 }),
    ...collectRecentRolloutFiles(ARCHIVED_SESSIONS_DIR, { maxFiles: 60, maxDepth: 1 }),
  ].sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 180);
  const latestByGroup = new Map();
  for (const file of files) {
    const tail = readRolloutTailForRateLimits(file.path);
    if (!tail.includes("rate_limits")) continue;
    const lines = tail.split(/\r?\n/).filter(Boolean).reverse();
    for (const line of lines) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch (_) {
        continue;
      }
      const rateLimits = entry && entry.payload && entry.payload.rate_limits;
      const compacted = compactRateLimits(rateLimits);
      if (!compacted || !hasCurrentRateLimitWindow(compacted)) continue;
      const group = normalizeModelKey(compacted.limitId);
      if (!group) continue;
      const eventMs = Date.parse(entry.timestamp || "") || file.mtimeMs || 0;
      const existing = latestByGroup.get(group);
      if (!existing || eventMs > existing.eventMs) {
        latestByGroup.set(group, { eventMs, rateLimits: compacted });
      }
    }
  }
  for (const entry of [...latestByGroup.values()].sort((a, b) => a.eventMs - b.eventMs)) {
    recordRateLimits(entry.rateLimits, { source: "rollout" });
  }
}

async function readPublicReleaseStatus() {
  if (PUBLIC_RELEASE_CHECK_DISABLED) {
    return unsupportedPublicReleaseStatus("disabled");
  }
  let branch;
  try {
    branch = assertSafeGitBranch(PUBLIC_RELEASE_BRANCH, "public release branch");
  } catch (err) {
    return unsupportedPublicReleaseStatus(err.message, { error: safeAppUpdateError(err) });
  }
  try {
    const commit = await fetchJsonWithTimeout(publicRepositoryCommitApiUrl(PUBLIC_RELEASE_REPOSITORY, branch), {
      timeoutMs: PUBLIC_PR_CHECK_TIMEOUT_MS,
    });
    const publicCommit = String(commit && commit.sha || "").trim();
    const local = await tryGit(["rev-parse", "HEAD"], { timeoutMs: APP_UPDATE_CHECK_TIMEOUT_MS });
    const localCommit = local.error ? "" : local.stdout.trim();
    const remoteUrl = await tryGit(["remote", "get-url", APP_UPDATE_REMOTE], { timeoutMs: APP_UPDATE_CHECK_TIMEOUT_MS });
    const currentRemoteUrl = remoteUrl.error ? "" : safeRemoteUrl(remoteUrl.stdout);
    const currentCheckoutUsesPublicRelease = remoteUrlLooksLikeRepository(currentRemoteUrl, PUBLIC_RELEASE_REPOSITORY);
    return {
      supported: true,
      enabled: true,
      repository: PUBLIC_RELEASE_REPOSITORY,
      branch,
      checkedAt: new Date().toISOString(),
      localCommit,
      localShort: shortCommit(localCommit),
      publicCommit,
      publicShort: shortCommit(publicCommit),
      publicHtmlUrl: String(commit && commit.html_url || ""),
      publicCommittedAt: String(commit && commit.commit && commit.commit.committer && commit.commit.committer.date || ""),
      publicMessage: String(commit && commit.commit && commit.commit.message || "").split(/\r?\n/)[0].slice(0, 240),
      currentRemote: APP_UPDATE_REMOTE,
      currentRemoteUrl,
      currentCheckoutUsesPublicRelease,
      updateAvailable: Boolean(localCommit && publicCommit && localCommit !== publicCommit),
      canUpdateThroughCurrentCheckout: currentCheckoutUsesPublicRelease,
      reason: currentCheckoutUsesPublicRelease
        ? "current checkout tracks public release"
        : "current checkout does not track the public release repository",
    };
  } catch (err) {
    return unsupportedPublicReleaseStatus(publicPullRequestError(err), {
      supported: true,
      error: publicPullRequestError(err),
    });
  }
}

function rateLimitsByModelObject() {
  return Object.fromEntries([...activeRateLimitsByModelMap().entries()]);
}

function compactApprovalText(value, maxChars = 1200) {
  return truncateMiddle(String(value ?? ""), maxChars, "approval text");
}

function commandTextFromApproval(method, params = {}) {
  if (method === "execCommandApproval" && Array.isArray(params.command)) return params.command.join(" ");
  if (typeof params.command === "string") return params.command;
  if (Array.isArray(params.commandActions) && params.commandActions.length) {
    return params.commandActions.map((action) => action && action.command).filter(Boolean).join(" && ");
  }
  return "";
}

function fileNamesFromApproval(method, params = {}) {
  if (method === "applyPatchApproval" && params.fileChanges && typeof params.fileChanges === "object") {
    return Object.keys(params.fileChanges).slice(0, 12);
  }
  return [];
}

function compactUserInputQuestions(params = {}) {
  if (!Array.isArray(params.questions)) return [];
  return params.questions.slice(0, 8).map((question) => {
    const options = Array.isArray(question && question.options)
      ? question.options.slice(0, 12).map((option) => Object.fromEntries(Object.entries({
        label: option && option.label ? compactApprovalText(option.label, 240) : "",
        description: option && option.description ? compactApprovalText(option.description, 500) : "",
      }).filter(([, value]) => value !== "")))
      : [];
    return Object.fromEntries(Object.entries({
      id: question && question.id ? String(question.id) : "",
      header: question && question.header ? compactApprovalText(question.header, 240) : "",
      question: question && question.question ? compactApprovalText(question.question, 1200) : "",
      isOther: Boolean(question && question.isOther),
      options,
    }).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== "" && value !== false;
    }));
  });
}

function compactApprovalParams(method, params = {}) {
  return Object.fromEntries(Object.entries({
    threadId: params.threadId || params.conversationId || null,
    turnId: params.turnId || null,
    itemId: params.itemId || params.callId || null,
    approvalId: params.approvalId || null,
    reason: params.reason ? compactApprovalText(params.reason, 900) : null,
    command: commandTextFromApproval(method, params) ? compactApprovalText(commandTextFromApproval(method, params), 1800) : null,
    cwd: params.cwd || null,
    grantRoot: params.grantRoot || null,
    fileNames: fileNamesFromApproval(method, params),
    permissions: method === "item/permissions/requestApproval" ? compactStructured(params.permissions || {}) : null,
    networkApprovalContext: params.networkApprovalContext || null,
    questions: method === "item/tool/requestUserInput" ? compactUserInputQuestions(params) : [],
    elicitationId: method === "mcpServer/elicitation/request" ? params.elicitationId || null : null,
    title: method === "mcpServer/elicitation/request" && params.title ? compactApprovalText(params.title, 240) : null,
    message: method === "mcpServer/elicitation/request" && params.message ? compactApprovalText(params.message, 1200) : null,
    schema: method === "mcpServer/elicitation/request" && params.schema ? compactStructured(params.schema) : null,
    elicitation: method === "mcpServer/elicitation/request" && params.elicitation ? compactStructured(params.elicitation) : null,
  }).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== "";
  }));
}

function publicServerRequest(request) {
  return {
    id: String(request.id),
    method: request.method,
    status: request.status || "waiting",
    decision: request.decision || null,
    receivedAt: request.receivedAt || null,
    respondedAt: request.respondedAt || null,
    actionable: ACTIONABLE_SERVER_REQUEST_METHODS.has(request.method),
    params: compactApprovalParams(request.method, request.params || {}),
  };
}

function grantedPermissionsFromRequest(params = {}) {
  const permissions = params.permissions || {};
  const granted = {};
  if (permissions.network) granted.network = permissions.network;
  if (permissions.fileSystem) granted.fileSystem = permissions.fileSystem;
  return granted;
}

function approvalResponsePayload(request, decision) {
  const method = request && request.method;
  const params = (request && request.params) || {};
  if (!["allow_once", "allow_session", "deny"].includes(decision)) {
    throw new Error("Invalid approval decision");
  }
  if (method === "item/commandExecution/requestApproval") {
    return {
      result: {
        decision: decision === "allow_once" ? "accept" : decision === "allow_session" ? "acceptForSession" : "decline",
      },
    };
  }
  if (method === "item/fileChange/requestApproval") {
    return {
      result: {
        decision: decision === "allow_once" ? "accept" : decision === "allow_session" ? "acceptForSession" : "decline",
      },
    };
  }
  if (method === "execCommandApproval" || method === "applyPatchApproval") {
    return {
      result: {
        decision: decision === "allow_once" ? "approved" : decision === "allow_session" ? "approved_for_session" : "denied",
      },
    };
  }
  if (method === "item/permissions/requestApproval") {
    if (decision === "deny") {
      return { error: { code: -32001, message: "Permission request denied" } };
    }
    return {
      result: {
        permissions: grantedPermissionsFromRequest(params),
        scope: decision === "allow_session" ? "session" : "turn",
        strictAutoReview: false,
      },
    };
  }
  throw new Error(`Unsupported server request method: ${method || "unknown"}`);
}

function userInputResponsePayload(request, body = {}) {
  const params = (request && request.params) || {};
  const questions = Array.isArray(params.questions) ? params.questions : [];
  if (body.answers && typeof body.answers === "object") {
    return { result: { answers: body.answers } };
  }
  const responseText = String(body.responseText || body.text || "").trim();
  const questionId = String(body.questionId || (questions[0] && questions[0].id) || "answer");
  return {
    result: {
      answers: responseText ? { [questionId]: { answers: [responseText] } } : {},
    },
  };
}

function mcpElicitationResponsePayload(body = {}) {
  const action = body.action === "decline" || body.decision === "deny" ? "decline" : "accept";
  if (action === "decline") return { result: { action, content: null } };
  const responseText = String(body.responseText || body.text || "").trim();
  const result = { action, content: {} };
  if (body.content && typeof body.content === "object") result.content = body.content;
  else if (responseText) result.content = { response: responseText };
  return { result };
}

function serverRequestResponsePayload(request, body = {}) {
  const method = request && request.method;
  if (ACTIONABLE_APPROVAL_METHODS.has(method)) {
    return approvalResponsePayload(request, String(body.decision || ""));
  }
  if (method === "item/tool/requestUserInput") return userInputResponsePayload(request, body);
  if (method === "mcpServer/elicitation/request") return mcpElicitationResponsePayload(body);
  throw new Error(`Unsupported server request method: ${method || "unknown"}`);
}

function readRawBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_JSON_BODY_BYTES) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function readJsonFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return fallback;
  }
}

function writeRuntimeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function normalizePushSubject(value) {
  const subject = String(value || "").trim();
  return subject || DEFAULT_PUSH_SUBJECT;
}

function isLocalhostPushSubject(value) {
  const subject = String(value || "");
  if (/\blocalhost\b|127\.0\.0\.1|\[::1\]/i.test(subject)) return true;
  try {
    const url = new URL(subject);
    return url.hostname === "localhost"
      || url.hostname === "127.0.0.1"
      || url.hostname === "::1"
      || url.hostname.endsWith(".localhost");
  } catch (_) {
    return false;
  }
}

function storedPushSubject(existingSubject) {
  const existing = normalizePushSubject(existingSubject);
  if (process.env.CODEX_MOBILE_PUSH_SUBJECT) return PUSH_SUBJECT;
  return isLocalhostPushSubject(existing) ? PUSH_SUBJECT : existing;
}

function loadPushVapidKeys() {
  if (pushVapidKeys) return pushVapidKeys;
  const existing = readJsonFile(PUSH_VAPID_FILE, null);
  if (existing && existing.publicKey && existing.privateKey) {
    const subject = storedPushSubject(existing.subject);
    pushVapidKeys = {
      publicKey: String(existing.publicKey),
      privateKey: String(existing.privateKey),
      subject,
    };
    if (subject !== existing.subject) {
      writeRuntimeJson(PUSH_VAPID_FILE, Object.assign({}, existing, {
        subject,
        updatedAt: new Date().toISOString(),
      }));
    }
  } else {
    const generated = webPush.generateVAPIDKeys();
    pushVapidKeys = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      subject: PUSH_SUBJECT,
      createdAt: new Date().toISOString(),
    };
    writeRuntimeJson(PUSH_VAPID_FILE, pushVapidKeys);
  }
  webPush.setVapidDetails(pushVapidKeys.subject || PUSH_SUBJECT, pushVapidKeys.publicKey, pushVapidKeys.privateKey);
  return pushVapidKeys;
}

function loadPushSubscriptions() {
  if (pushSubscriptionsCache) return pushSubscriptionsCache;
  const raw = readJsonFile(PUSH_SUBSCRIPTIONS_FILE, []);
  pushSubscriptionsCache = Array.isArray(raw) ? raw.filter((entry) => entry && entry.endpoint) : [];
  return pushSubscriptionsCache;
}

function savePushSubscriptions(subscriptions = loadPushSubscriptions()) {
  pushSubscriptionsCache = subscriptions.filter((entry) => entry && entry.endpoint);
  writeRuntimeJson(PUSH_SUBSCRIPTIONS_FILE, pushSubscriptionsCache);
}

function normalizePushSubscription(value) {
  const sub = value && value.subscription ? value.subscription : value;
  if (!sub || typeof sub !== "object") throw new Error("Push subscription is required");
  if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    throw new Error("Push subscription is incomplete");
  }
  return {
    endpoint: String(sub.endpoint),
    expirationTime: sub.expirationTime || null,
    keys: {
      p256dh: String(sub.keys.p256dh),
      auth: String(sub.keys.auth),
    },
  };
}

function pushSubscriptionPublicStatus() {
  return {
    supported: true,
    subscriptionCount: loadPushSubscriptions().length,
  };
}

function prunePushSentTurns(now = Date.now()) {
  const maxAgeMs = 24 * 60 * 60 * 1000;
  for (const [key, sentAt] of pushSentTurns) {
    if (now - sentAt > maxAgeMs) pushSentTurns.delete(key);
  }
}

function prunePushThreadClassCache(now = Date.now()) {
  for (const [threadId, entry] of pushThreadClassCache) {
    const maxAgeMs = entry && entry.value === "unknown" ? 5000 : 24 * 60 * 60 * 1000;
    if (!entry || now - Number(entry.cachedAt || 0) > maxAgeMs) pushThreadClassCache.delete(threadId);
  }
  while (pushThreadClassCache.size > 2000) {
    const firstKey = pushThreadClassCache.keys().next().value;
    if (!firstKey) break;
    pushThreadClassCache.delete(firstKey);
  }
}

function classifyWebPushThreadId(threadId) {
  const id = String(threadId || "").trim();
  if (!id || !fs.existsSync(STATE_DB)) return "unknown";
  const now = Date.now();
  const cached = pushThreadClassCache.get(id);
  if (cached) {
    const maxAgeMs = cached.value === "unknown" ? 5000 : 24 * 60 * 60 * 1000;
    if (now - Number(cached.cachedAt || 0) <= maxAgeMs) return cached.value;
  }
  const query = [
    "select",
    "exists(select 1 from threads where id=t.id) as known,",
    "exists(select 1 from thread_spawn_edges where child_thread_id=t.id) as is_child,",
    "exists(select 1 from threads where id=t.id and (coalesce(agent_nickname,'') <> '' or coalesce(agent_role,'') <> '')) as has_agent_metadata",
    `from (select ${sqlString(id)} as id) t;`,
  ].join(" ");
  let value = "unknown";
  try {
    const result = runSqliteJson(STATE_DB, query, { timeoutMs: 3000, maxBuffer: 1024 * 1024, userHome: USER_HOME });
    const row = result.ok && Array.isArray(result.rows) ? result.rows[0] : null;
    if (row && (Number(row.is_child || 0) || Number(row.has_agent_metadata || 0))) value = "subagent";
    else if (row && Number(row.known || 0)) value = "main";
  } catch (_) {
    value = "unknown";
  }
  pushThreadClassCache.set(id, { value, cachedAt: now });
  prunePushThreadClassCache(now);
  return value;
}

function prunePushObservedTurns(now = Date.now()) {
  const maxAgeMs = 24 * 60 * 60 * 1000;
  for (const [turnId, meta] of pushObservedTurns) {
    if (!meta || now - Number(meta.observedAt || 0) > maxAgeMs) pushObservedTurns.delete(turnId);
  }
  while (pushObservedTurns.size > 1000) {
    const firstKey = pushObservedTurns.keys().next().value;
    if (!firstKey) break;
    pushObservedTurns.delete(firstKey);
  }
}

function pushTurnId(params) {
  return String((params && params.turn && params.turn.id) || (params && params.turnId) || "");
}

function threadIdFromRolloutPath(value) {
  const text = String(value || "");
  const match = /rollout-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl/i.exec(text);
  return match ? match[1] : "";
}

function timestampToMs(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }
  if (/^\d+(?:\.\d+)?$/.test(String(value))) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function turnTimestampMs(params, field) {
  return timestampToMs((params && params.turn && params.turn[field]) || (params && params[field]));
}

function isOldPushTurnEvent(params, fields) {
  for (const field of fields) {
    const timestamp = turnTimestampMs(params, field);
    if (timestamp) return timestamp < PROCESS_STARTED_AT_MS - 120000;
  }
  return false;
}

function notificationUrlForThread(threadId) {
  const id = String(threadId || "");
  return id ? `/?thread=${encodeURIComponent(id)}` : "/";
}

function compactOneLine(value, maxChars = 80) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 3))}...`;
}

function shortIdentifier(value) {
  const text = String(value || "").trim();
  if (text.length <= 16) return text;
  return `${text.slice(0, 8)}...${text.slice(-4)}`;
}

function pushTimestamp(ms = Date.now()) {
  const time = Number.isFinite(ms) && ms > 0 ? ms : Date.now();
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(time)).replace(/\//g, "-");
  } catch (_) {
    return new Date(time).toISOString();
  }
}

function pushThreadId(params) {
  return String((params && params.threadId)
    || (params && params.conversationId)
    || (params && params.sessionId)
    || (params && params.thread_id)
    || (params && params.conversation_id)
    || (params && params.session_id)
    || (params && params.thread && params.thread.id)
    || (params && params.thread && params.thread.threadId)
    || (params && params.thread && params.thread.conversationId)
    || (params && params.thread && params.thread.sessionId)
    || (params && params.thread && params.thread.thread_id)
    || (params && params.thread && params.thread.conversation_id)
    || (params && params.thread && params.thread.session_id)
    || (params && params.turn && params.turn.threadId)
    || (params && params.turn && params.turn.conversationId)
    || (params && params.turn && params.turn.sessionId)
    || (params && params.turn && params.turn.thread_id)
    || (params && params.turn && params.turn.conversation_id)
    || (params && params.turn && params.turn.session_id)
    || (params && params.turn && params.turn.thread && params.turn.thread.id)
    || (params && params.turn && params.turn.thread && params.turn.thread.threadId)
    || (params && params.turn && params.turn.thread && params.turn.thread.conversationId)
    || (params && params.turn && params.turn.thread && params.turn.thread.sessionId)
    || (params && params.turn && params.turn.thread && params.turn.thread.thread_id)
    || (params && params.turn && params.turn.thread && params.turn.thread.conversation_id)
    || (params && params.turn && params.turn.thread && params.turn.thread.session_id)
    || threadIdFromRolloutPath(params && params.rolloutPath)
    || threadIdFromRolloutPath(params && params.rollout_path)
    || threadIdFromRolloutPath(params && params.thread && params.thread.rolloutPath)
    || threadIdFromRolloutPath(params && params.thread && params.thread.rollout_path)
    || threadIdFromRolloutPath(params && params.turn && params.turn.rolloutPath)
    || threadIdFromRolloutPath(params && params.turn && params.turn.rollout_path)
    || "");
}

function pushThreadSummary(threadId) {
  const id = String(threadId || "");
  return id ? (threadDisplaySummaryCache.read(id) || readStateDbThread(id) || readStartedThread(id) || null) : null;
}

function pushThreadTitle(params, threadId = "", existingTitle = "") {
  const id = String(threadId || pushThreadId(params) || "");
  const summary = pushThreadSummary(id);
  return resolveThreadTitleForNotification({
    params,
    threadId: id,
    existingTitle,
    summary,
    fallbackTitle: shortIdentifier(id) || "Codex Mobile Web",
  });
}

function pushThreadAgentMetadataFromParams(params) {
  const nickname = lastString(
    params && params.agentNickname,
    params && params.agent_nickname,
    params && params.thread && params.thread.agentNickname,
    params && params.thread && params.thread.agent_nickname,
    params && params.turn && params.turn.agentNickname,
    params && params.turn && params.turn.agent_nickname,
  );
  const role = lastString(
    params && params.agentRole,
    params && params.agent_role,
    params && params.thread && params.thread.agentRole,
    params && params.thread && params.thread.agent_role,
    params && params.turn && params.turn.agentRole,
    params && params.turn && params.turn.agent_role,
  );
  return {
    agentNickname: nickname,
    agentRole: role,
  };
}

function pushTurnMeta(params, existing = null) {
  const turnId = pushTurnId(params);
  const existingThreadId = String((existing && existing.threadId) || "");
  const paramsThreadId = pushThreadId(params);
  const threadId = existingThreadId || paramsThreadId;
  const existingTitle = existingThreadId && existingThreadId === threadId
    ? String((existing && existing.threadTitle) || "")
    : "";
  const agentMetadata = pushThreadAgentMetadataFromParams(params);
  return {
    turnId,
    threadId,
    threadTitle: pushThreadTitle(params, threadId, existingTitle),
    agentNickname: (existing && existing.agentNickname) || agentMetadata.agentNickname,
    agentRole: (existing && existing.agentRole) || agentMetadata.agentRole,
    observedAt: (existing && existing.observedAt) || Date.now(),
    startedAt: (existing && existing.startedAt) || turnTimestampMs(params, "startedAt") || turnTimestampMs(params, "createdAt") || 0,
    completedAt: turnTimestampMs(params, "completedAt") || turnTimestampMs(params, "updatedAt") || 0,
  };
}

function maybeRecordTurnTokenUsage(method, params) {
  if (method !== "turn/completed") return;
  const turnId = pushTurnId(params);
  if (!turnId || isOldPushTurnEvent(params, ["completedAt", "updatedAt"])) return;
  const threadId = pushThreadId(params);
  if (!threadId) return;
  const usageSummary = turnCompletionUsageSummary(threadId, turnId);
  if (!usageSummary) return;
  const threadSummary = pushThreadSummary(threadId) || readStateDbThread(threadId) || null;
  const result = tokenUsageStatsService.recordTurnUsage({
    threadId,
    turnId,
    cwd: threadSummary && threadSummary.cwd || "",
    workspaceCwds: tokenUsageWorkspaceCwds(),
    completedAtMs: turnTimestampMs(params, "completedAt") || turnTimestampMs(params, "updatedAt") || Date.now(),
    model: threadSummary && threadSummary.model || usageSummary.model || "",
    usageSummary,
    source: "turn_completed",
  });
  if (result && !result.ok && !result.skipped) {
    const err = result.error;
    console.error(`[token usage] record failed: ${err && err.message ? err.message : String(err)}`);
  }
}

function maybeAutoReplyThreadTaskCard(method, params) {
  if (method !== "turn/completed") return;
  const turnId = pushTurnId(params);
  if (!turnId || isOldPushTurnEvent(params, ["completedAt", "updatedAt"])) return;
  const threadId = pushThreadId(params);
  if (!threadId) return;
  const completedAtMs = turnTimestampMs(params, "completedAt") || turnTimestampMs(params, "updatedAt") || Date.now();
  threadTaskCardService.maybeAutoReplyCompletedTurn({
    threadId,
    turnId,
    completedAt: new Date(completedAtMs).toISOString(),
    finalReceiptText: finalReceiptTextFromParams(params),
  }).catch((err) => {
    console.error(`[thread task card] auto-return failed: ${err.message || String(err)}`);
  });
}

function maybeMaterializeThreadTaskCardDrafts(method, params) {
  if (method !== "turn/completed") return;
  const turnId = pushTurnId(params);
  if (!turnId || isOldPushTurnEvent(params, ["completedAt", "updatedAt"])) return;
  const threadId = pushThreadId(params);
  if (!threadId) return;
  const timer = setTimeout(async () => {
    try {
      const summary = pushThreadSummary(threadId) || readStateDbThread(threadId) || readStartedThread(threadId) || { id: threadId };
      const turnsResult = await codex.request("thread/turns/list", {
        threadId,
        limit: THREAD_TASK_CARD_DRAFT_TURN_LOOKBACK,
        sortDirection: "desc",
      }, { timeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS, retry: false, resetOnTimeout: false });
      const thread = threadFromTurnsList(threadId, summary, turnsResult);
      await materializeThreadTaskCardDraftsForThread(thread);
    } catch (err) {
      console.error(`[thread task card] server completion materialization failed thread=${shortIdentifier(threadId)} turn=${shortIdentifier(turnId)}: ${err.message || String(err)}`);
    }
  }, 0);
  if (timer && typeof timer.unref === "function") timer.unref();
}

function logWebPushDecision(event, decision, meta) {
  if (decision && decision.track && !decision.reason) return;
  const reason = String((decision && decision.reason) || "tracked");
  console.log(`[web push] ${event} ${reason} turn=${shortIdentifier(meta && meta.turnId)} thread=${shortIdentifier(meta && meta.threadId)}`);
}

function webPushFailureDetails(err) {
  const statusCode = Number(err && err.statusCode) || null;
  const body = String((err && err.body) || "").trim();
  let reason = "";
  if (body) {
    try {
      const parsed = JSON.parse(body);
      reason = String(parsed.reason || parsed.error || parsed.message || "").trim();
    } catch (_) {
      reason = body.slice(0, 160);
    }
  }
  return {
    statusCode,
    reason: reason || String((err && err.message) || err || "Web Push send failed"),
  };
}

async function sendWebPushToAll(payload) {
  loadPushVapidKeys();
  const subscriptions = loadPushSubscriptions();
  if (!subscriptions.length) return { sent: 0, failed: 0, removed: 0 };
  let sent = 0;
  let failed = 0;
  let lastError = null;
  const dead = new Set();
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webPush.sendNotification(subscription, JSON.stringify(payload), {
        TTL: PUSH_TTL_SECONDS,
        urgency: "normal",
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      lastError = webPushFailureDetails(err);
      const statusCode = Number(err && err.statusCode);
      if (statusCode === 404 || statusCode === 410) dead.add(subscription.endpoint);
      else console.error(`[web push] send failed: ${lastError.statusCode || ""} ${lastError.reason}`);
    }
  }));
  if (dead.size) {
    const kept = subscriptions.filter((subscription) => !dead.has(subscription.endpoint));
    savePushSubscriptions(kept);
  }
  return Object.assign({ sent, failed, removed: dead.size }, lastError ? { lastError } : {});
}

function delegateTurnCompletedNotification(meta, turnId, completedAt, threadTitle, params = null) {
  const workspaceId = "owner";
  if (!hermesNotificationDelegateService.isConfiguredForWorkspace(workspaceId)) return false;
  const threadId = String(meta && meta.threadId || "");
  const detailMessage = buildTurnCompletionDetailMessage({
    threadTitle,
    completedAt,
    turnId,
    params,
    turnUsageSummary: turnCompletionUsageSummary(threadId, turnId),
    maxChars: 12_000,
  });
  hermesNotificationDelegateService.send({
    workspaceId,
    eventId: `codex-mobile:turn-completed:${threadId || "unknown"}:${turnId}`,
    title: threadTitle || shortIdentifier(threadId || turnId) || "Codex Mobile Web",
    summary: `This turn 已结束 · ${pushTimestamp(completedAt)}`,
    itemType: "info",
    priority: "normal",
    route: {
      name: "thread",
      tab: "codex",
      itemId: threadId || turnId,
      threadId: threadId || "",
      taskId: turnId,
    },
    openMode: "plugin",
    detailMessage,
  }).catch((err) => {
    console.error(`[hermes plugin notifications] turn completed delegation failed: ${err.message || String(err)}`);
  });
  return true;
}

async function resolveCompletedPushThreadTitle(meta, params) {
  const threadId = String(meta && meta.threadId || pushThreadId(params) || "");
  if (threadId && !threadDisplaySummaryCache.read(threadId)) {
    try {
      await readThreadSummaryFromAppServer(codex, threadId);
    } catch (err) {
      console.error(`[web push] thread title app-server refresh failed: ${err.message || String(err)}`);
    }
  }
  return pushThreadTitle(params, threadId, meta && meta.threadTitle);
}

function sendTurnCompletedPush(meta, turnId, completedAt, params) {
  resolveCompletedPushThreadTitle(meta, params).then((threadTitle) => {
    if (delegateTurnCompletedNotification(meta, turnId, completedAt, threadTitle, params)) return;
    const threadMark = shortIdentifier(meta.threadId || turnId);
    const payload = {
      title: threadTitle || threadMark || "Codex Mobile Web",
      body: `This turn 已结束 · ${pushTimestamp(completedAt)}`,
      tag: `codex-turn-${meta.threadId || turnId}`,
      data: {
        url: notificationUrlForThread(meta.threadId),
        threadId: meta.threadId || "",
        turnId,
        threadTitle,
        completedAt,
      },
    };
    sendWebPushToAll(payload).catch((err) => {
      console.error(`[web push] turn completed send failed: ${err.message || String(err)}`);
    });
  }).catch((err) => {
    console.error(`[web push] turn completed notification failed: ${err.message || String(err)}`);
  });
}

function maybeSendTurnCompletedPush(method, params) {
  if (method === "turn/started") {
    const id = pushTurnId(params);
    if (isOldPushTurnEvent(params, ["startedAt", "createdAt"])) return;
    prunePushObservedTurns();
    if (id) {
      const meta = pushTurnMeta(params);
      const decision = shouldTrackTurnForWebPush(meta, {
        allowMissingThreadId: true,
        classifyThread: classifyWebPushThreadId,
      });
      logWebPushDecision("turn/started", decision, meta);
      if (decision.track) pushObservedTurns.set(id, meta);
      else pushObservedTurns.delete(id);
    }
    return;
  }
  if (method !== "turn/completed") return;
  const turnId = pushTurnId(params);
  if (!turnId || !pushObservedTurns.has(turnId)) return;
  if (isOldPushTurnEvent(params, ["completedAt", "updatedAt"])) return;
  const meta = pushTurnMeta(params, pushObservedTurns.get(turnId));
  pushObservedTurns.delete(turnId);
  if (completedTurnHasNoFinalAgentMessage(params)) {
    logWebPushDecision("turn/completed", { track: false, reason: "no-final-agent-message" }, meta);
    return;
  }
  const decision = shouldTrackTurnForWebPush(meta, {
    classifyThread: classifyWebPushThreadId,
  });
  if (!decision.track) {
    logWebPushDecision("turn/completed", decision, meta);
    return;
  }
  prunePushObservedTurns();
  prunePushSentTurns();
  const key = `${meta.threadId || ""}:${turnId}`;
  if (pushSentTurns.has(key)) return;
  pushSentTurns.set(key, Date.now());
  const completedAt = meta.completedAt || Date.now();
  sendTurnCompletedPush(meta, turnId, completedAt, params);
}

function multipartBoundary(contentType) {
  const match = /(?:^|;\s*)boundary=(?:"([^"]+)"|([^;]+))/i.exec(String(contentType || ""));
  return match ? String(match[1] || match[2] || "").trim() : "";
}

function parsePartHeaders(raw) {
  const headers = {};
  for (const line of String(raw || "").split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return headers;
}

function dispositionParam(disposition, name) {
  const quoted = new RegExp(`(?:^|;\\s*)${name}="([^"]*)"`, "i").exec(String(disposition || ""));
  if (quoted) return quoted[1];
  const bare = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`, "i").exec(String(disposition || ""));
  return bare ? bare[1].trim() : "";
}

function parseMultipartBody(buffer, contentType) {
  const boundary = multipartBoundary(contentType);
  if (!boundary) throw new Error("multipart boundary is missing");
  const boundaryBuffer = Buffer.from(`--${boundary}`, "utf8");
  const separator = Buffer.from("\r\n\r\n", "utf8");
  const fields = {};
  const files = [];
  let pos = buffer.indexOf(boundaryBuffer);
  while (pos >= 0) {
    pos += boundaryBuffer.length;
    if (buffer.slice(pos, pos + 2).toString("utf8") === "--") break;
    if (buffer.slice(pos, pos + 2).toString("utf8") === "\r\n") pos += 2;
    const next = buffer.indexOf(boundaryBuffer, pos);
    if (next < 0) break;
    let end = next;
    if (end >= 2 && buffer[end - 2] === 13 && buffer[end - 1] === 10) end -= 2;
    const part = buffer.slice(pos, end);
    const headerEnd = part.indexOf(separator);
    if (headerEnd >= 0) {
      const headers = parsePartHeaders(part.slice(0, headerEnd).toString("utf8"));
      const disposition = headers["content-disposition"] || "";
      const fieldName = dispositionParam(disposition, "name");
      const filename = dispositionParam(disposition, "filename");
      const content = part.slice(headerEnd + separator.length);
      if (fieldName) {
        if (filename) {
          files.push({
            fieldName,
            originalName: filename,
            mimeType: headers["content-type"] || "",
            buffer: content,
          });
        } else {
          fields[fieldName] = content.toString("utf8");
        }
      }
    }
    pos = next;
  }
  return { fields, files };
}

function sanitizeUploadName(name) {
  const base = path.basename(String(name || "upload").replace(/\\/g, "/"));
  const cleaned = base
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "upload").slice(0, 160);
}

function isImageUpload(file) {
  const mime = String(file.mimeType || "").toLowerCase();
  const ext = path.extname(file.originalName || "").toLowerCase();
  return mime.startsWith("image/") || IMAGE_EXTENSIONS.has(ext);
}

function saveUploadedFiles(threadId, files) {
  if (!files.length) return [];
  if (files.length > MAX_UPLOAD_FILES) throw new Error(`Too many attachments; max ${MAX_UPLOAD_FILES}`);
  const total = files.reduce((sum, file) => sum + file.buffer.length, 0);
  if (total > MAX_UPLOAD_BYTES) throw new Error(`Attachments are too large; max ${MAX_UPLOAD_BYTES} bytes`);
  const day = new Date().toISOString().slice(0, 10);
  const safeThreadId = sanitizeUploadName(threadId).slice(0, 72);
  const dir = path.join(UPLOAD_ROOT, day, safeThreadId || "thread");
  fs.mkdirSync(dir, { recursive: true });
  return files.map((file) => {
    const originalName = sanitizeUploadName(file.originalName);
    const diskName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${originalName}`;
    const diskPath = path.join(dir, diskName);
    fs.writeFileSync(diskPath, file.buffer, { mode: 0o600 });
    return {
      originalName,
      mimeType: file.mimeType || "application/octet-stream",
      size: file.buffer.length,
      path: diskPath,
      isImage: isImageUpload(file),
    };
  });
}

function formatUploadSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function appendAttachmentSummary(text, uploads) {
  if (!uploads.length) return text;
  const lines = uploads.map((file) => {
    const kind = file.isImage ? "image" : "file";
    return `- ${file.originalName} (${kind}, ${file.mimeType}, ${formatUploadSize(file.size)}): ${file.path}`;
  });
  return `${text ? `${text}\n\n` : ""}Uploaded attachments:\n${lines.join("\n")}`;
}

async function readMessageBody(req, threadId) {
  const contentType = String(req.headers["content-type"] || "");
  if (!/^multipart\/form-data\b/i.test(contentType)) {
    return { fields: await readBody(req), uploads: [] };
  }
  const raw = await readRawBody(req, MAX_UPLOAD_BYTES + 256 * 1024);
  const parsed = parseMultipartBody(raw, contentType);
  const uploads = saveUploadedFiles(threadId, parsed.files);
  return { fields: parsed.fields, uploads };
}

function buildTurnInput(text, uploads) {
  const input = [];
  const messageText = appendAttachmentSummary(text, uploads).trim();
  if (messageText) input.push({ type: "text", text: messageText, text_elements: [] });
  for (const file of localImageUploadsForContext(uploads, IMAGE_CONTEXT_POLICY)) {
    input.push({ type: "localImage", path: file.path });
  }
  return input;
}

function persistExtendedHistoryForUploads(uploads) {
  return shouldPersistExtendedHistoryForUploads(uploads, PERSIST_EXTENDED_HISTORY_POLICY);
}

function uploadDedupeFingerprint(file) {
  return {
    name: file.originalName || "",
    mimeType: file.mimeType || "",
    size: Number(file.size || 0),
    isImage: Boolean(file.isImage),
  };
}

function messageSubmissionKeys(threadId, body, text, uploads) {
  const explicit = String(body.clientSubmissionId || "").trim();
  const payload = {
    threadId,
    activeTurnId: String(body.activeTurnId || ""),
    cwd: String(body.cwd || ""),
    text: String(text || ""),
    uploads: uploads.map(uploadDedupeFingerprint),
  };
  const contentKey = `content:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
  return explicit ? [`client:${threadId}:${explicit}`] : [contentKey];
}

function pruneMessageSubmissions(now = Date.now()) {
  for (const [key, entry] of recentMessageSubmissions) {
    if (now - entry.startedAt > MESSAGE_DEDUPE_WINDOW_MS) recentMessageSubmissions.delete(key);
  }
  while (recentMessageSubmissions.size > MESSAGE_DEDUPE_MAX) {
    const firstKey = recentMessageSubmissions.keys().next().value;
    if (!firstKey) break;
    recentMessageSubmissions.delete(firstKey);
  }
}

function cleanupDuplicateUploads(uploads) {
  const root = path.resolve(UPLOAD_ROOT);
  for (const file of uploads || []) {
    try {
      const filePath = path.resolve(file.path || "");
      if (!filePath.startsWith(`${root}${path.sep}`)) continue;
      fs.unlinkSync(filePath);
    } catch (_) {}
  }
}

async function runMessageSubmissionOnce(keys, duplicateUploads, fn) {
  const now = Date.now();
  const keyList = Array.isArray(keys) ? keys.filter(Boolean) : [keys].filter(Boolean);
  pruneMessageSubmissions(now);
  for (const key of keyList) {
    const existing = recentMessageSubmissions.get(key);
    if (existing && now - existing.startedAt <= MESSAGE_DEDUPE_WINDOW_MS) {
      cleanupDuplicateUploads(duplicateUploads);
      return existing.promise;
    }
  }
  const entry = { startedAt: now, promise: null };
  entry.promise = Promise.resolve()
    .then(fn)
    .catch((err) => {
      for (const key of keyList) {
        if (recentMessageSubmissions.get(key) === entry) recentMessageSubmissions.delete(key);
      }
      throw err;
    });
  for (const key of keyList) recentMessageSubmissions.set(key, entry);
  try {
    return await entry.promise;
  } finally {
    pruneMessageSubmissions();
  }
}

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  if (FILE_PREVIEW_IMAGE_CONTENT_TYPES.has(ext)) return FILE_PREVIEW_IMAGE_CONTENT_TYPES.get(ext);
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".ico": "image/x-icon",
  }[ext] || "application/octet-stream";
}

function isPathInside(parent, child) {
  const parentPath = path.resolve(parent);
  const childPath = path.resolve(child);
  return childPath === parentPath || childPath.startsWith(parentPath + path.sep);
}

function serveUploadedFile(req, res) {
  const url = getUrl(req);
  const rawPath = url.searchParams.get("path") || "";
  const target = path.resolve(rawPath);
  if (!rawPath || !isPathInside(UPLOAD_ROOT, target)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.stat(target, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": mimeFor(target),
      "Cache-Control": "private, max-age=300",
      "Content-Length": stat.size,
      "Content-Disposition": `inline; filename="${path.basename(target).replace(/"/g, "_")}"`,
    });
    fs.createReadStream(target).pipe(res);
  });
}

function serveGeneratedImageFile(req, res) {
  const url = getUrl(req);
  let target;
  try {
    target = generatedImagePathForId(GENERATED_IMAGE_ROOT, url.searchParams.get("id") || "");
  } catch (err) {
    sendJson(res, err.statusCode || 400, { error: err.message || String(err) });
    return;
  }
  const contentType = imageContentTypeForPath(target, FILE_PREVIEW_IMAGE_CONTENT_TYPES);
  if (!contentType) {
    sendJson(res, 415, { error: "This generated image type is not supported" });
    return;
  }
  fs.stat(target, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    if (stat.size > FILE_PREVIEW_MEDIA_MAX_BYTES) {
      sendJson(res, 413, { error: `File is too large for mobile preview (${Math.round(FILE_PREVIEW_MEDIA_MAX_BYTES / 1024 / 1024)} MB limit)` });
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
      "Content-Length": stat.size,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": filePreviewContentDisposition(target),
    });
    fs.createReadStream(target).pipe(res);
  });
}

function serveStatic(req, res) {
  const url = getUrl(req);
  const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const target = path.normalize(path.join(PUBLIC_ROOT, rel));
  if (!target.startsWith(PUBLIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const headers = {
      "Content-Type": mimeFor(target),
      "Cache-Control": "no-cache",
    };
    if (target.endsWith(".html")) {
      headers["Content-Security-Policy"] = `frame-ancestors ${hermesPluginService.frameAncestorsHeader()}`;
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}

function broadcast(payload) {
  const compacted = compactNotification(payload);
  if (!compacted) return;
  const body = `data: ${JSON.stringify(compacted)}\n\n`;
  for (const [res, client] of [...clients.entries()]) {
    if (!shouldSendEventToClient(compacted, client)) continue;
    try {
      if (res.destroyed || res.writableEnded || !res.write(body)) {
        removeEventClient(res);
      }
    } catch (_) {
      removeEventClient(res);
    }
  }
}

function notificationThreadId(payload) {
  if (!payload || payload.type !== "notification" || !payload.params) return "";
  return String(payload.params.threadId || payload.params.conversationId || "");
}

function shouldSendEventToClient(payload, client = {}) {
  if (!payload || payload.type !== "notification") return true;
  if (payload.method === "account/rateLimits/updated") return false;
  if (payload.method === "thread/started"
    || payload.method === "thread/status/changed"
    || payload.method === "thread/name/updated"
    || payload.method === "thread/archived") {
    return true;
  }
  const threadId = notificationThreadId(payload);
  if (!threadId) return true;
  return Boolean(client.threadId) && client.threadId === threadId;
}

function removeEventClient(res) {
  const heartbeat = clientHeartbeats.get(res);
  if (heartbeat) clearInterval(heartbeat);
  clientHeartbeats.delete(res);
  clients.delete(res);
  try {
    if (!res.destroyed && !res.writableEnded) res.end();
  } catch (_) {}
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

class JsonLineConnection {
  constructor(socket) {
    this.socket = socket;
    this.readyState = 1;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.buffer = "";

    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      this.buffer += chunk;
      let index;
      while ((index = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, index).trim();
        this.buffer = this.buffer.slice(index + 1);
        if (line && this.onmessage) this.onmessage({ data: line });
      }
    });
    socket.on("error", (err) => {
      this.readyState = 3;
      if (this.onerror) this.onerror(err);
    });
    socket.on("close", () => {
      this.readyState = 3;
      if (this.onclose) this.onclose();
    });
  }

  send(data) {
    if (this.readyState !== 1) throw new Error("jsonl tcp connection is not open");
    this.socket.write(`${data}\n`);
  }

  close() {
    this.readyState = 3;
    this.socket.end();
  }
}

function parseTcpEndpoint(value, source) {
  if (!value) return null;
  let host = "127.0.0.1";
  let portText = value;
  if (value.includes(":")) {
    const parts = value.split(":");
    portText = parts.pop();
    host = parts.join(":") || host;
  }
  const port = Number(portText);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid ${source} tcp endpoint: ${value}`);
  }
  return { protocol: "jsonl-tcp", host, port, source, required: true };
}

function resolveExternalEndpoint() {
  if (EXTERNAL_APP_SERVER_WS) {
    return { protocol: "ws", url: EXTERNAL_APP_SERVER_WS, source: "CODEX_MOBILE_APP_SERVER_WS", required: true };
  }
  if (EXTERNAL_APP_SERVER_TCP) {
    return parseTcpEndpoint(EXTERNAL_APP_SERVER_TCP, "CODEX_MOBILE_APP_SERVER_TCP");
  }
  try {
    const raw = fs.readFileSync(MUX_ENDPOINT_FILE, "utf8");
    const endpoint = JSON.parse(raw);
    if (endpoint && endpoint.protocol === "jsonl-tcp" && endpoint.host && endpoint.port) {
      return {
        protocol: "jsonl-tcp",
        host: endpoint.host,
        port: Number(endpoint.port),
        source: MUX_ENDPOINT_FILE,
        capabilities: endpoint.capabilities || null,
        required: true,
      };
    }
    if (endpoint && endpoint.protocol === "ws" && endpoint.url) {
      return { protocol: "ws", url: endpoint.url, source: MUX_ENDPOINT_FILE, required: true };
    }
  } catch (_) {
    return null;
  }
  return null;
}

class CodexAppServerClient {
  constructor() {
    this.child = null;
    this.ws = null;
    this.port = 0;
    this.endpoint = null;
    this.transportKind = "none";
    this.nextId = 1;
    this.pending = new Map();
    this.serverRequests = new Map();
    this.connecting = null;
    this.info = null;
    this.ready = false;
    this.lastError = null;
    this.resetting = false;
    this.requireSharedAppServer = REQUIRE_SHARED_APP_SERVER;
  }

  async ensure() {
    if (this.ready && this.isTransportOpen()) return;
    if (this.connecting) return this.connecting;
    this.connecting = this.startAndConnect().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  isTransportOpen() {
    return this.ws && this.ws.readyState === 1;
  }

  async startAndConnect() {
    this.closeTransportOnly();
    const externalEndpoint = resolveExternalEndpoint();
    if (externalEndpoint) {
      this.requireSharedAppServer = true;
      try {
        await this.connectEndpoint(externalEndpoint);
        await this.initialize({ allowAlreadyInitialized: true });
        return;
      } catch (err) {
        this.closeTransportOnly();
        this.lastError = `shared app-server endpoint unavailable (${err.message})`;
        console.error(`[codex app-server] ${this.lastError}`);
        throw new Error(this.lastError);
      }
    }

    if (this.requireSharedAppServer) {
      this.lastError = `shared app-server endpoint unavailable (${MUX_ENDPOINT_FILE} not found)`;
      console.error(`[codex app-server] ${this.lastError}`);
      throw new Error(this.lastError);
    }

    await this.startManagedChild();
    await this.connectEndpoint({ protocol: "ws", url: `ws://127.0.0.1:${this.port}`, source: "managed child", required: true });
    await this.initialize();
  }

  async startManagedChild() {
    assertCommandAvailable(CODEX_EXE, "Codex executable");
    if (!this.child || this.child.exitCode !== null || this.child.signalCode !== null) {
      this.port = await getFreePort();
      const child = spawn(CODEX_EXE, ["app-server", "--listen", `ws://127.0.0.1:${this.port}`], {
        cwd: APP_ROOT,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.child = child;
      const started = new Promise((resolve, reject) => {
        const onError = (err) => {
          child.off("spawn", onSpawn);
          if (this.child === child) this.child = null;
          this.ready = false;
          this.lastError = `failed to start codex app-server (${err.message})`;
          broadcast({ type: "status", status: this.status() });
          reject(new Error(this.lastError));
        };
        const onSpawn = () => {
          child.off("error", onError);
          resolve();
        };
        child.once("error", onError);
        child.once("spawn", onSpawn);
      });
      child.stderr.on("data", (chunk) => this.handleAppServerLog(chunk));
      child.stdout.on("data", (chunk) => this.handleAppServerLog(chunk));
      child.on("exit", (code, signal) => {
        if (this.child !== child) return;
        this.ready = false;
        this.lastError = `codex app-server exited (${code ?? signal ?? "unknown"})`;
        broadcast({ type: "status", status: this.status() });
      });
      await started;
    }
  }

  async initialize(options = {}) {
    try {
      this.info = await this.sendRpc("initialize", {
        clientInfo: {
          name: "codex-mobile-web",
          title: "Codex Mobile Web",
          version: "0.1.0",
          replayNotificationLimit: MUX_REPLAY_NOTIFICATION_LIMIT,
        },
        capabilities: { experimentalApi: true },
      }, READ_RPC_TIMEOUT_MS);
    } catch (err) {
      if (!options.allowAlreadyInitialized || !/already initialized/i.test(err.message || "")) {
        throw err;
      }
      this.info = { userAgent: "shared app-server (already initialized)" };
    }
    this.ready = true;
    this.lastError = null;
    broadcast({ type: "status", status: this.status() });
  }

  closeTransportOnly() {
    if (!this.ws) return;
    try {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
    } catch (_) {}
    this.ws = null;
  }

  handleAppServerLog(chunk) {
    const text = String(chunk || "").trim();
    if (!text) return;
    if (/listening on:|readyz:|healthz:/.test(text)) return;
    console.error(`[codex app-server] ${text.slice(0, 1200)}`);
  }

  async connectEndpoint(endpoint) {
    const deadline = Date.now() + 15000;
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        if (endpoint.protocol === "jsonl-tcp") return await this.connectJsonLineTcpOnce(endpoint);
        if (endpoint.protocol === "ws") return await this.connectWebSocketOnce(endpoint.url);
        throw new Error(`unsupported app-server endpoint protocol: ${endpoint.protocol}`);
      } catch (err) {
        lastError = err;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    throw lastError || new Error("failed to connect to codex app-server endpoint");
  }

  connectWebSocketOnce(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => reject(new Error("codex app-server websocket timeout")), 2500);
      ws.onopen = () => {
        clearTimeout(timer);
        this.ws = ws;
        this.endpoint = { protocol: "ws", url };
        this.transportKind = url.includes(`127.0.0.1:${this.port}`) ? "managed-ws-child" : "external-ws";
        ws.onmessage = (event) => this.handleMessage(event.data);
        ws.onclose = () => {
          const wasShared = this.transportKind === "external-ws";
          this.ready = false;
          this.lastError = wasShared ? "shared app-server connection closed" : "codex app-server connection closed";
          this.failPending(new Error(this.lastError));
          broadcast({ type: "status", status: this.status() });
        };
        ws.onerror = () => {
          this.ready = false;
        };
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error("failed to connect to codex app-server websocket"));
      };
    });
  }

  connectJsonLineTcpOnce(endpoint) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: endpoint.host, port: endpoint.port });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error("codex app-server jsonl tcp timeout"));
      }, 2500);
      socket.once("connect", () => {
        clearTimeout(timer);
        const connection = new JsonLineConnection(socket);
        this.ws = connection;
        this.endpoint = endpoint;
        this.transportKind = "external-jsonl-tcp";
        this.requireSharedAppServer = true;
        connection.onmessage = (event) => this.handleMessage(event.data);
        connection.onclose = () => {
          this.ready = false;
          this.lastError = "shared app-server connection closed";
          this.failPending(new Error(this.lastError));
          broadcast({ type: "status", status: this.status() });
        };
        connection.onerror = () => {
          this.ready = false;
        };
        resolve();
      });
      socket.once("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  handleMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch (_) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(msg, "id") && msg.method) {
      this.handleServerRequest(msg);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(msg, "id") && this.pending.has(msg.id)) {
      const { resolve, reject, timer } = this.pending.get(msg.id);
      clearTimeout(timer);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    if (msg.method) {
      if (msg.method === "account/rateLimits/updated" && msg.params && msg.params.rateLimits) {
        recordRateLimits(msg.params.rateLimits);
      }
      if (msg.method === "serverRequest/resolved" && msg.params && msg.params.requestId != null) {
        this.markServerRequestResolved(msg.params.requestId, "resolved");
      }
      maybeRecordTurnTokenUsage(msg.method, msg.params || null);
      maybeMaterializeThreadTaskCardDrafts(msg.method, msg.params || null);
      maybeAutoReplyThreadTaskCard(msg.method, msg.params || null);
      maybeSendTurnCompletedPush(msg.method, msg.params || null);
      broadcast({ type: "notification", method: msg.method, params: msg.params || null });
    }
  }

  handleServerRequest(msg) {
    if (!SERVER_REQUEST_METHODS.has(msg.method)) {
      broadcast({ type: "notification", method: msg.method, params: msg.params || null });
      return;
    }
    const key = String(msg.id);
    const request = {
      id: msg.id,
      method: msg.method,
      params: msg.params || {},
      status: "waiting",
      receivedAt: Date.now(),
      decision: null,
      respondedAt: null,
    };
    this.serverRequests.set(key, request);
    broadcast({ type: "serverRequest", request: publicServerRequest(request) });
  }

  markServerRequestResolved(requestId, status = "resolved") {
    const key = String(requestId);
    const request = this.serverRequests.get(key);
    if (request) {
      request.status = status;
      request.respondedAt = request.respondedAt || Date.now();
      broadcast({ type: "serverRequestResolved", requestId: key, request: publicServerRequest(request) });
      setTimeout(() => this.serverRequests.delete(key), 15000).unref();
      return;
    }
    broadcast({ type: "serverRequestResolved", requestId: key, status });
  }

  pendingServerRequests() {
    return [...this.serverRequests.values()]
      .filter((request) => SERVER_REQUEST_METHODS.has(request.method))
      .map(publicServerRequest);
  }

  sendServerRequestResponse(request, payload) {
    if (!this.isTransportOpen()) {
      throw new Error("codex app-server connection is not open");
    }
    const message = Object.assign({ jsonrpc: "2.0", id: request.id }, payload);
    this.ws.send(JSON.stringify(message));
  }

  answerServerRequest(requestId, responseBody = {}) {
    const key = String(requestId);
    const request = this.serverRequests.get(key);
    if (!request) throw new Error("Approval request is no longer pending");
    if (request.status !== "waiting") throw new Error("Approval request has already been answered");
    const body = responseBody && typeof responseBody === "object" ? responseBody : { decision: String(responseBody || "") };
    const payload = serverRequestResponsePayload(request, body);
    this.sendServerRequestResponse(request, payload);
    request.status = "responded";
    request.decision = body.decision || body.action || "submitted";
    request.respondedAt = Date.now();
    broadcast({ type: "serverRequestResolved", requestId: key, request: publicServerRequest(request) });
    setTimeout(() => this.serverRequests.delete(key), 15000).unref();
    return publicServerRequest(request);
  }

  failPending(err) {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(err);
    }
    this.pending.clear();
    for (const request of this.serverRequests.values()) {
      request.status = "connectionClosed";
      request.respondedAt = Date.now();
      broadcast({ type: "serverRequestResolved", requestId: String(request.id), request: publicServerRequest(request) });
    }
    this.serverRequests.clear();
  }

  resetConnection(reason) {
    if (this.resetting) return;
    this.resetting = true;
    this.ready = false;
    this.lastError = reason;
    console.error(`[codex app-server] resetting connection: ${reason}`);
    this.closeTransportOnly();
    if (this.transportKind === "managed-ws-child" || this.child) {
      const child = this.child;
      this.child = null;
      this.port = 0;
      try {
        if (child && child.exitCode === null && child.signalCode === null) child.kill();
      } catch (_) {}
    }
    this.info = null;
    this.failPending(new Error(reason));
    broadcast({ type: "status", status: this.status() });
    setTimeout(() => {
      this.resetting = false;
    }, 250).unref();
  }

  sendRpc(method, params, timeoutMs = DEFAULT_RPC_TIMEOUT_MS, options = {}) {
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    if (!this.isTransportOpen()) {
      return Promise.reject(new Error("codex app-server connection is not open"));
    }
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        const err = new Error(`Codex request timed out: ${method}`);
        err.code = "RPC_TIMEOUT";
        reject(err);
        if (options.resetOnTimeout !== false) this.resetConnection(err.message);
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
  }

  sendNotification(method, params) {
    if (!this.isTransportOpen()) return false;
    this.ws.send(JSON.stringify({ jsonrpc: "2.0", method, params }));
    return true;
  }

  isMuxEndpoint() {
    return this.transportKind === "external-jsonl-tcp"
      && this.endpoint
      && normalizeFsPath(this.endpoint.source) === normalizeFsPath(MUX_ENDPOINT_FILE);
  }

  supportsMuxUserMessageEcho() {
    return this.isMuxEndpoint()
      && this.endpoint.capabilities
      && this.endpoint.capabilities.mobileUserMessageEcho === true;
  }

  notifyMuxUserMessage(params) {
    if (!this.supportsMuxUserMessageEcho()) return false;
    return this.sendNotification("mux/userMessage", params);
  }

  async request(method, params, options = {}) {
    const timeoutMs = options.timeoutMs || (SAFE_RETRY_METHODS.has(method) ? READ_RPC_TIMEOUT_MS : DEFAULT_RPC_TIMEOUT_MS);
    const retry = options.retry !== false && SAFE_RETRY_METHODS.has(method);
    await this.ensure();
    try {
      return await this.sendRpc(method, params, timeoutMs, options);
    } catch (err) {
      const recoverable = /timed out|connection is not open|connection closed/i.test(err.message || "");
      if (!retry || !recoverable) throw err;
      await this.ensure();
      return this.sendRpc(method, params, timeoutMs, options);
    }
  }

  status() {
    return {
      ready: this.ready,
      port: this.port || null,
      transport: this.transportKind,
      endpoint: this.endpoint ? {
        protocol: this.endpoint.protocol,
        source: this.endpoint.source || null,
        host: this.endpoint.host || null,
        port: this.endpoint.port || null,
        url: this.endpoint.url || null,
        capabilities: this.endpoint.capabilities || null,
      } : null,
      muxEndpointFile: MUX_ENDPOINT_FILE,
      codexExe: CODEX_EXE,
      codexHome: CODEX_HOME,
      runtimeRoot: RUNTIME_ROOT,
      userAgent: this.info ? this.info.userAgent : null,
      lastError: this.lastError,
      sharedRequired: this.requireSharedAppServer,
      rateLimits: activeRateLimits(),
      rateLimitsByModel: rateLimitsByModelObject(),
      codexProfiles: codexProfileService.profiles({
        activeQuota: { rateLimits: activeRateLimits(), rateLimitsByModel: rateLimitsByModelObject() },
      }),
    };
  }
}

const codex = new CodexAppServerClient();

function readGlobalState() {
  const p = path.join(CODEX_HOME, ".codex-global-state.json");
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (_) {
    return {};
  }
}

function rowToFallbackThread(row) {
  const updatedAt = Number(row.updated_at || row.updatedAt || 0);
  const name = row.title || row.thread_name || null;
  const preview = row.first_user_message || row.preview || name || row.id;
  return attachThreadTaskCardCountsToSummary(annotateThreadRolloutStats({
    id: row.id,
    name,
    preview,
    cwd: typeof row.cwd === "string" ? row.cwd.replace(/^\\\\\?\\/, "") : null,
    path: row.path || row.rollout_path || row.rolloutPath || null,
    updatedAt,
    archived: Boolean(Number(row.archived || 0)),
    archivedAt: row.archived_at || null,
    status: { type: "notLoaded" },
    model: row.model || null,
    effort: row.reasoning_effort || null,
    agentNickname: row.agent_nickname || null,
    agentRole: row.agent_role || null,
    isSpawnedChildThread: Boolean(Number(row.is_spawned_child || 0)),
    sandboxPolicy: row.sandbox_policy || null,
    approvalPolicy: row.approval_mode || null,
    mobileFallback: true,
  }));
}

function sqlString(value) {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}

function agentInstructionFilesForCwd(cwd) {
  const files = [];
  if (!cwd || typeof cwd !== "string") return files;
  let current = path.resolve(cwd);
  for (;;) {
    const candidate = path.join(current, "AGENTS.md");
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) files.push(candidate);
    } catch (_) {}
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return files.reverse();
}

function readStartThreadDeveloperInstructions(cwd) {
  const chunks = [];
  let remaining = MAX_START_THREAD_DEVELOPER_INSTRUCTIONS_CHARS;
  for (const file of agentInstructionFilesForCwd(cwd)) {
    if (remaining <= 0) break;
    try {
      const text = fs.readFileSync(file, "utf8");
      const header = `# Instructions from ${file}\n\n`;
      const body = text.slice(0, Math.max(0, remaining - header.length));
      if (body.trim()) {
        chunks.push(`${header}${body}`);
        remaining -= header.length + body.length;
      }
    } catch (_) {}
  }
  return chunks.join("\n\n").trim() || null;
}

function threadIdFromStartResult(result) {
  return String((result && result.thread && result.thread.id)
    || (result && result.data && result.data.thread && result.data.thread.id)
    || (result && result.threadId)
    || (result && result.id)
    || "");
}

function shortThreadTitle(value, fallback = "Codex Mobile") {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+(?:续\s*)?\d{2}-\d{2}(?:\s+\d{2}:\d{2})?$/u, "");
  return (text || fallback).slice(0, 72);
}

function localTitleDate(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

function newThreadTitle({ cwd, sourceThreadTitle }) {
  const base = shortThreadTitle(sourceThreadTitle, path.basename(String(cwd || "").replace(/^\\\\\?\\/, "")) || "Codex Mobile");
  return `${base} ${localTitleDate()}`;
}

function formatByteCount(bytes) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const precision = unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

function readWorkspaceContextFile(cwd, relativePath, maxChars) {
  const workspace = String(cwd || "").trim();
  const file = workspace ? path.join(workspace, ...String(relativePath || "").split(/[\\/]+/).filter(Boolean)) : "";
  if (!file) {
    return { relativePath, path: "", exists: false, text: "", error: "Workspace path is empty" };
  }
  try {
    const text = fs.readFileSync(file, "utf8");
    return {
      relativePath,
      path: file,
      exists: true,
      text: truncateMiddle(text, maxChars, relativePath),
    };
  } catch (err) {
    return {
      relativePath,
      path: file,
      exists: false,
      text: "",
      error: err && err.code === "ENOENT" ? "missing" : (err.message || String(err)),
    };
  }
}

function continuationWorkspaceContextSections(cwd) {
  const project = readWorkspaceContextFile(cwd, ".agent-context/PROJECT_CONTEXT.md", CONTINUATION_WORKSPACE_PROJECT_CONTEXT_CHARS);
  const handoff = readWorkspaceContextFile(cwd, ".agent-context/HANDOFF.md", CONTINUATION_WORKSPACE_HANDOFF_TAIL_CHARS * 2);
  const sections = [];
  if (project.exists) {
    sections.push(`### .agent-context/PROJECT_CONTEXT.md\n${project.text}`);
  } else {
    sections.push(`### .agent-context/PROJECT_CONTEXT.md\nUnavailable: ${project.error || "missing"} (${project.path})`);
  }
  if (handoff.exists) {
    sections.push(`### .agent-context/HANDOFF.md latest tail\n${truncateTail(handoff.text, CONTINUATION_WORKSPACE_HANDOFF_TAIL_CHARS, ".agent-context/HANDOFF.md")}`);
  } else {
    sections.push(`### .agent-context/HANDOFF.md\nUnavailable: ${handoff.error || "missing"} (${handoff.path})`);
  }
  return sections.join("\n\n");
}

function continuationContentPartText(part) {
  if (part == null) return "";
  if (typeof part === "string") return part;
  if (typeof part !== "object") return String(part);
  const type = String(part.type || "");
  if (typeof part.text === "string") return part.text;
  if (typeof part.path === "string") return `[${type || "file"}: ${part.path}]`;
  if (typeof part.url === "string" && /^data:image\//i.test(part.url)) return `[${type || "image"}: inline image omitted]`;
  if (typeof part.url === "string") return `[${type || "url"}: ${part.url}]`;
  if (typeof part.image_url === "string") return `[${type || "image"}: ${part.image_url}]`;
  return truncateMiddle(JSON.stringify(compactStructured(part)), 1200, "input part");
}

function continuationItemText(item) {
  if (!item || typeof item !== "object") return "";
  if (typeof item.text === "string") return item.text;
  if (Array.isArray(item.content)) {
    return item.content.map(continuationContentPartText).filter(Boolean).join("\n");
  }
  if (Array.isArray(item.summary) && item.summary.length) return item.summary.join("\n");
  if (typeof item.mobileNotice === "string") return item.mobileNotice;
  if (item.command) return item.command;
  if (Array.isArray(item.fileNames) && item.fileNames.length) return item.fileNames.join(", ");
  if (item.tool) return item.tool;
  return "";
}

function continuationItemLabel(item) {
  if (!item || typeof item !== "object") return "item";
  if (item.type === "userMessage") return "User";
  if (item.type === "agentMessage") return "Codex";
  if (item.type === "plan") return "Plan";
  if (isContextCompactionType(item.type)) return "Context compaction";
  if (isWebSearchLikeItem(item)) return "Web Search";
  if (item.type === "commandExecution") return "Command";
  if (item.type === "fileChange") return "File change";
  if (item.type === "dynamicToolCall" || item.type === "mcpToolCall") return `Tool ${item.tool || item.name || ""}`.trim();
  return item.type || "item";
}

function continuationItemSummary(item) {
  if (!item || item.type === "reasoning") return "";
  const label = continuationItemLabel(item);
  const status = statusText(item.status);
  let text = continuationItemText(item);
  if (!text && (isOperationalItem(item) || item.result || item.arguments || item.contentItems)) {
    text = JSON.stringify(compactStructured({
      command: item.command || undefined,
      arguments: item.arguments || undefined,
      result: item.result || item.contentItems || undefined,
      fileNames: item.fileNames || undefined,
    }));
  }
  text = truncateMiddle(String(text || "").replace(/\r\n/g, "\n").trim(), CONTINUATION_ITEM_SUMMARY_CHARS, `${label} item`);
  return `- ${label}${status ? ` [${status}]` : ""}: ${text || "(no visible text)"}`;
}

function continuationTurnSummaries(turns) {
  if (!Array.isArray(turns) || !turns.length) return "No recent source turns were available from thread/turns/list.";
  return turns.map((turn, index) => {
    const items = Array.isArray(turn && turn.items) ? turn.items.filter((item) => item && item.type !== "reasoning") : [];
    const userItems = items.filter((item) => item.type === "userMessage");
    const otherItems = items.filter((item) => item.type !== "userMessage");
    const selected = userItems.concat(otherItems.slice(-CONTINUATION_TURN_SUMMARY_ITEMS));
    const omitted = Math.max(0, items.length - selected.length);
    const itemLines = selected.map(continuationItemSummary).filter(Boolean);
    if (omitted > 0) itemLines.unshift(`- ${omitted} older visible item(s) omitted from this turn summary.`);
    const title = `### Recent turn ${index + 1}: ${turn.id || "(no id)"}${statusText(turn.status) ? ` / ${statusText(turn.status)}` : ""}`;
    return `${title}\n${itemLines.length ? itemLines.join("\n") : "- No visible non-reasoning items."}`;
  }).join("\n\n");
}

function continuationSourceThreadSection(snapshot) {
  const summary = snapshot && snapshot.summary;
  const stats = summary ? rolloutStatsForPath(rolloutPathForThread(summary)) : null;
  const lines = [
    `- Source thread id: ${snapshot && snapshot.threadId ? snapshot.threadId : "(none supplied)"}`,
    `- Source thread title: ${(summary && (summary.name || summary.preview)) || (snapshot && snapshot.title) || "(unknown)"}`,
    `- Source cwd: ${(summary && summary.cwd) || "(unknown)"}`,
    `- Source rollout path: ${summary ? (rolloutPathForThread(summary) || "(unknown)") : "(unknown)"}`,
    `- Source rollout size: ${stats ? `${formatByteCount(stats.sizeBytes)} (${stats.sizeBytes} bytes)` : "(unknown)"}`,
    `- Source status: ${summary ? (statusText(summary.status) || "(unknown)") : "(unknown)"}`,
    `- Source updatedAt: ${summary && summary.updatedAt ? summary.updatedAt : "(unknown)"}`,
  ];
  if (snapshot && snapshot.readWarnings && snapshot.readWarnings.length) {
    lines.push(`- Source read warnings: ${snapshot.readWarnings.join("; ")}`);
  }
  return lines.join("\n");
}

async function continuationSourceSnapshot(sourceThreadId, sourceThreadTitle, visibility) {
  const threadId = String(sourceThreadId || "").trim();
  const snapshot = {
    threadId,
    title: String(sourceThreadTitle || "").trim(),
    summary: null,
    runtimeSettings: null,
    turns: [],
    readWarnings: [],
  };
  if (!threadId) return snapshot;
  let summary = readStateDbThread(threadId) || readStartedThread(threadId);
  if (!summary) {
    try {
      summary = await readThreadSummaryFromAppServer(codex, threadId);
    } catch (err) {
      snapshot.readWarnings.push(`thread/list summary failed: ${err.message || String(err)}`);
    }
  }
  if (summary && isHiddenThread(summary, visibility)) {
    snapshot.readWarnings.push("source thread is hidden, archived, deleted, or outside visible workspaces");
  } else if (summary) {
    snapshot.summary = annotateThreadRolloutStats(summary);
    snapshot.runtimeSettings = threadRuntimeSettings(threadId, snapshot.summary);
  }
  if (snapshot.summary && shouldSkipThreadDetailRpc(snapshot.summary)) {
    snapshot.readWarnings.push(threadDetailTooLargeWarning(snapshot.summary));
    return snapshot;
  }
  try {
    const turnsResult = await codex.request("thread/turns/list", {
      threadId,
      limit: CONTINUATION_RECENT_TURNS,
      sortDirection: "desc",
    }, { timeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS, retry: false, resetOnTimeout: false });
    const data = Array.isArray(turnsResult && turnsResult.data)
      ? turnsResult.data
      : Array.isArray(turnsResult && turnsResult.turns)
        ? turnsResult.turns
        : [];
    snapshot.turns = sortTurnsChronologically(data).slice(-CONTINUATION_RECENT_TURNS).map((turn) => compactTurn(turn));
  } catch (err) {
    snapshot.readWarnings.push(`thread/turns/list failed: ${err.message || String(err)}`);
  }
  return snapshot;
}

function newThreadBootstrapInput(params) {
  return [{ type: "text", text: newThreadBootstrapPromptScoped(params), text_elements: [] }];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function continuationSafeFilePart(value, fallback = "thread") {
  return (String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)) || fallback;
}

function ensureContinuationHandoffIgnore(target) {
  if (!target || !target.dir) return;
  fs.mkdirSync(target.dir, { recursive: true });
  const ignoreFile = path.join(target.dir, ".gitignore");
  const block = [
    "# Codex Mobile Web runtime handoff files.",
    "# Keep generated continuation handoffs out of commits.",
    "*",
    "!.gitignore",
    "",
  ].join("\n");
  try {
    const existing = fs.existsSync(ignoreFile) ? fs.readFileSync(ignoreFile, "utf8") : "";
    if (existing.includes("Codex Mobile Web runtime handoff files")
      || /^\s*\*\s*$/m.test(existing)) {
      return;
    }
    fs.writeFileSync(ignoreFile, existing.trimEnd() ? `${existing.trimEnd()}\n\n${block}` : block, "utf8");
  } catch (err) {
    logContinuation("handoff-ignore-failed", { dir: target.dir, error: err.message || String(err) });
  }
}

function continuationLineageIndexPath(cwd) {
  return path.join(cwd || "", ".agent-context", "thread-handoffs", "index.jsonl");
}

function normalizeContinuationLineageEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const newThreadId = String(entry.newThreadId || "").trim();
  const sourceThreadId = String(entry.sourceThreadId || "").trim();
  if (!newThreadId || !sourceThreadId) return null;
  return {
    version: Number(entry.version || 1),
    createdAt: String(entry.createdAt || new Date().toISOString()),
    workspace: String(entry.workspace || ""),
    newThreadId,
    newThreadTitle: String(entry.newThreadTitle || ""),
    sourceThreadId,
    sourceThreadTitle: String(entry.sourceThreadTitle || ""),
    sourceRolloutPath: String(entry.sourceRolloutPath || ""),
    sourceRolloutSizeBytes: Number(entry.sourceRolloutSizeBytes || 0),
    handoffFile: String(entry.handoffFile || ""),
    handoffRelativePath: String(entry.handoffRelativePath || ""),
    handoffId: String(entry.handoffId || ""),
    handoffChars: Number(entry.handoffChars || 0),
    sourceArchived: Boolean(entry.sourceArchived),
    sourceArchiveError: String(entry.sourceArchiveError || ""),
  };
}

function readContinuationLineageEntries(cwd) {
  if (!cwd) return [];
  const indexPath = continuationLineageIndexPath(cwd);
  let text = "";
  try {
    text = fs.readFileSync(indexPath, "utf8");
  } catch (_) {
    return [];
  }
  return text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return normalizeContinuationLineageEntry(JSON.parse(line));
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

function appendContinuationLineageEntry(cwd, entry) {
  const normalized = normalizeContinuationLineageEntry(Object.assign({
    version: 1,
    createdAt: new Date().toISOString(),
    workspace: cwd || "",
  }, entry || {}));
  if (!cwd || !normalized) return null;
  const indexPath = continuationLineageIndexPath(cwd);
  const target = { dir: path.dirname(indexPath) };
  try {
    fs.mkdirSync(target.dir, { recursive: true });
    ensureContinuationHandoffIgnore(target);
    fs.appendFileSync(indexPath, `${JSON.stringify(normalized)}\n`, "utf8");
    logContinuation("lineage-written", {
      newThreadId: normalized.newThreadId,
      sourceThreadId: normalized.sourceThreadId,
      handoffFile: normalized.handoffFile,
    });
    return normalized;
  } catch (err) {
    logContinuation("lineage-write-failed", {
      newThreadId: normalized.newThreadId,
      sourceThreadId: normalized.sourceThreadId,
      error: err.message || String(err),
    });
    return null;
  }
}

function buildContinuationLineageChain(cwd, sourceThreadId, maxDepth = CONTINUATION_LINEAGE_MAX_DEPTH) {
  const entries = readContinuationLineageEntries(cwd);
  if (!entries.length || !sourceThreadId || maxDepth <= 0) return [];
  const byNewThreadId = new Map();
  for (const entry of entries) byNewThreadId.set(entry.newThreadId, entry);
  const chain = [];
  const seen = new Set();
  let currentThreadId = String(sourceThreadId || "").trim();
  while (currentThreadId && chain.length < maxDepth && !seen.has(currentThreadId)) {
    seen.add(currentThreadId);
    const entry = byNewThreadId.get(currentThreadId);
    if (!entry) break;
    chain.push(entry);
    currentThreadId = entry.sourceThreadId;
  }
  return chain;
}

function continuationLineageHandoffExcerpt(entry, maxChars) {
  const file = entry && entry.handoffFile ? entry.handoffFile : "";
  if (!file) return "(no handoff file path recorded)";
  try {
    return truncateMiddle(fs.readFileSync(file, "utf8"), maxChars, "lineage handoff");
  } catch (err) {
    return `(handoff file unavailable: ${err.message || String(err)})`;
  }
}

function continuationLineageSection(cwd, sourceThreadId) {
  const chain = buildContinuationLineageChain(cwd, sourceThreadId);
  if (!chain.length) {
    return [
      "## 续接 lineage",
      "No prior continuation lineage was found for the source thread.",
    ].join("\n");
  }
  const perHandoffChars = Math.max(1000, Math.floor(CONTINUATION_LINEAGE_MAX_CHARS / Math.max(2, chain.length + 1)));
  const lines = [
    "## 续接 lineage",
    "本线程的源线程本身来自以下压缩续接链。这里是 Agent 可见的历史交接索引，不是隐藏后端状态。",
    "如果用户的问题涉及续接前的事实、已完成工作、未完成事项、风险、PR 状态或架构判断，先读取 lineage 指向的 handoff 文件，不要凭当前上下文猜。",
    "优先级：当前源线程交接文件 > 当前工作区持久上下文 > 下方 lineage handoff 摘要。只有 handoff 不够时，才说明原因并考虑读取旧 rollout 或归档线程。",
    "",
  ];
  chain.forEach((entry, index) => {
    lines.push(
      `### Lineage ${index + 1}`,
      `- Continuation thread id: ${entry.newThreadId}`,
      `- Continuation title: ${entry.newThreadTitle || "(unknown)"}`,
      `- Continued from source thread id: ${entry.sourceThreadId}`,
      `- Source title: ${entry.sourceThreadTitle || "(unknown)"}`,
      `- Handoff file: ${entry.handoffFile || entry.handoffRelativePath || "(unknown)"}`,
      `- Handoff id: ${entry.handoffId || "(unknown)"}`,
      `- Handoff chars: ${entry.handoffChars || 0}`,
      `- Created at: ${entry.createdAt || "(unknown)"}`,
      `- Source archived: ${entry.sourceArchived ? "yes" : "no"}${entry.sourceArchiveError ? ` (${entry.sourceArchiveError})` : ""}`,
      "",
      "#### Handoff excerpt",
      continuationLineageHandoffExcerpt(entry, perHandoffChars),
      "",
    );
  });
  return truncateMiddle(lines.join("\n"), CONTINUATION_LINEAGE_MAX_CHARS, "continuation lineage");
}

function continuationHandoffTarget(cwd, sourceThreadId) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const threadPart = continuationSafeFilePart(sourceThreadId);
  const id = `${stamp}-${threadPart}-${crypto.randomBytes(4).toString("hex")}`;
  const relativePath = path.join(".agent-context", "thread-handoffs", `${id}.md`);
  const file = path.join(cwd, relativePath);
  return { id, relativePath, file, dir: path.dirname(file) };
}

function continuationHandoffFromText(target, text, extra = {}) {
  const trimmed = String(text || "").trim();
  if (trimmed.length < CONTINUATION_HANDOFF_MIN_CHARS) return null;
  const marker = trimmed.match(/^Continuation handoff marker:\s*(.+)$/m);
  return Object.assign({
    id: marker && marker[1] ? marker[1].trim() : target.id,
    path: target.file,
    relativePath: target.relativePath,
    text: truncateMiddle(trimmed, CONTINUATION_SOURCE_HANDOFF_STORED_CHARS, "source continuation handoff"),
    chars: trimmed.length,
  }, extra);
}

function findRecentContinuationHandoff(cwd, sourceThreadId) {
  if (!CONTINUATION_REUSE_HANDOFF_MS || !cwd || !sourceThreadId) return null;
  const dir = path.join(cwd, ".agent-context", "thread-handoffs");
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => {
        const file = path.join(dir, entry.name);
        const stat = fs.statSync(file);
        return { name: entry.name, file, stat };
      })
      .filter((entry) => Date.now() - entry.stat.mtimeMs <= CONTINUATION_REUSE_HANDOFF_MS)
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  } catch (_) {
    return null;
  }
  for (const entry of entries) {
    let text = "";
    try {
      text = fs.readFileSync(entry.file, "utf8");
    } catch (_) {
      continue;
    }
    if (!text.includes(`Source thread id: ${sourceThreadId}`)) continue;
    const relativePath = path.relative(cwd, entry.file);
    const handoff = continuationHandoffFromText({
      id: path.basename(entry.name, ".md"),
      file: entry.file,
      relativePath,
    }, text, {
      reused: true,
      mtimeMs: entry.stat.mtimeMs,
    });
    if (handoff) return handoff;
  }
  return null;
}

function turnIdFromResult(result) {
  return String((result && result.turn && result.turn.id)
    || (result && result.data && result.data.turn && result.data.turn.id)
    || (result && result.turnId)
    || (result && result.id)
    || "");
}

function sourceContinuationHandoffPrompt({ handoffId, handoffFile, cwd, sourceThreadId, sourceThreadTitle }) {
  return [
    "# 压缩续接交接文件生成",
    "",
    "你正在源线程中执行续接前的交接整理。请基于本源线程自己的历史、当前工作区文件和实际仓库状态，总结交接重点并写入指定文件。",
    "",
    `目标文件：${handoffFile}`,
    "",
    "必须执行：",
    "1. 读取当前工作区的 `.agent-context/PROJECT_CONTEXT.md` 和 `.agent-context/HANDOFF.md`（如果存在），只把与当前工作区和本源线程有关的事实写入交接文件。",
    "2. 检查当前工作区的关键状态，例如 `git status`、最近修改、未完成任务、验证结果、运行/部署注意事项；按实际需要读取相关文件。",
    "3. 交接文件必须由本源线程重新总结，不能只复制固定模板，也不能混入其他线程或其他工作区的提交规则。",
    "4. 只有当前工作区文件或本源线程历史明确涉及 private/public/README/release 规则时，才写这些规则，并标明来源；否则不要写。",
    "5. 不要写入 raw secrets、access tokens、passwords、一次性授权状态、隐藏 UI 状态或长日志。",
    "6. 覆盖写入目标文件。写完后只简短回复已写入该文件；不要提交、推送或修改无关文件。",
    "",
    "交接文件格式要求：",
    `- 第一行必须是：Continuation handoff marker: ${handoffId}`,
    `- 必须包含：Source thread id: ${sourceThreadId || "(unknown)"}`,
    `- 必须包含：Source thread title: ${sourceThreadTitle || "(unknown)"}`,
    `- 必须包含：Workspace: ${cwd || "(unknown)"}`,
    "- 后续用 Markdown 分节：当前目标、已完成事项、未完成事项、关键文件/命令、验证结果、风险/注意事项、下一线程建议。",
  ].join("\n");
}

async function waitForContinuationHandoffFile(target, timeoutMs = CONTINUATION_HANDOFF_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const text = fs.readFileSync(target.file, "utf8");
      const handoff = continuationHandoffFromText(target, text);
      if (handoff) return handoff;
      const trimmed = text.trim();
      lastError = `file exists but is incomplete (${trimmed.length} chars)`;
    } catch (err) {
      lastError = err && err.code === "ENOENT" ? "file not written yet" : (err.message || String(err));
    }
    await sleep(1000);
  }
  const err = new Error(`Source thread did not finish writing continuation handoff within ${Math.round(timeoutMs / 1000)}s: ${target.file} (${lastError})`);
  err.code = "HANDOFF_TIMEOUT";
  err.handoffTarget = target;
  throw err;
}

async function waitForContinuationTurnCompletion(threadId, turnId) {
  const id = String(turnId || "").trim();
  if (!threadId || !id) return { waited: false, completed: false, reason: "missing turn id" };
  const deadline = Date.now() + CONTINUATION_HANDOFF_TURN_COMPLETION_TIMEOUT_MS;
  let lastStatus = "";
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const result = await codex.request("thread/turns/list", {
        threadId,
        limit: Math.max(3, CONTINUATION_RECENT_TURNS),
        sortDirection: "desc",
      }, { timeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS, retry: false });
      const turns = Array.isArray(result && result.data)
        ? result.data
        : Array.isArray(result && result.turns)
          ? result.turns
          : [];
      const turn = turns.find((entry) => entry && String(entry.id || "") === id);
      if (turn) {
        lastStatus = statusText(turn.status) || "(no status)";
        if (isCompletedStatus(turn.status)) {
          return { waited: true, completed: true, status: lastStatus };
        }
      }
    } catch (err) {
      lastError = err.message || String(err);
    }
    await sleep(1000);
  }
  return {
    waited: true,
    completed: false,
    status: lastStatus,
    error: lastError,
    timedOut: true,
  };
}

async function createSourceContinuationHandoff({ cwd, sourceThreadId, sourceThreadTitle, runtimeSettings, onProgress }) {
  const threadId = String(sourceThreadId || "").trim();
  if (!threadId) return null;
  const target = continuationHandoffTarget(cwd, threadId);
  target.sourceThreadId = threadId;
  fs.mkdirSync(target.dir, { recursive: true });
  ensureContinuationHandoffIgnore(target);
  const existingHandoff = findRecentContinuationHandoff(cwd, threadId);
  if (existingHandoff) {
    if (onProgress) {
      onProgress("handoff-reuse", "发现已生成交接文件，继续创建续接线程", {
        sourceThreadId: threadId,
        handoffFile: existingHandoff.path,
        chars: existingHandoff.chars || 0,
      });
    }
    return Object.assign(existingHandoff, {
      turnId: "",
      turnCompletion: { waited: false, completed: false, reason: "reused recent handoff file" },
    });
  }
  const prompt = sourceContinuationHandoffPrompt({
    handoffId: target.id,
    handoffFile: target.file,
    cwd,
    sourceThreadId: threadId,
    sourceThreadTitle,
  });
  const params = applyTurnRuntimeSettings({
    threadId,
    input: [{ type: "text", text: prompt, text_elements: [] }],
    cwd,
    summary: "auto",
  }, runtimeSettings || {});
  try {
    if (onProgress) onProgress("handoff-resume", "正在唤醒源线程");
    await codex.request("thread/resume", applyResumeRuntimeSettings({
      threadId,
      cwd,
      persistExtendedHistory: true,
    }, runtimeSettings || {}), { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
  } catch (err) {
    if (!/already|loaded|active/i.test(err.message || "")) throw err;
  }
  if (onProgress) onProgress("handoff-turn", "正在让源线程生成交接文件");
  const result = await codex.request("turn/start", params, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
  const turnId = turnIdFromResult(result);
  if (onProgress) onProgress("handoff-file", "正在等待源线程写入交接文件", { turnId });
  let file;
  try {
    file = await waitForContinuationHandoffFile(target);
  } catch (err) {
    if (err.code !== "HANDOFF_TIMEOUT") throw err;
    if (onProgress) {
      onProgress("handoff-late", "源线程仍在写交接文件，继续后台等待", {
        turnId,
        extraTimeoutMs: CONTINUATION_LATE_HANDOFF_TIMEOUT_MS,
      });
    }
    file = await waitForContinuationHandoffFile(target, CONTINUATION_LATE_HANDOFF_TIMEOUT_MS);
  }
  if (onProgress) onProgress("handoff-complete", "交接文件已写入，正在确认源线程完成", { turnId, chars: file.chars || 0 });
  const turnCompletion = await waitForContinuationTurnCompletion(threadId, turnId);
  return Object.assign(file, {
    turnId,
    turnCompletion,
    result,
  });
}

function sourceHandoffSection(sourceHandoff) {
  if (!sourceHandoff) {
    return "No source-thread-generated handoff file was requested or available.";
  }
  const excerpt = truncateMiddle(sourceHandoff.text || "", CONTINUATION_SOURCE_HANDOFF_EXCERPT_CHARS, "source handoff excerpt");
  return [
    `- Handoff file: ${sourceHandoff.path}`,
    `- Handoff id: ${sourceHandoff.id}`,
    `- Handoff chars: ${sourceHandoff.chars || 0}`,
    `- Handoff excerpt chars included: ${Math.min(excerpt.length, CONTINUATION_SOURCE_HANDOFF_EXCERPT_CHARS)}`,
    "- Read the full handoff file above when exact prior state is needed.",
    "",
    "### Source-thread-generated handoff excerpt",
    excerpt || "(empty)",
  ].join("\n");
}

function newThreadBootstrapPromptScoped({ cwd, sourceThreadId, sourceThreadTitle, desiredTitle, sourceSnapshot, runtimeSettings, sourceHandoff, sourceLineage }) {
  const snapshot = sourceSnapshot || { threadId: sourceThreadId, title: sourceThreadTitle, turns: [], readWarnings: [] };
  const publicRuntime = publicRuntimeSettings(runtimeSettings);
  const parts = [
    "# 压缩续接启动上下文",
    "",
    "本线程是 Codex Mobile Web 为了降低源线程 rollout JSONL 体积而创建的同工作区续接线程，不是普通新项目。",
    "续接依据必须来自源线程刚生成的交接文件、当前工作区持久上下文文件和重新读取的本地仓库状态。",
    "",
    "启动步骤：",
    "1. 先读取下方“源线程交接文件”中列出的文件，并把它作为本线程的最高优先级交接事实源。",
    "2. 再读取当前工作区的 `.agent-context/PROJECT_CONTEXT.md` 和 `.agent-context/HANDOFF.md`（如果存在），只加载与当前工作区有关的规则。",
    "3. 用简短要点确认已加载的关键事实；不要确认与当前工作区无关的 private/public/README/release 规则。",
    "4. 本轮不要修改文件、不要提交、不要推送，除非用户在续接线程里给出新的明确任务。",
    "",
    "不要假设新线程继承了旧聊天流、临时 shell 状态、一次性审批、隐藏 UI 状态或旧线程的内存推理。需要依赖的内容必须来自工作区文件、源线程交接文件、下面的有限续接上下文，或重新读取本地仓库。",
    "",
    "## 当前续接目标",
    `- 新线程标题：${desiredTitle || "(not set)"}`,
    `- 当前工作区：${cwd || "(unknown)"}`,
    `- 创建时间：${new Date().toISOString()}`,
    "",
    "## 源线程",
    continuationSourceThreadSection(snapshot),
    "",
    "## 源线程交接文件",
    sourceHandoffSection(sourceHandoff),
    "",
    sourceLineage || continuationLineageSection(cwd, sourceThreadId),
    "",
    "## 运行设置",
    `- Mobile Web 传给续接线程的运行设置：${Object.keys(publicRuntime || {}).length ? JSON.stringify(publicRuntime) : "(none detected)"}`,
    "- 如果后续任务需要更高权限或不同模型，按当前线程 UI/用户指令处理；不要假设旧线程的一次性授权仍然有效。",
    "",
    "## 最近源线程上下文摘录",
    continuationTurnSummaries(snapshot.turns),
    "",
    "## 工作区持久上下文摘录",
    continuationWorkspaceContextSections(cwd),
  ];
  return truncateMiddle(parts.join("\n"), MAX_CONTINUATION_BOOTSTRAP_CHARS, "continuation bootstrap");
}

async function tryUpdateThreadTitle(threadId, title) {
  if (!threadId || !title) return false;
  const attempts = [
    ["thread/name/set", { threadId, name: title }],
    ["thread/updateTitle", { threadId, title }],
    ["thread/update_title", { threadId, title }],
    ["thread/setTitle", { threadId, title }],
    ["thread/rename", { threadId, title }],
    ["thread/update", { threadId, title }],
    ["thread/update", { threadId, threadName: title }],
  ];
  for (const [method, params] of attempts) {
    try {
      await codex.request(method, params, { timeoutMs: READ_RPC_TIMEOUT_MS, retry: false });
      return true;
    } catch (err) {
      if (!/method not found|unknown method|not found|invalid params|invalid request/i.test(err.message || "")) {
        throw err;
      }
    }
  }
  return false;
}

async function archiveVisibleThread(threadId, visibility) {
  if (!threadId) return { archived: false };
  const summary = readStateDbThread(threadId)
    || readStartedThread(threadId)
    || await readThreadSummaryFromAppServer(codex, threadId).catch(() => null);
  if (summary && isHiddenThread(summary, visibility)) {
    throw new Error("Source thread is archived, deleted, or outside visible workspaces");
  }
  return await codex.request("thread/archive", { threadId }, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
}

function isThreadArchiveNoOpError(err) {
  const message = String((err && err.message) || "").toLowerCase();
  const code = String((err && err.code) || "").toLowerCase();
  return /already|archived|not found|notexisting|不存在|已归档|does not exist|no such/.test(message)
    || /thread_not_found|thread-not-found|not_found|not-found/.test(code);
}

async function archiveThreadId(threadId, visibility = visibilityFromGlobalState()) {
  if (!threadId) return { archived: false };
  const summary = readStateDbThread(threadId) || readStartedThread(threadId);
  if (summary && isHiddenThread(summary, visibility)) {
    return { archived: true, alreadyArchived: true, source: "state-db" };
  }
  try {
    const result = await codex.request("thread/archive", { threadId }, {
      timeoutMs: MUTATION_RPC_TIMEOUT_MS,
      retry: false,
    });
    return result || { archived: true };
  } catch (err) {
    const rechecked = readStateDbThread(threadId) || readStartedThread(threadId);
    if (rechecked && isHiddenThread(rechecked, visibility)) {
      return { archived: true, alreadyArchived: true, source: "state-db" };
    }
    if (isThreadArchiveNoOpError(err)) {
      return { archived: true, alreadyArchived: true };
    }
    throw err;
  }
}

function httpStatusError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function continuationJobSourceKey(body) {
  const sourceThreadId = String(body && body.sourceThreadId || "").trim();
  if (!sourceThreadId) return "";
  return [
    sourceThreadId,
    normalizeFsPath(String(body.cwd || "").trim()),
    Boolean(body.archiveSourceThread),
  ].join("|");
}

function publicContinuationJob(job) {
  if (!job) return null;
  return {
    ok: job.status === "done",
    jobId: job.id,
    status: job.status,
    step: job.step,
    message: job.message,
    sourceThreadId: job.sourceThreadId,
    threadId: job.threadId || "",
    contextCompaction: job.contextCompaction || null,
    sourceArchive: job.sourceArchive || null,
    sourceHandoff: job.sourceHandoff || null,
    lineage: job.lineage || null,
    result: job.status === "done" ? job.result : null,
    error: job.error || "",
    createdAt: new Date(job.createdAt).toISOString(),
    updatedAt: new Date(job.updatedAt).toISOString(),
  };
}

function pruneContinuationJobs(now = Date.now()) {
  for (const [jobId, job] of continuationJobs) {
    if (!job || now - job.updatedAt > CONTINUATION_JOB_TTL_MS) {
      continuationJobs.delete(jobId);
      if (job && job.sourceKey && activeContinuationJobsBySource.get(job.sourceKey) === jobId) {
        activeContinuationJobsBySource.delete(job.sourceKey);
      }
    }
  }
  while (continuationJobs.size > CONTINUATION_JOB_MAX) {
    const firstKey = continuationJobs.keys().next().value;
    if (!firstKey) break;
    const job = continuationJobs.get(firstKey);
    continuationJobs.delete(firstKey);
    if (job && job.sourceKey && activeContinuationJobsBySource.get(job.sourceKey) === firstKey) {
      activeContinuationJobsBySource.delete(job.sourceKey);
    }
  }
}

function updateContinuationJob(job, patch = {}) {
  if (!job) return;
  Object.assign(job, patch, { updatedAt: Date.now() });
  logContinuation(job.step || patch.step || "update", {
    jobId: job.id,
    status: job.status,
    sourceThreadId: job.sourceThreadId,
    threadId: job.threadId,
    message: job.message,
    error: job.error,
  });
}

function setContinuationStep(job, step, message, extra = {}) {
  updateContinuationJob(job, Object.assign({ status: "running", step, message }, extra));
}

async function startThreadFromRequestBody(body, options = {}) {
  const job = options.job || null;
  const progress = (step, message, extra) => setContinuationStep(job, step, message, extra);
  const cwd = String(body.cwd || "").trim();
  if (!cwd) {
    throw httpStatusError(400, "Workspace is required to start a new thread");
  }
  progress("validate", "正在检查工作区");
  const globalState = readGlobalState();
  const visibility = visibilityFromGlobalState(globalState);
  if (visibility.workspaceKeys.size > 0 && !visibility.workspaceKeys.has(normalizeFsPath(cwd))) {
    throw httpStatusError(403, "Workspace is not visible in Codex Desktop");
  }
  progress("context-compaction", "Checking workspace handoff size");
  const contextCompaction = compactWorkspaceHandoff({
    cwd,
    thresholdBytes: CONTINUATION_CONTEXT_HANDOFF_COMPACT_BYTES,
    preserveChars: CONTINUATION_CONTEXT_HANDOFF_PRESERVE_CHARS,
  });
  if (job) job.contextCompaction = contextCompaction;
  if (contextCompaction && contextCompaction.compacted) {
    progress("context-compaction", "Workspace handoff compacted", {
      handoffPath: contextCompaction.handoffPath,
      archivePath: contextCompaction.archivePath,
      originalBytes: contextCompaction.originalBytes,
      compactedBytes: contextCompaction.compactedBytes,
    });
  }
  const sourceThreadId = String(body.sourceThreadId || "").trim();
  const sourceThreadTitle = String(body.sourceThreadTitle || "").trim();
  const archiveSourceThread = Boolean(body.archiveSourceThread && sourceThreadId);
  const desiredTitle = newThreadTitle({ cwd, sourceThreadTitle });
  progress("source-snapshot", "正在读取源线程摘要", { sourceThreadId });
  const sourceSnapshot = await continuationSourceSnapshot(sourceThreadId, sourceThreadTitle, visibility);
  const runtimeSettings = applyPermissionModeOverride(sourceSnapshot.runtimeSettings || {}, body.permissionMode, cwd);
  progress("handoff", "正在生成源线程交接文件", { sourceThreadId });
  const sourceHandoff = await createSourceContinuationHandoff({
    cwd,
    sourceThreadId,
    sourceThreadTitle,
    runtimeSettings,
    onProgress: progress,
  });
  if (job && sourceHandoff) {
    job.sourceHandoff = {
      id: sourceHandoff.id,
      path: sourceHandoff.path,
      relativePath: sourceHandoff.relativePath,
      chars: sourceHandoff.chars || 0,
      turnId: sourceHandoff.turnId || "",
      turnCompletion: sourceHandoff.turnCompletion || null,
    };
  }
  const sourceLineage = continuationLineageSection(cwd, sourceThreadId);
  progress("thread-start", "正在创建续接线程");
  const params = applyStartThreadRuntimeSettings({
    cwd,
    modelProvider: null,
    config: {},
    developerInstructions: readStartThreadDeveloperInstructions(cwd) || "",
    personality: null,
    ephemeral: null,
    dynamicTools: null,
    mockExperimentalField: null,
    experimentalRawEvents: false,
    persistExtendedHistory: true,
  }, runtimeSettings);
  const result = await codex.request("thread/start", params, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
  const threadId = threadIdFromStartResult(result);
  if (job) job.threadId = threadId;
  progress("title", "正在设置续接线程标题", { threadId });
  const titleUpdatedBeforeBootstrap = await tryUpdateThreadTitle(threadId, desiredTitle).catch(() => false);
  const bootstrapParams = applyTurnRuntimeSettings({
    threadId,
    input: newThreadBootstrapInput({ cwd, sourceThreadId, sourceThreadTitle, desiredTitle, sourceSnapshot, runtimeSettings, sourceHandoff, sourceLineage }),
    cwd,
    summary: "auto",
  }, runtimeSettings);
  progress("bootstrap", "正在写入续接启动上下文", { threadId });
  const bootstrap = threadId
    ? await codex.request("turn/start", bootstrapParams, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false })
    : null;
  const titleUpdatedAfterBootstrap = await tryUpdateThreadTitle(threadId, desiredTitle).catch(() => false);
  let sourceArchive = null;
  if (archiveSourceThread && sourceThreadId !== threadId) {
    progress("archive-source", "正在归档旧线程", { threadId, sourceThreadId });
    try {
      sourceArchive = {
        archived: true,
        threadId: sourceThreadId,
        result: await archiveVisibleThread(sourceThreadId, visibility),
      };
    } catch (err) {
      sourceArchive = {
        archived: false,
        threadId: sourceThreadId,
        error: err.message || String(err),
      };
    }
  }
  if (job) job.sourceArchive = sourceArchive;
  const sourceSummary = sourceSnapshot && sourceSnapshot.summary;
  const sourceRolloutPath = sourceSummary ? rolloutPathForThread(sourceSummary) : "";
  const sourceStats = sourceRolloutPath ? rolloutStatsForPath(sourceRolloutPath) : null;
  const lineage = appendContinuationLineageEntry(cwd, {
    newThreadId: threadId,
    newThreadTitle: desiredTitle,
    sourceThreadId,
    sourceThreadTitle: (sourceSummary && (sourceSummary.name || sourceSummary.preview)) || sourceThreadTitle,
    sourceRolloutPath,
    sourceRolloutSizeBytes: sourceStats ? sourceStats.sizeBytes : 0,
    handoffFile: sourceHandoff && sourceHandoff.path,
    handoffRelativePath: sourceHandoff && sourceHandoff.relativePath,
    handoffId: sourceHandoff && sourceHandoff.id,
    handoffChars: sourceHandoff && sourceHandoff.chars,
    sourceArchived: Boolean(sourceArchive && sourceArchive.archived),
    sourceArchiveError: sourceArchive && sourceArchive.error,
  });
  if (job) job.lineage = lineage;
  const thread = rememberStartedThread(annotateThreadRolloutStats(Object.assign(
    {},
    (result && result.thread) || (result && result.data && result.data.thread) || {},
    {
      id: threadId,
      name: desiredTitle,
      preview: desiredTitle,
      cwd,
      status: { type: "active" },
      turns: [],
      mobileReadMode: "continuation-bootstrap",
    },
  )));
  return {
    ok: true,
    threadId,
    thread,
    title: desiredTitle,
    titleUpdated: Boolean(titleUpdatedBeforeBootstrap || titleUpdatedAfterBootstrap),
    sourceArchive,
    sourceContextWarnings: sourceSnapshot.readWarnings || [],
    sourceHandoff: sourceHandoff ? {
      id: sourceHandoff.id,
      path: sourceHandoff.path,
      relativePath: sourceHandoff.relativePath,
      chars: sourceHandoff.chars || 0,
      turnId: sourceHandoff.turnId || "",
      turnCompletion: sourceHandoff.turnCompletion || null,
    } : null,
    lineage,
    continuationContextChars: bootstrapParams
      && Array.isArray(bootstrapParams.input)
      && bootstrapParams.input[0]
      ? String(bootstrapParams.input[0].text || "").length
      : 0,
    bootstrap,
    result,
  };
}

function createContinuationJob(body) {
  pruneContinuationJobs();
  const sourceKey = continuationJobSourceKey(body);
  const activeJobId = sourceKey ? activeContinuationJobsBySource.get(sourceKey) : "";
  const activeJob = activeJobId ? continuationJobs.get(activeJobId) : null;
  if (activeJob && ["queued", "running"].includes(activeJob.status)) {
    return activeJob;
  }
  const now = Date.now();
  const job = {
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"),
    status: "queued",
    step: "queued",
    message: "续接任务已创建",
    body: Object.assign({}, body),
    sourceThreadId: String(body.sourceThreadId || "").trim(),
    sourceKey,
    threadId: "",
    sourceArchive: null,
    sourceHandoff: null,
    lineage: null,
    result: null,
    error: "",
    createdAt: now,
    updatedAt: now,
  };
  continuationJobs.set(job.id, job);
  if (sourceKey) activeContinuationJobsBySource.set(sourceKey, job.id);
  logContinuation("queued", { jobId: job.id, sourceThreadId: job.sourceThreadId, cwd: body.cwd });
  setImmediate(() => runContinuationJob(job));
  return job;
}

async function runContinuationJob(job) {
  try {
    updateContinuationJob(job, { status: "running", step: "start", message: "续接任务开始执行" });
    const result = await startThreadFromRequestBody(job.body, { job });
    updateContinuationJob(job, {
      status: "done",
      step: "done",
      message: result.sourceArchive && result.sourceArchive.error
        ? `续接线程已就绪；归档失败：${result.sourceArchive.error}`
        : "续接线程已就绪",
      threadId: result.threadId || job.threadId,
      sourceArchive: result.sourceArchive || job.sourceArchive,
      sourceHandoff: result.sourceHandoff || job.sourceHandoff,
      result,
    });
  } catch (err) {
    updateContinuationJob(job, {
      status: "failed",
      step: "failed",
      message: "续接任务失败",
      error: err.message || String(err),
    });
  } finally {
    if (job.sourceKey && activeContinuationJobsBySource.get(job.sourceKey) === job.id) {
      activeContinuationJobsBySource.delete(job.sourceKey);
    }
  }
}

function isUnmaterializedThreadError(err) {
  return /not materialized yet|includeTurns is unavailable before first user message/i.test(err && err.message || String(err || ""));
}

function pruneStartedThreadCache(now = Date.now()) {
  for (const [threadId, entry] of recentStartedThreads) {
    if (!entry || now - entry.cachedAt > STARTED_THREAD_CACHE_TTL_MS) recentStartedThreads.delete(threadId);
  }
  while (recentStartedThreads.size > STARTED_THREAD_CACHE_MAX) {
    const firstKey = recentStartedThreads.keys().next().value;
    if (!firstKey) break;
    recentStartedThreads.delete(firstKey);
  }
}

function rememberStartedThread(thread) {
  const threadId = thread && thread.id;
  if (!threadId) return null;
  pruneStartedThreadCache();
  const summary = annotateThreadRolloutStats(Object.assign({
    preview: threadId,
    updatedAt: Math.floor(Date.now() / 1000),
    status: { type: "notLoaded" },
    turns: [],
    mobileReadMode: "unmaterialized",
  }, thread, { id: threadId }));
  recentStartedThreads.set(String(threadId), {
    cachedAt: Date.now(),
    thread: summary,
  });
  return summary;
}

function readStartedThread(threadId) {
  pruneStartedThreadCache();
  const entry = recentStartedThreads.get(String(threadId || ""));
  return entry && entry.thread ? annotateThreadRolloutStats(entry.thread) : null;
}

function readStateDbThread(threadId) {
  if (!fs.existsSync(STATE_DB) || !threadId) return null;
  const query = [
    "select id,title,first_user_message,cwd,rollout_path,archived,archived_at,updated_at,model,reasoning_effort,sandbox_policy,approval_mode,agent_nickname,agent_role,",
    "exists(select 1 from thread_spawn_edges where child_thread_id=threads.id) as is_spawned_child",
    "from threads",
    `where id=${sqlString(threadId)}`,
    "limit 1;",
  ].join(" ");
  try {
    const result = runSqliteJson(STATE_DB, query, { timeoutMs: 5000, maxBuffer: 1024 * 1024, userHome: USER_HOME });
    if (!result.ok) return null;
    const rows = result.rows;
    return rows[0] ? rowToFallbackThread(rows[0]) : null;
  } catch (_) {
    return null;
  }
}

function mergeThreadDisplaySummary(base, display) {
  if (!base) return display ? annotateThreadRolloutStats(display) : null;
  if (!display) return base;
  const next = Object.assign({}, base);
  for (const key of ["name", "preview", "cwd", "updatedAt"]) {
    const value = display[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") next[key] = value;
  }
  if (display.status) next.status = display.status;
  return annotateThreadRolloutStats(next);
}

function mergeThreadRuntimeFromStateDb(thread, summary = null) {
  if (!thread || typeof thread !== "object") return thread;
  const stateThread = summary || readStateDbThread(thread.id);
  if (!stateThread) return thread;
  const next = Object.assign({}, thread);
  if (stateThread.model) next.model = stateThread.model;
  if (stateThread.effort) next.effort = stateThread.effort;
  return next;
}

async function readThreadSummaryFromAppServer(codex, threadId) {
  if (!threadId) return null;
  const result = await codex.request("thread/list", {
    limit: 1000,
    sortKey: "updated_at",
    sortDirection: "desc",
    archived: false,
    useStateDbOnly: true,
    sourceKinds: [],
  }, { timeoutMs: READ_RPC_TIMEOUT_MS });
  const threads = Array.isArray(result && result.data)
    ? result.data
    : Array.isArray(result && result.threads)
      ? result.threads
      : [];
  const thread = threads.find((thread) => String(thread && thread.id) === String(threadId)) || null;
  return threadDisplaySummaryCache.remember(thread) || annotateThreadRolloutStats(thread);
}

function sortTurnsChronologically(turns) {
  return (turns || []).slice().sort((a, b) => {
    const left = turnSortTimestampMs(a);
    const right = turnSortTimestampMs(b);
    if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right;
    return String((a && a.id) || "").localeCompare(String((b && b.id) || ""));
  });
}

function turnSortTimestampMs(turn) {
  for (const key of [
    "startedAtMs",
    "startedAt",
    "started_at_ms",
    "started_at",
    "createdAtMs",
    "createdAt",
    "created_at_ms",
    "created_at",
    "completedAtMs",
    "completedAt",
    "completed_at_ms",
    "completed_at",
    "updatedAtMs",
    "updatedAt",
    "updated_at_ms",
    "updated_at",
  ]) {
    const timestamp = timestampToMs(turn && turn[key]);
    if (timestamp) return timestamp;
  }
  const itemTimestamps = ((turn && turn.items) || [])
    .map(itemDisplayTimestampMs)
    .filter(Boolean);
  return itemTimestamps.length ? Math.min(...itemTimestamps) : NaN;
}

function threadFromTurnsList(threadId, summary, turnsResult) {
  const data = Array.isArray(turnsResult && turnsResult.data)
    ? turnsResult.data
    : Array.isArray(turnsResult && turnsResult.turns)
      ? turnsResult.turns
      : [];
  const enriched = enrichThreadItemTimestampsFromRollout(Object.assign({ turns: data }, summary || {}, { id: threadId }));
  const turns = sortTurnsChronologically(enriched.turns).slice(-MAX_THREAD_TURNS);
  const latest = turns[turns.length - 1];
  const status = latest && isLiveTurn(latest) ? { type: "active" } : (summary && summary.status) || { type: "notLoaded" };
  return annotateThreadRolloutStats(Object.assign({
    id: threadId,
    name: null,
    preview: threadId,
    cwd: null,
    path: null,
    updatedAt: 0,
    status,
    turns,
    mobileReadMode: "turns-list",
  }, summary || {}, { id: threadId, status, turns, mobileReadMode: "turns-list" }));
}

function isReadTimeoutError(err) {
  return Boolean(err && (err.code === "RPC_TIMEOUT" || /timed out|connection is not open|connection closed/i.test(err.message || "")));
}

function threadRolloutSizeBytes(thread) {
  const size = Number(thread && thread.rolloutSizeBytes);
  if (Number.isFinite(size) && size > 0) return size;
  const stats = rolloutStatsForPath(rolloutPathForThread(thread));
  return stats ? stats.sizeBytes : 0;
}

function shouldSkipThreadDetailRpc(thread) {
  return threadRolloutSizeBytes(thread) >= THREAD_DETAIL_ROLLOUT_MAX_BYTES;
}

function threadDetailTooLargeWarning(thread) {
  const size = threadRolloutSizeBytes(thread);
  return `Thread rollout is too large for mobile detail RPC (${formatByteCount(size)} >= ${formatByteCount(THREAD_DETAIL_ROLLOUT_MAX_BYTES)}).`;
}

function fallbackThreadReadResult(threadId, summary, runtimeSettings, warning, mode = "summary-fallback") {
  const fallbackThread = annotateThreadRolloutStats(Object.assign({
    id: threadId,
    name: null,
    preview: threadId,
    cwd: null,
    path: null,
    updatedAt: Math.floor(Date.now() / 1000),
    status: { type: "notLoaded" },
    turns: [],
    mobileReadMode: mode,
  }, summary || {}, { id: threadId, turns: [], mobileReadMode: mode }));
  if (fallbackThread) fallbackThread.runtimeSettings = publicRuntimeSettings(runtimeSettings);
  return attachThreadTaskCardsToResult({
    thread: fallbackThread,
    mobileReadWarning: warning || "",
  });
}

function attachThreadTaskCardsToThread(thread) {
  if (!thread || typeof thread !== "object" || !thread.id) return thread;
  thread.threadTaskCards = threadTaskCardService.listForThread(thread.id);
  const taskCardCounts = threadTaskCardService.pendingCountsForThread(thread.id);
  thread.pendingTaskCardCount = taskCardCounts.pendingTotal;
  thread.pendingIncomingTaskCardCount = taskCardCounts.pendingIncoming;
  thread.pendingOutgoingTaskCardCount = taskCardCounts.pendingOutgoing;
  return thread;
}

function attachThreadTaskCardCountsToSummary(thread) {
  if (!thread || typeof thread !== "object" || !thread.id) return thread;
  const taskCardCounts = threadTaskCardService.pendingCountsForThread(thread.id);
  thread.pendingTaskCardCount = taskCardCounts.pendingTotal;
  thread.pendingIncomingTaskCardCount = taskCardCounts.pendingIncoming;
  thread.pendingOutgoingTaskCardCount = taskCardCounts.pendingOutgoing;
  return thread;
}

function attachThreadTaskCardCountsToThreadListResult(result) {
  if (!result || typeof result !== "object") return result;
  if (Array.isArray(result.data)) result.data.forEach(attachThreadTaskCardCountsToSummary);
  if (Array.isArray(result.threads)) result.threads.forEach(attachThreadTaskCardCountsToSummary);
  return result;
}

function attachThreadTaskCardsToResult(result) {
  if (!result || typeof result !== "object" || !result.thread) return result;
  attachThreadTaskCardsToThread(result.thread);
  return result;
}

function stableTextHash(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function truncateSingleLine(value, maxChars = 96) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function normalizeThreadTaskCardWorkflowMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "autonomous" || mode === "auto" || mode === "automatic") return "autonomous";
  return "manual";
}

function uniqueThreadTaskCardTargetIds(values, fallback = "") {
  const raw = Array.isArray(values) ? values : [values, fallback];
  const seen = new Set();
  const out = [];
  for (const value of raw) {
    const id = String(value || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function parseThreadTaskCardDraftText(value) {
  const text = String(value || "");
  const match = new RegExp(`<${THREAD_TASK_CARD_DRAFT_TAG}>\\s*([\\s\\S]*?)\\s*<\\/${THREAD_TASK_CARD_DRAFT_TAG}>`, "i").exec(text);
  if (!match) return null;
  let parsed;
  try {
    parsed = JSON.parse(match[1]);
  } catch (_) {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const targetThreadIds = uniqueThreadTaskCardTargetIds(parsed.targetThreadIds, parsed.targetThreadId);
  return {
    targetThreadId: targetThreadIds[0] || "",
    targetThreadIds,
    workflowMode: normalizeThreadTaskCardWorkflowMode(parsed.workflowMode),
    workflowId: truncateSingleLine(parsed.workflowId || "", 220),
    title: truncateSingleLine(parsed.title || "", 120),
    summary: truncateSingleLine(parsed.summary || "", 280),
    body: String(parsed.body || "").trim(),
    error: truncateSingleLine(parsed.error || "", 280),
  };
}

function threadTaskCardDraftPayloadKey(draft) {
  const targetThreadIds = uniqueThreadTaskCardTargetIds(draft && draft.targetThreadIds, draft && draft.targetThreadId).sort();
  return stableTextHash(JSON.stringify({
    targetThreadIds,
    workflowMode: normalizeThreadTaskCardWorkflowMode(draft && draft.workflowMode),
    workflowId: String(draft && draft.workflowId || "").trim(),
    title: String(draft && draft.title || "").trim(),
    summary: String(draft && draft.summary || "").trim(),
    body: String(draft && draft.body || "").trim(),
  }));
}

function threadTaskCardDraftIdempotencyKey(threadId, turnId, draft) {
  const payloadKey = threadTaskCardDraftPayloadKey(draft);
  return `task-card-draft:${String(threadId || "")}:task-card-draft|${String(turnId || "")}|draft-${payloadKey}`;
}

function threadTaskCardItemText(item) {
  if (!item || typeof item !== "object") return "";
  if (typeof item.text === "string") return item.text;
  if (typeof item.content === "string") return item.content;
  if (Array.isArray(item.content)) {
    return item.content.map((part) => {
      if (!part || typeof part !== "object") return "";
      return typeof part.text === "string" ? part.text : "";
    }).join("\n");
  }
  return "";
}

function summarizeTaskCardText(value) {
  return truncateSingleLine(String(value || "").replace(/\s+/g, " ").trim(), 280);
}

function truncateThreadTaskCardBody(value, maxChars = THREAD_TASK_CARD_BODY_MAX_CHARS) {
  const text = String(value || "").trim();
  const limit = Math.max(0, Number(maxChars) || 0);
  if (!limit || text.length <= limit) return text;
  const marker = `\n\n[Task card body truncated: ${text.length} chars total]\n\n`;
  const available = Math.max(0, limit - marker.length);
  if (available <= 0) return text.slice(0, limit);
  const head = Math.ceil(available * 0.6);
  const tail = Math.max(0, available - head);
  return `${text.slice(0, head).trimEnd()}${marker}${text.slice(-tail).trimStart()}`.slice(0, limit);
}

function threadDisplayTitle(thread) {
  return String((thread && (thread.name || thread.title || thread.preview || thread.id)) || "").trim();
}

async function materializeThreadTaskCardDraftsForThread(thread) {
  if (!thread || typeof thread !== "object" || !thread.id || !Array.isArray(thread.turns)) return [];
  const sourceThreadId = String(thread.id || "");
  const sourceWorkspaceId = String(thread.cwd || (readStateDbThread(sourceThreadId) || {}).cwd || "");
  const sourceThreadTitle = threadDisplayTitle(thread) || sourceThreadId;
  const created = [];
  for (const turn of thread.turns) {
    const turnId = String(turn && turn.id || "");
    if (!turnId || !Array.isArray(turn && turn.items)) continue;
    for (const item of turn.items) {
      if (!item || (item.type !== "agentMessage" && item.type !== "plan")) continue;
      const draft = parseThreadTaskCardDraftText(threadTaskCardItemText(item));
      if (!draft || draft.error || !draft.title || !draft.body || !draft.targetThreadIds.length) continue;
      const targetWorkspaceIds = {};
      for (const targetThreadId of draft.targetThreadIds) {
        const targetSummary = readStateDbThread(targetThreadId) || readStartedThread(targetThreadId);
        targetWorkspaceIds[targetThreadId] = targetSummary && targetSummary.cwd || "";
      }
      try {
        const body = truncateThreadTaskCardBody(draft.body);
        const cards = await threadTaskCardService.createMany({
          sourceWorkspaceId,
          sourceThreadId,
          sourceTurnId: turnId,
          sourceThreadTitle,
          targetThreadIds: draft.targetThreadIds,
          targetWorkspaceIds,
          idempotencyKey: threadTaskCardDraftIdempotencyKey(sourceThreadId, turnId, draft),
          format: "markdown",
          title: draft.title,
          summary: draft.summary || summarizeTaskCardText(body),
          body,
          workflowMode: draft.workflowMode || "manual",
          workflowId: draft.workflowId || "",
        });
        for (const card of cards || []) {
          if (card && card.id) created.push(card);
        }
      } catch (err) {
        console.error(`[thread task card] server draft materialization failed thread=${shortIdentifier(sourceThreadId)} turn=${shortIdentifier(turnId)}: ${err.message || String(err)}`);
      }
    }
  }
  return created;
}

async function prepareThreadTaskCardsToResult(result) {
  if (!result || typeof result !== "object" || !result.thread) return result;
  await materializeThreadTaskCardDraftsForThread(result.thread);
  return attachThreadTaskCardsToResult(result);
}

async function turnsListThreadReadResult(threadId, summary, runtimeSettings, warning, mode = "turns-list", threadLog = null) {
  const startedAtMs = Date.now();
  if (threadLog) {
    threadLog("turns_list_start", {
      limit: MAX_THREAD_TURNS,
      timeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS,
      fallbackFrom: mode,
    });
  }
  const turnsResult = await codex.request("thread/turns/list", {
    threadId,
    limit: MAX_THREAD_TURNS,
    sortDirection: "desc",
  }, { timeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS, retry: false, resetOnTimeout: false });
  const result = compactThreadReadResult({ thread: threadFromTurnsList(threadId, summary, turnsResult) });
  if (result.thread) {
    result.thread.runtimeSettings = publicRuntimeSettings(runtimeSettings);
    result.thread.mobileReadMode = mode;
    result.thread.mobileReadWarning = warning || "";
  }
  result.mobileReadWarning = warning || "";
  if (threadLog) {
    threadLog("turns_list_ok", {
      durationMs: Date.now() - startedAtMs,
      returnedTurns: result.thread && Array.isArray(result.thread.turns) ? result.thread.turns.length : null,
      mode,
    });
  }
  return prepareThreadTaskCardsToResult(result);
}

function filterFallbackThreads(threads, filters = {}) {
  const globalState = filters.globalState || readGlobalState();
  const visibility = visibilityFromGlobalState(globalState);
  const cwdFilter = String(filters.cwd || "").trim();
  const search = String(filters.searchTerm || "").trim().toLowerCase();
  return threads
    .filter((thread) => !isHiddenThread(thread, visibility))
    .filter((thread) => threadMatchesWorkspaceCwd(thread && thread.cwd, cwdFilter))
    .filter((thread) => {
      if (!search) return true;
      return [thread.name, thread.preview, thread.cwd, thread.id]
        .some((value) => String(value || "").toLowerCase().includes(search));
    });
}

function readStateDbFallback(limit = 80, filters = {}) {
  if (!fs.existsSync(STATE_DB)) return [];
  const rowLimit = Math.max(limit * 5, 200);
  const query = [
    "select id,title,first_user_message,cwd,rollout_path,archived,archived_at,updated_at,model,reasoning_effort,sandbox_policy,approval_mode,agent_nickname,agent_role,",
    "exists(select 1 from thread_spawn_edges where child_thread_id=threads.id) as is_spawned_child",
    "from threads",
    "order by updated_at desc",
    `limit ${Math.min(1000, rowLimit)};`,
  ].join(" ");
  try {
    const result = runSqliteJson(STATE_DB, query, { timeoutMs: 5000, maxBuffer: 5 * 1024 * 1024, userHome: USER_HOME });
    if (!result.ok) return [];
    const rows = result.rows;
    return filterFallbackThreads(rows.map(rowToFallbackThread), filters).slice(0, limit);
  } catch (_) {
    return [];
  }
}

function readSessionIndexFallback(limit = 80, filters = {}) {
  const p = path.join(CODEX_HOME, "session_index.jsonl");
  try {
    const globalState = filters.globalState || readGlobalState();
    const projectlessThreadIds = visibleProjectlessThreadIds(globalState);
    if (filters.cwd || projectlessThreadIds.size === 0) return [];
    const archivedIds = archivedSessionThreadIds();
    const lines = fs.readFileSync(p, "utf8").split(/\r?\n/).filter(Boolean).slice(-1000);
    const byId = new Map();
    for (const line of lines) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch (_) {
        continue;
      }
      if (!entry.id) continue;
      if (!projectlessThreadIds.has(entry.id)) continue;
      if (archivedIds.has(entry.id)) continue;
      const updatedAt = entry.updated_at ? Math.floor(Date.parse(entry.updated_at) / 1000) : 0;
      byId.set(entry.id, rowToFallbackThread({
        id: entry.id,
        thread_name: entry.thread_name || null,
        updatedAt,
      }));
    }
    return [...byId.values()]
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .filter((thread) => {
        const search = String(filters.searchTerm || "").trim().toLowerCase();
        if (!search) return true;
        return [thread.name, thread.preview, thread.id]
          .some((value) => String(value || "").toLowerCase().includes(search));
      })
      .slice(0, limit);
  } catch (_) {
    return [];
  }
}

async function listWorkspaces() {
  const globalState = readGlobalState();
  const roots = visibleWorkspaceRoots(globalState);
  const visibility = visibilityFromGlobalState(globalState);
  const registered = new Map(workspaceRegistryService.list().map((workspace) => [normalizeFsPath(workspace.cwd), workspace]));
  let recentThreads = [];
  try {
    const result = await codex.request("thread/list", {
      limit: 500,
      sortKey: "updated_at",
      sortDirection: "desc",
      archived: false,
      useStateDbOnly: true,
      sourceKinds: [],
    }, { timeoutMs: READ_RPC_TIMEOUT_MS });
    recentThreads = (result.data || []).filter((thread) => !isHiddenThread(thread, visibility));
  } catch (_) {
    // Workspace list can still be useful from global state while app-server is recovering.
  }
  const active = Array.isArray(globalState["active-workspace-roots"])
    ? globalState["active-workspace-roots"]
    : [];
  const counts = new Map();
  for (const thread of recentThreads) {
    if (!thread.cwd) continue;
    const key = normalizeFsPath(thread.cwd);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...roots].map((cwd) => {
    const key = normalizeFsPath(cwd);
    const registryEntry = registered.get(key);
    return {
      cwd,
      label: registryEntry && registryEntry.label || path.basename(cwd.replace(/^\\\\\?\\/, "")) || cwd,
      active: active.includes(cwd),
      recentThreadCount: counts.get(key) || 0,
      source: registryEntry ? "mobile" : "codex",
    };
  }).sort((a, b) => Number(b.active) - Number(a.active) || a.label.localeCompare(b.label));
}

function tokenUsageWorkspaceCwds(globalState = readGlobalState()) {
  return [
    ...visibleWorkspaceRoots(globalState),
    ...workspaceRegistryService.list().map((workspace) => workspace && workspace.cwd).filter(Boolean),
  ];
}

async function handleApi(req, res) {
  const url = getUrl(req);
  if (url.pathname === "/api/v1/hermes/plugin/manifest" && req.method === "GET") {
    sendJson(res, 200, hermesPluginService.manifest({
      baseUrl: HERMES_PLUGIN_BASE_URL || requestBaseUrl(req),
      hermesOrigin: hermesOriginFromRequest(req, url),
      version: APP_VERSION,
    }));
    return;
  }
  if (url.pathname === "/api/public-config") {
    loadRecentRateLimitsFromRollouts();
    sendJson(res, 200, {
      authRequired: !DISABLE_AUTH,
      title: "Codex Mobile Web",
      version: APP_VERSION,
      platform: process.platform,
      workspacePath: APP_ROOT,
      buildId: STARTUP_APP_SHELL_BUILD_ID,
      clientBuildId: clientBuildId(),
      shellCacheName: STARTUP_SHELL_CACHE_NAME,
      maxUploadBytes: MAX_UPLOAD_BYTES,
      maxUploadFiles: MAX_UPLOAD_FILES,
      imageContextMode: IMAGE_CONTEXT_POLICY.imageContextMode,
      rolloutWarningBytes: ROLLOUT_WARNING_BYTES,
      modelOptions: MODEL_OPTIONS,
      reasoningEffortOptions: REASONING_EFFORT_OPTIONS,
      permissionModeOptions: PERMISSION_MODE_OPTIONS,
      defaultModel: CODEX_CONFIG_DEFAULTS.model || DEFAULT_MODEL,
      defaultReasoningEffort: CODEX_CONFIG_DEFAULTS.reasoningEffort,
      rateLimits: activeRateLimits(),
      rateLimitsByModel: rateLimitsByModelObject(),
      codexProfiles: codexProfileService.profiles({
        activeQuota: { rateLimits: activeRateLimits(), rateLimitsByModel: rateLimitsByModelObject() },
      }),
      push: pushSubscriptionPublicStatus(),
      update: {
        enabled: !APP_UPDATE_DISABLED,
        remote: APP_UPDATE_REMOTE,
        branch: APP_UPDATE_BRANCH,
      },
      publicPullRequests: {
        enabled: !PUBLIC_PR_CHECK_DISABLED,
        repository: PUBLIC_PR_REPOSITORY,
      },
      publicRelease: {
        enabled: !PUBLIC_RELEASE_CHECK_DISABLED,
        repository: PUBLIC_RELEASE_REPOSITORY,
        branch: PUBLIC_RELEASE_BRANCH,
      },
      workspaceCreate: {
        enabled: true,
        defaultRoot: workspaceRegistryService.defaultCreateRoot(),
        roots: workspaceRegistryService.createRoots(),
      },
      hermesPlugin: {
        id: "codex-mobile",
        manifestPath: "/api/v1/hermes/plugin/manifest",
        workspaceRegistrationPath: "/api/v1/hermes/plugin/workspaces",
        callbackRegistrationPath: "/api/v1/hermes/plugin/callbacks",
        originRegistrationPath: "/api/v1/hermes/plugin/origins",
        launchPath: "/api/v1/hermes/plugin/launch",
        sessionPath: "/api/v1/hermes/plugin/session",
        notificationDelegatePath: "/api/v1/hermes/plugin/notifications",
        notificationDelegateConfigured: hermesNotificationDelegateService.isConfiguredForWorkspace("owner"),
      },
    });
    return;
  }
  if (url.pathname === "/api/codex-profiles" && req.method === "GET") {
    sendJson(res, 200, codexProfileService.profiles({
      activeQuota: { rateLimits: activeRateLimits(), rateLimitsByModel: rateLimitsByModelObject() },
    }));
    return;
  }
  if (url.pathname === "/api/codex-profiles/active" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const profile = codexProfileService.setActiveProfile(body.profileId || body.id || "");
      const restart = sharedChainRestartService.restart(Object.assign({
        delayMs: SHARED_CHAIN_RESTART_DELAY_MS,
      }, activeProfileRestartOptions(profile)));
      sendJson(res, 202, Object.assign({ ok: true, activeProfileId: profile.id, profile }, restart));
    } catch (err) {
      sendJson(res, err.statusCode || 500, { error: err.message || String(err) });
    }
    return;
  }
  if (url.pathname === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    if (!DISABLE_AUTH && !timingSafeEquals(body.key, AUTH_KEY)) {
      sendJson(res, 401, { error: "Invalid key" });
      return;
    }
    res.writeHead(204, {
      "Set-Cookie": `codex_mobile_key=${encodeURIComponent(body.key || "")}; Path=/; Max-Age=31536000; SameSite=Lax`,
      "Cache-Control": "no-store",
    });
    res.end();
    return;
  }
  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }
  if (url.pathname === "/api/v1/hermes/plugin/session" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const session = hermesPluginService.createSession(Object.assign({}, body, {
        token: body.codexPluginLaunch || body.pluginLaunch || body.launchToken || body.token || requestAuthToken(req),
      }));
      sendJson(res, 200, session);
    } catch (err) {
      sendJson(res, err.statusCode || 400, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  if (url.pathname === "/api/v1/hermes/plugin/workspaces" && req.method === "POST") {
    if (!isAccessKeyAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: "Codex Mobile access key is required" });
      return;
    }
    try {
      const body = await readBody(req);
      const registration = hermesPluginService.registerWorkspace(body);
      sendJson(res, 200, { ok: true, registration });
    } catch (err) {
      sendJson(res, err.statusCode || 400, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  if (url.pathname === "/api/v1/hermes/plugin/callbacks" && req.method === "POST") {
    if (!isAccessKeyAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: "Codex Mobile access key is required" });
      return;
    }
    try {
      const body = await readBody(req);
      const registration = hermesPluginService.registerWorkspace(body);
      sendJson(res, 200, { ok: true, registration });
    } catch (err) {
      sendJson(res, err.statusCode || 400, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  if (url.pathname === "/api/v1/hermes/plugin/origins" && req.method === "POST") {
    if (!isAccessKeyAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: "Codex Mobile access key is required" });
      return;
    }
    try {
      const body = await readBody(req);
      const registration = hermesPluginService.registerOrigin(body);
      sendJson(res, 200, {
        ok: true,
        registration,
        frame_ancestors: hermesPluginService.frameAncestors(),
      });
    } catch (err) {
      sendJson(res, err.statusCode || 400, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  if (url.pathname === "/api/v1/hermes/plugin/registration" && req.method === "GET") {
    const registration = hermesPluginService.registration({
      workspaceId: url.searchParams.get("workspaceId") || url.searchParams.get("workspace_id") || "owner",
    });
    sendJson(res, 200, { ok: true, registration });
    return;
  }
  if (url.pathname === "/api/v1/hermes/plugin/launch" && req.method === "POST") {
    if (!isAccessKeyAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: "Codex Mobile access key is required" });
      return;
    }
    try {
      const body = await readBody(req);
      sendJson(res, 200, hermesPluginService.createLaunch(body));
    } catch (err) {
      sendJson(res, err.statusCode || 400, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  if (url.pathname === "/api/v1/hermes/plugin/notifications" && req.method === "POST") {
    if (!isAccessKeyAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: "Codex Mobile access key is required" });
      return;
    }
    try {
      const body = await readBody(req);
      sendJson(res, 200, await hermesNotificationDelegateService.send(body));
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  if (url.pathname === "/api/client-events" && req.method === "POST") {
    const body = await readBody(req);
    const event = String(body.event || "event").slice(0, 80);
    const details = body.details && typeof body.details === "object" ? body.details : {};
    logClientEvent(event, {
      threadId: body.threadId || "",
      path: body.path || "",
      details,
      userAgent: String(req.headers["user-agent"] || "").slice(0, 160),
    });
    res.writeHead(204, { "Cache-Control": "no-store" });
    res.end();
    return;
  }
  if (url.pathname === "/api/app-update/status" && req.method === "GET") {
    const shouldFetch = /^(1|true|yes|on)$/i.test(url.searchParams.get("fetch") || "");
    const force = /^(1|true|yes|on)$/i.test(url.searchParams.get("force") || "");
    sendJson(res, 200, await refreshAppUpdateStatus({ fetch: shouldFetch, force }));
    return;
  }
  if (url.pathname === "/api/app-update/apply" && req.method === "POST") {
    try {
      const result = await applyAppUpdate();
      sendJson(res, 200, result);
      if (result && result.updated) scheduleAppRestart("app update applied");
    } catch (err) {
      sendJson(res, err.statusCode || 500, { error: safeAppUpdateError(err) });
    }
    return;
  }
  if (url.pathname === "/api/public-pull-requests/status" && req.method === "GET") {
    const force = /^(1|true|yes|on)$/i.test(url.searchParams.get("force") || "");
    sendJson(res, 200, await refreshPublicPullRequestStatus({ force }));
    return;
  }
  if (url.pathname === "/api/public-release/status" && req.method === "GET") {
    const force = /^(1|true|yes|on)$/i.test(url.searchParams.get("force") || "");
    sendJson(res, 200, await refreshPublicReleaseStatus({ force }));
    return;
  }
  if (url.pathname === "/api/restart/shared-chain" && req.method === "POST") {
    try {
      const result = sharedChainRestartService.restart(Object.assign({
        delayMs: SHARED_CHAIN_RESTART_DELAY_MS,
      }, activeProfileRestartOptions()));
      sendJson(res, 202, result);
    } catch (err) {
      sendJson(res, err.statusCode || 500, { error: err.message || String(err) });
    }
    return;
  }
  if (url.pathname === "/api/push/vapid-public-key" && req.method === "GET") {
    const keys = loadPushVapidKeys();
    sendJson(res, 200, { publicKey: keys.publicKey, subject: keys.subject || PUSH_SUBJECT });
    return;
  }
  if (url.pathname === "/api/push/subscribe" && req.method === "POST") {
    const body = await readBody(req);
    const subscription = normalizePushSubscription(body);
    const subscriptions = loadPushSubscriptions();
    const next = subscriptions.filter((entry) => entry.endpoint !== subscription.endpoint);
    next.push(Object.assign({}, subscription, {
      createdAt: subscriptions.some((entry) => entry.endpoint === subscription.endpoint)
        ? subscriptions.find((entry) => entry.endpoint === subscription.endpoint).createdAt || new Date().toISOString()
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userAgent: String(req.headers["user-agent"] || ""),
    }));
    savePushSubscriptions(next);
    sendJson(res, 200, { ok: true, subscriptionCount: next.length });
    return;
  }
  if (url.pathname === "/api/push/unsubscribe" && req.method === "POST") {
    const body = await readBody(req);
    const endpoint = String(body.endpoint || (body.subscription && body.subscription.endpoint) || "");
    if (!endpoint) {
      sendJson(res, 400, { error: "Push subscription endpoint is required" });
      return;
    }
    const next = loadPushSubscriptions().filter((entry) => entry.endpoint !== endpoint);
    savePushSubscriptions(next);
    sendJson(res, 200, { ok: true, subscriptionCount: next.length });
    return;
  }
  if (url.pathname === "/api/push/test" && req.method === "POST") {
    const result = await sendWebPushToAll({
      title: "Codex Mobile Web",
      body: "Test notification",
      data: { url: "/" },
    });
    sendJson(res, 200, Object.assign({ ok: true }, result));
    return;
  }
  if (url.pathname === "/api/status") {
    await codex.ensure().catch((err) => {
      codex.lastError = err.message;
    });
    loadRecentRateLimitsFromRollouts();
    sendJson(res, 200, codex.status());
    return;
  }
  if (url.pathname === "/api/uploads/file" && req.method === "GET") {
    serveUploadedFile(req, res);
    return;
  }
  if (url.pathname === "/api/generated-images/file" && req.method === "GET") {
    serveGeneratedImageFile(req, res);
    return;
  }
  if (url.pathname === "/api/files/preview" && req.method === "GET") {
    const requestedPath = url.searchParams.get("path") || "";
    const threadId = url.searchParams.get("threadId") || "";
    try {
      const allowedRoots = previewRootsForThread(threadId);
      sendJson(res, 200, readFilePreview(requestedPath, allowedRoots, { threadId }));
    } catch (err) {
      sendJson(res, err.statusCode || 500, { error: err.message || String(err) });
    }
    return;
  }
  if (url.pathname === "/api/files/preview/content" && req.method === "GET") {
    const requestedPath = url.searchParams.get("path") || "";
    const threadId = url.searchParams.get("threadId") || "";
    try {
      const allowedRoots = previewRootsForThread(threadId);
      serveFilePreviewContent(req, res, requestedPath, allowedRoots);
    } catch (err) {
      sendJson(res, err.statusCode || 500, { error: err.message || String(err) });
    }
    return;
  }
  if (url.pathname === "/api/app-server/reconnect" && req.method === "POST") {
    codex.resetConnection("manual app-server reconnect requested");
    await new Promise((resolve) => setTimeout(resolve, 350));
    await codex.ensure().catch((err) => {
      codex.lastError = err.message;
    });
    sendJson(res, 200, codex.status());
    return;
  }
  if (url.pathname === "/api/approvals" && req.method === "GET") {
    sendJson(res, 200, { data: codex.pendingServerRequests() });
    return;
  }
  const approvalResponse = url.pathname.match(/^\/api\/approvals\/([^/]+)$/);
  if (approvalResponse && req.method === "POST") {
    const requestId = decodeURIComponent(approvalResponse[1]);
    const body = await readBody(req);
    const request = codex.answerServerRequest(requestId, body);
    sendJson(res, 200, { ok: true, request });
    return;
  }
  if (url.pathname === "/api/thread-task-cards" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const sourceSummary = readStateDbThread(body.sourceThreadId) || readStartedThread(body.sourceThreadId);
      const requestedTargetIds = Array.isArray(body.targetThreadIds) && body.targetThreadIds.length
        ? body.targetThreadIds
        : [body.targetThreadId];
      const targetWorkspaceIds = Object.assign({}, body.targetWorkspaceIds && typeof body.targetWorkspaceIds === "object" ? body.targetWorkspaceIds : {});
      for (const targetThreadId of requestedTargetIds) {
        const id = String(targetThreadId || "").trim();
        if (!id || targetWorkspaceIds[id]) continue;
        const targetSummary = readStateDbThread(id) || readStartedThread(id);
        targetWorkspaceIds[id] = body.targetWorkspaceId || body.targetWorkspace || (targetSummary && targetSummary.cwd) || "";
      }
      const cards = await threadTaskCardService.createMany(Object.assign({}, body, {
        sourceWorkspaceId: body.sourceWorkspaceId || body.sourceWorkspace || (sourceSummary && sourceSummary.cwd) || "",
        targetWorkspaceIds,
        sourceThreadTitle: body.sourceThreadTitle || (sourceSummary && (sourceSummary.name || sourceSummary.preview || sourceSummary.id)) || body.sourceThreadId || "",
      }));
      sendJson(res, 200, {
        ok: true,
        card: cards[0] || null,
        cards,
      });
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  const threadTaskCardRead = url.pathname.match(/^\/api\/thread-task-cards\/([^/]+)$/);
  if (threadTaskCardRead && req.method === "GET") {
    try {
      const cardId = decodeURIComponent(threadTaskCardRead[1]);
      const threadId = url.searchParams.get("threadId") || "";
      sendJson(res, 200, { ok: true, card: threadTaskCardService.get(cardId, threadId) });
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  const threadTaskCardApprove = url.pathname.match(/^\/api\/thread-task-cards\/([^/]+)\/approve$/);
  if (threadTaskCardApprove && req.method === "POST") {
    try {
      const cardId = decodeURIComponent(threadTaskCardApprove[1]);
      const body = await readBody(req);
      sendJson(res, 200, Object.assign({ ok: true }, await threadTaskCardService.approve(cardId, body.threadId || body.actorThreadId || "")));
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  const threadTaskCardDelete = url.pathname.match(/^\/api\/thread-task-cards\/([^/]+)\/delete$/);
  if (threadTaskCardDelete && req.method === "POST") {
    try {
      const cardId = decodeURIComponent(threadTaskCardDelete[1]);
      const body = await readBody(req);
      sendJson(res, 200, {
        ok: true,
        card: await threadTaskCardService.deleteCard(cardId, body.threadId || body.actorThreadId || ""),
      });
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  const threadTaskCardRevoke = url.pathname.match(/^\/api\/thread-task-cards\/([^/]+)\/revoke$/);
  if (threadTaskCardRevoke && req.method === "POST") {
    try {
      const cardId = decodeURIComponent(threadTaskCardRevoke[1]);
      const body = await readBody(req);
      sendJson(res, 200, {
        ok: true,
        card: await threadTaskCardService.revoke(cardId, body.threadId || body.actorThreadId || ""),
      });
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  const threadTaskCardReply = url.pathname.match(/^\/api\/thread-task-cards\/([^/]+)\/reply$/);
  if (threadTaskCardReply && req.method === "POST") {
    try {
      const cardId = decodeURIComponent(threadTaskCardReply[1]);
      const body = await readBody(req);
      const actorThreadId = body.threadId || body.actorThreadId || "";
      const actorSummary = readStateDbThread(actorThreadId) || readStartedThread(actorThreadId);
      sendJson(res, 200, Object.assign({ ok: true }, await threadTaskCardService.reply(cardId, actorThreadId, Object.assign({}, body, {
        sourceWorkspaceId: body.sourceWorkspaceId || (actorSummary && actorSummary.cwd) || "",
        sourceThreadId: body.sourceThreadId || actorThreadId,
        sourceThreadTitle: body.sourceThreadTitle || (actorSummary && (actorSummary.name || actorSummary.preview || actorSummary.id)) || actorThreadId,
      }))));
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  if (url.pathname === "/api/workspaces" && req.method === "GET") {
    sendJson(res, 200, { data: await listWorkspaces() });
    return;
  }
  if (url.pathname === "/api/workspaces" && req.method === "POST") {
    try {
      const body = await readBody(req);
      sendJson(res, 200, workspaceRegistryService.create(body));
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  if (url.pathname === "/api/thread-continuations" && req.method === "POST") {
    const body = await readBody(req);
    const job = createContinuationJob(body);
    sendJson(res, 202, publicContinuationJob(job));
    return;
  }
  const continuationJobMatch = url.pathname.match(/^\/api\/thread-continuations\/([^/]+)$/);
  if (continuationJobMatch && req.method === "GET") {
    pruneContinuationJobs();
    const jobId = decodeURIComponent(continuationJobMatch[1]);
    const job = continuationJobs.get(jobId);
    if (!job) {
      sendJson(res, 404, { error: "Continuation job not found" });
      return;
    }
    sendJson(res, 200, publicContinuationJob(job));
    return;
  }
  if (url.pathname === "/api/threads" && req.method === "POST") {
    const body = await readBody(req);
    try {
      sendJson(res, 200, await startThreadFromRequestBody(body));
    } catch (err) {
      sendJson(res, err.statusCode || 500, { error: err.message || String(err) });
    }
    return;
  }
  if (url.pathname === "/api/threads/new-message" && req.method === "POST") {
    const { fields: body, uploads } = await readMessageBody(req, "new-thread");
    const cwd = String(body.cwd || "").trim();
    const text = String(body.text || "").trim();
    const requestedModel = MODEL_OPTIONS.includes(String(body.model || "").trim())
      ? String(body.model || "").trim()
      : "";
    const requestedEffort = REASONING_EFFORT_OPTIONS.includes(String(body.effort || "").trim())
      ? String(body.effort || "").trim()
      : "";
    const requestedFastMode = requestedCodexFastMode(body.fastMode);
    const input = buildTurnInput(text, uploads);
    const persistExtendedHistory = persistExtendedHistoryForUploads(uploads);
    if (!cwd) {
      sendJson(res, 400, { error: "Workspace is required to start a new thread" });
      return;
    }
    if (!input.length) {
      sendJson(res, 400, { error: "Message text or attachment is required" });
      return;
    }
    const globalState = readGlobalState();
    const visibility = visibilityFromGlobalState(globalState);
    if (visibility.workspaceKeys.size > 0 && !visibility.workspaceKeys.has(normalizeFsPath(cwd))) {
      sendJson(res, 403, { error: "Workspace is not visible in Codex Desktop" });
      return;
    }
    const submissionKeys = messageSubmissionKeys("new-thread", body, text, uploads);
    try {
      const result = await runMessageSubmissionOnce(submissionKeys, uploads, async () => {
        const runtimeSettings = applyPermissionModeOverride({}, body.permissionMode, cwd);
        const startParams = applyStartThreadRuntimeSettings({
          cwd,
          modelProvider: null,
          config: {},
          developerInstructions: readStartThreadDeveloperInstructions(cwd) || "",
          personality: null,
          ephemeral: null,
          dynamicTools: null,
          mockExperimentalField: null,
          experimentalRawEvents: false,
          persistExtendedHistory,
        }, runtimeSettings);
        if (requestedModel) startParams.model = requestedModel;
        const startResult = await codex.request("thread/start", startParams, {
          timeoutMs: MUTATION_RPC_TIMEOUT_MS,
          retry: false,
        });
        const threadId = threadIdFromStartResult(startResult);
        if (!threadId) throw new Error("New thread creation failed: app-server did not return threadId");
        const turnParams = applyCodexFastServiceTier(applyTurnRuntimeSettings({
          threadId,
          input,
          cwd,
        }, runtimeSettings), requestedFastMode);
        if (requestedModel) turnParams.model = requestedModel;
        if (requestedEffort) turnParams.effort = requestedEffort;
        const turnResult = await codex.request("turn/start", turnParams, {
          timeoutMs: MUTATION_RPC_TIMEOUT_MS,
          retry: false,
        });
        const thread = rememberStartedThread(Object.assign(
          {},
          (startResult && startResult.thread) || (startResult && startResult.data && startResult.data.thread) || {},
          {
            id: threadId,
            preview: text || path.basename(cwd) || "新建对话",
            cwd,
            status: { type: "active" },
            turns: [],
          },
        ));
        return {
          ok: true,
          threadId,
          thread,
          turnId: (turnResult && (turnResult.turnId || turnResult.id || turnResult.turn && turnResult.turn.id)) || "",
          result: turnResult,
          startResult,
        };
      });
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, err.statusCode || 500, { error: err.message || String(err) });
    }
    return;
  }
  const threadArchive = url.pathname.match(/^\/api\/threads\/([^/]+)\/archive$/);
  if (threadArchive && req.method === "POST") {
    const threadId = decodeURIComponent(threadArchive[1]);
    const visibility = visibilityFromGlobalState();
    const result = await archiveThreadId(threadId, visibility);
    sendJson(res, 200, result || { archived: true });
    return;
  }
  if (url.pathname === "/api/threads" && req.method === "GET") {
    const globalState = readGlobalState();
    const visibility = visibilityFromGlobalState(globalState);
    const cwd = url.searchParams.get("cwd") || null;
    const archivedParam = url.searchParams.get("archived");
    const archived = archivedParam === "true";
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || "80")));
    const cursor = url.searchParams.get("cursor") || null;
    const searchTerm = url.searchParams.get("search") || null;
    if (cwd && !visibility.workspaceKeys.has(normalizeFsPath(cwd))) {
      sendJson(res, 200, { data: [] });
      return;
    }
    const params = {
      cursor,
      limit: cursor ? limit : Math.max(limit, 500),
      sortKey: "updated_at",
      sortDirection: "desc",
      archived,
      useStateDbOnly: true,
      sourceKinds: [],
    };
    if (searchTerm) params.searchTerm = searchTerm;
    try {
      const appServerResult = filterThreadListByCwd(
        filterVisibleThreads(await codex.request("thread/list", params, { timeoutMs: READ_RPC_TIMEOUT_MS }), globalState),
        cwd,
      );
      const fallback = [
        ...readStateDbFallback(limit, { cwd, searchTerm, globalState }),
        ...readSessionIndexFallback(limit, { cwd, searchTerm, globalState }),
      ].slice(0, limit);
      const result = mergeThreadListFallback(appServerResult, fallback, limit);
      threadDisplaySummaryCache.rememberList(result);
      if (Array.isArray(result.data)) result.data = result.data.slice(0, limit);
      if (Array.isArray(result.threads)) result.threads = result.threads.slice(0, limit);
      sendJson(res, 200, tokenUsageStatsService.decorateThreadListResult(
        attachThreadTaskCardCountsToThreadListResult(result),
        { cwd, days: 31, workspaceCwds: tokenUsageWorkspaceCwds(globalState) },
      ));
    } catch (err) {
      const fallback = [
        ...readStateDbFallback(limit, { cwd, searchTerm, globalState }),
        ...readSessionIndexFallback(limit, { cwd, searchTerm, globalState }),
      ].slice(0, limit);
      if (fallback.length) {
        sendJson(res, 200, tokenUsageStatsService.decorateThreadListResult({
          data: fallback.map(attachThreadTaskCardCountsToSummary),
          mobileFallback: true,
          warning: err.message || String(err),
        }, { cwd, days: 31, workspaceCwds: tokenUsageWorkspaceCwds(globalState) }));
        return;
      }
      throw err;
    }
    return;
  }
  const threadRename = url.pathname.match(/^\/api\/threads\/([^/]+)\/name$/);
  if (threadRename && (req.method === "PATCH" || req.method === "POST")) {
    const threadId = decodeURIComponent(threadRename[1]);
    const body = await readBody(req);
    const name = String(body.name || body.title || "").trim();
    if (!threadId) {
      sendJson(res, 400, { error: "Thread id is required" });
      return;
    }
    if (!name) {
      sendJson(res, 400, { error: "Thread name is required" });
      return;
    }
    if (name.length > 120) {
      sendJson(res, 400, { error: "Thread name is too long" });
      return;
    }
    try {
      const updated = await tryUpdateThreadTitle(threadId, name);
      if (!updated) {
        sendJson(res, 501, { error: "Thread rename is not supported by this app-server" });
        return;
      }
      sendJson(res, 200, { ok: true, threadId, name });
    } catch (err) {
      sendJson(res, err.statusCode || 500, { error: err.message || String(err) });
    }
    return;
  }
  const threadRead = url.pathname.match(/^\/api\/threads\/([^/]+)$/);
  if (threadRead && req.method === "GET") {
    const threadId = decodeURIComponent(threadRead[1]);
    const requestStartedAtMs = Date.now();
    const threadLog = (event, details = {}) => logThreadDetail(event, Object.assign({
      threadId,
      elapsedMs: Date.now() - requestStartedAtMs,
    }, details));
    threadLog("start", {
      transport: codex.transportKind,
      ready: codex.ready,
    });
    const globalState = readGlobalState();
    const visibility = visibilityFromGlobalState(globalState);
    let summary = readStateDbThread(threadId);
    let summarySource = summary ? "state-db" : "none";
    if (!summary) {
      summary = readStartedThread(threadId);
      summarySource = summary ? "started-cache" : "none";
    }
    if (!summary) {
      const summaryStartedAtMs = Date.now();
      threadLog("summary_app_server_start");
      try {
        summary = await readThreadSummaryFromAppServer(codex, threadId);
        summarySource = summary ? "app-server" : "none";
        threadLog("summary_app_server_ok", {
          durationMs: Date.now() - summaryStartedAtMs,
          found: Boolean(summary),
        });
      } catch (err) {
        threadLog("summary_app_server_error", {
          durationMs: Date.now() - summaryStartedAtMs,
          error: err.message || String(err),
        });
      }
    } else {
      const summaryStartedAtMs = Date.now();
      threadLog("summary_app_server_refresh_start", { baseSource: summarySource });
      try {
        const appServerSummary = await readThreadSummaryFromAppServer(codex, threadId);
        if (appServerSummary) {
          summary = mergeThreadDisplaySummary(summary, appServerSummary);
          summarySource = `${summarySource}+app-server`;
        }
        threadLog("summary_app_server_refresh_ok", {
          durationMs: Date.now() - summaryStartedAtMs,
          found: Boolean(appServerSummary),
        });
      } catch (err) {
        threadLog("summary_app_server_refresh_error", {
          durationMs: Date.now() - summaryStartedAtMs,
          error: err.message || String(err),
        });
      }
    }
    threadLog("summary_ready", {
      source: summarySource,
      title: summary && (summary.name || summary.preview || ""),
      rolloutSizeBytes: summary ? threadRolloutSizeBytes(summary) : null,
      status: summary && summary.status ? summary.status.type || summary.status : null,
    });
    const runtimeSettings = threadRuntimeSettings(threadId, summary);
    if (summary && isHiddenThread(summary, visibility)) {
      threadLog("hidden", { status: 404 });
      sendJson(res, 404, { error: "Thread is archived, deleted, or outside visible workspaces" });
      threadLog("complete", { status: 404, mode: "hidden" });
      return;
    }
    if (summary && shouldSkipThreadDetailRpc(summary)) {
      threadLog("skip_detail_rpc", {
        mode: "large-rollout-turns-list",
        rolloutSizeBytes: threadRolloutSizeBytes(summary),
        thresholdBytes: THREAD_DETAIL_ROLLOUT_MAX_BYTES,
      });
      try {
        const result = await turnsListThreadReadResult(threadId, summary, runtimeSettings, "", "large-rollout-turns-list", threadLog);
        if (isHiddenThread(result.thread, visibility)) {
          threadLog("turns_list_hidden", { status: 404, mode: "large-rollout-turns-list" });
          sendJson(res, 404, { error: "Thread is archived, deleted, or outside visible workspaces" });
          return;
        }
        sendJson(res, 200, result);
        threadLog("complete", { status: 200, mode: "large-rollout-turns-list" });
      } catch (turnsErr) {
        threadLog("turns_list_error", {
          timeout: isReadTimeoutError(turnsErr),
          error: turnsErr.message || String(turnsErr),
          fallbackFrom: "large-rollout-turns-list",
        });
        if (isUnmaterializedThreadError(turnsErr)) {
          sendJson(res, 200, fallbackThreadReadResult(threadId, summary, runtimeSettings, turnsErr.message || String(turnsErr), "unmaterialized"));
          threadLog("complete", { status: 200, mode: "unmaterialized" });
          return;
        }
        const fallbackWarning = `large rollout; thread/turns/list failed: ${turnsErr.message || String(turnsErr)}`;
        sendJson(res, 200, fallbackThreadReadResult(threadId, summary, runtimeSettings, fallbackWarning, "summary-large-rollout-fallback"));
        threadLog("complete", { status: 200, mode: "summary-large-rollout-fallback" });
      }
      return;
    }
    const readStartedAtMs = Date.now();
    threadLog("thread_read_start", {
      timeoutMs: READ_RPC_TIMEOUT_MS,
      maxTurns: MAX_FULL_THREAD_TURNS,
    });
    try {
      const result = compactThreadReadResult(await codex.request("thread/read", { threadId, includeTurns: true }, {
        timeoutMs: READ_RPC_TIMEOUT_MS,
        retry: false,
        resetOnTimeout: false,
      }), { maxTurns: MAX_FULL_THREAD_TURNS });
      if (result.thread) {
        threadDisplaySummaryCache.remember(result.thread);
        result.thread = mergeThreadRuntimeFromStateDb(result.thread, summary);
        result.thread.runtimeSettings = publicRuntimeSettings(runtimeSettings);
        result.thread.mobileReadMode = "thread-read";
      }
      if (isHiddenThread(result.thread, visibility)) {
        threadLog("thread_read_hidden", {
          durationMs: Date.now() - readStartedAtMs,
          status: 404,
        });
        sendJson(res, 404, { error: "Thread is archived, deleted, or outside visible workspaces" });
        return;
      }
      threadLog("thread_read_ok", {
        durationMs: Date.now() - readStartedAtMs,
        returnedTurns: result.thread && Array.isArray(result.thread.turns) ? result.thread.turns.length : null,
        omittedTurns: result.thread && result.thread.mobileOmittedTurnCount ? result.thread.mobileOmittedTurnCount : 0,
      });
      sendJson(res, 200, await prepareThreadTaskCardsToResult(result));
      threadLog("complete", { status: 200, mode: "thread-read" });
    } catch (readErr) {
      threadLog("thread_read_error", {
        durationMs: Date.now() - readStartedAtMs,
        timeout: isReadTimeoutError(readErr),
        error: readErr.message || String(readErr),
      });
      const turnsStartedAtMs = Date.now();
      threadLog("turns_list_start", {
        limit: MAX_THREAD_TURNS,
        timeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS,
        fallbackFrom: "thread-read",
      });
      try {
        const result = await turnsListThreadReadResult(
          threadId,
          summary,
          runtimeSettings,
          `thread/read failed: ${readErr.message || String(readErr)}`,
          "turns-list",
          null,
        );
        if (isHiddenThread(result.thread, visibility)) {
          threadLog("turns_list_hidden", {
            durationMs: Date.now() - turnsStartedAtMs,
            status: 404,
          });
          sendJson(res, 404, { error: "Thread is archived, deleted, or outside visible workspaces" });
          return;
        }
        threadLog("turns_list_ok", {
          durationMs: Date.now() - turnsStartedAtMs,
          returnedTurns: result.thread && Array.isArray(result.thread.turns) ? result.thread.turns.length : null,
          mode: result.thread && result.thread.mobileReadMode ? result.thread.mobileReadMode : "turns-list",
        });
        sendJson(res, 200, result);
        threadLog("complete", { status: 200, mode: "turns-list" });
      } catch (turnsErr) {
        threadLog("turns_list_error", {
          durationMs: Date.now() - turnsStartedAtMs,
          timeout: isReadTimeoutError(turnsErr),
          error: turnsErr.message || String(turnsErr),
        });
        if (isUnmaterializedThreadError(turnsErr)) {
          sendJson(res, 200, fallbackThreadReadResult(threadId, summary, runtimeSettings, turnsErr.message || String(turnsErr), "unmaterialized"));
          threadLog("complete", { status: 200, mode: "unmaterialized" });
          return;
        }

        if (isReadTimeoutError(turnsErr)) {
          sendJson(res, 200, fallbackThreadReadResult(threadId, summary, runtimeSettings, turnsErr.message || String(turnsErr), "summary-timeout-fallback"));
          threadLog("complete", { status: 200, mode: "summary-timeout-fallback" });
          return;
        }

        const mode = isReadTimeoutError(turnsErr) ? "summary-timeout-fallback" : "summary-error-fallback";
        sendJson(res, 200, fallbackThreadReadResult(
          threadId,
          summary,
          runtimeSettings,
          `thread/read failed: ${readErr.message || String(readErr)}; thread/turns/list failed: ${turnsErr.message || String(turnsErr)}`,
          mode,
        ));
        threadLog("complete", { status: 200, mode });
      }
    }
    return;
  }
  const threadTurns = url.pathname.match(/^\/api\/threads\/([^/]+)\/turns$/);
  if (threadTurns && req.method === "GET") {
    const threadId = decodeURIComponent(threadTurns[1]);
    const cursor = url.searchParams.get("cursor") || null;
    sendJson(res, 200, compactTurnsListResult(await codex.request("thread/turns/list", {
      threadId,
      cursor,
      limit: Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || String(MAX_THREAD_TURNS)))),
      sortDirection: url.searchParams.get("sortDirection") || "asc",
    }, { timeoutMs: READ_RPC_TIMEOUT_MS, retry: false, resetOnTimeout: false })));
    return;
  }
  const resume = url.pathname.match(/^\/api\/threads\/([^/]+)\/resume$/);
  if (resume && req.method === "POST") {
    const threadId = decodeURIComponent(resume[1]);
    const body = await readBody(req);
    const runtimeSettings = applyPermissionModeOverride(await resolveThreadRuntimeSettings(threadId), body.permissionMode, body.cwd || null);
    sendJson(res, 200, await codex.request("thread/resume", applyResumeRuntimeSettings({
      threadId,
      cwd: body.cwd || null,
      persistExtendedHistory: true,
    }, runtimeSettings), { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false }));
    return;
  }
  const messages = url.pathname.match(/^\/api\/threads\/([^/]+)\/messages$/);
  if (messages && req.method === "POST") {
    const threadId = decodeURIComponent(messages[1]);
    const { fields: body, uploads } = await readMessageBody(req, threadId);
    const text = String(body.text || "").trim();
    const input = buildTurnInput(text, uploads);
    const persistExtendedHistory = persistExtendedHistoryForUploads(uploads);
    if (!input.length) {
      logMessageSubmit("empty", {
        threadId,
        clientSubmissionId: body.clientSubmissionId,
        uploads: uploads.length,
      });
      sendJson(res, 400, { error: "Message text or attachment is required" });
      return;
    }
    logMessageSubmit("received", {
      threadId,
      textChars: text.length,
      uploads: uploads.length,
      activeTurnId: body.activeTurnId || "",
      clientSubmissionId: body.clientSubmissionId,
    });
    const submissionKeys = messageSubmissionKeys(threadId, body, text, uploads);
    const runtimeSettings = applyPermissionModeOverride(await resolveThreadRuntimeSettings(threadId), body.permissionMode, body.cwd || null);
    const requestedModel = MODEL_OPTIONS.includes(String(body.model || "").trim())
      ? String(body.model || "").trim()
      : "";
    const requestedEffort = REASONING_EFFORT_OPTIONS.includes(String(body.effort || "").trim())
      ? String(body.effort || "").trim()
      : "";
    const requestedFastMode = requestedCodexFastMode(body.fastMode);
    let result;
    try {
      result = await runMessageSubmissionOnce(submissionKeys, uploads, async () => {
        let skipTurnSteer = false;
        if (body.activeTurnId) {
          const stalePreflight = await staleActiveTurnPreflight(codex, threadId, String(body.activeTurnId));
          if (stalePreflight.stale) {
            skipTurnSteer = true;
            logMessageSubmit("active-turn-stale-preflight", {
              threadId,
              turnId: String(body.activeTurnId),
              clientSubmissionId: body.clientSubmissionId,
              reason: stalePreflight.reason,
              quietMs: stalePreflight.quietMs,
            });
            try {
              await codex.request("turn/interrupt", {
                threadId,
                turnId: String(body.activeTurnId),
              }, { timeoutMs: 20000, retry: false });
              await new Promise((resolve) => setTimeout(resolve, 250));
            } catch (err) {
              logMessageSubmit("active-turn-stale-interrupt-failed", {
                threadId,
                turnId: String(body.activeTurnId),
                clientSubmissionId: body.clientSubmissionId,
                error: err.message || String(err),
              });
            }
          }
        }
        if (body.activeTurnId && !skipTurnSteer) {
          let pendingSteerEchoKey = "";
          try {
            pendingSteerEchoKey = pendingSteerEchoStore.remember({
              threadId,
              turnId: String(body.activeTurnId),
              input,
              clientSubmissionId: body.clientSubmissionId,
            });
            const result = await codex.request("turn/steer", {
              threadId,
              input,
              expectedTurnId: String(body.activeTurnId),
            }, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
            codex.notifyMuxUserMessage({
              threadId,
              turnId: String(body.activeTurnId),
              input,
              clientSubmissionId: body.clientSubmissionId,
            });
            return result;
          } catch (err) {
            if (isTurnSteerUnsupportedError(err)) {
              codex.notifyMuxUserMessage({
                threadId,
                turnId: String(body.activeTurnId),
                input,
                clientSubmissionId: body.clientSubmissionId,
              });
              return {};
            }
            if (pendingSteerEchoKey) pendingSteerEchoStore.forget(pendingSteerEchoKey);
            if (!isStaleActiveTurnError(err)) throw err;
            logMessageSubmit("active-turn-stale", {
              threadId,
              turnId: String(body.activeTurnId),
              clientSubmissionId: body.clientSubmissionId,
              error: err.message || String(err),
            });
          }
        }
        try {
          await codex.request("thread/resume", applyResumeRuntimeSettings({
            threadId,
            cwd: body.cwd || null,
            persistExtendedHistory,
          }, runtimeSettings), { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
        } catch (err) {
          if (!/already|loaded|active/i.test(err.message || "")) throw err;
        }
        const params = applyCodexFastServiceTier(applyTurnRuntimeSettings({
          threadId,
          input,
        }, runtimeSettings), requestedFastMode);
        if (body.cwd) params.cwd = body.cwd;
        if (requestedModel) params.model = requestedModel;
        if (requestedEffort) params.effort = requestedEffort;
        return await codex.request("turn/start", params, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
      });
      logMessageSubmit("done", {
        threadId,
        clientSubmissionId: body.clientSubmissionId,
        resultTurnId: result && (result.turnId || result.id || result.turn && result.turn.id || ""),
      });
    } catch (err) {
      logMessageSubmit("failed", {
        threadId,
        clientSubmissionId: body.clientSubmissionId,
        error: err.message || String(err),
      });
      throw err;
    }
    sendJson(res, 200, result);
    return;
  }
  const interrupt = url.pathname.match(/^\/api\/threads\/([^/]+)\/turns\/([^/]+)\/interrupt$/);
  if (interrupt && req.method === "POST") {
    sendJson(res, 200, await codex.request("turn/interrupt", {
      threadId: decodeURIComponent(interrupt[1]),
      turnId: decodeURIComponent(interrupt[2]),
    }, { timeoutMs: 20000, retry: false }));
    return;
  }
  sendJson(res, 404, { error: "Not found" });
}

function handleEvents(req, res) {
  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }
  const url = getUrl(req);
  const client = {
    threadId: String(url.searchParams.get("threadId") || ""),
  };
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`data: ${JSON.stringify({ type: "status", status: codex.status() })}\n\n`);
  for (const request of codex.pendingServerRequests()) {
    res.write(`data: ${JSON.stringify({ type: "serverRequest", request })}\n\n`);
  }
  clients.set(res, client);
  const heartbeat = setInterval(() => {
    try {
      if (res.destroyed || res.writableEnded || !res.write(": keepalive\n\n")) {
        removeEventClient(res);
      }
    } catch (_) {
      removeEventClient(res);
    }
  }, 25000);
  clientHeartbeats.set(res, heartbeat);
  req.on("close", () => {
    removeEventClient(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = getUrl(req);
    if (url.pathname === "/api/events") {
      handleEvents(req, res);
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }
    serveStatic(req, res);
  } catch (err) {
    try {
      sendJson(res, 500, { error: err.message || String(err) });
    } catch (sendErr) {
      console.error(`[server] failed to send error response: ${sendErr.message || sendErr}`);
    }
  }
});

server.on("clientError", (err, socket) => {
  try {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  } catch (_) {}
  if (err && err.code === "ECONNRESET") return;
  console.error(`[server] client error: ${err.message || err}`);
});

process.on("uncaughtException", (err) => {
  console.error(`[server] uncaught exception: ${err && err.stack ? err.stack : err}`);
});

process.on("unhandledRejection", (err) => {
  console.error(`[server] unhandled rejection: ${err && err.stack ? err.stack : err}`);
});

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

function shutdown() {
  try {
    if (codex.ws) codex.ws.close();
  } catch (_) {}
  try {
    if (codex.child && codex.child.exitCode === null) codex.child.kill();
  } catch (_) {}
  process.exit(0);
}

function startServer() {
  server.listen(PORT, HOST, () => {
    console.log(`Codex Mobile Web listening on http://${HOST}:${PORT}`);
    if (REQUIRE_SHARED_APP_SERVER) {
      console.log(`Codex Mobile Web requires a shared app-server endpoint: ${MUX_ENDPOINT_FILE}`);
    } else {
      console.log(`Codex app-server will be managed on 127.0.0.1 when first used.`);
    }
    console.log(DISABLE_AUTH ? "Authentication disabled by CODEX_MOBILE_DISABLE_AUTH." : `Authentication enabled; key source is env CODEX_MOBILE_KEY or ${AUTH_KEY_FILE}.`);
    scheduleStartupAppUpdateCheck();
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  approvalResponsePayload,
  compactThread,
  enrichThreadItemTimestampsFromRollout,
  filePreviewContentDisposition,
  filePreviewContentType,
  generatedImageContentUrl,
  isHiddenThread,
  mergeThreadListFallback,
  mimeFor,
  previewRootsForThread,
  readFilePreview,
  readRolloutItemTimestampCandidates,
  resolveFilePreviewPath,
  publicServerRequest,
  serveFilePreviewContent,
  serverRequestResponsePayload,
  sortTurnsChronologically,
  stripMarkdownFileTarget,
  threadMatchesWorkspaceCwd,
};
