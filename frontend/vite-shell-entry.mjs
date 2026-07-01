import shellManifest from "../public/shell-asset-manifest.json";
import {
  codexMobileViteEntryGroupIds,
  loadCodexMobileViteEntryGroups,
} from "virtual:codex-mobile-shell-entry-group-loader";

// Vite build entrypoint.
//
// Production still loads the existing ordered classic scripts directly. This
// entry gives Vite a stable startup/deferred topology to validate before the
// production shell switches to bundled runtime chunks.

function compactEntryGroup(group) {
  return {
    id: group.id,
    phase: group.phase,
    startupCritical: Boolean(group.startupCritical),
    chunkTarget: group.chunkTarget,
    assets: Array.isArray(group.assets) ? group.assets.slice() : [],
  };
}

const entryGroups = Array.isArray(shellManifest.entryGroups)
  ? shellManifest.entryGroups.map(compactEntryGroup)
  : [];

const entryTopology = {
  shellCacheName: shellManifest.shellCacheName,
  clientBuildId: shellManifest.clientBuildId,
  startupGroups: entryGroups.filter((group) => group.startupCritical),
  deferredGroups: entryGroups.filter((group) => !group.startupCritical),
};
const classicGlobalExports = Array.isArray(shellManifest.classicGlobalExports)
  ? shellManifest.classicGlobalExports.map((entry) => ({
    asset: entry.asset,
    globals: Array.isArray(entry.globals) ? entry.globals.slice() : [],
  }))
  : [];
const startupGlobalContracts = Array.isArray(shellManifest.startupGlobalContracts)
  ? shellManifest.startupGlobalContracts.map((entry) => ({
    name: entry.name,
    asset: entry.asset,
    groupId: entry.groupId,
    startupCritical: Boolean(entry.startupCritical),
    source: entry.source,
  }))
  : [];
const classicGlobalNames = [...new Set(classicGlobalExports.flatMap((entry) => entry.globals))].sort();
const classicCompatibility = {
  schemaVersion: shellManifest.schemaVersion,
  shellCacheName: shellManifest.shellCacheName,
  clientBuildId: shellManifest.clientBuildId,
  assetCount: classicGlobalExports.length,
  globalCount: classicGlobalNames.length,
  requiredStartupGlobals: startupGlobalContracts.map((entry) => entry.name),
  startupGlobalContracts,
  classicGlobalExports,
};

function classicScriptAssets() {
  return entryGroups.flatMap((group) => Array.isArray(group.assets) ? group.assets : [])
    .filter((asset) => String(asset || "").startsWith("/"));
}

function isAppPreviewPage() {
  if (globalThis.document == null) return false;
  const documentElement = globalThis.document.documentElement;
  if (documentElement && documentElement.dataset && documentElement.dataset.codexViteAppPreview === "true") {
    return true;
  }
  return Boolean(globalThis.document.querySelector("meta[name='codex-vite-app-preview']"));
}

function loadClassicScript(assetPath) {
  return new Promise((resolve, reject) => {
    const document = globalThis.document;
    if (!document || !document.createElement) {
      reject(new Error("codex_mobile_vite_app_preview_document_missing"));
      return;
    }
    const script = document.createElement("script");
    script.src = assetPath;
    script.async = false;
    script.dataset.codexViteAppPreviewClassicScript = "true";
    script.onload = () => resolve(assetPath);
    script.onerror = () => reject(new Error(`codex_mobile_vite_app_preview_script_failed:${assetPath}`));
    (document.head || document.documentElement).appendChild(script);
  });
}

async function startCodexMobileViteAppPreview() {
  const assets = classicScriptAssets();
  const status = {
    ok: false,
    mode: "vite-app-preview",
    owner: "vite-shell-entry",
    scriptCount: assets.length,
    loaded: [],
    failed: [],
    startedAt: Date.now(),
    completedAt: 0,
  };
  globalThis.__CODEX_MOBILE_VITE_APP_PREVIEW__ = status;
  try {
    for (const asset of assets) {
      await loadClassicScript(asset);
      status.loaded.push(asset);
    }
    status.ok = true;
  } catch (error) {
    status.ok = false;
    status.failed.push(String(error && error.message || error || "script_failed"));
    throw error;
  } finally {
    status.completedAt = Date.now();
  }
  return {
    ok: status.ok,
    mode: status.mode,
    owner: status.owner,
    scriptCount: status.scriptCount,
    loadedCount: status.loaded.length,
    failedCount: status.failed.length,
  };
}

const deferredEntryTopologyPromise = import("./vite-deferred-entry-topology.mjs");
const entryGroupImportPromise = loadCodexMobileViteEntryGroups();
const entryDynamicImportGraph = {
  owner: "vite-shell-entry",
  deferredSources: ["frontend/vite-deferred-entry-topology.mjs"],
  entryGroupSources: codexMobileViteEntryGroupIds
    .map((groupId) => `virtual:codex-mobile-shell-entry-group/${groupId}`),
  expectedImportCount: 1 + codexMobileViteEntryGroupIds.length,
};
const appPreviewPromise = isAppPreviewPage() ? startCodexMobileViteAppPreview() : Promise.resolve(null);

globalThis.__CODEX_MOBILE_VITE_SHELL_BUILD_STAGE__ = "entry-topology-v1";
globalThis.__CODEX_MOBILE_VITE_SHELL_ENTRY_TOPOLOGY__ = entryTopology;
globalThis.__CODEX_MOBILE_VITE_CLASSIC_COMPATIBILITY__ = classicCompatibility;
globalThis.__CODEX_MOBILE_VITE_DEFERRED_ENTRY_TOPOLOGY__ = deferredEntryTopologyPromise;
globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_OWNER__ = "vite-shell-entry";
globalThis.__CODEX_MOBILE_VITE_ENTRY_DYNAMIC_IMPORT_GRAPH__ = entryDynamicImportGraph;
globalThis.__CODEX_MOBILE_VITE_APP_PREVIEW_PROMISE__ = appPreviewPromise;

export function codexMobileShellEntryTopology() {
  return entryTopology;
}

export function loadCodexMobileDeferredEntryTopology() {
  return deferredEntryTopologyPromise;
}

export function codexMobileClassicCompatibility() {
  return classicCompatibility;
}

export function codexMobileEntryGroupImportIds() {
  return codexMobileViteEntryGroupIds.slice();
}

export function codexMobileEntryDynamicImportGraph() {
  return {
    ...entryDynamicImportGraph,
    deferredSources: entryDynamicImportGraph.deferredSources.slice(),
    entryGroupSources: entryDynamicImportGraph.entryGroupSources.slice(),
  };
}

export function loadCodexMobileEntryGroupChunks() {
  return entryGroupImportPromise;
}

export function loadCodexMobileViteAppPreview() {
  return appPreviewPromise;
}
