"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_PUBLIC_ARTIFACT_ROOT = "public/vite-shell";
const DEFAULT_READBACK_FILE = "vite-shell-readback.json";
const EXPECTED_PUBLIC_ARTIFACT_STAGE = "vite-shell-public-preview-v1";
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

function compactIssueCodes(issues) {
  return Array.from(new Set((issues || []).map((issue) => issue && issue.code).filter(Boolean)));
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

    return {
      ok: issues.length === 0,
      available: issues.length === 0,
      stage: String(readback.stage || ""),
      sourceBuildStage: String(readback.sourceBuildStage || ""),
      productionExecution: String(readback.productionExecution || ""),
      artifactRoot: DEFAULT_PUBLIC_ARTIFACT_ROOT,
      shellCacheName: String(readback.shellCacheName || ""),
      clientBuildId: String(readback.clientBuildId || ""),
      entry: readback.entry || null,
      deferredChunkCount: (readback.deferredChunks || []).length,
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
