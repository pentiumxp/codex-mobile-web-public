"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const adapter = require("../adapters/vite-shell-artifact-service");
const service = require("../services/runtime/vite-shell-artifact-service");

const CLASSIC_SHELL_SCRIPT_BLOCK_START = "<!-- CODEX_MOBILE_SHELL_SCRIPTS:BEGIN -->";
const CLASSIC_SHELL_SCRIPT_BLOCK_END = "<!-- CODEX_MOBILE_SHELL_SCRIPTS:END -->";
const SHELL_MANIFEST_JS_FIXTURE = Buffer.from("window.CODEX_MOBILE_SHELL_MANIFEST = {};\n");
const APP_BOOTSTRAP_JS_FIXTURE = Buffer.from("window.CodexAppBootstrap = true;\n");
const APP_JS_FIXTURE = Buffer.from("window.CodexAppShellRuntime = { createAppShellRuntime: function () {} };\n");
const STABLE_ENTRY_JS_FIXTURE = Buffer.from("import \"./assets/vite-shell-entry-test.js\";\n");

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function renderClassicShellScriptBlock(scriptAssets) {
  return [
    CLASSIC_SHELL_SCRIPT_BLOCK_START,
    ...scriptAssets.map((asset) => `  <script src="${asset}"></script>`),
    CLASSIC_SHELL_SCRIPT_BLOCK_END,
  ].join("\n");
}

function classicShellScriptBlockContract(scriptAssets) {
  const source = renderClassicShellScriptBlock(scriptAssets);
  return {
    schemaVersion: 1,
    source: "generated-classic-index-script-block",
    startMarker: CLASSIC_SHELL_SCRIPT_BLOCK_START,
    endMarker: CLASSIC_SHELL_SCRIPT_BLOCK_END,
    scriptCount: scriptAssets.length,
    firstScript: scriptAssets[0] || "",
    lastScript: scriptAssets.length ? scriptAssets[scriptAssets.length - 1] : "",
    sha256: sha256Hex(Buffer.from(source, "utf8")),
  };
}

function appPreviewClassicLoaderPlanContract(shellManifest) {
  const assetRecords = new Map((shellManifest.assets || []).map((entry) => [entry.path, entry]));
  const groupByAsset = new Map();
  for (const group of shellManifest.entryGroups || []) {
    for (const asset of group.assets || []) {
      groupByAsset.set(asset, group);
    }
  }
  function scriptRecord(asset, sourceIndex, index) {
    const record = assetRecords.get(asset) || {};
    const group = groupByAsset.get(asset) || {};
    return {
      index,
      sourceIndex,
      path: asset,
      groupId: group.id || "",
      phase: group.phase || "",
      startupCritical: Boolean(group.startupCritical),
      chunkTarget: group.chunkTarget || "",
      sourcePath: record.sourcePath || "",
      bytes: Number(record.bytes) || 0,
      sha256: record.sha256 || "",
    };
  }
  const scripts = [];
  const excludedEsmScripts = [];
  const excludedViteOwnedScripts = [];
  for (const [sourceIndex, asset] of (shellManifest.indexScriptAssets || []).entries()) {
    if (asset === "/shell-asset-manifest.js") {
      excludedViteOwnedScripts.push({
        ...scriptRecord(asset, sourceIndex, sourceIndex),
        ownerId: "shell-manifest",
        globalName: "CODEX_MOBILE_SHELL_MANIFEST",
      });
      continue;
    }
    if (asset === "/app-bootstrap.js") {
      excludedViteOwnedScripts.push({
        ...scriptRecord(asset, sourceIndex, sourceIndex),
        ownerId: "app-bootstrap",
        globalName: "CodexAppBootstrap",
      });
      continue;
    }
    if (asset === "/app.js") {
      excludedEsmScripts.push({
        ...scriptRecord(asset, sourceIndex, sourceIndex),
        esmModuleId: "app-shell-runtime",
        globalName: "CodexAppShellRuntime",
      });
      continue;
    }
    scripts.push(scriptRecord(asset, sourceIndex, scripts.length));
  }
  const contract = {
    schemaVersion: 1,
    source: "generated-vite-app-preview-classic-loader-plan",
    owner: "vite-shell-entry",
    sourceScriptCount: (shellManifest.indexScriptAssets || []).length,
    scriptCount: scripts.length,
    firstScript: scripts[0] ? scripts[0].path : "",
    lastScript: scripts.length ? scripts[scripts.length - 1].path : "",
    hashCount: scripts.filter((entry) => entry.sha256).length,
    byteCount: scripts.reduce((total, entry) => total + (Number(entry.bytes) || 0), 0),
    excludedEsmScriptCount: excludedEsmScripts.length,
    excludedEsmHashCount: excludedEsmScripts.filter((entry) => entry.sha256).length,
    excludedEsmByteCount: excludedEsmScripts.reduce((total, entry) => total + (Number(entry.bytes) || 0), 0),
    excludedViteOwnedScriptCount: excludedViteOwnedScripts.length,
    excludedViteOwnedHashCount: excludedViteOwnedScripts.filter((entry) => entry.sha256).length,
    excludedViteOwnedByteCount: excludedViteOwnedScripts.reduce((total, entry) => total + (Number(entry.bytes) || 0), 0),
    excludedEsmScripts,
    excludedViteOwnedScripts,
    scripts,
  };
  return {
    ...contract,
    sha256: sha256Hex(Buffer.from(JSON.stringify(contract), "utf8")),
  };
}

function esmCompatibilityContract() {
  const modules = [{
    index: 0,
    id: "app-shell-runtime",
    source: "public/app.js",
    assetPath: "/app.js",
    nativeSource: "",
    importSource: "public/app.js",
    compatibilityMode: "classic-global-compat",
    globalName: "CodexAppShellRuntime",
    classicLoaderExcluded: true,
    expectedFunctions: ["createAppShellRuntime"],
    expectedFunctionCount: 1,
    bytes: APP_JS_FIXTURE.length,
    sha256: sha256Hex(APP_JS_FIXTURE),
    hashPresent: true,
  }];
  return {
    schemaVersion: 1,
    source: "generated-vite-esm-compatibility-contract",
    owner: "vite-shell-entry",
    virtualModuleSource: "virtual:codex-mobile-esm-compatibility",
    virtualShardSourcePrefix: "virtual:codex-mobile-esm-compatibility/shard/",
    shardCount: 1,
    shards: [{
      id: "shard-01",
      index: 0,
      source: "virtual:codex-mobile-esm-compatibility/shard/shard-01",
      moduleCount: 1,
      moduleIds: ["app-shell-runtime"],
      byteCount: APP_JS_FIXTURE.length,
    }],
    moduleCount: modules.length,
    nativeEsmModuleCount: 0,
    classicGlobalCompatibilityModuleCount: modules.length,
    expectedFunctionCount: 1,
    hashCount: modules.length,
    byteCount: APP_JS_FIXTURE.length,
    modules,
  };
}

function writeArtifact(root, options = {}) {
  const artifactRoot = path.join(root, "public", "vite-shell");
  fs.mkdirSync(path.join(artifactRoot, "assets"), { recursive: true });
  const entry = Buffer.from("export const entry = true;\n");
  const esmCompatibilityChunk = Buffer.from("export const compat = true;\n");
  const esmCompatibilityShardChunk = Buffer.from("export const shard = true;\n");
  const sharedChunk = Buffer.from("export const shared = true;\n");
  const appBootstrapChunk = Buffer.from("export const appBootstrap = true;\n");
  const deferred = Buffer.from("export const deferred = true;\n");
  const entryGroup = Buffer.from("export const group = true;\n");
  const stage = options.stage || "vite-shell-preview-html-v1";
  fs.mkdirSync(path.join(root, "public"), { recursive: true });
  fs.writeFileSync(path.join(root, "public", "shell-asset-manifest.js"), SHELL_MANIFEST_JS_FIXTURE);
  fs.writeFileSync(path.join(root, "public", "app-bootstrap.js"), APP_BOOTSTRAP_JS_FIXTURE);
  fs.writeFileSync(path.join(root, "public", "app.js"), APP_JS_FIXTURE);
  const shellManifest = options.shellManifest || {
    shellCacheName: "codex-mobile-shell-test",
    clientBuildId: "0.1.11|codex-mobile-shell-test",
    indexScriptAssets: ["/shell-asset-manifest.js", "/app-bootstrap.js", "/app.js"],
    swStaticAssets: ["/", "/index.html", "/shell-asset-manifest.js", "/app-bootstrap.js", "/app.js", "/shell-asset-manifest.json"],
    pageShellAssets: ["/", "/index.html", "/shell-asset-manifest.js", "/app-bootstrap.js", "/app.js", "/shell-asset-manifest.json", "/sw.js"],
    hashAssets: ["/index.html", "/shell-asset-manifest.js", "/app-bootstrap.js", "/app.js", "/shell-asset-manifest.json", "/sw.js"],
    entryGroups: [{
      id: "app-entry",
      phase: "startup-critical",
      startupCritical: true,
      chunkTarget: "startup-app-shell",
      assets: ["/app.js"],
    }],
    classicGlobalExports: [{
      asset: "/app.js",
      globals: ["CodexAppShellRuntime"],
    }],
    startupGlobalContracts: [{
      name: "CodexAppShellRuntime",
      asset: "/app.js",
      groupId: "app-entry",
      startupCritical: true,
      source: "startup-window-guard",
      present: true,
    }],
    assets: [{
      path: "/shell-asset-manifest.js",
      sourcePath: "public/shell-asset-manifest.js",
      exists: true,
      bytes: SHELL_MANIFEST_JS_FIXTURE.length,
      sha256: sha256Hex(SHELL_MANIFEST_JS_FIXTURE),
    }, {
      path: "/app-bootstrap.js",
      sourcePath: "public/app-bootstrap.js",
      exists: true,
      bytes: APP_BOOTSTRAP_JS_FIXTURE.length,
      sha256: sha256Hex(APP_BOOTSTRAP_JS_FIXTURE),
    }, {
      path: "/app.js",
      sourcePath: "public/app.js",
      exists: true,
      bytes: APP_JS_FIXTURE.length,
      sha256: sha256Hex(APP_JS_FIXTURE),
    }],
  };
  const classicScriptBlock = classicShellScriptBlockContract(shellManifest.indexScriptAssets);
  const appPreviewClassicLoaderPlan = appPreviewClassicLoaderPlanContract(shellManifest);
  const esmCompatibility = esmCompatibilityContract();
  fs.writeFileSync(path.join(root, "public", "index.html"), [
    "<!doctype html>",
    "<html>",
    "<body>",
    renderClassicShellScriptBlock(shellManifest.indexScriptAssets),
    "</body>",
    "</html>",
    "",
  ].join("\n"));
  const preview = Buffer.from([
    "<!doctype html>",
    "<link rel=\"modulepreload\" href=\"/vite-shell/assets/vite-shell-entry-test.js\" data-codex-vite-stable-entry-target=\"true\">",
    "<link rel=\"modulepreload\" href=\"/vite-shell/assets/vite-entry-group-app-entry-test.js\" data-codex-vite-entry-group-chunk=\"true\">",
    "<main id=\"codex-vite-shell-preview\" data-stage=\"vite-shell-preview-html-v1\" data-entry-group-import-owner=\"vite-shell-entry\" data-startup-global-contract-count=\"1\" data-esm-compatibility-module-count=\"1\"></main>",
    "<script type=\"module\" src=\"/vite-shell/app-preview-entry.js\"></script>",
    "",
  ].join("\n"));
  const appPreview = Buffer.from([
    "<!doctype html>",
    "<html data-codex-vite-app-preview=\"true\">",
    "<head>",
    "<meta name=\"codex-vite-app-preview\" content=\"vite-shell-app-preview-v1\">",
    "</head>",
    "<body>",
    "<!-- CODEX_MOBILE_VITE_APP_PREVIEW:BEGIN -->",
    "<script id=\"codex-vite-app-preview-loader-plan\" type=\"application/json\" data-codex-vite-app-preview-loader-plan=\"true\">",
    JSON.stringify(appPreviewClassicLoaderPlan),
    "</script>",
    "<link rel=\"modulepreload\" href=\"/vite-shell/assets/vite-shell-entry-test.js\" data-codex-vite-stable-entry-target=\"true\">",
    "<script type=\"module\" src=\"/vite-shell/app-preview-entry.js\" data-codex-vite-app-preview-entry=\"true\"></script>",
    "<!-- CODEX_MOBILE_VITE_APP_PREVIEW:END -->",
    "</body>",
    "</html>",
    "",
  ].join("\n"));
  const manifest = Buffer.from(JSON.stringify({
    ...shellManifest,
    viteBuild: {
      stage: "vite-shell-artifact-contract-v1",
      productionExecution: "vite-app-preview-native-esm",
      entryDynamicImportGraph: {
        owner: "vite-shell-entry",
        actualFiles: [
          "assets/vite-esm-compatibility-test.js",
          "assets/app-bootstrap-test.js",
          "assets/vite-deferred-entry-topology-test.js",
          "assets/vite-entry-group-app-entry-test.js",
        ],
        expectedFiles: [
          "assets/vite-esm-compatibility-test.js",
          "assets/app-bootstrap-test.js",
          "assets/vite-deferred-entry-topology-test.js",
          "assets/vite-entry-group-app-entry-test.js",
        ],
        missingFiles: [],
        extraFiles: [],
        esmCompatibilityFileCount: 1,
        viteOwnedFileCount: 1,
        deferredFileCount: 1,
        entryGroupFileCount: 1,
      },
      viteEsmCompatibilityChunks: [{
        source: "virtual:codex-mobile-esm-compatibility",
        fileName: "assets/vite-esm-compatibility-test.js",
      }, {
        source: "virtual:codex-mobile-esm-compatibility/shard/shard-01",
        fileName: "assets/vite-esm-compatibility-shard-01-test.js",
      }],
      viteOwnedAppBootstrapChunks: [{
        source: "public/app-bootstrap.js",
        fileName: "assets/app-bootstrap-test.js",
      }],
      appPreviewClassicLoaderPlan,
      esmCompatibility,
    },
  }, null, 2));
  fs.writeFileSync(path.join(artifactRoot, "assets", "vite-shell-entry-test.js"), entry);
  fs.writeFileSync(path.join(artifactRoot, "assets", "vite-esm-compatibility-test.js"), esmCompatibilityChunk);
  fs.writeFileSync(path.join(artifactRoot, "assets", "vite-esm-compatibility-shard-01-test.js"), esmCompatibilityShardChunk);
  fs.writeFileSync(path.join(artifactRoot, "assets", "vite-shared-runtime-test.js"), sharedChunk);
  fs.writeFileSync(path.join(artifactRoot, "assets", "app-bootstrap-test.js"), appBootstrapChunk);
  fs.writeFileSync(path.join(artifactRoot, "assets", "vite-deferred-entry-topology-test.js"), deferred);
  fs.writeFileSync(path.join(artifactRoot, "assets", "vite-entry-group-app-entry-test.js"), entryGroup);
  fs.writeFileSync(path.join(artifactRoot, "app-preview-entry.js"), STABLE_ENTRY_JS_FIXTURE);
  fs.writeFileSync(path.join(artifactRoot, "codex-mobile-shell-manifest.json"), manifest);
  fs.writeFileSync(path.join(artifactRoot, "preview.html"), preview);
  fs.writeFileSync(path.join(artifactRoot, "app-preview.html"), appPreview);
  const readback = {
    schemaVersion: 1,
    stage,
    sourceBuildStage: "vite-shell-artifact-contract-v1",
    productionExecution: "vite-app-preview-native-esm",
    entryGroupImportOwner: "vite-shell-entry",
    classicShellScriptBlock: classicScriptBlock,
    entryDynamicImportGraph: {
      owner: "vite-shell-entry",
      actualFiles: [
        "assets/vite-esm-compatibility-test.js",
        "assets/app-bootstrap-test.js",
        "assets/vite-deferred-entry-topology-test.js",
        "assets/vite-entry-group-app-entry-test.js",
      ],
      expectedFiles: [
        "assets/vite-esm-compatibility-test.js",
        "assets/app-bootstrap-test.js",
        "assets/vite-deferred-entry-topology-test.js",
        "assets/vite-entry-group-app-entry-test.js",
      ],
      missingFiles: [],
      extraFiles: [],
      esmCompatibilityFileCount: 1,
      viteOwnedFileCount: 1,
      deferredFileCount: 1,
      entryGroupFileCount: 1,
    },
    shellCacheName: "codex-mobile-shell-test",
    clientBuildId: "0.1.11|codex-mobile-shell-test",
    entry: {
      source: "frontend/vite-shell-entry.mjs",
      fileName: "assets/vite-shell-entry-test.js",
    },
    esmCompatibilityChunks: [{
      source: "virtual:codex-mobile-esm-compatibility",
      fileName: "assets/vite-esm-compatibility-test.js",
      entryScript: "/vite-shell/assets/vite-esm-compatibility-test.js",
    }, {
      source: "virtual:codex-mobile-esm-compatibility/shard/shard-01",
      fileName: "assets/vite-esm-compatibility-shard-01-test.js",
      entryScript: "/vite-shell/assets/vite-esm-compatibility-shard-01-test.js",
    }],
    sharedChunks: [{
      name: "vite-shared-runtime",
      source: "",
      fileName: "assets/vite-shared-runtime-test.js",
      entryScript: "/vite-shell/assets/vite-shared-runtime-test.js",
    }],
    viteOwnedAppBootstrapChunks: [{
      source: "public/app-bootstrap.js",
      fileName: "assets/app-bootstrap-test.js",
      entryScript: "/vite-shell/assets/app-bootstrap-test.js",
    }],
    deferredChunks: [{
      source: "frontend/vite-deferred-entry-topology.mjs",
      fileName: "assets/vite-deferred-entry-topology-test.js",
    }],
    entryGroupChunks: [{
      groupId: "app-entry",
      phase: "startup-critical",
      startupCritical: true,
      chunkTarget: "startup-app-shell",
      source: "virtual:codex-mobile-shell-entry-group/app-entry",
      fileName: "assets/vite-entry-group-app-entry-test.js",
      entryScript: "/vite-shell/assets/vite-entry-group-app-entry-test.js",
      assetCount: 1,
      classicAssetRecords: [{
        path: "/app.js",
        sourcePath: "public/app.js",
        bytes: APP_JS_FIXTURE.length,
        sha256: sha256Hex(APP_JS_FIXTURE),
      }],
      classicAssetHashCount: 1,
      classicAssetBytes: APP_JS_FIXTURE.length,
      classicGlobalExportAssetCount: 1,
      classicGlobalExportCount: 1,
    }],
    startupGlobalContracts: [{
      name: "CodexAppShellRuntime",
      asset: "/app.js",
      groupId: "app-entry",
      startupCritical: true,
      source: "startup-window-guard",
      exportedAsset: "/app.js",
      bytes: APP_JS_FIXTURE.length,
      sha256: sha256Hex(APP_JS_FIXTURE),
    }],
    appPreviewClassicLoaderPlan,
    esmCompatibility,
    preview: {
      fileName: "preview.html",
      entryScript: "/vite-shell/app-preview-entry.js",
      targetEntryScript: "/vite-shell/assets/vite-shell-entry-test.js",
    },
    stableEntry: {
      fileName: "app-preview-entry.js",
      entryScript: "/vite-shell/app-preview-entry.js",
      targetEntryFileName: "assets/vite-shell-entry-test.js",
      targetEntryScript: "/vite-shell/assets/vite-shell-entry-test.js",
    },
    appPreview: {
      fileName: "app-preview.html",
      entryScript: "/vite-shell/app-preview-entry.js",
      targetEntryScript: "/vite-shell/assets/vite-shell-entry-test.js",
      sourceShell: "public/index.html",
    },
    publishedFiles: [
      { fileName: "codex-mobile-shell-manifest.json", bytes: manifest.length, sha256: sha256Hex(manifest) },
      { fileName: "assets/vite-shell-entry-test.js", bytes: entry.length, sha256: sha256Hex(entry) },
      { fileName: "assets/vite-esm-compatibility-test.js", bytes: esmCompatibilityChunk.length, sha256: sha256Hex(esmCompatibilityChunk) },
      { fileName: "assets/vite-esm-compatibility-shard-01-test.js", bytes: esmCompatibilityShardChunk.length, sha256: sha256Hex(esmCompatibilityShardChunk) },
      { fileName: "assets/vite-shared-runtime-test.js", bytes: sharedChunk.length, sha256: sha256Hex(sharedChunk) },
      { fileName: "assets/app-bootstrap-test.js", bytes: appBootstrapChunk.length, sha256: sha256Hex(appBootstrapChunk) },
      { fileName: "assets/vite-deferred-entry-topology-test.js", bytes: deferred.length, sha256: sha256Hex(deferred) },
      { fileName: "assets/vite-entry-group-app-entry-test.js", bytes: entryGroup.length, sha256: sha256Hex(entryGroup) },
      { fileName: "app-preview-entry.js", bytes: STABLE_ENTRY_JS_FIXTURE.length, sha256: sha256Hex(STABLE_ENTRY_JS_FIXTURE) },
      { fileName: "preview.html", bytes: preview.length, sha256: sha256Hex(preview) },
      { fileName: "app-preview.html", bytes: appPreview.length, sha256: sha256Hex(appPreview) },
    ],
    validation: { ok: true, issues: [] },
  };
  fs.writeFileSync(path.join(artifactRoot, "vite-shell-readback.json"), `${JSON.stringify(readback, null, 2)}\n`);
  return artifactRoot;
}

test("Vite shell artifact adapter re-exports canonical service", () => {
  assert.equal(adapter.createViteShellArtifactService, service.createViteShellArtifactService);
});

test("Vite shell artifact status validates the guarded public preview files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-vite-artifact-"));
  const artifactRoot = writeArtifact(root);
  const currentManifest = JSON.parse(fs.readFileSync(path.join(artifactRoot, "codex-mobile-shell-manifest.json"), "utf8"));
  const artifactService = service.createViteShellArtifactService({
    appRoot: root,
    readShellAssetManifest: () => currentManifest,
  });
  const status = artifactService.readPublicArtifactStatus();
  assert.equal(status.ok, true, JSON.stringify(status.issueCodes));
  assert.equal(status.available, true);
  assert.equal(status.stage, "vite-shell-preview-html-v1");
  assert.equal(status.sourceBuildStage, "vite-shell-artifact-contract-v1");
  assert.equal(status.productionExecution, "vite-app-preview-native-esm");
  assert.equal(status.entryGroupImportOwner, "vite-shell-entry");
  assert.deepEqual(status.entryDynamicImportGraph, {
    owner: "vite-shell-entry",
    actualFileCount: 4,
    expectedFileCount: 4,
    missingFileCount: 0,
    extraFileCount: 0,
    esmCompatibilityFileCount: 1,
    viteOwnedFileCount: 1,
    deferredFileCount: 1,
    entryGroupFileCount: 1,
  });
  assert.equal(status.artifactRoot, "public/vite-shell");
  assert.deepEqual(status.classicShellScriptBlock, {
    match: true,
    scriptCount: 3,
    firstScript: "/shell-asset-manifest.js",
    lastScript: "/app.js",
    sha256: status.classicShellScriptBlock.sha256,
    readbackSha256: status.classicShellScriptBlock.sha256,
  });
  assert.match(status.classicShellScriptBlock.sha256, /^[a-f0-9]{64}$/);
  assert.equal(status.publishedFileCount, 11);
  assert.equal(status.sharedChunkCount, 1);
  assert.deepEqual(status.preview, {
    fileName: "preview.html",
    entryScript: "/vite-shell/app-preview-entry.js",
    targetEntryScript: "/vite-shell/assets/vite-shell-entry-test.js",
    entryGroupImportOwner: "vite-shell-entry",
  });
  assert.deepEqual(status.stableEntry, {
    fileName: "app-preview-entry.js",
    entryScript: "/vite-shell/app-preview-entry.js",
    targetEntryFileName: "assets/vite-shell-entry-test.js",
    targetEntryScript: "/vite-shell/assets/vite-shell-entry-test.js",
  });
  assert.deepEqual(status.appPreview, {
    fileName: "app-preview.html",
    entryScript: "/vite-shell/app-preview-entry.js",
    targetEntryScript: "/vite-shell/assets/vite-shell-entry-test.js",
    sourceShell: "public/index.html",
  });
  assert.equal(status.classicShellManifestMatch, true);
  assert.equal(status.entryGroupChunkCount, 1);
  assert.equal(status.startupCriticalAssetCount, 1);
  assert.deepEqual(status.startupGlobalContract, {
    match: true,
    requiredGlobalCount: 1,
    assetCount: 1,
    startupCriticalCount: 1,
  });
  assert.deepEqual(status.appPreviewClassicLoaderPlan, {
    match: true,
    owner: "vite-shell-entry",
    sourceScriptCount: 3,
    scriptCount: 0,
    hashCount: 0,
    byteCount: 0,
    excludedEsmScriptCount: 1,
    excludedEsmHashCount: 1,
    excludedEsmByteCount: APP_JS_FIXTURE.length,
    excludedEsmModuleIds: ["app-shell-runtime"],
    excludedViteOwnedScriptCount: 2,
    excludedViteOwnedHashCount: 2,
    excludedViteOwnedByteCount: SHELL_MANIFEST_JS_FIXTURE.length + APP_BOOTSTRAP_JS_FIXTURE.length,
    excludedViteOwnedOwnerIds: ["shell-manifest", "app-bootstrap"],
    firstScript: "",
    lastScript: "",
    sha256: status.appPreviewClassicLoaderPlan.sha256,
  });
  assert.match(status.appPreviewClassicLoaderPlan.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(status.esmCompatibility, {
    match: true,
    owner: "vite-shell-entry",
    moduleCount: 1,
    nativeEsmModuleCount: 0,
    classicGlobalCompatibilityModuleCount: 1,
    shardCount: 1,
    expectedFunctionCount: 1,
    hashCount: 1,
    byteCount: APP_JS_FIXTURE.length,
    moduleIds: ["app-shell-runtime"],
  });
  assert.deepEqual(status.artifactManifest, {
    shellCacheName: "codex-mobile-shell-test",
    clientBuildId: "0.1.11|codex-mobile-shell-test",
    indexScriptCount: 3,
    entryGroupCount: 1,
    entryGroupChunkCount: 1,
    startupCriticalAssetCount: 1,
    classicGlobalExportAssetCount: 1,
    classicGlobalExportCount: 1,
    startupGlobalContractCount: 1,
    esmCompatibilityModuleCount: 1,
    pageShellAssetCount: 7,
    hashAssetCount: 6,
  });
  assert.deepEqual(status.issueCodes, []);
  assert.deepEqual(status.entryGroupChunks, [{
    groupId: "app-entry",
    phase: "startup-critical",
    startupCritical: true,
    chunkTarget: "startup-app-shell",
    fileName: "assets/vite-entry-group-app-entry-test.js",
    entryScript: "/vite-shell/assets/vite-entry-group-app-entry-test.js",
    assetCount: 1,
    classicAssetHashCount: 1,
    classicAssetBytes: APP_JS_FIXTURE.length,
    classicGlobalExportAssetCount: 1,
    classicGlobalExportCount: 1,
  }]);
  assert.equal(status.publishedFiles.every((file) => file.exists && !path.isAbsolute(file.fileName)), true);
});

test("checked-in Vite shell artifact readback files all exist", () => {
  const status = service.createViteShellArtifactService({
    appRoot: path.resolve(__dirname, ".."),
  }).readPublicArtifactStatus();

  assert.equal(status.ok, true, JSON.stringify(status.issueCodes));
  assert.deepEqual(status.issueCodes, []);
  assert.ok(!status.issueCodes.includes("vite_shell_app_preview_classic_loader_plan_file_hash_mismatch"));
  assert.ok(!status.issueCodes.includes("vite_shell_classic_asset_file_hash_mismatch"));
  assert.equal(status.publishedFiles.every((file) => file.exists), true);
});

test("Vite shell artifact status fails closed when published manifest drifts from classic shell", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-vite-drift-"));
  const artifactRoot = writeArtifact(root);
  const manifestPath = path.join(artifactRoot, "codex-mobile-shell-manifest.json");
  const readbackPath = path.join(artifactRoot, "vite-shell-readback.json");
  const currentManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const driftedManifest = {
    ...currentManifest,
    indexScriptAssets: ["/shell-asset-manifest.js", "/stale-runtime.js"],
    entryGroups: [{
      id: "app-entry",
      phase: "startup-critical",
      startupCritical: true,
      chunkTarget: "startup-app-shell",
      assets: ["/stale-runtime.js"],
    }],
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(driftedManifest, null, 2)}\n`);
  const manifestBuffer = fs.readFileSync(manifestPath);
  const readback = JSON.parse(fs.readFileSync(readbackPath, "utf8"));
  readback.publishedFiles = readback.publishedFiles.map((file) => {
    if (file.fileName !== "codex-mobile-shell-manifest.json") return file;
    return {
      ...file,
      bytes: manifestBuffer.length,
      sha256: sha256Hex(manifestBuffer),
    };
  });
  fs.writeFileSync(readbackPath, `${JSON.stringify(readback, null, 2)}\n`);

  const status = service.createViteShellArtifactService({
    appRoot: root,
    readShellAssetManifest: () => currentManifest,
  }).readPublicArtifactStatus();
  assert.equal(status.ok, false);
  assert.equal(status.classicShellManifestMatch, false);
  assert.ok(status.issueCodes.includes("vite_shell_artifact_manifest_topology_mismatch"));
  assert.ok(!status.issueCodes.includes("vite_artifact_file_hash_mismatch"));
});

test("Vite shell artifact status fails closed when default classic script block drifts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-vite-script-block-drift-"));
  const artifactRoot = writeArtifact(root);
  const indexPath = path.join(root, "public", "index.html");
  fs.writeFileSync(indexPath, fs.readFileSync(indexPath, "utf8").replace("/app.js", "/stale-app.js"));

  const currentManifest = JSON.parse(fs.readFileSync(path.join(artifactRoot, "codex-mobile-shell-manifest.json"), "utf8"));
  const status = service.createViteShellArtifactService({
    appRoot: root,
    readShellAssetManifest: () => currentManifest,
  }).readPublicArtifactStatus();
  assert.equal(status.ok, false);
  assert.equal(status.classicShellScriptBlock.match, false);
  assert.ok(status.issueCodes.includes("vite_shell_classic_script_block_hash_mismatch"));
  assert.ok(status.issueCodes.includes("vite_shell_classic_script_block_manifest_mismatch"));
  assert.ok(!status.issueCodes.includes("vite_artifact_file_hash_mismatch"));
});

test("Vite shell artifact status fails closed for missing or stale artifacts", () => {
  const missingRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-vite-missing-"));
  const missingStatus = service.createViteShellArtifactService({
    appRoot: missingRoot,
    readShellAssetManifest: () => ({}),
  }).readPublicArtifactStatus();
  assert.equal(missingStatus.ok, false);
  assert.equal(missingStatus.available, false);
  assert.deepEqual(missingStatus.issueCodes, ["vite_shell_artifact_readback_missing"]);

  const staleRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-vite-stale-"));
  writeArtifact(staleRoot, { stage: "old-stage" });
  fs.unlinkSync(path.join(staleRoot, "public", "vite-shell", "assets", "vite-deferred-entry-topology-test.js"));
  const staleReadbackPath = path.join(staleRoot, "public", "vite-shell", "vite-shell-readback.json");
  const staleReadback = JSON.parse(fs.readFileSync(staleReadbackPath, "utf8"));
  staleReadback.publishedFiles = staleReadback.publishedFiles
    .filter((file) => file.fileName !== "preview.html");
  fs.writeFileSync(staleReadbackPath, `${JSON.stringify(staleReadback, null, 2)}\n`);
  const staleStatus = service.createViteShellArtifactService({
    appRoot: staleRoot,
    readShellAssetManifest: () => ({
      shellCacheName: "codex-mobile-shell-test",
      clientBuildId: "0.1.11|codex-mobile-shell-test",
    }),
  }).readPublicArtifactStatus();
  assert.equal(staleStatus.ok, false);
  assert.ok(staleStatus.issueCodes.includes("vite_shell_artifact_stage_mismatch"));
  assert.ok(staleStatus.issueCodes.includes("vite_artifact_file_missing"));
  assert.ok(staleStatus.issueCodes.includes("vite_shell_artifact_file_list_mismatch"));
});

test("Vite shell artifact publisher copies only bounded preview artifacts", async () => {
  const { publishViteShellPublicArtifact } = await import("../scripts/publish-vite-shell-artifact.mjs");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-vite-publish-"));
  const buildRoot = path.join(root, "dist", "frontend-shell");
  fs.mkdirSync(path.join(buildRoot, "assets"), { recursive: true });
  fs.mkdirSync(path.join(root, "public"), { recursive: true });
  fs.writeFileSync(path.join(root, "public", "index.html"), [
    "<!doctype html>",
    "<html>",
    "<head><title>Codex Mobile</title></head>",
    "<body>",
    renderClassicShellScriptBlock(["/shell-asset-manifest.js", "/app-bootstrap.js", "/app.js"]),
    "</body>",
    "</html>",
    "",
  ].join("\n"));
  fs.writeFileSync(path.join(buildRoot, "assets", "vite-shell-entry-test.js"), "export const entry = true;\n");
  fs.writeFileSync(path.join(buildRoot, "assets", "vite-esm-compatibility-test.js"), "export const compat = true;\n");
  fs.writeFileSync(path.join(buildRoot, "assets", "vite-esm-compatibility-shard-01-test.js"), "export const shard = true;\n");
  fs.writeFileSync(path.join(buildRoot, "assets", "vite-shared-runtime-test.js"), "export const shared = true;\n");
  fs.writeFileSync(path.join(buildRoot, "assets", "app-bootstrap-test.js"), "export const appBootstrap = true;\n");
  fs.writeFileSync(path.join(buildRoot, "assets", "vite-deferred-entry-topology-test.js"), "export const deferred = true;\n");
  fs.writeFileSync(path.join(buildRoot, "assets", "vite-entry-group-app-entry-test.js"), "export const group = true;\n");
  fs.writeFileSync(path.join(buildRoot, "shell-extra.js"), "should not publish\n");
  fs.mkdirSync(path.join(root, "public", "vite-shell", "assets"), { recursive: true });
  fs.writeFileSync(path.join(root, "public", "vite-shell", "shell-extra.js"), "stale root artifact\n");
  fs.writeFileSync(path.join(root, "public", "vite-shell", "assets", "vite-shell-entry-old.js"), "export const old = true;\n");
  fs.writeFileSync(path.join(root, "public", "shell-asset-manifest.js"), SHELL_MANIFEST_JS_FIXTURE);
  fs.writeFileSync(path.join(root, "public", "app-bootstrap.js"), APP_BOOTSTRAP_JS_FIXTURE);
  fs.writeFileSync(path.join(root, "public", "app.js"), APP_JS_FIXTURE);
  const buildShellManifest = {
    shellCacheName: "codex-mobile-shell-test",
    clientBuildId: "0.1.11|codex-mobile-shell-test",
    indexScriptAssets: ["/shell-asset-manifest.js", "/app-bootstrap.js", "/app.js"],
    entryGroups: [{
      id: "manifest",
      phase: "startup-manifest",
      startupCritical: true,
      chunkTarget: "startup-manifest",
      assets: ["/shell-asset-manifest.js"],
    }, {
      id: "app-entry",
      phase: "startup-critical",
      startupCritical: true,
      chunkTarget: "startup-app-shell",
      assets: ["/app.js"],
    }],
    classicGlobalExports: [{
      asset: "/app.js",
      globals: ["CodexAppShellRuntime"],
    }],
    startupGlobalContracts: [{
      name: "CodexAppShellRuntime",
      asset: "/app.js",
      groupId: "app-entry",
      startupCritical: true,
      source: "startup-window-guard",
      present: true,
    }],
    assets: [{
      path: "/shell-asset-manifest.js",
      sourcePath: "public/shell-asset-manifest.js",
      exists: true,
      bytes: SHELL_MANIFEST_JS_FIXTURE.length,
      sha256: sha256Hex(SHELL_MANIFEST_JS_FIXTURE),
    }, {
      path: "/app-bootstrap.js",
      sourcePath: "public/app-bootstrap.js",
      exists: true,
      bytes: APP_BOOTSTRAP_JS_FIXTURE.length,
      sha256: sha256Hex(APP_BOOTSTRAP_JS_FIXTURE),
    }, {
      path: "/app.js",
      sourcePath: "public/app.js",
      exists: true,
      bytes: APP_JS_FIXTURE.length,
      sha256: sha256Hex(APP_JS_FIXTURE),
    }],
  };
  const buildAppPreviewClassicLoaderPlan = appPreviewClassicLoaderPlanContract(buildShellManifest);
  const buildEsmCompatibility = esmCompatibilityContract();
  fs.writeFileSync(path.join(buildRoot, "codex-mobile-shell-manifest.json"), JSON.stringify({
    ...buildShellManifest,
    viteBuild: {
      stage: "vite-shell-artifact-contract-v1",
      productionExecution: "vite-app-preview-native-esm",
      entryGroupImportOwner: "vite-shell-entry",
      appPreviewClassicLoaderPlan: buildAppPreviewClassicLoaderPlan,
      esmCompatibility: buildEsmCompatibility,
      classicFallback: {
        scriptBlock: classicShellScriptBlockContract(["/shell-asset-manifest.js", "/app-bootstrap.js", "/app.js"]),
      },
      entryDynamicImportGraph: {
        owner: "vite-shell-entry",
        actualFiles: [
          "assets/vite-esm-compatibility-test.js",
          "assets/app-bootstrap-test.js",
          "assets/vite-deferred-entry-topology-test.js",
          "assets/vite-entry-group-app-entry-test.js",
        ],
        expectedFiles: [
          "assets/vite-esm-compatibility-test.js",
          "assets/app-bootstrap-test.js",
          "assets/vite-deferred-entry-topology-test.js",
          "assets/vite-entry-group-app-entry-test.js",
        ],
        missingFiles: [],
        extraFiles: [],
        esmCompatibilityFileCount: 1,
        viteOwnedFileCount: 1,
        deferredFileCount: 1,
        entryGroupFileCount: 1,
      },
      startupCompatibility: {
        schemaVersion: 1,
        source: "generated-startup-window-guards",
        requiredGlobals: [{
          name: "CodexAppShellRuntime",
          asset: "/app.js",
          groupId: "app-entry",
          startupCritical: true,
          source: "startup-window-guard",
          present: true,
          exportedAsset: "/app.js",
          hashPresent: true,
          bytes: APP_JS_FIXTURE.length,
          sha256: sha256Hex(APP_JS_FIXTURE),
        }],
        requiredGlobalNames: ["CodexAppShellRuntime"],
        requiredGlobalCount: 1,
        assetCount: 1,
        hashCount: 1,
        byteCount: APP_JS_FIXTURE.length,
      },
      validation: { ok: true, issues: [] },
      viteEntry: {
        source: "frontend/vite-shell-entry.mjs",
        fileName: "assets/vite-shell-entry-test.js",
      },
      viteEsmCompatibilityChunks: [{
        source: "virtual:codex-mobile-esm-compatibility",
        fileName: "assets/vite-esm-compatibility-test.js",
      }, {
        source: "virtual:codex-mobile-esm-compatibility/shard/shard-01",
        fileName: "assets/vite-esm-compatibility-shard-01-test.js",
      }],
      viteSharedChunks: [{
        name: "vite-shared-runtime",
        source: "",
        fileName: "assets/vite-shared-runtime-test.js",
      }],
      viteOwnedAppBootstrapChunks: [{
        source: "public/app-bootstrap.js",
        fileName: "assets/app-bootstrap-test.js",
      }],
      viteDeferredChunks: [{
        source: "frontend/vite-deferred-entry-topology.mjs",
        fileName: "assets/vite-deferred-entry-topology-test.js",
      }],
      viteEntryGroupChunks: [{
        groupId: "app-entry",
        phase: "startup-critical",
        startupCritical: true,
        chunkTarget: "startup-app-shell",
        source: "virtual:codex-mobile-shell-entry-group/app-entry",
        fileName: "assets/vite-entry-group-app-entry-test.js",
        assetCount: 1,
        classicAssetRecords: [{
          path: "/app.js",
          sourcePath: "public/app.js",
          bytes: APP_JS_FIXTURE.length,
          sha256: sha256Hex(APP_JS_FIXTURE),
        }],
        classicAssetHashCount: 1,
        classicAssetBytes: APP_JS_FIXTURE.length,
        classicGlobalExportAssetCount: 1,
        classicGlobalExportCount: 1,
      }],
    },
  }, null, 2));

  const readback = publishViteShellPublicArtifact({ root, buildRoot });
  const status = service.createViteShellArtifactService({
    appRoot: root,
    readShellAssetManifest: () => JSON.parse(fs.readFileSync(path.join(root, "public", "shell-asset-manifest.json"), "utf8")),
  }).readPublicArtifactStatus();
  const published = fs.readdirSync(path.join(root, "public", "vite-shell")).sort();
  assert.equal(readback.validation.ok, true);
  assert.ok(!status.issueCodes.includes("vite_shell_app_preview_classic_loader_plan_file_hash_mismatch"));
  assert.ok(!status.issueCodes.includes("vite_shell_classic_asset_file_hash_mismatch"));
  assert.deepEqual(published, ["app-preview-entry.js", "app-preview.html", "assets", "codex-mobile-shell-manifest.json", "preview.html", "vite-shell-readback.json"]);
  assert.equal(fs.existsSync(path.join(root, "public", "vite-shell", "shell-extra.js")), false);
  assert.equal(fs.existsSync(path.join(root, "public", "vite-shell", "assets", "vite-shell-entry-old.js")), true);
  assert.equal(readback.counts.retainedArtifactFiles, 1);
  assert.deepEqual(readback.retainedArtifactFiles.map((entry) => entry.fileName), ["assets/vite-shell-entry-old.js"]);
  assert.equal(fs.existsSync(path.join(root, "public", "vite-shell", "assets", "vite-shell-entry-test.js")), true);
  assert.equal(fs.existsSync(path.join(root, "public", "vite-shell", "assets", "vite-esm-compatibility-test.js")), true);
  assert.equal(fs.existsSync(path.join(root, "public", "vite-shell", "assets", "vite-esm-compatibility-shard-01-test.js")), true);
  assert.equal(fs.existsSync(path.join(root, "public", "vite-shell", "assets", "vite-shared-runtime-test.js")), true);
  assert.equal(fs.existsSync(path.join(root, "public", "vite-shell", "assets", "app-bootstrap-test.js")), true);
  assert.equal(fs.existsSync(path.join(root, "public", "vite-shell", "assets", "vite-deferred-entry-topology-test.js")), true);
  assert.equal(fs.existsSync(path.join(root, "public", "vite-shell", "assets", "vite-entry-group-app-entry-test.js")), true);
  assert.equal(fs.existsSync(path.join(root, "public", "vite-shell", "app-preview-entry.js")), true);
  const appPreviewEntry = fs.readFileSync(path.join(root, "public", "vite-shell", "app-preview-entry.js"), "utf8");
  assert.match(appPreviewEntry, /const targetEntryImportSpecifier = "\.\/assets\/vite-shell-entry-test\.js";/);
  assert.match(appPreviewEntry, /new URL\(targetEntryImportSpecifier, import\.meta\.url\)/);
  assert.match(appPreviewEntry, /sourceUrl\.searchParams\.forEach/);
  assert.match(appPreviewEntry, /import\(targetEntryImportUrl\.href\)/);
  assert.doesNotMatch(appPreviewEntry, /import "\/vite-shell\/assets\//);
  assert.match(appPreviewEntry, /targetEntryScript: "\/vite-shell\/assets\/vite-shell-entry-test\.js"/);
  assert.match(appPreviewEntry, /targetEntryImportSpecifier,/);
  assert.match(appPreviewEntry, /targetEntryImportUrl: targetEntryImportUrl\.href/);
  const previewHtml = fs.readFileSync(path.join(root, "public", "vite-shell", "preview.html"), "utf8");
  assert.match(previewHtml, /id="codex-vite-shell-preview"/);
  assert.match(previewHtml, /data-startup-critical-asset-count="2"/);
  assert.match(previewHtml, /data-entry-group-chunk-count="1"/);
  assert.match(previewHtml, /data-startup-global-contract-count="1"/);
  assert.match(previewHtml, /data-classic-shell-script-count="3"/);
  assert.match(previewHtml, /data-classic-shell-script-block-sha256="[a-f0-9]{64}"/);
  assert.match(previewHtml, /data-entry-group-import-owner="vite-shell-entry"/);
  assert.match(previewHtml, /data-esm-compatibility-module-count="1"/);
  assert.match(previewHtml, /rel="preload" as="script" href="\/app\.js" data-codex-vite-startup-asset="true"/);
  assert.match(previewHtml, /rel="modulepreload" href="\/vite-shell\/assets\/vite-shared-runtime-test\.js" data-codex-vite-shared-chunk="true"/);
  assert.match(previewHtml, /rel="modulepreload" href="\/vite-shell\/assets\/vite-esm-compatibility-test\.js" data-codex-vite-esm-compatibility-chunk="true"/);
  assert.match(previewHtml, /rel="modulepreload" href="\/vite-shell\/assets\/vite-esm-compatibility-shard-01-test\.js" data-codex-vite-esm-compatibility-chunk="true"/);
  assert.match(previewHtml, /rel="modulepreload" href="\/vite-shell\/assets\/vite-shell-entry-test\.js" data-codex-vite-stable-entry-target="true"/);
  assert.match(previewHtml, /rel="modulepreload" href="\/vite-shell\/assets\/vite-entry-group-app-entry-test\.js" data-codex-vite-entry-group-chunk="true"/);
  assert.doesNotMatch(previewHtml, /data-codex-vite-entry-group-imports="true"/);
  assert.doesNotMatch(previewHtml, /__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_PROMISE__/);
  assert.match(previewHtml, /type="module" src="\/vite-shell\/app-preview-entry\.js"/);
  const appPreviewHtml = fs.readFileSync(path.join(root, "public", "vite-shell", "app-preview.html"), "utf8");
  assert.match(appPreviewHtml, /data-codex-vite-app-preview="true"/);
  assert.match(appPreviewHtml, /name="codex-vite-app-preview"/);
  assert.match(appPreviewHtml, /CODEX_MOBILE_VITE_APP_PREVIEW:BEGIN/);
  assert.match(appPreviewHtml, /rel="modulepreload" href="\/vite-shell\/assets\/vite-shared-runtime-test\.js" data-codex-vite-shared-chunk="true"/);
  assert.match(appPreviewHtml, /rel="modulepreload" href="\/vite-shell\/assets\/vite-esm-compatibility-test\.js" data-codex-vite-esm-compatibility-chunk="true"/);
  assert.match(appPreviewHtml, /rel="modulepreload" href="\/vite-shell\/assets\/vite-esm-compatibility-shard-01-test\.js" data-codex-vite-esm-compatibility-chunk="true"/);
  assert.match(appPreviewHtml, /rel="modulepreload" href="\/vite-shell\/assets\/vite-shell-entry-test\.js" data-codex-vite-stable-entry-target="true"/);
  assert.match(appPreviewHtml, /id="codex-vite-app-preview-loader-plan"/);
  assert.match(appPreviewHtml, /data-codex-vite-app-preview-loader-plan="true"/);
  assert.match(appPreviewHtml, /"owner": "vite-shell-entry"/);
  assert.match(appPreviewHtml, /<script src="\/shell-asset-manifest\.js" data-codex-vite-current-shell-manifest="true"><\/script>/);
  assert.ok(
    appPreviewHtml.indexOf('data-codex-vite-current-shell-manifest="true"')
      < appPreviewHtml.indexOf('data-codex-vite-app-preview-entry="true"')
  );
  assert.match(appPreviewHtml, /type="module" src="\/vite-shell\/app-preview-entry\.js\?targetEntry=vite-shell-entry-test\.js" data-codex-vite-app-preview-entry="true"/);
  assert.doesNotMatch(appPreviewHtml, /CODEX_MOBILE_SHELL_SCRIPTS:BEGIN/);
  assert.doesNotMatch(appPreviewHtml, /<script src="\/app-bootstrap\.js"/);
  assert.doesNotMatch(appPreviewHtml, /<script src="\/app\.js"/);
  assert.equal(readback.entryGroupImportOwner, "vite-shell-entry");
  assert.equal(readback.entryDynamicImportGraph.owner, "vite-shell-entry");
  assert.deepEqual(readback.entryDynamicImportGraph.missingFiles, []);
  assert.deepEqual(readback.entryDynamicImportGraph.extraFiles, []);
  assert.equal(readback.entryDynamicImportGraph.esmCompatibilityFileCount, 1);
  assert.equal(readback.entryDynamicImportGraph.viteOwnedFileCount, 1);
  assert.equal(readback.entryDynamicImportGraph.deferredFileCount, 1);
  assert.equal(readback.entryDynamicImportGraph.entryGroupFileCount, 1);
  assert.equal(readback.preview.fileName, "preview.html");
  assert.equal(readback.preview.entryScript, "/vite-shell/app-preview-entry.js");
  assert.equal(readback.preview.targetEntryScript, "/vite-shell/assets/vite-shell-entry-test.js");
  assert.deepEqual(readback.stableEntry, {
    fileName: "app-preview-entry.js",
    entryScript: "/vite-shell/app-preview-entry.js",
    targetEntryFileName: "assets/vite-shell-entry-test.js",
    targetEntryScript: "/vite-shell/assets/vite-shell-entry-test.js",
  });
  assert.deepEqual(readback.appPreview, {
    fileName: "app-preview.html",
    entryScript: "/vite-shell/app-preview-entry.js",
    targetEntryScript: "/vite-shell/assets/vite-shell-entry-test.js",
    sourceShell: "public/index.html",
  });
  assert.deepEqual(readback.esmCompatibilityChunks, [{
    source: "virtual:codex-mobile-esm-compatibility",
    fileName: "assets/vite-esm-compatibility-test.js",
    entryScript: "/vite-shell/assets/vite-esm-compatibility-test.js",
  }, {
    source: "virtual:codex-mobile-esm-compatibility/shard/shard-01",
    fileName: "assets/vite-esm-compatibility-shard-01-test.js",
    entryScript: "/vite-shell/assets/vite-esm-compatibility-shard-01-test.js",
  }]);
  assert.deepEqual(readback.sharedChunks, [{
    name: "vite-shared-runtime",
    source: "",
    fileName: "assets/vite-shared-runtime-test.js",
    entryScript: "/vite-shell/assets/vite-shared-runtime-test.js",
  }]);
  assert.deepEqual(readback.viteOwnedAppBootstrapChunks, [{
    source: "public/app-bootstrap.js",
    fileName: "assets/app-bootstrap-test.js",
    entryScript: "/vite-shell/assets/app-bootstrap-test.js",
  }]);
  assert.deepEqual(readback.entryGroupChunks, [{
    groupId: "app-entry",
    phase: "startup-critical",
    startupCritical: true,
    chunkTarget: "startup-app-shell",
    source: "virtual:codex-mobile-shell-entry-group/app-entry",
    fileName: "assets/vite-entry-group-app-entry-test.js",
    entryScript: "/vite-shell/assets/vite-entry-group-app-entry-test.js",
    assetCount: 1,
    classicAssetRecords: [{
      path: "/app.js",
      sourcePath: "public/app.js",
      bytes: APP_JS_FIXTURE.length,
      sha256: sha256Hex(APP_JS_FIXTURE),
    }],
    classicAssetHashCount: 1,
    classicAssetBytes: APP_JS_FIXTURE.length,
    classicGlobalExportAssetCount: 1,
    classicGlobalExportCount: 1,
  }]);
  assert.deepEqual(readback.startupCriticalAssets, ["/shell-asset-manifest.js", "/app.js"]);
  assert.deepEqual(readback.startupGlobalContracts, [{
    name: "CodexAppShellRuntime",
    asset: "/app.js",
    groupId: "app-entry",
    startupCritical: true,
    source: "startup-window-guard",
    exportedAsset: "/app.js",
    bytes: APP_JS_FIXTURE.length,
    sha256: sha256Hex(APP_JS_FIXTURE),
  }]);
  assert.equal(readback.classicShellScriptBlock.scriptCount, 3);
  assert.equal(readback.classicShellScriptBlock.firstScript, "/shell-asset-manifest.js");
  assert.equal(readback.classicShellScriptBlock.lastScript, "/app.js");
  assert.match(readback.classicShellScriptBlock.sha256, /^[a-f0-9]{64}$/);
  assert.equal(readback.appPreviewClassicLoaderPlan.owner, "vite-shell-entry");
  assert.equal(readback.appPreviewClassicLoaderPlan.sourceScriptCount, 3);
  assert.equal(readback.appPreviewClassicLoaderPlan.scriptCount, 0);
  assert.equal(readback.appPreviewClassicLoaderPlan.hashCount, 0);
  assert.equal(readback.appPreviewClassicLoaderPlan.excludedEsmScriptCount, 1);
  assert.equal(readback.appPreviewClassicLoaderPlan.excludedEsmHashCount, 1);
  assert.deepEqual(readback.appPreviewClassicLoaderPlan.excludedEsmScripts.map((entry) => entry.esmModuleId), ["app-entry"]);
  assert.equal(readback.appPreviewClassicLoaderPlan.excludedViteOwnedScriptCount, 2);
  assert.equal(readback.appPreviewClassicLoaderPlan.excludedViteOwnedHashCount, 2);
  assert.deepEqual(readback.appPreviewClassicLoaderPlan.excludedViteOwnedScripts.map((entry) => entry.ownerId), ["shell-manifest", "vite-app-bootstrap"]);
  assert.equal(readback.appPreviewClassicLoaderPlan.firstScript, "");
  assert.equal(readback.appPreviewClassicLoaderPlan.lastScript, "");
  assert.match(readback.appPreviewClassicLoaderPlan.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(readback.esmCompatibility, buildEsmCompatibility);
  assert.equal(readback.counts.startupCriticalAssets, 2);
  assert.equal(readback.counts.startupGlobalContracts, 1);
  assert.equal(readback.counts.startupGlobalContractAssets, 1);
  assert.equal(readback.counts.startupGlobalContractHashes, 1);
  assert.equal(readback.counts.startupGlobalContractBytes, APP_JS_FIXTURE.length);
  assert.equal(readback.counts.classicShellScriptBlockScripts, 3);
  assert.equal(readback.counts.appPreviewClassicLoaderScripts, 0);
  assert.equal(readback.counts.appPreviewClassicLoaderHashes, 0);
  assert.equal(readback.counts.appPreviewClassicLoaderBytes, 0);
  assert.equal(readback.counts.appPreviewClassicLoaderExcludedEsmScripts, 1);
  assert.equal(readback.counts.appPreviewClassicLoaderExcludedViteOwnedScripts, 2);
  assert.equal(readback.counts.esmCompatibilityModules, 1);
  assert.equal(readback.counts.esmCompatibilityChunks, 2);
  assert.equal(readback.counts.sharedChunks, 1);
  assert.equal(readback.counts.esmCompatibilityHashes, 1);
  assert.equal(readback.counts.esmCompatibilityExpectedFunctions, 1);
  assert.equal(readback.counts.classicAssetHashes, 1);
  assert.equal(readback.counts.entryGroupChunks, 1);
  assert.equal(readback.counts.viteOwnedAppBootstrapChunks, 1);
  assert.equal(readback.counts.publishedFiles, 11);
});

test("Vite shell artifact status fails closed when entry group import owner drifts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-vite-import-owner-"));
  const artifactRoot = writeArtifact(root);
  const readbackPath = path.join(artifactRoot, "vite-shell-readback.json");
  const readback = JSON.parse(fs.readFileSync(readbackPath, "utf8"));
  readback.entryGroupImportOwner = "preview-html";
  fs.writeFileSync(readbackPath, `${JSON.stringify(readback, null, 2)}\n`);

  const currentManifest = JSON.parse(fs.readFileSync(path.join(artifactRoot, "codex-mobile-shell-manifest.json"), "utf8"));
  const status = service.createViteShellArtifactService({
    appRoot: root,
    readShellAssetManifest: () => currentManifest,
  }).readPublicArtifactStatus();
  assert.equal(status.ok, false);
  assert.ok(status.issueCodes.includes("vite_shell_entry_group_import_owner_mismatch"));
  assert.ok(!status.issueCodes.includes("vite_artifact_file_hash_mismatch"));
});

test("Vite shell artifact status fails closed when entry dynamic import graph drifts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-vite-dynamic-import-drift-"));
  const artifactRoot = writeArtifact(root);
  const readbackPath = path.join(artifactRoot, "vite-shell-readback.json");
  const readback = JSON.parse(fs.readFileSync(readbackPath, "utf8"));
  readback.entryDynamicImportGraph = {
    ...readback.entryDynamicImportGraph,
    missingFiles: ["assets/vite-entry-group-app-entry-test.js"],
    entryGroupFileCount: 0,
  };
  fs.writeFileSync(readbackPath, `${JSON.stringify(readback, null, 2)}\n`);

  const currentManifest = JSON.parse(fs.readFileSync(path.join(artifactRoot, "codex-mobile-shell-manifest.json"), "utf8"));
  const status = service.createViteShellArtifactService({
    appRoot: root,
    readShellAssetManifest: () => currentManifest,
  }).readPublicArtifactStatus();
  assert.equal(status.ok, false);
  assert.ok(status.issueCodes.includes("vite_shell_entry_dynamic_import_missing"));
  assert.ok(status.issueCodes.includes("vite_shell_entry_dynamic_import_entry_group_count_mismatch"));
  assert.ok(!status.issueCodes.includes("vite_artifact_file_hash_mismatch"));
});

test("Vite shell artifact status fails closed when startup global contract drifts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-vite-startup-contract-drift-"));
  const artifactRoot = writeArtifact(root);
  const readbackPath = path.join(artifactRoot, "vite-shell-readback.json");
  const readback = JSON.parse(fs.readFileSync(readbackPath, "utf8"));
  readback.startupGlobalContracts[0].asset = "/stale-app.js";
  readback.startupGlobalContracts[0].exportedAsset = "/stale-app.js";
  fs.writeFileSync(readbackPath, `${JSON.stringify(readback, null, 2)}\n`);

  const currentManifest = JSON.parse(fs.readFileSync(path.join(artifactRoot, "codex-mobile-shell-manifest.json"), "utf8"));
  const status = service.createViteShellArtifactService({
    appRoot: root,
    readShellAssetManifest: () => currentManifest,
  }).readPublicArtifactStatus();
  assert.equal(status.ok, false);
  assert.ok(status.issueCodes.includes("vite_shell_startup_global_contract_mismatch"));
  assert.ok(status.issueCodes.includes("vite_shell_startup_global_export_mismatch"));
  assert.ok(!status.issueCodes.includes("vite_artifact_file_hash_mismatch"));
});

test("Vite shell artifact status fails closed when app-preview loader plan drifts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-vite-loader-plan-drift-"));
  const artifactRoot = writeArtifact(root);
  const readbackPath = path.join(artifactRoot, "vite-shell-readback.json");
  const readback = JSON.parse(fs.readFileSync(readbackPath, "utf8"));
  readback.appPreviewClassicLoaderPlan.excludedViteOwnedScripts[1].sha256 = "0".repeat(64);
  fs.writeFileSync(readbackPath, `${JSON.stringify(readback, null, 2)}\n`);

  const currentManifest = JSON.parse(fs.readFileSync(path.join(artifactRoot, "codex-mobile-shell-manifest.json"), "utf8"));
  const status = service.createViteShellArtifactService({
    appRoot: root,
    readShellAssetManifest: () => currentManifest,
  }).readPublicArtifactStatus();
  assert.equal(status.ok, false);
  assert.equal(status.appPreviewClassicLoaderPlan.match, false);
  assert.ok(status.issueCodes.includes("vite_shell_app_preview_classic_loader_plan_manifest_mismatch"));
  assert.ok(status.issueCodes.includes("vite_shell_app_preview_classic_loader_plan_hash_mismatch"));
});

test("Vite shell artifact status fails closed when ESM compatibility contract drifts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-vite-esm-contract-drift-"));
  const artifactRoot = writeArtifact(root);
  const readbackPath = path.join(artifactRoot, "vite-shell-readback.json");
  const readback = JSON.parse(fs.readFileSync(readbackPath, "utf8"));
  readback.esmCompatibility.modules[0].sha256 = "0".repeat(64);
  fs.writeFileSync(readbackPath, `${JSON.stringify(readback, null, 2)}\n`);

  const currentManifest = JSON.parse(fs.readFileSync(path.join(artifactRoot, "codex-mobile-shell-manifest.json"), "utf8"));
  const status = service.createViteShellArtifactService({
    appRoot: root,
    readShellAssetManifest: () => currentManifest,
  }).readPublicArtifactStatus();
  assert.equal(status.ok, false);
  assert.equal(status.esmCompatibility.match, false);
  assert.ok(status.issueCodes.includes("vite_shell_esm_compatibility_contract_manifest_mismatch"));
  assert.ok(status.issueCodes.includes("vite_shell_esm_compatibility_module_file_hash_mismatch"));
});

test("Vite shell artifact status fails closed when preview owner marker is missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-vite-preview-owner-missing-"));
  const artifactRoot = writeArtifact(root);
  const previewPath = path.join(artifactRoot, "preview.html");
  const previewHtml = fs.readFileSync(previewPath, "utf8")
    .replace(/ data-entry-group-import-owner="vite-shell-entry"/, "");
  fs.writeFileSync(previewPath, previewHtml);
  const readbackPath = path.join(artifactRoot, "vite-shell-readback.json");
  const readback = JSON.parse(fs.readFileSync(readbackPath, "utf8"));
  const previewBuffer = fs.readFileSync(previewPath);
  readback.publishedFiles = readback.publishedFiles.map((file) => {
    if (file.fileName !== "preview.html") return file;
    return {
      ...file,
      bytes: previewBuffer.length,
      sha256: sha256Hex(previewBuffer),
    };
  });
  fs.writeFileSync(readbackPath, `${JSON.stringify(readback, null, 2)}\n`);

  const currentManifest = JSON.parse(fs.readFileSync(path.join(artifactRoot, "codex-mobile-shell-manifest.json"), "utf8"));
  const status = service.createViteShellArtifactService({
    appRoot: root,
    readShellAssetManifest: () => currentManifest,
  }).readPublicArtifactStatus();
  assert.equal(status.ok, false);
  assert.ok(status.issueCodes.includes("vite_shell_preview_entry_group_import_owner_missing"));
  assert.ok(!status.issueCodes.includes("vite_artifact_file_hash_mismatch"));
});

test("Vite shell artifact status fails closed when entry group coverage drifts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-vite-coverage-drift-"));
  const artifactRoot = writeArtifact(root);
  const readbackPath = path.join(artifactRoot, "vite-shell-readback.json");
  const readback = JSON.parse(fs.readFileSync(readbackPath, "utf8"));
  readback.entryGroupChunks[0].classicGlobalExportCount = 0;
  fs.writeFileSync(readbackPath, `${JSON.stringify(readback, null, 2)}\n`);

  const currentManifest = JSON.parse(fs.readFileSync(path.join(artifactRoot, "codex-mobile-shell-manifest.json"), "utf8"));
  const status = service.createViteShellArtifactService({
    appRoot: root,
    readShellAssetManifest: () => currentManifest,
  }).readPublicArtifactStatus();
  assert.equal(status.ok, false);
  assert.ok(status.issueCodes.includes("vite_shell_artifact_entry_group_coverage_mismatch"));
});

test("Vite shell artifact status fails closed when entry group classic asset hash drifts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-vite-classic-hash-drift-"));
  const artifactRoot = writeArtifact(root);
  const readbackPath = path.join(artifactRoot, "vite-shell-readback.json");
  const readback = JSON.parse(fs.readFileSync(readbackPath, "utf8"));
  readback.entryGroupChunks[0].classicAssetRecords[0].sha256 = "0".repeat(64);
  fs.writeFileSync(readbackPath, `${JSON.stringify(readback, null, 2)}\n`);

  const currentManifest = JSON.parse(fs.readFileSync(path.join(artifactRoot, "codex-mobile-shell-manifest.json"), "utf8"));
  const status = service.createViteShellArtifactService({
    appRoot: root,
    readShellAssetManifest: () => currentManifest,
  }).readPublicArtifactStatus();
  assert.equal(status.ok, false);
  assert.ok(status.issueCodes.includes("vite_shell_artifact_entry_group_classic_asset_hash_mismatch"));
});

test("Vite shell artifact status fails closed when public classic asset file drifts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-vite-classic-file-drift-"));
  const artifactRoot = writeArtifact(root);
  fs.writeFileSync(path.join(root, "public", "app.js"), "window.CodexAppShellRuntime = {};\n");

  const currentManifest = JSON.parse(fs.readFileSync(path.join(artifactRoot, "codex-mobile-shell-manifest.json"), "utf8"));
  const status = service.createViteShellArtifactService({
    appRoot: root,
    readShellAssetManifest: () => currentManifest,
  }).readPublicArtifactStatus();
  assert.equal(status.ok, false);
  assert.ok(status.issueCodes.includes("vite_shell_classic_asset_file_hash_mismatch"));
});
