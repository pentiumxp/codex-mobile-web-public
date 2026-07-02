const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/shard-01-B0NR4oVA.js","assets/vite-shell-entry-4WUavjDd.js","assets/shard-02-BT1ALv26.js","assets/shard-03-BmbI5Xs0.js","assets/shard-04-D2_QQmoF.js"])))=>i.map(i=>d[i]);
import { t as __vitePreload } from "./vite-shell-entry-4WUavjDd.js";
//#region \0virtual:codex-mobile-esm-compatibility
var codexMobileViteEsmCompatibilityShardSources = [
	{
		"id": "shard-01",
		"index": 0,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-01",
		"moduleCount": 10,
		"moduleIds": [
			"build-refresh-policy",
			"runtime-settings",
			"viewport-metrics",
			"conversation-scroll",
			"thread-performance-metrics",
			"thread-detail-state",
			"thread-detail-render-plan",
			"thread-detail-dom-patch",
			"draft-store",
			"image-compressor"
		],
		"byteCount": 218081
	},
	{
		"id": "shard-02",
		"index": 1,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-02",
		"moduleCount": 12,
		"moduleIds": [
			"plugin-voice-input",
			"api-client",
			"markdown-renderer",
			"plugin-embed",
			"frontend-runtime-health",
			"home-ai-diagnostic-reporting",
			"thread-diagnostic-events",
			"thread-tile-layout",
			"thread-tile-actions",
			"app-update-runtime",
			"modal-runtime",
			"runtime-wiring-runtime"
		],
		"byteCount": 210891
	},
	{
		"id": "shard-03",
		"index": 2,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-03",
		"moduleCount": 11,
		"moduleIds": [
			"thread-list-runtime",
			"side-chat-runtime",
			"composer-bridge-runtime",
			"api-client-runtime",
			"thread-list-load-policy",
			"thread-list-stable-order",
			"thread-status-hints",
			"thread-detail-patch-plan",
			"thread-detail-actions",
			"thread-detail-merge-state",
			"thread-detail-v4-merge-state"
		],
		"byteCount": 219823
	},
	{
		"id": "shard-04",
		"index": 3,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-04",
		"moduleCount": 3,
		"moduleIds": [
			"thread-detail-runtime",
			"client-render-stability-guard",
			"live-operation-dock-state"
		],
		"byteCount": 66246
	}
];
var shardLoaders = {
	"shard-01": () => __vitePreload(() => import("./shard-01-B0NR4oVA.js"), __vite__mapDeps([0,1])),
	"shard-02": () => __vitePreload(() => import("./shard-02-BT1ALv26.js"), __vite__mapDeps([2,1])),
	"shard-03": () => __vitePreload(() => import("./shard-03-BmbI5Xs0.js"), __vite__mapDeps([3,1])),
	"shard-04": () => __vitePreload(() => import("./shard-04-D2_QQmoF.js"), __vite__mapDeps([4,1]))
};
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
