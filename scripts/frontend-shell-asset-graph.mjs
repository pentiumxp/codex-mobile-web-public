import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const SHELL_MANIFEST_SCHEMA_VERSION = 1;

function readText(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
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
  const indexScriptAssets = extractExternalScriptSrcs(indexHtml);
  const indexLinkAssets = extractLinkHrefs(indexHtml);
  const swStaticAssets = extractArrayDeclarationStrings(swSource, "STATIC_ASSETS");
  const pageShellAssets = extractArrayDeclarationStrings(bootstrapSource, "PAGE_SHELL_ASSETS");
  const serverHashAssets = extractServerRuntimeHashAssets(serverRuntimeUtilsSource);
  return {
    root,
    shellCacheName: extractShellCacheName(swSource),
    clientBuildId: extractClientBuildId(bootstrapSource),
    indexScriptAssets,
    indexLinkAssets,
    swStaticAssets,
    pageShellAssets,
    serverHashAssets,
  };
}

export function validateShellAssetGraph(graph) {
  const issues = [];
  const indexScriptSet = new Set(graph.indexScriptAssets);
  const swStaticSet = new Set(graph.swStaticAssets);
  const pageShellSet = new Set(graph.pageShellAssets);
  const serverHashSet = new Set(graph.serverHashAssets);

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
      emittedAssets: assetRecords.length,
    },
    indexScriptAssets: graph.indexScriptAssets,
    indexLinkAssets: graph.indexLinkAssets,
    swStaticAssets: graph.swStaticAssets,
    pageShellAssets: graph.pageShellAssets,
    serverHashAssets: graph.serverHashAssets,
    assets: assetRecords,
    validation,
  };
}

function outputPathForAsset(assetPath) {
  if (assetPath === "/") return "shell-assets/index.html";
  return `shell-assets/${String(assetPath || "").replace(/^\/+/, "")}`;
}

export function createShellAssetGraphPlugin(options = {}) {
  const root = options.root || process.cwd();
  return {
    name: "codex-mobile-shell-asset-graph",
    generateBundle() {
      const manifest = buildShellAssetManifest(root);
      if (!manifest.validation.ok) {
        const codes = manifest.validation.issues.map((issue) => issue.code).join(", ");
        throw new Error(`codex_mobile_shell_asset_graph_invalid: ${codes}`);
      }
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
        source: `${JSON.stringify(manifest, null, 2)}\n`,
      });
    },
  };
}
