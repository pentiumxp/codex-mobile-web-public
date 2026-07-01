"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_PUBLIC_ARTIFACT_ROOT = "public/vite-shell";
const DEFAULT_READBACK_FILE = "vite-shell-readback.json";
const DEFAULT_PREVIEW_FILE = "preview.html";
const EXPECTED_PUBLIC_ARTIFACT_STAGE = "vite-shell-preview-html-v1";
const EXPECTED_SOURCE_BUILD_STAGE = "vite-shell-artifact-contract-v1";

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
  for (const key of ["indexScriptAssets", "swStaticAssets", "pageShellAssets", "hashAssets", "entryGroups", "classicGlobalExports"]) {
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
    }

    return {
      ok: issues.length === 0,
      available: issues.length === 0,
      stage: String(readback.stage || ""),
      sourceBuildStage: String(readback.sourceBuildStage || ""),
      productionExecution: String(readback.productionExecution || ""),
      artifactRoot: DEFAULT_PUBLIC_ARTIFACT_ROOT,
      shellCacheName: String(readback.shellCacheName || ""),
      clientBuildId: String(readback.clientBuildId || ""),
      classicShellManifestMatch: Boolean(artifactManifest
        && (!hasComparableTopology(publicShellManifest) || manifestTopologyMatches(artifactManifest, publicShellManifest))
        && artifactManifest.shellCacheName === readback.shellCacheName
        && artifactManifest.clientBuildId === readback.clientBuildId
        && (!publicShellManifest.shellCacheName || artifactManifest.shellCacheName === publicShellManifest.shellCacheName)
        && (!publicShellManifest.clientBuildId || artifactManifest.clientBuildId === publicShellManifest.clientBuildId)),
      startupCriticalAssetCount: artifactManifest ? startupCriticalAssetCount(artifactManifest) : 0,
      artifactManifest: artifactManifest ? {
        shellCacheName: String(artifactManifest.shellCacheName || ""),
        clientBuildId: String(artifactManifest.clientBuildId || ""),
        indexScriptCount: Array.isArray(canonicalShellTopology(artifactManifest).indexScriptAssets)
          ? canonicalShellTopology(artifactManifest).indexScriptAssets.length
          : 0,
        entryGroupCount: Array.isArray(canonicalShellTopology(artifactManifest).entryGroups)
          ? canonicalShellTopology(artifactManifest).entryGroups.length
          : 0,
        startupCriticalAssetCount: startupCriticalAssetCount(artifactManifest),
        classicGlobalExportAssetCount: Array.isArray(canonicalShellTopology(artifactManifest).classicGlobalExports)
          ? canonicalShellTopology(artifactManifest).classicGlobalExports.length
          : 0,
        classicGlobalExportCount: Array.isArray(canonicalShellTopology(artifactManifest).classicGlobalExports)
          ? canonicalShellTopology(artifactManifest).classicGlobalExports.reduce((total, entry) => (
            total + (Array.isArray(entry && entry.globals) ? entry.globals.length : 0)
          ), 0)
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
      preview: preview ? {
        fileName: normalizeRelativeFileName(preview.fileName),
        entryScript: String(preview.entryScript || ""),
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
  createViteShellArtifactService,
};
