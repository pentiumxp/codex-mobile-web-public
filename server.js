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
  imageViewSourcePath,
} = require("./adapters/generated-image-cache-service");
const { createGeneratedImageContentService } = require("./adapters/generated-image-content-service");
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
const { createThreadGoalActionService } = require("./adapters/thread-goal-action-service");
const { createRuntimePermissionPolicyService } = require("./adapters/runtime-permission-policy-service");
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
const { compactThreadDetailResponseResult } = require("./services/thread-detail/thread-detail-response-budget-service");
const {
  appendLatestCompletedUserInputAnchors,
  collectRolloutUserInputAnchors,
} = require("./adapters/thread-detail-user-input-anchor-service");
const { createThreadDetailSummaryService } = require("./adapters/thread-detail-summary-service");
const { createThreadDetailBoundedReadPolicyService } = require("./services/thread-detail/thread-detail-bounded-read-policy-service");
const { createThreadDetailActiveOverlayProviderService } = require("./services/thread-detail/thread-detail-active-overlay-provider-service");
const { createThreadDetailActiveWindowPrewarmService } = require("./services/thread-detail/thread-detail-active-window-prewarm-service");
const { createThreadDetailTurnsListReadCoalescer } = require("./services/thread-detail/thread-detail-turns-list-read-coalescer-service");
const { attachThreadDetailDiagnostics } = require("./adapters/thread-detail-performance-service");
const { createThreadDetailReadOrchestrationService } = require("./services/thread-detail/thread-detail-read-orchestration-service");
const { handleThreadDetailReadRoute } = require("./server-routes/thread-detail-route-service");
const { createThreadDetailResponsePreparationService } = require("./services/thread-detail/thread-detail-response-preparation-service");
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
const { createThreadDetailCompactionService } = require("./adapters/thread-detail-compaction-service");
const { createThreadEventNotificationService } = require("./adapters/thread-event-notification-service");
const { createRateLimitRuntimeService } = require("./adapters/rate-limit-runtime-service");
const { createThreadVisibilityService } = require("./adapters/thread-visibility-service");
const { createThreadCompletionDiagnosticService } = require("./adapters/thread-completion-diagnostic-service");
const { createChatGptProBridgeService } = require("./adapters/chatgpt-pro-bridge-service");
const { createChatGptProPlannerService } = require("./adapters/chatgpt-pro-planner-service");
const { createChatGptProMcpService } = require("./adapters/chatgpt-pro-mcp-service");
const { createWorkspaceSourceWriteGuard } = require("./adapters/workspace-source-write-guard-service");
const { createThreadSideChatOrchestrationService } = require("./adapters/thread-side-chat-orchestration-service");
const { handleThreadSideChatRoute } = require("./server-routes/thread-side-chat-route-service");
const { createThreadMessageRouteService } = require("./server-routes/thread-message-route-service");
const { handleThreadListRoute } = require("./server-routes/thread-list-route-service");
const { createCodexAppServerClient } = require("./adapters/codex-app-server-client-service");
const { createStaticFileService } = require("./adapters/static-file-service");
const { createServerRuntimeUtils } = require("./adapters/server-runtime-utils");
const { createServerHttpRuntimeService } = require("./adapters/server-http-runtime-service");
const { createRuntimeSettingsService } = require("./adapters/runtime-settings-service");
const { createCoreApiRouteService } = require("./server-routes/core-api-route-service");
const { createAppMaintenanceService } = require("./adapters/app-maintenance-service");
const { createAppServerRequestPolicyService } = require("./adapters/app-server-request-policy-service");
const { createRolloutDetailEnrichmentService } = require("./adapters/rollout-detail-enrichment-service");
const { createThreadDetailRolloutBackfillService } = require("./adapters/thread-detail-rollout-backfill-service");
const { createApiDispatchRouteService } = require("./server-routes/api-dispatch-route-service");
const {
  createAutoTurnRecoveryService,
  turnStartResultTurnId,
} = require("./adapters/auto-turn-recovery-service");

const APP_ROOT = __dirname;
const PUBLIC_ROOT = path.join(APP_ROOT, "public");
const USER_HOME = process.env.USERPROFILE || process.env.HOME || process.cwd();

const serverRuntimeUtils = createServerRuntimeUtils({
  fs,
  path,
  crypto,
  env: process.env,
  appRoot: APP_ROOT,
  publicRoot: PUBLIC_ROOT,
  userHome: USER_HOME,
  getCodexHome: () => CODEX_HOME,
  getAppVersion: () => APP_VERSION,
});
const {
  appShellBuildId,
  assertCommandAvailable,
  clientBuildId,
  codexAppServerChildEnv,
  currentPublicBuildConfig,
  detectDevelopmentWorkspaceRoot,
  findExecutableInDirs,
  optionListFromEnv,
  pathEntriesFromEnvPath,
  readPackageVersion,
  readServiceWorkerCacheName,
  resolveDefaultCodexExecutable,
  resolveMuxEndpointFile,
  uniqueStrings,
} = serverRuntimeUtils;

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
const serverHttpRuntimeService = createServerHttpRuntimeService({
  fs,
  path,
  crypto,
  env: process.env,
  authKeyFile: AUTH_KEY_FILE,
  disableAuth: DISABLE_AUTH,
  getAuthKey: () => AUTH_KEY,
  getHermesPluginService: () => hermesPluginService,
  getCodexHome: () => CODEX_HOME,
  getMobileWebLogFile: () => MOBILE_WEB_LOG_FILE,
  getMobileWebLogMaxBytes: () => MOBILE_WEB_LOG_MAX_BYTES,
  getMobileWebLogKeepBytes: () => MOBILE_WEB_LOG_KEEP_BYTES,
  getMaxStructuredChars: () => MAX_STRUCTURED_CHARS,
});
const {
  readCodexConfigDefaults,
  loadAuthKey,
  timingSafeEquals,
  parseCookies,
  getUrl,
  bearerTokenFromRequest,
  requestAuthToken,
  pushUniqueAuthToken,
  requestAuthTokens,
  isAccessKeyAuthorized,
  isAuthorized,
  isHttpsRequest,
  pluginSessionCookieHeader,
  sendJson,
  hermesOriginFromRequest,
  requestBaseUrl,
  trimLogFile,
  trimRuntimeLogs,
  safeLogDetails,
  logThreadDetail,
  logThreadList,
  logContinuation,
  logMessageSubmit,
  logClientEvent,
  isTurnSteerUnsupportedError,
  isStaleActiveTurnError,
  isCodexAccountAuthError,
  codexAccountAuthErrorPayload,
  truncateMiddle,
  truncateTail,
  redactInlineImageDataUrls,
  compactStructured,
  compactStringArray,
  statusText,
} = serverHttpRuntimeService;
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

function ensureWorkspaceVisibleForContinuation(cwd) {
  const registered = workspaceRegistryService.registerExisting({ cwd });
  syncRegisteredWorkspaceTrust(CODEX_HOME);
  syncKnownCodexMobileMcpToolsets();
  return registered;
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
let threadGoalActionService = null;
let currentThreadGoalForAction = null;
let isThreadGoalRpcUnsupportedError = null;
let runThreadGoalAction = null;
let setThreadGoal = null;
let setThreadGoalRpc = null;
let threadGoalFromRpcResult = null;
let threadGoalSetParams = null;
let threadEventNotificationService;
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
const threadVisibilityService = createThreadVisibilityService({
  archivedSessionsDir: ARCHIVED_SESSIONS_DIR,
  codexHome: CODEX_HOME,
  defaultCodexHome: DEFAULT_CODEX_HOME,
  fallbackDisplayText,
  getCodex: () => codex,
  getMutationRpcTimeoutMs: () => MUTATION_RPC_TIMEOUT_MS,
  isThreadListLiveStatus,
  isThreadListUnknownStatus,
  mobileArchiveIndexService,
  normalizeThreadId,
  readGlobalState,
  readSessionIndexEntries,
  readStartedThread,
  readStateDbThread,
  readThreadSummaryFromAppServer,
  removeThreadFromThreadListFallbackCache,
  rolloutStatsAnnotator: annotateThreadRolloutStats,
  runSqliteJson,
  sqlString,
  stateDb: STATE_DB,
  statusText,
  threadSideChatService,
  timestampToMs,
  userHome: USER_HOME,
  workspaceRegistryService,
  rowToFallbackThread,
});
const {
  normalizeFsPath,
  visibleWorkspaceRoots,
  visibleWorkspaceKeys,
  visibleWorkspaceNames,
  visibleProjectlessThreadIds,
  visibilityFromGlobalState,
  codexWorktreeRepoName,
  threadWorkspaceVisible,
  threadProjectlessVisible,
  anyThreadMatchesVisibleWorkspace,
  threadMatchesWorkspaceCwd,
  isBackupRolloutPath,
  isSubagentThreadSummary,
  isSideChatSidecarThreadSummary,
  threadSummaryHasDisplayText,
  isResidualFallbackThreadSummary,
  isUnmaterializedThreadListPlaceholder,
  shouldHideThreadListSummary,
  archivedSessionDirectories,
  addArchivedSessionIdsFromDir,
  archivedSessionThreadIds,
  threadHasArchiveSignal,
  rememberMobileArchivedThreadId,
  archivedResultWithMobileIndex,
  alreadyArchivedResult,
  mobileArchivedFallbackResult,
  isThreadIdArchivedLocally,
  isHiddenThread,
  filterThreadListByCwd,
  isThreadIdLikeTitle,
  isRecoverableThreadListTitle,
  sessionIndexDisplayName,
  applySessionIndexTitleToThread,
  hydrateThreadListTitlesFromSessionIndex,
  hydrateThreadListResultTitlesFromSessionIndex,
  filterVisibleThreads,
  mergeThreadStateFromStateDb,
  archiveVisibleThread,
  isThreadArchiveNoOpError,
  archiveThreadId,
  filterFallbackThreads,
  readStateDbFallback,
} = threadVisibilityService;
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
const isCodexMobileUploadFilePath = (filePath) => isPathInside(UPLOAD_ROOT, filePath);
const generatedImageContentService = createGeneratedImageContentService({
  path,
  generatedImageRoot: GENERATED_IMAGE_ROOT,
  filePreviewMediaMaxBytes: FILE_PREVIEW_MEDIA_MAX_BYTES,
  filePreviewImageContentTypes: FILE_PREVIEW_IMAGE_CONTENT_TYPES,
  generatedImageContentUrl,
  hasDeniedPreviewPathSegment,
});
const {
  attachGeneratedImageContent,
} = generatedImageContentService;
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
const runtimePermissionPolicyService = createRuntimePermissionPolicyService({
  path,
  permissionModeOptions: PERMISSION_MODE_OPTIONS,
  codexConfigDefaults: CODEX_CONFIG_DEFAULTS,
});
const {
  applyPermissionModeOverride,
  defaultPermissionModeFromConfigDefaults,
  isFullAccessRuntime,
  normalizeEnumValue,
  normalizePermissionProfile,
  normalizeSandboxPolicy,
  normalizeSandboxPolicyType,
  publicRuntimeSettings,
  readOnlySandboxPolicy,
  sandboxModeFromPolicy,
  workspaceDelegationWriteGuardPermissionProfile,
  workspaceWriteSandboxPolicy,
} = runtimePermissionPolicyService;
threadGoalActionService = createThreadGoalActionService({
  codexRequest: (...args) => codex.request(...args),
  goalForThread: (threadId) => threadGoalService.goalForThread(threadId),
  httpStatusError,
  mutationRpcTimeoutMs: MUTATION_RPC_TIMEOUT_MS,
  normalizeThreadGoalStatus,
  readRpcTimeoutMs: READ_RPC_TIMEOUT_MS,
});
({
  currentThreadGoalForAction,
  isThreadGoalRpcUnsupportedError,
  runThreadGoalAction,
  setThreadGoal,
  setThreadGoalRpc,
  threadGoalFromRpcResult,
  threadGoalSetParams,
} = threadGoalActionService);
const PROCESS_STARTED_AT_MS = Date.now();

let clients = new Map();
let clientHeartbeats = new WeakMap();
const LIVE_RATE_LIMIT_REFRESH_MIN_INTERVAL_MS = 10000;
const latestRuntimeContextByPath = new Map();
const rolloutEnrichmentIndexService = createRolloutEnrichmentIndexService({
  maxIndexes: RUNTIME_CONTEXT_CACHE_MAX,
});
let appendRolloutToolOutputImagesToThread;
let insertProjectedItemByTimestamp;
let itemTimestampCandidateId;
let itemTimestampMatchText;
let readRolloutEnrichmentEntries;
let readRolloutEnrichmentText;
let readRolloutItemTimestampCandidates;
let readRolloutRuntimeScanText;
let readRolloutTail;
let readRolloutToolOutputImageItems;
let readRolloutTurnUsageSummaries;
let rolloutEntryTurnId;
let rolloutTimestampFields;
let timestampTextsMatch;
let visibleItemId;
let appendMissingRolloutCompletionTurnsToThread;
let appendRolloutActiveAssistantItemsToDetailResult;
let appendRolloutEmptyCompletionDiagnosticsToThread;
let appendRolloutFinalReceiptsToThread;
let appendRolloutUserInputAnchorsToDetailResult;
let backfillMissingRolloutCompletionTurnsForDetailResult;
let dedupeSyntheticActiveAssistantMessagesInThread;
let enrichThreadItemTimestampsFromRollout;
let finalizeActiveAssistantProjectionDetailResult;
let inferTurnItemDisplayTimestamps;
let itemDisplayTimestampMs;
let orderTurnItemsByDisplayTimestamp;
let turnCompletionUsageSummary;
const threadDetailCompactionService = createThreadDetailCompactionService({
  fs,
  path,
  operationalItemTypes: OPERATIONAL_ITEM_TYPES,
  maxTextChars: MAX_TEXT_CHARS,
  maxCommandOutputChars: MAX_COMMAND_OUTPUT_CHARS,
  maxCommandOutputCharsPerTurn: MAX_COMMAND_OUTPUT_CHARS_PER_TURN,
  maxLiveOperationItems: MAX_LIVE_OPERATION_ITEMS,
  maxThreadTurns: MAX_THREAD_TURNS,
  pendingSteerEchoStore,
  statusText,
  isCompletedStatus,
  isLiveTurn,
  truncateMiddle,
  truncateTail,
  compactStringArray,
  compactStructured,
  attachGeneratedImageContent,
  isCodexMobileUploadFilePath,
  normalizeFsPath,
  imageViewSourcePath,
  parseJsonLine,
  rolloutPathForThread,
  rolloutStatsForPath,
  reconcileThreadActiveTurnWithRolloutEvidence,
  normalizeSupersededLiveTurns,
  pruneSupersededLiveShellTurns,
  workspaceContextStatsForCwd,
  dedupeUserMessageEchoesInThread,
  normalizeStaleContextOnlyActiveThread,
  annotateThreadRolloutStats,
  readRolloutTail: (...args) => readRolloutTail(...args),
  readRolloutToolOutputImageItems: (...args) => readRolloutToolOutputImageItems(...args),
  readRolloutTurnUsageSummaries: (...args) => readRolloutTurnUsageSummaries(...args),
  rolloutEntryTurnId: (...args) => rolloutEntryTurnId(...args),
  rolloutTimestampFields: (...args) => rolloutTimestampFields(...args),
  appendRolloutToolOutputImagesToThread: (...args) => appendRolloutToolOutputImagesToThread(...args),
  appendMissingRolloutCompletionTurnsToThread: (...args) => appendMissingRolloutCompletionTurnsToThread(...args),
  appendRolloutFinalReceiptsToThread: (...args) => appendRolloutFinalReceiptsToThread(...args),
  appendRolloutEmptyCompletionDiagnosticsToThread: (...args) => appendRolloutEmptyCompletionDiagnosticsToThread(...args),
  enrichThreadItemTimestampsFromRollout: (...args) => enrichThreadItemTimestampsFromRollout(...args),
  inferTurnItemDisplayTimestamps: (...args) => inferTurnItemDisplayTimestamps(...args),
  orderTurnItemsByDisplayTimestamp: (...args) => orderTurnItemsByDisplayTimestamp(...args),
  attachTurnUsageSummaries,
});
const {
  compactItem,
  compactThread,
  compactThreadReadResult,
  compactTurn,
  compactTurnsListResult,
  isAssistantReceiptItem,
  isContextCompactionType,
  isEndedTurn,
  isOperationalItem,
  isTurnDiagnosticItem,
  isTurnUsageSummaryItem,
  isUserQuestionItem,
  isVisualReceiptItem,
  isWebSearchLikeItem,
  olderTurnsCursorBeforeTurn,
  userMessageHasVisualAttachment,
} = threadDetailCompactionService;
const rolloutDetailEnrichmentService = createRolloutDetailEnrichmentService({
  fs,
  path,
  crypto,
  rolloutEnrichmentIndexService,
  normalizeFsPath,
  timestampToMs,
  isContextCompactionType,
  isWebSearchLikeItem,
  isOperationalItem,
  collectTurnUsageSummariesFromEntries,
  collectTurnUsageSummariesFromRolloutText,
  attachGeneratedImageContent,
  isPathInside,
  uploadRoot: UPLOAD_ROOT,
  maxRolloutContextBytes: MAX_ROLLOUT_CONTEXT_BYTES,
  maxRuntimeContextScanBytes: MAX_RUNTIME_CONTEXT_SCAN_BYTES,
  maxRolloutEnrichmentContextBytes: MAX_ROLLOUT_ENRICHMENT_CONTEXT_BYTES,
  runtimeContextCacheTtlMs: RUNTIME_CONTEXT_CACHE_TTL_MS,
  runtimeContextCacheMax: RUNTIME_CONTEXT_CACHE_MAX,
});
({
  appendRolloutToolOutputImagesToThread,
  insertProjectedItemByTimestamp,
  itemTimestampCandidateId,
  itemTimestampMatchText,
  readRolloutEnrichmentEntries,
  readRolloutEnrichmentText,
  readRolloutItemTimestampCandidates,
  readRolloutRuntimeScanText,
  readRolloutTail,
  readRolloutToolOutputImageItems,
  readRolloutTurnUsageSummaries,
  rolloutEntryTurnId,
  rolloutTimestampFields,
  timestampTextsMatch,
  visibleItemId,
} = rolloutDetailEnrichmentService);
const threadDetailRolloutBackfillService = createThreadDetailRolloutBackfillService({
  fs,
  runtimeContextCacheTtlMs: RUNTIME_CONTEXT_CACHE_TTL_MS,
  runtimeContextCacheMax: RUNTIME_CONTEXT_CACHE_MAX,
  threadDetailCompletedProgressMessages: THREAD_DETAIL_COMPLETED_PROGRESS_MESSAGES,
  threadDetailProgressiveActiveUserTextChars: THREAD_DETAIL_PROGRESSIVE_ACTIVE_USER_TEXT_CHARS,
  maxThreadTurns: MAX_THREAD_TURNS,
  normalizeFsPath,
  statusText,
  timestampToMs,
  stableTextHash,
  finalReceiptTextFromParams,
  readRolloutEnrichmentEntries,
  rolloutEntryTurnId,
  rolloutTimestampFields,
  rolloutPathForThread,
  readRolloutTurnUsageSummaries,
  readRolloutItemTimestampCandidates,
  rolloutStatsForPath,
  readStateDbThread,
  readStartedThread,
  clonePlainJson,
  cloneThreadForUsageDecoration,
  collectRolloutUserInputAnchors,
  appendLatestCompletedUserInputAnchors,
  compactThread,
  sortTurnsChronologically,
  insertProjectedItemByTimestamp,
  visibleItemId,
  itemTimestampCandidateId,
  itemTimestampMatchText,
  timestampTextsMatch,
  isAssistantReceiptItem,
  isTurnDiagnosticItem,
  isCompletedStatus,
  isLiveTurn,
  isThreadListRestStatus,
  isThreadListLiveStatus,
  turnIdentifier,
  turnSortTimestampMs,
  turnStartedAtMs,
  redactInlineImageDataUrls,
  isContextCompactionType,
  isWebSearchLikeItem,
  isOperationalItem,
  createThreadCompletionDiagnosticService,
});
({
  appendMissingRolloutCompletionTurnsToThread,
  appendRolloutActiveAssistantItemsToDetailResult,
  appendRolloutEmptyCompletionDiagnosticsToThread,
  appendRolloutFinalReceiptsToThread,
  appendRolloutUserInputAnchorsToDetailResult,
  backfillMissingRolloutCompletionTurnsForDetailResult,
  dedupeSyntheticActiveAssistantMessagesInThread,
  enrichThreadItemTimestampsFromRollout,
  finalizeActiveAssistantProjectionDetailResult,
  inferTurnItemDisplayTimestamps,
  itemDisplayTimestampMs,
  orderTurnItemsByDisplayTimestamp,
  turnCompletionUsageSummary,
} = threadDetailRolloutBackfillService);
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
  ensureWorkspaceVisible: ensureWorkspaceVisibleForContinuation,
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
  pruneContinuationJobs,
  publicContinuationJob,
  startThreadFromRequestBody,
} = continuationThreadService;
const appServerRequestPolicyService = createAppServerRequestPolicyService({
  compactStructured,
  truncateMiddle,
});
const {
  ACTIONABLE_APPROVAL_METHODS,
  SERVER_REQUEST_METHODS,
  approvalResponsePayload,
  codeGraphMcpElicitationToolName,
  codeGraphReadOnlyMcpElicitationDecision,
  compactApprovalText,
  publicServerRequest,
  serverRequestResponsePayload,
} = appServerRequestPolicyService;

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

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
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

function incrementBoundedDiagnosticCounter(diagnostics, key, amount = 1) {
  if (!diagnostics || typeof diagnostics !== "object") return;
  if (!/^[a-z][a-zA-Z0-9]{0,80}$/.test(String(key || ""))) return;
  const current = Number(diagnostics[key] || 0);
  const delta = Number(amount || 0);
  if (!Number.isFinite(delta) || delta <= 0) return;
  const next = (Number.isFinite(current) && current > 0 ? current : 0) + delta;
  diagnostics[key] = Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(next));
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

const rateLimitRuntimeService = createRateLimitRuntimeService({
  archivedSessionsDir: ARCHIVED_SESSIONS_DIR,
  codexHome: CODEX_HOME,
  incrementBoundedDiagnosticCounter,
  isRateLimitRolloutSourceAccountScoped,
  modelOptions: MODEL_OPTIONS,
  sessionsDir: SESSIONS_DIR,
});
const {
  compactRateLimitWindow,
  compactRateLimits,
  normalizeModelKey,
  addRateLimitModelKey,
  isSparkModelKey,
  rateLimitModelKeys,
  rateLimitWindows,
  hasCurrentRateLimitWindow,
  isTrustedLiveRateLimitSource,
  storeRateLimits,
  recordRateLimits,
  recordRateLimitReadResult,
  canExposeRateLimitsForActiveHome,
  activeRateLimits,
  activeRateLimitsByModelMap,
  liveQuotaSnapshotForProfiles,
  compareRecentRolloutDirents,
  collectRecentRolloutFiles,
  readRolloutTailForRateLimits,
  loadRecentRateLimitsFromRollouts,
  rateLimitsByModelObject,
  latestLiveRateLimits,
} = rateLimitRuntimeService;
threadEventNotificationService = createThreadEventNotificationService({
  clients,
  clientHeartbeats,
  maxDeltaChars: MAX_DELTA_CHARS,
  compactItem,
  compactTurn,
  compactRateLimits,
  truncateMiddle,
  truncateTail,
  recordRateLimits,
  timestampToMs,
  turnStartResultTurnId,
  rememberLocalActiveThreadStatus,
  clearLocalActiveThreadStatus,
  applyThreadStatusPayloadToThreadListFallbackCache,
  getThreadDetailProjectionService: () => threadDetailProjectionService,
  threadDetailActiveWindowPrewarmService,
  getCodex: () => codex,
  logThreadDetail,
  logger: console,
});

function compactNotification(payload) {
  return threadEventNotificationService.compactNotification(payload);
}

function broadcast(payload) {
  return threadEventNotificationService.broadcast(payload);
}

function notificationThreadId(payload) {
  return threadEventNotificationService.notificationThreadId(payload);
}

function scheduleActiveWindowPrewarm(threadId, summary = null, reason = "", options = {}) {
  return threadEventNotificationService.scheduleActiveWindowPrewarm(threadId, summary, reason, options);
}

function scheduleActiveWindowPrewarmFromNotification(payload) {
  return threadEventNotificationService.scheduleActiveWindowPrewarmFromNotification(payload);
}

function scheduleActiveWindowPrewarmFromThreadListResult(result, reason = "") {
  return threadEventNotificationService.scheduleActiveWindowPrewarmFromThreadListResult(result, reason);
}

function threadStatusChangedPayload(threadId, status, meta = {}) {
  return threadEventNotificationService.threadStatusChangedPayload(threadId, status, meta);
}

function broadcastThreadStatusChanged(threadId, status, meta = {}) {
  return threadEventNotificationService.broadcastThreadStatusChanged(threadId, status, meta);
}

function notifyLocalTurnStarted(threadId, result, meta = {}) {
  return threadEventNotificationService.notifyLocalTurnStarted(threadId, result, meta);
}

function threadStatusChangedPayloadFromTurnNotification(payload) {
  return threadEventNotificationService.threadStatusChangedPayloadFromTurnNotification(payload);
}

function updateLocalActiveThreadStatusFromNotification(payload) {
  return threadEventNotificationService.updateLocalActiveThreadStatusFromNotification(payload);
}

function shouldSendEventToClient(payload, client = {}) {
  return threadEventNotificationService.shouldSendEventToClient(payload, client);
}

function removeEventClient(res) {
  return threadEventNotificationService.removeEventClient(res);
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

const threadTaskCardRouteService = createThreadTaskCardRouteService({
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
const {
  workspaceDelegationTargetHints,
  workspaceDelegationDynamicToolSpec,
  taskCardReturnDynamicToolSpec,
  taskCardRuntimeDynamicTools,
  workspaceDelegationDynamicTools,
  attachTaskCardRuntimeDynamicTools,
  workspaceDelegationScriptFallbackInstruction,
  taskCardReturnScriptFallbackInstruction,
  attachWorkspaceDelegationRuntimeGuidance,
  normalizeThreadTaskCardWorkflowMode,
  normalizeThreadTaskCardReasoningEffort,
  uniqueThreadTaskCardTargetIds,
  threadTaskCardTargetReferenceText,
  threadTaskCardTargetReferenceEntry,
  threadTaskCardTargetReferenceEntries,
  threadTaskCardTargetReferences,
  isThreadIdLike,
  threadTaskCardTargetUpdatedAt,
  publicThreadTaskCardTarget,
  threadTaskCardTargetError,
  threadTaskCardTargetVisibility,
  threadTaskCardVisibleTargetThreads,
  threadTaskCardCanonicalTargetForCwd,
  threadTaskCardCanonicalTargetForThread,
  threadTaskCardCanonicalVisibleTargets,
  readThreadTaskCardTargetSummary,
  readThreadTaskCardVisibleTargetSummary,
  readThreadTaskCardExecutionTargetSummary,
  applyHomeAiDeployLaneRoutingPolicy,
  assertThreadTaskCardTargetDeliverable,
  resolveThreadTaskCardTargetReference,
  resolvedThreadTaskCardTargetIds,
  threadTaskCardThreadCallIdempotencyKey,
  buildThreadTaskCardCreatePayload,
  createThreadTaskCardsFromSourceThread,
  parseDynamicToolArguments,
  dynamicToolTextResponse,
  dynamicToolJsonResponse,
  dynamicToolErrorPayload,
  dynamicToolServerRequestResponsePayload,
  parseThreadTaskCardDraftText,
  threadTaskCardDraftIdempotencyKey,
  threadTaskCardItemText,
  summarizeTaskCardText,
  truncateThreadTaskCardBody,
  taskCardSourceThreadTitle,
  materializeThreadTaskCardDraftsForThread,
  prepareThreadTaskCardsToResult,
} = threadTaskCardRouteService;
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

function statusTurnId(status) {
  return threadSummaryStateService.statusTurnId(status);
}

function rowToFallbackThread(row) {
  return threadSummaryStateService.rowToFallbackThread(row);
}

function sqlString(value) {
  return threadSummaryStateService.sqlString(value);
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

function detailReadThreadSummaryForFallbackCache(body = {}) {
  return threadSummaryStateService.detailReadThreadSummaryForFallbackCache(body);
}

function syncThreadDetailReadResultToThreadListFallbackCache(payload = {}) {
  return threadSummaryStateService.syncThreadDetailReadResultToThreadListFallbackCache(payload);
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

const apiDispatchRouteService = createApiDispatchRouteService({
  READ_RPC_TIMEOUT_MS,
  MAX_THREAD_TURNS,
  CODEX_HOME,
  archiveThreadId,
  archivedSessionThreadIds,
  attachThreadListStateToResult,
  chatGptProBridgeService,
  chatGptProMcpService,
  chatGptProPlannerService,
  chatGptProSourceSummary,
  clients,
  clientHeartbeats,
  codex,
  compactTurnsListResult,
  coreApiRouteService,
  createContinuationJob,
  filterThreadListByCwd,
  filterVisibleThreads,
  getContinuationJob,
  getUrl,
  handleThreadDetailReadRoute,
  handleThreadListRoute,
  handleThreadSideChatRoute,
  hydrateThreadListResultTitlesFromSessionIndex,
  isAuthorized,
  isRecoverableThreadTitleUpdateError,
  listWorkspaces,
  logThreadDetail,
  logThreadList,
  mediaFileService,
  mergeThreadDisplaySummary,
  mergeThreadSummaryListWithDiagnostics,
  normalizeFsPath,
  normalizeStaleContextOnlyActiveThread,
  normalizeThreadListResultStatuses,
  normalizeThreadSummaryLiveStatus,
  parseThreadTurnsCursor,
  persistThreadTitleToSessionIndex,
  pruneContinuationJobs,
  publicContinuationJob,
  readBody,
  readGlobalState,
  readMessageBody,
  readRolloutSessionFallbackThread,
  readSessionIndexEntries,
  readStartedThread,
  readStateDbThread,
  readThreadListCachedFallback,
  readThreadListFallback,
  rememberStartedThread,
  removeEventClient,
  rolloutStatsForPath,
  runThreadGoalAction,
  scheduleActiveWindowPrewarmFromThreadListResult,
  sendJson,
  setThreadGoal,
  shouldDeferThreadListFallbackForActiveDetail,
  syncKnownCodexMobileMcpToolsets,
  syncRegisteredWorkspaceTrust,
  syncThreadDetailReadResultToThreadListFallbackCache,
  threadDetailReadOrchestrationService,
  threadDisplaySummaryCache,
  threadListDefaultWarmFallbackEnabled: THREAD_LIST_DEFAULT_WARM_FALLBACK_ENABLED,
  threadListFallbackBaselineWorkTimingFields,
  threadListFallbackSourceDiagnosticTimingFields,
  threadListResponseCoalescer,
  threadListTokenUsageTimingFields,
  threadMessageRouteService,
  threadSideChatOrchestrationService,
  threadSideChatService,
  threadTaskCardRouteService,
  tokenUsageStatsService,
  tokenUsageWorkspaceCwds,
  trackThreadDetailRequestLifecycle,
  tryUpdateThreadTitle,
  upsertThreadListFallbackCacheThreads,
  visibilityFromGlobalState,
  webPushRuntimeService,
  workspaceRegistryService,
});
const {
  handleApi,
  handleEvents,
} = apiDispatchRouteService;

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
