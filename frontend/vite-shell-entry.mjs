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
const deferredEntryTopologyPromise = import("./vite-deferred-entry-topology.mjs");
const entryGroupImportPromise = loadCodexMobileViteEntryGroups();
const entryDynamicImportGraph = {
  owner: "vite-shell-entry",
  deferredSources: ["frontend/vite-deferred-entry-topology.mjs"],
  entryGroupSources: codexMobileViteEntryGroupIds
    .map((groupId) => `virtual:codex-mobile-shell-entry-group/${groupId}`),
  expectedImportCount: 1 + codexMobileViteEntryGroupIds.length,
};

globalThis.__CODEX_MOBILE_VITE_SHELL_BUILD_STAGE__ = "entry-topology-v1";
globalThis.__CODEX_MOBILE_VITE_SHELL_ENTRY_TOPOLOGY__ = entryTopology;
globalThis.__CODEX_MOBILE_VITE_CLASSIC_COMPATIBILITY__ = classicCompatibility;
globalThis.__CODEX_MOBILE_VITE_DEFERRED_ENTRY_TOPOLOGY__ = deferredEntryTopologyPromise;
globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_OWNER__ = "vite-shell-entry";
globalThis.__CODEX_MOBILE_VITE_ENTRY_DYNAMIC_IMPORT_GRAPH__ = entryDynamicImportGraph;

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
