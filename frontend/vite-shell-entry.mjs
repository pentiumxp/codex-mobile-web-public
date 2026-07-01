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
const classicGlobalNames = [...new Set(classicGlobalExports.flatMap((entry) => entry.globals))].sort();
const classicCompatibility = {
  schemaVersion: shellManifest.schemaVersion,
  shellCacheName: shellManifest.shellCacheName,
  clientBuildId: shellManifest.clientBuildId,
  assetCount: classicGlobalExports.length,
  globalCount: classicGlobalNames.length,
  requiredStartupGlobals: [
    "CodexRuntimeWiringRuntime",
    "CodexAppShellRuntime",
  ],
  classicGlobalExports,
};
const deferredEntryTopologyPromise = import("./vite-deferred-entry-topology.mjs");
const entryGroupImportPromise = loadCodexMobileViteEntryGroups();

globalThis.__CODEX_MOBILE_VITE_SHELL_BUILD_STAGE__ = "entry-topology-v1";
globalThis.__CODEX_MOBILE_VITE_SHELL_ENTRY_TOPOLOGY__ = entryTopology;
globalThis.__CODEX_MOBILE_VITE_CLASSIC_COMPATIBILITY__ = classicCompatibility;
globalThis.__CODEX_MOBILE_VITE_DEFERRED_ENTRY_TOPOLOGY__ = deferredEntryTopologyPromise;
globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_OWNER__ = "vite-shell-entry";

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

export function loadCodexMobileEntryGroupChunks() {
  return entryGroupImportPromise;
}
