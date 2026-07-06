import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const VITE_SHELL_PUBLIC_ARTIFACT_STAGE = "vite-shell-preview-html-v1";
export const VITE_SHELL_PUBLIC_ARTIFACT_ROOT = "public/vite-shell";
export const VITE_SHELL_PUBLIC_READBACK_FILE = "vite-shell-readback.json";
export const VITE_SHELL_PUBLIC_PREVIEW_FILE = "preview.html";
export const VITE_SHELL_PUBLIC_APP_PREVIEW_FILE = "app-preview.html";
export const VITE_SHELL_PUBLIC_APP_PREVIEW_ENTRY_FILE = "app-preview-entry.js";
export const CLASSIC_SHELL_SCRIPT_BLOCK_START = "<!-- CODEX_MOBILE_SHELL_SCRIPTS:BEGIN -->";
export const CLASSIC_SHELL_SCRIPT_BLOCK_END = "<!-- CODEX_MOBILE_SHELL_SCRIPTS:END -->";
export const VITE_APP_PREVIEW_SCRIPT_BLOCK_START = "<!-- CODEX_MOBILE_VITE_APP_PREVIEW:BEGIN -->";
export const VITE_APP_PREVIEW_SCRIPT_BLOCK_END = "<!-- CODEX_MOBILE_VITE_APP_PREVIEW:END -->";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function normalizeRelativeFileName(value) {
  const text = String(value || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!text || path.isAbsolute(text) || text.split("/").includes("..")) return "";
  return text;
}

function uniqueValues(values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const text = normalizeRelativeFileName(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function fileRecord(root, relativePath) {
  const fileName = normalizeRelativeFileName(relativePath);
  if (!fileName) return null;
  const absolutePath = path.join(root, fileName);
  const buffer = fs.readFileSync(absolutePath);
  return {
    fileName,
    bytes: buffer.length,
    sha256: sha256Hex(buffer),
  };
}

function bufferRecord(relativePath, body) {
  const fileName = normalizeRelativeFileName(relativePath);
  if (!fileName) return null;
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body || ""), "utf8");
  return {
    fileName,
    bytes: buffer.length,
    sha256: sha256Hex(buffer),
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function publicArtifactUrl(fileName) {
  const relativePath = normalizeRelativeFileName(fileName);
  if (!relativePath) return "";
  return `/${VITE_SHELL_PUBLIC_ARTIFACT_ROOT.replace(/^public\//, "")}/${relativePath}`;
}

function requiredArtifactFiles(manifest) {
  const viteBuild = manifest && manifest.viteBuild || {};
  const entryFile = viteBuild.viteEntry && viteBuild.viteEntry.fileName;
  const dynamicImportFiles = viteBuild.entryDynamicImportGraph
    && Array.isArray(viteBuild.entryDynamicImportGraph.expectedFiles)
    ? viteBuild.entryDynamicImportGraph.expectedFiles
    : [];
  const esmCompatibilityFiles = (viteBuild.viteEsmCompatibilityChunks || []).map((chunk) => chunk && chunk.fileName);
  const deferredFiles = (viteBuild.viteDeferredChunks || []).map((chunk) => chunk && chunk.fileName);
  const entryGroupFiles = (viteBuild.viteEntryGroupChunks || []).map((chunk) => chunk && chunk.fileName);
  const viteOwnedAppBootstrapFiles = (viteBuild.viteOwnedAppBootstrapChunks || []).map((chunk) => chunk && chunk.fileName);
  const sharedFiles = (viteBuild.viteSharedChunks || []).map((chunk) => chunk && chunk.fileName);
  return uniqueValues([
    "codex-mobile-shell-manifest.json",
    entryFile,
    ...dynamicImportFiles,
    ...esmCompatibilityFiles,
    ...deferredFiles,
    ...entryGroupFiles,
    ...viteOwnedAppBootstrapFiles,
    ...sharedFiles,
  ]);
}

function startupCriticalAssets(manifest) {
  const assets = [];
  for (const group of Array.isArray(manifest && manifest.entryGroups) ? manifest.entryGroups : []) {
    if (!group || !group.startupCritical) continue;
    for (const asset of Array.isArray(group.assets) ? group.assets : []) {
      const text = String(asset || "").trim();
      if (text && text.startsWith("/")) assets.push(text);
    }
  }
  return [...new Set(assets)];
}

function startupGlobalContracts(viteBuild) {
  const compatibility = viteBuild && viteBuild.startupCompatibility || {};
  return (Array.isArray(compatibility.requiredGlobals) ? compatibility.requiredGlobals : [])
    .map((entry) => ({
      name: String(entry && entry.name || ""),
      asset: String(entry && entry.asset || ""),
      groupId: String(entry && entry.groupId || ""),
      startupCritical: Boolean(entry && entry.startupCritical),
      source: String(entry && entry.source || "startup-window-guard"),
      exportedAsset: String(entry && entry.exportedAsset || ""),
      bytes: Number.isFinite(Number(entry && entry.bytes)) ? Number(entry.bytes) : 0,
      sha256: String(entry && entry.sha256 || ""),
    }))
    .filter((entry) => entry.name);
}

function scriptAssetsFromManifest(manifest) {
  if (Array.isArray(manifest && manifest.indexScriptAssets)) return manifest.indexScriptAssets.slice();
  if (Array.isArray(manifest && manifest.scriptAssets)) return manifest.scriptAssets.slice();
  const assets = [];
  for (const group of Array.isArray(manifest && manifest.entryGroups) ? manifest.entryGroups : []) {
    for (const asset of Array.isArray(group && group.assets) ? group.assets : []) {
      const text = String(asset || "").trim();
      if (text && text.startsWith("/")) assets.push(text);
    }
  }
  return [...new Set(assets)];
}

function renderClassicShellScriptBlock(scriptAssets) {
  return [
    CLASSIC_SHELL_SCRIPT_BLOCK_START,
    ...scriptAssets.map((asset) => `  <script src="${asset}"></script>`),
    CLASSIC_SHELL_SCRIPT_BLOCK_END,
  ].join("\n");
}

function classicShellScriptBlockContract(manifest, viteBuild) {
  const fallbackBlock = viteBuild
    && viteBuild.classicFallback
    && viteBuild.classicFallback.scriptBlock;
  if (fallbackBlock && fallbackBlock.sha256) {
    return {
      schemaVersion: Number(fallbackBlock.schemaVersion) || 1,
      source: String(fallbackBlock.source || "generated-classic-index-script-block"),
      startMarker: String(fallbackBlock.startMarker || CLASSIC_SHELL_SCRIPT_BLOCK_START),
      endMarker: String(fallbackBlock.endMarker || CLASSIC_SHELL_SCRIPT_BLOCK_END),
      scriptCount: Number(fallbackBlock.scriptCount) || 0,
      firstScript: String(fallbackBlock.firstScript || ""),
      lastScript: String(fallbackBlock.lastScript || ""),
      sha256: String(fallbackBlock.sha256 || ""),
    };
  }
  const scriptAssets = scriptAssetsFromManifest(manifest);
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

function normalizeAppPreviewClassicLoaderPlan(plan) {
  if (!plan || typeof plan !== "object") return null;
  const normalizeScript = (entry) => ({
    index: Number.isFinite(Number(entry && entry.index)) ? Number(entry.index) : 0,
    sourceIndex: Number.isFinite(Number(entry && entry.sourceIndex)) ? Number(entry.sourceIndex) : 0,
    path: String(entry && entry.path || ""),
    groupId: String(entry && entry.groupId || ""),
    phase: String(entry && entry.phase || ""),
    startupCritical: Boolean(entry && entry.startupCritical),
    chunkTarget: String(entry && entry.chunkTarget || ""),
    sourcePath: String(entry && entry.sourcePath || ""),
    bytes: Number.isFinite(Number(entry && entry.bytes)) ? Number(entry.bytes) : 0,
    sha256: String(entry && entry.sha256 || ""),
  });
  const scripts = (Array.isArray(plan.scripts) ? plan.scripts : [])
    .map(normalizeScript)
    .filter((entry) => entry.path);
  const excludedEsmScripts = (Array.isArray(plan.excludedEsmScripts) ? plan.excludedEsmScripts : [])
    .map((entry) => ({
      ...normalizeScript(entry),
      esmModuleId: String(entry && entry.esmModuleId || ""),
      globalName: String(entry && entry.globalName || ""),
    }))
    .filter((entry) => entry.path);
  const excludedViteOwnedScripts = (Array.isArray(plan.excludedViteOwnedScripts) ? plan.excludedViteOwnedScripts : [])
    .map((entry) => ({
      ...normalizeScript(entry),
      ownerId: String(entry && entry.ownerId || ""),
      globalName: String(entry && entry.globalName || ""),
    }))
    .filter((entry) => entry.path);
  return {
    schemaVersion: Number(plan.schemaVersion) || 1,
    source: String(plan.source || "generated-vite-app-preview-classic-loader-plan"),
    owner: String(plan.owner || ""),
    sourceScriptCount: Number.isFinite(Number(plan.sourceScriptCount)) ? Number(plan.sourceScriptCount) : scripts.length + excludedEsmScripts.length + excludedViteOwnedScripts.length,
    scriptCount: Number.isFinite(Number(plan.scriptCount)) ? Number(plan.scriptCount) : scripts.length,
    firstScript: String(plan.firstScript || ""),
    lastScript: String(plan.lastScript || ""),
    hashCount: Number.isFinite(Number(plan.hashCount)) ? Number(plan.hashCount) : scripts.filter((entry) => entry.sha256).length,
    byteCount: Number.isFinite(Number(plan.byteCount)) ? Number(plan.byteCount) : scripts.reduce((total, entry) => total + entry.bytes, 0),
    excludedEsmScriptCount: Number.isFinite(Number(plan.excludedEsmScriptCount)) ? Number(plan.excludedEsmScriptCount) : excludedEsmScripts.length,
    excludedEsmHashCount: Number.isFinite(Number(plan.excludedEsmHashCount)) ? Number(plan.excludedEsmHashCount) : excludedEsmScripts.filter((entry) => entry.sha256).length,
    excludedEsmByteCount: Number.isFinite(Number(plan.excludedEsmByteCount)) ? Number(plan.excludedEsmByteCount) : excludedEsmScripts.reduce((total, entry) => total + entry.bytes, 0),
    excludedViteOwnedScriptCount: Number.isFinite(Number(plan.excludedViteOwnedScriptCount)) ? Number(plan.excludedViteOwnedScriptCount) : excludedViteOwnedScripts.length,
    excludedViteOwnedHashCount: Number.isFinite(Number(plan.excludedViteOwnedHashCount)) ? Number(plan.excludedViteOwnedHashCount) : excludedViteOwnedScripts.filter((entry) => entry.sha256).length,
    excludedViteOwnedByteCount: Number.isFinite(Number(plan.excludedViteOwnedByteCount)) ? Number(plan.excludedViteOwnedByteCount) : excludedViteOwnedScripts.reduce((total, entry) => total + entry.bytes, 0),
    excludedEsmScripts,
    excludedViteOwnedScripts,
    sha256: String(plan.sha256 || ""),
    scripts,
  };
}

function normalizeEsmCompatibilityContract(contract) {
  if (!contract || typeof contract !== "object") return null;
  const shards = (Array.isArray(contract.shards) ? contract.shards : [])
    .map((entry) => ({
      id: String(entry && entry.id || ""),
      index: Number.isFinite(Number(entry && entry.index)) ? Number(entry.index) : 0,
      source: String(entry && entry.source || ""),
      moduleCount: Number.isFinite(Number(entry && entry.moduleCount)) ? Number(entry.moduleCount) : 0,
      moduleIds: Array.isArray(entry && entry.moduleIds)
        ? entry.moduleIds.map((id) => String(id || "")).filter(Boolean)
        : [],
      byteCount: Number.isFinite(Number(entry && entry.byteCount)) ? Number(entry.byteCount) : 0,
    }))
    .filter((entry) => entry.id && entry.source);
  const modules = (Array.isArray(contract.modules) ? contract.modules : [])
    .map((entry) => ({
      index: Number.isFinite(Number(entry && entry.index)) ? Number(entry.index) : 0,
      id: String(entry && entry.id || ""),
      source: String(entry && entry.source || ""),
      assetPath: String(entry && entry.assetPath || ""),
      nativeSource: String(entry && entry.nativeSource || ""),
      importSource: String(entry && entry.importSource || entry && entry.source || ""),
      compatibilityMode: String(entry && entry.compatibilityMode || "classic-global-compat"),
      globalName: String(entry && entry.globalName || ""),
      classicLoaderExcluded: Boolean(entry && entry.classicLoaderExcluded),
      expectedFunctions: Array.isArray(entry && entry.expectedFunctions)
        ? entry.expectedFunctions.map((name) => String(name || "")).filter(Boolean)
        : [],
      expectedFunctionCount: Number.isFinite(Number(entry && entry.expectedFunctionCount))
        ? Number(entry.expectedFunctionCount)
        : 0,
      bytes: Number.isFinite(Number(entry && entry.bytes)) ? Number(entry.bytes) : 0,
      sha256: String(entry && entry.sha256 || ""),
      hashPresent: Boolean(entry && entry.hashPresent),
    }))
    .filter((entry) => entry.id);
  return {
    schemaVersion: Number(contract.schemaVersion) || 1,
    source: String(contract.source || "generated-vite-esm-compatibility-contract"),
    owner: String(contract.owner || ""),
    virtualModuleSource: String(contract.virtualModuleSource || ""),
    virtualShardSourcePrefix: String(contract.virtualShardSourcePrefix || ""),
    shardCount: Number.isFinite(Number(contract.shardCount)) ? Number(contract.shardCount) : shards.length,
    shards,
    moduleCount: Number.isFinite(Number(contract.moduleCount)) ? Number(contract.moduleCount) : modules.length,
    nativeEsmModuleCount: Number.isFinite(Number(contract.nativeEsmModuleCount))
      ? Number(contract.nativeEsmModuleCount)
      : modules.filter((entry) => entry.compatibilityMode === "native-esm").length,
    classicGlobalCompatibilityModuleCount: Number.isFinite(Number(contract.classicGlobalCompatibilityModuleCount))
      ? Number(contract.classicGlobalCompatibilityModuleCount)
      : modules.filter((entry) => entry.compatibilityMode !== "native-esm").length,
    expectedFunctionCount: Number.isFinite(Number(contract.expectedFunctionCount))
      ? Number(contract.expectedFunctionCount)
      : modules.reduce((total, entry) => total + entry.expectedFunctions.length, 0),
    hashCount: Number.isFinite(Number(contract.hashCount))
      ? Number(contract.hashCount)
      : modules.filter((entry) => entry.sha256).length,
    byteCount: Number.isFinite(Number(contract.byteCount))
      ? Number(contract.byteCount)
      : modules.reduce((total, entry) => total + entry.bytes, 0),
    modules,
  };
}

function jsonScriptBody(value) {
  return JSON.stringify(value || {}, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function buildViteShellPublicReadback(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const buildRoot = path.resolve(options.buildRoot || path.join(root, "dist", "frontend-shell"));
  const manifestPath = path.join(buildRoot, "codex-mobile-shell-manifest.json");
  const manifest = readJson(manifestPath);
  const viteBuild = manifest.viteBuild || {};
  const issues = [];

  if (!viteBuild.validation || !viteBuild.validation.ok) {
    issues.push({ code: "vite_build_contract_invalid" });
  }
  if (viteBuild.productionExecution !== "vite-app-preview-native-esm") {
    issues.push({ code: "vite_build_execution_not_native_esm" });
  }
  if (!viteBuild.viteEntry || viteBuild.viteEntry.source !== "frontend/vite-shell-entry.mjs") {
    issues.push({ code: "vite_shell_entry_missing" });
  }
  if (!(viteBuild.viteDeferredChunks || []).some((chunk) => chunk && chunk.source === "frontend/vite-deferred-entry-topology.mjs")) {
    issues.push({ code: "vite_deferred_entry_topology_missing" });
  }
  const startupContracts = startupGlobalContracts(viteBuild);
  if (!startupContracts.length) {
    issues.push({ code: "vite_startup_global_contract_missing" });
  }

  const files = requiredArtifactFiles(manifest);
  const publishedFiles = [];
  for (const fileName of files) {
    try {
      publishedFiles.push(fileRecord(buildRoot, fileName));
    } catch (_) {
      issues.push({ code: "vite_artifact_file_missing", fileName });
    }
  }

  const preview = {
    fileName: VITE_SHELL_PUBLIC_PREVIEW_FILE,
    entryScript: publicArtifactUrl(VITE_SHELL_PUBLIC_APP_PREVIEW_ENTRY_FILE),
    targetEntryScript: viteBuild.viteEntry ? publicArtifactUrl(viteBuild.viteEntry.fileName) : "",
  };
  const appPreview = {
    fileName: VITE_SHELL_PUBLIC_APP_PREVIEW_FILE,
    entryScript: preview.entryScript,
    targetEntryScript: preview.targetEntryScript,
    sourceShell: "public/index.html",
  };
  const stableEntry = {
    fileName: VITE_SHELL_PUBLIC_APP_PREVIEW_ENTRY_FILE,
    entryScript: publicArtifactUrl(VITE_SHELL_PUBLIC_APP_PREVIEW_ENTRY_FILE),
    targetEntryFileName: normalizeRelativeFileName(viteBuild.viteEntry && viteBuild.viteEntry.fileName),
    targetEntryScript: viteBuild.viteEntry ? publicArtifactUrl(viteBuild.viteEntry.fileName) : "",
  };
  const entryGroupChunks = (viteBuild.viteEntryGroupChunks || []).map((chunk) => ({
    groupId: String(chunk && chunk.groupId || ""),
    phase: String(chunk && chunk.phase || ""),
    startupCritical: Boolean(chunk && chunk.startupCritical),
    chunkTarget: String(chunk && chunk.chunkTarget || ""),
    source: String(chunk && chunk.source || ""),
    fileName: normalizeRelativeFileName(chunk && chunk.fileName),
    entryScript: publicArtifactUrl(chunk && chunk.fileName),
    assetCount: Number.isFinite(Number(chunk && chunk.assetCount)) ? Number(chunk.assetCount) : 0,
    classicAssetRecords: (Array.isArray(chunk && chunk.classicAssetRecords) ? chunk.classicAssetRecords : [])
      .map((entry) => ({
        path: String(entry && entry.path || ""),
        sourcePath: String(entry && entry.sourcePath || ""),
        bytes: Number.isFinite(Number(entry && entry.bytes)) ? Number(entry.bytes) : 0,
        sha256: String(entry && entry.sha256 || ""),
      }))
      .filter((entry) => entry.path && entry.sha256),
    classicAssetHashCount: Number.isFinite(Number(chunk && chunk.classicAssetHashCount))
      ? Number(chunk.classicAssetHashCount)
      : 0,
    classicAssetBytes: Number.isFinite(Number(chunk && chunk.classicAssetBytes))
      ? Number(chunk.classicAssetBytes)
      : 0,
    classicGlobalExportAssetCount: Number.isFinite(Number(chunk && chunk.classicGlobalExportAssetCount))
      ? Number(chunk.classicGlobalExportAssetCount)
      : 0,
    classicGlobalExportCount: Number.isFinite(Number(chunk && chunk.classicGlobalExportCount))
      ? Number(chunk.classicGlobalExportCount)
      : 0,
  })).filter((chunk) => chunk.fileName);
  const esmCompatibilityChunks = (viteBuild.viteEsmCompatibilityChunks || []).map((chunk) => ({
    source: String(chunk && chunk.source || ""),
    fileName: normalizeRelativeFileName(chunk && chunk.fileName),
    entryScript: publicArtifactUrl(chunk && chunk.fileName),
  })).filter((chunk) => chunk.fileName);
  const sharedChunks = (viteBuild.viteSharedChunks || []).map((chunk) => ({
    name: String(chunk && chunk.name || ""),
    source: String(chunk && chunk.source || ""),
    fileName: normalizeRelativeFileName(chunk && chunk.fileName),
    entryScript: publicArtifactUrl(chunk && chunk.fileName),
  })).filter((chunk) => chunk.fileName);
  const viteOwnedAppBootstrapChunks = (viteBuild.viteOwnedAppBootstrapChunks || []).map((chunk) => ({
    source: String(chunk && chunk.source || ""),
    fileName: normalizeRelativeFileName(chunk && chunk.fileName),
    entryScript: publicArtifactUrl(chunk && chunk.fileName),
  })).filter((chunk) => chunk.fileName);
  const startupAssets = startupCriticalAssets(manifest);
  const classicShellScriptBlock = classicShellScriptBlockContract(manifest, viteBuild);
  const appPreviewClassicLoaderPlan = normalizeAppPreviewClassicLoaderPlan(viteBuild.appPreviewClassicLoaderPlan);
  const esmCompatibility = normalizeEsmCompatibilityContract(viteBuild.esmCompatibility);
  if (!appPreviewClassicLoaderPlan) {
    issues.push({ code: "vite_app_preview_classic_loader_plan_missing" });
  } else {
    const scriptAssets = scriptAssetsFromManifest(manifest);
    const loaderPaths = appPreviewClassicLoaderPlan.scripts.map((entry) => entry.path);
    const excludedPaths = appPreviewClassicLoaderPlan.excludedEsmScripts.map((entry) => entry.path);
    const excludedViteOwnedPaths = appPreviewClassicLoaderPlan.excludedViteOwnedScripts.map((entry) => entry.path);
    const coveredPaths = new Set([...loaderPaths, ...excludedPaths, ...excludedViteOwnedPaths]);
    const reconstructedPaths = scriptAssets.filter((asset) => coveredPaths.has(asset));
    if (appPreviewClassicLoaderPlan.owner !== "vite-shell-entry") {
      issues.push({ code: "vite_app_preview_classic_loader_plan_owner_mismatch" });
    }
    if (JSON.stringify(reconstructedPaths) !== JSON.stringify(scriptAssets)
      || coveredPaths.size !== scriptAssets.length) {
      issues.push({ code: "vite_app_preview_classic_loader_plan_order_mismatch" });
    }
    if (Number(appPreviewClassicLoaderPlan.sourceScriptCount) !== scriptAssets.length
      || Number(appPreviewClassicLoaderPlan.scriptCount) !== loaderPaths.length
      || Number(appPreviewClassicLoaderPlan.hashCount) !== loaderPaths.length
      || Number(appPreviewClassicLoaderPlan.excludedEsmScriptCount) !== excludedPaths.length
      || Number(appPreviewClassicLoaderPlan.excludedEsmHashCount) !== excludedPaths.length
      || Number(appPreviewClassicLoaderPlan.excludedViteOwnedScriptCount) !== excludedViteOwnedPaths.length
      || Number(appPreviewClassicLoaderPlan.excludedViteOwnedHashCount) !== excludedViteOwnedPaths.length) {
      issues.push({ code: "vite_app_preview_classic_loader_plan_count_mismatch" });
    }
    if (appPreviewClassicLoaderPlan.excludedEsmScripts.some((entry) => !entry.esmModuleId || !entry.globalName || !entry.sha256 || !Number(entry.bytes))) {
      issues.push({ code: "vite_app_preview_classic_loader_plan_exclusion_record_missing" });
    }
    if (appPreviewClassicLoaderPlan.excludedViteOwnedScripts.some((entry) => !entry.ownerId || !entry.globalName || !entry.sha256 || !Number(entry.bytes))) {
      issues.push({ code: "vite_app_preview_classic_loader_plan_vite_owned_record_missing" });
    }
    if (!appPreviewClassicLoaderPlan.sha256) {
      issues.push({ code: "vite_app_preview_classic_loader_plan_hash_missing" });
    }
  }
  if (!esmCompatibility || !esmCompatibility.modules.length) {
    issues.push({ code: "vite_esm_compatibility_contract_missing" });
  } else {
    if (esmCompatibility.owner !== "vite-shell-entry"
      || esmCompatibility.virtualModuleSource !== "virtual:codex-mobile-esm-compatibility") {
      issues.push({ code: "vite_esm_compatibility_owner_mismatch" });
    }
    if (Number(esmCompatibility.moduleCount) !== esmCompatibility.modules.length
      || Number(esmCompatibility.nativeEsmModuleCount) !== esmCompatibility.modules.filter((entry) => entry.compatibilityMode === "native-esm").length
      || Number(esmCompatibility.classicGlobalCompatibilityModuleCount) !== esmCompatibility.modules.filter((entry) => entry.compatibilityMode !== "native-esm").length
      || Number(esmCompatibility.hashCount) !== esmCompatibility.modules.length
      || Number(esmCompatibility.expectedFunctionCount) !== esmCompatibility.modules.reduce((total, entry) => (
        total + entry.expectedFunctions.length
      ), 0)) {
      issues.push({ code: "vite_esm_compatibility_count_mismatch" });
    }
    if (esmCompatibility.modules.some((entry) => (
      !entry.source
        || !entry.assetPath
        || !entry.globalName
        || entry.classicLoaderExcluded !== true
        || !entry.sha256
        || !Number(entry.bytes)
    ))) {
      issues.push({ code: "vite_esm_compatibility_module_record_missing" });
    }
  }
  const startupGlobalNames = startupContracts.map((entry) => entry.name);
  const startupGlobalAssets = [...new Set(startupContracts.map((entry) => entry.asset).filter(Boolean))];
  const readbackForPreview = {
    stage: VITE_SHELL_PUBLIC_ARTIFACT_STAGE,
    sourceBuildStage: viteBuild.stage || "",
    productionExecution: viteBuild.productionExecution || "",
    entryGroupImportOwner: viteBuild.entryGroupImportOwner || "",
    entryDynamicImportGraph: viteBuild.entryDynamicImportGraph || null,
    shellCacheName: String(manifest.shellCacheName || ""),
    clientBuildId: String(manifest.clientBuildId || ""),
    entry: viteBuild.viteEntry ? {
      source: viteBuild.viteEntry.source || "",
      fileName: normalizeRelativeFileName(viteBuild.viteEntry.fileName),
    } : null,
    esmCompatibilityChunks,
    sharedChunks,
    viteOwnedAppBootstrapChunks,
    entryGroupChunks,
    stableEntry,
    preview,
    startupCriticalAssets: startupAssets,
    startupGlobalContracts: startupContracts,
    classicShellScriptBlock,
    appPreviewClassicLoaderPlan,
    esmCompatibility,
  };
  const stableEntrySource = renderViteShellStableEntry(readbackForPreview);
  const stableEntryRecord = bufferRecord(VITE_SHELL_PUBLIC_APP_PREVIEW_ENTRY_FILE, stableEntrySource);
  if (stableEntryRecord) publishedFiles.push(stableEntryRecord);
  const previewHtml = renderViteShellPreviewHtml(readbackForPreview);
  const previewRecord = bufferRecord(VITE_SHELL_PUBLIC_PREVIEW_FILE, previewHtml);
  if (previewRecord) publishedFiles.push(previewRecord);
  const appPreviewHtml = renderViteShellAppPreviewHtml(readbackForPreview, root);
  const appPreviewRecord = bufferRecord(VITE_SHELL_PUBLIC_APP_PREVIEW_FILE, appPreviewHtml);
  if (appPreviewRecord) publishedFiles.push(appPreviewRecord);

  return {
    schemaVersion: 1,
    generatedBy: "codex-mobile-vite-shell-artifact-publisher",
    stage: VITE_SHELL_PUBLIC_ARTIFACT_STAGE,
    sourceBuildStage: viteBuild.stage || "",
    productionExecution: viteBuild.productionExecution || "",
    entryGroupImportOwner: viteBuild.entryGroupImportOwner || "",
    entryDynamicImportGraph: viteBuild.entryDynamicImportGraph || null,
    shellCacheName: String(manifest.shellCacheName || ""),
    clientBuildId: String(manifest.clientBuildId || ""),
    entry: viteBuild.viteEntry ? {
      source: viteBuild.viteEntry.source || "",
      fileName: normalizeRelativeFileName(viteBuild.viteEntry.fileName),
    } : null,
    deferredChunks: (viteBuild.viteDeferredChunks || []).map((chunk) => ({
      source: String(chunk && chunk.source || ""),
      fileName: normalizeRelativeFileName(chunk && chunk.fileName),
    })).filter((chunk) => chunk.fileName),
    esmCompatibilityChunks,
    sharedChunks,
    viteOwnedAppBootstrapChunks,
    entryGroupChunks,
    stableEntry,
    preview,
    appPreview,
    startupCriticalAssets: startupAssets,
    startupGlobalContracts: startupContracts,
    classicShellScriptBlock,
    appPreviewClassicLoaderPlan,
    esmCompatibility,
    counts: {
      entryGroups: Array.isArray(manifest.entryGroups) ? manifest.entryGroups.length : 0,
      esmCompatibilityChunks: esmCompatibilityChunks.length,
      sharedChunks: sharedChunks.length,
      viteOwnedAppBootstrapChunks: viteOwnedAppBootstrapChunks.length,
      entryGroupChunks: entryGroupChunks.length,
      startupCriticalAssets: startupAssets.length,
      classicShellScriptBlockScripts: classicShellScriptBlock.scriptCount,
      appPreviewClassicLoaderScripts: appPreviewClassicLoaderPlan ? appPreviewClassicLoaderPlan.scriptCount : 0,
      appPreviewClassicLoaderHashes: appPreviewClassicLoaderPlan ? appPreviewClassicLoaderPlan.hashCount : 0,
      appPreviewClassicLoaderBytes: appPreviewClassicLoaderPlan ? appPreviewClassicLoaderPlan.byteCount : 0,
      appPreviewClassicLoaderExcludedEsmScripts: appPreviewClassicLoaderPlan ? appPreviewClassicLoaderPlan.excludedEsmScriptCount : 0,
      appPreviewClassicLoaderExcludedViteOwnedScripts: appPreviewClassicLoaderPlan ? appPreviewClassicLoaderPlan.excludedViteOwnedScriptCount : 0,
      esmCompatibilityModules: esmCompatibility ? esmCompatibility.moduleCount : 0,
      esmCompatibilityNativeModules: esmCompatibility ? esmCompatibility.nativeEsmModuleCount : 0,
      esmCompatibilityClassicGlobalModules: esmCompatibility ? esmCompatibility.classicGlobalCompatibilityModuleCount : 0,
      esmCompatibilityHashes: esmCompatibility ? esmCompatibility.hashCount : 0,
      esmCompatibilityExpectedFunctions: esmCompatibility ? esmCompatibility.expectedFunctionCount : 0,
      startupGlobalContracts: startupContracts.length,
      startupGlobalContractAssets: startupGlobalAssets.length,
      startupGlobalContractHashes: startupContracts.filter((entry) => entry.sha256).length,
      startupGlobalContractBytes: startupContracts.reduce((total, entry) => total + (Number(entry.bytes) || 0), 0),
      classicAssetHashes: entryGroupChunks.reduce((total, chunk) => (
        total + (Number(chunk && chunk.classicAssetHashCount) || 0)
      ), 0),
      startupGlobalNames: startupGlobalNames.length,
      classicGlobalExportAssets: Array.isArray(manifest.classicGlobalExports) ? manifest.classicGlobalExports.length : 0,
      classicGlobalExports: Array.isArray(manifest.classicGlobalExports)
        ? manifest.classicGlobalExports.reduce((total, entry) => (
          total + (Array.isArray(entry && entry.globals) ? entry.globals.length : 0)
        ), 0)
        : 0,
      publishedFiles: publishedFiles.length,
    },
    publishedFiles,
    validation: {
      ok: issues.length === 0,
      issues,
    },
  };
}

export function renderViteShellPreviewHtml(readback = {}) {
  const entryFileName = normalizeRelativeFileName(readback.entry && readback.entry.fileName);
  const entryScript = readback.preview && readback.preview.entryScript
    ? String(readback.preview.entryScript)
    : publicArtifactUrl(entryFileName);
  const targetEntryScript = readback.preview && readback.preview.targetEntryScript
    ? String(readback.preview.targetEntryScript)
    : publicArtifactUrl(entryFileName);
  const targetEntryPreloadTags = targetEntryScript && targetEntryScript !== entryScript
    ? [`  <link rel=\"modulepreload\" href=\"${escapeHtml(targetEntryScript)}\" data-codex-vite-stable-entry-target=\"true\">`]
    : [];
  const startupPreloadTags = (Array.isArray(readback.startupCriticalAssets) ? readback.startupCriticalAssets : [])
    .filter((asset) => String(asset || "").startsWith("/"))
    .map((asset) => `  <link rel=\"preload\" as=\"script\" href=\"${escapeHtml(asset)}\" data-codex-vite-startup-asset=\"true\">`);
  const entryGroupPreloadTags = (Array.isArray(readback.entryGroupChunks) ? readback.entryGroupChunks : [])
    .map((chunk) => chunk && chunk.entryScript)
    .filter((asset) => String(asset || "").startsWith("/"))
    .map((asset) => `  <link rel=\"modulepreload\" href=\"${escapeHtml(asset)}\" data-codex-vite-entry-group-chunk=\"true\">`);
  const esmCompatibilityPreloadTags = (Array.isArray(readback.esmCompatibilityChunks) ? readback.esmCompatibilityChunks : [])
    .map((chunk) => chunk && chunk.entryScript)
    .filter((asset) => String(asset || "").startsWith("/"))
    .map((asset) => `  <link rel=\"modulepreload\" href=\"${escapeHtml(asset)}\" data-codex-vite-esm-compatibility-chunk=\"true\">`);
  const sharedPreloadTags = (Array.isArray(readback.sharedChunks) ? readback.sharedChunks : [])
    .map((chunk) => chunk && chunk.entryScript)
    .filter((asset) => String(asset || "").startsWith("/"))
    .map((asset) => `  <link rel=\"modulepreload\" href=\"${escapeHtml(asset)}\" data-codex-vite-shared-chunk=\"true\">`);
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\">",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    "  <meta name=\"robots\" content=\"noindex,nofollow\">",
    ...startupPreloadTags,
    ...sharedPreloadTags,
    ...esmCompatibilityPreloadTags,
    ...targetEntryPreloadTags,
    ...entryGroupPreloadTags,
    "  <title>Codex Mobile Vite Shell Preview</title>",
    "</head>",
    "<body>",
    "  <main",
    "    id=\"codex-vite-shell-preview\"",
    `    data-stage=\"${escapeHtml(readback.stage)}\"`,
    `    data-source-build-stage=\"${escapeHtml(readback.sourceBuildStage)}\"`,
    `    data-production-execution=\"${escapeHtml(readback.productionExecution)}\"`,
    `    data-client-build-id=\"${escapeHtml(readback.clientBuildId)}\"`,
    `    data-shell-cache-name=\"${escapeHtml(readback.shellCacheName)}\"`,
    `    data-entry-group-import-owner=\"${escapeHtml(readback.entryGroupImportOwner)}\"`,
    `    data-startup-critical-asset-count=\"${escapeHtml((readback.startupCriticalAssets || []).length)}\"`,
    `    data-entry-group-chunk-count=\"${escapeHtml((readback.entryGroupChunks || []).length)}\"`,
    `    data-startup-global-contract-count=\"${escapeHtml((readback.startupGlobalContracts || []).length)}\"`,
    `    data-classic-shell-script-count=\"${escapeHtml(readback.classicShellScriptBlock && readback.classicShellScriptBlock.scriptCount)}\"`,
    `    data-classic-shell-script-block-sha256=\"${escapeHtml(readback.classicShellScriptBlock && readback.classicShellScriptBlock.sha256)}\"`,
    `    data-app-preview-classic-loader-count=\"${escapeHtml(readback.appPreviewClassicLoaderPlan && readback.appPreviewClassicLoaderPlan.scriptCount)}\"`,
    `    data-app-preview-classic-loader-sha256=\"${escapeHtml(readback.appPreviewClassicLoaderPlan && readback.appPreviewClassicLoaderPlan.sha256)}\"`,
    `    data-esm-compatibility-module-count=\"${escapeHtml(readback.esmCompatibility && readback.esmCompatibility.moduleCount)}\"`,
    "  >",
    "    <h1>Codex Mobile Vite Shell Preview</h1>",
    "  </main>",
    `  <script type=\"module\" src=\"${escapeHtml(entryScript)}\"></script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

export function renderViteShellAppPreviewHtml(readback = {}, root = process.cwd()) {
  const entryFileName = normalizeRelativeFileName(readback.entry && readback.entry.fileName);
  const entryScript = readback.preview && readback.preview.entryScript
    ? String(readback.preview.entryScript)
    : publicArtifactUrl(entryFileName);
  const targetEntryScript = readback.preview && readback.preview.targetEntryScript
    ? String(readback.preview.targetEntryScript)
    : publicArtifactUrl(entryFileName);
  const targetEntryFileName = targetEntryScript.split("/").filter(Boolean).pop() || "entry";
  const entryScriptUrl = `${entryScript}${entryScript.includes("?") ? "&" : "?"}targetEntry=${encodeURIComponent(targetEntryFileName)}`;
  const indexPath = path.join(path.resolve(root), "public", "index.html");
  let source = fs.readFileSync(indexPath, "utf8");
  source = source.replace(
    /<html\b([^>]*)>/i,
    (match, attrs) => `<html${attrs} data-codex-vite-app-preview="true">`
  );
  source = source.replace(
    /<meta name="robots" content="noindex,nofollow">\n?/,
    ""
  );
  source = source.replace(
    /<head>/i,
    `<head>\n  <meta name="robots" content="noindex,nofollow">\n  <meta name="codex-vite-app-preview" content="vite-shell-app-preview-v1">`
  );
  const moduleBlock = [
    VITE_APP_PREVIEW_SCRIPT_BLOCK_START,
    ...(Array.isArray(readback.sharedChunks) ? readback.sharedChunks : [])
      .map((chunk) => chunk && chunk.entryScript)
      .filter((asset) => String(asset || "").startsWith("/"))
      .map((asset) => `  <link rel="modulepreload" href="${escapeHtml(asset)}" data-codex-vite-shared-chunk="true">`),
    ...(Array.isArray(readback.esmCompatibilityChunks) ? readback.esmCompatibilityChunks : [])
      .map((chunk) => chunk && chunk.entryScript)
      .filter((asset) => String(asset || "").startsWith("/"))
      .map((asset) => `  <link rel="modulepreload" href="${escapeHtml(asset)}" data-codex-vite-esm-compatibility-chunk="true">`),
    ...(targetEntryScript && targetEntryScript !== entryScript
      ? [`  <link rel="modulepreload" href="${escapeHtml(targetEntryScript)}" data-codex-vite-stable-entry-target="true">`]
      : []),
    "  <script id=\"codex-vite-app-preview-loader-plan\" type=\"application/json\" data-codex-vite-app-preview-loader-plan=\"true\">",
    jsonScriptBody(readback.appPreviewClassicLoaderPlan),
    "  </script>",
    `  <script type="module" src="${escapeHtml(entryScriptUrl)}" data-codex-vite-app-preview-entry="true"></script>`,
    VITE_APP_PREVIEW_SCRIPT_BLOCK_END,
  ].join("\n");
  const start = source.indexOf(CLASSIC_SHELL_SCRIPT_BLOCK_START);
  const end = source.indexOf(CLASSIC_SHELL_SCRIPT_BLOCK_END);
  if (start < 0 || end < start) {
    throw new Error("codex_mobile_vite_app_preview_classic_block_missing");
  }
  return `${source.slice(0, start)}${moduleBlock}${source.slice(end + CLASSIC_SHELL_SCRIPT_BLOCK_END.length)}`;
}

export function renderViteShellStableEntry(readback = {}) {
  const targetEntryScript = readback.stableEntry && readback.stableEntry.targetEntryScript
    ? String(readback.stableEntry.targetEntryScript)
    : "";
  if (!targetEntryScript || !targetEntryScript.startsWith("/")) {
    throw new Error("codex_mobile_vite_stable_entry_target_missing");
  }
  const targetEntryImportSpecifier = targetEntryScript.startsWith("/vite-shell/assets/")
    ? `./assets/${targetEntryScript.slice("/vite-shell/assets/".length)}`
    : targetEntryScript;
  return [
    `const targetEntryImportSpecifier = ${JSON.stringify(targetEntryImportSpecifier)};`,
    "const targetEntryImportUrl = new URL(targetEntryImportSpecifier, import.meta.url);",
    "try {",
    "  const sourceUrl = new URL(import.meta.url);",
    "  sourceUrl.searchParams.forEach((value, key) => {",
    "    if (!targetEntryImportUrl.searchParams.has(key)) targetEntryImportUrl.searchParams.set(key, value);",
    "  });",
    "} catch (_) {}",
    "const targetEntryImportPromise = import(targetEntryImportUrl.href);",
    "",
    "globalThis.__CODEX_MOBILE_VITE_STABLE_ENTRY__ = {",
    "  source: \"vite-shell-app-preview-stable-entry\",",
    `  targetEntryScript: ${JSON.stringify(targetEntryScript)},`,
    "  targetEntryImportSpecifier,",
    "  targetEntryImportUrl: targetEntryImportUrl.href,",
    "  targetEntryImportPromise,",
    "  loadedAt: Date.now(),",
    "};",
    "targetEntryImportPromise.catch((err) => {",
    "  globalThis.__CODEX_MOBILE_VITE_STABLE_ENTRY__.error = err && err.message ? err.message : String(err);",
    "  throw err;",
    "});",
    "",
  ].join("\n");
}

function copyArtifactFile(sourceRoot, targetRoot, fileName) {
  const relativePath = normalizeRelativeFileName(fileName);
  if (!relativePath) throw new Error("invalid_artifact_file_name");
  const sourcePath = path.join(sourceRoot, relativePath);
  const targetPath = path.join(targetRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function removeNonAssetArtifactFiles(publicArtifactRoot) {
  if (!fs.existsSync(publicArtifactRoot)) return;
  for (const entry of fs.readdirSync(publicArtifactRoot, { withFileTypes: true })) {
    if (entry.name === "assets") continue;
    fs.rmSync(path.join(publicArtifactRoot, entry.name), { recursive: true, force: true });
  }
}

function listRetainedArtifactFiles(publicArtifactRoot, currentFiles) {
  const assetsRoot = path.join(publicArtifactRoot, "assets");
  if (!fs.existsSync(assetsRoot)) return [];
  const current = new Set((currentFiles || []).map(normalizeRelativeFileName).filter(Boolean));
  const retained = [];
  const walk = (dir, prefix = "assets") => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fileName = `${prefix}/${entry.name}`;
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath, fileName);
        continue;
      }
      const normalized = normalizeRelativeFileName(fileName);
      if (!normalized || current.has(normalized)) continue;
      try {
        retained.push(fileRecord(publicArtifactRoot, normalized));
      } catch (_) {
        // Best-effort metadata only; retained compatibility files are not part of the required artifact.
      }
    }
  };
  walk(assetsRoot);
  return retained
    .filter(Boolean)
    .sort((left, right) => String(left.fileName).localeCompare(String(right.fileName)));
}

export function publishViteShellPublicArtifact(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const buildRoot = path.resolve(options.buildRoot || path.join(root, "dist", "frontend-shell"));
  const publicArtifactRoot = path.resolve(options.publicArtifactRoot || path.join(root, VITE_SHELL_PUBLIC_ARTIFACT_ROOT));
  const readback = buildViteShellPublicReadback({ root, buildRoot });
  if (!readback.validation.ok) {
    const codes = readback.validation.issues.map((issue) => issue.code).join(", ");
    throw new Error(`codex_mobile_vite_shell_public_artifact_invalid: ${codes}`);
  }
  fs.mkdirSync(publicArtifactRoot, { recursive: true });
  removeNonAssetArtifactFiles(publicArtifactRoot);
  for (const file of readback.publishedFiles) {
    if (file.fileName === VITE_SHELL_PUBLIC_PREVIEW_FILE) continue;
    if (file.fileName === VITE_SHELL_PUBLIC_APP_PREVIEW_FILE) continue;
    if (file.fileName === VITE_SHELL_PUBLIC_APP_PREVIEW_ENTRY_FILE) continue;
    copyArtifactFile(buildRoot, publicArtifactRoot, file.fileName);
  }
  fs.writeFileSync(
    path.join(publicArtifactRoot, VITE_SHELL_PUBLIC_APP_PREVIEW_ENTRY_FILE),
    renderViteShellStableEntry(readback)
  );
  fs.writeFileSync(
    path.join(publicArtifactRoot, VITE_SHELL_PUBLIC_PREVIEW_FILE),
    renderViteShellPreviewHtml(readback)
  );
  fs.writeFileSync(
    path.join(publicArtifactRoot, VITE_SHELL_PUBLIC_APP_PREVIEW_FILE),
    renderViteShellAppPreviewHtml(readback, root)
  );
  const currentFileNames = readback.publishedFiles.map((file) => file && file.fileName).filter(Boolean);
  readback.retainedArtifactFiles = listRetainedArtifactFiles(publicArtifactRoot, currentFileNames);
  readback.counts.retainedArtifactFiles = readback.retainedArtifactFiles.length;
  fs.writeFileSync(
    path.join(publicArtifactRoot, VITE_SHELL_PUBLIC_READBACK_FILE),
    `${JSON.stringify(readback, null, 2)}\n`
  );
  return readback;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = publishViteShellPublicArtifact();
    console.log(JSON.stringify({
      ok: true,
      stage: result.stage,
      sourceBuildStage: result.sourceBuildStage,
      productionExecution: result.productionExecution,
      entryGroupImportOwner: result.entryGroupImportOwner,
      entryDynamicImports: result.entryDynamicImportGraph
        && Array.isArray(result.entryDynamicImportGraph.actualFiles)
        ? result.entryDynamicImportGraph.actualFiles.length
        : 0,
      shellCacheName: result.shellCacheName,
      clientBuildId: result.clientBuildId,
      esmCompatibilityChunks: result.counts.esmCompatibilityChunks,
      entryGroupChunks: result.counts.entryGroupChunks,
      startupCriticalAssets: result.counts.startupCriticalAssets,
      esmCompatibilityModules: result.counts.esmCompatibilityModules,
      publishedFiles: result.counts.publishedFiles,
      retainedArtifactFiles: result.counts.retainedArtifactFiles || 0,
    }));
  } catch (err) {
    console.error(err && err.message ? err.message : String(err));
    process.exitCode = 1;
  }
}
