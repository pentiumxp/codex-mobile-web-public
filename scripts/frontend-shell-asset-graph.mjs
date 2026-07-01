import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildPublicShellManifest } from "./generate-frontend-shell-manifest.mjs";

export const SHELL_MANIFEST_SCHEMA_VERSION = 1;
export const VITE_SHELL_BUILD_CONTRACT_SCHEMA_VERSION = 1;
export const VITE_SHELL_ENTRY_SOURCE = "frontend/vite-shell-entry.mjs";
export const VITE_DEFERRED_ENTRY_SOURCE = "frontend/vite-deferred-entry-topology.mjs";
export const VITE_ENTRY_GROUP_SOURCE_PREFIX = "virtual:codex-mobile-shell-entry-group/";

function readText(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(root, relativePath) {
  return JSON.parse(readText(root, relativePath));
}

function uniqueValues(values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractQuotedStrings(source) {
  const values = [];
  const pattern = /"([^"]*)"|'([^']*)'/g;
  let match;
  while ((match = pattern.exec(source))) {
    values.push(match[1] ?? match[2] ?? "");
  }
  return values;
}

export function extractExternalScriptSrcs(indexHtml) {
  const values = [];
  const pattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi;
  let match;
  while ((match = pattern.exec(indexHtml))) {
    const src = String(match[1] || "").trim();
    if (src) values.push(src);
  }
  return values;
}

export function extractLinkHrefs(indexHtml) {
  const values = [];
  const pattern = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = pattern.exec(indexHtml))) {
    const href = String(match[1] || "").trim();
    if (href && href.startsWith("/")) values.push(href);
  }
  return uniqueValues(values);
}

export function extractArrayDeclarationStrings(source, declarationName) {
  const pattern = new RegExp(
    `${escapeRegExp(declarationName)}\\s*=\\s*(?:Object\\.freeze\\(\\s*)?\\[([\\s\\S]*?)\\]\\s*\\)?`,
    "m"
  );
  const match = source.match(pattern);
  return match ? extractQuotedStrings(match[1]) : [];
}

export function extractServerRuntimeHashAssets(source) {
  const match = source.match(/for\s*\(\s*const\s+file\s+of\s+\[([\s\S]*?)\]\s*\)\s*\{/m);
  return match ? extractQuotedStrings(match[1]).map((value) => `/${value}`) : [];
}

export function extractShellCacheName(source) {
  const match = source.match(/CACHE_NAME\s*=\s*["']([^"']+)["']/);
  return match ? String(match[1] || "") : "";
}

export function extractClientBuildId(source) {
  const match = source.match(/CLIENT_BUILD_ID\s*=\s*["']([^"']+)["']/);
  return match ? String(match[1] || "") : "";
}

function sourcePathForAsset(assetPath) {
  if (assetPath === "/") return "public/index.html";
  const normalized = String(assetPath || "").replace(/^\/+/, "");
  return normalized ? `public/${normalized}` : "";
}

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assetRecord(root, assetPath, role) {
  const sourcePath = sourcePathForAsset(assetPath);
  const absolutePath = sourcePath ? path.join(root, sourcePath) : "";
  let bytes = 0;
  let sha256 = "";
  let exists = false;
  try {
    const buffer = fs.readFileSync(absolutePath);
    bytes = buffer.length;
    sha256 = sha256Hex(buffer);
    exists = true;
  } catch (_) {}
  return {
    path: assetPath,
    role,
    sourcePath,
    exists,
    bytes,
    sha256,
  };
}

function orderedSubset(orderSource, values) {
  const wanted = new Set(values);
  return orderSource.filter((value) => wanted.has(value));
}

export function collectShellAssetGraph(root = process.cwd()) {
  const indexHtml = readText(root, "public/index.html");
  const swSource = readText(root, "public/sw.js");
  const bootstrapSource = readText(root, "public/app-bootstrap.js");
  const serverRuntimeUtilsSource = readText(root, "services/runtime/server-runtime-utils.js");
  const publicManifest = readJson(root, "public/shell-asset-manifest.json");
  const expectedManifest = buildPublicShellManifest(root);
  const indexScriptAssets = extractExternalScriptSrcs(indexHtml);
  const indexLinkAssets = extractLinkHrefs(indexHtml);
  return {
    root,
    shellCacheName: String(publicManifest.shellCacheName || ""),
    clientBuildId: String(publicManifest.clientBuildId || ""),
    indexScriptAssets,
    indexLinkAssets,
    swStaticAssets: Array.isArray(publicManifest.precacheAssets) ? publicManifest.precacheAssets : [],
    pageShellAssets: Array.isArray(publicManifest.pageShellAssets) ? publicManifest.pageShellAssets : [],
    serverHashAssets: Array.isArray(publicManifest.hashAssets) ? publicManifest.hashAssets : [],
    entryGroups: Array.isArray(publicManifest.entryGroups) ? publicManifest.entryGroups : [],
    classicGlobalExports: Array.isArray(publicManifest.classicGlobalExports) ? publicManifest.classicGlobalExports : [],
    publicManifest,
    expectedManifest,
    swSource,
    bootstrapSource,
    serverRuntimeUtilsSource,
  };
}

export function validateShellAssetGraph(graph) {
  const issues = [];
  const indexScriptSet = new Set(graph.indexScriptAssets);
  const swStaticSet = new Set(graph.swStaticAssets);
  const pageShellSet = new Set(graph.pageShellAssets);
  const serverHashSet = new Set(graph.serverHashAssets);
  const entryGroupAssets = graph.entryGroups.flatMap((group) => Array.isArray(group.assets) ? group.assets : []);
  const expectedClassicGlobalExports = Array.isArray(graph.expectedManifest.classicGlobalExports)
    ? graph.expectedManifest.classicGlobalExports
    : [];
  const startupCriticalAssets = new Set(graph.entryGroups
    .filter((group) => group && group.startupCritical)
    .flatMap((group) => Array.isArray(group.assets) ? group.assets : []));
  const generatedManifestMatches = JSON.stringify(graph.publicManifest) === JSON.stringify(graph.expectedManifest);

  if (!generatedManifestMatches) issues.push({ code: "public_shell_manifest_out_of_date" });
  if (!graph.entryGroups.length) issues.push({ code: "missing_entry_groups" });
  if (!graph.classicGlobalExports.length) issues.push({ code: "classic_global_exports_missing" });
  if (JSON.stringify(graph.classicGlobalExports) !== JSON.stringify(expectedClassicGlobalExports)) {
    issues.push({ code: "classic_global_exports_mismatch" });
  }
  if (JSON.stringify(entryGroupAssets) !== JSON.stringify(graph.indexScriptAssets)) {
    issues.push({ code: "entry_group_order_mismatch" });
  }
  for (const asset of ["/app-bootstrap.js", "/runtime-wiring-runtime.js", "/app-shell-runtime.js", "/app.js"]) {
    if (!startupCriticalAssets.has(asset)) issues.push({ code: "startup_critical_asset_missing", asset });
  }
  if (!indexScriptSet.has("/shell-asset-manifest.js")) {
    issues.push({ code: "index_missing_shell_asset_manifest_script" });
  }
  if (!String(graph.swSource || "").includes('importScripts("/shell-asset-manifest.js")')) {
    issues.push({ code: "sw_not_manifest_owned" });
  }
  if (/const\s+STATIC_ASSETS\s*=\s*\[/.test(String(graph.swSource || ""))) {
    issues.push({ code: "sw_static_assets_manual_list" });
  }
  if (/PAGE_SHELL_ASSETS\s*=\s*Object\.freeze\(\s*\[/.test(String(graph.bootstrapSource || ""))) {
    issues.push({ code: "page_shell_assets_manual_list" });
  }
  if (!String(graph.serverRuntimeUtilsSource || "").includes("shell-asset-manifest.json")) {
    issues.push({ code: "server_hash_not_manifest_owned" });
  }

  for (const asset of graph.indexScriptAssets) {
    if (!swStaticSet.has(asset)) issues.push({ code: "sw_missing_index_script", asset });
    if (!pageShellSet.has(asset)) issues.push({ code: "page_shell_missing_index_script", asset });
    if (!serverHashSet.has(asset)) issues.push({ code: "server_hash_missing_index_script", asset });
  }

  for (const asset of graph.swStaticAssets) {
    if (asset.endsWith(".js") && asset !== "/sw.js" && !indexScriptSet.has(asset)) {
      issues.push({ code: "sw_script_not_loaded_by_index", asset });
    }
  }

  for (const asset of graph.pageShellAssets) {
    if (asset.endsWith(".js") && asset !== "/sw.js" && !indexScriptSet.has(asset)) {
      issues.push({ code: "page_shell_script_not_loaded_by_index", asset });
    }
  }

  const swScriptOrder = orderedSubset(graph.swStaticAssets, graph.indexScriptAssets);
  if (swScriptOrder.join("\n") !== graph.indexScriptAssets.join("\n")) {
    issues.push({ code: "sw_script_order_mismatch" });
  }

  const pageShellScriptOrder = orderedSubset(graph.pageShellAssets, graph.indexScriptAssets);
  if (pageShellScriptOrder.join("\n") !== graph.indexScriptAssets.join("\n")) {
    issues.push({ code: "page_shell_script_order_mismatch" });
  }

  if (!graph.shellCacheName) issues.push({ code: "missing_shell_cache_name" });
  if (!graph.clientBuildId) issues.push({ code: "missing_client_build_id" });
  if (graph.shellCacheName && graph.clientBuildId && !graph.clientBuildId.endsWith(`|${graph.shellCacheName}`)) {
    issues.push({
      code: "client_build_shell_cache_mismatch",
      clientBuildId: graph.clientBuildId,
      shellCacheName: graph.shellCacheName,
    });
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function buildShellAssetManifest(root = process.cwd()) {
  const graph = collectShellAssetGraph(root);
  const validation = validateShellAssetGraph(graph);
  const allAssets = uniqueValues([
    ...graph.swStaticAssets,
    "/sw.js",
    ...graph.pageShellAssets,
    ...graph.indexLinkAssets,
  ]);
  const assetRecords = allAssets.map((assetPath) => {
    const role = graph.indexScriptAssets.includes(assetPath)
      ? "script"
      : assetPath === "/sw.js"
        ? "service-worker"
        : "static";
    return assetRecord(root, assetPath, role);
  });
  for (const asset of assetRecords) {
    if (!asset.exists) validation.issues.push({ code: "asset_file_missing", asset: asset.path });
  }
  validation.ok = validation.issues.length === 0;
  const startupCriticalAssets = uniqueValues(graph.entryGroups
    .filter((group) => group && group.startupCritical)
    .flatMap((group) => Array.isArray(group.assets) ? group.assets : []));
  return {
    schemaVersion: SHELL_MANIFEST_SCHEMA_VERSION,
    generatedBy: "vite-codex-mobile-shell-asset-graph",
    shellCacheName: graph.shellCacheName,
    clientBuildId: graph.clientBuildId,
    counts: {
      indexScripts: graph.indexScriptAssets.length,
      swStaticAssets: graph.swStaticAssets.length,
      pageShellAssets: graph.pageShellAssets.length,
      serverHashAssets: graph.serverHashAssets.length,
      startupCriticalAssets: startupCriticalAssets.length,
      classicGlobalExportAssets: graph.classicGlobalExports.length,
      classicGlobalExports: graph.classicGlobalExports.reduce((total, entry) => (
        total + (Array.isArray(entry && entry.globals) ? entry.globals.length : 0)
      ), 0),
      emittedAssets: assetRecords.length,
    },
    indexScriptAssets: graph.indexScriptAssets,
    indexLinkAssets: graph.indexLinkAssets,
    swStaticAssets: graph.swStaticAssets,
    pageShellAssets: graph.pageShellAssets,
    serverHashAssets: graph.serverHashAssets,
    entryGroups: graph.entryGroups,
    classicGlobalExports: graph.classicGlobalExports,
    assets: assetRecords,
    validation,
  };
}

function outputPathForAsset(assetPath) {
  if (assetPath === "/") return "shell-assets/index.html";
  return `shell-assets/${String(assetPath || "").replace(/^\/+/, "")}`;
}

function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/");
}

function sanitizeEntryGroupId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function viteEntryGroupSourceId(groupId) {
  return `${VITE_ENTRY_GROUP_SOURCE_PREFIX}${sanitizeEntryGroupId(groupId)}`;
}

export function buildViteEntryGroupInputs(root = process.cwd()) {
  const manifest = buildPublicShellManifest(root);
  const inputs = {};
  for (const group of Array.isArray(manifest.entryGroups) ? manifest.entryGroups : []) {
    const groupId = sanitizeEntryGroupId(group && group.id);
    if (!groupId) continue;
    inputs[`vite-entry-group-${groupId}`] = viteEntryGroupSourceId(groupId);
  }
  return inputs;
}

function bundleValues(bundle) {
  return Object.values(bundle || {});
}

function sourceForFacadeModule(facadeModuleId, root) {
  const value = normalizePath(facadeModuleId);
  if (!value) return "";
  const virtualIndex = value.indexOf(VITE_ENTRY_GROUP_SOURCE_PREFIX);
  if (virtualIndex >= 0) {
    return value.slice(virtualIndex);
  }
  const rootPath = normalizePath(root || process.cwd());
  if (value === rootPath || value.startsWith(`${rootPath}/`)) {
    return normalizePath(path.relative(rootPath, value));
  }
  return value;
}

function chunkRecords(bundle, root = process.cwd()) {
  return bundleValues(bundle)
    .filter((item) => item && item.type === "chunk")
    .map((chunk) => ({
      fileName: normalizePath(chunk.fileName),
      name: String(chunk.name || ""),
      source: sourceForFacadeModule(chunk.facadeModuleId, root),
      isEntry: Boolean(chunk.isEntry),
      isDynamicEntry: Boolean(chunk.isDynamicEntry),
      imports: Array.isArray(chunk.imports) ? chunk.imports.map(normalizePath) : [],
      dynamicImports: Array.isArray(chunk.dynamicImports) ? chunk.dynamicImports.map(normalizePath) : [],
    }))
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

function assetOutputRecords(manifest) {
  return (manifest.assets || []).map((asset) => ({
    path: asset.path,
    sourcePath: asset.sourcePath,
    fileName: outputPathForAsset(asset.path),
    bytes: asset.bytes,
    sha256: asset.sha256,
  }));
}

function validateViteShellBuildContract(contract, manifest) {
  const issues = [];
  const entry = contract.viteEntry;
  const deferredChunks = contract.viteDeferredChunks || [];
  const entryGroupChunks = contract.viteEntryGroupChunks || [];
  const outputFiles = new Set(contract.outputFiles || []);
  const classicOutputFiles = new Set((contract.classicShellAssets || []).map((asset) => asset.fileName));
  const requiredGroupIds = (Array.isArray(manifest.entryGroups) ? manifest.entryGroups : [])
    .map((group) => sanitizeEntryGroupId(group && group.id))
    .filter(Boolean);
  const entryChunkIds = new Set(entryGroupChunks.map((chunk) => sanitizeEntryGroupId(chunk.groupId)));

  if (contract.productionExecution !== "classic-script-fallback") {
    issues.push({ code: "vite_build_contract_not_classic_fallback" });
  }
  if (!entry || entry.source !== VITE_SHELL_ENTRY_SOURCE || !entry.fileName) {
    issues.push({ code: "vite_shell_entry_missing" });
  }
  if (!entry || !Array.isArray(entry.dynamicImports) || !entry.dynamicImports.length) {
    issues.push({ code: "vite_shell_entry_missing_dynamic_import" });
  }
  if (!deferredChunks.length) {
    issues.push({ code: "vite_deferred_chunk_missing" });
  }
  if (!deferredChunks.some((chunk) => chunk.source === VITE_DEFERRED_ENTRY_SOURCE || chunk.name === "vite-deferred-entry-topology")) {
    issues.push({ code: "vite_deferred_entry_topology_missing" });
  }
  for (const groupId of requiredGroupIds) {
    if (!entryChunkIds.has(groupId)) {
      issues.push({ code: "vite_entry_group_chunk_missing", groupId });
    }
  }
  for (const asset of manifest.assets || []) {
    const fileName = outputPathForAsset(asset.path);
    if (!classicOutputFiles.has(fileName)) {
      issues.push({ code: "classic_shell_output_missing", asset: asset.path });
    }
  }
  for (const requiredFile of ["codex-mobile-shell-manifest.json"]) {
    if (!outputFiles.has(requiredFile)) issues.push({ code: "vite_output_file_missing", fileName: requiredFile });
  }
  for (const fileName of [entry && entry.fileName, ...deferredChunks.map((chunk) => chunk.fileName)].filter(Boolean)) {
    if (!outputFiles.has(fileName)) issues.push({ code: "vite_output_file_missing", fileName });
  }
  for (const fileName of entryGroupChunks.map((chunk) => chunk.fileName).filter(Boolean)) {
    if (!outputFiles.has(fileName)) issues.push({ code: "vite_output_file_missing", fileName });
  }
  return {
    ok: issues.length === 0,
    issues,
  };
}

export function buildViteShellBuildContract(manifest, bundle = {}, root = process.cwd()) {
  const chunks = chunkRecords(bundle, root);
  const viteEntry = chunks.find((chunk) => chunk.source === VITE_SHELL_ENTRY_SOURCE)
    || chunks.find((chunk) => chunk.isEntry && chunk.name === "vite-shell-entry")
    || chunks.find((chunk) => chunk.isEntry);
  const deferredChunks = chunks.filter((chunk) => chunk.source === VITE_DEFERRED_ENTRY_SOURCE
    || chunk.isDynamicEntry
    || (viteEntry && viteEntry.dynamicImports.includes(chunk.fileName)));
  const entryGroupChunks = chunks
    .filter((chunk) => String(chunk.source || "").startsWith(VITE_ENTRY_GROUP_SOURCE_PREFIX))
    .map((chunk) => ({
      ...chunk,
      groupId: sanitizeEntryGroupId(String(chunk.source || "").slice(VITE_ENTRY_GROUP_SOURCE_PREFIX.length)),
    }))
    .sort((a, b) => a.groupId.localeCompare(b.groupId));
  const classicShellAssets = assetOutputRecords(manifest);
  const outputFiles = [
    ...chunks.map((chunk) => chunk.fileName),
    ...classicShellAssets.map((asset) => asset.fileName),
    "codex-mobile-shell-manifest.json",
  ];
  const contract = {
    schemaVersion: VITE_SHELL_BUILD_CONTRACT_SCHEMA_VERSION,
    stage: "vite-shell-artifact-contract-v1",
    productionExecution: "classic-script-fallback",
    entrySource: VITE_SHELL_ENTRY_SOURCE,
    deferredEntrySource: VITE_DEFERRED_ENTRY_SOURCE,
    classicFallback: {
      indexHtmlAsset: "/index.html",
      outputRoot: "shell-assets",
      indexScriptAssets: manifest.indexScriptAssets,
      entryGroups: manifest.entryGroups,
      classicGlobalExports: manifest.classicGlobalExports,
    },
    viteEntry: viteEntry || null,
    viteDeferredChunks: deferredChunks,
    viteEntryGroupChunks: entryGroupChunks,
    classicShellAssets,
    outputFiles: [...new Set(outputFiles)].sort(),
  };
  contract.validation = validateViteShellBuildContract(contract, manifest);
  return contract;
}

export function createShellAssetGraphPlugin(options = {}) {
  const root = options.root || process.cwd();
  return {
    name: "codex-mobile-shell-asset-graph",
    generateBundle(_outputOptions, bundle) {
      const manifest = buildShellAssetManifest(root);
      if (!manifest.validation.ok) {
        const codes = manifest.validation.issues.map((issue) => issue.code).join(", ");
        throw new Error(`codex_mobile_shell_asset_graph_invalid: ${codes}`);
      }
      const viteBuild = buildViteShellBuildContract(manifest, bundle, root);
      if (!viteBuild.validation.ok) {
        const codes = viteBuild.validation.issues.map((issue) => issue.code).join(", ");
        throw new Error(`codex_mobile_vite_shell_build_contract_invalid: ${codes}`);
      }
      const outputManifest = {
        ...manifest,
        viteBuild,
      };
      for (const asset of manifest.assets) {
        const absolutePath = path.join(root, asset.sourcePath);
        const source = fs.readFileSync(absolutePath);
        this.emitFile({
          type: "asset",
          fileName: outputPathForAsset(asset.path),
          source,
        });
      }
      this.emitFile({
        type: "asset",
        fileName: "codex-mobile-shell-manifest.json",
        source: `${JSON.stringify(outputManifest, null, 2)}\n`,
      });
    },
  };
}

export function createShellEntryGroupVirtualModulePlugin(options = {}) {
  const root = options.root || process.cwd();
  return {
    name: "codex-mobile-shell-entry-group-virtual-modules",
    resolveId(id) {
      if (String(id || "").startsWith(VITE_ENTRY_GROUP_SOURCE_PREFIX)) {
        return `\0${id}`;
      }
      return null;
    },
    load(id) {
      const value = String(id || "");
      const prefix = `\0${VITE_ENTRY_GROUP_SOURCE_PREFIX}`;
      if (!value.startsWith(prefix)) return null;
      const groupId = sanitizeEntryGroupId(value.slice(prefix.length));
      const manifest = buildPublicShellManifest(root);
      const group = (Array.isArray(manifest.entryGroups) ? manifest.entryGroups : [])
        .find((entry) => sanitizeEntryGroupId(entry && entry.id) === groupId);
      if (!group) {
        throw new Error(`codex_mobile_vite_entry_group_missing:${groupId}`);
      }
      const payload = {
        id: group.id,
        phase: group.phase,
        startupCritical: Boolean(group.startupCritical),
        chunkTarget: group.chunkTarget,
        assets: Array.isArray(group.assets) ? group.assets.slice() : [],
        shellCacheName: manifest.shellCacheName,
        clientBuildId: manifest.clientBuildId,
      };
      return [
        `export const codexMobileViteEntryGroup = ${JSON.stringify(payload, null, 2)};`,
        "const codexMobileViteEntryGroupRegistry = globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};",
        "codexMobileViteEntryGroupRegistry[codexMobileViteEntryGroup.id] = codexMobileViteEntryGroup;",
        "globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ = codexMobileViteEntryGroupRegistry;",
        "export default codexMobileViteEntryGroup;",
        "",
      ].join("\n");
    },
  };
}
