import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const VITE_SHELL_PUBLIC_ARTIFACT_STAGE = "vite-shell-preview-html-v1";
export const VITE_SHELL_PUBLIC_ARTIFACT_ROOT = "public/vite-shell";
export const VITE_SHELL_PUBLIC_READBACK_FILE = "vite-shell-readback.json";
export const VITE_SHELL_PUBLIC_PREVIEW_FILE = "preview.html";
export const VITE_SHELL_PUBLIC_APP_PREVIEW_FILE = "app-preview.html";
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
  const deferredFiles = (viteBuild.viteDeferredChunks || []).map((chunk) => chunk && chunk.fileName);
  const entryGroupFiles = (viteBuild.viteEntryGroupChunks || []).map((chunk) => chunk && chunk.fileName);
  return uniqueValues([
    "codex-mobile-shell-manifest.json",
    entryFile,
    ...deferredFiles,
    ...entryGroupFiles,
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
    entryScript: viteBuild.viteEntry ? publicArtifactUrl(viteBuild.viteEntry.fileName) : "",
  };
  const appPreview = {
    fileName: VITE_SHELL_PUBLIC_APP_PREVIEW_FILE,
    entryScript: preview.entryScript,
    sourceShell: "public/index.html",
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
  const startupAssets = startupCriticalAssets(manifest);
  const classicShellScriptBlock = classicShellScriptBlockContract(manifest, viteBuild);
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
    entryGroupChunks,
    preview,
    startupCriticalAssets: startupAssets,
    startupGlobalContracts: startupContracts,
    classicShellScriptBlock,
  };
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
    entryGroupChunks,
    preview,
    appPreview,
    startupCriticalAssets: startupAssets,
    startupGlobalContracts: startupContracts,
    classicShellScriptBlock,
    counts: {
      entryGroups: Array.isArray(manifest.entryGroups) ? manifest.entryGroups.length : 0,
      entryGroupChunks: entryGroupChunks.length,
      startupCriticalAssets: startupAssets.length,
      classicShellScriptBlockScripts: classicShellScriptBlock.scriptCount,
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
  const startupPreloadTags = (Array.isArray(readback.startupCriticalAssets) ? readback.startupCriticalAssets : [])
    .filter((asset) => String(asset || "").startsWith("/"))
    .map((asset) => `  <link rel=\"preload\" as=\"script\" href=\"${escapeHtml(asset)}\" data-codex-vite-startup-asset=\"true\">`);
  const entryGroupPreloadTags = (Array.isArray(readback.entryGroupChunks) ? readback.entryGroupChunks : [])
    .map((chunk) => chunk && chunk.entryScript)
    .filter((asset) => String(asset || "").startsWith("/"))
    .map((asset) => `  <link rel=\"modulepreload\" href=\"${escapeHtml(asset)}\" data-codex-vite-entry-group-chunk=\"true\">`);
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\">",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    "  <meta name=\"robots\" content=\"noindex,nofollow\">",
    ...startupPreloadTags,
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
    `  <script type="module" src="${escapeHtml(entryScript)}" data-codex-vite-app-preview-entry="true"></script>`,
    VITE_APP_PREVIEW_SCRIPT_BLOCK_END,
  ].join("\n");
  const start = source.indexOf(CLASSIC_SHELL_SCRIPT_BLOCK_START);
  const end = source.indexOf(CLASSIC_SHELL_SCRIPT_BLOCK_END);
  if (start < 0 || end < start) {
    throw new Error("codex_mobile_vite_app_preview_classic_block_missing");
  }
  return `${source.slice(0, start)}${moduleBlock}${source.slice(end + CLASSIC_SHELL_SCRIPT_BLOCK_END.length)}`;
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
    if (file.fileName === VITE_SHELL_PUBLIC_PREVIEW_FILE) continue;
    if (file.fileName === VITE_SHELL_PUBLIC_APP_PREVIEW_FILE) continue;
    copyArtifactFile(buildRoot, publicArtifactRoot, file.fileName);
  }
  fs.writeFileSync(
    path.join(publicArtifactRoot, VITE_SHELL_PUBLIC_PREVIEW_FILE),
    renderViteShellPreviewHtml(readback)
  );
  fs.writeFileSync(
    path.join(publicArtifactRoot, VITE_SHELL_PUBLIC_APP_PREVIEW_FILE),
    renderViteShellAppPreviewHtml(readback, root)
  );
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
      entryGroupChunks: result.counts.entryGroupChunks,
      startupCriticalAssets: result.counts.startupCriticalAssets,
      publishedFiles: result.counts.publishedFiles,
    }));
  } catch (err) {
    console.error(err && err.message ? err.message : String(err));
    process.exitCode = 1;
  }
}
