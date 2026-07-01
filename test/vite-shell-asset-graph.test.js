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
  assert.equal(manifest.shellCacheName, "codex-mobile-shell-v621");
  assert.equal(manifest.clientBuildId, "0.1.11|codex-mobile-shell-v621");
  assert.equal(manifest.indexScriptAssets[0], "/api-client.js");
  assert.equal(manifest.indexScriptAssets.at(-1), "/app.js");
  assert.ok(manifest.indexScriptAssets.includes("/app-bootstrap.js"));
  assert.ok(manifest.indexScriptAssets.includes("/runtime-wiring-runtime.js"));
  assert.ok(manifest.indexScriptAssets.includes("/app-shell-runtime.js"));
  assert.ok(manifest.swStaticAssets.includes("/pane-layout-runtime.js"));
  assert.ok(manifest.pageShellAssets.includes("/sw.js"));
  assert.ok(manifest.serverHashAssets.includes("/app-shell-runtime.js"));
  assert.ok(manifest.assets.some((asset) => asset.path === "/" && asset.sourcePath === "public/index.html"));
  assert.ok(manifest.assets.every((asset) => asset.exists));
});

test("Vite shell asset graph fails closed when service worker misses an index script", async () => {
  const { buildShellAssetManifest } = await loadAssetGraphModule();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-shell-assets-"));
  fs.mkdirSync(path.join(root, "public", "icons"), { recursive: true });
  fs.mkdirSync(path.join(root, "services", "runtime"), { recursive: true });
  fs.writeFileSync(path.join(root, "public", "index.html"), [
    "<!doctype html>",
    "<script src=\"/a.js\"></script>",
    "<script src=\"/b.js\"></script>",
  ].join("\n"));
  fs.writeFileSync(path.join(root, "public", "a.js"), "\"use strict\";\n");
  fs.writeFileSync(path.join(root, "public", "b.js"), "\"use strict\";\n");
  fs.writeFileSync(path.join(root, "public", "sw.js"), [
    "const CACHE_NAME = \"codex-mobile-shell-test\";",
    "const STATIC_ASSETS = [\"/\", \"/index.html\", \"/a.js\"];",
  ].join("\n"));
  fs.writeFileSync(path.join(root, "public", "app-bootstrap.js"), [
    "var CLIENT_BUILD_ID = \"0.1.11|codex-mobile-shell-test\";",
    "var PAGE_SHELL_ASSETS = Object.freeze([\"/\", \"/index.html\", \"/a.js\", \"/b.js\", \"/sw.js\"]);",
  ].join("\n"));
  fs.writeFileSync(path.join(root, "services", "runtime", "server-runtime-utils.js"), [
    "for (const file of [\"a.js\", \"b.js\", \"sw.js\"]) {",
    "  parts.push(file);",
    "}",
  ].join("\n"));
  const manifest = buildShellAssetManifest(root);
  assert.equal(manifest.validation.ok, false);
  assert.ok(manifest.validation.issues.some((issue) => issue.code === "sw_missing_index_script" && issue.asset === "/b.js"));
});
