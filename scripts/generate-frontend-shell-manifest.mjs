import fs from "node:fs";
import path from "node:path";

export const SHELL_MANIFEST_SCHEMA_VERSION = 3;
export const SHELL_CACHE_NAME = "codex-mobile-shell-v624";
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
  const pattern = /(?:root|window|globalThis)\.(Codex[A-Za-z0-9_]+)\s*=/g;
  let match;
  while ((match = pattern.exec(String(source || "")))) {
    names.add(match[1]);
  }
  return [...names].sort();
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
  const globals = extractClassicGlobalExports(source);
  if (!globals.length) return null;
  return {
    asset: assetPath,
    globals,
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

export function canonicalShellScriptAssets() {
  return uniqueValues(SHELL_ENTRY_GROUP_DEFINITIONS.flatMap((definition) => definition.assets));
}

export function buildPublicShellManifest(root = process.cwd()) {
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
  const classicGlobalExports = buildClassicGlobalExports(root, scriptAssets);
  return {
    schemaVersion: SHELL_MANIFEST_SCHEMA_VERSION,
    generatedBy: "generate-frontend-shell-manifest",
    shellCacheName: SHELL_CACHE_NAME,
    clientBuildId: `${appVersion}|${SHELL_CACHE_NAME}`,
    scriptAssets,
    entryGroups,
    classicGlobalExports,
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

export function generatedManifestFiles(root = process.cwd()) {
  const manifest = buildPublicShellManifest(root);
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
  const generated = generatedManifestFiles(root);
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
