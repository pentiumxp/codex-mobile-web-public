import fs from "node:fs";
import path from "node:path";
import { buildShellAssetManifest } from "./frontend-shell-asset-graph.mjs";

const root = process.cwd();
const buildRoot = path.join(root, "dist", "frontend-shell");
const manifestPath = path.join(buildRoot, "codex-mobile-shell-manifest.json");
const viteManifestPath = path.join(buildRoot, ".vite", "manifest.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!fs.existsSync(manifestPath)) {
  fail(`missing Vite shell manifest: ${manifestPath}`);
} else if (!fs.existsSync(viteManifestPath)) {
  fail(`missing Vite rollup manifest: ${viteManifestPath}`);
} else {
  const built = readJson(manifestPath);
  const current = buildShellAssetManifest(root);
  const mismatch = [];
  for (const key of ["shellCacheName", "clientBuildId"]) {
    if (built[key] !== current[key]) mismatch.push(key);
  }
  if (JSON.stringify(built.indexScriptAssets) !== JSON.stringify(current.indexScriptAssets)) {
    mismatch.push("indexScriptAssets");
  }
  if (JSON.stringify(built.swStaticAssets) !== JSON.stringify(current.swStaticAssets)) {
    mismatch.push("swStaticAssets");
  }
  if (JSON.stringify(built.pageShellAssets) !== JSON.stringify(current.pageShellAssets)) {
    mismatch.push("pageShellAssets");
  }
  if (!built.validation || !built.validation.ok) {
    mismatch.push("builtValidation");
  }
  if (!current.validation.ok) {
    mismatch.push("currentValidation");
  }
  if (mismatch.length) {
    fail(`Vite shell manifest mismatch: ${mismatch.join(", ")}`);
  } else {
    console.log(JSON.stringify({
      ok: true,
      shellCacheName: built.shellCacheName,
      clientBuildId: built.clientBuildId,
      indexScripts: built.counts.indexScripts,
      emittedAssets: built.counts.emittedAssets,
    }));
  }
}
