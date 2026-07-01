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
	"classicGlobalExports": [{
		"asset": "/runtime-wiring-runtime.js",
		"globals": ["CodexRuntimeWiringRuntime"]
	}, {
		"asset": "/app-shell-runtime.js",
		"globals": ["CodexAppShellRuntime"]
	}],
	"classicGlobalExportAssetCount": 2,
	"classicGlobalExportCount": 2,
	"shellCacheName": "codex-mobile-shell-v624",
	"clientBuildId": "0.1.11|codex-mobile-shell-v624"
};
var codexMobileViteEntryGroupRegistry = globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};
codexMobileViteEntryGroupRegistry[codexMobileViteEntryGroup.id] = codexMobileViteEntryGroup;
globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ = codexMobileViteEntryGroupRegistry;
//#endregion
