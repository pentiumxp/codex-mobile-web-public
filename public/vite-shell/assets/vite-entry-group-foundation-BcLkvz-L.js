//#region \0virtual:codex-mobile-shell-entry-group/foundation
var codexMobileViteEntryGroup = {
	"id": "foundation",
	"phase": "startup-prerequisite",
	"startupCritical": true,
	"chunkTarget": "startup-foundation",
	"assets": [
		"/api-client.js",
		"/runtime-settings.js",
		"/draft-store.js",
		"/composer-runtime.js",
		"/markdown-renderer.js",
		"/viewport-metrics.js",
		"/conversation-scroll.js",
		"/image-compressor.js",
		"/plugin-embed.js",
		"/plugin-voice-input.js",
		"/home-ai-diagnostic-reporting.js",
		"/thread-diagnostic-events.js",
		"/frontend-runtime-health.js",
		"/thread-status-hints.js",
		"/thread-performance-metrics.js",
		"/thread-list-load-policy.js",
		"/thread-list-stable-order.js"
	],
	"assetCount": 17,
	"classicAssetRecords": [
		{
			"path": "/api-client.js",
			"sourcePath": "public/api-client.js",
			"bytes": 4099,
			"sha256": "e3e020230f50860a532fdf5778ccda6cd99eeb2195db26b9cf2984bffb133c69"
		},
		{
			"path": "/runtime-settings.js",
			"sourcePath": "public/runtime-settings.js",
			"bytes": 3184,
			"sha256": "b9083bd06a3ce1cfc46a195ab571ab3cf98d8e4d6db9600b5d791ede584bcb88"
		},
		{
			"path": "/draft-store.js",
			"sourcePath": "public/draft-store.js",
			"bytes": 9065,
			"sha256": "6d19ccfff79f22f09d831304cc81ebbcc320b57f31f9d6332c7fe719b98d5579"
		},
		{
			"path": "/composer-runtime.js",
			"sourcePath": "public/composer-runtime.js",
			"bytes": 90984,
			"sha256": "930c4a747da94196d636369b65ae1f53c9c66c8c920749dc4fa8402b7c2ab3a0"
		},
		{
			"path": "/markdown-renderer.js",
			"sourcePath": "public/markdown-renderer.js",
			"bytes": 18044,
			"sha256": "88493cc61907a2ed381bf899d32399b2e81eb98b89a1b959e44274e5020f853a"
		},
		{
			"path": "/viewport-metrics.js",
			"sourcePath": "public/viewport-metrics.js",
			"bytes": 4306,
			"sha256": "0257cde3a6361697101c177b1ca242b3e117d7cc2e4cdee81a3d71fc63018539"
		},
		{
			"path": "/conversation-scroll.js",
			"sourcePath": "public/conversation-scroll.js",
			"bytes": 11683,
			"sha256": "8b471196aca6422ccf50c6865ff496bead83c3c9957958a8ca478950be82ca63"
		},
		{
			"path": "/image-compressor.js",
			"sourcePath": "public/image-compressor.js",
			"bytes": 5261,
			"sha256": "7757d62af34099da30c740ed08217ca1085af8b24617dceabd262b655d2099c1"
		},
		{
			"path": "/plugin-embed.js",
			"sourcePath": "public/plugin-embed.js",
			"bytes": 14761,
			"sha256": "e54efe28042795850dad5160d0eb1ac71f6bf7f82899f006e7a32880ec6e2e42"
		},
		{
			"path": "/plugin-voice-input.js",
			"sourcePath": "public/plugin-voice-input.js",
			"bytes": 8247,
			"sha256": "925ca0a4a681130929b434437f16dfa7535a357ba5b55d7eeb2b6402092838c9"
		},
		{
			"path": "/home-ai-diagnostic-reporting.js",
			"sourcePath": "public/home-ai-diagnostic-reporting.js",
			"bytes": 14358,
			"sha256": "dd33c244a80fe43ab7c3b2dbd3a7a57b0727c2a83b9523e658f9ff024d2b96f8"
		},
		{
			"path": "/thread-diagnostic-events.js",
			"sourcePath": "public/thread-diagnostic-events.js",
			"bytes": 46238,
			"sha256": "df3b95d98ccf950cd2d1869218664e12d9b032805c937d78c5a5a1899f603db3"
		},
		{
			"path": "/frontend-runtime-health.js",
			"sourcePath": "public/frontend-runtime-health.js",
			"bytes": 21458,
			"sha256": "af1d667ed6f5763474e5fd9c86aa47348603cbd143680f6c9361a68b99d91412"
		},
		{
			"path": "/thread-status-hints.js",
			"sourcePath": "public/thread-status-hints.js",
			"bytes": 10655,
			"sha256": "dd596baa5c0fa93046c119d76700abaf5d45f8c4980d5cc617198deb904a7427"
		},
		{
			"path": "/thread-performance-metrics.js",
			"sourcePath": "public/thread-performance-metrics.js",
			"bytes": 29351,
			"sha256": "fdc98ab6847e01eccd744b645fafc589d718b9fa8f326394864bb6e1366b7afb"
		},
		{
			"path": "/thread-list-load-policy.js",
			"sourcePath": "public/thread-list-load-policy.js",
			"bytes": 2160,
			"sha256": "0de557c28bc45b6b9eb252dc9227083e17279053315bfd40cb7911f7c1b29d5f"
		},
		{
			"path": "/thread-list-stable-order.js",
			"sourcePath": "public/thread-list-stable-order.js",
			"bytes": 5110,
			"sha256": "c4eefc717c3f45baebc164e1faffe0e2f712eb9115dc965bdc3de7ff2c614d29"
		}
	],
	"classicAssetHashCount": 17,
	"classicAssetBytes": 298964,
	"classicGlobalExports": [
		{
			"asset": "/api-client.js",
			"globals": ["CodexApiClient"]
		},
		{
			"asset": "/runtime-settings.js",
			"globals": ["CodexRuntimeSettings"]
		},
		{
			"asset": "/draft-store.js",
			"globals": ["CodexDraftStore"]
		},
		{
			"asset": "/composer-runtime.js",
			"globals": ["CodexComposerRuntime"]
		},
		{
			"asset": "/markdown-renderer.js",
			"globals": ["CodexMarkdownRenderer"]
		},
		{
			"asset": "/viewport-metrics.js",
			"globals": ["CodexViewportMetrics"]
		},
		{
			"asset": "/conversation-scroll.js",
			"globals": ["CodexConversationScroll"]
		},
		{
			"asset": "/image-compressor.js",
			"globals": ["CodexImageCompressor"]
		},
		{
			"asset": "/plugin-embed.js",
			"globals": ["CodexPluginEmbed"]
		},
		{
			"asset": "/plugin-voice-input.js",
			"globals": ["CodexPluginVoiceInput"]
		},
		{
			"asset": "/home-ai-diagnostic-reporting.js",
			"globals": ["CodexHomeAiDiagnosticReporting"]
		},
		{
			"asset": "/thread-diagnostic-events.js",
			"globals": ["CodexThreadDiagnosticEvents"]
		},
		{
			"asset": "/frontend-runtime-health.js",
			"globals": ["CodexFrontendRuntimeHealth"]
		},
		{
			"asset": "/thread-status-hints.js",
			"globals": ["CodexThreadStatusHints"]
		},
		{
			"asset": "/thread-performance-metrics.js",
			"globals": ["CodexThreadPerformanceMetrics"]
		},
		{
			"asset": "/thread-list-load-policy.js",
			"globals": ["CodexThreadListLoadPolicy"]
		},
		{
			"asset": "/thread-list-stable-order.js",
			"globals": ["CodexThreadListStableOrder"]
		}
	],
	"classicGlobalExportAssetCount": 17,
	"classicGlobalExportCount": 17,
	"startupGlobalContracts": [
		{
			"name": "CodexApiClient",
			"asset": "/api-client.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexComposerRuntime",
			"asset": "/composer-runtime.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexDraftStore",
			"asset": "/draft-store.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexFrontendRuntimeHealth",
			"asset": "/frontend-runtime-health.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexHomeAiDiagnosticReporting",
			"asset": "/home-ai-diagnostic-reporting.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadDiagnosticEvents",
			"asset": "/thread-diagnostic-events.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadListLoadPolicy",
			"asset": "/thread-list-load-policy.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadListStableOrder",
			"asset": "/thread-list-stable-order.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadPerformanceMetrics",
			"asset": "/thread-performance-metrics.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadStatusHints",
			"asset": "/thread-status-hints.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		}
	],
	"shellCacheName": "codex-mobile-shell-v625-1bf90783fc88",
	"clientBuildId": "0.1.11|codex-mobile-shell-v625-1bf90783fc88"
};
var codexMobileViteEntryGroupRegistry = globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};
codexMobileViteEntryGroupRegistry[codexMobileViteEntryGroup.id] = codexMobileViteEntryGroup;
globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ = codexMobileViteEntryGroupRegistry;
//#endregion
export { codexMobileViteEntryGroup, codexMobileViteEntryGroup as default };
