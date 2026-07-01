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
  const manifest = Buffer.from(JSON.stringify({
    shellCacheName: "codex-mobile-shell-test",
    clientBuildId: "0.1.11|codex-mobile-shell-test",
    viteBuild: {
      stage: "vite-shell-artifact-contract-v1",
      productionExecution: "classic-script-fallback",
    },
  }, null, 2));
  fs.writeFileSync(path.join(artifactRoot, "assets", "vite-shell-entry-test.js"), entry);
  fs.writeFileSync(path.join(artifactRoot, "assets", "vite-deferred-entry-topology-test.js"), deferred);
  fs.writeFileSync(path.join(artifactRoot, "codex-mobile-shell-manifest.json"), manifest);
  const readback = {
    schemaVersion: 1,
    stage: options.stage || "vite-shell-public-preview-v1",
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
    publishedFiles: [
      { fileName: "codex-mobile-shell-manifest.json", bytes: manifest.length, sha256: sha256Hex(manifest) },
      { fileName: "assets/vite-shell-entry-test.js", bytes: entry.length, sha256: sha256Hex(entry) },
      { fileName: "assets/vite-deferred-entry-topology-test.js", bytes: deferred.length, sha256: sha256Hex(deferred) },
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
  writeArtifact(root);
  const artifactService = service.createViteShellArtifactService({
    appRoot: root,
    readShellAssetManifest: () => ({
      shellCacheName: "codex-mobile-shell-test",
      clientBuildId: "0.1.11|codex-mobile-shell-test",
    }),
  });
  const status = artifactService.readPublicArtifactStatus();
  assert.equal(status.ok, true);
  assert.equal(status.available, true);
  assert.equal(status.stage, "vite-shell-public-preview-v1");
  assert.equal(status.sourceBuildStage, "vite-shell-artifact-contract-v1");
  assert.equal(status.productionExecution, "classic-script-fallback");
  assert.equal(status.artifactRoot, "public/vite-shell");
  assert.equal(status.publishedFileCount, 3);
  assert.deepEqual(status.issueCodes, []);
  assert.equal(status.publishedFiles.every((file) => file.exists && !path.isAbsolute(file.fileName)), true);
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
});

test("Vite shell artifact publisher copies only bounded preview artifacts", async () => {
  const { publishViteShellPublicArtifact } = await import("../scripts/publish-vite-shell-artifact.mjs");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-vite-publish-"));
  const buildRoot = path.join(root, "dist", "frontend-shell");
  fs.mkdirSync(path.join(buildRoot, "assets"), { recursive: true });
  fs.writeFileSync(path.join(buildRoot, "assets", "vite-shell-entry-test.js"), "export const entry = true;\n");
  fs.writeFileSync(path.join(buildRoot, "assets", "vite-deferred-entry-topology-test.js"), "export const deferred = true;\n");
  fs.writeFileSync(path.join(buildRoot, "shell-extra.js"), "should not publish\n");
  fs.writeFileSync(path.join(buildRoot, "codex-mobile-shell-manifest.json"), JSON.stringify({
    shellCacheName: "codex-mobile-shell-test",
    clientBuildId: "0.1.11|codex-mobile-shell-test",
    entryGroups: [{ id: "app-entry" }],
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
    },
  }, null, 2));

  const readback = publishViteShellPublicArtifact({ root, buildRoot });
  const published = fs.readdirSync(path.join(root, "public", "vite-shell")).sort();
  assert.equal(readback.validation.ok, true);
  assert.deepEqual(published, ["assets", "codex-mobile-shell-manifest.json", "vite-shell-readback.json"]);
  assert.equal(fs.existsSync(path.join(root, "public", "vite-shell", "shell-extra.js")), false);
  assert.equal(fs.existsSync(path.join(root, "public", "vite-shell", "assets", "vite-shell-entry-test.js")), true);
  assert.equal(fs.existsSync(path.join(root, "public", "vite-shell", "assets", "vite-deferred-entry-topology-test.js")), true);
});
