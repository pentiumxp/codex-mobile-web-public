"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
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
const { compactWorkspaceContext } = require("./adapters/continuation-handoff-compaction-service");
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
  buildPublicPullRequestStatus,
  normalizeRepositorySlug,
  publicPullRequestApiUrl,
} = require("./adapters/public-pull-request-service");
const {
  githubPreviewApiUrl,
  normalizeGitHubPreview,
  parseGitHubUrl,
} = require("./adapters/github-link-preview-service");
const {
  cacheGeneratedImageDataUrl,
  cacheGeneratedImageForItem,
  generatedImagePathForId,
  imageContentTypeForPath,
  imageViewSourcePath,
} = require("./adapters/generated-image-cache-service");
const {
  createMobileArchiveIndexService,
  normalizeThreadId,
} = require("./adapters/mobile-archive-index-service");
const { createHermesPluginService } = require("./adapters/hermes-plugin-service");
const { createThreadTaskCardService } = require("./adapters/thread-task-card-service");
const { createThreadTaskCardRoutingService } = require("./adapters/thread-task-card-routing-service");
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
const { ensureCodexMobileMcpServer } = require("./adapters/codex-mobile-mcp-config-service");
const { ensureCodexProjectsTrusted } = require("./adapters/codex-project-trust-service");
const { createThreadDetailProjectionInputService } = require("./adapters/thread-detail-projection-input-service");
const { createThreadDetailProjectionResultService } = require("./adapters/thread-detail-projection-result-service");
const { createThreadDetailProjectionService } = require("./adapters/thread-detail-projection-service");
const { createThreadDetailProjectionV4Service } = require("./adapters/thread-detail-projection-v4-service");
const { createThreadDetailSummaryService } = require("./adapters/thread-detail-summary-service");
const { attachThreadDetailDiagnostics } = require("./adapters/thread-detail-performance-service");
const { createThreadDetailReadOrchestrationService } = require("./adapters/thread-detail-read-orchestration-service");
const { createThreadListFallbackCacheService } = require("./adapters/thread-list-fallback-cache-service");
const { createThreadTurnCompactionPolicyService } = require("./adapters/thread-turn-compaction-policy-service");
const { createThreadCompletionDiagnosticService } = require("./adapters/thread-completion-diagnostic-service");
const { createChatGptProBridgeService } = require("./adapters/chatgpt-pro-bridge-service");
const { createChatGptProPlannerService } = require("./adapters/chatgpt-pro-planner-service");
const { createChatGptProMcpService } = require("./adapters/chatgpt-pro-mcp-service");
const { createWorkspaceSourceWriteGuard } = require("./adapters/workspace-source-write-guard-service");

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
    const profileState = codexProfileService.profiles(profileOptions);
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
});
const threadGoalService = createThreadGoalService({
  dbPath: GOALS_DB,
  userHome: USER_HOME,
});
const autoTurnRecoveryRecent = new Map();
const autoTurnRecoveryInflight = new Map();
const sideChatReplyInflight = new Map();
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

function sideChatReadOnlyRuntimeSettings(runtimeSettings) {
  const next = Object.assign({}, runtimeSettings || {});
  next.approvalPolicy = "on-request";
  next.permissionProfile = null;
  next.sandboxPolicy = readOnlySandboxPolicy(next.sandboxPolicy);
  next.sandboxMode = "read-only";
  return next;
}

function sideChatParentSummary(threadId) {
  return readStateDbThread(threadId) || readStartedThread(threadId) || readRolloutSessionFallbackThread(threadId) || { id: threadId };
}

function boundedSideChatTranscript(sideChat, maxChars = 12_000) {
  const messages = Array.isArray(sideChat && sideChat.messages) ? sideChat.messages.slice(-24) : [];
  const lines = messages.map((message) => {
    const role = String(message && message.role || "user") === "assistant" ? "Assistant" : "User";
    return `${role}: ${String(message && message.text || "").trim()}`;
  }).filter((line) => line.trim());
  return truncateTail(lines.join("\n\n"), maxChars, "side-chat transcript");
}

function parentTurnVisibleText(turn) {
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  return items.map((item) => {
    if (!item || typeof item !== "object") return "";
    const type = String(item.type || "").toLowerCase();
    const role = type === "usermessage" || (type === "message" && String(item.role || "").toLowerCase() === "user")
      ? "User"
      : isAssistantReceiptItem(item)
        ? "Assistant"
        : "";
    if (!role) return "";
    const text = itemTimestampMatchText(item);
    return text ? `${role}: ${text}` : "";
  }).filter(Boolean).join("\n");
}

async function parentThreadSideChatContext(parentThreadId) {
  try {
    const turnsResult = await codex.request("thread/turns/list", {
      threadId: parentThreadId,
      limit: 6,
      sortDirection: "desc",
    }, { timeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS, retry: false, resetOnTimeout: false });
    const turns = Array.isArray(turnsResult && turnsResult.data)
      ? turnsResult.data
      : Array.isArray(turnsResult && turnsResult.turns)
        ? turnsResult.turns
        : [];
    const lines = turns.slice().reverse().map(parentTurnVisibleText).filter(Boolean);
    return truncateTail(lines.join("\n\n"), 16_000, "parent thread context");
  } catch (err) {
    return `Parent thread context unavailable: ${String(err && err.message || err).slice(0, 300)}`;
  }
}

function sideChatDeveloperInstructions(parentThreadId) {
  return [
    "You are the private side chat for a Codex Mobile thread.",
    "Answer the user's planning, status, explanation, and option-comparison questions using the current repository context and tools when useful.",
    "Do not edit files, apply patches, commit, deploy, restart services, or mutate external state from this side chat.",
    "If the user asks for an implementation instruction, produce a concise candidate instruction they can explicitly send to the main thread.",
    "Do not claim that your answer has been injected into the main thread.",
    `Parent thread id: ${parentThreadId}`,
  ].join("\n");
}

function sideChatPrompt({ parentThreadId, parentSummary, parentContext, sideChat, userMessage }) {
  const title = String(parentSummary && (parentSummary.name || parentSummary.title || parentSummary.preview) || parentThreadId || "").trim();
  const cwd = String(parentSummary && parentSummary.cwd || "").trim();
  const model = String(parentSummary && (parentSummary.model || parentSummary.modelName) || "").trim();
  const transcript = boundedSideChatTranscript(sideChat);
  return [
    "Side chat request.",
    "",
    "Parent thread context:",
    `- thread_id: ${parentThreadId}`,
    title ? `- title: ${title}` : "",
    cwd ? `- cwd: ${cwd}` : "",
    model ? `- model: ${model}` : "",
    "",
    parentContext ? `Recent parent-thread context:\n${parentContext}` : "Recent parent-thread context: (empty or unavailable)",
    "",
    transcript ? `Recent side-chat transcript:\n${transcript}` : "Recent side-chat transcript: (empty)",
    "",
    "Current user side-chat message:",
    String(userMessage && userMessage.text || "").trim(),
    "",
    "Reply only in the side chat. Keep code-changing actions as recommendations unless the user later applies a candidate to the main thread.",
  ].filter((line) => line !== "").join("\n");
}

async function ensureSideChatSidecarThread(parentThreadId, runtimeSettings, parentSummary) {
  const existing = threadSideChatService.sidecarThreadIdForThread(parentThreadId);
  if (existing) return existing;
  const cwd = String(parentSummary && parentSummary.cwd || "").trim();
  if (!cwd) throw new Error("side_chat_parent_workspace_missing");
  const settings = sideChatReadOnlyRuntimeSettings(runtimeSettings);
  const startParams = applyStartThreadRuntimeSettings({
    cwd,
    modelProvider: null,
    config: {},
    developerInstructions: [
      readStartThreadDeveloperInstructions(cwd) || "",
      sideChatDeveloperInstructions(parentThreadId),
    ].filter(Boolean).join("\n\n"),
    personality: null,
    ephemeral: null,
    dynamicTools: null,
    mockExperimentalField: null,
    experimentalRawEvents: false,
    persistExtendedHistory: false,
  }, settings);
  startParams.sandbox = "read-only";
  delete startParams.permissionProfile;
  const startResult = await codex.request("thread/start", startParams, {
    timeoutMs: MUTATION_RPC_TIMEOUT_MS,
    retry: false,
  });
  const sidecarThreadId = threadIdFromStartResult(startResult);
  if (!sidecarThreadId) throw new Error("side_chat_sidecar_thread_start_failed");
  await threadSideChatService.setSidecarThreadId(parentThreadId, sidecarThreadId);
  rememberStartedThread({
    id: sidecarThreadId,
    name: `Side chat for ${shortIdentifier(parentThreadId)}`,
    preview: "Codex Mobile side chat",
    cwd,
    status: { type: "notLoaded" },
    agentRole: "side_chat",
    agentNickname: "Side chat",
  });
  return sidecarThreadId;
}

function textFromAssistantItem(item) {
  if (!isAssistantReceiptItem(item)) return "";
  const value = item.text || item.message || item.content || item.summary || item.output || "";
  if (Array.isArray(value)) return value.map((entry) => {
    if (typeof entry === "string") return entry;
    if (entry && typeof entry === "object") return String(entry.text || entry.content || entry.value || "");
    return "";
  }).filter(Boolean).join("\n").trim();
  return String(value || "").trim();
}

async function assistantTextForTurn(threadId, turnId) {
  const result = await codex.request("thread/turns/list", {
    threadId,
    limit: 6,
    sortDirection: "desc",
  }, { timeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS, retry: false, resetOnTimeout: false });
  const turns = Array.isArray(result && result.data)
    ? result.data
    : Array.isArray(result && result.turns)
      ? result.turns
      : [];
  const turn = turns.find((entry) => entry && String(entry.id || "") === String(turnId || "")) || turns[0];
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const text = textFromAssistantItem(items[index]);
    if (text) return text;
  }
  return "";
}

async function waitForSideChatReply(threadId, turnId) {
  const deadline = Date.now() + THREAD_SIDE_CHAT_REPLY_TIMEOUT_MS;
  const id = String(turnId || "").trim();
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const result = await codex.request("thread/turns/list", {
        threadId,
        limit: 6,
        sortDirection: "desc",
      }, { timeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS, retry: false, resetOnTimeout: false });
      const turns = Array.isArray(result && result.data)
        ? result.data
        : Array.isArray(result && result.turns)
          ? result.turns
          : [];
      const turn = turns.find((entry) => entry && String(entry.id || "") === id);
      if (turn && isCompletedStatus(turn.status)) {
        const text = await assistantTextForTurn(threadId, turnId);
        if (text) return text;
      }
    } catch (err) {
      lastError = err.message || String(err);
      if (/no rollout found|not found|not materialized|unmaterialized/i.test(lastError)) {
        await sleep(1000);
        continue;
      }
    }
    await sleep(1000);
  }
  throw new Error(lastError || "side_chat_reply_timeout");
}

function startSideChatAssistantReply(parentThreadId, userMessage) {
  const userMessageId = String(userMessage && userMessage.id || "");
  if (!parentThreadId || !userMessageId) return;
  const key = `${parentThreadId}:${userMessageId}`;
  if (sideChatReplyInflight.has(key)) return;
  const promise = (async () => {
    try {
      const parentSummary = sideChatParentSummary(parentThreadId);
      const runtimeSettings = await resolveThreadRuntimeSettings(parentThreadId);
      const sidecarThreadId = await ensureSideChatSidecarThread(parentThreadId, runtimeSettings, parentSummary);
      await threadSideChatService.markAssistantPending(parentThreadId, userMessageId, { sidecarThreadId });
      const settings = sideChatReadOnlyRuntimeSettings(runtimeSettings);
      try {
        await codex.request("thread/resume", applyResumeRuntimeSettings({
          threadId: sidecarThreadId,
          cwd: parentSummary && parentSummary.cwd || null,
          persistExtendedHistory: false,
        }, settings), { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
      } catch (err) {
        if (!/already|loaded|active|no rollout found|not found|not materialized|unmaterialized/i.test(err.message || "")) throw err;
      }
      const sideChat = threadSideChatService.get(parentThreadId);
      const parentContext = await parentThreadSideChatContext(parentThreadId);
      const turnParams = applyTurnRuntimeSettings({
        threadId: sidecarThreadId,
        input: [{ type: "text", text: sideChatPrompt({ parentThreadId, parentSummary, parentContext, sideChat, userMessage }) }],
        cwd: parentSummary && parentSummary.cwd || undefined,
      }, settings);
      turnParams.sandboxPolicy = readOnlySandboxPolicy(settings.sandboxPolicy);
      const turnResult = await codex.request("turn/start", turnParams, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
      const turnId = String((turnResult && turnResult.turnId) || (turnResult && turnResult.turn && turnResult.turn.id) || "");
      const replyText = await waitForSideChatReply(sidecarThreadId, turnId);
      await threadSideChatService.markAssistantCompleted(parentThreadId, userMessageId, {
        text: replyText || "我没有拿到完整回复，请重试。",
      });
    } catch (err) {
      await threadSideChatService.markAssistantFailed(parentThreadId, userMessageId, err).catch(() => {});
      console.error(`[thread side chat] reply failed thread=${shortIdentifier(parentThreadId)} message=${shortIdentifier(userMessageId)}: ${err.message || String(err)}`);
    } finally {
      sideChatReplyInflight.delete(key);
    }
  })();
  sideChatReplyInflight.set(key, promise);
}

function autoTurnRecoveryKey(threadId) {
  return String(threadId || "");
}

function pruneAutoTurnRecoveryRecent(nowMs = Date.now()) {
  for (const [key, entry] of autoTurnRecoveryRecent.entries()) {
    if (!entry || Number(entry.expiresAt || 0) <= nowMs) autoTurnRecoveryRecent.delete(key);
  }
}

function turnStartResultTurnId(result) {
  return String((result && result.turnId) || (result && result.id) || (result && result.turn && result.turn.id) || "");
}

async function autoRecoverThreadTurn(threadId, options = {}) {
  const id = String(threadId || "").trim();
  if (!id) throw httpStatusError(400, "Thread id is required");
  if (!AUTO_TURN_RECOVERY_PROMPT) throw httpStatusError(409, "Automatic turn recovery is disabled");
  const activeTurnId = String(options.activeTurnId || "").trim();
  const wasRunning = Boolean(options.wasRunning || activeTurnId);
  if (!wasRunning) {
    return { skipped: true, reason: "not_marked_running", threadId: id };
  }

  pruneAutoTurnRecoveryRecent();
  const key = autoTurnRecoveryKey(id);
  if (autoTurnRecoveryInflight.has(key)) {
    return autoTurnRecoveryInflight.get(key);
  }
  const recent = autoTurnRecoveryRecent.get(key);
  if (recent && Number(recent.expiresAt || 0) > Date.now()) {
    return {
      skipped: true,
      reason: "cooldown",
      threadId: id,
      action: recent.action || "",
      turnId: recent.turnId || "",
    };
  }

  const promise = (async () => {
    const runtimeSettings = applyPermissionModeOverride(await resolveThreadRuntimeSettings(id), options.permissionMode, options.cwd || null);
    const input = [{ type: "text", text: AUTO_TURN_RECOVERY_PROMPT }];
    const turnsResult = await codex.request("thread/turns/list", {
      threadId: id,
      limit: 5,
      sortDirection: "desc",
    }, { timeoutMs: READ_RPC_TIMEOUT_MS, retry: true, resetOnTimeout: false });
    const turns = turnListFromResult(turnsResult);
    const liveTurn = turns.find((turn) => activeTurnId && turnIdentifier(turn) === activeTurnId && isLiveTurn(turn))
      || turns.find((turn) => isLiveTurn(turn));
    if (liveTurn) {
      const liveTurnId = turnIdentifier(liveTurn);
      try {
        await codex.request("turn/steer", {
          threadId: id,
          input,
          expectedTurnId: liveTurnId,
        }, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
        codex.notifyMuxUserMessage({
          threadId: id,
          turnId: liveTurnId,
          input,
          clientSubmissionId: `auto-recover-${Date.now()}`,
        });
        return { recovered: true, action: "steered", threadId: id, turnId: liveTurnId };
      } catch (err) {
        if (!isTurnSteerUnsupportedError(err) && !isStaleActiveTurnError(err)) throw err;
      }
    }

    try {
      await codex.request("thread/resume", applyResumeRuntimeSettings({
        threadId: id,
        cwd: options.cwd || null,
        persistExtendedHistory: true,
      }, runtimeSettings), { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
    } catch (err) {
      if (!/already|loaded|active/i.test(err.message || "")) throw err;
    }
    const params = applyTurnRuntimeSettings({
      threadId: id,
      input,
    }, runtimeSettings);
    if (options.cwd) params.cwd = options.cwd;
    const result = await codex.request("turn/start", params, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
    const turnId = notifyLocalTurnStarted(id, result, { source: "auto-turn-recovery" });
    return { recovered: true, action: "started", threadId: id, turnId };
  })();

  autoTurnRecoveryInflight.set(key, promise);
  try {
    const result = await promise;
    if (result && result.recovered) {
      autoTurnRecoveryRecent.set(key, {
        expiresAt: Date.now() + AUTO_TURN_RECOVERY_COOLDOWN_MS,
        action: result.action || "",
        turnId: result.turnId || "",
      });
    }
    return result;
  } finally {
    autoTurnRecoveryInflight.delete(key);
  }
}

let threadDetailProjectionService;
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
    const turnId = notifyLocalTurnStarted(card.target.threadId, result, {
      source: "thread-task-card-approval",
    });
    return {
      threadId: String(card.target.threadId || ""),
      turnId,
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
const FILE_PREVIEW_REFERENCE_SCAN_MAX_CHARS = Math.max(64 * 1024, Number(process.env.CODEX_MOBILE_FILE_PREVIEW_REFERENCE_SCAN_MAX_CHARS || String(2 * 1024 * 1024)));
const FILE_PREVIEW_REFERENCE_SCAN_MAX_MATCHES = Math.max(1, Number(process.env.CODEX_MOBILE_FILE_PREVIEW_REFERENCE_SCAN_MAX_MATCHES || "80"));
const MAX_COMMAND_OUTPUT_CHARS = 8000;
const MAX_COMMAND_OUTPUT_CHARS_PER_TURN = 48000;
const MAX_STRUCTURED_CHARS = 24000;
const MAX_DELTA_CHARS = 12000;
const MAX_THREAD_TURNS = Math.max(1, Math.min(100, Number(process.env.CODEX_MOBILE_THREAD_TURNS || "10")));
const MAX_FULL_THREAD_TURNS = Math.max(MAX_THREAD_TURNS, Math.min(200, Number(process.env.CODEX_MOBILE_FULL_THREAD_TURNS || "10")));
const MAX_LIVE_OPERATION_ITEMS = Math.max(1, Math.min(30, Number(process.env.CODEX_MOBILE_LIVE_OPERATION_ITEMS || "12")));
const OPERATIONAL_ITEM_TYPES = new Set(["commandExecution", "fileChange", "dynamicToolCall", "mcpToolCall"]);
const THREAD_LIST_FALLBACK_CACHE_TTL_MS = Math.max(0, Number(process.env.CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_TTL_MS || "0"));
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
const MESSAGE_DEDUPE_WINDOW_MS = Math.max(5_000, Number(process.env.CODEX_MOBILE_MESSAGE_DEDUPE_WINDOW_MS || "90000"));
const MESSAGE_DEDUPE_MAX = Math.max(20, Number(process.env.CODEX_MOBILE_MESSAGE_DEDUPE_MAX || "300"));
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
const MAX_CONTINUATION_BOOTSTRAP_CHARS = Math.max(4_000, Number(process.env.CODEX_MOBILE_CONTINUATION_BOOTSTRAP_CHARS || "12000"));
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
const CONTINUATION_CONTEXT_FILE_COMPACT_BYTES = Math.max(50 * 1024, Number(process.env.CODEX_MOBILE_CONTINUATION_CONTEXT_FILE_COMPACT_BYTES || String(100 * 1024)));
const CONTINUATION_CONTEXT_PAIR_COMPACT_BYTES = Math.max(CONTINUATION_CONTEXT_FILE_COMPACT_BYTES, Number(process.env.CODEX_MOBILE_CONTINUATION_CONTEXT_PAIR_COMPACT_BYTES || String(200 * 1024)));
const CONTINUATION_CONTEXT_HANDOFF_PROMPT_BYTES = Math.max(CONTINUATION_CONTEXT_FILE_COMPACT_BYTES, Number(process.env.CODEX_MOBILE_CONTINUATION_CONTEXT_HANDOFF_PROMPT_BYTES || String(200 * 1024)));
const CONTINUATION_CONTEXT_COMPACT_PRESERVE_CHARS = Math.max(6_000, Number(process.env.CODEX_MOBILE_CONTINUATION_CONTEXT_COMPACT_PRESERVE_CHARS || "18000"));
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
const githubLinkPreviewCache = new Map();
let publicReleaseStatus = null;
let publicReleaseCheckInFlight = null;
let clients = new Map();
let clientHeartbeats = new WeakMap();
let latestLiveRateLimits = null;
let latestLiveRateLimitsSource = null;
let latestSnapshotRateLimits = null;
let workspaceDelegationTargetHintsCache = { text: "", cachedAt: 0 };
const latestLiveRateLimitsByModel = new Map();
const latestSnapshotRateLimitsByModel = new Map();
let lastRolloutRateLimitScanAt = 0;
const LIVE_RATE_LIMIT_REFRESH_MIN_INTERVAL_MS = 10000;
const latestRuntimeContextByPath = new Map();
const latestItemTimestampsByPath = new Map();
const latestTurnUsageSummariesByPath = new Map();
const latestFinalReceiptsByPath = new Map();
const latestToolOutputImagesByPath = new Map();
const rolloutEnrichmentIndexService = createRolloutEnrichmentIndexService({
  maxIndexes: RUNTIME_CONTEXT_CACHE_MAX,
});
const latestThreadIdByTurnId = new Map();
const recentStartedThreads = new Map();
const localActiveThreadStatuses = new Map();
const threadDisplaySummaryCache = createThreadDisplaySummaryCache({
  ttlMs: THREAD_DISPLAY_SUMMARY_CACHE_TTL_MS,
  maxEntries: THREAD_DISPLAY_SUMMARY_CACHE_MAX,
  decorateSummary: annotateThreadRolloutStats,
  mergeSummary: mergeThreadDisplaySummary,
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
    "build-refresh-policy.js",
    "thread-performance-metrics.js",
    "live-operation-dock-state.js",
    "thread-detail-state.js",
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
  const errorLabel = String(options.errorLabel || "GitHub request");
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
      throw new Error(`${errorLabel} failed with HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function githubLinkPreviewError(err) {
  return String(err && err.message || err || "").replace(/\s+/g, " ").slice(0, 240);
}

function unsupportedGitHubLinkPreview(url, reason, extra = {}) {
  return Object.assign({
    supported: false,
    provider: "github",
    url: String(url || ""),
    checkedAt: new Date().toISOString(),
    reason: String(reason || "unsupported"),
    preview: null,
  }, extra);
}

function githubLinkPreviewForClient(status) {
  const value = Object.assign({}, status || unsupportedGitHubLinkPreview("", "not checked"));
  delete value.checkedAtMs;
  delete value.promise;
  return value;
}

async function readGitHubLinkPreview(url) {
  const target = parseGitHubUrl(url);
  if (!target) return unsupportedGitHubLinkPreview(url, "unsupported GitHub URL");
  try {
    const payload = await fetchJsonWithTimeout(githubPreviewApiUrl(target), {
      timeoutMs: GITHUB_LINK_PREVIEW_TIMEOUT_MS,
      errorLabel: "GitHub link preview",
    });
    const preview = normalizeGitHubPreview(target, payload);
    if (!preview) return unsupportedGitHubLinkPreview(target.canonicalUrl, "unsupported GitHub resource");
    return {
      supported: true,
      provider: "github",
      url: target.canonicalUrl,
      checkedAt: new Date().toISOString(),
      preview,
    };
  } catch (err) {
    return unsupportedGitHubLinkPreview(target.canonicalUrl, githubLinkPreviewError(err), {
      supported: true,
      error: githubLinkPreviewError(err),
    });
  }
}

async function refreshGitHubLinkPreview(url, options = {}) {
  const target = parseGitHubUrl(url);
  if (!target) return githubLinkPreviewForClient(unsupportedGitHubLinkPreview(url, "unsupported GitHub URL"));
  const cacheKey = target.canonicalUrl;
  const now = Date.now();
  const cached = githubLinkPreviewCache.get(cacheKey);
  if (!options.force && cached && !cached.promise && cached.checkedAtMs && now - cached.checkedAtMs < GITHUB_LINK_PREVIEW_CACHE_MS) {
    return githubLinkPreviewForClient(cached);
  }
  if (cached && cached.promise) return cached.promise;
  const promise = readGitHubLinkPreview(cacheKey)
    .then((status) => {
      const next = Object.assign({}, status, { checkedAtMs: Date.now() });
      githubLinkPreviewCache.set(cacheKey, next);
      return githubLinkPreviewForClient(next);
    })
    .finally(() => {
      const current = githubLinkPreviewCache.get(cacheKey);
      if (current && current.promise === promise) githubLinkPreviewCache.delete(cacheKey);
    });
  githubLinkPreviewCache.set(cacheKey, { promise, checkedAtMs: now });
  return promise;
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

function filePreviewEnvRoots() {
  return String(process.env.CODEX_MOBILE_FILE_PREVIEW_ROOTS || "")
    .split(path.delimiter)
    .map((value) => value.trim())
    .filter(Boolean);
}

function filePreviewSkillRoots(options = {}) {
  const userHome = String(options.userHome || USER_HOME || "").trim();
  const codexHome = String(options.codexHome || CODEX_HOME || "").trim();
  const defaultCodexHome = String(options.defaultCodexHome || DEFAULT_CODEX_HOME || "").trim();
  return uniqueStrings([
    codexHome ? path.join(codexHome, "skills") : "",
    defaultCodexHome ? path.join(defaultCodexHome, "skills") : "",
    userHome ? path.join(userHome, ".agents", "skills") : "",
  ]);
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
  for (const root of filePreviewSkillRoots(options)) roots.set(root, "skill");
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
      || entry.source === "skill"
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
  const windowsFileUrl = target.match(/^file:\/\/([A-Za-z]:[\\/].*)$/i);
  if (windowsFileUrl) {
    try {
      return stripLocationSuffix(decodeURIComponent(windowsFileUrl[1]));
    } catch (_) {
      return stripLocationSuffix(windowsFileUrl[1]);
    }
  }
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

function filePreviewExtensionPattern() {
  const extensions = [
    ...FILE_PREVIEW_TEXT_EXTENSIONS,
    ...IMAGE_EXTENSIONS,
    ...FILE_PREVIEW_DOCUMENT_EXTENSIONS,
  ]
    .map((ext) => ext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
  return extensions.join("|");
}

function previewReferenceScanTail(text) {
  const source = String(text || "");
  if (source.length <= FILE_PREVIEW_REFERENCE_SCAN_MAX_CHARS) return source;
  return source.slice(source.length - FILE_PREVIEW_REFERENCE_SCAN_MAX_CHARS);
}

function previewFileReferencesFromText(text) {
  const source = previewReferenceScanTail(text);
  if (!source) return [];
  const extPattern = filePreviewExtensionPattern();
  const windowsFileUrlPattern = new RegExp(`file://[A-Za-z]:[\\\\/](?:[^\\0\\r\\n<>"'\`|])*?(?:${extPattern})(?::\\d+(?::\\d+)?)?`, "gi");
  const fileUrlPattern = new RegExp(`file://[^\\s\\])}>"'\`]+(?:${extPattern})(?::\\d+(?::\\d+)?)?`, "gi");
  const absolutePathPattern = new RegExp(`/(?:[^\\0\\r\\n<>"'\`|])*?(?:${extPattern})(?::\\d+(?::\\d+)?)?`, "gi");
  const windowsAbsolutePathPattern = new RegExp(`[A-Za-z]:[\\\\/](?:[^\\0\\r\\n<>"'\`|])*?(?:${extPattern})(?::\\d+(?::\\d+)?)?`, "gi");
  const out = [];
  for (const pattern of [windowsFileUrlPattern, fileUrlPattern, absolutePathPattern, windowsAbsolutePathPattern]) {
    for (const match of source.matchAll(pattern)) {
      const target = stripMarkdownFileTarget(match[0]);
      if (!target || !path.isAbsolute(target)) continue;
      if (hasDeniedPreviewPathSegment(target) || !allowedFilePreviewExtension(target)) continue;
      try {
        const stat = fs.statSync(target);
        if (stat.isFile()) out.push(safeRealpath(target) || path.resolve(target));
      } catch (_) {}
      if (out.length >= FILE_PREVIEW_REFERENCE_SCAN_MAX_MATCHES) return uniqueStrings(out);
    }
  }
  return uniqueStrings(out);
}

function readRolloutPreviewReferenceScanText(rolloutPath) {
  if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) return "";
  let fd = null;
  try {
    const stat = fs.statSync(rolloutPath);
    if (!stat.isFile() || stat.size <= 0) return "";
    const maxBytes = Math.min(stat.size, FILE_PREVIEW_REFERENCE_SCAN_MAX_CHARS);
    const start = Math.max(0, stat.size - maxBytes);
    const buffer = Buffer.alloc(maxBytes);
    fd = fs.openSync(rolloutPath, "r");
    fs.readSync(fd, buffer, 0, maxBytes, start);
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

function previewReferenceCandidatesForRequestedPath(requestedPath) {
  const target = stripMarkdownFileTarget(requestedPath);
  if (!target || !path.isAbsolute(target)) return [];
  if (hasDeniedPreviewPathSegment(target) || !allowedFilePreviewExtension(target)) return [];
  const candidates = new Set([target]);
  try {
    candidates.add(decodeURIComponent(target));
  } catch (_) {}
  try {
    candidates.add(encodeURI(target));
  } catch (_) {}
  try {
    candidates.add(`file://${target}`);
    candidates.add(`file://${encodeURI(target)}`);
  } catch (_) {}
  return [...candidates].filter(Boolean);
}

function previewRequestedPathReferencedInText(requestedPath, text) {
  const source = String(text || "");
  if (!source) return false;
  return previewReferenceCandidatesForRequestedPath(requestedPath).some((candidate) => source.includes(candidate));
}

function previewReferenceForRequestedPath(requestedPath, text) {
  const target = stripMarkdownFileTarget(requestedPath);
  if (!target || !path.isAbsolute(target)) return [];
  if (!previewRequestedPathReferencedInText(target, text)) return [];
  if (hasDeniedPreviewPathSegment(target) || !allowedFilePreviewExtension(target)) return [];
  try {
    const stat = fs.statSync(target);
    if (stat.isFile()) return [safeRealpath(target) || path.resolve(target)];
  } catch (_) {}
  return [];
}

function referencedPreviewFilesForThread(threadId, options = {}) {
  const summary = options.threadSummary || readStateDbThread(threadId) || readStartedThread(threadId);
  const rolloutPath = options.rolloutPath || rolloutPathForThread(summary);
  const rawRolloutText = typeof options.rolloutText === "string"
    ? options.rolloutText
    : readRolloutPreviewReferenceScanText(rolloutPath);
  if (options.requestedPath) {
    const requestedReference = previewReferenceForRequestedPath(options.requestedPath, rawRolloutText);
    if (requestedReference.length) return requestedReference;
  }
  const rolloutText = previewReferenceScanTail(rawRolloutText);
  return previewFileReferencesFromText(rolloutText);
}

function filePreviewAuthoritiesForThread(threadId, globalState = readGlobalState(), options = {}) {
  const rootAuthorities = previewRootsForThread(threadId, globalState, options).map((root) => ({ root, source: "root" }));
  const referencedAuthorities = referencedPreviewFilesForThread(threadId, options).map((file) => ({
    file,
    source: options.requestedPath ? "requested-thread-reference" : "thread-reference",
  }));
  return [
    ...rootAuthorities,
    ...referencedAuthorities,
  ];
}

function isTextFilePreview(filePath) {
  return FILE_PREVIEW_TEXT_EXTENSIONS.has(filePreviewExtension(filePath));
}

function isMediaFilePreview(filePath) {
  const ext = filePreviewExtension(filePath);
  return IMAGE_EXTENSIONS.has(ext) || FILE_PREVIEW_DOCUMENT_EXTENSIONS.has(ext);
}

function normalizeFilePreviewAuthorities(allowedAuthorities) {
  return (allowedAuthorities || [])
    .map((entry) => {
      if (typeof entry === "string") return { root: path.resolve(entry), source: "root" };
      if (!entry || typeof entry !== "object") return null;
      if (entry.file) return { file: path.resolve(String(entry.file)), source: entry.source || "file" };
      if (entry.root) return { root: path.resolve(String(entry.root)), source: entry.source || "root" };
      return null;
    })
    .filter(Boolean);
}

function resolveFilePreviewPath(requestedPath, allowedAuthorities) {
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
  const resolvedReal = safeRealpath(resolved) || resolved;
  const authorities = normalizeFilePreviewAuthorities(allowedAuthorities);
  const matchingRoots = authorities
    .filter((entry) => entry.root)
    .map((entry) => entry.root)
    .filter((root) => isPathInsideRoot(resolvedReal, root))
    .sort((a, b) => b.length - a.length);
  const matchingFiles = authorities
    .filter((entry) => entry.file)
    .map((entry) => safeRealpath(entry.file) || entry.file)
    .filter((file) => file === resolvedReal);
  if (!matchingRoots.length && !matchingFiles.length) {
    const err = new Error("File is outside the allowed preview roots");
    err.statusCode = 403;
    throw err;
  }
  const matchedRoot = matchingRoots[0] || path.dirname(matchingFiles[0]);
  return {
    path: resolvedReal,
    root: safeRealpath(matchedRoot) || matchedRoot,
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

function shouldHideThreadListSummary(thread) {
  if (threadHasArchiveSignal(thread)) return true;
  if (isSubagentThreadSummary(thread)) return true;
  if (isSideChatSidecarThreadSummary(thread)) return true;
  return isResidualFallbackThreadSummary(thread);
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

function threadHasArchiveSignal(thread) {
  if (!thread || typeof thread !== "object") return false;
  const id = normalizeThreadId(thread.id);
  const status = statusText(thread.status).toLowerCase();
  const location = String(thread.path || thread.rolloutPath || thread.rollout_path || "").toLowerCase();
  return Boolean(thread.archived || thread.archivedAt || thread.archived_at || thread.isArchived)
    || Boolean(thread.deleted || thread.deletedAt || thread.deleted_at || thread.isDeleted || thread.removed || thread.removedAt)
    || Boolean(id && archivedSessionThreadIds().has(id))
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

function isHiddenThread(thread, visibility = null) {
  if (!thread || typeof thread !== "object") return true;
  const view = visibility || visibilityFromGlobalState();
  if (shouldHideThreadListSummary(thread)) return true;
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

function mergeThreadSummaryList(threads) {
  const archivedIds = archivedSessionThreadIds();
  const byId = new Map();
  for (const thread of Array.isArray(threads) ? threads : []) {
    if (!thread || !thread.id) continue;
    const id = String(thread.id);
    if (archivedIds.has(id)) continue;
    const displayThread = normalizeThreadSummaryLiveStatus(mergeThreadWithCachedDisplaySummary(thread));
    const merged = normalizeThreadSummaryLiveStatus(byId.has(id) ? mergeThreadDisplaySummary(byId.get(id), displayThread) : displayThread);
    if (threadHasArchiveSignal(merged) || isSubagentThreadSummary(merged)) {
      byId.delete(id);
      continue;
    }
    byId.set(id, merged);
  }
  return sortThreadListSummaries(
    hydrateThreadListTitlesFromSessionIndex([...byId.values()])
      .filter((thread) => !shouldHideThreadListSummary(thread)),
  );
}

function mergeThreadListFallback(result, fallbackThreads = [], limit = 80) {
  const out = result && typeof result === "object" ? Object.assign({}, result) : {};
  const existing = Array.isArray(out.data)
    ? out.data
    : (Array.isArray(out.threads) ? out.threads : []);
  const capped = mergeThreadSummaryList([...existing, ...fallbackThreads]).slice(0, Math.max(1, limit));
  if (Array.isArray(out.data) || !Array.isArray(out.threads)) out.data = capped;
  if (Array.isArray(out.threads)) out.threads = capped;
  return out;
}

function normalizeThreadListResultStatuses(result) {
  if (!result || typeof result !== "object") return result;
  const out = Object.assign({}, result);
  if (Array.isArray(out.data)) out.data = out.data.map((thread) => normalizeThreadSummaryLiveStatus(thread));
  if (Array.isArray(out.threads)) out.threads = out.threads.map((thread) => normalizeThreadSummaryLiveStatus(thread));
  return out;
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

function filterVisibleThreads(result, globalState = readGlobalState()) {
  const visibility = visibilityFromGlobalState(globalState);
  if (!result || typeof result !== "object") return result;
  const out = Object.assign({}, result);
  if (Array.isArray(out.data)) {
    const merged = mergeThreadStateFromStateDb(out.data);
    const shouldFilterByWorkspace = anyThreadMatchesVisibleWorkspace(merged, visibility);
    out.data = merged
      .filter((thread) => !(shouldFilterByWorkspace ? isHiddenThread(thread, visibility) : shouldHideThreadListSummary(thread)))
      .map(annotateThreadRolloutStats);
  }
  if (Array.isArray(out.threads)) {
    const merged = mergeThreadStateFromStateDb(out.threads);
    const shouldFilterByWorkspace = anyThreadMatchesVisibleWorkspace(merged, visibility);
    out.threads = merged
      .filter((thread) => !(shouldFilterByWorkspace ? isHiddenThread(thread, visibility) : shouldHideThreadListSummary(thread)))
      .map(annotateThreadRolloutStats);
  }
  return out;
}

function mergeThreadStateFromStateDb(threads) {
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
    const archivedIds = archivedSessionThreadIds();
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

function readRolloutTail(rolloutPath, maxBytes = MAX_ROLLOUT_CONTEXT_BYTES) {
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
  return {
    id: `mobile-final-receipt-${turnId || stableTextHash(text)}`,
    type: "agentMessage",
    text,
    source: "rollout_task_complete",
    mobileSyntheticFinalReceipt: true,
  };
}

function rolloutCompletionTimestampMs(entry) {
  const payload = entry && entry.payload && typeof entry.payload === "object" ? entry.payload : {};
  return timestampToMs(payload.completed_at || payload.completedAt || entry.timestamp || payload.timestamp);
}

function rolloutCompletionTurnFromEntry(entry, turnId, text) {
  const payload = entry && entry.payload && typeof entry.payload === "object" ? entry.payload : {};
  const completedAtMs = rolloutCompletionTimestampMs(entry);
  const durationMs = Number(payload.duration_ms || payload.durationMs || 0);
  const turn = {
    id: turnId,
    status: "completed",
    items: [rolloutFinalReceiptItem(entry, turnId, text)],
    source: "rollout_task_complete",
    mobileSyntheticCompletionTurn: true,
  };
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
    byTurn.set(turnId, rolloutCompletionTurnFromEntry(entry, turnId, text));
    scopedCount += 1;
  }
  const payload = { byTurn, scopedCount };
  if (cacheKey) rememberRolloutFinalReceipts(cacheKey, payload);
  return cloneRolloutCompletionTurnPayload(payload);
}

function threadUpdatedAtOnlyMs(thread) {
  return timestampToMs(thread && (thread.updatedAt || thread.updated_at || thread.updatedAtMs || thread.updated_at_ms));
}

function appendMissingRolloutCompletionTurnsToThread(thread) {
  if (!thread || typeof thread !== "object" || !Array.isArray(thread.turns)) return thread;
  if (!isThreadListRestStatus(thread.status)) return thread;
  const rolloutPath = rolloutPathForThread(thread);
  if (!rolloutPath) return thread;
  const payload = readRolloutCompletionTurns(rolloutPath);
  if (!payload || !(payload.byTurn instanceof Map) || !payload.byTurn.size) return thread;
  const existingIds = new Set(thread.turns.map(turnIdentifier).filter(Boolean));
  const updatedAtMs = threadUpdatedAtOnlyMs(thread);
  const candidates = Array.from(payload.byTurn.values())
    .filter((turn) => turn && turn.id && !existingIds.has(String(turn.id)))
    .filter((turn) => {
      if (!updatedAtMs) return true;
      const completedAtMs = timestampToMs(turn.completedAtMs || turn.completedAt);
      return Boolean(completedAtMs && completedAtMs >= updatedAtMs - 5000);
    })
    .sort((a, b) => turnSortTimestampMs(a) - turnSortTimestampMs(b));
  if (!candidates.length) return thread;
  thread.turns.push(...candidates.map(clonePlainJson));
  thread.mobileAppendedRolloutCompletionTurn = candidates[candidates.length - 1].id || true;
  return thread;
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

const threadDetailProjectionInputService = createThreadDetailProjectionInputService({
  maxTurns: MAX_FULL_THREAD_TURNS,
  rolloutStatsForPath,
  statusText,
  timestampToMs,
});
const threadDetailProjectionResultService = createThreadDetailProjectionResultService({
  maxTurns: MAX_FULL_THREAD_TURNS,
  compactThreadReadResult,
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
  readThreadSummaryFromAppServer,
  mergeThreadDisplaySummary,
  applyLocalActiveThreadStatusToSummary,
  threadRolloutSizeBytes,
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
  projectedThreadResult: (input, summary, runtimeSettings) => prepareProjectedThreadReadResult(
    threadDetailProjectionService.get(input),
    summary,
    runtimeSettings,
  ),
  rememberThreadSummary: (thread) => threadDisplaySummaryCache.remember(thread),
  turnsListThreadReadResult: ({ threadId, summary, runtimeSettings, warning, mode, threadLog }) => turnsListThreadReadResult(
    threadId,
    summary,
    runtimeSettings,
    warning,
    mode,
    threadLog,
  ),
  readFullThread: readFullThreadDetailForOrchestrator,
  seedProjection: (input, result) => threadDetailProjectionService.seed(input, result),
  prepareResponse: prepareThreadDetailResponseResult,
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

function prepareProjectedThreadReadResult(cached, summary, runtimeSettings) {
  return threadDetailProjectionResultService.prepareProjectedThreadReadResult(cached, summary, runtimeSettings);
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

function mergeRecentRawOperationsIntoLiveTurn(thread, turn) {
  if (!turn || !isLiveTurn(turn) || !Array.isArray(turn.items)) return;
  const rawOperations = readRecentRawOperations(thread, turn.id, {
    includeCompleted: true,
    maxOperations: MAX_LIVE_OPERATION_ITEMS,
  });
  if (rawOperations.length === 0) return;

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
    turn.items.push(rawOperation);
    if (key) existingByKey.set(key, rawOperation);
    if (signature) existingBySignature.set(signature, rawOperation);
  }
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
    const latestIndex = out.turns.length - 1;
    const liveLatest = out.turns[latestIndex];
    if (liveLatest && isLiveTurn(liveLatest)) {
      mergeRecentRawOperationsIntoLiveTurn(out, liveLatest);
    }
    const operationDetailIndexes = operationDetailTurnIndexes(out.turns);
    out.turns = out.turns.map((turn, index) => compactTurn(turn, {
      allowOperations: operationDetailIndexes.has(index),
      maxOperationItems: operationDetailIndexes.has(index) ? "all" : MAX_LIVE_OPERATION_ITEMS,
      receiptOnly: !operationDetailIndexes.has(index),
      threadId: out.id || out.threadId || "",
      suppressedUploadViewImageCallIds: toolOutputImagePayload.suppressedUploadViewImageCallIdsByTurn instanceof Map
        ? toolOutputImagePayload.suppressedUploadViewImageCallIdsByTurn.get(String(turn && turn.id || "")) || new Set()
        : new Set(),
    })).map(orderTurnItemsByDisplayTimestamp);
    const latest = out.turns[latestIndex];
    if (latest && isLiveTurn(latest) && Array.isArray(latest.items)
      && !latest.items.some((item) => isOperationalItem(item))) {
      const rawOperation = readLatestRawOperation(out, latest.id, { includeCompleted: true });
      if (rawOperation) latest.items.push(rawOperation);
    }
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

function readRuntimeSettings() {
  const value = readJsonFile(RUNTIME_SETTINGS_FILE, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function writeRuntimeSettings(patch = {}) {
  const current = readRuntimeSettings();
  const next = Object.assign({}, current, patch, {
    version: 1,
    updatedAt: new Date().toISOString(),
  });
  writeRuntimeJson(RUNTIME_SETTINGS_FILE, next);
  return next;
}

function workspaceDelegationPublicSettings(settings = readRuntimeSettings()) {
  const raw = settings && settings.workspaceDelegation && typeof settings.workspaceDelegation === "object"
    ? settings.workspaceDelegation
    : {};
  const hasRuntimeValue = typeof raw.enabled === "boolean";
  const enabled = hasRuntimeValue ? raw.enabled : WORKSPACE_DELEGATION_ENV_DEFAULT;
  return {
    enabled,
    mode: enabled ? "model_driven_explicit_task_card_with_source_write_guard" : "off",
    directTaskCardAutoApproval: enabled,
    dynamicTool: enabled ? WORKSPACE_DELEGATION_TOOL_FULL_NAME : "",
    dynamicToolEnabled: enabled,
    ordinarySendPreflight: false,
    localHeuristics: false,
    failureRecovery: enabled ? "source_model_tool_call_with_dynamic_source_write_guard" : "off",
    serverAutoTaskCardFromFailures: false,
    source: hasRuntimeValue ? "runtime" : WORKSPACE_DELEGATION_ENV_DEFAULT ? "environment" : "default",
    updatedAt: String(raw.updatedAt || ""),
  };
}

function truncateToolDescriptionText(value, maxChars = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 3)).trimEnd()}...`;
}

function workspaceDelegationTargetHints() {
  const now = Date.now();
  if (workspaceDelegationTargetHintsCache && now - Number(workspaceDelegationTargetHintsCache.cachedAt || 0) < 15_000) {
    return workspaceDelegationTargetHintsCache.text || "";
  }
  try {
    const threads = [...threadTaskCardVisibleTargetThreads()]
      .sort((a, b) => threadTaskCardTargetUpdatedAt(b) - threadTaskCardTargetUpdatedAt(a))
      .slice(0, 80);
    const lines = [];
    for (const thread of threads) {
      if (!thread || lines.length >= 24) break;
      const id = truncateToolDescriptionText(thread.id || "", 80);
      const title = truncateToolDescriptionText(threadDisplayTitle(thread), 80);
      const cwd = truncateToolDescriptionText(thread.cwd || "", 160);
      if (!id) continue;
      lines.push(`- ${title || id} | id: ${id}${cwd ? ` | cwd: ${cwd}` : ""}`);
    }
    const text = lines.join("\n");
    workspaceDelegationTargetHintsCache = { text, cachedAt: now };
    return text;
  } catch (_) {
    workspaceDelegationTargetHintsCache = { text: "", cachedAt: now };
    return "";
  }
}

function workspaceDelegationDynamicToolSpec() {
  const targetHints = workspaceDelegationTargetHints();
  return {
    namespace: WORKSPACE_DELEGATION_TOOL_NAMESPACE,
    name: WORKSPACE_DELEGATION_TOOL_NAME,
    description: [
      "Create a Codex Mobile cross-thread task card when the current user request requires work in another Codex thread or workspace.",
      "Mandatory boundary when this tool is available: if the requested implementation, file edit, command execution, test, deployment, or other mutation belongs to a different workspace or thread, call this tool before doing that work.",
      "Do not inspect, cd into, edit, patch, run commands in, test, deploy, or otherwise operate on the other workspace from the current thread. Delegate first, then stop or report the created task card.",
      "If the user requested target-workspace mutation and your local attempt already failed with sandbox, filesystem, permission denied, operation not permitted, cwd, or approval-policy errors, do not retry locally or merely report blocked. Use the source-thread context to decide the exact delegation, then call this tool yourself with the failed intent and exact target.",
      "The server does not auto-create task cards from failure logs; the source model must call this tool so the card preserves source-thread context and intent.",
      "This dynamic tool always creates source-direct cards when workspace delegation is enabled; do not request target-side pending approval from this tool.",
      "Do not use this for ordinary discussion, read-only references that do not require target-workspace inspection, or work that clearly belongs in the current thread workspace.",
      "The model must decide from the user's request whether delegation is required; do not rely on local keyword or path heuristics.",
      "Use only a current non-archived target thread. Archived, deleted, hidden, subagent, or non-detail-readable targetThreadId values are rejected by the server.",
      "Several normal threads may share the same cwd/workspace. Prefer an exact targetThreadId or exact targetThreadTitle for the intended thread; do not retarget only because another thread in the same cwd was updated more recently.",
      "Use targetWorkspace/cwd only when the request intentionally names a workspace rather than a specific thread; cwd targeting chooses a current visible thread for that workspace.",
      targetHints ? `Visible target hints:\n${targetHints}` : "",
    ].filter(Boolean).join("\n\n"),
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        sourceThreadId: {
          type: "string",
          description: "Current source thread id when known. Usually the server can infer this from turnId.",
        },
        targetThreadId: {
          type: "string",
          description: "Exact target Codex thread id. Preferred when known.",
        },
        targetThreadIds: {
          type: "array",
          items: { type: "string" },
          description: "One or more exact target Codex thread ids.",
        },
        targetThreadTitle: {
          type: "string",
          description: "Exact visible target thread title when id is not known.",
        },
        targetThreadTitles: {
          type: "array",
          items: { type: "string" },
          description: "Exact visible target thread titles.",
        },
        targetWorkspace: {
          type: "string",
          description: "Exact target workspace cwd/path when title/id is not known.",
        },
        targetCwd: {
          type: "string",
          description: "Exact target workspace cwd/path.",
        },
        title: {
          type: "string",
          description: "Short task-card title.",
        },
        summary: {
          type: "string",
          description: "One-line bounded task summary.",
        },
        body: {
          type: "string",
          description: "Full Markdown task body for the target thread.",
        },
        bodyMarkdown: {
          type: "string",
          description: "Alias for body.",
        },
        workflowMode: {
          type: "string",
          enum: ["manual", "autonomous"],
          description: "Task-card workflow mode. Default is manual.",
        },
        requestId: {
          type: "string",
          description: "Optional stable idempotency seed for this tool call.",
        },
      },
      required: ["title", "body"],
    },
    outputSchema: {
      type: "object",
      additionalProperties: true,
      properties: {
        ok: { type: "boolean" },
        cardCount: { type: "integer" },
        direct: { type: "boolean" },
      },
    },
    exposeToContext: true,
    deferLoading: false,
  };
}

function workspaceDelegationDynamicTools(settings = readRuntimeSettings()) {
  return workspaceDelegationPublicSettings(settings).enabled
    ? [workspaceDelegationDynamicToolSpec()]
    : [];
}

function attachWorkspaceDelegationDynamicTools(params, settings = readRuntimeSettings()) {
  if (!params || typeof params !== "object") return params;
  const tools = workspaceDelegationDynamicTools(settings);
  if (!tools.length) return params;
  const existing = Array.isArray(params.dynamicTools)
    ? params.dynamicTools.filter(Boolean)
    : params.dynamicTools ? [params.dynamicTools] : [];
  const seen = new Set(existing.map((tool) => `${tool && tool.namespace || ""}.${tool && tool.name || ""}`));
  for (const tool of tools) {
    const key = `${tool.namespace}.${tool.name}`;
    if (!seen.has(key)) {
      existing.push(tool);
      seen.add(key);
    }
  }
  params.dynamicTools = existing;
  return params;
}

function appendDeveloperInstructions(params, instructions, marker) {
  if (!params || typeof params !== "object") return params;
  const text = String(instructions || "").trim();
  if (!text) return params;
  const existing = String(params.developerInstructions || "").trim();
  if (marker && existing.includes(marker)) return params;
  params.developerInstructions = existing ? `${existing}\n\n${text}` : text;
  return params;
}

function workspaceDelegationScriptFallbackInstruction(params = {}) {
  const sourceThreadId = String(params && params.threadId || "").trim();
  const scriptPath = path.join(APP_ROOT, "scripts", "create-thread-task-card.js");
  return [
    "Codex Mobile cross-thread delegation fallback:",
    `- Prefer the app-server dynamic tool \`${WORKSPACE_DELEGATION_TOOL_FULL_NAME}\` when it is visible.`,
    "- App-server dynamic tools may not appear in deferred tool discovery such as `tool_search`; absence there is not proof that delegation is unavailable.",
    "- If no direct callable `codex_mobile.delegate_to_thread` tool surface is visible, use the local script below as the first-class fallback path:",
    `  node ${JSON.stringify(scriptPath)} --source-thread ${sourceThreadId || "<current-thread-id>"} --target-thread <target-thread-id-or-exact-title> --title \"<short title>\" --body-file <markdown-file>`,
    "- `multi_agent_v1.spawn_agent`, `multi_agent_v1.resume`, `multi_agent_v1.send`, and `multi_agent_v1.close` are not Codex Mobile task-card APIs and must not be used as a substitute for cross-workspace file changes.",
    "- When the user requested another workspace/thread to be modified, tested, deployed, or otherwise mutated, do not retry a guarded local write after sandbox/permission/cwd/approval failure. Delegate through the dynamic tool or this script and then report the created card.",
    "- The server does not create task cards from failure logs in the background; the source thread model must create the card so the body preserves source-thread context and intent.",
  ].join("\n");
}

function attachWorkspaceDelegationRuntimeGuidance(params, settings = readRuntimeSettings()) {
  attachWorkspaceDelegationDynamicTools(params, settings);
  if (workspaceDelegationPublicSettings(settings).enabled) {
    appendDeveloperInstructions(
      params,
      workspaceDelegationScriptFallbackInstruction(params),
      "Codex Mobile cross-thread delegation fallback:",
    );
  }
  return params;
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

function setWorkspaceDelegationEnabled(enabled) {
  const nextEnabled = Boolean(enabled);
  const current = readRuntimeSettings();
  const workspaceDelegation = Object.assign({}, current.workspaceDelegation || {}, {
    enabled: nextEnabled,
    updatedAt: new Date().toISOString(),
  });
  writeRuntimeSettings({ workspaceDelegation });
  return workspaceDelegationPublicSettings(readRuntimeSettings());
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
  if (threadSideChatService.isSidecarThreadId(id)) return "subagent";
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

function maybeApplyQueuedThreadSideChat(method, params) {
  if (method !== "turn/completed") return;
  const turnId = pushTurnId(params);
  if (!turnId || isOldPushTurnEvent(params, ["completedAt", "updatedAt"])) return;
  const threadId = pushThreadId(params);
  if (!threadId) return;
  threadSideChatService.maybeApplyQueuedCandidate(threadId).catch((err) => {
    console.error(`[thread side chat] queued apply failed thread=${shortIdentifier(threadId)} turn=${shortIdentifier(turnId)}: ${err.message || String(err)}`);
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
      threadId: meta.threadId || "",
      turnId,
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
    ".svg": "image/svg+xml; charset=utf-8",
    ".ico": "image/x-icon",
  }[ext] || "application/octet-stream";
}

function isPathInside(parent, child) {
  const parentPath = path.resolve(parent);
  const childPath = path.resolve(child);
  return childPath === parentPath || childPath.startsWith(parentPath + path.sep);
}

function uploadPathForId(uploadRoot, id) {
  const normalized = String(id || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === ".." || part.includes("\0"))) {
    const err = new Error("Invalid upload id");
    err.statusCode = 400;
    throw err;
  }
  if (/^[a-zA-Z]:/.test(parts[0] || "")) {
    const err = new Error("Invalid upload id");
    err.statusCode = 400;
    throw err;
  }
  const target = path.resolve(uploadRoot, ...parts);
  if (!isPathInside(uploadRoot, target)) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }
  return target;
}

function serveUploadedFile(req, res) {
  const url = getUrl(req);
  let target = "";
  const uploadId = url.searchParams.get("id") || "";
  if (uploadId) {
    try {
      target = uploadPathForId(UPLOAD_ROOT, uploadId);
    } catch (err) {
      res.writeHead(err.statusCode || 400);
      res.end(err.message || "Invalid upload id");
      return;
    }
  } else {
    const rawPath = url.searchParams.get("path") || "";
    target = path.resolve(rawPath);
    if (!rawPath || !isPathInside(UPLOAD_ROOT, target)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
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

const STATIC_COMPRESSION_MIN_BYTES = 1024;
const STATIC_COMPRESSION_CACHE_MAX_BYTES = 16 * 1024 * 1024;
const STATIC_COMPRESSIBLE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".svg",
  ".txt",
  ".webmanifest",
]);
const staticCompressionCache = new Map();
let staticCompressionCacheBytes = 0;

function acceptsEncoding(req, encoding) {
  const header = String(req && req.headers && req.headers["accept-encoding"] || "").toLowerCase();
  if (!header) return false;
  const needle = String(encoding || "").toLowerCase();
  return header.split(",").some((part) => {
    const [name, ...params] = part.trim().split(";").map((value) => value.trim());
    if (name !== needle) return false;
    return !params.some((param) => /^q=0(?:\.0*)?$/.test(param));
  });
}

function staticCompressionEncoding(req, target, byteLength) {
  if (Number(byteLength || 0) < STATIC_COMPRESSION_MIN_BYTES) return "";
  if (!STATIC_COMPRESSIBLE_EXTENSIONS.has(path.extname(target).toLowerCase())) return "";
  if (acceptsEncoding(req, "br")) return "br";
  if (acceptsEncoding(req, "gzip")) return "gzip";
  return "";
}

function compressStaticBody(data, encoding, callback) {
  if (encoding === "br") {
    zlib.brotliCompress(data, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
      },
    }, callback);
    return;
  }
  if (encoding === "gzip") {
    zlib.gzip(data, { level: 6 }, callback);
    return;
  }
  callback(null, data);
}

function staticCompressionCacheKey(target, stat, encoding) {
  return [
    path.resolve(target),
    encoding,
    stat.size,
    Math.round(Number(stat.mtimeMs || 0)),
  ].join("|");
}

function getStaticCompressionCache(key) {
  const entry = staticCompressionCache.get(key);
  if (!entry) return null;
  staticCompressionCache.delete(key);
  staticCompressionCache.set(key, entry);
  return entry;
}

function rememberStaticCompressionCache(key, body) {
  if (!key || !Buffer.isBuffer(body) || !body.length) return;
  if (body.length > STATIC_COMPRESSION_CACHE_MAX_BYTES) return;
  const previous = staticCompressionCache.get(key);
  if (previous) {
    staticCompressionCacheBytes -= previous.body.length;
    staticCompressionCache.delete(key);
  }
  staticCompressionCache.set(key, { body });
  staticCompressionCacheBytes += body.length;
  while (staticCompressionCacheBytes > STATIC_COMPRESSION_CACHE_MAX_BYTES && staticCompressionCache.size) {
    const oldestKey = staticCompressionCache.keys().next().value;
    const oldest = staticCompressionCache.get(oldestKey);
    staticCompressionCache.delete(oldestKey);
    if (oldest && oldest.body) staticCompressionCacheBytes -= oldest.body.length;
  }
}

function clearStaticCompressionCache() {
  staticCompressionCache.clear();
  staticCompressionCacheBytes = 0;
}

function staticCompressionCacheStats() {
  return {
    entries: staticCompressionCache.size,
    bytes: staticCompressionCacheBytes,
  };
}

function writeStaticResponse(res, headers, body) {
  headers["Content-Length"] = body.length;
  res.writeHead(200, headers);
  res.end(body);
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
  fs.stat(target, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
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
    const encoding = staticCompressionEncoding(req, target, stat.size);
    const cacheKey = encoding ? staticCompressionCacheKey(target, stat, encoding) : "";
    const cached = cacheKey ? getStaticCompressionCache(cacheKey) : null;
    if (cached) {
      headers["Content-Encoding"] = encoding;
      headers.Vary = "Accept-Encoding";
      writeStaticResponse(res, headers, cached.body);
      return;
    }
    fs.readFile(target, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      if (!encoding) {
        writeStaticResponse(res, headers, data);
        return;
      }
      compressStaticBody(data, encoding, (compressErr, compressed) => {
        if (compressErr) {
          writeStaticResponse(res, headers, data);
          return;
        }
        headers["Content-Encoding"] = encoding;
        headers.Vary = "Accept-Encoding";
        rememberStaticCompressionCache(cacheKey, compressed);
        writeStaticResponse(res, headers, compressed);
      });
    });
  });
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

function threadStatusChangedPayload(threadId, status, meta = {}) {
  const id = String(threadId || "").trim();
  if (!id) return null;
  const params = {
    threadId: id,
    status: status || { type: "notLoaded" },
  };
  const source = String(meta.source || "").trim();
  const turnId = String(meta.turnId || "").trim();
  if (source) params.source = source;
  if (turnId) params.turnId = turnId;
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
  return threadStatusChangedPayload(threadId, status, {
    source: method,
    turnId,
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

const profileSwitchProgress = new Map();

function profileSwitchProgressRequestId(value) {
  const raw = String(value || "").trim();
  if (/^[a-zA-Z0-9_-]{8,80}$/.test(raw)) return raw;
  return crypto.randomUUID();
}

function cleanupProfileSwitchProgress(now = Date.now()) {
  for (const [id, item] of profileSwitchProgress.entries()) {
    const updatedAtMs = Number(item && item.updatedAtMs || 0);
    if (!updatedAtMs || now - updatedAtMs > PROFILE_SWITCH_PROGRESS_TTL_MS) {
      profileSwitchProgress.delete(id);
    }
  }
}

function setProfileSwitchProgress(requestId, patch = {}) {
  const id = profileSwitchProgressRequestId(requestId);
  const now = Date.now();
  cleanupProfileSwitchProgress(now);
  const previous = profileSwitchProgress.get(id) || {
    requestId: id,
    ok: true,
    status: "running",
    stepIndex: 0,
    stepCount: 10,
    stage: "queued",
    message: "正在准备切换 Profile...",
    createdAtMs: now,
    createdAt: new Date(now).toISOString(),
  };
  const next = Object.assign({}, previous, patch || {}, {
    requestId: id,
    updatedAtMs: now,
    updatedAt: new Date(now).toISOString(),
  });
  if (!next.message) next.message = "正在切换 Profile...";
  if (!next.stage) next.stage = "running";
  if (!next.status) next.status = "running";
  profileSwitchProgress.set(id, next);
  return profileSwitchProgressSnapshot(next);
}

function getProfileSwitchProgress(requestId) {
  cleanupProfileSwitchProgress();
  const id = String(requestId || "").trim();
  if (!id) return null;
  const item = profileSwitchProgress.get(id);
  return item ? profileSwitchProgressSnapshot(item) : null;
}

function profileSwitchProgressSnapshot(item = {}) {
  return {
    requestId: String(item.requestId || ""),
    targetProfileId: String(item.targetProfileId || ""),
    targetProfileLabel: String(item.targetProfileLabel || ""),
    status: String(item.status || "running"),
    stage: String(item.stage || "running"),
    message: String(item.message || ""),
    stepIndex: Number(item.stepIndex || 0),
    stepCount: Number(item.stepCount || 10),
    restarting: Boolean(item.restarting),
    error: item.error ? String(item.error) : undefined,
    code: item.code ? String(item.code) : undefined,
    detail: item.detail ? String(item.detail) : undefined,
    failedStage: item.failedStage ? String(item.failedStage) : undefined,
    warnings: Array.isArray(item.warnings) ? item.warnings.slice(0, 5).map((warning) => ({
      code: warning && warning.code ? String(warning.code) : "",
      message: warning && warning.message ? String(warning.message) : "",
      detail: warning && warning.detail ? String(warning.detail) : "",
    })) : undefined,
    updatedAt: item.updatedAt || "",
    createdAt: item.createdAt || "",
  };
}

function profileSwitchPreflightError(err) {
  const raw = String(err && (err.message || err) || "");
  const lower = raw.toLowerCase();
  if (/token_expired|refresh_token_reused|refresh token|access token|unauthorized|401/.test(lower)) {
    return {
      code: "target_profile_auth_invalid",
      message: "目标 Codex 账号登录已失效，请先重新登录该账号，再切换。",
    };
  }
  if (/not found|enoent|eacces|permission denied|spawn/.test(lower)) {
    return {
      code: "target_profile_app_server_unavailable",
      message: "目标 Codex 账号的 app-server 无法启动，请检查该账号配置后再切换。",
    };
  }
  if (/timed out|timeout/.test(lower)) {
    return {
      code: "target_profile_preflight_timeout",
      message: "目标 Codex 账号登录检测超时，请稍后重试或重新登录该账号。",
    };
  }
  return {
    code: "target_profile_preflight_failed",
    message: "目标 Codex 账号登录检测失败，请先修复该账号后再切换。",
  };
}

function boundedProfilePreflightDetail(err) {
  const raw = String(err && (err.message || err) || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  return raw.slice(0, 260);
}

function profileSwitchLogDetail(value) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  return raw.slice(0, 220);
}

function profileSwitchRateLimitsWarningForError(err) {
  const classified = profileSwitchPreflightError(err);
  if (classified.code === "target_profile_auth_invalid") return null;
  return {
    code: "target_profile_rate_limits_unavailable",
    message: "目标账号额度暂时读取失败，已继续切换预检。",
    detail: boundedProfilePreflightDetail(err),
  };
}

function profileSwitchStage(id, label, status = "completed", detail = "") {
  const cleanStatus = ["pending", "running", "completed", "warning", "failed"].includes(status)
    ? status
    : "completed";
  return {
    id: String(id || "").trim(),
    label: String(label || id || "").trim(),
    status: cleanStatus,
    detail: String(detail || "").replace(/\s+/g, " ").trim().slice(0, 220),
    at: new Date().toISOString(),
  };
}

function connectPreflightWebSocket(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + Math.max(500, Number(timeoutMs || 0));
    let ws = null;
    let settled = false;
    let retryTimer = null;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        if (ws) ws.close();
      } catch (_) {}
      reject(new Error("profile switch preflight websocket timeout"));
    }, timeoutMs);

    const attempt = () => {
      if (settled) return;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        if (Date.now() >= deadline) {
          settled = true;
          clearTimeout(timer);
          reject(err);
          return;
        }
        retryTimer = setTimeout(attempt, 200);
        return;
      }
      ws.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (retryTimer) clearTimeout(retryTimer);
        resolve(ws);
      };
      ws.onerror = () => {
        if (settled) return;
        try {
          ws.close();
        } catch (_) {}
        if (Date.now() >= deadline) {
          settled = true;
          clearTimeout(timer);
          reject(new Error("profile switch preflight websocket connection failed"));
          return;
        }
        retryTimer = setTimeout(attempt, 200);
      };
    };

    attempt();
  });
}

function preflightRpc(ws, id, method, params, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.onmessage = null;
      reject(new Error(`profile switch preflight timed out: ${method}`));
    }, timeoutMs);
    ws.onmessage = (event) => {
      let msg = null;
      try {
        msg = JSON.parse(String(event.data || ""));
      } catch (_) {
        return;
      }
      if (!msg || msg.id !== id) return;
      clearTimeout(timer);
      ws.onmessage = null;
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result);
    };
    ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
  });
}

async function preflightCodexProfileSwitch(profile, options = {}) {
  const codexHome = String(profile && profile.codexHome || "").trim();
  if (!codexHome) {
    const err = new Error("Target Codex profile home is missing.");
    err.statusCode = 409;
    throw err;
  }
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
  const emitProgress = (patch) => {
    if (!onProgress) return;
    try {
      onProgress(patch || {});
    } catch (_) {}
  };
  const timeoutMs = Math.max(3000, Number(options.timeoutMs || PROFILE_SWITCH_PREFLIGHT_TIMEOUT_MS));
  const startedAt = Date.now();
  const warnings = [];
  let rateLimitsChecked = false;
  const port = await getFreePort();
  emitProgress({
    stage: "preflight_spawn",
    message: "正在启动目标账号 app-server...",
    stepIndex: 4,
  });
  const childEnv = codexAppServerChildEnv({ CODEX_HOME: codexHome });
  const child = spawn(CODEX_EXE, ["app-server", "--listen", `ws://127.0.0.1:${port}`], {
    cwd: APP_ROOT,
    env: childEnv,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logTail = "";
  const appendLog = (chunk) => {
    logTail = `${logTail}${String(chunk || "")}`.slice(-2000);
  };
  child.stdout.on("data", appendLog);
  child.stderr.on("data", appendLog);

  const closeChild = () => {
    try {
      if (child.exitCode === null && child.signalCode === null) child.kill();
    } catch (_) {}
  };

  try {
    await new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        reject(new Error(`profile switch preflight app-server exited (${code ?? signal ?? "unknown"})`));
      });
    });
    emitProgress({
      stage: "preflight_connect",
      message: "正在连接目标账号 app-server...",
      stepIndex: 5,
    });
    const ws = await connectPreflightWebSocket(`ws://127.0.0.1:${port}`, timeoutMs);
    try {
      const remaining = Math.max(2000, timeoutMs - (Date.now() - startedAt));
      emitProgress({
        stage: "preflight_initialize",
        message: "正在初始化目标账号会话...",
        stepIndex: 6,
      });
      await preflightRpc(ws, 1, "initialize", {
        clientInfo: {
          name: "codex-mobile-web",
          title: "Codex Mobile Web Profile Switch Preflight",
          version: "0.1.0",
          replayNotificationLimit: 0,
        },
        capabilities: { experimentalApi: true },
      }, remaining);
      emitProgress({
        stage: "preflight_rate_limits",
        message: "正在读取目标账号额度...",
        stepIndex: 7,
      });
      try {
        await preflightRpc(ws, 2, "account/rateLimits/read", {}, Math.max(2000, timeoutMs - (Date.now() - startedAt)));
        rateLimitsChecked = true;
      } catch (rateLimitErr) {
        const warning = profileSwitchRateLimitsWarningForError(rateLimitErr);
        if (!warning) throw rateLimitErr;
        warnings.push(warning);
        console.error(`[codex-profile-switch] rate_limits_warning ${JSON.stringify({
          targetProfileId: String(profile.id || ""),
          code: warning.code,
          detail: profileSwitchLogDetail(warning.detail),
        })}`);
        emitProgress({
          stage: "preflight_rate_limits",
          status: "warning",
          message: "目标账号额度暂时读取失败，继续确认切换...",
          stepIndex: 7,
          code: warning.code,
          detail: warning.detail,
        });
      }
      emitProgress({
        stage: "preflight_done",
        message: warnings.length ? "目标账号预检通过，额度读取稍后刷新" : "目标账号预检通过",
        stepIndex: 8,
      });
    } finally {
      try {
        ws.close();
      } catch (_) {}
    }
    return {
      ok: true,
      profileId: profile.id,
      checked: rateLimitsChecked ? ["initialize", "account/rateLimits/read"] : ["initialize"],
      warnings,
    };
  } catch (err) {
    const classified = profileSwitchPreflightError(err);
    const out = new Error(classified.message);
    out.statusCode = 409;
    out.code = classified.code;
    out.detail = boundedProfilePreflightDetail(err) || boundedProfilePreflightDetail(logTail);
    throw out;
  } finally {
    closeChild();
  }
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
    this.muxChild = null;
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
    this.lastRateLimitRefreshAttemptAt = 0;
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
        if (this.canStartOwnedMuxForEndpoint(externalEndpoint)) {
          console.error(`[codex app-server] profile mux endpoint unavailable; starting Mobile-owned mux (${err.message})`);
          await this.startOwnedMuxAndConnect();
          await this.initialize({ allowAlreadyInitialized: true });
          return;
        }
        this.lastError = `shared app-server endpoint unavailable (${err.message})`;
        console.error(`[codex app-server] ${this.lastError}`);
        throw new Error(this.lastError);
      }
    }

    if (this.requireSharedAppServer) {
      if (!DISABLE_MOBILE_OWNED_MUX && !EXTERNAL_APP_SERVER_WS && !EXTERNAL_APP_SERVER_TCP) {
        console.error(`[codex app-server] shared endpoint missing; starting Mobile-owned mux (${MUX_ENDPOINT_FILE})`);
        await this.startOwnedMuxAndConnect();
        await this.initialize({ allowAlreadyInitialized: true });
        return;
      }
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
        env: codexAppServerChildEnv({ CODEX_HOME }),
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

  canStartOwnedMuxForEndpoint(endpoint) {
    if (DISABLE_MOBILE_OWNED_MUX || EXTERNAL_APP_SERVER_WS || EXTERNAL_APP_SERVER_TCP) return false;
    return Boolean(endpoint && endpoint.source && normalizeFsPath(endpoint.source) === normalizeFsPath(MUX_ENDPOINT_FILE));
  }

  async startOwnedMuxAndConnect() {
    assertCommandAvailable(CODEX_EXE, "Codex executable");
    if (this.muxChild && this.muxChild.exitCode === null && this.muxChild.signalCode === null) {
      return this.waitForMuxEndpointAndConnect();
    }

    fs.mkdirSync(path.dirname(MUX_ENDPOINT_FILE), { recursive: true });
    const muxPath = path.join(APP_ROOT, "codex-app-server-mux.js");
    const child = spawn(process.execPath, [muxPath, "app-server", "--analytics-default-enabled"], {
      cwd: APP_ROOT,
      env: codexAppServerChildEnv({
        CODEX_HOME,
        CODEX_MOBILE_RUNTIME_DIR: RUNTIME_ROOT,
        CODEX_MUX_STANDALONE: "1",
        CODEX_MUX_KEEP_ALIVE: "1",
        CODEX_MUX_PUBLISH_ENDPOINT: "1",
        CODEX_MUX_ENDPOINT_FILE: MUX_ENDPOINT_FILE,
        CODEX_MUX_CODEX_EXE: CODEX_EXE,
      }),
      detached: PERSIST_MOBILE_OWNED_MUX,
      windowsHide: true,
      stdio: PERSIST_MOBILE_OWNED_MUX ? ["ignore", "ignore", "ignore"] : ["ignore", "ignore", "pipe"],
    });
    if (PERSIST_MOBILE_OWNED_MUX) {
      child.unref();
    } else {
      this.muxChild = child;
      child.stderr.on("data", (chunk) => this.handleAppServerLog(chunk));
      child.on("exit", (code, signal) => {
        if (this.muxChild !== child) return;
        this.muxChild = null;
        this.ready = false;
        this.lastError = `Mobile-owned mux exited (${code ?? signal ?? "unknown"})`;
        broadcast({ type: "status", status: this.status() });
      });
    }
    await new Promise((resolve, reject) => {
      const onError = (err) => {
        child.off("spawn", onSpawn);
        if (!PERSIST_MOBILE_OWNED_MUX && this.muxChild === child) this.muxChild = null;
        reject(err);
      };
      const onSpawn = () => {
        child.off("error", onError);
        resolve();
      };
      child.once("error", onError);
      child.once("spawn", onSpawn);
    });
    await this.waitForMuxEndpointAndConnect();
  }

  async waitForMuxEndpointAndConnect() {
    const deadline = Date.now() + 20000;
    let lastError = null;
    while (Date.now() < deadline) {
      const endpoint = resolveExternalEndpoint();
      if (endpoint && this.canStartOwnedMuxForEndpoint(endpoint)) {
        try {
          await this.connectEndpoint(endpoint);
          return;
        } catch (err) {
          lastError = err;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error(`Mobile-owned mux endpoint unavailable (${lastError ? lastError.message : `${MUX_ENDPOINT_FILE} not ready`})`);
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
    await this.refreshRateLimits();
    this.ready = true;
    this.lastError = null;
    broadcast({ type: "status", status: this.status() });
  }

  rateLimitSource() {
    if (this.transportKind === "managed-ws-child") return "managed-child-live";
    if (this.isMuxEndpoint()) return "profile-mux-live";
    return "live";
  }

  async refreshRateLimits() {
    try {
      const result = await this.sendRpc("account/rateLimits/read", {}, READ_RPC_TIMEOUT_MS, { resetOnTimeout: false });
      recordRateLimitReadResult(result, { source: this.rateLimitSource() });
    } catch (err) {
      if (!/method not found|not found|unsupported/i.test(err.message || "")) {
        console.error(`[codex app-server] account/rateLimits/read failed: ${String(err.message || err).slice(0, 300)}`);
      }
    }
  }

  async refreshRateLimitsIfMissing() {
    if (!this.ready || !this.isTransportOpen()) return;
    if (latestLiveRateLimits && hasCurrentRateLimitWindow(latestLiveRateLimits)) return;
    const now = Date.now();
    if (now - this.lastRateLimitRefreshAttemptAt < LIVE_RATE_LIMIT_REFRESH_MIN_INTERVAL_MS) return;
    this.lastRateLimitRefreshAttemptAt = now;
    await this.refreshRateLimits();
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
        recordRateLimits(msg.params.rateLimits, {
          source: this.rateLimitSource(),
        });
      }
      if (msg.method === "serverRequest/resolved" && msg.params && msg.params.requestId != null) {
        this.markServerRequestResolved(msg.params.requestId, "resolved");
      }
      rememberThreadIdForTurnParams(msg.method, msg.params || null);
      maybeRecordTurnTokenUsage(msg.method, msg.params || null);
      maybeMaterializeThreadTaskCardDrafts(msg.method, msg.params || null);
      maybeAutoReplyThreadTaskCard(msg.method, msg.params || null);
      maybeApplyQueuedThreadSideChat(msg.method, msg.params || null);
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
    if (this.answerWorkspaceSourceWriteGuardRequest(request)) return;
    if (this.answerCodeGraphReadOnlyMcpElicitationRequest(request)) return;
    this.serverRequests.set(key, request);
    broadcast({ type: "serverRequest", request: publicServerRequest(request) });
    if (msg.method === "item/tool/call") {
      this.answerDynamicToolServerRequest(request).catch((err) => {
        request.status = "failed";
        request.decision = "failed";
        request.respondedAt = Date.now();
        console.error(`[dynamic tool] failed request=${shortIdentifier(key)}: ${err.message || String(err)}`);
        broadcast({ type: "serverRequestResolved", requestId: key, request: publicServerRequest(request) });
        setTimeout(() => this.serverRequests.delete(key), 15000).unref();
      });
    }
  }

  answerWorkspaceSourceWriteGuardRequest(request) {
    const decision = workspaceSourceWriteGuardDecisionForRequest(request);
    if (!decision) return false;
    const responseDecision = decision.action === "deny" ? "deny" : "allow_once";
    try {
      const payload = serverRequestResponsePayload(request, { decision: responseDecision });
      this.sendServerRequestResponse(request, payload);
      request.status = "responded";
      request.decision = decision.action === "deny" ? "source_write_guard_deny" : "source_write_guard_allow";
      request.respondedAt = Date.now();
      console.log(`[workspace-source-write-guard] ${JSON.stringify(workspaceSourceWriteGuardLogPayload(request, decision, responseDecision))}`);
      return true;
    } catch (err) {
      console.error(`[workspace-source-write-guard] failed request=${shortIdentifier(request && request.id)}: ${err.message || String(err)}`);
      return false;
    }
  }

  answerCodeGraphReadOnlyMcpElicitationRequest(request) {
    const decision = codeGraphReadOnlyMcpElicitationDecision(request);
    if (!decision) return false;
    try {
      const payload = serverRequestResponsePayload(request, { action: "accept" });
      this.sendServerRequestResponse(request, payload);
      request.status = "responded";
      request.decision = "codegraph_readonly_allow";
      request.respondedAt = Date.now();
      console.log(`[mcp-elicitation] ${JSON.stringify({
        action: request.decision,
        requestId: shortIdentifier(request && request.id),
        toolName: decision.toolName,
      })}`);
      return true;
    } catch (err) {
      console.error(`[mcp-elicitation] failed request=${shortIdentifier(request && request.id)}: ${err.message || String(err)}`);
      return false;
    }
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

  async answerDynamicToolServerRequest(request) {
    const key = String(request && request.id);
    if (!request) throw new Error("Dynamic tool request is missing");
    if (request.status !== "waiting") return publicServerRequest(request);
    let payload;
    let decision = "submitted";
    try {
      payload = await dynamicToolServerRequestResponsePayload(request);
    } catch (err) {
      decision = "failed";
      payload = dynamicToolErrorPayload(
        err.code || "dynamic_tool_failed",
        err.message || String(err),
        err.details ? { details: err.details } : {},
      );
    }
    this.sendServerRequestResponse(request, payload);
    request.status = "responded";
    request.decision = decision;
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
    logWorkspaceDelegationRpc(method, params);
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
      persistentOwnedMux: PERSIST_MOBILE_OWNED_MUX,
      mobileOwnedMux: this.muxChild ? {
        pid: this.muxChild.pid || null,
        running: this.muxChild.exitCode === null && this.muxChild.signalCode === null,
      } : null,
      codexExe: CODEX_EXE,
      codexHome: CODEX_HOME,
      codexHomeSource: CODEX_HOME_RESOLUTION.source,
      codexHomeEnvIgnored: Boolean(CODEX_HOME_RESOLUTION.envCodexHomeIgnored),
      codexProfileActiveId: CODEX_HOME_RESOLUTION.activeProfileId,
      runtimeRoot: RUNTIME_ROOT,
      userAgent: this.info ? this.info.userAgent : null,
      lastError: this.lastError,
      sharedRequired: this.requireSharedAppServer,
      rateLimits: activeRateLimits(),
      rateLimitsByModel: rateLimitsByModelObject(),
      codexProfiles: codexProfileService.profiles({
        activeQuota: liveQuotaSnapshotForProfiles(),
      }),
    };
  }
}

const codex = new CodexAppServerClient();
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

function rowToFallbackThread(row) {
  const updatedAt = Number(row.updated_at || row.updatedAt || 0);
  const name = row.title || row.thread_name || null;
  const preview = row.first_user_message || row.preview || name || row.id;
  const status = row.status && typeof row.status === "object"
    ? row.status
    : { type: String(row.status || "notLoaded") };
  return attachThreadTaskCardCountsToSummary(annotateThreadRolloutStats({
    id: row.id,
    name,
    preview,
    cwd: typeof row.cwd === "string" ? row.cwd.replace(/^\\\\\?\\/, "") : null,
    path: row.path || row.rollout_path || row.rolloutPath || null,
    updatedAt,
    archived: Boolean(Number(row.archived || 0)),
    archivedAt: row.archived_at || null,
    status,
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

function continuationTitleCandidate(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || /^#\s/.test(text)) return "";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) return "";
  return text;
}

function sourceTitleForContinuation(sourceSnapshot, requestedTitle, cwd) {
  const summary = sourceSnapshot && sourceSnapshot.summary && typeof sourceSnapshot.summary === "object"
    ? sourceSnapshot.summary
    : {};
  const fallback = path.basename(String(cwd || "").replace(/^\\\\\?\\/, "")) || "Codex Mobile";
  for (const value of [requestedTitle, summary.name, summary.title, summary.preview]) {
    const candidate = continuationTitleCandidate(value);
    if (candidate) return candidate;
  }
  return fallback;
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
    sourceGoalMigrated: Boolean(entry.sourceGoalMigrated),
    sourceGoalMigrationError: String(entry.sourceGoalMigrationError || ""),
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

function continuationFallbackReason(error, phase = "") {
  const message = error && (error.message || String(error)) || "";
  const code = error && error.code ? ` (${error.code})` : "";
  const prefix = phase ? `${phase}: ` : "";
  return truncateSingleLine(`${prefix}${message}${code}`.trim() || "source thread did not produce a handoff", 240);
}

function writeFallbackSourceContinuationHandoff({ target, cwd, sourceThreadId, sourceThreadTitle, sourceSnapshot, reason, turnId, turnStatus }) {
  const snapshot = sourceSnapshot || { threadId: sourceThreadId, title: sourceThreadTitle, turns: [], readWarnings: [] };
  const text = [
    `Continuation handoff marker: ${target.id}`,
    "",
    "# Fallback Continuation Handoff",
    "",
    "This handoff was generated by Codex Mobile Web because the source thread did not write its own continuation handoff.",
    "It is a bounded recovery index, not a source-thread model summary. The next thread must re-check repository and runtime state before changing files.",
    "",
    `Source thread id: ${sourceThreadId || "(unknown)"}`,
    `Source thread title: ${sourceThreadTitle || (snapshot && snapshot.title) || "(unknown)"}`,
    `Workspace: ${cwd || "(unknown)"}`,
    `Fallback reason: ${reason || "source thread handoff unavailable"}`,
    turnId ? `Source handoff turn id: ${turnId}` : "",
    turnStatus ? `Source handoff turn status: ${statusText(turnStatus) || turnStatus}` : "",
    "",
    "## Current Goal",
    "",
    "- Unknown from fallback generation. Treat the old thread as potentially stale and ask the user only if workspace/context files do not answer the next action.",
    "",
    "## Source Thread Snapshot",
    "",
    continuationSourceThreadSection(snapshot),
    "",
    "## Recent Visible Turns",
    "",
    continuationTurnSummaries(snapshot.turns || []),
    "",
    "## Workspace Context References",
    "",
    workspaceContextReference(cwd),
    "",
    "## Risks/Caveats",
    "",
    "- The source thread did not confirm this handoff itself.",
    "- Full rollout body, hidden UI state, raw prompts, upload contents, keys, tokens, and long logs were intentionally not copied.",
    "- Re-read `.agent-context/PROJECT_CONTEXT.md`, `.agent-context/HANDOFF.md`, and the smallest relevant docs before doing work.",
    "- If the source thread failed due account/profile/mux state, verify `/api/status`, active profile, and quota before sending another turn.",
    "",
    "## Next-Thread Suggestions",
    "",
    "- Start by confirming the current workspace status and whether the old source thread should remain archived.",
    "- Continue from durable workspace files rather than assuming this fallback captured every old-thread detail.",
  ].filter((line) => line !== "").join("\n");
  fs.writeFileSync(target.file, text, "utf8");
  return continuationHandoffFromText(target, text, {
    fallback: true,
    fallbackReason: reason || "",
    turnId: turnId || "",
    turnCompletion: turnStatus ? {
      waited: true,
      completed: isCompletedStatus(turnStatus),
      status: statusText(turnStatus) || String(turnStatus || ""),
      reason: "fallback handoff generated after source thread could not write file",
    } : {
      waited: false,
      completed: false,
      reason: "fallback handoff generated without source handoff turn status",
    },
  });
}

async function readContinuationTurnStatus(threadId, turnId) {
  const id = String(turnId || "").trim();
  if (!threadId || !id) return null;
  const result = await codex.request("thread/turns/list", {
    threadId,
    limit: Math.max(3, CONTINUATION_RECENT_TURNS),
    sortDirection: "desc",
  }, { timeoutMs: THREAD_DETAIL_RPC_TIMEOUT_MS, retry: false, resetOnTimeout: false });
  const turns = Array.isArray(result && result.data)
    ? result.data
    : Array.isArray(result && result.turns)
      ? result.turns
      : [];
  const turn = turns.find((entry) => entry && String(entry.id || "") === id);
  return turn ? turn.status : null;
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
    "# Continuation Handoff File Generation",
    "",
    "You are running inside the source thread before a continuation thread is created. Write a concise, evidence-grounded handoff file for the next thread.",
    "",
    `Target file: ${handoffFile}`,
    "",
    "Required actions:",
    "1. Read the current workspace `.agent-context/PROJECT_CONTEXT.md` and `.agent-context/HANDOFF.md` if they exist, and include only facts relevant to this workspace and source thread.",
    "2. Check the current repository state as needed, such as git status, recent changes, unfinished tasks, validation results, runtime status, and deployment caveats.",
    "3. The handoff must be freshly summarized from this source thread and the local workspace. Do not copy a fixed template and do not mix in rules from another workspace.",
    "4. Include private/public/README/release rules only when current workspace files or this source thread explicitly establish them, and name the source.",
    "5. Do not write raw secrets, access tokens, passwords, one-time approval state, hidden UI state, long logs, full rollouts, or full prompts.",
    "6. Overwrite the target file. After writing, reply only briefly that the file was written. Do not commit, push, or modify unrelated files.",
    "",
    "Handoff file format:",
    `- First line must be: Continuation handoff marker: ${handoffId}`,
    `- Must include: Source thread id: ${sourceThreadId || "(unknown)"}`,
    `- Must include: Source thread title: ${sourceThreadTitle || "(unknown)"}`,
    `- Must include: Workspace: ${cwd || "(unknown)"}`,
    "- Then use Markdown sections: Current goal, Completed work, Unfinished work, Key files/commands, Validation results, Risks/caveats, Next-thread suggestions.",
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

async function createSourceContinuationHandoff({ cwd, sourceThreadId, sourceThreadTitle, runtimeSettings, sourceSnapshot, onProgress }) {
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
    if (!/already|loaded|active/i.test(err.message || "")) {
      if (onProgress) onProgress("handoff-fallback", "源线程无法唤醒，改用服务端交接文件", { reason: continuationFallbackReason(err, "resume") });
      return writeFallbackSourceContinuationHandoff({
        target,
        cwd,
        sourceThreadId: threadId,
        sourceThreadTitle,
        sourceSnapshot,
        reason: continuationFallbackReason(err, "resume"),
      });
    }
  }
  if (onProgress) onProgress("handoff-turn", "正在让源线程生成交接文件");
  let result;
  try {
    result = await codex.request("turn/start", params, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
  } catch (err) {
    if (onProgress) onProgress("handoff-fallback", "源线程无法启动交接 turn，改用服务端交接文件", { reason: continuationFallbackReason(err, "turn/start") });
    return writeFallbackSourceContinuationHandoff({
      target,
      cwd,
      sourceThreadId: threadId,
      sourceThreadTitle,
      sourceSnapshot,
      reason: continuationFallbackReason(err, "turn/start"),
    });
  }
  const turnId = turnIdFromResult(result);
  notifyLocalTurnStarted(threadId, result, { source: "continuation-source-handoff" });
  if (onProgress) onProgress("handoff-file", "正在等待源线程写入交接文件", { turnId });
  let file;
  try {
    file = await waitForContinuationHandoffFile(target, Math.min(CONTINUATION_HANDOFF_TIMEOUT_MS, 30_000));
  } catch (err) {
    if (err.code !== "HANDOFF_TIMEOUT") throw err;
    let turnStatus = null;
    try {
      turnStatus = await readContinuationTurnStatus(threadId, turnId);
    } catch (_) {
      turnStatus = null;
    }
    if (isCompletedStatus(turnStatus)) {
      const reason = continuationFallbackReason(err, "source turn completed without handoff");
      if (onProgress) onProgress("handoff-fallback", "源线程已结束但没有写交接文件，改用服务端交接文件", { turnId, reason });
      return Object.assign(writeFallbackSourceContinuationHandoff({
        target,
        cwd,
        sourceThreadId: threadId,
        sourceThreadTitle,
        sourceSnapshot,
        reason,
        turnId,
        turnStatus,
      }), {
        result,
      });
    }
    if (onProgress) {
      onProgress("handoff-late", "源线程仍在写交接文件，继续后台等待", {
        turnId,
        extraTimeoutMs: CONTINUATION_LATE_HANDOFF_TIMEOUT_MS,
      });
    }
    try {
      file = await waitForContinuationHandoffFile(target, CONTINUATION_LATE_HANDOFF_TIMEOUT_MS);
    } catch (lateErr) {
      const reason = continuationFallbackReason(lateErr, "handoff timeout");
      if (onProgress) onProgress("handoff-fallback", "源线程未按时写入交接文件，改用服务端交接文件", { turnId, reason });
      let finalTurnStatus = null;
      try {
        finalTurnStatus = await readContinuationTurnStatus(threadId, turnId);
      } catch (_) {
        finalTurnStatus = null;
      }
      return Object.assign(writeFallbackSourceContinuationHandoff({
        target,
        cwd,
        sourceThreadId: threadId,
        sourceThreadTitle,
        sourceSnapshot,
        reason,
        turnId,
        turnStatus: finalTurnStatus,
      }), {
        result,
      });
    }
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
  return [
    `- Handoff file: ${sourceHandoff.path}`,
    `- Handoff relative path: ${sourceHandoff.relativePath || "(unknown)"}`,
    `- Handoff id: ${sourceHandoff.id}`,
    `- Handoff chars: ${sourceHandoff.chars || 0}`,
    `- Handoff mode: ${sourceHandoff.fallback ? "server fallback; source thread did not write this handoff" : "source thread generated"}`,
    sourceHandoff.fallbackReason ? `- Fallback reason: ${sourceHandoff.fallbackReason}` : "",
    "- The handoff content is intentionally not inlined in this bootstrap.",
    "- Read this file first when exact source-thread state is needed.",
  ].filter(Boolean).join("\n");
}

function continuationLineageIndexReference(cwd, sourceThreadId) {
  const indexPath = continuationLineageIndexPath(cwd);
  const chain = buildContinuationLineageChain(cwd, sourceThreadId);
  const lines = [
    `- Lineage index file: ${indexPath}`,
    `- Prior continuation chain depth available: ${chain.length}`,
    "- Prior lineage handoff contents are intentionally not inlined.",
    "- Read the index, then the referenced handoff files only when older continuation provenance is needed.",
  ];
  if (chain.length) {
    lines.push("- Prior lineage references:");
    for (const entry of chain) {
      lines.push(`  - ${entry.newThreadId} <- ${entry.sourceThreadId}; handoff: ${entry.handoffFile || entry.handoffRelativePath || "(unknown)"}; chars: ${entry.handoffChars || 0}`);
    }
  }
  return lines.join("\n");
}

function workspaceContextReference(cwd) {
  return [
    `- Project context: ${path.join(cwd || "", ".agent-context", "PROJECT_CONTEXT.md")}`,
    `- Active handoff: ${path.join(cwd || "", ".agent-context", "HANDOFF.md")}`,
    `- Docs entry: ${path.join(cwd || "", "docs", "README.md")}`,
    "- These files are intentionally not inlined in this bootstrap.",
    "- Read only the smallest relevant docs after the project context and active handoff.",
  ].join("\n");
}

function homeAiCentralContractReference(pluginMode) {
  if (continuationPluginMode({ pluginMode }) !== "hermes") return "";
  return [
    "## Home AI Central Contract",
    "",
    "- This continuation was created from Home AI embedded plugin mode.",
    "- Before code changes, deployment, task-card routing, mobile visual validation, or plugin/workspace policy decisions, read the full central Home AI platform contract document:",
    "  `/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/plugin-workspace-platform-contract.md`",
    "- Treat that central contract as authoritative over plugin-local pointer docs and work according to its required workflow.",
    "- If the task touches deployment or mobile UI, also read the smallest relevant central companion contract/runbook named by that document before acting.",
  ].join("\n");
}

function newThreadBootstrapPromptScoped({ cwd, sourceThreadId, sourceThreadTitle, desiredTitle, sourceSnapshot, runtimeSettings, sourceHandoff, pluginMode }) {
  const snapshot = sourceSnapshot || { threadId: sourceThreadId, title: sourceThreadTitle, turns: [], readWarnings: [] };
  const publicRuntime = publicRuntimeSettings(runtimeSettings);
  const centralContract = homeAiCentralContractReference(pluginMode);
  const parts = [
    "# Continuation Bootstrap Index",
    "",
    "This thread is a same-workspace continuation created by Codex Mobile Web. This message is an index only; it does not inline old thread body, handoff excerpts, workspace context excerpts, or lineage excerpts.",
    "Use tools to read bounded file sections when evidence is needed, or re-check the local repository and runtime state.",
    "",
    "Startup steps:",
    "1. Read the source-thread handoff file listed below first. If it is over 20KB, read its top metadata and recent tail first, then search/read specific sections as needed.",
    "2. Read the current workspace context with bounded reads: `.agent-context/PROJECT_CONTEXT.md` top routing section and `.agent-context/HANDOFF.md` recent tail. Do not load archived/full context by default.",
    "3. Read `docs/README.md`, then only the smallest relevant docs for the current task.",
    "4. Confirm the loaded key facts briefly.",
    "5. Do not edit files, commit, or push in the first continuation turn unless the user gives a new explicit task.",
    "",
    "Do not assume the new thread inherited old chat flow, temporary shell state, one-time approvals, hidden UI state, or old-thread reasoning.",
    "",
    "## Continuation Target",
    `- New thread title: ${desiredTitle || "(not set)"}`,
    `- Workspace: ${cwd || "(unknown)"}`,
    `- Created at: ${new Date().toISOString()}`,
    "",
    "## Source Thread",
    continuationSourceThreadSection(snapshot),
    "",
    "## Source Thread Handoff",
    sourceHandoffSection(sourceHandoff),
    "",
    "## Workspace Context Files",
    workspaceContextReference(cwd),
    "",
    centralContract,
    centralContract ? "" : null,
    "## Continuation Lineage",
    continuationLineageIndexReference(cwd, sourceThreadId),
    "",
    "## Runtime Settings",
    `- Runtime settings passed by Mobile Web: ${Object.keys(publicRuntime || {}).length ? JSON.stringify(publicRuntime) : "(none detected)"}`,
    "- If later work needs different permissions or a different model, follow the current thread UI/user instruction; do not assume old one-time approvals still apply.",
    "",
    "## Privacy And Size Constraints",
    "- Do not copy handoff bodies, lineage handoff bodies, rollout bodies, or workspace context bodies back into chat unless the user explicitly asks.",
    "- Do not write or display raw secrets, access keys, VAPID private keys, subscription endpoints, upload contents, full rollouts, full prompts, or one-time approval state.",
  ].filter((part) => part !== null);
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

function publicContinuationGoalMigration(migration) {
  if (!migration || typeof migration !== "object") return null;
  return {
    migrated: Boolean(migration.migrated),
    reason: String(migration.reason || ""),
    sourceThreadId: String(migration.sourceThreadId || ""),
    targetThreadId: String(migration.targetThreadId || ""),
    sourceStatus: String(migration.sourceStatus || ""),
    targetStatus: String(migration.targetStatus || ""),
    tokenBudget: migration.tokenBudget === null || migration.tokenBudget === undefined ? null : Number(migration.tokenBudget),
    sourceTokenBudget: migration.sourceTokenBudget === null || migration.sourceTokenBudget === undefined ? null : Number(migration.sourceTokenBudget),
    sourceTokensUsed: Number(migration.sourceTokensUsed || 0),
    sourceFrozen: Boolean(migration.sourceFrozen),
    sourceFreezeError: String(migration.sourceFreezeError || ""),
    error: String(migration.error || ""),
  };
}

async function migrateContinuationThreadGoal(sourceThreadId, targetThreadId) {
  const sourceId = String(sourceThreadId || "").trim();
  const targetId = String(targetThreadId || "").trim();
  const base = {
    migrated: false,
    reason: "",
    sourceThreadId: sourceId,
    targetThreadId: targetId,
    sourceStatus: "",
    targetStatus: "",
    tokenBudget: null,
    sourceTokenBudget: null,
    sourceTokensUsed: 0,
    sourceFrozen: false,
    sourceFreezeError: "",
    error: "",
  };
  if (!sourceId || !targetId) return Object.assign(base, { reason: "missing-thread-id" });
  if (sourceId === targetId) return Object.assign(base, { reason: "same-thread" });

  let sourceGoal = null;
  try {
    sourceGoal = await currentThreadGoalForAction(sourceId);
  } catch (err) {
    return Object.assign(base, {
      reason: isThreadGoalRpcUnsupportedError(err) ? "unsupported" : "read-error",
      error: err.message || String(err),
    });
  }

  const plan = continuationGoalMigrationPlan(sourceGoal || {});
  const migration = Object.assign(base, {
    reason: plan.reason || "",
    sourceStatus: plan.sourceStatus || "",
    targetStatus: plan.targetStatus || "",
    tokenBudget: plan.tokenBudget === undefined ? null : plan.tokenBudget,
    sourceTokenBudget: plan.sourceTokenBudget === undefined ? null : plan.sourceTokenBudget,
    sourceTokensUsed: plan.sourceTokensUsed || 0,
  });
  if (!plan.migrate) return migration;

  try {
    const targetExtra = plan.targetStatus === "blocked" ? { status: "blocked" } : {};
    const targetResult = await setThreadGoalRpc(threadGoalSetParams(targetId, plan.objective, plan.tokenBudget, targetExtra));
    let targetGoal = threadGoalFromRpcResult(targetResult);
    if (plan.targetStatus === "blocked" && normalizeThreadGoalStatus(targetGoal && targetGoal.status) !== "blocked") {
      targetGoal = await currentThreadGoalForAction(targetId);
    }
    migration.migrated = true;
    migration.targetStatus = normalizeThreadGoalStatus((targetGoal && targetGoal.status) || plan.targetStatus);
  } catch (err) {
    return Object.assign(migration, {
      reason: isThreadGoalRpcUnsupportedError(err) ? "unsupported" : "set-target-error",
      error: err.message || String(err),
    });
  }

  if (plan.sourceStatus === "active") {
    try {
      await setThreadGoalRpc(threadGoalSetParams(sourceId, plan.objective, plan.sourceTokenBudget, { status: "blocked" }));
      migration.sourceFrozen = true;
    } catch (err) {
      migration.sourceFreezeError = err.message || String(err);
    }
  }

  return migration;
}

function continuationJobSourceKey(body) {
  const sourceThreadId = String(body && body.sourceThreadId || "").trim();
  if (!sourceThreadId) return "";
  return [
    sourceThreadId,
    normalizeFsPath(String(body.cwd || "").trim()),
    Boolean(body.archiveSourceThread),
    continuationPluginMode(body),
  ].join("|");
}

function continuationPluginMode(body = {}) {
  const mode = String(body.pluginMode || body.plugin_mode || "").trim().toLowerCase();
  if (mode === "hermes" || mode === "homeai" || mode === "plugin") return "hermes";
  if (body.hermesPluginMode === true || body.hermes_plugin_mode === true || body.embeddedPlugin === true || body.embedded_plugin === true) return "hermes";
  const pluginId = String(body.pluginId || body.plugin_id || "").trim();
  return pluginId ? "hermes" : "";
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
    pluginMode: job.pluginMode || "",
    threadId: job.threadId || "",
    contextCompaction: job.contextCompaction || null,
    sourceArchive: job.sourceArchive || null,
    sourceGoalMigration: job.sourceGoalMigration || null,
    sourceHandoff: job.sourceHandoff || null,
    lineage: job.lineage || null,
    titleIndexed: Boolean(job.titleIndexed),
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
  progress("context-compaction", "Checking workspace context size");
  const contextCompaction = compactWorkspaceContext({
    cwd,
    thresholdBytes: CONTINUATION_CONTEXT_FILE_COMPACT_BYTES,
    combinedThresholdBytes: CONTINUATION_CONTEXT_PAIR_COMPACT_BYTES,
    preserveChars: CONTINUATION_CONTEXT_COMPACT_PRESERVE_CHARS,
  });
  if (job) job.contextCompaction = contextCompaction;
  if (contextCompaction && contextCompaction.compacted) {
    progress("context-compaction", "Workspace context compacted", {
      archiveDir: contextCompaction.archiveDir,
      manifestPath: contextCompaction.manifestPath,
      originalBytes: contextCompaction.originalBytes,
      compactedBytes: contextCompaction.compactedBytes,
      reductionPercent: contextCompaction.reductionPercent,
    });
  }
  const sourceThreadId = String(body.sourceThreadId || "").trim();
  const requestedSourceThreadTitle = String(body.sourceThreadTitle || "").trim();
  const archiveSourceThread = Boolean(body.archiveSourceThread && sourceThreadId);
  const pluginMode = continuationPluginMode(body);
  progress("source-snapshot", "正在读取源线程摘要", { sourceThreadId });
  const sourceSnapshot = await continuationSourceSnapshot(sourceThreadId, requestedSourceThreadTitle, visibility);
  const sourceThreadTitle = sourceTitleForContinuation(sourceSnapshot, requestedSourceThreadTitle, cwd);
  const desiredTitle = newThreadTitle({ cwd, sourceThreadTitle });
  const runtimeSettings = applyPermissionModeOverride(sourceSnapshot.runtimeSettings || {}, body.permissionMode, cwd);
  progress("handoff", "正在生成源线程交接文件", { sourceThreadId });
  const sourceHandoff = await createSourceContinuationHandoff({
    cwd,
    sourceThreadId,
    sourceThreadTitle,
    runtimeSettings,
    sourceSnapshot,
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
  const titleIndexed = persistThreadTitleToSessionIndex(threadId, desiredTitle);
  if (job) job.titleIndexed = titleIndexed;
  progress("title", "正在设置续接线程标题", { threadId });
  const titleUpdatedBeforeBootstrap = await tryUpdateThreadTitle(threadId, desiredTitle).catch(() => false);
  const bootstrapParams = applyTurnRuntimeSettings({
    threadId,
    input: newThreadBootstrapInput({ cwd, sourceThreadId, sourceThreadTitle, desiredTitle, sourceSnapshot, runtimeSettings, sourceHandoff, pluginMode }),
    cwd,
    summary: "auto",
  }, runtimeSettings);
  progress("bootstrap", "正在写入续接启动上下文", { threadId });
  const bootstrap = threadId
    ? await codex.request("turn/start", bootstrapParams, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false })
    : null;
  if (threadId && bootstrap) notifyLocalTurnStarted(threadId, bootstrap, { source: "continuation-bootstrap" });
  const titleUpdatedAfterBootstrap = await tryUpdateThreadTitle(threadId, desiredTitle).catch(() => false);
  let sourceGoalMigration = null;
  if (sourceThreadId && threadId && sourceThreadId !== threadId && body.migrateSourceGoal !== false) {
    progress("goal-migration", "正在迁移旧线程目标", { threadId, sourceThreadId });
    sourceGoalMigration = publicContinuationGoalMigration(
      await migrateContinuationThreadGoal(sourceThreadId, threadId),
    );
  }
  if (job) job.sourceGoalMigration = sourceGoalMigration;
  let sourceArchive = null;
  if (archiveSourceThread && sourceThreadId !== threadId) {
    progress("archive-source", "正在归档旧线程", { threadId, sourceThreadId });
    try {
      const archiveResult = await archiveVisibleThread(sourceThreadId, visibility);
      sourceArchive = {
        archived: !(archiveResult && archiveResult.archived === false),
        threadId: sourceThreadId,
        result: archiveResult,
      };
    } catch (err) {
      const fallbackResult = mobileArchivedFallbackResult("continuation-fallback", sourceThreadId, err);
      sourceArchive = {
        archived: Boolean(fallbackResult.archived),
        threadId: sourceThreadId,
        result: fallbackResult,
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
    sourceThreadTitle: sourceThreadTitle || (sourceSummary && (sourceSummary.name || sourceSummary.preview)) || "",
    sourceRolloutPath,
    sourceRolloutSizeBytes: sourceStats ? sourceStats.sizeBytes : 0,
    handoffFile: sourceHandoff && sourceHandoff.path,
    handoffRelativePath: sourceHandoff && sourceHandoff.relativePath,
    handoffId: sourceHandoff && sourceHandoff.id,
    handoffChars: sourceHandoff && sourceHandoff.chars,
    sourceArchived: Boolean(sourceArchive && sourceArchive.archived),
    sourceArchiveError: sourceArchive && sourceArchive.error,
    sourceGoalMigrated: Boolean(sourceGoalMigration && sourceGoalMigration.migrated),
    sourceGoalMigrationError: sourceGoalMigration && (sourceGoalMigration.error || sourceGoalMigration.sourceFreezeError),
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
    titleIndexed,
    sourceGoalMigration,
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
    pluginMode: continuationPluginMode(body),
    sourceKey,
    threadId: "",
    sourceArchive: null,
    sourceGoalMigration: null,
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
        ? (result.sourceArchive.archived
          ? "续接线程已就绪；旧线程已在 Mobile 隐藏"
          : `续接线程已就绪；归档失败：${result.sourceArchive.error}`)
        : "续接线程已就绪",
      threadId: result.threadId || job.threadId,
      sourceArchive: result.sourceArchive || job.sourceArchive,
      sourceGoalMigration: result.sourceGoalMigration || job.sourceGoalMigration,
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
  upsertThreadListFallbackCacheThread(summary, { addIfMissing: true });
  return summary;
}

function readStartedThread(threadId) {
  pruneStartedThreadCache();
  const entry = recentStartedThreads.get(String(threadId || ""));
  return entry && entry.thread ? annotateThreadRolloutStats(entry.thread) : null;
}

function pruneLocalActiveThreadStatuses(now = Date.now()) {
  for (const [threadId, entry] of localActiveThreadStatuses) {
    if (!entry || Number(entry.expiresAtMs || 0) <= now) localActiveThreadStatuses.delete(threadId);
  }
}

function rolloutHasTerminalEntryAtOrAfter(rolloutPath, timestampMs = 0) {
  if (!rolloutPath) return false;
  const tail = readRolloutTail(rolloutPath);
  if (!tail) return false;
  const thresholdMs = Math.max(0, Number(timestampMs || 0) - 1000);
  for (const line of tail.split(/\r?\n/)) {
    if (!line || !line.trim()) continue;
    const entry = parseJsonLine(line);
    if (!isRolloutTerminalEntry(entry)) continue;
    const entryTimestampMs = timestampToMs(entry.timestamp || (entry.payload && entry.payload.timestamp));
    if (entryTimestampMs && entryTimestampMs >= thresholdMs) return true;
  }
  return false;
}

function localActiveSupersedingRolloutEvidence(rolloutPath, entry, nowMs = Date.now()) {
  const localTurnId = String(entry && entry.turnId || "").trim();
  if (!rolloutPath || !localTurnId) return null;
  let stat = null;
  try {
    stat = fs.statSync(rolloutPath);
  } catch (_) {
    stat = null;
  }
  const evidence = rolloutLatestTurnEvidence(rolloutPath, stat);
  if (!rolloutEvidenceHasRuntimeActivity(evidence)) return null;
  const evidenceTurnId = String(evidence.turnId || "").trim();
  if (!evidenceTurnId || evidenceTurnId === localTurnId) return null;
  const lastActivityMs = Number(evidence.lastActivityMs || 0);
  const localStartedAtMs = Number(entry && entry.startedAtMs || 0);
  if (localStartedAtMs && lastActivityMs && lastActivityMs < localStartedAtMs - 1000) return null;
  if (!rolloutEvidenceIsRecent(evidence, nowMs)) return null;
  return evidence;
}

function localActiveSummaryRolloutPath(threadId, summary = null) {
  const direct = rolloutPathForThread(summary);
  if (direct) return direct;
  const stateThread = threadId ? readStateDbThread(threadId) : null;
  const statePath = rolloutPathForThread(stateThread);
  if (statePath) return statePath;
  const startedThread = threadId ? readStartedThread(threadId) : null;
  return rolloutPathForThread(startedThread);
}

function readLocalActiveThreadStatus(threadId, summary = null, nowMs = Date.now()) {
  const id = String(threadId || "").trim();
  if (!id) return null;
  pruneLocalActiveThreadStatuses(nowMs);
  const entry = localActiveThreadStatuses.get(id);
  if (!entry) return null;
  if (Number(entry.expiresAtMs || 0) <= nowMs) {
    localActiveThreadStatuses.delete(id);
    updateThreadListFallbackCacheStatus(id, { type: "idle" }, { source: "local-active-expired" });
    return null;
  }
  const rolloutPath = localActiveSummaryRolloutPath(id, summary);
  if (rolloutHasTerminalEntryAtOrAfter(rolloutPath, entry.startedAtMs)) {
    localActiveThreadStatuses.delete(id);
    updateThreadListFallbackCacheStatus(id, { type: "completed" }, { source: "local-active-terminal" });
    return null;
  }
  const supersedingEvidence = localActiveSupersedingRolloutEvidence(rolloutPath, entry, nowMs);
  if (supersedingEvidence) {
    localActiveThreadStatuses.delete(id);
    updateThreadListFallbackCacheStatus(id, { type: "active" }, {
      source: "rollout-active-evidence",
      turnId: supersedingEvidence.turnId,
    });
    return null;
  }
  return entry;
}

function rememberLocalActiveThreadStatus(threadId, turnId = "", meta = {}) {
  const id = String(threadId || "").trim();
  if (!id) return null;
  const nowMs = Date.now();
  const entry = {
    threadId: id,
    turnId: String(turnId || "").trim(),
    source: String(meta.source || "local-turn-start"),
    startedAtMs: nowMs,
    expiresAtMs: nowMs + LOCAL_ACTIVE_THREAD_STATUS_TTL_MS,
  };
  localActiveThreadStatuses.set(id, entry);
  updateThreadListFallbackCacheStatus(id, { type: "active" }, {
    source: entry.source,
    turnId: entry.turnId,
  });
  return entry;
}

function clearLocalActiveThreadStatus(threadId) {
  const id = String(threadId || "").trim();
  if (!id) return false;
  const deleted = localActiveThreadStatuses.delete(id);
  if (deleted) updateThreadListFallbackCacheStatus(id, { type: "idle" }, { source: "local-active-cleared" });
  return deleted;
}

function applyLocalActiveThreadStatusToSummary(thread, options = {}) {
  if (!thread || typeof thread !== "object") return thread;
  const threadId = String(thread.id || options.threadId || "").trim();
  if (!threadId) return thread;
  const entry = readLocalActiveThreadStatus(threadId, thread, options.nowMs || Date.now());
  if (!entry) return thread;
  const startedAtSeconds = Math.floor(Number(entry.startedAtMs || Date.now()) / 1000);
  const updatedAt = Math.max(Number(thread.updatedAt || thread.updated_at || 0), startedAtSeconds);
  const out = Object.assign({}, thread, {
    id: threadId,
    updatedAt,
    status: { type: "active" },
    activeTurnId: entry.turnId || thread.activeTurnId || "",
    mobileLocalActiveStatus: {
      turnId: entry.turnId || "",
      source: entry.source || "",
      startedAtMs: entry.startedAtMs || 0,
      expiresAtMs: entry.expiresAtMs || 0,
    },
  });
  if (thread.updated_at && !thread.updatedAt) out.updated_at = updatedAt;
  return out;
}

function applyLocalActiveThreadStatusToResult(result, options = {}) {
  if (!result || typeof result !== "object" || !result.thread) return result;
  const thread = applyLocalActiveThreadStatusToSummary(result.thread, options);
  if (thread === result.thread) return result;
  return Object.assign({}, result, { thread });
}

function normalizeThreadSummaryLiveStatus(thread, options = {}) {
  return applyLocalActiveThreadStatusToSummary(normalizeStaleContextOnlyActiveThread(thread), options);
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

function isThreadListLiveStatus(status) {
  const text = statusText(status).toLowerCase();
  return /^(active|running|queued|processing|inprogress|in_progress|in-progress)$/.test(text);
}

function isThreadListRestStatus(status) {
  const text = statusText(status).toLowerCase();
  return /^(idle|completed|failed|cancelled|canceled|interrupted|error)$/.test(text);
}

function isThreadListUnknownStatus(status) {
  const text = statusText(status).toLowerCase();
  return !text || /^(unknown|notloaded|not_loaded|not-loaded)$/.test(text);
}

function shouldReplaceThreadDisplayStatus(baseStatus, displayStatus, baseUpdatedAtMs, displayUpdatedAtMs) {
  if (!displayStatus) return false;
  if (!baseStatus) return true;
  const baseUnknown = isThreadListUnknownStatus(baseStatus);
  const displayUnknown = isThreadListUnknownStatus(displayStatus);
  if (displayUnknown && !baseUnknown) return false;
  if (!displayUnknown && baseUnknown) return true;
  const baseLive = isThreadListLiveStatus(baseStatus);
  const displayLive = isThreadListLiveStatus(displayStatus);
  if (baseLive && !displayLive) return isThreadListRestStatus(displayStatus);
  if (!baseLive && displayLive) {
    return Boolean(displayUpdatedAtMs && baseUpdatedAtMs && displayUpdatedAtMs > baseUpdatedAtMs + 1000);
  }
  if (displayUpdatedAtMs && baseUpdatedAtMs && displayUpdatedAtMs < baseUpdatedAtMs) return false;
  return true;
}

function mergeThreadWithCachedDisplaySummary(thread) {
  if (!thread || typeof thread !== "object" || !thread.id) return thread;
  const cached = threadDisplaySummaryCache.read(thread.id);
  return normalizeStaleContextOnlyActiveThread(cached ? (mergeThreadDisplaySummary(thread, cached) || thread) : thread);
}

function mergeThreadDisplaySummary(base, display) {
  if (!base) return display ? normalizeStaleContextOnlyActiveThread(annotateThreadRolloutStats(display)) : null;
  if (!display) return normalizeStaleContextOnlyActiveThread(base);
  const next = Object.assign({}, base);
  for (const key of ["name", "preview", "cwd"]) {
    const value = display[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") next[key] = value;
  }
  const displayUpdatedAtMs = threadListSummaryTimestampMs(display);
  const baseUpdatedAtMs = threadListSummaryTimestampMs(base);
  if (displayUpdatedAtMs && displayUpdatedAtMs >= baseUpdatedAtMs) {
    next.updatedAt = display.updatedAt || display.updated_at || display.updatedAtMs || display.updated_at_ms;
  }
  if (shouldReplaceThreadDisplayStatus(base.status, display.status, baseUpdatedAtMs, displayUpdatedAtMs)) {
    next.status = display.status;
  }
  for (const key of ["archived", "archivedAt", "archived_at", "deleted", "deletedAt", "deleted_at", "agentNickname", "agent_nickname", "agentRole", "agent_role"]) {
    const value = display[key];
    if (value !== null && value !== undefined && value !== "") next[key] = value;
  }
  if (display.isSpawnedChildThread || display.is_spawned_child) next.isSpawnedChildThread = true;
  if (display.mobileFallback && !next.mobileFallback) next.mobileFallback = true;
  return normalizeStaleContextOnlyActiveThread(annotateThreadRolloutStats(next));
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
  const data = Array.isArray(turnsResult && turnsResult.data)
    ? turnsResult.data
    : Array.isArray(turnsResult && turnsResult.turns)
      ? turnsResult.turns
      : [];
  const enriched = enrichThreadItemTimestampsFromRollout(Object.assign({ turns: data }, summary || {}, { id: threadId }));
  const turns = sortTurnsChronologically(enriched.turns).slice(-MAX_THREAD_TURNS);
  const latest = turns[turns.length - 1];
  const status = latest && isLiveTurn(latest) ? { type: "active" } : (summary && summary.status) || { type: "notLoaded" };
  return normalizeThreadSummaryLiveStatus(annotateThreadRolloutStats(Object.assign({
    id: threadId,
    name: null,
    preview: threadId,
    cwd: null,
    path: null,
    updatedAt: 0,
    status,
    turns,
    mobileReadMode: "turns-list",
  }, summary || {}, { id: threadId, status, turns, mobileReadMode: "turns-list" })));
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
  const size = Number(thread && thread.rolloutSizeBytes);
  if (Number.isFinite(size) && size > 0) return size;
  const stats = rolloutStatsForPath(rolloutPathForThread(thread));
  return stats ? stats.sizeBytes : 0;
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
  return attachPendingServerRequestsToResult(attachThreadTaskCardsToResult({
    thread: fallbackThread,
    mobileReadWarning: warning || "",
  }));
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

function attachThreadTaskCardCountsToSummary(thread) {
  if (!thread || typeof thread !== "object" || !thread.id) return thread;
  const taskCardCounts = threadTaskCardService.pendingCountsForThread(thread.id);
  thread.pendingTaskCardCount = taskCardCounts.pendingTotal;
  thread.pendingIncomingTaskCardCount = taskCardCounts.pendingIncoming;
  thread.pendingOutgoingTaskCardCount = taskCardCounts.pendingOutgoing;
  return thread;
}

function attachThreadGoalsToThreadListResult(result) {
  return threadGoalService.attachGoalsToThreadListResult(result);
}

function attachThreadTaskCardCountsToThreadListResult(result) {
  if (!result || typeof result !== "object") return result;
  if (Array.isArray(result.data)) result.data.forEach(attachThreadTaskCardCountsToSummary);
  if (Array.isArray(result.threads)) result.threads.forEach(attachThreadTaskCardCountsToSummary);
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

const threadTaskCardRoutingService = createThreadTaskCardRoutingService({
  normalizeFsPath,
  threadDisplayTitle,
  readThreadListFallback,
  readThreadSummary: (threadId) => readStateDbThread(threadId) || readStartedThread(threadId) || readRolloutSessionFallbackThread(threadId),
  visibilityFromGlobalState,
  threadHasArchiveSignal,
  isHiddenThread,
  isSubagentThreadSummary,
  isSideChatSidecarThreadSummary,
  createError: (statusCode, code, message, details = {}) => httpStatusErrorWithDetails(statusCode, code, message || code, details),
});

function threadTaskCardTargetReferenceText(value) {
  return threadTaskCardRoutingService.targetReferenceText(value);
}

function threadTaskCardTargetReferenceEntry(kind, value) {
  return threadTaskCardRoutingService.targetReferenceEntry(kind, value);
}

function threadTaskCardTargetReferenceEntries(body = {}) {
  return threadTaskCardRoutingService.targetReferenceEntries(body);
}

function threadTaskCardTargetReferences(body = {}) {
  return threadTaskCardRoutingService.targetReferences(body);
}

function isThreadIdLike(value) {
  return threadTaskCardRoutingService.isThreadIdLike(value);
}

function threadTaskCardTargetUpdatedAt(thread) {
  return threadTaskCardRoutingService.targetUpdatedAt(thread);
}

function publicThreadTaskCardTarget(thread) {
  return threadTaskCardRoutingService.publicTarget(thread);
}

function threadTaskCardTargetError(code, message, details = {}, statusCode = 400) {
  return threadTaskCardRoutingService.targetError(code, message, details, statusCode);
}

function threadTaskCardTargetVisibility(options = {}) {
  return threadTaskCardRoutingService.targetVisibility(options);
}

function threadTaskCardVisibleTargetThreads(options = {}) {
  return threadTaskCardRoutingService.visibleTargetThreads(options);
}

function threadTaskCardCanonicalTargetForCwd(cwd, visibleThreads = []) {
  return threadTaskCardRoutingService.canonicalTargetForCwd(cwd, visibleThreads);
}

function threadTaskCardCanonicalTargetForThread(thread, visibleThreads = []) {
  return threadTaskCardRoutingService.canonicalTargetForThread(thread, visibleThreads);
}

function threadTaskCardCanonicalVisibleTargets(visibleThreads = []) {
  return threadTaskCardRoutingService.canonicalVisibleTargets(visibleThreads);
}

function readThreadTaskCardTargetSummary(threadId, options = {}) {
  if (typeof options.readThreadSummary === "function") return options.readThreadSummary(threadId);
  return readStateDbThread(threadId) || readStartedThread(threadId) || readRolloutSessionFallbackThread(threadId);
}

function assertThreadTaskCardTargetDeliverable(thread, details = {}, options = {}) {
  return threadTaskCardRoutingService.assertTargetDeliverable(thread, details, options);
}

function resolveThreadTaskCardTargetReference(value, sourceThreadId = "", options = {}) {
  return threadTaskCardRoutingService.resolveTargetReference(value, sourceThreadId, options);
}

function resolvedThreadTaskCardTargetIds(body = {}, sourceThreadId = "", options = {}) {
  return threadTaskCardRoutingService.resolvedTargetIds(body, sourceThreadId, options);
}

function threadTaskCardThreadCallIdempotencyKey(sourceThreadId, body = {}, targetThreadIds = []) {
  const explicit = String(body.idempotencyKey || "").trim();
  if (explicit) return explicit;
  const requestId = String(body.requestId || body.request_id || "").trim();
  const seed = requestId || JSON.stringify({
    targetThreadIds,
    title: String(body.title || "").trim(),
    summary: String(body.summary || "").trim(),
    body: String(body.body || body.bodyMarkdown || body.message || "").trim(),
    workflowMode: normalizeThreadTaskCardWorkflowMode(body.workflowMode),
    workflowId: String(body.workflowId || "").trim(),
  });
  return `thread-call:${stableTextHash(sourceThreadId)}:${stableTextHash(seed)}`;
}

function buildThreadTaskCardCreatePayload(body = {}, sourceThreadId = "", options = {}) {
  const sourceId = String(sourceThreadId || body.sourceThreadId || "").trim();
  if (body.sourceThreadId && String(body.sourceThreadId || "").trim() !== sourceId) {
    throw httpStatusError(400, "source_thread_id_mismatch");
  }
  const readThreadSummary = typeof options.readThreadSummary === "function"
    ? options.readThreadSummary
    : (threadId) => readStateDbThread(threadId) || readStartedThread(threadId) || readRolloutSessionFallbackThread(threadId) || null;
  const sourceSummary = hydrateThreadTitleFromSessionIndex(
    readThreadSummary(sourceId) || (sourceId ? { id: sourceId } : null),
  );
  const targetThreadIds = resolvedThreadTaskCardTargetIds(body, sourceId, options);
  if (!targetThreadIds.length) {
    throw threadTaskCardTargetError(
      "target_thread_required",
      "A visible target thread id, exact visible thread title, or exact target workspace cwd is required.",
      { sourceThreadId: sourceId },
      400,
    );
  }
  const targetWorkspaceIds = Object.assign({}, body.targetWorkspaceIds && typeof body.targetWorkspaceIds === "object" ? body.targetWorkspaceIds : {});
  for (const targetThreadId of targetThreadIds) {
    if (!targetThreadId || targetWorkspaceIds[targetThreadId]) continue;
    const targetSummary = readThreadSummary(targetThreadId);
    targetWorkspaceIds[targetThreadId] = body.targetWorkspaceId || body.targetWorkspace || (targetSummary && targetSummary.cwd) || "";
  }
  const rawBody = String(body.body || body.bodyMarkdown || body.message || "").trim();
  const cardBody = truncateThreadTaskCardBody(rawBody);
  return Object.assign({}, body, {
    sourceThreadId: sourceId,
    sourceTurnId: body.sourceTurnId || body.turnId || "",
    sourceWorkspaceId: body.sourceWorkspaceId || body.sourceWorkspace || (sourceSummary && sourceSummary.cwd) || "",
    sourceThreadTitle: taskCardSourceThreadTitle(sourceId, body.sourceThreadTitle, sourceSummary),
    targetThreadIds,
    targetWorkspaceIds,
    idempotencyKey: threadTaskCardThreadCallIdempotencyKey(sourceId, body, targetThreadIds),
    format: body.format || "markdown",
    title: body.title,
    summary: body.summary || summarizeTaskCardText(cardBody),
    body: cardBody,
  });
}

async function createThreadTaskCardsFromSourceThread(sourceThreadId, body = {}, options = {}) {
  const payload = buildThreadTaskCardCreatePayload(body, sourceThreadId, options);
  const service = options.threadTaskCardService || threadTaskCardService;
  const cards = await service.createMany(payload);
  const workspaceDelegation = options.workspaceDelegation || workspaceDelegationPublicSettings();
  const autoApprove = workspaceDelegation.enabled
    && body.autoApprove !== false
    && body.direct !== false
    && body.pending !== true;
  const approvals = [];
  if (autoApprove) {
    for (const card of cards) {
      approvals.push(await service.approveFromSource(card.id, payload.sourceThreadId));
    }
  }
  const publicCards = autoApprove
    ? approvals.map((entry) => entry && entry.card).filter(Boolean)
    : cards;
  return {
    ok: true,
    sourceThreadId: payload.sourceThreadId,
    direct: autoApprove,
    autoApprove,
    workspaceDelegationEnabled: workspaceDelegation.enabled,
    card: publicCards[0] || null,
    cards: publicCards,
    approvals,
  };
}

function parseDynamicToolArguments(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return {};
  const text = value.trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function dynamicToolCallIdentity(params = {}) {
  const namespace = String(params.namespace || params.toolNamespace || params.dynamicToolNamespace || "").trim();
  const name = String(params.name || params.toolName || params.tool || params.action || "").trim();
  const fullName = String(params.fullName || params.toolFullName || params.dynamicTool || "").trim();
  return {
    namespace,
    name,
    fullName: fullName || (namespace && name ? `${namespace}.${name}` : name),
  };
}

function isWorkspaceDelegationDynamicToolCall(params = {}, args = {}) {
  const identity = dynamicToolCallIdentity(params);
  if (identity.fullName) return identity.fullName === WORKSPACE_DELEGATION_TOOL_FULL_NAME;
  if (identity.namespace || identity.name) {
    return identity.namespace === WORKSPACE_DELEGATION_TOOL_NAMESPACE && identity.name === WORKSPACE_DELEGATION_TOOL_NAME;
  }
  const references = threadTaskCardTargetReferences(args);
  return Boolean(references.length && (args.title || args.body || args.bodyMarkdown || args.message));
}

function workspaceDelegationDynamicToolCallDiagnostics(request, params = {}, args = {}, extra = {}) {
  const identity = dynamicToolCallIdentity(params);
  const argKeys = Object.keys(args || {})
    .filter((key) => !["body", "bodyMarkdown", "message"].includes(key))
    .sort()
    .slice(0, 30);
  return Object.assign({
    requestId: shortIdentifier(request && request.id),
    tool: truncateToolDescriptionText(identity.fullName || identity.name || "", 160),
    namespace: truncateToolDescriptionText(identity.namespace || "", 80),
    name: truncateToolDescriptionText(identity.name || "", 80),
    isWorkspaceDelegationTool: isWorkspaceDelegationDynamicToolCall(params, args),
    workspaceDelegationEnabled: workspaceDelegationPublicSettings().enabled,
    sourceThreadId: truncateToolDescriptionText(sourceThreadIdFromDynamicToolCall(params, args), 80),
    turnId: truncateToolDescriptionText(params.turnId || params.turn_id || "", 80),
    callId: truncateToolDescriptionText(params.callId || params.call_id || "", 80),
    targetRefCount: threadTaskCardTargetReferences(args).length,
    argKeys,
    hasBody: Boolean(String(args.body || args.bodyMarkdown || args.message || "").trim()),
  }, extra);
}

function logWorkspaceDelegationDynamicToolCall(request, params = {}, args = {}, extra = {}) {
  try {
    console.log(`[workspace-delegation-tool-call] ${JSON.stringify(workspaceDelegationDynamicToolCallDiagnostics(request, params, args, extra))}`);
  } catch (err) {
    console.error(`[workspace-delegation-tool-call] failed to summarize request=${shortIdentifier(request && request.id)}: ${err.message || String(err)}`);
  }
}

function dynamicToolTextResponse(text, options = {}) {
  const success = options && typeof options.success === "boolean" ? options.success : true;
  return {
    result: {
      success,
      contentItems: [
        {
          type: "inputText",
          text: String(text || ""),
        },
      ],
    },
  };
}

function dynamicToolJsonResponse(payload, options = {}) {
  return dynamicToolTextResponse(JSON.stringify(payload, null, 2), options);
}

function sourceThreadIdFromDynamicToolCall(params = {}, args = {}) {
  const fromParams = pushThreadId(params);
  if (fromParams) return fromParams;
  const turnId = String((params && (params.turnId || params.turn_id))
    || (params && params.turn && (params.turn.id || params.turn.turnId || params.turn.turn_id))
    || "").trim();
  const inferred = turnId ? String(latestThreadIdByTurnId.get(turnId) || "") : "";
  if (inferred) return inferred;
  return String(args.sourceThreadId || args.source_thread_id || "").trim();
}

function dynamicToolErrorPayload(code, message, extra = {}) {
  return dynamicToolJsonResponse(Object.assign({
    ok: false,
    error: code,
    message: String(message || code || "dynamic_tool_error"),
  }, extra), { success: false });
}

function workspaceDelegationDynamicToolBody(params = {}, args = {}) {
  const sourceThreadId = sourceThreadIdFromDynamicToolCall(params, args);
  const body = Object.assign({}, args);
  body.sourceThreadId = sourceThreadId;
  body.sourceTurnId = body.sourceTurnId || body.turnId || params.turnId || params.turn_id || "";
  body.requestId = body.requestId || body.request_id || "";
  if (!body.body && body.bodyMarkdown) body.body = body.bodyMarkdown;
  body.direct = true;
  body.autoApprove = true;
  body.pending = false;
  return body;
}

async function dynamicToolServerRequestResponsePayload(request) {
  const params = request && request.params && typeof request.params === "object" ? request.params : {};
  const args = parseDynamicToolArguments(params.arguments || params.input || params.args);
  if (!isWorkspaceDelegationDynamicToolCall(params, args)) {
    const identity = dynamicToolCallIdentity(params);
    logWorkspaceDelegationDynamicToolCall(request, params, args, { outcome: "unsupported_dynamic_tool" });
    return dynamicToolErrorPayload(
      "unsupported_dynamic_tool",
      `Unsupported Codex Mobile dynamic tool: ${identity.fullName || identity.name || "unknown"}`,
    );
  }
  const workspaceDelegation = workspaceDelegationPublicSettings();
  if (!workspaceDelegation.enabled) {
    logWorkspaceDelegationDynamicToolCall(request, params, args, { outcome: "workspace_delegation_tool_disabled" });
    return dynamicToolErrorPayload(
      "workspace_delegation_tool_disabled",
      "Codex Mobile workspace delegation is disabled in Settings.",
      { tool: WORKSPACE_DELEGATION_TOOL_FULL_NAME },
    );
  }
  const body = workspaceDelegationDynamicToolBody(params, args);
  if (!body.sourceThreadId) {
    logWorkspaceDelegationDynamicToolCall(request, params, args, { outcome: "source_thread_id_required" });
    return dynamicToolErrorPayload(
      "source_thread_id_required",
      "Codex Mobile could not infer the source thread id for this tool call.",
      { turnId: params.turnId || params.turn_id || "" },
    );
  }
  if (!threadTaskCardTargetReferences(body).length) {
    logWorkspaceDelegationDynamicToolCall(request, params, args, { outcome: "target_thread_required" });
    return dynamicToolErrorPayload(
      "target_thread_required",
      "A target thread id, exact thread title, or exact target workspace cwd is required.",
    );
  }
  if (!String(body.title || "").trim()) {
    logWorkspaceDelegationDynamicToolCall(request, params, args, { outcome: "task_card_title_required" });
    return dynamicToolErrorPayload("task_card_title_required", "Task-card title is required.");
  }
  if (!String(body.body || body.bodyMarkdown || body.message || "").trim()) {
    logWorkspaceDelegationDynamicToolCall(request, params, args, { outcome: "task_card_body_required" });
    return dynamicToolErrorPayload("task_card_body_required", "Task-card body is required.");
  }
  const result = await createThreadTaskCardsFromSourceThread(body.sourceThreadId, body);
  logWorkspaceDelegationDynamicToolCall(request, params, args, {
    outcome: "ok",
    cardCount: Array.isArray(result.cards) ? result.cards.length : result.card ? 1 : 0,
    targetThreadCount: (result.cards || []).map((card) => card && card.target && card.target.threadId).filter(Boolean).length,
    direct: result.direct,
    autoApprove: result.autoApprove,
  });
  return dynamicToolJsonResponse({
    ok: true,
    tool: WORKSPACE_DELEGATION_TOOL_FULL_NAME,
    sourceThreadId: result.sourceThreadId,
    workspaceDelegationEnabled: result.workspaceDelegationEnabled,
    direct: result.direct,
    autoApprove: result.autoApprove,
    forcedDirect: true,
    cardCount: Array.isArray(result.cards) ? result.cards.length : result.card ? 1 : 0,
    cardIds: (result.cards || []).map((card) => card && card.id).filter(Boolean),
    targetThreadIds: (result.cards || []).map((card) => card && card.target && card.target.threadId).filter(Boolean),
  });
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

function taskCardSourceThreadTitle(sourceThreadId, requestedTitle = "", sourceSummary = null) {
  const id = String(sourceThreadId || "").trim();
  const requested = String(requestedTitle || "").trim();
  if (requested && !isRecoverableThreadListTitle(requested, id)) return requested;
  const title = threadDisplayTitle(hydrateThreadTitleFromSessionIndex(sourceSummary || (id ? { id } : null)));
  return title || id;
}

async function materializeThreadTaskCardDraftsForThread(thread) {
  if (!thread || typeof thread !== "object" || !thread.id || !Array.isArray(thread.turns)) return [];
  const sourceThreadId = String(thread.id || "");
  const sourceWorkspaceId = String(thread.cwd || (readStateDbThread(sourceThreadId) || {}).cwd || "");
  const sourceThreadTitle = taskCardSourceThreadTitle(sourceThreadId, "", thread);
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
  return attachPendingServerRequestsToResult(attachThreadTaskCardsToResult(result));
}

async function prepareThreadDetailResponseResult(result, details = {}) {
  const prepared = applyLocalActiveThreadStatusToResult(
    await prepareThreadTaskCardsToResult(applyLocalActiveThreadStatusToResult(result, details)),
    details,
  );
  return applyLocalActiveThreadStatusToResult(
    finalizeThreadDetailProjectionResult(prepared, details),
    details,
  );
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
    result.thread.mobileOlderTurnsCursor = turnsResult && turnsResult.nextCursor ? turnsResult.nextCursor : null;
    result.thread.mobileNewerTurnsCursor = turnsResult && turnsResult.backwardsCursor ? turnsResult.backwardsCursor : null;
  }
  result.mobileReadWarning = warning || "";
  if (threadLog) {
    threadLog("turns_list_ok", {
      durationMs: Date.now() - startedAtMs,
      returnedTurns: result.thread && Array.isArray(result.thread.turns) ? result.thread.turns.length : null,
      mode,
    });
  }
  return prepareThreadDetailResponseResult(result, { threadId, source: mode });
}

async function readRawThreadDetailForOrchestrator({ threadId, summary, runtimeSettings }) {
  const result = await codex.request("thread/read", { threadId, includeTurns: true }, {
    timeoutMs: READ_RPC_TIMEOUT_MS,
    retry: false,
    resetOnTimeout: false,
  });
  if (result && result.thread) {
    result.thread = applySessionIndexTitleToThread(result.thread, readSessionIndexEntries().get(threadId));
    threadDisplaySummaryCache.remember(result.thread);
    result.thread = mergeThreadRuntimeFromStateDb(result.thread, summary);
    result.thread.runtimeSettings = publicRuntimeSettings(runtimeSettings);
    result.thread.mobileReadMode = "thread-read-raw";
    result.thread.mobileProjectionVersion = "raw";
    result.thread.mobileProjection = {
      source: "thread-read",
      version: "raw",
      projectionDisabled: true,
    };
    result.thread.mobileRawThreadRead = true;
    appendRolloutFinalReceiptsToThread(result.thread);
  }
  return result;
}

async function readFullThreadDetailForOrchestrator({ threadId, summary, runtimeSettings }) {
  const result = compactThreadReadResult(await codex.request("thread/read", { threadId, includeTurns: true }, {
    timeoutMs: READ_RPC_TIMEOUT_MS,
    retry: false,
    resetOnTimeout: false,
  }), { maxTurns: MAX_FULL_THREAD_TURNS });
  if (result.thread) {
    result.thread = applySessionIndexTitleToThread(result.thread, readSessionIndexEntries().get(threadId));
    threadDisplaySummaryCache.remember(result.thread);
    result.thread = mergeThreadRuntimeFromStateDb(result.thread, summary);
    result.thread.runtimeSettings = publicRuntimeSettings(runtimeSettings);
    result.thread.mobileReadMode = "thread-read";
  }
  return result;
}

function fallbackThreadReadResultForOrchestrator({ threadId, summary, runtimeSettings, warning, mode }) {
  return finalizeThreadDetailProjectionResult(
    fallbackThreadReadResult(threadId, summary, runtimeSettings, warning, mode),
    { threadId, source: mode },
  );
}

function filterFallbackThreads(threads, filters = {}) {
  const globalState = filters.globalState || readGlobalState();
  const visibility = visibilityFromGlobalState(globalState);
  const cwdFilter = String(filters.cwd || "").trim();
  const search = String(filters.searchTerm || "").trim().toLowerCase();
  const shouldFilterByWorkspace = anyThreadMatchesVisibleWorkspace(threads, visibility);
  return threads
    .filter((thread) => {
      if (threadHasArchiveSignal(thread) || isSubagentThreadSummary(thread)) return false;
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

function fallbackDisplayText(value, maxLength = 500) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function readSessionIndexEntries(maxLines = 2000) {
  const p = path.join(CODEX_HOME, "session_index.jsonl");
  const byId = new Map();
  try {
    const lines = fs.readFileSync(p, "utf8").split(/\r?\n/).filter(Boolean).slice(-Math.max(1, maxLines));
    for (const line of lines) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch (_) {
        continue;
      }
      const id = String(entry && entry.id || "").trim();
      if (!id) continue;
      byId.set(id, Object.assign({}, entry, {
        id,
        thread_name: fallbackDisplayText(entry.thread_name || entry.name || entry.title),
      }));
    }
  } catch (_) {
    return byId;
  }
  return byId;
}

function hydrateThreadTitleFromSessionIndex(thread, indexEntries = readSessionIndexEntries()) {
  if (!thread || typeof thread !== "object") return thread || null;
  const id = String(thread.id || thread.threadId || "").trim();
  if (!id || !indexEntries || typeof indexEntries.get !== "function") return thread;
  return applySessionIndexTitleToThread(thread, indexEntries.get(id));
}

function persistThreadTitleToSessionIndex(threadId, threadName, updatedAt = new Date()) {
  const id = String(threadId || "").trim();
  const name = fallbackDisplayText(threadName, 120);
  if (!id || !name) return false;
  const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt || Date.now());
  const timestamp = Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
  const p = path.join(CODEX_HOME, "session_index.jsonl");
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, `${JSON.stringify({ id, thread_name: name, updated_at: timestamp })}\n`, "utf8");
    upsertThreadListFallbackCacheThread({
      id,
      name,
      preview: name,
      updatedAt: Math.floor(date.getTime() / 1000),
    }, { addIfMissing: false });
    return true;
  } catch (_) {
    return false;
  }
}

function readRolloutHead(rolloutPath, maxBytes = 128 * 1024) {
  if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) return "";
  let fd = null;
  try {
    const stat = fs.statSync(rolloutPath);
    if (!stat.isFile() || stat.size <= 0) return "";
    const bytesToRead = Math.min(Math.max(4096, maxBytes), stat.size);
    const buffer = Buffer.alloc(bytesToRead);
    fd = fs.openSync(rolloutPath, "r");
    const bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
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

const ROLLOUT_TERMINAL_EVENT_TYPES = new Set([
  "task_complete",
  "task_completed",
  "task_failed",
  "task_interrupted",
  "task_cancelled",
  "task_canceled",
  "turn_completed",
  "turn_failed",
  "turn_interrupted",
  "turn_cancelled",
  "turn_canceled",
]);

const ROLLOUT_ACTIVITY_EVENT_TYPES = new Set([
  "task_started",
  "user_message",
  "agent_message",
  "agent_reasoning",
  "exec_command_begin",
  "exec_command_end",
  "patch_apply_begin",
  "patch_apply_end",
  "web_search_begin",
  "web_search_end",
]);

function rolloutEntryPayloadType(entry) {
  const payload = entry && entry.payload && typeof entry.payload === "object" ? entry.payload : {};
  return String(payload.type || "");
}

function isRolloutTerminalEntry(entry) {
  return entry && entry.type === "event_msg" && ROLLOUT_TERMINAL_EVENT_TYPES.has(rolloutEntryPayloadType(entry));
}

function isRolloutActivityEntry(entry) {
  if (!entry || !entry.type) return false;
  if (entry.type === "response_item") return true;
  if (entry.type === "turn_context") return true;
  return entry.type === "event_msg" && ROLLOUT_ACTIVITY_EVENT_TYPES.has(rolloutEntryPayloadType(entry));
}

function rolloutContentText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(rolloutContentText).filter(Boolean).join("\n");
  if (typeof value !== "object") return "";
  const parts = [];
  for (const key of ["text", "input_text", "message", "summary"]) {
    if (typeof value[key] === "string") parts.push(value[key]);
  }
  if (typeof value.content === "string") {
    parts.push(value.content);
  } else if (value.content && typeof value.content === "object") {
    parts.push(rolloutContentText(value.content));
  }
  return parts.filter(Boolean).join("\n");
}

function rolloutMessageText(payload) {
  if (!payload || typeof payload !== "object") return "";
  return rolloutContentText(payload.content || payload.message || payload.text || payload.input || payload.input_text);
}

function rolloutContentHasNonTextInput(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.some(rolloutContentHasNonTextInput);
  if (typeof value !== "object") return false;
  const type = String(value.type || "").toLowerCase();
  if (/^(input_)?(image|file|audio|video)|localimage|localfile|image_url|input_image$/.test(type)) return true;
  if (value.image_url || value.imageUrl || value.file_id || value.fileId || value.path || value.url) return true;
  return rolloutContentHasNonTextInput(value.content || value.message || value.input || null);
}

function rolloutMessageHasNonTextInput(payload) {
  if (!payload || typeof payload !== "object") return false;
  return rolloutContentHasNonTextInput(payload.content || payload.message || payload.input || payload.attachments || payload.files || payload.images);
}

function isEnvironmentContextOnlyText(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (!/^<environment_context\b[\s\S]*<\/environment_context>$/.test(text)) return false;
  return text.replace(/<environment_context\b[\s\S]*<\/environment_context>/g, "").trim() === "";
}

function createRolloutTurnEvidence(turnId, timestampMs = 0) {
  return {
    turnId: String(turnId || ""),
    startedAtMs: timestampMs || 0,
    lastActivityMs: timestampMs || 0,
    hasContext: false,
    hasVisibleUser: false,
    hasAssistant: false,
    hasOperation: false,
    hasTerminal: false,
  };
}

function rolloutLatestTurnEvidence(rolloutPath, stat = null) {
  const tail = readRolloutTail(rolloutPath);
  if (!tail) return null;
  const byTurn = new Map();
  let currentTurnId = "";
  let latest = null;
  const ensureTurn = (turnId, timestampMs = 0) => {
    const id = String(turnId || "").trim();
    if (!id) return null;
    if (!byTurn.has(id)) byTurn.set(id, createRolloutTurnEvidence(id, timestampMs));
    const evidence = byTurn.get(id);
    if (timestampMs) {
      evidence.lastActivityMs = Math.max(evidence.lastActivityMs || 0, timestampMs);
      if (!evidence.startedAtMs) evidence.startedAtMs = timestampMs;
    }
    if (!latest
      || (evidence.startedAtMs || 0) > (latest.startedAtMs || 0)
      || (evidence.lastActivityMs || 0) > (latest.lastActivityMs || 0)) {
      latest = evidence;
    }
    return evidence;
  };

  for (const line of tail.split(/\r?\n/)) {
    if (!line || !line.trim()) continue;
    const entry = parseJsonLine(line);
    if (!entry || !entry.type) continue;
    const payload = entry.payload && typeof entry.payload === "object" ? entry.payload : {};
    const timestampMs = rolloutEntryTimestampMs(entry);
    const eventType = entry.type === "event_msg" ? String(payload.type || "") : "";
    const explicitTurnId = rolloutEntryTurnId(entry);
    if (entry.type === "event_msg" && eventType === "task_started" && explicitTurnId) {
      currentTurnId = explicitTurnId;
      ensureTurn(explicitTurnId, timestampMs);
      continue;
    }
    const turnId = explicitTurnId || currentTurnId;
    const evidence = ensureTurn(turnId, timestampMs);
    if (!evidence) continue;
    if (isRolloutTerminalEntry(entry)) {
      evidence.hasTerminal = true;
      continue;
    }
    if (entry.type === "turn_context") {
      evidence.hasContext = true;
      continue;
    }
    if (entry.type === "response_item") {
      const type = String(payload.type || "");
      if (type === "message") {
        const role = String(payload.role || payload.author || "").toLowerCase();
        if (role === "user") {
          const text = rolloutMessageText(payload);
          if (isEnvironmentContextOnlyText(text)) evidence.hasContext = true;
          else if (String(text || "").trim()) evidence.hasVisibleUser = true;
          else if (rolloutMessageHasNonTextInput(payload)) evidence.hasVisibleUser = true;
        } else if (role === "assistant") {
          evidence.hasAssistant = true;
        } else {
          evidence.hasOperation = true;
        }
      } else if (type === "reasoning") {
        evidence.hasAssistant = true;
      } else if (/^(function_call|custom_tool_call|web_search_call|function_call_output|custom_tool_call_output)$/.test(type)) {
        evidence.hasOperation = true;
      }
      continue;
    }
    if (entry.type === "event_msg") {
      if (eventType === "user_message") {
        const text = rolloutMessageText(payload);
        if (isEnvironmentContextOnlyText(text)) evidence.hasContext = true;
        else if (String(text || "").trim()) evidence.hasVisibleUser = true;
        else if (rolloutMessageHasNonTextInput(payload)) evidence.hasVisibleUser = true;
      } else if (eventType === "agent_message" || eventType === "agent_reasoning") {
        evidence.hasAssistant = true;
      } else if (/^(exec_command|patch_apply|web_search)_/.test(eventType)) {
        evidence.hasOperation = true;
      }
    }
  }

  if (!latest) return null;
  const mtimeMs = Number(stat && stat.mtimeMs || 0);
  latest.lastActivityMs = Math.max(latest.lastActivityMs || 0, mtimeMs || 0);
  return latest;
}

function staleContextOnlyActiveEvidenceForRollout(rolloutPath, options = {}) {
  if (!rolloutPath) return null;
  let stat = options.stat || null;
  if (!stat) {
    try {
      stat = fs.statSync(rolloutPath);
    } catch (_) {
      return null;
    }
  }
  const evidence = rolloutLatestTurnEvidence(rolloutPath, stat);
  if (!evidence || evidence.hasTerminal || evidence.hasVisibleUser || evidence.hasAssistant || evidence.hasOperation) {
    return null;
  }
  const nowMs = Number(options.nowMs || Date.now());
  const quietMs = nowMs - Number(evidence.lastActivityMs || 0);
  if (!Number.isFinite(quietMs) || quietMs < STALE_CONTEXT_ONLY_ACTIVE_TURN_MS) return null;
  return Object.assign({}, evidence, {
    quietMs,
    thresholdMs: STALE_CONTEXT_ONLY_ACTIVE_TURN_MS,
  });
}

function staleContextOnlyActiveStatus(previousStatus, evidence) {
  const previousType = statusText(previousStatus);
  return {
    type: "idle",
    mobileStaleActiveTurn: true,
    previousType: previousType || "active",
    reason: "context-only-active-turn",
    turnId: evidence && evidence.turnId || "",
    quietMs: Math.max(0, Math.trunc(Number(evidence && evidence.quietMs) || 0)),
    thresholdMs: STALE_CONTEXT_ONLY_ACTIVE_TURN_MS,
  };
}

function normalizeStaleContextOnlyActiveThread(thread, options = {}) {
  if (!thread || typeof thread !== "object") return thread;
  const turns = Array.isArray(thread.turns) ? thread.turns : [];
  const latest = turns.length ? turns[turns.length - 1] : null;
  if (!isThreadListLiveStatus(thread.status) && !isLiveTurn(latest)) return thread;
  let rolloutPath = rolloutPathForThread(thread);
  if (!rolloutPath && thread.id) {
    const stateThread = readStateDbThread(thread.id);
    rolloutPath = rolloutPathForThread(stateThread);
  }
  const evidence = staleContextOnlyActiveEvidenceForRollout(rolloutPath, options);
  if (!evidence) return thread;
  const latestTurnId = String(latest && (latest.id || latest.turnId) || "").trim();
  if (latestTurnId && evidence.turnId && latestTurnId !== evidence.turnId) return thread;
  const out = Object.assign({}, thread, {
    status: staleContextOnlyActiveStatus(thread.status, evidence),
    mobileStaleActiveTurn: {
      turnId: evidence.turnId || "",
      reason: "context-only-active-turn",
      quietMs: Math.max(0, Math.trunc(Number(evidence.quietMs) || 0)),
      thresholdMs: STALE_CONTEXT_ONLY_ACTIVE_TURN_MS,
    },
  });
  if (turns.length && latest && isLiveTurn(latest)) {
    const itemCount = Array.isArray(latest.items) ? latest.items.length : 0;
    if (itemCount === 0) {
      out.turns = turns.slice(0, -1);
      out.mobileDroppedStaleActiveTurn = evidence.turnId || latestTurnId || true;
    }
  }
  return out;
}

function inferRolloutFallbackStatus(rolloutPath, stat = null, nowMs = Date.now()) {
  if (!rolloutPath) return null;
  const mtimeMs = Number(stat && stat.mtimeMs || 0);
  const tail = readRolloutTail(rolloutPath);
  if (!tail) return null;
  const staleContextOnlyActive = staleContextOnlyActiveEvidenceForRollout(rolloutPath, { stat, nowMs });
  if (staleContextOnlyActive) return staleContextOnlyActiveStatus({ type: "active" }, staleContextOnlyActive);
  let lastActivityMs = 0;
  let lastTerminalMs = 0;
  for (const line of tail.split(/\r?\n/)) {
    if (!line || !line.trim()) continue;
    const entry = parseJsonLine(line);
    if (!entry || !entry.type) continue;
    const timestampMs = timestampToMs(entry.timestamp || (entry.payload && entry.payload.timestamp));
    if (!timestampMs) continue;
    if (isRolloutTerminalEntry(entry)) {
      lastTerminalMs = Math.max(lastTerminalMs, timestampMs);
      continue;
    }
    if (isRolloutActivityEntry(entry)) lastActivityMs = Math.max(lastActivityMs, timestampMs);
  }
  if (lastTerminalMs && lastTerminalMs >= lastActivityMs) return { type: "completed" };
  const recentActivityMs = lastActivityMs > lastTerminalMs ? Math.max(lastActivityMs, mtimeMs) : 0;
  if (recentActivityMs && nowMs - recentActivityMs <= ROLLOUT_ACTIVE_STATUS_WINDOW_MS) {
    return { type: "active" };
  }
  return null;
}

function rolloutEntryCwd(entry) {
  if (!entry || typeof entry !== "object") return "";
  const payload = entry.payload && typeof entry.payload === "object" ? entry.payload : {};
  return String(entry.cwd || payload.cwd || payload.workspace || payload.workspaceRoot || "").trim();
}

function rolloutEntryTimestampMs(entry) {
  if (!entry || typeof entry !== "object") return 0;
  const payload = entry.payload && typeof entry.payload === "object" ? entry.payload : {};
  return timestampToMs(entry.timestamp || payload.timestamp || payload.created_at || payload.updated_at);
}

function readRolloutSessionFallbackThreadFromFile(file, indexEntry = {}) {
  const rolloutPath = typeof file === "string" ? file : file && file.path;
  const id = threadIdFromRolloutPath(rolloutPath) || String(indexEntry.id || "").trim();
  if (!id || !rolloutPath || isBackupRolloutPath(rolloutPath)) return null;
  let stat = null;
  try {
    stat = fs.statSync(rolloutPath);
  } catch (_) {
    return null;
  }
  if (!stat.isFile()) return null;

  let cwd = "";
  let timestampMs = 0;
  let model = "";
  let agentNickname = "";
  let agentRole = "";
  const lines = readRolloutHead(rolloutPath).split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (_) {
      continue;
    }
    const payload = entry.payload && typeof entry.payload === "object" ? entry.payload : {};
    if (!cwd) cwd = rolloutEntryCwd(entry);
    timestampMs = Math.max(timestampMs, rolloutEntryTimestampMs(entry));
    if (!model && payload.model) model = String(payload.model || "");
    if (!model && payload.model_provider) model = String(payload.model_provider || "");
    if (!agentNickname && (payload.agent_nickname || payload.agentNickname)) {
      agentNickname = String(payload.agent_nickname || payload.agentNickname || "");
    }
    if (!agentRole && (payload.agent_role || payload.agentRole)) {
      agentRole = String(payload.agent_role || payload.agentRole || "");
    }
    if (cwd && timestampMs && (agentNickname || agentRole || entry.type !== "session_meta")) break;
  }

  const updatedMs = Math.max(
    timestampToMs(indexEntry.updated_at || indexEntry.updatedAt),
    timestampMs,
    Number(stat.mtimeMs || 0),
  );
  return rowToFallbackThread({
    id,
    thread_name: fallbackDisplayText(indexEntry.thread_name || indexEntry.name || indexEntry.title),
    cwd,
    rollout_path: rolloutPath,
    archived: false,
    archived_at: null,
    updatedAt: Math.floor(updatedMs / 1000),
    model,
    agent_nickname: agentNickname,
    agent_role: agentRole,
    status: inferRolloutFallbackStatus(rolloutPath, stat) || undefined,
  });
}

function readRolloutSessionFallback(limit = 80, filters = {}) {
  const rowLimit = Math.min(1000, Math.max(limit * 8, 200));
  const indexEntries = readSessionIndexEntries(Math.max(rowLimit * 2, 2000));
  const archivedIds = archivedSessionThreadIds();
  const threads = [];
  const seen = new Set();
  for (const file of collectRecentRolloutFiles(SESSIONS_DIR, { maxFiles: rowLimit, maxDepth: 6 })) {
    const id = threadIdFromRolloutPath(file && file.path);
    if (!id || seen.has(id) || archivedIds.has(id)) continue;
    seen.add(id);
    const thread = readRolloutSessionFallbackThreadFromFile(file, indexEntries.get(id) || { id });
    if (thread) threads.push(thread);
  }
  return filterFallbackThreads(threads, filters).slice(0, limit);
}

function readRolloutSessionFallbackThread(threadId) {
  const id = String(threadId || "").trim();
  if (!id) return null;
  const indexEntries = readSessionIndexEntries();
  const archivedIds = archivedSessionThreadIds();
  if (archivedIds.has(id)) return null;
  for (const file of collectRecentRolloutFiles(SESSIONS_DIR, { maxFiles: 1000, maxDepth: 6 })) {
    if (threadIdFromRolloutPath(file && file.path) !== id) continue;
    return readRolloutSessionFallbackThreadFromFile(file, indexEntries.get(id) || { id });
  }
  return null;
}

function readSessionIndexFallback(limit = 80, filters = {}) {
  try {
    const globalState = filters.globalState || readGlobalState();
    const projectlessThreadIds = visibleProjectlessThreadIds(globalState);
    if (filters.cwd || projectlessThreadIds.size === 0) return [];
    const archivedIds = archivedSessionThreadIds();
    const byId = new Map();
    for (const entry of readSessionIndexEntries(1000).values()) {
      if (!entry.id || !projectlessThreadIds.has(entry.id)) continue;
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

const threadListFallbackCacheService = createThreadListFallbackCacheService({
  ttlMs: THREAD_LIST_FALLBACK_CACHE_TTL_MS,
  maxEntries: 12,
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

function readThreadListFallback(limit = 80, filters = {}) {
  return threadListFallbackCacheService.readFallback(limit, filters);
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
    await codex.refreshRateLimitsIfMissing();
    loadRecentRateLimitsFromRollouts();
    const buildConfig = currentPublicBuildConfig();
    const workspaceDelegation = workspaceDelegationPublicSettings();
    const activeQuota = liveQuotaSnapshotForProfiles();
    syncKnownCodexMobileMcpToolsets({ activeQuota });
    sendJson(res, 200, {
      authRequired: !DISABLE_AUTH,
      title: "Codex Mobile Web",
      version: APP_VERSION,
      platform: process.platform,
      workspacePath: APP_ROOT,
      buildId: buildConfig.buildId,
      clientBuildId: buildConfig.clientBuildId,
      shellCacheName: buildConfig.shellCacheName,
      maxUploadBytes: MAX_UPLOAD_BYTES,
      maxUploadFiles: MAX_UPLOAD_FILES,
      imageContextMode: IMAGE_CONTEXT_POLICY.imageContextMode,
      rolloutWarningBytes: ROLLOUT_WARNING_BYTES,
      modelOptions: MODEL_OPTIONS,
      reasoningEffortOptions: REASONING_EFFORT_OPTIONS,
      permissionModeOptions: PERMISSION_MODE_OPTIONS,
      defaultModel: CODEX_CONFIG_DEFAULTS.model || DEFAULT_MODEL,
      defaultReasoningEffort: CODEX_CONFIG_DEFAULTS.reasoningEffort,
      defaultPermissionMode: defaultPermissionModeFromConfigDefaults(),
      rateLimits: activeRateLimits(),
      rateLimitsByModel: rateLimitsByModelObject(),
      codexProfiles: codexProfileService.profiles({
        activeQuota,
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
      workspaceDelegation,
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
  if (url.pathname === "/api/chatgpt-pro/mcp" && (req.method === "POST" || req.method === "GET")) {
    if (!chatGptProMcpService.isConfigured()) {
      sendJson(res, 503, { ok: false, error: "ChatGPT Pro MCP connector is not configured" });
      return;
    }
    if (!chatGptProMcpService.isAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized ChatGPT Pro MCP connector request" });
      return;
    }
    if (req.method === "GET") {
      sendJson(res, 200, chatGptProMcpService.status());
      return;
    }
    try {
      const body = await readBody(req);
      const reply = await chatGptProMcpService.handleJsonRpc(body);
      if (reply === null) {
        res.writeHead(204, { "Cache-Control": "no-store" });
        res.end();
        return;
      }
      sendJson(res, 200, reply);
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  if (url.pathname === "/api/codex-profiles" && req.method === "GET") {
    const activeQuota = liveQuotaSnapshotForProfiles();
    syncKnownCodexMobileMcpToolsets({ activeQuota });
    sendJson(res, 200, codexProfileService.profiles({
      activeQuota,
    }));
    return;
  }
  if (url.pathname === "/api/codex-profiles/switch-progress" && req.method === "GET") {
    const requestId = String(url.searchParams.get("requestId") || "").trim();
    const progress = getProfileSwitchProgress(requestId);
    if (!progress) {
      sendJson(res, 404, { ok: false, error: "Profile switch progress not found" });
      return;
    }
    sendJson(res, 200, { ok: true, progress });
    return;
  }
  if (url.pathname === "/api/codex-profiles/active" && req.method === "POST") {
    let requestId = "";
    try {
      const body = await readBody(req);
      requestId = profileSwitchProgressRequestId(body.requestId);
      const targetProfileId = String(body.profileId || body.id || "").trim().toLowerCase();
      setProfileSwitchProgress(requestId, {
        targetProfileId,
        status: "running",
        stage: "profile_lookup",
        message: "正在读取目标 Profile...",
        stepIndex: 1,
        stepCount: 10,
      });
      const availableProfiles = codexProfileService.profiles({
        activeQuota: liveQuotaSnapshotForProfiles(),
      });
      if (!availableProfiles.switchSupported) {
        throw httpStatusError(409, "Codex profile switching requires the default per-profile mux endpoint configuration.");
      }
      const targetProfile = availableProfiles.profiles.find((item) => item.id === targetProfileId);
      if (!targetProfile) {
        throw httpStatusError(404, "Unknown Codex profile");
      }
      setProfileSwitchProgress(requestId, {
        targetProfileId: targetProfile.id,
        targetProfileLabel: targetProfile.label || targetProfile.id,
        stage: "workspace_trust",
        message: "正在同步目标账号的工作区信任...",
        stepIndex: 2,
      });
      syncRegisteredWorkspaceTrust(targetProfile.codexHome);
      setProfileSwitchProgress(requestId, {
        targetProfileId: targetProfile.id,
        targetProfileLabel: targetProfile.label || targetProfile.id,
        stage: "mcp_toolset",
        message: "正在注册 Codex Mobile 工具...",
        stepIndex: 3,
      });
      syncCodexMobileMcpToolset(targetProfile.codexHome);
      const preflight = await preflightCodexProfileSwitch(targetProfile, {
        onProgress: (patch) => setProfileSwitchProgress(requestId, Object.assign({
          targetProfileId: targetProfile.id,
          targetProfileLabel: targetProfile.label || targetProfile.id,
          status: "running",
        }, patch || {})),
      });
      setProfileSwitchProgress(requestId, {
        targetProfileId: targetProfile.id,
        targetProfileLabel: targetProfile.label || targetProfile.id,
        stage: "write_active_profile",
        message: "正在写入 active Profile 配置...",
        stepIndex: 9,
      });
      const profile = codexProfileService.setActiveProfile(targetProfile.id);
      setProfileSwitchProgress(requestId, {
        targetProfileId: profile.id,
        targetProfileLabel: profile.label || profile.id,
        stage: "schedule_restart",
        message: "正在安排 Mobile Web 重启...",
        stepIndex: 10,
      });
      const restart = sharedChainRestartService.restart(Object.assign({
        delayMs: SHARED_CHAIN_RESTART_DELAY_MS,
      }, activeProfileRestartOptions(profile)));
      const progress = setProfileSwitchProgress(requestId, {
        targetProfileId: profile.id,
        targetProfileLabel: profile.label || profile.id,
        status: "restarting",
        stage: "waiting_for_restart",
        message: "切换已写入，正在等待服务恢复...",
        stepIndex: 10,
        restarting: true,
      });
      sendJson(res, 202, Object.assign({ ok: true, requestId, activeProfileId: profile.id, profile, preflight, progress }, restart));
    } catch (err) {
      if (requestId) {
        const previousProgress = getProfileSwitchProgress(requestId);
        const failedProgress = setProfileSwitchProgress(requestId, {
          status: "failed",
          stage: "failed",
          message: `切换失败：${err.message || "Profile 切换失败"}`,
          error: err.message || String(err),
          code: err.code || undefined,
          detail: err.detail || undefined,
          failedStage: previousProgress && previousProgress.stage !== "failed" ? previousProgress.stage : undefined,
          stepIndex: previousProgress && previousProgress.stepIndex ? previousProgress.stepIndex : undefined,
        });
        console.error(`[codex-profile-switch] failed ${JSON.stringify({
          requestId,
          targetProfileId: failedProgress.targetProfileId || undefined,
          stage: failedProgress.stage,
          failedStage: previousProgress && previousProgress.stage || undefined,
          code: failedProgress.code || undefined,
          detail: profileSwitchLogDetail(failedProgress.detail || failedProgress.error),
        })}`);
      }
      sendJson(res, err.statusCode || 500, {
        ok: false,
        error: err.message || String(err),
        code: err.code || undefined,
        detail: err.detail || undefined,
        requestId: requestId || undefined,
        progress: requestId ? getProfileSwitchProgress(requestId) || undefined : undefined,
      });
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
  if (url.pathname === "/api/settings/workspace-delegation" && (req.method === "GET" || req.method === "POST")) {
    try {
      if (req.method === "GET") {
        sendJson(res, 200, { ok: true, workspaceDelegation: workspaceDelegationPublicSettings() });
        return;
      }
      const body = await readBody(req);
      if (typeof body.enabled !== "boolean") throw httpStatusError(400, "enabled_boolean_required");
      sendJson(res, 200, {
        ok: true,
        workspaceDelegation: setWorkspaceDelegationEnabled(body.enabled),
      });
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  if (url.pathname === "/api/v1/hermes/plugin/session" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const session = hermesPluginService.createSession(Object.assign({}, body, {
        token: body.codexPluginLaunch || body.pluginLaunch || body.launchToken || body.token || requestAuthToken(req),
      }));
      const cookie = pluginSessionCookieHeader(req, session);
      sendJson(res, 200, session, cookie ? { "Set-Cookie": cookie } : {});
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
  if (url.pathname === "/api/link-previews/github" && req.method === "GET") {
    const force = /^(1|true|yes|on)$/i.test(url.searchParams.get("force") || "");
    const previewUrl = String(url.searchParams.get("url") || "").trim();
    if (!previewUrl) {
      sendJson(res, 400, { supported: false, provider: "github", reason: "url is required", preview: null });
      return;
    }
    sendJson(res, 200, await refreshGitHubLinkPreview(previewUrl, { force }));
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
    await codex.refreshRateLimitsIfMissing();
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
      const authorities = filePreviewAuthoritiesForThread(threadId, readGlobalState(), { requestedPath });
      sendJson(res, 200, readFilePreview(requestedPath, authorities, { threadId }));
    } catch (err) {
      sendJson(res, err.statusCode || 500, { error: err.message || String(err) });
    }
    return;
  }
  if (url.pathname === "/api/files/preview/content" && req.method === "GET") {
    const requestedPath = url.searchParams.get("path") || "";
    const threadId = url.searchParams.get("threadId") || "";
    try {
      const authorities = filePreviewAuthoritiesForThread(threadId, readGlobalState(), { requestedPath });
      serveFilePreviewContent(req, res, requestedPath, authorities);
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
  // GET /api/threads/:threadId/side-chat
  const threadSideChatRoot = url.pathname.match(/^\/api\/threads\/([^/]+)\/side-chat$/);
  if (threadSideChatRoot && req.method === "GET") {
    try {
      const threadSideChatId = decodeURIComponent(threadSideChatRoot[1]);
      sendJson(res, 200, {
        ok: true,
        sideChat: threadSideChatService.get(threadSideChatId),
      });
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  if (threadSideChatRoot && req.method === "PUT") {
    try {
      const threadSideChatId = decodeURIComponent(threadSideChatRoot[1]);
      const body = await readBody(req);
      sendJson(res, 200, {
        ok: true,
        sideChat: await threadSideChatService.updateDraft(threadSideChatId, body),
      });
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  const threadSideChatDraft = url.pathname.match(/^\/api\/threads\/([^/]+)\/side-chat\/draft$/);
  if (threadSideChatDraft && req.method === "PUT") {
    try {
      const threadSideChatId = decodeURIComponent(threadSideChatDraft[1]);
      const body = await readBody(req);
      sendJson(res, 200, {
        ok: true,
        sideChat: await threadSideChatService.updateDraft(threadSideChatId, body),
      });
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  const threadSideChatMessages = url.pathname.match(/^\/api\/threads\/([^/]+)\/side-chat\/messages$/);
  if (threadSideChatMessages && req.method === "POST") {
    try {
      const threadSideChatId = decodeURIComponent(threadSideChatMessages[1]);
      const body = await readBody(req);
      const result = await threadSideChatService.addMessage(threadSideChatId, body);
      if (result && result.message && result.message.role === "user" && !result.duplicate) {
        await threadSideChatService.markAssistantPending(threadSideChatId, result.message.id);
        startSideChatAssistantReply(threadSideChatId, result.message);
        sendJson(res, 200, Object.assign({ ok: true }, { state: threadSideChatService.get(threadSideChatId), message: result.message }));
      } else {
        sendJson(res, 200, Object.assign({ ok: true }, result));
      }
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  const threadSideChatCandidates = url.pathname.match(/^\/api\/threads\/([^/]+)\/side-chat\/candidates$/);
  if (threadSideChatCandidates && req.method === "POST") {
    try {
      const threadSideChatId = decodeURIComponent(threadSideChatCandidates[1]);
      const body = await readBody(req);
      sendJson(res, 200, Object.assign({ ok: true }, await threadSideChatService.createCandidate(threadSideChatId, body)));
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  const threadSideChatQueue = url.pathname.match(/^\/api\/threads\/([^/]+)\/side-chat\/candidates\/([^/]+)\/queue$/);
  if (threadSideChatQueue && req.method === "POST") {
    try {
      const threadSideChatId = decodeURIComponent(threadSideChatQueue[1]);
      const candidateId = decodeURIComponent(threadSideChatQueue[2]);
      const body = await readBody(req);
      sendJson(res, 200, Object.assign({ ok: true }, await threadSideChatService.queueCandidate(threadSideChatId, candidateId, body)));
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  const threadSideChatApply = url.pathname.match(/^\/api\/threads\/([^/]+)\/side-chat\/candidates\/([^/]+)\/apply$/);
  if (threadSideChatApply && req.method === "POST") {
    try {
      const threadSideChatId = decodeURIComponent(threadSideChatApply[1]);
      const candidateId = decodeURIComponent(threadSideChatApply[2]);
      const body = await readBody(req);
      sendJson(res, 200, Object.assign({ ok: true }, await threadSideChatService.applyCandidate(threadSideChatId, candidateId, body)));
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  const threadSideChatCancel = url.pathname.match(/^\/api\/threads\/([^/]+)\/side-chat\/candidates\/([^/]+)\/cancel$/);
  if (threadSideChatCancel && req.method === "POST") {
    try {
      const threadSideChatId = decodeURIComponent(threadSideChatCancel[1]);
      const candidateId = decodeURIComponent(threadSideChatCancel[2]);
      sendJson(res, 200, Object.assign({ ok: true }, await threadSideChatService.cancelCandidate(threadSideChatId, candidateId)));
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  const threadSideChatClear = url.pathname.match(/^\/api\/threads\/([^/]+)\/side-chat\/clear$/);
  if (threadSideChatClear && req.method === "POST") {
    try {
      const threadSideChatId = decodeURIComponent(threadSideChatClear[1]);
      sendJson(res, 200, {
        ok: true,
        sideChat: await threadSideChatService.clear(threadSideChatId),
      });
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  const sourceThreadWorkspaceDelegation = url.pathname.match(/^\/api\/threads\/([^/]+)\/workspace-delegation$/);
  if (sourceThreadWorkspaceDelegation && req.method === "POST") {
    try {
      const workspaceDelegation = workspaceDelegationPublicSettings();
      sendJson(res, 200, {
        ok: true,
        enabled: workspaceDelegation.enabled,
        delegated: false,
        disabled: true,
        analysis: {
          shouldDelegate: false,
          reason: workspaceDelegation.enabled
            ? "model_driven_delegation_requires_explicit_task_card"
            : "workspace_delegation_disabled",
        },
      });
    } catch (err) {
      sendJson(res, err.statusCode || 500, { ok: false, error: err.message || String(err) });
    }
    return;
  }
  const sourceThreadTaskCardCreate = url.pathname.match(/^\/api\/threads\/([^/]+)\/task-cards$/);
  if (sourceThreadTaskCardCreate && req.method === "POST") {
    try {
      const sourceThreadId = decodeURIComponent(sourceThreadTaskCardCreate[1]);
      const body = await readBody(req);
      sendJson(res, 200, await createThreadTaskCardsFromSourceThread(sourceThreadId, body));
    } catch (err) {
      sendJson(res, err.statusCode || 500, {
        ok: false,
        error: err.message || String(err),
        code: err.code || err.message || String(err),
        details: err.details || undefined,
      });
    }
    return;
  }
  if (url.pathname === "/api/thread-task-cards" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const sourceSummary = hydrateThreadTitleFromSessionIndex(readStateDbThread(body.sourceThreadId) || readStartedThread(body.sourceThreadId) || (body.sourceThreadId ? { id: body.sourceThreadId } : null));
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
        sourceThreadTitle: taskCardSourceThreadTitle(body.sourceThreadId, body.sourceThreadTitle, sourceSummary),
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
      const actorSummary = hydrateThreadTitleFromSessionIndex(readStateDbThread(actorThreadId) || readStartedThread(actorThreadId) || (actorThreadId ? { id: actorThreadId } : null));
      sendJson(res, 200, Object.assign({ ok: true }, await threadTaskCardService.reply(cardId, actorThreadId, Object.assign({}, body, {
        sourceWorkspaceId: body.sourceWorkspaceId || (actorSummary && actorSummary.cwd) || "",
        sourceThreadId: body.sourceThreadId || actorThreadId,
        sourceThreadTitle: taskCardSourceThreadTitle(actorThreadId, body.sourceThreadTitle, actorSummary),
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
    const requestedTitle = truncateSingleLine(String(body.title || body.name || "").trim(), 120);
    const input = buildTurnInput(text, uploads);
    const persistExtendedHistory = persistExtendedHistoryForUploads(uploads);
    if (!input.length) {
      sendJson(res, 400, { error: "Message text or attachment is required" });
      return;
    }
    const globalState = readGlobalState();
    const visibility = visibilityFromGlobalState(globalState);
    if (cwd && visibility.workspaceKeys.size > 0 && !visibility.workspaceKeys.has(normalizeFsPath(cwd))) {
      sendJson(res, 403, { error: "Workspace is not visible in Codex Desktop" });
      return;
    }
    const submissionKeys = messageSubmissionKeys("new-thread", body, text, uploads);
    try {
      const result = await runMessageSubmissionOnce(submissionKeys, uploads, async () => {
        const runtimeSettings = applyPermissionModeOverride({}, body.permissionMode, cwd);
        const startParamsBase = {
          modelProvider: null,
          config: {},
          developerInstructions: readStartThreadDeveloperInstructions(cwd) || "",
          personality: null,
          ephemeral: null,
          dynamicTools: null,
          mockExperimentalField: null,
          experimentalRawEvents: false,
          persistExtendedHistory,
        };
        if (cwd) startParamsBase.cwd = cwd;
        const startParams = applyStartThreadRuntimeSettings(startParamsBase, runtimeSettings);
        if (requestedModel) startParams.model = requestedModel;
        const startResult = await codex.request("thread/start", startParams, {
          timeoutMs: MUTATION_RPC_TIMEOUT_MS,
          retry: false,
        });
        const threadId = threadIdFromStartResult(startResult);
        if (!threadId) throw new Error("New thread creation failed: app-server did not return threadId");
        const projectlessThreadRegistered = cwd ? false : rememberProjectlessThreadId(threadId);
        let titleUpdated = false;
        let titleIndexed = false;
        let titleWarning = "";
        if (requestedTitle) {
          titleIndexed = persistThreadTitleToSessionIndex(threadId, requestedTitle);
          try {
            titleUpdated = await tryUpdateThreadTitle(threadId, requestedTitle);
          } catch (err) {
            titleWarning = `Thread title update failed: ${String(err && err.message || err).slice(0, 240)}`;
          }
        }
        const turnParams = applyCodexFastServiceTier(applyTurnRuntimeSettings({
          threadId,
          input,
          ...(cwd ? { cwd } : {}),
        }, runtimeSettings), requestedFastMode);
        if (requestedModel) turnParams.model = requestedModel;
        if (requestedEffort) turnParams.effort = requestedEffort;
        const turnResult = await codex.request("turn/start", turnParams, {
          timeoutMs: MUTATION_RPC_TIMEOUT_MS,
          retry: false,
        });
        const turnId = notifyLocalTurnStarted(threadId, turnResult, { source: "new-thread-message" });
        rememberThreadIdForTurnId(threadId, turnId);
        const startedThread = (startResult && startResult.thread) || (startResult && startResult.data && startResult.data.thread) || {};
        const thread = rememberStartedThread(Object.assign(
          {},
          startedThread,
          {
            id: threadId,
            name: requestedTitle || undefined,
            preview: requestedTitle || text || (cwd ? path.basename(cwd) : "") || "新建对话",
            cwd: cwd || startedThread.cwd || "",
            status: { type: "active" },
            turns: [],
          },
        ));
        return {
          ok: true,
          threadId,
          thread,
          title: requestedTitle,
          titleUpdated,
          titleIndexed,
          titleWarning,
          projectlessThreadRegistered,
          turnId: (turnResult && (turnResult.turnId || turnResult.id || turnResult.turn && turnResult.turn.id)) || "",
          result: turnResult,
          startResult,
        };
      });
      sendJson(res, 200, result);
    } catch (err) {
      if (isCodexAccountAuthError(err)) {
        sendJson(res, 409, codexAccountAuthErrorPayload(err));
        return;
      }
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
  if (url.pathname === "/api/threads" && req.method === "GET") {
    const routeStartedAtMs = Date.now();
    const timings = {};
    const markTiming = (name, startedAtMs) => {
      timings[name] = Math.max(0, Date.now() - Number(startedAtMs || Date.now()));
      return timings[name];
    };
    const attachDiagnostics = (result, details = {}) => {
      if (!result || typeof result !== "object") return result;
      const totalMs = Math.max(0, Date.now() - routeStartedAtMs);
      result.mobileDiagnostics = Object.assign({}, result.mobileDiagnostics || {}, {
        threadListTimings: Object.assign({
          totalMs,
          limit,
          cursor: Boolean(cursor),
          archived,
          hasWorkspace: Boolean(cwd),
          hasSearch: Boolean(searchTerm),
          resultCount: Array.isArray(result.data) ? result.data.length : Array.isArray(result.threads) ? result.threads.length : 0,
        }, timings, details || {}),
      });
      return result;
    };
    const globalState = readGlobalState();
    const visibility = visibilityFromGlobalState(globalState);
    const cwd = url.searchParams.get("cwd") || null;
    const archivedParam = url.searchParams.get("archived");
    const archived = archivedParam === "true";
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || "80")));
    const cursor = url.searchParams.get("cursor") || null;
    const searchTerm = url.searchParams.get("search") || null;
    const fallbackMode = String(url.searchParams.get("fallback") || "").trim().toLowerCase();
    const deferFallback = fallbackMode === "defer" && !cursor && !archived && !searchTerm;
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
      const appServerStartedAtMs = Date.now();
      const appServerResult = filterThreadListByCwd(
        filterVisibleThreads(await codex.request("thread/list", params, { timeoutMs: READ_RPC_TIMEOUT_MS }), globalState),
        cwd,
      );
      markTiming("appServerMs", appServerStartedAtMs);
      const shouldDeferFallback = shouldDeferThreadListFallbackForActiveDetail({
        deferFallback,
        cursor,
        archived,
        searchTerm,
        cwd,
      });
      if (shouldDeferFallback) {
        Object.assign(timings, {
          fallbackMs: 0,
          fallbackCacheHit: false,
          fallbackDeferred: true,
          fallbackDeferredReason: deferFallback ? "client" : "active-thread-detail",
          fallbackStateDbMs: 0,
          fallbackRolloutMs: 0,
          fallbackSessionIndexMs: 0,
          mergeMs: 0,
        });
        const sessionIndexStartedAtMs = Date.now();
        const indexedResult = normalizeThreadListResultStatuses(hydrateThreadListResultTitlesFromSessionIndex(appServerResult));
        timings.fallbackSessionIndexMs = Math.max(0, Date.now() - sessionIndexStartedAtMs);
        threadDisplaySummaryCache.rememberList(indexedResult);
        if (Array.isArray(indexedResult.data)) indexedResult.data = indexedResult.data.slice(0, limit);
        if (Array.isArray(indexedResult.threads)) indexedResult.threads = indexedResult.threads.slice(0, limit);
        const decorateStartedAtMs = Date.now();
        const decorated = tokenUsageStatsService.decorateThreadListResult(
          attachThreadListStateToResult(indexedResult),
          { cwd, days: 31, workspaceCwds: tokenUsageWorkspaceCwds(globalState) },
        );
        markTiming("decorateMs", decorateStartedAtMs);
        decorated.mobileDeferredFallback = true;
        attachDiagnostics(decorated);
        logThreadList("deferred_complete", decorated.mobileDiagnostics.threadListTimings);
        sendJson(res, 200, decorated);
        return;
      }
      const fallbackStartedAtMs = Date.now();
      const fallbackDiagnostics = {};
      const fallback = readThreadListFallback(limit, { cwd, searchTerm, globalState, diagnostics: fallbackDiagnostics });
      markTiming("fallbackMs", fallbackStartedAtMs);
      Object.assign(timings, {
        fallbackCacheHit: Boolean(fallbackDiagnostics.cacheHit),
        fallbackStateDbMs: Number(fallbackDiagnostics.stateDbMs || 0),
        fallbackRolloutMs: Number(fallbackDiagnostics.rolloutMs || 0),
        fallbackSessionIndexMs: Number(fallbackDiagnostics.sessionIndexMs || 0),
      });
      const mergeStartedAtMs = Date.now();
      const result = normalizeThreadListResultStatuses(mergeThreadListFallback(appServerResult, fallback, limit));
      threadDisplaySummaryCache.rememberList(result);
      if (Array.isArray(result.data)) result.data = result.data.slice(0, limit);
      if (Array.isArray(result.threads)) result.threads = result.threads.slice(0, limit);
      markTiming("mergeMs", mergeStartedAtMs);
      const decorateStartedAtMs = Date.now();
      const decorated = tokenUsageStatsService.decorateThreadListResult(
        attachThreadListStateToResult(result),
        { cwd, days: 31, workspaceCwds: tokenUsageWorkspaceCwds(globalState) },
      );
      markTiming("decorateMs", decorateStartedAtMs);
      attachDiagnostics(decorated);
      logThreadList("complete", decorated.mobileDiagnostics.threadListTimings);
      sendJson(res, 200, decorated);
    } catch (err) {
      const fallbackStartedAtMs = Date.now();
      const fallbackDiagnostics = {};
      const fallback = readThreadListFallback(limit, { cwd, searchTerm, globalState, diagnostics: fallbackDiagnostics });
      markTiming("fallbackMs", fallbackStartedAtMs);
      Object.assign(timings, {
        fallbackCacheHit: Boolean(fallbackDiagnostics.cacheHit),
        fallbackStateDbMs: Number(fallbackDiagnostics.stateDbMs || 0),
        fallbackRolloutMs: Number(fallbackDiagnostics.rolloutMs || 0),
        fallbackSessionIndexMs: Number(fallbackDiagnostics.sessionIndexMs || 0),
      });
      if (fallback.length) {
        const decorateStartedAtMs = Date.now();
        const normalizedFallback = fallback.map((thread) => normalizeThreadSummaryLiveStatus(attachThreadTaskCardCountsToSummary(thread)));
        const decorated = tokenUsageStatsService.decorateThreadListResult({
          data: attachThreadGoalsToThreadListResult({
            data: normalizedFallback,
          }).data,
          mobileFallback: true,
          warning: err.message || String(err),
        }, { cwd, days: 31, workspaceCwds: tokenUsageWorkspaceCwds(globalState) });
        markTiming("decorateMs", decorateStartedAtMs);
        attachDiagnostics(decorated, { appServerError: err.message || String(err) });
        logThreadList("fallback_complete", decorated.mobileDiagnostics.threadListTimings);
        sendJson(res, 200, decorated);
        return;
      }
      logThreadList("error", Object.assign({
        totalMs: Math.max(0, Date.now() - routeStartedAtMs),
        error: err.message || String(err),
      }, timings));
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
    const detailMode = String(url.searchParams.get("mode") || "").trim().toLowerCase();
    const preferRecentTurns = detailMode === "recent";
    const requestStartedAtMs = Date.now();
    const threadLog = (event, details = {}) => logThreadDetail(event, Object.assign({
      threadId,
      elapsedMs: Date.now() - requestStartedAtMs,
    }, details));
    const detailResponse = await threadDetailReadOrchestrationService.readThreadDetail({
      codex,
      threadId,
      preferRecentTurns,
      threadLog,
    });
    sendJson(res, detailResponse.status || 200, detailResponse.body || {});
    if (detailResponse.complete !== false) {
      threadLog("complete", {
        status: detailResponse.status || 200,
        mode: detailResponse.mode || "unknown",
      });
    }
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
  const autoRecover = url.pathname.match(/^\/api\/threads\/([^/]+)\/auto-recover$/);
  if (autoRecover && req.method === "POST") {
    const threadId = decodeURIComponent(autoRecover[1]);
    const body = await readBody(req);
    const result = await autoRecoverThreadTurn(threadId, {
      activeTurnId: body.activeTurnId || "",
      wasRunning: body.wasRunning,
      cwd: body.cwd || null,
      permissionMode: body.permissionMode || "",
      reason: body.reason || "",
    });
    sendJson(res, 200, result);
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
        const turnResult = await codex.request("turn/start", params, { timeoutMs: MUTATION_RPC_TIMEOUT_MS, retry: false });
        rememberThreadIdForTurnId(threadId, notifyLocalTurnStarted(threadId, turnResult, { source: "message-submit" }));
        return turnResult;
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
      if (isCodexAccountAuthError(err)) {
        sendJson(res, 409, codexAccountAuthErrorPayload(err));
        return;
      }
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
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  approvalResponsePayload,
  anyThreadMatchesVisibleWorkspace,
  applyLocalActiveThreadStatusToSummary,
  codeGraphMcpElicitationToolName,
  codeGraphReadOnlyMcpElicitationDecision,
  clearLocalActiveThreadStatus,
  compactThread,
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
  staticCompressionCacheStats,
  staticCompressionEncoding,
  stripMarkdownFileTarget,
  taskCardSourceThreadTitle,
  threadDisplayTitle,
  threadMatchesWorkspaceCwd,
  threadTaskCardCanonicalVisibleTargets,
  uploadPathForId,
  workspaceDelegationDynamicToolSpec,
  attachWorkspaceDelegationDynamicTools,
  attachWorkspaceDelegationRuntimeGuidance,
  workspaceDelegationScriptFallbackInstruction,
  dynamicToolTextResponse,
};
