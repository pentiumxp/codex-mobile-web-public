import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  SHELL_SCRIPT_BLOCK_END,
  SHELL_SCRIPT_BLOCK_START,
  buildPublicShellManifest,
  renderShellScriptBlock,
} from "./generate-frontend-shell-manifest.mjs";

export const SHELL_MANIFEST_SCHEMA_VERSION = 1;
export const VITE_SHELL_BUILD_CONTRACT_SCHEMA_VERSION = 1;
export const VITE_SHELL_ENTRY_SOURCE = "frontend/vite-shell-entry.mjs";
export const VITE_DEFERRED_ENTRY_SOURCE = "frontend/vite-deferred-entry-topology.mjs";
export const VITE_ENTRY_GROUP_SOURCE_PREFIX = "virtual:codex-mobile-shell-entry-group/";
export const VITE_ENTRY_GROUP_LOADER_SOURCE = "virtual:codex-mobile-shell-entry-group-loader";

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
    startupGlobalContracts: startupGlobalContracts(publicManifest),
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
  const expectedStartupGlobalContracts = startupGlobalContracts(graph.expectedManifest);
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
  if (!graph.startupGlobalContracts.length) {
    issues.push({ code: "startup_global_contracts_missing" });
  }
  if (JSON.stringify(graph.startupGlobalContracts) !== JSON.stringify(expectedStartupGlobalContracts)) {
    issues.push({ code: "startup_global_contracts_mismatch" });
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
      startupGlobalContracts: graph.startupGlobalContracts.length,
      emittedAssets: assetRecords.length,
    },
    indexScriptAssets: graph.indexScriptAssets,
    indexLinkAssets: graph.indexLinkAssets,
    swStaticAssets: graph.swStaticAssets,
    pageShellAssets: graph.pageShellAssets,
    serverHashAssets: graph.serverHashAssets,
    entryGroups: graph.entryGroups,
    classicGlobalExports: graph.classicGlobalExports,
    startupGlobalContracts: graph.startupGlobalContracts,
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

function classicGlobalExportsForAssets(manifest, assets) {
  const assetSet = new Set(Array.isArray(assets) ? assets : []);
  return (Array.isArray(manifest && manifest.classicGlobalExports) ? manifest.classicGlobalExports : [])
    .filter((entry) => assetSet.has(entry && entry.asset))
    .map((entry) => ({
      asset: entry.asset,
      globals: Array.isArray(entry.globals) ? entry.globals.slice() : [],
    }));
}

function classicAssetRecordsForAssets(manifest, assets) {
  const assetSet = new Set(Array.isArray(assets) ? assets : []);
  return (Array.isArray(manifest && manifest.assets) ? manifest.assets : [])
    .filter((entry) => assetSet.has(entry && entry.path))
    .map((entry) => ({
      path: entry.path,
      sourcePath: entry.sourcePath,
      bytes: Number(entry.bytes) || 0,
      sha256: String(entry.sha256 || ""),
    }));
}

function startupGlobalContracts(manifest) {
  return (Array.isArray(manifest && manifest.startupGlobalContracts) ? manifest.startupGlobalContracts : [])
    .map((entry) => ({
      name: String(entry && entry.name || ""),
      asset: String(entry && entry.asset || ""),
      groupId: String(entry && entry.groupId || ""),
      startupCritical: Boolean(entry && entry.startupCritical),
      source: String(entry && entry.source || "startup-window-guard"),
      present: entry && entry.present !== false,
    }))
    .filter((entry) => entry.name);
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

function classicShellScriptBlockContract(manifest) {
  const scriptAssets = Array.isArray(manifest && manifest.indexScriptAssets)
    ? manifest.indexScriptAssets
    : [];
  const source = renderShellScriptBlock(scriptAssets);
  return {
    schemaVersion: 1,
    source: "generated-classic-index-script-block",
    startMarker: SHELL_SCRIPT_BLOCK_START,
    endMarker: SHELL_SCRIPT_BLOCK_END,
    scriptCount: scriptAssets.length,
    firstScript: scriptAssets[0] || "",
    lastScript: scriptAssets.length ? scriptAssets[scriptAssets.length - 1] : "",
    sha256: sha256Hex(Buffer.from(source, "utf8")),
  };
}

function startupCompatibilityContract(manifest) {
  const contracts = startupGlobalContracts(manifest);
  const classicExports = Array.isArray(manifest && manifest.classicGlobalExports)
    ? manifest.classicGlobalExports
    : [];
  const assetRecords = new Map((Array.isArray(manifest && manifest.assets) ? manifest.assets : [])
    .map((entry) => [String(entry && entry.path || ""), entry]));
  const exportedAssetByGlobal = new Map();
  for (const entry of classicExports) {
    for (const name of Array.isArray(entry && entry.globals) ? entry.globals : []) {
      exportedAssetByGlobal.set(String(name || ""), String(entry && entry.asset || ""));
    }
  }
  const requiredGlobals = contracts.map((entry) => {
    const assetRecord = assetRecords.get(entry.asset) || {};
    return {
      ...entry,
      exportedAsset: exportedAssetByGlobal.get(entry.name) || "",
      hashPresent: Boolean(assetRecord && assetRecord.sha256),
      bytes: Number(assetRecord && assetRecord.bytes) || 0,
      sha256: String(assetRecord && assetRecord.sha256 || ""),
    };
  });
  return {
    schemaVersion: 1,
    source: "generated-startup-window-guards",
    requiredGlobals,
    requiredGlobalNames: requiredGlobals.map((entry) => entry.name),
    requiredGlobalCount: requiredGlobals.length,
    assetCount: new Set(requiredGlobals.map((entry) => entry.asset).filter(Boolean)).size,
    hashCount: requiredGlobals.filter((entry) => entry.hashPresent).length,
    byteCount: requiredGlobals.reduce((total, entry) => total + (Number(entry.bytes) || 0), 0),
  };
}

function appPreviewClassicLoaderPlanContract(manifest) {
  const scriptAssets = Array.isArray(manifest && manifest.indexScriptAssets)
    ? manifest.indexScriptAssets
    : [];
  const assetRecords = new Map((Array.isArray(manifest && manifest.assets) ? manifest.assets : [])
    .map((entry) => [String(entry && entry.path || ""), entry]));
  const groupByAsset = new Map();
  for (const group of Array.isArray(manifest && manifest.entryGroups) ? manifest.entryGroups : []) {
    for (const asset of Array.isArray(group && group.assets) ? group.assets : []) {
      groupByAsset.set(String(asset || ""), {
        groupId: String(group && group.id || ""),
        phase: String(group && group.phase || ""),
        startupCritical: Boolean(group && group.startupCritical),
        chunkTarget: String(group && group.chunkTarget || ""),
      });
    }
  }
  const scripts = scriptAssets.map((assetPath, index) => {
    const assetRecord = assetRecords.get(assetPath) || {};
    const group = groupByAsset.get(assetPath) || {};
    return {
      index,
      path: assetPath,
      groupId: String(group.groupId || ""),
      phase: String(group.phase || ""),
      startupCritical: Boolean(group.startupCritical),
      chunkTarget: String(group.chunkTarget || ""),
      sourcePath: String(assetRecord.sourcePath || ""),
      bytes: Number(assetRecord.bytes) || 0,
      sha256: String(assetRecord.sha256 || ""),
    };
  });
  const contract = {
    schemaVersion: 1,
    source: "generated-vite-app-preview-classic-loader-plan",
    owner: "vite-shell-entry",
    scriptCount: scripts.length,
    firstScript: scripts[0] ? scripts[0].path : "",
    lastScript: scripts.length ? scripts[scripts.length - 1].path : "",
    hashCount: scripts.filter((entry) => entry.sha256).length,
    byteCount: scripts.reduce((total, entry) => total + (Number(entry.bytes) || 0), 0),
    scripts,
  };
  return {
    ...contract,
    sha256: sha256Hex(Buffer.from(JSON.stringify(contract), "utf8")),
  };
}

function validateViteShellBuildContract(contract, manifest) {
  const issues = [];
  const entry = contract.viteEntry;
  const deferredChunks = contract.viteDeferredChunks || [];
  const entryGroupChunks = contract.viteEntryGroupChunks || [];
  const entryDynamicImportGraph = contract.entryDynamicImportGraph || {};
  const classicFallback = contract.classicFallback || {};
  const classicScriptBlock = classicFallback.scriptBlock || null;
  const startupCompatibility = contract.startupCompatibility || {};
  const appPreviewClassicLoaderPlan = contract.appPreviewClassicLoaderPlan || null;
  const expectedClassicScriptBlock = classicShellScriptBlockContract(manifest);
  const expectedAppPreviewClassicLoaderPlan = appPreviewClassicLoaderPlanContract(manifest);
  const outputFiles = new Set(contract.outputFiles || []);
  const classicOutputFiles = new Set((contract.classicShellAssets || []).map((asset) => asset.fileName));
  const requiredGroupIds = (Array.isArray(manifest.entryGroups) ? manifest.entryGroups : [])
    .map((group) => sanitizeEntryGroupId(group && group.id))
    .filter(Boolean);
  const entryChunkIds = new Set(entryGroupChunks.map((chunk) => sanitizeEntryGroupId(chunk.groupId)));

  if (contract.productionExecution !== "classic-script-fallback") {
    issues.push({ code: "vite_build_contract_not_classic_fallback" });
  }
  if (contract.entryGroupImportOwner !== "vite-shell-entry") {
    issues.push({ code: "vite_entry_group_import_owner_mismatch" });
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
  if (deferredChunks.some((chunk) => String(chunk && chunk.source || "").startsWith(VITE_ENTRY_GROUP_SOURCE_PREFIX))) {
    issues.push({ code: "vite_deferred_chunk_contains_entry_group" });
  }
  if (!deferredChunks.some((chunk) => chunk.source === VITE_DEFERRED_ENTRY_SOURCE || chunk.name === "vite-deferred-entry-topology")) {
    issues.push({ code: "vite_deferred_entry_topology_missing" });
  }
  for (const groupId of requiredGroupIds) {
    if (!entryChunkIds.has(groupId)) {
      issues.push({ code: "vite_entry_group_chunk_missing", groupId });
    }
  }
  for (const chunk of entryGroupChunks) {
    if (Number(chunk.classicAssetHashCount) !== Number(chunk.assetCount)) {
      issues.push({ code: "vite_entry_group_classic_asset_hash_count_mismatch", groupId: chunk.groupId });
      break;
    }
    if (!Array.isArray(chunk.classicAssetRecords) || chunk.classicAssetRecords.length !== Number(chunk.assetCount)) {
      issues.push({ code: "vite_entry_group_classic_asset_records_missing", groupId: chunk.groupId });
      break;
    }
  }
  if (entryDynamicImportGraph.owner !== "vite-shell-entry") {
    issues.push({ code: "vite_entry_dynamic_import_owner_mismatch" });
  }
  if ((entryDynamicImportGraph.missingFiles || []).length) {
    issues.push({ code: "vite_entry_dynamic_import_missing" });
  }
  if ((entryDynamicImportGraph.extraFiles || []).length) {
    issues.push({ code: "vite_entry_dynamic_import_extra" });
  }
  if (Number(entryDynamicImportGraph.entryGroupFileCount) !== requiredGroupIds.length) {
    issues.push({ code: "vite_entry_dynamic_import_entry_group_count_mismatch" });
  }
  if (Number(entryDynamicImportGraph.deferredFileCount) < 1) {
    issues.push({ code: "vite_entry_dynamic_import_deferred_missing" });
  }
  if (!classicScriptBlock) {
    issues.push({ code: "classic_shell_script_block_contract_missing" });
  } else {
    if (classicScriptBlock.sha256 !== expectedClassicScriptBlock.sha256) {
      issues.push({ code: "classic_shell_script_block_hash_mismatch" });
    }
    if (Number(classicScriptBlock.scriptCount) !== expectedClassicScriptBlock.scriptCount) {
      issues.push({ code: "classic_shell_script_block_count_mismatch" });
    }
    if (String(classicScriptBlock.firstScript || "") !== expectedClassicScriptBlock.firstScript
      || String(classicScriptBlock.lastScript || "") !== expectedClassicScriptBlock.lastScript) {
      issues.push({ code: "classic_shell_script_block_boundary_mismatch" });
    }
  }
  if (!Array.isArray(startupCompatibility.requiredGlobals) || !startupCompatibility.requiredGlobals.length) {
    issues.push({ code: "startup_global_contract_missing" });
  } else {
    for (const entry of startupCompatibility.requiredGlobals) {
      if (!entry || !entry.name || !entry.asset || entry.exportedAsset !== entry.asset || entry.hashPresent !== true) {
        issues.push({ code: "startup_global_contract_invalid", global: entry && entry.name });
        break;
      }
    }
    if (Number(startupCompatibility.hashCount) !== Number(startupCompatibility.requiredGlobalCount)) {
      issues.push({ code: "startup_global_contract_hash_count_mismatch" });
    }
  }
  if (!appPreviewClassicLoaderPlan) {
    issues.push({ code: "vite_app_preview_classic_loader_plan_missing" });
  } else {
    const planScripts = Array.isArray(appPreviewClassicLoaderPlan.scripts)
      ? appPreviewClassicLoaderPlan.scripts
      : [];
    if (appPreviewClassicLoaderPlan.owner !== "vite-shell-entry") {
      issues.push({ code: "vite_app_preview_classic_loader_plan_owner_mismatch" });
    }
    if (appPreviewClassicLoaderPlan.sha256 !== expectedAppPreviewClassicLoaderPlan.sha256) {
      issues.push({ code: "vite_app_preview_classic_loader_plan_hash_mismatch" });
    }
    if (Number(appPreviewClassicLoaderPlan.scriptCount) !== expectedAppPreviewClassicLoaderPlan.scriptCount
      || Number(appPreviewClassicLoaderPlan.hashCount) !== expectedAppPreviewClassicLoaderPlan.hashCount
      || Number(appPreviewClassicLoaderPlan.hashCount) !== Number(appPreviewClassicLoaderPlan.scriptCount)) {
      issues.push({ code: "vite_app_preview_classic_loader_plan_count_mismatch" });
    }
    if (String(appPreviewClassicLoaderPlan.firstScript || "") !== expectedAppPreviewClassicLoaderPlan.firstScript
      || String(appPreviewClassicLoaderPlan.lastScript || "") !== expectedAppPreviewClassicLoaderPlan.lastScript) {
      issues.push({ code: "vite_app_preview_classic_loader_plan_boundary_mismatch" });
    }
    if (JSON.stringify(planScripts.map((entry) => entry && entry.path)) !== JSON.stringify(manifest.indexScriptAssets || [])) {
      issues.push({ code: "vite_app_preview_classic_loader_plan_order_mismatch" });
    }
    if (planScripts.some((entry) => !entry || !entry.groupId || !entry.sha256 || !Number(entry.bytes))) {
      issues.push({ code: "vite_app_preview_classic_loader_plan_record_missing" });
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
  const deferredChunks = chunks.filter((chunk) => chunk.source === VITE_DEFERRED_ENTRY_SOURCE);
  const entryGroupChunks = chunks
    .filter((chunk) => String(chunk.source || "").startsWith(VITE_ENTRY_GROUP_SOURCE_PREFIX))
    .map((chunk) => {
      const groupId = sanitizeEntryGroupId(String(chunk.source || "").slice(VITE_ENTRY_GROUP_SOURCE_PREFIX.length));
      const group = (Array.isArray(manifest.entryGroups) ? manifest.entryGroups : [])
        .find((entryGroup) => sanitizeEntryGroupId(entryGroup && entryGroup.id) === groupId) || {};
      const assets = Array.isArray(group.assets) ? group.assets.slice() : [];
      const classicGlobalExports = classicGlobalExportsForAssets(manifest, assets);
      const classicAssetRecords = classicAssetRecordsForAssets(manifest, assets);
      const groupStartupGlobalContracts = startupGlobalContracts(manifest)
        .filter((entry) => assets.includes(entry.asset));
      return {
        ...chunk,
        groupId,
        phase: String(group.phase || ""),
        startupCritical: Boolean(group.startupCritical),
        chunkTarget: String(group.chunkTarget || ""),
        assets,
        assetCount: assets.length,
        classicAssetRecords,
        classicAssetHashCount: classicAssetRecords.filter((entry) => entry.sha256).length,
        classicAssetBytes: classicAssetRecords.reduce((total, entry) => total + (Number(entry.bytes) || 0), 0),
        classicGlobalExports,
        classicGlobalExportAssetCount: classicGlobalExports.length,
        classicGlobalExportCount: classicGlobalExports.reduce((total, entry) => (
          total + (Array.isArray(entry && entry.globals) ? entry.globals.length : 0)
        ), 0),
        startupGlobalContracts: groupStartupGlobalContracts,
      };
    })
    .sort((a, b) => a.groupId.localeCompare(b.groupId));
  const expectedEntryDynamicImportFiles = uniqueValues([
    ...deferredChunks.map((chunk) => chunk.fileName),
    ...entryGroupChunks.map((chunk) => chunk.fileName),
  ]);
  const actualEntryDynamicImportFiles = uniqueValues(viteEntry && Array.isArray(viteEntry.dynamicImports)
    ? viteEntry.dynamicImports
    : []);
  const expectedDynamicImportSet = new Set(expectedEntryDynamicImportFiles);
  const actualDynamicImportSet = new Set(actualEntryDynamicImportFiles);
  const entryDynamicImportGraph = {
    owner: "vite-shell-entry",
    actualFiles: actualEntryDynamicImportFiles,
    expectedFiles: expectedEntryDynamicImportFiles,
    missingFiles: expectedEntryDynamicImportFiles.filter((fileName) => !actualDynamicImportSet.has(fileName)),
    extraFiles: actualEntryDynamicImportFiles.filter((fileName) => !expectedDynamicImportSet.has(fileName)),
    deferredFileCount: deferredChunks.length,
    entryGroupFileCount: entryGroupChunks.length,
  };
  const classicShellAssets = assetOutputRecords(manifest);
  const classicShellScriptBlock = classicShellScriptBlockContract(manifest);
  const startupCompatibility = startupCompatibilityContract(manifest);
  const appPreviewClassicLoaderPlan = appPreviewClassicLoaderPlanContract(manifest);
  const outputFiles = [
    ...chunks.map((chunk) => chunk.fileName),
    ...classicShellAssets.map((asset) => asset.fileName),
    "codex-mobile-shell-manifest.json",
  ];
  const contract = {
    schemaVersion: VITE_SHELL_BUILD_CONTRACT_SCHEMA_VERSION,
    stage: "vite-shell-artifact-contract-v1",
    productionExecution: "classic-script-fallback",
    entryGroupImportOwner: "vite-shell-entry",
    entryDynamicImportGraph,
    entrySource: VITE_SHELL_ENTRY_SOURCE,
    deferredEntrySource: VITE_DEFERRED_ENTRY_SOURCE,
    classicFallback: {
      indexHtmlAsset: "/index.html",
      outputRoot: "shell-assets",
      indexScriptAssets: manifest.indexScriptAssets,
      entryGroups: manifest.entryGroups,
      classicGlobalExports: manifest.classicGlobalExports,
      startupGlobalContracts: manifest.startupGlobalContracts,
      scriptBlock: classicShellScriptBlock,
    },
    startupCompatibility,
    appPreviewClassicLoaderPlan,
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
      if (String(id || "") === VITE_ENTRY_GROUP_LOADER_SOURCE) {
        return `\0${VITE_ENTRY_GROUP_LOADER_SOURCE}`;
      }
      if (String(id || "").startsWith(VITE_ENTRY_GROUP_SOURCE_PREFIX)) {
        return `\0${id}`;
      }
      return null;
    },
    load(id) {
      const value = String(id || "");
      if (value === `\0${VITE_ENTRY_GROUP_LOADER_SOURCE}`) {
        const manifest = buildPublicShellManifest(root);
        const groups = (Array.isArray(manifest.entryGroups) ? manifest.entryGroups : [])
          .map((group) => sanitizeEntryGroupId(group && group.id))
          .filter(Boolean);
        const importLines = groups.map((groupId) => (
          `  ${JSON.stringify(groupId)}: () => import(${JSON.stringify(viteEntryGroupSourceId(groupId))}),`
        ));
        return [
          `export const codexMobileViteEntryGroupIds = ${JSON.stringify(groups, null, 2)};`,
          "const codexMobileViteEntryGroupLoaders = {",
          ...importLines,
          "};",
          "export function loadCodexMobileViteEntryGroups() {",
          "  const status = { expectedCount: codexMobileViteEntryGroupIds.length, imported: [], failed: [], ok: false };",
          "  globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_STATUS__ = status;",
          "  const promise = Promise.all(codexMobileViteEntryGroupIds.map(async (groupId) => {",
          "    const load = codexMobileViteEntryGroupLoaders[groupId];",
          "    try {",
          "      const module = await load();",
          "      const payload = module && (module.codexMobileViteEntryGroup || module.default) || {};",
          "      status.imported.push(String(payload.id || groupId));",
          "    } catch (_) {",
          "      status.failed.push(groupId);",
          "    }",
          "  })).then(() => {",
          "    const registry = globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};",
          "    status.registryCount = Object.keys(registry).length;",
          "    status.ok = status.failed.length === 0",
          "      && status.imported.length === status.expectedCount",
          "      && status.registryCount === status.expectedCount;",
          "    return status;",
          "  });",
          "  globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_PROMISE__ = promise;",
          "  return promise;",
          "}",
          "",
        ].join("\n");
      }
      const prefix = `\0${VITE_ENTRY_GROUP_SOURCE_PREFIX}`;
      if (!value.startsWith(prefix)) return null;
      const groupId = sanitizeEntryGroupId(value.slice(prefix.length));
      const manifest = buildPublicShellManifest(root);
      const group = (Array.isArray(manifest.entryGroups) ? manifest.entryGroups : [])
        .find((entry) => sanitizeEntryGroupId(entry && entry.id) === groupId);
      if (!group) {
        throw new Error(`codex_mobile_vite_entry_group_missing:${groupId}`);
      }
      const assets = Array.isArray(group.assets) ? group.assets.slice() : [];
      const classicGlobalExports = classicGlobalExportsForAssets(manifest, assets);
      const fullManifest = buildShellAssetManifest(root);
      const classicAssetRecords = classicAssetRecordsForAssets(fullManifest, assets);
      const payload = {
        id: group.id,
        phase: group.phase,
        startupCritical: Boolean(group.startupCritical),
        chunkTarget: group.chunkTarget,
        assets,
        assetCount: assets.length,
        classicAssetRecords,
        classicAssetHashCount: classicAssetRecords.filter((entry) => entry.sha256).length,
        classicAssetBytes: classicAssetRecords.reduce((total, entry) => total + (Number(entry.bytes) || 0), 0),
        classicGlobalExports,
        classicGlobalExportAssetCount: classicGlobalExports.length,
        classicGlobalExportCount: classicGlobalExports.reduce((total, entry) => (
          total + (Array.isArray(entry && entry.globals) ? entry.globals.length : 0)
        ), 0),
        startupGlobalContracts: startupGlobalContracts(manifest).filter((entry) => assets.includes(entry.asset)),
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
