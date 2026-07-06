import { n as shell_asset_manifest_default } from "./vite-shell-entry-CrwTmlx5.js";
//#region frontend/vite-deferred-entry-topology.mjs
function deferredEntryGroups() {
	return (Array.isArray(shell_asset_manifest_default.entryGroups) ? shell_asset_manifest_default.entryGroups : []).filter((group) => group && !group.startupCritical).map((group) => ({
		id: group.id,
		phase: group.phase,
		chunkTarget: group.chunkTarget,
		assets: Array.isArray(group.assets) ? group.assets.slice() : []
	}));
}
var codexMobileDeferredEntryGroups = deferredEntryGroups();
var codexMobileDeferredEntryAssets = codexMobileDeferredEntryGroups.flatMap((group) => group.assets);
//#endregion
export { codexMobileDeferredEntryAssets, codexMobileDeferredEntryGroups };
