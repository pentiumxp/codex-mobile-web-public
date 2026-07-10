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
			"bytes": 122819,
			"sha256": "e536c77b52a2cd2f46e36a49b4d6b47e1e11dbb0f3f4a420a7e7db25136d7601"
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
			"bytes": 81824,
			"sha256": "0f484df1d8f6a0d4121e1381816ffb136b182905152ef3398377003e792333cb"
		},
		{
			"path": "/api-client-runtime.js",
			"sourcePath": "public/api-client-runtime.js",
			"bytes": 71592,
			"sha256": "2840eef0e667328619b66f7f228143abaf87af634ad1c78df5298b704277cca5"
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
			"bytes": 224678,
			"sha256": "993597f2a943348b343e82f9305db4658beb7007a2d53120ca32b712ea8d6708"
		},
		{
			"path": "/task-card-runtime.js",
			"sourcePath": "public/task-card-runtime.js",
			"bytes": 74977,
			"sha256": "dedbbbda07b6e05cecc76c2afc61803d84bd3dbc585e0c3e89c4fe49ae536aa8"
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
			"bytes": 66716,
			"sha256": "4188fed3308bf12c29a5f65fbd0d41c7f708b33791cc9f61d43c71c082359064"
		},
		{
			"path": "/composer-bridge-runtime.js",
			"sourcePath": "public/composer-bridge-runtime.js",
			"bytes": 34895,
			"sha256": "67a4e3cc18c773963715003fdd3b03d267e33bdf52f1887cdb406c59d355b75f"
		}
	],
	"classicAssetHashCount": 10,
	"classicAssetBytes": 818934,
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
	"shellCacheName": "codex-mobile-shell-v625-f4ad26e24dca",
	"clientBuildId": "0.1.11|codex-mobile-shell-v625-f4ad26e24dca"
};
var codexMobileViteEntryGroupRegistry = globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};
codexMobileViteEntryGroupRegistry[codexMobileViteEntryGroup.id] = codexMobileViteEntryGroup;
globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ = codexMobileViteEntryGroupRegistry;
//#endregion
export { codexMobileViteEntryGroup, codexMobileViteEntryGroup as default };
