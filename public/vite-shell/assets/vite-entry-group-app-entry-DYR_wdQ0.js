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
			"bytes": 8628,
			"sha256": "d8af2dd662125c4ba83294d4268f1d32b1fe92b6eb8df5bceb15629bac9341bf"
		},
		{
			"path": "/app-shell-runtime.js",
			"sourcePath": "public/app-shell-runtime.js",
			"bytes": 41219,
			"sha256": "8bbd6c1e33ce1f625eb6a0ace56f8872a26b6acb6e893c18442957f58a4dda66"
		},
		{
			"path": "/app.js",
			"sourcePath": "public/app.js",
			"bytes": 555,
			"sha256": "64850d84241e2534e3b580024a699ff830530292d177794a8cb15e858001a607"
		}
	],
	"classicAssetHashCount": 3,
	"classicAssetBytes": 50402,
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
	"shellCacheName": "codex-mobile-shell-v625-bb5341ba42f1",
	"clientBuildId": "0.1.11|codex-mobile-shell-v625-bb5341ba42f1"
};
var codexMobileViteEntryGroupRegistry = globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};
codexMobileViteEntryGroupRegistry[codexMobileViteEntryGroup.id] = codexMobileViteEntryGroup;
globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ = codexMobileViteEntryGroupRegistry;
//#endregion
export { codexMobileViteEntryGroup, codexMobileViteEntryGroup as default };
