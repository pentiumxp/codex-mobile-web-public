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
  if (JSON.stringify(built.entryGroups) !== JSON.stringify(current.entryGroups)) {
    mismatch.push("entryGroups");
  }
  if (!built.validation || !built.validation.ok) {
    mismatch.push("builtValidation");
  }
  if (!current.validation.ok) {
    mismatch.push("currentValidation");
  }
  const viteManifest = readJson(viteManifestPath);
  const shellEntry = viteManifest["frontend/vite-shell-entry.mjs"];
  if (!shellEntry) {
    mismatch.push("viteShellEntry");
  } else if (!Array.isArray(shellEntry.dynamicImports) || !shellEntry.dynamicImports.length) {
    mismatch.push("viteDeferredEntryChunk");
  }
  if (!built.viteBuild || !built.viteBuild.validation || !built.viteBuild.validation.ok) {
    mismatch.push("viteBuildContract");
  } else {
    const viteBuild = built.viteBuild;
    if (viteBuild.productionExecution !== "classic-script-fallback") {
      mismatch.push("viteBuildProductionExecution");
    }
    if (!viteBuild.viteEntry || viteBuild.viteEntry.source !== "frontend/vite-shell-entry.mjs") {
      mismatch.push("viteBuildEntrySource");
    }
    if (shellEntry && viteBuild.viteEntry && viteBuild.viteEntry.fileName !== shellEntry.file) {
      mismatch.push("viteBuildEntryFile");
    }
    const deferredSources = new Set((viteBuild.viteDeferredChunks || []).map((chunk) => chunk.source));
    if (!deferredSources.has("frontend/vite-deferred-entry-topology.mjs")) {
      mismatch.push("viteBuildDeferredEntry");
    }
    const outputFiles = new Set(viteBuild.outputFiles || []);
    if (shellEntry && !outputFiles.has(shellEntry.file)) {
      mismatch.push("viteBuildOutputEntryFile");
    }
    for (const dynamicImport of shellEntry && Array.isArray(shellEntry.dynamicImports) ? shellEntry.dynamicImports : []) {
      const chunk = viteManifest[dynamicImport];
      if (chunk && !outputFiles.has(chunk.file)) {
        mismatch.push("viteBuildOutputDeferredFile");
        break;
      }
    }
    if (!outputFiles.has("codex-mobile-shell-manifest.json")) {
      mismatch.push("viteBuildOutputManifest");
    }
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
      viteBuildStage: built.viteBuild.stage,
    }));
  }
}
