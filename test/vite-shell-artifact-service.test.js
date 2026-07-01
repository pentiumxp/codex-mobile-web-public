"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const adapter = require("../adapters/vite-shell-artifact-service");
const service = require("../services/runtime/vite-shell-artifact-service");

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function writeArtifact(root, options = {}) {
  const artifactRoot = path.join(root, "public", "vite-shell");
  fs.mkdirSync(path.join(artifactRoot, "assets"), { recursive: true });
  const entry = Buffer.from("export const entry = true;\n");
  const deferred = Buffer.from("export const deferred = true;\n");
  const entryGroup = Buffer.from("export const group = true;\n");
  const stage = options.stage || "vite-shell-preview-html-v1";
  const shellManifest = options.shellManifest || {
    shellCacheName: "codex-mobile-shell-test",
    clientBuildId: "0.1.11|codex-mobile-shell-test",
    indexScriptAssets: ["/shell-asset-manifest.js", "/app.js"],
    swStaticAssets: ["/", "/index.html", "/shell-asset-manifest.js", "/app.js", "/shell-asset-manifest.json"],
    pageShellAssets: ["/", "/index.html", "/shell-asset-manifest.js", "/app.js", "/shell-asset-manifest.json", "/sw.js"],
    hashAssets: ["/index.html", "/shell-asset-manifest.js", "/app.js", "/shell-asset-manifest.json", "/sw.js"],
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
  };
  const preview = Buffer.from([
    "<!doctype html>",
    "<link rel=\"modulepreload\" href=\"/vite-shell/assets/vite-entry-group-app-entry-test.js\" data-codex-vite-entry-group-chunk=\"true\">",
    "<main id=\"codex-vite-shell-preview\" data-stage=\"vite-shell-preview-html-v1\"></main>",
    "<script type=\"module\" src=\"/vite-shell/assets/vite-shell-entry-test.js\"></script>",
    "<script type=\"module\" data-codex-vite-entry-group-imports=\"true\">",
    "globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_PROMISE__ = import('/vite-shell/assets/vite-entry-group-app-entry-test.js');",
    "</script>",
    "",
  ].join("\n"));
  const manifest = Buffer.from(JSON.stringify({
    ...shellManifest,
    viteBuild: {
      stage: "vite-shell-artifact-contract-v1",
      productionExecution: "classic-script-fallback",
    },
  }, null, 2));
  fs.writeFileSync(path.join(artifactRoot, "assets", "vite-shell-entry-test.js"), entry);
  fs.writeFileSync(path.join(artifactRoot, "assets", "vite-deferred-entry-topology-test.js"), deferred);
  fs.writeFileSync(path.join(artifactRoot, "assets", "vite-entry-group-app-entry-test.js"), entryGroup);
  fs.writeFileSync(path.join(artifactRoot, "codex-mobile-shell-manifest.json"), manifest);
  fs.writeFileSync(path.join(artifactRoot, "preview.html"), preview);
  const readback = {
    schemaVersion: 1,
    stage,
    sourceBuildStage: "vite-shell-artifact-contract-v1",
    productionExecution: "classic-script-fallback",
    shellCacheName: "codex-mobile-shell-test",
    clientBuildId: "0.1.11|codex-mobile-shell-test",
    entry: {
      source: "frontend/vite-shell-entry.mjs",
      fileName: "assets/vite-shell-entry-test.js",
    },
    deferredChunks: [{
      source: "frontend/vite-deferred-entry-topology.mjs",
      fileName: "assets/vite-deferred-entry-topology-test.js",
    }],
    entryGroupChunks: [{
      groupId: "app-entry",
      source: "virtual:codex-mobile-shell-entry-group/app-entry",
      fileName: "assets/vite-entry-group-app-entry-test.js",
      entryScript: "/vite-shell/assets/vite-entry-group-app-entry-test.js",
    }],
    preview: {
      fileName: "preview.html",
      entryScript: "/vite-shell/assets/vite-shell-entry-test.js",
    },
    publishedFiles: [
      { fileName: "codex-mobile-shell-manifest.json", bytes: manifest.length, sha256: sha256Hex(manifest) },
      { fileName: "assets/vite-shell-entry-test.js", bytes: entry.length, sha256: sha256Hex(entry) },
      { fileName: "assets/vite-deferred-entry-topology-test.js", bytes: deferred.length, sha256: sha256Hex(deferred) },
      { fileName: "assets/vite-entry-group-app-entry-test.js", bytes: entryGroup.length, sha256: sha256Hex(entryGroup) },
      { fileName: "preview.html", bytes: preview.length, sha256: sha256Hex(preview) },
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
  assert.equal(status.ok, true);
  assert.equal(status.available, true);
  assert.equal(status.stage, "vite-shell-preview-html-v1");
  assert.equal(status.sourceBuildStage, "vite-shell-artifact-contract-v1");
  assert.equal(status.productionExecution, "classic-script-fallback");
  assert.equal(status.artifactRoot, "public/vite-shell");
  assert.equal(status.publishedFileCount, 5);
  assert.deepEqual(status.preview, {
    fileName: "preview.html",
    entryScript: "/vite-shell/assets/vite-shell-entry-test.js",
  });
  assert.equal(status.classicShellManifestMatch, true);
  assert.equal(status.entryGroupChunkCount, 1);
  assert.equal(status.startupCriticalAssetCount, 1);
  assert.deepEqual(status.artifactManifest, {
    shellCacheName: "codex-mobile-shell-test",
    clientBuildId: "0.1.11|codex-mobile-shell-test",
    indexScriptCount: 2,
    entryGroupCount: 1,
    entryGroupChunkCount: 1,
    startupCriticalAssetCount: 1,
    classicGlobalExportAssetCount: 1,
    classicGlobalExportCount: 1,
    pageShellAssetCount: 6,
    hashAssetCount: 5,
  });
  assert.deepEqual(status.issueCodes, []);
  assert.deepEqual(status.entryGroupChunks, [{
    groupId: "app-entry",
    fileName: "assets/vite-entry-group-app-entry-test.js",
    entryScript: "/vite-shell/assets/vite-entry-group-app-entry-test.js",
  }]);
  assert.equal(status.publishedFiles.every((file) => file.exists && !path.isAbsolute(file.fileName)), true);
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
  fs.writeFileSync(path.join(buildRoot, "assets", "vite-shell-entry-test.js"), "export const entry = true;\n");
  fs.writeFileSync(path.join(buildRoot, "assets", "vite-deferred-entry-topology-test.js"), "export const deferred = true;\n");
  fs.writeFileSync(path.join(buildRoot, "assets", "vite-entry-group-app-entry-test.js"), "export const group = true;\n");
  fs.writeFileSync(path.join(buildRoot, "shell-extra.js"), "should not publish\n");
  fs.writeFileSync(path.join(buildRoot, "codex-mobile-shell-manifest.json"), JSON.stringify({
    shellCacheName: "codex-mobile-shell-test",
    clientBuildId: "0.1.11|codex-mobile-shell-test",
    entryGroups: [{
      id: "app-entry",
      startupCritical: true,
      assets: ["/app.js"],
    }],
    viteBuild: {
      stage: "vite-shell-artifact-contract-v1",
      productionExecution: "classic-script-fallback",
      validation: { ok: true, issues: [] },
      viteEntry: {
        source: "frontend/vite-shell-entry.mjs",
        fileName: "assets/vite-shell-entry-test.js",
      },
      viteDeferredChunks: [{
        source: "frontend/vite-deferred-entry-topology.mjs",
        fileName: "assets/vite-deferred-entry-topology-test.js",
      }],
      viteEntryGroupChunks: [{
        groupId: "app-entry",
        source: "virtual:codex-mobile-shell-entry-group/app-entry",
        fileName: "assets/vite-entry-group-app-entry-test.js",
      }],
    },
  }, null, 2));

  const readback = publishViteShellPublicArtifact({ root, buildRoot });
  const published = fs.readdirSync(path.join(root, "public", "vite-shell")).sort();
  assert.equal(readback.validation.ok, true);
  assert.deepEqual(published, ["assets", "codex-mobile-shell-manifest.json", "preview.html", "vite-shell-readback.json"]);
  assert.equal(fs.existsSync(path.join(root, "public", "vite-shell", "shell-extra.js")), false);
  assert.equal(fs.existsSync(path.join(root, "public", "vite-shell", "assets", "vite-shell-entry-test.js")), true);
  assert.equal(fs.existsSync(path.join(root, "public", "vite-shell", "assets", "vite-deferred-entry-topology-test.js")), true);
  assert.equal(fs.existsSync(path.join(root, "public", "vite-shell", "assets", "vite-entry-group-app-entry-test.js")), true);
  const previewHtml = fs.readFileSync(path.join(root, "public", "vite-shell", "preview.html"), "utf8");
  assert.match(previewHtml, /id="codex-vite-shell-preview"/);
  assert.match(previewHtml, /data-startup-critical-asset-count="1"/);
  assert.match(previewHtml, /data-entry-group-chunk-count="1"/);
  assert.match(previewHtml, /rel="preload" as="script" href="\/app\.js" data-codex-vite-startup-asset="true"/);
  assert.match(previewHtml, /rel="modulepreload" href="\/vite-shell\/assets\/vite-entry-group-app-entry-test\.js" data-codex-vite-entry-group-chunk="true"/);
  assert.match(previewHtml, /data-codex-vite-entry-group-imports="true"/);
  assert.match(previewHtml, /__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_PROMISE__/);
  assert.match(previewHtml, /type="module" src="\/vite-shell\/assets\/vite-shell-entry-test\.js"/);
  assert.equal(readback.preview.fileName, "preview.html");
  assert.equal(readback.preview.entryScript, "/vite-shell/assets/vite-shell-entry-test.js");
  assert.deepEqual(readback.entryGroupChunks, [{
    groupId: "app-entry",
    source: "virtual:codex-mobile-shell-entry-group/app-entry",
    fileName: "assets/vite-entry-group-app-entry-test.js",
    entryScript: "/vite-shell/assets/vite-entry-group-app-entry-test.js",
  }]);
  assert.deepEqual(readback.startupCriticalAssets, ["/app.js"]);
  assert.equal(readback.counts.startupCriticalAssets, 1);
  assert.equal(readback.counts.entryGroupChunks, 1);
  assert.equal(readback.counts.publishedFiles, 5);
});

test("Vite shell artifact status fails closed when entry group import script is missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-vite-import-missing-"));
  const artifactRoot = writeArtifact(root);
  const previewPath = path.join(artifactRoot, "preview.html");
  const previewHtml = fs.readFileSync(previewPath, "utf8")
    .replace(/<script type="module" data-codex-vite-entry-group-imports="true">[\s\S]*?<\/script>\n?/, "");
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
  assert.ok(status.issueCodes.includes("vite_shell_preview_entry_group_import_script_missing"));
  assert.ok(!status.issueCodes.includes("vite_artifact_file_hash_mismatch"));
});
