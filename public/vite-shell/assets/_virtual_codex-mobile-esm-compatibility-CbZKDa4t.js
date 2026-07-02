const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/shard-01-B_VN6OGm.js","assets/vite-shell-entry-CReVITcv.js"])))=>i.map(i=>d[i]);
import { t as __vitePreload } from "./vite-shell-entry-CReVITcv.js";
//#region \0virtual:codex-mobile-esm-compatibility
var codexMobileViteEsmCompatibilityShardSources = [{
	"id": "shard-01",
	"index": 0,
	"source": "virtual:codex-mobile-esm-compatibility/shard/shard-01",
	"moduleCount": 14,
	"moduleIds": [
		"build-refresh-policy",
		"runtime-settings",
		"viewport-metrics",
		"conversation-scroll",
		"draft-store",
		"thread-tile-layout",
		"thread-tile-actions",
		"thread-list-load-policy",
		"thread-list-stable-order",
		"thread-status-hints",
		"thread-detail-patch-plan",
		"thread-detail-merge-state",
		"client-render-stability-guard",
		"live-operation-dock-state"
	],
	"byteCount": 86463
}];
var shardLoaders = { "shard-01": () => __vitePreload(() => import("./shard-01-B_VN6OGm.js"), __vite__mapDeps([0,1])) };
var compatibilityPromise = null;
async function loadCompatibilityShard(descriptor) {
	const load = shardLoaders[descriptor.id];
	if (typeof load !== "function") throw new Error(`codex_mobile_vite_esm_compatibility_shard_loader_missing:${descriptor.id}`);
	const module = await load();
	const createCompatibility = module && typeof module.codexMobileViteEsmCompatibility === "function" ? module.codexMobileViteEsmCompatibility : module && typeof module.default === "function" ? module.default : null;
	if (!createCompatibility) throw new Error(`codex_mobile_vite_esm_compatibility_shard_factory_missing:${descriptor.id}`);
	const payload = await createCompatibility();
	return {
		descriptor,
		payload: payload && typeof payload === "object" ? payload : {}
	};
}
async function codexMobileViteEsmCompatibility() {
	if (!compatibilityPromise) compatibilityPromise = Promise.all(codexMobileViteEsmCompatibilityShardSources.map(loadCompatibilityShard)).then((records) => {
		const orderedRecords = records.slice().sort((left, right) => left.descriptor.index - right.descriptor.index);
		const modules = orderedRecords.flatMap((record) => Array.isArray(record.payload.modules) ? record.payload.modules : []);
		const shardSummaries = orderedRecords.map((record) => ({
			id: record.descriptor.id,
			index: record.descriptor.index,
			source: record.descriptor.source,
			moduleCount: Number(record.payload.moduleCount) || 0,
			readyCount: Number(record.payload.readyCount) || 0,
			moduleIds: Array.isArray(record.descriptor.moduleIds) ? record.descriptor.moduleIds.slice() : [],
			byteCount: Number(record.descriptor.byteCount) || 0
		}));
		const compatibility = {
			schemaVersion: 1,
			owner: "vite-shell-entry",
			loading: false,
			shardCount: shardSummaries.length,
			shards: shardSummaries,
			moduleCount: modules.length,
			readyCount: modules.filter((entry) => entry && entry.ready === true).length,
			modules
		};
		if (typeof globalThis !== "undefined") globalThis.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY_SHARDS__ = shardSummaries;
		return compatibility;
	});
	return compatibilityPromise;
}
//#endregion
export { codexMobileViteEsmCompatibility, codexMobileViteEsmCompatibility as default, codexMobileViteEsmCompatibilityShardSources };
