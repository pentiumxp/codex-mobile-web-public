"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createCoreApiRouteService,
  restartDefaultShellModeFromBody,
} = require("../server-routes/core-api-route-service");
const { createCodexProfileSwitchService } = require("../adapters/codex-profile-switch-service");

test("core API route adapter re-exports server-routes service", () => {
  const adapter = require("../adapters/core-api-route-service");
  const canonical = require("../server-routes/core-api-route-service");
  assert.equal(adapter.createCoreApiRouteService, canonical.createCoreApiRouteService);
});

test("core public config route uses injected runtime dependencies", async () => {
  let refreshedRateLimits = false;
  let loadedRecentRateLimits = false;
  let syncedMcpToolsets = false;
  let sent = null;
  const scheduled = [];
  const service = createCoreApiRouteService({
    appRoot: "/workspace",
    appUpdateBranch: "main",
    appUpdateDisabled: false,
    appUpdateRemote: "origin",
    appVersion: "0.1.11",
    authKey: "test-key",
    chatGptProMcpService: {},
    codex: {
      refreshRateLimitsIfMissing: async () => {
        refreshedRateLimits = true;
      },
    },
    codexConfigDefaults: { model: "gpt-test", reasoningEffort: "medium" },
    codexProfileService: {
      profiles: () => ({ profiles: [], activeProfileId: "default" }),
    },
    currentPublicBuildConfig: () => ({
      buildId: "build-test",
      clientBuildId: "client-test",
      shellCacheName: "shell-test",
    }),
    defaultModel: "gpt-default",
    defaultPermissionModeFromConfigDefaults: () => "workspace-write",
    disableAuth: false,
    hermesNotificationDelegateService: {
      isConfiguredForWorkspace: () => false,
    },
    hermesOriginFromRequest: () => "http://127.0.0.1",
    hermesPluginBaseUrl: "http://127.0.0.1:8787",
    hermesPluginService: {},
    frontendDiagnosticLogPublicSettings: () => ({ enabled: true, upload: true, scopes: ["submitted_echo"], maxEntries: 100, source: "runtime" }),
    liveQuotaSnapshotForProfiles: () => ({ source: "test" }),
    loadRecentRateLimitsFromRollouts: () => {
      loadedRecentRateLimits = true;
    },
    mediaFileService: {
      publicConfig: () => ({ uploads: { enabled: true }, defaultShellMode: "vite-app-preview" }),
    },
    modelOptions: ["gpt-test"],
    permissionModeOptions: ["workspace-write"],
    platform: "test",
    publicConfigRuntimeCache: {
      getProfileState: ({ activeQuota, loadProfiles }) => ({
        value: Object.assign({ activeQuota }, loadProfiles({ activeQuota })),
      }),
    },
    publicPrCheckDisabled: true,
    publicPrRepository: "",
    publicReleaseBranch: "main",
    publicReleaseCheckDisabled: true,
    publicReleaseRepository: "",
    pushSubscriptionPublicStatus: () => ({ enabled: false }),
    rateLimitsByModelObject: () => ({}),
    reasoningEffortOptions: ["medium"],
    requestBaseUrl: () => "http://127.0.0.1:8787",
    rolloutWarningBytes: 1000,
    syncKnownCodexMobileMcpToolsets: () => {
      syncedMcpToolsets = true;
    },
    scheduleBackgroundTask: (fn) => {
      scheduled.push(fn);
    },
    threadListFallbackPrewarmPublicStatus: () => ({ pending: false }),
    workspaceDelegationPublicSettings: () => ({ enabled: true }),
    workspaceRegistryService: {
      createRoots: () => ["/workspace"],
      defaultCreateRoot: () => "/workspace",
    },
    activeRateLimits: () => ({ primary: "ok" }),
  });

  const handled = await service.handlePublicRoute({
    url: new URL("http://127.0.0.1:8787/api/public-config"),
    req: { method: "GET", headers: {} },
    res: {},
    readBody: async () => ({}),
    sendJson: (status, body) => {
      sent = { status, body };
    },
  });

  assert.deepEqual(handled, { handled: true });
  assert.equal(refreshedRateLimits, false);
  assert.equal(loadedRecentRateLimits, false);
  assert.equal(scheduled.length, 1);
  await scheduled[0]();
  assert.equal(refreshedRateLimits, true);
  assert.equal(loadedRecentRateLimits, true);
  assert.equal(syncedMcpToolsets, true);
  assert.equal(sent.status, 200);
  assert.equal(sent.body.buildId, "build-test");
  assert.equal(sent.body.clientBuildId, "client-test");
  assert.equal(sent.body.shellCacheName, "shell-test");
  assert.equal(sent.body.defaultShellMode, "vite-app-preview");
  assert.equal(sent.body.defaultModel, "gpt-test");
  assert.equal(sent.body.workspaceDelegation.enabled, true);
  assert.equal(sent.body.frontendDiagnosticLog.enabled, true);
  assert.deepEqual(sent.body.frontendDiagnosticLog.scopes, ["submitted_echo"]);
  assert.equal(sent.body.threadListFallbackPrewarm.pending, false);
});

test("core settings route persists frontend diagnostic log settings", async () => {
  let current = { enabled: false, upload: true, scopes: ["submitted_echo"], maxEntries: 400, source: "default" };
  let sent = null;
  const service = createCoreApiRouteService({
    frontendDiagnosticLogPublicSettings: () => current,
    setFrontendDiagnosticLogSettings: (body) => {
      current = Object.assign({}, current, body, { source: "runtime" });
      return current;
    },
    httpStatusError: (statusCode, message) => {
      const err = new Error(message);
      err.statusCode = statusCode;
      return err;
    },
  });

  let handled = await service.handleAuthorizedRoute({
    url: new URL("http://127.0.0.1:8787/api/settings/frontend-diagnostic-log"),
    req: { method: "POST", headers: {} },
    res: {},
    readBody: async () => ({ enabled: true, scopes: ["submitted_echo"], maxEntries: 80 }),
    sendJson: (status, body) => {
      sent = { status, body };
    },
  });

  assert.deepEqual(handled, { handled: true });
  assert.equal(sent.status, 200);
  assert.equal(sent.body.frontendDiagnosticLog.enabled, true);
  assert.equal(sent.body.frontendDiagnosticLog.maxEntries, 80);

  handled = await service.handleAuthorizedRoute({
    url: new URL("http://127.0.0.1:8787/api/settings/frontend-diagnostic-log"),
    req: { method: "GET", headers: {} },
    res: {},
    readBody: async () => ({}),
    sendJson: (status, body) => {
      sent = { status, body };
    },
  });

  assert.deepEqual(handled, { handled: true });
  assert.equal(sent.status, 200);
  assert.equal(sent.body.frontendDiagnosticLog.source, "runtime");
});

test("core status route exposes runtime pressure without blocking on quota hydration", async () => {
  let ensured = false;
  let refreshedRateLimits = false;
  let loadedRecentRateLimits = false;
  let sent = null;
  const scheduled = [];
  const prewarmThreadIds = [];
  const service = createCoreApiRouteService({
    codex: {
      ensure: async () => {
        ensured = true;
      },
      refreshRateLimitsIfMissing: async () => {
        refreshedRateLimits = true;
      },
      status: () => ({ ready: true, issueCodes: [] }),
    },
    loadRecentRateLimitsFromRollouts: () => {
      loadedRecentRateLimits = true;
    },
    runtimePressureDiagnostics: {
      status: () => ({
        eventLoop: { lagP95Ms: 7, utilization: 0.25 },
        routes: { recent: [{ path: "/api/status", elapsedMs: 11 }] },
      }),
    },
    threadDetailFirstPaintPrewarmStatus: (threadId) => {
      prewarmThreadIds.push(threadId);
      return { pending: false, lastResult: threadId ? { threadId, status: "warmed" } : null };
    },
    scheduleBackgroundTask: (fn) => {
      scheduled.push(fn);
    },
  });

  const handled = await service.handleAuthorizedRoute({
    url: new URL("http://127.0.0.1:8787/api/status?detail=1&threadId=thread-1"),
    req: { method: "GET", headers: {} },
    res: {},
    readBody: async () => ({}),
    sendJson: (status, body) => {
      sent = { status, body };
    },
  });

  assert.deepEqual(handled, { handled: true });
  assert.equal(ensured, true);
  assert.equal(refreshedRateLimits, false);
  assert.equal(loadedRecentRateLimits, false);
  assert.equal(scheduled.length, 1);
  assert.equal(sent.status, 200);
  assert.equal(sent.body.ready, true);
  assert.equal(sent.body.runtimePressure.eventLoop.lagP95Ms, 7);
  assert.equal(sent.body.runtimePressure.routes.recent[0].path, "/api/status");
  assert.deepEqual(prewarmThreadIds, ["thread-1"]);
  assert.equal(sent.body.threadDetailFirstPaintPrewarm.lastResult.status, "warmed");

  await scheduled[0]();
  assert.equal(refreshedRateLimits, true);
  assert.equal(loadedRecentRateLimits, true);
});

test("core Hermes plugin manifest route forwards runtime build identity", async () => {
  let capturedManifestInput = null;
  let sent = null;
  const service = createCoreApiRouteService({
    appVersion: "0.1.11",
    currentPublicBuildConfig: () => ({
      buildId: "build-route",
      clientBuildId: "client-route",
      shellCacheName: "shell-route",
    }),
    hermesOriginFromRequest: () => "https://home.example.test",
    hermesPluginBaseUrl: "https://codex.example.test",
    hermesPluginService: {
      manifest: (input) => {
        capturedManifestInput = input;
        return {
          id: "codex-mobile",
          clientBuildId: input.clientBuildId,
          entry: {
            url: `${input.baseUrl}/?embed=hermes&codexMobileBuild=${encodeURIComponent(input.clientBuildId)}`,
          },
          embedding: {
            refreshOnVersionChange: true,
            version: input.clientBuildId,
          },
        };
      },
    },
    requestBaseUrl: () => "http://127.0.0.1:8787",
  });

  const handled = await service.handlePublicRoute({
    url: new URL("http://127.0.0.1:8787/api/v1/hermes/plugin/manifest"),
    req: { method: "GET", headers: {} },
    res: {},
    readBody: async () => ({}),
    sendJson: (status, body) => {
      sent = { status, body };
    },
  });

  assert.deepEqual(handled, { handled: true });
  assert.equal(sent.status, 200);
  assert.equal(capturedManifestInput.baseUrl, "https://codex.example.test");
  assert.equal(capturedManifestInput.hermesOrigin, "https://home.example.test");
  assert.equal(capturedManifestInput.version, "0.1.11");
  assert.equal(capturedManifestInput.buildId, "build-route");
  assert.equal(capturedManifestInput.clientBuildId, "client-route");
  assert.equal(capturedManifestInput.shellCacheName, "shell-route");
  assert.equal(sent.body.clientBuildId, "client-route");
  assert.equal(sent.body.embedding.refreshOnVersionChange, true);
});

test("core authorized route exposes bounded Vite shell artifact readback", async () => {
  let sent = null;
  const service = createCoreApiRouteService({
    viteShellArtifactService: {
      readPublicArtifactStatus: () => ({
        ok: true,
        available: true,
        stage: "vite-shell-preview-html-v1",
        preview: {
          fileName: "preview.html",
          entryScript: "/vite-shell/assets/vite-shell-entry-test.js",
        },
        publishedFileCount: 4,
        issueCodes: [],
      }),
    },
  });

  const handled = await service.handleAuthorizedRoute({
    url: new URL("http://127.0.0.1:8787/api/vite-shell-artifact"),
    req: { method: "GET", headers: {} },
    res: {},
    readBody: async () => ({}),
    sendJson: (status, body) => {
      sent = { status, body };
    },
  });

  assert.deepEqual(handled, { handled: true });
  assert.equal(sent.status, 200);
  assert.equal(sent.body.ok, true);
  assert.equal(sent.body.stage, "vite-shell-preview-html-v1");
  assert.equal(sent.body.preview.fileName, "preview.html");
  assert.equal(sent.body.publishedFileCount, 4);
  assert.deepEqual(sent.body.issueCodes, []);
});

test("core shared-chain restart route forwards bounded default shell mode", async () => {
  let restartOptions = null;
  let sent = null;
  const service = createCoreApiRouteService({
    activeProfileRestartOptions: () => ({ profileId: "active", codexHome: "/home/active/.codex" }),
    sharedChainRestartDelayMs: 1200,
    sharedChainRestartService: {
      restart: (options) => {
        restartOptions = options;
        return { ok: true, mode: "macos-launchctl" };
      },
    },
  });

  const handled = await service.handleAuthorizedRoute({
    url: new URL("http://127.0.0.1:8787/api/restart/shared-chain"),
    req: { method: "POST", headers: {} },
    res: {},
    readBody: async () => ({ defaultShellMode: "app-preview" }),
    sendJson: (status, body) => {
      sent = { status, body };
    },
  });

  assert.deepEqual(handled, { handled: true });
  assert.equal(sent.status, 202);
  assert.equal(restartOptions.delayMs, 1200);
  assert.equal(restartOptions.profileId, "active");
  assert.equal(restartOptions.codexHome, "/home/active/.codex");
  assert.equal(restartOptions.defaultShellMode, "vite-app-preview");
});

test("core profile switch fails closed when target quota preflight fails", async () => {
  const progressService = createCodexProfileSwitchService();
  let setActiveProfileCalled = false;
  let invalidateProfilesCalled = false;
  let restartCalled = false;
  const trustCalls = [];
  const mcpCalls = [];
  let sent = null;

  const service = createCoreApiRouteService({
    activeProfileRestartOptions: () => {
      throw new Error("restart options should not be derived after failed preflight");
    },
    codexProfileService: {
      profiles: () => ({
        switchSupported: true,
        activeProfileId: "current",
        profiles: [
          {
            id: "target",
            label: "Target",
            codexHome: "/home/target/.codex",
            auth: { status: "loggedIn" },
          },
        ],
      }),
      setActiveProfile: () => {
        setActiveProfileCalled = true;
        throw new Error("setActiveProfile should not be called after failed preflight");
      },
    },
    getProfileSwitchProgress: progressService.getProfileSwitchProgress,
    httpStatusError: (statusCode, message) => {
      const err = new Error(message);
      err.statusCode = statusCode;
      return err;
    },
    liveQuotaSnapshotForProfiles: () => ({ rateLimits: null, rateLimitsByModel: {}, source: null }),
    preflightCodexProfileSwitch: async (_profile, options = {}) => {
      if (typeof options.onProgress === "function") {
        options.onProgress({
          stage: "preflight_rate_limits",
          status: "failed",
          message: "目标账号额度读取失败，未切换。请确认目标账号登录和网络可用后重试。",
          stepIndex: 7,
          code: "target_profile_rate_limits_unavailable",
          detail: "bounded quota read failure",
        });
      }
      const err = new Error("目标账号额度读取失败，未切换。请确认目标账号登录和网络可用后重试。");
      err.statusCode = 409;
      err.code = "target_profile_rate_limits_unavailable";
      err.detail = "bounded quota read failure";
      throw err;
    },
    profileSwitchLogDetail: progressService.profileSwitchLogDetail,
    profileSwitchProgressRequestId: progressService.profileSwitchProgressRequestId,
    publicConfigRuntimeCache: {
      invalidateProfiles: () => {
        invalidateProfilesCalled = true;
      },
    },
    setProfileSwitchProgress: progressService.setProfileSwitchProgress,
    sharedChainRestartDelayMs: 1200,
    sharedChainRestartService: {
      restart: () => {
        restartCalled = true;
        return { ok: true };
      },
    },
    syncCodexMobileMcpToolset: (codexHome) => {
      mcpCalls.push(codexHome);
    },
    syncRegisteredWorkspaceTrust: (codexHome) => {
      trustCalls.push(codexHome);
    },
  });

  const handled = await service.handlePublicRoute({
    url: new URL("http://127.0.0.1:8787/api/codex-profiles/active"),
    req: { method: "POST", headers: {} },
    res: {},
    readBody: async () => ({ profileId: "target", requestId: "switchtest1" }),
    sendJson: (status, body) => {
      sent = { status, body };
    },
  });

  assert.deepEqual(handled, { handled: true });
  assert.equal(sent.status, 409);
  assert.equal(sent.body.ok, false);
  assert.equal(sent.body.code, "target_profile_rate_limits_unavailable");
  assert.equal(sent.body.progress.status, "failed");
  assert.equal(sent.body.progress.failedStage, "preflight_rate_limits");
  assert.equal(setActiveProfileCalled, false);
  assert.equal(invalidateProfilesCalled, false);
  assert.equal(restartCalled, false);
  assert.deepEqual(trustCalls, ["/home/target/.codex"]);
  assert.deepEqual(mcpCalls, ["/home/target/.codex"]);
});

test("restart default shell mode body parser is fail closed", () => {
  assert.equal(restartDefaultShellModeFromBody({}), "");
  assert.equal(restartDefaultShellModeFromBody({ defaultShell: "classic-script-fallback" }), "classic");
  assert.equal(restartDefaultShellModeFromBody({ CODEX_MOBILE_DEFAULT_SHELL: "app-preview" }), "vite-app-preview");
  assert.throws(
    () => restartDefaultShellModeFromBody({ defaultShellMode: "rollout-next" }),
    /unsupported_default_shell_mode/,
  );
});
