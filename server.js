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
const { createHomeAiAutonomousDeliveryReturnService } = require("./services/task-cards/home-ai-autonomous-delivery-return-service");
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
const { createThreadTaskCardService } = require("./services/task-cards/thread-task-card-service");
const { createThreadTaskCardRouteService } = require("./server-routes/thread-task-card-route-service");
const { createTaskCardRuntimePolicyService } = require("./services/task-cards/task-card-runtime-policy-service");
const {
  isHomeAiDeployLaneThread,
  normalizeHomeAiDeployLaneSummary,
} = require("./services/task-cards/thread-task-card-deploy-lane-policy-service");
const { createThreadSideChatService } = require("./adapters/thread-side-chat-service");
const {
  continuationGoalMigrationPlan,
  createThreadGoalService,
  normalizeThreadGoalStatus,
} = require("./adapters/thread-goal-service");
const { createThreadGoalActionService } = require("./adapters/thread-goal-action-service");
const { createRuntimePermissionPolicyService } = require("./services/runtime/runtime-permission-policy-service");
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
const { createRuntimeWorkspaceBootstrapService } = require("./services/runtime/runtime-workspace-bootstrap-service");
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
const { createThreadDetailActiveTurnEvidenceService } = require("./services/thread-detail/thread-detail-active-turn-evidence-service");
const { createThreadListFallbackSourceService } = require("./services/thread-list/thread-list-fallback-source-service");
const { createThreadSummaryStateService } = require("./services/thread-list/thread-summary-state-service");
const { createThreadSummaryReadModelService } = require("./services/thread-list/thread-summary-read-model-service");
const { createThreadListStateService } = require("./services/thread-list/thread-list-state-service");
const { createThreadListRuntimeService } = require("./services/thread-list/thread-list-runtime-service");
const {
  stripThreadListDetailFields,
  stripThreadListResultDetailFields,
} = require("./services/thread-list/thread-list-summary-service");
const { createThreadDetailCompactionService } = require("./adapters/thread-detail-compaction-service");
const { createThreadEventNotificationService } = require("./services/runtime/thread-event-notification-service");
const { createRuntimeTurnEventPipelineService } = require("./services/runtime/runtime-turn-event-pipeline-service");
const { createServerEventRuntimeBoundaryService } = require("./services/runtime/server-event-runtime-boundary-service");
const { createRateLimitRuntimeService } = require("./services/runtime/rate-limit-runtime-service");
const { createThreadVisibilityService } = require("./adapters/thread-visibility-service");
const { createThreadCompletionDiagnosticService } = require("./adapters/thread-completion-diagnostic-service");
const { createChatGptProBridgeService } = require("./adapters/chatgpt-pro-bridge-service");
const { createChatGptProPlannerService } = require("./adapters/chatgpt-pro-planner-service");
const { createChatGptProMcpService } = require("./adapters/chatgpt-pro-mcp-service");
const { createThreadSideChatOrchestrationService } = require("./adapters/thread-side-chat-orchestration-service");
const { handleThreadSideChatRoute } = require("./server-routes/thread-side-chat-route-service");
const { createThreadMessageRouteService } = require("./server-routes/thread-message-route-service");
const { handleThreadListRoute } = require("./server-routes/thread-list-route-service");
const { createCodexAppServerClient } = require("./services/runtime/codex-app-server-client-service");
const { createStaticFileService } = require("./adapters/static-file-service");
const { createServerRuntimeUtils } = require("./services/runtime/server-runtime-utils");
const { createServerRuntimeConfigService } = require("./services/runtime/server-runtime-config-service");
const { createServerHttpRuntimeService } = require("./services/runtime/server-http-runtime-service");
const { createRuntimeSettingsService } = require("./services/runtime/runtime-settings-service");
const { createThreadRuntimeSettingsService } = require("./services/runtime/thread-runtime-settings-service");
const { createThreadRolloutRuntimeService } = require("./services/runtime/thread-rollout-runtime-service");
const { createCoreApiRouteService } = require("./server-routes/core-api-route-service");
const { createAppMaintenanceService } = require("./adapters/app-maintenance-service");
const { createAppServerRequestPolicyService } = require("./services/runtime/app-server-request-policy-service");
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
  assertCommandAvailable,
  codexAppServerChildEnv,
  currentPublicBuildConfig,
} = serverRuntimeUtils;

const serverRuntimeConfigService = createServerRuntimeConfigService({
  path,
  crypto,
  env: process.env,
  appRoot: APP_ROOT,
  publicRoot: PUBLIC_ROOT,
  userHome: USER_HOME,
  serverRuntimeUtils,
  resolveActiveCodexHomeFromStore,
  resolveEffectiveCodexHome,
  normalizeRepositorySlug,
});
const {
  RUNTIME_ROOT,
  DEFAULT_CODEX_HOME,
  CODEX_HOME_RESOLUTION,
  CODEX_HOME,
  STATE_DB,
  GOALS_DB,
  SESSIONS_DIR,
  ARCHIVED_SESSIONS_DIR,
  MOBILE_ARCHIVED_THREAD_IDS_FILE,
  CODEX_EXE,
  MUX_ENDPOINT_FILE,
  EXTERNAL_APP_SERVER_WS,
  EXTERNAL_APP_SERVER_TCP,
  REQUIRE_SHARED_APP_SERVER,
  DISABLE_MOBILE_OWNED_MUX,
  PERSIST_MOBILE_OWNED_MUX,
  HOST,
  PORT,
  APP_VERSION,
  APP_UPDATE_REMOTE,
  APP_UPDATE_BRANCH,
  APP_UPDATE_DISABLED,
  APP_UPDATE_CHECK_TIMEOUT_MS,
  APP_UPDATE_APPLY_TIMEOUT_MS,
  APP_UPDATE_RESTART_DELAY_MS,
  APP_UPDATE_CACHE_MS,
  PUBLIC_PR_CHECK_DISABLED,
  PUBLIC_PR_REPOSITORY,
  PUBLIC_PR_CHECK_TIMEOUT_MS,
  PUBLIC_PR_CHECK_CACHE_MS,
  GITHUB_LINK_PREVIEW_TIMEOUT_MS,
  GITHUB_LINK_PREVIEW_CACHE_MS,
  AUTO_TURN_RECOVERY_COOLDOWN_MS,
  AUTO_TURN_RECOVERY_PROMPT,
  PUBLIC_RELEASE_CHECK_DISABLED,
  PUBLIC_RELEASE_REPOSITORY,
  PUBLIC_RELEASE_BRANCH,
  PUBLIC_RELEASE_CHECK_CACHE_MS,
  SHARED_CHAIN_RESTART_TASK_NAME,
  SHARED_CHAIN_RESTART_DELAY_MS,
  DISABLE_AUTH,
  AUTH_KEY_FILE,
  HERMES_PLUGIN_REGISTRATION_FILE,
  HERMES_PLUGIN_BASE_URL,
  HERMES_PLUGIN_LAUNCH_TOKEN_TTL_MS,
  HERMES_PLUGIN_SESSION_TTL_MS,
  HERMES_PLUGIN_FRAME_ORIGINS,
  HERMES_PLUGIN_NOTIFICATION_BASE_URL,
  HERMES_PLUGIN_NOTIFICATION_KEY,
  HERMES_PLUGIN_NOTIFICATION_KEY_FILE,
  THREAD_TASK_CARD_FILE,
  RUNTIME_SETTINGS_FILE,
  THREAD_SIDE_CHAT_FILE,
  CHATGPT_PRO_BRIDGE_FILE,
  CHATGPT_PRO_OUTPUT_DIR,
  CHATGPT_PRO_BRIDGE_ENABLED,
  CHATGPT_PRO_PLANNER_DIR,
  CHATGPT_PRO_MCP_TOKEN,
  CHATGPT_PRO_MCP_TOKEN_FILE,
  CHATGPT_PRO_MCP_ALLOW_DIRECT_TASK_CARDS,
  WORKSPACE_DELEGATION_ENV_DEFAULT,
  WORKSPACE_DELEGATION_WRITE_GUARD_DISABLED,
  WORKSPACE_DELEGATION_ENFORCE_SANDBOX_GUARD,
  WORKSPACE_DELEGATION_APPROVAL_PROXY_ONLY,
  WORKSPACE_DELEGATION_GUARD_EXEMPT_CWDS,
  WORKSPACE_DELEGATION_GUARD_SELF_EXEMPTION_DISABLED,
  WORKSPACE_DELEGATION_GUARD_PLATFORM_EXEMPTION_DISABLED,
  WORKSPACE_DELEGATION_TOOL_NAMESPACE,
  WORKSPACE_DELEGATION_TOOL_NAME,
  WORKSPACE_DELEGATION_TOOL_FULL_NAME,
  TASK_CARD_RETURN_TOOL_NAME,
  TASK_CARD_RETURN_TOOL_FULL_NAME,
  THREAD_SIDE_CHAT_SCOPE_ID,
  THREAD_SIDE_CHAT_REPLY_TIMEOUT_MS,
  THREAD_TASK_CARD_DRAFT_TAG,
  THREAD_TASK_CARD_BODY_MAX_CHARS,
  THREAD_TASK_CARD_DRAFT_TURN_LOOKBACK,
  WORKSPACE_REGISTRY_FILE,
  TOKEN_USAGE_STATS_DB,
  TOKEN_USAGE_QUERY_CACHE_TTL_MS,
  THREAD_DETAIL_PROJECTION_CACHE_DIR,
  THREAD_DETAIL_PROJECTION_POLICY_VERSION,
  THREAD_DETAIL_PROJECTION_V4_ENABLED,
  THREAD_DETAIL_RAW_ALL_ENABLED,
  WORKSPACE_CREATE_ROOTS,
  WORKSPACE_DEFAULT_CREATE_ROOT,
  DESKTOP_GLOBAL_STATE_FILES,
  MOBILE_WEB_LOG_FILE,
  MOBILE_WEB_LOG_MAX_BYTES,
  MOBILE_WEB_LOG_KEEP_BYTES,
  MAX_TEXT_CHARS,
  MAX_JSON_BODY_BYTES,
  MAX_START_THREAD_DEVELOPER_INSTRUCTIONS_CHARS,
  MAX_COMMAND_OUTPUT_CHARS,
  MAX_COMMAND_OUTPUT_CHARS_PER_TURN,
  MAX_STRUCTURED_CHARS,
  MAX_DELTA_CHARS,
  MAX_THREAD_TURNS,
  MAX_FULL_THREAD_TURNS,
  THREAD_DETAIL_TURNS_LIST_FIRST_BYTES,
  MAX_LIVE_OPERATION_ITEMS,
  THREAD_DETAIL_COMPLETED_OPERATION_ITEMS,
  THREAD_DETAIL_ACTIVE_REASONING_ITEMS,
  THREAD_DETAIL_COMPLETED_REASONING_ITEMS,
  THREAD_DETAIL_ACTIVE_ASSISTANT_ITEMS,
  THREAD_DETAIL_COMPLETED_ASSISTANT_ITEMS,
  THREAD_DETAIL_COMPLETED_PROGRESS_MESSAGES,
  THREAD_DETAIL_ACTIVE_PROGRESSIVE_ITEM_THRESHOLD,
  THREAD_DETAIL_ACTIVE_PROGRESSIVE_BYTES,
  THREAD_DETAIL_ACTIVE_PROGRESSIVE_THREAD_BYTES,
  THREAD_DETAIL_PROGRESSIVE_ACTIVE_OPERATION_ITEMS,
  THREAD_DETAIL_PROGRESSIVE_ACTIVE_REASONING_ITEMS,
  THREAD_DETAIL_PROGRESSIVE_ACTIVE_ASSISTANT_ITEMS,
  THREAD_DETAIL_PROGRESSIVE_REPLAY_ASSISTANT_ITEMS,
  THREAD_DETAIL_PROGRESSIVE_COMPLETED_REPLAY_ASSISTANT_ITEMS,
  THREAD_DETAIL_PROGRESSIVE_ACTIVE_TEXT_CHARS,
  THREAD_DETAIL_PROGRESSIVE_ACTIVE_OPERATION_PAYLOAD_CHARS,
  THREAD_DETAIL_PROGRESSIVE_ACTIVE_USER_TEXT_CHARS,
  THREAD_DETAIL_PROGRESSIVE_VISIBLE_ITEM_CEILING,
  THREAD_DETAIL_PROGRESSIVE_FIRST_PAINT_THREAD_BYTES,
  THREAD_DETAIL_PROGRESSIVE_COMPLETED_TEXT_CHARS,
  THREAD_DETAIL_PROGRESSIVE_COMPLETED_USER_TEXT_CHARS,
  THREAD_DETAIL_SUMMARY_APP_SERVER_REFRESH_TTL_MS,
  OPERATIONAL_ITEM_TYPES,
  THREAD_LIST_FALLBACK_CACHE_TTL_MS,
  THREAD_LIST_FALLBACK_CACHE_FILE,
  THREAD_LIST_FALLBACK_CACHE_PERSIST_MAX_AGE_MS,
  THREAD_LIST_DEFAULT_WARM_FALLBACK_ENABLED,
  THREAD_LIST_FALLBACK_PREWARM_ENABLED,
  THREAD_LIST_FALLBACK_PREWARM_DELAY_MS,
  THREAD_LIST_FALLBACK_PREWARM_RETRY_MS,
  THREAD_LIST_FALLBACK_PREWARM_MAX_DEFERRALS,
  THREAD_LIST_FALLBACK_PREWARM_LIMIT,
  THREAD_LIST_FALLBACK_PREWARM_SOURCE_SNAPSHOT_LIMIT,
  MODEL_OPTIONS,
  DEFAULT_MODEL,
  REASONING_EFFORT_OPTIONS,
  PERMISSION_MODE_OPTIONS,
  DEFAULT_RPC_TIMEOUT_MS,
  READ_RPC_TIMEOUT_MS,
  THREAD_DETAIL_RPC_TIMEOUT_MS,
  PROFILE_SWITCH_PREFLIGHT_TIMEOUT_MS,
  PROFILE_SWITCH_PROGRESS_TTL_MS,
  MUTATION_RPC_TIMEOUT_MS,
  STALE_ACTIVE_TURN_MS,
  TERMINAL_IDLE_ACTIVE_TURN_MS,
  STARTED_THREAD_CACHE_TTL_MS,
  STARTED_THREAD_CACHE_MAX,
  THREAD_DISPLAY_SUMMARY_CACHE_TTL_MS,
  THREAD_DISPLAY_SUMMARY_CACHE_MAX,
  MAX_ROLLOUT_CONTEXT_BYTES,
  MAX_RUNTIME_CONTEXT_SCAN_BYTES,
  MAX_ROLLOUT_ENRICHMENT_CONTEXT_BYTES,
  ROLLOUT_WARNING_BYTES,
  ROLLOUT_ACTIVE_STATUS_WINDOW_MS,
  LOCAL_ACTIVE_THREAD_STATUS_TTL_MS,
  STALE_CONTEXT_ONLY_ACTIVE_TURN_MS,
  CONTINUATION_CONTEXT_HANDOFF_COMPACT_BYTES,
  CONTINUATION_CONTEXT_HANDOFF_PRESERVE_CHARS,
  CONTINUATION_CONTEXT_FILE_COMPACT_BYTES,
  CONTINUATION_CONTEXT_PAIR_COMPACT_BYTES,
  CONTINUATION_CONTEXT_HANDOFF_PROMPT_BYTES,
  CONTINUATION_CONTEXT_COMPACT_PRESERVE_CHARS,
  RUNTIME_CONTEXT_CACHE_TTL_MS,
  RUNTIME_CONTEXT_CACHE_MAX,
  MUX_REPLAY_NOTIFICATION_LIMIT,
  SAFE_RETRY_METHODS,
} = serverRuntimeConfigService.resolve();
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
  getMaxJsonBodyBytes: () => MAX_JSON_BODY_BYTES,
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
  readRawBody,
  readBody,
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
const runtimeWorkspaceBootstrapService = createRuntimeWorkspaceBootstrapService({
  appRoot: APP_ROOT,
  activeCodexHome: CODEX_HOME,
  authKeyFile: AUTH_KEY_FILE,
  port: PORT,
  env: process.env,
  processExecPath: process.execPath,
  workspaceRegistryService,
  codexProfileService,
  ensureCodexProjectsTrusted,
  ensureCodexMobileMcpServer,
  logger: console,
});
const {
  activeProfileRestartOptions,
  ensureWorkspaceVisibleForContinuation,
  syncCodexMobileMcpToolset,
  syncKnownCodexMobileMcpToolsets,
  syncRegisteredWorkspaceTrust,
} = runtimeWorkspaceBootstrapService;

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
let runtimeTurnEventPipelineService;
const serverEventRuntimeBoundaryService = createServerEventRuntimeBoundaryService({
  getThreadEventNotificationService: () => threadEventNotificationService,
  getRuntimeTurnEventPipelineService: () => runtimeTurnEventPipelineService,
});
const {
  broadcast,
  broadcastThreadStatusChanged,
  compactNotification,
  isOldPushTurnEvent,
  maybeApplyQueuedThreadSideChat,
  maybeAutoReplyThreadTaskCard,
  maybeMaterializeThreadTaskCardDrafts,
  maybeRecordTurnTokenUsage,
  maybeSendTurnCompletedPush,
  notificationThreadId,
  notifyLocalTurnStarted,
  pushThreadId,
  pushThreadSummary,
  pushTurnId,
  rememberThreadIdForTurnId,
  rememberThreadIdForTurnParams,
  removeEventClient,
  scheduleActiveWindowPrewarm,
  scheduleActiveWindowPrewarmFromNotification,
  scheduleActiveWindowPrewarmFromThreadListResult,
  shouldSendEventToClient,
  threadIdFromRolloutPath,
  threadStatusChangedPayload,
  threadStatusChangedPayloadFromTurnNotification,
  turnTimestampMs,
  updateLocalActiveThreadStatusFromNotification,
} = serverEventRuntimeBoundaryService;
let agentInstructionFilesForCwd;
let isRecoverableThreadTitleUpdateError;
let pruneStartedThreadCache;
let readGlobalState;
let readStartedThread;
let readStartThreadDeveloperInstructions;
let readThreadSummaryFromAppServer;
let rememberProjectlessThreadId;
let rememberStartedThread;
let threadDisplayTitle;
let threadIdFromStartResult;
let truncateSingleLine;
let tryUpdateThreadTitle;
const threadRolloutRuntimeService = createThreadRolloutRuntimeService({
  fs,
  path,
  rolloutWarningBytes: ROLLOUT_WARNING_BYTES,
  continuationContextFileCompactBytes: CONTINUATION_CONTEXT_FILE_COMPACT_BYTES,
  continuationContextHandoffPromptBytes: CONTINUATION_CONTEXT_HANDOFF_PROMPT_BYTES,
  continuationContextPairCompactBytes: CONTINUATION_CONTEXT_PAIR_COMPACT_BYTES,
  terminalIdleActiveTurnMs: TERMINAL_IDLE_ACTIVE_TURN_MS,
  staleActiveTurnMs: STALE_ACTIVE_TURN_MS,
  threadDetailRpcTimeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS,
  readStateDbThread: (...args) => readStateDbThread(...args),
  readStartedThread: (...args) => readStartedThread(...args),
  detectStaleActiveTurnForSubmission,
});
const {
  rolloutPathForThread,
  rolloutStatsForPath,
  workspaceContextStatsForCwd,
  annotateThreadRolloutStats,
  staleActiveTurnPreflight,
} = threadRolloutRuntimeService;
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
  readGlobalState: (...args) => readGlobalState(...args),
  readSessionIndexEntries,
  readStartedThread: (...args) => readStartedThread(...args),
  readStateDbThread,
  readThreadSummaryFromAppServer: (...args) => readThreadSummaryFromAppServer(...args),
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
  readGlobalState: (...args) => readGlobalState(...args),
  visibleWorkspaceRoots,
  normalizeFsPath,
  readStateDbThread,
  readStartedThread: (...args) => readStartedThread(...args),
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
let threadListRuntimeService;

function requireThreadListRuntimeService() {
  if (!threadListRuntimeService) throw new Error("thread_list_runtime_service_uninitialized");
  return threadListRuntimeService;
}

const threadTaskCardService = createThreadTaskCardService({
  storageFile: THREAD_TASK_CARD_FILE,
  returnThreadTaskCardScriptPath: path.join(APP_ROOT, "scripts", "return-thread-task-card.js"),
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
function clonePlainJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

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
const threadRuntimeSettingsService = createThreadRuntimeSettingsService({
  fs,
  maxRuntimeContextScanBytes: MAX_RUNTIME_CONTEXT_SCAN_BYTES,
  runtimeContextCacheTtlMs: RUNTIME_CONTEXT_CACHE_TTL_MS,
  runtimeContextCacheMax: RUNTIME_CONTEXT_CACHE_MAX,
  modelOptions: MODEL_OPTIONS,
  reasoningEffortOptions: REASONING_EFFORT_OPTIONS,
  codexConfigDefaults: CODEX_CONFIG_DEFAULTS,
  normalizeFsPath,
  parseJsonLine,
  lastString,
  readStateDbThread,
  readThreadSummaryFromAppServer: (threadId) => readThreadSummaryFromAppServer(codex, threadId),
  normalizeEnumValue,
  normalizeSandboxPolicy,
  normalizePermissionProfile,
  isFullAccessRuntime,
  sandboxModeFromPolicy,
});
const {
  readLatestTurnContext,
  resolveThreadRuntimeSettings,
  runtimeContextCacheKey,
  threadRuntimeSettings,
} = threadRuntimeSettingsService;
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
const threadListStateService = createThreadListStateService({
  stripThreadListDetailFields,
  threadTaskCardService,
  threadGoalService,
  upsertThreadListFallbackCacheThread,
  readGlobalState,
  visibleWorkspaceRoots,
  visibilityFromGlobalState,
  workspaceRegistryService,
  normalizeFsPath,
  isHiddenThread,
  readRpcTimeoutMs: READ_RPC_TIMEOUT_MS,
  requestThreadList: (params, options) => codex.request("thread/list", params, options),
});
const {
  attachThreadListStateToResult,
  attachThreadTaskCardCountsToSummary,
  listWorkspaces,
  tokenUsageWorkspaceCwds,
  upsertThreadListFallbackCacheThreads,
} = threadListStateService;
const PROCESS_STARTED_AT_MS = Date.now();

let clients = new Map();
let clientHeartbeats = new WeakMap();
const LIVE_RATE_LIMIT_REFRESH_MIN_INTERVAL_MS = 10000;
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
const threadDetailActiveTurnEvidenceService = createThreadDetailActiveTurnEvidenceService({
  fs,
  statusText,
  timestampToMs,
  rolloutActiveStatusWindowMs: ROLLOUT_ACTIVE_STATUS_WINDOW_MS,
  rolloutPathForThread,
  readStateDbThread,
  rolloutLatestTurnEvidence,
  isThreadListLiveStatus,
  isThreadListRestStatus,
  isEndedTurn: (...args) => isEndedTurn(...args),
  isUserQuestionItem: (...args) => isUserQuestionItem(...args),
  userMessageHasVisualAttachment: (...args) => userMessageHasVisualAttachment(...args),
  isTurnUsageSummaryItem: (...args) => isTurnUsageSummaryItem(...args),
  isOperationalItem: (...args) => isOperationalItem(...args),
  isAssistantReceiptItem: (...args) => isAssistantReceiptItem(...args),
  isVisualReceiptItem: (...args) => isVisualReceiptItem(...args),
  isTurnDiagnosticItem: (...args) => isTurnDiagnosticItem(...args),
  isContextCompactionType: (...args) => isContextCompactionType(...args),
});
const {
  isCompletedStatus,
  isLiveTurn,
  normalizeSupersededLiveTurns,
  pruneSupersededLiveShellTurns,
  reconcileThreadActiveTurnWithRolloutEvidence,
  rolloutEvidenceHasRuntimeActivity,
  rolloutEvidenceIsRecent,
  turnIdentifier,
  turnStartedAtMs,
} = threadDetailActiveTurnEvidenceService;
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
const threadSummaryReadModelService = createThreadSummaryReadModelService({
  fs,
  path,
  codexHome: CODEX_HOME,
  maxStartThreadDeveloperInstructionsChars: MAX_START_THREAD_DEVELOPER_INSTRUCTIONS_CHARS,
  startedThreadCacheTtlMs: STARTED_THREAD_CACHE_TTL_MS,
  startedThreadCacheMax: STARTED_THREAD_CACHE_MAX,
  readRpcTimeoutMs: READ_RPC_TIMEOUT_MS,
  recentStartedThreads,
  readJsonFile: (...args) => readJsonFile(...args),
  writeRuntimeJson: (...args) => writeRuntimeJson(...args),
  annotateThreadRolloutStats,
  upsertThreadListFallbackCacheThread,
  normalizeStaleContextOnlyActiveThread,
  threadDisplaySummaryCache,
  isRecoverableThreadListTitle,
  requestThreadTitleUpdate: (...args) => codex.request(...args),
  logger: console,
});
({
  agentInstructionFilesForCwd,
  isRecoverableThreadTitleUpdateError,
  pruneStartedThreadCache,
  readGlobalState,
  readStartedThread,
  readStartThreadDeveloperInstructions,
  readThreadSummaryFromAppServer,
  rememberProjectlessThreadId,
  rememberStartedThread,
  threadDisplayTitle,
  threadIdFromStartResult,
  truncateSingleLine,
  tryUpdateThreadTitle,
} = threadSummaryReadModelService);
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
  readStartedThread: (...args) => readStartedThread(...args),
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
const taskCardRuntimePolicyService = createTaskCardRuntimePolicyService({
  fs,
  path,
  platform: process.platform,
  actionableApprovalMethods: ACTIONABLE_APPROVAL_METHODS,
  latestThreadIdByTurnId,
  recentStartedThreads,
  normalizeFsPath,
  workspaceDelegationPublicSettings: () => workspaceDelegationPublicSettings(),
  workspaceWriteSandboxPolicy,
  normalizeSandboxPolicyType,
  workspaceDelegationWriteGuardPermissionProfile,
  attachWorkspaceDelegationRuntimeGuidance: (...args) => attachWorkspaceDelegationRuntimeGuidance(...args),
  readStateDbThread,
  readStartedThread: (...args) => readStartedThread(...args),
  readRolloutSessionFallbackThread,
  visibleWorkspaceRoots,
  readGlobalState: (...args) => readGlobalState(...args),
  readThreadListFallback,
  pushThreadId,
  shortIdentifier,
  compactOneLine,
  workspaceDelegationGuardExemptCwds: WORKSPACE_DELEGATION_GUARD_EXEMPT_CWDS,
  workspaceDelegationGuardSelfExemptionDisabled: WORKSPACE_DELEGATION_GUARD_SELF_EXEMPTION_DISABLED,
  workspaceDelegationGuardPlatformExemptionDisabled: WORKSPACE_DELEGATION_GUARD_PLATFORM_EXEMPTION_DISABLED,
  workspaceDelegationWriteGuardDisabled: WORKSPACE_DELEGATION_WRITE_GUARD_DISABLED,
  workspaceDelegationApprovalProxyOnly: WORKSPACE_DELEGATION_APPROVAL_PROXY_ONLY,
  workspaceDelegationEnforceSandboxGuard: WORKSPACE_DELEGATION_ENFORCE_SANDBOX_GUARD,
});
const {
  applyCodexFastServiceTier,
  applyResumeRuntimeSettings,
  applyStartThreadRuntimeSettings,
  applyTurnRuntimeSettings,
  requestedCodexFastMode,
  workspaceSourceWriteGuardDecisionForRequest,
  workspaceSourceWriteGuardLogPayload,
} = taskCardRuntimePolicyService;
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
function mergeThreadSummaryListWithDiagnostics(threads) {
  return requireThreadListRuntimeService().mergeThreadSummaryListWithDiagnostics(threads);
}

function mergeThreadSummaryList(threads) {
  return requireThreadListRuntimeService().mergeThreadSummaryList(threads);
}

function mergeThreadListFallback(result, fallbackThreads = [], limit = 80) {
  return requireThreadListRuntimeService().mergeThreadListFallback(result, fallbackThreads, limit);
}

function normalizeThreadListResultStatuses(result) {
  return requireThreadListRuntimeService().normalizeThreadListResultStatuses(result);
}

function threadListSummaryTimestampMs(thread) {
  return requireThreadListRuntimeService().threadListSummaryTimestampMs(thread);
}

function sortThreadListSummaries(threads) {
  return requireThreadListRuntimeService().sortThreadListSummaries(threads);
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
runtimeTurnEventPipelineService = createRuntimeTurnEventPipelineService({
  latestThreadIdByTurnId,
  runtimeContextCacheMax: RUNTIME_CONTEXT_CACHE_MAX,
  processStartedAtMs: PROCESS_STARTED_AT_MS,
  timestampToMs,
  getCodex: () => codex,
  threadDisplaySummaryCache,
  readStateDbThread,
  readStartedThread,
  turnCompletionUsageSummary,
  tokenUsageStatsService,
  tokenUsageWorkspaceCwds,
  threadTaskCardService,
  finalReceiptTextFromParams,
  threadSideChatOrchestrationService: {
    maybeApplyQueuedThreadSideChat: (...args) => threadSideChatOrchestrationService.maybeApplyQueuedThreadSideChat(...args),
  },
  webPushRuntimeService,
  threadFromTurnsList,
  materializeThreadTaskCardDraftsForThread,
  threadTaskCardDraftTurnLookback: THREAD_TASK_CARD_DRAFT_TURN_LOOKBACK,
  threadDetailRpcTimeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS,
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

threadListRuntimeService = createThreadListRuntimeService({
  fallbackCache: {
    ttlMs: THREAD_LIST_FALLBACK_CACHE_TTL_MS,
    maxEntries: 12,
    filePath: THREAD_LIST_FALLBACK_CACHE_FILE,
    maxThreadsPerEntry: 200,
    persistMaxAgeMs: THREAD_LIST_FALLBACK_CACHE_PERSIST_MAX_AGE_MS,
  },
  prewarm: {
    enabled: THREAD_LIST_FALLBACK_PREWARM_ENABLED,
    delayMs: THREAD_LIST_FALLBACK_PREWARM_DELAY_MS,
    retryDelayMs: THREAD_LIST_FALLBACK_PREWARM_RETRY_MS,
    maxDeferrals: THREAD_LIST_FALLBACK_PREWARM_MAX_DEFERRALS,
    limit: THREAD_LIST_FALLBACK_PREWARM_LIMIT,
    sourceSnapshotLimit: THREAD_LIST_FALLBACK_PREWARM_SOURCE_SNAPSHOT_LIMIT,
  },
  archivedSessionThreadIds,
  filterFallbackThreads,
  hydrateThreadListTitlesFromSessionIndex,
  isSubagentThreadSummary,
  mergeThreadDisplaySummary,
  mergeThreadWithCachedDisplaySummary,
  normalizeFsPath,
  normalizeThreadId,
  normalizeThreadSummaryLiveStatus,
  readGlobalState,
  readRolloutSessionFallback,
  readSessionIndexFallback,
  readStateDbFallback,
  scheduleActiveWindowPrewarmFromThreadListResult,
  shouldHideThreadListSummary,
  stripThreadListDetailFields,
  stripThreadListResultDetailFields,
  threadHasArchiveSignal,
  timestampToMs,
  visibleProjectlessThreadIds,
  visibleWorkspaceRoots,
  logger: console,
});
const { threadListResponseCoalescer } = threadListRuntimeService;

function clearThreadListFallbackCache() {
  return requireThreadListRuntimeService().clearThreadListFallbackCache();
}

function removeThreadFromThreadListFallbackCache(threadId) {
  return requireThreadListRuntimeService().removeThreadFromThreadListFallbackCache(threadId);
}

function upsertThreadListFallbackCacheThread(thread, options = {}) {
  return requireThreadListRuntimeService().upsertThreadListFallbackCacheThread(thread, options);
}

function updateThreadListFallbackCacheStatus(threadId, status, meta = {}) {
  return requireThreadListRuntimeService().updateThreadListFallbackCacheStatus(threadId, status, meta);
}

function applyThreadStatusPayloadToThreadListFallbackCache(payload) {
  return requireThreadListRuntimeService().applyThreadStatusPayloadToThreadListFallbackCache(payload);
}

function trackThreadDetailRequestLifecycle(res) {
  return requireThreadListRuntimeService().trackThreadDetailRequestLifecycle(res);
}

function shouldDeferThreadListFallbackForActiveDetail({ deferFallback, cursor, archived, searchTerm, cwd } = {}) {
  return requireThreadListRuntimeService().shouldDeferThreadListFallbackForActiveDetail({ deferFallback, cursor, archived, searchTerm, cwd });
}

function threadListFallbackCacheKey(limit, filters = {}) {
  return requireThreadListRuntimeService().threadListFallbackCacheKey(limit, filters);
}

function rememberThreadListFallbackCache(key, threads, timings = {}, options = {}) {
  return requireThreadListRuntimeService().rememberThreadListFallbackCache(key, threads, timings, options);
}

function readThreadListFallbackCache(key) {
  return requireThreadListRuntimeService().readThreadListFallbackCache(key);
}

function readThreadListCachedFallback(limit = 80, filters = {}) {
  return requireThreadListRuntimeService().readThreadListCachedFallback(limit, filters);
}

function readThreadListFallback(limit = 80, filters = {}) {
  return requireThreadListRuntimeService().readThreadListFallback(limit, filters);
}

function threadListFallbackPrewarmConfig() {
  return requireThreadListRuntimeService().threadListFallbackPrewarmConfig();
}

function threadListFallbackPrewarmPublicStatus() {
  return requireThreadListRuntimeService().threadListFallbackPrewarmPublicStatus();
}

function scheduleThreadListFallbackPrewarm() {
  return requireThreadListRuntimeService().scheduleThreadListFallbackPrewarm();
}

function threadListFallbackSourceDiagnosticTimingFields(diagnostics = {}) {
  return requireThreadListRuntimeService().threadListFallbackSourceDiagnosticTimingFields(diagnostics);
}

function threadListFallbackBaselineWorkTimingFields(diagnostics = {}) {
  return requireThreadListRuntimeService().threadListFallbackBaselineWorkTimingFields(diagnostics);
}

function threadListTokenUsageTimingFields(diagnostics = {}) {
  return requireThreadListRuntimeService().threadListTokenUsageTimingFields(diagnostics);
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
