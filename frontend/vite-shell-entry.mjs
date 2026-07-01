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

function shellManifestScriptAssets() {
  return entryGroups.flatMap((group) => Array.isArray(group.assets) ? group.assets : [])
    .filter((asset) => String(asset || "").startsWith("/"));
}

function readAppPreviewClassicLoaderPlan() {
  if (globalThis.document == null) return null;
  const node = globalThis.document.getElementById("codex-vite-app-preview-loader-plan");
  if (!node) return null;
  try {
    const plan = JSON.parse(node.textContent || "{}");
    const scripts = (Array.isArray(plan.scripts) ? plan.scripts : [])
      .map((entry) => ({
        index: Number(entry && entry.index) || 0,
        path: String(entry && entry.path || ""),
        groupId: String(entry && entry.groupId || ""),
        startupCritical: Boolean(entry && entry.startupCritical),
        bytes: Number(entry && entry.bytes) || 0,
        sha256: String(entry && entry.sha256 || ""),
      }))
      .filter((entry) => entry.path.startsWith("/"));
    return {
      schemaVersion: Number(plan.schemaVersion) || 1,
      source: String(plan.source || ""),
      owner: String(plan.owner || ""),
      scriptCount: Number(plan.scriptCount) || scripts.length,
      firstScript: String(plan.firstScript || ""),
      lastScript: String(plan.lastScript || ""),
      hashCount: Number(plan.hashCount) || scripts.filter((entry) => entry.sha256).length,
      byteCount: Number(plan.byteCount) || scripts.reduce((total, entry) => total + entry.bytes, 0),
      sha256: String(plan.sha256 || ""),
      scripts,
    };
  } catch (_) {
    return null;
  }
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
  const loaderPlan = readAppPreviewClassicLoaderPlan();
  const manifestAssets = shellManifestScriptAssets();
  const assets = loaderPlan && Array.isArray(loaderPlan.scripts)
    ? loaderPlan.scripts.map((entry) => entry.path)
    : [];
  const status = {
    ok: false,
    mode: "vite-app-preview",
    owner: "vite-shell-entry",
    loaderPlanPresent: Boolean(loaderPlan),
    loaderPlanOwner: loaderPlan ? loaderPlan.owner : "",
    loaderPlanSource: loaderPlan ? loaderPlan.source : "",
    loaderPlanScriptCount: loaderPlan ? loaderPlan.scriptCount : 0,
    loaderPlanHashCount: loaderPlan ? loaderPlan.hashCount : 0,
    loaderPlanSha256: loaderPlan ? loaderPlan.sha256 : "",
    loaderPlanMatchesShellManifest: Boolean(loaderPlan)
      && JSON.stringify(assets) === JSON.stringify(manifestAssets),
    scriptCount: assets.length,
    loaded: [],
    failed: [],
    startedAt: Date.now(),
    completedAt: 0,
  };
  globalThis.__CODEX_MOBILE_VITE_APP_PREVIEW__ = status;
  globalThis.__CODEX_MOBILE_VITE_APP_PREVIEW_LOADER_PLAN__ = loaderPlan;
  try {
    if (!loaderPlan) {
      throw new Error("codex_mobile_vite_app_preview_loader_plan_missing");
    }
    if (loaderPlan.owner !== "vite-shell-entry"
      || !loaderPlan.sha256
      || Number(loaderPlan.scriptCount) !== manifestAssets.length
      || Number(loaderPlan.hashCount) !== manifestAssets.length
      || JSON.stringify(assets) !== JSON.stringify(manifestAssets)) {
      throw new Error("codex_mobile_vite_app_preview_loader_plan_invalid");
    }
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
    loaderPlanPresent: status.loaderPlanPresent,
    loaderPlanScriptCount: status.loaderPlanScriptCount,
    loaderPlanHashCount: status.loaderPlanHashCount,
    loaderPlanSha256: status.loaderPlanSha256,
    loaderPlanMatchesShellManifest: status.loaderPlanMatchesShellManifest,
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
