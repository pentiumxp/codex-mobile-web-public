const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/shard-05-BND2iA4A.js","assets/vite-shell-entry-Cr5UJe6D.js","assets/shard-06-DGZx6w7b.js","assets/shard-07-DQOmsGXr.js","assets/shard-08-CgWL6F9M.js","assets/shard-09-BK3miMov.js"])))=>i.map(i=>d[i]);
import { t as __vitePreload } from "./vite-shell-entry-Cr5UJe6D.js";
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
		"byteCount": 222490
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
		"byteCount": 211157
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
		"byteCount": 222516
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
		"byteCount": 145679
	},
	{
		"id": "shard-05",
		"index": 4,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-05",
		"moduleCount": 2,
		"moduleIds": ["pane-layout-runtime", "app-entry"],
		"byteCount": 218924
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
		"byteCount": 186506
	},
	{
		"id": "shard-07",
		"index": 6,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-07",
		"moduleCount": 9,
		"moduleIds": [
			"composer-runtime",
			"composer-bridge-runtime",
			"api-client-runtime",
			"thread-list-load-policy",
			"thread-list-stable-order",
			"thread-status-hints",
			"thread-detail-patch-plan",
			"thread-detail-actions",
			"thread-detail-merge-state"
		],
		"byteCount": 209601
	},
	{
		"id": "shard-08",
		"index": 7,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-08",
		"moduleCount": 4,
		"moduleIds": [
			"thread-detail-v4-merge-state",
			"thread-detail-runtime",
			"task-card-runtime",
			"notification-ui-runtime"
		],
		"byteCount": 196548
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
		"byteCount": 143225
	}
];
var shardLoaders = {
	"shard-01": () => __vitePreload(() => import("./shard-01-DU78NQBb.js"), []),
	"shard-02": () => __vitePreload(() => import("./shard-02-CeFv35TK.js"), []),
	"shard-03": () => __vitePreload(() => import("./shard-03-D4Qu8lHK.js"), []),
	"shard-04": () => __vitePreload(() => import("./shard-04-Dnyg62_F.js"), []),
	"shard-05": () => __vitePreload(() => import("./shard-05-BND2iA4A.js"), __vite__mapDeps([0,1])),
	"shard-06": () => __vitePreload(() => import("./shard-06-DGZx6w7b.js"), __vite__mapDeps([2,1])),
	"shard-07": () => __vitePreload(() => import("./shard-07-DQOmsGXr.js"), __vite__mapDeps([3,1])),
	"shard-08": () => __vitePreload(() => import("./shard-08-CgWL6F9M.js"), __vite__mapDeps([4,1])),
	"shard-09": () => __vitePreload(() => import("./shard-09-BK3miMov.js"), __vite__mapDeps([5,1]))
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
			nativeEsmModuleCount: modules.filter((entry) => entry && entry.compatibilityMode === "native-esm").length,
			classicGlobalCompatibilityModuleCount: modules.filter((entry) => entry && entry.compatibilityMode !== "native-esm").length,
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
