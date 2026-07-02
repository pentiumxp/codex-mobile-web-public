const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/shard-01-5ap85Qhd.js","assets/vite-shell-entry-C_fqZHha.js","assets/shard-02-yTXt-NHu.js","assets/shard-03-DKxTxnbN.js","assets/shard-04-0N5ZvOKG.js","assets/shard-05-i_kwla1c.js","assets/shard-06-LkrqoKZj.js","assets/shard-07-Dpt8USGV.js"])))=>i.map(i=>d[i]);
import { t as __vitePreload } from "./vite-shell-entry-C_fqZHha.js";
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
		"moduleCount": 10,
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
			"thread-tile-state"
		],
		"byteCount": 210575
	},
	{
		"id": "shard-03",
		"index": 2,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-03",
		"moduleCount": 3,
		"moduleIds": [
			"thread-tile-runtime",
			"app-update-runtime",
			"settings-runtime"
		],
		"byteCount": 220585
	},
	{
		"id": "shard-04",
		"index": 3,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-04",
		"moduleCount": 5,
		"moduleIds": [
			"modal-runtime",
			"navigation-runtime",
			"runtime-wiring-runtime",
			"thread-list-runtime",
			"side-chat-runtime"
		],
		"byteCount": 188160
	},
	{
		"id": "shard-05",
		"index": 4,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-05",
		"moduleCount": 9,
		"moduleIds": [
			"media-preview-runtime",
			"composer-bridge-runtime",
			"api-client-runtime",
			"thread-list-load-policy",
			"thread-list-stable-order",
			"thread-status-hints",
			"thread-detail-patch-plan",
			"thread-detail-actions",
			"thread-detail-merge-state"
		],
		"byteCount": 213699
	},
	{
		"id": "shard-06",
		"index": 5,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-06",
		"moduleCount": 4,
		"moduleIds": [
			"thread-detail-v4-merge-state",
			"thread-detail-runtime",
			"task-card-runtime",
			"notification-ui-runtime"
		],
		"byteCount": 188766
	},
	{
		"id": "shard-07",
		"index": 6,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-07",
		"moduleCount": 4,
		"moduleIds": [
			"conversation-render-runtime",
			"event-stream-runtime",
			"client-render-stability-guard",
			"live-operation-dock-state"
		],
		"byteCount": 141e3
	}
];
var shardLoaders = {
	"shard-01": () => __vitePreload(() => import("./shard-01-5ap85Qhd.js"), __vite__mapDeps([0,1])),
	"shard-02": () => __vitePreload(() => import("./shard-02-yTXt-NHu.js"), __vite__mapDeps([2,1])),
	"shard-03": () => __vitePreload(() => import("./shard-03-DKxTxnbN.js"), __vite__mapDeps([3,1])),
	"shard-04": () => __vitePreload(() => import("./shard-04-0N5ZvOKG.js"), __vite__mapDeps([4,1])),
	"shard-05": () => __vitePreload(() => import("./shard-05-i_kwla1c.js"), __vite__mapDeps([5,1])),
	"shard-06": () => __vitePreload(() => import("./shard-06-LkrqoKZj.js"), __vite__mapDeps([6,1])),
	"shard-07": () => __vitePreload(() => import("./shard-07-Dpt8USGV.js"), __vite__mapDeps([7,1]))
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
