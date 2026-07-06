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
			"bytes": 103193,
			"sha256": "e63cab432b21df557508740247b714665b4e6362fa4efab97ac89374db6c8f3e"
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
			"bytes": 78441,
			"sha256": "7ac48a90199aa71cc635e2ec35b547dac50fb1b130667fcf8aa7553f175bb1b6"
		},
		{
			"path": "/api-client-runtime.js",
			"sourcePath": "public/api-client-runtime.js",
			"bytes": 68429,
			"sha256": "214d9432530b047dc16d6d289d476a4421a51d1c0f020e170d901df5e7db9cfb"
		},
		{
			"path": "/notification-ui-runtime.js",
			"sourcePath": "public/notification-ui-runtime.js",
			"bytes": 55054,
			"sha256": "c91ac0b12cad54d190249e1d74640f6f543f2dea67f3e78c0862aa60fe462a16"
		},
		{
			"path": "/pane-layout-runtime.js",
			"sourcePath": "public/pane-layout-runtime.js",
			"bytes": 218628,
			"sha256": "0c2b14fea89ac2bc87abc02b16195c187207aa83e73968c29690d174ae29e372"
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
			"bytes": 71844,
			"sha256": "ffc1e2d646c4ac0a2bc2a517f9634ecdfb8f63b689b3b341ae9aa73cce98457f"
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
			"bytes": 34706,
			"sha256": "8a022cc5ac5bfd28d927e5868378b788274b4796ac0b5a7ce7e08ada0ff4a0cc"
		}
	],
	"classicAssetHashCount": 10,
	"classicAssetBytes": 770257,
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
	"shellCacheName": "codex-mobile-shell-v625-ebf0a8218576",
	"clientBuildId": "0.1.11|codex-mobile-shell-v625-ebf0a8218576"
};
var codexMobileViteEntryGroupRegistry = globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};
codexMobileViteEntryGroupRegistry[codexMobileViteEntryGroup.id] = codexMobileViteEntryGroup;
globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ = codexMobileViteEntryGroupRegistry;
//#endregion
export { codexMobileViteEntryGroup, codexMobileViteEntryGroup as default };
