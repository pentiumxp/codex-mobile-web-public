var shell_asset_manifest_default = {
	schemaVersion: 4,
	generatedBy: "generate-frontend-shell-manifest",
	shellCacheName: "codex-mobile-shell-v625-2466e0a03fb0",
	clientBuildId: "0.1.11|codex-mobile-shell-v625-2466e0a03fb0",
	scriptAssets: [
		"/shell-asset-manifest.js",
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
		"/thread-list-stable-order.js",
		"/thread-list-runtime.js",
		"/client-render-stability-guard.js",
		"/live-operation-dock-state.js",
		"/thread-detail-state.js",
		"/thread-detail-render-plan.js",
		"/thread-detail-merge-state.js",
		"/thread-detail-v4-merge-state.js",
		"/thread-detail-runtime.js",
		"/thread-detail-patch-plan.js",
		"/thread-detail-dom-patch.js",
		"/thread-detail-actions.js",
		"/thread-tile-actions.js",
		"/thread-tile-state.js",
		"/thread-tile-layout.js",
		"/thread-tile-runtime.js",
		"/build-refresh-policy.js",
		"/app-update-runtime.js",
		"/side-chat-runtime.js",
		"/media-preview-runtime.js",
		"/app-bootstrap.js",
		"/settings-runtime.js",
		"/modal-runtime.js",
		"/navigation-runtime.js",
		"/api-client-runtime.js",
		"/notification-ui-runtime.js",
		"/pane-layout-runtime.js",
		"/task-card-runtime.js",
		"/conversation-render-runtime.js",
		"/event-stream-runtime.js",
		"/composer-bridge-runtime.js",
		"/runtime-wiring-runtime.js",
		"/app-shell-runtime.js",
		"/app.js"
	],
	entryGroups: [
		{
			"id": "manifest",
			"phase": "startup-manifest",
			"startupCritical": true,
			"chunkTarget": "startup-manifest",
			"assets": ["/shell-asset-manifest.js"]
		},
		{
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
			]
		},
		{
			"id": "feature-runtimes",
			"phase": "classic-runtime",
			"startupCritical": false,
			"chunkTarget": "deferred-feature-runtimes",
			"assets": [
				"/thread-list-runtime.js",
				"/client-render-stability-guard.js",
				"/live-operation-dock-state.js",
				"/thread-detail-state.js",
				"/thread-detail-render-plan.js",
				"/thread-detail-merge-state.js",
				"/thread-detail-v4-merge-state.js",
				"/thread-detail-runtime.js",
				"/thread-detail-patch-plan.js",
				"/thread-detail-dom-patch.js",
				"/thread-detail-actions.js",
				"/thread-tile-actions.js",
				"/thread-tile-state.js",
				"/thread-tile-layout.js",
				"/thread-tile-runtime.js",
				"/build-refresh-policy.js",
				"/app-update-runtime.js",
				"/side-chat-runtime.js",
				"/media-preview-runtime.js"
			]
		},
		{
			"id": "bootstrap-state",
			"phase": "startup-critical",
			"startupCritical": true,
			"chunkTarget": "startup-bootstrap",
			"assets": ["/app-bootstrap.js"]
		},
		{
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
			]
		},
		{
			"id": "app-entry",
			"phase": "startup-critical",
			"startupCritical": true,
			"chunkTarget": "startup-app-shell",
			"assets": [
				"/runtime-wiring-runtime.js",
				"/app-shell-runtime.js",
				"/app.js"
			]
		}
	],
	classicGlobalExports: [
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
		},
		{
			"asset": "/thread-list-runtime.js",
			"globals": ["CodexThreadListRuntime"]
		},
		{
			"asset": "/client-render-stability-guard.js",
			"globals": ["CodexClientRenderStabilityGuard"]
		},
		{
			"asset": "/live-operation-dock-state.js",
			"globals": ["CodexLiveOperationDockState"]
		},
		{
			"asset": "/thread-detail-state.js",
			"globals": ["CodexThreadDetailState"]
		},
		{
			"asset": "/thread-detail-render-plan.js",
			"globals": ["CodexThreadDetailRenderPlan"]
		},
		{
			"asset": "/thread-detail-merge-state.js",
			"globals": ["CodexThreadDetailMergeState"]
		},
		{
			"asset": "/thread-detail-v4-merge-state.js",
			"globals": ["CodexThreadDetailV4MergeState"]
		},
		{
			"asset": "/thread-detail-runtime.js",
			"globals": ["CodexThreadDetailRuntime"]
		},
		{
			"asset": "/thread-detail-patch-plan.js",
			"globals": ["CodexThreadDetailPatchPlan"]
		},
		{
			"asset": "/thread-detail-dom-patch.js",
			"globals": ["CodexThreadDetailDomPatch"]
		},
		{
			"asset": "/thread-detail-actions.js",
			"globals": ["CodexThreadDetailActions"]
		},
		{
			"asset": "/thread-tile-actions.js",
			"globals": ["CodexThreadTileActions"]
		},
		{
			"asset": "/thread-tile-state.js",
			"globals": ["CodexThreadTileState"]
		},
		{
			"asset": "/thread-tile-layout.js",
			"globals": ["CodexThreadTileLayout"]
		},
		{
			"asset": "/thread-tile-runtime.js",
			"globals": ["CodexThreadTileRuntime"]
		},
		{
			"asset": "/build-refresh-policy.js",
			"globals": ["CodexBuildRefreshPolicy"]
		},
		{
			"asset": "/app-update-runtime.js",
			"globals": ["CodexAppUpdateRuntime"]
		},
		{
			"asset": "/side-chat-runtime.js",
			"globals": ["CodexSideChatRuntime"]
		},
		{
			"asset": "/media-preview-runtime.js",
			"globals": ["CodexMediaPreviewRuntime"]
		},
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
			"globals": ["CodexApiClientRuntime"]
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
		},
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
	startupGlobalContracts: [
		{
			"name": "CodexApiClient",
			"asset": "/api-client.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexAppShellRuntime",
			"asset": "/app-shell-runtime.js",
			"groupId": "app-entry",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexAppUpdateRuntime",
			"asset": "/app-update-runtime.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexClientRenderStabilityGuard",
			"asset": "/client-render-stability-guard.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
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
			"name": "CodexLiveOperationDockState",
			"asset": "/live-operation-dock-state.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexMediaPreviewRuntime",
			"asset": "/media-preview-runtime.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexRuntimeWiringRuntime",
			"asset": "/runtime-wiring-runtime.js",
			"groupId": "app-entry",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexSideChatRuntime",
			"asset": "/side-chat-runtime.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadDetailActions",
			"asset": "/thread-detail-actions.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadDetailDomPatch",
			"asset": "/thread-detail-dom-patch.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadDetailMergeState",
			"asset": "/thread-detail-merge-state.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadDetailPatchPlan",
			"asset": "/thread-detail-patch-plan.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadDetailRenderPlan",
			"asset": "/thread-detail-render-plan.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadDetailRuntime",
			"asset": "/thread-detail-runtime.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadDetailState",
			"asset": "/thread-detail-state.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadDetailV4MergeState",
			"asset": "/thread-detail-v4-merge-state.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
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
			"name": "CodexThreadListRuntime",
			"asset": "/thread-list-runtime.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
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
		},
		{
			"name": "CodexThreadTileActions",
			"asset": "/thread-tile-actions.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadTileLayout",
			"asset": "/thread-tile-layout.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadTileRuntime",
			"asset": "/thread-tile-runtime.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadTileState",
			"asset": "/thread-tile-state.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		}
	],
	linkAssets: [
		"/manifest.json",
		"/icons/icon.svg",
		"/icons/apple-touch-icon.png",
		"/styles.css"
	],
	iconAssets: [
		"/icons/icon.svg",
		"/icons/apple-touch-icon.png",
		"/icons/icon-192.png",
		"/icons/icon-512.png"
	],
	precacheAssets: [
		"/",
		"/index.html",
		"/manifest.json",
		"/icons/icon.svg",
		"/icons/apple-touch-icon.png",
		"/styles.css",
		"/icons/icon-192.png",
		"/icons/icon-512.png",
		"/shell-asset-manifest.js",
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
		"/thread-list-stable-order.js",
		"/thread-list-runtime.js",
		"/client-render-stability-guard.js",
		"/live-operation-dock-state.js",
		"/thread-detail-state.js",
		"/thread-detail-render-plan.js",
		"/thread-detail-merge-state.js",
		"/thread-detail-v4-merge-state.js",
		"/thread-detail-runtime.js",
		"/thread-detail-patch-plan.js",
		"/thread-detail-dom-patch.js",
		"/thread-detail-actions.js",
		"/thread-tile-actions.js",
		"/thread-tile-state.js",
		"/thread-tile-layout.js",
		"/thread-tile-runtime.js",
		"/build-refresh-policy.js",
		"/app-update-runtime.js",
		"/side-chat-runtime.js",
		"/media-preview-runtime.js",
		"/app-bootstrap.js",
		"/settings-runtime.js",
		"/modal-runtime.js",
		"/navigation-runtime.js",
		"/api-client-runtime.js",
		"/notification-ui-runtime.js",
		"/pane-layout-runtime.js",
		"/task-card-runtime.js",
		"/conversation-render-runtime.js",
		"/event-stream-runtime.js",
		"/composer-bridge-runtime.js",
		"/runtime-wiring-runtime.js",
		"/app-shell-runtime.js",
		"/app.js",
		"/shell-asset-manifest.json"
	],
	pageShellAssets: [
		"/",
		"/index.html",
		"/manifest.json",
		"/icons/icon.svg",
		"/icons/apple-touch-icon.png",
		"/styles.css",
		"/icons/icon-192.png",
		"/icons/icon-512.png",
		"/shell-asset-manifest.js",
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
		"/thread-list-stable-order.js",
		"/thread-list-runtime.js",
		"/client-render-stability-guard.js",
		"/live-operation-dock-state.js",
		"/thread-detail-state.js",
		"/thread-detail-render-plan.js",
		"/thread-detail-merge-state.js",
		"/thread-detail-v4-merge-state.js",
		"/thread-detail-runtime.js",
		"/thread-detail-patch-plan.js",
		"/thread-detail-dom-patch.js",
		"/thread-detail-actions.js",
		"/thread-tile-actions.js",
		"/thread-tile-state.js",
		"/thread-tile-layout.js",
		"/thread-tile-runtime.js",
		"/build-refresh-policy.js",
		"/app-update-runtime.js",
		"/side-chat-runtime.js",
		"/media-preview-runtime.js",
		"/app-bootstrap.js",
		"/settings-runtime.js",
		"/modal-runtime.js",
		"/navigation-runtime.js",
		"/api-client-runtime.js",
		"/notification-ui-runtime.js",
		"/pane-layout-runtime.js",
		"/task-card-runtime.js",
		"/conversation-render-runtime.js",
		"/event-stream-runtime.js",
		"/composer-bridge-runtime.js",
		"/runtime-wiring-runtime.js",
		"/app-shell-runtime.js",
		"/app.js",
		"/shell-asset-manifest.json",
		"/sw.js"
	],
	hashAssets: [
		"/index.html",
		"/manifest.json",
		"/icons/icon.svg",
		"/icons/apple-touch-icon.png",
		"/styles.css",
		"/icons/icon-192.png",
		"/icons/icon-512.png",
		"/shell-asset-manifest.js",
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
		"/thread-list-stable-order.js",
		"/thread-list-runtime.js",
		"/client-render-stability-guard.js",
		"/live-operation-dock-state.js",
		"/thread-detail-state.js",
		"/thread-detail-render-plan.js",
		"/thread-detail-merge-state.js",
		"/thread-detail-v4-merge-state.js",
		"/thread-detail-runtime.js",
		"/thread-detail-patch-plan.js",
		"/thread-detail-dom-patch.js",
		"/thread-detail-actions.js",
		"/thread-tile-actions.js",
		"/thread-tile-state.js",
		"/thread-tile-layout.js",
		"/thread-tile-runtime.js",
		"/build-refresh-policy.js",
		"/app-update-runtime.js",
		"/side-chat-runtime.js",
		"/media-preview-runtime.js",
		"/app-bootstrap.js",
		"/settings-runtime.js",
		"/modal-runtime.js",
		"/navigation-runtime.js",
		"/api-client-runtime.js",
		"/notification-ui-runtime.js",
		"/pane-layout-runtime.js",
		"/task-card-runtime.js",
		"/conversation-render-runtime.js",
		"/event-stream-runtime.js",
		"/composer-bridge-runtime.js",
		"/runtime-wiring-runtime.js",
		"/app-shell-runtime.js",
		"/app.js",
		"/shell-asset-manifest.json",
		"/sw.js"
	],
	counts: {
		"scriptAssets": 51,
		"entryGroups": 6,
		"classicGlobalExportAssets": 49,
		"classicGlobalExports": 49,
		"startupGlobalContracts": 30,
		"linkAssets": 4,
		"iconAssets": 4,
		"precacheAssets": 60,
		"pageShellAssets": 61,
		"hashAssets": 60
	}
};
//#endregion
//#region \0vite/preload-helper.js
var scriptRel = "modulepreload";
var assetsURL = function(dep) {
	return "/" + dep;
};
var seen = {};
var __vitePreload = function preload(baseModule, deps, importerUrl) {
	let promise = Promise.resolve();
	if (deps && deps.length > 0) {
		const links = document.getElementsByTagName("link");
		const cspNonceMeta = document.querySelector("meta[property=csp-nonce]");
		const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
		function allSettled(promises) {
			return Promise.all(promises.map((p) => Promise.resolve(p).then((value) => ({
				status: "fulfilled",
				value
			}), (reason) => ({
				status: "rejected",
				reason
			}))));
		}
		function importMetaResolve(specifier) {
			if (import.meta.resolve) return import.meta.resolve(specifier);
			return new URL(specifier, new URL("../../../src/node/plugins/importAnalysisBuild.ts", import.meta.url)).href;
		}
		promise = allSettled(deps.map((dep) => {
			dep = assetsURL(dep, importerUrl);
			dep = importMetaResolve(dep);
			if (dep in seen) return;
			seen[dep] = true;
			const isCss = dep.endsWith(".css");
			for (let i = links.length - 1; i >= 0; i--) {
				const link = links[i];
				if (link.href === dep && (!isCss || link.rel === "stylesheet")) return;
			}
			const link = document.createElement("link");
			link.rel = isCss ? "stylesheet" : scriptRel;
			if (!isCss) link.as = "script";
			link.crossOrigin = "";
			link.href = dep;
			if (cspNonce) link.setAttribute("nonce", cspNonce);
			document.head.appendChild(link);
			if (isCss) return new Promise((res, rej) => {
				link.addEventListener("load", res);
				link.addEventListener("error", () => rej(/* @__PURE__ */ new Error(`Unable to preload CSS for ${dep}`)));
			});
		}));
	}
	function handlePreloadError(err) {
		const e = new Event("vite:preloadError", { cancelable: true });
		e.payload = err;
		window.dispatchEvent(e);
		if (!e.defaultPrevented) throw err;
	}
	return promise.then((res) => {
		for (const item of res || []) {
			if (item.status !== "rejected") continue;
			handlePreloadError(item.reason);
		}
		return baseModule().catch(handlePreloadError);
	});
};
//#endregion
//#region \0virtual:codex-mobile-shell-entry-group-loader
var codexMobileViteEntryGroupIds = [
	"manifest",
	"foundation",
	"feature-runtimes",
	"bootstrap-state",
	"shell-services",
	"app-entry"
];
var codexMobileViteEntryGroupLoaders = {
	"manifest": () => __vitePreload(() => import("./vite-entry-group-manifest-iNrGRUmC.js"), []),
	"foundation": () => __vitePreload(() => import("./vite-entry-group-foundation-B5XaLxD7.js"), []),
	"feature-runtimes": () => __vitePreload(() => import("./vite-entry-group-feature-runtimes-BedI4to0.js"), []),
	"bootstrap-state": () => __vitePreload(() => import("./vite-entry-group-bootstrap-state-BF9EbyrW.js"), []),
	"shell-services": () => __vitePreload(() => import("./vite-entry-group-shell-services-CvLUl8H-.js"), []),
	"app-entry": () => __vitePreload(() => import("./vite-entry-group-app-entry--QwNoa_u.js"), [])
};
function loadCodexMobileViteEntryGroups() {
	const status = {
		expectedCount: codexMobileViteEntryGroupIds.length,
		imported: [],
		failed: [],
		ok: false
	};
	globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_STATUS__ = status;
	const promise = Promise.all(codexMobileViteEntryGroupIds.map(async (groupId) => {
		const load = codexMobileViteEntryGroupLoaders[groupId];
		try {
			const module = await load();
			const payload = module && (module.codexMobileViteEntryGroup || module.default) || {};
			status.imported.push(String(payload.id || groupId));
		} catch (_) {
			status.failed.push(groupId);
		}
	})).then(() => {
		const registry = globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};
		status.registryCount = Object.keys(registry).length;
		status.ok = status.failed.length === 0 && status.imported.length === status.expectedCount && status.registryCount === status.expectedCount;
		return status;
	});
	globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_PROMISE__ = promise;
	return promise;
}
//#endregion
//#region frontend/vite-shell-entry.mjs
globalThis.CODEX_MOBILE_SHELL_MANIFEST = shell_asset_manifest_default;
function compactEntryGroup(group) {
	return {
		id: group.id,
		phase: group.phase,
		startupCritical: Boolean(group.startupCritical),
		chunkTarget: group.chunkTarget,
		assets: Array.isArray(group.assets) ? group.assets.slice() : []
	};
}
var entryGroups = Array.isArray(shell_asset_manifest_default.entryGroups) ? shell_asset_manifest_default.entryGroups.map(compactEntryGroup) : [];
var entryTopology = {
	shellCacheName: shell_asset_manifest_default.shellCacheName,
	clientBuildId: shell_asset_manifest_default.clientBuildId,
	startupGroups: entryGroups.filter((group) => group.startupCritical),
	deferredGroups: entryGroups.filter((group) => !group.startupCritical)
};
var classicGlobalExports = Array.isArray(shell_asset_manifest_default.classicGlobalExports) ? shell_asset_manifest_default.classicGlobalExports.map((entry) => ({
	asset: entry.asset,
	globals: Array.isArray(entry.globals) ? entry.globals.slice() : []
})) : [];
var startupGlobalContracts = Array.isArray(shell_asset_manifest_default.startupGlobalContracts) ? shell_asset_manifest_default.startupGlobalContracts.map((entry) => ({
	name: entry.name,
	asset: entry.asset,
	groupId: entry.groupId,
	startupCritical: Boolean(entry.startupCritical),
	source: entry.source
})) : [];
var classicGlobalNames = [...new Set(classicGlobalExports.flatMap((entry) => entry.globals))].sort();
var classicCompatibility = {
	schemaVersion: shell_asset_manifest_default.schemaVersion,
	shellCacheName: shell_asset_manifest_default.shellCacheName,
	clientBuildId: shell_asset_manifest_default.clientBuildId,
	assetCount: classicGlobalExports.length,
	globalCount: classicGlobalNames.length,
	requiredStartupGlobals: startupGlobalContracts.map((entry) => entry.name),
	startupGlobalContracts,
	classicGlobalExports
};
var pendingEsmCompatibility = {
	schemaVersion: 1,
	owner: "vite-shell-entry",
	moduleCount: 0,
	readyCount: 0,
	modules: [],
	loading: true
};
var esmCompatibility = pendingEsmCompatibility;
var viteAppPreviewPage = isAppPreviewPage();
globalThis.__CODEX_MOBILE_VITE_APP_PREVIEW_PAGE__ = viteAppPreviewPage;
var esmCompatibilityImportPromise = __vitePreload(() => import("./_virtual_codex-mobile-esm-compatibility-BtCsJ1cv.js").then(async (module) => {
	const createCompatibility = module && typeof module.codexMobileViteEsmCompatibility === "function" ? module.codexMobileViteEsmCompatibility : null;
	if (!createCompatibility) throw new Error("codex_mobile_vite_esm_compatibility_factory_missing");
	esmCompatibility = await createCompatibility();
	globalThis.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY__ = esmCompatibility;
	return esmCompatibility;
}), []).catch((error) => {
	esmCompatibility = {
		...pendingEsmCompatibility,
		loading: false,
		failed: true,
		errorCode: String(error && error.message || error || "codex_mobile_vite_esm_compatibility_failed").slice(0, 160)
	};
	globalThis.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY__ = esmCompatibility;
	throw error;
});
function shellManifestScriptAssets() {
	return entryGroups.flatMap((group) => Array.isArray(group.assets) ? group.assets : []).filter((asset) => String(asset || "").startsWith("/"));
}
function readAppPreviewClassicLoaderPlan() {
	if (globalThis.document == null) return null;
	const node = globalThis.document.getElementById("codex-vite-app-preview-loader-plan");
	if (!node) return null;
	try {
		const plan = JSON.parse(node.textContent || "{}");
		const scripts = (Array.isArray(plan.scripts) ? plan.scripts : []).map((entry) => ({
			index: Number(entry && entry.index) || 0,
			path: String(entry && entry.path || ""),
			groupId: String(entry && entry.groupId || ""),
			startupCritical: Boolean(entry && entry.startupCritical),
			bytes: Number(entry && entry.bytes) || 0,
			sha256: String(entry && entry.sha256 || "")
		})).filter((entry) => entry.path.startsWith("/"));
		return {
			schemaVersion: Number(plan.schemaVersion) || 1,
			source: String(plan.source || ""),
			owner: String(plan.owner || ""),
			sourceScriptCount: Number(plan.sourceScriptCount) || 0,
			scriptCount: Number(plan.scriptCount) || scripts.length,
			firstScript: String(plan.firstScript || ""),
			lastScript: String(plan.lastScript || ""),
			hashCount: Number(plan.hashCount) || scripts.filter((entry) => entry.sha256).length,
			byteCount: Number(plan.byteCount) || scripts.reduce((total, entry) => total + entry.bytes, 0),
			excludedEsmScriptCount: Number(plan.excludedEsmScriptCount) || 0,
			excludedEsmHashCount: Number(plan.excludedEsmHashCount) || 0,
			excludedEsmByteCount: Number(plan.excludedEsmByteCount) || 0,
			excludedViteOwnedScriptCount: Number(plan.excludedViteOwnedScriptCount) || 0,
			excludedViteOwnedHashCount: Number(plan.excludedViteOwnedHashCount) || 0,
			excludedViteOwnedByteCount: Number(plan.excludedViteOwnedByteCount) || 0,
			excludedEsmScripts: (Array.isArray(plan.excludedEsmScripts) ? plan.excludedEsmScripts : []).map((entry) => ({
				index: Number(entry && entry.index) || 0,
				sourceIndex: Number(entry && entry.sourceIndex) || 0,
				path: String(entry && entry.path || ""),
				groupId: String(entry && entry.groupId || ""),
				phase: String(entry && entry.phase || ""),
				startupCritical: Boolean(entry && entry.startupCritical),
				chunkTarget: String(entry && entry.chunkTarget || ""),
				sourcePath: String(entry && entry.sourcePath || ""),
				bytes: Number(entry && entry.bytes) || 0,
				sha256: String(entry && entry.sha256 || ""),
				esmModuleId: String(entry && entry.esmModuleId || ""),
				globalName: String(entry && entry.globalName || "")
			})).filter((entry) => entry.path.startsWith("/")),
			excludedViteOwnedScripts: (Array.isArray(plan.excludedViteOwnedScripts) ? plan.excludedViteOwnedScripts : []).map((entry) => ({
				index: Number(entry && entry.index) || 0,
				sourceIndex: Number(entry && entry.sourceIndex) || 0,
				path: String(entry && entry.path || ""),
				groupId: String(entry && entry.groupId || ""),
				phase: String(entry && entry.phase || ""),
				startupCritical: Boolean(entry && entry.startupCritical),
				chunkTarget: String(entry && entry.chunkTarget || ""),
				sourcePath: String(entry && entry.sourcePath || ""),
				bytes: Number(entry && entry.bytes) || 0,
				sha256: String(entry && entry.sha256 || ""),
				ownerId: String(entry && entry.ownerId || ""),
				globalName: String(entry && entry.globalName || "")
			})).filter((entry) => entry.path.startsWith("/")),
			sha256: String(plan.sha256 || ""),
			scripts
		};
	} catch (_) {
		return null;
	}
}
function isAppPreviewPage() {
	if (globalThis.document == null) return false;
	const documentElement = globalThis.document.documentElement;
	if (documentElement && documentElement.dataset && documentElement.dataset.codexViteAppPreview === "true") return true;
	return Boolean(globalThis.document.querySelector("meta[name='codex-vite-app-preview']"));
}
function loadClassicScript(assetPath) {
	return new Promise((resolve, reject) => {
		const document = globalThis.document;
		if (!document || !document.createElement) {
			reject(/* @__PURE__ */ new Error("codex_mobile_vite_app_preview_document_missing"));
			return;
		}
		const script = document.createElement("script");
		script.src = assetPath;
		script.async = false;
		script.dataset.codexViteAppPreviewClassicScript = "true";
		script.onload = () => resolve(assetPath);
		script.onerror = () => reject(/* @__PURE__ */ new Error(`codex_mobile_vite_app_preview_script_failed:${assetPath}`));
		(document.head || document.documentElement).appendChild(script);
	});
}
async function startCodexMobileViteAppPreview() {
	const loaderPlan = readAppPreviewClassicLoaderPlan();
	const manifestAssets = shellManifestScriptAssets();
	const assets = loaderPlan && Array.isArray(loaderPlan.scripts) ? loaderPlan.scripts.map((entry) => entry.path) : [];
	const excludedEsmAssets = loaderPlan && Array.isArray(loaderPlan.excludedEsmScripts) ? loaderPlan.excludedEsmScripts.map((entry) => entry.path) : [];
	const excludedViteOwnedAssets = loaderPlan && Array.isArray(loaderPlan.excludedViteOwnedScripts) ? loaderPlan.excludedViteOwnedScripts.map((entry) => entry.path) : [];
	const coveredAssets = /* @__PURE__ */ new Set([
		...assets,
		...excludedEsmAssets,
		...excludedViteOwnedAssets
	]);
	const manifestCoverageMatches = manifestAssets.length > 0 && coveredAssets.size === manifestAssets.length && JSON.stringify(manifestAssets.filter((asset) => coveredAssets.has(asset))) === JSON.stringify(manifestAssets);
	const status = {
		ok: false,
		mode: "vite-app-preview",
		owner: "vite-shell-entry",
		loaderPlanPresent: Boolean(loaderPlan),
		loaderPlanOwner: loaderPlan ? loaderPlan.owner : "",
		loaderPlanSource: loaderPlan ? loaderPlan.source : "",
		loaderPlanScriptCount: loaderPlan ? loaderPlan.scriptCount : 0,
		loaderPlanHashCount: loaderPlan ? loaderPlan.hashCount : 0,
		loaderPlanSourceScriptCount: loaderPlan ? loaderPlan.sourceScriptCount : 0,
		loaderPlanExcludedEsmScriptCount: loaderPlan ? loaderPlan.excludedEsmScriptCount : 0,
		loaderPlanExcludedEsmHashCount: loaderPlan ? loaderPlan.excludedEsmHashCount : 0,
		loaderPlanExcludedViteOwnedScriptCount: loaderPlan ? loaderPlan.excludedViteOwnedScriptCount : 0,
		loaderPlanExcludedViteOwnedHashCount: loaderPlan ? loaderPlan.excludedViteOwnedHashCount : 0,
		loaderPlanSha256: loaderPlan ? loaderPlan.sha256 : "",
		loaderPlanMatchesShellManifest: Boolean(loaderPlan) && manifestCoverageMatches,
		esmCompatibilityReady: false,
		excludedEsmGlobalMissing: [],
		excludedViteOwnedGlobalMissing: [],
		scriptCount: assets.length,
		loaded: [],
		failed: [],
		startedAt: Date.now(),
		completedAt: 0
	};
	globalThis.__CODEX_MOBILE_VITE_APP_PREVIEW__ = status;
	globalThis.__CODEX_MOBILE_VITE_APP_PREVIEW_LOADER_PLAN__ = loaderPlan;
	try {
		if (!loaderPlan) throw new Error("codex_mobile_vite_app_preview_loader_plan_missing");
		if (loaderPlan.owner !== "vite-shell-entry" || !loaderPlan.sha256 || Number(loaderPlan.sourceScriptCount) !== manifestAssets.length || Number(loaderPlan.scriptCount) !== assets.length || Number(loaderPlan.hashCount) !== assets.length || Number(loaderPlan.excludedEsmScriptCount) !== excludedEsmAssets.length || Number(loaderPlan.excludedEsmHashCount) !== excludedEsmAssets.length || Number(loaderPlan.excludedViteOwnedScriptCount || 0) !== excludedViteOwnedAssets.length || Number(loaderPlan.excludedViteOwnedHashCount || 0) !== excludedViteOwnedAssets.length || !manifestCoverageMatches) throw new Error("codex_mobile_vite_app_preview_loader_plan_invalid");
		const loadedEsmCompatibility = await esmCompatibilityImportPromise;
		status.esmCompatibilityReady = Boolean(loadedEsmCompatibility) && loadedEsmCompatibility.owner === "vite-shell-entry" && Number(loadedEsmCompatibility.moduleCount) === Number(loadedEsmCompatibility.readyCount);
		const missingExcludedGlobals = loaderPlan && Array.isArray(loaderPlan.excludedEsmScripts) ? loaderPlan.excludedEsmScripts.filter((entry) => !entry.globalName || !globalThis[entry.globalName]).map((entry) => entry.globalName || entry.path) : [];
		status.excludedEsmGlobalMissing = missingExcludedGlobals;
		if (missingExcludedGlobals.length) throw new Error("codex_mobile_vite_app_preview_esm_globals_missing");
		const missingExcludedViteOwnedGlobals = loaderPlan && Array.isArray(loaderPlan.excludedViteOwnedScripts) ? loaderPlan.excludedViteOwnedScripts.filter((entry) => !entry.globalName || !globalThis[entry.globalName]).map((entry) => entry.globalName || entry.path) : [];
		status.excludedViteOwnedGlobalMissing = missingExcludedViteOwnedGlobals;
		if (missingExcludedViteOwnedGlobals.length) throw new Error("codex_mobile_vite_app_preview_vite_owned_globals_missing");
		for (const asset of assets) {
			await loadClassicScript(asset);
			status.loaded.push(asset);
		}
		if (excludedEsmAssets.includes("/app.js")) {
			const appEntry = globalThis.CodexMobileAppEntry;
			if (!appEntry || typeof appEntry.startCodexMobileApp !== "function") throw new Error("codex_mobile_vite_app_preview_app_entry_missing");
			appEntry.startCodexMobileApp();
		}
		status.ok = true;
	} catch (error) {
		status.ok = false;
		status.failed.push(String(error && error.message || error || "script_failed"));
		throw error;
	} finally {
		status.completedAt = Date.now();
	}
	return {
		ok: status.ok,
		mode: status.mode,
		owner: status.owner,
		loaderPlanPresent: status.loaderPlanPresent,
		loaderPlanScriptCount: status.loaderPlanScriptCount,
		loaderPlanHashCount: status.loaderPlanHashCount,
		loaderPlanSourceScriptCount: status.loaderPlanSourceScriptCount,
		loaderPlanExcludedEsmScriptCount: status.loaderPlanExcludedEsmScriptCount,
		loaderPlanExcludedEsmHashCount: status.loaderPlanExcludedEsmHashCount,
		loaderPlanExcludedViteOwnedScriptCount: status.loaderPlanExcludedViteOwnedScriptCount,
		loaderPlanExcludedViteOwnedHashCount: status.loaderPlanExcludedViteOwnedHashCount,
		loaderPlanSha256: status.loaderPlanSha256,
		loaderPlanMatchesShellManifest: status.loaderPlanMatchesShellManifest,
		esmCompatibilityReady: status.esmCompatibilityReady,
		excludedEsmGlobalMissingCount: status.excludedEsmGlobalMissing.length,
		excludedViteOwnedGlobalMissingCount: status.excludedViteOwnedGlobalMissing.length,
		scriptCount: status.scriptCount,
		loadedCount: status.loaded.length,
		failedCount: status.failed.length
	};
}
var deferredEntryTopologyPromise = __vitePreload(() => import("./vite-deferred-entry-topology-DA3qAdkb.js"), []);
loadCodexMobileViteEntryGroups();
var entryDynamicImportGraph = {
	owner: "vite-shell-entry",
	esmCompatibilitySources: ["virtual:codex-mobile-esm-compatibility"],
	deferredSources: ["frontend/vite-deferred-entry-topology.mjs"],
	entryGroupSources: codexMobileViteEntryGroupIds.map((groupId) => `virtual:codex-mobile-shell-entry-group/${groupId}`),
	expectedImportCount: 2 + codexMobileViteEntryGroupIds.length
};
var appPreviewPromise = viteAppPreviewPage ? startCodexMobileViteAppPreview() : Promise.resolve(null);
globalThis.__CODEX_MOBILE_VITE_SHELL_BUILD_STAGE__ = "entry-topology-v1";
globalThis.__CODEX_MOBILE_VITE_SHELL_ENTRY_TOPOLOGY__ = entryTopology;
globalThis.__CODEX_MOBILE_VITE_CLASSIC_COMPATIBILITY__ = classicCompatibility;
globalThis.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY__ = esmCompatibility;
globalThis.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY_PROMISE__ = esmCompatibilityImportPromise;
globalThis.__CODEX_MOBILE_VITE_DEFERRED_ENTRY_TOPOLOGY__ = deferredEntryTopologyPromise;
globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_OWNER__ = "vite-shell-entry";
globalThis.__CODEX_MOBILE_VITE_ENTRY_DYNAMIC_IMPORT_GRAPH__ = entryDynamicImportGraph;
globalThis.__CODEX_MOBILE_VITE_APP_PREVIEW_PROMISE__ = appPreviewPromise;
//#endregion
export { shell_asset_manifest_default as n, __vitePreload as t };
