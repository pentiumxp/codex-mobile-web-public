"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createCoreApiRouteService,
  restartDefaultShellModeFromBody,
} = require("../server-routes/core-api-route-service");
const { createCodexProfileSwitchService } = require("../adapters/codex-profile-switch-service");
const {
  createRemoteManagedWorkspaceSettingsService,
} = require("../services/remote-managed-workspaces/remote-managed-workspace-settings-service");

test("core API route adapter re-exports server-routes service", () => {
  const adapter = require("../adapters/core-api-route-service");
  const canonical = require("../server-routes/core-api-route-service");
  assert.equal(adapter.createCoreApiRouteService, canonical.createCoreApiRouteService);
});

test("core approval route returns bounded stale and duplicate statuses", async () => {
  const statuses = [];
  const service = createCoreApiRouteService({
    codex: {
      answerServerRequest(requestId) {
        if (requestId === "stale") throw new Error("Approval request is no longer pending");
        throw new Error("Approval request has already been answered");
      },
    },
  });

  for (const requestId of ["stale", "duplicate"]) {
    const handled = await service.handleAuthorizedRoute({
      url: new URL(`http://127.0.0.1:8787/api/approvals/${requestId}`),
      req: { method: "POST", headers: {} },
      res: {},
      readBody: async () => ({ decision: "allow_once" }),
      sendJson: (status, body) => statuses.push({ requestId, status, body }),
    });
    assert.deepEqual(handled, { handled: true });
  }

  assert.equal(statuses[0].status, 404);
  assert.equal(statuses[0].body.code, "approval_request_no_longer_pending");
  assert.equal(statuses[1].status, 409);
  assert.equal(statuses[1].body.code, "approval_request_already_answered");
});

test("core public config route uses injected runtime dependencies", async () => {
  let refreshedRateLimits = false;
  let loadedRecentRateLimits = false;
  let syncedMcpToolsets = false;
  let resolvedModelOptions = false;
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
    remoteManagedWorkspaceSettingsService: {
      publicSettings: () => ({ enabled: true, workspaceKind: "remote_managed_workspace", connectionStatus: "connected" }),
    },
    requestBaseUrl: () => "http://127.0.0.1:8787",
    resolveModelOptions: async () => {
      resolvedModelOptions = true;
      return ["gpt-test", "gpt-5.6-sol"];
    },
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
  assert.equal(resolvedModelOptions, true);
  assert.deepEqual(sent.body.modelOptions, ["gpt-test", "gpt-5.6-sol"]);
  assert.equal(sent.body.workspaceDelegation.enabled, true);
  assert.equal(sent.body.remoteManagedWorkspace.connectionStatus, "connected");
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

test("core remote managed workspace settings route masks enrollment token readback", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-core-route-"));
  const projectRoot = path.join(dir, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  const settingsService = createRemoteManagedWorkspaceSettingsService({
    fs,
    path,
    settingsFile: path.join(dir, "settings.json"),
    stateFile: path.join(dir, "state.json"),
    enrollmentTokenFile: path.join(dir, "secret", "enrollment-token"),
  });
  let settingsChanged = 0;
  let sent = null;
  const service = createCoreApiRouteService({
    httpStatusError: (statusCode, message) => {
      const err = new Error(message);
      err.statusCode = statusCode;
      return err;
    },
    remoteManagedWorkspaceSettingsService: settingsService,
    remoteManagedWorkspaceRunnerService: {
      handleSettingsChanged: () => {
        settingsChanged += 1;
      },
    },
  });

  try {
    const handled = await service.handleAuthorizedRoute({
      url: new URL("http://127.0.0.1:8787/api/settings/remote-managed-workspace"),
      req: { method: "POST", headers: {} },
      res: {},
      readBody: async () => ({
        enabled: true,
        workspaceId: "rmw_core",
        nodeName: "core-node",
        centralUrl: "http://127.0.0.1:9888",
        projectRoot,
        allowedRoot: dir,
        enrollmentToken: "core-secret-token",
      }),
      sendJson: (status, body) => {
        sent = { status, body };
      },
    });

    assert.deepEqual(handled, { handled: true });
    assert.equal(settingsChanged, 1);
    assert.equal(sent.status, 200);
    assert.equal(sent.body.remoteManagedWorkspace.enrollmentTokenConfigured, true);
    assert.doesNotMatch(JSON.stringify(sent.body), /core-secret-token/);

    await service.handleAuthorizedRoute({
      url: new URL("http://127.0.0.1:8787/api/settings/remote-managed-workspace"),
      req: { method: "GET", headers: {} },
      res: {},
      readBody: async () => ({}),
      sendJson: (status, body) => {
        sent = { status, body };
      },
    });
    assert.equal(sent.status, 200);
    assert.equal(sent.body.remoteManagedWorkspace.workspaceId, "rmw_core");
    assert.doesNotMatch(JSON.stringify(sent.body), /core-secret-token/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("core remote managed workspace workspace action auto-generates internal settings", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-core-action-"));
  const projectRoot = path.join(dir, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  const settingsService = createRemoteManagedWorkspaceSettingsService({
    fs,
    path,
    settingsFile: path.join(dir, "settings.json"),
    stateFile: path.join(dir, "state.json"),
    enrollmentTokenFile: path.join(dir, "secret", "enrollment-token"),
  });
  let settingsChanged = 0;
  let sent = null;
  const service = createCoreApiRouteService({
    httpStatusError: (statusCode, message) => {
      const err = new Error(message);
      err.statusCode = statusCode;
      return err;
    },
    remoteManagedWorkspaceSettingsService: settingsService,
    remoteManagedWorkspaceRunnerService: {
      handleSettingsChanged: () => {
        settingsChanged += 1;
      },
    },
  });

  try {
    const handled = await service.handleAuthorizedRoute({
      url: new URL("http://127.0.0.1:8787/api/settings/remote-managed-workspace/workspace"),
      req: { method: "POST", headers: {} },
      res: {},
      readBody: async () => ({
        action: "enable",
        centralUrl: "http://127.0.0.1:9888",
        enrollmentToken: "workspace-action-secret",
        workspace: {
          cwd: projectRoot,
          label: "Route Project",
        },
      }),
      sendJson: (status, body) => {
        sent = { status, body };
      },
    });

    assert.deepEqual(handled, { handled: true });
    assert.equal(settingsChanged, 1);
    assert.equal(sent.status, 200);
    assert.match(sent.body.remoteManagedWorkspace.workspaceId, /^rmw_route-project_[a-f0-9]{12}$/);
    assert.equal(sent.body.remoteManagedWorkspace.projectRoot, projectRoot);
    assert.equal(sent.body.remoteManagedWorkspace.allowedRoot, projectRoot);
    assert.equal(sent.body.remoteManagedWorkspace.enrollmentTokenConfigured, true);
    assert.doesNotMatch(JSON.stringify(sent.body), /workspace-action-secret/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("core client-events route schedules user-behavior repair cards without blocking response", async () => {
  const scheduled = [];
  const logEvents = [];
  const service = createCoreApiRouteService({
    logClientEvent: (event, details) => {
      logEvents.push({ event, details });
    },
    scheduleBackgroundTask: (fn) => {
      scheduled.push(fn);
    },
    userBehaviorRepairCardService: {
      handleClientEvent: async (event, envelope) => ({
        ok: true,
        created: event === "home_ai_diagnostic_failure_recorded",
        issueCode: envelope.details && envelope.details.error_code || "",
        cardId: "ttc_client_event_test",
        direct: true,
        autoApprove: true,
      }),
    },
  });
  const response = { statusCode: 0, headers: null, ended: false };

  const handled = await service.handleAuthorizedRoute({
    url: new URL("http://127.0.0.1:8787/api/client-events"),
    req: { method: "POST", headers: { "user-agent": "CodexMobileTest/1.0" } },
    res: {
      writeHead: (statusCode, headers) => {
        response.statusCode = statusCode;
        response.headers = headers;
      },
      end: () => {
        response.ended = true;
      },
    },
    readBody: async () => ({
      event: "home_ai_diagnostic_failure_recorded",
      threadId: "thread-1",
      path: "/thread/thread-1",
      details: {
        error_code: "submitted_message_dom_duplicate",
      },
    }),
    sendJson: () => {
      throw new Error("client-events route should use 204 response");
    },
  });

  assert.deepEqual(handled, { handled: true });
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.equal(response.ended, true);
  assert.equal(scheduled.length, 1);
  assert.equal(logEvents[0].event, "home_ai_diagnostic_failure_recorded");

  await scheduled[0]();
  assert.equal(logEvents[1].event, "user_behavior_repair_card_created");
  assert.equal(logEvents[1].details.threadId, "thread-1");
  assert.equal(logEvents[1].details.issueCode, "submitted_message_dom_duplicate");
  assert.equal(logEvents[1].details.cardId, "ttc_client_event_test");
});

test("core Hermes plugin session route replays existing plugin sessions without reusing launch tokens", async () => {
  const calls = [];
  let sent = null;
  const service = createCoreApiRouteService({
    hermesPluginService: {
      isLaunchTokenAuthorized: (token) => token === "cpl_live_launch",
      readSession: ({ token }) => token === "cps_live_session"
        ? { ok: true, session_key: "cps_live_session", expires_in: 300, token_type: "codex_mobile_plugin_session" }
        : null,
      createSession: (body) => {
        calls.push(body);
        return { ok: true, session_key: "cps_new_session", expires_in: 300, token_type: "codex_mobile_plugin_session" };
      },
    },
    pluginSessionCookieHeader: (_req, session) => `codex_mobile_plugin_session=${session.session_key}; Path=/`,
    requestAuthToken: () => "cpl_consumed_launch",
    requestAuthTokens: () => ["cpl_consumed_launch", "cps_live_session"],
  });

  const handled = await service.handleAuthorizedRoute({
    url: new URL("http://127.0.0.1:8787/api/v1/hermes/plugin/session?codexPluginLaunch=cpl_consumed_launch"),
    req: { method: "POST", headers: { cookie: "codex_mobile_plugin_session=cps_live_session" } },
    res: {},
    readBody: async () => ({}),
    sendJson: (status, body, headers) => {
      sent = { status, body, headers };
    },
  });

  assert.deepEqual(handled, { handled: true });
  assert.equal(sent.status, 200);
  assert.equal(sent.body.session_key, "cps_live_session");
  assert.match(sent.headers["Set-Cookie"], /cps_live_session/);
  assert.deepEqual(calls, []);
});

test("core Hermes plugin session route still exchanges explicit launch tokens once", async () => {
  let createSessionBody = null;
  let sent = null;
  const service = createCoreApiRouteService({
    hermesPluginService: {
      isLaunchTokenAuthorized: (token) => token === "cpl_live_launch",
      readSession: () => null,
      createSession: (body) => {
        createSessionBody = body;
        return { ok: true, session_key: "cps_new_session", expires_in: 300, token_type: "codex_mobile_plugin_session" };
      },
    },
    pluginSessionCookieHeader: (_req, session) => `codex_mobile_plugin_session=${session.session_key}; Path=/`,
    requestAuthToken: () => "cpl_live_launch",
    requestAuthTokens: () => ["cpl_live_launch"],
  });

  const handled = await service.handleAuthorizedRoute({
    url: new URL("http://127.0.0.1:8787/api/v1/hermes/plugin/session"),
    req: { method: "POST", headers: {} },
    res: {},
    readBody: async () => ({ codexPluginLaunch: "cpl_explicit_launch" }),
    sendJson: (status, body) => {
      sent = { status, body };
    },
  });

  assert.deepEqual(handled, { handled: true });
  assert.equal(sent.status, 200);
  assert.equal(sent.body.session_key, "cps_new_session");
  assert.equal(createSessionBody.token, "cpl_explicit_launch");
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

test("core readiness routes distinguish listener health from restart drain readiness", async () => {
  const sent = [];
  const service = createCoreApiRouteService({
    restartDrainService: {
      status: () => ({
        ok: false,
        ready: false,
        draining: true,
        reason: "macos_plugin_deploy",
        retryAfterSeconds: 7,
        issueCodes: ["listener_restart_draining"],
        activeTurnCount: 1,
      }),
    },
  });

  const health = await service.handlePublicRoute({
    url: new URL("http://127.0.0.1:8787/api/healthz"),
    req: { method: "GET", headers: {} },
    res: {},
    readBody: async () => ({}),
    sendJson: (status, body, headers) => sent.push({ status, body, headers }),
  });
  const ready = await service.handlePublicRoute({
    url: new URL("http://127.0.0.1:8787/api/readyz"),
    req: { method: "GET", headers: {} },
    res: {},
    readBody: async () => ({}),
    sendJson: (status, body, headers) => sent.push({ status, body, headers }),
  });

  assert.deepEqual(health, { handled: true });
  assert.deepEqual(ready, { handled: true });
  assert.equal(sent[0].status, 200);
  assert.equal(sent[0].body.ready, true);
  assert.equal(sent[1].status, 503);
  assert.equal(sent[1].body.reason, "macos_plugin_deploy");
  assert.equal(sent[1].body.activeTurnCount, 1);
  assert.equal(sent[1].headers["Retry-After"], "7");
});

test("core restart drain route marks listener not ready before deploy restart", async () => {
  let captured = null;
  let sent = null;
  const service = createCoreApiRouteService({
    restartDrainService: {
      beginDrain: (input) => {
        captured = input;
        return {
          ok: false,
          ready: false,
          draining: true,
          reason: input.reason,
          issueCodes: ["listener_restart_draining"],
          activeTurnCount: input.activeTurnCount,
        };
      },
    },
  });

  const handled = await service.handleAuthorizedRoute({
    url: new URL("http://127.0.0.1:8787/api/restart/drain"),
    req: { method: "POST", headers: {} },
    res: {},
    readBody: async () => ({
      reason: "macos_plugin_deploy",
      source: "deploy_script",
      maxDrainMs: 900000,
      activeTurnCount: 2,
    }),
    sendJson: (status, body) => {
      sent = { status, body };
    },
  });

  assert.deepEqual(handled, { handled: true });
  assert.equal(sent.status, 202);
  assert.equal(sent.body.ready, false);
  assert.deepEqual(captured, {
    reason: "macos_plugin_deploy",
    source: "deploy_script",
    maxDrainMs: 900000,
    activeTurnCount: 2,
  });
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
