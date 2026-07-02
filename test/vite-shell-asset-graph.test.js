"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

async function loadAssetGraphModule() {
  return import("../scripts/frontend-shell-asset-graph.mjs");
}

async function loadShellManifestGenerator() {
  return import("../scripts/generate-frontend-shell-manifest.mjs");
}

test("Vite shell asset graph covers the current ordered frontend shell", async () => {
  const { buildShellAssetManifest } = await loadAssetGraphModule();
  const manifest = buildShellAssetManifest(path.resolve(__dirname, ".."));
  assert.equal(manifest.validation.ok, true);
  assert.match(manifest.shellCacheName, /^codex-mobile-shell-v625-[a-f0-9]{12}$/);
  assert.match(manifest.clientBuildId, /^0\.1\.11\|codex-mobile-shell-v625-[a-f0-9]{12}$/);
  assert.equal(manifest.indexScriptAssets[0], "/shell-asset-manifest.js");
  assert.equal(manifest.indexScriptAssets.at(-1), "/app.js");
  assert.ok(manifest.indexScriptAssets.includes("/app-bootstrap.js"));
  assert.ok(manifest.indexScriptAssets.includes("/runtime-wiring-runtime.js"));
  assert.ok(manifest.indexScriptAssets.includes("/app-shell-runtime.js"));
  assert.ok(manifest.swStaticAssets.includes("/pane-layout-runtime.js"));
  assert.ok(manifest.swStaticAssets.includes("/shell-asset-manifest.json"));
  assert.ok(manifest.pageShellAssets.includes("/sw.js"));
  assert.ok(manifest.serverHashAssets.includes("/app-shell-runtime.js"));
  assert.ok(manifest.serverHashAssets.includes("/shell-asset-manifest.json"));
  assert.equal(manifest.entryGroups.length, 6);
  assert.ok(manifest.classicGlobalExports.length >= 50);
  const appBootstrapExports = manifest.classicGlobalExports.find((entry) => entry.asset === "/app-bootstrap.js");
  assert.ok(appBootstrapExports);
  for (const name of ["$", "CLIENT_BUILD_ID", "PAGE_SHELL_ASSETS", "apiClient", "draftStore", "fetchPublicConfigWithRetry", "state"]) {
    assert.ok(appBootstrapExports.globals.includes(name), `missing app-bootstrap global ${name}`);
  }
  assert.deepEqual(
    manifest.classicGlobalExports.find((entry) => entry.asset === "/runtime-wiring-runtime.js").globals,
    ["CodexRuntimeWiringRuntime"]
  );
  assert.deepEqual(
    manifest.classicGlobalExports.find((entry) => entry.asset === "/app-shell-runtime.js").globals,
    ["CodexAppShellRuntime"]
  );
  assert.deepEqual(
    manifest.classicGlobalExports.find((entry) => entry.asset === "/app.js").globals,
    ["CodexMobileAppEntry"]
  );
  assert.ok(manifest.startupGlobalContracts.length > 30);
  assert.deepEqual(
    manifest.startupGlobalContracts.find((entry) => entry.name === "CodexRuntimeWiringRuntime"),
    {
      name: "CodexRuntimeWiringRuntime",
      asset: "/runtime-wiring-runtime.js",
      groupId: "app-entry",
      startupCritical: true,
      source: "startup-window-guard",
      present: true,
    }
  );
  assert.deepEqual(
    manifest.startupGlobalContracts.find((entry) => entry.name === "CodexThreadDetailRuntime"),
    {
      name: "CodexThreadDetailRuntime",
      asset: "/thread-detail-runtime.js",
      groupId: "feature-runtimes",
      startupCritical: false,
      source: "startup-window-guard",
      present: true,
    }
  );
  assert.deepEqual(
    manifest.startupGlobalContracts.find((entry) => entry.name === "state"),
    {
      name: "state",
      asset: "/app-bootstrap.js",
      groupId: "bootstrap-state",
      startupCritical: true,
      source: "app-bootstrap-script-global",
      present: true,
    }
  );
  assert.deepEqual(
    manifest.startupGlobalContracts.find((entry) => entry.name === "apiClient"),
    {
      name: "apiClient",
      asset: "/app-bootstrap.js",
      groupId: "bootstrap-state",
      startupCritical: true,
      source: "app-bootstrap-script-global",
      present: true,
    }
  );
  assert.deepEqual(
    manifest.entryGroups.flatMap((group) => group.assets),
    manifest.indexScriptAssets
  );
  const groupsById = new Map(manifest.entryGroups.map((group) => [group.id, group]));
  assert.deepEqual(groupsById.get("bootstrap-state").assets, ["/app-bootstrap.js"]);
  assert.deepEqual(groupsById.get("app-entry").assets, [
    "/runtime-wiring-runtime.js",
    "/app-shell-runtime.js",
    "/app.js",
  ]);
  assert.equal(groupsById.get("bootstrap-state").startupCritical, true);
  assert.equal(groupsById.get("app-entry").startupCritical, true);
  assert.equal(groupsById.get("feature-runtimes").startupCritical, false);
  assert.equal(groupsById.get("shell-services").startupCritical, false);
  assert.ok(manifest.assets.some((asset) => asset.path === "/" && asset.sourcePath === "public/index.html"));
  assert.ok(manifest.assets.every((asset) => asset.exists));
});

test("classic shell cache name changes when static shell asset contents change", async () => {
  const { buildPublicShellManifest } = await loadShellManifestGenerator();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-shell-cache-hash-"));
  fs.mkdirSync(path.join(root, "public"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "0.1.11" }));
  fs.writeFileSync(path.join(root, "public", "manifest.json"), JSON.stringify({ icons: [] }));
  fs.writeFileSync(path.join(root, "public", "styles.css"), ".app{}\n");
  fs.writeFileSync(path.join(root, "public", "index.html"), [
    "<!doctype html>",
    "<link rel=\"stylesheet\" href=\"/styles.css\">",
    "<script src=\"/shell-asset-manifest.js\"></script>",
    "<script src=\"/a.js\"></script>",
  ].join("\n"));
  fs.writeFileSync(path.join(root, "public", "sw.js"), "importScripts(\"/shell-asset-manifest.js\");\n");
  fs.writeFileSync(path.join(root, "public", "a.js"), "\"use strict\";\nwindow.A = 1;\n");

  const first = buildPublicShellManifest(root);
  fs.writeFileSync(path.join(root, "public", "a.js"), "\"use strict\";\nwindow.A = 2;\n");
  const second = buildPublicShellManifest(root);

  assert.match(first.shellCacheName, /^codex-mobile-shell-v625-[a-f0-9]{12}$/);
  assert.match(second.shellCacheName, /^codex-mobile-shell-v625-[a-f0-9]{12}$/);
  assert.notEqual(second.shellCacheName, first.shellCacheName);
  assert.notEqual(second.clientBuildId, first.clientBuildId);
});

test("Vite shell entry imports the asset-graph ESM compatibility module", async () => {
  const {
    VITE_ESM_COMPATIBILITY_MODULES,
    VITE_ESM_COMPATIBILITY_SHARD_SOURCE_PREFIX,
    VITE_ESM_COMPATIBILITY_SOURCE,
    buildViteEsmCompatibilityShards,
    createShellEntryGroupVirtualModulePlugin,
  } = await loadAssetGraphModule();
  const root = path.resolve(__dirname, "..");
  const source = fs.readFileSync(path.join(root, "frontend", "vite-shell-entry.mjs"), "utf8");
  assert.match(source, /virtual:codex-mobile-esm-compatibility/);
  assert.match(source, /import\("virtual:codex-mobile-esm-compatibility"\)/);
  assert.doesNotMatch(source, /import\s+\{\s*codexMobileViteEsmCompatibility\s*\}\s+from\s+"virtual:codex-mobile-esm-compatibility"/);
  assert.match(source, /__CODEX_MOBILE_VITE_ESM_COMPATIBILITY_PROMISE__/);
  assert.doesNotMatch(source, /\.\.\/public\/build-refresh-policy\.js/);
  assert.match(source, /__CODEX_MOBILE_VITE_ESM_COMPATIBILITY__/);
  assert.match(source, /codexMobileEsmCompatibility/);
  const expectedEsmModuleIds = [
    "build-refresh-policy",
    "runtime-settings",
    "viewport-metrics",
    "conversation-scroll",
    "thread-performance-metrics",
    "draft-store",
    "image-compressor",
    "plugin-voice-input",
    "api-client",
    "markdown-renderer",
    "plugin-embed",
    "frontend-runtime-health",
    "home-ai-diagnostic-reporting",
    "thread-diagnostic-events",
    "thread-tile-layout",
    "thread-tile-actions",
    "modal-runtime",
    "runtime-wiring-runtime",
    "composer-bridge-runtime",
    "api-client-runtime",
    "thread-list-load-policy",
    "thread-list-stable-order",
    "thread-status-hints",
    "thread-detail-patch-plan",
    "thread-detail-actions",
    "thread-detail-merge-state",
    "thread-detail-v4-merge-state",
    "client-render-stability-guard",
    "live-operation-dock-state",
  ];
  assert.deepEqual(VITE_ESM_COMPATIBILITY_MODULES.map((entry) => entry.id), expectedEsmModuleIds);
  const plugin = createShellEntryGroupVirtualModulePlugin({ root });
  const resolved = plugin.resolveId(VITE_ESM_COMPATIBILITY_SOURCE);
  assert.equal(resolved, `\0${VITE_ESM_COMPATIBILITY_SOURCE}`);
  const virtualSource = plugin.load(resolved);
  assert.match(virtualSource, /codexMobileViteEsmCompatibility/);
  assert.match(virtualSource, /codexMobileViteEsmCompatibilityShardSources/);
  assert.match(virtualSource, new RegExp(VITE_ESM_COMPATIBILITY_SHARD_SOURCE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(virtualSource, /public\/build-refresh-policy\.js/);
  const shards = buildViteEsmCompatibilityShards(root);
  assert.ok(shards.length >= 1);
  assert.equal(shards.reduce((total, shard) => total + shard.moduleCount, 0), VITE_ESM_COMPATIBILITY_MODULES.length);
  const shardSources = shards.map((shard) => {
    const shardResolved = plugin.resolveId(shard.source);
    assert.equal(shardResolved, `\0${shard.source}`);
    return plugin.load(shardResolved);
  }).join("\n");
  assert.match(shardSources, /public\/api-client\.js/);
  assert.match(shardSources, /public\/markdown-renderer\.js/);
  assert.match(shardSources, /public\/build-refresh-policy\.js/);
  assert.match(shardSources, /public\/runtime-settings\.js/);
  assert.match(shardSources, /public\/viewport-metrics\.js/);
  assert.match(shardSources, /public\/conversation-scroll\.js/);
  assert.match(shardSources, /public\/thread-performance-metrics\.js/);
  assert.match(shardSources, /public\/image-compressor\.js/);
  assert.match(shardSources, /public\/plugin-voice-input\.js/);
  assert.match(shardSources, /public\/plugin-embed\.js/);
  assert.match(shardSources, /public\/frontend-runtime-health\.js/);
  assert.match(shardSources, /public\/home-ai-diagnostic-reporting\.js/);
  assert.match(shardSources, /public\/thread-diagnostic-events\.js/);
  assert.match(shardSources, /public\/draft-store\.js/);
  assert.match(shardSources, /public\/thread-tile-layout\.js/);
  assert.match(shardSources, /public\/thread-tile-actions\.js/);
  assert.match(shardSources, /public\/modal-runtime\.js/);
  assert.match(shardSources, /public\/runtime-wiring-runtime\.js/);
  assert.match(shardSources, /public\/composer-bridge-runtime\.js/);
  assert.match(shardSources, /public\/api-client-runtime\.js/);
  assert.match(shardSources, /public\/thread-list-load-policy\.js/);
  assert.match(shardSources, /public\/thread-list-stable-order\.js/);
  assert.match(shardSources, /public\/thread-status-hints\.js/);
  assert.match(shardSources, /public\/thread-detail-patch-plan\.js/);
  assert.match(shardSources, /public\/thread-detail-actions\.js/);
  assert.match(shardSources, /public\/thread-detail-merge-state\.js/);
  assert.match(shardSources, /public\/thread-detail-v4-merge-state\.js/);
  assert.match(shardSources, /public\/client-render-stability-guard\.js/);
  assert.match(shardSources, /public\/live-operation-dock-state\.js/);
  assert.match(shardSources, /createApiClient/);
  assert.match(shardSources, /renderMarkdownTable/);
  assert.match(shardSources, /planThreadListLoadRequest/);
  assert.match(shardSources, /planBottomFollowScrollSchedule/);
  assert.match(shardSources, /threadDetailTimings/);
  assert.match(shardSources, /compressedImageName/);
  assert.match(shardSources, /capabilityStateMessage/);
  assert.match(shardSources, /routeHintOpenPlan/);
  assert.match(shardSources, /threadListInteractionStallEffects/);
  assert.match(shardSources, /createDiagnosticReporter/);
  assert.match(shardSources, /threadDetailResponseDiagnosticEffects/);
  assert.match(shardSources, /stablePixelChanged/);
  assert.match(shardSources, /planThreadDetailRefreshRequest/);
  assert.match(shardSources, /visibleTurnOrderMismatch/);
  assert.match(shardSources, /createDraftStore/);
  assert.match(shardSources, /threadTileColumnGroups/);
  assert.match(shardSources, /resolveThreadTileDropAction/);
  assert.match(shardSources, /createModalRuntime/);
  assert.match(shardSources, /createRuntimeWiringRuntime/);
  assert.match(shardSources, /createComposerBridgeRuntime/);
  assert.match(shardSources, /createApiClientRuntime/);
  assert.match(shardSources, /server-newer/);
  assert.match(shardSources, /planThreadListStableOrder/);
  assert.match(shardSources, /shouldMarkThreadUnread/);
  assert.match(shardSources, /planVisibleItemRefreshPatch/);
  assert.match(shardSources, /resolveThreadDetailClickAction/);
  assert.match(shardSources, /createThreadDetailMergePolicy/);
  assert.match(shardSources, /createThreadDetailV4MergePolicy/);
  assert.match(shardSources, /renderLiveOperationDock/);
  assert.match(shardSources, /operationCardContentPlan/);
});

test("Vite shell build contract records entry chunks and classic fallback outputs", async () => {
  const {
    VITE_ENTRY_GROUP_SOURCE_PREFIX,
    VITE_ESM_COMPATIBILITY_MODULES,
    VITE_ESM_COMPATIBILITY_SOURCE,
    buildViteEsmCompatibilityShards,
    buildShellAssetManifest,
    buildViteShellBuildContract,
  } = await loadAssetGraphModule();
  const root = path.resolve(__dirname, "..");
  const manifest = buildShellAssetManifest(root);
  const compatibilityShards = buildViteEsmCompatibilityShards(root);
  assert.ok(compatibilityShards.length >= 1);
  const bundle = {
    "assets/vite-shell-entry-example.js": {
      type: "chunk",
      fileName: "assets/vite-shell-entry-example.js",
      name: "vite-shell-entry",
      facadeModuleId: path.join(root, "frontend", "vite-shell-entry.mjs"),
      isEntry: true,
      isDynamicEntry: false,
      imports: [],
      dynamicImports: [
        "assets/vite-esm-compatibility-example.js",
        "assets/app-bootstrap-example.js",
        "assets/vite-deferred-entry-topology-example.js",
      ],
    },
    "assets/vite-esm-compatibility-example.js": {
      type: "chunk",
      fileName: "assets/vite-esm-compatibility-example.js",
      name: "codex-mobile-esm-compatibility",
      facadeModuleId: `\0${VITE_ESM_COMPATIBILITY_SOURCE}`,
      isEntry: false,
      isDynamicEntry: true,
      imports: ["assets/vite-shell-entry-example.js"],
      dynamicImports: compatibilityShards.map((shard) => `assets/vite-esm-compatibility-${shard.id}-example.js`),
    },
    "assets/app-bootstrap-example.js": {
      type: "chunk",
      fileName: "assets/app-bootstrap-example.js",
      name: "app-bootstrap",
      facadeModuleId: path.join(root, "public", "app-bootstrap.js"),
      isEntry: false,
      isDynamicEntry: true,
      imports: ["assets/vite-shell-entry-example.js"],
      dynamicImports: [],
    },
    "assets/vite-deferred-entry-topology-example.js": {
      type: "chunk",
      fileName: "assets/vite-deferred-entry-topology-example.js",
      name: "vite-deferred-entry-topology",
      facadeModuleId: path.join(root, "frontend", "vite-deferred-entry-topology.mjs"),
      isEntry: false,
      isDynamicEntry: true,
      imports: ["assets/vite-shell-entry-example.js"],
      dynamicImports: [],
    },
  };
  for (const shard of compatibilityShards) {
    bundle[`assets/vite-esm-compatibility-${shard.id}-example.js`] = {
      type: "chunk",
      fileName: `assets/vite-esm-compatibility-${shard.id}-example.js`,
      name: `codex-mobile-esm-compatibility-${shard.id}`,
      facadeModuleId: `\0${shard.source}`,
      isEntry: false,
      isDynamicEntry: true,
      imports: ["assets/vite-esm-compatibility-example.js", "assets/vite-shared-runtime-example.js"],
      dynamicImports: [],
    };
  }
  bundle["assets/vite-shared-runtime-example.js"] = {
    type: "chunk",
    fileName: "assets/vite-shared-runtime-example.js",
    name: "vite-shared-runtime",
    facadeModuleId: "",
    isEntry: false,
    isDynamicEntry: false,
    imports: [],
    dynamicImports: [],
  };
  for (const group of manifest.entryGroups) {
    const groupId = String(group.id).toLowerCase();
    bundle["assets/vite-shell-entry-example.js"].dynamicImports.push(`assets/vite-entry-group-${groupId}-example.js`);
    bundle[`assets/vite-entry-group-${groupId}-example.js`] = {
      type: "chunk",
      fileName: `assets/vite-entry-group-${groupId}-example.js`,
      name: `vite-entry-group-${groupId}`,
      facadeModuleId: `\0${VITE_ENTRY_GROUP_SOURCE_PREFIX}${groupId}`,
      isEntry: true,
      isDynamicEntry: false,
      imports: [],
      dynamicImports: [],
    };
  }
  const contract = buildViteShellBuildContract(manifest, bundle);
  assert.equal(contract.validation.ok, true);
  assert.equal(contract.stage, "vite-shell-artifact-contract-v1");
  assert.equal(contract.productionExecution, "classic-script-fallback");
  assert.equal(contract.entryGroupImportOwner, "vite-shell-entry");
  assert.equal(contract.viteEntry.source, "frontend/vite-shell-entry.mjs");
  assert.equal(contract.viteEntry.fileName, "assets/vite-shell-entry-example.js");
  assert.deepEqual(contract.viteEntry.dynamicImports, [
    "assets/vite-esm-compatibility-example.js",
    "assets/app-bootstrap-example.js",
    "assets/vite-deferred-entry-topology-example.js",
    ...manifest.entryGroups.map((group) => `assets/vite-entry-group-${String(group.id).toLowerCase()}-example.js`),
  ]);
  assert.equal(contract.viteEsmCompatibilityChunks.length, compatibilityShards.length + 1);
  assert.ok(contract.viteEsmCompatibilityChunks.some((chunk) => chunk.source === VITE_ESM_COMPATIBILITY_SOURCE));
  assert.deepEqual(
    contract.viteEsmCompatibilityChunks
      .map((chunk) => chunk.source)
      .filter((source) => source.includes("/shard/"))
      .sort(),
    compatibilityShards.map((shard) => shard.source).sort()
  );
  assert.equal(contract.viteDeferredChunks.length, 1);
  assert.equal(contract.viteDeferredChunks[0].source, "frontend/vite-deferred-entry-topology.mjs");
  assert.deepEqual(contract.viteOwnedAppBootstrapChunks.map((chunk) => chunk.source), ["public/app-bootstrap.js"]);
  assert.equal(contract.viteEntryGroupChunks.length, manifest.entryGroups.length);
  assert.equal(contract.viteSharedChunks.length, 1);
  assert.equal(contract.viteSharedChunks[0].fileName, "assets/vite-shared-runtime-example.js");
  assert.equal(contract.entryDynamicImportGraph.owner, "vite-shell-entry");
  assert.equal(contract.entryDynamicImportGraph.esmCompatibilityFileCount, 1);
  assert.equal(contract.entryDynamicImportGraph.deferredFileCount, 1);
  assert.equal(contract.entryDynamicImportGraph.entryGroupFileCount, manifest.entryGroups.length);
  assert.equal(contract.startupCompatibility.requiredGlobalCount, manifest.startupGlobalContracts.length);
  assert.equal(contract.startupCompatibility.hashCount, manifest.startupGlobalContracts.length);
  assert.equal(
    contract.startupCompatibility.assetCount,
    new Set(manifest.startupGlobalContracts.map((entry) => entry.asset).filter(Boolean)).size
  );
  assert.ok(contract.startupCompatibility.byteCount > 0);
  assert.equal(contract.appPreviewClassicLoaderPlan.owner, "vite-shell-entry");
  assert.equal(contract.appPreviewClassicLoaderPlan.sourceScriptCount, manifest.indexScriptAssets.length);
  assert.equal(contract.appPreviewClassicLoaderPlan.excludedEsmScriptCount, VITE_ESM_COMPATIBILITY_MODULES.length);
  assert.equal(contract.appPreviewClassicLoaderPlan.excludedEsmHashCount, VITE_ESM_COMPATIBILITY_MODULES.length);
  assert.equal(contract.appPreviewClassicLoaderPlan.excludedViteOwnedScriptCount, 1);
  assert.equal(contract.appPreviewClassicLoaderPlan.excludedViteOwnedHashCount, 1);
  assert.equal(
    contract.appPreviewClassicLoaderPlan.scriptCount
      + contract.appPreviewClassicLoaderPlan.excludedEsmScriptCount
      + contract.appPreviewClassicLoaderPlan.excludedViteOwnedScriptCount,
    manifest.indexScriptAssets.length
  );
  assert.equal(contract.appPreviewClassicLoaderPlan.hashCount, contract.appPreviewClassicLoaderPlan.scriptCount);
  const loaderScriptPaths = contract.appPreviewClassicLoaderPlan.scripts.map((entry) => entry.path);
  assert.ok(loaderScriptPaths.length > 0);
  assert.equal(contract.appPreviewClassicLoaderPlan.scriptCount, loaderScriptPaths.length);
  assert.equal(contract.appPreviewClassicLoaderPlan.firstScript, loaderScriptPaths[0]);
  assert.equal(contract.appPreviewClassicLoaderPlan.lastScript, loaderScriptPaths[loaderScriptPaths.length - 1]);
  assert.match(contract.appPreviewClassicLoaderPlan.sha256, /^[a-f0-9]{64}$/);
  const loaderPlanCoveredScripts = new Set([
    ...contract.appPreviewClassicLoaderPlan.scripts.map((entry) => entry.path),
    ...contract.appPreviewClassicLoaderPlan.excludedEsmScripts.map((entry) => entry.path),
    ...contract.appPreviewClassicLoaderPlan.excludedViteOwnedScripts.map((entry) => entry.path),
  ]);
  assert.deepEqual(manifest.indexScriptAssets.filter((entry) => loaderPlanCoveredScripts.has(entry)), manifest.indexScriptAssets);
  const esmModuleIdByAssetPath = new Map(VITE_ESM_COMPATIBILITY_MODULES.map((entry) => [
    `/${entry.source.replace(/^public\//, "")}`,
    entry.id,
  ]));
  const expectedExcludedEsmIds = manifest.indexScriptAssets
    .map((entry) => esmModuleIdByAssetPath.get(entry))
    .filter(Boolean);
  assert.deepEqual(
    contract.appPreviewClassicLoaderPlan.excludedEsmScripts.map((entry) => entry.esmModuleId),
    expectedExcludedEsmIds
  );
  assert.deepEqual(
    contract.appPreviewClassicLoaderPlan.excludedViteOwnedScripts.map((entry) => ({
      path: entry.path,
      ownerId: entry.ownerId,
      globalName: entry.globalName,
    })),
    [
      {
        path: "/shell-asset-manifest.js",
        ownerId: "shell-manifest",
        globalName: "CODEX_MOBILE_SHELL_MANIFEST",
      },
    ]
  );
  assert.ok(contract.appPreviewClassicLoaderPlan.scripts.every((entry) => entry.groupId && entry.bytes > 0));
  assert.ok(contract.appPreviewClassicLoaderPlan.scripts.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)));
  assert.ok(contract.appPreviewClassicLoaderPlan.excludedEsmScripts.every((entry) => entry.globalName && /^[a-f0-9]{64}$/.test(entry.sha256)));
  assert.ok(contract.appPreviewClassicLoaderPlan.excludedViteOwnedScripts.every((entry) => entry.ownerId && entry.globalName && /^[a-f0-9]{64}$/.test(entry.sha256)));
  assert.equal(contract.esmCompatibility.owner, "vite-shell-entry");
  assert.equal(contract.esmCompatibility.virtualModuleSource, VITE_ESM_COMPATIBILITY_SOURCE);
  assert.equal(contract.esmCompatibility.shardCount, compatibilityShards.length);
  assert.deepEqual(
    contract.esmCompatibility.shards.map((shard) => shard.source).sort(),
    compatibilityShards.map((shard) => shard.source).sort()
  );
  assert.equal(
    contract.esmCompatibility.shards.reduce((total, shard) => total + shard.moduleCount, 0),
    VITE_ESM_COMPATIBILITY_MODULES.length
  );
  assert.equal(contract.esmCompatibility.moduleCount, VITE_ESM_COMPATIBILITY_MODULES.length);
  assert.equal(contract.esmCompatibility.hashCount, VITE_ESM_COMPATIBILITY_MODULES.length);
  assert.equal(
    contract.esmCompatibility.expectedFunctionCount,
    VITE_ESM_COMPATIBILITY_MODULES.reduce((total, entry) => total + entry.expectedFunctions.length, 0)
  );
  assert.deepEqual(
    contract.esmCompatibility.modules.map((entry) => entry.id),
    VITE_ESM_COMPATIBILITY_MODULES.map((entry) => entry.id)
  );
  assert.deepEqual(
    contract.esmCompatibility.modules.map((entry) => entry.assetPath),
    VITE_ESM_COMPATIBILITY_MODULES.map((entry) => `/${entry.source.replace(/^public\//, "")}`)
  );
  assert.ok(contract.esmCompatibility.modules.every((entry) => entry.classicLoaderExcluded === true));
  assert.ok(contract.esmCompatibility.modules.every((entry) => entry.bytes > 0));
  assert.ok(contract.esmCompatibility.modules.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)));
  assert.deepEqual(
    contract.startupCompatibility.requiredGlobals.find((entry) => entry.name === "CodexAppShellRuntime"),
    {
      name: "CodexAppShellRuntime",
      asset: "/app-shell-runtime.js",
      groupId: "app-entry",
      startupCritical: true,
      source: "startup-window-guard",
      present: true,
      exportedAsset: "/app-shell-runtime.js",
      hashPresent: true,
      bytes: contract.startupCompatibility.requiredGlobals.find((entry) => entry.name === "CodexAppShellRuntime").bytes,
      sha256: contract.startupCompatibility.requiredGlobals.find((entry) => entry.name === "CodexAppShellRuntime").sha256,
    }
  );
  assert.match(
    contract.startupCompatibility.requiredGlobals.find((entry) => entry.name === "CodexAppShellRuntime").sha256,
    /^[a-f0-9]{64}$/
  );
  assert.deepEqual(contract.entryDynamicImportGraph.missingFiles, []);
  assert.deepEqual(contract.entryDynamicImportGraph.extraFiles, []);
  assert.deepEqual(
    contract.entryDynamicImportGraph.actualFiles.slice().sort(),
    contract.entryDynamicImportGraph.expectedFiles.slice().sort()
  );
  assert.deepEqual(
    contract.viteEntryGroupChunks.map((chunk) => chunk.groupId).sort(),
    manifest.entryGroups.map((group) => group.id).sort()
  );
  const appEntryChunk = contract.viteEntryGroupChunks.find((chunk) => chunk.groupId === "app-entry");
  assert.deepEqual(appEntryChunk.assets, [
    "/runtime-wiring-runtime.js",
    "/app-shell-runtime.js",
    "/app.js",
  ]);
  assert.equal(appEntryChunk.assetCount, 3);
  assert.equal(appEntryChunk.classicAssetRecords.length, 3);
  assert.equal(appEntryChunk.classicAssetHashCount, 3);
  assert.ok(appEntryChunk.classicAssetBytes > 0);
  assert.ok(appEntryChunk.classicAssetRecords.every((entry) => /^\/.+\.js$/.test(entry.path)));
  assert.ok(appEntryChunk.classicAssetRecords.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)));
  assert.equal(appEntryChunk.classicGlobalExportAssetCount, 3);
  assert.equal(appEntryChunk.classicGlobalExportCount, 3);
  assert.deepEqual(
    appEntryChunk.startupGlobalContracts.map((entry) => entry.name).sort(),
    ["CodexAppShellRuntime", "CodexRuntimeWiringRuntime"]
  );
  assert.ok(contract.outputFiles.includes("assets/vite-shell-entry-example.js"));
  assert.ok(contract.outputFiles.includes("assets/vite-esm-compatibility-example.js"));
  for (const shard of compatibilityShards) {
    assert.ok(contract.outputFiles.includes(`assets/vite-esm-compatibility-${shard.id}-example.js`));
  }
  assert.ok(contract.outputFiles.includes("assets/vite-shared-runtime-example.js"));
  assert.ok(contract.outputFiles.includes("assets/vite-deferred-entry-topology-example.js"));
  assert.ok(contract.outputFiles.includes("assets/vite-entry-group-app-entry-example.js"));
  assert.ok(contract.outputFiles.includes("codex-mobile-shell-manifest.json"));
  assert.ok(contract.classicShellAssets.some((asset) => asset.path === "/app.js" && asset.fileName === "shell-assets/app.js"));
  assert.equal(contract.classicFallback.scriptBlock.source, "generated-classic-index-script-block");
  assert.equal(contract.classicFallback.scriptBlock.scriptCount, manifest.indexScriptAssets.length);
  assert.equal(contract.classicFallback.scriptBlock.firstScript, "/shell-asset-manifest.js");
  assert.equal(contract.classicFallback.scriptBlock.lastScript, "/app.js");
  assert.match(contract.classicFallback.scriptBlock.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(contract.classicFallback.entryGroups, manifest.entryGroups);
  assert.deepEqual(contract.classicFallback.classicGlobalExports, manifest.classicGlobalExports);
  assert.deepEqual(contract.classicFallback.startupGlobalContracts, manifest.startupGlobalContracts);
});

test("Vite entry group virtual modules preserve bounded group payloads", async () => {
  const {
    VITE_ENTRY_GROUP_LOADER_SOURCE,
    VITE_ENTRY_GROUP_SOURCE_PREFIX,
    createShellEntryGroupVirtualModulePlugin,
  } = await loadAssetGraphModule();
  const plugin = createShellEntryGroupVirtualModulePlugin({ root: path.resolve(__dirname, "..") });
  const loaderResolved = plugin.resolveId(VITE_ENTRY_GROUP_LOADER_SOURCE);
  assert.equal(loaderResolved, `\0${VITE_ENTRY_GROUP_LOADER_SOURCE}`);
  const loaderSource = plugin.load(loaderResolved);
  assert.match(loaderSource, /export const codexMobileViteEntryGroupIds = /);
  assert.match(loaderSource, /loadCodexMobileViteEntryGroups/);
  assert.match(loaderSource, /__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_PROMISE__/);
  assert.match(loaderSource, /virtual:codex-mobile-shell-entry-group\/app-entry/);
  const resolved = plugin.resolveId(`${VITE_ENTRY_GROUP_SOURCE_PREFIX}app-entry`);
  assert.equal(resolved, `\0${VITE_ENTRY_GROUP_SOURCE_PREFIX}app-entry`);
  const source = plugin.load(resolved);
  assert.match(source, /export const codexMobileViteEntryGroup = /);
  assert.match(source, /__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__/);
  assert.match(source, /codexMobileViteEntryGroupRegistry\[codexMobileViteEntryGroup\.id\]/);
  assert.match(source, /"id": "app-entry"/);
  assert.match(source, /"\/app\.js"/);
  assert.match(source, /"classicGlobalExports"/);
  assert.match(source, /"classicAssetHashCount": 3/);
  assert.match(source, /"classicGlobalExportCount": 3/);
  assert.match(source, /"startupGlobalContracts"/);
  assert.match(source, /"CodexRuntimeWiringRuntime"/);
});

test("frontend shell generator owns the index classic script block", async () => {
  const {
    SHELL_SCRIPT_BLOCK_END,
    SHELL_SCRIPT_BLOCK_START,
    canonicalShellScriptAssets,
    generatedIndexHtmlSource,
  } = await import("../scripts/generate-frontend-shell-manifest.mjs");
  const scriptAssets = canonicalShellScriptAssets();
  const source = [
    "<!doctype html>",
    "<html>",
    "<body>",
    SHELL_SCRIPT_BLOCK_START,
    "  <script src=\"/stale-manual-script.js\"></script>",
    SHELL_SCRIPT_BLOCK_END,
    "<script>window.afterGeneratedBlock = true;</script>",
    "</body>",
    "</html>",
  ].join("\n");
  const generated = generatedIndexHtmlSource(source, { scriptAssets });
  assert.ok(generated.includes(SHELL_SCRIPT_BLOCK_START));
  assert.ok(generated.includes(SHELL_SCRIPT_BLOCK_END));
  assert.ok(generated.includes('<script src="/shell-asset-manifest.js"></script>'));
  assert.ok(generated.includes('<script src="/app.js"></script>'));
  assert.ok(!generated.includes("/stale-manual-script.js"));
  assert.ok(generated.includes("window.afterGeneratedBlock = true"));
  assert.deepEqual(scriptAssets.slice(0, 2), ["/shell-asset-manifest.js", "/api-client.js"]);
  assert.equal(scriptAssets.at(-1), "/app.js");
});

test("Vite shell asset graph fails closed when generated manifest is stale", async () => {
  const { buildShellAssetManifest } = await loadAssetGraphModule();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-shell-assets-"));
  fs.mkdirSync(path.join(root, "public", "icons"), { recursive: true });
  fs.mkdirSync(path.join(root, "services", "runtime"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "0.1.11" }));
  fs.writeFileSync(path.join(root, "public", "manifest.json"), JSON.stringify({ icons: [] }));
  fs.writeFileSync(path.join(root, "public", "styles.css"), "");
  fs.writeFileSync(path.join(root, "public", "index.html"), [
    "<!doctype html>",
    "<link rel=\"stylesheet\" href=\"/styles.css\">",
    "<script src=\"/shell-asset-manifest.js\"></script>",
    "<script src=\"/a.js\"></script>",
  ].join("\n"));
  fs.writeFileSync(path.join(root, "public", "a.js"), "\"use strict\";\n");
  fs.writeFileSync(path.join(root, "public", "sw.js"), [
    "importScripts(\"/shell-asset-manifest.js\");",
    "const SHELL_MANIFEST = self.CODEX_MOBILE_SHELL_MANIFEST || {};",
    "const CACHE_NAME = SHELL_MANIFEST.shellCacheName;",
    "const STATIC_ASSETS = SHELL_MANIFEST.precacheAssets;",
  ].join("\n"));
  fs.writeFileSync(path.join(root, "public", "app-bootstrap.js"), [
    "function readShellManifest() { return window.CODEX_MOBILE_SHELL_MANIFEST || {}; }",
    "function shellManifestList(name) { return readShellManifest()[name] || []; }",
    "var CLIENT_BUILD_ID = readShellManifest().clientBuildId;",
    "var PAGE_SHELL_ASSETS = Object.freeze(shellManifestList(\"pageShellAssets\"));",
  ].join("\n"));
  fs.writeFileSync(path.join(root, "services", "runtime", "server-runtime-utils.js"), [
    "function readShellAssetManifest() {",
    "  return JSON.parse(require(\"node:fs\").readFileSync(\"shell-asset-manifest.json\", \"utf8\"));",
    "}",
  ].join("\n"));
  const staleManifest = {
    schemaVersion: 2,
    generatedBy: "test-stale-manifest",
    shellCacheName: "codex-mobile-shell-test",
    clientBuildId: "0.1.11|codex-mobile-shell-test",
    scriptAssets: ["/shell-asset-manifest.js", "/a.js"],
    entryGroups: [{
      id: "ordered-classic-scripts",
      phase: "compatibility",
      startupCritical: true,
      chunkTarget: "ordered-classic-scripts",
      assets: ["/shell-asset-manifest.js", "/a.js"],
    }],
    linkAssets: ["/styles.css"],
    iconAssets: [],
    precacheAssets: ["/", "/index.html", "/styles.css", "/manifest.json", "/shell-asset-manifest.js", "/a.js", "/shell-asset-manifest.json"],
    pageShellAssets: ["/", "/index.html", "/styles.css", "/manifest.json", "/shell-asset-manifest.js", "/a.js", "/shell-asset-manifest.json", "/sw.js"],
    hashAssets: ["/index.html", "/styles.css", "/manifest.json", "/shell-asset-manifest.js", "/a.js", "/shell-asset-manifest.json", "/sw.js"],
  };
  fs.writeFileSync(path.join(root, "public", "shell-asset-manifest.json"), `${JSON.stringify(staleManifest, null, 2)}\n`);
  fs.writeFileSync(path.join(root, "public", "shell-asset-manifest.js"), [
    "\"use strict\";",
    "(function (root) {",
    `  root.CODEX_MOBILE_SHELL_MANIFEST = ${JSON.stringify(staleManifest)};`,
    "}(typeof globalThis !== \"undefined\" ? globalThis : this));",
    "",
  ].join("\n"));
  fs.writeFileSync(path.join(root, "public", "index.html"), [
    "<!doctype html>",
    "<link rel=\"stylesheet\" href=\"/styles.css\">",
    "<script src=\"/shell-asset-manifest.js\"></script>",
    "<script src=\"/a.js\"></script>",
    "<script src=\"/b.js\"></script>",
  ].join("\n"));
  fs.writeFileSync(path.join(root, "public", "b.js"), "\"use strict\";\n");
  const manifest = buildShellAssetManifest(root);
  assert.equal(manifest.validation.ok, false);
  assert.ok(manifest.validation.issues.some((issue) => issue.code === "public_shell_manifest_out_of_date"));
  assert.ok(manifest.validation.issues.some((issue) => issue.code === "sw_missing_index_script" && issue.asset === "/b.js"));
});
