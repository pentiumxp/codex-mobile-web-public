import shellManifest from "virtual:codex-mobile-shell-build-manifest";

function deferredEntryGroups() {
  return (Array.isArray(shellManifest.entryGroups) ? shellManifest.entryGroups : [])
    .filter((group) => group && !group.startupCritical)
    .map((group) => ({
      id: group.id,
      phase: group.phase,
      chunkTarget: group.chunkTarget,
      assets: Array.isArray(group.assets) ? group.assets.slice() : [],
    }));
}

export const codexMobileDeferredEntryGroups = deferredEntryGroups();
export const codexMobileDeferredEntryAssets = codexMobileDeferredEntryGroups
  .flatMap((group) => group.assets);
