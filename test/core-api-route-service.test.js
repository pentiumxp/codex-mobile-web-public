"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createCoreApiRouteService,
  restartDefaultShellModeFromBody,
} = require("../server-routes/core-api-route-service");

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
  assert.equal(sent.body.threadListFallbackPrewarm.pending, false);
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

test("restart default shell mode body parser is fail closed", () => {
  assert.equal(restartDefaultShellModeFromBody({}), "");
  assert.equal(restartDefaultShellModeFromBody({ defaultShell: "classic-script-fallback" }), "classic");
  assert.equal(restartDefaultShellModeFromBody({ CODEX_MOBILE_DEFAULT_SHELL: "app-preview" }), "vite-app-preview");
  assert.throws(
    () => restartDefaultShellModeFromBody({ defaultShellMode: "rollout-next" }),
    /unsupported_default_shell_mode/,
  );
});
