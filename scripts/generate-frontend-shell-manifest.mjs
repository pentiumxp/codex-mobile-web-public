import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

export const SHELL_MANIFEST_SCHEMA_VERSION = 4;
export const SHELL_CACHE_NAME_BASE = "codex-mobile-shell-v625";
export const SHELL_SCRIPT_BLOCK_START = "<!-- CODEX_MOBILE_SHELL_SCRIPTS:BEGIN -->";
export const SHELL_SCRIPT_BLOCK_END = "<!-- CODEX_MOBILE_SHELL_SCRIPTS:END -->";

const SHELL_ENTRY_GROUP_DEFINITIONS = [
  {
    id: "manifest",
    phase: "startup-manifest",
    startupCritical: true,
    chunkTarget: "startup-manifest",
    assets: [
      "/shell-asset-manifest.js",
    ],
  },
  {
    id: "foundation",
    phase: "startup-prerequisite",
    startupCritical: true,
    chunkTarget: "startup-foundation",
    assets: [
      "/api-client.js",
      "/runtime-settings.js",
      "/draft-store.js",
      "/composer-runtime.js",
      "/markdown-renderer.js",
      "/viewport-metrics.js",
      "/conversation-scroll.js",
      "/image-compressor.js",
      "/plugin-embed.js",
      "/plugin-voice-input.js",
      "/home-ai-diagnostic-reporting.js",
      "/thread-diagnostic-events.js",
      "/frontend-runtime-health.js",
      "/thread-status-hints.js",
      "/thread-performance-metrics.js",
      "/thread-list-load-policy.js",
      "/thread-list-stable-order.js",
    ],
  },
  {
    id: "feature-runtimes",
    phase: "classic-runtime",
    startupCritical: false,
    chunkTarget: "deferred-feature-runtimes",
    assets: [
      "/thread-list-runtime.js",
      "/client-render-stability-guard.js",
      "/live-operation-dock-state.js",
      "/thread-detail-state.js",
      "/thread-detail-render-plan.js",
      "/thread-detail-merge-state.js",
      "/thread-detail-v4-merge-state.js",
      "/thread-detail-runtime.js",
      "/thread-detail-patch-plan.js",
      "/thread-detail-dom-patch.js",
      "/thread-detail-actions.js",
      "/thread-tile-actions.js",
      "/thread-tile-state.js",
      "/thread-tile-layout.js",
      "/thread-tile-runtime.js",
      "/build-refresh-policy.js",
      "/app-update-runtime.js",
      "/side-chat-runtime.js",
      "/media-preview-runtime.js",
    ],
  },
  {
    id: "bootstrap-state",
    phase: "startup-critical",
    startupCritical: true,
    chunkTarget: "startup-bootstrap",
    assets: [
      "/app-bootstrap.js",
    ],
  },
  {
    id: "shell-services",
    phase: "classic-runtime",
    startupCritical: false,
    chunkTarget: "deferred-shell-services",
    assets: [
      "/settings-runtime.js",
      "/modal-runtime.js",
      "/navigation-runtime.js",
      "/api-client-runtime.js",
      "/notification-ui-runtime.js",
      "/pane-layout-runtime.js",
      "/task-card-runtime.js",
      "/conversation-render-runtime.js",
      "/event-stream-runtime.js",
      "/composer-bridge-runtime.js",
    ],
  },
  {
    id: "app-entry",
    phase: "startup-critical",
    startupCritical: true,
    chunkTarget: "startup-app-shell",
    assets: [
      "/runtime-wiring-runtime.js",
      "/app-shell-runtime.js",
      "/app.js",
    ],
  },
];

function readText(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function writeText(filePath, value) {
  fs.writeFileSync(filePath, value, "utf8");
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

export function extractExternalScriptSrcs(indexHtml) {
  const values = [];
  const pattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi;
  let match;
  while ((match = pattern.exec(indexHtml))) {
    const src = String(match[1] || "").trim();
    if (src && src.startsWith("/")) values.push(src);
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

function iconAssetsFromManifest(root) {
  try {
    const manifest = JSON.parse(readText(root, "public/manifest.json"));
    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
    return uniqueValues(icons.map((icon) => icon && icon.src).filter((src) => String(src || "").startsWith("/")));
  } catch (_) {
    return [];
  }
}

function packageVersion(root) {
  try {
    const pkg = JSON.parse(readText(root, "package.json"));
    return String(pkg.version || "0.0.0");
  } catch (_) {
    return "0.0.0";
  }
}

function assetFilePath(root, assetPath) {
  if (assetPath === "/") return path.join(root, "public", "index.html");
  const normalized = String(assetPath || "").replace(/^\/+/, "");
  return normalized ? path.join(root, "public", normalized) : "";
}

function shellCacheContentHash(root, assets, appVersion) {
  const hash = crypto.createHash("sha256");
  hash.update(`schema=${SHELL_MANIFEST_SCHEMA_VERSION}\n`);
  hash.update(`app=${appVersion}\n`);
  for (const asset of uniqueValues(assets)) {
    if (asset === "/shell-asset-manifest.js" || asset === "/shell-asset-manifest.json") continue;
    const filePath = assetFilePath(root, asset);
    hash.update(`asset=${asset}\n`);
    try {
      hash.update(fs.readFileSync(filePath));
    } catch (_) {
      hash.update("missing\n");
    }
    hash.update("\n");
  }
  return hash.digest("hex").slice(0, 12);
}

export function shellCacheNameForAssets(root, assets, appVersion = packageVersion(root)) {
  return `${SHELL_CACHE_NAME_BASE}-${shellCacheContentHash(root, assets, appVersion)}`;
}

function normalizeShellCacheIdentity(identity, appVersion, classicShellCacheName) {
  if (!identity || typeof identity !== "object") return null;
  const shellCacheName = String(identity.shellCacheName || "").trim();
  const clientBuildId = String(identity.clientBuildId || "").trim();
  const viteArtifactCache = identity.viteArtifactCache && typeof identity.viteArtifactCache === "object"
    ? identity.viteArtifactCache
    : null;
  if (!shellCacheName || !clientBuildId || !viteArtifactCache) return null;
  if (clientBuildId !== `${appVersion}|${shellCacheName}`) return null;
  if (String(viteArtifactCache.baseShellCacheName || "") !== classicShellCacheName) return null;
  return {
    shellCacheName,
    clientBuildId,
    viteArtifactCache,
  };
}

function existingShellCacheIdentity(root, appVersion, classicShellCacheName) {
  try {
    const manifest = JSON.parse(readText(root, "public/shell-asset-manifest.json"));
    return normalizeShellCacheIdentity(manifest, appVersion, classicShellCacheName);
  } catch (_) {
    return null;
  }
}

function assertAssetsExist(root, assets) {
  const missing = [];
  for (const asset of uniqueValues(assets)) {
    if (asset === "/shell-asset-manifest.js" || asset === "/shell-asset-manifest.json") continue;
    const filePath = assetFilePath(root, asset);
    if (!filePath || !fs.existsSync(filePath)) missing.push(asset);
  }
  if (missing.length) {
    throw new Error(`shell_manifest_missing_assets:${missing.join(",")}`);
  }
}

function extractClassicGlobalExports(source) {
  const names = new Set();
  const pattern = /(?:root|window|globalThis|globalScope)\.(Codex[A-Za-z0-9_]+)\s*=/g;
  let match;
  while ((match = pattern.exec(String(source || "")))) {
    names.add(match[1]);
  }
  return [...names].sort();
}

function extractClassicTopLevelScriptGlobals(source) {
  const names = new Set();
  const pattern = /^(?:var|function|async\s+function)\s+([$A-Za-z_][0-9A-Za-z_$]*)(?=\s|=|\()/gm;
  let match;
  while ((match = pattern.exec(String(source || "")))) {
    names.add(match[1]);
  }
  return [...names].sort();
}

function extractStartupWindowGuardGlobals(source) {
  const names = new Set();
  const variableGuardPattern = /var\s+([A-Za-z0-9_]+)\s*=\s*window\.(Codex[A-Za-z0-9_]+)\s*;[\s\S]{0,320}?if\s*\(\s*!\s*\1\b/g;
  let match;
  while ((match = variableGuardPattern.exec(String(source || "")))) {
    names.add(match[2]);
  }
  const directGuardPattern = /if\s*\(\s*!\s*window\.(Codex[A-Za-z0-9_]+)\b/g;
  while ((match = directGuardPattern.exec(String(source || "")))) {
    names.add(match[1]);
  }
  const directFactoryPattern = /window\.(Codex[A-Za-z0-9_]+)\.(?:create[A-Za-z0-9_]+)\s*\(/g;
  while ((match = directFactoryPattern.exec(String(source || "")))) {
    names.add(match[1]);
  }
  return [...names].sort();
}

function sourceExists(root, relativePath) {
  try {
    return fs.existsSync(path.join(root, relativePath));
  } catch (_) {
    return false;
  }
}

function startupGlobalSourceFiles(root) {
  return [
    "public/app-bootstrap.js",
    "public/runtime-wiring-runtime.js",
    "public/app.js",
  ].filter((relativePath) => sourceExists(root, relativePath));
}

function startupWindowGuardGlobals(root) {
  const names = new Set();
  for (const relativePath of startupGlobalSourceFiles(root)) {
    for (const name of extractStartupWindowGuardGlobals(readText(root, relativePath))) {
      names.add(name);
    }
  }
  return [...names].sort();
}

function appBootstrapScriptGlobals(root) {
  try {
    return extractClassicTopLevelScriptGlobals(readText(root, "public/app-bootstrap.js"));
  } catch (_) {
    return [];
  }
}

function startupRequiredGlobalEntries(root, classicGlobalExports = []) {
  const byName = new Map();
  const exportedAssetSet = new Set((Array.isArray(classicGlobalExports) ? classicGlobalExports : [])
    .map((entry) => String(entry && entry.asset || ""))
    .filter(Boolean));
  for (const name of startupWindowGuardGlobals(root)) {
    byName.set(name, { name, source: "startup-window-guard" });
  }
  if (exportedAssetSet.has("/app-bootstrap.js")) {
    for (const name of appBootstrapScriptGlobals(root)) {
      if (!byName.has(name)) {
        byName.set(name, { name, source: "app-bootstrap-script-global" });
      }
    }
  }
  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function classicGlobalExportsForAsset(root, assetPath) {
  const normalized = String(assetPath || "").replace(/^\/+/, "");
  if (!normalized || !normalized.endsWith(".js")) return null;
  let source = "";
  try {
    source = readText(root, path.join("public", normalized));
  } catch (_) {
    source = "";
  }
  const globals = new Set(extractClassicGlobalExports(source));
  if (assetPath === "/app-bootstrap.js") {
    for (const name of extractClassicTopLevelScriptGlobals(source)) globals.add(name);
  }
  const orderedGlobals = [...globals].sort();
  if (!orderedGlobals.length) return null;
  return {
    asset: assetPath,
    globals: orderedGlobals,
  };
}

function buildClassicGlobalExports(root, scriptAssets) {
  return scriptAssets
    .map((asset) => classicGlobalExportsForAsset(root, asset))
    .filter(Boolean);
}

function buildEntryGroups(scriptAssets) {
  const scripts = uniqueValues(scriptAssets);
  const knownAssets = new Set(SHELL_ENTRY_GROUP_DEFINITIONS.flatMap((definition) => definition.assets));
  const hasUnknownAsset = scripts.some((asset) => !knownAssets.has(asset));
  if (hasUnknownAsset) {
    return [
      {
        id: "ordered-classic-scripts",
        phase: "compatibility",
        startupCritical: true,
        chunkTarget: "ordered-classic-scripts",
        assets: scripts,
      },
    ];
  }
  const scriptSet = new Set(scripts);
  const groups = SHELL_ENTRY_GROUP_DEFINITIONS.map((definition) => {
    const assets = uniqueValues(definition.assets);
    const missing = assets.filter((asset) => !scriptSet.has(asset));
    if (missing.length) {
      throw new Error(`shell_entry_group_missing_scripts:${definition.id}:${missing.join(",")}`);
    }
    return {
      id: definition.id,
      phase: definition.phase,
      startupCritical: Boolean(definition.startupCritical),
      chunkTarget: definition.chunkTarget,
      assets,
    };
  });
  const groupedAssets = groups.flatMap((group) => group.assets);
  if (JSON.stringify(groupedAssets) !== JSON.stringify(scripts)) {
    throw new Error("shell_entry_group_order_mismatch");
  }
  return groups;
}

function groupByAsset(entryGroups) {
  const map = new Map();
  for (const group of Array.isArray(entryGroups) ? entryGroups : []) {
    for (const asset of Array.isArray(group && group.assets) ? group.assets : []) {
      map.set(asset, group);
    }
  }
  return map;
}

function buildStartupGlobalContracts(root, entryGroups, classicGlobalExports) {
  const exportsByGlobal = new Map();
  for (const entry of Array.isArray(classicGlobalExports) ? classicGlobalExports : []) {
    for (const name of Array.isArray(entry && entry.globals) ? entry.globals : []) {
      exportsByGlobal.set(name, entry);
    }
  }
  const groupsByAsset = groupByAsset(entryGroups);
  return startupRequiredGlobalEntries(root, classicGlobalExports).map((contract) => {
    const name = contract.name;
    const exportEntry = exportsByGlobal.get(name);
    const asset = exportEntry ? String(exportEntry.asset || "") : "";
    const group = groupsByAsset.get(asset) || {};
    return {
      name,
      asset,
      groupId: String(group.id || ""),
      startupCritical: Boolean(group.startupCritical),
      source: contract.source,
      present: Boolean(exportEntry && asset),
    };
  });
}

export function canonicalShellScriptAssets() {
  return uniqueValues(SHELL_ENTRY_GROUP_DEFINITIONS.flatMap((definition) => definition.assets));
}

export function buildPublicShellManifest(root = process.cwd(), options = {}) {
  const indexHtml = readText(root, "public/index.html");
  const appVersion = packageVersion(root);
  const hasGeneratedScriptBlock = indexHtml.includes(SHELL_SCRIPT_BLOCK_START)
    && indexHtml.includes(SHELL_SCRIPT_BLOCK_END);
  const scriptAssets = hasGeneratedScriptBlock ? canonicalShellScriptAssets() : extractExternalScriptSrcs(indexHtml);
  const entryGroups = buildEntryGroups(scriptAssets);
  const linkAssets = extractLinkHrefs(indexHtml);
  const iconAssets = uniqueValues([
    ...linkAssets.filter((asset) => asset.startsWith("/icons/")),
    ...iconAssetsFromManifest(root),
  ]);
  const baseAssets = uniqueValues([
    "/",
    "/index.html",
    ...linkAssets,
    "/manifest.json",
    ...iconAssets,
    ...scriptAssets,
    "/shell-asset-manifest.json",
  ]);
  const precacheAssets = uniqueValues(baseAssets.filter((asset) => asset !== "/sw.js"));
  const pageShellAssets = uniqueValues([
    ...precacheAssets,
    "/sw.js",
  ]);
  const hashAssets = uniqueValues([
    "/index.html",
    ...linkAssets,
    "/manifest.json",
    ...iconAssets,
    ...scriptAssets,
    "/shell-asset-manifest.json",
    "/sw.js",
  ]);
  assertAssetsExist(root, pageShellAssets);
  const classicShellCacheName = shellCacheNameForAssets(root, hashAssets, appVersion);
  const useExistingViteArtifactCache = options.useExistingViteArtifactCache !== false;
  const cacheIdentity = normalizeShellCacheIdentity(options.cacheIdentity, appVersion, classicShellCacheName)
    || (useExistingViteArtifactCache ? existingShellCacheIdentity(root, appVersion, classicShellCacheName) : null);
  const shellCacheName = cacheIdentity ? cacheIdentity.shellCacheName : classicShellCacheName;
  const classicGlobalExports = buildClassicGlobalExports(root, scriptAssets);
  const startupGlobalContracts = buildStartupGlobalContracts(root, entryGroups, classicGlobalExports);
  const missingStartupGlobals = startupGlobalContracts
    .filter((entry) => !entry.present)
    .map((entry) => entry.name);
  if (missingStartupGlobals.length) {
    throw new Error(`shell_startup_globals_missing:${missingStartupGlobals.join(",")}`);
  }
  return {
    schemaVersion: SHELL_MANIFEST_SCHEMA_VERSION,
    generatedBy: "generate-frontend-shell-manifest",
    shellCacheName,
    clientBuildId: `${appVersion}|${shellCacheName}`,
    classicShellCacheName,
    ...(cacheIdentity ? { viteArtifactCache: cacheIdentity.viteArtifactCache } : {}),
    scriptAssets,
    entryGroups,
    classicGlobalExports,
    startupGlobalContracts,
    linkAssets,
    iconAssets,
    precacheAssets,
    pageShellAssets,
    hashAssets,
    counts: {
      scriptAssets: scriptAssets.length,
      entryGroups: entryGroups.length,
      classicGlobalExportAssets: classicGlobalExports.length,
      classicGlobalExports: classicGlobalExports.reduce((total, entry) => total + entry.globals.length, 0),
      startupGlobalContracts: startupGlobalContracts.length,
      linkAssets: linkAssets.length,
      iconAssets: iconAssets.length,
      precacheAssets: precacheAssets.length,
      pageShellAssets: pageShellAssets.length,
      hashAssets: hashAssets.length,
    },
  };
}

export function renderShellScriptBlock(scriptAssets) {
  return [
    SHELL_SCRIPT_BLOCK_START,
    ...scriptAssets.map((asset) => `  <script src="${asset}"></script>`),
    SHELL_SCRIPT_BLOCK_END,
  ].join("\n");
}

export function generatedIndexHtmlSource(indexHtml, manifest) {
  const startIndex = indexHtml.indexOf(SHELL_SCRIPT_BLOCK_START);
  const endIndex = indexHtml.indexOf(SHELL_SCRIPT_BLOCK_END);
  if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
    throw new Error("shell_script_block_markers_missing");
  }
  const blockEndIndex = endIndex + SHELL_SCRIPT_BLOCK_END.length;
  const generatedBlock = renderShellScriptBlock(manifest.scriptAssets);
  return [
    indexHtml.slice(0, startIndex).replace(/\s+$/, ""),
    generatedBlock,
    indexHtml.slice(blockEndIndex).replace(/^\s+/, "\n"),
  ].join("\n");
}

function manifestJsonSource(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function manifestJsSource(manifest) {
  return [
    "\"use strict\";",
    "",
    "(function (root) {",
    `  var manifest = ${JSON.stringify(manifest, null, 2).replace(/\n/g, "\n  ")};`,
    "  root.CODEX_MOBILE_SHELL_MANIFEST = manifest;",
    "}(typeof globalThis !== \"undefined\" ? globalThis : this));",
    "",
  ].join("\n");
}

export function generatedManifestFiles(root = process.cwd(), options = {}) {
  const manifest = buildPublicShellManifest(root, options);
  const indexHtmlPath = path.join(root, "public", "index.html");
  const indexHtml = fs.readFileSync(indexHtmlPath, "utf8");
  return {
    manifest,
    files: [
      {
        path: indexHtmlPath,
        source: generatedIndexHtmlSource(indexHtml, manifest),
      },
      {
        path: path.join(root, "public", "shell-asset-manifest.json"),
        source: manifestJsonSource(manifest),
      },
      {
        path: path.join(root, "public", "shell-asset-manifest.js"),
        source: manifestJsSource(manifest),
      },
    ],
  };
}

export function writePublicShellManifest(root = process.cwd(), options = {}) {
  const generated = generatedManifestFiles(root, options);
  const mismatches = [];
  for (const file of generated.files) {
    const current = fs.existsSync(file.path) ? fs.readFileSync(file.path, "utf8") : "";
    if (current !== file.source) mismatches.push(path.relative(root, file.path));
    if (!options.check) writeText(file.path, file.source);
  }
  return {
    ok: mismatches.length === 0,
    mismatches,
    manifest: generated.manifest,
  };
}

function runCli() {
  const check = process.argv.includes("--check");
  const result = writePublicShellManifest(process.cwd(), { check });
  if (check && !result.ok) {
    console.error(`frontend shell manifest out of date: ${result.mismatches.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({
    ok: true,
    check,
    shellCacheName: result.manifest.shellCacheName,
    clientBuildId: result.manifest.clientBuildId,
    scriptAssets: result.manifest.counts.scriptAssets,
    pageShellAssets: result.manifest.counts.pageShellAssets,
    hashAssets: result.manifest.counts.hashAssets,
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
