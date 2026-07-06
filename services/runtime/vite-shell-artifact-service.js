"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_PUBLIC_ARTIFACT_ROOT = "public/vite-shell";
const DEFAULT_READBACK_FILE = "vite-shell-readback.json";
const DEFAULT_PREVIEW_FILE = "preview.html";
const DEFAULT_APP_PREVIEW_FILE = "app-preview.html";
const DEFAULT_APP_PREVIEW_ENTRY_FILE = "app-preview-entry.js";
const EXPECTED_PUBLIC_ARTIFACT_STAGE = "vite-shell-preview-html-v1";
const EXPECTED_SOURCE_BUILD_STAGE = "vite-shell-artifact-contract-v1";
const EXPECTED_ENTRY_GROUP_IMPORT_OWNER = "vite-shell-entry";
const CLASSIC_SHELL_SCRIPT_BLOCK_START = "<!-- CODEX_MOBILE_SHELL_SCRIPTS:BEGIN -->";
const CLASSIC_SHELL_SCRIPT_BLOCK_END = "<!-- CODEX_MOBILE_SHELL_SCRIPTS:END -->";
const VITE_APP_PREVIEW_SCRIPT_BLOCK_START = "<!-- CODEX_MOBILE_VITE_APP_PREVIEW:BEGIN -->";

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function normalizeRelativeFileName(value) {
  const text = String(value || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!text || path.isAbsolute(text) || text.split("/").includes("..")) return "";
  return text;
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_) {
    return null;
  }
}

function safeReadText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (_) {
    return "";
  }
}

function extractExternalScriptSrcs(source) {
  const values = [];
  const pattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi;
  let match;
  while ((match = pattern.exec(String(source || "")))) {
    const src = String(match[1] || "").trim();
    if (src && src.startsWith("/")) values.push(src);
  }
  return values;
}

function compactIssueCodes(issues) {
  return Array.from(new Set((issues || []).map((issue) => issue && issue.code).filter(Boolean)));
}

function arraysEqual(left, right) {
  return JSON.stringify(Array.isArray(left) ? left : []) === JSON.stringify(Array.isArray(right) ? right : []);
}

function canonicalShellTopology(manifest) {
  const source = manifest && typeof manifest === "object" ? manifest : {};
  return {
    indexScriptAssets: Array.isArray(source.indexScriptAssets) ? source.indexScriptAssets : source.scriptAssets,
    swStaticAssets: Array.isArray(source.swStaticAssets) ? source.swStaticAssets : source.precacheAssets,
    pageShellAssets: source.pageShellAssets,
    hashAssets: Array.isArray(source.serverHashAssets) ? source.serverHashAssets : source.hashAssets,
    entryGroups: source.entryGroups,
    classicGlobalExports: source.classicGlobalExports,
    startupGlobalContracts: source.startupGlobalContracts,
  };
}

function hasComparableTopology(manifest) {
  const topology = canonicalShellTopology(manifest);
  return Array.isArray(topology.indexScriptAssets) && topology.indexScriptAssets.length > 0;
}

function manifestTopologyMatches(left, right) {
  if (!left || !right) return false;
  const leftTopology = canonicalShellTopology(left);
  const rightTopology = canonicalShellTopology(right);
  for (const key of ["indexScriptAssets", "swStaticAssets", "pageShellAssets", "hashAssets", "entryGroups", "classicGlobalExports", "startupGlobalContracts"]) {
    if (!arraysEqual(leftTopology[key], rightTopology[key])) return false;
  }
  return true;
}

function startupCriticalAssetCount(manifest) {
  const assets = [];
  const groups = canonicalShellTopology(manifest).entryGroups;
  for (const group of Array.isArray(groups) ? groups : []) {
    if (!group || !group.startupCritical) continue;
    for (const asset of Array.isArray(group.assets) ? group.assets : []) {
      const text = String(asset || "").trim();
      if (text && text.startsWith("/")) assets.push(text);
    }
  }
  return new Set(assets).size;
}

function entryGroupIds(manifest) {
  return (Array.isArray(canonicalShellTopology(manifest).entryGroups)
    ? canonicalShellTopology(manifest).entryGroups
    : [])
    .map((group) => String(group && group.id || "").trim())
    .filter(Boolean);
}

function entryGroupCoverageById(manifest) {
  const topology = canonicalShellTopology(manifest);
  const classicExports = Array.isArray(topology.classicGlobalExports) ? topology.classicGlobalExports : [];
  const coverage = new Map();
  for (const group of Array.isArray(topology.entryGroups) ? topology.entryGroups : []) {
    const id = String(group && group.id || "").trim();
    if (!id) continue;
    const assets = Array.isArray(group.assets) ? group.assets : [];
    const assetSet = new Set(assets);
    const exportEntries = classicExports.filter((entry) => assetSet.has(entry && entry.asset));
    coverage.set(id, {
      assetCount: assets.length,
      classicGlobalExportAssetCount: exportEntries.length,
      classicGlobalExportCount: exportEntries.reduce((total, entry) => (
        total + (Array.isArray(entry && entry.globals) ? entry.globals.length : 0)
      ), 0),
    });
  }
  return coverage;
}

function startupGlobalContracts(manifest) {
  return (Array.isArray(manifest && manifest.startupGlobalContracts) ? manifest.startupGlobalContracts : [])
    .map((entry) => ({
      name: String(entry && entry.name || ""),
      asset: String(entry && entry.asset || ""),
      groupId: String(entry && entry.groupId || ""),
      startupCritical: Boolean(entry && entry.startupCritical),
      source: String(entry && entry.source || "startup-window-guard"),
    }))
    .filter((entry) => entry.name);
}

function appPreviewClassicLoaderPlan(source) {
  const plan = source && source.appPreviewClassicLoaderPlan;
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
    source: String(plan.source || ""),
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

function esmCompatibilityContract(source) {
  const contract = source && source.esmCompatibility;
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
      importSource: String(entry && (entry.importSource || entry.source) || ""),
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
    source: String(contract.source || ""),
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

function assetRecordsByPath(manifest) {
  const records = new Map();
  for (const entry of Array.isArray(manifest && manifest.assets) ? manifest.assets : []) {
    const assetPath = String(entry && entry.path || "").trim();
    if (!assetPath) continue;
    records.set(assetPath, {
      path: assetPath,
      sourcePath: String(entry && entry.sourcePath || ""),
      bytes: Number.isFinite(Number(entry && entry.bytes)) ? Number(entry.bytes) : 0,
      sha256: String(entry && entry.sha256 || ""),
    });
  }
  return records;
}

function publicAssetStatus(appRoot, assetPath) {
  const text = String(assetPath || "").trim();
  if (!text || !text.startsWith("/")) {
    return { path: text, exists: false, code: "classic_asset_path_invalid" };
  }
  const relative = text.replace(/^\/+/, "");
  if (!relative || relative.split("/").includes("..")) {
    return { path: text, exists: false, code: "classic_asset_path_invalid" };
  }
  const target = path.resolve(appRoot, "public", relative);
  const publicRoot = path.resolve(appRoot, "public");
  if (target !== publicRoot && !target.startsWith(`${publicRoot}${path.sep}`)) {
    return { path: text, exists: false, code: "classic_asset_path_invalid" };
  }
  try {
    const stat = fs.statSync(target);
    if (!stat.isFile()) {
      return { path: text, exists: false, code: "classic_asset_not_file" };
    }
    const buffer = fs.readFileSync(target);
    return {
      path: text,
      exists: true,
      bytes: buffer.length,
      sha256: sha256Hex(buffer),
    };
  } catch (_) {
    return { path: text, exists: false, code: "classic_asset_missing" };
  }
}

function publicAssetPathFromSource(sourcePath) {
  const text = String(sourcePath || "").trim().replace(/\\/g, "/");
  if (!text.startsWith("public/")) return "";
  const relative = text.slice("public".length);
  return relative.startsWith("/") ? relative : `/${relative}`;
}

function readClassicShellScriptBlock(appRoot) {
  const indexHtml = safeReadText(path.join(appRoot, "public", "index.html"));
  const startIndex = indexHtml.indexOf(CLASSIC_SHELL_SCRIPT_BLOCK_START);
  const endIndex = indexHtml.indexOf(CLASSIC_SHELL_SCRIPT_BLOCK_END);
  if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
    return {
      exists: false,
      scriptAssets: [],
      scriptCount: 0,
      firstScript: "",
      lastScript: "",
      sha256: "",
    };
  }
  const block = indexHtml.slice(startIndex, endIndex + CLASSIC_SHELL_SCRIPT_BLOCK_END.length);
  const scriptAssets = extractExternalScriptSrcs(block);
  return {
    exists: true,
    scriptAssets,
    scriptCount: scriptAssets.length,
    firstScript: scriptAssets[0] || "",
    lastScript: scriptAssets.length ? scriptAssets[scriptAssets.length - 1] : "",
    sha256: sha256Hex(Buffer.from(block, "utf8")),
  };
}

function createViteShellArtifactService(dependencies = {}) {
  const appRoot = path.resolve(dependencies.appRoot || process.cwd());
  const publicArtifactRoot = path.resolve(
    dependencies.publicArtifactRoot || path.join(appRoot, DEFAULT_PUBLIC_ARTIFACT_ROOT)
  );
  const readShellAssetManifest = typeof dependencies.readShellAssetManifest === "function"
    ? dependencies.readShellAssetManifest
    : () => null;
  const readbackFileName = normalizeRelativeFileName(dependencies.readbackFileName || DEFAULT_READBACK_FILE)
    || DEFAULT_READBACK_FILE;
  const previewFileName = normalizeRelativeFileName(dependencies.previewFileName || DEFAULT_PREVIEW_FILE)
    || DEFAULT_PREVIEW_FILE;
  const appPreviewFileName = normalizeRelativeFileName(dependencies.appPreviewFileName || DEFAULT_APP_PREVIEW_FILE)
    || DEFAULT_APP_PREVIEW_FILE;

  function publicArtifactUrl(fileName) {
    const relativePath = normalizeRelativeFileName(fileName);
    if (!relativePath) return "";
    return `/${DEFAULT_PUBLIC_ARTIFACT_ROOT.replace(/^public\//, "")}/${relativePath}`;
  }

  function publicArtifactPath(fileName) {
    const relativePath = normalizeRelativeFileName(fileName);
    if (!relativePath) return "";
    const target = path.resolve(publicArtifactRoot, relativePath);
    if (target !== publicArtifactRoot && !target.startsWith(`${publicArtifactRoot}${path.sep}`)) return "";
    return target;
  }

  function publicFileStatus(fileName) {
    const relativePath = normalizeRelativeFileName(fileName);
    const target = publicArtifactPath(relativePath);
    if (!relativePath || !target) {
      return { fileName: relativePath, exists: false, code: "vite_artifact_file_invalid" };
    }
    try {
      const stat = fs.statSync(target);
      if (!stat.isFile()) {
        return { fileName: relativePath, exists: false, code: "vite_artifact_file_not_file" };
      }
      const buffer = fs.readFileSync(target);
      return {
        fileName: relativePath,
        exists: true,
        bytes: buffer.length,
        sha256: sha256Hex(buffer),
      };
    } catch (_) {
      return { fileName: relativePath, exists: false, code: "vite_artifact_file_missing" };
    }
  }

  function readPublicArtifactStatus() {
    const issues = [];
    const publicShellManifest = readShellAssetManifest() || {};
    const readbackPath = publicArtifactPath(readbackFileName);
    const readback = readbackPath ? safeReadJson(readbackPath) : null;
    if (!readback) {
      issues.push({ code: "vite_shell_artifact_readback_missing" });
      return {
        ok: false,
        available: false,
        stage: EXPECTED_PUBLIC_ARTIFACT_STAGE,
        sourceBuildStage: EXPECTED_SOURCE_BUILD_STAGE,
        productionExecution: "vite-app-preview-native-esm",
        artifactRoot: DEFAULT_PUBLIC_ARTIFACT_ROOT,
        issueCodes: compactIssueCodes(issues),
        validation: { ok: false, issues },
      };
    }

    if (readback.stage !== EXPECTED_PUBLIC_ARTIFACT_STAGE) {
      issues.push({ code: "vite_shell_artifact_stage_mismatch" });
    }
    if (readback.sourceBuildStage !== EXPECTED_SOURCE_BUILD_STAGE) {
      issues.push({ code: "vite_shell_source_build_stage_mismatch" });
    }
    if (readback.productionExecution !== "vite-app-preview-native-esm") {
      issues.push({ code: "vite_shell_artifact_not_native_esm" });
    }
    if (publicShellManifest.shellCacheName && readback.shellCacheName !== publicShellManifest.shellCacheName) {
      issues.push({ code: "vite_shell_artifact_cache_mismatch" });
    }
    if (publicShellManifest.clientBuildId && readback.clientBuildId !== publicShellManifest.clientBuildId) {
      issues.push({ code: "vite_shell_artifact_client_build_mismatch" });
    }
    if (!readback.entry || readback.entry.source !== "frontend/vite-shell-entry.mjs") {
      issues.push({ code: "vite_shell_artifact_entry_missing" });
    }
    if (!(readback.deferredChunks || []).some((chunk) => chunk && chunk.source === "frontend/vite-deferred-entry-topology.mjs")) {
      issues.push({ code: "vite_shell_artifact_deferred_missing" });
    }
    const readbackEntryGroupChunks = Array.isArray(readback.entryGroupChunks) ? readback.entryGroupChunks : [];
    const readbackStartupGlobalContracts = startupGlobalContracts(readback);
    if (!readbackStartupGlobalContracts.length) {
      issues.push({ code: "vite_shell_startup_global_contract_missing" });
    }
    const readbackClassicScriptBlock = readback.classicShellScriptBlock
      && typeof readback.classicShellScriptBlock === "object"
      ? readback.classicShellScriptBlock
      : null;
    const readbackAppPreviewClassicLoaderPlan = appPreviewClassicLoaderPlan(readback);
    const readbackEsmCompatibility = esmCompatibilityContract(readback);
    const actualClassicScriptBlock = readClassicShellScriptBlock(appRoot);
    if (!readbackClassicScriptBlock) {
      issues.push({ code: "vite_shell_classic_script_block_missing" });
    } else {
      if (!actualClassicScriptBlock.exists) {
        issues.push({ code: "vite_shell_classic_script_block_markers_missing" });
      }
      if (actualClassicScriptBlock.exists
        && String(readbackClassicScriptBlock.sha256 || "") !== actualClassicScriptBlock.sha256) {
        issues.push({ code: "vite_shell_classic_script_block_hash_mismatch" });
      }
      if (actualClassicScriptBlock.exists
        && Number(readbackClassicScriptBlock.scriptCount) !== actualClassicScriptBlock.scriptCount) {
        issues.push({ code: "vite_shell_classic_script_block_count_mismatch" });
      }
      if (actualClassicScriptBlock.exists
        && (String(readbackClassicScriptBlock.firstScript || "") !== actualClassicScriptBlock.firstScript
          || String(readbackClassicScriptBlock.lastScript || "") !== actualClassicScriptBlock.lastScript)) {
        issues.push({ code: "vite_shell_classic_script_block_boundary_mismatch" });
      }
    }
    const publicIndexScripts = canonicalShellTopology(publicShellManifest).indexScriptAssets;
    if (actualClassicScriptBlock.exists
      && Array.isArray(publicIndexScripts)
      && !arraysEqual(actualClassicScriptBlock.scriptAssets, publicIndexScripts)) {
      issues.push({ code: "vite_shell_classic_script_block_manifest_mismatch" });
    }
    if (!readbackAppPreviewClassicLoaderPlan) {
      issues.push({ code: "vite_shell_app_preview_classic_loader_plan_missing" });
    } else {
      const loaderPlanPaths = readbackAppPreviewClassicLoaderPlan.scripts.map((entry) => entry.path);
      const excludedEsmPaths = readbackAppPreviewClassicLoaderPlan.excludedEsmScripts.map((entry) => entry.path);
      const excludedViteOwnedPaths = readbackAppPreviewClassicLoaderPlan.excludedViteOwnedScripts.map((entry) => entry.path);
      const coveredPaths = new Set([...loaderPlanPaths, ...excludedEsmPaths, ...excludedViteOwnedPaths]);
      const sourceScriptAssets = actualClassicScriptBlock.scriptAssets;
      const reconstructedPaths = sourceScriptAssets.filter((asset) => coveredPaths.has(asset));
      if (readbackAppPreviewClassicLoaderPlan.owner !== EXPECTED_ENTRY_GROUP_IMPORT_OWNER) {
        issues.push({ code: "vite_shell_app_preview_classic_loader_plan_owner_mismatch" });
      }
      if (actualClassicScriptBlock.exists
        && (!arraysEqual(reconstructedPaths, sourceScriptAssets)
          || coveredPaths.size !== sourceScriptAssets.length)) {
        issues.push({ code: "vite_shell_app_preview_classic_loader_plan_order_mismatch" });
      }
      if (Number(readbackAppPreviewClassicLoaderPlan.sourceScriptCount) !== sourceScriptAssets.length
        || Number(readbackAppPreviewClassicLoaderPlan.scriptCount) !== loaderPlanPaths.length
        || Number(readbackAppPreviewClassicLoaderPlan.hashCount) !== loaderPlanPaths.length
        || Number(readbackAppPreviewClassicLoaderPlan.excludedEsmScriptCount) !== excludedEsmPaths.length
        || Number(readbackAppPreviewClassicLoaderPlan.excludedEsmHashCount) !== excludedEsmPaths.length
        || Number(readbackAppPreviewClassicLoaderPlan.excludedViteOwnedScriptCount) !== excludedViteOwnedPaths.length
        || Number(readbackAppPreviewClassicLoaderPlan.excludedViteOwnedHashCount) !== excludedViteOwnedPaths.length
        || !readbackAppPreviewClassicLoaderPlan.sha256) {
        issues.push({ code: "vite_shell_app_preview_classic_loader_plan_count_mismatch" });
      }
      if (readbackAppPreviewClassicLoaderPlan.excludedEsmScripts.some((entry) => !entry.esmModuleId || !entry.globalName || !entry.sha256 || !Number(entry.bytes))) {
        issues.push({ code: "vite_shell_app_preview_classic_loader_plan_exclusion_record_missing" });
      }
      if (readbackAppPreviewClassicLoaderPlan.excludedViteOwnedScripts.some((entry) => !entry.ownerId || !entry.globalName || !entry.sha256 || !Number(entry.bytes))) {
        issues.push({ code: "vite_shell_app_preview_classic_loader_plan_vite_owned_record_missing" });
      }
    }
    const entryGroupImportOwner = String(readback.entryGroupImportOwner || "");
    if (readbackEntryGroupChunks.length && entryGroupImportOwner !== EXPECTED_ENTRY_GROUP_IMPORT_OWNER) {
      issues.push({ code: "vite_shell_entry_group_import_owner_mismatch" });
    }
    if (!readbackEsmCompatibility || !readbackEsmCompatibility.modules.length) {
      issues.push({ code: "vite_shell_esm_compatibility_contract_missing" });
    } else {
      if (readbackEsmCompatibility.owner !== EXPECTED_ENTRY_GROUP_IMPORT_OWNER
        || readbackEsmCompatibility.virtualModuleSource !== "virtual:codex-mobile-esm-compatibility") {
        issues.push({ code: "vite_shell_esm_compatibility_owner_mismatch" });
      }
      if (Number(readbackEsmCompatibility.moduleCount) !== readbackEsmCompatibility.modules.length
        || Number(readbackEsmCompatibility.hashCount) !== readbackEsmCompatibility.modules.length
        || Number(readbackEsmCompatibility.expectedFunctionCount) !== readbackEsmCompatibility.modules.reduce((total, entry) => (
          total + entry.expectedFunctions.length
        ), 0)) {
        issues.push({ code: "vite_shell_esm_compatibility_count_mismatch" });
      }
      if (readbackEsmCompatibility.modules.some((entry) => (
        !entry.source
          || !entry.assetPath
          || !entry.globalName
          || entry.classicLoaderExcluded !== true
          || !entry.sha256
          || !Number(entry.bytes)
      ))) {
        issues.push({ code: "vite_shell_esm_compatibility_module_record_missing" });
      }
      const shardSources = Array.isArray(readbackEsmCompatibility.shards)
        ? readbackEsmCompatibility.shards.map((entry) => String(entry && entry.source || "")).filter(Boolean)
        : [];
      const chunkSources = (Array.isArray(readback.esmCompatibilityChunks) ? readback.esmCompatibilityChunks : [])
        .map((entry) => String(entry && entry.source || ""))
        .filter((source) => source.includes("/shard/"));
      if (Number(readbackEsmCompatibility.shardCount) !== shardSources.length
        || !shardSources.length
        || JSON.stringify(shardSources.slice().sort()) !== JSON.stringify(chunkSources.slice().sort())) {
        issues.push({ code: "vite_shell_esm_compatibility_shard_chunk_mismatch" });
      }
    }
    const entryDynamicImportGraph = readback.entryDynamicImportGraph && typeof readback.entryDynamicImportGraph === "object"
      ? readback.entryDynamicImportGraph
      : null;
    if (!entryDynamicImportGraph || entryDynamicImportGraph.owner !== EXPECTED_ENTRY_GROUP_IMPORT_OWNER) {
      issues.push({ code: "vite_shell_entry_dynamic_import_graph_missing" });
    } else {
      if ((entryDynamicImportGraph.missingFiles || []).length) {
        issues.push({ code: "vite_shell_entry_dynamic_import_missing" });
      }
      if ((entryDynamicImportGraph.extraFiles || []).length) {
        issues.push({ code: "vite_shell_entry_dynamic_import_extra" });
      }
      if (Number(entryDynamicImportGraph.entryGroupFileCount) !== readbackEntryGroupChunks.length) {
        issues.push({ code: "vite_shell_entry_dynamic_import_entry_group_count_mismatch" });
      }
      if (Number(entryDynamicImportGraph.deferredFileCount) < 1) {
        issues.push({ code: "vite_shell_entry_dynamic_import_deferred_missing" });
      }
    }
    const preview = readback.preview && typeof readback.preview === "object" ? readback.preview : null;
    if (!preview || normalizeRelativeFileName(preview.fileName) !== previewFileName) {
      issues.push({ code: "vite_shell_preview_missing" });
    }
    const expectedEntryScript = publicArtifactUrl(readback.entry && readback.entry.fileName);
    const stableEntry = readback.stableEntry && typeof readback.stableEntry === "object" ? readback.stableEntry : null;
    const expectedStableEntryScript = publicArtifactUrl(DEFAULT_APP_PREVIEW_ENTRY_FILE);
    if (!stableEntry || normalizeRelativeFileName(stableEntry.fileName) !== DEFAULT_APP_PREVIEW_ENTRY_FILE) {
      issues.push({ code: "vite_shell_stable_entry_missing" });
    }
    if (!stableEntry || String(stableEntry.entryScript || "") !== expectedStableEntryScript) {
      issues.push({ code: "vite_shell_stable_entry_script_mismatch" });
    }
    if (!stableEntry || String(stableEntry.targetEntryScript || "") !== expectedEntryScript) {
      issues.push({ code: "vite_shell_stable_entry_target_mismatch" });
    }
    if (!preview || String(preview.entryScript || "") !== expectedStableEntryScript) {
      issues.push({ code: "vite_shell_preview_entry_mismatch" });
    }
    if (!preview || String(preview.targetEntryScript || "") !== expectedEntryScript) {
      issues.push({ code: "vite_shell_preview_target_entry_mismatch" });
    }
    const appPreview = readback.appPreview && typeof readback.appPreview === "object" ? readback.appPreview : null;
    if (!appPreview || normalizeRelativeFileName(appPreview.fileName) !== appPreviewFileName) {
      issues.push({ code: "vite_shell_app_preview_missing" });
    }
    if (!appPreview || String(appPreview.entryScript || "") !== expectedStableEntryScript) {
      issues.push({ code: "vite_shell_app_preview_entry_mismatch" });
    }
    if (!appPreview || String(appPreview.targetEntryScript || "") !== expectedEntryScript) {
      issues.push({ code: "vite_shell_app_preview_target_entry_mismatch" });
    }

    const files = [];
    for (const file of readback.publishedFiles || []) {
      const status = publicFileStatus(file && file.fileName);
      if (!status.exists) {
        issues.push({ code: status.code || "vite_artifact_file_missing", fileName: status.fileName });
      } else if (file.sha256 && file.sha256 !== status.sha256) {
        issues.push({ code: "vite_artifact_file_hash_mismatch", fileName: status.fileName });
      } else if (Number.isFinite(Number(file.bytes)) && Number(file.bytes) !== status.bytes) {
        issues.push({ code: "vite_artifact_file_size_mismatch", fileName: status.fileName });
      }
      files.push(status);
    }
    if (!files.length) {
      issues.push({ code: "vite_shell_artifact_files_missing" });
    }
    const expectedPublishedFiles = Array.from(new Set([
      "codex-mobile-shell-manifest.json",
      readback.entry && readback.entry.fileName,
      ...(entryDynamicImportGraph && Array.isArray(entryDynamicImportGraph.expectedFiles)
        ? entryDynamicImportGraph.expectedFiles
        : []),
      ...(readback.esmCompatibilityChunks || []).map((chunk) => chunk && chunk.fileName),
      ...(readback.deferredChunks || []).map((chunk) => chunk && chunk.fileName),
      ...readbackEntryGroupChunks.map((chunk) => chunk && chunk.fileName),
      ...(readback.viteOwnedAppBootstrapChunks || []).map((chunk) => chunk && chunk.fileName),
      ...(readback.sharedChunks || []).map((chunk) => chunk && chunk.fileName),
      stableEntry && stableEntry.fileName,
      previewFileName,
      appPreviewFileName,
    ].map(normalizeRelativeFileName).filter(Boolean)));
    const listedPublishedFiles = (readback.publishedFiles || [])
      .map((file) => normalizeRelativeFileName(file && file.fileName))
      .filter(Boolean)
      .sort();
    if (JSON.stringify(listedPublishedFiles) !== JSON.stringify(expectedPublishedFiles.slice().sort())) {
      issues.push({ code: "vite_shell_artifact_file_list_mismatch" });
    }
    const artifactManifestPath = publicArtifactPath("codex-mobile-shell-manifest.json");
    const artifactManifest = artifactManifestPath ? safeReadJson(artifactManifestPath) : null;
    if (!artifactManifest) {
      issues.push({ code: "vite_shell_artifact_manifest_missing" });
    } else {
      if (artifactManifest.shellCacheName !== readback.shellCacheName) {
        issues.push({ code: "vite_shell_artifact_manifest_cache_mismatch" });
      }
      if (artifactManifest.clientBuildId !== readback.clientBuildId) {
        issues.push({ code: "vite_shell_artifact_manifest_client_build_mismatch" });
      }
      if (publicShellManifest.shellCacheName && artifactManifest.shellCacheName !== publicShellManifest.shellCacheName) {
        issues.push({ code: "vite_shell_artifact_manifest_public_cache_mismatch" });
      }
      if (publicShellManifest.clientBuildId && artifactManifest.clientBuildId !== publicShellManifest.clientBuildId) {
        issues.push({ code: "vite_shell_artifact_manifest_public_client_build_mismatch" });
      }
      if (hasComparableTopology(publicShellManifest) && !manifestTopologyMatches(artifactManifest, publicShellManifest)) {
        issues.push({ code: "vite_shell_artifact_manifest_topology_mismatch" });
      }
      const expectedGroupIds = entryGroupIds(artifactManifest);
      const chunkGroupIds = readbackEntryGroupChunks
        .map((chunk) => String(chunk && chunk.groupId || "").trim())
        .filter(Boolean);
      const expectedCoverage = entryGroupCoverageById(artifactManifest);
      const artifactAssetRecords = assetRecordsByPath(artifactManifest);
      const expectedStartupGlobalContracts = startupGlobalContracts(artifactManifest);
      const artifactAppPreviewClassicLoaderPlan = appPreviewClassicLoaderPlan(artifactManifest.viteBuild || {});
      const artifactEsmCompatibility = esmCompatibilityContract(artifactManifest.viteBuild || {});
      if (!artifactAppPreviewClassicLoaderPlan) {
        issues.push({ code: "vite_shell_artifact_app_preview_classic_loader_plan_missing" });
      } else if (JSON.stringify(readbackAppPreviewClassicLoaderPlan) !== JSON.stringify(artifactAppPreviewClassicLoaderPlan)) {
        issues.push({ code: "vite_shell_app_preview_classic_loader_plan_manifest_mismatch" });
      }
      if (!artifactEsmCompatibility || !artifactEsmCompatibility.modules.length) {
        issues.push({ code: "vite_shell_artifact_esm_compatibility_contract_missing" });
      } else if (JSON.stringify(readbackEsmCompatibility) !== JSON.stringify(artifactEsmCompatibility)) {
        issues.push({ code: "vite_shell_esm_compatibility_contract_manifest_mismatch" });
      }
      if (readbackEsmCompatibility) {
        for (const record of readbackEsmCompatibility.modules) {
          const assetPath = publicAssetPathFromSource(record.source);
          if (record.assetPath !== assetPath) {
            issues.push({ code: "vite_shell_esm_compatibility_module_asset_path_mismatch", moduleId: record.id });
            break;
          }
          const currentAsset = publicAssetStatus(appRoot, assetPath);
          if (!assetPath || !currentAsset.exists) {
            issues.push({ code: currentAsset.code || "vite_shell_esm_compatibility_module_missing", moduleId: record.id });
            break;
          }
          if (currentAsset.sha256 !== String(record && record.sha256 || "")) {
            issues.push({ code: "vite_shell_esm_compatibility_module_file_hash_mismatch", moduleId: record.id });
            break;
          }
          if (Number(currentAsset.bytes) !== Number(record && record.bytes)) {
            issues.push({ code: "vite_shell_esm_compatibility_module_file_size_mismatch", moduleId: record.id });
            break;
          }
        }
      }
      if (readbackAppPreviewClassicLoaderPlan) {
        const loaderRecords = [
          ...readbackAppPreviewClassicLoaderPlan.scripts,
          ...readbackAppPreviewClassicLoaderPlan.excludedEsmScripts,
          ...readbackAppPreviewClassicLoaderPlan.excludedViteOwnedScripts,
        ];
        for (const record of loaderRecords) {
          const assetPath = String(record && record.path || "");
          const artifactRecord = artifactAssetRecords.get(assetPath);
          if (!artifactRecord || artifactRecord.sha256 !== String(record && record.sha256 || "")) {
            issues.push({ code: "vite_shell_app_preview_classic_loader_plan_hash_mismatch", asset: assetPath });
            break;
          }
          if (Number(artifactRecord.bytes) !== Number(record && record.bytes)) {
            issues.push({ code: "vite_shell_app_preview_classic_loader_plan_size_mismatch", asset: assetPath });
            break;
          }
          const currentAsset = publicAssetStatus(appRoot, assetPath);
          if (!currentAsset.exists) {
            issues.push({ code: currentAsset.code || "vite_shell_app_preview_classic_loader_plan_asset_missing", asset: assetPath });
            break;
          }
          if (currentAsset.sha256 !== String(record && record.sha256 || "")) {
            issues.push({ code: "vite_shell_app_preview_classic_loader_plan_file_hash_mismatch", asset: assetPath });
            break;
          }
          if (Number(currentAsset.bytes) !== Number(record && record.bytes)) {
            issues.push({ code: "vite_shell_app_preview_classic_loader_plan_file_size_mismatch", asset: assetPath });
            break;
          }
        }
      }
      if (JSON.stringify(readbackStartupGlobalContracts) !== JSON.stringify(expectedStartupGlobalContracts)) {
        issues.push({ code: "vite_shell_startup_global_contract_mismatch" });
      }
      const artifactClassicGlobalExports = Array.isArray(canonicalShellTopology(artifactManifest).classicGlobalExports)
        ? canonicalShellTopology(artifactManifest).classicGlobalExports
        : [];
      const artifactAssetByGlobal = new Map();
      for (const entry of artifactClassicGlobalExports) {
        for (const name of Array.isArray(entry && entry.globals) ? entry.globals : []) {
          artifactAssetByGlobal.set(String(name || ""), String(entry && entry.asset || ""));
        }
      }
      for (const entry of readbackStartupGlobalContracts) {
        const expectedAsset = artifactAssetByGlobal.get(entry.name) || "";
        if (!entry.asset || expectedAsset !== entry.asset) {
          issues.push({ code: "vite_shell_startup_global_export_mismatch", global: entry.name });
          break;
        }
        const artifactRecord = artifactAssetRecords.get(entry.asset);
        if (!artifactRecord || !artifactRecord.sha256) {
          issues.push({ code: "vite_shell_startup_global_asset_hash_missing", global: entry.name });
          break;
        }
        const currentAsset = publicAssetStatus(appRoot, entry.asset);
        if (!currentAsset.exists) {
          issues.push({ code: currentAsset.code || "vite_shell_startup_global_asset_missing", global: entry.name });
          break;
        }
        if (currentAsset.sha256 !== artifactRecord.sha256) {
          issues.push({ code: "vite_shell_startup_global_asset_hash_mismatch", global: entry.name });
          break;
        }
        if (Number(currentAsset.bytes) !== Number(artifactRecord.bytes)) {
          issues.push({ code: "vite_shell_startup_global_asset_size_mismatch", global: entry.name });
          break;
        }
      }
      for (const groupId of expectedGroupIds) {
        if (!chunkGroupIds.includes(groupId)) {
          issues.push({ code: "vite_shell_artifact_entry_group_chunk_missing", groupId });
        }
      }
      for (const chunk of readbackEntryGroupChunks) {
        const groupId = String(chunk && chunk.groupId || "").trim();
        const coverage = expectedCoverage.get(groupId);
        if (!coverage) continue;
        if (Number(chunk.assetCount) !== coverage.assetCount
          || Number(chunk.classicGlobalExportAssetCount) !== coverage.classicGlobalExportAssetCount
          || Number(chunk.classicGlobalExportCount) !== coverage.classicGlobalExportCount) {
          issues.push({ code: "vite_shell_artifact_entry_group_coverage_mismatch", groupId });
          break;
        }
        const chunkAssetRecords = Array.isArray(chunk.classicAssetRecords) ? chunk.classicAssetRecords : [];
        if (Number(chunk.classicAssetHashCount) !== coverage.assetCount
          || chunkAssetRecords.length !== coverage.assetCount) {
          issues.push({ code: "vite_shell_artifact_entry_group_classic_asset_hash_count_mismatch", groupId });
          break;
        }
        for (const record of chunkAssetRecords) {
          const assetPath = String(record && record.path || "");
          const artifactRecord = artifactAssetRecords.get(assetPath);
          if (!artifactRecord || artifactRecord.sha256 !== String(record && record.sha256 || "")) {
            issues.push({ code: "vite_shell_artifact_entry_group_classic_asset_hash_mismatch", groupId });
            break;
          }
          if (Number(artifactRecord.bytes) !== Number(record && record.bytes)) {
            issues.push({ code: "vite_shell_artifact_entry_group_classic_asset_size_mismatch", groupId });
            break;
          }
          const currentAsset = publicAssetStatus(appRoot, assetPath);
          if (!currentAsset.exists) {
            issues.push({ code: currentAsset.code || "classic_asset_missing", groupId });
            break;
          }
          if (currentAsset.sha256 !== String(record && record.sha256 || "")) {
            issues.push({ code: "vite_shell_classic_asset_file_hash_mismatch", groupId });
            break;
          }
          if (Number(currentAsset.bytes) !== Number(record && record.bytes)) {
            issues.push({ code: "vite_shell_classic_asset_file_size_mismatch", groupId });
            break;
          }
        }
        if (issues.some((issue) => String(issue && issue.code || "").includes("classic_asset"))) break;
      }
    }
    const previewPath = publicArtifactPath(previewFileName);
    const previewHtml = previewPath ? safeReadText(previewPath) : "";
    if (!previewHtml) {
      issues.push({ code: "vite_shell_preview_file_missing" });
    } else {
      if (!previewHtml.includes("id=\"codex-vite-shell-preview\"")) {
        issues.push({ code: "vite_shell_preview_marker_missing" });
      }
      if (!previewHtml.includes("type=\"module\"") || !expectedStableEntryScript || !previewHtml.includes(`src="${expectedStableEntryScript}"`)) {
        issues.push({ code: "vite_shell_preview_module_entry_missing" });
      }
      if (expectedEntryScript && !previewHtml.includes(`href="${expectedEntryScript}"`)) {
        issues.push({ code: "vite_shell_preview_module_entry_missing" });
      }
      if (!previewHtml.includes(`data-stage="${EXPECTED_PUBLIC_ARTIFACT_STAGE}"`)) {
        issues.push({ code: "vite_shell_preview_stage_mismatch" });
      }
      for (const chunk of readbackEntryGroupChunks) {
        const entryScript = String(chunk && chunk.entryScript || "");
        if (entryScript && !previewHtml.includes(`href="${entryScript}"`)) {
          issues.push({ code: "vite_shell_preview_entry_group_chunk_missing", groupId: chunk && chunk.groupId });
          break;
        }
      }
      if (readbackEntryGroupChunks.length
        && !previewHtml.includes(`data-entry-group-import-owner="${EXPECTED_ENTRY_GROUP_IMPORT_OWNER}"`)) {
        issues.push({ code: "vite_shell_preview_entry_group_import_owner_missing" });
      }
      if (readbackStartupGlobalContracts.length
        && !previewHtml.includes(`data-startup-global-contract-count="${readbackStartupGlobalContracts.length}"`)) {
        issues.push({ code: "vite_shell_preview_startup_global_contract_missing" });
      }
      if (readbackEsmCompatibility && readbackEsmCompatibility.modules.length
        && !previewHtml.includes(`data-esm-compatibility-module-count="${readbackEsmCompatibility.modules.length}"`)) {
        issues.push({ code: "vite_shell_preview_esm_compatibility_contract_missing" });
      }
    }
    const appPreviewPath = publicArtifactPath(appPreviewFileName);
    const appPreviewHtml = appPreviewPath ? safeReadText(appPreviewPath) : "";
    if (!appPreviewHtml) {
      issues.push({ code: "vite_shell_app_preview_file_missing" });
    } else {
      if (!appPreviewHtml.includes("data-codex-vite-app-preview=\"true\"")) {
        issues.push({ code: "vite_shell_app_preview_marker_missing" });
      }
      if (!appPreviewHtml.includes("name=\"codex-vite-app-preview\"")) {
        issues.push({ code: "vite_shell_app_preview_meta_missing" });
      }
      if (!appPreviewHtml.includes(VITE_APP_PREVIEW_SCRIPT_BLOCK_START)) {
        issues.push({ code: "vite_shell_app_preview_script_block_missing" });
      }
      if (!appPreviewHtml.includes("id=\"codex-vite-app-preview-loader-plan\"")
        || !appPreviewHtml.includes("data-codex-vite-app-preview-loader-plan=\"true\"")) {
        issues.push({ code: "vite_shell_app_preview_classic_loader_plan_script_missing" });
      }
      if (!appPreviewHtml.includes("type=\"module\"") || !expectedStableEntryScript || !appPreviewHtml.includes(`src="${expectedStableEntryScript}"`)) {
        issues.push({ code: "vite_shell_app_preview_module_entry_missing" });
      }
      if (expectedEntryScript && !appPreviewHtml.includes(`href="${expectedEntryScript}"`)) {
        issues.push({ code: "vite_shell_app_preview_module_entry_missing" });
      }
      if (appPreviewHtml.includes(CLASSIC_SHELL_SCRIPT_BLOCK_START)
        || appPreviewHtml.includes(CLASSIC_SHELL_SCRIPT_BLOCK_END)) {
        issues.push({ code: "vite_shell_app_preview_classic_block_present" });
      }
    }

    const loaderPlanScriptPaths = readbackAppPreviewClassicLoaderPlan
      ? readbackAppPreviewClassicLoaderPlan.scripts.map((entry) => entry.path)
      : [];
    const loaderPlanExcludedEsmPaths = readbackAppPreviewClassicLoaderPlan
      ? readbackAppPreviewClassicLoaderPlan.excludedEsmScripts.map((entry) => entry.path)
      : [];
    const loaderPlanExcludedViteOwnedPaths = readbackAppPreviewClassicLoaderPlan
      ? readbackAppPreviewClassicLoaderPlan.excludedViteOwnedScripts.map((entry) => entry.path)
      : [];
    const loaderPlanCoveredPaths = new Set([
      ...loaderPlanScriptPaths,
      ...loaderPlanExcludedEsmPaths,
      ...loaderPlanExcludedViteOwnedPaths,
    ]);
    const loaderPlanReconstructedSourcePaths = actualClassicScriptBlock.scriptAssets
      .filter((asset) => loaderPlanCoveredPaths.has(asset));
    const loaderPlanCurrentAssetsMatch = readbackAppPreviewClassicLoaderPlan
      ? [
          ...readbackAppPreviewClassicLoaderPlan.scripts,
          ...readbackAppPreviewClassicLoaderPlan.excludedEsmScripts,
          ...readbackAppPreviewClassicLoaderPlan.excludedViteOwnedScripts,
        ].every((entry) => {
          const currentAsset = publicAssetStatus(appRoot, entry.path);
          return currentAsset.exists
            && currentAsset.sha256 === entry.sha256
            && Number(currentAsset.bytes) === Number(entry.bytes);
        })
      : false;

    return {
      ok: issues.length === 0,
      available: issues.length === 0,
      stage: String(readback.stage || ""),
      sourceBuildStage: String(readback.sourceBuildStage || ""),
      productionExecution: String(readback.productionExecution || ""),
      entryGroupImportOwner: String(readback.entryGroupImportOwner || ""),
      entryDynamicImportGraph: entryDynamicImportGraph ? {
        owner: String(entryDynamicImportGraph.owner || ""),
        actualFileCount: Array.isArray(entryDynamicImportGraph.actualFiles)
          ? entryDynamicImportGraph.actualFiles.length
          : 0,
        expectedFileCount: Array.isArray(entryDynamicImportGraph.expectedFiles)
          ? entryDynamicImportGraph.expectedFiles.length
          : 0,
        missingFileCount: Array.isArray(entryDynamicImportGraph.missingFiles)
          ? entryDynamicImportGraph.missingFiles.length
          : 0,
        extraFileCount: Array.isArray(entryDynamicImportGraph.extraFiles)
          ? entryDynamicImportGraph.extraFiles.length
          : 0,
        esmCompatibilityFileCount: Number.isFinite(Number(entryDynamicImportGraph.esmCompatibilityFileCount))
          ? Number(entryDynamicImportGraph.esmCompatibilityFileCount)
          : 0,
        viteOwnedFileCount: Number.isFinite(Number(entryDynamicImportGraph.viteOwnedFileCount))
          ? Number(entryDynamicImportGraph.viteOwnedFileCount)
          : 0,
        deferredFileCount: Number.isFinite(Number(entryDynamicImportGraph.deferredFileCount))
          ? Number(entryDynamicImportGraph.deferredFileCount)
          : 0,
        entryGroupFileCount: Number.isFinite(Number(entryDynamicImportGraph.entryGroupFileCount))
          ? Number(entryDynamicImportGraph.entryGroupFileCount)
          : 0,
      } : null,
      artifactRoot: DEFAULT_PUBLIC_ARTIFACT_ROOT,
      shellCacheName: String(readback.shellCacheName || ""),
      clientBuildId: String(readback.clientBuildId || ""),
      classicShellScriptBlock: {
        match: Boolean(readbackClassicScriptBlock
          && actualClassicScriptBlock.exists
          && String(readbackClassicScriptBlock.sha256 || "") === actualClassicScriptBlock.sha256
          && Number(readbackClassicScriptBlock.scriptCount) === actualClassicScriptBlock.scriptCount
          && String(readbackClassicScriptBlock.firstScript || "") === actualClassicScriptBlock.firstScript
          && String(readbackClassicScriptBlock.lastScript || "") === actualClassicScriptBlock.lastScript),
        scriptCount: actualClassicScriptBlock.scriptCount,
        firstScript: actualClassicScriptBlock.firstScript,
        lastScript: actualClassicScriptBlock.lastScript,
        sha256: actualClassicScriptBlock.sha256,
        readbackSha256: readbackClassicScriptBlock ? String(readbackClassicScriptBlock.sha256 || "") : "",
      },
      classicShellManifestMatch: Boolean(artifactManifest
        && (!hasComparableTopology(publicShellManifest) || manifestTopologyMatches(artifactManifest, publicShellManifest))
        && artifactManifest.shellCacheName === readback.shellCacheName
        && artifactManifest.clientBuildId === readback.clientBuildId
        && (!publicShellManifest.shellCacheName || artifactManifest.shellCacheName === publicShellManifest.shellCacheName)
        && (!publicShellManifest.clientBuildId || artifactManifest.clientBuildId === publicShellManifest.clientBuildId)),
      startupCriticalAssetCount: artifactManifest ? startupCriticalAssetCount(artifactManifest) : 0,
      startupGlobalContract: {
        match: Boolean(artifactManifest
          && readbackStartupGlobalContracts.length > 0
          && JSON.stringify(readbackStartupGlobalContracts) === JSON.stringify(startupGlobalContracts(artifactManifest))),
        requiredGlobalCount: readbackStartupGlobalContracts.length,
        assetCount: new Set(readbackStartupGlobalContracts.map((entry) => entry.asset).filter(Boolean)).size,
        startupCriticalCount: readbackStartupGlobalContracts.filter((entry) => entry.startupCritical).length,
      },
      appPreviewClassicLoaderPlan: readbackAppPreviewClassicLoaderPlan ? {
        match: Boolean(actualClassicScriptBlock.exists
          && readbackAppPreviewClassicLoaderPlan.owner === EXPECTED_ENTRY_GROUP_IMPORT_OWNER
          && arraysEqual(loaderPlanReconstructedSourcePaths, actualClassicScriptBlock.scriptAssets)
          && loaderPlanCoveredPaths.size === actualClassicScriptBlock.scriptAssets.length
          && Number(readbackAppPreviewClassicLoaderPlan.sourceScriptCount) === actualClassicScriptBlock.scriptCount
          && Number(readbackAppPreviewClassicLoaderPlan.scriptCount) === loaderPlanScriptPaths.length
          && Number(readbackAppPreviewClassicLoaderPlan.hashCount) === loaderPlanScriptPaths.length
          && Number(readbackAppPreviewClassicLoaderPlan.excludedEsmScriptCount) === loaderPlanExcludedEsmPaths.length
          && Number(readbackAppPreviewClassicLoaderPlan.excludedEsmHashCount) === loaderPlanExcludedEsmPaths.length
          && Number(readbackAppPreviewClassicLoaderPlan.excludedViteOwnedScriptCount) === loaderPlanExcludedViteOwnedPaths.length
          && Number(readbackAppPreviewClassicLoaderPlan.excludedViteOwnedHashCount) === loaderPlanExcludedViteOwnedPaths.length
          && Boolean(readbackAppPreviewClassicLoaderPlan.sha256)
          && loaderPlanCurrentAssetsMatch),
        owner: readbackAppPreviewClassicLoaderPlan.owner,
        sourceScriptCount: readbackAppPreviewClassicLoaderPlan.sourceScriptCount,
        scriptCount: readbackAppPreviewClassicLoaderPlan.scriptCount,
        hashCount: readbackAppPreviewClassicLoaderPlan.hashCount,
        byteCount: readbackAppPreviewClassicLoaderPlan.byteCount,
        excludedEsmScriptCount: readbackAppPreviewClassicLoaderPlan.excludedEsmScriptCount,
        excludedEsmHashCount: readbackAppPreviewClassicLoaderPlan.excludedEsmHashCount,
        excludedEsmByteCount: readbackAppPreviewClassicLoaderPlan.excludedEsmByteCount,
        excludedEsmModuleIds: readbackAppPreviewClassicLoaderPlan.excludedEsmScripts.map((entry) => entry.esmModuleId),
        excludedViteOwnedScriptCount: readbackAppPreviewClassicLoaderPlan.excludedViteOwnedScriptCount,
        excludedViteOwnedHashCount: readbackAppPreviewClassicLoaderPlan.excludedViteOwnedHashCount,
        excludedViteOwnedByteCount: readbackAppPreviewClassicLoaderPlan.excludedViteOwnedByteCount,
        excludedViteOwnedOwnerIds: readbackAppPreviewClassicLoaderPlan.excludedViteOwnedScripts.map((entry) => entry.ownerId),
        firstScript: readbackAppPreviewClassicLoaderPlan.firstScript,
        lastScript: readbackAppPreviewClassicLoaderPlan.lastScript,
        sha256: readbackAppPreviewClassicLoaderPlan.sha256,
      } : {
        match: false,
        owner: "",
        sourceScriptCount: 0,
        scriptCount: 0,
        hashCount: 0,
        byteCount: 0,
        excludedEsmScriptCount: 0,
        excludedEsmHashCount: 0,
        excludedEsmByteCount: 0,
        excludedEsmModuleIds: [],
        excludedViteOwnedScriptCount: 0,
        excludedViteOwnedHashCount: 0,
        excludedViteOwnedByteCount: 0,
        excludedViteOwnedOwnerIds: [],
        firstScript: "",
        lastScript: "",
        sha256: "",
      },
      esmCompatibility: readbackEsmCompatibility ? {
        match: Boolean(readbackEsmCompatibility.owner === EXPECTED_ENTRY_GROUP_IMPORT_OWNER
          && readbackEsmCompatibility.virtualModuleSource === "virtual:codex-mobile-esm-compatibility"
          && Number(readbackEsmCompatibility.moduleCount) === readbackEsmCompatibility.modules.length
          && Number(readbackEsmCompatibility.nativeEsmModuleCount) === readbackEsmCompatibility.modules.filter((entry) => entry.compatibilityMode === "native-esm").length
          && Number(readbackEsmCompatibility.classicGlobalCompatibilityModuleCount) === readbackEsmCompatibility.modules.filter((entry) => entry.compatibilityMode !== "native-esm").length
          && Number(readbackEsmCompatibility.hashCount) === readbackEsmCompatibility.modules.length
          && readbackEsmCompatibility.modules.every((entry) => {
            const assetPath = publicAssetPathFromSource(entry.source);
            const currentAsset = publicAssetStatus(appRoot, assetPath);
            return currentAsset.exists
              && entry.assetPath === assetPath
              && entry.classicLoaderExcluded === true
              && currentAsset.sha256 === entry.sha256
              && Number(currentAsset.bytes) === Number(entry.bytes);
          })),
        owner: readbackEsmCompatibility.owner,
        moduleCount: readbackEsmCompatibility.moduleCount,
        nativeEsmModuleCount: readbackEsmCompatibility.nativeEsmModuleCount,
        classicGlobalCompatibilityModuleCount: readbackEsmCompatibility.classicGlobalCompatibilityModuleCount,
        shardCount: readbackEsmCompatibility.shardCount,
        expectedFunctionCount: readbackEsmCompatibility.expectedFunctionCount,
        hashCount: readbackEsmCompatibility.hashCount,
        byteCount: readbackEsmCompatibility.byteCount,
        moduleIds: readbackEsmCompatibility.modules.map((entry) => entry.id),
      } : {
        match: false,
        owner: "",
        moduleCount: 0,
        nativeEsmModuleCount: 0,
        classicGlobalCompatibilityModuleCount: 0,
        shardCount: 0,
        expectedFunctionCount: 0,
        hashCount: 0,
        byteCount: 0,
        moduleIds: [],
      },
      entryGroupChunkCount: readbackEntryGroupChunks.length,
      artifactManifest: artifactManifest ? {
        shellCacheName: String(artifactManifest.shellCacheName || ""),
        clientBuildId: String(artifactManifest.clientBuildId || ""),
        indexScriptCount: Array.isArray(canonicalShellTopology(artifactManifest).indexScriptAssets)
          ? canonicalShellTopology(artifactManifest).indexScriptAssets.length
          : 0,
        entryGroupCount: Array.isArray(canonicalShellTopology(artifactManifest).entryGroups)
          ? canonicalShellTopology(artifactManifest).entryGroups.length
          : 0,
        entryGroupChunkCount: readbackEntryGroupChunks.length,
        startupCriticalAssetCount: startupCriticalAssetCount(artifactManifest),
        classicGlobalExportAssetCount: Array.isArray(canonicalShellTopology(artifactManifest).classicGlobalExports)
          ? canonicalShellTopology(artifactManifest).classicGlobalExports.length
          : 0,
        classicGlobalExportCount: Array.isArray(canonicalShellTopology(artifactManifest).classicGlobalExports)
          ? canonicalShellTopology(artifactManifest).classicGlobalExports.reduce((total, entry) => (
            total + (Array.isArray(entry && entry.globals) ? entry.globals.length : 0)
          ), 0)
          : 0,
        startupGlobalContractCount: startupGlobalContracts(artifactManifest).length,
        esmCompatibilityModuleCount: artifactManifest.viteBuild
          && artifactManifest.viteBuild.esmCompatibility
          && Array.isArray(artifactManifest.viteBuild.esmCompatibility.modules)
          ? artifactManifest.viteBuild.esmCompatibility.modules.length
          : 0,
        pageShellAssetCount: Array.isArray(canonicalShellTopology(artifactManifest).pageShellAssets)
          ? canonicalShellTopology(artifactManifest).pageShellAssets.length
          : 0,
        hashAssetCount: Array.isArray(canonicalShellTopology(artifactManifest).hashAssets)
          ? canonicalShellTopology(artifactManifest).hashAssets.length
          : 0,
      } : null,
      entry: readback.entry || null,
      deferredChunkCount: (readback.deferredChunks || []).length,
      sharedChunkCount: (readback.sharedChunks || []).length,
      entryGroupChunks: readbackEntryGroupChunks.map((chunk) => ({
        groupId: String(chunk && chunk.groupId || ""),
        phase: String(chunk && chunk.phase || ""),
        startupCritical: Boolean(chunk && chunk.startupCritical),
        chunkTarget: String(chunk && chunk.chunkTarget || ""),
        fileName: normalizeRelativeFileName(chunk && chunk.fileName),
        entryScript: String(chunk && chunk.entryScript || ""),
        assetCount: Number.isFinite(Number(chunk && chunk.assetCount)) ? Number(chunk.assetCount) : 0,
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
      })).filter((chunk) => chunk.fileName),
      stableEntry: stableEntry ? {
        fileName: normalizeRelativeFileName(stableEntry.fileName),
        entryScript: String(stableEntry.entryScript || ""),
        targetEntryFileName: normalizeRelativeFileName(stableEntry.targetEntryFileName),
        targetEntryScript: String(stableEntry.targetEntryScript || ""),
      } : null,
      preview: preview ? {
        fileName: normalizeRelativeFileName(preview.fileName),
        entryScript: String(preview.entryScript || ""),
        targetEntryScript: String(preview.targetEntryScript || ""),
        entryGroupImportOwner: String(readback.entryGroupImportOwner || ""),
      } : null,
      appPreview: appPreview ? {
        fileName: normalizeRelativeFileName(appPreview.fileName),
        entryScript: String(appPreview.entryScript || ""),
        targetEntryScript: String(appPreview.targetEntryScript || ""),
        sourceShell: String(appPreview.sourceShell || ""),
      } : null,
      publishedFileCount: files.length,
      publishedFiles: files.map((file) => ({
        fileName: file.fileName,
        exists: Boolean(file.exists),
        bytes: file.bytes || 0,
        sha256: file.sha256 || "",
      })),
      issueCodes: compactIssueCodes(issues),
      validation: {
        ok: issues.length === 0,
        issues,
      },
    };
  }

  return {
    publicArtifactPath,
    publicFileStatus,
    readPublicArtifactStatus,
  };
}

module.exports = {
  EXPECTED_PUBLIC_ARTIFACT_STAGE,
  EXPECTED_SOURCE_BUILD_STAGE,
  EXPECTED_ENTRY_GROUP_IMPORT_OWNER,
  createViteShellArtifactService,
};
