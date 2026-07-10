"use strict";

function truthyParam(value) {
  return /^(1|true|yes|on)$/i.test(String(value || ""));
}

function restartDefaultShellModeFromBody(body = {}) {
  const raw = String(
    body.defaultShellMode
      || body.defaultShell
      || body.CODEX_MOBILE_DEFAULT_SHELL
      || "",
  ).trim().toLowerCase();
  if (!raw) return "";
  if (raw === "classic" || raw === "classic-script" || raw === "classic-script-fallback") return "classic";
  if (raw === "vite-app-preview" || raw === "app-preview") return "vite-app-preview";
  const err = new Error("unsupported_default_shell_mode");
  err.statusCode = 400;
  throw err;
}

function createCoreApiRouteService(deps = {}) {
  const {
    activeProfileRestartOptions,
    activeRateLimits,
    appRoot,
    appUpdateBranch,
    appUpdateDisabled,
    appUpdateRemote,
    appVersion,
    applyAppUpdate,
    authKey,
    chatGptProMcpService,
    codex,
    codexConfigDefaults,
    codexProfileService,
    defaultModel,
    defaultPermissionModeFromConfigDefaults,
    disableAuth,
    frontendDiagnosticLogPublicSettings = () => ({
      enabled: false,
      upload: true,
      scopes: ["submitted_echo"],
      maxEntries: 400,
      source: "default",
      updatedAt: "",
    }),
    getProfileSwitchProgress,
    hermesNotificationDelegateService,
    hermesOriginFromRequest,
    hermesPluginBaseUrl,
    hermesPluginService,
    httpStatusError,
    isAccessKeyAuthorized,
    liveQuotaSnapshotForProfiles,
    loadRecentRateLimitsFromRollouts,
    logClientEvent,
    mediaFileService,
    modelOptions,
    permissionModeOptions,
    platform = process.platform,
    pluginSessionCookieHeader,
    profileSwitchLogDetail,
    profileSwitchProgressRequestId,
    publicConfigRuntimeCache,
    publicPrCheckDisabled,
    publicPrRepository,
    publicReleaseBranch,
    publicReleaseCheckDisabled,
    publicReleaseRepository,
    rateLimitsByModelObject,
    reasoningEffortOptions,
    remoteManagedWorkspaceRunnerService,
    remoteManagedWorkspaceSettingsService,
    restartDrainService,
    refreshAppUpdateStatus,
    refreshGitHubLinkPreview,
    refreshPublicPullRequestStatus,
    refreshPublicReleaseStatus,
    requestAuthToken,
    requestAuthTokens,
    requestBaseUrl,
    resolveModelOptions,
    rolloutWarningBytes,
    runtimePressureDiagnostics,
    safeAppUpdateError,
    scheduleBackgroundTask = (fn) => setImmediate(fn),
    scheduleAppRestart,
    setFrontendDiagnosticLogSettings,
    setProfileSwitchProgress,
    setThreadDisplaySettings,
    setWorkspaceDelegationEnabled,
    sharedChainRestartDelayMs,
    sharedChainRestartService,
    syncCodexMobileMcpToolset,
    syncKnownCodexMobileMcpToolsets,
    syncRegisteredWorkspaceTrust,
    threadDisplayPublicSettings,
    threadDetailFirstPaintPrewarmStatus = () => null,
    threadListFallbackPrewarmPublicStatus,
    timingSafeEquals,
    userBehaviorRepairCardService,
    viteShellArtifactService,
    workspaceDelegationPublicSettings,
    workspaceRegistryService,
    preflightCodexProfileSwitch,
  } = deps;

  function requestAuthTokenCandidates(req) {
    if (typeof requestAuthTokens === "function") {
      return requestAuthTokens(req);
    }
    const token = typeof requestAuthToken === "function" ? requestAuthToken(req) : "";
    return token ? [token] : [];
  }

  function readPluginSessionFromRequest(req) {
    if (!hermesPluginService || typeof hermesPluginService.readSession !== "function") return null;
    for (const token of requestAuthTokenCandidates(req)) {
      const session = hermesPluginService.readSession({ token });
      if (session && session.session_key) return session;
    }
    return null;
  }

  function launchTokenFromRequest(req) {
    const candidates = requestAuthTokenCandidates(req);
    if (hermesPluginService && typeof hermesPluginService.isLaunchTokenAuthorized === "function") {
      const launchToken = candidates.find((token) => hermesPluginService.isLaunchTokenAuthorized(token));
      if (launchToken) return launchToken;
    }
    return candidates[0] || "";
  }

  function normalizeOptionList(values) {
    return [...new Set((Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean))];
  }

  async function effectiveModelOptions() {
    const fallback = normalizeOptionList(modelOptions);
    if (typeof resolveModelOptions !== "function") return fallback;
    try {
      const resolved = normalizeOptionList(await resolveModelOptions());
      return resolved.length ? resolved : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function restartReadinessStatus(input = {}) {
    if (restartDrainService && typeof restartDrainService.status === "function") {
      return restartDrainService.status(input);
    }
    return { ok: true, ready: true, draining: false, issueCodes: [], activeTurnCount: 0 };
  }

  function sendRestartReadiness(sendJson, status) {
    const code = status && status.ready === false ? 503 : 200;
    const retryAfter = status && status.retryAfterSeconds
      ? { "Retry-After": String(status.retryAfterSeconds) }
      : {};
    sendJson(code, status, retryAfter);
  }

  function defaultModelForOptions(options = []) {
    const configured = String(codexConfigDefaults && codexConfigDefaults.model || "").trim();
    const fallback = String(defaultModel || "").trim();
    if (configured && options.includes(configured)) return configured;
    if (fallback && options.includes(fallback)) return fallback;
    return options[0] || configured || fallback;
  }

  function scheduleQuotaHydration() {
    if (typeof scheduleBackgroundTask !== "function") return;
    scheduleBackgroundTask(() => {
      try {
        const refresh = codex && typeof codex.refreshRateLimitsIfMissing === "function"
          ? codex.refreshRateLimitsIfMissing()
          : null;
        if (refresh && typeof refresh.catch === "function") {
          refresh.catch((err) => {
            console.error(`[runtime-pressure] rate-limit refresh failed: ${String(err && err.message || err).slice(0, 180)}`);
          });
        }
      } catch (err) {
        console.error(`[runtime-pressure] rate-limit refresh failed: ${String(err && err.message || err).slice(0, 180)}`);
      }
      if (typeof loadRecentRateLimitsFromRollouts === "function") {
        try {
          loadRecentRateLimitsFromRollouts();
        } catch (err) {
          console.error(`[runtime-pressure] rollout quota scan failed: ${String(err && err.message || err).slice(0, 180)}`);
        }
      }
    });
  }

  async function handlePublicRoute(context = {}) {
    const { url, req, res, readBody, sendJson } = context;
    if (!url || !req || !res) return { handled: false };
    if (url.pathname === "/api/healthz" && req.method === "GET") {
      sendJson(200, { ok: true, ready: true, service: "codex-mobile-web" });
      return { handled: true };
    }
    if (url.pathname === "/api/readyz" && req.method === "GET") {
      sendRestartReadiness(sendJson, restartReadinessStatus());
      return { handled: true };
    }
    if (url.pathname === "/api/v1/hermes/plugin/manifest" && req.method === "GET") {
      const buildConfig = typeof deps.currentPublicBuildConfig === "function"
        ? deps.currentPublicBuildConfig()
        : {};
      sendJson(200, hermesPluginService.manifest({
        baseUrl: hermesPluginBaseUrl || requestBaseUrl(req),
        hermesOrigin: hermesOriginFromRequest(req, url),
        version: appVersion,
        buildId: buildConfig.buildId,
        clientBuildId: buildConfig.clientBuildId,
        shellCacheName: buildConfig.shellCacheName,
      }));
      return { handled: true };
    }
    if (url.pathname === "/api/public-config") {
      scheduleQuotaHydration();
      const buildConfig = deps.currentPublicBuildConfig();
      const workspaceDelegation = workspaceDelegationPublicSettings();
      const activeQuota = liveQuotaSnapshotForProfiles();
      const runtimeModelOptions = await effectiveModelOptions();
      const profileState = publicConfigRuntimeCache.getProfileState({
        activeQuota,
        loadProfiles: (options) => codexProfileService.profiles(options),
      }).value;
      syncKnownCodexMobileMcpToolsets({ activeQuota, profileState });
      sendJson(200, {
        authRequired: !disableAuth,
        title: "Codex Mobile Web",
        version: appVersion,
        platform,
        workspacePath: appRoot,
        buildId: buildConfig.buildId,
        clientBuildId: buildConfig.clientBuildId,
        shellCacheName: buildConfig.shellCacheName,
        ...mediaFileService.publicConfig(),
        rolloutWarningBytes,
        modelOptions: runtimeModelOptions,
        reasoningEffortOptions,
        permissionModeOptions,
        defaultModel: defaultModelForOptions(runtimeModelOptions),
        defaultReasoningEffort: codexConfigDefaults.reasoningEffort,
        defaultPermissionMode: defaultPermissionModeFromConfigDefaults(),
        rateLimits: activeRateLimits(),
        rateLimitsByModel: rateLimitsByModelObject(),
        codexProfiles: profileState,
        push: deps.pushSubscriptionPublicStatus(),
        update: {
          enabled: !appUpdateDisabled,
          remote: appUpdateRemote,
          branch: appUpdateBranch,
        },
        publicPullRequests: {
          enabled: !publicPrCheckDisabled,
          repository: publicPrRepository,
        },
        publicRelease: {
          enabled: !publicReleaseCheckDisabled,
          repository: publicReleaseRepository,
          branch: publicReleaseBranch,
        },
        threadListFallbackPrewarm: threadListFallbackPrewarmPublicStatus(),
        workspaceCreate: {
          enabled: true,
          defaultRoot: workspaceRegistryService.defaultCreateRoot(),
          roots: workspaceRegistryService.createRoots(),
        },
        workspaceDelegation,
        remoteManagedWorkspace: remoteManagedWorkspaceSettingsService
          && typeof remoteManagedWorkspaceSettingsService.publicSettings === "function"
          ? remoteManagedWorkspaceSettingsService.publicSettings()
          : { enabled: false, workspaceKind: "remote_managed_workspace", connectionStatus: "disconnected" },
        frontendDiagnosticLog: frontendDiagnosticLogPublicSettings(),
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
      return { handled: true };
    }
    if (url.pathname === "/api/chatgpt-pro/mcp" && (req.method === "POST" || req.method === "GET")) {
      if (!chatGptProMcpService.isConfigured()) {
        sendJson(503, { ok: false, error: "ChatGPT Pro MCP connector is not configured" });
        return { handled: true };
      }
      if (!chatGptProMcpService.isAuthorized(req)) {
        sendJson(401, { ok: false, error: "Unauthorized ChatGPT Pro MCP connector request" });
        return { handled: true };
      }
      if (req.method === "GET") {
        sendJson(200, chatGptProMcpService.status());
        return { handled: true };
      }
      try {
        const body = await readBody();
        const reply = await chatGptProMcpService.handleJsonRpc(body);
        if (reply === null) {
          res.writeHead(204, { "Cache-Control": "no-store" });
          res.end();
          return { handled: true };
        }
        sendJson(200, reply);
      } catch (err) {
        sendJson(err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/codex-profiles" && req.method === "GET") {
      const activeQuota = liveQuotaSnapshotForProfiles();
      syncKnownCodexMobileMcpToolsets({ activeQuota });
      sendJson(200, codexProfileService.profiles({ activeQuota }));
      return { handled: true };
    }
    if (url.pathname === "/api/codex-profiles/switch-progress" && req.method === "GET") {
      const requestId = String(url.searchParams.get("requestId") || "").trim();
      const progress = getProfileSwitchProgress(requestId);
      if (!progress) {
        sendJson(404, { ok: false, error: "Profile switch progress not found" });
        return { handled: true };
      }
      sendJson(200, { ok: true, progress });
      return { handled: true };
    }
    if (url.pathname === "/api/codex-profiles/active" && req.method === "POST") {
      let requestId = "";
      try {
        const body = await readBody();
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
        publicConfigRuntimeCache.invalidateProfiles();
        setProfileSwitchProgress(requestId, {
          targetProfileId: profile.id,
          targetProfileLabel: profile.label || profile.id,
          stage: "schedule_restart",
          message: "正在安排 Mobile Web 重启...",
          stepIndex: 10,
        });
        const restart = sharedChainRestartService.restart(Object.assign({
          delayMs: sharedChainRestartDelayMs,
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
        sendJson(202, Object.assign({ ok: true, requestId, activeProfileId: profile.id, profile, preflight, progress }, restart));
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
        sendJson(err.statusCode || 500, {
          ok: false,
          error: err.message || String(err),
          code: err.code || undefined,
          detail: err.detail || undefined,
          requestId: requestId || undefined,
          progress: requestId ? getProfileSwitchProgress(requestId) || undefined : undefined,
        });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/login" && req.method === "POST") {
      const body = await readBody();
      if (!disableAuth && !timingSafeEquals(body.key, authKey)) {
        sendJson(401, { error: "Invalid key" });
        return { handled: true };
      }
      res.writeHead(204, {
        "Set-Cookie": `codex_mobile_key=${encodeURIComponent(body.key || "")}; Path=/; Max-Age=31536000; SameSite=Lax`,
        "Cache-Control": "no-store",
      });
      res.end();
      return { handled: true };
    }
    return { handled: false };
  }

  async function handleAuthorizedRoute(context = {}) {
    const { url, req, res, readBody, sendJson } = context;
    if (!url || !req || !res) return { handled: false };
    if (url.pathname === "/api/settings/workspace-delegation" && (req.method === "GET" || req.method === "POST")) {
      try {
        if (req.method === "GET") {
          sendJson(200, { ok: true, workspaceDelegation: workspaceDelegationPublicSettings() });
          return { handled: true };
        }
        const body = await readBody();
        if (typeof body.enabled !== "boolean") throw httpStatusError(400, "enabled_boolean_required");
        sendJson(200, {
          ok: true,
          workspaceDelegation: setWorkspaceDelegationEnabled(body.enabled),
        });
      } catch (err) {
        sendJson(err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/settings/remote-managed-workspace" && (req.method === "GET" || req.method === "POST")) {
      try {
        if (!remoteManagedWorkspaceSettingsService || typeof remoteManagedWorkspaceSettingsService.publicSettings !== "function") {
          throw httpStatusError(503, "remote_managed_workspace_settings_unavailable");
        }
        if (req.method === "GET") {
          sendJson(200, { ok: true, remoteManagedWorkspace: remoteManagedWorkspaceSettingsService.publicSettings() });
          return { handled: true };
        }
        const body = await readBody();
        const remoteManagedWorkspace = remoteManagedWorkspaceSettingsService.saveSettings(body);
        if (remoteManagedWorkspaceRunnerService && typeof remoteManagedWorkspaceRunnerService.handleSettingsChanged === "function") {
          remoteManagedWorkspaceRunnerService.handleSettingsChanged();
        }
        sendJson(200, { ok: true, remoteManagedWorkspace });
      } catch (err) {
        sendJson(err.statusCode || 500, { ok: false, error: err.code || err.message || String(err) });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/settings/remote-managed-workspace/workspace" && req.method === "POST") {
      try {
        if (!remoteManagedWorkspaceSettingsService || typeof remoteManagedWorkspaceSettingsService.enableWorkspace !== "function") {
          throw httpStatusError(503, "remote_managed_workspace_settings_unavailable");
        }
        const body = await readBody();
        const action = String(body && body.action || "enable").trim().toLowerCase();
        const remoteManagedWorkspace = action === "disable"
          ? remoteManagedWorkspaceSettingsService.disableWorkspace(body)
          : remoteManagedWorkspaceSettingsService.enableWorkspace(body);
        if (remoteManagedWorkspaceRunnerService && typeof remoteManagedWorkspaceRunnerService.handleSettingsChanged === "function") {
          remoteManagedWorkspaceRunnerService.handleSettingsChanged();
        }
        sendJson(200, { ok: true, remoteManagedWorkspace });
      } catch (err) {
        sendJson(err.statusCode || 500, {
          ok: false,
          error: err.code || err.message || String(err),
          remoteManagedWorkspace: remoteManagedWorkspaceSettingsService
            && typeof remoteManagedWorkspaceSettingsService.publicSettings === "function"
            ? remoteManagedWorkspaceSettingsService.publicSettings()
            : undefined,
        });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/settings/remote-managed-workspace/test-connection" && req.method === "POST") {
      try {
        if (!remoteManagedWorkspaceRunnerService || typeof remoteManagedWorkspaceRunnerService.testConnection !== "function") {
          throw httpStatusError(503, "remote_managed_workspace_runner_unavailable");
        }
        sendJson(200, await remoteManagedWorkspaceRunnerService.testConnection());
      } catch (err) {
        sendJson(err.statusCode || 500, {
          ok: false,
          error: err.code || err.message || String(err),
          remoteManagedWorkspace: remoteManagedWorkspaceSettingsService
            && typeof remoteManagedWorkspaceSettingsService.publicSettings === "function"
            ? remoteManagedWorkspaceSettingsService.publicSettings()
            : undefined,
        });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/settings/remote-managed-workspace/register" && req.method === "POST") {
      try {
        if (!remoteManagedWorkspaceRunnerService || typeof remoteManagedWorkspaceRunnerService.registerNow !== "function") {
          throw httpStatusError(503, "remote_managed_workspace_runner_unavailable");
        }
        sendJson(200, await remoteManagedWorkspaceRunnerService.registerNow());
      } catch (err) {
        sendJson(err.statusCode || 500, {
          ok: false,
          error: err.code || err.message || String(err),
          remoteManagedWorkspace: remoteManagedWorkspaceSettingsService
            && typeof remoteManagedWorkspaceSettingsService.publicSettings === "function"
            ? remoteManagedWorkspaceSettingsService.publicSettings()
            : undefined,
        });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/settings/remote-managed-workspace/poll-once" && req.method === "POST") {
      try {
        if (!remoteManagedWorkspaceRunnerService || typeof remoteManagedWorkspaceRunnerService.runOnce !== "function") {
          throw httpStatusError(503, "remote_managed_workspace_runner_unavailable");
        }
        sendJson(200, await remoteManagedWorkspaceRunnerService.runOnce({ force: true, suppressErrors: true }));
      } catch (err) {
        sendJson(err.statusCode || 500, {
          ok: false,
          error: err.code || err.message || String(err),
          remoteManagedWorkspace: remoteManagedWorkspaceSettingsService
            && typeof remoteManagedWorkspaceSettingsService.publicSettings === "function"
            ? remoteManagedWorkspaceSettingsService.publicSettings()
            : undefined,
        });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/settings/thread-display" && (req.method === "GET" || req.method === "POST")) {
      try {
        if (req.method === "GET") {
          sendJson(200, { ok: true, threadDisplay: threadDisplayPublicSettings() });
          return { handled: true };
        }
        const body = await readBody();
        sendJson(200, {
          ok: true,
          threadDisplay: setThreadDisplaySettings(body),
        });
      } catch (err) {
        sendJson(err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/settings/frontend-diagnostic-log" && (req.method === "GET" || req.method === "POST")) {
      try {
        if (req.method === "GET") {
          sendJson(200, { ok: true, frontendDiagnosticLog: frontendDiagnosticLogPublicSettings() });
          return { handled: true };
        }
        if (typeof setFrontendDiagnosticLogSettings !== "function") {
          throw httpStatusError(503, "frontend_diagnostic_log_settings_unavailable");
        }
        const body = await readBody();
        sendJson(200, {
          ok: true,
          frontendDiagnosticLog: setFrontendDiagnosticLogSettings(body),
        });
      } catch (err) {
        sendJson(err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/v1/hermes/plugin/session" && req.method === "POST") {
      try {
        const body = await readBody();
        const explicitLaunchToken = body.codexPluginLaunch || body.pluginLaunch || body.launchToken || body.token || "";
        if (!explicitLaunchToken) {
          const existingSession = readPluginSessionFromRequest(req);
          if (existingSession) {
            const cookie = pluginSessionCookieHeader(req, existingSession);
            sendJson(200, existingSession, cookie ? { "Set-Cookie": cookie } : {});
            return { handled: true };
          }
        }
        const session = hermesPluginService.createSession(Object.assign({}, body, {
          token: explicitLaunchToken || launchTokenFromRequest(req),
        }));
        const cookie = pluginSessionCookieHeader(req, session);
        sendJson(200, session, cookie ? { "Set-Cookie": cookie } : {});
      } catch (err) {
        sendJson(err.statusCode || 400, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/v1/hermes/plugin/workspaces" && req.method === "POST") {
      if (!isAccessKeyAuthorized(req)) {
        sendJson(401, { ok: false, error: "Codex Mobile access key is required" });
        return { handled: true };
      }
      try {
        const body = await readBody();
        const registration = hermesPluginService.registerWorkspace(body);
        sendJson(200, { ok: true, registration });
      } catch (err) {
        sendJson(err.statusCode || 400, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/v1/hermes/plugin/callbacks" && req.method === "POST") {
      if (!isAccessKeyAuthorized(req)) {
        sendJson(401, { ok: false, error: "Codex Mobile access key is required" });
        return { handled: true };
      }
      try {
        const body = await readBody();
        const registration = hermesPluginService.registerWorkspace(body);
        sendJson(200, { ok: true, registration });
      } catch (err) {
        sendJson(err.statusCode || 400, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/v1/hermes/plugin/origins" && req.method === "POST") {
      if (!isAccessKeyAuthorized(req)) {
        sendJson(401, { ok: false, error: "Codex Mobile access key is required" });
        return { handled: true };
      }
      try {
        const body = await readBody();
        const registration = hermesPluginService.registerOrigin(body);
        sendJson(200, {
          ok: true,
          registration,
          frame_ancestors: hermesPluginService.frameAncestors(),
        });
      } catch (err) {
        sendJson(err.statusCode || 400, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/v1/hermes/plugin/registration" && req.method === "GET") {
      const registration = hermesPluginService.registration({
        workspaceId: url.searchParams.get("workspaceId") || url.searchParams.get("workspace_id") || "owner",
      });
      sendJson(200, { ok: true, registration });
      return { handled: true };
    }
    if (url.pathname === "/api/v1/hermes/plugin/launch" && req.method === "POST") {
      if (!isAccessKeyAuthorized(req)) {
        sendJson(401, { ok: false, error: "Codex Mobile access key is required" });
        return { handled: true };
      }
      try {
        const body = await readBody();
        sendJson(200, hermesPluginService.createLaunch(body));
      } catch (err) {
        sendJson(err.statusCode || 400, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/v1/hermes/plugin/notifications" && req.method === "POST") {
      if (!isAccessKeyAuthorized(req)) {
        sendJson(401, { ok: false, error: "Codex Mobile access key is required" });
        return { handled: true };
      }
      try {
        const body = await readBody();
        sendJson(200, await hermesNotificationDelegateService.send(body));
      } catch (err) {
        sendJson(err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/client-events" && req.method === "POST") {
      const body = await readBody();
      const event = String(body.event || "event").slice(0, 80);
      const details = body.details && typeof body.details === "object" ? body.details : {};
      logClientEvent(event, {
        threadId: body.threadId || "",
        path: body.path || "",
        details,
        userAgent: String(req.headers["user-agent"] || "").slice(0, 160),
      });
      if (userBehaviorRepairCardService && typeof userBehaviorRepairCardService.handleClientEvent === "function") {
        scheduleBackgroundTask(async () => {
          try {
            const result = await userBehaviorRepairCardService.handleClientEvent(event, {
              threadId: body.threadId || "",
              path: body.path || "",
              details,
              userAgent: String(req.headers["user-agent"] || "").slice(0, 160),
            });
            if (result && result.created) {
              logClientEvent("user_behavior_repair_card_created", {
                threadId: body.threadId || "",
                issueCode: result.issueCode || "",
                cardId: result.cardId || "",
                direct: result.direct === true,
                autoApprove: result.autoApprove === true,
              });
            } else if (result && result.ok === false) {
              logClientEvent("user_behavior_repair_card_failed", {
                threadId: body.threadId || "",
                issueCode: result.issueCode || "",
                reason: result.reason || "",
                error: result.error || "",
              });
            }
          } catch (err) {
            logClientEvent("user_behavior_repair_card_failed", {
              threadId: body.threadId || "",
              issueCode: "",
              reason: "task_card_dispatch_exception",
              error: err && err.message ? err.message : String(err || ""),
            });
          }
        });
      }
      res.writeHead(204, { "Cache-Control": "no-store" });
      res.end();
      return { handled: true };
    }
    if (url.pathname === "/api/app-update/status" && req.method === "GET") {
      sendJson(200, await refreshAppUpdateStatus({
        fetch: truthyParam(url.searchParams.get("fetch")),
        force: truthyParam(url.searchParams.get("force")),
      }));
      return { handled: true };
    }
    if (url.pathname === "/api/vite-shell-artifact" && req.method === "GET") {
      const status = viteShellArtifactService && typeof viteShellArtifactService.readPublicArtifactStatus === "function"
        ? viteShellArtifactService.readPublicArtifactStatus()
        : {
            ok: false,
            available: false,
            issueCodes: ["vite_shell_artifact_service_unavailable"],
            validation: {
              ok: false,
              issues: [{ code: "vite_shell_artifact_service_unavailable" }],
            },
          };
      sendJson(200, status);
      return { handled: true };
    }
    if (url.pathname === "/api/app-update/apply" && req.method === "POST") {
      try {
        const result = await applyAppUpdate();
        sendJson(200, result);
        if (result && result.updated) scheduleAppRestart("app update applied");
      } catch (err) {
        sendJson(err.statusCode || 500, { error: safeAppUpdateError(err) });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/public-pull-requests/status" && req.method === "GET") {
      sendJson(200, await refreshPublicPullRequestStatus({ force: truthyParam(url.searchParams.get("force")) }));
      return { handled: true };
    }
    if (url.pathname === "/api/link-previews/github" && req.method === "GET") {
      const previewUrl = String(url.searchParams.get("url") || "").trim();
      if (!previewUrl) {
        sendJson(400, { supported: false, provider: "github", reason: "url is required", preview: null });
        return { handled: true };
      }
      sendJson(200, await refreshGitHubLinkPreview(previewUrl, { force: truthyParam(url.searchParams.get("force")) }));
      return { handled: true };
    }
    if (url.pathname === "/api/public-release/status" && req.method === "GET") {
      sendJson(200, await refreshPublicReleaseStatus({ force: truthyParam(url.searchParams.get("force")) }));
      return { handled: true };
    }
    if (url.pathname === "/api/restart/shared-chain" && req.method === "POST") {
      try {
        const body = await readBody();
        const defaultShellMode = restartDefaultShellModeFromBody(body);
        const restartOptions = Object.assign({
          delayMs: sharedChainRestartDelayMs,
        }, activeProfileRestartOptions());
        if (defaultShellMode) restartOptions.defaultShellMode = defaultShellMode;
        const result = sharedChainRestartService.restart(restartOptions);
        sendJson(202, result);
      } catch (err) {
        sendJson(err.statusCode || 500, { error: err.message || String(err) });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/restart/drain" && req.method === "POST") {
      try {
        const body = await readBody();
        const result = restartDrainService && typeof restartDrainService.beginDrain === "function"
          ? restartDrainService.beginDrain({
            reason: body.reason || "listener_restart",
            source: body.source || "api",
            maxDrainMs: body.maxDrainMs,
            activeTurnCount: body.activeTurnCount,
          })
          : restartReadinessStatus();
        sendJson(202, result);
      } catch (err) {
        sendJson(err.statusCode || 500, { error: err.message || String(err) });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/restart/drain" && req.method === "DELETE") {
      const result = restartDrainService && typeof restartDrainService.clearDrain === "function"
        ? restartDrainService.clearDrain()
        : restartReadinessStatus();
      sendJson(200, result);
      return { handled: true };
    }
    if (url.pathname === "/api/status") {
      await codex.ensure().catch((err) => {
        codex.lastError = err.message;
      });
      scheduleQuotaHydration();
      const status = codex.status();
      if (truthyParam(url.searchParams.get("detail")) && runtimePressureDiagnostics && typeof runtimePressureDiagnostics.status === "function") {
        status.runtimePressure = runtimePressureDiagnostics.status();
        status.threadDetailFirstPaintPrewarm = threadDetailFirstPaintPrewarmStatus(
          url.searchParams.get("threadId") || url.searchParams.get("thread") || "",
        );
      }
      if (truthyParam(url.searchParams.get("muxMetrics"))) {
        status.muxMetrics = await codex.readMuxMetrics(["thread/list"]);
      }
      sendJson(200, status);
      return { handled: true };
    }
    if (url.pathname === "/api/app-server/reconnect" && req.method === "POST") {
      codex.resetConnection("manual app-server reconnect requested");
      await new Promise((resolve) => setTimeout(resolve, 350));
      await codex.ensure().catch((err) => {
        codex.lastError = err.message;
      });
      sendJson(200, codex.status());
      return { handled: true };
    }
    if (url.pathname === "/api/approvals" && req.method === "GET") {
      sendJson(200, { data: codex.pendingServerRequests() });
      return { handled: true };
    }
    const approvalResponse = url.pathname.match(/^\/api\/approvals\/([^/]+)$/);
    if (approvalResponse && req.method === "POST") {
      const requestId = decodeURIComponent(approvalResponse[1]);
      const body = await readBody();
      try {
        const request = codex.answerServerRequest(requestId, body);
        sendJson(200, { ok: true, request });
      } catch (err) {
        const message = String(err && err.message || err || "approval_request_failed");
        const stale = /no longer pending|not pending|not found|not available/i.test(message);
        const alreadyAnswered = /already been answered|already answered/i.test(message);
        sendJson(stale ? 404 : alreadyAnswered ? 409 : err && err.statusCode || 500, {
          ok: false,
          error: message,
          code: stale
            ? "approval_request_no_longer_pending"
            : alreadyAnswered
              ? "approval_request_already_answered"
              : "approval_request_failed",
        });
      }
      return { handled: true };
    }
    return { handled: false };
  }

  return {
    handleAuthorizedRoute,
    handlePublicRoute,
  };
}

module.exports = {
  createCoreApiRouteService,
  restartDefaultShellModeFromBody,
  truthyParam,
};
