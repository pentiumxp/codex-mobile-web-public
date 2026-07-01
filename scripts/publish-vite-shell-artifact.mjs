import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const VITE_SHELL_PUBLIC_ARTIFACT_STAGE = "vite-shell-public-preview-v1";
export const VITE_SHELL_PUBLIC_ARTIFACT_ROOT = "public/vite-shell";
export const VITE_SHELL_PUBLIC_READBACK_FILE = "vite-shell-readback.json";

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

function requiredArtifactFiles(manifest) {
  const viteBuild = manifest && manifest.viteBuild || {};
  const entryFile = viteBuild.viteEntry && viteBuild.viteEntry.fileName;
  const deferredFiles = (viteBuild.viteDeferredChunks || []).map((chunk) => chunk && chunk.fileName);
  return uniqueValues([
    "codex-mobile-shell-manifest.json",
    entryFile,
    ...deferredFiles,
  ]);
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
  if (viteBuild.productionExecution !== "classic-script-fallback") {
    issues.push({ code: "vite_build_execution_not_classic_fallback" });
  }
  if (!viteBuild.viteEntry || viteBuild.viteEntry.source !== "frontend/vite-shell-entry.mjs") {
    issues.push({ code: "vite_shell_entry_missing" });
  }
  if (!(viteBuild.viteDeferredChunks || []).some((chunk) => chunk && chunk.source === "frontend/vite-deferred-entry-topology.mjs")) {
    issues.push({ code: "vite_deferred_entry_topology_missing" });
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

  return {
    schemaVersion: 1,
    generatedBy: "codex-mobile-vite-shell-artifact-publisher",
    stage: VITE_SHELL_PUBLIC_ARTIFACT_STAGE,
    sourceBuildStage: viteBuild.stage || "",
    productionExecution: viteBuild.productionExecution || "",
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
    counts: {
      entryGroups: Array.isArray(manifest.entryGroups) ? manifest.entryGroups.length : 0,
      publishedFiles: publishedFiles.length,
    },
    publishedFiles,
    validation: {
      ok: issues.length === 0,
      issues,
    },
  };
}

function copyArtifactFile(sourceRoot, targetRoot, fileName) {
  const relativePath = normalizeRelativeFileName(fileName);
  if (!relativePath) throw new Error("invalid_artifact_file_name");
  const sourcePath = path.join(sourceRoot, relativePath);
  const targetPath = path.join(targetRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
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
  fs.rmSync(publicArtifactRoot, { recursive: true, force: true });
  fs.mkdirSync(publicArtifactRoot, { recursive: true });
  for (const file of readback.publishedFiles) {
    copyArtifactFile(buildRoot, publicArtifactRoot, file.fileName);
  }
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
      shellCacheName: result.shellCacheName,
      clientBuildId: result.clientBuildId,
      publishedFiles: result.counts.publishedFiles,
    }));
  } catch (err) {
    console.error(err && err.message ? err.message : String(err));
    process.exitCode = 1;
  }
}
