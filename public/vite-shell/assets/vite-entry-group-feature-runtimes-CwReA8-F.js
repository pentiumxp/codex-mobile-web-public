//#region \0virtual:codex-mobile-shell-entry-group/feature-runtimes
var codexMobileViteEntryGroup = {
	"id": "feature-runtimes",
	"phase": "classic-runtime",
	"startupCritical": false,
	"chunkTarget": "deferred-feature-runtimes",
	"assets": [
		"/thread-list-runtime.js",
		"/client-render-stability-guard.js",
		"/live-operation-dock-state.js",
		"/thread-detail-state.js",
		"/thread-detail-render-plan.js",
		"/thread-detail-merge-state.js",
		"/thread-detail-v4-merge-state.js",
		"/thread-detail-runtime.js",
		"/thread-detail-patch-plan.js",
		"/thread-detail-dom-patch.js",
		"/thread-detail-actions.js",
		"/thread-tile-actions.js",
		"/thread-tile-state.js",
		"/thread-tile-layout.js",
		"/thread-tile-runtime.js",
		"/build-refresh-policy.js",
		"/app-update-runtime.js",
		"/side-chat-runtime.js",
		"/media-preview-runtime.js"
	],
	"assetCount": 19,
	"classicGlobalExports": [
		{
			"asset": "/thread-list-runtime.js",
			"globals": ["CodexThreadListRuntime"]
		},
		{
			"asset": "/live-operation-dock-state.js",
			"globals": ["CodexLiveOperationDockState"]
		},
		{
			"asset": "/thread-detail-state.js",
			"globals": ["CodexThreadDetailState"]
		},
		{
			"asset": "/thread-detail-render-plan.js",
			"globals": ["CodexThreadDetailRenderPlan"]
		},
		{
			"asset": "/thread-detail-merge-state.js",
			"globals": ["CodexThreadDetailMergeState"]
		},
		{
			"asset": "/thread-detail-v4-merge-state.js",
			"globals": ["CodexThreadDetailV4MergeState"]
		},
		{
			"asset": "/thread-detail-runtime.js",
			"globals": ["CodexThreadDetailRuntime"]
		},
		{
			"asset": "/thread-detail-patch-plan.js",
			"globals": ["CodexThreadDetailPatchPlan"]
		},
		{
			"asset": "/thread-detail-dom-patch.js",
			"globals": ["CodexThreadDetailDomPatch"]
		},
		{
			"asset": "/thread-detail-actions.js",
			"globals": ["CodexThreadDetailActions"]
		},
		{
			"asset": "/thread-tile-actions.js",
			"globals": ["CodexThreadTileActions"]
		},
		{
			"asset": "/thread-tile-state.js",
			"globals": ["CodexThreadTileState"]
		},
		{
			"asset": "/thread-tile-layout.js",
			"globals": ["CodexThreadTileLayout"]
		},
		{
			"asset": "/thread-tile-runtime.js",
			"globals": ["CodexThreadTileRuntime"]
		},
		{
			"asset": "/build-refresh-policy.js",
			"globals": ["CodexBuildRefreshPolicy"]
		},
		{
			"asset": "/app-update-runtime.js",
			"globals": ["CodexAppUpdateRuntime"]
		},
		{
			"asset": "/side-chat-runtime.js",
			"globals": ["CodexSideChatRuntime"]
		},
		{
			"asset": "/media-preview-runtime.js",
			"globals": ["CodexMediaPreviewRuntime"]
		}
	],
	"classicGlobalExportAssetCount": 18,
	"classicGlobalExportCount": 18,
	"shellCacheName": "codex-mobile-shell-v624",
	"clientBuildId": "0.1.11|codex-mobile-shell-v624"
};
var codexMobileViteEntryGroupRegistry = globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};
codexMobileViteEntryGroupRegistry[codexMobileViteEntryGroup.id] = codexMobileViteEntryGroup;
globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ = codexMobileViteEntryGroupRegistry;
//#endregion
export { codexMobileViteEntryGroup, codexMobileViteEntryGroup as default };
