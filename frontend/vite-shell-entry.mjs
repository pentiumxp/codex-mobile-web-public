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
const pendingEsmCompatibility = {
  schemaVersion: 1,
  owner: "vite-shell-entry",
  moduleCount: 0,
  readyCount: 0,
  modules: [],
  loading: true,
};
let esmCompatibility = pendingEsmCompatibility;

const esmCompatibilityImportPromise = import("virtual:codex-mobile-esm-compatibility")
  .then(async (module) => {
    const createCompatibility = module && typeof module.codexMobileViteEsmCompatibility === "function"
      ? module.codexMobileViteEsmCompatibility
      : null;
    if (!createCompatibility) {
      throw new Error("codex_mobile_vite_esm_compatibility_factory_missing");
    }
    esmCompatibility = await createCompatibility();
    globalThis.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY__ = esmCompatibility;
    return esmCompatibility;
  })
  .catch((error) => {
    esmCompatibility = {
      ...pendingEsmCompatibility,
      loading: false,
      failed: true,
      errorCode: String(error && error.message || error || "codex_mobile_vite_esm_compatibility_failed").slice(0, 160),
    };
    globalThis.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY__ = esmCompatibility;
    throw error;
  });

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
      sourceScriptCount: Number(plan.sourceScriptCount) || 0,
      scriptCount: Number(plan.scriptCount) || scripts.length,
      firstScript: String(plan.firstScript || ""),
      lastScript: String(plan.lastScript || ""),
      hashCount: Number(plan.hashCount) || scripts.filter((entry) => entry.sha256).length,
      byteCount: Number(plan.byteCount) || scripts.reduce((total, entry) => total + entry.bytes, 0),
      excludedEsmScriptCount: Number(plan.excludedEsmScriptCount) || 0,
      excludedEsmHashCount: Number(plan.excludedEsmHashCount) || 0,
      excludedEsmByteCount: Number(plan.excludedEsmByteCount) || 0,
      excludedEsmScripts: (Array.isArray(plan.excludedEsmScripts) ? plan.excludedEsmScripts : [])
        .map((entry) => ({
          index: Number(entry && entry.index) || 0,
          sourceIndex: Number(entry && entry.sourceIndex) || 0,
          path: String(entry && entry.path || ""),
          groupId: String(entry && entry.groupId || ""),
          phase: String(entry && entry.phase || ""),
          startupCritical: Boolean(entry && entry.startupCritical),
          chunkTarget: String(entry && entry.chunkTarget || ""),
          sourcePath: String(entry && entry.sourcePath || ""),
          bytes: Number(entry && entry.bytes) || 0,
          sha256: String(entry && entry.sha256 || ""),
          esmModuleId: String(entry && entry.esmModuleId || ""),
          globalName: String(entry && entry.globalName || ""),
        }))
        .filter((entry) => entry.path.startsWith("/")),
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
  const excludedEsmAssets = loaderPlan && Array.isArray(loaderPlan.excludedEsmScripts)
    ? loaderPlan.excludedEsmScripts.map((entry) => entry.path)
    : [];
  const coveredAssets = new Set([...assets, ...excludedEsmAssets]);
  const manifestCoverageMatches = manifestAssets.length > 0
    && coveredAssets.size === manifestAssets.length
    && JSON.stringify(manifestAssets.filter((asset) => coveredAssets.has(asset))) === JSON.stringify(manifestAssets);
  const status = {
    ok: false,
    mode: "vite-app-preview",
    owner: "vite-shell-entry",
    loaderPlanPresent: Boolean(loaderPlan),
    loaderPlanOwner: loaderPlan ? loaderPlan.owner : "",
    loaderPlanSource: loaderPlan ? loaderPlan.source : "",
    loaderPlanScriptCount: loaderPlan ? loaderPlan.scriptCount : 0,
    loaderPlanHashCount: loaderPlan ? loaderPlan.hashCount : 0,
    loaderPlanSourceScriptCount: loaderPlan ? loaderPlan.sourceScriptCount : 0,
    loaderPlanExcludedEsmScriptCount: loaderPlan ? loaderPlan.excludedEsmScriptCount : 0,
    loaderPlanExcludedEsmHashCount: loaderPlan ? loaderPlan.excludedEsmHashCount : 0,
    loaderPlanSha256: loaderPlan ? loaderPlan.sha256 : "",
    loaderPlanMatchesShellManifest: Boolean(loaderPlan) && manifestCoverageMatches,
    esmCompatibilityReady: false,
    excludedEsmGlobalMissing: [],
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
      || Number(loaderPlan.sourceScriptCount) !== manifestAssets.length
      || Number(loaderPlan.scriptCount) !== assets.length
      || Number(loaderPlan.hashCount) !== assets.length
      || Number(loaderPlan.excludedEsmScriptCount) !== excludedEsmAssets.length
      || Number(loaderPlan.excludedEsmHashCount) !== excludedEsmAssets.length
      || !manifestCoverageMatches) {
      throw new Error("codex_mobile_vite_app_preview_loader_plan_invalid");
    }
    const loadedEsmCompatibility = await esmCompatibilityImportPromise;
    status.esmCompatibilityReady = Boolean(loadedEsmCompatibility)
      && loadedEsmCompatibility.owner === "vite-shell-entry"
      && Number(loadedEsmCompatibility.moduleCount) === Number(loadedEsmCompatibility.readyCount);
    const missingExcludedGlobals = loaderPlan && Array.isArray(loaderPlan.excludedEsmScripts)
      ? loaderPlan.excludedEsmScripts
          .filter((entry) => !entry.globalName || !globalThis[entry.globalName])
          .map((entry) => entry.globalName || entry.path)
      : [];
    status.excludedEsmGlobalMissing = missingExcludedGlobals;
    if (missingExcludedGlobals.length) {
      throw new Error("codex_mobile_vite_app_preview_esm_globals_missing");
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
    loaderPlanSourceScriptCount: status.loaderPlanSourceScriptCount,
    loaderPlanExcludedEsmScriptCount: status.loaderPlanExcludedEsmScriptCount,
    loaderPlanExcludedEsmHashCount: status.loaderPlanExcludedEsmHashCount,
    loaderPlanSha256: status.loaderPlanSha256,
    loaderPlanMatchesShellManifest: status.loaderPlanMatchesShellManifest,
    esmCompatibilityReady: status.esmCompatibilityReady,
    excludedEsmGlobalMissingCount: status.excludedEsmGlobalMissing.length,
    scriptCount: status.scriptCount,
    loadedCount: status.loaded.length,
    failedCount: status.failed.length,
  };
}

const deferredEntryTopologyPromise = import("./vite-deferred-entry-topology.mjs");
const entryGroupImportPromise = loadCodexMobileViteEntryGroups();
const entryDynamicImportGraph = {
  owner: "vite-shell-entry",
  esmCompatibilitySources: ["virtual:codex-mobile-esm-compatibility"],
  deferredSources: ["frontend/vite-deferred-entry-topology.mjs"],
  entryGroupSources: codexMobileViteEntryGroupIds
    .map((groupId) => `virtual:codex-mobile-shell-entry-group/${groupId}`),
  expectedImportCount: 2 + codexMobileViteEntryGroupIds.length,
};
const appPreviewPromise = isAppPreviewPage() ? startCodexMobileViteAppPreview() : Promise.resolve(null);

globalThis.__CODEX_MOBILE_VITE_SHELL_BUILD_STAGE__ = "entry-topology-v1";
globalThis.__CODEX_MOBILE_VITE_SHELL_ENTRY_TOPOLOGY__ = entryTopology;
globalThis.__CODEX_MOBILE_VITE_CLASSIC_COMPATIBILITY__ = classicCompatibility;
globalThis.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY__ = esmCompatibility;
globalThis.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY_PROMISE__ = esmCompatibilityImportPromise;
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

export function codexMobileEsmCompatibility() {
  return {
    ...esmCompatibility,
    modules: esmCompatibility.modules.map((entry) => ({
      ...entry,
      exportedFunctions: entry.exportedFunctions.slice(),
    })),
  };
}

export function codexMobileEntryGroupImportIds() {
  return codexMobileViteEntryGroupIds.slice();
}

export function codexMobileEntryDynamicImportGraph() {
  return {
    ...entryDynamicImportGraph,
    esmCompatibilitySources: entryDynamicImportGraph.esmCompatibilitySources.slice(),
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
