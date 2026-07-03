const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/shard-01-D5p7Y9yl.js","assets/vite-shell-entry-Q-1cBquO.js","assets/shard-02-DUNxc7kJ.js","assets/shard-03--0TTD9BC.js","assets/shard-04-B28S-fX-.js","assets/shard-05-BJoVn5EI.js","assets/shard-06-Jekfwbvp.js","assets/shard-07-BFThCyIV.js","assets/shard-08-iIBGZebd.js","assets/shard-09-CLR5_1LW.js"])))=>i.map(i=>d[i]);
import { t as __vitePreload } from "./vite-shell-entry-Q-1cBquO.js";
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
		"byteCount": 218262
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
		"moduleCount": 4,
		"moduleIds": [
			"modal-runtime",
			"navigation-runtime",
			"runtime-wiring-runtime",
			"app-shell-runtime"
		],
		"byteCount": 141368
	},
	{
		"id": "shard-05",
		"index": 4,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-05",
		"moduleCount": 2,
		"moduleIds": ["pane-layout-runtime", "app-entry"],
		"byteCount": 212218
	},
	{
		"id": "shard-06",
		"index": 5,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-06",
		"moduleCount": 3,
		"moduleIds": [
			"thread-list-runtime",
			"side-chat-runtime",
			"media-preview-runtime"
		],
		"byteCount": 184245
	},
	{
		"id": "shard-07",
		"index": 6,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-07",
		"moduleCount": 10,
		"moduleIds": [
			"composer-runtime",
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
		"byteCount": 208756
	},
	{
		"id": "shard-08",
		"index": 7,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-08",
		"moduleCount": 3,
		"moduleIds": [
			"thread-detail-runtime",
			"task-card-runtime",
			"notification-ui-runtime"
		],
		"byteCount": 176695
	},
	{
		"id": "shard-09",
		"index": 8,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-09",
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
	"shard-01": () => __vitePreload(() => import("./shard-01-D5p7Y9yl.js"), __vite__mapDeps([0,1])),
	"shard-02": () => __vitePreload(() => import("./shard-02-DUNxc7kJ.js"), __vite__mapDeps([2,1])),
	"shard-03": () => __vitePreload(() => import("./shard-03--0TTD9BC.js"), __vite__mapDeps([3,1])),
	"shard-04": () => __vitePreload(() => import("./shard-04-B28S-fX-.js"), __vite__mapDeps([4,1])),
	"shard-05": () => __vitePreload(() => import("./shard-05-BJoVn5EI.js"), __vite__mapDeps([5,1])),
	"shard-06": () => __vitePreload(() => import("./shard-06-Jekfwbvp.js"), __vite__mapDeps([6,1])),
	"shard-07": () => __vitePreload(() => import("./shard-07-BFThCyIV.js"), __vite__mapDeps([7,1])),
	"shard-08": () => __vitePreload(() => import("./shard-08-iIBGZebd.js"), __vite__mapDeps([8,1])),
	"shard-09": () => __vitePreload(() => import("./shard-09-CLR5_1LW.js"), __vite__mapDeps([9,1]))
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
