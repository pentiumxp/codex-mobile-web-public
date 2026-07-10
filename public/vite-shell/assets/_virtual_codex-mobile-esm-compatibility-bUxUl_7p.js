import { t as __vitePreload } from "./vite-shell-entry-DpL_0wn_.js";
//#region \0virtual:codex-mobile-esm-compatibility
var codexMobileViteEsmCompatibilityShardSources = [
	{
		"id": "shard-01",
		"index": 0,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-01",
		"moduleCount": 8,
		"moduleIds": [
			"build-refresh-policy",
			"runtime-settings",
			"viewport-metrics",
			"conversation-scroll",
			"thread-performance-metrics",
			"thread-detail-state",
			"thread-detail-render-plan",
			"thread-detail-dom-patch"
		],
		"byteCount": 217918
	},
	{
		"id": "shard-02",
		"index": 1,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-02",
		"moduleCount": 11,
		"moduleIds": [
			"draft-store",
			"image-compressor",
			"plugin-voice-input",
			"api-client",
			"markdown-renderer",
			"plugin-embed",
			"frontend-runtime-health",
			"home-ai-diagnostic-reporting",
			"thread-diagnostic-events",
			"thread-tile-layout",
			"thread-tile-actions"
		],
		"byteCount": 157365
	},
	{
		"id": "shard-03",
		"index": 2,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-03",
		"moduleCount": 3,
		"moduleIds": [
			"thread-tile-state",
			"thread-tile-runtime",
			"app-update-runtime"
		],
		"byteCount": 218839
	},
	{
		"id": "shard-04",
		"index": 3,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-04",
		"moduleCount": 3,
		"moduleIds": [
			"settings-runtime",
			"modal-runtime",
			"navigation-runtime"
		],
		"byteCount": 216692
	},
	{
		"id": "shard-05",
		"index": 4,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-05",
		"moduleCount": 2,
		"moduleIds": ["runtime-wiring-runtime", "app-shell-runtime"],
		"byteCount": 61893
	},
	{
		"id": "shard-06",
		"index": 5,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-06",
		"moduleCount": 1,
		"moduleIds": ["pane-layout-runtime"],
		"byteCount": 224678
	},
	{
		"id": "shard-07",
		"index": 6,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-07",
		"moduleCount": 4,
		"moduleIds": [
			"app-entry",
			"thread-list-runtime",
			"side-chat-runtime",
			"media-preview-runtime"
		],
		"byteCount": 193079
	},
	{
		"id": "shard-08",
		"index": 7,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-08",
		"moduleCount": 7,
		"moduleIds": [
			"composer-runtime",
			"composer-bridge-runtime",
			"api-client-runtime",
			"thread-list-load-policy",
			"thread-list-stable-order",
			"thread-status-hints",
			"thread-detail-patch-plan"
		],
		"byteCount": 224985
	},
	{
		"id": "shard-09",
		"index": 8,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-09",
		"moduleCount": 5,
		"moduleIds": [
			"thread-detail-actions",
			"thread-detail-merge-state",
			"thread-detail-v4-merge-state",
			"thread-detail-runtime",
			"task-card-runtime"
		],
		"byteCount": 172543
	},
	{
		"id": "shard-10",
		"index": 9,
		"source": "virtual:codex-mobile-esm-compatibility/shard/shard-10",
		"moduleCount": 5,
		"moduleIds": [
			"notification-ui-runtime",
			"conversation-render-runtime",
			"event-stream-runtime",
			"client-render-stability-guard",
			"live-operation-dock-state"
		],
		"byteCount": 204818
	}
];
var shardLoaders = {
	"shard-01": () => __vitePreload(() => import("./shard-01-6SLPqW2e.js"), []),
	"shard-02": () => __vitePreload(() => import("./shard-02-2-31Za9L.js"), []),
	"shard-03": () => __vitePreload(() => import("./shard-03-D8FINLLT.js"), []),
	"shard-04": () => __vitePreload(() => import("./shard-04-CFnLs2fj.js"), []),
	"shard-05": () => __vitePreload(() => import("./shard-05-2b6XxDrR.js"), []),
	"shard-06": () => __vitePreload(() => import("./shard-06-DrgZylQ2.js"), []),
	"shard-07": () => __vitePreload(() => import("./shard-07-D8M3s1r_.js"), []),
	"shard-08": () => __vitePreload(() => import("./shard-08-9Ldhny2Y.js"), []),
	"shard-09": () => __vitePreload(() => import("./shard-09-DwCOyIGC.js"), []),
	"shard-10": () => __vitePreload(() => import("./shard-10-DAMOoqvT.js"), [])
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
