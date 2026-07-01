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
	"shellCacheName": "codex-mobile-shell-v624",
	"clientBuildId": "0.1.11|codex-mobile-shell-v624"
};
var codexMobileViteEntryGroupRegistry = globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};
codexMobileViteEntryGroupRegistry[codexMobileViteEntryGroup.id] = codexMobileViteEntryGroup;
globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ = codexMobileViteEntryGroupRegistry;
//#endregion
