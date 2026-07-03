"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const net = require("node:net");
const {
  completedTurnHasNoFinalAgentMessage,
  createThreadDisplaySummaryCache,
  resolveThreadTitleForNotification,
  shouldTrackTurnForWebPush,
} = require("./adapters/push-notification-service");
const { createWebPushRuntimeService } = require("./adapters/web-push-runtime-service");
const { createSharedChainRestartService } = require("./adapters/shared-chain-restart-service");
const { createHermesNotificationDelegateService } = require("./adapters/hermes-notification-delegate-service");
const { createHomeAiAutonomousDeliveryReturnService } = require("./adapters/home-ai-autonomous-delivery-return-service");
const { runSqliteJson } = require("./adapters/sqlite-cli");
const { compactWorkspaceContext } = require("./adapters/continuation-handoff-compaction-service");
const { createContinuationThreadService } = require("./adapters/continuation-thread-service");
const { createMediaFileService } = require("./adapters/media-file-service");
const { createPendingSteerEchoStore } = require("./adapters/message-pending-echo-service");
const {
  detectStaleActiveTurnForSubmission,
} = require("./adapters/active-turn-staleness-service");
const {
  dedupeUserMessageEchoesInThread,
} = require("./adapters/thread-user-message-echo-normalizer-service");
const {
  attachTurnUsageSummaries,
  collectTurnUsageSummariesFromEntries,
  collectTurnUsageSummariesFromRolloutText,
} = require("./adapters/turn-usage-summary-service");
const { createRolloutEnrichmentIndexService } = require("./adapters/rollout-enrichment-index-service");
const { createTokenUsageStatsService } = require("./adapters/token-usage-stats-service");
const {
  buildTurnCompletionDetailMessage,
  finalReceiptTextFromParams,
} = require("./adapters/turn-completion-receipt-service");
const {
  normalizeRepositorySlug,
} = require("./adapters/public-pull-request-service");
const {
  cacheGeneratedImageDataUrl,
  cacheGeneratedImageForItem,
  imageViewSourcePath,
} = require("./adapters/generated-image-cache-service");
const {
  createMobileArchiveIndexService,
  normalizeThreadId,
} = require("./adapters/mobile-archive-index-service");
const { createHermesPluginService } = require("./adapters/hermes-plugin-service");
const { createThreadTaskCardService } = require("./adapters/thread-task-card-service");
const { createThreadTaskCardRouteService } = require("./adapters/thread-task-card-route-service");
const {
  isHomeAiDeployLaneThread,
  normalizeHomeAiDeployLaneSummary,
} = require("./adapters/thread-task-card-deploy-lane-policy-service");
const { createThreadSideChatService } = require("./adapters/thread-side-chat-service");
const {
  continuationGoalMigrationPlan,
  createThreadGoalService,
  normalizeThreadGoalStatus,
} = require("./adapters/thread-goal-service");
const { createWorkspaceRegistryService } = require("./adapters/workspace-registry-service");
const {
  createCodexProfileService,
  isRateLimitRolloutSourceAccountScoped,
  resolveActiveCodexHomeFromStore,
  resolveEffectiveCodexHome,
} = require("./adapters/codex-profile-service");
const { createCodexProfileSwitchService } = require("./adapters/codex-profile-switch-service");
const { createPublicConfigRuntimeCache } = require("./adapters/public-config-runtime-cache-service");
const { ensureCodexMobileMcpServer } = require("./adapters/codex-mobile-mcp-config-service");
const { ensureCodexProjectsTrusted } = require("./adapters/codex-project-trust-service");
const { createThreadDetailProjectionInputService } = require("./adapters/thread-detail-projection-input-service");
const { createThreadDetailProjectionResultService } = require("./adapters/thread-detail-projection-result-service");
const { createThreadDetailProjectionService } = require("./adapters/thread-detail-projection-service");
const { createThreadDetailProjectionV4Service } = require("./adapters/thread-detail-projection-v4-service");
const { compactThreadDetailResponseResult } = require("./adapters/thread-detail-response-budget-service");
const {
  appendLatestCompletedUserInputAnchors,
  collectRolloutUserInputAnchors,
} = require("./adapters/thread-detail-user-input-anchor-service");
const { createThreadDetailSummaryService } = require("./adapters/thread-detail-summary-service");
const { createThreadDetailBoundedReadPolicyService } = require("./adapters/thread-detail-bounded-read-policy-service");
const { createThreadDetailActiveOverlayProviderService } = require("./adapters/thread-detail-active-overlay-provider-service");
const { createThreadDetailActiveWindowPrewarmService } = require("./adapters/thread-detail-active-window-prewarm-service");
const { createThreadDetailTurnsListReadCoalescer } = require("./adapters/thread-detail-turns-list-read-coalescer-service");
const { attachThreadDetailDiagnostics } = require("./adapters/thread-detail-performance-service");
const { createThreadDetailReadOrchestrationService } = require("./adapters/thread-detail-read-orchestration-service");
const { handleThreadDetailReadRoute } = require("./adapters/thread-detail-route-service");
const { createThreadDetailResponsePreparationService } = require("./adapters/thread-detail-response-preparation-service");
const { createThreadListFallbackCacheService } = require("./adapters/thread-list-fallback-cache-service");
const { createThreadListFallbackPersistentCacheStore } = require("./adapters/thread-list-fallback-persistent-cache-store");
const { createThreadListFallbackSourceService } = require("./adapters/thread-list-fallback-source-service");
const { createThreadSummaryStateService } = require("./adapters/thread-summary-state-service");
const {
  createThreadListFallbackPrewarmService,
  summarizePrewarmStatus,
} = require("./adapters/thread-list-fallback-prewarm-service");
const {
  mergeThreadListRouteResult,
} = require("./adapters/thread-list-route-merge-service");
const {
  createThreadListSummaryMergeService,
} = require("./adapters/thread-list-summary-merge-service");
const {
  createThreadListResponseCoalescer,
} = require("./adapters/thread-list-response-coalescer-service");
const {
  stripThreadListDetailFields,
  stripThreadListResultDetailFields,
} = require("./adapters/thread-list-summary-service");
const { createThreadTurnCompactionPolicyService } = require("./adapters/thread-turn-compaction-policy-service");
const { createThreadCompletionDiagnosticService } = require("./adapters/thread-completion-diagnostic-service");
const { createChatGptProBridgeService } = require("./adapters/chatgpt-pro-bridge-service");
const { createChatGptProPlannerService } = require("./adapters/chatgpt-pro-planner-service");
const { createChatGptProMcpService } = require("./adapters/chatgpt-pro-mcp-service");
const { createWorkspaceSourceWriteGuard } = require("./adapters/workspace-source-write-guard-service");
const { createThreadSideChatOrchestrationService } = require("./adapters/thread-side-chat-orchestration-service");
const { handleThreadSideChatRoute } = require("./adapters/thread-side-chat-route-service");
const { createThreadMessageRouteService } = require("./adapters/thread-message-route-service");
const { handleThreadListRoute } = require("./adapters/thread-list-route-service");
const { createCodexAppServerClient } = require("./adapters/codex-app-server-client-service");
const { createStaticFileService } = require("./adapters/static-file-service");
const { createRuntimeSettingsService } = require("./adapters/runtime-settings-service");
const { createCoreApiRouteService } = require("./adapters/core-api-route-service");
const { createAppMaintenanceService } = require("./adapters/app-maintenance-service");
const {
  createAutoTurnRecoveryService,
  turnStartResultTurnId,
} = require("./adapters/auto-turn-recovery-service");

const APP_ROOT = __dirname;
const PUBLIC_ROOT = path.join(APP_ROOT, "public");
const USER_HOME = process.env.USERPROFILE || process.env.HOME || process.cwd();

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function detectDevelopmentWorkspaceRoot(appRoot) {
  let current = path.resolve(String(appRoot || process.cwd()));
  while (current && current !== path.dirname(current)) {
    if (path.basename(current) === "HermesMobileDev") return current;
    current = path.dirname(current);
  }
  const fallbackRoots = uniqueStrings([
    process.env.HERMES_MOBILE_DEV_ROOT || "",
    "/Users/hermes-dev/HermesMobileDev",
  ]);
  for (const candidate of fallbackRoots) {
    const resolved = path.resolve(candidate);
    try {
      if (path.basename(resolved) === "HermesMobileDev" && fs.statSync(resolved).isDirectory()) {
        return resolved;
      }
    } catch (_) {}
  }
  return "";
}

function normalizePathForEarlyCompare(value) {
  return path.resolve(String(value || "")).toLowerCase();
}

function sameEarlyFsPath(left, right) {
  const a = String(left || "").trim();
  const b = String(right || "").trim();
  return Boolean(a && b && normalizePathForEarlyCompare(a) === normalizePathForEarlyCompare(b));
}

function defaultMuxEndpointFileForCodexHome(codexHome) {
  const home = String(codexHome || "").trim();
  return home ? path.join(path.resolve(home), "app-server-mux", "endpoint.json") : "";
}

function resolveMuxEndpointFile(env, codexHome, codexHomeResolution = {}) {
  const fallback = defaultMuxEndpointFileForCodexHome(codexHome);
  const configured = String(env && env.CODEX_MOBILE_MUX_ENDPOINT_FILE || "").trim();
  if (!configured) return fallback;
  const envCodexHome = codexHomeResolution && codexHomeResolution.envCodexHome || "";
  const staleEnvDefault = envCodexHome
    && codexHomeResolution.envCodexHomeIgnored
    && sameEarlyFsPath(configured, defaultMuxEndpointFileForCodexHome(envCodexHome))
    && !sameEarlyFsPath(configured, fallback);
  return staleEnvDefault ? fallback : path.resolve(configured);
}

const RUNTIME_ROOT = process.env.CODEX_MOBILE_RUNTIME_DIR || path.join(USER_HOME, ".codex-mobile-web");
const CODEX_PROFILE_BOOTSTRAP = resolveActiveCodexHomeFromStore({
  userHome: USER_HOME,
  runtimeRoot: RUNTIME_ROOT,
  env: process.env,
});
const DEFAULT_CODEX_HOME = path.join(USER_HOME, ".codex");
const CODEX_HOME_RESOLUTION = resolveEffectiveCodexHome({
  userHome: USER_HOME,
  runtimeRoot: RUNTIME_ROOT,
  env: process.env,
  defaultCodexHome: DEFAULT_CODEX_HOME,
  bootstrap: CODEX_PROFILE_BOOTSTRAP,
});
const CODEX_HOME = CODEX_HOME_RESOLUTION.codexHome;
const STATE_DB = path.join(CODEX_HOME, "state_5.sqlite");
const GOALS_DB = path.join(CODEX_HOME, "goals_1.sqlite");
const SESSIONS_DIR = path.join(CODEX_HOME, "sessions");
const ARCHIVED_SESSIONS_DIR = path.join(CODEX_HOME, "archived_sessions");
const MOBILE_ARCHIVED_THREAD_IDS_FILE = process.env.CODEX_MOBILE_ARCHIVED_THREAD_IDS_FILE
  || path.join(RUNTIME_ROOT, "archived-thread-ids.json");
const CODEX_EXE = resolveDefaultCodexExecutable();
const MUX_ENDPOINT_FILE = resolveMuxEndpointFile(process.env, CODEX_HOME, CODEX_HOME_RESOLUTION);
const EXTERNAL_APP_SERVER_WS = process.env.CODEX_MOBILE_APP_SERVER_WS || "";
const EXTERNAL_APP_SERVER_TCP = process.env.CODEX_MOBILE_APP_SERVER_TCP || "";
const REQUIRE_SHARED_APP_SERVER = /^(1|true|yes|on)$/i.test(process.env.CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER || "");
const DISABLE_MOBILE_OWNED_MUX = /^(1|true|yes|on)$/i.test(process.env.CODEX_MOBILE_DISABLE_OWNED_MUX || "");
const PERSIST_MOBILE_OWNED_MUX = /^(1|true|yes|on)$/i.test(process.env.CODEX_MOBILE_PERSIST_OWNED_MUX || "");
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
const GITHUB_LINK_PREVIEW_TIMEOUT_MS = Math.max(1000, Number(process.env.CODEX_MOBILE_GITHUB_LINK_PREVIEW_TIMEOUT_MS || "12000"));
const GITHUB_LINK_PREVIEW_CACHE_MS = Math.max(30_000, Number(process.env.CODEX_MOBILE_GITHUB_LINK_PREVIEW_CACHE_MS || "900000"));
const AUTO_TURN_RECOVERY_COOLDOWN_MS = Math.max(30_000, Number(process.env.CODEX_MOBILE_AUTO_TURN_RECOVERY_COOLDOWN_MS || "120000"));
const AUTO_TURN_RECOVERY_PROMPT = String(process.env.CODEX_MOBILE_AUTO_TURN_RECOVERY_PROMPT || "继续当前任务。上一轮可能因为 Codex Mobile Listener 或 app-server 重启而断开；请基于当前线程上下文继续未完成的工作，不要重复已经完成的内容。").trim();
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
const RUNTIME_SETTINGS_FILE = process.env.CODEX_MOBILE_SETTINGS_FILE
  || path.join(RUNTIME_ROOT, "settings.json");
const THREAD_SIDE_CHAT_FILE = process.env.CODEX_MOBILE_THREAD_SIDE_CHAT_FILE
  || path.join(RUNTIME_ROOT, "thread-side-chats.json");
const CHATGPT_PRO_BRIDGE_FILE = process.env.CODEX_MOBILE_CHATGPT_PRO_BRIDGE_FILE
  || path.join(RUNTIME_ROOT, "chatgpt-pro-bridge-state.json");
const CHATGPT_PRO_OUTPUT_DIR = process.env.CODEX_MOBILE_CHATGPT_PRO_OUTPUT_DIR
  || path.join(RUNTIME_ROOT, "outputs", "chatgpt-pro");
const CHATGPT_PRO_BRIDGE_ENABLED = !/^(1|true|yes|on)$/i.test(process.env.CODEX_MOBILE_DISABLE_CHATGPT_PRO_BRIDGE || "");
const CHATGPT_PRO_PLANNER_DIR = process.env.CODEX_MOBILE_CHATGPT_PRO_PLANNER_DIR
  || path.join(RUNTIME_ROOT, "chatgpt-pro-planner");
const CHATGPT_PRO_MCP_TOKEN = process.env.CODEX_MOBILE_CHATGPT_PRO_MCP_TOKEN || "";
const CHATGPT_PRO_MCP_TOKEN_FILE = process.env.CODEX_MOBILE_CHATGPT_PRO_MCP_TOKEN_FILE || "";
const CHATGPT_PRO_MCP_ALLOW_DIRECT_TASK_CARDS = /^(1|true|yes|on)$/i.test(process.env.CODEX_MOBILE_CHATGPT_PRO_MCP_ALLOW_DIRECT_TASK_CARDS || "");
const WORKSPACE_DELEGATION_ENV_DEFAULT = /^(1|true|yes|on)$/i.test(
  process.env.CODEX_MOBILE_ALLOW_WORKSPACE_DELEGATION
    || process.env.CODEX_MOBILE_WORKSPACE_DELEGATION_ENABLED
    || "",
);
const WORKSPACE_DELEGATION_WRITE_GUARD_DISABLED = /^(0|false|no|off)$/i.test(
  process.env.CODEX_MOBILE_WORKSPACE_DELEGATION_WRITE_GUARD || "",
) || /^(1|true|yes|on)$/i.test(
  process.env.CODEX_MOBILE_WORKSPACE_DELEGATION_DISABLE_WRITE_GUARD || "",
);
const WORKSPACE_DELEGATION_ENFORCE_SANDBOX_GUARD = /^(1|true|yes|on)$/i.test(
  process.env.CODEX_MOBILE_WORKSPACE_DELEGATION_ENFORCE_SANDBOX_GUARD || "",
);
const WORKSPACE_DELEGATION_APPROVAL_PROXY_ONLY = /^(1|true|yes|on)$/i.test(
  process.env.CODEX_MOBILE_WORKSPACE_DELEGATION_APPROVAL_PROXY_ONLY || "",
);
const WORKSPACE_DELEGATION_GUARD_EXEMPT_CWDS = process.env.CODEX_MOBILE_WORKSPACE_DELEGATION_GUARD_EXEMPT_CWDS || "";
const WORKSPACE_DELEGATION_GUARD_SELF_EXEMPTION_DISABLED = /^(1|true|yes|on)$/i.test(
  process.env.CODEX_MOBILE_WORKSPACE_DELEGATION_GUARD_DISABLE_SELF_EXEMPTION || "",
);
const WORKSPACE_DELEGATION_GUARD_PLATFORM_EXEMPTION_DISABLED = /^(1|true|yes|on)$/i.test(
  process.env.CODEX_MOBILE_WORKSPACE_DELEGATION_GUARD_DISABLE_PLATFORM_EXEMPTION || "",
);
const WORKSPACE_DELEGATION_TOOL_NAMESPACE = "codex_mobile";
const WORKSPACE_DELEGATION_TOOL_NAME = "delegate_to_thread";
const WORKSPACE_DELEGATION_TOOL_FULL_NAME = `${WORKSPACE_DELEGATION_TOOL_NAMESPACE}.${WORKSPACE_DELEGATION_TOOL_NAME}`;
const TASK_CARD_RETURN_TOOL_NAME = "return_to_source";
const TASK_CARD_RETURN_TOOL_FULL_NAME = `${WORKSPACE_DELEGATION_TOOL_NAMESPACE}.${TASK_CARD_RETURN_TOOL_NAME}`;
const THREAD_SIDE_CHAT_SCOPE_ID = CODEX_HOME_RESOLUTION.activeProfileId
  || `codex-home-${crypto.createHash("sha256").update(CODEX_HOME).digest("hex").slice(0, 16)}`;
const THREAD_SIDE_CHAT_REPLY_TIMEOUT_MS = Math.max(
  15_000,
  Number(process.env.CODEX_MOBILE_THREAD_SIDE_CHAT_REPLY_TIMEOUT_MS || String(3 * 60 * 1000)),
);
const THREAD_TASK_CARD_DRAFT_TAG = "codex-mobile-thread-task-card-draft";
const THREAD_TASK_CARD_BODY_MAX_CHARS = 8_000;
const THREAD_TASK_CARD_DRAFT_TURN_LOOKBACK = 4;
const WORKSPACE_REGISTRY_FILE = process.env.CODEX_MOBILE_WORKSPACE_REGISTRY_FILE
  || path.join(RUNTIME_ROOT, "workspace-registry.json");
const TOKEN_USAGE_STATS_DB = process.env.CODEX_MOBILE_TOKEN_USAGE_DB
  || path.join(RUNTIME_ROOT, "token-usage-stats.sqlite");
const TOKEN_USAGE_QUERY_CACHE_TTL_MS = Math.max(
  0,
  Math.min(60_000, Number(process.env.CODEX_MOBILE_TOKEN_USAGE_QUERY_CACHE_TTL_MS || "3000")),
);
const THREAD_DETAIL_PROJECTION_CACHE_DIR = process.env.CODEX_MOBILE_THREAD_DETAIL_PROJECTION_CACHE_DIR
  || path.join(RUNTIME_ROOT, "thread-detail-projections");
const THREAD_DETAIL_PROJECTION_POLICY_VERSION = "state-relevant-receipt-v3";
const THREAD_DETAIL_PROJECTION_V4_ENABLED = !/^(0|false|no|off)$/i.test(process.env.CODEX_MOBILE_THREAD_DETAIL_PROJECTION_V4 || "1");
const THREAD_DETAIL_RAW_ALL_ENABLED = /^(1|true|yes|on)$/i.test(process.env.CODEX_MOBILE_THREAD_DETAIL_RAW_ALL || "");
const WORKSPACE_CREATE_ROOTS = process.env.CODEX_MOBILE_WORKSPACE_CREATE_ROOTS || "";
const WORKSPACE_DEFAULT_CREATE_ROOT = process.env.CODEX_MOBILE_WORKSPACE_DEFAULT_CREATE_ROOT
  || detectDevelopmentWorkspaceRoot(APP_ROOT);
const SYNC_DESKTOP_WORKSPACES = /^(1|true|yes|on)$/i.test(process.env.CODEX_MOBILE_SYNC_DESKTOP_WORKSPACES || "");
const DESKTOP_GLOBAL_STATE_FILES = SYNC_DESKTOP_WORKSPACES
  ? uniqueStrings([
    process.env.CODEX_MOBILE_DESKTOP_GLOBAL_STATE_FILE || "",
    path.join(DEFAULT_CODEX_HOME, ".codex-global-state.json"),
    path.join(CODEX_HOME, ".codex-global-state.json"),
  ])
  : [];
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
const homeAiAutonomousDeliveryReturnService = createHomeAiAutonomousDeliveryReturnService({
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
  defaultCreateRoot: WORKSPACE_DEFAULT_CREATE_ROOT,
  createRoots: WORKSPACE_CREATE_ROOTS,
  desktopGlobalStateFiles: DESKTOP_GLOBAL_STATE_FILES,
});
const mobileArchiveIndexService = createMobileArchiveIndexService({
  storageFile: MOBILE_ARCHIVED_THREAD_IDS_FILE,
});
const codexProfileService = createCodexProfileService({
  userHome: USER_HOME,
  runtimeRoot: RUNTIME_ROOT,
  activeCodexHome: CODEX_HOME,
});
const publicConfigRuntimeCache = createPublicConfigRuntimeCache();

function syncRegisteredWorkspaceTrust(codexHome = CODEX_HOME) {
  try {
    const result = ensureCodexProjectsTrusted({
      codexHome,
      projectPaths: workspaceRegistryService.registeredPaths(),
    });
    if (result.changed) {
      console.log(`[workspace-trust] added ${result.added.length} registered workspace(s) to ${result.configPath}`);
    }
    return result;
  } catch (err) {
    console.error(`[workspace-trust] failed to sync registered workspaces: ${err.message || err}`);
    return { changed: false, added: [], error: err.message || String(err) };
  }
}

function syncCodexMobileMcpToolset(codexHome = CODEX_HOME) {
  try {
    const result = ensureCodexMobileMcpServer({
      codexHome,
      command: process.execPath,
      scriptPath: path.join(APP_ROOT, "scripts", "codex-mobile-mcp-server.js"),
      baseUrl: process.env.CODEX_MOBILE_MCP_SERVER_URL || `http://127.0.0.1:${PORT}`,
      keyFile: AUTH_KEY_FILE,
    });
    if (result.changed) {
      console.log(`[codex-mobile-mcp] registered ${result.serverName} in ${result.configPath}`);
    }
    return result;
  } catch (err) {
    console.error(`[codex-mobile-mcp] failed to sync toolset: ${err.message || err}`);
    return { changed: false, added: false, error: err.message || String(err) };
  }
}

function syncKnownCodexMobileMcpToolsets(profileOptions = {}) {
  const homes = new Set([CODEX_HOME]);
  let profileError = "";
  try {
    const profileState = profileOptions.profileState || codexProfileService.profiles(profileOptions);
    for (const profile of profileState.profiles || []) {
      const codexHome = String(profile && profile.codexHome || "").trim();
      if (!codexHome) continue;
      if (profile.exists || profile.active || codexHome === CODEX_HOME) homes.add(codexHome);
    }
  } catch (err) {
    profileError = err && err.message || String(err);
    console.error(`[codex-mobile-mcp] failed to enumerate known profiles: ${profileError}`);
  }
  const results = [];
  for (const codexHome of homes) {
    results.push(syncCodexMobileMcpToolset(codexHome));
  }
  return {
    changed: results.some((item) => item && item.changed),
    count: results.length,
    results,
    profileError,
  };
}

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
  queryCacheTtlMs: TOKEN_USAGE_QUERY_CACHE_TTL_MS,
});
const threadGoalService = createThreadGoalService({
  dbPath: GOALS_DB,
  userHome: USER_HOME,
});
const threadSideChatService = createThreadSideChatService({
  storageFile: THREAD_SIDE_CHAT_FILE,
  scopeId: THREAD_SIDE_CHAT_SCOPE_ID,
  executeCandidate: async (candidate) => {
    const threadId = String(candidate && candidate.threadId || "");
    const text = String(candidate && candidate.body || "").trim();
    if (!threadId) throw new Error("side_chat_thread_id_required");
    if (!text) throw new Error("side_chat_candidate_body_required");
    const runtimeSettings = await resolveThreadRuntimeSettings(threadId);
    try {
      await codex.request("thread/resume", applyResumeRuntimeSettings({
        threadId,
        cwd: null,
        persistExtendedHistory: true,
      }, runtimeSettings), { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
    } catch (err) {
      if (!/already|loaded|active/i.test(err.message || "")) throw err;
    }
    const turnParams = applyTurnRuntimeSettings({
      threadId,
      input: [{ type: "text", text }],
    }, runtimeSettings);
    const result = await codex.request("turn/start", turnParams, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
    const turnId = notifyLocalTurnStarted(threadId, result, { source: "side-chat-apply" });
    return {
      threadId,
      turnId,
    };
  },
});
const mediaFileService = createMediaFileService({
  env: process.env,
  runtimeRoot: RUNTIME_ROOT,
  userHome: USER_HOME,
  codexHome: CODEX_HOME,
  defaultCodexHome: DEFAULT_CODEX_HOME,
  readBody,
  readRawBody,
  readGlobalState,
  visibleWorkspaceRoots,
  normalizeFsPath,
  readStateDbThread,
  readStartedThread,
  rolloutPathForThread,
});
const IMAGE_EXTENSIONS = mediaFileService.imageExtensions;
const FILE_PREVIEW_IMAGE_CONTENT_TYPES = mediaFileService.filePreviewImageContentTypes;
const FILE_PREVIEW_MEDIA_MAX_BYTES = mediaFileService.filePreviewMediaMaxBytes;
const UPLOAD_ROOT = mediaFileService.uploadRoot;
const GENERATED_IMAGE_ROOT = mediaFileService.generatedImageRoot;
const {
  buildTurnInput,
  filePreviewAuthoritiesForThread,
  filePreviewContentDisposition,
  filePreviewContentType,
  filePreviewSkillRoots,
  generatedImageContentUrl,
  hasDeniedPreviewPathSegment,
  isPathInside,
  messageSubmissionKeys,
  mimeFor,
  persistExtendedHistoryForUploads,
  previewFileReferencesFromText,
  previewRootsForThread,
  readFilePreview,
  readMessageBody,
  resolveFilePreviewPath,
  runMessageSubmissionOnce,
  stripMarkdownFileTarget,
  uploadPathForId,
} = mediaFileService;
const staticFileService = createStaticFileService({
  publicRoot: PUBLIC_ROOT,
  mimeFor,
  getUrl,
  frameAncestorsHeader: () => hermesPluginService.frameAncestorsHeader(),
});
const {
  clearStaticCompressionCache,
  serveStatic,
  staticCompressionCacheStats,
  staticCompressionEncoding,
} = staticFileService;

function serveFilePreviewContent(req, res, requestedPath, allowedRoots) {
  return mediaFileService.serveFilePreviewContent(req, res, requestedPath, allowedRoots, (status, body) => sendJson(res, status, body));
}

let threadDetailProjectionService;
let threadDetailResponsePreparationService;
let threadSummaryStateService;
let threadTaskCardRouteService;
const threadTaskCardService = createThreadTaskCardService({
  storageFile: THREAD_TASK_CARD_FILE,
  onTerminalReturnCard: async (event) => homeAiAutonomousDeliveryReturnService.send(event, { workspaceId: "owner" }),
  executeApprovedCard: async (card, message) => {
    const requestedReasoningEffort = String(card && card.delivery && card.delivery.reasoningEffort || "").trim();
    const inheritedRuntimeSettings = await resolveThreadRuntimeSettings(card.target.threadId);
    const targetThread = readThreadTaskCardExecutionTargetSummary(card);
    const targetIsDeployLane = isHomeAiDeployLaneThread(targetThread);
    const baseRuntimeSettings = targetIsDeployLane
      ? applyPermissionModeOverride(inheritedRuntimeSettings, "full", targetThread && targetThread.cwd || null)
      : inheritedRuntimeSettings;
    const runtimeSettings = requestedReasoningEffort
      ? Object.assign({}, baseRuntimeSettings, { reasoningEffort: requestedReasoningEffort })
      : baseRuntimeSettings;
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
    const turnId = notifyLocalTurnStarted(card.target.threadId, result, {
      source: "thread-task-card-approval",
    });
    return {
      threadId: String(card.target.threadId || ""),
      turnId,
      result,
      runtime: {
        reasoningEffort: runtimeSettings.reasoningEffort || "",
        requestedReasoningEffort,
        approvalPolicy: runtimeSettings.approvalPolicy || "",
        sandboxPolicyType: runtimeSettings.sandboxPolicy && runtimeSettings.sandboxPolicy.type || "",
        deployLaneNoApproval: targetIsDeployLane,
      },
    };
  },
});
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
const MAX_COMMAND_OUTPUT_CHARS = 8000;
const MAX_COMMAND_OUTPUT_CHARS_PER_TURN = 48000;
const MAX_STRUCTURED_CHARS = 24000;
const MAX_DELTA_CHARS = 12000;
const MAX_THREAD_TURNS = Math.max(1, Math.min(100, Number(process.env.CODEX_MOBILE_THREAD_TURNS || "10")));
const MAX_FULL_THREAD_TURNS = Math.max(MAX_THREAD_TURNS, Math.min(200, Number(process.env.CODEX_MOBILE_FULL_THREAD_TURNS || "10")));
const THREAD_DETAIL_TURNS_LIST_FIRST_BYTES = Math.max(
  0,
  Number(process.env.CODEX_MOBILE_THREAD_DETAIL_TURNS_LIST_FIRST_BYTES || String(8 * 1024 * 1024)),
);
const MAX_LIVE_OPERATION_ITEMS = Math.max(1, Math.min(30, Number(process.env.CODEX_MOBILE_LIVE_OPERATION_ITEMS || "12")));
const THREAD_DETAIL_COMPLETED_OPERATION_ITEMS = Math.max(0, Math.min(30, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_COMPLETED_OPERATION_ITEMS || "4")));
const THREAD_DETAIL_ACTIVE_REASONING_ITEMS = Math.max(0, Math.min(20, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_ACTIVE_REASONING_ITEMS || "2")));
const THREAD_DETAIL_COMPLETED_REASONING_ITEMS = Math.max(0, Math.min(20, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_COMPLETED_REASONING_ITEMS || "0")));
const THREAD_DETAIL_ACTIVE_ASSISTANT_ITEMS = Math.max(1, Math.min(50, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_ACTIVE_ASSISTANT_ITEMS || "8")));
const THREAD_DETAIL_COMPLETED_ASSISTANT_ITEMS = Math.max(1, Math.min(20, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_COMPLETED_ASSISTANT_ITEMS || "1")));
const THREAD_DETAIL_COMPLETED_PROGRESS_MESSAGES = Math.max(0, Math.min(20, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_COMPLETED_PROGRESS_MESSAGES || "8")));
const THREAD_DETAIL_ACTIVE_PROGRESSIVE_ITEM_THRESHOLD = Math.max(0, Math.min(10000, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_ACTIVE_PROGRESSIVE_ITEM_THRESHOLD || "50")));
const THREAD_DETAIL_ACTIVE_PROGRESSIVE_BYTES = Math.max(0, Math.min(10 * 1024 * 1024, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_ACTIVE_PROGRESSIVE_BYTES || String(48 * 1024))));
const THREAD_DETAIL_ACTIVE_PROGRESSIVE_THREAD_BYTES = Math.max(0, Math.min(50 * 1024 * 1024, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_ACTIVE_PROGRESSIVE_THREAD_BYTES || String(160 * 1024))));
const THREAD_DETAIL_PROGRESSIVE_ACTIVE_OPERATION_ITEMS = Math.max(0, Math.min(30, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_ACTIVE_OPERATION_ITEMS || "6")));
const THREAD_DETAIL_PROGRESSIVE_ACTIVE_REASONING_ITEMS = Math.max(0, Math.min(20, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_ACTIVE_REASONING_ITEMS || "1")));
const THREAD_DETAIL_PROGRESSIVE_ACTIVE_ASSISTANT_ITEMS = Math.max(1, Math.min(50, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_ACTIVE_ASSISTANT_ITEMS || "4")));
const THREAD_DETAIL_PROGRESSIVE_REPLAY_ASSISTANT_ITEMS = Math.max(1, Math.min(500, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_REPLAY_ASSISTANT_ITEMS || "8")));
const THREAD_DETAIL_PROGRESSIVE_COMPLETED_REPLAY_ASSISTANT_ITEMS = Math.max(1, Math.min(500, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_COMPLETED_REPLAY_ASSISTANT_ITEMS || "12")));
const THREAD_DETAIL_PROGRESSIVE_ACTIVE_TEXT_CHARS = Math.max(0, Math.min(200 * 1024, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_ACTIVE_TEXT_CHARS || String(12 * 1024))));
const THREAD_DETAIL_PROGRESSIVE_ACTIVE_OPERATION_PAYLOAD_CHARS = Math.max(0, Math.min(200 * 1024, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_ACTIVE_OPERATION_PAYLOAD_CHARS || String(6 * 1024))));
const THREAD_DETAIL_PROGRESSIVE_ACTIVE_USER_TEXT_CHARS = Math.max(0, Math.min(200 * 1024, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_ACTIVE_USER_TEXT_CHARS || String(10 * 1024))));
const THREAD_DETAIL_PROGRESSIVE_VISIBLE_ITEM_CEILING = Math.max(0, Math.min(10000, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_VISIBLE_ITEM_CEILING || "48")));
const THREAD_DETAIL_PROGRESSIVE_FIRST_PAINT_THREAD_BYTES = Math.max(0, Math.min(50 * 1024 * 1024, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_FIRST_PAINT_THREAD_BYTES || String(160 * 1024))));
const THREAD_DETAIL_PROGRESSIVE_COMPLETED_TEXT_CHARS = Math.max(0, Math.min(200 * 1024, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_COMPLETED_TEXT_CHARS || String(8 * 1024))));
const THREAD_DETAIL_PROGRESSIVE_COMPLETED_USER_TEXT_CHARS = Math.max(0, Math.min(200 * 1024, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_COMPLETED_USER_TEXT_CHARS || "1024")));
const THREAD_DETAIL_SUMMARY_APP_SERVER_REFRESH_TTL_MS = Math.max(0, Math.min(60 * 60 * 1000, Number(process.env.CODEX_MOBILE_THREAD_DETAIL_SUMMARY_APP_SERVER_REFRESH_TTL_MS || String(30 * 1000))));
const OPERATIONAL_ITEM_TYPES = new Set(["commandExecution", "collabAgentToolCall", "fileChange", "dynamicToolCall", "mcpToolCall"]);
const THREAD_LIST_FALLBACK_CACHE_TTL_MS = Math.max(0, Number(process.env.CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_TTL_MS || "0"));
const THREAD_LIST_FALLBACK_CACHE_FILE = process.env.CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_FILE
  || path.join(RUNTIME_ROOT, "thread-list-fallback-cache.json");
const THREAD_LIST_FALLBACK_CACHE_PERSIST_MAX_AGE_MS = Math.max(
  0,
  Math.min(30 * 24 * 60 * 60 * 1000, Number(process.env.CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_PERSIST_MAX_AGE_MS || String(7 * 24 * 60 * 60 * 1000))),
);
const THREAD_LIST_DEFAULT_WARM_FALLBACK_ENABLED = !/^(0|false|no|off)$/i.test(process.env.CODEX_MOBILE_THREAD_LIST_DEFAULT_WARM_FALLBACK || "1");
const THREAD_LIST_FALLBACK_PREWARM_ENABLED = !/^(0|false|no|off)$/i.test(process.env.CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM || "1");
const THREAD_LIST_FALLBACK_PREWARM_DELAY_MS = Math.max(
  0,
  Math.min(10 * 60 * 1000, Number(process.env.CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_DELAY_MS || "0")),
);
const THREAD_LIST_FALLBACK_PREWARM_RETRY_MS = Math.max(
  100,
  Math.min(10 * 60 * 1000, Number(process.env.CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_RETRY_MS || "2500")),
);
const THREAD_LIST_FALLBACK_PREWARM_MAX_DEFERRALS = Math.max(
  0,
  Math.min(100, Number(process.env.CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_MAX_DEFERRALS || "5")),
);
const THREAD_LIST_FALLBACK_PREWARM_LIMIT = Math.max(
  1,
  Math.min(200, Number(process.env.CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_LIMIT || "40")),
);
const THREAD_LIST_FALLBACK_PREWARM_SOURCE_SNAPSHOT_LIMIT_RAW = Number(
  process.env.CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_SOURCE_SNAPSHOT_LIMIT || "1000",
);
const THREAD_LIST_FALLBACK_PREWARM_SOURCE_SNAPSHOT_LIMIT = Math.max(
  Math.max(200, THREAD_LIST_FALLBACK_PREWARM_LIMIT),
  Math.min(1000, Number.isFinite(THREAD_LIST_FALLBACK_PREWARM_SOURCE_SNAPSHOT_LIMIT_RAW)
    ? THREAD_LIST_FALLBACK_PREWARM_SOURCE_SNAPSHOT_LIMIT_RAW
    : 1000),
);
let activeThreadDetailRequestCount = 0;
threadDetailProjectionService = THREAD_DETAIL_PROJECTION_V4_ENABLED
  ? createThreadDetailProjectionV4Service({
    cacheDir: THREAD_DETAIL_PROJECTION_CACHE_DIR,
    policyVersion: "state-relevant-receipt-v4",
    maxTurns: MAX_FULL_THREAD_TURNS,
  })
  : createThreadDetailProjectionService({
    cacheDir: THREAD_DETAIL_PROJECTION_CACHE_DIR,
    policyVersion: THREAD_DETAIL_PROJECTION_POLICY_VERSION,
    maxTurns: MAX_FULL_THREAD_TURNS,
  });
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
const PROFILE_SWITCH_PREFLIGHT_TIMEOUT_MS = Math.max(4000, Number(process.env.CODEX_MOBILE_PROFILE_SWITCH_PREFLIGHT_TIMEOUT_MS || "12000"));
const PROFILE_SWITCH_PROGRESS_TTL_MS = Math.max(60_000, Number(process.env.CODEX_MOBILE_PROFILE_SWITCH_PROGRESS_TTL_MS || "300000"));
const MUTATION_RPC_TIMEOUT_MS = 120000;
const STALE_ACTIVE_TURN_MS = Math.max(30_000, Number(process.env.CODEX_MOBILE_STALE_ACTIVE_TURN_MS || "180000"));
const TERMINAL_IDLE_ACTIVE_TURN_MS = Math.max(10_000, Number(process.env.CODEX_MOBILE_TERMINAL_IDLE_ACTIVE_TURN_MS || "45000"));
const STARTED_THREAD_CACHE_TTL_MS = Math.max(60_000, Number(process.env.CODEX_MOBILE_STARTED_THREAD_CACHE_TTL_MS || "900000"));
const STARTED_THREAD_CACHE_MAX = Math.max(10, Number(process.env.CODEX_MOBILE_STARTED_THREAD_CACHE_MAX || "80"));
const THREAD_DISPLAY_SUMMARY_CACHE_TTL_MS = Math.max(60_000, Number(process.env.CODEX_MOBILE_THREAD_DISPLAY_SUMMARY_CACHE_TTL_MS || "7200000"));
const THREAD_DISPLAY_SUMMARY_CACHE_MAX = Math.max(20, Number(process.env.CODEX_MOBILE_THREAD_DISPLAY_SUMMARY_CACHE_MAX || "500"));
const MAX_ROLLOUT_CONTEXT_BYTES = Math.max(256 * 1024, Number(process.env.CODEX_MOBILE_ROLLOUT_CONTEXT_BYTES || String(4 * 1024 * 1024)));
const MAX_RUNTIME_CONTEXT_SCAN_BYTES = Math.max(MAX_ROLLOUT_CONTEXT_BYTES, Number(process.env.CODEX_MOBILE_RUNTIME_CONTEXT_SCAN_BYTES || String(32 * 1024 * 1024)));
const MAX_ROLLOUT_ENRICHMENT_CONTEXT_BYTES = Math.max(
  MAX_ROLLOUT_CONTEXT_BYTES,
  Number(process.env.CODEX_MOBILE_ROLLOUT_ENRICHMENT_CONTEXT_BYTES || String(32 * 1024 * 1024)),
);
const ROLLOUT_WARNING_BYTES = Math.max(1 * 1024 * 1024, Number(process.env.CODEX_MOBILE_ROLLOUT_WARNING_BYTES || String(200 * 1024 * 1024)));
const ROLLOUT_ACTIVE_STATUS_WINDOW_MS = Math.max(60_000, Number(process.env.CODEX_MOBILE_ROLLOUT_ACTIVE_STATUS_WINDOW_MS || String(30 * 60 * 1000)));
const LOCAL_ACTIVE_THREAD_STATUS_TTL_MS = Math.max(60_000, Number(process.env.CODEX_MOBILE_LOCAL_ACTIVE_THREAD_STATUS_TTL_MS || String(30 * 60 * 1000)));
const STALE_CONTEXT_ONLY_ACTIVE_TURN_MS = Math.max(30_000, Number(process.env.CODEX_MOBILE_CONTEXT_ONLY_ACTIVE_STALE_MS || "90000"));
const CONTINUATION_CONTEXT_HANDOFF_COMPACT_BYTES = Math.max(64 * 1024, Number(process.env.CODEX_MOBILE_CONTINUATION_CONTEXT_HANDOFF_COMPACT_BYTES || String(300 * 1024)));
const CONTINUATION_CONTEXT_HANDOFF_PRESERVE_CHARS = Math.max(8_000, Number(process.env.CODEX_MOBILE_CONTINUATION_CONTEXT_HANDOFF_PRESERVE_CHARS || "60000"));
const CONTINUATION_CONTEXT_FILE_COMPACT_BYTES = Math.max(50 * 1024, Number(process.env.CODEX_MOBILE_CONTINUATION_CONTEXT_FILE_COMPACT_BYTES || String(100 * 1024)));
const CONTINUATION_CONTEXT_PAIR_COMPACT_BYTES = Math.max(CONTINUATION_CONTEXT_FILE_COMPACT_BYTES, Number(process.env.CODEX_MOBILE_CONTINUATION_CONTEXT_PAIR_COMPACT_BYTES || String(200 * 1024)));
const CONTINUATION_CONTEXT_HANDOFF_PROMPT_BYTES = Math.max(CONTINUATION_CONTEXT_FILE_COMPACT_BYTES, Number(process.env.CODEX_MOBILE_CONTINUATION_CONTEXT_HANDOFF_PROMPT_BYTES || String(200 * 1024)));
const CONTINUATION_CONTEXT_COMPACT_PRESERVE_CHARS = Math.max(6_000, Number(process.env.CODEX_MOBILE_CONTINUATION_CONTEXT_COMPACT_PRESERVE_CHARS || "18000"));
const RUNTIME_CONTEXT_CACHE_TTL_MS = Math.max(1000, Number(process.env.CODEX_MOBILE_RUNTIME_CONTEXT_CACHE_TTL_MS || "30000"));
const RUNTIME_CONTEXT_CACHE_MAX = Math.max(20, Number(process.env.CODEX_MOBILE_RUNTIME_CONTEXT_CACHE_MAX || "200"));
const MUX_REPLAY_NOTIFICATION_LIMIT = Math.max(0, Number(process.env.CODEX_MOBILE_MUX_REPLAY_NOTIFICATION_LIMIT || "200"));
const SAFE_RETRY_METHODS = new Set(["initialize", "thread/list", "thread/read", "thread/turns/list"]);
const CODEX_CONFIG_DEFAULTS = readCodexConfigDefaults();
const PROCESS_STARTED_AT_MS = Date.now();

let clients = new Map();
let clientHeartbeats = new WeakMap();
let latestLiveRateLimits = null;
let latestLiveRateLimitsSource = null;
let latestSnapshotRateLimits = null;
const latestLiveRateLimitsByModel = new Map();
const latestSnapshotRateLimitsByModel = new Map();
let lastRolloutRateLimitScanAt = 0;
const LIVE_RATE_LIMIT_REFRESH_MIN_INTERVAL_MS = 10000;
const latestRuntimeContextByPath = new Map();
const latestItemTimestampsByPath = new Map();
const latestTurnUsageSummariesByPath = new Map();
const latestFinalReceiptsByPath = new Map();
const latestUserInputAnchorsByPath = new Map();
const latestToolOutputImagesByPath = new Map();
const rolloutEnrichmentIndexService = createRolloutEnrichmentIndexService({
  maxIndexes: RUNTIME_CONTEXT_CACHE_MAX,
});
const latestThreadIdByTurnId = new Map();
const recentStartedThreads = new Map();
const threadDisplaySummaryCache = createThreadDisplaySummaryCache({
  ttlMs: THREAD_DISPLAY_SUMMARY_CACHE_TTL_MS,
  maxEntries: THREAD_DISPLAY_SUMMARY_CACHE_MAX,
  decorateOnRead: false,
  decorateSummary: annotateThreadRolloutStats,
  mergeSummary: mergeThreadDisplaySummary,
});
threadSummaryStateService = createThreadSummaryStateService({
  stateDb: STATE_DB,
  userHome: USER_HOME,
  localActiveThreadStatusTtlMs: LOCAL_ACTIVE_THREAD_STATUS_TTL_MS,
  runSqliteJson,
  statusText,
  readRolloutTail,
  parseJsonLine,
  isRolloutTerminalEntry,
  timestampToMs,
  rolloutLatestTurnEvidence,
  rolloutEvidenceHasRuntimeActivity,
  rolloutEvidenceIsRecent,
  rolloutPathForThread,
  readStartedThread,
  updateThreadListFallbackCacheStatus,
  normalizeStaleContextOnlyActiveThread,
  normalizeHomeAiDeployLaneSummary,
  annotateThreadRolloutStats,
  attachThreadTaskCardCountsToSummary,
  threadDisplaySummaryCache,
  threadListSummaryTimestampMs,
  stripThreadListDetailFields,
  upsertThreadListFallbackCacheThread,
});
const continuationThreadService = createContinuationThreadService({
  env: process.env,
  compactWorkspaceContext,
  logContinuation,
  codexRequest: (...args) => codex.request(...args),
  readGlobalState,
  visibilityFromGlobalState,
  normalizeFsPath,
  readStateDbThread,
  readStartedThread,
  readThreadSummaryFromAppServer,
  isHiddenThread,
  annotateThreadRolloutStats,
  threadRuntimeSettings,
  sortTurnsChronologically,
  compactTurn,
  rolloutPathForThread,
  rolloutStatsForPath,
  truncateMiddle,
  truncateTail,
  compactStructured,
  isContextCompactionType,
  isWebSearchLikeItem,
  isOperationalItem,
  statusText,
  isCompletedStatus,
  publicRuntimeSettings,
  applyTurnRuntimeSettings,
  applyResumeRuntimeSettings,
  applyStartThreadRuntimeSettings,
  applyPermissionModeOverride,
  readStartThreadDeveloperInstructions,
  threadIdFromStartResult,
  notifyLocalTurnStarted,
  persistThreadTitleToSessionIndex,
  tryUpdateThreadTitle,
  archiveVisibleThread,
  mobileArchivedFallbackResult,
  rememberStartedThread,
  currentThreadGoalForAction,
  setThreadGoalRpc,
  threadGoalSetParams,
  threadGoalFromRpcResult,
  normalizeThreadGoalStatus,
  isThreadGoalRpcUnsupportedError,
  continuationGoalMigrationPlan,
  httpStatusError,
  readRpcTimeoutMs: READ_RPC_TIMEOUT_MS,
  threadDetailRpcTimeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS,
  mutationRpcTimeoutMs: MUTATION_RPC_TIMEOUT_MS,
  contextCompaction: {
    thresholdBytes: CONTINUATION_CONTEXT_FILE_COMPACT_BYTES,
    combinedThresholdBytes: CONTINUATION_CONTEXT_PAIR_COMPACT_BYTES,
    preserveChars: CONTINUATION_CONTEXT_COMPACT_PRESERVE_CHARS,
  },
});
const {
  createContinuationJob,
  getContinuationJob,
  publicContinuationJob,
  startThreadFromRequestBody,
} = continuationThreadService;
const SERVER_REQUEST_METHODS = new Set([
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "item/permissions/requestApproval",
  "item/tool/requestUserInput",
  "item/tool/call",
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
const CODEGRAPH_READONLY_MCP_TOOLS = new Set([
  "codegraph_search",
  "codegraph_explore",
  "codegraph_node",
  "codegraph_callers",
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
    "plugin-embed.js",
    "plugin-voice-input.js",
    "home-ai-diagnostic-reporting.js",
    "thread-diagnostic-events.js",
    "frontend-runtime-health.js",
    "build-refresh-policy.js",
    "thread-performance-metrics.js",
    "thread-list-load-policy.js",
    "thread-list-stable-order.js",
    "client-render-stability-guard.js",
    "live-operation-dock-state.js",
    "thread-detail-state.js",
    "thread-detail-render-plan.js",
    "thread-detail-merge-state.js",
    "thread-detail-v4-merge-state.js",
    "thread-detail-patch-plan.js",
    "thread-detail-dom-patch.js",
    "thread-detail-actions.js",
    "thread-tile-actions.js",
    "thread-tile-state.js",
    "thread-tile-layout.js",
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

function clientBuildId(cacheName = readServiceWorkerCacheName(), buildId = appShellBuildId(cacheName)) {
  return `${APP_VERSION}|${cacheName || buildId}`;
}

function currentPublicBuildConfig() {
  const shellCacheName = readServiceWorkerCacheName();
  const buildId = appShellBuildId(shellCacheName);
  return {
    buildId,
    clientBuildId: clientBuildId(shellCacheName, buildId),
    shellCacheName,
  };
}

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

function pathEntriesFromEnvPath(value) {
  return String(value || "")
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function executableCandidateNames(command) {
  const value = String(command || "").trim();
  if (!value) return [];
  if (commandNeedsFilesystemCheck(value) || process.platform !== "win32") return [value];
  const pathext = String(process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM")
    .split(";")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const lower = value.toLowerCase();
  if (pathext.some((ext) => lower.endsWith(ext))) return [value];
  return [value, ...pathext.map((ext) => `${value}${ext}`)];
}

function isExecutableFile(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch (_) {
    return process.platform === "win32" && fs.existsSync(filePath);
  }
}

function findExecutableInDirs(command, dirs) {
  const names = executableCandidateNames(command);
  for (const dir of dirs) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (isExecutableFile(candidate)) return candidate;
    }
  }
  return "";
}

function commonCodexExecutableDirs() {
  const dirs = pathEntriesFromEnvPath(process.env.PATH);
  if (process.platform !== "win32") {
    dirs.push(
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/opt/local/bin",
      "/usr/bin",
      path.join(USER_HOME, ".local", "bin"),
      path.join(USER_HOME, ".npm-global", "bin"),
      path.join(USER_HOME, ".yarn", "bin"),
      path.join(USER_HOME, ".bun", "bin"),
      path.join(USER_HOME, ".cargo", "bin"),
      path.join(USER_HOME, "Library", "pnpm"),
    );
  }
  return Array.from(new Set(dirs));
}

function resolveDefaultCodexExecutable() {
  const explicit = String(process.env.CODEX_MOBILE_CODEX_EXE || "").trim();
  if (explicit) return explicit;
  return findExecutableInDirs("codex", commonCodexExecutableDirs()) || "codex";
}

function assertCommandAvailable(command, label) {
  const value = String(command || "").trim();
  if (!value) throw new Error(`${label} is not configured`);
  if (commandNeedsFilesystemCheck(value) && !isExecutableFile(value)) {
    throw new Error(`${label} not found: ${value}`);
  }
  if (!commandNeedsFilesystemCheck(value) && !findExecutableInDirs(value, pathEntriesFromEnvPath(process.env.PATH))) {
    throw new Error(`${label} not found on PATH: ${value}`);
  }
}

function codexAppServerChildEnv(extra = {}) {
  const env = Object.assign({}, process.env);
  for (const key of Object.keys(env)) {
    if (key === "CODEX_CLI_PATH" || key.startsWith("CODEX_MUX_")) {
      delete env[key];
    }
  }
  if (CODEX_HOME) env.CODEX_HOME = CODEX_HOME;
  Object.assign(env, extra);
  return env;
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
  return requestAuthTokens(req)[0] || "";
}

function pushUniqueAuthToken(tokens, value) {
  const token = String(value || "").trim();
  if (token && !tokens.includes(token)) tokens.push(token);
}

function requestAuthTokens(req) {
  const url = getUrl(req);
  const cookies = parseCookies(req.headers.cookie);
  const tokens = [];
  pushUniqueAuthToken(tokens, req.headers["x-codex-mobile-key"]);
  pushUniqueAuthToken(tokens, bearerTokenFromRequest(req));
  pushUniqueAuthToken(tokens, url.searchParams.get("key"));
  pushUniqueAuthToken(tokens, url.searchParams.get("codexPluginLaunch"));
  pushUniqueAuthToken(tokens, cookies.codex_mobile_plugin_session);
  pushUniqueAuthToken(tokens, cookies.codex_mobile_key);
  return tokens;
}

function isAccessKeyAuthorized(req) {
  if (DISABLE_AUTH) return true;
  return requestAuthTokens(req).some((token) => timingSafeEquals(token, AUTH_KEY));
}

function isAuthorized(req) {
  if (isAccessKeyAuthorized(req)) return true;
  const tokens = requestAuthTokens(req);
  if (tokens.some((token) => hermesPluginService.isSessionAuthorized(token))) return true;
  return tokens.some((token) => hermesPluginService.isLaunchTokenAuthorized(token));
}

function isHttpsRequest(req) {
  return String(req && (req.headers["x-forwarded-proto"] || req.headers["x-forwarded-protocol"]) || "").split(",")[0].trim().toLowerCase() === "https";
}

function pluginSessionCookieHeader(req, session) {
  const sessionKey = String(session && session.session_key || "").trim();
  if (!sessionKey) return "";
  const maxAge = Math.max(1, Math.floor(Number(session && session.expires_in || 0) || 0));
  const parts = [
    `codex_mobile_plugin_session=${encodeURIComponent(sessionKey)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
    "HttpOnly",
  ];
  if (isHttpsRequest(req)) parts.push("Secure");
  return parts.join("; ");
}

function sendJson(res, status, data, headers = {}) {
  if (!res || res.destroyed || res.writableEnded) return;
  const body = JSON.stringify(data);
  res.writeHead(status, Object.assign({
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  }, headers || {}));
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

function logThreadList(event, details = {}) {
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
  console.log(`[thread-list] ${event} ${JSON.stringify(safeDetails)}`);
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
  return /not found|not active|inactive|completed|interrupted|expected turn|expected active turn id|no active turn|turn.*not.*running|turn.*not.*active/.test(message);
}

function isCodexAccountAuthError(err) {
  const message = String((err && err.message) || err || "").toLowerCase();
  return /token_expired|refresh_token_reused|refresh token|access token|unauthorized|401/.test(message);
}

function codexAccountAuthErrorPayload(err) {
  return {
    ok: false,
    error: "Codex 账号登录已失效，请重新登录该账号，或切换到可用账号后重试。",
    code: "codex_account_auth_invalid",
    detail: boundedProfilePreflightDetail(err),
  };
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
  console.log(`[client-event] ${event} ${JSON.stringify(Object.assign({
    ts: new Date().toISOString(),
  }, safeLogDetails(details)))}`);
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

function redactInlineImageDataUrls(value) {
  const text = String(value ?? "");
  if (!/data:image\//i.test(text)) return text;
  return text.replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=_-]+/gi, (match) => (
    `[inline image data omitted: ${match.length} chars]`
  ));
}

function compactStructured(value) {
  if (value == null) return value;
  let raw;
  try {
    raw = JSON.stringify(value);
  } catch (_) {
    raw = String(value);
  }
  const redacted = redactInlineImageDataUrls(raw);
  if (redacted.length <= MAX_STRUCTURED_CHARS) {
    if (redacted === raw) return value;
    try {
      return JSON.parse(redacted);
    } catch (_) {
      return redacted;
    }
  }
  if (raw.length <= MAX_STRUCTURED_CHARS) return value;
  return {
    truncated: true,
    totalChars: raw.length,
    inlineImagesRedacted: redacted !== raw || undefined,
    preview: truncateMiddle(redacted, MAX_STRUCTURED_CHARS, "structured payload"),
  };
}

function compactStringArray(values, maxChars, label) {
  if (!Array.isArray(values)) return values;
  return values.map((value) => (
    typeof value === "string"
      ? truncateMiddle(redactInlineImageDataUrls(value), maxChars, label)
      : compactStructured(value)
  ));
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

function threadProjectlessVisible(thread, visibility = null) {
  const view = visibility || visibilityFromGlobalState();
  const id = String(thread && thread.id || "").trim();
  return Boolean(id && view.projectlessThreadIds && view.projectlessThreadIds.has(id));
}

function anyThreadMatchesVisibleWorkspace(threads, visibility = null) {
  const view = visibility || visibilityFromGlobalState();
  if (!view.workspaceKeys || view.workspaceKeys.size <= 0) return false;
  for (const thread of Array.isArray(threads) ? threads : []) {
    if (!thread || typeof thread !== "object" || shouldHideThreadListSummary(thread)) continue;
    const cwd = String(thread.cwd || "").trim();
    if (cwd && threadWorkspaceVisible(cwd, view)) return true;
    if (threadProjectlessVisible(thread, view)) return true;
  }
  return false;
}

function threadMatchesWorkspaceCwd(threadCwd, selectedCwd) {
  const selected = String(selectedCwd || "").trim();
  if (!selected) return true;
  if (normalizeFsPath(threadCwd) === normalizeFsPath(selected)) return true;
  const worktreeRepo = codexWorktreeRepoName(threadCwd);
  return Boolean(worktreeRepo && worktreeRepo === path.basename(path.resolve(selected)));
}

function imageViewInlineDataUrl(item) {
  if (!item || typeof item !== "object") return "";
  const candidates = [
    item.url,
    item.imageUrl,
    item.image_url,
    item.arguments && (item.arguments.url || item.arguments.imageUrl || item.arguments.image_url),
    item.result && (item.result.url || item.result.imageUrl || item.result.image_url),
  ];
  for (const candidate of candidates) {
    const value = candidate && typeof candidate === "object"
      ? candidate.url || candidate.uri || candidate.href
      : candidate;
    if (typeof value === "string" && /^data:image\//i.test(value.trim())) return value.trim();
  }
  return "";
}

const GENERATED_IMAGE_SOURCE_FIELD_KEYS = [
  "path",
  "filePath",
  "file_path",
  "imagePath",
  "image_path",
  "savedPath",
  "saved_path",
  "sourcePath",
  "source_path",
  "url",
  "imageUrl",
  "image_url",
];

function imageViewSourceFieldValue(value) {
  if (value && typeof value === "object") return String(value.url || value.uri || value.href || "").trim();
  return String(value || "").trim();
}

function isBrowserApiImageUrl(value) {
  return /^\/api\/(?:generated-images\/file|uploads\/file|files\/preview\/content)(?:[?#]|$)/.test(String(value || "").trim());
}

function isAbsoluteLocalImageSource(value) {
  const text = String(value || "").trim();
  return Boolean(text && (
    path.isAbsolute(text)
    || /^[A-Za-z]:[\\/]/.test(text)
    || /^\\\\/.test(text)
  ));
}

function isImageFileNameLike(value) {
  return /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|tiff|webp)(?:[?#].*)?$/i.test(String(value || "").trim());
}

function isUnsafeGeneratedImageSourceValue(value) {
  const text = imageViewSourceFieldValue(value);
  if (!text || isBrowserApiImageUrl(text)) return false;
  if (/^data:image\//i.test(text)) return true;
  if (/^file:\/\//i.test(text)) return true;
  if (/^(?:https?:|blob:)/i.test(text)) return false;
  if (isAbsoluteLocalImageSource(text)) return true;
  return isImageFileNameLike(text);
}

function generatedImageSourceDisplayName(item) {
  const explicit = item && (item.fileName || item.file_name || item.label || item.caption || item.id);
  const source = imageViewSourcePath(item) || imageViewSourceFieldValue(item && (item.url || item.imageUrl || item.image_url));
  const basename = path.basename(String(source || explicit || "image"));
  return basename || "image";
}

function removeUnsafeGeneratedImageSources(item) {
  if (!item || typeof item !== "object") return item;
  const targets = [item];
  if (item.arguments && typeof item.arguments === "object") targets.push(item.arguments);
  if (item.result && typeof item.result === "object") targets.push(item.result);
  for (const target of targets) {
    for (const key of GENERATED_IMAGE_SOURCE_FIELD_KEYS) {
      if (Object.prototype.hasOwnProperty.call(target, key) && isUnsafeGeneratedImageSourceValue(target[key])) delete target[key];
    }
  }
  return item;
}

function generatedImageHasUnsafeSource(item) {
  if (!item || typeof item !== "object") return false;
  const targets = [item];
  if (item.arguments && typeof item.arguments === "object") targets.push(item.arguments);
  if (item.result && typeof item.result === "object") targets.push(item.result);
  return targets.some((target) => GENERATED_IMAGE_SOURCE_FIELD_KEYS.some((key) => (
    Object.prototype.hasOwnProperty.call(target, key) && isUnsafeGeneratedImageSourceValue(target[key])
  )));
}

function markGeneratedImageUnavailable(item) {
  if (!item || typeof item !== "object") return item;
  const fileName = generatedImageSourceDisplayName(item);
  delete item.contentUrl;
  delete item.content_url;
  removeUnsafeGeneratedImageSources(item);
  if (!item.fileName && !item.file_name) item.fileName = fileName;
  item.generatedImage = {
    fileName,
    unavailable: true,
    reason: "source_unavailable",
  };
  return item;
}

function applyGeneratedImageCacheResult(item, cached) {
  if (!item || !cached) return item;
  item.contentUrl = generatedImageContentUrl(cached.cacheId);
  if (!item.fileName && !item.file_name) item.fileName = cached.fileName;
  item.generatedImage = {
    fileName: cached.fileName,
    contentType: cached.contentType,
    sizeBytes: cached.sizeBytes,
  };
  removeUnsafeGeneratedImageSources(item);
  return item;
}

function attachGeneratedImageContent(item, options = {}) {
  if (!item || (item.type !== "imageView" && item.type !== "imageGeneration")) return item;
  if (item.contentUrl || item.content_url) return item;
  const dataUrl = imageViewInlineDataUrl(item);
  if (dataUrl) {
    const cachedDataUrl = cacheGeneratedImageDataUrl(dataUrl, {
      cacheRoot: GENERATED_IMAGE_ROOT,
      threadId: options.threadId || "",
      maxBytes: FILE_PREVIEW_MEDIA_MAX_BYTES,
      contentTypes: FILE_PREVIEW_IMAGE_CONTENT_TYPES,
    });
    if (!cachedDataUrl) return markGeneratedImageUnavailable(item);
    return applyGeneratedImageCacheResult(item, cachedDataUrl);
  }
  const hasUnsafeSource = generatedImageHasUnsafeSource(item);
  const sourcePath = imageViewSourcePath(item);
  const cached = cacheGeneratedImageForItem(item, {
    cacheRoot: GENERATED_IMAGE_ROOT,
    threadId: options.threadId || "",
    maxBytes: FILE_PREVIEW_MEDIA_MAX_BYTES,
    contentTypes: FILE_PREVIEW_IMAGE_CONTENT_TYPES,
    isDeniedPath: hasDeniedPreviewPathSegment,
  });
  if (!cached) {
    if (sourcePath || hasUnsafeSource) return markGeneratedImageUnavailable(item);
    return item;
  }
  return applyGeneratedImageCacheResult(item, cached);
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

function isSideChatSidecarThreadSummary(thread) {
  return Boolean(thread && threadSideChatService.isSidecarThreadId(thread.id || thread.threadId));
}

function threadSummaryHasDisplayText(thread) {
  if (!thread || typeof thread !== "object") return false;
  const id = String(thread.id || "").trim();
  for (const value of [thread.name, thread.title, thread.preview, thread.first_user_message]) {
    const text = String(value || "").trim();
    if (text && !isRecoverableThreadListTitle(text, id)) return true;
  }
  return false;
}

function isResidualFallbackThreadSummary(thread) {
  if (!thread || typeof thread !== "object" || !thread.mobileFallback) return false;
  const id = normalizeThreadId(thread.id);
  if (!id || threadSummaryHasDisplayText(thread)) return false;
  return !isThreadListLiveStatus(thread.status);
}

function isUnmaterializedThreadListPlaceholder(thread) {
  if (!thread || typeof thread !== "object") return false;
  const id = normalizeThreadId(thread.id);
  if (!id) return false;
  if (!isThreadListUnknownStatus(thread.status)) return false;
  if (threadSummaryHasDisplayText(thread)) return false;
  if (String(thread.cwd || "").trim()) return false;
  if (Array.isArray(thread.turns) && thread.turns.length) return false;
  const display = String(thread.name || thread.title || thread.preview || "").trim();
  return !display || isRecoverableThreadListTitle(display, id);
}

function shouldHideThreadListSummary(thread, archivedIds = null) {
  if (threadHasArchiveSignal(thread, archivedIds)) return true;
  if (isSubagentThreadSummary(thread)) return true;
  if (isSideChatSidecarThreadSummary(thread)) return true;
  return isResidualFallbackThreadSummary(thread) || isUnmaterializedThreadListPlaceholder(thread);
}

function archivedSessionDirectories() {
  const dirs = new Set([ARCHIVED_SESSIONS_DIR]);
  dirs.add(path.join(DEFAULT_CODEX_HOME, "archived_sessions"));
  const homesRoot = path.join(USER_HOME, ".codex-homes");
  try {
    for (const entry of fs.readdirSync(homesRoot, { withFileTypes: true })) {
      if (!entry || !entry.isDirectory()) continue;
      dirs.add(path.join(homesRoot, entry.name, "archived_sessions"));
    }
  } catch (_) {
    // Older installs may not have profile-specific homes.
  }
  return [...dirs];
}

function addArchivedSessionIdsFromDir(ids, dir) {
  try {
    for (const name of fs.readdirSync(dir)) {
      const match = String(name || "").match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      const id = normalizeThreadId(match && match[1]);
      if (id) ids.add(id);
    }
  } catch (_) {
    // Missing archived_sessions directories are normal for fresh profiles.
  }
}

function archivedSessionThreadIds() {
  const ids = mobileArchiveIndexService.threadIds();
  for (const dir of archivedSessionDirectories()) {
    addArchivedSessionIdsFromDir(ids, dir);
  }
  return ids;
}

function threadHasArchiveSignal(thread, archivedIds = null) {
  if (!thread || typeof thread !== "object") return false;
  const id = normalizeThreadId(thread.id);
  const status = statusText(thread.status).toLowerCase();
  const location = String(thread.path || thread.rolloutPath || thread.rollout_path || "").toLowerCase();
  const archivedThreadIds = archivedIds && typeof archivedIds.has === "function" ? archivedIds : archivedSessionThreadIds();
  return Boolean(thread.archived || thread.archivedAt || thread.archived_at || thread.isArchived)
    || Boolean(thread.deleted || thread.deletedAt || thread.deleted_at || thread.isDeleted || thread.removed || thread.removedAt)
    || Boolean(id && archivedThreadIds.has(id))
    || /archived|deleted|removed/.test(status)
    || /[/\\](archived|deleted|trash|removed)[_-]?sessions[/\\]/.test(location)
    || isBackupRolloutPath(location);
}

function rememberMobileArchivedThreadId(threadId) {
  try {
    const remembered = mobileArchiveIndexService.remember(threadId);
    if (remembered) removeThreadFromThreadListFallbackCache(threadId);
    return remembered;
  } catch (err) {
    console.warn(`Failed to update Mobile archived thread index: ${err.message || String(err)}`);
    return false;
  }
}

function archivedResultWithMobileIndex(result, threadId) {
  if (result && typeof result === "object" && result.archived === false) return result;
  const mobileArchived = rememberMobileArchivedThreadId(threadId);
  const out = result && typeof result === "object" ? Object.assign({}, result) : { archived: true };
  if (!Object.prototype.hasOwnProperty.call(out, "archived")) out.archived = true;
  if (mobileArchived) out.mobileArchived = true;
  return out;
}

function alreadyArchivedResult(source, threadId, shouldRemember = true) {
  const out = { archived: true, alreadyArchived: true };
  if (source) out.source = source;
  if (shouldRemember && rememberMobileArchivedThreadId(threadId)) out.mobileArchived = true;
  return out;
}

function mobileArchivedFallbackResult(source, threadId, err) {
  const mobileArchived = rememberMobileArchivedThreadId(threadId);
  return {
    archived: Boolean(mobileArchived),
    source: source || "mobile-index-fallback",
    mobileArchived,
    archiveError: err ? String(err.message || err) : "",
  };
}

function isThreadIdArchivedLocally(threadId) {
  const id = normalizeThreadId(threadId);
  return Boolean(id && archivedSessionThreadIds().has(id));
}

function isHiddenThread(thread, visibility = null, options = {}) {
  if (!thread || typeof thread !== "object") return true;
  const view = visibility || visibilityFromGlobalState();
  if (shouldHideThreadListSummary(thread, options.archivedIds)) return true;
  if (threadProjectlessVisible(thread, view)) return false;
  if (view.workspaceKeys && view.workspaceKeys.size > 0) {
    const cwd = String(thread.cwd || "").trim();
    if (cwd) return !threadWorkspaceVisible(cwd, view);
    return true;
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

function isThreadIdLikeTitle(value, threadId = "") {
  const text = String(value || "").trim();
  const id = String(threadId || "").trim();
  if (!text) return true;
  if (id && text === id) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text);
}

function isRecoverableThreadListTitle(value, threadId = "") {
  const text = String(value || "").trim();
  return isThreadIdLikeTitle(text, threadId)
    || /^#\s*Continuation Bootstrap Index\b/i.test(text)
    || /This thread is a same-workspace continuation created by Codex Mobile Web/i.test(text);
}

function sessionIndexDisplayName(entry) {
  return fallbackDisplayText(entry && (entry.thread_name || entry.name || entry.title), 120);
}

function applySessionIndexTitleToThread(thread, entry) {
  if (!thread || typeof thread !== "object") return thread;
  const id = String(thread.id || "").trim();
  const name = sessionIndexDisplayName(entry);
  if (!id || !name) return thread;
  const next = Object.assign({}, thread, {
    name,
    preview: name,
  });
  const updatedAt = entry && (entry.updated_at || entry.updatedAt);
  if (updatedAt && timestampToMs(updatedAt) >= timestampToMs(next.updatedAt || next.updated_at)) {
    next.updatedAt = Math.floor(timestampToMs(updatedAt) / 1000);
  }
  return next;
}

function hydrateThreadListTitlesFromSessionIndex(threads, indexEntries = readSessionIndexEntries()) {
  if (!Array.isArray(threads) || !threads.length || !indexEntries || typeof indexEntries.get !== "function") {
    return threads;
  }
  return threads.map((thread) => {
    if (!thread || typeof thread !== "object") return thread;
    const id = String(thread.id || "").trim();
    if (!id) return thread;
    const entry = indexEntries.get(id);
    return applySessionIndexTitleToThread(thread, entry);
  });
}

function hydrateThreadListResultTitlesFromSessionIndex(result, indexEntries = readSessionIndexEntries()) {
  if (!result || typeof result !== "object") return result;
  const out = Object.assign({}, result);
  if (Array.isArray(out.data)) out.data = hydrateThreadListTitlesFromSessionIndex(out.data, indexEntries);
  if (Array.isArray(out.threads)) out.threads = hydrateThreadListTitlesFromSessionIndex(out.threads, indexEntries);
  return out;
}

let threadListSummaryMergeService = null;

function getThreadListSummaryMergeService() {
  if (!threadListSummaryMergeService) {
    threadListSummaryMergeService = createThreadListSummaryMergeService({
      archivedSessionThreadIds,
      mergeThreadWithCachedDisplaySummary,
      stripThreadListDetailFields,
      normalizeThreadSummaryLiveStatus,
      mergeThreadDisplaySummary,
      threadHasArchiveSignal,
      isSubagentThreadSummary,
      hydrateThreadListTitlesFromSessionIndex,
      shouldHideThreadListSummary,
      sortThreadListSummaries,
    });
  }
  return threadListSummaryMergeService;
}

function mergeThreadSummaryListWithDiagnostics(threads) {
  return getThreadListSummaryMergeService().mergeThreadSummaryListWithDiagnostics(threads);
}

function mergeThreadSummaryList(threads) {
  return getThreadListSummaryMergeService().mergeThreadSummaryList(threads);
}

function mergeThreadListFallback(result, fallbackThreads = [], limit = 80) {
  return mergeThreadListRouteResult({
    result,
    fallbackThreads,
    limit,
    mergeThreadSummaryList,
  }).result;
}

function normalizeThreadListResultStatuses(result) {
  if (!result || typeof result !== "object") return result;
  const out = Object.assign({}, result);
  if (Array.isArray(out.data)) out.data = out.data.map((thread) => stripThreadListDetailFields(normalizeThreadSummaryLiveStatus(thread)));
  if (Array.isArray(out.threads)) out.threads = out.threads.map((thread) => stripThreadListDetailFields(normalizeThreadSummaryLiveStatus(thread)));
  return stripThreadListResultDetailFields(out);
}

function threadListRowsFromResult(result) {
  if (!result || typeof result !== "object") return [];
  const rows = [];
  if (Array.isArray(result.data)) rows.push(...result.data);
  if (Array.isArray(result.threads) && result.threads !== result.data) rows.push(...result.threads);
  return rows;
}

function upsertThreadListFallbackCacheThreads(resultOrThreads, options = {}) {
  const rows = Array.isArray(resultOrThreads)
    ? resultOrThreads
    : threadListRowsFromResult(resultOrThreads);
  let changed = 0;
  for (const thread of rows) {
    if (upsertThreadListFallbackCacheThread(thread, options)) changed += 1;
  }
  return changed;
}

function threadListSummaryTimestampMs(thread) {
  if (!thread || typeof thread !== "object") return 0;
  return Math.max(
    timestampToMs(thread.updatedAtMs || thread.updated_at_ms),
    timestampToMs(thread.updatedAt || thread.updated_at),
    Number(thread.rolloutSizeUpdatedAtMs || 0),
  );
}

function sortThreadListSummaries(threads) {
  return (Array.isArray(threads) ? threads : [])
    .map((thread, index) => ({ thread, index, timestampMs: threadListSummaryTimestampMs(thread) }))
    .sort((a, b) => (b.timestampMs - a.timestampMs) || (a.index - b.index))
    .map((entry) => entry.thread);
}

function filterVisibleThreads(result, globalState = readGlobalState(), options = {}) {
  const visibility = visibilityFromGlobalState(globalState);
  const archivedIds = options.archivedIds && typeof options.archivedIds.has === "function"
    ? options.archivedIds
    : archivedSessionThreadIds();
  const annotateRolloutStats = (thread) => annotateThreadRolloutStats(thread, {
    rolloutStatsForPath: options.rolloutStatsForPath,
  });
  if (!result || typeof result !== "object") return result;
  const out = Object.assign({}, result);
  if (Array.isArray(out.data)) {
    const merged = mergeThreadStateFromStateDb(out.data, { archivedIds });
    const shouldFilterByWorkspace = anyThreadMatchesVisibleWorkspace(merged, visibility);
    out.data = merged
      .filter((thread) => !(shouldFilterByWorkspace ? isHiddenThread(thread, visibility, { archivedIds }) : shouldHideThreadListSummary(thread, archivedIds)))
      .map(annotateRolloutStats);
  }
  if (Array.isArray(out.threads)) {
    const merged = mergeThreadStateFromStateDb(out.threads, { archivedIds });
    const shouldFilterByWorkspace = anyThreadMatchesVisibleWorkspace(merged, visibility);
    out.threads = merged
      .filter((thread) => !(shouldFilterByWorkspace ? isHiddenThread(thread, visibility, { archivedIds }) : shouldHideThreadListSummary(thread, archivedIds)))
      .map(annotateRolloutStats);
  }
  return out;
}

function mergeThreadStateFromStateDb(threads, options = {}) {
  if (!Array.isArray(threads) || !threads.length || !fs.existsSync(STATE_DB)) return threads;
  const ids = Array.from(new Set(threads.map((thread) => String(thread && thread.id || "").trim()).filter(Boolean)));
  if (!ids.length) return threads;
  const inClause = ids.map((id) => sqlString(id)).join(", ");
  const query = [
    "select id,title,first_user_message,cwd,updated_at,archived,archived_at,rollout_path,model,reasoning_effort,agent_nickname,agent_role,",
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
    const archivedIds = options.archivedIds && typeof options.archivedIds.has === "function"
      ? options.archivedIds
      : archivedSessionThreadIds();
    for (const row of rows) {
      const id = String(row && row.id || "").trim();
      if (!id) continue;
      stateById.set(id, {
        name: row.title || null,
        preview: row.first_user_message || null,
        cwd: typeof row.cwd === "string" ? row.cwd.replace(/^\\\\\?\\/, "") : null,
        updatedAt: Number(row.updated_at || 0),
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
      if (state.name) next.name = state.name;
      if (state.preview && (!next.preview || String(next.preview) === String(thread.id || ""))) next.preview = state.preview;
      if (state.cwd) next.cwd = state.cwd;
      if (state.updatedAt && timestampToMs(state.updatedAt) >= timestampToMs(thread.updatedAt)) next.updatedAt = state.updatedAt;
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

function completedSupersededStatus(status) {
  const previous = statusText(status);
  const out = status && typeof status === "object" ? Object.assign({}, status) : {};
  out.type = "completed";
  out.mobileSupersededLive = true;
  if (previous && !out.previousType) out.previousType = previous;
  return out;
}

function normalizeSupersededLiveTurns(thread) {
  if (!thread || !Array.isArray(thread.turns) || thread.turns.length < 2) return thread;
  for (let index = 0; index < thread.turns.length - 1; index += 1) {
    const turn = thread.turns[index];
    if (!turn || !isLiveTurn(turn)) continue;
    turn.status = completedSupersededStatus(turn.status);
    turn.mobileSupersededLive = true;
  }
  return thread;
}

function isSupersededLiveTurn(turn) {
  return Boolean(turn && (turn.mobileSupersededLive || (turn.status && turn.status.mobileSupersededLive)));
}

function isReasoningOnlyItem(item) {
  return Boolean(item && item.type === "reasoning");
}

function isMeaningfulSupersededLiveItem(item) {
  if (!item || typeof item !== "object") return false;
  if (userMessageHasVisualAttachment(item)) return true;
  if (isUserQuestionItem(item)) return false;
  if (isReasoningOnlyItem(item)) return false;
  if (isTurnUsageSummaryItem(item)) return false;
  if (isOperationalItem(item)) return false;
  return isAssistantReceiptItem(item) || isVisualReceiptItem(item) || isTurnDiagnosticItem(item) || isContextCompactionType(item.type);
}

function pruneSupersededLiveShellTurns(thread) {
  if (!thread || !Array.isArray(thread.turns)) return thread;
  thread.turns = thread.turns.filter((turn) => {
    if (!isSupersededLiveTurn(turn)) return true;
    const items = Array.isArray(turn.items) ? turn.items : [];
    if (!items.some(isMeaningfulSupersededLiveItem)) return false;
    turn.items = items.filter((item) => (!isUserQuestionItem(item) || userMessageHasVisualAttachment(item)) && !isReasoningOnlyItem(item));
    return true;
  });
  return thread;
}

function turnIdentifier(turn) {
  return String(turn && (turn.id || turn.turnId) || "");
}

function turnTimestampFromFields(turn, fields) {
  for (const field of fields) {
    const value = timestampToMs(turn && turn[field]);
    if (value) return value;
  }
  return 0;
}

function turnStartedAtMs(turn) {
  return turnTimestampFromFields(turn, [
    "startedAtMs",
    "startedAt",
    "started_at_ms",
    "started_at",
    "createdAtMs",
    "createdAt",
    "created_at_ms",
    "created_at",
  ]);
}

function turnHasNoVisibleItems(turn) {
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  return !items.some(Boolean);
}

function isUnmaterializedLiveTurnShell(turn) {
  if (!turn || !isLiveTurn(turn) || isEndedTurn(turn)) return false;
  return turnHasNoVisibleItems(turn);
}

function itemLooksLikeActiveRuntime(item) {
  if (!item || typeof item !== "object" || isCompletedStatus(item.status)) return false;
  if (item.type === "reasoning" || isOperationalItem(item)) return true;
  if (item.type === "agentMessage" || item.type === "plan") return true;
  return isUserQuestionItem(item) || userMessageHasVisualAttachment(item);
}

function turnHasMaterializedActiveRuntime(turn) {
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  return items.some(itemLooksLikeActiveRuntime);
}

function latestMaterializedActiveTurnCandidate(turns, excludedTurnIds = new Set()) {
  for (let index = Array.isArray(turns) ? turns.length - 1 : -1; index >= 0; index -= 1) {
    const turn = turns[index];
    const turnId = turnIdentifier(turn);
    if (!turnId || excludedTurnIds.has(turnId) || isEndedTurn(turn)) continue;
    if (turnHasMaterializedActiveRuntime(turn)) return turn;
  }
  return null;
}

function rolloutEvidenceHasRuntimeActivity(evidence) {
  return Boolean(evidence && !evidence.hasTerminal
    && evidence.turnId
    && (evidence.hasVisibleUser || evidence.hasAssistant || evidence.hasOperation));
}

function rolloutEvidenceIsRecent(evidence, nowMs = Date.now()) {
  const lastActivityMs = Number(evidence && evidence.lastActivityMs || 0);
  if (!lastActivityMs) return false;
  return Math.max(0, Number(nowMs || Date.now()) - lastActivityMs) <= ROLLOUT_ACTIVE_STATUS_WINDOW_MS;
}

function rolloutLatestEvidenceForThread(thread, options = {}) {
  if (!thread || typeof thread !== "object") return null;
  let rolloutPath = rolloutPathForThread(thread);
  if (!rolloutPath && thread.id) {
    const stateThread = readStateDbThread(thread.id);
    rolloutPath = rolloutPathForThread(stateThread);
  }
  if (!rolloutPath) return null;
  let stat = options.stat || null;
  if (!stat) {
    try {
      stat = fs.statSync(rolloutPath);
    } catch (_) {
      stat = null;
    }
  }
  return rolloutLatestTurnEvidence(rolloutPath, stat);
}

function activeRuntimeEvidenceForThread(thread, options = {}) {
  const evidence = rolloutLatestEvidenceForThread(thread, options);
  if (!rolloutEvidenceHasRuntimeActivity(evidence)) return null;
  return evidence;
}

function activeStatusFromRuntimeEvidence(previousStatus) {
  const previousType = statusText(previousStatus);
  const status = {
    type: "active",
    mobileRuntimeDerived: true,
  };
  if (previousType && previousType !== "active") status.previousType = previousType;
  return status;
}

function reconcileThreadActiveTurnWithRolloutEvidence(thread, options = {}) {
  if (!thread || typeof thread !== "object" || !Array.isArray(thread.turns)) return thread;
  const turns = thread.turns;
  const shouldReconcile = isThreadListLiveStatus(thread.status)
    || Boolean(thread.activeTurnId)
    || Boolean(thread.mobileLocalActiveStatus)
    || turns.some(isLiveTurn);
  if (!shouldReconcile) return thread;
  const evidence = activeRuntimeEvidenceForThread(thread, options);
  const unmaterializedShellIds = new Set(
    turns.filter(isUnmaterializedLiveTurnShell)
      .map(turnIdentifier)
      .filter(Boolean),
  );
  if (unmaterializedShellIds.size && isThreadListRestStatus(thread.status)) {
    const dropped = [];
    thread.turns = turns.filter((turn) => {
      const turnId = turnIdentifier(turn);
      if (!turnId || !unmaterializedShellIds.has(turnId)) return true;
      dropped.push(turnId);
      return false;
    });
    if (dropped.length) {
      thread.mobileDroppedUnmaterializedRestingActiveTurn = dropped[0];
      if (dropped.includes(String(thread.activeTurnId || ""))) delete thread.activeTurnId;
      if (thread.mobileLocalActiveStatus && dropped.includes(String(thread.mobileLocalActiveStatus.turnId || ""))) {
        delete thread.mobileLocalActiveStatus;
      }
    }
    return thread;
  }
  if (!evidence && !unmaterializedShellIds.size) return thread;
  if (evidence && !rolloutEvidenceIsRecent(evidence, options.nowMs || Date.now()) && !isThreadListLiveStatus(thread.status)) {
    return thread;
  }
  const materializedCandidate = latestMaterializedActiveTurnCandidate(turns, unmaterializedShellIds);
  const activeTurnId = String((evidence && evidence.turnId) || turnIdentifier(materializedCandidate) || "").trim();
  if (!activeTurnId) return thread;

  const dropped = [];
  thread.turns = turns.filter((turn) => {
    const turnId = turnIdentifier(turn);
    if (!turnId || turnId === activeTurnId) return true;
    if (!isUnmaterializedLiveTurnShell(turn)) return true;
    dropped.push(turnId);
    return false;
  });

  const activeTurn = thread.turns.find((turn) => turnIdentifier(turn) === activeTurnId) || null;
  if (!activeTurn || isEndedTurn(activeTurn)) return thread;

  thread.status = activeStatusFromRuntimeEvidence(thread.status);
  thread.activeTurnId = activeTurnId;
  activeTurn.status = activeStatusFromRuntimeEvidence(activeTurn.status);
  if (!turnStartedAtMs(activeTurn)) {
    const startedAtMs = Number((evidence && (evidence.startedAtMs || evidence.lastActivityMs)) || 0);
    if (startedAtMs) activeTurn.startedAt = Math.floor(startedAtMs / 1000);
  }
  if (evidence) {
    thread.mobileRolloutActiveTurn = {
      turnId: activeTurnId,
      startedAtMs: Math.trunc(Number(evidence.startedAtMs || 0)),
      lastActivityMs: Math.trunc(Number(evidence.lastActivityMs || 0)),
    };
  }
  if (dropped.length) {
    thread.mobileDroppedUnmaterializedLocalActiveTurn = dropped[0];
    if (thread.mobileLocalActiveStatus && dropped.includes(String(thread.mobileLocalActiveStatus.turnId || ""))) {
      delete thread.mobileLocalActiveStatus;
    }
  }
  return thread;
}

function turnListFromResult(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result && result.data)) return result.data;
  if (Array.isArray(result && result.turns)) return result.turns;
  return [];
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
    "mobileDisplayTimestampMs",
    "mobileDisplayTimestamp",
  ]) {
    if (item && item[key] !== undefined) fields[key] = item[key];
  }
  if (item && item.mobileDisplayTimestampInferred !== undefined) {
    fields.mobileDisplayTimestampInferred = item.mobileDisplayTimestampInferred === true;
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
    disabled: "dangerFullAccess",
    "no-sandbox": "dangerFullAccess",
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
    type: profile.type || profile.kind || null,
    network: profile.network || null,
    fileSystem: fileSystem ? {
      type: fileSystem.type || null,
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

function defaultPermissionModeFromConfigDefaults() {
  const sandboxType = normalizeSandboxPolicyType(CODEX_CONFIG_DEFAULTS.sandboxMode);
  if (sandboxType === "dangerFullAccess") return "full";
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

function workspaceDelegationWriteGuardPermissionProfile(cwd, inheritedPolicy) {
  const workspace = String(cwd || "").trim();
  const policy = workspaceDelegationWriteGuardSandboxPolicy(workspace, inheritedPolicy);
  const entries = [
    {
      path: { type: "special", value: { kind: "root" } },
      access: "read",
    },
  ];
  for (const root of policy.writableRoots || []) {
    if (!root) continue;
    entries.push({
      path: { type: "path", path: root },
      access: "write",
    });
    entries.push({
      path: { type: "path", path: path.join(root, ".agents") },
      access: "read",
    });
    entries.push({
      path: { type: "path", path: path.join(root, ".codex") },
      access: "read",
    });
    entries.push({
      path: { type: "path", path: path.join(root, ".git") },
      access: "write",
    });
  }
  if (!policy.excludeSlashTmp) {
    entries.push({
      path: { type: "special", value: { kind: "slash_tmp" } },
      access: "write",
    });
  }
  if (!policy.excludeTmpdirEnvVar) {
    entries.push({
      path: { type: "special", value: { kind: "tmpdir" } },
      access: "write",
    });
  }
  return {
    type: "managed",
    fileSystem: {
      type: "restricted",
      entries,
    },
    network: policy.networkAccess ? "enabled" : "restricted",
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
    if (!cwd) return next;
    next.approvalPolicy = "on-request";
    next.sandboxPolicy = workspaceWriteSandboxPolicy(cwd, next.sandboxPolicy);
    next.sandboxMode = "workspace-write";
    next.permissionProfile = null;
    return next;
  }
  if (normalized === "auto") {
    if (!cwd) return next;
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

function incrementBoundedDiagnosticCounter(diagnostics, key, amount = 1) {
  if (!diagnostics || typeof diagnostics !== "object") return;
  if (!/^[a-z][a-zA-Z0-9]{0,80}$/.test(String(key || ""))) return;
  const current = Number(diagnostics[key] || 0);
  const delta = Number(amount || 0);
  if (!Number.isFinite(delta) || delta <= 0) return;
  const next = (Number.isFinite(current) && current > 0 ? current : 0) + delta;
  diagnostics[key] = Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(next));
}

function readRolloutTail(rolloutPath, maxBytes = MAX_ROLLOUT_CONTEXT_BYTES, options = {}) {
  if (maxBytes && typeof maxBytes === "object") {
    options = maxBytes;
    maxBytes = MAX_ROLLOUT_CONTEXT_BYTES;
  }
  if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) return "";
  let fd = null;
  try {
    const stat = fs.statSync(rolloutPath);
    const limit = Math.max(1, Number(maxBytes) || MAX_ROLLOUT_CONTEXT_BYTES);
    const start = Math.max(0, stat.size - limit);
    const length = stat.size - start;
    const buffer = Buffer.alloc(length);
    fd = fs.openSync(rolloutPath, "r");
    fs.readSync(fd, buffer, 0, length, start);
    const counterPrefix = String(options.counterPrefix || "");
    if (counterPrefix) {
      incrementBoundedDiagnosticCounter(options.diagnostics, `${counterPrefix}ReadCount`);
      incrementBoundedDiagnosticCounter(options.diagnostics, `${counterPrefix}Bytes`, length);
    }
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

function readRolloutRuntimeScanText(rolloutPath) {
  if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) return "";
  try {
    const stat = fs.statSync(rolloutPath);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_RUNTIME_CONTEXT_SCAN_BYTES) return "";
    return fs.readFileSync(rolloutPath, "utf8");
  } catch (_) {
    return "";
  }
}

function readRolloutEnrichmentText(rolloutPath) {
  const full = readRolloutRuntimeScanText(rolloutPath);
  if (full) return full;
  return readRolloutTail(rolloutPath, MAX_ROLLOUT_ENRICHMENT_CONTEXT_BYTES);
}

function readRolloutEnrichmentEntries(rolloutPath) {
  const indexed = rolloutEnrichmentIndexService.read(rolloutPath);
  if (indexed && !indexed.readError) {
    return Array.isArray(indexed.entries) ? indexed.entries : [];
  }
  return readRolloutEnrichmentText(rolloutPath)
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseJsonLine)
    .filter(Boolean);
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

function rememberRolloutFinalReceipts(key, payload) {
  latestFinalReceiptsByPath.set(key, {
    cachedAt: Date.now(),
    payload: payload || null,
  });
  while (latestFinalReceiptsByPath.size > RUNTIME_CONTEXT_CACHE_MAX) {
    const firstKey = latestFinalReceiptsByPath.keys().next().value;
    latestFinalReceiptsByPath.delete(firstKey);
  }
}

function cloneRolloutUserInputAnchorPayload(payload) {
  const byTurn = new Map();
  const sourceByTurn = payload && payload.byTurn instanceof Map ? payload.byTurn : new Map();
  for (const [turnId, items] of sourceByTurn.entries()) {
    byTurn.set(turnId, Array.isArray(items) ? items.map(clonePlainJson) : []);
  }
  return {
    byTurn,
    scopedCount: Number(payload && payload.scopedCount) || 0,
  };
}

function rememberRolloutUserInputAnchors(key, payload) {
  latestUserInputAnchorsByPath.set(key, {
    cachedAt: Date.now(),
    payload: cloneRolloutUserInputAnchorPayload(payload),
  });
  while (latestUserInputAnchorsByPath.size > RUNTIME_CONTEXT_CACHE_MAX) {
    const firstKey = latestUserInputAnchorsByPath.keys().next().value;
    latestUserInputAnchorsByPath.delete(firstKey);
  }
}

function rememberToolOutputImages(key, payload) {
  latestToolOutputImagesByPath.set(key, {
    cachedAt: Date.now(),
    payload: payload || null,
  });
  while (latestToolOutputImagesByPath.size > RUNTIME_CONTEXT_CACHE_MAX) {
    const firstKey = latestToolOutputImagesByPath.keys().next().value;
    latestToolOutputImagesByPath.delete(firstKey);
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

function visibleItemId(item) {
  return String((item && (item.id || item.itemId || item.item_id)) || "").trim();
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
  const entries = readRolloutEnrichmentEntries(rolloutPath);
  for (const entry of entries) {
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

function normalizedTurnIdSet(turnIds) {
  const ids = new Set();
  for (const id of turnIds || []) {
    const text = String(id || "").trim();
    if (text) ids.add(text);
  }
  return ids;
}

function missingUsageTurnIds(payload, turnIds) {
  const ids = normalizedTurnIdSet(turnIds);
  if (!ids.size) return [];
  const byTurnId = payload && payload.byTurnId instanceof Map ? payload.byTurnId : new Map();
  return Array.from(ids).filter((id) => !byTurnId.has(id));
}

function targetUsageCacheKey(rolloutPath, turnIds) {
  const ids = Array.from(normalizedTurnIdSet(turnIds)).sort();
  if (!ids.length) return "";
  return `${normalizeFsPath(rolloutPath)}:target-usage:${ids.join(",")}`;
}

function readRolloutTurnUsageSummaries(rolloutPath, options = {}) {
  if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) {
    return { byTurnId: new Map(), unscoped: [] };
  }
  const targetTurnIds = Array.isArray(options.targetTurnIds) ? options.targetTurnIds : [];
  const targetKey = targetUsageCacheKey(rolloutPath, targetTurnIds);
  if (targetKey) {
    const targetCached = latestTurnUsageSummariesByPath.get(targetKey);
    if (targetCached && Date.now() - targetCached.cachedAt <= RUNTIME_CONTEXT_CACHE_TTL_MS
      && missingUsageTurnIds(targetCached.payload, targetTurnIds).length === 0) {
      return targetCached.payload || { byTurnId: new Map(), unscoped: [] };
    }
  }
  let cacheKey = "";
  try {
    const stat = fs.statSync(rolloutPath);
    cacheKey = runtimeContextCacheKey(rolloutPath, stat);
    const cached = latestTurnUsageSummariesByPath.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt <= RUNTIME_CONTEXT_CACHE_TTL_MS
      && missingUsageTurnIds(cached.payload, targetTurnIds).length === 0) {
      return cached.payload || { byTurnId: new Map(), unscoped: [] };
    }
  } catch (_) {
    return { byTurnId: new Map(), unscoped: [] };
  }
  let payload = collectTurnUsageSummariesFromRolloutText(readRolloutTail(rolloutPath));
  if (missingUsageTurnIds(payload, targetTurnIds).length > 0) {
    payload = collectTurnUsageSummariesFromEntries(readRolloutEnrichmentEntries(rolloutPath));
  }
  if (cacheKey) rememberTurnUsageSummaries(cacheKey, payload);
  if (targetKey) rememberTurnUsageSummaries(targetKey, payload);
  return payload;
}

function toolOutputImageUrlValue(part) {
  if (!part || typeof part !== "object") return "";
  const raw = part.url || part.image_url || part.imageUrl || part.uri || part.href || "";
  const value = raw && typeof raw === "object" ? raw.url || raw.uri || raw.href : raw;
  return typeof value === "string" ? value.trim() : "";
}

function toolOutputImagePathValue(part) {
  if (!part || typeof part !== "object") return "";
  const candidates = [
    part.path,
    part.filePath,
    part.file_path,
    part.imagePath,
    part.image_path,
    part.savedPath,
    part.saved_path,
    part.sourcePath,
    part.source_path,
  ];
  const found = candidates.find((value) => typeof value === "string" && value.trim());
  return found ? found.trim() : "";
}

function isToolOutputImagePart(part) {
  if (!part || typeof part !== "object") return false;
  const type = String(part.type || "").replace(/[-_]/g, "").toLowerCase();
  const url = toolOutputImageUrlValue(part);
  if (/^data:image\//i.test(url)) return true;
  return type === "image"
    || type === "inputimage"
    || type === "imageurl"
    || type === "localimage"
    || type === "imageview"
    || Boolean(url && /image/i.test(type));
}

function parseToolOutputStructuredValue(value) {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!text || !/^[{\[]/.test(text)) return value;
  try {
    return JSON.parse(text);
  } catch (_) {
    return value;
  }
}

function collectToolOutputImageCandidates(value, out = [], seen = new Set(), depth = 0) {
  if (out.length >= 20 || value == null || depth > 6) return out;
  const parsed = parseToolOutputStructuredValue(value);
  if (typeof parsed === "string") {
    const text = parsed.trim();
    if (/^data:image\//i.test(text)) out.push({ url: text });
    return out;
  }
  if (Array.isArray(parsed)) {
    for (const entry of parsed) collectToolOutputImageCandidates(entry, out, seen, depth + 1);
    return out;
  }
  if (typeof parsed !== "object" || seen.has(parsed)) return out;
  seen.add(parsed);
  if (isToolOutputImagePart(parsed)) {
    const url = toolOutputImageUrlValue(parsed);
    const imagePath = toolOutputImagePathValue(parsed);
    if (url || imagePath) out.push({ url, path: imagePath });
  }
  for (const entry of Object.values(parsed)) collectToolOutputImageCandidates(entry, out, seen, depth + 1);
  return out;
}

function parseToolCallArguments(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function viewImageToolPath(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (String(payload.name || "") !== "view_image") return "";
  const args = parseToolCallArguments(payload.arguments || payload.input || payload.params);
  const candidates = [
    args.path,
    args.imagePath,
    args.image_path,
    args.filePath,
    args.file_path,
  ];
  const found = candidates.find((value) => typeof value === "string" && value.trim());
  return found ? found.trim() : "";
}

function isCodexMobileUploadFilePath(filePath) {
  const text = String(filePath || "").trim();
  if (!text) return false;
  return isPathInside(UPLOAD_ROOT, path.resolve(text));
}

function shouldSuppressToolOutputImageCandidates(callInfo) {
  return Boolean(callInfo && callInfo.tool === "view_image" && isCodexMobileUploadFilePath(callInfo.viewImagePath));
}

function toolOutputImageFingerprint(candidate) {
  return crypto
    .createHash("sha256")
    .update(String(candidate && (candidate.url || candidate.path) || ""))
    .digest("hex")
    .slice(0, 16);
}

function toolOutputImageItemFromCandidate(entry, payload, candidate, index, options = {}) {
  const fingerprint = toolOutputImageFingerprint(candidate);
  const callId = String(payload && payload.call_id || "");
  const id = `tool-output-image-${callId || "call"}-${index}-${fingerprint}`;
  const imageItem = {
    id,
    type: "imageView",
    callId,
    source: "tool_output",
    fileName: "view_image output",
    label: "view_image output",
    ...rolloutTimestampFields(entry),
  };
  if (candidate && candidate.path) imageItem.path = candidate.path;
  if (candidate && candidate.url) imageItem.url = candidate.url;
  attachGeneratedImageContent(imageItem, { threadId: options.threadId || "" });
  const isInlineDataImage = candidate && typeof candidate.url === "string" && /^data:image\//i.test(candidate.url);
  const isLocalImagePath = candidate && candidate.path;
  if ((isInlineDataImage || isLocalImagePath) && !imageItem.contentUrl && !imageItem.content_url) return null;
  return imageItem;
}

function cloneRolloutToolOutputImagePayload(payload) {
  const byTurn = new Map();
  const sourceByTurn = payload && payload.byTurn instanceof Map ? payload.byTurn : new Map();
  for (const [turnId, items] of sourceByTurn.entries()) {
    byTurn.set(turnId, Array.isArray(items) ? items.map((item) => Object.assign({}, item)) : []);
  }
  const suppressedUploadViewImageCallIdsByTurn = new Map();
  const sourceSuppressedByTurn = payload && payload.suppressedUploadViewImageCallIdsByTurn instanceof Map
    ? payload.suppressedUploadViewImageCallIdsByTurn
    : new Map();
  for (const [turnId, callIds] of sourceSuppressedByTurn.entries()) {
    suppressedUploadViewImageCallIdsByTurn.set(String(turnId || ""), new Set(callIds instanceof Set
      ? [...callIds]
      : (Array.isArray(callIds) ? callIds : [])));
  }
  const suppressedUploadViewImageCallIds = payload && payload.suppressedUploadViewImageCallIds instanceof Set
    ? new Set(payload.suppressedUploadViewImageCallIds)
    : new Set();
  return {
    byTurn,
    unscoped: Array.isArray(payload && payload.unscoped)
      ? payload.unscoped.map((item) => Object.assign({}, item))
      : [],
    scopedCount: Number(payload && payload.scopedCount) || 0,
    suppressedUploadViewImageCallIds,
    suppressedUploadViewImageCallIdsByTurn,
  };
}

function turnCompletionBoundaryMs(turn) {
  for (const key of [
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
  return 0;
}

function rolloutToolOutputImageMatchesTurnByTime(turns, index, item) {
  const timestamp = itemDisplayTimestampMs(item);
  if (!timestamp || !Array.isArray(turns) || index < 0 || index >= turns.length) return false;
  const turn = turns[index];
  const start = turnSortTimestampMs(turn);
  const nextStart = index + 1 < turns.length ? turnSortTimestampMs(turns[index + 1]) : 0;
  const completed = turnCompletionBoundaryMs(turn);
  if (!start && !nextStart && !completed) return false;
  const slackMs = 2000;
  if (start && timestamp < start - slackMs) return false;
  if (nextStart && timestamp >= nextStart - slackMs) return false;
  if (!nextStart && completed && timestamp > completed + slackMs) return false;
  return true;
}

function unscopedRolloutToolOutputImagesForTurn(turns, index, items) {
  const unscoped = Array.isArray(items) ? items : [];
  if (!unscoped.length) return [];
  const matched = unscoped.filter((item) => rolloutToolOutputImageMatchesTurnByTime(turns, index, item));
  if (matched.length) return matched;
  if (turns.length === 1 && unscoped.every((item) => !itemDisplayTimestampMs(item))) return unscoped;
  return [];
}

function insertProjectedItemByTimestamp(items, item) {
  if (!Array.isArray(items)) return;
  const timestamp = itemDisplayTimestampMs(item);
  if (!timestamp) {
    items.push(item);
    return;
  }
  const index = items.findIndex((existing) => {
    const existingTimestamp = itemDisplayTimestampMs(existing);
    return existingTimestamp && existingTimestamp > timestamp;
  });
  if (index < 0) items.push(item);
  else items.splice(index, 0, item);
}

function isRolloutFinalReceiptRestingStatus(status) {
  const text = statusText(status).toLowerCase();
  if (!text) return false;
  if (/failed|fail|cancel|error|interrupt|running|active|progress|pending/.test(text)) return false;
  return /^(idle|completed|success|succeeded|done|finished|closed)$/.test(text);
}

function canAttachRolloutFinalReceipt(status, options = {}) {
  const text = statusText(status).toLowerCase();
  if (!text) return Boolean(options.allowRestingThreadStatus);
  if (/failed|fail|cancel|error|interrupt|running|active|progress|pending/.test(text)) return false;
  if (/completed|success|succeeded|done|finished|closed/.test(text)) return true;
  return Boolean(options.allowRestingThreadStatus && /^(idle|unknown|notloaded|not_loaded|not-loaded)$/.test(text));
}

function normalizeFinalReceiptText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function assistantReceiptText(item) {
  if (!isAssistantReceiptItem(item)) return "";
  if (typeof item.text === "string") return item.text;
  if (typeof item.message === "string") return item.message;
  if (typeof item.content === "string") return item.content;
  if (Array.isArray(item.content)) {
    return item.content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        if (typeof part.text === "string") return part.text;
        if (typeof part.content === "string") return part.content;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function turnHasMatchingAssistantReceipt(turn, receiptItem) {
  const receiptId = visibleItemId(receiptItem);
  const receiptText = normalizeFinalReceiptText(assistantReceiptText(receiptItem));
  return Array.isArray(turn && turn.items) && turn.items.some((item) => {
    if (!isAssistantReceiptItem(item)) return false;
    if (receiptId && visibleItemId(item) === receiptId) return true;
    const text = normalizeFinalReceiptText(assistantReceiptText(item));
    return Boolean(receiptText && text === receiptText);
  });
}

function cloneRolloutFinalReceiptPayload(payload) {
  const byTurn = new Map();
  const sourceByTurn = payload && payload.byTurn instanceof Map ? payload.byTurn : new Map();
  for (const [turnId, item] of sourceByTurn.entries()) {
    byTurn.set(turnId, item && typeof item === "object" ? Object.assign({}, item) : item);
  }
  return {
    byTurn,
    scopedCount: Number(payload && payload.scopedCount) || 0,
  };
}

function rolloutFinalReceiptItem(entry, turnId, text) {
  const completedAtMs = rolloutCompletionTimestampMs(entry);
  const timestampFields = completedAtMs
    ? { completedAtMs, completedAt: new Date(completedAtMs).toISOString() }
    : rolloutTimestampFields(entry);
  return {
    id: `mobile-final-receipt-${turnId || stableTextHash(text)}`,
    type: "agentMessage",
    text,
    source: "rollout_task_complete",
    mobileSyntheticFinalReceipt: true,
    ...timestampFields,
  };
}

function rolloutProgressTextFromValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return redactInlineImageDataUrls(value).trim();
  if (Array.isArray(value)) {
    return value.map((entry) => rolloutProgressTextFromValue(entry)).filter(Boolean).join("\n").trim();
  }
  if (typeof value === "object") {
    if (typeof value.text === "string") return redactInlineImageDataUrls(value.text).trim();
    if (typeof value.message === "string") return redactInlineImageDataUrls(value.message).trim();
    if (typeof value.content === "string") return redactInlineImageDataUrls(value.content).trim();
    if (typeof value.output === "string") return redactInlineImageDataUrls(value.output).trim();
    if (Array.isArray(value.content)) return rolloutProgressTextFromValue(value.content);
    if (Array.isArray(value.summary)) return rolloutProgressTextFromValue(value.summary);
  }
  return "";
}

function rolloutProgressTextFromEntry(entry) {
  const payload = entry && entry.payload && typeof entry.payload === "object" ? entry.payload : {};
  if (entry && entry.type === "event_msg" && payload.type === "agent_message") {
    return rolloutProgressTextFromValue(payload.message || payload.text || payload.content || payload.summary);
  }
  if (entry && entry.type === "response_item" && payload.type === "message") {
    const role = String(payload.role || payload.author || "").toLowerCase();
    if (role === "assistant") {
      return rolloutProgressTextFromValue(payload.content || payload.message || payload.text || payload.summary);
    }
  }
  return "";
}

function rolloutProgressItem(entry, turnId, text, index) {
  const timestampFields = rolloutTimestampFields(entry);
  return {
    id: `mobile-progress-message-${turnId || "unscoped"}-${index}-${stableTextHash(text)}`,
    type: "agentMessage",
    text,
    source: "rollout_agent_message",
    mobileSyntheticProgressMessage: true,
    ...timestampFields,
  };
}

function rolloutActiveAssistantItem(entry, turnId, text, index) {
  return Object.assign({}, rolloutProgressItem(entry, turnId, text, index), {
    source: "rollout_active_assistant",
    mobileSyntheticActiveAssistant: true,
  });
}

function appendRolloutProgressMessage(progressByTurn, entry, turnId) {
  if (!turnId || THREAD_DETAIL_COMPLETED_PROGRESS_MESSAGES <= 0) return;
  const text = rolloutProgressTextFromEntry(entry);
  if (!text) return;
  const normalized = normalizeFinalReceiptText(text);
  if (!normalized) return;
  let list = progressByTurn.get(turnId);
  if (!list) {
    list = [];
    progressByTurn.set(turnId, list);
  }
  if (list.some((item) => normalizeFinalReceiptText(assistantReceiptText(item)) === normalized)) return;
  list.push(rolloutProgressItem(entry, turnId, text, list.length));
  if (list.length > THREAD_DETAIL_COMPLETED_PROGRESS_MESSAGES) {
    list.splice(0, list.length - THREAD_DETAIL_COMPLETED_PROGRESS_MESSAGES);
  }
}

function rolloutCompletionTimestampMs(entry) {
  const payload = entry && entry.payload && typeof entry.payload === "object" ? entry.payload : {};
  return timestampToMs(payload.completed_at || payload.completedAt || entry.timestamp || payload.timestamp);
}

function rolloutCompletionTurnFromEntry(entry, turnId, text, progressItems = []) {
  const payload = entry && entry.payload && typeof entry.payload === "object" ? entry.payload : {};
  const completedAtMs = rolloutCompletionTimestampMs(entry);
  const normalizedFinalText = normalizeFinalReceiptText(text);
  const seenProgress = new Set();
  const retainedProgressItems = (Array.isArray(progressItems) ? progressItems : [])
    .filter((item) => {
      const normalized = normalizeFinalReceiptText(assistantReceiptText(item));
      if (!normalized || normalized === normalizedFinalText || seenProgress.has(normalized)) return false;
      seenProgress.add(normalized);
      return true;
    })
    .slice(-THREAD_DETAIL_COMPLETED_PROGRESS_MESSAGES)
    .map(clonePlainJson);
  const durationMs = Number(payload.duration_ms || payload.durationMs || 0);
  const turn = {
    id: turnId,
    status: "completed",
    items: [...retainedProgressItems, rolloutFinalReceiptItem(entry, turnId, text)],
    source: "rollout_task_complete",
    mobileSyntheticCompletionTurn: true,
  };
  if (retainedProgressItems.length) turn.mobileSyntheticProgressMessageCount = retainedProgressItems.length;
  if (completedAtMs) {
    turn.completedAt = Math.floor(completedAtMs / 1000);
    turn.completedAtMs = completedAtMs;
  }
  if (Number.isFinite(durationMs) && durationMs > 0) {
    turn.durationMs = durationMs;
    if (completedAtMs && durationMs <= completedAtMs) {
      turn.startedAt = Math.floor((completedAtMs - durationMs) / 1000);
      turn.startedAtMs = completedAtMs - durationMs;
    }
  }
  return turn;
}

function cloneRolloutCompletionTurnPayload(payload) {
  const byTurn = new Map();
  const sourceByTurn = payload && payload.byTurn instanceof Map ? payload.byTurn : new Map();
  for (const [turnId, turn] of sourceByTurn.entries()) {
    byTurn.set(turnId, clonePlainJson(turn));
  }
  return {
    byTurn,
    scopedCount: Number(payload && payload.scopedCount) || 0,
  };
}

function cloneRolloutAssistantItemsPayload(payload) {
  const byTurn = new Map();
  const sourceByTurn = payload && payload.byTurn instanceof Map ? payload.byTurn : new Map();
  for (const [turnId, items] of sourceByTurn.entries()) {
    byTurn.set(turnId, Array.isArray(items) ? items.map(clonePlainJson) : []);
  }
  return {
    byTurn,
    scopedCount: Number(payload && payload.scopedCount) || 0,
  };
}

function readRolloutCompletionTurns(rolloutPath) {
  if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) {
    return { byTurn: new Map(), scopedCount: 0 };
  }
  let cacheKey = "";
  try {
    const stat = fs.statSync(rolloutPath);
    cacheKey = `${runtimeContextCacheKey(rolloutPath, stat)}:completion-turns`;
    const cached = latestFinalReceiptsByPath.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt <= RUNTIME_CONTEXT_CACHE_TTL_MS) {
      return cloneRolloutCompletionTurnPayload(cached.payload);
    }
  } catch (_) {
    return { byTurn: new Map(), scopedCount: 0 };
  }
  const byTurn = new Map();
  const progressByTurn = new Map();
  let scopedCount = 0;
  let currentTurnId = "";
  for (const entry of readRolloutEnrichmentEntries(rolloutPath)) {
    if (!entry || !entry.type) continue;
    const payload = entry.payload || {};
    const explicitTurnId = rolloutEntryTurnId(entry);
    if (entry.type === "turn_context" && explicitTurnId) currentTurnId = explicitTurnId;
    if (entry.type === "event_msg" && payload.type === "task_started" && explicitTurnId) currentTurnId = explicitTurnId;
    const turnId = explicitTurnId || currentTurnId;
    appendRolloutProgressMessage(progressByTurn, entry, turnId);
    if (entry.type !== "event_msg" || !/^(task_complete|task_completed)$/.test(String(payload.type || ""))) continue;
    if (!turnId) continue;
    const text = finalReceiptTextFromParams(payload);
    if (!text) continue;
    byTurn.set(turnId, rolloutCompletionTurnFromEntry(entry, turnId, text, progressByTurn.get(turnId) || []));
    scopedCount += 1;
  }
  const payload = { byTurn, scopedCount };
  if (cacheKey) rememberRolloutFinalReceipts(cacheKey, payload);
  return cloneRolloutCompletionTurnPayload(payload);
}

function readRolloutActiveAssistantItems(rolloutPath, options = {}) {
  const targetTurnIds = Array.isArray(options.targetTurnIds)
    ? options.targetTurnIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  const targetSet = new Set(targetTurnIds);
  if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath) || !targetSet.size) {
    return { byTurn: new Map(), scopedCount: 0 };
  }
  let cacheKey = "";
  try {
    const stat = fs.statSync(rolloutPath);
    cacheKey = `${runtimeContextCacheKey(rolloutPath, stat)}:active-assistant:${targetTurnIds.sort().join(",")}`;
    const cached = latestFinalReceiptsByPath.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt <= RUNTIME_CONTEXT_CACHE_TTL_MS) {
      return cloneRolloutAssistantItemsPayload(cached.payload);
    }
  } catch (_) {
    return { byTurn: new Map(), scopedCount: 0 };
  }

  const byTurn = new Map();
  let scopedCount = 0;
  let currentTurnId = "";
  for (const entry of readRolloutEnrichmentEntries(rolloutPath)) {
    if (!entry || !entry.type) continue;
    const payload = entry.payload || {};
    const explicitTurnId = rolloutEntryTurnId(entry);
    if (entry.type === "turn_context" && explicitTurnId) currentTurnId = explicitTurnId;
    if (entry.type === "event_msg" && payload.type === "task_started" && explicitTurnId) currentTurnId = explicitTurnId;
    const turnId = explicitTurnId || currentTurnId;
    if (!turnId || !targetSet.has(turnId)) continue;
    const payloadType = String(payload.type || "").toLowerCase();
    const payloadRole = String(payload.role || payload.author || "").toLowerCase();
    if (entry.type !== "response_item" || payloadType !== "message" || payloadRole !== "assistant") continue;
    const text = rolloutProgressTextFromEntry(entry);
    if (!text) continue;
    let items = byTurn.get(turnId);
    if (!items) {
      items = [];
      byTurn.set(turnId, items);
    }
    items.push(rolloutActiveAssistantItem(entry, turnId, text, items.length));
    scopedCount += 1;
  }
  const payload = { byTurn, scopedCount };
  if (cacheKey) rememberRolloutFinalReceipts(cacheKey, payload);
  return cloneRolloutAssistantItemsPayload(payload);
}

function threadUpdatedAtOnlyMs(thread) {
  return timestampToMs(thread && (thread.updatedAt || thread.updated_at || thread.updatedAtMs || thread.updated_at_ms));
}

function turnCompletionTimestampMs(turn) {
  return timestampToMs(turn && (
    turn.completedAtMs
    || turn.completedAt
    || turn.completed_at_ms
    || turn.completed_at
    || turn.finishedAt
    || turn.finished_at
  )) || turnSortTimestampMs(turn);
}

function latestExistingCompletedTurnTimestampMs(thread) {
  if (!thread || !Array.isArray(thread.turns)) return 0;
  let latest = 0;
  for (const turn of thread.turns) {
    if (!turn || isLiveTurn(turn) || !isCompletedStatus(turn.status)) continue;
    latest = Math.max(latest, turnCompletionTimestampMs(turn));
  }
  return latest;
}

function appendMissingRolloutCompletionTurnsToThread(thread) {
  if (!thread || typeof thread !== "object" || !Array.isArray(thread.turns)) return thread;
  const threadIsResting = isThreadListRestStatus(thread.status);
  const threadIsLive = isThreadListLiveStatus(thread.status);
  if (!threadIsResting && !threadIsLive) return thread;
  const rolloutPath = rolloutPathForThread(thread);
  if (!rolloutPath) return thread;
  const payload = readRolloutCompletionTurns(rolloutPath);
  if (!payload || !(payload.byTurn instanceof Map) || !payload.byTurn.size) return thread;
  const existingIds = new Set(thread.turns.map(turnIdentifier).filter(Boolean));
  const updatedAtMs = threadUpdatedAtOnlyMs(thread);
  const latestExistingCompletedMs = latestExistingCompletedTurnTimestampMs(thread);
  const candidates = Array.from(payload.byTurn.values())
    .filter((turn) => turn && turn.id && !existingIds.has(String(turn.id)))
    .filter((turn) => {
      const completedAtMs = timestampToMs(turn.completedAtMs || turn.completedAt);
      if (!completedAtMs) return false;
      if (threadIsLive) {
        return !latestExistingCompletedMs || completedAtMs >= latestExistingCompletedMs - 1000;
      }
      if (!updatedAtMs) return true;
      return completedAtMs >= updatedAtMs - 5000;
    })
    .sort((a, b) => turnSortTimestampMs(a) - turnSortTimestampMs(b));
  if (!candidates.length) return thread;
  thread.turns.push(...candidates.map(clonePlainJson));
  thread.turns = sortTurnsChronologically(thread.turns);
  thread.mobileAppendedRolloutCompletionTurn = candidates[candidates.length - 1].id || true;
  return thread;
}

function backfillMissingRolloutCompletionTurnsForDetailResult(result, details = {}) {
  if (!result || typeof result !== "object" || !result.thread || typeof result.thread !== "object") return result;
  const thread = result.thread;
  if (!Array.isArray(thread.turns)) return result;
  const readMode = String(result.readMode || thread.mobileReadMode || details.readMode || details.source || "");
  const threadIsLive = isThreadListLiveStatus(thread.status);
  if (!threadIsLive && readMode !== "projection-active-overlay") return result;
  const candidate = Object.assign({}, thread, {
    turns: thread.turns.map((turn) => clonePlainJson(turn)),
  });
  const beforeTurnCount = candidate.turns.length;
  const beforeMarker = candidate.mobileAppendedRolloutCompletionTurn || "";
  appendMissingRolloutCompletionTurnsToThread(candidate);
  if (candidate.turns.length === beforeTurnCount
    && String(candidate.mobileAppendedRolloutCompletionTurn || "") === String(beforeMarker || "")) {
    return result;
  }
  const compacted = compactThread(candidate, { maxTurns: MAX_THREAD_TURNS });
  compacted.mobileDetailCompletionBackfilled = true;
  return Object.assign({}, result, { thread: compacted });
}

function readRolloutFinalReceiptItems(rolloutPath) {
  if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) {
    return { byTurn: new Map(), scopedCount: 0 };
  }
  let cacheKey = "";
  try {
    const stat = fs.statSync(rolloutPath);
    cacheKey = runtimeContextCacheKey(rolloutPath, stat);
    const cached = latestFinalReceiptsByPath.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt <= RUNTIME_CONTEXT_CACHE_TTL_MS) {
      return cloneRolloutFinalReceiptPayload(cached.payload);
    }
  } catch (_) {
    return { byTurn: new Map(), scopedCount: 0 };
  }
  const byTurn = new Map();
  let scopedCount = 0;
  let currentTurnId = "";
  for (const entry of readRolloutEnrichmentEntries(rolloutPath)) {
    if (!entry || !entry.type) continue;
    const payload = entry.payload || {};
    const explicitTurnId = rolloutEntryTurnId(entry);
    if (entry.type === "turn_context" && explicitTurnId) currentTurnId = explicitTurnId;
    if (entry.type === "event_msg" && payload.type === "task_started" && explicitTurnId) currentTurnId = explicitTurnId;
    if (entry.type !== "event_msg" || !/^(task_complete|task_completed)$/.test(String(payload.type || ""))) continue;
    const turnId = explicitTurnId || currentTurnId;
    if (!turnId) continue;
    const text = finalReceiptTextFromParams(payload);
    if (!text) continue;
    byTurn.set(turnId, rolloutFinalReceiptItem(entry, turnId, text));
    scopedCount += 1;
  }
  const payload = { byTurn, scopedCount };
  if (cacheKey) rememberRolloutFinalReceipts(cacheKey, payload);
  return cloneRolloutFinalReceiptPayload(payload);
}

let threadCompletionDiagnosticService = null;

function getThreadCompletionDiagnosticService() {
  if (!threadCompletionDiagnosticService) {
    threadCompletionDiagnosticService = createThreadCompletionDiagnosticService({
      fs,
      cacheTtlMs: RUNTIME_CONTEXT_CACHE_TTL_MS,
      cacheMaxEntries: RUNTIME_CONTEXT_CACHE_MAX,
      cacheKeyForStat: runtimeContextCacheKey,
      finalReceiptTextFromParams,
      insertProjectedItemByTimestamp,
      isAssistantReceiptItem,
      isDiagnosticReceiptItem: isTurnDiagnosticItem,
      readRolloutEnrichmentEntries,
      rolloutCompletionTimestampMs,
      rolloutEntryTurnId,
      rolloutPathForThread,
      stableTextHash,
      visibleItemId,
    });
  }
  return threadCompletionDiagnosticService;
}

function appendRolloutEmptyCompletionDiagnosticsToThread(thread) {
  return getThreadCompletionDiagnosticService().appendEmptyCompletionDiagnosticsToThread(thread);
}

function appendRolloutFinalReceiptsToThread(thread) {
  if (!thread || typeof thread !== "object" || !Array.isArray(thread.turns) || !thread.turns.length) return thread;
  const rolloutPath = rolloutPathForThread(thread);
  if (!rolloutPath) return thread;
  const payload = readRolloutFinalReceiptItems(rolloutPath);
  if (!payload || !(payload.byTurn instanceof Map) || !payload.byTurn.size) return thread;
  const allowRestingThreadStatus = isRolloutFinalReceiptRestingStatus(thread.status);
  for (const turn of thread.turns) {
    if (!turn || !canAttachRolloutFinalReceipt(turn.status, { allowRestingThreadStatus })) continue;
    const turnId = String(turn.id || turn.turnId || "").trim();
    const item = turnId ? payload.byTurn.get(turnId) : null;
    if (!item) continue;
    if (turnHasMatchingAssistantReceipt(turn, item)) continue;
    turn.items = Array.isArray(turn.items) ? turn.items : [];
    const existingIds = new Set(turn.items.map(visibleItemId).filter(Boolean));
    const id = visibleItemId(item);
    if (!id || existingIds.has(id)) continue;
    insertProjectedItemByTimestamp(turn.items, Object.assign({}, item));
  }
  return thread;
}

function readRolloutUserInputAnchorItems(rolloutPath) {
  if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) {
    return { byTurn: new Map(), scopedCount: 0 };
  }
  let cacheKey = "";
  try {
    const stat = fs.statSync(rolloutPath);
    cacheKey = `${runtimeContextCacheKey(rolloutPath, stat)}:user-input-anchors`;
    const cached = latestUserInputAnchorsByPath.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt <= RUNTIME_CONTEXT_CACHE_TTL_MS) {
      return cloneRolloutUserInputAnchorPayload(cached.payload);
    }
  } catch (_) {
    return { byTurn: new Map(), scopedCount: 0 };
  }
  const payload = collectRolloutUserInputAnchors(readRolloutEnrichmentEntries(rolloutPath), {
    textLimit: THREAD_DETAIL_PROGRESSIVE_ACTIVE_USER_TEXT_CHARS,
    maxPerTurn: 4,
  });
  if (cacheKey) rememberRolloutUserInputAnchors(cacheKey, payload);
  return cloneRolloutUserInputAnchorPayload(payload);
}

function appendRolloutUserInputAnchorsToDetailResult(result) {
  const thread = result && result.thread;
  if (!thread || !Array.isArray(thread.turns) || !thread.turns.length) return result;
  const rolloutPath = rolloutPathForThread(thread);
  if (!rolloutPath) return result;
  const payload = readRolloutUserInputAnchorItems(rolloutPath);
  if (!payload || !(payload.byTurn instanceof Map) || !payload.byTurn.size) return result;
  const out = Object.assign({}, result, {
    thread: cloneThreadForUsageDecoration(thread),
  });
  const backfilled = appendLatestCompletedUserInputAnchors(out.thread, payload);
  if (!backfilled || backfilled.changed !== true) return result;
  out.thread = backfilled.thread;
  return out;
}

function appendRolloutActiveAssistantItemsToDetailResult(result) {
  const thread = result && result.thread;
  if (!thread || !Array.isArray(thread.turns) || !thread.turns.length) return result;
  const rolloutPath = rolloutPathForThread(thread);
  if (!rolloutPath) return result;
  const activeTurnIds = thread.turns
    .filter((turn) => turn && isLiveTurn(turn))
    .map(turnIdentifier)
    .filter(Boolean);
  if (!activeTurnIds.length) return result;
  const payload = readRolloutActiveAssistantItems(rolloutPath, { targetTurnIds: activeTurnIds });
  if (!payload || !(payload.byTurn instanceof Map) || !payload.byTurn.size) return result;
  const out = Object.assign({}, result, {
    thread: cloneThreadForUsageDecoration(thread),
  });
  let changed = false;
  for (const turn of out.thread.turns) {
    if (!turn || !isLiveTurn(turn)) continue;
    const turnId = turnIdentifier(turn);
    const rolloutItems = turnId ? payload.byTurn.get(turnId) : null;
    if (!Array.isArray(rolloutItems) || !rolloutItems.length) continue;
    turn.items = Array.isArray(turn.items) ? turn.items : [];
    const existingIds = new Set(turn.items.map(visibleItemId).filter(Boolean));
    const existingTexts = new Set(turn.items
      .filter(isAssistantReceiptItem)
      .map((item) => normalizeFinalReceiptText(assistantReceiptText(item)))
      .filter(Boolean));
    for (const item of rolloutItems) {
      const id = visibleItemId(item);
      const normalized = normalizeFinalReceiptText(assistantReceiptText(item));
      if ((id && existingIds.has(id)) || (normalized && existingTexts.has(normalized))) continue;
      insertProjectedItemByTimestamp(turn.items, clonePlainJson(item));
      if (id) existingIds.add(id);
      if (normalized) existingTexts.add(normalized);
      changed = true;
    }
    if (changed) orderTurnItemsByDisplayTimestamp(turn);
  }
  if (!changed) return result;
  out.thread.mobileActiveRolloutAssistantBackfilled = true;
  return out;
}

function syntheticActiveAssistantMessage(item) {
  return Boolean(item && isAssistantReceiptItem(item) && (
    item.mobileSyntheticProgressMessage === true
    || item.mobileSyntheticActiveAssistant === true
    || /^rollout_/i.test(String(item.source || ""))
    || /^mobile-progress-message-/.test(String(item.id || ""))
  ));
}

function nativeActiveAssistantMessage(item) {
  if (!item || !isAssistantReceiptItem(item)) return false;
  const id = String(item.id || item.itemId || item.messageId || "").trim();
  return /^msg_/i.test(id);
}

function legacySyntheticActiveAssistantMessage(item) {
  if (!item || !isAssistantReceiptItem(item)) return false;
  const id = String(item.id || item.itemId || "").trim();
  return /^item-\d+$/i.test(id);
}

function dedupeSyntheticActiveAssistantMessagesInThread(thread) {
  if (!thread || typeof thread !== "object" || !Array.isArray(thread.turns)) return { thread, removed: 0 };
  let removed = 0;
  for (const turn of thread.turns) {
    if (!turn || !isLiveTurn(turn) || !Array.isArray(turn.items) || turn.items.length < 2) continue;
    const nativeAssistantTexts = new Set();
    const nativeMessageAssistantTexts = new Set();
    const syntheticAssistantTexts = new Set();
    for (const item of turn.items) {
      if (!isAssistantReceiptItem(item)) continue;
      const normalized = normalizeFinalReceiptText(assistantReceiptText(item));
      if (!normalized) continue;
      if (syntheticActiveAssistantMessage(item)) continue;
      nativeAssistantTexts.add(normalized);
      if (nativeActiveAssistantMessage(item)) nativeMessageAssistantTexts.add(normalized);
    }
    const nextItems = [];
    for (const item of turn.items) {
      if (syntheticActiveAssistantMessage(item)) {
        const normalized = normalizeFinalReceiptText(assistantReceiptText(item));
        if (normalized && nativeAssistantTexts.has(normalized)) {
          removed += 1;
          continue;
        }
        if (normalized && syntheticAssistantTexts.has(normalized)) {
          removed += 1;
          continue;
        }
        if (normalized) syntheticAssistantTexts.add(normalized);
      } else if (legacySyntheticActiveAssistantMessage(item)) {
        const normalized = normalizeFinalReceiptText(assistantReceiptText(item));
        if (normalized && nativeMessageAssistantTexts.has(normalized)) {
          removed += 1;
          continue;
        }
      }
      nextItems.push(item);
    }
    if (nextItems.length !== turn.items.length) {
      const turnRemoved = turn.items.length - nextItems.length;
      turn.items = nextItems;
      turn.mobileSyntheticActiveAssistantDeduped = (turn.mobileSyntheticActiveAssistantDeduped || 0) + turnRemoved;
    }
  }
  if (removed) thread.mobileSyntheticActiveAssistantDeduped = (thread.mobileSyntheticActiveAssistantDeduped || 0) + removed;
  return { thread, removed };
}

function finalizeActiveAssistantProjectionDetailResult(result) {
  if (!result || typeof result !== "object" || !result.thread) return result;
  const sourceThread = result.thread;
  if (!Array.isArray(sourceThread.turns) || !sourceThread.turns.some((turn) => turn && isLiveTurn(turn))) return result;
  const thread = clonePlainJson(result.thread);
  enrichThreadItemTimestampsFromRollout(thread);
  const deduped = dedupeSyntheticActiveAssistantMessagesInThread(thread);
  return Object.assign({}, result, { thread: deduped.thread || thread });
}

function orderTurnItemsByDisplayTimestamp(turn) {
  if (!turn || !Array.isArray(turn.items) || turn.items.length < 2) return turn;
  turn.items = turn.items
    .map((item, index) => ({ item, index, timestamp: itemDisplayTimestampMs(item) }))
    .sort((left, right) => {
      if (left.timestamp && right.timestamp && left.timestamp !== right.timestamp) {
        return left.timestamp - right.timestamp;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.item);
  return turn;
}

function readRolloutToolOutputImageItems(rolloutPath, options = {}) {
  if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) {
    return {
      byTurn: new Map(),
      unscoped: [],
      scopedCount: 0,
      suppressedUploadViewImageCallIds: new Set(),
      suppressedUploadViewImageCallIdsByTurn: new Map(),
    };
  }
  let cacheKey = "";
  try {
    const stat = fs.statSync(rolloutPath);
    cacheKey = runtimeContextCacheKey(rolloutPath, stat);
    const cached = latestToolOutputImagesByPath.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt <= RUNTIME_CONTEXT_CACHE_TTL_MS) {
      return cloneRolloutToolOutputImagePayload(cached.payload);
    }
  } catch (_) {
    return {
      byTurn: new Map(),
      unscoped: [],
      scopedCount: 0,
      suppressedUploadViewImageCallIds: new Set(),
      suppressedUploadViewImageCallIdsByTurn: new Map(),
    };
  }

  const entries = readRolloutEnrichmentEntries(rolloutPath);
  const toolCallInfoById = new Map();
  const suppressedUploadViewImageCallIds = new Set();
  const suppressedUploadViewImageCallIdsByTurn = new Map();
  let currentSuppressionTurnId = "";
  for (const entry of entries) {
    if (!entry || !entry.type) continue;
    const payload = entry.payload || {};
    const explicitTurnId = rolloutEntryTurnId(entry);
    if (entry.type === "turn_context" && explicitTurnId) currentSuppressionTurnId = explicitTurnId;
    if (entry.type === "event_msg" && payload.type === "task_started" && explicitTurnId) currentSuppressionTurnId = explicitTurnId;
    if (entry.type !== "response_item" || !/^(function_call|custom_tool_call)$/.test(String(payload.type || ""))) continue;
    const callId = String(payload.call_id || "");
    if (!callId) continue;
    toolCallInfoById.set(callId, {
      tool: String(payload.name || ""),
      viewImagePath: viewImageToolPath(payload),
    });
    if (shouldSuppressToolOutputImageCandidates(toolCallInfoById.get(callId))) {
      suppressedUploadViewImageCallIds.add(callId);
      const turnId = explicitTurnId || currentSuppressionTurnId;
      if (turnId) {
        if (!suppressedUploadViewImageCallIdsByTurn.has(turnId)) {
          suppressedUploadViewImageCallIdsByTurn.set(turnId, new Set());
        }
        suppressedUploadViewImageCallIdsByTurn.get(turnId).add(callId);
      }
    }
  }
  const byTurn = new Map();
  const unscoped = [];
  const seenIds = new Set();
  const seenImageKeys = new Set();
  let scopedCount = 0;
  let currentTurnId = "";
  for (const entry of entries) {
    const payload = entry.payload || {};
    const explicitTurnId = rolloutEntryTurnId(entry);
    if (entry.type === "turn_context" && explicitTurnId) currentTurnId = explicitTurnId;
    if (entry.type === "event_msg" && payload.type === "task_started" && explicitTurnId) currentTurnId = explicitTurnId;
    if (entry.type !== "response_item" || !/^(function_call_output|custom_tool_call_output)$/.test(String(payload.type || ""))) continue;
    const callInfo = toolCallInfoById.get(String(payload.call_id || ""));
    if (shouldSuppressToolOutputImageCandidates(callInfo)) continue;
    const candidates = collectToolOutputImageCandidates(payload.output);
    if (!candidates.length) continue;
    const turnId = explicitTurnId || currentTurnId;
    const items = candidates
      .filter((candidate) => {
        const key = `${String(payload.call_id || "")}:${toolOutputImageFingerprint(candidate)}`;
        if (seenImageKeys.has(key)) return false;
        seenImageKeys.add(key);
        return true;
      })
      .map((candidate, index) => toolOutputImageItemFromCandidate(entry, payload, candidate, index, options))
      .filter(Boolean)
      .filter((item) => {
        const id = visibleItemId(item);
        if (!id || seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      });
    if (!items.length) continue;
    if (turnId) {
      if (!byTurn.has(turnId)) byTurn.set(turnId, []);
      byTurn.get(turnId).push(...items);
      scopedCount += items.length;
    } else {
      unscoped.push(...items);
    }
  }
  const payload = {
    byTurn,
    unscoped,
    scopedCount,
    suppressedUploadViewImageCallIds,
    suppressedUploadViewImageCallIdsByTurn,
  };
  if (cacheKey) rememberToolOutputImages(cacheKey, payload);
  return cloneRolloutToolOutputImagePayload(payload);
}

function appendRolloutToolOutputImagesToThread(thread, existingPayload = null) {
  if (!thread || typeof thread !== "object" || !Array.isArray(thread.turns) || !thread.turns.length) return thread;
  const rolloutPath = rolloutPathForThread(thread);
  if (!rolloutPath) return thread;
  const payload = existingPayload || readRolloutToolOutputImageItems(rolloutPath, {
    threadId: thread.id || thread.threadId || "",
  });
  if (!payload) return thread;
  thread.turns.forEach((turn, index) => {
    if (!turn || !Array.isArray(turn.items)) return;
    const turnId = String(turn.id || turn.turnId || "").trim();
    let imageItems = turnId && payload.byTurn instanceof Map ? payload.byTurn.get(turnId) : null;
    if ((!imageItems || !imageItems.length)
      && payload.scopedCount === 0
      && Array.isArray(payload.unscoped)
      && payload.unscoped.length) {
      imageItems = unscopedRolloutToolOutputImagesForTurn(thread.turns, index, payload.unscoped);
    }
    if (!Array.isArray(imageItems) || !imageItems.length) return;
    const existingIds = new Set(turn.items.map(visibleItemId).filter(Boolean));
    for (const item of imageItems) {
      const id = visibleItemId(item);
      if (!id || existingIds.has(id)) continue;
      insertProjectedItemByTimestamp(turn.items, Object.assign({}, item));
      existingIds.add(id);
    }
  });
  return thread;
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

function itemDirectTimestampMs(item) {
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

function itemDisplayTimestampMs(item) {
  return itemDirectTimestampMs(item)
    || timestampToMs(item && (item.mobileDisplayTimestampMs || item.mobileDisplayTimestamp));
}

const DISPLAY_TIMESTAMP_INFERABLE_TYPES = new Set([
  "agentMessage",
  "filePreview",
  "imageGeneration",
  "imageView",
  "plan",
  "turnDiagnostic",
  "userMessage",
]);

function itemCanUseInferredDisplayTimestamp(item) {
  return Boolean(item && DISPLAY_TIMESTAMP_INFERABLE_TYPES.has(String(item.type || "")));
}

function turnCompletedDisplayTimestampMs(turn) {
  return timestampToMs(turn && (
    turn.completedAtMs
    || turn.completedAt
    || turn.completed_at_ms
    || turn.completed_at
    || turn.finishedAt
    || turn.finished_at
    || turn.updatedAtMs
    || turn.updatedAt
  ));
}

function nearestPreviousItemDisplayTimestampMs(items, index) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const timestamp = itemDisplayTimestampMs(items[cursor]);
    if (timestamp) return timestamp;
  }
  return 0;
}

function nearestNextItemDisplayTimestampMs(items, index) {
  for (let cursor = index + 1; cursor < items.length; cursor += 1) {
    const timestamp = itemDisplayTimestampMs(items[cursor]);
    if (timestamp) return timestamp;
  }
  return 0;
}

function inferredDisplayTimestampForItem(items, index, turn) {
  const previous = nearestPreviousItemDisplayTimestampMs(items, index);
  const next = nearestNextItemDisplayTimestampMs(items, index);
  if (previous && next && next >= previous) return Math.min(next, previous + 1);
  if (previous) return previous + 1;
  if (next) return Math.max(1, next - 1);
  if (isCompletedStatus(turn && turn.status)) return turnCompletedDisplayTimestampMs(turn) || turnStartedAtMs(turn);
  return turnStartedAtMs(turn) || 0;
}

function inferTurnItemDisplayTimestamps(turn) {
  if (!turn || !Array.isArray(turn.items) || turn.items.length < 1) return turn;
  for (let index = 0; index < turn.items.length; index += 1) {
    const item = turn.items[index];
    if (!item || itemDisplayTimestampMs(item) || !itemCanUseInferredDisplayTimestamp(item)) continue;
    const timestamp = inferredDisplayTimestampForItem(turn.items, index, turn);
    if (!timestamp) continue;
    item.mobileDisplayTimestampMs = timestamp;
    item.mobileDisplayTimestamp = new Date(timestamp).toISOString();
    item.mobileDisplayTimestampInferred = true;
  }
  return turn;
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
  if (!item || !candidate || !candidate.timestampMs || itemDirectTimestampMs(item)) return;
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

function fileSizeBytes(filePath) {
  if (!filePath || typeof filePath !== "string") return 0;
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() ? stat.size : 0;
  } catch (_) {
    return 0;
  }
}

function workspaceContextStatsForCwd(cwd) {
  const root = String(cwd || "").trim();
  if (!root) {
    return {
      projectContextSizeBytes: 0,
      handoffSizeBytes: 0,
      agentsSizeBytes: 0,
      workspaceContextPairSizeBytes: 0,
      fileThresholdBytes: CONTINUATION_CONTEXT_FILE_COMPACT_BYTES,
      handoffPromptThresholdBytes: CONTINUATION_CONTEXT_HANDOFF_PROMPT_BYTES,
      pairThresholdBytes: CONTINUATION_CONTEXT_PAIR_COMPACT_BYTES,
    };
  }
  const projectContextSizeBytes = fileSizeBytes(path.join(root, ".agent-context", "PROJECT_CONTEXT.md"));
  const handoffSizeBytes = fileSizeBytes(path.join(root, ".agent-context", "HANDOFF.md"));
  return {
    projectContextSizeBytes,
    handoffSizeBytes,
    agentsSizeBytes: fileSizeBytes(path.join(root, "AGENTS.md")),
    workspaceContextPairSizeBytes: projectContextSizeBytes + handoffSizeBytes,
    fileThresholdBytes: CONTINUATION_CONTEXT_FILE_COMPACT_BYTES,
    handoffPromptThresholdBytes: CONTINUATION_CONTEXT_HANDOFF_PROMPT_BYTES,
    pairThresholdBytes: CONTINUATION_CONTEXT_PAIR_COMPACT_BYTES,
  };
}

function annotateThreadRolloutStats(thread, options = {}) {
  if (!thread || typeof thread !== "object") return thread;
  const out = Object.assign({}, thread);
  out.rolloutWarningThresholdBytes = ROLLOUT_WARNING_BYTES;
  const hasExistingRolloutStats = Number.isFinite(Number(out.rolloutSizeBytes))
    && Number.isFinite(Number(out.rolloutSizeUpdatedAtMs));
  if (options.preferExistingRolloutStats === true && hasExistingRolloutStats) {
    if (typeof out.rolloutOverWarningThreshold !== "boolean") {
      out.rolloutOverWarningThreshold = Number(out.rolloutSizeBytes || 0) >= ROLLOUT_WARNING_BYTES;
    }
    return out;
  }
  const readRolloutStats = typeof options.rolloutStatsForPath === "function"
    ? options.rolloutStatsForPath
    : rolloutStatsForPath;
  const stats = readRolloutStats(rolloutPathForThread(out));
  if (!stats) return out;
  out.rolloutSizeBytes = stats.sizeBytes;
  out.rolloutSizeUpdatedAtMs = stats.mtimeMs;
  out.rolloutOverWarningThreshold = stats.overWarningThreshold;
  return out;
}

const threadDetailProjectionInputService = createThreadDetailProjectionInputService({
  maxTurns: MAX_FULL_THREAD_TURNS,
  rolloutStatsForPath,
  statusText,
  timestampToMs,
});
const threadDetailProjectionResultService = createThreadDetailProjectionResultService({
  maxTurns: MAX_FULL_THREAD_TURNS,
  compactThreadReadResult,
  decorateThreadReadResult: attachRolloutUsageSummariesToDetailResult,
  mergeThreadDisplaySummary,
  applySessionIndexTitleToThread,
  readSessionIndexEntries,
  mergeThreadRuntimeFromStateDb,
  normalizeThreadSummaryLiveStatus,
  publicRuntimeSettings,
});
const threadDetailSummaryService = createThreadDetailSummaryService({
  readStateDbThread,
  readStartedThread,
  readRolloutSessionFallbackThread,
  readDisplaySummaryThread: (threadId) => threadDisplaySummaryCache.read(threadId),
  readThreadSummaryFromAppServer,
  mergeThreadDisplaySummary,
  applyLocalActiveThreadStatusToSummary,
  threadRolloutSizeBytes,
  appServerRefreshTtlMs: THREAD_DETAIL_SUMMARY_APP_SERVER_REFRESH_TTL_MS,
  skipAppServerRefreshWhenDisplayCachePresent: true,
});
const threadDetailBoundedReadPolicyService = createThreadDetailBoundedReadPolicyService({
  thresholdBytes: THREAD_DETAIL_TURNS_LIST_FIRST_BYTES,
  threadRolloutSizeBytes,
});
const threadDetailActiveOverlayProviderService = createThreadDetailActiveOverlayProviderService({
  projectionService: threadDetailProjectionService,
});
const threadDetailTurnsListReadCoalescer = createThreadDetailTurnsListReadCoalescer();
const threadDetailActiveWindowPrewarmService = createThreadDetailActiveWindowPrewarmService({
  resolveSummary: (requestCodex, threadId, options) => threadDetailSummaryService.resolveSummary(requestCodex, threadId, options),
  threadRuntimeSettings,
  projectionInput: threadDetailProjectionInput,
  activeOverlayProjectionWindowLookup: (input, summary, runtimeSettings, optionsForProjection = {}) => {
    const lookedUp = typeof threadDetailProjectionService.lookup === "function"
      ? threadDetailProjectionService.lookup(input, Object.assign({}, optionsForProjection, { skipNormalizeResult: true }))
      : { cached: threadDetailProjectionService.get(input, optionsForProjection), missReason: "" };
    const cached = lookedUp && lookedUp.cached || null;
    return {
      result: cached && cached.result || null,
      missReason: lookedUp && lookedUp.missReason || "",
    };
  },
  resolveActiveWindowOverlay: (input) => threadDetailActiveOverlayProviderService.resolveActiveWindowOverlay(input),
  turnsListThreadReadResult: (input) => threadDetailTurnsListReadCoalescer.read(input, ({
    threadId,
    summary,
    runtimeSettings,
    warning,
    mode,
    threadLog,
    responseBudgetEvidence,
  }) => turnsListThreadReadResult(
    threadId,
    summary,
    runtimeSettings,
    warning,
    mode,
    threadLog,
    responseBudgetEvidence,
  )),
  seedProjection: (input, result, optionsForSeed = {}) => threadDetailProjectionService.seed(input, result, optionsForSeed),
  log: (event, details) => logThreadDetail(event, details),
});
const threadDetailReadOrchestrationService = createThreadDetailReadOrchestrationService({
  attachDiagnostics: attachThreadDetailDiagnostics,
  resolveSummary: (requestCodex, threadId, options) => threadDetailSummaryService.resolveSummary(requestCodex, threadId, options),
  resolveVisibility: () => visibilityFromGlobalState(readGlobalState()),
  threadRuntimeSettings,
  isHiddenThread,
  rawAllEnabled: () => THREAD_DETAIL_RAW_ALL_ENABLED,
  readRawThread: readRawThreadDetailForOrchestrator,
  projectionInput: threadDetailProjectionInput,
  projectedThreadLookup: (input, summary, runtimeSettings, optionsForProjection = {}) => {
    const lookedUp = typeof threadDetailProjectionService.lookup === "function"
      ? threadDetailProjectionService.lookup(input, optionsForProjection)
      : { cached: threadDetailProjectionService.get(input, optionsForProjection), missReason: "" };
    return {
      result: prepareProjectedThreadReadResult(
        lookedUp && lookedUp.cached,
        summary,
        runtimeSettings,
        optionsForProjection,
      ),
      missReason: lookedUp && lookedUp.missReason || "",
    };
  },
  activeOverlayProjectionWindowLookup: (input, summary, runtimeSettings, optionsForProjection = {}) => {
    const lookedUp = typeof threadDetailProjectionService.lookup === "function"
      ? threadDetailProjectionService.lookup(input, Object.assign({}, optionsForProjection, { skipNormalizeResult: true }))
      : { cached: threadDetailProjectionService.get(input, optionsForProjection), missReason: "" };
    const cached = lookedUp && lookedUp.cached || null;
    let result = cached && cached.result || null;
    if (result && result.thread) {
      const projectionVersion = String(cached.version || result.thread.mobileProjectionVersion || "");
      const thread = Object.assign({}, result.thread);
      thread.mobileReadMode = cached.partial
        ? (projectionVersion === "v4" ? "projection-v4-partial" : "projection-partial")
        : cached.dynamic
          ? (projectionVersion === "v4" ? "projection-v4-dynamic" : "projection-dynamic")
          : (projectionVersion === "v4" ? "projection-v4-cache" : "projection-cache");
      thread.mobileProjection = Object.assign({}, thread.mobileProjection || {}, {
        source: cached.partial ? "partial" : cached.dynamic ? "dynamic" : "cache",
        version: projectionVersion || result.thread.mobileProjectionVersion || "",
        partial: cached.partial === true,
        partialKind: cached.partialKind || "",
        cachedAtMs: cached.cachedAtMs || null,
        updatedAtMs: cached.updatedAtMs || cached.cachedAtMs || null,
        ageMs: cached.updatedAtMs ? Math.max(0, Date.now() - cached.updatedAtMs) : null,
      });
      if (cached.stalePartial === true) {
        thread.mobileProjection.stalePartial = true;
        thread.mobileProjection.staleReason = cached.staleReason || "";
      }
      result = Object.assign({}, result, { thread });
    }
    return {
      result,
      missReason: lookedUp && lookedUp.missReason || "",
      stalePartial: cached && cached.stalePartial === true,
      staleReason: cached && cached.staleReason || "",
    };
  },
  projectedThreadResult: (input, summary, runtimeSettings, optionsForProjection = {}) => prepareProjectedThreadReadResult(
    threadDetailProjectionService.get(input, optionsForProjection),
    summary,
    runtimeSettings,
    optionsForProjection,
  ),
  resolveActiveWindowOverlay: (input) => threadDetailActiveOverlayProviderService.resolveActiveWindowOverlay(input),
  rememberThreadSummary: (thread) => threadDisplaySummaryCache.remember(thread),
  turnsListThreadReadResult: (input) => threadDetailTurnsListReadCoalescer.read(input, ({
    threadId,
    summary,
    runtimeSettings,
    warning,
    mode,
    threadLog,
  }) => turnsListThreadReadResult(
    threadId,
    summary,
    runtimeSettings,
    warning,
    mode,
    threadLog,
  )),
  readFullThread: readFullThreadDetailForOrchestrator,
  seedProjection: (input, result, optionsForSeed = {}) => threadDetailProjectionService.seed(input, result, optionsForSeed),
  scheduleProjectionRefresh: (input = {}) => scheduleRecentWindowProjectionRefresh(input),
  preferBoundedReadBeforeFullRead: (input) => threadDetailBoundedReadPolicyService.preferBoundedReadBeforeFullRead(input),
  prepareResponse: prepareThreadDetailResponseResult,
  compactActiveOverlayTurn: (turn, details = {}) => compactTurn(turn, {
    allowOperations: true,
    maxOperationItems: MAX_LIVE_OPERATION_ITEMS,
    threadId: details.threadId || "",
  }),
  fallbackThreadReadResult: fallbackThreadReadResultForOrchestrator,
  isReadTimeoutError,
  isUnmaterializedThreadError,
  threadRolloutSizeBytes,
  readTimeoutMs: READ_RPC_TIMEOUT_MS,
  threadDetailRpcTimeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS,
  maxThreadTurns: MAX_THREAD_TURNS,
  maxFullThreadTurns: MAX_FULL_THREAD_TURNS,
});

function threadDetailProjectionInput(threadId, summary) {
  return threadDetailProjectionInputService.projectionInput(threadId, summary);
}

function prepareProjectedThreadReadResult(cached, summary, runtimeSettings, options = {}) {
  return threadDetailProjectionResultService.prepareProjectedThreadReadResult(cached, summary, runtimeSettings, options);
}

function finalizeThreadDetailProjectionResult(result, details = {}) {
  if (THREAD_DETAIL_RAW_ALL_ENABLED) return result;
  if (!result || !result.thread || !threadDetailProjectionService
    || typeof threadDetailProjectionService.normalizeResult !== "function") return result;
  return threadDetailProjectionService.normalizeResult(result, {
    threadId: result.thread.id || details.threadId || "",
    source: details.source || result.thread.mobileReadMode || "thread-detail",
  });
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
  const model = normalizeEnumValue(
    lastString(context.model, thread && thread.model, CODEX_CONFIG_DEFAULTS.model),
    new Set(MODEL_OPTIONS),
  );
  const reasoningEffort = normalizeEnumValue(
    lastString(context.effort, context.reasoning_effort, context.model_reasoning_effort, thread && thread.effort, CODEX_CONFIG_DEFAULTS.reasoningEffort),
    new Set(REASONING_EFFORT_OPTIONS),
  );
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
    model,
    reasoningEffort,
    approvalPolicy,
    sandboxPolicy,
    sandboxMode: sandboxModeFromPolicy(sandboxPolicy),
    permissionProfile,
    reasoningSummary,
    modelVerbosity,
  };
}

async function chatGptProSourceSummary(body = {}) {
  const sourceThreadId = String(body.sourceThreadId || body.threadId || "").trim();
  const cwd = String(body.cwd || "").trim();
  const prompt = String(body.prompt || body.text || "").trim();
  const lines = [
    "Codex Mobile bounded source context for ChatGPT Pro analysis.",
    "",
    `Source thread id: ${sourceThreadId || "(none)"}`,
    `Workspace: ${cwd || "(projectless)"}`,
  ];
  let summary = null;
  if (sourceThreadId) {
    summary = readStateDbThread(sourceThreadId) || readStartedThread(sourceThreadId) || readRolloutSessionFallbackThread(sourceThreadId);
    if (!summary) {
      summary = await readThreadSummaryFromAppServer(codex, sourceThreadId).catch(() => null);
    }
  }
  if (summary) {
    lines.push(`Thread title: ${truncateSingleLine(summary.name || summary.title || summary.preview || "", 180) || "(untitled)"}`);
    lines.push(`Thread status: ${statusText(summary.status) || "unknown"}`);
    if (summary.model) lines.push(`Model: ${truncateSingleLine(summary.model, 80)}`);
    if (summary.effort) lines.push(`Reasoning effort: ${truncateSingleLine(summary.effort, 80)}`);
  }
  lines.push("");
  lines.push("Current user request:");
  lines.push(compactApprovalText(prompt, 4000));
  lines.push("");
  lines.push("Safety boundary:");
  lines.push("- This context is intentionally bounded.");
  lines.push("- Do not request or expose access keys, browser cookies, raw credentials, or full private logs.");
  lines.push("- Use repository files only when the downstream ChatGPT Pro prompt explicitly needs them and they are not secrets.");
  return lines.join("\n");
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

function workspaceDelegationWriteGuardSandboxPolicy(cwd, inheritedPolicy) {
  const policy = workspaceWriteSandboxPolicy(cwd, inheritedPolicy);
  const writableRoots = Array.isArray(policy.writableRoots) ? policy.writableRoots.slice() : [];
  for (const root of Array.isArray(policy.writableRoots) ? policy.writableRoots : []) {
    if (path.basename(root) === ".git") continue;
    const gitRoot = path.join(root, ".git");
    if (!writableRoots.includes(gitRoot)) writableRoots.push(gitRoot);
  }
  policy.writableRoots = writableRoots;
  const inheritedType = normalizeSandboxPolicyType(inheritedPolicy && inheritedPolicy.type);
  if (inheritedType === "dangerFullAccess") {
    policy.networkAccess = true;
  }
  return policy;
}

function workspaceDelegationGuardPathCandidates(cwd) {
  const raw = String(cwd || "").trim();
  if (!raw) return [];
  const candidates = [raw];
  try {
    const real = fs.realpathSync.native ? fs.realpathSync.native(raw) : fs.realpathSync(raw);
    if (real && real !== raw) candidates.push(real);
  } catch (_) {
    // Keep the raw cwd candidate when the path is not currently readable.
  }
  return candidates;
}

function workspaceDelegationGuardNormalizedPathSet(cwd) {
  return new Set(workspaceDelegationGuardPathCandidates(cwd).map((entry) => normalizeFsPath(entry)).filter(Boolean));
}

function workspaceDelegationGuardExemptCwds() {
  const separator = process.platform === "win32" ? /[;\n\r]+/ : /[:;\n\r]+/;
  return new Set(String(WORKSPACE_DELEGATION_GUARD_EXEMPT_CWDS || "")
    .split(separator)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => Array.from(workspaceDelegationGuardNormalizedPathSet(entry))));
}

function workspaceDelegationGuardHasFile(cwd, ...parts) {
  try {
    return fs.existsSync(path.join(cwd, ...parts));
  } catch (_) {
    return false;
  }
}

function workspaceDelegationGuardPackageName(cwd) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
    return String(pkg && pkg.name || "").trim();
  } catch (_) {
    return "";
  }
}

function isCodexMobileMaintenanceCwd(cwd) {
  if (WORKSPACE_DELEGATION_GUARD_SELF_EXEMPTION_DISABLED) return false;
  return workspaceDelegationGuardPackageName(cwd) === "codex-mobile-web"
    && workspaceDelegationGuardHasFile(cwd, "server.js");
}

function isHomeAiControlPlaneCwd(cwd) {
  if (WORKSPACE_DELEGATION_GUARD_PLATFORM_EXEMPTION_DISABLED) return false;
  return workspaceDelegationGuardHasFile(cwd, "scripts", "ai-ops-control-plane.js")
    && workspaceDelegationGuardHasFile(cwd, "scripts", "deploy-macos-production.js")
    && workspaceDelegationGuardHasFile(cwd, "docs", "PLATFORM_CONTRACTS", "plugin-workspace-platform-contract.md");
}

function workspaceDelegationGuardExemptCwd(cwd) {
  const normalizedCandidates = workspaceDelegationGuardNormalizedPathSet(cwd);
  if (!normalizedCandidates.size) return false;
  const explicitExemptCwds = workspaceDelegationGuardExemptCwds();
  for (const candidate of normalizedCandidates) {
    if (explicitExemptCwds.has(candidate)) return true;
  }
  return isCodexMobileMaintenanceCwd(cwd) || isHomeAiControlPlaneCwd(cwd);
}

function runtimeCwdForParams(params) {
  const explicitCwd = String(params && params.cwd || "").trim();
  if (explicitCwd) return explicitCwd;
  const threadId = String(params && params.threadId || "").trim();
  if (!threadId) return "";
  const thread = readStateDbThread(threadId) || readStartedThread(threadId) || readRolloutSessionFallbackThread(threadId) || null;
  return String(thread && thread.cwd || "").trim();
}

let workspaceSourceWriteGuardRootsCache = { roots: [], cachedAt: 0 };

function workspaceSourceWriteGuardWorkspaceRoots() {
  const now = Date.now();
  if (now - Number(workspaceSourceWriteGuardRootsCache.cachedAt || 0) < 10_000) {
    return workspaceSourceWriteGuardRootsCache.roots.slice();
  }
  const roots = new Set([...visibleWorkspaceRoots(readGlobalState())]);
  try {
    for (const thread of readThreadListFallback(300, { archived: false }) || []) {
      if (thread && thread.cwd) roots.add(thread.cwd);
    }
  } catch (_) {}
  for (const entry of recentStartedThreads.values()) {
    if (entry && entry.thread && entry.thread.cwd) roots.add(entry.thread.cwd);
  }
  workspaceSourceWriteGuardRootsCache = {
    roots: [...roots].filter(Boolean),
    cachedAt: now,
  };
  return workspaceSourceWriteGuardRootsCache.roots.slice();
}

function threadCwdForRuntimeThreadId(threadId) {
  const id = String(threadId || "").trim();
  if (!id) return "";
  const thread = readStateDbThread(id) || readStartedThread(id) || readRolloutSessionFallbackThread(id) || null;
  return String(thread && thread.cwd || "").trim();
}

function workspaceSourceWriteGuardThreadCwdForRequest(request) {
  const params = request && request.params && typeof request.params === "object" ? request.params : {};
  const threadId = pushThreadId(params)
    || String(params.threadId || params.conversationId || params.sessionId || params.thread_id || params.conversation_id || params.session_id || "").trim();
  const threadCwd = threadCwdForRuntimeThreadId(threadId);
  if (threadCwd) return threadCwd;
  const turnId = String(params.turnId || params.turn_id || params.itemTurnId || params.item_turn_id
    || params.item && (params.item.turnId || params.item.turn_id)
    || "").trim();
  const inferredThreadId = turnId ? latestThreadIdByTurnId.get(turnId) : "";
  return threadCwdForRuntimeThreadId(inferredThreadId);
}

function workspaceSourceWriteGuardCwdForRequest(request) {
  const threadCwd = workspaceSourceWriteGuardThreadCwdForRequest(request);
  if (threadCwd) return threadCwd;
  const params = request && request.params && typeof request.params === "object" ? request.params : {};
  return String(params.cwd || "").trim();
}

const workspaceSourceWriteGuardService = createWorkspaceSourceWriteGuard({
  currentCwdForRequest: workspaceSourceWriteGuardCwdForRequest,
  workspaceRoots: workspaceSourceWriteGuardWorkspaceRoots,
});

function workspaceSourceWriteGuardDecisionForRequest(request) {
  if (!workspaceDelegationPublicSettings().enabled) return null;
  if (WORKSPACE_DELEGATION_WRITE_GUARD_DISABLED) return null;
  if (!request || !ACTIONABLE_APPROVAL_METHODS.has(request.method)) return null;
  const sourceCwd = workspaceSourceWriteGuardThreadCwdForRequest(request);
  const cwd = sourceCwd || workspaceSourceWriteGuardCwdForRequest(request);
  if (cwd && workspaceDelegationGuardExemptCwd(cwd)) return null;
  return workspaceSourceWriteGuardService.classify(request);
}

function workspaceSourceWriteGuardLogPayload(request, decision, responseDecision) {
  return {
    requestId: shortIdentifier(request && request.id),
    method: request && request.method || "",
    action: decision && decision.action || "",
    responseDecision,
    reason: decision && decision.reason || "",
    threadId: shortIdentifier(pushThreadId(request && request.params || {})),
    turnId: shortIdentifier(request && request.params && (request.params.turnId || request.params.turn_id) || ""),
    cwd: compactOneLine(workspaceSourceWriteGuardCwdForRequest(request), 160),
    matchedRoot: compactOneLine(decision && decision.matchedRoot || "", 160),
  };
}

function applyWorkspaceDelegationFullAccessCompatRuntime(params, options = {}) {
  if (!params || typeof params !== "object") return params;
  params.approvalPolicy = "on-request";
  if (options.useSandboxPolicy) {
    params.sandboxPolicy = { type: "dangerFullAccess" };
    delete params.permissionProfile;
    delete params.sandbox;
  } else {
    params.sandbox = "danger-full-access";
    delete params.permissionProfile;
    delete params.sandboxPolicy;
  }
  return params;
}

function applyWorkspaceDelegationRuntimeGuard(params, settings, options = {}) {
  if (!params || typeof params !== "object") return params;
  if (!workspaceDelegationPublicSettings().enabled) return params;
  if (WORKSPACE_DELEGATION_WRITE_GUARD_DISABLED) return params;
  const cwd = runtimeCwdForParams(params);
  if (!cwd) return params;
  params.cwd = cwd;
  if (workspaceDelegationGuardExemptCwd(cwd)) return params;
  if (WORKSPACE_DELEGATION_APPROVAL_PROXY_ONLY && !WORKSPACE_DELEGATION_ENFORCE_SANDBOX_GUARD) {
    return applyWorkspaceDelegationFullAccessCompatRuntime(params, options);
  }
  params.approvalPolicy = "on-request";
  if (options.useSandboxPolicy) {
    params.sandboxPolicy = workspaceDelegationWriteGuardSandboxPolicy(cwd, settings && settings.sandboxPolicy);
    params.permissionProfile = workspaceDelegationWriteGuardPermissionProfile(cwd, settings && settings.sandboxPolicy);
    delete params.sandbox;
  } else {
    params.sandbox = "workspace-write";
    params.permissionProfile = workspaceDelegationWriteGuardPermissionProfile(cwd, settings && settings.sandboxPolicy);
    delete params.sandboxPolicy;
  }
  return params;
}

function applyResumeRuntimeSettings(params, settings) {
  if (settings) {
    if (settings.approvalPolicy) params.approvalPolicy = settings.approvalPolicy;
    if (settings.permissionProfile) params.permissionProfile = settings.permissionProfile;
    else if (settings.sandboxMode) params.sandbox = settings.sandboxMode;
    if (settings.model) params.model = settings.model;
    const config = {};
    if (settings.reasoningSummary) config.model_reasoning_summary = settings.reasoningSummary;
    if (settings.modelVerbosity) config.model_verbosity = settings.modelVerbosity;
    if (Object.keys(config).length) params.config = Object.assign({}, params.config || {}, config);
  }
  return applyWorkspaceDelegationRuntimeGuard(params, settings, { useSandboxPolicy: false });
}

function applyStartThreadRuntimeSettings(params, settings) {
  attachWorkspaceDelegationRuntimeGuidance(params);
  if (settings) {
    if (settings.approvalPolicy) params.approvalPolicy = settings.approvalPolicy;
    if (settings.permissionProfile) params.permissionProfile = settings.permissionProfile;
    else if (settings.sandboxMode) params.sandbox = settings.sandboxMode;
    if (settings.model) params.model = settings.model;
    const config = {};
    if (settings.reasoningSummary) config.model_reasoning_summary = settings.reasoningSummary;
    if (settings.modelVerbosity) config.model_verbosity = settings.modelVerbosity;
    if (Object.keys(config).length) params.config = Object.assign({}, params.config || {}, config);
  }
  return applyWorkspaceDelegationRuntimeGuard(params, settings, { useSandboxPolicy: false });
}

function applyTurnRuntimeSettings(params, settings) {
  attachWorkspaceDelegationRuntimeGuidance(params);
  if (settings) {
    if (settings.approvalPolicy) params.approvalPolicy = settings.approvalPolicy;
    if (settings.sandboxPolicy) params.sandboxPolicy = settings.sandboxPolicy;
    else if (settings.permissionProfile) params.permissionProfile = settings.permissionProfile;
    if (settings.model) params.model = settings.model;
    if (settings.reasoningEffort) params.effort = settings.reasoningEffort;
    if (settings.reasoningSummary) params.summary = settings.reasoningSummary;
  }
  return applyWorkspaceDelegationRuntimeGuard(params, settings, { useSandboxPolicy: true });
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
  if (payload.arguments && typeof payload.arguments === "object" && !Array.isArray(payload.arguments)) {
    return String(payload.arguments.command
      || payload.arguments.cmd
      || payload.arguments.shellCommand
      || payload.arguments.shell_command
      || "");
  }
  if (typeof payload.arguments === "string") {
    const parsed = parseJsonLine(payload.arguments);
    if (parsed) {
      return String(parsed.command
        || parsed.cmd
        || parsed.shellCommand
        || parsed.shell_command
        || "");
    }
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

function operationKey(item) {
  if (!item || typeof item !== "object") return "";
  const callId = String(item.callId || item.call_id || "");
  if (callId) return `${item.type || "operation"}:${callId}`;
  if (item.id) return `id:${item.id}`;
  return "";
}

function operationSignature(item) {
  if (!item || typeof item !== "object") return "";
  if (item.type === "commandExecution" && item.command) return `command:${String(item.command)}`;
  if (item.type === "fileChange" && Array.isArray(item.fileNames) && item.fileNames.length > 0) {
    return `file:${String(item.tool || "")}:${item.fileNames.join("|")}`;
  }
  if ((item.type === "dynamicToolCall" || item.type === "mcpToolCall") && item.tool) {
    return `tool:${String(item.tool)}:${String(item.action || "")}`;
  }
  if (isWebSearchLikeItem(item) && (item.command || item.action)) {
    return `web:${String(item.command || "")}:${String(item.action || "")}`;
  }
  return "";
}

function readRecentRawOperations(thread, turnId = "", options = {}) {
  const rolloutPath = thread && (thread.path || thread.rolloutPath || thread.rollout_path);
  if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) return [];
  try {
    const lines = readRolloutTail(rolloutPath).split(/\r?\n/).filter(Boolean).slice(-800);
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
    const maxOperations = Math.max(1, Math.min(50, Number(options.maxOperations || MAX_LIVE_OPERATION_ITEMS)));
    const selected = [];
    const seenOperationKeys = new Set();
    for (let index = operations.length - 1; index >= 0; index -= 1) {
      const operation = operations[index];
      const operationTurnId = String(operation.rolloutTurnId || "");
      const operationCompleted = isCompletedStatus(operation.status)
        || (operation.callId && completedCallIds.has(operation.callId));
      if (targetTurnId && operationTurnId && operationTurnId !== targetTurnId) continue;
      if (operationCompleted && !includeCompleted) continue;
      if (targetTurnId && operationCompleted && operationTurnId !== targetTurnId) continue;
      const key = operationKey(operation) || `${operation.type || "operation"}:${operation.id || index}`;
      if (seenOperationKeys.has(key)) continue;
      seenOperationKeys.add(key);
      selected.push(operation);
      if (selected.length >= maxOperations) break;
    }
    return selected.reverse();
  } catch (_) {
    return [];
  }
  return [];
}

function readLatestRawOperation(thread, turnId = "", options = {}) {
  const operations = readRecentRawOperations(thread, turnId, {
    ...options,
    maxOperations: 1,
  });
  return operations[0] || null;
}

function mergeRawOperationIntoItem(existing, rawOperation) {
  if (!existing || !rawOperation) return;
  if (rawOperation.status && (!existing.status || isCompletedStatus(rawOperation.status))) {
    existing.status = rawOperation.status;
  }
  for (const field of ["startedAt", "startedAtMs", "updatedAt", "updatedAtMs", "completedAt", "completedAtMs", "command", "tool", "action"]) {
    if (existing[field] === undefined && rawOperation[field] !== undefined) existing[field] = rawOperation[field];
  }
  if ((!Array.isArray(existing.fileNames) || existing.fileNames.length === 0)
    && Array.isArray(rawOperation.fileNames) && rawOperation.fileNames.length > 0) {
    existing.fileNames = rawOperation.fileNames;
  }
}

function mergeRecentRawOperationsIntoTurn(thread, turn, options = {}) {
  if (!turn || !Array.isArray(turn.items)) return;
  const rawOperations = readRecentRawOperations(thread, turn.id, {
    includeCompleted: true,
    maxOperations: options.maxOperations || MAX_LIVE_OPERATION_ITEMS,
  });
  if (rawOperations.length === 0) return;
  const allowNewRawOperations = isLiveTurn(turn) || options.allowNewOperations === true;

  const existingByKey = new Map();
  const existingBySignature = new Map();
  for (const item of turn.items) {
    if (!isOperationalItem(item)) continue;
    const key = operationKey(item);
    if (key) existingByKey.set(key, item);
    const signature = operationSignature(item);
    if (signature) existingBySignature.set(signature, item);
  }

  for (const rawOperation of rawOperations) {
    const key = operationKey(rawOperation);
    const signature = operationSignature(rawOperation);
    const existing = (key ? existingByKey.get(key) : null)
      || (signature ? existingBySignature.get(signature) : null);
    if (existing) {
      mergeRawOperationIntoItem(existing, rawOperation);
      continue;
    }
    if (!allowNewRawOperations) continue;
    turn.items.push(rawOperation);
    if (key) existingByKey.set(key, rawOperation);
    if (signature) existingBySignature.set(signature, rawOperation);
  }
}

function turnHasSyntheticProgressMessages(turn) {
  return Array.isArray(turn && turn.items)
    && turn.items.some((item) => item && item.mobileSyntheticProgressMessage === true);
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

const threadTurnCompactionPolicyService = createThreadTurnCompactionPolicyService({
  isLiveTurn,
  isCompletedStatus,
  isOperationalItem,
  isUserQuestionItem,
  isUserVisibleInputItem,
  isAssistantReceiptItem,
  isVisualReceiptItem,
  isTurnUsageSummaryItem,
  isDiagnosticReceiptItem: isTurnDiagnosticItem,
});

function trailingOperationIndexes(items, allowLiveOperation, maxOperations = 1) {
  return threadTurnCompactionPolicyService.trailingOperationIndexes(items, allowLiveOperation, maxOperations);
}

function isUserQuestionItem(item) {
  if (!item || typeof item !== "object") return false;
  const type = String(item.type || "").toLowerCase();
  if (type === "usermessage") return true;
  if (type === "message") {
    const role = String(item.role || item.author || "").toLowerCase();
    return role === "user";
  }
  return false;
}

function isUserVisibleInputItem(item) {
  if (isUserQuestionItem(item)) return true;
  return isContextCompactionType(item && item.type);
}

function userMessageContentParts(item) {
  return Array.isArray(item && item.content) ? item.content : [];
}

function imageUrlValueForUserMessagePart(part) {
  if (!part || typeof part !== "object") return "";
  const raw = part.url || part.image_url || part.imageUrl || "";
  if (raw && typeof raw === "object") return String(raw.url || raw.uri || raw.href || "");
  return String(raw || "");
}

function textValueForUserMessagePart(part) {
  if (!part || typeof part !== "object") return "";
  if (typeof part.text === "string") return part.text;
  if (typeof part.input_text === "string") return part.input_text;
  if (part.type === "input_text" && typeof part.content === "string") return part.content;
  return "";
}

function isImageUserMessagePart(part) {
  if (!part || typeof part !== "object") return false;
  const type = String(part.type || "");
  const url = imageUrlValueForUserMessagePart(part);
  return type === "image"
    || type === "localImage"
    || type === "input_image"
    || type === "image_url"
    || /^data:image\//i.test(url)
    || /\.(?:png|jpe?g|webp|gif)(?:[?#].*)?$/i.test(String(part.path || url || ""));
}

function textContainsRenderableUploadSummary(text) {
  const value = String(text || "");
  return /(^|\n)[ \t]*(?:>[ \t]*)?Uploaded attachments:[\s\S]*-\s+.+\(\s*image\b[\s\S]*\.codex-mobile-web[\\/]+uploads[\\/][\s\S]*\.(?:png|jpe?g|webp|gif)\b/i.test(value);
}

function normalizedCodexMobileUploadPath(filePath) {
  const text = String(filePath || "").trim();
  if (!text) return "";
  try {
    const resolved = path.resolve(text);
    return isCodexMobileUploadFilePath(resolved) ? normalizeFsPath(resolved) : "";
  } catch (_) {
    return "";
  }
}

function uploadedImagePathsFromText(text) {
  const paths = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!/\bimage\b/i.test(line)) continue;
    const match = /:\s*(.+?)\s*$/.exec(line);
    const normalized = normalizedCodexMobileUploadPath(match && match[1]);
    if (normalized) paths.push(normalized);
  }
  return paths;
}

function userMessageUploadedImagePaths(item) {
  const paths = [
    ...uploadedImagePathsFromText(item && item.text),
    ...uploadedImagePathsFromText(item && item.message),
  ];
  for (const part of userMessageContentParts(item)) {
    paths.push(...uploadedImagePathsFromText(textValueForUserMessagePart(part)));
    const imagePath = part && (part.path || imageUrlValueForUserMessagePart(part));
    const normalized = normalizedCodexMobileUploadPath(imagePath);
    if (normalized) paths.push(normalized);
  }
  return paths;
}

function userMessageHasVisualAttachment(item) {
  if (!isUserQuestionItem(item)) return false;
  if (textContainsRenderableUploadSummary(item.text) || textContainsRenderableUploadSummary(item.message)) return true;
  return userMessageContentParts(item).some((part) => {
    if (isImageUserMessagePart(part)) return true;
    return textContainsRenderableUploadSummary(textValueForUserMessagePart(part));
  });
}

function isAssistantReceiptItem(item) {
  if (!item || typeof item !== "object") return false;
  const type = String(item.type || "").toLowerCase();
  if (type === "agentmessage" || type === "plan") return true;
  if (type === "message") {
    const role = String(item.role || item.author || "").toLowerCase();
    return role === "assistant";
  }
  return false;
}

function isTurnUsageSummaryItem(item) {
  return Boolean(item && typeof item === "object" && item.type === "turnUsageSummary");
}

function isTurnDiagnosticItem(item) {
  return Boolean(item && typeof item === "object" && item.type === "turnDiagnostic");
}

function isVisualReceiptItem(item) {
  return Boolean(item && typeof item === "object" && (item.type === "imageView" || item.type === "imageGeneration"));
}

function imageViewUploadSourcePath(item) {
  if (!isVisualReceiptItem(item)) return "";
  return normalizedCodexMobileUploadPath(imageViewSourcePath(item));
}

function imageViewCallId(item) {
  return String(item && (
    item.callId
    || item.call_id
    || item.toolCallId
    || item.tool_call_id
    || item.arguments && (item.arguments.callId || item.arguments.call_id || item.arguments.toolCallId || item.arguments.tool_call_id)
    || item.result && (item.result.callId || item.result.call_id || item.result.toolCallId || item.result.tool_call_id)
  ) || "").trim();
}

function fsPathDisplayBasename(value) {
  const normalized = String(value || "").trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return normalized ? normalized.split("/").pop().toLowerCase() : "";
}

function imageViewDisplayBasename(item) {
  const source = imageViewSourcePath(item)
    || item && (item.fileName || item.file_name || item.label || item.caption || item.name || item.id);
  return fsPathDisplayBasename(source);
}

function visualReceiptSuppressionKeys(item) {
  if (!isVisualReceiptItem(item)) return [];
  const keys = new Set();
  const id = String(item && item.id || "").trim();
  const callId = imageViewCallId(item);
  const displayBasename = imageViewDisplayBasename(item);
  if (id) keys.add(`id:${id}`);
  if (callId) keys.add(`call:${callId}`);
  if (displayBasename) keys.add(`name:${displayBasename}`);
  return [...keys];
}

function suppressedUploadViewImageCallIdSet(options = {}) {
  const value = options.suppressedUploadViewImageCallIds;
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set(value.map((entry) => String(entry || "").trim()).filter(Boolean));
  return new Set();
}

function isUploadImageEchoReceipt(item, uploadBasenames, suppressedCallIds) {
  if (!isVisualReceiptItem(item)) return false;
  const callId = imageViewCallId(item);
  if (callId && suppressedCallIds.has(callId)) return true;
  const displayBasename = imageViewDisplayBasename(item);
  return Boolean(displayBasename && uploadBasenames.has(displayBasename));
}

function uploadImageEchoContextForTurnItems(items, options = {}) {
  const userUploadPaths = new Set();
  const uploadBasenames = new Set();
  for (const item of items) {
    if (!isUserQuestionItem(item)) continue;
    for (const uploadPath of userMessageUploadedImagePaths(item)) {
      userUploadPaths.add(uploadPath);
      const basename = fsPathDisplayBasename(uploadPath);
      if (basename) uploadBasenames.add(basename);
    }
  }
  return {
    userUploadPaths,
    uploadBasenames,
    suppressedCallIds: suppressedUploadViewImageCallIdSet(options),
  };
}

function shouldSuppressUploadImageEchoItem(item, context) {
  if (!context || !context.userUploadPaths || !context.userUploadPaths.size) return false;
  const imagePath = imageViewUploadSourcePath(item);
  if (imagePath && context.userUploadPaths.has(imagePath)) return true;
  return isUploadImageEchoReceipt(item, context.uploadBasenames, context.suppressedCallIds);
}

function uploadImageEchoSuppressionKeysForTurnItems(items, options = {}) {
  if (!Array.isArray(items)) return [];
  const context = uploadImageEchoContextForTurnItems(items, options);
  if (!context.userUploadPaths.size) return [];
  const keys = new Set();
  for (const callId of context.suppressedCallIds) {
    if (callId) keys.add(`call:${callId}`);
  }
  for (const item of items) {
    if (!shouldSuppressUploadImageEchoItem(item, context)) continue;
    visualReceiptSuppressionKeys(item).forEach((key) => keys.add(key));
  }
  return [...keys].sort();
}

function filterDuplicateUploadImageViewsInTurnItems(items, options = {}) {
  if (!Array.isArray(items) || items.length < 2) return items;
  const context = uploadImageEchoContextForTurnItems(items, options);
  if (!context.userUploadPaths.size) return items;
  return items.filter((item) => {
    return !shouldSuppressUploadImageEchoItem(item, context);
  });
}

function receiptOnlyItemIndexes(items) {
  return threadTurnCompactionPolicyService.receiptOnlyItemIndexes(items);
}

function isEndedTurn(turn) {
  return threadTurnCompactionPolicyService.isEndedTurn(turn);
}

function findPreviousEndedTurnIndex(turns, startIndex) {
  return threadTurnCompactionPolicyService.findPreviousEndedTurnIndex(turns, startIndex);
}

function turnHasVisibleDetailItems(turn) {
  return threadTurnCompactionPolicyService.turnHasVisibleDetailItems(turn);
}

function findPreviousVisibleNonLiveTurnIndex(turns, startIndex) {
  return threadTurnCompactionPolicyService.findPreviousVisibleNonLiveTurnIndex(turns, startIndex);
}

function operationDetailTurnIndexes(turns) {
  return threadTurnCompactionPolicyService.operationDetailTurnIndexes(turns);
}

function compactTurn(turn, options = {}) {
  if (!turn || typeof turn !== "object") return turn;
  const out = Object.assign({}, turn);
  if (Array.isArray(out.items)) {
    const suppressedVisualReceiptKeys = uploadImageEchoSuppressionKeysForTurnItems(out.items, options);
    if (suppressedVisualReceiptKeys.length) out.mobileSuppressedVisualReceiptKeys = suppressedVisualReceiptKeys;
    else delete out.mobileSuppressedVisualReceiptKeys;
    const sourceItems = filterDuplicateUploadImageViewsInTurnItems(out.items, options);
    const allowOperation = Boolean(options.allowOperations)
      || (Boolean(options.allowLiveOperation) && isLiveTurn(out));
    const operationIndexes = trailingOperationIndexes(
      sourceItems,
      allowOperation,
      options.maxOperationItems || MAX_LIVE_OPERATION_ITEMS,
    );
    const receiptIndexes = options.receiptOnly ? receiptOnlyItemIndexes(sourceItems) : null;
    out.items = sourceItems.map((item) => compactItem(item, options)).filter((item, index) => {
      if (receiptIndexes) return receiptIndexes.has(index);
      if (!isOperationalItem(item)) return true;
      return operationIndexes.has(index);
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
    pendingSteerEchoStore.injectIntoThread(out);
    reconcileThreadActiveTurnWithRolloutEvidence(out, options);
    normalizeSupersededLiveTurns(out);
    pruneSupersededLiveShellTurns(out);
    appendMissingRolloutCompletionTurnsToThread(out);
    const omitted = Math.max(0, out.turns.length - maxTurns);
    if (omitted > 0) {
      out.mobileOmittedTurnCount = omitted;
      out.turns = out.turns.slice(-maxTurns);
      out.mobileOlderTurnsCursor = olderTurnsCursorBeforeTurn(out.turns[0]);
    }
    enrichThreadItemTimestampsFromRollout(out);
    const toolOutputImagePayload = readRolloutToolOutputImageItems(rolloutPath, {
      threadId: out.id || out.threadId || "",
    });
    appendRolloutToolOutputImagesToThread(out, toolOutputImagePayload);
    appendRolloutFinalReceiptsToThread(out);
    appendRolloutEmptyCompletionDiagnosticsToThread(out);
    attachTurnUsageSummaries(out, readRolloutTurnUsageSummaries(rolloutPath, {
      targetTurnIds: out.turns.map((turn) => turn && turn.id).filter(Boolean),
    }), {
      rolloutStats,
      workspaceContextStats: workspaceContextStatsForCwd(out.cwd),
    });
    const operationDetailIndexes = operationDetailTurnIndexes(out.turns);
    for (const index of operationDetailIndexes) {
      mergeRecentRawOperationsIntoTurn(out, out.turns[index], { maxOperations: 50, allowNewOperations: true });
    }
    const latestIndex = out.turns.length - 1;
    out.turns = out.turns.map((turn, index) => compactTurn(turn, {
      allowOperations: operationDetailIndexes.has(index) && !turnHasSyntheticProgressMessages(turn),
      maxOperationItems: operationDetailIndexes.has(index) && !turnHasSyntheticProgressMessages(turn) ? "all" : MAX_LIVE_OPERATION_ITEMS,
      receiptOnly: !operationDetailIndexes.has(index),
      threadId: out.id || out.threadId || "",
      suppressedUploadViewImageCallIds: toolOutputImagePayload.suppressedUploadViewImageCallIdsByTurn instanceof Map
        ? toolOutputImagePayload.suppressedUploadViewImageCallIdsByTurn.get(String(turn && turn.id || "")) || new Set()
        : new Set(),
    })).map(inferTurnItemDisplayTimestamps).map(orderTurnItemsByDisplayTimestamp);
    const latest = out.turns[latestIndex];
    if (latest && isLiveTurn(latest) && Array.isArray(latest.items)
      && !latest.items.some((item) => isOperationalItem(item))) {
      const rawOperation = readLatestRawOperation(out, latest.id, { includeCompleted: true });
      if (rawOperation) latest.items.push(rawOperation);
    }
    dedupeUserMessageEchoesInThread(out);
  }
  return normalizeStaleContextOnlyActiveThread(annotateThreadRolloutStats(out), options);
}

function compactThreadReadResult(result, options = {}) {
  if (!result || typeof result !== "object") return result;
  const out = Object.assign({}, result);
  if (out.thread) out.thread = compactThread(out.thread, options);
  return out;
}

function compactTurnsListResult(result, options = {}) {
  if (!result || typeof result !== "object") return result;
  const out = Object.assign({}, result);
  const enrich = (turns) => {
    const threadId = String(options.threadId || "").trim();
    const summary = options.summary && typeof options.summary === "object" ? options.summary : {};
    const thread = Object.assign({}, summary, { id: threadId || summary.id || summary.threadId || "", turns });
    appendRolloutFinalReceiptsToThread(thread);
    return Array.isArray(thread.turns) ? thread.turns : turns;
  };
  if (Array.isArray(out.data)) out.data = enrich(out.data).map((turn) => compactTurn(turn, { receiptOnly: true }));
  if (Array.isArray(out.turns)) out.turns = enrich(out.turns).map((turn) => compactTurn(turn, { receiptOnly: true }));
  return out;
}

function olderTurnsCursorBeforeTurn(turn) {
  const turnId = String(turn && turn.id || turn && turn.turnId || "").trim();
  if (!turnId) return null;
  return JSON.stringify({ turnId, includeAnchor: false });
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

function isTrustedLiveRateLimitSource(source) {
  return source === "managed-child-live" || source === "profile-mux-live";
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
  const source = String(options.source || "live");
  if (options.source === "rollout") {
    latestSnapshotRateLimits = compacted;
    return storeRateLimits(compacted, latestSnapshotRateLimitsByModel);
  }
  if (!isRateLimitRolloutSourceAccountScoped(CODEX_HOME) && !isTrustedLiveRateLimitSource(source)) {
    latestLiveRateLimits = null;
    latestLiveRateLimitsSource = null;
    latestLiveRateLimitsByModel.clear();
    return null;
  }
  latestLiveRateLimits = compacted;
  latestLiveRateLimitsSource = source;
  return storeRateLimits(compacted, latestLiveRateLimitsByModel);
}

function recordRateLimitReadResult(value, options = {}) {
  if (!value || typeof value !== "object") return null;
  const source = String(options.source || "live");
  if (source !== "rollout" && !isRateLimitRolloutSourceAccountScoped(CODEX_HOME) && !isTrustedLiveRateLimitSource(source)) {
    latestLiveRateLimits = null;
    latestLiveRateLimitsSource = null;
    latestLiveRateLimitsByModel.clear();
    return null;
  }

  const snapshots = [];
  const addSnapshot = (raw, fallbackLimitId = "") => {
    if (!raw || typeof raw !== "object") return;
    const candidate = fallbackLimitId && !raw.limitId
      ? Object.assign({ limitId: fallbackLimitId }, raw)
      : raw;
    const compacted = compactRateLimits(candidate);
    if (!compacted || !hasCurrentRateLimitWindow(compacted)) return;
    snapshots.push(compacted);
  };

  addSnapshot(value.rateLimits);
  if (value.rateLimitsByLimitId && typeof value.rateLimitsByLimitId === "object") {
    for (const [limitId, snapshot] of Object.entries(value.rateLimitsByLimitId)) {
      addSnapshot(snapshot, limitId);
    }
  }

  if (snapshots.length === 0) return null;
  const targetMap = source === "rollout" ? latestSnapshotRateLimitsByModel : latestLiveRateLimitsByModel;
  for (const snapshot of snapshots) storeRateLimits(snapshot, targetMap);
  const preferred = snapshots.find((snapshot) => normalizeModelKey(snapshot.limitId) === "codex") || snapshots[0];
  if (source === "rollout") {
    latestSnapshotRateLimits = preferred;
  } else {
    latestLiveRateLimits = preferred;
    latestLiveRateLimitsSource = source;
  }
  return preferred;
}

function canExposeRateLimitsForActiveHome() {
  return isRateLimitRolloutSourceAccountScoped(CODEX_HOME) || isTrustedLiveRateLimitSource(latestLiveRateLimitsSource);
}

function activeRateLimits() {
  if (!canExposeRateLimitsForActiveHome()) return null;
  return latestLiveRateLimits || latestSnapshotRateLimits;
}

function activeRateLimitsByModelMap() {
  if (!canExposeRateLimitsForActiveHome()) return new Map();
  return latestLiveRateLimitsByModel.size ? latestLiveRateLimitsByModel : latestSnapshotRateLimitsByModel;
}

function liveQuotaSnapshotForProfiles() {
  if (!canExposeRateLimitsForActiveHome()) {
    return { rateLimits: null, rateLimitsByModel: {}, source: null };
  }
  return {
    rateLimits: latestLiveRateLimits,
    rateLimitsByModel: Object.fromEntries([...latestLiveRateLimitsByModel.entries()]),
    source: latestLiveRateLimits ? (latestLiveRateLimitsSource || "active-live") : null,
  };
}

function compareRecentRolloutDirents(left, right) {
  const leftIsDir = Boolean(left && typeof left.isDirectory === "function" && left.isDirectory());
  const rightIsDir = Boolean(right && typeof right.isDirectory === "function" && right.isDirectory());
  if (leftIsDir !== rightIsDir) return leftIsDir ? -1 : 1;
  const leftName = String(left && left.name || "");
  const rightName = String(right && right.name || "");
  if (leftName === rightName) return 0;
  return leftName < rightName ? 1 : -1;
}

function collectRecentRolloutFiles(root, options = {}) {
  const maxFiles = Number(options.maxFiles || 160);
  const maxDepth = Number(options.maxDepth || 6);
  const diagnostics = options.diagnostics && typeof options.diagnostics === "object" ? options.diagnostics : null;
  const out = [];
  const visit = (dir, depth) => {
    if (out.length >= maxFiles * 4 || depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
      incrementBoundedDiagnosticCounter(diagnostics, "rolloutDirectoryReadCount");
    } catch (_) {
      return;
    }
    for (const entry of entries.sort(compareRecentRolloutDirents)) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath, depth + 1);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
      try {
        incrementBoundedDiagnosticCounter(diagnostics, "rolloutFileStatCount");
        const stat = fs.statSync(fullPath);
        out.push({ path: fullPath, mtimeMs: Number(stat.mtimeMs || 0), size: Number(stat.size || 0) });
        incrementBoundedDiagnosticCounter(diagnostics, "rolloutFileCollectedCount");
      } catch (_) {
        // A rollout may disappear while the app rotates files.
      }
    }
  };
  visit(root, 0);
  incrementBoundedDiagnosticCounter(diagnostics, "rolloutFileSortedCount", out.length);
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
  if (!isRateLimitRolloutSourceAccountScoped(CODEX_HOME)) return;
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

function codeGraphMcpElicitationToolName(request) {
  if (!request || request.method !== "mcpServer/elicitation/request") return "";
  const params = request.params && typeof request.params === "object" ? request.params : {};
  const candidates = [
    params.serverName,
    params.server_name,
    params.server,
    params.mcpServer,
    params.mcp_server,
    params.toolName,
    params.tool_name,
    params.name,
    params.title,
    params.message,
    params.elicitation,
    params.schema,
  ];
  const text = candidates.map((value) => (typeof value === "string" ? value : JSON.stringify(value || ""))).join("\n");
  const explicitServer = [params.serverName, params.server_name, params.server, params.mcpServer, params.mcp_server]
    .some((value) => /^codegraph$/i.test(String(value || "").trim()) || /\bcodegraph\b/i.test(String(value || "")));
  const messageMentionsCodeGraphServer = /\bcodegraph\b[\s-]*(?:MCP\s+)?server\b/i.test(text);
  if (!explicitServer && !messageMentionsCodeGraphServer) return "";
  const quoted = /\bcodegraph MCP server\b[\s\S]*?\btool\s+["“]([^"”]+)["”]/i.exec(text);
  const raw = quoted ? quoted[1] : ((/\b(codegraph_[a-z0-9_]+)\b/i.exec(text) || [])[1] || "");
  const toolName = String(raw || "").trim();
  return CODEGRAPH_READONLY_MCP_TOOLS.has(toolName) ? toolName : "";
}

function codeGraphReadOnlyMcpElicitationDecision(request) {
  const toolName = codeGraphMcpElicitationToolName(request);
  return toolName ? { action: "allow", toolName } : null;
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

const runtimeSettingsService = createRuntimeSettingsService({
  runtimeSettingsFile: RUNTIME_SETTINGS_FILE,
  timestampToMs,
  workspaceDelegationEnvDefault: WORKSPACE_DELEGATION_ENV_DEFAULT,
  workspaceDelegationToolFullName: WORKSPACE_DELEGATION_TOOL_FULL_NAME,
});
const {
  readJsonFile,
  readRuntimeSettings,
  setThreadDisplaySettings,
  setWorkspaceDelegationEnabled,
  threadDisplayPublicSettings,
  writeRuntimeJson,
  writeRuntimeSettings,
  workspaceDelegationPublicSettings,
} = runtimeSettingsService;

threadTaskCardRouteService = createThreadTaskCardRouteService({
  appRoot: APP_ROOT,
  threadTaskCardService,
  threadTaskCardDraftTag: THREAD_TASK_CARD_DRAFT_TAG,
  threadTaskCardBodyMaxChars: THREAD_TASK_CARD_BODY_MAX_CHARS,
  workspaceDelegationToolNamespace: WORKSPACE_DELEGATION_TOOL_NAMESPACE,
  workspaceDelegationToolName: WORKSPACE_DELEGATION_TOOL_NAME,
  taskCardReturnToolName: TASK_CARD_RETURN_TOOL_NAME,
  reasoningEffortOptions: REASONING_EFFORT_OPTIONS,
  readRuntimeSettings,
  workspaceDelegationPublicSettings,
  readStateDbThread,
  readStartedThread,
  readRolloutSessionFallbackThread,
  hydrateThreadTitleFromSessionIndex,
  readThreadListFallback,
  visibilityFromGlobalState,
  threadHasArchiveSignal,
  isHiddenThread,
  isSubagentThreadSummary,
  isSideChatSidecarThreadSummary,
  normalizeFsPath,
  threadDisplayTitle,
  isRecoverableThreadListTitle,
  stableTextHash,
  truncateSingleLine,
  truncateToolDescriptionText,
  shortIdentifier,
  pushThreadId,
  threadIdForTurnId: (turnId) => latestThreadIdByTurnId.get(turnId),
  attachThreadTaskCardsToResult,
  attachPendingServerRequestsToResult,
  httpStatusError,
  createTargetError: (statusCode, code, message, details = {}) => httpStatusErrorWithDetails(statusCode, code, message || code, details),
  logger: console,
});
const webPushRuntimeService = createWebPushRuntimeService({
  fs,
  readJsonFile,
  writeRuntimeJson,
  vapidFile: process.env.CODEX_MOBILE_PUSH_VAPID_FILE || path.join(RUNTIME_ROOT, "web-push-vapid.json"),
  subscriptionsFile: process.env.CODEX_MOBILE_PUSH_SUBSCRIPTIONS_FILE || path.join(RUNTIME_ROOT, "web-push-subscriptions.json"),
  defaultSubject: "mailto:codex-mobile-web@example.com",
  subject: process.env.CODEX_MOBILE_PUSH_SUBJECT || "",
  subjectConfigured: Boolean(process.env.CODEX_MOBILE_PUSH_SUBJECT),
  ttlSeconds: process.env.CODEX_MOBILE_PUSH_TTL_SECONDS || "3600",
  stateDb: STATE_DB,
  userHome: USER_HOME,
  runSqliteJson,
  sqlString,
  isSidecarThreadId: (threadId) => threadSideChatService.isSidecarThreadId(threadId),
  shouldTrackTurnForWebPush,
  completedTurnHasNoFinalAgentMessage,
  resolveThreadTitleForNotification,
  threadDisplaySummaryCache,
  readStateDbThread,
  readStartedThread,
  readThreadSummaryFromAppServer: (threadId) => readThreadSummaryFromAppServer(codex, threadId),
  buildTurnCompletionDetailMessage,
  turnCompletionUsageSummary,
  hermesNotificationDelegateService,
  pushTurnId,
  pushThreadId,
  isOldTurnEvent: isOldPushTurnEvent,
  turnTimestampMs,
  shortIdentifier,
  logger: console,
});

function truncateToolDescriptionText(value, maxChars = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 3)).trimEnd()}...`;
}

function workspaceDelegationTargetHints() {
  return threadTaskCardRouteService.workspaceDelegationTargetHints();
}

function workspaceDelegationDynamicToolSpec() {
  return threadTaskCardRouteService.workspaceDelegationDynamicToolSpec();
}

function taskCardReturnDynamicToolSpec() {
  return threadTaskCardRouteService.taskCardReturnDynamicToolSpec();
}

function taskCardRuntimeDynamicTools(settings = readRuntimeSettings()) {
  return threadTaskCardRouteService.taskCardRuntimeDynamicTools(settings);
}

function workspaceDelegationDynamicTools(settings = readRuntimeSettings()) {
  return threadTaskCardRouteService.workspaceDelegationDynamicTools(settings);
}

function attachTaskCardRuntimeDynamicTools(params, settings = readRuntimeSettings()) {
  return threadTaskCardRouteService.attachTaskCardRuntimeDynamicTools(params, settings);
}

function workspaceDelegationScriptFallbackInstruction(params = {}) {
  return threadTaskCardRouteService.workspaceDelegationScriptFallbackInstruction(params);
}

function taskCardReturnScriptFallbackInstruction(params = {}) {
  return threadTaskCardRouteService.taskCardReturnScriptFallbackInstruction(params);
}

function attachWorkspaceDelegationRuntimeGuidance(params, settings = readRuntimeSettings()) {
  return threadTaskCardRouteService.attachWorkspaceDelegationRuntimeGuidance(params, settings);
}

function workspaceDelegationDynamicToolName(tool) {
  if (!tool || typeof tool !== "object") return "";
  const fullName = String(tool.fullName || tool.toolFullName || tool.dynamicTool || "").trim();
  if (fullName) return fullName;
  const namespace = String(tool.namespace || tool.toolNamespace || tool.dynamicToolNamespace || "").trim();
  const name = String(tool.name || tool.toolName || tool.tool || tool.action || "").trim();
  return namespace && name ? `${namespace}.${name}` : name;
}

function workspaceDelegationRpcDynamicToolNames(params = {}) {
  const raw = Array.isArray(params.dynamicTools)
    ? params.dynamicTools
    : params.dynamicTools ? [params.dynamicTools] : [];
  const seen = new Set();
  const names = [];
  for (const tool of raw) {
    const name = workspaceDelegationDynamicToolName(tool);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

function workspaceDelegationRpcDiagnostics(method, params = {}) {
  const toolNames = workspaceDelegationRpcDynamicToolNames(params);
  const developerInstructions = String(params.developerInstructions || "");
  const cwd = String(params.cwd || "").trim();
  const sandboxPolicy = params.sandboxPolicy && typeof params.sandboxPolicy === "object"
    ? params.sandboxPolicy
    : null;
  const permissionProfile = params.permissionProfile && typeof params.permissionProfile === "object"
    ? params.permissionProfile
    : null;
  return {
    method: String(method || ""),
    threadId: truncateToolDescriptionText(params.threadId || params.thread_id || "", 80),
    cwd: truncateToolDescriptionText(cwd, 220),
    workspaceDelegationEnabled: workspaceDelegationPublicSettings().enabled,
    dynamicToolsCount: toolNames.length,
    dynamicToolNames: toolNames.map((name) => truncateToolDescriptionText(name, 120)),
    hasWorkspaceDelegationTool: toolNames.includes(WORKSPACE_DELEGATION_TOOL_FULL_NAME),
    hasFallbackGuidance: developerInstructions.includes("Codex Mobile cross-thread delegation fallback:"),
    developerInstructionsChars: developerInstructions.length,
    sandbox: truncateToolDescriptionText(params.sandbox || "", 80),
    sandboxPolicyType: truncateToolDescriptionText(
      sandboxPolicy && (sandboxPolicy.type || sandboxPolicy.kind || sandboxPolicy.mode) || "",
      80,
    ),
    approvalPolicy: truncateToolDescriptionText(params.approvalPolicy || params.approval_policy || "", 80),
    permissionProfileType: truncateToolDescriptionText(
      permissionProfile && (permissionProfile.type || permissionProfile.kind || permissionProfile.mode) || "",
      80,
    ),
  };
}

function shouldLogWorkspaceDelegationRpc(method, params = {}) {
  if (!["thread/start", "turn/start", "thread/resume"].includes(String(method || ""))) return false;
  if (workspaceDelegationPublicSettings().enabled) return true;
  if (workspaceDelegationRpcDynamicToolNames(params).length) return true;
  return String(params.developerInstructions || "").includes("Codex Mobile cross-thread delegation fallback:");
}

function logWorkspaceDelegationRpc(method, params = {}) {
  if (!shouldLogWorkspaceDelegationRpc(method, params)) return;
  try {
    console.log(`[workspace-delegation-rpc] ${JSON.stringify(workspaceDelegationRpcDiagnostics(method, params))}`);
  } catch (err) {
    console.error(`[workspace-delegation-rpc] failed to summarize request: ${err.message || String(err)}`);
  }
}

function pushSubscriptionPublicStatus() {
  return webPushRuntimeService.publicStatus();
}

function classifyWebPushThreadId(threadId) {
  return webPushRuntimeService.classifyThreadId(threadId);
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

function rememberThreadIdForTurnId(threadId, turnId) {
  const tid = String(turnId || "").trim();
  const sid = String(threadId || "").trim();
  if (!tid || !sid) return;
  latestThreadIdByTurnId.set(tid, sid);
  while (latestThreadIdByTurnId.size > RUNTIME_CONTEXT_CACHE_MAX) {
    const firstKey = latestThreadIdByTurnId.keys().next().value;
    latestThreadIdByTurnId.delete(firstKey);
  }
}

function rememberThreadIdForTurnParams(method, params) {
  if (!params || typeof params !== "object") return;
  if (method !== "turn/started" && method !== "turn/completed" && method !== "item/started" && method !== "item/completed") return;
  const turnId = pushTurnId(params)
    || String(params.turn_id || params.itemTurnId || params.item_turn_id || params.item && (params.item.turnId || params.item.turn_id) || "").trim();
  const threadId = pushThreadId(params)
    || String(params.itemThreadId || params.item_thread_id || params.item && (params.item.threadId || params.item.thread_id) || "").trim();
  rememberThreadIdForTurnId(threadId, turnId);
}

function pushThreadSummary(threadId) {
  const id = String(threadId || "");
  return id ? (threadDisplaySummaryCache.read(id) || readStateDbThread(id) || readStartedThread(id) || null) : null;
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
  const completed = {
    threadId,
    turnId,
    completedAt: new Date(completedAtMs).toISOString(),
    finalReceiptText: finalReceiptTextFromParams(params),
  };
  threadTaskCardService.maybeAutoReplyCompletedTurn(completed).catch((err) => {
    console.error(`[thread task card] auto-return failed: ${err.message || String(err)}`);
  });
  threadTaskCardService.maybeResumeInterruptedTaskCard(completed).catch((err) => {
    console.error(`[thread task card] interruption resume failed: ${err.message || String(err)}`);
  });
}

function maybeApplyQueuedThreadSideChat(method, params) {
  threadSideChatOrchestrationService.maybeApplyQueuedThreadSideChat(method, params);
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

function maybeSendTurnCompletedPush(method, params) {
  return webPushRuntimeService.maybeSendTurnCompletedPush(method, params);
}

function broadcast(payload) {
  if (payload && payload.type === "notification") {
    updateLocalActiveThreadStatusFromNotification(payload);
    const statusPayload = threadStatusChangedPayloadFromTurnNotification(payload);
    if (statusPayload) {
      applyThreadStatusPayloadToThreadListFallbackCache(statusPayload);
      broadcast(statusPayload);
    }
    try {
      threadDetailProjectionService.applyNotification(payload.method, payload.params || {});
    } catch (err) {
      console.error(`[thread projection] notification update failed: ${err.message || String(err)}`);
    }
    scheduleActiveWindowPrewarmFromNotification(payload);
  }
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

function threadSummaryLooksActive(summary) {
  if (!summary || typeof summary !== "object") return false;
  if (summary.activeTurnId || summary.active_turn_id) return true;
  const local = summary.mobileLocalActiveStatus && typeof summary.mobileLocalActiveStatus === "object"
    ? summary.mobileLocalActiveStatus
    : null;
  if (local && (local.turnId || local.turn_id)) return true;
  const statusValue = summary.status && typeof summary.status === "object"
    ? summary.status.type
    : summary.status || summary.mobileStatus || local && local.status;
  return /^(active|running|started|pending|queued|processing|inprogress|in_progress|in-progress)$/i
    .test(String(statusValue || "").trim());
}

function scheduleActiveWindowPrewarm(threadId, summary = null, reason = "", options = {}) {
  const id = String(threadId || summary && (summary.id || summary.threadId || summary.thread_id) || "").trim();
  if (!id) return { scheduled: false, reason: "missing-thread-id" };
  return threadDetailActiveWindowPrewarmService.schedule({
    codex,
    threadId: id,
    summary,
    reason,
    delayMs: options.delayMs,
    bypassMinInterval: options.bypassMinInterval === true,
    preemptPending: options.preemptPending === true,
    threadLog: (event, details = {}) => logThreadDetail(`active_window_prewarm_${event}`, Object.assign({ threadId: id }, details)),
  });
}

const recentWindowProjectionRefreshPending = new Map();

function scheduleRecentWindowProjectionRefresh(input = {}) {
  const id = String(input.threadId || input.summary && (input.summary.id || input.summary.threadId || input.summary.thread_id) || "").trim();
  if (!id) return { scheduled: false, reason: "missing-thread-id" };
  if (!input.projection) return { scheduled: false, reason: "projection-input-unavailable" };
  if (recentWindowProjectionRefreshPending.has(id)) return { scheduled: false, reason: "already-pending" };
  const reason = String(input.reason || "stale-partial").slice(0, 80);
  recentWindowProjectionRefreshPending.set(id, { reason, scheduledAtMs: Date.now() });
  const timer = setTimeout(() => {
    const threadLog = typeof input.threadLog === "function"
      ? input.threadLog
      : (event, details = {}) => logThreadDetail(`recent_window_refresh_${event}`, Object.assign({ threadId: id }, details));
    turnsListThreadReadResult(
      id,
      input.summary || null,
      input.runtimeSettings || null,
      "",
      "turns-list-background-refresh",
      threadLog,
    ).then((result) => {
      if (result && result.thread) {
        const seeded = threadDetailProjectionService.seed(input.projection, result, {
          partial: true,
          partialKind: "recent-window",
        });
        logThreadDetail("recent_window_refresh_done", {
          threadId: id,
          trigger: reason,
          status: seeded && seeded.skipped ? "skipped" : "seeded",
          seedReason: seeded && seeded.reason || "",
        });
      } else {
        logThreadDetail("recent_window_refresh_skipped", {
          threadId: id,
          trigger: reason,
          status: "empty-result",
        });
      }
    }).catch((err) => {
      logThreadDetail("recent_window_refresh_failed", {
        threadId: id,
        trigger: reason,
        error: err && err.message ? String(err.message).slice(0, 120) : String(err).slice(0, 120),
      });
    }).finally(() => {
      recentWindowProjectionRefreshPending.delete(id);
    });
  }, 25);
  if (timer && typeof timer.unref === "function") timer.unref();
  return { scheduled: true, reason: "scheduled" };
}

function scheduleActiveWindowPrewarmFromNotification(payload) {
  if (!payload || payload.type !== "notification" || !payload.params) return;
  const method = String(payload.method || "");
  if (method !== "turn/started" && method !== "turn/completed" && method !== "thread/status/changed") return;
  const threadId = notificationThreadId(payload);
  if (!threadId) return;
  if (method === "thread/status/changed" && !threadSummaryLooksActive(payload.params)) return;
  const canBypassThrottle = method === "turn/started" || method === "turn/completed";
  scheduleActiveWindowPrewarm(threadId, null, method, {
    delayMs: canBypassThrottle ? 0 : undefined,
    bypassMinInterval: canBypassThrottle,
    preemptPending: canBypassThrottle,
  });
}

function scheduleActiveWindowPrewarmFromThreadListResult(result, reason = "") {
  const rows = Array.isArray(result && result.data)
    ? result.data
    : Array.isArray(result && result.threads)
      ? result.threads
      : [];
  for (const thread of rows) {
    if (!threadSummaryLooksActive(thread)) continue;
    scheduleActiveWindowPrewarm(thread.id || thread.threadId || thread.thread_id, thread, reason || "thread-list");
  }
}

function threadStatusChangedPayload(threadId, status, meta = {}) {
  const id = String(threadId || "").trim();
  if (!id) return null;
  const params = {
    threadId: id,
    status: status || { type: "notLoaded" },
  };
  const source = String(meta.source || "").trim();
  const turnId = String(meta.turnId || "").trim();
  const eventAtMs = timestampToMs(meta.eventAtMs || meta.eventAt || meta.completedAtMs || meta.completedAt || meta.startedAtMs || meta.startedAt);
  if (source) params.source = source;
  if (turnId) params.turnId = turnId;
  if (eventAtMs) params.eventAtMs = eventAtMs;
  if (meta.mobileReplay) params.mobileReplay = true;
  return {
    type: "notification",
    method: "thread/status/changed",
    params,
  };
}

function broadcastThreadStatusChanged(threadId, status, meta = {}) {
  const payload = threadStatusChangedPayload(threadId, status, meta);
  if (!payload) return false;
  applyThreadStatusPayloadToThreadListFallbackCache(payload);
  broadcast(payload);
  return true;
}

function notifyLocalTurnStarted(threadId, result, meta = {}) {
  const id = String(threadId || "").trim();
  const turnId = turnStartResultTurnId(result);
  if (!id) return turnId;
  rememberLocalActiveThreadStatus(id, turnId, { source: String(meta.source || "local-turn-start") });
  if (turnId && threadDetailProjectionService) {
    threadDetailProjectionService.applyNotification("turn/started", {
      threadId: id,
      turn: Object.assign({ id: turnId, status: { type: "active" } }, result && result.turn && typeof result.turn === "object" ? result.turn : {}),
    });
  }
  scheduleActiveWindowPrewarm(id, { id, status: { type: "active" }, activeTurnId: turnId }, "local-turn-start");
  broadcastThreadStatusChanged(id, { type: "active" }, {
    source: String(meta.source || "local-turn-start"),
    turnId,
  });
  return turnId;
}

function threadStatusChangedPayloadFromTurnNotification(payload) {
  if (!payload || payload.type !== "notification" || !payload.params) return null;
  const method = String(payload.method || "");
  if (method !== "turn/started" && method !== "turn/completed") return null;
  const threadId = notificationThreadId(payload);
  if (!threadId) return null;
  const turn = payload.params.turn && typeof payload.params.turn === "object" ? payload.params.turn : {};
  const turnId = String(turn.id || payload.params.turnId || "");
  const status = method === "turn/started"
    ? { type: "active" }
    : (turn.status || payload.params.status || { type: "completed" });
  const eventAtMs = method === "turn/started"
    ? timestampToMs(turn.startedAtMs || turn.startedAt || turn.createdAtMs || turn.createdAt || payload.params.startedAtMs || payload.params.startedAt)
    : timestampToMs(turn.completedAtMs || turn.completedAt || turn.finishedAtMs || turn.finishedAt || turn.updatedAtMs || turn.updatedAt || payload.params.completedAtMs || payload.params.completedAt || payload.params.finishedAtMs || payload.params.finishedAt || payload.params.updatedAtMs || payload.params.updatedAt);
  const fallbackEventAtMs = payload.params.mobileReplay ? 0 : Date.now();
  return threadStatusChangedPayload(threadId, status, {
    source: method,
    turnId,
    eventAtMs: eventAtMs || fallbackEventAtMs,
    mobileReplay: Boolean(payload.params.mobileReplay),
  });
}

function updateLocalActiveThreadStatusFromNotification(payload) {
  if (!payload || payload.type !== "notification" || !payload.params) return;
  const method = String(payload.method || "");
  if (method !== "turn/started" && method !== "turn/completed") return;
  const threadId = notificationThreadId(payload);
  if (!threadId) return;
  const turn = payload.params.turn && typeof payload.params.turn === "object" ? payload.params.turn : {};
  const turnId = String(turn.id || payload.params.turnId || "");
  if (method === "turn/started") {
    rememberLocalActiveThreadStatus(threadId, turnId, { source: method });
  } else {
    clearLocalActiveThreadStatus(threadId);
  }
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

const codexProfileSwitchService = createCodexProfileSwitchService({
  progressTtlMs: PROFILE_SWITCH_PROGRESS_TTL_MS,
  preflightTimeoutMs: PROFILE_SWITCH_PREFLIGHT_TIMEOUT_MS,
  getFreePort,
  spawn,
  codeExe: CODEX_EXE,
  appRoot: APP_ROOT,
  codexAppServerChildEnv,
  logger: console,
});
const {
  getProfileSwitchProgress,
  preflightCodexProfileSwitch,
  profileSwitchLogDetail,
  profileSwitchPreflightError,
  profileSwitchProgressRequestId,
  profileSwitchRateLimitsWarningForError,
  setProfileSwitchProgress,
} = codexProfileSwitchService;

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

function safeJsonByteLength(value) {
  try {
    const json = JSON.stringify(value);
    return Buffer.byteLength(json || "", "utf8");
  } catch (_) {
    return 0;
  }
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

const codex = createCodexAppServerClient({
  REQUIRE_SHARED_APP_SERVER,
  resolveExternalEndpoint,
  DISABLE_MOBILE_OWNED_MUX,
  EXTERNAL_APP_SERVER_WS,
  EXTERNAL_APP_SERVER_TCP,
  MUX_ENDPOINT_FILE,
  CODEX_EXE,
  APP_ROOT,
  CODEX_HOME,
  CODEX_HOME_RESOLUTION,
  RUNTIME_ROOT,
  PERSIST_MOBILE_OWNED_MUX,
  MUX_REPLAY_NOTIFICATION_LIMIT,
  READ_RPC_TIMEOUT_MS,
  DEFAULT_RPC_TIMEOUT_MS,
  LIVE_RATE_LIMIT_REFRESH_MIN_INTERVAL_MS,
  SAFE_RETRY_METHODS,
  SERVER_REQUEST_METHODS,
  JsonLineConnection,
  codexAppServerChildEnv,
  getFreePort,
  assertCommandAvailable,
  broadcast,
  normalizeFsPath,
  recordRateLimitReadResult,
  recordRateLimits,
  latestLiveRateLimits: () => latestLiveRateLimits,
  hasCurrentRateLimitWindow,
  rememberThreadIdForTurnParams,
  maybeRecordTurnTokenUsage,
  maybeMaterializeThreadTaskCardDrafts,
  maybeAutoReplyThreadTaskCard,
  maybeApplyQueuedThreadSideChat,
  maybeSendTurnCompletedPush,
  publicServerRequest,
  workspaceSourceWriteGuardDecisionForRequest,
  serverRequestResponsePayload,
  workspaceSourceWriteGuardLogPayload,
  codeGraphReadOnlyMcpElicitationDecision,
  shortIdentifier,
  dynamicToolServerRequestResponsePayload,
  dynamicToolErrorPayload,
  safeJsonByteLength,
  logWorkspaceDelegationRpc,
  activeRateLimits,
  rateLimitsByModelObject,
  codexProfileService,
  liveQuotaSnapshotForProfiles,
});
threadDetailResponsePreparationService = createThreadDetailResponsePreparationService({
  codex,
  maxThreadTurns: MAX_THREAD_TURNS,
  maxFullThreadTurns: MAX_FULL_THREAD_TURNS,
  readRpcTimeoutMs: READ_RPC_TIMEOUT_MS,
  threadDetailRpcTimeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS,
  responseBudgetOptions: () => ({
    completedOperationItems: THREAD_DETAIL_COMPLETED_OPERATION_ITEMS,
    activeOperationItems: MAX_LIVE_OPERATION_ITEMS,
    activeReasoningItems: THREAD_DETAIL_ACTIVE_REASONING_ITEMS,
    completedReasoningItems: THREAD_DETAIL_COMPLETED_REASONING_ITEMS,
    activeAssistantItems: THREAD_DETAIL_ACTIVE_ASSISTANT_ITEMS,
    completedAssistantItems: THREAD_DETAIL_COMPLETED_ASSISTANT_ITEMS,
    activeProgressiveItemThreshold: THREAD_DETAIL_ACTIVE_PROGRESSIVE_ITEM_THRESHOLD,
    activeProgressiveByteThreshold: THREAD_DETAIL_ACTIVE_PROGRESSIVE_BYTES,
    activeProgressiveThreadByteThreshold: THREAD_DETAIL_ACTIVE_PROGRESSIVE_THREAD_BYTES,
    progressiveActiveOperationItems: THREAD_DETAIL_PROGRESSIVE_ACTIVE_OPERATION_ITEMS,
    progressiveActiveReasoningItems: THREAD_DETAIL_PROGRESSIVE_ACTIVE_REASONING_ITEMS,
    progressiveActiveAssistantItems: THREAD_DETAIL_PROGRESSIVE_ACTIVE_ASSISTANT_ITEMS,
    progressiveReplayAssistantItems: THREAD_DETAIL_PROGRESSIVE_REPLAY_ASSISTANT_ITEMS,
    progressiveCompletedReplayAssistantItems: THREAD_DETAIL_PROGRESSIVE_COMPLETED_REPLAY_ASSISTANT_ITEMS,
    progressiveActiveTextChars: THREAD_DETAIL_PROGRESSIVE_ACTIVE_TEXT_CHARS,
    progressiveActiveOperationPayloadChars: THREAD_DETAIL_PROGRESSIVE_ACTIVE_OPERATION_PAYLOAD_CHARS,
    progressiveActiveUserTextChars: THREAD_DETAIL_PROGRESSIVE_ACTIVE_USER_TEXT_CHARS,
    progressiveVisibleItemCeiling: THREAD_DETAIL_PROGRESSIVE_VISIBLE_ITEM_CEILING,
    progressiveFirstPaintThreadByteCeiling: THREAD_DETAIL_PROGRESSIVE_FIRST_PAINT_THREAD_BYTES,
    progressiveCompletedTextChars: THREAD_DETAIL_PROGRESSIVE_COMPLETED_TEXT_CHARS,
    progressiveCompletedUserTextChars: THREAD_DETAIL_PROGRESSIVE_COMPLETED_USER_TEXT_CHARS,
  }),
  compactThreadReadResult,
  compactThreadDetailResponseResult,
  compactTurn,
  enrichThreadItemTimestampsFromRollout,
  sortTurnsChronologically,
  isLiveTurn,
  normalizeThreadSummaryLiveStatus,
  annotateThreadRolloutStats,
  publicRuntimeSettings,
  rolloutPathForThread,
  rolloutStatsForPath,
  readRolloutTurnUsageSummaries,
  attachTurnUsageSummaries,
  workspaceContextStatsForCwd,
  backfillMissingRolloutCompletionTurnsForDetailResult,
  appendRolloutUserInputAnchorsToDetailResult,
  appendRolloutActiveAssistantItemsToDetailResult,
  finalizeActiveAssistantProjectionDetailResult,
  applyLocalActiveThreadStatusToResult,
  prepareThreadTaskCardsToResult,
  finalizeThreadDetailProjectionResult,
  applySessionIndexTitleToThread,
  readSessionIndexEntries,
  threadDisplaySummaryCache,
  mergeThreadRuntimeFromStateDb,
  appendRolloutFinalReceiptsToThread,
  attachPendingServerRequestsToResult,
  attachThreadTaskCardsToResult,
});
const threadSideChatOrchestrationService = createThreadSideChatOrchestrationService({
  threadSideChatService,
  codex,
  replyTimeoutMs: THREAD_SIDE_CHAT_REPLY_TIMEOUT_MS,
  threadDetailRpcTimeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS,
  mutationRpcTimeoutMs: MUTATION_RPC_TIMEOUT_MS,
  readOnlySandboxPolicy,
  applyStartThreadRuntimeSettings,
  applyResumeRuntimeSettings,
  applyTurnRuntimeSettings,
  resolveThreadRuntimeSettings,
  readStartThreadDeveloperInstructions,
  readThreadSummary: (threadId) => readStateDbThread(threadId) || readStartedThread(threadId) || readRolloutSessionFallbackThread(threadId),
  threadIdFromStartResult,
  rememberStartedThread,
  itemText: itemTimestampMatchText,
  isAssistantReceiptItem,
  isCompletedStatus,
  eventThreadId: pushThreadId,
  eventTurnId: pushTurnId,
  isOldTurnEvent: isOldPushTurnEvent,
  truncateTail,
  shortIdentifier,
  sleep,
  logger: console,
});
const { autoRecoverThreadTurn } = createAutoTurnRecoveryService({
  applyPermissionModeOverride,
  applyResumeRuntimeSettings,
  applyTurnRuntimeSettings,
  codex,
  cooldownMs: AUTO_TURN_RECOVERY_COOLDOWN_MS,
  httpStatusError,
  isLiveTurn,
  isStaleActiveTurnError,
  isTurnSteerUnsupportedError,
  mutationRpcTimeoutMs: MUTATION_RPC_TIMEOUT_MS,
  notifyLocalTurnStarted,
  prompt: AUTO_TURN_RECOVERY_PROMPT,
  readRpcTimeoutMs: READ_RPC_TIMEOUT_MS,
  resolveThreadRuntimeSettings,
  turnIdentifier,
  turnListFromResult,
});
const threadMessageRouteService = createThreadMessageRouteService({
  codex,
  modelOptions: MODEL_OPTIONS,
  reasoningEffortOptions: REASONING_EFFORT_OPTIONS,
  mutationRpcTimeoutMs: MUTATION_RPC_TIMEOUT_MS,
  startThreadFromRequestBody,
  readMessageBody,
  buildTurnInput,
  persistExtendedHistoryForUploads,
  requestedCodexFastMode,
  truncateSingleLine,
  readGlobalState,
  visibilityFromGlobalState,
  normalizeFsPath,
  messageSubmissionKeys,
  runMessageSubmissionOnce,
  applyPermissionModeOverride,
  readStartThreadDeveloperInstructions,
  applyStartThreadRuntimeSettings,
  applyTurnRuntimeSettings,
  applyResumeRuntimeSettings,
  applyCodexFastServiceTier,
  threadIdFromStartResult,
  rememberProjectlessThreadId,
  persistThreadTitleToSessionIndex,
  tryUpdateThreadTitle,
  notifyLocalTurnStarted,
  rememberThreadIdForTurnId,
  rememberStartedThread,
  resolveThreadRuntimeSettings,
  isCodexAccountAuthError,
  codexAccountAuthErrorPayload,
  logMessageSubmit,
  staleActiveTurnPreflight,
  pendingSteerEchoStore,
  isTurnSteerUnsupportedError,
  isStaleActiveTurnError,
  autoRecoverThreadTurn,
});
const chatGptProBridgeService = createChatGptProBridgeService({
  runtimeRoot: RUNTIME_ROOT,
  stateFile: CHATGPT_PRO_BRIDGE_FILE,
  outputDir: CHATGPT_PRO_OUTPUT_DIR,
  enabled: CHATGPT_PRO_BRIDGE_ENABLED,
  createThread: async ({ cwd }) => {
    const runtimeSettings = applyPermissionModeOverride({}, "full", cwd || APP_ROOT);
    const params = applyStartThreadRuntimeSettings({
      cwd: cwd || APP_ROOT,
      modelProvider: null,
      config: {},
      developerInstructions: [
        "This is the dedicated Codex Mobile ChatGPT Pro bridge thread.",
        "Use Chrome only when the user request explicitly asks for ChatGPT Pro generation.",
        "Do not modify source files unless a later explicit user request asks for code changes.",
      ].join("\n"),
      personality: null,
      ephemeral: null,
      dynamicTools: null,
      mockExperimentalField: null,
      experimentalRawEvents: false,
      persistExtendedHistory: false,
    }, runtimeSettings);
    const result = await codex.request("thread/start", params, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
    const threadId = threadIdFromStartResult(result);
    return { threadId, thread: result && (result.thread || result.data && result.data.thread) || {} };
  },
  startTurn: async ({ threadId, cwd, input }) => {
    const runtimeSettings = applyPermissionModeOverride(await resolveThreadRuntimeSettings(threadId), "full", cwd || APP_ROOT);
    try {
      await codex.request("thread/resume", applyResumeRuntimeSettings({
        threadId,
        cwd: cwd || APP_ROOT,
        persistExtendedHistory: false,
      }, runtimeSettings), { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
    } catch (err) {
      if (!/already|loaded|active/i.test(err.message || "")) throw err;
    }
    const result = await codex.request("turn/start", applyTurnRuntimeSettings({
      threadId,
      input,
      cwd: cwd || APP_ROOT,
    }, runtimeSettings), { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
    notifyLocalTurnStarted(threadId, result, { source: "chatgpt-pro-bridge" });
    return result;
  },
  updateThreadTitle: tryUpdateThreadTitle,
  persistThreadTitle: persistThreadTitleToSessionIndex,
  rememberThread: rememberStartedThread,
});
const chatGptProPlannerService = createChatGptProPlannerService({
  runtimeRoot: RUNTIME_ROOT,
  storeRoot: CHATGPT_PRO_PLANNER_DIR,
  version: APP_VERSION,
  listWorkspaces,
  workspaceRoots: () => {
    const roots = visibleWorkspaceRoots(readGlobalState());
    roots.add(APP_ROOT);
    for (const workspace of workspaceRegistryService.list()) {
      if (workspace && workspace.cwd) roots.add(workspace.cwd);
    }
    return Array.from(roots);
  },
  readThreadContext: async ({ threadId }) => {
    let summary = readStateDbThread(threadId)
      || readStartedThread(threadId)
      || readRolloutSessionFallbackThread(threadId);
    if (!summary) {
      summary = await readThreadSummaryFromAppServer(codex, threadId).catch(() => null);
    }
    if (!summary) return null;
    return {
      id: summary.id || threadId,
      title: summary.name || summary.title || summary.preview || "",
      status: statusText(summary.status) || "",
      cwd: summary.cwd || "",
      model: summary.model || "",
      reasoningEffort: summary.effort || summary.reasoningEffort || "",
      updatedAt: summary.updatedAt || summary.updated_at || summary.updatedAtMs || summary.updated_at_ms || 0,
      summary: summary.preview || summary.firstUserMessage || "",
    };
  },
});
const chatGptProMcpService = createChatGptProMcpService({
  plannerService: chatGptProPlannerService,
  delegateTaskCard: async (input = {}) => createThreadTaskCardsFromSourceThread(input.sourceThreadId, input),
  allowDirectTaskCards: CHATGPT_PRO_MCP_ALLOW_DIRECT_TASK_CARDS,
  token: CHATGPT_PRO_MCP_TOKEN,
  tokenFile: CHATGPT_PRO_MCP_TOKEN_FILE,
  version: APP_VERSION,
});
const appMaintenanceService = createAppMaintenanceService({
  appRoot: APP_ROOT,
  appVersion: APP_VERSION,
  appUpdateRemote: APP_UPDATE_REMOTE,
  appUpdateBranch: APP_UPDATE_BRANCH,
  appUpdateDisabled: APP_UPDATE_DISABLED,
  appUpdateCheckTimeoutMs: APP_UPDATE_CHECK_TIMEOUT_MS,
  appUpdateApplyTimeoutMs: APP_UPDATE_APPLY_TIMEOUT_MS,
  appUpdateRestartDelayMs: APP_UPDATE_RESTART_DELAY_MS,
  appUpdateCacheMs: APP_UPDATE_CACHE_MS,
  publicPrCheckDisabled: PUBLIC_PR_CHECK_DISABLED,
  publicPrRepository: PUBLIC_PR_REPOSITORY,
  publicPrCheckTimeoutMs: PUBLIC_PR_CHECK_TIMEOUT_MS,
  publicPrCheckCacheMs: PUBLIC_PR_CHECK_CACHE_MS,
  githubLinkPreviewTimeoutMs: GITHUB_LINK_PREVIEW_TIMEOUT_MS,
  githubLinkPreviewCacheMs: GITHUB_LINK_PREVIEW_CACHE_MS,
  publicReleaseCheckDisabled: PUBLIC_RELEASE_CHECK_DISABLED,
  publicReleaseRepository: PUBLIC_RELEASE_REPOSITORY,
  publicReleaseBranch: PUBLIC_RELEASE_BRANCH,
  publicReleaseCheckCacheMs: PUBLIC_RELEASE_CHECK_CACHE_MS,
  shutdown,
});
const {
  applyAppUpdate,
  refreshAppUpdateStatus,
  refreshGitHubLinkPreview,
  refreshPublicPullRequestStatus,
  refreshPublicReleaseStatus,
  safeAppUpdateError,
  scheduleAppRestart,
  scheduleStartupAppUpdateCheck,
} = appMaintenanceService;
const coreApiRouteService = createCoreApiRouteService({
  activeProfileRestartOptions,
  activeRateLimits,
  appRoot: APP_ROOT,
  appUpdateBranch: APP_UPDATE_BRANCH,
  appUpdateDisabled: APP_UPDATE_DISABLED,
  appUpdateRemote: APP_UPDATE_REMOTE,
  appVersion: APP_VERSION,
  applyAppUpdate,
  authKey: AUTH_KEY,
  chatGptProMcpService,
  codex,
  codexConfigDefaults: CODEX_CONFIG_DEFAULTS,
  codexProfileService,
  currentPublicBuildConfig,
  defaultModel: DEFAULT_MODEL,
  defaultPermissionModeFromConfigDefaults,
  disableAuth: DISABLE_AUTH,
  getProfileSwitchProgress,
  hermesNotificationDelegateService,
  hermesOriginFromRequest,
  hermesPluginBaseUrl: HERMES_PLUGIN_BASE_URL,
  hermesPluginService,
  httpStatusError,
  isAccessKeyAuthorized,
  liveQuotaSnapshotForProfiles,
  loadRecentRateLimitsFromRollouts,
  logClientEvent,
  mediaFileService,
  modelOptions: MODEL_OPTIONS,
  permissionModeOptions: PERMISSION_MODE_OPTIONS,
  pluginSessionCookieHeader,
  preflightCodexProfileSwitch,
  profileSwitchLogDetail,
  profileSwitchProgressRequestId,
  publicConfigRuntimeCache,
  publicPrCheckDisabled: PUBLIC_PR_CHECK_DISABLED,
  publicPrRepository: PUBLIC_PR_REPOSITORY,
  publicReleaseBranch: PUBLIC_RELEASE_BRANCH,
  publicReleaseCheckDisabled: PUBLIC_RELEASE_CHECK_DISABLED,
  publicReleaseRepository: PUBLIC_RELEASE_REPOSITORY,
  pushSubscriptionPublicStatus,
  rateLimitsByModelObject,
  reasoningEffortOptions: REASONING_EFFORT_OPTIONS,
  refreshAppUpdateStatus,
  refreshGitHubLinkPreview,
  refreshPublicPullRequestStatus,
  refreshPublicReleaseStatus,
  requestAuthToken,
  requestBaseUrl,
  rolloutWarningBytes: ROLLOUT_WARNING_BYTES,
  safeAppUpdateError,
  scheduleAppRestart,
  setProfileSwitchProgress,
  setThreadDisplaySettings,
  setWorkspaceDelegationEnabled,
  sharedChainRestartDelayMs: SHARED_CHAIN_RESTART_DELAY_MS,
  sharedChainRestartService,
  syncCodexMobileMcpToolset,
  syncKnownCodexMobileMcpToolsets,
  syncRegisteredWorkspaceTrust,
  threadDisplayPublicSettings,
  threadListFallbackPrewarmPublicStatus,
  timingSafeEquals,
  workspaceDelegationPublicSettings,
  workspaceRegistryService,
});

function readGlobalState() {
  const p = path.join(CODEX_HOME, ".codex-global-state.json");
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (_) {
    return {};
  }
}

function rememberProjectlessThreadId(threadId) {
  const id = String(threadId || "").trim();
  if (!id) return false;
  const file = path.join(CODEX_HOME, ".codex-global-state.json");
  try {
    const state = readJsonFile(file, {});
    const existing = Array.isArray(state["projectless-thread-ids"]) ? state["projectless-thread-ids"] : [];
    if (existing.includes(id)) return false;
    state["projectless-thread-ids"] = existing.concat([id]);
    writeRuntimeJson(file, state);
    return true;
  } catch (err) {
    console.warn(`Failed to update projectless thread ids: ${err.message || String(err)}`);
    return false;
  }
}

function statusTurnId(status) {
  return threadSummaryStateService.statusTurnId(status);
}

function rowToFallbackThread(row) {
  return threadSummaryStateService.rowToFallbackThread(row);
}

function sqlString(value) {
  return threadSummaryStateService.sqlString(value);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function isRecoverableThreadTitleUpdateError(err) {
  const message = String((err && err.message) || "");
  return /thread metadata unavailable before name update|metadata unavailable before name update|database disk image is malformed/i.test(message);
}

async function archiveVisibleThread(threadId, visibility) {
  if (!threadId) return { archived: false };
  const summary = readStateDbThread(threadId)
    || readStartedThread(threadId)
    || await readThreadSummaryFromAppServer(codex, threadId).catch(() => null);
  if (summary && isHiddenThread(summary, visibility)) {
    throw new Error("Source thread is archived, deleted, or outside visible workspaces");
  }
  const result = await codex.request("thread/archive", { threadId }, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
  return archivedResultWithMobileIndex(result, threadId);
}

function isThreadArchiveNoOpError(err) {
  const message = String((err && err.message) || "").toLowerCase();
  const code = String((err && err.code) || "").toLowerCase();
  return /already|archived|not found|notexisting|不存在|已归档|does not exist|no such/.test(message)
    || /thread_not_found|thread-not-found|not_found|not-found/.test(code);
}

async function archiveThreadId(threadId, visibility = visibilityFromGlobalState()) {
  if (!threadId) return { archived: false };
  if (isThreadIdArchivedLocally(threadId)) return alreadyArchivedResult("mobile-index", threadId, false);
  const summary = readStateDbThread(threadId) || readStartedThread(threadId);
  if (summary && isHiddenThread(summary, visibility)) {
    return alreadyArchivedResult("state-db", threadId);
  }
  try {
    const result = await codex.request("thread/archive", { threadId }, {
      timeoutMs: MUTATION_RPC_TIMEOUT_MS,
      retry: false,
    });
    return archivedResultWithMobileIndex(result, threadId);
  } catch (err) {
    const rechecked = readStateDbThread(threadId) || readStartedThread(threadId);
    if (rechecked && isHiddenThread(rechecked, visibility)) {
      return alreadyArchivedResult("state-db", threadId);
    }
    if (isThreadArchiveNoOpError(err)) {
      return alreadyArchivedResult("", threadId);
    }
    throw err;
  }
}

function httpStatusError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function httpStatusErrorWithDetails(statusCode, code, message, details = {}) {
  const err = httpStatusError(statusCode, message || code);
  err.code = code;
  err.details = details && typeof details === "object" ? details : {};
  return err;
}

const THREAD_GOAL_OBJECTIVE_MAX_CHARS = 4000;

function normalizeThreadGoalObjectiveInput(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > THREAD_GOAL_OBJECTIVE_MAX_CHARS
    ? text.slice(0, THREAD_GOAL_OBJECTIVE_MAX_CHARS).trimEnd()
    : text;
}

function normalizeThreadGoalTokenBudgetInput(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.trunc(number);
}

function isThreadGoalRpcUnsupportedError(err) {
  const message = String((err && err.message) || "").toLowerCase();
  const code = String((err && err.code) || "").toLowerCase();
  return /method not found|unknown method|not supported|unsupported|thread\/goal\/(set|clear|get)/.test(message)
    || /method_not_found|method-not-found|unsupported|not_supported/.test(code);
}

function threadGoalFromRpcResult(result) {
  if (!result || typeof result !== "object") return null;
  const goal = result.goal && typeof result.goal === "object" ? result.goal : result;
  return goal && typeof goal === "object" ? goal : null;
}

function isCompletedThreadGoal(goal) {
  if (!goal || typeof goal !== "object") return false;
  return normalizeThreadGoalStatus(goal.status) === "complete";
}

function currentThreadGoalForSet(threadId) {
  try {
    return threadGoalService.goalForThread(threadId);
  } catch {
    return null;
  }
}

async function clearThreadGoalForSet(threadId) {
  return codex.request("thread/goal/clear", { threadId }, {
    timeoutMs: MUTATION_RPC_TIMEOUT_MS,
    retry: false,
  });
}

async function getThreadGoalRpc(threadId) {
  return codex.request("thread/goal/get", { threadId }, {
    timeoutMs: READ_RPC_TIMEOUT_MS,
    retry: false,
  });
}

async function setThreadGoalRpc(params) {
  return codex.request("thread/goal/set", params, {
    timeoutMs: MUTATION_RPC_TIMEOUT_MS,
    retry: false,
  });
}

function threadGoalForActionFallback(threadId) {
  try {
    return currentThreadGoalForSet(threadId);
  } catch {
    return null;
  }
}

async function currentThreadGoalForAction(threadId) {
  try {
    return threadGoalFromRpcResult(await getThreadGoalRpc(threadId)) || threadGoalForActionFallback(threadId);
  } catch (err) {
    if (isThreadGoalRpcUnsupportedError(err)) {
      throw httpStatusError(501, "Thread goal actions are not supported by the running Codex app-server; restart Mobile Web with Codex CLI 0.135.0 or newer.");
    }
    return threadGoalForActionFallback(threadId);
  }
}

function threadGoalTokenBudgetParam(inputTokenBudget, currentGoal = null) {
  const inputBudget = normalizeThreadGoalTokenBudgetInput(inputTokenBudget);
  if (inputBudget !== null) return inputBudget;
  const currentBudget = normalizeThreadGoalTokenBudgetInput(currentGoal && (currentGoal.tokenBudget ?? currentGoal.token_budget));
  return currentBudget;
}

function threadGoalSetParams(threadId, objective, tokenBudget, extra = {}) {
  const params = Object.assign({ threadId, objective }, extra || {});
  if (tokenBudget !== null) params.tokenBudget = tokenBudget;
  return params;
}

async function setThreadGoal(threadId, input = {}) {
  const id = String(threadId || "").trim();
  const objective = normalizeThreadGoalObjectiveInput(input.objective || input.goal || input.text);
  if (!id) throw httpStatusError(400, "Thread id is required");
  if (!objective) throw httpStatusError(400, "Goal objective is required");
  const params = { threadId: id, objective };
  const tokenBudget = normalizeThreadGoalTokenBudgetInput(input.tokenBudget ?? input.token_budget);
  if (tokenBudget !== null) params.tokenBudget = tokenBudget;
  try {
    let clearedCompletedGoal = false;
    if (isCompletedThreadGoal(currentThreadGoalForSet(id))) {
      await clearThreadGoalForSet(id);
      clearedCompletedGoal = true;
    }
    let result = await setThreadGoalRpc(params);
    let goal = threadGoalFromRpcResult(result);
    if (!clearedCompletedGoal && isCompletedThreadGoal(goal)) {
      await clearThreadGoalForSet(id);
      clearedCompletedGoal = true;
      result = await setThreadGoalRpc(params);
      goal = threadGoalFromRpcResult(result);
    }
    return { ok: true, goal: goal || result, result, clearedCompletedGoal };
  } catch (err) {
    if (isThreadGoalRpcUnsupportedError(err)) {
      throw httpStatusError(501, "Thread goal set is not supported by the running Codex app-server; restart Mobile Web with Codex CLI 0.135.0 or newer.");
    }
    throw err;
  }
}

async function runThreadGoalAction(threadId, input = {}) {
  const id = String(threadId || "").trim();
  const action = String(input.action || "").trim().toLowerCase();
  if (!id) throw httpStatusError(400, "Thread id is required");
  if (!action) throw httpStatusError(400, "Goal action is required");
  if (action === "cancel" || action === "clear") {
    try {
      await clearThreadGoalForSet(id);
      return { ok: true, action: "cancel", goal: null };
    } catch (err) {
      if (isThreadGoalRpcUnsupportedError(err)) {
        throw httpStatusError(501, "Thread goal clear is not supported by the running Codex app-server; restart Mobile Web with Codex CLI 0.135.0 or newer.");
      }
      throw err;
    }
  }

  const currentGoal = await currentThreadGoalForAction(id);
  const objective = normalizeThreadGoalObjectiveInput(input.objective || input.goal || input.text || currentGoal && currentGoal.objective);
  if (!objective) throw httpStatusError(400, "Goal objective is required");
  const tokenBudget = threadGoalTokenBudgetParam(input.tokenBudget ?? input.token_budget, currentGoal);

  if (action === "continue" || action === "resume") {
    if (normalizeThreadGoalStatus(currentGoal && currentGoal.status) === "active") {
      return { ok: true, action: "continue", goal: currentGoal, changed: false };
    }
    try {
      await clearThreadGoalForSet(id);
      const result = await setThreadGoalRpc(threadGoalSetParams(id, objective, tokenBudget));
      const goal = threadGoalFromRpcResult(result) || await currentThreadGoalForAction(id);
      return { ok: true, action: "continue", goal: goal || result, result, changed: true };
    } catch (err) {
      if (isThreadGoalRpcUnsupportedError(err)) {
        throw httpStatusError(501, "Thread goal continue is not supported by the running Codex app-server; restart Mobile Web with Codex CLI 0.135.0 or newer.");
      }
      throw err;
    }
  }

  if (action === "pause") {
    try {
      const result = await setThreadGoalRpc(threadGoalSetParams(id, objective, tokenBudget, { status: "blocked" }));
      let goal = threadGoalFromRpcResult(result);
      if (normalizeThreadGoalStatus(goal && goal.status) !== "blocked") goal = await currentThreadGoalForAction(id);
      if (normalizeThreadGoalStatus(goal && goal.status) !== "blocked") {
        throw httpStatusError(501, "Thread goal pause is not supported by the running Codex app-server.");
      }
      return { ok: true, action: "pause", goal, result, changed: true };
    } catch (err) {
      if (err && err.statusCode) throw err;
      if (isThreadGoalRpcUnsupportedError(err)) {
        throw httpStatusError(501, "Thread goal pause is not supported by the running Codex app-server; restart Mobile Web with Codex CLI 0.135.0 or newer.");
      }
      throw err;
    }
  }

  throw httpStatusError(400, `Unsupported goal action: ${action}`);
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
  upsertThreadListFallbackCacheThread(summary, { addIfMissing: true });
  return summary;
}

function readStartedThread(threadId) {
  pruneStartedThreadCache();
  const entry = recentStartedThreads.get(String(threadId || ""));
  return entry && entry.thread ? annotateThreadRolloutStats(entry.thread) : null;
}

function pruneLocalActiveThreadStatuses(now = Date.now()) {
  return threadSummaryStateService.pruneLocalActiveThreadStatuses(now);
}

function rolloutHasTerminalEntryAtOrAfter(rolloutPath, timestampMs = 0) {
  return threadSummaryStateService.rolloutHasTerminalEntryAtOrAfter(rolloutPath, timestampMs);
}

function localActiveSupersedingRolloutEvidence(rolloutPath, entry, nowMs = Date.now()) {
  return threadSummaryStateService.localActiveSupersedingRolloutEvidence(rolloutPath, entry, nowMs);
}

function localActiveSummaryRolloutPath(threadId, summary = null) {
  return threadSummaryStateService.localActiveSummaryRolloutPath(threadId, summary);
}

function readLocalActiveThreadStatus(threadId, summary = null, nowMs = Date.now()) {
  return threadSummaryStateService.readLocalActiveThreadStatus(threadId, summary, nowMs);
}

function rememberLocalActiveThreadStatus(threadId, turnId = "", meta = {}) {
  return threadSummaryStateService.rememberLocalActiveThreadStatus(threadId, turnId, meta);
}

function clearLocalActiveThreadStatus(threadId) {
  return threadSummaryStateService.clearLocalActiveThreadStatus(threadId);
}

function applyLocalActiveThreadStatusToSummary(thread, options = {}) {
  return threadSummaryStateService.applyLocalActiveThreadStatusToSummary(thread, options);
}

function applyLocalActiveThreadStatusToResult(result, options = {}) {
  return threadSummaryStateService.applyLocalActiveThreadStatusToResult(result, options);
}

function normalizeThreadSummaryLiveStatus(thread, options = {}) {
  return threadSummaryStateService.normalizeThreadSummaryLiveStatus(thread, options);
}

function readStateDbThread(threadId) {
  return threadSummaryStateService.readStateDbThread(threadId);
}

function isThreadListLiveStatus(status) {
  return threadSummaryStateService.isThreadListLiveStatus(status);
}

function isThreadListRestStatus(status) {
  return threadSummaryStateService.isThreadListRestStatus(status);
}

function isThreadListUnknownStatus(status) {
  return threadSummaryStateService.isThreadListUnknownStatus(status);
}

function shouldReplaceThreadDisplayStatus(baseStatus, displayStatus, baseUpdatedAtMs, displayUpdatedAtMs) {
  return threadSummaryStateService.shouldReplaceThreadDisplayStatus(baseStatus, displayStatus, baseUpdatedAtMs, displayUpdatedAtMs);
}

function clearThreadSummaryActiveMarkers(thread) {
  return threadSummaryStateService.clearThreadSummaryActiveMarkers(thread);
}

function mergeThreadWithCachedDisplaySummary(thread, options = {}) {
  return threadSummaryStateService.mergeThreadWithCachedDisplaySummary(thread, options);
}

function mergeThreadDisplaySummary(base, display, options = {}) {
  return threadSummaryStateService.mergeThreadDisplaySummary(base, display, options);
}

function mergeThreadRuntimeFromStateDb(thread, summary = null) {
  return threadSummaryStateService.mergeThreadRuntimeFromStateDb(thread, summary);
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
  return normalizeStaleContextOnlyActiveThread(threadDisplaySummaryCache.remember(thread) || annotateThreadRolloutStats(thread));
}

function sortTurnsChronologically(turns) {
  return (turns || []).slice().sort((a, b) => {
    const left = turnSortTimestampMs(a);
    const right = turnSortTimestampMs(b);
    if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right;
    if (Number.isFinite(left) && !Number.isFinite(right) && isRolloutFallbackTurnId(b)) return 1;
    if (!Number.isFinite(left) && Number.isFinite(right) && isRolloutFallbackTurnId(a)) return -1;
    return String((a && a.id) || "").localeCompare(String((b && b.id) || ""));
  });
}

function isRolloutFallbackTurnId(turn) {
  return /^rollout-\d+$/i.test(String(turn && (turn.id || turn.turnId) || ""));
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
  if (itemTimestamps.length) return Math.min(...itemTimestamps);
  return isLiveTurn(turn) ? Number.MAX_SAFE_INTEGER : NaN;
}

function threadFromTurnsList(threadId, summary, turnsResult) {
  return threadDetailResponsePreparationService.threadFromTurnsList(threadId, summary, turnsResult);
}

function parseThreadTurnsCursor(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^"/.test(text)) {
    try {
      const parsed = JSON.parse(text);
      return typeof parsed === "string" ? parsed : JSON.stringify(parsed);
    } catch (_) {
      return text;
    }
  }
  return text;
}

function isReadTimeoutError(err) {
  return Boolean(err && (err.code === "RPC_TIMEOUT" || /timed out|connection is not open|connection closed/i.test(err.message || "")));
}

function threadRolloutSizeBytes(thread) {
  return threadDetailResponsePreparationService.threadRolloutSizeBytes(thread);
}

function fallbackThreadReadResult(threadId, summary, runtimeSettings, warning, mode = "summary-fallback") {
  return threadDetailResponsePreparationService.fallbackThreadReadResult(threadId, summary, runtimeSettings, warning, mode);
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

function attachThreadGoalToThread(thread) {
  return threadGoalService.attachGoalToThread(thread);
}

function attachThreadTaskCardCountsToSummary(thread, taskCardCounts = null) {
  if (!thread || typeof thread !== "object" || !thread.id) return thread;
  const summary = stripThreadListDetailFields(thread);
  const counts = taskCardCounts || threadTaskCardService.pendingCountsForThread(thread.id);
  summary.pendingTaskCardCount = counts.pendingTotal;
  summary.pendingIncomingTaskCardCount = counts.pendingIncoming;
  summary.pendingOutgoingTaskCardCount = counts.pendingOutgoing;
  return summary;
}

function attachThreadGoalsToThreadListResult(result) {
  return threadGoalService.attachGoalsToThreadListResult(result);
}

function attachThreadTaskCardCountsToThreadListResult(result) {
  if (!result || typeof result !== "object") return result;
  const threads = [];
  if (Array.isArray(result.data)) threads.push(...result.data);
  if (Array.isArray(result.threads) && result.threads !== result.data) threads.push(...result.threads);
  const countsByThreadId = threadTaskCardService.pendingCountsForThreads(threads.map((thread) => thread && thread.id));
  const attach = (thread) => attachThreadTaskCardCountsToSummary(thread, countsByThreadId.get(String(thread && thread.id || "")));
  if (Array.isArray(result.data)) result.data = result.data.map(attach);
  if (Array.isArray(result.threads)) result.threads = result.threads.map(attach);
  return result;
}

function attachThreadListStateToResult(result) {
  return attachThreadTaskCardCountsToThreadListResult(attachThreadGoalsToThreadListResult(result));
}

function attachThreadTaskCardsToResult(result) {
  if (!result || typeof result !== "object" || !result.thread) return result;
  attachThreadGoalToThread(result.thread);
  attachThreadTaskCardsToThread(result.thread);
  return result;
}

function pendingServerRequestsForThread(codexClient, threadId) {
  const id = String(threadId || "").trim();
  if (!codexClient || typeof codexClient.pendingServerRequests !== "function") return [];
  return codexClient.pendingServerRequests()
    .filter((request) => {
      if (!request || !shouldExposeServerRequestInThread(request)) return false;
      const params = request.params || {};
      const requestThreadId = String(params.threadId || params.conversationId || "").trim();
      return requestThreadId ? requestThreadId === id : Boolean(id);
    });
}

function shouldExposeServerRequestInThread(request) {
  return Boolean(request && SERVER_REQUEST_METHODS.has(request.method));
}

function attachPendingServerRequestsToResult(result, codexClient = codex) {
  if (!result || typeof result !== "object" || !result.thread) return result;
  const pendingServerRequests = pendingServerRequestsForThread(codexClient, result.thread.id || result.thread.threadId || "");
  result.thread.pendingServerRequests = pendingServerRequests;
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

function threadDisplayTitle(thread) {
  if (!thread || typeof thread !== "object") return "";
  const id = String(thread.id || thread.threadId || "").trim();
  for (const value of [
    thread.displayTitle,
    thread.threadTitle,
    thread.thread_name,
    thread.name,
    thread.title,
    thread.preview,
  ]) {
    const text = String(value || "").trim();
    if (text && !isRecoverableThreadListTitle(text, id)) return text;
  }
  return id;
}

function normalizeThreadTaskCardWorkflowMode(value) {
  return threadTaskCardRouteService.normalizeThreadTaskCardWorkflowMode(value);
}

function normalizeThreadTaskCardReasoningEffort(value) {
  return threadTaskCardRouteService.normalizeThreadTaskCardReasoningEffort(value);
}

function uniqueThreadTaskCardTargetIds(values, fallback = "") {
  return threadTaskCardRouteService.uniqueThreadTaskCardTargetIds(values, fallback);
}

function threadTaskCardTargetReferenceText(value) {
  return threadTaskCardRouteService.threadTaskCardTargetReferenceText(value);
}

function threadTaskCardTargetReferenceEntry(kind, value) {
  return threadTaskCardRouteService.threadTaskCardTargetReferenceEntry(kind, value);
}

function threadTaskCardTargetReferenceEntries(body = {}) {
  return threadTaskCardRouteService.threadTaskCardTargetReferenceEntries(body);
}

function threadTaskCardTargetReferences(body = {}) {
  return threadTaskCardRouteService.threadTaskCardTargetReferences(body);
}

function isThreadIdLike(value) {
  return threadTaskCardRouteService.isThreadIdLike(value);
}

function threadTaskCardTargetUpdatedAt(thread) {
  return threadTaskCardRouteService.threadTaskCardTargetUpdatedAt(thread);
}

function publicThreadTaskCardTarget(thread) {
  return threadTaskCardRouteService.publicThreadTaskCardTarget(thread);
}

function threadTaskCardTargetError(code, message, details = {}, statusCode = 400) {
  return threadTaskCardRouteService.threadTaskCardTargetError(code, message, details, statusCode);
}

function threadTaskCardTargetVisibility(options = {}) {
  return threadTaskCardRouteService.threadTaskCardTargetVisibility(options);
}

function threadTaskCardVisibleTargetThreads(options = {}) {
  return threadTaskCardRouteService.threadTaskCardVisibleTargetThreads(options);
}

function threadTaskCardCanonicalTargetForCwd(cwd, visibleThreads = []) {
  return threadTaskCardRouteService.threadTaskCardCanonicalTargetForCwd(cwd, visibleThreads);
}

function threadTaskCardCanonicalTargetForThread(thread, visibleThreads = []) {
  return threadTaskCardRouteService.threadTaskCardCanonicalTargetForThread(thread, visibleThreads);
}

function threadTaskCardCanonicalVisibleTargets(visibleThreads = []) {
  return threadTaskCardRouteService.threadTaskCardCanonicalVisibleTargets(visibleThreads);
}

function readThreadTaskCardTargetSummary(threadId, options = {}) {
  return threadTaskCardRouteService.readThreadTaskCardTargetSummary(threadId, options);
}

function readThreadTaskCardVisibleTargetSummary(threadId) {
  return threadTaskCardRouteService.readThreadTaskCardVisibleTargetSummary(threadId);
}

function readThreadTaskCardExecutionTargetSummary(card) {
  return threadTaskCardRouteService.readThreadTaskCardExecutionTargetSummary(card);
}

function applyHomeAiDeployLaneRoutingPolicy(payload = {}, sourceSummary = null, options = {}) {
  return threadTaskCardRouteService.applyHomeAiDeployLaneRoutingPolicy(payload, sourceSummary, options);
}

function assertThreadTaskCardTargetDeliverable(thread, details = {}, options = {}) {
  return threadTaskCardRouteService.assertThreadTaskCardTargetDeliverable(thread, details, options);
}

function resolveThreadTaskCardTargetReference(value, sourceThreadId = "", options = {}) {
  return threadTaskCardRouteService.resolveThreadTaskCardTargetReference(value, sourceThreadId, options);
}

function resolvedThreadTaskCardTargetIds(body = {}, sourceThreadId = "", options = {}) {
  return threadTaskCardRouteService.resolvedThreadTaskCardTargetIds(body, sourceThreadId, options);
}

function threadTaskCardThreadCallIdempotencyKey(sourceThreadId, body = {}, targetThreadIds = []) {
  return threadTaskCardRouteService.threadTaskCardThreadCallIdempotencyKey(sourceThreadId, body, targetThreadIds);
}

function buildThreadTaskCardCreatePayload(body = {}, sourceThreadId = "", options = {}) {
  return threadTaskCardRouteService.buildThreadTaskCardCreatePayload(body, sourceThreadId, options);
}

async function createThreadTaskCardsFromSourceThread(sourceThreadId, body = {}, options = {}) {
  return threadTaskCardRouteService.createThreadTaskCardsFromSourceThread(sourceThreadId, body, options);
}

function parseDynamicToolArguments(value) {
  return threadTaskCardRouteService.parseDynamicToolArguments(value);
}

function dynamicToolTextResponse(text, options = {}) {
  return threadTaskCardRouteService.dynamicToolTextResponse(text, options);
}

function dynamicToolJsonResponse(payload, options = {}) {
  return threadTaskCardRouteService.dynamicToolJsonResponse(payload, options);
}

function dynamicToolErrorPayload(code, message, extra = {}) {
  return threadTaskCardRouteService.dynamicToolErrorPayload(code, message, extra);
}

async function dynamicToolServerRequestResponsePayload(request) {
  return threadTaskCardRouteService.dynamicToolServerRequestResponsePayload(request);
}

function parseThreadTaskCardDraftText(value) {
  return threadTaskCardRouteService.parseThreadTaskCardDraftText(value);
}

function threadTaskCardDraftIdempotencyKey(threadId, turnId, draft) {
  return threadTaskCardRouteService.threadTaskCardDraftIdempotencyKey(threadId, turnId, draft);
}

function threadTaskCardItemText(item) {
  return threadTaskCardRouteService.threadTaskCardItemText(item);
}

function summarizeTaskCardText(value) {
  return threadTaskCardRouteService.summarizeTaskCardText(value);
}

function truncateThreadTaskCardBody(value, maxChars = THREAD_TASK_CARD_BODY_MAX_CHARS) {
  return threadTaskCardRouteService.truncateThreadTaskCardBody(value, maxChars);
}

function taskCardSourceThreadTitle(sourceThreadId, requestedTitle = "", sourceSummary = null) {
  return threadTaskCardRouteService.taskCardSourceThreadTitle(sourceThreadId, requestedTitle, sourceSummary);
}

async function materializeThreadTaskCardDraftsForThread(thread) {
  return threadTaskCardRouteService.materializeThreadTaskCardDraftsForThread(thread);
}

async function prepareThreadTaskCardsToResult(result) {
  return threadTaskCardRouteService.prepareThreadTaskCardsToResult(result);
}

function hasTurnUsageSummaryPayload(summaries) {
  return threadDetailResponsePreparationService.hasTurnUsageSummaryPayload(summaries);
}

function cloneThreadForUsageDecoration(thread) {
  return threadDetailResponsePreparationService.cloneThreadForUsageDecoration(thread);
}

function attachRolloutUsageSummariesToDetailResult(result) {
  return threadDetailResponsePreparationService.attachRolloutUsageSummariesToDetailResult(result);
}

async function prepareThreadDetailResponseResult(result, details = {}) {
  return threadDetailResponsePreparationService.prepareThreadDetailResponseResult(result, details);
}

async function turnsListThreadReadResult(threadId, summary, runtimeSettings, warning, mode = "turns-list", threadLog = null, responseBudgetEvidence = "") {
  return threadDetailResponsePreparationService.turnsListThreadReadResult(threadId, summary, runtimeSettings, warning, mode, threadLog, responseBudgetEvidence);
}

async function readRawThreadDetailForOrchestrator({ threadId, summary, runtimeSettings }) {
  return threadDetailResponsePreparationService.readRawThreadDetailForOrchestrator({ threadId, summary, runtimeSettings });
}

async function readFullThreadDetailForOrchestrator({ threadId, summary, runtimeSettings }) {
  return threadDetailResponsePreparationService.readFullThreadDetailForOrchestrator({ threadId, summary, runtimeSettings });
}

function fallbackThreadReadResultForOrchestrator({ threadId, summary, runtimeSettings, warning, mode }) {
  return threadDetailResponsePreparationService.fallbackThreadReadResultForOrchestrator({ threadId, summary, runtimeSettings, warning, mode });
}

function filterFallbackThreads(threads, filters = {}) {
  const globalState = filters.globalState || readGlobalState();
  const visibility = visibilityFromGlobalState(globalState);
  const archivedIds = filters.archivedIds && typeof filters.archivedIds.has === "function"
    ? filters.archivedIds
    : archivedSessionThreadIds();
  const cwdFilter = String(filters.cwd || "").trim();
  const search = String(filters.searchTerm || "").trim().toLowerCase();
  const shouldFilterByWorkspace = anyThreadMatchesVisibleWorkspace(threads, visibility);
  return threads
    .filter((thread) => {
      if (shouldHideThreadListSummary(thread, archivedIds)) return false;
      if (!shouldFilterByWorkspace) return true;
      if (threadProjectlessVisible(thread, visibility)) return true;
      const cwd = String(thread && thread.cwd || "").trim();
      if (cwd) return threadWorkspaceVisible(cwd, visibility);
      return false;
    })
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

const threadListFallbackSourceService = createThreadListFallbackSourceService({
  codexHome: CODEX_HOME,
  sessionsDir: SESSIONS_DIR,
  rolloutActiveStatusWindowMs: ROLLOUT_ACTIVE_STATUS_WINDOW_MS,
  staleContextOnlyActiveTurnMs: STALE_CONTEXT_ONLY_ACTIVE_TURN_MS,
  incrementBoundedDiagnosticCounter,
  parseJsonLine,
  readRolloutTail,
  rolloutEntryTurnId,
  timestampToMs,
  statusText,
  statusTurnId,
  isThreadListLiveStatus,
  isLiveTurn,
  rolloutPathForThread,
  readStateDbThread,
  rowToFallbackThread,
  filterFallbackThreads,
  archivedSessionThreadIds,
  collectRecentRolloutFiles,
  threadIdFromRolloutPath,
  isBackupRolloutPath,
  readGlobalState,
  visibleProjectlessThreadIds,
  upsertThreadListFallbackCacheThread,
  applySessionIndexTitleToThread,
});

function attachRolloutFallbackStatus(thread, options = {}) {
  return threadListFallbackSourceService.attachRolloutFallbackStatus(thread, options);
}

function fallbackDisplayText(value, maxLength = 500) {
  return threadListFallbackSourceService.fallbackDisplayText(value, maxLength);
}

function hydrateThreadTitleFromSessionIndex(thread, indexEntries = readSessionIndexEntries()) {
  return threadListFallbackSourceService.hydrateThreadTitleFromSessionIndex(thread, indexEntries);
}

function inferRolloutFallbackStatus(rolloutPath, stat = null, nowMs = Date.now(), options = {}) {
  return threadListFallbackSourceService.inferRolloutFallbackStatus(rolloutPath, stat, nowMs, options);
}

function isRolloutTerminalEntry(entry) {
  return threadListFallbackSourceService.isRolloutTerminalEntry(entry);
}

function normalizeStaleContextOnlyActiveThread(thread, options = {}) {
  return threadListFallbackSourceService.normalizeStaleContextOnlyActiveThread(thread, options);
}

function persistThreadTitleToSessionIndex(threadId, threadName, updatedAt = new Date()) {
  return threadListFallbackSourceService.persistThreadTitleToSessionIndex(threadId, threadName, updatedAt);
}

function readRolloutHead(rolloutPath, maxBytes = 128 * 1024, options = {}) {
  return threadListFallbackSourceService.readRolloutHead(rolloutPath, maxBytes, options);
}

function readRolloutSessionFallback(limit = 80, filters = {}) {
  return threadListFallbackSourceService.readRolloutSessionFallback(limit, filters);
}

function readRolloutSessionFallbackThread(threadId) {
  return threadListFallbackSourceService.readRolloutSessionFallbackThread(threadId);
}

function readRolloutSessionFallbackThreadFromFile(file, indexEntry = {}, options = {}) {
  return threadListFallbackSourceService.readRolloutSessionFallbackThreadFromFile(file, indexEntry, options);
}

function readSessionIndexEntries(maxLines = 2000, options = {}) {
  return threadListFallbackSourceService.readSessionIndexEntries(maxLines, options);
}

function readSessionIndexEntriesForFallback(maxLines = 2000, options = {}) {
  return threadListFallbackSourceService.readSessionIndexEntriesForFallback(maxLines, options);
}

function readSessionIndexFallback(limit = 80, filters = {}) {
  return threadListFallbackSourceService.readSessionIndexFallback(limit, filters);
}

function rolloutLatestTurnEvidence(rolloutPath, stat = null, options = {}) {
  return threadListFallbackSourceService.rolloutLatestTurnEvidence(rolloutPath, stat, options);
}

function staleContextOnlyActiveEvidenceForRollout(rolloutPath, options = {}) {
  return threadListFallbackSourceService.staleContextOnlyActiveEvidenceForRollout(rolloutPath, options);
}

function staleContextOnlyActiveStatus(previousStatus, evidence) {
  return threadListFallbackSourceService.staleContextOnlyActiveStatus(previousStatus, evidence);
}

const threadListFallbackCacheService = createThreadListFallbackCacheService({
  ttlMs: THREAD_LIST_FALLBACK_CACHE_TTL_MS,
  maxEntries: 12,
  persistentStore: createThreadListFallbackPersistentCacheStore({
    filePath: THREAD_LIST_FALLBACK_CACHE_FILE,
    maxEntries: 12,
    maxThreadsPerEntry: 200,
    maxAgeMs: THREAD_LIST_FALLBACK_CACHE_PERSIST_MAX_AGE_MS,
  }),
  readGlobalState,
  normalizeFsPath,
  normalizeThreadId,
  visibleWorkspaceRoots,
  visibleProjectlessThreadIds,
  mergeThreadDisplaySummary,
  normalizeThreadSummaryLiveStatus,
  filterFallbackThreads,
  mergeThreadSummaryList,
  readStateDbFallback,
  readRolloutSessionFallback,
  readSessionIndexFallback,
});
const threadListResponseCoalescer = createThreadListResponseCoalescer();

function clearThreadListFallbackCache() {
  threadListFallbackCacheService.clear();
}

function removeThreadFromThreadListFallbackCache(threadId) {
  return threadListFallbackCacheService.removeThread(threadId);
}

function upsertThreadListFallbackCacheThread(thread, options = {}) {
  return threadListFallbackCacheService.upsertThread(thread, options);
}

function detailReadThreadSummaryForFallbackCache(body = {}) {
  return threadSummaryStateService.detailReadThreadSummaryForFallbackCache(body);
}

function syncThreadDetailReadResultToThreadListFallbackCache(payload = {}) {
  return threadSummaryStateService.syncThreadDetailReadResultToThreadListFallbackCache(payload);
}

function updateThreadListFallbackCacheStatus(threadId, status, meta = {}) {
  return threadListFallbackCacheService.updateStatus(threadId, status, meta);
}

function applyThreadStatusPayloadToThreadListFallbackCache(payload) {
  return threadListFallbackCacheService.applyStatusPayload(payload);
}

function trackThreadDetailRequestLifecycle(res) {
  activeThreadDetailRequestCount += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeThreadDetailRequestCount = Math.max(0, activeThreadDetailRequestCount - 1);
  };
  if (res && typeof res.once === "function") {
    res.once("finish", release);
    res.once("close", release);
  }
  return release;
}

function shouldDeferThreadListFallbackForActiveDetail({ deferFallback, cursor, archived, searchTerm, cwd } = {}) {
  if (deferFallback) return true;
  if (cursor || archived || searchTerm || cwd) return false;
  return activeThreadDetailRequestCount > 0;
}

function clonePlainJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function threadListFallbackCacheKey(limit, filters = {}) {
  return threadListFallbackCacheService.cacheKey(limit, filters);
}

function rememberThreadListFallbackCache(key, threads, timings = {}, options = {}) {
  threadListFallbackCacheService.remember(key, threads, timings, options);
}

function readThreadListFallbackCache(key) {
  return threadListFallbackCacheService.read(key);
}

function readThreadListCachedFallback(limit = 80, filters = {}) {
  return threadListFallbackCacheService.readCachedFallback(limit, filters);
}

function readThreadListFallback(limit = 80, filters = {}) {
  return threadListFallbackCacheService.readFallback(limit, filters);
}

const threadListFallbackPrewarmService = createThreadListFallbackPrewarmService({
  readFallback: readThreadListFallback,
  readGlobalState,
  shouldRun: () => (activeThreadDetailRequestCount > 0
    ? { run: false, reason: "active-detail-in-flight" }
    : { run: true }),
  onResult: ({ threads }) => scheduleActiveWindowPrewarmFromThreadListResult({
    data: threads,
  }, "thread-list-prewarm:completed"),
  logger: console,
});

function threadListFallbackPrewarmConfig() {
  return {
    enabled: THREAD_LIST_FALLBACK_PREWARM_ENABLED,
    delayMs: THREAD_LIST_FALLBACK_PREWARM_DELAY_MS,
    retryDelayMs: THREAD_LIST_FALLBACK_PREWARM_RETRY_MS,
    maxDeferrals: THREAD_LIST_FALLBACK_PREWARM_MAX_DEFERRALS,
    limit: THREAD_LIST_FALLBACK_PREWARM_LIMIT,
    sourceSnapshotLimit: THREAD_LIST_FALLBACK_PREWARM_SOURCE_SNAPSHOT_LIMIT,
  };
}

function threadListFallbackPrewarmPublicStatus() {
  return summarizePrewarmStatus(
    threadListFallbackPrewarmService.status(),
    threadListFallbackPrewarmConfig(),
  );
}

function scheduleThreadListFallbackPrewarm() {
  return threadListFallbackPrewarmService.schedule(threadListFallbackPrewarmConfig());
}

function threadListFallbackSourceDiagnosticTimingFields(diagnostics = {}) {
  return {
    fallbackRolloutDirectoryReadCount: Number(diagnostics.rolloutDirectoryReadCount || 0),
    fallbackRolloutFileStatCount: Number(diagnostics.rolloutFileStatCount || 0),
    fallbackRolloutFileCollectedCount: Number(diagnostics.rolloutFileCollectedCount || 0),
    fallbackRolloutFileSortedCount: Number(diagnostics.rolloutFileSortedCount || 0),
    fallbackRolloutCandidateFileCount: Number(diagnostics.rolloutCandidateFileCount || 0),
    fallbackRolloutCandidateScannedCount: Number(diagnostics.rolloutCandidateScannedCount || 0),
    fallbackRolloutHeadReadCount: Number(diagnostics.rolloutHeadReadCount || 0),
    fallbackRolloutHeadBytes: Number(diagnostics.rolloutHeadBytes || 0),
    fallbackRolloutSummaryReadCount: Number(diagnostics.rolloutSummaryReadCount || 0),
    fallbackRolloutStatusAttachCount: Number(diagnostics.rolloutStatusAttachCount || 0),
    fallbackRolloutStatusStatReadCount: Number(diagnostics.rolloutStatusStatReadCount || 0),
    fallbackRolloutStatusStatReuseCount: Number(diagnostics.rolloutStatusStatReuseCount || 0),
    fallbackRolloutStatusTailReadCount: Number(diagnostics.rolloutStatusTailReadCount || 0),
    fallbackRolloutStatusTailBytes: Number(diagnostics.rolloutStatusTailBytes || 0),
    fallbackSessionIndexReadCount: Number(diagnostics.sessionIndexReadCount || 0),
    fallbackSessionIndexReuseCount: Number(diagnostics.sessionIndexReuseCount || 0),
    fallbackSessionIndexLineCount: Number(diagnostics.sessionIndexLineCount || 0),
    fallbackSessionIndexEntryCount: Number(diagnostics.sessionIndexEntryCount || 0),
  };
}

function threadListFallbackBaselineWorkTimingFields(diagnostics = {}) {
  return {
    fallbackBaselineFinalFilterPassCount: Number(diagnostics.baselineFinalFilterPassCount || 0),
    fallbackBaselineFinalFilterInputCount: Number(diagnostics.baselineFinalFilterInputCount || 0),
    fallbackBaselineFinalFilterOutputCount: Number(diagnostics.baselineFinalFilterOutputCount || 0),
    fallbackBaselineMergeInputCount: Number(diagnostics.baselineMergeInputCount || 0),
    fallbackBaselineMergeOutputCount: Number(diagnostics.baselineMergeOutputCount || 0),
    fallbackBaselineMergeDuplicateCount: Number(diagnostics.baselineMergeDuplicateCount || 0),
    fallbackBaselineLimitDropCount: Number(diagnostics.baselineLimitDropCount || 0),
  };
}

function threadListTokenUsageTimingFields(diagnostics = {}) {
  const source = diagnostics && typeof diagnostics === "object" ? diagnostics : {};
  return {
    tokenUsageAllowExpiredCache: source.allowExpiredCache === true,
    tokenUsageCacheHitCount: Number(source.cacheHitCount || 0),
    tokenUsageFreshCacheHitCount: Number(source.freshCacheHitCount || 0),
    tokenUsageStaleCacheHitCount: Number(source.staleCacheHitCount || 0),
    tokenUsageCacheMissCount: Number(source.cacheMissCount || 0),
    tokenUsageExpiredMissCount: Number(source.expiredMissCount || 0),
    tokenUsageQueryCount: Number(source.queryCount || 0),
    tokenUsageMaxCacheAgeMs: Number(source.maxCacheAgeMs || 0),
    tokenUsageCacheCloneMs: Number(source.cacheCloneMs || 0),
    tokenUsageWorkspaceCwdCount: Number(source.workspaceCwdCount || 0),
    tokenUsageWorkspaceSnapshotBuildMs: Number(source.workspaceSnapshotBuildMs || 0),
    tokenUsageWorkspaceSnapshotCacheHitCount: Number(source.workspaceSnapshotCacheHitCount || 0),
    tokenUsageWorkspaceSnapshotCacheMissCount: Number(source.workspaceSnapshotCacheMissCount || 0),
    tokenUsageDecorateSummaryMs: Number(source.decorateSummaryMs || 0),
    tokenUsageDecorateAttachMs: Number(source.decorateAttachMs || 0),
  };
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
  const publicCoreRouteResult = await coreApiRouteService.handlePublicRoute({
    url,
    req,
    res,
    readBody: () => readBody(req),
    sendJson: (status, body, headers) => sendJson(res, status, body, headers),
  });
  if (publicCoreRouteResult.handled) return;
  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }
  const authorizedCoreRouteResult = await coreApiRouteService.handleAuthorizedRoute({
    url,
    req,
    res,
    readBody: () => readBody(req),
    sendJson: (status, body, headers) => sendJson(res, status, body, headers),
  });
  if (authorizedCoreRouteResult.handled) return;
  const webPushRouteResult = await webPushRuntimeService.handleRoute({
    url,
    method: req.method,
    req,
    readBody: () => readBody(req),
    sendJson: (status, body) => sendJson(res, status, body),
  });
  if (webPushRouteResult.handled) {
    return;
  }
  const mediaFileRouteResult = await mediaFileService.handleMediaFileRoute({
    url,
    method: req.method,
    req,
    res,
    sendJson: (status, body) => sendJson(res, status, body),
  });
  if (mediaFileRouteResult.handled) {
    return;
  }
  const threadSideChatRouteResult = await handleThreadSideChatRoute({
    url,
    method: req.method,
    readBody: () => readBody(req),
    threadSideChatService,
    orchestrationService: threadSideChatOrchestrationService,
    sendJson: (status, body) => sendJson(res, status, body),
  });
  if (threadSideChatRouteResult.handled) {
    return;
  }
  const threadTaskCardRouteResult = await threadTaskCardRouteService.handleRoute({
    url,
    method: req.method,
    readBody: () => readBody(req),
    sendJson: (status, body) => sendJson(res, status, body),
  });
  if (threadTaskCardRouteResult.handled) {
    return;
  }
  if (url.pathname === "/api/workspaces" && req.method === "GET") {
    sendJson(res, 200, { data: await listWorkspaces() });
    return;
  }
  if (url.pathname === "/api/workspaces" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const created = workspaceRegistryService.create(body);
      syncRegisteredWorkspaceTrust(CODEX_HOME);
      syncKnownCodexMobileMcpToolsets();
      sendJson(res, 200, created);
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
  if (url.pathname === "/api/chatgpt-pro/status" && req.method === "GET") {
    sendJson(res, 200, chatGptProBridgeService.status());
    return;
  }
  if (url.pathname === "/api/chatgpt-pro/planner/status" && req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      planner: chatGptProPlannerService.status(),
      mcp: chatGptProMcpService.status(),
    });
    return;
  }
  if (url.pathname === "/api/chatgpt-pro/planner/artifacts" && req.method === "GET") {
    try {
      sendJson(res, 200, chatGptProPlannerService.listPlannerArtifacts({
        limit: url.searchParams.get("limit") || 20,
        type: url.searchParams.get("type") || "",
        threadId: url.searchParams.get("threadId") || url.searchParams.get("thread_id") || "",
        cwd: url.searchParams.get("cwd") || "",
      }));
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  if (url.pathname === "/api/chatgpt-pro/planner/artifacts" && req.method === "POST") {
    try {
      const body = await readBody(req);
      sendJson(res, 201, { ok: true, artifact: chatGptProPlannerService.createPlannerArtifact(body) });
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  const chatGptPlannerArtifactMatch = url.pathname.match(/^\/api\/chatgpt-pro\/planner\/artifacts\/([^/]+)$/);
  if (chatGptPlannerArtifactMatch && req.method === "GET") {
    try {
      sendJson(res, 200, chatGptProPlannerService.readPlannerArtifact({
        id: decodeURIComponent(chatGptPlannerArtifactMatch[1]),
      }));
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  if (url.pathname === "/api/chatgpt-pro/generate" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const prompt = String(body.prompt || body.text || "").trim();
      if (!chatGptProBridgeService.isRequestText(prompt)) {
        sendJson(res, 400, { ok: false, error: "Use @ChatGPT Pro to start a ChatGPT Pro bridge request." });
        return;
      }
      const sourceSummary = await chatGptProSourceSummary(body);
      sendJson(res, 202, await chatGptProBridgeService.start(Object.assign({}, body, {
        prompt,
        sourceSummary,
      })));
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  const continuationJobMatch = url.pathname.match(/^\/api\/thread-continuations\/([^/]+)$/);
  if (continuationJobMatch && req.method === "GET") {
    const jobId = decodeURIComponent(continuationJobMatch[1]);
    const job = getContinuationJob(jobId);
    if (!job) {
      sendJson(res, 404, { error: "Continuation job not found" });
      return;
    }
    sendJson(res, 200, publicContinuationJob(job));
    return;
  }
  const threadMessageRouteResult = await threadMessageRouteService.handleRoute({
    url,
    method: req.method,
    readBody: () => readBody(req),
    readMessageBody: (threadId) => readMessageBody(req, threadId),
    sendJson: (status, body) => sendJson(res, status, body),
  });
  if (threadMessageRouteResult.handled) {
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
  const threadGoal = url.pathname.match(/^\/api\/threads\/([^/]+)\/goal$/);
  if (threadGoal && req.method === "POST") {
    try {
      const threadId = decodeURIComponent(threadGoal[1]);
      const body = await readBody(req);
      sendJson(res, 200, await setThreadGoal(threadId, body));
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  const threadGoalAction = url.pathname.match(/^\/api\/threads\/([^/]+)\/goal\/actions$/);
  if (threadGoalAction && req.method === "POST") {
    try {
      const threadId = decodeURIComponent(threadGoalAction[1]);
      const body = await readBody(req);
      sendJson(res, 200, await runThreadGoalAction(threadId, body));
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  const threadListRouteResult = await handleThreadListRoute({
    url,
    method: req.method,
    sendJson: (status, body, headers) => sendJson(res, status, body, headers),
    archivedSessionThreadIds,
    readSessionIndexEntries,
    rolloutStatsForPath,
    threadDisplaySummaryCache,
    mergeThreadDisplaySummary,
    normalizeStaleContextOnlyActiveThread,
    readGlobalState,
    visibilityFromGlobalState,
    normalizeFsPath,
    threadListResponseCoalescer,
    readThreadListCachedFallback,
    readThreadListFallback,
    threadListFallbackBaselineWorkTimingFields,
    threadListFallbackSourceDiagnosticTimingFields,
    normalizeThreadListResultStatuses,
    attachThreadListStateToResult,
    tokenUsageStatsService,
    tokenUsageWorkspaceCwds,
    threadListTokenUsageTimingFields,
    logThreadList,
    scheduleActiveWindowPrewarmFromThreadListResult,
    codex,
    filterVisibleThreads,
    filterThreadListByCwd,
    shouldDeferThreadListFallbackForActiveDetail,
    hydrateThreadListResultTitlesFromSessionIndex,
    upsertThreadListFallbackCacheThreads,
    mergeThreadSummaryListWithDiagnostics,
    normalizeThreadSummaryLiveStatus,
    threadListDefaultWarmFallbackEnabled: THREAD_LIST_DEFAULT_WARM_FALLBACK_ENABLED,
    readRpcTimeoutMs: READ_RPC_TIMEOUT_MS,
  });
  if (threadListRouteResult.handled) return;
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
      const titleIndexed = persistThreadTitleToSessionIndex(threadId, name);
      if (!updated && !titleIndexed) {
        sendJson(res, 501, { error: "Thread rename is not supported by this app-server" });
        return;
      }
      rememberStartedThread(Object.assign({}, readStartedThread(threadId) || readRolloutSessionFallbackThread(threadId) || {}, {
        id: threadId,
        name,
        preview: name,
        status: { type: "notLoaded" },
      }));
      sendJson(res, 200, {
        ok: true,
        threadId,
        name,
        titleUpdated: updated,
        titleIndexed,
        warning: updated ? "" : "Thread rename was stored in the Mobile fallback index; app-server rename is unavailable.",
      });
    } catch (err) {
      if (isRecoverableThreadTitleUpdateError(err)) {
        const titleIndexed = persistThreadTitleToSessionIndex(threadId, name);
        if (titleIndexed) {
          rememberStartedThread(Object.assign({}, readStartedThread(threadId) || readRolloutSessionFallbackThread(threadId) || {}, {
            id: threadId,
            name,
            preview: name,
            status: { type: "notLoaded" },
          }));
          sendJson(res, 200, {
            ok: true,
            threadId,
            name,
            titleUpdated: false,
            titleIndexed,
            warning: "Thread rename was stored in the Mobile fallback index; app-server title update is temporarily unavailable.",
          });
          return;
        }
      }
      sendJson(res, err.statusCode || 500, { error: err.message || String(err) });
    }
    return;
  }
  const threadRead = url.pathname.match(/^\/api\/threads\/([^/]+)$/);
  if (threadRead && req.method === "GET") {
    trackThreadDetailRequestLifecycle(res);
    const threadId = decodeURIComponent(threadRead[1]);
    await handleThreadDetailReadRoute({
      codex,
      threadId,
      url,
      readThreadDetail: (request) => threadDetailReadOrchestrationService.readThreadDetail(request),
      sendJson: (status, body) => sendJson(res, status, body),
      onThreadDetailReadResult: (payload) => syncThreadDetailReadResultToThreadListFallbackCache(payload),
      logThreadDetail,
    });
    return;
  }
  const threadTurns = url.pathname.match(/^\/api\/threads\/([^/]+)\/turns$/);
  if (threadTurns && req.method === "GET") {
    const threadId = decodeURIComponent(threadTurns[1]);
    const summary = readStateDbThread(threadId) || readStartedThread(threadId) || readRolloutSessionFallbackThread(threadId) || null;
    const cursor = parseThreadTurnsCursor(url.searchParams.get("cursor"));
    const params = {
      threadId,
      limit: Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || String(MAX_THREAD_TURNS)))),
      sortDirection: url.searchParams.get("sortDirection") || "asc",
    };
    if (cursor) params.cursor = cursor;
    sendJson(res, 200, compactTurnsListResult(
      await codex.request("thread/turns/list", params, { timeoutMs: READ_RPC_TIMEOUT_MS, retry: false, resetOnTimeout: false }),
      { threadId, summary },
    ));
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
  try {
    if (!PERSIST_MOBILE_OWNED_MUX && codex.muxChild && codex.muxChild.exitCode === null) codex.muxChild.kill();
  } catch (_) {}
  process.exit(0);
}

function startServer() {
  syncRegisteredWorkspaceTrust(CODEX_HOME);
  syncKnownCodexMobileMcpToolsets();
  server.listen(PORT, HOST, () => {
    console.log(`Codex Mobile Web listening on http://${HOST}:${PORT}`);
    if (REQUIRE_SHARED_APP_SERVER) {
      console.log(`Codex Mobile Web requires a shared app-server endpoint: ${MUX_ENDPOINT_FILE}`);
    } else {
      console.log(`Codex app-server will be managed on 127.0.0.1 when first used.`);
    }
    console.log(DISABLE_AUTH ? "Authentication disabled by CODEX_MOBILE_DISABLE_AUTH." : `Authentication enabled; key source is env CODEX_MOBILE_KEY or ${AUTH_KEY_FILE}.`);
    scheduleStartupAppUpdateCheck();
    scheduleThreadListFallbackPrewarm();
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  approvalResponsePayload,
  anyThreadMatchesVisibleWorkspace,
  attachRolloutFallbackStatus,
  appendRolloutActiveAssistantItemsToDetailResult,
  applyLocalActiveThreadStatusToSummary,
  backfillMissingRolloutCompletionTurnsForDetailResult,
  codeGraphMcpElicitationToolName,
  codeGraphReadOnlyMcpElicitationDecision,
  clearLocalActiveThreadStatus,
  clearThreadSummaryActiveMarkers,
  collectRecentRolloutFiles,
  compactThread,
  dedupeSyntheticActiveAssistantMessagesInThread,
  detailReadThreadSummaryForFallbackCache,
  enrichThreadItemTimestampsFromRollout,
  filterFallbackThreads,
  filePreviewContentDisposition,
  filePreviewContentType,
  filePreviewAuthoritiesForThread,
  filePreviewSkillRoots,
  generatedImageContentUrl,
  hydrateThreadListResultTitlesFromSessionIndex,
  hydrateThreadListTitlesFromSessionIndex,
  isHiddenThread,
  mergeThreadListFallback,
  mimeFor,
  normalizeStaleContextOnlyActiveThread,
  normalizeThreadListResultStatuses,
  previewRootsForThread,
  previewFileReferencesFromText,
  parseThreadTurnsCursor,
  profileSwitchPreflightError,
  profileSwitchRateLimitsWarningForError,
  readFilePreview,
  readRolloutItemTimestampCandidates,
  readRolloutSessionFallbackThreadFromFile,
  rememberLocalActiveThreadStatus,
  resolveThreadTaskCardTargetReference,
  resolvedThreadTaskCardTargetIds,
  resolveFilePreviewPath,
  attachPendingServerRequestsToResult,
  buildThreadTaskCardCreatePayload,
  clearStaticCompressionCache,
  createThreadTaskCardsFromSourceThread,
  publicServerRequest,
  serveFilePreviewContent,
  serveStatic,
  serverRequestResponsePayload,
  sortTurnsChronologically,
  syncThreadDetailReadResultToThreadListFallbackCache,
  staticCompressionCacheStats,
  staticCompressionEncoding,
  stripThreadListDetailFields,
  stripThreadListResultDetailFields,
  stripMarkdownFileTarget,
  taskCardSourceThreadTitle,
  threadDisplayPublicSettings,
  setThreadDisplaySettings,
  threadStatusChangedPayloadFromTurnNotification,
  threadDisplayTitle,
  threadMatchesWorkspaceCwd,
  threadTaskCardCanonicalVisibleTargets,
  uploadPathForId,
  taskCardReturnDynamicToolSpec,
  workspaceDelegationDynamicToolSpec,
  attachTaskCardRuntimeDynamicTools,
  attachWorkspaceDelegationRuntimeGuidance,
  taskCardReturnScriptFallbackInstruction,
  workspaceDelegationScriptFallbackInstruction,
  dynamicToolTextResponse,
};
