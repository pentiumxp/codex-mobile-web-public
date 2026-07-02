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
			"bytes": 8462,
			"sha256": "de35d56b7e9f9c317d6ca8d30f499e06c662643d1a3f89ec1d894d22cd178ac2"
		},
		{
			"path": "/app-shell-runtime.js",
			"sourcePath": "public/app-shell-runtime.js",
			"bytes": 41098,
			"sha256": "1beb88ea0475465bf4da99fc12de6412b4e8aabdb8a760ddce9a2b95e7ef52fb"
		},
		{
			"path": "/app.js",
			"sourcePath": "public/app.js",
			"bytes": 555,
			"sha256": "64850d84241e2534e3b580024a699ff830530292d177794a8cb15e858001a607"
		}
	],
	"classicAssetHashCount": 3,
	"classicAssetBytes": 50115,
	"classicGlobalExports": [{
		"asset": "/runtime-wiring-runtime.js",
		"globals": ["CodexRuntimeWiringRuntime"]
	}, {
		"asset": "/app-shell-runtime.js",
		"globals": ["CodexAppShellRuntime"]
	}],
	"classicGlobalExportAssetCount": 2,
	"classicGlobalExportCount": 2,
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
	"shellCacheName": "codex-mobile-shell-v625-5d8a53ef77a5",
	"clientBuildId": "0.1.11|codex-mobile-shell-v625-5d8a53ef77a5"
};
var codexMobileViteEntryGroupRegistry = globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};
codexMobileViteEntryGroupRegistry[codexMobileViteEntryGroup.id] = codexMobileViteEntryGroup;
globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ = codexMobileViteEntryGroupRegistry;
//#endregion
export { codexMobileViteEntryGroup, codexMobileViteEntryGroup as default };
