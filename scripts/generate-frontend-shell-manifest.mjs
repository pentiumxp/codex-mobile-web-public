import fs from "node:fs";
import path from "node:path";

export const SHELL_MANIFEST_SCHEMA_VERSION = 2;
export const SHELL_CACHE_NAME = "codex-mobile-shell-v622";

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

export function buildPublicShellManifest(root = process.cwd()) {
  const indexHtml = readText(root, "public/index.html");
  const appVersion = packageVersion(root);
  const scriptAssets = extractExternalScriptSrcs(indexHtml);
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
  return {
    schemaVersion: SHELL_MANIFEST_SCHEMA_VERSION,
    generatedBy: "generate-frontend-shell-manifest",
    shellCacheName: SHELL_CACHE_NAME,
    clientBuildId: `${appVersion}|${SHELL_CACHE_NAME}`,
    scriptAssets,
    linkAssets,
    iconAssets,
    precacheAssets,
    pageShellAssets,
    hashAssets,
    counts: {
      scriptAssets: scriptAssets.length,
      linkAssets: linkAssets.length,
      iconAssets: iconAssets.length,
      precacheAssets: precacheAssets.length,
      pageShellAssets: pageShellAssets.length,
      hashAssets: hashAssets.length,
    },
  };
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
  return {
    manifest,
    files: [
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
