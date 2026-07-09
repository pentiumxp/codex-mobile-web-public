//#region \0virtual:codex-mobile-shell-entry-group/shell-services
var codexMobileViteEntryGroup = {
	"id": "shell-services",
	"phase": "classic-runtime",
	"startupCritical": false,
	"chunkTarget": "deferred-shell-services",
	"assets": [
		"/settings-runtime.js",
		"/modal-runtime.js",
		"/navigation-runtime.js",
		"/api-client-runtime.js",
		"/notification-ui-runtime.js",
		"/pane-layout-runtime.js",
		"/task-card-runtime.js",
		"/conversation-render-runtime.js",
		"/event-stream-runtime.js",
		"/composer-bridge-runtime.js"
	],
	"assetCount": 10,
	"classicAssetRecords": [
		{
			"path": "/settings-runtime.js",
			"sourcePath": "public/settings-runtime.js",
			"bytes": 113579,
			"sha256": "faf8100934837dd7c0853b874a43af4175aebfee246742becdcbef079754570e"
		},
		{
			"path": "/modal-runtime.js",
			"sourcePath": "public/modal-runtime.js",
			"bytes": 12049,
			"sha256": "dcdc154b5ebc18c6d57b6edb3a2e66bd178194db47afea43f971f52498ea8496"
		},
		{
			"path": "/navigation-runtime.js",
			"sourcePath": "public/navigation-runtime.js",
			"bytes": 78405,
			"sha256": "2987a629d33421b05ef3caef3067b8425be0e2186ef2f229c83390a6dafb58c0"
		},
		{
			"path": "/api-client-runtime.js",
			"sourcePath": "public/api-client-runtime.js",
			"bytes": 70556,
			"sha256": "f8dd6f30d91d031b7b11bb325cc8e323a0008f61f4ccafad0a74cbb3e4adf93e"
		},
		{
			"path": "/notification-ui-runtime.js",
			"sourcePath": "public/notification-ui-runtime.js",
			"bytes": 57015,
			"sha256": "1d9c28fec3d2e8d1b893e29495e166a2d7c54c91aae32b15617c90d0ba69793a"
		},
		{
			"path": "/pane-layout-runtime.js",
			"sourcePath": "public/pane-layout-runtime.js",
			"bytes": 224562,
			"sha256": "5ed449fbd5304cf68524a40320eb44c7a927441cdf6fe72294f425345cd119de"
		},
		{
			"path": "/task-card-runtime.js",
			"sourcePath": "public/task-card-runtime.js",
			"bytes": 64113,
			"sha256": "b831e411cf6efb6ded34d41d138c6d5e6483a000d7833d388a81d0de84e8c32d"
		},
		{
			"path": "/conversation-render-runtime.js",
			"sourcePath": "public/conversation-render-runtime.js",
			"bytes": 72369,
			"sha256": "30d252145d0b8e49da42d7e4f3849b9bdc8e5f24e1d91f0f5a9701c7a0a98e62"
		},
		{
			"path": "/event-stream-runtime.js",
			"sourcePath": "public/event-stream-runtime.js",
			"bytes": 63800,
			"sha256": "398751d80e7bbd25d33bd5f27a775442906e1f6603e7396b6a3d45786145aa19"
		},
		{
			"path": "/composer-bridge-runtime.js",
			"sourcePath": "public/composer-bridge-runtime.js",
			"bytes": 34895,
			"sha256": "67a4e3cc18c773963715003fdd3b03d267e33bdf52f1887cdb406c59d355b75f"
		}
	],
	"classicAssetHashCount": 10,
	"classicAssetBytes": 791343,
	"classicGlobalExports": [
		{
			"asset": "/settings-runtime.js",
			"globals": ["CodexSettingsRuntime"]
		},
		{
			"asset": "/modal-runtime.js",
			"globals": ["CodexModalRuntime"]
		},
		{
			"asset": "/navigation-runtime.js",
			"globals": ["CodexNavigationRuntime"]
		},
		{
			"asset": "/api-client-runtime.js",
			"globals": ["CodexApiClientRuntime", "CodexFrontendLog"]
		},
		{
			"asset": "/notification-ui-runtime.js",
			"globals": ["CodexNotificationUiRuntime"]
		},
		{
			"asset": "/pane-layout-runtime.js",
			"globals": ["CodexPaneLayoutRuntime"]
		},
		{
			"asset": "/task-card-runtime.js",
			"globals": ["CodexTaskCardRuntime"]
		},
		{
			"asset": "/conversation-render-runtime.js",
			"globals": ["CodexConversationRenderRuntime"]
		},
		{
			"asset": "/event-stream-runtime.js",
			"globals": ["CodexEventStreamRuntime"]
		},
		{
			"asset": "/composer-bridge-runtime.js",
			"globals": ["CodexComposerBridgeRuntime"]
		}
	],
	"classicGlobalExportAssetCount": 10,
	"classicGlobalExportCount": 11,
	"startupGlobalContracts": [],
	"shellCacheName": "codex-mobile-shell-v625-77672b8b2e42",
	"clientBuildId": "0.1.11|codex-mobile-shell-v625-77672b8b2e42"
};
var codexMobileViteEntryGroupRegistry = globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};
codexMobileViteEntryGroupRegistry[codexMobileViteEntryGroup.id] = codexMobileViteEntryGroup;
globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ = codexMobileViteEntryGroupRegistry;
//#endregion
export { codexMobileViteEntryGroup, codexMobileViteEntryGroup as default };
