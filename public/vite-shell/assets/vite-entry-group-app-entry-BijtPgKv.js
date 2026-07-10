//#region \0virtual:codex-mobile-shell-entry-group/app-entry
var codexMobileViteEntryGroup = {
	"id": "app-entry",
	"phase": "startup-critical",
	"startupCritical": true,
	"chunkTarget": "startup-app-shell",
	"assets": [
		"/runtime-wiring-runtime.js",
		"/app-shell-runtime.js",
		"/app.js"
	],
	"assetCount": 3,
	"classicAssetRecords": [
		{
			"path": "/runtime-wiring-runtime.js",
			"sourcePath": "public/runtime-wiring-runtime.js",
			"bytes": 9963,
			"sha256": "92532d235eeb3c0204697afba74a05620dd9066b4063c37dd8f05440e5dab11f"
		},
		{
			"path": "/app-shell-runtime.js",
			"sourcePath": "public/app-shell-runtime.js",
			"bytes": 47474,
			"sha256": "2e5e34824f05e60fd4ce14298137bb09636fa1d386a59870e623f15de9b29740"
		},
		{
			"path": "/app.js",
			"sourcePath": "public/app.js",
			"bytes": 1479,
			"sha256": "87cc1d060a52300818f5e0ae69cf724ee2a5f44e6adb689d4d9b9884aa59bc20"
		}
	],
	"classicAssetHashCount": 3,
	"classicAssetBytes": 58916,
	"classicGlobalExports": [
		{
			"asset": "/runtime-wiring-runtime.js",
			"globals": ["CodexRuntimeWiringRuntime"]
		},
		{
			"asset": "/app-shell-runtime.js",
			"globals": ["CodexAppShellRuntime"]
		},
		{
			"asset": "/app.js",
			"globals": ["CodexMobileAppEntry"]
		}
	],
	"classicGlobalExportAssetCount": 3,
	"classicGlobalExportCount": 3,
	"startupGlobalContracts": [{
		"name": "CodexAppShellRuntime",
		"asset": "/app-shell-runtime.js",
		"groupId": "app-entry",
		"startupCritical": true,
		"source": "startup-window-guard",
		"present": true
	}, {
		"name": "CodexRuntimeWiringRuntime",
		"asset": "/runtime-wiring-runtime.js",
		"groupId": "app-entry",
		"startupCritical": true,
		"source": "startup-window-guard",
		"present": true
	}],
	"shellCacheName": "codex-mobile-shell-v625-f4ad26e24dca",
	"clientBuildId": "0.1.11|codex-mobile-shell-v625-f4ad26e24dca"
};
var codexMobileViteEntryGroupRegistry = globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};
codexMobileViteEntryGroupRegistry[codexMobileViteEntryGroup.id] = codexMobileViteEntryGroup;
globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ = codexMobileViteEntryGroupRegistry;
//#endregion
export { codexMobileViteEntryGroup, codexMobileViteEntryGroup as default };
