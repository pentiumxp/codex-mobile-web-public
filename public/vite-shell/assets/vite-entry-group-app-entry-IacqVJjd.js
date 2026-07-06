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
			"bytes": 9893,
			"sha256": "9bd8b1fb78d6e1f0acabc6e0b31405257b24e9971ff5702f3883d71bc6887662"
		},
		{
			"path": "/app-shell-runtime.js",
			"sourcePath": "public/app-shell-runtime.js",
			"bytes": 45895,
			"sha256": "7d12bf3345c607ddbd28bddc026d3b5c3e2a7d92dca3d09ffb1d80cb878de4ef"
		},
		{
			"path": "/app.js",
			"sourcePath": "public/app.js",
			"bytes": 1479,
			"sha256": "87cc1d060a52300818f5e0ae69cf724ee2a5f44e6adb689d4d9b9884aa59bc20"
		}
	],
	"classicAssetHashCount": 3,
	"classicAssetBytes": 57267,
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
	"shellCacheName": "codex-mobile-shell-v625-75ff8c622f17",
	"clientBuildId": "0.1.11|codex-mobile-shell-v625-75ff8c622f17"
};
var codexMobileViteEntryGroupRegistry = globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};
codexMobileViteEntryGroupRegistry[codexMobileViteEntryGroup.id] = codexMobileViteEntryGroup;
globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ = codexMobileViteEntryGroupRegistry;
//#endregion
export { codexMobileViteEntryGroup, codexMobileViteEntryGroup as default };
