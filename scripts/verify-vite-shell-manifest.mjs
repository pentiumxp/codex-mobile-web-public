import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  VITE_ESM_COMPATIBILITY_MODULES,
  VITE_ESM_COMPATIBILITY_SOURCE,
  buildShellAssetManifest,
} from "./frontend-shell-asset-graph.mjs";
import { renderShellScriptBlock } from "./generate-frontend-shell-manifest.mjs";

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

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
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
  if (JSON.stringify(built.classicGlobalExports) !== JSON.stringify(current.classicGlobalExports)) {
    mismatch.push("classicGlobalExports");
  }
  if (JSON.stringify(built.startupGlobalContracts) !== JSON.stringify(current.startupGlobalContracts)) {
    mismatch.push("startupGlobalContracts");
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
    const entryGroupChunks = Array.isArray(viteBuild.viteEntryGroupChunks) ? viteBuild.viteEntryGroupChunks : [];
    if (entryGroupChunks.length !== (current.entryGroups || []).length) {
      mismatch.push("viteBuildEntryGroupChunks");
    }
    const startupCompatibility = viteBuild.startupCompatibility && typeof viteBuild.startupCompatibility === "object"
      ? viteBuild.startupCompatibility
      : null;
    if (!startupCompatibility
      || Number(startupCompatibility.requiredGlobalCount) !== (current.startupGlobalContracts || []).length
      || Number(startupCompatibility.hashCount) !== Number(startupCompatibility.requiredGlobalCount)) {
      mismatch.push("viteBuildStartupCompatibility");
    }
    const classicScriptBlock = viteBuild.classicFallback
      && viteBuild.classicFallback.scriptBlock;
    const expectedClassicScriptBlockHash = sha256Hex(Buffer.from(
      renderShellScriptBlock(current.indexScriptAssets || []),
      "utf8"
    ));
    if (!classicScriptBlock || classicScriptBlock.sha256 !== expectedClassicScriptBlockHash) {
      mismatch.push("viteBuildClassicScriptBlock");
    } else if (Number(classicScriptBlock.scriptCount) !== (current.indexScriptAssets || []).length) {
      mismatch.push("viteBuildClassicScriptBlockCount");
    }
    const appPreviewClassicLoaderPlan = viteBuild.appPreviewClassicLoaderPlan
      && typeof viteBuild.appPreviewClassicLoaderPlan === "object"
      ? viteBuild.appPreviewClassicLoaderPlan
      : null;
    const appPreviewClassicLoaderScripts = appPreviewClassicLoaderPlan
      && Array.isArray(appPreviewClassicLoaderPlan.scripts)
      ? appPreviewClassicLoaderPlan.scripts
      : [];
    if (!appPreviewClassicLoaderPlan || appPreviewClassicLoaderPlan.owner !== "vite-shell-entry") {
      mismatch.push("viteBuildAppPreviewClassicLoaderPlan");
    } else if (Number(appPreviewClassicLoaderPlan.scriptCount) !== (current.indexScriptAssets || []).length
      || Number(appPreviewClassicLoaderPlan.hashCount) !== (current.indexScriptAssets || []).length
      || !appPreviewClassicLoaderPlan.sha256) {
      mismatch.push("viteBuildAppPreviewClassicLoaderPlanCount");
    } else if (JSON.stringify(appPreviewClassicLoaderScripts.map((entry) => entry && entry.path))
      !== JSON.stringify(current.indexScriptAssets || [])) {
      mismatch.push("viteBuildAppPreviewClassicLoaderPlanOrder");
    }
    const esmCompatibility = viteBuild.esmCompatibility && typeof viteBuild.esmCompatibility === "object"
      ? viteBuild.esmCompatibility
      : null;
    const esmCompatibilityModules = esmCompatibility && Array.isArray(esmCompatibility.modules)
      ? esmCompatibility.modules
      : [];
    const expectedEsmIds = VITE_ESM_COMPATIBILITY_MODULES.map((entry) => entry.id);
    const expectedEsmFunctionCount = VITE_ESM_COMPATIBILITY_MODULES.reduce((total, entry) => (
      total + (Array.isArray(entry && entry.expectedFunctions) ? entry.expectedFunctions.length : 0)
    ), 0);
    if (!esmCompatibility
      || esmCompatibility.owner !== "vite-shell-entry"
      || esmCompatibility.virtualModuleSource !== VITE_ESM_COMPATIBILITY_SOURCE) {
      mismatch.push("viteBuildEsmCompatibility");
    } else if (Number(esmCompatibility.moduleCount) !== expectedEsmIds.length
      || Number(esmCompatibility.hashCount) !== expectedEsmIds.length
      || Number(esmCompatibility.expectedFunctionCount) !== expectedEsmFunctionCount) {
      mismatch.push("viteBuildEsmCompatibilityCount");
    } else if (JSON.stringify(esmCompatibilityModules.map((entry) => entry && entry.id))
      !== JSON.stringify(expectedEsmIds)) {
      mismatch.push("viteBuildEsmCompatibilityOrder");
    } else if (esmCompatibilityModules.some((entry) => !entry || !entry.source || !entry.sha256 || !Number(entry.bytes))) {
      mismatch.push("viteBuildEsmCompatibilityHash");
    }
    const entryDynamicImportGraph = viteBuild.entryDynamicImportGraph && typeof viteBuild.entryDynamicImportGraph === "object"
      ? viteBuild.entryDynamicImportGraph
      : null;
    if (!entryDynamicImportGraph || entryDynamicImportGraph.owner !== "vite-shell-entry") {
      mismatch.push("viteBuildEntryDynamicImportGraph");
    } else {
      if ((entryDynamicImportGraph.missingFiles || []).length) {
        mismatch.push("viteBuildEntryDynamicImportMissing");
      }
      if ((entryDynamicImportGraph.extraFiles || []).length) {
        mismatch.push("viteBuildEntryDynamicImportExtra");
      }
      if (Number(entryDynamicImportGraph.deferredFileCount) < 1) {
        mismatch.push("viteBuildEntryDynamicImportDeferred");
      }
      if (Number(entryDynamicImportGraph.entryGroupFileCount) !== entryGroupChunks.length) {
        mismatch.push("viteBuildEntryDynamicImportEntryGroups");
      }
      const manifestDynamicImportFiles = [];
      for (const dynamicImport of shellEntry && Array.isArray(shellEntry.dynamicImports) ? shellEntry.dynamicImports : []) {
        const chunk = viteManifest[dynamicImport];
        if (chunk && chunk.file) manifestDynamicImportFiles.push(chunk.file);
      }
      const manifestFiles = manifestDynamicImportFiles.slice().sort();
      const graphFiles = (entryDynamicImportGraph.actualFiles || []).slice().sort();
      if (JSON.stringify(manifestFiles) !== JSON.stringify(graphFiles)) {
        mismatch.push("viteBuildEntryDynamicImportFiles");
      }
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
    for (const chunk of entryGroupChunks) {
      if (!chunk.fileName || !outputFiles.has(chunk.fileName)) {
        mismatch.push("viteBuildOutputEntryGroupFile");
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
      startupCriticalAssets: built.counts.startupCriticalAssets,
      startupGlobalContracts: built.counts.startupGlobalContracts,
      classicGlobalExports: built.counts.classicGlobalExports,
      entryGroupChunks: built.viteBuild.viteEntryGroupChunks.length,
      entryDynamicImports: built.viteBuild.entryDynamicImportGraph
        ? built.viteBuild.entryDynamicImportGraph.actualFiles.length
        : 0,
      classicShellScriptBlockScripts: built.viteBuild.classicFallback
        && built.viteBuild.classicFallback.scriptBlock
        ? built.viteBuild.classicFallback.scriptBlock.scriptCount
        : 0,
      appPreviewClassicLoaderScripts: built.viteBuild.appPreviewClassicLoaderPlan
        ? built.viteBuild.appPreviewClassicLoaderPlan.scriptCount
        : 0,
      esmCompatibilityModules: built.viteBuild.esmCompatibility
        ? built.viteBuild.esmCompatibility.moduleCount
        : 0,
      viteBuildStage: built.viteBuild.stage,
    }));
  }
}
