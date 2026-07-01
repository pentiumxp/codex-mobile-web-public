"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_PUBLIC_ARTIFACT_ROOT = "public/vite-shell";
const DEFAULT_READBACK_FILE = "vite-shell-readback.json";
const DEFAULT_PREVIEW_FILE = "preview.html";
const EXPECTED_PUBLIC_ARTIFACT_STAGE = "vite-shell-preview-html-v1";
const EXPECTED_SOURCE_BUILD_STAGE = "vite-shell-artifact-contract-v1";
const EXPECTED_ENTRY_GROUP_IMPORT_OWNER = "vite-shell-entry";
const CLASSIC_SHELL_SCRIPT_BLOCK_START = "<!-- CODEX_MOBILE_SHELL_SCRIPTS:BEGIN -->";
const CLASSIC_SHELL_SCRIPT_BLOCK_END = "<!-- CODEX_MOBILE_SHELL_SCRIPTS:END -->";

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
        productionExecution: "classic-script-fallback",
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
    if (readback.productionExecution !== "classic-script-fallback") {
      issues.push({ code: "vite_shell_artifact_not_classic_fallback" });
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
    const entryGroupImportOwner = String(readback.entryGroupImportOwner || "");
    if (readbackEntryGroupChunks.length && entryGroupImportOwner !== EXPECTED_ENTRY_GROUP_IMPORT_OWNER) {
      issues.push({ code: "vite_shell_entry_group_import_owner_mismatch" });
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
    if (!preview || String(preview.entryScript || "") !== expectedEntryScript) {
      issues.push({ code: "vite_shell_preview_entry_mismatch" });
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
      ...(readback.deferredChunks || []).map((chunk) => chunk && chunk.fileName),
      ...readbackEntryGroupChunks.map((chunk) => chunk && chunk.fileName),
      previewFileName,
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
      if (!previewHtml.includes("type=\"module\"") || !expectedEntryScript || !previewHtml.includes(`src="${expectedEntryScript}"`)) {
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
    }

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
        pageShellAssetCount: Array.isArray(canonicalShellTopology(artifactManifest).pageShellAssets)
          ? canonicalShellTopology(artifactManifest).pageShellAssets.length
          : 0,
        hashAssetCount: Array.isArray(canonicalShellTopology(artifactManifest).hashAssets)
          ? canonicalShellTopology(artifactManifest).hashAssets.length
          : 0,
      } : null,
      entry: readback.entry || null,
      deferredChunkCount: (readback.deferredChunks || []).length,
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
      preview: preview ? {
        fileName: normalizeRelativeFileName(preview.fileName),
        entryScript: String(preview.entryScript || ""),
        entryGroupImportOwner: String(readback.entryGroupImportOwner || ""),
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
