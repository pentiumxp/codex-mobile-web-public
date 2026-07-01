"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createCoreApiRouteService,
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
      publicConfig: () => ({ uploads: { enabled: true } }),
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
  assert.equal(sent.body.defaultModel, "gpt-test");
  assert.equal(sent.body.workspaceDelegation.enabled, true);
  assert.equal(sent.body.threadListFallbackPrewarm.pending, false);
});

test("core authorized route exposes bounded Vite shell artifact readback", async () => {
  let sent = null;
  const service = createCoreApiRouteService({
    viteShellArtifactService: {
      readPublicArtifactStatus: () => ({
        ok: true,
        available: true,
        stage: "vite-shell-public-preview-v1",
        publishedFileCount: 3,
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
  assert.equal(sent.body.stage, "vite-shell-public-preview-v1");
  assert.equal(sent.body.publishedFileCount, 3);
  assert.deepEqual(sent.body.issueCodes, []);
});
