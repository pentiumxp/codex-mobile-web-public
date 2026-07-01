"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const {
  completedTurnHasNoFinalAgentMessage,
  createThreadDisplaySummaryCache,
  resolveThreadTitleForNotification,
  shouldTrackTurnForWebPush,
} = require("./adapters/push-notification-service");
const { createWebPushRuntimeService } = require("./adapters/web-push-runtime-service");
const { createSharedChainRestartService } = require("./adapters/shared-chain-restart-service");
const { createHermesNotificationDelegateService } = require("./adapters/hermes-notification-delegate-service");
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
const {
  normalizeHomeAiDeployLaneSummary,
} = require("./services/task-cards/thread-task-card-deploy-lane-policy-service");
const { createThreadTaskCardRuntimeService } = require("./services/task-cards/thread-task-card-runtime-service");
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
const { handleThreadDetailReadRoute } = require("./server-routes/thread-detail-route-service");
const { createThreadDetailRuntimeService } = require("./services/thread-detail/thread-detail-runtime-service");
const { createThreadDetailStateBridgeService } = require("./services/thread-detail/thread-detail-state-bridge-service");
const { createThreadSummaryStateService } = require("./services/thread-list/thread-summary-state-service");
const { createThreadSummaryReadModelService } = require("./services/thread-list/thread-summary-read-model-service");
const { createThreadListStateService } = require("./services/thread-list/thread-list-state-service");
const { createThreadListServerBoundaryService } = require("./services/thread-list/thread-list-server-boundary-service");
const {
  stripThreadListDetailFields,
  stripThreadListResultDetailFields,
} = require("./services/thread-list/thread-list-summary-service");
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
const {
  createAppServerEndpointResolver,
  createCodexAppServerClient,
  getFreePort,
} = require("./services/runtime/codex-app-server-client-service");
const { createStaticFileService } = require("./adapters/static-file-service");
const { createServerRuntimeUtils } = require("./services/runtime/server-runtime-utils");
const { createServerRuntimeConfigService } = require("./services/runtime/server-runtime-config-service");
const { createServerHttpRuntimeService } = require("./services/runtime/server-http-runtime-service");
const { createRuntimeSettingsService } = require("./services/runtime/runtime-settings-service");
const { createThreadRuntimeSettingsService } = require("./services/runtime/thread-runtime-settings-service");
const { createThreadRolloutRuntimeService } = require("./services/runtime/thread-rollout-runtime-service");
const { createAppMaintenanceService } = require("./adapters/app-maintenance-service");
const { createAppServerRequestPolicyService } = require("./services/runtime/app-server-request-policy-service");
const { createServerRouteCompositionService } = require("./server-routes/server-route-composition-service");
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
const PROCESS_STARTED_AT_MS = Date.now();
let clients = new Map();
let clientHeartbeats = new WeakMap();
const latestThreadIdByTurnId = new Map();
const recentStartedThreads = new Map();
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
  isThreadListLiveStatus: (...args) => isThreadListLiveStatus(...args),
  isThreadListUnknownStatus: (...args) => isThreadListUnknownStatus(...args),
  mobileArchiveIndexService,
  normalizeThreadId,
  readGlobalState: (...args) => readGlobalState(...args),
  readSessionIndexEntries,
  readStartedThread: (...args) => readStartedThread(...args),
  readStateDbThread: (...args) => readStateDbThread(...args),
  readThreadSummaryFromAppServer: (...args) => readThreadSummaryFromAppServer(...args),
  removeThreadFromThreadListFallbackCache,
  rolloutStatsAnnotator: annotateThreadRolloutStats,
  runSqliteJson,
  sqlString: (...args) => sqlString(...args),
  stateDb: STATE_DB,
  statusText,
  threadSideChatService,
  timestampToMs,
  userHome: USER_HOME,
  workspaceRegistryService,
  rowToFallbackThread: (...args) => rowToFallbackThread(...args),
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
  readStateDbThread: (...args) => readStateDbThread(...args),
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

let threadDetailResponsePreparationService;
let threadSummaryStateService;
let threadListServerBoundaryService;

function requireThreadListServerBoundaryService() {
  if (!threadListServerBoundaryService) throw new Error("thread_list_server_boundary_service_uninitialized");
  return threadListServerBoundaryService;
}

function callThreadListServerBoundary(method, args) {
  return requireThreadListServerBoundaryService()[method](...args);
}

function clonePlainJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

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
  readStateDbThread: (...args) => readStateDbThread(...args),
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
const threadTaskCardRuntimeService = createThreadTaskCardRuntimeService({
  fs,
  path,
  platform: process.platform,
  appRoot: APP_ROOT,
  hermesPluginNotificationBaseUrl: HERMES_PLUGIN_NOTIFICATION_BASE_URL,
  hermesPluginNotificationKey: HERMES_PLUGIN_NOTIFICATION_KEY,
  hermesPluginNotificationKeyFile: HERMES_PLUGIN_NOTIFICATION_KEY_FILE,
  registrationForWorkspace: (workspaceId) => hermesPluginService.registration({ workspaceId }),
  threadTaskCardFile: THREAD_TASK_CARD_FILE,
  returnThreadTaskCardScriptPath: path.join(APP_ROOT, "scripts", "return-thread-task-card.js"),
  threadTaskCardDraftTag: THREAD_TASK_CARD_DRAFT_TAG,
  threadTaskCardBodyMaxChars: THREAD_TASK_CARD_BODY_MAX_CHARS,
  workspaceDelegationToolNamespace: WORKSPACE_DELEGATION_TOOL_NAMESPACE,
  workspaceDelegationToolName: WORKSPACE_DELEGATION_TOOL_NAME,
  taskCardReturnToolName: TASK_CARD_RETURN_TOOL_NAME,
  reasoningEffortOptions: REASONING_EFFORT_OPTIONS,
  actionableApprovalMethods: ACTIONABLE_APPROVAL_METHODS,
  latestThreadIdByTurnId,
  recentStartedThreads,
  normalizeFsPath,
  workspaceDelegationPublicSettings: (...args) => workspaceDelegationPublicSettings(...args),
  workspaceWriteSandboxPolicy,
  normalizeSandboxPolicyType,
  workspaceDelegationWriteGuardPermissionProfile,
  readStateDbThread: (...args) => readStateDbThread(...args),
  readStartedThread: (...args) => readStartedThread(...args),
  readRolloutSessionFallbackThread: (...args) => readRolloutSessionFallbackThread(...args),
  visibleWorkspaceRoots,
  readGlobalState: (...args) => readGlobalState(...args),
  readThreadListFallback: (...args) => readThreadListFallback(...args),
  pushThreadId,
  shortIdentifier,
  compactOneLine,
  workspaceDelegationGuardExemptCwds: WORKSPACE_DELEGATION_GUARD_EXEMPT_CWDS,
  workspaceDelegationGuardSelfExemptionDisabled: WORKSPACE_DELEGATION_GUARD_SELF_EXEMPTION_DISABLED,
  workspaceDelegationGuardPlatformExemptionDisabled: WORKSPACE_DELEGATION_GUARD_PLATFORM_EXEMPTION_DISABLED,
  workspaceDelegationWriteGuardDisabled: WORKSPACE_DELEGATION_WRITE_GUARD_DISABLED,
  workspaceDelegationApprovalProxyOnly: WORKSPACE_DELEGATION_APPROVAL_PROXY_ONLY,
  workspaceDelegationEnforceSandboxGuard: WORKSPACE_DELEGATION_ENFORCE_SANDBOX_GUARD,
  codex: { request: (...args) => codex.request(...args) },
  resolveThreadRuntimeSettings,
  applyPermissionModeOverride,
  mutationRpcTimeoutMs: MUTATION_RPC_TIMEOUT_MS,
  notifyLocalTurnStarted,
  readRuntimeSettings: (...args) => readRuntimeSettings(...args),
  hydrateThreadTitleFromSessionIndex,
  visibilityFromGlobalState,
  threadHasArchiveSignal,
  isHiddenThread,
  isSubagentThreadSummary,
  isSideChatSidecarThreadSummary,
  threadDisplayTitle: (...args) => threadDisplayTitle(...args),
  isRecoverableThreadListTitle,
  stableTextHash: (...args) => stableTextHash(...args),
  truncateSingleLine: (...args) => truncateSingleLine(...args),
  truncateToolDescriptionText: (...args) => truncateSingleLine(...args),
  threadIdForTurnId: (turnId) => latestThreadIdByTurnId.get(turnId),
  attachThreadTaskCardsToResult: (...args) => attachThreadTaskCardsToResult(...args),
  attachPendingServerRequestsToResult: (...args) => attachPendingServerRequestsToResult(...args),
  httpStatusError,
  createTargetError: (statusCode, code, message, details = {}) => httpStatusErrorWithDetails(statusCode, code, message || code, details),
  logger: console,
});
const {
  applyCodexFastServiceTier,
  applyResumeRuntimeSettings,
  applyStartThreadRuntimeSettings,
  applyTurnRuntimeSettings,
  requestedCodexFastMode,
  workspaceSourceWriteGuardDecisionForRequest,
  workspaceSourceWriteGuardLogPayload,
  threadTaskCardRouteService,
  threadTaskCardService,
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
  logWorkspaceDelegationRpc,
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
} = threadTaskCardRuntimeService;
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
const threadDetailStateBridgeService = createThreadDetailStateBridgeService({
  threadSummaryStateService: () => threadSummaryStateService,
  threadTaskCardService,
  threadGoalService,
  codexClient: () => codex,
  serverRequestMethods: SERVER_REQUEST_METHODS,
});
const {
  applyLocalActiveThreadStatusToResult,
  applyLocalActiveThreadStatusToSummary,
  attachPendingServerRequestsToResult,
  attachThreadTaskCardsToResult,
  attachThreadTaskCardsToThread,
  clearLocalActiveThreadStatus,
  clearThreadSummaryActiveMarkers,
  detailReadThreadSummaryForFallbackCache,
  isThreadListLiveStatus,
  isThreadListRestStatus,
  isThreadListUnknownStatus,
  localActiveSummaryRolloutPath,
  localActiveSupersedingRolloutEvidence,
  mergeThreadDisplaySummary,
  mergeThreadRuntimeFromStateDb,
  mergeThreadWithCachedDisplaySummary,
  normalizeThreadSummaryLiveStatus,
  pendingServerRequestsForThread,
  pruneLocalActiveThreadStatuses,
  readLocalActiveThreadStatus,
  readStateDbThread,
  rememberLocalActiveThreadStatus,
  rolloutHasTerminalEntryAtOrAfter,
  rowToFallbackThread,
  shouldExposeServerRequestInThread,
  shouldReplaceThreadDisplayStatus,
  sqlString,
  stableTextHash,
  statusTurnId,
  syncThreadDetailReadResultToThreadListFallbackCache,
} = threadDetailStateBridgeService;
const LIVE_RATE_LIMIT_REFRESH_MIN_INTERVAL_MS = 10000;
const threadDisplaySummaryCache = createThreadDisplaySummaryCache({
  ttlMs: THREAD_DISPLAY_SUMMARY_CACHE_TTL_MS,
  maxEntries: THREAD_DISPLAY_SUMMARY_CACHE_MAX,
  decorateOnRead: false,
  decorateSummary: annotateThreadRolloutStats,
  mergeSummary: mergeThreadDisplaySummary,
});
const threadDetailRuntimeService = createThreadDetailRuntimeService({
  fs,
  path,
  crypto,
  config: {
    threadDetailProjectionV4Enabled: THREAD_DETAIL_PROJECTION_V4_ENABLED,
    threadDetailProjectionCacheDir: THREAD_DETAIL_PROJECTION_CACHE_DIR,
    threadDetailProjectionPolicyVersion: THREAD_DETAIL_PROJECTION_POLICY_VERSION,
    threadDetailRawAllEnabled: THREAD_DETAIL_RAW_ALL_ENABLED,
    threadDetailTurnsListFirstBytes: THREAD_DETAIL_TURNS_LIST_FIRST_BYTES,
    threadDetailCompletedProgressMessages: THREAD_DETAIL_COMPLETED_PROGRESS_MESSAGES,
    threadDetailProgressiveActiveUserTextChars: THREAD_DETAIL_PROGRESSIVE_ACTIVE_USER_TEXT_CHARS,
    threadDetailSummaryAppServerRefreshTtlMs: THREAD_DETAIL_SUMMARY_APP_SERVER_REFRESH_TTL_MS,
    maxTextChars: MAX_TEXT_CHARS,
    maxCommandOutputChars: MAX_COMMAND_OUTPUT_CHARS,
    maxCommandOutputCharsPerTurn: MAX_COMMAND_OUTPUT_CHARS_PER_TURN,
    maxLiveOperationItems: MAX_LIVE_OPERATION_ITEMS,
    maxThreadTurns: MAX_THREAD_TURNS,
    maxFullThreadTurns: MAX_FULL_THREAD_TURNS,
    operationalItemTypes: OPERATIONAL_ITEM_TYPES,
    maxRolloutContextBytes: MAX_ROLLOUT_CONTEXT_BYTES,
    maxRuntimeContextScanBytes: MAX_RUNTIME_CONTEXT_SCAN_BYTES,
    maxRolloutEnrichmentContextBytes: MAX_ROLLOUT_ENRICHMENT_CONTEXT_BYTES,
    runtimeContextCacheTtlMs: RUNTIME_CONTEXT_CACHE_TTL_MS,
    runtimeContextCacheMax: RUNTIME_CONTEXT_CACHE_MAX,
    rolloutActiveStatusWindowMs: ROLLOUT_ACTIVE_STATUS_WINDOW_MS,
    readRpcTimeoutMs: READ_RPC_TIMEOUT_MS,
    threadDetailRpcTimeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS,
  },
  threadDisplaySummaryCache,
  pendingSteerEchoStore,
  statusText,
  truncateMiddle,
  truncateTail,
  compactStringArray,
  compactStructured,
  attachGeneratedImageContent,
  isCodexMobileUploadFilePath,
  normalizeFsPath,
  imageViewSourcePath,
  parseJsonLine,
  timestampToMs,
  rolloutPathForThread,
  rolloutStatsForPath,
  workspaceContextStatsForCwd,
  dedupeUserMessageEchoesInThread,
  normalizeStaleContextOnlyActiveThread,
  annotateThreadRolloutStats,
  readStateDbThread,
  readStartedThread: (...args) => readStartedThread(...args),
  rolloutLatestTurnEvidence,
  isThreadListLiveStatus,
  isThreadListRestStatus,
  isHiddenThread,
  threadRuntimeSettings,
  visibilityFromGlobalState,
  readGlobalState: (...args) => readGlobalState(...args),
  readRolloutSessionFallbackThread,
  readThreadSummaryFromAppServer,
  mergeThreadDisplaySummary,
  applySessionIndexTitleToThread,
  readSessionIndexEntries,
  mergeThreadRuntimeFromStateDb,
  normalizeThreadSummaryLiveStatus,
  publicRuntimeSettings,
  applyLocalActiveThreadStatusToSummary,
  isPathInside,
  uploadRoot: UPLOAD_ROOT,
  stableTextHash,
  finalReceiptTextFromParams,
  clonePlainJson,
  redactInlineImageDataUrls,
  logThreadDetail,
  isUnmaterializedThreadError,
});
const {
  appendMissingRolloutCompletionTurnsToThread,
  appendRolloutActiveAssistantItemsToDetailResult,
  appendRolloutEmptyCompletionDiagnosticsToThread,
  appendRolloutFinalReceiptsToThread,
  appendRolloutToolOutputImagesToThread,
  attachRolloutUsageSummariesToDetailResult,
  appendRolloutUserInputAnchorsToDetailResult,
  backfillMissingRolloutCompletionTurnsForDetailResult,
  cloneThreadForUsageDecoration,
  compactItem,
  compactThread,
  compactThreadReadResult,
  compactTurn,
  compactTurnsListResult,
  dedupeSyntheticActiveAssistantMessagesInThread,
  enrichThreadItemTimestampsFromRollout,
  fallbackThreadReadResult,
  fallbackThreadReadResultForOrchestrator,
  finalizeActiveAssistantProjectionDetailResult,
  finalizeThreadDetailProjectionResult,
  hasTurnUsageSummaryPayload,
  inferTurnItemDisplayTimestamps,
  isAssistantReceiptItem,
  isCompletedStatus,
  isContextCompactionType,
  isEndedTurn,
  isLiveTurn,
  isOperationalItem,
  isReadTimeoutError,
  isTurnDiagnosticItem,
  isTurnUsageSummaryItem,
  isUserQuestionItem,
  isVisualReceiptItem,
  isWebSearchLikeItem,
  itemDisplayTimestampMs,
  itemTimestampCandidateId,
  itemTimestampMatchText,
  normalizeSupersededLiveTurns,
  orderTurnItemsByDisplayTimestamp,
  olderTurnsCursorBeforeTurn,
  parseThreadTurnsCursor,
  prepareProjectedThreadReadResult,
  prepareThreadDetailResponseResult,
  pruneSupersededLiveShellTurns,
  readFullThreadDetailForOrchestrator,
  readRawThreadDetailForOrchestrator,
  readRolloutEnrichmentEntries,
  readRolloutEnrichmentText,
  readRolloutItemTimestampCandidates,
  readRolloutRuntimeScanText,
  readRolloutTail,
  readRolloutToolOutputImageItems,
  readRolloutTurnUsageSummaries,
  reconcileThreadActiveTurnWithRolloutEvidence,
  rolloutEntryTurnId,
  rolloutEvidenceHasRuntimeActivity,
  rolloutEvidenceIsRecent,
  rolloutTimestampFields,
  scheduleRecentWindowProjectionRefresh,
  sortTurnsChronologically,
  threadDetailActiveWindowPrewarmService,
  threadDetailProjectionInput,
  threadDetailProjectionService,
  threadDetailReadOrchestrationService,
  threadFromTurnsList,
  threadRolloutSizeBytes,
  timestampTextsMatch,
  turnCompletionUsageSummary,
  turnIdentifier,
  turnSortTimestampMs,
  turnStartedAtMs,
  userMessageHasVisualAttachment,
  visibleItemId,
} = threadDetailRuntimeService;
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
function mergeThreadSummaryListWithDiagnostics(...args) { return callThreadListServerBoundary("mergeThreadSummaryListWithDiagnostics", args); }
function mergeThreadSummaryList(...args) { return callThreadListServerBoundary("mergeThreadSummaryList", args); }
function mergeThreadListFallback(...args) { return callThreadListServerBoundary("mergeThreadListFallback", args); }
function normalizeThreadListResultStatuses(...args) { return callThreadListServerBoundary("normalizeThreadListResultStatuses", args); }
function threadListSummaryTimestampMs(...args) { return callThreadListServerBoundary("threadListSummaryTimestampMs", args); }
function sortThreadListSummaries(...args) { return callThreadListServerBoundary("sortThreadListSummaries", args); }

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

const resolveExternalEndpoint = createAppServerEndpointResolver({
  fs,
  muxEndpointFile: MUX_ENDPOINT_FILE,
  externalAppServerWs: EXTERNAL_APP_SERVER_WS,
  externalAppServerTcp: EXTERNAL_APP_SERVER_TCP,
});

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
  logWorkspaceDelegationRpc,
  activeRateLimits,
  rateLimitsByModelObject,
  codexProfileService,
  liveQuotaSnapshotForProfiles,
});
threadDetailResponsePreparationService = threadDetailRuntimeService.createResponsePreparationService({
  codex,
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
  applyLocalActiveThreadStatusToResult,
  prepareThreadTaskCardsToResult,
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

threadListServerBoundaryService = createThreadListServerBoundaryService({
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
const { threadListResponseCoalescer } = threadListServerBoundaryService;

function attachRolloutFallbackStatus(...args) { return callThreadListServerBoundary("attachRolloutFallbackStatus", args); }
function fallbackDisplayText(...args) { return callThreadListServerBoundary("fallbackDisplayText", args); }
function hydrateThreadTitleFromSessionIndex(thread, indexEntries = readSessionIndexEntries()) { return callThreadListServerBoundary("hydrateThreadTitleFromSessionIndex", [thread, indexEntries]); }
function inferRolloutFallbackStatus(...args) { return callThreadListServerBoundary("inferRolloutFallbackStatus", args); }
function isRolloutTerminalEntry(...args) { return callThreadListServerBoundary("isRolloutTerminalEntry", args); }
function normalizeStaleContextOnlyActiveThread(...args) { return callThreadListServerBoundary("normalizeStaleContextOnlyActiveThread", args); }
function persistThreadTitleToSessionIndex(...args) { return callThreadListServerBoundary("persistThreadTitleToSessionIndex", args); }
function readRolloutHead(...args) { return callThreadListServerBoundary("readRolloutHead", args); }
function readRolloutSessionFallback(...args) { return callThreadListServerBoundary("readRolloutSessionFallback", args); }
function readRolloutSessionFallbackThread(...args) { return callThreadListServerBoundary("readRolloutSessionFallbackThread", args); }
function readRolloutSessionFallbackThreadFromFile(...args) { return callThreadListServerBoundary("readRolloutSessionFallbackThreadFromFile", args); }
function readSessionIndexEntries(...args) { return callThreadListServerBoundary("readSessionIndexEntries", args); }
function readSessionIndexEntriesForFallback(...args) { return callThreadListServerBoundary("readSessionIndexEntriesForFallback", args); }
function readSessionIndexFallback(...args) { return callThreadListServerBoundary("readSessionIndexFallback", args); }
function rolloutLatestTurnEvidence(...args) { return callThreadListServerBoundary("rolloutLatestTurnEvidence", args); }
function staleContextOnlyActiveEvidenceForRollout(...args) { return callThreadListServerBoundary("staleContextOnlyActiveEvidenceForRollout", args); }
function staleContextOnlyActiveStatus(...args) { return callThreadListServerBoundary("staleContextOnlyActiveStatus", args); }
function clearThreadListFallbackCache(...args) { return callThreadListServerBoundary("clearThreadListFallbackCache", args); }
function removeThreadFromThreadListFallbackCache(...args) { return callThreadListServerBoundary("removeThreadFromThreadListFallbackCache", args); }
function upsertThreadListFallbackCacheThread(...args) { return callThreadListServerBoundary("upsertThreadListFallbackCacheThread", args); }
function updateThreadListFallbackCacheStatus(...args) { return callThreadListServerBoundary("updateThreadListFallbackCacheStatus", args); }
function applyThreadStatusPayloadToThreadListFallbackCache(...args) { return callThreadListServerBoundary("applyThreadStatusPayloadToThreadListFallbackCache", args); }
function trackThreadDetailRequestLifecycle(...args) { return callThreadListServerBoundary("trackThreadDetailRequestLifecycle", args); }
function shouldDeferThreadListFallbackForActiveDetail(...args) { return callThreadListServerBoundary("shouldDeferThreadListFallbackForActiveDetail", args); }
function threadListFallbackCacheKey(...args) { return callThreadListServerBoundary("threadListFallbackCacheKey", args); }
function rememberThreadListFallbackCache(...args) { return callThreadListServerBoundary("rememberThreadListFallbackCache", args); }
function readThreadListFallbackCache(...args) { return callThreadListServerBoundary("readThreadListFallbackCache", args); }
function readThreadListCachedFallback(...args) { return callThreadListServerBoundary("readThreadListCachedFallback", args); }
function readThreadListFallback(...args) { return callThreadListServerBoundary("readThreadListFallback", args); }
function threadListFallbackPrewarmConfig(...args) { return callThreadListServerBoundary("threadListFallbackPrewarmConfig", args); }
function threadListFallbackPrewarmPublicStatus(...args) { return callThreadListServerBoundary("threadListFallbackPrewarmPublicStatus", args); }
function scheduleThreadListFallbackPrewarm(...args) { return callThreadListServerBoundary("scheduleThreadListFallbackPrewarm", args); }
function threadListFallbackSourceDiagnosticTimingFields(...args) { return callThreadListServerBoundary("threadListFallbackSourceDiagnosticTimingFields", args); }
function threadListFallbackBaselineWorkTimingFields(...args) { return callThreadListServerBoundary("threadListFallbackBaselineWorkTimingFields", args); }
function threadListTokenUsageTimingFields(...args) { return callThreadListServerBoundary("threadListTokenUsageTimingFields", args); }

const serverRouteCompositionService = createServerRouteCompositionService({
  READ_RPC_TIMEOUT_MS,
  MAX_THREAD_TURNS,
  CODEX_HOME,
  activeProfileRestartOptions,
  activeRateLimits,
  appRoot: APP_ROOT,
  appUpdateBranch: APP_UPDATE_BRANCH,
  appUpdateDisabled: APP_UPDATE_DISABLED,
  appUpdateRemote: APP_UPDATE_REMOTE,
  appVersion: APP_VERSION,
  applyAppUpdate,
  archiveThreadId,
  archivedSessionThreadIds,
  attachThreadListStateToResult,
  authKey: AUTH_KEY,
  chatGptProBridgeService,
  chatGptProMcpService,
  chatGptProPlannerService,
  chatGptProSourceSummary,
  clients,
  clientHeartbeats,
  codex,
  codexConfigDefaults: CODEX_CONFIG_DEFAULTS,
  codexProfileService,
  compactTurnsListResult,
  createContinuationJob,
  currentPublicBuildConfig,
  defaultModel: DEFAULT_MODEL,
  defaultPermissionModeFromConfigDefaults,
  disableAuth: DISABLE_AUTH,
  filterThreadListByCwd,
  filterVisibleThreads,
  getContinuationJob,
  getProfileSwitchProgress,
  getUrl,
  handleThreadDetailReadRoute,
  handleThreadListRoute,
  handleThreadSideChatRoute,
  hermesNotificationDelegateService,
  hermesOriginFromRequest,
  hermesPluginBaseUrl: HERMES_PLUGIN_BASE_URL,
  hermesPluginService,
  httpStatusError,
  hydrateThreadListResultTitlesFromSessionIndex,
  isAccessKeyAuthorized,
  isAuthorized,
  isRecoverableThreadTitleUpdateError,
  listWorkspaces,
  liveQuotaSnapshotForProfiles,
  loadRecentRateLimitsFromRollouts,
  logClientEvent,
  logThreadDetail,
  logThreadList,
  mediaFileService,
  mergeThreadDisplaySummary,
  mergeThreadSummaryListWithDiagnostics,
  modelOptions: MODEL_OPTIONS,
  normalizeFsPath,
  normalizeStaleContextOnlyActiveThread,
  normalizeThreadListResultStatuses,
  normalizeThreadSummaryLiveStatus,
  permissionModeOptions: PERMISSION_MODE_OPTIONS,
  parseThreadTurnsCursor,
  persistThreadTitleToSessionIndex,
  platform: process.platform,
  pluginSessionCookieHeader,
  preflightCodexProfileSwitch,
  profileSwitchLogDetail,
  profileSwitchProgressRequestId,
  pruneContinuationJobs,
  publicContinuationJob,
  publicConfigRuntimeCache,
  publicPrCheckDisabled: PUBLIC_PR_CHECK_DISABLED,
  publicPrRepository: PUBLIC_PR_REPOSITORY,
  publicReleaseBranch: PUBLIC_RELEASE_BRANCH,
  publicReleaseCheckDisabled: PUBLIC_RELEASE_CHECK_DISABLED,
  publicReleaseRepository: PUBLIC_RELEASE_REPOSITORY,
  pushSubscriptionPublicStatus,
  rateLimitsByModelObject,
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
  requestAuthToken,
  requestBaseUrl,
  reasoningEffortOptions: REASONING_EFFORT_OPTIONS,
  refreshAppUpdateStatus,
  refreshGitHubLinkPreview,
  refreshPublicPullRequestStatus,
  refreshPublicReleaseStatus,
  rolloutWarningBytes: ROLLOUT_WARNING_BYTES,
  rolloutStatsForPath,
  runThreadGoalAction,
  safeAppUpdateError,
  scheduleActiveWindowPrewarmFromThreadListResult,
  scheduleAppRestart,
  sendJson,
  serveStatic,
  setProfileSwitchProgress,
  setThreadGoal,
  setThreadDisplaySettings,
  setWorkspaceDelegationEnabled,
  shouldDeferThreadListFallbackForActiveDetail,
  sharedChainRestartDelayMs: SHARED_CHAIN_RESTART_DELAY_MS,
  sharedChainRestartService,
  syncCodexMobileMcpToolset,
  syncKnownCodexMobileMcpToolsets,
  syncRegisteredWorkspaceTrust,
  syncThreadDetailReadResultToThreadListFallbackCache,
  threadDetailReadOrchestrationService,
  threadDisplayPublicSettings,
  threadDisplaySummaryCache,
  threadListDefaultWarmFallbackEnabled: THREAD_LIST_DEFAULT_WARM_FALLBACK_ENABLED,
  threadListFallbackBaselineWorkTimingFields,
  threadListFallbackPrewarmPublicStatus,
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
  workspaceDelegationPublicSettings,
  workspaceRegistryService,
  timingSafeEquals,
  logger: console,
});
const server = http.createServer(serverRouteCompositionService.handleRequest);

server.on("clientError", serverRouteCompositionService.handleClientError);

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
