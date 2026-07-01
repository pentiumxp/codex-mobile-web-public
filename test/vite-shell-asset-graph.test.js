"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

async function loadAssetGraphModule() {
  return import("../scripts/frontend-shell-asset-graph.mjs");
}

test("Vite shell asset graph covers the current ordered frontend shell", async () => {
  const { buildShellAssetManifest } = await loadAssetGraphModule();
  const manifest = buildShellAssetManifest(path.resolve(__dirname, ".."));
  assert.equal(manifest.validation.ok, true);
  assert.equal(manifest.shellCacheName, "codex-mobile-shell-v623");
  assert.equal(manifest.clientBuildId, "0.1.11|codex-mobile-shell-v623");
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

test("Vite shell asset graph fails closed when generated manifest is stale", async () => {
  const { buildShellAssetManifest } = await loadAssetGraphModule();
  const { writePublicShellManifest } = await import("../scripts/generate-frontend-shell-manifest.mjs");
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
  writePublicShellManifest(root);
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
